"use strict";

/**
 * Timeline empty-range selection state machine and Availability actions.
 *
 * The module owns local pointer, touch, keyboard, resize, preview, Retry,
 * Block/Unblock, focus-restoration, and stale-response behavior. Timeline owns
 * the surrounding axis/window cache and supplies narrow callbacks; the server
 * remains authoritative for validation, authorization, and persistence.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document) {
  'use strict';

  var module_id = 'empty_range_selection';

  /**
   * Create one empty-range selection controller.
   *
   * @param {Object} context Timeline-owned mount, settings, and bounded callbacks.
   * @return {Object} Empty-range selection lifecycle and delegation API.
   */
  function create_empty_range_selection_controller(context) {
    var mount = context.mount || null;
    var settings = context.settings || {};
    var selection_request = null;
    var selection_request_generation = 0;
    var selection_preview_timer = 0;
    var touch_selection_candidate = null;
    var selection_resize_state = null;
    var selection_state = create_empty_selection_state();
    var is_initialized = false;

    /**
     * Create the canonical empty local-selection state.
     *
     * @return {Object} Empty selection state.
     */
    function create_empty_selection_state() {
      return {
        phase: 'idle',
        resource_id: 0,
        anchor_index: -1,
        start_index: -1,
        end_index: -1,
        start_at: '',
        end_at: '',
        start_epoch: 0,
        end_epoch: 0,
        preview: null,
        error_message: '',
        pointer_id: null
      };
    }

    /**
     * Report whether the Timeline host is still active.
     *
     * @return {boolean} True while callbacks and focus restoration are safe.
     */
    function is_host_active() {
      return is_initialized && ('function' !== typeof context.is_host_active || context.is_host_active());
    }

    /**
     * Return one server-allow-listed Timeline template renderer.
     *
     * @param {string} template_key Stable template-pack key.
     * @return {Function|null} WordPress template renderer or null.
     */
    function get_template(template_key) {
      return 'function' === typeof context.get_template ? context.get_template(template_key) : null;
    }

    /**
     * Announce one selection lifecycle message through the Timeline live region.
     *
     * @param {string} message Authorized localized message.
     * @return {void}
     */
    function announce(message) {
      if ('function' === typeof context.announce) {
        context.announce(message);
      }
    }

    /**
     * Return the active axis cell duration in minutes.
     *
     * @return {number} Positive allow-listed cell duration.
     */
    function get_selection_cell_minutes() {
      var views = settings.metadata && Array.isArray(settings.metadata.views) ? settings.metadata.views : [];
      var minutes = 1440;
      views.some(function (view) {
        if (view && view.id === settings.axis.view) {
          minutes = Number(view.cell_minutes) || minutes;
          return true;
        }
        return false;
      });
      return minutes;
    }

    /**
     * Format a local draft duration before the server returns localized detail.
     *
     * @param {number} minutes Duration in minutes.
     * @return {string} Compact duration label.
     */
    function format_selection_duration(minutes) {
      var duration_minutes = Math.max(1, Math.round(Number(minutes) || 0));
      var days = Math.floor(duration_minutes / 1440);
      var remaining_minutes = duration_minutes % 1440;
      var hours = Math.floor(remaining_minutes / 60);
      var minute_remainder = remaining_minutes % 60;
      var parts = [];
      if (days) {
        parts.push(String(settings.i18n.selection_days_short || '%s d').replace('%s', days));
      }
      if (hours) {
        parts.push(String(settings.i18n.selection_hours_short || '%s h').replace('%s', hours));
      }
      if (minute_remainder || !parts.length) {
        parts.push(String(settings.i18n.selection_minutes_short || '%s min').replace('%s', minute_remainder));
      }
      return parts.join(' ');
    }

    /**
     * Locate a rendered selection track by authorized Resource ID.
     *
     * @param {number} resource_id Booking Resource ID.
     * @return {Element|null} Track element or null.
     */
    function get_selection_track(resource_id) {
      var tracks = mount ? mount.querySelectorAll('[data-wpbc-timeline-selection-track]') : [];
      var matched_track = null;
      Array.prototype.some.call(tracks, function (track) {
        if (Number(track.getAttribute('data-wpbc-timeline-resource-id')) === Number(resource_id)) {
          matched_track = track;
          return true;
        }
        return false;
      });
      return matched_track;
    }

    /**
     * Locate the physical cell under a pointer without assuming RTL scroll signs.
     *
     * @param {Element} track Resource track.
     * @param {number} client_x Pointer viewport X coordinate.
     * @return {number} Bounded cell index.
     */
    function get_selection_cell_index(track, client_x) {
      var cells = track.querySelectorAll('.wpbc_timeline__canvas_cell');
      var closest_index = 0;
      var closest_distance = Infinity;
      Array.prototype.some.call(cells, function (cell, cell_index) {
        var rectangle = cell.getBoundingClientRect();
        var distance;
        if (client_x >= rectangle.left && client_x <= rectangle.right) {
          closest_index = cell_index;
          return true;
        }
        distance = Math.abs(client_x - (rectangle.left + rectangle.width / 2));
        if (distance < closest_distance) {
          closest_distance = distance;
          closest_index = cell_index;
        }
        return false;
      });
      return Math.max(0, Math.min(Math.max(0, cells.length - 1), closest_index));
    }

    /**
     * Update the local half-open draft from two inclusive cell indexes.
     *
     * @param {number} resource_id Authorized Resource ID from the rendered DTO.
     * @param {number} first_index First selected cell.
     * @param {number} last_index Last selected cell.
     * @param {string} phase Selection state phase.
     * @return {boolean} True when the axis boundaries were available.
     */
    function set_selection_range(resource_id, first_index, last_index, phase) {
      var cells = settings.axis && Array.isArray(settings.axis.cells) ? settings.axis.cells : [];
      var start_index = Math.max(0, Math.min(first_index, last_index));
      var end_index = Math.min(cells.length - 1, Math.max(first_index, last_index));
      var start_cell = cells[start_index];
      var end_cell = cells[end_index];
      if (!start_cell || !end_cell) {
        return false;
      }
      selection_state.phase = phase;
      selection_state.resource_id = Number(resource_id);
      selection_state.start_index = start_index;
      selection_state.end_index = end_index;
      selection_state.start_at = start_cell.start_at;
      selection_state.end_at = end_cell.end_at;
      selection_state.start_epoch = Number(start_cell.start_epoch);
      selection_state.end_epoch = Number(end_cell.end_epoch);
      selection_state.preview = null;
      selection_state.error_message = '';
      render_selection();
      return true;
    }

    /**
     * Keep the selection popover inside the visible Timeline canvas.
     *
     * The popover is row-owned so it scrolls horizontally with the selected
     * range. The canvas clips vertical overflow, therefore the preferred
     * block placement must be selected against the visible canvas body and
     * viewport instead of always opening below the selection.
     *
     * @return {void}
     */
    function position_selection_popover() {
      var popover = mount ? mount.querySelector('[data-wpbc-timeline-selection-popover]') : null;
      var canvas = mount ? mount.querySelector('[data-wpbc-timeline-canvas]') : null;
      var canvas_body = canvas ? canvas.querySelector('.wpbc_timeline__canvas_body') : null;
      var selection = mount ? mount.querySelector('[data-wpbc-timeline-selection]') : null;
      var popover_rectangle;
      var canvas_rectangle;
      var canvas_body_rectangle;
      var selection_rectangle;
      var viewport_width;
      var viewport_height;
      var visible_inline_start;
      var visible_inline_end;
      var visible_block_start;
      var visible_block_end;
      var available_above;
      var available_below;
      var placement = 'below';
      var placement_space = 0;
      var shift = 0;
      if (!popover || !canvas) {
        return;
      }
      viewport_width = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0);
      viewport_height = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0);
      popover.style.setProperty('--wpbc-timeline-selection-popover-shift', '0px');
      popover.style.removeProperty('--wpbc-timeline-selection-popover-max-block-size');
      popover.setAttribute('data-wpbc-timeline-selection-popover-placement', placement);
      popover_rectangle = popover.getBoundingClientRect();
      canvas_rectangle = canvas.getBoundingClientRect();
      canvas_body_rectangle = canvas_body ? canvas_body.getBoundingClientRect() : canvas_rectangle;
      selection_rectangle = selection ? selection.getBoundingClientRect() : null;
      visible_inline_start = Math.max(canvas_rectangle.left, 8);
      visible_inline_end = Math.min(canvas_rectangle.right, viewport_width || canvas_rectangle.right) - 8;
      visible_block_start = Math.max(canvas_rectangle.top, canvas_body_rectangle.top, 8);
      visible_block_end = Math.min(canvas_rectangle.bottom, canvas_body_rectangle.bottom, viewport_height || canvas_rectangle.bottom) - 8;
      if (selection_rectangle && visible_block_end > visible_block_start) {
        available_above = Math.max(0, selection_rectangle.top - visible_block_start - 8);
        available_below = Math.max(0, visible_block_end - selection_rectangle.bottom - 8);
        if (available_below < popover_rectangle.height && available_above > available_below) {
          placement = 'above';
        }
        placement_space = 'above' === placement ? available_above : available_below;
        popover.setAttribute('data-wpbc-timeline-selection-popover-placement', placement);
        if (placement_space < popover_rectangle.height) {
          popover.style.setProperty('--wpbc-timeline-selection-popover-max-block-size', Math.max(80, Math.floor(placement_space)) + 'px');
        }
      }
      popover_rectangle = popover.getBoundingClientRect();
      if (popover_rectangle.left < visible_inline_start) {
        shift += visible_inline_start - popover_rectangle.left;
      }
      if (popover_rectangle.right + shift > visible_inline_end) {
        shift -= popover_rectangle.right + shift - visible_inline_end;
      }
      popover.style.setProperty('--wpbc-timeline-selection-popover-shift', shift + 'px');
    }

    /**
     * Rebase an active selection onto the current authoritative axis.
     *
     * @return {boolean} True when the selection is idle or valid on this axis.
     */
    function reconcile_selection_with_axis() {
      var cells = settings.axis && Array.isArray(settings.axis.cells) ? settings.axis.cells : [];
      var previous_start_index = Number(selection_state.start_index);
      var start_index = -1;
      var end_index = -1;
      var index_shift;
      if ('idle' === selection_state.phase) {
        return true;
      }
      if (!cells.length || !selection_state.start_epoch || selection_state.end_epoch <= selection_state.start_epoch) {
        reset_selection_state();
        return false;
      }
      cells.some(function (cell, cell_index) {
        if (Number(cell.start_epoch) === Number(selection_state.start_epoch)) {
          start_index = cell_index;
          return true;
        }
        return false;
      });
      cells.some(function (cell, cell_index) {
        if (Number(cell.end_epoch) === Number(selection_state.end_epoch)) {
          end_index = cell_index;
          return true;
        }
        return false;
      });
      if (0 > start_index || start_index > end_index) {
        reset_selection_state();
        return false;
      }
      index_shift = 0 <= previous_start_index ? start_index - previous_start_index : 0;
      selection_state.start_index = start_index;
      selection_state.end_index = end_index;
      if (0 <= selection_state.anchor_index) {
        selection_state.anchor_index = Math.max(start_index, Math.min(end_index, selection_state.anchor_index + index_shift));
      }
      return true;
    }

    /**
     * Render the local selection into its Resource row only.
     *
     * @return {void}
     */
    function render_selection() {
      var hosts = mount ? mount.querySelectorAll('[data-wpbc-timeline-selection-host]') : [];
      var cells = settings.axis && Array.isArray(settings.axis.cells) ? settings.axis.cells : [];
      var start_cell;
      var end_cell;
      var end_boundary_cell;
      var track;
      var host;
      var geometry;
      var selection_template;
      var popover_template;
      var template_buffer;
      var duration_minutes;
      var view_model;
      Array.prototype.forEach.call(hosts, function (current_host) {
        current_host.textContent = '';
      });
      if ('idle' === selection_state.phase || !selection_state.resource_id || !cells.length) {
        return;
      }
      if (!reconcile_selection_with_axis()) {
        return;
      }
      start_cell = cells[selection_state.start_index];
      end_cell = cells[selection_state.end_index];
      if (!start_cell || !end_cell) {
        reset_selection_state();
        return;
      }
      track = get_selection_track(selection_state.resource_id);
      host = track ? track.querySelector('[data-wpbc-timeline-selection-host]') : null;
      if (!host || selection_state.start_epoch < Number(settings.axis.start_epoch) || selection_state.end_epoch > Number(settings.axis.end_epoch)) {
        return;
      }
      geometry = 'function' === typeof context.get_segment_geometry ? context.get_segment_geometry(settings.axis, selection_state.start_epoch, selection_state.end_epoch) : {
        offset_percent: 0,
        width_percent: 0
      };
      duration_minutes = Math.max(get_selection_cell_minutes(), Math.round((selection_state.end_epoch - selection_state.start_epoch) / 60));
      end_boundary_cell = cells[selection_state.end_index + 1];
      view_model = {
        offset_percent: geometry.offset_percent,
        width_percent: geometry.width_percent,
        center_percent: geometry.offset_percent + geometry.width_percent / 2,
        active_boundary: selection_resize_state ? selection_resize_state.boundary : '',
        duration_label: selection_state.preview && selection_state.preview.selection ? selection_state.preview.selection.duration_label : format_selection_duration(duration_minutes),
        aria_label: settings.i18n.selection_preview,
        start_handle: {
          label: settings.i18n.selection_start_handle,
          min: 1,
          max: selection_state.end_index + 1,
          now: selection_state.start_index + 1,
          value_text: start_cell.aria_label || selection_state.start_at
        },
        end_handle: {
          label: settings.i18n.selection_end_handle,
          min: selection_state.start_index + 1,
          max: cells.length,
          now: selection_state.end_index + 1,
          value_text: end_boundary_cell && end_boundary_cell.aria_label ? end_boundary_cell.aria_label : selection_state.end_at
        },
        state: selection_state.phase,
        preview: selection_state.preview,
        error_message: selection_state.error_message,
        i18n: settings.i18n
      };
      selection_template = get_template('selection');
      popover_template = get_template('selection_popover');
      if (selection_template) {
        template_buffer = document.createElement('div');
        template_buffer.innerHTML = selection_template(view_model);
        while (template_buffer.firstChild) {
          host.appendChild(template_buffer.firstChild);
        }
      }
      if (popover_template && -1 !== ['loading', 'ready', 'error'].indexOf(selection_state.phase)) {
        template_buffer = document.createElement('div');
        template_buffer.innerHTML = popover_template(view_model);
        while (template_buffer.firstChild) {
          host.appendChild(template_buffer.firstChild);
        }
        window.requestAnimationFrame(position_selection_popover);
      }
    }

    /**
     * Abort the current selection preview and invalidate pending callbacks.
     *
     * @return {void}
     */
    function abort_selection_preview_request() {
      if (selection_preview_timer) {
        window.clearTimeout(selection_preview_timer);
        selection_preview_timer = 0;
      }
      if (selection_request && 'function' === typeof selection_request.abort) {
        selection_request.abort();
      }
      selection_request = null;
      selection_request_generation += 1;
    }

    /**
     * Reset the local selection without rendering or announcing.
     *
     * @return {void}
     */
    function reset_selection_state() {
      abort_selection_preview_request();
      selection_resize_state = null;
      touch_selection_candidate = null;
      selection_state = create_empty_selection_state();
    }

    /**
     * Debounce an authoritative preview after keyboard boundary adjustments.
     *
     * @param {number} delay_ms Delay in milliseconds.
     * @return {void}
     */
    function schedule_selection_preview(delay_ms) {
      if (selection_preview_timer) {
        window.clearTimeout(selection_preview_timer);
      }
      selection_preview_timer = window.setTimeout(function () {
        selection_preview_timer = 0;
        if (!is_host_active()) {
          return;
        }
        request_selection_preview();
      }, Math.max(0, Number(delay_ms) || 0));
    }

    /**
     * Restore keyboard focus after rendering replaces a selection handle.
     *
     * @param {string} boundary Start or end boundary.
     * @return {void}
     */
    function focus_selection_handle(boundary) {
      window.requestAnimationFrame(function () {
        var handle;
        if (!is_host_active()) {
          return;
        }
        handle = mount.querySelector('[data-wpbc-timeline-selection-handle="' + boundary + '"]');
        if (handle) {
          handle.focus();
        }
      });
    }

    /**
     * Cancel the local draft and any in-flight preview without writing data.
     *
     * @param {boolean} should_announce Whether to announce cancellation.
     * @return {void}
     */
    function cancel_selection(should_announce) {
      if ('applying' === selection_state.phase) {
        return;
      }
      reset_selection_state();
      render_selection();
      if (should_announce) {
        announce(settings.i18n.selection_cancelled);
      }
    }

    /**
     * Consume a ready selection only when its signed action token is exact.
     *
     * The token remains opaque. This comparison prevents an unrelated draft from
     * being cleared by a booking created from the toolbar or another selection
     * surface.
     *
     * @param {string} action_id Stable preview action identifier.
     * @param {string} query_arg Signed-token query argument name.
     * @param {string} token     Opaque signed token consumed by creation.
     * @return {boolean} True when the current selection matched and was cleared.
     */
    function consume_signed_action_context(action_id, query_arg, token) {
      var action = selection_state.preview && selection_state.preview.actions ? selection_state.preview.actions[action_id] : null;
      var action_url;
      if ('ready' !== selection_state.phase || !action || true !== action.authorized || true !== action.enabled || !action.url || !/^[a-zA-Z0-9_-]{1,64}$/.test(String(query_arg || '')) || !/^[A-Za-z0-9._-]{1,8192}$/.test(String(token || '')) || !window.URL) {
        return false;
      }
      try {
        action_url = new window.URL(String(action.url), window.location.href);
      } catch (error) {
        return false;
      }
      if (String(action_url.searchParams.get(query_arg) || '') !== String(token)) {
        return false;
      }
      cancel_selection(false);
      return true;
    }

    /**
     * Return signed context for each currently cached authorized window.
     *
     * @return {Array<string>} Bounded loaded-window tokens.
     */
    function get_loaded_selection_context_tokens() {
      if ('function' !== typeof context.get_loaded_context_tokens) {
        return [];
      }
      return context.get_loaded_context_tokens();
    }

    /**
     * Reload authorization and domain projections for the completed local draft.
     *
     * @return {void}
     */
    function request_selection_preview() {
      var transport = settings.transport && settings.transport.selection ? settings.transport.selection : {};
      var generation;
      if (!window.jQuery || !settings.transport.url || !transport.preview_action || !transport.preview_nonce || 'idle' === selection_state.phase) {
        return;
      }
      abort_selection_preview_request();
      generation = selection_request_generation;
      selection_state.phase = 'loading';
      selection_state.error_message = '';
      render_selection();
      announce(settings.i18n.selection_ready);
      selection_request = window.jQuery.ajax({
        url: settings.transport.url,
        method: 'POST',
        dataType: 'json',
        timeout: 'function' === typeof context.get_request_timeout_ms ? context.get_request_timeout_ms() : 15000,
        data: {
          action: transport.preview_action,
          nonce: transport.preview_nonce,
          resource_id: selection_state.resource_id,
          view: settings.axis.view,
          start_at: selection_state.start_at,
          end_at: selection_state.end_at,
          loaded_start_at: settings.axis.start_at,
          loaded_end_at: settings.axis.end_at,
          loaded_context_tokens: get_loaded_selection_context_tokens(),
          return_context: 'function' === typeof context.get_return_context ? context.get_return_context() : {}
        }
      }).done(function (response) {
        if (generation !== selection_request_generation) {
          return;
        }
        if (!response || !response.success || !response.data || !response.data.selection) {
          selection_state.phase = 'error';
          selection_state.error_message = settings.i18n.error_message;
          return;
        }
        selection_state.preview = response.data;
        selection_state.phase = 'ready';
      }).fail(function (request, request_status) {
        var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};
        if (generation !== selection_request_generation || 'abort' === request_status) {
          return;
        }
        selection_state.phase = 'error';
        selection_state.error_message = error.message || settings.i18n.error_message;
      }).always(function () {
        if (generation !== selection_request_generation) {
          return;
        }
        selection_request = null;
        render_selection();
      });
    }

    /**
     * Update one selection boundary without allowing the handles to cross.
     *
     * @param {string} boundary Start or end boundary.
     * @param {number} requested_index Requested server-axis cell index.
     * @param {string} phase Selection state phase.
     * @return {boolean} True when the boundary was updated.
     */
    function set_selection_boundary(boundary, requested_index, phase) {
      var maximum_index = settings.axis && Array.isArray(settings.axis.cells) ? settings.axis.cells.length - 1 : -1;
      var bounded_index;
      if (0 > maximum_index || -1 === ['start', 'end'].indexOf(boundary)) {
        return false;
      }
      if ('start' === boundary) {
        bounded_index = Math.max(0, Math.min(selection_state.end_index, requested_index));
        if (bounded_index === selection_state.start_index) {
          return false;
        }
        return set_selection_range(selection_state.resource_id, bounded_index, selection_state.end_index, phase);
      }
      bounded_index = Math.max(selection_state.start_index, Math.min(maximum_index, requested_index));
      if (bounded_index === selection_state.end_index) {
        return false;
      }
      return set_selection_range(selection_state.resource_id, selection_state.start_index, bounded_index, phase);
    }

    /**
     * Begin a pointer-owned boundary resize while preserving the prior draft.
     *
     * @param {PointerEvent} event Pointer-down event.
     * @param {Element} handle Activated selection handle.
     * @param {Element} track Stable Resource selection track.
     * @return {boolean} True when the resize gesture started.
     */
    function begin_selection_resize(event, handle, track) {
      var boundary = handle.getAttribute('data-wpbc-timeline-selection-handle');
      if ('idle' === selection_state.phase || 'applying' === selection_state.phase || -1 === ['start', 'end'].indexOf(boundary)) {
        return false;
      }
      selection_resize_state = {
        boundary: boundary,
        pointer_id: event.pointerId,
        phase: selection_state.phase,
        start_index: selection_state.start_index,
        end_index: selection_state.end_index,
        start_at: selection_state.start_at,
        end_at: selection_state.end_at,
        start_epoch: selection_state.start_epoch,
        end_epoch: selection_state.end_epoch,
        preview: selection_state.preview,
        error_message: selection_state.error_message
      };
      abort_selection_preview_request();
      touch_selection_candidate = null;
      selection_state.phase = 'resizing';
      selection_state.pointer_id = event.pointerId;
      selection_state.preview = null;
      selection_state.error_message = '';
      event.preventDefault();
      event.stopPropagation();
      track.setPointerCapture(event.pointerId);
      render_selection();
      focus_selection_handle(boundary);
      return true;
    }

    /**
     * Restore the exact selection that existed before a cancelled resize.
     *
     * @param {boolean} should_focus Whether to restore focus to the handle.
     * @return {void}
     */
    function restore_selection_resize(should_focus) {
      var previous_state = selection_resize_state;
      var boundary;
      var should_reload_preview;
      if (!previous_state) {
        return;
      }
      boundary = previous_state.boundary;
      should_reload_preview = 'loading' === previous_state.phase;
      selection_resize_state = null;
      selection_state.phase = should_reload_preview ? 'draft' : previous_state.phase;
      selection_state.start_index = previous_state.start_index;
      selection_state.end_index = previous_state.end_index;
      selection_state.start_at = previous_state.start_at;
      selection_state.end_at = previous_state.end_at;
      selection_state.start_epoch = previous_state.start_epoch;
      selection_state.end_epoch = previous_state.end_epoch;
      selection_state.preview = previous_state.preview;
      selection_state.error_message = previous_state.error_message;
      selection_state.pointer_id = null;
      render_selection();
      if (should_focus) {
        focus_selection_handle(boundary);
      }
      if (should_reload_preview) {
        request_selection_preview();
      }
    }

    /**
     * Commit a local boundary gesture and request a fresh server preview.
     *
     * @param {PointerEvent} event Pointer-up event.
     * @return {void}
     */
    function complete_selection_resize(event) {
      var previous_state = selection_resize_state;
      var boundary;
      var changed;
      if (!previous_state || previous_state.pointer_id !== event.pointerId) {
        return;
      }
      boundary = previous_state.boundary;
      changed = previous_state.start_index !== selection_state.start_index || previous_state.end_index !== selection_state.end_index;
      if (!changed) {
        restore_selection_resize(true);
        return;
      }
      selection_resize_state = null;
      selection_state.phase = 'draft';
      selection_state.pointer_id = null;
      render_selection();
      focus_selection_handle(boundary);
      request_selection_preview();
    }

    /**
     * Adjust one selection slider with physical-direction keyboard controls.
     *
     * @param {KeyboardEvent} event Keyboard event.
     * @param {Element} handle Focused selection handle.
     * @return {boolean} True when the key belonged to the handle.
     */
    function handle_selection_handle_keydown(event, handle) {
      var boundary = handle.getAttribute('data-wpbc-timeline-selection-handle');
      var supported_keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      var requested_index;
      var direction;
      if (-1 === supported_keys.indexOf(event.key)) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      if ('applying' === selection_state.phase) {
        return true;
      }
      requested_index = 'start' === boundary ? selection_state.start_index : selection_state.end_index;
      if ('Home' === event.key) {
        requested_index = 'start' === boundary ? 0 : selection_state.start_index;
      } else if ('End' === event.key) {
        requested_index = 'start' === boundary ? selection_state.end_index : settings.axis.cells.length - 1;
      } else {
        direction = ('ArrowRight' === event.key ? 1 : -1) * (settings.is_rtl ? -1 : 1);
        requested_index += direction;
      }
      if ('start' === boundary) {
        requested_index = Math.max(0, Math.min(selection_state.end_index, requested_index));
      } else {
        requested_index = Math.max(selection_state.start_index, Math.min(settings.axis.cells.length - 1, requested_index));
      }
      if ('start' === boundary && requested_index !== selection_state.start_index || 'end' === boundary && requested_index !== selection_state.end_index) {
        abort_selection_preview_request();
      }
      if (set_selection_boundary(boundary, requested_index, 'draft')) {
        focus_selection_handle(boundary);
        schedule_selection_preview(180);
      }
      return true;
    }

    /**
     * Apply one reviewed Availability-domain action.
     *
     * @param {string} mode Block or unblock.
     * @return {void}
     */
    function apply_selection_block(mode) {
      var transport = settings.transport && settings.transport.selection ? settings.transport.selection : {};
      var generation;
      if (!window.jQuery || !selection_state.preview || !selection_state.preview.block_token || !transport.apply_action || !transport.apply_nonce) {
        return;
      }
      selection_request_generation += 1;
      generation = selection_request_generation;
      selection_state.phase = 'applying';
      render_selection();
      if ('function' === typeof context.set_apply_loading) {
        context.set_apply_loading(true, settings.i18n.applying_availability);
      }
      selection_request = window.jQuery.ajax({
        url: settings.transport.url,
        method: 'POST',
        dataType: 'json',
        timeout: 'function' === typeof context.get_request_timeout_ms ? context.get_request_timeout_ms() : 15000,
        data: {
          action: transport.apply_action,
          nonce: transport.apply_nonce,
          block_token: selection_state.preview.block_token,
          mode: mode
        }
      }).done(function (response) {
        if (generation !== selection_request_generation) {
          return;
        }
        if (!response || !response.success) {
          selection_state.phase = 'error';
          selection_state.error_message = response && response.data && response.data.message ? response.data.message : settings.i18n.error_message;
          return;
        }
        selection_resize_state = null;
        touch_selection_candidate = null;
        selection_state = create_empty_selection_state();
        render_selection();
        if ('function' === typeof context.refresh_after_apply) {
          context.refresh_after_apply();
        }
      }).fail(function (request, request_status) {
        var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};
        if (generation !== selection_request_generation || 'abort' === request_status) {
          return;
        }
        selection_state.phase = 'error';
        selection_state.error_message = error.message || settings.i18n.error_message;
      }).always(function () {
        if (generation === selection_request_generation) {
          selection_request = null;
          if ('function' === typeof context.set_apply_loading) {
            context.set_apply_loading(false, '');
          }
          render_selection();
        }
      });
    }

    /**
     * Start mouse/pen selection or record a touch tap candidate.
     *
     * @param {PointerEvent} event Pointer-down event.
     * @return {void}
     */
    function handle_selection_pointer_down(event) {
      var track = event.target.closest('[data-wpbc-timeline-selection-track]');
      var handle = event.target.closest('[data-wpbc-timeline-selection-handle]');
      var cell_index;
      var resource_id;
      if (handle) {
        if (track) {
          begin_selection_resize(event, handle, track);
        }
        return;
      }
      if (!track || event.target.closest('[data-wpbc-timeline-sortable-exclude], [data-wpbc-booking-overview-info-trigger], [data-wpbc-timeline-segment-id], [data-wpbc-timeline-selection-popover], button, a') || 'mouse' === event.pointerType && 0 !== event.button) {
        return;
      }
      cell_index = get_selection_cell_index(track, event.clientX);
      resource_id = Number(track.getAttribute('data-wpbc-timeline-resource-id'));
      if ('touch' === event.pointerType) {
        if ('touch_start' !== selection_state.phase || selection_state.resource_id !== resource_id) {
          abort_selection_preview_request();
        }
        touch_selection_candidate = {
          pointer_id: event.pointerId,
          resource_id: resource_id,
          cell_index: cell_index,
          start_x: event.clientX,
          start_y: event.clientY,
          moved: false
        };
        return;
      }
      event.preventDefault();
      abort_selection_preview_request();
      selection_state.pointer_id = event.pointerId;
      set_selection_range(resource_id, cell_index, cell_index, 'drawing');
      selection_state.anchor_index = cell_index;
      track.setPointerCapture(event.pointerId);
    }

    /**
     * Extend a mouse/pen draft while preserving ordinary touch scrolling.
     *
     * @param {PointerEvent} event Pointer-move event.
     * @return {void}
     */
    function handle_selection_pointer_move(event) {
      var track;
      var cell_index;
      if (selection_resize_state && selection_resize_state.pointer_id === event.pointerId) {
        track = get_selection_track(selection_state.resource_id);
        if (!track) {
          return;
        }
        event.preventDefault();
        cell_index = get_selection_cell_index(track, event.clientX);
        set_selection_boundary(selection_resize_state.boundary, cell_index, 'resizing');
        selection_state.pointer_id = event.pointerId;
        focus_selection_handle(selection_resize_state.boundary);
        return;
      }
      if (touch_selection_candidate && touch_selection_candidate.pointer_id === event.pointerId) {
        if (8 < Math.abs(event.clientX - touch_selection_candidate.start_x) || 8 < Math.abs(event.clientY - touch_selection_candidate.start_y)) {
          touch_selection_candidate.moved = true;
        }
        return;
      }
      if ('drawing' !== selection_state.phase || selection_state.pointer_id !== event.pointerId) {
        return;
      }
      track = get_selection_track(selection_state.resource_id);
      if (!track) {
        return;
      }
      event.preventDefault();
      cell_index = get_selection_cell_index(track, event.clientX);
      set_selection_range(selection_state.resource_id, selection_state.anchor_index, cell_index, 'drawing');
      selection_state.pointer_id = event.pointerId;
    }

    /**
     * Complete a pointer draft or process one touch-safe boundary tap.
     *
     * @param {PointerEvent} event Pointer-up event.
     * @return {void}
     */
    function handle_selection_pointer_up(event) {
      var candidate;
      if (selection_resize_state && selection_resize_state.pointer_id === event.pointerId) {
        complete_selection_resize(event);
        return;
      }
      if (touch_selection_candidate && touch_selection_candidate.pointer_id === event.pointerId) {
        candidate = touch_selection_candidate;
        touch_selection_candidate = null;
        if (candidate.moved) {
          return;
        }
        if ('touch_start' === selection_state.phase && selection_state.resource_id === candidate.resource_id) {
          set_selection_range(candidate.resource_id, selection_state.anchor_index, candidate.cell_index, 'draft');
          request_selection_preview();
        } else {
          set_selection_range(candidate.resource_id, candidate.cell_index, candidate.cell_index, 'touch_start');
          selection_state.anchor_index = candidate.cell_index;
        }
        return;
      }
      if ('drawing' !== selection_state.phase || selection_state.pointer_id !== event.pointerId) {
        return;
      }
      selection_state.pointer_id = null;
      selection_state.phase = 'draft';
      render_selection();
      request_selection_preview();
    }

    /**
     * Abandon only the active pointer gesture when the browser cancels it.
     *
     * @param {PointerEvent} event Cancelled pointer event.
     * @return {void}
     */
    function handle_selection_pointer_cancel(event) {
      if (touch_selection_candidate && touch_selection_candidate.pointer_id === event.pointerId) {
        touch_selection_candidate = null;
      }
      if (selection_resize_state && selection_resize_state.pointer_id === event.pointerId) {
        restore_selection_resize(true);
      } else if ('drawing' === selection_state.phase && selection_state.pointer_id === event.pointerId) {
        cancel_selection(false);
      }
    }

    /**
     * Treat unexpected pointer-capture loss as a cancelled local gesture.
     *
     * @param {PointerEvent} event Lost-pointer-capture event.
     * @return {void}
     */
    function handle_selection_lost_pointer_capture(event) {
      if (selection_resize_state && selection_resize_state.pointer_id === event.pointerId) {
        restore_selection_resize(true);
      } else if ('drawing' === selection_state.phase && selection_state.pointer_id === event.pointerId) {
        cancel_selection(false);
      }
    }

    /**
     * Provide start/end selection through the focused Resource row.
     *
     * @param {KeyboardEvent} event Keyboard event.
     * @return {boolean} True when the event belonged to selection mechanics.
     */
    function handle_selection_keydown(event) {
      var track = event.target.closest('[data-wpbc-timeline-selection-track]');
      var handle = event.target.closest('[data-wpbc-timeline-selection-handle]');
      var resource_id;
      var cursor_index;
      var direction;
      if ('Escape' === event.key && 'idle' !== selection_state.phase) {
        event.preventDefault();
        if ('applying' === selection_state.phase) {
          return true;
        }
        if (selection_resize_state) {
          restore_selection_resize(true);
        } else {
          cancel_selection(true);
        }
        return true;
      }
      if (handle && handle_selection_handle_keydown(event, handle)) {
        return true;
      }
      if (!track || -1 === ['ArrowLeft', 'ArrowRight', 'Enter', ' '].indexOf(event.key)) {
        return false;
      }
      resource_id = Number(track.getAttribute('data-wpbc-timeline-resource-id'));
      cursor_index = Number(track.getAttribute('data-wpbc-timeline-selection-cursor'));
      if (!Number.isFinite(cursor_index) || 0 > cursor_index) {
        cursor_index = Math.max(0, Math.min(settings.axis.cells.length - 1, Math.floor(settings.axis.cells.length / 2)));
      }
      if ('ArrowLeft' === event.key || 'ArrowRight' === event.key) {
        event.preventDefault();
        direction = ('ArrowRight' === event.key ? 1 : -1) * (settings.is_rtl ? -1 : 1);
        cursor_index = Math.max(0, Math.min(settings.axis.cells.length - 1, cursor_index + direction));
        track.setAttribute('data-wpbc-timeline-selection-cursor', cursor_index);
        if (event.shiftKey) {
          if ('keyboard_start' !== selection_state.phase || selection_state.resource_id !== resource_id) {
            set_selection_range(resource_id, cursor_index - direction, cursor_index, 'keyboard_start');
            selection_state.anchor_index = cursor_index - direction;
          } else {
            set_selection_range(resource_id, selection_state.anchor_index, cursor_index, 'keyboard_start');
          }
        }
        Array.prototype.forEach.call(track.querySelectorAll('.wpbc_timeline__canvas_cell'), function (cell, cell_index) {
          cell.classList.toggle('is-selection-cursor', cell_index === cursor_index);
        });
        return true;
      }
      event.preventDefault();
      if ('keyboard_start' === selection_state.phase && selection_state.resource_id === resource_id) {
        selection_state.phase = 'draft';
        render_selection();
        request_selection_preview();
      } else {
        abort_selection_preview_request();
        set_selection_range(resource_id, cursor_index, cursor_index, 'keyboard_start');
        selection_state.anchor_index = cursor_index;
      }
      return true;
    }

    /**
     * Handle selection popover actions through Timeline's delegated click path.
     *
     * @param {MouseEvent} event Timeline click event.
     * @return {boolean} True when a selection action owned the event.
     */
    function handle_click(event) {
      var selection_cancel = event.target.closest('[data-wpbc-timeline-selection-cancel]');
      var selection_retry = event.target.closest('[data-wpbc-timeline-selection-retry]');
      var selection_block = event.target.closest('[data-wpbc-timeline-selection-block]');
      if (selection_cancel) {
        cancel_selection(true);
        return true;
      }
      if (selection_retry) {
        request_selection_preview();
        return true;
      }
      if (selection_block) {
        apply_selection_block(selection_block.getAttribute('data-wpbc-timeline-selection-block'));
        return true;
      }
      return false;
    }

    /**
     * Report whether a local empty-range draft currently exists.
     *
     * @return {boolean} True for every non-idle selection phase.
     */
    function is_active() {
      return 'idle' !== selection_state.phase;
    }

    /**
     * Report whether a boundary pointer gesture currently owns attention.
     *
     * @return {boolean} True while a start/end handle is being resized.
     */
    function is_resizing() {
      return Boolean(selection_resize_state);
    }

    /**
     * Initialize pointer ownership exactly once for this Timeline mount.
     *
     * @return {void}
     */
    function initialize() {
      if (!mount || is_initialized) {
        return;
      }
      is_initialized = true;
      mount.setAttribute('data-wpbc-timeline-empty-range-selection-ready', 'true');
      mount.addEventListener('pointerdown', handle_selection_pointer_down);
      mount.addEventListener('pointermove', handle_selection_pointer_move);
      mount.addEventListener('pointerup', handle_selection_pointer_up);
      mount.addEventListener('pointercancel', handle_selection_pointer_cancel);
      mount.addEventListener('lostpointercapture', handle_selection_lost_pointer_capture);
    }

    /**
     * Tear down requests, pointer capture, listeners, timers, and local state.
     *
     * @return {void}
     */
    function destroy() {
      var active_pointer_id = selection_resize_state ? selection_resize_state.pointer_id : selection_state.pointer_id;
      var selection_track = get_selection_track(selection_state.resource_id);
      if (!is_initialized) {
        return;
      }
      if (selection_track && null !== active_pointer_id && 'function' === typeof selection_track.hasPointerCapture && 'function' === typeof selection_track.releasePointerCapture && selection_track.hasPointerCapture(active_pointer_id)) {
        selection_track.releasePointerCapture(active_pointer_id);
      }
      mount.removeEventListener('pointerdown', handle_selection_pointer_down);
      mount.removeEventListener('pointermove', handle_selection_pointer_move);
      mount.removeEventListener('pointerup', handle_selection_pointer_up);
      mount.removeEventListener('pointercancel', handle_selection_pointer_cancel);
      mount.removeEventListener('lostpointercapture', handle_selection_lost_pointer_capture);
      mount.removeAttribute('data-wpbc-timeline-empty-range-selection-ready');
      is_initialized = false;
      if ('function' === typeof context.set_apply_loading) {
        context.set_apply_loading(false, '');
      }
      reset_selection_state();
      render_selection();
    }
    return {
      initialize: initialize,
      destroy: destroy,
      handle_click: handle_click,
      handle_keydown: handle_selection_keydown,
      is_active: is_active,
      is_resizing: is_resizing,
      consume_signed_action_context: consume_signed_action_context,
      cancel: cancel_selection,
      reset: function () {
        cancel_selection(false);
      },
      render: render_selection,
      position_popover: position_selection_popover
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_empty_range_selection_controller);
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9fb3V0L3RpbWVsaW5lLWVtcHR5LXJhbmdlLXNlbGVjdGlvbi5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwibW9kdWxlX2lkIiwiY3JlYXRlX2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyIiwiY29udGV4dCIsIm1vdW50Iiwic2V0dGluZ3MiLCJzZWxlY3Rpb25fcmVxdWVzdCIsInNlbGVjdGlvbl9yZXF1ZXN0X2dlbmVyYXRpb24iLCJzZWxlY3Rpb25fcHJldmlld190aW1lciIsInRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUiLCJzZWxlY3Rpb25fcmVzaXplX3N0YXRlIiwic2VsZWN0aW9uX3N0YXRlIiwiY3JlYXRlX2VtcHR5X3NlbGVjdGlvbl9zdGF0ZSIsImlzX2luaXRpYWxpemVkIiwicGhhc2UiLCJyZXNvdXJjZV9pZCIsImFuY2hvcl9pbmRleCIsInN0YXJ0X2luZGV4IiwiZW5kX2luZGV4Iiwic3RhcnRfYXQiLCJlbmRfYXQiLCJzdGFydF9lcG9jaCIsImVuZF9lcG9jaCIsInByZXZpZXciLCJlcnJvcl9tZXNzYWdlIiwicG9pbnRlcl9pZCIsImlzX2hvc3RfYWN0aXZlIiwiZ2V0X3RlbXBsYXRlIiwidGVtcGxhdGVfa2V5IiwiYW5ub3VuY2UiLCJtZXNzYWdlIiwiZ2V0X3NlbGVjdGlvbl9jZWxsX21pbnV0ZXMiLCJ2aWV3cyIsIm1ldGFkYXRhIiwiQXJyYXkiLCJpc0FycmF5IiwibWludXRlcyIsInNvbWUiLCJ2aWV3IiwiaWQiLCJheGlzIiwiTnVtYmVyIiwiY2VsbF9taW51dGVzIiwiZm9ybWF0X3NlbGVjdGlvbl9kdXJhdGlvbiIsImR1cmF0aW9uX21pbnV0ZXMiLCJNYXRoIiwibWF4Iiwicm91bmQiLCJkYXlzIiwiZmxvb3IiLCJyZW1haW5pbmdfbWludXRlcyIsImhvdXJzIiwibWludXRlX3JlbWFpbmRlciIsInBhcnRzIiwicHVzaCIsIlN0cmluZyIsImkxOG4iLCJzZWxlY3Rpb25fZGF5c19zaG9ydCIsInJlcGxhY2UiLCJzZWxlY3Rpb25faG91cnNfc2hvcnQiLCJsZW5ndGgiLCJzZWxlY3Rpb25fbWludXRlc19zaG9ydCIsImpvaW4iLCJnZXRfc2VsZWN0aW9uX3RyYWNrIiwidHJhY2tzIiwicXVlcnlTZWxlY3RvckFsbCIsIm1hdGNoZWRfdHJhY2siLCJwcm90b3R5cGUiLCJjYWxsIiwidHJhY2siLCJnZXRBdHRyaWJ1dGUiLCJnZXRfc2VsZWN0aW9uX2NlbGxfaW5kZXgiLCJjbGllbnRfeCIsImNlbGxzIiwiY2xvc2VzdF9pbmRleCIsImNsb3Nlc3RfZGlzdGFuY2UiLCJJbmZpbml0eSIsImNlbGwiLCJjZWxsX2luZGV4IiwicmVjdGFuZ2xlIiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiZGlzdGFuY2UiLCJsZWZ0IiwicmlnaHQiLCJhYnMiLCJ3aWR0aCIsIm1pbiIsInNldF9zZWxlY3Rpb25fcmFuZ2UiLCJmaXJzdF9pbmRleCIsImxhc3RfaW5kZXgiLCJzdGFydF9jZWxsIiwiZW5kX2NlbGwiLCJyZW5kZXJfc2VsZWN0aW9uIiwicG9zaXRpb25fc2VsZWN0aW9uX3BvcG92ZXIiLCJwb3BvdmVyIiwicXVlcnlTZWxlY3RvciIsImNhbnZhcyIsImNhbnZhc19ib2R5Iiwic2VsZWN0aW9uIiwicG9wb3Zlcl9yZWN0YW5nbGUiLCJjYW52YXNfcmVjdGFuZ2xlIiwiY2FudmFzX2JvZHlfcmVjdGFuZ2xlIiwic2VsZWN0aW9uX3JlY3RhbmdsZSIsInZpZXdwb3J0X3dpZHRoIiwidmlld3BvcnRfaGVpZ2h0IiwidmlzaWJsZV9pbmxpbmVfc3RhcnQiLCJ2aXNpYmxlX2lubGluZV9lbmQiLCJ2aXNpYmxlX2Jsb2NrX3N0YXJ0IiwidmlzaWJsZV9ibG9ja19lbmQiLCJhdmFpbGFibGVfYWJvdmUiLCJhdmFpbGFibGVfYmVsb3ciLCJwbGFjZW1lbnQiLCJwbGFjZW1lbnRfc3BhY2UiLCJzaGlmdCIsImlubmVyV2lkdGgiLCJkb2N1bWVudEVsZW1lbnQiLCJjbGllbnRXaWR0aCIsImlubmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0Iiwic3R5bGUiLCJzZXRQcm9wZXJ0eSIsInJlbW92ZVByb3BlcnR5Iiwic2V0QXR0cmlidXRlIiwidG9wIiwiYm90dG9tIiwiaGVpZ2h0IiwicmVjb25jaWxlX3NlbGVjdGlvbl93aXRoX2F4aXMiLCJwcmV2aW91c19zdGFydF9pbmRleCIsImluZGV4X3NoaWZ0IiwicmVzZXRfc2VsZWN0aW9uX3N0YXRlIiwiaG9zdHMiLCJlbmRfYm91bmRhcnlfY2VsbCIsImhvc3QiLCJnZW9tZXRyeSIsInNlbGVjdGlvbl90ZW1wbGF0ZSIsInBvcG92ZXJfdGVtcGxhdGUiLCJ0ZW1wbGF0ZV9idWZmZXIiLCJ2aWV3X21vZGVsIiwiZm9yRWFjaCIsImN1cnJlbnRfaG9zdCIsInRleHRDb250ZW50IiwiZ2V0X3NlZ21lbnRfZ2VvbWV0cnkiLCJvZmZzZXRfcGVyY2VudCIsIndpZHRoX3BlcmNlbnQiLCJjZW50ZXJfcGVyY2VudCIsImFjdGl2ZV9ib3VuZGFyeSIsImJvdW5kYXJ5IiwiZHVyYXRpb25fbGFiZWwiLCJhcmlhX2xhYmVsIiwic2VsZWN0aW9uX3ByZXZpZXciLCJzdGFydF9oYW5kbGUiLCJsYWJlbCIsInNlbGVjdGlvbl9zdGFydF9oYW5kbGUiLCJub3ciLCJ2YWx1ZV90ZXh0IiwiZW5kX2hhbmRsZSIsInNlbGVjdGlvbl9lbmRfaGFuZGxlIiwic3RhdGUiLCJjcmVhdGVFbGVtZW50IiwiaW5uZXJIVE1MIiwiZmlyc3RDaGlsZCIsImFwcGVuZENoaWxkIiwiaW5kZXhPZiIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImFib3J0X3NlbGVjdGlvbl9wcmV2aWV3X3JlcXVlc3QiLCJjbGVhclRpbWVvdXQiLCJhYm9ydCIsInNjaGVkdWxlX3NlbGVjdGlvbl9wcmV2aWV3IiwiZGVsYXlfbXMiLCJzZXRUaW1lb3V0IiwicmVxdWVzdF9zZWxlY3Rpb25fcHJldmlldyIsImZvY3VzX3NlbGVjdGlvbl9oYW5kbGUiLCJoYW5kbGUiLCJmb2N1cyIsImNhbmNlbF9zZWxlY3Rpb24iLCJzaG91bGRfYW5ub3VuY2UiLCJzZWxlY3Rpb25fY2FuY2VsbGVkIiwiY29uc3VtZV9zaWduZWRfYWN0aW9uX2NvbnRleHQiLCJhY3Rpb25faWQiLCJxdWVyeV9hcmciLCJ0b2tlbiIsImFjdGlvbiIsImFjdGlvbnMiLCJhY3Rpb25fdXJsIiwiYXV0aG9yaXplZCIsImVuYWJsZWQiLCJ1cmwiLCJ0ZXN0IiwiVVJMIiwibG9jYXRpb24iLCJocmVmIiwiZXJyb3IiLCJzZWFyY2hQYXJhbXMiLCJnZXQiLCJnZXRfbG9hZGVkX3NlbGVjdGlvbl9jb250ZXh0X3Rva2VucyIsImdldF9sb2FkZWRfY29udGV4dF90b2tlbnMiLCJ0cmFuc3BvcnQiLCJnZW5lcmF0aW9uIiwialF1ZXJ5IiwicHJldmlld19hY3Rpb24iLCJwcmV2aWV3X25vbmNlIiwic2VsZWN0aW9uX3JlYWR5IiwiYWpheCIsIm1ldGhvZCIsImRhdGFUeXBlIiwidGltZW91dCIsImdldF9yZXF1ZXN0X3RpbWVvdXRfbXMiLCJkYXRhIiwibm9uY2UiLCJsb2FkZWRfc3RhcnRfYXQiLCJsb2FkZWRfZW5kX2F0IiwibG9hZGVkX2NvbnRleHRfdG9rZW5zIiwicmV0dXJuX2NvbnRleHQiLCJnZXRfcmV0dXJuX2NvbnRleHQiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwiZmFpbCIsInJlcXVlc3QiLCJyZXF1ZXN0X3N0YXR1cyIsInJlc3BvbnNlSlNPTiIsImFsd2F5cyIsInNldF9zZWxlY3Rpb25fYm91bmRhcnkiLCJyZXF1ZXN0ZWRfaW5kZXgiLCJtYXhpbXVtX2luZGV4IiwiYm91bmRlZF9pbmRleCIsImJlZ2luX3NlbGVjdGlvbl9yZXNpemUiLCJldmVudCIsInBvaW50ZXJJZCIsInByZXZlbnREZWZhdWx0Iiwic3RvcFByb3BhZ2F0aW9uIiwic2V0UG9pbnRlckNhcHR1cmUiLCJyZXN0b3JlX3NlbGVjdGlvbl9yZXNpemUiLCJzaG91bGRfZm9jdXMiLCJwcmV2aW91c19zdGF0ZSIsInNob3VsZF9yZWxvYWRfcHJldmlldyIsImNvbXBsZXRlX3NlbGVjdGlvbl9yZXNpemUiLCJjaGFuZ2VkIiwiaGFuZGxlX3NlbGVjdGlvbl9oYW5kbGVfa2V5ZG93biIsInN1cHBvcnRlZF9rZXlzIiwiZGlyZWN0aW9uIiwia2V5IiwiaXNfcnRsIiwiYXBwbHlfc2VsZWN0aW9uX2Jsb2NrIiwibW9kZSIsImJsb2NrX3Rva2VuIiwiYXBwbHlfYWN0aW9uIiwiYXBwbHlfbm9uY2UiLCJzZXRfYXBwbHlfbG9hZGluZyIsImFwcGx5aW5nX2F2YWlsYWJpbGl0eSIsInJlZnJlc2hfYWZ0ZXJfYXBwbHkiLCJoYW5kbGVfc2VsZWN0aW9uX3BvaW50ZXJfZG93biIsInRhcmdldCIsImNsb3Nlc3QiLCJwb2ludGVyVHlwZSIsImJ1dHRvbiIsImNsaWVudFgiLCJzdGFydF94Iiwic3RhcnRfeSIsImNsaWVudFkiLCJtb3ZlZCIsImhhbmRsZV9zZWxlY3Rpb25fcG9pbnRlcl9tb3ZlIiwiaGFuZGxlX3NlbGVjdGlvbl9wb2ludGVyX3VwIiwiY2FuZGlkYXRlIiwiaGFuZGxlX3NlbGVjdGlvbl9wb2ludGVyX2NhbmNlbCIsImhhbmRsZV9zZWxlY3Rpb25fbG9zdF9wb2ludGVyX2NhcHR1cmUiLCJoYW5kbGVfc2VsZWN0aW9uX2tleWRvd24iLCJjdXJzb3JfaW5kZXgiLCJpc0Zpbml0ZSIsInNoaWZ0S2V5IiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwiaGFuZGxlX2NsaWNrIiwic2VsZWN0aW9uX2NhbmNlbCIsInNlbGVjdGlvbl9yZXRyeSIsInNlbGVjdGlvbl9ibG9jayIsImlzX2FjdGl2ZSIsImlzX3Jlc2l6aW5nIiwiQm9vbGVhbiIsImluaXRpYWxpemUiLCJhZGRFdmVudExpc3RlbmVyIiwiZGVzdHJveSIsImFjdGl2ZV9wb2ludGVyX2lkIiwic2VsZWN0aW9uX3RyYWNrIiwiaGFzUG9pbnRlckNhcHR1cmUiLCJyZWxlYXNlUG9pbnRlckNhcHR1cmUiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwicmVtb3ZlQXR0cmlidXRlIiwiaGFuZGxlX2tleWRvd24iLCJjYW5jZWwiLCJyZXNldCIsInJlbmRlciIsInBvc2l0aW9uX3BvcG92ZXIiLCJ3cGJjX3RpbWVsaW5lX21vZHVsZXMiLCJyZWdpc3Rlcl9mYWN0b3J5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9fc3JjL3RpbWVsaW5lLWVtcHR5LXJhbmdlLXNlbGVjdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRpbWVsaW5lIGVtcHR5LXJhbmdlIHNlbGVjdGlvbiBzdGF0ZSBtYWNoaW5lIGFuZCBBdmFpbGFiaWxpdHkgYWN0aW9ucy5cbiAqXG4gKiBUaGUgbW9kdWxlIG93bnMgbG9jYWwgcG9pbnRlciwgdG91Y2gsIGtleWJvYXJkLCByZXNpemUsIHByZXZpZXcsIFJldHJ5LFxuICogQmxvY2svVW5ibG9jaywgZm9jdXMtcmVzdG9yYXRpb24sIGFuZCBzdGFsZS1yZXNwb25zZSBiZWhhdmlvci4gVGltZWxpbmUgb3duc1xuICogdGhlIHN1cnJvdW5kaW5nIGF4aXMvd2luZG93IGNhY2hlIGFuZCBzdXBwbGllcyBuYXJyb3cgY2FsbGJhY2tzOyB0aGUgc2VydmVyXG4gKiByZW1haW5zIGF1dGhvcml0YXRpdmUgZm9yIHZhbGlkYXRpb24sIGF1dGhvcml6YXRpb24sIGFuZCBwZXJzaXN0ZW5jZS5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKiBAc2luY2UgICAxMi4wLjBcbiAqL1xuKCBmdW5jdGlvbiAoIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2lkID0gJ2VtcHR5X3JhbmdlX3NlbGVjdGlvbic7XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgZW1wdHktcmFuZ2Ugc2VsZWN0aW9uIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IFRpbWVsaW5lLW93bmVkIG1vdW50LCBzZXR0aW5ncywgYW5kIGJvdW5kZWQgY2FsbGJhY2tzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEVtcHR5LXJhbmdlIHNlbGVjdGlvbiBsaWZlY3ljbGUgYW5kIGRlbGVnYXRpb24gQVBJLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyKCBjb250ZXh0ICkge1xuXHRcdHZhciBtb3VudCA9IGNvbnRleHQubW91bnQgfHwgbnVsbDtcblx0XHR2YXIgc2V0dGluZ3MgPSBjb250ZXh0LnNldHRpbmdzIHx8IHt9O1xuXHRcdHZhciBzZWxlY3Rpb25fcmVxdWVzdCA9IG51bGw7XG5cdFx0dmFyIHNlbGVjdGlvbl9yZXF1ZXN0X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBzZWxlY3Rpb25fcHJldmlld190aW1lciA9IDA7XG5cdFx0dmFyIHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUgPSBudWxsO1xuXHRcdHZhciBzZWxlY3Rpb25fcmVzaXplX3N0YXRlID0gbnVsbDtcblx0XHR2YXIgc2VsZWN0aW9uX3N0YXRlID0gY3JlYXRlX2VtcHR5X3NlbGVjdGlvbl9zdGF0ZSgpO1xuXHRcdHZhciBpc19pbml0aWFsaXplZCA9IGZhbHNlO1xuXG5cdFx0LyoqXG5cdFx0ICogQ3JlYXRlIHRoZSBjYW5vbmljYWwgZW1wdHkgbG9jYWwtc2VsZWN0aW9uIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBFbXB0eSBzZWxlY3Rpb24gc3RhdGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY3JlYXRlX2VtcHR5X3NlbGVjdGlvbl9zdGF0ZSgpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHBoYXNlOiAnaWRsZScsXG5cdFx0XHRcdHJlc291cmNlX2lkOiAwLFxuXHRcdFx0XHRhbmNob3JfaW5kZXg6IC0xLFxuXHRcdFx0XHRzdGFydF9pbmRleDogLTEsXG5cdFx0XHRcdGVuZF9pbmRleDogLTEsXG5cdFx0XHRcdHN0YXJ0X2F0OiAnJyxcblx0XHRcdFx0ZW5kX2F0OiAnJyxcblx0XHRcdFx0c3RhcnRfZXBvY2g6IDAsXG5cdFx0XHRcdGVuZF9lcG9jaDogMCxcblx0XHRcdFx0cHJldmlldzogbnVsbCxcblx0XHRcdFx0ZXJyb3JfbWVzc2FnZTogJycsXG5cdFx0XHRcdHBvaW50ZXJfaWQ6IG51bGxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IHdoZXRoZXIgdGhlIFRpbWVsaW5lIGhvc3QgaXMgc3RpbGwgYWN0aXZlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGlsZSBjYWxsYmFja3MgYW5kIGZvY3VzIHJlc3RvcmF0aW9uIGFyZSBzYWZlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGlzX2hvc3RfYWN0aXZlKCkge1xuXHRcdFx0cmV0dXJuIGlzX2luaXRpYWxpemVkICYmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNvbnRleHQuaXNfaG9zdF9hY3RpdmUgfHwgY29udGV4dC5pc19ob3N0X2FjdGl2ZSgpICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBzZXJ2ZXItYWxsb3ctbGlzdGVkIFRpbWVsaW5lIHRlbXBsYXRlIHJlbmRlcmVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX2tleSBTdGFibGUgdGVtcGxhdGUtcGFjayBrZXkuXG5cdFx0ICogQHJldHVybiB7RnVuY3Rpb258bnVsbH0gV29yZFByZXNzIHRlbXBsYXRlIHJlbmRlcmVyIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3RlbXBsYXRlKCB0ZW1wbGF0ZV9rZXkgKSB7XG5cdFx0XHRyZXR1cm4gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQuZ2V0X3RlbXBsYXRlID8gY29udGV4dC5nZXRfdGVtcGxhdGUoIHRlbXBsYXRlX2tleSApIDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBbm5vdW5jZSBvbmUgc2VsZWN0aW9uIGxpZmVjeWNsZSBtZXNzYWdlIHRocm91Z2ggdGhlIFRpbWVsaW5lIGxpdmUgcmVnaW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgQXV0aG9yaXplZCBsb2NhbGl6ZWQgbWVzc2FnZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFubm91bmNlKCBtZXNzYWdlICkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5hbm5vdW5jZSApIHtcblx0XHRcdFx0Y29udGV4dC5hbm5vdW5jZSggbWVzc2FnZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgYWN0aXZlIGF4aXMgY2VsbCBkdXJhdGlvbiBpbiBtaW51dGVzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBQb3NpdGl2ZSBhbGxvdy1saXN0ZWQgY2VsbCBkdXJhdGlvbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX2NlbGxfbWludXRlcygpIHtcblx0XHRcdHZhciB2aWV3cyA9IHNldHRpbmdzLm1ldGFkYXRhICYmIEFycmF5LmlzQXJyYXkoIHNldHRpbmdzLm1ldGFkYXRhLnZpZXdzICkgPyBzZXR0aW5ncy5tZXRhZGF0YS52aWV3cyA6IFtdO1xuXHRcdFx0dmFyIG1pbnV0ZXMgPSAxNDQwO1xuXG5cdFx0XHR2aWV3cy5zb21lKCBmdW5jdGlvbiAoIHZpZXcgKSB7XG5cdFx0XHRcdGlmICggdmlldyAmJiB2aWV3LmlkID09PSBzZXR0aW5ncy5heGlzLnZpZXcgKSB7XG5cdFx0XHRcdFx0bWludXRlcyA9IE51bWJlciggdmlldy5jZWxsX21pbnV0ZXMgKSB8fCBtaW51dGVzO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIG1pbnV0ZXM7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9ybWF0IGEgbG9jYWwgZHJhZnQgZHVyYXRpb24gYmVmb3JlIHRoZSBzZXJ2ZXIgcmV0dXJucyBsb2NhbGl6ZWQgZGV0YWlsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IG1pbnV0ZXMgRHVyYXRpb24gaW4gbWludXRlcy5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IENvbXBhY3QgZHVyYXRpb24gbGFiZWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZm9ybWF0X3NlbGVjdGlvbl9kdXJhdGlvbiggbWludXRlcyApIHtcblx0XHRcdHZhciBkdXJhdGlvbl9taW51dGVzID0gTWF0aC5tYXgoIDEsIE1hdGgucm91bmQoIE51bWJlciggbWludXRlcyApIHx8IDAgKSApO1xuXHRcdFx0dmFyIGRheXMgPSBNYXRoLmZsb29yKCBkdXJhdGlvbl9taW51dGVzIC8gMTQ0MCApO1xuXHRcdFx0dmFyIHJlbWFpbmluZ19taW51dGVzID0gZHVyYXRpb25fbWludXRlcyAlIDE0NDA7XG5cdFx0XHR2YXIgaG91cnMgPSBNYXRoLmZsb29yKCByZW1haW5pbmdfbWludXRlcyAvIDYwICk7XG5cdFx0XHR2YXIgbWludXRlX3JlbWFpbmRlciA9IHJlbWFpbmluZ19taW51dGVzICUgNjA7XG5cdFx0XHR2YXIgcGFydHMgPSBbXTtcblxuXHRcdFx0aWYgKCBkYXlzICkge1xuXHRcdFx0XHRwYXJ0cy5wdXNoKCBTdHJpbmcoIHNldHRpbmdzLmkxOG4uc2VsZWN0aW9uX2RheXNfc2hvcnQgfHwgJyVzIGQnICkucmVwbGFjZSggJyVzJywgZGF5cyApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGhvdXJzICkge1xuXHRcdFx0XHRwYXJ0cy5wdXNoKCBTdHJpbmcoIHNldHRpbmdzLmkxOG4uc2VsZWN0aW9uX2hvdXJzX3Nob3J0IHx8ICclcyBoJyApLnJlcGxhY2UoICclcycsIGhvdXJzICkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggbWludXRlX3JlbWFpbmRlciB8fCAhIHBhcnRzLmxlbmd0aCApIHtcblx0XHRcdFx0cGFydHMucHVzaCggU3RyaW5nKCBzZXR0aW5ncy5pMThuLnNlbGVjdGlvbl9taW51dGVzX3Nob3J0IHx8ICclcyBtaW4nICkucmVwbGFjZSggJyVzJywgbWludXRlX3JlbWFpbmRlciApICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBwYXJ0cy5qb2luKCAnICcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBMb2NhdGUgYSByZW5kZXJlZCBzZWxlY3Rpb24gdHJhY2sgYnkgYXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge0VsZW1lbnR8bnVsbH0gVHJhY2sgZWxlbWVudCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9zZWxlY3Rpb25fdHJhY2soIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIHRyYWNrcyA9IG1vdW50ID8gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VsZWN0aW9uLXRyYWNrXScgKSA6IFtdO1xuXHRcdFx0dmFyIG1hdGNoZWRfdHJhY2sgPSBudWxsO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc29tZS5jYWxsKCB0cmFja3MsIGZ1bmN0aW9uICggdHJhY2sgKSB7XG5cdFx0XHRcdGlmICggTnVtYmVyKCB0cmFjay5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtaWQnICkgKSA9PT0gTnVtYmVyKCByZXNvdXJjZV9pZCApICkge1xuXHRcdFx0XHRcdG1hdGNoZWRfdHJhY2sgPSB0cmFjaztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBtYXRjaGVkX3RyYWNrO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIExvY2F0ZSB0aGUgcGh5c2ljYWwgY2VsbCB1bmRlciBhIHBvaW50ZXIgd2l0aG91dCBhc3N1bWluZyBSVEwgc2Nyb2xsIHNpZ25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSB0cmFjayBSZXNvdXJjZSB0cmFjay5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gY2xpZW50X3ggUG9pbnRlciB2aWV3cG9ydCBYIGNvb3JkaW5hdGUuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBCb3VuZGVkIGNlbGwgaW5kZXguXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGlvbl9jZWxsX2luZGV4KCB0cmFjaywgY2xpZW50X3ggKSB7XG5cdFx0XHR2YXIgY2VsbHMgPSB0cmFjay5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdGltZWxpbmVfX2NhbnZhc19jZWxsJyApO1xuXHRcdFx0dmFyIGNsb3Nlc3RfaW5kZXggPSAwO1xuXHRcdFx0dmFyIGNsb3Nlc3RfZGlzdGFuY2UgPSBJbmZpbml0eTtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNvbWUuY2FsbCggY2VsbHMsIGZ1bmN0aW9uICggY2VsbCwgY2VsbF9pbmRleCApIHtcblx0XHRcdFx0dmFyIHJlY3RhbmdsZSA9IGNlbGwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdHZhciBkaXN0YW5jZTtcblxuXHRcdFx0XHRpZiAoIGNsaWVudF94ID49IHJlY3RhbmdsZS5sZWZ0ICYmIGNsaWVudF94IDw9IHJlY3RhbmdsZS5yaWdodCApIHtcblx0XHRcdFx0XHRjbG9zZXN0X2luZGV4ID0gY2VsbF9pbmRleDtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkaXN0YW5jZSA9IE1hdGguYWJzKCBjbGllbnRfeCAtICggcmVjdGFuZ2xlLmxlZnQgKyByZWN0YW5nbGUud2lkdGggLyAyICkgKTtcblx0XHRcdFx0aWYgKCBkaXN0YW5jZSA8IGNsb3Nlc3RfZGlzdGFuY2UgKSB7XG5cdFx0XHRcdFx0Y2xvc2VzdF9kaXN0YW5jZSA9IGRpc3RhbmNlO1xuXHRcdFx0XHRcdGNsb3Nlc3RfaW5kZXggPSBjZWxsX2luZGV4O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIE1hdGgubWF4KCAwLCBNYXRoLm1pbiggTWF0aC5tYXgoIDAsIGNlbGxzLmxlbmd0aCAtIDEgKSwgY2xvc2VzdF9pbmRleCApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVXBkYXRlIHRoZSBsb2NhbCBoYWxmLW9wZW4gZHJhZnQgZnJvbSB0d28gaW5jbHVzaXZlIGNlbGwgaW5kZXhlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIFJlc291cmNlIElEIGZyb20gdGhlIHJlbmRlcmVkIERUTy5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZmlyc3RfaW5kZXggRmlyc3Qgc2VsZWN0ZWQgY2VsbC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbGFzdF9pbmRleCBMYXN0IHNlbGVjdGVkIGNlbGwuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHBoYXNlIFNlbGVjdGlvbiBzdGF0ZSBwaGFzZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGF4aXMgYm91bmRhcmllcyB3ZXJlIGF2YWlsYWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfc2VsZWN0aW9uX3JhbmdlKCByZXNvdXJjZV9pZCwgZmlyc3RfaW5kZXgsIGxhc3RfaW5kZXgsIHBoYXNlICkge1xuXHRcdFx0dmFyIGNlbGxzID0gc2V0dGluZ3MuYXhpcyAmJiBBcnJheS5pc0FycmF5KCBzZXR0aW5ncy5heGlzLmNlbGxzICkgPyBzZXR0aW5ncy5heGlzLmNlbGxzIDogW107XG5cdFx0XHR2YXIgc3RhcnRfaW5kZXggPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIGZpcnN0X2luZGV4LCBsYXN0X2luZGV4ICkgKTtcblx0XHRcdHZhciBlbmRfaW5kZXggPSBNYXRoLm1pbiggY2VsbHMubGVuZ3RoIC0gMSwgTWF0aC5tYXgoIGZpcnN0X2luZGV4LCBsYXN0X2luZGV4ICkgKTtcblx0XHRcdHZhciBzdGFydF9jZWxsID0gY2VsbHNbIHN0YXJ0X2luZGV4IF07XG5cdFx0XHR2YXIgZW5kX2NlbGwgPSBjZWxsc1sgZW5kX2luZGV4IF07XG5cblx0XHRcdGlmICggISBzdGFydF9jZWxsIHx8ICEgZW5kX2NlbGwgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5waGFzZSA9IHBoYXNlO1xuXHRcdFx0c2VsZWN0aW9uX3N0YXRlLnJlc291cmNlX2lkID0gTnVtYmVyKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0c2VsZWN0aW9uX3N0YXRlLnN0YXJ0X2luZGV4ID0gc3RhcnRfaW5kZXg7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUuZW5kX2luZGV4ID0gZW5kX2luZGV4O1xuXHRcdFx0c2VsZWN0aW9uX3N0YXRlLnN0YXJ0X2F0ID0gc3RhcnRfY2VsbC5zdGFydF9hdDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5lbmRfYXQgPSBlbmRfY2VsbC5lbmRfYXQ7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUuc3RhcnRfZXBvY2ggPSBOdW1iZXIoIHN0YXJ0X2NlbGwuc3RhcnRfZXBvY2ggKTtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5lbmRfZXBvY2ggPSBOdW1iZXIoIGVuZF9jZWxsLmVuZF9lcG9jaCApO1xuXHRcdFx0c2VsZWN0aW9uX3N0YXRlLnByZXZpZXcgPSBudWxsO1xuXHRcdFx0c2VsZWN0aW9uX3N0YXRlLmVycm9yX21lc3NhZ2UgPSAnJztcblx0XHRcdHJlbmRlcl9zZWxlY3Rpb24oKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEtlZXAgdGhlIHNlbGVjdGlvbiBwb3BvdmVyIGluc2lkZSB0aGUgdmlzaWJsZSBUaW1lbGluZSBjYW52YXMuXG5cdFx0ICpcblx0XHQgKiBUaGUgcG9wb3ZlciBpcyByb3ctb3duZWQgc28gaXQgc2Nyb2xscyBob3Jpem9udGFsbHkgd2l0aCB0aGUgc2VsZWN0ZWRcblx0XHQgKiByYW5nZS4gVGhlIGNhbnZhcyBjbGlwcyB2ZXJ0aWNhbCBvdmVyZmxvdywgdGhlcmVmb3JlIHRoZSBwcmVmZXJyZWRcblx0XHQgKiBibG9jayBwbGFjZW1lbnQgbXVzdCBiZSBzZWxlY3RlZCBhZ2FpbnN0IHRoZSB2aXNpYmxlIGNhbnZhcyBib2R5IGFuZFxuXHRcdCAqIHZpZXdwb3J0IGluc3RlYWQgb2YgYWx3YXlzIG9wZW5pbmcgYmVsb3cgdGhlIHNlbGVjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcG9zaXRpb25fc2VsZWN0aW9uX3BvcG92ZXIoKSB7XG5cdFx0XHR2YXIgcG9wb3ZlciA9IG1vdW50ID8gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VsZWN0aW9uLXBvcG92ZXJdJyApIDogbnVsbDtcblx0XHRcdHZhciBjYW52YXMgPSBtb3VudCA/IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWNhbnZhc10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGNhbnZhc19ib2R5ID0gY2FudmFzID8gY2FudmFzLnF1ZXJ5U2VsZWN0b3IoICcud3BiY190aW1lbGluZV9fY2FudmFzX2JvZHknICkgOiBudWxsO1xuXHRcdFx0dmFyIHNlbGVjdGlvbiA9IG1vdW50ID8gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VsZWN0aW9uXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcG9wb3Zlcl9yZWN0YW5nbGU7XG5cdFx0XHR2YXIgY2FudmFzX3JlY3RhbmdsZTtcblx0XHRcdHZhciBjYW52YXNfYm9keV9yZWN0YW5nbGU7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX3JlY3RhbmdsZTtcblx0XHRcdHZhciB2aWV3cG9ydF93aWR0aDtcblx0XHRcdHZhciB2aWV3cG9ydF9oZWlnaHQ7XG5cdFx0XHR2YXIgdmlzaWJsZV9pbmxpbmVfc3RhcnQ7XG5cdFx0XHR2YXIgdmlzaWJsZV9pbmxpbmVfZW5kO1xuXHRcdFx0dmFyIHZpc2libGVfYmxvY2tfc3RhcnQ7XG5cdFx0XHR2YXIgdmlzaWJsZV9ibG9ja19lbmQ7XG5cdFx0XHR2YXIgYXZhaWxhYmxlX2Fib3ZlO1xuXHRcdFx0dmFyIGF2YWlsYWJsZV9iZWxvdztcblx0XHRcdHZhciBwbGFjZW1lbnQgPSAnYmVsb3cnO1xuXHRcdFx0dmFyIHBsYWNlbWVudF9zcGFjZSA9IDA7XG5cdFx0XHR2YXIgc2hpZnQgPSAwO1xuXG5cdFx0XHRpZiAoICEgcG9wb3ZlciB8fCAhIGNhbnZhcyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmlld3BvcnRfd2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aCB8fCAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCA/IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCA6IDAgKTtcblx0XHRcdHZpZXdwb3J0X2hlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodCB8fCAoIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCA/IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgOiAwICk7XG5cdFx0XHRwb3BvdmVyLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1wb3BvdmVyLXNoaWZ0JywgJzBweCcgKTtcblx0XHRcdHBvcG92ZXIuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtc2VsZWN0aW9uLXBvcG92ZXItbWF4LWJsb2NrLXNpemUnICk7XG5cdFx0XHRwb3BvdmVyLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24tcG9wb3Zlci1wbGFjZW1lbnQnLCBwbGFjZW1lbnQgKTtcblx0XHRcdHBvcG92ZXJfcmVjdGFuZ2xlID0gcG9wb3Zlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdGNhbnZhc19yZWN0YW5nbGUgPSBjYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRjYW52YXNfYm9keV9yZWN0YW5nbGUgPSBjYW52YXNfYm9keSA/IGNhbnZhc19ib2R5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpIDogY2FudmFzX3JlY3RhbmdsZTtcblx0XHRcdHNlbGVjdGlvbl9yZWN0YW5nbGUgPSBzZWxlY3Rpb24gPyBzZWxlY3Rpb24uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkgOiBudWxsO1xuXHRcdFx0dmlzaWJsZV9pbmxpbmVfc3RhcnQgPSBNYXRoLm1heCggY2FudmFzX3JlY3RhbmdsZS5sZWZ0LCA4ICk7XG5cdFx0XHR2aXNpYmxlX2lubGluZV9lbmQgPSBNYXRoLm1pbiggY2FudmFzX3JlY3RhbmdsZS5yaWdodCwgdmlld3BvcnRfd2lkdGggfHwgY2FudmFzX3JlY3RhbmdsZS5yaWdodCApIC0gODtcblx0XHRcdHZpc2libGVfYmxvY2tfc3RhcnQgPSBNYXRoLm1heCggY2FudmFzX3JlY3RhbmdsZS50b3AsIGNhbnZhc19ib2R5X3JlY3RhbmdsZS50b3AsIDggKTtcblx0XHRcdHZpc2libGVfYmxvY2tfZW5kID0gTWF0aC5taW4oIGNhbnZhc19yZWN0YW5nbGUuYm90dG9tLCBjYW52YXNfYm9keV9yZWN0YW5nbGUuYm90dG9tLCB2aWV3cG9ydF9oZWlnaHQgfHwgY2FudmFzX3JlY3RhbmdsZS5ib3R0b20gKSAtIDg7XG5cblx0XHRcdGlmICggc2VsZWN0aW9uX3JlY3RhbmdsZSAmJiB2aXNpYmxlX2Jsb2NrX2VuZCA+IHZpc2libGVfYmxvY2tfc3RhcnQgKSB7XG5cdFx0XHRcdGF2YWlsYWJsZV9hYm92ZSA9IE1hdGgubWF4KCAwLCBzZWxlY3Rpb25fcmVjdGFuZ2xlLnRvcCAtIHZpc2libGVfYmxvY2tfc3RhcnQgLSA4ICk7XG5cdFx0XHRcdGF2YWlsYWJsZV9iZWxvdyA9IE1hdGgubWF4KCAwLCB2aXNpYmxlX2Jsb2NrX2VuZCAtIHNlbGVjdGlvbl9yZWN0YW5nbGUuYm90dG9tIC0gOCApO1xuXHRcdFx0XHRpZiAoIGF2YWlsYWJsZV9iZWxvdyA8IHBvcG92ZXJfcmVjdGFuZ2xlLmhlaWdodCAmJiBhdmFpbGFibGVfYWJvdmUgPiBhdmFpbGFibGVfYmVsb3cgKSB7XG5cdFx0XHRcdFx0cGxhY2VtZW50ID0gJ2Fib3ZlJztcblx0XHRcdFx0fVxuXHRcdFx0XHRwbGFjZW1lbnRfc3BhY2UgPSAnYWJvdmUnID09PSBwbGFjZW1lbnQgPyBhdmFpbGFibGVfYWJvdmUgOiBhdmFpbGFibGVfYmVsb3c7XG5cdFx0XHRcdHBvcG92ZXIuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1wb3BvdmVyLXBsYWNlbWVudCcsIHBsYWNlbWVudCApO1xuXHRcdFx0XHRpZiAoIHBsYWNlbWVudF9zcGFjZSA8IHBvcG92ZXJfcmVjdGFuZ2xlLmhlaWdodCApIHtcblx0XHRcdFx0XHRwb3BvdmVyLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1wb3BvdmVyLW1heC1ibG9jay1zaXplJywgTWF0aC5tYXgoIDgwLCBNYXRoLmZsb29yKCBwbGFjZW1lbnRfc3BhY2UgKSApICsgJ3B4JyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHBvcG92ZXJfcmVjdGFuZ2xlID0gcG9wb3Zlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdGlmICggcG9wb3Zlcl9yZWN0YW5nbGUubGVmdCA8IHZpc2libGVfaW5saW5lX3N0YXJ0ICkge1xuXHRcdFx0XHRzaGlmdCArPSB2aXNpYmxlX2lubGluZV9zdGFydCAtIHBvcG92ZXJfcmVjdGFuZ2xlLmxlZnQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBvcG92ZXJfcmVjdGFuZ2xlLnJpZ2h0ICsgc2hpZnQgPiB2aXNpYmxlX2lubGluZV9lbmQgKSB7XG5cdFx0XHRcdHNoaWZ0IC09IHBvcG92ZXJfcmVjdGFuZ2xlLnJpZ2h0ICsgc2hpZnQgLSB2aXNpYmxlX2lubGluZV9lbmQ7XG5cdFx0XHR9XG5cdFx0XHRwb3BvdmVyLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1wb3BvdmVyLXNoaWZ0Jywgc2hpZnQgKyAncHgnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmViYXNlIGFuIGFjdGl2ZSBzZWxlY3Rpb24gb250byB0aGUgY3VycmVudCBhdXRob3JpdGF0aXZlIGF4aXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHNlbGVjdGlvbiBpcyBpZGxlIG9yIHZhbGlkIG9uIHRoaXMgYXhpcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWNvbmNpbGVfc2VsZWN0aW9uX3dpdGhfYXhpcygpIHtcblx0XHRcdHZhciBjZWxscyA9IHNldHRpbmdzLmF4aXMgJiYgQXJyYXkuaXNBcnJheSggc2V0dGluZ3MuYXhpcy5jZWxscyApID8gc2V0dGluZ3MuYXhpcy5jZWxscyA6IFtdO1xuXHRcdFx0dmFyIHByZXZpb3VzX3N0YXJ0X2luZGV4ID0gTnVtYmVyKCBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfaW5kZXggKTtcblx0XHRcdHZhciBzdGFydF9pbmRleCA9IC0xO1xuXHRcdFx0dmFyIGVuZF9pbmRleCA9IC0xO1xuXHRcdFx0dmFyIGluZGV4X3NoaWZ0O1xuXG5cdFx0XHRpZiAoICdpZGxlJyA9PT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggISBjZWxscy5sZW5ndGggfHwgISBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfZXBvY2ggfHwgc2VsZWN0aW9uX3N0YXRlLmVuZF9lcG9jaCA8PSBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfZXBvY2ggKSB7XG5cdFx0XHRcdHJlc2V0X3NlbGVjdGlvbl9zdGF0ZSgpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRjZWxscy5zb21lKCBmdW5jdGlvbiAoIGNlbGwsIGNlbGxfaW5kZXggKSB7XG5cdFx0XHRcdGlmICggTnVtYmVyKCBjZWxsLnN0YXJ0X2Vwb2NoICkgPT09IE51bWJlciggc2VsZWN0aW9uX3N0YXRlLnN0YXJ0X2Vwb2NoICkgKSB7XG5cdFx0XHRcdFx0c3RhcnRfaW5kZXggPSBjZWxsX2luZGV4O1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gKTtcblx0XHRcdGNlbGxzLnNvbWUoIGZ1bmN0aW9uICggY2VsbCwgY2VsbF9pbmRleCApIHtcblx0XHRcdFx0aWYgKCBOdW1iZXIoIGNlbGwuZW5kX2Vwb2NoICkgPT09IE51bWJlciggc2VsZWN0aW9uX3N0YXRlLmVuZF9lcG9jaCApICkge1xuXHRcdFx0XHRcdGVuZF9pbmRleCA9IGNlbGxfaW5kZXg7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCAwID4gc3RhcnRfaW5kZXggfHwgc3RhcnRfaW5kZXggPiBlbmRfaW5kZXggKSB7XG5cdFx0XHRcdHJlc2V0X3NlbGVjdGlvbl9zdGF0ZSgpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpbmRleF9zaGlmdCA9IDAgPD0gcHJldmlvdXNfc3RhcnRfaW5kZXggPyBzdGFydF9pbmRleCAtIHByZXZpb3VzX3N0YXJ0X2luZGV4IDogMDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5zdGFydF9pbmRleCA9IHN0YXJ0X2luZGV4O1xuXHRcdFx0c2VsZWN0aW9uX3N0YXRlLmVuZF9pbmRleCA9IGVuZF9pbmRleDtcblx0XHRcdGlmICggMCA8PSBzZWxlY3Rpb25fc3RhdGUuYW5jaG9yX2luZGV4ICkge1xuXHRcdFx0XHRzZWxlY3Rpb25fc3RhdGUuYW5jaG9yX2luZGV4ID0gTWF0aC5tYXgoIHN0YXJ0X2luZGV4LCBNYXRoLm1pbiggZW5kX2luZGV4LCBzZWxlY3Rpb25fc3RhdGUuYW5jaG9yX2luZGV4ICsgaW5kZXhfc2hpZnQgKSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgdGhlIGxvY2FsIHNlbGVjdGlvbiBpbnRvIGl0cyBSZXNvdXJjZSByb3cgb25seS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3NlbGVjdGlvbigpIHtcblx0XHRcdHZhciBob3N0cyA9IG1vdW50ID8gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VsZWN0aW9uLWhvc3RdJyApIDogW107XG5cdFx0XHR2YXIgY2VsbHMgPSBzZXR0aW5ncy5heGlzICYmIEFycmF5LmlzQXJyYXkoIHNldHRpbmdzLmF4aXMuY2VsbHMgKSA/IHNldHRpbmdzLmF4aXMuY2VsbHMgOiBbXTtcblx0XHRcdHZhciBzdGFydF9jZWxsO1xuXHRcdFx0dmFyIGVuZF9jZWxsO1xuXHRcdFx0dmFyIGVuZF9ib3VuZGFyeV9jZWxsO1xuXHRcdFx0dmFyIHRyYWNrO1xuXHRcdFx0dmFyIGhvc3Q7XG5cdFx0XHR2YXIgZ2VvbWV0cnk7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX3RlbXBsYXRlO1xuXHRcdFx0dmFyIHBvcG92ZXJfdGVtcGxhdGU7XG5cdFx0XHR2YXIgdGVtcGxhdGVfYnVmZmVyO1xuXHRcdFx0dmFyIGR1cmF0aW9uX21pbnV0ZXM7XG5cdFx0XHR2YXIgdmlld19tb2RlbDtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggaG9zdHMsIGZ1bmN0aW9uICggY3VycmVudF9ob3N0ICkge1xuXHRcdFx0XHRjdXJyZW50X2hvc3QudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdH0gKTtcblx0XHRcdGlmICggJ2lkbGUnID09PSBzZWxlY3Rpb25fc3RhdGUucGhhc2UgfHwgISBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQgfHwgISBjZWxscy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZWNvbmNpbGVfc2VsZWN0aW9uX3dpdGhfYXhpcygpICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzdGFydF9jZWxsID0gY2VsbHNbIHNlbGVjdGlvbl9zdGF0ZS5zdGFydF9pbmRleCBdO1xuXHRcdFx0ZW5kX2NlbGwgPSBjZWxsc1sgc2VsZWN0aW9uX3N0YXRlLmVuZF9pbmRleCBdO1xuXHRcdFx0aWYgKCAhIHN0YXJ0X2NlbGwgfHwgISBlbmRfY2VsbCApIHtcblx0XHRcdFx0cmVzZXRfc2VsZWN0aW9uX3N0YXRlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyYWNrID0gZ2V0X3NlbGVjdGlvbl90cmFjayggc2VsZWN0aW9uX3N0YXRlLnJlc291cmNlX2lkICk7XG5cdFx0XHRob3N0ID0gdHJhY2sgPyB0cmFjay5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24taG9zdF0nICkgOiBudWxsO1xuXHRcdFx0aWYgKCAhIGhvc3QgfHwgc2VsZWN0aW9uX3N0YXRlLnN0YXJ0X2Vwb2NoIDwgTnVtYmVyKCBzZXR0aW5ncy5heGlzLnN0YXJ0X2Vwb2NoICkgfHwgc2VsZWN0aW9uX3N0YXRlLmVuZF9lcG9jaCA+IE51bWJlciggc2V0dGluZ3MuYXhpcy5lbmRfZXBvY2ggKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Z2VvbWV0cnkgPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5nZXRfc2VnbWVudF9nZW9tZXRyeVxuXHRcdFx0XHQ/IGNvbnRleHQuZ2V0X3NlZ21lbnRfZ2VvbWV0cnkoIHNldHRpbmdzLmF4aXMsIHNlbGVjdGlvbl9zdGF0ZS5zdGFydF9lcG9jaCwgc2VsZWN0aW9uX3N0YXRlLmVuZF9lcG9jaCApXG5cdFx0XHRcdDogeyBvZmZzZXRfcGVyY2VudDogMCwgd2lkdGhfcGVyY2VudDogMCB9O1xuXHRcdFx0ZHVyYXRpb25fbWludXRlcyA9IE1hdGgubWF4KCBnZXRfc2VsZWN0aW9uX2NlbGxfbWludXRlcygpLCBNYXRoLnJvdW5kKCAoIHNlbGVjdGlvbl9zdGF0ZS5lbmRfZXBvY2ggLSBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfZXBvY2ggKSAvIDYwICkgKTtcblx0XHRcdGVuZF9ib3VuZGFyeV9jZWxsID0gY2VsbHNbIHNlbGVjdGlvbl9zdGF0ZS5lbmRfaW5kZXggKyAxIF07XG5cdFx0XHR2aWV3X21vZGVsID0ge1xuXHRcdFx0XHRvZmZzZXRfcGVyY2VudDogZ2VvbWV0cnkub2Zmc2V0X3BlcmNlbnQsXG5cdFx0XHRcdHdpZHRoX3BlcmNlbnQ6IGdlb21ldHJ5LndpZHRoX3BlcmNlbnQsXG5cdFx0XHRcdGNlbnRlcl9wZXJjZW50OiBnZW9tZXRyeS5vZmZzZXRfcGVyY2VudCArIGdlb21ldHJ5LndpZHRoX3BlcmNlbnQgLyAyLFxuXHRcdFx0XHRhY3RpdmVfYm91bmRhcnk6IHNlbGVjdGlvbl9yZXNpemVfc3RhdGUgPyBzZWxlY3Rpb25fcmVzaXplX3N0YXRlLmJvdW5kYXJ5IDogJycsXG5cdFx0XHRcdGR1cmF0aW9uX2xhYmVsOiBzZWxlY3Rpb25fc3RhdGUucHJldmlldyAmJiBzZWxlY3Rpb25fc3RhdGUucHJldmlldy5zZWxlY3Rpb24gPyBzZWxlY3Rpb25fc3RhdGUucHJldmlldy5zZWxlY3Rpb24uZHVyYXRpb25fbGFiZWwgOiBmb3JtYXRfc2VsZWN0aW9uX2R1cmF0aW9uKCBkdXJhdGlvbl9taW51dGVzICksXG5cdFx0XHRcdGFyaWFfbGFiZWw6IHNldHRpbmdzLmkxOG4uc2VsZWN0aW9uX3ByZXZpZXcsXG5cdFx0XHRcdHN0YXJ0X2hhbmRsZToge1xuXHRcdFx0XHRcdGxhYmVsOiBzZXR0aW5ncy5pMThuLnNlbGVjdGlvbl9zdGFydF9oYW5kbGUsXG5cdFx0XHRcdFx0bWluOiAxLFxuXHRcdFx0XHRcdG1heDogc2VsZWN0aW9uX3N0YXRlLmVuZF9pbmRleCArIDEsXG5cdFx0XHRcdFx0bm93OiBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfaW5kZXggKyAxLFxuXHRcdFx0XHRcdHZhbHVlX3RleHQ6IHN0YXJ0X2NlbGwuYXJpYV9sYWJlbCB8fCBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfYXRcblx0XHRcdFx0fSxcblx0XHRcdFx0ZW5kX2hhbmRsZToge1xuXHRcdFx0XHRcdGxhYmVsOiBzZXR0aW5ncy5pMThuLnNlbGVjdGlvbl9lbmRfaGFuZGxlLFxuXHRcdFx0XHRcdG1pbjogc2VsZWN0aW9uX3N0YXRlLnN0YXJ0X2luZGV4ICsgMSxcblx0XHRcdFx0XHRtYXg6IGNlbGxzLmxlbmd0aCxcblx0XHRcdFx0XHRub3c6IHNlbGVjdGlvbl9zdGF0ZS5lbmRfaW5kZXggKyAxLFxuXHRcdFx0XHRcdHZhbHVlX3RleHQ6IGVuZF9ib3VuZGFyeV9jZWxsICYmIGVuZF9ib3VuZGFyeV9jZWxsLmFyaWFfbGFiZWwgPyBlbmRfYm91bmRhcnlfY2VsbC5hcmlhX2xhYmVsIDogc2VsZWN0aW9uX3N0YXRlLmVuZF9hdFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzdGF0ZTogc2VsZWN0aW9uX3N0YXRlLnBoYXNlLFxuXHRcdFx0XHRwcmV2aWV3OiBzZWxlY3Rpb25fc3RhdGUucHJldmlldyxcblx0XHRcdFx0ZXJyb3JfbWVzc2FnZTogc2VsZWN0aW9uX3N0YXRlLmVycm9yX21lc3NhZ2UsXG5cdFx0XHRcdGkxOG46IHNldHRpbmdzLmkxOG5cblx0XHRcdH07XG5cdFx0XHRzZWxlY3Rpb25fdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoICdzZWxlY3Rpb24nICk7XG5cdFx0XHRwb3BvdmVyX3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCAnc2VsZWN0aW9uX3BvcG92ZXInICk7XG5cdFx0XHRpZiAoIHNlbGVjdGlvbl90ZW1wbGF0ZSApIHtcblx0XHRcdFx0dGVtcGxhdGVfYnVmZmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRcdFx0dGVtcGxhdGVfYnVmZmVyLmlubmVySFRNTCA9IHNlbGVjdGlvbl90ZW1wbGF0ZSggdmlld19tb2RlbCApO1xuXHRcdFx0XHR3aGlsZSAoIHRlbXBsYXRlX2J1ZmZlci5maXJzdENoaWxkICkge1xuXHRcdFx0XHRcdGhvc3QuYXBwZW5kQ2hpbGQoIHRlbXBsYXRlX2J1ZmZlci5maXJzdENoaWxkICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICggcG9wb3Zlcl90ZW1wbGF0ZSAmJiAtMSAhPT0gWyAnbG9hZGluZycsICdyZWFkeScsICdlcnJvcicgXS5pbmRleE9mKCBzZWxlY3Rpb25fc3RhdGUucGhhc2UgKSApIHtcblx0XHRcdFx0dGVtcGxhdGVfYnVmZmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRcdFx0dGVtcGxhdGVfYnVmZmVyLmlubmVySFRNTCA9IHBvcG92ZXJfdGVtcGxhdGUoIHZpZXdfbW9kZWwgKTtcblx0XHRcdFx0d2hpbGUgKCB0ZW1wbGF0ZV9idWZmZXIuZmlyc3RDaGlsZCApIHtcblx0XHRcdFx0XHRob3N0LmFwcGVuZENoaWxkKCB0ZW1wbGF0ZV9idWZmZXIuZmlyc3RDaGlsZCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIHBvc2l0aW9uX3NlbGVjdGlvbl9wb3BvdmVyICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWJvcnQgdGhlIGN1cnJlbnQgc2VsZWN0aW9uIHByZXZpZXcgYW5kIGludmFsaWRhdGUgcGVuZGluZyBjYWxsYmFja3MuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFib3J0X3NlbGVjdGlvbl9wcmV2aWV3X3JlcXVlc3QoKSB7XG5cdFx0XHRpZiAoIHNlbGVjdGlvbl9wcmV2aWV3X3RpbWVyICkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzZWxlY3Rpb25fcHJldmlld190aW1lciApO1xuXHRcdFx0XHRzZWxlY3Rpb25fcHJldmlld190aW1lciA9IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHNlbGVjdGlvbl9yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZWxlY3Rpb25fcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0c2VsZWN0aW9uX3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0X2dlbmVyYXRpb24gKz0gMTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNldCB0aGUgbG9jYWwgc2VsZWN0aW9uIHdpdGhvdXQgcmVuZGVyaW5nIG9yIGFubm91bmNpbmcuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc2V0X3NlbGVjdGlvbl9zdGF0ZSgpIHtcblx0XHRcdGFib3J0X3NlbGVjdGlvbl9wcmV2aWV3X3JlcXVlc3QoKTtcblx0XHRcdHNlbGVjdGlvbl9yZXNpemVfc3RhdGUgPSBudWxsO1xuXHRcdFx0dG91Y2hfc2VsZWN0aW9uX2NhbmRpZGF0ZSA9IG51bGw7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUgPSBjcmVhdGVfZW1wdHlfc2VsZWN0aW9uX3N0YXRlKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVib3VuY2UgYW4gYXV0aG9yaXRhdGl2ZSBwcmV2aWV3IGFmdGVyIGtleWJvYXJkIGJvdW5kYXJ5IGFkanVzdG1lbnRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGRlbGF5X21zIERlbGF5IGluIG1pbGxpc2Vjb25kcy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNjaGVkdWxlX3NlbGVjdGlvbl9wcmV2aWV3KCBkZWxheV9tcyApIHtcblx0XHRcdGlmICggc2VsZWN0aW9uX3ByZXZpZXdfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHNlbGVjdGlvbl9wcmV2aWV3X3RpbWVyICk7XG5cdFx0XHR9XG5cdFx0XHRzZWxlY3Rpb25fcHJldmlld190aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHNlbGVjdGlvbl9wcmV2aWV3X3RpbWVyID0gMDtcblx0XHRcdFx0aWYgKCAhIGlzX2hvc3RfYWN0aXZlKCkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlcXVlc3Rfc2VsZWN0aW9uX3ByZXZpZXcoKTtcblx0XHRcdH0sIE1hdGgubWF4KCAwLCBOdW1iZXIoIGRlbGF5X21zICkgfHwgMCApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdG9yZSBrZXlib2FyZCBmb2N1cyBhZnRlciByZW5kZXJpbmcgcmVwbGFjZXMgYSBzZWxlY3Rpb24gaGFuZGxlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvdW5kYXJ5IFN0YXJ0IG9yIGVuZCBib3VuZGFyeS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvY3VzX3NlbGVjdGlvbl9oYW5kbGUoIGJvdW5kYXJ5ICkge1xuXHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgaGFuZGxlO1xuXG5cdFx0XHRcdGlmICggISBpc19ob3N0X2FjdGl2ZSgpICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRoYW5kbGUgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24taGFuZGxlPVwiJyArIGJvdW5kYXJ5ICsgJ1wiXScgKTtcblx0XHRcdFx0aWYgKCBoYW5kbGUgKSB7XG5cdFx0XHRcdFx0aGFuZGxlLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDYW5jZWwgdGhlIGxvY2FsIGRyYWZ0IGFuZCBhbnkgaW4tZmxpZ2h0IHByZXZpZXcgd2l0aG91dCB3cml0aW5nIGRhdGEuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHNob3VsZF9hbm5vdW5jZSBXaGV0aGVyIHRvIGFubm91bmNlIGNhbmNlbGxhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbmNlbF9zZWxlY3Rpb24oIHNob3VsZF9hbm5vdW5jZSApIHtcblx0XHRcdGlmICggJ2FwcGx5aW5nJyA9PT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXNldF9zZWxlY3Rpb25fc3RhdGUoKTtcblx0XHRcdHJlbmRlcl9zZWxlY3Rpb24oKTtcblx0XHRcdGlmICggc2hvdWxkX2Fubm91bmNlICkge1xuXHRcdFx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi5zZWxlY3Rpb25fY2FuY2VsbGVkICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29uc3VtZSBhIHJlYWR5IHNlbGVjdGlvbiBvbmx5IHdoZW4gaXRzIHNpZ25lZCBhY3Rpb24gdG9rZW4gaXMgZXhhY3QuXG5cdFx0ICpcblx0XHQgKiBUaGUgdG9rZW4gcmVtYWlucyBvcGFxdWUuIFRoaXMgY29tcGFyaXNvbiBwcmV2ZW50cyBhbiB1bnJlbGF0ZWQgZHJhZnQgZnJvbVxuXHRcdCAqIGJlaW5nIGNsZWFyZWQgYnkgYSBib29raW5nIGNyZWF0ZWQgZnJvbSB0aGUgdG9vbGJhciBvciBhbm90aGVyIHNlbGVjdGlvblxuXHRcdCAqIHN1cmZhY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYWN0aW9uX2lkIFN0YWJsZSBwcmV2aWV3IGFjdGlvbiBpZGVudGlmaWVyLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBxdWVyeV9hcmcgU2lnbmVkLXRva2VuIHF1ZXJ5IGFyZ3VtZW50IG5hbWUuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRva2VuICAgICBPcGFxdWUgc2lnbmVkIHRva2VuIGNvbnN1bWVkIGJ5IGNyZWF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgY3VycmVudCBzZWxlY3Rpb24gbWF0Y2hlZCBhbmQgd2FzIGNsZWFyZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY29uc3VtZV9zaWduZWRfYWN0aW9uX2NvbnRleHQoIGFjdGlvbl9pZCwgcXVlcnlfYXJnLCB0b2tlbiApIHtcblx0XHRcdHZhciBhY3Rpb24gPSBzZWxlY3Rpb25fc3RhdGUucHJldmlldyAmJiBzZWxlY3Rpb25fc3RhdGUucHJldmlldy5hY3Rpb25zXG5cdFx0XHRcdD8gc2VsZWN0aW9uX3N0YXRlLnByZXZpZXcuYWN0aW9uc1sgYWN0aW9uX2lkIF1cblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0dmFyIGFjdGlvbl91cmw7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0J3JlYWR5JyAhPT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlXG5cdFx0XHRcdHx8ICEgYWN0aW9uXG5cdFx0XHRcdHx8IHRydWUgIT09IGFjdGlvbi5hdXRob3JpemVkXG5cdFx0XHRcdHx8IHRydWUgIT09IGFjdGlvbi5lbmFibGVkXG5cdFx0XHRcdHx8ICEgYWN0aW9uLnVybFxuXHRcdFx0XHR8fCAhIC9eW2EtekEtWjAtOV8tXXsxLDY0fSQvLnRlc3QoIFN0cmluZyggcXVlcnlfYXJnIHx8ICcnICkgKVxuXHRcdFx0XHR8fCAhIC9eW0EtWmEtejAtOS5fLV17MSw4MTkyfSQvLnRlc3QoIFN0cmluZyggdG9rZW4gfHwgJycgKSApXG5cdFx0XHRcdHx8ICEgd2luZG93LlVSTFxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGFjdGlvbl91cmwgPSBuZXcgd2luZG93LlVSTCggU3RyaW5nKCBhY3Rpb24udXJsICksIHdpbmRvdy5sb2NhdGlvbi5ocmVmICk7XG5cdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggU3RyaW5nKCBhY3Rpb25fdXJsLnNlYXJjaFBhcmFtcy5nZXQoIHF1ZXJ5X2FyZyApIHx8ICcnICkgIT09IFN0cmluZyggdG9rZW4gKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y2FuY2VsX3NlbGVjdGlvbiggZmFsc2UgKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHNpZ25lZCBjb250ZXh0IGZvciBlYWNoIGN1cnJlbnRseSBjYWNoZWQgYXV0aG9yaXplZCB3aW5kb3cuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtBcnJheTxzdHJpbmc+fSBCb3VuZGVkIGxvYWRlZC13aW5kb3cgdG9rZW5zLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9sb2FkZWRfc2VsZWN0aW9uX2NvbnRleHRfdG9rZW5zKCkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgY29udGV4dC5nZXRfbG9hZGVkX2NvbnRleHRfdG9rZW5zICkge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjb250ZXh0LmdldF9sb2FkZWRfY29udGV4dF90b2tlbnMoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWxvYWQgYXV0aG9yaXphdGlvbiBhbmQgZG9tYWluIHByb2plY3Rpb25zIGZvciB0aGUgY29tcGxldGVkIGxvY2FsIGRyYWZ0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X3NlbGVjdGlvbl9wcmV2aWV3KCkge1xuXHRcdFx0dmFyIHRyYW5zcG9ydCA9IHNldHRpbmdzLnRyYW5zcG9ydCAmJiBzZXR0aW5ncy50cmFuc3BvcnQuc2VsZWN0aW9uID8gc2V0dGluZ3MudHJhbnNwb3J0LnNlbGVjdGlvbiA6IHt9O1xuXHRcdFx0dmFyIGdlbmVyYXRpb247XG5cblx0XHRcdGlmICggISB3aW5kb3cualF1ZXJ5IHx8ICEgc2V0dGluZ3MudHJhbnNwb3J0LnVybCB8fCAhIHRyYW5zcG9ydC5wcmV2aWV3X2FjdGlvbiB8fCAhIHRyYW5zcG9ydC5wcmV2aWV3X25vbmNlIHx8ICdpZGxlJyA9PT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhYm9ydF9zZWxlY3Rpb25fcHJldmlld19yZXF1ZXN0KCk7XG5cdFx0XHRnZW5lcmF0aW9uID0gc2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbjtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5waGFzZSA9ICdsb2FkaW5nJztcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5lcnJvcl9tZXNzYWdlID0gJyc7XG5cdFx0XHRyZW5kZXJfc2VsZWN0aW9uKCk7XG5cdFx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi5zZWxlY3Rpb25fcmVhZHkgKTtcblx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogc2V0dGluZ3MudHJhbnNwb3J0LnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdHRpbWVvdXQ6ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LmdldF9yZXF1ZXN0X3RpbWVvdXRfbXMgPyBjb250ZXh0LmdldF9yZXF1ZXN0X3RpbWVvdXRfbXMoKSA6IDE1MDAwLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQucHJldmlld19hY3Rpb24sXG5cdFx0XHRcdFx0bm9uY2U6IHRyYW5zcG9ydC5wcmV2aWV3X25vbmNlLFxuXHRcdFx0XHRcdHJlc291cmNlX2lkOiBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQsXG5cdFx0XHRcdFx0dmlldzogc2V0dGluZ3MuYXhpcy52aWV3LFxuXHRcdFx0XHRcdHN0YXJ0X2F0OiBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfYXQsXG5cdFx0XHRcdFx0ZW5kX2F0OiBzZWxlY3Rpb25fc3RhdGUuZW5kX2F0LFxuXHRcdFx0XHRcdGxvYWRlZF9zdGFydF9hdDogc2V0dGluZ3MuYXhpcy5zdGFydF9hdCxcblx0XHRcdFx0XHRsb2FkZWRfZW5kX2F0OiBzZXR0aW5ncy5heGlzLmVuZF9hdCxcblx0XHRcdFx0XHRsb2FkZWRfY29udGV4dF90b2tlbnM6IGdldF9sb2FkZWRfc2VsZWN0aW9uX2NvbnRleHRfdG9rZW5zKCksXG5cdFx0XHRcdFx0cmV0dXJuX2NvbnRleHQ6ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LmdldF9yZXR1cm5fY29udGV4dCA/IGNvbnRleHQuZ2V0X3JldHVybl9jb250ZXh0KCkgOiB7fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBzZWxlY3Rpb25fcmVxdWVzdF9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEuc2VsZWN0aW9uICkge1xuXHRcdFx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5waGFzZSA9ICdlcnJvcic7XG5cdFx0XHRcdFx0c2VsZWN0aW9uX3N0YXRlLmVycm9yX21lc3NhZ2UgPSBzZXR0aW5ncy5pMThuLmVycm9yX21lc3NhZ2U7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5wcmV2aWV3ID0gcmVzcG9uc2UuZGF0YTtcblx0XHRcdFx0c2VsZWN0aW9uX3N0YXRlLnBoYXNlID0gJ3JlYWR5Jztcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIHJlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHR2YXIgZXJyb3IgPSByZXF1ZXN0LnJlc3BvbnNlSlNPTiAmJiByZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhID8gcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IHt9O1xuXG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gc2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbiB8fCAnYWJvcnQnID09PSByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZWN0aW9uX3N0YXRlLnBoYXNlID0gJ2Vycm9yJztcblx0XHRcdFx0c2VsZWN0aW9uX3N0YXRlLmVycm9yX21lc3NhZ2UgPSBlcnJvci5tZXNzYWdlIHx8IHNldHRpbmdzLmkxOG4uZXJyb3JfbWVzc2FnZTtcblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBzZWxlY3Rpb25fcmVxdWVzdF9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxlY3Rpb25fcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRcdHJlbmRlcl9zZWxlY3Rpb24oKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgb25lIHNlbGVjdGlvbiBib3VuZGFyeSB3aXRob3V0IGFsbG93aW5nIHRoZSBoYW5kbGVzIHRvIGNyb3NzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvdW5kYXJ5IFN0YXJ0IG9yIGVuZCBib3VuZGFyeS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVxdWVzdGVkX2luZGV4IFJlcXVlc3RlZCBzZXJ2ZXItYXhpcyBjZWxsIGluZGV4LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwaGFzZSBTZWxlY3Rpb24gc3RhdGUgcGhhc2UuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBib3VuZGFyeSB3YXMgdXBkYXRlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfc2VsZWN0aW9uX2JvdW5kYXJ5KCBib3VuZGFyeSwgcmVxdWVzdGVkX2luZGV4LCBwaGFzZSApIHtcblx0XHRcdHZhciBtYXhpbXVtX2luZGV4ID0gc2V0dGluZ3MuYXhpcyAmJiBBcnJheS5pc0FycmF5KCBzZXR0aW5ncy5heGlzLmNlbGxzICkgPyBzZXR0aW5ncy5heGlzLmNlbGxzLmxlbmd0aCAtIDEgOiAtMTtcblx0XHRcdHZhciBib3VuZGVkX2luZGV4O1xuXG5cdFx0XHRpZiAoIDAgPiBtYXhpbXVtX2luZGV4IHx8IC0xID09PSBbICdzdGFydCcsICdlbmQnIF0uaW5kZXhPZiggYm91bmRhcnkgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnc3RhcnQnID09PSBib3VuZGFyeSApIHtcblx0XHRcdFx0Ym91bmRlZF9pbmRleCA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggc2VsZWN0aW9uX3N0YXRlLmVuZF9pbmRleCwgcmVxdWVzdGVkX2luZGV4ICkgKTtcblx0XHRcdFx0aWYgKCBib3VuZGVkX2luZGV4ID09PSBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfaW5kZXggKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzZXRfc2VsZWN0aW9uX3JhbmdlKCBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQsIGJvdW5kZWRfaW5kZXgsIHNlbGVjdGlvbl9zdGF0ZS5lbmRfaW5kZXgsIHBoYXNlICk7XG5cdFx0XHR9XG5cdFx0XHRib3VuZGVkX2luZGV4ID0gTWF0aC5tYXgoIHNlbGVjdGlvbl9zdGF0ZS5zdGFydF9pbmRleCwgTWF0aC5taW4oIG1heGltdW1faW5kZXgsIHJlcXVlc3RlZF9pbmRleCApICk7XG5cdFx0XHRpZiAoIGJvdW5kZWRfaW5kZXggPT09IHNlbGVjdGlvbl9zdGF0ZS5lbmRfaW5kZXggKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBzZXRfc2VsZWN0aW9uX3JhbmdlKCBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQsIHNlbGVjdGlvbl9zdGF0ZS5zdGFydF9pbmRleCwgYm91bmRlZF9pbmRleCwgcGhhc2UgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCZWdpbiBhIHBvaW50ZXItb3duZWQgYm91bmRhcnkgcmVzaXplIHdoaWxlIHByZXNlcnZpbmcgdGhlIHByaW9yIGRyYWZ0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXItZG93biBldmVudC5cblx0XHQgKiBAcGFyYW0ge0VsZW1lbnR9IGhhbmRsZSBBY3RpdmF0ZWQgc2VsZWN0aW9uIGhhbmRsZS5cblx0XHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRyYWNrIFN0YWJsZSBSZXNvdXJjZSBzZWxlY3Rpb24gdHJhY2suXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXNpemUgZ2VzdHVyZSBzdGFydGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJlZ2luX3NlbGVjdGlvbl9yZXNpemUoIGV2ZW50LCBoYW5kbGUsIHRyYWNrICkge1xuXHRcdFx0dmFyIGJvdW5kYXJ5ID0gaGFuZGxlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24taGFuZGxlJyApO1xuXG5cdFx0XHRpZiAoICdpZGxlJyA9PT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlIHx8ICdhcHBseWluZycgPT09IHNlbGVjdGlvbl9zdGF0ZS5waGFzZSB8fCAtMSA9PT0gWyAnc3RhcnQnLCAnZW5kJyBdLmluZGV4T2YoIGJvdW5kYXJ5ICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHNlbGVjdGlvbl9yZXNpemVfc3RhdGUgPSB7XG5cdFx0XHRcdGJvdW5kYXJ5OiBib3VuZGFyeSxcblx0XHRcdFx0cG9pbnRlcl9pZDogZXZlbnQucG9pbnRlcklkLFxuXHRcdFx0XHRwaGFzZTogc2VsZWN0aW9uX3N0YXRlLnBoYXNlLFxuXHRcdFx0XHRzdGFydF9pbmRleDogc2VsZWN0aW9uX3N0YXRlLnN0YXJ0X2luZGV4LFxuXHRcdFx0XHRlbmRfaW5kZXg6IHNlbGVjdGlvbl9zdGF0ZS5lbmRfaW5kZXgsXG5cdFx0XHRcdHN0YXJ0X2F0OiBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfYXQsXG5cdFx0XHRcdGVuZF9hdDogc2VsZWN0aW9uX3N0YXRlLmVuZF9hdCxcblx0XHRcdFx0c3RhcnRfZXBvY2g6IHNlbGVjdGlvbl9zdGF0ZS5zdGFydF9lcG9jaCxcblx0XHRcdFx0ZW5kX2Vwb2NoOiBzZWxlY3Rpb25fc3RhdGUuZW5kX2Vwb2NoLFxuXHRcdFx0XHRwcmV2aWV3OiBzZWxlY3Rpb25fc3RhdGUucHJldmlldyxcblx0XHRcdFx0ZXJyb3JfbWVzc2FnZTogc2VsZWN0aW9uX3N0YXRlLmVycm9yX21lc3NhZ2Vcblx0XHRcdH07XG5cdFx0XHRhYm9ydF9zZWxlY3Rpb25fcHJldmlld19yZXF1ZXN0KCk7XG5cdFx0XHR0b3VjaF9zZWxlY3Rpb25fY2FuZGlkYXRlID0gbnVsbDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5waGFzZSA9ICdyZXNpemluZyc7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUucG9pbnRlcl9pZCA9IGV2ZW50LnBvaW50ZXJJZDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5wcmV2aWV3ID0gbnVsbDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5lcnJvcl9tZXNzYWdlID0gJyc7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR0cmFjay5zZXRQb2ludGVyQ2FwdHVyZSggZXZlbnQucG9pbnRlcklkICk7XG5cdFx0XHRyZW5kZXJfc2VsZWN0aW9uKCk7XG5cdFx0XHRmb2N1c19zZWxlY3Rpb25faGFuZGxlKCBib3VuZGFyeSApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdG9yZSB0aGUgZXhhY3Qgc2VsZWN0aW9uIHRoYXQgZXhpc3RlZCBiZWZvcmUgYSBjYW5jZWxsZWQgcmVzaXplLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBzaG91bGRfZm9jdXMgV2hldGhlciB0byByZXN0b3JlIGZvY3VzIHRvIHRoZSBoYW5kbGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXN0b3JlX3NlbGVjdGlvbl9yZXNpemUoIHNob3VsZF9mb2N1cyApIHtcblx0XHRcdHZhciBwcmV2aW91c19zdGF0ZSA9IHNlbGVjdGlvbl9yZXNpemVfc3RhdGU7XG5cdFx0XHR2YXIgYm91bmRhcnk7XG5cdFx0XHR2YXIgc2hvdWxkX3JlbG9hZF9wcmV2aWV3O1xuXG5cdFx0XHRpZiAoICEgcHJldmlvdXNfc3RhdGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGJvdW5kYXJ5ID0gcHJldmlvdXNfc3RhdGUuYm91bmRhcnk7XG5cdFx0XHRzaG91bGRfcmVsb2FkX3ByZXZpZXcgPSAnbG9hZGluZycgPT09IHByZXZpb3VzX3N0YXRlLnBoYXNlO1xuXHRcdFx0c2VsZWN0aW9uX3Jlc2l6ZV9zdGF0ZSA9IG51bGw7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUucGhhc2UgPSBzaG91bGRfcmVsb2FkX3ByZXZpZXcgPyAnZHJhZnQnIDogcHJldmlvdXNfc3RhdGUucGhhc2U7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUuc3RhcnRfaW5kZXggPSBwcmV2aW91c19zdGF0ZS5zdGFydF9pbmRleDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5lbmRfaW5kZXggPSBwcmV2aW91c19zdGF0ZS5lbmRfaW5kZXg7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUuc3RhcnRfYXQgPSBwcmV2aW91c19zdGF0ZS5zdGFydF9hdDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5lbmRfYXQgPSBwcmV2aW91c19zdGF0ZS5lbmRfYXQ7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUuc3RhcnRfZXBvY2ggPSBwcmV2aW91c19zdGF0ZS5zdGFydF9lcG9jaDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5lbmRfZXBvY2ggPSBwcmV2aW91c19zdGF0ZS5lbmRfZXBvY2g7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUucHJldmlldyA9IHByZXZpb3VzX3N0YXRlLnByZXZpZXc7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUuZXJyb3JfbWVzc2FnZSA9IHByZXZpb3VzX3N0YXRlLmVycm9yX21lc3NhZ2U7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUucG9pbnRlcl9pZCA9IG51bGw7XG5cdFx0XHRyZW5kZXJfc2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoIHNob3VsZF9mb2N1cyApIHtcblx0XHRcdFx0Zm9jdXNfc2VsZWN0aW9uX2hhbmRsZSggYm91bmRhcnkgKTtcblx0XHRcdH1cblx0XHRcdGlmICggc2hvdWxkX3JlbG9hZF9wcmV2aWV3ICkge1xuXHRcdFx0XHRyZXF1ZXN0X3NlbGVjdGlvbl9wcmV2aWV3KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29tbWl0IGEgbG9jYWwgYm91bmRhcnkgZ2VzdHVyZSBhbmQgcmVxdWVzdCBhIGZyZXNoIHNlcnZlciBwcmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXItdXAgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb21wbGV0ZV9zZWxlY3Rpb25fcmVzaXplKCBldmVudCApIHtcblx0XHRcdHZhciBwcmV2aW91c19zdGF0ZSA9IHNlbGVjdGlvbl9yZXNpemVfc3RhdGU7XG5cdFx0XHR2YXIgYm91bmRhcnk7XG5cdFx0XHR2YXIgY2hhbmdlZDtcblxuXHRcdFx0aWYgKCAhIHByZXZpb3VzX3N0YXRlIHx8IHByZXZpb3VzX3N0YXRlLnBvaW50ZXJfaWQgIT09IGV2ZW50LnBvaW50ZXJJZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ym91bmRhcnkgPSBwcmV2aW91c19zdGF0ZS5ib3VuZGFyeTtcblx0XHRcdGNoYW5nZWQgPSBwcmV2aW91c19zdGF0ZS5zdGFydF9pbmRleCAhPT0gc2VsZWN0aW9uX3N0YXRlLnN0YXJ0X2luZGV4IHx8IHByZXZpb3VzX3N0YXRlLmVuZF9pbmRleCAhPT0gc2VsZWN0aW9uX3N0YXRlLmVuZF9pbmRleDtcblx0XHRcdGlmICggISBjaGFuZ2VkICkge1xuXHRcdFx0XHRyZXN0b3JlX3NlbGVjdGlvbl9yZXNpemUoIHRydWUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0aW9uX3Jlc2l6ZV9zdGF0ZSA9IG51bGw7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUucGhhc2UgPSAnZHJhZnQnO1xuXHRcdFx0c2VsZWN0aW9uX3N0YXRlLnBvaW50ZXJfaWQgPSBudWxsO1xuXHRcdFx0cmVuZGVyX3NlbGVjdGlvbigpO1xuXHRcdFx0Zm9jdXNfc2VsZWN0aW9uX2hhbmRsZSggYm91bmRhcnkgKTtcblx0XHRcdHJlcXVlc3Rfc2VsZWN0aW9uX3ByZXZpZXcoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBZGp1c3Qgb25lIHNlbGVjdGlvbiBzbGlkZXIgd2l0aCBwaHlzaWNhbC1kaXJlY3Rpb24ga2V5Ym9hcmQgY29udHJvbHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2ZW50IEtleWJvYXJkIGV2ZW50LlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gaGFuZGxlIEZvY3VzZWQgc2VsZWN0aW9uIGhhbmRsZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGtleSBiZWxvbmdlZCB0byB0aGUgaGFuZGxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9zZWxlY3Rpb25faGFuZGxlX2tleWRvd24oIGV2ZW50LCBoYW5kbGUgKSB7XG5cdFx0XHR2YXIgYm91bmRhcnkgPSBoYW5kbGUuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1oYW5kbGUnICk7XG5cdFx0XHR2YXIgc3VwcG9ydGVkX2tleXMgPSBbICdBcnJvd0xlZnQnLCAnQXJyb3dSaWdodCcsICdIb21lJywgJ0VuZCcgXTtcblx0XHRcdHZhciByZXF1ZXN0ZWRfaW5kZXg7XG5cdFx0XHR2YXIgZGlyZWN0aW9uO1xuXG5cdFx0XHRpZiAoIC0xID09PSBzdXBwb3J0ZWRfa2V5cy5pbmRleE9mKCBldmVudC5rZXkgKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0aWYgKCAnYXBwbHlpbmcnID09PSBzZWxlY3Rpb25fc3RhdGUucGhhc2UgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmVxdWVzdGVkX2luZGV4ID0gJ3N0YXJ0JyA9PT0gYm91bmRhcnkgPyBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfaW5kZXggOiBzZWxlY3Rpb25fc3RhdGUuZW5kX2luZGV4O1xuXHRcdFx0aWYgKCAnSG9tZScgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0cmVxdWVzdGVkX2luZGV4ID0gJ3N0YXJ0JyA9PT0gYm91bmRhcnkgPyAwIDogc2VsZWN0aW9uX3N0YXRlLnN0YXJ0X2luZGV4O1xuXHRcdFx0fSBlbHNlIGlmICggJ0VuZCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0cmVxdWVzdGVkX2luZGV4ID0gJ3N0YXJ0JyA9PT0gYm91bmRhcnkgPyBzZWxlY3Rpb25fc3RhdGUuZW5kX2luZGV4IDogc2V0dGluZ3MuYXhpcy5jZWxscy5sZW5ndGggLSAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGlyZWN0aW9uID0gKCAnQXJyb3dSaWdodCcgPT09IGV2ZW50LmtleSA/IDEgOiAtMSApICogKCBzZXR0aW5ncy5pc19ydGwgPyAtMSA6IDEgKTtcblx0XHRcdFx0cmVxdWVzdGVkX2luZGV4ICs9IGRpcmVjdGlvbjtcblx0XHRcdH1cblx0XHRcdGlmICggJ3N0YXJ0JyA9PT0gYm91bmRhcnkgKSB7XG5cdFx0XHRcdHJlcXVlc3RlZF9pbmRleCA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggc2VsZWN0aW9uX3N0YXRlLmVuZF9pbmRleCwgcmVxdWVzdGVkX2luZGV4ICkgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlcXVlc3RlZF9pbmRleCA9IE1hdGgubWF4KCBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfaW5kZXgsIE1hdGgubWluKCBzZXR0aW5ncy5heGlzLmNlbGxzLmxlbmd0aCAtIDEsIHJlcXVlc3RlZF9pbmRleCApICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICggJ3N0YXJ0JyA9PT0gYm91bmRhcnkgJiYgcmVxdWVzdGVkX2luZGV4ICE9PSBzZWxlY3Rpb25fc3RhdGUuc3RhcnRfaW5kZXggKSB8fCAoICdlbmQnID09PSBib3VuZGFyeSAmJiByZXF1ZXN0ZWRfaW5kZXggIT09IHNlbGVjdGlvbl9zdGF0ZS5lbmRfaW5kZXggKSApIHtcblx0XHRcdFx0YWJvcnRfc2VsZWN0aW9uX3ByZXZpZXdfcmVxdWVzdCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZXRfc2VsZWN0aW9uX2JvdW5kYXJ5KCBib3VuZGFyeSwgcmVxdWVzdGVkX2luZGV4LCAnZHJhZnQnICkgKSB7XG5cdFx0XHRcdGZvY3VzX3NlbGVjdGlvbl9oYW5kbGUoIGJvdW5kYXJ5ICk7XG5cdFx0XHRcdHNjaGVkdWxlX3NlbGVjdGlvbl9wcmV2aWV3KCAxODAgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IG9uZSByZXZpZXdlZCBBdmFpbGFiaWxpdHktZG9tYWluIGFjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIEJsb2NrIG9yIHVuYmxvY2suXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9zZWxlY3Rpb25fYmxvY2soIG1vZGUgKSB7XG5cdFx0XHR2YXIgdHJhbnNwb3J0ID0gc2V0dGluZ3MudHJhbnNwb3J0ICYmIHNldHRpbmdzLnRyYW5zcG9ydC5zZWxlY3Rpb24gPyBzZXR0aW5ncy50cmFuc3BvcnQuc2VsZWN0aW9uIDoge307XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbjtcblxuXHRcdFx0aWYgKCAhIHdpbmRvdy5qUXVlcnkgfHwgISBzZWxlY3Rpb25fc3RhdGUucHJldmlldyB8fCAhIHNlbGVjdGlvbl9zdGF0ZS5wcmV2aWV3LmJsb2NrX3Rva2VuIHx8ICEgdHJhbnNwb3J0LmFwcGx5X2FjdGlvbiB8fCAhIHRyYW5zcG9ydC5hcHBseV9ub25jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0Z2VuZXJhdGlvbiA9IHNlbGVjdGlvbl9yZXF1ZXN0X2dlbmVyYXRpb247XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUucGhhc2UgPSAnYXBwbHlpbmcnO1xuXHRcdFx0cmVuZGVyX3NlbGVjdGlvbigpO1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5zZXRfYXBwbHlfbG9hZGluZyApIHtcblx0XHRcdFx0Y29udGV4dC5zZXRfYXBwbHlfbG9hZGluZyggdHJ1ZSwgc2V0dGluZ3MuaTE4bi5hcHBseWluZ19hdmFpbGFiaWxpdHkgKTtcblx0XHRcdH1cblx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogc2V0dGluZ3MudHJhbnNwb3J0LnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdHRpbWVvdXQ6ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LmdldF9yZXF1ZXN0X3RpbWVvdXRfbXMgPyBjb250ZXh0LmdldF9yZXF1ZXN0X3RpbWVvdXRfbXMoKSA6IDE1MDAwLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQuYXBwbHlfYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQuYXBwbHlfbm9uY2UsXG5cdFx0XHRcdFx0YmxvY2tfdG9rZW46IHNlbGVjdGlvbl9zdGF0ZS5wcmV2aWV3LmJsb2NrX3Rva2VuLFxuXHRcdFx0XHRcdG1vZGU6IG1vZGVcblx0XHRcdFx0fVxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gc2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyApIHtcblx0XHRcdFx0XHRzZWxlY3Rpb25fc3RhdGUucGhhc2UgPSAnZXJyb3InO1xuXHRcdFx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5lcnJvcl9tZXNzYWdlID0gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgPyByZXNwb25zZS5kYXRhLm1lc3NhZ2UgOiBzZXR0aW5ncy5pMThuLmVycm9yX21lc3NhZ2U7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGVjdGlvbl9yZXNpemVfc3RhdGUgPSBudWxsO1xuXHRcdFx0XHR0b3VjaF9zZWxlY3Rpb25fY2FuZGlkYXRlID0gbnVsbDtcblx0XHRcdFx0c2VsZWN0aW9uX3N0YXRlID0gY3JlYXRlX2VtcHR5X3NlbGVjdGlvbl9zdGF0ZSgpO1xuXHRcdFx0XHRyZW5kZXJfc2VsZWN0aW9uKCk7XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQucmVmcmVzaF9hZnRlcl9hcHBseSApIHtcblx0XHRcdFx0XHRjb250ZXh0LnJlZnJlc2hfYWZ0ZXJfYXBwbHkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdHZhciBlcnJvciA9IHJlcXVlc3QucmVzcG9uc2VKU09OICYmIHJlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgPyByZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhIDoge307XG5cblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBzZWxlY3Rpb25fcmVxdWVzdF9nZW5lcmF0aW9uIHx8ICdhYm9ydCcgPT09IHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxlY3Rpb25fc3RhdGUucGhhc2UgPSAnZXJyb3InO1xuXHRcdFx0XHRzZWxlY3Rpb25fc3RhdGUuZXJyb3JfbWVzc2FnZSA9IGVycm9yLm1lc3NhZ2UgfHwgc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlO1xuXHRcdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIGdlbmVyYXRpb24gPT09IHNlbGVjdGlvbl9yZXF1ZXN0X2dlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0c2VsZWN0aW9uX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQuc2V0X2FwcGx5X2xvYWRpbmcgKSB7XG5cdFx0XHRcdFx0XHRjb250ZXh0LnNldF9hcHBseV9sb2FkaW5nKCBmYWxzZSwgJycgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVuZGVyX3NlbGVjdGlvbigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RhcnQgbW91c2UvcGVuIHNlbGVjdGlvbiBvciByZWNvcmQgYSB0b3VjaCB0YXAgY2FuZGlkYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXItZG93biBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9zZWxlY3Rpb25fcG9pbnRlcl9kb3duKCBldmVudCApIHtcblx0XHRcdHZhciB0cmFjayA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24tdHJhY2tdJyApO1xuXHRcdFx0dmFyIGhhbmRsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24taGFuZGxlXScgKTtcblx0XHRcdHZhciBjZWxsX2luZGV4O1xuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xuXG5cdFx0XHRpZiAoIGhhbmRsZSApIHtcblx0XHRcdFx0aWYgKCB0cmFjayApIHtcblx0XHRcdFx0XHRiZWdpbl9zZWxlY3Rpb25fcmVzaXplKCBldmVudCwgaGFuZGxlLCB0cmFjayApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISB0cmFjayB8fCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc29ydGFibGUtZXhjbHVkZV0sIFtkYXRhLXdwYmMtYm9va2luZy1vdmVydmlldy1pbmZvLXRyaWdnZXJdLCBbZGF0YS13cGJjLXRpbWVsaW5lLXNlZ21lbnQtaWRdLCBbZGF0YS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1wb3BvdmVyXSwgYnV0dG9uLCBhJyApIHx8ICggJ21vdXNlJyA9PT0gZXZlbnQucG9pbnRlclR5cGUgJiYgMCAhPT0gZXZlbnQuYnV0dG9uICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNlbGxfaW5kZXggPSBnZXRfc2VsZWN0aW9uX2NlbGxfaW5kZXgoIHRyYWNrLCBldmVudC5jbGllbnRYICk7XG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggdHJhY2suZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWlkJyApICk7XG5cdFx0XHRpZiAoICd0b3VjaCcgPT09IGV2ZW50LnBvaW50ZXJUeXBlICkge1xuXHRcdFx0XHRpZiAoICd0b3VjaF9zdGFydCcgIT09IHNlbGVjdGlvbl9zdGF0ZS5waGFzZSB8fCBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQgIT09IHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRcdGFib3J0X3NlbGVjdGlvbl9wcmV2aWV3X3JlcXVlc3QoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0b3VjaF9zZWxlY3Rpb25fY2FuZGlkYXRlID0ge1xuXHRcdFx0XHRcdHBvaW50ZXJfaWQ6IGV2ZW50LnBvaW50ZXJJZCxcblx0XHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQsXG5cdFx0XHRcdFx0Y2VsbF9pbmRleDogY2VsbF9pbmRleCxcblx0XHRcdFx0XHRzdGFydF94OiBldmVudC5jbGllbnRYLFxuXHRcdFx0XHRcdHN0YXJ0X3k6IGV2ZW50LmNsaWVudFksXG5cdFx0XHRcdFx0bW92ZWQ6IGZhbHNlXG5cdFx0XHRcdH07XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRhYm9ydF9zZWxlY3Rpb25fcHJldmlld19yZXF1ZXN0KCk7XG5cdFx0XHRzZWxlY3Rpb25fc3RhdGUucG9pbnRlcl9pZCA9IGV2ZW50LnBvaW50ZXJJZDtcblx0XHRcdHNldF9zZWxlY3Rpb25fcmFuZ2UoIHJlc291cmNlX2lkLCBjZWxsX2luZGV4LCBjZWxsX2luZGV4LCAnZHJhd2luZycgKTtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5hbmNob3JfaW5kZXggPSBjZWxsX2luZGV4O1xuXHRcdFx0dHJhY2suc2V0UG9pbnRlckNhcHR1cmUoIGV2ZW50LnBvaW50ZXJJZCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEV4dGVuZCBhIG1vdXNlL3BlbiBkcmFmdCB3aGlsZSBwcmVzZXJ2aW5nIG9yZGluYXJ5IHRvdWNoIHNjcm9sbGluZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBQb2ludGVyLW1vdmUgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfc2VsZWN0aW9uX3BvaW50ZXJfbW92ZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgdHJhY2s7XG5cdFx0XHR2YXIgY2VsbF9pbmRleDtcblxuXHRcdFx0aWYgKCBzZWxlY3Rpb25fcmVzaXplX3N0YXRlICYmIHNlbGVjdGlvbl9yZXNpemVfc3RhdGUucG9pbnRlcl9pZCA9PT0gZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHR0cmFjayA9IGdldF9zZWxlY3Rpb25fdHJhY2soIHNlbGVjdGlvbl9zdGF0ZS5yZXNvdXJjZV9pZCApO1xuXHRcdFx0XHRpZiAoICEgdHJhY2sgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGNlbGxfaW5kZXggPSBnZXRfc2VsZWN0aW9uX2NlbGxfaW5kZXgoIHRyYWNrLCBldmVudC5jbGllbnRYICk7XG5cdFx0XHRcdHNldF9zZWxlY3Rpb25fYm91bmRhcnkoIHNlbGVjdGlvbl9yZXNpemVfc3RhdGUuYm91bmRhcnksIGNlbGxfaW5kZXgsICdyZXNpemluZycgKTtcblx0XHRcdFx0c2VsZWN0aW9uX3N0YXRlLnBvaW50ZXJfaWQgPSBldmVudC5wb2ludGVySWQ7XG5cdFx0XHRcdGZvY3VzX3NlbGVjdGlvbl9oYW5kbGUoIHNlbGVjdGlvbl9yZXNpemVfc3RhdGUuYm91bmRhcnkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0b3VjaF9zZWxlY3Rpb25fY2FuZGlkYXRlICYmIHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUucG9pbnRlcl9pZCA9PT0gZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHRpZiAoIDggPCBNYXRoLmFicyggZXZlbnQuY2xpZW50WCAtIHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUuc3RhcnRfeCApIHx8IDggPCBNYXRoLmFicyggZXZlbnQuY2xpZW50WSAtIHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUuc3RhcnRfeSApICkge1xuXHRcdFx0XHRcdHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUubW92ZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ2RyYXdpbmcnICE9PSBzZWxlY3Rpb25fc3RhdGUucGhhc2UgfHwgc2VsZWN0aW9uX3N0YXRlLnBvaW50ZXJfaWQgIT09IGV2ZW50LnBvaW50ZXJJZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dHJhY2sgPSBnZXRfc2VsZWN0aW9uX3RyYWNrKCBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQgKTtcblx0XHRcdGlmICggISB0cmFjayApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNlbGxfaW5kZXggPSBnZXRfc2VsZWN0aW9uX2NlbGxfaW5kZXgoIHRyYWNrLCBldmVudC5jbGllbnRYICk7XG5cdFx0XHRzZXRfc2VsZWN0aW9uX3JhbmdlKCBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQsIHNlbGVjdGlvbl9zdGF0ZS5hbmNob3JfaW5kZXgsIGNlbGxfaW5kZXgsICdkcmF3aW5nJyApO1xuXHRcdFx0c2VsZWN0aW9uX3N0YXRlLnBvaW50ZXJfaWQgPSBldmVudC5wb2ludGVySWQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29tcGxldGUgYSBwb2ludGVyIGRyYWZ0IG9yIHByb2Nlc3Mgb25lIHRvdWNoLXNhZmUgYm91bmRhcnkgdGFwLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXItdXAgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfc2VsZWN0aW9uX3BvaW50ZXJfdXAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGNhbmRpZGF0ZTtcblxuXHRcdFx0aWYgKCBzZWxlY3Rpb25fcmVzaXplX3N0YXRlICYmIHNlbGVjdGlvbl9yZXNpemVfc3RhdGUucG9pbnRlcl9pZCA9PT0gZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHRjb21wbGV0ZV9zZWxlY3Rpb25fcmVzaXplKCBldmVudCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUgJiYgdG91Y2hfc2VsZWN0aW9uX2NhbmRpZGF0ZS5wb2ludGVyX2lkID09PSBldmVudC5wb2ludGVySWQgKSB7XG5cdFx0XHRcdGNhbmRpZGF0ZSA9IHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGU7XG5cdFx0XHRcdHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUgPSBudWxsO1xuXHRcdFx0XHRpZiAoIGNhbmRpZGF0ZS5tb3ZlZCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAndG91Y2hfc3RhcnQnID09PSBzZWxlY3Rpb25fc3RhdGUucGhhc2UgJiYgc2VsZWN0aW9uX3N0YXRlLnJlc291cmNlX2lkID09PSBjYW5kaWRhdGUucmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0c2V0X3NlbGVjdGlvbl9yYW5nZSggY2FuZGlkYXRlLnJlc291cmNlX2lkLCBzZWxlY3Rpb25fc3RhdGUuYW5jaG9yX2luZGV4LCBjYW5kaWRhdGUuY2VsbF9pbmRleCwgJ2RyYWZ0JyApO1xuXHRcdFx0XHRcdHJlcXVlc3Rfc2VsZWN0aW9uX3ByZXZpZXcoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzZXRfc2VsZWN0aW9uX3JhbmdlKCBjYW5kaWRhdGUucmVzb3VyY2VfaWQsIGNhbmRpZGF0ZS5jZWxsX2luZGV4LCBjYW5kaWRhdGUuY2VsbF9pbmRleCwgJ3RvdWNoX3N0YXJ0JyApO1xuXHRcdFx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5hbmNob3JfaW5kZXggPSBjYW5kaWRhdGUuY2VsbF9pbmRleDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdkcmF3aW5nJyAhPT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlIHx8IHNlbGVjdGlvbl9zdGF0ZS5wb2ludGVyX2lkICE9PSBldmVudC5wb2ludGVySWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5wb2ludGVyX2lkID0gbnVsbDtcblx0XHRcdHNlbGVjdGlvbl9zdGF0ZS5waGFzZSA9ICdkcmFmdCc7XG5cdFx0XHRyZW5kZXJfc2VsZWN0aW9uKCk7XG5cdFx0XHRyZXF1ZXN0X3NlbGVjdGlvbl9wcmV2aWV3KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWJhbmRvbiBvbmx5IHRoZSBhY3RpdmUgcG9pbnRlciBnZXN0dXJlIHdoZW4gdGhlIGJyb3dzZXIgY2FuY2VscyBpdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBDYW5jZWxsZWQgcG9pbnRlciBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9zZWxlY3Rpb25fcG9pbnRlcl9jYW5jZWwoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCB0b3VjaF9zZWxlY3Rpb25fY2FuZGlkYXRlICYmIHRvdWNoX3NlbGVjdGlvbl9jYW5kaWRhdGUucG9pbnRlcl9pZCA9PT0gZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHR0b3VjaF9zZWxlY3Rpb25fY2FuZGlkYXRlID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggc2VsZWN0aW9uX3Jlc2l6ZV9zdGF0ZSAmJiBzZWxlY3Rpb25fcmVzaXplX3N0YXRlLnBvaW50ZXJfaWQgPT09IGV2ZW50LnBvaW50ZXJJZCApIHtcblx0XHRcdFx0cmVzdG9yZV9zZWxlY3Rpb25fcmVzaXplKCB0cnVlICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnZHJhd2luZycgPT09IHNlbGVjdGlvbl9zdGF0ZS5waGFzZSAmJiBzZWxlY3Rpb25fc3RhdGUucG9pbnRlcl9pZCA9PT0gZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHRjYW5jZWxfc2VsZWN0aW9uKCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFRyZWF0IHVuZXhwZWN0ZWQgcG9pbnRlci1jYXB0dXJlIGxvc3MgYXMgYSBjYW5jZWxsZWQgbG9jYWwgZ2VzdHVyZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBMb3N0LXBvaW50ZXItY2FwdHVyZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9zZWxlY3Rpb25fbG9zdF9wb2ludGVyX2NhcHR1cmUoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBzZWxlY3Rpb25fcmVzaXplX3N0YXRlICYmIHNlbGVjdGlvbl9yZXNpemVfc3RhdGUucG9pbnRlcl9pZCA9PT0gZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHRyZXN0b3JlX3NlbGVjdGlvbl9yZXNpemUoIHRydWUgKTtcblx0XHRcdH0gZWxzZSBpZiAoICdkcmF3aW5nJyA9PT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlICYmIHNlbGVjdGlvbl9zdGF0ZS5wb2ludGVyX2lkID09PSBldmVudC5wb2ludGVySWQgKSB7XG5cdFx0XHRcdGNhbmNlbF9zZWxlY3Rpb24oIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUHJvdmlkZSBzdGFydC9lbmQgc2VsZWN0aW9uIHRocm91Z2ggdGhlIGZvY3VzZWQgUmVzb3VyY2Ugcm93LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBLZXlib2FyZCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGV2ZW50IGJlbG9uZ2VkIHRvIHNlbGVjdGlvbiBtZWNoYW5pY3MuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3NlbGVjdGlvbl9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdHZhciB0cmFjayA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24tdHJhY2tdJyApO1xuXHRcdFx0dmFyIGhhbmRsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24taGFuZGxlXScgKTtcblx0XHRcdHZhciByZXNvdXJjZV9pZDtcblx0XHRcdHZhciBjdXJzb3JfaW5kZXg7XG5cdFx0XHR2YXIgZGlyZWN0aW9uO1xuXG5cdFx0XHRpZiAoICdFc2NhcGUnID09PSBldmVudC5rZXkgJiYgJ2lkbGUnICE9PSBzZWxlY3Rpb25fc3RhdGUucGhhc2UgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlmICggJ2FwcGx5aW5nJyA9PT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlICkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc2VsZWN0aW9uX3Jlc2l6ZV9zdGF0ZSApIHtcblx0XHRcdFx0XHRyZXN0b3JlX3NlbGVjdGlvbl9yZXNpemUoIHRydWUgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjYW5jZWxfc2VsZWN0aW9uKCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGhhbmRsZSAmJiBoYW5kbGVfc2VsZWN0aW9uX2hhbmRsZV9rZXlkb3duKCBldmVudCwgaGFuZGxlICkgKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHRyYWNrIHx8IC0xID09PSBbICdBcnJvd0xlZnQnLCAnQXJyb3dSaWdodCcsICdFbnRlcicsICcgJyBdLmluZGV4T2YoIGV2ZW50LmtleSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggdHJhY2suZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWlkJyApICk7XG5cdFx0XHRjdXJzb3JfaW5kZXggPSBOdW1iZXIoIHRyYWNrLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24tY3Vyc29yJyApICk7XG5cdFx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCBjdXJzb3JfaW5kZXggKSB8fCAwID4gY3Vyc29yX2luZGV4ICkge1xuXHRcdFx0XHRjdXJzb3JfaW5kZXggPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIHNldHRpbmdzLmF4aXMuY2VsbHMubGVuZ3RoIC0gMSwgTWF0aC5mbG9vciggc2V0dGluZ3MuYXhpcy5jZWxscy5sZW5ndGggLyAyICkgKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnQXJyb3dMZWZ0JyA9PT0gZXZlbnQua2V5IHx8ICdBcnJvd1JpZ2h0JyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRkaXJlY3Rpb24gPSAoICdBcnJvd1JpZ2h0JyA9PT0gZXZlbnQua2V5ID8gMSA6IC0xICkgKiAoIHNldHRpbmdzLmlzX3J0bCA/IC0xIDogMSApO1xuXHRcdFx0XHRjdXJzb3JfaW5kZXggPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIHNldHRpbmdzLmF4aXMuY2VsbHMubGVuZ3RoIC0gMSwgY3Vyc29yX2luZGV4ICsgZGlyZWN0aW9uICkgKTtcblx0XHRcdFx0dHJhY2suc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1jdXJzb3InLCBjdXJzb3JfaW5kZXggKTtcblx0XHRcdFx0aWYgKCBldmVudC5zaGlmdEtleSApIHtcblx0XHRcdFx0XHRpZiAoICdrZXlib2FyZF9zdGFydCcgIT09IHNlbGVjdGlvbl9zdGF0ZS5waGFzZSB8fCBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQgIT09IHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRcdFx0c2V0X3NlbGVjdGlvbl9yYW5nZSggcmVzb3VyY2VfaWQsIGN1cnNvcl9pbmRleCAtIGRpcmVjdGlvbiwgY3Vyc29yX2luZGV4LCAna2V5Ym9hcmRfc3RhcnQnICk7XG5cdFx0XHRcdFx0XHRzZWxlY3Rpb25fc3RhdGUuYW5jaG9yX2luZGV4ID0gY3Vyc29yX2luZGV4IC0gZGlyZWN0aW9uO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzZXRfc2VsZWN0aW9uX3JhbmdlKCByZXNvdXJjZV9pZCwgc2VsZWN0aW9uX3N0YXRlLmFuY2hvcl9pbmRleCwgY3Vyc29yX2luZGV4LCAna2V5Ym9hcmRfc3RhcnQnICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIHRyYWNrLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY190aW1lbGluZV9fY2FudmFzX2NlbGwnICksIGZ1bmN0aW9uICggY2VsbCwgY2VsbF9pbmRleCApIHtcblx0XHRcdFx0XHRjZWxsLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3Rpb24tY3Vyc29yJywgY2VsbF9pbmRleCA9PT0gY3Vyc29yX2luZGV4ICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0aWYgKCAna2V5Ym9hcmRfc3RhcnQnID09PSBzZWxlY3Rpb25fc3RhdGUucGhhc2UgJiYgc2VsZWN0aW9uX3N0YXRlLnJlc291cmNlX2lkID09PSByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0c2VsZWN0aW9uX3N0YXRlLnBoYXNlID0gJ2RyYWZ0Jztcblx0XHRcdFx0cmVuZGVyX3NlbGVjdGlvbigpO1xuXHRcdFx0XHRyZXF1ZXN0X3NlbGVjdGlvbl9wcmV2aWV3KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhYm9ydF9zZWxlY3Rpb25fcHJldmlld19yZXF1ZXN0KCk7XG5cdFx0XHRcdHNldF9zZWxlY3Rpb25fcmFuZ2UoIHJlc291cmNlX2lkLCBjdXJzb3JfaW5kZXgsIGN1cnNvcl9pbmRleCwgJ2tleWJvYXJkX3N0YXJ0JyApO1xuXHRcdFx0XHRzZWxlY3Rpb25fc3RhdGUuYW5jaG9yX2luZGV4ID0gY3Vyc29yX2luZGV4O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIHNlbGVjdGlvbiBwb3BvdmVyIGFjdGlvbnMgdGhyb3VnaCBUaW1lbGluZSdzIGRlbGVnYXRlZCBjbGljayBwYXRoLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBUaW1lbGluZSBjbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSBzZWxlY3Rpb24gYWN0aW9uIG93bmVkIHRoZSBldmVudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGV2ZW50ICkge1xuXHRcdFx0dmFyIHNlbGVjdGlvbl9jYW5jZWwgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc2VsZWN0aW9uLWNhbmNlbF0nICk7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX3JldHJ5ID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1yZXRyeV0nICk7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX2Jsb2NrID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXNlbGVjdGlvbi1ibG9ja10nICk7XG5cblx0XHRcdGlmICggc2VsZWN0aW9uX2NhbmNlbCApIHtcblx0XHRcdFx0Y2FuY2VsX3NlbGVjdGlvbiggdHJ1ZSApO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggc2VsZWN0aW9uX3JldHJ5ICkge1xuXHRcdFx0XHRyZXF1ZXN0X3NlbGVjdGlvbl9wcmV2aWV3KCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzZWxlY3Rpb25fYmxvY2sgKSB7XG5cdFx0XHRcdGFwcGx5X3NlbGVjdGlvbl9ibG9jayggc2VsZWN0aW9uX2Jsb2NrLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24tYmxvY2snICkgKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXBvcnQgd2hldGhlciBhIGxvY2FsIGVtcHR5LXJhbmdlIGRyYWZ0IGN1cnJlbnRseSBleGlzdHMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGZvciBldmVyeSBub24taWRsZSBzZWxlY3Rpb24gcGhhc2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfYWN0aXZlKCkge1xuXHRcdFx0cmV0dXJuICdpZGxlJyAhPT0gc2VsZWN0aW9uX3N0YXRlLnBoYXNlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcG9ydCB3aGV0aGVyIGEgYm91bmRhcnkgcG9pbnRlciBnZXN0dXJlIGN1cnJlbnRseSBvd25zIGF0dGVudGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hpbGUgYSBzdGFydC9lbmQgaGFuZGxlIGlzIGJlaW5nIHJlc2l6ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfcmVzaXppbmcoKSB7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggc2VsZWN0aW9uX3Jlc2l6ZV9zdGF0ZSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgcG9pbnRlciBvd25lcnNoaXAgZXhhY3RseSBvbmNlIGZvciB0aGlzIFRpbWVsaW5lIG1vdW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdFx0aWYgKCAhIG1vdW50IHx8IGlzX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpc19pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0XHRtb3VudC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtZW1wdHktcmFuZ2Utc2VsZWN0aW9uLXJlYWR5JywgJ3RydWUnICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBoYW5kbGVfc2VsZWN0aW9uX3BvaW50ZXJfZG93biApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJtb3ZlJywgaGFuZGxlX3NlbGVjdGlvbl9wb2ludGVyX21vdmUgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVydXAnLCBoYW5kbGVfc2VsZWN0aW9uX3BvaW50ZXJfdXAgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVyY2FuY2VsJywgaGFuZGxlX3NlbGVjdGlvbl9wb2ludGVyX2NhbmNlbCApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ2xvc3Rwb2ludGVyY2FwdHVyZScsIGhhbmRsZV9zZWxlY3Rpb25fbG9zdF9wb2ludGVyX2NhcHR1cmUgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBUZWFyIGRvd24gcmVxdWVzdHMsIHBvaW50ZXIgY2FwdHVyZSwgbGlzdGVuZXJzLCB0aW1lcnMsIGFuZCBsb2NhbCBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZGVzdHJveSgpIHtcblx0XHRcdHZhciBhY3RpdmVfcG9pbnRlcl9pZCA9IHNlbGVjdGlvbl9yZXNpemVfc3RhdGUgPyBzZWxlY3Rpb25fcmVzaXplX3N0YXRlLnBvaW50ZXJfaWQgOiBzZWxlY3Rpb25fc3RhdGUucG9pbnRlcl9pZDtcblx0XHRcdHZhciBzZWxlY3Rpb25fdHJhY2sgPSBnZXRfc2VsZWN0aW9uX3RyYWNrKCBzZWxlY3Rpb25fc3RhdGUucmVzb3VyY2VfaWQgKTtcblxuXHRcdFx0aWYgKCAhIGlzX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHNlbGVjdGlvbl90cmFja1xuXHRcdFx0XHQmJiBudWxsICE9PSBhY3RpdmVfcG9pbnRlcl9pZFxuXHRcdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2VsZWN0aW9uX3RyYWNrLmhhc1BvaW50ZXJDYXB0dXJlXG5cdFx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZWxlY3Rpb25fdHJhY2sucmVsZWFzZVBvaW50ZXJDYXB0dXJlXG5cdFx0XHRcdCYmIHNlbGVjdGlvbl90cmFjay5oYXNQb2ludGVyQ2FwdHVyZSggYWN0aXZlX3BvaW50ZXJfaWQgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHNlbGVjdGlvbl90cmFjay5yZWxlYXNlUG9pbnRlckNhcHR1cmUoIGFjdGl2ZV9wb2ludGVyX2lkICk7XG5cdFx0XHR9XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmRvd24nLCBoYW5kbGVfc2VsZWN0aW9uX3BvaW50ZXJfZG93biApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJtb3ZlJywgaGFuZGxlX3NlbGVjdGlvbl9wb2ludGVyX21vdmUgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVydXAnLCBoYW5kbGVfc2VsZWN0aW9uX3BvaW50ZXJfdXAgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdwb2ludGVyY2FuY2VsJywgaGFuZGxlX3NlbGVjdGlvbl9wb2ludGVyX2NhbmNlbCApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2xvc3Rwb2ludGVyY2FwdHVyZScsIGhhbmRsZV9zZWxlY3Rpb25fbG9zdF9wb2ludGVyX2NhcHR1cmUgKTtcblx0XHRcdG1vdW50LnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1lbXB0eS1yYW5nZS1zZWxlY3Rpb24tcmVhZHknICk7XG5cdFx0XHRpc19pbml0aWFsaXplZCA9IGZhbHNlO1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5zZXRfYXBwbHlfbG9hZGluZyApIHtcblx0XHRcdFx0Y29udGV4dC5zZXRfYXBwbHlfbG9hZGluZyggZmFsc2UsICcnICk7XG5cdFx0XHR9XG5cdFx0XHRyZXNldF9zZWxlY3Rpb25fc3RhdGUoKTtcblx0XHRcdHJlbmRlcl9zZWxlY3Rpb24oKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdGRlc3Ryb3k6IGRlc3Ryb3ksXG5cdFx0XHRoYW5kbGVfY2xpY2s6IGhhbmRsZV9jbGljayxcblx0XHRcdGhhbmRsZV9rZXlkb3duOiBoYW5kbGVfc2VsZWN0aW9uX2tleWRvd24sXG5cdFx0XHRpc19hY3RpdmU6IGlzX2FjdGl2ZSxcblx0XHRcdGlzX3Jlc2l6aW5nOiBpc19yZXNpemluZyxcblx0XHRcdGNvbnN1bWVfc2lnbmVkX2FjdGlvbl9jb250ZXh0OiBjb25zdW1lX3NpZ25lZF9hY3Rpb25fY29udGV4dCxcblx0XHRcdGNhbmNlbDogY2FuY2VsX3NlbGVjdGlvbixcblx0XHRcdHJlc2V0OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNhbmNlbF9zZWxlY3Rpb24oIGZhbHNlICk7XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyOiByZW5kZXJfc2VsZWN0aW9uLFxuXHRcdFx0cG9zaXRpb25fcG9wb3ZlcjogcG9zaXRpb25fc2VsZWN0aW9uX3BvcG92ZXJcblx0XHR9O1xuXHR9XG5cblx0aWYgKCB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzLnJlZ2lzdGVyX2ZhY3RvcnkgKSB7XG5cdFx0d2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5KCBtb2R1bGVfaWQsIGNyZWF0ZV9lbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlciApO1xuXHR9XG59KCB3aW5kb3csIGRvY3VtZW50ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxTQUFTLEdBQUcsdUJBQXVCOztFQUV2QztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyx1Q0FBdUNBLENBQUVDLE9BQU8sRUFBRztJQUMzRCxJQUFJQyxLQUFLLEdBQUdELE9BQU8sQ0FBQ0MsS0FBSyxJQUFJLElBQUk7SUFDakMsSUFBSUMsUUFBUSxHQUFHRixPQUFPLENBQUNFLFFBQVEsSUFBSSxDQUFDLENBQUM7SUFDckMsSUFBSUMsaUJBQWlCLEdBQUcsSUFBSTtJQUM1QixJQUFJQyw0QkFBNEIsR0FBRyxDQUFDO0lBQ3BDLElBQUlDLHVCQUF1QixHQUFHLENBQUM7SUFDL0IsSUFBSUMseUJBQXlCLEdBQUcsSUFBSTtJQUNwQyxJQUFJQyxzQkFBc0IsR0FBRyxJQUFJO0lBQ2pDLElBQUlDLGVBQWUsR0FBR0MsNEJBQTRCLENBQUMsQ0FBQztJQUNwRCxJQUFJQyxjQUFjLEdBQUcsS0FBSzs7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
