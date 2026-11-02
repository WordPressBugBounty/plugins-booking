"use strict";

/**
 * Timeline lazy Availability transport and bounded cache controller.
 *
 * Booking windows remain authoritative and render independently. This module
 * mirrors only the accepted previous/current/next window identities, loads the
 * data-only Availability projection in parallel, rejects stale responses, and
 * exposes a neutral cache miss when a read cannot be completed.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window) {
  'use strict';

  var module_id = 'availability_cache';

  /**
   * Create one bounded lazy Availability controller.
   *
   * @param {Object}   context                    Controller construction context.
   * @param {Element}  context.mount              Timeline mount element.
   * @param {Object}   context.settings           Server-localized Timeline settings.
   * @param {Function} context.get_axis           Current composed-axis callback.
   * @param {Function} context.get_geometry       Canonical axis-geometry callback.
   * @param {Function} context.on_change          Optional cache-state callback.
   * @param {Function} context.on_status_change   Optional aggregate read-status callback.
   * @param {Function} context.send_request       Optional transport override for tests.
   * @return {Object} Availability cache lifecycle and read API.
   */
  function create_availability_cache_controller(context) {
    var mount = context.mount || null;
    var settings = context.settings || {};
    var get_axis = 'function' === typeof context.get_axis ? context.get_axis : function () {
      return settings.axis || {};
    };
    var get_geometry = 'function' === typeof context.get_geometry ? context.get_geometry : function () {
      return {};
    };
    var on_change = 'function' === typeof context.on_change ? context.on_change : function () {};
    var on_status_change = 'function' === typeof context.on_status_change ? context.on_status_change : function () {};
    var send_request = 'function' === typeof context.send_request ? context.send_request : send_ajax_request;
    var cache_entries = Object.create(null);
    var active_requests = Object.create(null);
    var desired_descriptors = Object.create(null);
    var known_revisions = Object.create(null);
    var request_generation = 0;
    var status_notifications_suspended = false;
    var is_initialized = false;
    var availability_source_ids = {
      appointment_buffer: true,
      blocked_date: true,
      blocked_time: true,
      booking_buffer: true,
      seasonal_availability: true,
      unavailable_weekday: true,
      working_time: true
    };

    /**
     * Return normalized Timeline loading limits.
     *
     * @return {Object} Bounded cache count and request timeout.
     */
    function get_limits() {
      var limits = settings.metadata && settings.metadata.window_loading ? settings.metadata.window_loading : {};
      return {
        maximum_cached_windows: Math.max(1, Math.min(3, Number(limits.maximum_cached_windows) || 3)),
        request_timeout_ms: Math.max(1000, Number(limits.request_timeout_ms) || 15000)
      };
    }

    /**
     * Return sorted unique positive Resource IDs from one booking window.
     *
     * @param {Array<Object>} resources Authorized Resource DTOs.
     * @return {Array<number>} Stable Resource ID set.
     */
    function normalize_resource_ids(resources) {
      var seen = Object.create(null);
      return (Array.isArray(resources) ? resources : []).map(function (resource) {
        return Number(resource && resource.id);
      }).filter(function (resource_id) {
        if (!Number.isInteger(resource_id) || 1 > resource_id || seen[resource_id]) {
          return false;
        }
        seen[resource_id] = true;
        return true;
      }).sort(function (left_id, right_id) {
        return left_id - right_id;
      });
    }

    /**
     * Build one exact, authorized cache descriptor from a booking-window entry.
     *
     * The identity includes both the opaque server fingerprint and explicit
     * authorized Resource IDs, the half-open window, scale, timezone, and an
     * Availability revision when the server exposes one.
     *
     * @param {Object} window_entry Window-cache `{ key, payload }` entry.
     * @return {Object|null} Exact cache descriptor or null when incomplete.
     */
    function build_descriptor(window_entry) {
      var payload = window_entry && window_entry.payload ? window_entry.payload : {};
      var timeline_window = payload.window || {};
      var axis = payload.axis || {};
      var window_context = payload.window_context || {};
      var resource_ids = normalize_resource_ids(payload.resources);
      var explicit_revision = String(window_context.availability_revision || timeline_window.availability_revision || '');
      var identity_parts;
      var base_key;
      var availability_revision;
      var request_values;
      if (!resource_ids.length || !timeline_window.start_at || !timeline_window.end_at || !timeline_window.view || !timeline_window.timezone) {
        return null;
      }
      identity_parts = [String(window_context.resource_fingerprint || ''), resource_ids.join(','), String(timeline_window.start_at), String(timeline_window.end_at), String(timeline_window.view), String(timeline_window.cell_minutes || axis.cell_minutes || ''), String(timeline_window.timezone)];
      base_key = identity_parts.join('|');
      availability_revision = explicit_revision || String(known_revisions[base_key] || '');
      request_values = {
        anchor_date: String(timeline_window.anchor_date || ''),
        anchor_at: String(timeline_window.anchor_at || timeline_window.start_at),
        anchor_ratio: Number(timeline_window.anchor_ratio || 0),
        window_position: Number(timeline_window.window_position || 0),
        view: String(timeline_window.view),
        resource_ids: resource_ids.slice()
      };
      if (0 < Number(timeline_window.window_months || 0)) {
        request_values.window_months = Number(timeline_window.window_months);
      } else {
        request_values.window_days = Number(timeline_window.window_days || 0);
      }
      return {
        base_key: base_key,
        cache_key: base_key + '|' + availability_revision,
        window_key: String(window_entry.key || window_context.window_key || ''),
        resource_ids: resource_ids,
        resource_fingerprint: String(window_context.resource_fingerprint || ''),
        start_at: String(timeline_window.start_at),
        end_at: String(timeline_window.end_at),
        view: String(timeline_window.view),
        cell_minutes: Number(timeline_window.cell_minutes || axis.cell_minutes || 0),
        timezone: String(timeline_window.timezone),
        availability_revision: availability_revision,
        request_values: request_values
      };
    }

    /**
     * Send one authenticated Availability request through the localized endpoint.
     *
     * @param {Object} request_values Validated booking-window request values.
     * @param {number} timeout_ms    Request timeout in milliseconds.
     * @return {Object|null} jQuery-compatible request transport.
     */
    function send_ajax_request(request_values, timeout_ms) {
      var transport = settings.transport && settings.transport.availability ? settings.transport.availability : {};
      if (!window.jQuery || !settings.transport || !settings.transport.url || !transport.action || !transport.nonce) {
        return null;
      }
      return window.jQuery.ajax({
        url: settings.transport.url,
        method: 'POST',
        dataType: 'json',
        data: Object.assign({}, request_values, {
          action: transport.action,
          nonce: transport.nonce
        }),
        timeout: timeout_ms
      });
    }

    /**
     * Compare a response with the exact requested authorized window identity.
     *
     * @param {Object} descriptor Exact request descriptor.
     * @param {Object} payload    Availability response payload.
     * @param {number} generation Owning request generation.
     * @return {boolean} True when the response belongs to the request.
     */
    function response_matches_descriptor(descriptor, payload, generation) {
      var response_window = payload && payload.window ? payload.window : {};
      var response_resource_ids = normalize_resource_ids((payload && Array.isArray(payload.resource_ids) ? payload.resource_ids : []).map(function (resource_id) {
        return {
          id: resource_id
        };
      }));
      return Number(response_window.request_generation) === generation && descriptor.start_at === String(response_window.start_at || '') && descriptor.end_at === String(response_window.end_at || '') && descriptor.view === String(response_window.view || '') && descriptor.cell_minutes === Number(response_window.cell_minutes || 0) && descriptor.timezone === String(response_window.timezone || '') && descriptor.resource_ids.join(',') === response_resource_ids.join(',');
    }

    /**
     * Parse one offset-explicit server timestamp into epoch seconds.
     *
     * @param {string} timestamp RFC 3339 server timestamp.
     * @return {number|null} Epoch seconds, or null for an invalid timestamp.
     */
    function parse_timestamp(timestamp) {
      var normalized_timestamp = String(timestamp || '');
      var milliseconds;
      if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized_timestamp)) {
        return null;
      }
      milliseconds = Date.parse(normalized_timestamp);
      return Number.isFinite(milliseconds) ? milliseconds / 1000 : null;
    }

    /**
     * Remove every Availability presentation layer owned by this controller.
     *
     * @return {void}
     */
    function clear_rendered_layers() {
      var layers = mount ? mount.querySelectorAll('[data-wpbc-timeline-availability-layer]') : [];
      Array.prototype.forEach.call(layers, function (layer) {
        if (layer.parentNode) {
          layer.parentNode.removeChild(layer);
        }
      });
    }

    /**
     * Return the reusable pointer-transparent layer between cells and segments.
     *
     * @param {Element} track Resource-row Timeline track.
     * @return {Element|null} Availability layer, or null without a segment host.
     */
    function create_availability_layer(track) {
      var segment_host = track ? track.querySelector('[data-wpbc-timeline-segments]') : null;
      var layer = track ? track.querySelector('[data-wpbc-timeline-availability-layer]') : null;
      if (!track || !segment_host) {
        return null;
      }
      if (layer) {
        layer.textContent = '';
        return layer;
      }
      layer = track.ownerDocument.createElement('div');
      layer.className = 'wpbc_timeline__availability_layer';
      layer.setAttribute('data-wpbc-timeline-availability-layer', '');
      layer.setAttribute('role', 'presentation');
      layer.setAttribute('aria-hidden', 'true');
      track.insertBefore(layer, segment_host);
      return layer;
    }

    /**
     * Return the current block geometry of one related booking card.
     *
     * Buffer timestamps remain server-authoritative. The optional segment ID
     * only lets the decorative layer reuse the already rendered card's lane
     * and exact height; it never derives Availability from card geometry.
     *
     * @param {Element} layer              Resource Availability layer.
     * @param {string}  related_segment_id Authorized booking segment identity.
     * @return {Object|null} CSS `{ block_start, block_size }` values, or null.
     */
    function get_related_booking_geometry(layer, related_segment_id) {
      var track = layer ? layer.parentNode : null;
      var booking_segments = track ? track.querySelectorAll('[data-wpbc-timeline-segment-id]') : [];
      var matched_segment = null;
      var block_start;
      var block_size;
      var lane_index;
      if (!related_segment_id) {
        return null;
      }
      Array.prototype.some.call(booking_segments, function (booking_segment) {
        if (related_segment_id !== String(booking_segment.getAttribute('data-wpbc-timeline-segment-id') || '')) {
          return false;
        }
        matched_segment = booking_segment;
        return true;
      });
      if (!matched_segment) {
        return null;
      }
      block_start = Number(matched_segment.offsetTop);
      block_size = Number(matched_segment.offsetHeight);
      if (Number.isFinite(block_start) && Number.isFinite(block_size) && 0 < block_size) {
        return {
          block_start: Math.max(0, block_start) + 'px',
          block_size: block_size + 'px'
        };
      }
      lane_index = Number(matched_segment.getAttribute('data-wpbc-timeline-lane-index'));
      if (!Number.isInteger(lane_index) || 0 > lane_index) {
        return null;
      }
      return {
        block_start: 'calc(var(--wpbc_timeline_general__booking-lane-offset) + (' + lane_index + ' * var(--wpbc_timeline_general__lane-height)))',
        block_size: 'var(--wpbc_timeline_general__booking-card-height)'
      };
    }

    /**
     * Return exact intervals clipped to both their loaded and composed windows.
     *
     * Adjacent window fragments merge only for the same Resource, source, and
     * related booking segment. Keeping booking ownership prevents overlapping
     * buffers in different card lanes from collapsing into a full-row interval.
     * Unknown or conditional records are never promoted into rendered intervals.
     *
     * @param {Object} axis Current composed Timeline axis.
     * @return {Array<Object>} Sorted, merged, clipped exact interval records.
     */
    function get_renderable_intervals(axis) {
      var axis_cells = axis && Array.isArray(axis.cells) ? axis.cells : [];
      var axis_start = axis_cells.length ? Number(axis_cells[0].start_epoch) : Number(axis.start_epoch);
      var axis_end = axis_cells.length ? Number(axis_cells[axis_cells.length - 1].end_epoch) : Number(axis.end_epoch);
      var intervals = [];
      var merged = [];
      if (!Number.isFinite(axis_start) || !Number.isFinite(axis_end) || axis_start >= axis_end) {
        return merged;
      }
      get_cached_windows().forEach(function (cache_entry) {
        var payload = cache_entry && cache_entry.payload ? cache_entry.payload : {};
        var loaded_window = payload.window || {};
        var loaded_start = parse_timestamp(loaded_window.start_at);
        var loaded_end = parse_timestamp(loaded_window.end_at);
        var loaded_resource_ids = Object.create(null);
        (Array.isArray(payload.resource_ids) ? payload.resource_ids : []).forEach(function (resource_id) {
          resource_id = Number(resource_id);
          if (Number.isInteger(resource_id) && 1 <= resource_id) {
            loaded_resource_ids[resource_id] = true;
          }
        });
        if (null === loaded_start || null === loaded_end || loaded_start >= loaded_end) {
          return;
        }
        (Array.isArray(payload.intervals) ? payload.intervals : []).forEach(function (interval) {
          var resource_id = Number(interval && interval.resource_id);
          var source = String(interval && interval.source || '');
          var related_segment_id = String(interval && interval.related_segment_id || '');
          var start_epoch = parse_timestamp(interval && interval.start_at);
          var end_epoch = parse_timestamp(interval && interval.end_at);
          if ('exact' !== String(interval && interval.state || '') || !Number.isInteger(resource_id) || 1 > resource_id || !loaded_resource_ids[resource_id] || !availability_source_ids[source] || null === start_epoch || null === end_epoch) {
            return;
          }
          start_epoch = Math.max(start_epoch, loaded_start, axis_start);
          end_epoch = Math.min(end_epoch, loaded_end, axis_end);
          if (start_epoch >= end_epoch) {
            return;
          }
          intervals.push({
            resource_id: resource_id,
            source: source,
            related_segment_id: related_segment_id,
            start_epoch: start_epoch,
            end_epoch: end_epoch
          });
        });
      });
      intervals.sort(function (left_interval, right_interval) {
        return left_interval.resource_id - right_interval.resource_id || left_interval.source.localeCompare(right_interval.source) || left_interval.related_segment_id.localeCompare(right_interval.related_segment_id) || left_interval.start_epoch - right_interval.start_epoch || left_interval.end_epoch - right_interval.end_epoch;
      });
      intervals.forEach(function (interval) {
        var previous_interval = merged.length ? merged[merged.length - 1] : null;
        if (previous_interval && previous_interval.resource_id === interval.resource_id && previous_interval.source === interval.source && previous_interval.related_segment_id === interval.related_segment_id && interval.start_epoch <= previous_interval.end_epoch) {
          previous_interval.end_epoch = Math.max(previous_interval.end_epoch, interval.end_epoch);
          return;
        }
        merged.push(interval);
      });
      return merged;
    }

    /**
     * Render cached exact intervals on the current composed server axis.
     *
     * Layers are resolved from the current booking rows after each row render and
     * reused while those rows remain mounted. Absolute logical geometry and pointer
     * transparency keep row heights, hitboxes, controls, and scrolling unchanged.
     *
     * @return {void}
     */
    function render_cached_availability() {
      var axis = get_axis() || {};
      var tracks = mount ? mount.querySelectorAll('[data-wpbc-timeline-selection-track]') : [];
      var layers_by_resource_id = Object.create(null);
      Array.prototype.forEach.call(tracks, function (track) {
        var resource_id = Number(track.getAttribute('data-wpbc-timeline-resource-id'));
        var layer = create_availability_layer(track);
        if (layer && Number.isInteger(resource_id) && 1 <= resource_id) {
          layers_by_resource_id[resource_id] = layer;
        }
      });
      get_renderable_intervals(axis).forEach(function (interval) {
        var layer = layers_by_resource_id[interval.resource_id];
        var geometry = get_geometry(axis, interval.start_epoch, interval.end_epoch) || {};
        var offset_percent = Number(geometry.offset_percent);
        var width_percent = Number(geometry.width_percent);
        var clamped_offset_percent;
        var clamped_width_percent;
        var interval_element;
        var related_booking_geometry;
        if (!layer || !Number.isFinite(offset_percent) || !Number.isFinite(width_percent) || 0 >= width_percent) {
          return;
        }
        clamped_offset_percent = Math.max(0, Math.min(100, offset_percent));
        clamped_width_percent = Math.max(0, Math.min(100 - clamped_offset_percent, width_percent));
        if (0 >= clamped_width_percent) {
          return;
        }
        interval_element = layer.ownerDocument.createElement('span');
        interval_element.className = 'wpbc_timeline__availability_interval';
        interval_element.setAttribute('data-wpbc-timeline-availability-source', interval.source);
        interval_element.style.setProperty('--wpbc-timeline-availability-inline-start', clamped_offset_percent + '%');
        interval_element.style.setProperty('--wpbc-timeline-availability-inline-size', clamped_width_percent + '%');
        if ('booking_buffer' === interval.source || 'appointment_buffer' === interval.source) {
          related_booking_geometry = get_related_booking_geometry(layer, interval.related_segment_id);
          if (related_booking_geometry) {
            interval_element.setAttribute('data-wpbc-timeline-buffer-aligned', 'true');
            interval_element.style.setProperty('--wpbc-timeline-availability-block-start', related_booking_geometry.block_start);
            interval_element.style.setProperty('--wpbc-timeline-availability-block-size', related_booking_geometry.block_size);
          }
        }
        layer.appendChild(interval_element);
      });
    }

    /**
     * Notify the page coordinator without coupling failures to booking rendering.
     *
     * @param {string} state      Loaded or neutral state.
     * @param {Object} descriptor Exact cache descriptor.
     * @param {Object|null} payload Authorized Availability DTO when loaded.
     * @return {void}
     */
    function notify_change(state, descriptor, payload) {
      render_cached_availability();
      on_change({
        state: state,
        cache_key: descriptor.cache_key,
        window_key: descriptor.window_key,
        payload: payload,
        cached_windows: get_cached_windows()
      });
    }

    /**
     * Report aggregate lazy-read progress for the currently desired windows.
     *
     * This lifecycle is intentionally separate from `on_change`, whose events
     * represent accepted Availability data. Page feedback may observe progress
     * without making loading state look like a new authorized projection.
     *
     * @param {string} state Optional explicit lifecycle state.
     * @return {void}
     */
    function notify_status_change(state) {
      var desired_keys;
      var pending_count;
      var loaded_count;
      if (status_notifications_suspended) {
        return;
      }
      desired_keys = Object.keys(desired_descriptors);
      pending_count = desired_keys.filter(function (base_key) {
        return Boolean(active_requests[base_key] && active_requests[base_key].cache_key === desired_descriptors[base_key].cache_key);
      }).length;
      loaded_count = desired_keys.filter(function (base_key) {
        var cached_entry = cache_entries[base_key];
        return Boolean(cached_entry && (!desired_descriptors[base_key].availability_revision || cached_entry.availability_revision === desired_descriptors[base_key].availability_revision));
      }).length;
      on_status_change({
        schema_version: 1,
        state: state || (pending_count ? 'loading' : 'settled'),
        desired_count: desired_keys.length,
        pending_count: pending_count,
        loaded_count: loaded_count,
        failed_count: Math.max(0, desired_keys.length - pending_count - loaded_count),
        is_settled: 0 === pending_count
      });
    }

    /**
     * Cache one current Availability response.
     *
     * @param {Object} descriptor Exact cache descriptor.
     * @param {Object} payload    Authorized Availability DTO.
     * @return {void}
     */
    function cache_response(descriptor, payload) {
      var response_revision = String(payload.availability_revision || descriptor.availability_revision || '');
      var cache_key = descriptor.base_key + '|' + response_revision;
      var notification_descriptor = Object.assign({}, descriptor, {
        cache_key: cache_key,
        availability_revision: response_revision
      });
      known_revisions[descriptor.base_key] = response_revision;
      cache_entries[descriptor.base_key] = {
        cache_key: cache_key,
        window_key: descriptor.window_key,
        availability_revision: response_revision,
        payload: payload
      };
      notify_change('loaded', notification_descriptor, payload);
    }

    /**
     * Start one missing lazy read without blocking booking-window rendering.
     *
     * @param {Object} descriptor Exact cache descriptor.
     * @return {void}
     */
    function request_descriptor(descriptor) {
      var generation;
      var request_values;
      var request;
      var cached_entry = cache_entries[descriptor.base_key];
      if (cached_entry && (!descriptor.availability_revision || cached_entry.availability_revision === descriptor.availability_revision)) {
        return;
      }
      if (cached_entry) {
        delete cache_entries[descriptor.base_key];
      }
      if (active_requests[descriptor.base_key]) {
        if (active_requests[descriptor.base_key].cache_key !== descriptor.cache_key) {
          abort_request(descriptor.base_key);
        } else {
          return;
        }
      }
      request_generation += 1;
      generation = request_generation;
      request_values = Object.assign({}, descriptor.request_values, {
        request_generation: generation
      });
      request = send_request(request_values, get_limits().request_timeout_ms);
      if (!request || 'function' !== typeof request.done || 'function' !== typeof request.fail || 'function' !== typeof request.always) {
        notify_change('neutral', descriptor, null);
        return;
      }
      active_requests[descriptor.base_key] = {
        cache_key: descriptor.cache_key,
        generation: generation,
        request: request
      };
      request.done(function (response) {
        var active_request = active_requests[descriptor.base_key];
        if (!active_request || active_request.generation !== generation || active_request.cache_key !== descriptor.cache_key || !desired_descriptors[descriptor.base_key] || desired_descriptors[descriptor.base_key].cache_key !== descriptor.cache_key) {
          return;
        }
        if (!response || !response.success || !response.data || !response_matches_descriptor(descriptor, response.data, generation)) {
          notify_change('neutral', descriptor, null);
          return;
        }
        cache_response(descriptor, response.data);
      }).fail(function (failed_request, request_status) {
        var active_request = active_requests[descriptor.base_key];
        if (active_request && active_request.generation === generation && desired_descriptors[descriptor.base_key] && 'abort' !== request_status) {
          notify_change('neutral', descriptor, null);
        }
      }).always(function () {
        var active_request = active_requests[descriptor.base_key];
        if (active_request && active_request.generation === generation) {
          delete active_requests[descriptor.base_key];
        }
        notify_status_change();
      });
    }

    /**
     * Abort one superseded request and invalidate all of its late callbacks.
     *
     * @param {string} base_key Exact Resource/window/scale/timezone identity.
     * @return {void}
     */
    function abort_request(base_key) {
      var active_request = active_requests[base_key];
      if (!active_request) {
        return;
      }
      delete active_requests[base_key];
      if (active_request.request && 'function' === typeof active_request.request.abort) {
        active_request.request.abort();
      }
    }

    /**
     * Mirror the accepted previous/current/next booking-window cache.
     *
     * Existing exact matches are retained. Superseded requests are aborted,
     * evicted windows are removed, and missing Availability reads start without
     * returning a promise to the booking rendering path.
     *
     * @param {Array<Object>} window_entries Accepted booking-window entries.
     * @return {void}
     */
    function synchronize(window_entries) {
      var next_descriptors = Object.create(null);
      var limits = get_limits();
      (Array.isArray(window_entries) ? window_entries : []).slice(0, limits.maximum_cached_windows).forEach(function (window_entry) {
        var descriptor = build_descriptor(window_entry);
        if (descriptor) {
          next_descriptors[descriptor.base_key] = descriptor;
        }
      });
      status_notifications_suspended = true;
      desired_descriptors = next_descriptors;
      Object.keys(active_requests).forEach(function (base_key) {
        if (!desired_descriptors[base_key] || active_requests[base_key].cache_key !== desired_descriptors[base_key].cache_key) {
          abort_request(base_key);
        }
      });
      Object.keys(cache_entries).forEach(function (base_key) {
        if (!desired_descriptors[base_key]) {
          delete cache_entries[base_key];
        }
      });
      Object.keys(desired_descriptors).forEach(function (base_key) {
        request_descriptor(desired_descriptors[base_key]);
      });
      status_notifications_suspended = false;
      render_cached_availability();
      notify_status_change();
    }

    /**
     * Return loaded DTOs for the currently mirrored bounded windows.
     *
     * Cache misses and failures are intentionally omitted. Consumers must render
     * those windows with a neutral background rather than infer availability.
     *
     * @return {Array<Object>} Loaded bounded cache entries.
     */
    function get_cached_windows() {
      return Object.keys(desired_descriptors).map(function (base_key) {
        return cache_entries[base_key] || null;
      }).filter(function (cache_entry) {
        return Boolean(cache_entry);
      });
    }

    /**
     * Invalidate every cached Availability projection after a canonical mutation.
     *
     * Booking and manual Availability mutations can change intervals without
     * changing the Resource/window cache identity. Aborting older reads and
     * clearing both response and revision memory prevents stale intervals from
     * being reused when the refreshed booking windows synchronize. Desired
     * descriptors remain intact so the next normal synchronization reloads only
     * the accepted previous/current/next windows.
     *
     * @return {void}
     */
    function invalidate() {
      status_notifications_suspended = true;
      Object.keys(active_requests).forEach(abort_request);
      cache_entries = Object.create(null);
      known_revisions = Object.create(null);
      clear_rendered_layers();
      status_notifications_suspended = false;
      on_change({
        state: 'invalidated',
        cache_key: '',
        window_key: '',
        payload: null,
        cached_windows: []
      });
      notify_status_change('invalidated');
    }

    /**
     * Initialize this independent cache owner.
     *
     * @return {void}
     */
    function initialize() {
      is_initialized = true;
    }

    /**
     * Abort all reads and remove page-lifetime Availability cache data.
     *
     * @return {void}
     */
    function destroy() {
      if (!is_initialized) {
        return;
      }
      status_notifications_suspended = true;
      Object.keys(active_requests).forEach(abort_request);
      cache_entries = Object.create(null);
      desired_descriptors = Object.create(null);
      known_revisions = Object.create(null);
      clear_rendered_layers();
      status_notifications_suspended = false;
      is_initialized = false;
    }
    return {
      initialize: initialize,
      destroy: destroy,
      invalidate: invalidate,
      synchronize: synchronize,
      get_cached_windows: get_cached_windows
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_availability_cache_controller);
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9fb3V0L3RpbWVsaW5lLWF2YWlsYWJpbGl0eS1jYWNoZS5qcyIsIm5hbWVzIjpbIndpbmRvdyIsIm1vZHVsZV9pZCIsImNyZWF0ZV9hdmFpbGFiaWxpdHlfY2FjaGVfY29udHJvbGxlciIsImNvbnRleHQiLCJtb3VudCIsInNldHRpbmdzIiwiZ2V0X2F4aXMiLCJheGlzIiwiZ2V0X2dlb21ldHJ5Iiwib25fY2hhbmdlIiwib25fc3RhdHVzX2NoYW5nZSIsInNlbmRfcmVxdWVzdCIsInNlbmRfYWpheF9yZXF1ZXN0IiwiY2FjaGVfZW50cmllcyIsIk9iamVjdCIsImNyZWF0ZSIsImFjdGl2ZV9yZXF1ZXN0cyIsImRlc2lyZWRfZGVzY3JpcHRvcnMiLCJrbm93bl9yZXZpc2lvbnMiLCJyZXF1ZXN0X2dlbmVyYXRpb24iLCJzdGF0dXNfbm90aWZpY2F0aW9uc19zdXNwZW5kZWQiLCJpc19pbml0aWFsaXplZCIsImF2YWlsYWJpbGl0eV9zb3VyY2VfaWRzIiwiYXBwb2ludG1lbnRfYnVmZmVyIiwiYmxvY2tlZF9kYXRlIiwiYmxvY2tlZF90aW1lIiwiYm9va2luZ19idWZmZXIiLCJzZWFzb25hbF9hdmFpbGFiaWxpdHkiLCJ1bmF2YWlsYWJsZV93ZWVrZGF5Iiwid29ya2luZ190aW1lIiwiZ2V0X2xpbWl0cyIsImxpbWl0cyIsIm1ldGFkYXRhIiwid2luZG93X2xvYWRpbmciLCJtYXhpbXVtX2NhY2hlZF93aW5kb3dzIiwiTWF0aCIsIm1heCIsIm1pbiIsIk51bWJlciIsInJlcXVlc3RfdGltZW91dF9tcyIsIm5vcm1hbGl6ZV9yZXNvdXJjZV9pZHMiLCJyZXNvdXJjZXMiLCJzZWVuIiwiQXJyYXkiLCJpc0FycmF5IiwibWFwIiwicmVzb3VyY2UiLCJpZCIsImZpbHRlciIsInJlc291cmNlX2lkIiwiaXNJbnRlZ2VyIiwic29ydCIsImxlZnRfaWQiLCJyaWdodF9pZCIsImJ1aWxkX2Rlc2NyaXB0b3IiLCJ3aW5kb3dfZW50cnkiLCJwYXlsb2FkIiwidGltZWxpbmVfd2luZG93Iiwid2luZG93X2NvbnRleHQiLCJyZXNvdXJjZV9pZHMiLCJleHBsaWNpdF9yZXZpc2lvbiIsIlN0cmluZyIsImF2YWlsYWJpbGl0eV9yZXZpc2lvbiIsImlkZW50aXR5X3BhcnRzIiwiYmFzZV9rZXkiLCJyZXF1ZXN0X3ZhbHVlcyIsImxlbmd0aCIsInN0YXJ0X2F0IiwiZW5kX2F0IiwidmlldyIsInRpbWV6b25lIiwicmVzb3VyY2VfZmluZ2VycHJpbnQiLCJqb2luIiwiY2VsbF9taW51dGVzIiwiYW5jaG9yX2RhdGUiLCJhbmNob3JfYXQiLCJhbmNob3JfcmF0aW8iLCJ3aW5kb3dfcG9zaXRpb24iLCJzbGljZSIsIndpbmRvd19tb250aHMiLCJ3aW5kb3dfZGF5cyIsImNhY2hlX2tleSIsIndpbmRvd19rZXkiLCJrZXkiLCJ0aW1lb3V0X21zIiwidHJhbnNwb3J0IiwiYXZhaWxhYmlsaXR5IiwialF1ZXJ5IiwidXJsIiwiYWN0aW9uIiwibm9uY2UiLCJhamF4IiwibWV0aG9kIiwiZGF0YVR5cGUiLCJkYXRhIiwiYXNzaWduIiwidGltZW91dCIsInJlc3BvbnNlX21hdGNoZXNfZGVzY3JpcHRvciIsImRlc2NyaXB0b3IiLCJnZW5lcmF0aW9uIiwicmVzcG9uc2Vfd2luZG93IiwicmVzcG9uc2VfcmVzb3VyY2VfaWRzIiwicGFyc2VfdGltZXN0YW1wIiwidGltZXN0YW1wIiwibm9ybWFsaXplZF90aW1lc3RhbXAiLCJtaWxsaXNlY29uZHMiLCJ0ZXN0IiwiRGF0ZSIsInBhcnNlIiwiaXNGaW5pdGUiLCJjbGVhcl9yZW5kZXJlZF9sYXllcnMiLCJsYXllcnMiLCJxdWVyeVNlbGVjdG9yQWxsIiwicHJvdG90eXBlIiwiZm9yRWFjaCIsImNhbGwiLCJsYXllciIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsImNyZWF0ZV9hdmFpbGFiaWxpdHlfbGF5ZXIiLCJ0cmFjayIsInNlZ21lbnRfaG9zdCIsInF1ZXJ5U2VsZWN0b3IiLCJ0ZXh0Q29udGVudCIsIm93bmVyRG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwic2V0QXR0cmlidXRlIiwiaW5zZXJ0QmVmb3JlIiwiZ2V0X3JlbGF0ZWRfYm9va2luZ19nZW9tZXRyeSIsInJlbGF0ZWRfc2VnbWVudF9pZCIsImJvb2tpbmdfc2VnbWVudHMiLCJtYXRjaGVkX3NlZ21lbnQiLCJibG9ja19zdGFydCIsImJsb2NrX3NpemUiLCJsYW5lX2luZGV4Iiwic29tZSIsImJvb2tpbmdfc2VnbWVudCIsImdldEF0dHJpYnV0ZSIsIm9mZnNldFRvcCIsIm9mZnNldEhlaWdodCIsImdldF9yZW5kZXJhYmxlX2ludGVydmFscyIsImF4aXNfY2VsbHMiLCJjZWxscyIsImF4aXNfc3RhcnQiLCJzdGFydF9lcG9jaCIsImF4aXNfZW5kIiwiZW5kX2Vwb2NoIiwiaW50ZXJ2YWxzIiwibWVyZ2VkIiwiZ2V0X2NhY2hlZF93aW5kb3dzIiwiY2FjaGVfZW50cnkiLCJsb2FkZWRfd2luZG93IiwibG9hZGVkX3N0YXJ0IiwibG9hZGVkX2VuZCIsImxvYWRlZF9yZXNvdXJjZV9pZHMiLCJpbnRlcnZhbCIsInNvdXJjZSIsInN0YXRlIiwicHVzaCIsImxlZnRfaW50ZXJ2YWwiLCJyaWdodF9pbnRlcnZhbCIsImxvY2FsZUNvbXBhcmUiLCJwcmV2aW91c19pbnRlcnZhbCIsInJlbmRlcl9jYWNoZWRfYXZhaWxhYmlsaXR5IiwidHJhY2tzIiwibGF5ZXJzX2J5X3Jlc291cmNlX2lkIiwiZ2VvbWV0cnkiLCJvZmZzZXRfcGVyY2VudCIsIndpZHRoX3BlcmNlbnQiLCJjbGFtcGVkX29mZnNldF9wZXJjZW50IiwiY2xhbXBlZF93aWR0aF9wZXJjZW50IiwiaW50ZXJ2YWxfZWxlbWVudCIsInJlbGF0ZWRfYm9va2luZ19nZW9tZXRyeSIsInN0eWxlIiwic2V0UHJvcGVydHkiLCJhcHBlbmRDaGlsZCIsIm5vdGlmeV9jaGFuZ2UiLCJjYWNoZWRfd2luZG93cyIsIm5vdGlmeV9zdGF0dXNfY2hhbmdlIiwiZGVzaXJlZF9rZXlzIiwicGVuZGluZ19jb3VudCIsImxvYWRlZF9jb3VudCIsImtleXMiLCJCb29sZWFuIiwiY2FjaGVkX2VudHJ5Iiwic2NoZW1hX3ZlcnNpb24iLCJkZXNpcmVkX2NvdW50IiwiZmFpbGVkX2NvdW50IiwiaXNfc2V0dGxlZCIsImNhY2hlX3Jlc3BvbnNlIiwicmVzcG9uc2VfcmV2aXNpb24iLCJub3RpZmljYXRpb25fZGVzY3JpcHRvciIsInJlcXVlc3RfZGVzY3JpcHRvciIsInJlcXVlc3QiLCJhYm9ydF9yZXF1ZXN0IiwiZG9uZSIsImZhaWwiLCJhbHdheXMiLCJyZXNwb25zZSIsImFjdGl2ZV9yZXF1ZXN0Iiwic3VjY2VzcyIsImZhaWxlZF9yZXF1ZXN0IiwicmVxdWVzdF9zdGF0dXMiLCJhYm9ydCIsInN5bmNocm9uaXplIiwid2luZG93X2VudHJpZXMiLCJuZXh0X2Rlc2NyaXB0b3JzIiwiaW52YWxpZGF0ZSIsImluaXRpYWxpemUiLCJkZXN0cm95Iiwid3BiY190aW1lbGluZV9tb2R1bGVzIiwicmVnaXN0ZXJfZmFjdG9yeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtdGltZWxpbmUvX3NyYy90aW1lbGluZS1hdmFpbGFiaWxpdHktY2FjaGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaW1lbGluZSBsYXp5IEF2YWlsYWJpbGl0eSB0cmFuc3BvcnQgYW5kIGJvdW5kZWQgY2FjaGUgY29udHJvbGxlci5cbiAqXG4gKiBCb29raW5nIHdpbmRvd3MgcmVtYWluIGF1dGhvcml0YXRpdmUgYW5kIHJlbmRlciBpbmRlcGVuZGVudGx5LiBUaGlzIG1vZHVsZVxuICogbWlycm9ycyBvbmx5IHRoZSBhY2NlcHRlZCBwcmV2aW91cy9jdXJyZW50L25leHQgd2luZG93IGlkZW50aXRpZXMsIGxvYWRzIHRoZVxuICogZGF0YS1vbmx5IEF2YWlsYWJpbGl0eSBwcm9qZWN0aW9uIGluIHBhcmFsbGVsLCByZWplY3RzIHN0YWxlIHJlc3BvbnNlcywgYW5kXG4gKiBleHBvc2VzIGEgbmV1dHJhbCBjYWNoZSBtaXNzIHdoZW4gYSByZWFkIGNhbm5vdCBiZSBjb21wbGV0ZWQuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICogQHNpbmNlICAgMTIuMC4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3cgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2lkID0gJ2F2YWlsYWJpbGl0eV9jYWNoZSc7XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgYm91bmRlZCBsYXp5IEF2YWlsYWJpbGl0eSBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICBjb250ZXh0ICAgICAgICAgICAgICAgICAgICBDb250cm9sbGVyIGNvbnN0cnVjdGlvbiBjb250ZXh0LlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9ICBjb250ZXh0Lm1vdW50ICAgICAgICAgICAgICBUaW1lbGluZSBtb3VudCBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICBjb250ZXh0LnNldHRpbmdzICAgICAgICAgICBTZXJ2ZXItbG9jYWxpemVkIFRpbWVsaW5lIHNldHRpbmdzLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZXh0LmdldF9heGlzICAgICAgICAgICBDdXJyZW50IGNvbXBvc2VkLWF4aXMgY2FsbGJhY2suXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRleHQuZ2V0X2dlb21ldHJ5ICAgICAgIENhbm9uaWNhbCBheGlzLWdlb21ldHJ5IGNhbGxiYWNrLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZXh0Lm9uX2NoYW5nZSAgICAgICAgICBPcHRpb25hbCBjYWNoZS1zdGF0ZSBjYWxsYmFjay5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY29udGV4dC5vbl9zdGF0dXNfY2hhbmdlICAgT3B0aW9uYWwgYWdncmVnYXRlIHJlYWQtc3RhdHVzIGNhbGxiYWNrLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZXh0LnNlbmRfcmVxdWVzdCAgICAgICBPcHRpb25hbCB0cmFuc3BvcnQgb3ZlcnJpZGUgZm9yIHRlc3RzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEF2YWlsYWJpbGl0eSBjYWNoZSBsaWZlY3ljbGUgYW5kIHJlYWQgQVBJLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX2F2YWlsYWJpbGl0eV9jYWNoZV9jb250cm9sbGVyKCBjb250ZXh0ICkge1xuXHRcdHZhciBtb3VudCA9IGNvbnRleHQubW91bnQgfHwgbnVsbDtcblx0XHR2YXIgc2V0dGluZ3MgPSBjb250ZXh0LnNldHRpbmdzIHx8IHt9O1xuXHRcdHZhciBnZXRfYXhpcyA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LmdldF9heGlzID8gY29udGV4dC5nZXRfYXhpcyA6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiBzZXR0aW5ncy5heGlzIHx8IHt9O1xuXHRcdH07XG5cdFx0dmFyIGdldF9nZW9tZXRyeSA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LmdldF9nZW9tZXRyeSA/IGNvbnRleHQuZ2V0X2dlb21ldHJ5IDogZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHt9O1xuXHRcdH07XG5cdFx0dmFyIG9uX2NoYW5nZSA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0Lm9uX2NoYW5nZSA/IGNvbnRleHQub25fY2hhbmdlIDogZnVuY3Rpb24gKCkge307XG5cdFx0dmFyIG9uX3N0YXR1c19jaGFuZ2UgPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5vbl9zdGF0dXNfY2hhbmdlID8gY29udGV4dC5vbl9zdGF0dXNfY2hhbmdlIDogZnVuY3Rpb24gKCkge307XG5cdFx0dmFyIHNlbmRfcmVxdWVzdCA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LnNlbmRfcmVxdWVzdCA/IGNvbnRleHQuc2VuZF9yZXF1ZXN0IDogc2VuZF9hamF4X3JlcXVlc3Q7XG5cdFx0dmFyIGNhY2hlX2VudHJpZXMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIGFjdGl2ZV9yZXF1ZXN0cyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIgZGVzaXJlZF9kZXNjcmlwdG9ycyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIga25vd25fcmV2aXNpb25zID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciByZXF1ZXN0X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBzdGF0dXNfbm90aWZpY2F0aW9uc19zdXNwZW5kZWQgPSBmYWxzZTtcblx0XHR2YXIgaXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR2YXIgYXZhaWxhYmlsaXR5X3NvdXJjZV9pZHMgPSB7XG5cdFx0XHRhcHBvaW50bWVudF9idWZmZXI6IHRydWUsXG5cdFx0XHRibG9ja2VkX2RhdGU6IHRydWUsXG5cdFx0XHRibG9ja2VkX3RpbWU6IHRydWUsXG5cdFx0XHRib29raW5nX2J1ZmZlcjogdHJ1ZSxcblx0XHRcdHNlYXNvbmFsX2F2YWlsYWJpbGl0eTogdHJ1ZSxcblx0XHRcdHVuYXZhaWxhYmxlX3dlZWtkYXk6IHRydWUsXG5cdFx0XHR3b3JraW5nX3RpbWU6IHRydWVcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG5vcm1hbGl6ZWQgVGltZWxpbmUgbG9hZGluZyBsaW1pdHMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IEJvdW5kZWQgY2FjaGUgY291bnQgYW5kIHJlcXVlc3QgdGltZW91dC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbGltaXRzKCkge1xuXHRcdFx0dmFyIGxpbWl0cyA9IHNldHRpbmdzLm1ldGFkYXRhICYmIHNldHRpbmdzLm1ldGFkYXRhLndpbmRvd19sb2FkaW5nID8gc2V0dGluZ3MubWV0YWRhdGEud2luZG93X2xvYWRpbmcgOiB7fTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bWF4aW11bV9jYWNoZWRfd2luZG93czogTWF0aC5tYXgoIDEsIE1hdGgubWluKCAzLCBOdW1iZXIoIGxpbWl0cy5tYXhpbXVtX2NhY2hlZF93aW5kb3dzICkgfHwgMyApICksXG5cdFx0XHRcdHJlcXVlc3RfdGltZW91dF9tczogTWF0aC5tYXgoIDEwMDAsIE51bWJlciggbGltaXRzLnJlcXVlc3RfdGltZW91dF9tcyApIHx8IDE1MDAwIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHNvcnRlZCB1bmlxdWUgcG9zaXRpdmUgUmVzb3VyY2UgSURzIGZyb20gb25lIGJvb2tpbmcgd2luZG93LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSByZXNvdXJjZXMgQXV0aG9yaXplZCBSZXNvdXJjZSBEVE9zLlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PG51bWJlcj59IFN0YWJsZSBSZXNvdXJjZSBJRCBzZXQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3Jlc291cmNlX2lkcyggcmVzb3VyY2VzICkge1xuXHRcdFx0dmFyIHNlZW4gPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cblx0XHRcdHJldHVybiAoIEFycmF5LmlzQXJyYXkoIHJlc291cmNlcyApID8gcmVzb3VyY2VzIDogW10gKS5tYXAoIGZ1bmN0aW9uICggcmVzb3VyY2UgKSB7XG5cdFx0XHRcdHJldHVybiBOdW1iZXIoIHJlc291cmNlICYmIHJlc291cmNlLmlkICk7XG5cdFx0XHR9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRpZiAoICEgTnVtYmVyLmlzSW50ZWdlciggcmVzb3VyY2VfaWQgKSB8fCAxID4gcmVzb3VyY2VfaWQgfHwgc2VlblsgcmVzb3VyY2VfaWQgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VlblsgcmVzb3VyY2VfaWQgXSA9IHRydWU7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSApLnNvcnQoIGZ1bmN0aW9uICggbGVmdF9pZCwgcmlnaHRfaWQgKSB7XG5cdFx0XHRcdHJldHVybiBsZWZ0X2lkIC0gcmlnaHRfaWQ7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgb25lIGV4YWN0LCBhdXRob3JpemVkIGNhY2hlIGRlc2NyaXB0b3IgZnJvbSBhIGJvb2tpbmctd2luZG93IGVudHJ5LlxuXHRcdCAqXG5cdFx0ICogVGhlIGlkZW50aXR5IGluY2x1ZGVzIGJvdGggdGhlIG9wYXF1ZSBzZXJ2ZXIgZmluZ2VycHJpbnQgYW5kIGV4cGxpY2l0XG5cdFx0ICogYXV0aG9yaXplZCBSZXNvdXJjZSBJRHMsIHRoZSBoYWxmLW9wZW4gd2luZG93LCBzY2FsZSwgdGltZXpvbmUsIGFuZCBhblxuXHRcdCAqIEF2YWlsYWJpbGl0eSByZXZpc2lvbiB3aGVuIHRoZSBzZXJ2ZXIgZXhwb3NlcyBvbmUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gd2luZG93X2VudHJ5IFdpbmRvdy1jYWNoZSBgeyBrZXksIHBheWxvYWQgfWAgZW50cnkuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEV4YWN0IGNhY2hlIGRlc2NyaXB0b3Igb3IgbnVsbCB3aGVuIGluY29tcGxldGUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnVpbGRfZGVzY3JpcHRvciggd2luZG93X2VudHJ5ICkge1xuXHRcdFx0dmFyIHBheWxvYWQgPSB3aW5kb3dfZW50cnkgJiYgd2luZG93X2VudHJ5LnBheWxvYWQgPyB3aW5kb3dfZW50cnkucGF5bG9hZCA6IHt9O1xuXHRcdFx0dmFyIHRpbWVsaW5lX3dpbmRvdyA9IHBheWxvYWQud2luZG93IHx8IHt9O1xuXHRcdFx0dmFyIGF4aXMgPSBwYXlsb2FkLmF4aXMgfHwge307XG5cdFx0XHR2YXIgd2luZG93X2NvbnRleHQgPSBwYXlsb2FkLndpbmRvd19jb250ZXh0IHx8IHt9O1xuXHRcdFx0dmFyIHJlc291cmNlX2lkcyA9IG5vcm1hbGl6ZV9yZXNvdXJjZV9pZHMoIHBheWxvYWQucmVzb3VyY2VzICk7XG5cdFx0XHR2YXIgZXhwbGljaXRfcmV2aXNpb24gPSBTdHJpbmcoXG5cdFx0XHRcdHdpbmRvd19jb250ZXh0LmF2YWlsYWJpbGl0eV9yZXZpc2lvblxuXHRcdFx0XHR8fCB0aW1lbGluZV93aW5kb3cuYXZhaWxhYmlsaXR5X3JldmlzaW9uXG5cdFx0XHRcdHx8ICcnXG5cdFx0XHQpO1xuXHRcdFx0dmFyIGlkZW50aXR5X3BhcnRzO1xuXHRcdFx0dmFyIGJhc2Vfa2V5O1xuXHRcdFx0dmFyIGF2YWlsYWJpbGl0eV9yZXZpc2lvbjtcblx0XHRcdHZhciByZXF1ZXN0X3ZhbHVlcztcblxuXHRcdFx0aWYgKCAhIHJlc291cmNlX2lkcy5sZW5ndGggfHwgISB0aW1lbGluZV93aW5kb3cuc3RhcnRfYXQgfHwgISB0aW1lbGluZV93aW5kb3cuZW5kX2F0IHx8ICEgdGltZWxpbmVfd2luZG93LnZpZXcgfHwgISB0aW1lbGluZV93aW5kb3cudGltZXpvbmUgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpZGVudGl0eV9wYXJ0cyA9IFtcblx0XHRcdFx0U3RyaW5nKCB3aW5kb3dfY29udGV4dC5yZXNvdXJjZV9maW5nZXJwcmludCB8fCAnJyApLFxuXHRcdFx0XHRyZXNvdXJjZV9pZHMuam9pbiggJywnICksXG5cdFx0XHRcdFN0cmluZyggdGltZWxpbmVfd2luZG93LnN0YXJ0X2F0ICksXG5cdFx0XHRcdFN0cmluZyggdGltZWxpbmVfd2luZG93LmVuZF9hdCApLFxuXHRcdFx0XHRTdHJpbmcoIHRpbWVsaW5lX3dpbmRvdy52aWV3ICksXG5cdFx0XHRcdFN0cmluZyggdGltZWxpbmVfd2luZG93LmNlbGxfbWludXRlcyB8fCBheGlzLmNlbGxfbWludXRlcyB8fCAnJyApLFxuXHRcdFx0XHRTdHJpbmcoIHRpbWVsaW5lX3dpbmRvdy50aW1lem9uZSApXG5cdFx0XHRdO1xuXHRcdFx0YmFzZV9rZXkgPSBpZGVudGl0eV9wYXJ0cy5qb2luKCAnfCcgKTtcblx0XHRcdGF2YWlsYWJpbGl0eV9yZXZpc2lvbiA9IGV4cGxpY2l0X3JldmlzaW9uIHx8IFN0cmluZygga25vd25fcmV2aXNpb25zWyBiYXNlX2tleSBdIHx8ICcnICk7XG5cdFx0XHRyZXF1ZXN0X3ZhbHVlcyA9IHtcblx0XHRcdFx0YW5jaG9yX2RhdGU6IFN0cmluZyggdGltZWxpbmVfd2luZG93LmFuY2hvcl9kYXRlIHx8ICcnICksXG5cdFx0XHRcdGFuY2hvcl9hdDogU3RyaW5nKCB0aW1lbGluZV93aW5kb3cuYW5jaG9yX2F0IHx8IHRpbWVsaW5lX3dpbmRvdy5zdGFydF9hdCApLFxuXHRcdFx0XHRhbmNob3JfcmF0aW86IE51bWJlciggdGltZWxpbmVfd2luZG93LmFuY2hvcl9yYXRpbyB8fCAwICksXG5cdFx0XHRcdHdpbmRvd19wb3NpdGlvbjogTnVtYmVyKCB0aW1lbGluZV93aW5kb3cud2luZG93X3Bvc2l0aW9uIHx8IDAgKSxcblx0XHRcdFx0dmlldzogU3RyaW5nKCB0aW1lbGluZV93aW5kb3cudmlldyApLFxuXHRcdFx0XHRyZXNvdXJjZV9pZHM6IHJlc291cmNlX2lkcy5zbGljZSgpXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCAwIDwgTnVtYmVyKCB0aW1lbGluZV93aW5kb3cud2luZG93X21vbnRocyB8fCAwICkgKSB7XG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzLndpbmRvd19tb250aHMgPSBOdW1iZXIoIHRpbWVsaW5lX3dpbmRvdy53aW5kb3dfbW9udGhzICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXF1ZXN0X3ZhbHVlcy53aW5kb3dfZGF5cyA9IE51bWJlciggdGltZWxpbmVfd2luZG93LndpbmRvd19kYXlzIHx8IDAgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0YmFzZV9rZXk6IGJhc2Vfa2V5LFxuXHRcdFx0XHRjYWNoZV9rZXk6IGJhc2Vfa2V5ICsgJ3wnICsgYXZhaWxhYmlsaXR5X3JldmlzaW9uLFxuXHRcdFx0XHR3aW5kb3dfa2V5OiBTdHJpbmcoIHdpbmRvd19lbnRyeS5rZXkgfHwgd2luZG93X2NvbnRleHQud2luZG93X2tleSB8fCAnJyApLFxuXHRcdFx0XHRyZXNvdXJjZV9pZHM6IHJlc291cmNlX2lkcyxcblx0XHRcdFx0cmVzb3VyY2VfZmluZ2VycHJpbnQ6IFN0cmluZyggd2luZG93X2NvbnRleHQucmVzb3VyY2VfZmluZ2VycHJpbnQgfHwgJycgKSxcblx0XHRcdFx0c3RhcnRfYXQ6IFN0cmluZyggdGltZWxpbmVfd2luZG93LnN0YXJ0X2F0ICksXG5cdFx0XHRcdGVuZF9hdDogU3RyaW5nKCB0aW1lbGluZV93aW5kb3cuZW5kX2F0ICksXG5cdFx0XHRcdHZpZXc6IFN0cmluZyggdGltZWxpbmVfd2luZG93LnZpZXcgKSxcblx0XHRcdFx0Y2VsbF9taW51dGVzOiBOdW1iZXIoIHRpbWVsaW5lX3dpbmRvdy5jZWxsX21pbnV0ZXMgfHwgYXhpcy5jZWxsX21pbnV0ZXMgfHwgMCApLFxuXHRcdFx0XHR0aW1lem9uZTogU3RyaW5nKCB0aW1lbGluZV93aW5kb3cudGltZXpvbmUgKSxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3JldmlzaW9uOiBhdmFpbGFiaWxpdHlfcmV2aXNpb24sXG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzOiByZXF1ZXN0X3ZhbHVlc1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTZW5kIG9uZSBhdXRoZW50aWNhdGVkIEF2YWlsYWJpbGl0eSByZXF1ZXN0IHRocm91Z2ggdGhlIGxvY2FsaXplZCBlbmRwb2ludC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0X3ZhbHVlcyBWYWxpZGF0ZWQgYm9va2luZy13aW5kb3cgcmVxdWVzdCB2YWx1ZXMuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHRpbWVvdXRfbXMgICAgUmVxdWVzdCB0aW1lb3V0IGluIG1pbGxpc2Vjb25kcy5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0galF1ZXJ5LWNvbXBhdGlibGUgcmVxdWVzdCB0cmFuc3BvcnQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2VuZF9hamF4X3JlcXVlc3QoIHJlcXVlc3RfdmFsdWVzLCB0aW1lb3V0X21zICkge1xuXHRcdFx0dmFyIHRyYW5zcG9ydCA9IHNldHRpbmdzLnRyYW5zcG9ydCAmJiBzZXR0aW5ncy50cmFuc3BvcnQuYXZhaWxhYmlsaXR5ID8gc2V0dGluZ3MudHJhbnNwb3J0LmF2YWlsYWJpbGl0eSA6IHt9O1xuXG5cdFx0XHRpZiAoICEgd2luZG93LmpRdWVyeSB8fCAhIHNldHRpbmdzLnRyYW5zcG9ydCB8fCAhIHNldHRpbmdzLnRyYW5zcG9ydC51cmwgfHwgISB0cmFuc3BvcnQuYWN0aW9uIHx8ICEgdHJhbnNwb3J0Lm5vbmNlICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0XHR1cmw6IHNldHRpbmdzLnRyYW5zcG9ydC51cmwsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiBPYmplY3QuYXNzaWduKCB7fSwgcmVxdWVzdF92YWx1ZXMsIHtcblx0XHRcdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5hY3Rpb24sXG5cdFx0XHRcdFx0bm9uY2U6IHRyYW5zcG9ydC5ub25jZVxuXHRcdFx0XHR9ICksXG5cdFx0XHRcdHRpbWVvdXQ6IHRpbWVvdXRfbXNcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb21wYXJlIGEgcmVzcG9uc2Ugd2l0aCB0aGUgZXhhY3QgcmVxdWVzdGVkIGF1dGhvcml6ZWQgd2luZG93IGlkZW50aXR5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRlc2NyaXB0b3IgRXhhY3QgcmVxdWVzdCBkZXNjcmlwdG9yLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBwYXlsb2FkICAgIEF2YWlsYWJpbGl0eSByZXNwb25zZSBwYXlsb2FkLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBnZW5lcmF0aW9uIE93bmluZyByZXF1ZXN0IGdlbmVyYXRpb24uXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSByZXNwb25zZSBiZWxvbmdzIHRvIHRoZSByZXF1ZXN0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3BvbnNlX21hdGNoZXNfZGVzY3JpcHRvciggZGVzY3JpcHRvciwgcGF5bG9hZCwgZ2VuZXJhdGlvbiApIHtcblx0XHRcdHZhciByZXNwb25zZV93aW5kb3cgPSBwYXlsb2FkICYmIHBheWxvYWQud2luZG93ID8gcGF5bG9hZC53aW5kb3cgOiB7fTtcblx0XHRcdHZhciByZXNwb25zZV9yZXNvdXJjZV9pZHMgPSBub3JtYWxpemVfcmVzb3VyY2VfaWRzKFxuXHRcdFx0XHQoIHBheWxvYWQgJiYgQXJyYXkuaXNBcnJheSggcGF5bG9hZC5yZXNvdXJjZV9pZHMgKSA/IHBheWxvYWQucmVzb3VyY2VfaWRzIDogW10gKS5tYXAoIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgaWQ6IHJlc291cmNlX2lkIH07XG5cdFx0XHRcdH0gKVxuXHRcdFx0KTtcblxuXHRcdFx0cmV0dXJuIE51bWJlciggcmVzcG9uc2Vfd2luZG93LnJlcXVlc3RfZ2VuZXJhdGlvbiApID09PSBnZW5lcmF0aW9uXG5cdFx0XHRcdCYmIGRlc2NyaXB0b3Iuc3RhcnRfYXQgPT09IFN0cmluZyggcmVzcG9uc2Vfd2luZG93LnN0YXJ0X2F0IHx8ICcnIClcblx0XHRcdFx0JiYgZGVzY3JpcHRvci5lbmRfYXQgPT09IFN0cmluZyggcmVzcG9uc2Vfd2luZG93LmVuZF9hdCB8fCAnJyApXG5cdFx0XHRcdCYmIGRlc2NyaXB0b3IudmlldyA9PT0gU3RyaW5nKCByZXNwb25zZV93aW5kb3cudmlldyB8fCAnJyApXG5cdFx0XHRcdCYmIGRlc2NyaXB0b3IuY2VsbF9taW51dGVzID09PSBOdW1iZXIoIHJlc3BvbnNlX3dpbmRvdy5jZWxsX21pbnV0ZXMgfHwgMCApXG5cdFx0XHRcdCYmIGRlc2NyaXB0b3IudGltZXpvbmUgPT09IFN0cmluZyggcmVzcG9uc2Vfd2luZG93LnRpbWV6b25lIHx8ICcnIClcblx0XHRcdFx0JiYgZGVzY3JpcHRvci5yZXNvdXJjZV9pZHMuam9pbiggJywnICkgPT09IHJlc3BvbnNlX3Jlc291cmNlX2lkcy5qb2luKCAnLCcgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQYXJzZSBvbmUgb2Zmc2V0LWV4cGxpY2l0IHNlcnZlciB0aW1lc3RhbXAgaW50byBlcG9jaCBzZWNvbmRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRpbWVzdGFtcCBSRkMgMzMzOSBzZXJ2ZXIgdGltZXN0YW1wLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcnxudWxsfSBFcG9jaCBzZWNvbmRzLCBvciBudWxsIGZvciBhbiBpbnZhbGlkIHRpbWVzdGFtcC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwYXJzZV90aW1lc3RhbXAoIHRpbWVzdGFtcCApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX3RpbWVzdGFtcCA9IFN0cmluZyggdGltZXN0YW1wIHx8ICcnICk7XG5cdFx0XHR2YXIgbWlsbGlzZWNvbmRzO1xuXG5cdFx0XHRpZiAoICEgLyg/Olp8WystXVxcZHsyfTpcXGR7Mn0pJC9pLnRlc3QoIG5vcm1hbGl6ZWRfdGltZXN0YW1wICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0bWlsbGlzZWNvbmRzID0gRGF0ZS5wYXJzZSggbm9ybWFsaXplZF90aW1lc3RhbXAgKTtcblxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbWlsbGlzZWNvbmRzICkgPyBtaWxsaXNlY29uZHMgLyAxMDAwIDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW1vdmUgZXZlcnkgQXZhaWxhYmlsaXR5IHByZXNlbnRhdGlvbiBsYXllciBvd25lZCBieSB0aGlzIGNvbnRyb2xsZXIuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsZWFyX3JlbmRlcmVkX2xheWVycygpIHtcblx0XHRcdHZhciBsYXllcnMgPSBtb3VudCA/IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLWF2YWlsYWJpbGl0eS1sYXllcl0nICkgOiBbXTtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggbGF5ZXJzLCBmdW5jdGlvbiAoIGxheWVyICkge1xuXHRcdFx0XHRpZiAoIGxheWVyLnBhcmVudE5vZGUgKSB7XG5cdFx0XHRcdFx0bGF5ZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggbGF5ZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgcmV1c2FibGUgcG9pbnRlci10cmFuc3BhcmVudCBsYXllciBiZXR3ZWVuIGNlbGxzIGFuZCBzZWdtZW50cy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gdHJhY2sgUmVzb3VyY2Utcm93IFRpbWVsaW5lIHRyYWNrLlxuXHRcdCAqIEByZXR1cm4ge0VsZW1lbnR8bnVsbH0gQXZhaWxhYmlsaXR5IGxheWVyLCBvciBudWxsIHdpdGhvdXQgYSBzZWdtZW50IGhvc3QuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY3JlYXRlX2F2YWlsYWJpbGl0eV9sYXllciggdHJhY2sgKSB7XG5cdFx0XHR2YXIgc2VnbWVudF9ob3N0ID0gdHJhY2sgPyB0cmFjay5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50c10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGxheWVyID0gdHJhY2sgPyB0cmFjay5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1hdmFpbGFiaWxpdHktbGF5ZXJdJyApIDogbnVsbDtcblxuXHRcdFx0aWYgKCAhIHRyYWNrIHx8ICEgc2VnbWVudF9ob3N0ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICggbGF5ZXIgKSB7XG5cdFx0XHRcdGxheWVyLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRcdHJldHVybiBsYXllcjtcblx0XHRcdH1cblxuXHRcdFx0bGF5ZXIgPSB0cmFjay5vd25lckRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0XHRsYXllci5jbGFzc05hbWUgPSAnd3BiY190aW1lbGluZV9fYXZhaWxhYmlsaXR5X2xheWVyJztcblx0XHRcdGxheWVyLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1hdmFpbGFiaWxpdHktbGF5ZXInLCAnJyApO1xuXHRcdFx0bGF5ZXIuc2V0QXR0cmlidXRlKCAncm9sZScsICdwcmVzZW50YXRpb24nICk7XG5cdFx0XHRsYXllci5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xuXHRcdFx0dHJhY2suaW5zZXJ0QmVmb3JlKCBsYXllciwgc2VnbWVudF9ob3N0ICk7XG5cblx0XHRcdHJldHVybiBsYXllcjtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGN1cnJlbnQgYmxvY2sgZ2VvbWV0cnkgb2Ygb25lIHJlbGF0ZWQgYm9va2luZyBjYXJkLlxuXHRcdCAqXG5cdFx0ICogQnVmZmVyIHRpbWVzdGFtcHMgcmVtYWluIHNlcnZlci1hdXRob3JpdGF0aXZlLiBUaGUgb3B0aW9uYWwgc2VnbWVudCBJRFxuXHRcdCAqIG9ubHkgbGV0cyB0aGUgZGVjb3JhdGl2ZSBsYXllciByZXVzZSB0aGUgYWxyZWFkeSByZW5kZXJlZCBjYXJkJ3MgbGFuZVxuXHRcdCAqIGFuZCBleGFjdCBoZWlnaHQ7IGl0IG5ldmVyIGRlcml2ZXMgQXZhaWxhYmlsaXR5IGZyb20gY2FyZCBnZW9tZXRyeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gbGF5ZXIgICAgICAgICAgICAgIFJlc291cmNlIEF2YWlsYWJpbGl0eSBsYXllci5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIHJlbGF0ZWRfc2VnbWVudF9pZCBBdXRob3JpemVkIGJvb2tpbmcgc2VnbWVudCBpZGVudGl0eS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ1NTIGB7IGJsb2NrX3N0YXJ0LCBibG9ja19zaXplIH1gIHZhbHVlcywgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcmVsYXRlZF9ib29raW5nX2dlb21ldHJ5KCBsYXllciwgcmVsYXRlZF9zZWdtZW50X2lkICkge1xuXHRcdFx0dmFyIHRyYWNrID0gbGF5ZXIgPyBsYXllci5wYXJlbnROb2RlIDogbnVsbDtcblx0XHRcdHZhciBib29raW5nX3NlZ21lbnRzID0gdHJhY2sgPyB0cmFjay5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50LWlkXScgKSA6IFtdO1xuXHRcdFx0dmFyIG1hdGNoZWRfc2VnbWVudCA9IG51bGw7XG5cdFx0XHR2YXIgYmxvY2tfc3RhcnQ7XG5cdFx0XHR2YXIgYmxvY2tfc2l6ZTtcblx0XHRcdHZhciBsYW5lX2luZGV4O1xuXG5cdFx0XHRpZiAoICEgcmVsYXRlZF9zZWdtZW50X2lkICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLnNvbWUuY2FsbCggYm9va2luZ19zZWdtZW50cywgZnVuY3Rpb24gKCBib29raW5nX3NlZ21lbnQgKSB7XG5cdFx0XHRcdGlmICggcmVsYXRlZF9zZWdtZW50X2lkICE9PSBTdHJpbmcoIGJvb2tpbmdfc2VnbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudC1pZCcgKSB8fCAnJyApICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXRjaGVkX3NlZ21lbnQgPSBib29raW5nX3NlZ21lbnQ7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoICEgbWF0Y2hlZF9zZWdtZW50ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0YmxvY2tfc3RhcnQgPSBOdW1iZXIoIG1hdGNoZWRfc2VnbWVudC5vZmZzZXRUb3AgKTtcblx0XHRcdGJsb2NrX3NpemUgPSBOdW1iZXIoIG1hdGNoZWRfc2VnbWVudC5vZmZzZXRIZWlnaHQgKTtcblx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCBibG9ja19zdGFydCApICYmIE51bWJlci5pc0Zpbml0ZSggYmxvY2tfc2l6ZSApICYmIDAgPCBibG9ja19zaXplICkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGJsb2NrX3N0YXJ0OiBNYXRoLm1heCggMCwgYmxvY2tfc3RhcnQgKSArICdweCcsXG5cdFx0XHRcdFx0YmxvY2tfc2l6ZTogYmxvY2tfc2l6ZSArICdweCdcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0bGFuZV9pbmRleCA9IE51bWJlciggbWF0Y2hlZF9zZWdtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1sYW5lLWluZGV4JyApICk7XG5cdFx0XHRpZiAoICEgTnVtYmVyLmlzSW50ZWdlciggbGFuZV9pbmRleCApIHx8IDAgPiBsYW5lX2luZGV4ICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGJsb2NrX3N0YXJ0OiAnY2FsYyh2YXIoLS13cGJjX3RpbWVsaW5lX2dlbmVyYWxfX2Jvb2tpbmctbGFuZS1vZmZzZXQpICsgKCcgKyBsYW5lX2luZGV4ICsgJyAqIHZhcigtLXdwYmNfdGltZWxpbmVfZ2VuZXJhbF9fbGFuZS1oZWlnaHQpKSknLFxuXHRcdFx0XHRibG9ja19zaXplOiAndmFyKC0td3BiY190aW1lbGluZV9nZW5lcmFsX19ib29raW5nLWNhcmQtaGVpZ2h0KSdcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGV4YWN0IGludGVydmFscyBjbGlwcGVkIHRvIGJvdGggdGhlaXIgbG9hZGVkIGFuZCBjb21wb3NlZCB3aW5kb3dzLlxuXHRcdCAqXG5cdFx0ICogQWRqYWNlbnQgd2luZG93IGZyYWdtZW50cyBtZXJnZSBvbmx5IGZvciB0aGUgc2FtZSBSZXNvdXJjZSwgc291cmNlLCBhbmRcblx0XHQgKiByZWxhdGVkIGJvb2tpbmcgc2VnbWVudC4gS2VlcGluZyBib29raW5nIG93bmVyc2hpcCBwcmV2ZW50cyBvdmVybGFwcGluZ1xuXHRcdCAqIGJ1ZmZlcnMgaW4gZGlmZmVyZW50IGNhcmQgbGFuZXMgZnJvbSBjb2xsYXBzaW5nIGludG8gYSBmdWxsLXJvdyBpbnRlcnZhbC5cblx0XHQgKiBVbmtub3duIG9yIGNvbmRpdGlvbmFsIHJlY29yZHMgYXJlIG5ldmVyIHByb21vdGVkIGludG8gcmVuZGVyZWQgaW50ZXJ2YWxzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGF4aXMgQ3VycmVudCBjb21wb3NlZCBUaW1lbGluZSBheGlzLlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IFNvcnRlZCwgbWVyZ2VkLCBjbGlwcGVkIGV4YWN0IGludGVydmFsIHJlY29yZHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3JlbmRlcmFibGVfaW50ZXJ2YWxzKCBheGlzICkge1xuXHRcdFx0dmFyIGF4aXNfY2VsbHMgPSBheGlzICYmIEFycmF5LmlzQXJyYXkoIGF4aXMuY2VsbHMgKSA/IGF4aXMuY2VsbHMgOiBbXTtcblx0XHRcdHZhciBheGlzX3N0YXJ0ID0gYXhpc19jZWxscy5sZW5ndGggPyBOdW1iZXIoIGF4aXNfY2VsbHNbMF0uc3RhcnRfZXBvY2ggKSA6IE51bWJlciggYXhpcy5zdGFydF9lcG9jaCApO1xuXHRcdFx0dmFyIGF4aXNfZW5kID0gYXhpc19jZWxscy5sZW5ndGggPyBOdW1iZXIoIGF4aXNfY2VsbHNbIGF4aXNfY2VsbHMubGVuZ3RoIC0gMSBdLmVuZF9lcG9jaCApIDogTnVtYmVyKCBheGlzLmVuZF9lcG9jaCApO1xuXHRcdFx0dmFyIGludGVydmFscyA9IFtdO1xuXHRcdFx0dmFyIG1lcmdlZCA9IFtdO1xuXG5cdFx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCBheGlzX3N0YXJ0ICkgfHwgISBOdW1iZXIuaXNGaW5pdGUoIGF4aXNfZW5kICkgfHwgYXhpc19zdGFydCA+PSBheGlzX2VuZCApIHtcblx0XHRcdFx0cmV0dXJuIG1lcmdlZDtcblx0XHRcdH1cblxuXHRcdFx0Z2V0X2NhY2hlZF93aW5kb3dzKCkuZm9yRWFjaCggZnVuY3Rpb24gKCBjYWNoZV9lbnRyeSApIHtcblx0XHRcdFx0dmFyIHBheWxvYWQgPSBjYWNoZV9lbnRyeSAmJiBjYWNoZV9lbnRyeS5wYXlsb2FkID8gY2FjaGVfZW50cnkucGF5bG9hZCA6IHt9O1xuXHRcdFx0XHR2YXIgbG9hZGVkX3dpbmRvdyA9IHBheWxvYWQud2luZG93IHx8IHt9O1xuXHRcdFx0XHR2YXIgbG9hZGVkX3N0YXJ0ID0gcGFyc2VfdGltZXN0YW1wKCBsb2FkZWRfd2luZG93LnN0YXJ0X2F0ICk7XG5cdFx0XHRcdHZhciBsb2FkZWRfZW5kID0gcGFyc2VfdGltZXN0YW1wKCBsb2FkZWRfd2luZG93LmVuZF9hdCApO1xuXHRcdFx0XHR2YXIgbG9hZGVkX3Jlc291cmNlX2lkcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblxuXHRcdFx0XHQoIEFycmF5LmlzQXJyYXkoIHBheWxvYWQucmVzb3VyY2VfaWRzICkgPyBwYXlsb2FkLnJlc291cmNlX2lkcyA6IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgKTtcblx0XHRcdFx0XHRpZiAoIE51bWJlci5pc0ludGVnZXIoIHJlc291cmNlX2lkICkgJiYgMSA8PSByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRcdGxvYWRlZF9yZXNvdXJjZV9pZHNbIHJlc291cmNlX2lkIF0gPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdGlmICggbnVsbCA9PT0gbG9hZGVkX3N0YXJ0IHx8IG51bGwgPT09IGxvYWRlZF9lbmQgfHwgbG9hZGVkX3N0YXJ0ID49IGxvYWRlZF9lbmQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0KCBBcnJheS5pc0FycmF5KCBwYXlsb2FkLmludGVydmFscyApID8gcGF5bG9hZC5pbnRlcnZhbHMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCBpbnRlcnZhbCAmJiBpbnRlcnZhbC5yZXNvdXJjZV9pZCApO1xuXHRcdFx0XHRcdHZhciBzb3VyY2UgPSBTdHJpbmcoIGludGVydmFsICYmIGludGVydmFsLnNvdXJjZSB8fCAnJyApO1xuXHRcdFx0XHRcdHZhciByZWxhdGVkX3NlZ21lbnRfaWQgPSBTdHJpbmcoIGludGVydmFsICYmIGludGVydmFsLnJlbGF0ZWRfc2VnbWVudF9pZCB8fCAnJyApO1xuXHRcdFx0XHRcdHZhciBzdGFydF9lcG9jaCA9IHBhcnNlX3RpbWVzdGFtcCggaW50ZXJ2YWwgJiYgaW50ZXJ2YWwuc3RhcnRfYXQgKTtcblx0XHRcdFx0XHR2YXIgZW5kX2Vwb2NoID0gcGFyc2VfdGltZXN0YW1wKCBpbnRlcnZhbCAmJiBpbnRlcnZhbC5lbmRfYXQgKTtcblxuXHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdCdleGFjdCcgIT09IFN0cmluZyggaW50ZXJ2YWwgJiYgaW50ZXJ2YWwuc3RhdGUgfHwgJycgKVxuXHRcdFx0XHRcdFx0fHwgISBOdW1iZXIuaXNJbnRlZ2VyKCByZXNvdXJjZV9pZCApXG5cdFx0XHRcdFx0XHR8fCAxID4gcmVzb3VyY2VfaWRcblx0XHRcdFx0XHRcdHx8ICEgbG9hZGVkX3Jlc291cmNlX2lkc1sgcmVzb3VyY2VfaWQgXVxuXHRcdFx0XHRcdFx0fHwgISBhdmFpbGFiaWxpdHlfc291cmNlX2lkc1sgc291cmNlIF1cblx0XHRcdFx0XHRcdHx8IG51bGwgPT09IHN0YXJ0X2Vwb2NoXG5cdFx0XHRcdFx0XHR8fCBudWxsID09PSBlbmRfZXBvY2hcblx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRzdGFydF9lcG9jaCA9IE1hdGgubWF4KCBzdGFydF9lcG9jaCwgbG9hZGVkX3N0YXJ0LCBheGlzX3N0YXJ0ICk7XG5cdFx0XHRcdFx0ZW5kX2Vwb2NoID0gTWF0aC5taW4oIGVuZF9lcG9jaCwgbG9hZGVkX2VuZCwgYXhpc19lbmQgKTtcblx0XHRcdFx0XHRpZiAoIHN0YXJ0X2Vwb2NoID49IGVuZF9lcG9jaCApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpbnRlcnZhbHMucHVzaCgge1xuXHRcdFx0XHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxuXHRcdFx0XHRcdFx0c291cmNlOiBzb3VyY2UsXG5cdFx0XHRcdFx0XHRyZWxhdGVkX3NlZ21lbnRfaWQ6IHJlbGF0ZWRfc2VnbWVudF9pZCxcblx0XHRcdFx0XHRcdHN0YXJ0X2Vwb2NoOiBzdGFydF9lcG9jaCxcblx0XHRcdFx0XHRcdGVuZF9lcG9jaDogZW5kX2Vwb2NoXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGludGVydmFscy5zb3J0KCBmdW5jdGlvbiAoIGxlZnRfaW50ZXJ2YWwsIHJpZ2h0X2ludGVydmFsICkge1xuXHRcdFx0XHRyZXR1cm4gbGVmdF9pbnRlcnZhbC5yZXNvdXJjZV9pZCAtIHJpZ2h0X2ludGVydmFsLnJlc291cmNlX2lkXG5cdFx0XHRcdFx0fHwgbGVmdF9pbnRlcnZhbC5zb3VyY2UubG9jYWxlQ29tcGFyZSggcmlnaHRfaW50ZXJ2YWwuc291cmNlIClcblx0XHRcdFx0XHR8fCBsZWZ0X2ludGVydmFsLnJlbGF0ZWRfc2VnbWVudF9pZC5sb2NhbGVDb21wYXJlKCByaWdodF9pbnRlcnZhbC5yZWxhdGVkX3NlZ21lbnRfaWQgKVxuXHRcdFx0XHRcdHx8IGxlZnRfaW50ZXJ2YWwuc3RhcnRfZXBvY2ggLSByaWdodF9pbnRlcnZhbC5zdGFydF9lcG9jaFxuXHRcdFx0XHRcdHx8IGxlZnRfaW50ZXJ2YWwuZW5kX2Vwb2NoIC0gcmlnaHRfaW50ZXJ2YWwuZW5kX2Vwb2NoO1xuXHRcdFx0fSApO1xuXHRcdFx0aW50ZXJ2YWxzLmZvckVhY2goIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdHZhciBwcmV2aW91c19pbnRlcnZhbCA9IG1lcmdlZC5sZW5ndGggPyBtZXJnZWRbIG1lcmdlZC5sZW5ndGggLSAxIF0gOiBudWxsO1xuXG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHRwcmV2aW91c19pbnRlcnZhbFxuXHRcdFx0XHRcdCYmIHByZXZpb3VzX2ludGVydmFsLnJlc291cmNlX2lkID09PSBpbnRlcnZhbC5yZXNvdXJjZV9pZFxuXHRcdFx0XHRcdCYmIHByZXZpb3VzX2ludGVydmFsLnNvdXJjZSA9PT0gaW50ZXJ2YWwuc291cmNlXG5cdFx0XHRcdFx0JiYgcHJldmlvdXNfaW50ZXJ2YWwucmVsYXRlZF9zZWdtZW50X2lkID09PSBpbnRlcnZhbC5yZWxhdGVkX3NlZ21lbnRfaWRcblx0XHRcdFx0XHQmJiBpbnRlcnZhbC5zdGFydF9lcG9jaCA8PSBwcmV2aW91c19pbnRlcnZhbC5lbmRfZXBvY2hcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0cHJldmlvdXNfaW50ZXJ2YWwuZW5kX2Vwb2NoID0gTWF0aC5tYXgoIHByZXZpb3VzX2ludGVydmFsLmVuZF9lcG9jaCwgaW50ZXJ2YWwuZW5kX2Vwb2NoICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1lcmdlZC5wdXNoKCBpbnRlcnZhbCApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gbWVyZ2VkO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciBjYWNoZWQgZXhhY3QgaW50ZXJ2YWxzIG9uIHRoZSBjdXJyZW50IGNvbXBvc2VkIHNlcnZlciBheGlzLlxuXHRcdCAqXG5cdFx0ICogTGF5ZXJzIGFyZSByZXNvbHZlZCBmcm9tIHRoZSBjdXJyZW50IGJvb2tpbmcgcm93cyBhZnRlciBlYWNoIHJvdyByZW5kZXIgYW5kXG5cdFx0ICogcmV1c2VkIHdoaWxlIHRob3NlIHJvd3MgcmVtYWluIG1vdW50ZWQuIEFic29sdXRlIGxvZ2ljYWwgZ2VvbWV0cnkgYW5kIHBvaW50ZXJcblx0XHQgKiB0cmFuc3BhcmVuY3kga2VlcCByb3cgaGVpZ2h0cywgaGl0Ym94ZXMsIGNvbnRyb2xzLCBhbmQgc2Nyb2xsaW5nIHVuY2hhbmdlZC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2NhY2hlZF9hdmFpbGFiaWxpdHkoKSB7XG5cdFx0XHR2YXIgYXhpcyA9IGdldF9heGlzKCkgfHwge307XG5cdFx0XHR2YXIgdHJhY2tzID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1zZWxlY3Rpb24tdHJhY2tdJyApIDogW107XG5cdFx0XHR2YXIgbGF5ZXJzX2J5X3Jlc291cmNlX2lkID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCB0cmFja3MsIGZ1bmN0aW9uICggdHJhY2sgKSB7XG5cdFx0XHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggdHJhY2suZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWlkJyApICk7XG5cdFx0XHRcdHZhciBsYXllciA9IGNyZWF0ZV9hdmFpbGFiaWxpdHlfbGF5ZXIoIHRyYWNrICk7XG5cblx0XHRcdFx0aWYgKCBsYXllciAmJiBOdW1iZXIuaXNJbnRlZ2VyKCByZXNvdXJjZV9pZCApICYmIDEgPD0gcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0bGF5ZXJzX2J5X3Jlc291cmNlX2lkWyByZXNvdXJjZV9pZCBdID0gbGF5ZXI7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0Z2V0X3JlbmRlcmFibGVfaW50ZXJ2YWxzKCBheGlzICkuZm9yRWFjaCggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0dmFyIGxheWVyID0gbGF5ZXJzX2J5X3Jlc291cmNlX2lkWyBpbnRlcnZhbC5yZXNvdXJjZV9pZCBdO1xuXHRcdFx0XHR2YXIgZ2VvbWV0cnkgPSBnZXRfZ2VvbWV0cnkoIGF4aXMsIGludGVydmFsLnN0YXJ0X2Vwb2NoLCBpbnRlcnZhbC5lbmRfZXBvY2ggKSB8fCB7fTtcblx0XHRcdFx0dmFyIG9mZnNldF9wZXJjZW50ID0gTnVtYmVyKCBnZW9tZXRyeS5vZmZzZXRfcGVyY2VudCApO1xuXHRcdFx0XHR2YXIgd2lkdGhfcGVyY2VudCA9IE51bWJlciggZ2VvbWV0cnkud2lkdGhfcGVyY2VudCApO1xuXHRcdFx0XHR2YXIgY2xhbXBlZF9vZmZzZXRfcGVyY2VudDtcblx0XHRcdFx0dmFyIGNsYW1wZWRfd2lkdGhfcGVyY2VudDtcblx0XHRcdFx0dmFyIGludGVydmFsX2VsZW1lbnQ7XG5cdFx0XHRcdHZhciByZWxhdGVkX2Jvb2tpbmdfZ2VvbWV0cnk7XG5cblx0XHRcdFx0aWYgKCAhIGxheWVyIHx8ICEgTnVtYmVyLmlzRmluaXRlKCBvZmZzZXRfcGVyY2VudCApIHx8ICEgTnVtYmVyLmlzRmluaXRlKCB3aWR0aF9wZXJjZW50ICkgfHwgMCA+PSB3aWR0aF9wZXJjZW50ICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjbGFtcGVkX29mZnNldF9wZXJjZW50ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCAxMDAsIG9mZnNldF9wZXJjZW50ICkgKTtcblx0XHRcdFx0Y2xhbXBlZF93aWR0aF9wZXJjZW50ID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCAxMDAgLSBjbGFtcGVkX29mZnNldF9wZXJjZW50LCB3aWR0aF9wZXJjZW50ICkgKTtcblx0XHRcdFx0aWYgKCAwID49IGNsYW1wZWRfd2lkdGhfcGVyY2VudCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpbnRlcnZhbF9lbGVtZW50ID0gbGF5ZXIub3duZXJEb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRcdFx0aW50ZXJ2YWxfZWxlbWVudC5jbGFzc05hbWUgPSAnd3BiY190aW1lbGluZV9fYXZhaWxhYmlsaXR5X2ludGVydmFsJztcblx0XHRcdFx0aW50ZXJ2YWxfZWxlbWVudC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtYXZhaWxhYmlsaXR5LXNvdXJjZScsIGludGVydmFsLnNvdXJjZSApO1xuXHRcdFx0XHRpbnRlcnZhbF9lbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWVsaW5lLWF2YWlsYWJpbGl0eS1pbmxpbmUtc3RhcnQnLCBjbGFtcGVkX29mZnNldF9wZXJjZW50ICsgJyUnICk7XG5cdFx0XHRcdGludGVydmFsX2VsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtYXZhaWxhYmlsaXR5LWlubGluZS1zaXplJywgY2xhbXBlZF93aWR0aF9wZXJjZW50ICsgJyUnICk7XG5cdFx0XHRcdGlmICggJ2Jvb2tpbmdfYnVmZmVyJyA9PT0gaW50ZXJ2YWwuc291cmNlIHx8ICdhcHBvaW50bWVudF9idWZmZXInID09PSBpbnRlcnZhbC5zb3VyY2UgKSB7XG5cdFx0XHRcdFx0cmVsYXRlZF9ib29raW5nX2dlb21ldHJ5ID0gZ2V0X3JlbGF0ZWRfYm9va2luZ19nZW9tZXRyeSggbGF5ZXIsIGludGVydmFsLnJlbGF0ZWRfc2VnbWVudF9pZCApO1xuXHRcdFx0XHRcdGlmICggcmVsYXRlZF9ib29raW5nX2dlb21ldHJ5ICkge1xuXHRcdFx0XHRcdFx0aW50ZXJ2YWxfZWxlbWVudC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtYnVmZmVyLWFsaWduZWQnLCAndHJ1ZScgKTtcblx0XHRcdFx0XHRcdGludGVydmFsX2VsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZWxpbmUtYXZhaWxhYmlsaXR5LWJsb2NrLXN0YXJ0JywgcmVsYXRlZF9ib29raW5nX2dlb21ldHJ5LmJsb2NrX3N0YXJ0ICk7XG5cdFx0XHRcdFx0XHRpbnRlcnZhbF9lbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWVsaW5lLWF2YWlsYWJpbGl0eS1ibG9jay1zaXplJywgcmVsYXRlZF9ib29raW5nX2dlb21ldHJ5LmJsb2NrX3NpemUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0bGF5ZXIuYXBwZW5kQ2hpbGQoIGludGVydmFsX2VsZW1lbnQgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3RpZnkgdGhlIHBhZ2UgY29vcmRpbmF0b3Igd2l0aG91dCBjb3VwbGluZyBmYWlsdXJlcyB0byBib29raW5nIHJlbmRlcmluZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzdGF0ZSAgICAgIExvYWRlZCBvciBuZXV0cmFsIHN0YXRlLlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjcmlwdG9yIEV4YWN0IGNhY2hlIGRlc2NyaXB0b3IuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gcGF5bG9hZCBBdXRob3JpemVkIEF2YWlsYWJpbGl0eSBEVE8gd2hlbiBsb2FkZWQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3RpZnlfY2hhbmdlKCBzdGF0ZSwgZGVzY3JpcHRvciwgcGF5bG9hZCApIHtcblx0XHRcdHJlbmRlcl9jYWNoZWRfYXZhaWxhYmlsaXR5KCk7XG5cdFx0XHRvbl9jaGFuZ2UoIHtcblx0XHRcdFx0c3RhdGU6IHN0YXRlLFxuXHRcdFx0XHRjYWNoZV9rZXk6IGRlc2NyaXB0b3IuY2FjaGVfa2V5LFxuXHRcdFx0XHR3aW5kb3dfa2V5OiBkZXNjcmlwdG9yLndpbmRvd19rZXksXG5cdFx0XHRcdHBheWxvYWQ6IHBheWxvYWQsXG5cdFx0XHRcdGNhY2hlZF93aW5kb3dzOiBnZXRfY2FjaGVkX3dpbmRvd3MoKVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcG9ydCBhZ2dyZWdhdGUgbGF6eS1yZWFkIHByb2dyZXNzIGZvciB0aGUgY3VycmVudGx5IGRlc2lyZWQgd2luZG93cy5cblx0XHQgKlxuXHRcdCAqIFRoaXMgbGlmZWN5Y2xlIGlzIGludGVudGlvbmFsbHkgc2VwYXJhdGUgZnJvbSBgb25fY2hhbmdlYCwgd2hvc2UgZXZlbnRzXG5cdFx0ICogcmVwcmVzZW50IGFjY2VwdGVkIEF2YWlsYWJpbGl0eSBkYXRhLiBQYWdlIGZlZWRiYWNrIG1heSBvYnNlcnZlIHByb2dyZXNzXG5cdFx0ICogd2l0aG91dCBtYWtpbmcgbG9hZGluZyBzdGF0ZSBsb29rIGxpa2UgYSBuZXcgYXV0aG9yaXplZCBwcm9qZWN0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlIE9wdGlvbmFsIGV4cGxpY2l0IGxpZmVjeWNsZSBzdGF0ZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vdGlmeV9zdGF0dXNfY2hhbmdlKCBzdGF0ZSApIHtcblx0XHRcdHZhciBkZXNpcmVkX2tleXM7XG5cdFx0XHR2YXIgcGVuZGluZ19jb3VudDtcblx0XHRcdHZhciBsb2FkZWRfY291bnQ7XG5cblx0XHRcdGlmICggc3RhdHVzX25vdGlmaWNhdGlvbnNfc3VzcGVuZGVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRkZXNpcmVkX2tleXMgPSBPYmplY3Qua2V5cyggZGVzaXJlZF9kZXNjcmlwdG9ycyApO1xuXHRcdFx0cGVuZGluZ19jb3VudCA9IGRlc2lyZWRfa2V5cy5maWx0ZXIoIGZ1bmN0aW9uICggYmFzZV9rZXkgKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKFxuXHRcdFx0XHRcdGFjdGl2ZV9yZXF1ZXN0c1sgYmFzZV9rZXkgXVxuXHRcdFx0XHRcdCYmIGFjdGl2ZV9yZXF1ZXN0c1sgYmFzZV9rZXkgXS5jYWNoZV9rZXkgPT09IGRlc2lyZWRfZGVzY3JpcHRvcnNbIGJhc2Vfa2V5IF0uY2FjaGVfa2V5XG5cdFx0XHRcdCk7XG5cdFx0XHR9ICkubGVuZ3RoO1xuXHRcdFx0bG9hZGVkX2NvdW50ID0gZGVzaXJlZF9rZXlzLmZpbHRlciggZnVuY3Rpb24gKCBiYXNlX2tleSApIHtcblx0XHRcdFx0dmFyIGNhY2hlZF9lbnRyeSA9IGNhY2hlX2VudHJpZXNbIGJhc2Vfa2V5IF07XG5cblx0XHRcdFx0cmV0dXJuIEJvb2xlYW4oXG5cdFx0XHRcdFx0Y2FjaGVkX2VudHJ5XG5cdFx0XHRcdFx0JiYgKCAhIGRlc2lyZWRfZGVzY3JpcHRvcnNbIGJhc2Vfa2V5IF0uYXZhaWxhYmlsaXR5X3JldmlzaW9uXG5cdFx0XHRcdFx0XHR8fCBjYWNoZWRfZW50cnkuYXZhaWxhYmlsaXR5X3JldmlzaW9uID09PSBkZXNpcmVkX2Rlc2NyaXB0b3JzWyBiYXNlX2tleSBdLmF2YWlsYWJpbGl0eV9yZXZpc2lvbiApXG5cdFx0XHRcdCk7XG5cdFx0XHR9ICkubGVuZ3RoO1xuXG5cdFx0XHRvbl9zdGF0dXNfY2hhbmdlKCB7XG5cdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiAxLFxuXHRcdFx0XHRzdGF0ZTogc3RhdGUgfHwgKCBwZW5kaW5nX2NvdW50ID8gJ2xvYWRpbmcnIDogJ3NldHRsZWQnICksXG5cdFx0XHRcdGRlc2lyZWRfY291bnQ6IGRlc2lyZWRfa2V5cy5sZW5ndGgsXG5cdFx0XHRcdHBlbmRpbmdfY291bnQ6IHBlbmRpbmdfY291bnQsXG5cdFx0XHRcdGxvYWRlZF9jb3VudDogbG9hZGVkX2NvdW50LFxuXHRcdFx0XHRmYWlsZWRfY291bnQ6IE1hdGgubWF4KCAwLCBkZXNpcmVkX2tleXMubGVuZ3RoIC0gcGVuZGluZ19jb3VudCAtIGxvYWRlZF9jb3VudCApLFxuXHRcdFx0XHRpc19zZXR0bGVkOiAwID09PSBwZW5kaW5nX2NvdW50XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FjaGUgb25lIGN1cnJlbnQgQXZhaWxhYmlsaXR5IHJlc3BvbnNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRlc2NyaXB0b3IgRXhhY3QgY2FjaGUgZGVzY3JpcHRvci5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcGF5bG9hZCAgICBBdXRob3JpemVkIEF2YWlsYWJpbGl0eSBEVE8uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYWNoZV9yZXNwb25zZSggZGVzY3JpcHRvciwgcGF5bG9hZCApIHtcblx0XHRcdHZhciByZXNwb25zZV9yZXZpc2lvbiA9IFN0cmluZyggcGF5bG9hZC5hdmFpbGFiaWxpdHlfcmV2aXNpb24gfHwgZGVzY3JpcHRvci5hdmFpbGFiaWxpdHlfcmV2aXNpb24gfHwgJycgKTtcblx0XHRcdHZhciBjYWNoZV9rZXkgPSBkZXNjcmlwdG9yLmJhc2Vfa2V5ICsgJ3wnICsgcmVzcG9uc2VfcmV2aXNpb247XG5cdFx0XHR2YXIgbm90aWZpY2F0aW9uX2Rlc2NyaXB0b3IgPSBPYmplY3QuYXNzaWduKCB7fSwgZGVzY3JpcHRvciwge1xuXHRcdFx0XHRjYWNoZV9rZXk6IGNhY2hlX2tleSxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3JldmlzaW9uOiByZXNwb25zZV9yZXZpc2lvblxuXHRcdFx0fSApO1xuXG5cdFx0XHRrbm93bl9yZXZpc2lvbnNbIGRlc2NyaXB0b3IuYmFzZV9rZXkgXSA9IHJlc3BvbnNlX3JldmlzaW9uO1xuXHRcdFx0Y2FjaGVfZW50cmllc1sgZGVzY3JpcHRvci5iYXNlX2tleSBdID0ge1xuXHRcdFx0XHRjYWNoZV9rZXk6IGNhY2hlX2tleSxcblx0XHRcdFx0d2luZG93X2tleTogZGVzY3JpcHRvci53aW5kb3dfa2V5LFxuXHRcdFx0XHRhdmFpbGFiaWxpdHlfcmV2aXNpb246IHJlc3BvbnNlX3JldmlzaW9uLFxuXHRcdFx0XHRwYXlsb2FkOiBwYXlsb2FkXG5cdFx0XHR9O1xuXHRcdFx0bm90aWZ5X2NoYW5nZSggJ2xvYWRlZCcsIG5vdGlmaWNhdGlvbl9kZXNjcmlwdG9yLCBwYXlsb2FkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RhcnQgb25lIG1pc3NpbmcgbGF6eSByZWFkIHdpdGhvdXQgYmxvY2tpbmcgYm9va2luZy13aW5kb3cgcmVuZGVyaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRlc2NyaXB0b3IgRXhhY3QgY2FjaGUgZGVzY3JpcHRvci5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlcXVlc3RfZGVzY3JpcHRvciggZGVzY3JpcHRvciApIHtcblx0XHRcdHZhciBnZW5lcmF0aW9uO1xuXHRcdFx0dmFyIHJlcXVlc3RfdmFsdWVzO1xuXHRcdFx0dmFyIHJlcXVlc3Q7XG5cdFx0XHR2YXIgY2FjaGVkX2VudHJ5ID0gY2FjaGVfZW50cmllc1sgZGVzY3JpcHRvci5iYXNlX2tleSBdO1xuXG5cdFx0XHRpZiAoIGNhY2hlZF9lbnRyeSAmJiAoICEgZGVzY3JpcHRvci5hdmFpbGFiaWxpdHlfcmV2aXNpb24gfHwgY2FjaGVkX2VudHJ5LmF2YWlsYWJpbGl0eV9yZXZpc2lvbiA9PT0gZGVzY3JpcHRvci5hdmFpbGFiaWxpdHlfcmV2aXNpb24gKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBjYWNoZWRfZW50cnkgKSB7XG5cdFx0XHRcdGRlbGV0ZSBjYWNoZV9lbnRyaWVzWyBkZXNjcmlwdG9yLmJhc2Vfa2V5IF07XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGFjdGl2ZV9yZXF1ZXN0c1sgZGVzY3JpcHRvci5iYXNlX2tleSBdICkge1xuXHRcdFx0XHRpZiAoIGFjdGl2ZV9yZXF1ZXN0c1sgZGVzY3JpcHRvci5iYXNlX2tleSBdLmNhY2hlX2tleSAhPT0gZGVzY3JpcHRvci5jYWNoZV9rZXkgKSB7XG5cdFx0XHRcdFx0YWJvcnRfcmVxdWVzdCggZGVzY3JpcHRvci5iYXNlX2tleSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXF1ZXN0X2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGdlbmVyYXRpb24gPSByZXF1ZXN0X2dlbmVyYXRpb247XG5cdFx0XHRyZXF1ZXN0X3ZhbHVlcyA9IE9iamVjdC5hc3NpZ24oIHt9LCBkZXNjcmlwdG9yLnJlcXVlc3RfdmFsdWVzLCB7XG5cdFx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbjogZ2VuZXJhdGlvblxuXHRcdFx0fSApO1xuXHRcdFx0cmVxdWVzdCA9IHNlbmRfcmVxdWVzdCggcmVxdWVzdF92YWx1ZXMsIGdldF9saW1pdHMoKS5yZXF1ZXN0X3RpbWVvdXRfbXMgKTtcblx0XHRcdGlmICggISByZXF1ZXN0IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiByZXF1ZXN0LmRvbmUgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHJlcXVlc3QuZmFpbCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgcmVxdWVzdC5hbHdheXMgKSB7XG5cdFx0XHRcdG5vdGlmeV9jaGFuZ2UoICduZXV0cmFsJywgZGVzY3JpcHRvciwgbnVsbCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGFjdGl2ZV9yZXF1ZXN0c1sgZGVzY3JpcHRvci5iYXNlX2tleSBdID0ge1xuXHRcdFx0XHRjYWNoZV9rZXk6IGRlc2NyaXB0b3IuY2FjaGVfa2V5LFxuXHRcdFx0XHRnZW5lcmF0aW9uOiBnZW5lcmF0aW9uLFxuXHRcdFx0XHRyZXF1ZXN0OiByZXF1ZXN0XG5cdFx0XHR9O1xuXHRcdFx0cmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgYWN0aXZlX3JlcXVlc3QgPSBhY3RpdmVfcmVxdWVzdHNbIGRlc2NyaXB0b3IuYmFzZV9rZXkgXTtcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0ISBhY3RpdmVfcmVxdWVzdFxuXHRcdFx0XHRcdHx8IGFjdGl2ZV9yZXF1ZXN0LmdlbmVyYXRpb24gIT09IGdlbmVyYXRpb25cblx0XHRcdFx0XHR8fCBhY3RpdmVfcmVxdWVzdC5jYWNoZV9rZXkgIT09IGRlc2NyaXB0b3IuY2FjaGVfa2V5XG5cdFx0XHRcdFx0fHwgISBkZXNpcmVkX2Rlc2NyaXB0b3JzWyBkZXNjcmlwdG9yLmJhc2Vfa2V5IF1cblx0XHRcdFx0XHR8fCBkZXNpcmVkX2Rlc2NyaXB0b3JzWyBkZXNjcmlwdG9yLmJhc2Vfa2V5IF0uY2FjaGVfa2V5ICE9PSBkZXNjcmlwdG9yLmNhY2hlX2tleVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgfHwgISByZXNwb25zZV9tYXRjaGVzX2Rlc2NyaXB0b3IoIGRlc2NyaXB0b3IsIHJlc3BvbnNlLmRhdGEsIGdlbmVyYXRpb24gKSApIHtcblx0XHRcdFx0XHRub3RpZnlfY2hhbmdlKCAnbmV1dHJhbCcsIGRlc2NyaXB0b3IsIG51bGwgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FjaGVfcmVzcG9uc2UoIGRlc2NyaXB0b3IsIHJlc3BvbnNlLmRhdGEgKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0dmFyIGFjdGl2ZV9yZXF1ZXN0ID0gYWN0aXZlX3JlcXVlc3RzWyBkZXNjcmlwdG9yLmJhc2Vfa2V5IF07XG5cblx0XHRcdFx0aWYgKCBhY3RpdmVfcmVxdWVzdCAmJiBhY3RpdmVfcmVxdWVzdC5nZW5lcmF0aW9uID09PSBnZW5lcmF0aW9uICYmIGRlc2lyZWRfZGVzY3JpcHRvcnNbIGRlc2NyaXB0b3IuYmFzZV9rZXkgXSAmJiAnYWJvcnQnICE9PSByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0XHRub3RpZnlfY2hhbmdlKCAnbmV1dHJhbCcsIGRlc2NyaXB0b3IsIG51bGwgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgYWN0aXZlX3JlcXVlc3QgPSBhY3RpdmVfcmVxdWVzdHNbIGRlc2NyaXB0b3IuYmFzZV9rZXkgXTtcblxuXHRcdFx0XHRpZiAoIGFjdGl2ZV9yZXF1ZXN0ICYmIGFjdGl2ZV9yZXF1ZXN0LmdlbmVyYXRpb24gPT09IGdlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIGFjdGl2ZV9yZXF1ZXN0c1sgZGVzY3JpcHRvci5iYXNlX2tleSBdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG5vdGlmeV9zdGF0dXNfY2hhbmdlKCk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWJvcnQgb25lIHN1cGVyc2VkZWQgcmVxdWVzdCBhbmQgaW52YWxpZGF0ZSBhbGwgb2YgaXRzIGxhdGUgY2FsbGJhY2tzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJhc2Vfa2V5IEV4YWN0IFJlc291cmNlL3dpbmRvdy9zY2FsZS90aW1lem9uZSBpZGVudGl0eS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFib3J0X3JlcXVlc3QoIGJhc2Vfa2V5ICkge1xuXHRcdFx0dmFyIGFjdGl2ZV9yZXF1ZXN0ID0gYWN0aXZlX3JlcXVlc3RzWyBiYXNlX2tleSBdO1xuXG5cdFx0XHRpZiAoICEgYWN0aXZlX3JlcXVlc3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGRlbGV0ZSBhY3RpdmVfcmVxdWVzdHNbIGJhc2Vfa2V5IF07XG5cdFx0XHRpZiAoIGFjdGl2ZV9yZXF1ZXN0LnJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGFjdGl2ZV9yZXF1ZXN0LnJlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdGFjdGl2ZV9yZXF1ZXN0LnJlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNaXJyb3IgdGhlIGFjY2VwdGVkIHByZXZpb3VzL2N1cnJlbnQvbmV4dCBib29raW5nLXdpbmRvdyBjYWNoZS5cblx0XHQgKlxuXHRcdCAqIEV4aXN0aW5nIGV4YWN0IG1hdGNoZXMgYXJlIHJldGFpbmVkLiBTdXBlcnNlZGVkIHJlcXVlc3RzIGFyZSBhYm9ydGVkLFxuXHRcdCAqIGV2aWN0ZWQgd2luZG93cyBhcmUgcmVtb3ZlZCwgYW5kIG1pc3NpbmcgQXZhaWxhYmlsaXR5IHJlYWRzIHN0YXJ0IHdpdGhvdXRcblx0XHQgKiByZXR1cm5pbmcgYSBwcm9taXNlIHRvIHRoZSBib29raW5nIHJlbmRlcmluZyBwYXRoLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSB3aW5kb3dfZW50cmllcyBBY2NlcHRlZCBib29raW5nLXdpbmRvdyBlbnRyaWVzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemUoIHdpbmRvd19lbnRyaWVzICkge1xuXHRcdFx0dmFyIG5leHRfZGVzY3JpcHRvcnMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR2YXIgbGltaXRzID0gZ2V0X2xpbWl0cygpO1xuXG5cdFx0XHQoIEFycmF5LmlzQXJyYXkoIHdpbmRvd19lbnRyaWVzICkgPyB3aW5kb3dfZW50cmllcyA6IFtdICkuc2xpY2UoIDAsIGxpbWl0cy5tYXhpbXVtX2NhY2hlZF93aW5kb3dzICkuZm9yRWFjaCggZnVuY3Rpb24gKCB3aW5kb3dfZW50cnkgKSB7XG5cdFx0XHRcdHZhciBkZXNjcmlwdG9yID0gYnVpbGRfZGVzY3JpcHRvciggd2luZG93X2VudHJ5ICk7XG5cblx0XHRcdFx0aWYgKCBkZXNjcmlwdG9yICkge1xuXHRcdFx0XHRcdG5leHRfZGVzY3JpcHRvcnNbIGRlc2NyaXB0b3IuYmFzZV9rZXkgXSA9IGRlc2NyaXB0b3I7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0c3RhdHVzX25vdGlmaWNhdGlvbnNfc3VzcGVuZGVkID0gdHJ1ZTtcblx0XHRcdGRlc2lyZWRfZGVzY3JpcHRvcnMgPSBuZXh0X2Rlc2NyaXB0b3JzO1xuXHRcdFx0T2JqZWN0LmtleXMoIGFjdGl2ZV9yZXF1ZXN0cyApLmZvckVhY2goIGZ1bmN0aW9uICggYmFzZV9rZXkgKSB7XG5cdFx0XHRcdGlmICggISBkZXNpcmVkX2Rlc2NyaXB0b3JzWyBiYXNlX2tleSBdIHx8IGFjdGl2ZV9yZXF1ZXN0c1sgYmFzZV9rZXkgXS5jYWNoZV9rZXkgIT09IGRlc2lyZWRfZGVzY3JpcHRvcnNbIGJhc2Vfa2V5IF0uY2FjaGVfa2V5ICkge1xuXHRcdFx0XHRcdGFib3J0X3JlcXVlc3QoIGJhc2Vfa2V5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdE9iamVjdC5rZXlzKCBjYWNoZV9lbnRyaWVzICkuZm9yRWFjaCggZnVuY3Rpb24gKCBiYXNlX2tleSApIHtcblx0XHRcdFx0aWYgKCAhIGRlc2lyZWRfZGVzY3JpcHRvcnNbIGJhc2Vfa2V5IF0gKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIGNhY2hlX2VudHJpZXNbIGJhc2Vfa2V5IF07XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdE9iamVjdC5rZXlzKCBkZXNpcmVkX2Rlc2NyaXB0b3JzICkuZm9yRWFjaCggZnVuY3Rpb24gKCBiYXNlX2tleSApIHtcblx0XHRcdFx0cmVxdWVzdF9kZXNjcmlwdG9yKCBkZXNpcmVkX2Rlc2NyaXB0b3JzWyBiYXNlX2tleSBdICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRzdGF0dXNfbm90aWZpY2F0aW9uc19zdXNwZW5kZWQgPSBmYWxzZTtcblx0XHRcdHJlbmRlcl9jYWNoZWRfYXZhaWxhYmlsaXR5KCk7XG5cdFx0XHRub3RpZnlfc3RhdHVzX2NoYW5nZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBsb2FkZWQgRFRPcyBmb3IgdGhlIGN1cnJlbnRseSBtaXJyb3JlZCBib3VuZGVkIHdpbmRvd3MuXG5cdFx0ICpcblx0XHQgKiBDYWNoZSBtaXNzZXMgYW5kIGZhaWx1cmVzIGFyZSBpbnRlbnRpb25hbGx5IG9taXR0ZWQuIENvbnN1bWVycyBtdXN0IHJlbmRlclxuXHRcdCAqIHRob3NlIHdpbmRvd3Mgd2l0aCBhIG5ldXRyYWwgYmFja2dyb3VuZCByYXRoZXIgdGhhbiBpbmZlciBhdmFpbGFiaWxpdHkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBMb2FkZWQgYm91bmRlZCBjYWNoZSBlbnRyaWVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9jYWNoZWRfd2luZG93cygpIHtcblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyggZGVzaXJlZF9kZXNjcmlwdG9ycyApLm1hcCggZnVuY3Rpb24gKCBiYXNlX2tleSApIHtcblx0XHRcdFx0cmV0dXJuIGNhY2hlX2VudHJpZXNbIGJhc2Vfa2V5IF0gfHwgbnVsbDtcblx0XHRcdH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggY2FjaGVfZW50cnkgKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKCBjYWNoZV9lbnRyeSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEludmFsaWRhdGUgZXZlcnkgY2FjaGVkIEF2YWlsYWJpbGl0eSBwcm9qZWN0aW9uIGFmdGVyIGEgY2Fub25pY2FsIG11dGF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQm9va2luZyBhbmQgbWFudWFsIEF2YWlsYWJpbGl0eSBtdXRhdGlvbnMgY2FuIGNoYW5nZSBpbnRlcnZhbHMgd2l0aG91dFxuXHRcdCAqIGNoYW5naW5nIHRoZSBSZXNvdXJjZS93aW5kb3cgY2FjaGUgaWRlbnRpdHkuIEFib3J0aW5nIG9sZGVyIHJlYWRzIGFuZFxuXHRcdCAqIGNsZWFyaW5nIGJvdGggcmVzcG9uc2UgYW5kIHJldmlzaW9uIG1lbW9yeSBwcmV2ZW50cyBzdGFsZSBpbnRlcnZhbHMgZnJvbVxuXHRcdCAqIGJlaW5nIHJldXNlZCB3aGVuIHRoZSByZWZyZXNoZWQgYm9va2luZyB3aW5kb3dzIHN5bmNocm9uaXplLiBEZXNpcmVkXG5cdFx0ICogZGVzY3JpcHRvcnMgcmVtYWluIGludGFjdCBzbyB0aGUgbmV4dCBub3JtYWwgc3luY2hyb25pemF0aW9uIHJlbG9hZHMgb25seVxuXHRcdCAqIHRoZSBhY2NlcHRlZCBwcmV2aW91cy9jdXJyZW50L25leHQgd2luZG93cy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW52YWxpZGF0ZSgpIHtcblx0XHRcdHN0YXR1c19ub3RpZmljYXRpb25zX3N1c3BlbmRlZCA9IHRydWU7XG5cdFx0XHRPYmplY3Qua2V5cyggYWN0aXZlX3JlcXVlc3RzICkuZm9yRWFjaCggYWJvcnRfcmVxdWVzdCApO1xuXHRcdFx0Y2FjaGVfZW50cmllcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdGtub3duX3JldmlzaW9ucyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdGNsZWFyX3JlbmRlcmVkX2xheWVycygpO1xuXHRcdFx0c3RhdHVzX25vdGlmaWNhdGlvbnNfc3VzcGVuZGVkID0gZmFsc2U7XG5cdFx0XHRvbl9jaGFuZ2UoIHtcblx0XHRcdFx0c3RhdGU6ICdpbnZhbGlkYXRlZCcsXG5cdFx0XHRcdGNhY2hlX2tleTogJycsXG5cdFx0XHRcdHdpbmRvd19rZXk6ICcnLFxuXHRcdFx0XHRwYXlsb2FkOiBudWxsLFxuXHRcdFx0XHRjYWNoZWRfd2luZG93czogW11cblx0XHRcdH0gKTtcblx0XHRcdG5vdGlmeV9zdGF0dXNfY2hhbmdlKCAnaW52YWxpZGF0ZWQnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW5pdGlhbGl6ZSB0aGlzIGluZGVwZW5kZW50IGNhY2hlIG93bmVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFib3J0IGFsbCByZWFkcyBhbmQgcmVtb3ZlIHBhZ2UtbGlmZXRpbWUgQXZhaWxhYmlsaXR5IGNhY2hlIGRhdGEuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0XHRpZiAoICEgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN0YXR1c19ub3RpZmljYXRpb25zX3N1c3BlbmRlZCA9IHRydWU7XG5cdFx0XHRPYmplY3Qua2V5cyggYWN0aXZlX3JlcXVlc3RzICkuZm9yRWFjaCggYWJvcnRfcmVxdWVzdCApO1xuXHRcdFx0Y2FjaGVfZW50cmllcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdGRlc2lyZWRfZGVzY3JpcHRvcnMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRrbm93bl9yZXZpc2lvbnMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRjbGVhcl9yZW5kZXJlZF9sYXllcnMoKTtcblx0XHRcdHN0YXR1c19ub3RpZmljYXRpb25zX3N1c3BlbmRlZCA9IGZhbHNlO1xuXHRcdFx0aXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdGRlc3Ryb3k6IGRlc3Ryb3ksXG5cdFx0XHRpbnZhbGlkYXRlOiBpbnZhbGlkYXRlLFxuXHRcdFx0c3luY2hyb25pemU6IHN5bmNocm9uaXplLFxuXHRcdFx0Z2V0X2NhY2hlZF93aW5kb3dzOiBnZXRfY2FjaGVkX3dpbmRvd3Ncblx0XHR9O1xuXHR9XG5cblx0aWYgKFxuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXNcblx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5XG5cdCkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSggbW9kdWxlX2lkLCBjcmVhdGVfYXZhaWxhYmlsaXR5X2NhY2hlX2NvbnRyb2xsZXIgKTtcblx0fVxufSggd2luZG93ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFHO0VBQ3JCLFlBQVk7O0VBRVosSUFBSUMsU0FBUyxHQUFHLG9CQUFvQjs7RUFFcEM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxvQ0FBb0NBLENBQUVDLE9BQU8sRUFBRztJQUN4RCxJQUFJQyxLQUFLLEdBQUdELE9BQU8sQ0FBQ0MsS0FBSyxJQUFJLElBQUk7SUFDakMsSUFBSUMsUUFBUSxHQUFHRixPQUFPLENBQUNFLFFBQVEsSUFBSSxDQUFDLENBQUM7SUFDckMsSUFBSUMsUUFBUSxHQUFHLFVBQVUsS0FBSyxPQUFPSCxPQUFPLENBQUNHLFFBQVEsR0FBR0gsT0FBTyxDQUFDRyxRQUFRLEdBQUcsWUFBWTtNQUN0RixPQUFPRCxRQUFRLENBQUNFLElBQUksSUFBSSxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUNELElBQUlDLFlBQVksR0FBRyxVQUFVLEtBQUssT0FBT0wsT0FBTyxDQUFDSyxZQUFZLEdBQUdMLE9BQU8sQ0FBQ0ssWUFBWSxHQUFHLFlBQVk7TUFDbEcsT0FBTyxDQUFDLENBQUM7SUFDVixDQUFDO0lBQ0QsSUFBSUMsU0FBUyxHQUFHLFVBQVUsS0FBSyxPQUFPTixPQUFPLENBQUNNLFNBQVMsR0FBR04sT0FB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QXFCLENBQUMsQ0FBQztNQUN2QjFGLDhCQUE4QixHQUFHLEtBQUs7TUFDdENYLFNBQVMsQ0FBRTtRQUNWcUosS0FBSyxFQUFFLGFBQWE7UUFDcEI3RSxTQUFTLEVBQUUsRUFBRTtRQUNiQyxVQUFVLEVBQUUsRUFBRTtRQUNkMUIsT0FBTyxFQUFFLElBQUk7UUFDYjBILGNBQWMsRUFBRTtNQUNqQixDQUFFLENBQUM7TUFDSEMsb0JBQW9CLENBQUUsYUFBYyxDQUFDO0lBQ3RDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTOEIsVUFBVUEsQ0FBQSxFQUFHO01BQ3JCNUwsY0FBYyxHQUFHLElBQUk7SUFDdEI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVM2TCxPQUFPQSxDQUFBLEVBQUc7TUFDbEIsSUFBSyxDQUFFN0wsY0FBYyxFQUFHO1FBQ3ZCO01BQ0Q7TUFDQUQsOEJBQThCLEdBQUcsSUFBSTtNQUNyQ04sTUFBTSxDQUFDeUssSUFBSSxDQUFFdkssZUFBZ0IsQ0FBQyxDQUFDa0csT0FBTyxDQUFFaUYsYUFBYyxDQUFDO01BQ3ZEdEwsYUFBYSxHQUFHQyxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDckNFLG1CQUFtQixHQUFHSCxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDM0NHLGVBQWUsR0FBR0osTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO01BQ3ZDK0YscUJBQXFCLENBQUMsQ0FBQztNQUN2QjFGLDhCQUE4QixHQUFHLEtBQUs7TUFDdENDLGNBQWMsR0FBRyxLQUFLO0lBQ3ZCO0lBRUEsT0FBTztNQUNONEwsVUFBVSxFQUFFQSxVQUFVO01BQ3RCQyxPQUFPLEVBQUVBLE9BQU87TUFDaEJGLFVBQVUsRUFBRUEsVUFBVTtNQUN0QkgsV0FBVyxFQUFFQSxXQUFXO01BQ3hCdkQsa0JBQWtCLEVBQUVBO0lBQ3JCLENBQUM7RUFDRjtFQUVBLElBQ0N0SixNQUFNLENBQUNtTixxQkFBcUIsSUFDekIsVUFBVSxLQUFLLE9BQU9uTixNQUFNLENBQUNtTixxQkFBcUIsQ0FBQ0MsZ0JBQWdCLEVBQ3JFO0lBQ0RwTixNQUFNLENBQUNtTixxQkFBcUIsQ0FBQ0MsZ0JBQWdCLENBQUVuTixTQUFTLEVBQUVDLG9DQUFxQyxDQUFDO0VBQ2pHO0FBQ0QsQ0FBQyxFQUFFRixNQUFPLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
