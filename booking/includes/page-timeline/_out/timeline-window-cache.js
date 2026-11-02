"use strict";

/**
 * Timeline bounded-window cache, request ownership, and anchor controller.
 *
 * The server remains authoritative for every window, axis, Resource, booking,
 * and occupancy DTO. This controller owns only browser-side composition of the
 * previous/current/next authorized responses, stale request generations, edge
 * rearming, cached Today/date resolution, and physical canvas anchor restore.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document) {
  'use strict';

  var module_id = 'window_cache';
  /**
   * Maximum harmless rounding drift between adjacent percentage boundaries.
   *
   * Percentage starts and widths are calculated independently. This tolerance
   * prevents binary residue from turning one shared half-open boundary into a
   * visual collision while remaining far below the narrowest supported cell.
   *
   * @type {number}
   */
  var presentation_geometry_epsilon = 0.0000001;

  /**
   * Create one bounded Timeline window/cache controller.
   *
   * @param {Object} context Controller-owned settings, mount, and scroll callback.
   * @return {Object} Window/cache lifecycle and state-machine API.
   */
  function create_window_cache_controller(context) {
    var settings = context.settings || {};
    var mount = context.mount || null;
    var synchronize_axis_scroll = 'function' === typeof context.synchronize_axis_scroll ? context.synchronize_axis_scroll : function () {};
    var get_now = 'function' === typeof context.get_now ? context.get_now : function () {
      return new Date();
    };
    var window_store = {
      current_key: '',
      resource_fingerprint: '',
      resource_order: [],
      windows: {}
    };
    var active_request = null;
    var request_generation = 0;
    var edge_requests = {
      previous: null,
      next: null
    };
    var edge_request_generations = {
      previous: 0,
      next: 0
    };
    var edge_states = {
      previous: create_idle_edge_state(),
      next: create_idle_edge_state()
    };
    var canvas_pointer_navigation_active = false;
    var axis_anchor_restoration_frame = 0;
    var axis_anchor_restoration_generation = 0;
    var axis_anchor_restoration_minimum_attempts = 2;
    var axis_anchor_restoration_maximum_attempts = 4;
    var axis_anchor_restoration_tolerance_px = 1;
    var is_initialized = false;

    /**
     * Return a fresh idle edge state.
     *
     * @return {Object} Mutable edge state owned by this instance.
     */
    function create_idle_edge_state() {
      return {
        status: 'idle',
        slow_timer: 0,
        cooldown_until: 0,
        armed: false,
        user_intent: false,
        reentry_required: false
      };
    }

    /**
     * Return Timeline adjacent-loading limits with bounded fallbacks.
     *
     * @return {Object} Normalized loading limits.
     */
    function get_loading_limits() {
      var limits = settings.metadata && settings.metadata.window_loading ? settings.metadata.window_loading : {};
      return {
        maximum_cached_windows: Math.max(1, Number(limits.maximum_cached_windows) || 3),
        edge_placeholder_cells: Math.max(1, Number(limits.edge_placeholder_cells) || 3),
        edge_prefetch_percent: Math.max(1, Math.min(49, Number(limits.edge_prefetch_percent) || 18)),
        edge_rearm_percent: Math.max(1, Math.min(90, Number(limits.edge_rearm_percent) || 32)),
        request_cooldown_ms: Math.max(0, Number(limits.request_cooldown_ms) || 400),
        slow_loading_ms: Math.max(0, Number(limits.slow_loading_ms) || 3000),
        request_timeout_ms: Math.max(1000, Number(limits.request_timeout_ms) || 15000)
      };
    }

    /**
     * Normalize one authorized server response for bounded browser storage.
     *
     * @param {Object} response Authorized window response.
     * @return {Object} Cache payload containing JSON-safe DTO collections.
     */
    function normalize_window_payload(response) {
      response = response || {};
      return {
        window: response.window || {},
        axis: response.axis || {},
        resources: Array.isArray(response.resources) ? response.resources : [],
        segments: Array.isArray(response.segments) ? response.segments : [],
        occupancy: Array.isArray(response.occupancy) ? response.occupancy : [],
        time_slot_overflows: Array.isArray(response.time_slot_overflows) ? response.time_slot_overflows : [],
        preferences: response.preferences || {},
        resource_view: response.resource_view || {},
        resource_pagination: response.resource_pagination || {},
        window_context: response.window_context || {},
        view_policy: response.view_policy || {},
        diagnostics: response.diagnostics || {}
      };
    }

    /**
     * Return the server key or a compatibility key for an older response.
     *
     * @param {Object} payload Normalized window payload.
     * @return {string} Stable cache key.
     */
    function get_window_key(payload) {
      if (payload.window_context && payload.window_context.window_key) {
        return String(payload.window_context.window_key);
      }
      return [payload.axis.start_at || '', payload.axis.end_at || '', payload.axis.view || ''].join('|');
    }

    /**
     * Return cached windows ordered by their server start epoch.
     *
     * @return {Array<Object>} Ordered `{ key, payload }` entries.
     */
    function get_ordered_window_entries() {
      return Object.keys(window_store.windows).map(function (window_key) {
        return {
          key: window_key,
          payload: window_store.windows[window_key]
        };
      }).sort(function (left_entry, right_entry) {
        return Number(left_entry.payload.axis.start_epoch) - Number(right_entry.payload.axis.start_epoch);
      });
    }

    /**
     * Return signed selection tokens from the bounded authorized cache.
     *
     * @return {Array<string>} At most the configured cache count of tokens.
     */
    function get_selection_context_tokens() {
      return get_ordered_window_entries().map(function (entry) {
        return entry.payload.window_context && entry.payload.window_context.selection_token ? String(entry.payload.window_context.selection_token) : '';
      }).filter(function (token) {
        return Boolean(token);
      }).slice(0, get_loading_limits().maximum_cached_windows);
    }

    /**
     * Abort both adjacent requests and invalidate their late callbacks.
     *
     * @return {void}
     */
    function abort_edge_requests() {
      ['previous', 'next'].forEach(function (direction) {
        var state = edge_states[direction];
        if (edge_requests[direction] && 'function' === typeof edge_requests[direction].abort) {
          edge_requests[direction].abort();
        }
        edge_requests[direction] = null;
        edge_request_generations[direction] += 1;
        if (state.slow_timer) {
          window.clearTimeout(state.slow_timer);
        }
        edge_states[direction] = create_idle_edge_state();
      });
    }

    /**
     * Reset the bounded cache around one authoritative current response.
     *
     * @param {Object} response Authorized window response.
     * @return {Object} Normalized current payload.
     */
    function reset(response) {
      var payload = normalize_window_payload(response);
      var window_key = get_window_key(payload);
      abort_edge_requests();
      window_store = {
        current_key: window_key,
        resource_fingerprint: String(payload.window_context.resource_fingerprint || ''),
        resource_order: payload.resources.map(function (resource) {
          return Number(resource && resource.id);
        }).filter(function (resource_id) {
          return Number.isInteger(resource_id) && 1 <= resource_id;
        }),
        windows: {}
      };
      window_store.windows[window_key] = payload;
      return payload;
    }

    /**
     * Atomically replace the complete three-window Resource context.
     *
     * Every payload must carry the same non-empty server fingerprint. The
     * existing store remains untouched until the complete candidate store has
     * been validated, preventing old and new Resource pages from coexisting.
     *
     * @param {Object} current_response Authorized current-window response.
     * @param {Array<Object>} adjacent_responses Authorized previous and next responses.
     * @return {Object|null} Normalized current payload, or null when rejected.
     */
    function replace_resource_context(current_response, adjacent_responses) {
      var current_payload = normalize_window_payload(current_response);
      var resource_fingerprint = String(current_payload.window_context.resource_fingerprint || '');
      var candidate_windows = {};
      var candidate_payloads = Array.isArray(adjacent_responses) ? adjacent_responses.map(normalize_window_payload) : [];
      var current_key = get_window_key(current_payload);
      var is_valid = Boolean(resource_fingerprint && current_key && 2 === candidate_payloads.length);
      candidate_windows[current_key] = current_payload;
      candidate_payloads.forEach(function (payload) {
        var window_key = get_window_key(payload);
        if (!window_key || resource_fingerprint !== String(payload.window_context.resource_fingerprint || '')) {
          is_valid = false;
          return;
        }
        candidate_windows[window_key] = payload;
      });
      if (!is_valid || 3 !== Object.keys(candidate_windows).length) {
        return null;
      }
      abort_edge_requests();
      window_store = {
        current_key: current_key,
        resource_fingerprint: resource_fingerprint,
        resource_order: current_payload.resources.map(function (resource) {
          return Number(resource && resource.id);
        }).filter(function (resource_id) {
          return Number.isInteger(resource_id) && 1 <= resource_id;
        }),
        windows: candidate_windows
      };
      return current_payload;
    }

    /**
     * Return the current opaque server Resource fingerprint.
     *
     * @return {string} Fingerprint, or an empty string before initialization.
     */
    function get_resource_fingerprint() {
      return String(window_store.resource_fingerprint || '');
    }

    /**
     * Add an adjacent response only for the current authorized Resource set.
     *
     * @param {Object} response Authorized adjacent response.
     * @return {boolean} True when the response was accepted into the cache.
     */
    function cache_adjacent(response) {
      var payload = normalize_window_payload(response);
      var resource_fingerprint = String(payload.window_context.resource_fingerprint || '');
      var window_key = get_window_key(payload);
      if (window_store.resource_fingerprint && resource_fingerprint !== window_store.resource_fingerprint) {
        return false;
      }
      if (!window_store.resource_fingerprint) {
        window_store.resource_fingerprint = resource_fingerprint;
      }
      window_store.windows[window_key] = payload;
      return true;
    }

    /**
     * Keep only the nearest previous/current/next authorized responses.
     *
     * @return {boolean} True when at least one response was evicted.
     */
    function trim() {
      var limits = get_loading_limits();
      var entries = get_ordered_window_entries();
      var current_index = 0;
      var changed = false;
      entries.some(function (entry, entry_index) {
        if (entry.key === window_store.current_key) {
          current_index = entry_index;
          return true;
        }
        return false;
      });
      while (entries.length > limits.maximum_cached_windows) {
        var first_distance = Math.abs(current_index);
        var last_distance = Math.abs(entries.length - 1 - current_index);
        var remove_index = last_distance > first_distance ? entries.length - 1 : 0;
        delete window_store.windows[entries[remove_index].key];
        entries.splice(remove_index, 1);
        if (0 === remove_index) {
          current_index -= 1;
        }
        changed = true;
      }
      return changed;
    }

    /**
     * Map an epoch to fractional units on an explicit DST-aware axis.
     *
     * @param {number} timestamp Epoch seconds.
     * @param {Array<Object>} cells Ordered server cells.
     * @return {number} Fractional cell position.
     */
    function map_timestamp_to_axis_position(timestamp, cells) {
      var position = 0;
      Array.prototype.some.call(cells, function (cell, cell_index) {
        var start_epoch = Number(cell.start_epoch);
        var end_epoch = Number(cell.end_epoch);
        if (timestamp <= start_epoch) {
          position = cell_index;
          return true;
        }
        if (timestamp < end_epoch) {
          position = cell_index + (timestamp - start_epoch) / Math.max(1, end_epoch - start_epoch);
          return true;
        }
        position = cell_index + 1;
        return false;
      });
      return position;
    }

    /**
     * Calculate exact and visual geometry against the composed axis.
     *
     * @param {Object} axis Composed axis DTO.
     * @param {number} start_epoch Inclusive start.
     * @param {number} end_epoch Exclusive end.
     * @return {Object} Percentage geometry.
     */
    function get_composed_segment_geometry(axis, start_epoch, end_epoch) {
      var cell_count = Math.max(1, axis.cells.length);
      var start_units = map_timestamp_to_axis_position(start_epoch, axis.cells);
      var end_units = map_timestamp_to_axis_position(end_epoch, axis.cells);
      var visual_start = Math.max(0, Math.min(cell_count - 1, Math.floor(start_units)));
      var visual_end = Math.max(visual_start + 1, Math.min(cell_count, Math.ceil(end_units)));
      return {
        offset_percent: 100 * start_units / cell_count,
        width_percent: 100 * Math.max(0, end_units - start_units) / cell_count,
        visual_offset_percent: 100 * visual_start / cell_count,
        visual_width_percent: 100 * (visual_end - visual_start) / cell_count
      };
    }

    /**
     * Select shape-aware card geometry after cached windows are recomposed.
     *
     * Full-day records keep whole-cell presentation. Timed and changeover
     * records retain their exact fractional boundaries, matching the server DTO
     * and the resize proposal shown before and after a canonical refresh.
     *
     * @param {Object} geometry Exact and cell-expanded axis geometry.
     * @param {boolean} is_full_day Whether the record represents full dates.
     * @param {boolean} is_day_time_slot Whether a same-day slot uses a semantic day card.
     * @return {Object} Shape-aware card presentation geometry.
     */
    function get_composed_presentation_geometry(geometry, is_full_day, is_day_time_slot) {
      var use_complete_cells = is_full_day || is_day_time_slot;
      return {
        presentation_offset_percent: use_complete_cells ? geometry.visual_offset_percent : geometry.offset_percent,
        presentation_width_percent: use_complete_cells ? geometry.visual_width_percent : geometry.width_percent
      };
    }

    /**
     * Compose cached server axes without inventing local date labels.
     *
     * @param {Array<Object>} entries Ordered cached windows.
     * @param {Object} current_payload Current logical window.
     * @return {Object} Combined axis DTO.
     */
    function compose_cached_axis(entries, current_payload) {
      var cell_map = {};
      var cells = [];
      var month_bands = [];
      var date_bands = [];
      var month_map = {};
      var date_map = {};
      var date_metadata_by_key = {};
      var current_marker = Object.assign({}, current_payload.axis.current_time_marker || {});
      var now_epoch = Math.floor(get_now().getTime() / 1000);
      entries.forEach(function (entry) {
        (entry.payload.axis.date_bands || []).forEach(function (date_band) {
          var date_key = String(date_band.date || '');
          if (date_key && !date_metadata_by_key[date_key]) {
            date_metadata_by_key[date_key] = Object.assign({}, date_band);
          }
        });
        (entry.payload.axis.cells || []).forEach(function (cell) {
          var cell_key = String(cell.start_epoch) + ':' + String(cell.end_epoch);
          if (!cell_map[cell_key]) {
            cell_map[cell_key] = Object.assign({}, cell);
            cells.push(cell_map[cell_key]);
          }
        });
      });
      cells.sort(function (left_cell, right_cell) {
        return Number(left_cell.start_epoch) - Number(right_cell.start_epoch);
      });
      cells.forEach(function (cell, cell_index) {
        var month_key = String(cell.month_key || cell.date || '').substring(0, 7);
        var date_key = String(cell.date || '');
        var date_metadata = date_metadata_by_key[date_key] || {};
        cell.index = cell_index;
        cell.offset_percent = cells.length ? 100 * cell_index / cells.length : 0;
        cell.width_percent = cells.length ? 100 / cells.length : 100;
        if (!month_map[month_key]) {
          month_map[month_key] = {
            key: month_key,
            label: cell.month_label || month_key,
            span: 0
          };
          month_bands.push(month_map[month_key]);
        }
        month_map[month_key].span += 1;
        if (!date_map[date_key]) {
          date_map[date_key] = {
            date: date_key,
            label: date_metadata.label || date_key,
            weekday: date_metadata.weekday || '',
            day_number: date_metadata.day_number || cell.day_number || '',
            today_label: date_metadata.today_label || date_key,
            is_today: 'undefined' !== typeof date_metadata.is_today ? Boolean(date_metadata.is_today) : Boolean(cell.is_today),
            is_weekend: 'undefined' !== typeof date_metadata.is_weekend ? Boolean(date_metadata.is_weekend) : Boolean(cell.is_weekend),
            start_at: date_metadata.start_at || cell.start_at,
            end_at: date_metadata.end_at || cell.end_at,
            start_epoch: 'undefined' !== typeof date_metadata.start_epoch ? Number(date_metadata.start_epoch) : Number(cell.start_epoch),
            end_epoch: 'undefined' !== typeof date_metadata.end_epoch ? Number(date_metadata.end_epoch) : Number(cell.end_epoch),
            elapsed_minutes: 'undefined' !== typeof date_metadata.elapsed_minutes ? Number(date_metadata.elapsed_minutes) : Math.max(0, (Number(cell.end_epoch) - Number(cell.start_epoch)) / 60),
            wall_minutes: 'undefined' !== typeof date_metadata.wall_minutes ? Number(date_metadata.wall_minutes) : 1440,
            utc_offset_start_seconds: 'undefined' !== typeof date_metadata.utc_offset_start_seconds ? Number(date_metadata.utc_offset_start_seconds) : 0,
            utc_offset_end_seconds: 'undefined' !== typeof date_metadata.utc_offset_end_seconds ? Number(date_metadata.utc_offset_end_seconds) : 0,
            transitions: Array.isArray(date_metadata.transitions) ? date_metadata.transitions.map(function (transition) {
              return Object.assign({}, transition);
            }) : [],
            span: 0
          };
          date_bands.push(date_map[date_key]);
        }
        date_map[date_key].span += 1;
      });
      current_marker.is_visible = Boolean(current_payload.axis.is_timed && cells.length && now_epoch >= Number(cells[0].start_epoch) && now_epoch < Number(cells[cells.length - 1].end_epoch));
      current_marker.position_percent = cells.length ? 100 * map_timestamp_to_axis_position(now_epoch, cells) / cells.length : 0;
      return Object.assign({}, current_payload.axis, {
        cell_count: cells.length,
        cells: cells,
        month_bands: month_bands,
        date_bands: date_bands,
        start_at: cells.length ? cells[0].start_at : current_payload.axis.start_at,
        end_at: cells.length ? cells[cells.length - 1].end_at : current_payload.axis.end_at,
        start_epoch: cells.length ? Number(cells[0].start_epoch) : Number(current_payload.axis.start_epoch),
        end_epoch: cells.length ? Number(cells[cells.length - 1].end_epoch) : Number(current_payload.axis.end_epoch),
        current_time_marker: current_marker
      });
    }

    /**
     * Assign deterministic collision lanes to composed visible segments.
     *
     * @param {Array<Object>} segments Composed booking card DTOs.
     * @param {Array<Object>} time_slot_overflows Composed day-cell overflow DTOs.
     * @return {Object} Lane counts keyed by Resource ID.
     */
    function assign_composed_segment_lanes(segments, time_slot_overflows) {
      var by_resource = {};
      var lane_counts = {};
      segments.forEach(function (segment, segment_index) {
        var resource_id = Number(segment.resource_id);
        if (false === segment.is_visible || true === segment.is_time_slot_overflow_item) {
          segment.lane_index = 0;
          return;
        }
        by_resource[resource_id] = by_resource[resource_id] || [];
        by_resource[resource_id].push({
          type: 'segment',
          index: segment_index,
          start: Number(segment.presentation_offset_percent),
          end: Number(segment.presentation_offset_percent) + Number(segment.presentation_width_percent),
          sort_order: 0,
          id: String(segment.segment_id || '')
        });
      });
      (time_slot_overflows || []).forEach(function (overflow, overflow_index) {
        var resource_id = Number(overflow.resource_id);
        by_resource[resource_id] = by_resource[resource_id] || [];
        by_resource[resource_id].push({
          type: 'overflow',
          index: overflow_index,
          start: Number(overflow.presentation_offset_percent),
          end: Number(overflow.presentation_offset_percent) + Number(overflow.presentation_width_percent),
          sort_order: 1,
          id: String(overflow.overflow_id || '')
        });
      });
      Object.keys(by_resource).forEach(function (resource_id) {
        var lane_ends = [];
        by_resource[resource_id].sort(function (left_entry, right_entry) {
          return left_entry.start - right_entry.start || left_entry.sort_order - right_entry.sort_order || left_entry.id.localeCompare(right_entry.id);
        }).forEach(function (entry) {
          var lane_index = 0;
          while ('undefined' !== typeof lane_ends[lane_index] && lane_ends[lane_index] - entry.start > presentation_geometry_epsilon) {
            lane_index += 1;
          }
          lane_ends[lane_index] = entry.end;
          if ('segment' === entry.type) {
            segments[entry.index].lane_index = lane_index;
          } else {
            time_slot_overflows[entry.index].lane_index = lane_index;
          }
        });
        lane_counts[resource_id] = Math.max(1, lane_ends.length);
      });
      return lane_counts;
    }

    /**
     * Build compact overflow controls for dense same-date timed bookings.
     *
     * The operation changes presentation fields only. Exact intervals remain in
     * every segment and in the independent occupancy collection.
     *
     * @param {Array<Object>} segments Composed booking card DTOs.
     * @return {Array<Object>} Template-ready overflow controls.
     */
    function build_composed_time_slot_overflows(segments) {
      var maximum_visible_slots = 3;
      var groups = {};
      var overflows = [];
      segments.forEach(function (segment) {
        segment.is_time_slot_overflow_item = false;
        if (false === segment.is_visible || !segment.is_day_time_slot || !segment.time_slot_group_key) {
          return;
        }
        groups[segment.time_slot_group_key] = groups[segment.time_slot_group_key] || [];
        groups[segment.time_slot_group_key].push(segment);
      });
      Object.keys(groups).forEach(function (group_key) {
        var group_segments = groups[group_key].sort(function (left_segment, right_segment) {
          return Date.parse(left_segment.start) - Date.parse(right_segment.start) || String(left_segment.segment_id).localeCompare(String(right_segment.segment_id));
        });
        var hidden_segments;
        var first_segment;
        var count_text;
        var date_label;
        var visible_slot_limit = maximum_visible_slots;
        if (group_segments.length > maximum_visible_slots) {
          visible_slot_limit = maximum_visible_slots - 1;
        }
        group_segments.forEach(function (segment, group_index) {
          segment.time_slot_group_index = group_index;
          segment.is_time_slot_overflow_item = group_index >= visible_slot_limit;
        });
        if (group_segments.length <= maximum_visible_slots) {
          return;
        }
        first_segment = group_segments[0];
        hidden_segments = group_segments.slice(visible_slot_limit);
        count_text = String(hidden_segments.length);
        date_label = String(first_segment.time_slot_date_label || first_segment.time_slot_date || '');
        overflows.push({
          overflow_id: 'wpbc-time-slot-overflow-' + String(first_segment.resource_id) + '-' + String(first_segment.time_slot_date || '').replace(/[^0-9-]/g, ''),
          group_key: group_key,
          resource_id: Number(first_segment.resource_id),
          date: String(first_segment.time_slot_date || ''),
          date_label: date_label,
          presentation_offset_percent: Number(first_segment.presentation_offset_percent),
          presentation_width_percent: Number(first_segment.presentation_width_percent),
          hidden_count: hidden_segments.length,
          more_label: String(settings.i18n.time_slot_more || '+{count} more').replace('{count}', count_text),
          aria_label: String(settings.i18n.time_slot_more_label || 'Show {count} more bookings on {date}').replace('{count}', count_text).replace('{date}', date_label),
          heading: String(settings.i18n.time_slot_more_heading || 'More bookings on {date}').replace('{date}', date_label),
          items: hidden_segments.map(function (segment) {
            return {
              booking_id: Number(segment.booking_id),
              segment_id: String(segment.segment_id || ''),
              label: String(segment.label || ''),
              time_label: String(segment.time_slot_time_label || ''),
              duration_label: String(segment.duration_label || ''),
              aria_label: String(segment.aria_label || segment.label || '')
            };
          }),
          lane_index: 0
        });
      });
      return overflows;
    }

    /**
     * Merge stable projections and recalculate their composed-axis geometry.
     *
     * @param {Array<Object>} entries Ordered cached windows.
     * @param {Object} axis Composed axis DTO.
     * @param {string} collection_key Segment or occupancy collection key.
     * @return {Array<Object>} Deduplicated projected records.
     */
    function compose_projected_records(entries, axis, collection_key) {
      var record_map = {};
      var records = [];
      entries.forEach(function (entry) {
        (entry.payload[collection_key] || []).forEach(function (source_record) {
          var record_key = String(source_record.segment_id || '');
          var start_epoch;
          var end_epoch;
          var visible_start_epoch;
          var visible_end_epoch;
          var visible_start;
          var visible_end;
          var geometry;
          var presentation_geometry;
          var record;
          if (!record_key || record_map[record_key]) {
            return;
          }
          start_epoch = Math.floor(Date.parse(source_record.start) / 1000);
          end_epoch = Math.floor(Date.parse(source_record.end) / 1000);
          if (end_epoch <= Number(axis.start_epoch) || start_epoch >= Number(axis.end_epoch)) {
            return;
          }
          visible_start_epoch = Math.max(start_epoch, Number(axis.start_epoch));
          visible_end_epoch = Math.min(end_epoch, Number(axis.end_epoch));
          // Keep the exact request instants synchronized with recomposed geometry.
          // Resize eligibility compares these instants with canonical boundaries.
          visible_start = visible_start_epoch === start_epoch ? source_record.start : axis.start_at;
          visible_end = visible_end_epoch === end_epoch ? source_record.end : axis.end_at;
          geometry = get_composed_segment_geometry(axis, visible_start_epoch, visible_end_epoch);
          presentation_geometry = get_composed_presentation_geometry(geometry, true === source_record.is_full_day, true === source_record.is_day_time_slot);
          record = Object.assign({}, source_record, geometry, presentation_geometry, {
            is_clipped_start: start_epoch < Number(axis.start_epoch),
            is_clipped_end: end_epoch > Number(axis.end_epoch),
            visible_start: visible_start,
            visible_end: visible_end,
            visible_start_epoch: visible_start_epoch,
            visible_end_epoch: visible_end_epoch,
            is_compact: true === source_record.is_day_time_slot ? false : presentation_geometry.presentation_width_percent <= 100 / Math.max(1, axis.cell_count) + 0.000001
          });
          record_map[record_key] = record;
          records.push(record);
        });
      });
      return records;
    }

    /**
     * Restore the canonical Resource presentation order captured at reset.
     *
     * Adjacent exact-ID reads authorize the same Resource set independently,
     * but an edition-specific repository must not reshuffle parent and child
     * rows when that response becomes current. Unknown IDs are appended
     * defensively; fingerprint validation still owns set equality.
     *
     * @param {Array<Object>} resources Authorized Resource DTOs.
     * @return {Array<Object>} Resources in stable presentation order.
     */
    function order_resources(resources) {
      var resources_by_id = Object.create(null);
      var ordered_resources = [];
      (Array.isArray(resources) ? resources : []).forEach(function (resource) {
        var resource_id = Number(resource && resource.id);
        if (Number.isInteger(resource_id) && 1 <= resource_id) {
          resources_by_id[resource_id] = resource;
        }
      });
      window_store.resource_order.forEach(function (resource_id) {
        if (resources_by_id[resource_id]) {
          ordered_resources.push(resources_by_id[resource_id]);
          delete resources_by_id[resource_id];
        }
      });
      Object.keys(resources_by_id).forEach(function (resource_id) {
        ordered_resources.push(resources_by_id[resource_id]);
      });
      return ordered_resources;
    }

    /**
     * Compose one template-ready view from the bounded cache.
     *
     * @return {Object|null} Composed view or null without a current window.
     */
    function compose() {
      var entries = get_ordered_window_entries();
      var current_payload = window_store.windows[window_store.current_key];
      var axis;
      var segments;
      var occupancy;
      var time_slot_overflows;
      var lane_counts;
      var resources;
      if (!current_payload || !entries.length) {
        return null;
      }
      axis = compose_cached_axis(entries, current_payload);
      segments = compose_projected_records(entries, axis, 'segments');
      occupancy = compose_projected_records(entries, axis, 'occupancy');
      time_slot_overflows = build_composed_time_slot_overflows(segments);
      lane_counts = assign_composed_segment_lanes(segments, time_slot_overflows);
      resources = order_resources(current_payload.resources).map(function (resource) {
        return Object.assign({}, resource, {
          lane_count: lane_counts[Number(resource.id)] || 1
        });
      });
      return {
        current: current_payload,
        axis: axis,
        resources: resources,
        segments: segments,
        occupancy: occupancy,
        time_slot_overflows: time_slot_overflows
      };
    }

    /**
     * Return the outer cached entry used to request an adjacent window.
     *
     * @param {string} direction Previous or next.
     * @return {Object|null} Outer cache entry or null.
     */
    function get_edge_window_entry(direction) {
      var entries = get_ordered_window_entries();
      if (!entries.length || -1 === ['previous', 'next'].indexOf(direction)) {
        return null;
      }
      return 'previous' === direction ? entries[0] : entries[entries.length - 1];
    }

    /**
     * Promote the cached response containing an anchor to logical current.
     *
     * @param {Object} anchor Captured server-offset timestamp anchor.
     * @return {Object|null} Promotion result, or null when unchanged.
     */
    function promote_for_anchor(anchor) {
      var anchor_epoch = Math.floor(Date.parse(anchor && anchor.at ? anchor.at : '') / 1000);
      var promoted_entry = null;
      get_ordered_window_entries().some(function (entry) {
        if (anchor_epoch >= Number(entry.payload.axis.start_epoch) && anchor_epoch < Number(entry.payload.axis.end_epoch)) {
          promoted_entry = entry;
          return true;
        }
        return false;
      });
      if (!promoted_entry || promoted_entry.key === window_store.current_key) {
        return null;
      }
      window_store.current_key = promoted_entry.key;
      return {
        entry: promoted_entry,
        trimmed: trim()
      };
    }

    /**
     * Return a read-only snapshot of one controller-owned edge.
     *
     * @param {string} direction Previous or next.
     * @return {Object|null} Edge-state snapshot or null for an invalid direction.
     */
    function get_edge_state(direction) {
      return edge_states[direction] ? Object.assign({}, edge_states[direction]) : null;
    }

    /**
     * Suspend automatic loading before programmatic canvas movement.
     *
     * @return {void}
     */
    function suspend_adjacent_loading() {
      canvas_pointer_navigation_active = false;
      ['previous', 'next'].forEach(function (direction) {
        var state = edge_states[direction];
        if ('idle' !== state.status) {
          return;
        }
        state.armed = false;
        state.user_intent = false;
        state.reentry_required = false;
      });
    }

    /**
     * Record deliberate navigation toward an adjacent edge.
     *
     * @param {string} direction Previous or next.
     * @param {boolean} force Whether an explicit control bypasses reentry.
     * @return {boolean} True when intent was accepted.
     */
    function activate_adjacent_intent(direction, force) {
      var state = edge_states[direction];
      if (!state || 'idle' !== state.status || state.reentry_required && !force) {
        return false;
      }
      state.armed = true;
      state.user_intent = true;
      if (force) {
        state.reentry_required = false;
      }
      return true;
    }

    /**
     * Record whether a pointer may be driving native horizontal movement.
     *
     * @param {boolean} is_active Whether pointer navigation is active.
     * @return {void}
     */
    function set_pointer_navigation_active(is_active) {
      canvas_pointer_navigation_active = Boolean(is_active);
    }

    /**
     * Update reentry and return whether one edge may request now.
     *
     * @param {string} direction Previous or next.
     * @param {boolean} is_near_rearm Whether sentinel is within rearm zone.
     * @param {boolean} is_near_prefetch Whether sentinel is in request zone.
     * @return {boolean} True when the caller should request this edge.
     */
    function update_edge_proximity(direction, is_near_rearm, is_near_prefetch) {
      var state = edge_states[direction];
      if (!state) {
        return false;
      }
      if (state.reentry_required && !is_near_rearm) {
        state.reentry_required = false;
        state.armed = false;
        state.user_intent = false;
      }
      if (canvas_pointer_navigation_active) {
        activate_adjacent_intent(direction, false);
      }
      return Boolean(state.armed && state.user_intent && 'idle' === state.status && is_near_prefetch);
    }

    /**
     * Start one foreground generation and abort its obsolete predecessor.
     *
     * @return {number} New request generation.
     */
    function begin_foreground_request() {
      var request_to_abort = active_request;
      request_generation += 1;
      active_request = null;
      if (request_to_abort && 'function' === typeof request_to_abort.abort) {
        request_to_abort.abort();
      }
      return request_generation;
    }

    /**
     * Attach a transport to its current foreground generation.
     *
     * @param {number} generation Request generation.
     * @param {Object} request Abortable transport.
     * @return {boolean} True when the transport remains current.
     */
    function set_foreground_request(generation, request) {
      if (generation !== request_generation) {
        if (request && 'function' === typeof request.abort) {
          request.abort();
        }
        return false;
      }
      active_request = request || null;
      return true;
    }

    /**
     * Report whether a foreground callback still owns current state.
     *
     * @param {number} generation Request generation.
     * @return {boolean} True when current.
     */
    function is_foreground_generation_current(generation) {
      return generation === request_generation;
    }

    /**
     * Release the current foreground transport without changing generation.
     *
     * @param {number} generation Request generation.
     * @return {boolean} True when released.
     */
    function complete_foreground_request(generation) {
      if (generation !== request_generation) {
        return false;
      }
      active_request = null;
      return true;
    }

    /**
     * Abort and invalidate the current foreground transport.
     *
     * @return {boolean} True when an abortable request existed.
     */
    function abort_foreground_request() {
      var request_to_abort = active_request;
      request_generation += 1;
      active_request = null;
      if (!request_to_abort || 'function' !== typeof request_to_abort.abort) {
        return false;
      }
      request_to_abort.abort();
      return true;
    }

    /**
     * Start one adjacent request generation and mark its edge busy.
     *
     * @param {string} direction Previous or next.
     * @param {boolean} allow_without_user_intent Whether foreground priming may bypass user intent.
     * @return {number} New generation, or zero for an invalid/busy edge.
     */
    function begin_edge_request(direction, allow_without_user_intent) {
      var state = edge_states[direction];
      if (!state || 'idle' !== state.status || !allow_without_user_intent && (!state.armed || !state.user_intent)) {
        return 0;
      }
      edge_request_generations[direction] += 1;
      state.armed = false;
      state.user_intent = false;
      state.reentry_required = true;
      state.status = 'loading';
      return edge_request_generations[direction];
    }

    /**
     * Attach an adjacent transport to its current generation.
     *
     * @param {string} direction Previous or next.
     * @param {number} generation Edge generation.
     * @param {Object} request Abortable transport.
     * @return {boolean} True when attached.
     */
    function set_edge_request(direction, generation, request) {
      if (!is_edge_generation_current(direction, generation)) {
        if (request && 'function' === typeof request.abort) {
          request.abort();
        }
        return false;
      }
      edge_requests[direction] = request || null;
      return true;
    }

    /**
     * Report whether an adjacent callback still owns its edge.
     *
     * @param {string} direction Previous or next.
     * @param {number} generation Edge generation.
     * @return {boolean} True when current.
     */
    function is_edge_generation_current(direction, generation) {
      return Boolean(edge_states[direction] && generation === edge_request_generations[direction]);
    }

    /**
     * Return one current adjacent request.
     *
     * @param {string} direction Previous or next.
     * @return {Object|null} Request transport or null.
     */
    function get_edge_request(direction) {
      return edge_requests[direction] || null;
    }

    /**
     * Start the slow-response timer for one current adjacent request.
     *
     * The controller owns the timer and status transition while the caller
     * remains responsible only for repainting the domain-neutral edge shell.
     *
     * @param {string}   direction Previous or next.
     * @param {number}   generation Edge generation.
     * @param {Function} on_slow Callback after the current edge becomes slow.
     * @return {boolean} True when the timer was scheduled.
     */
    function schedule_edge_slow_state(direction, generation, on_slow) {
      var state = edge_states[direction];
      if (!state || !is_edge_generation_current(direction, generation)) {
        return false;
      }
      if (state.slow_timer) {
        window.clearTimeout(state.slow_timer);
      }
      state.slow_timer = window.setTimeout(function () {
        state.slow_timer = 0;
        if (!get_edge_request(direction) || !is_edge_generation_current(direction, generation)) {
          return;
        }
        state.status = 'slow';
        if ('function' === typeof on_slow) {
          on_slow();
        }
      }, get_loading_limits().slow_loading_ms);
      return true;
    }

    /**
     * Mark one current adjacent request as failed.
     *
     * @param {string} direction Previous or next.
     * @param {number} generation Edge generation.
     * @return {boolean} True when the current edge was updated.
     */
    function mark_edge_error(direction, generation) {
      var state = edge_states[direction];
      if (!state || !is_edge_generation_current(direction, generation)) {
        return false;
      }
      if (state.slow_timer) {
        window.clearTimeout(state.slow_timer);
        state.slow_timer = 0;
      }
      state.status = 'error';
      state.cooldown_until = Date.now() + get_loading_limits().request_cooldown_ms;
      return true;
    }

    /**
     * Set the post-load edge state after an authorized response is rendered.
     *
     * @param {string} direction Previous or next.
     * @param {number} generation Edge generation.
     * @return {boolean} True when the current edge was updated.
     */
    function mark_edge_loaded(direction, generation) {
      var state = edge_states[direction];
      if (!state || !is_edge_generation_current(direction, generation)) {
        return false;
      }
      if (state.slow_timer) {
        window.clearTimeout(state.slow_timer);
        state.slow_timer = 0;
      }
      state.status = 'idle';
      state.cooldown_until = Date.now() + get_loading_limits().request_cooldown_ms;
      state.armed = false;
      state.user_intent = false;
      state.reentry_required = true;
      return true;
    }

    /**
     * Clear a recoverable edge error before an explicit retry.
     *
     * @param {string} direction Previous or next.
     * @return {boolean} True when the edge can be retried.
     */
    function prepare_edge_retry(direction) {
      var state = edge_states[direction];
      if (!state || edge_requests[direction]) {
        return false;
      }
      if (state.slow_timer) {
        window.clearTimeout(state.slow_timer);
        state.slow_timer = 0;
      }
      state.status = 'idle';
      state.cooldown_until = 0;
      return true;
    }

    /**
     * Release one adjacent transport if its generation remains current.
     *
     * @param {string} direction Previous or next.
     * @param {number} generation Edge generation.
     * @return {boolean} True when released.
     */
    function complete_edge_request(direction, generation) {
      var state = edge_states[direction];
      if (!is_edge_generation_current(direction, generation)) {
        return false;
      }
      if (state.slow_timer) {
        window.clearTimeout(state.slow_timer);
        state.slow_timer = 0;
      }
      edge_requests[direction] = null;
      return true;
    }

    /**
     * Cancel one adjacent request and require threshold reentry.
     *
     * @param {string} direction Previous or next.
     * @return {boolean} True when an abortable request was cancelled.
     */
    function cancel_edge_request(direction) {
      var request = edge_requests[direction];
      var state = edge_states[direction];
      if (!request || !state || 'function' !== typeof request.abort) {
        return false;
      }
      edge_request_generations[direction] += 1;
      edge_requests[direction] = null;
      if (state.slow_timer) {
        window.clearTimeout(state.slow_timer);
      }
      state.slow_timer = 0;
      state.status = 'idle';
      state.armed = false;
      state.user_intent = false;
      state.reentry_required = true;
      state.cooldown_until = Date.now() + get_loading_limits().request_cooldown_ms;
      request.abort();
      return true;
    }

    /**
     * Locate the server axis cell nearest the visible canvas center.
     *
     * @return {Object} Offset-explicit timestamp and viewport geometry.
     */
    function capture_axis_anchor() {
      var canvas = mount ? mount.querySelector('[data-wpbc-timeline-canvas]') : null;
      var focused_cell = document.activeElement && document.activeElement.closest ? document.activeElement.closest('[data-wpbc-timeline-axis-cell]') : null;
      var cells = mount ? mount.querySelectorAll('[data-wpbc-timeline-axis-cell]') : [];
      var target_cell = focused_cell;
      var target_index = 0;
      var center_x;
      var closest_distance = Infinity;
      if (!canvas || !cells.length) {
        return {
          at: settings.axis.anchor.at,
          ratio: 0.5,
          restore_focus: false
        };
      }
      center_x = canvas.getBoundingClientRect().left + canvas.clientWidth / 2;
      if (!target_cell) {
        Array.prototype.forEach.call(cells, function (cell, cell_index) {
          var rectangle = cell.getBoundingClientRect();
          var distance = Math.abs(rectangle.left + rectangle.width / 2 - center_x);
          if (distance < closest_distance) {
            closest_distance = distance;
            target_cell = cell;
            target_index = cell_index;
          }
        });
      } else {
        target_index = Array.prototype.indexOf.call(cells, target_cell);
      }
      return {
        at: settings.axis.cells[Math.max(0, target_index)].start_at,
        ratio: canvas.clientWidth ? Math.max(0, Math.min(1, (target_cell.getBoundingClientRect().left + target_cell.getBoundingClientRect().width / 2 - canvas.getBoundingClientRect().left) / canvas.clientWidth)) : 0.5,
        viewport_offset_px: target_cell.getBoundingClientRect().left + target_cell.getBoundingClientRect().width / 2 - canvas.getBoundingClientRect().left,
        restore_focus: Boolean(focused_cell)
      };
    }

    /**
     * Restore an anchor by moving only the authoritative Timeline canvas.
     *
     * @param {Object} anchor Captured anchor state.
     * @return {number|null} Remaining error, or null without a rendered target.
     */
    function restore_axis_anchor(anchor) {
      var canvas = mount ? mount.querySelector('[data-wpbc-timeline-canvas]') : null;
      var header_cells = mount ? mount.querySelectorAll('[data-wpbc-timeline-axis-cell]') : [];
      var canvas_cells = canvas ? canvas.querySelectorAll('[data-wpbc-timeline-canvas-anchor-cell]') : [];
      var cells = canvas_cells.length ? canvas_cells : header_cells;
      var anchor_epoch = Math.floor(Date.parse(anchor.at) / 1000);
      var target_cell = null;
      var focus_cell = null;
      var target_start_epoch = 0;
      var target_end_epoch = 0;
      var remaining_error = null;
      Array.prototype.some.call(cells, function (cell) {
        var start_epoch = Number(cell.getAttribute('data-wpbc-timeline-cell-start'));
        var end_epoch = Number(cell.getAttribute('data-wpbc-timeline-cell-end'));
        if (anchor_epoch >= start_epoch && anchor_epoch < end_epoch) {
          target_cell = cell;
          target_start_epoch = start_epoch;
          target_end_epoch = end_epoch;
          return true;
        }
        return false;
      });
      if (!target_cell && cells.length) {
        target_cell = cells[0];
        target_start_epoch = Number(target_cell.getAttribute('data-wpbc-timeline-cell-start'));
        target_end_epoch = Number(target_cell.getAttribute('data-wpbc-timeline-cell-end'));
      }
      if (target_cell && canvas) {
        var canvas_rectangle;
        var cell_rectangle;
        var anchor_fraction;
        var has_viewport_offset = window.isFinite(Number(anchor.viewport_offset_px));
        var current_offset;
        var desired_offset;
        var physical_delta;
        synchronize_axis_scroll();
        canvas_rectangle = canvas.getBoundingClientRect();
        cell_rectangle = target_cell.getBoundingClientRect();
        anchor_fraction = Math.max(0, Math.min(1, (anchor_epoch - target_start_epoch) / Math.max(1, target_end_epoch - target_start_epoch)));
        current_offset = has_viewport_offset ? cell_rectangle.left + cell_rectangle.width / 2 - canvas_rectangle.left : settings.is_rtl ? cell_rectangle.right - cell_rectangle.width * anchor_fraction - canvas_rectangle.left : cell_rectangle.left + cell_rectangle.width * anchor_fraction - canvas_rectangle.left;
        if (has_viewport_offset) {
          desired_offset = Number(anchor.viewport_offset_px);
        } else if (0 <= Number(anchor.leading_cells_before)) {
          desired_offset = cell_rectangle.width * (Number(anchor.leading_cells_before) + anchor_fraction);
          if (settings.is_rtl) {
            desired_offset = canvas.clientWidth - desired_offset;
          }
        } else {
          desired_offset = canvas.clientWidth * Math.max(0, Math.min(1, Number(anchor.ratio) || 0.5));
        }
        physical_delta = current_offset - desired_offset;
        canvas.scrollLeft += settings.is_rtl ? -physical_delta : physical_delta;
        canvas_rectangle = canvas.getBoundingClientRect();
        cell_rectangle = target_cell.getBoundingClientRect();
        current_offset = has_viewport_offset ? cell_rectangle.left + cell_rectangle.width / 2 - canvas_rectangle.left : settings.is_rtl ? cell_rectangle.right - cell_rectangle.width * anchor_fraction - canvas_rectangle.left : cell_rectangle.left + cell_rectangle.width * anchor_fraction - canvas_rectangle.left;
        remaining_error = Math.abs(current_offset - desired_offset);
        if (anchor.restore_focus) {
          Array.prototype.some.call(header_cells, function (header_cell) {
            if (Number(header_cell.getAttribute('data-wpbc-timeline-cell-start')) === target_start_epoch) {
              focus_cell = header_cell;
              return true;
            }
            return false;
          });
          if (focus_cell) {
            focus_cell.setAttribute('tabindex', '0');
            try {
              focus_cell.focus({
                preventScroll: true
              });
            } catch (error) {
              focus_cell.focus();
            }
          }
        }
      }
      synchronize_axis_scroll();
      return remaining_error;
    }

    /**
     * Cancel an obsolete post-render anchor restoration.
     *
     * @return {void}
     */
    function cancel_anchor_restoration() {
      axis_anchor_restoration_generation += 1;
      if (axis_anchor_restoration_frame) {
        window.cancelAnimationFrame(axis_anchor_restoration_frame);
        axis_anchor_restoration_frame = 0;
      }
    }

    /**
     * Restore one post-render anchor after bounded layout settling.
     *
     * @param {Object} anchor Captured anchor state.
     * @param {Function} on_complete Completion callback.
     * @return {void}
     */
    function schedule_anchor_restoration(anchor, on_complete) {
      var restoration_generation;
      var attempt_count = 0;
      cancel_anchor_restoration();
      restoration_generation = axis_anchor_restoration_generation;
      function restore_after_layout() {
        var remaining_error;
        axis_anchor_restoration_frame = 0;
        if (restoration_generation !== axis_anchor_restoration_generation) {
          return;
        }
        attempt_count += 1;
        remaining_error = restore_axis_anchor(anchor);
        if (attempt_count < axis_anchor_restoration_maximum_attempts && (attempt_count < axis_anchor_restoration_minimum_attempts || null === remaining_error || remaining_error > axis_anchor_restoration_tolerance_px)) {
          axis_anchor_restoration_frame = window.requestAnimationFrame(restore_after_layout);
          return;
        }
        if ('function' === typeof on_complete) {
          on_complete();
        }
      }
      axis_anchor_restoration_frame = window.requestAnimationFrame(restore_after_layout);
    }

    /**
     * Build the canonical second-precision current-instant anchor.
     *
     * @return {Object} Current instant and restoration preferences.
     */
    function create_today_anchor() {
      var current_date = get_now();
      return {
        at: current_date.toISOString().slice(0, 19) + '+00:00',
        epoch: Math.floor(current_date.getTime() / 1000),
        leading_cells_before: 1,
        restore_focus: false
      };
    }

    /**
     * Resolve a strict site-local date from server cells already in cache.
     *
     * @param {string} iso_date Strict YYYY-MM-DD date.
     * @return {Object|null} Cached axis anchor, or null.
     */
    function create_loaded_date_anchor(iso_date) {
      var resolved_anchor = null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso_date || ''))) {
        return null;
      }
      get_ordered_window_entries().some(function (entry) {
        var cells = entry.payload.axis && Array.isArray(entry.payload.axis.cells) ? entry.payload.axis.cells : [];
        return cells.some(function (cell) {
          if (String(cell.date || '') !== iso_date) {
            return false;
          }
          resolved_anchor = {
            at: String(cell.start_at || ''),
            epoch: Number(cell.start_epoch),
            leading_cells_before: 1,
            restore_focus: false,
            target_date: iso_date
          };
          return true;
        });
      });
      return resolved_anchor;
    }

    /**
     * Resolve a requested date against one newly authorized axis.
     *
     * @param {Object} anchor Requested navigation anchor.
     * @param {Object} axis Server-authoritative axis DTO.
     * @return {boolean} True when resolved.
     */
    function resolve_response_date_anchor(anchor, axis) {
      var cells = axis && Array.isArray(axis.cells) ? axis.cells : [];
      var target_date = String(anchor && anchor.target_date ? anchor.target_date : '');
      var was_resolved = false;
      if (!target_date) {
        return false;
      }
      cells.some(function (cell) {
        if (String(cell.date || '') !== target_date) {
          return false;
        }
        anchor.at = String(cell.start_at || axis.start_at || anchor.at || '');
        anchor.epoch = Number(cell.start_epoch);
        was_resolved = true;
        return true;
      });
      return was_resolved;
    }

    /**
     * Determine whether an anchor is inside any authorized cached axis.
     *
     * @param {Object} anchor Timestamp anchor.
     * @return {boolean} True when loaded.
     */
    function is_anchor_loaded(anchor) {
      var anchor_epoch = anchor && window.isFinite(Number(anchor.epoch)) ? Number(anchor.epoch) : Math.floor(Date.parse(anchor && anchor.at ? anchor.at : '') / 1000);
      if (!window.isFinite(anchor_epoch)) {
        return false;
      }
      return get_ordered_window_entries().some(function (entry) {
        return anchor_epoch >= Number(entry.payload.axis.start_epoch) && anchor_epoch < Number(entry.payload.axis.end_epoch);
      });
    }

    /**
     * Return the server anchor ratio used by Today and selected-date reads.
     *
     * @return {number} Bounded server anchor ratio.
     */
    function get_today_request_anchor_ratio() {
      var window_days = Number(settings.window.window_days);
      if (0 < Number(settings.window.window_months) || 1 >= window_days) {
        return 0;
      }
      return Math.min(1, 1.5 / window_days);
    }

    /**
     * Resolve whether Today can use cache or needs an authorized read.
     *
     * @return {Object} Today anchor, ratio, and cache decision.
     */
    function resolve_today_navigation() {
      var anchor = create_today_anchor();
      var anchor_ratio = get_today_request_anchor_ratio();
      anchor.ratio = anchor_ratio;
      return {
        anchor: anchor,
        anchor_ratio: anchor_ratio,
        is_loaded: is_anchor_loaded(anchor)
      };
    }

    /**
     * Initialize this controller once.
     *
     * @return {void}
     */
    function initialize() {
      is_initialized = true;
    }

    /**
     * Abort owned requests and scheduled anchor work.
     *
     * @return {void}
     */
    function destroy() {
      if (!is_initialized) {
        return;
      }
      abort_foreground_request();
      abort_edge_requests();
      cancel_anchor_restoration();
      window_store = {
        current_key: '',
        resource_fingerprint: '',
        windows: {}
      };
      canvas_pointer_navigation_active = false;
      is_initialized = false;
    }
    return {
      initialize: initialize,
      destroy: destroy,
      get_loading_limits: get_loading_limits,
      get_ordered_window_entries: get_ordered_window_entries,
      get_selection_context_tokens: get_selection_context_tokens,
      get_resource_fingerprint: get_resource_fingerprint,
      reset: reset,
      replace_resource_context: replace_resource_context,
      cache_adjacent: cache_adjacent,
      trim: trim,
      compose: compose,
      map_timestamp_to_axis_position: map_timestamp_to_axis_position,
      get_composed_segment_geometry: get_composed_segment_geometry,
      get_edge_window_entry: get_edge_window_entry,
      promote_for_anchor: promote_for_anchor,
      get_edge_state: get_edge_state,
      suspend_adjacent_loading: suspend_adjacent_loading,
      activate_adjacent_intent: activate_adjacent_intent,
      set_pointer_navigation_active: set_pointer_navigation_active,
      update_edge_proximity: update_edge_proximity,
      abort_edge_requests: abort_edge_requests,
      begin_foreground_request: begin_foreground_request,
      set_foreground_request: set_foreground_request,
      is_foreground_generation_current: is_foreground_generation_current,
      complete_foreground_request: complete_foreground_request,
      abort_foreground_request: abort_foreground_request,
      begin_edge_request: begin_edge_request,
      set_edge_request: set_edge_request,
      is_edge_generation_current: is_edge_generation_current,
      get_edge_request: get_edge_request,
      schedule_edge_slow_state: schedule_edge_slow_state,
      mark_edge_error: mark_edge_error,
      mark_edge_loaded: mark_edge_loaded,
      prepare_edge_retry: prepare_edge_retry,
      complete_edge_request: complete_edge_request,
      cancel_edge_request: cancel_edge_request,
      capture_axis_anchor: capture_axis_anchor,
      restore_axis_anchor: restore_axis_anchor,
      cancel_anchor_restoration: cancel_anchor_restoration,
      schedule_anchor_restoration: schedule_anchor_restoration,
      create_today_anchor: create_today_anchor,
      create_loaded_date_anchor: create_loaded_date_anchor,
      resolve_response_date_anchor: resolve_response_date_anchor,
      is_anchor_loaded: is_anchor_loaded,
      get_today_request_anchor_ratio: get_today_request_anchor_ratio,
      resolve_today_navigation: resolve_today_navigation
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_window_cache_controller);
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9fb3V0L3RpbWVsaW5lLXdpbmRvdy1jYWNoZS5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwibW9kdWxlX2lkIiwicHJlc2VudGF0aW9uX2dlb21ldHJ5X2Vwc2lsb24iLCJjcmVhdGVfd2luZG93X2NhY2hlX2NvbnRyb2xsZXIiLCJjb250ZXh0Iiwic2V0dGluZ3MiLCJtb3VudCIsInN5bmNocm9uaXplX2F4aXNfc2Nyb2xsIiwiZ2V0X25vdyIsIkRhdGUiLCJ3aW5kb3dfc3RvcmUiLCJjdXJyZW50X2tleSIsInJlc291cmNlX2ZpbmdlcnByaW50IiwicmVzb3VyY2Vfb3JkZXIiLCJ3aW5kb3dzIiwiYWN0aXZlX3JlcXVlc3QiLCJyZXF1ZXN0X2dlbmVyYXRpb24iLCJlZGdlX3JlcXVlc3RzIiwicHJldmlvdXMiLCJuZXh0IiwiZWRnZV9yZXF1ZXN0X2dlbmVyYXRpb25zIiwiZWRnZV9zdGF0ZXMiLCJjcmVhdGVfaWRsZV9lZGdlX3N0YXRlIiwiY2FudmFzX3BvaW50ZXJfbmF2aWdhdGlvbl9hY3RpdmUiLCJheGlzX2FuY2hvcl9yZXN0b3JhdGlvbl9mcmFtZSIsImF4aXNfYW5jaG9yX3Jlc3RvcmF0aW9uX2dlbmVyYXRpb24iLCJheGlzX2FuY2hvcl9yZXN0b3JhdGlvbl9taW5pbXVtX2F0dGVtcHRzIiwiYXhpc19hbmNob3JfcmVzdG9yYXRpb25fbWF4aW11bV9hdHRlbXB0cyIsImF4aXNfYW5jaG9yX3Jlc3RvcmF0aW9uX3RvbGVyYW5jZV9weCIsImlzX2luaXRpYWxpemVkIiwic3RhdHVzIiwic2xvd190aW1lciIsImNvb2xkb3duX3VudGlsIiwiYXJtZWQiLCJ1c2VyX2ludGVudCIsInJlZW50cnlfcmVxdWlyZWQiLCJnZXRfbG9hZGluZ19saW1pdHMiLCJsaW1pdHMiLCJtZXRhZGF0YSIsIndpbmRvd19sb2FkaW5nIiwibWF4aW11bV9jYWNoZWRfd2luZG93cyIsIk1hdGgiLCJtYXgiLCJOdW1iZXIiLCJlZGdlX3BsYWNlaG9sZGVyX2NlbGxzIiwiZWRnZV9wcmVmZXRjaF9wZXJjZW50IiwibWluIiwiZWRnZV9yZWFybV9wZXJjZW50IiwicmVxdWVzdF9jb29sZG93bl9tcyIsInNsb3dfbG9hZGluZ19tcyIsInJlcXVlc3RfdGltZW91dF9tcyIsIm5vcm1hbGl6ZV93aW5kb3dfcGF5bG9hZCIsInJlc3BvbnNlIiwiYXhpcyIsInJlc291cmNlcyIsIkFycmF5IiwiaXNBcnJheSIsInNlZ21lbnRzIiwib2NjdXBhbmN5IiwidGltZV9zbG90X292ZXJmbG93cyIsInByZWZlcmVuY2VzIiwicmVzb3VyY2VfdmlldyIsInJlc291cmNlX3BhZ2luYXRpb24iLCJ3aW5kb3dfY29udGV4dCIsInZpZXdfcG9saWN5IiwiZGlhZ25vc3RpY3MiLCJnZXRfd2luZG93X2tleSIsInBheWxvYWQiLCJ3aW5kb3dfa2V5IiwiU3RyaW5nIiwic3RhcnRfYXQiLCJlbmRfYXQiLCJ2aWV3Iiwiam9pbiIsImdldF9vcmRlcmVkX3dpbmRvd19lbnRyaWVzIiwiT2JqZWN0Iiwia2V5cyIsIm1hcCIsImtleSIsInNvcnQiLCJsZWZ0X2VudHJ5IiwicmlnaHRfZW50cnkiLCJzdGFydF9lcG9jaCIsImdldF9zZWxlY3Rpb25fY29udGV4dF90b2tlbnMiLCJlbnRyeSIsInNlbGVjdGlvbl90b2tlbiIsImZpbHRlciIsInRva2VuIiwiQm9vbGVhbiIsInNsaWNlIiwiYWJvcnRfZWRnZV9yZXF1ZXN0cyIsImZvckVhY2giLCJkaXJlY3Rpb24iLCJzdGF0ZSIsImFib3J0IiwiY2xlYXJUaW1lb3V0IiwicmVzZXQiLCJyZXNvdXJjZSIsImlkIiwicmVzb3VyY2VfaWQiLCJpc0ludGVnZXIiLCJyZXBsYWNlX3Jlc291cmNlX2NvbnRleHQiLCJjdXJyZW50X3Jlc3BvbnNlIiwiYWRqYWNlbnRfcmVzcG9uc2VzIiwiY3VycmVudF9wYXlsb2FkIiwiY2FuZGlkYXRlX3dpbmRvd3MiLCJjYW5kaWRhdGVfcGF5bG9hZHMiLCJpc192YWxpZCIsImxlbmd0aCIsImdldF9yZXNvdXJjZV9maW5nZXJwcmludCIsImNhY2hlX2FkamFjZW50IiwidHJpbSIsImVudHJpZXMiLCJjdXJyZW50X2luZGV4IiwiY2hhbmdlZCIsInNvbWUiLCJlbnRyeV9pbmRleCIsImZpcnN0X2Rpc3RhbmNlIiwiYWJzIiwibGFzdF9kaXN0YW5jZSIsInJlbW92ZV9pbmRleCIsInNwbGljZSIsIm1hcF90aW1lc3RhbXBfdG9fYXhpc19wb3NpdGlvbiIsInRpbWVzdGFtcCIsImNlbGxzIiwicG9zaXRpb24iLCJwcm90b3R5cGUiLCJjYWxsIiwiY2VsbCIsImNlbGxfaW5kZXgiLCJlbmRfZXBvY2giLCJnZXRfY29tcG9zZWRfc2VnbWVudF9nZW9tZXRyeSIsImNlbGxfY291bnQiLCJzdGFydF91bml0cyIsImVuZF91bml0cyIsInZpc3VhbF9zdGFydCIsImZsb29yIiwidmlzdWFsX2VuZCIsImNlaWwiLCJvZmZzZXRfcGVyY2VudCIsIndpZHRoX3BlcmNlbnQiLCJ2aXN1YWxfb2Zmc2V0X3BlcmNlbnQiLCJ2aXN1YWxfd2lkdGhfcGVyY2VudCIsImdldF9jb21wb3NlZF9wcmVzZW50YXRpb25fZ2VvbWV0cnkiLCJnZW9tZXRyeSIsImlzX2Z1bGxfZGF5IiwiaXNfZGF5X3RpbWVfc2xvdCIsInVzZV9jb21wbGV0ZV9jZWxscyIsInByZXNlbnRhdGlvbl9vZmZzZXRfcGVyY2VudCIsInByZXNlbnRhdGlvbl93aWR0aF9wZXJjZW50IiwiY29tcG9zZV9jYWNoZWRfYXhpcyIsImNlbGxfbWFwIiwibW9udGhfYmFuZHMiLCJkYXRlX2JhbmRzIiwibW9udGhfbWFwIiwiZGF0ZV9tYXAiLCJkYXRlX21ldGFkYXRhX2J5X2tleSIsImN1cnJlbnRfbWFya2VyIiwiYXNzaWduIiwiY3VycmVudF90aW1lX21hcmtlciIsIm5vd19lcG9jaCIsImdldFRpbWUiLCJkYXRlX2JhbmQiLCJkYXRlX2tleSIsImRhdGUiLCJjZWxsX2tleSIsInB1c2giLCJsZWZ0X2NlbGwiLCJyaWdodF9jZWxsIiwibW9udGhfa2V5Iiwic3Vic3RyaW5nIiwiZGF0ZV9tZXRhZGF0YSIsImluZGV4IiwibGFiZWwiLCJtb250aF9sYWJlbCIsInNwYW4iLCJ3ZWVrZGF5IiwiZGF5X251bWJlciIsInRvZGF5X2xhYmVsIiwiaXNfdG9kYXkiLCJpc193ZWVrZW5kIiwiZWxhcHNlZF9taW51dGVzIiwid2FsbF9taW51dGVzIiwidXRjX29mZnNldF9zdGFydF9zZWNvbmRzIiwidXRjX29mZnNldF9lbmRfc2Vjb25kcyIsInRyYW5zaXRpb25zIiwidHJhbnNpdGlvbiIsImlzX3Zpc2libGUiLCJpc190aW1lZCIsInBvc2l0aW9uX3BlcmNlbnQiLCJhc3NpZ25fY29tcG9zZWRfc2VnbWVudF9sYW5lcyIsImJ5X3Jlc291cmNlIiwibGFuZV9jb3VudHMiLCJzZWdtZW50Iiwic2VnbWVudF9pbmRleCIsImlzX3RpbWVfc2xvdF9vdmVyZmxvd19pdGVtIiwibGFuZV9pbmRleCIsInR5cGUiLCJzdGFydCIsImVuZCIsInNvcnRfb3JkZXIiLCJzZWdtZW50X2lkIiwib3ZlcmZsb3ciLCJvdmVyZmxvd19pbmRleCIsIm92ZXJmbG93X2lkIiwibGFuZV9lbmRzIiwibG9jYWxlQ29tcGFyZSIsImJ1aWxkX2NvbXBvc2VkX3RpbWVfc2xvdF9vdmVyZmxvd3MiLCJtYXhpbXVtX3Zpc2libGVfc2xvdHMiLCJncm91cHMiLCJvdmVyZmxvd3MiLCJ0aW1lX3Nsb3RfZ3JvdXBfa2V5IiwiZ3JvdXBfa2V5IiwiZ3JvdXBfc2VnbWVudHMiLCJsZWZ0X3NlZ21lbnQiLCJyaWdodF9zZWdtZW50IiwicGFyc2UiLCJoaWRkZW5fc2VnbWVudHMiLCJmaXJzdF9zZWdtZW50IiwiY291bnRfdGV4dCIsImRhdGVfbGFiZWwiLCJ2aXNpYmxlX3Nsb3RfbGltaXQiLCJncm91cF9pbmRleCIsInRpbWVfc2xvdF9ncm91cF9pbmRleCIsInRpbWVfc2xvdF9kYXRlX2xhYmVsIiwidGltZV9zbG90X2RhdGUiLCJyZXBsYWNlIiwiaGlkZGVuX2NvdW50IiwibW9yZV9sYWJlbCIsImkxOG4iLCJ0aW1lX3Nsb3RfbW9yZSIsImFyaWFfbGFiZWwiLCJ0aW1lX3Nsb3RfbW9yZV9sYWJlbCIsImhlYWRpbmciLCJ0aW1lX3Nsb3RfbW9yZV9oZWFkaW5nIiwiaXRlbXMiLCJib29raW5nX2lkIiwidGltZV9sYWJlbCIsInRpbWVfc2xvdF90aW1lX2xhYmVsIiwiZHVyYXRpb25fbGFiZWwiLCJjb21wb3NlX3Byb2plY3RlZF9yZWNvcmRzIiwiY29sbGVjdGlvbl9rZXkiLCJyZWNvcmRfbWFwIiwicmVjb3JkcyIsInNvdXJjZV9yZWNvcmQiLCJyZWNvcmRfa2V5IiwidmlzaWJsZV9zdGFydF9lcG9jaCIsInZpc2libGVfZW5kX2Vwb2NoIiwidmlzaWJsZV9zdGFydCIsInZpc2libGVfZW5kIiwicHJlc2VudGF0aW9uX2dlb21ldHJ5IiwicmVjb3JkIiwiaXNfY2xpcHBlZF9zdGFydCIsImlzX2NsaXBwZWRfZW5kIiwiaXNfY29tcGFjdCIsIm9yZGVyX3Jlc291cmNlcyIsInJlc291cmNlc19ieV9pZCIsImNyZWF0ZSIsIm9yZGVyZWRfcmVzb3VyY2VzIiwiY29tcG9zZSIsImxhbmVfY291bnQiLCJjdXJyZW50IiwiZ2V0X2VkZ2Vfd2luZG93X2VudHJ5IiwiaW5kZXhPZiIsInByb21vdGVfZm9yX2FuY2hvciIsImFuY2hvciIsImFuY2hvcl9lcG9jaCIsImF0IiwicHJvbW90ZWRfZW50cnkiLCJ0cmltbWVkIiwiZ2V0X2VkZ2Vfc3RhdGUiLCJzdXNwZW5kX2FkamFjZW50X2xvYWRpbmciLCJhY3RpdmF0ZV9hZGphY2VudF9pbnRlbnQiLCJmb3JjZSIsInNldF9wb2ludGVyX25hdmlnYXRpb25fYWN0aXZlIiwiaXNfYWN0aXZlIiwidXBkYXRlX2VkZ2VfcHJveGltaXR5IiwiaXNfbmVhcl9yZWFybSIsImlzX25lYXJfcHJlZmV0Y2giLCJiZWdpbl9mb3JlZ3JvdW5kX3JlcXVlc3QiLCJyZXF1ZXN0X3RvX2Fib3J0Iiwic2V0X2ZvcmVncm91bmRfcmVxdWVzdCIsImdlbmVyYXRpb24iLCJyZXF1ZXN0IiwiaXNfZm9yZWdyb3VuZF9nZW5lcmF0aW9uX2N1cnJlbnQiLCJjb21wbGV0ZV9mb3JlZ3JvdW5kX3JlcXVlc3QiLCJhYm9ydF9mb3JlZ3JvdW5kX3JlcXVlc3QiLCJiZWdpbl9lZGdlX3JlcXVlc3QiLCJhbGxvd193aXRob3V0X3VzZXJfaW50ZW50Iiwic2V0X2VkZ2VfcmVxdWVzdCIsImlzX2VkZ2VfZ2VuZXJhdGlvbl9jdXJyZW50IiwiZ2V0X2VkZ2VfcmVxdWVzdCIsInNjaGVkdWxlX2VkZ2Vfc2xvd19zdGF0ZSIsIm9uX3Nsb3ciLCJzZXRUaW1lb3V0IiwibWFya19lZGdlX2Vycm9yIiwibm93IiwibWFya19lZGdlX2xvYWRlZCIsInByZXBhcmVfZWRnZV9yZXRyeSIsImNvbXBsZXRlX2VkZ2VfcmVxdWVzdCIsImNhbmNlbF9lZGdlX3JlcXVlc3QiLCJjYXB0dXJlX2F4aXNfYW5jaG9yIiwiY2FudmFzIiwicXVlcnlTZWxlY3RvciIsImZvY3VzZWRfY2VsbCIsImFjdGl2ZUVsZW1lbnQiLCJjbG9zZXN0IiwicXVlcnlTZWxlY3RvckFsbCIsInRhcmdldF9jZWxsIiwidGFyZ2V0X2luZGV4IiwiY2VudGVyX3giLCJjbG9zZXN0X2Rpc3RhbmNlIiwiSW5maW5pdHkiLCJyYXRpbyIsInJlc3RvcmVfZm9jdXMiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJsZWZ0IiwiY2xpZW50V2lkdGgiLCJyZWN0YW5nbGUiLCJkaXN0YW5jZSIsIndpZHRoIiwidmlld3BvcnRfb2Zmc2V0X3B4IiwicmVzdG9yZV9heGlzX2FuY2hvciIsImhlYWRlcl9jZWxscyIsImNhbnZhc19jZWxscyIsImZvY3VzX2NlbGwiLCJ0YXJnZXRfc3RhcnRfZXBvY2giLCJ0YXJnZXRfZW5kX2Vwb2NoIiwicmVtYWluaW5nX2Vycm9yIiwiZ2V0QXR0cmlidXRlIiwiY2FudmFzX3JlY3RhbmdsZSIsImNlbGxfcmVjdGFuZ2xlIiwiYW5jaG9yX2ZyYWN0aW9uIiwiaGFzX3ZpZXdwb3J0X29mZnNldCIsImlzRmluaXRlIiwiY3VycmVudF9vZmZzZXQiLCJkZXNpcmVkX29mZnNldCIsInBoeXNpY2FsX2RlbHRhIiwiaXNfcnRsIiwicmlnaHQiLCJsZWFkaW5nX2NlbGxzX2JlZm9yZSIsInNjcm9sbExlZnQiLCJoZWFkZXJfY2VsbCIsInNldEF0dHJpYnV0ZSIsImZvY3VzIiwicHJldmVudFNjcm9sbCIsImVycm9yIiwiY2FuY2VsX2FuY2hvcl9yZXN0b3JhdGlvbiIsImNhbmNlbEFuaW1hdGlvbkZyYW1lIiwic2NoZWR1bGVfYW5jaG9yX3Jlc3RvcmF0aW9uIiwib25fY29tcGxldGUiLCJyZXN0b3JhdGlvbl9nZW5lcmF0aW9uIiwiYXR0ZW1wdF9jb3VudCIsInJlc3RvcmVfYWZ0ZXJfbGF5b3V0IiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwiY3JlYXRlX3RvZGF5X2FuY2hvciIsImN1cnJlbnRfZGF0ZSIsInRvSVNPU3RyaW5nIiwiZXBvY2giLCJjcmVhdGVfbG9hZGVkX2RhdGVfYW5jaG9yIiwiaXNvX2RhdGUiLCJyZXNvbHZlZF9hbmNob3IiLCJ0ZXN0IiwidGFyZ2V0X2RhdGUiLCJyZXNvbHZlX3Jlc3BvbnNlX2RhdGVfYW5jaG9yIiwid2FzX3Jlc29sdmVkIiwiaXNfYW5jaG9yX2xvYWRlZCIsImdldF90b2RheV9yZXF1ZXN0X2FuY2hvcl9yYXRpbyIsIndpbmRvd19kYXlzIiwid2luZG93X21vbnRocyIsInJlc29sdmVfdG9kYXlfbmF2aWdhdGlvbiIsImFuY2hvcl9yYXRpbyIsImlzX2xvYWRlZCIsImluaXRpYWxpemUiLCJkZXN0cm95Iiwid3BiY190aW1lbGluZV9tb2R1bGVzIiwicmVnaXN0ZXJfZmFjdG9yeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtdGltZWxpbmUvX3NyYy90aW1lbGluZS13aW5kb3ctY2FjaGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaW1lbGluZSBib3VuZGVkLXdpbmRvdyBjYWNoZSwgcmVxdWVzdCBvd25lcnNoaXAsIGFuZCBhbmNob3IgY29udHJvbGxlci5cbiAqXG4gKiBUaGUgc2VydmVyIHJlbWFpbnMgYXV0aG9yaXRhdGl2ZSBmb3IgZXZlcnkgd2luZG93LCBheGlzLCBSZXNvdXJjZSwgYm9va2luZyxcbiAqIGFuZCBvY2N1cGFuY3kgRFRPLiBUaGlzIGNvbnRyb2xsZXIgb3ducyBvbmx5IGJyb3dzZXItc2lkZSBjb21wb3NpdGlvbiBvZiB0aGVcbiAqIHByZXZpb3VzL2N1cnJlbnQvbmV4dCBhdXRob3JpemVkIHJlc3BvbnNlcywgc3RhbGUgcmVxdWVzdCBnZW5lcmF0aW9ucywgZWRnZVxuICogcmVhcm1pbmcsIGNhY2hlZCBUb2RheS9kYXRlIHJlc29sdXRpb24sIGFuZCBwaHlzaWNhbCBjYW52YXMgYW5jaG9yIHJlc3RvcmUuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICogQHNpbmNlICAgMTIuMC4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIG1vZHVsZV9pZCA9ICd3aW5kb3dfY2FjaGUnO1xuXHQvKipcblx0ICogTWF4aW11bSBoYXJtbGVzcyByb3VuZGluZyBkcmlmdCBiZXR3ZWVuIGFkamFjZW50IHBlcmNlbnRhZ2UgYm91bmRhcmllcy5cblx0ICpcblx0ICogUGVyY2VudGFnZSBzdGFydHMgYW5kIHdpZHRocyBhcmUgY2FsY3VsYXRlZCBpbmRlcGVuZGVudGx5LiBUaGlzIHRvbGVyYW5jZVxuXHQgKiBwcmV2ZW50cyBiaW5hcnkgcmVzaWR1ZSBmcm9tIHR1cm5pbmcgb25lIHNoYXJlZCBoYWxmLW9wZW4gYm91bmRhcnkgaW50byBhXG5cdCAqIHZpc3VhbCBjb2xsaXNpb24gd2hpbGUgcmVtYWluaW5nIGZhciBiZWxvdyB0aGUgbmFycm93ZXN0IHN1cHBvcnRlZCBjZWxsLlxuXHQgKlxuXHQgKiBAdHlwZSB7bnVtYmVyfVxuXHQgKi9cblx0dmFyIHByZXNlbnRhdGlvbl9nZW9tZXRyeV9lcHNpbG9uID0gMC4wMDAwMDAxO1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIGJvdW5kZWQgVGltZWxpbmUgd2luZG93L2NhY2hlIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IENvbnRyb2xsZXItb3duZWQgc2V0dGluZ3MsIG1vdW50LCBhbmQgc2Nyb2xsIGNhbGxiYWNrLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFdpbmRvdy9jYWNoZSBsaWZlY3ljbGUgYW5kIHN0YXRlLW1hY2hpbmUgQVBJLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX3dpbmRvd19jYWNoZV9jb250cm9sbGVyKCBjb250ZXh0ICkge1xuXHRcdHZhciBzZXR0aW5ncyA9IGNvbnRleHQuc2V0dGluZ3MgfHwge307XG5cdFx0dmFyIG1vdW50ID0gY29udGV4dC5tb3VudCB8fCBudWxsO1xuXHRcdHZhciBzeW5jaHJvbml6ZV9heGlzX3Njcm9sbCA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LnN5bmNocm9uaXplX2F4aXNfc2Nyb2xsID8gY29udGV4dC5zeW5jaHJvbml6ZV9heGlzX3Njcm9sbCA6IGZ1bmN0aW9uICgpIHt9O1xuXHRcdHZhciBnZXRfbm93ID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQuZ2V0X25vdyA/IGNvbnRleHQuZ2V0X25vdyA6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBuZXcgRGF0ZSgpO1xuXHRcdH07XG5cdFx0dmFyIHdpbmRvd19zdG9yZSA9IHtcblx0XHRcdGN1cnJlbnRfa2V5OiAnJyxcblx0XHRcdHJlc291cmNlX2ZpbmdlcnByaW50OiAnJyxcblx0XHRcdHJlc291cmNlX29yZGVyOiBbXSxcblx0XHRcdHdpbmRvd3M6IHt9XG5cdFx0fTtcblx0XHR2YXIgYWN0aXZlX3JlcXVlc3QgPSBudWxsO1xuXHRcdHZhciByZXF1ZXN0X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBlZGdlX3JlcXVlc3RzID0ge1xuXHRcdFx0cHJldmlvdXM6IG51bGwsXG5cdFx0XHRuZXh0OiBudWxsXG5cdFx0fTtcblx0XHR2YXIgZWRnZV9yZXF1ZXN0X2dlbmVyYXRpb25zID0ge1xuXHRcdFx0cHJldmlvdXM6IDAsXG5cdFx0XHRuZXh0OiAwXG5cdFx0fTtcblx0XHR2YXIgZWRnZV9zdGF0ZXMgPSB7XG5cdFx0XHRwcmV2aW91czogY3JlYXRlX2lkbGVfZWRnZV9zdGF0ZSgpLFxuXHRcdFx0bmV4dDogY3JlYXRlX2lkbGVfZWRnZV9zdGF0ZSgpXG5cdFx0fTtcblx0XHR2YXIgY2FudmFzX3BvaW50ZXJfbmF2aWdhdGlvbl9hY3RpdmUgPSBmYWxzZTtcblx0XHR2YXIgYXhpc19hbmNob3JfcmVzdG9yYXRpb25fZnJhbWUgPSAwO1xuXHRcdHZhciBheGlzX2FuY2hvcl9yZXN0b3JhdGlvbl9nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgYXhpc19hbmNob3JfcmVzdG9yYXRpb25fbWluaW11bV9hdHRlbXB0cyA9IDI7XG5cdFx0dmFyIGF4aXNfYW5jaG9yX3Jlc3RvcmF0aW9uX21heGltdW1fYXR0ZW1wdHMgPSA0O1xuXHRcdHZhciBheGlzX2FuY2hvcl9yZXN0b3JhdGlvbl90b2xlcmFuY2VfcHggPSAxO1xuXHRcdHZhciBpc19pbml0aWFsaXplZCA9IGZhbHNlO1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGEgZnJlc2ggaWRsZSBlZGdlIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBNdXRhYmxlIGVkZ2Ugc3RhdGUgb3duZWQgYnkgdGhpcyBpbnN0YW5jZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjcmVhdGVfaWRsZV9lZGdlX3N0YXRlKCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c3RhdHVzOiAnaWRsZScsXG5cdFx0XHRcdHNsb3dfdGltZXI6IDAsXG5cdFx0XHRcdGNvb2xkb3duX3VudGlsOiAwLFxuXHRcdFx0XHRhcm1lZDogZmFsc2UsXG5cdFx0XHRcdHVzZXJfaW50ZW50OiBmYWxzZSxcblx0XHRcdFx0cmVlbnRyeV9yZXF1aXJlZDogZmFsc2Vcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIFRpbWVsaW5lIGFkamFjZW50LWxvYWRpbmcgbGltaXRzIHdpdGggYm91bmRlZCBmYWxsYmFja3MuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IE5vcm1hbGl6ZWQgbG9hZGluZyBsaW1pdHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2xvYWRpbmdfbGltaXRzKCkge1xuXHRcdFx0dmFyIGxpbWl0cyA9IHNldHRpbmdzLm1ldGFkYXRhICYmIHNldHRpbmdzLm1ldGFkYXRhLndpbmRvd19sb2FkaW5nID8gc2V0dGluZ3MubWV0YWRhdGEud2luZG93X2xvYWRpbmcgOiB7fTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bWF4aW11bV9jYWNoZWRfd2luZG93czogTWF0aC5tYXgoIDEsIE51bWJlciggbGltaXRzLm1heGltdW1fY2FjaGVkX3dpbmRvd3MgKSB8fCAzICksXG5cdFx0XHRcdGVkZ2VfcGxhY2Vob2xkZXJfY2VsbHM6IE1hdGgubWF4KCAxLCBOdW1iZXIoIGxpbWl0cy5lZGdlX3BsYWNlaG9sZGVyX2NlbGxzICkgfHwgMyApLFxuXHRcdFx0XHRlZGdlX3ByZWZldGNoX3BlcmNlbnQ6IE1hdGgubWF4KCAxLCBNYXRoLm1pbiggNDksIE51bWJlciggbGltaXRzLmVkZ2VfcHJlZmV0Y2hfcGVyY2VudCApIHx8IDE4ICkgKSxcblx0XHRcdFx0ZWRnZV9yZWFybV9wZXJjZW50OiBNYXRoLm1heCggMSwgTWF0aC5taW4oIDkwLCBOdW1iZXIoIGxpbWl0cy5lZGdlX3JlYXJtX3BlcmNlbnQgKSB8fCAzMiApICksXG5cdFx0XHRcdHJlcXVlc3RfY29vbGRvd25fbXM6IE1hdGgubWF4KCAwLCBOdW1iZXIoIGxpbWl0cy5yZXF1ZXN0X2Nvb2xkb3duX21zICkgfHwgNDAwICksXG5cdFx0XHRcdHNsb3dfbG9hZGluZ19tczogTWF0aC5tYXgoIDAsIE51bWJlciggbGltaXRzLnNsb3dfbG9hZGluZ19tcyApIHx8IDMwMDAgKSxcblx0XHRcdFx0cmVxdWVzdF90aW1lb3V0X21zOiBNYXRoLm1heCggMTAwMCwgTnVtYmVyKCBsaW1pdHMucmVxdWVzdF90aW1lb3V0X21zICkgfHwgMTUwMDAgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgb25lIGF1dGhvcml6ZWQgc2VydmVyIHJlc3BvbnNlIGZvciBib3VuZGVkIGJyb3dzZXIgc3RvcmFnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBBdXRob3JpemVkIHdpbmRvdyByZXNwb25zZS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IENhY2hlIHBheWxvYWQgY29udGFpbmluZyBKU09OLXNhZmUgRFRPIGNvbGxlY3Rpb25zLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV93aW5kb3dfcGF5bG9hZCggcmVzcG9uc2UgKSB7XG5cdFx0XHRyZXNwb25zZSA9IHJlc3BvbnNlIHx8IHt9O1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR3aW5kb3c6IHJlc3BvbnNlLndpbmRvdyB8fCB7fSxcblx0XHRcdFx0YXhpczogcmVzcG9uc2UuYXhpcyB8fCB7fSxcblx0XHRcdFx0cmVzb3VyY2VzOiBBcnJheS5pc0FycmF5KCByZXNwb25zZS5yZXNvdXJjZXMgKSA/IHJlc3BvbnNlLnJlc291cmNlcyA6IFtdLFxuXHRcdFx0XHRzZWdtZW50czogQXJyYXkuaXNBcnJheSggcmVzcG9uc2Uuc2VnbWVudHMgKSA/IHJlc3BvbnNlLnNlZ21lbnRzIDogW10sXG5cdFx0XHRcdG9jY3VwYW5jeTogQXJyYXkuaXNBcnJheSggcmVzcG9uc2Uub2NjdXBhbmN5ICkgPyByZXNwb25zZS5vY2N1cGFuY3kgOiBbXSxcblx0XHRcdFx0dGltZV9zbG90X292ZXJmbG93czogQXJyYXkuaXNBcnJheSggcmVzcG9uc2UudGltZV9zbG90X292ZXJmbG93cyApID8gcmVzcG9uc2UudGltZV9zbG90X292ZXJmbG93cyA6IFtdLFxuXHRcdFx0XHRwcmVmZXJlbmNlczogcmVzcG9uc2UucHJlZmVyZW5jZXMgfHwge30sXG5cdFx0XHRcdHJlc291cmNlX3ZpZXc6IHJlc3BvbnNlLnJlc291cmNlX3ZpZXcgfHwge30sXG5cdFx0XHRcdHJlc291cmNlX3BhZ2luYXRpb246IHJlc3BvbnNlLnJlc291cmNlX3BhZ2luYXRpb24gfHwge30sXG5cdFx0XHRcdHdpbmRvd19jb250ZXh0OiByZXNwb25zZS53aW5kb3dfY29udGV4dCB8fCB7fSxcblx0XHRcdFx0dmlld19wb2xpY3k6IHJlc3BvbnNlLnZpZXdfcG9saWN5IHx8IHt9LFxuXHRcdFx0XHRkaWFnbm9zdGljczogcmVzcG9uc2UuZGlhZ25vc3RpY3MgfHwge31cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzZXJ2ZXIga2V5IG9yIGEgY29tcGF0aWJpbGl0eSBrZXkgZm9yIGFuIG9sZGVyIHJlc3BvbnNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHBheWxvYWQgTm9ybWFsaXplZCB3aW5kb3cgcGF5bG9hZC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFN0YWJsZSBjYWNoZSBrZXkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3dpbmRvd19rZXkoIHBheWxvYWQgKSB7XG5cdFx0XHRpZiAoIHBheWxvYWQud2luZG93X2NvbnRleHQgJiYgcGF5bG9hZC53aW5kb3dfY29udGV4dC53aW5kb3dfa2V5ICkge1xuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBwYXlsb2FkLndpbmRvd19jb250ZXh0LndpbmRvd19rZXkgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIFsgcGF5bG9hZC5heGlzLnN0YXJ0X2F0IHx8ICcnLCBwYXlsb2FkLmF4aXMuZW5kX2F0IHx8ICcnLCBwYXlsb2FkLmF4aXMudmlldyB8fCAnJyBdLmpvaW4oICd8JyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBjYWNoZWQgd2luZG93cyBvcmRlcmVkIGJ5IHRoZWlyIHNlcnZlciBzdGFydCBlcG9jaC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IE9yZGVyZWQgYHsga2V5LCBwYXlsb2FkIH1gIGVudHJpZXMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X29yZGVyZWRfd2luZG93X2VudHJpZXMoKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmtleXMoIHdpbmRvd19zdG9yZS53aW5kb3dzICkubWFwKCBmdW5jdGlvbiAoIHdpbmRvd19rZXkgKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0a2V5OiB3aW5kb3dfa2V5LFxuXHRcdFx0XHRcdHBheWxvYWQ6IHdpbmRvd19zdG9yZS53aW5kb3dzWyB3aW5kb3dfa2V5IF1cblx0XHRcdFx0fTtcblx0XHRcdH0gKS5zb3J0KCBmdW5jdGlvbiAoIGxlZnRfZW50cnksIHJpZ2h0X2VudHJ5ICkge1xuXHRcdFx0XHRyZXR1cm4gTnVtYmVyKCBsZWZ0X2VudHJ5LnBheWxvYWQuYXhpcy5zdGFydF9lcG9jaCApIC0gTnVtYmVyKCByaWdodF9lbnRyeS5wYXlsb2FkLmF4aXMuc3RhcnRfZXBvY2ggKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gc2lnbmVkIHNlbGVjdGlvbiB0b2tlbnMgZnJvbSB0aGUgYm91bmRlZCBhdXRob3JpemVkIGNhY2hlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7QXJyYXk8c3RyaW5nPn0gQXQgbW9zdCB0aGUgY29uZmlndXJlZCBjYWNoZSBjb3VudCBvZiB0b2tlbnMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGlvbl9jb250ZXh0X3Rva2VucygpIHtcblx0XHRcdHJldHVybiBnZXRfb3JkZXJlZF93aW5kb3dfZW50cmllcygpLm1hcCggZnVuY3Rpb24gKCBlbnRyeSApIHtcblx0XHRcdFx0cmV0dXJuIGVudHJ5LnBheWxvYWQud2luZG93X2NvbnRleHQgJiYgZW50cnkucGF5bG9hZC53aW5kb3dfY29udGV4dC5zZWxlY3Rpb25fdG9rZW5cblx0XHRcdFx0XHQ/IFN0cmluZyggZW50cnkucGF5bG9hZC53aW5kb3dfY29udGV4dC5zZWxlY3Rpb25fdG9rZW4gKVxuXHRcdFx0XHRcdDogJyc7XG5cdFx0XHR9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIHRva2VuICkge1xuXHRcdFx0XHRyZXR1cm4gQm9vbGVhbiggdG9rZW4gKTtcblx0XHRcdH0gKS5zbGljZSggMCwgZ2V0X2xvYWRpbmdfbGltaXRzKCkubWF4aW11bV9jYWNoZWRfd2luZG93cyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFib3J0IGJvdGggYWRqYWNlbnQgcmVxdWVzdHMgYW5kIGludmFsaWRhdGUgdGhlaXIgbGF0ZSBjYWxsYmFja3MuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFib3J0X2VkZ2VfcmVxdWVzdHMoKSB7XG5cdFx0XHRbICdwcmV2aW91cycsICduZXh0JyBdLmZvckVhY2goIGZ1bmN0aW9uICggZGlyZWN0aW9uICkge1xuXHRcdFx0XHR2YXIgc3RhdGUgPSBlZGdlX3N0YXRlc1sgZGlyZWN0aW9uIF07XG5cblx0XHRcdFx0aWYgKCBlZGdlX3JlcXVlc3RzWyBkaXJlY3Rpb24gXSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZWRnZV9yZXF1ZXN0c1sgZGlyZWN0aW9uIF0uYWJvcnQgKSB7XG5cdFx0XHRcdFx0ZWRnZV9yZXF1ZXN0c1sgZGlyZWN0aW9uIF0uYWJvcnQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlZGdlX3JlcXVlc3RzWyBkaXJlY3Rpb24gXSA9IG51bGw7XG5cdFx0XHRcdGVkZ2VfcmVxdWVzdF9nZW5lcmF0aW9uc1sgZGlyZWN0aW9uIF0gKz0gMTtcblx0XHRcdFx0aWYgKCBzdGF0ZS5zbG93X3RpbWVyICkge1xuXHRcdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHN0YXRlLnNsb3dfdGltZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlZGdlX3N0YXRlc1sgZGlyZWN0aW9uIF0gPSBjcmVhdGVfaWRsZV9lZGdlX3N0YXRlKCk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzZXQgdGhlIGJvdW5kZWQgY2FjaGUgYXJvdW5kIG9uZSBhdXRob3JpdGF0aXZlIGN1cnJlbnQgcmVzcG9uc2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgQXV0aG9yaXplZCB3aW5kb3cgcmVzcG9uc2UuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBOb3JtYWxpemVkIGN1cnJlbnQgcGF5bG9hZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNldCggcmVzcG9uc2UgKSB7XG5cdFx0XHR2YXIgcGF5bG9hZCA9IG5vcm1hbGl6ZV93aW5kb3dfcGF5bG9hZCggcmVzcG9uc2UgKTtcblx0XHRcdHZhciB3aW5kb3dfa2V5ID0gZ2V0X3dpbmRvd19rZXkoIHBheWxvYWQgKTtcblxuXHRcdFx0YWJvcnRfZWRnZV9yZXF1ZXN0cygpO1xuXHRcdFx0d2luZG93X3N0b3JlID0ge1xuXHRcdFx0XHRjdXJyZW50X2tleTogd2luZG93X2tleSxcblx0XHRcdFx0cmVzb3VyY2VfZmluZ2VycHJpbnQ6IFN0cmluZyggcGF5bG9hZC53aW5kb3dfY29udGV4dC5yZXNvdXJjZV9maW5nZXJwcmludCB8fCAnJyApLFxuXHRcdFx0XHRyZXNvdXJjZV9vcmRlcjogcGF5bG9hZC5yZXNvdXJjZXMubWFwKCBmdW5jdGlvbiAoIHJlc291cmNlICkge1xuXHRcdFx0XHRcdHJldHVybiBOdW1iZXIoIHJlc291cmNlICYmIHJlc291cmNlLmlkICk7XG5cdFx0XHRcdH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIE51bWJlci5pc0ludGVnZXIoIHJlc291cmNlX2lkICkgJiYgMSA8PSByZXNvdXJjZV9pZDtcblx0XHRcdFx0fSApLFxuXHRcdFx0XHR3aW5kb3dzOiB7fVxuXHRcdFx0fTtcblx0XHRcdHdpbmRvd19zdG9yZS53aW5kb3dzWyB3aW5kb3dfa2V5IF0gPSBwYXlsb2FkO1xuXG5cdFx0XHRyZXR1cm4gcGF5bG9hZDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBdG9taWNhbGx5IHJlcGxhY2UgdGhlIGNvbXBsZXRlIHRocmVlLXdpbmRvdyBSZXNvdXJjZSBjb250ZXh0LlxuXHRcdCAqXG5cdFx0ICogRXZlcnkgcGF5bG9hZCBtdXN0IGNhcnJ5IHRoZSBzYW1lIG5vbi1lbXB0eSBzZXJ2ZXIgZmluZ2VycHJpbnQuIFRoZVxuXHRcdCAqIGV4aXN0aW5nIHN0b3JlIHJlbWFpbnMgdW50b3VjaGVkIHVudGlsIHRoZSBjb21wbGV0ZSBjYW5kaWRhdGUgc3RvcmUgaGFzXG5cdFx0ICogYmVlbiB2YWxpZGF0ZWQsIHByZXZlbnRpbmcgb2xkIGFuZCBuZXcgUmVzb3VyY2UgcGFnZXMgZnJvbSBjb2V4aXN0aW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGN1cnJlbnRfcmVzcG9uc2UgQXV0aG9yaXplZCBjdXJyZW50LXdpbmRvdyByZXNwb25zZS5cblx0XHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IGFkamFjZW50X3Jlc3BvbnNlcyBBdXRob3JpemVkIHByZXZpb3VzIGFuZCBuZXh0IHJlc3BvbnNlcy5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTm9ybWFsaXplZCBjdXJyZW50IHBheWxvYWQsIG9yIG51bGwgd2hlbiByZWplY3RlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXBsYWNlX3Jlc291cmNlX2NvbnRleHQoIGN1cnJlbnRfcmVzcG9uc2UsIGFkamFjZW50X3Jlc3BvbnNlcyApIHtcblx0XHRcdHZhciBjdXJyZW50X3BheWxvYWQgPSBub3JtYWxpemVfd2luZG93X3BheWxvYWQoIGN1cnJlbnRfcmVzcG9uc2UgKTtcblx0XHRcdHZhciByZXNvdXJjZV9maW5nZXJwcmludCA9IFN0cmluZyggY3VycmVudF9wYXlsb2FkLndpbmRvd19jb250ZXh0LnJlc291cmNlX2ZpbmdlcnByaW50IHx8ICcnICk7XG5cdFx0XHR2YXIgY2FuZGlkYXRlX3dpbmRvd3MgPSB7fTtcblx0XHRcdHZhciBjYW5kaWRhdGVfcGF5bG9hZHMgPSBBcnJheS5pc0FycmF5KCBhZGphY2VudF9yZXNwb25zZXMgKSA/IGFkamFjZW50X3Jlc3BvbnNlcy5tYXAoIG5vcm1hbGl6ZV93aW5kb3dfcGF5bG9hZCApIDogW107XG5cdFx0XHR2YXIgY3VycmVudF9rZXkgPSBnZXRfd2luZG93X2tleSggY3VycmVudF9wYXlsb2FkICk7XG5cdFx0XHR2YXIgaXNfdmFsaWQgPSBCb29sZWFuKCByZXNvdXJjZV9maW5nZXJwcmludCAmJiBjdXJyZW50X2tleSAmJiAyID09PSBjYW5kaWRhdGVfcGF5bG9hZHMubGVuZ3RoICk7XG5cblx0XHRcdGNhbmRpZGF0ZV93aW5kb3dzWyBjdXJyZW50X2tleSBdID0gY3VycmVudF9wYXlsb2FkO1xuXHRcdFx0Y2FuZGlkYXRlX3BheWxvYWRzLmZvckVhY2goIGZ1bmN0aW9uICggcGF5bG9hZCApIHtcblx0XHRcdFx0dmFyIHdpbmRvd19rZXkgPSBnZXRfd2luZG93X2tleSggcGF5bG9hZCApO1xuXG5cdFx0XHRcdGlmICggISB3aW5kb3dfa2V5IHx8IHJlc291cmNlX2ZpbmdlcnByaW50ICE9PSBTdHJpbmcoIHBheWxvYWQud2luZG93X2NvbnRleHQucmVzb3VyY2VfZmluZ2VycHJpbnQgfHwgJycgKSApIHtcblx0XHRcdFx0XHRpc192YWxpZCA9IGZhbHNlO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYW5kaWRhdGVfd2luZG93c1sgd2luZG93X2tleSBdID0gcGF5bG9hZDtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBpc192YWxpZCB8fCAzICE9PSBPYmplY3Qua2V5cyggY2FuZGlkYXRlX3dpbmRvd3MgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRhYm9ydF9lZGdlX3JlcXVlc3RzKCk7XG5cdFx0XHR3aW5kb3dfc3RvcmUgPSB7XG5cdFx0XHRcdGN1cnJlbnRfa2V5OiBjdXJyZW50X2tleSxcblx0XHRcdFx0cmVzb3VyY2VfZmluZ2VycHJpbnQ6IHJlc291cmNlX2ZpbmdlcnByaW50LFxuXHRcdFx0XHRyZXNvdXJjZV9vcmRlcjogY3VycmVudF9wYXlsb2FkLnJlc291cmNlcy5tYXAoIGZ1bmN0aW9uICggcmVzb3VyY2UgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIE51bWJlciggcmVzb3VyY2UgJiYgcmVzb3VyY2UuaWQgKTtcblx0XHRcdFx0fSApLmZpbHRlciggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRyZXR1cm4gTnVtYmVyLmlzSW50ZWdlciggcmVzb3VyY2VfaWQgKSAmJiAxIDw9IHJlc291cmNlX2lkO1xuXHRcdFx0XHR9ICksXG5cdFx0XHRcdHdpbmRvd3M6IGNhbmRpZGF0ZV93aW5kb3dzXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gY3VycmVudF9wYXlsb2FkO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY3VycmVudCBvcGFxdWUgc2VydmVyIFJlc291cmNlIGZpbmdlcnByaW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBGaW5nZXJwcmludCwgb3IgYW4gZW1wdHkgc3RyaW5nIGJlZm9yZSBpbml0aWFsaXphdGlvbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcmVzb3VyY2VfZmluZ2VycHJpbnQoKSB7XG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB3aW5kb3dfc3RvcmUucmVzb3VyY2VfZmluZ2VycHJpbnQgfHwgJycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBZGQgYW4gYWRqYWNlbnQgcmVzcG9uc2Ugb25seSBmb3IgdGhlIGN1cnJlbnQgYXV0aG9yaXplZCBSZXNvdXJjZSBzZXQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVzcG9uc2UgQXV0aG9yaXplZCBhZGphY2VudCByZXNwb25zZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlc3BvbnNlIHdhcyBhY2NlcHRlZCBpbnRvIHRoZSBjYWNoZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYWNoZV9hZGphY2VudCggcmVzcG9uc2UgKSB7XG5cdFx0XHR2YXIgcGF5bG9hZCA9IG5vcm1hbGl6ZV93aW5kb3dfcGF5bG9hZCggcmVzcG9uc2UgKTtcblx0XHRcdHZhciByZXNvdXJjZV9maW5nZXJwcmludCA9IFN0cmluZyggcGF5bG9hZC53aW5kb3dfY29udGV4dC5yZXNvdXJjZV9maW5nZXJwcmludCB8fCAnJyApO1xuXHRcdFx0dmFyIHdpbmRvd19rZXkgPSBnZXRfd2luZG93X2tleSggcGF5bG9hZCApO1xuXG5cdFx0XHRpZiAoIHdpbmRvd19zdG9yZS5yZXNvdXJjZV9maW5nZXJwcmludCAmJiByZXNvdXJjZV9maW5nZXJwcmludCAhPT0gd2luZG93X3N0b3JlLnJlc291cmNlX2ZpbmdlcnByaW50ICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgd2luZG93X3N0b3JlLnJlc291cmNlX2ZpbmdlcnByaW50ICkge1xuXHRcdFx0XHR3aW5kb3dfc3RvcmUucmVzb3VyY2VfZmluZ2VycHJpbnQgPSByZXNvdXJjZV9maW5nZXJwcmludDtcblx0XHRcdH1cblx0XHRcdHdpbmRvd19zdG9yZS53aW5kb3dzWyB3aW5kb3dfa2V5IF0gPSBwYXlsb2FkO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBLZWVwIG9ubHkgdGhlIG5lYXJlc3QgcHJldmlvdXMvY3VycmVudC9uZXh0IGF1dGhvcml6ZWQgcmVzcG9uc2VzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGF0IGxlYXN0IG9uZSByZXNwb25zZSB3YXMgZXZpY3RlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0cmltKCkge1xuXHRcdFx0dmFyIGxpbWl0cyA9IGdldF9sb2FkaW5nX2xpbWl0cygpO1xuXHRcdFx0dmFyIGVudHJpZXMgPSBnZXRfb3JkZXJlZF93aW5kb3dfZW50cmllcygpO1xuXHRcdFx0dmFyIGN1cnJlbnRfaW5kZXggPSAwO1xuXHRcdFx0dmFyIGNoYW5nZWQgPSBmYWxzZTtcblxuXHRcdFx0ZW50cmllcy5zb21lKCBmdW5jdGlvbiAoIGVudHJ5LCBlbnRyeV9pbmRleCApIHtcblx0XHRcdFx0aWYgKCBlbnRyeS5rZXkgPT09IHdpbmRvd19zdG9yZS5jdXJyZW50X2tleSApIHtcblx0XHRcdFx0XHRjdXJyZW50X2luZGV4ID0gZW50cnlfaW5kZXg7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHR3aGlsZSAoIGVudHJpZXMubGVuZ3RoID4gbGltaXRzLm1heGltdW1fY2FjaGVkX3dpbmRvd3MgKSB7XG5cdFx0XHRcdHZhciBmaXJzdF9kaXN0YW5jZSA9IE1hdGguYWJzKCBjdXJyZW50X2luZGV4ICk7XG5cdFx0XHRcdHZhciBsYXN0X2Rpc3RhbmNlID0gTWF0aC5hYnMoIGVudHJpZXMubGVuZ3RoIC0gMSAtIGN1cnJlbnRfaW5kZXggKTtcblx0XHRcdFx0dmFyIHJlbW92ZV9pbmRleCA9IGxhc3RfZGlzdGFuY2UgPiBmaXJzdF9kaXN0YW5jZSA/IGVudHJpZXMubGVuZ3RoIC0gMSA6IDA7XG5cblx0XHRcdFx0ZGVsZXRlIHdpbmRvd19zdG9yZS53aW5kb3dzWyBlbnRyaWVzWyByZW1vdmVfaW5kZXggXS5rZXkgXTtcblx0XHRcdFx0ZW50cmllcy5zcGxpY2UoIHJlbW92ZV9pbmRleCwgMSApO1xuXHRcdFx0XHRpZiAoIDAgPT09IHJlbW92ZV9pbmRleCApIHtcblx0XHRcdFx0XHRjdXJyZW50X2luZGV4IC09IDE7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjaGFuZ2VkO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1hcCBhbiBlcG9jaCB0byBmcmFjdGlvbmFsIHVuaXRzIG9uIGFuIGV4cGxpY2l0IERTVC1hd2FyZSBheGlzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHRpbWVzdGFtcCBFcG9jaCBzZWNvbmRzLlxuXHRcdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gY2VsbHMgT3JkZXJlZCBzZXJ2ZXIgY2VsbHMuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBGcmFjdGlvbmFsIGNlbGwgcG9zaXRpb24uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbWFwX3RpbWVzdGFtcF90b19heGlzX3Bvc2l0aW9uKCB0aW1lc3RhbXAsIGNlbGxzICkge1xuXHRcdFx0dmFyIHBvc2l0aW9uID0gMDtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNvbWUuY2FsbCggY2VsbHMsIGZ1bmN0aW9uICggY2VsbCwgY2VsbF9pbmRleCApIHtcblx0XHRcdFx0dmFyIHN0YXJ0X2Vwb2NoID0gTnVtYmVyKCBjZWxsLnN0YXJ0X2Vwb2NoICk7XG5cdFx0XHRcdHZhciBlbmRfZXBvY2ggPSBOdW1iZXIoIGNlbGwuZW5kX2Vwb2NoICk7XG5cblx0XHRcdFx0aWYgKCB0aW1lc3RhbXAgPD0gc3RhcnRfZXBvY2ggKSB7XG5cdFx0XHRcdFx0cG9zaXRpb24gPSBjZWxsX2luZGV4O1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggdGltZXN0YW1wIDwgZW5kX2Vwb2NoICkge1xuXHRcdFx0XHRcdHBvc2l0aW9uID0gY2VsbF9pbmRleCArICggdGltZXN0YW1wIC0gc3RhcnRfZXBvY2ggKSAvIE1hdGgubWF4KCAxLCBlbmRfZXBvY2ggLSBzdGFydF9lcG9jaCApO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBvc2l0aW9uID0gY2VsbF9pbmRleCArIDE7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHBvc2l0aW9uO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbGN1bGF0ZSBleGFjdCBhbmQgdmlzdWFsIGdlb21ldHJ5IGFnYWluc3QgdGhlIGNvbXBvc2VkIGF4aXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYXhpcyBDb21wb3NlZCBheGlzIERUTy5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gc3RhcnRfZXBvY2ggSW5jbHVzaXZlIHN0YXJ0LlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBlbmRfZXBvY2ggRXhjbHVzaXZlIGVuZC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IFBlcmNlbnRhZ2UgZ2VvbWV0cnkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2NvbXBvc2VkX3NlZ21lbnRfZ2VvbWV0cnkoIGF4aXMsIHN0YXJ0X2Vwb2NoLCBlbmRfZXBvY2ggKSB7XG5cdFx0XHR2YXIgY2VsbF9jb3VudCA9IE1hdGgubWF4KCAxLCBheGlzLmNlbGxzLmxlbmd0aCApO1xuXHRcdFx0dmFyIHN0YXJ0X3VuaXRzID0gbWFwX3RpbWVzdGFtcF90b19heGlzX3Bvc2l0aW9uKCBzdGFydF9lcG9jaCwgYXhpcy5jZWxscyApO1xuXHRcdFx0dmFyIGVuZF91bml0cyA9IG1hcF90aW1lc3RhbXBfdG9fYXhpc19wb3NpdGlvbiggZW5kX2Vwb2NoLCBheGlzLmNlbGxzICk7XG5cdFx0XHR2YXIgdmlzdWFsX3N0YXJ0ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCBjZWxsX2NvdW50IC0gMSwgTWF0aC5mbG9vciggc3RhcnRfdW5pdHMgKSApICk7XG5cdFx0XHR2YXIgdmlzdWFsX2VuZCA9IE1hdGgubWF4KCB2aXN1YWxfc3RhcnQgKyAxLCBNYXRoLm1pbiggY2VsbF9jb3VudCwgTWF0aC5jZWlsKCBlbmRfdW5pdHMgKSApICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG9mZnNldF9wZXJjZW50OiAxMDAgKiBzdGFydF91bml0cyAvIGNlbGxfY291bnQsXG5cdFx0XHRcdHdpZHRoX3BlcmNlbnQ6IDEwMCAqIE1hdGgubWF4KCAwLCBlbmRfdW5pdHMgLSBzdGFydF91bml0cyApIC8gY2VsbF9jb3VudCxcblx0XHRcdFx0dmlzdWFsX29mZnNldF9wZXJjZW50OiAxMDAgKiB2aXN1YWxfc3RhcnQgLyBjZWxsX2NvdW50LFxuXHRcdFx0XHR2aXN1YWxfd2lkdGhfcGVyY2VudDogMTAwICogKCB2aXN1YWxfZW5kIC0gdmlzdWFsX3N0YXJ0ICkgLyBjZWxsX2NvdW50XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNlbGVjdCBzaGFwZS1hd2FyZSBjYXJkIGdlb21ldHJ5IGFmdGVyIGNhY2hlZCB3aW5kb3dzIGFyZSByZWNvbXBvc2VkLlxuXHRcdCAqXG5cdFx0ICogRnVsbC1kYXkgcmVjb3JkcyBrZWVwIHdob2xlLWNlbGwgcHJlc2VudGF0aW9uLiBUaW1lZCBhbmQgY2hhbmdlb3ZlclxuXHRcdCAqIHJlY29yZHMgcmV0YWluIHRoZWlyIGV4YWN0IGZyYWN0aW9uYWwgYm91bmRhcmllcywgbWF0Y2hpbmcgdGhlIHNlcnZlciBEVE9cblx0XHQgKiBhbmQgdGhlIHJlc2l6ZSBwcm9wb3NhbCBzaG93biBiZWZvcmUgYW5kIGFmdGVyIGEgY2Fub25pY2FsIHJlZnJlc2guXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZ2VvbWV0cnkgRXhhY3QgYW5kIGNlbGwtZXhwYW5kZWQgYXhpcyBnZW9tZXRyeS5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2Z1bGxfZGF5IFdoZXRoZXIgdGhlIHJlY29yZCByZXByZXNlbnRzIGZ1bGwgZGF0ZXMuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19kYXlfdGltZV9zbG90IFdoZXRoZXIgYSBzYW1lLWRheSBzbG90IHVzZXMgYSBzZW1hbnRpYyBkYXkgY2FyZC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IFNoYXBlLWF3YXJlIGNhcmQgcHJlc2VudGF0aW9uIGdlb21ldHJ5LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9jb21wb3NlZF9wcmVzZW50YXRpb25fZ2VvbWV0cnkoIGdlb21ldHJ5LCBpc19mdWxsX2RheSwgaXNfZGF5X3RpbWVfc2xvdCApIHtcblx0XHRcdHZhciB1c2VfY29tcGxldGVfY2VsbHMgPSBpc19mdWxsX2RheSB8fCBpc19kYXlfdGltZV9zbG90O1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRwcmVzZW50YXRpb25fb2Zmc2V0X3BlcmNlbnQ6IHVzZV9jb21wbGV0ZV9jZWxscyA/IGdlb21ldHJ5LnZpc3VhbF9vZmZzZXRfcGVyY2VudCA6IGdlb21ldHJ5Lm9mZnNldF9wZXJjZW50LFxuXHRcdFx0XHRwcmVzZW50YXRpb25fd2lkdGhfcGVyY2VudDogdXNlX2NvbXBsZXRlX2NlbGxzID8gZ2VvbWV0cnkudmlzdWFsX3dpZHRoX3BlcmNlbnQgOiBnZW9tZXRyeS53aWR0aF9wZXJjZW50XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbXBvc2UgY2FjaGVkIHNlcnZlciBheGVzIHdpdGhvdXQgaW52ZW50aW5nIGxvY2FsIGRhdGUgbGFiZWxzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBlbnRyaWVzIE9yZGVyZWQgY2FjaGVkIHdpbmRvd3MuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGN1cnJlbnRfcGF5bG9hZCBDdXJyZW50IGxvZ2ljYWwgd2luZG93LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gQ29tYmluZWQgYXhpcyBEVE8uXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY29tcG9zZV9jYWNoZWRfYXhpcyggZW50cmllcywgY3VycmVudF9wYXlsb2FkICkge1xuXHRcdFx0dmFyIGNlbGxfbWFwID0ge307XG5cdFx0XHR2YXIgY2VsbHMgPSBbXTtcblx0XHRcdHZhciBtb250aF9iYW5kcyA9IFtdO1xuXHRcdFx0dmFyIGRhdGVfYmFuZHMgPSBbXTtcblx0XHRcdHZhciBtb250aF9tYXAgPSB7fTtcblx0XHRcdHZhciBkYXRlX21hcCA9IHt9O1xuXHRcdFx0dmFyIGRhdGVfbWV0YWRhdGFfYnlfa2V5ID0ge307XG5cdFx0XHR2YXIgY3VycmVudF9tYXJrZXIgPSBPYmplY3QuYXNzaWduKCB7fSwgY3VycmVudF9wYXlsb2FkLmF4aXMuY3VycmVudF90aW1lX21hcmtlciB8fCB7fSApO1xuXHRcdFx0dmFyIG5vd19lcG9jaCA9IE1hdGguZmxvb3IoIGdldF9ub3coKS5nZXRUaW1lKCkgLyAxMDAwICk7XG5cblx0XHRcdGVudHJpZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBlbnRyeSApIHtcblx0XHRcdFx0KCBlbnRyeS5wYXlsb2FkLmF4aXMuZGF0ZV9iYW5kcyB8fCBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggZGF0ZV9iYW5kICkge1xuXHRcdFx0XHRcdHZhciBkYXRlX2tleSA9IFN0cmluZyggZGF0ZV9iYW5kLmRhdGUgfHwgJycgKTtcblxuXHRcdFx0XHRcdGlmICggZGF0ZV9rZXkgJiYgISBkYXRlX21ldGFkYXRhX2J5X2tleVsgZGF0ZV9rZXkgXSApIHtcblx0XHRcdFx0XHRcdGRhdGVfbWV0YWRhdGFfYnlfa2V5WyBkYXRlX2tleSBdID0gT2JqZWN0LmFzc2lnbigge30sIGRhdGVfYmFuZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0XHQoIGVudHJ5LnBheWxvYWQuYXhpcy5jZWxscyB8fCBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggY2VsbCApIHtcblx0XHRcdFx0XHR2YXIgY2VsbF9rZXkgPSBTdHJpbmcoIGNlbGwuc3RhcnRfZXBvY2ggKSArICc6JyArIFN0cmluZyggY2VsbC5lbmRfZXBvY2ggKTtcblxuXHRcdFx0XHRcdGlmICggISBjZWxsX21hcFsgY2VsbF9rZXkgXSApIHtcblx0XHRcdFx0XHRcdGNlbGxfbWFwWyBjZWxsX2tleSBdID0gT2JqZWN0LmFzc2lnbigge30sIGNlbGwgKTtcblx0XHRcdFx0XHRcdGNlbGxzLnB1c2goIGNlbGxfbWFwWyBjZWxsX2tleSBdICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRjZWxscy5zb3J0KCBmdW5jdGlvbiAoIGxlZnRfY2VsbCwgcmlnaHRfY2VsbCApIHtcblx0XHRcdFx0cmV0dXJuIE51bWJlciggbGVmdF9jZWxsLnN0YXJ0X2Vwb2NoICkgLSBOdW1iZXIoIHJpZ2h0X2NlbGwuc3RhcnRfZXBvY2ggKTtcblx0XHRcdH0gKTtcblx0XHRcdGNlbGxzLmZvckVhY2goIGZ1bmN0aW9uICggY2VsbCwgY2VsbF9pbmRleCApIHtcblx0XHRcdFx0dmFyIG1vbnRoX2tleSA9IFN0cmluZyggY2VsbC5tb250aF9rZXkgfHwgY2VsbC5kYXRlIHx8ICcnICkuc3Vic3RyaW5nKCAwLCA3ICk7XG5cdFx0XHRcdHZhciBkYXRlX2tleSA9IFN0cmluZyggY2VsbC5kYXRlIHx8ICcnICk7XG5cdFx0XHRcdHZhciBkYXRlX21ldGFkYXRhID0gZGF0ZV9tZXRhZGF0YV9ieV9rZXlbIGRhdGVfa2V5IF0gfHwge307XG5cblx0XHRcdFx0Y2VsbC5pbmRleCA9IGNlbGxfaW5kZXg7XG5cdFx0XHRcdGNlbGwub2Zmc2V0X3BlcmNlbnQgPSBjZWxscy5sZW5ndGggPyAxMDAgKiBjZWxsX2luZGV4IC8gY2VsbHMubGVuZ3RoIDogMDtcblx0XHRcdFx0Y2VsbC53aWR0aF9wZXJjZW50ID0gY2VsbHMubGVuZ3RoID8gMTAwIC8gY2VsbHMubGVuZ3RoIDogMTAwO1xuXHRcdFx0XHRpZiAoICEgbW9udGhfbWFwWyBtb250aF9rZXkgXSApIHtcblx0XHRcdFx0XHRtb250aF9tYXBbIG1vbnRoX2tleSBdID0ge1xuXHRcdFx0XHRcdFx0a2V5OiBtb250aF9rZXksXG5cdFx0XHRcdFx0XHRsYWJlbDogY2VsbC5tb250aF9sYWJlbCB8fCBtb250aF9rZXksXG5cdFx0XHRcdFx0XHRzcGFuOiAwXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRtb250aF9iYW5kcy5wdXNoKCBtb250aF9tYXBbIG1vbnRoX2tleSBdICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bW9udGhfbWFwWyBtb250aF9rZXkgXS5zcGFuICs9IDE7XG5cdFx0XHRcdGlmICggISBkYXRlX21hcFsgZGF0ZV9rZXkgXSApIHtcblx0XHRcdFx0XHRkYXRlX21hcFsgZGF0ZV9rZXkgXSA9IHtcblx0XHRcdFx0XHRcdGRhdGU6IGRhdGVfa2V5LFxuXHRcdFx0XHRcdFx0bGFiZWw6IGRhdGVfbWV0YWRhdGEubGFiZWwgfHwgZGF0ZV9rZXksXG5cdFx0XHRcdFx0XHR3ZWVrZGF5OiBkYXRlX21ldGFkYXRhLndlZWtkYXkgfHwgJycsXG5cdFx0XHRcdFx0XHRkYXlfbnVtYmVyOiBkYXRlX21ldGFkYXRhLmRheV9udW1iZXIgfHwgY2VsbC5kYXlfbnVtYmVyIHx8ICcnLFxuXHRcdFx0XHRcdFx0dG9kYXlfbGFiZWw6IGRhdGVfbWV0YWRhdGEudG9kYXlfbGFiZWwgfHwgZGF0ZV9rZXksXG5cdFx0XHRcdFx0XHRpc190b2RheTogJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkYXRlX21ldGFkYXRhLmlzX3RvZGF5ID8gQm9vbGVhbiggZGF0ZV9tZXRhZGF0YS5pc190b2RheSApIDogQm9vbGVhbiggY2VsbC5pc190b2RheSApLFxuXHRcdFx0XHRcdFx0aXNfd2Vla2VuZDogJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkYXRlX21ldGFkYXRhLmlzX3dlZWtlbmQgPyBCb29sZWFuKCBkYXRlX21ldGFkYXRhLmlzX3dlZWtlbmQgKSA6IEJvb2xlYW4oIGNlbGwuaXNfd2Vla2VuZCApLFxuXHRcdFx0XHRcdFx0c3RhcnRfYXQ6IGRhdGVfbWV0YWRhdGEuc3RhcnRfYXQgfHwgY2VsbC5zdGFydF9hdCxcblx0XHRcdFx0XHRcdGVuZF9hdDogZGF0ZV9tZXRhZGF0YS5lbmRfYXQgfHwgY2VsbC5lbmRfYXQsXG5cdFx0XHRcdFx0XHRzdGFydF9lcG9jaDogJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkYXRlX21ldGFkYXRhLnN0YXJ0X2Vwb2NoID8gTnVtYmVyKCBkYXRlX21ldGFkYXRhLnN0YXJ0X2Vwb2NoICkgOiBOdW1iZXIoIGNlbGwuc3RhcnRfZXBvY2ggKSxcblx0XHRcdFx0XHRcdGVuZF9lcG9jaDogJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkYXRlX21ldGFkYXRhLmVuZF9lcG9jaCA/IE51bWJlciggZGF0ZV9tZXRhZGF0YS5lbmRfZXBvY2ggKSA6IE51bWJlciggY2VsbC5lbmRfZXBvY2ggKSxcblx0XHRcdFx0XHRcdGVsYXBzZWRfbWludXRlczogJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkYXRlX21ldGFkYXRhLmVsYXBzZWRfbWludXRlcyA/IE51bWJlciggZGF0ZV9tZXRhZGF0YS5lbGFwc2VkX21pbnV0ZXMgKSA6IE1hdGgubWF4KCAwLCAoIE51bWJlciggY2VsbC5lbmRfZXBvY2ggKSAtIE51bWJlciggY2VsbC5zdGFydF9lcG9jaCApICkgLyA2MCApLFxuXHRcdFx0XHRcdFx0d2FsbF9taW51dGVzOiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGRhdGVfbWV0YWRhdGEud2FsbF9taW51dGVzID8gTnVtYmVyKCBkYXRlX21ldGFkYXRhLndhbGxfbWludXRlcyApIDogMTQ0MCxcblx0XHRcdFx0XHRcdHV0Y19vZmZzZXRfc3RhcnRfc2Vjb25kczogJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBkYXRlX21ldGFkYXRhLnV0Y19vZmZzZXRfc3RhcnRfc2Vjb25kcyA/IE51bWJlciggZGF0ZV9tZXRhZGF0YS51dGNfb2Zmc2V0X3N0YXJ0X3NlY29uZHMgKSA6IDAsXG5cdFx0XHRcdFx0XHR1dGNfb2Zmc2V0X2VuZF9zZWNvbmRzOiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGRhdGVfbWV0YWRhdGEudXRjX29mZnNldF9lbmRfc2Vjb25kcyA/IE51bWJlciggZGF0ZV9tZXRhZGF0YS51dGNfb2Zmc2V0X2VuZF9zZWNvbmRzICkgOiAwLFxuXHRcdFx0XHRcdFx0dHJhbnNpdGlvbnM6IEFycmF5LmlzQXJyYXkoIGRhdGVfbWV0YWRhdGEudHJhbnNpdGlvbnMgKSA/IGRhdGVfbWV0YWRhdGEudHJhbnNpdGlvbnMubWFwKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgdHJhbnNpdGlvbiApO1xuXHRcdFx0XHRcdFx0fSApIDogW10sXG5cdFx0XHRcdFx0XHRzcGFuOiAwXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRkYXRlX2JhbmRzLnB1c2goIGRhdGVfbWFwWyBkYXRlX2tleSBdICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGF0ZV9tYXBbIGRhdGVfa2V5IF0uc3BhbiArPSAxO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRjdXJyZW50X21hcmtlci5pc192aXNpYmxlID0gQm9vbGVhbiggY3VycmVudF9wYXlsb2FkLmF4aXMuaXNfdGltZWQgJiYgY2VsbHMubGVuZ3RoICYmIG5vd19lcG9jaCA+PSBOdW1iZXIoIGNlbGxzWyAwIF0uc3RhcnRfZXBvY2ggKSAmJiBub3dfZXBvY2ggPCBOdW1iZXIoIGNlbGxzWyBjZWxscy5sZW5ndGggLSAxIF0uZW5kX2Vwb2NoICkgKTtcblx0XHRcdGN1cnJlbnRfbWFya2VyLnBvc2l0aW9uX3BlcmNlbnQgPSBjZWxscy5sZW5ndGggPyAxMDAgKiBtYXBfdGltZXN0YW1wX3RvX2F4aXNfcG9zaXRpb24oIG5vd19lcG9jaCwgY2VsbHMgKSAvIGNlbGxzLmxlbmd0aCA6IDA7XG5cblx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgY3VycmVudF9wYXlsb2FkLmF4aXMsIHtcblx0XHRcdFx0Y2VsbF9jb3VudDogY2VsbHMubGVuZ3RoLFxuXHRcdFx0XHRjZWxsczogY2VsbHMsXG5cdFx0XHRcdG1vbnRoX2JhbmRzOiBtb250aF9iYW5kcyxcblx0XHRcdFx0ZGF0ZV9iYW5kczogZGF0ZV9iYW5kcyxcblx0XHRcdFx0c3RhcnRfYXQ6IGNlbGxzLmxlbmd0aCA/IGNlbGxzWyAwIF0uc3RhcnRfYXQgOiBjdXJyZW50X3BheWxvYWQuYXhpcy5zdGFydF9hdCxcblx0XHRcdFx0ZW5kX2F0OiBjZWxscy5sZW5ndGggPyBjZWxsc1sgY2VsbHMubGVuZ3RoIC0gMSBdLmVuZF9hdCA6IGN1cnJlbnRfcGF5bG9hZC5heGlzLmVuZF9hdCxcblx0XHRcdFx0c3RhcnRfZXBvY2g6IGNlbGxzLmxlbmd0aCA/IE51bWJlciggY2VsbHNbIDAgXS5zdGFydF9lcG9jaCApIDogTnVtYmVyKCBjdXJyZW50X3BheWxvYWQuYXhpcy5zdGFydF9lcG9jaCApLFxuXHRcdFx0XHRlbmRfZXBvY2g6IGNlbGxzLmxlbmd0aCA/IE51bWJlciggY2VsbHNbIGNlbGxzLmxlbmd0aCAtIDEgXS5lbmRfZXBvY2ggKSA6IE51bWJlciggY3VycmVudF9wYXlsb2FkLmF4aXMuZW5kX2Vwb2NoICksXG5cdFx0XHRcdGN1cnJlbnRfdGltZV9tYXJrZXI6IGN1cnJlbnRfbWFya2VyXG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXNzaWduIGRldGVybWluaXN0aWMgY29sbGlzaW9uIGxhbmVzIHRvIGNvbXBvc2VkIHZpc2libGUgc2VnbWVudHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IHNlZ21lbnRzIENvbXBvc2VkIGJvb2tpbmcgY2FyZCBEVE9zLlxuXHRcdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gdGltZV9zbG90X292ZXJmbG93cyBDb21wb3NlZCBkYXktY2VsbCBvdmVyZmxvdyBEVE9zLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gTGFuZSBjb3VudHMga2V5ZWQgYnkgUmVzb3VyY2UgSUQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYXNzaWduX2NvbXBvc2VkX3NlZ21lbnRfbGFuZXMoIHNlZ21lbnRzLCB0aW1lX3Nsb3Rfb3ZlcmZsb3dzICkge1xuXHRcdFx0dmFyIGJ5X3Jlc291cmNlID0ge307XG5cdFx0XHR2YXIgbGFuZV9jb3VudHMgPSB7fTtcblxuXHRcdFx0c2VnbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCBzZWdtZW50LCBzZWdtZW50X2luZGV4ICkge1xuXHRcdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBOdW1iZXIoIHNlZ21lbnQucmVzb3VyY2VfaWQgKTtcblxuXHRcdFx0XHRpZiAoIGZhbHNlID09PSBzZWdtZW50LmlzX3Zpc2libGUgfHwgdHJ1ZSA9PT0gc2VnbWVudC5pc190aW1lX3Nsb3Rfb3ZlcmZsb3dfaXRlbSApIHtcblx0XHRcdFx0XHRzZWdtZW50LmxhbmVfaW5kZXggPSAwO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSA9IGJ5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdIHx8IFtdO1xuXHRcdFx0XHRieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXS5wdXNoKCB7XG5cdFx0XHRcdFx0dHlwZTogJ3NlZ21lbnQnLFxuXHRcdFx0XHRcdGluZGV4OiBzZWdtZW50X2luZGV4LFxuXHRcdFx0XHRcdHN0YXJ0OiBOdW1iZXIoIHNlZ21lbnQucHJlc2VudGF0aW9uX29mZnNldF9wZXJjZW50ICksXG5cdFx0XHRcdFx0ZW5kOiBOdW1iZXIoIHNlZ21lbnQucHJlc2VudGF0aW9uX29mZnNldF9wZXJjZW50ICkgKyBOdW1iZXIoIHNlZ21lbnQucHJlc2VudGF0aW9uX3dpZHRoX3BlcmNlbnQgKSxcblx0XHRcdFx0XHRzb3J0X29yZGVyOiAwLFxuXHRcdFx0XHRcdGlkOiBTdHJpbmcoIHNlZ21lbnQuc2VnbWVudF9pZCB8fCAnJyApXG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKTtcblx0XHRcdCggdGltZV9zbG90X292ZXJmbG93cyB8fCBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggb3ZlcmZsb3csIG92ZXJmbG93X2luZGV4ICkge1xuXHRcdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBOdW1iZXIoIG92ZXJmbG93LnJlc291cmNlX2lkICk7XG5cblx0XHRcdFx0YnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSBieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSB8fCBbXTtcblx0XHRcdFx0YnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0ucHVzaCgge1xuXHRcdFx0XHRcdHR5cGU6ICdvdmVyZmxvdycsXG5cdFx0XHRcdFx0aW5kZXg6IG92ZXJmbG93X2luZGV4LFxuXHRcdFx0XHRcdHN0YXJ0OiBOdW1iZXIoIG92ZXJmbG93LnByZXNlbnRhdGlvbl9vZmZzZXRfcGVyY2VudCApLFxuXHRcdFx0XHRcdGVuZDogTnVtYmVyKCBvdmVyZmxvdy5wcmVzZW50YXRpb25fb2Zmc2V0X3BlcmNlbnQgKSArIE51bWJlciggb3ZlcmZsb3cucHJlc2VudGF0aW9uX3dpZHRoX3BlcmNlbnQgKSxcblx0XHRcdFx0XHRzb3J0X29yZGVyOiAxLFxuXHRcdFx0XHRcdGlkOiBTdHJpbmcoIG92ZXJmbG93Lm92ZXJmbG93X2lkIHx8ICcnIClcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdFx0T2JqZWN0LmtleXMoIGJ5X3Jlc291cmNlICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0dmFyIGxhbmVfZW5kcyA9IFtdO1xuXG5cdFx0XHRcdGJ5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdLnNvcnQoIGZ1bmN0aW9uICggbGVmdF9lbnRyeSwgcmlnaHRfZW50cnkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxlZnRfZW50cnkuc3RhcnQgLSByaWdodF9lbnRyeS5zdGFydCB8fCBsZWZ0X2VudHJ5LnNvcnRfb3JkZXIgLSByaWdodF9lbnRyeS5zb3J0X29yZGVyIHx8IGxlZnRfZW50cnkuaWQubG9jYWxlQ29tcGFyZSggcmlnaHRfZW50cnkuaWQgKTtcblx0XHRcdFx0fSApLmZvckVhY2goIGZ1bmN0aW9uICggZW50cnkgKSB7XG5cdFx0XHRcdFx0dmFyIGxhbmVfaW5kZXggPSAwO1xuXG5cdFx0XHRcdFx0d2hpbGUgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGxhbmVfZW5kc1sgbGFuZV9pbmRleCBdICYmIGxhbmVfZW5kc1sgbGFuZV9pbmRleCBdIC0gZW50cnkuc3RhcnQgPiBwcmVzZW50YXRpb25fZ2VvbWV0cnlfZXBzaWxvbiApIHtcblx0XHRcdFx0XHRcdGxhbmVfaW5kZXggKz0gMTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGFuZV9lbmRzWyBsYW5lX2luZGV4IF0gPSBlbnRyeS5lbmQ7XG5cdFx0XHRcdFx0aWYgKCAnc2VnbWVudCcgPT09IGVudHJ5LnR5cGUgKSB7XG5cdFx0XHRcdFx0XHRzZWdtZW50c1sgZW50cnkuaW5kZXggXS5sYW5lX2luZGV4ID0gbGFuZV9pbmRleDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGltZV9zbG90X292ZXJmbG93c1sgZW50cnkuaW5kZXggXS5sYW5lX2luZGV4ID0gbGFuZV9pbmRleDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0bGFuZV9jb3VudHNbIHJlc291cmNlX2lkIF0gPSBNYXRoLm1heCggMSwgbGFuZV9lbmRzLmxlbmd0aCApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gbGFuZV9jb3VudHM7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgY29tcGFjdCBvdmVyZmxvdyBjb250cm9scyBmb3IgZGVuc2Ugc2FtZS1kYXRlIHRpbWVkIGJvb2tpbmdzLlxuXHRcdCAqXG5cdFx0ICogVGhlIG9wZXJhdGlvbiBjaGFuZ2VzIHByZXNlbnRhdGlvbiBmaWVsZHMgb25seS4gRXhhY3QgaW50ZXJ2YWxzIHJlbWFpbiBpblxuXHRcdCAqIGV2ZXJ5IHNlZ21lbnQgYW5kIGluIHRoZSBpbmRlcGVuZGVudCBvY2N1cGFuY3kgY29sbGVjdGlvbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gc2VnbWVudHMgQ29tcG9zZWQgYm9va2luZyBjYXJkIERUT3MuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gVGVtcGxhdGUtcmVhZHkgb3ZlcmZsb3cgY29udHJvbHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnVpbGRfY29tcG9zZWRfdGltZV9zbG90X292ZXJmbG93cyggc2VnbWVudHMgKSB7XG5cdFx0XHR2YXIgbWF4aW11bV92aXNpYmxlX3Nsb3RzID0gMztcblx0XHRcdHZhciBncm91cHMgPSB7fTtcblx0XHRcdHZhciBvdmVyZmxvd3MgPSBbXTtcblxuXHRcdFx0c2VnbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCBzZWdtZW50ICkge1xuXHRcdFx0XHRzZWdtZW50LmlzX3RpbWVfc2xvdF9vdmVyZmxvd19pdGVtID0gZmFsc2U7XG5cdFx0XHRcdGlmICggZmFsc2UgPT09IHNlZ21lbnQuaXNfdmlzaWJsZSB8fCAhIHNlZ21lbnQuaXNfZGF5X3RpbWVfc2xvdCB8fCAhIHNlZ21lbnQudGltZV9zbG90X2dyb3VwX2tleSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Z3JvdXBzWyBzZWdtZW50LnRpbWVfc2xvdF9ncm91cF9rZXkgXSA9IGdyb3Vwc1sgc2VnbWVudC50aW1lX3Nsb3RfZ3JvdXBfa2V5IF0gfHwgW107XG5cdFx0XHRcdGdyb3Vwc1sgc2VnbWVudC50aW1lX3Nsb3RfZ3JvdXBfa2V5IF0ucHVzaCggc2VnbWVudCApO1xuXHRcdFx0fSApO1xuXHRcdFx0T2JqZWN0LmtleXMoIGdyb3VwcyApLmZvckVhY2goIGZ1bmN0aW9uICggZ3JvdXBfa2V5ICkge1xuXHRcdFx0XHR2YXIgZ3JvdXBfc2VnbWVudHMgPSBncm91cHNbIGdyb3VwX2tleSBdLnNvcnQoIGZ1bmN0aW9uICggbGVmdF9zZWdtZW50LCByaWdodF9zZWdtZW50ICkge1xuXHRcdFx0XHRcdHJldHVybiBEYXRlLnBhcnNlKCBsZWZ0X3NlZ21lbnQuc3RhcnQgKSAtIERhdGUucGFyc2UoIHJpZ2h0X3NlZ21lbnQuc3RhcnQgKSB8fCBTdHJpbmcoIGxlZnRfc2VnbWVudC5zZWdtZW50X2lkICkubG9jYWxlQ29tcGFyZSggU3RyaW5nKCByaWdodF9zZWdtZW50LnNlZ21lbnRfaWQgKSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHZhciBoaWRkZW5fc2VnbWVudHM7XG5cdFx0XHRcdHZhciBmaXJzdF9zZWdtZW50O1xuXHRcdFx0XHR2YXIgY291bnRfdGV4dDtcblx0XHRcdFx0dmFyIGRhdGVfbGFiZWw7XG5cdFx0XHRcdHZhciB2aXNpYmxlX3Nsb3RfbGltaXQgPSBtYXhpbXVtX3Zpc2libGVfc2xvdHM7XG5cblx0XHRcdFx0aWYgKCBncm91cF9zZWdtZW50cy5sZW5ndGggPiBtYXhpbXVtX3Zpc2libGVfc2xvdHMgKSB7XG5cdFx0XHRcdFx0dmlzaWJsZV9zbG90X2xpbWl0ID0gbWF4aW11bV92aXNpYmxlX3Nsb3RzIC0gMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGdyb3VwX3NlZ21lbnRzLmZvckVhY2goIGZ1bmN0aW9uICggc2VnbWVudCwgZ3JvdXBfaW5kZXggKSB7XG5cdFx0XHRcdFx0c2VnbWVudC50aW1lX3Nsb3RfZ3JvdXBfaW5kZXggPSBncm91cF9pbmRleDtcblx0XHRcdFx0XHRzZWdtZW50LmlzX3RpbWVfc2xvdF9vdmVyZmxvd19pdGVtID0gZ3JvdXBfaW5kZXggPj0gdmlzaWJsZV9zbG90X2xpbWl0O1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggZ3JvdXBfc2VnbWVudHMubGVuZ3RoIDw9IG1heGltdW1fdmlzaWJsZV9zbG90cyApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Zmlyc3Rfc2VnbWVudCA9IGdyb3VwX3NlZ21lbnRzWzBdO1xuXHRcdFx0XHRoaWRkZW5fc2VnbWVudHMgPSBncm91cF9zZWdtZW50cy5zbGljZSggdmlzaWJsZV9zbG90X2xpbWl0ICk7XG5cdFx0XHRcdGNvdW50X3RleHQgPSBTdHJpbmcoIGhpZGRlbl9zZWdtZW50cy5sZW5ndGggKTtcblx0XHRcdFx0ZGF0ZV9sYWJlbCA9IFN0cmluZyggZmlyc3Rfc2VnbWVudC50aW1lX3Nsb3RfZGF0ZV9sYWJlbCB8fCBmaXJzdF9zZWdtZW50LnRpbWVfc2xvdF9kYXRlIHx8ICcnICk7XG5cdFx0XHRcdG92ZXJmbG93cy5wdXNoKCB7XG5cdFx0XHRcdFx0b3ZlcmZsb3dfaWQ6ICd3cGJjLXRpbWUtc2xvdC1vdmVyZmxvdy0nICsgU3RyaW5nKCBmaXJzdF9zZWdtZW50LnJlc291cmNlX2lkICkgKyAnLScgKyBTdHJpbmcoIGZpcnN0X3NlZ21lbnQudGltZV9zbG90X2RhdGUgfHwgJycgKS5yZXBsYWNlKCAvW14wLTktXS9nLCAnJyApLFxuXHRcdFx0XHRcdGdyb3VwX2tleTogZ3JvdXBfa2V5LFxuXHRcdFx0XHRcdHJlc291cmNlX2lkOiBOdW1iZXIoIGZpcnN0X3NlZ21lbnQucmVzb3VyY2VfaWQgKSxcblx0XHRcdFx0XHRkYXRlOiBTdHJpbmcoIGZpcnN0X3NlZ21lbnQudGltZV9zbG90X2RhdGUgfHwgJycgKSxcblx0XHRcdFx0XHRkYXRlX2xhYmVsOiBkYXRlX2xhYmVsLFxuXHRcdFx0XHRcdHByZXNlbnRhdGlvbl9vZmZzZXRfcGVyY2VudDogTnVtYmVyKCBmaXJzdF9zZWdtZW50LnByZXNlbnRhdGlvbl9vZmZzZXRfcGVyY2VudCApLFxuXHRcdFx0XHRcdHByZXNlbnRhdGlvbl93aWR0aF9wZXJjZW50OiBOdW1iZXIoIGZpcnN0X3NlZ21lbnQucHJlc2VudGF0aW9uX3dpZHRoX3BlcmNlbnQgKSxcblx0XHRcdFx0XHRoaWRkZW5fY291bnQ6IGhpZGRlbl9zZWdtZW50cy5sZW5ndGgsXG5cdFx0XHRcdFx0bW9yZV9sYWJlbDogU3RyaW5nKCBzZXR0aW5ncy5pMThuLnRpbWVfc2xvdF9tb3JlIHx8ICcre2NvdW50fSBtb3JlJyApLnJlcGxhY2UoICd7Y291bnR9JywgY291bnRfdGV4dCApLFxuXHRcdFx0XHRcdGFyaWFfbGFiZWw6IFN0cmluZyggc2V0dGluZ3MuaTE4bi50aW1lX3Nsb3RfbW9yZV9sYWJlbCB8fCAnU2hvdyB7Y291bnR9IG1vcmUgYm9va2luZ3Mgb24ge2RhdGV9JyApLnJlcGxhY2UoICd7Y291bnR9JywgY291bnRfdGV4dCApLnJlcGxhY2UoICd7ZGF0ZX0nLCBkYXRlX2xhYmVsICksXG5cdFx0XHRcdFx0aGVhZGluZzogU3RyaW5nKCBzZXR0aW5ncy5pMThuLnRpbWVfc2xvdF9tb3JlX2hlYWRpbmcgfHwgJ01vcmUgYm9va2luZ3Mgb24ge2RhdGV9JyApLnJlcGxhY2UoICd7ZGF0ZX0nLCBkYXRlX2xhYmVsICksXG5cdFx0XHRcdFx0aXRlbXM6IGhpZGRlbl9zZWdtZW50cy5tYXAoIGZ1bmN0aW9uICggc2VnbWVudCApIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGJvb2tpbmdfaWQ6IE51bWJlciggc2VnbWVudC5ib29raW5nX2lkICksXG5cdFx0XHRcdFx0XHRcdHNlZ21lbnRfaWQ6IFN0cmluZyggc2VnbWVudC5zZWdtZW50X2lkIHx8ICcnICksXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBTdHJpbmcoIHNlZ21lbnQubGFiZWwgfHwgJycgKSxcblx0XHRcdFx0XHRcdFx0dGltZV9sYWJlbDogU3RyaW5nKCBzZWdtZW50LnRpbWVfc2xvdF90aW1lX2xhYmVsIHx8ICcnICksXG5cdFx0XHRcdFx0XHRcdGR1cmF0aW9uX2xhYmVsOiBTdHJpbmcoIHNlZ21lbnQuZHVyYXRpb25fbGFiZWwgfHwgJycgKSxcblx0XHRcdFx0XHRcdFx0YXJpYV9sYWJlbDogU3RyaW5nKCBzZWdtZW50LmFyaWFfbGFiZWwgfHwgc2VnbWVudC5sYWJlbCB8fCAnJyApXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0gKSxcblx0XHRcdFx0XHRsYW5lX2luZGV4OiAwXG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIG92ZXJmbG93cztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNZXJnZSBzdGFibGUgcHJvamVjdGlvbnMgYW5kIHJlY2FsY3VsYXRlIHRoZWlyIGNvbXBvc2VkLWF4aXMgZ2VvbWV0cnkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IGVudHJpZXMgT3JkZXJlZCBjYWNoZWQgd2luZG93cy5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYXhpcyBDb21wb3NlZCBheGlzIERUTy5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY29sbGVjdGlvbl9rZXkgU2VnbWVudCBvciBvY2N1cGFuY3kgY29sbGVjdGlvbiBrZXkuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gRGVkdXBsaWNhdGVkIHByb2plY3RlZCByZWNvcmRzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbXBvc2VfcHJvamVjdGVkX3JlY29yZHMoIGVudHJpZXMsIGF4aXMsIGNvbGxlY3Rpb25fa2V5ICkge1xuXHRcdFx0dmFyIHJlY29yZF9tYXAgPSB7fTtcblx0XHRcdHZhciByZWNvcmRzID0gW107XG5cblx0XHRcdGVudHJpZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBlbnRyeSApIHtcblx0XHRcdFx0KCBlbnRyeS5wYXlsb2FkWyBjb2xsZWN0aW9uX2tleSBdIHx8IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCBzb3VyY2VfcmVjb3JkICkge1xuXHRcdFx0XHRcdHZhciByZWNvcmRfa2V5ID0gU3RyaW5nKCBzb3VyY2VfcmVjb3JkLnNlZ21lbnRfaWQgfHwgJycgKTtcblx0XHRcdFx0XHR2YXIgc3RhcnRfZXBvY2g7XG5cdFx0XHRcdFx0dmFyIGVuZF9lcG9jaDtcblx0XHRcdFx0XHR2YXIgdmlzaWJsZV9zdGFydF9lcG9jaDtcblx0XHRcdFx0XHR2YXIgdmlzaWJsZV9lbmRfZXBvY2g7XG5cdFx0XHRcdFx0dmFyIHZpc2libGVfc3RhcnQ7XG5cdFx0XHRcdFx0dmFyIHZpc2libGVfZW5kO1xuXHRcdFx0XHRcdHZhciBnZW9tZXRyeTtcblx0XHRcdFx0XHR2YXIgcHJlc2VudGF0aW9uX2dlb21ldHJ5O1xuXHRcdFx0XHRcdHZhciByZWNvcmQ7XG5cblx0XHRcdFx0XHRpZiAoICEgcmVjb3JkX2tleSB8fCByZWNvcmRfbWFwWyByZWNvcmRfa2V5IF0gKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHN0YXJ0X2Vwb2NoID0gTWF0aC5mbG9vciggRGF0ZS5wYXJzZSggc291cmNlX3JlY29yZC5zdGFydCApIC8gMTAwMCApO1xuXHRcdFx0XHRcdGVuZF9lcG9jaCA9IE1hdGguZmxvb3IoIERhdGUucGFyc2UoIHNvdXJjZV9yZWNvcmQuZW5kICkgLyAxMDAwICk7XG5cdFx0XHRcdFx0aWYgKCBlbmRfZXBvY2ggPD0gTnVtYmVyKCBheGlzLnN0YXJ0X2Vwb2NoICkgfHwgc3RhcnRfZXBvY2ggPj0gTnVtYmVyKCBheGlzLmVuZF9lcG9jaCApICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR2aXNpYmxlX3N0YXJ0X2Vwb2NoID0gTWF0aC5tYXgoIHN0YXJ0X2Vwb2NoLCBOdW1iZXIoIGF4aXMuc3RhcnRfZXBvY2ggKSApO1xuXHRcdFx0XHRcdHZpc2libGVfZW5kX2Vwb2NoID0gTWF0aC5taW4oIGVuZF9lcG9jaCwgTnVtYmVyKCBheGlzLmVuZF9lcG9jaCApICk7XG5cdFx0XHRcdFx0Ly8gS2VlcCB0aGUgZXhhY3QgcmVxdWVzdCBpbnN0YW50cyBzeW5jaHJvbml6ZWQgd2l0aCByZWNvbXBvc2VkIGdlb21ldHJ5LlxuXHRcdFx0XHRcdC8vIFJlc2l6ZSBlbGlnaWJpbGl0eSBjb21wYXJlcyB0aGVzZSBpbnN0YW50cyB3aXRoIGNhbm9uaWNhbCBib3VuZGFyaWVzLlxuXHRcdFx0XHRcdHZpc2libGVfc3RhcnQgPSB2aXNpYmxlX3N0YXJ0X2Vwb2NoID09PSBzdGFydF9lcG9jaCA/IHNvdXJjZV9yZWNvcmQuc3RhcnQgOiBheGlzLnN0YXJ0X2F0O1xuXHRcdFx0XHRcdHZpc2libGVfZW5kID0gdmlzaWJsZV9lbmRfZXBvY2ggPT09IGVuZF9lcG9jaCA/IHNvdXJjZV9yZWNvcmQuZW5kIDogYXhpcy5lbmRfYXQ7XG5cdFx0XHRcdFx0Z2VvbWV0cnkgPSBnZXRfY29tcG9zZWRfc2VnbWVudF9nZW9tZXRyeSggYXhpcywgdmlzaWJsZV9zdGFydF9lcG9jaCwgdmlzaWJsZV9lbmRfZXBvY2ggKTtcblx0XHRcdFx0XHRwcmVzZW50YXRpb25fZ2VvbWV0cnkgPSBnZXRfY29tcG9zZWRfcHJlc2VudGF0aW9uX2dlb21ldHJ5KFxuXHRcdFx0XHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRcdFx0XHR0cnVlID09PSBzb3VyY2VfcmVjb3JkLmlzX2Z1bGxfZGF5LFxuXHRcdFx0XHRcdFx0dHJ1ZSA9PT0gc291cmNlX3JlY29yZC5pc19kYXlfdGltZV9zbG90XG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRyZWNvcmQgPSBPYmplY3QuYXNzaWduKCB7fSwgc291cmNlX3JlY29yZCwgZ2VvbWV0cnksIHByZXNlbnRhdGlvbl9nZW9tZXRyeSwge1xuXHRcdFx0XHRcdFx0aXNfY2xpcHBlZF9zdGFydDogc3RhcnRfZXBvY2ggPCBOdW1iZXIoIGF4aXMuc3RhcnRfZXBvY2ggKSxcblx0XHRcdFx0XHRcdGlzX2NsaXBwZWRfZW5kOiBlbmRfZXBvY2ggPiBOdW1iZXIoIGF4aXMuZW5kX2Vwb2NoICksXG5cdFx0XHRcdFx0XHR2aXNpYmxlX3N0YXJ0OiB2aXNpYmxlX3N0YXJ0LFxuXHRcdFx0XHRcdFx0dmlzaWJsZV9lbmQ6IHZpc2libGVfZW5kLFxuXHRcdFx0XHRcdFx0dmlzaWJsZV9zdGFydF9lcG9jaDogdmlzaWJsZV9zdGFydF9lcG9jaCxcblx0XHRcdFx0XHRcdHZpc2libGVfZW5kX2Vwb2NoOiB2aXNpYmxlX2VuZF9lcG9jaCxcblx0XHRcdFx0XHRcdGlzX2NvbXBhY3Q6IHRydWUgPT09IHNvdXJjZV9yZWNvcmQuaXNfZGF5X3RpbWVfc2xvdFxuXHRcdFx0XHRcdFx0XHQ/IGZhbHNlXG5cdFx0XHRcdFx0XHRcdDogcHJlc2VudGF0aW9uX2dlb21ldHJ5LnByZXNlbnRhdGlvbl93aWR0aF9wZXJjZW50IDw9IDEwMCAvIE1hdGgubWF4KCAxLCBheGlzLmNlbGxfY291bnQgKSArIDAuMDAwMDAxXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdHJlY29yZF9tYXBbIHJlY29yZF9rZXkgXSA9IHJlY29yZDtcblx0XHRcdFx0XHRyZWNvcmRzLnB1c2goIHJlY29yZCApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiByZWNvcmRzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgdGhlIGNhbm9uaWNhbCBSZXNvdXJjZSBwcmVzZW50YXRpb24gb3JkZXIgY2FwdHVyZWQgYXQgcmVzZXQuXG5cdFx0ICpcblx0XHQgKiBBZGphY2VudCBleGFjdC1JRCByZWFkcyBhdXRob3JpemUgdGhlIHNhbWUgUmVzb3VyY2Ugc2V0IGluZGVwZW5kZW50bHksXG5cdFx0ICogYnV0IGFuIGVkaXRpb24tc3BlY2lmaWMgcmVwb3NpdG9yeSBtdXN0IG5vdCByZXNodWZmbGUgcGFyZW50IGFuZCBjaGlsZFxuXHRcdCAqIHJvd3Mgd2hlbiB0aGF0IHJlc3BvbnNlIGJlY29tZXMgY3VycmVudC4gVW5rbm93biBJRHMgYXJlIGFwcGVuZGVkXG5cdFx0ICogZGVmZW5zaXZlbHk7IGZpbmdlcnByaW50IHZhbGlkYXRpb24gc3RpbGwgb3ducyBzZXQgZXF1YWxpdHkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IHJlc291cmNlcyBBdXRob3JpemVkIFJlc291cmNlIERUT3MuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gUmVzb3VyY2VzIGluIHN0YWJsZSBwcmVzZW50YXRpb24gb3JkZXIuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb3JkZXJfcmVzb3VyY2VzKCByZXNvdXJjZXMgKSB7XG5cdFx0XHR2YXIgcmVzb3VyY2VzX2J5X2lkID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdFx0dmFyIG9yZGVyZWRfcmVzb3VyY2VzID0gW107XG5cblx0XHRcdCggQXJyYXkuaXNBcnJheSggcmVzb3VyY2VzICkgPyByZXNvdXJjZXMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2UgKSB7XG5cdFx0XHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2UgJiYgcmVzb3VyY2UuaWQgKTtcblxuXHRcdFx0XHRpZiAoIE51bWJlci5pc0ludGVnZXIoIHJlc291cmNlX2lkICkgJiYgMSA8PSByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRyZXNvdXJjZXNfYnlfaWRbIHJlc291cmNlX2lkIF0gPSByZXNvdXJjZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0d2luZG93X3N0b3JlLnJlc291cmNlX29yZGVyLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdGlmICggcmVzb3VyY2VzX2J5X2lkWyByZXNvdXJjZV9pZCBdICkge1xuXHRcdFx0XHRcdG9yZGVyZWRfcmVzb3VyY2VzLnB1c2goIHJlc291cmNlc19ieV9pZFsgcmVzb3VyY2VfaWQgXSApO1xuXHRcdFx0XHRcdGRlbGV0ZSByZXNvdXJjZXNfYnlfaWRbIHJlc291cmNlX2lkIF07XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdE9iamVjdC5rZXlzKCByZXNvdXJjZXNfYnlfaWQgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRvcmRlcmVkX3Jlc291cmNlcy5wdXNoKCByZXNvdXJjZXNfYnlfaWRbIHJlc291cmNlX2lkIF0gKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIG9yZGVyZWRfcmVzb3VyY2VzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbXBvc2Ugb25lIHRlbXBsYXRlLXJlYWR5IHZpZXcgZnJvbSB0aGUgYm91bmRlZCBjYWNoZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBDb21wb3NlZCB2aWV3IG9yIG51bGwgd2l0aG91dCBhIGN1cnJlbnQgd2luZG93LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbXBvc2UoKSB7XG5cdFx0XHR2YXIgZW50cmllcyA9IGdldF9vcmRlcmVkX3dpbmRvd19lbnRyaWVzKCk7XG5cdFx0XHR2YXIgY3VycmVudF9wYXlsb2FkID0gd2luZG93X3N0b3JlLndpbmRvd3NbIHdpbmRvd19zdG9yZS5jdXJyZW50X2tleSBdO1xuXHRcdFx0dmFyIGF4aXM7XG5cdFx0XHR2YXIgc2VnbWVudHM7XG5cdFx0XHR2YXIgb2NjdXBhbmN5O1xuXHRcdFx0dmFyIHRpbWVfc2xvdF9vdmVyZmxvd3M7XG5cdFx0XHR2YXIgbGFuZV9jb3VudHM7XG5cdFx0XHR2YXIgcmVzb3VyY2VzO1xuXG5cdFx0XHRpZiAoICEgY3VycmVudF9wYXlsb2FkIHx8ICEgZW50cmllcy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0YXhpcyA9IGNvbXBvc2VfY2FjaGVkX2F4aXMoIGVudHJpZXMsIGN1cnJlbnRfcGF5bG9hZCApO1xuXHRcdFx0c2VnbWVudHMgPSBjb21wb3NlX3Byb2plY3RlZF9yZWNvcmRzKCBlbnRyaWVzLCBheGlzLCAnc2VnbWVudHMnICk7XG5cdFx0XHRvY2N1cGFuY3kgPSBjb21wb3NlX3Byb2plY3RlZF9yZWNvcmRzKCBlbnRyaWVzLCBheGlzLCAnb2NjdXBhbmN5JyApO1xuXHRcdFx0dGltZV9zbG90X292ZXJmbG93cyA9IGJ1aWxkX2NvbXBvc2VkX3RpbWVfc2xvdF9vdmVyZmxvd3MoIHNlZ21lbnRzICk7XG5cdFx0XHRsYW5lX2NvdW50cyA9IGFzc2lnbl9jb21wb3NlZF9zZWdtZW50X2xhbmVzKCBzZWdtZW50cywgdGltZV9zbG90X292ZXJmbG93cyApO1xuXHRcdFx0cmVzb3VyY2VzID0gb3JkZXJfcmVzb3VyY2VzKCBjdXJyZW50X3BheWxvYWQucmVzb3VyY2VzICkubWFwKCBmdW5jdGlvbiAoIHJlc291cmNlICkge1xuXHRcdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbigge30sIHJlc291cmNlLCB7XG5cdFx0XHRcdFx0bGFuZV9jb3VudDogbGFuZV9jb3VudHNbIE51bWJlciggcmVzb3VyY2UuaWQgKSBdIHx8IDFcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjdXJyZW50OiBjdXJyZW50X3BheWxvYWQsXG5cdFx0XHRcdGF4aXM6IGF4aXMsXG5cdFx0XHRcdHJlc291cmNlczogcmVzb3VyY2VzLFxuXHRcdFx0XHRzZWdtZW50czogc2VnbWVudHMsXG5cdFx0XHRcdG9jY3VwYW5jeTogb2NjdXBhbmN5LFxuXHRcdFx0XHR0aW1lX3Nsb3Rfb3ZlcmZsb3dzOiB0aW1lX3Nsb3Rfb3ZlcmZsb3dzXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgb3V0ZXIgY2FjaGVkIGVudHJ5IHVzZWQgdG8gcmVxdWVzdCBhbiBhZGphY2VudCB3aW5kb3cuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZGlyZWN0aW9uIFByZXZpb3VzIG9yIG5leHQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE91dGVyIGNhY2hlIGVudHJ5IG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2VkZ2Vfd2luZG93X2VudHJ5KCBkaXJlY3Rpb24gKSB7XG5cdFx0XHR2YXIgZW50cmllcyA9IGdldF9vcmRlcmVkX3dpbmRvd19lbnRyaWVzKCk7XG5cblx0XHRcdGlmICggISBlbnRyaWVzLmxlbmd0aCB8fCAtMSA9PT0gWyAncHJldmlvdXMnLCAnbmV4dCcgXS5pbmRleE9mKCBkaXJlY3Rpb24gKSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAncHJldmlvdXMnID09PSBkaXJlY3Rpb24gPyBlbnRyaWVzWyAwIF0gOiBlbnRyaWVzWyBlbnRyaWVzLmxlbmd0aCAtIDEgXTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcm9tb3RlIHRoZSBjYWNoZWQgcmVzcG9uc2UgY29udGFpbmluZyBhbiBhbmNob3IgdG8gbG9naWNhbCBjdXJyZW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGFuY2hvciBDYXB0dXJlZCBzZXJ2ZXItb2Zmc2V0IHRpbWVzdGFtcCBhbmNob3IuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFByb21vdGlvbiByZXN1bHQsIG9yIG51bGwgd2hlbiB1bmNoYW5nZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcHJvbW90ZV9mb3JfYW5jaG9yKCBhbmNob3IgKSB7XG5cdFx0XHR2YXIgYW5jaG9yX2Vwb2NoID0gTWF0aC5mbG9vciggRGF0ZS5wYXJzZSggYW5jaG9yICYmIGFuY2hvci5hdCA/IGFuY2hvci5hdCA6ICcnICkgLyAxMDAwICk7XG5cdFx0XHR2YXIgcHJvbW90ZWRfZW50cnkgPSBudWxsO1xuXG5cdFx0XHRnZXRfb3JkZXJlZF93aW5kb3dfZW50cmllcygpLnNvbWUoIGZ1bmN0aW9uICggZW50cnkgKSB7XG5cdFx0XHRcdGlmICggYW5jaG9yX2Vwb2NoID49IE51bWJlciggZW50cnkucGF5bG9hZC5heGlzLnN0YXJ0X2Vwb2NoICkgJiYgYW5jaG9yX2Vwb2NoIDwgTnVtYmVyKCBlbnRyeS5wYXlsb2FkLmF4aXMuZW5kX2Vwb2NoICkgKSB7XG5cdFx0XHRcdFx0cHJvbW90ZWRfZW50cnkgPSBlbnRyeTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICEgcHJvbW90ZWRfZW50cnkgfHwgcHJvbW90ZWRfZW50cnkua2V5ID09PSB3aW5kb3dfc3RvcmUuY3VycmVudF9rZXkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0d2luZG93X3N0b3JlLmN1cnJlbnRfa2V5ID0gcHJvbW90ZWRfZW50cnkua2V5O1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRlbnRyeTogcHJvbW90ZWRfZW50cnksXG5cdFx0XHRcdHRyaW1tZWQ6IHRyaW0oKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYSByZWFkLW9ubHkgc25hcHNob3Qgb2Ygb25lIGNvbnRyb2xsZXItb3duZWQgZWRnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gRWRnZS1zdGF0ZSBzbmFwc2hvdCBvciBudWxsIGZvciBhbiBpbnZhbGlkIGRpcmVjdGlvbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZWRnZV9zdGF0ZSggZGlyZWN0aW9uICkge1xuXHRcdFx0cmV0dXJuIGVkZ2Vfc3RhdGVzWyBkaXJlY3Rpb24gXSA/IE9iamVjdC5hc3NpZ24oIHt9LCBlZGdlX3N0YXRlc1sgZGlyZWN0aW9uIF0gKSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3VzcGVuZCBhdXRvbWF0aWMgbG9hZGluZyBiZWZvcmUgcHJvZ3JhbW1hdGljIGNhbnZhcyBtb3ZlbWVudC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3VzcGVuZF9hZGphY2VudF9sb2FkaW5nKCkge1xuXHRcdFx0Y2FudmFzX3BvaW50ZXJfbmF2aWdhdGlvbl9hY3RpdmUgPSBmYWxzZTtcblx0XHRcdFsgJ3ByZXZpb3VzJywgJ25leHQnIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBkaXJlY3Rpb24gKSB7XG5cdFx0XHRcdHZhciBzdGF0ZSA9IGVkZ2Vfc3RhdGVzWyBkaXJlY3Rpb24gXTtcblxuXHRcdFx0XHRpZiAoICdpZGxlJyAhPT0gc3RhdGUuc3RhdHVzICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGF0ZS5hcm1lZCA9IGZhbHNlO1xuXHRcdFx0XHRzdGF0ZS51c2VyX2ludGVudCA9IGZhbHNlO1xuXHRcdFx0XHRzdGF0ZS5yZWVudHJ5X3JlcXVpcmVkID0gZmFsc2U7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVjb3JkIGRlbGliZXJhdGUgbmF2aWdhdGlvbiB0b3dhcmQgYW4gYWRqYWNlbnQgZWRnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGZvcmNlIFdoZXRoZXIgYW4gZXhwbGljaXQgY29udHJvbCBieXBhc3NlcyByZWVudHJ5LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBpbnRlbnQgd2FzIGFjY2VwdGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFjdGl2YXRlX2FkamFjZW50X2ludGVudCggZGlyZWN0aW9uLCBmb3JjZSApIHtcblx0XHRcdHZhciBzdGF0ZSA9IGVkZ2Vfc3RhdGVzWyBkaXJlY3Rpb24gXTtcblxuXHRcdFx0aWYgKCAhIHN0YXRlIHx8ICdpZGxlJyAhPT0gc3RhdGUuc3RhdHVzIHx8ICggc3RhdGUucmVlbnRyeV9yZXF1aXJlZCAmJiAhIGZvcmNlICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHN0YXRlLmFybWVkID0gdHJ1ZTtcblx0XHRcdHN0YXRlLnVzZXJfaW50ZW50ID0gdHJ1ZTtcblx0XHRcdGlmICggZm9yY2UgKSB7XG5cdFx0XHRcdHN0YXRlLnJlZW50cnlfcmVxdWlyZWQgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVjb3JkIHdoZXRoZXIgYSBwb2ludGVyIG1heSBiZSBkcml2aW5nIG5hdGl2ZSBob3Jpem9udGFsIG1vdmVtZW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19hY3RpdmUgV2hldGhlciBwb2ludGVyIG5hdmlnYXRpb24gaXMgYWN0aXZlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3BvaW50ZXJfbmF2aWdhdGlvbl9hY3RpdmUoIGlzX2FjdGl2ZSApIHtcblx0XHRcdGNhbnZhc19wb2ludGVyX25hdmlnYXRpb25fYWN0aXZlID0gQm9vbGVhbiggaXNfYWN0aXZlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVXBkYXRlIHJlZW50cnkgYW5kIHJldHVybiB3aGV0aGVyIG9uZSBlZGdlIG1heSByZXF1ZXN0IG5vdy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX25lYXJfcmVhcm0gV2hldGhlciBzZW50aW5lbCBpcyB3aXRoaW4gcmVhcm0gem9uZS5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX25lYXJfcHJlZmV0Y2ggV2hldGhlciBzZW50aW5lbCBpcyBpbiByZXF1ZXN0IHpvbmUuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjYWxsZXIgc2hvdWxkIHJlcXVlc3QgdGhpcyBlZGdlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHVwZGF0ZV9lZGdlX3Byb3hpbWl0eSggZGlyZWN0aW9uLCBpc19uZWFyX3JlYXJtLCBpc19uZWFyX3ByZWZldGNoICkge1xuXHRcdFx0dmFyIHN0YXRlID0gZWRnZV9zdGF0ZXNbIGRpcmVjdGlvbiBdO1xuXG5cdFx0XHRpZiAoICEgc3RhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhdGUucmVlbnRyeV9yZXF1aXJlZCAmJiAhIGlzX25lYXJfcmVhcm0gKSB7XG5cdFx0XHRcdHN0YXRlLnJlZW50cnlfcmVxdWlyZWQgPSBmYWxzZTtcblx0XHRcdFx0c3RhdGUuYXJtZWQgPSBmYWxzZTtcblx0XHRcdFx0c3RhdGUudXNlcl9pbnRlbnQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggY2FudmFzX3BvaW50ZXJfbmF2aWdhdGlvbl9hY3RpdmUgKSB7XG5cdFx0XHRcdGFjdGl2YXRlX2FkamFjZW50X2ludGVudCggZGlyZWN0aW9uLCBmYWxzZSApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggc3RhdGUuYXJtZWQgJiYgc3RhdGUudXNlcl9pbnRlbnQgJiYgJ2lkbGUnID09PSBzdGF0ZS5zdGF0dXMgJiYgaXNfbmVhcl9wcmVmZXRjaCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN0YXJ0IG9uZSBmb3JlZ3JvdW5kIGdlbmVyYXRpb24gYW5kIGFib3J0IGl0cyBvYnNvbGV0ZSBwcmVkZWNlc3Nvci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gTmV3IHJlcXVlc3QgZ2VuZXJhdGlvbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBiZWdpbl9mb3JlZ3JvdW5kX3JlcXVlc3QoKSB7XG5cdFx0XHR2YXIgcmVxdWVzdF90b19hYm9ydCA9IGFjdGl2ZV9yZXF1ZXN0O1xuXG5cdFx0XHRyZXF1ZXN0X2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGFjdGl2ZV9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdGlmICggcmVxdWVzdF90b19hYm9ydCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcmVxdWVzdF90b19hYm9ydC5hYm9ydCApIHtcblx0XHRcdFx0cmVxdWVzdF90b19hYm9ydC5hYm9ydCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVxdWVzdF9nZW5lcmF0aW9uO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEF0dGFjaCBhIHRyYW5zcG9ydCB0byBpdHMgY3VycmVudCBmb3JlZ3JvdW5kIGdlbmVyYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZ2VuZXJhdGlvbiBSZXF1ZXN0IGdlbmVyYXRpb24uXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3QgQWJvcnRhYmxlIHRyYW5zcG9ydC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHRyYW5zcG9ydCByZW1haW5zIGN1cnJlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X2ZvcmVncm91bmRfcmVxdWVzdCggZ2VuZXJhdGlvbiwgcmVxdWVzdCApIHtcblx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRpZiAoIHJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGFjdGl2ZV9yZXF1ZXN0ID0gcmVxdWVzdCB8fCBudWxsO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IHdoZXRoZXIgYSBmb3JlZ3JvdW5kIGNhbGxiYWNrIHN0aWxsIG93bnMgY3VycmVudCBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBnZW5lcmF0aW9uIFJlcXVlc3QgZ2VuZXJhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gY3VycmVudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19mb3JlZ3JvdW5kX2dlbmVyYXRpb25fY3VycmVudCggZ2VuZXJhdGlvbiApIHtcblx0XHRcdHJldHVybiBnZW5lcmF0aW9uID09PSByZXF1ZXN0X2dlbmVyYXRpb247XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVsZWFzZSB0aGUgY3VycmVudCBmb3JlZ3JvdW5kIHRyYW5zcG9ydCB3aXRob3V0IGNoYW5naW5nIGdlbmVyYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZ2VuZXJhdGlvbiBSZXF1ZXN0IGdlbmVyYXRpb24uXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHJlbGVhc2VkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbXBsZXRlX2ZvcmVncm91bmRfcmVxdWVzdCggZ2VuZXJhdGlvbiApIHtcblx0XHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gcmVxdWVzdF9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBYm9ydCBhbmQgaW52YWxpZGF0ZSB0aGUgY3VycmVudCBmb3JlZ3JvdW5kIHRyYW5zcG9ydC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhbiBhYm9ydGFibGUgcmVxdWVzdCBleGlzdGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFib3J0X2ZvcmVncm91bmRfcmVxdWVzdCgpIHtcblx0XHRcdHZhciByZXF1ZXN0X3RvX2Fib3J0ID0gYWN0aXZlX3JlcXVlc3Q7XG5cblx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0YWN0aXZlX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0aWYgKCAhIHJlcXVlc3RfdG9fYWJvcnQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHJlcXVlc3RfdG9fYWJvcnQuYWJvcnQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJlcXVlc3RfdG9fYWJvcnQuYWJvcnQoKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN0YXJ0IG9uZSBhZGphY2VudCByZXF1ZXN0IGdlbmVyYXRpb24gYW5kIG1hcmsgaXRzIGVkZ2UgYnVzeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGFsbG93X3dpdGhvdXRfdXNlcl9pbnRlbnQgV2hldGhlciBmb3JlZ3JvdW5kIHByaW1pbmcgbWF5IGJ5cGFzcyB1c2VyIGludGVudC5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IE5ldyBnZW5lcmF0aW9uLCBvciB6ZXJvIGZvciBhbiBpbnZhbGlkL2J1c3kgZWRnZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBiZWdpbl9lZGdlX3JlcXVlc3QoIGRpcmVjdGlvbiwgYWxsb3dfd2l0aG91dF91c2VyX2ludGVudCApIHtcblx0XHRcdHZhciBzdGF0ZSA9IGVkZ2Vfc3RhdGVzWyBkaXJlY3Rpb24gXTtcblxuXHRcdFx0aWYgKCAhIHN0YXRlIHx8ICdpZGxlJyAhPT0gc3RhdGUuc3RhdHVzIHx8ICggISBhbGxvd193aXRob3V0X3VzZXJfaW50ZW50ICYmICggISBzdGF0ZS5hcm1lZCB8fCAhIHN0YXRlLnVzZXJfaW50ZW50ICkgKSApIHtcblx0XHRcdFx0cmV0dXJuIDA7XG5cdFx0XHR9XG5cdFx0XHRlZGdlX3JlcXVlc3RfZ2VuZXJhdGlvbnNbIGRpcmVjdGlvbiBdICs9IDE7XG5cdFx0XHRzdGF0ZS5hcm1lZCA9IGZhbHNlO1xuXHRcdFx0c3RhdGUudXNlcl9pbnRlbnQgPSBmYWxzZTtcblx0XHRcdHN0YXRlLnJlZW50cnlfcmVxdWlyZWQgPSB0cnVlO1xuXHRcdFx0c3RhdGUuc3RhdHVzID0gJ2xvYWRpbmcnO1xuXHRcdFx0cmV0dXJuIGVkZ2VfcmVxdWVzdF9nZW5lcmF0aW9uc1sgZGlyZWN0aW9uIF07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXR0YWNoIGFuIGFkamFjZW50IHRyYW5zcG9ydCB0byBpdHMgY3VycmVudCBnZW5lcmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGRpcmVjdGlvbiBQcmV2aW91cyBvciBuZXh0LlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBnZW5lcmF0aW9uIEVkZ2UgZ2VuZXJhdGlvbi5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdCBBYm9ydGFibGUgdHJhbnNwb3J0LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhdHRhY2hlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfZWRnZV9yZXF1ZXN0KCBkaXJlY3Rpb24sIGdlbmVyYXRpb24sIHJlcXVlc3QgKSB7XG5cdFx0XHRpZiAoICEgaXNfZWRnZV9nZW5lcmF0aW9uX2N1cnJlbnQoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiApICkge1xuXHRcdFx0XHRpZiAoIHJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGVkZ2VfcmVxdWVzdHNbIGRpcmVjdGlvbiBdID0gcmVxdWVzdCB8fCBudWxsO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwb3J0IHdoZXRoZXIgYW4gYWRqYWNlbnQgY2FsbGJhY2sgc3RpbGwgb3ducyBpdHMgZWRnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZ2VuZXJhdGlvbiBFZGdlIGdlbmVyYXRpb24uXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGN1cnJlbnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfZWRnZV9nZW5lcmF0aW9uX2N1cnJlbnQoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiApIHtcblx0XHRcdHJldHVybiBCb29sZWFuKCBlZGdlX3N0YXRlc1sgZGlyZWN0aW9uIF0gJiYgZ2VuZXJhdGlvbiA9PT0gZWRnZV9yZXF1ZXN0X2dlbmVyYXRpb25zWyBkaXJlY3Rpb24gXSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgY3VycmVudCBhZGphY2VudCByZXF1ZXN0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGRpcmVjdGlvbiBQcmV2aW91cyBvciBuZXh0LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBSZXF1ZXN0IHRyYW5zcG9ydCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9lZGdlX3JlcXVlc3QoIGRpcmVjdGlvbiApIHtcblx0XHRcdHJldHVybiBlZGdlX3JlcXVlc3RzWyBkaXJlY3Rpb24gXSB8fCBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN0YXJ0IHRoZSBzbG93LXJlc3BvbnNlIHRpbWVyIGZvciBvbmUgY3VycmVudCBhZGphY2VudCByZXF1ZXN0LlxuXHRcdCAqXG5cdFx0ICogVGhlIGNvbnRyb2xsZXIgb3ducyB0aGUgdGltZXIgYW5kIHN0YXR1cyB0cmFuc2l0aW9uIHdoaWxlIHRoZSBjYWxsZXJcblx0XHQgKiByZW1haW5zIHJlc3BvbnNpYmxlIG9ubHkgZm9yIHJlcGFpbnRpbmcgdGhlIGRvbWFpbi1uZXV0cmFsIGVkZ2Ugc2hlbGwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gICBnZW5lcmF0aW9uIEVkZ2UgZ2VuZXJhdGlvbi5cblx0XHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvbl9zbG93IENhbGxiYWNrIGFmdGVyIHRoZSBjdXJyZW50IGVkZ2UgYmVjb21lcyBzbG93LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgdGltZXIgd2FzIHNjaGVkdWxlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzY2hlZHVsZV9lZGdlX3Nsb3dfc3RhdGUoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiwgb25fc2xvdyApIHtcblx0XHRcdHZhciBzdGF0ZSA9IGVkZ2Vfc3RhdGVzWyBkaXJlY3Rpb24gXTtcblxuXHRcdFx0aWYgKCAhIHN0YXRlIHx8ICEgaXNfZWRnZV9nZW5lcmF0aW9uX2N1cnJlbnQoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN0YXRlLnNsb3dfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHN0YXRlLnNsb3dfdGltZXIgKTtcblx0XHRcdH1cblx0XHRcdHN0YXRlLnNsb3dfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzdGF0ZS5zbG93X3RpbWVyID0gMDtcblx0XHRcdFx0aWYgKCAhIGdldF9lZGdlX3JlcXVlc3QoIGRpcmVjdGlvbiApIHx8ICEgaXNfZWRnZV9nZW5lcmF0aW9uX2N1cnJlbnQoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGF0ZS5zdGF0dXMgPSAnc2xvdyc7XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9uX3Nsb3cgKSB7XG5cdFx0XHRcdFx0b25fc2xvdygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBnZXRfbG9hZGluZ19saW1pdHMoKS5zbG93X2xvYWRpbmdfbXMgKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTWFyayBvbmUgY3VycmVudCBhZGphY2VudCByZXF1ZXN0IGFzIGZhaWxlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZ2VuZXJhdGlvbiBFZGdlIGdlbmVyYXRpb24uXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjdXJyZW50IGVkZ2Ugd2FzIHVwZGF0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbWFya19lZGdlX2Vycm9yKCBkaXJlY3Rpb24sIGdlbmVyYXRpb24gKSB7XG5cdFx0XHR2YXIgc3RhdGUgPSBlZGdlX3N0YXRlc1sgZGlyZWN0aW9uIF07XG5cblx0XHRcdGlmICggISBzdGF0ZSB8fCAhIGlzX2VkZ2VfZ2VuZXJhdGlvbl9jdXJyZW50KCBkaXJlY3Rpb24sIGdlbmVyYXRpb24gKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdGF0ZS5zbG93X3RpbWVyICkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzdGF0ZS5zbG93X3RpbWVyICk7XG5cdFx0XHRcdHN0YXRlLnNsb3dfdGltZXIgPSAwO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUuc3RhdHVzID0gJ2Vycm9yJztcblx0XHRcdHN0YXRlLmNvb2xkb3duX3VudGlsID0gRGF0ZS5ub3coKSArIGdldF9sb2FkaW5nX2xpbWl0cygpLnJlcXVlc3RfY29vbGRvd25fbXM7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNldCB0aGUgcG9zdC1sb2FkIGVkZ2Ugc3RhdGUgYWZ0ZXIgYW4gYXV0aG9yaXplZCByZXNwb25zZSBpcyByZW5kZXJlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZ2VuZXJhdGlvbiBFZGdlIGdlbmVyYXRpb24uXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjdXJyZW50IGVkZ2Ugd2FzIHVwZGF0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbWFya19lZGdlX2xvYWRlZCggZGlyZWN0aW9uLCBnZW5lcmF0aW9uICkge1xuXHRcdFx0dmFyIHN0YXRlID0gZWRnZV9zdGF0ZXNbIGRpcmVjdGlvbiBdO1xuXG5cdFx0XHRpZiAoICEgc3RhdGUgfHwgISBpc19lZGdlX2dlbmVyYXRpb25fY3VycmVudCggZGlyZWN0aW9uLCBnZW5lcmF0aW9uICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggc3RhdGUuc2xvd190aW1lciApIHtcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggc3RhdGUuc2xvd190aW1lciApO1xuXHRcdFx0XHRzdGF0ZS5zbG93X3RpbWVyID0gMDtcblx0XHRcdH1cblx0XHRcdHN0YXRlLnN0YXR1cyA9ICdpZGxlJztcblx0XHRcdHN0YXRlLmNvb2xkb3duX3VudGlsID0gRGF0ZS5ub3coKSArIGdldF9sb2FkaW5nX2xpbWl0cygpLnJlcXVlc3RfY29vbGRvd25fbXM7XG5cdFx0XHRzdGF0ZS5hcm1lZCA9IGZhbHNlO1xuXHRcdFx0c3RhdGUudXNlcl9pbnRlbnQgPSBmYWxzZTtcblx0XHRcdHN0YXRlLnJlZW50cnlfcmVxdWlyZWQgPSB0cnVlO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDbGVhciBhIHJlY292ZXJhYmxlIGVkZ2UgZXJyb3IgYmVmb3JlIGFuIGV4cGxpY2l0IHJldHJ5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGRpcmVjdGlvbiBQcmV2aW91cyBvciBuZXh0LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgZWRnZSBjYW4gYmUgcmV0cmllZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwcmVwYXJlX2VkZ2VfcmV0cnkoIGRpcmVjdGlvbiApIHtcblx0XHRcdHZhciBzdGF0ZSA9IGVkZ2Vfc3RhdGVzWyBkaXJlY3Rpb24gXTtcblxuXHRcdFx0aWYgKCAhIHN0YXRlIHx8IGVkZ2VfcmVxdWVzdHNbIGRpcmVjdGlvbiBdICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHN0YXRlLnNsb3dfdGltZXIgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHN0YXRlLnNsb3dfdGltZXIgKTtcblx0XHRcdFx0c3RhdGUuc2xvd190aW1lciA9IDA7XG5cdFx0XHR9XG5cdFx0XHRzdGF0ZS5zdGF0dXMgPSAnaWRsZSc7XG5cdFx0XHRzdGF0ZS5jb29sZG93bl91bnRpbCA9IDA7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbGVhc2Ugb25lIGFkamFjZW50IHRyYW5zcG9ydCBpZiBpdHMgZ2VuZXJhdGlvbiByZW1haW5zIGN1cnJlbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZGlyZWN0aW9uIFByZXZpb3VzIG9yIG5leHQuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGdlbmVyYXRpb24gRWRnZSBnZW5lcmF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiByZWxlYXNlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjb21wbGV0ZV9lZGdlX3JlcXVlc3QoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiApIHtcblx0XHRcdHZhciBzdGF0ZSA9IGVkZ2Vfc3RhdGVzWyBkaXJlY3Rpb24gXTtcblxuXHRcdFx0aWYgKCAhIGlzX2VkZ2VfZ2VuZXJhdGlvbl9jdXJyZW50KCBkaXJlY3Rpb24sIGdlbmVyYXRpb24gKSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdGF0ZS5zbG93X3RpbWVyICkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzdGF0ZS5zbG93X3RpbWVyICk7XG5cdFx0XHRcdHN0YXRlLnNsb3dfdGltZXIgPSAwO1xuXHRcdFx0fVxuXHRcdFx0ZWRnZV9yZXF1ZXN0c1sgZGlyZWN0aW9uIF0gPSBudWxsO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FuY2VsIG9uZSBhZGphY2VudCByZXF1ZXN0IGFuZCByZXF1aXJlIHRocmVzaG9sZCByZWVudHJ5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGRpcmVjdGlvbiBQcmV2aW91cyBvciBuZXh0LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhbiBhYm9ydGFibGUgcmVxdWVzdCB3YXMgY2FuY2VsbGVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhbmNlbF9lZGdlX3JlcXVlc3QoIGRpcmVjdGlvbiApIHtcblx0XHRcdHZhciByZXF1ZXN0ID0gZWRnZV9yZXF1ZXN0c1sgZGlyZWN0aW9uIF07XG5cdFx0XHR2YXIgc3RhdGUgPSBlZGdlX3N0YXRlc1sgZGlyZWN0aW9uIF07XG5cblx0XHRcdGlmICggISByZXF1ZXN0IHx8ICEgc3RhdGUgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHJlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGVkZ2VfcmVxdWVzdF9nZW5lcmF0aW9uc1sgZGlyZWN0aW9uIF0gKz0gMTtcblx0XHRcdGVkZ2VfcmVxdWVzdHNbIGRpcmVjdGlvbiBdID0gbnVsbDtcblx0XHRcdGlmICggc3RhdGUuc2xvd190aW1lciApIHtcblx0XHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggc3RhdGUuc2xvd190aW1lciApO1xuXHRcdFx0fVxuXHRcdFx0c3RhdGUuc2xvd190aW1lciA9IDA7XG5cdFx0XHRzdGF0ZS5zdGF0dXMgPSAnaWRsZSc7XG5cdFx0XHRzdGF0ZS5hcm1lZCA9IGZhbHNlO1xuXHRcdFx0c3RhdGUudXNlcl9pbnRlbnQgPSBmYWxzZTtcblx0XHRcdHN0YXRlLnJlZW50cnlfcmVxdWlyZWQgPSB0cnVlO1xuXHRcdFx0c3RhdGUuY29vbGRvd25fdW50aWwgPSBEYXRlLm5vdygpICsgZ2V0X2xvYWRpbmdfbGltaXRzKCkucmVxdWVzdF9jb29sZG93bl9tcztcblx0XHRcdHJlcXVlc3QuYWJvcnQoKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIExvY2F0ZSB0aGUgc2VydmVyIGF4aXMgY2VsbCBuZWFyZXN0IHRoZSB2aXNpYmxlIGNhbnZhcyBjZW50ZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IE9mZnNldC1leHBsaWNpdCB0aW1lc3RhbXAgYW5kIHZpZXdwb3J0IGdlb21ldHJ5LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNhcHR1cmVfYXhpc19hbmNob3IoKSB7XG5cdFx0XHR2YXIgY2FudmFzID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXNdJyApIDogbnVsbDtcblx0XHRcdHZhciBmb2N1c2VkX2NlbGwgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQuY2xvc2VzdCA/IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtYXhpcy1jZWxsXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgY2VsbHMgPSBtb3VudCA/IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLWF4aXMtY2VsbF0nICkgOiBbXTtcblx0XHRcdHZhciB0YXJnZXRfY2VsbCA9IGZvY3VzZWRfY2VsbDtcblx0XHRcdHZhciB0YXJnZXRfaW5kZXggPSAwO1xuXHRcdFx0dmFyIGNlbnRlcl94O1xuXHRcdFx0dmFyIGNsb3Nlc3RfZGlzdGFuY2UgPSBJbmZpbml0eTtcblxuXHRcdFx0aWYgKCAhIGNhbnZhcyB8fCAhIGNlbGxzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIHsgYXQ6IHNldHRpbmdzLmF4aXMuYW5jaG9yLmF0LCByYXRpbzogMC41LCByZXN0b3JlX2ZvY3VzOiBmYWxzZSB9O1xuXHRcdFx0fVxuXHRcdFx0Y2VudGVyX3ggPSBjYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdCArIGNhbnZhcy5jbGllbnRXaWR0aCAvIDI7XG5cdFx0XHRpZiAoICEgdGFyZ2V0X2NlbGwgKSB7XG5cdFx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGNlbGxzLCBmdW5jdGlvbiAoIGNlbGwsIGNlbGxfaW5kZXggKSB7XG5cdFx0XHRcdFx0dmFyIHJlY3RhbmdsZSA9IGNlbGwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdFx0dmFyIGRpc3RhbmNlID0gTWF0aC5hYnMoIHJlY3RhbmdsZS5sZWZ0ICsgcmVjdGFuZ2xlLndpZHRoIC8gMiAtIGNlbnRlcl94ICk7XG5cblx0XHRcdFx0XHRpZiAoIGRpc3RhbmNlIDwgY2xvc2VzdF9kaXN0YW5jZSApIHtcblx0XHRcdFx0XHRcdGNsb3Nlc3RfZGlzdGFuY2UgPSBkaXN0YW5jZTtcblx0XHRcdFx0XHRcdHRhcmdldF9jZWxsID0gY2VsbDtcblx0XHRcdFx0XHRcdHRhcmdldF9pbmRleCA9IGNlbGxfaW5kZXg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0YXJnZXRfaW5kZXggPSBBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKCBjZWxscywgdGFyZ2V0X2NlbGwgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0YXQ6IHNldHRpbmdzLmF4aXMuY2VsbHNbIE1hdGgubWF4KCAwLCB0YXJnZXRfaW5kZXggKSBdLnN0YXJ0X2F0LFxuXHRcdFx0XHRyYXRpbzogY2FudmFzLmNsaWVudFdpZHRoID8gTWF0aC5tYXgoIDAsIE1hdGgubWluKCAxLCAoIHRhcmdldF9jZWxsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmxlZnQgKyB0YXJnZXRfY2VsbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aCAvIDIgLSBjYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdCApIC8gY2FudmFzLmNsaWVudFdpZHRoICkgKSA6IDAuNSxcblx0XHRcdFx0dmlld3BvcnRfb2Zmc2V0X3B4OiB0YXJnZXRfY2VsbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5sZWZ0ICsgdGFyZ2V0X2NlbGwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGggLyAyIC0gY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmxlZnQsXG5cdFx0XHRcdHJlc3RvcmVfZm9jdXM6IEJvb2xlYW4oIGZvY3VzZWRfY2VsbCApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgYW4gYW5jaG9yIGJ5IG1vdmluZyBvbmx5IHRoZSBhdXRob3JpdGF0aXZlIFRpbWVsaW5lIGNhbnZhcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhbmNob3IgQ2FwdHVyZWQgYW5jaG9yIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcnxudWxsfSBSZW1haW5pbmcgZXJyb3IsIG9yIG51bGwgd2l0aG91dCBhIHJlbmRlcmVkIHRhcmdldC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXN0b3JlX2F4aXNfYW5jaG9yKCBhbmNob3IgKSB7XG5cdFx0XHR2YXIgY2FudmFzID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXNdJyApIDogbnVsbDtcblx0XHRcdHZhciBoZWFkZXJfY2VsbHMgPSBtb3VudCA/IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLWF4aXMtY2VsbF0nICkgOiBbXTtcblx0XHRcdHZhciBjYW52YXNfY2VsbHMgPSBjYW52YXMgPyBjYW52YXMucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtY2FudmFzLWFuY2hvci1jZWxsXScgKSA6IFtdO1xuXHRcdFx0dmFyIGNlbGxzID0gY2FudmFzX2NlbGxzLmxlbmd0aCA/IGNhbnZhc19jZWxscyA6IGhlYWRlcl9jZWxscztcblx0XHRcdHZhciBhbmNob3JfZXBvY2ggPSBNYXRoLmZsb29yKCBEYXRlLnBhcnNlKCBhbmNob3IuYXQgKSAvIDEwMDAgKTtcblx0XHRcdHZhciB0YXJnZXRfY2VsbCA9IG51bGw7XG5cdFx0XHR2YXIgZm9jdXNfY2VsbCA9IG51bGw7XG5cdFx0XHR2YXIgdGFyZ2V0X3N0YXJ0X2Vwb2NoID0gMDtcblx0XHRcdHZhciB0YXJnZXRfZW5kX2Vwb2NoID0gMDtcblx0XHRcdHZhciByZW1haW5pbmdfZXJyb3IgPSBudWxsO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuc29tZS5jYWxsKCBjZWxscywgZnVuY3Rpb24gKCBjZWxsICkge1xuXHRcdFx0XHR2YXIgc3RhcnRfZXBvY2ggPSBOdW1iZXIoIGNlbGwuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWNlbGwtc3RhcnQnICkgKTtcblx0XHRcdFx0dmFyIGVuZF9lcG9jaCA9IE51bWJlciggY2VsbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtY2VsbC1lbmQnICkgKTtcblxuXHRcdFx0XHRpZiAoIGFuY2hvcl9lcG9jaCA+PSBzdGFydF9lcG9jaCAmJiBhbmNob3JfZXBvY2ggPCBlbmRfZXBvY2ggKSB7XG5cdFx0XHRcdFx0dGFyZ2V0X2NlbGwgPSBjZWxsO1xuXHRcdFx0XHRcdHRhcmdldF9zdGFydF9lcG9jaCA9IHN0YXJ0X2Vwb2NoO1xuXHRcdFx0XHRcdHRhcmdldF9lbmRfZXBvY2ggPSBlbmRfZXBvY2g7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCAhIHRhcmdldF9jZWxsICYmIGNlbGxzLmxlbmd0aCApIHtcblx0XHRcdFx0dGFyZ2V0X2NlbGwgPSBjZWxsc1sgMCBdO1xuXHRcdFx0XHR0YXJnZXRfc3RhcnRfZXBvY2ggPSBOdW1iZXIoIHRhcmdldF9jZWxsLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1jZWxsLXN0YXJ0JyApICk7XG5cdFx0XHRcdHRhcmdldF9lbmRfZXBvY2ggPSBOdW1iZXIoIHRhcmdldF9jZWxsLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1jZWxsLWVuZCcgKSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0YXJnZXRfY2VsbCAmJiBjYW52YXMgKSB7XG5cdFx0XHRcdHZhciBjYW52YXNfcmVjdGFuZ2xlO1xuXHRcdFx0XHR2YXIgY2VsbF9yZWN0YW5nbGU7XG5cdFx0XHRcdHZhciBhbmNob3JfZnJhY3Rpb247XG5cdFx0XHRcdHZhciBoYXNfdmlld3BvcnRfb2Zmc2V0ID0gd2luZG93LmlzRmluaXRlKCBOdW1iZXIoIGFuY2hvci52aWV3cG9ydF9vZmZzZXRfcHggKSApO1xuXHRcdFx0XHR2YXIgY3VycmVudF9vZmZzZXQ7XG5cdFx0XHRcdHZhciBkZXNpcmVkX29mZnNldDtcblx0XHRcdFx0dmFyIHBoeXNpY2FsX2RlbHRhO1xuXG5cdFx0XHRcdHN5bmNocm9uaXplX2F4aXNfc2Nyb2xsKCk7XG5cdFx0XHRcdGNhbnZhc19yZWN0YW5nbGUgPSBjYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdGNlbGxfcmVjdGFuZ2xlID0gdGFyZ2V0X2NlbGwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdGFuY2hvcl9mcmFjdGlvbiA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggMSwgKCBhbmNob3JfZXBvY2ggLSB0YXJnZXRfc3RhcnRfZXBvY2ggKSAvIE1hdGgubWF4KCAxLCB0YXJnZXRfZW5kX2Vwb2NoIC0gdGFyZ2V0X3N0YXJ0X2Vwb2NoICkgKSApO1xuXHRcdFx0XHRjdXJyZW50X29mZnNldCA9IGhhc192aWV3cG9ydF9vZmZzZXRcblx0XHRcdFx0XHQ/IGNlbGxfcmVjdGFuZ2xlLmxlZnQgKyBjZWxsX3JlY3RhbmdsZS53aWR0aCAvIDIgLSBjYW52YXNfcmVjdGFuZ2xlLmxlZnRcblx0XHRcdFx0XHQ6ICggc2V0dGluZ3MuaXNfcnRsID8gY2VsbF9yZWN0YW5nbGUucmlnaHQgLSAoIGNlbGxfcmVjdGFuZ2xlLndpZHRoICogYW5jaG9yX2ZyYWN0aW9uICkgLSBjYW52YXNfcmVjdGFuZ2xlLmxlZnQgOiBjZWxsX3JlY3RhbmdsZS5sZWZ0ICsgKCBjZWxsX3JlY3RhbmdsZS53aWR0aCAqIGFuY2hvcl9mcmFjdGlvbiApIC0gY2FudmFzX3JlY3RhbmdsZS5sZWZ0ICk7XG5cdFx0XHRcdGlmICggaGFzX3ZpZXdwb3J0X29mZnNldCApIHtcblx0XHRcdFx0XHRkZXNpcmVkX29mZnNldCA9IE51bWJlciggYW5jaG9yLnZpZXdwb3J0X29mZnNldF9weCApO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCAwIDw9IE51bWJlciggYW5jaG9yLmxlYWRpbmdfY2VsbHNfYmVmb3JlICkgKSB7XG5cdFx0XHRcdFx0ZGVzaXJlZF9vZmZzZXQgPSBjZWxsX3JlY3RhbmdsZS53aWR0aCAqICggTnVtYmVyKCBhbmNob3IubGVhZGluZ19jZWxsc19iZWZvcmUgKSArIGFuY2hvcl9mcmFjdGlvbiApO1xuXHRcdFx0XHRcdGlmICggc2V0dGluZ3MuaXNfcnRsICkge1xuXHRcdFx0XHRcdFx0ZGVzaXJlZF9vZmZzZXQgPSBjYW52YXMuY2xpZW50V2lkdGggLSBkZXNpcmVkX29mZnNldDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGVzaXJlZF9vZmZzZXQgPSBjYW52YXMuY2xpZW50V2lkdGggKiBNYXRoLm1heCggMCwgTWF0aC5taW4oIDEsIE51bWJlciggYW5jaG9yLnJhdGlvICkgfHwgMC41ICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwaHlzaWNhbF9kZWx0YSA9IGN1cnJlbnRfb2Zmc2V0IC0gZGVzaXJlZF9vZmZzZXQ7XG5cdFx0XHRcdGNhbnZhcy5zY3JvbGxMZWZ0ICs9IHNldHRpbmdzLmlzX3J0bCA/IC1waHlzaWNhbF9kZWx0YSA6IHBoeXNpY2FsX2RlbHRhO1xuXHRcdFx0XHRjYW52YXNfcmVjdGFuZ2xlID0gY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRjZWxsX3JlY3RhbmdsZSA9IHRhcmdldF9jZWxsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRjdXJyZW50X29mZnNldCA9IGhhc192aWV3cG9ydF9vZmZzZXRcblx0XHRcdFx0XHQ/IGNlbGxfcmVjdGFuZ2xlLmxlZnQgKyBjZWxsX3JlY3RhbmdsZS53aWR0aCAvIDIgLSBjYW52YXNfcmVjdGFuZ2xlLmxlZnRcblx0XHRcdFx0XHQ6ICggc2V0dGluZ3MuaXNfcnRsID8gY2VsbF9yZWN0YW5nbGUucmlnaHQgLSAoIGNlbGxfcmVjdGFuZ2xlLndpZHRoICogYW5jaG9yX2ZyYWN0aW9uICkgLSBjYW52YXNfcmVjdGFuZ2xlLmxlZnQgOiBjZWxsX3JlY3RhbmdsZS5sZWZ0ICsgKCBjZWxsX3JlY3RhbmdsZS53aWR0aCAqIGFuY2hvcl9mcmFjdGlvbiApIC0gY2FudmFzX3JlY3RhbmdsZS5sZWZ0ICk7XG5cdFx0XHRcdHJlbWFpbmluZ19lcnJvciA9IE1hdGguYWJzKCBjdXJyZW50X29mZnNldCAtIGRlc2lyZWRfb2Zmc2V0ICk7XG5cdFx0XHRcdGlmICggYW5jaG9yLnJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0XHRcdFx0QXJyYXkucHJvdG90eXBlLnNvbWUuY2FsbCggaGVhZGVyX2NlbGxzLCBmdW5jdGlvbiAoIGhlYWRlcl9jZWxsICkge1xuXHRcdFx0XHRcdFx0aWYgKCBOdW1iZXIoIGhlYWRlcl9jZWxsLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1jZWxsLXN0YXJ0JyApICkgPT09IHRhcmdldF9zdGFydF9lcG9jaCApIHtcblx0XHRcdFx0XHRcdFx0Zm9jdXNfY2VsbCA9IGhlYWRlcl9jZWxsO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0aWYgKCBmb2N1c19jZWxsICkge1xuXHRcdFx0XHRcdFx0Zm9jdXNfY2VsbC5zZXRBdHRyaWJ1dGUoICd0YWJpbmRleCcsICcwJyApO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0Zm9jdXNfY2VsbC5mb2N1cyggeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0gKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHRcdFx0Zm9jdXNfY2VsbC5mb2N1cygpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0c3luY2hyb25pemVfYXhpc19zY3JvbGwoKTtcblx0XHRcdHJldHVybiByZW1haW5pbmdfZXJyb3I7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FuY2VsIGFuIG9ic29sZXRlIHBvc3QtcmVuZGVyIGFuY2hvciByZXN0b3JhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2FuY2VsX2FuY2hvcl9yZXN0b3JhdGlvbigpIHtcblx0XHRcdGF4aXNfYW5jaG9yX3Jlc3RvcmF0aW9uX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGlmICggYXhpc19hbmNob3JfcmVzdG9yYXRpb25fZnJhbWUgKSB7XG5cdFx0XHRcdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggYXhpc19hbmNob3JfcmVzdG9yYXRpb25fZnJhbWUgKTtcblx0XHRcdFx0YXhpc19hbmNob3JfcmVzdG9yYXRpb25fZnJhbWUgPSAwO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgb25lIHBvc3QtcmVuZGVyIGFuY2hvciBhZnRlciBib3VuZGVkIGxheW91dCBzZXR0bGluZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBhbmNob3IgQ2FwdHVyZWQgYW5jaG9yIHN0YXRlLlxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259IG9uX2NvbXBsZXRlIENvbXBsZXRpb24gY2FsbGJhY2suXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzY2hlZHVsZV9hbmNob3JfcmVzdG9yYXRpb24oIGFuY2hvciwgb25fY29tcGxldGUgKSB7XG5cdFx0XHR2YXIgcmVzdG9yYXRpb25fZ2VuZXJhdGlvbjtcblx0XHRcdHZhciBhdHRlbXB0X2NvdW50ID0gMDtcblxuXHRcdFx0Y2FuY2VsX2FuY2hvcl9yZXN0b3JhdGlvbigpO1xuXHRcdFx0cmVzdG9yYXRpb25fZ2VuZXJhdGlvbiA9IGF4aXNfYW5jaG9yX3Jlc3RvcmF0aW9uX2dlbmVyYXRpb247XG5cblx0XHRcdGZ1bmN0aW9uIHJlc3RvcmVfYWZ0ZXJfbGF5b3V0KCkge1xuXHRcdFx0XHR2YXIgcmVtYWluaW5nX2Vycm9yO1xuXG5cdFx0XHRcdGF4aXNfYW5jaG9yX3Jlc3RvcmF0aW9uX2ZyYW1lID0gMDtcblx0XHRcdFx0aWYgKCByZXN0b3JhdGlvbl9nZW5lcmF0aW9uICE9PSBheGlzX2FuY2hvcl9yZXN0b3JhdGlvbl9nZW5lcmF0aW9uICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRhdHRlbXB0X2NvdW50ICs9IDE7XG5cdFx0XHRcdHJlbWFpbmluZ19lcnJvciA9IHJlc3RvcmVfYXhpc19hbmNob3IoIGFuY2hvciApO1xuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0YXR0ZW1wdF9jb3VudCA8IGF4aXNfYW5jaG9yX3Jlc3RvcmF0aW9uX21heGltdW1fYXR0ZW1wdHNcblx0XHRcdFx0XHQmJiAoIGF0dGVtcHRfY291bnQgPCBheGlzX2FuY2hvcl9yZXN0b3JhdGlvbl9taW5pbXVtX2F0dGVtcHRzIHx8IG51bGwgPT09IHJlbWFpbmluZ19lcnJvciB8fCByZW1haW5pbmdfZXJyb3IgPiBheGlzX2FuY2hvcl9yZXN0b3JhdGlvbl90b2xlcmFuY2VfcHggKVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRheGlzX2FuY2hvcl9yZXN0b3JhdGlvbl9mcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIHJlc3RvcmVfYWZ0ZXJfbGF5b3V0ICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG9uX2NvbXBsZXRlICkge1xuXHRcdFx0XHRcdG9uX2NvbXBsZXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0YXhpc19hbmNob3JfcmVzdG9yYXRpb25fZnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCByZXN0b3JlX2FmdGVyX2xheW91dCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIHRoZSBjYW5vbmljYWwgc2Vjb25kLXByZWNpc2lvbiBjdXJyZW50LWluc3RhbnQgYW5jaG9yLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBDdXJyZW50IGluc3RhbnQgYW5kIHJlc3RvcmF0aW9uIHByZWZlcmVuY2VzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNyZWF0ZV90b2RheV9hbmNob3IoKSB7XG5cdFx0XHR2YXIgY3VycmVudF9kYXRlID0gZ2V0X25vdygpO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRhdDogY3VycmVudF9kYXRlLnRvSVNPU3RyaW5nKCkuc2xpY2UoIDAsIDE5ICkgKyAnKzAwOjAwJyxcblx0XHRcdFx0ZXBvY2g6IE1hdGguZmxvb3IoIGN1cnJlbnRfZGF0ZS5nZXRUaW1lKCkgLyAxMDAwICksXG5cdFx0XHRcdGxlYWRpbmdfY2VsbHNfYmVmb3JlOiAxLFxuXHRcdFx0XHRyZXN0b3JlX2ZvY3VzOiBmYWxzZVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXNvbHZlIGEgc3RyaWN0IHNpdGUtbG9jYWwgZGF0ZSBmcm9tIHNlcnZlciBjZWxscyBhbHJlYWR5IGluIGNhY2hlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGlzb19kYXRlIFN0cmljdCBZWVlZLU1NLUREIGRhdGUuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IENhY2hlZCBheGlzIGFuY2hvciwgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjcmVhdGVfbG9hZGVkX2RhdGVfYW5jaG9yKCBpc29fZGF0ZSApIHtcblx0XHRcdHZhciByZXNvbHZlZF9hbmNob3IgPSBudWxsO1xuXG5cdFx0XHRpZiAoICEgL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QoIFN0cmluZyggaXNvX2RhdGUgfHwgJycgKSApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGdldF9vcmRlcmVkX3dpbmRvd19lbnRyaWVzKCkuc29tZSggZnVuY3Rpb24gKCBlbnRyeSApIHtcblx0XHRcdFx0dmFyIGNlbGxzID0gZW50cnkucGF5bG9hZC5heGlzICYmIEFycmF5LmlzQXJyYXkoIGVudHJ5LnBheWxvYWQuYXhpcy5jZWxscyApID8gZW50cnkucGF5bG9hZC5heGlzLmNlbGxzIDogW107XG5cblx0XHRcdFx0cmV0dXJuIGNlbGxzLnNvbWUoIGZ1bmN0aW9uICggY2VsbCApIHtcblx0XHRcdFx0XHRpZiAoIFN0cmluZyggY2VsbC5kYXRlIHx8ICcnICkgIT09IGlzb19kYXRlICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXNvbHZlZF9hbmNob3IgPSB7XG5cdFx0XHRcdFx0XHRhdDogU3RyaW5nKCBjZWxsLnN0YXJ0X2F0IHx8ICcnICksXG5cdFx0XHRcdFx0XHRlcG9jaDogTnVtYmVyKCBjZWxsLnN0YXJ0X2Vwb2NoICksXG5cdFx0XHRcdFx0XHRsZWFkaW5nX2NlbGxzX2JlZm9yZTogMSxcblx0XHRcdFx0XHRcdHJlc3RvcmVfZm9jdXM6IGZhbHNlLFxuXHRcdFx0XHRcdFx0dGFyZ2V0X2RhdGU6IGlzb19kYXRlXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gcmVzb2x2ZWRfYW5jaG9yO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgYSByZXF1ZXN0ZWQgZGF0ZSBhZ2FpbnN0IG9uZSBuZXdseSBhdXRob3JpemVkIGF4aXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYW5jaG9yIFJlcXVlc3RlZCBuYXZpZ2F0aW9uIGFuY2hvci5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYXhpcyBTZXJ2ZXItYXV0aG9yaXRhdGl2ZSBheGlzIERUTy5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gcmVzb2x2ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzb2x2ZV9yZXNwb25zZV9kYXRlX2FuY2hvciggYW5jaG9yLCBheGlzICkge1xuXHRcdFx0dmFyIGNlbGxzID0gYXhpcyAmJiBBcnJheS5pc0FycmF5KCBheGlzLmNlbGxzICkgPyBheGlzLmNlbGxzIDogW107XG5cdFx0XHR2YXIgdGFyZ2V0X2RhdGUgPSBTdHJpbmcoIGFuY2hvciAmJiBhbmNob3IudGFyZ2V0X2RhdGUgPyBhbmNob3IudGFyZ2V0X2RhdGUgOiAnJyApO1xuXHRcdFx0dmFyIHdhc19yZXNvbHZlZCA9IGZhbHNlO1xuXG5cdFx0XHRpZiAoICEgdGFyZ2V0X2RhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGNlbGxzLnNvbWUoIGZ1bmN0aW9uICggY2VsbCApIHtcblx0XHRcdFx0aWYgKCBTdHJpbmcoIGNlbGwuZGF0ZSB8fCAnJyApICE9PSB0YXJnZXRfZGF0ZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0YW5jaG9yLmF0ID0gU3RyaW5nKCBjZWxsLnN0YXJ0X2F0IHx8IGF4aXMuc3RhcnRfYXQgfHwgYW5jaG9yLmF0IHx8ICcnICk7XG5cdFx0XHRcdGFuY2hvci5lcG9jaCA9IE51bWJlciggY2VsbC5zdGFydF9lcG9jaCApO1xuXHRcdFx0XHR3YXNfcmVzb2x2ZWQgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHdhc19yZXNvbHZlZDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEZXRlcm1pbmUgd2hldGhlciBhbiBhbmNob3IgaXMgaW5zaWRlIGFueSBhdXRob3JpemVkIGNhY2hlZCBheGlzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGFuY2hvciBUaW1lc3RhbXAgYW5jaG9yLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBsb2FkZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNfYW5jaG9yX2xvYWRlZCggYW5jaG9yICkge1xuXHRcdFx0dmFyIGFuY2hvcl9lcG9jaCA9IGFuY2hvciAmJiB3aW5kb3cuaXNGaW5pdGUoIE51bWJlciggYW5jaG9yLmVwb2NoICkgKVxuXHRcdFx0XHQ/IE51bWJlciggYW5jaG9yLmVwb2NoIClcblx0XHRcdFx0OiBNYXRoLmZsb29yKCBEYXRlLnBhcnNlKCBhbmNob3IgJiYgYW5jaG9yLmF0ID8gYW5jaG9yLmF0IDogJycgKSAvIDEwMDAgKTtcblxuXHRcdFx0aWYgKCAhIHdpbmRvdy5pc0Zpbml0ZSggYW5jaG9yX2Vwb2NoICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBnZXRfb3JkZXJlZF93aW5kb3dfZW50cmllcygpLnNvbWUoIGZ1bmN0aW9uICggZW50cnkgKSB7XG5cdFx0XHRcdHJldHVybiBhbmNob3JfZXBvY2ggPj0gTnVtYmVyKCBlbnRyeS5wYXlsb2FkLmF4aXMuc3RhcnRfZXBvY2ggKSAmJiBhbmNob3JfZXBvY2ggPCBOdW1iZXIoIGVudHJ5LnBheWxvYWQuYXhpcy5lbmRfZXBvY2ggKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIHNlcnZlciBhbmNob3IgcmF0aW8gdXNlZCBieSBUb2RheSBhbmQgc2VsZWN0ZWQtZGF0ZSByZWFkcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gQm91bmRlZCBzZXJ2ZXIgYW5jaG9yIHJhdGlvLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF90b2RheV9yZXF1ZXN0X2FuY2hvcl9yYXRpbygpIHtcblx0XHRcdHZhciB3aW5kb3dfZGF5cyA9IE51bWJlciggc2V0dGluZ3Mud2luZG93LndpbmRvd19kYXlzICk7XG5cblx0XHRcdGlmICggMCA8IE51bWJlciggc2V0dGluZ3Mud2luZG93LndpbmRvd19tb250aHMgKSB8fCAxID49IHdpbmRvd19kYXlzICkge1xuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIE1hdGgubWluKCAxLCAxLjUgLyB3aW5kb3dfZGF5cyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc29sdmUgd2hldGhlciBUb2RheSBjYW4gdXNlIGNhY2hlIG9yIG5lZWRzIGFuIGF1dGhvcml6ZWQgcmVhZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gVG9kYXkgYW5jaG9yLCByYXRpbywgYW5kIGNhY2hlIGRlY2lzaW9uLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc29sdmVfdG9kYXlfbmF2aWdhdGlvbigpIHtcblx0XHRcdHZhciBhbmNob3IgPSBjcmVhdGVfdG9kYXlfYW5jaG9yKCk7XG5cdFx0XHR2YXIgYW5jaG9yX3JhdGlvID0gZ2V0X3RvZGF5X3JlcXVlc3RfYW5jaG9yX3JhdGlvKCk7XG5cblx0XHRcdGFuY2hvci5yYXRpbyA9IGFuY2hvcl9yYXRpbztcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGFuY2hvcjogYW5jaG9yLFxuXHRcdFx0XHRhbmNob3JfcmF0aW86IGFuY2hvcl9yYXRpbyxcblx0XHRcdFx0aXNfbG9hZGVkOiBpc19hbmNob3JfbG9hZGVkKCBhbmNob3IgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJbml0aWFsaXplIHRoaXMgY29udHJvbGxlciBvbmNlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFib3J0IG93bmVkIHJlcXVlc3RzIGFuZCBzY2hlZHVsZWQgYW5jaG9yIHdvcmsuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0XHRpZiAoICEgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFib3J0X2ZvcmVncm91bmRfcmVxdWVzdCgpO1xuXHRcdFx0YWJvcnRfZWRnZV9yZXF1ZXN0cygpO1xuXHRcdFx0Y2FuY2VsX2FuY2hvcl9yZXN0b3JhdGlvbigpO1xuXHRcdFx0d2luZG93X3N0b3JlID0ge1xuXHRcdFx0XHRjdXJyZW50X2tleTogJycsXG5cdFx0XHRcdHJlc291cmNlX2ZpbmdlcnByaW50OiAnJyxcblx0XHRcdFx0d2luZG93czoge31cblx0XHRcdH07XG5cdFx0XHRjYW52YXNfcG9pbnRlcl9uYXZpZ2F0aW9uX2FjdGl2ZSA9IGZhbHNlO1xuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdGRlc3Ryb3k6IGRlc3Ryb3ksXG5cdFx0XHRnZXRfbG9hZGluZ19saW1pdHM6IGdldF9sb2FkaW5nX2xpbWl0cyxcblx0XHRcdGdldF9vcmRlcmVkX3dpbmRvd19lbnRyaWVzOiBnZXRfb3JkZXJlZF93aW5kb3dfZW50cmllcyxcblx0XHRcdGdldF9zZWxlY3Rpb25fY29udGV4dF90b2tlbnM6IGdldF9zZWxlY3Rpb25fY29udGV4dF90b2tlbnMsXG5cdFx0XHRnZXRfcmVzb3VyY2VfZmluZ2VycHJpbnQ6IGdldF9yZXNvdXJjZV9maW5nZXJwcmludCxcblx0XHRcdHJlc2V0OiByZXNldCxcblx0XHRcdHJlcGxhY2VfcmVzb3VyY2VfY29udGV4dDogcmVwbGFjZV9yZXNvdXJjZV9jb250ZXh0LFxuXHRcdFx0Y2FjaGVfYWRqYWNlbnQ6IGNhY2hlX2FkamFjZW50LFxuXHRcdFx0dHJpbTogdHJpbSxcblx0XHRcdGNvbXBvc2U6IGNvbXBvc2UsXG5cdFx0XHRtYXBfdGltZXN0YW1wX3RvX2F4aXNfcG9zaXRpb246IG1hcF90aW1lc3RhbXBfdG9fYXhpc19wb3NpdGlvbixcblx0XHRcdGdldF9jb21wb3NlZF9zZWdtZW50X2dlb21ldHJ5OiBnZXRfY29tcG9zZWRfc2VnbWVudF9nZW9tZXRyeSxcblx0XHRcdGdldF9lZGdlX3dpbmRvd19lbnRyeTogZ2V0X2VkZ2Vfd2luZG93X2VudHJ5LFxuXHRcdFx0cHJvbW90ZV9mb3JfYW5jaG9yOiBwcm9tb3RlX2Zvcl9hbmNob3IsXG5cdFx0XHRnZXRfZWRnZV9zdGF0ZTogZ2V0X2VkZ2Vfc3RhdGUsXG5cdFx0XHRzdXNwZW5kX2FkamFjZW50X2xvYWRpbmc6IHN1c3BlbmRfYWRqYWNlbnRfbG9hZGluZyxcblx0XHRcdGFjdGl2YXRlX2FkamFjZW50X2ludGVudDogYWN0aXZhdGVfYWRqYWNlbnRfaW50ZW50LFxuXHRcdFx0c2V0X3BvaW50ZXJfbmF2aWdhdGlvbl9hY3RpdmU6IHNldF9wb2ludGVyX25hdmlnYXRpb25fYWN0aXZlLFxuXHRcdFx0dXBkYXRlX2VkZ2VfcHJveGltaXR5OiB1cGRhdGVfZWRnZV9wcm94aW1pdHksXG5cdFx0XHRhYm9ydF9lZGdlX3JlcXVlc3RzOiBhYm9ydF9lZGdlX3JlcXVlc3RzLFxuXHRcdFx0YmVnaW5fZm9yZWdyb3VuZF9yZXF1ZXN0OiBiZWdpbl9mb3JlZ3JvdW5kX3JlcXVlc3QsXG5cdFx0XHRzZXRfZm9yZWdyb3VuZF9yZXF1ZXN0OiBzZXRfZm9yZWdyb3VuZF9yZXF1ZXN0LFxuXHRcdFx0aXNfZm9yZWdyb3VuZF9nZW5lcmF0aW9uX2N1cnJlbnQ6IGlzX2ZvcmVncm91bmRfZ2VuZXJhdGlvbl9jdXJyZW50LFxuXHRcdFx0Y29tcGxldGVfZm9yZWdyb3VuZF9yZXF1ZXN0OiBjb21wbGV0ZV9mb3JlZ3JvdW5kX3JlcXVlc3QsXG5cdFx0XHRhYm9ydF9mb3JlZ3JvdW5kX3JlcXVlc3Q6IGFib3J0X2ZvcmVncm91bmRfcmVxdWVzdCxcblx0XHRcdGJlZ2luX2VkZ2VfcmVxdWVzdDogYmVnaW5fZWRnZV9yZXF1ZXN0LFxuXHRcdFx0c2V0X2VkZ2VfcmVxdWVzdDogc2V0X2VkZ2VfcmVxdWVzdCxcblx0XHRcdGlzX2VkZ2VfZ2VuZXJhdGlvbl9jdXJyZW50OiBpc19lZGdlX2dlbmVyYXRpb25fY3VycmVudCxcblx0XHRcdGdldF9lZGdlX3JlcXVlc3Q6IGdldF9lZGdlX3JlcXVlc3QsXG5cdFx0XHRzY2hlZHVsZV9lZGdlX3Nsb3dfc3RhdGU6IHNjaGVkdWxlX2VkZ2Vfc2xvd19zdGF0ZSxcblx0XHRcdG1hcmtfZWRnZV9lcnJvcjogbWFya19lZGdlX2Vycm9yLFxuXHRcdFx0bWFya19lZGdlX2xvYWRlZDogbWFya19lZGdlX2xvYWRlZCxcblx0XHRcdHByZXBhcmVfZWRnZV9yZXRyeTogcHJlcGFyZV9lZGdlX3JldHJ5LFxuXHRcdFx0Y29tcGxldGVfZWRnZV9yZXF1ZXN0OiBjb21wbGV0ZV9lZGdlX3JlcXVlc3QsXG5cdFx0XHRjYW5jZWxfZWRnZV9yZXF1ZXN0OiBjYW5jZWxfZWRnZV9yZXF1ZXN0LFxuXHRcdFx0Y2FwdHVyZV9heGlzX2FuY2hvcjogY2FwdHVyZV9heGlzX2FuY2hvcixcblx0XHRcdHJlc3RvcmVfYXhpc19hbmNob3I6IHJlc3RvcmVfYXhpc19hbmNob3IsXG5cdFx0XHRjYW5jZWxfYW5jaG9yX3Jlc3RvcmF0aW9uOiBjYW5jZWxfYW5jaG9yX3Jlc3RvcmF0aW9uLFxuXHRcdFx0c2NoZWR1bGVfYW5jaG9yX3Jlc3RvcmF0aW9uOiBzY2hlZHVsZV9hbmNob3JfcmVzdG9yYXRpb24sXG5cdFx0XHRjcmVhdGVfdG9kYXlfYW5jaG9yOiBjcmVhdGVfdG9kYXlfYW5jaG9yLFxuXHRcdFx0Y3JlYXRlX2xvYWRlZF9kYXRlX2FuY2hvcjogY3JlYXRlX2xvYWRlZF9kYXRlX2FuY2hvcixcblx0XHRcdHJlc29sdmVfcmVzcG9uc2VfZGF0ZV9hbmNob3I6IHJlc29sdmVfcmVzcG9uc2VfZGF0ZV9hbmNob3IsXG5cdFx0XHRpc19hbmNob3JfbG9hZGVkOiBpc19hbmNob3JfbG9hZGVkLFxuXHRcdFx0Z2V0X3RvZGF5X3JlcXVlc3RfYW5jaG9yX3JhdGlvOiBnZXRfdG9kYXlfcmVxdWVzdF9hbmNob3JfcmF0aW8sXG5cdFx0XHRyZXNvbHZlX3RvZGF5X25hdmlnYXRpb246IHJlc29sdmVfdG9kYXlfbmF2aWdhdGlvblxuXHRcdH07XG5cdH1cblxuXHRpZiAoIHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSApIHtcblx0XHR3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzLnJlZ2lzdGVyX2ZhY3RvcnkoIG1vZHVsZV9pZCwgY3JlYXRlX3dpbmRvd19jYWNoZV9jb250cm9sbGVyICk7XG5cdH1cbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxNQUFNLEVBQUVDLFFBQVEsRUFBRztFQUMvQixZQUFZOztFQUVaLElBQUlDLFNBQVMsR0FBRyxjQUFjO0VBQzlCO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLElBQUlDLDZCQUE2QixHQUFHLFNBQVM7O0VBRTdDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLDhCQUE4QkEsQ0FBRUMsT0FBTyxFQUFHO0lBQ2xELElBQUlDLFFBQVEsR0FBR0QsT0FBTyxDQUFDQyxRQUFRLElBQUksQ0FBQyxDQUFDO0lBQ3JDLElBQUlDLEtBQUssR0FBR0YsT0FBTyxDQUFDRSxLQUFLLElBQUksSUFBSTtJQUNqQyxJQUFJQyx1QkFBdUIsR0FBRyxVQUFVLEtBQUssT0FBT0gsT0FBTyxDQUFDRyx1QkFBdUIsR0FBR0gsT0FBTyxDQUFDRyx1QkFBdUIsR0FBRyxZQUFZLENBQUMsQ0FBQztJQUN0SSxJQUFJQyxPQUFPLEdBQUcsVUFBVSxLQUFLLE9BQU9KLE9BQU8sQ0FBQ0ksT0FBTyxHQUFHSixPQUFPLENBQUNJLE9BQU8sR0FBRyxZQUFZO01BQ25GLE9BQU8sSUFB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
