"use strict";

/**
 * Development-only Timeline time-row selection and action adapter.
 *
 * The adapter owns local gestures and one presentation-only draft. It consumes
 * accepted geometry from the time-rows module. The existing Timeline server
 * endpoints remain authoritative for preview, action eligibility, mutation,
 * and canonical readback.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp) {
  'use strict';

  var module_id = 'time_rows_selection';
  var surface_selector = '.wpbc_timeline_time_rows__timed_surface';
  var panel_selector = '[data-wpbc-timeline-time-rows-panel="canvas"]';
  var canvas_selector = '[data-wpbc-timeline-canvas]';
  var column_selector = '[data-wpbc-timeline-time-rows-date]';
  var overlay_selector = '[data-wpbc-timeline-time-rows-selection-overlay]';
  var boundary_selector = '[data-wpbc-timeline-time-rows-selection-boundary]';
  var fold_choice_selector = '[data-wpbc-timeline-time-rows-selection-fold-choice]';
  var actions_selector = '[data-wpbc-timeline-time-rows-selection-actions]';
  var ready_actions_inline_size = 560;
  var status_actions_inline_size = 440;
  var minimum_actions_inline_size = 340;
  var minimum_actions_block_size = 150;
  var actions_separation_pixels = 8;
  var excluded_selector = ['.wpbc_timeline_time_rows__booking', '.wpbc_timeline_time_rows__overflow', '.wpbc_timeline_time_rows__canvas_toolbar', '[data-wpbc-timeline-booking-select]', '[data-wpbc-booking-overview-info-trigger]', '[data-wpbc-timeline-booking-details-action]', '[data-wpbc-timeline-booking-movement-grip]', '[data-wpbc-timeline-booking-resize-handle]', '[data-wpbc-timeline-booking-resize-host]', overlay_selector, 'button', 'a', 'input', 'select', 'textarea', 'summary', 'details'].join(',');

  /**
   * Choose an action-popover side from measured available space.
   *
   * Expanded time rows prefer a horizontal side that preserves the readable
   * minimum width. When both sides fit, the roomier side wins; an exact tie
   * uses logical inline-end. Narrow layouts fall back to the established
   * below/above policy without covering the selected range.
   *
   * @param {number} minimum_inline_size Readable minimum popover width.
   * @param {number} actions_block_size  Measured popover block size.
   * @param {number} available_left      Available pixels left of the selection.
   * @param {number} available_right     Available pixels right of the selection.
   * @param {number} available_above     Available pixels above the selection.
   * @param {number} available_below     Available pixels below the selection.
   * @param {string} direction           Accepted `ltr` or `rtl` direction.
   * @return {string} `left`, `right`, `above`, or `below`.
   */
  function resolve_actions_placement(minimum_inline_size, actions_block_size, available_left, available_right, available_above, available_below, direction) {
    var left_fits = available_left >= minimum_inline_size;
    var right_fits = available_right >= minimum_inline_size;
    if (left_fits && right_fits) {
      if (available_left === available_right) {
        return 'rtl' === direction ? 'left' : 'right';
      }
      return available_left > available_right ? 'left' : 'right';
    }
    if (right_fits) {
      return 'right';
    }
    if (left_fits) {
      return 'left';
    }
    if (available_below >= actions_block_size) {
      return 'below';
    }
    if (available_above >= actions_block_size) {
      return 'above';
    }
    return available_above > available_below ? 'above' : 'below';
  }

  /**
   * Position an action popover beyond the complete selected block range.
   *
   * Keeping this calculation independent from viewport clamping prevents a
   * constrained popover from covering either editable boundary control.
   *
   * @param {string} placement            `above` or `below`.
   * @param {number} selection_block_start Selected range outer start edge.
   * @param {number} selection_block_end   Selected range outer end edge.
   * @param {number} actions_block_size    Rendered popover block size.
   * @param {number} separation_pixels     Required visual separation.
   * @return {number} Popover block-start coordinate.
   */
  function resolve_actions_block_start(placement, selection_block_start, selection_block_end, actions_block_size, separation_pixels) {
    return 'above' === placement ? selection_block_start - actions_block_size - separation_pixels : selection_block_end + separation_pixels;
  }

  /**
   * Position a horizontally placed popover outside the selected slice union.
   *
   * @param {string} placement             Physical `left` or `right` side.
   * @param {number} selection_inline_left Selected range physical left edge.
   * @param {number} selection_inline_right Selected range physical right edge.
   * @param {number} actions_inline_size   Rendered popover inline size.
   * @param {number} separation_pixels     Required visual separation.
   * @return {number} Physical popover inline-start coordinate.
   */
  function resolve_actions_inline_start(placement, selection_inline_left, selection_inline_right, actions_inline_size, separation_pixels) {
    return 'left' === placement ? selection_inline_left - actions_inline_size - separation_pixels : selection_inline_right + separation_pixels;
  }

  /**
   * Report whether a chronological boundary would cross its opposite endpoint.
   *
   * @param {string} boundary_name  Start or end.
   * @param {number} coordinate_order Candidate chronological order.
   * @param {number} opposite_order   Opposite endpoint order.
   * @return {boolean} True when the candidate must clamp to the opposite end.
   */
  function is_boundary_crossing(boundary_name, coordinate_order, opposite_order) {
    return 'start' === boundary_name && coordinate_order > opposite_order || 'end' === boundary_name && coordinate_order < opposite_order;
  }

  /**
   * Create one local draft controller.
   *
   * @param {Object}  context               Timeline module context.
   * @param {Element} context.mount         Timeline mount.
   * @param {Object}  context.configuration Executable-free configuration.
   * @return {Object} Symmetric lifecycle and development inspection API.
   */
  function create_selection_controller(context) {
    var mount = context.mount || null;
    var configuration = context.configuration || {};
    var selection_api = context.selection_api || {};
    var modules = window.wpbc_timeline_modules || null;
    var geometry = window.wpbc_timeline_time_rows_interaction_geometry || null;
    var time_rows_configuration = configuration.time_rows || {};
    var template_ids = configuration.templates || {};
    var i18n = configuration.i18n || {};
    var selection_step_minutes = Number(configuration.selection_step_minutes);
    var touch_tolerance_pixels = Math.max(0, Number(configuration.gesture && configuration.gesture.touch_tolerance_pixels) || 8);
    var enhanced_surfaces = [];
    var active_state = null;
    var pending_touch = null;
    var pending_frame = 0;
    var pending_focus_coordinate = null;
    var selection_request = null;
    var selection_request_generation = 0;
    var preserve_draft_during_booking_creation_readback = false;
    var is_initialized = false;

    /**
     * Interpolate a fixed translated label.
     *
     * @param {string} label        Source label.
     * @param {Object} replacements Plain replacement strings.
     * @return {string} Interpolated label.
     */
    function interpolate_label(label, replacements) {
      return Object.keys(replacements || {}).reduce(function (result, key) {
        return result.split('{' + key + '}').join(String(replacements[key]));
      }, String(label || ''));
    }

    /**
     * Return a fixed allow-listed WordPress template.
     *
     * @param {string} key Semantic template key.
     * @return {Function|null} Template function or null.
     */
    function get_template(key) {
      var template_id = String(template_ids[key] || '');
      if (!template_id || !wp || 'function' !== typeof wp.template) {
        return null;
      }
      return wp.template(template_id);
    }

    /**
     * Format a wall minute without browser timezone conversion.
     *
     * @param {number} wall_minute Minute from local midnight.
     * @return {string} Stable HH:MM label.
     */
    function format_wall_minute(wall_minute) {
      var bounded_minute = Math.max(0, Math.min(1440, Number(wall_minute) || 0));
      var hour = Math.floor(bounded_minute / 60);
      var minute = bounded_minute % 60;
      return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    }

    /**
     * Format a server-derived numeric UTC offset without browser timezone APIs.
     *
     * @param {number} offset_minutes Signed minutes east of UTC.
     * @return {string} Exact UTC offset such as UTC+02:00.
     */
    function format_utc_offset(offset_minutes) {
      var normalized_offset = Number(offset_minutes);
      var sign;
      var absolute_offset;
      if (!Number.isFinite(normalized_offset)) {
        return '';
      }
      sign = 0 <= normalized_offset ? '+' : '-';
      absolute_offset = Math.abs(normalized_offset);
      return 'UTC' + sign + String(Math.floor(absolute_offset / 60)).padStart(2, '0') + ':' + String(absolute_offset % 60).padStart(2, '0');
    }

    /**
     * Format an exact draft duration without browser-timezone conversion.
     *
     * @param {number} duration_minutes Exact elapsed duration in minutes.
     * @return {string} Compact translated hours-and-minutes label.
     */
    function format_duration(duration_minutes) {
      var total_minutes = Math.max(0, Math.round(Number(duration_minutes) || 0));
      var hours = Math.floor(total_minutes / 60);
      var minutes = total_minutes % 60;
      var hours_label = hours ? interpolate_label(i18n.duration_hours_short, {
        count: hours
      }) : '';
      var minutes_label = minutes || !hours ? interpolate_label(i18n.duration_minutes_short, {
        count: minutes
      }) : '';
      if (hours_label && minutes_label) {
        return interpolate_label(i18n.duration_hours_minutes_short, {
          hours: hours_label,
          minutes: minutes_label
        });
      }
      return hours_label || minutes_label;
    }

    /**
     * Format one exact geometry candidate for a concise visible endpoint label.
     *
     * The pure geometry kernel supplies the wall date, minute, and authoritative
     * numeric offset. The visible boundary intentionally shows only the accepted
     * wall date and time; exact offsets remain available in fold choices and the
     * authoritative preview contract.
     *
     * @param {Object} candidate Exact start or end geometry candidate.
     * @return {string} Accepted wall date and time.
     */
    function format_visible_endpoint(candidate) {
      if (!candidate || !candidate.date || !Number.isFinite(Number(candidate.wall_minute))) {
        return '';
      }
      return candidate.date + ' ' + format_wall_minute(candidate.wall_minute);
    }

    /**
     * Return the current time-rows instance without retaining it.
     *
     * @return {Object|null} Time-rows instance or null.
     */
    function get_time_rows_instance() {
      if (!modules || 'function' !== typeof modules.get_instance) {
        return null;
      }
      return modules.get_instance(String(time_rows_configuration.instance_id || ''));
    }

    /**
     * Resolve a surface's Resource and accepted cache identity.
     *
     * @param {Element} surface Timed surface.
     * @return {Object|null} Panel identity or null.
     */
    function get_surface_identity(surface) {
      var panel = surface && surface.closest ? surface.closest(panel_selector) : null;
      var resource_id = Number(panel && panel.getAttribute('data-wpbc-timeline-time-rows-resource-id'));
      if (!panel || !Number.isInteger(resource_id) || 1 > resource_id) {
        return null;
      }
      return {
        panel: panel,
        resource_id: resource_id,
        cache_key: String(panel.getAttribute('data-wpbc-timeline-time-rows-cache-key') || '')
      };
    }

    /**
     * Find the current rendered timed surface for one Resource.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {Element|null} Current surface or null after removal.
     */
    function find_current_surface(resource_id) {
      return Array.prototype.find.call(mount ? mount.querySelectorAll(surface_selector) : [], function (surface) {
        var identity = get_surface_identity(surface);
        return identity && identity.resource_id === Number(resource_id);
      }) || null;
    }

    /**
     * Measure logical date columns for one immutable gesture snapshot.
     *
     * @param {Element} surface Timed surface.
     * @param {string}  direction ltr or rtl.
     * @return {Array<Object>} Ordered logical column DTOs.
     */
    function measure_date_columns(surface, direction) {
      var surface_rect = surface.getBoundingClientRect();
      return Array.prototype.map.call(surface.querySelectorAll(column_selector), function (column) {
        var column_rect = column.getBoundingClientRect();
        var logical_start = 'rtl' === direction ? surface_rect.right - column_rect.right : column_rect.left - surface_rect.left;
        var logical_end = 'rtl' === direction ? surface_rect.right - column_rect.left : column_rect.right - surface_rect.left;
        return {
          date: String(column.getAttribute('data-wpbc-timeline-time-rows-date') || ''),
          logical_start: Math.max(0, logical_start),
          logical_end: Math.max(0, logical_end)
        };
      });
    }

    /**
     * Prepare exactly one accepted and measured snapshot for a gesture.
     *
     * @param {Element} surface Timed surface.
     * @return {Object|null} Gesture context or null when identity is stale.
     */
    function prepare_gesture_context(surface) {
      var surface_identity = get_surface_identity(surface);
      var time_rows = get_time_rows_instance();
      var accepted_context;
      var direction;
      var surface_style;
      var surface_rect;
      var booking_column_gutter_px;
      var prepared;
      if (!surface_identity || !geometry || 'function' !== typeof geometry.prepare_geometry || !time_rows || 'function' !== typeof time_rows.get_interaction_geometry_context) {
        return null;
      }
      accepted_context = time_rows.get_interaction_geometry_context(surface_identity.resource_id);
      if (!accepted_context || surface_identity.cache_key !== String(accepted_context.cache_key || '')) {
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
        surface: surface,
        panel: surface_identity.panel,
        resource_id: surface_identity.resource_id,
        cache_key: surface_identity.cache_key,
        surface_rect: surface_rect,
        booking_column_gutter_px: booking_column_gutter_px,
        snapshot: prepared.snapshot
      };
    }

    /**
     * Convert a PointerEvent into the snapshot's physical coordinate DTO.
     *
     * @param {Object} gesture_context Immutable gesture context.
     * @param {Object} event           Pointer-like event.
     * @return {Object} Geometry coordinate.
     */
    function pointer_coordinate(gesture_context, event) {
      return {
        source: 'pointer',
        selection_kind: String(configuration.selection_kind || 'timed'),
        inline_px: Number(event.clientX) - gesture_context.surface_rect.left,
        block_px: Number(event.clientY) - gesture_context.surface_rect.top
      };
    }

    /**
     * Convert one visible boundary position to its endpoint cell coordinate.
     *
     * End controls are painted at the half-open interval end, while the pure
     * geometry kernel stores the selected cell whose end creates that boundary.
     * Subtracting one approved step keeps pointer edits aligned with keyboard
     * edits and exact server instants.
     *
     * @param {string}       boundary_name Start or end.
     * @param {PointerEvent} event         Active boundary pointer event.
     * @return {Object} Bounded pointer coordinate for the geometry kernel.
     */
    function pointer_boundary_coordinate(boundary_name, event) {
      var snapshot = active_state.snapshot;
      var step_extent = snapshot.selection_step_minutes * snapshot.pixels_per_minute;
      var maximum_block = Math.max(0, snapshot.block_extent_px - step_extent);
      var maximum_inline = Math.max(0, active_state.surface_rect.width - 0.001);
      var coordinate = pointer_coordinate({
        surface_rect: active_state.surface_rect
      }, event);
      if ('end' === boundary_name) {
        coordinate.block_px -= step_extent;
      }
      coordinate.inline_px = Math.max(0, Math.min(maximum_inline, coordinate.inline_px));
      coordinate.block_px = Math.max(0, Math.min(maximum_block, coordinate.block_px));
      return coordinate;
    }

    /**
     * Build a keyboard coordinate from a date and bounded snap index.
     *
     * @param {Object} snapshot Geometry snapshot.
     * @param {string} date     Accepted date.
     * @param {number} index    Candidate snap index.
     * @return {Object} Keyboard coordinate.
     */
    function keyboard_coordinate(snapshot, date, index) {
      var maximum_index = Math.max(0, Math.ceil((snapshot.visible_range.end_minute - snapshot.visible_range.start_minute) / snapshot.selection_step_minutes) - 1);
      return {
        source: 'keyboard',
        selection_kind: String(configuration.selection_kind || 'timed'),
        date: String(date || ''),
        snap_index: Math.max(0, Math.min(maximum_index, Number(index) || 0))
      };
    }

    /**
     * Locate one rendered date inside the gesture-owned column collection.
     *
     * @param {Object} snapshot Geometry snapshot.
     * @param {string} date     Server date key.
     * @return {number} Zero-based column index or -1.
     */
    function get_column_index(snapshot, date) {
      return snapshot.date_columns.findIndex(function (column) {
        return column.date === date;
      });
    }

    /**
     * Resolve the model coordinates used even for non-exact DST drafts.
     *
     * @param {Object} draft Draft result.
     * @return {Object|null} Ordered start/end cells or null.
     */
    function get_draft_cells(draft) {
      var anchor;
      var focus;
      var anchor_key;
      var focus_key;
      if (!draft || !active_state) {
        return null;
      }
      anchor = geometry.resolve_coordinate(active_state.snapshot, active_state.anchor_coordinate);
      focus = geometry.resolve_coordinate(active_state.snapshot, active_state.focus_coordinate);
      if (!anchor || !focus || ['invalid', 'outside'].indexOf(anchor.status) !== -1 || ['invalid', 'outside'].indexOf(focus.status) !== -1) {
        return null;
      }
      anchor_key = get_column_index(active_state.snapshot, anchor.date) * 100000 + anchor.snap_index;
      focus_key = get_column_index(active_state.snapshot, focus.date) * 100000 + focus.snap_index;
      return anchor_key <= focus_key ? {
        start: anchor,
        end: focus,
        start_endpoint: 'anchor'
      } : {
        start: focus,
        end: anchor,
        start_endpoint: 'focus'
      };
    }

    /**
     * Return one geometry coordinate's stable chronological order.
     *
     * @param {Object} coordinate Pointer or keyboard geometry coordinate.
     * @return {number|null} Comparable accepted order or null.
     */
    function get_coordinate_order(coordinate) {
      var resolved = geometry.resolve_coordinate(active_state.snapshot, coordinate);
      var date_index;
      if (!resolved || ['invalid', 'outside'].indexOf(resolved.status) !== -1) {
        return null;
      }
      date_index = get_column_index(active_state.snapshot, resolved.date);
      return -1 === date_index ? null : date_index * 100000 + resolved.snap_index;
    }

    /**
     * Replace the endpoint currently represented by a chronological boundary.
     *
     * Crossing boundaries swaps which raw gesture endpoint owns Start or End.
     * Resolving that mapping for every update keeps the dragged control attached
     * to the same chronological boundary.
     *
     * @param {string} boundary_name Start or end.
     * @param {Object} coordinate    Replacement pointer or keyboard coordinate.
     * @return {void}
     */
    function update_boundary_coordinate(boundary_name, coordinate) {
      var boundary_uses_anchor = 'start' === boundary_name && 'anchor' === active_state.start_endpoint || 'end' === boundary_name && 'focus' === active_state.start_endpoint;
      var opposite_coordinate = boundary_uses_anchor ? active_state.focus_coordinate : active_state.anchor_coordinate;
      var coordinate_order = get_coordinate_order(coordinate);
      var opposite_order = get_coordinate_order(opposite_coordinate);
      if (null !== coordinate_order && null !== opposite_order && is_boundary_crossing(boundary_name, coordinate_order, opposite_order)) {
        coordinate = opposite_coordinate;
      }
      if (boundary_uses_anchor) {
        active_state.anchor_coordinate = coordinate;
      } else {
        active_state.focus_coordinate = coordinate;
      }
    }

    /**
     * Build at most one visual slice for each accepted date in the draft.
     *
     * @param {Object} cells          Ordered selected cells.
     * @param {string} duration_label Exact visual duration or an empty string.
     * @return {Array<Object>} Bounded template slice models.
     */
    function build_slices(cells, duration_label) {
      var snapshot = active_state.snapshot;
      var booking_column_gutter_px = Math.max(0, Number(active_state.booking_column_gutter_px) || 0);
      var start_order = snapshot.date_order[cells.start.date];
      var end_order = snapshot.date_order[cells.end.date];
      var visible_start = snapshot.visible_range.start_minute;
      var visible_end = snapshot.visible_range.end_minute;
      var slices = [];
      var duration_slice = null;
      snapshot.date_columns.forEach(function (column) {
        var order = snapshot.date_order[column.date];
        var column_width = column.logical_end - column.logical_start;
        var column_gutter = Math.min(booking_column_gutter_px, Math.max(0, (column_width - 2) / 2));
        var start_minute;
        var end_minute;
        if (order < start_order || order > end_order) {
          return;
        }
        start_minute = column.date === cells.start.date ? cells.start.wall_minute : visible_start;
        end_minute = column.date === cells.end.date ? cells.end.wall_minute + snapshot.selection_step_minutes : visible_end;
        start_minute = Math.max(visible_start, Math.min(visible_end, start_minute));
        end_minute = Math.max(start_minute, Math.min(visible_end, end_minute));
        slices.push({
          inline_start_px: Number((column.logical_start + column_gutter).toFixed(3)),
          inline_size_px: Number(Math.max(2, column_width - column_gutter * 2).toFixed(3)),
          block_start_px: Number(((start_minute - visible_start) * snapshot.pixels_per_minute).toFixed(3)),
          block_size_px: Number(Math.max(2, (end_minute - start_minute) * snapshot.pixels_per_minute).toFixed(3))
        });
      });
      if (duration_label) {
        duration_slice = slices.reduce(function (selected_slice, slice) {
          return !selected_slice || slice.block_size_px > selected_slice.block_size_px ? slice : selected_slice;
        }, null);
        if (duration_slice) {
          duration_slice.duration_label = duration_label;
        }
      }
      return slices;
    }

    /**
     * Return one boundary's accessible template model.
     *
     * @param {Object} cell         Resolved cell.
     * @param {string} boundary     start or end.
     * @return {Object} Slider and position model.
     */
    function build_boundary_model(cell, boundary) {
      var snapshot = active_state.snapshot;
      var column = snapshot.date_columns[get_column_index(snapshot, cell.date)];
      var is_end = 'end' === boundary;
      var wall_minute = cell.wall_minute + (is_end ? snapshot.selection_step_minutes : 0);
      var label = cell.date + ' ' + format_wall_minute(wall_minute);
      var maximum_index = Math.max(0, Math.ceil((snapshot.visible_range.end_minute - snapshot.visible_range.start_minute) / snapshot.selection_step_minutes) - 1);
      return {
        label: interpolate_label(is_end ? i18n.end_control_label : i18n.start_control_label, {
          time: label
        }),
        value_min: 0,
        value_max: maximum_index,
        value_now: cell.snap_index,
        value_text: label,
        inline_px: Number((column.logical_start + (column.logical_end - column.logical_start) / 2).toFixed(3)),
        block_px: Number(Math.max(0, Math.min(snapshot.block_extent_px, (wall_minute - snapshot.visible_range.start_minute) * snapshot.pixels_per_minute)).toFixed(3))
      };
    }

    /**
     * Build executable-free choices for every unresolved repeated-hour boundary.
     *
     * Candidate instants and offsets come from the accepted server date bands.
     * The adapter never derives an authoritative offset from the browser timezone.
     *
     * @param {Object} cells Chronologically ordered start and end cells.
     * @return {Array<Object>} Ordered accessible fold-choice template models.
     */
    function build_fold_choices(cells) {
      var choices = [];
      var start_endpoint = String(cells && cells.start_endpoint || '');
      ['start', 'end'].forEach(function (boundary_name) {
        var cell = cells && cells[boundary_name];
        var endpoint = 'start' === boundary_name ? start_endpoint : 'anchor' === start_endpoint ? 'focus' : 'anchor';
        var boundary_label = 'start' === boundary_name ? i18n.fold_start_boundary : i18n.fold_end_boundary;
        if (!cell || 'fold' !== cell.status || !Array.isArray(cell.candidates)) {
          return;
        }
        cell.candidates.forEach(function (candidate) {
          var offset_label = format_utc_offset(candidate.offset_minutes);
          if (!candidate.occurrence_id || !offset_label) {
            return;
          }
          choices.push({
            endpoint: endpoint,
            occurrence_id: String(candidate.occurrence_id),
            label: interpolate_label(i18n.fold_choice_label, {
              boundary: boundary_label,
              date: cell.date,
              time: format_wall_minute(cell.wall_minute),
              offset: offset_label
            })
          });
        });
      });
      return choices;
    }

    /**
     * Announce local draft state without invoking a request.
     *
     * @param {string} message Accessible message.
     * @return {void}
     */
    function announce(message) {
      var status = active_state && active_state.surface.querySelector('[data-wpbc-timeline-time-rows-selection-status]');
      if (status) {
        status.textContent = String(message || '');
      }
    }

    /**
     * Keep one action popover inside the visible Timeline canvas.
     *
     * This is presentation-only geometry. Selection instants continue using the
     * immutable gesture snapshot and server-axis geometry.
     *
     * @param {Element} actions       Rendered action popover.
     * @param {Object}  state         Active local selection state.
     * @param {Object}  start_control Start boundary presentation model.
     * @param {Object}  end_control   End boundary presentation model.
     * @return {void}
     */
    function position_actions(actions, state, start_control, end_control) {
      var canvas = state.panel && state.panel.closest ? state.panel.closest(canvas_selector) : mount ? mount.querySelector(canvas_selector) : null;
      var duration = actions.parentNode ? actions.parentNode.querySelector('[data-wpbc-timeline-time-rows-selection-duration]') : null;
      var surface_rectangle = state.surface.getBoundingClientRect();
      var canvas_rectangle = canvas ? canvas.getBoundingClientRect() : surface_rectangle;
      var anchor_rectangle = duration ? duration.getBoundingClientRect() : null;
      var presentation_slices = Array.isArray(state.presentation_slices) ? state.presentation_slices : [];
      var viewport_width = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0);
      var viewport_height = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0);
      var visible_inline_start = Math.max(canvas_rectangle.left, 8);
      var visible_inline_end = Math.min(canvas_rectangle.right, viewport_width || canvas_rectangle.right) - 8;
      var visible_block_start = Math.max(surface_rectangle.top, 8);
      var visible_block_end = Math.min(surface_rectangle.bottom, viewport_height || surface_rectangle.bottom) - 8;
      var desired_inline_size = 'ready' === state.phase ? ready_actions_inline_size : status_actions_inline_size;
      var available_inline_size = Math.max(1, visible_inline_end - visible_inline_start);
      var available_block_size = Math.max(80, visible_block_end - visible_block_start);
      var actions_inline_size = Math.min(desired_inline_size, available_inline_size);
      var actions_block_size;
      var anchor_inline;
      var anchor_block_center;
      var anchor_block_start;
      var anchor_block_end;
      var selection_inline_start;
      var selection_inline_end;
      var selection_inline_left;
      var selection_inline_right;
      var selection_block_start;
      var selection_block_end;
      var inline_start;
      var block_start;
      var available_left;
      var available_right;
      var available_above;
      var available_below;
      var placement;
      var placement_space;
      var placement_block_limit;
      var logical_inline_start;
      actions.style.setProperty('--wpbc-time-rows-selection-popover-inline-size', Math.floor(actions_inline_size) + 'px');
      actions.style.setProperty('--wpbc-time-rows-selection-popover-min-inline-size', Math.floor(Math.min(minimum_actions_inline_size, available_inline_size)) + 'px');
      actions.style.setProperty('--wpbc-time-rows-selection-popover-min-block-size', Math.floor(Math.min(minimum_actions_block_size, available_block_size)) + 'px');
      actions.style.removeProperty('--wpbc-time-rows-selection-popover-max-block-size');
      actions_block_size = actions.offsetHeight || 190;
      anchor_inline = anchor_rectangle ? anchor_rectangle.left + anchor_rectangle.width / 2 : 'rtl' === state.snapshot.direction ? surface_rectangle.right - end_control.inline_px : surface_rectangle.left + end_control.inline_px;
      selection_block_start = presentation_slices.reduce(function (current_start, slice) {
        return Math.min(current_start, Number(slice.block_start_px));
      }, Math.min(start_control.block_px, end_control.block_px));
      selection_block_end = presentation_slices.reduce(function (current_end, slice) {
        return Math.max(current_end, Number(slice.block_start_px) + Number(slice.block_size_px));
      }, Math.max(start_control.block_px, end_control.block_px));
      selection_inline_start = presentation_slices.reduce(function (current_start, slice) {
        return Math.min(current_start, Number(slice.inline_start_px));
      }, Math.min(start_control.inline_px, end_control.inline_px));
      selection_inline_end = presentation_slices.reduce(function (current_end, slice) {
        return Math.max(current_end, Number(slice.inline_start_px) + Number(slice.inline_size_px));
      }, Math.max(start_control.inline_px, end_control.inline_px));
      selection_inline_left = 'rtl' === state.snapshot.direction ? surface_rectangle.right - selection_inline_end : surface_rectangle.left + selection_inline_start;
      selection_inline_right = 'rtl' === state.snapshot.direction ? surface_rectangle.right - selection_inline_start : surface_rectangle.left + selection_inline_end;
      anchor_block_start = surface_rectangle.top + selection_block_start;
      anchor_block_end = surface_rectangle.top + selection_block_end;
      available_left = Math.max(0, selection_inline_left - visible_inline_start - actions_separation_pixels);
      available_right = Math.max(0, visible_inline_end - selection_inline_right - actions_separation_pixels);
      available_above = Math.max(0, anchor_block_start - visible_block_start - actions_separation_pixels);
      available_below = Math.max(0, visible_block_end - anchor_block_end - actions_separation_pixels);
      placement = resolve_actions_placement(minimum_actions_inline_size, actions_block_size, available_left, available_right, available_above, available_below, state.snapshot.direction);
      if ('left' === placement || 'right' === placement) {
        placement_space = 'left' === placement ? available_left : available_right;
        actions_inline_size = Math.min(desired_inline_size, placement_space);
        actions.style.setProperty('--wpbc-time-rows-selection-popover-inline-size', Math.floor(actions_inline_size) + 'px');
        actions_block_size = actions.offsetHeight || 190;
        placement_block_limit = available_block_size;
      } else {
        placement_space = 'above' === placement ? available_above : available_below;
        placement_block_limit = Math.max(80, Math.min(placement_space, available_block_size));
      }
      actions.style.setProperty('--wpbc-time-rows-selection-popover-min-block-size', Math.floor(Math.min(minimum_actions_block_size, placement_block_limit)) + 'px');
      if (placement_block_limit < actions_block_size) {
        actions.style.setProperty('--wpbc-time-rows-selection-popover-max-block-size', Math.floor(placement_block_limit) + 'px');
        actions_block_size = actions.offsetHeight || Math.min(190, placement_block_limit);
      }
      if ('left' === placement || 'right' === placement) {
        inline_start = resolve_actions_inline_start(placement, selection_inline_left, selection_inline_right, actions_inline_size, actions_separation_pixels);
        anchor_block_center = anchor_rectangle ? anchor_rectangle.top + anchor_rectangle.height / 2 : (anchor_block_start + anchor_block_end) / 2;
        block_start = Math.max(visible_block_start, Math.min(visible_block_end - actions_block_size, anchor_block_center - actions_block_size / 2));
      } else {
        inline_start = Math.max(visible_inline_start, Math.min(visible_inline_end - actions_inline_size, anchor_inline - actions_inline_size / 2));
        block_start = resolve_actions_block_start(placement, anchor_block_start, anchor_block_end, actions_block_size, actions_separation_pixels);
      }
      logical_inline_start = 'rtl' === state.snapshot.direction ? surface_rectangle.right - inline_start - actions_inline_size : inline_start - surface_rectangle.left;
      actions.setAttribute('data-wpbc-timeline-time-rows-selection-placement', placement);
      actions.style.setProperty('--wpbc-time-rows-selection-popover-inline', logical_inline_start + 'px');
      actions.style.setProperty('--wpbc-time-rows-selection-popover-block', block_start - surface_rectangle.top + 'px');
    }

    /**
     * Render the authoritative preview/action state inside the retained overlay.
     *
     * @param {Element} overlay Current draft overlay.
     * @return {void}
     */
    function render_actions(overlay) {
      var state = active_state;
      var actions_template = get_template('actions');
      var holder;
      var actions;
      var start_control;
      var end_control;
      if (!state || !overlay || !actions_template || ['previewing', 'ready', 'error', 'applying', 'awaiting_readback'].indexOf(state.phase) === -1) {
        return;
      }
      start_control = build_boundary_model(state.cells.start, 'start');
      end_control = build_boundary_model(state.cells.end, 'end');
      holder = document.createElement('div');
      holder.innerHTML = actions_template({
        state: state.phase,
        preview: state.preview,
        error_message: state.error_message,
        i18n: i18n
      });
      actions = holder.firstElementChild;
      if (!actions) {
        return;
      }
      overlay.appendChild(actions);
      position_actions(actions, state, start_control, end_control);
    }

    /**
     * Render one bounded overlay through the fixed WordPress template.
     *
     * @return {void}
     */
    function render_draft() {
      var state = active_state;
      var draft_template = get_template('draft');
      var draft;
      var cells;
      var holder;
      var overlay;
      var start_label;
      var end_label;
      var duration_label;
      var start_endpoint_label;
      var end_endpoint_label;
      var status_message;
      var presentation_slices;
      var start_control;
      var end_control;
      pending_frame = 0;
      if (!state || !state.surface.isConnected || !draft_template) {
        return;
      }
      draft = geometry.resolve_draft(state.snapshot, state.anchor_coordinate, state.focus_coordinate);
      cells = get_draft_cells(draft);
      if (!draft || !cells || 'invalid' === draft.status) {
        return;
      }
      start_label = cells.start.date + ' ' + format_wall_minute(cells.start.wall_minute);
      end_label = cells.end.date + ' ' + format_wall_minute(cells.end.wall_minute + state.snapshot.selection_step_minutes);
      duration_label = 'exact' === draft.status ? format_duration(draft.duration_minutes) : '';
      start_endpoint_label = duration_label ? interpolate_label(i18n.draft_start_summary, {
        start: format_visible_endpoint(draft.start)
      }) : '';
      end_endpoint_label = duration_label ? interpolate_label(i18n.draft_end_summary, {
        end: format_visible_endpoint(draft.end)
      }) : '';
      status_message = 'gap' === draft.status ? i18n.dst_gap : 'fold' === draft.status ? i18n.dst_fold : i18n.draft_ready;
      if ('previewing' === state.phase) {
        status_message = i18n.checking_selection;
      } else if ('ready' === state.phase) {
        status_message = i18n.preview_ready;
      } else if ('applying' === state.phase) {
        status_message = i18n.applying_availability;
      } else if ('awaiting_readback' === state.phase) {
        status_message = i18n.awaiting_readback;
      } else if ('error' === state.phase) {
        status_message = state.error_message || i18n.preview_error;
      }
      state.surface.querySelectorAll(overlay_selector).forEach(function (existing_overlay) {
        existing_overlay.remove();
      });
      start_control = build_boundary_model(cells.start, 'start');
      end_control = build_boundary_model(cells.end, 'end');
      presentation_slices = build_slices(cells, duration_label);
      holder = document.createElement('div');
      holder.innerHTML = draft_template({
        status: draft.status,
        phase: state.phase,
        draft_identity: String(draft.draft_identity || ''),
        resource_id: state.resource_id,
        label: interpolate_label(duration_label ? i18n.draft_label_with_duration : i18n.draft_label, {
          start: start_label,
          end: end_label,
          duration: duration_label
        }),
        status_id: state.status_id,
        active_boundary: state.pointer_boundary,
        slices: presentation_slices,
        start_endpoint_label: start_endpoint_label,
        end_endpoint_label: end_endpoint_label,
        start_control: start_control,
        end_control: end_control,
        fold_choices: build_fold_choices(cells),
        fold_group_label: i18n.fold_group_label,
        fold_instructions: i18n.fold_instructions
      });
      overlay = holder.firstElementChild;
      if (!overlay) {
        return;
      }
      state.surface.appendChild(overlay);
      state.draft = draft;
      state.cells = cells;
      state.start_endpoint = cells.start_endpoint;
      state.presentation_slices = presentation_slices;
      render_actions(overlay);
      if (state.focus_actions_after_render) {
        state.focus_actions_after_render = false;
        window.requestAnimationFrame(function () {
          var first_action = state.surface.querySelector(actions_selector + ' a[href], ' + actions_selector + ' button:not([disabled])');
          if (first_action) {
            first_action.focus();
          }
        });
      }
      announce(status_message);
      if (state.focus_boundary) {
        window.requestAnimationFrame(function () {
          var boundary = state.surface.querySelector(boundary_selector + '[data-wpbc-timeline-time-rows-selection-boundary="' + state.focus_boundary + '"]');
          state.focus_boundary = '';
          if (boundary) {
            boundary.focus();
          }
        });
      }
      if (state.commit_after_render && 'exact' === draft.status) {
        state.commit_after_render = false;
        window.requestAnimationFrame(request_selection_preview);
      }
    }

    /**
     * Coalesce visual-only draft updates into one animation frame.
     *
     * @param {Object|null} focus_coordinate Optional replacement focus coordinate.
     * @return {void}
     */
    function schedule_render(focus_coordinate) {
      if (focus_coordinate) {
        pending_focus_coordinate = focus_coordinate;
      }
      if (pending_frame) {
        return;
      }
      pending_frame = window.requestAnimationFrame(function () {
        if (active_state && pending_focus_coordinate) {
          active_state.focus_coordinate = pending_focus_coordinate;
        }
        pending_focus_coordinate = null;
        render_draft();
      });
    }

    /**
     * Abort only the adapter-owned preview or mutation request.
     *
     * Canonical Timeline readback remains page-controller owned and is never
     * cancelled by closing this local presentation.
     *
     * @return {void}
     */
    function abort_selection_request() {
      if (selection_request && 'function' === typeof selection_request.abort) {
        selection_request.abort();
      }
      selection_request = null;
      selection_request_generation += 1;
    }

    /**
     * Remove the draft and optionally restore its captured focus origin.
     *
     * @param {boolean} restore_focus Whether focus should return to its origin.
     * @param {boolean} announce_cancel Whether to announce cancellation first.
     * @return {void}
     */
    function cancel_draft(restore_focus, announce_cancel) {
      var state = active_state;
      var focus_origin = state && state.focus_origin;
      var resource_id = state && state.resource_id;
      if (pending_frame) {
        window.cancelAnimationFrame(pending_frame);
        pending_frame = 0;
      }
      pending_focus_coordinate = null;
      pending_touch = null;
      abort_selection_request();
      if (state && announce_cancel) {
        announce(i18n.cancelled);
      }
      if (state && state.surface) {
        state.surface.querySelectorAll(overlay_selector).forEach(function (overlay) {
          overlay.remove();
        });
      }
      active_state = null;
      if (restore_focus && focus_origin && focus_origin.isConnected && 'function' === typeof focus_origin.focus) {
        focus_origin.focus();
      } else if (restore_focus && resource_id) {
        window.requestAnimationFrame(function () {
          var replacement_surface;
          if (is_initialized) {
            enhance_surfaces();
          }
          replacement_surface = find_current_surface(resource_id);
          if (replacement_surface && 'function' === typeof replacement_surface.focus) {
            replacement_surface.focus();
          }
        });
      }
    }

    /**
     * Consume a ready timed selection only when its signed action token matches.
     *
     * The token is compared as an opaque scalar from the current server-owned
     * action URL. Unrelated timed drafts survive toolbar and other-surface
     * creation readbacks.
     *
     * @param {string} action_id Stable preview action identifier.
     * @param {string} query_arg Signed-token query argument name.
     * @param {string} token     Opaque signed token consumed by creation.
     * @return {boolean} True when the current timed draft matched and was cleared.
     */
    function consume_signed_action_context(action_id, query_arg, token) {
      var action = active_state && active_state.preview && active_state.preview.actions ? active_state.preview.actions[action_id] : null;
      var action_url;
      if (!active_state || 'ready' !== active_state.phase || !action || true !== action.authorized || true !== action.enabled || !action.url || !/^[a-zA-Z0-9_-]{1,64}$/.test(String(query_arg || '')) || !/^[A-Za-z0-9._-]{1,8192}$/.test(String(token || '')) || !window.URL) {
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
      cancel_draft(false, false);
      return true;
    }

    /**
     * Return fresh Timeline-owned request, coverage, and return context.
     *
     * @return {Object|null} Bounded request context or null.
     */
    function get_selection_request_context() {
      if ('function' !== typeof selection_api.get_request_context) {
        return null;
      }
      return selection_api.get_request_context();
    }

    /**
     * Request one authoritative preview for the current exact half-open draft.
     *
     * The server owns the selection step, signed loaded-window coverage,
     * Resource authorization, fresh domain reads, and enabled actions. A changed
     * draft/cache identity invalidates the response before it can render.
     *
     * @return {void}
     */
    function request_selection_preview() {
      var state = active_state;
      var request_context = get_selection_request_context();
      var transport = request_context && request_context.transport ? request_context.transport : {};
      var draft_identity;
      var cache_key;
      var generation;
      if (!state || !state.draft || 'exact' !== state.draft.status || !window.jQuery || !request_context || !transport.url || !transport.preview_action || !transport.preview_nonce || ['applying', 'awaiting_readback'].indexOf(state.phase) !== -1) {
        return;
      }
      abort_selection_request();
      generation = selection_request_generation;
      draft_identity = String(state.draft.draft_identity || '');
      cache_key = state.cache_key;
      state.phase = 'previewing';
      state.preview = null;
      state.error_message = '';
      render_draft();
      announce(i18n.checking_selection);
      selection_request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        timeout: Math.max(1000, Number(request_context.request_timeout_ms) || 15000),
        data: {
          action: transport.preview_action,
          nonce: transport.preview_nonce,
          resource_id: state.resource_id,
          selection_surface: String(configuration.selection_surface || 'time_rows'),
          selection_kind: String(state.draft.selection_kind || configuration.selection_kind || 'timed'),
          view: String(request_context.view || ''),
          start_at: state.draft.start.at,
          end_at: state.draft.end.at,
          loaded_start_at: String(request_context.loaded_start_at || ''),
          loaded_end_at: String(request_context.loaded_end_at || ''),
          loaded_context_tokens: Array.isArray(request_context.loaded_context_tokens) ? request_context.loaded_context_tokens.slice(0, 3) : [],
          return_context: request_context.return_context && 'object' === typeof request_context.return_context ? request_context.return_context : {}
        }
      }).done(function (response) {
        if (generation !== selection_request_generation || !active_state || cache_key !== active_state.cache_key || !active_state.draft || draft_identity !== String(active_state.draft.draft_identity || '')) {
          return;
        }
        if (!response || !response.success || !response.data || !response.data.selection || String(response.data.selection.selection_surface || '') !== String(configuration.selection_surface || 'time_rows')) {
          active_state.phase = 'error';
          active_state.error_message = i18n.preview_error;
          return;
        }
        active_state.preview = response.data;
        active_state.phase = 'ready';
        active_state.focus_actions_after_render = true;
        announce(i18n.preview_ready);
      }).fail(function (request, request_status) {
        var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};
        if (generation !== selection_request_generation || 'abort' === request_status || !active_state) {
          return;
        }
        active_state.phase = 'error';
        active_state.error_message = error.message || i18n.preview_error;
      }).always(function () {
        if (generation !== selection_request_generation) {
          return;
        }
        selection_request = null;
        render_draft();
      });
    }

    /**
     * Apply one explicitly activated server-authorized Availability action.
     *
     * @param {string} mode Block or unblock.
     * @return {void}
     */
    function apply_selection_availability(mode) {
      var state = active_state;
      var action = state && state.preview && state.preview.actions ? state.preview.actions[mode] : null;
      var request_context = get_selection_request_context();
      var transport = request_context && request_context.transport ? request_context.transport : {};
      var generation;
      var draft_identity;
      if (['block', 'unblock'].indexOf(mode) === -1 || !state || 'ready' !== state.phase || !action || true !== action.authorized || true !== action.enabled || !state.preview.block_token || !window.jQuery || !transport.url || !transport.apply_action || !transport.apply_nonce) {
        return;
      }
      selection_request_generation += 1;
      generation = selection_request_generation;
      draft_identity = String(state.draft.draft_identity || '');
      state.phase = 'applying';
      state.error_message = '';
      render_draft();
      announce(i18n.applying_availability);
      selection_request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        timeout: Math.max(1000, Number(request_context.request_timeout_ms) || 15000),
        data: {
          action: transport.apply_action,
          nonce: transport.apply_nonce,
          block_token: state.preview.block_token,
          mode: mode
        }
      }).done(function (response) {
        var readback_request;
        if (generation !== selection_request_generation || !active_state || draft_identity !== String(active_state.draft.draft_identity || '')) {
          return;
        }
        if (!response || !response.success) {
          active_state.phase = 'error';
          active_state.error_message = response && response.data && response.data.message ? response.data.message : i18n.apply_error;
          return;
        }
        selection_request = null;
        active_state.phase = 'awaiting_readback';
        render_draft();
        announce(i18n.awaiting_readback);
        readback_request = 'function' === typeof selection_api.refresh_after_apply ? selection_api.refresh_after_apply() : null;
        if (!readback_request || 'function' !== typeof readback_request.done || 'function' !== typeof readback_request.fail) {
          active_state.phase = 'error';
          active_state.error_message = i18n.apply_error;
          render_draft();
          return;
        }
        readback_request.done(function () {
          if (active_state && 'awaiting_readback' === active_state.phase && draft_identity === String(active_state.draft.draft_identity || '')) {
            cancel_draft(true, false);
          }
        }).fail(function () {
          if (active_state && 'awaiting_readback' === active_state.phase && draft_identity === String(active_state.draft.draft_identity || '')) {
            active_state.phase = 'error';
            active_state.error_message = i18n.apply_error;
            render_draft();
          }
        });
      }).fail(function (request, request_status) {
        var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};
        if (generation !== selection_request_generation || 'abort' === request_status || !active_state) {
          return;
        }
        active_state.phase = 'error';
        active_state.error_message = error.message || i18n.apply_error;
      }).always(function () {
        if (generation === selection_request_generation && active_state && 'awaiting_readback' !== active_state.phase) {
          selection_request = null;
          render_draft();
        }
      });
    }

    /**
     * Begin one local draft with a gesture-owned geometry snapshot.
     *
     * @param {Object} gesture_context Immutable gesture context.
     * @param {Object} coordinate      Initial geometry coordinate.
     * @param {Element} focus_origin   Focus restoration target.
     * @return {boolean} True when a resolvable draft began.
     */
    function begin_draft(gesture_context, coordinate, focus_origin) {
      var resolved = geometry.resolve_coordinate(gesture_context.snapshot, coordinate);
      if (!resolved || ['invalid', 'outside', 'gap'].indexOf(resolved.status) !== -1) {
        return false;
      }
      cancel_draft(false, false);
      active_state = {
        surface: gesture_context.surface,
        panel: gesture_context.panel,
        resource_id: gesture_context.resource_id,
        cache_key: gesture_context.cache_key,
        surface_rect: gesture_context.surface_rect,
        booking_column_gutter_px: gesture_context.booking_column_gutter_px,
        snapshot: gesture_context.snapshot,
        anchor_coordinate: coordinate,
        focus_coordinate: coordinate,
        focus_origin: focus_origin || gesture_context.surface,
        restore_focus_on_cancel: gesture_context.surface.contains(document.activeElement),
        pointer_id: null,
        pointer_type: '',
        pointer_boundary: '',
        boundary_drag_origin: null,
        touch_origin: null,
        status_id: 'wpbc-time-rows-selection-status-' + gesture_context.resource_id,
        focus_boundary: '',
        focus_actions_after_render: false,
        commit_after_render: false,
        phase: 'drafting',
        preview: null,
        error_message: '',
        draft: null,
        cells: null
      };
      schedule_render(coordinate);
      return true;
    }

    /**
     * Begin editing an existing draft through one visible boundary control.
     *
     * Existing preview authority is discarded immediately because any boundary
     * movement creates a new exact interval that requires a fresh explicit
     * commit. Pointer capture stays on the persistent timed surface because the
     * overlay and its controls are replaced during frame-coalesced rendering.
     *
     * @param {Element}      boundary Boundary slider control.
     * @param {PointerEvent} event    Primary pointer event.
     * @return {boolean} True when boundary editing started.
     */
    function begin_boundary_drag(boundary, event) {
      var boundary_name;
      if (!active_state || !boundary || !active_state.surface.contains(boundary) || ['applying', 'awaiting_readback'].indexOf(active_state.phase) !== -1 || 'mouse' === event.pointerType && 0 !== event.button) {
        return false;
      }
      boundary_name = String(boundary.getAttribute('data-wpbc-timeline-time-rows-selection-boundary') || '');
      if (['start', 'end'].indexOf(boundary_name) === -1) {
        return false;
      }
      active_state.surface_rect = active_state.surface.getBoundingClientRect();
      active_state.boundary_drag_origin = {
        anchor_coordinate: active_state.anchor_coordinate,
        focus_coordinate: active_state.focus_coordinate,
        phase: active_state.phase,
        preview: active_state.preview,
        error_message: active_state.error_message
      };
      abort_selection_request();
      active_state.pointer_id = event.pointerId;
      active_state.pointer_type = event.pointerType || 'mouse';
      active_state.pointer_boundary = boundary_name;
      active_state.phase = 'draft';
      active_state.preview = null;
      active_state.error_message = '';
      active_state.commit_after_render = false;
      active_state.surface.setPointerCapture(event.pointerId);
      schedule_render();
      event.preventDefault();
      return true;
    }

    /**
     * Restore a cancelled boundary drag without discarding the whole selection.
     *
     * @param {PointerEvent} event Cancelled pointer event.
     * @return {void}
     */
    function restore_boundary_drag(event) {
      var origin = active_state && active_state.boundary_drag_origin;
      if (!active_state || !origin) {
        return;
      }
      active_state.anchor_coordinate = origin.anchor_coordinate;
      active_state.focus_coordinate = origin.focus_coordinate;
      active_state.phase = 'previewing' === origin.phase ? 'draft' : origin.phase;
      active_state.preview = 'previewing' === origin.phase ? null : origin.preview;
      active_state.error_message = 'previewing' === origin.phase ? '' : origin.error_message;
      active_state.pointer_id = null;
      active_state.pointer_type = '';
      active_state.pointer_boundary = '';
      active_state.boundary_drag_origin = null;
      if (active_state.surface.hasPointerCapture(event.pointerId)) {
        active_state.surface.releasePointerCapture(event.pointerId);
      }
      schedule_render();
    }

    /**
     * Reject non-empty or reserved interaction targets.
     *
     * @param {Element} target Event target.
     * @param {Element} surface Candidate timed surface.
     * @return {boolean} True only for an eligible empty timed location.
     */
    function is_empty_surface_target(target, surface) {
      return Boolean(target && surface && surface.contains(target) && !target.closest(excluded_selector));
    }

    /**
     * Start mouse/pen dragging or a scroll-safe touch tap candidate.
     *
     * @param {PointerEvent} event Pointer down event.
     * @return {void}
     */
    function handle_pointer_down(event) {
      var boundary = event.target && event.target.closest ? event.target.closest(boundary_selector) : null;
      var surface = event.target && event.target.closest ? event.target.closest(surface_selector) : null;
      var gesture_context;
      var coordinate;
      if (boundary && begin_boundary_drag(boundary, event)) {
        return;
      }
      if (!surface || !mount.contains(surface) || !is_empty_surface_target(event.target, surface) || 'mouse' === event.pointerType && 0 !== event.button) {
        return;
      }
      gesture_context = prepare_gesture_context(surface);
      if (!gesture_context) {
        return;
      }
      coordinate = pointer_coordinate(gesture_context, event);
      if ('touch' === event.pointerType) {
        pending_touch = {
          surface: surface,
          panel: gesture_context.panel,
          resource_id: gesture_context.resource_id,
          cache_key: gesture_context.cache_key,
          surface_rect: gesture_context.surface_rect,
          snapshot: gesture_context.snapshot,
          pointer_id: event.pointerId,
          coordinate: coordinate,
          origin: {
            x: event.clientX,
            y: event.clientY
          }
        };
        return;
      }
      if (begin_draft(gesture_context, coordinate, surface)) {
        active_state.pointer_id = event.pointerId;
        active_state.pointer_type = event.pointerType || 'mouse';
        surface.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    }

    /**
     * Coalesce active mouse/pen drag updates; touch remains native scrolling.
     *
     * @param {PointerEvent} event Pointer move event.
     * @return {void}
     */
    function handle_pointer_move(event) {
      if (!active_state || active_state.pointer_id !== event.pointerId) {
        return;
      }
      if (active_state.pointer_boundary) {
        update_boundary_coordinate(active_state.pointer_boundary, pointer_boundary_coordinate(active_state.pointer_boundary, event));
        schedule_render();
        event.preventDefault();
        return;
      }
      if ('touch' === active_state.pointer_type) {
        return;
      }
      schedule_render(pointer_coordinate({
        surface_rect: active_state.surface_rect
      }, event));
      event.preventDefault();
    }

    /**
     * Complete a pointer draft or promote a stationary touch to one tap draft.
     *
     * @param {PointerEvent} event Pointer up event.
     * @return {void}
     */
    function handle_pointer_up(event) {
      var movement;
      var coordinate;
      if (pending_touch && pending_touch.pointer_id === event.pointerId) {
        movement = Math.hypot(event.clientX - pending_touch.origin.x, event.clientY - pending_touch.origin.y);
        if (movement > touch_tolerance_pixels) {
          pending_touch = null;
          return;
        }
        if (begin_draft(pending_touch, pending_touch.coordinate, pending_touch.surface)) {
          active_state.phase = 'draft';
          active_state.commit_after_render = true;
        }
        pending_touch = null;
        return;
      }
      if (!active_state || active_state.pointer_id !== event.pointerId) {
        return;
      }
      if (active_state.pointer_boundary) {
        update_boundary_coordinate(active_state.pointer_boundary, pointer_boundary_coordinate(active_state.pointer_boundary, event));
        active_state.pointer_id = null;
        active_state.pointer_type = '';
        active_state.pointer_boundary = '';
        active_state.boundary_drag_origin = null;
        active_state.phase = 'draft';
        active_state.preview = null;
        active_state.error_message = '';
        active_state.commit_after_render = true;
        schedule_render();
        if (active_state.surface.hasPointerCapture(event.pointerId)) {
          active_state.surface.releasePointerCapture(event.pointerId);
        }
        event.preventDefault();
        return;
      }
      coordinate = pointer_coordinate({
        surface_rect: active_state.surface_rect
      }, event);
      active_state.pointer_id = null;
      active_state.pointer_type = '';
      active_state.phase = 'draft';
      active_state.commit_after_render = true;
      schedule_render(coordinate);
      if (active_state.surface.hasPointerCapture(event.pointerId)) {
        active_state.surface.releasePointerCapture(event.pointerId);
      }
      event.preventDefault();
    }

    /**
     * Abandon only an unfinished pointer gesture.
     *
     * @param {PointerEvent} event Pointer cancellation event.
     * @return {void}
     */
    function handle_pointer_cancel(event) {
      if (pending_touch && pending_touch.pointer_id === event.pointerId) {
        pending_touch = null;
        return;
      }
      if (active_state && active_state.pointer_id === event.pointerId) {
        if (active_state.pointer_boundary) {
          restore_boundary_drag(event);
          return;
        }
        cancel_draft(false, false);
      }
    }

    /**
     * Move one keyboard coordinate by a physical arrow or boundary command.
     *
     * @param {Object} coordinate Current coordinate.
     * @param {string} key        Keyboard key.
     * @return {Object} Bounded replacement coordinate.
     */
    function move_keyboard_coordinate(coordinate, key) {
      var snapshot = active_state.snapshot;
      var date_index = get_column_index(snapshot, coordinate.date);
      var snap_index = coordinate.snap_index;
      var maximum_index = Math.max(0, Math.ceil((snapshot.visible_range.end_minute - snapshot.visible_range.start_minute) / snapshot.selection_step_minutes) - 1);
      var date_delta = 0;
      if ('ArrowUp' === key) {
        snap_index -= 1;
      } else if ('ArrowDown' === key) {
        snap_index += 1;
      } else if ('Home' === key) {
        snap_index = 0;
      } else if ('End' === key) {
        snap_index = maximum_index;
      } else if ('ArrowLeft' === key) {
        date_delta = 'rtl' === snapshot.direction ? 1 : -1;
      } else if ('ArrowRight' === key) {
        date_delta = 'rtl' === snapshot.direction ? -1 : 1;
      }
      date_index = Math.max(0, Math.min(snapshot.date_columns.length - 1, date_index + date_delta));
      return keyboard_coordinate(snapshot, snapshot.date_columns[date_index].date, snap_index);
    }

    /**
     * Start a keyboard draft or update the focused accessible boundary.
     *
     * @param {KeyboardEvent} event Keyboard event.
     * @return {void}
     */
    function handle_key_down(event) {
      var boundary = event.target && event.target.closest ? event.target.closest(boundary_selector) : null;
      var surface = event.target && event.target.closest ? event.target.closest(surface_selector) : null;
      var gesture_context;
      var coordinate;
      var boundary_name;
      if ('Escape' === event.key && active_state) {
        event.preventDefault();
        if (['applying', 'awaiting_readback'].indexOf(active_state.phase) !== -1) {
          return;
        }
        cancel_draft(true, true);
        return;
      }
      if (boundary && active_state) {
        if (['applying', 'awaiting_readback'].indexOf(active_state.phase) !== -1) {
          event.preventDefault();
          return;
        }
        if ('Enter' === event.key) {
          event.preventDefault();
          request_selection_preview();
          return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) === -1) {
          return;
        }
        boundary_name = String(boundary.getAttribute('data-wpbc-timeline-time-rows-selection-boundary') || '');
        coordinate = 'start' === boundary_name && 'anchor' === active_state.start_endpoint || 'end' === boundary_name && 'focus' === active_state.start_endpoint ? active_state.anchor_coordinate : active_state.focus_coordinate;
        coordinate = move_keyboard_coordinate(coordinate, event.key);
        update_boundary_coordinate(boundary_name, coordinate);
        active_state.focus_boundary = boundary_name;
        abort_selection_request();
        active_state.phase = 'draft';
        active_state.preview = null;
        active_state.error_message = '';
        schedule_render();
        event.preventDefault();
        return;
      }
      if (!surface || event.target !== surface || 'Enter' !== event.key && ' ' !== event.key) {
        return;
      }
      gesture_context = prepare_gesture_context(surface);
      if (!gesture_context || !gesture_context.snapshot.date_columns.length) {
        return;
      }
      coordinate = keyboard_coordinate(gesture_context.snapshot, gesture_context.snapshot.date_columns[0].date, 0);
      if (begin_draft(gesture_context, coordinate, surface)) {
        active_state.focus_boundary = 'end';
        active_state.phase = 'draft';
        event.preventDefault();
      }
    }

    /**
     * Handle explicit cancel, retry, Block, and Unblock activations.
     *
     * New Booking remains an ordinary server-signed link.
     *
     * @param {MouseEvent} event Delegated click event.
     * @return {void}
     */
    function handle_action_click(event) {
      var cancel_control = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-time-rows-selection-cancel]') : null;
      var retry_control = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-time-rows-selection-retry]') : null;
      var availability_control = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-time-rows-selection-availability]') : null;
      var fold_control = event.target && event.target.closest ? event.target.closest(fold_choice_selector) : null;
      var endpoint;
      var occurrence_id;
      var coordinate_key;
      if (fold_control && mount.contains(fold_control) && active_state) {
        endpoint = String(fold_control.getAttribute('data-wpbc-timeline-time-rows-selection-fold-endpoint') || '');
        occurrence_id = String(fold_control.getAttribute('data-wpbc-timeline-time-rows-selection-fold-choice') || '');
        coordinate_key = 'anchor' === endpoint ? 'anchor_coordinate' : 'focus' === endpoint ? 'focus_coordinate' : '';
        if (coordinate_key && occurrence_id && active_state[coordinate_key]) {
          event.preventDefault();
          active_state[coordinate_key] = Object.assign({}, active_state[coordinate_key], {
            occurrence_id: occurrence_id
          });
          active_state.phase = 'draft';
          active_state.preview = null;
          active_state.error_message = '';
          schedule_render();
        }
        return;
      }
      if (cancel_control && mount.contains(cancel_control)) {
        event.preventDefault();
        if (active_state && ['applying', 'awaiting_readback'].indexOf(active_state.phase) === -1) {
          cancel_draft(true, true);
        }
        return;
      }
      if (retry_control && mount.contains(retry_control)) {
        event.preventDefault();
        request_selection_preview();
        return;
      }
      if (availability_control && mount.contains(availability_control)) {
        event.preventDefault();
        apply_selection_availability(String(availability_control.getAttribute('data-wpbc-timeline-time-rows-selection-availability') || ''));
      }
    }

    /**
     * Remember when keyboard focus is owned by the current draft surface.
     *
     * @param {FocusEvent} event Delegated focus event.
     * @return {void}
     */
    function handle_focus_in(event) {
      if (active_state) {
        active_state.restore_focus_on_cancel = active_state.surface.contains(event.target);
      }
    }

    /**
     * Stop automatic restoration after the user deliberately leaves a draft.
     *
     * DOM replacement may disconnect the surface before focusout; retaining the
     * flag in that case permits restoration to the replacement surface.
     *
     * @param {FocusEvent} event Delegated focus event.
     * @return {void}
     */
    function handle_focus_out(event) {
      if (active_state && active_state.surface.isConnected && active_state.surface.contains(event.target) && (!event.relatedTarget || !active_state.surface.contains(event.relatedTarget))) {
        active_state.restore_focus_on_cancel = false;
      }
    }

    /**
     * Add keyboard semantics and an allow-listed status template to new surfaces.
     *
     * @return {void}
     */
    function enhance_surfaces() {
      var status_template = get_template('status');
      if (!mount || !status_template) {
        return;
      }
      mount.querySelectorAll(surface_selector).forEach(function (surface) {
        var identity;
        var record;
        var holder;
        if ('true' === surface.getAttribute('data-wpbc-timeline-time-rows-selection-ready')) {
          return;
        }
        identity = get_surface_identity(surface);
        if (!identity) {
          return;
        }
        record = {
          surface: surface,
          tabindex: surface.getAttribute('tabindex'),
          aria_label: surface.getAttribute('aria-label'),
          aria_description: surface.getAttribute('aria-description')
        };
        surface.setAttribute('data-wpbc-timeline-time-rows-selection-ready', 'true');
        surface.setAttribute('tabindex', '0');
        surface.setAttribute('aria-label', String(i18n.surface_label || ''));
        surface.setAttribute('aria-description', String(i18n.instructions || ''));
        holder = document.createElement('div');
        holder.innerHTML = status_template({
          status_id: 'wpbc-time-rows-selection-status-' + identity.resource_id,
          message: ''
        });
        if (holder.firstElementChild) {
          surface.appendChild(holder.firstElementChild);
        }
        enhanced_surfaces.push(record);
      });
    }

    /**
     * Cancel drafts whenever accepted data or rendered identity changes.
     *
     * @param {CustomEvent} event Lifecycle event.
     * @return {void}
     */
    function handle_identity_change(event) {
      var detail = event && event.detail || {};
      var is_global_identity_change = 'wpbc:timeline:data:booking-windows-accepted' === event.type || 'wpbc:timeline:data:availability-accepted' === event.type;
      var is_readback_state = 'wpbc:timeline:data:authoritative-readback-state' === event.type;
      if (is_readback_state && 'booking_creation' === String(detail.reason || '') && 'loading' === String(detail.state || '')) {
        preserve_draft_during_booking_creation_readback = true;
        return;
      }
      if (preserve_draft_during_booking_creation_readback && ('wpbc:timeline:data:booking-windows-accepted' === event.type || 'wpbc:timeline:data:availability-accepted' === event.type)) {
        window.requestAnimationFrame(enhance_surfaces);
        return;
      }
      if (is_readback_state && 'booking_creation' === String(detail.reason || '') && ['accepted', 'failed'].indexOf(String(detail.state || '')) !== -1) {
        preserve_draft_during_booking_creation_readback = false;
        window.requestAnimationFrame(enhance_surfaces);
        return;
      }
      if (is_readback_state && 'loading' === String(detail.state || '')) {
        return;
      }
      if (is_readback_state && 'failed' === String(detail.state || '')) {
        if (active_state && 'awaiting_readback' === active_state.phase) {
          active_state.phase = 'error';
          active_state.error_message = i18n.apply_error;
          render_draft();
        }
        return;
      }
      is_global_identity_change = is_global_identity_change || is_readback_state && 'accepted' === String(detail.state || '');
      if (pending_touch && (is_global_identity_change || Number(detail.resource_id) === pending_touch.resource_id)) {
        pending_touch = null;
      }
      if (active_state && (is_global_identity_change || Number(detail.resource_id) === active_state.resource_id)) {
        cancel_draft(Boolean(active_state.restore_focus_on_cancel), false);
      }
      window.requestAnimationFrame(enhance_surfaces);
    }

    /**
     * Initialize delegated local interaction listeners.
     *
     * @return {void}
     */
    function initialize() {
      if (is_initialized || !mount || !geometry || !Number.isInteger(selection_step_minutes) || 1 > selection_step_minutes) {
        return;
      }
      is_initialized = true;
      mount.addEventListener('pointerdown', handle_pointer_down);
      mount.addEventListener('pointermove', handle_pointer_move);
      mount.addEventListener('pointerup', handle_pointer_up);
      mount.addEventListener('pointercancel', handle_pointer_cancel);
      mount.addEventListener('keydown', handle_key_down);
      mount.addEventListener('click', handle_action_click);
      mount.addEventListener('focusin', handle_focus_in);
      mount.addEventListener('focusout', handle_focus_out);
      mount.addEventListener('wpbc:timeline:data:booking-windows-accepted', handle_identity_change);
      mount.addEventListener('wpbc:timeline:data:availability-accepted', handle_identity_change);
      mount.addEventListener('wpbc:timeline:data:authoritative-readback-state', handle_identity_change);
      mount.addEventListener('wpbc:timeline:row-presentation:rendered', handle_identity_change);
      mount.addEventListener('wpbc:timeline:row-presentation:closed', handle_identity_change);
      mount.addEventListener('wpbc:timeline:row-presentation:removed', handle_identity_change);
      enhance_surfaces();
    }

    /**
     * Destroy local state and restore attributes added by this adapter.
     *
     * @return {void}
     */
    function destroy() {
      if (!is_initialized || !mount) {
        return;
      }
      mount.removeEventListener('pointerdown', handle_pointer_down);
      mount.removeEventListener('pointermove', handle_pointer_move);
      mount.removeEventListener('pointerup', handle_pointer_up);
      mount.removeEventListener('pointercancel', handle_pointer_cancel);
      mount.removeEventListener('keydown', handle_key_down);
      mount.removeEventListener('click', handle_action_click);
      mount.removeEventListener('focusin', handle_focus_in);
      mount.removeEventListener('focusout', handle_focus_out);
      mount.removeEventListener('wpbc:timeline:data:booking-windows-accepted', handle_identity_change);
      mount.removeEventListener('wpbc:timeline:data:availability-accepted', handle_identity_change);
      mount.removeEventListener('wpbc:timeline:data:authoritative-readback-state', handle_identity_change);
      mount.removeEventListener('wpbc:timeline:row-presentation:rendered', handle_identity_change);
      mount.removeEventListener('wpbc:timeline:row-presentation:closed', handle_identity_change);
      mount.removeEventListener('wpbc:timeline:row-presentation:removed', handle_identity_change);
      cancel_draft(false, false);
      pending_touch = null;
      enhanced_surfaces.forEach(function (record) {
        var surface = record.surface;
        if (!surface || !surface.isConnected) {
          return;
        }
        surface.removeAttribute('data-wpbc-timeline-time-rows-selection-ready');
        [['tabindex', record.tabindex], ['aria-label', record.aria_label], ['aria-description', record.aria_description]].forEach(function (attribute) {
          if (null === attribute[1]) {
            surface.removeAttribute(attribute[0]);
          } else {
            surface.setAttribute(attribute[0], attribute[1]);
          }
        });
        surface.querySelectorAll('[data-wpbc-timeline-time-rows-selection-status]').forEach(function (status) {
          status.remove();
        });
      });
      enhanced_surfaces = [];
      preserve_draft_during_booking_creation_readback = false;
      is_initialized = false;
    }

    /**
     * Return bounded scalar state for development assertions.
     *
     * @return {Object} Draft lifecycle snapshot.
     */
    function get_state_snapshot() {
      return {
        is_initialized: is_initialized,
        has_draft: Boolean(active_state && active_state.draft),
        resource_id: active_state ? active_state.resource_id : 0,
        cache_key: active_state ? active_state.cache_key : '',
        draft_identity: active_state && active_state.draft ? String(active_state.draft.draft_identity || '') : '',
        status: active_state && active_state.draft ? String(active_state.draft.status || '') : 'idle',
        phase: active_state ? String(active_state.phase || '') : 'idle',
        has_preview: Boolean(active_state && active_state.preview),
        has_request: Boolean(selection_request),
        has_pending_frame: Boolean(pending_frame)
      };
    }
    return {
      initialize: initialize,
      destroy: destroy,
      cancel: function () {
        cancel_draft(true, true);
      },
      consume_signed_action_context: consume_signed_action_context,
      get_state_snapshot: get_state_snapshot
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_selection_controller);
  }
})(window, document, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS90aW1lLXJvd3Mtc2VsZWN0aW9uL19vdXQvdGltZS1yb3dzLXNlbGVjdGlvbi5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50Iiwid3AiLCJtb2R1bGVfaWQiLCJzdXJmYWNlX3NlbGVjdG9yIiwicGFuZWxfc2VsZWN0b3IiLCJjYW52YXNfc2VsZWN0b3IiLCJjb2x1bW5fc2VsZWN0b3IiLCJvdmVybGF5X3NlbGVjdG9yIiwiYm91bmRhcnlfc2VsZWN0b3IiLCJmb2xkX2Nob2ljZV9zZWxlY3RvciIsImFjdGlvbnNfc2VsZWN0b3IiLCJyZWFkeV9hY3Rpb25zX2lubGluZV9zaXplIiwic3RhdHVzX2FjdGlvbnNfaW5saW5lX3NpemUiLCJtaW5pbXVtX2FjdGlvbnNfaW5saW5lX3NpemUiLCJtaW5pbXVtX2FjdGlvbnNfYmxvY2tfc2l6ZSIsImFjdGlvbnNfc2VwYXJhdGlvbl9waXhlbHMiLCJleGNsdWRlZF9zZWxlY3RvciIsImpvaW4iLCJyZXNvbHZlX2FjdGlvbnNfcGxhY2VtZW50IiwibWluaW11bV9pbmxpbmVfc2l6ZSIsImFjdGlvbnNfYmxvY2tfc2l6ZSIsImF2YWlsYWJsZV9sZWZ0IiwiYXZhaWxhYmxlX3JpZ2h0IiwiYXZhaWxhYmxlX2Fib3ZlIiwiYXZhaWxhYmxlX2JlbG93IiwiZGlyZWN0aW9uIiwibGVmdF9maXRzIiwicmlnaHRfZml0cyIsInJlc29sdmVfYWN0aW9uc19ibG9ja19zdGFydCIsInBsYWNlbWVudCIsInNlbGVjdGlvbl9ibG9ja19zdGFydCIsInNlbGVjdGlvbl9ibG9ja19lbmQiLCJzZXBhcmF0aW9uX3BpeGVscyIsInJlc29sdmVfYWN0aW9uc19pbmxpbmVfc3RhcnQiLCJzZWxlY3Rpb25faW5saW5lX2xlZnQiLCJzZWxlY3Rpb25faW5saW5lX3JpZ2h0IiwiYWN0aW9uc19pbmxpbmVfc2l6ZSIsImlzX2JvdW5kYXJ5X2Nyb3NzaW5nIiwiYm91bmRhcnlfbmFtZSIsImNvb3JkaW5hdGVfb3JkZXIiLCJvcHBvc2l0ZV9vcmRlciIsImNyZWF0ZV9zZWxlY3Rpb25fY29udHJvbGxlciIsImNvbnRleHQiLCJtb3VudCIsImNvbmZpZ3VyYXRpb24iLCJzZWxlY3Rpb25fYXBpIiwibW9kdWxlcyIsIndwYmNfdGltZWxpbmVfbW9kdWxlcyIsImdlb21ldHJ5Iiwid3BiY190aW1lbGluZV90aW1lX3Jvd3NfaW50ZXJhY3Rpb25fZ2VvbWV0cnkiLCJ0aW1lX3Jvd3NfY29uZmlndXJhdGlvbiIsInRpbWVfcm93cyIsInRlbXBsYXRlX2lkcyIsInRlbXBsYXRlcyIsImkxOG4iLCJzZWxlY3Rpb25fc3RlcF9taW51dGVzIiwiTnVtYmVyIiwidG91Y2hfdG9sZXJhbmNlX3BpeGVscyIsIk1hdGgiLCJtYXgiLCJnZXN0dXJlIiwiZW5oYW5jZWRfc3VyZmFjZXMiLCJhY3RpdmVfc3RhdGUiLCJwZW5kaW5nX3RvdWNoIiwicGVuZGluZ19mcmFtZSIsInBlbmRpbmdfZm9jdXNfY29vcmRpbmF0ZSIsInNlbGVjdGlvbl9yZXF1ZXN0Iiwic2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbiIsInByZXNlcnZlX2RyYWZ0X2R1cmluZ19ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrIiwiaXNfaW5pdGlhbGl6ZWQiLCJpbnRlcnBvbGF0ZV9sYWJlbCIsImxhYmVsIiwicmVwbGFjZW1lbnRzIiwiT2JqZWN0Iiwia2V5cyIsInJlZHVjZSIsInJlc3VsdCIsImtleSIsInNwbGl0IiwiU3RyaW5nIiwiZ2V0X3RlbXBsYXRlIiwidGVtcGxhdGVfaWQiLCJ0ZW1wbGF0ZSIsImZvcm1hdF93YWxsX21pbnV0ZSIsIndhbGxfbWludXRlIiwiYm91bmRlZF9taW51dGUiLCJtaW4iLCJob3VyIiwiZmxvb3IiLCJtaW51dGUiLCJwYWRTdGFydCIsImZvcm1hdF91dGNfb2Zmc2V0Iiwib2Zmc2V0X21pbnV0ZXMiLCJub3JtYWxpemVkX29mZnNldCIsInNpZ24iLCJhYnNvbHV0ZV9vZmZzZXQiLCJpc0Zpbml0ZSIsImFicyIsImZvcm1hdF9kdXJhdGlvbiIsImR1cmF0aW9uX21pbnV0ZXMiLCJ0b3RhbF9taW51dGVzIiwicm91bmQiLCJob3VycyIsIm1pbnV0ZXMiLCJob3Vyc19sYWJlbCIsImR1cmF0aW9uX2hvdXJzX3Nob3J0IiwiY291bnQiLCJtaW51dGVzX2xhYmVsIiwiZHVyYXRpb25fbWludXRlc19zaG9ydCIsImR1cmF0aW9uX2hvdXJzX21pbnV0ZXNfc2hvcnQiLCJmb3JtYXRfdmlzaWJsZV9lbmRwb2ludCIsImNhbmRpZGF0ZSIsImRhdGUiLCJnZXRfdGltZV9yb3dzX2luc3RhbmNlIiwiZ2V0X2luc3RhbmNlIiwiaW5zdGFuY2VfaWQiLCJnZXRfc3VyZmFjZV9pZGVudGl0eSIsInN1cmZhY2UiLCJwYW5lbCIsImNsb3Nlc3QiLCJyZXNvdXJjZV9pZCIsImdldEF0dHJpYnV0ZSIsImlzSW50ZWdlciIsImNhY2hlX2tleSIsImZpbmRfY3VycmVudF9zdXJmYWNlIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmaW5kIiwiY2FsbCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpZGVudGl0eSIsIm1lYXN1cmVfZGF0ZV9jb2x1bW5zIiwic3VyZmFjZV9yZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwibWFwIiwiY29sdW1uIiwiY29sdW1uX3JlY3QiLCJsb2dpY2FsX3N0YXJ0IiwicmlnaHQiLCJsZWZ0IiwibG9naWNhbF9lbmQiLCJwcmVwYXJlX2dlc3R1cmVfY29udGV4dCIsInN1cmZhY2VfaWRlbnRpdHkiLCJhY2NlcHRlZF9jb250ZXh0Iiwic3VyZmFjZV9zdHlsZSIsImJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCIsInByZXBhcmVkIiwicHJlcGFyZV9nZW9tZXRyeSIsImdldF9pbnRlcmFjdGlvbl9nZW9tZXRyeV9jb250ZXh0IiwiZ2V0Q29tcHV0ZWRTdHlsZSIsInBhcnNlRmxvYXQiLCJnZXRQcm9wZXJ0eVZhbHVlIiwiYWNjZXB0ZWRfaWRlbnRpdHkiLCJkYXRlX2JhbmRzIiwiZGF0ZV9jb2x1bW5zIiwidmlzaWJsZV9yYW5nZSIsInpvb21fcGVyY2VudCIsImhvdXJfaGVpZ2h0X3B4IiwiYmxvY2tfZXh0ZW50X3B4IiwiaGVpZ2h0Iiwic3RhdHVzIiwic25hcHNob3QiLCJwb2ludGVyX2Nvb3JkaW5hdGUiLCJnZXN0dXJlX2NvbnRleHQiLCJldmVudCIsInNvdXJjZSIsInNlbGVjdGlvbl9raW5kIiwiaW5saW5lX3B4IiwiY2xpZW50WCIsImJsb2NrX3B4IiwiY2xpZW50WSIsInRvcCIsInBvaW50ZXJfYm91bmRhcnlfY29vcmRpbmF0ZSIsInN0ZXBfZXh0ZW50IiwicGl4ZWxzX3Blcl9taW51dGUiLCJtYXhpbXVtX2Jsb2NrIiwibWF4aW11bV9pbmxpbmUiLCJ3aWR0aCIsImNvb3JkaW5hdGUiLCJrZXlib2FyZF9jb29yZGluYXRlIiwiaW5kZXgiLCJtYXhpbXVtX2luZGV4IiwiY2VpbCIsImVuZF9taW51dGUiLCJzdGFydF9taW51dGUiLCJzbmFwX2luZGV4IiwiZ2V0X2NvbHVtbl9pbmRleCIsImZpbmRJbmRleCIsImdldF9kcmFmdF9jZWxscyIsImRyYWZ0IiwiYW5jaG9yIiwiZm9jdXMiLCJhbmNob3Jfa2V5IiwiZm9jdXNfa2V5IiwicmVzb2x2ZV9jb29yZGluYXRlIiwiYW5jaG9yX2Nvb3JkaW5hdGUiLCJmb2N1c19jb29yZGluYXRlIiwiaW5kZXhPZiIsInN0YXJ0IiwiZW5kIiwic3RhcnRfZW5kcG9pbnQiLCJnZXRfY29vcmRpbmF0ZV9vcmRlciIsInJlc29sdmVkIiwiZGF0ZV9pbmRleCIsInVwZGF0ZV9ib3VuZGFyeV9jb29yZGluYXRlIiwiYm91bmRhcnlfdXNlc19hbmNob3IiLCJvcHBvc2l0ZV9jb29yZGluYXRlIiwiYnVpbGRfc2xpY2VzIiwiY2VsbHMiLCJkdXJhdGlvbl9sYWJlbCIsInN0YXJ0X29yZGVyIiwiZGF0ZV9vcmRlciIsImVuZF9vcmRlciIsInZpc2libGVfc3RhcnQiLCJ2aXNpYmxlX2VuZCIsInNsaWNlcyIsImR1cmF0aW9uX3NsaWNlIiwiZm9yRWFjaCIsIm9yZGVyIiwiY29sdW1uX3dpZHRoIiwiY29sdW1uX2d1dHRlciIsInB1c2giLCJpbmxpbmVfc3RhcnRfcHgiLCJ0b0ZpeGVkIiwiaW5saW5lX3NpemVfcHgiLCJibG9ja19zdGFydF9weCIsImJsb2NrX3NpemVfcHgiLCJzZWxlY3RlZF9zbGljZSIsInNsaWNlIiwiYnVpbGRfYm91bmRhcnlfbW9kZWwiLCJjZWxsIiwiYm91bmRhcnkiLCJpc19lbmQiLCJlbmRfY29udHJvbF9sYWJlbCIsInN0YXJ0X2NvbnRyb2xfbGFiZWwiLCJ0aW1lIiwidmFsdWVfbWluIiwidmFsdWVfbWF4IiwidmFsdWVfbm93IiwidmFsdWVfdGV4dCIsImJ1aWxkX2ZvbGRfY2hvaWNlcyIsImNob2ljZXMiLCJlbmRwb2ludCIsImJvdW5kYXJ5X2xhYmVsIiwiZm9sZF9zdGFydF9ib3VuZGFyeSIsImZvbGRfZW5kX2JvdW5kYXJ5IiwiaXNBcnJheSIsImNhbmRpZGF0ZXMiLCJvZmZzZXRfbGFiZWwiLCJvY2N1cnJlbmNlX2lkIiwiZm9sZF9jaG9pY2VfbGFiZWwiLCJvZmZzZXQiLCJhbm5vdW5jZSIsIm1lc3NhZ2UiLCJxdWVyeVNlbGVjdG9yIiwidGV4dENvbnRlbnQiLCJwb3NpdGlvbl9hY3Rpb25zIiwiYWN0aW9ucyIsInN0YXRlIiwic3RhcnRfY29udHJvbCIsImVuZF9jb250cm9sIiwiY2FudmFzIiwiZHVyYXRpb24iLCJwYXJlbnROb2RlIiwic3VyZmFjZV9yZWN0YW5nbGUiLCJjYW52YXNfcmVjdGFuZ2xlIiwiYW5jaG9yX3JlY3RhbmdsZSIsInByZXNlbnRhdGlvbl9zbGljZXMiLCJ2aWV3cG9ydF93aWR0aCIsImlubmVyV2lkdGgiLCJkb2N1bWVudEVsZW1lbnQiLCJjbGllbnRXaWR0aCIsInZpZXdwb3J0X2hlaWdodCIsImlubmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwidmlzaWJsZV9pbmxpbmVfc3RhcnQiLCJ2aXNpYmxlX2lubGluZV9lbmQiLCJ2aXNpYmxlX2Jsb2NrX3N0YXJ0IiwidmlzaWJsZV9ibG9ja19lbmQiLCJib3R0b20iLCJkZXNpcmVkX2lubGluZV9zaXplIiwicGhhc2UiLCJhdmFpbGFibGVfaW5saW5lX3NpemUiLCJhdmFpbGFibGVfYmxvY2tfc2l6ZSIsImFuY2hvcl9pbmxpbmUiLCJhbmNob3JfYmxvY2tfY2VudGVyIiwiYW5jaG9yX2Jsb2NrX3N0YXJ0IiwiYW5jaG9yX2Jsb2NrX2VuZCIsInNlbGVjdGlvbl9pbmxpbmVfc3RhcnQiLCJzZWxlY3Rpb25faW5saW5lX2VuZCIsImlubGluZV9zdGFydCIsImJsb2NrX3N0YXJ0IiwicGxhY2VtZW50X3NwYWNlIiwicGxhY2VtZW50X2Jsb2NrX2xpbWl0IiwibG9naWNhbF9pbmxpbmVfc3RhcnQiLCJzdHlsZSIsInNldFByb3BlcnR5IiwicmVtb3ZlUHJvcGVydHkiLCJvZmZzZXRIZWlnaHQiLCJjdXJyZW50X3N0YXJ0IiwiY3VycmVudF9lbmQiLCJzZXRBdHRyaWJ1dGUiLCJyZW5kZXJfYWN0aW9ucyIsIm92ZXJsYXkiLCJhY3Rpb25zX3RlbXBsYXRlIiwiaG9sZGVyIiwiY3JlYXRlRWxlbWVudCIsImlubmVySFRNTCIsInByZXZpZXciLCJlcnJvcl9tZXNzYWdlIiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJhcHBlbmRDaGlsZCIsInJlbmRlcl9kcmFmdCIsImRyYWZ0X3RlbXBsYXRlIiwic3RhcnRfbGFiZWwiLCJlbmRfbGFiZWwiLCJzdGFydF9lbmRwb2ludF9sYWJlbCIsImVuZF9lbmRwb2ludF9sYWJlbCIsInN0YXR1c19tZXNzYWdlIiwiaXNDb25uZWN0ZWQiLCJyZXNvbHZlX2RyYWZ0IiwiZHJhZnRfc3RhcnRfc3VtbWFyeSIsImRyYWZ0X2VuZF9zdW1tYXJ5IiwiZHN0X2dhcCIsImRzdF9mb2xkIiwiZHJhZnRfcmVhZHkiLCJjaGVja2luZ19zZWxlY3Rpb24iLCJwcmV2aWV3X3JlYWR5IiwiYXBwbHlpbmdfYXZhaWxhYmlsaXR5IiwiYXdhaXRpbmdfcmVhZGJhY2siLCJwcmV2aWV3X2Vycm9yIiwiZXhpc3Rpbmdfb3ZlcmxheSIsInJlbW92ZSIsImRyYWZ0X2lkZW50aXR5IiwiZHJhZnRfbGFiZWxfd2l0aF9kdXJhdGlvbiIsImRyYWZ0X2xhYmVsIiwic3RhdHVzX2lkIiwiYWN0aXZlX2JvdW5kYXJ5IiwicG9pbnRlcl9ib3VuZGFyeSIsImZvbGRfY2hvaWNlcyIsImZvbGRfZ3JvdXBfbGFiZWwiLCJmb2xkX2luc3RydWN0aW9ucyIsImZvY3VzX2FjdGlvbnNfYWZ0ZXJfcmVuZGVyIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwiZmlyc3RfYWN0aW9uIiwiZm9jdXNfYm91bmRhcnkiLCJjb21taXRfYWZ0ZXJfcmVuZGVyIiwicmVxdWVzdF9zZWxlY3Rpb25fcHJldmlldyIsInNjaGVkdWxlX3JlbmRlciIsImFib3J0X3NlbGVjdGlvbl9yZXF1ZXN0IiwiYWJvcnQiLCJjYW5jZWxfZHJhZnQiLCJyZXN0b3JlX2ZvY3VzIiwiYW5ub3VuY2VfY2FuY2VsIiwiZm9jdXNfb3JpZ2luIiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJjYW5jZWxsZWQiLCJyZXBsYWNlbWVudF9zdXJmYWNlIiwiZW5oYW5jZV9zdXJmYWNlcyIsImNvbnN1bWVfc2lnbmVkX2FjdGlvbl9jb250ZXh0IiwiYWN0aW9uX2lkIiwicXVlcnlfYXJnIiwidG9rZW4iLCJhY3Rpb24iLCJhY3Rpb25fdXJsIiwiYXV0aG9yaXplZCIsImVuYWJsZWQiLCJ1cmwiLCJ0ZXN0IiwiVVJMIiwibG9jYXRpb24iLCJocmVmIiwiZXJyb3IiLCJzZWFyY2hQYXJhbXMiLCJnZXQiLCJnZXRfc2VsZWN0aW9uX3JlcXVlc3RfY29udGV4dCIsImdldF9yZXF1ZXN0X2NvbnRleHQiLCJyZXF1ZXN0X2NvbnRleHQiLCJ0cmFuc3BvcnQiLCJnZW5lcmF0aW9uIiwialF1ZXJ5IiwicHJldmlld19hY3Rpb24iLCJwcmV2aWV3X25vbmNlIiwiYWpheCIsIm1ldGhvZCIsImRhdGFUeXBlIiwidGltZW91dCIsInJlcXVlc3RfdGltZW91dF9tcyIsImRhdGEiLCJub25jZSIsInNlbGVjdGlvbl9zdXJmYWNlIiwidmlldyIsInN0YXJ0X2F0IiwiYXQiLCJlbmRfYXQiLCJsb2FkZWRfc3RhcnRfYXQiLCJsb2FkZWRfZW5kX2F0IiwibG9hZGVkX2NvbnRleHRfdG9rZW5zIiwicmV0dXJuX2NvbnRleHQiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwic2VsZWN0aW9uIiwiZmFpbCIsInJlcXVlc3QiLCJyZXF1ZXN0X3N0YXR1cyIsInJlc3BvbnNlSlNPTiIsImFsd2F5cyIsImFwcGx5X3NlbGVjdGlvbl9hdmFpbGFiaWxpdHkiLCJtb2RlIiwiYmxvY2tfdG9rZW4iLCJhcHBseV9hY3Rpb24iLCJhcHBseV9ub25jZSIsInJlYWRiYWNrX3JlcXVlc3QiLCJhcHBseV9lcnJvciIsInJlZnJlc2hfYWZ0ZXJfYXBwbHkiLCJiZWdpbl9kcmFmdCIsInJlc3RvcmVfZm9jdXNfb25fY2FuY2VsIiwiY29udGFpbnMiLCJhY3RpdmVFbGVtZW50IiwicG9pbnRlcl9pZCIsInBvaW50ZXJfdHlwZSIsImJvdW5kYXJ5X2RyYWdfb3JpZ2luIiwidG91Y2hfb3JpZ2luIiwiYmVnaW5fYm91bmRhcnlfZHJhZyIsInBvaW50ZXJUeXBlIiwiYnV0dG9uIiwicG9pbnRlcklkIiwic2V0UG9pbnRlckNhcHR1cmUiLCJwcmV2ZW50RGVmYXVsdCIsInJlc3RvcmVfYm91bmRhcnlfZHJhZyIsIm9yaWdpbiIsImhhc1BvaW50ZXJDYXB0dXJlIiwicmVsZWFzZVBvaW50ZXJDYXB0dXJlIiwiaXNfZW1wdHlfc3VyZmFjZV90YXJnZXQiLCJ0YXJnZXQiLCJCb29sZWFuIiwiaGFuZGxlX3BvaW50ZXJfZG93biIsIngiLCJ5IiwiaGFuZGxlX3BvaW50ZXJfbW92ZSIsImhhbmRsZV9wb2ludGVyX3VwIiwibW92ZW1lbnQiLCJoeXBvdCIsImhhbmRsZV9wb2ludGVyX2NhbmNlbCIsIm1vdmVfa2V5Ym9hcmRfY29vcmRpbmF0ZSIsImRhdGVfZGVsdGEiLCJsZW5ndGgiLCJoYW5kbGVfa2V5X2Rvd24iLCJoYW5kbGVfYWN0aW9uX2NsaWNrIiwiY2FuY2VsX2NvbnRyb2wiLCJyZXRyeV9jb250cm9sIiwiYXZhaWxhYmlsaXR5X2NvbnRyb2wiLCJmb2xkX2NvbnRyb2wiLCJjb29yZGluYXRlX2tleSIsImFzc2lnbiIsImhhbmRsZV9mb2N1c19pbiIsImhhbmRsZV9mb2N1c19vdXQiLCJyZWxhdGVkVGFyZ2V0Iiwic3RhdHVzX3RlbXBsYXRlIiwicmVjb3JkIiwidGFiaW5kZXgiLCJhcmlhX2xhYmVsIiwiYXJpYV9kZXNjcmlwdGlvbiIsInN1cmZhY2VfbGFiZWwiLCJpbnN0cnVjdGlvbnMiLCJoYW5kbGVfaWRlbnRpdHlfY2hhbmdlIiwiZGV0YWlsIiwiaXNfZ2xvYmFsX2lkZW50aXR5X2NoYW5nZSIsInR5cGUiLCJpc19yZWFkYmFja19zdGF0ZSIsInJlYXNvbiIsImluaXRpYWxpemUiLCJhZGRFdmVudExpc3RlbmVyIiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJyZW1vdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJnZXRfc3RhdGVfc25hcHNob3QiLCJoYXNfZHJhZnQiLCJoYXNfcHJldmlldyIsImhhc19yZXF1ZXN0IiwiaGFzX3BlbmRpbmdfZnJhbWUiLCJjYW5jZWwiLCJyZWdpc3Rlcl9mYWN0b3J5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS10aW1lbGluZS90aW1lLXJvd3Mtc2VsZWN0aW9uL19zcmMvdGltZS1yb3dzLXNlbGVjdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERldmVsb3BtZW50LW9ubHkgVGltZWxpbmUgdGltZS1yb3cgc2VsZWN0aW9uIGFuZCBhY3Rpb24gYWRhcHRlci5cbiAqXG4gKiBUaGUgYWRhcHRlciBvd25zIGxvY2FsIGdlc3R1cmVzIGFuZCBvbmUgcHJlc2VudGF0aW9uLW9ubHkgZHJhZnQuIEl0IGNvbnN1bWVzXG4gKiBhY2NlcHRlZCBnZW9tZXRyeSBmcm9tIHRoZSB0aW1lLXJvd3MgbW9kdWxlLiBUaGUgZXhpc3RpbmcgVGltZWxpbmUgc2VydmVyXG4gKiBlbmRwb2ludHMgcmVtYWluIGF1dGhvcml0YXRpdmUgZm9yIHByZXZpZXcsIGFjdGlvbiBlbGlnaWJpbGl0eSwgbXV0YXRpb24sXG4gKiBhbmQgY2Fub25pY2FsIHJlYWRiYWNrLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCwgd3AgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2lkID0gJ3RpbWVfcm93c19zZWxlY3Rpb24nO1xuXHR2YXIgc3VyZmFjZV9zZWxlY3RvciA9ICcud3BiY190aW1lbGluZV90aW1lX3Jvd3NfX3RpbWVkX3N1cmZhY2UnO1xuXHR2YXIgcGFuZWxfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcGFuZWw9XCJjYW52YXNcIl0nO1xuXHR2YXIgY2FudmFzX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtdGltZWxpbmUtY2FudmFzXSc7XG5cdHZhciBjb2x1bW5fc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtZGF0ZV0nO1xuXHR2YXIgb3ZlcmxheV9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zZWxlY3Rpb24tb3ZlcmxheV0nO1xuXHR2YXIgYm91bmRhcnlfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc2VsZWN0aW9uLWJvdW5kYXJ5XSc7XG5cdHZhciBmb2xkX2Nob2ljZV9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zZWxlY3Rpb24tZm9sZC1jaG9pY2VdJztcblx0dmFyIGFjdGlvbnNfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc2VsZWN0aW9uLWFjdGlvbnNdJztcblx0dmFyIHJlYWR5X2FjdGlvbnNfaW5saW5lX3NpemUgPSA1NjA7XG5cdHZhciBzdGF0dXNfYWN0aW9uc19pbmxpbmVfc2l6ZSA9IDQ0MDtcblx0dmFyIG1pbmltdW1fYWN0aW9uc19pbmxpbmVfc2l6ZSA9IDM0MDtcblx0dmFyIG1pbmltdW1fYWN0aW9uc19ibG9ja19zaXplID0gMTUwO1xuXHR2YXIgYWN0aW9uc19zZXBhcmF0aW9uX3BpeGVscyA9IDg7XG5cdHZhciBleGNsdWRlZF9zZWxlY3RvciA9IFtcblx0XHQnLndwYmNfdGltZWxpbmVfdGltZV9yb3dzX19ib29raW5nJyxcblx0XHQnLndwYmNfdGltZWxpbmVfdGltZV9yb3dzX19vdmVyZmxvdycsXG5cdFx0Jy53cGJjX3RpbWVsaW5lX3RpbWVfcm93c19fY2FudmFzX3Rvb2xiYXInLFxuXHRcdCdbZGF0YS13cGJjLXRpbWVsaW5lLWJvb2tpbmctc2VsZWN0XScsXG5cdFx0J1tkYXRhLXdwYmMtYm9va2luZy1vdmVydmlldy1pbmZvLXRyaWdnZXJdJyxcblx0XHQnW2RhdGEtd3BiYy10aW1lbGluZS1ib29raW5nLWRldGFpbHMtYWN0aW9uXScsXG5cdFx0J1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1tb3ZlbWVudC1ncmlwXScsXG5cdFx0J1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtaGFuZGxlXScsXG5cdFx0J1tkYXRhLXdwYmMtdGltZWxpbmUtYm9va2luZy1yZXNpemUtaG9zdF0nLFxuXHRcdG92ZXJsYXlfc2VsZWN0b3IsXG5cdFx0J2J1dHRvbicsXG5cdFx0J2EnLFxuXHRcdCdpbnB1dCcsXG5cdFx0J3NlbGVjdCcsXG5cdFx0J3RleHRhcmVhJyxcblx0XHQnc3VtbWFyeScsXG5cdFx0J2RldGFpbHMnXG5cdF0uam9pbiggJywnICk7XG5cblx0LyoqXG5cdCAqIENob29zZSBhbiBhY3Rpb24tcG9wb3ZlciBzaWRlIGZyb20gbWVhc3VyZWQgYXZhaWxhYmxlIHNwYWNlLlxuXHQgKlxuXHQgKiBFeHBhbmRlZCB0aW1lIHJvd3MgcHJlZmVyIGEgaG9yaXpvbnRhbCBzaWRlIHRoYXQgcHJlc2VydmVzIHRoZSByZWFkYWJsZVxuXHQgKiBtaW5pbXVtIHdpZHRoLiBXaGVuIGJvdGggc2lkZXMgZml0LCB0aGUgcm9vbWllciBzaWRlIHdpbnM7IGFuIGV4YWN0IHRpZVxuXHQgKiB1c2VzIGxvZ2ljYWwgaW5saW5lLWVuZC4gTmFycm93IGxheW91dHMgZmFsbCBiYWNrIHRvIHRoZSBlc3RhYmxpc2hlZFxuXHQgKiBiZWxvdy9hYm92ZSBwb2xpY3kgd2l0aG91dCBjb3ZlcmluZyB0aGUgc2VsZWN0ZWQgcmFuZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBtaW5pbXVtX2lubGluZV9zaXplIFJlYWRhYmxlIG1pbmltdW0gcG9wb3ZlciB3aWR0aC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGFjdGlvbnNfYmxvY2tfc2l6ZSAgTWVhc3VyZWQgcG9wb3ZlciBibG9jayBzaXplLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gYXZhaWxhYmxlX2xlZnQgICAgICBBdmFpbGFibGUgcGl4ZWxzIGxlZnQgb2YgdGhlIHNlbGVjdGlvbi5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGF2YWlsYWJsZV9yaWdodCAgICAgQXZhaWxhYmxlIHBpeGVscyByaWdodCBvZiB0aGUgc2VsZWN0aW9uLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gYXZhaWxhYmxlX2Fib3ZlICAgICBBdmFpbGFibGUgcGl4ZWxzIGFib3ZlIHRoZSBzZWxlY3Rpb24uXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBhdmFpbGFibGVfYmVsb3cgICAgIEF2YWlsYWJsZSBwaXhlbHMgYmVsb3cgdGhlIHNlbGVjdGlvbi5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGRpcmVjdGlvbiAgICAgICAgICAgQWNjZXB0ZWQgYGx0cmAgb3IgYHJ0bGAgZGlyZWN0aW9uLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IGBsZWZ0YCwgYHJpZ2h0YCwgYGFib3ZlYCwgb3IgYGJlbG93YC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlc29sdmVfYWN0aW9uc19wbGFjZW1lbnQoIG1pbmltdW1faW5saW5lX3NpemUsIGFjdGlvbnNfYmxvY2tfc2l6ZSwgYXZhaWxhYmxlX2xlZnQsIGF2YWlsYWJsZV9yaWdodCwgYXZhaWxhYmxlX2Fib3ZlLCBhdmFpbGFibGVfYmVsb3csIGRpcmVjdGlvbiApIHtcblx0XHR2YXIgbGVmdF9maXRzID0gYXZhaWxhYmxlX2xlZnQgPj0gbWluaW11bV9pbmxpbmVfc2l6ZTtcblx0XHR2YXIgcmlnaHRfZml0cyA9IGF2YWlsYWJsZV9yaWdodCA+PSBtaW5pbXVtX2lubGluZV9zaXplO1xuXG5cdFx0aWYgKCBsZWZ0X2ZpdHMgJiYgcmlnaHRfZml0cyApIHtcblx0XHRcdGlmICggYXZhaWxhYmxlX2xlZnQgPT09IGF2YWlsYWJsZV9yaWdodCApIHtcblx0XHRcdFx0cmV0dXJuICdydGwnID09PSBkaXJlY3Rpb24gPyAnbGVmdCcgOiAncmlnaHQnO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGF2YWlsYWJsZV9sZWZ0ID4gYXZhaWxhYmxlX3JpZ2h0ID8gJ2xlZnQnIDogJ3JpZ2h0Jztcblx0XHR9XG5cdFx0aWYgKCByaWdodF9maXRzICkge1xuXHRcdFx0cmV0dXJuICdyaWdodCc7XG5cdFx0fVxuXHRcdGlmICggbGVmdF9maXRzICkge1xuXHRcdFx0cmV0dXJuICdsZWZ0Jztcblx0XHR9XG5cdFx0aWYgKCBhdmFpbGFibGVfYmVsb3cgPj0gYWN0aW9uc19ibG9ja19zaXplICkge1xuXHRcdFx0cmV0dXJuICdiZWxvdyc7XG5cdFx0fVxuXHRcdGlmICggYXZhaWxhYmxlX2Fib3ZlID49IGFjdGlvbnNfYmxvY2tfc2l6ZSApIHtcblx0XHRcdHJldHVybiAnYWJvdmUnO1xuXHRcdH1cblxuXHRcdHJldHVybiBhdmFpbGFibGVfYWJvdmUgPiBhdmFpbGFibGVfYmVsb3cgPyAnYWJvdmUnIDogJ2JlbG93Jztcblx0fVxuXG5cdC8qKlxuXHQgKiBQb3NpdGlvbiBhbiBhY3Rpb24gcG9wb3ZlciBiZXlvbmQgdGhlIGNvbXBsZXRlIHNlbGVjdGVkIGJsb2NrIHJhbmdlLlxuXHQgKlxuXHQgKiBLZWVwaW5nIHRoaXMgY2FsY3VsYXRpb24gaW5kZXBlbmRlbnQgZnJvbSB2aWV3cG9ydCBjbGFtcGluZyBwcmV2ZW50cyBhXG5cdCAqIGNvbnN0cmFpbmVkIHBvcG92ZXIgZnJvbSBjb3ZlcmluZyBlaXRoZXIgZWRpdGFibGUgYm91bmRhcnkgY29udHJvbC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHBsYWNlbWVudCAgICAgICAgICAgIGBhYm92ZWAgb3IgYGJlbG93YC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHNlbGVjdGlvbl9ibG9ja19zdGFydCBTZWxlY3RlZCByYW5nZSBvdXRlciBzdGFydCBlZGdlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gc2VsZWN0aW9uX2Jsb2NrX2VuZCAgIFNlbGVjdGVkIHJhbmdlIG91dGVyIGVuZCBlZGdlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gYWN0aW9uc19ibG9ja19zaXplICAgIFJlbmRlcmVkIHBvcG92ZXIgYmxvY2sgc2l6ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHNlcGFyYXRpb25fcGl4ZWxzICAgICBSZXF1aXJlZCB2aXN1YWwgc2VwYXJhdGlvbi5cblx0ICogQHJldHVybiB7bnVtYmVyfSBQb3BvdmVyIGJsb2NrLXN0YXJ0IGNvb3JkaW5hdGUuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXNvbHZlX2FjdGlvbnNfYmxvY2tfc3RhcnQoIHBsYWNlbWVudCwgc2VsZWN0aW9uX2Jsb2NrX3N0YXJ0LCBzZWxlY3Rpb25fYmxvY2tfZW5kLCBhY3Rpb25zX2Jsb2NrX3NpemUsIHNlcGFyYXRpb25fcGl4ZWxzICkge1xuXHRcdHJldHVybiAnYWJvdmUnID09PSBwbGFjZW1lbnRcblx0XHRcdD8gc2VsZWN0aW9uX2Jsb2NrX3N0YXJ0IC0gYWN0aW9uc19ibG9ja19zaXplIC0gc2VwYXJhdGlvbl9waXhlbHNcblx0XHRcdDogc2VsZWN0aW9uX2Jsb2NrX2VuZCArIHNlcGFyYXRpb25fcGl4ZWxzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBvc2l0aW9uIGEgaG9yaXpvbnRhbGx5IHBsYWNlZCBwb3BvdmVyIG91dHNpZGUgdGhlIHNlbGVjdGVkIHNsaWNlIHVuaW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcGxhY2VtZW50ICAgICAgICAgICAgIFBoeXNpY2FsIGBsZWZ0YCBvciBgcmlnaHRgIHNpZGUuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBzZWxlY3Rpb25faW5saW5lX2xlZnQgU2VsZWN0ZWQgcmFuZ2UgcGh5c2ljYWwgbGVmdCBlZGdlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gc2VsZWN0aW9uX2lubGluZV9yaWdodCBTZWxlY3RlZCByYW5nZSBwaHlzaWNhbCByaWdodCBlZGdlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gYWN0aW9uc19pbmxpbmVfc2l6ZSAgIFJlbmRlcmVkIHBvcG92ZXIgaW5saW5lIHNpemUuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBzZXBhcmF0aW9uX3BpeGVscyAgICAgUmVxdWlyZWQgdmlzdWFsIHNlcGFyYXRpb24uXG5cdCAqIEByZXR1cm4ge251bWJlcn0gUGh5c2ljYWwgcG9wb3ZlciBpbmxpbmUtc3RhcnQgY29vcmRpbmF0ZS5cblx0ICovXG5cdGZ1bmN0aW9uIHJlc29sdmVfYWN0aW9uc19pbmxpbmVfc3RhcnQoIHBsYWNlbWVudCwgc2VsZWN0aW9uX2lubGluZV9sZWZ0LCBzZWxlY3Rpb25faW5saW5lX3JpZ2h0LCBhY3Rpb25zX2lubGluZV9zaXplLCBzZXBhcmF0aW9uX3BpeGVscyApIHtcblx0XHRyZXR1cm4gJ2xlZnQnID09PSBwbGFjZW1lbnRcblx0XHRcdD8gc2VsZWN0aW9uX2lubGluZV9sZWZ0IC0gYWN0aW9uc19pbmxpbmVfc2l6ZSAtIHNlcGFyYXRpb25fcGl4ZWxzXG5cdFx0XHQ6IHNlbGVjdGlvbl9pbmxpbmVfcmlnaHQgKyBzZXBhcmF0aW9uX3BpeGVscztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXBvcnQgd2hldGhlciBhIGNocm9ub2xvZ2ljYWwgYm91bmRhcnkgd291bGQgY3Jvc3MgaXRzIG9wcG9zaXRlIGVuZHBvaW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYm91bmRhcnlfbmFtZSAgU3RhcnQgb3IgZW5kLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gY29vcmRpbmF0ZV9vcmRlciBDYW5kaWRhdGUgY2hyb25vbG9naWNhbCBvcmRlci5cblx0ICogQHBhcmFtIHtudW1iZXJ9IG9wcG9zaXRlX29yZGVyICAgT3Bwb3NpdGUgZW5kcG9pbnQgb3JkZXIuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgY2FuZGlkYXRlIG11c3QgY2xhbXAgdG8gdGhlIG9wcG9zaXRlIGVuZC5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX2JvdW5kYXJ5X2Nyb3NzaW5nKCBib3VuZGFyeV9uYW1lLCBjb29yZGluYXRlX29yZGVyLCBvcHBvc2l0ZV9vcmRlciApIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0KCAnc3RhcnQnID09PSBib3VuZGFyeV9uYW1lICYmIGNvb3JkaW5hdGVfb3JkZXIgPiBvcHBvc2l0ZV9vcmRlciApXG5cdFx0XHR8fCAoICdlbmQnID09PSBib3VuZGFyeV9uYW1lICYmIGNvb3JkaW5hdGVfb3JkZXIgPCBvcHBvc2l0ZV9vcmRlciApXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIGxvY2FsIGRyYWZ0IGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgY29udGV4dCAgICAgICAgICAgICAgIFRpbWVsaW5lIG1vZHVsZSBjb250ZXh0LlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGNvbnRleHQubW91bnQgICAgICAgICBUaW1lbGluZSBtb3VudC5cblx0ICogQHBhcmFtIHtPYmplY3R9ICBjb250ZXh0LmNvbmZpZ3VyYXRpb24gRXhlY3V0YWJsZS1mcmVlIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdH0gU3ltbWV0cmljIGxpZmVjeWNsZSBhbmQgZGV2ZWxvcG1lbnQgaW5zcGVjdGlvbiBBUEkuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfc2VsZWN0aW9uX2NvbnRyb2xsZXIoIGNvbnRleHQgKSB7XG5cdFx0dmFyIG1vdW50ID0gY29udGV4dC5tb3VudCB8fCBudWxsO1xuXHRcdHZhciBjb25maWd1cmF0aW9uID0gY29udGV4dC5jb25maWd1cmF0aW9uIHx8IHt9O1xuXHRcdHZhciBzZWxlY3Rpb25fYXBpID0gY29udGV4dC5zZWxlY3Rpb25fYXBpIHx8IHt9O1xuXHRcdHZhciBtb2R1bGVzID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcyB8fCBudWxsO1xuXHRcdHZhciBnZW9tZXRyeSA9IHdpbmRvdy53cGJjX3RpbWVsaW5lX3RpbWVfcm93c19pbnRlcmFjdGlvbl9nZW9tZXRyeSB8fCBudWxsO1xuXHRcdHZhciB0aW1lX3Jvd3NfY29uZmlndXJhdGlvbiA9IGNvbmZpZ3VyYXRpb24udGltZV9yb3dzIHx8IHt9O1xuXHRcdHZhciB0ZW1wbGF0ZV9pZHMgPSBjb25maWd1cmF0aW9uLnRlbXBsYXRlcyB8fCB7fTtcblx0XHR2YXIgaTE4biA9IGNvbmZpZ3VyYXRpb24uaTE4biB8fCB7fTtcblx0XHR2YXIgc2VsZWN0aW9uX3N0ZXBfbWludXRlcyA9IE51bWJlciggY29uZmlndXJhdGlvbi5zZWxlY3Rpb25fc3RlcF9taW51dGVzICk7XG5cdFx0dmFyIHRvdWNoX3RvbGVyYW5jZV9waXhlbHMgPSBNYXRoLm1heCggMCwgTnVtYmVyKCBjb25maWd1cmF0aW9uLmdlc3R1cmUgJiYgY29uZmlndXJhdGlvbi5nZXN0dXJlLnRvdWNoX3RvbGVyYW5jZV9waXhlbHMgKSB8fCA4ICk7XG5cdFx0dmFyIGVuaGFuY2VkX3N1cmZhY2VzID0gW107XG5cdFx0dmFyIGFjdGl2ZV9zdGF0ZSA9IG51bGw7XG5cdFx0dmFyIHBlbmRpbmdfdG91Y2ggPSBudWxsO1xuXHRcdHZhciBwZW5kaW5nX2ZyYW1lID0gMDtcblx0XHR2YXIgcGVuZGluZ19mb2N1c19jb29yZGluYXRlID0gbnVsbDtcblx0XHR2YXIgc2VsZWN0aW9uX3JlcXVlc3QgPSBudWxsO1xuXHRcdHZhciBzZWxlY3Rpb25fcmVxdWVzdF9nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgcHJlc2VydmVfZHJhZnRfZHVyaW5nX2Jvb2tpbmdfY3JlYXRpb25fcmVhZGJhY2sgPSBmYWxzZTtcblx0XHR2YXIgaXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblxuXHRcdC8qKlxuXHRcdCAqIEludGVycG9sYXRlIGEgZml4ZWQgdHJhbnNsYXRlZCBsYWJlbC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbCAgICAgICAgU291cmNlIGxhYmVsLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXBsYWNlbWVudHMgUGxhaW4gcmVwbGFjZW1lbnQgc3RyaW5ncy5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IEludGVycG9sYXRlZCBsYWJlbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbnRlcnBvbGF0ZV9sYWJlbCggbGFiZWwsIHJlcGxhY2VtZW50cyApIHtcblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyggcmVwbGFjZW1lbnRzIHx8IHt9ICkucmVkdWNlKCBmdW5jdGlvbiAoIHJlc3VsdCwga2V5ICkge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0LnNwbGl0KCAneycgKyBrZXkgKyAnfScgKS5qb2luKCBTdHJpbmcoIHJlcGxhY2VtZW50c1sga2V5IF0gKSApO1xuXHRcdFx0fSwgU3RyaW5nKCBsYWJlbCB8fCAnJyApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGEgZml4ZWQgYWxsb3ctbGlzdGVkIFdvcmRQcmVzcyB0ZW1wbGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgU2VtYW50aWMgdGVtcGxhdGUga2V5LlxuXHRcdCAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IFRlbXBsYXRlIGZ1bmN0aW9uIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3RlbXBsYXRlKCBrZXkgKSB7XG5cdFx0XHR2YXIgdGVtcGxhdGVfaWQgPSBTdHJpbmcoIHRlbXBsYXRlX2lkc1sga2V5IF0gfHwgJycgKTtcblxuXHRcdFx0aWYgKCAhIHRlbXBsYXRlX2lkIHx8ICEgd3AgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdwLnRlbXBsYXRlICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHdwLnRlbXBsYXRlKCB0ZW1wbGF0ZV9pZCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZvcm1hdCBhIHdhbGwgbWludXRlIHdpdGhvdXQgYnJvd3NlciB0aW1lem9uZSBjb252ZXJzaW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHdhbGxfbWludXRlIE1pbnV0ZSBmcm9tIGxvY2FsIG1pZG5pZ2h0LlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhYmxlIEhIOk1NIGxhYmVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF93YWxsX21pbnV0ZSggd2FsbF9taW51dGUgKSB7XG5cdFx0XHR2YXIgYm91bmRlZF9taW51dGUgPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIDE0NDAsIE51bWJlciggd2FsbF9taW51dGUgKSB8fCAwICkgKTtcblx0XHRcdHZhciBob3VyID0gTWF0aC5mbG9vciggYm91bmRlZF9taW51dGUgLyA2MCApO1xuXHRcdFx0dmFyIG1pbnV0ZSA9IGJvdW5kZWRfbWludXRlICUgNjA7XG5cblx0XHRcdHJldHVybiBTdHJpbmcoIGhvdXIgKS5wYWRTdGFydCggMiwgJzAnICkgKyAnOicgKyBTdHJpbmcoIG1pbnV0ZSApLnBhZFN0YXJ0KCAyLCAnMCcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb3JtYXQgYSBzZXJ2ZXItZGVyaXZlZCBudW1lcmljIFVUQyBvZmZzZXQgd2l0aG91dCBicm93c2VyIHRpbWV6b25lIEFQSXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0X21pbnV0ZXMgU2lnbmVkIG1pbnV0ZXMgZWFzdCBvZiBVVEMuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBFeGFjdCBVVEMgb2Zmc2V0IHN1Y2ggYXMgVVRDKzAyOjAwLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF91dGNfb2Zmc2V0KCBvZmZzZXRfbWludXRlcyApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX29mZnNldCA9IE51bWJlciggb2Zmc2V0X21pbnV0ZXMgKTtcblx0XHRcdHZhciBzaWduO1xuXHRcdFx0dmFyIGFic29sdXRlX29mZnNldDtcblxuXHRcdFx0aWYgKCAhIE51bWJlci5pc0Zpbml0ZSggbm9ybWFsaXplZF9vZmZzZXQgKSApIHtcblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fVxuXHRcdFx0c2lnbiA9IDAgPD0gbm9ybWFsaXplZF9vZmZzZXQgPyAnKycgOiAnLSc7XG5cdFx0XHRhYnNvbHV0ZV9vZmZzZXQgPSBNYXRoLmFicyggbm9ybWFsaXplZF9vZmZzZXQgKTtcblxuXHRcdFx0cmV0dXJuICdVVEMnICsgc2lnblxuXHRcdFx0XHQrIFN0cmluZyggTWF0aC5mbG9vciggYWJzb2x1dGVfb2Zmc2V0IC8gNjAgKSApLnBhZFN0YXJ0KCAyLCAnMCcgKVxuXHRcdFx0XHQrICc6JyArIFN0cmluZyggYWJzb2x1dGVfb2Zmc2V0ICUgNjAgKS5wYWRTdGFydCggMiwgJzAnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9ybWF0IGFuIGV4YWN0IGRyYWZ0IGR1cmF0aW9uIHdpdGhvdXQgYnJvd3Nlci10aW1lem9uZSBjb252ZXJzaW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGR1cmF0aW9uX21pbnV0ZXMgRXhhY3QgZWxhcHNlZCBkdXJhdGlvbiBpbiBtaW51dGVzLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gQ29tcGFjdCB0cmFuc2xhdGVkIGhvdXJzLWFuZC1taW51dGVzIGxhYmVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF9kdXJhdGlvbiggZHVyYXRpb25fbWludXRlcyApIHtcblx0XHRcdHZhciB0b3RhbF9taW51dGVzID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggZHVyYXRpb25fbWludXRlcyApIHx8IDAgKSApO1xuXHRcdFx0dmFyIGhvdXJzID0gTWF0aC5mbG9vciggdG90YWxfbWludXRlcyAvIDYwICk7XG5cdFx0XHR2YXIgbWludXRlcyA9IHRvdGFsX21pbnV0ZXMgJSA2MDtcblx0XHRcdHZhciBob3Vyc19sYWJlbCA9IGhvdXJzID8gaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4uZHVyYXRpb25faG91cnNfc2hvcnQsIHsgY291bnQ6IGhvdXJzIH0gKSA6ICcnO1xuXHRcdFx0dmFyIG1pbnV0ZXNfbGFiZWwgPSBtaW51dGVzIHx8ICEgaG91cnMgPyBpbnRlcnBvbGF0ZV9sYWJlbCggaTE4bi5kdXJhdGlvbl9taW51dGVzX3Nob3J0LCB7IGNvdW50OiBtaW51dGVzIH0gKSA6ICcnO1xuXG5cdFx0XHRpZiAoIGhvdXJzX2xhYmVsICYmIG1pbnV0ZXNfbGFiZWwgKSB7XG5cdFx0XHRcdHJldHVybiBpbnRlcnBvbGF0ZV9sYWJlbCggaTE4bi5kdXJhdGlvbl9ob3Vyc19taW51dGVzX3Nob3J0LCB7XG5cdFx0XHRcdFx0aG91cnM6IGhvdXJzX2xhYmVsLFxuXHRcdFx0XHRcdG1pbnV0ZXM6IG1pbnV0ZXNfbGFiZWxcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gaG91cnNfbGFiZWwgfHwgbWludXRlc19sYWJlbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb3JtYXQgb25lIGV4YWN0IGdlb21ldHJ5IGNhbmRpZGF0ZSBmb3IgYSBjb25jaXNlIHZpc2libGUgZW5kcG9pbnQgbGFiZWwuXG5cdFx0ICpcblx0XHQgKiBUaGUgcHVyZSBnZW9tZXRyeSBrZXJuZWwgc3VwcGxpZXMgdGhlIHdhbGwgZGF0ZSwgbWludXRlLCBhbmQgYXV0aG9yaXRhdGl2ZVxuXHRcdCAqIG51bWVyaWMgb2Zmc2V0LiBUaGUgdmlzaWJsZSBib3VuZGFyeSBpbnRlbnRpb25hbGx5IHNob3dzIG9ubHkgdGhlIGFjY2VwdGVkXG5cdFx0ICogd2FsbCBkYXRlIGFuZCB0aW1lOyBleGFjdCBvZmZzZXRzIHJlbWFpbiBhdmFpbGFibGUgaW4gZm9sZCBjaG9pY2VzIGFuZCB0aGVcblx0XHQgKiBhdXRob3JpdGF0aXZlIHByZXZpZXcgY29udHJhY3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gY2FuZGlkYXRlIEV4YWN0IHN0YXJ0IG9yIGVuZCBnZW9tZXRyeSBjYW5kaWRhdGUuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBBY2NlcHRlZCB3YWxsIGRhdGUgYW5kIHRpbWUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZm9ybWF0X3Zpc2libGVfZW5kcG9pbnQoIGNhbmRpZGF0ZSApIHtcblx0XHRcdGlmICggISBjYW5kaWRhdGUgfHwgISBjYW5kaWRhdGUuZGF0ZSB8fCAhIE51bWJlci5pc0Zpbml0ZSggTnVtYmVyKCBjYW5kaWRhdGUud2FsbF9taW51dGUgKSApICkge1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjYW5kaWRhdGUuZGF0ZSArICcgJyArIGZvcm1hdF93YWxsX21pbnV0ZSggY2FuZGlkYXRlLndhbGxfbWludXRlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjdXJyZW50IHRpbWUtcm93cyBpbnN0YW5jZSB3aXRob3V0IHJldGFpbmluZyBpdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBUaW1lLXJvd3MgaW5zdGFuY2Ugb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdGltZV9yb3dzX2luc3RhbmNlKCkge1xuXHRcdFx0aWYgKCAhIG1vZHVsZXMgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vZHVsZXMuZ2V0X2luc3RhbmNlICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG1vZHVsZXMuZ2V0X2luc3RhbmNlKCBTdHJpbmcoIHRpbWVfcm93c19jb25maWd1cmF0aW9uLmluc3RhbmNlX2lkIHx8ICcnICkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIGEgc3VyZmFjZSdzIFJlc291cmNlIGFuZCBhY2NlcHRlZCBjYWNoZSBpZGVudGl0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gc3VyZmFjZSBUaW1lZCBzdXJmYWNlLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBQYW5lbCBpZGVudGl0eSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9zdXJmYWNlX2lkZW50aXR5KCBzdXJmYWNlICkge1xuXHRcdFx0dmFyIHBhbmVsID0gc3VyZmFjZSAmJiBzdXJmYWNlLmNsb3Nlc3QgPyBzdXJmYWNlLmNsb3Nlc3QoIHBhbmVsX3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCBwYW5lbCAmJiBwYW5lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJlc291cmNlLWlkJyApICk7XG5cblx0XHRcdGlmICggISBwYW5lbCB8fCAhIE51bWJlci5pc0ludGVnZXIoIHJlc291cmNlX2lkICkgfHwgMSA+IHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cGFuZWw6IHBhbmVsLFxuXHRcdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQsXG5cdFx0XHRcdGNhY2hlX2tleTogU3RyaW5nKCBwYW5lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLWNhY2hlLWtleScgKSB8fCAnJyApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZpbmQgdGhlIGN1cnJlbnQgcmVuZGVyZWQgdGltZWQgc3VyZmFjZSBmb3Igb25lIFJlc291cmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHJldHVybiB7RWxlbWVudHxudWxsfSBDdXJyZW50IHN1cmZhY2Ugb3IgbnVsbCBhZnRlciByZW1vdmFsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZpbmRfY3VycmVudF9zdXJmYWNlKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuZmluZC5jYWxsKCBtb3VudCA/IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHN1cmZhY2Vfc2VsZWN0b3IgKSA6IFtdLCBmdW5jdGlvbiAoIHN1cmZhY2UgKSB7XG5cdFx0XHRcdHZhciBpZGVudGl0eSA9IGdldF9zdXJmYWNlX2lkZW50aXR5KCBzdXJmYWNlICk7XG5cblx0XHRcdFx0cmV0dXJuIGlkZW50aXR5ICYmIGlkZW50aXR5LnJlc291cmNlX2lkID09PSBOdW1iZXIoIHJlc291cmNlX2lkICk7XG5cdFx0XHR9ICkgfHwgbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNZWFzdXJlIGxvZ2ljYWwgZGF0ZSBjb2x1bW5zIGZvciBvbmUgaW1tdXRhYmxlIGdlc3R1cmUgc25hcHNob3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0VsZW1lbnR9IHN1cmZhY2UgVGltZWQgc3VyZmFjZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIGRpcmVjdGlvbiBsdHIgb3IgcnRsLlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IE9yZGVyZWQgbG9naWNhbCBjb2x1bW4gRFRPcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBtZWFzdXJlX2RhdGVfY29sdW1ucyggc3VyZmFjZSwgZGlyZWN0aW9uICkge1xuXHRcdFx0dmFyIHN1cmZhY2VfcmVjdCA9IHN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0XHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoIHN1cmZhY2UucXVlcnlTZWxlY3RvckFsbCggY29sdW1uX3NlbGVjdG9yICksIGZ1bmN0aW9uICggY29sdW1uICkge1xuXHRcdFx0XHR2YXIgY29sdW1uX3JlY3QgPSBjb2x1bW4uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdHZhciBsb2dpY2FsX3N0YXJ0ID0gJ3J0bCcgPT09IGRpcmVjdGlvblxuXHRcdFx0XHRcdD8gc3VyZmFjZV9yZWN0LnJpZ2h0IC0gY29sdW1uX3JlY3QucmlnaHRcblx0XHRcdFx0XHQ6IGNvbHVtbl9yZWN0LmxlZnQgLSBzdXJmYWNlX3JlY3QubGVmdDtcblx0XHRcdFx0dmFyIGxvZ2ljYWxfZW5kID0gJ3J0bCcgPT09IGRpcmVjdGlvblxuXHRcdFx0XHRcdD8gc3VyZmFjZV9yZWN0LnJpZ2h0IC0gY29sdW1uX3JlY3QubGVmdFxuXHRcdFx0XHRcdDogY29sdW1uX3JlY3QucmlnaHQgLSBzdXJmYWNlX3JlY3QubGVmdDtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGRhdGU6IFN0cmluZyggY29sdW1uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtZGF0ZScgKSB8fCAnJyApLFxuXHRcdFx0XHRcdGxvZ2ljYWxfc3RhcnQ6IE1hdGgubWF4KCAwLCBsb2dpY2FsX3N0YXJ0ICksXG5cdFx0XHRcdFx0bG9naWNhbF9lbmQ6IE1hdGgubWF4KCAwLCBsb2dpY2FsX2VuZCApXG5cdFx0XHRcdH07XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUHJlcGFyZSBleGFjdGx5IG9uZSBhY2NlcHRlZCBhbmQgbWVhc3VyZWQgc25hcHNob3QgZm9yIGEgZ2VzdHVyZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gc3VyZmFjZSBUaW1lZCBzdXJmYWNlLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBHZXN0dXJlIGNvbnRleHQgb3IgbnVsbCB3aGVuIGlkZW50aXR5IGlzIHN0YWxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHByZXBhcmVfZ2VzdHVyZV9jb250ZXh0KCBzdXJmYWNlICkge1xuXHRcdFx0dmFyIHN1cmZhY2VfaWRlbnRpdHkgPSBnZXRfc3VyZmFjZV9pZGVudGl0eSggc3VyZmFjZSApO1xuXHRcdFx0dmFyIHRpbWVfcm93cyA9IGdldF90aW1lX3Jvd3NfaW5zdGFuY2UoKTtcblx0XHRcdHZhciBhY2NlcHRlZF9jb250ZXh0O1xuXHRcdFx0dmFyIGRpcmVjdGlvbjtcblx0XHRcdHZhciBzdXJmYWNlX3N0eWxlO1xuXHRcdFx0dmFyIHN1cmZhY2VfcmVjdDtcblx0XHRcdHZhciBib29raW5nX2NvbHVtbl9ndXR0ZXJfcHg7XG5cdFx0XHR2YXIgcHJlcGFyZWQ7XG5cblx0XHRcdGlmICggISBzdXJmYWNlX2lkZW50aXR5IHx8ICEgZ2VvbWV0cnkgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGdlb21ldHJ5LnByZXBhcmVfZ2VvbWV0cnkgfHwgISB0aW1lX3Jvd3MgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHRpbWVfcm93cy5nZXRfaW50ZXJhY3Rpb25fZ2VvbWV0cnlfY29udGV4dCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRhY2NlcHRlZF9jb250ZXh0ID0gdGltZV9yb3dzLmdldF9pbnRlcmFjdGlvbl9nZW9tZXRyeV9jb250ZXh0KCBzdXJmYWNlX2lkZW50aXR5LnJlc291cmNlX2lkICk7XG5cdFx0XHRpZiAoICEgYWNjZXB0ZWRfY29udGV4dCB8fCBzdXJmYWNlX2lkZW50aXR5LmNhY2hlX2tleSAhPT0gU3RyaW5nKCBhY2NlcHRlZF9jb250ZXh0LmNhY2hlX2tleSB8fCAnJyApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHN1cmZhY2Vfc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSggc3VyZmFjZSApO1xuXHRcdFx0ZGlyZWN0aW9uID0gJ3J0bCcgPT09IHN1cmZhY2Vfc3R5bGUuZGlyZWN0aW9uID8gJ3J0bCcgOiAnbHRyJztcblx0XHRcdGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCA9IHBhcnNlRmxvYXQoIHN1cmZhY2Vfc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSggJy0td3BiYy10aW1lLXJvd3MtYm9va2luZy1jb2x1bW4tZ3V0dGVyJyApICk7XG5cdFx0XHRib29raW5nX2NvbHVtbl9ndXR0ZXJfcHggPSBOdW1iZXIuaXNGaW5pdGUoIGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCApID8gTWF0aC5tYXgoIDAsIGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCApIDogMDtcblx0XHRcdHN1cmZhY2VfcmVjdCA9IHN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRwcmVwYXJlZCA9IGdlb21ldHJ5LnByZXBhcmVfZ2VvbWV0cnkoIHtcblx0XHRcdFx0YWNjZXB0ZWRfaWRlbnRpdHk6IGFjY2VwdGVkX2NvbnRleHQuYWNjZXB0ZWRfaWRlbnRpdHksXG5cdFx0XHRcdGRhdGVfYmFuZHM6IGFjY2VwdGVkX2NvbnRleHQuZGF0ZV9iYW5kcyxcblx0XHRcdFx0ZGF0ZV9jb2x1bW5zOiBtZWFzdXJlX2RhdGVfY29sdW1ucyggc3VyZmFjZSwgZGlyZWN0aW9uICksXG5cdFx0XHRcdHZpc2libGVfcmFuZ2U6IGFjY2VwdGVkX2NvbnRleHQudmlzaWJsZV9yYW5nZSxcblx0XHRcdFx0em9vbV9wZXJjZW50OiBhY2NlcHRlZF9jb250ZXh0Lnpvb21fcGVyY2VudCxcblx0XHRcdFx0aG91cl9oZWlnaHRfcHg6IGFjY2VwdGVkX2NvbnRleHQuaG91cl9oZWlnaHRfcHgsXG5cdFx0XHRcdGJsb2NrX2V4dGVudF9weDogc3VyZmFjZV9yZWN0LmhlaWdodCxcblx0XHRcdFx0c2VsZWN0aW9uX3N0ZXBfbWludXRlczogc2VsZWN0aW9uX3N0ZXBfbWludXRlcyxcblx0XHRcdFx0ZGlyZWN0aW9uOiBkaXJlY3Rpb25cblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBwcmVwYXJlZCB8fCAncmVhZHknICE9PSBwcmVwYXJlZC5zdGF0dXMgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzdXJmYWNlOiBzdXJmYWNlLFxuXHRcdFx0XHRwYW5lbDogc3VyZmFjZV9pZGVudGl0eS5wYW5lbCxcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IHN1cmZhY2VfaWRlbnRpdHkucmVzb3VyY2VfaWQsXG5cdFx0XHRcdGNhY2hlX2tleTogc3VyZmFjZV9pZGVudGl0eS5jYWNoZV9rZXksXG5cdFx0XHRcdHN1cmZhY2VfcmVjdDogc3VyZmFjZV9yZWN0LFxuXHRcdFx0XHRib29raW5nX2NvbHVtbl9ndXR0ZXJfcHg6IGJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCxcblx0XHRcdFx0c25hcHNob3Q6IHByZXBhcmVkLnNuYXBzaG90XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbnZlcnQgYSBQb2ludGVyRXZlbnQgaW50byB0aGUgc25hcHNob3QncyBwaHlzaWNhbCBjb29yZGluYXRlIERUTy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBnZXN0dXJlX2NvbnRleHQgSW1tdXRhYmxlIGdlc3R1cmUgY29udGV4dC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZXZlbnQgICAgICAgICAgIFBvaW50ZXItbGlrZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEdlb21ldHJ5IGNvb3JkaW5hdGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcG9pbnRlcl9jb29yZGluYXRlKCBnZXN0dXJlX2NvbnRleHQsIGV2ZW50ICkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c291cmNlOiAncG9pbnRlcicsXG5cdFx0XHRcdHNlbGVjdGlvbl9raW5kOiBTdHJpbmcoIGNvbmZpZ3VyYXRpb24uc2VsZWN0aW9uX2tpbmQgfHwgJ3RpbWVkJyApLFxuXHRcdFx0XHRpbmxpbmVfcHg6IE51bWJlciggZXZlbnQuY2xpZW50WCApIC0gZ2VzdHVyZV9jb250ZXh0LnN1cmZhY2VfcmVjdC5sZWZ0LFxuXHRcdFx0XHRibG9ja19weDogTnVtYmVyKCBldmVudC5jbGllbnRZICkgLSBnZXN0dXJlX2NvbnRleHQuc3VyZmFjZV9yZWN0LnRvcFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb252ZXJ0IG9uZSB2aXNpYmxlIGJvdW5kYXJ5IHBvc2l0aW9uIHRvIGl0cyBlbmRwb2ludCBjZWxsIGNvb3JkaW5hdGUuXG5cdFx0ICpcblx0XHQgKiBFbmQgY29udHJvbHMgYXJlIHBhaW50ZWQgYXQgdGhlIGhhbGYtb3BlbiBpbnRlcnZhbCBlbmQsIHdoaWxlIHRoZSBwdXJlXG5cdFx0ICogZ2VvbWV0cnkga2VybmVsIHN0b3JlcyB0aGUgc2VsZWN0ZWQgY2VsbCB3aG9zZSBlbmQgY3JlYXRlcyB0aGF0IGJvdW5kYXJ5LlxuXHRcdCAqIFN1YnRyYWN0aW5nIG9uZSBhcHByb3ZlZCBzdGVwIGtlZXBzIHBvaW50ZXIgZWRpdHMgYWxpZ25lZCB3aXRoIGtleWJvYXJkXG5cdFx0ICogZWRpdHMgYW5kIGV4YWN0IHNlcnZlciBpbnN0YW50cy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICBib3VuZGFyeV9uYW1lIFN0YXJ0IG9yIGVuZC5cblx0XHQgKiBAcGFyYW0ge1BvaW50ZXJFdmVudH0gZXZlbnQgICAgICAgICBBY3RpdmUgYm91bmRhcnkgcG9pbnRlciBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEJvdW5kZWQgcG9pbnRlciBjb29yZGluYXRlIGZvciB0aGUgZ2VvbWV0cnkga2VybmVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHBvaW50ZXJfYm91bmRhcnlfY29vcmRpbmF0ZSggYm91bmRhcnlfbmFtZSwgZXZlbnQgKSB7XG5cdFx0XHR2YXIgc25hcHNob3QgPSBhY3RpdmVfc3RhdGUuc25hcHNob3Q7XG5cdFx0XHR2YXIgc3RlcF9leHRlbnQgPSBzbmFwc2hvdC5zZWxlY3Rpb25fc3RlcF9taW51dGVzICogc25hcHNob3QucGl4ZWxzX3Blcl9taW51dGU7XG5cdFx0XHR2YXIgbWF4aW11bV9ibG9jayA9IE1hdGgubWF4KCAwLCBzbmFwc2hvdC5ibG9ja19leHRlbnRfcHggLSBzdGVwX2V4dGVudCApO1xuXHRcdFx0dmFyIG1heGltdW1faW5saW5lID0gTWF0aC5tYXgoIDAsIGFjdGl2ZV9zdGF0ZS5zdXJmYWNlX3JlY3Qud2lkdGggLSAwLjAwMSApO1xuXHRcdFx0dmFyIGNvb3JkaW5hdGUgPSBwb2ludGVyX2Nvb3JkaW5hdGUoIHtcblx0XHRcdFx0c3VyZmFjZV9yZWN0OiBhY3RpdmVfc3RhdGUuc3VyZmFjZV9yZWN0XG5cdFx0XHR9LCBldmVudCApO1xuXG5cdFx0XHRpZiAoICdlbmQnID09PSBib3VuZGFyeV9uYW1lICkge1xuXHRcdFx0XHRjb29yZGluYXRlLmJsb2NrX3B4IC09IHN0ZXBfZXh0ZW50O1xuXHRcdFx0fVxuXHRcdFx0Y29vcmRpbmF0ZS5pbmxpbmVfcHggPSBNYXRoLm1heCggMCwgTWF0aC5taW4oIG1heGltdW1faW5saW5lLCBjb29yZGluYXRlLmlubGluZV9weCApICk7XG5cdFx0XHRjb29yZGluYXRlLmJsb2NrX3B4ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCBtYXhpbXVtX2Jsb2NrLCBjb29yZGluYXRlLmJsb2NrX3B4ICkgKTtcblxuXHRcdFx0cmV0dXJuIGNvb3JkaW5hdGU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgYSBrZXlib2FyZCBjb29yZGluYXRlIGZyb20gYSBkYXRlIGFuZCBib3VuZGVkIHNuYXAgaW5kZXguXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgR2VvbWV0cnkgc25hcHNob3QuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGRhdGUgICAgIEFjY2VwdGVkIGRhdGUuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGluZGV4ICAgIENhbmRpZGF0ZSBzbmFwIGluZGV4LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gS2V5Ym9hcmQgY29vcmRpbmF0ZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBrZXlib2FyZF9jb29yZGluYXRlKCBzbmFwc2hvdCwgZGF0ZSwgaW5kZXggKSB7XG5cdFx0XHR2YXIgbWF4aW11bV9pbmRleCA9IE1hdGgubWF4KCAwLCBNYXRoLmNlaWwoICggc25hcHNob3QudmlzaWJsZV9yYW5nZS5lbmRfbWludXRlIC0gc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGUgKSAvIHNuYXBzaG90LnNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgKSAtIDEgKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c291cmNlOiAna2V5Ym9hcmQnLFxuXHRcdFx0XHRzZWxlY3Rpb25fa2luZDogU3RyaW5nKCBjb25maWd1cmF0aW9uLnNlbGVjdGlvbl9raW5kIHx8ICd0aW1lZCcgKSxcblx0XHRcdFx0ZGF0ZTogU3RyaW5nKCBkYXRlIHx8ICcnICksXG5cdFx0XHRcdHNuYXBfaW5kZXg6IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggbWF4aW11bV9pbmRleCwgTnVtYmVyKCBpbmRleCApIHx8IDAgKSApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIExvY2F0ZSBvbmUgcmVuZGVyZWQgZGF0ZSBpbnNpZGUgdGhlIGdlc3R1cmUtb3duZWQgY29sdW1uIGNvbGxlY3Rpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgR2VvbWV0cnkgc25hcHNob3QuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGRhdGUgICAgIFNlcnZlciBkYXRlIGtleS5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IFplcm8tYmFzZWQgY29sdW1uIGluZGV4IG9yIC0xLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9jb2x1bW5faW5kZXgoIHNuYXBzaG90LCBkYXRlICkge1xuXHRcdFx0cmV0dXJuIHNuYXBzaG90LmRhdGVfY29sdW1ucy5maW5kSW5kZXgoIGZ1bmN0aW9uICggY29sdW1uICkge1xuXHRcdFx0XHRyZXR1cm4gY29sdW1uLmRhdGUgPT09IGRhdGU7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzb2x2ZSB0aGUgbW9kZWwgY29vcmRpbmF0ZXMgdXNlZCBldmVuIGZvciBub24tZXhhY3QgRFNUIGRyYWZ0cy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkcmFmdCBEcmFmdCByZXN1bHQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE9yZGVyZWQgc3RhcnQvZW5kIGNlbGxzIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2RyYWZ0X2NlbGxzKCBkcmFmdCApIHtcblx0XHRcdHZhciBhbmNob3I7XG5cdFx0XHR2YXIgZm9jdXM7XG5cdFx0XHR2YXIgYW5jaG9yX2tleTtcblx0XHRcdHZhciBmb2N1c19rZXk7XG5cblx0XHRcdGlmICggISBkcmFmdCB8fCAhIGFjdGl2ZV9zdGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRhbmNob3IgPSBnZW9tZXRyeS5yZXNvbHZlX2Nvb3JkaW5hdGUoIGFjdGl2ZV9zdGF0ZS5zbmFwc2hvdCwgYWN0aXZlX3N0YXRlLmFuY2hvcl9jb29yZGluYXRlICk7XG5cdFx0XHRmb2N1cyA9IGdlb21ldHJ5LnJlc29sdmVfY29vcmRpbmF0ZSggYWN0aXZlX3N0YXRlLnNuYXBzaG90LCBhY3RpdmVfc3RhdGUuZm9jdXNfY29vcmRpbmF0ZSApO1xuXHRcdFx0aWYgKCAhIGFuY2hvciB8fCAhIGZvY3VzIHx8IFsgJ2ludmFsaWQnLCAnb3V0c2lkZScgXS5pbmRleE9mKCBhbmNob3Iuc3RhdHVzICkgIT09IC0xIHx8IFsgJ2ludmFsaWQnLCAnb3V0c2lkZScgXS5pbmRleE9mKCBmb2N1cy5zdGF0dXMgKSAhPT0gLTEgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0YW5jaG9yX2tleSA9IGdldF9jb2x1bW5faW5kZXgoIGFjdGl2ZV9zdGF0ZS5zbmFwc2hvdCwgYW5jaG9yLmRhdGUgKSAqIDEwMDAwMCArIGFuY2hvci5zbmFwX2luZGV4O1xuXHRcdFx0Zm9jdXNfa2V5ID0gZ2V0X2NvbHVtbl9pbmRleCggYWN0aXZlX3N0YXRlLnNuYXBzaG90LCBmb2N1cy5kYXRlICkgKiAxMDAwMDAgKyBmb2N1cy5zbmFwX2luZGV4O1xuXG5cdFx0XHRyZXR1cm4gYW5jaG9yX2tleSA8PSBmb2N1c19rZXlcblx0XHRcdFx0PyB7IHN0YXJ0OiBhbmNob3IsIGVuZDogZm9jdXMsIHN0YXJ0X2VuZHBvaW50OiAnYW5jaG9yJyB9XG5cdFx0XHRcdDogeyBzdGFydDogZm9jdXMsIGVuZDogYW5jaG9yLCBzdGFydF9lbmRwb2ludDogJ2ZvY3VzJyB9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgZ2VvbWV0cnkgY29vcmRpbmF0ZSdzIHN0YWJsZSBjaHJvbm9sb2dpY2FsIG9yZGVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGNvb3JkaW5hdGUgUG9pbnRlciBvciBrZXlib2FyZCBnZW9tZXRyeSBjb29yZGluYXRlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcnxudWxsfSBDb21wYXJhYmxlIGFjY2VwdGVkIG9yZGVyIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2Nvb3JkaW5hdGVfb3JkZXIoIGNvb3JkaW5hdGUgKSB7XG5cdFx0XHR2YXIgcmVzb2x2ZWQgPSBnZW9tZXRyeS5yZXNvbHZlX2Nvb3JkaW5hdGUoIGFjdGl2ZV9zdGF0ZS5zbmFwc2hvdCwgY29vcmRpbmF0ZSApO1xuXHRcdFx0dmFyIGRhdGVfaW5kZXg7XG5cblx0XHRcdGlmICggISByZXNvbHZlZCB8fCBbICdpbnZhbGlkJywgJ291dHNpZGUnIF0uaW5kZXhPZiggcmVzb2x2ZWQuc3RhdHVzICkgIT09IC0xICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGRhdGVfaW5kZXggPSBnZXRfY29sdW1uX2luZGV4KCBhY3RpdmVfc3RhdGUuc25hcHNob3QsIHJlc29sdmVkLmRhdGUgKTtcblxuXHRcdFx0cmV0dXJuIC0xID09PSBkYXRlX2luZGV4ID8gbnVsbCA6IGRhdGVfaW5kZXggKiAxMDAwMDAgKyByZXNvbHZlZC5zbmFwX2luZGV4O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcGxhY2UgdGhlIGVuZHBvaW50IGN1cnJlbnRseSByZXByZXNlbnRlZCBieSBhIGNocm9ub2xvZ2ljYWwgYm91bmRhcnkuXG5cdFx0ICpcblx0XHQgKiBDcm9zc2luZyBib3VuZGFyaWVzIHN3YXBzIHdoaWNoIHJhdyBnZXN0dXJlIGVuZHBvaW50IG93bnMgU3RhcnQgb3IgRW5kLlxuXHRcdCAqIFJlc29sdmluZyB0aGF0IG1hcHBpbmcgZm9yIGV2ZXJ5IHVwZGF0ZSBrZWVwcyB0aGUgZHJhZ2dlZCBjb250cm9sIGF0dGFjaGVkXG5cdFx0ICogdG8gdGhlIHNhbWUgY2hyb25vbG9naWNhbCBib3VuZGFyeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBib3VuZGFyeV9uYW1lIFN0YXJ0IG9yIGVuZC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gY29vcmRpbmF0ZSAgICBSZXBsYWNlbWVudCBwb2ludGVyIG9yIGtleWJvYXJkIGNvb3JkaW5hdGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfYm91bmRhcnlfY29vcmRpbmF0ZSggYm91bmRhcnlfbmFtZSwgY29vcmRpbmF0ZSApIHtcblx0XHRcdHZhciBib3VuZGFyeV91c2VzX2FuY2hvciA9IChcblx0XHRcdFx0KCAnc3RhcnQnID09PSBib3VuZGFyeV9uYW1lICYmICdhbmNob3InID09PSBhY3RpdmVfc3RhdGUuc3RhcnRfZW5kcG9pbnQgKVxuXHRcdFx0XHR8fCAoICdlbmQnID09PSBib3VuZGFyeV9uYW1lICYmICdmb2N1cycgPT09IGFjdGl2ZV9zdGF0ZS5zdGFydF9lbmRwb2ludCApXG5cdFx0XHQpO1xuXHRcdFx0dmFyIG9wcG9zaXRlX2Nvb3JkaW5hdGUgPSBib3VuZGFyeV91c2VzX2FuY2hvciA/IGFjdGl2ZV9zdGF0ZS5mb2N1c19jb29yZGluYXRlIDogYWN0aXZlX3N0YXRlLmFuY2hvcl9jb29yZGluYXRlO1xuXHRcdFx0dmFyIGNvb3JkaW5hdGVfb3JkZXIgPSBnZXRfY29vcmRpbmF0ZV9vcmRlciggY29vcmRpbmF0ZSApO1xuXHRcdFx0dmFyIG9wcG9zaXRlX29yZGVyID0gZ2V0X2Nvb3JkaW5hdGVfb3JkZXIoIG9wcG9zaXRlX2Nvb3JkaW5hdGUgKTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHRudWxsICE9PSBjb29yZGluYXRlX29yZGVyXG5cdFx0XHRcdCYmIG51bGwgIT09IG9wcG9zaXRlX29yZGVyXG5cdFx0XHRcdCYmIGlzX2JvdW5kYXJ5X2Nyb3NzaW5nKCBib3VuZGFyeV9uYW1lLCBjb29yZGluYXRlX29yZGVyLCBvcHBvc2l0ZV9vcmRlciApXG5cdFx0XHQpIHtcblx0XHRcdFx0Y29vcmRpbmF0ZSA9IG9wcG9zaXRlX2Nvb3JkaW5hdGU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggYm91bmRhcnlfdXNlc19hbmNob3IgKSB7XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5hbmNob3JfY29vcmRpbmF0ZSA9IGNvb3JkaW5hdGU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUuZm9jdXNfY29vcmRpbmF0ZSA9IGNvb3JkaW5hdGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgYXQgbW9zdCBvbmUgdmlzdWFsIHNsaWNlIGZvciBlYWNoIGFjY2VwdGVkIGRhdGUgaW4gdGhlIGRyYWZ0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGNlbGxzICAgICAgICAgIE9yZGVyZWQgc2VsZWN0ZWQgY2VsbHMuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGR1cmF0aW9uX2xhYmVsIEV4YWN0IHZpc3VhbCBkdXJhdGlvbiBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gQm91bmRlZCB0ZW1wbGF0ZSBzbGljZSBtb2RlbHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnVpbGRfc2xpY2VzKCBjZWxscywgZHVyYXRpb25fbGFiZWwgKSB7XG5cdFx0XHR2YXIgc25hcHNob3QgPSBhY3RpdmVfc3RhdGUuc25hcHNob3Q7XG5cdFx0XHR2YXIgYm9va2luZ19jb2x1bW5fZ3V0dGVyX3B4ID0gTWF0aC5tYXgoIDAsIE51bWJlciggYWN0aXZlX3N0YXRlLmJvb2tpbmdfY29sdW1uX2d1dHRlcl9weCApIHx8IDAgKTtcblx0XHRcdHZhciBzdGFydF9vcmRlciA9IHNuYXBzaG90LmRhdGVfb3JkZXJbIGNlbGxzLnN0YXJ0LmRhdGUgXTtcblx0XHRcdHZhciBlbmRfb3JkZXIgPSBzbmFwc2hvdC5kYXRlX29yZGVyWyBjZWxscy5lbmQuZGF0ZSBdO1xuXHRcdFx0dmFyIHZpc2libGVfc3RhcnQgPSBzbmFwc2hvdC52aXNpYmxlX3JhbmdlLnN0YXJ0X21pbnV0ZTtcblx0XHRcdHZhciB2aXNpYmxlX2VuZCA9IHNuYXBzaG90LnZpc2libGVfcmFuZ2UuZW5kX21pbnV0ZTtcblx0XHRcdHZhciBzbGljZXMgPSBbXTtcblx0XHRcdHZhciBkdXJhdGlvbl9zbGljZSA9IG51bGw7XG5cblx0XHRcdHNuYXBzaG90LmRhdGVfY29sdW1ucy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbHVtbiApIHtcblx0XHRcdFx0dmFyIG9yZGVyID0gc25hcHNob3QuZGF0ZV9vcmRlclsgY29sdW1uLmRhdGUgXTtcblx0XHRcdFx0dmFyIGNvbHVtbl93aWR0aCA9IGNvbHVtbi5sb2dpY2FsX2VuZCAtIGNvbHVtbi5sb2dpY2FsX3N0YXJ0O1xuXHRcdFx0XHR2YXIgY29sdW1uX2d1dHRlciA9IE1hdGgubWluKCBib29raW5nX2NvbHVtbl9ndXR0ZXJfcHgsIE1hdGgubWF4KCAwLCAoIGNvbHVtbl93aWR0aCAtIDIgKSAvIDIgKSApO1xuXHRcdFx0XHR2YXIgc3RhcnRfbWludXRlO1xuXHRcdFx0XHR2YXIgZW5kX21pbnV0ZTtcblxuXHRcdFx0XHRpZiAoIG9yZGVyIDwgc3RhcnRfb3JkZXIgfHwgb3JkZXIgPiBlbmRfb3JkZXIgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXJ0X21pbnV0ZSA9IGNvbHVtbi5kYXRlID09PSBjZWxscy5zdGFydC5kYXRlID8gY2VsbHMuc3RhcnQud2FsbF9taW51dGUgOiB2aXNpYmxlX3N0YXJ0O1xuXHRcdFx0XHRlbmRfbWludXRlID0gY29sdW1uLmRhdGUgPT09IGNlbGxzLmVuZC5kYXRlID8gY2VsbHMuZW5kLndhbGxfbWludXRlICsgc25hcHNob3Quc2VsZWN0aW9uX3N0ZXBfbWludXRlcyA6IHZpc2libGVfZW5kO1xuXHRcdFx0XHRzdGFydF9taW51dGUgPSBNYXRoLm1heCggdmlzaWJsZV9zdGFydCwgTWF0aC5taW4oIHZpc2libGVfZW5kLCBzdGFydF9taW51dGUgKSApO1xuXHRcdFx0XHRlbmRfbWludXRlID0gTWF0aC5tYXgoIHN0YXJ0X21pbnV0ZSwgTWF0aC5taW4oIHZpc2libGVfZW5kLCBlbmRfbWludXRlICkgKTtcblx0XHRcdFx0c2xpY2VzLnB1c2goIHtcblx0XHRcdFx0XHRpbmxpbmVfc3RhcnRfcHg6IE51bWJlciggKCBjb2x1bW4ubG9naWNhbF9zdGFydCArIGNvbHVtbl9ndXR0ZXIgKS50b0ZpeGVkKCAzICkgKSxcblx0XHRcdFx0XHRpbmxpbmVfc2l6ZV9weDogTnVtYmVyKCBNYXRoLm1heCggMiwgY29sdW1uX3dpZHRoIC0gY29sdW1uX2d1dHRlciAqIDIgKS50b0ZpeGVkKCAzICkgKSxcblx0XHRcdFx0XHRibG9ja19zdGFydF9weDogTnVtYmVyKCAoICggc3RhcnRfbWludXRlIC0gdmlzaWJsZV9zdGFydCApICogc25hcHNob3QucGl4ZWxzX3Blcl9taW51dGUgKS50b0ZpeGVkKCAzICkgKSxcblx0XHRcdFx0XHRibG9ja19zaXplX3B4OiBOdW1iZXIoIE1hdGgubWF4KCAyLCAoIGVuZF9taW51dGUgLSBzdGFydF9taW51dGUgKSAqIHNuYXBzaG90LnBpeGVsc19wZXJfbWludXRlICkudG9GaXhlZCggMyApIClcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBkdXJhdGlvbl9sYWJlbCApIHtcblx0XHRcdFx0ZHVyYXRpb25fc2xpY2UgPSBzbGljZXMucmVkdWNlKCBmdW5jdGlvbiAoIHNlbGVjdGVkX3NsaWNlLCBzbGljZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gISBzZWxlY3RlZF9zbGljZSB8fCBzbGljZS5ibG9ja19zaXplX3B4ID4gc2VsZWN0ZWRfc2xpY2UuYmxvY2tfc2l6ZV9weCA/IHNsaWNlIDogc2VsZWN0ZWRfc2xpY2U7XG5cdFx0XHRcdH0sIG51bGwgKTtcblx0XHRcdFx0aWYgKCBkdXJhdGlvbl9zbGljZSApIHtcblx0XHRcdFx0XHRkdXJhdGlvbl9zbGljZS5kdXJhdGlvbl9sYWJlbCA9IGR1cmF0aW9uX2xhYmVsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBzbGljZXM7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBib3VuZGFyeSdzIGFjY2Vzc2libGUgdGVtcGxhdGUgbW9kZWwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gY2VsbCAgICAgICAgIFJlc29sdmVkIGNlbGwuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJvdW5kYXJ5ICAgICBzdGFydCBvciBlbmQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBTbGlkZXIgYW5kIHBvc2l0aW9uIG1vZGVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJ1aWxkX2JvdW5kYXJ5X21vZGVsKCBjZWxsLCBib3VuZGFyeSApIHtcblx0XHRcdHZhciBzbmFwc2hvdCA9IGFjdGl2ZV9zdGF0ZS5zbmFwc2hvdDtcblx0XHRcdHZhciBjb2x1bW4gPSBzbmFwc2hvdC5kYXRlX2NvbHVtbnNbIGdldF9jb2x1bW5faW5kZXgoIHNuYXBzaG90LCBjZWxsLmRhdGUgKSBdO1xuXHRcdFx0dmFyIGlzX2VuZCA9ICdlbmQnID09PSBib3VuZGFyeTtcblx0XHRcdHZhciB3YWxsX21pbnV0ZSA9IGNlbGwud2FsbF9taW51dGUgKyAoIGlzX2VuZCA/IHNuYXBzaG90LnNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgOiAwICk7XG5cdFx0XHR2YXIgbGFiZWwgPSBjZWxsLmRhdGUgKyAnICcgKyBmb3JtYXRfd2FsbF9taW51dGUoIHdhbGxfbWludXRlICk7XG5cdFx0XHR2YXIgbWF4aW11bV9pbmRleCA9IE1hdGgubWF4KCAwLCBNYXRoLmNlaWwoICggc25hcHNob3QudmlzaWJsZV9yYW5nZS5lbmRfbWludXRlIC0gc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGUgKSAvIHNuYXBzaG90LnNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgKSAtIDEgKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGFiZWw6IGludGVycG9sYXRlX2xhYmVsKCBpc19lbmQgPyBpMThuLmVuZF9jb250cm9sX2xhYmVsIDogaTE4bi5zdGFydF9jb250cm9sX2xhYmVsLCB7IHRpbWU6IGxhYmVsIH0gKSxcblx0XHRcdFx0dmFsdWVfbWluOiAwLFxuXHRcdFx0XHR2YWx1ZV9tYXg6IG1heGltdW1faW5kZXgsXG5cdFx0XHRcdHZhbHVlX25vdzogY2VsbC5zbmFwX2luZGV4LFxuXHRcdFx0XHR2YWx1ZV90ZXh0OiBsYWJlbCxcblx0XHRcdFx0aW5saW5lX3B4OiBOdW1iZXIoICggY29sdW1uLmxvZ2ljYWxfc3RhcnQgKyAoIGNvbHVtbi5sb2dpY2FsX2VuZCAtIGNvbHVtbi5sb2dpY2FsX3N0YXJ0ICkgLyAyICkudG9GaXhlZCggMyApICksXG5cdFx0XHRcdGJsb2NrX3B4OiBOdW1iZXIoIE1hdGgubWF4KCAwLCBNYXRoLm1pbiggc25hcHNob3QuYmxvY2tfZXh0ZW50X3B4LCAoIHdhbGxfbWludXRlIC0gc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGUgKSAqIHNuYXBzaG90LnBpeGVsc19wZXJfbWludXRlICkgKS50b0ZpeGVkKCAzICkgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBCdWlsZCBleGVjdXRhYmxlLWZyZWUgY2hvaWNlcyBmb3IgZXZlcnkgdW5yZXNvbHZlZCByZXBlYXRlZC1ob3VyIGJvdW5kYXJ5LlxuXHRcdCAqXG5cdFx0ICogQ2FuZGlkYXRlIGluc3RhbnRzIGFuZCBvZmZzZXRzIGNvbWUgZnJvbSB0aGUgYWNjZXB0ZWQgc2VydmVyIGRhdGUgYmFuZHMuXG5cdFx0ICogVGhlIGFkYXB0ZXIgbmV2ZXIgZGVyaXZlcyBhbiBhdXRob3JpdGF0aXZlIG9mZnNldCBmcm9tIHRoZSBicm93c2VyIHRpbWV6b25lLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGNlbGxzIENocm9ub2xvZ2ljYWxseSBvcmRlcmVkIHN0YXJ0IGFuZCBlbmQgY2VsbHMuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gT3JkZXJlZCBhY2Nlc3NpYmxlIGZvbGQtY2hvaWNlIHRlbXBsYXRlIG1vZGVscy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBidWlsZF9mb2xkX2Nob2ljZXMoIGNlbGxzICkge1xuXHRcdFx0dmFyIGNob2ljZXMgPSBbXTtcblx0XHRcdHZhciBzdGFydF9lbmRwb2ludCA9IFN0cmluZyggY2VsbHMgJiYgY2VsbHMuc3RhcnRfZW5kcG9pbnQgfHwgJycgKTtcblxuXHRcdFx0WyAnc3RhcnQnLCAnZW5kJyBdLmZvckVhY2goIGZ1bmN0aW9uICggYm91bmRhcnlfbmFtZSApIHtcblx0XHRcdFx0dmFyIGNlbGwgPSBjZWxscyAmJiBjZWxsc1sgYm91bmRhcnlfbmFtZSBdO1xuXHRcdFx0XHR2YXIgZW5kcG9pbnQgPSAnc3RhcnQnID09PSBib3VuZGFyeV9uYW1lXG5cdFx0XHRcdFx0PyBzdGFydF9lbmRwb2ludFxuXHRcdFx0XHRcdDogKCAnYW5jaG9yJyA9PT0gc3RhcnRfZW5kcG9pbnQgPyAnZm9jdXMnIDogJ2FuY2hvcicgKTtcblx0XHRcdFx0dmFyIGJvdW5kYXJ5X2xhYmVsID0gJ3N0YXJ0JyA9PT0gYm91bmRhcnlfbmFtZSA/IGkxOG4uZm9sZF9zdGFydF9ib3VuZGFyeSA6IGkxOG4uZm9sZF9lbmRfYm91bmRhcnk7XG5cblx0XHRcdFx0aWYgKCAhIGNlbGwgfHwgJ2ZvbGQnICE9PSBjZWxsLnN0YXR1cyB8fCAhIEFycmF5LmlzQXJyYXkoIGNlbGwuY2FuZGlkYXRlcyApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjZWxsLmNhbmRpZGF0ZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdFx0dmFyIG9mZnNldF9sYWJlbCA9IGZvcm1hdF91dGNfb2Zmc2V0KCBjYW5kaWRhdGUub2Zmc2V0X21pbnV0ZXMgKTtcblxuXHRcdFx0XHRcdGlmICggISBjYW5kaWRhdGUub2NjdXJyZW5jZV9pZCB8fCAhIG9mZnNldF9sYWJlbCApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2hvaWNlcy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRlbmRwb2ludDogZW5kcG9pbnQsXG5cdFx0XHRcdFx0XHRvY2N1cnJlbmNlX2lkOiBTdHJpbmcoIGNhbmRpZGF0ZS5vY2N1cnJlbmNlX2lkICksXG5cdFx0XHRcdFx0XHRsYWJlbDogaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4uZm9sZF9jaG9pY2VfbGFiZWwsIHtcblx0XHRcdFx0XHRcdFx0Ym91bmRhcnk6IGJvdW5kYXJ5X2xhYmVsLFxuXHRcdFx0XHRcdFx0XHRkYXRlOiBjZWxsLmRhdGUsXG5cdFx0XHRcdFx0XHRcdHRpbWU6IGZvcm1hdF93YWxsX21pbnV0ZSggY2VsbC53YWxsX21pbnV0ZSApLFxuXHRcdFx0XHRcdFx0XHRvZmZzZXQ6IG9mZnNldF9sYWJlbFxuXHRcdFx0XHRcdFx0fSApXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBjaG9pY2VzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFubm91bmNlIGxvY2FsIGRyYWZ0IHN0YXRlIHdpdGhvdXQgaW52b2tpbmcgYSByZXF1ZXN0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgQWNjZXNzaWJsZSBtZXNzYWdlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYW5ub3VuY2UoIG1lc3NhZ2UgKSB7XG5cdFx0XHR2YXIgc3RhdHVzID0gYWN0aXZlX3N0YXRlICYmIGFjdGl2ZV9zdGF0ZS5zdXJmYWNlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zZWxlY3Rpb24tc3RhdHVzXScgKTtcblxuXHRcdFx0aWYgKCBzdGF0dXMgKSB7XG5cdFx0XHRcdHN0YXR1cy50ZXh0Q29udGVudCA9IFN0cmluZyggbWVzc2FnZSB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEtlZXAgb25lIGFjdGlvbiBwb3BvdmVyIGluc2lkZSB0aGUgdmlzaWJsZSBUaW1lbGluZSBjYW52YXMuXG5cdFx0ICpcblx0XHQgKiBUaGlzIGlzIHByZXNlbnRhdGlvbi1vbmx5IGdlb21ldHJ5LiBTZWxlY3Rpb24gaW5zdGFudHMgY29udGludWUgdXNpbmcgdGhlXG5cdFx0ICogaW1tdXRhYmxlIGdlc3R1cmUgc25hcHNob3QgYW5kIHNlcnZlci1heGlzIGdlb21ldHJ5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBhY3Rpb25zICAgICAgIFJlbmRlcmVkIGFjdGlvbiBwb3BvdmVyLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgc3RhdGUgICAgICAgICBBY3RpdmUgbG9jYWwgc2VsZWN0aW9uIHN0YXRlLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgc3RhcnRfY29udHJvbCBTdGFydCBib3VuZGFyeSBwcmVzZW50YXRpb24gbW9kZWwuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICBlbmRfY29udHJvbCAgIEVuZCBib3VuZGFyeSBwcmVzZW50YXRpb24gbW9kZWwuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwb3NpdGlvbl9hY3Rpb25zKCBhY3Rpb25zLCBzdGF0ZSwgc3RhcnRfY29udHJvbCwgZW5kX2NvbnRyb2wgKSB7XG5cdFx0XHR2YXIgY2FudmFzID0gc3RhdGUucGFuZWwgJiYgc3RhdGUucGFuZWwuY2xvc2VzdFxuXHRcdFx0XHQ/IHN0YXRlLnBhbmVsLmNsb3Nlc3QoIGNhbnZhc19zZWxlY3RvciApXG5cdFx0XHRcdDogKCBtb3VudCA/IG1vdW50LnF1ZXJ5U2VsZWN0b3IoIGNhbnZhc19zZWxlY3RvciApIDogbnVsbCApO1xuXHRcdFx0dmFyIGR1cmF0aW9uID0gYWN0aW9ucy5wYXJlbnROb2RlID8gYWN0aW9ucy5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zZWxlY3Rpb24tZHVyYXRpb25dJyApIDogbnVsbDtcblx0XHRcdHZhciBzdXJmYWNlX3JlY3RhbmdsZSA9IHN0YXRlLnN1cmZhY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHR2YXIgY2FudmFzX3JlY3RhbmdsZSA9IGNhbnZhcyA/IGNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSA6IHN1cmZhY2VfcmVjdGFuZ2xlO1xuXHRcdFx0dmFyIGFuY2hvcl9yZWN0YW5nbGUgPSBkdXJhdGlvbiA/IGR1cmF0aW9uLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpIDogbnVsbDtcblx0XHRcdHZhciBwcmVzZW50YXRpb25fc2xpY2VzID0gQXJyYXkuaXNBcnJheSggc3RhdGUucHJlc2VudGF0aW9uX3NsaWNlcyApID8gc3RhdGUucHJlc2VudGF0aW9uX3NsaWNlcyA6IFtdO1xuXHRcdFx0dmFyIHZpZXdwb3J0X3dpZHRoID0gd2luZG93LmlubmVyV2lkdGggfHwgKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgPyBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggOiAwICk7XG5cdFx0XHR2YXIgdmlld3BvcnRfaGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0IHx8ICggZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ID8gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCA6IDAgKTtcblx0XHRcdHZhciB2aXNpYmxlX2lubGluZV9zdGFydCA9IE1hdGgubWF4KCBjYW52YXNfcmVjdGFuZ2xlLmxlZnQsIDggKTtcblx0XHRcdHZhciB2aXNpYmxlX2lubGluZV9lbmQgPSBNYXRoLm1pbiggY2FudmFzX3JlY3RhbmdsZS5yaWdodCwgdmlld3BvcnRfd2lkdGggfHwgY2FudmFzX3JlY3RhbmdsZS5yaWdodCApIC0gODtcblx0XHRcdHZhciB2aXNpYmxlX2Jsb2NrX3N0YXJ0ID0gTWF0aC5tYXgoIHN1cmZhY2VfcmVjdGFuZ2xlLnRvcCwgOCApO1xuXHRcdFx0dmFyIHZpc2libGVfYmxvY2tfZW5kID0gTWF0aC5taW4oIHN1cmZhY2VfcmVjdGFuZ2xlLmJvdHRvbSwgdmlld3BvcnRfaGVpZ2h0IHx8IHN1cmZhY2VfcmVjdGFuZ2xlLmJvdHRvbSApIC0gODtcblx0XHRcdHZhciBkZXNpcmVkX2lubGluZV9zaXplID0gJ3JlYWR5JyA9PT0gc3RhdGUucGhhc2UgPyByZWFkeV9hY3Rpb25zX2lubGluZV9zaXplIDogc3RhdHVzX2FjdGlvbnNfaW5saW5lX3NpemU7XG5cdFx0XHR2YXIgYXZhaWxhYmxlX2lubGluZV9zaXplID0gTWF0aC5tYXgoIDEsIHZpc2libGVfaW5saW5lX2VuZCAtIHZpc2libGVfaW5saW5lX3N0YXJ0ICk7XG5cdFx0XHR2YXIgYXZhaWxhYmxlX2Jsb2NrX3NpemUgPSBNYXRoLm1heCggODAsIHZpc2libGVfYmxvY2tfZW5kIC0gdmlzaWJsZV9ibG9ja19zdGFydCApO1xuXHRcdFx0dmFyIGFjdGlvbnNfaW5saW5lX3NpemUgPSBNYXRoLm1pbiggZGVzaXJlZF9pbmxpbmVfc2l6ZSwgYXZhaWxhYmxlX2lubGluZV9zaXplICk7XG5cdFx0XHR2YXIgYWN0aW9uc19ibG9ja19zaXplO1xuXHRcdFx0dmFyIGFuY2hvcl9pbmxpbmU7XG5cdFx0XHR2YXIgYW5jaG9yX2Jsb2NrX2NlbnRlcjtcblx0XHRcdHZhciBhbmNob3JfYmxvY2tfc3RhcnQ7XG5cdFx0XHR2YXIgYW5jaG9yX2Jsb2NrX2VuZDtcblx0XHRcdHZhciBzZWxlY3Rpb25faW5saW5lX3N0YXJ0O1xuXHRcdFx0dmFyIHNlbGVjdGlvbl9pbmxpbmVfZW5kO1xuXHRcdFx0dmFyIHNlbGVjdGlvbl9pbmxpbmVfbGVmdDtcblx0XHRcdHZhciBzZWxlY3Rpb25faW5saW5lX3JpZ2h0O1xuXHRcdFx0dmFyIHNlbGVjdGlvbl9ibG9ja19zdGFydDtcblx0XHRcdHZhciBzZWxlY3Rpb25fYmxvY2tfZW5kO1xuXHRcdFx0dmFyIGlubGluZV9zdGFydDtcblx0XHRcdHZhciBibG9ja19zdGFydDtcblx0XHRcdHZhciBhdmFpbGFibGVfbGVmdDtcblx0XHRcdHZhciBhdmFpbGFibGVfcmlnaHQ7XG5cdFx0XHR2YXIgYXZhaWxhYmxlX2Fib3ZlO1xuXHRcdFx0dmFyIGF2YWlsYWJsZV9iZWxvdztcblx0XHRcdHZhciBwbGFjZW1lbnQ7XG5cdFx0XHR2YXIgcGxhY2VtZW50X3NwYWNlO1xuXHRcdFx0dmFyIHBsYWNlbWVudF9ibG9ja19saW1pdDtcblx0XHRcdHZhciBsb2dpY2FsX2lubGluZV9zdGFydDtcblxuXHRcdFx0YWN0aW9ucy5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy10aW1lLXJvd3Mtc2VsZWN0aW9uLXBvcG92ZXItaW5saW5lLXNpemUnLCBNYXRoLmZsb29yKCBhY3Rpb25zX2lubGluZV9zaXplICkgKyAncHgnICk7XG5cdFx0XHRhY3Rpb25zLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWUtcm93cy1zZWxlY3Rpb24tcG9wb3Zlci1taW4taW5saW5lLXNpemUnLCBNYXRoLmZsb29yKCBNYXRoLm1pbiggbWluaW11bV9hY3Rpb25zX2lubGluZV9zaXplLCBhdmFpbGFibGVfaW5saW5lX3NpemUgKSApICsgJ3B4JyApO1xuXHRcdFx0YWN0aW9ucy5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy10aW1lLXJvd3Mtc2VsZWN0aW9uLXBvcG92ZXItbWluLWJsb2NrLXNpemUnLCBNYXRoLmZsb29yKCBNYXRoLm1pbiggbWluaW11bV9hY3Rpb25zX2Jsb2NrX3NpemUsIGF2YWlsYWJsZV9ibG9ja19zaXplICkgKSArICdweCcgKTtcblx0XHRcdGFjdGlvbnMuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmMtdGltZS1yb3dzLXNlbGVjdGlvbi1wb3BvdmVyLW1heC1ibG9jay1zaXplJyApO1xuXHRcdFx0YWN0aW9uc19ibG9ja19zaXplID0gYWN0aW9ucy5vZmZzZXRIZWlnaHQgfHwgMTkwO1xuXG5cdFx0XHRhbmNob3JfaW5saW5lID0gYW5jaG9yX3JlY3RhbmdsZVxuXHRcdFx0XHQ/IGFuY2hvcl9yZWN0YW5nbGUubGVmdCArIGFuY2hvcl9yZWN0YW5nbGUud2lkdGggLyAyXG5cdFx0XHRcdDogKCAncnRsJyA9PT0gc3RhdGUuc25hcHNob3QuZGlyZWN0aW9uID8gc3VyZmFjZV9yZWN0YW5nbGUucmlnaHQgLSBlbmRfY29udHJvbC5pbmxpbmVfcHggOiBzdXJmYWNlX3JlY3RhbmdsZS5sZWZ0ICsgZW5kX2NvbnRyb2wuaW5saW5lX3B4ICk7XG5cdFx0XHRzZWxlY3Rpb25fYmxvY2tfc3RhcnQgPSBwcmVzZW50YXRpb25fc2xpY2VzLnJlZHVjZSggZnVuY3Rpb24gKCBjdXJyZW50X3N0YXJ0LCBzbGljZSApIHtcblx0XHRcdFx0cmV0dXJuIE1hdGgubWluKCBjdXJyZW50X3N0YXJ0LCBOdW1iZXIoIHNsaWNlLmJsb2NrX3N0YXJ0X3B4ICkgKTtcblx0XHRcdH0sIE1hdGgubWluKCBzdGFydF9jb250cm9sLmJsb2NrX3B4LCBlbmRfY29udHJvbC5ibG9ja19weCApICk7XG5cdFx0XHRzZWxlY3Rpb25fYmxvY2tfZW5kID0gcHJlc2VudGF0aW9uX3NsaWNlcy5yZWR1Y2UoIGZ1bmN0aW9uICggY3VycmVudF9lbmQsIHNsaWNlICkge1xuXHRcdFx0XHRyZXR1cm4gTWF0aC5tYXgoIGN1cnJlbnRfZW5kLCBOdW1iZXIoIHNsaWNlLmJsb2NrX3N0YXJ0X3B4ICkgKyBOdW1iZXIoIHNsaWNlLmJsb2NrX3NpemVfcHggKSApO1xuXHRcdFx0fSwgTWF0aC5tYXgoIHN0YXJ0X2NvbnRyb2wuYmxvY2tfcHgsIGVuZF9jb250cm9sLmJsb2NrX3B4ICkgKTtcblx0XHRcdHNlbGVjdGlvbl9pbmxpbmVfc3RhcnQgPSBwcmVzZW50YXRpb25fc2xpY2VzLnJlZHVjZSggZnVuY3Rpb24gKCBjdXJyZW50X3N0YXJ0LCBzbGljZSApIHtcblx0XHRcdFx0cmV0dXJuIE1hdGgubWluKCBjdXJyZW50X3N0YXJ0LCBOdW1iZXIoIHNsaWNlLmlubGluZV9zdGFydF9weCApICk7XG5cdFx0XHR9LCBNYXRoLm1pbiggc3RhcnRfY29udHJvbC5pbmxpbmVfcHgsIGVuZF9jb250cm9sLmlubGluZV9weCApICk7XG5cdFx0XHRzZWxlY3Rpb25faW5saW5lX2VuZCA9IHByZXNlbnRhdGlvbl9zbGljZXMucmVkdWNlKCBmdW5jdGlvbiAoIGN1cnJlbnRfZW5kLCBzbGljZSApIHtcblx0XHRcdFx0cmV0dXJuIE1hdGgubWF4KCBjdXJyZW50X2VuZCwgTnVtYmVyKCBzbGljZS5pbmxpbmVfc3RhcnRfcHggKSArIE51bWJlciggc2xpY2UuaW5saW5lX3NpemVfcHggKSApO1xuXHRcdFx0fSwgTWF0aC5tYXgoIHN0YXJ0X2NvbnRyb2wuaW5saW5lX3B4LCBlbmRfY29udHJvbC5pbmxpbmVfcHggKSApO1xuXHRcdFx0c2VsZWN0aW9uX2lubGluZV9sZWZ0ID0gJ3J0bCcgPT09IHN0YXRlLnNuYXBzaG90LmRpcmVjdGlvblxuXHRcdFx0XHQ/IHN1cmZhY2VfcmVjdGFuZ2xlLnJpZ2h0IC0gc2VsZWN0aW9uX2lubGluZV9lbmRcblx0XHRcdFx0OiBzdXJmYWNlX3JlY3RhbmdsZS5sZWZ0ICsgc2VsZWN0aW9uX2lubGluZV9zdGFydDtcblx0XHRcdHNlbGVjdGlvbl9pbmxpbmVfcmlnaHQgPSAncnRsJyA9PT0gc3RhdGUuc25hcHNob3QuZGlyZWN0aW9uXG5cdFx0XHRcdD8gc3VyZmFjZV9yZWN0YW5nbGUucmlnaHQgLSBzZWxlY3Rpb25faW5saW5lX3N0YXJ0XG5cdFx0XHRcdDogc3VyZmFjZV9yZWN0YW5nbGUubGVmdCArIHNlbGVjdGlvbl9pbmxpbmVfZW5kO1xuXHRcdFx0YW5jaG9yX2Jsb2NrX3N0YXJ0ID0gc3VyZmFjZV9yZWN0YW5nbGUudG9wICsgc2VsZWN0aW9uX2Jsb2NrX3N0YXJ0O1xuXHRcdFx0YW5jaG9yX2Jsb2NrX2VuZCA9IHN1cmZhY2VfcmVjdGFuZ2xlLnRvcCArIHNlbGVjdGlvbl9ibG9ja19lbmQ7XG5cdFx0XHRhdmFpbGFibGVfbGVmdCA9IE1hdGgubWF4KCAwLCBzZWxlY3Rpb25faW5saW5lX2xlZnQgLSB2aXNpYmxlX2lubGluZV9zdGFydCAtIGFjdGlvbnNfc2VwYXJhdGlvbl9waXhlbHMgKTtcblx0XHRcdGF2YWlsYWJsZV9yaWdodCA9IE1hdGgubWF4KCAwLCB2aXNpYmxlX2lubGluZV9lbmQgLSBzZWxlY3Rpb25faW5saW5lX3JpZ2h0IC0gYWN0aW9uc19zZXBhcmF0aW9uX3BpeGVscyApO1xuXHRcdFx0YXZhaWxhYmxlX2Fib3ZlID0gTWF0aC5tYXgoIDAsIGFuY2hvcl9ibG9ja19zdGFydCAtIHZpc2libGVfYmxvY2tfc3RhcnQgLSBhY3Rpb25zX3NlcGFyYXRpb25fcGl4ZWxzICk7XG5cdFx0XHRhdmFpbGFibGVfYmVsb3cgPSBNYXRoLm1heCggMCwgdmlzaWJsZV9ibG9ja19lbmQgLSBhbmNob3JfYmxvY2tfZW5kIC0gYWN0aW9uc19zZXBhcmF0aW9uX3BpeGVscyApO1xuXHRcdFx0cGxhY2VtZW50ID0gcmVzb2x2ZV9hY3Rpb25zX3BsYWNlbWVudChcblx0XHRcdFx0bWluaW11bV9hY3Rpb25zX2lubGluZV9zaXplLFxuXHRcdFx0XHRhY3Rpb25zX2Jsb2NrX3NpemUsXG5cdFx0XHRcdGF2YWlsYWJsZV9sZWZ0LFxuXHRcdFx0XHRhdmFpbGFibGVfcmlnaHQsXG5cdFx0XHRcdGF2YWlsYWJsZV9hYm92ZSxcblx0XHRcdFx0YXZhaWxhYmxlX2JlbG93LFxuXHRcdFx0XHRzdGF0ZS5zbmFwc2hvdC5kaXJlY3Rpb25cblx0XHRcdCk7XG5cblx0XHRcdGlmICggJ2xlZnQnID09PSBwbGFjZW1lbnQgfHwgJ3JpZ2h0JyA9PT0gcGxhY2VtZW50ICkge1xuXHRcdFx0XHRwbGFjZW1lbnRfc3BhY2UgPSAnbGVmdCcgPT09IHBsYWNlbWVudCA/IGF2YWlsYWJsZV9sZWZ0IDogYXZhaWxhYmxlX3JpZ2h0O1xuXHRcdFx0XHRhY3Rpb25zX2lubGluZV9zaXplID0gTWF0aC5taW4oIGRlc2lyZWRfaW5saW5lX3NpemUsIHBsYWNlbWVudF9zcGFjZSApO1xuXHRcdFx0XHRhY3Rpb25zLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWUtcm93cy1zZWxlY3Rpb24tcG9wb3Zlci1pbmxpbmUtc2l6ZScsIE1hdGguZmxvb3IoIGFjdGlvbnNfaW5saW5lX3NpemUgKSArICdweCcgKTtcblx0XHRcdFx0YWN0aW9uc19ibG9ja19zaXplID0gYWN0aW9ucy5vZmZzZXRIZWlnaHQgfHwgMTkwO1xuXHRcdFx0XHRwbGFjZW1lbnRfYmxvY2tfbGltaXQgPSBhdmFpbGFibGVfYmxvY2tfc2l6ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBsYWNlbWVudF9zcGFjZSA9ICdhYm92ZScgPT09IHBsYWNlbWVudCA/IGF2YWlsYWJsZV9hYm92ZSA6IGF2YWlsYWJsZV9iZWxvdztcblx0XHRcdFx0cGxhY2VtZW50X2Jsb2NrX2xpbWl0ID0gTWF0aC5tYXgoIDgwLCBNYXRoLm1pbiggcGxhY2VtZW50X3NwYWNlLCBhdmFpbGFibGVfYmxvY2tfc2l6ZSApICk7XG5cdFx0XHR9XG5cblx0XHRcdGFjdGlvbnMuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZS1yb3dzLXNlbGVjdGlvbi1wb3BvdmVyLW1pbi1ibG9jay1zaXplJywgTWF0aC5mbG9vciggTWF0aC5taW4oIG1pbmltdW1fYWN0aW9uc19ibG9ja19zaXplLCBwbGFjZW1lbnRfYmxvY2tfbGltaXQgKSApICsgJ3B4JyApO1xuXHRcdFx0aWYgKCBwbGFjZW1lbnRfYmxvY2tfbGltaXQgPCBhY3Rpb25zX2Jsb2NrX3NpemUgKSB7XG5cdFx0XHRcdGFjdGlvbnMuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZS1yb3dzLXNlbGVjdGlvbi1wb3BvdmVyLW1heC1ibG9jay1zaXplJywgTWF0aC5mbG9vciggcGxhY2VtZW50X2Jsb2NrX2xpbWl0ICkgKyAncHgnICk7XG5cdFx0XHRcdGFjdGlvbnNfYmxvY2tfc2l6ZSA9IGFjdGlvbnMub2Zmc2V0SGVpZ2h0IHx8IE1hdGgubWluKCAxOTAsIHBsYWNlbWVudF9ibG9ja19saW1pdCApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoICdsZWZ0JyA9PT0gcGxhY2VtZW50IHx8ICdyaWdodCcgPT09IHBsYWNlbWVudCApIHtcblx0XHRcdFx0aW5saW5lX3N0YXJ0ID0gcmVzb2x2ZV9hY3Rpb25zX2lubGluZV9zdGFydCggcGxhY2VtZW50LCBzZWxlY3Rpb25faW5saW5lX2xlZnQsIHNlbGVjdGlvbl9pbmxpbmVfcmlnaHQsIGFjdGlvbnNfaW5saW5lX3NpemUsIGFjdGlvbnNfc2VwYXJhdGlvbl9waXhlbHMgKTtcblx0XHRcdFx0YW5jaG9yX2Jsb2NrX2NlbnRlciA9IGFuY2hvcl9yZWN0YW5nbGVcblx0XHRcdFx0XHQ/IGFuY2hvcl9yZWN0YW5nbGUudG9wICsgYW5jaG9yX3JlY3RhbmdsZS5oZWlnaHQgLyAyXG5cdFx0XHRcdFx0OiAoIGFuY2hvcl9ibG9ja19zdGFydCArIGFuY2hvcl9ibG9ja19lbmQgKSAvIDI7XG5cdFx0XHRcdGJsb2NrX3N0YXJ0ID0gTWF0aC5tYXgoIHZpc2libGVfYmxvY2tfc3RhcnQsIE1hdGgubWluKCB2aXNpYmxlX2Jsb2NrX2VuZCAtIGFjdGlvbnNfYmxvY2tfc2l6ZSwgYW5jaG9yX2Jsb2NrX2NlbnRlciAtIGFjdGlvbnNfYmxvY2tfc2l6ZSAvIDIgKSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aW5saW5lX3N0YXJ0ID0gTWF0aC5tYXgoIHZpc2libGVfaW5saW5lX3N0YXJ0LCBNYXRoLm1pbiggdmlzaWJsZV9pbmxpbmVfZW5kIC0gYWN0aW9uc19pbmxpbmVfc2l6ZSwgYW5jaG9yX2lubGluZSAtIGFjdGlvbnNfaW5saW5lX3NpemUgLyAyICkgKTtcblx0XHRcdFx0YmxvY2tfc3RhcnQgPSByZXNvbHZlX2FjdGlvbnNfYmxvY2tfc3RhcnQoIHBsYWNlbWVudCwgYW5jaG9yX2Jsb2NrX3N0YXJ0LCBhbmNob3JfYmxvY2tfZW5kLCBhY3Rpb25zX2Jsb2NrX3NpemUsIGFjdGlvbnNfc2VwYXJhdGlvbl9waXhlbHMgKTtcblx0XHRcdH1cblx0XHRcdGxvZ2ljYWxfaW5saW5lX3N0YXJ0ID0gJ3J0bCcgPT09IHN0YXRlLnNuYXBzaG90LmRpcmVjdGlvblxuXHRcdFx0XHQ/IHN1cmZhY2VfcmVjdGFuZ2xlLnJpZ2h0IC0gaW5saW5lX3N0YXJ0IC0gYWN0aW9uc19pbmxpbmVfc2l6ZVxuXHRcdFx0XHQ6IGlubGluZV9zdGFydCAtIHN1cmZhY2VfcmVjdGFuZ2xlLmxlZnQ7XG5cblx0XHRcdGFjdGlvbnMuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zZWxlY3Rpb24tcGxhY2VtZW50JywgcGxhY2VtZW50ICk7XG5cdFx0XHRhY3Rpb25zLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWUtcm93cy1zZWxlY3Rpb24tcG9wb3Zlci1pbmxpbmUnLCBsb2dpY2FsX2lubGluZV9zdGFydCArICdweCcgKTtcblx0XHRcdGFjdGlvbnMuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZS1yb3dzLXNlbGVjdGlvbi1wb3BvdmVyLWJsb2NrJywgYmxvY2tfc3RhcnQgLSBzdXJmYWNlX3JlY3RhbmdsZS50b3AgKyAncHgnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIHRoZSBhdXRob3JpdGF0aXZlIHByZXZpZXcvYWN0aW9uIHN0YXRlIGluc2lkZSB0aGUgcmV0YWluZWQgb3ZlcmxheS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gb3ZlcmxheSBDdXJyZW50IGRyYWZ0IG92ZXJsYXkuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfYWN0aW9ucyggb3ZlcmxheSApIHtcblx0XHRcdHZhciBzdGF0ZSA9IGFjdGl2ZV9zdGF0ZTtcblx0XHRcdHZhciBhY3Rpb25zX3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCAnYWN0aW9ucycgKTtcblx0XHRcdHZhciBob2xkZXI7XG5cdFx0XHR2YXIgYWN0aW9ucztcblx0XHRcdHZhciBzdGFydF9jb250cm9sO1xuXHRcdFx0dmFyIGVuZF9jb250cm9sO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgc3RhdGVcblx0XHRcdFx0fHwgISBvdmVybGF5XG5cdFx0XHRcdHx8ICEgYWN0aW9uc190ZW1wbGF0ZVxuXHRcdFx0XHR8fCBbICdwcmV2aWV3aW5nJywgJ3JlYWR5JywgJ2Vycm9yJywgJ2FwcGx5aW5nJywgJ2F3YWl0aW5nX3JlYWRiYWNrJyBdLmluZGV4T2YoIHN0YXRlLnBoYXNlICkgPT09IC0xXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3RhcnRfY29udHJvbCA9IGJ1aWxkX2JvdW5kYXJ5X21vZGVsKCBzdGF0ZS5jZWxscy5zdGFydCwgJ3N0YXJ0JyApO1xuXHRcdFx0ZW5kX2NvbnRyb2wgPSBidWlsZF9ib3VuZGFyeV9tb2RlbCggc3RhdGUuY2VsbHMuZW5kLCAnZW5kJyApO1xuXHRcdFx0aG9sZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRcdGhvbGRlci5pbm5lckhUTUwgPSBhY3Rpb25zX3RlbXBsYXRlKCB7XG5cdFx0XHRcdHN0YXRlOiBzdGF0ZS5waGFzZSxcblx0XHRcdFx0cHJldmlldzogc3RhdGUucHJldmlldyxcblx0XHRcdFx0ZXJyb3JfbWVzc2FnZTogc3RhdGUuZXJyb3JfbWVzc2FnZSxcblx0XHRcdFx0aTE4bjogaTE4blxuXHRcdFx0fSApO1xuXHRcdFx0YWN0aW9ucyA9IGhvbGRlci5maXJzdEVsZW1lbnRDaGlsZDtcblx0XHRcdGlmICggISBhY3Rpb25zICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRvdmVybGF5LmFwcGVuZENoaWxkKCBhY3Rpb25zICk7XG5cdFx0XHRwb3NpdGlvbl9hY3Rpb25zKCBhY3Rpb25zLCBzdGF0ZSwgc3RhcnRfY29udHJvbCwgZW5kX2NvbnRyb2wgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgb25lIGJvdW5kZWQgb3ZlcmxheSB0aHJvdWdoIHRoZSBmaXhlZCBXb3JkUHJlc3MgdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9kcmFmdCgpIHtcblx0XHRcdHZhciBzdGF0ZSA9IGFjdGl2ZV9zdGF0ZTtcblx0XHRcdHZhciBkcmFmdF90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggJ2RyYWZ0JyApO1xuXHRcdFx0dmFyIGRyYWZ0O1xuXHRcdFx0dmFyIGNlbGxzO1xuXHRcdFx0dmFyIGhvbGRlcjtcblx0XHRcdHZhciBvdmVybGF5O1xuXHRcdFx0dmFyIHN0YXJ0X2xhYmVsO1xuXHRcdFx0dmFyIGVuZF9sYWJlbDtcblx0XHRcdHZhciBkdXJhdGlvbl9sYWJlbDtcblx0XHRcdHZhciBzdGFydF9lbmRwb2ludF9sYWJlbDtcblx0XHRcdHZhciBlbmRfZW5kcG9pbnRfbGFiZWw7XG5cdFx0XHR2YXIgc3RhdHVzX21lc3NhZ2U7XG5cdFx0XHR2YXIgcHJlc2VudGF0aW9uX3NsaWNlcztcblx0XHRcdHZhciBzdGFydF9jb250cm9sO1xuXHRcdFx0dmFyIGVuZF9jb250cm9sO1xuXG5cdFx0XHRwZW5kaW5nX2ZyYW1lID0gMDtcblx0XHRcdGlmICggISBzdGF0ZSB8fCAhIHN0YXRlLnN1cmZhY2UuaXNDb25uZWN0ZWQgfHwgISBkcmFmdF90ZW1wbGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZHJhZnQgPSBnZW9tZXRyeS5yZXNvbHZlX2RyYWZ0KCBzdGF0ZS5zbmFwc2hvdCwgc3RhdGUuYW5jaG9yX2Nvb3JkaW5hdGUsIHN0YXRlLmZvY3VzX2Nvb3JkaW5hdGUgKTtcblx0XHRcdGNlbGxzID0gZ2V0X2RyYWZ0X2NlbGxzKCBkcmFmdCApO1xuXHRcdFx0aWYgKCAhIGRyYWZ0IHx8ICEgY2VsbHMgfHwgJ2ludmFsaWQnID09PSBkcmFmdC5zdGF0dXMgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN0YXJ0X2xhYmVsID0gY2VsbHMuc3RhcnQuZGF0ZSArICcgJyArIGZvcm1hdF93YWxsX21pbnV0ZSggY2VsbHMuc3RhcnQud2FsbF9taW51dGUgKTtcblx0XHRcdGVuZF9sYWJlbCA9IGNlbGxzLmVuZC5kYXRlICsgJyAnICsgZm9ybWF0X3dhbGxfbWludXRlKCBjZWxscy5lbmQud2FsbF9taW51dGUgKyBzdGF0ZS5zbmFwc2hvdC5zZWxlY3Rpb25fc3RlcF9taW51dGVzICk7XG5cdFx0XHRkdXJhdGlvbl9sYWJlbCA9ICdleGFjdCcgPT09IGRyYWZ0LnN0YXR1cyA/IGZvcm1hdF9kdXJhdGlvbiggZHJhZnQuZHVyYXRpb25fbWludXRlcyApIDogJyc7XG5cdFx0XHRzdGFydF9lbmRwb2ludF9sYWJlbCA9IGR1cmF0aW9uX2xhYmVsXG5cdFx0XHRcdD8gaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4uZHJhZnRfc3RhcnRfc3VtbWFyeSwgeyBzdGFydDogZm9ybWF0X3Zpc2libGVfZW5kcG9pbnQoIGRyYWZ0LnN0YXJ0ICkgfSApXG5cdFx0XHRcdDogJyc7XG5cdFx0XHRlbmRfZW5kcG9pbnRfbGFiZWwgPSBkdXJhdGlvbl9sYWJlbFxuXHRcdFx0XHQ/IGludGVycG9sYXRlX2xhYmVsKCBpMThuLmRyYWZ0X2VuZF9zdW1tYXJ5LCB7IGVuZDogZm9ybWF0X3Zpc2libGVfZW5kcG9pbnQoIGRyYWZ0LmVuZCApIH0gKVxuXHRcdFx0XHQ6ICcnO1xuXHRcdFx0c3RhdHVzX21lc3NhZ2UgPSAnZ2FwJyA9PT0gZHJhZnQuc3RhdHVzID8gaTE4bi5kc3RfZ2FwIDogKCAnZm9sZCcgPT09IGRyYWZ0LnN0YXR1cyA/IGkxOG4uZHN0X2ZvbGQgOiBpMThuLmRyYWZ0X3JlYWR5ICk7XG5cdFx0XHRpZiAoICdwcmV2aWV3aW5nJyA9PT0gc3RhdGUucGhhc2UgKSB7XG5cdFx0XHRcdHN0YXR1c19tZXNzYWdlID0gaTE4bi5jaGVja2luZ19zZWxlY3Rpb247XG5cdFx0XHR9IGVsc2UgaWYgKCAncmVhZHknID09PSBzdGF0ZS5waGFzZSApIHtcblx0XHRcdFx0c3RhdHVzX21lc3NhZ2UgPSBpMThuLnByZXZpZXdfcmVhZHk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnYXBwbHlpbmcnID09PSBzdGF0ZS5waGFzZSApIHtcblx0XHRcdFx0c3RhdHVzX21lc3NhZ2UgPSBpMThuLmFwcGx5aW5nX2F2YWlsYWJpbGl0eTtcblx0XHRcdH0gZWxzZSBpZiAoICdhd2FpdGluZ19yZWFkYmFjaycgPT09IHN0YXRlLnBoYXNlICkge1xuXHRcdFx0XHRzdGF0dXNfbWVzc2FnZSA9IGkxOG4uYXdhaXRpbmdfcmVhZGJhY2s7XG5cdFx0XHR9IGVsc2UgaWYgKCAnZXJyb3InID09PSBzdGF0ZS5waGFzZSApIHtcblx0XHRcdFx0c3RhdHVzX21lc3NhZ2UgPSBzdGF0ZS5lcnJvcl9tZXNzYWdlIHx8IGkxOG4ucHJldmlld19lcnJvcjtcblx0XHRcdH1cblxuXHRcdFx0c3RhdGUuc3VyZmFjZS5xdWVyeVNlbGVjdG9yQWxsKCBvdmVybGF5X3NlbGVjdG9yICkuZm9yRWFjaCggZnVuY3Rpb24gKCBleGlzdGluZ19vdmVybGF5ICkge1xuXHRcdFx0XHRleGlzdGluZ19vdmVybGF5LnJlbW92ZSgpO1xuXHRcdFx0fSApO1xuXHRcdFx0c3RhcnRfY29udHJvbCA9IGJ1aWxkX2JvdW5kYXJ5X21vZGVsKCBjZWxscy5zdGFydCwgJ3N0YXJ0JyApO1xuXHRcdFx0ZW5kX2NvbnRyb2wgPSBidWlsZF9ib3VuZGFyeV9tb2RlbCggY2VsbHMuZW5kLCAnZW5kJyApO1xuXHRcdFx0cHJlc2VudGF0aW9uX3NsaWNlcyA9IGJ1aWxkX3NsaWNlcyggY2VsbHMsIGR1cmF0aW9uX2xhYmVsICk7XG5cdFx0XHRob2xkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdFx0aG9sZGVyLmlubmVySFRNTCA9IGRyYWZ0X3RlbXBsYXRlKCB7XG5cdFx0XHRcdHN0YXR1czogZHJhZnQuc3RhdHVzLFxuXHRcdFx0XHRwaGFzZTogc3RhdGUucGhhc2UsXG5cdFx0XHRcdGRyYWZ0X2lkZW50aXR5OiBTdHJpbmcoIGRyYWZ0LmRyYWZ0X2lkZW50aXR5IHx8ICcnICksXG5cdFx0XHRcdHJlc291cmNlX2lkOiBzdGF0ZS5yZXNvdXJjZV9pZCxcblx0XHRcdFx0bGFiZWw6IGludGVycG9sYXRlX2xhYmVsKCBkdXJhdGlvbl9sYWJlbCA/IGkxOG4uZHJhZnRfbGFiZWxfd2l0aF9kdXJhdGlvbiA6IGkxOG4uZHJhZnRfbGFiZWwsIHtcblx0XHRcdFx0XHRzdGFydDogc3RhcnRfbGFiZWwsXG5cdFx0XHRcdFx0ZW5kOiBlbmRfbGFiZWwsXG5cdFx0XHRcdFx0ZHVyYXRpb246IGR1cmF0aW9uX2xhYmVsXG5cdFx0XHRcdH0gKSxcblx0XHRcdFx0c3RhdHVzX2lkOiBzdGF0ZS5zdGF0dXNfaWQsXG5cdFx0XHRcdGFjdGl2ZV9ib3VuZGFyeTogc3RhdGUucG9pbnRlcl9ib3VuZGFyeSxcblx0XHRcdFx0c2xpY2VzOiBwcmVzZW50YXRpb25fc2xpY2VzLFxuXHRcdFx0XHRzdGFydF9lbmRwb2ludF9sYWJlbDogc3RhcnRfZW5kcG9pbnRfbGFiZWwsXG5cdFx0XHRcdGVuZF9lbmRwb2ludF9sYWJlbDogZW5kX2VuZHBvaW50X2xhYmVsLFxuXHRcdFx0XHRzdGFydF9jb250cm9sOiBzdGFydF9jb250cm9sLFxuXHRcdFx0XHRlbmRfY29udHJvbDogZW5kX2NvbnRyb2wsXG5cdFx0XHRcdGZvbGRfY2hvaWNlczogYnVpbGRfZm9sZF9jaG9pY2VzKCBjZWxscyApLFxuXHRcdFx0XHRmb2xkX2dyb3VwX2xhYmVsOiBpMThuLmZvbGRfZ3JvdXBfbGFiZWwsXG5cdFx0XHRcdGZvbGRfaW5zdHJ1Y3Rpb25zOiBpMThuLmZvbGRfaW5zdHJ1Y3Rpb25zXG5cdFx0XHR9ICk7XG5cdFx0XHRvdmVybGF5ID0gaG9sZGVyLmZpcnN0RWxlbWVudENoaWxkO1xuXHRcdFx0aWYgKCAhIG92ZXJsYXkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN0YXRlLnN1cmZhY2UuYXBwZW5kQ2hpbGQoIG92ZXJsYXkgKTtcblx0XHRcdHN0YXRlLmRyYWZ0ID0gZHJhZnQ7XG5cdFx0XHRzdGF0ZS5jZWxscyA9IGNlbGxzO1xuXHRcdFx0c3RhdGUuc3RhcnRfZW5kcG9pbnQgPSBjZWxscy5zdGFydF9lbmRwb2ludDtcblx0XHRcdHN0YXRlLnByZXNlbnRhdGlvbl9zbGljZXMgPSBwcmVzZW50YXRpb25fc2xpY2VzO1xuXHRcdFx0cmVuZGVyX2FjdGlvbnMoIG92ZXJsYXkgKTtcblx0XHRcdGlmICggc3RhdGUuZm9jdXNfYWN0aW9uc19hZnRlcl9yZW5kZXIgKSB7XG5cdFx0XHRcdHN0YXRlLmZvY3VzX2FjdGlvbnNfYWZ0ZXJfcmVuZGVyID0gZmFsc2U7XG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHR2YXIgZmlyc3RfYWN0aW9uID0gc3RhdGUuc3VyZmFjZS5xdWVyeVNlbGVjdG9yKCBhY3Rpb25zX3NlbGVjdG9yICsgJyBhW2hyZWZdLCAnICsgYWN0aW9uc19zZWxlY3RvciArICcgYnV0dG9uOm5vdChbZGlzYWJsZWRdKScgKTtcblxuXHRcdFx0XHRcdGlmICggZmlyc3RfYWN0aW9uICkge1xuXHRcdFx0XHRcdFx0Zmlyc3RfYWN0aW9uLmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRhbm5vdW5jZSggc3RhdHVzX21lc3NhZ2UgKTtcblx0XHRcdGlmICggc3RhdGUuZm9jdXNfYm91bmRhcnkgKSB7XG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHR2YXIgYm91bmRhcnkgPSBzdGF0ZS5zdXJmYWNlLnF1ZXJ5U2VsZWN0b3IoIGJvdW5kYXJ5X3NlbGVjdG9yICsgJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXNlbGVjdGlvbi1ib3VuZGFyeT1cIicgKyBzdGF0ZS5mb2N1c19ib3VuZGFyeSArICdcIl0nICk7XG5cblx0XHRcdFx0XHRzdGF0ZS5mb2N1c19ib3VuZGFyeSA9ICcnO1xuXHRcdFx0XHRcdGlmICggYm91bmRhcnkgKSB7XG5cdFx0XHRcdFx0XHRib3VuZGFyeS5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdGF0ZS5jb21taXRfYWZ0ZXJfcmVuZGVyICYmICdleGFjdCcgPT09IGRyYWZ0LnN0YXR1cyApIHtcblx0XHRcdFx0c3RhdGUuY29tbWl0X2FmdGVyX3JlbmRlciA9IGZhbHNlO1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCByZXF1ZXN0X3NlbGVjdGlvbl9wcmV2aWV3ICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29hbGVzY2UgdmlzdWFsLW9ubHkgZHJhZnQgdXBkYXRlcyBpbnRvIG9uZSBhbmltYXRpb24gZnJhbWUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBmb2N1c19jb29yZGluYXRlIE9wdGlvbmFsIHJlcGxhY2VtZW50IGZvY3VzIGNvb3JkaW5hdGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzY2hlZHVsZV9yZW5kZXIoIGZvY3VzX2Nvb3JkaW5hdGUgKSB7XG5cdFx0XHRpZiAoIGZvY3VzX2Nvb3JkaW5hdGUgKSB7XG5cdFx0XHRcdHBlbmRpbmdfZm9jdXNfY29vcmRpbmF0ZSA9IGZvY3VzX2Nvb3JkaW5hdGU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHBlbmRpbmdfZnJhbWUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfZnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggYWN0aXZlX3N0YXRlICYmIHBlbmRpbmdfZm9jdXNfY29vcmRpbmF0ZSApIHtcblx0XHRcdFx0XHRhY3RpdmVfc3RhdGUuZm9jdXNfY29vcmRpbmF0ZSA9IHBlbmRpbmdfZm9jdXNfY29vcmRpbmF0ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwZW5kaW5nX2ZvY3VzX2Nvb3JkaW5hdGUgPSBudWxsO1xuXHRcdFx0XHRyZW5kZXJfZHJhZnQoKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBYm9ydCBvbmx5IHRoZSBhZGFwdGVyLW93bmVkIHByZXZpZXcgb3IgbXV0YXRpb24gcmVxdWVzdC5cblx0XHQgKlxuXHRcdCAqIENhbm9uaWNhbCBUaW1lbGluZSByZWFkYmFjayByZW1haW5zIHBhZ2UtY29udHJvbGxlciBvd25lZCBhbmQgaXMgbmV2ZXJcblx0XHQgKiBjYW5jZWxsZWQgYnkgY2xvc2luZyB0aGlzIGxvY2FsIHByZXNlbnRhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYWJvcnRfc2VsZWN0aW9uX3JlcXVlc3QoKSB7XG5cdFx0XHRpZiAoIHNlbGVjdGlvbl9yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzZWxlY3Rpb25fcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0c2VsZWN0aW9uX3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0X2dlbmVyYXRpb24gKz0gMTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmUgdGhlIGRyYWZ0IGFuZCBvcHRpb25hbGx5IHJlc3RvcmUgaXRzIGNhcHR1cmVkIGZvY3VzIG9yaWdpbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9mb2N1cyBXaGV0aGVyIGZvY3VzIHNob3VsZCByZXR1cm4gdG8gaXRzIG9yaWdpbi5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGFubm91bmNlX2NhbmNlbCBXaGV0aGVyIHRvIGFubm91bmNlIGNhbmNlbGxhdGlvbiBmaXJzdC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbmNlbF9kcmFmdCggcmVzdG9yZV9mb2N1cywgYW5ub3VuY2VfY2FuY2VsICkge1xuXHRcdFx0dmFyIHN0YXRlID0gYWN0aXZlX3N0YXRlO1xuXHRcdFx0dmFyIGZvY3VzX29yaWdpbiA9IHN0YXRlICYmIHN0YXRlLmZvY3VzX29yaWdpbjtcblx0XHRcdHZhciByZXNvdXJjZV9pZCA9IHN0YXRlICYmIHN0YXRlLnJlc291cmNlX2lkO1xuXG5cdFx0XHRpZiAoIHBlbmRpbmdfZnJhbWUgKSB7XG5cdFx0XHRcdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggcGVuZGluZ19mcmFtZSApO1xuXHRcdFx0XHRwZW5kaW5nX2ZyYW1lID0gMDtcblx0XHRcdH1cblx0XHRcdHBlbmRpbmdfZm9jdXNfY29vcmRpbmF0ZSA9IG51bGw7XG5cdFx0XHRwZW5kaW5nX3RvdWNoID0gbnVsbDtcblx0XHRcdGFib3J0X3NlbGVjdGlvbl9yZXF1ZXN0KCk7XG5cdFx0XHRpZiAoIHN0YXRlICYmIGFubm91bmNlX2NhbmNlbCApIHtcblx0XHRcdFx0YW5ub3VuY2UoIGkxOG4uY2FuY2VsbGVkICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN0YXRlICYmIHN0YXRlLnN1cmZhY2UgKSB7XG5cdFx0XHRcdHN0YXRlLnN1cmZhY2UucXVlcnlTZWxlY3RvckFsbCggb3ZlcmxheV9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggb3ZlcmxheSApIHtcblx0XHRcdFx0XHRvdmVybGF5LnJlbW92ZSgpO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfc3RhdGUgPSBudWxsO1xuXHRcdFx0aWYgKCByZXN0b3JlX2ZvY3VzICYmIGZvY3VzX29yaWdpbiAmJiBmb2N1c19vcmlnaW4uaXNDb25uZWN0ZWQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvY3VzX29yaWdpbi5mb2N1cyApIHtcblx0XHRcdFx0Zm9jdXNfb3JpZ2luLmZvY3VzKCk7XG5cdFx0XHR9IGVsc2UgaWYgKCByZXN0b3JlX2ZvY3VzICYmIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0dmFyIHJlcGxhY2VtZW50X3N1cmZhY2U7XG5cblx0XHRcdFx0XHRpZiAoIGlzX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRcdFx0ZW5oYW5jZV9zdXJmYWNlcygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXBsYWNlbWVudF9zdXJmYWNlID0gZmluZF9jdXJyZW50X3N1cmZhY2UoIHJlc291cmNlX2lkICk7XG5cdFx0XHRcdFx0aWYgKCByZXBsYWNlbWVudF9zdXJmYWNlICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiByZXBsYWNlbWVudF9zdXJmYWNlLmZvY3VzICkge1xuXHRcdFx0XHRcdFx0cmVwbGFjZW1lbnRfc3VyZmFjZS5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbnN1bWUgYSByZWFkeSB0aW1lZCBzZWxlY3Rpb24gb25seSB3aGVuIGl0cyBzaWduZWQgYWN0aW9uIHRva2VuIG1hdGNoZXMuXG5cdFx0ICpcblx0XHQgKiBUaGUgdG9rZW4gaXMgY29tcGFyZWQgYXMgYW4gb3BhcXVlIHNjYWxhciBmcm9tIHRoZSBjdXJyZW50IHNlcnZlci1vd25lZFxuXHRcdCAqIGFjdGlvbiBVUkwuIFVucmVsYXRlZCB0aW1lZCBkcmFmdHMgc3Vydml2ZSB0b29sYmFyIGFuZCBvdGhlci1zdXJmYWNlXG5cdFx0ICogY3JlYXRpb24gcmVhZGJhY2tzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbl9pZCBTdGFibGUgcHJldmlldyBhY3Rpb24gaWRlbnRpZmllci5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcXVlcnlfYXJnIFNpZ25lZC10b2tlbiBxdWVyeSBhcmd1bWVudCBuYW1lLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0b2tlbiAgICAgT3BhcXVlIHNpZ25lZCB0b2tlbiBjb25zdW1lZCBieSBjcmVhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGN1cnJlbnQgdGltZWQgZHJhZnQgbWF0Y2hlZCBhbmQgd2FzIGNsZWFyZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY29uc3VtZV9zaWduZWRfYWN0aW9uX2NvbnRleHQoIGFjdGlvbl9pZCwgcXVlcnlfYXJnLCB0b2tlbiApIHtcblx0XHRcdHZhciBhY3Rpb24gPSBhY3RpdmVfc3RhdGUgJiYgYWN0aXZlX3N0YXRlLnByZXZpZXcgJiYgYWN0aXZlX3N0YXRlLnByZXZpZXcuYWN0aW9uc1xuXHRcdFx0XHQ/IGFjdGl2ZV9zdGF0ZS5wcmV2aWV3LmFjdGlvbnNbIGFjdGlvbl9pZCBdXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdHZhciBhY3Rpb25fdXJsO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgYWN0aXZlX3N0YXRlXG5cdFx0XHRcdHx8ICdyZWFkeScgIT09IGFjdGl2ZV9zdGF0ZS5waGFzZVxuXHRcdFx0XHR8fCAhIGFjdGlvblxuXHRcdFx0XHR8fCB0cnVlICE9PSBhY3Rpb24uYXV0aG9yaXplZFxuXHRcdFx0XHR8fCB0cnVlICE9PSBhY3Rpb24uZW5hYmxlZFxuXHRcdFx0XHR8fCAhIGFjdGlvbi51cmxcblx0XHRcdFx0fHwgISAvXlthLXpBLVowLTlfLV17MSw2NH0kLy50ZXN0KCBTdHJpbmcoIHF1ZXJ5X2FyZyB8fCAnJyApIClcblx0XHRcdFx0fHwgISAvXltBLVphLXowLTkuXy1dezEsODE5Mn0kLy50ZXN0KCBTdHJpbmcoIHRva2VuIHx8ICcnICkgKVxuXHRcdFx0XHR8fCAhIHdpbmRvdy5VUkxcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhY3Rpb25fdXJsID0gbmV3IHdpbmRvdy5VUkwoIFN0cmluZyggYWN0aW9uLnVybCApLCB3aW5kb3cubG9jYXRpb24uaHJlZiApO1xuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIFN0cmluZyggYWN0aW9uX3VybC5zZWFyY2hQYXJhbXMuZ2V0KCBxdWVyeV9hcmcgKSB8fCAnJyApICE9PSBTdHJpbmcoIHRva2VuICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGNhbmNlbF9kcmFmdCggZmFsc2UsIGZhbHNlICk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBmcmVzaCBUaW1lbGluZS1vd25lZCByZXF1ZXN0LCBjb3ZlcmFnZSwgYW5kIHJldHVybiBjb250ZXh0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEJvdW5kZWQgcmVxdWVzdCBjb250ZXh0IG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGlvbl9yZXF1ZXN0X2NvbnRleHQoKSB7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiBzZWxlY3Rpb25fYXBpLmdldF9yZXF1ZXN0X2NvbnRleHQgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gc2VsZWN0aW9uX2FwaS5nZXRfcmVxdWVzdF9jb250ZXh0KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVxdWVzdCBvbmUgYXV0aG9yaXRhdGl2ZSBwcmV2aWV3IGZvciB0aGUgY3VycmVudCBleGFjdCBoYWxmLW9wZW4gZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBUaGUgc2VydmVyIG93bnMgdGhlIHNlbGVjdGlvbiBzdGVwLCBzaWduZWQgbG9hZGVkLXdpbmRvdyBjb3ZlcmFnZSxcblx0XHQgKiBSZXNvdXJjZSBhdXRob3JpemF0aW9uLCBmcmVzaCBkb21haW4gcmVhZHMsIGFuZCBlbmFibGVkIGFjdGlvbnMuIEEgY2hhbmdlZFxuXHRcdCAqIGRyYWZ0L2NhY2hlIGlkZW50aXR5IGludmFsaWRhdGVzIHRoZSByZXNwb25zZSBiZWZvcmUgaXQgY2FuIHJlbmRlci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVxdWVzdF9zZWxlY3Rpb25fcHJldmlldygpIHtcblx0XHRcdHZhciBzdGF0ZSA9IGFjdGl2ZV9zdGF0ZTtcblx0XHRcdHZhciByZXF1ZXN0X2NvbnRleHQgPSBnZXRfc2VsZWN0aW9uX3JlcXVlc3RfY29udGV4dCgpO1xuXHRcdFx0dmFyIHRyYW5zcG9ydCA9IHJlcXVlc3RfY29udGV4dCAmJiByZXF1ZXN0X2NvbnRleHQudHJhbnNwb3J0ID8gcmVxdWVzdF9jb250ZXh0LnRyYW5zcG9ydCA6IHt9O1xuXHRcdFx0dmFyIGRyYWZ0X2lkZW50aXR5O1xuXHRcdFx0dmFyIGNhY2hlX2tleTtcblx0XHRcdHZhciBnZW5lcmF0aW9uO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgc3RhdGVcblx0XHRcdFx0fHwgISBzdGF0ZS5kcmFmdFxuXHRcdFx0XHR8fCAnZXhhY3QnICE9PSBzdGF0ZS5kcmFmdC5zdGF0dXNcblx0XHRcdFx0fHwgISB3aW5kb3cualF1ZXJ5XG5cdFx0XHRcdHx8ICEgcmVxdWVzdF9jb250ZXh0XG5cdFx0XHRcdHx8ICEgdHJhbnNwb3J0LnVybFxuXHRcdFx0XHR8fCAhIHRyYW5zcG9ydC5wcmV2aWV3X2FjdGlvblxuXHRcdFx0XHR8fCAhIHRyYW5zcG9ydC5wcmV2aWV3X25vbmNlXG5cdFx0XHRcdHx8IFsgJ2FwcGx5aW5nJywgJ2F3YWl0aW5nX3JlYWRiYWNrJyBdLmluZGV4T2YoIHN0YXRlLnBoYXNlICkgIT09IC0xXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YWJvcnRfc2VsZWN0aW9uX3JlcXVlc3QoKTtcblx0XHRcdGdlbmVyYXRpb24gPSBzZWxlY3Rpb25fcmVxdWVzdF9nZW5lcmF0aW9uO1xuXHRcdFx0ZHJhZnRfaWRlbnRpdHkgPSBTdHJpbmcoIHN0YXRlLmRyYWZ0LmRyYWZ0X2lkZW50aXR5IHx8ICcnICk7XG5cdFx0XHRjYWNoZV9rZXkgPSBzdGF0ZS5jYWNoZV9rZXk7XG5cdFx0XHRzdGF0ZS5waGFzZSA9ICdwcmV2aWV3aW5nJztcblx0XHRcdHN0YXRlLnByZXZpZXcgPSBudWxsO1xuXHRcdFx0c3RhdGUuZXJyb3JfbWVzc2FnZSA9ICcnO1xuXHRcdFx0cmVuZGVyX2RyYWZ0KCk7XG5cdFx0XHRhbm5vdW5jZSggaTE4bi5jaGVja2luZ19zZWxlY3Rpb24gKTtcblx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogdHJhbnNwb3J0LnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdHRpbWVvdXQ6IE1hdGgubWF4KCAxMDAwLCBOdW1iZXIoIHJlcXVlc3RfY29udGV4dC5yZXF1ZXN0X3RpbWVvdXRfbXMgKSB8fCAxNTAwMCApLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQucHJldmlld19hY3Rpb24sXG5cdFx0XHRcdFx0bm9uY2U6IHRyYW5zcG9ydC5wcmV2aWV3X25vbmNlLFxuXHRcdFx0XHRcdHJlc291cmNlX2lkOiBzdGF0ZS5yZXNvdXJjZV9pZCxcblx0XHRcdFx0XHRzZWxlY3Rpb25fc3VyZmFjZTogU3RyaW5nKCBjb25maWd1cmF0aW9uLnNlbGVjdGlvbl9zdXJmYWNlIHx8ICd0aW1lX3Jvd3MnICksXG5cdFx0XHRcdFx0c2VsZWN0aW9uX2tpbmQ6IFN0cmluZyggc3RhdGUuZHJhZnQuc2VsZWN0aW9uX2tpbmQgfHwgY29uZmlndXJhdGlvbi5zZWxlY3Rpb25fa2luZCB8fCAndGltZWQnICksXG5cdFx0XHRcdFx0dmlldzogU3RyaW5nKCByZXF1ZXN0X2NvbnRleHQudmlldyB8fCAnJyApLFxuXHRcdFx0XHRcdHN0YXJ0X2F0OiBzdGF0ZS5kcmFmdC5zdGFydC5hdCxcblx0XHRcdFx0XHRlbmRfYXQ6IHN0YXRlLmRyYWZ0LmVuZC5hdCxcblx0XHRcdFx0XHRsb2FkZWRfc3RhcnRfYXQ6IFN0cmluZyggcmVxdWVzdF9jb250ZXh0LmxvYWRlZF9zdGFydF9hdCB8fCAnJyApLFxuXHRcdFx0XHRcdGxvYWRlZF9lbmRfYXQ6IFN0cmluZyggcmVxdWVzdF9jb250ZXh0LmxvYWRlZF9lbmRfYXQgfHwgJycgKSxcblx0XHRcdFx0XHRsb2FkZWRfY29udGV4dF90b2tlbnM6IEFycmF5LmlzQXJyYXkoIHJlcXVlc3RfY29udGV4dC5sb2FkZWRfY29udGV4dF90b2tlbnMgKSA/IHJlcXVlc3RfY29udGV4dC5sb2FkZWRfY29udGV4dF90b2tlbnMuc2xpY2UoIDAsIDMgKSA6IFtdLFxuXHRcdFx0XHRcdHJldHVybl9jb250ZXh0OiByZXF1ZXN0X2NvbnRleHQucmV0dXJuX2NvbnRleHQgJiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXF1ZXN0X2NvbnRleHQucmV0dXJuX2NvbnRleHQgPyByZXF1ZXN0X2NvbnRleHQucmV0dXJuX2NvbnRleHQgOiB7fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdGdlbmVyYXRpb24gIT09IHNlbGVjdGlvbl9yZXF1ZXN0X2dlbmVyYXRpb25cblx0XHRcdFx0XHR8fCAhIGFjdGl2ZV9zdGF0ZVxuXHRcdFx0XHRcdHx8IGNhY2hlX2tleSAhPT0gYWN0aXZlX3N0YXRlLmNhY2hlX2tleVxuXHRcdFx0XHRcdHx8ICEgYWN0aXZlX3N0YXRlLmRyYWZ0XG5cdFx0XHRcdFx0fHwgZHJhZnRfaWRlbnRpdHkgIT09IFN0cmluZyggYWN0aXZlX3N0YXRlLmRyYWZ0LmRyYWZ0X2lkZW50aXR5IHx8ICcnIClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHQhIHJlc3BvbnNlXG5cdFx0XHRcdFx0fHwgISByZXNwb25zZS5zdWNjZXNzXG5cdFx0XHRcdFx0fHwgISByZXNwb25zZS5kYXRhXG5cdFx0XHRcdFx0fHwgISByZXNwb25zZS5kYXRhLnNlbGVjdGlvblxuXHRcdFx0XHRcdHx8IFN0cmluZyggcmVzcG9uc2UuZGF0YS5zZWxlY3Rpb24uc2VsZWN0aW9uX3N1cmZhY2UgfHwgJycgKSAhPT0gU3RyaW5nKCBjb25maWd1cmF0aW9uLnNlbGVjdGlvbl9zdXJmYWNlIHx8ICd0aW1lX3Jvd3MnIClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2Vycm9yJztcblx0XHRcdFx0XHRhY3RpdmVfc3RhdGUuZXJyb3JfbWVzc2FnZSA9IGkxOG4ucHJldmlld19lcnJvcjtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0YWN0aXZlX3N0YXRlLnByZXZpZXcgPSByZXNwb25zZS5kYXRhO1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUucGhhc2UgPSAncmVhZHknO1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUuZm9jdXNfYWN0aW9uc19hZnRlcl9yZW5kZXIgPSB0cnVlO1xuXHRcdFx0XHRhbm5vdW5jZSggaTE4bi5wcmV2aWV3X3JlYWR5ICk7XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCByZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0dmFyIGVycm9yID0gcmVxdWVzdC5yZXNwb25zZUpTT04gJiYgcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA/IHJlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgOiB7fTtcblxuXHRcdFx0XHRpZiAoIGdlbmVyYXRpb24gIT09IHNlbGVjdGlvbl9yZXF1ZXN0X2dlbmVyYXRpb24gfHwgJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgfHwgISBhY3RpdmVfc3RhdGUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5waGFzZSA9ICdlcnJvcic7XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5lcnJvcl9tZXNzYWdlID0gZXJyb3IubWVzc2FnZSB8fCBpMThuLnByZXZpZXdfZXJyb3I7XG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gc2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZWN0aW9uX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHRyZW5kZXJfZHJhZnQoKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBcHBseSBvbmUgZXhwbGljaXRseSBhY3RpdmF0ZWQgc2VydmVyLWF1dGhvcml6ZWQgQXZhaWxhYmlsaXR5IGFjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIEJsb2NrIG9yIHVuYmxvY2suXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9zZWxlY3Rpb25fYXZhaWxhYmlsaXR5KCBtb2RlICkge1xuXHRcdFx0dmFyIHN0YXRlID0gYWN0aXZlX3N0YXRlO1xuXHRcdFx0dmFyIGFjdGlvbiA9IHN0YXRlICYmIHN0YXRlLnByZXZpZXcgJiYgc3RhdGUucHJldmlldy5hY3Rpb25zID8gc3RhdGUucHJldmlldy5hY3Rpb25zWyBtb2RlIF0gOiBudWxsO1xuXHRcdFx0dmFyIHJlcXVlc3RfY29udGV4dCA9IGdldF9zZWxlY3Rpb25fcmVxdWVzdF9jb250ZXh0KCk7XG5cdFx0XHR2YXIgdHJhbnNwb3J0ID0gcmVxdWVzdF9jb250ZXh0ICYmIHJlcXVlc3RfY29udGV4dC50cmFuc3BvcnQgPyByZXF1ZXN0X2NvbnRleHQudHJhbnNwb3J0IDoge307XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbjtcblx0XHRcdHZhciBkcmFmdF9pZGVudGl0eTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHRbICdibG9jaycsICd1bmJsb2NrJyBdLmluZGV4T2YoIG1vZGUgKSA9PT0gLTFcblx0XHRcdFx0fHwgISBzdGF0ZVxuXHRcdFx0XHR8fCAncmVhZHknICE9PSBzdGF0ZS5waGFzZVxuXHRcdFx0XHR8fCAhIGFjdGlvblxuXHRcdFx0XHR8fCB0cnVlICE9PSBhY3Rpb24uYXV0aG9yaXplZFxuXHRcdFx0XHR8fCB0cnVlICE9PSBhY3Rpb24uZW5hYmxlZFxuXHRcdFx0XHR8fCAhIHN0YXRlLnByZXZpZXcuYmxvY2tfdG9rZW5cblx0XHRcdFx0fHwgISB3aW5kb3cualF1ZXJ5XG5cdFx0XHRcdHx8ICEgdHJhbnNwb3J0LnVybFxuXHRcdFx0XHR8fCAhIHRyYW5zcG9ydC5hcHBseV9hY3Rpb25cblx0XHRcdFx0fHwgISB0cmFuc3BvcnQuYXBwbHlfbm9uY2Vcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzZWxlY3Rpb25fcmVxdWVzdF9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRnZW5lcmF0aW9uID0gc2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbjtcblx0XHRcdGRyYWZ0X2lkZW50aXR5ID0gU3RyaW5nKCBzdGF0ZS5kcmFmdC5kcmFmdF9pZGVudGl0eSB8fCAnJyApO1xuXHRcdFx0c3RhdGUucGhhc2UgPSAnYXBwbHlpbmcnO1xuXHRcdFx0c3RhdGUuZXJyb3JfbWVzc2FnZSA9ICcnO1xuXHRcdFx0cmVuZGVyX2RyYWZ0KCk7XG5cdFx0XHRhbm5vdW5jZSggaTE4bi5hcHBseWluZ19hdmFpbGFiaWxpdHkgKTtcblx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogdHJhbnNwb3J0LnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdHRpbWVvdXQ6IE1hdGgubWF4KCAxMDAwLCBOdW1iZXIoIHJlcXVlc3RfY29udGV4dC5yZXF1ZXN0X3RpbWVvdXRfbXMgKSB8fCAxNTAwMCApLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQuYXBwbHlfYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQuYXBwbHlfbm9uY2UsXG5cdFx0XHRcdFx0YmxvY2tfdG9rZW46IHN0YXRlLnByZXZpZXcuYmxvY2tfdG9rZW4sXG5cdFx0XHRcdFx0bW9kZTogbW9kZVxuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0dmFyIHJlYWRiYWNrX3JlcXVlc3Q7XG5cblx0XHRcdFx0aWYgKCBnZW5lcmF0aW9uICE9PSBzZWxlY3Rpb25fcmVxdWVzdF9nZW5lcmF0aW9uIHx8ICEgYWN0aXZlX3N0YXRlIHx8IGRyYWZ0X2lkZW50aXR5ICE9PSBTdHJpbmcoIGFjdGl2ZV9zdGF0ZS5kcmFmdC5kcmFmdF9pZGVudGl0eSB8fCAnJyApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzICkge1xuXHRcdFx0XHRcdGFjdGl2ZV9zdGF0ZS5waGFzZSA9ICdlcnJvcic7XG5cdFx0XHRcdFx0YWN0aXZlX3N0YXRlLmVycm9yX21lc3NhZ2UgPSByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSA/IHJlc3BvbnNlLmRhdGEubWVzc2FnZSA6IGkxOG4uYXBwbHlfZXJyb3I7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2F3YWl0aW5nX3JlYWRiYWNrJztcblx0XHRcdFx0cmVuZGVyX2RyYWZ0KCk7XG5cdFx0XHRcdGFubm91bmNlKCBpMThuLmF3YWl0aW5nX3JlYWRiYWNrICk7XG5cdFx0XHRcdHJlYWRiYWNrX3JlcXVlc3QgPSAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc2VsZWN0aW9uX2FwaS5yZWZyZXNoX2FmdGVyX2FwcGx5XG5cdFx0XHRcdFx0PyBzZWxlY3Rpb25fYXBpLnJlZnJlc2hfYWZ0ZXJfYXBwbHkoKVxuXHRcdFx0XHRcdDogbnVsbDtcblx0XHRcdFx0aWYgKCAhIHJlYWRiYWNrX3JlcXVlc3QgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHJlYWRiYWNrX3JlcXVlc3QuZG9uZSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgcmVhZGJhY2tfcmVxdWVzdC5mYWlsICkge1xuXHRcdFx0XHRcdGFjdGl2ZV9zdGF0ZS5waGFzZSA9ICdlcnJvcic7XG5cdFx0XHRcdFx0YWN0aXZlX3N0YXRlLmVycm9yX21lc3NhZ2UgPSBpMThuLmFwcGx5X2Vycm9yO1xuXHRcdFx0XHRcdHJlbmRlcl9kcmFmdCgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZWFkYmFja19yZXF1ZXN0LmRvbmUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoIGFjdGl2ZV9zdGF0ZSAmJiAnYXdhaXRpbmdfcmVhZGJhY2snID09PSBhY3RpdmVfc3RhdGUucGhhc2UgJiYgZHJhZnRfaWRlbnRpdHkgPT09IFN0cmluZyggYWN0aXZlX3N0YXRlLmRyYWZ0LmRyYWZ0X2lkZW50aXR5IHx8ICcnICkgKSB7XG5cdFx0XHRcdFx0XHRjYW5jZWxfZHJhZnQoIHRydWUsIGZhbHNlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmICggYWN0aXZlX3N0YXRlICYmICdhd2FpdGluZ19yZWFkYmFjaycgPT09IGFjdGl2ZV9zdGF0ZS5waGFzZSAmJiBkcmFmdF9pZGVudGl0eSA9PT0gU3RyaW5nKCBhY3RpdmVfc3RhdGUuZHJhZnQuZHJhZnRfaWRlbnRpdHkgfHwgJycgKSApIHtcblx0XHRcdFx0XHRcdGFjdGl2ZV9zdGF0ZS5waGFzZSA9ICdlcnJvcic7XG5cdFx0XHRcdFx0XHRhY3RpdmVfc3RhdGUuZXJyb3JfbWVzc2FnZSA9IGkxOG4uYXBwbHlfZXJyb3I7XG5cdFx0XHRcdFx0XHRyZW5kZXJfZHJhZnQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIHJlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHR2YXIgZXJyb3IgPSByZXF1ZXN0LnJlc3BvbnNlSlNPTiAmJiByZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhID8gcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IHt9O1xuXG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gc2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbiB8fCAnYWJvcnQnID09PSByZXF1ZXN0X3N0YXR1cyB8fCAhIGFjdGl2ZV9zdGF0ZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2Vycm9yJztcblx0XHRcdFx0YWN0aXZlX3N0YXRlLmVycm9yX21lc3NhZ2UgPSBlcnJvci5tZXNzYWdlIHx8IGkxOG4uYXBwbHlfZXJyb3I7XG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggZ2VuZXJhdGlvbiA9PT0gc2VsZWN0aW9uX3JlcXVlc3RfZ2VuZXJhdGlvbiAmJiBhY3RpdmVfc3RhdGUgJiYgJ2F3YWl0aW5nX3JlYWRiYWNrJyAhPT0gYWN0aXZlX3N0YXRlLnBoYXNlICkge1xuXHRcdFx0XHRcdHNlbGVjdGlvbl9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0XHRyZW5kZXJfZHJhZnQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJlZ2luIG9uZSBsb2NhbCBkcmFmdCB3aXRoIGEgZ2VzdHVyZS1vd25lZCBnZW9tZXRyeSBzbmFwc2hvdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBnZXN0dXJlX2NvbnRleHQgSW1tdXRhYmxlIGdlc3R1cmUgY29udGV4dC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gY29vcmRpbmF0ZSAgICAgIEluaXRpYWwgZ2VvbWV0cnkgY29vcmRpbmF0ZS5cblx0XHQgKiBAcGFyYW0ge0VsZW1lbnR9IGZvY3VzX29yaWdpbiAgIEZvY3VzIHJlc3RvcmF0aW9uIHRhcmdldC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSByZXNvbHZhYmxlIGRyYWZ0IGJlZ2FuLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJlZ2luX2RyYWZ0KCBnZXN0dXJlX2NvbnRleHQsIGNvb3JkaW5hdGUsIGZvY3VzX29yaWdpbiApIHtcblx0XHRcdHZhciByZXNvbHZlZCA9IGdlb21ldHJ5LnJlc29sdmVfY29vcmRpbmF0ZSggZ2VzdHVyZV9jb250ZXh0LnNuYXBzaG90LCBjb29yZGluYXRlICk7XG5cblx0XHRcdGlmICggISByZXNvbHZlZCB8fCBbICdpbnZhbGlkJywgJ291dHNpZGUnLCAnZ2FwJyBdLmluZGV4T2YoIHJlc29sdmVkLnN0YXR1cyApICE9PSAtMSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y2FuY2VsX2RyYWZ0KCBmYWxzZSwgZmFsc2UgKTtcblx0XHRcdGFjdGl2ZV9zdGF0ZSA9IHtcblx0XHRcdFx0c3VyZmFjZTogZ2VzdHVyZV9jb250ZXh0LnN1cmZhY2UsXG5cdFx0XHRcdHBhbmVsOiBnZXN0dXJlX2NvbnRleHQucGFuZWwsXG5cdFx0XHRcdHJlc291cmNlX2lkOiBnZXN0dXJlX2NvbnRleHQucmVzb3VyY2VfaWQsXG5cdFx0XHRcdGNhY2hlX2tleTogZ2VzdHVyZV9jb250ZXh0LmNhY2hlX2tleSxcblx0XHRcdFx0c3VyZmFjZV9yZWN0OiBnZXN0dXJlX2NvbnRleHQuc3VyZmFjZV9yZWN0LFxuXHRcdFx0XHRib29raW5nX2NvbHVtbl9ndXR0ZXJfcHg6IGdlc3R1cmVfY29udGV4dC5ib29raW5nX2NvbHVtbl9ndXR0ZXJfcHgsXG5cdFx0XHRcdHNuYXBzaG90OiBnZXN0dXJlX2NvbnRleHQuc25hcHNob3QsXG5cdFx0XHRcdGFuY2hvcl9jb29yZGluYXRlOiBjb29yZGluYXRlLFxuXHRcdFx0XHRmb2N1c19jb29yZGluYXRlOiBjb29yZGluYXRlLFxuXHRcdFx0XHRmb2N1c19vcmlnaW46IGZvY3VzX29yaWdpbiB8fCBnZXN0dXJlX2NvbnRleHQuc3VyZmFjZSxcblx0XHRcdFx0cmVzdG9yZV9mb2N1c19vbl9jYW5jZWw6IGdlc3R1cmVfY29udGV4dC5zdXJmYWNlLmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICksXG5cdFx0XHRcdHBvaW50ZXJfaWQ6IG51bGwsXG5cdFx0XHRcdHBvaW50ZXJfdHlwZTogJycsXG5cdFx0XHRcdHBvaW50ZXJfYm91bmRhcnk6ICcnLFxuXHRcdFx0XHRib3VuZGFyeV9kcmFnX29yaWdpbjogbnVsbCxcblx0XHRcdFx0dG91Y2hfb3JpZ2luOiBudWxsLFxuXHRcdFx0XHRzdGF0dXNfaWQ6ICd3cGJjLXRpbWUtcm93cy1zZWxlY3Rpb24tc3RhdHVzLScgKyBnZXN0dXJlX2NvbnRleHQucmVzb3VyY2VfaWQsXG5cdFx0XHRcdGZvY3VzX2JvdW5kYXJ5OiAnJyxcblx0XHRcdFx0Zm9jdXNfYWN0aW9uc19hZnRlcl9yZW5kZXI6IGZhbHNlLFxuXHRcdFx0XHRjb21taXRfYWZ0ZXJfcmVuZGVyOiBmYWxzZSxcblx0XHRcdFx0cGhhc2U6ICdkcmFmdGluZycsXG5cdFx0XHRcdHByZXZpZXc6IG51bGwsXG5cdFx0XHRcdGVycm9yX21lc3NhZ2U6ICcnLFxuXHRcdFx0XHRkcmFmdDogbnVsbCxcblx0XHRcdFx0Y2VsbHM6IG51bGxcblx0XHRcdH07XG5cdFx0XHRzY2hlZHVsZV9yZW5kZXIoIGNvb3JkaW5hdGUgKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQmVnaW4gZWRpdGluZyBhbiBleGlzdGluZyBkcmFmdCB0aHJvdWdoIG9uZSB2aXNpYmxlIGJvdW5kYXJ5IGNvbnRyb2wuXG5cdFx0ICpcblx0XHQgKiBFeGlzdGluZyBwcmV2aWV3IGF1dGhvcml0eSBpcyBkaXNjYXJkZWQgaW1tZWRpYXRlbHkgYmVjYXVzZSBhbnkgYm91bmRhcnlcblx0XHQgKiBtb3ZlbWVudCBjcmVhdGVzIGEgbmV3IGV4YWN0IGludGVydmFsIHRoYXQgcmVxdWlyZXMgYSBmcmVzaCBleHBsaWNpdFxuXHRcdCAqIGNvbW1pdC4gUG9pbnRlciBjYXB0dXJlIHN0YXlzIG9uIHRoZSBwZXJzaXN0ZW50IHRpbWVkIHN1cmZhY2UgYmVjYXVzZSB0aGVcblx0XHQgKiBvdmVybGF5IGFuZCBpdHMgY29udHJvbHMgYXJlIHJlcGxhY2VkIGR1cmluZyBmcmFtZS1jb2FsZXNjZWQgcmVuZGVyaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSAgICAgIGJvdW5kYXJ5IEJvdW5kYXJ5IHNsaWRlciBjb250cm9sLlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCAgICBQcmltYXJ5IHBvaW50ZXIgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGJvdW5kYXJ5IGVkaXRpbmcgc3RhcnRlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBiZWdpbl9ib3VuZGFyeV9kcmFnKCBib3VuZGFyeSwgZXZlbnQgKSB7XG5cdFx0XHR2YXIgYm91bmRhcnlfbmFtZTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGFjdGl2ZV9zdGF0ZVxuXHRcdFx0XHR8fCAhIGJvdW5kYXJ5XG5cdFx0XHRcdHx8ICEgYWN0aXZlX3N0YXRlLnN1cmZhY2UuY29udGFpbnMoIGJvdW5kYXJ5IClcblx0XHRcdFx0fHwgWyAnYXBwbHlpbmcnLCAnYXdhaXRpbmdfcmVhZGJhY2snIF0uaW5kZXhPZiggYWN0aXZlX3N0YXRlLnBoYXNlICkgIT09IC0xXG5cdFx0XHRcdHx8ICggJ21vdXNlJyA9PT0gZXZlbnQucG9pbnRlclR5cGUgJiYgMCAhPT0gZXZlbnQuYnV0dG9uIClcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRib3VuZGFyeV9uYW1lID0gU3RyaW5nKCBib3VuZGFyeS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXNlbGVjdGlvbi1ib3VuZGFyeScgKSB8fCAnJyApO1xuXHRcdFx0aWYgKCBbICdzdGFydCcsICdlbmQnIF0uaW5kZXhPZiggYm91bmRhcnlfbmFtZSApID09PSAtMSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZlX3N0YXRlLnN1cmZhY2VfcmVjdCA9IGFjdGl2ZV9zdGF0ZS5zdXJmYWNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0YWN0aXZlX3N0YXRlLmJvdW5kYXJ5X2RyYWdfb3JpZ2luID0ge1xuXHRcdFx0XHRhbmNob3JfY29vcmRpbmF0ZTogYWN0aXZlX3N0YXRlLmFuY2hvcl9jb29yZGluYXRlLFxuXHRcdFx0XHRmb2N1c19jb29yZGluYXRlOiBhY3RpdmVfc3RhdGUuZm9jdXNfY29vcmRpbmF0ZSxcblx0XHRcdFx0cGhhc2U6IGFjdGl2ZV9zdGF0ZS5waGFzZSxcblx0XHRcdFx0cHJldmlldzogYWN0aXZlX3N0YXRlLnByZXZpZXcsXG5cdFx0XHRcdGVycm9yX21lc3NhZ2U6IGFjdGl2ZV9zdGF0ZS5lcnJvcl9tZXNzYWdlXG5cdFx0XHR9O1xuXHRcdFx0YWJvcnRfc2VsZWN0aW9uX3JlcXVlc3QoKTtcblx0XHRcdGFjdGl2ZV9zdGF0ZS5wb2ludGVyX2lkID0gZXZlbnQucG9pbnRlcklkO1xuXHRcdFx0YWN0aXZlX3N0YXRlLnBvaW50ZXJfdHlwZSA9IGV2ZW50LnBvaW50ZXJUeXBlIHx8ICdtb3VzZSc7XG5cdFx0XHRhY3RpdmVfc3RhdGUucG9pbnRlcl9ib3VuZGFyeSA9IGJvdW5kYXJ5X25hbWU7XG5cdFx0XHRhY3RpdmVfc3RhdGUucGhhc2UgPSAnZHJhZnQnO1xuXHRcdFx0YWN0aXZlX3N0YXRlLnByZXZpZXcgPSBudWxsO1xuXHRcdFx0YWN0aXZlX3N0YXRlLmVycm9yX21lc3NhZ2UgPSAnJztcblx0XHRcdGFjdGl2ZV9zdGF0ZS5jb21taXRfYWZ0ZXJfcmVuZGVyID0gZmFsc2U7XG5cdFx0XHRhY3RpdmVfc3RhdGUuc3VyZmFjZS5zZXRQb2ludGVyQ2FwdHVyZSggZXZlbnQucG9pbnRlcklkICk7XG5cdFx0XHRzY2hlZHVsZV9yZW5kZXIoKTtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgYSBjYW5jZWxsZWQgYm91bmRhcnkgZHJhZyB3aXRob3V0IGRpc2NhcmRpbmcgdGhlIHdob2xlIHNlbGVjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBDYW5jZWxsZWQgcG9pbnRlciBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3RvcmVfYm91bmRhcnlfZHJhZyggZXZlbnQgKSB7XG5cdFx0XHR2YXIgb3JpZ2luID0gYWN0aXZlX3N0YXRlICYmIGFjdGl2ZV9zdGF0ZS5ib3VuZGFyeV9kcmFnX29yaWdpbjtcblxuXHRcdFx0aWYgKCAhIGFjdGl2ZV9zdGF0ZSB8fCAhIG9yaWdpbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZlX3N0YXRlLmFuY2hvcl9jb29yZGluYXRlID0gb3JpZ2luLmFuY2hvcl9jb29yZGluYXRlO1xuXHRcdFx0YWN0aXZlX3N0YXRlLmZvY3VzX2Nvb3JkaW5hdGUgPSBvcmlnaW4uZm9jdXNfY29vcmRpbmF0ZTtcblx0XHRcdGFjdGl2ZV9zdGF0ZS5waGFzZSA9ICdwcmV2aWV3aW5nJyA9PT0gb3JpZ2luLnBoYXNlID8gJ2RyYWZ0JyA6IG9yaWdpbi5waGFzZTtcblx0XHRcdGFjdGl2ZV9zdGF0ZS5wcmV2aWV3ID0gJ3ByZXZpZXdpbmcnID09PSBvcmlnaW4ucGhhc2UgPyBudWxsIDogb3JpZ2luLnByZXZpZXc7XG5cdFx0XHRhY3RpdmVfc3RhdGUuZXJyb3JfbWVzc2FnZSA9ICdwcmV2aWV3aW5nJyA9PT0gb3JpZ2luLnBoYXNlID8gJycgOiBvcmlnaW4uZXJyb3JfbWVzc2FnZTtcblx0XHRcdGFjdGl2ZV9zdGF0ZS5wb2ludGVyX2lkID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9zdGF0ZS5wb2ludGVyX3R5cGUgPSAnJztcblx0XHRcdGFjdGl2ZV9zdGF0ZS5wb2ludGVyX2JvdW5kYXJ5ID0gJyc7XG5cdFx0XHRhY3RpdmVfc3RhdGUuYm91bmRhcnlfZHJhZ19vcmlnaW4gPSBudWxsO1xuXHRcdFx0aWYgKCBhY3RpdmVfc3RhdGUuc3VyZmFjZS5oYXNQb2ludGVyQ2FwdHVyZSggZXZlbnQucG9pbnRlcklkICkgKSB7XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5zdXJmYWNlLnJlbGVhc2VQb2ludGVyQ2FwdHVyZSggZXZlbnQucG9pbnRlcklkICk7XG5cdFx0XHR9XG5cdFx0XHRzY2hlZHVsZV9yZW5kZXIoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWplY3Qgbm9uLWVtcHR5IG9yIHJlc2VydmVkIGludGVyYWN0aW9uIHRhcmdldHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldCBFdmVudCB0YXJnZXQuXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBzdXJmYWNlIENhbmRpZGF0ZSB0aW1lZCBzdXJmYWNlLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgb25seSBmb3IgYW4gZWxpZ2libGUgZW1wdHkgdGltZWQgbG9jYXRpb24uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfZW1wdHlfc3VyZmFjZV90YXJnZXQoIHRhcmdldCwgc3VyZmFjZSApIHtcblx0XHRcdHJldHVybiBCb29sZWFuKCB0YXJnZXQgJiYgc3VyZmFjZSAmJiBzdXJmYWNlLmNvbnRhaW5zKCB0YXJnZXQgKSAmJiAhIHRhcmdldC5jbG9zZXN0KCBleGNsdWRlZF9zZWxlY3RvciApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RhcnQgbW91c2UvcGVuIGRyYWdnaW5nIG9yIGEgc2Nyb2xsLXNhZmUgdG91Y2ggdGFwIGNhbmRpZGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBQb2ludGVyIGRvd24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcG9pbnRlcl9kb3duKCBldmVudCApIHtcblx0XHRcdHZhciBib3VuZGFyeSA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdCA/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCBib3VuZGFyeV9zZWxlY3RvciApIDogbnVsbDtcblx0XHRcdHZhciBzdXJmYWNlID0gZXZlbnQudGFyZ2V0ICYmIGV2ZW50LnRhcmdldC5jbG9zZXN0ID8gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHN1cmZhY2Vfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0XHR2YXIgZ2VzdHVyZV9jb250ZXh0O1xuXHRcdFx0dmFyIGNvb3JkaW5hdGU7XG5cblx0XHRcdGlmICggYm91bmRhcnkgJiYgYmVnaW5fYm91bmRhcnlfZHJhZyggYm91bmRhcnksIGV2ZW50ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBzdXJmYWNlIHx8ICEgbW91bnQuY29udGFpbnMoIHN1cmZhY2UgKSB8fCAhIGlzX2VtcHR5X3N1cmZhY2VfdGFyZ2V0KCBldmVudC50YXJnZXQsIHN1cmZhY2UgKSB8fCAoICdtb3VzZScgPT09IGV2ZW50LnBvaW50ZXJUeXBlICYmIDAgIT09IGV2ZW50LmJ1dHRvbiApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRnZXN0dXJlX2NvbnRleHQgPSBwcmVwYXJlX2dlc3R1cmVfY29udGV4dCggc3VyZmFjZSApO1xuXHRcdFx0aWYgKCAhIGdlc3R1cmVfY29udGV4dCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29vcmRpbmF0ZSA9IHBvaW50ZXJfY29vcmRpbmF0ZSggZ2VzdHVyZV9jb250ZXh0LCBldmVudCApO1xuXHRcdFx0aWYgKCAndG91Y2gnID09PSBldmVudC5wb2ludGVyVHlwZSApIHtcblx0XHRcdFx0cGVuZGluZ190b3VjaCA9IHtcblx0XHRcdFx0XHRzdXJmYWNlOiBzdXJmYWNlLFxuXHRcdFx0XHRcdHBhbmVsOiBnZXN0dXJlX2NvbnRleHQucGFuZWwsXG5cdFx0XHRcdFx0cmVzb3VyY2VfaWQ6IGdlc3R1cmVfY29udGV4dC5yZXNvdXJjZV9pZCxcblx0XHRcdFx0XHRjYWNoZV9rZXk6IGdlc3R1cmVfY29udGV4dC5jYWNoZV9rZXksXG5cdFx0XHRcdFx0c3VyZmFjZV9yZWN0OiBnZXN0dXJlX2NvbnRleHQuc3VyZmFjZV9yZWN0LFxuXHRcdFx0XHRcdHNuYXBzaG90OiBnZXN0dXJlX2NvbnRleHQuc25hcHNob3QsXG5cdFx0XHRcdFx0cG9pbnRlcl9pZDogZXZlbnQucG9pbnRlcklkLFxuXHRcdFx0XHRcdGNvb3JkaW5hdGU6IGNvb3JkaW5hdGUsXG5cdFx0XHRcdFx0b3JpZ2luOiB7IHg6IGV2ZW50LmNsaWVudFgsIHk6IGV2ZW50LmNsaWVudFkgfVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJlZ2luX2RyYWZ0KCBnZXN0dXJlX2NvbnRleHQsIGNvb3JkaW5hdGUsIHN1cmZhY2UgKSApIHtcblx0XHRcdFx0YWN0aXZlX3N0YXRlLnBvaW50ZXJfaWQgPSBldmVudC5wb2ludGVySWQ7XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5wb2ludGVyX3R5cGUgPSBldmVudC5wb2ludGVyVHlwZSB8fCAnbW91c2UnO1xuXHRcdFx0XHRzdXJmYWNlLnNldFBvaW50ZXJDYXB0dXJlKCBldmVudC5wb2ludGVySWQgKTtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb2FsZXNjZSBhY3RpdmUgbW91c2UvcGVuIGRyYWcgdXBkYXRlczsgdG91Y2ggcmVtYWlucyBuYXRpdmUgc2Nyb2xsaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IFBvaW50ZXIgbW92ZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9wb2ludGVyX21vdmUoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCAhIGFjdGl2ZV9zdGF0ZSB8fCBhY3RpdmVfc3RhdGUucG9pbnRlcl9pZCAhPT0gZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGFjdGl2ZV9zdGF0ZS5wb2ludGVyX2JvdW5kYXJ5ICkge1xuXHRcdFx0XHR1cGRhdGVfYm91bmRhcnlfY29vcmRpbmF0ZShcblx0XHRcdFx0XHRhY3RpdmVfc3RhdGUucG9pbnRlcl9ib3VuZGFyeSxcblx0XHRcdFx0XHRwb2ludGVyX2JvdW5kYXJ5X2Nvb3JkaW5hdGUoIGFjdGl2ZV9zdGF0ZS5wb2ludGVyX2JvdW5kYXJ5LCBldmVudCApXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHNjaGVkdWxlX3JlbmRlcigpO1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICd0b3VjaCcgPT09IGFjdGl2ZV9zdGF0ZS5wb2ludGVyX3R5cGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNjaGVkdWxlX3JlbmRlciggcG9pbnRlcl9jb29yZGluYXRlKCB7XG5cdFx0XHRcdHN1cmZhY2VfcmVjdDogYWN0aXZlX3N0YXRlLnN1cmZhY2VfcmVjdFxuXHRcdFx0fSwgZXZlbnQgKSApO1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb21wbGV0ZSBhIHBvaW50ZXIgZHJhZnQgb3IgcHJvbW90ZSBhIHN0YXRpb25hcnkgdG91Y2ggdG8gb25lIHRhcCBkcmFmdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBQb2ludGVyIHVwIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3BvaW50ZXJfdXAoIGV2ZW50ICkge1xuXHRcdFx0dmFyIG1vdmVtZW50O1xuXHRcdFx0dmFyIGNvb3JkaW5hdGU7XG5cblx0XHRcdGlmICggcGVuZGluZ190b3VjaCAmJiBwZW5kaW5nX3RvdWNoLnBvaW50ZXJfaWQgPT09IGV2ZW50LnBvaW50ZXJJZCApIHtcblx0XHRcdFx0bW92ZW1lbnQgPSBNYXRoLmh5cG90KCBldmVudC5jbGllbnRYIC0gcGVuZGluZ190b3VjaC5vcmlnaW4ueCwgZXZlbnQuY2xpZW50WSAtIHBlbmRpbmdfdG91Y2gub3JpZ2luLnkgKTtcblx0XHRcdFx0aWYgKCBtb3ZlbWVudCA+IHRvdWNoX3RvbGVyYW5jZV9waXhlbHMgKSB7XG5cdFx0XHRcdFx0cGVuZGluZ190b3VjaCA9IG51bGw7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYmVnaW5fZHJhZnQoIHBlbmRpbmdfdG91Y2gsIHBlbmRpbmdfdG91Y2guY29vcmRpbmF0ZSwgcGVuZGluZ190b3VjaC5zdXJmYWNlICkgKSB7XG5cdFx0XHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2RyYWZ0Jztcblx0XHRcdFx0XHRhY3RpdmVfc3RhdGUuY29tbWl0X2FmdGVyX3JlbmRlciA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGVuZGluZ190b3VjaCA9IG51bGw7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBhY3RpdmVfc3RhdGUgfHwgYWN0aXZlX3N0YXRlLnBvaW50ZXJfaWQgIT09IGV2ZW50LnBvaW50ZXJJZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBhY3RpdmVfc3RhdGUucG9pbnRlcl9ib3VuZGFyeSApIHtcblx0XHRcdFx0dXBkYXRlX2JvdW5kYXJ5X2Nvb3JkaW5hdGUoXG5cdFx0XHRcdFx0YWN0aXZlX3N0YXRlLnBvaW50ZXJfYm91bmRhcnksXG5cdFx0XHRcdFx0cG9pbnRlcl9ib3VuZGFyeV9jb29yZGluYXRlKCBhY3RpdmVfc3RhdGUucG9pbnRlcl9ib3VuZGFyeSwgZXZlbnQgKVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUucG9pbnRlcl9pZCA9IG51bGw7XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5wb2ludGVyX3R5cGUgPSAnJztcblx0XHRcdFx0YWN0aXZlX3N0YXRlLnBvaW50ZXJfYm91bmRhcnkgPSAnJztcblx0XHRcdFx0YWN0aXZlX3N0YXRlLmJvdW5kYXJ5X2RyYWdfb3JpZ2luID0gbnVsbDtcblx0XHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2RyYWZ0Jztcblx0XHRcdFx0YWN0aXZlX3N0YXRlLnByZXZpZXcgPSBudWxsO1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUuZXJyb3JfbWVzc2FnZSA9ICcnO1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUuY29tbWl0X2FmdGVyX3JlbmRlciA9IHRydWU7XG5cdFx0XHRcdHNjaGVkdWxlX3JlbmRlcigpO1xuXHRcdFx0XHRpZiAoIGFjdGl2ZV9zdGF0ZS5zdXJmYWNlLmhhc1BvaW50ZXJDYXB0dXJlKCBldmVudC5wb2ludGVySWQgKSApIHtcblx0XHRcdFx0XHRhY3RpdmVfc3RhdGUuc3VyZmFjZS5yZWxlYXNlUG9pbnRlckNhcHR1cmUoIGV2ZW50LnBvaW50ZXJJZCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvb3JkaW5hdGUgPSBwb2ludGVyX2Nvb3JkaW5hdGUoIHtcblx0XHRcdFx0c3VyZmFjZV9yZWN0OiBhY3RpdmVfc3RhdGUuc3VyZmFjZV9yZWN0XG5cdFx0XHR9LCBldmVudCApO1xuXHRcdFx0YWN0aXZlX3N0YXRlLnBvaW50ZXJfaWQgPSBudWxsO1xuXHRcdFx0YWN0aXZlX3N0YXRlLnBvaW50ZXJfdHlwZSA9ICcnO1xuXHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2RyYWZ0Jztcblx0XHRcdGFjdGl2ZV9zdGF0ZS5jb21taXRfYWZ0ZXJfcmVuZGVyID0gdHJ1ZTtcblx0XHRcdHNjaGVkdWxlX3JlbmRlciggY29vcmRpbmF0ZSApO1xuXHRcdFx0aWYgKCBhY3RpdmVfc3RhdGUuc3VyZmFjZS5oYXNQb2ludGVyQ2FwdHVyZSggZXZlbnQucG9pbnRlcklkICkgKSB7XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5zdXJmYWNlLnJlbGVhc2VQb2ludGVyQ2FwdHVyZSggZXZlbnQucG9pbnRlcklkICk7XG5cdFx0XHR9XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFiYW5kb24gb25seSBhbiB1bmZpbmlzaGVkIHBvaW50ZXIgZ2VzdHVyZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UG9pbnRlckV2ZW50fSBldmVudCBQb2ludGVyIGNhbmNlbGxhdGlvbiBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9wb2ludGVyX2NhbmNlbCggZXZlbnQgKSB7XG5cdFx0XHRpZiAoIHBlbmRpbmdfdG91Y2ggJiYgcGVuZGluZ190b3VjaC5wb2ludGVyX2lkID09PSBldmVudC5wb2ludGVySWQgKSB7XG5cdFx0XHRcdHBlbmRpbmdfdG91Y2ggPSBudWxsO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGFjdGl2ZV9zdGF0ZSAmJiBhY3RpdmVfc3RhdGUucG9pbnRlcl9pZCA9PT0gZXZlbnQucG9pbnRlcklkICkge1xuXHRcdFx0XHRpZiAoIGFjdGl2ZV9zdGF0ZS5wb2ludGVyX2JvdW5kYXJ5ICkge1xuXHRcdFx0XHRcdHJlc3RvcmVfYm91bmRhcnlfZHJhZyggZXZlbnQgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FuY2VsX2RyYWZ0KCBmYWxzZSwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNb3ZlIG9uZSBrZXlib2FyZCBjb29yZGluYXRlIGJ5IGEgcGh5c2ljYWwgYXJyb3cgb3IgYm91bmRhcnkgY29tbWFuZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBjb29yZGluYXRlIEN1cnJlbnQgY29vcmRpbmF0ZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5ICAgICAgICBLZXlib2FyZCBrZXkuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBCb3VuZGVkIHJlcGxhY2VtZW50IGNvb3JkaW5hdGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbW92ZV9rZXlib2FyZF9jb29yZGluYXRlKCBjb29yZGluYXRlLCBrZXkgKSB7XG5cdFx0XHR2YXIgc25hcHNob3QgPSBhY3RpdmVfc3RhdGUuc25hcHNob3Q7XG5cdFx0XHR2YXIgZGF0ZV9pbmRleCA9IGdldF9jb2x1bW5faW5kZXgoIHNuYXBzaG90LCBjb29yZGluYXRlLmRhdGUgKTtcblx0XHRcdHZhciBzbmFwX2luZGV4ID0gY29vcmRpbmF0ZS5zbmFwX2luZGV4O1xuXHRcdFx0dmFyIG1heGltdW1faW5kZXggPSBNYXRoLm1heCggMCwgTWF0aC5jZWlsKCAoIHNuYXBzaG90LnZpc2libGVfcmFuZ2UuZW5kX21pbnV0ZSAtIHNuYXBzaG90LnZpc2libGVfcmFuZ2Uuc3RhcnRfbWludXRlICkgLyBzbmFwc2hvdC5zZWxlY3Rpb25fc3RlcF9taW51dGVzICkgLSAxICk7XG5cdFx0XHR2YXIgZGF0ZV9kZWx0YSA9IDA7XG5cblx0XHRcdGlmICggJ0Fycm93VXAnID09PSBrZXkgKSB7XG5cdFx0XHRcdHNuYXBfaW5kZXggLT0gMTtcblx0XHRcdH0gZWxzZSBpZiAoICdBcnJvd0Rvd24nID09PSBrZXkgKSB7XG5cdFx0XHRcdHNuYXBfaW5kZXggKz0gMTtcblx0XHRcdH0gZWxzZSBpZiAoICdIb21lJyA9PT0ga2V5ICkge1xuXHRcdFx0XHRzbmFwX2luZGV4ID0gMDtcblx0XHRcdH0gZWxzZSBpZiAoICdFbmQnID09PSBrZXkgKSB7XG5cdFx0XHRcdHNuYXBfaW5kZXggPSBtYXhpbXVtX2luZGV4O1xuXHRcdFx0fSBlbHNlIGlmICggJ0Fycm93TGVmdCcgPT09IGtleSApIHtcblx0XHRcdFx0ZGF0ZV9kZWx0YSA9ICdydGwnID09PSBzbmFwc2hvdC5kaXJlY3Rpb24gPyAxIDogLTE7XG5cdFx0XHR9IGVsc2UgaWYgKCAnQXJyb3dSaWdodCcgPT09IGtleSApIHtcblx0XHRcdFx0ZGF0ZV9kZWx0YSA9ICdydGwnID09PSBzbmFwc2hvdC5kaXJlY3Rpb24gPyAtMSA6IDE7XG5cdFx0XHR9XG5cdFx0XHRkYXRlX2luZGV4ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCBzbmFwc2hvdC5kYXRlX2NvbHVtbnMubGVuZ3RoIC0gMSwgZGF0ZV9pbmRleCArIGRhdGVfZGVsdGEgKSApO1xuXG5cdFx0XHRyZXR1cm4ga2V5Ym9hcmRfY29vcmRpbmF0ZSggc25hcHNob3QsIHNuYXBzaG90LmRhdGVfY29sdW1uc1sgZGF0ZV9pbmRleCBdLmRhdGUsIHNuYXBfaW5kZXggKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdGFydCBhIGtleWJvYXJkIGRyYWZ0IG9yIHVwZGF0ZSB0aGUgZm9jdXNlZCBhY2Nlc3NpYmxlIGJvdW5kYXJ5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBLZXlib2FyZCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9rZXlfZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgYm91bmRhcnkgPSBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggYm91bmRhcnlfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0XHR2YXIgc3VyZmFjZSA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdCA/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCBzdXJmYWNlX3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdFx0dmFyIGdlc3R1cmVfY29udGV4dDtcblx0XHRcdHZhciBjb29yZGluYXRlO1xuXHRcdFx0dmFyIGJvdW5kYXJ5X25hbWU7XG5cblx0XHRcdGlmICggJ0VzY2FwZScgPT09IGV2ZW50LmtleSAmJiBhY3RpdmVfc3RhdGUgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlmICggWyAnYXBwbHlpbmcnLCAnYXdhaXRpbmdfcmVhZGJhY2snIF0uaW5kZXhPZiggYWN0aXZlX3N0YXRlLnBoYXNlICkgIT09IC0xICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYW5jZWxfZHJhZnQoIHRydWUsIHRydWUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBib3VuZGFyeSAmJiBhY3RpdmVfc3RhdGUgKSB7XG5cdFx0XHRcdGlmICggWyAnYXBwbHlpbmcnLCAnYXdhaXRpbmdfcmVhZGJhY2snIF0uaW5kZXhPZiggYWN0aXZlX3N0YXRlLnBoYXNlICkgIT09IC0xICkge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ0VudGVyJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0cmVxdWVzdF9zZWxlY3Rpb25fcHJldmlldygpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIFsgJ0Fycm93VXAnLCAnQXJyb3dEb3duJywgJ0Fycm93TGVmdCcsICdBcnJvd1JpZ2h0JywgJ0hvbWUnLCAnRW5kJyBdLmluZGV4T2YoIGV2ZW50LmtleSApID09PSAtMSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Ym91bmRhcnlfbmFtZSA9IFN0cmluZyggYm91bmRhcnkuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zZWxlY3Rpb24tYm91bmRhcnknICkgfHwgJycgKTtcblx0XHRcdFx0Y29vcmRpbmF0ZSA9IChcblx0XHRcdFx0XHQoICdzdGFydCcgPT09IGJvdW5kYXJ5X25hbWUgJiYgJ2FuY2hvcicgPT09IGFjdGl2ZV9zdGF0ZS5zdGFydF9lbmRwb2ludCApXG5cdFx0XHRcdFx0fHwgKCAnZW5kJyA9PT0gYm91bmRhcnlfbmFtZSAmJiAnZm9jdXMnID09PSBhY3RpdmVfc3RhdGUuc3RhcnRfZW5kcG9pbnQgKVxuXHRcdFx0XHQpID8gYWN0aXZlX3N0YXRlLmFuY2hvcl9jb29yZGluYXRlIDogYWN0aXZlX3N0YXRlLmZvY3VzX2Nvb3JkaW5hdGU7XG5cdFx0XHRcdGNvb3JkaW5hdGUgPSBtb3ZlX2tleWJvYXJkX2Nvb3JkaW5hdGUoIGNvb3JkaW5hdGUsIGV2ZW50LmtleSApO1xuXHRcdFx0XHR1cGRhdGVfYm91bmRhcnlfY29vcmRpbmF0ZSggYm91bmRhcnlfbmFtZSwgY29vcmRpbmF0ZSApO1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUuZm9jdXNfYm91bmRhcnkgPSBib3VuZGFyeV9uYW1lO1xuXHRcdFx0XHRhYm9ydF9zZWxlY3Rpb25fcmVxdWVzdCgpO1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUucGhhc2UgPSAnZHJhZnQnO1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUucHJldmlldyA9IG51bGw7XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5lcnJvcl9tZXNzYWdlID0gJyc7XG5cdFx0XHRcdHNjaGVkdWxlX3JlbmRlcigpO1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgc3VyZmFjZSB8fCBldmVudC50YXJnZXQgIT09IHN1cmZhY2UgfHwgKCAnRW50ZXInICE9PSBldmVudC5rZXkgJiYgJyAnICE9PSBldmVudC5rZXkgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Z2VzdHVyZV9jb250ZXh0ID0gcHJlcGFyZV9nZXN0dXJlX2NvbnRleHQoIHN1cmZhY2UgKTtcblx0XHRcdGlmICggISBnZXN0dXJlX2NvbnRleHQgfHwgISBnZXN0dXJlX2NvbnRleHQuc25hcHNob3QuZGF0ZV9jb2x1bW5zLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29vcmRpbmF0ZSA9IGtleWJvYXJkX2Nvb3JkaW5hdGUoIGdlc3R1cmVfY29udGV4dC5zbmFwc2hvdCwgZ2VzdHVyZV9jb250ZXh0LnNuYXBzaG90LmRhdGVfY29sdW1uc1sgMCBdLmRhdGUsIDAgKTtcblx0XHRcdGlmICggYmVnaW5fZHJhZnQoIGdlc3R1cmVfY29udGV4dCwgY29vcmRpbmF0ZSwgc3VyZmFjZSApICkge1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUuZm9jdXNfYm91bmRhcnkgPSAnZW5kJztcblx0XHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2RyYWZ0Jztcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgZXhwbGljaXQgY2FuY2VsLCByZXRyeSwgQmxvY2ssIGFuZCBVbmJsb2NrIGFjdGl2YXRpb25zLlxuXHRcdCAqXG5cdFx0ICogTmV3IEJvb2tpbmcgcmVtYWlucyBhbiBvcmRpbmFyeSBzZXJ2ZXItc2lnbmVkIGxpbmsuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IERlbGVnYXRlZCBjbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9hY3Rpb25fY2xpY2soIGV2ZW50ICkge1xuXHRcdFx0dmFyIGNhbmNlbF9jb250cm9sID0gZXZlbnQudGFyZ2V0ICYmIGV2ZW50LnRhcmdldC5jbG9zZXN0ID8gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zZWxlY3Rpb24tY2FuY2VsXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmV0cnlfY29udHJvbCA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdCA/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc2VsZWN0aW9uLXJldHJ5XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgYXZhaWxhYmlsaXR5X2NvbnRyb2wgPSBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXNlbGVjdGlvbi1hdmFpbGFiaWxpdHldJyApIDogbnVsbDtcblx0XHRcdHZhciBmb2xkX2NvbnRyb2wgPSBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggZm9sZF9jaG9pY2Vfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0XHR2YXIgZW5kcG9pbnQ7XG5cdFx0XHR2YXIgb2NjdXJyZW5jZV9pZDtcblx0XHRcdHZhciBjb29yZGluYXRlX2tleTtcblxuXHRcdFx0aWYgKCBmb2xkX2NvbnRyb2wgJiYgbW91bnQuY29udGFpbnMoIGZvbGRfY29udHJvbCApICYmIGFjdGl2ZV9zdGF0ZSApIHtcblx0XHRcdFx0ZW5kcG9pbnQgPSBTdHJpbmcoIGZvbGRfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXNlbGVjdGlvbi1mb2xkLWVuZHBvaW50JyApIHx8ICcnICk7XG5cdFx0XHRcdG9jY3VycmVuY2VfaWQgPSBTdHJpbmcoIGZvbGRfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXNlbGVjdGlvbi1mb2xkLWNob2ljZScgKSB8fCAnJyApO1xuXHRcdFx0XHRjb29yZGluYXRlX2tleSA9ICdhbmNob3InID09PSBlbmRwb2ludCA/ICdhbmNob3JfY29vcmRpbmF0ZScgOiAoICdmb2N1cycgPT09IGVuZHBvaW50ID8gJ2ZvY3VzX2Nvb3JkaW5hdGUnIDogJycgKTtcblx0XHRcdFx0aWYgKCBjb29yZGluYXRlX2tleSAmJiBvY2N1cnJlbmNlX2lkICYmIGFjdGl2ZV9zdGF0ZVsgY29vcmRpbmF0ZV9rZXkgXSApIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGFjdGl2ZV9zdGF0ZVsgY29vcmRpbmF0ZV9rZXkgXSA9IE9iamVjdC5hc3NpZ24oIHt9LCBhY3RpdmVfc3RhdGVbIGNvb3JkaW5hdGVfa2V5IF0sIHtcblx0XHRcdFx0XHRcdG9jY3VycmVuY2VfaWQ6IG9jY3VycmVuY2VfaWRcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2RyYWZ0Jztcblx0XHRcdFx0XHRhY3RpdmVfc3RhdGUucHJldmlldyA9IG51bGw7XG5cdFx0XHRcdFx0YWN0aXZlX3N0YXRlLmVycm9yX21lc3NhZ2UgPSAnJztcblx0XHRcdFx0XHRzY2hlZHVsZV9yZW5kZXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggY2FuY2VsX2NvbnRyb2wgJiYgbW91bnQuY29udGFpbnMoIGNhbmNlbF9jb250cm9sICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlmICggYWN0aXZlX3N0YXRlICYmIFsgJ2FwcGx5aW5nJywgJ2F3YWl0aW5nX3JlYWRiYWNrJyBdLmluZGV4T2YoIGFjdGl2ZV9zdGF0ZS5waGFzZSApID09PSAtMSApIHtcblx0XHRcdFx0XHRjYW5jZWxfZHJhZnQoIHRydWUsIHRydWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJldHJ5X2NvbnRyb2wgJiYgbW91bnQuY29udGFpbnMoIHJldHJ5X2NvbnRyb2wgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmVxdWVzdF9zZWxlY3Rpb25fcHJldmlldygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGF2YWlsYWJpbGl0eV9jb250cm9sICYmIG1vdW50LmNvbnRhaW5zKCBhdmFpbGFiaWxpdHlfY29udHJvbCApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRhcHBseV9zZWxlY3Rpb25fYXZhaWxhYmlsaXR5KCBTdHJpbmcoIGF2YWlsYWJpbGl0eV9jb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc2VsZWN0aW9uLWF2YWlsYWJpbGl0eScgKSB8fCAnJyApICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtZW1iZXIgd2hlbiBrZXlib2FyZCBmb2N1cyBpcyBvd25lZCBieSB0aGUgY3VycmVudCBkcmFmdCBzdXJmYWNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtGb2N1c0V2ZW50fSBldmVudCBEZWxlZ2F0ZWQgZm9jdXMgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfZm9jdXNfaW4oIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBhY3RpdmVfc3RhdGUgKSB7XG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZS5yZXN0b3JlX2ZvY3VzX29uX2NhbmNlbCA9IGFjdGl2ZV9zdGF0ZS5zdXJmYWNlLmNvbnRhaW5zKCBldmVudC50YXJnZXQgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdG9wIGF1dG9tYXRpYyByZXN0b3JhdGlvbiBhZnRlciB0aGUgdXNlciBkZWxpYmVyYXRlbHkgbGVhdmVzIGEgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBET00gcmVwbGFjZW1lbnQgbWF5IGRpc2Nvbm5lY3QgdGhlIHN1cmZhY2UgYmVmb3JlIGZvY3Vzb3V0OyByZXRhaW5pbmcgdGhlXG5cdFx0ICogZmxhZyBpbiB0aGF0IGNhc2UgcGVybWl0cyByZXN0b3JhdGlvbiB0byB0aGUgcmVwbGFjZW1lbnQgc3VyZmFjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Rm9jdXNFdmVudH0gZXZlbnQgRGVsZWdhdGVkIGZvY3VzIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2ZvY3VzX291dCggZXZlbnQgKSB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGFjdGl2ZV9zdGF0ZVxuXHRcdFx0XHQmJiBhY3RpdmVfc3RhdGUuc3VyZmFjZS5pc0Nvbm5lY3RlZFxuXHRcdFx0XHQmJiBhY3RpdmVfc3RhdGUuc3VyZmFjZS5jb250YWlucyggZXZlbnQudGFyZ2V0IClcblx0XHRcdFx0JiYgKCAhIGV2ZW50LnJlbGF0ZWRUYXJnZXQgfHwgISBhY3RpdmVfc3RhdGUuc3VyZmFjZS5jb250YWlucyggZXZlbnQucmVsYXRlZFRhcmdldCApIClcblx0XHRcdCkge1xuXHRcdFx0XHRhY3RpdmVfc3RhdGUucmVzdG9yZV9mb2N1c19vbl9jYW5jZWwgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBZGQga2V5Ym9hcmQgc2VtYW50aWNzIGFuZCBhbiBhbGxvdy1saXN0ZWQgc3RhdHVzIHRlbXBsYXRlIHRvIG5ldyBzdXJmYWNlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZW5oYW5jZV9zdXJmYWNlcygpIHtcblx0XHRcdHZhciBzdGF0dXNfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoICdzdGF0dXMnICk7XG5cblx0XHRcdGlmICggISBtb3VudCB8fCAhIHN0YXR1c190ZW1wbGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bW91bnQucXVlcnlTZWxlY3RvckFsbCggc3VyZmFjZV9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggc3VyZmFjZSApIHtcblx0XHRcdFx0dmFyIGlkZW50aXR5O1xuXHRcdFx0XHR2YXIgcmVjb3JkO1xuXHRcdFx0XHR2YXIgaG9sZGVyO1xuXG5cdFx0XHRcdGlmICggJ3RydWUnID09PSBzdXJmYWNlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc2VsZWN0aW9uLXJlYWR5JyApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZGVudGl0eSA9IGdldF9zdXJmYWNlX2lkZW50aXR5KCBzdXJmYWNlICk7XG5cdFx0XHRcdGlmICggISBpZGVudGl0eSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVjb3JkID0ge1xuXHRcdFx0XHRcdHN1cmZhY2U6IHN1cmZhY2UsXG5cdFx0XHRcdFx0dGFiaW5kZXg6IHN1cmZhY2UuZ2V0QXR0cmlidXRlKCAndGFiaW5kZXgnICksXG5cdFx0XHRcdFx0YXJpYV9sYWJlbDogc3VyZmFjZS5nZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJyApLFxuXHRcdFx0XHRcdGFyaWFfZGVzY3JpcHRpb246IHN1cmZhY2UuZ2V0QXR0cmlidXRlKCAnYXJpYS1kZXNjcmlwdGlvbicgKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRzdXJmYWNlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc2VsZWN0aW9uLXJlYWR5JywgJ3RydWUnICk7XG5cdFx0XHRcdHN1cmZhY2Uuc2V0QXR0cmlidXRlKCAndGFiaW5kZXgnLCAnMCcgKTtcblx0XHRcdFx0c3VyZmFjZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJywgU3RyaW5nKCBpMThuLnN1cmZhY2VfbGFiZWwgfHwgJycgKSApO1xuXHRcdFx0XHRzdXJmYWNlLnNldEF0dHJpYnV0ZSggJ2FyaWEtZGVzY3JpcHRpb24nLCBTdHJpbmcoIGkxOG4uaW5zdHJ1Y3Rpb25zIHx8ICcnICkgKTtcblx0XHRcdFx0aG9sZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRcdFx0aG9sZGVyLmlubmVySFRNTCA9IHN0YXR1c190ZW1wbGF0ZSgge1xuXHRcdFx0XHRcdHN0YXR1c19pZDogJ3dwYmMtdGltZS1yb3dzLXNlbGVjdGlvbi1zdGF0dXMtJyArIGlkZW50aXR5LnJlc291cmNlX2lkLFxuXHRcdFx0XHRcdG1lc3NhZ2U6ICcnXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCBob2xkZXIuZmlyc3RFbGVtZW50Q2hpbGQgKSB7XG5cdFx0XHRcdFx0c3VyZmFjZS5hcHBlbmRDaGlsZCggaG9sZGVyLmZpcnN0RWxlbWVudENoaWxkICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZW5oYW5jZWRfc3VyZmFjZXMucHVzaCggcmVjb3JkICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FuY2VsIGRyYWZ0cyB3aGVuZXZlciBhY2NlcHRlZCBkYXRhIG9yIHJlbmRlcmVkIGlkZW50aXR5IGNoYW5nZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBMaWZlY3ljbGUgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfaWRlbnRpdHlfY2hhbmdlKCBldmVudCApIHtcblx0XHRcdHZhciBkZXRhaWwgPSBldmVudCAmJiBldmVudC5kZXRhaWwgfHwge307XG5cdFx0XHR2YXIgaXNfZ2xvYmFsX2lkZW50aXR5X2NoYW5nZSA9ICd3cGJjOnRpbWVsaW5lOmRhdGE6Ym9va2luZy13aW5kb3dzLWFjY2VwdGVkJyA9PT0gZXZlbnQudHlwZVxuXHRcdFx0XHR8fCAnd3BiYzp0aW1lbGluZTpkYXRhOmF2YWlsYWJpbGl0eS1hY2NlcHRlZCcgPT09IGV2ZW50LnR5cGU7XG5cdFx0XHR2YXIgaXNfcmVhZGJhY2tfc3RhdGUgPSAnd3BiYzp0aW1lbGluZTpkYXRhOmF1dGhvcml0YXRpdmUtcmVhZGJhY2stc3RhdGUnID09PSBldmVudC50eXBlO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdGlzX3JlYWRiYWNrX3N0YXRlXG5cdFx0XHRcdCYmICdib29raW5nX2NyZWF0aW9uJyA9PT0gU3RyaW5nKCBkZXRhaWwucmVhc29uIHx8ICcnIClcblx0XHRcdFx0JiYgJ2xvYWRpbmcnID09PSBTdHJpbmcoIGRldGFpbC5zdGF0ZSB8fCAnJyApXG5cdFx0XHQpIHtcblx0XHRcdFx0cHJlc2VydmVfZHJhZnRfZHVyaW5nX2Jvb2tpbmdfY3JlYXRpb25fcmVhZGJhY2sgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHByZXNlcnZlX2RyYWZ0X2R1cmluZ19ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrXG5cdFx0XHRcdCYmICggJ3dwYmM6dGltZWxpbmU6ZGF0YTpib29raW5nLXdpbmRvd3MtYWNjZXB0ZWQnID09PSBldmVudC50eXBlIHx8ICd3cGJjOnRpbWVsaW5lOmRhdGE6YXZhaWxhYmlsaXR5LWFjY2VwdGVkJyA9PT0gZXZlbnQudHlwZSApXG5cdFx0XHQpIHtcblx0XHRcdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZW5oYW5jZV9zdXJmYWNlcyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGlzX3JlYWRiYWNrX3N0YXRlXG5cdFx0XHRcdCYmICdib29raW5nX2NyZWF0aW9uJyA9PT0gU3RyaW5nKCBkZXRhaWwucmVhc29uIHx8ICcnIClcblx0XHRcdFx0JiYgWyAnYWNjZXB0ZWQnLCAnZmFpbGVkJyBdLmluZGV4T2YoIFN0cmluZyggZGV0YWlsLnN0YXRlIHx8ICcnICkgKSAhPT0gLTFcblx0XHRcdCkge1xuXHRcdFx0XHRwcmVzZXJ2ZV9kcmFmdF9kdXJpbmdfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFjayA9IGZhbHNlO1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBlbmhhbmNlX3N1cmZhY2VzICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggaXNfcmVhZGJhY2tfc3RhdGUgJiYgJ2xvYWRpbmcnID09PSBTdHJpbmcoIGRldGFpbC5zdGF0ZSB8fCAnJyApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGlzX3JlYWRiYWNrX3N0YXRlICYmICdmYWlsZWQnID09PSBTdHJpbmcoIGRldGFpbC5zdGF0ZSB8fCAnJyApICkge1xuXHRcdFx0XHRpZiAoIGFjdGl2ZV9zdGF0ZSAmJiAnYXdhaXRpbmdfcmVhZGJhY2snID09PSBhY3RpdmVfc3RhdGUucGhhc2UgKSB7XG5cdFx0XHRcdFx0YWN0aXZlX3N0YXRlLnBoYXNlID0gJ2Vycm9yJztcblx0XHRcdFx0XHRhY3RpdmVfc3RhdGUuZXJyb3JfbWVzc2FnZSA9IGkxOG4uYXBwbHlfZXJyb3I7XG5cdFx0XHRcdFx0cmVuZGVyX2RyYWZ0KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXNfZ2xvYmFsX2lkZW50aXR5X2NoYW5nZSA9IGlzX2dsb2JhbF9pZGVudGl0eV9jaGFuZ2Vcblx0XHRcdFx0fHwgKCBpc19yZWFkYmFja19zdGF0ZSAmJiAnYWNjZXB0ZWQnID09PSBTdHJpbmcoIGRldGFpbC5zdGF0ZSB8fCAnJyApICk7XG5cblx0XHRcdGlmICggcGVuZGluZ190b3VjaCAmJiAoIGlzX2dsb2JhbF9pZGVudGl0eV9jaGFuZ2UgfHwgTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSA9PT0gcGVuZGluZ190b3VjaC5yZXNvdXJjZV9pZCApICkge1xuXHRcdFx0XHRwZW5kaW5nX3RvdWNoID0gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBhY3RpdmVfc3RhdGUgJiYgKFxuXHRcdFx0XHRpc19nbG9iYWxfaWRlbnRpdHlfY2hhbmdlXG5cdFx0XHRcdHx8IE51bWJlciggZGV0YWlsLnJlc291cmNlX2lkICkgPT09IGFjdGl2ZV9zdGF0ZS5yZXNvdXJjZV9pZFxuXHRcdFx0KSApIHtcblx0XHRcdFx0Y2FuY2VsX2RyYWZ0KCBCb29sZWFuKCBhY3RpdmVfc3RhdGUucmVzdG9yZV9mb2N1c19vbl9jYW5jZWwgKSwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGVuaGFuY2Vfc3VyZmFjZXMgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJbml0aWFsaXplIGRlbGVnYXRlZCBsb2NhbCBpbnRlcmFjdGlvbiBsaXN0ZW5lcnMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG5cdFx0XHRpZiAoIGlzX2luaXRpYWxpemVkIHx8ICEgbW91bnQgfHwgISBnZW9tZXRyeSB8fCAhIE51bWJlci5pc0ludGVnZXIoIHNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgKSB8fCAxID4gc2VsZWN0aW9uX3N0ZXBfbWludXRlcyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJkb3duJywgaGFuZGxlX3BvaW50ZXJfZG93biApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJtb3ZlJywgaGFuZGxlX3BvaW50ZXJfbW92ZSApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJ1cCcsIGhhbmRsZV9wb2ludGVyX3VwICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAncG9pbnRlcmNhbmNlbCcsIGhhbmRsZV9wb2ludGVyX2NhbmNlbCApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfa2V5X2Rvd24gKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9hY3Rpb25fY2xpY2sgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c2luJywgaGFuZGxlX2ZvY3VzX2luICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnZm9jdXNvdXQnLCBoYW5kbGVfZm9jdXNfb3V0ICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpkYXRhOmJvb2tpbmctd2luZG93cy1hY2NlcHRlZCcsIGhhbmRsZV9pZGVudGl0eV9jaGFuZ2UgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6YXZhaWxhYmlsaXR5LWFjY2VwdGVkJywgaGFuZGxlX2lkZW50aXR5X2NoYW5nZSApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6ZGF0YTphdXRob3JpdGF0aXZlLXJlYWRiYWNrLXN0YXRlJywgaGFuZGxlX2lkZW50aXR5X2NoYW5nZSApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpyZW5kZXJlZCcsIGhhbmRsZV9pZGVudGl0eV9jaGFuZ2UgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOnJvdy1wcmVzZW50YXRpb246Y2xvc2VkJywgaGFuZGxlX2lkZW50aXR5X2NoYW5nZSApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpyZW1vdmVkJywgaGFuZGxlX2lkZW50aXR5X2NoYW5nZSApO1xuXHRcdFx0ZW5oYW5jZV9zdXJmYWNlcygpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIERlc3Ryb3kgbG9jYWwgc3RhdGUgYW5kIHJlc3RvcmUgYXR0cmlidXRlcyBhZGRlZCBieSB0aGlzIGFkYXB0ZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0XHRpZiAoICEgaXNfaW5pdGlhbGl6ZWQgfHwgISBtb3VudCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJkb3duJywgaGFuZGxlX3BvaW50ZXJfZG93biApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJtb3ZlJywgaGFuZGxlX3BvaW50ZXJfbW92ZSApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJ1cCcsIGhhbmRsZV9wb2ludGVyX3VwICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAncG9pbnRlcmNhbmNlbCcsIGhhbmRsZV9wb2ludGVyX2NhbmNlbCApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfa2V5X2Rvd24gKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9hY3Rpb25fY2xpY2sgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdmb2N1c2luJywgaGFuZGxlX2ZvY3VzX2luICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnZm9jdXNvdXQnLCBoYW5kbGVfZm9jdXNfb3V0ICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpkYXRhOmJvb2tpbmctd2luZG93cy1hY2NlcHRlZCcsIGhhbmRsZV9pZGVudGl0eV9jaGFuZ2UgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6YXZhaWxhYmlsaXR5LWFjY2VwdGVkJywgaGFuZGxlX2lkZW50aXR5X2NoYW5nZSApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6ZGF0YTphdXRob3JpdGF0aXZlLXJlYWRiYWNrLXN0YXRlJywgaGFuZGxlX2lkZW50aXR5X2NoYW5nZSApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpyZW5kZXJlZCcsIGhhbmRsZV9pZGVudGl0eV9jaGFuZ2UgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOnJvdy1wcmVzZW50YXRpb246Y2xvc2VkJywgaGFuZGxlX2lkZW50aXR5X2NoYW5nZSApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpyZW1vdmVkJywgaGFuZGxlX2lkZW50aXR5X2NoYW5nZSApO1xuXHRcdFx0Y2FuY2VsX2RyYWZ0KCBmYWxzZSwgZmFsc2UgKTtcblx0XHRcdHBlbmRpbmdfdG91Y2ggPSBudWxsO1xuXHRcdFx0ZW5oYW5jZWRfc3VyZmFjZXMuZm9yRWFjaCggZnVuY3Rpb24gKCByZWNvcmQgKSB7XG5cdFx0XHRcdHZhciBzdXJmYWNlID0gcmVjb3JkLnN1cmZhY2U7XG5cblx0XHRcdFx0aWYgKCAhIHN1cmZhY2UgfHwgISBzdXJmYWNlLmlzQ29ubmVjdGVkICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdXJmYWNlLnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc2VsZWN0aW9uLXJlYWR5JyApO1xuXHRcdFx0XHRbIFsgJ3RhYmluZGV4JywgcmVjb3JkLnRhYmluZGV4IF0sIFsgJ2FyaWEtbGFiZWwnLCByZWNvcmQuYXJpYV9sYWJlbCBdLCBbICdhcmlhLWRlc2NyaXB0aW9uJywgcmVjb3JkLmFyaWFfZGVzY3JpcHRpb24gXSBdLmZvckVhY2goIGZ1bmN0aW9uICggYXR0cmlidXRlICkge1xuXHRcdFx0XHRcdGlmICggbnVsbCA9PT0gYXR0cmlidXRlWyAxIF0gKSB7XG5cdFx0XHRcdFx0XHRzdXJmYWNlLnJlbW92ZUF0dHJpYnV0ZSggYXR0cmlidXRlWyAwIF0gKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0c3VyZmFjZS5zZXRBdHRyaWJ1dGUoIGF0dHJpYnV0ZVsgMCBdLCBhdHRyaWJ1dGVbIDEgXSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0XHRzdXJmYWNlLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zZWxlY3Rpb24tc3RhdHVzXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHN0YXR1cyApIHtcblx0XHRcdFx0XHRzdGF0dXMucmVtb3ZlKCk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKTtcblx0XHRcdGVuaGFuY2VkX3N1cmZhY2VzID0gW107XG5cdFx0XHRwcmVzZXJ2ZV9kcmFmdF9kdXJpbmdfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFjayA9IGZhbHNlO1xuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYm91bmRlZCBzY2FsYXIgc3RhdGUgZm9yIGRldmVsb3BtZW50IGFzc2VydGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IERyYWZ0IGxpZmVjeWNsZSBzbmFwc2hvdC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc3RhdGVfc25hcHNob3QoKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpc19pbml0aWFsaXplZDogaXNfaW5pdGlhbGl6ZWQsXG5cdFx0XHRcdGhhc19kcmFmdDogQm9vbGVhbiggYWN0aXZlX3N0YXRlICYmIGFjdGl2ZV9zdGF0ZS5kcmFmdCApLFxuXHRcdFx0XHRyZXNvdXJjZV9pZDogYWN0aXZlX3N0YXRlID8gYWN0aXZlX3N0YXRlLnJlc291cmNlX2lkIDogMCxcblx0XHRcdFx0Y2FjaGVfa2V5OiBhY3RpdmVfc3RhdGUgPyBhY3RpdmVfc3RhdGUuY2FjaGVfa2V5IDogJycsXG5cdFx0XHRcdGRyYWZ0X2lkZW50aXR5OiBhY3RpdmVfc3RhdGUgJiYgYWN0aXZlX3N0YXRlLmRyYWZ0ID8gU3RyaW5nKCBhY3RpdmVfc3RhdGUuZHJhZnQuZHJhZnRfaWRlbnRpdHkgfHwgJycgKSA6ICcnLFxuXHRcdFx0XHRzdGF0dXM6IGFjdGl2ZV9zdGF0ZSAmJiBhY3RpdmVfc3RhdGUuZHJhZnQgPyBTdHJpbmcoIGFjdGl2ZV9zdGF0ZS5kcmFmdC5zdGF0dXMgfHwgJycgKSA6ICdpZGxlJyxcblx0XHRcdFx0cGhhc2U6IGFjdGl2ZV9zdGF0ZSA/IFN0cmluZyggYWN0aXZlX3N0YXRlLnBoYXNlIHx8ICcnICkgOiAnaWRsZScsXG5cdFx0XHRcdGhhc19wcmV2aWV3OiBCb29sZWFuKCBhY3RpdmVfc3RhdGUgJiYgYWN0aXZlX3N0YXRlLnByZXZpZXcgKSxcblx0XHRcdFx0aGFzX3JlcXVlc3Q6IEJvb2xlYW4oIHNlbGVjdGlvbl9yZXF1ZXN0ICksXG5cdFx0XHRcdGhhc19wZW5kaW5nX2ZyYW1lOiBCb29sZWFuKCBwZW5kaW5nX2ZyYW1lIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxpemU6IGluaXRpYWxpemUsXG5cdFx0XHRkZXN0cm95OiBkZXN0cm95LFxuXHRcdFx0Y2FuY2VsOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNhbmNlbF9kcmFmdCggdHJ1ZSwgdHJ1ZSApO1xuXHRcdFx0fSxcblx0XHRcdGNvbnN1bWVfc2lnbmVkX2FjdGlvbl9jb250ZXh0OiBjb25zdW1lX3NpZ25lZF9hY3Rpb25fY29udGV4dCxcblx0XHRcdGdldF9zdGF0ZV9zbmFwc2hvdDogZ2V0X3N0YXRlX3NuYXBzaG90XG5cdFx0fTtcblx0fVxuXG5cdGlmICggd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5ICkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSggbW9kdWxlX2lkLCBjcmVhdGVfc2VsZWN0aW9uX2NvbnRyb2xsZXIgKTtcblx0fVxufSggd2luZG93LCBkb2N1bWVudCwgd2luZG93LndwICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FB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
