"use strict";

/**
 * Isolated SortableJS adapter for reviewed Timeline booking movement.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document) {
  'use strict';

  var modules = window.wpbc_timeline_modules;
  var interactions = window.wpbc_timeline_booking_interactions;
  var config = window.wpbc_timeline_booking_movement_config || {};
  if (!modules || 'function' !== typeof modules.register_factory || !interactions || 'function' !== typeof interactions.register_extension_factory || 'function' !== typeof window.Sortable || !window.jQuery || !window.wp || 'function' !== typeof window.wp.template) {
    return;
  }

  /**
   * Create one movement adapter for one Timeline mount.
   *
   * @param {Object} host_context Domain-neutral Timeline callbacks.
   * @return {Object} Movement lifecycle controller.
   */
  function create_controller(host_context) {
    var mount = host_context.mount;
    var callbacks = host_context.callbacks || {};
    var transport = config.transport || {};
    var review_transport = config.review_transport || {};
    var apply_transport = config.apply_transport || {};
    var sortable_config = config.sortable || {};
    var templates = config.templates || {};
    var i18n = config.i18n || {};
    var records = new WeakMap();
    var visible_records = [];
    var requests = new WeakMap();
    var sortables = [];
    var generation = 0;
    var pending_pointer = null;
    var gesture = null;
    var review_request = null;
    var review_loading_state = null;
    var review_host = null;
    var review_memory = null;
    var apply_request = null;
    var apply_processing_notice = null;
    var pending_apply_result = null;
    var pending_completion = null;
    var lifecycle_state = 'idle';
    var lifecycle_generation = 0;
    var lifecycle_anchor = null;
    var pending_grip_focus_booking_id = 0;
    var replacement_card = null;
    var live_region = null;
    var scroll_frame = 0;
    var initialized = false;
    var is_destroyed = false;
    var group_name = 'wpbc-timeline-movement-' + Math.random().toString(36).slice(2);
    var filter_selector = ['[data-wpbc-timeline-sortable-exclude]', 'button:not([data-wpbc-timeline-booking-movement-grip])', 'a', 'input', 'select', 'textarea', '[data-wpbc-timeline-booking-resize-host]'].join(',');

    /**
     * Return a fixed WordPress template.
     *
     * @param {string} template_id Allow-listed template ID.
     * @return {Function|null} Template renderer or null.
     */
    function template(template_id) {
      try {
        return template_id ? window.wp.template(template_id) : null;
      } catch (error) {
        return null;
      }
    }

    /**
     * Announce an authorized localized message.
     *
     * @param {string} message Status text.
     * @return {void}
     */
    function announce(message) {
      if (live_region) {
        live_region.textContent = String(message || '');
      }
    }

    /**
     * Normalize the source-only movement response.
     *
     * @param {Object} response AJAX response.
     * @param {Object} record Source segment.
     * @return {Object|null} Immutable movement context.
     */
    function normalize_context(response, record) {
      var dto = response && response.success && response.data ? response.data.movement_context : null;
      var seed = dto && dto.schedule_seed ? dto.schedule_seed : {};
      var availability = dto && dto.gesture_availability ? dto.gesture_availability : {};
      var restrictions = dto && dto.gesture_restrictions ? dto.gesture_restrictions : {};
      var dates = Array.isArray(seed.selected_dates) ? seed.selected_dates.map(String) : [];
      var intervals = Array.isArray(seed.exact_intervals) ? seed.exact_intervals.map(function (interval) {
        return Object.freeze({
          start: String(interval.start || ''),
          end: String(interval.end || '')
        });
      }) : [];
      if (!dto || Number(dto.booking_id) !== record.booking_id || !Number(dto.primary_resource_id) || !Number(dto.proposal_revision) || !String(dto.source_context_token || '') || !availability.same_resource && !availability.cross_resource || !dates.length || !['policy', 'individual'].includes(String(seed.selection_method))) {
        return null;
      }
      if ('full_day' !== seed.time_application && (!intervals.length || intervals.some(function (interval) {
        return !Date.parse(interval.start) || Date.parse(interval.end) <= Date.parse(interval.start);
      }))) {
        return null;
      }
      return Object.freeze({
        booking_id: record.booking_id,
        primary_resource_id: Math.round(Number(dto.primary_resource_id)),
        proposal_revision: Math.round(Number(dto.proposal_revision)),
        source_context_token: String(dto.source_context_token),
        same_resource_available: Boolean(availability.same_resource),
        cross_resource_available: Boolean(availability.cross_resource),
        same_resource_restriction: availability.same_resource ? '' : String(restrictions.same_resource || dto.fallback_reason || 'operation_unsupported'),
        cross_resource_restriction: availability.cross_resource ? '' : String(restrictions.cross_resource || dto.fallback_reason || 'operation_unsupported'),
        selection_method: String(seed.selection_method),
        time_application: String(seed.time_application),
        selected_dates: Object.freeze(dates),
        exact_intervals: Object.freeze(intervals)
      });
    }

    /**
     * Hide the decorative indicator until source eligibility is confirmed.
     *
     * The server remains authoritative for movement eligibility. Registration
     * hides the non-interactive marker before selection can imply that dragging
     * is available. A successful response replaces it with the explicit button;
     * every other outcome leaves it hidden until canonical Timeline rerender.
     *
     * @param {Object} record Source segment awaiting canonical context.
     * @return {void}
     */
    function hide_unresolved_indicator(record) {
      var indicator = record && record.rail ? record.rail.querySelector('.wpbc_timeline__booking_drag_indicator') : null;
      if (!indicator || indicator.hidden || indicator.hasAttribute('data-wpbc-timeline-booking-movement-grip')) {
        return;
      }
      indicator.hidden = true;
      if ('function' === typeof callbacks.schedule_layout) {
        callbacks.schedule_layout();
      }
    }

    /**
     * Render the explicit grip after server eligibility succeeds.
     *
     * @param {Object} record Authorized source segment.
     * @return {void}
     */
    function render_grip(record) {
      var renderer = template(templates.grip);
      var rail = record.rail;
      var indicator = rail ? rail.querySelector('.wpbc_timeline__booking_drag_indicator') : null;
      var dock = record.card.querySelector('.wpbc_timeline__booking_accessory_dock');
      var buffer = document.createElement('span');
      var grip;
      if (!renderer || !indicator || indicator.querySelector('[data-wpbc-timeline-booking-movement-grip]')) {
        return;
      }
      buffer.innerHTML = renderer({
        booking_id: record.booking_id,
        label: i18n.grip_label || ''
      });
      if (!buffer.firstElementChild) {
        return;
      }
      indicator.replaceWith(buffer.firstElementChild);
      [rail, dock].forEach(function (element) {
        if (element) {
          element.removeAttribute('data-wpbc-timeline-sortable-exclude');
        }
      });
      rail.setAttribute('data-wpbc-timeline-booking-control-rail-card-owned', '');
      record.card.setAttribute('data-wpbc-timeline-booking-movable', 'true');
      if ('function' === typeof callbacks.schedule_layout) {
        callbacks.schedule_layout();
      }
      if (pending_grip_focus_booking_id === record.booking_id) {
        grip = record.card.querySelector('[data-wpbc-timeline-booking-movement-grip]');
        pending_grip_focus_booking_id = 0;
        if (grip && grip.isConnected) {
          grip.focus();
        }
      }
    }

    /**
     * Request source eligibility without requesting any target authority.
     *
     * @param {Object} record Canonical rendered segment.
     * @return {void}
     */
    function request_context(record) {
      var request_generation;
      var pending;
      if (!record || 'idle' !== record.state || !transport.url) {
        return;
      }
      generation += 1;
      request_generation = generation;
      record.state = 'loading';
      record.generation = request_generation;
      hide_unresolved_indicator(record);
      pending = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.action,
          nonce: transport.nonce,
          booking_id: record.booking_id,
          source: 'timeline',
          segment_id: record.segment_id,
          segment_resource_id: record.resource_id,
          visible_start_at: record.visible_start,
          visible_end_at: record.visible_end,
          proposal_revision: 1
        }
      }).done(function (response) {
        var movement_context;
        if (request_generation !== record.generation || records.get(record.card) !== record || !record.card.isConnected) {
          return;
        }
        movement_context = normalize_context(response, record);
        record.context = movement_context;
        record.state = movement_context ? 'ready' : 'denied';
        if (movement_context) {
          render_grip(record);
        }
      }).fail(function (failed_request, status) {
        if ('abort' !== status && request_generation === record.generation && records.get(record.card) === record) {
          record.state = 'error';
        }
      }).always(function () {
        if (requests.get(record.card) === pending) {
          requests.delete(record.card);
        }
      });
      requests.set(record.card, pending);
    }

    /**
     * Lazily request context on deliberate indicator hover or card focus.
     *
     * @param {Event} event Pointer or focus event.
     * @return {void}
     */
    function on_context_intent(event) {
      var card = resolve_accessory_card(event.target);
      var record = card ? records.get(card) : null;
      if (record && ('focusin' === event.type || card.classList.contains('is-booking-selected'))) {
        request_context(record);
      }
    }

    /**
     * Capture pointer origin only from an authorized explicit grip.
     *
     * @param {PointerEvent} event Pointer-down event.
     * @return {void}
     */
    function on_pointer_down(event) {
      var grip = event.target.closest('[data-wpbc-timeline-booking-movement-grip]');
      var card = grip ? resolve_accessory_card(grip) : null;
      var record = card ? records.get(card) : null;
      if (record && record.context && ('function' !== typeof callbacks.can_start_interaction || callbacks.can_start_interaction())) {
        pending_pointer = {
          card: card,
          x: Number(event.clientX),
          y: Number(event.clientY)
        };
      }
    }

    /**
     * Resolve a canonical card from an in-card or detached control rail.
     *
     * @param {HTMLElement} accessory Control or accessory descendant.
     * @return {HTMLElement|null} Canonical card or null.
     */
    function resolve_accessory_card(accessory) {
      var card = accessory && accessory.closest ? accessory.closest('[data-wpbc-timeline-segment-id]') : null;
      var rail;
      var segment_id;
      if (card) {
        return card;
      }
      rail = accessory && accessory.closest ? accessory.closest('[data-wpbc-timeline-booking-control-rail]') : null;
      segment_id = rail ? String(rail.getAttribute('data-wpbc-timeline-accessory-segment-id') || '') : '';
      if (!segment_id) {
        return null;
      }
      mount.querySelectorAll('[data-wpbc-timeline-segment-id]').forEach(function (candidate) {
        if (!card && segment_id === String(candidate.getAttribute('data-wpbc-timeline-segment-id') || '')) {
          card = candidate;
        }
      });
      return card;
    }

    /**
     * Capture axis DTOs with their current physical rectangles.
     *
     * @return {Object} Immutable axis snapshot.
     */
    function capture_axis() {
      var axis = 'function' === typeof callbacks.get_axis ? callbacks.get_axis() || {} : {};
      var headers = mount.querySelectorAll('[data-wpbc-timeline-axis-cell]');
      var cells = Array.isArray(axis.cells) ? axis.cells.map(function (cell, index) {
        var rectangle = headers[index] ? headers[index].getBoundingClientRect() : null;
        return rectangle ? Object.freeze({
          start_epoch: Number(cell.start_epoch),
          end_epoch: Number(cell.end_epoch),
          date: String(cell.date || ''),
          left: rectangle.left,
          right: rectangle.right
        }) : null;
      }).filter(Boolean) : [];
      return Object.freeze({
        cells: Object.freeze(cells),
        timezone: String(axis.timezone || 'UTC'),
        is_rtl: 'rtl' === window.getComputedStyle(mount).direction
      });
    }

    /**
     * Capture every visible Resource-row target, including empty rows.
     *
     * @return {Array<Object>} Immutable target records.
     */
    function capture_rows() {
      var rows = Array.prototype.map.call(mount.querySelectorAll('[data-wpbc-timeline-segments]'), function (host, order) {
        var track = host.closest('[data-wpbc-timeline-resource-id]');
        var rectangle = host.getBoundingClientRect();
        return Object.freeze({
          host: host,
          resource_id: Number(track && track.getAttribute('data-wpbc-timeline-resource-id')),
          order: order,
          top: rectangle.top,
          bottom: rectangle.bottom,
          left: rectangle.left,
          right: rectangle.right
        });
      }).filter(function (row) {
        return row.resource_id && row.right > row.left && row.bottom > row.top;
      });
      return Object.freeze(rows);
    }

    /**
     * Snapshot DOM, axis, rows, scroll, selection, and focus on choose.
     *
     * @param {Object} event Sortable choose event.
     * @return {void}
     */
    function on_choose(event) {
      var record = records.get(event.item);
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      var title = event.item.querySelector('.wpbc_timeline__booking_details strong');
      var duration = event.item.querySelector('.wpbc_timeline__booking_secondary');
      var source_host = event.item.parentNode;
      if (!record || !record.context || !pending_pointer || pending_pointer.card !== event.item) {
        return;
      }
      gesture = {
        card: event.item,
        record: record,
        parent: event.item.parentNode,
        next: event.item.nextSibling,
        style: event.item.getAttribute('style'),
        class_name: event.item.getAttribute('class'),
        axis: capture_axis(),
        rows: capture_rows(),
        canvas: canvas,
        canvas_scroll: canvas ? canvas.scrollLeft : 0,
        canvas_rectangle: canvas ? canvas.getBoundingClientRect() : null,
        doc_x: window.pageXOffset || 0,
        doc_y: window.pageYOffset || 0,
        selected: event.item.classList.contains('is-booking-selected'),
        focus: document.activeElement,
        start_x: pending_pointer.x,
        start_y: pending_pointer.y,
        x: pending_pointer.x,
        y: pending_pointer.y,
        candidate: null,
        pending_candidate: null,
        candidate_since: 0,
        origin: null,
        started: false,
        source_row: null,
        visual_drop_intent: null,
        drop_intent: null,
        sortable_destination: null,
        candidate_ghost: null,
        candidate_ghost_host: null,
        ghost_data: Object.freeze({
          title: title ? String(title.textContent || '').trim() : '',
          duration_label: duration ? String(duration.textContent || '').trim() : ''
        })
      };
      gesture.source_row = get_row_for_host(gesture, source_host);
      if (!gesture.source_row) {
        gesture = null;
        pending_pointer = null;
      }
    }

    /**
     * Make a clone presentation-only and inert.
     *
     * @param {HTMLElement} clone Clone to sanitize.
     * @return {void}
     */
    function sanitize_clone(clone) {
      if (!clone) {
        return;
      }
      clone.setAttribute('aria-hidden', 'true');
      clone.style.pointerEvents = 'none';
      clone.querySelectorAll('[id]').forEach(function (node) {
        node.removeAttribute('id');
      });
      clone.querySelectorAll('[tabindex], button, a, input, select, textarea').forEach(function (node) {
        node.removeAttribute('tabindex');
        node.setAttribute('aria-hidden', 'true');
        if ('disabled' in node) {
          node.disabled = true;
        }
      });
      clone.querySelectorAll('[data-wpbc-booking-inspector-trigger], [data-wpbc-booking-overview-info-trigger], [data-wpbc-timeline-booking-details-action], [data-wpbc-timeline-booking-resize-host], [data-wpbc-timeline-booking-movement-grip]').forEach(function (node) {
        ['data-wpbc-booking-inspector-trigger', 'data-wpbc-booking-overview-info-trigger', 'data-wpbc-timeline-booking-details-action', 'data-wpbc-timeline-booking-resize-host', 'data-wpbc-timeline-booking-movement-grip'].forEach(function (attribute) {
          node.removeAttribute(attribute);
        });
      });
    }

    /**
     * Sanitize Sortable's mirror clone.
     *
     * @param {Object} event Sortable clone event.
     * @return {void}
     */
    function on_clone(event) {
      sanitize_clone(event.clone);
      if (event.clone) {
        event.clone.classList.add('wpbc_timeline_booking_movement__mirror');
      }
    }

    /**
     * Start locks, origin representation, targets, and owned autoscroll.
     *
     * @return {void}
     */
    function on_start() {
      if (!gesture) {
        return;
      }
      gesture.started = true;
      gesture.origin = gesture.card.cloneNode(true);
      sanitize_clone(gesture.origin);
      gesture.origin.classList.add('wpbc_timeline_booking_movement__origin');
      gesture.origin.removeAttribute('data-wpbc-timeline-booking-movable');
      gesture.parent.insertBefore(gesture.origin, gesture.next);
      mount.classList.add('is-booking-movement-active');
      if (callbacks.set_interaction_suspended) {
        callbacks.set_interaction_suspended(true, gesture.card);
      }
      if (callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(true);
      }
      document.addEventListener('pointermove', on_pointer_move, true);
      document.addEventListener('pointerup', on_pointer_completion, true);
      document.addEventListener('pointercancel', on_lost_pointer, true);
      start_autoscroll();
    }

    /**
     * Return one row captured for a Sortable segment host.
     *
     * @param {Object} state Active movement gesture.
     * @param {HTMLElement|null} host Sortable destination host.
     * @return {Object|null} Captured row or null.
     */
    function get_row_for_host(state, host) {
      var matched = null;
      if (!state || !host) {
        return null;
      }
      state.rows.some(function (row) {
        if (row.host === host) {
          matched = row;
          return true;
        }
        return false;
      });
      return matched;
    }

    /**
     * Return one row rectangle in captured or current viewport coordinates.
     *
     * Captured geometry is rebased by document and Timeline-canvas scrolling.
     * Current geometry is read back from the same stable host immediately before
     * use. A disconnected or collapsed host is not a valid destination.
     *
     * @param {Object} state Active movement gesture.
     * @param {Object} row Captured row record.
     * @param {string} geometry Geometry source: `captured` or `current`.
     * @return {Object|null} Viewport rectangle or null.
     */
    function get_row_rectangle(state, row, geometry) {
      var rectangle;
      var document_delta_x;
      var document_delta_y;
      var canvas_delta_x;
      if ('current' === geometry) {
        if (!row.host.isConnected) {
          return null;
        }
        rectangle = row.host.getBoundingClientRect();
        return rectangle.right > rectangle.left && rectangle.bottom > rectangle.top ? rectangle : null;
      }
      document_delta_x = (window.pageXOffset || 0) - state.doc_x;
      document_delta_y = (window.pageYOffset || 0) - state.doc_y;
      canvas_delta_x = state.canvas ? state.canvas.scrollLeft - state.canvas_scroll : 0;
      return {
        left: row.left - document_delta_x - canvas_delta_x,
        right: row.right - document_delta_x - canvas_delta_x,
        top: row.top - document_delta_y,
        bottom: row.bottom - document_delta_y
      };
    }

    /**
     * Return the visible Timeline canvas window for row hit-testing.
     *
     * @param {Object} state Active movement gesture.
     * @param {string} geometry Geometry source: `captured` or `current`.
     * @return {Object|null} Clipped viewport rectangle or null.
     */
    function get_canvas_window(state, geometry) {
      var rectangle;
      var document_delta_x;
      var document_delta_y;
      if (!state.canvas || !state.canvas_rectangle) {
        return null;
      }
      if ('current' === geometry) {
        rectangle = state.canvas.getBoundingClientRect();
      } else {
        document_delta_x = (window.pageXOffset || 0) - state.doc_x;
        document_delta_y = (window.pageYOffset || 0) - state.doc_y;
        rectangle = {
          left: state.canvas_rectangle.left - document_delta_x,
          right: state.canvas_rectangle.right - document_delta_x,
          top: state.canvas_rectangle.top - document_delta_y,
          bottom: state.canvas_rectangle.bottom - document_delta_y
        };
      }
      return {
        left: Math.max(0, rectangle.left),
        right: Math.min(document.documentElement.clientWidth, rectangle.right),
        top: Math.max(0, rectangle.top),
        bottom: Math.min(document.documentElement.clientHeight, rectangle.bottom)
      };
    }

    /**
     * Resolve one unique neutral row candidate from explicit geometry.
     *
     * Equal-distance overlaps are rejected instead of being resolved by DOM order.
     * The stable row order is retained only to make inspection deterministic; it
     * never breaks an ambiguous tie.
     *
     * @param {Object} state Active movement gesture.
     * @param {number} x Viewport X coordinate.
     * @param {number} y Viewport Y coordinate.
     * @param {string} geometry Geometry source: `captured` or `current`.
     * @return {Object} Resolution record with status and optional row.
     */
    function resolve_row(state, x, y, geometry) {
      var threshold = Number(sortable_config.empty_insert_threshold) || 18;
      var canvas_window = get_canvas_window(state, geometry);
      var matches = [];
      if (!canvas_window || x < canvas_window.left || x > canvas_window.right || y < canvas_window.top || y > canvas_window.bottom) {
        return {
          status: 'out_of_window',
          row: null
        };
      }
      state.rows.forEach(function (row) {
        var rectangle = get_row_rectangle(state, row, geometry);
        var row_distance;
        if (!rectangle || x < Math.max(rectangle.left, canvas_window.left) || x > Math.min(rectangle.right, canvas_window.right)) {
          return;
        }
        row_distance = y < rectangle.top ? rectangle.top - y : y > rectangle.bottom ? y - rectangle.bottom : 0;
        if (row_distance <= threshold) {
          matches.push({
            row: row,
            distance: row_distance
          });
        }
      });
      matches.sort(function (first, second) {
        return first.distance === second.distance ? first.row.order - second.row.order : first.distance - second.distance;
      });
      if (!matches.length) {
        return {
          status: 'none',
          row: null
        };
      }
      if (1 < matches.length && Math.abs(matches[0].distance - matches[1].distance) < 0.5) {
        return {
          status: 'ambiguous',
          row: null
        };
      }
      return {
        status: 'resolved',
        row: matches[0].row
      };
    }

    /**
     * Validate the frozen drop intent against the last rendered WPBC ghost.
     *
     * The visible custom ghost is created before Sortable completion bookkeeping.
     * Its stored Resource identity therefore remains stable even when Sortable
     * reparents or restores the real card before invoking `onEnd`. No target
     * authorization is inferred by this comparison.
     *
     * @param {Object} state Completed movement gesture.
     * @return {Object|null} Unique candidate row or null.
     */
    function resolve_drop_candidate(state) {
      var frozen_target = state.drop_intent ? state.rows.filter(function (row) {
        return row.resource_id === state.drop_intent.target_resource_id;
      })[0] : null;
      var visual_target = state.candidate_ghost_host ? get_row_for_host(state, state.candidate_ghost_host) : null;
      if (!frozen_target || !visual_target || !frozen_target.host.isConnected || visual_target.resource_id !== frozen_target.resource_id) {
        return null;
      }
      return frozen_target;
    }

    /**
     * Freeze the Resource identity already attached to the visible WPBC ghost.
     *
     * The visual intent is recorded during pointer movement, when the custom ghost
     * is rendered. This function only promotes that already-captured identity to
     * the immutable completion intent. It deliberately reads no pointer-completion
     * coordinates and no Sortable `event.to` value because Sortable may process its
     * own earlier-registered document listener before WPBC receives `pointerup`.
     *
     * This records interaction identity only. It does not authorize the Resource;
     * canonical Review must still reauthorize the submitted target server-side.
     *
     * @param {Object} state Active movement gesture.
     * @return {Object|null} Frozen target row or null when reconciliation fails.
     */
    function freeze_drop_intent(state) {
      var target_row;
      if (!state || state.drop_intent) {
        return state && state.drop_intent ? state.rows.filter(function (row) {
          return row.resource_id === state.drop_intent.target_resource_id;
        })[0] || null : null;
      }
      if (!state.source_row || !state.visual_drop_intent) {
        return null;
      }
      target_row = state.rows.filter(function (row) {
        return row.resource_id === state.visual_drop_intent.target_resource_id;
      })[0] || null;
      if (!target_row || target_row.host !== state.visual_drop_intent.target_host || !target_row.host.isConnected) {
        return null;
      }
      state.drop_intent = state.visual_drop_intent;
      return target_row;
    }

    /**
     * Remove the presentation-only ghost owned by one movement gesture.
     *
     * @param {Object} state Active movement gesture.
     * @return {void}
     */
    function clear_candidate_ghost(state) {
      if (!state) {
        return;
      }
      if (state.candidate_ghost) {
        state.candidate_ghost.remove();
      }
      state.candidate_ghost = null;
      state.candidate_ghost_host = null;
      state.visual_drop_intent = null;
    }

    /**
     * Return the server-owned restriction for one visible destination row.
     *
     * A missing reason never makes an unavailable gesture eligible. It falls back
     * to the generic operation restriction so the explicit drop can still explain
     * why the canonical card returned to its saved position.
     *
     * @param {Object} state Active movement gesture.
     * @param {Object|null} candidate Candidate Resource row.
     * @return {string} Stable restriction key, or an empty string when eligible.
     */
    function get_candidate_restriction(state, candidate) {
      var movement = state && state.record ? state.record.context : null;
      var source_resource_id;
      var is_cross_resource;
      if (!movement || !candidate) {
        return '';
      }
      source_resource_id = state.source_row ? Number(state.source_row.resource_id) : Number(state.record.resource_id);
      is_cross_resource = Number(candidate.resource_id) !== source_resource_id;
      if (is_cross_resource) {
        return movement.cross_resource_available ? '' : String(movement.cross_resource_restriction || 'operation_unsupported');
      }
      return movement.same_resource_available ? '' : String(movement.same_resource_restriction || 'operation_unsupported');
    }

    /**
     * Show one accessible warning after an explicitly denied destination drop.
     *
     * Pointer movement remains quiet so crossing Resource rows cannot create a
     * stream of global notices. The warning is emitted only after the user drops.
     *
     * @param {string} reason Server-owned restriction key.
     * @return {void}
     */
    function show_destination_warning(reason) {
      var denial_reasons = i18n.denial_reasons && 'object' === typeof i18n.denial_reasons ? i18n.denial_reasons : {};
      var message = denial_reasons[reason] || i18n.destination_unavailable || i18n.unavailable || '';
      announce(message);
      if (message && callbacks && 'function' === typeof callbacks.show_admin_message) {
        callbacks.show_admin_message(String(message), 'warning', 7000);
      }
    }

    /**
     * Render the neutral ghost only inside the stabilized WPBC candidate row.
     *
     * Geometry is derived from the captured canonical card and the same snapped
     * axis-cell delta later used by proposal construction. It communicates only
     * placement intent; the server still authorizes the Resource and schedule.
     * Cross-Resource feedback uses the neutral first lane because copying a
     * deeper source lane could paint outside a shorter candidate Resource row.
     *
     * @param {Object} state Active movement gesture.
     * @return {void}
     */
    function update_candidate_ghost(state) {
      var renderer;
      var buffer;
      var axis_delta;
      var candidate_top;
      var physical_delta;
      if (!state || !state.candidate || !state.axis.cells.length || get_candidate_restriction(state, state.candidate)) {
        clear_candidate_ghost(state);
        return;
      }
      axis_delta = get_pointer_axis_delta(state);
      if (!axis_delta || !has_meaningful_movement(state, axis_delta)) {
        clear_candidate_ghost(state);
        return;
      }
      if (!state.candidate_ghost || state.candidate_ghost_host !== state.candidate.host) {
        clear_candidate_ghost(state);
        renderer = template(templates.ghost);
        buffer = document.createElement('div');
        if (!renderer) {
          return;
        }
        buffer.innerHTML = renderer(state.ghost_data);
        state.candidate_ghost = buffer.firstElementChild;
        if (!state.candidate_ghost) {
          return;
        }
        state.candidate_ghost_host = state.candidate.host;
        candidate_top = state.candidate.resource_id === state.record.resource_id ? state.card.style.getPropertyValue('top') : 'var(--wpbc_timeline_general__booking-lane-offset)';
        state.candidate_ghost.style.setProperty('inset-inline-start', state.card.style.getPropertyValue('inset-inline-start'));
        state.candidate_ghost.style.setProperty('width', state.card.style.getPropertyValue('width'));
        state.candidate_ghost.style.setProperty('top', candidate_top);
        state.candidate_ghost_host.appendChild(state.candidate_ghost);
      }
      physical_delta = 'full_day' === state.record.context.time_application ? axis_delta.calendar_physical_delta_pixels : axis_delta.physical_delta_pixels;
      state.candidate_ghost.style.transform = 'translate3d(' + physical_delta + 'px, 0, 0)';
      state.visual_drop_intent = Object.freeze({
        source_resource_id: Number(state.source_row ? state.source_row.resource_id : state.record.resource_id),
        target_resource_id: Number(state.candidate.resource_id),
        target_host: state.candidate_ghost_host
      });
    }

    /**
     * Stabilize neutral candidate feedback without claiming authorization.
     *
     * @param {Object|null} candidate Candidate row.
     * @return {void}
     */
    function stabilize_candidate(candidate) {
      var now = window.performance.now();
      var moved = Math.hypot(gesture.x - gesture.start_x, gesture.y - gesture.start_y);
      var restriction;
      if (moved < (Number(sortable_config.deliberate_movement_pixels) || 6)) {
        candidate = null;
      }
      if (candidate !== gesture.pending_candidate) {
        gesture.pending_candidate = candidate;
        gesture.candidate_since = now;
        return;
      }
      if (now - gesture.candidate_since < (Number(sortable_config.candidate_dwell_milliseconds) || 90) || candidate === gesture.candidate) {
        return;
      }
      if (gesture.candidate) {
        gesture.candidate.host.classList.remove('is-booking-movement-candidate');
      }
      clear_candidate_ghost(gesture);
      gesture.candidate = candidate;
      if (candidate) {
        restriction = get_candidate_restriction(gesture, candidate);
        if (!restriction) {
          candidate.host.classList.add('is-booking-movement-candidate');
          announce(String(i18n.candidate_target || '').replace('%s', String(candidate.resource_id)));
        }
      }
      update_candidate_ghost(gesture);
    }

    /**
     * Record pointer geometry only; never request or authorize in onMove.
     *
     * @param {PointerEvent} event Pointer-move event.
     * @return {void}
     */
    function on_pointer_move(event) {
      var resolution;
      if (gesture) {
        gesture.x = Number(event.clientX);
        gesture.y = Number(event.clientY);
        resolution = resolve_row(gesture, gesture.x, gesture.y, 'current');
        stabilize_candidate('resolved' === resolution.status ? resolution.row : null);
        update_candidate_ghost(gesture);
      }
    }

    /**
     * Mirror Sortable move events into the deterministic hit test.
     *
     * @param {Object} event Sortable move event.
     * @param {Event} original_event Original input event.
     * @return {boolean} Whether Sortable may track the reconciled row destination.
     */
    function on_move(event, original_event) {
      var pointer = original_event || event.originalEvent;
      var resolution;
      var sortable_destination;
      if (gesture && pointer && Number.isFinite(Number(pointer.clientX))) {
        gesture.x = Number(pointer.clientX);
        gesture.y = Number(pointer.clientY);
        resolution = resolve_row(gesture, gesture.x, gesture.y, 'current');
        sortable_destination = get_row_for_host(gesture, event.to);
        gesture.sortable_destination = sortable_destination;
        if ('resolved' !== resolution.status || !sortable_destination || resolution.row.resource_id !== sortable_destination.resource_id) {
          stabilize_candidate(null);
          update_candidate_ghost(gesture);
          return false;
        }
        stabilize_candidate(resolution.row);
        update_candidate_ghost(gesture);
        return !get_candidate_restriction(gesture, resolution.row);
      }
      return false;
    }

    /** Run owned dual-axis autoscroll. @return {void} */
    function autoscroll() {
      var edge = Number(sortable_config.autoscroll_edge_pixels) || 48;
      var maximum = Number(sortable_config.autoscroll_max_pixels) || 18;
      var rectangle;
      var delta = 0;
      scroll_frame = 0;
      if (!gesture || !gesture.started) {
        return;
      }
      if (gesture.canvas) {
        rectangle = gesture.canvas.getBoundingClientRect();
        if (gesture.x < rectangle.left + edge) {
          delta = -maximum;
        }
        if (gesture.x > rectangle.right - edge) {
          delta = maximum;
        }
        gesture.canvas.scrollLeft += delta;
      }
      delta = gesture.y < edge ? -maximum : gesture.y > document.documentElement.clientHeight - edge ? maximum : 0;
      if (delta) {
        window.scrollBy(0, delta);
      }
      scroll_frame = window.requestAnimationFrame(autoscroll);
    }

    /** Start the movement-owned autoscroll loop. @return {void} */
    function start_autoscroll() {
      if (!scroll_frame) {
        scroll_frame = window.requestAnimationFrame(autoscroll);
      }
    }

    /** Stop the movement-owned autoscroll loop. @return {void} */
    function stop_autoscroll() {
      if (scroll_frame) {
        window.cancelAnimationFrame(scroll_frame);
        scroll_frame = 0;
      }
    }

    /**
     * Restore the real card to its captured DOM position and attributes.
     *
     * @param {Object} state Captured gesture state.
     * @return {void}
     */
    function restore_card(state) {
      state.parent.insertBefore(state.card, state.next);
      if (null === state.style) {
        state.card.removeAttribute('style');
      } else {
        state.card.setAttribute('style', state.style);
      }
      state.card.setAttribute('class', state.class_name);
      if (state.origin) {
        state.origin.remove();
        state.origin = null;
      }
    }

    /**
     * Release every temporary target, listener, mirror, and interaction lock.
     *
     * @param {Object} state Captured gesture state.
     * @return {void}
     */
    function release(state) {
      stop_autoscroll();
      clear_candidate_ghost(state);
      document.removeEventListener('pointermove', on_pointer_move, true);
      document.removeEventListener('pointerup', on_pointer_completion, true);
      document.removeEventListener('pointercancel', on_lost_pointer, true);
      mount.classList.remove('is-booking-movement-active');
      mount.querySelectorAll('.is-booking-movement-candidate').forEach(function (node) {
        node.classList.remove('is-booking-movement-candidate');
      });
      document.querySelectorAll('.wpbc_timeline_booking_movement__sortable-fallback, .wpbc_timeline_booking_movement__mirror').forEach(function (node) {
        if (node !== state.card) {
          node.remove();
        }
      });
      if (callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(false);
      }
      if (callbacks.set_interaction_suspended) {
        callbacks.set_interaction_suspended(false, state.card);
      }
      pending_pointer = null;
    }

    /**
     * Return the clamped axis cell under one physical coordinate.
     *
     * @param {Object} axis Captured axis.
     * @param {number} x Viewport X coordinate.
     * @return {number} Axis-cell index.
     */
    function cell_index(axis, x) {
      var found = -1;
      axis.cells.some(function (cell, index) {
        if (x >= cell.left && x <= cell.right) {
          found = index;
          return true;
        }
        return false;
      });
      if (-1 !== found) {
        return found;
      }
      if (axis.is_rtl) {
        return x > axis.cells[0].right ? 0 : axis.cells.length - 1;
      }
      return x < axis.cells[0].left ? 0 : axis.cells.length - 1;
    }

    /**
     * Return the signed whole-day distance between strict ISO calendar dates.
     *
     * Axis cells at hour and minute scales share the same site-local date. Using
     * this value prevents one sub-day cell from becoming a one-day full-day move.
     *
     * @param {string} source_date Source ISO date.
     * @param {string} target_date Target ISO date.
     * @return {number|null} Signed calendar-day distance, or null.
     */
    function calendar_day_delta(source_date, target_date) {
      var source_match = String(source_date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var target_match = String(target_date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var source_epoch;
      var target_epoch;
      if (!source_match || !target_match) {
        return null;
      }
      source_epoch = Date.UTC(Number(source_match[1]), Number(source_match[2]) - 1, Number(source_match[3]));
      target_epoch = Date.UTC(Number(target_match[1]), Number(target_match[2]) - 1, Number(target_match[3]));
      return Math.round((target_epoch - source_epoch) / 86400000);
    }

    /**
     * Return the first captured axis cell for one site-local date.
     *
     * @param {Object} axis Captured Timeline axis.
     * @param {string} date ISO calendar date.
     * @return {number} Cell index, or -1 when absent.
     */
    function first_date_cell_index(axis, date) {
      var found = -1;
      axis.cells.some(function (cell, index) {
        if (date === cell.date) {
          found = index;
          return true;
        }
        return false;
      });
      return found;
    }

    /**
     * Convert physical pointer movement into one immutable Timeline-axis delta.
     *
     * The pointer start and current pointer position are both resolved against
     * the captured axis. This deliberately ignores Sortable list indexes and the
     * rendered card origin, which may represent only a clipped schedule segment.
     * Canvas scrolling is rebased into the captured coordinate space so the same
     * delta drives both the destination ghost and the canonical schedule seed.
     *
     * @param {Object} state Captured gesture state.
     * @return {Object|null} Snapped cell, instant, and physical deltas, or null.
     */
    function get_pointer_axis_delta(state) {
      var source_index;
      var target_index;
      var target_x;
      var day_delta;
      var source_day_index;
      var target_day_index;
      if (!state || !state.axis || !state.axis.cells.length) {
        return null;
      }
      source_index = cell_index(state.axis, state.start_x);
      target_x = state.x + (state.canvas ? state.canvas.scrollLeft - state.canvas_scroll : 0);
      target_index = cell_index(state.axis, target_x);
      day_delta = calendar_day_delta(state.axis.cells[source_index].date, state.axis.cells[target_index].date);
      source_day_index = first_date_cell_index(state.axis, state.axis.cells[source_index].date);
      target_day_index = first_date_cell_index(state.axis, state.axis.cells[target_index].date);
      if (null === day_delta || 0 > source_day_index || 0 > target_day_index) {
        return null;
      }
      return Object.freeze({
        source_index: source_index,
        target_index: target_index,
        cell_delta: target_index - source_index,
        calendar_day_delta: day_delta,
        /* Timeline axis epochs are Unix seconds; browser Date timestamps are milliseconds. */
        instant_delta_milliseconds: 1000 * (state.axis.cells[target_index].start_epoch - state.axis.cells[source_index].start_epoch),
        calendar_physical_delta_pixels: state.axis.cells[target_day_index].left - state.axis.cells[source_day_index].left,
        physical_delta_pixels: state.axis.cells[target_index].left - state.axis.cells[source_index].left
      });
    }

    /**
     * Whether a snapped pointer destination changes date/time or Resource.
     *
     * @param {Object} state Captured gesture state.
     * @param {Object} axis_delta Captured pointer-to-axis delta.
     * @return {boolean} True when canonical Review has a meaningful proposal.
     */
    function has_meaningful_movement(state, axis_delta) {
      var movement_resources = get_movement_resources(state);
      if (movement_resources.is_cross_resource) {
        return true;
      }
      if ('full_day' === state.record.context.time_application) {
        return 0 !== axis_delta.calendar_day_delta;
      }
      return 0 !== axis_delta.instant_delta_milliseconds;
    }

    /**
     * Resolve immutable source and target row identities for proposal semantics.
     *
     * The segment DTO identifies the canonical source allocation used by the
     * context endpoint, but it must not decide whether the completed pointer
     * gesture crossed visible Resource rows. That interaction meaning comes from
     * the captured source host and the reconciled final destination host. The
     * server continues to authorize the submitted target independently.
     *
     * @param {Object} state Captured gesture state.
     * @return {Object} Source Resource, target Resource, and cross-row flag.
     */
    function get_movement_resources(state) {
      var source_resource = state.source_row ? Number(state.source_row.resource_id) : Number(state.record.resource_id);
      var target_resource = state.drop_intent ? Number(state.drop_intent.target_resource_id) : state.candidate ? Number(state.candidate.resource_id) : source_resource;
      return Object.freeze({
        source_resource_id: source_resource,
        target_resource_id: target_resource,
        is_cross_resource: Boolean(source_resource && target_resource && source_resource !== target_resource)
      });
    }

    /**
     * Shift a strict ISO calendar date by whole calendar days.
     *
     * @param {string} value ISO date.
     * @param {number} days Signed day count.
     * @return {string} Shifted ISO date or empty string.
     */
    function shift_date(value, days) {
      var match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var date;
      if (!match) {
        return '';
      }
      date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
      return date.toISOString().slice(0, 10);
    }

    /**
     * Return site-timezone date parts for one epoch.
     *
     * @param {number} epoch Epoch milliseconds.
     * @param {string} timezone IANA timezone.
     * @return {Object|null} Zoned parts or null.
     */
    function zoned_parts(epoch, timezone) {
      var values = {};
      var formatter;
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
        formatter.formatToParts(new Date(epoch)).forEach(function (part) {
          if ('literal' !== part.type) {
            values[part.type] = Number(part.value);
          }
        });
      } catch (error) {
        return null;
      }
      return values.year ? values : null;
    }

    /**
     * Format an epoch as an RFC3339 exact minute in the site timezone.
     *
     * @param {number} epoch Epoch milliseconds.
     * @param {string} timezone IANA timezone.
     * @return {string} Exact-minute instant or empty string.
     */
    function format_instant(epoch, timezone) {
      var parts = zoned_parts(epoch, timezone);
      var represented;
      var offset;
      var sign;
      var pad = function (value, length) {
        return String(Math.abs(Math.round(value))).padStart(length, '0');
      };
      if (!parts) {
        return '';
      }
      represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      offset = Math.round((represented - epoch) / 60000);
      sign = 0 <= offset ? '+' : '-';
      return pad(parts.year, 4) + '-' + pad(parts.month, 2) + '-' + pad(parts.day, 2) + 'T' + pad(parts.hour, 2) + ':' + pad(parts.minute, 2) + ':00' + sign + pad(Math.floor(Math.abs(offset) / 60), 2) + ':' + pad(Math.abs(offset) % 60, 2);
    }

    /**
     * Build the bounded non-authoritative proposal after DOM restoration.
     *
     * @param {Object} state Captured gesture state.
     * @return {Object|null} Review proposal or null.
     */
    function proposal_from(state) {
      var axis_delta;
      var movement = state.record.context;
      var movement_resources = get_movement_resources(state);
      var cross_resource = movement_resources.is_cross_resource;
      var target_resource = cross_resource ? movement_resources.target_resource_id : movement.primary_resource_id;
      var proposal;
      axis_delta = get_pointer_axis_delta(state);
      if (!axis_delta || !has_meaningful_movement(state, axis_delta)) {
        return null;
      }
      if (cross_resource && !movement.cross_resource_available || !cross_resource && !movement.same_resource_available) {
        return null;
      }
      proposal = {
        schema_version: Number(review_transport.schema_version),
        booking_id: movement.booking_id,
        interaction_source: cross_resource ? 'cross_resource_drag' : 'drag',
        operation: cross_resource ? 'change_resource' : 'shift',
        target_resource_id: target_resource,
        selection_method: movement.selection_method,
        proposal_revision: movement.proposal_revision,
        source_context_token: movement.source_context_token
      };
      if ('full_day' === movement.time_application) {
        proposal.proposed_dates = movement.selected_dates.map(function (date) {
          return shift_date(date, axis_delta.calendar_day_delta);
        });
        return proposal.proposed_dates.every(Boolean) ? Object.freeze(proposal) : null;
      }
      proposal.proposed_intervals = movement.exact_intervals.map(function (interval) {
        return Object.freeze({
          start: format_instant(Date.parse(interval.start) + axis_delta.instant_delta_milliseconds, state.axis.timezone),
          end: format_instant(Date.parse(interval.end) + axis_delta.instant_delta_milliseconds, state.axis.timezone)
        });
      });
      return proposal.proposed_intervals.every(function (interval) {
        return interval.start && interval.end;
      }) ? Object.freeze(proposal) : null;
    }

    /**
     * Mark the restored canonical card and Timeline busy for one Review request.
     *
     * The returned object owns every DOM and interaction change. Its identity
     * prevents an older request from releasing a newer request's loading state.
     *
     * @param {HTMLElement} card Canonical booking card restored after the drop.
     * @return {Object} Request-owned loading state.
     */
    function begin_review_loading(card) {
      var renderer = template(templates.loading);
      var buffer = document.createElement('span');
      var state;
      end_review_loading(review_loading_state);
      state = {
        card: card,
        overlay: null,
        processing_notice: null,
        previous_aria_busy: card ? card.getAttribute('aria-busy') : null,
        released: false
      };
      if (card && renderer) {
        buffer.innerHTML = renderer({});
        state.overlay = buffer.firstElementChild;
        if (state.overlay) {
          card.appendChild(state.overlay);
        }
      }
      if (card) {
        card.classList.add('is-booking-movement-review-loading');
        card.setAttribute('aria-busy', 'true');
      }
      mount.classList.add('is-booking-movement-review-loading');
      review_loading_state = state;
      if (callbacks.set_interaction_suspended) {
        callbacks.set_interaction_suspended(true, card);
      }
      if (callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(true);
      }
      return state;
    }

    /**
     * Release the exact canonical-card loading state owned by one request.
     *
     * @param {Object|null} state Request-owned loading state.
     * @return {void}
     */
    function end_review_loading(state) {
      if (!state || state.released) {
        return;
      }
      state.released = true;
      hide_processing_notice(state.processing_notice);
      state.processing_notice = null;
      if (state.overlay) {
        state.overlay.remove();
        state.overlay = null;
      }
      if (state.card) {
        state.card.classList.remove('is-booking-movement-review-loading');
        if (null === state.previous_aria_busy) {
          state.card.removeAttribute('aria-busy');
        } else {
          state.card.setAttribute('aria-busy', state.previous_aria_busy);
        }
      }
      if (review_loading_state !== state) {
        return;
      }
      review_loading_state = null;
      mount.classList.remove('is-booking-movement-review-loading');
      if (callbacks.set_axis_window_loading_locked) {
        callbacks.set_axis_window_loading_locked(false);
      }
      if (callbacks.set_interaction_suspended) {
        callbacks.set_interaction_suspended(false, state.card);
      }
    }

    /**
     * Restore the scroll position captured before the movement Review lifecycle.
     *
     * @return {void}
     */
    function restore_lifecycle_scroll() {
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      if (!lifecycle_anchor) {
        return;
      }
      if (canvas) {
        canvas.scrollLeft = Number(lifecycle_anchor.canvas_scroll) || 0;
      }
      window.scrollTo(Number(lifecycle_anchor.doc_x) || 0, Number(lifecycle_anchor.doc_y) || 0);
    }

    /**
     * Find the preferred canonical replacement card for the moved booking.
     *
     * @param {number} booking_id Canonical booking ID.
     * @return {HTMLElement|null} Selected or first visible booking card.
     */
    function find_booking_card(booking_id) {
      var selected_card = null;
      var first_card = null;
      visible_records.some(function (record) {
        if (record.booking_id !== booking_id || !record.card.isConnected) {
          return false;
        }
        if (!first_card) {
          first_card = record.card;
        }
        if (record.card.classList.contains('is-booking-selected')) {
          selected_card = record.card;
          return true;
        }
        return false;
      });
      return selected_card || first_card;
    }

    /**
     * Restore focus to the canonical card and prefer its authorized movement grip.
     *
     * The selection control is a stable fallback and intentionally receives focus
     * first. Its focus event requests fresh movement eligibility; once the server
     * supplies the new grip, `render_grip()` transfers focus to that control.
     *
     * @param {number} booking_id Canonical booking ID.
     * @return {void}
     */
    function restore_lifecycle_focus(booking_id) {
      if (lifecycle_anchor && 'function' === typeof lifecycle_anchor.restore_focus && true === lifecycle_anchor.restore_focus(booking_id)) {
        pending_grip_focus_booking_id = 0;
        return;
      }
      var card = replacement_card && replacement_card.isConnected ? replacement_card : find_booking_card(booking_id);
      var grip = card ? card.querySelector('[data-wpbc-timeline-booking-movement-grip]') : null;
      var selection = card ? card.querySelector('[data-wpbc-timeline-booking-select]') : null;
      if (grip) {
        pending_grip_focus_booking_id = 0;
        grip.focus();
        return;
      }
      pending_grip_focus_booking_id = booking_id;
      if (selection) {
        selection.focus();
        return;
      }
      if (lifecycle_anchor && lifecycle_anchor.focus && lifecycle_anchor.focus.isConnected) {
        pending_grip_focus_booking_id = 0;
        lifecycle_anchor.focus.focus();
      }
    }

    /** Remove only the movement-owned Review surface. @return {void} */
    function remove_review_host() {
      if (review_host) {
        review_host.remove();
        review_host = null;
      }
    }

    /**
     * Release an idle or cancellable Review and restore its saved presentation.
     *
     * Apply and canonical recovery are deliberately not cancellable because the
     * browser cannot know whether persistence completed.
     *
     * @return {void}
     */
    function close_review() {
      var booking_id = lifecycle_anchor ? lifecycle_anchor.booking_id : 0;
      if (-1 !== ['apply_pending', 'refresh_pending', 'refresh_error'].indexOf(lifecycle_state)) {
        return;
      }
      lifecycle_generation += 1;
      if (review_request && review_request.abort) {
        review_request.abort();
      }
      review_request = null;
      review_memory = null;
      pending_apply_result = null;
      pending_completion = null;
      end_review_loading(review_loading_state);
      remove_review_host();
      mount.classList.remove('is-booking-movement-apply-pending');
      lifecycle_state = 'idle';
      restore_lifecycle_scroll();
      restore_lifecycle_focus(booking_id);
      lifecycle_anchor = null;
      replacement_card = null;
    }

    /**
     * Show the standard Booking Calendar Processing notice for Review loading.
     *
     * The legacy notice API does not return the element it creates. Capture the
     * newest Processing wrapper immediately so this request can later hide only
     * its own notice without affecting another administration request.
     *
     * @return {Object|null} Request-owned jQuery notice wrapper, or null.
     */
    function show_processing_notice() {
      if ('function' !== typeof window.wpbc_admin_show_message_processing) {
        return null;
      }
      window.wpbc_admin_show_message_processing('');
      return window.jQuery('#ajax_working .wpbc_processing.wpbc_spin').last().closest('[id^="wpbc_notice_"]');
    }

    /**
     * Hide the exact Processing notice owned by one settled Review request.
     *
     * @param {Object|null} processing_notice Request-owned jQuery wrapper.
     * @return {void}
     */
    function hide_processing_notice(processing_notice) {
      if (processing_notice && processing_notice.length) {
        processing_notice.stop(true, true).hide();
      }
    }

    /**
     * Show one standard top-right administration error for Review failure.
     *
     * The page controller escapes the authorized plain-text message before it
     * reaches the legacy HTML-capable notice API. Movement must not create or
     * position a feature-specific notice surface.
     *
     * @param {string} message Safe localized error message.
     * @return {void}
     */
    function show_review_error_notice(message) {
      if (message && callbacks && 'function' === typeof callbacks.show_admin_message) {
        callbacks.show_admin_message(String(message), 'error', 10000);
      }
    }

    /**
     * Read one safe canonical error from a normalized AJAX response.
     *
     * @param {Object} failed_request Failed jQuery request.
     * @param {string} fallback_message Translated operation fallback.
     * @return {Object} Safe code and message.
     */
    function get_request_error(failed_request, fallback_message) {
      var error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
      return {
        code: error_data && 'string' === typeof error_data.code ? error_data.code : '',
        message: error_data && 'string' === typeof error_data.message && error_data.message ? error_data.message : String(fallback_message || '')
      };
    }

    /**
     * Bind the exact controls permitted for the current Review state.
     *
     * @return {void}
     */
    function bind_review_controls() {
      var cancel_control = review_host ? review_host.querySelector('[data-wpbc-timeline-booking-movement-review-close]') : null;
      var apply_control = review_host ? review_host.querySelector('[data-wpbc-timeline-booking-movement-apply]') : null;
      var retry_control = review_host ? review_host.querySelector('[data-wpbc-timeline-booking-movement-retry-refresh]') : null;
      if (cancel_control) {
        cancel_control.addEventListener('click', close_review);
      }
      if (apply_control) {
        apply_control.addEventListener('click', request_apply);
      }
      if (retry_control) {
        retry_control.addEventListener('click', refresh_after_apply);
      }
    }

    /**
     * Render the module-owned shell around the canonical Review template.
     *
     * @param {Object} view_model Authorized presentation state.
     * @return {boolean} True when the shell rendered.
     */
    function render_review_surface(view_model) {
      var shell = template(templates.review);
      var initial_focus;
      if (!shell) {
        return false;
      }
      remove_review_host();
      review_host = document.createElement('div');
      review_host.className = 'wpbc_shared_ui_inspector wpbc_timeline_booking_movement__review_host';
      review_host.innerHTML = shell(view_model);
      document.body.appendChild(review_host);
      bind_review_controls();
      initial_focus = review_host.querySelector('[data-wpbc-timeline-booking-movement-apply], [data-wpbc-timeline-booking-movement-review-close], [data-wpbc-timeline-booking-movement-retry-refresh], [data-wpbc-timeline-booking-movement-review]');
      if (initial_focus) {
        initial_focus.focus();
      }
      return true;
    }

    /**
     * Render the current signed Review with state-specific actions.
     *
     * @param {string} status Visible localized lifecycle message.
     * @param {Object} actions Allowed footer actions and busy state.
     * @return {boolean} True when rendered.
     */
    function render_signed_review(status, actions) {
      var allowed_actions = actions || {};
      if (!review_memory || !review_memory.review_html) {
        return false;
      }
      return render_review_surface({
        title: i18n.review_title || '',
        status: status || '',
        review_html: review_memory.review_html,
        cancel_label: i18n.cancel || '',
        apply_label: i18n.apply || '',
        retry_refresh_label: i18n.retry_refresh || '',
        can_cancel: Boolean(allowed_actions.can_cancel),
        can_apply: Boolean(allowed_actions.can_apply),
        can_retry_refresh: Boolean(allowed_actions.can_retry_refresh),
        is_busy: Boolean(allowed_actions.is_busy)
      });
    }

    /**
     * Finish a non-mutating Review failure at the unchanged canonical card.
     *
     * @param {string} error_message Authorized plain-text error.
     * @return {void}
     */
    function finish_review_failure(error_message) {
      var booking_id = lifecycle_anchor ? lifecycle_anchor.booking_id : 0;
      review_memory = null;
      remove_review_host();
      lifecycle_state = 'idle';
      restore_lifecycle_scroll();
      restore_lifecycle_focus(booking_id);
      announce(error_message);
      show_review_error_notice(error_message);
      lifecycle_anchor = null;
      replacement_card = null;
    }

    /**
     * Render and retain one canonical signed Review for a single Apply attempt.
     *
     * @param {Object} response Canonical Review response.
     * @param {Object} proposal Frozen browser proposal.
     * @return {boolean} True when the response and templates are valid.
     */
    function render_review(response, proposal) {
      var canonical = template(review_transport.template_id);
      var review = response && response.review ? response.review : null;
      var review_resources = review && review.resources ? review.resources : {};
      var expected_resource_change = 'cross_resource_drag' === proposal.interaction_source;
      var token = String(response && response.token ? response.token : '');
      if (!canonical || !review || Number(review.booking_id || 0) !== proposal.booking_id || String(review.interaction_source || '') !== proposal.interaction_source || String(review.operation || '') !== proposal.operation || Number(review_resources.proposed_target && review_resources.proposed_target.id || 0) !== Number(proposal.target_resource_id) || Boolean(review_resources.resource_changed) !== expected_resource_change || !response.plan || !/^[a-f0-9]{64}$/i.test(token) || Number(response.expires_at || 0) <= Date.now() / 1000 || !apply_transport.url || !apply_transport.action || !apply_transport.nonce) {
        return false;
      }
      review_memory = Object.freeze({
        booking_id: proposal.booking_id,
        plan: response.plan,
        token: token,
        expires_at: Number(response.expires_at),
        review_html: canonical(review)
      });
      lifecycle_state = 'review_ready';
      return render_signed_review(i18n.review_ready || '', {
        can_cancel: true,
        can_apply: true
      });
    }

    /**
     * Request canonical non-mutating Review for one restored movement proposal.
     *
     * @param {Object} proposal Frozen browser proposal.
     * @param {Object} state Restored gesture state.
     * @return {void}
     */
    function open_canonical_review(proposal, state) {
      var pending;
      var loading_state;
      var error_message;
      var request_generation;
      lifecycle_anchor = {
        booking_id: proposal.booking_id,
        canvas_scroll: state.canvas_scroll,
        doc_x: state.doc_x,
        doc_y: state.doc_y,
        focus: state.focus,
        restore_focus: 'function' === typeof state.restore_focus ? state.restore_focus : null
      };
      replacement_card = state.card;
      lifecycle_generation += 1;
      request_generation = lifecycle_generation;
      lifecycle_state = 'review_pending';
      if (!review_transport.url) {
        finish_review_failure(String(i18n.review_failed || ''));
        return;
      }
      announce(i18n.review_loading || '');
      loading_state = begin_review_loading(state.card);
      loading_state.processing_notice = show_processing_notice();
      pending = window.jQuery.ajax({
        url: review_transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: review_transport.action,
          nonce: review_transport.nonce,
          booking_id: proposal.booking_id,
          source: review_transport.source || 'timeline',
          proposal: JSON.stringify(proposal)
        }
      }).done(function (response) {
        if (request_generation !== lifecycle_generation || review_request !== pending) {
          return;
        }
        if (!response || !response.success || !render_review(response.data, proposal)) {
          error_message = String(i18n.review_failed || '');
          finish_review_failure(error_message);
        }
      }).fail(function (failed_request, request_status) {
        if (request_generation !== lifecycle_generation || 'abort' === request_status || review_request !== pending) {
          return;
        }
        error_message = get_request_error(failed_request, i18n.review_failed || '').message;
        finish_review_failure(error_message);
      }).always(function () {
        end_review_loading(loading_state);
        if (review_request === pending) {
          review_request = null;
        }
      });
      review_request = pending;
    }

    /**
     * Accept a proposal produced by another registered Timeline presentation.
     *
     * This method accepts only the two movement-policy pairs already used by the
     * native Timeline: `drag + shift` and `cross_resource_drag + change_resource`.
     * It remains presentation-neutral. The canonical Review endpoint still reloads authority, validates
     * allocation identity, Appointment rules, availability, and conflicts before
     * it returns a signed Apply plan.
     *
     * @param {Object} proposal Executable-free movement proposal.
     * @param {Object} state    Restored card, scroll, and focus context.
     * @return {boolean} True when the canonical Review lifecycle started.
     */
    function review_movement_proposal(proposal, state) {
      var has_dates = Array.isArray(proposal && proposal.proposed_dates) && proposal.proposed_dates.length;
      var has_intervals = Array.isArray(proposal && proposal.proposed_intervals) && proposal.proposed_intervals.length;
      var interaction_source = String(proposal && proposal.interaction_source || '');
      var operation = String(proposal && proposal.operation || '');
      var is_same_resource = 'drag' === interaction_source && 'shift' === operation;
      var is_cross_resource = 'cross_resource_drag' === interaction_source && 'change_resource' === operation;
      if ('idle' !== lifecycle_state || gesture || review_request || !proposal || Number(proposal.schema_version) !== Number(review_transport.schema_version) || !Number(proposal.booking_id) || !is_same_resource && !is_cross_resource || !Number(proposal.target_resource_id) || !['policy', 'individual'].includes(String(proposal.selection_method || '')) || !Number(proposal.proposal_revision) || !String(proposal.source_context_token || '') || Boolean(has_dates) === Boolean(has_intervals) || !state || !state.card || !state.card.isConnected) {
        return false;
      }
      open_canonical_review(Object.freeze(proposal), state);
      return true;
    }

    /**
     * Verify the minimum canonical identity required before host readback.
     *
     * @param {Object} result Canonical Apply response.
     * @param {number} booking_id Expected booking ID.
     * @return {boolean} True when the response can identify one saved booking.
     */
    function is_apply_result_valid(result, booking_id) {
      var identity = result && result.canonical_identity ? result.canonical_identity : null;
      var host_refresh = result && result.host_refresh ? result.host_refresh : null;
      return Boolean(result && Number(result.booking_id || 0) === booking_id && identity && Number(identity.booking_id || 0) === booking_id && String(identity.modification_date || '') && host_refresh && true === host_refresh.required && Number(host_refresh.booking_id || 0) === booking_id);
    }

    /**
     * Decide whether a failed Apply may have reached persistence.
     *
     * Network failures, server failures, and failed compensation cannot safely
     * restore the pre-Apply card from browser memory. They require canonical
     * readback before the Timeline is presented as restored.
     *
     * @param {Object} failed_request Failed jQuery request.
     * @param {string} request_status jQuery request status.
     * @param {Object} error Normalized server error.
     * @return {boolean} True when persistence outcome is uncertain.
     */
    function is_uncertain_apply_failure(failed_request, request_status, error) {
      var status = Number(failed_request && failed_request.status ? failed_request.status : 0);
      return 'abort' !== request_status && (!status || 500 <= status || 'wpbc_booking_date_editor_compensation_failed' === error.code);
    }

    /**
     * Restore canonical scroll and focus after one completed readback lifecycle.
     *
     * @param {number} booking_id Canonical booking ID.
     * @return {void}
     */
    function restore_after_readback(booking_id) {
      var expected_anchor = lifecycle_anchor;
      restore_lifecycle_scroll();
      restore_lifecycle_focus(booking_id);
      window.requestAnimationFrame(function () {
        if (expected_anchor !== lifecycle_anchor) {
          return;
        }
        restore_lifecycle_scroll();
        window.requestAnimationFrame(function () {
          if (expected_anchor !== lifecycle_anchor) {
            return;
          }
          restore_lifecycle_scroll();
          restore_lifecycle_focus(booking_id);
          lifecycle_anchor = null;
          replacement_card = null;
        });
      });
    }

    /**
     * Finish success or failure only after canonical readback has settled.
     *
     * @return {void}
     */
    function finish_after_readback() {
      var completion = pending_completion || {};
      var booking_id = pending_apply_result ? Number(pending_apply_result.booking_id || 0) : 0;
      remove_review_host();
      review_memory = null;
      pending_apply_result = null;
      pending_completion = null;
      mount.classList.remove('is-booking-movement-apply-pending');
      lifecycle_state = 'idle';
      restore_after_readback(booking_id);
      announce(completion.message || '');
      if (completion.message && callbacks && 'function' === typeof callbacks.show_admin_message) {
        callbacks.show_admin_message(completion.message, completion.type || 'success', Number(completion.delay) || 3000);
      }
    }

    /**
     * Render an explicit readback-only recovery action.
     *
     * @return {void}
     */
    function render_refresh_error() {
      lifecycle_state = 'refresh_error';
      render_signed_review(i18n.refresh_failed || '', {
        can_retry_refresh: true
      });
      announce(i18n.refresh_failed || '');
      show_review_error_notice(i18n.refresh_failed || '');
    }

    /**
     * Refresh every canonical host projection after Apply or uncertain persistence.
     *
     * Retrying this method can repeat only read operations. The signed Apply plan
     * has already been discarded and is never submitted automatically again.
     *
     * @return {void}
     */
    function refresh_after_apply() {
      var refresh_result;
      var request_generation;
      if (!pending_apply_result || 'refresh_pending' === lifecycle_state) {
        return;
      }
      lifecycle_state = 'refresh_pending';
      mount.classList.add('is-booking-movement-apply-pending');
      render_signed_review(i18n.refreshing || '', {
        is_busy: true
      });
      request_generation = lifecycle_generation;
      if (!callbacks || 'function' !== typeof callbacks.refresh_after_apply) {
        render_refresh_error();
        return;
      }
      try {
        refresh_result = callbacks.refresh_after_apply(pending_apply_result);
      } catch (refresh_error) {
        refresh_result = window.jQuery.Deferred().reject(refresh_error).promise();
      }
      window.jQuery.when(refresh_result).done(function () {
        if (is_destroyed || request_generation !== lifecycle_generation || !pending_apply_result) {
          return;
        }
        finish_after_readback();
      }).fail(function () {
        if (is_destroyed || request_generation !== lifecycle_generation || !pending_apply_result) {
          return;
        }
        render_refresh_error();
      });
    }

    /**
     * Finish a known non-persistent Apply rejection at the original card.
     *
     * @param {string} error_message Authorized plain-text error.
     * @return {void}
     */
    function finish_apply_rejection(error_message) {
      var booking_id = lifecycle_anchor ? lifecycle_anchor.booking_id : 0;
      review_memory = null;
      remove_review_host();
      mount.classList.remove('is-booking-movement-apply-pending');
      lifecycle_state = 'idle';
      restore_lifecycle_scroll();
      restore_lifecycle_focus(booking_id);
      announce(error_message);
      show_review_error_notice(error_message);
      lifecycle_anchor = null;
      replacement_card = null;
    }

    /**
     * Force canonical readback when Apply persistence cannot be inferred safely.
     *
     * @param {number} booking_id Canonical booking ID.
     * @param {string} error_message Error to display after successful readback.
     * @return {void}
     */
    function recover_uncertain_apply(booking_id, error_message) {
      review_memory = review_memory ? Object.freeze({
        booking_id: review_memory.booking_id,
        plan: null,
        token: '',
        expires_at: 0,
        review_html: review_memory.review_html
      }) : null;
      pending_apply_result = {
        booking_id: booking_id,
        changed: false,
        recovery_readback: true
      };
      pending_completion = {
        message: error_message,
        type: 'error',
        delay: 10000
      };
      refresh_after_apply();
    }

    /**
     * Submit the signed Review exactly once and never retry its mutation.
     *
     * @return {void}
     */
    function request_apply() {
      var apply_memory;
      var booking_id;
      var request_generation;
      var pending;
      if ('review_ready' !== lifecycle_state || apply_request || pending_apply_result || !review_memory || !review_memory.plan || !/^[a-f0-9]{64}$/i.test(String(review_memory.token || '')) || !apply_transport.url || !apply_transport.action || !apply_transport.nonce) {
        return;
      }
      apply_memory = review_memory;
      booking_id = review_memory.booking_id;
      request_generation = lifecycle_generation;
      lifecycle_state = 'apply_pending';
      mount.classList.add('is-booking-movement-apply-pending');
      render_signed_review(i18n.applying || '', {
        is_busy: true
      });
      apply_processing_notice = show_processing_notice();
      pending = window.jQuery.ajax({
        url: apply_transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: apply_transport.action,
          nonce: apply_transport.nonce,
          booking_id: booking_id,
          source: apply_transport.source || 'timeline',
          send_modified_email: get_send_modified_email_intent(),
          plan: JSON.stringify(apply_memory.plan),
          token: apply_memory.token
        }
      }).done(function (response) {
        var result = response && response.success ? response.data : null;
        if (is_destroyed || request_generation !== lifecycle_generation || apply_request !== pending) {
          return;
        }
        review_memory = Object.freeze({
          booking_id: apply_memory.booking_id,
          plan: null,
          token: '',
          expires_at: 0,
          review_html: apply_memory.review_html
        });
        if (!is_apply_result_valid(result, booking_id)) {
          recover_uncertain_apply(booking_id, i18n.apply_failed || '');
          return;
        }
        pending_apply_result = result;
        pending_completion = {
          message: i18n.applied || '',
          type: 'success',
          delay: 3000
        };
        refresh_after_apply();
      }).fail(function (failed_request, request_status) {
        var error;
        if (is_destroyed || request_generation !== lifecycle_generation || 'abort' === request_status || apply_request !== pending) {
          return;
        }
        error = get_request_error(failed_request, i18n.apply_failed || '');
        if (is_uncertain_apply_failure(failed_request, request_status, error)) {
          recover_uncertain_apply(booking_id, error.message);
          return;
        }
        finish_apply_rejection(error.message);
      }).always(function () {
        hide_processing_notice(apply_processing_notice);
        apply_processing_notice = null;
        if (apply_request === pending) {
          apply_request = null;
        }
      });
      apply_request = pending;
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
     * Restore the canonical card before constructing and reviewing the proposal.
     *
     * @param {Object} event Sortable completion event.
     * @return {void}
     */
    function on_end(event) {
      var state = gesture;
      var drop_candidate;
      var proposal;
      var destination_restriction;
      if (!state) {
        return;
      }
      destination_restriction = get_candidate_restriction(state, state.candidate);
      freeze_drop_intent(state);
      drop_candidate = resolve_drop_candidate(state);
      state.candidate = drop_candidate;
      if (!drop_candidate) {
        state.drop_intent = null;
      }
      restore_card(state);
      release(state);
      gesture = null;
      proposal = proposal_from(state);
      if (state.canvas) {
        state.canvas.scrollLeft = state.canvas_scroll;
      }
      window.scrollTo(state.doc_x, state.doc_y);
      if (proposal) {
        open_canonical_review(proposal, state);
      } else {
        if (destination_restriction) {
          show_destination_warning(destination_restriction);
        }
        if (state.focus && state.focus.isConnected) {
          state.focus.focus();
        }
      }
    }

    /**
     * Cancel and restore DOM, scroll, focus, selection, and locks.
     *
     * @param {boolean} restore_scroll Whether to restore scroll anchors.
     * @return {void}
     */
    function cancel(restore_scroll) {
      var state = gesture;
      if (!state) {
        return;
      }
      restore_card(state);
      release(state);
      gesture = null;
      if (restore_scroll) {
        if (state.canvas) {
          state.canvas.scrollLeft = state.canvas_scroll;
        }
        window.scrollTo(state.doc_x, state.doc_y);
      }
      if (state.focus && state.focus.isConnected) {
        state.focus.focus();
      }
      announce(i18n.cancelled || '');
    }

    /**
     * Preserve the already-rendered visual intent at pointer completion.
     *
     * Sortable may invoke `onEnd` from its own earlier-registered document listener
     * before this listener runs. Correctness therefore comes from the visual intent
     * captured during pointer movement, not from this listener's execution order.
     * The deferred cancellation remains a fail-safe when Sortable never dispatches
     * `onEnd` after the pointer is released.
     *
     * @param {PointerEvent} event Pointer completion event.
     * @return {void}
     */
    function on_pointer_completion(event) {
      var destination_restriction = '';
      if (gesture) {
        destination_restriction = get_candidate_restriction(gesture, gesture.candidate);
        freeze_drop_intent(gesture);
      }
      window.setTimeout(function () {
        if (gesture) {
          cancel(true);
          if (destination_restriction) {
            show_destination_warning(destination_restriction);
          }
        }
      }, 0);
    }
    /** Cancel after lost pointer completion. @return {void} */
    function on_lost_pointer() {
      cancel(true);
    }
    /**
     * Keep keyboard focus within the movement Review dialog.
     *
     * @param {KeyboardEvent} event Keyboard event.
     * @return {void}
     */
    function trap_review_focus(event) {
      var controls;
      var first;
      var last;
      if ('Tab' !== event.key || !review_host) {
        return;
      }
      controls = Array.prototype.filter.call(review_host.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'), function (control) {
        return !control.hidden && null !== control.offsetParent;
      });
      if (!controls.length) {
        return;
      }
      first = controls[0];
      last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!review_host.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    /**
     * Cancel movement or close Review with Escape.
     *
     * @param {KeyboardEvent} event Keyboard event.
     * @return {void}
     */
    function on_keydown(event) {
      if ('Escape' === event.key) {
        if (gesture) {
          event.preventDefault();
          cancel(true);
        } else if (review_request || review_loading_state || review_host) {
          event.preventDefault();
          close_review();
        }
        return;
      }
      trap_review_focus(event);
    }
    /**
     * Cancel only an unfinished pointer gesture when browser focus leaves.
     *
     * A completed drop already owns a canonical Review request. Browser chrome,
     * developer tools, password managers, and operating-system dialogs can blur
     * the content window without navigation, so blur must not abort that request.
     *
     * @return {void}
     */
    function on_blur() {
      if (gesture) {
        cancel(true);
      }
    }
    /**
     * Cancel only an unfinished pointer gesture when the document is hidden.
     *
     * A pending read-only Review may safely settle while its tab is temporarily
     * hidden. Its request-owned loading state remains visible when focus returns.
     *
     * @return {void}
     */
    function on_visibility() {
      if (document.hidden && gesture) {
        cancel(true);
      }
    }

    /**
     * Cancel all movement work when the page is actually being discarded.
     *
     * Unlike a temporary blur, pagehide is a navigation/teardown boundary and no
     * Review UI can be delivered into the departing document.
     *
     * @return {void}
     */
    function on_page_hide() {
      cancel(true);
      force_lifecycle_teardown();
    }

    /** Destroy movement-owned Sortable instances. @return {void} */
    function destroy_sortables() {
      sortables.forEach(function (sortable) {
        if (sortable && sortable.destroy) {
          sortable.destroy();
        }
      });
      sortables = [];
    }

    /** Create Sortable targets for visible Resource rows. @return {void} */
    function synchronize_sortables() {
      destroy_sortables();
      mount.querySelectorAll('[data-wpbc-timeline-segments]').forEach(function (row) {
        sortables.push(new window.Sortable(row, {
          group: {
            name: group_name,
            pull: true,
            put: true
          },
          sort: false,
          direction: 'horizontal',
          handle: '[data-wpbc-timeline-booking-movement-grip]',
          draggable: '[data-wpbc-timeline-booking-movable="true"]',
          filter: filter_selector,
          preventOnFilter: false,
          forceFallback: true,
          fallbackOnBody: true,
          fallbackTolerance: Number(sortable_config.fallback_tolerance) || 8,
          animation: 0,
          emptyInsertThreshold: Number(sortable_config.empty_insert_threshold) || 18,
          scroll: false,
          fallbackClass: 'wpbc_timeline_booking_movement__sortable-fallback',
          ghostClass: 'wpbc_timeline_booking_movement__sortable-ghost',
          chosenClass: 'wpbc_timeline_booking_movement__sortable-chosen',
          onChoose: on_choose,
          onClone: on_clone,
          onStart: on_start,
          onMove: on_move,
          onEnd: on_end
        }));
      });
    }

    /**
     * Register one canonical segment DTO after rendering.
     *
     * @param {HTMLElement} card Rendered booking card.
     * @param {Object} segment Authorized segment DTO.
     * @return {void}
     */
    function register_segment(card, segment) {
      var booking_id = Number(segment.booking_id);
      var record;
      if (card && booking_id && segment.segment_id && segment.visible_start && segment.visible_end) {
        record = {
          card: card,
          rail: card.querySelector('[data-wpbc-timeline-booking-control-rail]'),
          booking_id: booking_id,
          resource_id: Number(segment.resource_id),
          segment_id: String(segment.segment_id),
          visible_start: String(segment.visible_start),
          visible_end: String(segment.visible_end),
          state: 'idle',
          generation: 0,
          context: null
        };
        records.set(card, record);
        visible_records.push(record);
        hide_unresolved_indicator(record);
      }
    }

    /**
     * Prepare for canonical Timeline replacement.
     *
     * A readback requested after Apply must retain only its immutable result and
     * recovery state while every rendered booking card is discarded.
     *
     * @return {void}
     */
    function begin_refresh() {
      var preserves_apply_readback = -1 !== ['apply_pending', 'refresh_pending', 'refresh_error'].indexOf(lifecycle_state);
      cancel(true);
      if (!preserves_apply_readback) {
        close_review();
      }
      destroy_sortables();
      generation += 1;
      records = new WeakMap();
      visible_records = [];
      requests = new WeakMap();
      replacement_card = null;
    }

    /**
     * Rebuild targets and identify the canonical moved card after readback.
     *
     * @param {Object} selection_state Canonical Timeline booking selection.
     * @return {void}
     */
    function complete_refresh(selection_state) {
      synchronize_sortables();
      if (pending_apply_result) {
        replacement_card = find_booking_card(Number(pending_apply_result.booking_id || 0));
        if (selection_state && Number(selection_state.booking_id || 0) !== Number(pending_apply_result.booking_id || 0)) {
          replacement_card = find_booking_card(Number(pending_apply_result.booking_id || 0));
        }
      }
    }
    /**
     * Cancel when foreground loading begins.
     *
     * @param {boolean} is_loading Whether loading is active.
     * @return {void}
     */
    function set_request_loading(is_loading) {
      if (is_loading && -1 === ['apply_pending', 'refresh_pending', 'refresh_error'].indexOf(lifecycle_state)) {
        cancel(true);
        close_review();
      }
    }
    /** Report movement ownership. @return {boolean} Ownership state. */
    function is_interacting() {
      return Boolean(gesture || review_request || review_loading_state || review_host || 'idle' !== lifecycle_state);
    }

    /** Initialize listeners and live region. @return {void} */
    function initialize() {
      var renderer;
      var buffer;
      if (initialized || !mount) {
        return;
      }
      initialized = true;
      is_destroyed = false;
      renderer = template(templates.live_region);
      if (renderer) {
        buffer = document.createElement('span');
        buffer.innerHTML = renderer({});
        live_region = buffer.firstElementChild;
        if (live_region) {
          mount.appendChild(live_region);
        }
      }
      mount.addEventListener('pointerover', on_context_intent);
      mount.addEventListener('focusin', on_context_intent);
      mount.addEventListener('pointerdown', on_pointer_down, true);
      document.addEventListener('keydown', on_keydown);
      document.addEventListener('visibilitychange', on_visibility);
      window.addEventListener('blur', on_blur);
      window.addEventListener('pagehide', on_page_hide);
      synchronize_sortables();
    }

    /**
     * Abort browser work and remove all transient lifecycle presentation.
     *
     * This is reserved for navigation and module teardown. It does not present a
     * restored card because the owning document is being replaced.
     *
     * @return {void}
     */
    function force_lifecycle_teardown() {
      lifecycle_generation += 1;
      if (review_request && review_request.abort) {
        review_request.abort();
      }
      if (apply_request && apply_request.abort) {
        apply_request.abort();
      }
      review_request = null;
      apply_request = null;
      hide_processing_notice(apply_processing_notice);
      apply_processing_notice = null;
      end_review_loading(review_loading_state);
      remove_review_host();
      review_memory = null;
      pending_apply_result = null;
      pending_completion = null;
      lifecycle_anchor = null;
      replacement_card = null;
      pending_grip_focus_booking_id = 0;
      lifecycle_state = 'idle';
      mount.classList.remove('is-booking-movement-apply-pending');
    }

    /** Destroy movement-owned state and listeners. @return {void} */
    function destroy() {
      if (!initialized) {
        return;
      }
      is_destroyed = true;
      cancel(true);
      force_lifecycle_teardown();
      destroy_sortables();
      generation += 1;
      records = new WeakMap();
      visible_records = [];
      requests = new WeakMap();
      mount.removeEventListener('pointerover', on_context_intent);
      mount.removeEventListener('focusin', on_context_intent);
      mount.removeEventListener('pointerdown', on_pointer_down, true);
      document.removeEventListener('keydown', on_keydown);
      document.removeEventListener('visibilitychange', on_visibility);
      window.removeEventListener('blur', on_blur);
      window.removeEventListener('pagehide', on_page_hide);
      if (live_region) {
        live_region.remove();
        live_region = null;
      }
      initialized = false;
    }
    return {
      initialize: initialize,
      destroy: destroy,
      begin_refresh: begin_refresh,
      register_segment: register_segment,
      complete_refresh: complete_refresh,
      set_request_loading: set_request_loading,
      is_interacting: is_interacting,
      review_movement_proposal: review_movement_proposal
    };
  }
  interactions.register_extension_factory(create_controller);
  modules.register_factory('booking_movement', function () {
    return {
      initialize: function () {},
      destroy: function () {},
      is_available: function () {
        return true;
      }
    };
  });
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9ib29raW5nLW1vdmVtZW50L19vdXQvYm9va2luZy1tb3ZlbWVudC5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwibW9kdWxlcyIsIndwYmNfdGltZWxpbmVfbW9kdWxlcyIsImludGVyYWN0aW9ucyIsIndwYmNfdGltZWxpbmVfYm9va2luZ19pbnRlcmFjdGlvbnMiLCJjb25maWciLCJ3cGJjX3RpbWVsaW5lX2Jvb2tpbmdfbW92ZW1lbnRfY29uZmlnIiwicmVnaXN0ZXJfZmFjdG9yeSIsInJlZ2lzdGVyX2V4dGVuc2lvbl9mYWN0b3J5IiwiU29ydGFibGUiLCJqUXVlcnkiLCJ3cCIsInRlbXBsYXRlIiwiY3JlYXRlX2NvbnRyb2xsZXIiLCJob3N0X2NvbnRleHQiLCJtb3VudCIsImNhbGxiYWNrcyIsInRyYW5zcG9ydCIsInJldmlld190cmFuc3BvcnQiLCJhcHBseV90cmFuc3BvcnQiLCJzb3J0YWJsZV9jb25maWciLCJzb3J0YWJsZSIsInRlbXBsYXRlcyIsImkxOG4iLCJyZWNvcmRzIiwiV2Vha01hcCIsInZpc2libGVfcmVjb3JkcyIsInJlcXVlc3RzIiwic29ydGFibGVzIiwiZ2VuZXJhdGlvbiIsInBlbmRpbmdfcG9pbnRlciIsImdlc3R1cmUiLCJyZXZpZXdfcmVxdWVzdCIsInJldmlld19sb2FkaW5nX3N0YXRlIiwicmV2aWV3X2hvc3QiLCJyZXZpZXdfbWVtb3J5IiwiYXBwbHlfcmVxdWVzdCIsImFwcGx5X3Byb2Nlc3Npbmdfbm90aWNlIiwicGVuZGluZ19hcHBseV9yZXN1bHQiLCJwZW5kaW5nX2NvbXBsZXRpb24iLCJsaWZlY3ljbGVfc3RhdGUiLCJsaWZlY3ljbGVfZ2VuZXJhdGlvbiIsImxpZmVjeWNsZV9hbmNob3IiLCJwZW5kaW5nX2dyaXBfZm9jdXNfYm9va2luZ19pZCIsInJlcGxhY2VtZW50X2NhcmQiLCJsaXZlX3JlZ2lvbiIsInNjcm9sbF9mcmFtZSIsImluaXRpYWxpemVkIiwiaXNfZGVzdHJveWVkIiwiZ3JvdXBfbmFtZSIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInNsaWNlIiwiZmlsdGVyX3NlbGVjdG9yIiwiam9pbiIsInRlbXBsYXRlX2lkIiwiZXJyb3IiLCJhbm5vdW5jZSIsIm1lc3NhZ2UiLCJ0ZXh0Q29udGVudCIsIlN0cmluZyIsIm5vcm1hbGl6ZV9jb250ZXh0IiwicmVzcG9uc2UiLCJyZWNvcmQiLCJkdG8iLCJzdWNjZXNzIiwiZGF0YSIsIm1vdmVtZW50X2NvbnRleHQiLCJzZWVkIiwic2NoZWR1bGVfc2VlZCIsImF2YWlsYWJpbGl0eSIsImdlc3R1cmVfYXZhaWxhYmlsaXR5IiwicmVzdHJpY3Rpb25zIiwiZ2VzdHVyZV9yZXN0cmljdGlvbnMiLCJkYXRlcyIsIkFycmF5IiwiaXNBcnJheSIsInNlbGVjdGVkX2RhdGVzIiwibWFwIiwiaW50ZXJ2YWxzIiwiZXhhY3RfaW50ZXJ2YWxzIiwiaW50ZXJ2YWwiLCJPYmplY3QiLCJmcmVlemUiLCJzdGFydCIsImVuZCIsIk51bWJlciIsImJvb2tpbmdfaWQiLCJwcmltYXJ5X3Jlc291cmNlX2lkIiwicHJvcG9zYWxfcmV2aXNpb24iLCJzb3VyY2VfY29udGV4dF90b2tlbiIsInNhbWVfcmVzb3VyY2UiLCJjcm9zc19yZXNvdXJjZSIsImxlbmd0aCIsImluY2x1ZGVzIiwic2VsZWN0aW9uX21ldGhvZCIsInRpbWVfYXBwbGljYXRpb24iLCJzb21lIiwiRGF0ZSIsInBhcnNlIiwicm91bmQiLCJzYW1lX3Jlc291cmNlX2F2YWlsYWJsZSIsIkJvb2xlYW4iLCJjcm9zc19yZXNvdXJjZV9hdmFpbGFibGUiLCJzYW1lX3Jlc291cmNlX3Jlc3RyaWN0aW9uIiwiZmFsbGJhY2tfcmVhc29uIiwiY3Jvc3NfcmVzb3VyY2VfcmVzdHJpY3Rpb24iLCJoaWRlX3VucmVzb2x2ZWRfaW5kaWNhdG9yIiwiaW5kaWNhdG9yIiwicmFpbCIsInF1ZXJ5U2VsZWN0b3IiLCJoaWRkZW4iLCJoYXNBdHRyaWJ1dGUiLCJzY2hlZHVsZV9sYXlvdXQiLCJyZW5kZXJfZ3JpcCIsInJlbmRlcmVyIiwiZ3JpcCIsImRvY2siLCJjYXJkIiwiYnVmZmVyIiwiY3JlYXRlRWxlbWVudCIsImlubmVySFRNTCIsImxhYmVsIiwiZ3JpcF9sYWJlbCIsImZpcnN0RWxlbWVudENoaWxkIiwicmVwbGFjZVdpdGgiLCJmb3JFYWNoIiwiZWxlbWVudCIsInJlbW92ZUF0dHJpYnV0ZSIsInNldEF0dHJpYnV0ZSIsImlzQ29ubmVjdGVkIiwiZm9jdXMiLCJyZXF1ZXN0X2NvbnRleHQiLCJyZXF1ZXN0X2dlbmVyYXRpb24iLCJwZW5kaW5nIiwic3RhdGUiLCJ1cmwiLCJhamF4IiwibWV0aG9kIiwiZGF0YVR5cGUiLCJhY3Rpb24iLCJub25jZSIsInNvdXJjZSIsInNlZ21lbnRfaWQiLCJzZWdtZW50X3Jlc291cmNlX2lkIiwicmVzb3VyY2VfaWQiLCJ2aXNpYmxlX3N0YXJ0X2F0IiwidmlzaWJsZV9zdGFydCIsInZpc2libGVfZW5kX2F0IiwidmlzaWJsZV9lbmQiLCJkb25lIiwiZ2V0IiwiY29udGV4dCIsImZhaWwiLCJmYWlsZWRfcmVxdWVzdCIsInN0YXR1cyIsImFsd2F5cyIsImRlbGV0ZSIsInNldCIsIm9uX2NvbnRleHRfaW50ZW50IiwiZXZlbnQiLCJyZXNvbHZlX2FjY2Vzc29yeV9jYXJkIiwidGFyZ2V0IiwidHlwZSIsImNsYXNzTGlzdCIsImNvbnRhaW5zIiwib25fcG9pbnRlcl9kb3duIiwiY2xvc2VzdCIsImNhbl9zdGFydF9pbnRlcmFjdGlvbiIsIngiLCJjbGllbnRYIiwieSIsImNsaWVudFkiLCJhY2Nlc3NvcnkiLCJnZXRBdHRyaWJ1dGUiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY2FuZGlkYXRlIiwiY2FwdHVyZV9heGlzIiwiYXhpcyIsImdldF9heGlzIiwiaGVhZGVycyIsImNlbGxzIiwiY2VsbCIsImluZGV4IiwicmVjdGFuZ2xlIiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0Iiwic3RhcnRfZXBvY2giLCJlbmRfZXBvY2giLCJkYXRlIiwibGVmdCIsInJpZ2h0IiwiZmlsdGVyIiwidGltZXpvbmUiLCJpc19ydGwiLCJnZXRDb21wdXRlZFN0eWxlIiwiZGlyZWN0aW9uIiwiY2FwdHVyZV9yb3dzIiwicm93cyIsInByb3RvdHlwZSIsImNhbGwiLCJob3N0Iiwib3JkZXIiLCJ0cmFjayIsInRvcCIsImJvdHRvbSIsInJvdyIsIm9uX2Nob29zZSIsIml0ZW0iLCJjYW52YXMiLCJ0aXRsZSIsImR1cmF0aW9uIiwic291cmNlX2hvc3QiLCJwYXJlbnROb2RlIiwicGFyZW50IiwibmV4dCIsIm5leHRTaWJsaW5nIiwic3R5bGUiLCJjbGFzc19uYW1lIiwiY2FudmFzX3Njcm9sbCIsInNjcm9sbExlZnQiLCJjYW52YXNfcmVjdGFuZ2xlIiwiZG9jX3giLCJwYWdlWE9mZnNldCIsImRvY195IiwicGFnZVlPZmZzZXQiLCJzZWxlY3RlZCIsImFjdGl2ZUVsZW1lbnQiLCJzdGFydF94Iiwic3RhcnRfeSIsInBlbmRpbmdfY2FuZGlkYXRlIiwiY2FuZGlkYXRlX3NpbmNlIiwib3JpZ2luIiwic3RhcnRlZCIsInNvdXJjZV9yb3ciLCJ2aXN1YWxfZHJvcF9pbnRlbnQiLCJkcm9wX2ludGVudCIsInNvcnRhYmxlX2Rlc3RpbmF0aW9uIiwiY2FuZGlkYXRlX2dob3N0IiwiY2FuZGlkYXRlX2dob3N0X2hvc3QiLCJnaG9zdF9kYXRhIiwidHJpbSIsImR1cmF0aW9uX2xhYmVsIiwiZ2V0X3Jvd19mb3JfaG9zdCIsInNhbml0aXplX2Nsb25lIiwiY2xvbmUiLCJwb2ludGVyRXZlbnRzIiwibm9kZSIsImRpc2FibGVkIiwiYXR0cmlidXRlIiwib25fY2xvbmUiLCJhZGQiLCJvbl9zdGFydCIsImNsb25lTm9kZSIsImluc2VydEJlZm9yZSIsInNldF9pbnRlcmFjdGlvbl9zdXNwZW5kZWQiLCJzZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQiLCJhZGRFdmVudExpc3RlbmVyIiwib25fcG9pbnRlcl9tb3ZlIiwib25fcG9pbnRlcl9jb21wbGV0aW9uIiwib25fbG9zdF9wb2ludGVyIiwic3RhcnRfYXV0b3Njcm9sbCIsIm1hdGNoZWQiLCJnZXRfcm93X3JlY3RhbmdsZSIsImdlb21ldHJ5IiwiZG9jdW1lbnRfZGVsdGFfeCIsImRvY3VtZW50X2RlbHRhX3kiLCJjYW52YXNfZGVsdGFfeCIsImdldF9jYW52YXNfd2luZG93IiwibWF4IiwibWluIiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50V2lkdGgiLCJjbGllbnRIZWlnaHQiLCJyZXNvbHZlX3JvdyIsInRocmVzaG9sZCIsImVtcHR5X2luc2VydF90aHJlc2hvbGQiLCJjYW52YXNfd2luZG93IiwibWF0Y2hlcyIsInJvd19kaXN0YW5jZSIsInB1c2giLCJkaXN0YW5jZSIsInNvcnQiLCJmaXJzdCIsInNlY29uZCIsImFicyIsInJlc29sdmVfZHJvcF9jYW5kaWRhdGUiLCJmcm96ZW5fdGFyZ2V0IiwidGFyZ2V0X3Jlc291cmNlX2lkIiwidmlzdWFsX3RhcmdldCIsImZyZWV6ZV9kcm9wX2ludGVudCIsInRhcmdldF9yb3ciLCJ0YXJnZXRfaG9zdCIsImNsZWFyX2NhbmRpZGF0ZV9naG9zdCIsInJlbW92ZSIsImdldF9jYW5kaWRhdGVfcmVzdHJpY3Rpb24iLCJtb3ZlbWVudCIsInNvdXJjZV9yZXNvdXJjZV9pZCIsImlzX2Nyb3NzX3Jlc291cmNlIiwic2hvd19kZXN0aW5hdGlvbl93YXJuaW5nIiwicmVhc29uIiwiZGVuaWFsX3JlYXNvbnMiLCJkZXN0aW5hdGlvbl91bmF2YWlsYWJsZSIsInVuYXZhaWxhYmxlIiwic2hvd19hZG1pbl9tZXNzYWdlIiwidXBkYXRlX2NhbmRpZGF0ZV9naG9zdCIsImF4aXNfZGVsdGEiLCJjYW5kaWRhdGVfdG9wIiwicGh5c2ljYWxfZGVsdGEiLCJnZXRfcG9pbnRlcl9heGlzX2RlbHRhIiwiaGFzX21lYW5pbmdmdWxfbW92ZW1lbnQiLCJnaG9zdCIsImdldFByb3BlcnR5VmFsdWUiLCJzZXRQcm9wZXJ0eSIsImFwcGVuZENoaWxkIiwiY2FsZW5kYXJfcGh5c2ljYWxfZGVsdGFfcGl4ZWxzIiwicGh5c2ljYWxfZGVsdGFfcGl4ZWxzIiwidHJhbnNmb3JtIiwic3RhYmlsaXplX2NhbmRpZGF0ZSIsIm5vdyIsInBlcmZvcm1hbmNlIiwibW92ZWQiLCJoeXBvdCIsInJlc3RyaWN0aW9uIiwiZGVsaWJlcmF0ZV9tb3ZlbWVudF9waXhlbHMiLCJjYW5kaWRhdGVfZHdlbGxfbWlsbGlzZWNvbmRzIiwiY2FuZGlkYXRlX3RhcmdldCIsInJlcGxhY2UiLCJyZXNvbHV0aW9uIiwib25fbW92ZSIsIm9yaWdpbmFsX2V2ZW50IiwicG9pbnRlciIsIm9yaWdpbmFsRXZlbnQiLCJpc0Zpbml0ZSIsInRvIiwiYXV0b3Njcm9sbCIsImVkZ2UiLCJhdXRvc2Nyb2xsX2VkZ2VfcGl4ZWxzIiwibWF4aW11bSIsImF1dG9zY3JvbGxfbWF4X3BpeGVscyIsImRlbHRhIiwic2Nyb2xsQnkiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJzdG9wX2F1dG9zY3JvbGwiLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsInJlc3RvcmVfY2FyZCIsInJlbGVhc2UiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiY2VsbF9pbmRleCIsImZvdW5kIiwiY2FsZW5kYXJfZGF5X2RlbHRhIiwic291cmNlX2RhdGUiLCJ0YXJnZXRfZGF0ZSIsInNvdXJjZV9tYXRjaCIsIm1hdGNoIiwidGFyZ2V0X21hdGNoIiwic291cmNlX2Vwb2NoIiwidGFyZ2V0X2Vwb2NoIiwiVVRDIiwiZmlyc3RfZGF0ZV9jZWxsX2luZGV4Iiwic291cmNlX2luZGV4IiwidGFyZ2V0X2luZGV4IiwidGFyZ2V0X3giLCJkYXlfZGVsdGEiLCJzb3VyY2VfZGF5X2luZGV4IiwidGFyZ2V0X2RheV9pbmRleCIsImNlbGxfZGVsdGEiLCJpbnN0YW50X2RlbHRhX21pbGxpc2Vjb25kcyIsIm1vdmVtZW50X3Jlc291cmNlcyIsImdldF9tb3ZlbWVudF9yZXNvdXJjZXMiLCJzb3VyY2VfcmVzb3VyY2UiLCJ0YXJnZXRfcmVzb3VyY2UiLCJzaGlmdF9kYXRlIiwidmFsdWUiLCJkYXlzIiwidG9JU09TdHJpbmciLCJ6b25lZF9wYXJ0cyIsImVwb2NoIiwidmFsdWVzIiwiZm9ybWF0dGVyIiwiSW50bCIsIkRhdGVUaW1lRm9ybWF0IiwidGltZVpvbmUiLCJ5ZWFyIiwibW9udGgiLCJkYXkiLCJob3VyIiwiaG91ckN5Y2xlIiwibWludXRlIiwiZm9ybWF0VG9QYXJ0cyIsInBhcnQiLCJmb3JtYXRfaW5zdGFudCIsInBhcnRzIiwicmVwcmVzZW50ZWQiLCJvZmZzZXQiLCJzaWduIiwicGFkIiwicGFkU3RhcnQiLCJmbG9vciIsInByb3Bvc2FsX2Zyb20iLCJwcm9wb3NhbCIsInNjaGVtYV92ZXJzaW9uIiwiaW50ZXJhY3Rpb25fc291cmNlIiwib3BlcmF0aW9uIiwicHJvcG9zZWRfZGF0ZXMiLCJldmVyeSIsInByb3Bvc2VkX2ludGVydmFscyIsImJlZ2luX3Jldmlld19sb2FkaW5nIiwibG9hZGluZyIsImVuZF9yZXZpZXdfbG9hZGluZyIsIm92ZXJsYXkiLCJwcm9jZXNzaW5nX25vdGljZSIsInByZXZpb3VzX2FyaWFfYnVzeSIsInJlbGVhc2VkIiwiaGlkZV9wcm9jZXNzaW5nX25vdGljZSIsInJlc3RvcmVfbGlmZWN5Y2xlX3Njcm9sbCIsInNjcm9sbFRvIiwiZmluZF9ib29raW5nX2NhcmQiLCJzZWxlY3RlZF9jYXJkIiwiZmlyc3RfY2FyZCIsInJlc3RvcmVfbGlmZWN5Y2xlX2ZvY3VzIiwicmVzdG9yZV9mb2N1cyIsInNlbGVjdGlvbiIsInJlbW92ZV9yZXZpZXdfaG9zdCIsImNsb3NlX3JldmlldyIsImluZGV4T2YiLCJhYm9ydCIsInNob3dfcHJvY2Vzc2luZ19ub3RpY2UiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZV9wcm9jZXNzaW5nIiwibGFzdCIsInN0b3AiLCJoaWRlIiwic2hvd19yZXZpZXdfZXJyb3Jfbm90aWNlIiwiZ2V0X3JlcXVlc3RfZXJyb3IiLCJmYWxsYmFja19tZXNzYWdlIiwiZXJyb3JfZGF0YSIsInJlc3BvbnNlSlNPTiIsImNvZGUiLCJiaW5kX3Jldmlld19jb250cm9scyIsImNhbmNlbF9jb250cm9sIiwiYXBwbHlfY29udHJvbCIsInJldHJ5X2NvbnRyb2wiLCJyZXF1ZXN0X2FwcGx5IiwicmVmcmVzaF9hZnRlcl9hcHBseSIsInJlbmRlcl9yZXZpZXdfc3VyZmFjZSIsInZpZXdfbW9kZWwiLCJzaGVsbCIsInJldmlldyIsImluaXRpYWxfZm9jdXMiLCJjbGFzc05hbWUiLCJib2R5IiwicmVuZGVyX3NpZ25lZF9yZXZpZXciLCJhY3Rpb25zIiwiYWxsb3dlZF9hY3Rpb25zIiwicmV2aWV3X2h0bWwiLCJyZXZpZXdfdGl0bGUiLCJjYW5jZWxfbGFiZWwiLCJjYW5jZWwiLCJhcHBseV9sYWJlbCIsImFwcGx5IiwicmV0cnlfcmVmcmVzaF9sYWJlbCIsInJldHJ5X3JlZnJlc2giLCJjYW5fY2FuY2VsIiwiY2FuX2FwcGx5IiwiY2FuX3JldHJ5X3JlZnJlc2giLCJpc19idXN5IiwiZmluaXNoX3Jldmlld19mYWlsdXJlIiwiZXJyb3JfbWVzc2FnZSIsInJlbmRlcl9yZXZpZXciLCJjYW5vbmljYWwiLCJyZXZpZXdfcmVzb3VyY2VzIiwicmVzb3VyY2VzIiwiZXhwZWN0ZWRfcmVzb3VyY2VfY2hhbmdlIiwidG9rZW4iLCJwcm9wb3NlZF90YXJnZXQiLCJpZCIsInJlc291cmNlX2NoYW5nZWQiLCJwbGFuIiwidGVzdCIsImV4cGlyZXNfYXQiLCJyZXZpZXdfcmVhZHkiLCJvcGVuX2Nhbm9uaWNhbF9yZXZpZXciLCJsb2FkaW5nX3N0YXRlIiwicmV2aWV3X2ZhaWxlZCIsInJldmlld19sb2FkaW5nIiwiSlNPTiIsInN0cmluZ2lmeSIsInJlcXVlc3Rfc3RhdHVzIiwicmV2aWV3X21vdmVtZW50X3Byb3Bvc2FsIiwiaGFzX2RhdGVzIiwiaGFzX2ludGVydmFscyIsImlzX3NhbWVfcmVzb3VyY2UiLCJpc19hcHBseV9yZXN1bHRfdmFsaWQiLCJyZXN1bHQiLCJpZGVudGl0eSIsImNhbm9uaWNhbF9pZGVudGl0eSIsImhvc3RfcmVmcmVzaCIsIm1vZGlmaWNhdGlvbl9kYXRlIiwicmVxdWlyZWQiLCJpc191bmNlcnRhaW5fYXBwbHlfZmFpbHVyZSIsInJlc3RvcmVfYWZ0ZXJfcmVhZGJhY2siLCJleHBlY3RlZF9hbmNob3IiLCJmaW5pc2hfYWZ0ZXJfcmVhZGJhY2siLCJjb21wbGV0aW9uIiwiZGVsYXkiLCJyZW5kZXJfcmVmcmVzaF9lcnJvciIsInJlZnJlc2hfZmFpbGVkIiwicmVmcmVzaF9yZXN1bHQiLCJyZWZyZXNoaW5nIiwicmVmcmVzaF9lcnJvciIsIkRlZmVycmVkIiwicmVqZWN0IiwicHJvbWlzZSIsIndoZW4iLCJmaW5pc2hfYXBwbHlfcmVqZWN0aW9uIiwicmVjb3Zlcl91bmNlcnRhaW5fYXBwbHkiLCJjaGFuZ2VkIiwicmVjb3ZlcnlfcmVhZGJhY2siLCJhcHBseV9tZW1vcnkiLCJhcHBseWluZyIsInNlbmRfbW9kaWZpZWRfZW1haWwiLCJnZXRfc2VuZF9tb2RpZmllZF9lbWFpbF9pbnRlbnQiLCJhcHBseV9mYWlsZWQiLCJhcHBsaWVkIiwiZW1haWxfdG9nZ2xlIiwiY2hlY2tlZCIsIm9uX2VuZCIsImRyb3BfY2FuZGlkYXRlIiwiZGVzdGluYXRpb25fcmVzdHJpY3Rpb24iLCJyZXN0b3JlX3Njcm9sbCIsImNhbmNlbGxlZCIsInNldFRpbWVvdXQiLCJ0cmFwX3Jldmlld19mb2N1cyIsImNvbnRyb2xzIiwia2V5IiwiY29udHJvbCIsIm9mZnNldFBhcmVudCIsInNoaWZ0S2V5IiwicHJldmVudERlZmF1bHQiLCJvbl9rZXlkb3duIiwib25fYmx1ciIsIm9uX3Zpc2liaWxpdHkiLCJvbl9wYWdlX2hpZGUiLCJmb3JjZV9saWZlY3ljbGVfdGVhcmRvd24iLCJkZXN0cm95X3NvcnRhYmxlcyIsImRlc3Ryb3kiLCJzeW5jaHJvbml6ZV9zb3J0YWJsZXMiLCJncm91cCIsIm5hbWUiLCJwdWxsIiwicHV0IiwiaGFuZGxlIiwiZHJhZ2dhYmxlIiwicHJldmVudE9uRmlsdGVyIiwiZm9yY2VGYWxsYmFjayIsImZhbGxiYWNrT25Cb2R5IiwiZmFsbGJhY2tUb2xlcmFuY2UiLCJmYWxsYmFja190b2xlcmFuY2UiLCJhbmltYXRpb24iLCJlbXB0eUluc2VydFRocmVzaG9sZCIsInNjcm9sbCIsImZhbGxiYWNrQ2xhc3MiLCJnaG9zdENsYXNzIiwiY2hvc2VuQ2xhc3MiLCJvbkNob29zZSIsIm9uQ2xvbmUiLCJvblN0YXJ0Iiwib25Nb3ZlIiwib25FbmQiLCJyZWdpc3Rlcl9zZWdtZW50Iiwic2VnbWVudCIsImJlZ2luX3JlZnJlc2giLCJwcmVzZXJ2ZXNfYXBwbHlfcmVhZGJhY2siLCJjb21wbGV0ZV9yZWZyZXNoIiwic2VsZWN0aW9uX3N0YXRlIiwic2V0X3JlcXVlc3RfbG9hZGluZyIsImlzX2xvYWRpbmciLCJpc19pbnRlcmFjdGluZyIsImluaXRpYWxpemUiLCJpc19hdmFpbGFibGUiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXRpbWVsaW5lL2Jvb2tpbmctbW92ZW1lbnQvX3NyYy9ib29raW5nLW1vdmVtZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSXNvbGF0ZWQgU29ydGFibGVKUyBhZGFwdGVyIGZvciByZXZpZXdlZCBUaW1lbGluZSBib29raW5nIG1vdmVtZW50LlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBtb2R1bGVzID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblx0dmFyIGludGVyYWN0aW9ucyA9IHdpbmRvdy53cGJjX3RpbWVsaW5lX2Jvb2tpbmdfaW50ZXJhY3Rpb25zO1xuXHR2YXIgY29uZmlnID0gd2luZG93LndwYmNfdGltZWxpbmVfYm9va2luZ19tb3ZlbWVudF9jb25maWcgfHwge307XG5cblx0aWYgKFxuXHRcdCEgbW9kdWxlc1xuXHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb2R1bGVzLnJlZ2lzdGVyX2ZhY3Rvcnlcblx0XHR8fCAhIGludGVyYWN0aW9uc1xuXHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBpbnRlcmFjdGlvbnMucmVnaXN0ZXJfZXh0ZW5zaW9uX2ZhY3Rvcnlcblx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LlNvcnRhYmxlXG5cdFx0fHwgISB3aW5kb3cualF1ZXJ5XG5cdFx0fHwgISB3aW5kb3cud3Bcblx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwLnRlbXBsYXRlXG5cdCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIG1vdmVtZW50IGFkYXB0ZXIgZm9yIG9uZSBUaW1lbGluZSBtb3VudC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGhvc3RfY29udGV4dCBEb21haW4tbmV1dHJhbCBUaW1lbGluZSBjYWxsYmFja3MuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gTW92ZW1lbnQgbGlmZWN5Y2xlIGNvbnRyb2xsZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfY29udHJvbGxlciggaG9zdF9jb250ZXh0ICkge1xuXHRcdHZhciBtb3VudCA9IGhvc3RfY29udGV4dC5tb3VudDtcblx0XHR2YXIgY2FsbGJhY2tzID0gaG9zdF9jb250ZXh0LmNhbGxiYWNrcyB8fCB7fTtcblx0XHR2YXIgdHJhbnNwb3J0ID0gY29uZmlnLnRyYW5zcG9ydCB8fCB7fTtcblx0XHR2YXIgcmV2aWV3X3RyYW5zcG9ydCA9IGNvbmZpZy5yZXZpZXdfdHJhbnNwb3J0IHx8IHt9O1xuXHRcdHZhciBhcHBseV90cmFuc3BvcnQgPSBjb25maWcuYXBwbHlfdHJhbnNwb3J0IHx8IHt9O1xuXHRcdHZhciBzb3J0YWJsZV9jb25maWcgPSBjb25maWcuc29ydGFibGUgfHwge307XG5cdFx0dmFyIHRlbXBsYXRlcyA9IGNvbmZpZy50ZW1wbGF0ZXMgfHwge307XG5cdFx0dmFyIGkxOG4gPSBjb25maWcuaTE4biB8fCB7fTtcblx0XHR2YXIgcmVjb3JkcyA9IG5ldyBXZWFrTWFwKCk7XG5cdFx0dmFyIHZpc2libGVfcmVjb3JkcyA9IFtdO1xuXHRcdHZhciByZXF1ZXN0cyA9IG5ldyBXZWFrTWFwKCk7XG5cdFx0dmFyIHNvcnRhYmxlcyA9IFtdO1xuXHRcdHZhciBnZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgcGVuZGluZ19wb2ludGVyID0gbnVsbDtcblx0XHR2YXIgZ2VzdHVyZSA9IG51bGw7XG5cdFx0dmFyIHJldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgcmV2aWV3X2xvYWRpbmdfc3RhdGUgPSBudWxsO1xuXHRcdHZhciByZXZpZXdfaG9zdCA9IG51bGw7XG5cdFx0dmFyIHJldmlld19tZW1vcnkgPSBudWxsO1xuXHRcdHZhciBhcHBseV9yZXF1ZXN0ID0gbnVsbDtcblx0XHR2YXIgYXBwbHlfcHJvY2Vzc2luZ19ub3RpY2UgPSBudWxsO1xuXHRcdHZhciBwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IG51bGw7XG5cdFx0dmFyIHBlbmRpbmdfY29tcGxldGlvbiA9IG51bGw7XG5cdFx0dmFyIGxpZmVjeWNsZV9zdGF0ZSA9ICdpZGxlJztcblx0XHR2YXIgbGlmZWN5Y2xlX2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBsaWZlY3ljbGVfYW5jaG9yID0gbnVsbDtcblx0XHR2YXIgcGVuZGluZ19ncmlwX2ZvY3VzX2Jvb2tpbmdfaWQgPSAwO1xuXHRcdHZhciByZXBsYWNlbWVudF9jYXJkID0gbnVsbDtcblx0XHR2YXIgbGl2ZV9yZWdpb24gPSBudWxsO1xuXHRcdHZhciBzY3JvbGxfZnJhbWUgPSAwO1xuXHRcdHZhciBpbml0aWFsaXplZCA9IGZhbHNlO1xuXHRcdHZhciBpc19kZXN0cm95ZWQgPSBmYWxzZTtcblx0XHR2YXIgZ3JvdXBfbmFtZSA9ICd3cGJjLXRpbWVsaW5lLW1vdmVtZW50LScgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyICk7XG5cdFx0dmFyIGZpbHRlcl9zZWxlY3RvciA9IFtcblx0XHRcdCdbZGF0YS13cGJjLXRpbWVsaW5lLXNvcnRhYmxlLWV4Y2x1ZGVdJyxcblx0XHRcdCdidXR0b246bm90KFtkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1tb3ZlbWVudC1ncmlwXSknLFxuXHRcdFx0J2EnLCAnaW5wdXQnLCAnc2VsZWN0JywgJ3RleHRhcmVhJyxcblx0XHRcdCdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctcmVzaXplLWhvc3RdJ1xuXHRcdF0uam9pbiggJywnICk7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYSBmaXhlZCBXb3JkUHJlc3MgdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfaWQgQWxsb3ctbGlzdGVkIHRlbXBsYXRlIElELlxuXHRcdCAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IFRlbXBsYXRlIHJlbmRlcmVyIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdGVtcGxhdGUoIHRlbXBsYXRlX2lkICkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIHRlbXBsYXRlX2lkID8gd2luZG93LndwLnRlbXBsYXRlKCB0ZW1wbGF0ZV9pZCApIDogbnVsbDtcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQW5ub3VuY2UgYW4gYXV0aG9yaXplZCBsb2NhbGl6ZWQgbWVzc2FnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFN0YXR1cyB0ZXh0LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYW5ub3VuY2UoIG1lc3NhZ2UgKSB7XG5cdFx0XHRpZiAoIGxpdmVfcmVnaW9uICkge1xuXHRcdFx0XHRsaXZlX3JlZ2lvbi50ZXh0Q29udGVudCA9IFN0cmluZyggbWVzc2FnZSB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSB0aGUgc291cmNlLW9ubHkgbW92ZW1lbnQgcmVzcG9uc2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgQUpBWCByZXNwb25zZS5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVjb3JkIFNvdXJjZSBzZWdtZW50LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBJbW11dGFibGUgbW92ZW1lbnQgY29udGV4dC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVfY29udGV4dCggcmVzcG9uc2UsIHJlY29yZCApIHtcblx0XHRcdHZhciBkdG8gPSByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhLm1vdmVtZW50X2NvbnRleHQgOiBudWxsO1xuXHRcdFx0dmFyIHNlZWQgPSBkdG8gJiYgZHRvLnNjaGVkdWxlX3NlZWQgPyBkdG8uc2NoZWR1bGVfc2VlZCA6IHt9O1xuXHRcdFx0dmFyIGF2YWlsYWJpbGl0eSA9IGR0byAmJiBkdG8uZ2VzdHVyZV9hdmFpbGFiaWxpdHkgPyBkdG8uZ2VzdHVyZV9hdmFpbGFiaWxpdHkgOiB7fTtcblx0XHRcdHZhciByZXN0cmljdGlvbnMgPSBkdG8gJiYgZHRvLmdlc3R1cmVfcmVzdHJpY3Rpb25zID8gZHRvLmdlc3R1cmVfcmVzdHJpY3Rpb25zIDoge307XG5cdFx0XHR2YXIgZGF0ZXMgPSBBcnJheS5pc0FycmF5KCBzZWVkLnNlbGVjdGVkX2RhdGVzICkgPyBzZWVkLnNlbGVjdGVkX2RhdGVzLm1hcCggU3RyaW5nICkgOiBbXTtcblx0XHRcdHZhciBpbnRlcnZhbHMgPSBBcnJheS5pc0FycmF5KCBzZWVkLmV4YWN0X2ludGVydmFscyApID8gc2VlZC5leGFjdF9pbnRlcnZhbHMubWFwKCBmdW5jdGlvbiAoIGludGVydmFsICkge1xuXHRcdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSggeyBzdGFydDogU3RyaW5nKCBpbnRlcnZhbC5zdGFydCB8fCAnJyApLCBlbmQ6IFN0cmluZyggaW50ZXJ2YWwuZW5kIHx8ICcnICkgfSApO1xuXHRcdFx0fSApIDogW107XG5cblx0XHRcdGlmICggISBkdG8gfHwgTnVtYmVyKCBkdG8uYm9va2luZ19pZCApICE9PSByZWNvcmQuYm9va2luZ19pZCB8fCAhIE51bWJlciggZHRvLnByaW1hcnlfcmVzb3VyY2VfaWQgKSB8fCAhIE51bWJlciggZHRvLnByb3Bvc2FsX3JldmlzaW9uICkgfHwgISBTdHJpbmcoIGR0by5zb3VyY2VfY29udGV4dF90b2tlbiB8fCAnJyApIHx8ICggISBhdmFpbGFiaWxpdHkuc2FtZV9yZXNvdXJjZSAmJiAhIGF2YWlsYWJpbGl0eS5jcm9zc19yZXNvdXJjZSApIHx8ICEgZGF0ZXMubGVuZ3RoIHx8ICEgWyAncG9saWN5JywgJ2luZGl2aWR1YWwnIF0uaW5jbHVkZXMoIFN0cmluZyggc2VlZC5zZWxlY3Rpb25fbWV0aG9kICkgKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdmdWxsX2RheScgIT09IHNlZWQudGltZV9hcHBsaWNhdGlvbiAmJiAoICEgaW50ZXJ2YWxzLmxlbmd0aCB8fCBpbnRlcnZhbHMuc29tZSggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0cmV0dXJuICEgRGF0ZS5wYXJzZSggaW50ZXJ2YWwuc3RhcnQgKSB8fCBEYXRlLnBhcnNlKCBpbnRlcnZhbC5lbmQgKSA8PSBEYXRlLnBhcnNlKCBpbnRlcnZhbC5zdGFydCApO1xuXHRcdFx0fSApICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0Ym9va2luZ19pZDogcmVjb3JkLmJvb2tpbmdfaWQsXG5cdFx0XHRcdHByaW1hcnlfcmVzb3VyY2VfaWQ6IE1hdGgucm91bmQoIE51bWJlciggZHRvLnByaW1hcnlfcmVzb3VyY2VfaWQgKSApLFxuXHRcdFx0XHRwcm9wb3NhbF9yZXZpc2lvbjogTWF0aC5yb3VuZCggTnVtYmVyKCBkdG8ucHJvcG9zYWxfcmV2aXNpb24gKSApLFxuXHRcdFx0XHRzb3VyY2VfY29udGV4dF90b2tlbjogU3RyaW5nKCBkdG8uc291cmNlX2NvbnRleHRfdG9rZW4gKSxcblx0XHRcdFx0c2FtZV9yZXNvdXJjZV9hdmFpbGFibGU6IEJvb2xlYW4oIGF2YWlsYWJpbGl0eS5zYW1lX3Jlc291cmNlICksXG5cdFx0XHRcdGNyb3NzX3Jlc291cmNlX2F2YWlsYWJsZTogQm9vbGVhbiggYXZhaWxhYmlsaXR5LmNyb3NzX3Jlc291cmNlICksXG5cdFx0XHRcdHNhbWVfcmVzb3VyY2VfcmVzdHJpY3Rpb246IGF2YWlsYWJpbGl0eS5zYW1lX3Jlc291cmNlID8gJycgOiBTdHJpbmcoIHJlc3RyaWN0aW9ucy5zYW1lX3Jlc291cmNlIHx8IGR0by5mYWxsYmFja19yZWFzb24gfHwgJ29wZXJhdGlvbl91bnN1cHBvcnRlZCcgKSxcblx0XHRcdFx0Y3Jvc3NfcmVzb3VyY2VfcmVzdHJpY3Rpb246IGF2YWlsYWJpbGl0eS5jcm9zc19yZXNvdXJjZSA/ICcnIDogU3RyaW5nKCByZXN0cmljdGlvbnMuY3Jvc3NfcmVzb3VyY2UgfHwgZHRvLmZhbGxiYWNrX3JlYXNvbiB8fCAnb3BlcmF0aW9uX3Vuc3VwcG9ydGVkJyApLFxuXHRcdFx0XHRzZWxlY3Rpb25fbWV0aG9kOiBTdHJpbmcoIHNlZWQuc2VsZWN0aW9uX21ldGhvZCApLFxuXHRcdFx0XHR0aW1lX2FwcGxpY2F0aW9uOiBTdHJpbmcoIHNlZWQudGltZV9hcHBsaWNhdGlvbiApLFxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlczogT2JqZWN0LmZyZWV6ZSggZGF0ZXMgKSxcblx0XHRcdFx0ZXhhY3RfaW50ZXJ2YWxzOiBPYmplY3QuZnJlZXplKCBpbnRlcnZhbHMgKVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhpZGUgdGhlIGRlY29yYXRpdmUgaW5kaWNhdG9yIHVudGlsIHNvdXJjZSBlbGlnaWJpbGl0eSBpcyBjb25maXJtZWQuXG5cdFx0ICpcblx0XHQgKiBUaGUgc2VydmVyIHJlbWFpbnMgYXV0aG9yaXRhdGl2ZSBmb3IgbW92ZW1lbnQgZWxpZ2liaWxpdHkuIFJlZ2lzdHJhdGlvblxuXHRcdCAqIGhpZGVzIHRoZSBub24taW50ZXJhY3RpdmUgbWFya2VyIGJlZm9yZSBzZWxlY3Rpb24gY2FuIGltcGx5IHRoYXQgZHJhZ2dpbmdcblx0XHQgKiBpcyBhdmFpbGFibGUuIEEgc3VjY2Vzc2Z1bCByZXNwb25zZSByZXBsYWNlcyBpdCB3aXRoIHRoZSBleHBsaWNpdCBidXR0b247XG5cdFx0ICogZXZlcnkgb3RoZXIgb3V0Y29tZSBsZWF2ZXMgaXQgaGlkZGVuIHVudGlsIGNhbm9uaWNhbCBUaW1lbGluZSByZXJlbmRlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWNvcmQgU291cmNlIHNlZ21lbnQgYXdhaXRpbmcgY2Fub25pY2FsIGNvbnRleHQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoaWRlX3VucmVzb2x2ZWRfaW5kaWNhdG9yKCByZWNvcmQgKSB7XG5cdFx0XHR2YXIgaW5kaWNhdG9yID0gcmVjb3JkICYmIHJlY29yZC5yYWlsXG5cdFx0XHRcdD8gcmVjb3JkLnJhaWwucXVlcnlTZWxlY3RvciggJy53cGJjX3RpbWVsaW5lX19ib29raW5nX2RyYWdfaW5kaWNhdG9yJyApXG5cdFx0XHRcdDogbnVsbDtcblxuXHRcdFx0aWYgKCAhIGluZGljYXRvciB8fCBpbmRpY2F0b3IuaGlkZGVuIHx8IGluZGljYXRvci5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1tb3ZlbWVudC1ncmlwJyApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpbmRpY2F0b3IuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhbGxiYWNrcy5zY2hlZHVsZV9sYXlvdXQgKSB7XG5cdFx0XHRcdGNhbGxiYWNrcy5zY2hlZHVsZV9sYXlvdXQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgdGhlIGV4cGxpY2l0IGdyaXAgYWZ0ZXIgc2VydmVyIGVsaWdpYmlsaXR5IHN1Y2NlZWRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlY29yZCBBdXRob3JpemVkIHNvdXJjZSBzZWdtZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2dyaXAoIHJlY29yZCApIHtcblx0XHRcdHZhciByZW5kZXJlciA9IHRlbXBsYXRlKCB0ZW1wbGF0ZXMuZ3JpcCApO1xuXHRcdFx0dmFyIHJhaWwgPSByZWNvcmQucmFpbDtcblx0XHRcdHZhciBpbmRpY2F0b3IgPSByYWlsID8gcmFpbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmVfX2Jvb2tpbmdfZHJhZ19pbmRpY2F0b3InICkgOiBudWxsO1xuXHRcdFx0dmFyIGRvY2sgPSByZWNvcmQuY2FyZC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmVfX2Jvb2tpbmdfYWNjZXNzb3J5X2RvY2snICk7XG5cdFx0XHR2YXIgYnVmZmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0XHR2YXIgZ3JpcDtcblxuXHRcdFx0aWYgKCAhIHJlbmRlcmVyIHx8ICEgaW5kaWNhdG9yIHx8IGluZGljYXRvci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLW1vdmVtZW50LWdyaXBdJyApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRidWZmZXIuaW5uZXJIVE1MID0gcmVuZGVyZXIoIHsgYm9va2luZ19pZDogcmVjb3JkLmJvb2tpbmdfaWQsIGxhYmVsOiBpMThuLmdyaXBfbGFiZWwgfHwgJycgfSApO1xuXHRcdFx0aWYgKCAhIGJ1ZmZlci5maXJzdEVsZW1lbnRDaGlsZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aW5kaWNhdG9yLnJlcGxhY2VXaXRoKCBidWZmZXIuZmlyc3RFbGVtZW50Q2hpbGQgKTtcblx0XHRcdFsgcmFpbCwgZG9jayBdLmZvckVhY2goIGZ1bmN0aW9uICggZWxlbWVudCApIHtcblx0XHRcdFx0aWYgKCBlbGVtZW50ICkge1xuXHRcdFx0XHRcdGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXNvcnRhYmxlLWV4Y2x1ZGUnICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHJhaWwuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctY29udHJvbC1yYWlsLWNhcmQtb3duZWQnLCAnJyApO1xuXHRcdFx0cmVjb3JkLmNhcmQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctbW92YWJsZScsICd0cnVlJyApO1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY2FsbGJhY2tzLnNjaGVkdWxlX2xheW91dCApIHtcblx0XHRcdFx0Y2FsbGJhY2tzLnNjaGVkdWxlX2xheW91dCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwZW5kaW5nX2dyaXBfZm9jdXNfYm9va2luZ19pZCA9PT0gcmVjb3JkLmJvb2tpbmdfaWQgKSB7XG5cdFx0XHRcdGdyaXAgPSByZWNvcmQuY2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLW1vdmVtZW50LWdyaXBdJyApO1xuXHRcdFx0XHRwZW5kaW5nX2dyaXBfZm9jdXNfYm9va2luZ19pZCA9IDA7XG5cdFx0XHRcdGlmICggZ3JpcCAmJiBncmlwLmlzQ29ubmVjdGVkICkge1xuXHRcdFx0XHRcdGdyaXAuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcXVlc3Qgc291cmNlIGVsaWdpYmlsaXR5IHdpdGhvdXQgcmVxdWVzdGluZyBhbnkgdGFyZ2V0IGF1dGhvcml0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWNvcmQgQ2Fub25pY2FsIHJlbmRlcmVkIHNlZ21lbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X2NvbnRleHQoIHJlY29yZCApIHtcblx0XHRcdHZhciByZXF1ZXN0X2dlbmVyYXRpb247XG5cdFx0XHR2YXIgcGVuZGluZztcblxuXHRcdFx0aWYgKCAhIHJlY29yZCB8fCAnaWRsZScgIT09IHJlY29yZC5zdGF0ZSB8fCAhIHRyYW5zcG9ydC51cmwgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGdlbmVyYXRpb24gKz0gMTtcblx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbiA9IGdlbmVyYXRpb247XG5cdFx0XHRyZWNvcmQuc3RhdGUgPSAnbG9hZGluZyc7XG5cdFx0XHRyZWNvcmQuZ2VuZXJhdGlvbiA9IHJlcXVlc3RfZ2VuZXJhdGlvbjtcblx0XHRcdGhpZGVfdW5yZXNvbHZlZF9pbmRpY2F0b3IoIHJlY29yZCApO1xuXHRcdFx0cGVuZGluZyA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0XHR1cmw6IHRyYW5zcG9ydC51cmwsIG1ldGhvZDogJ1BPU1QnLCBkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQuYWN0aW9uLCBub25jZTogdHJhbnNwb3J0Lm5vbmNlLCBib29raW5nX2lkOiByZWNvcmQuYm9va2luZ19pZCxcblx0XHRcdFx0XHRzb3VyY2U6ICd0aW1lbGluZScsIHNlZ21lbnRfaWQ6IHJlY29yZC5zZWdtZW50X2lkLCBzZWdtZW50X3Jlc291cmNlX2lkOiByZWNvcmQucmVzb3VyY2VfaWQsXG5cdFx0XHRcdFx0dmlzaWJsZV9zdGFydF9hdDogcmVjb3JkLnZpc2libGVfc3RhcnQsIHZpc2libGVfZW5kX2F0OiByZWNvcmQudmlzaWJsZV9lbmQsIHByb3Bvc2FsX3JldmlzaW9uOiAxXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgbW92ZW1lbnRfY29udGV4dDtcblxuXHRcdFx0XHRpZiAoIHJlcXVlc3RfZ2VuZXJhdGlvbiAhPT0gcmVjb3JkLmdlbmVyYXRpb24gfHwgcmVjb3Jkcy5nZXQoIHJlY29yZC5jYXJkICkgIT09IHJlY29yZCB8fCAhIHJlY29yZC5jYXJkLmlzQ29ubmVjdGVkICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRtb3ZlbWVudF9jb250ZXh0ID0gbm9ybWFsaXplX2NvbnRleHQoIHJlc3BvbnNlLCByZWNvcmQgKTtcblx0XHRcdFx0cmVjb3JkLmNvbnRleHQgPSBtb3ZlbWVudF9jb250ZXh0O1xuXHRcdFx0XHRyZWNvcmQuc3RhdGUgPSBtb3ZlbWVudF9jb250ZXh0ID8gJ3JlYWR5JyA6ICdkZW5pZWQnO1xuXHRcdFx0XHRpZiAoIG1vdmVtZW50X2NvbnRleHQgKSB7XG5cdFx0XHRcdFx0cmVuZGVyX2dyaXAoIHJlY29yZCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBmYWlsZWRfcmVxdWVzdCwgc3RhdHVzICkge1xuXHRcdFx0XHRpZiAoICdhYm9ydCcgIT09IHN0YXR1cyAmJiByZXF1ZXN0X2dlbmVyYXRpb24gPT09IHJlY29yZC5nZW5lcmF0aW9uICYmIHJlY29yZHMuZ2V0KCByZWNvcmQuY2FyZCApID09PSByZWNvcmQgKSB7XG5cdFx0XHRcdFx0cmVjb3JkLnN0YXRlID0gJ2Vycm9yJztcblx0XHRcdFx0fVxuXHRcdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIHJlcXVlc3RzLmdldCggcmVjb3JkLmNhcmQgKSA9PT0gcGVuZGluZyApIHtcblx0XHRcdFx0XHRyZXF1ZXN0cy5kZWxldGUoIHJlY29yZC5jYXJkICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHJlcXVlc3RzLnNldCggcmVjb3JkLmNhcmQsIHBlbmRpbmcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBMYXppbHkgcmVxdWVzdCBjb250ZXh0IG9uIGRlbGliZXJhdGUgaW5kaWNhdG9yIGhvdmVyIG9yIGNhcmQgZm9jdXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBQb2ludGVyIG9yIGZvY3VzIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb25fY29udGV4dF9pbnRlbnQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGNhcmQgPSByZXNvbHZlX2FjY2Vzc29yeV9jYXJkKCBldmVudC50YXJnZXQgKTtcblx0XHRcdHZhciByZWNvcmQgPSBjYXJkID8gcmVjb3Jkcy5nZXQoIGNhcmQgKSA6IG51bGw7XG5cblx0XHRcdGlmICggcmVjb3JkICYmICggJ2ZvY3VzaW4nID09PSBldmVudC50eXBlIHx8IGNhcmQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtYm9va2luZy1zZWxlY3RlZCcgKSApICkge1xuXHRcdFx0XHRyZXF1ZXN0X2NvbnRleHQoIHJlY29yZCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhcHR1cmUgcG9pbnRlciBvcmlnaW4gb25seSBmcm9tIGFuIGF1dGhvcml6ZWQgZXhwbGljaXQgZ3JpcC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBQb2ludGVyLWRvd24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvbl9wb2ludGVyX2Rvd24oIGV2ZW50ICkge1xuXHRcdFx0dmFyIGdyaXAgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1tb3ZlbWVudC1ncmlwXScgKTtcblx0XHRcdHZhciBjYXJkID0gZ3JpcCA/IHJlc29sdmVfYWNjZXNzb3J5X2NhcmQoIGdyaXAgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmVjb3JkID0gY2FyZCA/IHJlY29yZHMuZ2V0KCBjYXJkICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoIHJlY29yZCAmJiByZWNvcmQuY29udGV4dCAmJiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiBjYWxsYmFja3MuY2FuX3N0YXJ0X2ludGVyYWN0aW9uIHx8IGNhbGxiYWNrcy5jYW5fc3RhcnRfaW50ZXJhY3Rpb24oKSApICkge1xuXHRcdFx0XHRwZW5kaW5nX3BvaW50ZXIgPSB7IGNhcmQ6IGNhcmQsIHg6IE51bWJlciggZXZlbnQuY2xpZW50WCApLCB5OiBOdW1iZXIoIGV2ZW50LmNsaWVudFkgKSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgYSBjYW5vbmljYWwgY2FyZCBmcm9tIGFuIGluLWNhcmQgb3IgZGV0YWNoZWQgY29udHJvbCByYWlsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gYWNjZXNzb3J5IENvbnRyb2wgb3IgYWNjZXNzb3J5IGRlc2NlbmRhbnQuXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gQ2Fub25pY2FsIGNhcmQgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNvbHZlX2FjY2Vzc29yeV9jYXJkKCBhY2Nlc3NvcnkgKSB7XG5cdFx0XHR2YXIgY2FyZCA9IGFjY2Vzc29yeSAmJiBhY2Nlc3NvcnkuY2xvc2VzdCA/IGFjY2Vzc29yeS5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50LWlkXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmFpbDtcblx0XHRcdHZhciBzZWdtZW50X2lkO1xuXG5cdFx0XHRpZiAoIGNhcmQgKSB7XG5cdFx0XHRcdHJldHVybiBjYXJkO1xuXHRcdFx0fVxuXHRcdFx0cmFpbCA9IGFjY2Vzc29yeSAmJiBhY2Nlc3NvcnkuY2xvc2VzdCA/IGFjY2Vzc29yeS5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLWNvbnRyb2wtcmFpbF0nICkgOiBudWxsO1xuXHRcdFx0c2VnbWVudF9pZCA9IHJhaWwgPyBTdHJpbmcoIHJhaWwuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWFjY2Vzc29yeS1zZWdtZW50LWlkJyApIHx8ICcnICkgOiAnJztcblx0XHRcdGlmICggISBzZWdtZW50X2lkICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnQtaWRdJyApLmZvckVhY2goIGZ1bmN0aW9uICggY2FuZGlkYXRlICkge1xuXHRcdFx0XHRpZiAoICEgY2FyZCAmJiBzZWdtZW50X2lkID09PSBTdHJpbmcoIGNhbmRpZGF0ZS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudC1pZCcgKSB8fCAnJyApICkge1xuXHRcdFx0XHRcdGNhcmQgPSBjYW5kaWRhdGU7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIGNhcmQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FwdHVyZSBheGlzIERUT3Mgd2l0aCB0aGVpciBjdXJyZW50IHBoeXNpY2FsIHJlY3RhbmdsZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEltbXV0YWJsZSBheGlzIHNuYXBzaG90LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhcHR1cmVfYXhpcygpIHtcblx0XHRcdHZhciBheGlzID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhbGxiYWNrcy5nZXRfYXhpcyA/IGNhbGxiYWNrcy5nZXRfYXhpcygpIHx8IHt9IDoge307XG5cdFx0XHR2YXIgaGVhZGVycyA9IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLWF4aXMtY2VsbF0nICk7XG5cdFx0XHR2YXIgY2VsbHMgPSBBcnJheS5pc0FycmF5KCBheGlzLmNlbGxzICkgPyBheGlzLmNlbGxzLm1hcCggZnVuY3Rpb24gKCBjZWxsLCBpbmRleCApIHtcblx0XHRcdFx0dmFyIHJlY3RhbmdsZSA9IGhlYWRlcnNbaW5kZXhdID8gaGVhZGVyc1tpbmRleF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkgOiBudWxsO1xuXHRcdFx0XHRyZXR1cm4gcmVjdGFuZ2xlID8gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRcdHN0YXJ0X2Vwb2NoOiBOdW1iZXIoIGNlbGwuc3RhcnRfZXBvY2ggKSwgZW5kX2Vwb2NoOiBOdW1iZXIoIGNlbGwuZW5kX2Vwb2NoICksIGRhdGU6IFN0cmluZyggY2VsbC5kYXRlIHx8ICcnICksXG5cdFx0XHRcdFx0bGVmdDogcmVjdGFuZ2xlLmxlZnQsIHJpZ2h0OiByZWN0YW5nbGUucmlnaHRcblx0XHRcdFx0fSApIDogbnVsbDtcblx0XHRcdH0gKS5maWx0ZXIoIEJvb2xlYW4gKSA6IFtdO1xuXG5cdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRjZWxsczogT2JqZWN0LmZyZWV6ZSggY2VsbHMgKSwgdGltZXpvbmU6IFN0cmluZyggYXhpcy50aW1lem9uZSB8fCAnVVRDJyApLFxuXHRcdFx0XHRpc19ydGw6ICdydGwnID09PSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSggbW91bnQgKS5kaXJlY3Rpb25cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYXB0dXJlIGV2ZXJ5IHZpc2libGUgUmVzb3VyY2Utcm93IHRhcmdldCwgaW5jbHVkaW5nIGVtcHR5IHJvd3MuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBJbW11dGFibGUgdGFyZ2V0IHJlY29yZHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2FwdHVyZV9yb3dzKCkge1xuXHRcdFx0dmFyIHJvd3MgPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoIG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnRzXScgKSwgZnVuY3Rpb24gKCBob3N0LCBvcmRlciApIHtcblx0XHRcdFx0dmFyIHRyYWNrID0gaG9zdC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1pZF0nICk7XG5cdFx0XHRcdHZhciByZWN0YW5nbGUgPSBob3N0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRcdGhvc3Q6IGhvc3QsIHJlc291cmNlX2lkOiBOdW1iZXIoIHRyYWNrICYmIHRyYWNrLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1pZCcgKSApLCBvcmRlcjogb3JkZXIsXG5cdFx0XHRcdFx0dG9wOiByZWN0YW5nbGUudG9wLCBib3R0b206IHJlY3RhbmdsZS5ib3R0b20sIGxlZnQ6IHJlY3RhbmdsZS5sZWZ0LCByaWdodDogcmVjdGFuZ2xlLnJpZ2h0XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggcm93ICkge1xuXHRcdFx0XHRyZXR1cm4gcm93LnJlc291cmNlX2lkICYmIHJvdy5yaWdodCA+IHJvdy5sZWZ0ICYmIHJvdy5ib3R0b20gPiByb3cudG9wO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSggcm93cyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNuYXBzaG90IERPTSwgYXhpcywgcm93cywgc2Nyb2xsLCBzZWxlY3Rpb24sIGFuZCBmb2N1cyBvbiBjaG9vc2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgU29ydGFibGUgY2hvb3NlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb25fY2hvb3NlKCBldmVudCApIHtcblx0XHRcdHZhciByZWNvcmQgPSByZWNvcmRzLmdldCggZXZlbnQuaXRlbSApO1xuXHRcdFx0dmFyIGNhbnZhcyA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWNhbnZhc10nICk7XG5cdFx0XHR2YXIgdGl0bGUgPSBldmVudC5pdGVtLnF1ZXJ5U2VsZWN0b3IoICcud3BiY190aW1lbGluZV9fYm9va2luZ19kZXRhaWxzIHN0cm9uZycgKTtcblx0XHRcdHZhciBkdXJhdGlvbiA9IGV2ZW50Lml0ZW0ucXVlcnlTZWxlY3RvciggJy53cGJjX3RpbWVsaW5lX19ib29raW5nX3NlY29uZGFyeScgKTtcblx0XHRcdHZhciBzb3VyY2VfaG9zdCA9IGV2ZW50Lml0ZW0ucGFyZW50Tm9kZTtcblxuXHRcdFx0aWYgKCAhIHJlY29yZCB8fCAhIHJlY29yZC5jb250ZXh0IHx8ICEgcGVuZGluZ19wb2ludGVyIHx8IHBlbmRpbmdfcG9pbnRlci5jYXJkICE9PSBldmVudC5pdGVtICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRnZXN0dXJlID0ge1xuXHRcdFx0XHRjYXJkOiBldmVudC5pdGVtLCByZWNvcmQ6IHJlY29yZCwgcGFyZW50OiBldmVudC5pdGVtLnBhcmVudE5vZGUsIG5leHQ6IGV2ZW50Lml0ZW0ubmV4dFNpYmxpbmcsXG5cdFx0XHRcdHN0eWxlOiBldmVudC5pdGVtLmdldEF0dHJpYnV0ZSggJ3N0eWxlJyApLCBjbGFzc19uYW1lOiBldmVudC5pdGVtLmdldEF0dHJpYnV0ZSggJ2NsYXNzJyApLFxuXHRcdFx0XHRheGlzOiBjYXB0dXJlX2F4aXMoKSwgcm93czogY2FwdHVyZV9yb3dzKCksIGNhbnZhczogY2FudmFzLCBjYW52YXNfc2Nyb2xsOiBjYW52YXMgPyBjYW52YXMuc2Nyb2xsTGVmdCA6IDAsXG5cdFx0XHRcdGNhbnZhc19yZWN0YW5nbGU6IGNhbnZhcyA/IGNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSA6IG51bGwsXG5cdFx0XHRcdGRvY194OiB3aW5kb3cucGFnZVhPZmZzZXQgfHwgMCwgZG9jX3k6IHdpbmRvdy5wYWdlWU9mZnNldCB8fCAwLFxuXHRcdFx0XHRzZWxlY3RlZDogZXZlbnQuaXRlbS5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1ib29raW5nLXNlbGVjdGVkJyApLCBmb2N1czogZG9jdW1lbnQuYWN0aXZlRWxlbWVudCxcblx0XHRcdFx0c3RhcnRfeDogcGVuZGluZ19wb2ludGVyLngsIHN0YXJ0X3k6IHBlbmRpbmdfcG9pbnRlci55LCB4OiBwZW5kaW5nX3BvaW50ZXIueCwgeTogcGVuZGluZ19wb2ludGVyLnksXG5cdFx0XHRcdGNhbmRpZGF0ZTogbnVsbCwgcGVuZGluZ19jYW5kaWRhdGU6IG51bGwsIGNhbmRpZGF0ZV9zaW5jZTogMCwgb3JpZ2luOiBudWxsLCBzdGFydGVkOiBmYWxzZSxcblx0XHRcdFx0c291cmNlX3JvdzogbnVsbCwgdmlzdWFsX2Ryb3BfaW50ZW50OiBudWxsLCBkcm9wX2ludGVudDogbnVsbCwgc29ydGFibGVfZGVzdGluYXRpb246IG51bGwsXG5cdFx0XHRcdGNhbmRpZGF0ZV9naG9zdDogbnVsbCwgY2FuZGlkYXRlX2dob3N0X2hvc3Q6IG51bGwsXG5cdFx0XHRcdGdob3N0X2RhdGE6IE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0XHR0aXRsZTogdGl0bGUgPyBTdHJpbmcoIHRpdGxlLnRleHRDb250ZW50IHx8ICcnICkudHJpbSgpIDogJycsXG5cdFx0XHRcdFx0ZHVyYXRpb25fbGFiZWw6IGR1cmF0aW9uID8gU3RyaW5nKCBkdXJhdGlvbi50ZXh0Q29udGVudCB8fCAnJyApLnRyaW0oKSA6ICcnXG5cdFx0XHRcdH0gKVxuXHRcdFx0fTtcblx0XHRcdGdlc3R1cmUuc291cmNlX3JvdyA9IGdldF9yb3dfZm9yX2hvc3QoIGdlc3R1cmUsIHNvdXJjZV9ob3N0ICk7XG5cdFx0XHRpZiAoICEgZ2VzdHVyZS5zb3VyY2Vfcm93ICkge1xuXHRcdFx0XHRnZXN0dXJlID0gbnVsbDtcblx0XHRcdFx0cGVuZGluZ19wb2ludGVyID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNYWtlIGEgY2xvbmUgcHJlc2VudGF0aW9uLW9ubHkgYW5kIGluZXJ0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2xvbmUgQ2xvbmUgdG8gc2FuaXRpemUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzYW5pdGl6ZV9jbG9uZSggY2xvbmUgKSB7XG5cdFx0XHRpZiAoICEgY2xvbmUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNsb25lLnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XG5cdFx0XHRjbG9uZS5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuXHRcdFx0Y2xvbmUucXVlcnlTZWxlY3RvckFsbCggJ1tpZF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBub2RlICkgeyBub2RlLnJlbW92ZUF0dHJpYnV0ZSggJ2lkJyApOyB9ICk7XG5cdFx0XHRjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKCAnW3RhYmluZGV4XSwgYnV0dG9uLCBhLCBpbnB1dCwgc2VsZWN0LCB0ZXh0YXJlYScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIG5vZGUgKSB7XG5cdFx0XHRcdG5vZGUucmVtb3ZlQXR0cmlidXRlKCAndGFiaW5kZXgnICk7XG5cdFx0XHRcdG5vZGUuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcblx0XHRcdFx0aWYgKCAnZGlzYWJsZWQnIGluIG5vZGUgKSB7XG5cdFx0XHRcdFx0bm9kZS5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXRyaWdnZXJdLCBbZGF0YS13cGJjLWJvb2tpbmctb3ZlcnZpZXctaW5mby10cmlnZ2VyXSwgW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLWRldGFpbHMtYWN0aW9uXSwgW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1ob3N0XSwgW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLW1vdmVtZW50LWdyaXBdJyApLmZvckVhY2goIGZ1bmN0aW9uICggbm9kZSApIHtcblx0XHRcdFx0WyAnZGF0YS13cGJjLWJvb2tpbmctaW5zcGVjdG9yLXRyaWdnZXInLCAnZGF0YS13cGJjLWJvb2tpbmctb3ZlcnZpZXctaW5mby10cmlnZ2VyJywgJ2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLWRldGFpbHMtYWN0aW9uJywgJ2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLXJlc2l6ZS1ob3N0JywgJ2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLW1vdmVtZW50LWdyaXAnIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBhdHRyaWJ1dGUgKSB7IG5vZGUucmVtb3ZlQXR0cmlidXRlKCBhdHRyaWJ1dGUgKTsgfSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNhbml0aXplIFNvcnRhYmxlJ3MgbWlycm9yIGNsb25lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGV2ZW50IFNvcnRhYmxlIGNsb25lIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb25fY2xvbmUoIGV2ZW50ICkge1xuXHRcdFx0c2FuaXRpemVfY2xvbmUoIGV2ZW50LmNsb25lICk7XG5cdFx0XHRpZiAoIGV2ZW50LmNsb25lICkge1xuXHRcdFx0XHRldmVudC5jbG9uZS5jbGFzc0xpc3QuYWRkKCAnd3BiY190aW1lbGluZV9ib29raW5nX21vdmVtZW50X19taXJyb3InICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RhcnQgbG9ja3MsIG9yaWdpbiByZXByZXNlbnRhdGlvbiwgdGFyZ2V0cywgYW5kIG93bmVkIGF1dG9zY3JvbGwuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9uX3N0YXJ0KCkge1xuXHRcdFx0aWYgKCAhIGdlc3R1cmUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGdlc3R1cmUuc3RhcnRlZCA9IHRydWU7XG5cdFx0XHRnZXN0dXJlLm9yaWdpbiA9IGdlc3R1cmUuY2FyZC5jbG9uZU5vZGUoIHRydWUgKTtcblx0XHRcdHNhbml0aXplX2Nsb25lKCBnZXN0dXJlLm9yaWdpbiApO1xuXHRcdFx0Z2VzdHVyZS5vcmlnaW4uY2xhc3NMaXN0LmFkZCggJ3dwYmNfdGltZWxpbmVfYm9va2luZ19tb3ZlbWVudF9fb3JpZ2luJyApO1xuXHRcdFx0Z2VzdHVyZS5vcmlnaW4ucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctbW92YWJsZScgKTtcblx0XHRcdGdlc3R1cmUucGFyZW50Lmluc2VydEJlZm9yZSggZ2VzdHVyZS5vcmlnaW4sIGdlc3R1cmUubmV4dCApO1xuXHRcdFx0bW91bnQuY2xhc3NMaXN0LmFkZCggJ2lzLWJvb2tpbmctbW92ZW1lbnQtYWN0aXZlJyApO1xuXHRcdFx0aWYgKCBjYWxsYmFja3Muc2V0X2ludGVyYWN0aW9uX3N1c3BlbmRlZCApIHsgY2FsbGJhY2tzLnNldF9pbnRlcmFjdGlvbl9zdXNwZW5kZWQoIHRydWUsIGdlc3R1cmUuY2FyZCApOyB9XG5cdFx0XHRpZiAoIGNhbGxiYWNrcy5zZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQgKSB7IGNhbGxiYWNrcy5zZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQoIHRydWUgKTsgfVxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJtb3ZlJywgb25fcG9pbnRlcl9tb3ZlLCB0cnVlICk7XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcnVwJywgb25fcG9pbnRlcl9jb21wbGV0aW9uLCB0cnVlICk7XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcmNhbmNlbCcsIG9uX2xvc3RfcG9pbnRlciwgdHJ1ZSApO1xuXHRcdFx0c3RhcnRfYXV0b3Njcm9sbCgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgcm93IGNhcHR1cmVkIGZvciBhIFNvcnRhYmxlIHNlZ21lbnQgaG9zdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBBY3RpdmUgbW92ZW1lbnQgZ2VzdHVyZS5cblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGhvc3QgU29ydGFibGUgZGVzdGluYXRpb24gaG9zdC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ2FwdHVyZWQgcm93IG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jvd19mb3JfaG9zdCggc3RhdGUsIGhvc3QgKSB7XG5cdFx0XHR2YXIgbWF0Y2hlZCA9IG51bGw7XG5cblx0XHRcdGlmICggISBzdGF0ZSB8fCAhIGhvc3QgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUucm93cy5zb21lKCBmdW5jdGlvbiAoIHJvdyApIHtcblx0XHRcdFx0aWYgKCByb3cuaG9zdCA9PT0gaG9zdCApIHtcblx0XHRcdFx0XHRtYXRjaGVkID0gcm93O1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIG1hdGNoZWQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSByb3cgcmVjdGFuZ2xlIGluIGNhcHR1cmVkIG9yIGN1cnJlbnQgdmlld3BvcnQgY29vcmRpbmF0ZXMuXG5cdFx0ICpcblx0XHQgKiBDYXB0dXJlZCBnZW9tZXRyeSBpcyByZWJhc2VkIGJ5IGRvY3VtZW50IGFuZCBUaW1lbGluZS1jYW52YXMgc2Nyb2xsaW5nLlxuXHRcdCAqIEN1cnJlbnQgZ2VvbWV0cnkgaXMgcmVhZCBiYWNrIGZyb20gdGhlIHNhbWUgc3RhYmxlIGhvc3QgaW1tZWRpYXRlbHkgYmVmb3JlXG5cdFx0ICogdXNlLiBBIGRpc2Nvbm5lY3RlZCBvciBjb2xsYXBzZWQgaG9zdCBpcyBub3QgYSB2YWxpZCBkZXN0aW5hdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBBY3RpdmUgbW92ZW1lbnQgZ2VzdHVyZS5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcm93IENhcHR1cmVkIHJvdyByZWNvcmQuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGdlb21ldHJ5IEdlb21ldHJ5IHNvdXJjZTogYGNhcHR1cmVkYCBvciBgY3VycmVudGAuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFZpZXdwb3J0IHJlY3RhbmdsZSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yb3dfcmVjdGFuZ2xlKCBzdGF0ZSwgcm93LCBnZW9tZXRyeSApIHtcblx0XHRcdHZhciByZWN0YW5nbGU7XG5cdFx0XHR2YXIgZG9jdW1lbnRfZGVsdGFfeDtcblx0XHRcdHZhciBkb2N1bWVudF9kZWx0YV95O1xuXHRcdFx0dmFyIGNhbnZhc19kZWx0YV94O1xuXG5cdFx0XHRpZiAoICdjdXJyZW50JyA9PT0gZ2VvbWV0cnkgKSB7XG5cdFx0XHRcdGlmICggISByb3cuaG9zdC5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZWN0YW5nbGUgPSByb3cuaG9zdC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0cmV0dXJuIHJlY3RhbmdsZS5yaWdodCA+IHJlY3RhbmdsZS5sZWZ0ICYmIHJlY3RhbmdsZS5ib3R0b20gPiByZWN0YW5nbGUudG9wID8gcmVjdGFuZ2xlIDogbnVsbDtcblx0XHRcdH1cblx0XHRcdGRvY3VtZW50X2RlbHRhX3ggPSAoIHdpbmRvdy5wYWdlWE9mZnNldCB8fCAwICkgLSBzdGF0ZS5kb2NfeDtcblx0XHRcdGRvY3VtZW50X2RlbHRhX3kgPSAoIHdpbmRvdy5wYWdlWU9mZnNldCB8fCAwICkgLSBzdGF0ZS5kb2NfeTtcblx0XHRcdGNhbnZhc19kZWx0YV94ID0gc3RhdGUuY2FudmFzID8gc3RhdGUuY2FudmFzLnNjcm9sbExlZnQgLSBzdGF0ZS5jYW52YXNfc2Nyb2xsIDogMDtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGVmdDogcm93LmxlZnQgLSBkb2N1bWVudF9kZWx0YV94IC0gY2FudmFzX2RlbHRhX3gsXG5cdFx0XHRcdHJpZ2h0OiByb3cucmlnaHQgLSBkb2N1bWVudF9kZWx0YV94IC0gY2FudmFzX2RlbHRhX3gsXG5cdFx0XHRcdHRvcDogcm93LnRvcCAtIGRvY3VtZW50X2RlbHRhX3ksXG5cdFx0XHRcdGJvdHRvbTogcm93LmJvdHRvbSAtIGRvY3VtZW50X2RlbHRhX3lcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSB2aXNpYmxlIFRpbWVsaW5lIGNhbnZhcyB3aW5kb3cgZm9yIHJvdyBoaXQtdGVzdGluZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBBY3RpdmUgbW92ZW1lbnQgZ2VzdHVyZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZ2VvbWV0cnkgR2VvbWV0cnkgc291cmNlOiBgY2FwdHVyZWRgIG9yIGBjdXJyZW50YC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ2xpcHBlZCB2aWV3cG9ydCByZWN0YW5nbGUgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfY2FudmFzX3dpbmRvdyggc3RhdGUsIGdlb21ldHJ5ICkge1xuXHRcdFx0dmFyIHJlY3RhbmdsZTtcblx0XHRcdHZhciBkb2N1bWVudF9kZWx0YV94O1xuXHRcdFx0dmFyIGRvY3VtZW50X2RlbHRhX3k7XG5cblx0XHRcdGlmICggISBzdGF0ZS5jYW52YXMgfHwgISBzdGF0ZS5jYW52YXNfcmVjdGFuZ2xlICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggJ2N1cnJlbnQnID09PSBnZW9tZXRyeSApIHtcblx0XHRcdFx0cmVjdGFuZ2xlID0gc3RhdGUuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZG9jdW1lbnRfZGVsdGFfeCA9ICggd2luZG93LnBhZ2VYT2Zmc2V0IHx8IDAgKSAtIHN0YXRlLmRvY194O1xuXHRcdFx0XHRkb2N1bWVudF9kZWx0YV95ID0gKCB3aW5kb3cucGFnZVlPZmZzZXQgfHwgMCApIC0gc3RhdGUuZG9jX3k7XG5cdFx0XHRcdHJlY3RhbmdsZSA9IHtcblx0XHRcdFx0XHRsZWZ0OiBzdGF0ZS5jYW52YXNfcmVjdGFuZ2xlLmxlZnQgLSBkb2N1bWVudF9kZWx0YV94LFxuXHRcdFx0XHRcdHJpZ2h0OiBzdGF0ZS5jYW52YXNfcmVjdGFuZ2xlLnJpZ2h0IC0gZG9jdW1lbnRfZGVsdGFfeCxcblx0XHRcdFx0XHR0b3A6IHN0YXRlLmNhbnZhc19yZWN0YW5nbGUudG9wIC0gZG9jdW1lbnRfZGVsdGFfeSxcblx0XHRcdFx0XHRib3R0b206IHN0YXRlLmNhbnZhc19yZWN0YW5nbGUuYm90dG9tIC0gZG9jdW1lbnRfZGVsdGFfeVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsZWZ0OiBNYXRoLm1heCggMCwgcmVjdGFuZ2xlLmxlZnQgKSxcblx0XHRcdFx0cmlnaHQ6IE1hdGgubWluKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGgsIHJlY3RhbmdsZS5yaWdodCApLFxuXHRcdFx0XHR0b3A6IE1hdGgubWF4KCAwLCByZWN0YW5nbGUudG9wICksXG5cdFx0XHRcdGJvdHRvbTogTWF0aC5taW4oIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQsIHJlY3RhbmdsZS5ib3R0b20gKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIG9uZSB1bmlxdWUgbmV1dHJhbCByb3cgY2FuZGlkYXRlIGZyb20gZXhwbGljaXQgZ2VvbWV0cnkuXG5cdFx0ICpcblx0XHQgKiBFcXVhbC1kaXN0YW5jZSBvdmVybGFwcyBhcmUgcmVqZWN0ZWQgaW5zdGVhZCBvZiBiZWluZyByZXNvbHZlZCBieSBET00gb3JkZXIuXG5cdFx0ICogVGhlIHN0YWJsZSByb3cgb3JkZXIgaXMgcmV0YWluZWQgb25seSB0byBtYWtlIGluc3BlY3Rpb24gZGV0ZXJtaW5pc3RpYzsgaXRcblx0XHQgKiBuZXZlciBicmVha3MgYW4gYW1iaWd1b3VzIHRpZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBBY3RpdmUgbW92ZW1lbnQgZ2VzdHVyZS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0geCBWaWV3cG9ydCBYIGNvb3JkaW5hdGUuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHkgVmlld3BvcnQgWSBjb29yZGluYXRlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBnZW9tZXRyeSBHZW9tZXRyeSBzb3VyY2U6IGBjYXB0dXJlZGAgb3IgYGN1cnJlbnRgLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gUmVzb2x1dGlvbiByZWNvcmQgd2l0aCBzdGF0dXMgYW5kIG9wdGlvbmFsIHJvdy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNvbHZlX3Jvdyggc3RhdGUsIHgsIHksIGdlb21ldHJ5ICkge1xuXHRcdFx0dmFyIHRocmVzaG9sZCA9IE51bWJlciggc29ydGFibGVfY29uZmlnLmVtcHR5X2luc2VydF90aHJlc2hvbGQgKSB8fCAxODtcblx0XHRcdHZhciBjYW52YXNfd2luZG93ID0gZ2V0X2NhbnZhc193aW5kb3coIHN0YXRlLCBnZW9tZXRyeSApO1xuXHRcdFx0dmFyIG1hdGNoZXMgPSBbXTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGNhbnZhc193aW5kb3cgfHxcblx0XHRcdFx0eCA8IGNhbnZhc193aW5kb3cubGVmdCB8fCB4ID4gY2FudmFzX3dpbmRvdy5yaWdodCB8fFxuXHRcdFx0XHR5IDwgY2FudmFzX3dpbmRvdy50b3AgfHwgeSA+IGNhbnZhc193aW5kb3cuYm90dG9tXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIHsgc3RhdHVzOiAnb3V0X29mX3dpbmRvdycsIHJvdzogbnVsbCB9O1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUucm93cy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvdyApIHtcblx0XHRcdFx0dmFyIHJlY3RhbmdsZSA9IGdldF9yb3dfcmVjdGFuZ2xlKCBzdGF0ZSwgcm93LCBnZW9tZXRyeSApO1xuXHRcdFx0XHR2YXIgcm93X2Rpc3RhbmNlO1xuXG5cdFx0XHRcdGlmICggISByZWN0YW5nbGUgfHwgeCA8IE1hdGgubWF4KCByZWN0YW5nbGUubGVmdCwgY2FudmFzX3dpbmRvdy5sZWZ0ICkgfHwgeCA+IE1hdGgubWluKCByZWN0YW5nbGUucmlnaHQsIGNhbnZhc193aW5kb3cucmlnaHQgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cm93X2Rpc3RhbmNlID0geSA8IHJlY3RhbmdsZS50b3AgPyByZWN0YW5nbGUudG9wIC0geSA6ICggeSA+IHJlY3RhbmdsZS5ib3R0b20gPyB5IC0gcmVjdGFuZ2xlLmJvdHRvbSA6IDAgKTtcblx0XHRcdFx0aWYgKCByb3dfZGlzdGFuY2UgPD0gdGhyZXNob2xkICkge1xuXHRcdFx0XHRcdG1hdGNoZXMucHVzaCggeyByb3c6IHJvdywgZGlzdGFuY2U6IHJvd19kaXN0YW5jZSB9ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdG1hdGNoZXMuc29ydCggZnVuY3Rpb24gKCBmaXJzdCwgc2Vjb25kICkge1xuXHRcdFx0XHRyZXR1cm4gZmlyc3QuZGlzdGFuY2UgPT09IHNlY29uZC5kaXN0YW5jZVxuXHRcdFx0XHRcdD8gZmlyc3Qucm93Lm9yZGVyIC0gc2Vjb25kLnJvdy5vcmRlclxuXHRcdFx0XHRcdDogZmlyc3QuZGlzdGFuY2UgLSBzZWNvbmQuZGlzdGFuY2U7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICEgbWF0Y2hlcy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiB7IHN0YXR1czogJ25vbmUnLCByb3c6IG51bGwgfTtcblx0XHRcdH1cblx0XHRcdGlmICggMSA8IG1hdGNoZXMubGVuZ3RoICYmIE1hdGguYWJzKCBtYXRjaGVzWzBdLmRpc3RhbmNlIC0gbWF0Y2hlc1sxXS5kaXN0YW5jZSApIDwgMC41ICkge1xuXHRcdFx0XHRyZXR1cm4geyBzdGF0dXM6ICdhbWJpZ3VvdXMnLCByb3c6IG51bGwgfTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHsgc3RhdHVzOiAncmVzb2x2ZWQnLCByb3c6IG1hdGNoZXNbMF0ucm93IH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVmFsaWRhdGUgdGhlIGZyb3plbiBkcm9wIGludGVudCBhZ2FpbnN0IHRoZSBsYXN0IHJlbmRlcmVkIFdQQkMgZ2hvc3QuXG5cdFx0ICpcblx0XHQgKiBUaGUgdmlzaWJsZSBjdXN0b20gZ2hvc3QgaXMgY3JlYXRlZCBiZWZvcmUgU29ydGFibGUgY29tcGxldGlvbiBib29ra2VlcGluZy5cblx0XHQgKiBJdHMgc3RvcmVkIFJlc291cmNlIGlkZW50aXR5IHRoZXJlZm9yZSByZW1haW5zIHN0YWJsZSBldmVuIHdoZW4gU29ydGFibGVcblx0XHQgKiByZXBhcmVudHMgb3IgcmVzdG9yZXMgdGhlIHJlYWwgY2FyZCBiZWZvcmUgaW52b2tpbmcgYG9uRW5kYC4gTm8gdGFyZ2V0XG5cdFx0ICogYXV0aG9yaXphdGlvbiBpcyBpbmZlcnJlZCBieSB0aGlzIGNvbXBhcmlzb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdGUgQ29tcGxldGVkIG1vdmVtZW50IGdlc3R1cmUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFVuaXF1ZSBjYW5kaWRhdGUgcm93IG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzb2x2ZV9kcm9wX2NhbmRpZGF0ZSggc3RhdGUgKSB7XG5cdFx0XHR2YXIgZnJvemVuX3RhcmdldCA9IHN0YXRlLmRyb3BfaW50ZW50XG5cdFx0XHRcdD8gc3RhdGUucm93cy5maWx0ZXIoIGZ1bmN0aW9uICggcm93ICkgeyByZXR1cm4gcm93LnJlc291cmNlX2lkID09PSBzdGF0ZS5kcm9wX2ludGVudC50YXJnZXRfcmVzb3VyY2VfaWQ7IH0gKVswXVxuXHRcdFx0XHQ6IG51bGw7XG5cdFx0XHR2YXIgdmlzdWFsX3RhcmdldCA9IHN0YXRlLmNhbmRpZGF0ZV9naG9zdF9ob3N0XG5cdFx0XHRcdD8gZ2V0X3Jvd19mb3JfaG9zdCggc3RhdGUsIHN0YXRlLmNhbmRpZGF0ZV9naG9zdF9ob3N0IClcblx0XHRcdFx0OiBudWxsO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgZnJvemVuX3RhcmdldCB8fFxuXHRcdFx0XHQhIHZpc3VhbF90YXJnZXQgfHxcblx0XHRcdFx0ISBmcm96ZW5fdGFyZ2V0Lmhvc3QuaXNDb25uZWN0ZWQgfHxcblx0XHRcdFx0dmlzdWFsX3RhcmdldC5yZXNvdXJjZV9pZCAhPT0gZnJvemVuX3RhcmdldC5yZXNvdXJjZV9pZFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZnJvemVuX3RhcmdldDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGcmVlemUgdGhlIFJlc291cmNlIGlkZW50aXR5IGFscmVhZHkgYXR0YWNoZWQgdG8gdGhlIHZpc2libGUgV1BCQyBnaG9zdC5cblx0XHQgKlxuXHRcdCAqIFRoZSB2aXN1YWwgaW50ZW50IGlzIHJlY29yZGVkIGR1cmluZyBwb2ludGVyIG1vdmVtZW50LCB3aGVuIHRoZSBjdXN0b20gZ2hvc3Rcblx0XHQgKiBpcyByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiBvbmx5IHByb21vdGVzIHRoYXQgYWxyZWFkeS1jYXB0dXJlZCBpZGVudGl0eSB0b1xuXHRcdCAqIHRoZSBpbW11dGFibGUgY29tcGxldGlvbiBpbnRlbnQuIEl0IGRlbGliZXJhdGVseSByZWFkcyBubyBwb2ludGVyLWNvbXBsZXRpb25cblx0XHQgKiBjb29yZGluYXRlcyBhbmQgbm8gU29ydGFibGUgYGV2ZW50LnRvYCB2YWx1ZSBiZWNhdXNlIFNvcnRhYmxlIG1heSBwcm9jZXNzIGl0c1xuXHRcdCAqIG93biBlYXJsaWVyLXJlZ2lzdGVyZWQgZG9jdW1lbnQgbGlzdGVuZXIgYmVmb3JlIFdQQkMgcmVjZWl2ZXMgYHBvaW50ZXJ1cGAuXG5cdFx0ICpcblx0XHQgKiBUaGlzIHJlY29yZHMgaW50ZXJhY3Rpb24gaWRlbnRpdHkgb25seS4gSXQgZG9lcyBub3QgYXV0aG9yaXplIHRoZSBSZXNvdXJjZTtcblx0XHQgKiBjYW5vbmljYWwgUmV2aWV3IG11c3Qgc3RpbGwgcmVhdXRob3JpemUgdGhlIHN1Ym1pdHRlZCB0YXJnZXQgc2VydmVyLXNpZGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdGUgQWN0aXZlIG1vdmVtZW50IGdlc3R1cmUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEZyb3plbiB0YXJnZXQgcm93IG9yIG51bGwgd2hlbiByZWNvbmNpbGlhdGlvbiBmYWlscy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmcmVlemVfZHJvcF9pbnRlbnQoIHN0YXRlICkge1xuXHRcdFx0dmFyIHRhcmdldF9yb3c7XG5cblx0XHRcdGlmICggISBzdGF0ZSB8fCBzdGF0ZS5kcm9wX2ludGVudCApIHtcblx0XHRcdFx0cmV0dXJuIHN0YXRlICYmIHN0YXRlLmRyb3BfaW50ZW50XG5cdFx0XHRcdFx0PyBzdGF0ZS5yb3dzLmZpbHRlciggZnVuY3Rpb24gKCByb3cgKSB7IHJldHVybiByb3cucmVzb3VyY2VfaWQgPT09IHN0YXRlLmRyb3BfaW50ZW50LnRhcmdldF9yZXNvdXJjZV9pZDsgfSApWzBdIHx8IG51bGxcblx0XHRcdFx0XHQ6IG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgc3RhdGUuc291cmNlX3JvdyB8fCAhIHN0YXRlLnZpc3VhbF9kcm9wX2ludGVudCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXRfcm93ID0gc3RhdGUucm93cy5maWx0ZXIoIGZ1bmN0aW9uICggcm93ICkge1xuXHRcdFx0XHRyZXR1cm4gcm93LnJlc291cmNlX2lkID09PSBzdGF0ZS52aXN1YWxfZHJvcF9pbnRlbnQudGFyZ2V0X3Jlc291cmNlX2lkO1xuXHRcdFx0fSApWzBdIHx8IG51bGw7XG5cdFx0XHRpZiAoICEgdGFyZ2V0X3JvdyB8fCB0YXJnZXRfcm93Lmhvc3QgIT09IHN0YXRlLnZpc3VhbF9kcm9wX2ludGVudC50YXJnZXRfaG9zdCB8fCAhIHRhcmdldF9yb3cuaG9zdC5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRzdGF0ZS5kcm9wX2ludGVudCA9IHN0YXRlLnZpc3VhbF9kcm9wX2ludGVudDtcblxuXHRcdFx0cmV0dXJuIHRhcmdldF9yb3c7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIHRoZSBwcmVzZW50YXRpb24tb25seSBnaG9zdCBvd25lZCBieSBvbmUgbW92ZW1lbnQgZ2VzdHVyZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBBY3RpdmUgbW92ZW1lbnQgZ2VzdHVyZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX2NhbmRpZGF0ZV9naG9zdCggc3RhdGUgKSB7XG5cdFx0XHRpZiAoICEgc3RhdGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhdGUuY2FuZGlkYXRlX2dob3N0ICkge1xuXHRcdFx0XHRzdGF0ZS5jYW5kaWRhdGVfZ2hvc3QucmVtb3ZlKCk7XG5cdFx0XHR9XG5cdFx0XHRzdGF0ZS5jYW5kaWRhdGVfZ2hvc3QgPSBudWxsO1xuXHRcdFx0c3RhdGUuY2FuZGlkYXRlX2dob3N0X2hvc3QgPSBudWxsO1xuXHRcdFx0c3RhdGUudmlzdWFsX2Ryb3BfaW50ZW50ID0gbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIHNlcnZlci1vd25lZCByZXN0cmljdGlvbiBmb3Igb25lIHZpc2libGUgZGVzdGluYXRpb24gcm93LlxuXHRcdCAqXG5cdFx0ICogQSBtaXNzaW5nIHJlYXNvbiBuZXZlciBtYWtlcyBhbiB1bmF2YWlsYWJsZSBnZXN0dXJlIGVsaWdpYmxlLiBJdCBmYWxscyBiYWNrXG5cdFx0ICogdG8gdGhlIGdlbmVyaWMgb3BlcmF0aW9uIHJlc3RyaWN0aW9uIHNvIHRoZSBleHBsaWNpdCBkcm9wIGNhbiBzdGlsbCBleHBsYWluXG5cdFx0ICogd2h5IHRoZSBjYW5vbmljYWwgY2FyZCByZXR1cm5lZCB0byBpdHMgc2F2ZWQgcG9zaXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdGUgQWN0aXZlIG1vdmVtZW50IGdlc3R1cmUuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gY2FuZGlkYXRlIENhbmRpZGF0ZSBSZXNvdXJjZSByb3cuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTdGFibGUgcmVzdHJpY3Rpb24ga2V5LCBvciBhbiBlbXB0eSBzdHJpbmcgd2hlbiBlbGlnaWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfY2FuZGlkYXRlX3Jlc3RyaWN0aW9uKCBzdGF0ZSwgY2FuZGlkYXRlICkge1xuXHRcdFx0dmFyIG1vdmVtZW50ID0gc3RhdGUgJiYgc3RhdGUucmVjb3JkID8gc3RhdGUucmVjb3JkLmNvbnRleHQgOiBudWxsO1xuXHRcdFx0dmFyIHNvdXJjZV9yZXNvdXJjZV9pZDtcblx0XHRcdHZhciBpc19jcm9zc19yZXNvdXJjZTtcblxuXHRcdFx0aWYgKCAhIG1vdmVtZW50IHx8ICEgY2FuZGlkYXRlICkge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cdFx0XHRzb3VyY2VfcmVzb3VyY2VfaWQgPSBzdGF0ZS5zb3VyY2Vfcm93ID8gTnVtYmVyKCBzdGF0ZS5zb3VyY2Vfcm93LnJlc291cmNlX2lkICkgOiBOdW1iZXIoIHN0YXRlLnJlY29yZC5yZXNvdXJjZV9pZCApO1xuXHRcdFx0aXNfY3Jvc3NfcmVzb3VyY2UgPSBOdW1iZXIoIGNhbmRpZGF0ZS5yZXNvdXJjZV9pZCApICE9PSBzb3VyY2VfcmVzb3VyY2VfaWQ7XG5cdFx0XHRpZiAoIGlzX2Nyb3NzX3Jlc291cmNlICkge1xuXHRcdFx0XHRyZXR1cm4gbW92ZW1lbnQuY3Jvc3NfcmVzb3VyY2VfYXZhaWxhYmxlID8gJycgOiBTdHJpbmcoIG1vdmVtZW50LmNyb3NzX3Jlc291cmNlX3Jlc3RyaWN0aW9uIHx8ICdvcGVyYXRpb25fdW5zdXBwb3J0ZWQnICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBtb3ZlbWVudC5zYW1lX3Jlc291cmNlX2F2YWlsYWJsZSA/ICcnIDogU3RyaW5nKCBtb3ZlbWVudC5zYW1lX3Jlc291cmNlX3Jlc3RyaWN0aW9uIHx8ICdvcGVyYXRpb25fdW5zdXBwb3J0ZWQnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2hvdyBvbmUgYWNjZXNzaWJsZSB3YXJuaW5nIGFmdGVyIGFuIGV4cGxpY2l0bHkgZGVuaWVkIGRlc3RpbmF0aW9uIGRyb3AuXG5cdFx0ICpcblx0XHQgKiBQb2ludGVyIG1vdmVtZW50IHJlbWFpbnMgcXVpZXQgc28gY3Jvc3NpbmcgUmVzb3VyY2Ugcm93cyBjYW5ub3QgY3JlYXRlIGFcblx0XHQgKiBzdHJlYW0gb2YgZ2xvYmFsIG5vdGljZXMuIFRoZSB3YXJuaW5nIGlzIGVtaXR0ZWQgb25seSBhZnRlciB0aGUgdXNlciBkcm9wcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSByZWFzb24gU2VydmVyLW93bmVkIHJlc3RyaWN0aW9uIGtleS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNob3dfZGVzdGluYXRpb25fd2FybmluZyggcmVhc29uICkge1xuXHRcdFx0dmFyIGRlbmlhbF9yZWFzb25zID0gaTE4bi5kZW5pYWxfcmVhc29ucyAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGkxOG4uZGVuaWFsX3JlYXNvbnMgPyBpMThuLmRlbmlhbF9yZWFzb25zIDoge307XG5cdFx0XHR2YXIgbWVzc2FnZSA9IGRlbmlhbF9yZWFzb25zWyByZWFzb24gXSB8fCBpMThuLmRlc3RpbmF0aW9uX3VuYXZhaWxhYmxlIHx8IGkxOG4udW5hdmFpbGFibGUgfHwgJyc7XG5cblx0XHRcdGFubm91bmNlKCBtZXNzYWdlICk7XG5cdFx0XHRpZiAoIG1lc3NhZ2UgJiYgY2FsbGJhY2tzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYWxsYmFja3Muc2hvd19hZG1pbl9tZXNzYWdlICkge1xuXHRcdFx0XHRjYWxsYmFja3Muc2hvd19hZG1pbl9tZXNzYWdlKCBTdHJpbmcoIG1lc3NhZ2UgKSwgJ3dhcm5pbmcnLCA3MDAwICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIHRoZSBuZXV0cmFsIGdob3N0IG9ubHkgaW5zaWRlIHRoZSBzdGFiaWxpemVkIFdQQkMgY2FuZGlkYXRlIHJvdy5cblx0XHQgKlxuXHRcdCAqIEdlb21ldHJ5IGlzIGRlcml2ZWQgZnJvbSB0aGUgY2FwdHVyZWQgY2Fub25pY2FsIGNhcmQgYW5kIHRoZSBzYW1lIHNuYXBwZWRcblx0XHQgKiBheGlzLWNlbGwgZGVsdGEgbGF0ZXIgdXNlZCBieSBwcm9wb3NhbCBjb25zdHJ1Y3Rpb24uIEl0IGNvbW11bmljYXRlcyBvbmx5XG5cdFx0ICogcGxhY2VtZW50IGludGVudDsgdGhlIHNlcnZlciBzdGlsbCBhdXRob3JpemVzIHRoZSBSZXNvdXJjZSBhbmQgc2NoZWR1bGUuXG5cdFx0ICogQ3Jvc3MtUmVzb3VyY2UgZmVlZGJhY2sgdXNlcyB0aGUgbmV1dHJhbCBmaXJzdCBsYW5lIGJlY2F1c2UgY29weWluZyBhXG5cdFx0ICogZGVlcGVyIHNvdXJjZSBsYW5lIGNvdWxkIHBhaW50IG91dHNpZGUgYSBzaG9ydGVyIGNhbmRpZGF0ZSBSZXNvdXJjZSByb3cuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdGUgQWN0aXZlIG1vdmVtZW50IGdlc3R1cmUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfY2FuZGlkYXRlX2dob3N0KCBzdGF0ZSApIHtcblx0XHRcdHZhciByZW5kZXJlcjtcblx0XHRcdHZhciBidWZmZXI7XG5cdFx0XHR2YXIgYXhpc19kZWx0YTtcblx0XHRcdHZhciBjYW5kaWRhdGVfdG9wO1xuXHRcdFx0dmFyIHBoeXNpY2FsX2RlbHRhO1xuXG5cdFx0XHRpZiAoICEgc3RhdGUgfHwgISBzdGF0ZS5jYW5kaWRhdGUgfHwgISBzdGF0ZS5heGlzLmNlbGxzLmxlbmd0aCB8fCBnZXRfY2FuZGlkYXRlX3Jlc3RyaWN0aW9uKCBzdGF0ZSwgc3RhdGUuY2FuZGlkYXRlICkgKSB7XG5cdFx0XHRcdGNsZWFyX2NhbmRpZGF0ZV9naG9zdCggc3RhdGUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXhpc19kZWx0YSA9IGdldF9wb2ludGVyX2F4aXNfZGVsdGEoIHN0YXRlICk7XG5cdFx0XHRpZiAoICEgYXhpc19kZWx0YSB8fCAhIGhhc19tZWFuaW5nZnVsX21vdmVtZW50KCBzdGF0ZSwgYXhpc19kZWx0YSApICkge1xuXHRcdFx0XHRjbGVhcl9jYW5kaWRhdGVfZ2hvc3QoIHN0YXRlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBzdGF0ZS5jYW5kaWRhdGVfZ2hvc3QgfHwgc3RhdGUuY2FuZGlkYXRlX2dob3N0X2hvc3QgIT09IHN0YXRlLmNhbmRpZGF0ZS5ob3N0ICkge1xuXHRcdFx0XHRjbGVhcl9jYW5kaWRhdGVfZ2hvc3QoIHN0YXRlICk7XG5cdFx0XHRcdHJlbmRlcmVyID0gdGVtcGxhdGUoIHRlbXBsYXRlcy5naG9zdCApO1xuXHRcdFx0XHRidWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdFx0XHRpZiAoICEgcmVuZGVyZXIgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJ1ZmZlci5pbm5lckhUTUwgPSByZW5kZXJlciggc3RhdGUuZ2hvc3RfZGF0YSApO1xuXHRcdFx0XHRzdGF0ZS5jYW5kaWRhdGVfZ2hvc3QgPSBidWZmZXIuZmlyc3RFbGVtZW50Q2hpbGQ7XG5cdFx0XHRcdGlmICggISBzdGF0ZS5jYW5kaWRhdGVfZ2hvc3QgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXRlLmNhbmRpZGF0ZV9naG9zdF9ob3N0ID0gc3RhdGUuY2FuZGlkYXRlLmhvc3Q7XG5cdFx0XHRcdGNhbmRpZGF0ZV90b3AgPSBzdGF0ZS5jYW5kaWRhdGUucmVzb3VyY2VfaWQgPT09IHN0YXRlLnJlY29yZC5yZXNvdXJjZV9pZFxuXHRcdFx0XHRcdD8gc3RhdGUuY2FyZC5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCAndG9wJyApXG5cdFx0XHRcdFx0OiAndmFyKC0td3BiY190aW1lbGluZV9nZW5lcmFsX19ib29raW5nLWxhbmUtb2Zmc2V0KSc7XG5cdFx0XHRcdHN0YXRlLmNhbmRpZGF0ZV9naG9zdC5zdHlsZS5zZXRQcm9wZXJ0eSggJ2luc2V0LWlubGluZS1zdGFydCcsIHN0YXRlLmNhcmQuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSggJ2luc2V0LWlubGluZS1zdGFydCcgKSApO1xuXHRcdFx0XHRzdGF0ZS5jYW5kaWRhdGVfZ2hvc3Quc3R5bGUuc2V0UHJvcGVydHkoICd3aWR0aCcsIHN0YXRlLmNhcmQuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSggJ3dpZHRoJyApICk7XG5cdFx0XHRcdHN0YXRlLmNhbmRpZGF0ZV9naG9zdC5zdHlsZS5zZXRQcm9wZXJ0eSggJ3RvcCcsIGNhbmRpZGF0ZV90b3AgKTtcblx0XHRcdFx0c3RhdGUuY2FuZGlkYXRlX2dob3N0X2hvc3QuYXBwZW5kQ2hpbGQoIHN0YXRlLmNhbmRpZGF0ZV9naG9zdCApO1xuXHRcdFx0fVxuXHRcdFx0cGh5c2ljYWxfZGVsdGEgPSAnZnVsbF9kYXknID09PSBzdGF0ZS5yZWNvcmQuY29udGV4dC50aW1lX2FwcGxpY2F0aW9uXG5cdFx0XHRcdD8gYXhpc19kZWx0YS5jYWxlbmRhcl9waHlzaWNhbF9kZWx0YV9waXhlbHNcblx0XHRcdFx0OiBheGlzX2RlbHRhLnBoeXNpY2FsX2RlbHRhX3BpeGVscztcblx0XHRcdHN0YXRlLmNhbmRpZGF0ZV9naG9zdC5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlM2QoJyArIHBoeXNpY2FsX2RlbHRhICsgJ3B4LCAwLCAwKSc7XG5cdFx0XHRzdGF0ZS52aXN1YWxfZHJvcF9pbnRlbnQgPSBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdHNvdXJjZV9yZXNvdXJjZV9pZDogTnVtYmVyKCBzdGF0ZS5zb3VyY2Vfcm93ID8gc3RhdGUuc291cmNlX3Jvdy5yZXNvdXJjZV9pZCA6IHN0YXRlLnJlY29yZC5yZXNvdXJjZV9pZCApLFxuXHRcdFx0XHR0YXJnZXRfcmVzb3VyY2VfaWQ6IE51bWJlciggc3RhdGUuY2FuZGlkYXRlLnJlc291cmNlX2lkICksXG5cdFx0XHRcdHRhcmdldF9ob3N0OiBzdGF0ZS5jYW5kaWRhdGVfZ2hvc3RfaG9zdFxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN0YWJpbGl6ZSBuZXV0cmFsIGNhbmRpZGF0ZSBmZWVkYmFjayB3aXRob3V0IGNsYWltaW5nIGF1dGhvcml6YXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHJvdy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHN0YWJpbGl6ZV9jYW5kaWRhdGUoIGNhbmRpZGF0ZSApIHtcblx0XHRcdHZhciBub3cgPSB3aW5kb3cucGVyZm9ybWFuY2Uubm93KCk7XG5cdFx0XHR2YXIgbW92ZWQgPSBNYXRoLmh5cG90KCBnZXN0dXJlLnggLSBnZXN0dXJlLnN0YXJ0X3gsIGdlc3R1cmUueSAtIGdlc3R1cmUuc3RhcnRfeSApO1xuXHRcdFx0dmFyIHJlc3RyaWN0aW9uO1xuXG5cdFx0XHRpZiAoIG1vdmVkIDwgKCBOdW1iZXIoIHNvcnRhYmxlX2NvbmZpZy5kZWxpYmVyYXRlX21vdmVtZW50X3BpeGVscyApIHx8IDYgKSApIHsgY2FuZGlkYXRlID0gbnVsbDsgfVxuXHRcdFx0aWYgKCBjYW5kaWRhdGUgIT09IGdlc3R1cmUucGVuZGluZ19jYW5kaWRhdGUgKSB7XG5cdFx0XHRcdGdlc3R1cmUucGVuZGluZ19jYW5kaWRhdGUgPSBjYW5kaWRhdGU7XG5cdFx0XHRcdGdlc3R1cmUuY2FuZGlkYXRlX3NpbmNlID0gbm93O1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIG5vdyAtIGdlc3R1cmUuY2FuZGlkYXRlX3NpbmNlIDwgKCBOdW1iZXIoIHNvcnRhYmxlX2NvbmZpZy5jYW5kaWRhdGVfZHdlbGxfbWlsbGlzZWNvbmRzICkgfHwgOTAgKSB8fCBjYW5kaWRhdGUgPT09IGdlc3R1cmUuY2FuZGlkYXRlICkgeyByZXR1cm47IH1cblx0XHRcdGlmICggZ2VzdHVyZS5jYW5kaWRhdGUgKSB7IGdlc3R1cmUuY2FuZGlkYXRlLmhvc3QuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWJvb2tpbmctbW92ZW1lbnQtY2FuZGlkYXRlJyApOyB9XG5cdFx0XHRjbGVhcl9jYW5kaWRhdGVfZ2hvc3QoIGdlc3R1cmUgKTtcblx0XHRcdGdlc3R1cmUuY2FuZGlkYXRlID0gY2FuZGlkYXRlO1xuXHRcdFx0aWYgKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdHJlc3RyaWN0aW9uID0gZ2V0X2NhbmRpZGF0ZV9yZXN0cmljdGlvbiggZ2VzdHVyZSwgY2FuZGlkYXRlICk7XG5cdFx0XHRcdGlmICggISByZXN0cmljdGlvbiApIHtcblx0XHRcdFx0XHRjYW5kaWRhdGUuaG9zdC5jbGFzc0xpc3QuYWRkKCAnaXMtYm9va2luZy1tb3ZlbWVudC1jYW5kaWRhdGUnICk7XG5cdFx0XHRcdFx0YW5ub3VuY2UoIFN0cmluZyggaTE4bi5jYW5kaWRhdGVfdGFyZ2V0IHx8ICcnICkucmVwbGFjZSggJyVzJywgU3RyaW5nKCBjYW5kaWRhdGUucmVzb3VyY2VfaWQgKSApICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHVwZGF0ZV9jYW5kaWRhdGVfZ2hvc3QoIGdlc3R1cmUgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWNvcmQgcG9pbnRlciBnZW9tZXRyeSBvbmx5OyBuZXZlciByZXF1ZXN0IG9yIGF1dGhvcml6ZSBpbiBvbk1vdmUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge1BvaW50ZXJFdmVudH0gZXZlbnQgUG9pbnRlci1tb3ZlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb25fcG9pbnRlcl9tb3ZlKCBldmVudCApIHtcblx0XHRcdHZhciByZXNvbHV0aW9uO1xuXG5cdFx0XHRpZiAoIGdlc3R1cmUgKSB7XG5cdFx0XHRcdGdlc3R1cmUueCA9IE51bWJlciggZXZlbnQuY2xpZW50WCApOyBnZXN0dXJlLnkgPSBOdW1iZXIoIGV2ZW50LmNsaWVudFkgKTtcblx0XHRcdFx0cmVzb2x1dGlvbiA9IHJlc29sdmVfcm93KCBnZXN0dXJlLCBnZXN0dXJlLngsIGdlc3R1cmUueSwgJ2N1cnJlbnQnICk7XG5cdFx0XHRcdHN0YWJpbGl6ZV9jYW5kaWRhdGUoICdyZXNvbHZlZCcgPT09IHJlc29sdXRpb24uc3RhdHVzID8gcmVzb2x1dGlvbi5yb3cgOiBudWxsICk7XG5cdFx0XHRcdHVwZGF0ZV9jYW5kaWRhdGVfZ2hvc3QoIGdlc3R1cmUgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNaXJyb3IgU29ydGFibGUgbW92ZSBldmVudHMgaW50byB0aGUgZGV0ZXJtaW5pc3RpYyBoaXQgdGVzdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBldmVudCBTb3J0YWJsZSBtb3ZlIGV2ZW50LlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IG9yaWdpbmFsX2V2ZW50IE9yaWdpbmFsIGlucHV0IGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgU29ydGFibGUgbWF5IHRyYWNrIHRoZSByZWNvbmNpbGVkIHJvdyBkZXN0aW5hdGlvbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvbl9tb3ZlKCBldmVudCwgb3JpZ2luYWxfZXZlbnQgKSB7XG5cdFx0XHR2YXIgcG9pbnRlciA9IG9yaWdpbmFsX2V2ZW50IHx8IGV2ZW50Lm9yaWdpbmFsRXZlbnQ7XG5cdFx0XHR2YXIgcmVzb2x1dGlvbjtcblx0XHRcdHZhciBzb3J0YWJsZV9kZXN0aW5hdGlvbjtcblx0XHRcdGlmICggZ2VzdHVyZSAmJiBwb2ludGVyICYmIE51bWJlci5pc0Zpbml0ZSggTnVtYmVyKCBwb2ludGVyLmNsaWVudFggKSApICkge1xuXHRcdFx0XHRnZXN0dXJlLnggPSBOdW1iZXIoIHBvaW50ZXIuY2xpZW50WCApOyBnZXN0dXJlLnkgPSBOdW1iZXIoIHBvaW50ZXIuY2xpZW50WSApO1xuXHRcdFx0XHRyZXNvbHV0aW9uID0gcmVzb2x2ZV9yb3coIGdlc3R1cmUsIGdlc3R1cmUueCwgZ2VzdHVyZS55LCAnY3VycmVudCcgKTtcblx0XHRcdFx0c29ydGFibGVfZGVzdGluYXRpb24gPSBnZXRfcm93X2Zvcl9ob3N0KCBnZXN0dXJlLCBldmVudC50byApO1xuXHRcdFx0XHRnZXN0dXJlLnNvcnRhYmxlX2Rlc3RpbmF0aW9uID0gc29ydGFibGVfZGVzdGluYXRpb247XG5cdFx0XHRcdGlmICggJ3Jlc29sdmVkJyAhPT0gcmVzb2x1dGlvbi5zdGF0dXMgfHwgISBzb3J0YWJsZV9kZXN0aW5hdGlvbiB8fCByZXNvbHV0aW9uLnJvdy5yZXNvdXJjZV9pZCAhPT0gc29ydGFibGVfZGVzdGluYXRpb24ucmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0c3RhYmlsaXplX2NhbmRpZGF0ZSggbnVsbCApO1xuXHRcdFx0XHRcdHVwZGF0ZV9jYW5kaWRhdGVfZ2hvc3QoIGdlc3R1cmUgKTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RhYmlsaXplX2NhbmRpZGF0ZSggcmVzb2x1dGlvbi5yb3cgKTtcblx0XHRcdFx0dXBkYXRlX2NhbmRpZGF0ZV9naG9zdCggZ2VzdHVyZSApO1xuXHRcdFx0XHRyZXR1cm4gISBnZXRfY2FuZGlkYXRlX3Jlc3RyaWN0aW9uKCBnZXN0dXJlLCByZXNvbHV0aW9uLnJvdyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8qKiBSdW4gb3duZWQgZHVhbC1heGlzIGF1dG9zY3JvbGwuIEByZXR1cm4ge3ZvaWR9ICovXG5cdFx0ZnVuY3Rpb24gYXV0b3Njcm9sbCgpIHtcblx0XHRcdHZhciBlZGdlID0gTnVtYmVyKCBzb3J0YWJsZV9jb25maWcuYXV0b3Njcm9sbF9lZGdlX3BpeGVscyApIHx8IDQ4O1xuXHRcdFx0dmFyIG1heGltdW0gPSBOdW1iZXIoIHNvcnRhYmxlX2NvbmZpZy5hdXRvc2Nyb2xsX21heF9waXhlbHMgKSB8fCAxODtcblx0XHRcdHZhciByZWN0YW5nbGU7XG5cdFx0XHR2YXIgZGVsdGEgPSAwO1xuXG5cdFx0XHRzY3JvbGxfZnJhbWUgPSAwO1xuXHRcdFx0aWYgKCAhIGdlc3R1cmUgfHwgISBnZXN0dXJlLnN0YXJ0ZWQgKSB7IHJldHVybjsgfVxuXHRcdFx0aWYgKCBnZXN0dXJlLmNhbnZhcyApIHtcblx0XHRcdFx0cmVjdGFuZ2xlID0gZ2VzdHVyZS5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdGlmICggZ2VzdHVyZS54IDwgcmVjdGFuZ2xlLmxlZnQgKyBlZGdlICkgeyBkZWx0YSA9IC1tYXhpbXVtOyB9XG5cdFx0XHRcdGlmICggZ2VzdHVyZS54ID4gcmVjdGFuZ2xlLnJpZ2h0IC0gZWRnZSApIHsgZGVsdGEgPSBtYXhpbXVtOyB9XG5cdFx0XHRcdGdlc3R1cmUuY2FudmFzLnNjcm9sbExlZnQgKz0gZGVsdGE7XG5cdFx0XHR9XG5cdFx0XHRkZWx0YSA9IGdlc3R1cmUueSA8IGVkZ2UgPyAtbWF4aW11bSA6ICggZ2VzdHVyZS55ID4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCAtIGVkZ2UgPyBtYXhpbXVtIDogMCApO1xuXHRcdFx0aWYgKCBkZWx0YSApIHsgd2luZG93LnNjcm9sbEJ5KCAwLCBkZWx0YSApOyB9XG5cdFx0XHRzY3JvbGxfZnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBhdXRvc2Nyb2xsICk7XG5cdFx0fVxuXG5cdFx0LyoqIFN0YXJ0IHRoZSBtb3ZlbWVudC1vd25lZCBhdXRvc2Nyb2xsIGxvb3AuIEByZXR1cm4ge3ZvaWR9ICovXG5cdFx0ZnVuY3Rpb24gc3RhcnRfYXV0b3Njcm9sbCgpIHtcblx0XHRcdGlmICggISBzY3JvbGxfZnJhbWUgKSB7IHNjcm9sbF9mcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGF1dG9zY3JvbGwgKTsgfVxuXHRcdH1cblxuXHRcdC8qKiBTdG9wIHRoZSBtb3ZlbWVudC1vd25lZCBhdXRvc2Nyb2xsIGxvb3AuIEByZXR1cm4ge3ZvaWR9ICovXG5cdFx0ZnVuY3Rpb24gc3RvcF9hdXRvc2Nyb2xsKCkge1xuXHRcdFx0aWYgKCBzY3JvbGxfZnJhbWUgKSB7IHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggc2Nyb2xsX2ZyYW1lICk7IHNjcm9sbF9mcmFtZSA9IDA7IH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIHRoZSByZWFsIGNhcmQgdG8gaXRzIGNhcHR1cmVkIERPTSBwb3NpdGlvbiBhbmQgYXR0cmlidXRlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBDYXB0dXJlZCBnZXN0dXJlIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzdG9yZV9jYXJkKCBzdGF0ZSApIHtcblx0XHRcdHN0YXRlLnBhcmVudC5pbnNlcnRCZWZvcmUoIHN0YXRlLmNhcmQsIHN0YXRlLm5leHQgKTtcblx0XHRcdGlmICggbnVsbCA9PT0gc3RhdGUuc3R5bGUgKSB7IHN0YXRlLmNhcmQucmVtb3ZlQXR0cmlidXRlKCAnc3R5bGUnICk7IH0gZWxzZSB7IHN0YXRlLmNhcmQuc2V0QXR0cmlidXRlKCAnc3R5bGUnLCBzdGF0ZS5zdHlsZSApOyB9XG5cdFx0XHRzdGF0ZS5jYXJkLnNldEF0dHJpYnV0ZSggJ2NsYXNzJywgc3RhdGUuY2xhc3NfbmFtZSApO1xuXHRcdFx0aWYgKCBzdGF0ZS5vcmlnaW4gKSB7IHN0YXRlLm9yaWdpbi5yZW1vdmUoKTsgc3RhdGUub3JpZ2luID0gbnVsbDsgfVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbGVhc2UgZXZlcnkgdGVtcG9yYXJ5IHRhcmdldCwgbGlzdGVuZXIsIG1pcnJvciwgYW5kIGludGVyYWN0aW9uIGxvY2suXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdGUgQ2FwdHVyZWQgZ2VzdHVyZSBzdGF0ZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbGVhc2UoIHN0YXRlICkge1xuXHRcdFx0c3RvcF9hdXRvc2Nyb2xsKCk7XG5cdFx0XHRjbGVhcl9jYW5kaWRhdGVfZ2hvc3QoIHN0YXRlICk7XG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcm1vdmUnLCBvbl9wb2ludGVyX21vdmUsIHRydWUgKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVydXAnLCBvbl9wb2ludGVyX2NvbXBsZXRpb24sIHRydWUgKTtcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyY2FuY2VsJywgb25fbG9zdF9wb2ludGVyLCB0cnVlICk7XG5cdFx0XHRtb3VudC5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYm9va2luZy1tb3ZlbWVudC1hY3RpdmUnICk7XG5cdFx0XHRtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnLmlzLWJvb2tpbmctbW92ZW1lbnQtY2FuZGlkYXRlJyApLmZvckVhY2goIGZ1bmN0aW9uICggbm9kZSApIHsgbm9kZS5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYm9va2luZy1tb3ZlbWVudC1jYW5kaWRhdGUnICk7IH0gKTtcblx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY190aW1lbGluZV9ib29raW5nX21vdmVtZW50X19zb3J0YWJsZS1mYWxsYmFjaywgLndwYmNfdGltZWxpbmVfYm9va2luZ19tb3ZlbWVudF9fbWlycm9yJyApLmZvckVhY2goIGZ1bmN0aW9uICggbm9kZSApIHtcblx0XHRcdFx0aWYgKCBub2RlICE9PSBzdGF0ZS5jYXJkICkgeyBub2RlLnJlbW92ZSgpOyB9XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGNhbGxiYWNrcy5zZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQgKSB7IGNhbGxiYWNrcy5zZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQoIGZhbHNlICk7IH1cblx0XHRcdGlmICggY2FsbGJhY2tzLnNldF9pbnRlcmFjdGlvbl9zdXNwZW5kZWQgKSB7IGNhbGxiYWNrcy5zZXRfaW50ZXJhY3Rpb25fc3VzcGVuZGVkKCBmYWxzZSwgc3RhdGUuY2FyZCApOyB9XG5cdFx0XHRwZW5kaW5nX3BvaW50ZXIgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY2xhbXBlZCBheGlzIGNlbGwgdW5kZXIgb25lIHBoeXNpY2FsIGNvb3JkaW5hdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYXhpcyBDYXB0dXJlZCBheGlzLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSB4IFZpZXdwb3J0IFggY29vcmRpbmF0ZS5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IEF4aXMtY2VsbCBpbmRleC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjZWxsX2luZGV4KCBheGlzLCB4ICkge1xuXHRcdFx0dmFyIGZvdW5kID0gLTE7XG5cdFx0XHRheGlzLmNlbGxzLnNvbWUoIGZ1bmN0aW9uICggY2VsbCwgaW5kZXggKSB7XG5cdFx0XHRcdGlmICggeCA+PSBjZWxsLmxlZnQgJiYgeCA8PSBjZWxsLnJpZ2h0ICkgeyBmb3VuZCA9IGluZGV4OyByZXR1cm4gdHJ1ZTsgfVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIC0xICE9PSBmb3VuZCApIHsgcmV0dXJuIGZvdW5kOyB9XG5cdFx0XHRpZiAoIGF4aXMuaXNfcnRsICkgeyByZXR1cm4geCA+IGF4aXMuY2VsbHNbMF0ucmlnaHQgPyAwIDogYXhpcy5jZWxscy5sZW5ndGggLSAxOyB9XG5cdFx0XHRyZXR1cm4geCA8IGF4aXMuY2VsbHNbMF0ubGVmdCA/IDAgOiBheGlzLmNlbGxzLmxlbmd0aCAtIDE7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzaWduZWQgd2hvbGUtZGF5IGRpc3RhbmNlIGJldHdlZW4gc3RyaWN0IElTTyBjYWxlbmRhciBkYXRlcy5cblx0XHQgKlxuXHRcdCAqIEF4aXMgY2VsbHMgYXQgaG91ciBhbmQgbWludXRlIHNjYWxlcyBzaGFyZSB0aGUgc2FtZSBzaXRlLWxvY2FsIGRhdGUuIFVzaW5nXG5cdFx0ICogdGhpcyB2YWx1ZSBwcmV2ZW50cyBvbmUgc3ViLWRheSBjZWxsIGZyb20gYmVjb21pbmcgYSBvbmUtZGF5IGZ1bGwtZGF5IG1vdmUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc291cmNlX2RhdGUgU291cmNlIElTTyBkYXRlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0YXJnZXRfZGF0ZSBUYXJnZXQgSVNPIGRhdGUuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfG51bGx9IFNpZ25lZCBjYWxlbmRhci1kYXkgZGlzdGFuY2UsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2FsZW5kYXJfZGF5X2RlbHRhKCBzb3VyY2VfZGF0ZSwgdGFyZ2V0X2RhdGUgKSB7XG5cdFx0XHR2YXIgc291cmNlX21hdGNoID0gU3RyaW5nKCBzb3VyY2VfZGF0ZSApLm1hdGNoKCAvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pJC8gKTtcblx0XHRcdHZhciB0YXJnZXRfbWF0Y2ggPSBTdHJpbmcoIHRhcmdldF9kYXRlICkubWF0Y2goIC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkkLyApO1xuXHRcdFx0dmFyIHNvdXJjZV9lcG9jaDtcblx0XHRcdHZhciB0YXJnZXRfZXBvY2g7XG5cblx0XHRcdGlmICggISBzb3VyY2VfbWF0Y2ggfHwgISB0YXJnZXRfbWF0Y2ggKSB7IHJldHVybiBudWxsOyB9XG5cdFx0XHRzb3VyY2VfZXBvY2ggPSBEYXRlLlVUQyggTnVtYmVyKCBzb3VyY2VfbWF0Y2hbMV0gKSwgTnVtYmVyKCBzb3VyY2VfbWF0Y2hbMl0gKSAtIDEsIE51bWJlciggc291cmNlX21hdGNoWzNdICkgKTtcblx0XHRcdHRhcmdldF9lcG9jaCA9IERhdGUuVVRDKCBOdW1iZXIoIHRhcmdldF9tYXRjaFsxXSApLCBOdW1iZXIoIHRhcmdldF9tYXRjaFsyXSApIC0gMSwgTnVtYmVyKCB0YXJnZXRfbWF0Y2hbM10gKSApO1xuXG5cdFx0XHRyZXR1cm4gTWF0aC5yb3VuZCggKCB0YXJnZXRfZXBvY2ggLSBzb3VyY2VfZXBvY2ggKSAvIDg2NDAwMDAwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBmaXJzdCBjYXB0dXJlZCBheGlzIGNlbGwgZm9yIG9uZSBzaXRlLWxvY2FsIGRhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYXhpcyBDYXB0dXJlZCBUaW1lbGluZSBheGlzLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkYXRlIElTTyBjYWxlbmRhciBkYXRlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gQ2VsbCBpbmRleCwgb3IgLTEgd2hlbiBhYnNlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZmlyc3RfZGF0ZV9jZWxsX2luZGV4KCBheGlzLCBkYXRlICkge1xuXHRcdFx0dmFyIGZvdW5kID0gLTE7XG5cblx0XHRcdGF4aXMuY2VsbHMuc29tZSggZnVuY3Rpb24gKCBjZWxsLCBpbmRleCApIHtcblx0XHRcdFx0aWYgKCBkYXRlID09PSBjZWxsLmRhdGUgKSB7XG5cdFx0XHRcdFx0Zm91bmQgPSBpbmRleDtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBmb3VuZDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb252ZXJ0IHBoeXNpY2FsIHBvaW50ZXIgbW92ZW1lbnQgaW50byBvbmUgaW1tdXRhYmxlIFRpbWVsaW5lLWF4aXMgZGVsdGEuXG5cdFx0ICpcblx0XHQgKiBUaGUgcG9pbnRlciBzdGFydCBhbmQgY3VycmVudCBwb2ludGVyIHBvc2l0aW9uIGFyZSBib3RoIHJlc29sdmVkIGFnYWluc3Rcblx0XHQgKiB0aGUgY2FwdHVyZWQgYXhpcy4gVGhpcyBkZWxpYmVyYXRlbHkgaWdub3JlcyBTb3J0YWJsZSBsaXN0IGluZGV4ZXMgYW5kIHRoZVxuXHRcdCAqIHJlbmRlcmVkIGNhcmQgb3JpZ2luLCB3aGljaCBtYXkgcmVwcmVzZW50IG9ubHkgYSBjbGlwcGVkIHNjaGVkdWxlIHNlZ21lbnQuXG5cdFx0ICogQ2FudmFzIHNjcm9sbGluZyBpcyByZWJhc2VkIGludG8gdGhlIGNhcHR1cmVkIGNvb3JkaW5hdGUgc3BhY2Ugc28gdGhlIHNhbWVcblx0XHQgKiBkZWx0YSBkcml2ZXMgYm90aCB0aGUgZGVzdGluYXRpb24gZ2hvc3QgYW5kIHRoZSBjYW5vbmljYWwgc2NoZWR1bGUgc2VlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBDYXB0dXJlZCBnZXN0dXJlIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBTbmFwcGVkIGNlbGwsIGluc3RhbnQsIGFuZCBwaHlzaWNhbCBkZWx0YXMsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3BvaW50ZXJfYXhpc19kZWx0YSggc3RhdGUgKSB7XG5cdFx0XHR2YXIgc291cmNlX2luZGV4O1xuXHRcdFx0dmFyIHRhcmdldF9pbmRleDtcblx0XHRcdHZhciB0YXJnZXRfeDtcblx0XHRcdHZhciBkYXlfZGVsdGE7XG5cdFx0XHR2YXIgc291cmNlX2RheV9pbmRleDtcblx0XHRcdHZhciB0YXJnZXRfZGF5X2luZGV4O1xuXG5cdFx0XHRpZiAoICEgc3RhdGUgfHwgISBzdGF0ZS5heGlzIHx8ICEgc3RhdGUuYXhpcy5jZWxscy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0c291cmNlX2luZGV4ID0gY2VsbF9pbmRleCggc3RhdGUuYXhpcywgc3RhdGUuc3RhcnRfeCApO1xuXHRcdFx0dGFyZ2V0X3ggPSBzdGF0ZS54ICsgKCBzdGF0ZS5jYW52YXMgPyBzdGF0ZS5jYW52YXMuc2Nyb2xsTGVmdCAtIHN0YXRlLmNhbnZhc19zY3JvbGwgOiAwICk7XG5cdFx0XHR0YXJnZXRfaW5kZXggPSBjZWxsX2luZGV4KCBzdGF0ZS5heGlzLCB0YXJnZXRfeCApO1xuXHRcdFx0ZGF5X2RlbHRhID0gY2FsZW5kYXJfZGF5X2RlbHRhKCBzdGF0ZS5heGlzLmNlbGxzW3NvdXJjZV9pbmRleF0uZGF0ZSwgc3RhdGUuYXhpcy5jZWxsc1t0YXJnZXRfaW5kZXhdLmRhdGUgKTtcblx0XHRcdHNvdXJjZV9kYXlfaW5kZXggPSBmaXJzdF9kYXRlX2NlbGxfaW5kZXgoIHN0YXRlLmF4aXMsIHN0YXRlLmF4aXMuY2VsbHNbc291cmNlX2luZGV4XS5kYXRlICk7XG5cdFx0XHR0YXJnZXRfZGF5X2luZGV4ID0gZmlyc3RfZGF0ZV9jZWxsX2luZGV4KCBzdGF0ZS5heGlzLCBzdGF0ZS5heGlzLmNlbGxzW3RhcmdldF9pbmRleF0uZGF0ZSApO1xuXHRcdFx0aWYgKCBudWxsID09PSBkYXlfZGVsdGEgfHwgMCA+IHNvdXJjZV9kYXlfaW5kZXggfHwgMCA+IHRhcmdldF9kYXlfaW5kZXggKSB7IHJldHVybiBudWxsOyB9XG5cblx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdHNvdXJjZV9pbmRleDogc291cmNlX2luZGV4LFxuXHRcdFx0XHR0YXJnZXRfaW5kZXg6IHRhcmdldF9pbmRleCxcblx0XHRcdFx0Y2VsbF9kZWx0YTogdGFyZ2V0X2luZGV4IC0gc291cmNlX2luZGV4LFxuXHRcdFx0XHRjYWxlbmRhcl9kYXlfZGVsdGE6IGRheV9kZWx0YSxcblx0XHRcdFx0LyogVGltZWxpbmUgYXhpcyBlcG9jaHMgYXJlIFVuaXggc2Vjb25kczsgYnJvd3NlciBEYXRlIHRpbWVzdGFtcHMgYXJlIG1pbGxpc2Vjb25kcy4gKi9cblx0XHRcdFx0aW5zdGFudF9kZWx0YV9taWxsaXNlY29uZHM6IDEwMDAgKiAoIHN0YXRlLmF4aXMuY2VsbHNbdGFyZ2V0X2luZGV4XS5zdGFydF9lcG9jaCAtIHN0YXRlLmF4aXMuY2VsbHNbc291cmNlX2luZGV4XS5zdGFydF9lcG9jaCApLFxuXHRcdFx0XHRjYWxlbmRhcl9waHlzaWNhbF9kZWx0YV9waXhlbHM6IHN0YXRlLmF4aXMuY2VsbHNbdGFyZ2V0X2RheV9pbmRleF0ubGVmdCAtIHN0YXRlLmF4aXMuY2VsbHNbc291cmNlX2RheV9pbmRleF0ubGVmdCxcblx0XHRcdFx0cGh5c2ljYWxfZGVsdGFfcGl4ZWxzOiBzdGF0ZS5heGlzLmNlbGxzW3RhcmdldF9pbmRleF0ubGVmdCAtIHN0YXRlLmF4aXMuY2VsbHNbc291cmNlX2luZGV4XS5sZWZ0XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogV2hldGhlciBhIHNuYXBwZWQgcG9pbnRlciBkZXN0aW5hdGlvbiBjaGFuZ2VzIGRhdGUvdGltZSBvciBSZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBDYXB0dXJlZCBnZXN0dXJlIHN0YXRlLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBheGlzX2RlbHRhIENhcHR1cmVkIHBvaW50ZXItdG8tYXhpcyBkZWx0YS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gY2Fub25pY2FsIFJldmlldyBoYXMgYSBtZWFuaW5nZnVsIHByb3Bvc2FsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhc19tZWFuaW5nZnVsX21vdmVtZW50KCBzdGF0ZSwgYXhpc19kZWx0YSApIHtcblx0XHRcdHZhciBtb3ZlbWVudF9yZXNvdXJjZXMgPSBnZXRfbW92ZW1lbnRfcmVzb3VyY2VzKCBzdGF0ZSApO1xuXG5cdFx0XHRpZiAoIG1vdmVtZW50X3Jlc291cmNlcy5pc19jcm9zc19yZXNvdXJjZSApIHsgcmV0dXJuIHRydWU7IH1cblx0XHRcdGlmICggJ2Z1bGxfZGF5JyA9PT0gc3RhdGUucmVjb3JkLmNvbnRleHQudGltZV9hcHBsaWNhdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuIDAgIT09IGF4aXNfZGVsdGEuY2FsZW5kYXJfZGF5X2RlbHRhO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gMCAhPT0gYXhpc19kZWx0YS5pbnN0YW50X2RlbHRhX21pbGxpc2Vjb25kcztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIGltbXV0YWJsZSBzb3VyY2UgYW5kIHRhcmdldCByb3cgaWRlbnRpdGllcyBmb3IgcHJvcG9zYWwgc2VtYW50aWNzLlxuXHRcdCAqXG5cdFx0ICogVGhlIHNlZ21lbnQgRFRPIGlkZW50aWZpZXMgdGhlIGNhbm9uaWNhbCBzb3VyY2UgYWxsb2NhdGlvbiB1c2VkIGJ5IHRoZVxuXHRcdCAqIGNvbnRleHQgZW5kcG9pbnQsIGJ1dCBpdCBtdXN0IG5vdCBkZWNpZGUgd2hldGhlciB0aGUgY29tcGxldGVkIHBvaW50ZXJcblx0XHQgKiBnZXN0dXJlIGNyb3NzZWQgdmlzaWJsZSBSZXNvdXJjZSByb3dzLiBUaGF0IGludGVyYWN0aW9uIG1lYW5pbmcgY29tZXMgZnJvbVxuXHRcdCAqIHRoZSBjYXB0dXJlZCBzb3VyY2UgaG9zdCBhbmQgdGhlIHJlY29uY2lsZWQgZmluYWwgZGVzdGluYXRpb24gaG9zdC4gVGhlXG5cdFx0ICogc2VydmVyIGNvbnRpbnVlcyB0byBhdXRob3JpemUgdGhlIHN1Ym1pdHRlZCB0YXJnZXQgaW5kZXBlbmRlbnRseS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzdGF0ZSBDYXB0dXJlZCBnZXN0dXJlIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gU291cmNlIFJlc291cmNlLCB0YXJnZXQgUmVzb3VyY2UsIGFuZCBjcm9zcy1yb3cgZmxhZy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbW92ZW1lbnRfcmVzb3VyY2VzKCBzdGF0ZSApIHtcblx0XHRcdHZhciBzb3VyY2VfcmVzb3VyY2UgPSBzdGF0ZS5zb3VyY2Vfcm93ID8gTnVtYmVyKCBzdGF0ZS5zb3VyY2Vfcm93LnJlc291cmNlX2lkICkgOiBOdW1iZXIoIHN0YXRlLnJlY29yZC5yZXNvdXJjZV9pZCApO1xuXHRcdFx0dmFyIHRhcmdldF9yZXNvdXJjZSA9IHN0YXRlLmRyb3BfaW50ZW50XG5cdFx0XHRcdD8gTnVtYmVyKCBzdGF0ZS5kcm9wX2ludGVudC50YXJnZXRfcmVzb3VyY2VfaWQgKVxuXHRcdFx0XHQ6ICggc3RhdGUuY2FuZGlkYXRlID8gTnVtYmVyKCBzdGF0ZS5jYW5kaWRhdGUucmVzb3VyY2VfaWQgKSA6IHNvdXJjZV9yZXNvdXJjZSApO1xuXG5cdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRzb3VyY2VfcmVzb3VyY2VfaWQ6IHNvdXJjZV9yZXNvdXJjZSxcblx0XHRcdFx0dGFyZ2V0X3Jlc291cmNlX2lkOiB0YXJnZXRfcmVzb3VyY2UsXG5cdFx0XHRcdGlzX2Nyb3NzX3Jlc291cmNlOiBCb29sZWFuKCBzb3VyY2VfcmVzb3VyY2UgJiYgdGFyZ2V0X3Jlc291cmNlICYmIHNvdXJjZV9yZXNvdXJjZSAhPT0gdGFyZ2V0X3Jlc291cmNlIClcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaGlmdCBhIHN0cmljdCBJU08gY2FsZW5kYXIgZGF0ZSBieSB3aG9sZSBjYWxlbmRhciBkYXlzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIElTTyBkYXRlLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBkYXlzIFNpZ25lZCBkYXkgY291bnQuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTaGlmdGVkIElTTyBkYXRlIG9yIGVtcHR5IHN0cmluZy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzaGlmdF9kYXRlKCB2YWx1ZSwgZGF5cyApIHtcblx0XHRcdHZhciBtYXRjaCA9IFN0cmluZyggdmFsdWUgKS5tYXRjaCggL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvICk7XG5cdFx0XHR2YXIgZGF0ZTtcblx0XHRcdGlmICggISBtYXRjaCApIHsgcmV0dXJuICcnOyB9XG5cdFx0XHRkYXRlID0gbmV3IERhdGUoIERhdGUuVVRDKCBOdW1iZXIoIG1hdGNoWzFdICksIE51bWJlciggbWF0Y2hbMl0gKSAtIDEsIE51bWJlciggbWF0Y2hbM10gKSArIGRheXMgKSApO1xuXHRcdFx0cmV0dXJuIGRhdGUudG9JU09TdHJpbmcoKS5zbGljZSggMCwgMTAgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gc2l0ZS10aW1lem9uZSBkYXRlIHBhcnRzIGZvciBvbmUgZXBvY2guXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZXBvY2ggRXBvY2ggbWlsbGlzZWNvbmRzLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0aW1lem9uZSBJQU5BIHRpbWV6b25lLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBab25lZCBwYXJ0cyBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHpvbmVkX3BhcnRzKCBlcG9jaCwgdGltZXpvbmUgKSB7XG5cdFx0XHR2YXIgdmFsdWVzID0ge307XG5cdFx0XHR2YXIgZm9ybWF0dGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Zm9ybWF0dGVyID0gbmV3IHdpbmRvdy5JbnRsLkRhdGVUaW1lRm9ybWF0KCAnZW4tVVMnLCB7IHRpbWVab25lOiB0aW1lem9uZSwgeWVhcjogJ251bWVyaWMnLCBtb250aDogJzItZGlnaXQnLCBkYXk6ICcyLWRpZ2l0JywgaG91cjogJzItZGlnaXQnLCBob3VyQ3ljbGU6ICdoMjMnLCBtaW51dGU6ICcyLWRpZ2l0Jywgc2Vjb25kOiAnMi1kaWdpdCcgfSApO1xuXHRcdFx0XHRmb3JtYXR0ZXIuZm9ybWF0VG9QYXJ0cyggbmV3IERhdGUoIGVwb2NoICkgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHBhcnQgKSB7IGlmICggJ2xpdGVyYWwnICE9PSBwYXJ0LnR5cGUgKSB7IHZhbHVlc1twYXJ0LnR5cGVdID0gTnVtYmVyKCBwYXJ0LnZhbHVlICk7IH0gfSApO1xuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkgeyByZXR1cm4gbnVsbDsgfVxuXHRcdFx0cmV0dXJuIHZhbHVlcy55ZWFyID8gdmFsdWVzIDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb3JtYXQgYW4gZXBvY2ggYXMgYW4gUkZDMzMzOSBleGFjdCBtaW51dGUgaW4gdGhlIHNpdGUgdGltZXpvbmUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZXBvY2ggRXBvY2ggbWlsbGlzZWNvbmRzLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0aW1lem9uZSBJQU5BIHRpbWV6b25lLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gRXhhY3QtbWludXRlIGluc3RhbnQgb3IgZW1wdHkgc3RyaW5nLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF9pbnN0YW50KCBlcG9jaCwgdGltZXpvbmUgKSB7XG5cdFx0XHR2YXIgcGFydHMgPSB6b25lZF9wYXJ0cyggZXBvY2gsIHRpbWV6b25lICk7XG5cdFx0XHR2YXIgcmVwcmVzZW50ZWQ7XG5cdFx0XHR2YXIgb2Zmc2V0O1xuXHRcdFx0dmFyIHNpZ247XG5cdFx0XHR2YXIgcGFkID0gZnVuY3Rpb24gKCB2YWx1ZSwgbGVuZ3RoICkgeyByZXR1cm4gU3RyaW5nKCBNYXRoLmFicyggTWF0aC5yb3VuZCggdmFsdWUgKSApICkucGFkU3RhcnQoIGxlbmd0aCwgJzAnICk7IH07XG5cdFx0XHRpZiAoICEgcGFydHMgKSB7IHJldHVybiAnJzsgfVxuXHRcdFx0cmVwcmVzZW50ZWQgPSBEYXRlLlVUQyggcGFydHMueWVhciwgcGFydHMubW9udGggLSAxLCBwYXJ0cy5kYXksIHBhcnRzLmhvdXIsIHBhcnRzLm1pbnV0ZSwgcGFydHMuc2Vjb25kICk7XG5cdFx0XHRvZmZzZXQgPSBNYXRoLnJvdW5kKCAoIHJlcHJlc2VudGVkIC0gZXBvY2ggKSAvIDYwMDAwICk7IHNpZ24gPSAwIDw9IG9mZnNldCA/ICcrJyA6ICctJztcblx0XHRcdHJldHVybiBwYWQoIHBhcnRzLnllYXIsIDQgKSArICctJyArIHBhZCggcGFydHMubW9udGgsIDIgKSArICctJyArIHBhZCggcGFydHMuZGF5LCAyICkgKyAnVCcgKyBwYWQoIHBhcnRzLmhvdXIsIDIgKSArICc6JyArIHBhZCggcGFydHMubWludXRlLCAyICkgKyAnOjAwJyArIHNpZ24gKyBwYWQoIE1hdGguZmxvb3IoIE1hdGguYWJzKCBvZmZzZXQgKSAvIDYwICksIDIgKSArICc6JyArIHBhZCggTWF0aC5hYnMoIG9mZnNldCApICUgNjAsIDIgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCdWlsZCB0aGUgYm91bmRlZCBub24tYXV0aG9yaXRhdGl2ZSBwcm9wb3NhbCBhZnRlciBET00gcmVzdG9yYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdGUgQ2FwdHVyZWQgZ2VzdHVyZSBzdGF0ZS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gUmV2aWV3IHByb3Bvc2FsIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcHJvcG9zYWxfZnJvbSggc3RhdGUgKSB7XG5cdFx0XHR2YXIgYXhpc19kZWx0YTtcblx0XHRcdHZhciBtb3ZlbWVudCA9IHN0YXRlLnJlY29yZC5jb250ZXh0O1xuXHRcdFx0dmFyIG1vdmVtZW50X3Jlc291cmNlcyA9IGdldF9tb3ZlbWVudF9yZXNvdXJjZXMoIHN0YXRlICk7XG5cdFx0XHR2YXIgY3Jvc3NfcmVzb3VyY2UgPSBtb3ZlbWVudF9yZXNvdXJjZXMuaXNfY3Jvc3NfcmVzb3VyY2U7XG5cdFx0XHR2YXIgdGFyZ2V0X3Jlc291cmNlID0gY3Jvc3NfcmVzb3VyY2UgPyBtb3ZlbWVudF9yZXNvdXJjZXMudGFyZ2V0X3Jlc291cmNlX2lkIDogbW92ZW1lbnQucHJpbWFyeV9yZXNvdXJjZV9pZDtcblx0XHRcdHZhciBwcm9wb3NhbDtcblxuXHRcdFx0YXhpc19kZWx0YSA9IGdldF9wb2ludGVyX2F4aXNfZGVsdGEoIHN0YXRlICk7XG5cdFx0XHRpZiAoICEgYXhpc19kZWx0YSB8fCAhIGhhc19tZWFuaW5nZnVsX21vdmVtZW50KCBzdGF0ZSwgYXhpc19kZWx0YSApICkgeyByZXR1cm4gbnVsbDsgfVxuXHRcdFx0aWYgKCAoIGNyb3NzX3Jlc291cmNlICYmICEgbW92ZW1lbnQuY3Jvc3NfcmVzb3VyY2VfYXZhaWxhYmxlICkgfHwgKCAhIGNyb3NzX3Jlc291cmNlICYmICEgbW92ZW1lbnQuc2FtZV9yZXNvdXJjZV9hdmFpbGFibGUgKSApIHsgcmV0dXJuIG51bGw7IH1cblx0XHRcdHByb3Bvc2FsID0ge1xuXHRcdFx0XHRzY2hlbWFfdmVyc2lvbjogTnVtYmVyKCByZXZpZXdfdHJhbnNwb3J0LnNjaGVtYV92ZXJzaW9uICksIGJvb2tpbmdfaWQ6IG1vdmVtZW50LmJvb2tpbmdfaWQsXG5cdFx0XHRcdGludGVyYWN0aW9uX3NvdXJjZTogY3Jvc3NfcmVzb3VyY2UgPyAnY3Jvc3NfcmVzb3VyY2VfZHJhZycgOiAnZHJhZycsXG5cdFx0XHRcdG9wZXJhdGlvbjogY3Jvc3NfcmVzb3VyY2UgPyAnY2hhbmdlX3Jlc291cmNlJyA6ICdzaGlmdCcsIHRhcmdldF9yZXNvdXJjZV9pZDogdGFyZ2V0X3Jlc291cmNlLFxuXHRcdFx0XHRzZWxlY3Rpb25fbWV0aG9kOiBtb3ZlbWVudC5zZWxlY3Rpb25fbWV0aG9kLCBwcm9wb3NhbF9yZXZpc2lvbjogbW92ZW1lbnQucHJvcG9zYWxfcmV2aXNpb24sXG5cdFx0XHRcdHNvdXJjZV9jb250ZXh0X3Rva2VuOiBtb3ZlbWVudC5zb3VyY2VfY29udGV4dF90b2tlblxuXHRcdFx0fTtcblx0XHRcdGlmICggJ2Z1bGxfZGF5JyA9PT0gbW92ZW1lbnQudGltZV9hcHBsaWNhdGlvbiApIHtcblx0XHRcdFx0cHJvcG9zYWwucHJvcG9zZWRfZGF0ZXMgPSBtb3ZlbWVudC5zZWxlY3RlZF9kYXRlcy5tYXAoIGZ1bmN0aW9uICggZGF0ZSApIHsgcmV0dXJuIHNoaWZ0X2RhdGUoIGRhdGUsIGF4aXNfZGVsdGEuY2FsZW5kYXJfZGF5X2RlbHRhICk7IH0gKTtcblx0XHRcdFx0cmV0dXJuIHByb3Bvc2FsLnByb3Bvc2VkX2RhdGVzLmV2ZXJ5KCBCb29sZWFuICkgPyBPYmplY3QuZnJlZXplKCBwcm9wb3NhbCApIDogbnVsbDtcblx0XHRcdH1cblx0XHRcdHByb3Bvc2FsLnByb3Bvc2VkX2ludGVydmFscyA9IG1vdmVtZW50LmV4YWN0X2ludGVydmFscy5tYXAoIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdHJldHVybiBPYmplY3QuZnJlZXplKCB7IHN0YXJ0OiBmb3JtYXRfaW5zdGFudCggRGF0ZS5wYXJzZSggaW50ZXJ2YWwuc3RhcnQgKSArIGF4aXNfZGVsdGEuaW5zdGFudF9kZWx0YV9taWxsaXNlY29uZHMsIHN0YXRlLmF4aXMudGltZXpvbmUgKSwgZW5kOiBmb3JtYXRfaW5zdGFudCggRGF0ZS5wYXJzZSggaW50ZXJ2YWwuZW5kICkgKyBheGlzX2RlbHRhLmluc3RhbnRfZGVsdGFfbWlsbGlzZWNvbmRzLCBzdGF0ZS5heGlzLnRpbWV6b25lICkgfSApO1xuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuIHByb3Bvc2FsLnByb3Bvc2VkX2ludGVydmFscy5ldmVyeSggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHsgcmV0dXJuIGludGVydmFsLnN0YXJ0ICYmIGludGVydmFsLmVuZDsgfSApID8gT2JqZWN0LmZyZWV6ZSggcHJvcG9zYWwgKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTWFyayB0aGUgcmVzdG9yZWQgY2Fub25pY2FsIGNhcmQgYW5kIFRpbWVsaW5lIGJ1c3kgZm9yIG9uZSBSZXZpZXcgcmVxdWVzdC5cblx0XHQgKlxuXHRcdCAqIFRoZSByZXR1cm5lZCBvYmplY3Qgb3ducyBldmVyeSBET00gYW5kIGludGVyYWN0aW9uIGNoYW5nZS4gSXRzIGlkZW50aXR5XG5cdFx0ICogcHJldmVudHMgYW4gb2xkZXIgcmVxdWVzdCBmcm9tIHJlbGVhc2luZyBhIG5ld2VyIHJlcXVlc3QncyBsb2FkaW5nIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2FyZCBDYW5vbmljYWwgYm9va2luZyBjYXJkIHJlc3RvcmVkIGFmdGVyIHRoZSBkcm9wLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gUmVxdWVzdC1vd25lZCBsb2FkaW5nIHN0YXRlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJlZ2luX3Jldmlld19sb2FkaW5nKCBjYXJkICkge1xuXHRcdFx0dmFyIHJlbmRlcmVyID0gdGVtcGxhdGUoIHRlbXBsYXRlcy5sb2FkaW5nICk7XG5cdFx0XHR2YXIgYnVmZmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0XHR2YXIgc3RhdGU7XG5cblx0XHRcdGVuZF9yZXZpZXdfbG9hZGluZyggcmV2aWV3X2xvYWRpbmdfc3RhdGUgKTtcblx0XHRcdHN0YXRlID0ge1xuXHRcdFx0XHRjYXJkOiBjYXJkLFxuXHRcdFx0XHRvdmVybGF5OiBudWxsLFxuXHRcdFx0XHRwcm9jZXNzaW5nX25vdGljZTogbnVsbCxcblx0XHRcdFx0cHJldmlvdXNfYXJpYV9idXN5OiBjYXJkID8gY2FyZC5nZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knICkgOiBudWxsLFxuXHRcdFx0XHRyZWxlYXNlZDogZmFsc2Vcblx0XHRcdH07XG5cdFx0XHRpZiAoIGNhcmQgJiYgcmVuZGVyZXIgKSB7XG5cdFx0XHRcdGJ1ZmZlci5pbm5lckhUTUwgPSByZW5kZXJlcigge30gKTtcblx0XHRcdFx0c3RhdGUub3ZlcmxheSA9IGJ1ZmZlci5maXJzdEVsZW1lbnRDaGlsZDtcblx0XHRcdFx0aWYgKCBzdGF0ZS5vdmVybGF5ICkge1xuXHRcdFx0XHRcdGNhcmQuYXBwZW5kQ2hpbGQoIHN0YXRlLm92ZXJsYXkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYXJkICkge1xuXHRcdFx0XHRjYXJkLmNsYXNzTGlzdC5hZGQoICdpcy1ib29raW5nLW1vdmVtZW50LXJldmlldy1sb2FkaW5nJyApO1xuXHRcdFx0XHRjYXJkLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICd0cnVlJyApO1xuXHRcdFx0fVxuXHRcdFx0bW91bnQuY2xhc3NMaXN0LmFkZCggJ2lzLWJvb2tpbmctbW92ZW1lbnQtcmV2aWV3LWxvYWRpbmcnICk7XG5cdFx0XHRyZXZpZXdfbG9hZGluZ19zdGF0ZSA9IHN0YXRlO1xuXHRcdFx0aWYgKCBjYWxsYmFja3Muc2V0X2ludGVyYWN0aW9uX3N1c3BlbmRlZCApIHsgY2FsbGJhY2tzLnNldF9pbnRlcmFjdGlvbl9zdXNwZW5kZWQoIHRydWUsIGNhcmQgKTsgfVxuXHRcdFx0aWYgKCBjYWxsYmFja3Muc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkICkgeyBjYWxsYmFja3Muc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkKCB0cnVlICk7IH1cblxuXHRcdFx0cmV0dXJuIHN0YXRlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbGVhc2UgdGhlIGV4YWN0IGNhbm9uaWNhbC1jYXJkIGxvYWRpbmcgc3RhdGUgb3duZWQgYnkgb25lIHJlcXVlc3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBzdGF0ZSBSZXF1ZXN0LW93bmVkIGxvYWRpbmcgc3RhdGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBlbmRfcmV2aWV3X2xvYWRpbmcoIHN0YXRlICkge1xuXHRcdFx0aWYgKCAhIHN0YXRlIHx8IHN0YXRlLnJlbGVhc2VkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzdGF0ZS5yZWxlYXNlZCA9IHRydWU7XG5cdFx0XHRoaWRlX3Byb2Nlc3Npbmdfbm90aWNlKCBzdGF0ZS5wcm9jZXNzaW5nX25vdGljZSApO1xuXHRcdFx0c3RhdGUucHJvY2Vzc2luZ19ub3RpY2UgPSBudWxsO1xuXHRcdFx0aWYgKCBzdGF0ZS5vdmVybGF5ICkge1xuXHRcdFx0XHRzdGF0ZS5vdmVybGF5LnJlbW92ZSgpO1xuXHRcdFx0XHRzdGF0ZS5vdmVybGF5ID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhdGUuY2FyZCApIHtcblx0XHRcdFx0c3RhdGUuY2FyZC5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYm9va2luZy1tb3ZlbWVudC1yZXZpZXctbG9hZGluZycgKTtcblx0XHRcdFx0aWYgKCBudWxsID09PSBzdGF0ZS5wcmV2aW91c19hcmlhX2J1c3kgKSB7XG5cdFx0XHRcdFx0c3RhdGUuY2FyZC5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWJ1c3knICk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c3RhdGUuY2FyZC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBzdGF0ZS5wcmV2aW91c19hcmlhX2J1c3kgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXZpZXdfbG9hZGluZ19zdGF0ZSAhPT0gc3RhdGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJldmlld19sb2FkaW5nX3N0YXRlID0gbnVsbDtcblx0XHRcdG1vdW50LmNsYXNzTGlzdC5yZW1vdmUoICdpcy1ib29raW5nLW1vdmVtZW50LXJldmlldy1sb2FkaW5nJyApO1xuXHRcdFx0aWYgKCBjYWxsYmFja3Muc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkICkgeyBjYWxsYmFja3Muc2V0X2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkKCBmYWxzZSApOyB9XG5cdFx0XHRpZiAoIGNhbGxiYWNrcy5zZXRfaW50ZXJhY3Rpb25fc3VzcGVuZGVkICkgeyBjYWxsYmFja3Muc2V0X2ludGVyYWN0aW9uX3N1c3BlbmRlZCggZmFsc2UsIHN0YXRlLmNhcmQgKTsgfVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgdGhlIHNjcm9sbCBwb3NpdGlvbiBjYXB0dXJlZCBiZWZvcmUgdGhlIG1vdmVtZW50IFJldmlldyBsaWZlY3ljbGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3RvcmVfbGlmZWN5Y2xlX3Njcm9sbCgpIHtcblx0XHRcdHZhciBjYW52YXMgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXNdJyApO1xuXG5cdFx0XHRpZiAoICEgbGlmZWN5Y2xlX2FuY2hvciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYW52YXMgKSB7XG5cdFx0XHRcdGNhbnZhcy5zY3JvbGxMZWZ0ID0gTnVtYmVyKCBsaWZlY3ljbGVfYW5jaG9yLmNhbnZhc19zY3JvbGwgKSB8fCAwO1xuXHRcdFx0fVxuXHRcdFx0d2luZG93LnNjcm9sbFRvKCBOdW1iZXIoIGxpZmVjeWNsZV9hbmNob3IuZG9jX3ggKSB8fCAwLCBOdW1iZXIoIGxpZmVjeWNsZV9hbmNob3IuZG9jX3kgKSB8fCAwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRmluZCB0aGUgcHJlZmVycmVkIGNhbm9uaWNhbCByZXBsYWNlbWVudCBjYXJkIGZvciB0aGUgbW92ZWQgYm9va2luZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBib29raW5nX2lkIENhbm9uaWNhbCBib29raW5nIElELlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IFNlbGVjdGVkIG9yIGZpcnN0IHZpc2libGUgYm9va2luZyBjYXJkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZpbmRfYm9va2luZ19jYXJkKCBib29raW5nX2lkICkge1xuXHRcdFx0dmFyIHNlbGVjdGVkX2NhcmQgPSBudWxsO1xuXHRcdFx0dmFyIGZpcnN0X2NhcmQgPSBudWxsO1xuXG5cdFx0XHR2aXNpYmxlX3JlY29yZHMuc29tZSggZnVuY3Rpb24gKCByZWNvcmQgKSB7XG5cdFx0XHRcdGlmICggcmVjb3JkLmJvb2tpbmdfaWQgIT09IGJvb2tpbmdfaWQgfHwgISByZWNvcmQuY2FyZC5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIGZpcnN0X2NhcmQgKSB7XG5cdFx0XHRcdFx0Zmlyc3RfY2FyZCA9IHJlY29yZC5jYXJkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggcmVjb3JkLmNhcmQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtYm9va2luZy1zZWxlY3RlZCcgKSApIHtcblx0XHRcdFx0XHRzZWxlY3RlZF9jYXJkID0gcmVjb3JkLmNhcmQ7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gc2VsZWN0ZWRfY2FyZCB8fCBmaXJzdF9jYXJkO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgZm9jdXMgdG8gdGhlIGNhbm9uaWNhbCBjYXJkIGFuZCBwcmVmZXIgaXRzIGF1dGhvcml6ZWQgbW92ZW1lbnQgZ3JpcC5cblx0XHQgKlxuXHRcdCAqIFRoZSBzZWxlY3Rpb24gY29udHJvbCBpcyBhIHN0YWJsZSBmYWxsYmFjayBhbmQgaW50ZW50aW9uYWxseSByZWNlaXZlcyBmb2N1c1xuXHRcdCAqIGZpcnN0LiBJdHMgZm9jdXMgZXZlbnQgcmVxdWVzdHMgZnJlc2ggbW92ZW1lbnQgZWxpZ2liaWxpdHk7IG9uY2UgdGhlIHNlcnZlclxuXHRcdCAqIHN1cHBsaWVzIHRoZSBuZXcgZ3JpcCwgYHJlbmRlcl9ncmlwKClgIHRyYW5zZmVycyBmb2N1cyB0byB0aGF0IGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBDYW5vbmljYWwgYm9va2luZyBJRC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3RvcmVfbGlmZWN5Y2xlX2ZvY3VzKCBib29raW5nX2lkICkge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHRsaWZlY3ljbGVfYW5jaG9yXG5cdFx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBsaWZlY3ljbGVfYW5jaG9yLnJlc3RvcmVfZm9jdXNcblx0XHRcdFx0JiYgdHJ1ZSA9PT0gbGlmZWN5Y2xlX2FuY2hvci5yZXN0b3JlX2ZvY3VzKCBib29raW5nX2lkIClcblx0XHRcdCkge1xuXHRcdFx0XHRwZW5kaW5nX2dyaXBfZm9jdXNfYm9va2luZ19pZCA9IDA7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciBjYXJkID0gcmVwbGFjZW1lbnRfY2FyZCAmJiByZXBsYWNlbWVudF9jYXJkLmlzQ29ubmVjdGVkID8gcmVwbGFjZW1lbnRfY2FyZCA6IGZpbmRfYm9va2luZ19jYXJkKCBib29raW5nX2lkICk7XG5cdFx0XHR2YXIgZ3JpcCA9IGNhcmQgPyBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctbW92ZW1lbnQtZ3JpcF0nICkgOiBudWxsO1xuXHRcdFx0dmFyIHNlbGVjdGlvbiA9IGNhcmQgPyBjYXJkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctc2VsZWN0XScgKSA6IG51bGw7XG5cblx0XHRcdGlmICggZ3JpcCApIHtcblx0XHRcdFx0cGVuZGluZ19ncmlwX2ZvY3VzX2Jvb2tpbmdfaWQgPSAwO1xuXHRcdFx0XHRncmlwLmZvY3VzKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfZ3JpcF9mb2N1c19ib29raW5nX2lkID0gYm9va2luZ19pZDtcblx0XHRcdGlmICggc2VsZWN0aW9uICkge1xuXHRcdFx0XHRzZWxlY3Rpb24uZm9jdXMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBsaWZlY3ljbGVfYW5jaG9yICYmIGxpZmVjeWNsZV9hbmNob3IuZm9jdXMgJiYgbGlmZWN5Y2xlX2FuY2hvci5mb2N1cy5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0cGVuZGluZ19ncmlwX2ZvY3VzX2Jvb2tpbmdfaWQgPSAwO1xuXHRcdFx0XHRsaWZlY3ljbGVfYW5jaG9yLmZvY3VzLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqIFJlbW92ZSBvbmx5IHRoZSBtb3ZlbWVudC1vd25lZCBSZXZpZXcgc3VyZmFjZS4gQHJldHVybiB7dm9pZH0gKi9cblx0XHRmdW5jdGlvbiByZW1vdmVfcmV2aWV3X2hvc3QoKSB7XG5cdFx0XHRpZiAoIHJldmlld19ob3N0ICkge1xuXHRcdFx0XHRyZXZpZXdfaG9zdC5yZW1vdmUoKTtcblx0XHRcdFx0cmV2aWV3X2hvc3QgPSBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbGVhc2UgYW4gaWRsZSBvciBjYW5jZWxsYWJsZSBSZXZpZXcgYW5kIHJlc3RvcmUgaXRzIHNhdmVkIHByZXNlbnRhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEFwcGx5IGFuZCBjYW5vbmljYWwgcmVjb3ZlcnkgYXJlIGRlbGliZXJhdGVseSBub3QgY2FuY2VsbGFibGUgYmVjYXVzZSB0aGVcblx0XHQgKiBicm93c2VyIGNhbm5vdCBrbm93IHdoZXRoZXIgcGVyc2lzdGVuY2UgY29tcGxldGVkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbG9zZV9yZXZpZXcoKSB7XG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IGxpZmVjeWNsZV9hbmNob3IgPyBsaWZlY3ljbGVfYW5jaG9yLmJvb2tpbmdfaWQgOiAwO1xuXG5cdFx0XHRpZiAoIC0xICE9PSBbICdhcHBseV9wZW5kaW5nJywgJ3JlZnJlc2hfcGVuZGluZycsICdyZWZyZXNoX2Vycm9yJyBdLmluZGV4T2YoIGxpZmVjeWNsZV9zdGF0ZSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsaWZlY3ljbGVfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0aWYgKCByZXZpZXdfcmVxdWVzdCAmJiByZXZpZXdfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdHJldmlld19tZW1vcnkgPSBudWxsO1xuXHRcdFx0cGVuZGluZ19hcHBseV9yZXN1bHQgPSBudWxsO1xuXHRcdFx0cGVuZGluZ19jb21wbGV0aW9uID0gbnVsbDtcblx0XHRcdGVuZF9yZXZpZXdfbG9hZGluZyggcmV2aWV3X2xvYWRpbmdfc3RhdGUgKTtcblx0XHRcdHJlbW92ZV9yZXZpZXdfaG9zdCgpO1xuXHRcdFx0bW91bnQuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWJvb2tpbmctbW92ZW1lbnQtYXBwbHktcGVuZGluZycgKTtcblx0XHRcdGxpZmVjeWNsZV9zdGF0ZSA9ICdpZGxlJztcblx0XHRcdHJlc3RvcmVfbGlmZWN5Y2xlX3Njcm9sbCgpO1xuXHRcdFx0cmVzdG9yZV9saWZlY3ljbGVfZm9jdXMoIGJvb2tpbmdfaWQgKTtcblx0XHRcdGxpZmVjeWNsZV9hbmNob3IgPSBudWxsO1xuXHRcdFx0cmVwbGFjZW1lbnRfY2FyZCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2hvdyB0aGUgc3RhbmRhcmQgQm9va2luZyBDYWxlbmRhciBQcm9jZXNzaW5nIG5vdGljZSBmb3IgUmV2aWV3IGxvYWRpbmcuXG5cdFx0ICpcblx0XHQgKiBUaGUgbGVnYWN5IG5vdGljZSBBUEkgZG9lcyBub3QgcmV0dXJuIHRoZSBlbGVtZW50IGl0IGNyZWF0ZXMuIENhcHR1cmUgdGhlXG5cdFx0ICogbmV3ZXN0IFByb2Nlc3Npbmcgd3JhcHBlciBpbW1lZGlhdGVseSBzbyB0aGlzIHJlcXVlc3QgY2FuIGxhdGVyIGhpZGUgb25seVxuXHRcdCAqIGl0cyBvd24gbm90aWNlIHdpdGhvdXQgYWZmZWN0aW5nIGFub3RoZXIgYWRtaW5pc3RyYXRpb24gcmVxdWVzdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBSZXF1ZXN0LW93bmVkIGpRdWVyeSBub3RpY2Ugd3JhcHBlciwgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzaG93X3Byb2Nlc3Npbmdfbm90aWNlKCkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlX3Byb2Nlc3NpbmcgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHR3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2VfcHJvY2Vzc2luZyggJycgKTtcblxuXHRcdFx0cmV0dXJuIHdpbmRvdy5qUXVlcnkoICcjYWpheF93b3JraW5nIC53cGJjX3Byb2Nlc3Npbmcud3BiY19zcGluJyApLmxhc3QoKS5jbG9zZXN0KCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIaWRlIHRoZSBleGFjdCBQcm9jZXNzaW5nIG5vdGljZSBvd25lZCBieSBvbmUgc2V0dGxlZCBSZXZpZXcgcmVxdWVzdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fG51bGx9IHByb2Nlc3Npbmdfbm90aWNlIFJlcXVlc3Qtb3duZWQgalF1ZXJ5IHdyYXBwZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoaWRlX3Byb2Nlc3Npbmdfbm90aWNlKCBwcm9jZXNzaW5nX25vdGljZSApIHtcblx0XHRcdGlmICggcHJvY2Vzc2luZ19ub3RpY2UgJiYgcHJvY2Vzc2luZ19ub3RpY2UubGVuZ3RoICkge1xuXHRcdFx0XHRwcm9jZXNzaW5nX25vdGljZS5zdG9wKCB0cnVlLCB0cnVlICkuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNob3cgb25lIHN0YW5kYXJkIHRvcC1yaWdodCBhZG1pbmlzdHJhdGlvbiBlcnJvciBmb3IgUmV2aWV3IGZhaWx1cmUuXG5cdFx0ICpcblx0XHQgKiBUaGUgcGFnZSBjb250cm9sbGVyIGVzY2FwZXMgdGhlIGF1dGhvcml6ZWQgcGxhaW4tdGV4dCBtZXNzYWdlIGJlZm9yZSBpdFxuXHRcdCAqIHJlYWNoZXMgdGhlIGxlZ2FjeSBIVE1MLWNhcGFibGUgbm90aWNlIEFQSS4gTW92ZW1lbnQgbXVzdCBub3QgY3JlYXRlIG9yXG5cdFx0ICogcG9zaXRpb24gYSBmZWF0dXJlLXNwZWNpZmljIG5vdGljZSBzdXJmYWNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgU2FmZSBsb2NhbGl6ZWQgZXJyb3IgbWVzc2FnZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNob3dfcmV2aWV3X2Vycm9yX25vdGljZSggbWVzc2FnZSApIHtcblx0XHRcdGlmICggbWVzc2FnZSAmJiBjYWxsYmFja3MgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNhbGxiYWNrcy5zaG93X2FkbWluX21lc3NhZ2UgKSB7XG5cdFx0XHRcdGNhbGxiYWNrcy5zaG93X2FkbWluX21lc3NhZ2UoIFN0cmluZyggbWVzc2FnZSApLCAnZXJyb3InLCAxMDAwMCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlYWQgb25lIHNhZmUgY2Fub25pY2FsIGVycm9yIGZyb20gYSBub3JtYWxpemVkIEFKQVggcmVzcG9uc2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmFpbGVkX3JlcXVlc3QgRmFpbGVkIGpRdWVyeSByZXF1ZXN0LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmYWxsYmFja19tZXNzYWdlIFRyYW5zbGF0ZWQgb3BlcmF0aW9uIGZhbGxiYWNrLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gU2FmZSBjb2RlIGFuZCBtZXNzYWdlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yZXF1ZXN0X2Vycm9yKCBmYWlsZWRfcmVxdWVzdCwgZmFsbGJhY2tfbWVzc2FnZSApIHtcblx0XHRcdHZhciBlcnJvcl9kYXRhID0gZmFpbGVkX3JlcXVlc3QgJiYgZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OID8gZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgOiBudWxsO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb2RlOiBlcnJvcl9kYXRhICYmICdzdHJpbmcnID09PSB0eXBlb2YgZXJyb3JfZGF0YS5jb2RlID8gZXJyb3JfZGF0YS5jb2RlIDogJycsXG5cdFx0XHRcdG1lc3NhZ2U6IGVycm9yX2RhdGEgJiYgJ3N0cmluZycgPT09IHR5cGVvZiBlcnJvcl9kYXRhLm1lc3NhZ2UgJiYgZXJyb3JfZGF0YS5tZXNzYWdlXG5cdFx0XHRcdFx0PyBlcnJvcl9kYXRhLm1lc3NhZ2Vcblx0XHRcdFx0XHQ6IFN0cmluZyggZmFsbGJhY2tfbWVzc2FnZSB8fCAnJyApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJpbmQgdGhlIGV4YWN0IGNvbnRyb2xzIHBlcm1pdHRlZCBmb3IgdGhlIGN1cnJlbnQgUmV2aWV3IHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBiaW5kX3Jldmlld19jb250cm9scygpIHtcblx0XHRcdHZhciBjYW5jZWxfY29udHJvbCA9IHJldmlld19ob3N0ID8gcmV2aWV3X2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1tb3ZlbWVudC1yZXZpZXctY2xvc2VdJyApIDogbnVsbDtcblx0XHRcdHZhciBhcHBseV9jb250cm9sID0gcmV2aWV3X2hvc3QgPyByZXZpZXdfaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLW1vdmVtZW50LWFwcGx5XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmV0cnlfY29udHJvbCA9IHJldmlld19ob3N0ID8gcmV2aWV3X2hvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1tb3ZlbWVudC1yZXRyeS1yZWZyZXNoXScgKSA6IG51bGw7XG5cblx0XHRcdGlmICggY2FuY2VsX2NvbnRyb2wgKSB7XG5cdFx0XHRcdGNhbmNlbF9jb250cm9sLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGNsb3NlX3JldmlldyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhcHBseV9jb250cm9sICkge1xuXHRcdFx0XHRhcHBseV9jb250cm9sLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHJlcXVlc3RfYXBwbHkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggcmV0cnlfY29udHJvbCApIHtcblx0XHRcdFx0cmV0cnlfY29udHJvbC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCByZWZyZXNoX2FmdGVyX2FwcGx5ICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIHRoZSBtb2R1bGUtb3duZWQgc2hlbGwgYXJvdW5kIHRoZSBjYW5vbmljYWwgUmV2aWV3IHRlbXBsYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHZpZXdfbW9kZWwgQXV0aG9yaXplZCBwcmVzZW50YXRpb24gc3RhdGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBzaGVsbCByZW5kZXJlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfcmV2aWV3X3N1cmZhY2UoIHZpZXdfbW9kZWwgKSB7XG5cdFx0XHR2YXIgc2hlbGwgPSB0ZW1wbGF0ZSggdGVtcGxhdGVzLnJldmlldyApO1xuXHRcdFx0dmFyIGluaXRpYWxfZm9jdXM7XG5cblx0XHRcdGlmICggISBzaGVsbCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmVtb3ZlX3Jldmlld19ob3N0KCk7XG5cdFx0XHRyZXZpZXdfaG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0XHRyZXZpZXdfaG9zdC5jbGFzc05hbWUgPSAnd3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yIHdwYmNfdGltZWxpbmVfYm9va2luZ19tb3ZlbWVudF9fcmV2aWV3X2hvc3QnO1xuXHRcdFx0cmV2aWV3X2hvc3QuaW5uZXJIVE1MID0gc2hlbGwoIHZpZXdfbW9kZWwgKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHJldmlld19ob3N0ICk7XG5cdFx0XHRiaW5kX3Jldmlld19jb250cm9scygpO1xuXHRcdFx0aW5pdGlhbF9mb2N1cyA9IHJldmlld19ob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctbW92ZW1lbnQtYXBwbHldLCBbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctbW92ZW1lbnQtcmV2aWV3LWNsb3NlXSwgW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLW1vdmVtZW50LXJldHJ5LXJlZnJlc2hdLCBbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctbW92ZW1lbnQtcmV2aWV3XScgKTtcblx0XHRcdGlmICggaW5pdGlhbF9mb2N1cyApIHtcblx0XHRcdFx0aW5pdGlhbF9mb2N1cy5mb2N1cygpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgdGhlIGN1cnJlbnQgc2lnbmVkIFJldmlldyB3aXRoIHN0YXRlLXNwZWNpZmljIGFjdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc3RhdHVzIFZpc2libGUgbG9jYWxpemVkIGxpZmVjeWNsZSBtZXNzYWdlLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhY3Rpb25zIEFsbG93ZWQgZm9vdGVyIGFjdGlvbnMgYW5kIGJ1c3kgc3RhdGUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlbmRlcmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9zaWduZWRfcmV2aWV3KCBzdGF0dXMsIGFjdGlvbnMgKSB7XG5cdFx0XHR2YXIgYWxsb3dlZF9hY3Rpb25zID0gYWN0aW9ucyB8fCB7fTtcblxuXHRcdFx0aWYgKCAhIHJldmlld19tZW1vcnkgfHwgISByZXZpZXdfbWVtb3J5LnJldmlld19odG1sICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZW5kZXJfcmV2aWV3X3N1cmZhY2UoIHtcblx0XHRcdFx0dGl0bGU6IGkxOG4ucmV2aWV3X3RpdGxlIHx8ICcnLFxuXHRcdFx0XHRzdGF0dXM6IHN0YXR1cyB8fCAnJyxcblx0XHRcdFx0cmV2aWV3X2h0bWw6IHJldmlld19tZW1vcnkucmV2aWV3X2h0bWwsXG5cdFx0XHRcdGNhbmNlbF9sYWJlbDogaTE4bi5jYW5jZWwgfHwgJycsXG5cdFx0XHRcdGFwcGx5X2xhYmVsOiBpMThuLmFwcGx5IHx8ICcnLFxuXHRcdFx0XHRyZXRyeV9yZWZyZXNoX2xhYmVsOiBpMThuLnJldHJ5X3JlZnJlc2ggfHwgJycsXG5cdFx0XHRcdGNhbl9jYW5jZWw6IEJvb2xlYW4oIGFsbG93ZWRfYWN0aW9ucy5jYW5fY2FuY2VsICksXG5cdFx0XHRcdGNhbl9hcHBseTogQm9vbGVhbiggYWxsb3dlZF9hY3Rpb25zLmNhbl9hcHBseSApLFxuXHRcdFx0XHRjYW5fcmV0cnlfcmVmcmVzaDogQm9vbGVhbiggYWxsb3dlZF9hY3Rpb25zLmNhbl9yZXRyeV9yZWZyZXNoICksXG5cdFx0XHRcdGlzX2J1c3k6IEJvb2xlYW4oIGFsbG93ZWRfYWN0aW9ucy5pc19idXN5IClcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5pc2ggYSBub24tbXV0YXRpbmcgUmV2aWV3IGZhaWx1cmUgYXQgdGhlIHVuY2hhbmdlZCBjYW5vbmljYWwgY2FyZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBlcnJvcl9tZXNzYWdlIEF1dGhvcml6ZWQgcGxhaW4tdGV4dCBlcnJvci5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZpbmlzaF9yZXZpZXdfZmFpbHVyZSggZXJyb3JfbWVzc2FnZSApIHtcblx0XHRcdHZhciBib29raW5nX2lkID0gbGlmZWN5Y2xlX2FuY2hvciA/IGxpZmVjeWNsZV9hbmNob3IuYm9va2luZ19pZCA6IDA7XG5cblx0XHRcdHJldmlld19tZW1vcnkgPSBudWxsO1xuXHRcdFx0cmVtb3ZlX3Jldmlld19ob3N0KCk7XG5cdFx0XHRsaWZlY3ljbGVfc3RhdGUgPSAnaWRsZSc7XG5cdFx0XHRyZXN0b3JlX2xpZmVjeWNsZV9zY3JvbGwoKTtcblx0XHRcdHJlc3RvcmVfbGlmZWN5Y2xlX2ZvY3VzKCBib29raW5nX2lkICk7XG5cdFx0XHRhbm5vdW5jZSggZXJyb3JfbWVzc2FnZSApO1xuXHRcdFx0c2hvd19yZXZpZXdfZXJyb3Jfbm90aWNlKCBlcnJvcl9tZXNzYWdlICk7XG5cdFx0XHRsaWZlY3ljbGVfYW5jaG9yID0gbnVsbDtcblx0XHRcdHJlcGxhY2VtZW50X2NhcmQgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBhbmQgcmV0YWluIG9uZSBjYW5vbmljYWwgc2lnbmVkIFJldmlldyBmb3IgYSBzaW5nbGUgQXBwbHkgYXR0ZW1wdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBDYW5vbmljYWwgUmV2aWV3IHJlc3BvbnNlLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wb3NhbCBGcm96ZW4gYnJvd3NlciBwcm9wb3NhbC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlc3BvbnNlIGFuZCB0ZW1wbGF0ZXMgYXJlIHZhbGlkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9yZXZpZXcoIHJlc3BvbnNlLCBwcm9wb3NhbCApIHtcblx0XHRcdHZhciBjYW5vbmljYWwgPSB0ZW1wbGF0ZSggcmV2aWV3X3RyYW5zcG9ydC50ZW1wbGF0ZV9pZCApO1xuXHRcdFx0dmFyIHJldmlldyA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLnJldmlldyA/IHJlc3BvbnNlLnJldmlldyA6IG51bGw7XG5cdFx0XHR2YXIgcmV2aWV3X3Jlc291cmNlcyA9IHJldmlldyAmJiByZXZpZXcucmVzb3VyY2VzID8gcmV2aWV3LnJlc291cmNlcyA6IHt9O1xuXHRcdFx0dmFyIGV4cGVjdGVkX3Jlc291cmNlX2NoYW5nZSA9ICdjcm9zc19yZXNvdXJjZV9kcmFnJyA9PT0gcHJvcG9zYWwuaW50ZXJhY3Rpb25fc291cmNlO1xuXHRcdFx0dmFyIHRva2VuID0gU3RyaW5nKCByZXNwb25zZSAmJiByZXNwb25zZS50b2tlbiA/IHJlc3BvbnNlLnRva2VuIDogJycgKTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGNhbm9uaWNhbFxuXHRcdFx0XHR8fCAhIHJldmlld1xuXHRcdFx0XHR8fCBOdW1iZXIoIHJldmlldy5ib29raW5nX2lkIHx8IDAgKSAhPT0gcHJvcG9zYWwuYm9va2luZ19pZFxuXHRcdFx0XHR8fCBTdHJpbmcoIHJldmlldy5pbnRlcmFjdGlvbl9zb3VyY2UgfHwgJycgKSAhPT0gcHJvcG9zYWwuaW50ZXJhY3Rpb25fc291cmNlXG5cdFx0XHRcdHx8IFN0cmluZyggcmV2aWV3Lm9wZXJhdGlvbiB8fCAnJyApICE9PSBwcm9wb3NhbC5vcGVyYXRpb25cblx0XHRcdFx0fHwgTnVtYmVyKCByZXZpZXdfcmVzb3VyY2VzLnByb3Bvc2VkX3RhcmdldCAmJiByZXZpZXdfcmVzb3VyY2VzLnByb3Bvc2VkX3RhcmdldC5pZCB8fCAwICkgIT09IE51bWJlciggcHJvcG9zYWwudGFyZ2V0X3Jlc291cmNlX2lkIClcblx0XHRcdFx0fHwgQm9vbGVhbiggcmV2aWV3X3Jlc291cmNlcy5yZXNvdXJjZV9jaGFuZ2VkICkgIT09IGV4cGVjdGVkX3Jlc291cmNlX2NoYW5nZVxuXHRcdFx0XHR8fCAhIHJlc3BvbnNlLnBsYW5cblx0XHRcdFx0fHwgISAvXlthLWYwLTldezY0fSQvaS50ZXN0KCB0b2tlbiApXG5cdFx0XHRcdHx8IE51bWJlciggcmVzcG9uc2UuZXhwaXJlc19hdCB8fCAwICkgPD0gRGF0ZS5ub3coKSAvIDEwMDBcblx0XHRcdFx0fHwgISBhcHBseV90cmFuc3BvcnQudXJsXG5cdFx0XHRcdHx8ICEgYXBwbHlfdHJhbnNwb3J0LmFjdGlvblxuXHRcdFx0XHR8fCAhIGFwcGx5X3RyYW5zcG9ydC5ub25jZVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldmlld19tZW1vcnkgPSBPYmplY3QuZnJlZXplKCB7XG5cdFx0XHRcdGJvb2tpbmdfaWQ6IHByb3Bvc2FsLmJvb2tpbmdfaWQsXG5cdFx0XHRcdHBsYW46IHJlc3BvbnNlLnBsYW4sXG5cdFx0XHRcdHRva2VuOiB0b2tlbixcblx0XHRcdFx0ZXhwaXJlc19hdDogTnVtYmVyKCByZXNwb25zZS5leHBpcmVzX2F0ICksXG5cdFx0XHRcdHJldmlld19odG1sOiBjYW5vbmljYWwoIHJldmlldyApXG5cdFx0XHR9ICk7XG5cdFx0XHRsaWZlY3ljbGVfc3RhdGUgPSAncmV2aWV3X3JlYWR5JztcblxuXHRcdFx0cmV0dXJuIHJlbmRlcl9zaWduZWRfcmV2aWV3KCBpMThuLnJldmlld19yZWFkeSB8fCAnJywgeyBjYW5fY2FuY2VsOiB0cnVlLCBjYW5fYXBwbHk6IHRydWUgfSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcXVlc3QgY2Fub25pY2FsIG5vbi1tdXRhdGluZyBSZXZpZXcgZm9yIG9uZSByZXN0b3JlZCBtb3ZlbWVudCBwcm9wb3NhbC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wb3NhbCBGcm96ZW4gYnJvd3NlciBwcm9wb3NhbC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdGUgUmVzdG9yZWQgZ2VzdHVyZSBzdGF0ZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9wZW5fY2Fub25pY2FsX3JldmlldyggcHJvcG9zYWwsIHN0YXRlICkge1xuXHRcdFx0dmFyIHBlbmRpbmc7XG5cdFx0XHR2YXIgbG9hZGluZ19zdGF0ZTtcblx0XHRcdHZhciBlcnJvcl9tZXNzYWdlO1xuXHRcdFx0dmFyIHJlcXVlc3RfZ2VuZXJhdGlvbjtcblxuXHRcdFx0bGlmZWN5Y2xlX2FuY2hvciA9IHtcblx0XHRcdFx0Ym9va2luZ19pZDogcHJvcG9zYWwuYm9va2luZ19pZCxcblx0XHRcdFx0Y2FudmFzX3Njcm9sbDogc3RhdGUuY2FudmFzX3Njcm9sbCxcblx0XHRcdFx0ZG9jX3g6IHN0YXRlLmRvY194LFxuXHRcdFx0XHRkb2NfeTogc3RhdGUuZG9jX3ksXG5cdFx0XHRcdGZvY3VzOiBzdGF0ZS5mb2N1cyxcblx0XHRcdFx0cmVzdG9yZV9mb2N1czogJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHN0YXRlLnJlc3RvcmVfZm9jdXMgPyBzdGF0ZS5yZXN0b3JlX2ZvY3VzIDogbnVsbFxuXHRcdFx0fTtcblx0XHRcdHJlcGxhY2VtZW50X2NhcmQgPSBzdGF0ZS5jYXJkO1xuXHRcdFx0bGlmZWN5Y2xlX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbiA9IGxpZmVjeWNsZV9nZW5lcmF0aW9uO1xuXHRcdFx0bGlmZWN5Y2xlX3N0YXRlID0gJ3Jldmlld19wZW5kaW5nJztcblx0XHRcdGlmICggISByZXZpZXdfdHJhbnNwb3J0LnVybCApIHtcblx0XHRcdFx0ZmluaXNoX3Jldmlld19mYWlsdXJlKCBTdHJpbmcoIGkxOG4ucmV2aWV3X2ZhaWxlZCB8fCAnJyApICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFubm91bmNlKCBpMThuLnJldmlld19sb2FkaW5nIHx8ICcnICk7XG5cdFx0XHRsb2FkaW5nX3N0YXRlID0gYmVnaW5fcmV2aWV3X2xvYWRpbmcoIHN0YXRlLmNhcmQgKTtcblx0XHRcdGxvYWRpbmdfc3RhdGUucHJvY2Vzc2luZ19ub3RpY2UgPSBzaG93X3Byb2Nlc3Npbmdfbm90aWNlKCk7XG5cdFx0XHRwZW5kaW5nID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogcmV2aWV3X3RyYW5zcG9ydC51cmwsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiByZXZpZXdfdHJhbnNwb3J0LmFjdGlvbixcblx0XHRcdFx0XHRub25jZTogcmV2aWV3X3RyYW5zcG9ydC5ub25jZSxcblx0XHRcdFx0XHRib29raW5nX2lkOiBwcm9wb3NhbC5ib29raW5nX2lkLFxuXHRcdFx0XHRcdHNvdXJjZTogcmV2aWV3X3RyYW5zcG9ydC5zb3VyY2UgfHwgJ3RpbWVsaW5lJyxcblx0XHRcdFx0XHRwcm9wb3NhbDogSlNPTi5zdHJpbmdpZnkoIHByb3Bvc2FsIClcblx0XHRcdFx0fVxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdGlmICggcmVxdWVzdF9nZW5lcmF0aW9uICE9PSBsaWZlY3ljbGVfZ2VuZXJhdGlvbiB8fCByZXZpZXdfcmVxdWVzdCAhPT0gcGVuZGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlbmRlcl9yZXZpZXcoIHJlc3BvbnNlLmRhdGEsIHByb3Bvc2FsICkgKSB7XG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IFN0cmluZyggaTE4bi5yZXZpZXdfZmFpbGVkIHx8ICcnICk7XG5cdFx0XHRcdFx0ZmluaXNoX3Jldmlld19mYWlsdXJlKCBlcnJvcl9tZXNzYWdlICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0aWYgKCByZXF1ZXN0X2dlbmVyYXRpb24gIT09IGxpZmVjeWNsZV9nZW5lcmF0aW9uIHx8ICdhYm9ydCcgPT09IHJlcXVlc3Rfc3RhdHVzIHx8IHJldmlld19yZXF1ZXN0ICE9PSBwZW5kaW5nICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZ2V0X3JlcXVlc3RfZXJyb3IoIGZhaWxlZF9yZXF1ZXN0LCBpMThuLnJldmlld19mYWlsZWQgfHwgJycgKS5tZXNzYWdlO1xuXHRcdFx0XHRmaW5pc2hfcmV2aWV3X2ZhaWx1cmUoIGVycm9yX21lc3NhZ2UgKTtcblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0ZW5kX3Jldmlld19sb2FkaW5nKCBsb2FkaW5nX3N0YXRlICk7XG5cdFx0XHRcdGlmICggcmV2aWV3X3JlcXVlc3QgPT09IHBlbmRpbmcgKSB7XG5cdFx0XHRcdFx0cmV2aWV3X3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXZpZXdfcmVxdWVzdCA9IHBlbmRpbmc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWNjZXB0IGEgcHJvcG9zYWwgcHJvZHVjZWQgYnkgYW5vdGhlciByZWdpc3RlcmVkIFRpbWVsaW5lIHByZXNlbnRhdGlvbi5cblx0XHQgKlxuXHRcdCAqIFRoaXMgbWV0aG9kIGFjY2VwdHMgb25seSB0aGUgdHdvIG1vdmVtZW50LXBvbGljeSBwYWlycyBhbHJlYWR5IHVzZWQgYnkgdGhlXG5cdFx0ICogbmF0aXZlIFRpbWVsaW5lOiBgZHJhZyArIHNoaWZ0YCBhbmQgYGNyb3NzX3Jlc291cmNlX2RyYWcgKyBjaGFuZ2VfcmVzb3VyY2VgLlxuXHRcdCAqIEl0IHJlbWFpbnMgcHJlc2VudGF0aW9uLW5ldXRyYWwuIFRoZSBjYW5vbmljYWwgUmV2aWV3IGVuZHBvaW50IHN0aWxsIHJlbG9hZHMgYXV0aG9yaXR5LCB2YWxpZGF0ZXNcblx0XHQgKiBhbGxvY2F0aW9uIGlkZW50aXR5LCBBcHBvaW50bWVudCBydWxlcywgYXZhaWxhYmlsaXR5LCBhbmQgY29uZmxpY3RzIGJlZm9yZVxuXHRcdCAqIGl0IHJldHVybnMgYSBzaWduZWQgQXBwbHkgcGxhbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wb3NhbCBFeGVjdXRhYmxlLWZyZWUgbW92ZW1lbnQgcHJvcG9zYWwuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHN0YXRlICAgIFJlc3RvcmVkIGNhcmQsIHNjcm9sbCwgYW5kIGZvY3VzIGNvbnRleHQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjYW5vbmljYWwgUmV2aWV3IGxpZmVjeWNsZSBzdGFydGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJldmlld19tb3ZlbWVudF9wcm9wb3NhbCggcHJvcG9zYWwsIHN0YXRlICkge1xuXHRcdFx0dmFyIGhhc19kYXRlcyA9IEFycmF5LmlzQXJyYXkoIHByb3Bvc2FsICYmIHByb3Bvc2FsLnByb3Bvc2VkX2RhdGVzICkgJiYgcHJvcG9zYWwucHJvcG9zZWRfZGF0ZXMubGVuZ3RoO1xuXHRcdFx0dmFyIGhhc19pbnRlcnZhbHMgPSBBcnJheS5pc0FycmF5KCBwcm9wb3NhbCAmJiBwcm9wb3NhbC5wcm9wb3NlZF9pbnRlcnZhbHMgKSAmJiBwcm9wb3NhbC5wcm9wb3NlZF9pbnRlcnZhbHMubGVuZ3RoO1xuXHRcdFx0dmFyIGludGVyYWN0aW9uX3NvdXJjZSA9IFN0cmluZyggcHJvcG9zYWwgJiYgcHJvcG9zYWwuaW50ZXJhY3Rpb25fc291cmNlIHx8ICcnICk7XG5cdFx0XHR2YXIgb3BlcmF0aW9uID0gU3RyaW5nKCBwcm9wb3NhbCAmJiBwcm9wb3NhbC5vcGVyYXRpb24gfHwgJycgKTtcblx0XHRcdHZhciBpc19zYW1lX3Jlc291cmNlID0gJ2RyYWcnID09PSBpbnRlcmFjdGlvbl9zb3VyY2UgJiYgJ3NoaWZ0JyA9PT0gb3BlcmF0aW9uO1xuXHRcdFx0dmFyIGlzX2Nyb3NzX3Jlc291cmNlID0gJ2Nyb3NzX3Jlc291cmNlX2RyYWcnID09PSBpbnRlcmFjdGlvbl9zb3VyY2UgJiYgJ2NoYW5nZV9yZXNvdXJjZScgPT09IG9wZXJhdGlvbjtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQnaWRsZScgIT09IGxpZmVjeWNsZV9zdGF0ZVxuXHRcdFx0XHR8fCBnZXN0dXJlXG5cdFx0XHRcdHx8IHJldmlld19yZXF1ZXN0XG5cdFx0XHRcdHx8ICEgcHJvcG9zYWxcblx0XHRcdFx0fHwgTnVtYmVyKCBwcm9wb3NhbC5zY2hlbWFfdmVyc2lvbiApICE9PSBOdW1iZXIoIHJldmlld190cmFuc3BvcnQuc2NoZW1hX3ZlcnNpb24gKVxuXHRcdFx0XHR8fCAhIE51bWJlciggcHJvcG9zYWwuYm9va2luZ19pZCApXG5cdFx0XHRcdHx8ICggISBpc19zYW1lX3Jlc291cmNlICYmICEgaXNfY3Jvc3NfcmVzb3VyY2UgKVxuXHRcdFx0XHR8fCAhIE51bWJlciggcHJvcG9zYWwudGFyZ2V0X3Jlc291cmNlX2lkIClcblx0XHRcdFx0fHwgISBbICdwb2xpY3knLCAnaW5kaXZpZHVhbCcgXS5pbmNsdWRlcyggU3RyaW5nKCBwcm9wb3NhbC5zZWxlY3Rpb25fbWV0aG9kIHx8ICcnICkgKVxuXHRcdFx0XHR8fCAhIE51bWJlciggcHJvcG9zYWwucHJvcG9zYWxfcmV2aXNpb24gKVxuXHRcdFx0XHR8fCAhIFN0cmluZyggcHJvcG9zYWwuc291cmNlX2NvbnRleHRfdG9rZW4gfHwgJycgKVxuXHRcdFx0XHR8fCBCb29sZWFuKCBoYXNfZGF0ZXMgKSA9PT0gQm9vbGVhbiggaGFzX2ludGVydmFscyApXG5cdFx0XHRcdHx8ICEgc3RhdGVcblx0XHRcdFx0fHwgISBzdGF0ZS5jYXJkXG5cdFx0XHRcdHx8ICEgc3RhdGUuY2FyZC5pc0Nvbm5lY3RlZFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdG9wZW5fY2Fub25pY2FsX3JldmlldyggT2JqZWN0LmZyZWV6ZSggcHJvcG9zYWwgKSwgc3RhdGUgKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVmVyaWZ5IHRoZSBtaW5pbXVtIGNhbm9uaWNhbCBpZGVudGl0eSByZXF1aXJlZCBiZWZvcmUgaG9zdCByZWFkYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHQgQ2Fub25pY2FsIEFwcGx5IHJlc3BvbnNlLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBib29raW5nX2lkIEV4cGVjdGVkIGJvb2tpbmcgSUQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXNwb25zZSBjYW4gaWRlbnRpZnkgb25lIHNhdmVkIGJvb2tpbmcuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfYXBwbHlfcmVzdWx0X3ZhbGlkKCByZXN1bHQsIGJvb2tpbmdfaWQgKSB7XG5cdFx0XHR2YXIgaWRlbnRpdHkgPSByZXN1bHQgJiYgcmVzdWx0LmNhbm9uaWNhbF9pZGVudGl0eSA/IHJlc3VsdC5jYW5vbmljYWxfaWRlbnRpdHkgOiBudWxsO1xuXHRcdFx0dmFyIGhvc3RfcmVmcmVzaCA9IHJlc3VsdCAmJiByZXN1bHQuaG9zdF9yZWZyZXNoID8gcmVzdWx0Lmhvc3RfcmVmcmVzaCA6IG51bGw7XG5cblx0XHRcdHJldHVybiBCb29sZWFuKFxuXHRcdFx0XHRyZXN1bHRcblx0XHRcdFx0JiYgTnVtYmVyKCByZXN1bHQuYm9va2luZ19pZCB8fCAwICkgPT09IGJvb2tpbmdfaWRcblx0XHRcdFx0JiYgaWRlbnRpdHlcblx0XHRcdFx0JiYgTnVtYmVyKCBpZGVudGl0eS5ib29raW5nX2lkIHx8IDAgKSA9PT0gYm9va2luZ19pZFxuXHRcdFx0XHQmJiBTdHJpbmcoIGlkZW50aXR5Lm1vZGlmaWNhdGlvbl9kYXRlIHx8ICcnIClcblx0XHRcdFx0JiYgaG9zdF9yZWZyZXNoXG5cdFx0XHRcdCYmIHRydWUgPT09IGhvc3RfcmVmcmVzaC5yZXF1aXJlZFxuXHRcdFx0XHQmJiBOdW1iZXIoIGhvc3RfcmVmcmVzaC5ib29raW5nX2lkIHx8IDAgKSA9PT0gYm9va2luZ19pZFxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEZWNpZGUgd2hldGhlciBhIGZhaWxlZCBBcHBseSBtYXkgaGF2ZSByZWFjaGVkIHBlcnNpc3RlbmNlLlxuXHRcdCAqXG5cdFx0ICogTmV0d29yayBmYWlsdXJlcywgc2VydmVyIGZhaWx1cmVzLCBhbmQgZmFpbGVkIGNvbXBlbnNhdGlvbiBjYW5ub3Qgc2FmZWx5XG5cdFx0ICogcmVzdG9yZSB0aGUgcHJlLUFwcGx5IGNhcmQgZnJvbSBicm93c2VyIG1lbW9yeS4gVGhleSByZXF1aXJlIGNhbm9uaWNhbFxuXHRcdCAqIHJlYWRiYWNrIGJlZm9yZSB0aGUgVGltZWxpbmUgaXMgcHJlc2VudGVkIGFzIHJlc3RvcmVkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZhaWxlZF9yZXF1ZXN0IEZhaWxlZCBqUXVlcnkgcmVxdWVzdC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdF9zdGF0dXMgalF1ZXJ5IHJlcXVlc3Qgc3RhdHVzLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBlcnJvciBOb3JtYWxpemVkIHNlcnZlciBlcnJvci5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gcGVyc2lzdGVuY2Ugb3V0Y29tZSBpcyB1bmNlcnRhaW4uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfdW5jZXJ0YWluX2FwcGx5X2ZhaWx1cmUoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cywgZXJyb3IgKSB7XG5cdFx0XHR2YXIgc3RhdHVzID0gTnVtYmVyKCBmYWlsZWRfcmVxdWVzdCAmJiBmYWlsZWRfcmVxdWVzdC5zdGF0dXMgPyBmYWlsZWRfcmVxdWVzdC5zdGF0dXMgOiAwICk7XG5cblx0XHRcdHJldHVybiAnYWJvcnQnICE9PSByZXF1ZXN0X3N0YXR1cyAmJiAoXG5cdFx0XHRcdCEgc3RhdHVzXG5cdFx0XHRcdHx8IDUwMCA8PSBzdGF0dXNcblx0XHRcdFx0fHwgJ3dwYmNfYm9va2luZ19kYXRlX2VkaXRvcl9jb21wZW5zYXRpb25fZmFpbGVkJyA9PT0gZXJyb3IuY29kZVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIGNhbm9uaWNhbCBzY3JvbGwgYW5kIGZvY3VzIGFmdGVyIG9uZSBjb21wbGV0ZWQgcmVhZGJhY2sgbGlmZWN5Y2xlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGJvb2tpbmdfaWQgQ2Fub25pY2FsIGJvb2tpbmcgSUQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXN0b3JlX2FmdGVyX3JlYWRiYWNrKCBib29raW5nX2lkICkge1xuXHRcdFx0dmFyIGV4cGVjdGVkX2FuY2hvciA9IGxpZmVjeWNsZV9hbmNob3I7XG5cblx0XHRcdHJlc3RvcmVfbGlmZWN5Y2xlX3Njcm9sbCgpO1xuXHRcdFx0cmVzdG9yZV9saWZlY3ljbGVfZm9jdXMoIGJvb2tpbmdfaWQgKTtcblx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBleHBlY3RlZF9hbmNob3IgIT09IGxpZmVjeWNsZV9hbmNob3IgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3RvcmVfbGlmZWN5Y2xlX3Njcm9sbCgpO1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKCBleHBlY3RlZF9hbmNob3IgIT09IGxpZmVjeWNsZV9hbmNob3IgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlc3RvcmVfbGlmZWN5Y2xlX3Njcm9sbCgpO1xuXHRcdFx0XHRcdHJlc3RvcmVfbGlmZWN5Y2xlX2ZvY3VzKCBib29raW5nX2lkICk7XG5cdFx0XHRcdFx0bGlmZWN5Y2xlX2FuY2hvciA9IG51bGw7XG5cdFx0XHRcdFx0cmVwbGFjZW1lbnRfY2FyZCA9IG51bGw7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5pc2ggc3VjY2VzcyBvciBmYWlsdXJlIG9ubHkgYWZ0ZXIgY2Fub25pY2FsIHJlYWRiYWNrIGhhcyBzZXR0bGVkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmaW5pc2hfYWZ0ZXJfcmVhZGJhY2soKSB7XG5cdFx0XHR2YXIgY29tcGxldGlvbiA9IHBlbmRpbmdfY29tcGxldGlvbiB8fCB7fTtcblx0XHRcdHZhciBib29raW5nX2lkID0gcGVuZGluZ19hcHBseV9yZXN1bHQgPyBOdW1iZXIoIHBlbmRpbmdfYXBwbHlfcmVzdWx0LmJvb2tpbmdfaWQgfHwgMCApIDogMDtcblxuXHRcdFx0cmVtb3ZlX3Jldmlld19ob3N0KCk7XG5cdFx0XHRyZXZpZXdfbWVtb3J5ID0gbnVsbDtcblx0XHRcdHBlbmRpbmdfYXBwbHlfcmVzdWx0ID0gbnVsbDtcblx0XHRcdHBlbmRpbmdfY29tcGxldGlvbiA9IG51bGw7XG5cdFx0XHRtb3VudC5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYm9va2luZy1tb3ZlbWVudC1hcHBseS1wZW5kaW5nJyApO1xuXHRcdFx0bGlmZWN5Y2xlX3N0YXRlID0gJ2lkbGUnO1xuXHRcdFx0cmVzdG9yZV9hZnRlcl9yZWFkYmFjayggYm9va2luZ19pZCApO1xuXHRcdFx0YW5ub3VuY2UoIGNvbXBsZXRpb24ubWVzc2FnZSB8fCAnJyApO1xuXHRcdFx0aWYgKCBjb21wbGV0aW9uLm1lc3NhZ2UgJiYgY2FsbGJhY2tzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBjYWxsYmFja3Muc2hvd19hZG1pbl9tZXNzYWdlICkge1xuXHRcdFx0XHRjYWxsYmFja3Muc2hvd19hZG1pbl9tZXNzYWdlKCBjb21wbGV0aW9uLm1lc3NhZ2UsIGNvbXBsZXRpb24udHlwZSB8fCAnc3VjY2VzcycsIE51bWJlciggY29tcGxldGlvbi5kZWxheSApIHx8IDMwMDAgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgYW4gZXhwbGljaXQgcmVhZGJhY2stb25seSByZWNvdmVyeSBhY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9yZWZyZXNoX2Vycm9yKCkge1xuXHRcdFx0bGlmZWN5Y2xlX3N0YXRlID0gJ3JlZnJlc2hfZXJyb3InO1xuXHRcdFx0cmVuZGVyX3NpZ25lZF9yZXZpZXcoIGkxOG4ucmVmcmVzaF9mYWlsZWQgfHwgJycsIHsgY2FuX3JldHJ5X3JlZnJlc2g6IHRydWUgfSApO1xuXHRcdFx0YW5ub3VuY2UoIGkxOG4ucmVmcmVzaF9mYWlsZWQgfHwgJycgKTtcblx0XHRcdHNob3dfcmV2aWV3X2Vycm9yX25vdGljZSggaTE4bi5yZWZyZXNoX2ZhaWxlZCB8fCAnJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZnJlc2ggZXZlcnkgY2Fub25pY2FsIGhvc3QgcHJvamVjdGlvbiBhZnRlciBBcHBseSBvciB1bmNlcnRhaW4gcGVyc2lzdGVuY2UuXG5cdFx0ICpcblx0XHQgKiBSZXRyeWluZyB0aGlzIG1ldGhvZCBjYW4gcmVwZWF0IG9ubHkgcmVhZCBvcGVyYXRpb25zLiBUaGUgc2lnbmVkIEFwcGx5IHBsYW5cblx0XHQgKiBoYXMgYWxyZWFkeSBiZWVuIGRpc2NhcmRlZCBhbmQgaXMgbmV2ZXIgc3VibWl0dGVkIGF1dG9tYXRpY2FsbHkgYWdhaW4uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZnJlc2hfYWZ0ZXJfYXBwbHkoKSB7XG5cdFx0XHR2YXIgcmVmcmVzaF9yZXN1bHQ7XG5cdFx0XHR2YXIgcmVxdWVzdF9nZW5lcmF0aW9uO1xuXG5cdFx0XHRpZiAoICEgcGVuZGluZ19hcHBseV9yZXN1bHQgfHwgJ3JlZnJlc2hfcGVuZGluZycgPT09IGxpZmVjeWNsZV9zdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGlmZWN5Y2xlX3N0YXRlID0gJ3JlZnJlc2hfcGVuZGluZyc7XG5cdFx0XHRtb3VudC5jbGFzc0xpc3QuYWRkKCAnaXMtYm9va2luZy1tb3ZlbWVudC1hcHBseS1wZW5kaW5nJyApO1xuXHRcdFx0cmVuZGVyX3NpZ25lZF9yZXZpZXcoIGkxOG4ucmVmcmVzaGluZyB8fCAnJywgeyBpc19idXN5OiB0cnVlIH0gKTtcblx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbiA9IGxpZmVjeWNsZV9nZW5lcmF0aW9uO1xuXHRcdFx0aWYgKCAhIGNhbGxiYWNrcyB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgY2FsbGJhY2tzLnJlZnJlc2hfYWZ0ZXJfYXBwbHkgKSB7XG5cdFx0XHRcdHJlbmRlcl9yZWZyZXNoX2Vycm9yKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJlZnJlc2hfcmVzdWx0ID0gY2FsbGJhY2tzLnJlZnJlc2hfYWZ0ZXJfYXBwbHkoIHBlbmRpbmdfYXBwbHlfcmVzdWx0ICk7XG5cdFx0XHR9IGNhdGNoICggcmVmcmVzaF9lcnJvciApIHtcblx0XHRcdFx0cmVmcmVzaF9yZXN1bHQgPSB3aW5kb3cualF1ZXJ5LkRlZmVycmVkKCkucmVqZWN0KCByZWZyZXNoX2Vycm9yICkucHJvbWlzZSgpO1xuXHRcdFx0fVxuXHRcdFx0d2luZG93LmpRdWVyeS53aGVuKCByZWZyZXNoX3Jlc3VsdCApLmRvbmUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBpc19kZXN0cm95ZWQgfHwgcmVxdWVzdF9nZW5lcmF0aW9uICE9PSBsaWZlY3ljbGVfZ2VuZXJhdGlvbiB8fCAhIHBlbmRpbmdfYXBwbHlfcmVzdWx0ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRmaW5pc2hfYWZ0ZXJfcmVhZGJhY2soKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggaXNfZGVzdHJveWVkIHx8IHJlcXVlc3RfZ2VuZXJhdGlvbiAhPT0gbGlmZWN5Y2xlX2dlbmVyYXRpb24gfHwgISBwZW5kaW5nX2FwcGx5X3Jlc3VsdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVuZGVyX3JlZnJlc2hfZXJyb3IoKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5pc2ggYSBrbm93biBub24tcGVyc2lzdGVudCBBcHBseSByZWplY3Rpb24gYXQgdGhlIG9yaWdpbmFsIGNhcmQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZXJyb3JfbWVzc2FnZSBBdXRob3JpemVkIHBsYWluLXRleHQgZXJyb3IuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmaW5pc2hfYXBwbHlfcmVqZWN0aW9uKCBlcnJvcl9tZXNzYWdlICkge1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBsaWZlY3ljbGVfYW5jaG9yID8gbGlmZWN5Y2xlX2FuY2hvci5ib29raW5nX2lkIDogMDtcblxuXHRcdFx0cmV2aWV3X21lbW9yeSA9IG51bGw7XG5cdFx0XHRyZW1vdmVfcmV2aWV3X2hvc3QoKTtcblx0XHRcdG1vdW50LmNsYXNzTGlzdC5yZW1vdmUoICdpcy1ib29raW5nLW1vdmVtZW50LWFwcGx5LXBlbmRpbmcnICk7XG5cdFx0XHRsaWZlY3ljbGVfc3RhdGUgPSAnaWRsZSc7XG5cdFx0XHRyZXN0b3JlX2xpZmVjeWNsZV9zY3JvbGwoKTtcblx0XHRcdHJlc3RvcmVfbGlmZWN5Y2xlX2ZvY3VzKCBib29raW5nX2lkICk7XG5cdFx0XHRhbm5vdW5jZSggZXJyb3JfbWVzc2FnZSApO1xuXHRcdFx0c2hvd19yZXZpZXdfZXJyb3Jfbm90aWNlKCBlcnJvcl9tZXNzYWdlICk7XG5cdFx0XHRsaWZlY3ljbGVfYW5jaG9yID0gbnVsbDtcblx0XHRcdHJlcGxhY2VtZW50X2NhcmQgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvcmNlIGNhbm9uaWNhbCByZWFkYmFjayB3aGVuIEFwcGx5IHBlcnNpc3RlbmNlIGNhbm5vdCBiZSBpbmZlcnJlZCBzYWZlbHkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gYm9va2luZ19pZCBDYW5vbmljYWwgYm9va2luZyBJRC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZXJyb3JfbWVzc2FnZSBFcnJvciB0byBkaXNwbGF5IGFmdGVyIHN1Y2Nlc3NmdWwgcmVhZGJhY2suXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWNvdmVyX3VuY2VydGFpbl9hcHBseSggYm9va2luZ19pZCwgZXJyb3JfbWVzc2FnZSApIHtcblx0XHRcdHJldmlld19tZW1vcnkgPSByZXZpZXdfbWVtb3J5ID8gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdFx0XHRib29raW5nX2lkOiByZXZpZXdfbWVtb3J5LmJvb2tpbmdfaWQsXG5cdFx0XHRcdHBsYW46IG51bGwsXG5cdFx0XHRcdHRva2VuOiAnJyxcblx0XHRcdFx0ZXhwaXJlc19hdDogMCxcblx0XHRcdFx0cmV2aWV3X2h0bWw6IHJldmlld19tZW1vcnkucmV2aWV3X2h0bWxcblx0XHRcdH0gKSA6IG51bGw7XG5cdFx0XHRwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IHsgYm9va2luZ19pZDogYm9va2luZ19pZCwgY2hhbmdlZDogZmFsc2UsIHJlY292ZXJ5X3JlYWRiYWNrOiB0cnVlIH07XG5cdFx0XHRwZW5kaW5nX2NvbXBsZXRpb24gPSB7IG1lc3NhZ2U6IGVycm9yX21lc3NhZ2UsIHR5cGU6ICdlcnJvcicsIGRlbGF5OiAxMDAwMCB9O1xuXHRcdFx0cmVmcmVzaF9hZnRlcl9hcHBseSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN1Ym1pdCB0aGUgc2lnbmVkIFJldmlldyBleGFjdGx5IG9uY2UgYW5kIG5ldmVyIHJldHJ5IGl0cyBtdXRhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVxdWVzdF9hcHBseSgpIHtcblx0XHRcdHZhciBhcHBseV9tZW1vcnk7XG5cdFx0XHR2YXIgYm9va2luZ19pZDtcblx0XHRcdHZhciByZXF1ZXN0X2dlbmVyYXRpb247XG5cdFx0XHR2YXIgcGVuZGluZztcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQncmV2aWV3X3JlYWR5JyAhPT0gbGlmZWN5Y2xlX3N0YXRlXG5cdFx0XHRcdHx8IGFwcGx5X3JlcXVlc3Rcblx0XHRcdFx0fHwgcGVuZGluZ19hcHBseV9yZXN1bHRcblx0XHRcdFx0fHwgISByZXZpZXdfbWVtb3J5XG5cdFx0XHRcdHx8ICEgcmV2aWV3X21lbW9yeS5wbGFuXG5cdFx0XHRcdHx8ICEgL15bYS1mMC05XXs2NH0kL2kudGVzdCggU3RyaW5nKCByZXZpZXdfbWVtb3J5LnRva2VuIHx8ICcnICkgKVxuXHRcdFx0XHR8fCAhIGFwcGx5X3RyYW5zcG9ydC51cmxcblx0XHRcdFx0fHwgISBhcHBseV90cmFuc3BvcnQuYWN0aW9uXG5cdFx0XHRcdHx8ICEgYXBwbHlfdHJhbnNwb3J0Lm5vbmNlXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXBwbHlfbWVtb3J5ID0gcmV2aWV3X21lbW9yeTtcblx0XHRcdGJvb2tpbmdfaWQgPSByZXZpZXdfbWVtb3J5LmJvb2tpbmdfaWQ7XG5cdFx0XHRyZXF1ZXN0X2dlbmVyYXRpb24gPSBsaWZlY3ljbGVfZ2VuZXJhdGlvbjtcblx0XHRcdGxpZmVjeWNsZV9zdGF0ZSA9ICdhcHBseV9wZW5kaW5nJztcblx0XHRcdG1vdW50LmNsYXNzTGlzdC5hZGQoICdpcy1ib29raW5nLW1vdmVtZW50LWFwcGx5LXBlbmRpbmcnICk7XG5cdFx0XHRyZW5kZXJfc2lnbmVkX3JldmlldyggaTE4bi5hcHBseWluZyB8fCAnJywgeyBpc19idXN5OiB0cnVlIH0gKTtcblx0XHRcdGFwcGx5X3Byb2Nlc3Npbmdfbm90aWNlID0gc2hvd19wcm9jZXNzaW5nX25vdGljZSgpO1xuXHRcdFx0cGVuZGluZyA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0XHR1cmw6IGFwcGx5X3RyYW5zcG9ydC51cmwsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiBhcHBseV90cmFuc3BvcnQuYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiBhcHBseV90cmFuc3BvcnQubm9uY2UsXG5cdFx0XHRcdFx0Ym9va2luZ19pZDogYm9va2luZ19pZCxcblx0XHRcdFx0XHRzb3VyY2U6IGFwcGx5X3RyYW5zcG9ydC5zb3VyY2UgfHwgJ3RpbWVsaW5lJyxcblx0XHRcdFx0XHRzZW5kX21vZGlmaWVkX2VtYWlsOiBnZXRfc2VuZF9tb2RpZmllZF9lbWFpbF9pbnRlbnQoKSxcblx0XHRcdFx0XHRwbGFuOiBKU09OLnN0cmluZ2lmeSggYXBwbHlfbWVtb3J5LnBsYW4gKSxcblx0XHRcdFx0XHR0b2tlbjogYXBwbHlfbWVtb3J5LnRva2VuXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgcmVzdWx0ID0gcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyA/IHJlc3BvbnNlLmRhdGEgOiBudWxsO1xuXG5cdFx0XHRcdGlmICggaXNfZGVzdHJveWVkIHx8IHJlcXVlc3RfZ2VuZXJhdGlvbiAhPT0gbGlmZWN5Y2xlX2dlbmVyYXRpb24gfHwgYXBwbHlfcmVxdWVzdCAhPT0gcGVuZGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV2aWV3X21lbW9yeSA9IE9iamVjdC5mcmVlemUoIHtcblx0XHRcdFx0XHRib29raW5nX2lkOiBhcHBseV9tZW1vcnkuYm9va2luZ19pZCxcblx0XHRcdFx0XHRwbGFuOiBudWxsLFxuXHRcdFx0XHRcdHRva2VuOiAnJyxcblx0XHRcdFx0XHRleHBpcmVzX2F0OiAwLFxuXHRcdFx0XHRcdHJldmlld19odG1sOiBhcHBseV9tZW1vcnkucmV2aWV3X2h0bWxcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiAoICEgaXNfYXBwbHlfcmVzdWx0X3ZhbGlkKCByZXN1bHQsIGJvb2tpbmdfaWQgKSApIHtcblx0XHRcdFx0XHRyZWNvdmVyX3VuY2VydGFpbl9hcHBseSggYm9va2luZ19pZCwgaTE4bi5hcHBseV9mYWlsZWQgfHwgJycgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cGVuZGluZ19hcHBseV9yZXN1bHQgPSByZXN1bHQ7XG5cdFx0XHRcdHBlbmRpbmdfY29tcGxldGlvbiA9IHsgbWVzc2FnZTogaTE4bi5hcHBsaWVkIHx8ICcnLCB0eXBlOiAnc3VjY2VzcycsIGRlbGF5OiAzMDAwIH07XG5cdFx0XHRcdHJlZnJlc2hfYWZ0ZXJfYXBwbHkoKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0dmFyIGVycm9yO1xuXG5cdFx0XHRcdGlmICggaXNfZGVzdHJveWVkIHx8IHJlcXVlc3RfZ2VuZXJhdGlvbiAhPT0gbGlmZWN5Y2xlX2dlbmVyYXRpb24gfHwgJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgYXBwbHlfcmVxdWVzdCAhPT0gcGVuZGluZyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXJyb3IgPSBnZXRfcmVxdWVzdF9lcnJvciggZmFpbGVkX3JlcXVlc3QsIGkxOG4uYXBwbHlfZmFpbGVkIHx8ICcnICk7XG5cdFx0XHRcdGlmICggaXNfdW5jZXJ0YWluX2FwcGx5X2ZhaWx1cmUoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cywgZXJyb3IgKSApIHtcblx0XHRcdFx0XHRyZWNvdmVyX3VuY2VydGFpbl9hcHBseSggYm9va2luZ19pZCwgZXJyb3IubWVzc2FnZSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRmaW5pc2hfYXBwbHlfcmVqZWN0aW9uKCBlcnJvci5tZXNzYWdlICk7XG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGhpZGVfcHJvY2Vzc2luZ19ub3RpY2UoIGFwcGx5X3Byb2Nlc3Npbmdfbm90aWNlICk7XG5cdFx0XHRcdGFwcGx5X3Byb2Nlc3Npbmdfbm90aWNlID0gbnVsbDtcblx0XHRcdFx0aWYgKCBhcHBseV9yZXF1ZXN0ID09PSBwZW5kaW5nICkge1xuXHRcdFx0XHRcdGFwcGx5X3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRhcHBseV9yZXF1ZXN0ID0gcGVuZGluZztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWFkIHRoZSBsaXZlIFRpbWVsaW5lIG5vdGlmaWNhdGlvbiBwcmVmZXJlbmNlIGF0IG11dGF0aW9uIHRpbWUuXG5cdFx0ICpcblx0XHQgKiBSZXZpZXcgaXMgaW50ZW50aW9uYWxseSBub24tbXV0YXRpbmcsIHNvIHRoZSBjdXJyZW50IHRvZ2dsZSB2YWx1ZSBtdXN0IGJlXG5cdFx0ICogcmVhZCBvbmx5IHdoZW4gQXBwbHkgaXMgc3VibWl0dGVkIHJhdGhlciB0aGFuIHN0b3JlZCBpbiB0aGUgc2lnbmVkIHBsYW4uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IE9uZSB3aGVuIHRoZSBNb2RpZmllZCBlbWFpbCB3YXMgcmVxdWVzdGVkOyBvdGhlcndpc2UgemVyby5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2VuZF9tb2RpZmllZF9lbWFpbF9pbnRlbnQoKSB7XG5cdFx0XHR2YXIgZW1haWxfdG9nZ2xlO1xuXG5cdFx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgZG9jdW1lbnQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IgKSB7XG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fVxuXHRcdFx0ZW1haWxfdG9nZ2xlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2VuZC1tb2RpZmllZC1lbWFpbF0nICk7XG5cblx0XHRcdHJldHVybiBlbWFpbF90b2dnbGUgJiYgZW1haWxfdG9nZ2xlLmNoZWNrZWQgPyAxIDogMDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIHRoZSBjYW5vbmljYWwgY2FyZCBiZWZvcmUgY29uc3RydWN0aW5nIGFuZCByZXZpZXdpbmcgdGhlIHByb3Bvc2FsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGV2ZW50IFNvcnRhYmxlIGNvbXBsZXRpb24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvbl9lbmQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIHN0YXRlID0gZ2VzdHVyZTtcblx0XHRcdHZhciBkcm9wX2NhbmRpZGF0ZTtcblx0XHRcdHZhciBwcm9wb3NhbDtcblx0XHRcdHZhciBkZXN0aW5hdGlvbl9yZXN0cmljdGlvbjtcblx0XHRcdGlmICggISBzdGF0ZSApIHsgcmV0dXJuOyB9XG5cdFx0XHRkZXN0aW5hdGlvbl9yZXN0cmljdGlvbiA9IGdldF9jYW5kaWRhdGVfcmVzdHJpY3Rpb24oIHN0YXRlLCBzdGF0ZS5jYW5kaWRhdGUgKTtcblx0XHRcdGZyZWV6ZV9kcm9wX2ludGVudCggc3RhdGUgKTtcblx0XHRcdGRyb3BfY2FuZGlkYXRlID0gcmVzb2x2ZV9kcm9wX2NhbmRpZGF0ZSggc3RhdGUgKTtcblx0XHRcdHN0YXRlLmNhbmRpZGF0ZSA9IGRyb3BfY2FuZGlkYXRlO1xuXHRcdFx0aWYgKCAhIGRyb3BfY2FuZGlkYXRlICkgeyBzdGF0ZS5kcm9wX2ludGVudCA9IG51bGw7IH1cblx0XHRcdHJlc3RvcmVfY2FyZCggc3RhdGUgKTsgcmVsZWFzZSggc3RhdGUgKTsgZ2VzdHVyZSA9IG51bGw7XG5cdFx0XHRwcm9wb3NhbCA9IHByb3Bvc2FsX2Zyb20oIHN0YXRlICk7XG5cdFx0XHRpZiAoIHN0YXRlLmNhbnZhcyApIHsgc3RhdGUuY2FudmFzLnNjcm9sbExlZnQgPSBzdGF0ZS5jYW52YXNfc2Nyb2xsOyB9XG5cdFx0XHR3aW5kb3cuc2Nyb2xsVG8oIHN0YXRlLmRvY194LCBzdGF0ZS5kb2NfeSApO1xuXHRcdFx0aWYgKCBwcm9wb3NhbCApIHtcblx0XHRcdFx0b3Blbl9jYW5vbmljYWxfcmV2aWV3KCBwcm9wb3NhbCwgc3RhdGUgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICggZGVzdGluYXRpb25fcmVzdHJpY3Rpb24gKSB7XG5cdFx0XHRcdFx0c2hvd19kZXN0aW5hdGlvbl93YXJuaW5nKCBkZXN0aW5hdGlvbl9yZXN0cmljdGlvbiApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc3RhdGUuZm9jdXMgJiYgc3RhdGUuZm9jdXMuaXNDb25uZWN0ZWQgKSB7IHN0YXRlLmZvY3VzLmZvY3VzKCk7IH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYW5jZWwgYW5kIHJlc3RvcmUgRE9NLCBzY3JvbGwsIGZvY3VzLCBzZWxlY3Rpb24sIGFuZCBsb2Nrcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9zY3JvbGwgV2hldGhlciB0byByZXN0b3JlIHNjcm9sbCBhbmNob3JzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2FuY2VsKCByZXN0b3JlX3Njcm9sbCApIHtcblx0XHRcdHZhciBzdGF0ZSA9IGdlc3R1cmU7XG5cdFx0XHRpZiAoICEgc3RhdGUgKSB7IHJldHVybjsgfVxuXHRcdFx0cmVzdG9yZV9jYXJkKCBzdGF0ZSApOyByZWxlYXNlKCBzdGF0ZSApOyBnZXN0dXJlID0gbnVsbDtcblx0XHRcdGlmICggcmVzdG9yZV9zY3JvbGwgKSB7XG5cdFx0XHRcdGlmICggc3RhdGUuY2FudmFzICkgeyBzdGF0ZS5jYW52YXMuc2Nyb2xsTGVmdCA9IHN0YXRlLmNhbnZhc19zY3JvbGw7IH1cblx0XHRcdFx0d2luZG93LnNjcm9sbFRvKCBzdGF0ZS5kb2NfeCwgc3RhdGUuZG9jX3kgKTtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhdGUuZm9jdXMgJiYgc3RhdGUuZm9jdXMuaXNDb25uZWN0ZWQgKSB7IHN0YXRlLmZvY3VzLmZvY3VzKCk7IH1cblx0XHRcdGFubm91bmNlKCBpMThuLmNhbmNlbGxlZCB8fCAnJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFByZXNlcnZlIHRoZSBhbHJlYWR5LXJlbmRlcmVkIHZpc3VhbCBpbnRlbnQgYXQgcG9pbnRlciBjb21wbGV0aW9uLlxuXHRcdCAqXG5cdFx0ICogU29ydGFibGUgbWF5IGludm9rZSBgb25FbmRgIGZyb20gaXRzIG93biBlYXJsaWVyLXJlZ2lzdGVyZWQgZG9jdW1lbnQgbGlzdGVuZXJcblx0XHQgKiBiZWZvcmUgdGhpcyBsaXN0ZW5lciBydW5zLiBDb3JyZWN0bmVzcyB0aGVyZWZvcmUgY29tZXMgZnJvbSB0aGUgdmlzdWFsIGludGVudFxuXHRcdCAqIGNhcHR1cmVkIGR1cmluZyBwb2ludGVyIG1vdmVtZW50LCBub3QgZnJvbSB0aGlzIGxpc3RlbmVyJ3MgZXhlY3V0aW9uIG9yZGVyLlxuXHRcdCAqIFRoZSBkZWZlcnJlZCBjYW5jZWxsYXRpb24gcmVtYWlucyBhIGZhaWwtc2FmZSB3aGVuIFNvcnRhYmxlIG5ldmVyIGRpc3BhdGNoZXNcblx0XHQgKiBgb25FbmRgIGFmdGVyIHRoZSBwb2ludGVyIGlzIHJlbGVhc2VkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXIgY29tcGxldGlvbiBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9uX3BvaW50ZXJfY29tcGxldGlvbiggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZGVzdGluYXRpb25fcmVzdHJpY3Rpb24gPSAnJztcblxuXHRcdFx0aWYgKCBnZXN0dXJlICkge1xuXHRcdFx0XHRkZXN0aW5hdGlvbl9yZXN0cmljdGlvbiA9IGdldF9jYW5kaWRhdGVfcmVzdHJpY3Rpb24oIGdlc3R1cmUsIGdlc3R1cmUuY2FuZGlkYXRlICk7XG5cdFx0XHRcdGZyZWV6ZV9kcm9wX2ludGVudCggZ2VzdHVyZSApO1xuXHRcdFx0fVxuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBnZXN0dXJlICkge1xuXHRcdFx0XHRcdGNhbmNlbCggdHJ1ZSApO1xuXHRcdFx0XHRcdGlmICggZGVzdGluYXRpb25fcmVzdHJpY3Rpb24gKSB7XG5cdFx0XHRcdFx0XHRzaG93X2Rlc3RpbmF0aW9uX3dhcm5pbmcoIGRlc3RpbmF0aW9uX3Jlc3RyaWN0aW9uICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LCAwICk7XG5cdFx0fVxuXHRcdC8qKiBDYW5jZWwgYWZ0ZXIgbG9zdCBwb2ludGVyIGNvbXBsZXRpb24uIEByZXR1cm4ge3ZvaWR9ICovXG5cdFx0ZnVuY3Rpb24gb25fbG9zdF9wb2ludGVyKCkgeyBjYW5jZWwoIHRydWUgKTsgfVxuXHRcdC8qKlxuXHRcdCAqIEtlZXAga2V5Ym9hcmQgZm9jdXMgd2l0aGluIHRoZSBtb3ZlbWVudCBSZXZpZXcgZGlhbG9nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBLZXlib2FyZCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRyYXBfcmV2aWV3X2ZvY3VzKCBldmVudCApIHtcblx0XHRcdHZhciBjb250cm9scztcblx0XHRcdHZhciBmaXJzdDtcblx0XHRcdHZhciBsYXN0O1xuXG5cdFx0XHRpZiAoICdUYWInICE9PSBldmVudC5rZXkgfHwgISByZXZpZXdfaG9zdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29udHJvbHMgPSBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoXG5cdFx0XHRcdHJldmlld19ob3N0LnF1ZXJ5U2VsZWN0b3JBbGwoICdidXR0b246bm90KFtkaXNhYmxlZF0pLCBbaHJlZl0sIGlucHV0Om5vdChbZGlzYWJsZWRdKSwgc2VsZWN0Om5vdChbZGlzYWJsZWRdKSwgdGV4dGFyZWE6bm90KFtkaXNhYmxlZF0pLCBbdGFiaW5kZXhdOm5vdChbdGFiaW5kZXg9XCItMVwiXSknICksXG5cdFx0XHRcdGZ1bmN0aW9uICggY29udHJvbCApIHsgcmV0dXJuICEgY29udHJvbC5oaWRkZW4gJiYgbnVsbCAhPT0gY29udHJvbC5vZmZzZXRQYXJlbnQ7IH1cblx0XHRcdCk7XG5cdFx0XHRpZiAoICEgY29udHJvbHMubGVuZ3RoICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmaXJzdCA9IGNvbnRyb2xzWzBdO1xuXHRcdFx0bGFzdCA9IGNvbnRyb2xzWyBjb250cm9scy5sZW5ndGggLSAxIF07XG5cdFx0XHRpZiAoIGV2ZW50LnNoaWZ0S2V5ICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGZpcnN0ICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRsYXN0LmZvY3VzKCk7XG5cdFx0XHR9IGVsc2UgaWYgKCAhIGV2ZW50LnNoaWZ0S2V5ICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGxhc3QgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGZpcnN0LmZvY3VzKCk7XG5cdFx0XHR9IGVsc2UgaWYgKCAhIHJldmlld19ob3N0LmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGZpcnN0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FuY2VsIG1vdmVtZW50IG9yIGNsb3NlIFJldmlldyB3aXRoIEVzY2FwZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgS2V5Ym9hcmQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvbl9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdGlmICggJ0VzY2FwZScgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0aWYgKCBnZXN0dXJlICkgeyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyBjYW5jZWwoIHRydWUgKTsgfSBlbHNlIGlmICggcmV2aWV3X3JlcXVlc3QgfHwgcmV2aWV3X2xvYWRpbmdfc3RhdGUgfHwgcmV2aWV3X2hvc3QgKSB7IGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IGNsb3NlX3JldmlldygpOyB9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyYXBfcmV2aWV3X2ZvY3VzKCBldmVudCApO1xuXHRcdH1cblx0XHQvKipcblx0XHQgKiBDYW5jZWwgb25seSBhbiB1bmZpbmlzaGVkIHBvaW50ZXIgZ2VzdHVyZSB3aGVuIGJyb3dzZXIgZm9jdXMgbGVhdmVzLlxuXHRcdCAqXG5cdFx0ICogQSBjb21wbGV0ZWQgZHJvcCBhbHJlYWR5IG93bnMgYSBjYW5vbmljYWwgUmV2aWV3IHJlcXVlc3QuIEJyb3dzZXIgY2hyb21lLFxuXHRcdCAqIGRldmVsb3BlciB0b29scywgcGFzc3dvcmQgbWFuYWdlcnMsIGFuZCBvcGVyYXRpbmctc3lzdGVtIGRpYWxvZ3MgY2FuIGJsdXJcblx0XHQgKiB0aGUgY29udGVudCB3aW5kb3cgd2l0aG91dCBuYXZpZ2F0aW9uLCBzbyBibHVyIG11c3Qgbm90IGFib3J0IHRoYXQgcmVxdWVzdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb25fYmx1cigpIHtcblx0XHRcdGlmICggZ2VzdHVyZSApIHtcblx0XHRcdFx0Y2FuY2VsKCB0cnVlICk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBvbmx5IGFuIHVuZmluaXNoZWQgcG9pbnRlciBnZXN0dXJlIHdoZW4gdGhlIGRvY3VtZW50IGlzIGhpZGRlbi5cblx0XHQgKlxuXHRcdCAqIEEgcGVuZGluZyByZWFkLW9ubHkgUmV2aWV3IG1heSBzYWZlbHkgc2V0dGxlIHdoaWxlIGl0cyB0YWIgaXMgdGVtcG9yYXJpbHlcblx0XHQgKiBoaWRkZW4uIEl0cyByZXF1ZXN0LW93bmVkIGxvYWRpbmcgc3RhdGUgcmVtYWlucyB2aXNpYmxlIHdoZW4gZm9jdXMgcmV0dXJucy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb25fdmlzaWJpbGl0eSgpIHtcblx0XHRcdGlmICggZG9jdW1lbnQuaGlkZGVuICYmIGdlc3R1cmUgKSB7XG5cdFx0XHRcdGNhbmNlbCggdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCBhbGwgbW92ZW1lbnQgd29yayB3aGVuIHRoZSBwYWdlIGlzIGFjdHVhbGx5IGJlaW5nIGRpc2NhcmRlZC5cblx0XHQgKlxuXHRcdCAqIFVubGlrZSBhIHRlbXBvcmFyeSBibHVyLCBwYWdlaGlkZSBpcyBhIG5hdmlnYXRpb24vdGVhcmRvd24gYm91bmRhcnkgYW5kIG5vXG5cdFx0ICogUmV2aWV3IFVJIGNhbiBiZSBkZWxpdmVyZWQgaW50byB0aGUgZGVwYXJ0aW5nIGRvY3VtZW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvbl9wYWdlX2hpZGUoKSB7XG5cdFx0XHRjYW5jZWwoIHRydWUgKTtcblx0XHRcdGZvcmNlX2xpZmVjeWNsZV90ZWFyZG93bigpO1xuXHRcdH1cblxuXHRcdC8qKiBEZXN0cm95IG1vdmVtZW50LW93bmVkIFNvcnRhYmxlIGluc3RhbmNlcy4gQHJldHVybiB7dm9pZH0gKi9cblx0XHRmdW5jdGlvbiBkZXN0cm95X3NvcnRhYmxlcygpIHtcblx0XHRcdHNvcnRhYmxlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHNvcnRhYmxlICkgeyBpZiAoIHNvcnRhYmxlICYmIHNvcnRhYmxlLmRlc3Ryb3kgKSB7IHNvcnRhYmxlLmRlc3Ryb3koKTsgfSB9ICk7XG5cdFx0XHRzb3J0YWJsZXMgPSBbXTtcblx0XHR9XG5cblx0XHQvKiogQ3JlYXRlIFNvcnRhYmxlIHRhcmdldHMgZm9yIHZpc2libGUgUmVzb3VyY2Ugcm93cy4gQHJldHVybiB7dm9pZH0gKi9cblx0XHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9zb3J0YWJsZXMoKSB7XG5cdFx0XHRkZXN0cm95X3NvcnRhYmxlcygpO1xuXHRcdFx0bW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudHNdJyApLmZvckVhY2goIGZ1bmN0aW9uICggcm93ICkge1xuXHRcdFx0XHRzb3J0YWJsZXMucHVzaCggbmV3IHdpbmRvdy5Tb3J0YWJsZSggcm93LCB7XG5cdFx0XHRcdFx0Z3JvdXA6IHsgbmFtZTogZ3JvdXBfbmFtZSwgcHVsbDogdHJ1ZSwgcHV0OiB0cnVlIH0sIHNvcnQ6IGZhbHNlLCBkaXJlY3Rpb246ICdob3Jpem9udGFsJyxcblx0XHRcdFx0XHRoYW5kbGU6ICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctbW92ZW1lbnQtZ3JpcF0nLCBkcmFnZ2FibGU6ICdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctbW92YWJsZT1cInRydWVcIl0nLFxuXHRcdFx0XHRcdGZpbHRlcjogZmlsdGVyX3NlbGVjdG9yLCBwcmV2ZW50T25GaWx0ZXI6IGZhbHNlLCBmb3JjZUZhbGxiYWNrOiB0cnVlLCBmYWxsYmFja09uQm9keTogdHJ1ZSxcblx0XHRcdFx0XHRmYWxsYmFja1RvbGVyYW5jZTogTnVtYmVyKCBzb3J0YWJsZV9jb25maWcuZmFsbGJhY2tfdG9sZXJhbmNlICkgfHwgOCwgYW5pbWF0aW9uOiAwLFxuXHRcdFx0XHRcdGVtcHR5SW5zZXJ0VGhyZXNob2xkOiBOdW1iZXIoIHNvcnRhYmxlX2NvbmZpZy5lbXB0eV9pbnNlcnRfdGhyZXNob2xkICkgfHwgMTgsIHNjcm9sbDogZmFsc2UsXG5cdFx0XHRcdFx0ZmFsbGJhY2tDbGFzczogJ3dwYmNfdGltZWxpbmVfYm9va2luZ19tb3ZlbWVudF9fc29ydGFibGUtZmFsbGJhY2snLCBnaG9zdENsYXNzOiAnd3BiY190aW1lbGluZV9ib29raW5nX21vdmVtZW50X19zb3J0YWJsZS1naG9zdCcsIGNob3NlbkNsYXNzOiAnd3BiY190aW1lbGluZV9ib29raW5nX21vdmVtZW50X19zb3J0YWJsZS1jaG9zZW4nLFxuXHRcdFx0XHRcdG9uQ2hvb3NlOiBvbl9jaG9vc2UsIG9uQ2xvbmU6IG9uX2Nsb25lLCBvblN0YXJ0OiBvbl9zdGFydCwgb25Nb3ZlOiBvbl9tb3ZlLCBvbkVuZDogb25fZW5kXG5cdFx0XHRcdH0gKSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZ2lzdGVyIG9uZSBjYW5vbmljYWwgc2VnbWVudCBEVE8gYWZ0ZXIgcmVuZGVyaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY2FyZCBSZW5kZXJlZCBib29raW5nIGNhcmQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlZ21lbnQgQXV0aG9yaXplZCBzZWdtZW50IERUTy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlZ2lzdGVyX3NlZ21lbnQoIGNhcmQsIHNlZ21lbnQgKSB7XG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IE51bWJlciggc2VnbWVudC5ib29raW5nX2lkICk7XG5cdFx0XHR2YXIgcmVjb3JkO1xuXG5cdFx0XHRpZiAoIGNhcmQgJiYgYm9va2luZ19pZCAmJiBzZWdtZW50LnNlZ21lbnRfaWQgJiYgc2VnbWVudC52aXNpYmxlX3N0YXJ0ICYmIHNlZ21lbnQudmlzaWJsZV9lbmQgKSB7XG5cdFx0XHRcdHJlY29yZCA9IHsgY2FyZDogY2FyZCwgcmFpbDogY2FyZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLWNvbnRyb2wtcmFpbF0nICksIGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQsIHJlc291cmNlX2lkOiBOdW1iZXIoIHNlZ21lbnQucmVzb3VyY2VfaWQgKSwgc2VnbWVudF9pZDogU3RyaW5nKCBzZWdtZW50LnNlZ21lbnRfaWQgKSwgdmlzaWJsZV9zdGFydDogU3RyaW5nKCBzZWdtZW50LnZpc2libGVfc3RhcnQgKSwgdmlzaWJsZV9lbmQ6IFN0cmluZyggc2VnbWVudC52aXNpYmxlX2VuZCApLCBzdGF0ZTogJ2lkbGUnLCBnZW5lcmF0aW9uOiAwLCBjb250ZXh0OiBudWxsIH07XG5cdFx0XHRcdHJlY29yZHMuc2V0KCBjYXJkLCByZWNvcmQgKTtcblx0XHRcdFx0dmlzaWJsZV9yZWNvcmRzLnB1c2goIHJlY29yZCApO1xuXHRcdFx0XHRoaWRlX3VucmVzb2x2ZWRfaW5kaWNhdG9yKCByZWNvcmQgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcmVwYXJlIGZvciBjYW5vbmljYWwgVGltZWxpbmUgcmVwbGFjZW1lbnQuXG5cdFx0ICpcblx0XHQgKiBBIHJlYWRiYWNrIHJlcXVlc3RlZCBhZnRlciBBcHBseSBtdXN0IHJldGFpbiBvbmx5IGl0cyBpbW11dGFibGUgcmVzdWx0IGFuZFxuXHRcdCAqIHJlY292ZXJ5IHN0YXRlIHdoaWxlIGV2ZXJ5IHJlbmRlcmVkIGJvb2tpbmcgY2FyZCBpcyBkaXNjYXJkZWQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJlZ2luX3JlZnJlc2goKSB7XG5cdFx0XHR2YXIgcHJlc2VydmVzX2FwcGx5X3JlYWRiYWNrID0gLTEgIT09IFsgJ2FwcGx5X3BlbmRpbmcnLCAncmVmcmVzaF9wZW5kaW5nJywgJ3JlZnJlc2hfZXJyb3InIF0uaW5kZXhPZiggbGlmZWN5Y2xlX3N0YXRlICk7XG5cblx0XHRcdGNhbmNlbCggdHJ1ZSApO1xuXHRcdFx0aWYgKCAhIHByZXNlcnZlc19hcHBseV9yZWFkYmFjayApIHtcblx0XHRcdFx0Y2xvc2VfcmV2aWV3KCk7XG5cdFx0XHR9XG5cdFx0XHRkZXN0cm95X3NvcnRhYmxlcygpO1xuXHRcdFx0Z2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0cmVjb3JkcyA9IG5ldyBXZWFrTWFwKCk7XG5cdFx0XHR2aXNpYmxlX3JlY29yZHMgPSBbXTtcblx0XHRcdHJlcXVlc3RzID0gbmV3IFdlYWtNYXAoKTtcblx0XHRcdHJlcGxhY2VtZW50X2NhcmQgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlYnVpbGQgdGFyZ2V0cyBhbmQgaWRlbnRpZnkgdGhlIGNhbm9uaWNhbCBtb3ZlZCBjYXJkIGFmdGVyIHJlYWRiYWNrLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlbGVjdGlvbl9zdGF0ZSBDYW5vbmljYWwgVGltZWxpbmUgYm9va2luZyBzZWxlY3Rpb24uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb21wbGV0ZV9yZWZyZXNoKCBzZWxlY3Rpb25fc3RhdGUgKSB7XG5cdFx0XHRzeW5jaHJvbml6ZV9zb3J0YWJsZXMoKTtcblx0XHRcdGlmICggcGVuZGluZ19hcHBseV9yZXN1bHQgKSB7XG5cdFx0XHRcdHJlcGxhY2VtZW50X2NhcmQgPSBmaW5kX2Jvb2tpbmdfY2FyZCggTnVtYmVyKCBwZW5kaW5nX2FwcGx5X3Jlc3VsdC5ib29raW5nX2lkIHx8IDAgKSApO1xuXHRcdFx0XHRpZiAoIHNlbGVjdGlvbl9zdGF0ZSAmJiBOdW1iZXIoIHNlbGVjdGlvbl9zdGF0ZS5ib29raW5nX2lkIHx8IDAgKSAhPT0gTnVtYmVyKCBwZW5kaW5nX2FwcGx5X3Jlc3VsdC5ib29raW5nX2lkIHx8IDAgKSApIHtcblx0XHRcdFx0XHRyZXBsYWNlbWVudF9jYXJkID0gZmluZF9ib29raW5nX2NhcmQoIE51bWJlciggcGVuZGluZ19hcHBseV9yZXN1bHQuYm9va2luZ19pZCB8fCAwICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHQvKipcblx0XHQgKiBDYW5jZWwgd2hlbiBmb3JlZ3JvdW5kIGxvYWRpbmcgYmVnaW5zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19sb2FkaW5nIFdoZXRoZXIgbG9hZGluZyBpcyBhY3RpdmUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfcmVxdWVzdF9sb2FkaW5nKCBpc19sb2FkaW5nICkge1xuXHRcdFx0aWYgKCBpc19sb2FkaW5nICYmIC0xID09PSBbICdhcHBseV9wZW5kaW5nJywgJ3JlZnJlc2hfcGVuZGluZycsICdyZWZyZXNoX2Vycm9yJyBdLmluZGV4T2YoIGxpZmVjeWNsZV9zdGF0ZSApICkge1xuXHRcdFx0XHRjYW5jZWwoIHRydWUgKTtcblx0XHRcdFx0Y2xvc2VfcmV2aWV3KCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8qKiBSZXBvcnQgbW92ZW1lbnQgb3duZXJzaGlwLiBAcmV0dXJuIHtib29sZWFufSBPd25lcnNoaXAgc3RhdGUuICovXG5cdFx0ZnVuY3Rpb24gaXNfaW50ZXJhY3RpbmcoKSB7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggZ2VzdHVyZSB8fCByZXZpZXdfcmVxdWVzdCB8fCByZXZpZXdfbG9hZGluZ19zdGF0ZSB8fCByZXZpZXdfaG9zdCB8fCAnaWRsZScgIT09IGxpZmVjeWNsZV9zdGF0ZSApO1xuXHRcdH1cblxuXHRcdC8qKiBJbml0aWFsaXplIGxpc3RlbmVycyBhbmQgbGl2ZSByZWdpb24uIEByZXR1cm4ge3ZvaWR9ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcblx0XHRcdHZhciByZW5kZXJlcjtcblx0XHRcdHZhciBidWZmZXI7XG5cdFx0XHRpZiAoIGluaXRpYWxpemVkIHx8ICEgbW91bnQgKSB7IHJldHVybjsgfVxuXHRcdFx0aW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdFx0aXNfZGVzdHJveWVkID0gZmFsc2U7XG5cdFx0XHRyZW5kZXJlciA9IHRlbXBsYXRlKCB0ZW1wbGF0ZXMubGl2ZV9yZWdpb24gKTtcblx0XHRcdGlmICggcmVuZGVyZXIgKSB7IGJ1ZmZlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApOyBidWZmZXIuaW5uZXJIVE1MID0gcmVuZGVyZXIoIHt9ICk7IGxpdmVfcmVnaW9uID0gYnVmZmVyLmZpcnN0RWxlbWVudENoaWxkOyBpZiAoIGxpdmVfcmVnaW9uICkgeyBtb3VudC5hcHBlbmRDaGlsZCggbGl2ZV9yZWdpb24gKTsgfSB9XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcm92ZXInLCBvbl9jb250ZXh0X2ludGVudCApOyBtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnZm9jdXNpbicsIG9uX2NvbnRleHRfaW50ZW50ICk7IG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVyZG93bicsIG9uX3BvaW50ZXJfZG93biwgdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBvbl9rZXlkb3duICk7IGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd2aXNpYmlsaXR5Y2hhbmdlJywgb25fdmlzaWJpbGl0eSApOyB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ2JsdXInLCBvbl9ibHVyICk7IHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncGFnZWhpZGUnLCBvbl9wYWdlX2hpZGUgKTtcblx0XHRcdHN5bmNocm9uaXplX3NvcnRhYmxlcygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFib3J0IGJyb3dzZXIgd29yayBhbmQgcmVtb3ZlIGFsbCB0cmFuc2llbnQgbGlmZWN5Y2xlIHByZXNlbnRhdGlvbi5cblx0XHQgKlxuXHRcdCAqIFRoaXMgaXMgcmVzZXJ2ZWQgZm9yIG5hdmlnYXRpb24gYW5kIG1vZHVsZSB0ZWFyZG93bi4gSXQgZG9lcyBub3QgcHJlc2VudCBhXG5cdFx0ICogcmVzdG9yZWQgY2FyZCBiZWNhdXNlIHRoZSBvd25pbmcgZG9jdW1lbnQgaXMgYmVpbmcgcmVwbGFjZWQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcmNlX2xpZmVjeWNsZV90ZWFyZG93bigpIHtcblx0XHRcdGxpZmVjeWNsZV9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRpZiAoIHJldmlld19yZXF1ZXN0ICYmIHJldmlld19yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRyZXZpZXdfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhcHBseV9yZXF1ZXN0ICYmIGFwcGx5X3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdGFwcGx5X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdGFwcGx5X3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0aGlkZV9wcm9jZXNzaW5nX25vdGljZSggYXBwbHlfcHJvY2Vzc2luZ19ub3RpY2UgKTtcblx0XHRcdGFwcGx5X3Byb2Nlc3Npbmdfbm90aWNlID0gbnVsbDtcblx0XHRcdGVuZF9yZXZpZXdfbG9hZGluZyggcmV2aWV3X2xvYWRpbmdfc3RhdGUgKTtcblx0XHRcdHJlbW92ZV9yZXZpZXdfaG9zdCgpO1xuXHRcdFx0cmV2aWV3X21lbW9yeSA9IG51bGw7XG5cdFx0XHRwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IG51bGw7XG5cdFx0XHRwZW5kaW5nX2NvbXBsZXRpb24gPSBudWxsO1xuXHRcdFx0bGlmZWN5Y2xlX2FuY2hvciA9IG51bGw7XG5cdFx0XHRyZXBsYWNlbWVudF9jYXJkID0gbnVsbDtcblx0XHRcdHBlbmRpbmdfZ3JpcF9mb2N1c19ib29raW5nX2lkID0gMDtcblx0XHRcdGxpZmVjeWNsZV9zdGF0ZSA9ICdpZGxlJztcblx0XHRcdG1vdW50LmNsYXNzTGlzdC5yZW1vdmUoICdpcy1ib29raW5nLW1vdmVtZW50LWFwcGx5LXBlbmRpbmcnICk7XG5cdFx0fVxuXG5cdFx0LyoqIERlc3Ryb3kgbW92ZW1lbnQtb3duZWQgc3RhdGUgYW5kIGxpc3RlbmVycy4gQHJldHVybiB7dm9pZH0gKi9cblx0XHRmdW5jdGlvbiBkZXN0cm95KCkge1xuXHRcdFx0aWYgKCAhIGluaXRpYWxpemVkICkgeyByZXR1cm47IH1cblx0XHRcdGlzX2Rlc3Ryb3llZCA9IHRydWU7XG5cdFx0XHRjYW5jZWwoIHRydWUgKTsgZm9yY2VfbGlmZWN5Y2xlX3RlYXJkb3duKCk7IGRlc3Ryb3lfc29ydGFibGVzKCk7IGdlbmVyYXRpb24gKz0gMTsgcmVjb3JkcyA9IG5ldyBXZWFrTWFwKCk7IHZpc2libGVfcmVjb3JkcyA9IFtdOyByZXF1ZXN0cyA9IG5ldyBXZWFrTWFwKCk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcm92ZXInLCBvbl9jb250ZXh0X2ludGVudCApOyBtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnZm9jdXNpbicsIG9uX2NvbnRleHRfaW50ZW50ICk7IG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyZG93bicsIG9uX3BvaW50ZXJfZG93biwgdHJ1ZSApO1xuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBvbl9rZXlkb3duICk7IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd2aXNpYmlsaXR5Y2hhbmdlJywgb25fdmlzaWJpbGl0eSApOyB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2JsdXInLCBvbl9ibHVyICk7IHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAncGFnZWhpZGUnLCBvbl9wYWdlX2hpZGUgKTtcblx0XHRcdGlmICggbGl2ZV9yZWdpb24gKSB7IGxpdmVfcmVnaW9uLnJlbW92ZSgpOyBsaXZlX3JlZ2lvbiA9IG51bGw7IH1cblx0XHRcdGluaXRpYWxpemVkID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgaW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSwgZGVzdHJveTogZGVzdHJveSwgYmVnaW5fcmVmcmVzaDogYmVnaW5fcmVmcmVzaCwgcmVnaXN0ZXJfc2VnbWVudDogcmVnaXN0ZXJfc2VnbWVudCwgY29tcGxldGVfcmVmcmVzaDogY29tcGxldGVfcmVmcmVzaCwgc2V0X3JlcXVlc3RfbG9hZGluZzogc2V0X3JlcXVlc3RfbG9hZGluZywgaXNfaW50ZXJhY3Rpbmc6IGlzX2ludGVyYWN0aW5nLCByZXZpZXdfbW92ZW1lbnRfcHJvcG9zYWw6IHJldmlld19tb3ZlbWVudF9wcm9wb3NhbCB9O1xuXHR9XG5cblx0aW50ZXJhY3Rpb25zLnJlZ2lzdGVyX2V4dGVuc2lvbl9mYWN0b3J5KCBjcmVhdGVfY29udHJvbGxlciApO1xuXHRtb2R1bGVzLnJlZ2lzdGVyX2ZhY3RvcnkoICdib29raW5nX21vdmVtZW50JywgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB7IGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHt9LCBkZXN0cm95OiBmdW5jdGlvbiAoKSB7fSwgaXNfYXZhaWxhYmxlOiBmdW5jdGlvbiAoKSB7IHJldHVybiB0cnVlOyB9IH07XG5cdH0gKTtcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQy9CLFlBQVk7O0VBRVosSUFBSUMsT0FBTyxHQUFHRixNQUFNLENBQUNHLHFCQUFxQjtFQUMxQyxJQUFJQyxZQUFZLEdBQUdKLE1BQU0sQ0FBQ0ssa0NBQWtDO0VBQzVELElBQUlDLE1BQU0sR0FBR04sTUFBTSxDQUFDTyxxQ0FBcUMsSUFBSSxDQUFDLENBQUM7RUFFL0QsSUFDQyxDQUFFTCxPQUFPLElBQ04sVUFBVSxLQUFLLE9BQU9BLE9BQU8sQ0FBQ00sZ0JBQWdCLElBQzlDLENBQUVKLFlBQVksSUFDZCxVQUFVLEtBQUssT0FBT0EsWUFBWSxDQUFDSywwQkFBMEIsSUFDN0QsVUFBVSxLQUFLLE9BQU9ULE1BQU0sQ0FBQ1UsUUFBUSxJQUNyQyxDQUFFVixNQUFNLENBQUNXLE1BQU0sSUFDZixDQUFFWCxNQUFNLENBQUNZLEVBQUUsSUFDWCxVQUFVLEtBQUssT0FBT1osTUFBTSxDQUFDWSxFQUFFLENBQUNDLFFBQVEsRUFDMUM7SUFDRDtFQUNEOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGlCQUFpQkEsQ0FBRUMsWUFBWSxFQUFHO0lBQzFDLElBQUlDLEtBQUssR0FBR0QsWUFBWSxDQUFDQyxLQUFLO0lBQzlCLElBQUlDLFNBQVMsR0FBR0YsWUFBWSxDQUFDRSxTQUFTLElBQUksQ0FBQyxDQUFDO0lBQzVDLElBQUlDLFNBQVMsR0FBR1osTUFBTSxDQUFDWSxTQUFTLElBQUksQ0FBQyxDQUFDO0lBQ3RDLElBQUlDLGdCQUFnQixHQUFHYixNQUFNLENBQUNhLGdCQUFnQixJQUFJLENBQUMsQ0FBQztJQUNwRCxJQUFJQyxlQUFlLEdBQUdkLE1BQU0sQ0FBQ2MsZUFBZSxJQUFJLENBQUMsQ0FBQztJQUNsRCxJQUFJQyxlQUFlLEdBQUdmLE1BQU0sQ0FBQ2dCLFFBQVEsSUFBSSxDQUFDLENBQUM7SUFDM0MsSUFBSUMsU0FBUyxHQUFHakIsTUFBTSxDQUFDaUIsU0FBUyxJQUFJLENBQUMsQ0FBQztJQUN0QyxJQUFJQyxJQUFJLEdBQUdsQixNQUFNLENBQUNrQixJQUFJLElBQUksQ0FBQyxDQUFDO0lBQzVCLElBQUlDLE9BQU8sR0FBRyxJQUFJQyxPQUFPLENBQUMsQ0FBQztJQUMzQixJQUFJQyxlQUFlLEdBQUcsRUFBRTtJQUN4QixJQUFJQyxRQUFRLEdBQUcsSUFBSUYsT0FBTyxDQUFDLENBQUM7SUFDNUIsSUFBSUcsU0FBUyxHQUFHLEVBQUU7SUFDbEIsSUFBSUMsVUFBVSxHQUFHLENBQUM7SUFDbEIsSUFBSUMsZUFBZSxHQUFHLElBQUk7SUFDMUIsSUFBSUMsT0FBTyxHQUFHLElBQUk7SUFDbEIsSUFBSUMsY0FBYyxHQUFHLElBQUk7SUFDekIsSUFBSUMsb0JBQW9CLEdBQUcsSUFBSTtJQUMvQixJQUFJQyxXQUFXLEdBQUcsSUFBSTtJQUN0QixJQUFJQyxhQUFhLEdBQUcsSUFBSTtJQUN4QixJQUFJQyxhQUFhLEdBQUcsSUFBSTtJQUN4QixJQUFJQyx1QkFBdUIsR0FBRyxJQUFJO0lBQ2xDLElBQUlDLG9CQUFvQixHQUFHLElBQUk7SUFDL0IsSUFBSUMsa0JBQWtCLEdBQUcsSUFBSTtJQUM3QixJQUFJQyxlQUFlLEdBQUcsTUFBTTtJQUM1QixJQUFJQyxvQkFBb0IsR0FBRyxDQUFDO0lBQzVCLElBQUlDLGdCQUFnQixHQUFHLElBQUk7SUFDM0IsSUFBSUMsNkJBQTZCLEdBQUcsQ0FBQztJQUNyQyxJQUFJQyxnQkFBZ0IsR0FBRyxJQUFJO0lBQzNCLElBQUlDLFdBQVcsR0FBRyxJQUFJO0lBQ3RCLElBQUlDLFlBQVksR0FBRyxDQUFDO0lBQ3BCLElBQUlDLFdBQVcsR0FBRyxLQUFLO0lBQ3ZCLElBQUlDLFlBQVksR0FBRyxLQUFLO0lBQ3hCLElBQUlDLFVBQVUsR0FBRyx5QkFBeUIsR0FBR0MsSUFBSSxDQUFDQyxNQUFNLENBQUMsQ0FBQyxDQUFDQyxRQUFRLENBQUUsRUFBRyxDQUFDLENBQUNDLEtBQUssQ0FBRSxDQUFFLENBQUM7SUFDcEYsSUFBSUMsZUFBZSxHQUFHLENBQ3JCLHVDQUF1QyxFQUN2Qyx3REFBd0QsRUFDeEQsR0FBRyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUNsQywwQ0FBMEMsQ0FDMUMsQ0FBQ0MsSUFBSSxDQUFFLEdBQUksQ0FBQzs7SUFFYjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTM0MsUUFBUUEsQ0FBRTRDLFdBQVcsRUFBRztNQUNoQyxJQUFJO1FBQ0gsT0FBT0EsV0FBVyxHQUFHekQsTUFBTSxDQUFDWSxFQUFFLENBQUNDLFFBQVEsQ0FBRTRDLFdBQVksQ0FBQyxHQUFHLElBQUk7TUFDOUQsQ0FBQyxDQUFDLE9BQVFDLEtBQUssRUFBRztRQUNqQixPQUFPLElBQUk7TUFDWjtJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFFBQVFBLENBQUVDLE9BQU8sRUFBRztNQUM1QixJQUFLZCxXQUFXLEVBQUc7UUFDbEJBLFdBQVcsQ0FBQ2UsV0FBVyxHQUFHQyxNQUFNLENBQUVGLE9BQU8sSUFBSSxFQUFHLENBQUM7TUFDbEQ7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNHLGlCQUFpQkEsQ0FBRUMsUUFBUSxFQUFFQyxNQUFNLEVBQUc7TUFDOUMsSUFBSUMsR0FBRyxHQUFHRixRQUFRLElBQUlBLFFBQVEsQ0FBQ0csT0FBTyxJQUFJSCxRQUFRLENBQUNJLElBQUksR0FBR0osUUFBUSxDQUFDSSxJQUFJLENBQUNDLGdCQUFnQixHQUFHLElBQUk7TUFDL0YsSUFBSUMsSUFBSSxHQUFHSixHQUFHLElBQUlBLEdBQUcsQ0FBQ0ssYUFBYSxHQUFHTCxHQUFHLENBQUNLLGFBQWEsR0FBRyxDQUFDLENBQUM7TUFDNUQsSUFBSUMsWUFBWSxHQUFHTixHQUFHLElBQUlBLEdBQUcsQ0FBQ08sb0JBQW9CLEdBQUdQLEdBQUcsQ0FBQ08sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO01BQ2xGLElBQUlDLFlBQVksR0FBR1IsR0FBRyxJQUFJQSxHQUFHLENBQUNTLG9CQUFvQixHQUFHVCxHQUFHLENBQUNTLG9CQUFvQixHQUFHLENBQUMsQ0FBQztNQUNsRixJQUFJQyxLQUFLLEdBQUdDLEtBQUssQ0FBQ0MsT0FBTyxDQUFFUixJQUFJLENBQUNTLGNBQWUsQ0FBQyxHQUFHVCxJQUFJLENBQUNTLGNBQWMsQ0FBQ0MsR0FBRyxDQUFFbEIsTUFBTyxDQUFDLEdBQUcsRUFBRTtNQUN6RixJQUFJbUIsU0FBUyxHQUFHSixLQUFLLENBQUNDLE9BQU8sQ0FBRVIsSUFBSSxDQUFDWSxlQUFnQixDQUFDLEdBQUdaLElBQUksQ0FBQ1ksZUFBZSxDQUFDRixHQUFHLENBQUUsVUFBV0csUUFBUSxFQUFHO1FBQ3ZHLE9BQU9DLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1VBQUVDLEtBQUssRUFBRXhCLE1BQU0sQ0FBRXFCLFFBQVEsQ0FBQ0csS0FBSyxJQUFJLEVBQUcsQ0FBQztVQUFFQyxHQUFHLEVBQUV6QixNQUFNLENBQUVxQixRQUFRLENBQUNJLEdBQUcsSUFBSSxFQUFHO1FBQUUsQ0FBRSxDQUFDO01BQ3JHLENBQUUsQ0FBQyxHQUFHLEVBQUU7TUFFUixJQUFLLENBQUVyQixHQUFHLElBQUlzQixNQUFNLENBQUV0QixHQUFHLENBQUN1QixVQUFXLENBQUMsS0FBS3hCLE1BQU0sQ0FBQ3dCLFVBQVUsSUFBSSxDQUFFRCxNQUFNLENBQUV0QixHQUFHLENBQUN3QixtQkFBb0IsQ0FBQyxJQUFJLENBQUVGLE1BQU0sQ0FBRXRCLEdBQUcsQ0FBQ3lCLGlCQUFrQixDQUFDLElBQUksQ0FBRTdCLE1BQU0sQ0FBRUksR0FBRyxDQUFDMEIsb0JBQW9CLElBQUksRUFBRyxDQUFDLElBQU0sQ0FBRXBCLFlBQVksQ0FBQ3FCLGFBQWEsSUFBSSxDQUFFckIsWUFBWSxDQUFDc0IsY0FBZ0IsSUFBSSxDQUFFbEIsS0FBSyxDQUFDbUIsTUFBTSxJQUFJLENBQUUsQ0FBRSxRQUFRLEVBQUUsWUFBWSxDQUFFLENBQUNDLFFBQVEsQ0FBRWxDLE1BQU0sQ0FBRVEsSUFBSSxDQUFDMkIsZ0JBQWlCLENBQUUsQ0FBQyxFQUFHO1FBQzNWLE9BQU8sSUFBSTtNQUNaO01BQ0EsSUFBSyxVQUFVLEtBQUszQixJQUFJLENBQUM0QixnQkFBZ0IsS0FBTSxDQUFFakIsU0FBUyxDQUFDYyxNQUFNLElBQUlkLFNBQVMsQ0FBQ2tCLElBQUksQ0FBRSxVQUFXaEIsUUFBUSxFQUFHO1FBQzFHLE9BQU8sQ0FBRWlCLElBQUksQ0FBQ0MsS0FBSyxDQUFFbEIsUUFBUSxDQUFDRyxLQUFNLENBQUMsSUFBSWMsSUFBSSxDQUFDQyxLQUFLLENBQUVsQixRQUFRLENBQUNJLEdBQUksQ0FBQyxJQUFJYSxJQUFJLENBQUNDLEtBQUssQ0FBRWxCLFFBQVEsQ0FBQ0csS0FBTSxDQUFDO01BQ3BHLENBQUUsQ0FBQyxDQUFFLEVBQUc7UUFDUCxPQUFPLElBQUk7TUFDWjtNQUNBLE9BQU9GLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1FBQ3JCSSxVQUFVLEVBQUV4QixNQUFNLENBQUN3QixVQUFVO1FBQzdCQyxtQkFBbUIsRUFBRXZDLElBQUksQ0FBQ21ELEtBQUssQ0FBRWQsTUFBTSxDQUFFdEIsR0FBRyxDQUFDd0IsbUJBQW9CLENBQUUsQ0FBQztRQUNwRUMsaUJBQWlCLEVBQUV4QyxJQUFJLENBQUNtRCxLQUFLLENBQUVkLE1BQU0sQ0FBRXRCLEdBQUcsQ0FBQ3lCLGlCQUFrQixDQUFFLENBQUM7UUFDaEVDLG9CQUFvQixFQUFFOUIsTUFBTSxDQUFFSSxHQUFHLENBQUMwQixvQkFBcUIsQ0FBQztRQUN4RFcsdUJBQXVCLEVBQUVDLE9BQU8sQ0FBRWhDLFlBQVksQ0FBQ3FCLGFBQWMsQ0FBQztRQUM5RFksd0JBQXdCLEVBQUVELE9BQU8sQ0FBRWhDLFlBQVksQ0FBQ3NCLGNBQWUsQ0FBQztRQUNoRVkseUJBQXlCLEVBQUVsQyxZQUFZLENBQUNxQixhQUFhLEdBQUcsRUFBRSxHQUFHL0IsTUFBTSxDQUFFWSxZQUFZLENBQUNtQixhQUFhLElBQUkzQixHQUFHLENBQUN5QyxlQUFlLElBQUksdUJBQXdCLENBQUM7UUFDbkpDLDBCQUEwQixFQUFFcEMsWUFBWSxDQUFDc0IsY0FBYyxHQUFHLEVBQUUsR0FBR2hDLE1BQU0sQ0FBRVksWUFBWSxDQUFDb0IsY0FBYyxJQUFJNUIsR0FBRyxDQUFDeUMsZUFBZSxJQUFJLHVCQUF3QixDQUFDO1FBQ3RKVixnQkFBZ0IsRUFBRW5DLE1BQU0sQ0FBRVEsSUFBSSxDQUFDMkIsZ0JBQWlCLENBQUM7UUFDakRDLGdCQUFnQixFQUFFcEMsTUFBTSxDQUFFUSxJQUFJLENBQUM0QixnQkFBaUIsQ0FBQztRQUNqRG5CLGNBQWMsRUFBRUssTUFBTSxDQUFDQyxNQUFNLENBQUVULEtBQU0sQ0FBQztRQUN0Q00sZUFBZSxFQUFFRSxNQUFNLENBQUNDLE1BQU0sQ0FBRUosU0FBVTtNQUMzQyxDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzRCLHlCQUF5QkEsQ0FBRTVDLE1BQU0sRUFBRztNQUM1QyxJQUFJNkMsU0FBUyxHQUFHN0MsTUFBTSxJQUFJQSxNQUFNLENBQUM4QyxJQUFJLEdBQ2xDOUMsTUFBTSxDQUFDOEMsSUFBSSxDQUFDQyxhQUFhLENBQUUsd0NBQXlDLENBQUMsR0FDckUsSUFBSTtNQUVQLElBQUssQ0FBRUYsU0FBUyxJQUFJQSxTQUFTLENBQUNHLE1BQU0sSUFBSUgsU0FBUyxDQUFDSSxZQUFZLENBQUUsMENBQTJDLENBQUMsRUFBRztRQUM5RztNQUNEO01BQ0FKLFNBQVMsQ0FBQ0csTUFBTSxHQUFHLElBQUk7TUFDdkIsSUFBSyxVQUFVLEtBQUssT0FBT2hHLFNBQVMsQ0FBQ2tHLGVBQWUsRUFBRztRQUN0RGxHLFNBQVMsQ0FBQ2tHLGVBQWUsQ0FBQyxDQUFDO01BQzVCO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsV0FBV0EsQ0FBRW5ELE1BQU0sRUFBRztNQUM5QixJQUFJb0QsUUFBUSxHQUFHeEcsUUFBUSxDQUFFVSxTQUFTLENBQUMrRixJQUFLLENBQUM7TUFDekMsSUFBSVAsSUFBSSxHQUFHOUMsTUFBTSxDQUFDOEMsSUFBSTtNQUN0QixJQUFJRCxTQUFTLEdBQUdDLElBQUksR0FBR0EsSUFBSSxDQUFDQyxhQUFhLENBQUUsd0NBQXlDLENBQUMsR0FBRyxJQUFJO01BQzVGLElBQUlPLElBQUksR0FBR3RELE1BQU0sQ0FBQ3VELElBQUksQ0FBQ1IsYUFBYSxDQUFFLHdDQUF5QyxDQUFDO01BQ2hGLElBQUlTLE1BQU0sR0FBR3hILFFBQVEsQ0FBQ3lILGFBQWEsQ0FBRSxNQUFPLENBQUM7TUFDN0MsSUFBSUosSUFBSTtNQUVSLElBQUssQ0FBRUQsUUFBUSxJQUFJLENBQUVQLFNBQVMsSUFBSUEsU0FBUyxDQUFDRSxhQUFhLENBQUUsNENBQTZDLENBQUMsRUFBRztRQUMzRztNQUNEO01BQ0FTLE1BQU0sQ0FBQ0UsU0FBUyxHQUFHTixRQUFRLENBQUU7UUFBRTVCLFVBQVUsRUFBRXhCLE1BQU0sQ0FBQ3dCLFVBQVU7UUFBRW1DLEtBQUssRUFBRXBHLElBQUksQ0FBQ3FHLFVBQVUsSUFBSTtNQUFHLENBQUUsQ0FBQztNQUM5RixJQUFLLENBQUVKLE1BQU0sQ0FBQ0ssaUJBQWlCLEVBQUc7UUFDakM7TUFDRDtNQUNBaEIsU0FBUyxDQUFDaUIsV0FBVyxDQUFFTixNQUFNLENBQUNLLGlCQUFrQixDQUFDO01BQ2pELENBQUVmLElBQUksRUFBRVEsSUFBSSxDQUFFLENBQUNTLE9BQU8sQ0FBRSxVQUFXQyxPQUFPLEVBQUc7UUFDNUMsSUFBS0EsT0FBTyxFQUFHO1VBQ2RBLE9BQU8sQ0FBQ0MsZUFBZSxDQUFFLHFDQUFzQyxDQUFDO1FBQ2pFO01BQ0QsQ0FBRSxDQUFDO01BQ0huQixJQUFJLENBQUNvQixZQUFZLENBQUUsb0RBQW9ELEVBQUUsRUFBRyxDQUFDO01BQzdFbEUsTUFBTSxDQUFDdUQsSUFBSSxDQUFDVyxZQUFZLENBQUUsb0NBQW9DLEVBQUUsTUFBTyxDQUFDO01BQ3hFLElBQUssVUFBVSxLQUFLLE9BQU9sSCxTQUFTLENBQUNrRyxlQUFlLEVBQUc7UUFDdERsRyxTQUFTLENBQUNrRyxlQUFlLENBQUMsQ0FBQztNQUM1QjtNQUNBLElBQUt2RSw2QkFBNkIsS0FBS3FCLE1BQU0sQ0FBQ3dCLFVBQVUsRUFBRztRQUMxRDZCLElBQUksR0FBR3JELE1BQU0sQ0FBQ3VELElBQUksQ0FBQ1IsYUFBYSxDQUFFLDRDQUE2QyxDQUFDO1FBQ2hGcEUsNkJBQTZCLEdBQUcsQ0FBQztRQUNqQyxJQUFLMEUsSUFBSSxJQUFJQSxJQUFJLENBQUNjLFdBQVcsRUFBRztVQUMvQmQsSUFBSSxDQUFDZSxLQUFLLENBQUMsQ0FBQztRQUNiO01BQ0Q7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxlQUFlQSxDQUFFckUsTUFBTSxFQUFHO01BQ2xDLElBQUlzRSxrQkFBa0I7TUFDdEIsSUFBSUMsT0FBTztNQUVYLElBQUssQ0FBRXZFLE1BQU0sSUFBSSxNQUFNLEtBQUtBLE1BQU0sQ0FBQ3dFLEtBQUssSUFBSSxDQUFFdkgsU0FBUyxDQUFDd0gsR0FBRyxFQUFHO1FBQzdEO01BQ0Q7TUFDQTVHLFVBQVUsSUFBSSxDQUFDO01BQ2Z5RyxrQkFBa0IsR0FBR3pHLFVBQVU7TUFDL0JtQyxNQUFNLENBQUN3RSxLQUFLLEdBQUcsU0FBUztNQUN4QnhFLE1BQU0sQ0FBQ25DLFVBQVUsR0FBR3lHLGtCQUFrQjtNQUN0QzFCLHlCQUF5QixDQUFFNUMsTUFBTyxDQUFDO01BQ25DdUUsT0FBTyxHQUFHeEksTUFBTSxDQUFDVyxNQUFNLENBQUNnSSxJQUFJLENBQUU7UUFDN0JELEdBQUcsRUFBRXhILFNBQVMsQ0FBQ3dILEdBQUc7UUFBRUUsTUFBTSxFQUFFLE1BQU07UUFBRUMsUUFBUSxFQUFFLE1BQU07UUFDcER6RSxJQUFJLEVBQUU7VUFDTDBFLE1BQU0sRUFBRTVILFNBQVMsQ0FBQzRILE1BQU07VUFBRUMsS0FBSyxFQUFFN0gsU0FBUyxDQUFDNkgsS0FBSztVQUFFdEQsVUFBVSxFQUFFeEIsTUFBTSxDQUFDd0IsVUFBVTtVQUMvRXVELE1BQU0sRUFBRSxVQUFVO1VBQUVDLFVBQVUsRUFBRWhGLE1BQU0sQ0FBQ2dGLFVBQVU7VUFBRUMsbUJBQW1CLEVBQUVqRixNQUFNLENBQUNrRixXQUFXO1VBQzFGQyxnQkFBZ0IsRUFBRW5GLE1BQU0sQ0FBQ29GLGFBQWE7VUFBRUMsY0FBYyxFQUFFckYsTUFBTSxDQUFDc0YsV0FBVztVQUFFNUQsaUJBQWlCLEVBQUU7UUFDaEc7TUFDRCxDQUFFLENBQUMsQ0FBQzZELElBQUksQ0FBRSxVQUFXeEYsUUFBUSxFQUFHO1FBQy9CLElBQUlLLGdCQUFnQjtRQUVwQixJQUFLa0Usa0JBQWtCLEtBQUt0RSxNQUFNLENBQUNuQyxVQUFVLElBQUlMLE9BQU8sQ0FBQ2dJLEdBQUcsQ0FBRXhGLE1BQU0sQ0FBQ3VELElBQUssQ0FBQyxLQUFLdkQsTUFBTSxJQUFJLENBQUVBLE1BQU0sQ0FBQ3VELElBQUksQ0FBQ1ksV0FBVyxFQUFHO1VBQ3JIO1FBQ0Q7UUFDQS9ELGdCQUFnQixHQUFHTixpQkFBaUIsQ0FBRUMsUUFBUSxFQUFFQyxNQUFPLENBQUM7UUFDeERBLE1BQU0sQ0FBQ3lGLE9BQU8sR0FBR3JGLGdCQUFnQjtRQUNqQ0osTUFBTSxDQUFDd0UsS0FBSyxHQUFHcEUsZ0JBQWdCLEdBQUcsT0FBTyxHQUFHLFFBQVE7UUFDcEQsSUFBS0EsZ0JBQWdCLEVBQUc7VUFDdkIrQyxXQUFXLENBQUVuRCxNQUFPLENBQUM7UUFDdEI7TUFDRCxDQUFFLENBQUMsQ0FBQzBGLElBQUksQ0FBRSxVQUFXQyxjQUFjLEVBQUVDLE1BQU0sRUFBRztRQUM3QyxJQUFLLE9BQU8sS0FBS0EsTUFBTSxJQUFJdEIsa0JBQWtCLEtBQUt0RSxNQUFNLENBQUNuQyxVQUFVLElBQUlMLE9BQU8sQ0FBQ2dJLEdBQUcsQ0FBRXhGLE1BQU0sQ0FBQ3VELElBQUssQ0FBQyxLQUFLdkQsTUFBTSxFQUFHO1VBQzlHQSxNQUFNLENBQUN3RSxLQUFLLEdBQUcsT0FBTztRQUN2QjtNQUNELENBQUUsQ0FBQyxDQUFDcUIsTUFBTSxDQUFFLFlBQVk7UUFDdkIsSUFBS2xJLFFBQVEsQ0FBQzZILEdBQUcsQ0FBRXhGLE1BQU0sQ0FBQ3VELElBQUssQ0FBQyxLQUFLZ0IsT0FBTyxFQUFHO1VBQzlDNUcsUUFBUSxDQUFDbUksTUFBTSxDQUFFOUYsTUFBTSxDQUFDdUQsSUFBSyxDQUFDO1FBQy9CO01BQ0QsQ0FBRSxDQUFDO01BQ0g1RixRQUFRLENBQUNvSSxHQUFHLENBQUUvRixNQUFNLENBQUN1RCxJQUFJLEVBQUVnQixPQUFRLENBQUM7SUFDckM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3lCLGlCQUFpQkEsQ0FBRUMsS0FBSyxFQUFHO01BQ25DLElBQUkxQyxJQUFJLEdBQUcyQyxzQkFBc0IsQ0FBRUQsS0FBSyxDQUFDRSxNQUFPLENBQUM7TUFDakQsSUFBSW5HLE1BQU0sR0FBR3VELElBQUksR0FBRy9GLE9BQU8sQ0FBQ2dJLEdBQUcsQ0FBRWpDLElBQUssQ0FBQyxHQUFHLElBQUk7TUFFOUMsSUFBS3ZELE1BQU0sS0FBTSxTQUFTLEtBQUtpRyxLQUFLLENBQUNHLElBQUksSUFBSTdDLElBQUksQ0FBQzhDLFNBQVMsQ0FBQ0MsUUFBUSxDQUFFLHFCQUFzQixDQUFDLENBQUUsRUFBRztRQUNqR2pDLGVBQWUsQ0FBRXJFLE1BQU8sQ0FBQztNQUMxQjtJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN1RyxlQUFlQSxDQUFFTixLQUFLLEVBQUc7TUFDakMsSUFBSTVDLElBQUksR0FBRzRDLEtBQUssQ0FBQ0UsTUFBTSxDQUFDSyxPQUFPLENBQUUsNENBQTZDLENBQUM7TUFDL0UsSUFBSWpELElBQUksR0FBR0YsSUFBSSxHQUFHNkMsc0JBQXNCLENBQUU3QyxJQUFLLENBQUMsR0FBRyxJQUFJO01BQ3ZELElBQUlyRCxNQUFNLEdBQUd1RCxJQUFJLEdBQUcvRixPQUFPLENBQUNnSSxHQUFHLENBQUVqQyxJQUFLLENBQUMsR0FBRyxJQUFJO01BRTlDLElBQUt2RCxNQUFNLElBQUlBLE1BQU0sQ0FBQ3lGLE9BQU8sS0FBTSxVQUFVLEtBQUssT0FBT3pJLFNBQVMsQ0FBQ3lKLHFCQUFxQixJQUFJekosU0FBUyxDQUFDeUoscUJBQXFCLENBQUMsQ0FBQyxDQUFFLEVBQUc7UUFDakkzSSxlQUFlLEdBQUc7VUFBRXlGLElBQUksRUFBRUEsSUFBSTtVQUFFbUQsQ0FBQyxFQUFFbkYsTUFBTSxDQUFFMEUsS0FBSyxDQUFDVSxPQUFRLENBQUM7VUFBRUMsQ0FBQyxFQUFFckYsTUFBTSxDQUFFMEUsS0FBSyxDQUFDWSxPQUFRO1FBQUUsQ0FBQztNQUN6RjtJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNYLHNCQUFzQkEsQ0FBRVksU0FBUyxFQUFHO01BQzVDLElBQUl2RCxJQUFJLEdBQUd1RCxTQUFTLElBQUlBLFNBQVMsQ0FBQ04sT0FBTyxHQUFHTSxTQUFTLENBQUNOLE9BQU8sQ0FBRSxpQ0FBa0MsQ0FBQyxHQUFHLElBQUk7TUFDekcsSUFBSTFELElBQUk7TUFDUixJQUFJa0MsVUFBVTtNQUVkLElBQUt6QixJQUFJLEVBQUc7UUFDWCxPQUFPQSxJQUFJO01BQ1o7TUFDQVQsSUFBSSxHQUFHZ0UsU0FBUyxJQUFJQSxTQUFTLENBQUNOLE9BQU8sR0FBR00sU0FBUyxDQUFDTixPQUFPLENBQUUsMkNBQTRDLENBQUMsR0FBRyxJQUFJO01BQy9HeEIsVUFBVSxHQUFHbEMsSUFBSSxHQUFHakQsTUFBTSxDQUFFaUQsSUFBSSxDQUFDaUUsWUFBWSxDQUFFLHlDQUEwQyxDQUFDLElBQUksRUFBRyxDQUFDLEdBQUcsRUFBRTtNQUN2RyxJQUFLLENBQUUvQixVQUFVLEVBQUc7UUFDbkIsT0FBTyxJQUFJO01BQ1o7TUFDQWpJLEtBQUssQ0FBQ2lLLGdCQUFnQixDQUFFLGlDQUFrQyxDQUFDLENBQUNqRCxPQUFPLENBQUUsVUFBV2tELFNBQVMsRUFBRztRQUMzRixJQUFLLENBQUUxRCxJQUFJLElBQUl5QixVQUFVLEtBQUtuRixNQUFNLENBQUVvSCxTQUFTLENBQUNGLFlBQVksQ0FBRSwrQkFBZ0MsQ0FBQyxJQUFJLEVBQUcsQ0FBQyxFQUFHO1VBQ3pHeEQsSUFBSSxHQUFHMEQsU0FBUztRQUNqQjtNQUNELENBQUUsQ0FBQztNQUVILE9BQU8xRCxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyRCxZQUFZQSxDQUFBLEVBQUc7TUFDdkIsSUFBSUMsSUFBSSxHQUFHLFVBQVUsS0FBSyxPQUFPbkssU0FBUyxDQUFDb0ssUUFBUSxHQUFHcEssU0FBUyxDQUFDb0ssUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7TUFDckYsSUFBSUMsT0FBTyxHQUFHdEssS0FBSyxDQUFDaUssZ0JBQWdCLENBQUUsZ0NBQWlDLENBQUM7TUFDeEUsSUFBSU0sS0FBSyxHQUFHMUcsS0FBSyxDQUFDQyxPQUFPLENBQUVzRyxJQUFJLENBQUNHLEtBQU0sQ0FBQyxHQUFHSCxJQUFJLENBQUNHLEtBQUssQ0FBQ3ZHLEdBQUcsQ0FBRSxVQUFXd0csSUFBSSxFQUFFQyxLQUFLLEVBQUc7UUFDbEYsSUFBSUMsU0FBUyxHQUFHSixPQUFPLENBQUNHLEtBQUssQ0FBQyxHQUFHSCxPQUFPLENBQUNHLEtBQUssQ0FBQyxDQUFDRSxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsSUFBSTtRQUM5RSxPQUFPRCxTQUFTLEdBQUd0RyxNQUFNLENBQUNDLE1BQU0sQ0FBRTtVQUNqQ3VHLFdBQVcsRUFBRXBHLE1BQU0sQ0FBRWdHLElBQUksQ0FBQ0ksV0FBWSxDQUFDO1VBQUVDLFNBQVMsRUFBRXJHLE1BQU0sQ0FBRWdHLElBQUksQ0FBQ0ssU0FBVSxDQUFDO1VBQUVDLElBQUksRUFBRWhJLE1BQU0sQ0FBRTBILElBQUksQ0FBQ00sSUFBSSxJQUFJLEVBQUcsQ0FBQztVQUM3R0MsSUFBSSxFQUFFTCxTQUFTLENBQUNLLElBQUk7VUFBRUMsS0FBSyxFQUFFTixTQUFTLENBQUNNO1FBQ3hDLENBQUUsQ0FBQyxHQUFHLElBQUk7TUFDWCxDQUFFLENBQUMsQ0FBQ0MsTUFBTSxDQUFFekYsT0FBUSxDQUFDLEdBQUcsRUFBRTtNQUUxQixPQUFPcEIsTUFBTSxDQUFDQyxNQUFNLENBQUU7UUFDckJrRyxLQUFLLEVBQUVuRyxNQUFNLENBQUNDLE1BQU0sQ0FBRWtHLEtBQU0sQ0FBQztRQUFFVyxRQUFRLEVBQUVwSSxNQUFNLENBQUVzSCxJQUFJLENBQUNjLFFBQVEsSUFBSSxLQUFNLENBQUM7UUFDekVDLE1BQU0sRUFBRSxLQUFLLEtBQUtuTSxNQUFNLENBQUNvTSxnQkFBZ0IsQ0FBRXBMLEtBQU0sQ0FBQyxDQUFDcUw7TUFDcEQsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFlBQVlBLENBQUEsRUFBRztNQUN2QixJQUFJQyxJQUFJLEdBQUcxSCxLQUFLLENBQUMySCxTQUFTLENBQUN4SCxHQUFHLENBQUN5SCxJQUFJLENBQUV6TCxLQUFLLENBQUNpSyxnQkFBZ0IsQ0FBRSwrQkFBZ0MsQ0FBQyxFQUFFLFVBQVd5QixJQUFJLEVBQUVDLEtBQUssRUFBRztRQUN4SCxJQUFJQyxLQUFLLEdBQUdGLElBQUksQ0FBQ2pDLE9BQU8sQ0FBRSxrQ0FBbUMsQ0FBQztRQUM5RCxJQUFJaUIsU0FBUyxHQUFHZ0IsSUFBSSxDQUFDZixxQkFBcUIsQ0FBQyxDQUFDO1FBQzVDLE9BQU92RyxNQUFNLENBQUNDLE1BQU0sQ0FBRTtVQUNyQnFILElBQUksRUFBRUEsSUFBSTtVQUFFdkQsV0FBVyxFQUFFM0QsTUFBTSxDQUFFb0gsS0FBSyxJQUFJQSxLQUFLLENBQUM1QixZQUFZLENBQUUsZ0NBQWlDLENBQUUsQ0FBQztVQUFFMkIsS0FBSyxFQUFFQSxLQUFLO1VBQ2hIRSxHQUFHLEVBQUVuQixTQUFTLENBQUNtQixHQUFHO1VBQUVDLE1BQU0sRUFBRXBCLFNBQVMsQ0FBQ29CLE1BQU07VUFBRWYsSUFBSSxFQUFFTCxTQUFTLENBQUNLLElBQUk7VUFBRUMsS0FBSyxFQUFFTixTQUFTLENBQUNNO1FBQ3RGLENBQUUsQ0FBQztNQUNKLENBQUUsQ0FBQyxDQUFDQyxNQUFNLENBQUUsVUFBV2MsR0FBRyxFQUFHO1FBQzVCLE9BQU9BLEdBQUcsQ0FBQzVELFdBQVcsSUFBSTRELEdBQUcsQ0FBQ2YsS0FBSyxHQUFHZSxHQUFHLENBQUNoQixJQUFJLElBQUlnQixHQUFHLENBQUNELE1BQU0sR0FBR0MsR0FBRyxDQUFDRixHQUFHO01BQ3ZFLENBQUUsQ0FBQztNQUVILE9BQU96SCxNQUFNLENBQUNDLE1BQU0sQ0FBRWtILElBQUssQ0FBQztJQUM3Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTUyxTQUFTQSxDQUFFOUMsS0FBSyxFQUFHO01BQzNCLElBQUlqRyxNQUFNLEdBQUd4QyxPQUFPLENBQUNnSSxHQUFHLENBQUVTLEtBQUssQ0FBQytDLElBQUssQ0FBQztNQUN0QyxJQUFJQyxNQUFNLEdBQUdsTSxLQUFLLENBQUNnRyxhQUFhLENBQUUsNkJBQThCLENBQUM7TUFDakUsSUFBSW1HLEtBQUssR0FBR2pELEtBQUssQ0FBQytDLElBQUksQ0FBQ2pHLGFBQWEsQ0FBRSx3Q0FBeUMsQ0FBQztNQUNoRixJQUFJb0csUUFBUSxHQUFHbEQsS0FBSyxDQUFDK0MsSUFBSSxDQUFDakcsYUFBYSxDQUFFLG1DQUFvQyxDQUFDO01BQzlFLElBQUlxRyxXQUFXLEdBQUduRCxLQUFLLENBQUMrQyxJQUFJLENBQUNLLFVBQVU7TUFFdkMsSUFBSyxDQUFFckosTUFBTSxJQUFJLENBQUVBLE1BQU0sQ0FBQ3lGLE9BQU8sSUFBSSxDQUFFM0gsZUFBZSxJQUFJQSxlQUFlLENBQUN5RixJQUFJLEtBQUswQyxLQUFLLENBQUMrQyxJQUFJLEVBQUc7UUFDL0Y7TUFDRDtNQUNBakwsT0FBTyxHQUFHO1FBQ1R3RixJQUFJLEVBQUUwQyxLQUFLLENBQUMrQyxJQUFJO1FBQUVoSixNQUFNLEVBQUVBLE1BQU07UUFBRXNKLE1BQU0sRUFBRXJELEtBQUssQ0FBQytDLElBQUksQ0FBQ0ssVUFBVTtRQUFFRSxJQUFJLEVBQUV0RCxLQUFLLENBQUMrQyxJQUFJLENBQUNRLFdBQVc7UUFDN0ZDLEtBQUssRUFBRXhELEtBQUssQ0FBQytDLElBQUksQ0FBQ2pDLFlBQVksQ0FBRSxPQUFRLENBQUM7UUFBRTJDLFVBQVUsRUFBRXpELEtBQUssQ0FBQytDLElBQUksQ0FBQ2pDLFlBQVksQ0FBRSxPQUFRLENBQUM7UUFDekZJLElBQUksRUFBRUQsWUFBWSxDQUFDLENBQUM7UUFBRW9CLElBQUksRUFBRUQsWUFBWSxDQUFDLENBQUM7UUFBRVksTUFBTSxFQUFFQSxNQUFNO1FBQUVVLGFBQWEsRUFBRVYsTUFBTSxHQUFHQSxNQUFNLENBQUNXLFVBQVUsR0FBRyxDQUFDO1FBQ3pHQyxnQkFBZ0IsRUFBRVosTUFBTSxHQUFHQSxNQUFNLENBQUN2QixxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsSUFBSTtRQUNoRW9DLEtBQUssRUFBRS9OLE1BQU0sQ0FBQ2dPLFdBQVcsSUFBSSxDQUFDO1FBQUVDLEtBQUssRUFBRWpPLE1BQU0sQ0FBQ2tPLFdBQVcsSUFBSSxDQUFDO1FBQzlEQyxRQUFRLEVBQUVqRSxLQUFLLENBQUMrQyxJQUFJLENBQUMzQyxTQUFTLENBQUNDLFFBQVEsQ0FBRSxxQkFBc0IsQ0FBQztRQUFFbEMsS0FBSyxFQUFFcEksUUFBUSxDQUFDbU8sYUFBYTtRQUMvRkMsT0FBTyxFQUFFdE0sZUFBZSxDQUFDNEksQ0FBQztRQUFFMkQsT0FBTyxFQUFFdk0sZUFBZSxDQUFDOEksQ0FBQztRQUFFRixDQUFDLEVBQUU1SSxlQUFlLENBQUM0SSxDQUFDO1FBQUVFLENBQUMsRUFBRTlJLGVBQWUsQ0FBQzhJLENBQUM7UUFDbEdLLFNBQVMsRUFBRSxJQUFJO1FBQUVxRCxpQkFBaUIsRUFBRSxJQUFJO1FBQUVDLGVBQWUsRUFBRSxDQUFDO1FBQUVDLE1BQU0sRUFBRSxJQUFJO1FBQUVDLE9BQU8sRUFBRSxLQUFLO1FBQzFGQyxVQUFVLEVBQUUsSUFBSTtRQUFFQyxrQkFBa0IsRUFBRSxJQUFJO1FBQUVDLFdBQVcsRUFBRSxJQUFJO1FBQUVDLG9CQUFvQixFQUFFLElBQUk7UUFDekZDLGVBQWUsRUFBRSxJQUFJO1FBQUVDLG9CQUFvQixFQUFFLElBQUk7UUFDakRDLFVBQVUsRUFBRTdKLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1VBQzFCOEgsS0FBSyxFQUFFQSxLQUFLLEdBQUdySixNQUFNLENBQUVxSixLQUFLLENBQUN0SixXQUFXLElBQUksRUFBRyxDQUFDLENBQUNxTCxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUU7VUFDNURDLGNBQWMsRUFBRS9CLFFBQVEsR0FBR3RKLE1BQU0sQ0FBRXNKLFFBQVEsQ0FBQ3ZKLFdBQVcsSUFBSSxFQUFHLENBQUMsQ0FBQ3FMLElBQUksQ0FBQyxDQUFDLEdBQUc7UUFDMUUsQ0FBRTtNQUNILENBQUM7TUFDRGxOLE9BQU8sQ0FBQzJNLFVBQVUsR0FBR1MsZ0JBQWdCLENBQUVwTixPQUFPLEVBQUVxTCxXQUFZLENBQUM7TUFDN0QsSUFBSyxDQUFFckwsT0FBTyxDQUFDMk0sVUFBVSxFQUFHO1FBQzNCM00sT0FBTyxHQUFHLElBQUk7UUFDZEQsZUFBZSxHQUFHLElBQUk7TUFDdkI7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTc04sY0FBY0EsQ0FBRUMsS0FBSyxFQUFHO01BQ2hDLElBQUssQ0FBRUEsS0FBSyxFQUFHO1FBQ2Q7TUFDRDtNQUNBQSxLQUFLLENBQUNuSCxZQUFZLENBQUUsYUFBYSxFQUFFLE1BQU8sQ0FBQztNQUMzQ21ILEtBQUssQ0FBQzVCLEtBQUssQ0FBQzZCLGFBQWEsR0FBRyxNQUFNO01BQ2xDRCxLQUFLLENBQUNyRSxnQkFBZ0IsQ0FBRSxNQUFPLENBQUMsQ0FBQ2pELE9BQU8sQ0FBRSxVQUFXd0gsSUFBSSxFQUFHO1FBQUVBLElBQUksQ0FBQ3RILGVBQWUsQ0FBRSxJQUFLLENBQUM7TUFBRSxDQUFFLENBQUM7TUFDL0ZvSCxLQUFLLENBQUNyRSxnQkFBZ0IsQ0FBRSxnREFBaUQsQ0FBQyxDQUFDakQsT0FBTyxDQUFFLFVBQVd3SCxJQUFJLEVBQUc7UUFDckdBLElBQUksQ0FBQ3RILGVBQWUsQ0FBRSxVQUFXLENBQUM7UUFDbENzSCxJQUFJLENBQUNySCxZQUFZLENBQUUsYUFBYSxFQUFFLE1BQU8sQ0FBQztRQUMxQyxJQUFLLFVBQVUsSUFBSXFILElBQUksRUFBRztVQUN6QkEsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSTtRQUNyQjtNQUNELENBQUUsQ0FBQztNQUNISCxLQUFLLENBQUNyRSxnQkFBZ0IsQ0FBRSxxTkFBc04sQ0FBQyxDQUFDakQsT0FBTyxDQUFFLFVBQVd3SCxJQUFJLEVBQUc7UUFDMVEsQ0FBRSxxQ0FBcUMsRUFBRSx5Q0FBeUMsRUFBRSwyQ0FBMkMsRUFBRSx3Q0FBd0MsRUFBRSwwQ0FBMEMsQ0FBRSxDQUFDeEgsT0FBTyxDQUFFLFVBQVcwSCxTQUFTLEVBQUc7VUFBRUYsSUFBSSxDQUFDdEgsZUFBZSxDQUFFd0gsU0FBVSxDQUFDO1FBQUUsQ0FBRSxDQUFDO01BQ2pTLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFFBQVFBLENBQUV6RixLQUFLLEVBQUc7TUFDMUJtRixjQUFjLENBQUVuRixLQUFLLENBQUNvRixLQUFNLENBQUM7TUFDN0IsSUFBS3BGLEtBQUssQ0FBQ29GLEtBQUssRUFBRztRQUNsQnBGLEtBQUssQ0FBQ29GLEtBQUssQ0FBQ2hGLFNBQVMsQ0FBQ3NGLEdBQUcsQ0FBRSx3Q0FBeUMsQ0FBQztNQUN0RTtJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxRQUFRQSxDQUFBLEVBQUc7TUFDbkIsSUFBSyxDQUFFN04sT0FBTyxFQUFHO1FBQ2hCO01BQ0Q7TUFDQUEsT0FBTyxDQUFDME0sT0FBTyxHQUFHLElBQUk7TUFDdEIxTSxPQUFPLENBQUN5TSxNQUFNLEdBQUd6TSxPQUFPLENBQUN3RixJQUFJLENBQUNzSSxTQUFTLENBQUUsSUFBSyxDQUFDO01BQy9DVCxjQUFjLENBQUVyTixPQUFPLENBQUN5TSxNQUFPLENBQUM7TUFDaEN6TSxPQUFPLENBQUN5TSxNQUFNLENBQUNuRSxTQUFTLENBQUNzRixHQUFHLENBQUUsd0NBQXlDLENBQUM7TUFDeEU1TixPQUFPLENBQUN5TSxNQUFNLENBQUN2RyxlQUFlLENBQUUsb0NBQXFDLENBQUM7TUFDdEVsRyxPQUFPLENBQUN1TCxNQUFNLENBQUN3QyxZQUFZLENBQUUvTixPQUFPLENBQUN5TSxNQUFNLEVBQUV6TSxPQUFPLENBQUN3TCxJQUFLLENBQUM7TUFDM0R4TSxLQUFLLENBQUNzSixTQUFTLENBQUNzRixHQUFHLENBQUUsNEJBQTZCLENBQUM7TUFDbkQsSUFBSzNPLFNBQVMsQ0FBQytPLHlCQUF5QixFQUFHO1FBQUUvTyxTQUFTLENBQUMrTyx5QkFBeUIsQ0FBRSxJQUFJLEVBQUVoTyxPQUFPLENBQUN3RixJQUFLLENBQUM7TUFBRTtNQUN4RyxJQUFLdkcsU0FBUyxDQUFDZ1AsOEJBQThCLEVBQUc7UUFBRWhQLFNBQVMsQ0FBQ2dQLDhCQUE4QixDQUFFLElBQUssQ0FBQztNQUFFO01BQ3BHaFEsUUFBUSxDQUFDaVEsZ0JBQWdCLENBQUUsYUFBYSxFQUFFQyxlQUFlLEVBQUUsSUFBSyxDQUFDO01BQ2pFbFEsUUFBUSxDQUFDaVEsZ0JBQWdCLENBQUUsV0FBVyxFQUFFRSxxQkFBcUIsRUFBRSxJQUFLLENBQUM7TUFDckVuUSxRQUFRLENBQUNpUSxnQkFBZ0IsQ0FBRSxlQUFlLEVBQUVHLGVBQWUsRUFBRSxJQUFLLENBQUM7TUFDbkVDLGdCQUFnQixDQUFDLENBQUM7SUFDbkI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbEIsZ0JBQWdCQSxDQUFFM0csS0FBSyxFQUFFaUUsSUFBSSxFQUFHO01BQ3hDLElBQUk2RCxPQUFPLEdBQUcsSUFBSTtNQUVsQixJQUFLLENBQUU5SCxLQUFLLElBQUksQ0FBRWlFLElBQUksRUFBRztRQUN4QixPQUFPLElBQUk7TUFDWjtNQUNBakUsS0FBSyxDQUFDOEQsSUFBSSxDQUFDcEcsSUFBSSxDQUFFLFVBQVc0RyxHQUFHLEVBQUc7UUFDakMsSUFBS0EsR0FBRyxDQUFDTCxJQUFJLEtBQUtBLElBQUksRUFBRztVQUN4QjZELE9BQU8sR0FBR3hELEdBQUc7VUFDYixPQUFPLElBQUk7UUFDWjtRQUNBLE9BQU8sS0FBSztNQUNiLENBQUUsQ0FBQztNQUVILE9BQU93RCxPQUFPO0lBQ2Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsaUJBQWlCQSxDQUFFL0gsS0FBSyxFQUFFc0UsR0FBRyxFQUFFMEQsUUFBUSxFQUFHO01BQ2xELElBQUkvRSxTQUFTO01BQ2IsSUFBSWdGLGdCQUFnQjtNQUNwQixJQUFJQyxnQkFBZ0I7TUFDcEIsSUFBSUMsY0FBYztNQUVsQixJQUFLLFNBQVMsS0FBS0gsUUFBUSxFQUFHO1FBQzdCLElBQUssQ0FBRTFELEdBQUcsQ0FBQ0wsSUFBSSxDQUFDdEUsV0FBVyxFQUFHO1VBQzdCLE9BQU8sSUFBSTtRQUNaO1FBQ0FzRCxTQUFTLEdBQUdxQixHQUFHLENBQUNMLElBQUksQ0FBQ2YscUJBQXFCLENBQUMsQ0FBQztRQUM1QyxPQUFPRCxTQUFTLENBQUNNLEtBQUssR0FBR04sU0FBUyxDQUFDSyxJQUFJLElBQUlMLFNBQVMsQ0FBQ29CLE1BQU0sR0FBR3BCLFNBQVMsQ0FBQ21CLEdBQUcsR0FBR25CLFNBQVMsR0FBRyxJQUFJO01BQy9GO01BQ0FnRixnQkFBZ0IsR0FBRyxDQUFFMVEsTUFBTSxDQUFDZ08sV0FBVyxJQUFJLENBQUMsSUFBS3ZGLEtBQUssQ0FBQ3NGLEtBQUs7TUFDNUQ0QyxnQkFBZ0IsR0FBRyxDQUFFM1EsTUFBTSxDQUFDa08sV0FBVyxJQUFJLENBQUMsSUFBS3pGLEtBQUssQ0FBQ3dGLEtBQUs7TUFDNUQyQyxjQUFjLEdBQUduSSxLQUFLLENBQUN5RSxNQUFNLEdBQUd6RSxLQUFLLENBQUN5RSxNQUFNLENBQUNXLFVBQVUsR0FBR3BGLEtBQUssQ0FBQ21GLGFBQWEsR0FBRyxDQUFDO01BRWpGLE9BQU87UUFDTjdCLElBQUksRUFBRWdCLEdBQUcsQ0FBQ2hCLElBQUksR0FBRzJFLGdCQUFnQixHQUFHRSxjQUFjO1FBQ2xENUUsS0FBSyxFQUFFZSxHQUFHLENBQUNmLEtBQUssR0FBRzBFLGdCQUFnQixHQUFHRSxjQUFjO1FBQ3BEL0QsR0FBRyxFQUFFRSxHQUFHLENBQUNGLEdBQUcsR0FBRzhELGdCQUFnQjtRQUMvQjdELE1BQU0sRUFBRUMsR0FBRyxDQUFDRCxNQUFNLEdBQUc2RDtNQUN0QixDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTRSxpQkFBaUJBLENBQUVwSSxLQUFLLEVBQUVnSSxRQUFRLEVBQUc7TUFDN0MsSUFBSS9FLFNBQVM7TUFDYixJQUFJZ0YsZ0JBQWdCO01BQ3BCLElBQUlDLGdCQUFnQjtNQUVwQixJQUFLLENBQUVsSSxLQUFLLENBQUN5RSxNQUFNLElBQUksQ0FBRXpFLEtBQUssQ0FBQ3FGLGdCQUFnQixFQUFHO1FBQ2pELE9BQU8sSUFBSTtNQUNaO01BQ0EsSUFBSyxTQUFTLEtBQUsyQyxRQUFRLEVBQUc7UUFDN0IvRSxTQUFTLEdBQUdqRCxLQUFLLENBQUN5RSxNQUFNLENBQUN2QixxQkFBcUIsQ0FBQyxDQUFDO01BQ2pELENBQUMsTUFBTTtRQUNOK0UsZ0JBQWdCLEdBQUcsQ0FBRTFRLE1BQU0sQ0FBQ2dPLFdBQVcsSUFBSSxDQUFDLElBQUt2RixLQUFLLENBQUNzRixLQUFLO1FBQzVENEMsZ0JBQWdCLEdBQUcsQ0FBRTNRLE1BQU0sQ0FBQ2tPLFdBQVcsSUFBSSxDQUFDLElBQUt6RixLQUFLLENBQUN3RixLQUFLO1FBQzVEdkMsU0FBUyxHQUFHO1VBQ1hLLElBQUksRUFBRXRELEtBQUssQ0FBQ3FGLGdCQUFnQixDQUFDL0IsSUFBSSxHQUFHMkUsZ0JBQWdCO1VBQ3BEMUUsS0FBSyxFQUFFdkQsS0FBSyxDQUFDcUYsZ0JBQWdCLENBQUM5QixLQUFLLEdBQUcwRSxnQkFBZ0I7VUFDdEQ3RCxHQUFHLEVBQUVwRSxLQUFLLENBQUNxRixnQkFBZ0IsQ0FBQ2pCLEdBQUcsR0FBRzhELGdCQUFnQjtVQUNsRDdELE1BQU0sRUFBRXJFLEtBQUssQ0FBQ3FGLGdCQUFnQixDQUFDaEIsTUFBTSxHQUFHNkQ7UUFDekMsQ0FBQztNQUNGO01BRUEsT0FBTztRQUNONUUsSUFBSSxFQUFFNUksSUFBSSxDQUFDMk4sR0FBRyxDQUFFLENBQUMsRUFBRXBGLFNBQVMsQ0FBQ0ssSUFBSyxDQUFDO1FBQ25DQyxLQUFLLEVBQUU3SSxJQUFJLENBQUM0TixHQUFHLENBQUU5USxRQUFRLENBQUMrUSxlQUFlLENBQUNDLFdBQVcsRUFBRXZGLFNBQVMsQ0FBQ00sS0FBTSxDQUFDO1FBQ3hFYSxHQUFHLEVBQUUxSixJQUFJLENBQUMyTixHQUFHLENBQUUsQ0FBQyxFQUFFcEYsU0FBUyxDQUFDbUIsR0FBSSxDQUFDO1FBQ2pDQyxNQUFNLEVBQUUzSixJQUFJLENBQUM0TixHQUFHLENBQUU5USxRQUFRLENBQUMrUSxlQUFlLENBQUNFLFlBQVksRUFBRXhGLFNBQVMsQ0FBQ29CLE1BQU87TUFDM0UsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3FFLFdBQVdBLENBQUUxSSxLQUFLLEVBQUVrQyxDQUFDLEVBQUVFLENBQUMsRUFBRTRGLFFBQVEsRUFBRztNQUM3QyxJQUFJVyxTQUFTLEdBQUc1TCxNQUFNLENBQUVuRSxlQUFlLENBQUNnUSxzQkFBdUIsQ0FBQyxJQUFJLEVBQUU7TUFDdEUsSUFBSUMsYUFBYSxHQUFHVCxpQkFBaUIsQ0FBRXBJLEtBQUssRUFBRWdJLFFBQVMsQ0FBQztNQUN4RCxJQUFJYyxPQUFPLEdBQUcsRUFBRTtNQUVoQixJQUNDLENBQUVELGFBQWEsSUFDZjNHLENBQUMsR0FBRzJHLGFBQWEsQ0FBQ3ZGLElBQUksSUFBSXBCLENBQUMsR0FBRzJHLGFBQWEsQ0FBQ3RGLEtBQUssSUFDakRuQixDQUFDLEdBQUd5RyxhQUFhLENBQUN6RSxHQUFHLElBQUloQyxDQUFDLEdBQUd5RyxhQUFhLENBQUN4RSxNQUFNLEVBQ2hEO1FBQ0QsT0FBTztVQUFFakQsTUFBTSxFQUFFLGVBQWU7VUFBRWtELEdBQUcsRUFBRTtRQUFLLENBQUM7TUFDOUM7TUFDQXRFLEtBQUssQ0FBQzhELElBQUksQ0FBQ3ZFLE9BQU8sQ0FBRSxVQUFXK0UsR0FBRyxFQUFHO1FBQ3BDLElBQUlyQixTQUFTLEdBQUc4RSxpQkFBaUIsQ0FBRS9ILEtBQUssRUFBRXNFLEdBQUcsRUFBRTBELFFBQVMsQ0FBQztRQUN6RCxJQUFJZSxZQUFZO1FBRWhCLElBQUssQ0FBRTlGLFNBQVMsSUFBSWYsQ0FBQyxHQUFHeEgsSUFBSSxDQUFDMk4sR0FBRyxDQUFFcEYsU0FBUyxDQUFDSyxJQUFJLEVBQUV1RixhQUFhLENBQUN2RixJQUFLLENBQUMsSUFBSXBCLENBQUMsR0FBR3hILElBQUksQ0FBQzROLEdBQUcsQ0FBRXJGLFNBQVMsQ0FBQ00sS0FBSyxFQUFFc0YsYUFBYSxDQUFDdEYsS0FBTSxDQUFDLEVBQUc7VUFDaEk7UUFDRDtRQUNBd0YsWUFBWSxHQUFHM0csQ0FBQyxHQUFHYSxTQUFTLENBQUNtQixHQUFHLEdBQUduQixTQUFTLENBQUNtQixHQUFHLEdBQUdoQyxDQUFDLEdBQUtBLENBQUMsR0FBR2EsU0FBUyxDQUFDb0IsTUFBTSxHQUFHakMsQ0FBQyxHQUFHYSxTQUFTLENBQUNvQixNQUFNLEdBQUcsQ0FBRztRQUMxRyxJQUFLMEUsWUFBWSxJQUFJSixTQUFTLEVBQUc7VUFDaENHLE9BQU8sQ0FBQ0UsSUFBSSxDQUFFO1lBQUUxRSxHQUFHLEVBQUVBLEdBQUc7WUFBRTJFLFFBQVEsRUFBRUY7VUFBYSxDQUFFLENBQUM7UUFDckQ7TUFDRCxDQUFFLENBQUM7TUFDSEQsT0FBTyxDQUFDSSxJQUFJLENBQUUsVUFBV0MsS0FBSyxFQUFFQyxNQUFNLEVBQUc7UUFDeEMsT0FBT0QsS0FBSyxDQUFDRixRQUFRLEtBQUtHLE1BQU0sQ0FBQ0gsUUFBUSxHQUN0Q0UsS0FBSyxDQUFDN0UsR0FBRyxDQUFDSixLQUFLLEdBQUdrRixNQUFNLENBQUM5RSxHQUFHLENBQUNKLEtBQUssR0FDbENpRixLQUFLLENBQUNGLFFBQVEsR0FBR0csTUFBTSxDQUFDSCxRQUFRO01BQ3BDLENBQUUsQ0FBQztNQUNILElBQUssQ0FBRUgsT0FBTyxDQUFDeEwsTUFBTSxFQUFHO1FBQ3ZCLE9BQU87VUFBRThELE1BQU0sRUFBRSxNQUFNO1VBQUVrRCxHQUFHLEVBQUU7UUFBSyxDQUFDO01BQ3JDO01BQ0EsSUFBSyxDQUFDLEdBQUd3RSxPQUFPLENBQUN4TCxNQUFNLElBQUk1QyxJQUFJLENBQUMyTyxHQUFHLENBQUVQLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQ0csUUFBUSxHQUFHSCxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUNHLFFBQVMsQ0FBQyxHQUFHLEdBQUcsRUFBRztRQUN4RixPQUFPO1VBQUU3SCxNQUFNLEVBQUUsV0FBVztVQUFFa0QsR0FBRyxFQUFFO1FBQUssQ0FBQztNQUMxQztNQUVBLE9BQU87UUFBRWxELE1BQU0sRUFBRSxVQUFVO1FBQUVrRCxHQUFHLEVBQUV3RSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUN4RTtNQUFJLENBQUM7SUFDbkQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNnRixzQkFBc0JBLENBQUV0SixLQUFLLEVBQUc7TUFDeEMsSUFBSXVKLGFBQWEsR0FBR3ZKLEtBQUssQ0FBQ29HLFdBQVcsR0FDbENwRyxLQUFLLENBQUM4RCxJQUFJLENBQUNOLE1BQU0sQ0FBRSxVQUFXYyxHQUFHLEVBQUc7UUFBRSxPQUFPQSxHQUFHLENBQUM1RCxXQUFXLEtBQUtWLEtBQUssQ0FBQ29HLFdBQVcsQ0FBQ29ELGtCQUFrQjtNQUFFLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUM3RyxJQUFJO01BQ1AsSUFBSUMsYUFBYSxHQUFHekosS0FBSyxDQUFDdUcsb0JBQW9CLEdBQzNDSSxnQkFBZ0IsQ0FBRTNHLEtBQUssRUFBRUEsS0FBSyxDQUFDdUcsb0JBQXFCLENBQUMsR0FDckQsSUFBSTtNQUVQLElBQ0MsQ0FBRWdELGFBQWEsSUFDZixDQUFFRSxhQUFhLElBQ2YsQ0FBRUYsYUFBYSxDQUFDdEYsSUFBSSxDQUFDdEUsV0FBVyxJQUNoQzhKLGFBQWEsQ0FBQy9JLFdBQVcsS0FBSzZJLGFBQWEsQ0FBQzdJLFdBQVcsRUFDdEQ7UUFDRCxPQUFPLElBQUk7TUFDWjtNQUVBLE9BQU82SSxhQUFhO0lBQ3JCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNHLGtCQUFrQkEsQ0FBRTFKLEtBQUssRUFBRztNQUNwQyxJQUFJMkosVUFBVTtNQUVkLElBQUssQ0FBRTNKLEtBQUssSUFBSUEsS0FBSyxDQUFDb0csV0FBVyxFQUFHO1FBQ25DLE9BQU9wRyxLQUFLLElBQUlBLEtBQUssQ0FBQ29HLFdBQVcsR0FDOUJwRyxLQUFLLENBQUM4RCxJQUFJLENBQUNOLE1BQU0sQ0FBRSxVQUFXYyxHQUFHLEVBQUc7VUFBRSxPQUFPQSxHQUFHLENBQUM1RCxXQUFXLEtBQUtWLEtBQUssQ0FBQ29HLFdBQVcsQ0FBQ29ELGtCQUFrQjtRQUFFLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksR0FDckgsSUFBSTtNQUNSO01BQ0EsSUFBSyxDQUFFeEosS0FBSyxDQUFDa0csVUFBVSxJQUFJLENBQUVsRyxLQUFLLENBQUNtRyxrQkFBa0IsRUFBRztRQUN2RCxPQUFPLElBQUk7TUFDWjtNQUNBd0QsVUFBVSxHQUFHM0osS0FBSyxDQUFDOEQsSUFBSSxDQUFDTixNQUFNLENBQUUsVUFBV2MsR0FBRyxFQUFHO1FBQ2hELE9BQU9BLEdBQUcsQ0FBQzVELFdBQVcsS0FBS1YsS0FBSyxDQUFDbUcsa0JBQWtCLENBQUNxRCxrQkFBa0I7TUFDdkUsQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSTtNQUNkLElBQUssQ0FBRUcsVUFBVSxJQUFJQSxVQUFVLENBQUMxRixJQUFJLEtBQUtqRSxLQUFLLENBQUNtRyxrQkFBa0IsQ0FBQ3lELFdBQVcsSUFBSSxDQUFFRCxVQUFVLENBQUMxRixJQUFJLENBQUN0RSxXQUFXLEVBQUc7UUFDaEgsT0FBTyxJQUFJO01BQ1o7TUFDQUssS0FBSyxDQUFDb0csV0FBVyxHQUFHcEcsS0FBSyxDQUFDbUcsa0JBQWtCO01BRTVDLE9BQU93RCxVQUFVO0lBQ2xCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNFLHFCQUFxQkEsQ0FBRTdKLEtBQUssRUFBRztNQUN2QyxJQUFLLENBQUVBLEtBQUssRUFBRztRQUNkO01BQ0Q7TUFDQSxJQUFLQSxLQUFLLENBQUNzRyxlQUFlLEVBQUc7UUFDNUJ0RyxLQUFLLENBQUNzRyxlQUFlLENBQUN3RCxNQUFNLENBQUMsQ0FBQztNQUMvQjtNQUNBOUosS0FBSyxDQUFDc0csZUFBZSxHQUFHLElBQUk7TUFDNUJ0RyxLQUFLLENBQUN1RyxvQkFBb0IsR0FBRyxJQUFJO01BQ2pDdkcsS0FBSyxDQUFDbUcsa0JBQWtCLEdBQUcsSUFBSTtJQUNoQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzRELHlCQUF5QkEsQ0FBRS9KLEtBQUssRUFBRXlDLFNBQVMsRUFBRztNQUN0RCxJQUFJdUgsUUFBUSxHQUFHaEssS0FBSyxJQUFJQSxLQUFLLENBQUN4RSxNQUFNLEdBQUd3RSxLQUFLLENBQUN4RSxNQUFNLENBQUN5RixPQUFPLEdBQUcsSUFBSTtNQUNsRSxJQUFJZ0osa0JBQWtCO01BQ3RCLElBQUlDLGlCQUFpQjtNQUVyQixJQUFLLENBQUVGLFFBQVEsSUFBSSxDQUFFdkgsU0FBUyxFQUFHO1FBQ2hDLE9BQU8sRUFBRTtNQUNWO01BQ0F3SCxrQkFBa0IsR0FBR2pLLEtBQUssQ0FBQ2tHLFVBQVUsR0FBR25KLE1BQU0sQ0FBRWlELEtBQUssQ0FBQ2tHLFVBQVUsQ0FBQ3hGLFdBQVksQ0FBQyxHQUFHM0QsTUFBTSxDQUFFaUQsS0FBSyxDQUFDeEUsTUFBTSxDQUFDa0YsV0FBWSxDQUFDO01BQ25Id0osaUJBQWlCLEdBQUduTixNQUFNLENBQUUwRixTQUFTLENBQUMvQixXQUFZLENBQUMsS0FBS3VKLGtCQUFrQjtNQUMxRSxJQUFLQyxpQkFBaUIsRUFBRztRQUN4QixPQUFPRixRQUFRLENBQUNoTSx3QkFBd0IsR0FBRyxFQUFFLEdBQUczQyxNQUFNLENBQUUyTyxRQUFRLENBQUM3TCwwQkFBMEIsSUFBSSx1QkFBd0IsQ0FBQztNQUN6SDtNQUVBLE9BQU82TCxRQUFRLENBQUNsTSx1QkFBdUIsR0FBRyxFQUFFLEdBQUd6QyxNQUFNLENBQUUyTyxRQUFRLENBQUMvTCx5QkFBeUIsSUFBSSx1QkFBd0IsQ0FBQztJQUN2SDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTa00sd0JBQXdCQSxDQUFFQyxNQUFNLEVBQUc7TUFDM0MsSUFBSUMsY0FBYyxHQUFHdFIsSUFBSSxDQUFDc1IsY0FBYyxJQUFJLFFBQVEsS0FBSyxPQUFPdFIsSUFBSSxDQUFDc1IsY0FBYyxHQUFHdFIsSUFBSSxDQUFDc1IsY0FBYyxHQUFHLENBQUMsQ0FBQztNQUM5RyxJQUFJbFAsT0FBTyxHQUFHa1AsY0FBYyxDQUFFRCxNQUFNLENBQUUsSUFBSXJSLElBQUksQ0FBQ3VSLHVCQUF1QixJQUFJdlIsSUFBSSxDQUFDd1IsV0FBVyxJQUFJLEVBQUU7TUFFaEdyUCxRQUFRLENBQUVDLE9BQVEsQ0FBQztNQUNuQixJQUFLQSxPQUFPLElBQUkzQyxTQUFTLElBQUksVUFBVSxLQUFLLE9BQU9BLFNBQVMsQ0FBQ2dTLGtCQUFrQixFQUFHO1FBQ2pGaFMsU0FBUyxDQUFDZ1Msa0JBQWtCLENBQUVuUCxNQUFNLENBQUVGLE9BQVEsQ0FBQyxFQUFFLFNBQVMsRUFBRSxJQUFLLENBQUM7TUFDbkU7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTc1Asc0JBQXNCQSxDQUFFekssS0FBSyxFQUFHO01BQ3hDLElBQUlwQixRQUFRO01BQ1osSUFBSUksTUFBTTtNQUNWLElBQUkwTCxVQUFVO01BQ2QsSUFBSUMsYUFBYTtNQUNqQixJQUFJQyxjQUFjO01BRWxCLElBQUssQ0FBRTVLLEtBQUssSUFBSSxDQUFFQSxLQUFLLENBQUN5QyxTQUFTLElBQUksQ0FBRXpDLEtBQUssQ0FBQzJDLElBQUksQ0FBQ0csS0FBSyxDQUFDeEYsTUFBTSxJQUFJeU0seUJBQXlCLENBQUUvSixLQUFLLEVBQUVBLEtBQUssQ0FBQ3lDLFNBQVUsQ0FBQyxFQUFHO1FBQ3ZIb0gscUJBQXFCLENBQUU3SixLQUFNLENBQUM7UUFDOUI7TUFDRDtNQUNBMEssVUFBVSxHQUFHRyxzQkFBc0IsQ0FBRTdLLEtBQU0sQ0FBQztNQUM1QyxJQUFLLENBQUUwSyxVQUFVLElBQUksQ0FBRUksdUJBQXVCLENBQUU5SyxLQUFLLEVBQUUwSyxVQUFXLENBQUMsRUFBRztRQUNyRWIscUJBQXFCLENBQUU3SixLQUFNLENBQUM7UUFDOUI7TUFDRDtNQUNBLElBQUssQ0FBRUEsS0FBSyxDQUFDc0csZUFBZSxJQUFJdEcsS0FBSyxDQUFDdUcsb0JBQW9CLEtBQUt2RyxLQUFLLENBQUN5QyxTQUFTLENBQUN3QixJQUFJLEVBQUc7UUFDckY0RixxQkFBcUIsQ0FBRTdKLEtBQU0sQ0FBQztRQUM5QnBCLFFBQVEsR0FBR3hHLFFBQVEsQ0FBRVUsU0FBUyxDQUFDaVMsS0FBTSxDQUFDO1FBQ3RDL0wsTUFBTSxHQUFHeEgsUUFBUSxDQUFDeUgsYUFBYSxDQUFFLEtBQU0sQ0FBQztRQUN4QyxJQUFLLENBQUVMLFFBQVEsRUFBRztVQUNqQjtRQUNEO1FBQ0FJLE1BQU0sQ0FBQ0UsU0FBUyxHQUFHTixRQUFRLENBQUVvQixLQUFLLENBQUN3RyxVQUFXLENBQUM7UUFDL0N4RyxLQUFLLENBQUNzRyxlQUFlLEdBQUd0SCxNQUFNLENBQUNLLGlCQUFpQjtRQUNoRCxJQUFLLENBQUVXLEtBQUssQ0FBQ3NHLGVBQWUsRUFBRztVQUM5QjtRQUNEO1FBQ0F0RyxLQUFLLENBQUN1RyxvQkFBb0IsR0FBR3ZHLEtBQUssQ0FBQ3lDLFNBQVMsQ0FBQ3dCLElBQUk7UUFDakQwRyxhQUFhLEdBQUczSyxLQUFLLENBQUN5QyxTQUFTLENBQUMvQixXQUFXLEtBQUtWLEtBQUssQ0FBQ3hFLE1BQU0sQ0FBQ2tGLFdBQVcsR0FDckVWLEtBQUssQ0FBQ2pCLElBQUksQ0FBQ2tHLEtBQUssQ0FBQytGLGdCQUFnQixDQUFFLEtBQU0sQ0FBQyxHQUMxQyxtREFBbUQ7UUFDdERoTCxLQUFLLENBQUNzRyxlQUFlLENBQUNyQixLQUFLLENBQUNnRyxXQUFXLENBQUUsb0JBQW9CLEVBQUVqTCxLQUFLLENBQUNqQixJQUFJLENBQUNrRyxLQUFLLENBQUMrRixnQkFBZ0IsQ0FBRSxvQkFBcUIsQ0FBRSxDQUFDO1FBQzFIaEwsS0FBSyxDQUFDc0csZUFBZSxDQUFDckIsS0FBSyxDQUFDZ0csV0FBVyxDQUFFLE9BQU8sRUFBRWpMLEtBQUssQ0FBQ2pCLElBQUksQ0FBQ2tHLEtBQUssQ0FBQytGLGdCQUFnQixDQUFFLE9BQVEsQ0FBRSxDQUFDO1FBQ2hHaEwsS0FBSyxDQUFDc0csZUFBZSxDQUFDckIsS0FBSyxDQUFDZ0csV0FBVyxDQUFFLEtBQUssRUFBRU4sYUFBYyxDQUFDO1FBQy9EM0ssS0FBSyxDQUFDdUcsb0JBQW9CLENBQUMyRSxXQUFXLENBQUVsTCxLQUFLLENBQUNzRyxlQUFnQixDQUFDO01BQ2hFO01BQ0FzRSxjQUFjLEdBQUcsVUFBVSxLQUFLNUssS0FBSyxDQUFDeEUsTUFBTSxDQUFDeUYsT0FBTyxDQUFDeEQsZ0JBQWdCLEdBQ2xFaU4sVUFBVSxDQUFDUyw4QkFBOEIsR0FDekNULFVBQVUsQ0FBQ1UscUJBQXFCO01BQ25DcEwsS0FBSyxDQUFDc0csZUFBZSxDQUFDckIsS0FBSyxDQUFDb0csU0FBUyxHQUFHLGNBQWMsR0FBR1QsY0FBYyxHQUFHLFdBQVc7TUFDckY1SyxLQUFLLENBQUNtRyxrQkFBa0IsR0FBR3hKLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1FBQ3pDcU4sa0JBQWtCLEVBQUVsTixNQUFNLENBQUVpRCxLQUFLLENBQUNrRyxVQUFVLEdBQUdsRyxLQUFLLENBQUNrRyxVQUFVLENBQUN4RixXQUFXLEdBQUdWLEtBQUssQ0FBQ3hFLE1BQU0sQ0FBQ2tGLFdBQVksQ0FBQztRQUN4RzhJLGtCQUFrQixFQUFFek0sTUFBTSxDQUFFaUQsS0FBSyxDQUFDeUMsU0FBUyxDQUFDL0IsV0FBWSxDQUFDO1FBQ3pEa0osV0FBVyxFQUFFNUosS0FBSyxDQUFDdUc7TUFDcEIsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUytFLG1CQUFtQkEsQ0FBRTdJLFNBQVMsRUFBRztNQUN6QyxJQUFJOEksR0FBRyxHQUFHaFUsTUFBTSxDQUFDaVUsV0FBVyxDQUFDRCxHQUFHLENBQUMsQ0FBQztNQUNsQyxJQUFJRSxLQUFLLEdBQUcvUSxJQUFJLENBQUNnUixLQUFLLENBQUVuUyxPQUFPLENBQUMySSxDQUFDLEdBQUczSSxPQUFPLENBQUNxTSxPQUFPLEVBQUVyTSxPQUFPLENBQUM2SSxDQUFDLEdBQUc3SSxPQUFPLENBQUNzTSxPQUFRLENBQUM7TUFDbEYsSUFBSThGLFdBQVc7TUFFZixJQUFLRixLQUFLLElBQUsxTyxNQUFNLENBQUVuRSxlQUFlLENBQUNnVCwwQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBRSxFQUFHO1FBQUVuSixTQUFTLEdBQUcsSUFBSTtNQUFFO01BQ2pHLElBQUtBLFNBQVMsS0FBS2xKLE9BQU8sQ0FBQ3VNLGlCQUFpQixFQUFHO1FBQzlDdk0sT0FBTyxDQUFDdU0saUJBQWlCLEdBQUdyRCxTQUFTO1FBQ3JDbEosT0FBTyxDQUFDd00sZUFBZSxHQUFHd0YsR0FBRztRQUM3QjtNQUNEO01BQ0EsSUFBS0EsR0FBRyxHQUFHaFMsT0FBTyxDQUFDd00sZUFBZSxJQUFLaEosTUFBTSxDQUFFbkUsZUFBZSxDQUFDaVQsNEJBQTZCLENBQUMsSUFBSSxFQUFFLENBQUUsSUFBSXBKLFNBQVMsS0FBS2xKLE9BQU8sQ0FBQ2tKLFNBQVMsRUFBRztRQUFFO01BQVE7TUFDckosSUFBS2xKLE9BQU8sQ0FBQ2tKLFNBQVMsRUFBRztRQUFFbEosT0FBTyxDQUFDa0osU0FBUyxDQUFDd0IsSUFBSSxDQUFDcEMsU0FBUyxDQUFDaUksTUFBTSxDQUFFLCtCQUFnQyxDQUFDO01BQUU7TUFDdkdELHFCQUFxQixDQUFFdFEsT0FBUSxDQUFDO01BQ2hDQSxPQUFPLENBQUNrSixTQUFTLEdBQUdBLFNBQVM7TUFDN0IsSUFBS0EsU0FBUyxFQUFHO1FBQ2hCa0osV0FBVyxHQUFHNUIseUJBQXlCLENBQUV4USxPQUFPLEVBQUVrSixTQUFVLENBQUM7UUFDN0QsSUFBSyxDQUFFa0osV0FBVyxFQUFHO1VBQ3BCbEosU0FBUyxDQUFDd0IsSUFBSSxDQUFDcEMsU0FBUyxDQUFDc0YsR0FBRyxDQUFFLCtCQUFnQyxDQUFDO1VBQy9Eak0sUUFBUSxDQUFFRyxNQUFNLENBQUV0QyxJQUFJLENBQUMrUyxnQkFBZ0IsSUFBSSxFQUFHLENBQUMsQ0FBQ0MsT0FBTyxDQUFFLElBQUksRUFBRTFRLE1BQU0sQ0FBRW9ILFNBQVMsQ0FBQy9CLFdBQVksQ0FBRSxDQUFFLENBQUM7UUFDbkc7TUFDRDtNQUNBK0osc0JBQXNCLENBQUVsUixPQUFRLENBQUM7SUFDbEM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU21PLGVBQWVBLENBQUVqRyxLQUFLLEVBQUc7TUFDakMsSUFBSXVLLFVBQVU7TUFFZCxJQUFLelMsT0FBTyxFQUFHO1FBQ2RBLE9BQU8sQ0FBQzJJLENBQUMsR0FBR25GLE1BQU0sQ0FBRTBFLEtBQUssQ0FBQ1UsT0FBUSxDQUFDO1FBQUU1SSxPQUFPLENBQUM2SSxDQUFDLEdBQUdyRixNQUFNLENBQUUwRSxLQUFLLENBQUNZLE9BQVEsQ0FBQztRQUN4RTJKLFVBQVUsR0FBR3RELFdBQVcsQ0FBRW5QLE9BQU8sRUFBRUEsT0FBTyxDQUFDMkksQ0FBQyxFQUFFM0ksT0FBTyxDQUFDNkksQ0FBQyxFQUFFLFNBQVUsQ0FBQztRQUNwRWtKLG1CQUFtQixDQUFFLFVBQVUsS0FBS1UsVUFBVSxDQUFDNUssTUFBTSxHQUFHNEssVUFBVSxDQUFDMUgsR0FBRyxHQUFHLElBQUssQ0FBQztRQUMvRW1HLHNCQUFzQixDQUFFbFIsT0FBUSxDQUFDO01BQ2xDO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTMFMsT0FBT0EsQ0FBRXhLLEtBQUssRUFBRXlLLGNBQWMsRUFBRztNQUN6QyxJQUFJQyxPQUFPLEdBQUdELGNBQWMsSUFBSXpLLEtBQUssQ0FBQzJLLGFBQWE7TUFDbkQsSUFBSUosVUFBVTtNQUNkLElBQUkzRixvQkFBb0I7TUFDeEIsSUFBSzlNLE9BQU8sSUFBSTRTLE9BQU8sSUFBSXBQLE1BQU0sQ0FBQ3NQLFFBQVEsQ0FBRXRQLE1BQU0sQ0FBRW9QLE9BQU8sQ0FBQ2hLLE9BQVEsQ0FBRSxDQUFDLEVBQUc7UUFDekU1SSxPQUFPLENBQUMySSxDQUFDLEdBQUduRixNQUFNLENBQUVvUCxPQUFPLENBQUNoSyxPQUFRLENBQUM7UUFBRTVJLE9BQU8sQ0FBQzZJLENBQUMsR0FBR3JGLE1BQU0sQ0FBRW9QLE9BQU8sQ0FBQzlKLE9BQVEsQ0FBQztRQUM1RTJKLFVBQVUsR0FBR3RELFdBQVcsQ0FBRW5QLE9BQU8sRUFBRUEsT0FBTyxDQUFDMkksQ0FBQyxFQUFFM0ksT0FBTyxDQUFDNkksQ0FBQyxFQUFFLFNBQVUsQ0FBQztRQUNwRWlFLG9CQUFvQixHQUFHTSxnQkFBZ0IsQ0FBRXBOLE9BQU8sRUFBRWtJLEtBQUssQ0FBQzZLLEVBQUcsQ0FBQztRQUM1RC9TLE9BQU8sQ0FBQzhNLG9CQUFvQixHQUFHQSxvQkFBb0I7UUFDbkQsSUFBSyxVQUFVLEtBQUsyRixVQUFVLENBQUM1SyxNQUFNLElBQUksQ0FBRWlGLG9CQUFvQixJQUFJMkYsVUFBVSxDQUFDMUgsR0FBRyxDQUFDNUQsV0FBVyxLQUFLMkYsb0JBQW9CLENBQUMzRixXQUFXLEVBQUc7VUFDcEk0SyxtQkFBbUIsQ0FBRSxJQUFLLENBQUM7VUFDM0JiLHNCQUFzQixDQUFFbFIsT0FBUSxDQUFDO1VBQ2pDLE9BQU8sS0FBSztRQUNiO1FBQ0ErUixtQkFBbUIsQ0FBRVUsVUFBVSxDQUFDMUgsR0FBSSxDQUFDO1FBQ3JDbUcsc0JBQXNCLENBQUVsUixPQUFRLENBQUM7UUFDakMsT0FBTyxDQUFFd1EseUJBQXlCLENBQUV4USxPQUFPLEVBQUV5UyxVQUFVLENBQUMxSCxHQUFJLENBQUM7TUFDOUQ7TUFDQSxPQUFPLEtBQUs7SUFDYjs7SUFFQTtJQUNBLFNBQVNpSSxVQUFVQSxDQUFBLEVBQUc7TUFDckIsSUFBSUMsSUFBSSxHQUFHelAsTUFBTSxDQUFFbkUsZUFBZSxDQUFDNlQsc0JBQXVCLENBQUMsSUFBSSxFQUFFO01BQ2pFLElBQUlDLE9BQU8sR0FBRzNQLE1BQU0sQ0FBRW5FLGVBQWUsQ0FBQytULHFCQUFzQixDQUFDLElBQUksRUFBRTtNQUNuRSxJQUFJMUosU0FBUztNQUNiLElBQUkySixLQUFLLEdBQUcsQ0FBQztNQUVidFMsWUFBWSxHQUFHLENBQUM7TUFDaEIsSUFBSyxDQUFFZixPQUFPLElBQUksQ0FBRUEsT0FBTyxDQUFDME0sT0FBTyxFQUFHO1FBQUU7TUFBUTtNQUNoRCxJQUFLMU0sT0FBTyxDQUFDa0wsTUFBTSxFQUFHO1FBQ3JCeEIsU0FBUyxHQUFHMUosT0FBTyxDQUFDa0wsTUFBTSxDQUFDdkIscUJBQXFCLENBQUMsQ0FBQztRQUNsRCxJQUFLM0osT0FBTyxDQUFDMkksQ0FBQyxHQUFHZSxTQUFTLENBQUNLLElBQUksR0FBR2tKLElBQUksRUFBRztVQUFFSSxLQUFLLEdBQUcsQ0FBQ0YsT0FBTztRQUFFO1FBQzdELElBQUtuVCxPQUFPLENBQUMySSxDQUFDLEdBQUdlLFNBQVMsQ0FBQ00sS0FBSyxHQUFHaUosSUFBSSxFQUFHO1VBQUVJLEtBQUssR0FBR0YsT0FBTztRQUFFO1FBQzdEblQsT0FBTyxDQUFDa0wsTUFBTSxDQUFDVyxVQUFVLElBQUl3SCxLQUFLO01BQ25DO01BQ0FBLEtBQUssR0FBR3JULE9BQU8sQ0FBQzZJLENBQUMsR0FBR29LLElBQUksR0FBRyxDQUFDRSxPQUFPLEdBQUtuVCxPQUFPLENBQUM2SSxDQUFDLEdBQUc1SyxRQUFRLENBQUMrUSxlQUFlLENBQUNFLFlBQVksR0FBRytELElBQUksR0FBR0UsT0FBTyxHQUFHLENBQUc7TUFDaEgsSUFBS0UsS0FBSyxFQUFHO1FBQUVyVixNQUFNLENBQUNzVixRQUFRLENBQUUsQ0FBQyxFQUFFRCxLQUFNLENBQUM7TUFBRTtNQUM1Q3RTLFlBQVksR0FBRy9DLE1BQU0sQ0FBQ3VWLHFCQUFxQixDQUFFUCxVQUFXLENBQUM7SUFDMUQ7O0lBRUE7SUFDQSxTQUFTMUUsZ0JBQWdCQSxDQUFBLEVBQUc7TUFDM0IsSUFBSyxDQUFFdk4sWUFBWSxFQUFHO1FBQUVBLFlBQVksR0FBRy9DLE1BQU0sQ0FBQ3VWLHFCQUFxQixDQUFFUCxVQUFXLENBQUM7TUFBRTtJQUNwRjs7SUFFQTtJQUNBLFNBQVNRLGVBQWVBLENBQUEsRUFBRztNQUMxQixJQUFLelMsWUFBWSxFQUFHO1FBQUUvQyxNQUFNLENBQUN5VixvQkFBb0IsQ0FBRTFTLFlBQWEsQ0FBQztRQUFFQSxZQUFZLEdBQUcsQ0FBQztNQUFFO0lBQ3RGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyUyxZQUFZQSxDQUFFak4sS0FBSyxFQUFHO01BQzlCQSxLQUFLLENBQUM4RSxNQUFNLENBQUN3QyxZQUFZLENBQUV0SCxLQUFLLENBQUNqQixJQUFJLEVBQUVpQixLQUFLLENBQUMrRSxJQUFLLENBQUM7TUFDbkQsSUFBSyxJQUFJLEtBQUsvRSxLQUFLLENBQUNpRixLQUFLLEVBQUc7UUFBRWpGLEtBQUssQ0FBQ2pCLElBQUksQ0FBQ1UsZUFBZSxDQUFFLE9BQVEsQ0FBQztNQUFFLENBQUMsTUFBTTtRQUFFTyxLQUFLLENBQUNqQixJQUFJLENBQUNXLFlBQVksQ0FBRSxPQUFPLEVBQUVNLEtBQUssQ0FBQ2lGLEtBQU0sQ0FBQztNQUFFO01BQy9IakYsS0FBSyxDQUFDakIsSUFBSSxDQUFDVyxZQUFZLENBQUUsT0FBTyxFQUFFTSxLQUFLLENBQUNrRixVQUFXLENBQUM7TUFDcEQsSUFBS2xGLEtBQUssQ0FBQ2dHLE1BQU0sRUFBRztRQUFFaEcsS0FBSyxDQUFDZ0csTUFBTSxDQUFDOEQsTUFBTSxDQUFDLENBQUM7UUFBRTlKLEtBQUssQ0FBQ2dHLE1BQU0sR0FBRyxJQUFJO01BQUU7SUFDbkU7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2tILE9BQU9BLENBQUVsTixLQUFLLEVBQUc7TUFDekIrTSxlQUFlLENBQUMsQ0FBQztNQUNqQmxELHFCQUFxQixDQUFFN0osS0FBTSxDQUFDO01BQzlCeEksUUFBUSxDQUFDMlYsbUJBQW1CLENBQUUsYUFBYSxFQUFFekYsZUFBZSxFQUFFLElBQUssQ0FBQztNQUNwRWxRLFFBQVEsQ0FBQzJWLG1CQUFtQixDQUFFLFdBQVcsRUFBRXhGLHFCQUFxQixFQUFFLElBQUssQ0FBQztNQUN4RW5RLFFBQVEsQ0FBQzJWLG1CQUFtQixDQUFFLGVBQWUsRUFBRXZGLGVBQWUsRUFBRSxJQUFLLENBQUM7TUFDdEVyUCxLQUFLLENBQUNzSixTQUFTLENBQUNpSSxNQUFNLENBQUUsNEJBQTZCLENBQUM7TUFDdER2UixLQUFLLENBQUNpSyxnQkFBZ0IsQ0FBRSxnQ0FBaUMsQ0FBQyxDQUFDakQsT0FBTyxDQUFFLFVBQVd3SCxJQUFJLEVBQUc7UUFBRUEsSUFBSSxDQUFDbEYsU0FBUyxDQUFDaUksTUFBTSxDQUFFLCtCQUFnQyxDQUFDO01BQUUsQ0FBRSxDQUFDO01BQ3JKdFMsUUFBUSxDQUFDZ0wsZ0JBQWdCLENBQUUsNkZBQThGLENBQUMsQ0FBQ2pELE9BQU8sQ0FBRSxVQUFXd0gsSUFBSSxFQUFHO1FBQ3JKLElBQUtBLElBQUksS0FBSy9HLEtBQUssQ0FBQ2pCLElBQUksRUFBRztVQUFFZ0ksSUFBSSxDQUFDK0MsTUFBTSxDQUFDLENBQUM7UUFBRTtNQUM3QyxDQUFFLENBQUM7TUFDSCxJQUFLdFIsU0FBUyxDQUFDZ1AsOEJBQThCLEVBQUc7UUFBRWhQLFNBQVMsQ0FBQ2dQLDhCQUE4QixDQUFFLEtBQU0sQ0FBQztNQUFFO01BQ3JHLElBQUtoUCxTQUFTLENBQUMrTyx5QkFBeUIsRUFBRztRQUFFL08sU0FBUyxDQUFDK08seUJBQXlCLENBQUUsS0FBSyxFQUFFdkgsS0FBSyxDQUFDakIsSUFBSyxDQUFDO01BQUU7TUFDdkd6RixlQUFlLEdBQUcsSUFBSTtJQUN2Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVM4VCxVQUFVQSxDQUFFekssSUFBSSxFQUFFVCxDQUFDLEVBQUc7TUFDOUIsSUFBSW1MLEtBQUssR0FBRyxDQUFDLENBQUM7TUFDZDFLLElBQUksQ0FBQ0csS0FBSyxDQUFDcEYsSUFBSSxDQUFFLFVBQVdxRixJQUFJLEVBQUVDLEtBQUssRUFBRztRQUN6QyxJQUFLZCxDQUFDLElBQUlhLElBQUksQ0FBQ08sSUFBSSxJQUFJcEIsQ0FBQyxJQUFJYSxJQUFJLENBQUNRLEtBQUssRUFBRztVQUFFOEosS0FBSyxHQUFHckssS0FBSztVQUFFLE9BQU8sSUFBSTtRQUFFO1FBQ3ZFLE9BQU8sS0FBSztNQUNiLENBQUUsQ0FBQztNQUNILElBQUssQ0FBQyxDQUFDLEtBQUtxSyxLQUFLLEVBQUc7UUFBRSxPQUFPQSxLQUFLO01BQUU7TUFDcEMsSUFBSzFLLElBQUksQ0FBQ2UsTUFBTSxFQUFHO1FBQUUsT0FBT3hCLENBQUMsR0FBR1MsSUFBSSxDQUFDRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUNTLEtBQUssR0FBRyxDQUFDLEdBQUdaLElBQUksQ0FBQ0csS0FBSyxDQUFDeEYsTUFBTSxHQUFHLENBQUM7TUFBRTtNQUNqRixPQUFPNEUsQ0FBQyxHQUFHUyxJQUFJLENBQUNHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQ1EsSUFBSSxHQUFHLENBQUMsR0FBR1gsSUFBSSxDQUFDRyxLQUFLLENBQUN4RixNQUFNLEdBQUcsQ0FBQztJQUMxRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNnUSxrQkFBa0JBLENBQUVDLFdBQVcsRUFBRUMsV0FBVyxFQUFHO01BQ3ZELElBQUlDLFlBQVksR0FBR3BTLE1BQU0sQ0FBRWtTLFdBQVksQ0FBQyxDQUFDRyxLQUFLLENBQUUsMkJBQTRCLENBQUM7TUFDN0UsSUFBSUMsWUFBWSxHQUFHdFMsTUFBTSxDQUFFbVMsV0FBWSxDQUFDLENBQUNFLEtBQUssQ0FBRSwyQkFBNEIsQ0FBQztNQUM3RSxJQUFJRSxZQUFZO01BQ2hCLElBQUlDLFlBQVk7TUFFaEIsSUFBSyxDQUFFSixZQUFZLElBQUksQ0FBRUUsWUFBWSxFQUFHO1FBQUUsT0FBTyxJQUFJO01BQUU7TUFDdkRDLFlBQVksR0FBR2pRLElBQUksQ0FBQ21RLEdBQUcsQ0FBRS9RLE1BQU0sQ0FBRTBRLFlBQVksQ0FBQyxDQUFDLENBQUUsQ0FBQyxFQUFFMVEsTUFBTSxDQUFFMFEsWUFBWSxDQUFDLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFMVEsTUFBTSxDQUFFMFEsWUFBWSxDQUFDLENBQUMsQ0FBRSxDQUFFLENBQUM7TUFDOUdJLFlBQVksR0FBR2xRLElBQUksQ0FBQ21RLEdBQUcsQ0FBRS9RLE1BQU0sQ0FBRTRRLFlBQVksQ0FBQyxDQUFDLENBQUUsQ0FBQyxFQUFFNVEsTUFBTSxDQUFFNFEsWUFBWSxDQUFDLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFNVEsTUFBTSxDQUFFNFEsWUFBWSxDQUFDLENBQUMsQ0FBRSxDQUFFLENBQUM7TUFFOUcsT0FBT2pULElBQUksQ0FBQ21ELEtBQUssQ0FBRSxDQUFFZ1EsWUFBWSxHQUFHRCxZQUFZLElBQUssUUFBUyxDQUFDO0lBQ2hFOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0cscUJBQXFCQSxDQUFFcEwsSUFBSSxFQUFFVSxJQUFJLEVBQUc7TUFDNUMsSUFBSWdLLEtBQUssR0FBRyxDQUFDLENBQUM7TUFFZDFLLElBQUksQ0FBQ0csS0FBSyxDQUFDcEYsSUFBSSxDQUFFLFVBQVdxRixJQUFJLEVBQUVDLEtBQUssRUFBRztRQUN6QyxJQUFLSyxJQUFJLEtBQUtOLElBQUksQ0FBQ00sSUFBSSxFQUFHO1VBQ3pCZ0ssS0FBSyxHQUFHckssS0FBSztVQUNiLE9BQU8sSUFBSTtRQUNaO1FBQ0EsT0FBTyxLQUFLO01BQ2IsQ0FBRSxDQUFDO01BRUgsT0FBT3FLLEtBQUs7SUFDYjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTeEMsc0JBQXNCQSxDQUFFN0ssS0FBSyxFQUFHO01BQ3hDLElBQUlnTyxZQUFZO01BQ2hCLElBQUlDLFlBQVk7TUFDaEIsSUFBSUMsUUFBUTtNQUNaLElBQUlDLFNBQVM7TUFDYixJQUFJQyxnQkFBZ0I7TUFDcEIsSUFBSUMsZ0JBQWdCO01BRXBCLElBQUssQ0FBRXJPLEtBQUssSUFBSSxDQUFFQSxLQUFLLENBQUMyQyxJQUFJLElBQUksQ0FBRTNDLEtBQUssQ0FBQzJDLElBQUksQ0FBQ0csS0FBSyxDQUFDeEYsTUFBTSxFQUFHO1FBQzNELE9BQU8sSUFBSTtNQUNaO01BQ0EwUSxZQUFZLEdBQUdaLFVBQVUsQ0FBRXBOLEtBQUssQ0FBQzJDLElBQUksRUFBRTNDLEtBQUssQ0FBQzRGLE9BQVEsQ0FBQztNQUN0RHNJLFFBQVEsR0FBR2xPLEtBQUssQ0FBQ2tDLENBQUMsSUFBS2xDLEtBQUssQ0FBQ3lFLE1BQU0sR0FBR3pFLEtBQUssQ0FBQ3lFLE1BQU0sQ0FBQ1csVUFBVSxHQUFHcEYsS0FBSyxDQUFDbUYsYUFBYSxHQUFHLENBQUMsQ0FBRTtNQUN6RjhJLFlBQVksR0FBR2IsVUFBVSxDQUFFcE4sS0FBSyxDQUFDMkMsSUFBSSxFQUFFdUwsUUFBUyxDQUFDO01BQ2pEQyxTQUFTLEdBQUdiLGtCQUFrQixDQUFFdE4sS0FBSyxDQUFDMkMsSUFBSSxDQUFDRyxLQUFLLENBQUNrTCxZQUFZLENBQUMsQ0FBQzNLLElBQUksRUFBRXJELEtBQUssQ0FBQzJDLElBQUksQ0FBQ0csS0FBSyxDQUFDbUwsWUFBWSxDQUFDLENBQUM1SyxJQUFLLENBQUM7TUFDMUcrSyxnQkFBZ0IsR0FBR0wscUJBQXFCLENBQUUvTixLQUFLLENBQUMyQyxJQUFJLEVBQUUzQyxLQUFLLENBQUMyQyxJQUFJLENBQUNHLEtBQUssQ0FBQ2tMLFlBQVksQ0FBQyxDQUFDM0ssSUFBSyxDQUFDO01BQzNGZ0wsZ0JBQWdCLEdBQUdOLHFCQUFxQixDQUFFL04sS0FBSyxDQUFDMkMsSUFBSSxFQUFFM0MsS0FBSyxDQUFDMkMsSUFBSSxDQUFDRyxLQUFLLENBQUNtTCxZQUFZLENBQUMsQ0FBQzVLLElBQUssQ0FBQztNQUMzRixJQUFLLElBQUksS0FBSzhLLFNBQVMsSUFBSSxDQUFDLEdBQUdDLGdCQUFnQixJQUFJLENBQUMsR0FBR0MsZ0JBQWdCLEVBQUc7UUFBRSxPQUFPLElBQUk7TUFBRTtNQUV6RixPQUFPMVIsTUFBTSxDQUFDQyxNQUFNLENBQUU7UUFDckJvUixZQUFZLEVBQUVBLFlBQVk7UUFDMUJDLFlBQVksRUFBRUEsWUFBWTtRQUMxQkssVUFBVSxFQUFFTCxZQUFZLEdBQUdELFlBQVk7UUFDdkNWLGtCQUFrQixFQUFFYSxTQUFTO1FBQzdCO1FBQ0FJLDBCQUEwQixFQUFFLElBQUksSUFBS3ZPLEtBQUssQ0FBQzJDLElBQUksQ0FBQ0csS0FBSyxDQUFDbUwsWUFBWSxDQUFDLENBQUM5SyxXQUFXLEdBQUduRCxLQUFLLENBQUMyQyxJQUFJLENBQUNHLEtBQUssQ0FBQ2tMLFlBQVksQ0FBQyxDQUFDN0ssV0FBVyxDQUFFO1FBQzlIZ0ksOEJBQThCLEVBQUVuTCxLQUFLLENBQUMyQyxJQUFJLENBQUNHLEtBQUssQ0FBQ3VMLGdCQUFnQixDQUFDLENBQUMvSyxJQUFJLEdBQUd0RCxLQUFLLENBQUMyQyxJQUFJLENBQUNHLEtBQUssQ0FBQ3NMLGdCQUFnQixDQUFDLENBQUM5SyxJQUFJO1FBQ2pIOEgscUJBQXFCLEVBQUVwTCxLQUFLLENBQUMyQyxJQUFJLENBQUNHLEtBQUssQ0FBQ21MLFlBQVksQ0FBQyxDQUFDM0ssSUFBSSxHQUFHdEQsS0FBSyxDQUFDMkMsSUFBSSxDQUFDRyxLQUFLLENBQUNrTCxZQUFZLENBQUMsQ0FBQzFLO01BQzdGLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3dILHVCQUF1QkEsQ0FBRTlLLEtBQUssRUFBRTBLLFVBQVUsRUFBRztNQUNyRCxJQUFJOEQsa0JBQWtCLEdBQUdDLHNCQUFzQixDQUFFek8sS0FBTSxDQUFDO01BRXhELElBQUt3TyxrQkFBa0IsQ0FBQ3RFLGlCQUFpQixFQUFHO1FBQUUsT0FBTyxJQUFJO01BQUU7TUFDM0QsSUFBSyxVQUFVLEtBQUtsSyxLQUFLLENBQUN4RSxNQUFNLENBQUN5RixPQUFPLENBQUN4RCxnQkFBZ0IsRUFBRztRQUMzRCxPQUFPLENBQUMsS0FBS2lOLFVBQVUsQ0FBQzRDLGtCQUFrQjtNQUMzQztNQUVBLE9BQU8sQ0FBQyxLQUFLNUMsVUFBVSxDQUFDNkQsMEJBQTBCO0lBQ25EOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNFLHNCQUFzQkEsQ0FBRXpPLEtBQUssRUFBRztNQUN4QyxJQUFJME8sZUFBZSxHQUFHMU8sS0FBSyxDQUFDa0csVUFBVSxHQUFHbkosTUFBTSxDQUFFaUQsS0FBSyxDQUFDa0csVUFBVSxDQUFDeEYsV0FBWSxDQUFDLEdBQUczRCxNQUFNLENBQUVpRCxLQUFLLENBQUN4RSxNQUFNLENBQUNrRixXQUFZLENBQUM7TUFDcEgsSUFBSWlPLGVBQWUsR0FBRzNPLEtBQUssQ0FBQ29HLFdBQVcsR0FDcENySixNQUFNLENBQUVpRCxLQUFLLENBQUNvRyxXQUFXLENBQUNvRCxrQkFBbUIsQ0FBQyxHQUM1Q3hKLEtBQUssQ0FBQ3lDLFNBQVMsR0FBRzFGLE1BQU0sQ0FBRWlELEtBQUssQ0FBQ3lDLFNBQVMsQ0FBQy9CLFdBQVksQ0FBQyxHQUFHZ08sZUFBaUI7TUFFaEYsT0FBTy9SLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1FBQ3JCcU4sa0JBQWtCLEVBQUV5RSxlQUFlO1FBQ25DbEYsa0JBQWtCLEVBQUVtRixlQUFlO1FBQ25DekUsaUJBQWlCLEVBQUVuTSxPQUFPLENBQUUyUSxlQUFlLElBQUlDLGVBQWUsSUFBSUQsZUFBZSxLQUFLQyxlQUFnQjtNQUN2RyxDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFVBQVVBLENBQUVDLEtBQUssRUFBRUMsSUFBSSxFQUFHO01BQ2xDLElBQUlwQixLQUFLLEdBQUdyUyxNQUFNLENBQUV3VCxLQUFNLENBQUMsQ0FBQ25CLEtBQUssQ0FBRSwyQkFBNEIsQ0FBQztNQUNoRSxJQUFJckssSUFBSTtNQUNSLElBQUssQ0FBRXFLLEtBQUssRUFBRztRQUFFLE9BQU8sRUFBRTtNQUFFO01BQzVCckssSUFBSSxHQUFHLElBQUkxRixJQUFJLENBQUVBLElBQUksQ0FBQ21RLEdBQUcsQ0FBRS9RLE1BQU0sQ0FBRTJRLEtBQUssQ0FBQyxDQUFDLENBQUUsQ0FBQyxFQUFFM1EsTUFBTSxDQUFFMlEsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFM1EsTUFBTSxDQUFFMlEsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDLEdBQUdvQixJQUFLLENBQUUsQ0FBQztNQUNwRyxPQUFPekwsSUFBSSxDQUFDMEwsV0FBVyxDQUFDLENBQUMsQ0FBQ2xVLEtBQUssQ0FBRSxDQUFDLEVBQUUsRUFBRyxDQUFDO0lBQ3pDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU21VLFdBQVdBLENBQUVDLEtBQUssRUFBRXhMLFFBQVEsRUFBRztNQUN2QyxJQUFJeUwsTUFBTSxHQUFHLENBQUMsQ0FBQztNQUNmLElBQUlDLFNBQVM7TUFDYixJQUFJO1FBQ0hBLFNBQVMsR0FBRyxJQUFJNVgsTUFBTSxDQUFDNlgsSUFBSSxDQUFDQyxjQUFjLENBQUUsT0FBTyxFQUFFO1VBQUVDLFFBQVEsRUFBRTdMLFFBQVE7VUFBRThMLElBQUksRUFBRSxTQUFTO1VBQUVDLEtBQUssRUFBRSxTQUFTO1VBQUVDLEdBQUcsRUFBRSxTQUFTO1VBQUVDLElBQUksRUFBRSxTQUFTO1VBQUVDLFNBQVMsRUFBRSxLQUFLO1VBQUVDLE1BQU0sRUFBRSxTQUFTO1VBQUV4RyxNQUFNLEVBQUU7UUFBVSxDQUFFLENBQUM7UUFDek0rRixTQUFTLENBQUNVLGFBQWEsQ0FBRSxJQUFJbFMsSUFBSSxDQUFFc1IsS0FBTSxDQUFFLENBQUMsQ0FBQzFQLE9BQU8sQ0FBRSxVQUFXdVEsSUFBSSxFQUFHO1VBQUUsSUFBSyxTQUFTLEtBQUtBLElBQUksQ0FBQ2xPLElBQUksRUFBRztZQUFFc04sTUFBTSxDQUFDWSxJQUFJLENBQUNsTyxJQUFJLENBQUMsR0FBRzdFLE1BQU0sQ0FBRStTLElBQUksQ0FBQ2pCLEtBQU0sQ0FBQztVQUFFO1FBQUUsQ0FBRSxDQUFDO01BQzNKLENBQUMsQ0FBQyxPQUFRNVQsS0FBSyxFQUFHO1FBQUUsT0FBTyxJQUFJO01BQUU7TUFDakMsT0FBT2lVLE1BQU0sQ0FBQ0ssSUFBSSxHQUFHTCxNQUFNLEdBQUcsSUFBSTtJQUNuQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNhLGNBQWNBLENBQUVkLEtBQUssRUFBRXhMLFFBQVEsRUFBRztNQUMxQyxJQUFJdU0sS0FBSyxHQUFHaEIsV0FBVyxDQUFFQyxLQUFLLEVBQUV4TCxRQUFTLENBQUM7TUFDMUMsSUFBSXdNLFdBQVc7TUFDZixJQUFJQyxNQUFNO01BQ1YsSUFBSUMsSUFBSTtNQUNSLElBQUlDLEdBQUcsR0FBRyxTQUFBQSxDQUFXdkIsS0FBSyxFQUFFdlIsTUFBTSxFQUFHO1FBQUUsT0FBT2pDLE1BQU0sQ0FBRVgsSUFBSSxDQUFDMk8sR0FBRyxDQUFFM08sSUFBSSxDQUFDbUQsS0FBSyxDQUFFZ1IsS0FBTSxDQUFFLENBQUUsQ0FBQyxDQUFDd0IsUUFBUSxDQUFFL1MsTUFBTSxFQUFFLEdBQUksQ0FBQztNQUFFLENBQUM7TUFDbEgsSUFBSyxDQUFFMFMsS0FBSyxFQUFHO1FBQUUsT0FBTyxFQUFFO01BQUU7TUFDNUJDLFdBQVcsR0FBR3RTLElBQUksQ0FBQ21RLEdBQUcsQ0FBRWtDLEtBQUssQ0FBQ1QsSUFBSSxFQUFFUyxLQUFLLENBQUNSLEtBQUssR0FBRyxDQUFDLEVBQUVRLEtBQUssQ0FBQ1AsR0FBRyxFQUFFTyxLQUFLLENBQUNOLElBQUksRUFBRU0sS0FBSyxDQUFDSixNQUFNLEVBQUVJLEtBQUssQ0FBQzVHLE1BQU8sQ0FBQztNQUN4RzhHLE1BQU0sR0FBR3hWLElBQUksQ0FBQ21ELEtBQUssQ0FBRSxDQUFFb1MsV0FBVyxHQUFHaEIsS0FBSyxJQUFLLEtBQU0sQ0FBQztNQUFFa0IsSUFBSSxHQUFHLENBQUMsSUFBSUQsTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFHO01BQ3RGLE9BQU9FLEdBQUcsQ0FBRUosS0FBSyxDQUFDVCxJQUFJLEVBQUUsQ0FBRSxDQUFDLEdBQUcsR0FBRyxHQUFHYSxHQUFHLENBQUVKLEtBQUssQ0FBQ1IsS0FBSyxFQUFFLENBQUUsQ0FBQyxHQUFHLEdBQUcsR0FBR1ksR0FBRyxDQUFFSixLQUFLLENBQUNQLEdBQUcsRUFBRSxDQUFFLENBQUMsR0FBRyxHQUFHLEdBQUdXLEdBQUcsQ0FBRUosS0FBSyxDQUFDTixJQUFJLEVBQUUsQ0FBRSxDQUFDLEdBQUcsR0FBRyxHQUFHVSxHQUFHLENBQUVKLEtBQUssQ0FBQ0osTUFBTSxFQUFFLENBQUUsQ0FBQyxHQUFHLEtBQUssR0FBR08sSUFBSSxHQUFHQyxHQUFHLENBQUUxVixJQUFJLENBQUM0VixLQUFLLENBQUU1VixJQUFJLENBQUMyTyxHQUFHLENBQUU2RyxNQUFPLENBQUMsR0FBRyxFQUFHLENBQUMsRUFBRSxDQUFFLENBQUMsR0FBRyxHQUFHLEdBQUdFLEdBQUcsQ0FBRTFWLElBQUksQ0FBQzJPLEdBQUcsQ0FBRTZHLE1BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFFLENBQUM7SUFDN1A7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0ssYUFBYUEsQ0FBRXZRLEtBQUssRUFBRztNQUMvQixJQUFJMEssVUFBVTtNQUNkLElBQUlWLFFBQVEsR0FBR2hLLEtBQUssQ0FBQ3hFLE1BQU0sQ0FBQ3lGLE9BQU87TUFDbkMsSUFBSXVOLGtCQUFrQixHQUFHQyxzQkFBc0IsQ0FBRXpPLEtBQU0sQ0FBQztNQUN4RCxJQUFJM0MsY0FBYyxHQUFHbVIsa0JBQWtCLENBQUN0RSxpQkFBaUI7TUFDekQsSUFBSXlFLGVBQWUsR0FBR3RSLGNBQWMsR0FBR21SLGtCQUFrQixDQUFDaEYsa0JBQWtCLEdBQUdRLFFBQVEsQ0FBQy9NLG1CQUFtQjtNQUMzRyxJQUFJdVQsUUFBUTtNQUVaOUYsVUFBVSxHQUFHRyxzQkFBc0IsQ0FBRTdLLEtBQU0sQ0FBQztNQUM1QyxJQUFLLENBQUUwSyxVQUFVLElBQUksQ0FBRUksdUJBQXVCLENBQUU5SyxLQUFLLEVBQUUwSyxVQUFXLENBQUMsRUFBRztRQUFFLE9BQU8sSUFBSTtNQUFFO01BQ3JGLElBQU9yTixjQUFjLElBQUksQ0FBRTJNLFFBQVEsQ0FBQ2hNLHdCQUF3QixJQUFRLENBQUVYLGNBQWMsSUFBSSxDQUFFMk0sUUFBUSxDQUFDbE0sdUJBQXlCLEVBQUc7UUFBRSxPQUFPLElBQUk7TUFBRTtNQUM5STBTLFFBQVEsR0FBRztRQUNWQyxjQUFjLEVBQUUxVCxNQUFNLENBQUVyRSxnQkFBZ0IsQ0FBQytYLGNBQWUsQ0FBQztRQUFFelQsVUFBVSxFQUFFZ04sUUFBUSxDQUFDaE4sVUFBVTtRQUMxRjBULGtCQUFrQixFQUFFclQsY0FBYyxHQUFHLHFCQUFxQixHQUFHLE1BQU07UUFDbkVzVCxTQUFTLEVBQUV0VCxjQUFjLEdBQUcsaUJBQWlCLEdBQUcsT0FBTztRQUFFbU0sa0JBQWtCLEVBQUVtRixlQUFlO1FBQzVGblIsZ0JBQWdCLEVBQUV3TSxRQUFRLENBQUN4TSxnQkFBZ0I7UUFBRU4saUJBQWlCLEVBQUU4TSxRQUFRLENBQUM5TSxpQkFBaUI7UUFDMUZDLG9CQUFvQixFQUFFNk0sUUFBUSxDQUFDN007TUFDaEMsQ0FBQztNQUNELElBQUssVUFBVSxLQUFLNk0sUUFBUSxDQUFDdk0sZ0JBQWdCLEVBQUc7UUFDL0MrUyxRQUFRLENBQUNJLGNBQWMsR0FBRzVHLFFBQVEsQ0FBQzFOLGNBQWMsQ0FBQ0MsR0FBRyxDQUFFLFVBQVc4RyxJQUFJLEVBQUc7VUFBRSxPQUFPdUwsVUFBVSxDQUFFdkwsSUFBSSxFQUFFcUgsVUFBVSxDQUFDNEMsa0JBQW1CLENBQUM7UUFBRSxDQUFFLENBQUM7UUFDeEksT0FBT2tELFFBQVEsQ0FBQ0ksY0FBYyxDQUFDQyxLQUFLLENBQUU5UyxPQUFRLENBQUMsR0FBR3BCLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFNFQsUUFBUyxDQUFDLEdBQUcsSUFBSTtNQUNuRjtNQUNBQSxRQUFRLENBQUNNLGtCQUFrQixHQUFHOUcsUUFBUSxDQUFDdk4sZUFBZSxDQUFDRixHQUFHLENBQUUsVUFBV0csUUFBUSxFQUFHO1FBQ2pGLE9BQU9DLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1VBQUVDLEtBQUssRUFBRWtULGNBQWMsQ0FBRXBTLElBQUksQ0FBQ0MsS0FBSyxDQUFFbEIsUUFBUSxDQUFDRyxLQUFNLENBQUMsR0FBRzZOLFVBQVUsQ0FBQzZELDBCQUEwQixFQUFFdk8sS0FBSyxDQUFDMkMsSUFBSSxDQUFDYyxRQUFTLENBQUM7VUFBRTNHLEdBQUcsRUFBRWlULGNBQWMsQ0FBRXBTLElBQUksQ0FBQ0MsS0FBSyxDQUFFbEIsUUFBUSxDQUFDSSxHQUFJLENBQUMsR0FBRzROLFVBQVUsQ0FBQzZELDBCQUEwQixFQUFFdk8sS0FBSyxDQUFDMkMsSUFBSSxDQUFDYyxRQUFTO1FBQUUsQ0FBRSxDQUFDO01BQy9QLENBQUUsQ0FBQztNQUNILE9BQU8rTSxRQUFRLENBQUNNLGtCQUFrQixDQUFDRCxLQUFLLENBQUUsVUFBV25VLFFBQVEsRUFBRztRQUFFLE9BQU9BLFFBQVEsQ0FBQ0csS0FBSyxJQUFJSCxRQUFRLENBQUNJLEdBQUc7TUFBRSxDQUFFLENBQUMsR0FBR0gsTUFBTSxDQUFDQyxNQUFNLENBQUU0VCxRQUFTLENBQUMsR0FBRyxJQUFJO0lBQ2hKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNPLG9CQUFvQkEsQ0FBRWhTLElBQUksRUFBRztNQUNyQyxJQUFJSCxRQUFRLEdBQUd4RyxRQUFRLENBQUVVLFNBQVMsQ0FBQ2tZLE9BQVEsQ0FBQztNQUM1QyxJQUFJaFMsTUFBTSxHQUFHeEgsUUFBUSxDQUFDeUgsYUFBYSxDQUFFLE1BQU8sQ0FBQztNQUM3QyxJQUFJZSxLQUFLO01BRVRpUixrQkFBa0IsQ0FBRXhYLG9CQUFxQixDQUFDO01BQzFDdUcsS0FBSyxHQUFHO1FBQ1BqQixJQUFJLEVBQUVBLElBQUk7UUFDVm1TLE9BQU8sRUFBRSxJQUFJO1FBQ2JDLGlCQUFpQixFQUFFLElBQUk7UUFDdkJDLGtCQUFrQixFQUFFclMsSUFBSSxHQUFHQSxJQUFJLENBQUN3RCxZQUFZLENBQUUsV0FBWSxDQUFDLEdBQUcsSUFBSTtRQUNsRThPLFFBQVEsRUFBRTtNQUNYLENBQUM7TUFDRCxJQUFLdFMsSUFBSSxJQUFJSCxRQUFRLEVBQUc7UUFDdkJJLE1BQU0sQ0FBQ0UsU0FBUyxHQUFHTixRQUFRLENBQUUsQ0FBQyxDQUFFLENBQUM7UUFDakNvQixLQUFLLENBQUNrUixPQUFPLEdBQUdsUyxNQUFNLENBQUNLLGlCQUFpQjtRQUN4QyxJQUFLVyxLQUFLLENBQUNrUixPQUFPLEVBQUc7VUFDcEJuUyxJQUFJLENBQUNtTSxXQUFXLENBQUVsTCxLQUFLLENBQUNrUixPQUFRLENBQUM7UUFDbEM7TUFDRDtNQUNBLElBQUtuUyxJQUFJLEVBQUc7UUFDWEEsSUFBSSxDQUFDOEMsU0FBUyxDQUFDc0YsR0FBRyxDQUFFLG9DQUFxQyxDQUFDO1FBQzFEcEksSUFBSSxDQUFDVyxZQUFZLENBQUUsV0FBVyxFQUFFLE1BQU8sQ0FBQztNQUN6QztNQUNBbkgsS0FBSyxDQUFDc0osU0FBUyxDQUFDc0YsR0FBRyxDQUFFLG9DQUFxQyxDQUFDO01BQzNEMU4sb0JBQW9CLEdBQUd1RyxLQUFLO01BQzVCLElBQUt4SCxTQUFTLENBQUMrTyx5QkFBeUIsRUFBRztRQUFFL08sU0FBUyxDQUFDK08seUJBQXlCLENBQUUsSUFBSSxFQUFFeEksSUFBSyxDQUFDO01BQUU7TUFDaEcsSUFBS3ZHLFNBQVMsQ0FBQ2dQLDhCQUE4QixFQUFHO1FBQUVoUCxTQUFTLENBQUNnUCw4QkFBOEIsQ0FBRSxJQUFLLENBQUM7TUFBRTtNQUVwRyxPQUFPeEgsS0FBSztJQUNiOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNpUixrQkFBa0JBLENBQUVqUixLQUFLLEVBQUc7TUFDcEMsSUFBSyxDQUFFQSxLQUFLLElBQUlBLEtBQUssQ0FBQ3FSLFFBQVEsRUFBRztRQUNoQztNQUNEO01BQ0FyUixLQUFLLENBQUNxUixRQUFRLEdBQUcsSUFBSTtNQUNyQkMsc0JBQXNCLENBQUV0UixLQUFLLENBQUNtUixpQkFBa0IsQ0FBQztNQUNqRG5SLEtBQUssQ0FBQ21SLGlCQUFpQixHQUFHLElBQUk7TUFDOUIsSUFBS25SLEtBQUssQ0FBQ2tSLE9BQU8sRUFBRztRQUNwQmxSLEtBQUssQ0FBQ2tSLE9BQU8sQ0FBQ3BILE1BQU0sQ0FBQyxDQUFDO1FBQ3RCOUosS0FBSyxDQUFDa1IsT0FBTyxHQUFHLElBQUk7TUFDckI7TUFDQSxJQUFLbFIsS0FBSyxDQUFDakIsSUFBSSxFQUFHO1FBQ2pCaUIsS0FBSyxDQUFDakIsSUFBSSxDQUFDOEMsU0FBUyxDQUFDaUksTUFBTSxDQUFFLG9DQUFxQyxDQUFDO1FBQ25FLElBQUssSUFBSSxLQUFLOUosS0FBSyxDQUFDb1Isa0JBQWtCLEVBQUc7VUFDeENwUixLQUFLLENBQUNqQixJQUFJLENBQUNVLGVBQWUsQ0FBRSxXQUFZLENBQUM7UUFDMUMsQ0FBQyxNQUFNO1VBQ05PLEtBQUssQ0FBQ2pCLElBQUksQ0FBQ1csWUFBWSxDQUFFLFdBQVcsRUFBRU0sS0FBSyxDQUFDb1Isa0JBQW1CLENBQUM7UUFDakU7TUFDRDtNQUNBLElBQUszWCxvQkFBb0IsS0FBS3VHLEtBQUssRUFBRztRQUNyQztNQUNEO01BQ0F2RyxvQkFBb0IsR0FBRyxJQUFJO01BQzNCbEIsS0FBSyxDQUFDc0osU0FBUyxDQUFDaUksTUFBTSxDQUFFLG9DQUFxQyxDQUFDO01BQzlELElBQUt0UixTQUFTLENBQUNnUCw4QkFBOEIsRUFBRztRQUFFaFAsU0FBUyxDQUFDZ1AsOEJBQThCLENBQUUsS0FBTSxDQUFDO01BQUU7TUFDckcsSUFBS2hQLFNBQVMsQ0FBQytPLHlCQUF5QixFQUFHO1FBQUUvTyxTQUFTLENBQUMrTyx5QkFBeUIsQ0FBRSxLQUFLLEVBQUV2SCxLQUFLLENBQUNqQixJQUFLLENBQUM7TUFBRTtJQUN4Rzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3dTLHdCQUF3QkEsQ0FBQSxFQUFHO01BQ25DLElBQUk5TSxNQUFNLEdBQUdsTSxLQUFLLENBQUNnRyxhQUFhLENBQUUsNkJBQThCLENBQUM7TUFFakUsSUFBSyxDQUFFckUsZ0JBQWdCLEVBQUc7UUFDekI7TUFDRDtNQUNBLElBQUt1SyxNQUFNLEVBQUc7UUFDYkEsTUFBTSxDQUFDVyxVQUFVLEdBQUdySSxNQUFNLENBQUU3QyxnQkFBZ0IsQ0FBQ2lMLGFBQWMsQ0FBQyxJQUFJLENBQUM7TUFDbEU7TUFDQTVOLE1BQU0sQ0FBQ2lhLFFBQVEsQ0FBRXpVLE1BQU0sQ0FBRTdDLGdCQUFnQixDQUFDb0wsS0FBTSxDQUFDLElBQUksQ0FBQyxFQUFFdkksTUFBTSxDQUFFN0MsZ0JBQWdCLENBQUNzTCxLQUFNLENBQUMsSUFBSSxDQUFFLENBQUM7SUFDaEc7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2lNLGlCQUFpQkEsQ0FBRXpVLFVBQVUsRUFBRztNQUN4QyxJQUFJMFUsYUFBYSxHQUFHLElBQUk7TUFDeEIsSUFBSUMsVUFBVSxHQUFHLElBQUk7TUFFckJ6WSxlQUFlLENBQUN3RSxJQUFJLENBQUUsVUFBV2xDLE1BQU0sRUFBRztRQUN6QyxJQUFLQSxNQUFNLENBQUN3QixVQUFVLEtBQUtBLFVBQVUsSUFBSSxDQUFFeEIsTUFBTSxDQUFDdUQsSUFBSSxDQUFDWSxXQUFXLEVBQUc7VUFDcEUsT0FBTyxLQUFLO1FBQ2I7UUFDQSxJQUFLLENBQUVnUyxVQUFVLEVBQUc7VUFDbkJBLFVBQVUsR0FBR25XLE1BQU0sQ0FBQ3VELElBQUk7UUFDekI7UUFDQSxJQUFLdkQsTUFBTSxDQUFDdUQsSUFBSSxDQUFDOEMsU0FBUyxDQUFDQyxRQUFRLENBQUUscUJBQXNCLENBQUMsRUFBRztVQUM5RDRQLGFBQWEsR0FBR2xXLE1BQU0sQ0FBQ3VELElBQUk7VUFDM0IsT0FBTyxJQUFJO1FBQ1o7UUFDQSxPQUFPLEtBQUs7TUFDYixDQUFFLENBQUM7TUFFSCxPQUFPMlMsYUFBYSxJQUFJQyxVQUFVO0lBQ25DOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsdUJBQXVCQSxDQUFFNVUsVUFBVSxFQUFHO01BQzlDLElBQ0M5QyxnQkFBZ0IsSUFDYixVQUFVLEtBQUssT0FBT0EsZ0JBQWdCLENBQUMyWCxhQUFhLElBQ3BELElBQUksS0FBSzNYLGdCQUFnQixDQUFDMlgsYUFBYSxDQUFFN1UsVUFBVyxDQUFDLEVBQ3ZEO1FBQ0Q3Qyw2QkFBNkIsR0FBRyxDQUFDO1FBQ2pDO01BQ0Q7TUFDQSxJQUFJNEUsSUFBSSxHQUFHM0UsZ0JBQWdCLElBQUlBLGdCQUFnQixDQUFDdUYsV0FBVyxHQUFHdkYsZ0JBQWdCLEdBQUdxWCxpQkFBaUIsQ0FBRXpVLFVBQVcsQ0FBQztNQUNoSCxJQUFJNkIsSUFBSSxHQUFHRSxJQUFJLEdBQUdBLElBQUksQ0FBQ1IsYUFBYSxDQUFFLDRDQUE2QyxDQUFDLEdBQUcsSUFBSTtNQUMzRixJQUFJdVQsU0FBUyxHQUFHL1MsSUFBSSxHQUFHQSxJQUFJLENBQUNSLGFBQWEsQ0FBRSxxQ0FBc0MsQ0FBQyxHQUFHLElBQUk7TUFFekYsSUFBS00sSUFBSSxFQUFHO1FBQ1gxRSw2QkFBNkIsR0FBRyxDQUFDO1FBQ2pDMEUsSUFBSSxDQUFDZSxLQUFLLENBQUMsQ0FBQztRQUNaO01BQ0Q7TUFDQXpGLDZCQUE2QixHQUFHNkMsVUFBVTtNQUMxQyxJQUFLOFUsU0FBUyxFQUFHO1FBQ2hCQSxTQUFTLENBQUNsUyxLQUFLLENBQUMsQ0FBQztRQUNqQjtNQUNEO01BQ0EsSUFBSzFGLGdCQUFnQixJQUFJQSxnQkFBZ0IsQ0FBQzBGLEtBQUssSUFBSTFGLGdCQUFnQixDQUFDMEYsS0FBSyxDQUFDRCxXQUFXLEVBQUc7UUFDdkZ4Riw2QkFBNkIsR0FBRyxDQUFDO1FBQ2pDRCxnQkFBZ0IsQ0FBQzBGLEtBQUssQ0FBQ0EsS0FBSyxDQUFDLENBQUM7TUFDL0I7SUFDRDs7SUFFQTtJQUNBLFNBQVNtUyxrQkFBa0JBLENBQUEsRUFBRztNQUM3QixJQUFLclksV0FBVyxFQUFHO1FBQ2xCQSxXQUFXLENBQUNvUSxNQUFNLENBQUMsQ0FBQztRQUNwQnBRLFdBQVcsR0FBRyxJQUFJO01BQ25CO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNzWSxZQUFZQSxDQUFBLEVBQUc7TUFDdkIsSUFBSWhWLFVBQVUsR0FBRzlDLGdCQUFnQixHQUFHQSxnQkFBZ0IsQ0FBQzhDLFVBQVUsR0FBRyxDQUFDO01BRW5FLElBQUssQ0FBQyxDQUFDLEtBQUssQ0FBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsZUFBZSxDQUFFLENBQUNpVixPQUFPLENBQUVqWSxlQUFnQixDQUFDLEVBQUc7UUFDaEc7TUFDRDtNQUNBQyxvQkFBb0IsSUFBSSxDQUFDO01BQ3pCLElBQUtULGNBQWMsSUFBSUEsY0FBYyxDQUFDMFksS0FBSyxFQUFHO1FBQzdDMVksY0FBYyxDQUFDMFksS0FBSyxDQUFDLENBQUM7TUFDdkI7TUFDQTFZLGNBQWMsR0FBRyxJQUFJO01BQ3JCRyxhQUFhLEdBQUcsSUFBSTtNQUNwQkcsb0JBQW9CLEdBQUcsSUFBSTtNQUMzQkMsa0JBQWtCLEdBQUcsSUFBSTtNQUN6QmtYLGtCQUFrQixDQUFFeFgsb0JBQXFCLENBQUM7TUFDMUNzWSxrQkFBa0IsQ0FBQyxDQUFDO01BQ3BCeFosS0FBSyxDQUFDc0osU0FBUyxDQUFDaUksTUFBTSxDQUFFLG1DQUFvQyxDQUFDO01BQzdEOVAsZUFBZSxHQUFHLE1BQU07TUFDeEJ1WCx3QkFBd0IsQ0FBQyxDQUFDO01BQzFCSyx1QkFBdUIsQ0FBRTVVLFVBQVcsQ0FBQztNQUNyQzlDLGdCQUFnQixHQUFHLElBQUk7TUFDdkJFLGdCQUFnQixHQUFHLElBQUk7SUFDeEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUytYLHNCQUFzQkEsQ0FBQSxFQUFHO01BQ2pDLElBQUssVUFBVSxLQUFLLE9BQU81YSxNQUFNLENBQUM2YSxrQ0FBa0MsRUFBRztRQUN0RSxPQUFPLElBQUk7TUFDWjtNQUVBN2EsTUFBTSxDQUFDNmEsa0NBQWtDLENBQUUsRUFBRyxDQUFDO01BRS9DLE9BQU83YSxNQUFNLENBQUNXLE1BQU0sQ0FBRSwwQ0FBMkMsQ0FBQyxDQUFDbWEsSUFBSSxDQUFDLENBQUMsQ0FBQ3JRLE9BQU8sQ0FBRSxzQkFBdUIsQ0FBQztJQUM1Rzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTc1Asc0JBQXNCQSxDQUFFSCxpQkFBaUIsRUFBRztNQUNwRCxJQUFLQSxpQkFBaUIsSUFBSUEsaUJBQWlCLENBQUM3VCxNQUFNLEVBQUc7UUFDcEQ2VCxpQkFBaUIsQ0FBQ21CLElBQUksQ0FBRSxJQUFJLEVBQUUsSUFBSyxDQUFDLENBQUNDLElBQUksQ0FBQyxDQUFDO01BQzVDO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyx3QkFBd0JBLENBQUVyWCxPQUFPLEVBQUc7TUFDNUMsSUFBS0EsT0FBTyxJQUFJM0MsU0FBUyxJQUFJLFVBQVUsS0FBSyxPQUFPQSxTQUFTLENBQUNnUyxrQkFBa0IsRUFBRztRQUNqRmhTLFNBQVMsQ0FBQ2dTLGtCQUFrQixDQUFFblAsTUFBTSxDQUFFRixPQUFRLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBTSxDQUFDO01BQ2xFO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTc1gsaUJBQWlCQSxDQUFFdFIsY0FBYyxFQUFFdVIsZ0JBQWdCLEVBQUc7TUFDOUQsSUFBSUMsVUFBVSxHQUFHeFIsY0FBYyxJQUFJQSxjQUFjLENBQUN5UixZQUFZLEdBQUd6UixjQUFjLENBQUN5UixZQUFZLENBQUNqWCxJQUFJLEdBQUcsSUFBSTtNQUV4RyxPQUFPO1FBQ05rWCxJQUFJLEVBQUVGLFVBQVUsSUFBSSxRQUFRLEtBQUssT0FBT0EsVUFBVSxDQUFDRSxJQUFJLEdBQUdGLFVBQVUsQ0FBQ0UsSUFBSSxHQUFHLEVBQUU7UUFDOUUxWCxPQUFPLEVBQUV3WCxVQUFVLElBQUksUUFBUSxLQUFLLE9BQU9BLFVBQVUsQ0FBQ3hYLE9BQU8sSUFBSXdYLFVBQVUsQ0FBQ3hYLE9BQU8sR0FDaEZ3WCxVQUFVLENBQUN4WCxPQUFPLEdBQ2xCRSxNQUFNLENBQUVxWCxnQkFBZ0IsSUFBSSxFQUFHO01BQ25DLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0ksb0JBQW9CQSxDQUFBLEVBQUc7TUFDL0IsSUFBSUMsY0FBYyxHQUFHclosV0FBVyxHQUFHQSxXQUFXLENBQUM2RSxhQUFhLENBQUUsb0RBQXFELENBQUMsR0FBRyxJQUFJO01BQzNILElBQUl5VSxhQUFhLEdBQUd0WixXQUFXLEdBQUdBLFdBQVcsQ0FBQzZFLGFBQWEsQ0FBRSw2Q0FBOEMsQ0FBQyxHQUFHLElBQUk7TUFDbkgsSUFBSTBVLGFBQWEsR0FBR3ZaLFdBQVcsR0FBR0EsV0FBVyxDQUFDNkUsYUFBYSxDQUFFLHFEQUFzRCxDQUFDLEdBQUcsSUFBSTtNQUUzSCxJQUFLd1UsY0FBYyxFQUFHO1FBQ3JCQSxjQUFjLENBQUN0TCxnQkFBZ0IsQ0FBRSxPQUFPLEVBQUV1SyxZQUFhLENBQUM7TUFDekQ7TUFDQSxJQUFLZ0IsYUFBYSxFQUFHO1FBQ3BCQSxhQUFhLENBQUN2TCxnQkFBZ0IsQ0FBRSxPQUFPLEVBQUV5TCxhQUFjLENBQUM7TUFDekQ7TUFDQSxJQUFLRCxhQUFhLEVBQUc7UUFDcEJBLGFBQWEsQ0FBQ3hMLGdCQUFnQixDQUFFLE9BQU8sRUFBRTBMLG1CQUFvQixDQUFDO01BQy9EO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MscUJBQXFCQSxDQUFFQyxVQUFVLEVBQUc7TUFDNUMsSUFBSUMsS0FBSyxHQUFHbGIsUUFBUSxDQUFFVSxTQUFTLENBQUN5YSxNQUFPLENBQUM7TUFDeEMsSUFBSUMsYUFBYTtNQUVqQixJQUFLLENBQUVGLEtBQUssRUFBRztRQUNkLE9BQU8sS0FBSztNQUNiO01BQ0F2QixrQkFBa0IsQ0FBQyxDQUFDO01BQ3BCclksV0FBVyxHQUFHbEMsUUFBUSxDQUFDeUgsYUFBYSxDQUFFLEtBQU0sQ0FBQztNQUM3Q3ZGLFdBQVcsQ0FBQytaLFNBQVMsR0FBRyxzRUFBc0U7TUFDOUYvWixXQUFXLENBQUN3RixTQUFTLEdBQUdvVSxLQUFLLENBQUVELFVBQVcsQ0FBQztNQUMzQzdiLFFBQVEsQ0FBQ2tjLElBQUksQ0FBQ3hJLFdBQVcsQ0FBRXhSLFdBQVksQ0FBQztNQUN4Q29aLG9CQUFvQixDQUFDLENBQUM7TUFDdEJVLGFBQWEsR0FBRzlaLFdBQVcsQ0FBQzZFLGFBQWEsQ0FBRSxvTUFBcU0sQ0FBQztNQUNqUCxJQUFLaVYsYUFBYSxFQUFHO1FBQ3BCQSxhQUFhLENBQUM1VCxLQUFLLENBQUMsQ0FBQztNQUN0QjtNQUVBLE9BQU8sSUFBSTtJQUNaOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUytULG9CQUFvQkEsQ0FBRXZTLE1BQU0sRUFBRXdTLE9BQU8sRUFBRztNQUNoRCxJQUFJQyxlQUFlLEdBQUdELE9BQU8sSUFBSSxDQUFDLENBQUM7TUFFbkMsSUFBSyxDQUFFamEsYUFBYSxJQUFJLENBQUVBLGFBQWEsQ0FBQ21hLFdBQVcsRUFBRztRQUNyRCxPQUFPLEtBQUs7TUFDYjtNQUVBLE9BQU9WLHFCQUFxQixDQUFFO1FBQzdCMU8sS0FBSyxFQUFFM0wsSUFBSSxDQUFDZ2IsWUFBWSxJQUFJLEVBQUU7UUFDOUIzUyxNQUFNLEVBQUVBLE1BQU0sSUFBSSxFQUFFO1FBQ3BCMFMsV0FBVyxFQUFFbmEsYUFBYSxDQUFDbWEsV0FBVztRQUN0Q0UsWUFBWSxFQUFFamIsSUFBSSxDQUFDa2IsTUFBTSxJQUFJLEVBQUU7UUFDL0JDLFdBQVcsRUFBRW5iLElBQUksQ0FBQ29iLEtBQUssSUFBSSxFQUFFO1FBQzdCQyxtQkFBbUIsRUFBRXJiLElBQUksQ0FBQ3NiLGFBQWEsSUFBSSxFQUFFO1FBQzdDQyxVQUFVLEVBQUV2VyxPQUFPLENBQUU4VixlQUFlLENBQUNTLFVBQVcsQ0FBQztRQUNqREMsU0FBUyxFQUFFeFcsT0FBTyxDQUFFOFYsZUFBZSxDQUFDVSxTQUFVLENBQUM7UUFDL0NDLGlCQUFpQixFQUFFelcsT0FBTyxDQUFFOFYsZUFBZSxDQUFDVyxpQkFBa0IsQ0FBQztRQUMvREMsT0FBTyxFQUFFMVcsT0FBTyxDQUFFOFYsZUFBZSxDQUFDWSxPQUFRO01BQzNDLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLHFCQUFxQkEsQ0FBRUMsYUFBYSxFQUFHO01BQy9DLElBQUkzWCxVQUFVLEdBQUc5QyxnQkFBZ0IsR0FBR0EsZ0JBQWdCLENBQUM4QyxVQUFVLEdBQUcsQ0FBQztNQUVuRXJELGFBQWEsR0FBRyxJQUFJO01BQ3BCb1ksa0JBQWtCLENBQUMsQ0FBQztNQUNwQi9YLGVBQWUsR0FBRyxNQUFNO01BQ3hCdVgsd0JBQXdCLENBQUMsQ0FBQztNQUMxQkssdUJBQXVCLENBQUU1VSxVQUFXLENBQUM7TUFDckM5QixRQUFRLENBQUV5WixhQUFjLENBQUM7TUFDekJuQyx3QkFBd0IsQ0FBRW1DLGFBQWMsQ0FBQztNQUN6Q3phLGdCQUFnQixHQUFHLElBQUk7TUFDdkJFLGdCQUFnQixHQUFHLElBQUk7SUFDeEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTd2EsYUFBYUEsQ0FBRXJaLFFBQVEsRUFBRWlWLFFBQVEsRUFBRztNQUM1QyxJQUFJcUUsU0FBUyxHQUFHemMsUUFBUSxDQUFFTSxnQkFBZ0IsQ0FBQ3NDLFdBQVksQ0FBQztNQUN4RCxJQUFJdVksTUFBTSxHQUFHaFksUUFBUSxJQUFJQSxRQUFRLENBQUNnWSxNQUFNLEdBQUdoWSxRQUFRLENBQUNnWSxNQUFNLEdBQUcsSUFBSTtNQUNqRSxJQUFJdUIsZ0JBQWdCLEdBQUd2QixNQUFNLElBQUlBLE1BQU0sQ0FBQ3dCLFNBQVMsR0FBR3hCLE1BQU0sQ0FBQ3dCLFNBQVMsR0FBRyxDQUFDLENBQUM7TUFDekUsSUFBSUMsd0JBQXdCLEdBQUcscUJBQXFCLEtBQUt4RSxRQUFRLENBQUNFLGtCQUFrQjtNQUNwRixJQUFJdUUsS0FBSyxHQUFHNVosTUFBTSxDQUFFRSxRQUFRLElBQUlBLFFBQVEsQ0FBQzBaLEtBQUssR0FBRzFaLFFBQVEsQ0FBQzBaLEtBQUssR0FBRyxFQUFHLENBQUM7TUFFdEUsSUFDQyxDQUFFSixTQUFTLElBQ1IsQ0FBRXRCLE1BQU0sSUFDUnhXLE1BQU0sQ0FBRXdXLE1BQU0sQ0FBQ3ZXLFVBQVUsSUFBSSxDQUFFLENBQUMsS0FBS3dULFFBQVEsQ0FBQ3hULFVBQVUsSUFDeEQzQixNQUFNLENBQUVrWSxNQUFNLENBQUM3QyxrQkFBa0IsSUFBSSxFQUFHLENBQUMsS0FBS0YsUUFBUSxDQUFDRSxrQkFBa0IsSUFDekVyVixNQUFNLENBQUVrWSxNQUFNLENBQUM1QyxTQUFTLElBQUksRUFBRyxDQUFDLEtBQUtILFFBQVEsQ0FBQ0csU0FBUyxJQUN2RDVULE1BQU0sQ0FBRStYLGdCQUFnQixDQUFDSSxlQUFlLElBQUlKLGdCQUFnQixDQUFDSSxlQUFlLENBQUNDLEVBQUUsSUFBSSxDQUFFLENBQUMsS0FBS3BZLE1BQU0sQ0FBRXlULFFBQVEsQ0FBQ2hILGtCQUFtQixDQUFDLElBQ2hJekwsT0FBTyxDQUFFK1csZ0JBQWdCLENBQUNNLGdCQUFpQixDQUFDLEtBQUtKLHdCQUF3QixJQUN6RSxDQUFFelosUUFBUSxDQUFDOFosSUFBSSxJQUNmLENBQUUsaUJBQWlCLENBQUNDLElBQUksQ0FBRUwsS0FBTSxDQUFDLElBQ2pDbFksTUFBTSxDQUFFeEIsUUFBUSxDQUFDZ2EsVUFBVSxJQUFJLENBQUUsQ0FBQyxJQUFJNVgsSUFBSSxDQUFDNE4sR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLElBQ3ZELENBQUU1UyxlQUFlLENBQUNzSCxHQUFHLElBQ3JCLENBQUV0SCxlQUFlLENBQUMwSCxNQUFNLElBQ3hCLENBQUUxSCxlQUFlLENBQUMySCxLQUFLLEVBQ3pCO1FBQ0QsT0FBTyxLQUFLO01BQ2I7TUFDQTNHLGFBQWEsR0FBR2dELE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1FBQzlCSSxVQUFVLEVBQUV3VCxRQUFRLENBQUN4VCxVQUFVO1FBQy9CcVksSUFBSSxFQUFFOVosUUFBUSxDQUFDOFosSUFBSTtRQUNuQkosS0FBSyxFQUFFQSxLQUFLO1FBQ1pNLFVBQVUsRUFBRXhZLE1BQU0sQ0FBRXhCLFFBQVEsQ0FBQ2dhLFVBQVcsQ0FBQztRQUN6Q3pCLFdBQVcsRUFBRWUsU0FBUyxDQUFFdEIsTUFBTztNQUNoQyxDQUFFLENBQUM7TUFDSHZaLGVBQWUsR0FBRyxjQUFjO01BRWhDLE9BQU8yWixvQkFBb0IsQ0FBRTVhLElBQUksQ0FBQ3ljLFlBQVksSUFBSSxFQUFFLEVBQUU7UUFBRWxCLFVBQVUsRUFBRSxJQUFJO1FBQUVDLFNBQVMsRUFBRTtNQUFLLENBQUUsQ0FBQztJQUM5Rjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNrQixxQkFBcUJBLENBQUVqRixRQUFRLEVBQUV4USxLQUFLLEVBQUc7TUFDakQsSUFBSUQsT0FBTztNQUNYLElBQUkyVixhQUFhO01BQ2pCLElBQUlmLGFBQWE7TUFDakIsSUFBSTdVLGtCQUFrQjtNQUV0QjVGLGdCQUFnQixHQUFHO1FBQ2xCOEMsVUFBVSxFQUFFd1QsUUFBUSxDQUFDeFQsVUFBVTtRQUMvQm1JLGFBQWEsRUFBRW5GLEtBQUssQ0FBQ21GLGFBQWE7UUFDbENHLEtBQUssRUFBRXRGLEtBQUssQ0FBQ3NGLEtBQUs7UUFDbEJFLEtBQUssRUFBRXhGLEtBQUssQ0FBQ3dGLEtBQUs7UUFDbEI1RixLQUFLLEVBQUVJLEtBQUssQ0FBQ0osS0FBSztRQUNsQmlTLGFBQWEsRUFBRSxVQUFVLEtBQUssT0FBTzdSLEtBQUssQ0FBQzZSLGFBQWEsR0FBRzdSLEtBQUssQ0FBQzZSLGFBQWEsR0FBRztNQUNsRixDQUFDO01BQ0R6WCxnQkFBZ0IsR0FBRzRGLEtBQUssQ0FBQ2pCLElBQUk7TUFDN0I5RSxvQkFBb0IsSUFBSSxDQUFDO01BQ3pCNkYsa0JBQWtCLEdBQUc3RixvQkFBb0I7TUFDekNELGVBQWUsR0FBRyxnQkFBZ0I7TUFDbEMsSUFBSyxDQUFFdEIsZ0JBQWdCLENBQUN1SCxHQUFHLEVBQUc7UUFDN0J5VSxxQkFBcUIsQ0FBRXJaLE1BQU0sQ0FBRXRDLElBQUksQ0FBQzRjLGFBQWEsSUFBSSxFQUFHLENBQUUsQ0FBQztRQUMzRDtNQUNEO01BQ0F6YSxRQUFRLENBQUVuQyxJQUFJLENBQUM2YyxjQUFjLElBQUksRUFBRyxDQUFDO01BQ3JDRixhQUFhLEdBQUczRSxvQkFBb0IsQ0FBRS9RLEtBQUssQ0FBQ2pCLElBQUssQ0FBQztNQUNsRDJXLGFBQWEsQ0FBQ3ZFLGlCQUFpQixHQUFHZ0Isc0JBQXNCLENBQUMsQ0FBQztNQUMxRHBTLE9BQU8sR0FBR3hJLE1BQU0sQ0FBQ1csTUFBTSxDQUFDZ0ksSUFBSSxDQUFFO1FBQzdCRCxHQUFHLEVBQUV2SCxnQkFBZ0IsQ0FBQ3VILEdBQUc7UUFDekJFLE1BQU0sRUFBRSxNQUFNO1FBQ2RDLFFBQVEsRUFBRSxNQUFNO1FBQ2hCekUsSUFBSSxFQUFFO1VBQ0wwRSxNQUFNLEVBQUUzSCxnQkFBZ0IsQ0FBQzJILE1BQU07VUFDL0JDLEtBQUssRUFBRTVILGdCQUFnQixDQUFDNEgsS0FBSztVQUM3QnRELFVBQVUsRUFBRXdULFFBQVEsQ0FBQ3hULFVBQVU7VUFDL0J1RCxNQUFNLEVBQUU3SCxnQkFBZ0IsQ0FBQzZILE1BQU0sSUFBSSxVQUFVO1VBQzdDaVEsUUFBUSxFQUFFcUYsSUFBSSxDQUFDQyxTQUFTLENBQUV0RixRQUFTO1FBQ3BDO01BQ0QsQ0FBRSxDQUFDLENBQUN6UCxJQUFJLENBQUUsVUFBV3hGLFFBQVEsRUFBRztRQUMvQixJQUFLdUUsa0JBQWtCLEtBQUs3RixvQkFBb0IsSUFBSVQsY0FBYyxLQUFLdUcsT0FBTyxFQUFHO1VBQ2hGO1FBQ0Q7UUFDQSxJQUFLLENBQUV4RSxRQUFRLElBQUksQ0FBRUEsUUFBUSxDQUFDRyxPQUFPLElBQUksQ0FBRWtaLGFBQWEsQ0FBRXJaLFFBQVEsQ0FBQ0ksSUFBSSxFQUFFNlUsUUFBUyxDQUFDLEVBQUc7VUFDckZtRSxhQUFhLEdBQUd0WixNQUFNLENBQUV0QyxJQUFJLENBQUM0YyxhQUFhLElBQUksRUFBRyxDQUFDO1VBQ2xEakIscUJBQXFCLENBQUVDLGFBQWMsQ0FBQztRQUN2QztNQUNELENBQUUsQ0FBQyxDQUFDelQsSUFBSSxDQUFFLFVBQVdDLGNBQWMsRUFBRTRVLGNBQWMsRUFBRztRQUNyRCxJQUFLalcsa0JBQWtCLEtBQUs3RixvQkFBb0IsSUFBSSxPQUFPLEtBQUs4YixjQUFjLElBQUl2YyxjQUFjLEtBQUt1RyxPQUFPLEVBQUc7VUFDOUc7UUFDRDtRQUNBNFUsYUFBYSxHQUFHbEMsaUJBQWlCLENBQUV0UixjQUFjLEVBQUVwSSxJQUFJLENBQUM0YyxhQUFhLElBQUksRUFBRyxDQUFDLENBQUN4YSxPQUFPO1FBQ3JGdVoscUJBQXFCLENBQUVDLGFBQWMsQ0FBQztNQUN2QyxDQUFFLENBQUMsQ0FBQ3RULE1BQU0sQ0FBRSxZQUFZO1FBQ3ZCNFAsa0JBQWtCLENBQUV5RSxhQUFjLENBQUM7UUFDbkMsSUFBS2xjLGNBQWMsS0FBS3VHLE9BQU8sRUFBRztVQUNqQ3ZHLGNBQWMsR0FBRyxJQUFJO1FBQ3RCO01BQ0QsQ0FBRSxDQUFDO01BQ0hBLGNBQWMsR0FBR3VHLE9BQU87SUFDekI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTaVcsd0JBQXdCQSxDQUFFeEYsUUFBUSxFQUFFeFEsS0FBSyxFQUFHO01BQ3BELElBQUlpVyxTQUFTLEdBQUc3WixLQUFLLENBQUNDLE9BQU8sQ0FBRW1VLFFBQVEsSUFBSUEsUUFBUSxDQUFDSSxjQUFlLENBQUMsSUFBSUosUUFBUSxDQUFDSSxjQUFjLENBQUN0VCxNQUFNO01BQ3RHLElBQUk0WSxhQUFhLEdBQUc5WixLQUFLLENBQUNDLE9BQU8sQ0FBRW1VLFFBQVEsSUFBSUEsUUFBUSxDQUFDTSxrQkFBbUIsQ0FBQyxJQUFJTixRQUFRLENBQUNNLGtCQUFrQixDQUFDeFQsTUFBTTtNQUNsSCxJQUFJb1Qsa0JBQWtCLEdBQUdyVixNQUFNLENBQUVtVixRQUFRLElBQUlBLFFBQVEsQ0FBQ0Usa0JBQWtCLElBQUksRUFBRyxDQUFDO01BQ2hGLElBQUlDLFNBQVMsR0FBR3RWLE1BQU0sQ0FBRW1WLFFBQVEsSUFBSUEsUUFBUSxDQUFDRyxTQUFTLElBQUksRUFBRyxDQUFDO01BQzlELElBQUl3RixnQkFBZ0IsR0FBRyxNQUFNLEtBQUt6RixrQkFBa0IsSUFBSSxPQUFPLEtBQUtDLFNBQVM7TUFDN0UsSUFBSXpHLGlCQUFpQixHQUFHLHFCQUFxQixLQUFLd0csa0JBQWtCLElBQUksaUJBQWlCLEtBQUtDLFNBQVM7TUFFdkcsSUFDQyxNQUFNLEtBQUszVyxlQUFlLElBQ3ZCVCxPQUFPLElBQ1BDLGNBQWMsSUFDZCxDQUFFZ1gsUUFBUSxJQUNWelQsTUFBTSxDQUFFeVQsUUFBUSxDQUFDQyxjQUFlLENBQUMsS0FBSzFULE1BQU0sQ0FBRXJFLGdCQUFnQixDQUFDK1gsY0FBZSxDQUFDLElBQy9FLENBQUUxVCxNQUFNLENBQUV5VCxRQUFRLENBQUN4VCxVQUFXLENBQUMsSUFDN0IsQ0FBRW1aLGdCQUFnQixJQUFJLENBQUVqTSxpQkFBbUIsSUFDN0MsQ0FBRW5OLE1BQU0sQ0FBRXlULFFBQVEsQ0FBQ2hILGtCQUFtQixDQUFDLElBQ3ZDLENBQUUsQ0FBRSxRQUFRLEVBQUUsWUFBWSxDQUFFLENBQUNqTSxRQUFRLENBQUVsQyxNQUFNLENBQUVtVixRQUFRLENBQUNoVCxnQkFBZ0IsSUFBSSxFQUFHLENBQUUsQ0FBQyxJQUNsRixDQUFFVCxNQUFNLENBQUV5VCxRQUFRLENBQUN0VCxpQkFBa0IsQ0FBQyxJQUN0QyxDQUFFN0IsTUFBTSxDQUFFbVYsUUFBUSxDQUFDclQsb0JBQW9CLElBQUksRUFBRyxDQUFDLElBQy9DWSxPQUFPLENBQUVrWSxTQUFVLENBQUMsS0FBS2xZLE9BQU8sQ0FBRW1ZLGFBQWMsQ0FBQyxJQUNqRCxDQUFFbFcsS0FBSyxJQUNQLENBQUVBLEtBQUssQ0FBQ2pCLElBQUksSUFDWixDQUFFaUIsS0FBSyxDQUFDakIsSUFBSSxDQUFDWSxXQUFXLEVBQzFCO1FBQ0QsT0FBTyxLQUFLO01BQ2I7TUFDQThWLHFCQUFxQixDQUFFOVksTUFBTSxDQUFDQyxNQUFNLENBQUU0VCxRQUFTLENBQUMsRUFBRXhRLEtBQU0sQ0FBQztNQUV6RCxPQUFPLElBQUk7SUFDWjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNvVyxxQkFBcUJBLENBQUVDLE1BQU0sRUFBRXJaLFVBQVUsRUFBRztNQUNwRCxJQUFJc1osUUFBUSxHQUFHRCxNQUFNLElBQUlBLE1BQU0sQ0FBQ0Usa0JBQWtCLEdBQUdGLE1BQU0sQ0FBQ0Usa0JBQWtCLEdBQUcsSUFBSTtNQUNyRixJQUFJQyxZQUFZLEdBQUdILE1BQU0sSUFBSUEsTUFBTSxDQUFDRyxZQUFZLEdBQUdILE1BQU0sQ0FBQ0csWUFBWSxHQUFHLElBQUk7TUFFN0UsT0FBT3pZLE9BQU8sQ0FDYnNZLE1BQU0sSUFDSHRaLE1BQU0sQ0FBRXNaLE1BQU0sQ0FBQ3JaLFVBQVUsSUFBSSxDQUFFLENBQUMsS0FBS0EsVUFBVSxJQUMvQ3NaLFFBQVEsSUFDUnZaLE1BQU0sQ0FBRXVaLFFBQVEsQ0FBQ3RaLFVBQVUsSUFBSSxDQUFFLENBQUMsS0FBS0EsVUFBVSxJQUNqRDNCLE1BQU0sQ0FBRWliLFFBQVEsQ0FBQ0csaUJBQWlCLElBQUksRUFBRyxDQUFDLElBQzFDRCxZQUFZLElBQ1osSUFBSSxLQUFLQSxZQUFZLENBQUNFLFFBQVEsSUFDOUIzWixNQUFNLENBQUV5WixZQUFZLENBQUN4WixVQUFVLElBQUksQ0FBRSxDQUFDLEtBQUtBLFVBQy9DLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTMlosMEJBQTBCQSxDQUFFeFYsY0FBYyxFQUFFNFUsY0FBYyxFQUFFOWEsS0FBSyxFQUFHO01BQzVFLElBQUltRyxNQUFNLEdBQUdyRSxNQUFNLENBQUVvRSxjQUFjLElBQUlBLGNBQWMsQ0FBQ0MsTUFBTSxHQUFHRCxjQUFjLENBQUNDLE1BQU0sR0FBRyxDQUFFLENBQUM7TUFFMUYsT0FBTyxPQUFPLEtBQUsyVSxjQUFjLEtBQ2hDLENBQUUzVSxNQUFNLElBQ0wsR0FBRyxJQUFJQSxNQUFNLElBQ2IsOENBQThDLEtBQUtuRyxLQUFLLENBQUM0WCxJQUFJLENBQ2hFO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUytELHNCQUFzQkEsQ0FBRTVaLFVBQVUsRUFBRztNQUM3QyxJQUFJNlosZUFBZSxHQUFHM2MsZ0JBQWdCO01BRXRDcVgsd0JBQXdCLENBQUMsQ0FBQztNQUMxQkssdUJBQXVCLENBQUU1VSxVQUFXLENBQUM7TUFDckN6RixNQUFNLENBQUN1VixxQkFBcUIsQ0FBRSxZQUFZO1FBQ3pDLElBQUsrSixlQUFlLEtBQUszYyxnQkFBZ0IsRUFBRztVQUMzQztRQUNEO1FBQ0FxWCx3QkFBd0IsQ0FBQyxDQUFDO1FBQzFCaGEsTUFBTSxDQUFDdVYscUJBQXFCLENBQUUsWUFBWTtVQUN6QyxJQUFLK0osZUFBZSxLQUFLM2MsZ0JBQWdCLEVBQUc7WUFDM0M7VUFDRDtVQUNBcVgsd0JBQXdCLENBQUMsQ0FBQztVQUMxQkssdUJBQXVCLENBQUU1VSxVQUFXLENBQUM7VUFDckM5QyxnQkFBZ0IsR0FBRyxJQUFJO1VBQ3ZCRSxnQkFBZ0IsR0FBRyxJQUFJO1FBQ3hCLENBQUUsQ0FBQztNQUNKLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTMGMscUJBQXFCQSxDQUFBLEVBQUc7TUFDaEMsSUFBSUMsVUFBVSxHQUFHaGQsa0JBQWtCLElBQUksQ0FBQyxDQUFDO01BQ3pDLElBQUlpRCxVQUFVLEdBQUdsRCxvQkFBb0IsR0FBR2lELE1BQU0sQ0FBRWpELG9CQUFvQixDQUFDa0QsVUFBVSxJQUFJLENBQUUsQ0FBQyxHQUFHLENBQUM7TUFFMUYrVSxrQkFBa0IsQ0FBQyxDQUFDO01BQ3BCcFksYUFBYSxHQUFHLElBQUk7TUFDcEJHLG9CQUFvQixHQUFHLElBQUk7TUFDM0JDLGtCQUFrQixHQUFHLElBQUk7TUFDekJ4QixLQUFLLENBQUNzSixTQUFTLENBQUNpSSxNQUFNLENBQUUsbUNBQW9DLENBQUM7TUFDN0Q5UCxlQUFlLEdBQUcsTUFBTTtNQUN4QjRjLHNCQUFzQixDQUFFNVosVUFBVyxDQUFDO01BQ3BDOUIsUUFBUSxDQUFFNmIsVUFBVSxDQUFDNWIsT0FBTyxJQUFJLEVBQUcsQ0FBQztNQUNwQyxJQUFLNGIsVUFBVSxDQUFDNWIsT0FBTyxJQUFJM0MsU0FBUyxJQUFJLFVBQVUsS0FBSyxPQUFPQSxTQUFTLENBQUNnUyxrQkFBa0IsRUFBRztRQUM1RmhTLFNBQVMsQ0FBQ2dTLGtCQUFrQixDQUFFdU0sVUFBVSxDQUFDNWIsT0FBTyxFQUFFNGIsVUFBVSxDQUFDblYsSUFBSSxJQUFJLFNBQVMsRUFBRTdFLE1BQU0sQ0FBRWdhLFVBQVUsQ0FBQ0MsS0FBTSxDQUFDLElBQUksSUFBSyxDQUFDO01BQ3JIO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLG9CQUFvQkEsQ0FBQSxFQUFHO01BQy9CamQsZUFBZSxHQUFHLGVBQWU7TUFDakMyWixvQkFBb0IsQ0FBRTVhLElBQUksQ0FBQ21lLGNBQWMsSUFBSSxFQUFFLEVBQUU7UUFBRTFDLGlCQUFpQixFQUFFO01BQUssQ0FBRSxDQUFDO01BQzlFdFosUUFBUSxDQUFFbkMsSUFBSSxDQUFDbWUsY0FBYyxJQUFJLEVBQUcsQ0FBQztNQUNyQzFFLHdCQUF3QixDQUFFelosSUFBSSxDQUFDbWUsY0FBYyxJQUFJLEVBQUcsQ0FBQztJQUN0RDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUy9ELG1CQUFtQkEsQ0FBQSxFQUFHO01BQzlCLElBQUlnRSxjQUFjO01BQ2xCLElBQUlyWCxrQkFBa0I7TUFFdEIsSUFBSyxDQUFFaEcsb0JBQW9CLElBQUksaUJBQWlCLEtBQUtFLGVBQWUsRUFBRztRQUN0RTtNQUNEO01BQ0FBLGVBQWUsR0FBRyxpQkFBaUI7TUFDbkN6QixLQUFLLENBQUNzSixTQUFTLENBQUNzRixHQUFHLENBQUUsbUNBQW9DLENBQUM7TUFDMUR3TSxvQkFBb0IsQ0FBRTVhLElBQUksQ0FBQ3FlLFVBQVUsSUFBSSxFQUFFLEVBQUU7UUFBRTNDLE9BQU8sRUFBRTtNQUFLLENBQUUsQ0FBQztNQUNoRTNVLGtCQUFrQixHQUFHN0Ysb0JBQW9CO01BQ3pDLElBQUssQ0FBRXpCLFNBQVMsSUFBSSxVQUFVLEtBQUssT0FBT0EsU0FBUyxDQUFDMmEsbUJBQW1CLEVBQUc7UUFDekU4RCxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3RCO01BQ0Q7TUFDQSxJQUFJO1FBQ0hFLGNBQWMsR0FBRzNlLFNBQVMsQ0FBQzJhLG1CQUFtQixDQUFFclosb0JBQXFCLENBQUM7TUFDdkUsQ0FBQyxDQUFDLE9BQVF1ZCxhQUFhLEVBQUc7UUFDekJGLGNBQWMsR0FBRzVmLE1BQU0sQ0FBQ1csTUFBTSxDQUFDb2YsUUFBUSxDQUFDLENBQUMsQ0FBQ0MsTUFBTSxDQUFFRixhQUFjLENBQUMsQ0FBQ0csT0FBTyxDQUFDLENBQUM7TUFDNUU7TUFDQWpnQixNQUFNLENBQUNXLE1BQU0sQ0FBQ3VmLElBQUksQ0FBRU4sY0FBZSxDQUFDLENBQUNwVyxJQUFJLENBQUUsWUFBWTtRQUN0RCxJQUFLdkcsWUFBWSxJQUFJc0Ysa0JBQWtCLEtBQUs3RixvQkFBb0IsSUFBSSxDQUFFSCxvQkFBb0IsRUFBRztVQUM1RjtRQUNEO1FBQ0FnZCxxQkFBcUIsQ0FBQyxDQUFDO01BQ3hCLENBQUUsQ0FBQyxDQUFDNVYsSUFBSSxDQUFFLFlBQVk7UUFDckIsSUFBSzFHLFlBQVksSUFBSXNGLGtCQUFrQixLQUFLN0Ysb0JBQW9CLElBQUksQ0FBRUgsb0JBQW9CLEVBQUc7VUFDNUY7UUFDRDtRQUNBbWQsb0JBQW9CLENBQUMsQ0FBQztNQUN2QixDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTUyxzQkFBc0JBLENBQUUvQyxhQUFhLEVBQUc7TUFDaEQsSUFBSTNYLFVBQVUsR0FBRzlDLGdCQUFnQixHQUFHQSxnQkFBZ0IsQ0FBQzhDLFVBQVUsR0FBRyxDQUFDO01BRW5FckQsYUFBYSxHQUFHLElBQUk7TUFDcEJvWSxrQkFBa0IsQ0FBQyxDQUFDO01BQ3BCeFosS0FBSyxDQUFDc0osU0FBUyxDQUFDaUksTUFBTSxDQUFFLG1DQUFvQyxDQUFDO01BQzdEOVAsZUFBZSxHQUFHLE1BQU07TUFDeEJ1WCx3QkFBd0IsQ0FBQyxDQUFDO01BQzFCSyx1QkFBdUIsQ0FBRTVVLFVBQVcsQ0FBQztNQUNyQzlCLFFBQVEsQ0FBRXlaLGFBQWMsQ0FBQztNQUN6Qm5DLHdCQUF3QixDQUFFbUMsYUFBYyxDQUFDO01BQ3pDemEsZ0JBQWdCLEdBQUcsSUFBSTtNQUN2QkUsZ0JBQWdCLEdBQUcsSUFBSTtJQUN4Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN1ZCx1QkFBdUJBLENBQUUzYSxVQUFVLEVBQUUyWCxhQUFhLEVBQUc7TUFDN0RoYixhQUFhLEdBQUdBLGFBQWEsR0FBR2dELE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1FBQzlDSSxVQUFVLEVBQUVyRCxhQUFhLENBQUNxRCxVQUFVO1FBQ3BDcVksSUFBSSxFQUFFLElBQUk7UUFDVkosS0FBSyxFQUFFLEVBQUU7UUFDVE0sVUFBVSxFQUFFLENBQUM7UUFDYnpCLFdBQVcsRUFBRW5hLGFBQWEsQ0FBQ21hO01BQzVCLENBQUUsQ0FBQyxHQUFHLElBQUk7TUFDVmhhLG9CQUFvQixHQUFHO1FBQUVrRCxVQUFVLEVBQUVBLFVBQVU7UUFBRTRhLE9BQU8sRUFBRSxLQUFLO1FBQUVDLGlCQUFpQixFQUFFO01BQUssQ0FBQztNQUMxRjlkLGtCQUFrQixHQUFHO1FBQUVvQixPQUFPLEVBQUV3WixhQUFhO1FBQUUvUyxJQUFJLEVBQUUsT0FBTztRQUFFb1YsS0FBSyxFQUFFO01BQU0sQ0FBQztNQUM1RTdELG1CQUFtQixDQUFDLENBQUM7SUFDdEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNELGFBQWFBLENBQUEsRUFBRztNQUN4QixJQUFJNEUsWUFBWTtNQUNoQixJQUFJOWEsVUFBVTtNQUNkLElBQUk4QyxrQkFBa0I7TUFDdEIsSUFBSUMsT0FBTztNQUVYLElBQ0MsY0FBYyxLQUFLL0YsZUFBZSxJQUMvQkosYUFBYSxJQUNiRSxvQkFBb0IsSUFDcEIsQ0FBRUgsYUFBYSxJQUNmLENBQUVBLGFBQWEsQ0FBQzBiLElBQUksSUFDcEIsQ0FBRSxpQkFBaUIsQ0FBQ0MsSUFBSSxDQUFFamEsTUFBTSxDQUFFMUIsYUFBYSxDQUFDc2IsS0FBSyxJQUFJLEVBQUcsQ0FBRSxDQUFDLElBQy9ELENBQUV0YyxlQUFlLENBQUNzSCxHQUFHLElBQ3JCLENBQUV0SCxlQUFlLENBQUMwSCxNQUFNLElBQ3hCLENBQUUxSCxlQUFlLENBQUMySCxLQUFLLEVBQ3pCO1FBQ0Q7TUFDRDtNQUNBd1gsWUFBWSxHQUFHbmUsYUFBYTtNQUM1QnFELFVBQVUsR0FBR3JELGFBQWEsQ0FBQ3FELFVBQVU7TUFDckM4QyxrQkFBa0IsR0FBRzdGLG9CQUFvQjtNQUN6Q0QsZUFBZSxHQUFHLGVBQWU7TUFDakN6QixLQUFLLENBQUNzSixTQUFTLENBQUNzRixHQUFHLENBQUUsbUNBQW9DLENBQUM7TUFDMUR3TSxvQkFBb0IsQ0FBRTVhLElBQUksQ0FBQ2dmLFFBQVEsSUFBSSxFQUFFLEVBQUU7UUFBRXRELE9BQU8sRUFBRTtNQUFLLENBQUUsQ0FBQztNQUM5RDVhLHVCQUF1QixHQUFHc1ksc0JBQXNCLENBQUMsQ0FBQztNQUNsRHBTLE9BQU8sR0FBR3hJLE1BQU0sQ0FBQ1csTUFBTSxDQUFDZ0ksSUFBSSxDQUFFO1FBQzdCRCxHQUFHLEVBQUV0SCxlQUFlLENBQUNzSCxHQUFHO1FBQ3hCRSxNQUFNLEVBQUUsTUFBTTtRQUNkQyxRQUFRLEVBQUUsTUFBTTtRQUNoQnpFLElBQUksRUFBRTtVQUNMMEUsTUFBTSxFQUFFMUgsZUFBZSxDQUFDMEgsTUFBTTtVQUM5QkMsS0FBSyxFQUFFM0gsZUFBZSxDQUFDMkgsS0FBSztVQUM1QnRELFVBQVUsRUFBRUEsVUFBVTtVQUN0QnVELE1BQU0sRUFBRTVILGVBQWUsQ0FBQzRILE1BQU0sSUFBSSxVQUFVO1VBQzVDeVgsbUJBQW1CLEVBQUVDLDhCQUE4QixDQUFDLENBQUM7VUFDckQ1QyxJQUFJLEVBQUVRLElBQUksQ0FBQ0MsU0FBUyxDQUFFZ0MsWUFBWSxDQUFDekMsSUFBSyxDQUFDO1VBQ3pDSixLQUFLLEVBQUU2QyxZQUFZLENBQUM3QztRQUNyQjtNQUNELENBQUUsQ0FBQyxDQUFDbFUsSUFBSSxDQUFFLFVBQVd4RixRQUFRLEVBQUc7UUFDL0IsSUFBSThhLE1BQU0sR0FBRzlhLFFBQVEsSUFBSUEsUUFBUSxDQUFDRyxPQUFPLEdBQUdILFFBQVEsQ0FBQ0ksSUFBSSxHQUFHLElBQUk7UUFFaEUsSUFBS25CLFlBQVksSUFBSXNGLGtCQUFrQixLQUFLN0Ysb0JBQW9CLElBQUlMLGFBQWEsS0FBS21HLE9BQU8sRUFBRztVQUMvRjtRQUNEO1FBQ0FwRyxhQUFhLEdBQUdnRCxNQUFNLENBQUNDLE1BQU0sQ0FBRTtVQUM5QkksVUFBVSxFQUFFOGEsWUFBWSxDQUFDOWEsVUFBVTtVQUNuQ3FZLElBQUksRUFBRSxJQUFJO1VBQ1ZKLEtBQUssRUFBRSxFQUFFO1VBQ1RNLFVBQVUsRUFBRSxDQUFDO1VBQ2J6QixXQUFXLEVBQUVnRSxZQUFZLENBQUNoRTtRQUMzQixDQUFFLENBQUM7UUFDSCxJQUFLLENBQUVzQyxxQkFBcUIsQ0FBRUMsTUFBTSxFQUFFclosVUFBVyxDQUFDLEVBQUc7VUFDcEQyYSx1QkFBdUIsQ0FBRTNhLFVBQVUsRUFBRWpFLElBQUksQ0FBQ21mLFlBQVksSUFBSSxFQUFHLENBQUM7VUFDOUQ7UUFDRDtRQUNBcGUsb0JBQW9CLEdBQUd1YyxNQUFNO1FBQzdCdGMsa0JBQWtCLEdBQUc7VUFBRW9CLE9BQU8sRUFBRXBDLElBQUksQ0FBQ29mLE9BQU8sSUFBSSxFQUFFO1VBQUV2VyxJQUFJLEVBQUUsU0FBUztVQUFFb1YsS0FBSyxFQUFFO1FBQUssQ0FBQztRQUNsRjdELG1CQUFtQixDQUFDLENBQUM7TUFDdEIsQ0FBRSxDQUFDLENBQUNqUyxJQUFJLENBQUUsVUFBV0MsY0FBYyxFQUFFNFUsY0FBYyxFQUFHO1FBQ3JELElBQUk5YSxLQUFLO1FBRVQsSUFBS1QsWUFBWSxJQUFJc0Ysa0JBQWtCLEtBQUs3RixvQkFBb0IsSUFBSSxPQUFPLEtBQUs4YixjQUFjLElBQUluYyxhQUFhLEtBQUttRyxPQUFPLEVBQUc7VUFDN0g7UUFDRDtRQUNBOUUsS0FBSyxHQUFHd1gsaUJBQWlCLENBQUV0UixjQUFjLEVBQUVwSSxJQUFJLENBQUNtZixZQUFZLElBQUksRUFBRyxDQUFDO1FBQ3BFLElBQUt2QiwwQkFBMEIsQ0FBRXhWLGNBQWMsRUFBRTRVLGNBQWMsRUFBRTlhLEtBQU0sQ0FBQyxFQUFHO1VBQzFFMGMsdUJBQXVCLENBQUUzYSxVQUFVLEVBQUUvQixLQUFLLENBQUNFLE9BQVEsQ0FBQztVQUNwRDtRQUNEO1FBQ0F1YyxzQkFBc0IsQ0FBRXpjLEtBQUssQ0FBQ0UsT0FBUSxDQUFDO01BQ3hDLENBQUUsQ0FBQyxDQUFDa0csTUFBTSxDQUFFLFlBQVk7UUFDdkJpUSxzQkFBc0IsQ0FBRXpYLHVCQUF3QixDQUFDO1FBQ2pEQSx1QkFBdUIsR0FBRyxJQUFJO1FBQzlCLElBQUtELGFBQWEsS0FBS21HLE9BQU8sRUFBRztVQUNoQ25HLGFBQWEsR0FBRyxJQUFJO1FBQ3JCO01BQ0QsQ0FBRSxDQUFDO01BQ0hBLGFBQWEsR0FBR21HLE9BQU87SUFDeEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNrWSw4QkFBOEJBLENBQUEsRUFBRztNQUN6QyxJQUFJRyxZQUFZO01BRWhCLElBQUssV0FBVyxLQUFLLE9BQU81Z0IsUUFBUSxJQUFJLFVBQVUsS0FBSyxPQUFPQSxRQUFRLENBQUMrRyxhQUFhLEVBQUc7UUFDdEYsT0FBTyxDQUFDO01BQ1Q7TUFDQTZaLFlBQVksR0FBRzVnQixRQUFRLENBQUMrRyxhQUFhLENBQUUsaUNBQWtDLENBQUM7TUFFMUUsT0FBTzZaLFlBQVksSUFBSUEsWUFBWSxDQUFDQyxPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUM7SUFDcEQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsTUFBTUEsQ0FBRTdXLEtBQUssRUFBRztNQUN4QixJQUFJekIsS0FBSyxHQUFHekcsT0FBTztNQUNuQixJQUFJZ2YsY0FBYztNQUNsQixJQUFJL0gsUUFBUTtNQUNaLElBQUlnSSx1QkFBdUI7TUFDM0IsSUFBSyxDQUFFeFksS0FBSyxFQUFHO1FBQUU7TUFBUTtNQUN6QndZLHVCQUF1QixHQUFHek8seUJBQXlCLENBQUUvSixLQUFLLEVBQUVBLEtBQUssQ0FBQ3lDLFNBQVUsQ0FBQztNQUM3RWlILGtCQUFrQixDQUFFMUosS0FBTSxDQUFDO01BQzNCdVksY0FBYyxHQUFHalAsc0JBQXNCLENBQUV0SixLQUFNLENBQUM7TUFDaERBLEtBQUssQ0FBQ3lDLFNBQVMsR0FBRzhWLGNBQWM7TUFDaEMsSUFBSyxDQUFFQSxjQUFjLEVBQUc7UUFBRXZZLEtBQUssQ0FBQ29HLFdBQVcsR0FBRyxJQUFJO01BQUU7TUFDcEQ2RyxZQUFZLENBQUVqTixLQUFNLENBQUM7TUFBRWtOLE9BQU8sQ0FBRWxOLEtBQU0sQ0FBQztNQUFFekcsT0FBTyxHQUFHLElBQUk7TUFDdkRpWCxRQUFRLEdBQUdELGFBQWEsQ0FBRXZRLEtBQU0sQ0FBQztNQUNqQyxJQUFLQSxLQUFLLENBQUN5RSxNQUFNLEVBQUc7UUFBRXpFLEtBQUssQ0FBQ3lFLE1BQU0sQ0FBQ1csVUFBVSxHQUFHcEYsS0FBSyxDQUFDbUYsYUFBYTtNQUFFO01BQ3JFNU4sTUFBTSxDQUFDaWEsUUFBUSxDQUFFeFIsS0FBSyxDQUFDc0YsS0FBSyxFQUFFdEYsS0FBSyxDQUFDd0YsS0FBTSxDQUFDO01BQzNDLElBQUtnTCxRQUFRLEVBQUc7UUFDZmlGLHFCQUFxQixDQUFFakYsUUFBUSxFQUFFeFEsS0FBTSxDQUFDO01BQ3pDLENBQUMsTUFBTTtRQUNOLElBQUt3WSx1QkFBdUIsRUFBRztVQUM5QnJPLHdCQUF3QixDQUFFcU8sdUJBQXdCLENBQUM7UUFDcEQ7UUFDQSxJQUFLeFksS0FBSyxDQUFDSixLQUFLLElBQUlJLEtBQUssQ0FBQ0osS0FBSyxDQUFDRCxXQUFXLEVBQUc7VUFBRUssS0FBSyxDQUFDSixLQUFLLENBQUNBLEtBQUssQ0FBQyxDQUFDO1FBQUU7TUFDdEU7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTcVUsTUFBTUEsQ0FBRXdFLGNBQWMsRUFBRztNQUNqQyxJQUFJelksS0FBSyxHQUFHekcsT0FBTztNQUNuQixJQUFLLENBQUV5RyxLQUFLLEVBQUc7UUFBRTtNQUFRO01BQ3pCaU4sWUFBWSxDQUFFak4sS0FBTSxDQUFDO01BQUVrTixPQUFPLENBQUVsTixLQUFNLENBQUM7TUFBRXpHLE9BQU8sR0FBRyxJQUFJO01BQ3ZELElBQUtrZixjQUFjLEVBQUc7UUFDckIsSUFBS3pZLEtBQUssQ0FBQ3lFLE1BQU0sRUFBRztVQUFFekUsS0FBSyxDQUFDeUUsTUFBTSxDQUFDVyxVQUFVLEdBQUdwRixLQUFLLENBQUNtRixhQUFhO1FBQUU7UUFDckU1TixNQUFNLENBQUNpYSxRQUFRLENBQUV4UixLQUFLLENBQUNzRixLQUFLLEVBQUV0RixLQUFLLENBQUN3RixLQUFNLENBQUM7TUFDNUM7TUFDQSxJQUFLeEYsS0FBSyxDQUFDSixLQUFLLElBQUlJLEtBQUssQ0FBQ0osS0FBSyxDQUFDRCxXQUFXLEVBQUc7UUFBRUssS0FBSyxDQUFDSixLQUFLLENBQUNBLEtBQUssQ0FBQyxDQUFDO01BQUU7TUFDckUxRSxRQUFRLENBQUVuQyxJQUFJLENBQUMyZixTQUFTLElBQUksRUFBRyxDQUFDO0lBQ2pDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMvUSxxQkFBcUJBLENBQUVsRyxLQUFLLEVBQUc7TUFDdkMsSUFBSStXLHVCQUF1QixHQUFHLEVBQUU7TUFFaEMsSUFBS2pmLE9BQU8sRUFBRztRQUNkaWYsdUJBQXVCLEdBQUd6Tyx5QkFBeUIsQ0FBRXhRLE9BQU8sRUFBRUEsT0FBTyxDQUFDa0osU0FBVSxDQUFDO1FBQ2pGaUgsa0JBQWtCLENBQUVuUSxPQUFRLENBQUM7TUFDOUI7TUFDQWhDLE1BQU0sQ0FBQ29oQixVQUFVLENBQUUsWUFBWTtRQUM5QixJQUFLcGYsT0FBTyxFQUFHO1VBQ2QwYSxNQUFNLENBQUUsSUFBSyxDQUFDO1VBQ2QsSUFBS3VFLHVCQUF1QixFQUFHO1lBQzlCck8sd0JBQXdCLENBQUVxTyx1QkFBd0IsQ0FBQztVQUNwRDtRQUNEO01BQ0QsQ0FBQyxFQUFFLENBQUUsQ0FBQztJQUNQO0lBQ0E7SUFDQSxTQUFTNVEsZUFBZUEsQ0FBQSxFQUFHO01BQUVxTSxNQUFNLENBQUUsSUFBSyxDQUFDO0lBQUU7SUFDN0M7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzJFLGlCQUFpQkEsQ0FBRW5YLEtBQUssRUFBRztNQUNuQyxJQUFJb1gsUUFBUTtNQUNaLElBQUkxUCxLQUFLO01BQ1QsSUFBSWtKLElBQUk7TUFFUixJQUFLLEtBQUssS0FBSzVRLEtBQUssQ0FBQ3FYLEdBQUcsSUFBSSxDQUFFcGYsV0FBVyxFQUFHO1FBQzNDO01BQ0Q7TUFDQW1mLFFBQVEsR0FBR3pjLEtBQUssQ0FBQzJILFNBQVMsQ0FBQ1AsTUFBTSxDQUFDUSxJQUFJLENBQ3JDdEssV0FBVyxDQUFDOEksZ0JBQWdCLENBQUUsMElBQTJJLENBQUMsRUFDMUssVUFBV3VXLE9BQU8sRUFBRztRQUFFLE9BQU8sQ0FBRUEsT0FBTyxDQUFDdmEsTUFBTSxJQUFJLElBQUksS0FBS3VhLE9BQU8sQ0FBQ0MsWUFBWTtNQUFFLENBQ2xGLENBQUM7TUFDRCxJQUFLLENBQUVILFFBQVEsQ0FBQ3ZiLE1BQU0sRUFBRztRQUN4QjtNQUNEO01BQ0E2TCxLQUFLLEdBQUcwUCxRQUFRLENBQUMsQ0FBQyxDQUFDO01BQ25CeEcsSUFBSSxHQUFHd0csUUFBUSxDQUFFQSxRQUFRLENBQUN2YixNQUFNLEdBQUcsQ0FBQyxDQUFFO01BQ3RDLElBQUttRSxLQUFLLENBQUN3WCxRQUFRLElBQUl6aEIsUUFBUSxDQUFDbU8sYUFBYSxLQUFLd0QsS0FBSyxFQUFHO1FBQ3pEMUgsS0FBSyxDQUFDeVgsY0FBYyxDQUFDLENBQUM7UUFDdEI3RyxJQUFJLENBQUN6UyxLQUFLLENBQUMsQ0FBQztNQUNiLENBQUMsTUFBTSxJQUFLLENBQUU2QixLQUFLLENBQUN3WCxRQUFRLElBQUl6aEIsUUFBUSxDQUFDbU8sYUFBYSxLQUFLME0sSUFBSSxFQUFHO1FBQ2pFNVEsS0FBSyxDQUFDeVgsY0FBYyxDQUFDLENBQUM7UUFDdEIvUCxLQUFLLENBQUN2SixLQUFLLENBQUMsQ0FBQztNQUNkLENBQUMsTUFBTSxJQUFLLENBQUVsRyxXQUFXLENBQUNvSSxRQUFRLENBQUV0SyxRQUFRLENBQUNtTyxhQUFjLENBQUMsRUFBRztRQUM5RGxFLEtBQUssQ0FBQ3lYLGNBQWMsQ0FBQyxDQUFDO1FBQ3RCL1AsS0FBSyxDQUFDdkosS0FBSyxDQUFDLENBQUM7TUFDZDtJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN1WixVQUFVQSxDQUFFMVgsS0FBSyxFQUFHO01BQzVCLElBQUssUUFBUSxLQUFLQSxLQUFLLENBQUNxWCxHQUFHLEVBQUc7UUFDN0IsSUFBS3ZmLE9BQU8sRUFBRztVQUFFa0ksS0FBSyxDQUFDeVgsY0FBYyxDQUFDLENBQUM7VUFBRWpGLE1BQU0sQ0FBRSxJQUFLLENBQUM7UUFBRSxDQUFDLE1BQU0sSUFBS3phLGNBQWMsSUFBSUMsb0JBQW9CLElBQUlDLFdBQVcsRUFBRztVQUFFK0gsS0FBSyxDQUFDeVgsY0FBYyxDQUFDLENBQUM7VUFBRWxILFlBQVksQ0FBQyxDQUFDO1FBQUU7UUFDdks7TUFDRDtNQUNBNEcsaUJBQWlCLENBQUVuWCxLQUFNLENBQUM7SUFDM0I7SUFDQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTMlgsT0FBT0EsQ0FBQSxFQUFHO01BQ2xCLElBQUs3ZixPQUFPLEVBQUc7UUFDZDBhLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDZjtJQUNEO0lBQ0E7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNvRixhQUFhQSxDQUFBLEVBQUc7TUFDeEIsSUFBSzdoQixRQUFRLENBQUNnSCxNQUFNLElBQUlqRixPQUFPLEVBQUc7UUFDakMwYSxNQUFNLENBQUUsSUFBSyxDQUFDO01BQ2Y7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3FGLFlBQVlBLENBQUEsRUFBRztNQUN2QnJGLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDZHNGLHdCQUF3QixDQUFDLENBQUM7SUFDM0I7O0lBRUE7SUFDQSxTQUFTQyxpQkFBaUJBLENBQUEsRUFBRztNQUM1QnBnQixTQUFTLENBQUNtRyxPQUFPLENBQUUsVUFBVzFHLFFBQVEsRUFBRztRQUFFLElBQUtBLFFBQVEsSUFBSUEsUUFBUSxDQUFDNGdCLE9BQU8sRUFBRztVQUFFNWdCLFFBQVEsQ0FBQzRnQixPQUFPLENBQUMsQ0FBQztRQUFFO01BQUUsQ0FBRSxDQUFDO01BQzFHcmdCLFNBQVMsR0FBRyxFQUFFO0lBQ2Y7O0lBRUE7SUFDQSxTQUFTc2dCLHFCQUFxQkEsQ0FBQSxFQUFHO01BQ2hDRixpQkFBaUIsQ0FBQyxDQUFDO01BQ25CamhCLEtBQUssQ0FBQ2lLLGdCQUFnQixDQUFFLCtCQUFnQyxDQUFDLENBQUNqRCxPQUFPLENBQUUsVUFBVytFLEdBQUcsRUFBRztRQUNuRmxMLFNBQVMsQ0FBQzRQLElBQUksQ0FBRSxJQUFJelIsTUFBTSxDQUFDVSxRQUFRLENBQUVxTSxHQUFHLEVBQUU7VUFDekNxVixLQUFLLEVBQUU7WUFBRUMsSUFBSSxFQUFFbmYsVUFBVTtZQUFFb2YsSUFBSSxFQUFFLElBQUk7WUFBRUMsR0FBRyxFQUFFO1VBQUssQ0FBQztVQUFFNVEsSUFBSSxFQUFFLEtBQUs7VUFBRXRGLFNBQVMsRUFBRSxZQUFZO1VBQ3hGbVcsTUFBTSxFQUFFLDRDQUE0QztVQUFFQyxTQUFTLEVBQUUsNkNBQTZDO1VBQzlHeFcsTUFBTSxFQUFFMUksZUFBZTtVQUFFbWYsZUFBZSxFQUFFLEtBQUs7VUFBRUMsYUFBYSxFQUFFLElBQUk7VUFBRUMsY0FBYyxFQUFFLElBQUk7VUFDMUZDLGlCQUFpQixFQUFFcmQsTUFBTSxDQUFFbkUsZUFBZSxDQUFDeWhCLGtCQUFtQixDQUFDLElBQUksQ0FBQztVQUFFQyxTQUFTLEVBQUUsQ0FBQztVQUNsRkMsb0JBQW9CLEVBQUV4ZCxNQUFNLENBQUVuRSxlQUFlLENBQUNnUSxzQkFBdUIsQ0FBQyxJQUFJLEVBQUU7VUFBRTRSLE1BQU0sRUFBRSxLQUFLO1VBQzNGQyxhQUFhLEVBQUUsbURBQW1EO1VBQUVDLFVBQVUsRUFBRSxnREFBZ0Q7VUFBRUMsV0FBVyxFQUFFLGlEQUFpRDtVQUNoTUMsUUFBUSxFQUFFclcsU0FBUztVQUFFc1csT0FBTyxFQUFFM1QsUUFBUTtVQUFFNFQsT0FBTyxFQUFFMVQsUUFBUTtVQUFFMlQsTUFBTSxFQUFFOU8sT0FBTztVQUFFK08sS0FBSyxFQUFFMUM7UUFDcEYsQ0FBRSxDQUFFLENBQUM7TUFDTixDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyQyxnQkFBZ0JBLENBQUVsYyxJQUFJLEVBQUVtYyxPQUFPLEVBQUc7TUFDMUMsSUFBSWxlLFVBQVUsR0FBR0QsTUFBTSxDQUFFbWUsT0FBTyxDQUFDbGUsVUFBVyxDQUFDO01BQzdDLElBQUl4QixNQUFNO01BRVYsSUFBS3VELElBQUksSUFBSS9CLFVBQVUsSUFBSWtlLE9BQU8sQ0FBQzFhLFVBQVUsSUFBSTBhLE9BQU8sQ0FBQ3RhLGFBQWEsSUFBSXNhLE9BQU8sQ0FBQ3BhLFdBQVcsRUFBRztRQUMvRnRGLE1BQU0sR0FBRztVQUFFdUQsSUFBSSxFQUFFQSxJQUFJO1VBQUVULElBQUksRUFBRVMsSUFBSSxDQUFDUixhQUFhLENBQUUsMkNBQTRDLENBQUM7VUFBRXZCLFVBQVUsRUFBRUEsVUFBVTtVQUFFMEQsV0FBVyxFQUFFM0QsTUFBTSxDQUFFbWUsT0FBTyxDQUFDeGEsV0FBWSxDQUFDO1VBQUVGLFVBQVUsRUFBRW5GLE1BQU0sQ0FBRTZmLE9BQU8sQ0FBQzFhLFVBQVcsQ0FBQztVQUFFSSxhQUFhLEVBQUV2RixNQUFNLENBQUU2ZixPQUFPLENBQUN0YSxhQUFjLENBQUM7VUFBRUUsV0FBVyxFQUFFekYsTUFBTSxDQUFFNmYsT0FBTyxDQUFDcGEsV0FBWSxDQUFDO1VBQUVkLEtBQUssRUFBRSxNQUFNO1VBQUUzRyxVQUFVLEVBQUUsQ0FBQztVQUFFNEgsT0FBTyxFQUFFO1FBQUssQ0FBQztRQUN2VmpJLE9BQU8sQ0FBQ3VJLEdBQUcsQ0FBRXhDLElBQUksRUFBRXZELE1BQU8sQ0FBQztRQUMzQnRDLGVBQWUsQ0FBQzhQLElBQUksQ0FBRXhOLE1BQU8sQ0FBQztRQUM5QjRDLHlCQUF5QixDQUFFNUMsTUFBTyxDQUFDO01BQ3BDO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyZixhQUFhQSxDQUFBLEVBQUc7TUFDeEIsSUFBSUMsd0JBQXdCLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsZUFBZSxDQUFFLENBQUNuSixPQUFPLENBQUVqWSxlQUFnQixDQUFDO01BRXhIaWEsTUFBTSxDQUFFLElBQUssQ0FBQztNQUNkLElBQUssQ0FBRW1ILHdCQUF3QixFQUFHO1FBQ2pDcEosWUFBWSxDQUFDLENBQUM7TUFDZjtNQUNBd0gsaUJBQWlCLENBQUMsQ0FBQztNQUNuQm5nQixVQUFVLElBQUksQ0FBQztNQUNmTCxPQUFPLEdBQUcsSUFBSUMsT0FBTyxDQUFDLENBQUM7TUFDdkJDLGVBQWUsR0FBRyxFQUFFO01BQ3BCQyxRQUFRLEdBQUcsSUFBSUYsT0FBTyxDQUFDLENBQUM7TUFDeEJtQixnQkFBZ0IsR0FBRyxJQUFJO0lBQ3hCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNpaEIsZ0JBQWdCQSxDQUFFQyxlQUFlLEVBQUc7TUFDNUM1QixxQkFBcUIsQ0FBQyxDQUFDO01BQ3ZCLElBQUs1ZixvQkFBb0IsRUFBRztRQUMzQk0sZ0JBQWdCLEdBQUdxWCxpQkFBaUIsQ0FBRTFVLE1BQU0sQ0FBRWpELG9CQUFvQixDQUFDa0QsVUFBVSxJQUFJLENBQUUsQ0FBRSxDQUFDO1FBQ3RGLElBQUtzZSxlQUFlLElBQUl2ZSxNQUFNLENBQUV1ZSxlQUFlLENBQUN0ZSxVQUFVLElBQUksQ0FBRSxDQUFDLEtBQUtELE1BQU0sQ0FBRWpELG9CQUFvQixDQUFDa0QsVUFBVSxJQUFJLENBQUUsQ0FBQyxFQUFHO1VBQ3RINUMsZ0JBQWdCLEdBQUdxWCxpQkFBaUIsQ0FBRTFVLE1BQU0sQ0FBRWpELG9CQUFvQixDQUFDa0QsVUFBVSxJQUFJLENBQUUsQ0FBRSxDQUFDO1FBQ3ZGO01BQ0Q7SUFDRDtJQUNBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN1ZSxtQkFBbUJBLENBQUVDLFVBQVUsRUFBRztNQUMxQyxJQUFLQSxVQUFVLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsZUFBZSxDQUFFLENBQUN2SixPQUFPLENBQUVqWSxlQUFnQixDQUFDLEVBQUc7UUFDOUdpYSxNQUFNLENBQUUsSUFBSyxDQUFDO1FBQ2RqQyxZQUFZLENBQUMsQ0FBQztNQUNmO0lBQ0Q7SUFDQTtJQUNBLFNBQVN5SixjQUFjQSxDQUFBLEVBQUc7TUFDekIsT0FBTzFkLE9BQU8sQ0FBRXhFLE9BQU8sSUFBSUMsY0FBYyxJQUFJQyxvQkFBb0IsSUFBSUMsV0FBVyxJQUFJLE1BQU0sS0FBS00sZUFBZ0IsQ0FBQztJQUNqSDs7SUFFQTtJQUNBLFNBQVMwaEIsVUFBVUEsQ0FBQSxFQUFHO01BQ3JCLElBQUk5YyxRQUFRO01BQ1osSUFBSUksTUFBTTtNQUNWLElBQUt6RSxXQUFXLElBQUksQ0FBRWhDLEtBQUssRUFBRztRQUFFO01BQVE7TUFDeENnQyxXQUFXLEdBQUcsSUFBSTtNQUNsQkMsWUFBWSxHQUFHLEtBQUs7TUFDcEJvRSxRQUFRLEdBQUd4RyxRQUFRLENBQUVVLFNBQVMsQ0FBQ3VCLFdBQVksQ0FBQztNQUM1QyxJQUFLdUUsUUFBUSxFQUFHO1FBQUVJLE1BQU0sR0FBR3hILFFBQVEsQ0FBQ3lILGFBQWEsQ0FBRSxNQUFPLENBQUM7UUFBRUQsTUFBTSxDQUFDRSxTQUFTLEdBQUdOLFFBQVEsQ0FBRSxDQUFDLENBQUUsQ0FBQztRQUFFdkUsV0FBVyxHQUFHMkUsTUFBTSxDQUFDSyxpQkFBaUI7UUFBRSxJQUFLaEYsV0FBVyxFQUFHO1VBQUU5QixLQUFLLENBQUMyUyxXQUFXLENBQUU3USxXQUFZLENBQUM7UUFBRTtNQUFFO01BQ2pNOUIsS0FBSyxDQUFDa1AsZ0JBQWdCLENBQUUsYUFBYSxFQUFFakcsaUJBQWtCLENBQUM7TUFBRWpKLEtBQUssQ0FBQ2tQLGdCQUFnQixDQUFFLFNBQVMsRUFBRWpHLGlCQUFrQixDQUFDO01BQUVqSixLQUFLLENBQUNrUCxnQkFBZ0IsQ0FBRSxhQUFhLEVBQUUxRixlQUFlLEVBQUUsSUFBSyxDQUFDO01BQ2xMdkssUUFBUSxDQUFDaVEsZ0JBQWdCLENBQUUsU0FBUyxFQUFFMFIsVUFBVyxDQUFDO01BQUUzaEIsUUFBUSxDQUFDaVEsZ0JBQWdCLENBQUUsa0JBQWtCLEVBQUU0UixhQUFjLENBQUM7TUFBRTloQixNQUFNLENBQUNrUSxnQkFBZ0IsQ0FBRSxNQUFNLEVBQUUyUixPQUFRLENBQUM7TUFBRTdoQixNQUFNLENBQUNrUSxnQkFBZ0IsQ0FBRSxVQUFVLEVBQUU2UixZQUFhLENBQUM7TUFDbk5JLHFCQUFxQixDQUFDLENBQUM7SUFDeEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNILHdCQUF3QkEsQ0FBQSxFQUFHO01BQ25DdGYsb0JBQW9CLElBQUksQ0FBQztNQUN6QixJQUFLVCxjQUFjLElBQUlBLGNBQWMsQ0FBQzBZLEtBQUssRUFBRztRQUM3QzFZLGNBQWMsQ0FBQzBZLEtBQUssQ0FBQyxDQUFDO01BQ3ZCO01BQ0EsSUFBS3RZLGFBQWEsSUFBSUEsYUFBYSxDQUFDc1ksS0FBSyxFQUFHO1FBQzNDdFksYUFBYSxDQUFDc1ksS0FBSyxDQUFDLENBQUM7TUFDdEI7TUFDQTFZLGNBQWMsR0FBRyxJQUFJO01BQ3JCSSxhQUFhLEdBQUcsSUFBSTtNQUNwQjBYLHNCQUFzQixDQUFFelgsdUJBQXdCLENBQUM7TUFDakRBLHVCQUF1QixHQUFHLElBQUk7TUFDOUJvWCxrQkFBa0IsQ0FBRXhYLG9CQUFxQixDQUFDO01BQzFDc1ksa0JBQWtCLENBQUMsQ0FBQztNQUNwQnBZLGFBQWEsR0FBRyxJQUFJO01BQ3BCRyxvQkFBb0IsR0FBRyxJQUFJO01BQzNCQyxrQkFBa0IsR0FBRyxJQUFJO01BQ3pCRyxnQkFBZ0IsR0FBRyxJQUFJO01BQ3ZCRSxnQkFBZ0IsR0FBRyxJQUFJO01BQ3ZCRCw2QkFBNkIsR0FBRyxDQUFDO01BQ2pDSCxlQUFlLEdBQUcsTUFBTTtNQUN4QnpCLEtBQUssQ0FBQ3NKLFNBQVMsQ0FBQ2lJLE1BQU0sQ0FBRSxtQ0FBb0MsQ0FBQztJQUM5RDs7SUFFQTtJQUNBLFNBQVMyUCxPQUFPQSxDQUFBLEVBQUc7TUFDbEIsSUFBSyxDQUFFbGYsV0FBVyxFQUFHO1FBQUU7TUFBUTtNQUMvQkMsWUFBWSxHQUFHLElBQUk7TUFDbkJ5WixNQUFNLENBQUUsSUFBSyxDQUFDO01BQUVzRix3QkFBd0IsQ0FBQyxDQUFDO01BQUVDLGlCQUFpQixDQUFDLENBQUM7TUFBRW5nQixVQUFVLElBQUksQ0FBQztNQUFFTCxPQUFPLEdBQUcsSUFBSUMsT0FBTyxDQUFDLENBQUM7TUFBRUMsZUFBZSxHQUFHLEVBQUU7TUFBRUMsUUFBUSxHQUFHLElBQUlGLE9BQU8sQ0FBQyxDQUFDO01BQ3pKVixLQUFLLENBQUM0VSxtQkFBbUIsQ0FBRSxhQUFhLEVBQUUzTCxpQkFBa0IsQ0FBQztNQUFFakosS0FBSyxDQUFDNFUsbUJBQW1CLENBQUUsU0FBUyxFQUFFM0wsaUJBQWtCLENBQUM7TUFBRWpKLEtBQUssQ0FBQzRVLG1CQUFtQixDQUFFLGFBQWEsRUFBRXBMLGVBQWUsRUFBRSxJQUFLLENBQUM7TUFDM0x2SyxRQUFRLENBQUMyVixtQkFBbUIsQ0FBRSxTQUFTLEVBQUVnTSxVQUFXLENBQUM7TUFBRTNoQixRQUFRLENBQUMyVixtQkFBbUIsQ0FBRSxrQkFBa0IsRUFBRWtNLGFBQWMsQ0FBQztNQUFFOWhCLE1BQU0sQ0FBQzRWLG1CQUFtQixDQUFFLE1BQU0sRUFBRWlNLE9BQVEsQ0FBQztNQUFFN2hCLE1BQU0sQ0FBQzRWLG1CQUFtQixDQUFFLFVBQVUsRUFBRW1NLFlBQWEsQ0FBQztNQUMvTixJQUFLamYsV0FBVyxFQUFHO1FBQUVBLFdBQVcsQ0FBQ3lQLE1BQU0sQ0FBQyxDQUFDO1FBQUV6UCxXQUFXLEdBQUcsSUFBSTtNQUFFO01BQy9ERSxXQUFXLEdBQUcsS0FBSztJQUNwQjtJQUVBLE9BQU87TUFBRW1oQixVQUFVLEVBQUVBLFVBQVU7TUFBRWpDLE9BQU8sRUFBRUEsT0FBTztNQUFFMEIsYUFBYSxFQUFFQSxhQUFhO01BQUVGLGdCQUFnQixFQUFFQSxnQkFBZ0I7TUFBRUksZ0JBQWdCLEVBQUVBLGdCQUFnQjtNQUFFRSxtQkFBbUIsRUFBRUEsbUJBQW1CO01BQUVFLGNBQWMsRUFBRUEsY0FBYztNQUFFekYsd0JBQXdCLEVBQUVBO0lBQXlCLENBQUM7RUFDeFI7RUFFQXJlLFlBQVksQ0FBQ0ssMEJBQTBCLENBQUVLLGlCQUFrQixDQUFDO0VBQzVEWixPQUFPLENBQUNNLGdCQUFnQixDQUFFLGtCQUFrQixFQUFFLFlBQVk7SUFDekQsT0FBTztNQUFFMmpCLFVBQVUsRUFBRSxTQUFBQSxDQUFBLEVBQVksQ0FBQyxDQUFDO01BQUVqQyxPQUFPLEVBQUUsU0FBQUEsQ0FBQSxFQUFZLENBQUMsQ0FBQztNQUFFa0MsWUFBWSxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUFFLE9BQU8sSUFBSTtNQUFFO0lBQUUsQ0FBQztFQUMzRyxDQUFFLENBQUM7QUFDSixDQUFDLEVBQUVwa0IsTUFBTSxFQUFFQyxRQUFTLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
