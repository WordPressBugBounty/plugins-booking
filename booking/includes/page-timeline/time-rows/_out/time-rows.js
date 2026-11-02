"use strict";

/**
 * Timeline time-rows accepted-data adapter.
 *
 * The adapter subscribes only to native accepted-data notifications and the
	 * neutral Resource-presentation lifecycle. Expansion owns no read endpoint
	 * or data transport. Explicit range and density changes use one isolated,
	 * authenticated preference save after useful local content is already shown.
	 * Phases 6 and 7 render the pure projection synchronously into allow-listed
	 * WordPress templates.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, wp) {
  'use strict';

  var module_id = 'time_rows';

  /**
   * Create one isolated accepted-data adapter.
   *
   * @param {Object} context Module lifecycle context.
   * @param {Element} context.mount Timeline mount element.
   * @param {Object} context.configuration Executable-free module configuration.
   * @param {Object} context.presentation_api Neutral presentation-only capabilities.
   * @return {Object} Symmetric adapter lifecycle and development inspection API.
   */
  function create_time_rows_controller(context) {
    var mount = context.mount || null;
    var configuration = context.configuration || {};
    var presentation_api = context.presentation_api || {};
    var maximum_cached_windows = Math.max(1, Math.min(3, Number(configuration.limits && configuration.limits.maximum_cached_windows) || 3));
    var presentation_id = String(configuration.presentation_id || '');
    var accepted_booking_windows = [];
    var accepted_availability_windows = [];
    var booking_identities_by_key = Object.create(null);
    var open_resource_ids = Object.create(null);
    var range_policies_by_resource = Object.create(null);
    var zoom_percentages_by_resource = Object.create(null);
    var preference_loaded_by_resource = Object.create(null);
    var preference_reset_pending_by_resource = Object.create(null);
    var preference_save_states_by_resource = Object.create(null);
    var resource_window_indexes = Object.create(null);
    var projection_cache = Object.create(null);
    var projected_resources = Object.create(null);
    var booking_generation = 0;
    var availability_generation = 0;
    var booking_projection_revision = 0;
    var availability_projection_revision = 0;
    var availability_state = 'loading';
    var booking_identity_signature = '';
    var availability_identity_signature = '';
    var authoritative_readback_generation = 0;
    var is_authoritative_readback_pending = false;
    var last_booking_transition = null;
    var last_availability_transition = null;
    var is_initialized = false;
    var initial_open_completed = false;
    var auto_open_animation_timer = 0;

    /**
     * Remove the one-shot initial reveal marker from synchronized hosts.
     *
     * @param {number} resource_id Opened authorized Resource ID.
     * @return {void}
     */
    function clear_initial_open_animation(resource_id) {
      get_current_hosts(resource_id).forEach(function (host) {
        host.classList.remove('is-initial-auto-open');
      });
      if (auto_open_animation_timer) {
        window.clearTimeout(auto_open_animation_timer);
        auto_open_animation_timer = 0;
      }
    }

    /**
     * Open and animate the first authorized Resource after initial canvas paint.
     *
     * This handler runs once per Timeline page lifecycle. It delegates only the
     * neutral open mechanic, consumes already accepted DTOs synchronously, moves
     * no focus, and performs no transport.
     *
     * @param {CustomEvent} event Initial native-canvas-ready notification.
     * @return {void}
     */
    function handle_initial_canvas_ready(event) {
      var initial_open = configuration.initial_open || {};
      var resource_id;
      var hosts;
      if (initial_open_completed || 1 !== Number(event && event.detail && event.detail.schema_version)) {
        return;
      }
      initial_open_completed = true;
      if (true !== initial_open.first_resource || 'function' !== typeof presentation_api.open_first) {
        return;
      }
      resource_id = Number(presentation_api.open_first(presentation_id));
      if (!Number.isInteger(resource_id) || 1 > resource_id || true !== initial_open.animate) {
        return;
      }
      hosts = get_current_hosts(resource_id);
      hosts.forEach(function (host) {
        host.classList.add('is-initial-auto-open');
      });
      auto_open_animation_timer = window.setTimeout(function () {
        clear_initial_open_animation(resource_id);
      }, 420);
    }

    /**
     * Return sorted unique positive Resource IDs.
     *
     * @param {Array<Object|number>} resources Resource DTOs or IDs.
     * @return {Array<number>} Stable Resource IDs.
     */
    function normalize_resource_ids(resources) {
      var seen_ids = Object.create(null);
      return (Array.isArray(resources) ? resources : []).map(function (resource) {
        return Number(resource && 'object' === typeof resource ? resource.id : resource);
      }).filter(function (resource_id) {
        if (!Number.isInteger(resource_id) || 1 > resource_id || seen_ids[resource_id]) {
          return false;
        }
        seen_ids[resource_id] = true;
        return true;
      }).sort(function (left_id, right_id) {
        return left_id - right_id;
      });
    }

    /**
     * Return the configured wall-minute range increment.
     *
     * @return {number} Positive minute step bounded to one hour.
     */
    function get_time_range_step_minutes() {
      return Math.max(15, Math.min(60, Number(configuration.limits && configuration.limits.time_range_step_minutes) || 60));
    }

    /**
     * Normalize one wall-minute value to the configured local control step.
     *
     * @param {*} candidate Candidate wall minute.
     * @param {number} fallback Value used when the candidate is not finite.
     * @return {number} Bounded and stepped minute from local midnight.
     */
    function normalize_wall_minute(candidate, fallback) {
      var step_minutes = get_time_range_step_minutes();
      candidate = Number(candidate);
      if (!Number.isFinite(candidate)) {
        candidate = fallback;
      }
      return Math.max(0, Math.min(1440, Math.round(candidate / step_minutes) * step_minutes));
    }

    /**
     * Normalize one executable-free local visible-time policy.
     *
     * @param {Object} range_policy Auto, Full day, or explicit custom policy.
     * @return {Object} Bounded policy accepted by the pure projector.
     */
    function normalize_range_policy(range_policy) {
      var mode = String(range_policy && range_policy.mode || 'auto');
      var step_minutes = get_time_range_step_minutes();
      var start_minute;
      var end_minute;
      if ('full_day' === mode) {
        return {
          mode: 'full_day'
        };
      }
      if ('custom' !== mode) {
        return {
          mode: 'auto'
        };
      }
      start_minute = normalize_wall_minute(range_policy.start_minute, 0);
      end_minute = normalize_wall_minute(range_policy.end_minute, 1440);
      start_minute = Math.min(1440 - step_minutes, start_minute);
      end_minute = Math.max(start_minute + step_minutes, end_minute);
      return {
        mode: 'custom',
        start_minute: start_minute,
        end_minute: Math.min(1440, end_minute)
      };
    }

    /**
     * Return valid server-defined visible-time preset DTOs.
     *
     * @return {Array<Object>} Ordered executable-free preset records.
     */
    function get_time_range_presets() {
      var seen_ids = Object.create(null);
      return (Array.isArray(configuration.range_presets) ? configuration.range_presets : []).map(function (preset) {
        var preset_id = String(preset && preset.id || '');
        var range_policy;
        if (!/^[a-z0-9_-]+$/.test(preset_id) || seen_ids[preset_id]) {
          return null;
        }
        range_policy = normalize_range_policy({
          mode: 'custom',
          start_minute: preset.start_minute,
          end_minute: preset.end_minute
        });
        if ('custom' !== range_policy.mode) {
          return null;
        }
        seen_ids[preset_id] = true;
        return {
          id: preset_id,
          start_minute: range_policy.start_minute,
          end_minute: range_policy.end_minute,
          label: String(preset.label || ''),
          aria_label: String(preset.aria_label || preset.label || '')
        };
      }).filter(Boolean);
    }

    /**
     * Find the preset matching an explicit custom visible-time policy.
     *
     * @param {Object} range_policy Candidate normalized or raw policy.
     * @return {Object|null} Matching preset or null.
     */
    function get_matching_range_preset(range_policy) {
      var normalized_policy = normalize_range_policy(range_policy);
      if ('custom' !== normalized_policy.mode) {
        return null;
      }
      return get_time_range_presets().find(function (preset) {
        return preset.start_minute === normalized_policy.start_minute && preset.end_minute === normalized_policy.end_minute;
      }) || null;
    }

    /**
     * Return one Resource's current local visible-time policy.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {Object} Normalized projector policy.
     */
    function get_resource_range_policy(resource_id) {
      return normalize_range_policy(range_policies_by_resource[Number(resource_id)] || {
        mode: 'auto'
      });
    }

    /**
     * Return the configured vertical zoom bounds.
     *
     * @return {Object} Minimum, maximum, step, default, and height values.
     */
    function get_zoom_configuration() {
      var limits = configuration.limits || {};
      var minimum = Math.max(25, Number(limits.time_zoom_min_percent) || 30);
      var maximum = Math.max(minimum, Number(limits.time_zoom_max_percent) || 300);
      var step = Math.max(5, Number(limits.time_zoom_step_percent) || 10);
      return {
        min_percent: minimum,
        max_percent: maximum,
        step_percent: step,
        default_percent: Math.max(minimum, Math.min(maximum, Number(limits.time_zoom_default_percent) || 100)),
        hour_height_px: Math.max(24, Number(limits.time_hour_height_px) || 52),
        minimum_body_height_px: Math.max(160, Number(limits.time_body_min_height_px) || 260)
      };
    }

    /**
     * Normalize a Resource-local vertical zoom percentage.
     *
     * @param {*} candidate Candidate percentage.
     * @return {number} Bounded percentage aligned to the configured step.
     */
    function normalize_zoom_percent(candidate) {
      var zoom = get_zoom_configuration();
      var normalized = Number(candidate);
      if (!Number.isFinite(normalized)) {
        normalized = zoom.default_percent;
      }
      normalized = zoom.min_percent + Math.round((normalized - zoom.min_percent) / zoom.step_percent) * zoom.step_percent;
      return Math.max(zoom.min_percent, Math.min(zoom.max_percent, normalized));
    }

    /**
     * Return one Resource's current local vertical zoom percentage.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {number} Normalized zoom percentage.
     */
    function get_resource_zoom_percent(resource_id) {
      return normalize_zoom_percent(zoom_percentages_by_resource[Number(resource_id)]);
    }

    /**
     * Return the accepted presentation settings embedded in one Resource DTO.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {Object|null} Accepted settings or null when unavailable.
     */
    function get_accepted_resource_preferences(resource_id) {
      var resource = get_source_resource(resource_id);
      var preferences = resource.row_presentation_preferences;
      if (!preferences || 'object' !== typeof preferences || !preferences[presentation_id]) {
        return null;
      }
      return preferences[presentation_id];
    }

    /**
     * Initialize one Resource from its already-accepted authoritative DTO.
     *
     * A reset ignores stale cached persisted values until the first post-reset
     * DTO explicitly reports defaults. Normal native rerenders retain the local
     * value so an in-flight or recently completed save cannot be overwritten by
     * an older adjacent-window snapshot.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {boolean} True when accepted settings initialized the Resource.
     */
    function synchronize_resource_preferences(resource_id) {
      var preferences = get_accepted_resource_preferences(resource_id);
      resource_id = Number(resource_id);
      if (!preferences || 1 !== Number(preferences.schema_version)) {
        return false;
      }
      if (preference_reset_pending_by_resource[resource_id] && true === preferences.is_persisted) {
        return false;
      }
      if (preference_loaded_by_resource[resource_id] && !preference_reset_pending_by_resource[resource_id]) {
        return true;
      }
      range_policies_by_resource[resource_id] = normalize_range_policy(preferences.range_policy || {
        mode: 'auto'
      });
      zoom_percentages_by_resource[resource_id] = normalize_zoom_percent(preferences.zoom_percent);
      preference_loaded_by_resource[resource_id] = true;
      delete preference_reset_pending_by_resource[resource_id];
      return true;
    }

    /**
     * Initialize every Resource in the accepted bounded booking cache.
     *
     * @return {void}
     */
    function synchronize_accepted_resource_preferences() {
      var resource_ids = [];
      accepted_booking_windows.forEach(function (window_entry) {
        var resources = window_entry && window_entry.payload && Array.isArray(window_entry.payload.resources) ? window_entry.payload.resources : [];
        resource_ids = resource_ids.concat(normalize_resource_ids(resources));
      });
      normalize_resource_ids(resource_ids).forEach(synchronize_resource_preferences);
    }

    /**
     * Announce a preference persistence result inside the domain-owned panel.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @param {string} message Localized status message, or empty to clear.
     * @return {void}
     */
    function announce_preference_status(resource_id, message) {
      get_current_hosts(resource_id).forEach(function (host) {
        var status = host && host.querySelector ? host.querySelector('[data-wpbc-timeline-time-rows-preference-status]') : null;
        if (status) {
          status.textContent = String(message || '');
        }
      });
    }

    /**
     * Return a Resource's mutable serialized save state.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {Object} Timer, request, and pending flags.
     */
    function get_preference_save_state(resource_id) {
      resource_id = Number(resource_id);
      if (!preference_save_states_by_resource[resource_id]) {
        preference_save_states_by_resource[resource_id] = {
          timer: null,
          request: null,
          pending: false
        };
      }
      return preference_save_states_by_resource[resource_id];
    }

    /**
     * Build the fixed scalar save payload for one Resource.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {Object} Executable-free preference values.
     */
    function build_preference_save_payload(resource_id) {
      var range_policy = get_resource_range_policy(resource_id);
      return {
        resource_id: Number(resource_id),
        range_mode: range_policy.mode,
        start_minute: 'custom' === range_policy.mode ? range_policy.start_minute : 0,
        end_minute: 'custom' === range_policy.mode ? range_policy.end_minute : 1440,
        zoom_percent: get_resource_zoom_percent(resource_id)
      };
    }

    /**
     * Flush one serialized preference save after an explicit control change.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {void}
     */
    function flush_preference_save(resource_id) {
      var transport = configuration.preferences || {};
      var state = get_preference_save_state(resource_id);
      var payload;
      resource_id = Number(resource_id);
      state.timer = null;
      if (state.request || !state.pending) {
        return;
      }
      if (!window.jQuery || !transport.url || !transport.action || !transport.nonce) {
        state.pending = false;
        announce_preference_status(resource_id, configuration.i18n && configuration.i18n.preferences_save_failed);
        return;
      }
      state.pending = false;
      payload = Object.assign({
        action: transport.action,
        nonce: transport.nonce
      }, build_preference_save_payload(resource_id));
      announce_preference_status(resource_id, '');
      state.request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: payload
      }).done(function (response) {
        var preferences = response && response.success && response.data ? response.data.preferences : null;
        if (state.pending || !preferences || Number(response.data.resource_id) !== resource_id) {
          return;
        }
        range_policies_by_resource[resource_id] = normalize_range_policy(preferences.range_policy || {
          mode: 'auto'
        });
        zoom_percentages_by_resource[resource_id] = normalize_zoom_percent(preferences.zoom_percent);
        preference_loaded_by_resource[resource_id] = true;
      }).fail(function () {
        announce_preference_status(resource_id, configuration.i18n && configuration.i18n.preferences_save_failed);
      }).always(function () {
        state.request = null;
        if (state.pending && is_initialized) {
          flush_preference_save(resource_id);
        }
      });
    }

    /**
     * Debounce one Resource-local preference save.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {void}
     */
    function queue_preference_save(resource_id) {
      var state = get_preference_save_state(resource_id);
      state.pending = true;
      if (state.request || state.timer) {
        return;
      }
      state.timer = window.setTimeout(function () {
        flush_preference_save(resource_id);
      }, 250);
    }

    /**
     * Cancel unsent state after a Resource is no longer authorized/present.
     *
     * @param {number} resource_id Removed Resource ID.
     * @return {void}
     */
    function remove_preference_save_state(resource_id) {
      var state = preference_save_states_by_resource[Number(resource_id)];
      if (state && state.timer) {
        window.clearTimeout(state.timer);
      }
      if (state && state.request && 'function' === typeof state.request.abort) {
        state.request.abort();
      }
      delete preference_save_states_by_resource[Number(resource_id)];
    }

    /**
     * Build an exact identity for one accepted native booking window.
     *
     * @param {Object} window_entry Native `{ key, payload }` cache entry.
     * @return {Object|null} Exact identity or null when incomplete.
     */
    function build_booking_identity(window_entry) {
      var payload = window_entry && window_entry.payload ? window_entry.payload : {};
      var timeline_window = payload.window || {};
      var axis = payload.axis || {};
      var window_context = payload.window_context || {};
      var resource_ids = normalize_resource_ids(payload.resources);
      var window_key = String(window_entry && window_entry.key || window_context.window_key || '');
      if (!window_key || !resource_ids.length || !window_context.resource_fingerprint || !timeline_window.start_at || !timeline_window.end_at || !timeline_window.view || !timeline_window.timezone) {
        return null;
      }
      return {
        window_key: window_key,
        resource_fingerprint: String(window_context.resource_fingerprint),
        resource_ids: resource_ids,
        start_at: String(timeline_window.start_at),
        end_at: String(timeline_window.end_at),
        view: String(timeline_window.view),
        cell_minutes: Number(timeline_window.cell_minutes || axis.cell_minutes || 0),
        timezone: String(timeline_window.timezone)
      };
    }

    /**
     * Return the stable scalar signature for one booking identity.
     *
     * @param {Object} identity Exact booking-window identity.
     * @return {string} Stable identity signature.
     */
    function get_booking_identity_signature(identity) {
      return [identity.window_key, identity.resource_fingerprint, identity.resource_ids.join(','), identity.start_at, identity.end_at, identity.view, identity.cell_minutes, identity.timezone].join('|');
    }

    /**
     * Clear every index and projected result after authoritative identity drift.
     *
     * @return {void}
     */
    function invalidate_local_caches() {
      resource_window_indexes = Object.create(null);
      projection_cache = Object.create(null);
      projected_resources = Object.create(null);
    }

    /**
     * Return accepted entries keyed by their native window identity.
     *
     * @param {Array<Object>} entries Accepted booking or Availability entries.
     * @return {Object<string,Object>} Entry references keyed by window key.
     */
    function index_entries_by_window_key(entries) {
      var indexed_entries = Object.create(null);
      (Array.isArray(entries) ? entries : []).forEach(function (entry) {
        var window_key = String(entry && (entry.key || entry.window_key) || '');
        if (window_key) {
          indexed_entries[window_key] = entry;
        }
      });
      return indexed_entries;
    }

    /**
     * Evict local state owned by one native bounded window.
     *
     * @param {string} window_key Native booking-window key.
     * @return {void}
     */
    function evict_window_local_state(window_key) {
      var cache_key_prefix = String(window_key || '') + '|';
      Object.keys(resource_window_indexes).forEach(function (cache_key) {
        if (0 === cache_key.indexOf(cache_key_prefix)) {
          delete resource_window_indexes[cache_key];
        }
      });
      delete projection_cache[String(window_key || '')];
    }

    /**
     * Invalidate composed projections while retaining reusable window indexes.
     *
     * @return {void}
     */
    function invalidate_composed_projections() {
      projected_resources = Object.create(null);
    }

    /**
     * Close local state for Resources absent from the authoritative replacement.
     *
     * Shared rendering removes the corresponding hosts. This adapter performs the
     * same authorization reconciliation immediately so a detached lifecycle event
     * cannot leave an open projection in memory.
     *
     * @param {Object<string,Object>} next_identities Accepted booking identities.
     * @return {Array<number>} Resource IDs removed from local open state.
     */
    function reconcile_authorized_open_resources(next_identities) {
      var identity_keys = Object.keys(next_identities);
      var authorized_resource_ids = identity_keys.length ? next_identities[identity_keys[0]].resource_ids : [];
      var removed_resource_ids = [];
      Object.keys(open_resource_ids).forEach(function (resource_id) {
        resource_id = Number(resource_id);
        if (-1 !== authorized_resource_ids.indexOf(resource_id)) {
          return;
        }
        delete open_resource_ids[resource_id];
        remove_resource_local_state(resource_id);
        removed_resource_ids.push(resource_id);
      });
      return removed_resource_ids;
    }

    /**
     * Accept one authoritative bounded booking-cache notification.
     *
     * The adapter retains the supplied window array and payload references. It
     * does not clone complete responses or normalize booking/axis DTO contents.
     *
     * @param {Object} detail Accepted booking-window event detail.
     * @return {boolean} True when the exact identity was accepted.
     */
    function accept_booking_windows(detail) {
      var windows = detail && Array.isArray(detail.windows) ? detail.windows : [];
      var generation = Number(detail && detail.generation);
      var next_identities = Object.create(null);
      var previous_entries_by_key = index_entries_by_window_key(accepted_booking_windows);
      var next_entries_by_key;
      var signatures = [];
      var next_signature;
      var changed_window_keys = [];
      var removed_window_keys = [];
      var retained_availability_windows;
      var removed_resource_ids;
      var current_window_found = false;
      var valid = 1 === Number(detail && detail.schema_version) && Number.isInteger(generation) && generation > booking_generation && 0 < windows.length && windows.length <= maximum_cached_windows;
      windows.forEach(function (window_entry) {
        var identity = build_booking_identity(window_entry);
        if (!identity || identity.resource_fingerprint !== String(detail.resource_fingerprint || '') || identity.timezone !== String(detail.timezone || '') || next_identities[identity.window_key]) {
          valid = false;
          return;
        }
        next_identities[identity.window_key] = identity;
        signatures.push(get_booking_identity_signature(identity));
        if (identity.window_key === String(detail.current_window_key || '')) {
          current_window_found = true;
        }
      });
      if (!valid || !current_window_found) {
        return false;
      }
      signatures.sort();
      next_signature = signatures.join('||');
      next_entries_by_key = index_entries_by_window_key(windows);
      Object.keys(next_entries_by_key).forEach(function (window_key) {
        if (!previous_entries_by_key[window_key] || previous_entries_by_key[window_key].payload !== next_entries_by_key[window_key].payload || !booking_identities_by_key[window_key] || get_booking_identity_signature(booking_identities_by_key[window_key]) !== get_booking_identity_signature(next_identities[window_key])) {
          changed_window_keys.push(window_key);
        }
      });
      Object.keys(previous_entries_by_key).forEach(function (window_key) {
        if (!next_entries_by_key[window_key]) {
          removed_window_keys.push(window_key);
        }
      });
      changed_window_keys.concat(removed_window_keys).forEach(evict_window_local_state);
      if (changed_window_keys.length || removed_window_keys.length || booking_identity_signature !== next_signature) {
        booking_projection_revision += 1;
        invalidate_composed_projections();
      }
      retained_availability_windows = accepted_availability_windows.filter(function (availability_entry) {
        var window_key = String(availability_entry && availability_entry.window_key || '');
        var previous_identity = booking_identities_by_key[window_key];
        var next_identity = next_identities[window_key];
        return Boolean(next_entries_by_key[window_key] && previous_identity && next_identity && get_booking_identity_signature(previous_identity) === get_booking_identity_signature(next_identity));
      });
      if (retained_availability_windows.length !== accepted_availability_windows.length) {
        accepted_availability_windows = retained_availability_windows;
        availability_identity_signature = retained_availability_windows.map(function (availability_entry) {
          return String(availability_entry.cache_key || '');
        }).sort().join('||');
        availability_projection_revision += 1;
        availability_state = 'loading';
      }
      accepted_booking_windows = windows;
      booking_identities_by_key = next_identities;
      booking_identity_signature = next_signature;
      booking_generation = generation;
      removed_resource_ids = reconcile_authorized_open_resources(next_identities);
      last_booking_transition = {
        changed_window_keys: changed_window_keys.slice(),
        removed_window_keys: removed_window_keys.slice(),
        removed_resource_ids: removed_resource_ids,
        has_projection_change: Boolean(changed_window_keys.length || removed_window_keys.length)
      };
      synchronize_accepted_resource_preferences();
      return true;
    }

    /**
     * Verify one accepted Availability cache entry against its booking window.
     *
     * @param {Object} availability_entry Native Availability cache entry.
     * @return {boolean} True when Resource/window/timezone identity matches.
     */
    function availability_entry_matches_booking(availability_entry) {
      var identity = booking_identities_by_key[String(availability_entry && availability_entry.window_key || '')];
      var payload = availability_entry && availability_entry.payload ? availability_entry.payload : {};
      var response_window = payload.window || {};
      var resource_ids = normalize_resource_ids(payload.resource_ids);
      return Boolean(identity && identity.resource_ids.join(',') === resource_ids.join(',') && identity.start_at === String(response_window.start_at || '') && identity.end_at === String(response_window.end_at || '') && identity.view === String(response_window.view || '') && identity.cell_minutes === Number(response_window.cell_minutes || 0) && identity.timezone === String(response_window.timezone || ''));
    }

    /**
     * Accept Availability DTO references matching the current booking identities.
     *
     * @param {Object} detail Accepted Availability event detail.
     * @return {boolean} True when the notification was current and valid.
     */
    function accept_availability(detail) {
      var generation = Number(detail && detail.generation);
      var cached_windows = detail && Array.isArray(detail.cached_windows) ? detail.cached_windows : [];
      var previous_entries_by_key = index_entries_by_window_key(accepted_availability_windows);
      var next_entries_by_key;
      var accepted_windows = [];
      var signatures = [];
      var changed_window_keys = [];
      var next_availability_state;
      var next_signature;
      var has_projection_change;
      var affected_resource_ids = Object.create(null);
      var identities_match = true;
      if (1 !== Number(detail && detail.schema_version) || !Number.isInteger(generation) || generation <= availability_generation || cached_windows.length > maximum_cached_windows) {
        return false;
      }
      if ('loaded' === detail.state && detail.payload) {
        if (!availability_entry_matches_booking({
          window_key: detail.window_key,
          payload: detail.payload
        })) {
          return false;
        }
      }
      cached_windows.forEach(function (availability_entry) {
        if (!availability_entry_matches_booking(availability_entry)) {
          identities_match = false;
          return;
        }
        accepted_windows.push(availability_entry);
        signatures.push(String(availability_entry.cache_key || ''));
      });
      if (!identities_match) {
        return false;
      }
      signatures.sort();
      next_signature = signatures.join('||');
      next_entries_by_key = index_entries_by_window_key(accepted_windows);
      Object.keys(previous_entries_by_key).concat(Object.keys(next_entries_by_key)).filter(function (window_key, window_index, all_keys) {
        return all_keys.indexOf(window_key) === window_index;
      }).forEach(function (window_key) {
        var previous_entry = previous_entries_by_key[window_key];
        var next_entry = next_entries_by_key[window_key];
        if (!previous_entry || !next_entry || String(previous_entry.cache_key || '') !== String(next_entry.cache_key || '') || previous_entry.payload !== next_entry.payload) {
          changed_window_keys.push(window_key);
          normalize_resource_ids(previous_entry && previous_entry.payload && previous_entry.payload.resource_ids).concat(normalize_resource_ids(next_entry && next_entry.payload && next_entry.payload.resource_ids)).forEach(function (resource_id) {
            affected_resource_ids[resource_id] = true;
          });
        }
      });
      next_availability_state = 'invalidated' === String(detail.state || '') ? 'loading' : 'neutral' === String(detail.state || '') ? 'failed' : 'loaded';
      if ('loaded' === next_availability_state) {
        if (accepted_windows.some(function (availability_entry) {
          return 'partial' === String(availability_entry && availability_entry.payload && availability_entry.payload.load_state || '');
        })) {
          next_availability_state = 'partial';
        } else if (accepted_windows.length < accepted_booking_windows.length) {
          next_availability_state = 'loading';
        }
      }
      changed_window_keys.forEach(evict_window_local_state);
      has_projection_change = Boolean(changed_window_keys.length || availability_identity_signature !== next_signature || availability_state !== next_availability_state);
      if (availability_state !== next_availability_state) {
        Object.keys(booking_identities_by_key).forEach(function (window_key) {
          booking_identities_by_key[window_key].resource_ids.forEach(function (resource_id) {
            affected_resource_ids[resource_id] = true;
          });
        });
      }
      if (has_projection_change) {
        availability_projection_revision += 1;
        invalidate_composed_projections();
      }
      accepted_availability_windows = accepted_windows;
      availability_identity_signature = next_signature;
      availability_generation = generation;
      availability_state = next_availability_state;
      last_availability_transition = {
        changed_window_keys: changed_window_keys.slice(),
        affected_resource_ids: Object.keys(affected_resource_ids).map(Number),
        has_projection_change: has_projection_change
      };
      return true;
    }

    /**
     * Return one accepted booking-window entry by exact key.
     *
     * @param {string} window_key Accepted native window key.
     * @return {Object|null} Original accepted entry reference or null.
     */
    function get_booking_window_entry(window_key) {
      return accepted_booking_windows.filter(function (window_entry) {
        return String(window_entry && window_entry.key || '') === String(window_key || '');
      })[0] || null;
    }

    /**
     * Return matching accepted Availability data for one native window.
     *
     * @param {string} window_key Accepted native window key.
     * @return {Object|null} Original accepted cache entry reference or null.
     */
    function get_availability_window_entry(window_key) {
      return accepted_availability_windows.filter(function (availability_entry) {
        return String(availability_entry && availability_entry.window_key || '') === String(window_key || '');
      })[0] || null;
    }

    /**
     * Build one Resource/window index only for an open presentation.
     *
     * Returned records retain references to accepted Resource, booking, axis,
     * window, and Availability DTOs. Filtering creates bounded index arrays but
     * never deep-clones a Timeline response.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @param {string} window_key Accepted native window key.
     * @return {Object|null} Lazy index or null for closed/mismatched state.
     */
    function get_resource_window_index(resource_id, window_key) {
      var cache_key;
      var window_entry;
      var availability_entry;
      var availability_payload;
      var payload;
      var resource;
      resource_id = Number(resource_id);
      window_key = String(window_key || '');
      if (!open_resource_ids[resource_id] || !booking_identities_by_key[window_key]) {
        return null;
      }
      cache_key = window_key + '|' + resource_id;
      if (resource_window_indexes[cache_key]) {
        return resource_window_indexes[cache_key];
      }
      window_entry = get_booking_window_entry(window_key);
      payload = window_entry ? window_entry.payload : null;
      resource = payload && Array.isArray(payload.resources) ? payload.resources.filter(function (resource_dto) {
        return Number(resource_dto && resource_dto.id) === resource_id;
      })[0] : null;
      if (!payload || !resource) {
        return null;
      }
      availability_entry = get_availability_window_entry(window_key);
      availability_payload = availability_entry && availability_entry.payload ? availability_entry.payload : null;
      resource_window_indexes[cache_key] = {
        resource: resource,
        window: payload.window,
        axis: payload.axis,
        segments: (payload.segments || []).filter(function (segment) {
          return Number(segment && segment.resource_id) === resource_id;
        }),
        occupancy: (payload.occupancy || []).filter(function (interval) {
          return Number(interval && interval.resource_id) === resource_id;
        }),
        availability: availability_entry,
        availability_payload: availability_payload ? Object.assign({}, availability_payload, {
          resource_ids: [resource_id],
          intervals: (availability_payload.intervals || []).filter(function (interval) {
            return Number(interval && interval.resource_id) === resource_id;
          }),
          coverage: (availability_payload.coverage || []).filter(function (coverage) {
            return Number(coverage && coverage.resource_id) === resource_id;
          }),
          unknown: (availability_payload.unknown || []).filter(function (unknown) {
            return Number(unknown && unknown.resource_id) === resource_id;
          })
        }) : null
      };
      return resource_window_indexes[cache_key];
    }

    /**
     * Build lightweight Resource-owned views over accepted booking windows.
     *
     * Retained windows reuse their lazy Resource indexes. Only newly accepted or
     * changed windows scan the native DTO collections for this open Resource.
     * Source records remain read-only references and are never deep-cloned.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @return {Array<Object>} Projector booking-window inputs.
     */
    function get_resource_projection_booking_windows(resource_id) {
      return accepted_booking_windows.map(function (window_entry) {
        var window_key = String(window_entry && window_entry.key || '');
        var resource_index = get_resource_window_index(resource_id, window_key);
        if (!resource_index) {
          return null;
        }
        return {
          key: window_key,
          payload: {
            window: resource_index.window,
            axis: resource_index.axis,
            resources: [resource_index.resource],
            segments: resource_index.segments,
            occupancy: resource_index.occupancy
          }
        };
      }).filter(Boolean);
    }

    /**
     * Build lightweight Resource-owned views over accepted Availability windows.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @return {Array<Object>} Projector Availability-window inputs.
     */
    function get_resource_projection_availability_windows(resource_id) {
      return accepted_booking_windows.map(function (booking_window_entry) {
        var window_key = String(booking_window_entry && booking_window_entry.key || '');
        var resource_index = get_resource_window_index(resource_id, window_key);
        if (!resource_index || !resource_index.availability || !resource_index.availability_payload) {
          return null;
        }
        return {
          cache_key: String(resource_index.availability.cache_key || ''),
          window_key: window_key,
          payload: resource_index.availability_payload
        };
      }).filter(Boolean);
    }

    /**
     * Store one future domain projection only for an open accepted identity.
     *
     * Phase 4 does not call this method in production. It freezes the bounded
     * cache contract for later projection phases and development tests.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @param {string} window_key Accepted native window key.
     * @param {*} projection Future presentation-neutral projection.
     * @return {boolean} True when the bounded entry was stored.
     */
    function cache_projection(resource_id, window_key, projection) {
      resource_id = Number(resource_id);
      window_key = String(window_key || '');
      if (!open_resource_ids[resource_id] || !booking_identities_by_key[window_key]) {
        return false;
      }
      if (!projection_cache[window_key]) {
        projection_cache[window_key] = Object.create(null);
      }
      projection_cache[window_key][resource_id] = projection;
      Object.keys(projection_cache).forEach(function (cached_window_key) {
        if (!booking_identities_by_key[cached_window_key]) {
          delete projection_cache[cached_window_key];
        }
      });
      return Object.keys(projection_cache).length <= maximum_cached_windows;
    }

    /**
     * Project one open Resource from the complete accepted bounded identity.
     *
     * The method performs no rendering. Unchanged identities reuse the exact
     * cached projection object. Closed or no-longer-authorized Resources return
     * null before the projector is invoked.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @param {Object} range_policy Auto or Full day presentation policy.
     * @return {Object|null} Cached or newly computed projection DTO.
     */
    function project_resource(resource_id, range_policy) {
      var projector = window.wpbc_timeline_time_rows_projector;
      var identity;
      var projector_input;
      var cache_key;
      var projection;
      resource_id = Number(resource_id);
      if (!open_resource_ids[resource_id] || !projector || 'function' !== typeof projector.project || 'function' !== typeof projector.get_projection_cache_key) {
        return null;
      }
      identity = booking_identities_by_key[Object.keys(booking_identities_by_key)[0]];
      if (!identity || -1 === identity.resource_ids.indexOf(resource_id)) {
        return null;
      }
      projector_input = {
        resource_id: resource_id,
        resource_fingerprint: identity.resource_fingerprint,
        timezone: identity.timezone,
        booking_generation: booking_projection_revision,
        availability_generation: availability_projection_revision,
        availability_state: availability_state,
        booking_windows: get_resource_projection_booking_windows(resource_id),
        availability_windows: get_resource_projection_availability_windows(resource_id),
        range_policy: Object.assign({
          mode: 'auto',
          safe_start_minute: Number(configuration.limits && configuration.limits.auto_safe_start_minute) || 480,
          safe_end_minute: Number(configuration.limits && configuration.limits.auto_safe_end_minute) || 1080
        }, range_policy || {}),
        visible_lane_limit: Number(configuration.limits && configuration.limits.maximum_visible_lanes) || 3
      };
      cache_key = projector.get_projection_cache_key(projector_input);
      if (projected_resources[resource_id] && projected_resources[resource_id].cache_key === cache_key) {
        return projected_resources[resource_id].projection;
      }
      projection = projector.project(projector_input);
      projected_resources[resource_id] = {
        cache_key: cache_key,
        projection: projection
      };
      return projection;
    }

    /**
     * Format one wall-clock minute without consulting the browser timezone.
     *
     * @param {number} wall_minute Minute from local midnight.
     * @return {string} Stable 24-hour label.
     */
    function format_wall_minute(wall_minute) {
      var bounded_minute = Math.max(0, Math.min(1440, Math.round(Number(wall_minute) || 0)));
      var hours = Math.floor(bounded_minute / 60);
      var minutes = bounded_minute % 60;
      return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }

    /**
     * Format one exact UTC offset without consulting the browser timezone.
     *
     * @param {number} offset_minutes Signed offset minutes from UTC.
     * @return {string} Signed HH:MM offset.
     */
    function format_utc_offset(offset_minutes) {
      var normalized_minutes = Math.round(Number(offset_minutes) || 0);
      var sign = 0 > normalized_minutes ? '-' : '+';
      var absolute_minutes = Math.abs(normalized_minutes);
      return sign + String(Math.floor(absolute_minutes / 60)).padStart(2, '0') + ':' + String(absolute_minutes % 60).padStart(2, '0');
    }

    /**
     * Interpolate a localized label containing named placeholders.
     *
     * @param {string} pattern Localized pattern.
     * @param {Object} values Plain scalar replacements.
     * @return {string} Interpolated label.
     */
    function interpolate_label(pattern, values) {
      Object.keys(values || {}).forEach(function (key) {
        pattern = String(pattern || '').replace(new RegExp('\\{' + key + '\\}', 'g'), String(values[key]));
      });
      return String(pattern || '');
    }

    /**
     * Return the localized, non-color booking status label.
     *
     * @param {string} status Accepted booking status.
     * @return {string} Localized status label.
     */
    function get_booking_status_label(status) {
      var i18n = configuration.i18n || {};
      if ('approved' === status) {
        return String(i18n.status_approved || 'Approved');
      }
      if ('pending' === status) {
        return String(i18n.status_pending || 'Pending');
      }
      return String(i18n.status_unknown || 'Booking status unavailable');
    }

    /**
     * Return an exact visible timed label, including offsets on DST dates.
     *
     * @param {Object} fragment Projected timed fragment.
     * @param {Object} date Presentation date record.
     * @return {string} Wall-clock range with an offset qualifier when required.
     */
    function get_timed_schedule_label(fragment, date) {
      var separator = '\u2013';
      var schedule_label = format_wall_minute(fragment.wall_start_minute) + separator + format_wall_minute(fragment.wall_end_minute);
      var start_offset;
      var end_offset;
      if (!date || !Array.isArray(date.dst_slices) || !date.dst_slices.length) {
        return schedule_label;
      }
      start_offset = format_utc_offset(fragment.start_offset_minutes);
      end_offset = format_utc_offset(fragment.end_offset_minutes);
      return schedule_label + ' (UTC' + start_offset + (start_offset === end_offset ? '' : separator + 'UTC' + end_offset) + ')';
    }

    /**
     * Return the first accepted date-band presentation record for one date.
     *
     * @param {string} date Site-local ISO date.
     * @return {Object} Accepted server date-band metadata or an empty object.
     */
    function get_source_date_band(date) {
      var source_date_band = null;
      accepted_booking_windows.some(function (window_entry) {
        var axis = window_entry && window_entry.payload ? window_entry.payload.axis || {} : {};
        return (Array.isArray(axis.date_bands) ? axis.date_bands : []).some(function (date_band) {
          if (String(date_band && date_band.date || '') !== String(date || '')) {
            return false;
          }
          source_date_band = date_band;
          return true;
        });
      });
      return source_date_band || {};
    }

    /**
     * Return the accepted authorized Resource summary for one identity.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {Object} Original accepted Resource DTO or an empty object.
     */
    function get_source_resource(resource_id) {
      var source_resource = null;
      accepted_booking_windows.some(function (window_entry) {
        var resources = window_entry && window_entry.payload && Array.isArray(window_entry.payload.resources) ? window_entry.payload.resources : [];
        return resources.some(function (resource) {
          if (Number(resource && resource.id) !== Number(resource_id)) {
            return false;
          }
          source_resource = resource;
          return true;
        });
      });
      return source_resource || {};
    }

    /**
     * Return the stable scalar identity for one canonical source segment.
     *
     * The booking ID remains part of the identity because a segment identifier
     * is presentation data and must not independently select another booking.
     *
     * @param {string} source_segment_id Accepted segment ID.
     * @param {number} booking_id Canonical booking ID.
     * @return {string} Stable segment and booking identity.
     */
    function get_source_segment_identity(source_segment_id, booking_id) {
      return String(source_segment_id || '') + '|' + Number(booking_id || 0);
    }

    /**
     * Index accepted canonical segments for one currently rendered Resource.
     *
     * The index is deliberately render-local. Closed Resources do not build or
     * retain it, and the original accepted DTO references remain authoritative.
     * Keeping the first matching reference preserves the previous bounded-window
     * lookup behavior while avoiding one complete scan per projected fragment.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @return {Object<string,Object>} Accepted segment references by stable identity.
     */
    function build_source_segment_index(resource_id) {
      var source_segments_by_identity = Object.create(null);
      accepted_booking_windows.forEach(function (window_entry) {
        var segments = window_entry && window_entry.payload && Array.isArray(window_entry.payload.segments) ? window_entry.payload.segments : [];
        segments.forEach(function (segment) {
          var identity;
          if (Number(segment && segment.resource_id) !== Number(resource_id)) {
            return;
          }
          identity = get_source_segment_identity(segment && segment.segment_id, segment && segment.booking_id);
          if (!source_segments_by_identity[identity]) {
            source_segments_by_identity[identity] = segment;
          }
        });
      });
      return source_segments_by_identity;
    }

    /**
     * Return a fixed allow-listed WordPress template renderer.
     *
     * @param {string} template_slot Code-owned configuration slot.
     * @return {Function|null} WordPress template function or null.
     */
    function get_template(template_slot) {
      var template_id = configuration.templates && configuration.templates[template_slot];
      return template_id && wp && 'function' === typeof wp.template ? wp.template(template_id) : null;
    }

    /**
     * Build the vertical ruler ticks for the resolved wall-time range.
     *
     * The 15-minute presentation interval mirrors the established horizontal
     * Block Times ruler without inheriting its editable slot-step state. Hours
     * receive labels and major ticks, half hours receive accent dots, and the
     * remaining quarter hours receive minor ticks. Only hour records are used
     * by the canvas template for full-width guide lines.
     *
     * @param {Object} range Resolved projector range.
     * @return {Array<Object>} Ordered labels and vertical offsets.
     */
    function build_time_ticks(range) {
      var ticks = [];
      var tick_step_minutes = 15;
      var tick_minute = Math.ceil(range.start_minute / tick_step_minutes) * tick_step_minutes;
      var is_hour;
      var is_half_hour;
      for (; tick_minute <= range.end_minute; tick_minute += tick_step_minutes) {
        is_hour = 0 === tick_minute % 60;
        is_half_hour = 30 === tick_minute % 60;
        ticks.push({
          minute: tick_minute,
          label: is_hour ? format_wall_minute(tick_minute) : '',
          is_hour: is_hour,
          is_half_hour: is_half_hour,
          is_minor: !is_hour && !is_half_hour,
          is_boundary: tick_minute === range.start_minute || tick_minute === range.end_minute,
          offset_percent: Number((100 * (tick_minute - range.start_minute) / range.span_minutes).toFixed(8))
        });
      }
      if (!ticks.length || ticks[ticks.length - 1].minute !== range.end_minute) {
        ticks.push({
          minute: range.end_minute,
          label: format_wall_minute(range.end_minute),
          is_hour: false,
          is_half_hour: false,
          is_minor: false,
          is_boundary: true,
          offset_percent: 100
        });
      }
      return ticks;
    }

    /**
     * Map an accepted Availability source to a code-owned CSS class.
     *
     * @param {string} source_id Accepted source identifier.
     * @return {string} Fixed scoped modifier class.
     */
    function get_availability_css_class(source_id) {
      var classes = {
        unknown: 'is-unknown',
        blocked_date: 'is-blocked-date',
        blocked_time: 'is-blocked-time',
        unavailable_weekday: 'is-unavailable-weekday',
        seasonal_availability: 'is-seasonal-availability',
        appointment_buffer: 'is-appointment-buffer',
        booking_buffer: 'is-booking-buffer',
        working_time: 'is-working-time'
      };
      return classes[String(source_id || '')] || 'is-unknown';
    }

    /**
     * Return the localized label for one summary record kind.
     *
     * @param {string} kind Projection summary kind.
     * @return {string} Localized kind label.
     */
    function get_summary_kind_label(kind) {
      var i18n = configuration.i18n || {};
      var labels = {
        full_day_booking: i18n.full_day_booking,
        timed_booking: i18n.timed_booking,
        dst_transition: i18n.dst_transition,
        availability: i18n.availability_record,
        availability_clipped: i18n.availability_record,
        availability_state: i18n.availability_state_record
      };
      return String(labels[kind] || i18n.label || '');
    }

    /**
     * Build a template-only view model from one normalized projection DTO.
     *
     * Geometry is derived only from projector percentages and accepted date-band
     * metadata. Canonical segments are retained separately for read-only Booking
     * Overview registration and are never reconstructed from rendered markup.
     *
     * @param {Object} projection Normalized pure projection DTO.
     * @param {number} zoom_percent Resource-local vertical zoom percentage.
     * @return {Object} Allow-listed template model and canonical registrations.
     */
    function build_presentation_model(projection, zoom_percent) {
      var i18n = configuration.i18n || {};
      var zoom = get_zoom_configuration();
      var range_step_minutes = get_time_range_step_minutes();
      var matching_range_preset = get_matching_range_preset(projection.range);
      var date_by_key = Object.create(null);
      var source_segments_by_identity = build_source_segment_index(projection.resource_id);
      var registrations = [];
      var dates = projection.dates.map(function (date) {
        var source_date = get_source_date_band(date.date);
        var projected_date = Object.assign({}, date, {
          label: String(source_date.label || date.date),
          weekday: String(source_date.weekday || date.date),
          day_number: String(source_date.day_number || ''),
          is_today: true === source_date.is_today,
          is_weekend: true === source_date.is_weekend,
          dst_slices: date.dst_slices.map(function (transition) {
            var visible_start = Math.max(projection.range.start_minute, transition.start_minute);
            var visible_end = Math.min(projection.range.end_minute, transition.end_minute);
            var kind_label = 'gap' === transition.kind ? i18n.dst_gap : i18n.dst_fold;
            var offset_before = format_utc_offset(Number(transition.offset_before_seconds || 0) / 60);
            var offset_after = format_utc_offset(Number(transition.offset_after_seconds || 0) / 60);
            return Object.assign({}, transition, {
              top_percent: Number((100 * (visible_start - projection.range.start_minute) / projection.range.span_minutes).toFixed(8)),
              height_percent: Number((100 * Math.max(0, visible_end - visible_start) / projection.range.span_minutes).toFixed(8)),
              kind_label: String(kind_label || transition.kind),
              offset_before: offset_before,
              offset_after: offset_after,
              label: interpolate_label(i18n.dst_transition_label, {
                kind: kind_label || transition.kind,
                before: offset_before,
                after: offset_after
              })
            });
          }).filter(function (transition) {
            return 0 < transition.height_percent;
          })
        });
        date_by_key[projected_date.date] = projected_date;
        return projected_date;
      });
      var register_fragment = function (fragment, view_fragment, interaction_axis) {
        var source_segment = source_segments_by_identity[get_source_segment_identity(fragment.source_segment_id, fragment.booking_id)] || null;
        if (source_segment) {
          registrations.push({
            render_segment_id: view_fragment.render_segment_id,
            segment: source_segment,
            is_overflowed: true === view_fragment.is_overflowed,
            interaction_axis: 'vertical' === interaction_axis ? 'vertical' : 'horizontal',
            boundary_visibility: {
              start: !view_fragment.shows_earlier_indicator,
              end: !view_fragment.shows_later_indicator
            }
          });
        }
      };
      var full_day_fragment_views = projection.full_day_fragments.map(function (fragment) {
        var date = date_by_key[fragment.date];
        return Object.assign({}, fragment, {
          date_index: date ? Number(date.index) : 0,
          left_percent: date ? date.offset_percent : 0,
          width_percent: date ? date.width_percent : 0,
          stack_top_px: 6 + 34 * Number(fragment.stack_index || 0),
          status_label: get_booking_status_label(fragment.status),
          selection_aria_label: fragment.selection_aria_label || interpolate_label(i18n.select_booking, {
            label: fragment.label
          }),
          information_aria_label: fragment.information_aria_label || interpolate_label(i18n.booking_information, {
            label: fragment.label
          }),
          details_aria_label: interpolate_label(i18n.booking_details, {
            label: fragment.label
          })
        });
      });
      var full_day_groups = Object.create(null);
      var full_day_fragments = [];
      full_day_fragment_views.forEach(function (fragment) {
        var group_key = [fragment.source_segment_id, fragment.booking_id, fragment.resource_id, fragment.stack_index].join('|');
        if (!full_day_groups[group_key]) {
          full_day_groups[group_key] = [];
        }
        full_day_groups[group_key].push(fragment);
      });
      /**
       * Append one contiguous full-day band without bridging an unloaded date.
       *
       * @param {string}        group_key Stable booking and stack identity.
       * @param {Array<Object>} fragments Consecutive projected date fragments.
       * @param {number}        band_index Zero-based band number within the group.
       * @return {void}
       */
      function append_full_day_band(group_key, fragments, band_index) {
        var first_fragment = fragments[0];
        var last_fragment = fragments[fragments.length - 1];
        var first_date = date_by_key[first_fragment.date];
        var last_date = date_by_key[last_fragment.date];
        var shows_earlier_indicator = Boolean(first_fragment.continues_before_date || first_fragment.continues_before_loaded_window);
        var shows_later_indicator = Boolean(last_fragment.continues_after_date || last_fragment.continues_after_loaded_window);
        var schedule_label = first_fragment.date === last_fragment.date ? first_fragment.date : first_fragment.date + '\u2013' + last_fragment.date;
        var view_fragment = Object.assign({}, first_fragment, {
          fragment_ids: fragments.map(function (fragment) {
            return fragment.fragment_id;
          }),
          date_end: last_fragment.date,
          render_segment_id: 'time-rows|full-day|' + group_key + '|' + band_index + '|' + first_fragment.date + '|' + last_fragment.date,
          left_percent: first_date ? first_date.offset_percent : 0,
          width_percent: first_date && last_date ? last_date.offset_percent + last_date.width_percent - first_date.offset_percent : 0,
          schedule_label: schedule_label,
          shows_earlier_indicator: shows_earlier_indicator,
          shows_later_indicator: shows_later_indicator,
          aria_label: [first_fragment.label, schedule_label, first_fragment.status_label, shows_earlier_indicator ? i18n.continued_before : '', shows_later_indicator ? i18n.continued_after : ''].filter(Boolean).join(', ')
        });
        register_fragment(first_fragment, view_fragment, 'horizontal');
        full_day_fragments.push(view_fragment);
      }
      Object.keys(full_day_groups).sort().forEach(function (group_key) {
        var fragments = full_day_groups[group_key].sort(function (left, right) {
          return left.date_index - right.date_index || left.start_epoch - right.start_epoch;
        });
        var contiguous_fragments = [];
        var band_index = 0;
        fragments.forEach(function (fragment) {
          var previous_fragment = contiguous_fragments[contiguous_fragments.length - 1];
          if (previous_fragment && fragment.date_index !== previous_fragment.date_index + 1) {
            append_full_day_band(group_key, contiguous_fragments, band_index);
            contiguous_fragments = [];
            band_index += 1;
          }
          contiguous_fragments.push(fragment);
        });
        if (contiguous_fragments.length) {
          append_full_day_band(group_key, contiguous_fragments, band_index);
        }
      });
      var timed_fragments = projection.timed_fragments.map(function (fragment) {
        var date = date_by_key[fragment.date];
        var lane_count = Math.max(1, Number(fragment.lane_count || 1));
        var schedule_label = get_timed_schedule_label(fragment, date);
        var status_label = get_booking_status_label(fragment.status);
        var shows_earlier_indicator = Boolean(fragment.is_clipped_above || fragment.continues_before_date || fragment.continues_before_fragment || fragment.continues_before_loaded_window);
        var shows_later_indicator = Boolean(fragment.is_clipped_below || fragment.continues_after_date || fragment.continues_after_fragment || fragment.continues_after_loaded_window);
        var view_fragment = Object.assign({}, fragment, {
          render_segment_id: 'time-rows|' + fragment.fragment_id,
          left_percent: date ? date.offset_percent + date.width_percent * Number(fragment.lane_index || 0) / lane_count : 0,
          width_percent: date ? date.width_percent / lane_count : 0,
          schedule_label: schedule_label,
          status_label: status_label,
          shows_earlier_indicator: shows_earlier_indicator,
          shows_later_indicator: shows_later_indicator,
          aria_label: [fragment.label, schedule_label, status_label, shows_earlier_indicator ? i18n.continued_before : '', shows_later_indicator ? i18n.continued_after : ''].filter(Boolean).join(', '),
          selection_aria_label: fragment.selection_aria_label || interpolate_label(i18n.select_booking, {
            label: fragment.label
          }),
          information_aria_label: fragment.information_aria_label || interpolate_label(i18n.booking_information, {
            label: fragment.label
          }),
          details_aria_label: interpolate_label(i18n.booking_details, {
            label: fragment.label
          })
        });
        register_fragment(fragment, view_fragment, 'vertical');
        return view_fragment;
      });
      var timed_fragment_by_id = Object.create(null);
      timed_fragments.forEach(function (fragment) {
        timed_fragment_by_id[fragment.fragment_id] = fragment;
      });
      var all_day_stack_count = full_day_fragment_views.reduce(function (stack_count, fragment) {
        return Math.max(stack_count, Number(fragment.stack_count || 1));
      }, 1);
      var summary_fragment_by_id = Object.create(null);
      var summary_records;
      full_day_fragment_views.concat(timed_fragments).forEach(function (fragment) {
        summary_fragment_by_id[fragment.fragment_id] = fragment;
      });
      summary_records = projection.summary.map(function (record) {
        var source_fragment = summary_fragment_by_id[record.fragment_id];
        var date = date_by_key[record.date];
        var continuation_labels = [];
        var time_label = record.date && 'full_day_booking' !== record.kind ? format_wall_minute(record.start_minute) + '\u2013' + format_wall_minute(record.end_minute) : '';
        if (source_fragment && 'timed_booking' === record.kind) {
          time_label = get_timed_schedule_label(source_fragment, date);
        }
        if (source_fragment && (source_fragment.is_clipped_above || source_fragment.continues_before_date || source_fragment.continues_before_fragment || source_fragment.continues_before_loaded_window)) {
          continuation_labels.push(i18n.continued_before);
        }
        if (source_fragment && (source_fragment.is_clipped_below || source_fragment.continues_after_date || source_fragment.continues_after_fragment || source_fragment.continues_after_loaded_window)) {
          continuation_labels.push(i18n.continued_after);
        }
        return Object.assign({}, record, {
          kind_label: get_summary_kind_label(record.kind),
          time_label: time_label,
          status_label: source_fragment ? get_booking_status_label(source_fragment.status) : '',
          continuation_label: continuation_labels.filter(Boolean).join(', ')
        });
      });
      dates.forEach(function (date) {
        date.dst_slices.forEach(function (transition) {
          summary_records.push({
            summary_id: 'summary|dst|' + date.date + '|' + transition.transition_id,
            kind: 'dst_transition',
            kind_label: get_summary_kind_label('dst_transition'),
            date: date.date,
            start_minute: transition.start_minute,
            end_minute: transition.end_minute,
            time_label: format_wall_minute(transition.start_minute) + '\u2013' + format_wall_minute(transition.end_minute),
            label: transition.label,
            status_label: '',
            continuation_label: ''
          });
        });
      });
      summary_records.sort(function (left, right) {
        if (!left.date && !right.date) {
          return String(left.summary_id || '').localeCompare(String(right.summary_id || ''));
        }
        if (!left.date) {
          return 1;
        }
        if (!right.date) {
          return -1;
        }
        return left.date.localeCompare(right.date) || Number(left.start_minute || 0) - Number(right.start_minute || 0) || Number(left.end_minute || 0) - Number(right.end_minute || 0) || String(left.summary_id || '').localeCompare(String(right.summary_id || ''));
      });
      zoom_percent = normalize_zoom_percent(zoom_percent);
      return {
        schema_version: Number(configuration.schema_version) || 1,
        cache_key: projection.cache_key,
        resource_id: projection.resource_id,
        timezone: projection.timezone,
        range: Object.assign({}, projection.range, {
          label: format_wall_minute(projection.range.start_minute) + '–' + format_wall_minute(projection.range.end_minute),
          start_label: format_wall_minute(projection.range.start_minute),
          end_label: format_wall_minute(projection.range.end_minute),
          start_percent: Number((100 * projection.range.start_minute / 1440).toFixed(8)),
          end_percent: Number((100 * projection.range.end_minute / 1440).toFixed(8)),
          step_minutes: range_step_minutes,
          start_aria_label: interpolate_label(i18n.time_range_start, {
            time: format_wall_minute(projection.range.start_minute)
          }),
          end_aria_label: interpolate_label(i18n.time_range_end, {
            time: format_wall_minute(projection.range.end_minute)
          }),
          auto_label: interpolate_label(i18n.auto_range_label, {
            range: format_wall_minute(projection.range.start_minute) + '–' + format_wall_minute(projection.range.end_minute)
          }),
          presets: get_time_range_presets().map(function (preset) {
            return Object.assign({}, preset, {
              is_active: !!matching_range_preset && matching_range_preset.id === preset.id
            });
          })
        }),
        zoom: {
          percent: zoom_percent,
          min_percent: zoom.min_percent,
          max_percent: zoom.max_percent,
          step_percent: zoom.step_percent,
          label: interpolate_label(i18n.time_zoom_value, {
            percent: zoom_percent
          })
        },
        body_height_px: Math.max(zoom.minimum_body_height_px, Math.round(projection.range.span_minutes / 60 * zoom.hour_height_px * zoom_percent / 100)),
        all_day_height_px: Math.max(44, 12 + 34 * all_day_stack_count),
        time_ticks: build_time_ticks(projection.range),
        dates: dates,
        full_day_fragments: full_day_fragments,
        timed_fragments: timed_fragments,
        overflow_groups: projection.overflow_groups.map(function (overflow) {
          var date = date_by_key[overflow.date];
          var records = overflow.fragment_ids.map(function (fragment_id) {
            return timed_fragment_by_id[fragment_id];
          }).filter(Boolean);
          return Object.assign({}, overflow, {
            left_percent: date ? date.offset_percent + 0.68 * date.width_percent : 0,
            width_percent: date ? 0.3 * date.width_percent : 0,
            top_percent: Number((100 * (overflow.start_wall_minute - projection.range.start_minute) / projection.range.span_minutes).toFixed(8)),
            records: records,
            aria_label: interpolate_label(i18n.more_bookings, {
              count: records.length
            })
          });
        }),
        availability_slices: projection.availability.slices.map(function (slice) {
          var date = date_by_key[slice.date];
          return Object.assign({}, slice, {
            left_percent: date ? date.offset_percent : 0,
            width_percent: date ? date.width_percent : 0,
            css_class: get_availability_css_class(slice.winning_source),
            label: slice.source_labels.join(', ') || i18n.availability_unknown
          });
        }),
        availability_state: {
          state: projection.availability.state,
          message: 'partial' === projection.availability.state ? i18n.availability_partial : 'failed' === projection.availability.state ? i18n.availability_failed : i18n.availability_loading
        },
        summary_records: summary_records,
        i18n: i18n,
        registrations: registrations,
        resource_summary: get_source_resource(projection.resource_id)
      };
    }

    /**
     * Return the current synchronized presentation hosts for one Resource.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @return {Array<Element>} Current Resource and canvas hosts.
     */
    function get_current_hosts(resource_id) {
      var hosts = mount ? mount.querySelectorAll('[data-wpbc-timeline-row-presentation-host]') : [];
      return Array.prototype.filter.call(hosts, function (host) {
        return Number(host.getAttribute('data-wpbc-timeline-resource-id')) === Number(resource_id) && presentation_id === String(host.getAttribute('data-wpbc-timeline-row-presentation-host') || '');
      });
    }

    /**
     * Register visible local booking projections with canonical read-only actions.
     *
     * @param {Array<Element>} canvas_hosts Rendered canvas-side hosts.
     * @param {Object} model Presentation model and canonical registrations.
     * @return {void}
     */
    function register_read_only_booking_actions(canvas_hosts, model) {
      var module_runtime = window.wpbc_timeline_modules;
      var booking_interactions = module_runtime && 'function' === typeof module_runtime.get_instance ? module_runtime.get_instance('wpbc_timeline_booking_interactions') : null;
      var registration_by_id = Object.create(null);
      var interaction_context = get_interaction_geometry_context(model.resource_id);
      var refresh_context;
      if (!booking_interactions || !interaction_context || 'function' !== typeof booking_interactions.register_read_only_segment) {
        return;
      }
      refresh_context = {
        presentation_id: presentation_id,
        resource_id: Number(model.resource_id),
        cache_key: String(interaction_context.cache_key || ''),
        accepted_identity: interaction_context.accepted_identity || {},
        visible_range: interaction_context.visible_range || {},
        zoom_percent: Number(interaction_context.zoom_percent || 0)
      };
      if ('function' === typeof booking_interactions.begin_read_only_refresh) {
        booking_interactions.begin_read_only_refresh(refresh_context);
      }
      model.registrations.forEach(function (registration) {
        registration_by_id[registration.render_segment_id] = registration;
      });
      canvas_hosts.forEach(function (host) {
        var cards = host && host.querySelectorAll ? host.querySelectorAll('[data-wpbc-timeline-time-rows-read-only]') : [];
        Array.prototype.forEach.call(cards, function (card) {
          var render_segment_id = String(card.getAttribute('data-wpbc-timeline-segment-id') || '');
          var registration = registration_by_id[render_segment_id];
          if (registration) {
            booking_interactions.register_read_only_segment(card, registration.segment, model.resource_summary, Object.assign({}, refresh_context, {
              render_segment_id: render_segment_id,
              is_overflowed: registration.is_overflowed,
              interaction_axis: registration.interaction_axis,
              boundary_visibility: registration.boundary_visibility
            }));
          }
        });
      });
      if ('function' === typeof booking_interactions.complete_read_only_refresh) {
        booking_interactions.complete_read_only_refresh(refresh_context);
      }
    }

    /**
     * Notify shared rendering that local host contents are complete.
     *
     * @param {number} resource_id Rendered authorized Resource ID.
     * @param {string} cache_key Complete accepted projection identity.
     * @return {void}
     */
    function emit_rendered(resource_id, cache_key) {
      var rendered_event;
      if (!mount || 'function' !== typeof mount.dispatchEvent || 'function' !== typeof window.CustomEvent) {
        return;
      }
      rendered_event = new window.CustomEvent('wpbc:timeline:row-presentation:rendered', {
        detail: {
          resource_id: Number(resource_id),
          presentation_id: presentation_id,
          cache_key: String(cache_key || '')
        }
      });
      mount.dispatchEvent(rendered_event);
    }

    /**
     * Apply the current authoritative-readback busy state to one open panel.
     *
     * Existing booking markup remains mounted. Only `aria-busy` and the domain
     * state notice change while the native Timeline owns canonical readback.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @param {Object} supplied_model Optional already-built presentation model.
     * @return {void}
     */
    function synchronize_authoritative_readback_state(resource_id, supplied_model) {
      var state_template = get_template('state');
      var projection_record = projected_resources[Number(resource_id)];
      var presentation_model = supplied_model || (!is_authoritative_readback_pending && projection_record && projection_record.projection ? build_presentation_model(projection_record.projection, get_resource_zoom_percent(resource_id)) : null);
      get_current_hosts(resource_id).forEach(function (host) {
        var panel = host && host.querySelector ? host.querySelector('[data-wpbc-timeline-time-rows-panel]') : null;
        var state_host = host && host.querySelector ? host.querySelector('[data-wpbc-timeline-time-rows-state-host]') : null;
        if (!panel) {
          return;
        }
        if (is_authoritative_readback_pending) {
          if ('function' === typeof panel.setAttribute) {
            panel.setAttribute('aria-busy', 'true');
            panel.setAttribute('data-wpbc-timeline-time-rows-refreshing', 'true');
          }
          if (state_host && state_template) {
            state_host.innerHTML = state_template({
              state: 'refreshing',
              message: String(configuration.i18n && configuration.i18n.refreshing || '')
            });
          }
          return;
        }
        if ('function' === typeof panel.removeAttribute) {
          panel.removeAttribute('aria-busy');
          panel.removeAttribute('data-wpbc-timeline-time-rows-refreshing');
        }
        if (state_host && state_template && presentation_model) {
          state_host.innerHTML = state_template(presentation_model.availability_state);
        }
      });
    }

    /**
     * Render one open Resource synchronously from already accepted local data.
     *
     * @param {number} resource_id Authorized open Resource ID.
     * @param {Array<Element>} supplied_hosts Optional lifecycle-provided hosts.
     * @return {boolean} True when useful local content replaced both hosts.
     */
    function render_resource(resource_id, supplied_hosts) {
      var hosts = Array.isArray(supplied_hosts) && supplied_hosts.length ? supplied_hosts : get_current_hosts(resource_id);
      var resource_template = get_template('resource');
      var canvas_template = get_template('canvas');
      var state_template = get_template('state');
      var summary_template = get_template('summary');
      var projection;
      var model;
      var canvas_hosts = [];
      if (!open_resource_ids[Number(resource_id)] || !resource_template || !canvas_template || !state_template || !summary_template || !hosts.length) {
        return false;
      }
      projection = project_resource(Number(resource_id), get_resource_range_policy(resource_id));
      if (!projection) {
        return false;
      }
      model = build_presentation_model(projection, get_resource_zoom_percent(resource_id));
      hosts.forEach(function (host) {
        var side = String(host.getAttribute('data-wpbc-timeline-row-presentation-side') || '');
        if ('resource' === side) {
          host.innerHTML = resource_template(model);
          return;
        }
        if ('canvas' !== side) {
          return;
        }
        host.innerHTML = canvas_template(model);
        canvas_hosts.push(host);
        if (host.querySelector) {
          var state_host = host.querySelector('[data-wpbc-timeline-time-rows-state-host]');
          var summary_host = host.querySelector('[data-wpbc-timeline-time-rows-summary-host]');
          if (state_host) {
            state_host.innerHTML = state_template(model.availability_state);
          }
          if (summary_host) {
            summary_host.innerHTML = summary_template({
              resource_id: model.resource_id,
              records: model.summary_records,
              i18n: model.i18n
            });
          }
        }
      });
      register_read_only_booking_actions(canvas_hosts, model);
      synchronize_authoritative_readback_state(resource_id, model);
      emit_rendered(resource_id, projection.cache_key);
      return 0 < canvas_hosts.length && hosts.length > canvas_hosts.length;
    }

    /**
     * Rerender every currently open authorized Resource from accepted references.
     *
     * @return {void}
     */
    function render_open_resources() {
      Object.keys(open_resource_ids).forEach(function (resource_id) {
        render_resource(Number(resource_id));
      });
    }

    /**
     * Replace only Availability-owned presentation hosts for affected Resources.
     *
     * Booking cards remain mounted, preserving canonical selection, Overview, and
     * Inspector registrations while the accepted background projection changes.
     *
     * @param {Array<number>} affected_resource_ids Authorized affected Resources.
     * @return {void}
     */
    function render_availability_resources(affected_resource_ids) {
      var availability_template = get_template('availability');
      var state_template = get_template('state');
      var summary_template = get_template('summary');
      var target_resource_ids = normalize_resource_ids(affected_resource_ids);
      if (!availability_template || !state_template || !summary_template) {
        return;
      }
      if (!target_resource_ids.length) {
        target_resource_ids = Object.keys(open_resource_ids).map(Number);
      }
      target_resource_ids.forEach(function (resource_id) {
        var projection;
        var model;
        if (!open_resource_ids[resource_id]) {
          return;
        }
        projection = project_resource(resource_id, get_resource_range_policy(resource_id));
        if (!projection) {
          return;
        }
        model = build_presentation_model(projection, get_resource_zoom_percent(resource_id));
        get_current_hosts(resource_id).forEach(function (host) {
          var side = String(host.getAttribute('data-wpbc-timeline-row-presentation-side') || '');
          var panel;
          var availability_host;
          var state_host;
          var summary_host;
          if (!host.querySelector) {
            return;
          }
          panel = host.querySelector('[data-wpbc-timeline-time-rows-panel]');
          if (panel && 'function' === typeof panel.setAttribute) {
            /*
             * Availability advances the composed projection identity without
             * replacing either panel. Keep the rendered identity synchronized so
             * later selection and movement snapshots are not rejected as stale.
             */
            panel.setAttribute('data-wpbc-timeline-time-rows-cache-key', String(projection.cache_key || ''));
          }
          if ('canvas' !== side) {
            return;
          }
          availability_host = host.querySelector('[data-wpbc-timeline-time-rows-availability-host]');
          state_host = host.querySelector('[data-wpbc-timeline-time-rows-state-host]');
          summary_host = host.querySelector('[data-wpbc-timeline-time-rows-summary-host]');
          if (availability_host) {
            availability_host.innerHTML = availability_template(model);
          }
          if (state_host) {
            state_host.innerHTML = state_template(model.availability_state);
          }
          if (summary_host) {
            summary_host.innerHTML = summary_template({
              resource_id: model.resource_id,
              records: model.summary_records,
              i18n: model.i18n
            });
          }
        });
        synchronize_authoritative_readback_state(resource_id, model);
        emit_rendered(resource_id, projection.cache_key);
      });
    }

    /**
     * Remove one Resource's local indexes and projections.
     *
     * @param {number} resource_id Resource whose presentation closed/disappeared.
     * @return {void}
     */
    function remove_resource_local_state(resource_id) {
      var suffix = '|' + Number(resource_id);
      Object.keys(resource_window_indexes).forEach(function (cache_key) {
        if (cache_key.slice(-suffix.length) === suffix) {
          delete resource_window_indexes[cache_key];
        }
      });
      Object.keys(projection_cache).forEach(function (window_key) {
        delete projection_cache[window_key][Number(resource_id)];
        if (!Object.keys(projection_cache[window_key]).length) {
          delete projection_cache[window_key];
        }
      });
      delete projected_resources[Number(resource_id)];
    }

    /**
     * Handle accepted native booking-window notifications.
     *
     * @param {CustomEvent} event Accepted-data event.
     * @return {void}
     */
    function handle_booking_windows_accepted(event) {
      if (accept_booking_windows(event && event.detail ? event.detail : {}) && last_booking_transition && last_booking_transition.has_projection_change) {
        render_open_resources();
      }
    }

    /**
     * Handle accepted native Availability notifications.
     *
     * @param {CustomEvent} event Accepted-data event.
     * @return {void}
     */
    function handle_availability_accepted(event) {
      if (accept_availability(event && event.detail ? event.detail : {}) && last_availability_transition && last_availability_transition.has_projection_change) {
        render_availability_resources(last_availability_transition.affected_resource_ids);
      }
    }

    /**
     * Reflect native mutation readback without owning its request or cache.
     *
     * @param {CustomEvent} event Neutral authoritative-readback lifecycle event.
     * @return {void}
     */
    function handle_authoritative_readback_state(event) {
      var detail = event && event.detail ? event.detail : {};
      var generation = Number(detail.generation);
      var state = String(detail.state || '');
      if (1 !== Number(detail.schema_version) || !Number.isInteger(generation) || generation < authoritative_readback_generation || -1 === ['loading', 'accepted', 'failed'].indexOf(state)) {
        return;
      }
      authoritative_readback_generation = generation;
      is_authoritative_readback_pending = 'loading' === state;
      if ('failed' === state) {
        render_open_resources();
        return;
      }
      Object.keys(open_resource_ids).forEach(function (resource_id) {
        synchronize_authoritative_readback_state(Number(resource_id));
      });
    }

    /**
     * Return the paired dual-range controls containing one changed endpoint.
     *
     * @param {Element} control Start or end range input.
     * @return {Object|null} Container and endpoint controls or null.
     */
    function get_range_control_elements(control) {
      var container = control && control.closest ? control.closest('[data-wpbc-timeline-time-rows-range-control]') : null;
      if (!container || !container.querySelector) {
        return null;
      }
      return {
        container: container,
        start: container.querySelector('[data-wpbc-timeline-time-rows-range-boundary="start"]'),
        end: container.querySelector('[data-wpbc-timeline-time-rows-range-boundary="end"]')
      };
    }

    /**
     * Update labels and the selected track while one range thumb moves.
     *
     * @param {Element} control Changed start or end range input.
     * @return {Object|null} Normalized custom policy or null.
     */
    function update_range_preview(control) {
      var controls = get_range_control_elements(control);
      var boundary = String(control && control.getAttribute ? control.getAttribute('data-wpbc-timeline-time-rows-range-boundary') : '');
      var step_minutes = get_time_range_step_minutes();
      var start_minute;
      var end_minute;
      var outputs;
      var actions;
      var range_policy;
      var matching_range_preset;
      var i18n = configuration.i18n || {};
      if (!controls || !controls.start || !controls.end) {
        return null;
      }
      start_minute = normalize_wall_minute(controls.start.value, 0);
      end_minute = normalize_wall_minute(controls.end.value, 1440);
      if ('start' === boundary) {
        start_minute = Math.min(1440 - step_minutes, Math.min(start_minute, end_minute - step_minutes));
      } else {
        end_minute = Math.max(step_minutes, Math.max(end_minute, start_minute + step_minutes));
      }
      start_minute = Math.max(0, start_minute);
      end_minute = Math.min(1440, end_minute);
      controls.start.value = start_minute;
      controls.end.value = end_minute;
      controls.start.setAttribute('aria-label', interpolate_label(i18n.time_range_start, {
        time: format_wall_minute(start_minute)
      }));
      controls.end.setAttribute('aria-label', interpolate_label(i18n.time_range_end, {
        time: format_wall_minute(end_minute)
      }));
      if (controls.container.style && controls.container.style.setProperty) {
        controls.container.style.setProperty('--wpbc-time-rows-range-start', Number((100 * start_minute / 1440).toFixed(8)) + '%');
        controls.container.style.setProperty('--wpbc-time-rows-range-end', Number((100 * end_minute / 1440).toFixed(8)) + '%');
      }
      outputs = controls.container.querySelectorAll ? controls.container.querySelectorAll('[data-wpbc-timeline-time-rows-range-output]') : [];
      Array.prototype.forEach.call(outputs, function (output) {
        output.textContent = 'start' === output.getAttribute('data-wpbc-timeline-time-rows-range-output') ? format_wall_minute(start_minute) : format_wall_minute(end_minute);
      });
      range_policy = {
        mode: 'custom',
        start_minute: start_minute,
        end_minute: end_minute
      };
      matching_range_preset = get_matching_range_preset(range_policy);
      actions = controls.container.querySelectorAll ? controls.container.querySelectorAll('[data-wpbc-timeline-time-rows-range-mode]') : [];
      Array.prototype.forEach.call(actions, function (action) {
        var is_active = !!matching_range_preset && matching_range_preset.id === String(action.getAttribute('data-wpbc-timeline-time-rows-range-preset') || '');
        action.setAttribute('aria-pressed', is_active ? 'true' : 'false');
        if (action.classList) {
          action.classList.toggle('is-active', is_active);
        }
      });
      return range_policy;
    }

    /**
     * Preview one dual-range endpoint without projecting or requesting data.
     *
     * @param {Event} event Delegated Resource-side input event.
     * @return {void}
     */
    function handle_range_input(event) {
      var control = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-time-rows-range]') : null;
      if (control) {
        update_range_preview(control);
      }
    }

    /**
     * Restore focus to a code-owned control after its WordPress template rerenders.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @param {string} selector Fixed domain-owned selector.
     * @return {void}
     */
    function restore_control_focus(resource_id, selector) {
      get_current_hosts(resource_id).some(function (host) {
        var control = host && host.querySelector ? host.querySelector(selector) : null;
        if (!control || 'function' !== typeof control.focus) {
          return false;
        }
        control.focus();
        return true;
      });
    }

    /**
     * Commit one explicit dual-slider range without a request.
     *
     * @param {Event} event Delegated Resource-side change event.
     * @return {void}
     */
    function handle_range_change(event) {
      var control = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-time-rows-range]') : null;
      var resource_id;
      var range_policy;
      var boundary;
      if (!control) {
        return;
      }
      resource_id = Number(control.getAttribute('data-wpbc-timeline-resource-id'));
      if (!open_resource_ids[resource_id]) {
        return;
      }
      range_policy = update_range_preview(control);
      if (!range_policy) {
        return;
      }
      boundary = 'end' === control.getAttribute('data-wpbc-timeline-time-rows-range-boundary') ? 'end' : 'start';
      range_policies_by_resource[resource_id] = normalize_range_policy(range_policy);
      delete projected_resources[resource_id];
      render_resource(resource_id);
      restore_control_focus(resource_id, '[data-wpbc-timeline-time-rows-range-boundary="' + boundary + '"]');
      queue_preference_save(resource_id);
    }

    /**
     * Apply Auto, one server-defined preset, or Full day from range actions.
     *
     * @param {Event} event Delegated Resource-side click event.
     * @return {void}
     */
    function handle_range_action(event) {
      var action = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-time-rows-range-mode]') : null;
      var resource_id;
      var mode;
      var preset_id;
      var preset;
      var range_policy;
      var focus_selector;
      if (!action) {
        return;
      }
      resource_id = Number(action.getAttribute('data-wpbc-timeline-resource-id'));
      mode = String(action.getAttribute('data-wpbc-timeline-time-rows-range-mode') || '');
      if (!open_resource_ids[resource_id] || -1 === ['auto', 'custom', 'full_day'].indexOf(mode)) {
        return;
      }
      range_policy = {
        mode: mode
      };
      focus_selector = '[data-wpbc-timeline-time-rows-range-mode="' + mode + '"]';
      if ('custom' === mode) {
        preset_id = String(action.getAttribute('data-wpbc-timeline-time-rows-range-preset') || '');
        preset = get_time_range_presets().find(function (candidate) {
          return candidate.id === preset_id;
        });
        if (!preset) {
          return;
        }
        range_policy = {
          mode: 'custom',
          start_minute: preset.start_minute,
          end_minute: preset.end_minute
        };
        focus_selector += '[data-wpbc-timeline-time-rows-range-preset="' + preset.id + '"]';
      }
      range_policies_by_resource[resource_id] = normalize_range_policy(range_policy);
      delete projected_resources[resource_id];
      render_resource(resource_id);
      restore_control_focus(resource_id, focus_selector);
      queue_preference_save(resource_id);
    }

    /**
     * Update both synchronized panel halves for one presentation-only zoom value.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @param {number} zoom_percent Normalized vertical zoom percentage.
     * @return {void}
     */
    function update_zoom_preview(resource_id, zoom_percent) {
      var projection_record = projected_resources[Number(resource_id)];
      var zoom = get_zoom_configuration();
      var body_height_px;
      if (!projection_record || !projection_record.projection) {
        return;
      }
      body_height_px = Math.max(zoom.minimum_body_height_px, Math.round(projection_record.projection.range.span_minutes / 60 * zoom.hour_height_px * zoom_percent / 100));
      get_current_hosts(resource_id).forEach(function (host) {
        var panel = host && host.querySelector ? host.querySelector('[data-wpbc-timeline-time-rows-panel]') : null;
        if (panel && panel.style && panel.style.setProperty) {
          panel.style.setProperty('--wpbc-time-rows-body-height', body_height_px + 'px');
        }
      });
      emit_rendered(resource_id, projection_record.cache_key);
    }

    /**
     * Apply a local vertical zoom preview without invalidating projection data.
     *
     * @param {Event} event Delegated Resource-side input event.
     * @return {void}
     */
    function handle_zoom_input(event) {
      var control = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-time-rows-zoom]') : null;
      var resource_id;
      var zoom_percent;
      var panel;
      var status;
      var label;
      if (!control) {
        return;
      }
      resource_id = Number(control.getAttribute('data-wpbc-timeline-resource-id'));
      if (!open_resource_ids[resource_id]) {
        return;
      }
      zoom_percent = normalize_zoom_percent(control.value);
      zoom_percentages_by_resource[resource_id] = zoom_percent;
      label = interpolate_label(configuration.i18n && configuration.i18n.time_zoom_value, {
        percent: zoom_percent
      });
      control.value = zoom_percent;
      control.setAttribute('aria-valuetext', label);
      panel = control.closest ? control.closest('[data-wpbc-timeline-time-rows-panel]') : null;
      status = panel && panel.querySelector ? panel.querySelector('[data-wpbc-timeline-time-rows-zoom-status]') : null;
      if (status) {
        status.textContent = label;
      }
      update_zoom_preview(resource_id, zoom_percent);
    }

    /**
     * Persist the final density value after the native range interaction ends.
     *
     * @param {Event} event Delegated Resource-side change event.
     * @return {void}
     */
    function handle_zoom_change(event) {
      var control = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-time-rows-zoom]') : null;
      var resource_id;
      if (!control) {
        return;
      }
      resource_id = Number(control.getAttribute('data-wpbc-timeline-resource-id'));
      if (open_resource_ids[resource_id]) {
        queue_preference_save(resource_id);
      }
    }

    /**
     * Stop unsent domain saves and let shared Reset await active saves.
     *
     * This neutral barrier prevents an older in-flight preference write from
     * completing after the authoritative shared Reset write.
     *
     * @param {CustomEvent} event Reset-request lifecycle event.
     * @return {void}
     */
    function handle_preferences_reset_requested(event) {
      var detail = event && event.detail ? event.detail : {};
      var waiters = [];
      if (1 !== Number(detail.schema_version) || 'function' !== typeof detail.wait_until) {
        return;
      }
      Object.keys(preference_save_states_by_resource).forEach(function (resource_id) {
        var state = preference_save_states_by_resource[resource_id];
        if (state.timer) {
          window.clearTimeout(state.timer);
          state.timer = null;
        }
        state.pending = false;
        if (state.request && 'function' === typeof state.request.always) {
          waiters.push(new window.Promise(function (resolve) {
            state.request.always(resolve);
          }));
        }
      });
      detail.wait_until(window.Promise.all(waiters));
    }

    /**
     * Apply shared Reset defaults immediately to every retained Resource.
     *
     * The server already removed the registered extension in the same successful
     * user-option write. A later accepted window confirms the authoritative
     * default DTO; no additional time-rows reset request is made.
     *
     * @param {CustomEvent} event Neutral accepted reset notification.
     * @return {void}
     */
    function handle_preferences_reset(event) {
      if (1 !== Number(event && event.detail && event.detail.schema_version)) {
        return;
      }
      Object.keys(preference_save_states_by_resource).forEach(remove_preference_save_state);
      Object.keys(preference_loaded_by_resource).concat(Object.keys(open_resource_ids)).forEach(function (resource_id) {
        resource_id = Number(resource_id);
        range_policies_by_resource[resource_id] = {
          mode: 'auto'
        };
        zoom_percentages_by_resource[resource_id] = get_zoom_configuration().default_percent;
        preference_reset_pending_by_resource[resource_id] = true;
        delete preference_loaded_by_resource[resource_id];
        delete projected_resources[resource_id];
      });
      render_open_resources();
    }

    /**
     * Handle neutral presentation host/open/close/removal lifecycle events.
     *
     * @param {CustomEvent} event Presentation lifecycle event.
     * @return {void}
     */
    function handle_presentation_lifecycle(event) {
      var detail = event && event.detail ? event.detail : {};
      var resource_id = Number(detail.resource_id);
      if (presentation_id !== String(detail.presentation_id || '') || !Number.isInteger(resource_id) || 1 > resource_id) {
        return;
      }
      if ('wpbc:timeline:row-presentation:opened' === event.type || 'wpbc:timeline:row-presentation:hosts-ready' === event.type && true === detail.is_open) {
        open_resource_ids[resource_id] = true;
        synchronize_resource_preferences(resource_id);
        render_resource(resource_id, detail.hosts);
        return;
      }
      if ('wpbc:timeline:row-presentation:closed' === event.type || 'wpbc:timeline:row-presentation:removed' === event.type) {
        delete open_resource_ids[resource_id];
        remove_resource_local_state(resource_id);
        if ('wpbc:timeline:row-presentation:removed' === event.type) {
          delete range_policies_by_resource[resource_id];
          delete zoom_percentages_by_resource[resource_id];
          delete preference_loaded_by_resource[resource_id];
          delete preference_reset_pending_by_resource[resource_id];
          remove_preference_save_state(resource_id);
        }
      }
    }

    /**
     * Return the exact data-only geometry context for one rendered Resource.
     *
     * The selection and movement modules add gesture-local DOM measurements to
     * this DTO before invoking the shared pure geometry kernel. Booking segments,
     * Availability fragments, templates, transport, and mutation authority are
     * deliberately excluded.
     *
     * @param {number} resource_id Open authorized Resource ID.
     * @return {Object|null} Accepted geometry context or null when unavailable.
     */
    function get_interaction_geometry_context(resource_id) {
      var projection_record;
      var projection;
      var zoom;
      resource_id = Number(resource_id);
      projection_record = projected_resources[resource_id];
      projection = projection_record && projection_record.projection;
      if (!open_resource_ids[resource_id] || !projection || !projection.identity || !Array.isArray(projection.dates)) {
        return null;
      }
      zoom = get_zoom_configuration();
      return {
        schema_version: 1,
        cache_key: String(projection.cache_key || ''),
        accepted_identity: {
          resource_id: resource_id,
          resource_fingerprint: String(projection.identity.resource_fingerprint || ''),
          booking_generation: Number(projection.identity.booking_generation || 0),
          availability_generation: Number(projection.identity.availability_generation || 0),
          accepted_window_keys: accepted_booking_windows.map(function (window_entry) {
            return String(window_entry && window_entry.key || '');
          }).filter(Boolean),
          timezone: String(projection.timezone || '')
        },
        date_bands: projection.dates.map(function (date_band) {
          return {
            date: String(date_band.date || ''),
            start_at: String(date_band.start_at || ''),
            end_at: String(date_band.end_at || ''),
            start_epoch: Number(date_band.start_epoch),
            end_epoch: Number(date_band.end_epoch),
            elapsed_minutes: Number(date_band.elapsed_minutes),
            wall_minutes: Number(date_band.wall_minutes),
            transitions: (Array.isArray(date_band.transitions) ? date_band.transitions : []).map(function (transition) {
              return {
                transition_id: String(transition.transition_id || ''),
                epoch: Number(transition.epoch),
                kind: String(transition.kind || ''),
                wall_range_start_minute: Number(transition.wall_range_start_minute),
                wall_range_end_minute: Number(transition.wall_range_end_minute),
                offset_before_seconds: Number(transition.offset_before_seconds),
                offset_after_seconds: Number(transition.offset_after_seconds)
              };
            })
          };
        }),
        visible_range: {
          start_minute: Number(projection.range && projection.range.start_minute),
          end_minute: Number(projection.range && projection.range.end_minute)
        },
        zoom_percent: get_resource_zoom_percent(resource_id),
        hour_height_px: zoom.hour_height_px
      };
    }

    /**
     * Return bounded scalar state for development assertions.
     *
     * @return {Object} Generations, window keys, and cache counts.
     */
    function get_state_snapshot() {
      var projection_count = Object.keys(projection_cache).reduce(function (count, window_key) {
        return count + Object.keys(projection_cache[window_key]).length;
      }, 0);
      return {
        booking_generation: booking_generation,
        availability_generation: availability_generation,
        availability_state: availability_state,
        booking_window_keys: Object.keys(booking_identities_by_key),
        availability_window_count: accepted_availability_windows.length,
        open_resource_ids: Object.keys(open_resource_ids).map(Number),
        resource_index_count: Object.keys(resource_window_indexes).length,
        projection_window_count: Object.keys(projection_cache).length,
        projection_count: projection_count + Object.keys(projected_resources).length,
        projected_resource_count: Object.keys(projected_resources).length,
        booking_projection_revision: booking_projection_revision,
        availability_projection_revision: availability_projection_revision,
        is_authoritative_readback_pending: is_authoritative_readback_pending,
        last_booking_transition: last_booking_transition,
        last_availability_transition: last_availability_transition
      };
    }

    /**
     * Attach accepted-data and presentation lifecycle listeners.
     *
     * @return {void}
     */
    function initialize() {
      if (!mount || is_initialized) {
        return;
      }
      is_initialized = true;
      mount.addEventListener('wpbc:timeline:data:booking-windows-accepted', handle_booking_windows_accepted);
      mount.addEventListener('wpbc:timeline:data:initial-canvas-ready', handle_initial_canvas_ready);
      mount.addEventListener('wpbc:timeline:data:availability-accepted', handle_availability_accepted);
      mount.addEventListener('wpbc:timeline:data:authoritative-readback-state', handle_authoritative_readback_state);
      mount.addEventListener('wpbc:timeline:data:preferences-reset', handle_preferences_reset);
      mount.addEventListener('wpbc:timeline:preferences:reset-requested', handle_preferences_reset_requested);
      mount.addEventListener('wpbc:timeline:row-presentation:hosts-ready', handle_presentation_lifecycle);
      mount.addEventListener('wpbc:timeline:row-presentation:opened', handle_presentation_lifecycle);
      mount.addEventListener('wpbc:timeline:row-presentation:closed', handle_presentation_lifecycle);
      mount.addEventListener('wpbc:timeline:row-presentation:removed', handle_presentation_lifecycle);
      mount.addEventListener('input', handle_range_input);
      mount.addEventListener('input', handle_zoom_input);
      mount.addEventListener('change', handle_range_change);
      mount.addEventListener('change', handle_zoom_change);
      mount.addEventListener('click', handle_range_action);
    }

    /**
     * Remove listeners and release every retained DTO reference.
     *
     * @return {void}
     */
    function destroy() {
      if (!mount || !is_initialized) {
        return;
      }
      mount.removeEventListener('wpbc:timeline:data:booking-windows-accepted', handle_booking_windows_accepted);
      mount.removeEventListener('wpbc:timeline:data:initial-canvas-ready', handle_initial_canvas_ready);
      mount.removeEventListener('wpbc:timeline:data:availability-accepted', handle_availability_accepted);
      mount.removeEventListener('wpbc:timeline:data:authoritative-readback-state', handle_authoritative_readback_state);
      mount.removeEventListener('wpbc:timeline:data:preferences-reset', handle_preferences_reset);
      mount.removeEventListener('wpbc:timeline:preferences:reset-requested', handle_preferences_reset_requested);
      mount.removeEventListener('wpbc:timeline:row-presentation:hosts-ready', handle_presentation_lifecycle);
      mount.removeEventListener('wpbc:timeline:row-presentation:opened', handle_presentation_lifecycle);
      mount.removeEventListener('wpbc:timeline:row-presentation:closed', handle_presentation_lifecycle);
      mount.removeEventListener('wpbc:timeline:row-presentation:removed', handle_presentation_lifecycle);
      mount.removeEventListener('input', handle_range_input);
      mount.removeEventListener('input', handle_zoom_input);
      mount.removeEventListener('change', handle_range_change);
      mount.removeEventListener('change', handle_zoom_change);
      mount.removeEventListener('click', handle_range_action);
      accepted_booking_windows = [];
      accepted_availability_windows = [];
      booking_identities_by_key = Object.create(null);
      open_resource_ids = Object.create(null);
      Object.keys(preference_save_states_by_resource).forEach(remove_preference_save_state);
      range_policies_by_resource = Object.create(null);
      zoom_percentages_by_resource = Object.create(null);
      preference_loaded_by_resource = Object.create(null);
      preference_reset_pending_by_resource = Object.create(null);
      preference_save_states_by_resource = Object.create(null);
      availability_state = 'loading';
      booking_projection_revision = 0;
      availability_projection_revision = 0;
      authoritative_readback_generation = 0;
      is_authoritative_readback_pending = false;
      last_booking_transition = null;
      last_availability_transition = null;
      initial_open_completed = false;
      if (auto_open_animation_timer) {
        window.clearTimeout(auto_open_animation_timer);
        auto_open_animation_timer = 0;
      }
      invalidate_local_caches();
      is_initialized = false;
    }
    return {
      initialize: initialize,
      destroy: destroy,
      accept_booking_windows: accept_booking_windows,
      accept_availability: accept_availability,
      get_resource_window_index: get_resource_window_index,
      cache_projection: cache_projection,
      project_resource: project_resource,
      build_presentation_model: build_presentation_model,
      render_resource: render_resource,
      get_interaction_geometry_context: get_interaction_geometry_context,
      get_state_snapshot: get_state_snapshot,
      get_accepted_booking_windows: function () {
        return accepted_booking_windows;
      }
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_time_rows_controller);
  }
})(window, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS90aW1lLXJvd3MvX291dC90aW1lLXJvd3MuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJ3cCIsIm1vZHVsZV9pZCIsImNyZWF0ZV90aW1lX3Jvd3NfY29udHJvbGxlciIsImNvbnRleHQiLCJtb3VudCIsImNvbmZpZ3VyYXRpb24iLCJwcmVzZW50YXRpb25fYXBpIiwibWF4aW11bV9jYWNoZWRfd2luZG93cyIsIk1hdGgiLCJtYXgiLCJtaW4iLCJOdW1iZXIiLCJsaW1pdHMiLCJwcmVzZW50YXRpb25faWQiLCJTdHJpbmciLCJhY2NlcHRlZF9ib29raW5nX3dpbmRvd3MiLCJhY2NlcHRlZF9hdmFpbGFiaWxpdHlfd2luZG93cyIsImJvb2tpbmdfaWRlbnRpdGllc19ieV9rZXkiLCJPYmplY3QiLCJjcmVhdGUiLCJvcGVuX3Jlc291cmNlX2lkcyIsInJhbmdlX3BvbGljaWVzX2J5X3Jlc291cmNlIiwiem9vbV9wZXJjZW50YWdlc19ieV9yZXNvdXJjZSIsInByZWZlcmVuY2VfbG9hZGVkX2J5X3Jlc291cmNlIiwicHJlZmVyZW5jZV9yZXNldF9wZW5kaW5nX2J5X3Jlc291cmNlIiwicHJlZmVyZW5jZV9zYXZlX3N0YXRlc19ieV9yZXNvdXJjZSIsInJlc291cmNlX3dpbmRvd19pbmRleGVzIiwicHJvamVjdGlvbl9jYWNoZSIsInByb2plY3RlZF9yZXNvdXJjZXMiLCJib29raW5nX2dlbmVyYXRpb24iLCJhdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbiIsImJvb2tpbmdfcHJvamVjdGlvbl9yZXZpc2lvbiIsImF2YWlsYWJpbGl0eV9wcm9qZWN0aW9uX3JldmlzaW9uIiwiYXZhaWxhYmlsaXR5X3N0YXRlIiwiYm9va2luZ19pZGVudGl0eV9zaWduYXR1cmUiLCJhdmFpbGFiaWxpdHlfaWRlbnRpdHlfc2lnbmF0dXJlIiwiYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19nZW5lcmF0aW9uIiwiaXNfYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19wZW5kaW5nIiwibGFzdF9ib29raW5nX3RyYW5zaXRpb24iLCJsYXN0X2F2YWlsYWJpbGl0eV90cmFuc2l0aW9uIiwiaXNfaW5pdGlhbGl6ZWQiLCJpbml0aWFsX29wZW5fY29tcGxldGVkIiwiYXV0b19vcGVuX2FuaW1hdGlvbl90aW1lciIsImNsZWFyX2luaXRpYWxfb3Blbl9hbmltYXRpb24iLCJyZXNvdXJjZV9pZCIsImdldF9jdXJyZW50X2hvc3RzIiwiZm9yRWFjaCIsImhvc3QiLCJjbGFzc0xpc3QiLCJyZW1vdmUiLCJjbGVhclRpbWVvdXQiLCJoYW5kbGVfaW5pdGlhbF9jYW52YXNfcmVhZHkiLCJldmVudCIsImluaXRpYWxfb3BlbiIsImhvc3RzIiwiZGV0YWlsIiwic2NoZW1hX3ZlcnNpb24iLCJmaXJzdF9yZXNvdXJjZSIsIm9wZW5fZmlyc3QiLCJpc0ludGVnZXIiLCJhbmltYXRlIiwiYWRkIiwic2V0VGltZW91dCIsIm5vcm1hbGl6ZV9yZXNvdXJjZV9pZHMiLCJyZXNvdXJjZXMiLCJzZWVuX2lkcyIsIkFycmF5IiwiaXNBcnJheSIsIm1hcCIsInJlc291cmNlIiwiaWQiLCJmaWx0ZXIiLCJzb3J0IiwibGVmdF9pZCIsInJpZ2h0X2lkIiwiZ2V0X3RpbWVfcmFuZ2Vfc3RlcF9taW51dGVzIiwidGltZV9yYW5nZV9zdGVwX21pbnV0ZXMiLCJub3JtYWxpemVfd2FsbF9taW51dGUiLCJjYW5kaWRhdGUiLCJmYWxsYmFjayIsInN0ZXBfbWludXRlcyIsImlzRmluaXRlIiwicm91bmQiLCJub3JtYWxpemVfcmFuZ2VfcG9saWN5IiwicmFuZ2VfcG9saWN5IiwibW9kZSIsInN0YXJ0X21pbnV0ZSIsImVuZF9taW51dGUiLCJnZXRfdGltZV9yYW5nZV9wcmVzZXRzIiwicmFuZ2VfcHJlc2V0cyIsInByZXNldCIsInByZXNldF9pZCIsInRlc3QiLCJsYWJlbCIsImFyaWFfbGFiZWwiLCJCb29sZWFuIiwiZ2V0X21hdGNoaW5nX3JhbmdlX3ByZXNldCIsIm5vcm1hbGl6ZWRfcG9saWN5IiwiZmluZCIsImdldF9yZXNvdXJjZV9yYW5nZV9wb2xpY3kiLCJnZXRfem9vbV9jb25maWd1cmF0aW9uIiwibWluaW11bSIsInRpbWVfem9vbV9taW5fcGVyY2VudCIsIm1heGltdW0iLCJ0aW1lX3pvb21fbWF4X3BlcmNlbnQiLCJzdGVwIiwidGltZV96b29tX3N0ZXBfcGVyY2VudCIsIm1pbl9wZXJjZW50IiwibWF4X3BlcmNlbnQiLCJzdGVwX3BlcmNlbnQiLCJkZWZhdWx0X3BlcmNlbnQiLCJ0aW1lX3pvb21fZGVmYXVsdF9wZXJjZW50IiwiaG91cl9oZWlnaHRfcHgiLCJ0aW1lX2hvdXJfaGVpZ2h0X3B4IiwibWluaW11bV9ib2R5X2hlaWdodF9weCIsInRpbWVfYm9keV9taW5faGVpZ2h0X3B4Iiwibm9ybWFsaXplX3pvb21fcGVyY2VudCIsInpvb20iLCJub3JtYWxpemVkIiwiZ2V0X3Jlc291cmNlX3pvb21fcGVyY2VudCIsImdldF9hY2NlcHRlZF9yZXNvdXJjZV9wcmVmZXJlbmNlcyIsImdldF9zb3VyY2VfcmVzb3VyY2UiLCJwcmVmZXJlbmNlcyIsInJvd19wcmVzZW50YXRpb25fcHJlZmVyZW5jZXMiLCJzeW5jaHJvbml6ZV9yZXNvdXJjZV9wcmVmZXJlbmNlcyIsImlzX3BlcnNpc3RlZCIsInpvb21fcGVyY2VudCIsInN5bmNocm9uaXplX2FjY2VwdGVkX3Jlc291cmNlX3ByZWZlcmVuY2VzIiwicmVzb3VyY2VfaWRzIiwid2luZG93X2VudHJ5IiwicGF5bG9hZCIsImNvbmNhdCIsImFubm91bmNlX3ByZWZlcmVuY2Vfc3RhdHVzIiwibWVzc2FnZSIsInN0YXR1cyIsInF1ZXJ5U2VsZWN0b3IiLCJ0ZXh0Q29udGVudCIsImdldF9wcmVmZXJlbmNlX3NhdmVfc3RhdGUiLCJ0aW1lciIsInJlcXVlc3QiLCJwZW5kaW5nIiwiYnVpbGRfcHJlZmVyZW5jZV9zYXZlX3BheWxvYWQiLCJyYW5nZV9tb2RlIiwiZmx1c2hfcHJlZmVyZW5jZV9zYXZlIiwidHJhbnNwb3J0Iiwic3RhdGUiLCJqUXVlcnkiLCJ1cmwiLCJhY3Rpb24iLCJub25jZSIsImkxOG4iLCJwcmVmZXJlbmNlc19zYXZlX2ZhaWxlZCIsImFzc2lnbiIsImFqYXgiLCJtZXRob2QiLCJkYXRhVHlwZSIsImRhdGEiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwiZmFpbCIsImFsd2F5cyIsInF1ZXVlX3ByZWZlcmVuY2Vfc2F2ZSIsInJlbW92ZV9wcmVmZXJlbmNlX3NhdmVfc3RhdGUiLCJhYm9ydCIsImJ1aWxkX2Jvb2tpbmdfaWRlbnRpdHkiLCJ0aW1lbGluZV93aW5kb3ciLCJheGlzIiwid2luZG93X2NvbnRleHQiLCJ3aW5kb3dfa2V5Iiwia2V5IiwibGVuZ3RoIiwicmVzb3VyY2VfZmluZ2VycHJpbnQiLCJzdGFydF9hdCIsImVuZF9hdCIsInZpZXciLCJ0aW1lem9uZSIsImNlbGxfbWludXRlcyIsImdldF9ib29raW5nX2lkZW50aXR5X3NpZ25hdHVyZSIsImlkZW50aXR5Iiwiam9pbiIsImludmFsaWRhdGVfbG9jYWxfY2FjaGVzIiwiaW5kZXhfZW50cmllc19ieV93aW5kb3dfa2V5IiwiZW50cmllcyIsImluZGV4ZWRfZW50cmllcyIsImVudHJ5IiwiZXZpY3Rfd2luZG93X2xvY2FsX3N0YXRlIiwiY2FjaGVfa2V5X3ByZWZpeCIsImtleXMiLCJjYWNoZV9rZXkiLCJpbmRleE9mIiwiaW52YWxpZGF0ZV9jb21wb3NlZF9wcm9qZWN0aW9ucyIsInJlY29uY2lsZV9hdXRob3JpemVkX29wZW5fcmVzb3VyY2VzIiwibmV4dF9pZGVudGl0aWVzIiwiaWRlbnRpdHlfa2V5cyIsImF1dGhvcml6ZWRfcmVzb3VyY2VfaWRzIiwicmVtb3ZlZF9yZXNvdXJjZV9pZHMiLCJyZW1vdmVfcmVzb3VyY2VfbG9jYWxfc3RhdGUiLCJwdXNoIiwiYWNjZXB0X2Jvb2tpbmdfd2luZG93cyIsIndpbmRvd3MiLCJnZW5lcmF0aW9uIiwicHJldmlvdXNfZW50cmllc19ieV9rZXkiLCJuZXh0X2VudHJpZXNfYnlfa2V5Iiwic2lnbmF0dXJlcyIsIm5leHRfc2lnbmF0dXJlIiwiY2hhbmdlZF93aW5kb3dfa2V5cyIsInJlbW92ZWRfd2luZG93X2tleXMiLCJyZXRhaW5lZF9hdmFpbGFiaWxpdHlfd2luZG93cyIsImN1cnJlbnRfd2luZG93X2ZvdW5kIiwidmFsaWQiLCJjdXJyZW50X3dpbmRvd19rZXkiLCJhdmFpbGFiaWxpdHlfZW50cnkiLCJwcmV2aW91c19pZGVudGl0eSIsIm5leHRfaWRlbnRpdHkiLCJzbGljZSIsImhhc19wcm9qZWN0aW9uX2NoYW5nZSIsImF2YWlsYWJpbGl0eV9lbnRyeV9tYXRjaGVzX2Jvb2tpbmciLCJyZXNwb25zZV93aW5kb3ciLCJhY2NlcHRfYXZhaWxhYmlsaXR5IiwiY2FjaGVkX3dpbmRvd3MiLCJhY2NlcHRlZF93aW5kb3dzIiwibmV4dF9hdmFpbGFiaWxpdHlfc3RhdGUiLCJhZmZlY3RlZF9yZXNvdXJjZV9pZHMiLCJpZGVudGl0aWVzX21hdGNoIiwid2luZG93X2luZGV4IiwiYWxsX2tleXMiLCJwcmV2aW91c19lbnRyeSIsIm5leHRfZW50cnkiLCJzb21lIiwibG9hZF9zdGF0ZSIsImdldF9ib29raW5nX3dpbmRvd19lbnRyeSIsImdldF9hdmFpbGFiaWxpdHlfd2luZG93X2VudHJ5IiwiZ2V0X3Jlc291cmNlX3dpbmRvd19pbmRleCIsImF2YWlsYWJpbGl0eV9wYXlsb2FkIiwicmVzb3VyY2VfZHRvIiwic2VnbWVudHMiLCJzZWdtZW50Iiwib2NjdXBhbmN5IiwiaW50ZXJ2YWwiLCJhdmFpbGFiaWxpdHkiLCJpbnRlcnZhbHMiLCJjb3ZlcmFnZSIsInVua25vd24iLCJnZXRfcmVzb3VyY2VfcHJvamVjdGlvbl9ib29raW5nX3dpbmRvd3MiLCJyZXNvdXJjZV9pbmRleCIsImdldF9yZXNvdXJjZV9wcm9qZWN0aW9uX2F2YWlsYWJpbGl0eV93aW5kb3dzIiwiYm9va2luZ193aW5kb3dfZW50cnkiLCJjYWNoZV9wcm9qZWN0aW9uIiwicHJvamVjdGlvbiIsImNhY2hlZF93aW5kb3dfa2V5IiwicHJvamVjdF9yZXNvdXJjZSIsInByb2plY3RvciIsIndwYmNfdGltZWxpbmVfdGltZV9yb3dzX3Byb2plY3RvciIsInByb2plY3Rvcl9pbnB1dCIsInByb2plY3QiLCJnZXRfcHJvamVjdGlvbl9jYWNoZV9rZXkiLCJib29raW5nX3dpbmRvd3MiLCJhdmFpbGFiaWxpdHlfd2luZG93cyIsInNhZmVfc3RhcnRfbWludXRlIiwiYXV0b19zYWZlX3N0YXJ0X21pbnV0ZSIsInNhZmVfZW5kX21pbnV0ZSIsImF1dG9fc2FmZV9lbmRfbWludXRlIiwidmlzaWJsZV9sYW5lX2xpbWl0IiwibWF4aW11bV92aXNpYmxlX2xhbmVzIiwiZm9ybWF0X3dhbGxfbWludXRlIiwid2FsbF9taW51dGUiLCJib3VuZGVkX21pbnV0ZSIsImhvdXJzIiwiZmxvb3IiLCJtaW51dGVzIiwicGFkU3RhcnQiLCJmb3JtYXRfdXRjX29mZnNldCIsIm9mZnNldF9taW51dGVzIiwibm9ybWFsaXplZF9taW51dGVzIiwic2lnbiIsImFic29sdXRlX21pbnV0ZXMiLCJhYnMiLCJpbnRlcnBvbGF0ZV9sYWJlbCIsInBhdHRlcm4iLCJ2YWx1ZXMiLCJyZXBsYWNlIiwiUmVnRXhwIiwiZ2V0X2Jvb2tpbmdfc3RhdHVzX2xhYmVsIiwic3RhdHVzX2FwcHJvdmVkIiwic3RhdHVzX3BlbmRpbmciLCJzdGF0dXNfdW5rbm93biIsImdldF90aW1lZF9zY2hlZHVsZV9sYWJlbCIsImZyYWdtZW50IiwiZGF0ZSIsInNlcGFyYXRvciIsInNjaGVkdWxlX2xhYmVsIiwid2FsbF9zdGFydF9taW51dGUiLCJ3YWxsX2VuZF9taW51dGUiLCJzdGFydF9vZmZzZXQiLCJlbmRfb2Zmc2V0IiwiZHN0X3NsaWNlcyIsInN0YXJ0X29mZnNldF9taW51dGVzIiwiZW5kX29mZnNldF9taW51dGVzIiwiZ2V0X3NvdXJjZV9kYXRlX2JhbmQiLCJzb3VyY2VfZGF0ZV9iYW5kIiwiZGF0ZV9iYW5kcyIsImRhdGVfYmFuZCIsInNvdXJjZV9yZXNvdXJjZSIsImdldF9zb3VyY2Vfc2VnbWVudF9pZGVudGl0eSIsInNvdXJjZV9zZWdtZW50X2lkIiwiYm9va2luZ19pZCIsImJ1aWxkX3NvdXJjZV9zZWdtZW50X2luZGV4Iiwic291cmNlX3NlZ21lbnRzX2J5X2lkZW50aXR5Iiwic2VnbWVudF9pZCIsImdldF90ZW1wbGF0ZSIsInRlbXBsYXRlX3Nsb3QiLCJ0ZW1wbGF0ZV9pZCIsInRlbXBsYXRlcyIsInRlbXBsYXRlIiwiYnVpbGRfdGltZV90aWNrcyIsInJhbmdlIiwidGlja3MiLCJ0aWNrX3N0ZXBfbWludXRlcyIsInRpY2tfbWludXRlIiwiY2VpbCIsImlzX2hvdXIiLCJpc19oYWxmX2hvdXIiLCJtaW51dGUiLCJpc19taW5vciIsImlzX2JvdW5kYXJ5Iiwib2Zmc2V0X3BlcmNlbnQiLCJzcGFuX21pbnV0ZXMiLCJ0b0ZpeGVkIiwiZ2V0X2F2YWlsYWJpbGl0eV9jc3NfY2xhc3MiLCJzb3VyY2VfaWQiLCJjbGFzc2VzIiwiYmxvY2tlZF9kYXRlIiwiYmxvY2tlZF90aW1lIiwidW5hdmFpbGFibGVfd2Vla2RheSIsInNlYXNvbmFsX2F2YWlsYWJpbGl0eSIsImFwcG9pbnRtZW50X2J1ZmZlciIsImJvb2tpbmdfYnVmZmVyIiwid29ya2luZ190aW1lIiwiZ2V0X3N1bW1hcnlfa2luZF9sYWJlbCIsImtpbmQiLCJsYWJlbHMiLCJmdWxsX2RheV9ib29raW5nIiwidGltZWRfYm9va2luZyIsImRzdF90cmFuc2l0aW9uIiwiYXZhaWxhYmlsaXR5X3JlY29yZCIsImF2YWlsYWJpbGl0eV9jbGlwcGVkIiwiYXZhaWxhYmlsaXR5X3N0YXRlX3JlY29yZCIsImJ1aWxkX3ByZXNlbnRhdGlvbl9tb2RlbCIsInJhbmdlX3N0ZXBfbWludXRlcyIsIm1hdGNoaW5nX3JhbmdlX3ByZXNldCIsImRhdGVfYnlfa2V5IiwicmVnaXN0cmF0aW9ucyIsImRhdGVzIiwic291cmNlX2RhdGUiLCJwcm9qZWN0ZWRfZGF0ZSIsIndlZWtkYXkiLCJkYXlfbnVtYmVyIiwiaXNfdG9kYXkiLCJpc193ZWVrZW5kIiwidHJhbnNpdGlvbiIsInZpc2libGVfc3RhcnQiLCJ2aXNpYmxlX2VuZCIsImtpbmRfbGFiZWwiLCJkc3RfZ2FwIiwiZHN0X2ZvbGQiLCJvZmZzZXRfYmVmb3JlIiwib2Zmc2V0X2JlZm9yZV9zZWNvbmRzIiwib2Zmc2V0X2FmdGVyIiwib2Zmc2V0X2FmdGVyX3NlY29uZHMiLCJ0b3BfcGVyY2VudCIsImhlaWdodF9wZXJjZW50IiwiZHN0X3RyYW5zaXRpb25fbGFiZWwiLCJiZWZvcmUiLCJhZnRlciIsInJlZ2lzdGVyX2ZyYWdtZW50Iiwidmlld19mcmFnbWVudCIsImludGVyYWN0aW9uX2F4aXMiLCJzb3VyY2Vfc2VnbWVudCIsInJlbmRlcl9zZWdtZW50X2lkIiwiaXNfb3ZlcmZsb3dlZCIsImJvdW5kYXJ5X3Zpc2liaWxpdHkiLCJzdGFydCIsInNob3dzX2VhcmxpZXJfaW5kaWNhdG9yIiwiZW5kIiwic2hvd3NfbGF0ZXJfaW5kaWNhdG9yIiwiZnVsbF9kYXlfZnJhZ21lbnRfdmlld3MiLCJmdWxsX2RheV9mcmFnbWVudHMiLCJkYXRlX2luZGV4IiwiaW5kZXgiLCJsZWZ0X3BlcmNlbnQiLCJ3aWR0aF9wZXJjZW50Iiwic3RhY2tfdG9wX3B4Iiwic3RhY2tfaW5kZXgiLCJzdGF0dXNfbGFiZWwiLCJzZWxlY3Rpb25fYXJpYV9sYWJlbCIsInNlbGVjdF9ib29raW5nIiwiaW5mb3JtYXRpb25fYXJpYV9sYWJlbCIsImJvb2tpbmdfaW5mb3JtYXRpb24iLCJkZXRhaWxzX2FyaWFfbGFiZWwiLCJib29raW5nX2RldGFpbHMiLCJmdWxsX2RheV9ncm91cHMiLCJncm91cF9rZXkiLCJhcHBlbmRfZnVsbF9kYXlfYmFuZCIsImZyYWdtZW50cyIsImJhbmRfaW5kZXgiLCJmaXJzdF9mcmFnbWVudCIsImxhc3RfZnJhZ21lbnQiLCJmaXJzdF9kYXRlIiwibGFzdF9kYXRlIiwiY29udGludWVzX2JlZm9yZV9kYXRlIiwiY29udGludWVzX2JlZm9yZV9sb2FkZWRfd2luZG93IiwiY29udGludWVzX2FmdGVyX2RhdGUiLCJjb250aW51ZXNfYWZ0ZXJfbG9hZGVkX3dpbmRvdyIsImZyYWdtZW50X2lkcyIsImZyYWdtZW50X2lkIiwiZGF0ZV9lbmQiLCJjb250aW51ZWRfYmVmb3JlIiwiY29udGludWVkX2FmdGVyIiwibGVmdCIsInJpZ2h0Iiwic3RhcnRfZXBvY2giLCJjb250aWd1b3VzX2ZyYWdtZW50cyIsInByZXZpb3VzX2ZyYWdtZW50IiwidGltZWRfZnJhZ21lbnRzIiwibGFuZV9jb3VudCIsImlzX2NsaXBwZWRfYWJvdmUiLCJjb250aW51ZXNfYmVmb3JlX2ZyYWdtZW50IiwiaXNfY2xpcHBlZF9iZWxvdyIsImNvbnRpbnVlc19hZnRlcl9mcmFnbWVudCIsImxhbmVfaW5kZXgiLCJ0aW1lZF9mcmFnbWVudF9ieV9pZCIsImFsbF9kYXlfc3RhY2tfY291bnQiLCJyZWR1Y2UiLCJzdGFja19jb3VudCIsInN1bW1hcnlfZnJhZ21lbnRfYnlfaWQiLCJzdW1tYXJ5X3JlY29yZHMiLCJzdW1tYXJ5IiwicmVjb3JkIiwic291cmNlX2ZyYWdtZW50IiwiY29udGludWF0aW9uX2xhYmVscyIsInRpbWVfbGFiZWwiLCJjb250aW51YXRpb25fbGFiZWwiLCJzdW1tYXJ5X2lkIiwidHJhbnNpdGlvbl9pZCIsImxvY2FsZUNvbXBhcmUiLCJzdGFydF9sYWJlbCIsImVuZF9sYWJlbCIsInN0YXJ0X3BlcmNlbnQiLCJlbmRfcGVyY2VudCIsInN0YXJ0X2FyaWFfbGFiZWwiLCJ0aW1lX3JhbmdlX3N0YXJ0IiwidGltZSIsImVuZF9hcmlhX2xhYmVsIiwidGltZV9yYW5nZV9lbmQiLCJhdXRvX2xhYmVsIiwiYXV0b19yYW5nZV9sYWJlbCIsInByZXNldHMiLCJpc19hY3RpdmUiLCJwZXJjZW50IiwidGltZV96b29tX3ZhbHVlIiwiYm9keV9oZWlnaHRfcHgiLCJhbGxfZGF5X2hlaWdodF9weCIsInRpbWVfdGlja3MiLCJvdmVyZmxvd19ncm91cHMiLCJvdmVyZmxvdyIsInJlY29yZHMiLCJzdGFydF93YWxsX21pbnV0ZSIsIm1vcmVfYm9va2luZ3MiLCJjb3VudCIsImF2YWlsYWJpbGl0eV9zbGljZXMiLCJzbGljZXMiLCJjc3NfY2xhc3MiLCJ3aW5uaW5nX3NvdXJjZSIsInNvdXJjZV9sYWJlbHMiLCJhdmFpbGFiaWxpdHlfdW5rbm93biIsImF2YWlsYWJpbGl0eV9wYXJ0aWFsIiwiYXZhaWxhYmlsaXR5X2ZhaWxlZCIsImF2YWlsYWJpbGl0eV9sb2FkaW5nIiwicmVzb3VyY2Vfc3VtbWFyeSIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJwcm90b3R5cGUiLCJjYWxsIiwiZ2V0QXR0cmlidXRlIiwicmVnaXN0ZXJfcmVhZF9vbmx5X2Jvb2tpbmdfYWN0aW9ucyIsImNhbnZhc19ob3N0cyIsIm1vZGVsIiwibW9kdWxlX3J1bnRpbWUiLCJ3cGJjX3RpbWVsaW5lX21vZHVsZXMiLCJib29raW5nX2ludGVyYWN0aW9ucyIsImdldF9pbnN0YW5jZSIsInJlZ2lzdHJhdGlvbl9ieV9pZCIsImludGVyYWN0aW9uX2NvbnRleHQiLCJnZXRfaW50ZXJhY3Rpb25fZ2VvbWV0cnlfY29udGV4dCIsInJlZnJlc2hfY29udGV4dCIsInJlZ2lzdGVyX3JlYWRfb25seV9zZWdtZW50IiwiYWNjZXB0ZWRfaWRlbnRpdHkiLCJ2aXNpYmxlX3JhbmdlIiwiYmVnaW5fcmVhZF9vbmx5X3JlZnJlc2giLCJyZWdpc3RyYXRpb24iLCJjYXJkcyIsImNhcmQiLCJjb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaCIsImVtaXRfcmVuZGVyZWQiLCJyZW5kZXJlZF9ldmVudCIsImRpc3BhdGNoRXZlbnQiLCJDdXN0b21FdmVudCIsInN5bmNocm9uaXplX2F1dGhvcml0YXRpdmVfcmVhZGJhY2tfc3RhdGUiLCJzdXBwbGllZF9tb2RlbCIsInN0YXRlX3RlbXBsYXRlIiwicHJvamVjdGlvbl9yZWNvcmQiLCJwcmVzZW50YXRpb25fbW9kZWwiLCJwYW5lbCIsInN0YXRlX2hvc3QiLCJzZXRBdHRyaWJ1dGUiLCJpbm5lckhUTUwiLCJyZWZyZXNoaW5nIiwicmVtb3ZlQXR0cmlidXRlIiwicmVuZGVyX3Jlc291cmNlIiwic3VwcGxpZWRfaG9zdHMiLCJyZXNvdXJjZV90ZW1wbGF0ZSIsImNhbnZhc190ZW1wbGF0ZSIsInN1bW1hcnlfdGVtcGxhdGUiLCJzaWRlIiwic3VtbWFyeV9ob3N0IiwicmVuZGVyX29wZW5fcmVzb3VyY2VzIiwicmVuZGVyX2F2YWlsYWJpbGl0eV9yZXNvdXJjZXMiLCJhdmFpbGFiaWxpdHlfdGVtcGxhdGUiLCJ0YXJnZXRfcmVzb3VyY2VfaWRzIiwiYXZhaWxhYmlsaXR5X2hvc3QiLCJzdWZmaXgiLCJoYW5kbGVfYm9va2luZ193aW5kb3dzX2FjY2VwdGVkIiwiaGFuZGxlX2F2YWlsYWJpbGl0eV9hY2NlcHRlZCIsImhhbmRsZV9hdXRob3JpdGF0aXZlX3JlYWRiYWNrX3N0YXRlIiwiZ2V0X3JhbmdlX2NvbnRyb2xfZWxlbWVudHMiLCJjb250cm9sIiwiY29udGFpbmVyIiwiY2xvc2VzdCIsInVwZGF0ZV9yYW5nZV9wcmV2aWV3IiwiY29udHJvbHMiLCJib3VuZGFyeSIsIm91dHB1dHMiLCJhY3Rpb25zIiwidmFsdWUiLCJzdHlsZSIsInNldFByb3BlcnR5Iiwib3V0cHV0IiwidG9nZ2xlIiwiaGFuZGxlX3JhbmdlX2lucHV0IiwidGFyZ2V0IiwicmVzdG9yZV9jb250cm9sX2ZvY3VzIiwic2VsZWN0b3IiLCJmb2N1cyIsImhhbmRsZV9yYW5nZV9jaGFuZ2UiLCJoYW5kbGVfcmFuZ2VfYWN0aW9uIiwiZm9jdXNfc2VsZWN0b3IiLCJ1cGRhdGVfem9vbV9wcmV2aWV3IiwiaGFuZGxlX3pvb21faW5wdXQiLCJoYW5kbGVfem9vbV9jaGFuZ2UiLCJoYW5kbGVfcHJlZmVyZW5jZXNfcmVzZXRfcmVxdWVzdGVkIiwid2FpdGVycyIsIndhaXRfdW50aWwiLCJQcm9taXNlIiwicmVzb2x2ZSIsImFsbCIsImhhbmRsZV9wcmVmZXJlbmNlc19yZXNldCIsImhhbmRsZV9wcmVzZW50YXRpb25fbGlmZWN5Y2xlIiwidHlwZSIsImlzX29wZW4iLCJhY2NlcHRlZF93aW5kb3dfa2V5cyIsImVuZF9lcG9jaCIsImVsYXBzZWRfbWludXRlcyIsIndhbGxfbWludXRlcyIsInRyYW5zaXRpb25zIiwiZXBvY2giLCJ3YWxsX3JhbmdlX3N0YXJ0X21pbnV0ZSIsIndhbGxfcmFuZ2VfZW5kX21pbnV0ZSIsImdldF9zdGF0ZV9zbmFwc2hvdCIsInByb2plY3Rpb25fY291bnQiLCJib29raW5nX3dpbmRvd19rZXlzIiwiYXZhaWxhYmlsaXR5X3dpbmRvd19jb3VudCIsInJlc291cmNlX2luZGV4X2NvdW50IiwicHJvamVjdGlvbl93aW5kb3dfY291bnQiLCJwcm9qZWN0ZWRfcmVzb3VyY2VfY291bnQiLCJpbml0aWFsaXplIiwiYWRkRXZlbnRMaXN0ZW5lciIsImRlc3Ryb3kiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZ2V0X2FjY2VwdGVkX2Jvb2tpbmdfd2luZG93cyIsInJlZ2lzdGVyX2ZhY3RvcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXRpbWVsaW5lL3RpbWUtcm93cy9fc3JjL3RpbWUtcm93cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRpbWVsaW5lIHRpbWUtcm93cyBhY2NlcHRlZC1kYXRhIGFkYXB0ZXIuXG4gKlxuICogVGhlIGFkYXB0ZXIgc3Vic2NyaWJlcyBvbmx5IHRvIG5hdGl2ZSBhY2NlcHRlZC1kYXRhIG5vdGlmaWNhdGlvbnMgYW5kIHRoZVxuXHQgKiBuZXV0cmFsIFJlc291cmNlLXByZXNlbnRhdGlvbiBsaWZlY3ljbGUuIEV4cGFuc2lvbiBvd25zIG5vIHJlYWQgZW5kcG9pbnRcblx0ICogb3IgZGF0YSB0cmFuc3BvcnQuIEV4cGxpY2l0IHJhbmdlIGFuZCBkZW5zaXR5IGNoYW5nZXMgdXNlIG9uZSBpc29sYXRlZCxcblx0ICogYXV0aGVudGljYXRlZCBwcmVmZXJlbmNlIHNhdmUgYWZ0ZXIgdXNlZnVsIGxvY2FsIGNvbnRlbnQgaXMgYWxyZWFkeSBzaG93bi5cblx0ICogUGhhc2VzIDYgYW5kIDcgcmVuZGVyIHRoZSBwdXJlIHByb2plY3Rpb24gc3luY2hyb25vdXNseSBpbnRvIGFsbG93LWxpc3RlZFxuXHQgKiBXb3JkUHJlc3MgdGVtcGxhdGVzLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCB3cCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBtb2R1bGVfaWQgPSAndGltZV9yb3dzJztcblxuXHQvKipcblx0ICogQ3JlYXRlIG9uZSBpc29sYXRlZCBhY2NlcHRlZC1kYXRhIGFkYXB0ZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IE1vZHVsZSBsaWZlY3ljbGUgY29udGV4dC5cblx0ICogQHBhcmFtIHtFbGVtZW50fSBjb250ZXh0Lm1vdW50IFRpbWVsaW5lIG1vdW50IGVsZW1lbnQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0LmNvbmZpZ3VyYXRpb24gRXhlY3V0YWJsZS1mcmVlIG1vZHVsZSBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udGV4dC5wcmVzZW50YXRpb25fYXBpIE5ldXRyYWwgcHJlc2VudGF0aW9uLW9ubHkgY2FwYWJpbGl0aWVzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFN5bW1ldHJpYyBhZGFwdGVyIGxpZmVjeWNsZSBhbmQgZGV2ZWxvcG1lbnQgaW5zcGVjdGlvbiBBUEkuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfdGltZV9yb3dzX2NvbnRyb2xsZXIoIGNvbnRleHQgKSB7XG5cdFx0dmFyIG1vdW50ID0gY29udGV4dC5tb3VudCB8fCBudWxsO1xuXHRcdHZhciBjb25maWd1cmF0aW9uID0gY29udGV4dC5jb25maWd1cmF0aW9uIHx8IHt9O1xuXHRcdHZhciBwcmVzZW50YXRpb25fYXBpID0gY29udGV4dC5wcmVzZW50YXRpb25fYXBpIHx8IHt9O1xuXHRcdHZhciBtYXhpbXVtX2NhY2hlZF93aW5kb3dzID0gTWF0aC5tYXgoIDEsIE1hdGgubWluKCAzLCBOdW1iZXIoIGNvbmZpZ3VyYXRpb24ubGltaXRzICYmIGNvbmZpZ3VyYXRpb24ubGltaXRzLm1heGltdW1fY2FjaGVkX3dpbmRvd3MgKSB8fCAzICkgKTtcblx0XHR2YXIgcHJlc2VudGF0aW9uX2lkID0gU3RyaW5nKCBjb25maWd1cmF0aW9uLnByZXNlbnRhdGlvbl9pZCB8fCAnJyApO1xuXHRcdHZhciBhY2NlcHRlZF9ib29raW5nX3dpbmRvd3MgPSBbXTtcblx0XHR2YXIgYWNjZXB0ZWRfYXZhaWxhYmlsaXR5X3dpbmRvd3MgPSBbXTtcblx0XHR2YXIgYm9va2luZ19pZGVudGl0aWVzX2J5X2tleSA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIgb3Blbl9yZXNvdXJjZV9pZHMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIHJhbmdlX3BvbGljaWVzX2J5X3Jlc291cmNlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciB6b29tX3BlcmNlbnRhZ2VzX2J5X3Jlc291cmNlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciBwcmVmZXJlbmNlX2xvYWRlZF9ieV9yZXNvdXJjZSA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIgcHJlZmVyZW5jZV9yZXNldF9wZW5kaW5nX2J5X3Jlc291cmNlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciBwcmVmZXJlbmNlX3NhdmVfc3RhdGVzX2J5X3Jlc291cmNlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciByZXNvdXJjZV93aW5kb3dfaW5kZXhlcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIgcHJvamVjdGlvbl9jYWNoZSA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIgcHJvamVjdGVkX3Jlc291cmNlcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIgYm9va2luZ19nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgYXZhaWxhYmlsaXR5X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBib29raW5nX3Byb2plY3Rpb25fcmV2aXNpb24gPSAwO1xuXHRcdHZhciBhdmFpbGFiaWxpdHlfcHJvamVjdGlvbl9yZXZpc2lvbiA9IDA7XG5cdFx0dmFyIGF2YWlsYWJpbGl0eV9zdGF0ZSA9ICdsb2FkaW5nJztcblx0XHR2YXIgYm9va2luZ19pZGVudGl0eV9zaWduYXR1cmUgPSAnJztcblx0XHR2YXIgYXZhaWxhYmlsaXR5X2lkZW50aXR5X3NpZ25hdHVyZSA9ICcnO1xuXHRcdHZhciBhdXRob3JpdGF0aXZlX3JlYWRiYWNrX2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBpc19hdXRob3JpdGF0aXZlX3JlYWRiYWNrX3BlbmRpbmcgPSBmYWxzZTtcblx0XHR2YXIgbGFzdF9ib29raW5nX3RyYW5zaXRpb24gPSBudWxsO1xuXHRcdHZhciBsYXN0X2F2YWlsYWJpbGl0eV90cmFuc2l0aW9uID0gbnVsbDtcblx0XHR2YXIgaXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHR2YXIgaW5pdGlhbF9vcGVuX2NvbXBsZXRlZCA9IGZhbHNlO1xuXHRcdHZhciBhdXRvX29wZW5fYW5pbWF0aW9uX3RpbWVyID0gMDtcblxuXHRcdC8qKlxuXHRcdCAqIFJlbW92ZSB0aGUgb25lLXNob3QgaW5pdGlhbCByZXZlYWwgbWFya2VyIGZyb20gc3luY2hyb25pemVkIGhvc3RzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIE9wZW5lZCBhdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfaW5pdGlhbF9vcGVuX2FuaW1hdGlvbiggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRnZXRfY3VycmVudF9ob3N0cyggcmVzb3VyY2VfaWQgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGhvc3QgKSB7XG5cdFx0XHRcdGhvc3QuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWluaXRpYWwtYXV0by1vcGVuJyApO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBhdXRvX29wZW5fYW5pbWF0aW9uX3RpbWVyICkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBhdXRvX29wZW5fYW5pbWF0aW9uX3RpbWVyICk7XG5cdFx0XHRcdGF1dG9fb3Blbl9hbmltYXRpb25fdGltZXIgPSAwO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE9wZW4gYW5kIGFuaW1hdGUgdGhlIGZpcnN0IGF1dGhvcml6ZWQgUmVzb3VyY2UgYWZ0ZXIgaW5pdGlhbCBjYW52YXMgcGFpbnQuXG5cdFx0ICpcblx0XHQgKiBUaGlzIGhhbmRsZXIgcnVucyBvbmNlIHBlciBUaW1lbGluZSBwYWdlIGxpZmVjeWNsZS4gSXQgZGVsZWdhdGVzIG9ubHkgdGhlXG5cdFx0ICogbmV1dHJhbCBvcGVuIG1lY2hhbmljLCBjb25zdW1lcyBhbHJlYWR5IGFjY2VwdGVkIERUT3Mgc3luY2hyb25vdXNseSwgbW92ZXNcblx0XHQgKiBubyBmb2N1cywgYW5kIHBlcmZvcm1zIG5vIHRyYW5zcG9ydC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IEluaXRpYWwgbmF0aXZlLWNhbnZhcy1yZWFkeSBub3RpZmljYXRpb24uXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfaW5pdGlhbF9jYW52YXNfcmVhZHkoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGluaXRpYWxfb3BlbiA9IGNvbmZpZ3VyYXRpb24uaW5pdGlhbF9vcGVuIHx8IHt9O1xuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xuXHRcdFx0dmFyIGhvc3RzO1xuXG5cdFx0XHRpZiAoIGluaXRpYWxfb3Blbl9jb21wbGV0ZWQgfHwgMSAhPT0gTnVtYmVyKCBldmVudCAmJiBldmVudC5kZXRhaWwgJiYgZXZlbnQuZGV0YWlsLnNjaGVtYV92ZXJzaW9uICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGluaXRpYWxfb3Blbl9jb21wbGV0ZWQgPSB0cnVlO1xuXHRcdFx0aWYgKCB0cnVlICE9PSBpbml0aWFsX29wZW4uZmlyc3RfcmVzb3VyY2UgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHByZXNlbnRhdGlvbl9hcGkub3Blbl9maXJzdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVzb3VyY2VfaWQgPSBOdW1iZXIoIHByZXNlbnRhdGlvbl9hcGkub3Blbl9maXJzdCggcHJlc2VudGF0aW9uX2lkICkgKTtcblx0XHRcdGlmICggISBOdW1iZXIuaXNJbnRlZ2VyKCByZXNvdXJjZV9pZCApIHx8IDEgPiByZXNvdXJjZV9pZCB8fCB0cnVlICE9PSBpbml0aWFsX29wZW4uYW5pbWF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aG9zdHMgPSBnZXRfY3VycmVudF9ob3N0cyggcmVzb3VyY2VfaWQgKTtcblx0XHRcdGhvc3RzLmZvckVhY2goIGZ1bmN0aW9uICggaG9zdCApIHtcblx0XHRcdFx0aG9zdC5jbGFzc0xpc3QuYWRkKCAnaXMtaW5pdGlhbC1hdXRvLW9wZW4nICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRhdXRvX29wZW5fYW5pbWF0aW9uX3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0Y2xlYXJfaW5pdGlhbF9vcGVuX2FuaW1hdGlvbiggcmVzb3VyY2VfaWQgKTtcblx0XHRcdH0sIDQyMCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBzb3J0ZWQgdW5pcXVlIHBvc2l0aXZlIFJlc291cmNlIElEcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0fG51bWJlcj59IHJlc291cmNlcyBSZXNvdXJjZSBEVE9zIG9yIElEcy5cblx0XHQgKiBAcmV0dXJuIHtBcnJheTxudW1iZXI+fSBTdGFibGUgUmVzb3VyY2UgSURzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9yZXNvdXJjZV9pZHMoIHJlc291cmNlcyApIHtcblx0XHRcdHZhciBzZWVuX2lkcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblxuXHRcdFx0cmV0dXJuICggQXJyYXkuaXNBcnJheSggcmVzb3VyY2VzICkgPyByZXNvdXJjZXMgOiBbXSApLm1hcCggZnVuY3Rpb24gKCByZXNvdXJjZSApIHtcblx0XHRcdFx0cmV0dXJuIE51bWJlciggcmVzb3VyY2UgJiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNvdXJjZSA/IHJlc291cmNlLmlkIDogcmVzb3VyY2UgKTtcblx0XHRcdH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdGlmICggISBOdW1iZXIuaXNJbnRlZ2VyKCByZXNvdXJjZV9pZCApIHx8IDEgPiByZXNvdXJjZV9pZCB8fCBzZWVuX2lkc1sgcmVzb3VyY2VfaWQgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2Vlbl9pZHNbIHJlc291cmNlX2lkIF0gPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0gKS5zb3J0KCBmdW5jdGlvbiAoIGxlZnRfaWQsIHJpZ2h0X2lkICkge1xuXHRcdFx0XHRyZXR1cm4gbGVmdF9pZCAtIHJpZ2h0X2lkO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgY29uZmlndXJlZCB3YWxsLW1pbnV0ZSByYW5nZSBpbmNyZW1lbnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IFBvc2l0aXZlIG1pbnV0ZSBzdGVwIGJvdW5kZWQgdG8gb25lIGhvdXIuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3RpbWVfcmFuZ2Vfc3RlcF9taW51dGVzKCkge1xuXHRcdFx0cmV0dXJuIE1hdGgubWF4KCAxNSwgTWF0aC5taW4oIDYwLCBOdW1iZXIoIGNvbmZpZ3VyYXRpb24ubGltaXRzICYmIGNvbmZpZ3VyYXRpb24ubGltaXRzLnRpbWVfcmFuZ2Vfc3RlcF9taW51dGVzICkgfHwgNjAgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSBvbmUgd2FsbC1taW51dGUgdmFsdWUgdG8gdGhlIGNvbmZpZ3VyZWQgbG9jYWwgY29udHJvbCBzdGVwLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHdhbGwgbWludXRlLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBmYWxsYmFjayBWYWx1ZSB1c2VkIHdoZW4gdGhlIGNhbmRpZGF0ZSBpcyBub3QgZmluaXRlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gQm91bmRlZCBhbmQgc3RlcHBlZCBtaW51dGUgZnJvbSBsb2NhbCBtaWRuaWdodC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVfd2FsbF9taW51dGUoIGNhbmRpZGF0ZSwgZmFsbGJhY2sgKSB7XG5cdFx0XHR2YXIgc3RlcF9taW51dGVzID0gZ2V0X3RpbWVfcmFuZ2Vfc3RlcF9taW51dGVzKCk7XG5cblx0XHRcdGNhbmRpZGF0ZSA9IE51bWJlciggY2FuZGlkYXRlICk7XG5cdFx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCBjYW5kaWRhdGUgKSApIHtcblx0XHRcdFx0Y2FuZGlkYXRlID0gZmFsbGJhY2s7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gTWF0aC5tYXgoIDAsIE1hdGgubWluKCAxNDQwLCBNYXRoLnJvdW5kKCBjYW5kaWRhdGUgLyBzdGVwX21pbnV0ZXMgKSAqIHN0ZXBfbWludXRlcyApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTm9ybWFsaXplIG9uZSBleGVjdXRhYmxlLWZyZWUgbG9jYWwgdmlzaWJsZS10aW1lIHBvbGljeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByYW5nZV9wb2xpY3kgQXV0bywgRnVsbCBkYXksIG9yIGV4cGxpY2l0IGN1c3RvbSBwb2xpY3kuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBCb3VuZGVkIHBvbGljeSBhY2NlcHRlZCBieSB0aGUgcHVyZSBwcm9qZWN0b3IuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbm9ybWFsaXplX3JhbmdlX3BvbGljeSggcmFuZ2VfcG9saWN5ICkge1xuXHRcdFx0dmFyIG1vZGUgPSBTdHJpbmcoIHJhbmdlX3BvbGljeSAmJiByYW5nZV9wb2xpY3kubW9kZSB8fCAnYXV0bycgKTtcblx0XHRcdHZhciBzdGVwX21pbnV0ZXMgPSBnZXRfdGltZV9yYW5nZV9zdGVwX21pbnV0ZXMoKTtcblx0XHRcdHZhciBzdGFydF9taW51dGU7XG5cdFx0XHR2YXIgZW5kX21pbnV0ZTtcblxuXHRcdFx0aWYgKCAnZnVsbF9kYXknID09PSBtb2RlICkge1xuXHRcdFx0XHRyZXR1cm4geyBtb2RlOiAnZnVsbF9kYXknIH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdjdXN0b20nICE9PSBtb2RlICkge1xuXHRcdFx0XHRyZXR1cm4geyBtb2RlOiAnYXV0bycgfTtcblx0XHRcdH1cblx0XHRcdHN0YXJ0X21pbnV0ZSA9IG5vcm1hbGl6ZV93YWxsX21pbnV0ZSggcmFuZ2VfcG9saWN5LnN0YXJ0X21pbnV0ZSwgMCApO1xuXHRcdFx0ZW5kX21pbnV0ZSA9IG5vcm1hbGl6ZV93YWxsX21pbnV0ZSggcmFuZ2VfcG9saWN5LmVuZF9taW51dGUsIDE0NDAgKTtcblx0XHRcdHN0YXJ0X21pbnV0ZSA9IE1hdGgubWluKCAxNDQwIC0gc3RlcF9taW51dGVzLCBzdGFydF9taW51dGUgKTtcblx0XHRcdGVuZF9taW51dGUgPSBNYXRoLm1heCggc3RhcnRfbWludXRlICsgc3RlcF9taW51dGVzLCBlbmRfbWludXRlICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG1vZGU6ICdjdXN0b20nLFxuXHRcdFx0XHRzdGFydF9taW51dGU6IHN0YXJ0X21pbnV0ZSxcblx0XHRcdFx0ZW5kX21pbnV0ZTogTWF0aC5taW4oIDE0NDAsIGVuZF9taW51dGUgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdmFsaWQgc2VydmVyLWRlZmluZWQgdmlzaWJsZS10aW1lIHByZXNldCBEVE9zLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gT3JkZXJlZCBleGVjdXRhYmxlLWZyZWUgcHJlc2V0IHJlY29yZHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3RpbWVfcmFuZ2VfcHJlc2V0cygpIHtcblx0XHRcdHZhciBzZWVuX2lkcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblxuXHRcdFx0cmV0dXJuICggQXJyYXkuaXNBcnJheSggY29uZmlndXJhdGlvbi5yYW5nZV9wcmVzZXRzICkgPyBjb25maWd1cmF0aW9uLnJhbmdlX3ByZXNldHMgOiBbXSApLm1hcCggZnVuY3Rpb24gKCBwcmVzZXQgKSB7XG5cdFx0XHRcdHZhciBwcmVzZXRfaWQgPSBTdHJpbmcoIHByZXNldCAmJiBwcmVzZXQuaWQgfHwgJycgKTtcblx0XHRcdFx0dmFyIHJhbmdlX3BvbGljeTtcblxuXHRcdFx0XHRpZiAoICEgL15bYS16MC05Xy1dKyQvLnRlc3QoIHByZXNldF9pZCApIHx8IHNlZW5faWRzWyBwcmVzZXRfaWQgXSApIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyYW5nZV9wb2xpY3kgPSBub3JtYWxpemVfcmFuZ2VfcG9saWN5KCB7XG5cdFx0XHRcdFx0bW9kZTogJ2N1c3RvbScsXG5cdFx0XHRcdFx0c3RhcnRfbWludXRlOiBwcmVzZXQuc3RhcnRfbWludXRlLFxuXHRcdFx0XHRcdGVuZF9taW51dGU6IHByZXNldC5lbmRfbWludXRlXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCAnY3VzdG9tJyAhPT0gcmFuZ2VfcG9saWN5Lm1vZGUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2Vlbl9pZHNbIHByZXNldF9pZCBdID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogcHJlc2V0X2lkLFxuXHRcdFx0XHRcdHN0YXJ0X21pbnV0ZTogcmFuZ2VfcG9saWN5LnN0YXJ0X21pbnV0ZSxcblx0XHRcdFx0XHRlbmRfbWludXRlOiByYW5nZV9wb2xpY3kuZW5kX21pbnV0ZSxcblx0XHRcdFx0XHRsYWJlbDogU3RyaW5nKCBwcmVzZXQubGFiZWwgfHwgJycgKSxcblx0XHRcdFx0XHRhcmlhX2xhYmVsOiBTdHJpbmcoIHByZXNldC5hcmlhX2xhYmVsIHx8IHByZXNldC5sYWJlbCB8fCAnJyApXG5cdFx0XHRcdH07XG5cdFx0XHR9ICkuZmlsdGVyKCBCb29sZWFuICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRmluZCB0aGUgcHJlc2V0IG1hdGNoaW5nIGFuIGV4cGxpY2l0IGN1c3RvbSB2aXNpYmxlLXRpbWUgcG9saWN5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJhbmdlX3BvbGljeSBDYW5kaWRhdGUgbm9ybWFsaXplZCBvciByYXcgcG9saWN5LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBNYXRjaGluZyBwcmVzZXQgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfbWF0Y2hpbmdfcmFuZ2VfcHJlc2V0KCByYW5nZV9wb2xpY3kgKSB7XG5cdFx0XHR2YXIgbm9ybWFsaXplZF9wb2xpY3kgPSBub3JtYWxpemVfcmFuZ2VfcG9saWN5KCByYW5nZV9wb2xpY3kgKTtcblxuXHRcdFx0aWYgKCAnY3VzdG9tJyAhPT0gbm9ybWFsaXplZF9wb2xpY3kubW9kZSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZ2V0X3RpbWVfcmFuZ2VfcHJlc2V0cygpLmZpbmQoIGZ1bmN0aW9uICggcHJlc2V0ICkge1xuXHRcdFx0XHRyZXR1cm4gcHJlc2V0LnN0YXJ0X21pbnV0ZSA9PT0gbm9ybWFsaXplZF9wb2xpY3kuc3RhcnRfbWludXRlXG5cdFx0XHRcdFx0JiYgcHJlc2V0LmVuZF9taW51dGUgPT09IG5vcm1hbGl6ZWRfcG9saWN5LmVuZF9taW51dGU7XG5cdFx0XHR9ICkgfHwgbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gb25lIFJlc291cmNlJ3MgY3VycmVudCBsb2NhbCB2aXNpYmxlLXRpbWUgcG9saWN5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBOb3JtYWxpemVkIHByb2plY3RvciBwb2xpY3kuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jlc291cmNlX3JhbmdlX3BvbGljeSggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX3JhbmdlX3BvbGljeSggcmFuZ2VfcG9saWNpZXNfYnlfcmVzb3VyY2VbIE51bWJlciggcmVzb3VyY2VfaWQgKSBdIHx8IHsgbW9kZTogJ2F1dG8nIH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGNvbmZpZ3VyZWQgdmVydGljYWwgem9vbSBib3VuZHMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R9IE1pbmltdW0sIG1heGltdW0sIHN0ZXAsIGRlZmF1bHQsIGFuZCBoZWlnaHQgdmFsdWVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF96b29tX2NvbmZpZ3VyYXRpb24oKSB7XG5cdFx0XHR2YXIgbGltaXRzID0gY29uZmlndXJhdGlvbi5saW1pdHMgfHwge307XG5cdFx0XHR2YXIgbWluaW11bSA9IE1hdGgubWF4KCAyNSwgTnVtYmVyKCBsaW1pdHMudGltZV96b29tX21pbl9wZXJjZW50ICkgfHwgMzAgKTtcblx0XHRcdHZhciBtYXhpbXVtID0gTWF0aC5tYXgoIG1pbmltdW0sIE51bWJlciggbGltaXRzLnRpbWVfem9vbV9tYXhfcGVyY2VudCApIHx8IDMwMCApO1xuXHRcdFx0dmFyIHN0ZXAgPSBNYXRoLm1heCggNSwgTnVtYmVyKCBsaW1pdHMudGltZV96b29tX3N0ZXBfcGVyY2VudCApIHx8IDEwICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG1pbl9wZXJjZW50OiBtaW5pbXVtLFxuXHRcdFx0XHRtYXhfcGVyY2VudDogbWF4aW11bSxcblx0XHRcdFx0c3RlcF9wZXJjZW50OiBzdGVwLFxuXHRcdFx0XHRkZWZhdWx0X3BlcmNlbnQ6IE1hdGgubWF4KCBtaW5pbXVtLCBNYXRoLm1pbiggbWF4aW11bSwgTnVtYmVyKCBsaW1pdHMudGltZV96b29tX2RlZmF1bHRfcGVyY2VudCApIHx8IDEwMCApICksXG5cdFx0XHRcdGhvdXJfaGVpZ2h0X3B4OiBNYXRoLm1heCggMjQsIE51bWJlciggbGltaXRzLnRpbWVfaG91cl9oZWlnaHRfcHggKSB8fCA1MiApLFxuXHRcdFx0XHRtaW5pbXVtX2JvZHlfaGVpZ2h0X3B4OiBNYXRoLm1heCggMTYwLCBOdW1iZXIoIGxpbWl0cy50aW1lX2JvZHlfbWluX2hlaWdodF9weCApIHx8IDI2MCApXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vcm1hbGl6ZSBhIFJlc291cmNlLWxvY2FsIHZlcnRpY2FsIHpvb20gcGVyY2VudGFnZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSBwZXJjZW50YWdlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gQm91bmRlZCBwZXJjZW50YWdlIGFsaWduZWQgdG8gdGhlIGNvbmZpZ3VyZWQgc3RlcC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBub3JtYWxpemVfem9vbV9wZXJjZW50KCBjYW5kaWRhdGUgKSB7XG5cdFx0XHR2YXIgem9vbSA9IGdldF96b29tX2NvbmZpZ3VyYXRpb24oKTtcblx0XHRcdHZhciBub3JtYWxpemVkID0gTnVtYmVyKCBjYW5kaWRhdGUgKTtcblxuXHRcdFx0aWYgKCAhIE51bWJlci5pc0Zpbml0ZSggbm9ybWFsaXplZCApICkge1xuXHRcdFx0XHRub3JtYWxpemVkID0gem9vbS5kZWZhdWx0X3BlcmNlbnQ7XG5cdFx0XHR9XG5cdFx0XHRub3JtYWxpemVkID0gem9vbS5taW5fcGVyY2VudCArIE1hdGgucm91bmQoICggbm9ybWFsaXplZCAtIHpvb20ubWluX3BlcmNlbnQgKSAvIHpvb20uc3RlcF9wZXJjZW50ICkgKiB6b29tLnN0ZXBfcGVyY2VudDtcblxuXHRcdFx0cmV0dXJuIE1hdGgubWF4KCB6b29tLm1pbl9wZXJjZW50LCBNYXRoLm1pbiggem9vbS5tYXhfcGVyY2VudCwgbm9ybWFsaXplZCApICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBSZXNvdXJjZSdzIGN1cnJlbnQgbG9jYWwgdmVydGljYWwgem9vbSBwZXJjZW50YWdlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBOb3JtYWxpemVkIHpvb20gcGVyY2VudGFnZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcmVzb3VyY2Vfem9vbV9wZXJjZW50KCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybiBub3JtYWxpemVfem9vbV9wZXJjZW50KCB6b29tX3BlcmNlbnRhZ2VzX2J5X3Jlc291cmNlWyBOdW1iZXIoIHJlc291cmNlX2lkICkgXSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgYWNjZXB0ZWQgcHJlc2VudGF0aW9uIHNldHRpbmdzIGVtYmVkZGVkIGluIG9uZSBSZXNvdXJjZSBEVE8uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQWNjZXB0ZWQgc2V0dGluZ3Mgb3IgbnVsbCB3aGVuIHVuYXZhaWxhYmxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9hY2NlcHRlZF9yZXNvdXJjZV9wcmVmZXJlbmNlcyggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHR2YXIgcmVzb3VyY2UgPSBnZXRfc291cmNlX3Jlc291cmNlKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0dmFyIHByZWZlcmVuY2VzID0gcmVzb3VyY2Uucm93X3ByZXNlbnRhdGlvbl9wcmVmZXJlbmNlcztcblxuXHRcdFx0aWYgKCAhIHByZWZlcmVuY2VzIHx8ICdvYmplY3QnICE9PSB0eXBlb2YgcHJlZmVyZW5jZXMgfHwgISBwcmVmZXJlbmNlc1sgcHJlc2VudGF0aW9uX2lkIF0gKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcHJlZmVyZW5jZXNbIHByZXNlbnRhdGlvbl9pZCBdO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgb25lIFJlc291cmNlIGZyb20gaXRzIGFscmVhZHktYWNjZXB0ZWQgYXV0aG9yaXRhdGl2ZSBEVE8uXG5cdFx0ICpcblx0XHQgKiBBIHJlc2V0IGlnbm9yZXMgc3RhbGUgY2FjaGVkIHBlcnNpc3RlZCB2YWx1ZXMgdW50aWwgdGhlIGZpcnN0IHBvc3QtcmVzZXRcblx0XHQgKiBEVE8gZXhwbGljaXRseSByZXBvcnRzIGRlZmF1bHRzLiBOb3JtYWwgbmF0aXZlIHJlcmVuZGVycyByZXRhaW4gdGhlIGxvY2FsXG5cdFx0ICogdmFsdWUgc28gYW4gaW4tZmxpZ2h0IG9yIHJlY2VudGx5IGNvbXBsZXRlZCBzYXZlIGNhbm5vdCBiZSBvdmVyd3JpdHRlbiBieVxuXHRcdCAqIGFuIG9sZGVyIGFkamFjZW50LXdpbmRvdyBzbmFwc2hvdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhY2NlcHRlZCBzZXR0aW5ncyBpbml0aWFsaXplZCB0aGUgUmVzb3VyY2UuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfcmVzb3VyY2VfcHJlZmVyZW5jZXMoIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIHByZWZlcmVuY2VzID0gZ2V0X2FjY2VwdGVkX3Jlc291cmNlX3ByZWZlcmVuY2VzKCByZXNvdXJjZV9pZCApO1xuXG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgKTtcblx0XHRcdGlmICggISBwcmVmZXJlbmNlcyB8fCAxICE9PSBOdW1iZXIoIHByZWZlcmVuY2VzLnNjaGVtYV92ZXJzaW9uICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggcHJlZmVyZW5jZV9yZXNldF9wZW5kaW5nX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdICYmIHRydWUgPT09IHByZWZlcmVuY2VzLmlzX3BlcnNpc3RlZCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwcmVmZXJlbmNlX2xvYWRlZF9ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSAmJiAhIHByZWZlcmVuY2VfcmVzZXRfcGVuZGluZ19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJhbmdlX3BvbGljaWVzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdID0gbm9ybWFsaXplX3JhbmdlX3BvbGljeSggcHJlZmVyZW5jZXMucmFuZ2VfcG9saWN5IHx8IHsgbW9kZTogJ2F1dG8nIH0gKTtcblx0XHRcdHpvb21fcGVyY2VudGFnZXNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSBub3JtYWxpemVfem9vbV9wZXJjZW50KCBwcmVmZXJlbmNlcy56b29tX3BlcmNlbnQgKTtcblx0XHRcdHByZWZlcmVuY2VfbG9hZGVkX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdID0gdHJ1ZTtcblx0XHRcdGRlbGV0ZSBwcmVmZXJlbmNlX3Jlc2V0X3BlbmRpbmdfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF07XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgZXZlcnkgUmVzb3VyY2UgaW4gdGhlIGFjY2VwdGVkIGJvdW5kZWQgYm9va2luZyBjYWNoZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfYWNjZXB0ZWRfcmVzb3VyY2VfcHJlZmVyZW5jZXMoKSB7XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWRzID0gW107XG5cblx0XHRcdGFjY2VwdGVkX2Jvb2tpbmdfd2luZG93cy5mb3JFYWNoKCBmdW5jdGlvbiAoIHdpbmRvd19lbnRyeSApIHtcblx0XHRcdFx0dmFyIHJlc291cmNlcyA9IHdpbmRvd19lbnRyeSAmJiB3aW5kb3dfZW50cnkucGF5bG9hZCAmJiBBcnJheS5pc0FycmF5KCB3aW5kb3dfZW50cnkucGF5bG9hZC5yZXNvdXJjZXMgKVxuXHRcdFx0XHRcdD8gd2luZG93X2VudHJ5LnBheWxvYWQucmVzb3VyY2VzXG5cdFx0XHRcdFx0OiBbXTtcblxuXHRcdFx0XHRyZXNvdXJjZV9pZHMgPSByZXNvdXJjZV9pZHMuY29uY2F0KCBub3JtYWxpemVfcmVzb3VyY2VfaWRzKCByZXNvdXJjZXMgKSApO1xuXHRcdFx0fSApO1xuXHRcdFx0bm9ybWFsaXplX3Jlc291cmNlX2lkcyggcmVzb3VyY2VfaWRzICkuZm9yRWFjaCggc3luY2hyb25pemVfcmVzb3VyY2VfcHJlZmVyZW5jZXMgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBbm5vdW5jZSBhIHByZWZlcmVuY2UgcGVyc2lzdGVuY2UgcmVzdWx0IGluc2lkZSB0aGUgZG9tYWluLW93bmVkIHBhbmVsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgTG9jYWxpemVkIHN0YXR1cyBtZXNzYWdlLCBvciBlbXB0eSB0byBjbGVhci5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFubm91bmNlX3ByZWZlcmVuY2Vfc3RhdHVzKCByZXNvdXJjZV9pZCwgbWVzc2FnZSApIHtcblx0XHRcdGdldF9jdXJyZW50X2hvc3RzKCByZXNvdXJjZV9pZCApLmZvckVhY2goIGZ1bmN0aW9uICggaG9zdCApIHtcblx0XHRcdFx0dmFyIHN0YXR1cyA9IGhvc3QgJiYgaG9zdC5xdWVyeVNlbGVjdG9yXG5cdFx0XHRcdFx0PyBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1wcmVmZXJlbmNlLXN0YXR1c10nIClcblx0XHRcdFx0XHQ6IG51bGw7XG5cblx0XHRcdFx0aWYgKCBzdGF0dXMgKSB7XG5cdFx0XHRcdFx0c3RhdHVzLnRleHRDb250ZW50ID0gU3RyaW5nKCBtZXNzYWdlIHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYSBSZXNvdXJjZSdzIG11dGFibGUgc2VyaWFsaXplZCBzYXZlIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBUaW1lciwgcmVxdWVzdCwgYW5kIHBlbmRpbmcgZmxhZ3MuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3ByZWZlcmVuY2Vfc2F2ZV9zdGF0ZSggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgKTtcblx0XHRcdGlmICggISBwcmVmZXJlbmNlX3NhdmVfc3RhdGVzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdICkge1xuXHRcdFx0XHRwcmVmZXJlbmNlX3NhdmVfc3RhdGVzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdID0ge1xuXHRcdFx0XHRcdHRpbWVyOiBudWxsLFxuXHRcdFx0XHRcdHJlcXVlc3Q6IG51bGwsXG5cdFx0XHRcdFx0cGVuZGluZzogZmFsc2Vcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHByZWZlcmVuY2Vfc2F2ZV9zdGF0ZXNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgdGhlIGZpeGVkIHNjYWxhciBzYXZlIHBheWxvYWQgZm9yIG9uZSBSZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gRXhlY3V0YWJsZS1mcmVlIHByZWZlcmVuY2UgdmFsdWVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJ1aWxkX3ByZWZlcmVuY2Vfc2F2ZV9wYXlsb2FkKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHZhciByYW5nZV9wb2xpY3kgPSBnZXRfcmVzb3VyY2VfcmFuZ2VfcG9saWN5KCByZXNvdXJjZV9pZCApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXNvdXJjZV9pZDogTnVtYmVyKCByZXNvdXJjZV9pZCApLFxuXHRcdFx0XHRyYW5nZV9tb2RlOiByYW5nZV9wb2xpY3kubW9kZSxcblx0XHRcdFx0c3RhcnRfbWludXRlOiAnY3VzdG9tJyA9PT0gcmFuZ2VfcG9saWN5Lm1vZGUgPyByYW5nZV9wb2xpY3kuc3RhcnRfbWludXRlIDogMCxcblx0XHRcdFx0ZW5kX21pbnV0ZTogJ2N1c3RvbScgPT09IHJhbmdlX3BvbGljeS5tb2RlID8gcmFuZ2VfcG9saWN5LmVuZF9taW51dGUgOiAxNDQwLFxuXHRcdFx0XHR6b29tX3BlcmNlbnQ6IGdldF9yZXNvdXJjZV96b29tX3BlcmNlbnQoIHJlc291cmNlX2lkIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRmx1c2ggb25lIHNlcmlhbGl6ZWQgcHJlZmVyZW5jZSBzYXZlIGFmdGVyIGFuIGV4cGxpY2l0IGNvbnRyb2wgY2hhbmdlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmbHVzaF9wcmVmZXJlbmNlX3NhdmUoIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIHRyYW5zcG9ydCA9IGNvbmZpZ3VyYXRpb24ucHJlZmVyZW5jZXMgfHwge307XG5cdFx0XHR2YXIgc3RhdGUgPSBnZXRfcHJlZmVyZW5jZV9zYXZlX3N0YXRlKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0dmFyIHBheWxvYWQ7XG5cblx0XHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0c3RhdGUudGltZXIgPSBudWxsO1xuXHRcdFx0aWYgKCBzdGF0ZS5yZXF1ZXN0IHx8ICEgc3RhdGUucGVuZGluZyApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHdpbmRvdy5qUXVlcnkgfHwgISB0cmFuc3BvcnQudXJsIHx8ICEgdHJhbnNwb3J0LmFjdGlvbiB8fCAhIHRyYW5zcG9ydC5ub25jZSApIHtcblx0XHRcdFx0c3RhdGUucGVuZGluZyA9IGZhbHNlO1xuXHRcdFx0XHRhbm5vdW5jZV9wcmVmZXJlbmNlX3N0YXR1cyggcmVzb3VyY2VfaWQsIGNvbmZpZ3VyYXRpb24uaTE4biAmJiBjb25maWd1cmF0aW9uLmkxOG4ucHJlZmVyZW5jZXNfc2F2ZV9mYWlsZWQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzdGF0ZS5wZW5kaW5nID0gZmFsc2U7XG5cdFx0XHRwYXlsb2FkID0gT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5hY3Rpb24sXG5cdFx0XHRcdG5vbmNlOiB0cmFuc3BvcnQubm9uY2Vcblx0XHRcdH0sIGJ1aWxkX3ByZWZlcmVuY2Vfc2F2ZV9wYXlsb2FkKCByZXNvdXJjZV9pZCApICk7XG5cdFx0XHRhbm5vdW5jZV9wcmVmZXJlbmNlX3N0YXR1cyggcmVzb3VyY2VfaWQsICcnICk7XG5cdFx0XHRzdGF0ZS5yZXF1ZXN0ID0gd2luZG93LmpRdWVyeS5hamF4KCB7XG5cdFx0XHRcdHVybDogdHJhbnNwb3J0LnVybCxcblx0XHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdGRhdGE6IHBheWxvYWRcblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHR2YXIgcHJlZmVyZW5jZXMgPSByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGFcblx0XHRcdFx0XHQ/IHJlc3BvbnNlLmRhdGEucHJlZmVyZW5jZXNcblx0XHRcdFx0XHQ6IG51bGw7XG5cblx0XHRcdFx0aWYgKCBzdGF0ZS5wZW5kaW5nIHx8ICEgcHJlZmVyZW5jZXMgfHwgTnVtYmVyKCByZXNwb25zZS5kYXRhLnJlc291cmNlX2lkICkgIT09IHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyYW5nZV9wb2xpY2llc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSA9IG5vcm1hbGl6ZV9yYW5nZV9wb2xpY3koIHByZWZlcmVuY2VzLnJhbmdlX3BvbGljeSB8fCB7IG1vZGU6ICdhdXRvJyB9ICk7XG5cdFx0XHRcdHpvb21fcGVyY2VudGFnZXNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSBub3JtYWxpemVfem9vbV9wZXJjZW50KCBwcmVmZXJlbmNlcy56b29tX3BlcmNlbnQgKTtcblx0XHRcdFx0cHJlZmVyZW5jZV9sb2FkZWRfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSB0cnVlO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0YW5ub3VuY2VfcHJlZmVyZW5jZV9zdGF0dXMoIHJlc291cmNlX2lkLCBjb25maWd1cmF0aW9uLmkxOG4gJiYgY29uZmlndXJhdGlvbi5pMThuLnByZWZlcmVuY2VzX3NhdmVfZmFpbGVkICk7XG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHN0YXRlLnJlcXVlc3QgPSBudWxsO1xuXHRcdFx0XHRpZiAoIHN0YXRlLnBlbmRpbmcgJiYgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdFx0Zmx1c2hfcHJlZmVyZW5jZV9zYXZlKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVib3VuY2Ugb25lIFJlc291cmNlLWxvY2FsIHByZWZlcmVuY2Ugc2F2ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcXVldWVfcHJlZmVyZW5jZV9zYXZlKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHZhciBzdGF0ZSA9IGdldF9wcmVmZXJlbmNlX3NhdmVfc3RhdGUoIHJlc291cmNlX2lkICk7XG5cblx0XHRcdHN0YXRlLnBlbmRpbmcgPSB0cnVlO1xuXHRcdFx0aWYgKCBzdGF0ZS5yZXF1ZXN0IHx8IHN0YXRlLnRpbWVyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzdGF0ZS50aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGZsdXNoX3ByZWZlcmVuY2Vfc2F2ZSggcmVzb3VyY2VfaWQgKTtcblx0XHRcdH0sIDI1MCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENhbmNlbCB1bnNlbnQgc3RhdGUgYWZ0ZXIgYSBSZXNvdXJjZSBpcyBubyBsb25nZXIgYXV0aG9yaXplZC9wcmVzZW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIFJlbW92ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW1vdmVfcHJlZmVyZW5jZV9zYXZlX3N0YXRlKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHZhciBzdGF0ZSA9IHByZWZlcmVuY2Vfc2F2ZV9zdGF0ZXNfYnlfcmVzb3VyY2VbIE51bWJlciggcmVzb3VyY2VfaWQgKSBdO1xuXG5cdFx0XHRpZiAoIHN0YXRlICYmIHN0YXRlLnRpbWVyICkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzdGF0ZS50aW1lciApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBzdGF0ZSAmJiBzdGF0ZS5yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBzdGF0ZS5yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRzdGF0ZS5yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgcHJlZmVyZW5jZV9zYXZlX3N0YXRlc19ieV9yZXNvdXJjZVsgTnVtYmVyKCByZXNvdXJjZV9pZCApIF07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgYW4gZXhhY3QgaWRlbnRpdHkgZm9yIG9uZSBhY2NlcHRlZCBuYXRpdmUgYm9va2luZyB3aW5kb3cuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gd2luZG93X2VudHJ5IE5hdGl2ZSBgeyBrZXksIHBheWxvYWQgfWAgY2FjaGUgZW50cnkuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEV4YWN0IGlkZW50aXR5IG9yIG51bGwgd2hlbiBpbmNvbXBsZXRlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGJ1aWxkX2Jvb2tpbmdfaWRlbnRpdHkoIHdpbmRvd19lbnRyeSApIHtcblx0XHRcdHZhciBwYXlsb2FkID0gd2luZG93X2VudHJ5ICYmIHdpbmRvd19lbnRyeS5wYXlsb2FkID8gd2luZG93X2VudHJ5LnBheWxvYWQgOiB7fTtcblx0XHRcdHZhciB0aW1lbGluZV93aW5kb3cgPSBwYXlsb2FkLndpbmRvdyB8fCB7fTtcblx0XHRcdHZhciBheGlzID0gcGF5bG9hZC5heGlzIHx8IHt9O1xuXHRcdFx0dmFyIHdpbmRvd19jb250ZXh0ID0gcGF5bG9hZC53aW5kb3dfY29udGV4dCB8fCB7fTtcblx0XHRcdHZhciByZXNvdXJjZV9pZHMgPSBub3JtYWxpemVfcmVzb3VyY2VfaWRzKCBwYXlsb2FkLnJlc291cmNlcyApO1xuXHRcdFx0dmFyIHdpbmRvd19rZXkgPSBTdHJpbmcoIHdpbmRvd19lbnRyeSAmJiB3aW5kb3dfZW50cnkua2V5IHx8IHdpbmRvd19jb250ZXh0LndpbmRvd19rZXkgfHwgJycgKTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIHdpbmRvd19rZXlcblx0XHRcdFx0fHwgISByZXNvdXJjZV9pZHMubGVuZ3RoXG5cdFx0XHRcdHx8ICEgd2luZG93X2NvbnRleHQucmVzb3VyY2VfZmluZ2VycHJpbnRcblx0XHRcdFx0fHwgISB0aW1lbGluZV93aW5kb3cuc3RhcnRfYXRcblx0XHRcdFx0fHwgISB0aW1lbGluZV93aW5kb3cuZW5kX2F0XG5cdFx0XHRcdHx8ICEgdGltZWxpbmVfd2luZG93LnZpZXdcblx0XHRcdFx0fHwgISB0aW1lbGluZV93aW5kb3cudGltZXpvbmVcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0d2luZG93X2tleTogd2luZG93X2tleSxcblx0XHRcdFx0cmVzb3VyY2VfZmluZ2VycHJpbnQ6IFN0cmluZyggd2luZG93X2NvbnRleHQucmVzb3VyY2VfZmluZ2VycHJpbnQgKSxcblx0XHRcdFx0cmVzb3VyY2VfaWRzOiByZXNvdXJjZV9pZHMsXG5cdFx0XHRcdHN0YXJ0X2F0OiBTdHJpbmcoIHRpbWVsaW5lX3dpbmRvdy5zdGFydF9hdCApLFxuXHRcdFx0XHRlbmRfYXQ6IFN0cmluZyggdGltZWxpbmVfd2luZG93LmVuZF9hdCApLFxuXHRcdFx0XHR2aWV3OiBTdHJpbmcoIHRpbWVsaW5lX3dpbmRvdy52aWV3ICksXG5cdFx0XHRcdGNlbGxfbWludXRlczogTnVtYmVyKCB0aW1lbGluZV93aW5kb3cuY2VsbF9taW51dGVzIHx8IGF4aXMuY2VsbF9taW51dGVzIHx8IDAgKSxcblx0XHRcdFx0dGltZXpvbmU6IFN0cmluZyggdGltZWxpbmVfd2luZG93LnRpbWV6b25lIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzdGFibGUgc2NhbGFyIHNpZ25hdHVyZSBmb3Igb25lIGJvb2tpbmcgaWRlbnRpdHkuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gaWRlbnRpdHkgRXhhY3QgYm9va2luZy13aW5kb3cgaWRlbnRpdHkuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTdGFibGUgaWRlbnRpdHkgc2lnbmF0dXJlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9ib29raW5nX2lkZW50aXR5X3NpZ25hdHVyZSggaWRlbnRpdHkgKSB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRpZGVudGl0eS53aW5kb3dfa2V5LFxuXHRcdFx0XHRpZGVudGl0eS5yZXNvdXJjZV9maW5nZXJwcmludCxcblx0XHRcdFx0aWRlbnRpdHkucmVzb3VyY2VfaWRzLmpvaW4oICcsJyApLFxuXHRcdFx0XHRpZGVudGl0eS5zdGFydF9hdCxcblx0XHRcdFx0aWRlbnRpdHkuZW5kX2F0LFxuXHRcdFx0XHRpZGVudGl0eS52aWV3LFxuXHRcdFx0XHRpZGVudGl0eS5jZWxsX21pbnV0ZXMsXG5cdFx0XHRcdGlkZW50aXR5LnRpbWV6b25lXG5cdFx0XHRdLmpvaW4oICd8JyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsZWFyIGV2ZXJ5IGluZGV4IGFuZCBwcm9qZWN0ZWQgcmVzdWx0IGFmdGVyIGF1dGhvcml0YXRpdmUgaWRlbnRpdHkgZHJpZnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGludmFsaWRhdGVfbG9jYWxfY2FjaGVzKCkge1xuXHRcdFx0cmVzb3VyY2Vfd2luZG93X2luZGV4ZXMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRwcm9qZWN0aW9uX2NhY2hlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdFx0cHJvamVjdGVkX3Jlc291cmNlcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYWNjZXB0ZWQgZW50cmllcyBrZXllZCBieSB0aGVpciBuYXRpdmUgd2luZG93IGlkZW50aXR5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBlbnRyaWVzIEFjY2VwdGVkIGJvb2tpbmcgb3IgQXZhaWxhYmlsaXR5IGVudHJpZXMuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0PHN0cmluZyxPYmplY3Q+fSBFbnRyeSByZWZlcmVuY2VzIGtleWVkIGJ5IHdpbmRvdyBrZXkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5kZXhfZW50cmllc19ieV93aW5kb3dfa2V5KCBlbnRyaWVzICkge1xuXHRcdFx0dmFyIGluZGV4ZWRfZW50cmllcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblxuXHRcdFx0KCBBcnJheS5pc0FycmF5KCBlbnRyaWVzICkgPyBlbnRyaWVzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGVudHJ5ICkge1xuXHRcdFx0XHR2YXIgd2luZG93X2tleSA9IFN0cmluZyggZW50cnkgJiYgKCBlbnRyeS5rZXkgfHwgZW50cnkud2luZG93X2tleSApIHx8ICcnICk7XG5cblx0XHRcdFx0aWYgKCB3aW5kb3dfa2V5ICkge1xuXHRcdFx0XHRcdGluZGV4ZWRfZW50cmllc1sgd2luZG93X2tleSBdID0gZW50cnk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIGluZGV4ZWRfZW50cmllcztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBFdmljdCBsb2NhbCBzdGF0ZSBvd25lZCBieSBvbmUgbmF0aXZlIGJvdW5kZWQgd2luZG93LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHdpbmRvd19rZXkgTmF0aXZlIGJvb2tpbmctd2luZG93IGtleS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGV2aWN0X3dpbmRvd19sb2NhbF9zdGF0ZSggd2luZG93X2tleSApIHtcblx0XHRcdHZhciBjYWNoZV9rZXlfcHJlZml4ID0gU3RyaW5nKCB3aW5kb3dfa2V5IHx8ICcnICkgKyAnfCc7XG5cblx0XHRcdE9iamVjdC5rZXlzKCByZXNvdXJjZV93aW5kb3dfaW5kZXhlcyApLmZvckVhY2goIGZ1bmN0aW9uICggY2FjaGVfa2V5ICkge1xuXHRcdFx0XHRpZiAoIDAgPT09IGNhY2hlX2tleS5pbmRleE9mKCBjYWNoZV9rZXlfcHJlZml4ICkgKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHJlc291cmNlX3dpbmRvd19pbmRleGVzWyBjYWNoZV9rZXkgXTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0ZGVsZXRlIHByb2plY3Rpb25fY2FjaGVbIFN0cmluZyggd2luZG93X2tleSB8fCAnJyApIF07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW52YWxpZGF0ZSBjb21wb3NlZCBwcm9qZWN0aW9ucyB3aGlsZSByZXRhaW5pbmcgcmV1c2FibGUgd2luZG93IGluZGV4ZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGludmFsaWRhdGVfY29tcG9zZWRfcHJvamVjdGlvbnMoKSB7XG5cdFx0XHRwcm9qZWN0ZWRfcmVzb3VyY2VzID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsb3NlIGxvY2FsIHN0YXRlIGZvciBSZXNvdXJjZXMgYWJzZW50IGZyb20gdGhlIGF1dGhvcml0YXRpdmUgcmVwbGFjZW1lbnQuXG5cdFx0ICpcblx0XHQgKiBTaGFyZWQgcmVuZGVyaW5nIHJlbW92ZXMgdGhlIGNvcnJlc3BvbmRpbmcgaG9zdHMuIFRoaXMgYWRhcHRlciBwZXJmb3JtcyB0aGVcblx0XHQgKiBzYW1lIGF1dGhvcml6YXRpb24gcmVjb25jaWxpYXRpb24gaW1tZWRpYXRlbHkgc28gYSBkZXRhY2hlZCBsaWZlY3ljbGUgZXZlbnRcblx0XHQgKiBjYW5ub3QgbGVhdmUgYW4gb3BlbiBwcm9qZWN0aW9uIGluIG1lbW9yeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0PHN0cmluZyxPYmplY3Q+fSBuZXh0X2lkZW50aXRpZXMgQWNjZXB0ZWQgYm9va2luZyBpZGVudGl0aWVzLlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PG51bWJlcj59IFJlc291cmNlIElEcyByZW1vdmVkIGZyb20gbG9jYWwgb3BlbiBzdGF0ZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWNvbmNpbGVfYXV0aG9yaXplZF9vcGVuX3Jlc291cmNlcyggbmV4dF9pZGVudGl0aWVzICkge1xuXHRcdFx0dmFyIGlkZW50aXR5X2tleXMgPSBPYmplY3Qua2V5cyggbmV4dF9pZGVudGl0aWVzICk7XG5cdFx0XHR2YXIgYXV0aG9yaXplZF9yZXNvdXJjZV9pZHMgPSBpZGVudGl0eV9rZXlzLmxlbmd0aCA/IG5leHRfaWRlbnRpdGllc1sgaWRlbnRpdHlfa2V5c1sgMCBdIF0ucmVzb3VyY2VfaWRzIDogW107XG5cdFx0XHR2YXIgcmVtb3ZlZF9yZXNvdXJjZV9pZHMgPSBbXTtcblxuXHRcdFx0T2JqZWN0LmtleXMoIG9wZW5fcmVzb3VyY2VfaWRzICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmVzb3VyY2VfaWQgPSBOdW1iZXIoIHJlc291cmNlX2lkICk7XG5cdFx0XHRcdGlmICggLTEgIT09IGF1dGhvcml6ZWRfcmVzb3VyY2VfaWRzLmluZGV4T2YoIHJlc291cmNlX2lkICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRlbGV0ZSBvcGVuX3Jlc291cmNlX2lkc1sgcmVzb3VyY2VfaWQgXTtcblx0XHRcdFx0cmVtb3ZlX3Jlc291cmNlX2xvY2FsX3N0YXRlKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0XHRyZW1vdmVkX3Jlc291cmNlX2lkcy5wdXNoKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gcmVtb3ZlZF9yZXNvdXJjZV9pZHM7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWNjZXB0IG9uZSBhdXRob3JpdGF0aXZlIGJvdW5kZWQgYm9va2luZy1jYWNoZSBub3RpZmljYXRpb24uXG5cdFx0ICpcblx0XHQgKiBUaGUgYWRhcHRlciByZXRhaW5zIHRoZSBzdXBwbGllZCB3aW5kb3cgYXJyYXkgYW5kIHBheWxvYWQgcmVmZXJlbmNlcy4gSXRcblx0XHQgKiBkb2VzIG5vdCBjbG9uZSBjb21wbGV0ZSByZXNwb25zZXMgb3Igbm9ybWFsaXplIGJvb2tpbmcvYXhpcyBEVE8gY29udGVudHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZGV0YWlsIEFjY2VwdGVkIGJvb2tpbmctd2luZG93IGV2ZW50IGRldGFpbC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGV4YWN0IGlkZW50aXR5IHdhcyBhY2NlcHRlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhY2NlcHRfYm9va2luZ193aW5kb3dzKCBkZXRhaWwgKSB7XG5cdFx0XHR2YXIgd2luZG93cyA9IGRldGFpbCAmJiBBcnJheS5pc0FycmF5KCBkZXRhaWwud2luZG93cyApID8gZGV0YWlsLndpbmRvd3MgOiBbXTtcblx0XHRcdHZhciBnZW5lcmF0aW9uID0gTnVtYmVyKCBkZXRhaWwgJiYgZGV0YWlsLmdlbmVyYXRpb24gKTtcblx0XHRcdHZhciBuZXh0X2lkZW50aXRpZXMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR2YXIgcHJldmlvdXNfZW50cmllc19ieV9rZXkgPSBpbmRleF9lbnRyaWVzX2J5X3dpbmRvd19rZXkoIGFjY2VwdGVkX2Jvb2tpbmdfd2luZG93cyApO1xuXHRcdFx0dmFyIG5leHRfZW50cmllc19ieV9rZXk7XG5cdFx0XHR2YXIgc2lnbmF0dXJlcyA9IFtdO1xuXHRcdFx0dmFyIG5leHRfc2lnbmF0dXJlO1xuXHRcdFx0dmFyIGNoYW5nZWRfd2luZG93X2tleXMgPSBbXTtcblx0XHRcdHZhciByZW1vdmVkX3dpbmRvd19rZXlzID0gW107XG5cdFx0XHR2YXIgcmV0YWluZWRfYXZhaWxhYmlsaXR5X3dpbmRvd3M7XG5cdFx0XHR2YXIgcmVtb3ZlZF9yZXNvdXJjZV9pZHM7XG5cdFx0XHR2YXIgY3VycmVudF93aW5kb3dfZm91bmQgPSBmYWxzZTtcblx0XHRcdHZhciB2YWxpZCA9IDEgPT09IE51bWJlciggZGV0YWlsICYmIGRldGFpbC5zY2hlbWFfdmVyc2lvbiApXG5cdFx0XHRcdCYmIE51bWJlci5pc0ludGVnZXIoIGdlbmVyYXRpb24gKVxuXHRcdFx0XHQmJiBnZW5lcmF0aW9uID4gYm9va2luZ19nZW5lcmF0aW9uXG5cdFx0XHRcdCYmIDAgPCB3aW5kb3dzLmxlbmd0aFxuXHRcdFx0XHQmJiB3aW5kb3dzLmxlbmd0aCA8PSBtYXhpbXVtX2NhY2hlZF93aW5kb3dzO1xuXG5cdFx0XHR3aW5kb3dzLmZvckVhY2goIGZ1bmN0aW9uICggd2luZG93X2VudHJ5ICkge1xuXHRcdFx0XHR2YXIgaWRlbnRpdHkgPSBidWlsZF9ib29raW5nX2lkZW50aXR5KCB3aW5kb3dfZW50cnkgKTtcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0ISBpZGVudGl0eVxuXHRcdFx0XHRcdHx8IGlkZW50aXR5LnJlc291cmNlX2ZpbmdlcnByaW50ICE9PSBTdHJpbmcoIGRldGFpbC5yZXNvdXJjZV9maW5nZXJwcmludCB8fCAnJyApXG5cdFx0XHRcdFx0fHwgaWRlbnRpdHkudGltZXpvbmUgIT09IFN0cmluZyggZGV0YWlsLnRpbWV6b25lIHx8ICcnIClcblx0XHRcdFx0XHR8fCBuZXh0X2lkZW50aXRpZXNbIGlkZW50aXR5LndpbmRvd19rZXkgXVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHR2YWxpZCA9IGZhbHNlO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRuZXh0X2lkZW50aXRpZXNbIGlkZW50aXR5LndpbmRvd19rZXkgXSA9IGlkZW50aXR5O1xuXHRcdFx0XHRzaWduYXR1cmVzLnB1c2goIGdldF9ib29raW5nX2lkZW50aXR5X3NpZ25hdHVyZSggaWRlbnRpdHkgKSApO1xuXHRcdFx0XHRpZiAoIGlkZW50aXR5LndpbmRvd19rZXkgPT09IFN0cmluZyggZGV0YWlsLmN1cnJlbnRfd2luZG93X2tleSB8fCAnJyApICkge1xuXHRcdFx0XHRcdGN1cnJlbnRfd2luZG93X2ZvdW5kID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCAhIHZhbGlkIHx8ICEgY3VycmVudF93aW5kb3dfZm91bmQgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0c2lnbmF0dXJlcy5zb3J0KCk7XG5cdFx0XHRuZXh0X3NpZ25hdHVyZSA9IHNpZ25hdHVyZXMuam9pbiggJ3x8JyApO1xuXHRcdFx0bmV4dF9lbnRyaWVzX2J5X2tleSA9IGluZGV4X2VudHJpZXNfYnlfd2luZG93X2tleSggd2luZG93cyApO1xuXHRcdFx0T2JqZWN0LmtleXMoIG5leHRfZW50cmllc19ieV9rZXkgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHdpbmRvd19rZXkgKSB7XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHQhIHByZXZpb3VzX2VudHJpZXNfYnlfa2V5WyB3aW5kb3dfa2V5IF1cblx0XHRcdFx0XHR8fCBwcmV2aW91c19lbnRyaWVzX2J5X2tleVsgd2luZG93X2tleSBdLnBheWxvYWQgIT09IG5leHRfZW50cmllc19ieV9rZXlbIHdpbmRvd19rZXkgXS5wYXlsb2FkXG5cdFx0XHRcdFx0fHwgISBib29raW5nX2lkZW50aXRpZXNfYnlfa2V5WyB3aW5kb3dfa2V5IF1cblx0XHRcdFx0XHR8fCBnZXRfYm9va2luZ19pZGVudGl0eV9zaWduYXR1cmUoIGJvb2tpbmdfaWRlbnRpdGllc19ieV9rZXlbIHdpbmRvd19rZXkgXSApICE9PSBnZXRfYm9va2luZ19pZGVudGl0eV9zaWduYXR1cmUoIG5leHRfaWRlbnRpdGllc1sgd2luZG93X2tleSBdIClcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0Y2hhbmdlZF93aW5kb3dfa2V5cy5wdXNoKCB3aW5kb3dfa2V5ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdE9iamVjdC5rZXlzKCBwcmV2aW91c19lbnRyaWVzX2J5X2tleSApLmZvckVhY2goIGZ1bmN0aW9uICggd2luZG93X2tleSApIHtcblx0XHRcdFx0aWYgKCAhIG5leHRfZW50cmllc19ieV9rZXlbIHdpbmRvd19rZXkgXSApIHtcblx0XHRcdFx0XHRyZW1vdmVkX3dpbmRvd19rZXlzLnB1c2goIHdpbmRvd19rZXkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0Y2hhbmdlZF93aW5kb3dfa2V5cy5jb25jYXQoIHJlbW92ZWRfd2luZG93X2tleXMgKS5mb3JFYWNoKCBldmljdF93aW5kb3dfbG9jYWxfc3RhdGUgKTtcblx0XHRcdGlmICggY2hhbmdlZF93aW5kb3dfa2V5cy5sZW5ndGggfHwgcmVtb3ZlZF93aW5kb3dfa2V5cy5sZW5ndGggfHwgYm9va2luZ19pZGVudGl0eV9zaWduYXR1cmUgIT09IG5leHRfc2lnbmF0dXJlICkge1xuXHRcdFx0XHRib29raW5nX3Byb2plY3Rpb25fcmV2aXNpb24gKz0gMTtcblx0XHRcdFx0aW52YWxpZGF0ZV9jb21wb3NlZF9wcm9qZWN0aW9ucygpO1xuXHRcdFx0fVxuXHRcdFx0cmV0YWluZWRfYXZhaWxhYmlsaXR5X3dpbmRvd3MgPSBhY2NlcHRlZF9hdmFpbGFiaWxpdHlfd2luZG93cy5maWx0ZXIoIGZ1bmN0aW9uICggYXZhaWxhYmlsaXR5X2VudHJ5ICkge1xuXHRcdFx0XHR2YXIgd2luZG93X2tleSA9IFN0cmluZyggYXZhaWxhYmlsaXR5X2VudHJ5ICYmIGF2YWlsYWJpbGl0eV9lbnRyeS53aW5kb3dfa2V5IHx8ICcnICk7XG5cdFx0XHRcdHZhciBwcmV2aW91c19pZGVudGl0eSA9IGJvb2tpbmdfaWRlbnRpdGllc19ieV9rZXlbIHdpbmRvd19rZXkgXTtcblx0XHRcdFx0dmFyIG5leHRfaWRlbnRpdHkgPSBuZXh0X2lkZW50aXRpZXNbIHdpbmRvd19rZXkgXTtcblxuXHRcdFx0XHRyZXR1cm4gQm9vbGVhbihcblx0XHRcdFx0XHRuZXh0X2VudHJpZXNfYnlfa2V5WyB3aW5kb3dfa2V5IF1cblx0XHRcdFx0XHQmJiBwcmV2aW91c19pZGVudGl0eVxuXHRcdFx0XHRcdCYmIG5leHRfaWRlbnRpdHlcblx0XHRcdFx0XHQmJiBnZXRfYm9va2luZ19pZGVudGl0eV9zaWduYXR1cmUoIHByZXZpb3VzX2lkZW50aXR5ICkgPT09IGdldF9ib29raW5nX2lkZW50aXR5X3NpZ25hdHVyZSggbmV4dF9pZGVudGl0eSApXG5cdFx0XHRcdCk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIHJldGFpbmVkX2F2YWlsYWJpbGl0eV93aW5kb3dzLmxlbmd0aCAhPT0gYWNjZXB0ZWRfYXZhaWxhYmlsaXR5X3dpbmRvd3MubGVuZ3RoICkge1xuXHRcdFx0XHRhY2NlcHRlZF9hdmFpbGFiaWxpdHlfd2luZG93cyA9IHJldGFpbmVkX2F2YWlsYWJpbGl0eV93aW5kb3dzO1xuXHRcdFx0XHRhdmFpbGFiaWxpdHlfaWRlbnRpdHlfc2lnbmF0dXJlID0gcmV0YWluZWRfYXZhaWxhYmlsaXR5X3dpbmRvd3MubWFwKCBmdW5jdGlvbiAoIGF2YWlsYWJpbGl0eV9lbnRyeSApIHtcblx0XHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBhdmFpbGFiaWxpdHlfZW50cnkuY2FjaGVfa2V5IHx8ICcnICk7XG5cdFx0XHRcdH0gKS5zb3J0KCkuam9pbiggJ3x8JyApO1xuXHRcdFx0XHRhdmFpbGFiaWxpdHlfcHJvamVjdGlvbl9yZXZpc2lvbiArPSAxO1xuXHRcdFx0XHRhdmFpbGFiaWxpdHlfc3RhdGUgPSAnbG9hZGluZyc7XG5cdFx0XHR9XG5cdFx0XHRhY2NlcHRlZF9ib29raW5nX3dpbmRvd3MgPSB3aW5kb3dzO1xuXHRcdFx0Ym9va2luZ19pZGVudGl0aWVzX2J5X2tleSA9IG5leHRfaWRlbnRpdGllcztcblx0XHRcdGJvb2tpbmdfaWRlbnRpdHlfc2lnbmF0dXJlID0gbmV4dF9zaWduYXR1cmU7XG5cdFx0XHRib29raW5nX2dlbmVyYXRpb24gPSBnZW5lcmF0aW9uO1xuXHRcdFx0cmVtb3ZlZF9yZXNvdXJjZV9pZHMgPSByZWNvbmNpbGVfYXV0aG9yaXplZF9vcGVuX3Jlc291cmNlcyggbmV4dF9pZGVudGl0aWVzICk7XG5cdFx0XHRsYXN0X2Jvb2tpbmdfdHJhbnNpdGlvbiA9IHtcblx0XHRcdFx0Y2hhbmdlZF93aW5kb3dfa2V5czogY2hhbmdlZF93aW5kb3dfa2V5cy5zbGljZSgpLFxuXHRcdFx0XHRyZW1vdmVkX3dpbmRvd19rZXlzOiByZW1vdmVkX3dpbmRvd19rZXlzLnNsaWNlKCksXG5cdFx0XHRcdHJlbW92ZWRfcmVzb3VyY2VfaWRzOiByZW1vdmVkX3Jlc291cmNlX2lkcyxcblx0XHRcdFx0aGFzX3Byb2plY3Rpb25fY2hhbmdlOiBCb29sZWFuKCBjaGFuZ2VkX3dpbmRvd19rZXlzLmxlbmd0aCB8fCByZW1vdmVkX3dpbmRvd19rZXlzLmxlbmd0aCApXG5cdFx0XHR9O1xuXHRcdFx0c3luY2hyb25pemVfYWNjZXB0ZWRfcmVzb3VyY2VfcHJlZmVyZW5jZXMoKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVmVyaWZ5IG9uZSBhY2NlcHRlZCBBdmFpbGFiaWxpdHkgY2FjaGUgZW50cnkgYWdhaW5zdCBpdHMgYm9va2luZyB3aW5kb3cuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYXZhaWxhYmlsaXR5X2VudHJ5IE5hdGl2ZSBBdmFpbGFiaWxpdHkgY2FjaGUgZW50cnkuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIFJlc291cmNlL3dpbmRvdy90aW1lem9uZSBpZGVudGl0eSBtYXRjaGVzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGF2YWlsYWJpbGl0eV9lbnRyeV9tYXRjaGVzX2Jvb2tpbmcoIGF2YWlsYWJpbGl0eV9lbnRyeSApIHtcblx0XHRcdHZhciBpZGVudGl0eSA9IGJvb2tpbmdfaWRlbnRpdGllc19ieV9rZXlbIFN0cmluZyggYXZhaWxhYmlsaXR5X2VudHJ5ICYmIGF2YWlsYWJpbGl0eV9lbnRyeS53aW5kb3dfa2V5IHx8ICcnICkgXTtcblx0XHRcdHZhciBwYXlsb2FkID0gYXZhaWxhYmlsaXR5X2VudHJ5ICYmIGF2YWlsYWJpbGl0eV9lbnRyeS5wYXlsb2FkID8gYXZhaWxhYmlsaXR5X2VudHJ5LnBheWxvYWQgOiB7fTtcblx0XHRcdHZhciByZXNwb25zZV93aW5kb3cgPSBwYXlsb2FkLndpbmRvdyB8fCB7fTtcblx0XHRcdHZhciByZXNvdXJjZV9pZHMgPSBub3JtYWxpemVfcmVzb3VyY2VfaWRzKCBwYXlsb2FkLnJlc291cmNlX2lkcyApO1xuXG5cdFx0XHRyZXR1cm4gQm9vbGVhbihcblx0XHRcdFx0aWRlbnRpdHlcblx0XHRcdFx0JiYgaWRlbnRpdHkucmVzb3VyY2VfaWRzLmpvaW4oICcsJyApID09PSByZXNvdXJjZV9pZHMuam9pbiggJywnIClcblx0XHRcdFx0JiYgaWRlbnRpdHkuc3RhcnRfYXQgPT09IFN0cmluZyggcmVzcG9uc2Vfd2luZG93LnN0YXJ0X2F0IHx8ICcnIClcblx0XHRcdFx0JiYgaWRlbnRpdHkuZW5kX2F0ID09PSBTdHJpbmcoIHJlc3BvbnNlX3dpbmRvdy5lbmRfYXQgfHwgJycgKVxuXHRcdFx0XHQmJiBpZGVudGl0eS52aWV3ID09PSBTdHJpbmcoIHJlc3BvbnNlX3dpbmRvdy52aWV3IHx8ICcnIClcblx0XHRcdFx0JiYgaWRlbnRpdHkuY2VsbF9taW51dGVzID09PSBOdW1iZXIoIHJlc3BvbnNlX3dpbmRvdy5jZWxsX21pbnV0ZXMgfHwgMCApXG5cdFx0XHRcdCYmIGlkZW50aXR5LnRpbWV6b25lID09PSBTdHJpbmcoIHJlc3BvbnNlX3dpbmRvdy50aW1lem9uZSB8fCAnJyApXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFjY2VwdCBBdmFpbGFiaWxpdHkgRFRPIHJlZmVyZW5jZXMgbWF0Y2hpbmcgdGhlIGN1cnJlbnQgYm9va2luZyBpZGVudGl0aWVzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRldGFpbCBBY2NlcHRlZCBBdmFpbGFiaWxpdHkgZXZlbnQgZGV0YWlsLlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgbm90aWZpY2F0aW9uIHdhcyBjdXJyZW50IGFuZCB2YWxpZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhY2NlcHRfYXZhaWxhYmlsaXR5KCBkZXRhaWwgKSB7XG5cdFx0XHR2YXIgZ2VuZXJhdGlvbiA9IE51bWJlciggZGV0YWlsICYmIGRldGFpbC5nZW5lcmF0aW9uICk7XG5cdFx0XHR2YXIgY2FjaGVkX3dpbmRvd3MgPSBkZXRhaWwgJiYgQXJyYXkuaXNBcnJheSggZGV0YWlsLmNhY2hlZF93aW5kb3dzICkgPyBkZXRhaWwuY2FjaGVkX3dpbmRvd3MgOiBbXTtcblx0XHRcdHZhciBwcmV2aW91c19lbnRyaWVzX2J5X2tleSA9IGluZGV4X2VudHJpZXNfYnlfd2luZG93X2tleSggYWNjZXB0ZWRfYXZhaWxhYmlsaXR5X3dpbmRvd3MgKTtcblx0XHRcdHZhciBuZXh0X2VudHJpZXNfYnlfa2V5O1xuXHRcdFx0dmFyIGFjY2VwdGVkX3dpbmRvd3MgPSBbXTtcblx0XHRcdHZhciBzaWduYXR1cmVzID0gW107XG5cdFx0XHR2YXIgY2hhbmdlZF93aW5kb3dfa2V5cyA9IFtdO1xuXHRcdFx0dmFyIG5leHRfYXZhaWxhYmlsaXR5X3N0YXRlO1xuXHRcdFx0dmFyIG5leHRfc2lnbmF0dXJlO1xuXHRcdFx0dmFyIGhhc19wcm9qZWN0aW9uX2NoYW5nZTtcblx0XHRcdHZhciBhZmZlY3RlZF9yZXNvdXJjZV9pZHMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR2YXIgaWRlbnRpdGllc19tYXRjaCA9IHRydWU7XG5cblx0XHRcdGlmIChcblx0XHRcdFx0MSAhPT0gTnVtYmVyKCBkZXRhaWwgJiYgZGV0YWlsLnNjaGVtYV92ZXJzaW9uIClcblx0XHRcdFx0fHwgISBOdW1iZXIuaXNJbnRlZ2VyKCBnZW5lcmF0aW9uIClcblx0XHRcdFx0fHwgZ2VuZXJhdGlvbiA8PSBhdmFpbGFiaWxpdHlfZ2VuZXJhdGlvblxuXHRcdFx0XHR8fCBjYWNoZWRfd2luZG93cy5sZW5ndGggPiBtYXhpbXVtX2NhY2hlZF93aW5kb3dzXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnbG9hZGVkJyA9PT0gZGV0YWlsLnN0YXRlICYmIGRldGFpbC5wYXlsb2FkICkge1xuXHRcdFx0XHRpZiAoICEgYXZhaWxhYmlsaXR5X2VudHJ5X21hdGNoZXNfYm9va2luZygge1xuXHRcdFx0XHRcdHdpbmRvd19rZXk6IGRldGFpbC53aW5kb3dfa2V5LFxuXHRcdFx0XHRcdHBheWxvYWQ6IGRldGFpbC5wYXlsb2FkXG5cdFx0XHRcdH0gKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y2FjaGVkX3dpbmRvd3MuZm9yRWFjaCggZnVuY3Rpb24gKCBhdmFpbGFiaWxpdHlfZW50cnkgKSB7XG5cdFx0XHRcdGlmICggISBhdmFpbGFiaWxpdHlfZW50cnlfbWF0Y2hlc19ib29raW5nKCBhdmFpbGFiaWxpdHlfZW50cnkgKSApIHtcblx0XHRcdFx0XHRpZGVudGl0aWVzX21hdGNoID0gZmFsc2U7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjY2VwdGVkX3dpbmRvd3MucHVzaCggYXZhaWxhYmlsaXR5X2VudHJ5ICk7XG5cdFx0XHRcdHNpZ25hdHVyZXMucHVzaCggU3RyaW5nKCBhdmFpbGFiaWxpdHlfZW50cnkuY2FjaGVfa2V5IHx8ICcnICkgKTtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBpZGVudGl0aWVzX21hdGNoICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRzaWduYXR1cmVzLnNvcnQoKTtcblx0XHRcdG5leHRfc2lnbmF0dXJlID0gc2lnbmF0dXJlcy5qb2luKCAnfHwnICk7XG5cdFx0XHRuZXh0X2VudHJpZXNfYnlfa2V5ID0gaW5kZXhfZW50cmllc19ieV93aW5kb3dfa2V5KCBhY2NlcHRlZF93aW5kb3dzICk7XG5cdFx0XHRPYmplY3Qua2V5cyggcHJldmlvdXNfZW50cmllc19ieV9rZXkgKS5jb25jYXQoIE9iamVjdC5rZXlzKCBuZXh0X2VudHJpZXNfYnlfa2V5ICkgKS5maWx0ZXIoIGZ1bmN0aW9uICggd2luZG93X2tleSwgd2luZG93X2luZGV4LCBhbGxfa2V5cyApIHtcblx0XHRcdFx0cmV0dXJuIGFsbF9rZXlzLmluZGV4T2YoIHdpbmRvd19rZXkgKSA9PT0gd2luZG93X2luZGV4O1xuXHRcdFx0fSApLmZvckVhY2goIGZ1bmN0aW9uICggd2luZG93X2tleSApIHtcblx0XHRcdFx0dmFyIHByZXZpb3VzX2VudHJ5ID0gcHJldmlvdXNfZW50cmllc19ieV9rZXlbIHdpbmRvd19rZXkgXTtcblx0XHRcdFx0dmFyIG5leHRfZW50cnkgPSBuZXh0X2VudHJpZXNfYnlfa2V5WyB3aW5kb3dfa2V5IF07XG5cblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdCEgcHJldmlvdXNfZW50cnlcblx0XHRcdFx0XHR8fCAhIG5leHRfZW50cnlcblx0XHRcdFx0XHR8fCBTdHJpbmcoIHByZXZpb3VzX2VudHJ5LmNhY2hlX2tleSB8fCAnJyApICE9PSBTdHJpbmcoIG5leHRfZW50cnkuY2FjaGVfa2V5IHx8ICcnIClcblx0XHRcdFx0XHR8fCBwcmV2aW91c19lbnRyeS5wYXlsb2FkICE9PSBuZXh0X2VudHJ5LnBheWxvYWRcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0Y2hhbmdlZF93aW5kb3dfa2V5cy5wdXNoKCB3aW5kb3dfa2V5ICk7XG5cdFx0XHRcdFx0bm9ybWFsaXplX3Jlc291cmNlX2lkcyggcHJldmlvdXNfZW50cnkgJiYgcHJldmlvdXNfZW50cnkucGF5bG9hZCAmJiBwcmV2aW91c19lbnRyeS5wYXlsb2FkLnJlc291cmNlX2lkcyApLmNvbmNhdChcblx0XHRcdFx0XHRcdG5vcm1hbGl6ZV9yZXNvdXJjZV9pZHMoIG5leHRfZW50cnkgJiYgbmV4dF9lbnRyeS5wYXlsb2FkICYmIG5leHRfZW50cnkucGF5bG9hZC5yZXNvdXJjZV9pZHMgKVxuXHRcdFx0XHRcdCkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRcdGFmZmVjdGVkX3Jlc291cmNlX2lkc1sgcmVzb3VyY2VfaWQgXSA9IHRydWU7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRuZXh0X2F2YWlsYWJpbGl0eV9zdGF0ZSA9ICdpbnZhbGlkYXRlZCcgPT09IFN0cmluZyggZGV0YWlsLnN0YXRlIHx8ICcnIClcblx0XHRcdFx0PyAnbG9hZGluZydcblx0XHRcdFx0OiAoICduZXV0cmFsJyA9PT0gU3RyaW5nKCBkZXRhaWwuc3RhdGUgfHwgJycgKSA/ICdmYWlsZWQnIDogJ2xvYWRlZCcgKTtcblx0XHRcdGlmICggJ2xvYWRlZCcgPT09IG5leHRfYXZhaWxhYmlsaXR5X3N0YXRlICkge1xuXHRcdFx0XHRpZiAoIGFjY2VwdGVkX3dpbmRvd3Muc29tZSggZnVuY3Rpb24gKCBhdmFpbGFiaWxpdHlfZW50cnkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuICdwYXJ0aWFsJyA9PT0gU3RyaW5nKCBhdmFpbGFiaWxpdHlfZW50cnkgJiYgYXZhaWxhYmlsaXR5X2VudHJ5LnBheWxvYWQgJiYgYXZhaWxhYmlsaXR5X2VudHJ5LnBheWxvYWQubG9hZF9zdGF0ZSB8fCAnJyApO1xuXHRcdFx0XHR9ICkgKSB7XG5cdFx0XHRcdFx0bmV4dF9hdmFpbGFiaWxpdHlfc3RhdGUgPSAncGFydGlhbCc7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIGFjY2VwdGVkX3dpbmRvd3MubGVuZ3RoIDwgYWNjZXB0ZWRfYm9va2luZ193aW5kb3dzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRuZXh0X2F2YWlsYWJpbGl0eV9zdGF0ZSA9ICdsb2FkaW5nJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2hhbmdlZF93aW5kb3dfa2V5cy5mb3JFYWNoKCBldmljdF93aW5kb3dfbG9jYWxfc3RhdGUgKTtcblx0XHRcdGhhc19wcm9qZWN0aW9uX2NoYW5nZSA9IEJvb2xlYW4oXG5cdFx0XHRcdGNoYW5nZWRfd2luZG93X2tleXMubGVuZ3RoXG5cdFx0XHRcdHx8IGF2YWlsYWJpbGl0eV9pZGVudGl0eV9zaWduYXR1cmUgIT09IG5leHRfc2lnbmF0dXJlXG5cdFx0XHRcdHx8IGF2YWlsYWJpbGl0eV9zdGF0ZSAhPT0gbmV4dF9hdmFpbGFiaWxpdHlfc3RhdGVcblx0XHRcdCk7XG5cdFx0XHRpZiAoIGF2YWlsYWJpbGl0eV9zdGF0ZSAhPT0gbmV4dF9hdmFpbGFiaWxpdHlfc3RhdGUgKSB7XG5cdFx0XHRcdE9iamVjdC5rZXlzKCBib29raW5nX2lkZW50aXRpZXNfYnlfa2V5ICkuZm9yRWFjaCggZnVuY3Rpb24gKCB3aW5kb3dfa2V5ICkge1xuXHRcdFx0XHRcdGJvb2tpbmdfaWRlbnRpdGllc19ieV9rZXlbIHdpbmRvd19rZXkgXS5yZXNvdXJjZV9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRcdGFmZmVjdGVkX3Jlc291cmNlX2lkc1sgcmVzb3VyY2VfaWQgXSA9IHRydWU7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGhhc19wcm9qZWN0aW9uX2NoYW5nZSApIHtcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3Byb2plY3Rpb25fcmV2aXNpb24gKz0gMTtcblx0XHRcdFx0aW52YWxpZGF0ZV9jb21wb3NlZF9wcm9qZWN0aW9ucygpO1xuXHRcdFx0fVxuXHRcdFx0YWNjZXB0ZWRfYXZhaWxhYmlsaXR5X3dpbmRvd3MgPSBhY2NlcHRlZF93aW5kb3dzO1xuXHRcdFx0YXZhaWxhYmlsaXR5X2lkZW50aXR5X3NpZ25hdHVyZSA9IG5leHRfc2lnbmF0dXJlO1xuXHRcdFx0YXZhaWxhYmlsaXR5X2dlbmVyYXRpb24gPSBnZW5lcmF0aW9uO1xuXHRcdFx0YXZhaWxhYmlsaXR5X3N0YXRlID0gbmV4dF9hdmFpbGFiaWxpdHlfc3RhdGU7XG5cdFx0XHRsYXN0X2F2YWlsYWJpbGl0eV90cmFuc2l0aW9uID0ge1xuXHRcdFx0XHRjaGFuZ2VkX3dpbmRvd19rZXlzOiBjaGFuZ2VkX3dpbmRvd19rZXlzLnNsaWNlKCksXG5cdFx0XHRcdGFmZmVjdGVkX3Jlc291cmNlX2lkczogT2JqZWN0LmtleXMoIGFmZmVjdGVkX3Jlc291cmNlX2lkcyApLm1hcCggTnVtYmVyICksXG5cdFx0XHRcdGhhc19wcm9qZWN0aW9uX2NoYW5nZTogaGFzX3Byb2plY3Rpb25fY2hhbmdlXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gb25lIGFjY2VwdGVkIGJvb2tpbmctd2luZG93IGVudHJ5IGJ5IGV4YWN0IGtleS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB3aW5kb3dfa2V5IEFjY2VwdGVkIG5hdGl2ZSB3aW5kb3cga2V5LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBPcmlnaW5hbCBhY2NlcHRlZCBlbnRyeSByZWZlcmVuY2Ugb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYm9va2luZ193aW5kb3dfZW50cnkoIHdpbmRvd19rZXkgKSB7XG5cdFx0XHRyZXR1cm4gYWNjZXB0ZWRfYm9va2luZ193aW5kb3dzLmZpbHRlciggZnVuY3Rpb24gKCB3aW5kb3dfZW50cnkgKSB7XG5cdFx0XHRcdHJldHVybiBTdHJpbmcoIHdpbmRvd19lbnRyeSAmJiB3aW5kb3dfZW50cnkua2V5IHx8ICcnICkgPT09IFN0cmluZyggd2luZG93X2tleSB8fCAnJyApO1xuXHRcdFx0fSApWyAwIF0gfHwgbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gbWF0Y2hpbmcgYWNjZXB0ZWQgQXZhaWxhYmlsaXR5IGRhdGEgZm9yIG9uZSBuYXRpdmUgd2luZG93LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHdpbmRvd19rZXkgQWNjZXB0ZWQgbmF0aXZlIHdpbmRvdyBrZXkuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE9yaWdpbmFsIGFjY2VwdGVkIGNhY2hlIGVudHJ5IHJlZmVyZW5jZSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9hdmFpbGFiaWxpdHlfd2luZG93X2VudHJ5KCB3aW5kb3dfa2V5ICkge1xuXHRcdFx0cmV0dXJuIGFjY2VwdGVkX2F2YWlsYWJpbGl0eV93aW5kb3dzLmZpbHRlciggZnVuY3Rpb24gKCBhdmFpbGFiaWxpdHlfZW50cnkgKSB7XG5cdFx0XHRcdHJldHVybiBTdHJpbmcoIGF2YWlsYWJpbGl0eV9lbnRyeSAmJiBhdmFpbGFiaWxpdHlfZW50cnkud2luZG93X2tleSB8fCAnJyApID09PSBTdHJpbmcoIHdpbmRvd19rZXkgfHwgJycgKTtcblx0XHRcdH0gKVsgMCBdIHx8IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgb25lIFJlc291cmNlL3dpbmRvdyBpbmRleCBvbmx5IGZvciBhbiBvcGVuIHByZXNlbnRhdGlvbi5cblx0XHQgKlxuXHRcdCAqIFJldHVybmVkIHJlY29yZHMgcmV0YWluIHJlZmVyZW5jZXMgdG8gYWNjZXB0ZWQgUmVzb3VyY2UsIGJvb2tpbmcsIGF4aXMsXG5cdFx0ICogd2luZG93LCBhbmQgQXZhaWxhYmlsaXR5IERUT3MuIEZpbHRlcmluZyBjcmVhdGVzIGJvdW5kZWQgaW5kZXggYXJyYXlzIGJ1dFxuXHRcdCAqIG5ldmVyIGRlZXAtY2xvbmVzIGEgVGltZWxpbmUgcmVzcG9uc2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gd2luZG93X2tleSBBY2NlcHRlZCBuYXRpdmUgd2luZG93IGtleS5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTGF6eSBpbmRleCBvciBudWxsIGZvciBjbG9zZWQvbWlzbWF0Y2hlZCBzdGF0ZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcmVzb3VyY2Vfd2luZG93X2luZGV4KCByZXNvdXJjZV9pZCwgd2luZG93X2tleSApIHtcblx0XHRcdHZhciBjYWNoZV9rZXk7XG5cdFx0XHR2YXIgd2luZG93X2VudHJ5O1xuXHRcdFx0dmFyIGF2YWlsYWJpbGl0eV9lbnRyeTtcblx0XHRcdHZhciBhdmFpbGFiaWxpdHlfcGF5bG9hZDtcblx0XHRcdHZhciBwYXlsb2FkO1xuXHRcdFx0dmFyIHJlc291cmNlO1xuXG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgKTtcblx0XHRcdHdpbmRvd19rZXkgPSBTdHJpbmcoIHdpbmRvd19rZXkgfHwgJycgKTtcblx0XHRcdGlmICggISBvcGVuX3Jlc291cmNlX2lkc1sgcmVzb3VyY2VfaWQgXSB8fCAhIGJvb2tpbmdfaWRlbnRpdGllc19ieV9rZXlbIHdpbmRvd19rZXkgXSApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjYWNoZV9rZXkgPSB3aW5kb3dfa2V5ICsgJ3wnICsgcmVzb3VyY2VfaWQ7XG5cdFx0XHRpZiAoIHJlc291cmNlX3dpbmRvd19pbmRleGVzWyBjYWNoZV9rZXkgXSApIHtcblx0XHRcdFx0cmV0dXJuIHJlc291cmNlX3dpbmRvd19pbmRleGVzWyBjYWNoZV9rZXkgXTtcblx0XHRcdH1cblx0XHRcdHdpbmRvd19lbnRyeSA9IGdldF9ib29raW5nX3dpbmRvd19lbnRyeSggd2luZG93X2tleSApO1xuXHRcdFx0cGF5bG9hZCA9IHdpbmRvd19lbnRyeSA/IHdpbmRvd19lbnRyeS5wYXlsb2FkIDogbnVsbDtcblx0XHRcdHJlc291cmNlID0gcGF5bG9hZCAmJiBBcnJheS5pc0FycmF5KCBwYXlsb2FkLnJlc291cmNlcyApID8gcGF5bG9hZC5yZXNvdXJjZXMuZmlsdGVyKCBmdW5jdGlvbiAoIHJlc291cmNlX2R0byApIHtcblx0XHRcdFx0cmV0dXJuIE51bWJlciggcmVzb3VyY2VfZHRvICYmIHJlc291cmNlX2R0by5pZCApID09PSByZXNvdXJjZV9pZDtcblx0XHRcdH0gKVsgMCBdIDogbnVsbDtcblx0XHRcdGlmICggISBwYXlsb2FkIHx8ICEgcmVzb3VyY2UgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0YXZhaWxhYmlsaXR5X2VudHJ5ID0gZ2V0X2F2YWlsYWJpbGl0eV93aW5kb3dfZW50cnkoIHdpbmRvd19rZXkgKTtcblx0XHRcdGF2YWlsYWJpbGl0eV9wYXlsb2FkID0gYXZhaWxhYmlsaXR5X2VudHJ5ICYmIGF2YWlsYWJpbGl0eV9lbnRyeS5wYXlsb2FkID8gYXZhaWxhYmlsaXR5X2VudHJ5LnBheWxvYWQgOiBudWxsO1xuXHRcdFx0cmVzb3VyY2Vfd2luZG93X2luZGV4ZXNbIGNhY2hlX2tleSBdID0ge1xuXHRcdFx0XHRyZXNvdXJjZTogcmVzb3VyY2UsXG5cdFx0XHRcdHdpbmRvdzogcGF5bG9hZC53aW5kb3csXG5cdFx0XHRcdGF4aXM6IHBheWxvYWQuYXhpcyxcblx0XHRcdFx0c2VnbWVudHM6ICggcGF5bG9hZC5zZWdtZW50cyB8fCBbXSApLmZpbHRlciggZnVuY3Rpb24gKCBzZWdtZW50ICkge1xuXHRcdFx0XHRcdHJldHVybiBOdW1iZXIoIHNlZ21lbnQgJiYgc2VnbWVudC5yZXNvdXJjZV9pZCApID09PSByZXNvdXJjZV9pZDtcblx0XHRcdFx0fSApLFxuXHRcdFx0XHRvY2N1cGFuY3k6ICggcGF5bG9hZC5vY2N1cGFuY3kgfHwgW10gKS5maWx0ZXIoIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIE51bWJlciggaW50ZXJ2YWwgJiYgaW50ZXJ2YWwucmVzb3VyY2VfaWQgKSA9PT0gcmVzb3VyY2VfaWQ7XG5cdFx0XHRcdH0gKSxcblx0XHRcdFx0YXZhaWxhYmlsaXR5OiBhdmFpbGFiaWxpdHlfZW50cnksXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV9wYXlsb2FkOiBhdmFpbGFiaWxpdHlfcGF5bG9hZCA/IE9iamVjdC5hc3NpZ24oIHt9LCBhdmFpbGFiaWxpdHlfcGF5bG9hZCwge1xuXHRcdFx0XHRcdHJlc291cmNlX2lkczogWyByZXNvdXJjZV9pZCBdLFxuXHRcdFx0XHRcdGludGVydmFsczogKCBhdmFpbGFiaWxpdHlfcGF5bG9hZC5pbnRlcnZhbHMgfHwgW10gKS5maWx0ZXIoIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gTnVtYmVyKCBpbnRlcnZhbCAmJiBpbnRlcnZhbC5yZXNvdXJjZV9pZCApID09PSByZXNvdXJjZV9pZDtcblx0XHRcdFx0XHR9ICksXG5cdFx0XHRcdFx0Y292ZXJhZ2U6ICggYXZhaWxhYmlsaXR5X3BheWxvYWQuY292ZXJhZ2UgfHwgW10gKS5maWx0ZXIoIGZ1bmN0aW9uICggY292ZXJhZ2UgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gTnVtYmVyKCBjb3ZlcmFnZSAmJiBjb3ZlcmFnZS5yZXNvdXJjZV9pZCApID09PSByZXNvdXJjZV9pZDtcblx0XHRcdFx0XHR9ICksXG5cdFx0XHRcdFx0dW5rbm93bjogKCBhdmFpbGFiaWxpdHlfcGF5bG9hZC51bmtub3duIHx8IFtdICkuZmlsdGVyKCBmdW5jdGlvbiAoIHVua25vd24gKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gTnVtYmVyKCB1bmtub3duICYmIHVua25vd24ucmVzb3VyY2VfaWQgKSA9PT0gcmVzb3VyY2VfaWQ7XG5cdFx0XHRcdFx0fSApXG5cdFx0XHRcdH0gKSA6IG51bGxcblx0XHRcdH07XG5cblx0XHRcdHJldHVybiByZXNvdXJjZV93aW5kb3dfaW5kZXhlc1sgY2FjaGVfa2V5IF07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgbGlnaHR3ZWlnaHQgUmVzb3VyY2Utb3duZWQgdmlld3Mgb3ZlciBhY2NlcHRlZCBib29raW5nIHdpbmRvd3MuXG5cdFx0ICpcblx0XHQgKiBSZXRhaW5lZCB3aW5kb3dzIHJldXNlIHRoZWlyIGxhenkgUmVzb3VyY2UgaW5kZXhlcy4gT25seSBuZXdseSBhY2NlcHRlZCBvclxuXHRcdCAqIGNoYW5nZWQgd2luZG93cyBzY2FuIHRoZSBuYXRpdmUgRFRPIGNvbGxlY3Rpb25zIGZvciB0aGlzIG9wZW4gUmVzb3VyY2UuXG5cdFx0ICogU291cmNlIHJlY29yZHMgcmVtYWluIHJlYWQtb25seSByZWZlcmVuY2VzIGFuZCBhcmUgbmV2ZXIgZGVlcC1jbG9uZWQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBvcGVuIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IFByb2plY3RvciBib29raW5nLXdpbmRvdyBpbnB1dHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jlc291cmNlX3Byb2plY3Rpb25fYm9va2luZ193aW5kb3dzKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybiBhY2NlcHRlZF9ib29raW5nX3dpbmRvd3MubWFwKCBmdW5jdGlvbiAoIHdpbmRvd19lbnRyeSApIHtcblx0XHRcdFx0dmFyIHdpbmRvd19rZXkgPSBTdHJpbmcoIHdpbmRvd19lbnRyeSAmJiB3aW5kb3dfZW50cnkua2V5IHx8ICcnICk7XG5cdFx0XHRcdHZhciByZXNvdXJjZV9pbmRleCA9IGdldF9yZXNvdXJjZV93aW5kb3dfaW5kZXgoIHJlc291cmNlX2lkLCB3aW5kb3dfa2V5ICk7XG5cblx0XHRcdFx0aWYgKCAhIHJlc291cmNlX2luZGV4ICkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0a2V5OiB3aW5kb3dfa2V5LFxuXHRcdFx0XHRcdHBheWxvYWQ6IHtcblx0XHRcdFx0XHRcdHdpbmRvdzogcmVzb3VyY2VfaW5kZXgud2luZG93LFxuXHRcdFx0XHRcdFx0YXhpczogcmVzb3VyY2VfaW5kZXguYXhpcyxcblx0XHRcdFx0XHRcdHJlc291cmNlczogWyByZXNvdXJjZV9pbmRleC5yZXNvdXJjZSBdLFxuXHRcdFx0XHRcdFx0c2VnbWVudHM6IHJlc291cmNlX2luZGV4LnNlZ21lbnRzLFxuXHRcdFx0XHRcdFx0b2NjdXBhbmN5OiByZXNvdXJjZV9pbmRleC5vY2N1cGFuY3lcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9ICkuZmlsdGVyKCBCb29sZWFuICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgbGlnaHR3ZWlnaHQgUmVzb3VyY2Utb3duZWQgdmlld3Mgb3ZlciBhY2NlcHRlZCBBdmFpbGFiaWxpdHkgd2luZG93cy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIG9wZW4gUmVzb3VyY2UgSUQuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gUHJvamVjdG9yIEF2YWlsYWJpbGl0eS13aW5kb3cgaW5wdXRzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yZXNvdXJjZV9wcm9qZWN0aW9uX2F2YWlsYWJpbGl0eV93aW5kb3dzKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybiBhY2NlcHRlZF9ib29raW5nX3dpbmRvd3MubWFwKCBmdW5jdGlvbiAoIGJvb2tpbmdfd2luZG93X2VudHJ5ICkge1xuXHRcdFx0XHR2YXIgd2luZG93X2tleSA9IFN0cmluZyggYm9va2luZ193aW5kb3dfZW50cnkgJiYgYm9va2luZ193aW5kb3dfZW50cnkua2V5IHx8ICcnICk7XG5cdFx0XHRcdHZhciByZXNvdXJjZV9pbmRleCA9IGdldF9yZXNvdXJjZV93aW5kb3dfaW5kZXgoIHJlc291cmNlX2lkLCB3aW5kb3dfa2V5ICk7XG5cblx0XHRcdFx0aWYgKCAhIHJlc291cmNlX2luZGV4IHx8ICEgcmVzb3VyY2VfaW5kZXguYXZhaWxhYmlsaXR5IHx8ICEgcmVzb3VyY2VfaW5kZXguYXZhaWxhYmlsaXR5X3BheWxvYWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjYWNoZV9rZXk6IFN0cmluZyggcmVzb3VyY2VfaW5kZXguYXZhaWxhYmlsaXR5LmNhY2hlX2tleSB8fCAnJyApLFxuXHRcdFx0XHRcdHdpbmRvd19rZXk6IHdpbmRvd19rZXksXG5cdFx0XHRcdFx0cGF5bG9hZDogcmVzb3VyY2VfaW5kZXguYXZhaWxhYmlsaXR5X3BheWxvYWRcblx0XHRcdFx0fTtcblx0XHRcdH0gKS5maWx0ZXIoIEJvb2xlYW4gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdG9yZSBvbmUgZnV0dXJlIGRvbWFpbiBwcm9qZWN0aW9uIG9ubHkgZm9yIGFuIG9wZW4gYWNjZXB0ZWQgaWRlbnRpdHkuXG5cdFx0ICpcblx0XHQgKiBQaGFzZSA0IGRvZXMgbm90IGNhbGwgdGhpcyBtZXRob2QgaW4gcHJvZHVjdGlvbi4gSXQgZnJlZXplcyB0aGUgYm91bmRlZFxuXHRcdCAqIGNhY2hlIGNvbnRyYWN0IGZvciBsYXRlciBwcm9qZWN0aW9uIHBoYXNlcyBhbmQgZGV2ZWxvcG1lbnQgdGVzdHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBvcGVuIFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB3aW5kb3dfa2V5IEFjY2VwdGVkIG5hdGl2ZSB3aW5kb3cga2V5LlxuXHRcdCAqIEBwYXJhbSB7Kn0gcHJvamVjdGlvbiBGdXR1cmUgcHJlc2VudGF0aW9uLW5ldXRyYWwgcHJvamVjdGlvbi5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGJvdW5kZWQgZW50cnkgd2FzIHN0b3JlZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYWNoZV9wcm9qZWN0aW9uKCByZXNvdXJjZV9pZCwgd2luZG93X2tleSwgcHJvamVjdGlvbiApIHtcblx0XHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0d2luZG93X2tleSA9IFN0cmluZyggd2luZG93X2tleSB8fCAnJyApO1xuXHRcdFx0aWYgKCAhIG9wZW5fcmVzb3VyY2VfaWRzWyByZXNvdXJjZV9pZCBdIHx8ICEgYm9va2luZ19pZGVudGl0aWVzX2J5X2tleVsgd2luZG93X2tleSBdICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcHJvamVjdGlvbl9jYWNoZVsgd2luZG93X2tleSBdICkge1xuXHRcdFx0XHRwcm9qZWN0aW9uX2NhY2hlWyB3aW5kb3dfa2V5IF0gPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR9XG5cdFx0XHRwcm9qZWN0aW9uX2NhY2hlWyB3aW5kb3dfa2V5IF1bIHJlc291cmNlX2lkIF0gPSBwcm9qZWN0aW9uO1xuXHRcdFx0T2JqZWN0LmtleXMoIHByb2plY3Rpb25fY2FjaGUgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNhY2hlZF93aW5kb3dfa2V5ICkge1xuXHRcdFx0XHRpZiAoICEgYm9va2luZ19pZGVudGl0aWVzX2J5X2tleVsgY2FjaGVkX3dpbmRvd19rZXkgXSApIHtcblx0XHRcdFx0XHRkZWxldGUgcHJvamVjdGlvbl9jYWNoZVsgY2FjaGVkX3dpbmRvd19rZXkgXTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gT2JqZWN0LmtleXMoIHByb2plY3Rpb25fY2FjaGUgKS5sZW5ndGggPD0gbWF4aW11bV9jYWNoZWRfd2luZG93cztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcm9qZWN0IG9uZSBvcGVuIFJlc291cmNlIGZyb20gdGhlIGNvbXBsZXRlIGFjY2VwdGVkIGJvdW5kZWQgaWRlbnRpdHkuXG5cdFx0ICpcblx0XHQgKiBUaGUgbWV0aG9kIHBlcmZvcm1zIG5vIHJlbmRlcmluZy4gVW5jaGFuZ2VkIGlkZW50aXRpZXMgcmV1c2UgdGhlIGV4YWN0XG5cdFx0ICogY2FjaGVkIHByb2plY3Rpb24gb2JqZWN0LiBDbG9zZWQgb3Igbm8tbG9uZ2VyLWF1dGhvcml6ZWQgUmVzb3VyY2VzIHJldHVyblxuXHRcdCAqIG51bGwgYmVmb3JlIHRoZSBwcm9qZWN0b3IgaXMgaW52b2tlZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIG9wZW4gUmVzb3VyY2UgSUQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJhbmdlX3BvbGljeSBBdXRvIG9yIEZ1bGwgZGF5IHByZXNlbnRhdGlvbiBwb2xpY3kuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IENhY2hlZCBvciBuZXdseSBjb21wdXRlZCBwcm9qZWN0aW9uIERUTy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBwcm9qZWN0X3Jlc291cmNlKCByZXNvdXJjZV9pZCwgcmFuZ2VfcG9saWN5ICkge1xuXHRcdFx0dmFyIHByb2plY3RvciA9IHdpbmRvdy53cGJjX3RpbWVsaW5lX3RpbWVfcm93c19wcm9qZWN0b3I7XG5cdFx0XHR2YXIgaWRlbnRpdHk7XG5cdFx0XHR2YXIgcHJvamVjdG9yX2lucHV0O1xuXHRcdFx0dmFyIGNhY2hlX2tleTtcblx0XHRcdHZhciBwcm9qZWN0aW9uO1xuXG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgKTtcblx0XHRcdGlmIChcblx0XHRcdFx0ISBvcGVuX3Jlc291cmNlX2lkc1sgcmVzb3VyY2VfaWQgXVxuXHRcdFx0XHR8fCAhIHByb2plY3RvclxuXHRcdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgcHJvamVjdG9yLnByb2plY3Rcblx0XHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHByb2plY3Rvci5nZXRfcHJvamVjdGlvbl9jYWNoZV9rZXlcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlkZW50aXR5ID0gYm9va2luZ19pZGVudGl0aWVzX2J5X2tleVsgT2JqZWN0LmtleXMoIGJvb2tpbmdfaWRlbnRpdGllc19ieV9rZXkgKVsgMCBdIF07XG5cdFx0XHRpZiAoICEgaWRlbnRpdHkgfHwgLTEgPT09IGlkZW50aXR5LnJlc291cmNlX2lkcy5pbmRleE9mKCByZXNvdXJjZV9pZCApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHByb2plY3Rvcl9pbnB1dCA9IHtcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxuXHRcdFx0XHRyZXNvdXJjZV9maW5nZXJwcmludDogaWRlbnRpdHkucmVzb3VyY2VfZmluZ2VycHJpbnQsXG5cdFx0XHRcdHRpbWV6b25lOiBpZGVudGl0eS50aW1lem9uZSxcblx0XHRcdFx0Ym9va2luZ19nZW5lcmF0aW9uOiBib29raW5nX3Byb2plY3Rpb25fcmV2aXNpb24sXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV9nZW5lcmF0aW9uOiBhdmFpbGFiaWxpdHlfcHJvamVjdGlvbl9yZXZpc2lvbixcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3N0YXRlOiBhdmFpbGFiaWxpdHlfc3RhdGUsXG5cdFx0XHRcdGJvb2tpbmdfd2luZG93czogZ2V0X3Jlc291cmNlX3Byb2plY3Rpb25fYm9va2luZ193aW5kb3dzKCByZXNvdXJjZV9pZCApLFxuXHRcdFx0XHRhdmFpbGFiaWxpdHlfd2luZG93czogZ2V0X3Jlc291cmNlX3Byb2plY3Rpb25fYXZhaWxhYmlsaXR5X3dpbmRvd3MoIHJlc291cmNlX2lkICksXG5cdFx0XHRcdHJhbmdlX3BvbGljeTogT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0XHRcdG1vZGU6ICdhdXRvJyxcblx0XHRcdFx0XHRzYWZlX3N0YXJ0X21pbnV0ZTogTnVtYmVyKCBjb25maWd1cmF0aW9uLmxpbWl0cyAmJiBjb25maWd1cmF0aW9uLmxpbWl0cy5hdXRvX3NhZmVfc3RhcnRfbWludXRlICkgfHwgNDgwLFxuXHRcdFx0XHRcdHNhZmVfZW5kX21pbnV0ZTogTnVtYmVyKCBjb25maWd1cmF0aW9uLmxpbWl0cyAmJiBjb25maWd1cmF0aW9uLmxpbWl0cy5hdXRvX3NhZmVfZW5kX21pbnV0ZSApIHx8IDEwODBcblx0XHRcdFx0fSwgcmFuZ2VfcG9saWN5IHx8IHt9ICksXG5cdFx0XHRcdHZpc2libGVfbGFuZV9saW1pdDogTnVtYmVyKCBjb25maWd1cmF0aW9uLmxpbWl0cyAmJiBjb25maWd1cmF0aW9uLmxpbWl0cy5tYXhpbXVtX3Zpc2libGVfbGFuZXMgKSB8fCAzXG5cdFx0XHR9O1xuXHRcdFx0Y2FjaGVfa2V5ID0gcHJvamVjdG9yLmdldF9wcm9qZWN0aW9uX2NhY2hlX2tleSggcHJvamVjdG9yX2lucHV0ICk7XG5cdFx0XHRpZiAoIHByb2plY3RlZF9yZXNvdXJjZXNbIHJlc291cmNlX2lkIF0gJiYgcHJvamVjdGVkX3Jlc291cmNlc1sgcmVzb3VyY2VfaWQgXS5jYWNoZV9rZXkgPT09IGNhY2hlX2tleSApIHtcblx0XHRcdFx0cmV0dXJuIHByb2plY3RlZF9yZXNvdXJjZXNbIHJlc291cmNlX2lkIF0ucHJvamVjdGlvbjtcblx0XHRcdH1cblx0XHRcdHByb2plY3Rpb24gPSBwcm9qZWN0b3IucHJvamVjdCggcHJvamVjdG9yX2lucHV0ICk7XG5cdFx0XHRwcm9qZWN0ZWRfcmVzb3VyY2VzWyByZXNvdXJjZV9pZCBdID0ge1xuXHRcdFx0XHRjYWNoZV9rZXk6IGNhY2hlX2tleSxcblx0XHRcdFx0cHJvamVjdGlvbjogcHJvamVjdGlvblxuXHRcdFx0fTtcblxuXHRcdFx0cmV0dXJuIHByb2plY3Rpb247XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9ybWF0IG9uZSB3YWxsLWNsb2NrIG1pbnV0ZSB3aXRob3V0IGNvbnN1bHRpbmcgdGhlIGJyb3dzZXIgdGltZXpvbmUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gd2FsbF9taW51dGUgTWludXRlIGZyb20gbG9jYWwgbWlkbmlnaHQuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTdGFibGUgMjQtaG91ciBsYWJlbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmb3JtYXRfd2FsbF9taW51dGUoIHdhbGxfbWludXRlICkge1xuXHRcdFx0dmFyIGJvdW5kZWRfbWludXRlID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCAxNDQwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIHdhbGxfbWludXRlICkgfHwgMCApICkgKTtcblx0XHRcdHZhciBob3VycyA9IE1hdGguZmxvb3IoIGJvdW5kZWRfbWludXRlIC8gNjAgKTtcblx0XHRcdHZhciBtaW51dGVzID0gYm91bmRlZF9taW51dGUgJSA2MDtcblxuXHRcdFx0cmV0dXJuIFN0cmluZyggaG91cnMgKS5wYWRTdGFydCggMiwgJzAnICkgKyAnOicgKyBTdHJpbmcoIG1pbnV0ZXMgKS5wYWRTdGFydCggMiwgJzAnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9ybWF0IG9uZSBleGFjdCBVVEMgb2Zmc2V0IHdpdGhvdXQgY29uc3VsdGluZyB0aGUgYnJvd3NlciB0aW1lem9uZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXRfbWludXRlcyBTaWduZWQgb2Zmc2V0IG1pbnV0ZXMgZnJvbSBVVEMuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBTaWduZWQgSEg6TU0gb2Zmc2V0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvcm1hdF91dGNfb2Zmc2V0KCBvZmZzZXRfbWludXRlcyApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX21pbnV0ZXMgPSBNYXRoLnJvdW5kKCBOdW1iZXIoIG9mZnNldF9taW51dGVzICkgfHwgMCApO1xuXHRcdFx0dmFyIHNpZ24gPSAwID4gbm9ybWFsaXplZF9taW51dGVzID8gJy0nIDogJysnO1xuXHRcdFx0dmFyIGFic29sdXRlX21pbnV0ZXMgPSBNYXRoLmFicyggbm9ybWFsaXplZF9taW51dGVzICk7XG5cblx0XHRcdHJldHVybiBzaWduICsgU3RyaW5nKCBNYXRoLmZsb29yKCBhYnNvbHV0ZV9taW51dGVzIC8gNjAgKSApLnBhZFN0YXJ0KCAyLCAnMCcgKSArICc6JyArIFN0cmluZyggYWJzb2x1dGVfbWludXRlcyAlIDYwICkucGFkU3RhcnQoIDIsICcwJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEludGVycG9sYXRlIGEgbG9jYWxpemVkIGxhYmVsIGNvbnRhaW5pbmcgbmFtZWQgcGxhY2Vob2xkZXJzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHBhdHRlcm4gTG9jYWxpemVkIHBhdHRlcm4uXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHZhbHVlcyBQbGFpbiBzY2FsYXIgcmVwbGFjZW1lbnRzLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gSW50ZXJwb2xhdGVkIGxhYmVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGludGVycG9sYXRlX2xhYmVsKCBwYXR0ZXJuLCB2YWx1ZXMgKSB7XG5cdFx0XHRPYmplY3Qua2V5cyggdmFsdWVzIHx8IHt9ICkuZm9yRWFjaCggZnVuY3Rpb24gKCBrZXkgKSB7XG5cdFx0XHRcdHBhdHRlcm4gPSBTdHJpbmcoIHBhdHRlcm4gfHwgJycgKS5yZXBsYWNlKCBuZXcgUmVnRXhwKCAnXFxcXHsnICsga2V5ICsgJ1xcXFx9JywgJ2cnICksIFN0cmluZyggdmFsdWVzWyBrZXkgXSApICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBTdHJpbmcoIHBhdHRlcm4gfHwgJycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGxvY2FsaXplZCwgbm9uLWNvbG9yIGJvb2tpbmcgc3RhdHVzIGxhYmVsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHN0YXR1cyBBY2NlcHRlZCBib29raW5nIHN0YXR1cy5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IExvY2FsaXplZCBzdGF0dXMgbGFiZWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2Jvb2tpbmdfc3RhdHVzX2xhYmVsKCBzdGF0dXMgKSB7XG5cdFx0XHR2YXIgaTE4biA9IGNvbmZpZ3VyYXRpb24uaTE4biB8fCB7fTtcblxuXHRcdFx0aWYgKCAnYXBwcm92ZWQnID09PSBzdGF0dXMgKSB7XG5cdFx0XHRcdHJldHVybiBTdHJpbmcoIGkxOG4uc3RhdHVzX2FwcHJvdmVkIHx8ICdBcHByb3ZlZCcgKTtcblx0XHRcdH1cblx0XHRcdGlmICggJ3BlbmRpbmcnID09PSBzdGF0dXMgKSB7XG5cdFx0XHRcdHJldHVybiBTdHJpbmcoIGkxOG4uc3RhdHVzX3BlbmRpbmcgfHwgJ1BlbmRpbmcnICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBpMThuLnN0YXR1c191bmtub3duIHx8ICdCb29raW5nIHN0YXR1cyB1bmF2YWlsYWJsZScgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYW4gZXhhY3QgdmlzaWJsZSB0aW1lZCBsYWJlbCwgaW5jbHVkaW5nIG9mZnNldHMgb24gRFNUIGRhdGVzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZyYWdtZW50IFByb2plY3RlZCB0aW1lZCBmcmFnbWVudC5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZGF0ZSBQcmVzZW50YXRpb24gZGF0ZSByZWNvcmQuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBXYWxsLWNsb2NrIHJhbmdlIHdpdGggYW4gb2Zmc2V0IHF1YWxpZmllciB3aGVuIHJlcXVpcmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF90aW1lZF9zY2hlZHVsZV9sYWJlbCggZnJhZ21lbnQsIGRhdGUgKSB7XG5cdFx0XHR2YXIgc2VwYXJhdG9yID0gJ1xcdTIwMTMnO1xuXHRcdFx0dmFyIHNjaGVkdWxlX2xhYmVsID0gZm9ybWF0X3dhbGxfbWludXRlKCBmcmFnbWVudC53YWxsX3N0YXJ0X21pbnV0ZSApICsgc2VwYXJhdG9yICsgZm9ybWF0X3dhbGxfbWludXRlKCBmcmFnbWVudC53YWxsX2VuZF9taW51dGUgKTtcblx0XHRcdHZhciBzdGFydF9vZmZzZXQ7XG5cdFx0XHR2YXIgZW5kX29mZnNldDtcblxuXHRcdFx0aWYgKCAhIGRhdGUgfHwgISBBcnJheS5pc0FycmF5KCBkYXRlLmRzdF9zbGljZXMgKSB8fCAhIGRhdGUuZHN0X3NsaWNlcy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybiBzY2hlZHVsZV9sYWJlbDtcblx0XHRcdH1cblx0XHRcdHN0YXJ0X29mZnNldCA9IGZvcm1hdF91dGNfb2Zmc2V0KCBmcmFnbWVudC5zdGFydF9vZmZzZXRfbWludXRlcyApO1xuXHRcdFx0ZW5kX29mZnNldCA9IGZvcm1hdF91dGNfb2Zmc2V0KCBmcmFnbWVudC5lbmRfb2Zmc2V0X21pbnV0ZXMgKTtcblx0XHRcdHJldHVybiBzY2hlZHVsZV9sYWJlbCArICcgKFVUQycgKyBzdGFydF9vZmZzZXQgKyAoIHN0YXJ0X29mZnNldCA9PT0gZW5kX29mZnNldCA/ICcnIDogc2VwYXJhdG9yICsgJ1VUQycgKyBlbmRfb2Zmc2V0ICkgKyAnKSc7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBmaXJzdCBhY2NlcHRlZCBkYXRlLWJhbmQgcHJlc2VudGF0aW9uIHJlY29yZCBmb3Igb25lIGRhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZGF0ZSBTaXRlLWxvY2FsIElTTyBkYXRlLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gQWNjZXB0ZWQgc2VydmVyIGRhdGUtYmFuZCBtZXRhZGF0YSBvciBhbiBlbXB0eSBvYmplY3QuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3NvdXJjZV9kYXRlX2JhbmQoIGRhdGUgKSB7XG5cdFx0XHR2YXIgc291cmNlX2RhdGVfYmFuZCA9IG51bGw7XG5cblx0XHRcdGFjY2VwdGVkX2Jvb2tpbmdfd2luZG93cy5zb21lKCBmdW5jdGlvbiAoIHdpbmRvd19lbnRyeSApIHtcblx0XHRcdFx0dmFyIGF4aXMgPSB3aW5kb3dfZW50cnkgJiYgd2luZG93X2VudHJ5LnBheWxvYWQgPyB3aW5kb3dfZW50cnkucGF5bG9hZC5heGlzIHx8IHt9IDoge307XG5cblx0XHRcdFx0cmV0dXJuICggQXJyYXkuaXNBcnJheSggYXhpcy5kYXRlX2JhbmRzICkgPyBheGlzLmRhdGVfYmFuZHMgOiBbXSApLnNvbWUoIGZ1bmN0aW9uICggZGF0ZV9iYW5kICkge1xuXHRcdFx0XHRcdGlmICggU3RyaW5nKCBkYXRlX2JhbmQgJiYgZGF0ZV9iYW5kLmRhdGUgfHwgJycgKSAhPT0gU3RyaW5nKCBkYXRlIHx8ICcnICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNvdXJjZV9kYXRlX2JhbmQgPSBkYXRlX2JhbmQ7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIHNvdXJjZV9kYXRlX2JhbmQgfHwge307XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBhY2NlcHRlZCBhdXRob3JpemVkIFJlc291cmNlIHN1bW1hcnkgZm9yIG9uZSBpZGVudGl0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gT3JpZ2luYWwgYWNjZXB0ZWQgUmVzb3VyY2UgRFRPIG9yIGFuIGVtcHR5IG9iamVjdC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc291cmNlX3Jlc291cmNlKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdHZhciBzb3VyY2VfcmVzb3VyY2UgPSBudWxsO1xuXG5cdFx0XHRhY2NlcHRlZF9ib29raW5nX3dpbmRvd3Muc29tZSggZnVuY3Rpb24gKCB3aW5kb3dfZW50cnkgKSB7XG5cdFx0XHRcdHZhciByZXNvdXJjZXMgPSB3aW5kb3dfZW50cnkgJiYgd2luZG93X2VudHJ5LnBheWxvYWQgJiYgQXJyYXkuaXNBcnJheSggd2luZG93X2VudHJ5LnBheWxvYWQucmVzb3VyY2VzIClcblx0XHRcdFx0XHQ/IHdpbmRvd19lbnRyeS5wYXlsb2FkLnJlc291cmNlc1xuXHRcdFx0XHRcdDogW107XG5cblx0XHRcdFx0cmV0dXJuIHJlc291cmNlcy5zb21lKCBmdW5jdGlvbiAoIHJlc291cmNlICkge1xuXHRcdFx0XHRcdGlmICggTnVtYmVyKCByZXNvdXJjZSAmJiByZXNvdXJjZS5pZCApICE9PSBOdW1iZXIoIHJlc291cmNlX2lkICkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNvdXJjZV9yZXNvdXJjZSA9IHJlc291cmNlO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiBzb3VyY2VfcmVzb3VyY2UgfHwge307XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBzdGFibGUgc2NhbGFyIGlkZW50aXR5IGZvciBvbmUgY2Fub25pY2FsIHNvdXJjZSBzZWdtZW50LlxuXHRcdCAqXG5cdFx0ICogVGhlIGJvb2tpbmcgSUQgcmVtYWlucyBwYXJ0IG9mIHRoZSBpZGVudGl0eSBiZWNhdXNlIGEgc2VnbWVudCBpZGVudGlmaWVyXG5cdFx0ICogaXMgcHJlc2VudGF0aW9uIGRhdGEgYW5kIG11c3Qgbm90IGluZGVwZW5kZW50bHkgc2VsZWN0IGFub3RoZXIgYm9va2luZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzb3VyY2Vfc2VnbWVudF9pZCBBY2NlcHRlZCBzZWdtZW50IElELlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBib29raW5nX2lkIENhbm9uaWNhbCBib29raW5nIElELlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhYmxlIHNlZ21lbnQgYW5kIGJvb2tpbmcgaWRlbnRpdHkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3NvdXJjZV9zZWdtZW50X2lkZW50aXR5KCBzb3VyY2Vfc2VnbWVudF9pZCwgYm9va2luZ19pZCApIHtcblx0XHRcdHJldHVybiBTdHJpbmcoIHNvdXJjZV9zZWdtZW50X2lkIHx8ICcnICkgKyAnfCcgKyBOdW1iZXIoIGJvb2tpbmdfaWQgfHwgMCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluZGV4IGFjY2VwdGVkIGNhbm9uaWNhbCBzZWdtZW50cyBmb3Igb25lIGN1cnJlbnRseSByZW5kZXJlZCBSZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIFRoZSBpbmRleCBpcyBkZWxpYmVyYXRlbHkgcmVuZGVyLWxvY2FsLiBDbG9zZWQgUmVzb3VyY2VzIGRvIG5vdCBidWlsZCBvclxuXHRcdCAqIHJldGFpbiBpdCwgYW5kIHRoZSBvcmlnaW5hbCBhY2NlcHRlZCBEVE8gcmVmZXJlbmNlcyByZW1haW4gYXV0aG9yaXRhdGl2ZS5cblx0XHQgKiBLZWVwaW5nIHRoZSBmaXJzdCBtYXRjaGluZyByZWZlcmVuY2UgcHJlc2VydmVzIHRoZSBwcmV2aW91cyBib3VuZGVkLXdpbmRvd1xuXHRcdCAqIGxvb2t1cCBiZWhhdmlvciB3aGlsZSBhdm9pZGluZyBvbmUgY29tcGxldGUgc2NhbiBwZXIgcHJvamVjdGVkIGZyYWdtZW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgb3BlbiBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3Q8c3RyaW5nLE9iamVjdD59IEFjY2VwdGVkIHNlZ21lbnQgcmVmZXJlbmNlcyBieSBzdGFibGUgaWRlbnRpdHkuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnVpbGRfc291cmNlX3NlZ21lbnRfaW5kZXgoIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIHNvdXJjZV9zZWdtZW50c19ieV9pZGVudGl0eSA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblxuXHRcdFx0YWNjZXB0ZWRfYm9va2luZ193aW5kb3dzLmZvckVhY2goIGZ1bmN0aW9uICggd2luZG93X2VudHJ5ICkge1xuXHRcdFx0XHR2YXIgc2VnbWVudHMgPSB3aW5kb3dfZW50cnkgJiYgd2luZG93X2VudHJ5LnBheWxvYWQgJiYgQXJyYXkuaXNBcnJheSggd2luZG93X2VudHJ5LnBheWxvYWQuc2VnbWVudHMgKVxuXHRcdFx0XHRcdD8gd2luZG93X2VudHJ5LnBheWxvYWQuc2VnbWVudHNcblx0XHRcdFx0XHQ6IFtdO1xuXG5cdFx0XHRcdHNlZ21lbnRzLmZvckVhY2goIGZ1bmN0aW9uICggc2VnbWVudCApIHtcblx0XHRcdFx0XHR2YXIgaWRlbnRpdHk7XG5cblx0XHRcdFx0XHRpZiAoIE51bWJlciggc2VnbWVudCAmJiBzZWdtZW50LnJlc291cmNlX2lkICkgIT09IE51bWJlciggcmVzb3VyY2VfaWQgKSApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWRlbnRpdHkgPSBnZXRfc291cmNlX3NlZ21lbnRfaWRlbnRpdHkoIHNlZ21lbnQgJiYgc2VnbWVudC5zZWdtZW50X2lkLCBzZWdtZW50ICYmIHNlZ21lbnQuYm9va2luZ19pZCApO1xuXHRcdFx0XHRcdGlmICggISBzb3VyY2Vfc2VnbWVudHNfYnlfaWRlbnRpdHlbIGlkZW50aXR5IF0gKSB7XG5cdFx0XHRcdFx0XHRzb3VyY2Vfc2VnbWVudHNfYnlfaWRlbnRpdHlbIGlkZW50aXR5IF0gPSBzZWdtZW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gc291cmNlX3NlZ21lbnRzX2J5X2lkZW50aXR5O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBhIGZpeGVkIGFsbG93LWxpc3RlZCBXb3JkUHJlc3MgdGVtcGxhdGUgcmVuZGVyZXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfc2xvdCBDb2RlLW93bmVkIGNvbmZpZ3VyYXRpb24gc2xvdC5cblx0XHQgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBXb3JkUHJlc3MgdGVtcGxhdGUgZnVuY3Rpb24gb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlX3Nsb3QgKSB7XG5cdFx0XHR2YXIgdGVtcGxhdGVfaWQgPSBjb25maWd1cmF0aW9uLnRlbXBsYXRlcyAmJiBjb25maWd1cmF0aW9uLnRlbXBsYXRlc1sgdGVtcGxhdGVfc2xvdCBdO1xuXG5cdFx0XHRyZXR1cm4gdGVtcGxhdGVfaWQgJiYgd3AgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwLnRlbXBsYXRlID8gd3AudGVtcGxhdGUoIHRlbXBsYXRlX2lkICkgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIHRoZSB2ZXJ0aWNhbCBydWxlciB0aWNrcyBmb3IgdGhlIHJlc29sdmVkIHdhbGwtdGltZSByYW5nZS5cblx0XHQgKlxuXHRcdCAqIFRoZSAxNS1taW51dGUgcHJlc2VudGF0aW9uIGludGVydmFsIG1pcnJvcnMgdGhlIGVzdGFibGlzaGVkIGhvcml6b250YWxcblx0XHQgKiBCbG9jayBUaW1lcyBydWxlciB3aXRob3V0IGluaGVyaXRpbmcgaXRzIGVkaXRhYmxlIHNsb3Qtc3RlcCBzdGF0ZS4gSG91cnNcblx0XHQgKiByZWNlaXZlIGxhYmVscyBhbmQgbWFqb3IgdGlja3MsIGhhbGYgaG91cnMgcmVjZWl2ZSBhY2NlbnQgZG90cywgYW5kIHRoZVxuXHRcdCAqIHJlbWFpbmluZyBxdWFydGVyIGhvdXJzIHJlY2VpdmUgbWlub3IgdGlja3MuIE9ubHkgaG91ciByZWNvcmRzIGFyZSB1c2VkXG5cdFx0ICogYnkgdGhlIGNhbnZhcyB0ZW1wbGF0ZSBmb3IgZnVsbC13aWR0aCBndWlkZSBsaW5lcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByYW5nZSBSZXNvbHZlZCBwcm9qZWN0b3IgcmFuZ2UuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gT3JkZXJlZCBsYWJlbHMgYW5kIHZlcnRpY2FsIG9mZnNldHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYnVpbGRfdGltZV90aWNrcyggcmFuZ2UgKSB7XG5cdFx0XHR2YXIgdGlja3MgPSBbXTtcblx0XHRcdHZhciB0aWNrX3N0ZXBfbWludXRlcyA9IDE1O1xuXHRcdFx0dmFyIHRpY2tfbWludXRlID0gTWF0aC5jZWlsKCByYW5nZS5zdGFydF9taW51dGUgLyB0aWNrX3N0ZXBfbWludXRlcyApICogdGlja19zdGVwX21pbnV0ZXM7XG5cdFx0XHR2YXIgaXNfaG91cjtcblx0XHRcdHZhciBpc19oYWxmX2hvdXI7XG5cblx0XHRcdGZvciAoIDsgdGlja19taW51dGUgPD0gcmFuZ2UuZW5kX21pbnV0ZTsgdGlja19taW51dGUgKz0gdGlja19zdGVwX21pbnV0ZXMgKSB7XG5cdFx0XHRcdGlzX2hvdXIgPSAwID09PSB0aWNrX21pbnV0ZSAlIDYwO1xuXHRcdFx0XHRpc19oYWxmX2hvdXIgPSAzMCA9PT0gdGlja19taW51dGUgJSA2MDtcblx0XHRcdFx0dGlja3MucHVzaCgge1xuXHRcdFx0XHRcdG1pbnV0ZTogdGlja19taW51dGUsXG5cdFx0XHRcdFx0bGFiZWw6IGlzX2hvdXIgPyBmb3JtYXRfd2FsbF9taW51dGUoIHRpY2tfbWludXRlICkgOiAnJyxcblx0XHRcdFx0XHRpc19ob3VyOiBpc19ob3VyLFxuXHRcdFx0XHRcdGlzX2hhbGZfaG91cjogaXNfaGFsZl9ob3VyLFxuXHRcdFx0XHRcdGlzX21pbm9yOiAhIGlzX2hvdXIgJiYgISBpc19oYWxmX2hvdXIsXG5cdFx0XHRcdFx0aXNfYm91bmRhcnk6IHRpY2tfbWludXRlID09PSByYW5nZS5zdGFydF9taW51dGUgfHwgdGlja19taW51dGUgPT09IHJhbmdlLmVuZF9taW51dGUsXG5cdFx0XHRcdFx0b2Zmc2V0X3BlcmNlbnQ6IE51bWJlciggKCAxMDAgKiAoIHRpY2tfbWludXRlIC0gcmFuZ2Uuc3RhcnRfbWludXRlICkgLyByYW5nZS5zcGFuX21pbnV0ZXMgKS50b0ZpeGVkKCA4ICkgKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgdGlja3MubGVuZ3RoIHx8IHRpY2tzWyB0aWNrcy5sZW5ndGggLSAxIF0ubWludXRlICE9PSByYW5nZS5lbmRfbWludXRlICkge1xuXHRcdFx0XHR0aWNrcy5wdXNoKCB7XG5cdFx0XHRcdFx0bWludXRlOiByYW5nZS5lbmRfbWludXRlLFxuXHRcdFx0XHRcdGxhYmVsOiBmb3JtYXRfd2FsbF9taW51dGUoIHJhbmdlLmVuZF9taW51dGUgKSxcblx0XHRcdFx0XHRpc19ob3VyOiBmYWxzZSxcblx0XHRcdFx0XHRpc19oYWxmX2hvdXI6IGZhbHNlLFxuXHRcdFx0XHRcdGlzX21pbm9yOiBmYWxzZSxcblx0XHRcdFx0XHRpc19ib3VuZGFyeTogdHJ1ZSxcblx0XHRcdFx0XHRvZmZzZXRfcGVyY2VudDogMTAwXG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRpY2tzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1hcCBhbiBhY2NlcHRlZCBBdmFpbGFiaWxpdHkgc291cmNlIHRvIGEgY29kZS1vd25lZCBDU1MgY2xhc3MuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc291cmNlX2lkIEFjY2VwdGVkIHNvdXJjZSBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gRml4ZWQgc2NvcGVkIG1vZGlmaWVyIGNsYXNzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9hdmFpbGFiaWxpdHlfY3NzX2NsYXNzKCBzb3VyY2VfaWQgKSB7XG5cdFx0XHR2YXIgY2xhc3NlcyA9IHtcblx0XHRcdFx0dW5rbm93bjogJ2lzLXVua25vd24nLFxuXHRcdFx0XHRibG9ja2VkX2RhdGU6ICdpcy1ibG9ja2VkLWRhdGUnLFxuXHRcdFx0XHRibG9ja2VkX3RpbWU6ICdpcy1ibG9ja2VkLXRpbWUnLFxuXHRcdFx0XHR1bmF2YWlsYWJsZV93ZWVrZGF5OiAnaXMtdW5hdmFpbGFibGUtd2Vla2RheScsXG5cdFx0XHRcdHNlYXNvbmFsX2F2YWlsYWJpbGl0eTogJ2lzLXNlYXNvbmFsLWF2YWlsYWJpbGl0eScsXG5cdFx0XHRcdGFwcG9pbnRtZW50X2J1ZmZlcjogJ2lzLWFwcG9pbnRtZW50LWJ1ZmZlcicsXG5cdFx0XHRcdGJvb2tpbmdfYnVmZmVyOiAnaXMtYm9va2luZy1idWZmZXInLFxuXHRcdFx0XHR3b3JraW5nX3RpbWU6ICdpcy13b3JraW5nLXRpbWUnXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gY2xhc3Nlc1sgU3RyaW5nKCBzb3VyY2VfaWQgfHwgJycgKSBdIHx8ICdpcy11bmtub3duJztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGxvY2FsaXplZCBsYWJlbCBmb3Igb25lIHN1bW1hcnkgcmVjb3JkIGtpbmQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2luZCBQcm9qZWN0aW9uIHN1bW1hcnkga2luZC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IExvY2FsaXplZCBraW5kIGxhYmVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9zdW1tYXJ5X2tpbmRfbGFiZWwoIGtpbmQgKSB7XG5cdFx0XHR2YXIgaTE4biA9IGNvbmZpZ3VyYXRpb24uaTE4biB8fCB7fTtcblx0XHRcdHZhciBsYWJlbHMgPSB7XG5cdFx0XHRcdGZ1bGxfZGF5X2Jvb2tpbmc6IGkxOG4uZnVsbF9kYXlfYm9va2luZyxcblx0XHRcdFx0dGltZWRfYm9va2luZzogaTE4bi50aW1lZF9ib29raW5nLFxuXHRcdFx0XHRkc3RfdHJhbnNpdGlvbjogaTE4bi5kc3RfdHJhbnNpdGlvbixcblx0XHRcdFx0YXZhaWxhYmlsaXR5OiBpMThuLmF2YWlsYWJpbGl0eV9yZWNvcmQsXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV9jbGlwcGVkOiBpMThuLmF2YWlsYWJpbGl0eV9yZWNvcmQsXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV9zdGF0ZTogaTE4bi5hdmFpbGFiaWxpdHlfc3RhdGVfcmVjb3JkXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBsYWJlbHNbIGtpbmQgXSB8fCBpMThuLmxhYmVsIHx8ICcnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQnVpbGQgYSB0ZW1wbGF0ZS1vbmx5IHZpZXcgbW9kZWwgZnJvbSBvbmUgbm9ybWFsaXplZCBwcm9qZWN0aW9uIERUTy5cblx0XHQgKlxuXHRcdCAqIEdlb21ldHJ5IGlzIGRlcml2ZWQgb25seSBmcm9tIHByb2plY3RvciBwZXJjZW50YWdlcyBhbmQgYWNjZXB0ZWQgZGF0ZS1iYW5kXG5cdFx0ICogbWV0YWRhdGEuIENhbm9uaWNhbCBzZWdtZW50cyBhcmUgcmV0YWluZWQgc2VwYXJhdGVseSBmb3IgcmVhZC1vbmx5IEJvb2tpbmdcblx0XHQgKiBPdmVydmlldyByZWdpc3RyYXRpb24gYW5kIGFyZSBuZXZlciByZWNvbnN0cnVjdGVkIGZyb20gcmVuZGVyZWQgbWFya3VwLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHByb2plY3Rpb24gTm9ybWFsaXplZCBwdXJlIHByb2plY3Rpb24gRFRPLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSB6b29tX3BlcmNlbnQgUmVzb3VyY2UtbG9jYWwgdmVydGljYWwgem9vbSBwZXJjZW50YWdlLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gQWxsb3ctbGlzdGVkIHRlbXBsYXRlIG1vZGVsIGFuZCBjYW5vbmljYWwgcmVnaXN0cmF0aW9ucy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBidWlsZF9wcmVzZW50YXRpb25fbW9kZWwoIHByb2plY3Rpb24sIHpvb21fcGVyY2VudCApIHtcblx0XHRcdHZhciBpMThuID0gY29uZmlndXJhdGlvbi5pMThuIHx8IHt9O1xuXHRcdFx0dmFyIHpvb20gPSBnZXRfem9vbV9jb25maWd1cmF0aW9uKCk7XG5cdFx0XHR2YXIgcmFuZ2Vfc3RlcF9taW51dGVzID0gZ2V0X3RpbWVfcmFuZ2Vfc3RlcF9taW51dGVzKCk7XG5cdFx0XHR2YXIgbWF0Y2hpbmdfcmFuZ2VfcHJlc2V0ID0gZ2V0X21hdGNoaW5nX3JhbmdlX3ByZXNldCggcHJvamVjdGlvbi5yYW5nZSApO1xuXHRcdFx0dmFyIGRhdGVfYnlfa2V5ID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdFx0dmFyIHNvdXJjZV9zZWdtZW50c19ieV9pZGVudGl0eSA9IGJ1aWxkX3NvdXJjZV9zZWdtZW50X2luZGV4KCBwcm9qZWN0aW9uLnJlc291cmNlX2lkICk7XG5cdFx0XHR2YXIgcmVnaXN0cmF0aW9ucyA9IFtdO1xuXHRcdFx0dmFyIGRhdGVzID0gcHJvamVjdGlvbi5kYXRlcy5tYXAoIGZ1bmN0aW9uICggZGF0ZSApIHtcblx0XHRcdFx0dmFyIHNvdXJjZV9kYXRlID0gZ2V0X3NvdXJjZV9kYXRlX2JhbmQoIGRhdGUuZGF0ZSApO1xuXHRcdFx0XHR2YXIgcHJvamVjdGVkX2RhdGUgPSBPYmplY3QuYXNzaWduKCB7fSwgZGF0ZSwge1xuXHRcdFx0XHRcdGxhYmVsOiBTdHJpbmcoIHNvdXJjZV9kYXRlLmxhYmVsIHx8IGRhdGUuZGF0ZSApLFxuXHRcdFx0XHRcdHdlZWtkYXk6IFN0cmluZyggc291cmNlX2RhdGUud2Vla2RheSB8fCBkYXRlLmRhdGUgKSxcblx0XHRcdFx0XHRkYXlfbnVtYmVyOiBTdHJpbmcoIHNvdXJjZV9kYXRlLmRheV9udW1iZXIgfHwgJycgKSxcblx0XHRcdFx0XHRpc190b2RheTogdHJ1ZSA9PT0gc291cmNlX2RhdGUuaXNfdG9kYXksXG5cdFx0XHRcdFx0aXNfd2Vla2VuZDogdHJ1ZSA9PT0gc291cmNlX2RhdGUuaXNfd2Vla2VuZCxcblx0XHRcdFx0XHRkc3Rfc2xpY2VzOiBkYXRlLmRzdF9zbGljZXMubWFwKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRcdFx0XHR2YXIgdmlzaWJsZV9zdGFydCA9IE1hdGgubWF4KCBwcm9qZWN0aW9uLnJhbmdlLnN0YXJ0X21pbnV0ZSwgdHJhbnNpdGlvbi5zdGFydF9taW51dGUgKTtcblx0XHRcdFx0XHRcdHZhciB2aXNpYmxlX2VuZCA9IE1hdGgubWluKCBwcm9qZWN0aW9uLnJhbmdlLmVuZF9taW51dGUsIHRyYW5zaXRpb24uZW5kX21pbnV0ZSApO1xuXHRcdFx0XHRcdFx0dmFyIGtpbmRfbGFiZWwgPSAnZ2FwJyA9PT0gdHJhbnNpdGlvbi5raW5kID8gaTE4bi5kc3RfZ2FwIDogaTE4bi5kc3RfZm9sZDtcblx0XHRcdFx0XHRcdHZhciBvZmZzZXRfYmVmb3JlID0gZm9ybWF0X3V0Y19vZmZzZXQoIE51bWJlciggdHJhbnNpdGlvbi5vZmZzZXRfYmVmb3JlX3NlY29uZHMgfHwgMCApIC8gNjAgKTtcblx0XHRcdFx0XHRcdHZhciBvZmZzZXRfYWZ0ZXIgPSBmb3JtYXRfdXRjX29mZnNldCggTnVtYmVyKCB0cmFuc2l0aW9uLm9mZnNldF9hZnRlcl9zZWNvbmRzIHx8IDAgKSAvIDYwICk7XG5cblx0XHRcdFx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgdHJhbnNpdGlvbiwge1xuXHRcdFx0XHRcdFx0XHR0b3BfcGVyY2VudDogTnVtYmVyKCAoIDEwMCAqICggdmlzaWJsZV9zdGFydCAtIHByb2plY3Rpb24ucmFuZ2Uuc3RhcnRfbWludXRlICkgLyBwcm9qZWN0aW9uLnJhbmdlLnNwYW5fbWludXRlcyApLnRvRml4ZWQoIDggKSApLFxuXHRcdFx0XHRcdFx0XHRoZWlnaHRfcGVyY2VudDogTnVtYmVyKCAoIDEwMCAqIE1hdGgubWF4KCAwLCB2aXNpYmxlX2VuZCAtIHZpc2libGVfc3RhcnQgKSAvIHByb2plY3Rpb24ucmFuZ2Uuc3Bhbl9taW51dGVzICkudG9GaXhlZCggOCApICksXG5cdFx0XHRcdFx0XHRcdGtpbmRfbGFiZWw6IFN0cmluZygga2luZF9sYWJlbCB8fCB0cmFuc2l0aW9uLmtpbmQgKSxcblx0XHRcdFx0XHRcdFx0b2Zmc2V0X2JlZm9yZTogb2Zmc2V0X2JlZm9yZSxcblx0XHRcdFx0XHRcdFx0b2Zmc2V0X2FmdGVyOiBvZmZzZXRfYWZ0ZXIsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBpbnRlcnBvbGF0ZV9sYWJlbCggaTE4bi5kc3RfdHJhbnNpdGlvbl9sYWJlbCwge1xuXHRcdFx0XHRcdFx0XHRcdGtpbmQ6IGtpbmRfbGFiZWwgfHwgdHJhbnNpdGlvbi5raW5kLFxuXHRcdFx0XHRcdFx0XHRcdGJlZm9yZTogb2Zmc2V0X2JlZm9yZSxcblx0XHRcdFx0XHRcdFx0XHRhZnRlcjogb2Zmc2V0X2FmdGVyXG5cdFx0XHRcdFx0XHRcdH0gKVxuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggdHJhbnNpdGlvbiApIHtcblx0XHRcdFx0XHRcdHJldHVybiAwIDwgdHJhbnNpdGlvbi5oZWlnaHRfcGVyY2VudDtcblx0XHRcdFx0XHR9IClcblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdGRhdGVfYnlfa2V5WyBwcm9qZWN0ZWRfZGF0ZS5kYXRlIF0gPSBwcm9qZWN0ZWRfZGF0ZTtcblx0XHRcdFx0cmV0dXJuIHByb2plY3RlZF9kYXRlO1xuXHRcdFx0fSApO1xuXHRcdFx0dmFyIHJlZ2lzdGVyX2ZyYWdtZW50ID0gZnVuY3Rpb24gKCBmcmFnbWVudCwgdmlld19mcmFnbWVudCwgaW50ZXJhY3Rpb25fYXhpcyApIHtcblx0XHRcdFx0dmFyIHNvdXJjZV9zZWdtZW50ID0gc291cmNlX3NlZ21lbnRzX2J5X2lkZW50aXR5WyBnZXRfc291cmNlX3NlZ21lbnRfaWRlbnRpdHkoIGZyYWdtZW50LnNvdXJjZV9zZWdtZW50X2lkLCBmcmFnbWVudC5ib29raW5nX2lkICkgXSB8fCBudWxsO1xuXG5cdFx0XHRcdGlmICggc291cmNlX3NlZ21lbnQgKSB7XG5cdFx0XHRcdFx0cmVnaXN0cmF0aW9ucy5wdXNoKCB7XG5cdFx0XHRcdFx0XHRyZW5kZXJfc2VnbWVudF9pZDogdmlld19mcmFnbWVudC5yZW5kZXJfc2VnbWVudF9pZCxcblx0XHRcdFx0XHRcdHNlZ21lbnQ6IHNvdXJjZV9zZWdtZW50LFxuXHRcdFx0XHRcdFx0aXNfb3ZlcmZsb3dlZDogdHJ1ZSA9PT0gdmlld19mcmFnbWVudC5pc19vdmVyZmxvd2VkLFxuXHRcdFx0XHRcdFx0aW50ZXJhY3Rpb25fYXhpczogJ3ZlcnRpY2FsJyA9PT0gaW50ZXJhY3Rpb25fYXhpcyA/ICd2ZXJ0aWNhbCcgOiAnaG9yaXpvbnRhbCcsXG5cdFx0XHRcdFx0XHRib3VuZGFyeV92aXNpYmlsaXR5OiB7XG5cdFx0XHRcdFx0XHRcdHN0YXJ0OiAhIHZpZXdfZnJhZ21lbnQuc2hvd3NfZWFybGllcl9pbmRpY2F0b3IsXG5cdFx0XHRcdFx0XHRcdGVuZDogISB2aWV3X2ZyYWdtZW50LnNob3dzX2xhdGVyX2luZGljYXRvclxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHZhciBmdWxsX2RheV9mcmFnbWVudF92aWV3cyA9IHByb2plY3Rpb24uZnVsbF9kYXlfZnJhZ21lbnRzLm1hcCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdFx0dmFyIGRhdGUgPSBkYXRlX2J5X2tleVsgZnJhZ21lbnQuZGF0ZSBdO1xuXG5cdFx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgZnJhZ21lbnQsIHtcblx0XHRcdFx0XHRkYXRlX2luZGV4OiBkYXRlID8gTnVtYmVyKCBkYXRlLmluZGV4ICkgOiAwLFxuXHRcdFx0XHRcdGxlZnRfcGVyY2VudDogZGF0ZSA/IGRhdGUub2Zmc2V0X3BlcmNlbnQgOiAwLFxuXHRcdFx0XHRcdHdpZHRoX3BlcmNlbnQ6IGRhdGUgPyBkYXRlLndpZHRoX3BlcmNlbnQgOiAwLFxuXHRcdFx0XHRcdHN0YWNrX3RvcF9weDogNiArIDM0ICogTnVtYmVyKCBmcmFnbWVudC5zdGFja19pbmRleCB8fCAwICksXG5cdFx0XHRcdFx0c3RhdHVzX2xhYmVsOiBnZXRfYm9va2luZ19zdGF0dXNfbGFiZWwoIGZyYWdtZW50LnN0YXR1cyApLFxuXHRcdFx0XHRcdHNlbGVjdGlvbl9hcmlhX2xhYmVsOiBmcmFnbWVudC5zZWxlY3Rpb25fYXJpYV9sYWJlbCB8fCBpbnRlcnBvbGF0ZV9sYWJlbCggaTE4bi5zZWxlY3RfYm9va2luZywgeyBsYWJlbDogZnJhZ21lbnQubGFiZWwgfSApLFxuXHRcdFx0XHRcdGluZm9ybWF0aW9uX2FyaWFfbGFiZWw6IGZyYWdtZW50LmluZm9ybWF0aW9uX2FyaWFfbGFiZWwgfHwgaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4uYm9va2luZ19pbmZvcm1hdGlvbiwgeyBsYWJlbDogZnJhZ21lbnQubGFiZWwgfSApLFxuXHRcdFx0XHRcdGRldGFpbHNfYXJpYV9sYWJlbDogaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4uYm9va2luZ19kZXRhaWxzLCB7IGxhYmVsOiBmcmFnbWVudC5sYWJlbCB9IClcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdFx0dmFyIGZ1bGxfZGF5X2dyb3VwcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdHZhciBmdWxsX2RheV9mcmFnbWVudHMgPSBbXTtcblxuXHRcdFx0ZnVsbF9kYXlfZnJhZ21lbnRfdmlld3MuZm9yRWFjaCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdFx0dmFyIGdyb3VwX2tleSA9IFsgZnJhZ21lbnQuc291cmNlX3NlZ21lbnRfaWQsIGZyYWdtZW50LmJvb2tpbmdfaWQsIGZyYWdtZW50LnJlc291cmNlX2lkLCBmcmFnbWVudC5zdGFja19pbmRleCBdLmpvaW4oICd8JyApO1xuXG5cdFx0XHRcdGlmICggISBmdWxsX2RheV9ncm91cHNbIGdyb3VwX2tleSBdICkge1xuXHRcdFx0XHRcdGZ1bGxfZGF5X2dyb3Vwc1sgZ3JvdXBfa2V5IF0gPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmdWxsX2RheV9ncm91cHNbIGdyb3VwX2tleSBdLnB1c2goIGZyYWdtZW50ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHQvKipcblx0XHRcdCAqIEFwcGVuZCBvbmUgY29udGlndW91cyBmdWxsLWRheSBiYW5kIHdpdGhvdXQgYnJpZGdpbmcgYW4gdW5sb2FkZWQgZGF0ZS5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIGdyb3VwX2tleSBTdGFibGUgYm9va2luZyBhbmQgc3RhY2sgaWRlbnRpdHkuXG5cdFx0XHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IGZyYWdtZW50cyBDb25zZWN1dGl2ZSBwcm9qZWN0ZWQgZGF0ZSBmcmFnbWVudHMuXG5cdFx0XHQgKiBAcGFyYW0ge251bWJlcn0gICAgICAgIGJhbmRfaW5kZXggWmVyby1iYXNlZCBiYW5kIG51bWJlciB3aXRoaW4gdGhlIGdyb3VwLlxuXHRcdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHRcdCAqL1xuXHRcdFx0ZnVuY3Rpb24gYXBwZW5kX2Z1bGxfZGF5X2JhbmQoIGdyb3VwX2tleSwgZnJhZ21lbnRzLCBiYW5kX2luZGV4ICkge1xuXHRcdFx0XHR2YXIgZmlyc3RfZnJhZ21lbnQgPSBmcmFnbWVudHNbIDAgXTtcblx0XHRcdFx0dmFyIGxhc3RfZnJhZ21lbnQgPSBmcmFnbWVudHNbIGZyYWdtZW50cy5sZW5ndGggLSAxIF07XG5cdFx0XHRcdHZhciBmaXJzdF9kYXRlID0gZGF0ZV9ieV9rZXlbIGZpcnN0X2ZyYWdtZW50LmRhdGUgXTtcblx0XHRcdFx0dmFyIGxhc3RfZGF0ZSA9IGRhdGVfYnlfa2V5WyBsYXN0X2ZyYWdtZW50LmRhdGUgXTtcblx0XHRcdFx0dmFyIHNob3dzX2VhcmxpZXJfaW5kaWNhdG9yID0gQm9vbGVhbiggZmlyc3RfZnJhZ21lbnQuY29udGludWVzX2JlZm9yZV9kYXRlIHx8IGZpcnN0X2ZyYWdtZW50LmNvbnRpbnVlc19iZWZvcmVfbG9hZGVkX3dpbmRvdyApO1xuXHRcdFx0XHR2YXIgc2hvd3NfbGF0ZXJfaW5kaWNhdG9yID0gQm9vbGVhbiggbGFzdF9mcmFnbWVudC5jb250aW51ZXNfYWZ0ZXJfZGF0ZSB8fCBsYXN0X2ZyYWdtZW50LmNvbnRpbnVlc19hZnRlcl9sb2FkZWRfd2luZG93ICk7XG5cdFx0XHRcdHZhciBzY2hlZHVsZV9sYWJlbCA9IGZpcnN0X2ZyYWdtZW50LmRhdGUgPT09IGxhc3RfZnJhZ21lbnQuZGF0ZSA/IGZpcnN0X2ZyYWdtZW50LmRhdGUgOiBmaXJzdF9mcmFnbWVudC5kYXRlICsgJ1xcdTIwMTMnICsgbGFzdF9mcmFnbWVudC5kYXRlO1xuXHRcdFx0XHR2YXIgdmlld19mcmFnbWVudCA9IE9iamVjdC5hc3NpZ24oIHt9LCBmaXJzdF9mcmFnbWVudCwge1xuXHRcdFx0XHRcdGZyYWdtZW50X2lkczogZnJhZ21lbnRzLm1hcCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHsgcmV0dXJuIGZyYWdtZW50LmZyYWdtZW50X2lkOyB9ICksXG5cdFx0XHRcdFx0ZGF0ZV9lbmQ6IGxhc3RfZnJhZ21lbnQuZGF0ZSxcblx0XHRcdFx0XHRyZW5kZXJfc2VnbWVudF9pZDogJ3RpbWUtcm93c3xmdWxsLWRheXwnICsgZ3JvdXBfa2V5ICsgJ3wnICsgYmFuZF9pbmRleCArICd8JyArIGZpcnN0X2ZyYWdtZW50LmRhdGUgKyAnfCcgKyBsYXN0X2ZyYWdtZW50LmRhdGUsXG5cdFx0XHRcdFx0bGVmdF9wZXJjZW50OiBmaXJzdF9kYXRlID8gZmlyc3RfZGF0ZS5vZmZzZXRfcGVyY2VudCA6IDAsXG5cdFx0XHRcdFx0d2lkdGhfcGVyY2VudDogZmlyc3RfZGF0ZSAmJiBsYXN0X2RhdGUgPyBsYXN0X2RhdGUub2Zmc2V0X3BlcmNlbnQgKyBsYXN0X2RhdGUud2lkdGhfcGVyY2VudCAtIGZpcnN0X2RhdGUub2Zmc2V0X3BlcmNlbnQgOiAwLFxuXHRcdFx0XHRcdHNjaGVkdWxlX2xhYmVsOiBzY2hlZHVsZV9sYWJlbCxcblx0XHRcdFx0XHRzaG93c19lYXJsaWVyX2luZGljYXRvcjogc2hvd3NfZWFybGllcl9pbmRpY2F0b3IsXG5cdFx0XHRcdFx0c2hvd3NfbGF0ZXJfaW5kaWNhdG9yOiBzaG93c19sYXRlcl9pbmRpY2F0b3IsXG5cdFx0XHRcdFx0YXJpYV9sYWJlbDogWyBmaXJzdF9mcmFnbWVudC5sYWJlbCwgc2NoZWR1bGVfbGFiZWwsIGZpcnN0X2ZyYWdtZW50LnN0YXR1c19sYWJlbCwgc2hvd3NfZWFybGllcl9pbmRpY2F0b3IgPyBpMThuLmNvbnRpbnVlZF9iZWZvcmUgOiAnJywgc2hvd3NfbGF0ZXJfaW5kaWNhdG9yID8gaTE4bi5jb250aW51ZWRfYWZ0ZXIgOiAnJyBdLmZpbHRlciggQm9vbGVhbiApLmpvaW4oICcsICcgKVxuXHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0cmVnaXN0ZXJfZnJhZ21lbnQoIGZpcnN0X2ZyYWdtZW50LCB2aWV3X2ZyYWdtZW50LCAnaG9yaXpvbnRhbCcgKTtcblx0XHRcdFx0ZnVsbF9kYXlfZnJhZ21lbnRzLnB1c2goIHZpZXdfZnJhZ21lbnQgKTtcblx0XHRcdH1cblxuXHRcdFx0T2JqZWN0LmtleXMoIGZ1bGxfZGF5X2dyb3VwcyApLnNvcnQoKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGdyb3VwX2tleSApIHtcblx0XHRcdFx0dmFyIGZyYWdtZW50cyA9IGZ1bGxfZGF5X2dyb3Vwc1sgZ3JvdXBfa2V5IF0uc29ydCggZnVuY3Rpb24gKCBsZWZ0LCByaWdodCApIHtcblx0XHRcdFx0XHRyZXR1cm4gbGVmdC5kYXRlX2luZGV4IC0gcmlnaHQuZGF0ZV9pbmRleCB8fCBsZWZ0LnN0YXJ0X2Vwb2NoIC0gcmlnaHQuc3RhcnRfZXBvY2g7XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0dmFyIGNvbnRpZ3VvdXNfZnJhZ21lbnRzID0gW107XG5cdFx0XHRcdHZhciBiYW5kX2luZGV4ID0gMDtcblxuXHRcdFx0XHRmcmFnbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdFx0XHR2YXIgcHJldmlvdXNfZnJhZ21lbnQgPSBjb250aWd1b3VzX2ZyYWdtZW50c1sgY29udGlndW91c19mcmFnbWVudHMubGVuZ3RoIC0gMSBdO1xuXG5cdFx0XHRcdFx0aWYgKCBwcmV2aW91c19mcmFnbWVudCAmJiBmcmFnbWVudC5kYXRlX2luZGV4ICE9PSBwcmV2aW91c19mcmFnbWVudC5kYXRlX2luZGV4ICsgMSApIHtcblx0XHRcdFx0XHRcdGFwcGVuZF9mdWxsX2RheV9iYW5kKCBncm91cF9rZXksIGNvbnRpZ3VvdXNfZnJhZ21lbnRzLCBiYW5kX2luZGV4ICk7XG5cdFx0XHRcdFx0XHRjb250aWd1b3VzX2ZyYWdtZW50cyA9IFtdO1xuXHRcdFx0XHRcdFx0YmFuZF9pbmRleCArPSAxO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb250aWd1b3VzX2ZyYWdtZW50cy5wdXNoKCBmcmFnbWVudCApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggY29udGlndW91c19mcmFnbWVudHMubGVuZ3RoICkge1xuXHRcdFx0XHRcdGFwcGVuZF9mdWxsX2RheV9iYW5kKCBncm91cF9rZXksIGNvbnRpZ3VvdXNfZnJhZ21lbnRzLCBiYW5kX2luZGV4ICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdHZhciB0aW1lZF9mcmFnbWVudHMgPSBwcm9qZWN0aW9uLnRpbWVkX2ZyYWdtZW50cy5tYXAoIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRcdHZhciBkYXRlID0gZGF0ZV9ieV9rZXlbIGZyYWdtZW50LmRhdGUgXTtcblx0XHRcdFx0dmFyIGxhbmVfY291bnQgPSBNYXRoLm1heCggMSwgTnVtYmVyKCBmcmFnbWVudC5sYW5lX2NvdW50IHx8IDEgKSApO1xuXHRcdFx0XHR2YXIgc2NoZWR1bGVfbGFiZWwgPSBnZXRfdGltZWRfc2NoZWR1bGVfbGFiZWwoIGZyYWdtZW50LCBkYXRlICk7XG5cdFx0XHRcdHZhciBzdGF0dXNfbGFiZWwgPSBnZXRfYm9va2luZ19zdGF0dXNfbGFiZWwoIGZyYWdtZW50LnN0YXR1cyApO1xuXHRcdFx0XHR2YXIgc2hvd3NfZWFybGllcl9pbmRpY2F0b3IgPSBCb29sZWFuKCBmcmFnbWVudC5pc19jbGlwcGVkX2Fib3ZlIHx8IGZyYWdtZW50LmNvbnRpbnVlc19iZWZvcmVfZGF0ZSB8fCBmcmFnbWVudC5jb250aW51ZXNfYmVmb3JlX2ZyYWdtZW50IHx8IGZyYWdtZW50LmNvbnRpbnVlc19iZWZvcmVfbG9hZGVkX3dpbmRvdyApO1xuXHRcdFx0XHR2YXIgc2hvd3NfbGF0ZXJfaW5kaWNhdG9yID0gQm9vbGVhbiggZnJhZ21lbnQuaXNfY2xpcHBlZF9iZWxvdyB8fCBmcmFnbWVudC5jb250aW51ZXNfYWZ0ZXJfZGF0ZSB8fCBmcmFnbWVudC5jb250aW51ZXNfYWZ0ZXJfZnJhZ21lbnQgfHwgZnJhZ21lbnQuY29udGludWVzX2FmdGVyX2xvYWRlZF93aW5kb3cgKTtcblx0XHRcdFx0dmFyIHZpZXdfZnJhZ21lbnQgPSBPYmplY3QuYXNzaWduKCB7fSwgZnJhZ21lbnQsIHtcblx0XHRcdFx0XHRyZW5kZXJfc2VnbWVudF9pZDogJ3RpbWUtcm93c3wnICsgZnJhZ21lbnQuZnJhZ21lbnRfaWQsXG5cdFx0XHRcdFx0bGVmdF9wZXJjZW50OiBkYXRlID8gZGF0ZS5vZmZzZXRfcGVyY2VudCArIGRhdGUud2lkdGhfcGVyY2VudCAqIE51bWJlciggZnJhZ21lbnQubGFuZV9pbmRleCB8fCAwICkgLyBsYW5lX2NvdW50IDogMCxcblx0XHRcdFx0XHR3aWR0aF9wZXJjZW50OiBkYXRlID8gZGF0ZS53aWR0aF9wZXJjZW50IC8gbGFuZV9jb3VudCA6IDAsXG5cdFx0XHRcdFx0c2NoZWR1bGVfbGFiZWw6IHNjaGVkdWxlX2xhYmVsLFxuXHRcdFx0XHRcdHN0YXR1c19sYWJlbDogc3RhdHVzX2xhYmVsLFxuXHRcdFx0XHRcdHNob3dzX2VhcmxpZXJfaW5kaWNhdG9yOiBzaG93c19lYXJsaWVyX2luZGljYXRvcixcblx0XHRcdFx0XHRzaG93c19sYXRlcl9pbmRpY2F0b3I6IHNob3dzX2xhdGVyX2luZGljYXRvcixcblx0XHRcdFx0XHRhcmlhX2xhYmVsOiBbIGZyYWdtZW50LmxhYmVsLCBzY2hlZHVsZV9sYWJlbCwgc3RhdHVzX2xhYmVsLCBzaG93c19lYXJsaWVyX2luZGljYXRvciA/IGkxOG4uY29udGludWVkX2JlZm9yZSA6ICcnLCBzaG93c19sYXRlcl9pbmRpY2F0b3IgPyBpMThuLmNvbnRpbnVlZF9hZnRlciA6ICcnIF0uZmlsdGVyKCBCb29sZWFuICkuam9pbiggJywgJyApLFxuXHRcdFx0XHRcdHNlbGVjdGlvbl9hcmlhX2xhYmVsOiBmcmFnbWVudC5zZWxlY3Rpb25fYXJpYV9sYWJlbCB8fCBpbnRlcnBvbGF0ZV9sYWJlbCggaTE4bi5zZWxlY3RfYm9va2luZywgeyBsYWJlbDogZnJhZ21lbnQubGFiZWwgfSApLFxuXHRcdFx0XHRcdGluZm9ybWF0aW9uX2FyaWFfbGFiZWw6IGZyYWdtZW50LmluZm9ybWF0aW9uX2FyaWFfbGFiZWwgfHwgaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4uYm9va2luZ19pbmZvcm1hdGlvbiwgeyBsYWJlbDogZnJhZ21lbnQubGFiZWwgfSApLFxuXHRcdFx0XHRcdGRldGFpbHNfYXJpYV9sYWJlbDogaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4uYm9va2luZ19kZXRhaWxzLCB7IGxhYmVsOiBmcmFnbWVudC5sYWJlbCB9IClcblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdHJlZ2lzdGVyX2ZyYWdtZW50KCBmcmFnbWVudCwgdmlld19mcmFnbWVudCwgJ3ZlcnRpY2FsJyApO1xuXHRcdFx0XHRyZXR1cm4gdmlld19mcmFnbWVudDtcblx0XHRcdH0gKTtcblx0XHRcdHZhciB0aW1lZF9mcmFnbWVudF9ieV9pZCA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdHRpbWVkX2ZyYWdtZW50cy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkge1xuXHRcdFx0XHR0aW1lZF9mcmFnbWVudF9ieV9pZFsgZnJhZ21lbnQuZnJhZ21lbnRfaWQgXSA9IGZyYWdtZW50O1xuXHRcdFx0fSApO1xuXHRcdFx0dmFyIGFsbF9kYXlfc3RhY2tfY291bnQgPSBmdWxsX2RheV9mcmFnbWVudF92aWV3cy5yZWR1Y2UoIGZ1bmN0aW9uICggc3RhY2tfY291bnQsIGZyYWdtZW50ICkge1xuXHRcdFx0XHRyZXR1cm4gTWF0aC5tYXgoIHN0YWNrX2NvdW50LCBOdW1iZXIoIGZyYWdtZW50LnN0YWNrX2NvdW50IHx8IDEgKSApO1xuXHRcdFx0fSwgMSApO1xuXHRcdFx0dmFyIHN1bW1hcnlfZnJhZ21lbnRfYnlfaWQgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR2YXIgc3VtbWFyeV9yZWNvcmRzO1xuXG5cdFx0XHRmdWxsX2RheV9mcmFnbWVudF92aWV3cy5jb25jYXQoIHRpbWVkX2ZyYWdtZW50cyApLmZvckVhY2goIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRcdHN1bW1hcnlfZnJhZ21lbnRfYnlfaWRbIGZyYWdtZW50LmZyYWdtZW50X2lkIF0gPSBmcmFnbWVudDtcblx0XHRcdH0gKTtcblx0XHRcdHN1bW1hcnlfcmVjb3JkcyA9IHByb2plY3Rpb24uc3VtbWFyeS5tYXAoIGZ1bmN0aW9uICggcmVjb3JkICkge1xuXHRcdFx0XHR2YXIgc291cmNlX2ZyYWdtZW50ID0gc3VtbWFyeV9mcmFnbWVudF9ieV9pZFsgcmVjb3JkLmZyYWdtZW50X2lkIF07XG5cdFx0XHRcdHZhciBkYXRlID0gZGF0ZV9ieV9rZXlbIHJlY29yZC5kYXRlIF07XG5cdFx0XHRcdHZhciBjb250aW51YXRpb25fbGFiZWxzID0gW107XG5cdFx0XHRcdHZhciB0aW1lX2xhYmVsID0gcmVjb3JkLmRhdGUgJiYgJ2Z1bGxfZGF5X2Jvb2tpbmcnICE9PSByZWNvcmQua2luZFxuXHRcdFx0XHRcdD8gZm9ybWF0X3dhbGxfbWludXRlKCByZWNvcmQuc3RhcnRfbWludXRlICkgKyAnXFx1MjAxMycgKyBmb3JtYXRfd2FsbF9taW51dGUoIHJlY29yZC5lbmRfbWludXRlIClcblx0XHRcdFx0XHQ6ICcnO1xuXG5cdFx0XHRcdGlmICggc291cmNlX2ZyYWdtZW50ICYmICd0aW1lZF9ib29raW5nJyA9PT0gcmVjb3JkLmtpbmQgKSB7XG5cdFx0XHRcdFx0dGltZV9sYWJlbCA9IGdldF90aW1lZF9zY2hlZHVsZV9sYWJlbCggc291cmNlX2ZyYWdtZW50LCBkYXRlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzb3VyY2VfZnJhZ21lbnQgJiYgKFxuXHRcdFx0XHRcdHNvdXJjZV9mcmFnbWVudC5pc19jbGlwcGVkX2Fib3ZlXG5cdFx0XHRcdFx0fHwgc291cmNlX2ZyYWdtZW50LmNvbnRpbnVlc19iZWZvcmVfZGF0ZVxuXHRcdFx0XHRcdHx8IHNvdXJjZV9mcmFnbWVudC5jb250aW51ZXNfYmVmb3JlX2ZyYWdtZW50XG5cdFx0XHRcdFx0fHwgc291cmNlX2ZyYWdtZW50LmNvbnRpbnVlc19iZWZvcmVfbG9hZGVkX3dpbmRvd1xuXHRcdFx0XHQpICkge1xuXHRcdFx0XHRcdGNvbnRpbnVhdGlvbl9sYWJlbHMucHVzaCggaTE4bi5jb250aW51ZWRfYmVmb3JlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzb3VyY2VfZnJhZ21lbnQgJiYgKFxuXHRcdFx0XHRcdHNvdXJjZV9mcmFnbWVudC5pc19jbGlwcGVkX2JlbG93XG5cdFx0XHRcdFx0fHwgc291cmNlX2ZyYWdtZW50LmNvbnRpbnVlc19hZnRlcl9kYXRlXG5cdFx0XHRcdFx0fHwgc291cmNlX2ZyYWdtZW50LmNvbnRpbnVlc19hZnRlcl9mcmFnbWVudFxuXHRcdFx0XHRcdHx8IHNvdXJjZV9mcmFnbWVudC5jb250aW51ZXNfYWZ0ZXJfbG9hZGVkX3dpbmRvd1xuXHRcdFx0XHQpICkge1xuXHRcdFx0XHRcdGNvbnRpbnVhdGlvbl9sYWJlbHMucHVzaCggaTE4bi5jb250aW51ZWRfYWZ0ZXIgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbigge30sIHJlY29yZCwge1xuXHRcdFx0XHRcdGtpbmRfbGFiZWw6IGdldF9zdW1tYXJ5X2tpbmRfbGFiZWwoIHJlY29yZC5raW5kICksXG5cdFx0XHRcdFx0dGltZV9sYWJlbDogdGltZV9sYWJlbCxcblx0XHRcdFx0XHRzdGF0dXNfbGFiZWw6IHNvdXJjZV9mcmFnbWVudCA/IGdldF9ib29raW5nX3N0YXR1c19sYWJlbCggc291cmNlX2ZyYWdtZW50LnN0YXR1cyApIDogJycsXG5cdFx0XHRcdFx0Y29udGludWF0aW9uX2xhYmVsOiBjb250aW51YXRpb25fbGFiZWxzLmZpbHRlciggQm9vbGVhbiApLmpvaW4oICcsICcgKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRkYXRlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGRhdGUgKSB7XG5cdFx0XHRcdGRhdGUuZHN0X3NsaWNlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRcdFx0c3VtbWFyeV9yZWNvcmRzLnB1c2goIHtcblx0XHRcdFx0XHRcdHN1bW1hcnlfaWQ6ICdzdW1tYXJ5fGRzdHwnICsgZGF0ZS5kYXRlICsgJ3wnICsgdHJhbnNpdGlvbi50cmFuc2l0aW9uX2lkLFxuXHRcdFx0XHRcdFx0a2luZDogJ2RzdF90cmFuc2l0aW9uJyxcblx0XHRcdFx0XHRcdGtpbmRfbGFiZWw6IGdldF9zdW1tYXJ5X2tpbmRfbGFiZWwoICdkc3RfdHJhbnNpdGlvbicgKSxcblx0XHRcdFx0XHRcdGRhdGU6IGRhdGUuZGF0ZSxcblx0XHRcdFx0XHRcdHN0YXJ0X21pbnV0ZTogdHJhbnNpdGlvbi5zdGFydF9taW51dGUsXG5cdFx0XHRcdFx0XHRlbmRfbWludXRlOiB0cmFuc2l0aW9uLmVuZF9taW51dGUsXG5cdFx0XHRcdFx0XHR0aW1lX2xhYmVsOiBmb3JtYXRfd2FsbF9taW51dGUoIHRyYW5zaXRpb24uc3RhcnRfbWludXRlICkgKyAnXFx1MjAxMycgKyBmb3JtYXRfd2FsbF9taW51dGUoIHRyYW5zaXRpb24uZW5kX21pbnV0ZSApLFxuXHRcdFx0XHRcdFx0bGFiZWw6IHRyYW5zaXRpb24ubGFiZWwsXG5cdFx0XHRcdFx0XHRzdGF0dXNfbGFiZWw6ICcnLFxuXHRcdFx0XHRcdFx0Y29udGludWF0aW9uX2xhYmVsOiAnJ1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdFx0c3VtbWFyeV9yZWNvcmRzLnNvcnQoIGZ1bmN0aW9uICggbGVmdCwgcmlnaHQgKSB7XG5cdFx0XHRcdGlmICggISBsZWZ0LmRhdGUgJiYgISByaWdodC5kYXRlICkge1xuXHRcdFx0XHRcdHJldHVybiBTdHJpbmcoIGxlZnQuc3VtbWFyeV9pZCB8fCAnJyApLmxvY2FsZUNvbXBhcmUoIFN0cmluZyggcmlnaHQuc3VtbWFyeV9pZCB8fCAnJyApICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIGxlZnQuZGF0ZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoICEgcmlnaHQuZGF0ZSApIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGxlZnQuZGF0ZS5sb2NhbGVDb21wYXJlKCByaWdodC5kYXRlIClcblx0XHRcdFx0XHR8fCBOdW1iZXIoIGxlZnQuc3RhcnRfbWludXRlIHx8IDAgKSAtIE51bWJlciggcmlnaHQuc3RhcnRfbWludXRlIHx8IDAgKVxuXHRcdFx0XHRcdHx8IE51bWJlciggbGVmdC5lbmRfbWludXRlIHx8IDAgKSAtIE51bWJlciggcmlnaHQuZW5kX21pbnV0ZSB8fCAwIClcblx0XHRcdFx0XHR8fCBTdHJpbmcoIGxlZnQuc3VtbWFyeV9pZCB8fCAnJyApLmxvY2FsZUNvbXBhcmUoIFN0cmluZyggcmlnaHQuc3VtbWFyeV9pZCB8fCAnJyApICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHpvb21fcGVyY2VudCA9IG5vcm1hbGl6ZV96b29tX3BlcmNlbnQoIHpvb21fcGVyY2VudCApO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzY2hlbWFfdmVyc2lvbjogTnVtYmVyKCBjb25maWd1cmF0aW9uLnNjaGVtYV92ZXJzaW9uICkgfHwgMSxcblx0XHRcdFx0Y2FjaGVfa2V5OiBwcm9qZWN0aW9uLmNhY2hlX2tleSxcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IHByb2plY3Rpb24ucmVzb3VyY2VfaWQsXG5cdFx0XHRcdHRpbWV6b25lOiBwcm9qZWN0aW9uLnRpbWV6b25lLFxuXHRcdFx0XHRyYW5nZTogT2JqZWN0LmFzc2lnbigge30sIHByb2plY3Rpb24ucmFuZ2UsIHtcblx0XHRcdFx0XHRsYWJlbDogZm9ybWF0X3dhbGxfbWludXRlKCBwcm9qZWN0aW9uLnJhbmdlLnN0YXJ0X21pbnV0ZSApICsgJ+KAkycgKyBmb3JtYXRfd2FsbF9taW51dGUoIHByb2plY3Rpb24ucmFuZ2UuZW5kX21pbnV0ZSApLFxuXHRcdFx0XHRcdHN0YXJ0X2xhYmVsOiBmb3JtYXRfd2FsbF9taW51dGUoIHByb2plY3Rpb24ucmFuZ2Uuc3RhcnRfbWludXRlICksXG5cdFx0XHRcdFx0ZW5kX2xhYmVsOiBmb3JtYXRfd2FsbF9taW51dGUoIHByb2plY3Rpb24ucmFuZ2UuZW5kX21pbnV0ZSApLFxuXHRcdFx0XHRcdHN0YXJ0X3BlcmNlbnQ6IE51bWJlciggKCAxMDAgKiBwcm9qZWN0aW9uLnJhbmdlLnN0YXJ0X21pbnV0ZSAvIDE0NDAgKS50b0ZpeGVkKCA4ICkgKSxcblx0XHRcdFx0XHRlbmRfcGVyY2VudDogTnVtYmVyKCAoIDEwMCAqIHByb2plY3Rpb24ucmFuZ2UuZW5kX21pbnV0ZSAvIDE0NDAgKS50b0ZpeGVkKCA4ICkgKSxcblx0XHRcdFx0XHRzdGVwX21pbnV0ZXM6IHJhbmdlX3N0ZXBfbWludXRlcyxcblx0XHRcdFx0XHRzdGFydF9hcmlhX2xhYmVsOiBpbnRlcnBvbGF0ZV9sYWJlbCggaTE4bi50aW1lX3JhbmdlX3N0YXJ0LCB7IHRpbWU6IGZvcm1hdF93YWxsX21pbnV0ZSggcHJvamVjdGlvbi5yYW5nZS5zdGFydF9taW51dGUgKSB9ICksXG5cdFx0XHRcdFx0ZW5kX2FyaWFfbGFiZWw6IGludGVycG9sYXRlX2xhYmVsKCBpMThuLnRpbWVfcmFuZ2VfZW5kLCB7IHRpbWU6IGZvcm1hdF93YWxsX21pbnV0ZSggcHJvamVjdGlvbi5yYW5nZS5lbmRfbWludXRlICkgfSApLFxuXHRcdFx0XHRcdGF1dG9fbGFiZWw6IGludGVycG9sYXRlX2xhYmVsKCBpMThuLmF1dG9fcmFuZ2VfbGFiZWwsIHtcblx0XHRcdFx0XHRcdHJhbmdlOiBmb3JtYXRfd2FsbF9taW51dGUoIHByb2plY3Rpb24ucmFuZ2Uuc3RhcnRfbWludXRlICkgKyAn4oCTJyArIGZvcm1hdF93YWxsX21pbnV0ZSggcHJvamVjdGlvbi5yYW5nZS5lbmRfbWludXRlIClcblx0XHRcdFx0XHR9ICksXG5cdFx0XHRcdFx0cHJlc2V0czogZ2V0X3RpbWVfcmFuZ2VfcHJlc2V0cygpLm1hcCggZnVuY3Rpb24gKCBwcmVzZXQgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbigge30sIHByZXNldCwge1xuXHRcdFx0XHRcdFx0XHRpc19hY3RpdmU6ICEhIG1hdGNoaW5nX3JhbmdlX3ByZXNldCAmJiBtYXRjaGluZ19yYW5nZV9wcmVzZXQuaWQgPT09IHByZXNldC5pZFxuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdH0gKVxuXHRcdFx0XHR9ICksXG5cdFx0XHRcdHpvb206IHtcblx0XHRcdFx0XHRwZXJjZW50OiB6b29tX3BlcmNlbnQsXG5cdFx0XHRcdFx0bWluX3BlcmNlbnQ6IHpvb20ubWluX3BlcmNlbnQsXG5cdFx0XHRcdFx0bWF4X3BlcmNlbnQ6IHpvb20ubWF4X3BlcmNlbnQsXG5cdFx0XHRcdFx0c3RlcF9wZXJjZW50OiB6b29tLnN0ZXBfcGVyY2VudCxcblx0XHRcdFx0XHRsYWJlbDogaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4udGltZV96b29tX3ZhbHVlLCB7IHBlcmNlbnQ6IHpvb21fcGVyY2VudCB9IClcblx0XHRcdFx0fSxcblx0XHRcdFx0Ym9keV9oZWlnaHRfcHg6IE1hdGgubWF4KCB6b29tLm1pbmltdW1fYm9keV9oZWlnaHRfcHgsIE1hdGgucm91bmQoIHByb2plY3Rpb24ucmFuZ2Uuc3Bhbl9taW51dGVzIC8gNjAgKiB6b29tLmhvdXJfaGVpZ2h0X3B4ICogem9vbV9wZXJjZW50IC8gMTAwICkgKSxcblx0XHRcdFx0YWxsX2RheV9oZWlnaHRfcHg6IE1hdGgubWF4KCA0NCwgMTIgKyAzNCAqIGFsbF9kYXlfc3RhY2tfY291bnQgKSxcblx0XHRcdFx0dGltZV90aWNrczogYnVpbGRfdGltZV90aWNrcyggcHJvamVjdGlvbi5yYW5nZSApLFxuXHRcdFx0XHRkYXRlczogZGF0ZXMsXG5cdFx0XHRcdGZ1bGxfZGF5X2ZyYWdtZW50czogZnVsbF9kYXlfZnJhZ21lbnRzLFxuXHRcdFx0XHR0aW1lZF9mcmFnbWVudHM6IHRpbWVkX2ZyYWdtZW50cyxcblx0XHRcdFx0b3ZlcmZsb3dfZ3JvdXBzOiBwcm9qZWN0aW9uLm92ZXJmbG93X2dyb3Vwcy5tYXAoIGZ1bmN0aW9uICggb3ZlcmZsb3cgKSB7XG5cdFx0XHRcdFx0dmFyIGRhdGUgPSBkYXRlX2J5X2tleVsgb3ZlcmZsb3cuZGF0ZSBdO1xuXHRcdFx0XHRcdHZhciByZWNvcmRzID0gb3ZlcmZsb3cuZnJhZ21lbnRfaWRzLm1hcCggZnVuY3Rpb24gKCBmcmFnbWVudF9pZCApIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aW1lZF9mcmFnbWVudF9ieV9pZFsgZnJhZ21lbnRfaWQgXTtcblx0XHRcdFx0XHR9ICkuZmlsdGVyKCBCb29sZWFuICk7XG5cdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oIHt9LCBvdmVyZmxvdywge1xuXHRcdFx0XHRcdFx0bGVmdF9wZXJjZW50OiBkYXRlID8gZGF0ZS5vZmZzZXRfcGVyY2VudCArIDAuNjggKiBkYXRlLndpZHRoX3BlcmNlbnQgOiAwLFxuXHRcdFx0XHRcdFx0d2lkdGhfcGVyY2VudDogZGF0ZSA/IDAuMyAqIGRhdGUud2lkdGhfcGVyY2VudCA6IDAsXG5cdFx0XHRcdFx0XHR0b3BfcGVyY2VudDogTnVtYmVyKCAoIDEwMCAqICggb3ZlcmZsb3cuc3RhcnRfd2FsbF9taW51dGUgLSBwcm9qZWN0aW9uLnJhbmdlLnN0YXJ0X21pbnV0ZSApIC8gcHJvamVjdGlvbi5yYW5nZS5zcGFuX21pbnV0ZXMgKS50b0ZpeGVkKCA4ICkgKSxcblx0XHRcdFx0XHRcdHJlY29yZHM6IHJlY29yZHMsXG5cdFx0XHRcdFx0XHRhcmlhX2xhYmVsOiBpbnRlcnBvbGF0ZV9sYWJlbCggaTE4bi5tb3JlX2Jvb2tpbmdzLCB7IGNvdW50OiByZWNvcmRzLmxlbmd0aCB9IClcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH0gKSxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3NsaWNlczogcHJvamVjdGlvbi5hdmFpbGFiaWxpdHkuc2xpY2VzLm1hcCggZnVuY3Rpb24gKCBzbGljZSApIHtcblx0XHRcdFx0XHR2YXIgZGF0ZSA9IGRhdGVfYnlfa2V5WyBzbGljZS5kYXRlIF07XG5cdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oIHt9LCBzbGljZSwge1xuXHRcdFx0XHRcdFx0bGVmdF9wZXJjZW50OiBkYXRlID8gZGF0ZS5vZmZzZXRfcGVyY2VudCA6IDAsXG5cdFx0XHRcdFx0XHR3aWR0aF9wZXJjZW50OiBkYXRlID8gZGF0ZS53aWR0aF9wZXJjZW50IDogMCxcblx0XHRcdFx0XHRcdGNzc19jbGFzczogZ2V0X2F2YWlsYWJpbGl0eV9jc3NfY2xhc3MoIHNsaWNlLndpbm5pbmdfc291cmNlICksXG5cdFx0XHRcdFx0XHRsYWJlbDogc2xpY2Uuc291cmNlX2xhYmVscy5qb2luKCAnLCAnICkgfHwgaTE4bi5hdmFpbGFiaWxpdHlfdW5rbm93blxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fSApLFxuXHRcdFx0XHRhdmFpbGFiaWxpdHlfc3RhdGU6IHtcblx0XHRcdFx0XHRzdGF0ZTogcHJvamVjdGlvbi5hdmFpbGFiaWxpdHkuc3RhdGUsXG5cdFx0XHRcdFx0bWVzc2FnZTogJ3BhcnRpYWwnID09PSBwcm9qZWN0aW9uLmF2YWlsYWJpbGl0eS5zdGF0ZVxuXHRcdFx0XHRcdFx0PyBpMThuLmF2YWlsYWJpbGl0eV9wYXJ0aWFsXG5cdFx0XHRcdFx0XHQ6ICggJ2ZhaWxlZCcgPT09IHByb2plY3Rpb24uYXZhaWxhYmlsaXR5LnN0YXRlID8gaTE4bi5hdmFpbGFiaWxpdHlfZmFpbGVkIDogaTE4bi5hdmFpbGFiaWxpdHlfbG9hZGluZyApXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHN1bW1hcnlfcmVjb3Jkczogc3VtbWFyeV9yZWNvcmRzLFxuXHRcdFx0XHRpMThuOiBpMThuLFxuXHRcdFx0XHRyZWdpc3RyYXRpb25zOiByZWdpc3RyYXRpb25zLFxuXHRcdFx0XHRyZXNvdXJjZV9zdW1tYXJ5OiBnZXRfc291cmNlX3Jlc291cmNlKCBwcm9qZWN0aW9uLnJlc291cmNlX2lkIClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBjdXJyZW50IHN5bmNocm9uaXplZCBwcmVzZW50YXRpb24gaG9zdHMgZm9yIG9uZSBSZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge0FycmF5PEVsZW1lbnQ+fSBDdXJyZW50IFJlc291cmNlIGFuZCBjYW52YXMgaG9zdHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X2N1cnJlbnRfaG9zdHMoIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIGhvc3RzID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yb3ctcHJlc2VudGF0aW9uLWhvc3RdJyApIDogW107XG5cblx0XHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoIGhvc3RzLCBmdW5jdGlvbiAoIGhvc3QgKSB7XG5cdFx0XHRcdHJldHVybiBOdW1iZXIoIGhvc3QuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWlkJyApICkgPT09IE51bWJlciggcmVzb3VyY2VfaWQgKVxuXHRcdFx0XHRcdCYmIHByZXNlbnRhdGlvbl9pZCA9PT0gU3RyaW5nKCBob3N0LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yb3ctcHJlc2VudGF0aW9uLWhvc3QnICkgfHwgJycgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWdpc3RlciB2aXNpYmxlIGxvY2FsIGJvb2tpbmcgcHJvamVjdGlvbnMgd2l0aCBjYW5vbmljYWwgcmVhZC1vbmx5IGFjdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0FycmF5PEVsZW1lbnQ+fSBjYW52YXNfaG9zdHMgUmVuZGVyZWQgY2FudmFzLXNpZGUgaG9zdHMuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IG1vZGVsIFByZXNlbnRhdGlvbiBtb2RlbCBhbmQgY2Fub25pY2FsIHJlZ2lzdHJhdGlvbnMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWdpc3Rlcl9yZWFkX29ubHlfYm9va2luZ19hY3Rpb25zKCBjYW52YXNfaG9zdHMsIG1vZGVsICkge1xuXHRcdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblx0XHRcdHZhciBib29raW5nX2ludGVyYWN0aW9ucyA9IG1vZHVsZV9ydW50aW1lICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5nZXRfaW5zdGFuY2Vcblx0XHRcdFx0PyBtb2R1bGVfcnVudGltZS5nZXRfaW5zdGFuY2UoICd3cGJjX3RpbWVsaW5lX2Jvb2tpbmdfaW50ZXJhY3Rpb25zJyApXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdHZhciByZWdpc3RyYXRpb25fYnlfaWQgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR2YXIgaW50ZXJhY3Rpb25fY29udGV4dCA9IGdldF9pbnRlcmFjdGlvbl9nZW9tZXRyeV9jb250ZXh0KCBtb2RlbC5yZXNvdXJjZV9pZCApO1xuXHRcdFx0dmFyIHJlZnJlc2hfY29udGV4dDtcblxuXHRcdFx0aWYgKCAhIGJvb2tpbmdfaW50ZXJhY3Rpb25zIHx8ICEgaW50ZXJhY3Rpb25fY29udGV4dCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgYm9va2luZ19pbnRlcmFjdGlvbnMucmVnaXN0ZXJfcmVhZF9vbmx5X3NlZ21lbnQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlZnJlc2hfY29udGV4dCA9IHtcblx0XHRcdFx0cHJlc2VudGF0aW9uX2lkOiBwcmVzZW50YXRpb25faWQsXG5cdFx0XHRcdHJlc291cmNlX2lkOiBOdW1iZXIoIG1vZGVsLnJlc291cmNlX2lkICksXG5cdFx0XHRcdGNhY2hlX2tleTogU3RyaW5nKCBpbnRlcmFjdGlvbl9jb250ZXh0LmNhY2hlX2tleSB8fCAnJyApLFxuXHRcdFx0XHRhY2NlcHRlZF9pZGVudGl0eTogaW50ZXJhY3Rpb25fY29udGV4dC5hY2NlcHRlZF9pZGVudGl0eSB8fCB7fSxcblx0XHRcdFx0dmlzaWJsZV9yYW5nZTogaW50ZXJhY3Rpb25fY29udGV4dC52aXNpYmxlX3JhbmdlIHx8IHt9LFxuXHRcdFx0XHR6b29tX3BlcmNlbnQ6IE51bWJlciggaW50ZXJhY3Rpb25fY29udGV4dC56b29tX3BlcmNlbnQgfHwgMCApXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19pbnRlcmFjdGlvbnMuYmVnaW5fcmVhZF9vbmx5X3JlZnJlc2ggKSB7XG5cdFx0XHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zLmJlZ2luX3JlYWRfb25seV9yZWZyZXNoKCByZWZyZXNoX2NvbnRleHQgKTtcblx0XHRcdH1cblx0XHRcdG1vZGVsLnJlZ2lzdHJhdGlvbnMuZm9yRWFjaCggZnVuY3Rpb24gKCByZWdpc3RyYXRpb24gKSB7XG5cdFx0XHRcdHJlZ2lzdHJhdGlvbl9ieV9pZFsgcmVnaXN0cmF0aW9uLnJlbmRlcl9zZWdtZW50X2lkIF0gPSByZWdpc3RyYXRpb247XG5cdFx0XHR9ICk7XG5cdFx0XHRjYW52YXNfaG9zdHMuZm9yRWFjaCggZnVuY3Rpb24gKCBob3N0ICkge1xuXHRcdFx0XHR2YXIgY2FyZHMgPSBob3N0ICYmIGhvc3QucXVlcnlTZWxlY3RvckFsbCA/IGhvc3QucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJlYWQtb25seV0nICkgOiBbXTtcblxuXHRcdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBjYXJkcywgZnVuY3Rpb24gKCBjYXJkICkge1xuXHRcdFx0XHRcdHZhciByZW5kZXJfc2VnbWVudF9pZCA9IFN0cmluZyggY2FyZC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudC1pZCcgKSB8fCAnJyApO1xuXHRcdFx0XHRcdHZhciByZWdpc3RyYXRpb24gPSByZWdpc3RyYXRpb25fYnlfaWRbIHJlbmRlcl9zZWdtZW50X2lkIF07XG5cblx0XHRcdFx0XHRpZiAoIHJlZ2lzdHJhdGlvbiApIHtcblx0XHRcdFx0XHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zLnJlZ2lzdGVyX3JlYWRfb25seV9zZWdtZW50KFxuXHRcdFx0XHRcdFx0XHRjYXJkLFxuXHRcdFx0XHRcdFx0XHRyZWdpc3RyYXRpb24uc2VnbWVudCxcblx0XHRcdFx0XHRcdFx0bW9kZWwucmVzb3VyY2Vfc3VtbWFyeSxcblx0XHRcdFx0XHRcdFx0T2JqZWN0LmFzc2lnbigge30sIHJlZnJlc2hfY29udGV4dCwge1xuXHRcdFx0XHRcdFx0XHRcdHJlbmRlcl9zZWdtZW50X2lkOiByZW5kZXJfc2VnbWVudF9pZCxcblx0XHRcdFx0XHRcdFx0XHRpc19vdmVyZmxvd2VkOiByZWdpc3RyYXRpb24uaXNfb3ZlcmZsb3dlZCxcblx0XHRcdFx0XHRcdFx0XHRpbnRlcmFjdGlvbl9heGlzOiByZWdpc3RyYXRpb24uaW50ZXJhY3Rpb25fYXhpcyxcblx0XHRcdFx0XHRcdFx0XHRib3VuZGFyeV92aXNpYmlsaXR5OiByZWdpc3RyYXRpb24uYm91bmRhcnlfdmlzaWJpbGl0eVxuXHRcdFx0XHRcdFx0XHR9IClcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX2ludGVyYWN0aW9ucy5jb21wbGV0ZV9yZWFkX29ubHlfcmVmcmVzaCApIHtcblx0XHRcdFx0Ym9va2luZ19pbnRlcmFjdGlvbnMuY29tcGxldGVfcmVhZF9vbmx5X3JlZnJlc2goIHJlZnJlc2hfY29udGV4dCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE5vdGlmeSBzaGFyZWQgcmVuZGVyaW5nIHRoYXQgbG9jYWwgaG9zdCBjb250ZW50cyBhcmUgY29tcGxldGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgUmVuZGVyZWQgYXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY2FjaGVfa2V5IENvbXBsZXRlIGFjY2VwdGVkIHByb2plY3Rpb24gaWRlbnRpdHkuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBlbWl0X3JlbmRlcmVkKCByZXNvdXJjZV9pZCwgY2FjaGVfa2V5ICkge1xuXHRcdFx0dmFyIHJlbmRlcmVkX2V2ZW50O1xuXG5cdFx0XHRpZiAoICEgbW91bnQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vdW50LmRpc3BhdGNoRXZlbnQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVuZGVyZWRfZXZlbnQgPSBuZXcgd2luZG93LkN1c3RvbUV2ZW50KCAnd3BiYzp0aW1lbGluZTpyb3ctcHJlc2VudGF0aW9uOnJlbmRlcmVkJywge1xuXHRcdFx0XHRkZXRhaWw6IHtcblx0XHRcdFx0XHRyZXNvdXJjZV9pZDogTnVtYmVyKCByZXNvdXJjZV9pZCApLFxuXHRcdFx0XHRcdHByZXNlbnRhdGlvbl9pZDogcHJlc2VudGF0aW9uX2lkLFxuXHRcdFx0XHRcdGNhY2hlX2tleTogU3RyaW5nKCBjYWNoZV9rZXkgfHwgJycgKVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRtb3VudC5kaXNwYXRjaEV2ZW50KCByZW5kZXJlZF9ldmVudCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IHRoZSBjdXJyZW50IGF1dGhvcml0YXRpdmUtcmVhZGJhY2sgYnVzeSBzdGF0ZSB0byBvbmUgb3BlbiBwYW5lbC5cblx0XHQgKlxuXHRcdCAqIEV4aXN0aW5nIGJvb2tpbmcgbWFya3VwIHJlbWFpbnMgbW91bnRlZC4gT25seSBgYXJpYS1idXN5YCBhbmQgdGhlIGRvbWFpblxuXHRcdCAqIHN0YXRlIG5vdGljZSBjaGFuZ2Ugd2hpbGUgdGhlIG5hdGl2ZSBUaW1lbGluZSBvd25zIGNhbm9uaWNhbCByZWFkYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIG9wZW4gUmVzb3VyY2UgSUQuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHN1cHBsaWVkX21vZGVsIE9wdGlvbmFsIGFscmVhZHktYnVpbHQgcHJlc2VudGF0aW9uIG1vZGVsLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19zdGF0ZSggcmVzb3VyY2VfaWQsIHN1cHBsaWVkX21vZGVsICkge1xuXHRcdFx0dmFyIHN0YXRlX3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCAnc3RhdGUnICk7XG5cdFx0XHR2YXIgcHJvamVjdGlvbl9yZWNvcmQgPSBwcm9qZWN0ZWRfcmVzb3VyY2VzWyBOdW1iZXIoIHJlc291cmNlX2lkICkgXTtcblx0XHRcdHZhciBwcmVzZW50YXRpb25fbW9kZWwgPSBzdXBwbGllZF9tb2RlbCB8fCAoICEgaXNfYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19wZW5kaW5nICYmIHByb2plY3Rpb25fcmVjb3JkICYmIHByb2plY3Rpb25fcmVjb3JkLnByb2plY3Rpb25cblx0XHRcdFx0PyBidWlsZF9wcmVzZW50YXRpb25fbW9kZWwoIHByb2plY3Rpb25fcmVjb3JkLnByb2plY3Rpb24sIGdldF9yZXNvdXJjZV96b29tX3BlcmNlbnQoIHJlc291cmNlX2lkICkgKVxuXHRcdFx0XHQ6IG51bGwgKTtcblxuXHRcdFx0Z2V0X2N1cnJlbnRfaG9zdHMoIHJlc291cmNlX2lkICkuZm9yRWFjaCggZnVuY3Rpb24gKCBob3N0ICkge1xuXHRcdFx0XHR2YXIgcGFuZWwgPSBob3N0ICYmIGhvc3QucXVlcnlTZWxlY3RvciA/IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXBhbmVsXScgKSA6IG51bGw7XG5cdFx0XHRcdHZhciBzdGF0ZV9ob3N0ID0gaG9zdCAmJiBob3N0LnF1ZXJ5U2VsZWN0b3IgPyBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1zdGF0ZS1ob3N0XScgKSA6IG51bGw7XG5cblx0XHRcdFx0aWYgKCAhIHBhbmVsICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGlzX2F1dGhvcml0YXRpdmVfcmVhZGJhY2tfcGVuZGluZyApIHtcblx0XHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBwYW5lbC5zZXRBdHRyaWJ1dGUgKSB7XG5cdFx0XHRcdFx0XHRwYW5lbC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAndHJ1ZScgKTtcblx0XHRcdFx0XHRcdHBhbmVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmVmcmVzaGluZycsICd0cnVlJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHN0YXRlX2hvc3QgJiYgc3RhdGVfdGVtcGxhdGUgKSB7XG5cdFx0XHRcdFx0XHRzdGF0ZV9ob3N0LmlubmVySFRNTCA9IHN0YXRlX3RlbXBsYXRlKCB7XG5cdFx0XHRcdFx0XHRcdHN0YXRlOiAncmVmcmVzaGluZycsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IFN0cmluZyggY29uZmlndXJhdGlvbi5pMThuICYmIGNvbmZpZ3VyYXRpb24uaTE4bi5yZWZyZXNoaW5nIHx8ICcnIClcblx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBhbmVsLnJlbW92ZUF0dHJpYnV0ZSApIHtcblx0XHRcdFx0XHRwYW5lbC5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWJ1c3knICk7XG5cdFx0XHRcdFx0cGFuZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1yZWZyZXNoaW5nJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc3RhdGVfaG9zdCAmJiBzdGF0ZV90ZW1wbGF0ZSAmJiBwcmVzZW50YXRpb25fbW9kZWwgKSB7XG5cdFx0XHRcdFx0c3RhdGVfaG9zdC5pbm5lckhUTUwgPSBzdGF0ZV90ZW1wbGF0ZSggcHJlc2VudGF0aW9uX21vZGVsLmF2YWlsYWJpbGl0eV9zdGF0ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIG9uZSBvcGVuIFJlc291cmNlIHN5bmNocm9ub3VzbHkgZnJvbSBhbHJlYWR5IGFjY2VwdGVkIGxvY2FsIGRhdGEuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBvcGVuIFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7QXJyYXk8RWxlbWVudD59IHN1cHBsaWVkX2hvc3RzIE9wdGlvbmFsIGxpZmVjeWNsZS1wcm92aWRlZCBob3N0cy5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdXNlZnVsIGxvY2FsIGNvbnRlbnQgcmVwbGFjZWQgYm90aCBob3N0cy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW5kZXJfcmVzb3VyY2UoIHJlc291cmNlX2lkLCBzdXBwbGllZF9ob3N0cyApIHtcblx0XHRcdHZhciBob3N0cyA9IEFycmF5LmlzQXJyYXkoIHN1cHBsaWVkX2hvc3RzICkgJiYgc3VwcGxpZWRfaG9zdHMubGVuZ3RoID8gc3VwcGxpZWRfaG9zdHMgOiBnZXRfY3VycmVudF9ob3N0cyggcmVzb3VyY2VfaWQgKTtcblx0XHRcdHZhciByZXNvdXJjZV90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggJ3Jlc291cmNlJyApO1xuXHRcdFx0dmFyIGNhbnZhc190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggJ2NhbnZhcycgKTtcblx0XHRcdHZhciBzdGF0ZV90ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggJ3N0YXRlJyApO1xuXHRcdFx0dmFyIHN1bW1hcnlfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoICdzdW1tYXJ5JyApO1xuXHRcdFx0dmFyIHByb2plY3Rpb247XG5cdFx0XHR2YXIgbW9kZWw7XG5cdFx0XHR2YXIgY2FudmFzX2hvc3RzID0gW107XG5cblx0XHRcdGlmICggISBvcGVuX3Jlc291cmNlX2lkc1sgTnVtYmVyKCByZXNvdXJjZV9pZCApIF0gfHwgISByZXNvdXJjZV90ZW1wbGF0ZSB8fCAhIGNhbnZhc190ZW1wbGF0ZSB8fCAhIHN0YXRlX3RlbXBsYXRlIHx8ICEgc3VtbWFyeV90ZW1wbGF0ZSB8fCAhIGhvc3RzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cHJvamVjdGlvbiA9IHByb2plY3RfcmVzb3VyY2UoIE51bWJlciggcmVzb3VyY2VfaWQgKSwgZ2V0X3Jlc291cmNlX3JhbmdlX3BvbGljeSggcmVzb3VyY2VfaWQgKSApO1xuXHRcdFx0aWYgKCAhIHByb2plY3Rpb24gKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdG1vZGVsID0gYnVpbGRfcHJlc2VudGF0aW9uX21vZGVsKCBwcm9qZWN0aW9uLCBnZXRfcmVzb3VyY2Vfem9vbV9wZXJjZW50KCByZXNvdXJjZV9pZCApICk7XG5cdFx0XHRob3N0cy5mb3JFYWNoKCBmdW5jdGlvbiAoIGhvc3QgKSB7XG5cdFx0XHRcdHZhciBzaWRlID0gU3RyaW5nKCBob3N0LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yb3ctcHJlc2VudGF0aW9uLXNpZGUnICkgfHwgJycgKTtcblxuXHRcdFx0XHRpZiAoICdyZXNvdXJjZScgPT09IHNpZGUgKSB7XG5cdFx0XHRcdFx0aG9zdC5pbm5lckhUTUwgPSByZXNvdXJjZV90ZW1wbGF0ZSggbW9kZWwgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAnY2FudmFzJyAhPT0gc2lkZSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aG9zdC5pbm5lckhUTUwgPSBjYW52YXNfdGVtcGxhdGUoIG1vZGVsICk7XG5cdFx0XHRcdGNhbnZhc19ob3N0cy5wdXNoKCBob3N0ICk7XG5cdFx0XHRcdGlmICggaG9zdC5xdWVyeVNlbGVjdG9yICkge1xuXHRcdFx0XHRcdHZhciBzdGF0ZV9ob3N0ID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc3RhdGUtaG9zdF0nICk7XG5cdFx0XHRcdFx0dmFyIHN1bW1hcnlfaG9zdCA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXN1bW1hcnktaG9zdF0nICk7XG5cblx0XHRcdFx0XHRpZiAoIHN0YXRlX2hvc3QgKSB7XG5cdFx0XHRcdFx0XHRzdGF0ZV9ob3N0LmlubmVySFRNTCA9IHN0YXRlX3RlbXBsYXRlKCBtb2RlbC5hdmFpbGFiaWxpdHlfc3RhdGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBzdW1tYXJ5X2hvc3QgKSB7XG5cdFx0XHRcdFx0XHRzdW1tYXJ5X2hvc3QuaW5uZXJIVE1MID0gc3VtbWFyeV90ZW1wbGF0ZSgge1xuXHRcdFx0XHRcdFx0XHRyZXNvdXJjZV9pZDogbW9kZWwucmVzb3VyY2VfaWQsXG5cdFx0XHRcdFx0XHRcdHJlY29yZHM6IG1vZGVsLnN1bW1hcnlfcmVjb3Jkcyxcblx0XHRcdFx0XHRcdFx0aTE4bjogbW9kZWwuaTE4blxuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmVnaXN0ZXJfcmVhZF9vbmx5X2Jvb2tpbmdfYWN0aW9ucyggY2FudmFzX2hvc3RzLCBtb2RlbCApO1xuXHRcdFx0c3luY2hyb25pemVfYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19zdGF0ZSggcmVzb3VyY2VfaWQsIG1vZGVsICk7XG5cdFx0XHRlbWl0X3JlbmRlcmVkKCByZXNvdXJjZV9pZCwgcHJvamVjdGlvbi5jYWNoZV9rZXkgKTtcblxuXHRcdFx0cmV0dXJuIDAgPCBjYW52YXNfaG9zdHMubGVuZ3RoICYmIGhvc3RzLmxlbmd0aCA+IGNhbnZhc19ob3N0cy5sZW5ndGg7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVyZW5kZXIgZXZlcnkgY3VycmVudGx5IG9wZW4gYXV0aG9yaXplZCBSZXNvdXJjZSBmcm9tIGFjY2VwdGVkIHJlZmVyZW5jZXMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9vcGVuX3Jlc291cmNlcygpIHtcblx0XHRcdE9iamVjdC5rZXlzKCBvcGVuX3Jlc291cmNlX2lkcyApLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJlbmRlcl9yZXNvdXJjZSggTnVtYmVyKCByZXNvdXJjZV9pZCApICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVwbGFjZSBvbmx5IEF2YWlsYWJpbGl0eS1vd25lZCBwcmVzZW50YXRpb24gaG9zdHMgZm9yIGFmZmVjdGVkIFJlc291cmNlcy5cblx0XHQgKlxuXHRcdCAqIEJvb2tpbmcgY2FyZHMgcmVtYWluIG1vdW50ZWQsIHByZXNlcnZpbmcgY2Fub25pY2FsIHNlbGVjdGlvbiwgT3ZlcnZpZXcsIGFuZFxuXHRcdCAqIEluc3BlY3RvciByZWdpc3RyYXRpb25zIHdoaWxlIHRoZSBhY2NlcHRlZCBiYWNrZ3JvdW5kIHByb2plY3Rpb24gY2hhbmdlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7QXJyYXk8bnVtYmVyPn0gYWZmZWN0ZWRfcmVzb3VyY2VfaWRzIEF1dGhvcml6ZWQgYWZmZWN0ZWQgUmVzb3VyY2VzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2F2YWlsYWJpbGl0eV9yZXNvdXJjZXMoIGFmZmVjdGVkX3Jlc291cmNlX2lkcyApIHtcblx0XHRcdHZhciBhdmFpbGFiaWxpdHlfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoICdhdmFpbGFiaWxpdHknICk7XG5cdFx0XHR2YXIgc3RhdGVfdGVtcGxhdGUgPSBnZXRfdGVtcGxhdGUoICdzdGF0ZScgKTtcblx0XHRcdHZhciBzdW1tYXJ5X3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCAnc3VtbWFyeScgKTtcblx0XHRcdHZhciB0YXJnZXRfcmVzb3VyY2VfaWRzID0gbm9ybWFsaXplX3Jlc291cmNlX2lkcyggYWZmZWN0ZWRfcmVzb3VyY2VfaWRzICk7XG5cblx0XHRcdGlmICggISBhdmFpbGFiaWxpdHlfdGVtcGxhdGUgfHwgISBzdGF0ZV90ZW1wbGF0ZSB8fCAhIHN1bW1hcnlfdGVtcGxhdGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISB0YXJnZXRfcmVzb3VyY2VfaWRzLmxlbmd0aCApIHtcblx0XHRcdFx0dGFyZ2V0X3Jlc291cmNlX2lkcyA9IE9iamVjdC5rZXlzKCBvcGVuX3Jlc291cmNlX2lkcyApLm1hcCggTnVtYmVyICk7XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXRfcmVzb3VyY2VfaWRzLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHZhciBwcm9qZWN0aW9uO1xuXHRcdFx0XHR2YXIgbW9kZWw7XG5cblx0XHRcdFx0aWYgKCAhIG9wZW5fcmVzb3VyY2VfaWRzWyByZXNvdXJjZV9pZCBdICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcm9qZWN0aW9uID0gcHJvamVjdF9yZXNvdXJjZSggcmVzb3VyY2VfaWQsIGdldF9yZXNvdXJjZV9yYW5nZV9wb2xpY3koIHJlc291cmNlX2lkICkgKTtcblx0XHRcdFx0aWYgKCAhIHByb2plY3Rpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1vZGVsID0gYnVpbGRfcHJlc2VudGF0aW9uX21vZGVsKCBwcm9qZWN0aW9uLCBnZXRfcmVzb3VyY2Vfem9vbV9wZXJjZW50KCByZXNvdXJjZV9pZCApICk7XG5cdFx0XHRcdGdldF9jdXJyZW50X2hvc3RzKCByZXNvdXJjZV9pZCApLmZvckVhY2goIGZ1bmN0aW9uICggaG9zdCApIHtcblx0XHRcdFx0XHR2YXIgc2lkZSA9IFN0cmluZyggaG9zdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcm93LXByZXNlbnRhdGlvbi1zaWRlJyApIHx8ICcnICk7XG5cdFx0XHRcdFx0dmFyIHBhbmVsO1xuXHRcdFx0XHRcdHZhciBhdmFpbGFiaWxpdHlfaG9zdDtcblx0XHRcdFx0XHR2YXIgc3RhdGVfaG9zdDtcblx0XHRcdFx0XHR2YXIgc3VtbWFyeV9ob3N0O1xuXG5cdFx0XHRcdFx0aWYgKCAhIGhvc3QucXVlcnlTZWxlY3RvciApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cGFuZWwgPSBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1wYW5lbF0nICk7XG5cdFx0XHRcdFx0aWYgKCBwYW5lbCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcGFuZWwuc2V0QXR0cmlidXRlICkge1xuXHRcdFx0XHRcdFx0Lypcblx0XHRcdFx0XHRcdCAqIEF2YWlsYWJpbGl0eSBhZHZhbmNlcyB0aGUgY29tcG9zZWQgcHJvamVjdGlvbiBpZGVudGl0eSB3aXRob3V0XG5cdFx0XHRcdFx0XHQgKiByZXBsYWNpbmcgZWl0aGVyIHBhbmVsLiBLZWVwIHRoZSByZW5kZXJlZCBpZGVudGl0eSBzeW5jaHJvbml6ZWQgc29cblx0XHRcdFx0XHRcdCAqIGxhdGVyIHNlbGVjdGlvbiBhbmQgbW92ZW1lbnQgc25hcHNob3RzIGFyZSBub3QgcmVqZWN0ZWQgYXMgc3RhbGUuXG5cdFx0XHRcdFx0XHQgKi9cblx0XHRcdFx0XHRcdHBhbmVsLnNldEF0dHJpYnV0ZShcblx0XHRcdFx0XHRcdFx0J2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtY2FjaGUta2V5Jyxcblx0XHRcdFx0XHRcdFx0U3RyaW5nKCBwcm9qZWN0aW9uLmNhY2hlX2tleSB8fCAnJyApXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoICdjYW52YXMnICE9PSBzaWRlICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhdmFpbGFiaWxpdHlfaG9zdCA9IGhvc3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLWF2YWlsYWJpbGl0eS1ob3N0XScgKTtcblx0XHRcdFx0XHRzdGF0ZV9ob3N0ID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc3RhdGUtaG9zdF0nICk7XG5cdFx0XHRcdFx0c3VtbWFyeV9ob3N0ID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtc3VtbWFyeS1ob3N0XScgKTtcblx0XHRcdFx0XHRpZiAoIGF2YWlsYWJpbGl0eV9ob3N0ICkge1xuXHRcdFx0XHRcdFx0YXZhaWxhYmlsaXR5X2hvc3QuaW5uZXJIVE1MID0gYXZhaWxhYmlsaXR5X3RlbXBsYXRlKCBtb2RlbCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHN0YXRlX2hvc3QgKSB7XG5cdFx0XHRcdFx0XHRzdGF0ZV9ob3N0LmlubmVySFRNTCA9IHN0YXRlX3RlbXBsYXRlKCBtb2RlbC5hdmFpbGFiaWxpdHlfc3RhdGUgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBzdW1tYXJ5X2hvc3QgKSB7XG5cdFx0XHRcdFx0XHRzdW1tYXJ5X2hvc3QuaW5uZXJIVE1MID0gc3VtbWFyeV90ZW1wbGF0ZSgge1xuXHRcdFx0XHRcdFx0XHRyZXNvdXJjZV9pZDogbW9kZWwucmVzb3VyY2VfaWQsXG5cdFx0XHRcdFx0XHRcdHJlY29yZHM6IG1vZGVsLnN1bW1hcnlfcmVjb3Jkcyxcblx0XHRcdFx0XHRcdFx0aTE4bjogbW9kZWwuaTE4blxuXHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9hdXRob3JpdGF0aXZlX3JlYWRiYWNrX3N0YXRlKCByZXNvdXJjZV9pZCwgbW9kZWwgKTtcblx0XHRcdFx0ZW1pdF9yZW5kZXJlZCggcmVzb3VyY2VfaWQsIHByb2plY3Rpb24uY2FjaGVfa2V5ICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIG9uZSBSZXNvdXJjZSdzIGxvY2FsIGluZGV4ZXMgYW5kIHByb2plY3Rpb25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIFJlc291cmNlIHdob3NlIHByZXNlbnRhdGlvbiBjbG9zZWQvZGlzYXBwZWFyZWQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZW1vdmVfcmVzb3VyY2VfbG9jYWxfc3RhdGUoIHJlc291cmNlX2lkICkge1xuXHRcdFx0dmFyIHN1ZmZpeCA9ICd8JyArIE51bWJlciggcmVzb3VyY2VfaWQgKTtcblxuXHRcdFx0T2JqZWN0LmtleXMoIHJlc291cmNlX3dpbmRvd19pbmRleGVzICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjYWNoZV9rZXkgKSB7XG5cdFx0XHRcdGlmICggY2FjaGVfa2V5LnNsaWNlKCAtc3VmZml4Lmxlbmd0aCApID09PSBzdWZmaXggKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHJlc291cmNlX3dpbmRvd19pbmRleGVzWyBjYWNoZV9rZXkgXTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0T2JqZWN0LmtleXMoIHByb2plY3Rpb25fY2FjaGUgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHdpbmRvd19rZXkgKSB7XG5cdFx0XHRcdGRlbGV0ZSBwcm9qZWN0aW9uX2NhY2hlWyB3aW5kb3dfa2V5IF1bIE51bWJlciggcmVzb3VyY2VfaWQgKSBdO1xuXHRcdFx0XHRpZiAoICEgT2JqZWN0LmtleXMoIHByb2plY3Rpb25fY2FjaGVbIHdpbmRvd19rZXkgXSApLmxlbmd0aCApIHtcblx0XHRcdFx0XHRkZWxldGUgcHJvamVjdGlvbl9jYWNoZVsgd2luZG93X2tleSBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRkZWxldGUgcHJvamVjdGVkX3Jlc291cmNlc1sgTnVtYmVyKCByZXNvdXJjZV9pZCApIF07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGFjY2VwdGVkIG5hdGl2ZSBib29raW5nLXdpbmRvdyBub3RpZmljYXRpb25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgQWNjZXB0ZWQtZGF0YSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9ib29raW5nX3dpbmRvd3NfYWNjZXB0ZWQoIGV2ZW50ICkge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHRhY2NlcHRfYm9va2luZ193aW5kb3dzKCBldmVudCAmJiBldmVudC5kZXRhaWwgPyBldmVudC5kZXRhaWwgOiB7fSApXG5cdFx0XHRcdCYmIGxhc3RfYm9va2luZ190cmFuc2l0aW9uXG5cdFx0XHRcdCYmIGxhc3RfYm9va2luZ190cmFuc2l0aW9uLmhhc19wcm9qZWN0aW9uX2NoYW5nZVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJlbmRlcl9vcGVuX3Jlc291cmNlcygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBhY2NlcHRlZCBuYXRpdmUgQXZhaWxhYmlsaXR5IG5vdGlmaWNhdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBBY2NlcHRlZC1kYXRhIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2F2YWlsYWJpbGl0eV9hY2NlcHRlZCggZXZlbnQgKSB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGFjY2VwdF9hdmFpbGFiaWxpdHkoIGV2ZW50ICYmIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9IClcblx0XHRcdFx0JiYgbGFzdF9hdmFpbGFiaWxpdHlfdHJhbnNpdGlvblxuXHRcdFx0XHQmJiBsYXN0X2F2YWlsYWJpbGl0eV90cmFuc2l0aW9uLmhhc19wcm9qZWN0aW9uX2NoYW5nZVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJlbmRlcl9hdmFpbGFiaWxpdHlfcmVzb3VyY2VzKCBsYXN0X2F2YWlsYWJpbGl0eV90cmFuc2l0aW9uLmFmZmVjdGVkX3Jlc291cmNlX2lkcyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlZmxlY3QgbmF0aXZlIG11dGF0aW9uIHJlYWRiYWNrIHdpdGhvdXQgb3duaW5nIGl0cyByZXF1ZXN0IG9yIGNhY2hlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZXZlbnQgTmV1dHJhbCBhdXRob3JpdGF0aXZlLXJlYWRiYWNrIGxpZmVjeWNsZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9hdXRob3JpdGF0aXZlX3JlYWRiYWNrX3N0YXRlKCBldmVudCApIHtcblx0XHRcdHZhciBkZXRhaWwgPSBldmVudCAmJiBldmVudC5kZXRhaWwgPyBldmVudC5kZXRhaWwgOiB7fTtcblx0XHRcdHZhciBnZW5lcmF0aW9uID0gTnVtYmVyKCBkZXRhaWwuZ2VuZXJhdGlvbiApO1xuXHRcdFx0dmFyIHN0YXRlID0gU3RyaW5nKCBkZXRhaWwuc3RhdGUgfHwgJycgKTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQxICE9PSBOdW1iZXIoIGRldGFpbC5zY2hlbWFfdmVyc2lvbiApXG5cdFx0XHRcdHx8ICEgTnVtYmVyLmlzSW50ZWdlciggZ2VuZXJhdGlvbiApXG5cdFx0XHRcdHx8IGdlbmVyYXRpb24gPCBhdXRob3JpdGF0aXZlX3JlYWRiYWNrX2dlbmVyYXRpb25cblx0XHRcdFx0fHwgLTEgPT09IFsgJ2xvYWRpbmcnLCAnYWNjZXB0ZWQnLCAnZmFpbGVkJyBdLmluZGV4T2YoIHN0YXRlIClcblx0XHRcdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhdXRob3JpdGF0aXZlX3JlYWRiYWNrX2dlbmVyYXRpb24gPSBnZW5lcmF0aW9uO1xuXHRcdFx0aXNfYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19wZW5kaW5nID0gJ2xvYWRpbmcnID09PSBzdGF0ZTtcblx0XHRcdGlmICggJ2ZhaWxlZCcgPT09IHN0YXRlICkge1xuXHRcdFx0XHRyZW5kZXJfb3Blbl9yZXNvdXJjZXMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0T2JqZWN0LmtleXMoIG9wZW5fcmVzb3VyY2VfaWRzICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0c3luY2hyb25pemVfYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19zdGF0ZSggTnVtYmVyKCByZXNvdXJjZV9pZCApICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSBwYWlyZWQgZHVhbC1yYW5nZSBjb250cm9scyBjb250YWluaW5nIG9uZSBjaGFuZ2VkIGVuZHBvaW50LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBjb250cm9sIFN0YXJ0IG9yIGVuZCByYW5nZSBpbnB1dC5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gQ29udGFpbmVyIGFuZCBlbmRwb2ludCBjb250cm9scyBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yYW5nZV9jb250cm9sX2VsZW1lbnRzKCBjb250cm9sICkge1xuXHRcdFx0dmFyIGNvbnRhaW5lciA9IGNvbnRyb2wgJiYgY29udHJvbC5jbG9zZXN0ID8gY29udHJvbC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmFuZ2UtY29udHJvbF0nICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoICEgY29udGFpbmVyIHx8ICEgY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y29udGFpbmVyOiBjb250YWluZXIsXG5cdFx0XHRcdHN0YXJ0OiBjb250YWluZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJhbmdlLWJvdW5kYXJ5PVwic3RhcnRcIl0nICksXG5cdFx0XHRcdGVuZDogY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1yYW5nZS1ib3VuZGFyeT1cImVuZFwiXScgKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgbGFiZWxzIGFuZCB0aGUgc2VsZWN0ZWQgdHJhY2sgd2hpbGUgb25lIHJhbmdlIHRodW1iIG1vdmVzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSBjb250cm9sIENoYW5nZWQgc3RhcnQgb3IgZW5kIHJhbmdlIGlucHV0LlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBOb3JtYWxpemVkIGN1c3RvbSBwb2xpY3kgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfcmFuZ2VfcHJldmlldyggY29udHJvbCApIHtcblx0XHRcdHZhciBjb250cm9scyA9IGdldF9yYW5nZV9jb250cm9sX2VsZW1lbnRzKCBjb250cm9sICk7XG5cdFx0XHR2YXIgYm91bmRhcnkgPSBTdHJpbmcoIGNvbnRyb2wgJiYgY29udHJvbC5nZXRBdHRyaWJ1dGUgPyBjb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmFuZ2UtYm91bmRhcnknICkgOiAnJyApO1xuXHRcdFx0dmFyIHN0ZXBfbWludXRlcyA9IGdldF90aW1lX3JhbmdlX3N0ZXBfbWludXRlcygpO1xuXHRcdFx0dmFyIHN0YXJ0X21pbnV0ZTtcblx0XHRcdHZhciBlbmRfbWludXRlO1xuXHRcdFx0dmFyIG91dHB1dHM7XG5cdFx0XHR2YXIgYWN0aW9ucztcblx0XHRcdHZhciByYW5nZV9wb2xpY3k7XG5cdFx0XHR2YXIgbWF0Y2hpbmdfcmFuZ2VfcHJlc2V0O1xuXHRcdFx0dmFyIGkxOG4gPSBjb25maWd1cmF0aW9uLmkxOG4gfHwge307XG5cblx0XHRcdGlmICggISBjb250cm9scyB8fCAhIGNvbnRyb2xzLnN0YXJ0IHx8ICEgY29udHJvbHMuZW5kICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHN0YXJ0X21pbnV0ZSA9IG5vcm1hbGl6ZV93YWxsX21pbnV0ZSggY29udHJvbHMuc3RhcnQudmFsdWUsIDAgKTtcblx0XHRcdGVuZF9taW51dGUgPSBub3JtYWxpemVfd2FsbF9taW51dGUoIGNvbnRyb2xzLmVuZC52YWx1ZSwgMTQ0MCApO1xuXHRcdFx0aWYgKCAnc3RhcnQnID09PSBib3VuZGFyeSApIHtcblx0XHRcdFx0c3RhcnRfbWludXRlID0gTWF0aC5taW4oIDE0NDAgLSBzdGVwX21pbnV0ZXMsIE1hdGgubWluKCBzdGFydF9taW51dGUsIGVuZF9taW51dGUgLSBzdGVwX21pbnV0ZXMgKSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZW5kX21pbnV0ZSA9IE1hdGgubWF4KCBzdGVwX21pbnV0ZXMsIE1hdGgubWF4KCBlbmRfbWludXRlLCBzdGFydF9taW51dGUgKyBzdGVwX21pbnV0ZXMgKSApO1xuXHRcdFx0fVxuXHRcdFx0c3RhcnRfbWludXRlID0gTWF0aC5tYXgoIDAsIHN0YXJ0X21pbnV0ZSApO1xuXHRcdFx0ZW5kX21pbnV0ZSA9IE1hdGgubWluKCAxNDQwLCBlbmRfbWludXRlICk7XG5cdFx0XHRjb250cm9scy5zdGFydC52YWx1ZSA9IHN0YXJ0X21pbnV0ZTtcblx0XHRcdGNvbnRyb2xzLmVuZC52YWx1ZSA9IGVuZF9taW51dGU7XG5cdFx0XHRjb250cm9scy5zdGFydC5zZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJywgaW50ZXJwb2xhdGVfbGFiZWwoIGkxOG4udGltZV9yYW5nZV9zdGFydCwgeyB0aW1lOiBmb3JtYXRfd2FsbF9taW51dGUoIHN0YXJ0X21pbnV0ZSApIH0gKSApO1xuXHRcdFx0Y29udHJvbHMuZW5kLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBpbnRlcnBvbGF0ZV9sYWJlbCggaTE4bi50aW1lX3JhbmdlX2VuZCwgeyB0aW1lOiBmb3JtYXRfd2FsbF9taW51dGUoIGVuZF9taW51dGUgKSB9ICkgKTtcblx0XHRcdGlmICggY29udHJvbHMuY29udGFpbmVyLnN0eWxlICYmIGNvbnRyb2xzLmNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSApIHtcblx0XHRcdFx0Y29udHJvbHMuY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWUtcm93cy1yYW5nZS1zdGFydCcsIE51bWJlciggKCAxMDAgKiBzdGFydF9taW51dGUgLyAxNDQwICkudG9GaXhlZCggOCApICkgKyAnJScgKTtcblx0XHRcdFx0Y29udHJvbHMuY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLXRpbWUtcm93cy1yYW5nZS1lbmQnLCBOdW1iZXIoICggMTAwICogZW5kX21pbnV0ZSAvIDE0NDAgKS50b0ZpeGVkKCA4ICkgKSArICclJyApO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0cyA9IGNvbnRyb2xzLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsID8gY29udHJvbHMuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1yYW5nZS1vdXRwdXRdJyApIDogW107XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBvdXRwdXRzLCBmdW5jdGlvbiAoIG91dHB1dCApIHtcblx0XHRcdFx0b3V0cHV0LnRleHRDb250ZW50ID0gJ3N0YXJ0JyA9PT0gb3V0cHV0LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmFuZ2Utb3V0cHV0JyApXG5cdFx0XHRcdFx0PyBmb3JtYXRfd2FsbF9taW51dGUoIHN0YXJ0X21pbnV0ZSApXG5cdFx0XHRcdFx0OiBmb3JtYXRfd2FsbF9taW51dGUoIGVuZF9taW51dGUgKTtcblx0XHRcdH0gKTtcblx0XHRcdHJhbmdlX3BvbGljeSA9IHsgbW9kZTogJ2N1c3RvbScsIHN0YXJ0X21pbnV0ZTogc3RhcnRfbWludXRlLCBlbmRfbWludXRlOiBlbmRfbWludXRlIH07XG5cdFx0XHRtYXRjaGluZ19yYW5nZV9wcmVzZXQgPSBnZXRfbWF0Y2hpbmdfcmFuZ2VfcHJlc2V0KCByYW5nZV9wb2xpY3kgKTtcblx0XHRcdGFjdGlvbnMgPSBjb250cm9scy5jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCA/IGNvbnRyb2xzLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmFuZ2UtbW9kZV0nICkgOiBbXTtcblx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGFjdGlvbnMsIGZ1bmN0aW9uICggYWN0aW9uICkge1xuXHRcdFx0XHR2YXIgaXNfYWN0aXZlID0gISEgbWF0Y2hpbmdfcmFuZ2VfcHJlc2V0XG5cdFx0XHRcdFx0JiYgbWF0Y2hpbmdfcmFuZ2VfcHJlc2V0LmlkID09PSBTdHJpbmcoIGFjdGlvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJhbmdlLXByZXNldCcgKSB8fCAnJyApO1xuXG5cdFx0XHRcdGFjdGlvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLXByZXNzZWQnLCBpc19hY3RpdmUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRcdGlmICggYWN0aW9uLmNsYXNzTGlzdCApIHtcblx0XHRcdFx0XHRhY3Rpb24uY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWFjdGl2ZScsIGlzX2FjdGl2ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiByYW5nZV9wb2xpY3k7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUHJldmlldyBvbmUgZHVhbC1yYW5nZSBlbmRwb2ludCB3aXRob3V0IHByb2plY3Rpbmcgb3IgcmVxdWVzdGluZyBkYXRhLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgRGVsZWdhdGVkIFJlc291cmNlLXNpZGUgaW5wdXQgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcmFuZ2VfaW5wdXQoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGNvbnRyb2wgPSBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3Rcblx0XHRcdFx0PyBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJhbmdlXScgKVxuXHRcdFx0XHQ6IG51bGw7XG5cblx0XHRcdGlmICggY29udHJvbCApIHtcblx0XHRcdFx0dXBkYXRlX3JhbmdlX3ByZXZpZXcoIGNvbnRyb2wgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIGZvY3VzIHRvIGEgY29kZS1vd25lZCBjb250cm9sIGFmdGVyIGl0cyBXb3JkUHJlc3MgdGVtcGxhdGUgcmVyZW5kZXJzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yIEZpeGVkIGRvbWFpbi1vd25lZCBzZWxlY3Rvci5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlc3RvcmVfY29udHJvbF9mb2N1cyggcmVzb3VyY2VfaWQsIHNlbGVjdG9yICkge1xuXHRcdFx0Z2V0X2N1cnJlbnRfaG9zdHMoIHJlc291cmNlX2lkICkuc29tZSggZnVuY3Rpb24gKCBob3N0ICkge1xuXHRcdFx0XHR2YXIgY29udHJvbCA9IGhvc3QgJiYgaG9zdC5xdWVyeVNlbGVjdG9yID8gaG9zdC5xdWVyeVNlbGVjdG9yKCBzZWxlY3RvciApIDogbnVsbDtcblxuXHRcdFx0XHRpZiAoICEgY29udHJvbCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgY29udHJvbC5mb2N1cyApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udHJvbC5mb2N1cygpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDb21taXQgb25lIGV4cGxpY2l0IGR1YWwtc2xpZGVyIHJhbmdlIHdpdGhvdXQgYSByZXF1ZXN0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgRGVsZWdhdGVkIFJlc291cmNlLXNpZGUgY2hhbmdlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3JhbmdlX2NoYW5nZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY29udHJvbCA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdFxuXHRcdFx0XHQ/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmFuZ2VdJyApXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdHZhciByZXNvdXJjZV9pZDtcblx0XHRcdHZhciByYW5nZV9wb2xpY3k7XG5cdFx0XHR2YXIgYm91bmRhcnk7XG5cblx0XHRcdGlmICggISBjb250cm9sICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtaWQnICkgKTtcblx0XHRcdGlmICggISBvcGVuX3Jlc291cmNlX2lkc1sgcmVzb3VyY2VfaWQgXSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmFuZ2VfcG9saWN5ID0gdXBkYXRlX3JhbmdlX3ByZXZpZXcoIGNvbnRyb2wgKTtcblx0XHRcdGlmICggISByYW5nZV9wb2xpY3kgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGJvdW5kYXJ5ID0gJ2VuZCcgPT09IGNvbnRyb2wuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1yYW5nZS1ib3VuZGFyeScgKSA/ICdlbmQnIDogJ3N0YXJ0Jztcblx0XHRcdHJhbmdlX3BvbGljaWVzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdID0gbm9ybWFsaXplX3JhbmdlX3BvbGljeSggcmFuZ2VfcG9saWN5ICk7XG5cdFx0XHRkZWxldGUgcHJvamVjdGVkX3Jlc291cmNlc1sgcmVzb3VyY2VfaWQgXTtcblx0XHRcdHJlbmRlcl9yZXNvdXJjZSggcmVzb3VyY2VfaWQgKTtcblx0XHRcdHJlc3RvcmVfY29udHJvbF9mb2N1cyggcmVzb3VyY2VfaWQsICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1yYW5nZS1ib3VuZGFyeT1cIicgKyBib3VuZGFyeSArICdcIl0nICk7XG5cdFx0XHRxdWV1ZV9wcmVmZXJlbmNlX3NhdmUoIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgQXV0bywgb25lIHNlcnZlci1kZWZpbmVkIHByZXNldCwgb3IgRnVsbCBkYXkgZnJvbSByYW5nZSBhY3Rpb25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgRGVsZWdhdGVkIFJlc291cmNlLXNpZGUgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcmFuZ2VfYWN0aW9uKCBldmVudCApIHtcblx0XHRcdHZhciBhY3Rpb24gPSBldmVudC50YXJnZXQgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3Rcblx0XHRcdFx0PyBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJhbmdlLW1vZGVdJyApXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdHZhciByZXNvdXJjZV9pZDtcblx0XHRcdHZhciBtb2RlO1xuXHRcdFx0dmFyIHByZXNldF9pZDtcblx0XHRcdHZhciBwcmVzZXQ7XG5cdFx0XHR2YXIgcmFuZ2VfcG9saWN5O1xuXHRcdFx0dmFyIGZvY3VzX3NlbGVjdG9yO1xuXG5cdFx0XHRpZiAoICEgYWN0aW9uICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggYWN0aW9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1pZCcgKSApO1xuXHRcdFx0bW9kZSA9IFN0cmluZyggYWN0aW9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmFuZ2UtbW9kZScgKSB8fCAnJyApO1xuXHRcdFx0aWYgKCAhIG9wZW5fcmVzb3VyY2VfaWRzWyByZXNvdXJjZV9pZCBdIHx8IC0xID09PSBbICdhdXRvJywgJ2N1c3RvbScsICdmdWxsX2RheScgXS5pbmRleE9mKCBtb2RlICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJhbmdlX3BvbGljeSA9IHsgbW9kZTogbW9kZSB9O1xuXHRcdFx0Zm9jdXNfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcmFuZ2UtbW9kZT1cIicgKyBtb2RlICsgJ1wiXSc7XG5cdFx0XHRpZiAoICdjdXN0b20nID09PSBtb2RlICkge1xuXHRcdFx0XHRwcmVzZXRfaWQgPSBTdHJpbmcoIGFjdGlvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJhbmdlLXByZXNldCcgKSB8fCAnJyApO1xuXHRcdFx0XHRwcmVzZXQgPSBnZXRfdGltZV9yYW5nZV9wcmVzZXRzKCkuZmluZCggZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZS5pZCA9PT0gcHJlc2V0X2lkO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggISBwcmVzZXQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJhbmdlX3BvbGljeSA9IHtcblx0XHRcdFx0XHRtb2RlOiAnY3VzdG9tJyxcblx0XHRcdFx0XHRzdGFydF9taW51dGU6IHByZXNldC5zdGFydF9taW51dGUsXG5cdFx0XHRcdFx0ZW5kX21pbnV0ZTogcHJlc2V0LmVuZF9taW51dGVcblx0XHRcdFx0fTtcblx0XHRcdFx0Zm9jdXNfc2VsZWN0b3IgKz0gJ1tkYXRhLXdwYmMtdGltZWxpbmUtdGltZS1yb3dzLXJhbmdlLXByZXNldD1cIicgKyBwcmVzZXQuaWQgKyAnXCJdJztcblx0XHRcdH1cblx0XHRcdHJhbmdlX3BvbGljaWVzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdID0gbm9ybWFsaXplX3JhbmdlX3BvbGljeSggcmFuZ2VfcG9saWN5ICk7XG5cdFx0XHRkZWxldGUgcHJvamVjdGVkX3Jlc291cmNlc1sgcmVzb3VyY2VfaWQgXTtcblx0XHRcdHJlbmRlcl9yZXNvdXJjZSggcmVzb3VyY2VfaWQgKTtcblx0XHRcdHJlc3RvcmVfY29udHJvbF9mb2N1cyggcmVzb3VyY2VfaWQsIGZvY3VzX3NlbGVjdG9yICk7XG5cdFx0XHRxdWV1ZV9wcmVmZXJlbmNlX3NhdmUoIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVXBkYXRlIGJvdGggc3luY2hyb25pemVkIHBhbmVsIGhhbHZlcyBmb3Igb25lIHByZXNlbnRhdGlvbi1vbmx5IHpvb20gdmFsdWUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gem9vbV9wZXJjZW50IE5vcm1hbGl6ZWQgdmVydGljYWwgem9vbSBwZXJjZW50YWdlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX3pvb21fcHJldmlldyggcmVzb3VyY2VfaWQsIHpvb21fcGVyY2VudCApIHtcblx0XHRcdHZhciBwcm9qZWN0aW9uX3JlY29yZCA9IHByb2plY3RlZF9yZXNvdXJjZXNbIE51bWJlciggcmVzb3VyY2VfaWQgKSBdO1xuXHRcdFx0dmFyIHpvb20gPSBnZXRfem9vbV9jb25maWd1cmF0aW9uKCk7XG5cdFx0XHR2YXIgYm9keV9oZWlnaHRfcHg7XG5cblx0XHRcdGlmICggISBwcm9qZWN0aW9uX3JlY29yZCB8fCAhIHByb2plY3Rpb25fcmVjb3JkLnByb2plY3Rpb24gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGJvZHlfaGVpZ2h0X3B4ID0gTWF0aC5tYXgoXG5cdFx0XHRcdHpvb20ubWluaW11bV9ib2R5X2hlaWdodF9weCxcblx0XHRcdFx0TWF0aC5yb3VuZCggcHJvamVjdGlvbl9yZWNvcmQucHJvamVjdGlvbi5yYW5nZS5zcGFuX21pbnV0ZXMgLyA2MCAqIHpvb20uaG91cl9oZWlnaHRfcHggKiB6b29tX3BlcmNlbnQgLyAxMDAgKVxuXHRcdFx0KTtcblx0XHRcdGdldF9jdXJyZW50X2hvc3RzKCByZXNvdXJjZV9pZCApLmZvckVhY2goIGZ1bmN0aW9uICggaG9zdCApIHtcblx0XHRcdFx0dmFyIHBhbmVsID0gaG9zdCAmJiBob3N0LnF1ZXJ5U2VsZWN0b3IgPyBob3N0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy1wYW5lbF0nICkgOiBudWxsO1xuXG5cdFx0XHRcdGlmICggcGFuZWwgJiYgcGFuZWwuc3R5bGUgJiYgcGFuZWwuc3R5bGUuc2V0UHJvcGVydHkgKSB7XG5cdFx0XHRcdFx0cGFuZWwuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtdGltZS1yb3dzLWJvZHktaGVpZ2h0JywgYm9keV9oZWlnaHRfcHggKyAncHgnICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGVtaXRfcmVuZGVyZWQoIHJlc291cmNlX2lkLCBwcm9qZWN0aW9uX3JlY29yZC5jYWNoZV9rZXkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBcHBseSBhIGxvY2FsIHZlcnRpY2FsIHpvb20gcHJldmlldyB3aXRob3V0IGludmFsaWRhdGluZyBwcm9qZWN0aW9uIGRhdGEuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBEZWxlZ2F0ZWQgUmVzb3VyY2Utc2lkZSBpbnB1dCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV96b29tX2lucHV0KCBldmVudCApIHtcblx0XHRcdHZhciBjb250cm9sID0gZXZlbnQudGFyZ2V0ICYmIGV2ZW50LnRhcmdldC5jbG9zZXN0XG5cdFx0XHRcdD8gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXRpbWUtcm93cy16b29tXScgKVxuXHRcdFx0XHQ6IG51bGw7XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQ7XG5cdFx0XHR2YXIgem9vbV9wZXJjZW50O1xuXHRcdFx0dmFyIHBhbmVsO1xuXHRcdFx0dmFyIHN0YXR1cztcblx0XHRcdHZhciBsYWJlbDtcblxuXHRcdFx0aWYgKCAhIGNvbnRyb2wgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCBjb250cm9sLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1pZCcgKSApO1xuXHRcdFx0aWYgKCAhIG9wZW5fcmVzb3VyY2VfaWRzWyByZXNvdXJjZV9pZCBdICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR6b29tX3BlcmNlbnQgPSBub3JtYWxpemVfem9vbV9wZXJjZW50KCBjb250cm9sLnZhbHVlICk7XG5cdFx0XHR6b29tX3BlcmNlbnRhZ2VzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdID0gem9vbV9wZXJjZW50O1xuXHRcdFx0bGFiZWwgPSBpbnRlcnBvbGF0ZV9sYWJlbCggY29uZmlndXJhdGlvbi5pMThuICYmIGNvbmZpZ3VyYXRpb24uaTE4bi50aW1lX3pvb21fdmFsdWUsIHsgcGVyY2VudDogem9vbV9wZXJjZW50IH0gKTtcblx0XHRcdGNvbnRyb2wudmFsdWUgPSB6b29tX3BlcmNlbnQ7XG5cdFx0XHRjb250cm9sLnNldEF0dHJpYnV0ZSggJ2FyaWEtdmFsdWV0ZXh0JywgbGFiZWwgKTtcblx0XHRcdHBhbmVsID0gY29udHJvbC5jbG9zZXN0ID8gY29udHJvbC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3MtcGFuZWxdJyApIDogbnVsbDtcblx0XHRcdHN0YXR1cyA9IHBhbmVsICYmIHBhbmVsLnF1ZXJ5U2VsZWN0b3IgPyBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtem9vbS1zdGF0dXNdJyApIDogbnVsbDtcblx0XHRcdGlmICggc3RhdHVzICkge1xuXHRcdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBsYWJlbDtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZV96b29tX3ByZXZpZXcoIHJlc291cmNlX2lkLCB6b29tX3BlcmNlbnQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQZXJzaXN0IHRoZSBmaW5hbCBkZW5zaXR5IHZhbHVlIGFmdGVyIHRoZSBuYXRpdmUgcmFuZ2UgaW50ZXJhY3Rpb24gZW5kcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IERlbGVnYXRlZCBSZXNvdXJjZS1zaWRlIGNoYW5nZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV96b29tX2NoYW5nZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY29udHJvbCA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdFxuXHRcdFx0XHQ/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS10aW1lLXJvd3Mtem9vbV0nIClcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xuXG5cdFx0XHRpZiAoICEgY29udHJvbCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVzb3VyY2VfaWQgPSBOdW1iZXIoIGNvbnRyb2wuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWlkJyApICk7XG5cdFx0XHRpZiAoIG9wZW5fcmVzb3VyY2VfaWRzWyByZXNvdXJjZV9pZCBdICkge1xuXHRcdFx0XHRxdWV1ZV9wcmVmZXJlbmNlX3NhdmUoIHJlc291cmNlX2lkICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RvcCB1bnNlbnQgZG9tYWluIHNhdmVzIGFuZCBsZXQgc2hhcmVkIFJlc2V0IGF3YWl0IGFjdGl2ZSBzYXZlcy5cblx0XHQgKlxuXHRcdCAqIFRoaXMgbmV1dHJhbCBiYXJyaWVyIHByZXZlbnRzIGFuIG9sZGVyIGluLWZsaWdodCBwcmVmZXJlbmNlIHdyaXRlIGZyb21cblx0XHQgKiBjb21wbGV0aW5nIGFmdGVyIHRoZSBhdXRob3JpdGF0aXZlIHNoYXJlZCBSZXNldCB3cml0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IFJlc2V0LXJlcXVlc3QgbGlmZWN5Y2xlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3ByZWZlcmVuY2VzX3Jlc2V0X3JlcXVlc3RlZCggZXZlbnQgKSB7XG5cdFx0XHR2YXIgZGV0YWlsID0gZXZlbnQgJiYgZXZlbnQuZGV0YWlsID8gZXZlbnQuZGV0YWlsIDoge307XG5cdFx0XHR2YXIgd2FpdGVycyA9IFtdO1xuXG5cdFx0XHRpZiAoIDEgIT09IE51bWJlciggZGV0YWlsLnNjaGVtYV92ZXJzaW9uICkgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGRldGFpbC53YWl0X3VudGlsICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRPYmplY3Qua2V5cyggcHJlZmVyZW5jZV9zYXZlX3N0YXRlc19ieV9yZXNvdXJjZSApLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHZhciBzdGF0ZSA9IHByZWZlcmVuY2Vfc2F2ZV9zdGF0ZXNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF07XG5cblx0XHRcdFx0aWYgKCBzdGF0ZS50aW1lciApIHtcblx0XHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBzdGF0ZS50aW1lciApO1xuXHRcdFx0XHRcdHN0YXRlLnRpbWVyID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGF0ZS5wZW5kaW5nID0gZmFsc2U7XG5cdFx0XHRcdGlmICggc3RhdGUucmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc3RhdGUucmVxdWVzdC5hbHdheXMgKSB7XG5cdFx0XHRcdFx0d2FpdGVycy5wdXNoKCBuZXcgd2luZG93LlByb21pc2UoIGZ1bmN0aW9uICggcmVzb2x2ZSApIHtcblx0XHRcdFx0XHRcdHN0YXRlLnJlcXVlc3QuYWx3YXlzKCByZXNvbHZlICk7XG5cdFx0XHRcdFx0fSApICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHRcdGRldGFpbC53YWl0X3VudGlsKCB3aW5kb3cuUHJvbWlzZS5hbGwoIHdhaXRlcnMgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IHNoYXJlZCBSZXNldCBkZWZhdWx0cyBpbW1lZGlhdGVseSB0byBldmVyeSByZXRhaW5lZCBSZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIFRoZSBzZXJ2ZXIgYWxyZWFkeSByZW1vdmVkIHRoZSByZWdpc3RlcmVkIGV4dGVuc2lvbiBpbiB0aGUgc2FtZSBzdWNjZXNzZnVsXG5cdFx0ICogdXNlci1vcHRpb24gd3JpdGUuIEEgbGF0ZXIgYWNjZXB0ZWQgd2luZG93IGNvbmZpcm1zIHRoZSBhdXRob3JpdGF0aXZlXG5cdFx0ICogZGVmYXVsdCBEVE87IG5vIGFkZGl0aW9uYWwgdGltZS1yb3dzIHJlc2V0IHJlcXVlc3QgaXMgbWFkZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IE5ldXRyYWwgYWNjZXB0ZWQgcmVzZXQgbm90aWZpY2F0aW9uLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3ByZWZlcmVuY2VzX3Jlc2V0KCBldmVudCApIHtcblx0XHRcdGlmICggMSAhPT0gTnVtYmVyKCBldmVudCAmJiBldmVudC5kZXRhaWwgJiYgZXZlbnQuZGV0YWlsLnNjaGVtYV92ZXJzaW9uICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdE9iamVjdC5rZXlzKCBwcmVmZXJlbmNlX3NhdmVfc3RhdGVzX2J5X3Jlc291cmNlICkuZm9yRWFjaCggcmVtb3ZlX3ByZWZlcmVuY2Vfc2F2ZV9zdGF0ZSApO1xuXHRcdFx0T2JqZWN0LmtleXMoIHByZWZlcmVuY2VfbG9hZGVkX2J5X3Jlc291cmNlICkuY29uY2F0KCBPYmplY3Qua2V5cyggb3Blbl9yZXNvdXJjZV9pZHMgKSApLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0XHRyYW5nZV9wb2xpY2llc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSA9IHsgbW9kZTogJ2F1dG8nIH07XG5cdFx0XHRcdHpvb21fcGVyY2VudGFnZXNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSBnZXRfem9vbV9jb25maWd1cmF0aW9uKCkuZGVmYXVsdF9wZXJjZW50O1xuXHRcdFx0XHRwcmVmZXJlbmNlX3Jlc2V0X3BlbmRpbmdfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSB0cnVlO1xuXHRcdFx0XHRkZWxldGUgcHJlZmVyZW5jZV9sb2FkZWRfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF07XG5cdFx0XHRcdGRlbGV0ZSBwcm9qZWN0ZWRfcmVzb3VyY2VzWyByZXNvdXJjZV9pZCBdO1xuXHRcdFx0fSApO1xuXHRcdFx0cmVuZGVyX29wZW5fcmVzb3VyY2VzKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIG5ldXRyYWwgcHJlc2VudGF0aW9uIGhvc3Qvb3Blbi9jbG9zZS9yZW1vdmFsIGxpZmVjeWNsZSBldmVudHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBQcmVzZW50YXRpb24gbGlmZWN5Y2xlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3ByZXNlbnRhdGlvbl9saWZlY3ljbGUoIGV2ZW50ICkge1xuXHRcdFx0dmFyIGRldGFpbCA9IGV2ZW50ICYmIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKTtcblxuXHRcdFx0aWYgKCBwcmVzZW50YXRpb25faWQgIT09IFN0cmluZyggZGV0YWlsLnByZXNlbnRhdGlvbl9pZCB8fCAnJyApIHx8ICEgTnVtYmVyLmlzSW50ZWdlciggcmVzb3VyY2VfaWQgKSB8fCAxID4gcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpvcGVuZWQnID09PSBldmVudC50eXBlIHx8ICggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpob3N0cy1yZWFkeScgPT09IGV2ZW50LnR5cGUgJiYgdHJ1ZSA9PT0gZGV0YWlsLmlzX29wZW4gKSApIHtcblx0XHRcdFx0b3Blbl9yZXNvdXJjZV9pZHNbIHJlc291cmNlX2lkIF0gPSB0cnVlO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9yZXNvdXJjZV9wcmVmZXJlbmNlcyggcmVzb3VyY2VfaWQgKTtcblx0XHRcdFx0cmVuZGVyX3Jlc291cmNlKCByZXNvdXJjZV9pZCwgZGV0YWlsLmhvc3RzICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpjbG9zZWQnID09PSBldmVudC50eXBlIHx8ICd3cGJjOnRpbWVsaW5lOnJvdy1wcmVzZW50YXRpb246cmVtb3ZlZCcgPT09IGV2ZW50LnR5cGUgKSB7XG5cdFx0XHRcdGRlbGV0ZSBvcGVuX3Jlc291cmNlX2lkc1sgcmVzb3VyY2VfaWQgXTtcblx0XHRcdFx0cmVtb3ZlX3Jlc291cmNlX2xvY2FsX3N0YXRlKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0XHRpZiAoICd3cGJjOnRpbWVsaW5lOnJvdy1wcmVzZW50YXRpb246cmVtb3ZlZCcgPT09IGV2ZW50LnR5cGUgKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHJhbmdlX3BvbGljaWVzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdO1xuXHRcdFx0XHRcdGRlbGV0ZSB6b29tX3BlcmNlbnRhZ2VzX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdO1xuXHRcdFx0XHRcdGRlbGV0ZSBwcmVmZXJlbmNlX2xvYWRlZF9ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXTtcblx0XHRcdFx0XHRkZWxldGUgcHJlZmVyZW5jZV9yZXNldF9wZW5kaW5nX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdO1xuXHRcdFx0XHRcdHJlbW92ZV9wcmVmZXJlbmNlX3NhdmVfc3RhdGUoIHJlc291cmNlX2lkICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGV4YWN0IGRhdGEtb25seSBnZW9tZXRyeSBjb250ZXh0IGZvciBvbmUgcmVuZGVyZWQgUmVzb3VyY2UuXG5cdFx0ICpcblx0XHQgKiBUaGUgc2VsZWN0aW9uIGFuZCBtb3ZlbWVudCBtb2R1bGVzIGFkZCBnZXN0dXJlLWxvY2FsIERPTSBtZWFzdXJlbWVudHMgdG9cblx0XHQgKiB0aGlzIERUTyBiZWZvcmUgaW52b2tpbmcgdGhlIHNoYXJlZCBwdXJlIGdlb21ldHJ5IGtlcm5lbC4gQm9va2luZyBzZWdtZW50cyxcblx0XHQgKiBBdmFpbGFiaWxpdHkgZnJhZ21lbnRzLCB0ZW1wbGF0ZXMsIHRyYW5zcG9ydCwgYW5kIG11dGF0aW9uIGF1dGhvcml0eSBhcmVcblx0XHQgKiBkZWxpYmVyYXRlbHkgZXhjbHVkZWQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgT3BlbiBhdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBBY2NlcHRlZCBnZW9tZXRyeSBjb250ZXh0IG9yIG51bGwgd2hlbiB1bmF2YWlsYWJsZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfaW50ZXJhY3Rpb25fZ2VvbWV0cnlfY29udGV4dCggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHR2YXIgcHJvamVjdGlvbl9yZWNvcmQ7XG5cdFx0XHR2YXIgcHJvamVjdGlvbjtcblx0XHRcdHZhciB6b29tO1xuXG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgKTtcblx0XHRcdHByb2plY3Rpb25fcmVjb3JkID0gcHJvamVjdGVkX3Jlc291cmNlc1sgcmVzb3VyY2VfaWQgXTtcblx0XHRcdHByb2plY3Rpb24gPSBwcm9qZWN0aW9uX3JlY29yZCAmJiBwcm9qZWN0aW9uX3JlY29yZC5wcm9qZWN0aW9uO1xuXHRcdFx0aWYgKCAhIG9wZW5fcmVzb3VyY2VfaWRzWyByZXNvdXJjZV9pZCBdIHx8ICEgcHJvamVjdGlvbiB8fCAhIHByb2plY3Rpb24uaWRlbnRpdHkgfHwgISBBcnJheS5pc0FycmF5KCBwcm9qZWN0aW9uLmRhdGVzICkgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0em9vbSA9IGdldF96b29tX2NvbmZpZ3VyYXRpb24oKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c2NoZW1hX3ZlcnNpb246IDEsXG5cdFx0XHRcdGNhY2hlX2tleTogU3RyaW5nKCBwcm9qZWN0aW9uLmNhY2hlX2tleSB8fCAnJyApLFxuXHRcdFx0XHRhY2NlcHRlZF9pZGVudGl0eToge1xuXHRcdFx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcblx0XHRcdFx0XHRyZXNvdXJjZV9maW5nZXJwcmludDogU3RyaW5nKCBwcm9qZWN0aW9uLmlkZW50aXR5LnJlc291cmNlX2ZpbmdlcnByaW50IHx8ICcnICksXG5cdFx0XHRcdFx0Ym9va2luZ19nZW5lcmF0aW9uOiBOdW1iZXIoIHByb2plY3Rpb24uaWRlbnRpdHkuYm9va2luZ19nZW5lcmF0aW9uIHx8IDAgKSxcblx0XHRcdFx0XHRhdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbjogTnVtYmVyKCBwcm9qZWN0aW9uLmlkZW50aXR5LmF2YWlsYWJpbGl0eV9nZW5lcmF0aW9uIHx8IDAgKSxcblx0XHRcdFx0XHRhY2NlcHRlZF93aW5kb3dfa2V5czogYWNjZXB0ZWRfYm9va2luZ193aW5kb3dzLm1hcCggZnVuY3Rpb24gKCB3aW5kb3dfZW50cnkgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gU3RyaW5nKCB3aW5kb3dfZW50cnkgJiYgd2luZG93X2VudHJ5LmtleSB8fCAnJyApO1xuXHRcdFx0XHRcdH0gKS5maWx0ZXIoIEJvb2xlYW4gKSxcblx0XHRcdFx0XHR0aW1lem9uZTogU3RyaW5nKCBwcm9qZWN0aW9uLnRpbWV6b25lIHx8ICcnIClcblx0XHRcdFx0fSxcblx0XHRcdFx0ZGF0ZV9iYW5kczogcHJvamVjdGlvbi5kYXRlcy5tYXAoIGZ1bmN0aW9uICggZGF0ZV9iYW5kICkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRkYXRlOiBTdHJpbmcoIGRhdGVfYmFuZC5kYXRlIHx8ICcnICksXG5cdFx0XHRcdFx0XHRzdGFydF9hdDogU3RyaW5nKCBkYXRlX2JhbmQuc3RhcnRfYXQgfHwgJycgKSxcblx0XHRcdFx0XHRcdGVuZF9hdDogU3RyaW5nKCBkYXRlX2JhbmQuZW5kX2F0IHx8ICcnICksXG5cdFx0XHRcdFx0XHRzdGFydF9lcG9jaDogTnVtYmVyKCBkYXRlX2JhbmQuc3RhcnRfZXBvY2ggKSxcblx0XHRcdFx0XHRcdGVuZF9lcG9jaDogTnVtYmVyKCBkYXRlX2JhbmQuZW5kX2Vwb2NoICksXG5cdFx0XHRcdFx0XHRlbGFwc2VkX21pbnV0ZXM6IE51bWJlciggZGF0ZV9iYW5kLmVsYXBzZWRfbWludXRlcyApLFxuXHRcdFx0XHRcdFx0d2FsbF9taW51dGVzOiBOdW1iZXIoIGRhdGVfYmFuZC53YWxsX21pbnV0ZXMgKSxcblx0XHRcdFx0XHRcdHRyYW5zaXRpb25zOiAoIEFycmF5LmlzQXJyYXkoIGRhdGVfYmFuZC50cmFuc2l0aW9ucyApID8gZGF0ZV9iYW5kLnRyYW5zaXRpb25zIDogW10gKS5tYXAoIGZ1bmN0aW9uICggdHJhbnNpdGlvbiApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHR0cmFuc2l0aW9uX2lkOiBTdHJpbmcoIHRyYW5zaXRpb24udHJhbnNpdGlvbl9pZCB8fCAnJyApLFxuXHRcdFx0XHRcdFx0XHRcdGVwb2NoOiBOdW1iZXIoIHRyYW5zaXRpb24uZXBvY2ggKSxcblx0XHRcdFx0XHRcdFx0XHRraW5kOiBTdHJpbmcoIHRyYW5zaXRpb24ua2luZCB8fCAnJyApLFxuXHRcdFx0XHRcdFx0XHRcdHdhbGxfcmFuZ2Vfc3RhcnRfbWludXRlOiBOdW1iZXIoIHRyYW5zaXRpb24ud2FsbF9yYW5nZV9zdGFydF9taW51dGUgKSxcblx0XHRcdFx0XHRcdFx0XHR3YWxsX3JhbmdlX2VuZF9taW51dGU6IE51bWJlciggdHJhbnNpdGlvbi53YWxsX3JhbmdlX2VuZF9taW51dGUgKSxcblx0XHRcdFx0XHRcdFx0XHRvZmZzZXRfYmVmb3JlX3NlY29uZHM6IE51bWJlciggdHJhbnNpdGlvbi5vZmZzZXRfYmVmb3JlX3NlY29uZHMgKSxcblx0XHRcdFx0XHRcdFx0XHRvZmZzZXRfYWZ0ZXJfc2Vjb25kczogTnVtYmVyKCB0cmFuc2l0aW9uLm9mZnNldF9hZnRlcl9zZWNvbmRzIClcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdH0gKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gKSxcblx0XHRcdFx0dmlzaWJsZV9yYW5nZToge1xuXHRcdFx0XHRcdHN0YXJ0X21pbnV0ZTogTnVtYmVyKCBwcm9qZWN0aW9uLnJhbmdlICYmIHByb2plY3Rpb24ucmFuZ2Uuc3RhcnRfbWludXRlICksXG5cdFx0XHRcdFx0ZW5kX21pbnV0ZTogTnVtYmVyKCBwcm9qZWN0aW9uLnJhbmdlICYmIHByb2plY3Rpb24ucmFuZ2UuZW5kX21pbnV0ZSApXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHpvb21fcGVyY2VudDogZ2V0X3Jlc291cmNlX3pvb21fcGVyY2VudCggcmVzb3VyY2VfaWQgKSxcblx0XHRcdFx0aG91cl9oZWlnaHRfcHg6IHpvb20uaG91cl9oZWlnaHRfcHhcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGJvdW5kZWQgc2NhbGFyIHN0YXRlIGZvciBkZXZlbG9wbWVudCBhc3NlcnRpb25zLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fSBHZW5lcmF0aW9ucywgd2luZG93IGtleXMsIGFuZCBjYWNoZSBjb3VudHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3N0YXRlX3NuYXBzaG90KCkge1xuXHRcdFx0dmFyIHByb2plY3Rpb25fY291bnQgPSBPYmplY3Qua2V5cyggcHJvamVjdGlvbl9jYWNoZSApLnJlZHVjZSggZnVuY3Rpb24gKCBjb3VudCwgd2luZG93X2tleSApIHtcblx0XHRcdFx0cmV0dXJuIGNvdW50ICsgT2JqZWN0LmtleXMoIHByb2plY3Rpb25fY2FjaGVbIHdpbmRvd19rZXkgXSApLmxlbmd0aDtcblx0XHRcdH0sIDAgKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Ym9va2luZ19nZW5lcmF0aW9uOiBib29raW5nX2dlbmVyYXRpb24sXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV9nZW5lcmF0aW9uOiBhdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbixcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3N0YXRlOiBhdmFpbGFiaWxpdHlfc3RhdGUsXG5cdFx0XHRcdGJvb2tpbmdfd2luZG93X2tleXM6IE9iamVjdC5rZXlzKCBib29raW5nX2lkZW50aXRpZXNfYnlfa2V5ICksXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV93aW5kb3dfY291bnQ6IGFjY2VwdGVkX2F2YWlsYWJpbGl0eV93aW5kb3dzLmxlbmd0aCxcblx0XHRcdFx0b3Blbl9yZXNvdXJjZV9pZHM6IE9iamVjdC5rZXlzKCBvcGVuX3Jlc291cmNlX2lkcyApLm1hcCggTnVtYmVyICksXG5cdFx0XHRcdHJlc291cmNlX2luZGV4X2NvdW50OiBPYmplY3Qua2V5cyggcmVzb3VyY2Vfd2luZG93X2luZGV4ZXMgKS5sZW5ndGgsXG5cdFx0XHRcdHByb2plY3Rpb25fd2luZG93X2NvdW50OiBPYmplY3Qua2V5cyggcHJvamVjdGlvbl9jYWNoZSApLmxlbmd0aCxcblx0XHRcdFx0cHJvamVjdGlvbl9jb3VudDogcHJvamVjdGlvbl9jb3VudFxuXHRcdFx0XHRcdCsgT2JqZWN0LmtleXMoIHByb2plY3RlZF9yZXNvdXJjZXMgKS5sZW5ndGgsXG5cdFx0XHRcdHByb2plY3RlZF9yZXNvdXJjZV9jb3VudDogT2JqZWN0LmtleXMoIHByb2plY3RlZF9yZXNvdXJjZXMgKS5sZW5ndGgsXG5cdFx0XHRcdGJvb2tpbmdfcHJvamVjdGlvbl9yZXZpc2lvbjogYm9va2luZ19wcm9qZWN0aW9uX3JldmlzaW9uLFxuXHRcdFx0XHRhdmFpbGFiaWxpdHlfcHJvamVjdGlvbl9yZXZpc2lvbjogYXZhaWxhYmlsaXR5X3Byb2plY3Rpb25fcmV2aXNpb24sXG5cdFx0XHRcdGlzX2F1dGhvcml0YXRpdmVfcmVhZGJhY2tfcGVuZGluZzogaXNfYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19wZW5kaW5nLFxuXHRcdFx0XHRsYXN0X2Jvb2tpbmdfdHJhbnNpdGlvbjogbGFzdF9ib29raW5nX3RyYW5zaXRpb24sXG5cdFx0XHRcdGxhc3RfYXZhaWxhYmlsaXR5X3RyYW5zaXRpb246IGxhc3RfYXZhaWxhYmlsaXR5X3RyYW5zaXRpb25cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXR0YWNoIGFjY2VwdGVkLWRhdGEgYW5kIHByZXNlbnRhdGlvbiBsaWZlY3ljbGUgbGlzdGVuZXJzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdFx0aWYgKCAhIG1vdW50IHx8IGlzX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpc19pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpkYXRhOmJvb2tpbmctd2luZG93cy1hY2NlcHRlZCcsIGhhbmRsZV9ib29raW5nX3dpbmRvd3NfYWNjZXB0ZWQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6aW5pdGlhbC1jYW52YXMtcmVhZHknLCBoYW5kbGVfaW5pdGlhbF9jYW52YXNfcmVhZHkgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6YXZhaWxhYmlsaXR5LWFjY2VwdGVkJywgaGFuZGxlX2F2YWlsYWJpbGl0eV9hY2NlcHRlZCApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6ZGF0YTphdXRob3JpdGF0aXZlLXJlYWRiYWNrLXN0YXRlJywgaGFuZGxlX2F1dGhvcml0YXRpdmVfcmVhZGJhY2tfc3RhdGUgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6cHJlZmVyZW5jZXMtcmVzZXQnLCBoYW5kbGVfcHJlZmVyZW5jZXNfcmVzZXQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOnByZWZlcmVuY2VzOnJlc2V0LXJlcXVlc3RlZCcsIGhhbmRsZV9wcmVmZXJlbmNlc19yZXNldF9yZXF1ZXN0ZWQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOnJvdy1wcmVzZW50YXRpb246aG9zdHMtcmVhZHknLCBoYW5kbGVfcHJlc2VudGF0aW9uX2xpZmVjeWNsZSApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpvcGVuZWQnLCBoYW5kbGVfcHJlc2VudGF0aW9uX2xpZmVjeWNsZSApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpjbG9zZWQnLCBoYW5kbGVfcHJlc2VudGF0aW9uX2xpZmVjeWNsZSApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpyZW1vdmVkJywgaGFuZGxlX3ByZXNlbnRhdGlvbl9saWZlY3ljbGUgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZV9yYW5nZV9pbnB1dCApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlX3pvb21faW5wdXQgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfcmFuZ2VfY2hhbmdlICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX3pvb21fY2hhbmdlICk7XG5cdFx0XHRtb3VudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfcmFuZ2VfYWN0aW9uICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVtb3ZlIGxpc3RlbmVycyBhbmQgcmVsZWFzZSBldmVyeSByZXRhaW5lZCBEVE8gcmVmZXJlbmNlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBkZXN0cm95KCkge1xuXHRcdFx0aWYgKCAhIG1vdW50IHx8ICEgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjOnRpbWVsaW5lOmRhdGE6Ym9va2luZy13aW5kb3dzLWFjY2VwdGVkJywgaGFuZGxlX2Jvb2tpbmdfd2luZG93c19hY2NlcHRlZCApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6ZGF0YTppbml0aWFsLWNhbnZhcy1yZWFkeScsIGhhbmRsZV9pbml0aWFsX2NhbnZhc19yZWFkeSApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6ZGF0YTphdmFpbGFiaWxpdHktYWNjZXB0ZWQnLCBoYW5kbGVfYXZhaWxhYmlsaXR5X2FjY2VwdGVkICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpkYXRhOmF1dGhvcml0YXRpdmUtcmVhZGJhY2stc3RhdGUnLCBoYW5kbGVfYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19zdGF0ZSApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6ZGF0YTpwcmVmZXJlbmNlcy1yZXNldCcsIGhhbmRsZV9wcmVmZXJlbmNlc19yZXNldCApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cHJlZmVyZW5jZXM6cmVzZXQtcmVxdWVzdGVkJywgaGFuZGxlX3ByZWZlcmVuY2VzX3Jlc2V0X3JlcXVlc3RlZCApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpob3N0cy1yZWFkeScsIGhhbmRsZV9wcmVzZW50YXRpb25fbGlmZWN5Y2xlICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpyb3ctcHJlc2VudGF0aW9uOm9wZW5lZCcsIGhhbmRsZV9wcmVzZW50YXRpb25fbGlmZWN5Y2xlICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpyb3ctcHJlc2VudGF0aW9uOmNsb3NlZCcsIGhhbmRsZV9wcmVzZW50YXRpb25fbGlmZWN5Y2xlICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzp0aW1lbGluZTpyb3ctcHJlc2VudGF0aW9uOnJlbW92ZWQnLCBoYW5kbGVfcHJlc2VudGF0aW9uX2xpZmVjeWNsZSApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlX3JhbmdlX2lucHV0ICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBoYW5kbGVfem9vbV9pbnB1dCApO1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGhhbmRsZV9yYW5nZV9jaGFuZ2UgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfem9vbV9jaGFuZ2UgKTtcblx0XHRcdG1vdW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9yYW5nZV9hY3Rpb24gKTtcblx0XHRcdGFjY2VwdGVkX2Jvb2tpbmdfd2luZG93cyA9IFtdO1xuXHRcdFx0YWNjZXB0ZWRfYXZhaWxhYmlsaXR5X3dpbmRvd3MgPSBbXTtcblx0XHRcdGJvb2tpbmdfaWRlbnRpdGllc19ieV9rZXkgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRvcGVuX3Jlc291cmNlX2lkcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHRcdE9iamVjdC5rZXlzKCBwcmVmZXJlbmNlX3NhdmVfc3RhdGVzX2J5X3Jlc291cmNlICkuZm9yRWFjaCggcmVtb3ZlX3ByZWZlcmVuY2Vfc2F2ZV9zdGF0ZSApO1xuXHRcdFx0cmFuZ2VfcG9saWNpZXNfYnlfcmVzb3VyY2UgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR6b29tX3BlcmNlbnRhZ2VzX2J5X3Jlc291cmNlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdFx0cHJlZmVyZW5jZV9sb2FkZWRfYnlfcmVzb3VyY2UgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRwcmVmZXJlbmNlX3Jlc2V0X3BlbmRpbmdfYnlfcmVzb3VyY2UgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHRwcmVmZXJlbmNlX3NhdmVfc3RhdGVzX2J5X3Jlc291cmNlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdFx0YXZhaWxhYmlsaXR5X3N0YXRlID0gJ2xvYWRpbmcnO1xuXHRcdFx0Ym9va2luZ19wcm9qZWN0aW9uX3JldmlzaW9uID0gMDtcblx0XHRcdGF2YWlsYWJpbGl0eV9wcm9qZWN0aW9uX3JldmlzaW9uID0gMDtcblx0XHRcdGF1dGhvcml0YXRpdmVfcmVhZGJhY2tfZ2VuZXJhdGlvbiA9IDA7XG5cdFx0XHRpc19hdXRob3JpdGF0aXZlX3JlYWRiYWNrX3BlbmRpbmcgPSBmYWxzZTtcblx0XHRcdGxhc3RfYm9va2luZ190cmFuc2l0aW9uID0gbnVsbDtcblx0XHRcdGxhc3RfYXZhaWxhYmlsaXR5X3RyYW5zaXRpb24gPSBudWxsO1xuXHRcdFx0aW5pdGlhbF9vcGVuX2NvbXBsZXRlZCA9IGZhbHNlO1xuXHRcdFx0aWYgKCBhdXRvX29wZW5fYW5pbWF0aW9uX3RpbWVyICkge1xuXHRcdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBhdXRvX29wZW5fYW5pbWF0aW9uX3RpbWVyICk7XG5cdFx0XHRcdGF1dG9fb3Blbl9hbmltYXRpb25fdGltZXIgPSAwO1xuXHRcdFx0fVxuXHRcdFx0aW52YWxpZGF0ZV9sb2NhbF9jYWNoZXMoKTtcblx0XHRcdGlzX2luaXRpYWxpemVkID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxpemU6IGluaXRpYWxpemUsXG5cdFx0XHRkZXN0cm95OiBkZXN0cm95LFxuXHRcdFx0YWNjZXB0X2Jvb2tpbmdfd2luZG93czogYWNjZXB0X2Jvb2tpbmdfd2luZG93cyxcblx0XHRcdGFjY2VwdF9hdmFpbGFiaWxpdHk6IGFjY2VwdF9hdmFpbGFiaWxpdHksXG5cdFx0XHRnZXRfcmVzb3VyY2Vfd2luZG93X2luZGV4OiBnZXRfcmVzb3VyY2Vfd2luZG93X2luZGV4LFxuXHRcdFx0Y2FjaGVfcHJvamVjdGlvbjogY2FjaGVfcHJvamVjdGlvbixcblx0XHRcdHByb2plY3RfcmVzb3VyY2U6IHByb2plY3RfcmVzb3VyY2UsXG5cdFx0XHRidWlsZF9wcmVzZW50YXRpb25fbW9kZWw6IGJ1aWxkX3ByZXNlbnRhdGlvbl9tb2RlbCxcblx0XHRcdHJlbmRlcl9yZXNvdXJjZTogcmVuZGVyX3Jlc291cmNlLFxuXHRcdFx0Z2V0X2ludGVyYWN0aW9uX2dlb21ldHJ5X2NvbnRleHQ6IGdldF9pbnRlcmFjdGlvbl9nZW9tZXRyeV9jb250ZXh0LFxuXHRcdFx0Z2V0X3N0YXRlX3NuYXBzaG90OiBnZXRfc3RhdGVfc25hcHNob3QsXG5cdFx0XHRnZXRfYWNjZXB0ZWRfYm9va2luZ193aW5kb3dzOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBhY2NlcHRlZF9ib29raW5nX3dpbmRvd3M7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGlmIChcblx0XHR3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzXG5cdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeVxuXHQpIHtcblx0XHR3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzLnJlZ2lzdGVyX2ZhY3RvcnkoIG1vZHVsZV9pZCwgY3JlYXRlX3RpbWVfcm93c19jb250cm9sbGVyICk7XG5cdH1cbn0oIHdpbmRvdywgd2luZG93LndwICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsRUFBRSxFQUFHO0VBQ3pCLFlBQVk7O0VBRVosSUFBSUMsU0FBUyxHQUFHLFdBQVc7O0VBRTNCO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLDJCQUEyQkEsQ0FBRUMsT0FBTyxFQUFHO0lBQy9DLElBQUlDLEtBQUssR0FBR0QsT0FBTyxDQUFDQyxLQUFLLElBQUksSUFBSTtJQUNqQyxJQUFJQyxhQUFhLEdBQUdGLE9BQU8sQ0FBQ0UsYUFBYSxJQUFJLENBQUMsQ0FBQztJQUMvQyxJQUFJQyxnQkFBZ0IsR0FBR0gsT0FBTyxDQUFDRyxnQkFBZ0IsSUFBSSxDQUFDLENBQUM7SUFDckQsSUFBSUMsc0JBQXNCLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDRSxHQUFHLENBQUUsQ0FBQyxFQUFFQyxNQUFNLENBQUVOLGFBQWEsQ0FBQ08sTUFBTSxJQUFJUCxhQUFhLENBQUNPLE1BQU0sQ0FBQ0wsc0JBQXVCLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztJQUM3SSxJQUFJTSxlQUFlLEdBQUdDLE1BQU0sQ0FBRVQsYUFBYSxDQUFDUSxlQUFlLElBQUksRUFBRyxDQUFDO0lBQ25FLElBQUlFLHdCQUF3QixHQUFHLEVBQUU7SUFDakMsSUFBSUMsNkJBQTZCLEdBQUcsRUFBRTtJQUN0QyxJQUFJQyx5QkFBeUIsR0FBR0MsTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO0lBQ3JELElBQUlDLGlCQUFpQixHQUFHRixNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7SUFDN0MsSUFBSUUsMEJBQTBCLEdBQUdILE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztJQUN0RCxJQUFJRyw0QkFBNEIsR0FBR0osTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO0lBQ3hELElBQUlJLDZCQUE2QixHQUFHTCxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7SUFDekQsSUFBSUssb0NBQW9DLEdBQUdOLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztJQUNoRSxJQUFJTSxrQ0FBa0MsR0FBR1AsTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO0lBQzlELElBQUlPLHVCQUF1QixHQUFHUixNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7SUFDbkQsSUFBSVEsZ0JBQWdCLEdBQUdULE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztJQUM1QyxJQUFJUyxtQkFBbUIsR0FBR1YsTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO0lBQy9DLElBQUlVLGtCQUFrQixHQUFHLENBQUM7SUFDMUIsSUFBSUMsdUJBQXVCLEdBQUcsQ0FBQztJQUMvQixJQUFJQywyQkFBMkIsR0FBRyxDQUFDO0lBQ25DLElBQUlDLGdDQUFnQyxHQUFHLENBQUM7SUFDeEMsSUFBSUMsa0JBQWtCLEdBQUcsU0FBUztJQUNsQyxJQUFJQywwQkFBMEIsR0FBRyxFQUFFO0lBQ25DLElBQUlDLCtCQUErQixHQUFHLEVBQUU7SUFDeEMsSUFBSUMsaUNBQWlDLEdBQUcsQ0FBQztJQUN6QyxJQUFJQyxpQ0FBaUMsR0FBRyxLQUFLO0lBQzdDLElBQUlDLHVCQUF1QixHQUFHLElBQUk7SUFDbEMsSUFBSUMsNEJBQTRCLEdBQUcsSUFBSTtJQUN2QyxJQUFJQyxjQUFjLEdBQUcsS0FBSztJQUMxQixJQUFJQyxzQkFBc0IsR0FBRyxLQUFLO0lBQ2xDLElBQUlDLHlCQUF5QixHQUFHLENBQUM7O0lBRWpDO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLDRCQUE0QkEsQ0FBRUMsV0FBVyxFQUFHO01BQ3BEQyxpQkFBaUIsQ0FBRUQsV0FBWSxDQUFDLENBQUNFLE9BQU8sQ0FBRSxVQUFXQyxJQUFJLEVBQUc7UUFDM0RBLElBQUksQ0FBQ0MsU0FBUyxDQUFDQyxNQUFNLENBQUUsc0JBQXVCLENBQUM7TUFDaEQsQ0FBRSxDQUFDO01BQ0gsSUFBS1AseUJBQXlCLEVBQUc7UUFDaEMzQyxNQUFNLENBQUNtRCxZQUFZLENBQUVSLHlCQUEwQixDQUFDO1FBQ2hEQSx5QkFBeUIsR0FBRyxDQUFDO01BQzlCO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTUywyQkFBMkJBLENBQUVDLEtBQUssRUFBRztNQUM3QyxJQUFJQyxZQUFZLEdBQUdoRCxhQUFhLENBQUNnRCxZQUFZLElBQUksQ0FBQyxDQUFDO01BQ25ELElBQUlULFdBQVc7TUFDZixJQUFJVSxLQUFLO01BRVQsSUFBS2Isc0JBQXNCLElBQUksQ0FBQyxLQUFLOUIsTUFBTSxDQUFFeUMsS0FBSyxJQUFJQSxLQUFLLENBQUNHLE1BQU0sSUFBSUgsS0FBSyxDQUFDRyxNQUFNLENBQUNDLGNBQWUsQ0FBQyxFQUFHO1FBQ3JHO01BQ0Q7TUFDQWYsc0JBQXNCLEdBQUcsSUFBSTtNQUM3QixJQUFLLElBQUksS0FBS1ksWUFBWSxDQUFDSSxjQUFjLElBQUksVUFBVSxLQUFLLE9BQU9uRCxnQkFBZ0IsQ0FBQ29ELFVBQVUsRUFBRztRQUNoRztNQUNEO01BQ0FkLFdBQVcsR0FBR2pDLE1BQU0sQ0FBRUwsZ0JBQWdCLENBQUNvRCxVQUFVLENBQUU3QyxlQUFnQixDQUFFLENBQUM7TUFDdEUsSUFBSyxDQUFFRixNQUFNLENBQUNnRCxTQUFTLENBQUVmLFdBQVksQ0FBQyxJQUFJLENBQUMsR0FBR0EsV0FBVyxJQUFJLElBQUksS0FBS1MsWUFBWSxDQUFDTyxPQUFPLEVBQUc7UUFDNUY7TUFDRDtNQUNBTixLQUFLLEdBQUdULGlCQUFpQixDQUFFRCxXQUFZLENBQUM7TUFDeENVLEtBQUssQ0FBQ1IsT0FBTyxDQUFFLFVBQVdDLElBQUksRUFBRztRQUNoQ0EsSUFBSSxDQUFDQyxTQUFTLENBQUNhLEdBQUcsQ0FBRSxzQkFBdUIsQ0FBQztNQUM3QyxDQUFFLENBQUM7TUFDSG5CLHlCQUF5QixHQUFHM0MsTUFBTSxDQUFDK0QsVUFBVSxDQUFFLFlBQVk7UUFDMURuQiw0QkFBNEIsQ0FBRUMsV0FBWSxDQUFDO01BQzVDLENBQUMsRUFBRSxHQUFJLENBQUM7SUFDVDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbUIsc0JBQXNCQSxDQUFFQyxTQUFTLEVBQUc7TUFDNUMsSUFBSUMsUUFBUSxHQUFHL0MsTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO01BRXBDLE9BQU8sQ0FBRStDLEtBQUssQ0FBQ0MsT0FBTyxDQUFFSCxTQUFVLENBQUMsR0FBR0EsU0FBUyxHQUFHLEVBQUUsRUFBR0ksR0FBRyxDQUFFLFVBQVdDLFFBQVEsRUFBRztRQUNqRixPQUFPMUQsTUFBTSxDQUFFMEQsUUFBUSxJQUFJLFFBQVEsS0FBSyxPQUFPQSxRQUFRLEdBQUdBLFFBQVEsQ0FBQ0MsRUFBRSxHQUFHRCxRQUFTLENBQUM7TUFDbkYsQ0FBRSxDQUFDLENBQUNFLE1BQU0sQ0FBRSxVQUFXM0IsV0FBVyxFQUFHO1FBQ3BDLElBQUssQ0FBRWpDLE1BQU0sQ0FBQ2dELFNBQVMsQ0FBRWYsV0FBWSxDQUFDLElBQUksQ0FBQyxHQUFHQSxXQUFXLElBQUlxQixRQUFRLENBQUVyQixXQUFXLENBQUUsRUFBRztVQUN0RixPQUFPLEtBQUs7UUFDYjtRQUNBcUIsUUFBUSxDQUFFckIsV0FBVyxDQUFFLEdBQUcsSUFBSTtRQUM5QixPQUFPLElBQUk7TUFDWixDQUFFLENBQUMsQ0FBQzRCLElBQUksQ0FBRSxVQUFXQyxPQUFPLEVBQUVDLFFBQVEsRUFBRztRQUN4QyxPQUFPRCxPQUFPLEdBQUdDLFFBQVE7TUFDMUIsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLDJCQUEyQkEsQ0FBQSxFQUFHO01BQ3RDLE9BQU9uRSxJQUFJLENBQUNDLEdBQUcsQ0FBRSxFQUFFLEVBQUVELElBQUksQ0FBQ0UsR0FBRyxDQUFFLEVBQUUsRUFBRUMsTUFBTSxDQUFFTixhQUFhLENBQUNPLE1BQU0sSUFBSVAsYUFBYSxDQUFDTyxNQUFNLENBQUNnRSx1QkFBd0IsQ0FBQyxJQUFJLEVBQUcsQ0FBRSxDQUFDO0lBQzVIOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MscUJBQXFCQSxDQUFFQyxTQUFTLEVBQUVDLFFBQVEsRUFBRztNQUNyRCxJQUFJQyxZQUFZLEdBQUdMLDJCQUEyQixDQUFDLENBQUM7TUFFaERHLFNBQVMsR0FBR25FLE1BQU0sQ0FBRW1FLFNBQVUsQ0FBQztNQUMvQixJQUFLLENBQUVuRSxNQUFNLENBQUNzRSxRQUFRLENBQUVILFNBQVUsQ0FBQyxFQUFHO1FBQ3JDQSxTQUFTLEdBQUdDLFFBQVE7TUFDckI7TUFDQSxPQUFPdkUsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFRCxJQUFJLENBQUNFLEdBQUcsQ0FBRSxJQUFJLEVBQUVGLElBQUksQ0FBQzBFLEtBQUssQ0FBRUosU0FBUyxHQUFHRSxZQUFhLENBQUMsR0FBR0EsWUFBYSxDQUFFLENBQUM7SUFDOUY7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0csc0JBQXNCQSxDQUFFQyxZQUFZLEVBQUc7TUFDL0MsSUFBSUMsSUFBSSxHQUFHdkUsTUFBTSxDQUFFc0UsWUFBWSxJQUFJQSxZQUFZLENBQUNDLElBQUksSUFBSSxNQUFPLENBQUM7TUFDaEUsSUFBSUwsWUFBWSxHQUFHTCwyQkFBMkIsQ0FBQyxDQUFDO01BQ2hELElBQUlXLFlBQVk7TUFDaEIsSUFBSUMsVUFBVTtNQUVkLElBQUssVUFBVSxLQUFLRixJQUFJLEVBQUc7UUFDMUIsT0FBTztVQUFFQSxJQUFJLEVBQUU7UUFBVyxDQUFDO01BQzVCO01BQ0EsSUFBSyxRQUFRLEtBQUtBLElBQUksRUFBRztRQUN4QixPQUFPO1VBQUVBLElBQUksRUFBRTtRQUFPLENBQUM7TUFDeEI7TUFDQUMsWUFBWSxHQUFHVCxxQkFBcUIsQ0FBRU8sWUFBWSxDQUFDRSxZQUFZLEVBQUUsQ0FBRSxDQUFDO01BQ3BFQyxVQUFVLEdBQUdWLHFCQUFxQixDQUFFTyxZQUFZLENBQUNHLFVBQVUsRUFBRSxJQUFLLENBQUM7TUFDbkVELFlBQVksR0FBRzlFLElBQUksQ0FBQ0UsR0FBRyxDQUFFLElBQUksR0FBR3NFLFlBQVksRUFBRU0sWUFBYSxDQUFDO01BQzVEQyxVQUFVLEdBQUcvRSxJQUFJLENBQUNDLEdBQUcsQ0FBRTZFLFlBQVksR0FBR04sWUFBWSxFQUFFTyxVQUFXLENBQUM7TUFFaEUsT0FBTztRQUNORixJQUFJLEVBQUUsUUFBUTtRQUNkQyxZQUFZLEVBQUVBLFlBQVk7UUFDMUJDLFVBQVUsRUFBRS9FLElBQUksQ0FBQ0UsR0FBRyxDQUFFLElBQUksRUFBRTZFLFVBQVc7TUFDeEMsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxzQkFBc0JBLENBQUEsRUFBRztNQUNqQyxJQUFJdkIsUUFBUSxHQUFHL0MsTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO01BRXBDLE9BQU8sQ0FBRStDLEtBQUssQ0FBQ0MsT0FBTyxDQUFFOUQsYUFBYSxDQUFDb0YsYUFBYyxDQUFDLEdBQUdwRixhQUFhLENBQUNvRixhQUFhLEdBQUcsRUFBRSxFQUFHckIsR0FBRyxDQUFFLFVBQVdzQixNQUFNLEVBQUc7UUFDbkgsSUFBSUMsU0FBUyxHQUFHN0UsTUFBTSxDQUFFNEUsTUFBTSxJQUFJQSxNQUFNLENBQUNwQixFQUFFLElBQUksRUFBRyxDQUFDO1FBQ25ELElBQUljLFlBQVk7UUFFaEIsSUFBSyxDQUFFLGVBQWUsQ0FBQ1EsSUFBSSxDQUFFRCxTQUFVLENBQUMsSUFBSTFCLFFBQVEsQ0FBRTBCLFNBQVMsQ0FBRSxFQUFHO1VBQ25FLE9BQU8sSUFBSTtRQUNaO1FBQ0FQLFlBQVksR0FBR0Qsc0JBQXNCLENBQUU7VUFDdENFLElBQUksRUFBRSxRQUFRO1VBQ2RDLFlBQVksRUFBRUksTUFBTSxDQUFDSixZQUFZO1VBQ2pDQyxVQUFVLEVBQUVHLE1BQU0sQ0FBQ0g7UUFDcEIsQ0FBRSxDQUFDO1FBQ0gsSUFBSyxRQUFRLEtBQUtILFlBQVksQ0FBQ0MsSUFBSSxFQUFHO1VBQ3JDLE9BQU8sSUFBSTtRQUNaO1FBQ0FwQixRQUFRLENBQUUwQixTQUFTLENBQUUsR0FBRyxJQUFJO1FBQzVCLE9BQU87VUFDTnJCLEVBQUUsRUFBRXFCLFNBQVM7VUFDYkwsWUFBWSxFQUFFRixZQUFZLENBQUNFLFlBQVk7VUFDdkNDLFVBQVUsRUFBRUgsWUFBWSxDQUFDRyxVQUFVO1VBQ25DTSxLQUFLLEVBQUUvRSxNQUFNLENBQUU0RSxNQUFNLENBQUNHLEtBQUssSUFBSSxFQUFHLENBQUM7VUFDbkNDLFVBQVUsRUFBRWhGLE1BQU0sQ0FBRTRFLE1BQU0sQ0FBQ0ksVUFBVSxJQUFJSixNQUFNLENBQUNHLEtBQUssSUFBSSxFQUFHO1FBQzdELENBQUM7TUFDRixDQUFFLENBQUMsQ0FBQ3RCLE1BQU0sQ0FBRXdCLE9BQVEsQ0FBQztJQUN0Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyx5QkFBeUJBLENBQUVaLFlBQVksRUFBRztNQUNsRCxJQUFJYSxpQkFBaUIsR0FBR2Qsc0JBQXNCLENBQUVDLFlBQWEsQ0FBQztNQUU5RCxJQUFLLFFBQVEsS0FBS2EsaUJBQWlCLENBQUNaLElBQUksRUFBRztRQUMxQyxPQUFPLElBQUk7TUFDWjtNQUNBLE9BQU9HLHNCQUFzQixDQUFDLENBQUMsQ0FBQ1UsSUFBSSxDQUFFLFVBQVdSLE1BQU0sRUFBRztRQUN6RCxPQUFPQSxNQUFNLENBQUNKLFlBQVksS0FBS1csaUJBQWlCLENBQUNYLFlBQVksSUFDekRJLE1BQU0sQ0FBQ0gsVUFBVSxLQUFLVSxpQkFBaUIsQ0FBQ1YsVUFBVTtNQUN2RCxDQUFFLENBQUMsSUFBSSxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1kseUJBQXlCQSxDQUFFdkQsV0FBVyxFQUFHO01BQ2pELE9BQU91QyxzQkFBc0IsQ0FBRTlELDBCQUEwQixDQUFFVixNQUFNLENBQUVpQyxXQUFZLENBQUMsQ0FBRSxJQUFJO1FBQUV5QyxJQUFJLEVBQUU7TUFBTyxDQUFFLENBQUM7SUFDekc7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNlLHNCQUFzQkEsQ0FBQSxFQUFHO01BQ2pDLElBQUl4RixNQUFNLEdBQUdQLGFBQWEsQ0FBQ08sTUFBTSxJQUFJLENBQUMsQ0FBQztNQUN2QyxJQUFJeUYsT0FBTyxHQUFHN0YsSUFBSSxDQUFDQyxHQUFHLENBQUUsRUFBRSxFQUFFRSxNQUFNLENBQUVDLE1BQU0sQ0FBQzBGLHFCQUFzQixDQUFDLElBQUksRUFBRyxDQUFDO01BQzFFLElBQUlDLE9BQU8sR0FBRy9GLElBQUksQ0FBQ0MsR0FBRyxDQUFFNEYsT0FBTyxFQUFFMUYsTUFBTSxDQUFFQyxNQUFNLENBQUM0RixxQkFBc0IsQ0FBQyxJQUFJLEdBQUksQ0FBQztNQUNoRixJQUFJQyxJQUFJLEdBQUdqRyxJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVFLE1BQU0sQ0FBRUMsTUFBTSxDQUFDOEYsc0JBQXVCLENBQUMsSUFBSSxFQUFHLENBQUM7TUFFdkUsT0FBTztRQUNOQyxXQUFXLEVBQUVOLE9BQU87UUFDcEJPLFdBQVcsRUFBRUwsT0FBTztRQUNwQk0sWUFBWSxFQUFFSixJQUFJO1FBQ2xCSyxlQUFlLEVBQUV0RyxJQUFJLENBQUNDLEdBQUcsQ0FBRTRGLE9BQU8sRUFBRTdGLElBQUksQ0FBQ0UsR0FBRyxDQUFFNkYsT0FBTyxFQUFFNUYsTUFBTSxDQUFFQyxNQUFNLENBQUNtRyx5QkFBMEIsQ0FBQyxJQUFJLEdBQUksQ0FBRSxDQUFDO1FBQzVHQyxjQUFjLEVBQUV4RyxJQUFJLENBQUNDLEdBQUcsQ0FBRSxFQUFFLEVBQUVFLE1BQU0sQ0FBRUMsTUFBTSxDQUFDcUcsbUJBQW9CLENBQUMsSUFBSSxFQUFHLENBQUM7UUFDMUVDLHNCQUFzQixFQUFFMUcsSUFBSSxDQUFDQyxHQUFHLENBQUUsR0FBRyxFQUFFRSxNQUFNLENBQUVDLE1BQU0sQ0FBQ3VHLHVCQUF3QixDQUFDLElBQUksR0FBSTtNQUN4RixDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0Msc0JBQXNCQSxDQUFFdEMsU0FBUyxFQUFHO01BQzVDLElBQUl1QyxJQUFJLEdBQUdqQixzQkFBc0IsQ0FBQyxDQUFDO01BQ25DLElBQUlrQixVQUFVLEdBQUczRyxNQUFNLENBQUVtRSxTQUFVLENBQUM7TUFFcEMsSUFBSyxDQUFFbkUsTUFBTSxDQUFDc0UsUUFBUSxDQUFFcUMsVUFBVyxDQUFDLEVBQUc7UUFDdENBLFVBQVUsR0FBR0QsSUFBSSxDQUFDUCxlQUFlO01BQ2xDO01BQ0FRLFVBQVUsR0FBR0QsSUFBSSxDQUFDVixXQUFXLEdBQUduRyxJQUFJLENBQUMwRSxLQUFLLENBQUUsQ0FBRW9DLFVBQVUsR0FBR0QsSUFBSSxDQUFDVixXQUFXLElBQUtVLElBQUksQ0FBQ1IsWUFBYSxDQUFDLEdBQUdRLElBQUksQ0FBQ1IsWUFBWTtNQUV2SCxPQUFPckcsSUFBSSxDQUFDQyxHQUFHLENBQUU0RyxJQUFJLENBQUNWLFdBQVcsRUFBRW5HLElBQUksQ0FBQ0UsR0FBRyxDQUFFMkcsSUFBSSxDQUFDVCxXQUFXLEVBQUVVLFVBQVcsQ0FBRSxDQUFDO0lBQzlFOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLHlCQUF5QkEsQ0FBRTNFLFdBQVcsRUFBRztNQUNqRCxPQUFPd0Usc0JBQXNCLENBQUU5Riw0QkFBNEIsQ0FBRVgsTUFBTSxDQUFFaUMsV0FBWSxDQUFDLENBQUcsQ0FBQztJQUN2Rjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTNEUsaUNBQWlDQSxDQUFFNUUsV0FBVyxFQUFHO01BQ3pELElBQUl5QixRQUFRLEdBQUdvRCxtQkFBbUIsQ0FBRTdFLFdBQVksQ0FBQztNQUNqRCxJQUFJOEUsV0FBVyxHQUFHckQsUUFBUSxDQUFDc0QsNEJBQTRCO01BRXZELElBQUssQ0FBRUQsV0FBVyxJQUFJLFFBQVEsS0FBSyxPQUFPQSxXQUFXLElBQUksQ0FBRUEsV0FBVyxDQUFFN0csZUFBZSxDQUFFLEVBQUc7UUFDM0YsT0FBTyxJQUFJO01BQ1o7TUFFQSxPQUFPNkcsV0FBVyxDQUFFN0csZUFBZSxDQUFFO0lBQ3RDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTK0csZ0NBQWdDQSxDQUFFaEYsV0FBVyxFQUFHO01BQ3hELElBQUk4RSxXQUFXLEdBQUdGLGlDQUFpQyxDQUFFNUUsV0FBWSxDQUFDO01BRWxFQSxXQUFXLEdBQUdqQyxNQUFNLENBQUVpQyxXQUFZLENBQUM7TUFDbkMsSUFBSyxDQUFFOEUsV0FBVyxJQUFJLENBQUMsS0FBSy9HLE1BQU0sQ0FBRStHLFdBQVcsQ0FBQ2xFLGNBQWUsQ0FBQyxFQUFHO1FBQ2xFLE9BQU8sS0FBSztNQUNiO01BQ0EsSUFBS2hDLG9DQUFvQyxDQUFFb0IsV0FBVyxDQUFFLElBQUksSUFBSSxLQUFLOEUsV0FBVyxDQUFDRyxZQUFZLEVBQUc7UUFDL0YsT0FBTyxLQUFLO01BQ2I7TUFDQSxJQUFLdEcsNkJBQTZCLENBQUVxQixXQUFXLENBQUUsSUFBSSxDQUFFcEIsb0NBQW9DLENBQUVvQixXQUFXLENBQUUsRUFBRztRQUM1RyxPQUFPLElBQUk7TUFDWjtNQUVBdkIsMEJBQTBCLENBQUV1QixXQUFXLENBQUUsR0FBR3VDLHNCQUFzQixDQUFFdUMsV0FBVyxDQUFDdEMsWUFBWSxJQUFJO1FBQUVDLElBQUksRUFBRTtNQUFPLENBQUUsQ0FBQztNQUNsSC9ELDRCQUE0QixDQUFFc0IsV0FBVyxDQUFFLEdBQUd3RSxzQkFBc0IsQ0FBRU0sV0FBVyxDQUFDSSxZQUFhLENBQUM7TUFDaEd2Ryw2QkFBNkIsQ0FBRXFCLFdBQVcsQ0FBRSxHQUFHLElBQUk7TUFDbkQsT0FBT3BCLG9DQUFvQyxDQUFFb0IsV0FBVyxDQUFFO01BRTFELE9BQU8sSUFBSTtJQUNaOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbUYseUNBQXlDQSxDQUFBLEVBQUc7TUFDcEQsSUFBSUMsWUFBWSxHQUFHLEVBQUU7TUFFckJqSCx3QkFBd0IsQ0FBQytCLE9BQU8sQ0FBRSxVQUFXbUYsWUFBWSxFQUFHO1FBQzNELElBQUlqRSxTQUFTLEdBQUdpRSxZQUFZLElBQUlBLFlBQVksQ0FBQ0MsT0FBTyxJQUFJaEUsS0FBSyxDQUFDQyxPQUFPLENBQUU4RCxZQUFZLENBQUNDLE9BQU8sQ0FBQ2xFLFNBQVUsQ0FBQyxHQUNwR2lFLFlBQVksQ0FBQ0MsT0FBTyxDQUFDbEUsU0FBUyxHQUM5QixFQUFFO1FBRUxnRSxZQUFZLEdBQUdBLFlBQVksQ0FBQ0csTUFBTSxDQUFFcEUsc0JBQXNCLENBQUVDLFNBQVUsQ0FBRSxDQUFDO01BQzFFLENBQUUsQ0FBQztNQUNIRCxzQkFBc0IsQ0FBRWlFLFlBQWEsQ0FBQyxDQUFDbEYsT0FBTyxDQUFFOEUsZ0NBQWlDLENBQUM7SUFDbkY7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTUSwwQkFBMEJBLENBQUV4RixXQUFXLEVBQUV5RixPQUFPLEVBQUc7TUFDM0R4RixpQkFBaUIsQ0FBRUQsV0FBWSxDQUFDLENBQUNFLE9BQU8sQ0FBRSxVQUFXQyxJQUFJLEVBQUc7UUFDM0QsSUFBSXVGLE1BQU0sR0FBR3ZGLElBQUksSUFBSUEsSUFBSSxDQUFDd0YsYUFBYSxHQUNwQ3hGLElBQUksQ0FBQ3dGLGFBQWEsQ0FBRSxrREFBbUQsQ0FBQyxHQUN4RSxJQUFJO1FBRVAsSUFBS0QsTUFBTSxFQUFHO1VBQ2JBLE1BQU0sQ0FBQ0UsV0FBVyxHQUFHMUgsTUFBTSxDQUFFdUgsT0FBTyxJQUFJLEVBQUcsQ0FBQztRQUM3QztNQUNELENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNJLHlCQUF5QkEsQ0FBRTdGLFdBQVcsRUFBRztNQUNqREEsV0FBVyxHQUFHakMsTUFBTSxDQUFFaUMsV0FBWSxDQUFDO01BQ25DLElBQUssQ0FBRW5CLGtDQUFrQyxDQUFFbUIsV0FBVyxDQUFFLEVBQUc7UUFDMURuQixrQ0FBa0MsQ0FBRW1CLFdBQVcsQ0FBRSxHQUFHO1VBQ25EOEYsS0FBSyxFQUFFLElBQUk7VUFDWEMsT0FBTyxFQUFFLElBQUk7VUFDYkMsT0FBTyxFQUFFO1FBQ1YsQ0FBQztNQUNGO01BRUEsT0FBT25ILGtDQUFrQyxDQUFFbUIsV0FBVyxDQUFFO0lBQ3pEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNpRyw2QkFBNkJBLENBQUVqRyxXQUFXLEVBQUc7TUFDckQsSUFBSXdDLFlBQVksR0FBR2UseUJBQXlCLENBQUV2RCxXQUFZLENBQUM7TUFFM0QsT0FBTztRQUNOQSxXQUFXLEVBQUVqQyxNQUFNLENBQUVpQyxXQUFZLENBQUM7UUFDbENrRyxVQUFVLEVBQUUxRCxZQUFZLENBQUNDLElBQUk7UUFDN0JDLFlBQVksRUFBRSxRQUFRLEtBQUtGLFlBQVksQ0FBQ0MsSUFBSSxHQUFHRCxZQUFZLENBQUNFLFlBQVksR0FBRyxDQUFDO1FBQzVFQyxVQUFVLEVBQUUsUUFBUSxLQUFLSCxZQUFZLENBQUNDLElBQUksR0FBR0QsWUFBWSxDQUFDRyxVQUFVLEdBQUcsSUFBSTtRQUMzRXVDLFlBQVksRUFBRVAseUJBQXlCLENBQUUzRSxXQUFZO01BQ3RELENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbUcscUJBQXFCQSxDQUFFbkcsV0FBVyxFQUFHO01BQzdDLElBQUlvRyxTQUFTLEdBQUczSSxhQUFhLENBQUNxSCxXQUFXLElBQUksQ0FBQyxDQUFDO01BQy9DLElBQUl1QixLQUFLLEdBQUdSLHlCQUF5QixDQUFFN0YsV0FBWSxDQUFDO01BQ3BELElBQUlzRixPQUFPO01BRVh0RixXQUFXLEdBQUdqQyxNQUFNLENBQUVpQyxXQUFZLENBQUM7TUFDbkNxRyxLQUFLLENBQUNQLEtBQUssR0FBRyxJQUFJO01BQ2xCLElBQUtPLEtBQUssQ0FBQ04sT0FBTyxJQUFJLENBQUVNLEtBQUssQ0FBQ0wsT0FBTyxFQUFHO1FBQ3ZDO01BQ0Q7TUFDQSxJQUFLLENBQUU3SSxNQUFNLENBQUNtSixNQUFNLElBQUksQ0FBRUYsU0FBUyxDQUFDRyxHQUFHLElBQUksQ0FBRUgsU0FBUyxDQUFDSSxNQUFNLElBQUksQ0FBRUosU0FBUyxDQUFDSyxLQUFLLEVBQUc7UUFDcEZKLEtBQUssQ0FBQ0wsT0FBTyxHQUFHLEtBQUs7UUFDckJSLDBCQUEwQixDQUFFeEYsV0FBVyxFQUFFdkMsYUFBYSxDQUFDaUosSUFBSSxJQUFJakosYUFBYSxDQUFDaUosSUFBSSxDQUFDQyx1QkFBd0IsQ0FBQztRQUMzRztNQUNEO01BRUFOLEtBQUssQ0FBQ0wsT0FBTyxHQUFHLEtBQUs7TUFDckJWLE9BQU8sR0FBR2hILE1BQU0sQ0FBQ3NJLE1BQU0sQ0FBRTtRQUN4QkosTUFBTSxFQUFFSixTQUFTLENBQUNJLE1BQU07UUFDeEJDLEtBQUssRUFBRUwsU0FBUyxDQUFDSztNQUNsQixDQUFDLEVBQUVSLDZCQUE2QixDQUFFakcsV0FBWSxDQUFFLENBQUM7TUFDakR3RiwwQkFBMEIsQ0FBRXhGLFdBQVcsRUFBRSxFQUFHLENBQUM7TUFDN0NxRyxLQUFLLENBQUNOLE9BQU8sR0FBRzVJLE1BQU0sQ0FBQ21KLE1BQU0sQ0FBQ08sSUFBSSxDQUFFO1FBQ25DTixHQUFHLEVBQUVILFNBQVMsQ0FBQ0csR0FBRztRQUNsQk8sTUFBTSxFQUFFLE1BQU07UUFDZEMsUUFBUSxFQUFFLE1BQU07UUFDaEJDLElBQUksRUFBRTFCO01BQ1AsQ0FBRSxDQUFDLENBQUMyQixJQUFJLENBQUUsVUFBV0MsUUFBUSxFQUFHO1FBQy9CLElBQUlwQyxXQUFXLEdBQUdvQyxRQUFRLElBQUlBLFFBQVEsQ0FBQ0MsT0FBTyxJQUFJRCxRQUFRLENBQUNGLElBQUksR0FDNURFLFFBQVEsQ0FBQ0YsSUFBSSxDQUFDbEMsV0FBVyxHQUN6QixJQUFJO1FBRVAsSUFBS3VCLEtBQUssQ0FBQ0wsT0FBTyxJQUFJLENBQUVsQixXQUFXLElBQUkvRyxNQUFNLENBQUVtSixRQUFRLENBQUNGLElBQUksQ0FBQ2hILFdBQVksQ0FBQyxLQUFLQSxXQUFXLEVBQUc7VUFDNUY7UUFDRDtRQUNBdkIsMEJBQTBCLENBQUV1QixXQUFXLENBQUUsR0FBR3VDLHNCQUFzQixDQUFFdUMsV0FBVyxDQUFDdEMsWUFBWSxJQUFJO1VBQUVDLElBQUksRUFBRTtRQUFPLENBQUUsQ0FBQztRQUNsSC9ELDRCQUE0QixDQUFFc0IsV0FBVyxDQUFFLEdBQUd3RSxzQkFBc0IsQ0FBRU0sV0FBVyxDQUFDSSxZQUFhLENBQUM7UUFDaEd2Ryw2QkFBNkIsQ0FBRXFCLFdBQVcsQ0FBRSxHQUFHLElBQUk7TUFDcEQsQ0FBRSxDQUFDLENBQUNvSCxJQUFJLENBQUUsWUFBWTtRQUNyQjVCLDBCQUEwQixDQUFFeEYsV0FBVyxFQUFFdkMsYUFBYSxDQUFDaUosSUFBSSxJQUFJakosYUFBYSxDQUFDaUosSUFBSSxDQUFDQyx1QkFBd0IsQ0FBQztNQUM1RyxDQUFFLENBQUMsQ0FBQ1UsTUFBTSxDQUFFLFlBQVk7UUFDdkJoQixLQUFLLENBQUNOLE9BQU8sR0FBRyxJQUFJO1FBQ3BCLElBQUtNLEtBQUssQ0FBQ0wsT0FBTyxJQUFJcEcsY0FBYyxFQUFHO1VBQ3RDdUcscUJBQXFCLENBQUVuRyxXQUFZLENBQUM7UUFDckM7TUFDRCxDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTc0gscUJBQXFCQSxDQUFFdEgsV0FBVyxFQUFHO01BQzdDLElBQUlxRyxLQUFLLEdBQUdSLHlCQUF5QixDQUFFN0YsV0FBWSxDQUFDO01BRXBEcUcsS0FBSyxDQUFDTCxPQUFPLEdBQUcsSUFBSTtNQUNwQixJQUFLSyxLQUFLLENBQUNOLE9BQU8sSUFBSU0sS0FBSyxDQUFDUCxLQUFLLEVBQUc7UUFDbkM7TUFDRDtNQUNBTyxLQUFLLENBQUNQLEtBQUssR0FBRzNJLE1BQU0sQ0FBQytELFVBQVUsQ0FBRSxZQUFZO1FBQzVDaUYscUJBQXFCLENBQUVuRyxXQUFZLENBQUM7TUFDckMsQ0FBQyxFQUFFLEdBQUksQ0FBQztJQUNUOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN1SCw0QkFBNEJBLENBQUV2SCxXQUFXLEVBQUc7TUFDcEQsSUFBSXFHLEtBQUssR0FBR3hILGtDQUFrQyxDQUFFZCxNQUFNLENBQUVpQyxXQUFZLENBQUMsQ0FBRTtNQUV2RSxJQUFLcUcsS0FBSyxJQUFJQSxLQUFLLENBQUNQLEtBQUssRUFBRztRQUMzQjNJLE1BQU0sQ0FBQ21ELFlBQVksQ0FBRStGLEtBQUssQ0FBQ1AsS0FBTSxDQUFDO01BQ25DO01BQ0EsSUFBS08sS0FBSyxJQUFJQSxLQUFLLENBQUNOLE9BQU8sSUFBSSxVQUFVLEtBQUssT0FBT00sS0FBSyxDQUFDTixPQUFPLENBQUN5QixLQUFLLEVBQUc7UUFDMUVuQixLQUFLLENBQUNOLE9BQU8sQ0FBQ3lCLEtBQUssQ0FBQyxDQUFDO01BQ3RCO01BQ0EsT0FBTzNJLGtDQUFrQyxDQUFFZCxNQUFNLENBQUVpQyxXQUFZLENBQUMsQ0FBRTtJQUNuRTs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTeUgsc0JBQXNCQSxDQUFFcEMsWUFBWSxFQUFHO01BQy9DLElBQUlDLE9BQU8sR0FBR0QsWUFBWSxJQUFJQSxZQUFZLENBQUNDLE9BQU8sR0FBR0QsWUFBWSxDQUFDQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO01BQzlFLElBQUlvQyxlQUFlLEdBQUdwQyxPQUFPLENBQUNuSSxNQUFNLElBQUksQ0FBQyxDQUFDO01BQzFDLElBQUl3SyxJQUFJLEdBQUdyQyxPQUFPLENBQUNxQyxJQUFJLElBQUksQ0FBQyxDQUFDO01BQzdCLElBQUlDLGNBQWMsR0FBR3RDLE9BQU8sQ0FBQ3NDLGNBQWMsSUFBSSxDQUFDLENBQUM7TUFDakQsSUFBSXhDLFlBQVksR0FBR2pFLHNCQUFzQixDQUFFbUUsT0FBTyxDQUFDbEUsU0FBVSxDQUFDO01BQzlELElBQUl5RyxVQUFVLEdBQUczSixNQUFNLENBQUVtSCxZQUFZLElBQUlBLFlBQVksQ0FBQ3lDLEdBQUcsSUFBSUYsY0FBYyxDQUFDQyxVQUFVLElBQUksRUFBRyxDQUFDO01BRTlGLElBQ0MsQ0FBRUEsVUFBVSxJQUNULENBQUV6QyxZQUFZLENBQUMyQyxNQUFNLElBQ3JCLENBQUVILGNBQWMsQ0FBQ0ksb0JBQW9CLElBQ3JDLENBQUVOLGVBQWUsQ0FBQ08sUUFBUSxJQUMxQixDQUFFUCxlQUFlLENBQUNRLE1BQU0sSUFDeEIsQ0FBRVIsZUFBZSxDQUFDUyxJQUFJLElBQ3RCLENBQUVULGVBQWUsQ0FBQ1UsUUFBUSxFQUM1QjtRQUNELE9BQU8sSUFBSTtNQUNaO01BRUEsT0FBTztRQUNOUCxVQUFVLEVBQUVBLFVBQVU7UUFDdEJHLG9CQUFvQixFQUFFOUosTUFBTSxDQUFFMEosY0FBYyxDQUFDSSxvQkFBcUIsQ0FBQztRQUNuRTVDLFlBQVksRUFBRUEsWUFBWTtRQUMxQjZDLFFBQVEsRUFBRS9KLE1BQU0sQ0FBRXdKLGVBQWUsQ0FBQ08sUUFBUyxDQUFDO1FBQzVDQyxNQUFNLEVBQUVoSyxNQUFNLENBQUV3SixlQUFlLENBQUNRLE1BQU8sQ0FBQztRQUN4Q0MsSUFBSSxFQUFFakssTUFBTSxDQUFFd0osZUFBZSxDQUFDUyxJQUFLLENBQUM7UUFDcENFLFlBQVksRUFBRXRLLE1BQU0sQ0FBRTJKLGVBQWUsQ0FBQ1csWUFBWSxJQUFJVixJQUFJLENBQUNVLFlBQVksSUFBSSxDQUFFLENBQUM7UUFDOUVELFFBQVEsRUFBRWxLLE1BQU0sQ0FBRXdKLGVBQWUsQ0FBQ1UsUUFBUztNQUM1QyxDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0UsOEJBQThCQSxDQUFFQyxRQUFRLEVBQUc7TUFDbkQsT0FBTyxDQUNOQSxRQUFRLENBQUNWLFVBQVUsRUFDbkJVLFFBQVEsQ0FBQ1Asb0JBQW9CLEVBQzdCTyxRQUFRLENBQUNuRCxZQUFZLENBQUNvRCxJQUFJLENBQUUsR0FBSSxDQUFDLEVBQ2pDRCxRQUFRLENBQUNOLFFBQVEsRUFDakJNLFFBQVEsQ0FBQ0wsTUFBTSxFQUNmSyxRQUFRLENBQUNKLElBQUksRUFDYkksUUFBUSxDQUFDRixZQUFZLEVBQ3JCRSxRQUFRLENBQUNILFFBQVEsQ0FDakIsQ0FBQ0ksSUFBSSxDQUFFLEdBQUksQ0FBQztJQUNkOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyx1QkFBdUJBLENBQUEsRUFBRztNQUNsQzNKLHVCQUF1QixHQUFHUixNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDL0NRLGdCQUFnQixHQUFHVCxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDeENTLG1CQUFtQixHQUFHVixNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7SUFDNUM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU21LLDJCQUEyQkEsQ0FBRUMsT0FBTyxFQUFHO01BQy9DLElBQUlDLGVBQWUsR0FBR3RLLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztNQUUzQyxDQUFFK0MsS0FBSyxDQUFDQyxPQUFPLENBQUVvSCxPQUFRLENBQUMsR0FBR0EsT0FBTyxHQUFHLEVBQUUsRUFBR3pJLE9BQU8sQ0FBRSxVQUFXMkksS0FBSyxFQUFHO1FBQ3ZFLElBQUloQixVQUFVLEdBQUczSixNQUFNLENBQUUySyxLQUFLLEtBQU1BLEtBQUssQ0FBQ2YsR0FBRyxJQUFJZSxLQUFLLENBQUNoQixVQUFVLENBQUUsSUFBSSxFQUFHLENBQUM7UUFFM0UsSUFBS0EsVUFBVSxFQUFHO1VBQ2pCZSxlQUFlLENBQUVmLFVBQVUsQ0FBRSxHQUFHZ0IsS0FBSztRQUN0QztNQUNELENBQUUsQ0FBQztNQUVILE9BQU9ELGVBQWU7SUFDdkI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0Usd0JBQXdCQSxDQUFFakIsVUFBVSxFQUFHO01BQy9DLElBQUlrQixnQkFBZ0IsR0FBRzdLLE1BQU0sQ0FBRTJKLFVBQVUsSUFBSSxFQUFHLENBQUMsR0FBRyxHQUFHO01BRXZEdkosTUFBTSxDQUFDMEssSUFBSSxDQUFFbEssdUJBQXdCLENBQUMsQ0FBQ29CLE9BQU8sQ0FBRSxVQUFXK0ksU0FBUyxFQUFHO1FBQ3RFLElBQUssQ0FBQyxLQUFLQSxTQUFTLENBQUNDLE9BQU8sQ0FBRUgsZ0JBQWlCLENBQUMsRUFBRztVQUNsRCxPQUFPakssdUJBQXVCLENBQUVtSyxTQUFTLENBQUU7UUFDNUM7TUFDRCxDQUFFLENBQUM7TUFDSCxPQUFPbEssZ0JBQWdCLENBQUViLE1BQU0sQ0FBRTJKLFVBQVUsSUFBSSxFQUFHLENBQUMsQ0FBRTtJQUN0RDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3NCLCtCQUErQkEsQ0FBQSxFQUFHO01BQzFDbkssbUJBQW1CLEdBQUdWLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztJQUM1Qzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVM2SyxtQ0FBbUNBLENBQUVDLGVBQWUsRUFBRztNQUMvRCxJQUFJQyxhQUFhLEdBQUdoTCxNQUFNLENBQUMwSyxJQUFJLENBQUVLLGVBQWdCLENBQUM7TUFDbEQsSUFBSUUsdUJBQXVCLEdBQUdELGFBQWEsQ0FBQ3ZCLE1BQU0sR0FBR3NCLGVBQWUsQ0FBRUMsYUFBYSxDQUFFLENBQUMsQ0FBRSxDQUFFLENBQUNsRSxZQUFZLEdBQUcsRUFBRTtNQUM1RyxJQUFJb0Usb0JBQW9CLEdBQUcsRUFBRTtNQUU3QmxMLE1BQU0sQ0FBQzBLLElBQUksQ0FBRXhLLGlCQUFrQixDQUFDLENBQUMwQixPQUFPLENBQUUsVUFBV0YsV0FBVyxFQUFHO1FBQ2xFQSxXQUFXLEdBQUdqQyxNQUFNLENBQUVpQyxXQUFZLENBQUM7UUFDbkMsSUFBSyxDQUFDLENBQUMsS0FBS3VKLHVCQUF1QixDQUFDTCxPQUFPLENBQUVsSixXQUFZLENBQUMsRUFBRztVQUM1RDtRQUNEO1FBQ0EsT0FBT3hCLGlCQUFpQixDQUFFd0IsV0FBVyxDQUFFO1FBQ3ZDeUosMkJBQTJCLENBQUV6SixXQUFZLENBQUM7UUFDMUN3SixvQkFBb0IsQ0FBQ0UsSUFBSSxDQUFFMUosV0FBWSxDQUFDO01BQ3pDLENBQUUsQ0FBQztNQUVILE9BQU93SixvQkFBb0I7SUFDNUI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0csc0JBQXNCQSxDQUFFaEosTUFBTSxFQUFHO01BQ3pDLElBQUlpSixPQUFPLEdBQUdqSixNQUFNLElBQUlXLEtBQUssQ0FBQ0MsT0FBTyxDQUFFWixNQUFNLENBQUNpSixPQUFRLENBQUMsR0FBR2pKLE1BQU0sQ0FBQ2lKLE9BQU8sR0FBRyxFQUFFO01BQzdFLElBQUlDLFVBQVUsR0FBRzlMLE1BQU0sQ0FBRTRDLE1BQU0sSUFBSUEsTUFBTSxDQUFDa0osVUFBVyxDQUFDO01BQ3RELElBQUlSLGVBQWUsR0FBRy9LLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztNQUMzQyxJQUFJdUwsdUJBQXVCLEdBQUdwQiwyQkFBMkIsQ0FBRXZLLHdCQUF5QixDQUFDO01BQ3JGLElBQUk0TCxtQkFBbUI7TUFDdkIsSUFBSUMsVUFBVSxHQUFHLEVBQUU7TUFDbkIsSUFBSUMsY0FBYztNQUNsQixJQUFJQyxtQkFBbUIsR0FBRyxFQUFFO01BQzVCLElBQUlDLG1CQUFtQixHQUFHLEVBQUU7TUFDNUIsSUFBSUMsNkJBQTZCO01BQ2pDLElBQUlaLG9CQUFvQjtNQUN4QixJQUFJYSxvQkFBb0IsR0FBRyxLQUFLO01BQ2hDLElBQUlDLEtBQUssR0FBRyxDQUFDLEtBQUt2TSxNQUFNLENBQUU0QyxNQUFNLElBQUlBLE1BQU0sQ0FBQ0MsY0FBZSxDQUFDLElBQ3ZEN0MsTUFBTSxDQUFDZ0QsU0FBUyxDQUFFOEksVUFBVyxDQUFDLElBQzlCQSxVQUFVLEdBQUc1SyxrQkFBa0IsSUFDL0IsQ0FBQyxHQUFHMkssT0FBTyxDQUFDN0IsTUFBTSxJQUNsQjZCLE9BQU8sQ0FBQzdCLE1BQU0sSUFBSXBLLHNCQUFzQjtNQUU1Q2lNLE9BQU8sQ0FBQzFKLE9BQU8sQ0FBRSxVQUFXbUYsWUFBWSxFQUFHO1FBQzFDLElBQUlrRCxRQUFRLEdBQUdkLHNCQUFzQixDQUFFcEMsWUFBYSxDQUFDO1FBRXJELElBQ0MsQ0FBRWtELFFBQVEsSUFDUEEsUUFBUSxDQUFDUCxvQkFBb0IsS0FBSzlKLE1BQU0sQ0FBRXlDLE1BQU0sQ0FBQ3FILG9CQUFvQixJQUFJLEVBQUcsQ0FBQyxJQUM3RU8sUUFBUSxDQUFDSCxRQUFRLEtBQUtsSyxNQUFNLENBQUV5QyxNQUFNLENBQUN5SCxRQUFRLElBQUksRUFBRyxDQUFDLElBQ3JEaUIsZUFBZSxDQUFFZCxRQUFRLENBQUNWLFVBQVUsQ0FBRSxFQUN4QztVQUNEeUMsS0FBSyxHQUFHLEtBQUs7VUFDYjtRQUNEO1FBQ0FqQixlQUFlLENBQUVkLFFBQVEsQ0FBQ1YsVUFBVSxDQUFFLEdBQUdVLFFBQVE7UUFDakR5QixVQUFVLENBQUNOLElBQUksQ0FBRXBCLDhCQUE4QixDQUFFQyxRQUFTLENBQUUsQ0FBQztRQUM3RCxJQUFLQSxRQUFRLENBQUNWLFVBQVUsS0FBSzNKLE1BQU0sQ0FBRXlDLE1BQU0sQ0FBQzRKLGtCQUFrQixJQUFJLEVBQUcsQ0FBQyxFQUFHO1VBQ3hFRixvQkFBb0IsR0FBRyxJQUFJO1FBQzVCO01BQ0QsQ0FBRSxDQUFDO01BQ0gsSUFBSyxDQUFFQyxLQUFLLElBQUksQ0FBRUQsb0JBQW9CLEVBQUc7UUFDeEMsT0FBTyxLQUFLO01BQ2I7TUFFQUwsVUFBVSxDQUFDcEksSUFBSSxDQUFDLENBQUM7TUFDakJxSSxjQUFjLEdBQUdELFVBQVUsQ0FBQ3hCLElBQUksQ0FBRSxJQUFLLENBQUM7TUFDeEN1QixtQkFBbUIsR0FBR3JCLDJCQUEyQixDQUFFa0IsT0FBUSxDQUFDO01BQzVEdEwsTUFBTSxDQUFDMEssSUFBSSxDQUFFZSxtQkFBb0IsQ0FBQyxDQUFDN0osT0FBTyxDQUFFLFVBQVcySCxVQUFVLEVBQUc7UUFDbkUsSUFDQyxDQUFFaUMsdUJBQXVCLENBQUVqQyxVQUFVLENBQUUsSUFDcENpQyx1QkFBdUIsQ0FBRWpDLFVBQVUsQ0FBRSxDQUFDdkMsT0FBTyxLQUFLeUUsbUJBQW1CLENBQUVsQyxVQUFVLENBQUUsQ0FBQ3ZDLE9BQU8sSUFDM0YsQ0FBRWpILHlCQUF5QixDQUFFd0osVUFBVSxDQUFFLElBQ3pDUyw4QkFBOEIsQ0FBRWpLLHlCQUF5QixDQUFFd0osVUFBVSxDQUFHLENBQUMsS0FBS1MsOEJBQThCLENBQUVlLGVBQWUsQ0FBRXhCLFVBQVUsQ0FBRyxDQUFDLEVBQy9JO1VBQ0RxQyxtQkFBbUIsQ0FBQ1IsSUFBSSxDQUFFN0IsVUFBVyxDQUFDO1FBQ3ZDO01BQ0QsQ0FBRSxDQUFDO01BQ0h2SixNQUFNLENBQUMwSyxJQUFJLENBQUVjLHVCQUF3QixDQUFDLENBQUM1SixPQUFPLENBQUUsVUFBVzJILFVBQVUsRUFBRztRQUN2RSxJQUFLLENBQUVrQyxtQkFBbUIsQ0FBRWxDLFVBQVUsQ0FBRSxFQUFHO1VBQzFDc0MsbUJBQW1CLENBQUNULElBQUksQ0FBRTdCLFVBQVcsQ0FBQztRQUN2QztNQUNELENBQUUsQ0FBQztNQUNIcUMsbUJBQW1CLENBQUMzRSxNQUFNLENBQUU0RSxtQkFBb0IsQ0FBQyxDQUFDakssT0FBTyxDQUFFNEksd0JBQXlCLENBQUM7TUFDckYsSUFBS29CLG1CQUFtQixDQUFDbkMsTUFBTSxJQUFJb0MsbUJBQW1CLENBQUNwQyxNQUFNLElBQUl6SSwwQkFBMEIsS0FBSzJLLGNBQWMsRUFBRztRQUNoSDlLLDJCQUEyQixJQUFJLENBQUM7UUFDaENnSywrQkFBK0IsQ0FBQyxDQUFDO01BQ2xDO01BQ0FpQiw2QkFBNkIsR0FBR2hNLDZCQUE2QixDQUFDdUQsTUFBTSxDQUFFLFVBQVc2SSxrQkFBa0IsRUFBRztRQUNyRyxJQUFJM0MsVUFBVSxHQUFHM0osTUFBTSxDQUFFc00sa0JBQWtCLElBQUlBLGtCQUFrQixDQUFDM0MsVUFBVSxJQUFJLEVBQUcsQ0FBQztRQUNwRixJQUFJNEMsaUJBQWlCLEdBQUdwTSx5QkFBeUIsQ0FBRXdKLFVBQVUsQ0FBRTtRQUMvRCxJQUFJNkMsYUFBYSxHQUFHckIsZUFBZSxDQUFFeEIsVUFBVSxDQUFFO1FBRWpELE9BQU8xRSxPQUFPLENBQ2I0RyxtQkFBbUIsQ0FBRWxDLFVBQVUsQ0FBRSxJQUM5QjRDLGlCQUFpQixJQUNqQkMsYUFBYSxJQUNicEMsOEJBQThCLENBQUVtQyxpQkFBa0IsQ0FBQyxLQUFLbkMsOEJBQThCLENBQUVvQyxhQUFjLENBQzFHLENBQUM7TUFDRixDQUFFLENBQUM7TUFDSCxJQUFLTiw2QkFBNkIsQ0FBQ3JDLE1BQU0sS0FBSzNKLDZCQUE2QixDQUFDMkosTUFBTSxFQUFHO1FBQ3BGM0osNkJBQTZCLEdBQUdnTSw2QkFBNkI7UUFDN0Q3SywrQkFBK0IsR0FBRzZLLDZCQUE2QixDQUFDNUksR0FBRyxDQUFFLFVBQVdnSixrQkFBa0IsRUFBRztVQUNwRyxPQUFPdE0sTUFBTSxDQUFFc00sa0JBQWtCLENBQUN2QixTQUFTLElBQUksRUFBRyxDQUFDO1FBQ3BELENBQUUsQ0FBQyxDQUFDckgsSUFBSSxDQUFDLENBQUMsQ0FBQzRHLElBQUksQ0FBRSxJQUFLLENBQUM7UUFDdkJwSixnQ0FBZ0MsSUFBSSxDQUFDO1FBQ3JDQyxrQkFBa0IsR0FBRyxTQUFTO01BQy9CO01BQ0FsQix3QkFBd0IsR0FBR3lMLE9BQU87TUFDbEN2TCx5QkFBeUIsR0FBR2dMLGVBQWU7TUFDM0MvSiwwQkFBMEIsR0FBRzJLLGNBQWM7TUFDM0NoTCxrQkFBa0IsR0FBRzRLLFVBQVU7TUFDL0JMLG9CQUFvQixHQUFHSixtQ0FBbUMsQ0FBRUMsZUFBZ0IsQ0FBQztNQUM3RTNKLHVCQUF1QixHQUFHO1FBQ3pCd0ssbUJBQW1CLEVBQUVBLG1CQUFtQixDQUFDUyxLQUFLLENBQUMsQ0FBQztRQUNoRFIsbUJBQW1CLEVBQUVBLG1CQUFtQixDQUFDUSxLQUFLLENBQUMsQ0FBQztRQUNoRG5CLG9CQUFvQixFQUFFQSxvQkFBb0I7UUFDMUNvQixxQkFBcUIsRUFBRXpILE9BQU8sQ0FBRStHLG1CQUFtQixDQUFDbkMsTUFBTSxJQUFJb0MsbUJBQW1CLENBQUNwQyxNQUFPO01BQzFGLENBQUM7TUFDRDVDLHlDQUF5QyxDQUFDLENBQUM7TUFFM0MsT0FBTyxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzBGLGtDQUFrQ0EsQ0FBRUwsa0JBQWtCLEVBQUc7TUFDakUsSUFBSWpDLFFBQVEsR0FBR2xLLHlCQUF5QixDQUFFSCxNQUFNLENBQUVzTSxrQkFBa0IsSUFBSUEsa0JBQWtCLENBQUMzQyxVQUFVLElBQUksRUFBRyxDQUFDLENBQUU7TUFDL0csSUFBSXZDLE9BQU8sR0FBR2tGLGtCQUFrQixJQUFJQSxrQkFBa0IsQ0FBQ2xGLE9BQU8sR0FBR2tGLGtCQUFrQixDQUFDbEYsT0FBTyxHQUFHLENBQUMsQ0FBQztNQUNoRyxJQUFJd0YsZUFBZSxHQUFHeEYsT0FBTyxDQUFDbkksTUFBTSxJQUFJLENBQUMsQ0FBQztNQUMxQyxJQUFJaUksWUFBWSxHQUFHakUsc0JBQXNCLENBQUVtRSxPQUFPLENBQUNGLFlBQWEsQ0FBQztNQUVqRSxPQUFPakMsT0FBTyxDQUNib0YsUUFBUSxJQUNMQSxRQUFRLENBQUNuRCxZQUFZLENBQUNvRCxJQUFJLENBQUUsR0FBSSxDQUFDLEtBQUtwRCxZQUFZLENBQUNvRCxJQUFJLENBQUUsR0FBSSxDQUFDLElBQzlERCxRQUFRLENBQUNOLFFBQVEsS0FBSy9KLE1BQU0sQ0FBRTRNLGVBQWUsQ0FBQzdDLFFBQVEsSUFBSSxFQUFHLENBQUMsSUFDOURNLFFBQVEsQ0FBQ0wsTUFBTSxLQUFLaEssTUFBTSxDQUFFNE0sZUFBZSxDQUFDNUMsTUFBTSxJQUFJLEVBQUcsQ0FBQyxJQUMxREssUUFBUSxDQUFDSixJQUFJLEtBQUtqSyxNQUFNLENBQUU0TSxlQUFlLENBQUMzQyxJQUFJLElBQUksRUFBRyxDQUFDLElBQ3RESSxRQUFRLENBQUNGLFlBQVksS0FBS3RLLE1BQU0sQ0FBRStNLGVBQWUsQ0FBQ3pDLFlBQVksSUFBSSxDQUFFLENBQUMsSUFDckVFLFFBQVEsQ0FBQ0gsUUFBUSxLQUFLbEssTUFBTSxDQUFFNE0sZUFBZSxDQUFDMUMsUUFBUSxJQUFJLEVBQUcsQ0FDakUsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMyQyxtQkFBbUJBLENBQUVwSyxNQUFNLEVBQUc7TUFDdEMsSUFBSWtKLFVBQVUsR0FBRzlMLE1BQU0sQ0FBRTRDLE1BQU0sSUFBSUEsTUFBTSxDQUFDa0osVUFBVyxDQUFDO01BQ3RELElBQUltQixjQUFjLEdBQUdySyxNQUFNLElBQUlXLEtBQUssQ0FBQ0MsT0FBTyxDQUFFWixNQUFNLENBQUNxSyxjQUFlLENBQUMsR0FBR3JLLE1BQU0sQ0FBQ3FLLGNBQWMsR0FBRyxFQUFFO01BQ2xHLElBQUlsQix1QkFBdUIsR0FBR3BCLDJCQUEyQixDQUFFdEssNkJBQThCLENBQUM7TUFDMUYsSUFBSTJMLG1CQUFtQjtNQUN2QixJQUFJa0IsZ0JBQWdCLEdBQUcsRUFBRTtNQUN6QixJQUFJakIsVUFBVSxHQUFHLEVBQUU7TUFDbkIsSUFBSUUsbUJBQW1CLEdBQUcsRUFBRTtNQUM1QixJQUFJZ0IsdUJBQXVCO01BQzNCLElBQUlqQixjQUFjO01BQ2xCLElBQUlXLHFCQUFxQjtNQUN6QixJQUFJTyxxQkFBcUIsR0FBRzdNLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztNQUNqRCxJQUFJNk0sZ0JBQWdCLEdBQUcsSUFBSTtNQUUzQixJQUNDLENBQUMsS0FBS3JOLE1BQU0sQ0FBRTRDLE1BQU0sSUFBSUEsTUFBTSxDQUFDQyxjQUFlLENBQUMsSUFDNUMsQ0FBRTdDLE1BQU0sQ0FBQ2dELFNBQVMsQ0FBRThJLFVBQVcsQ0FBQyxJQUNoQ0EsVUFBVSxJQUFJM0ssdUJBQXVCLElBQ3JDOEwsY0FBYyxDQUFDakQsTUFBTSxHQUFHcEssc0JBQXNCLEVBQ2hEO1FBQ0QsT0FBTyxLQUFLO01BQ2I7TUFDQSxJQUFLLFFBQVEsS0FBS2dELE1BQU0sQ0FBQzBGLEtBQUssSUFBSTFGLE1BQU0sQ0FBQzJFLE9BQU8sRUFBRztRQUNsRCxJQUFLLENBQUV1RixrQ0FBa0MsQ0FBRTtVQUMxQ2hELFVBQVUsRUFBRWxILE1BQU0sQ0FBQ2tILFVBQVU7VUFDN0J2QyxPQUFPLEVBQUUzRSxNQUFNLENBQUMyRTtRQUNqQixDQUFFLENBQUMsRUFBRztVQUNMLE9BQU8sS0FBSztRQUNiO01BQ0Q7TUFFQTBGLGNBQWMsQ0FBQzlLLE9BQU8sQ0FBRSxVQUFXc0ssa0JBQWtCLEVBQUc7UUFDdkQsSUFBSyxDQUFFSyxrQ0FBa0MsQ0FBRUwsa0JBQW1CLENBQUMsRUFBRztVQUNqRVksZ0JBQWdCLEdBQUcsS0FBSztVQUN4QjtRQUNEO1FBQ0FILGdCQUFnQixDQUFDdkIsSUFBSSxDQUFFYyxrQkFBbUIsQ0FBQztRQUMzQ1IsVUFBVSxDQUFDTixJQUFJLENBQUV4TCxNQUFNLENBQUVzTSxrQkFBa0IsQ0FBQ3ZCLFNBQVMsSUFBSSxFQUFHLENBQUUsQ0FBQztNQUNoRSxDQUFFLENBQUM7TUFDSCxJQUFLLENBQUVtQyxnQkFBZ0IsRUFBRztRQUN6QixPQUFPLEtBQUs7TUFDYjtNQUNBcEIsVUFBVSxDQUFDcEksSUFBSSxDQUFDLENBQUM7TUFDakJxSSxjQUFjLEdBQUdELFVBQVUsQ0FBQ3hCLElBQUksQ0FBRSxJQUFLLENBQUM7TUFDeEN1QixtQkFBbUIsR0FBR3JCLDJCQUEyQixDQUFFdUMsZ0JBQWlCLENBQUM7TUFDckUzTSxNQUFNLENBQUMwSyxJQUFJLENBQUVjLHVCQUF3QixDQUFDLENBQUN2RSxNQUFNLENBQUVqSCxNQUFNLENBQUMwSyxJQUFJLENBQUVlLG1CQUFvQixDQUFFLENBQUMsQ0FBQ3BJLE1BQU0sQ0FBRSxVQUFXa0csVUFBVSxFQUFFd0QsWUFBWSxFQUFFQyxRQUFRLEVBQUc7UUFDM0ksT0FBT0EsUUFBUSxDQUFDcEMsT0FBTyxDQUFFckIsVUFBVyxDQUFDLEtBQUt3RCxZQUFZO01BQ3ZELENBQUUsQ0FBQyxDQUFDbkwsT0FBTyxDQUFFLFVBQVcySCxVQUFVLEVBQUc7UUFDcEMsSUFBSTBELGNBQWMsR0FBR3pCLHVCQUF1QixDQUFFakMsVUFBVSxDQUFFO1FBQzFELElBQUkyRCxVQUFVLEdBQUd6QixtQkFBbUIsQ0FBRWxDLFVBQVUsQ0FBRTtRQUVsRCxJQUNDLENBQUUwRCxjQUFjLElBQ2IsQ0FBRUMsVUFBVSxJQUNadE4sTUFBTSxDQUFFcU4sY0FBYyxDQUFDdEMsU0FBUyxJQUFJLEVBQUcsQ0FBQyxLQUFLL0ssTUFBTSxDQUFFc04sVUFBVSxDQUFDdkMsU0FBUyxJQUFJLEVBQUcsQ0FBQyxJQUNqRnNDLGNBQWMsQ0FBQ2pHLE9BQU8sS0FBS2tHLFVBQVUsQ0FBQ2xHLE9BQU8sRUFDL0M7VUFDRDRFLG1CQUFtQixDQUFDUixJQUFJLENBQUU3QixVQUFXLENBQUM7VUFDdEMxRyxzQkFBc0IsQ0FBRW9LLGNBQWMsSUFBSUEsY0FBYyxDQUFDakcsT0FBTyxJQUFJaUcsY0FBYyxDQUFDakcsT0FBTyxDQUFDRixZQUFhLENBQUMsQ0FBQ0csTUFBTSxDQUMvR3BFLHNCQUFzQixDQUFFcUssVUFBVSxJQUFJQSxVQUFVLENBQUNsRyxPQUFPLElBQUlrRyxVQUFVLENBQUNsRyxPQUFPLENBQUNGLFlBQWEsQ0FDN0YsQ0FBQyxDQUFDbEYsT0FBTyxDQUFFLFVBQVdGLFdBQVcsRUFBRztZQUNuQ21MLHFCQUFxQixDQUFFbkwsV0FBVyxDQUFFLEdBQUcsSUFBSTtVQUM1QyxDQUFFLENBQUM7UUFDSjtNQUNELENBQUUsQ0FBQztNQUNIa0wsdUJBQXVCLEdBQUcsYUFBYSxLQUFLaE4sTUFBTSxDQUFFeUMsTUFBTSxDQUFDMEYsS0FBSyxJQUFJLEVBQUcsQ0FBQyxHQUNyRSxTQUFTLEdBQ1AsU0FBUyxLQUFLbkksTUFBTSxDQUFFeUMsTUFBTSxDQUFDMEYsS0FBSyxJQUFJLEVBQUcsQ0FBQyxHQUFHLFFBQVEsR0FBRyxRQUFVO01BQ3ZFLElBQUssUUFBUSxLQUFLNkUsdUJBQXVCLEVBQUc7UUFDM0MsSUFBS0QsZ0JBQWdCLENBQUNRLElBQUksQ0FBRSxVQUFXakIsa0JBQWtCLEVBQUc7VUFDM0QsT0FBTyxTQUFTLEtBQUt0TSxNQUFNLENBQUVzTSxrQkFBa0IsSUFBSUEsa0JBQWtCLENBQUNsRixPQUFPLElBQUlrRixrQkFBa0IsQ0FBQ2xGLE9BQU8sQ0FBQ29HLFVBQVUsSUFBSSxFQUFHLENBQUM7UUFDL0gsQ0FBRSxDQUFDLEVBQUc7VUFDTFIsdUJBQXVCLEdBQUcsU0FBUztRQUNwQyxDQUFDLE1BQU0sSUFBS0QsZ0JBQWdCLENBQUNsRCxNQUFNLEdBQUc1Six3QkFBd0IsQ0FBQzRKLE1BQU0sRUFBRztVQUN2RW1ELHVCQUF1QixHQUFHLFNBQVM7UUFDcEM7TUFDRDtNQUNBaEIsbUJBQW1CLENBQUNoSyxPQUFPLENBQUU0SSx3QkFBeUIsQ0FBQztNQUN2RDhCLHFCQUFxQixHQUFHekgsT0FBTyxDQUM5QitHLG1CQUFtQixDQUFDbkMsTUFBTSxJQUN2QnhJLCtCQUErQixLQUFLMEssY0FBYyxJQUNsRDVLLGtCQUFrQixLQUFLNkwsdUJBQzNCLENBQUM7TUFDRCxJQUFLN0wsa0JBQWtCLEtBQUs2TCx1QkFBdUIsRUFBRztRQUNyRDVNLE1BQU0sQ0FBQzBLLElBQUksQ0FBRTNLLHlCQUEwQixDQUFDLENBQUM2QixPQUFPLENBQUUsVUFBVzJILFVBQVUsRUFBRztVQUN6RXhKLHlCQUF5QixDQUFFd0osVUFBVSxDQUFFLENBQUN6QyxZQUFZLENBQUNsRixPQUFPLENBQUUsVUFBV0YsV0FBVyxFQUFHO1lBQ3RGbUwscUJBQXFCLENBQUVuTCxXQUFXLENBQUUsR0FBRyxJQUFJO1VBQzVDLENBQUUsQ0FBQztRQUNKLENBQUUsQ0FBQztNQUNKO01BQ0EsSUFBSzRLLHFCQUFxQixFQUFHO1FBQzVCeEwsZ0NBQWdDLElBQUksQ0FBQztRQUNyQytKLCtCQUErQixDQUFDLENBQUM7TUFDbEM7TUFDQS9LLDZCQUE2QixHQUFHNk0sZ0JBQWdCO01BQ2hEMUwsK0JBQStCLEdBQUcwSyxjQUFjO01BQ2hEL0ssdUJBQXVCLEdBQUcySyxVQUFVO01BQ3BDeEssa0JBQWtCLEdBQUc2TCx1QkFBdUI7TUFDNUN2TCw0QkFBNEIsR0FBRztRQUM5QnVLLG1CQUFtQixFQUFFQSxtQkFBbUIsQ0FBQ1MsS0FBSyxDQUFDLENBQUM7UUFDaERRLHFCQUFxQixFQUFFN00sTUFBTSxDQUFDMEssSUFBSSxDQUFFbUMscUJBQXNCLENBQUMsQ0FBQzNKLEdBQUcsQ0FBRXpELE1BQU8sQ0FBQztRQUN6RTZNLHFCQUFxQixFQUFFQTtNQUN4QixDQUFDO01BRUQsT0FBTyxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2Usd0JBQXdCQSxDQUFFOUQsVUFBVSxFQUFHO01BQy9DLE9BQU8xSix3QkFBd0IsQ0FBQ3dELE1BQU0sQ0FBRSxVQUFXMEQsWUFBWSxFQUFHO1FBQ2pFLE9BQU9uSCxNQUFNLENBQUVtSCxZQUFZLElBQUlBLFlBQVksQ0FBQ3lDLEdBQUcsSUFBSSxFQUFHLENBQUMsS0FBSzVKLE1BQU0sQ0FBRTJKLFVBQVUsSUFBSSxFQUFHLENBQUM7TUFDdkYsQ0FBRSxDQUFDLENBQUUsQ0FBQyxDQUFFLElBQUksSUFBSTtJQUNqQjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTK0QsNkJBQTZCQSxDQUFFL0QsVUFBVSxFQUFHO01BQ3BELE9BQU96Siw2QkFBNkIsQ0FBQ3VELE1BQU0sQ0FBRSxVQUFXNkksa0JBQWtCLEVBQUc7UUFDNUUsT0FBT3RNLE1BQU0sQ0FBRXNNLGtCQUFrQixJQUFJQSxrQkFBa0IsQ0FBQzNDLFVBQVUsSUFBSSxFQUFHLENBQUMsS0FBSzNKLE1BQU0sQ0FBRTJKLFVBQVUsSUFBSSxFQUFHLENBQUM7TUFDMUcsQ0FBRSxDQUFDLENBQUUsQ0FBQyxDQUFFLElBQUksSUFBSTtJQUNqQjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2dFLHlCQUF5QkEsQ0FBRTdMLFdBQVcsRUFBRTZILFVBQVUsRUFBRztNQUM3RCxJQUFJb0IsU0FBUztNQUNiLElBQUk1RCxZQUFZO01BQ2hCLElBQUltRixrQkFBa0I7TUFDdEIsSUFBSXNCLG9CQUFvQjtNQUN4QixJQUFJeEcsT0FBTztNQUNYLElBQUk3RCxRQUFRO01BRVp6QixXQUFXLEdBQUdqQyxNQUFNLENBQUVpQyxXQUFZLENBQUM7TUFDbkM2SCxVQUFVLEdBQUczSixNQUFNLENBQUUySixVQUFVLElBQUksRUFBRyxDQUFDO01BQ3ZDLElBQUssQ0FBRXJKLGlCQUFpQixDQUFFd0IsV0FBVyxDQUFFLElBQUksQ0FBRTNCLHlCQUF5QixDQUFFd0osVUFBVSxDQUFFLEVBQUc7UUFDdEYsT0FBTyxJQUFJO01BQ1o7TUFDQW9CLFNBQVMsR0FBR3BCLFVBQVUsR0FBRyxHQUFHLEdBQUc3SCxXQUFXO01BQzFDLElBQUtsQix1QkFBdUIsQ0FBRW1LLFNBQVMsQ0FBRSxFQUFHO1FBQzNDLE9BQU9uSyx1QkFBdUIsQ0FBRW1LLFNBQVMsQ0FBRTtNQUM1QztNQUNBNUQsWUFBWSxHQUFHc0csd0JBQXdCLENBQUU5RCxVQUFXLENBQUM7TUFDckR2QyxPQUFPLEdBQUdELFlBQVksR0FBR0EsWUFBWSxDQUFDQyxPQUFPLEdBQUcsSUFBSTtNQUNwRDdELFFBQVEsR0FBRzZELE9BQU8sSUFBSWhFLEtBQUssQ0FBQ0MsT0FBTyxDQUFFK0QsT0FBTyxDQUFDbEUsU0FBVSxDQUFDLEdBQUdrRSxPQUFPLENBQUNsRSxTQUFTLENBQUNPLE1BQU0sQ0FBRSxVQUFXb0ssWUFBWSxFQUFHO1FBQzlHLE9BQU9oTyxNQUFNLENBQUVnTyxZQUFZLElBQUlBLFlBQVksQ0FBQ3JLLEVBQUcsQ0FBQyxLQUFLMUIsV0FBVztNQUNqRSxDQUFFLENBQUMsQ0FBRSxDQUFDLENBQUUsR0FBRyxJQUFJO01BQ2YsSUFBSyxDQUFFc0YsT0FBTyxJQUFJLENBQUU3RCxRQUFRLEVBQUc7UUFDOUIsT0FBTyxJQUFJO01BQ1o7TUFDQStJLGtCQUFrQixHQUFHb0IsNkJBQTZCLENBQUUvRCxVQUFXLENBQUM7TUFDaEVpRSxvQkFBb0IsR0FBR3RCLGtCQUFrQixJQUFJQSxrQkFBa0IsQ0FBQ2xGLE9BQU8sR0FBR2tGLGtCQUFrQixDQUFDbEYsT0FBTyxHQUFHLElBQUk7TUFDM0d4Ryx1QkFBdUIsQ0FBRW1LLFNBQVMsQ0FBRSxHQUFHO1FBQ3RDeEgsUUFBUSxFQUFFQSxRQUFRO1FBQ2xCdEUsTUFBTSxFQUFFbUksT0FBTyxDQUFDbkksTUFBTTtRQUN0QndLLElBQUksRUFBRXJDLE9BQU8sQ0FBQ3FDLElBQUk7UUFDbEJxRSxRQUFRLEVBQUUsQ0FBRTFHLE9BQU8sQ0FBQzBHLFFBQVEsSUFBSSxFQUFFLEVBQUdySyxNQUFNLENBQUUsVUFBV3NLLE9BQU8sRUFBRztVQUNqRSxPQUFPbE8sTUFBTSxDQUFFa08sT0FBTyxJQUFJQSxPQUFPLENBQUNqTSxXQUFZLENBQUMsS0FBS0EsV0FBVztRQUNoRSxDQUFFLENBQUM7UUFDSGtNLFNBQVMsRUFBRSxDQUFFNUcsT0FBTyxDQUFDNEcsU0FBUyxJQUFJLEVBQUUsRUFBR3ZLLE1BQU0sQ0FBRSxVQUFXd0ssUUFBUSxFQUFHO1VBQ3BFLE9BQU9wTyxNQUFNLENBQUVvTyxRQUFRLElBQUlBLFFBQVEsQ0FBQ25NLFdBQVksQ0FBQyxLQUFLQSxXQUFXO1FBQ2xFLENBQUUsQ0FBQztRQUNIb00sWUFBWSxFQUFFNUIsa0JBQWtCO1FBQ2hDc0Isb0JBQW9CLEVBQUVBLG9CQUFvQixHQUFHeE4sTUFBTSxDQUFDc0ksTUFBTSxDQUFFLENBQUMsQ0FBQyxFQUFFa0Ysb0JBQW9CLEVBQUU7VUFDckYxRyxZQUFZLEVBQUUsQ0FBRXBGLFdBQVcsQ0FBRTtVQUM3QnFNLFNBQVMsRUFBRSxDQUFFUCxvQkFBb0IsQ0FBQ08sU0FBUyxJQUFJLEVBQUUsRUFBRzFLLE1BQU0sQ0FBRSxVQUFXd0ssUUFBUSxFQUFHO1lBQ2pGLE9BQU9wTyxNQUFNLENBQUVvTyxRQUFRLElBQUlBLFFBQVEsQ0FBQ25NLFdBQVksQ0FBQyxLQUFLQSxXQUFXO1VBQ2xFLENBQUUsQ0FBQztVQUNIc00sUUFBUSxFQUFFLENBQUVSLG9CQUFvQixDQUFDUSxRQUFRLElBQUksRUFBRSxFQUFHM0ssTUFBTSxDQUFFLFVBQVcySyxRQUFRLEVBQUc7WUFDL0UsT0FBT3ZPLE1BQU0sQ0FBRXVPLFFBQVEsSUFBSUEsUUFBUSxDQUFDdE0sV0FBWSxDQUFDLEtBQUtBLFdBQVc7VUFDbEUsQ0FBRSxDQUFDO1VBQ0h1TSxPQUFPLEVBQUUsQ0FBRVQsb0JBQW9CLENBQUNTLE9BQU8sSUFBSSxFQUFFLEVBQUc1SyxNQUFNLENBQUUsVUFBVzRLLE9BQU8sRUFBRztZQUM1RSxPQUFPeE8sTUFBTSxDQUFFd08sT0FBTyxJQUFJQSxPQUFPLENBQUN2TSxXQUFZLENBQUMsS0FBS0EsV0FBVztVQUNoRSxDQUFFO1FBQ0gsQ0FBRSxDQUFDLEdBQUc7TUFDUCxDQUFDO01BRUQsT0FBT2xCLHVCQUF1QixDQUFFbUssU0FBUyxDQUFFO0lBQzVDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3VELHVDQUF1Q0EsQ0FBRXhNLFdBQVcsRUFBRztNQUMvRCxPQUFPN0Isd0JBQXdCLENBQUNxRCxHQUFHLENBQUUsVUFBVzZELFlBQVksRUFBRztRQUM5RCxJQUFJd0MsVUFBVSxHQUFHM0osTUFBTSxDQUFFbUgsWUFBWSxJQUFJQSxZQUFZLENBQUN5QyxHQUFHLElBQUksRUFBRyxDQUFDO1FBQ2pFLElBQUkyRSxjQUFjLEdBQUdaLHlCQUF5QixDQUFFN0wsV0FBVyxFQUFFNkgsVUFBVyxDQUFDO1FBRXpFLElBQUssQ0FBRTRFLGNBQWMsRUFBRztVQUN2QixPQUFPLElBQUk7UUFDWjtRQUNBLE9BQU87VUFDTjNFLEdBQUcsRUFBRUQsVUFBVTtVQUNmdkMsT0FBTyxFQUFFO1lBQ1JuSSxNQUFNLEVBQUVzUCxjQUFjLENBQUN0UCxNQUFNO1lBQzdCd0ssSUFBSSxFQUFFOEUsY0FBYyxDQUFDOUUsSUFBSTtZQUN6QnZHLFNBQVMsRUFBRSxDQUFFcUwsY0FBYyxDQUFDaEwsUUFBUSxDQUFFO1lBQ3RDdUssUUFBUSxFQUFFUyxjQUFjLENBQUNULFFBQVE7WUFDakNFLFNBQVMsRUFBRU8sY0FBYyxDQUFDUDtVQUMzQjtRQUNELENBQUM7TUFDRixDQUFFLENBQUMsQ0FBQ3ZLLE1BQU0sQ0FBRXdCLE9BQVEsQ0FBQztJQUN0Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTdUosNENBQTRDQSxDQUFFMU0sV0FBVyxFQUFHO01BQ3BFLE9BQU83Qix3QkFBd0IsQ0FBQ3FELEdBQUcsQ0FBRSxVQUFXbUwsb0JBQW9CLEVBQUc7UUFDdEUsSUFBSTlFLFVBQVUsR0FBRzNKLE1BQU0sQ0FBRXlPLG9CQUFvQixJQUFJQSxvQkFBb0IsQ0FBQzdFLEdBQUcsSUFBSSxFQUFHLENBQUM7UUFDakYsSUFBSTJFLGNBQWMsR0FBR1oseUJBQXlCLENBQUU3TCxXQUFXLEVBQUU2SCxVQUFXLENBQUM7UUFFekUsSUFBSyxDQUFFNEUsY0FBYyxJQUFJLENBQUVBLGNBQWMsQ0FBQ0wsWUFBWSxJQUFJLENBQUVLLGNBQWMsQ0FBQ1gsb0JBQW9CLEVBQUc7VUFDakcsT0FBTyxJQUFJO1FBQ1o7UUFDQSxPQUFPO1VBQ043QyxTQUFTLEVBQUUvSyxNQUFNLENBQUV1TyxjQUFjLENBQUNMLFlBQVksQ0FBQ25ELFNBQVMsSUFBSSxFQUFHLENBQUM7VUFDaEVwQixVQUFVLEVBQUVBLFVBQVU7VUFDdEJ2QyxPQUFPLEVBQUVtSCxjQUFjLENBQUNYO1FBQ3pCLENBQUM7TUFDRixDQUFFLENBQUMsQ0FBQ25LLE1BQU0sQ0FBRXdCLE9BQVEsQ0FBQztJQUN0Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3lKLGdCQUFnQkEsQ0FBRTVNLFdBQVcsRUFBRTZILFVBQVUsRUFBRWdGLFVBQVUsRUFBRztNQUNoRTdNLFdBQVcsR0FBR2pDLE1BQU0sQ0FBRWlDLFdBQVksQ0FBQztNQUNuQzZILFVBQVUsR0FBRzNKLE1BQU0sQ0FBRTJKLFVBQVUsSUFBSSxFQUFHLENBQUM7TUFDdkMsSUFBSyxDQUFFckosaUJBQWlCLENBQUV3QixXQUFXLENBQUUsSUFBSSxDQUFFM0IseUJBQXlCLENBQUV3SixVQUFVLENBQUUsRUFBRztRQUN0RixPQUFPLEtBQUs7TUFDYjtNQUNBLElBQUssQ0FBRTlJLGdCQUFnQixDQUFFOEksVUFBVSxDQUFFLEVBQUc7UUFDdkM5SSxnQkFBZ0IsQ0FBRThJLFVBQVUsQ0FBRSxHQUFHdkosTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO01BQ3ZEO01BQ0FRLGdCQUFnQixDQUFFOEksVUFBVSxDQUFFLENBQUU3SCxXQUFXLENBQUUsR0FBRzZNLFVBQVU7TUFDMUR2TyxNQUFNLENBQUMwSyxJQUFJLENBQUVqSyxnQkFBaUIsQ0FBQyxDQUFDbUIsT0FBTyxDQUFFLFVBQVc0TSxpQkFBaUIsRUFBRztRQUN2RSxJQUFLLENBQUV6Tyx5QkFBeUIsQ0FBRXlPLGlCQUFpQixDQUFFLEVBQUc7VUFDdkQsT0FBTy9OLGdCQUFnQixDQUFFK04saUJBQWlCLENBQUU7UUFDN0M7TUFDRCxDQUFFLENBQUM7TUFFSCxPQUFPeE8sTUFBTSxDQUFDMEssSUFBSSxDQUFFakssZ0JBQWlCLENBQUMsQ0FBQ2dKLE1BQU0sSUFBSXBLLHNCQUFzQjtJQUN4RTs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU29QLGdCQUFnQkEsQ0FBRS9NLFdBQVcsRUFBRXdDLFlBQVksRUFBRztNQUN0RCxJQUFJd0ssU0FBUyxHQUFHN1AsTUFBTSxDQUFDOFAsaUNBQWlDO01BQ3hELElBQUkxRSxRQUFRO01BQ1osSUFBSTJFLGVBQWU7TUFDbkIsSUFBSWpFLFNBQVM7TUFDYixJQUFJNEQsVUFBVTtNQUVkN00sV0FBVyxHQUFHakMsTUFBTSxDQUFFaUMsV0FBWSxDQUFDO01BQ25DLElBQ0MsQ0FBRXhCLGlCQUFpQixDQUFFd0IsV0FBVyxDQUFFLElBQy9CLENBQUVnTixTQUFTLElBQ1gsVUFBVSxLQUFLLE9BQU9BLFNBQVMsQ0FBQ0csT0FBTyxJQUN2QyxVQUFVLEtBQUssT0FBT0gsU0FBUyxDQUFDSSx3QkFBd0IsRUFDMUQ7UUFDRCxPQUFPLElBQUk7TUFDWjtNQUNBN0UsUUFBUSxHQUFHbEsseUJBQXlCLENBQUVDLE1BQU0sQ0FBQzBLLElBQUksQ0FBRTNLLHlCQUEwQixDQUFDLENBQUUsQ0FBQyxDQUFFLENBQUU7TUFDckYsSUFBSyxDQUFFa0ssUUFBUSxJQUFJLENBQUMsQ0FBQyxLQUFLQSxRQUFRLENBQUNuRCxZQUFZLENBQUM4RCxPQUFPLENBQUVsSixXQUFZLENBQUMsRUFBRztRQUN4RSxPQUFPLElBQUk7TUFDWjtNQUNBa04sZUFBZSxHQUFHO1FBQ2pCbE4sV0FBVyxFQUFFQSxXQUFXO1FBQ3hCZ0ksb0JBQW9CLEVBQUVPLFFBQVEsQ0FBQ1Asb0JBQW9CO1FBQ25ESSxRQUFRLEVBQUVHLFFBQVEsQ0FBQ0gsUUFBUTtRQUMzQm5KLGtCQUFrQixFQUFFRSwyQkFBMkI7UUFDL0NELHVCQUF1QixFQUFFRSxnQ0FBZ0M7UUFDekRDLGtCQUFrQixFQUFFQSxrQkFBa0I7UUFDdENnTyxlQUFlLEVBQUViLHVDQUF1QyxDQUFFeE0sV0FBWSxDQUFDO1FBQ3ZFc04sb0JBQW9CLEVBQUVaLDRDQUE0QyxDQUFFMU0sV0FBWSxDQUFDO1FBQ2pGd0MsWUFBWSxFQUFFbEUsTUFBTSxDQUFDc0ksTUFBTSxDQUFFO1VBQzVCbkUsSUFBSSxFQUFFLE1BQU07VUFDWjhLLGlCQUFpQixFQUFFeFAsTUFBTSxDQUFFTixhQUFhLENBQUNPLE1BQU0sSUFBSVAsYUFBYSxDQUFDTyxNQUFNLENBQUN3UCxzQkFBdUIsQ0FBQyxJQUFJLEdBQUc7VUFDdkdDLGVBQWUsRUFBRTFQLE1BQU0sQ0FBRU4sYUFBYSxDQUFDTyxNQUFNLElBQUlQLGFBQWEsQ0FBQ08sTUFBTSxDQUFDMFAsb0JBQXFCLENBQUMsSUFBSTtRQUNqRyxDQUFDLEVBQUVsTCxZQUFZLElBQUksQ0FBQyxDQUFFLENBQUM7UUFDdkJtTCxrQkFBa0IsRUFBRTVQLE1BQU0sQ0FBRU4sYUFBYSxDQUFDTyxNQUFNLElBQUlQLGFBQWEsQ0FBQ08sTUFBTSxDQUFDNFAscUJBQXNCLENBQUMsSUFBSTtNQUNyRyxDQUFDO01BQ0QzRSxTQUFTLEdBQUcrRCxTQUFTLENBQUNJLHdCQUF3QixDQUFFRixlQUFnQixDQUFDO01BQ2pFLElBQUtsTyxtQkFBbUIsQ0FBRWdCLFdBQVcsQ0FBRSxJQUFJaEIsbUJBQW1CLENBQUVnQixXQUFXLENBQUUsQ0FBQ2lKLFNBQVMsS0FBS0EsU0FBUyxFQUFHO1FBQ3ZHLE9BQU9qSyxtQkFBbUIsQ0FBRWdCLFdBQVcsQ0FBRSxDQUFDNk0sVUFBVTtNQUNyRDtNQUNBQSxVQUFVLEdBQUdHLFNBQVMsQ0FBQ0csT0FBTyxDQUFFRCxlQUFnQixDQUFDO01BQ2pEbE8sbUJBQW1CLENBQUVnQixXQUFXLENBQUUsR0FBRztRQUNwQ2lKLFNBQVMsRUFBRUEsU0FBUztRQUNwQjRELFVBQVUsRUFBRUE7TUFDYixDQUFDO01BRUQsT0FBT0EsVUFBVTtJQUNsQjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZ0Isa0JBQWtCQSxDQUFFQyxXQUFXLEVBQUc7TUFDMUMsSUFBSUMsY0FBYyxHQUFHblEsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFRCxJQUFJLENBQUNFLEdBQUcsQ0FBRSxJQUFJLEVBQUVGLElBQUksQ0FBQzBFLEtBQUssQ0FBRXZFLE1BQU0sQ0FBRStQLFdBQVksQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFFLENBQUM7TUFDOUYsSUFBSUUsS0FBSyxHQUFHcFEsSUFBSSxDQUFDcVEsS0FBSyxDQUFFRixjQUFjLEdBQUcsRUFBRyxDQUFDO01BQzdDLElBQUlHLE9BQU8sR0FBR0gsY0FBYyxHQUFHLEVBQUU7TUFFakMsT0FBTzdQLE1BQU0sQ0FBRThQLEtBQU0sQ0FBQyxDQUFDRyxRQUFRLENBQUUsQ0FBQyxFQUFFLEdBQUksQ0FBQyxHQUFHLEdBQUcsR0FBR2pRLE1BQU0sQ0FBRWdRLE9BQVEsQ0FBQyxDQUFDQyxRQUFRLENBQUUsQ0FBQyxFQUFFLEdBQUksQ0FBQztJQUN2Rjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxpQkFBaUJBLENBQUVDLGNBQWMsRUFBRztNQUM1QyxJQUFJQyxrQkFBa0IsR0FBRzFRLElBQUksQ0FBQzBFLEtBQUssQ0FBRXZFLE1BQU0sQ0FBRXNRLGNBQWUsQ0FBQyxJQUFJLENBQUUsQ0FBQztNQUNwRSxJQUFJRSxJQUFJLEdBQUcsQ0FBQyxHQUFHRCxrQkFBa0IsR0FBRyxHQUFHLEdBQUcsR0FBRztNQUM3QyxJQUFJRSxnQkFBZ0IsR0FBRzVRLElBQUksQ0FBQzZRLEdBQUcsQ0FBRUgsa0JBQW1CLENBQUM7TUFFckQsT0FBT0MsSUFBSSxHQUFHclEsTUFBTSxDQUFFTixJQUFJLENBQUNxUSxLQUFLLENBQUVPLGdCQUFnQixHQUFHLEVBQUcsQ0FBRSxDQUFDLENBQUNMLFFBQVEsQ0FBRSxDQUFDLEVBQUUsR0FBSSxDQUFDLEdBQUcsR0FBRyxHQUFHalEsTUFBTSxDQUFFc1EsZ0JBQWdCLEdBQUcsRUFBRyxDQUFDLENBQUNMLFFBQVEsQ0FBRSxDQUFDLEVBQUUsR0FBSSxDQUFDO0lBQzFJOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU08saUJBQWlCQSxDQUFFQyxPQUFPLEVBQUVDLE1BQU0sRUFBRztNQUM3Q3RRLE1BQU0sQ0FBQzBLLElBQUksQ0FBRTRGLE1BQU0sSUFBSSxDQUFDLENBQUUsQ0FBQyxDQUFDMU8sT0FBTyxDQUFFLFVBQVc0SCxHQUFHLEVBQUc7UUFDckQ2RyxPQUFPLEdBQUd6USxNQUFNLENBQUV5USxPQUFPLElBQUksRUFBRyxDQUFDLENBQUNFLE9BQU8sQ0FBRSxJQUFJQyxNQUFNLENBQUUsS0FBSyxHQUFHaEgsR0FBRyxHQUFHLEtBQUssRUFBRSxHQUFJLENBQUMsRUFBRTVKLE1BQU0sQ0FBRTBRLE1BQU0sQ0FBRTlHLEdBQUcsQ0FBRyxDQUFFLENBQUM7TUFDN0csQ0FBRSxDQUFDO01BRUgsT0FBTzVKLE1BQU0sQ0FBRXlRLE9BQU8sSUFBSSxFQUFHLENBQUM7SUFDL0I7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0ksd0JBQXdCQSxDQUFFckosTUFBTSxFQUFHO01BQzNDLElBQUlnQixJQUFJLEdBQUdqSixhQUFhLENBQUNpSixJQUFJLElBQUksQ0FBQyxDQUFDO01BRW5DLElBQUssVUFBVSxLQUFLaEIsTUFBTSxFQUFHO1FBQzVCLE9BQU94SCxNQUFNLENBQUV3SSxJQUFJLENBQUNzSSxlQUFlLElBQUksVUFBVyxDQUFDO01BQ3BEO01BQ0EsSUFBSyxTQUFTLEtBQUt0SixNQUFNLEVBQUc7UUFDM0IsT0FBT3hILE1BQU0sQ0FBRXdJLElBQUksQ0FBQ3VJLGNBQWMsSUFBSSxTQUFVLENBQUM7TUFDbEQ7TUFDQSxPQUFPL1EsTUFBTSxDQUFFd0ksSUFBSSxDQUFDd0ksY0FBYyxJQUFJLDRCQUE2QixDQUFDO0lBQ3JFOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0Msd0JBQXdCQSxDQUFFQyxRQUFRLEVBQUVDLElBQUksRUFBRztNQUNuRCxJQUFJQyxTQUFTLEdBQUcsUUFBUTtNQUN4QixJQUFJQyxjQUFjLEdBQUcxQixrQkFBa0IsQ0FBRXVCLFFBQVEsQ0FBQ0ksaUJBQWtCLENBQUMsR0FBR0YsU0FBUyxHQUFHekIsa0JBQWtCLENBQUV1QixRQUFRLENBQUNLLGVBQWdCLENBQUM7TUFDbEksSUFBSUMsWUFBWTtNQUNoQixJQUFJQyxVQUFVO01BRWQsSUFBSyxDQUFFTixJQUFJLElBQUksQ0FBRS9OLEtBQUssQ0FBQ0MsT0FBTyxDQUFFOE4sSUFBSSxDQUFDTyxVQUFXLENBQUMsSUFBSSxDQUFFUCxJQUFJLENBQUNPLFVBQVUsQ0FBQzdILE1BQU0sRUFBRztRQUMvRSxPQUFPd0gsY0FBYztNQUN0QjtNQUNBRyxZQUFZLEdBQUd0QixpQkFBaUIsQ0FBRWdCLFFBQVEsQ0FBQ1Msb0JBQXFCLENBQUM7TUFDakVGLFVBQVUsR0FBR3ZCLGlCQUFpQixDQUFFZ0IsUUFBUSxDQUFDVSxrQkFBbUIsQ0FBQztNQUM3RCxPQUFPUCxjQUFjLEdBQUcsT0FBTyxHQUFHRyxZQUFZLElBQUtBLFlBQVksS0FBS0MsVUFBVSxHQUFHLEVBQUUsR0FBR0wsU0FBUyxHQUFHLEtBQUssR0FBR0ssVUFBVSxDQUFFLEdBQUcsR0FBRztJQUM3SDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTSSxvQkFBb0JBLENBQUVWLElBQUksRUFBRztNQUNyQyxJQUFJVyxnQkFBZ0IsR0FBRyxJQUFJO01BRTNCN1Isd0JBQXdCLENBQUNzTixJQUFJLENBQUUsVUFBV3BHLFlBQVksRUFBRztRQUN4RCxJQUFJc0MsSUFBSSxHQUFHdEMsWUFBWSxJQUFJQSxZQUFZLENBQUNDLE9BQU8sR0FBR0QsWUFBWSxDQUFDQyxPQUFPLENBQUNxQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXRGLE9BQU8sQ0FBRXJHLEtBQUssQ0FBQ0MsT0FBTyxDQUFFb0csSUFBSSxDQUFDc0ksVUFBVyxDQUFDLEdBQUd0SSxJQUFJLENBQUNzSSxVQUFVLEdBQUcsRUFBRSxFQUFHeEUsSUFBSSxDQUFFLFVBQVd5RSxTQUFTLEVBQUc7VUFDL0YsSUFBS2hTLE1BQU0sQ0FBRWdTLFNBQVMsSUFBSUEsU0FBUyxDQUFDYixJQUFJLElBQUksRUFBRyxDQUFDLEtBQUtuUixNQUFNLENBQUVtUixJQUFJLElBQUksRUFBRyxDQUFDLEVBQUc7WUFDM0UsT0FBTyxLQUFLO1VBQ2I7VUFDQVcsZ0JBQWdCLEdBQUdFLFNBQVM7VUFDNUIsT0FBTyxJQUFJO1FBQ1osQ0FBRSxDQUFDO01BQ0osQ0FBRSxDQUFDO01BRUgsT0FBT0YsZ0JBQWdCLElBQUksQ0FBQyxDQUFDO0lBQzlCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNuTCxtQkFBbUJBLENBQUU3RSxXQUFXLEVBQUc7TUFDM0MsSUFBSW1RLGVBQWUsR0FBRyxJQUFJO01BRTFCaFMsd0JBQXdCLENBQUNzTixJQUFJLENBQUUsVUFBV3BHLFlBQVksRUFBRztRQUN4RCxJQUFJakUsU0FBUyxHQUFHaUUsWUFBWSxJQUFJQSxZQUFZLENBQUNDLE9BQU8sSUFBSWhFLEtBQUssQ0FBQ0MsT0FBTyxDQUFFOEQsWUFBWSxDQUFDQyxPQUFPLENBQUNsRSxTQUFVLENBQUMsR0FDcEdpRSxZQUFZLENBQUNDLE9BQU8sQ0FBQ2xFLFNBQVMsR0FDOUIsRUFBRTtRQUVMLE9BQU9BLFNBQVMsQ0FBQ3FLLElBQUksQ0FBRSxVQUFXaEssUUFBUSxFQUFHO1VBQzVDLElBQUsxRCxNQUFNLENBQUUwRCxRQUFRLElBQUlBLFFBQVEsQ0FBQ0MsRUFBRyxDQUFDLEtBQUszRCxNQUFNLENBQUVpQyxXQUFZLENBQUMsRUFBRztZQUNsRSxPQUFPLEtBQUs7VUFDYjtVQUNBbVEsZUFBZSxHQUFHMU8sUUFBUTtVQUMxQixPQUFPLElBQUk7UUFDWixDQUFFLENBQUM7TUFDSixDQUFFLENBQUM7TUFFSCxPQUFPME8sZUFBZSxJQUFJLENBQUMsQ0FBQztJQUM3Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLDJCQUEyQkEsQ0FBRUMsaUJBQWlCLEVBQUVDLFVBQVUsRUFBRztNQUNyRSxPQUFPcFMsTUFBTSxDQUFFbVMsaUJBQWlCLElBQUksRUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHdFMsTUFBTSxDQUFFdVMsVUFBVSxJQUFJLENBQUUsQ0FBQztJQUMzRTs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsMEJBQTBCQSxDQUFFdlEsV0FBVyxFQUFHO01BQ2xELElBQUl3USwyQkFBMkIsR0FBR2xTLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztNQUV2REosd0JBQXdCLENBQUMrQixPQUFPLENBQUUsVUFBV21GLFlBQVksRUFBRztRQUMzRCxJQUFJMkcsUUFBUSxHQUFHM0csWUFBWSxJQUFJQSxZQUFZLENBQUNDLE9BQU8sSUFBSWhFLEtBQUssQ0FBQ0MsT0FBTyxDQUFFOEQsWUFBWSxDQUFDQyxPQUFPLENBQUMwRyxRQUFTLENBQUMsR0FDbEczRyxZQUFZLENBQUNDLE9BQU8sQ0FBQzBHLFFBQVEsR0FDN0IsRUFBRTtRQUVMQSxRQUFRLENBQUM5TCxPQUFPLENBQUUsVUFBVytMLE9BQU8sRUFBRztVQUN0QyxJQUFJMUQsUUFBUTtVQUVaLElBQUt4SyxNQUFNLENBQUVrTyxPQUFPLElBQUlBLE9BQU8sQ0FBQ2pNLFdBQVksQ0FBQyxLQUFLakMsTUFBTSxDQUFFaUMsV0FBWSxDQUFDLEVBQUc7WUFDekU7VUFDRDtVQUNBdUksUUFBUSxHQUFHNkgsMkJBQTJCLENBQUVuRSxPQUFPLElBQUlBLE9BQU8sQ0FBQ3dFLFVBQVUsRUFBRXhFLE9BQU8sSUFBSUEsT0FBTyxDQUFDcUUsVUFBVyxDQUFDO1VBQ3RHLElBQUssQ0FBRUUsMkJBQTJCLENBQUVqSSxRQUFRLENBQUUsRUFBRztZQUNoRGlJLDJCQUEyQixDQUFFakksUUFBUSxDQUFFLEdBQUcwRCxPQUFPO1VBQ2xEO1FBQ0QsQ0FBRSxDQUFDO01BQ0osQ0FBRSxDQUFDO01BRUgsT0FBT3VFLDJCQUEyQjtJQUNuQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTRSxZQUFZQSxDQUFFQyxhQUFhLEVBQUc7TUFDdEMsSUFBSUMsV0FBVyxHQUFHblQsYUFBYSxDQUFDb1QsU0FBUyxJQUFJcFQsYUFBYSxDQUFDb1QsU0FBUyxDQUFFRixhQUFhLENBQUU7TUFFckYsT0FBT0MsV0FBVyxJQUFJeFQsRUFBRSxJQUFJLFVBQVUsS0FBSyxPQUFPQSxFQUFFLENBQUMwVCxRQUFRLEdBQUcxVCxFQUFFLENBQUMwVCxRQUFRLENBQUVGLFdBQVksQ0FBQyxHQUFHLElBQUk7SUFDbEc7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0csZ0JBQWdCQSxDQUFFQyxLQUFLLEVBQUc7TUFDbEMsSUFBSUMsS0FBSyxHQUFHLEVBQUU7TUFDZCxJQUFJQyxpQkFBaUIsR0FBRyxFQUFFO01BQzFCLElBQUlDLFdBQVcsR0FBR3ZULElBQUksQ0FBQ3dULElBQUksQ0FBRUosS0FBSyxDQUFDdE8sWUFBWSxHQUFHd08saUJBQWtCLENBQUMsR0FBR0EsaUJBQWlCO01BQ3pGLElBQUlHLE9BQU87TUFDWCxJQUFJQyxZQUFZO01BRWhCLE9BQVFILFdBQVcsSUFBSUgsS0FBSyxDQUFDck8sVUFBVSxFQUFFd08sV0FBVyxJQUFJRCxpQkFBaUIsRUFBRztRQUMzRUcsT0FBTyxHQUFHLENBQUMsS0FBS0YsV0FBVyxHQUFHLEVBQUU7UUFDaENHLFlBQVksR0FBRyxFQUFFLEtBQUtILFdBQVcsR0FBRyxFQUFFO1FBQ3RDRixLQUFLLENBQUN2SCxJQUFJLENBQUU7VUFDWDZILE1BQU0sRUFBRUosV0FBVztVQUNuQmxPLEtBQUssRUFBRW9PLE9BQU8sR0FBR3hELGtCQUFrQixDQUFFc0QsV0FBWSxDQUFDLEdBQUcsRUFBRTtVQUN2REUsT0FBTyxFQUFFQSxPQUFPO1VBQ2hCQyxZQUFZLEVBQUVBLFlBQVk7VUFDMUJFLFFBQVEsRUFBRSxDQUFFSCxPQUFPLElBQUksQ0FBRUMsWUFBWTtVQUNyQ0csV0FBVyxFQUFFTixXQUFXLEtBQUtILEtBQUssQ0FBQ3RPLFlBQVksSUFBSXlPLFdBQVcsS0FBS0gsS0FBSyxDQUFDck8sVUFBVTtVQUNuRitPLGNBQWMsRUFBRTNULE1BQU0sQ0FBRSxDQUFFLEdBQUcsSUFBS29ULFdBQVcsR0FBR0gsS0FBSyxDQUFDdE8sWUFBWSxDQUFFLEdBQUdzTyxLQUFLLENBQUNXLFlBQVksRUFBR0MsT0FBTyxDQUFFLENBQUUsQ0FBRTtRQUMxRyxDQUFFLENBQUM7TUFDSjtNQUNBLElBQUssQ0FBRVgsS0FBSyxDQUFDbEosTUFBTSxJQUFJa0osS0FBSyxDQUFFQSxLQUFLLENBQUNsSixNQUFNLEdBQUcsQ0FBQyxDQUFFLENBQUN3SixNQUFNLEtBQUtQLEtBQUssQ0FBQ3JPLFVBQVUsRUFBRztRQUM5RXNPLEtBQUssQ0FBQ3ZILElBQUksQ0FBRTtVQUNYNkgsTUFBTSxFQUFFUCxLQUFLLENBQUNyTyxVQUFVO1VBQ3hCTSxLQUFLLEVBQUU0SyxrQkFBa0IsQ0FBRW1ELEtBQUssQ0FBQ3JPLFVBQVcsQ0FBQztVQUM3QzBPLE9BQU8sRUFBRSxLQUFLO1VBQ2RDLFlBQVksRUFBRSxLQUFLO1VBQ25CRSxRQUFRLEVBQUUsS0FBSztVQUNmQyxXQUFXLEVBQUUsSUFBSTtVQUNqQkMsY0FBYyxFQUFFO1FBQ2pCLENBQUUsQ0FBQztNQUNKO01BRUEsT0FBT1QsS0FBSztJQUNiOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNZLDBCQUEwQkEsQ0FBRUMsU0FBUyxFQUFHO01BQ2hELElBQUlDLE9BQU8sR0FBRztRQUNieEYsT0FBTyxFQUFFLFlBQVk7UUFDckJ5RixZQUFZLEVBQUUsaUJBQWlCO1FBQy9CQyxZQUFZLEVBQUUsaUJBQWlCO1FBQy9CQyxtQkFBbUIsRUFBRSx3QkFBd0I7UUFDN0NDLHFCQUFxQixFQUFFLDBCQUEwQjtRQUNqREMsa0JBQWtCLEVBQUUsdUJBQXVCO1FBQzNDQyxjQUFjLEVBQUUsbUJBQW1CO1FBQ25DQyxZQUFZLEVBQUU7TUFDZixDQUFDO01BRUQsT0FBT1AsT0FBTyxDQUFFN1QsTUFBTSxDQUFFNFQsU0FBUyxJQUFJLEVBQUcsQ0FBQyxDQUFFLElBQUksWUFBWTtJQUM1RDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTUyxzQkFBc0JBLENBQUVDLElBQUksRUFBRztNQUN2QyxJQUFJOUwsSUFBSSxHQUFHakosYUFBYSxDQUFDaUosSUFBSSxJQUFJLENBQUMsQ0FBQztNQUNuQyxJQUFJK0wsTUFBTSxHQUFHO1FBQ1pDLGdCQUFnQixFQUFFaE0sSUFBSSxDQUFDZ00sZ0JBQWdCO1FBQ3ZDQyxhQUFhLEVBQUVqTSxJQUFJLENBQUNpTSxhQUFhO1FBQ2pDQyxjQUFjLEVBQUVsTSxJQUFJLENBQUNrTSxjQUFjO1FBQ25DeEcsWUFBWSxFQUFFMUYsSUFBSSxDQUFDbU0sbUJBQW1CO1FBQ3RDQyxvQkFBb0IsRUFBRXBNLElBQUksQ0FBQ21NLG1CQUFtQjtRQUM5Q3hULGtCQUFrQixFQUFFcUgsSUFBSSxDQUFDcU07TUFDMUIsQ0FBQztNQUVELE9BQU83VSxNQUFNLENBQUV1VSxNQUFNLENBQUVELElBQUksQ0FBRSxJQUFJOUwsSUFBSSxDQUFDekQsS0FBSyxJQUFJLEVBQUcsQ0FBQztJQUNwRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUytQLHdCQUF3QkEsQ0FBRW5HLFVBQVUsRUFBRTNILFlBQVksRUFBRztNQUM3RCxJQUFJd0IsSUFBSSxHQUFHakosYUFBYSxDQUFDaUosSUFBSSxJQUFJLENBQUMsQ0FBQztNQUNuQyxJQUFJakMsSUFBSSxHQUFHakIsc0JBQXNCLENBQUMsQ0FBQztNQUNuQyxJQUFJeVAsa0JBQWtCLEdBQUdsUiwyQkFBMkIsQ0FBQyxDQUFDO01BQ3RELElBQUltUixxQkFBcUIsR0FBRzlQLHlCQUF5QixDQUFFeUosVUFBVSxDQUFDbUUsS0FBTSxDQUFDO01BQ3pFLElBQUltQyxXQUFXLEdBQUc3VSxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDdkMsSUFBSWlTLDJCQUEyQixHQUFHRCwwQkFBMEIsQ0FBRTFELFVBQVUsQ0FBQzdNLFdBQVksQ0FBQztNQUN0RixJQUFJb1QsYUFBYSxHQUFHLEVBQUU7TUFDdEIsSUFBSUMsS0FBSyxHQUFHeEcsVUFBVSxDQUFDd0csS0FBSyxDQUFDN1IsR0FBRyxDQUFFLFVBQVc2TixJQUFJLEVBQUc7UUFDbkQsSUFBSWlFLFdBQVcsR0FBR3ZELG9CQUFvQixDQUFFVixJQUFJLENBQUNBLElBQUssQ0FBQztRQUNuRCxJQUFJa0UsY0FBYyxHQUFHalYsTUFBTSxDQUFDc0ksTUFBTSxDQUFFLENBQUMsQ0FBQyxFQUFFeUksSUFBSSxFQUFFO1VBQzdDcE0sS0FBSyxFQUFFL0UsTUFBTSxDQUFFb1YsV0FBVyxDQUFDclEsS0FBSyxJQUFJb00sSUFBSSxDQUFDQSxJQUFLLENBQUM7VUFDL0NtRSxPQUFPLEVBQUV0VixNQUFNLENBQUVvVixXQUFXLENBQUNFLE9BQU8sSUFBSW5FLElBQUksQ0FBQ0EsSUFBSyxDQUFDO1VBQ25Eb0UsVUFBVSxFQUFFdlYsTUFBTSxDQUFFb1YsV0FBVyxDQUFDRyxVQUFVLElBQUksRUFBRyxDQUFDO1VBQ2xEQyxRQUFRLEVBQUUsSUFBSSxLQUFLSixXQUFXLENBQUNJLFFBQVE7VUFDdkNDLFVBQVUsRUFBRSxJQUFJLEtBQUtMLFdBQVcsQ0FBQ0ssVUFBVTtVQUMzQy9ELFVBQVUsRUFBRVAsSUFBSSxDQUFDTyxVQUFVLENBQUNwTyxHQUFHLENBQUUsVUFBV29TLFVBQVUsRUFBRztZQUN4RCxJQUFJQyxhQUFhLEdBQUdqVyxJQUFJLENBQUNDLEdBQUcsQ0FBRWdQLFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ3RPLFlBQVksRUFBRWtSLFVBQVUsQ0FBQ2xSLFlBQWEsQ0FBQztZQUN0RixJQUFJb1IsV0FBVyxHQUFHbFcsSUFBSSxDQUFDRSxHQUFHLENBQUUrTyxVQUFVLENBQUNtRSxLQUFLLENBQUNyTyxVQUFVLEVBQUVpUixVQUFVLENBQUNqUixVQUFXLENBQUM7WUFDaEYsSUFBSW9SLFVBQVUsR0FBRyxLQUFLLEtBQUtILFVBQVUsQ0FBQ3BCLElBQUksR0FBRzlMLElBQUksQ0FBQ3NOLE9BQU8sR0FBR3ROLElBQUksQ0FBQ3VOLFFBQVE7WUFDekUsSUFBSUMsYUFBYSxHQUFHOUYsaUJBQWlCLENBQUVyUSxNQUFNLENBQUU2VixVQUFVLENBQUNPLHFCQUFxQixJQUFJLENBQUUsQ0FBQyxHQUFHLEVBQUcsQ0FBQztZQUM3RixJQUFJQyxZQUFZLEdBQUdoRyxpQkFBaUIsQ0FBRXJRLE1BQU0sQ0FBRTZWLFVBQVUsQ0FBQ1Msb0JBQW9CLElBQUksQ0FBRSxDQUFDLEdBQUcsRUFBRyxDQUFDO1lBRTNGLE9BQU8vVixNQUFNLENBQUNzSSxNQUFNLENBQUUsQ0FBQyxDQUFDLEVBQUVnTixVQUFVLEVBQUU7Y0FDckNVLFdBQVcsRUFBRXZXLE1BQU0sQ0FBRSxDQUFFLEdBQUcsSUFBSzhWLGFBQWEsR0FBR2hILFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ3RPLFlBQVksQ0FBRSxHQUFHbUssVUFBVSxDQUFDbUUsS0FBSyxDQUFDVyxZQUFZLEVBQUdDLE9BQU8sQ0FBRSxDQUFFLENBQUUsQ0FBQztjQUMvSDJDLGNBQWMsRUFBRXhXLE1BQU0sQ0FBRSxDQUFFLEdBQUcsR0FBR0gsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFaVcsV0FBVyxHQUFHRCxhQUFjLENBQUMsR0FBR2hILFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ1csWUFBWSxFQUFHQyxPQUFPLENBQUUsQ0FBRSxDQUFFLENBQUM7Y0FDM0htQyxVQUFVLEVBQUU3VixNQUFNLENBQUU2VixVQUFVLElBQUlILFVBQVUsQ0FBQ3BCLElBQUssQ0FBQztjQUNuRDBCLGFBQWEsRUFBRUEsYUFBYTtjQUM1QkUsWUFBWSxFQUFFQSxZQUFZO2NBQzFCblIsS0FBSyxFQUFFeUwsaUJBQWlCLENBQUVoSSxJQUFJLENBQUM4TixvQkFBb0IsRUFBRTtnQkFDcERoQyxJQUFJLEVBQUV1QixVQUFVLElBQUlILFVBQVUsQ0FBQ3BCLElBQUk7Z0JBQ25DaUMsTUFBTSxFQUFFUCxhQUFhO2dCQUNyQlEsS0FBSyxFQUFFTjtjQUNSLENBQUU7WUFDSCxDQUFFLENBQUM7VUFDSixDQUFFLENBQUMsQ0FBQ3pTLE1BQU0sQ0FBRSxVQUFXaVMsVUFBVSxFQUFHO1lBQ25DLE9BQU8sQ0FBQyxHQUFHQSxVQUFVLENBQUNXLGNBQWM7VUFDckMsQ0FBRTtRQUNILENBQUUsQ0FBQztRQUVIcEIsV0FBVyxDQUFFSSxjQUFjLENBQUNsRSxJQUFJLENBQUUsR0FBR2tFLGNBQWM7UUFDbkQsT0FBT0EsY0FBYztNQUN0QixDQUFFLENBQUM7TUFDSCxJQUFJb0IsaUJBQWlCLEdBQUcsU0FBQUEsQ0FBV3ZGLFFBQVEsRUFBRXdGLGFBQWEsRUFBRUMsZ0JBQWdCLEVBQUc7UUFDOUUsSUFBSUMsY0FBYyxHQUFHdEUsMkJBQTJCLENBQUVKLDJCQUEyQixDQUFFaEIsUUFBUSxDQUFDaUIsaUJBQWlCLEVBQUVqQixRQUFRLENBQUNrQixVQUFXLENBQUMsQ0FBRSxJQUFJLElBQUk7UUFFMUksSUFBS3dFLGNBQWMsRUFBRztVQUNyQjFCLGFBQWEsQ0FBQzFKLElBQUksQ0FBRTtZQUNuQnFMLGlCQUFpQixFQUFFSCxhQUFhLENBQUNHLGlCQUFpQjtZQUNsRDlJLE9BQU8sRUFBRTZJLGNBQWM7WUFDdkJFLGFBQWEsRUFBRSxJQUFJLEtBQUtKLGFBQWEsQ0FBQ0ksYUFBYTtZQUNuREgsZ0JBQWdCLEVBQUUsVUFBVSxLQUFLQSxnQkFBZ0IsR0FBRyxVQUFVLEdBQUcsWUFBWTtZQUM3RUksbUJBQW1CLEVBQUU7Y0FDcEJDLEtBQUssRUFBRSxDQUFFTixhQUFhLENBQUNPLHVCQUF1QjtjQUM5Q0MsR0FBRyxFQUFFLENBQUVSLGFBQWEsQ0FBQ1M7WUFDdEI7VUFDRCxDQUFFLENBQUM7UUFDSjtNQUNELENBQUM7TUFDRCxJQUFJQyx1QkFBdUIsR0FBR3pJLFVBQVUsQ0FBQzBJLGtCQUFrQixDQUFDL1QsR0FBRyxDQUFFLFVBQVc0TixRQUFRLEVBQUc7UUFDdEYsSUFBSUMsSUFBSSxHQUFHOEQsV0FBVyxDQUFFL0QsUUFBUSxDQUFDQyxJQUFJLENBQUU7UUFFdkMsT0FBTy9RLE1BQU0sQ0FBQ3NJLE1BQU0sQ0FBRSxDQUFDLENBQUMsRUFBRXdJLFFBQVEsRUFBRTtVQUNuQ29HLFVBQVUsRUFBRW5HLElBQUksR0FBR3RSLE1BQU0sQ0FBRXNSLElBQUksQ0FBQ29HLEtBQU0sQ0FBQyxHQUFHLENBQUM7VUFDM0NDLFlBQVksRUFBRXJHLElBQUksR0FBR0EsSUFBSSxDQUFDcUMsY0FBYyxHQUFHLENBQUM7VUFDNUNpRSxhQUFhLEVBQUV0RyxJQUFJLEdBQUdBLElBQUksQ0FBQ3NHLGFBQWEsR0FBRyxDQUFDO1VBQzVDQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRzdYLE1BQU0sQ0FBRXFSLFFBQVEsQ0FBQ3lHLFdBQVcsSUFBSSxDQUFFLENBQUM7VUFDMURDLFlBQVksRUFBRS9HLHdCQUF3QixDQUFFSyxRQUFRLENBQUMxSixNQUFPLENBQUM7VUFDekRxUSxvQkFBb0IsRUFBRTNHLFFBQVEsQ0FBQzJHLG9CQUFvQixJQUFJckgsaUJBQWlCLENBQUVoSSxJQUFJLENBQUNzUCxjQUFjLEVBQUU7WUFBRS9TLEtBQUssRUFBRW1NLFFBQVEsQ0FBQ25NO1VBQU0sQ0FBRSxDQUFDO1VBQzFIZ1Qsc0JBQXNCLEVBQUU3RyxRQUFRLENBQUM2RyxzQkFBc0IsSUFBSXZILGlCQUFpQixDQUFFaEksSUFBSSxDQUFDd1AsbUJBQW1CLEVBQUU7WUFBRWpULEtBQUssRUFBRW1NLFFBQVEsQ0FBQ25NO1VBQU0sQ0FBRSxDQUFDO1VBQ25Ja1Qsa0JBQWtCLEVBQUV6SCxpQkFBaUIsQ0FBRWhJLElBQUksQ0FBQzBQLGVBQWUsRUFBRTtZQUFFblQsS0FBSyxFQUFFbU0sUUFBUSxDQUFDbk07VUFBTSxDQUFFO1FBQ3hGLENBQUUsQ0FBQztNQUNKLENBQUUsQ0FBQztNQUNILElBQUlvVCxlQUFlLEdBQUcvWCxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDM0MsSUFBSWdYLGtCQUFrQixHQUFHLEVBQUU7TUFFM0JELHVCQUF1QixDQUFDcFYsT0FBTyxDQUFFLFVBQVdrUCxRQUFRLEVBQUc7UUFDdEQsSUFBSWtILFNBQVMsR0FBRyxDQUFFbEgsUUFBUSxDQUFDaUIsaUJBQWlCLEVBQUVqQixRQUFRLENBQUNrQixVQUFVLEVBQUVsQixRQUFRLENBQUNwUCxXQUFXLEVBQUVvUCxRQUFRLENBQUN5RyxXQUFXLENBQUUsQ0FBQ3JOLElBQUksQ0FBRSxHQUFJLENBQUM7UUFFM0gsSUFBSyxDQUFFNk4sZUFBZSxDQUFFQyxTQUFTLENBQUUsRUFBRztVQUNyQ0QsZUFBZSxDQUFFQyxTQUFTLENBQUUsR0FBRyxFQUFFO1FBQ2xDO1FBQ0FELGVBQWUsQ0FBRUMsU0FBUyxDQUFFLENBQUM1TSxJQUFJLENBQUUwRixRQUFTLENBQUM7TUFDOUMsQ0FBRSxDQUFDO01BQ0g7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNHLFNBQVNtSCxvQkFBb0JBLENBQUVELFNBQVMsRUFBRUUsU0FBUyxFQUFFQyxVQUFVLEVBQUc7UUFDakUsSUFBSUMsY0FBYyxHQUFHRixTQUFTLENBQUUsQ0FBQyxDQUFFO1FBQ25DLElBQUlHLGFBQWEsR0FBR0gsU0FBUyxDQUFFQSxTQUFTLENBQUN6TyxNQUFNLEdBQUcsQ0FBQyxDQUFFO1FBQ3JELElBQUk2TyxVQUFVLEdBQUd6RCxXQUFXLENBQUV1RCxjQUFjLENBQUNySCxJQUFJLENBQUU7UUFDbkQsSUFBSXdILFNBQVMsR0FBRzFELFdBQVcsQ0FBRXdELGFBQWEsQ0FBQ3RILElBQUksQ0FBRTtRQUNqRCxJQUFJOEYsdUJBQXVCLEdBQUdoUyxPQUFPLENBQUV1VCxjQUFjLENBQUNJLHFCQUFxQixJQUFJSixjQUFjLENBQUNLLDhCQUErQixDQUFDO1FBQzlILElBQUkxQixxQkFBcUIsR0FBR2xTLE9BQU8sQ0FBRXdULGFBQWEsQ0FBQ0ssb0JBQW9CLElBQUlMLGFBQWEsQ0FBQ00sNkJBQThCLENBQUM7UUFDeEgsSUFBSTFILGNBQWMsR0FBR21ILGNBQWMsQ0FBQ3JILElBQUksS0FBS3NILGFBQWEsQ0FBQ3RILElBQUksR0FBR3FILGNBQWMsQ0FBQ3JILElBQUksR0FBR3FILGNBQWMsQ0FBQ3JILElBQUksR0FBRyxRQUFRLEdBQUdzSCxhQUFhLENBQUN0SCxJQUFJO1FBQzNJLElBQUl1RixhQUFhLEdBQUd0VyxNQUFNLENBQUNzSSxNQUFNLENBQUUsQ0FBQyxDQUFDLEVBQUU4UCxjQUFjLEVBQUU7VUFDdERRLFlBQVksRUFBRVYsU0FBUyxDQUFDaFYsR0FBRyxDQUFFLFVBQVc0TixRQUFRLEVBQUc7WUFBRSxPQUFPQSxRQUFRLENBQUMrSCxXQUFXO1VBQUUsQ0FBRSxDQUFDO1VBQ3JGQyxRQUFRLEVBQUVULGFBQWEsQ0FBQ3RILElBQUk7VUFDNUIwRixpQkFBaUIsRUFBRSxxQkFBcUIsR0FBR3VCLFNBQVMsR0FBRyxHQUFHLEdBQUdHLFVBQVUsR0FBRyxHQUFHLEdBQUdDLGNBQWMsQ0FBQ3JILElBQUksR0FBRyxHQUFHLEdBQUdzSCxhQUFhLENBQUN0SCxJQUFJO1VBQzlIcUcsWUFBWSxFQUFFa0IsVUFBVSxHQUFHQSxVQUFVLENBQUNsRixjQUFjLEdBQUcsQ0FBQztVQUN4RGlFLGFBQWEsRUFBRWlCLFVBQVUsSUFBSUMsU0FBUyxHQUFHQSxTQUFTLENBQUNuRixjQUFjLEdBQUdtRixTQUFTLENBQUNsQixhQUFhLEdBQUdpQixVQUFVLENBQUNsRixjQUFjLEdBQUcsQ0FBQztVQUMzSG5DLGNBQWMsRUFBRUEsY0FBYztVQUM5QjRGLHVCQUF1QixFQUFFQSx1QkFBdUI7VUFDaERFLHFCQUFxQixFQUFFQSxxQkFBcUI7VUFDNUNuUyxVQUFVLEVBQUUsQ0FBRXdULGNBQWMsQ0FBQ3pULEtBQUssRUFBRXNNLGNBQWMsRUFBRW1ILGNBQWMsQ0FBQ1osWUFBWSxFQUFFWCx1QkFBdUIsR0FBR3pPLElBQUksQ0FBQzJRLGdCQUFnQixHQUFHLEVBQUUsRUFBRWhDLHFCQUFxQixHQUFHM08sSUFBSSxDQUFDNFEsZUFBZSxHQUFHLEVBQUUsQ0FBRSxDQUFDM1YsTUFBTSxDQUFFd0IsT0FBUSxDQUFDLENBQUNxRixJQUFJLENBQUUsSUFBSztRQUN6TixDQUFFLENBQUM7UUFFSG1NLGlCQUFpQixDQUFFK0IsY0FBYyxFQUFFOUIsYUFBYSxFQUFFLFlBQWEsQ0FBQztRQUNoRVcsa0JBQWtCLENBQUM3TCxJQUFJLENBQUVrTCxhQUFjLENBQUM7TUFDekM7TUFFQXRXLE1BQU0sQ0FBQzBLLElBQUksQ0FBRXFOLGVBQWdCLENBQUMsQ0FBQ3pVLElBQUksQ0FBQyxDQUFDLENBQUMxQixPQUFPLENBQUUsVUFBV29XLFNBQVMsRUFBRztRQUNyRSxJQUFJRSxTQUFTLEdBQUdILGVBQWUsQ0FBRUMsU0FBUyxDQUFFLENBQUMxVSxJQUFJLENBQUUsVUFBVzJWLElBQUksRUFBRUMsS0FBSyxFQUFHO1VBQzNFLE9BQU9ELElBQUksQ0FBQy9CLFVBQVUsR0FBR2dDLEtBQUssQ0FBQ2hDLFVBQVUsSUFBSStCLElBQUksQ0FBQ0UsV0FBVyxHQUFHRCxLQUFLLENBQUNDLFdBQVc7UUFDbEYsQ0FBRSxDQUFDO1FBQ0gsSUFBSUMsb0JBQW9CLEdBQUcsRUFBRTtRQUM3QixJQUFJakIsVUFBVSxHQUFHLENBQUM7UUFFbEJELFNBQVMsQ0FBQ3RXLE9BQU8sQ0FBRSxVQUFXa1AsUUFBUSxFQUFHO1VBQ3hDLElBQUl1SSxpQkFBaUIsR0FBR0Qsb0JBQW9CLENBQUVBLG9CQUFvQixDQUFDM1AsTUFBTSxHQUFHLENBQUMsQ0FBRTtVQUUvRSxJQUFLNFAsaUJBQWlCLElBQUl2SSxRQUFRLENBQUNvRyxVQUFVLEtBQUttQyxpQkFBaUIsQ0FBQ25DLFVBQVUsR0FBRyxDQUFDLEVBQUc7WUFDcEZlLG9CQUFvQixDQUFFRCxTQUFTLEVBQUVvQixvQkFBb0IsRUFBRWpCLFVBQVcsQ0FBQztZQUNuRWlCLG9CQUFvQixHQUFHLEVBQUU7WUFDekJqQixVQUFVLElBQUksQ0FBQztVQUNoQjtVQUNBaUIsb0JBQW9CLENBQUNoTyxJQUFJLENBQUUwRixRQUFTLENBQUM7UUFDdEMsQ0FBRSxDQUFDO1FBQ0gsSUFBS3NJLG9CQUFvQixDQUFDM1AsTUFBTSxFQUFHO1VBQ2xDd08sb0JBQW9CLENBQUVELFNBQVMsRUFBRW9CLG9CQUFvQixFQUFFakIsVUFBVyxDQUFDO1FBQ3BFO01BQ0QsQ0FBRSxDQUFDO01BQ0gsSUFBSW1CLGVBQWUsR0FBRy9LLFVBQVUsQ0FBQytLLGVBQWUsQ0FBQ3BXLEdBQUcsQ0FBRSxVQUFXNE4sUUFBUSxFQUFHO1FBQzNFLElBQUlDLElBQUksR0FBRzhELFdBQVcsQ0FBRS9ELFFBQVEsQ0FBQ0MsSUFBSSxDQUFFO1FBQ3ZDLElBQUl3SSxVQUFVLEdBQUdqYSxJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVFLE1BQU0sQ0FBRXFSLFFBQVEsQ0FBQ3lJLFVBQVUsSUFBSSxDQUFFLENBQUUsQ0FBQztRQUNsRSxJQUFJdEksY0FBYyxHQUFHSix3QkFBd0IsQ0FBRUMsUUFBUSxFQUFFQyxJQUFLLENBQUM7UUFDL0QsSUFBSXlHLFlBQVksR0FBRy9HLHdCQUF3QixDQUFFSyxRQUFRLENBQUMxSixNQUFPLENBQUM7UUFDOUQsSUFBSXlQLHVCQUF1QixHQUFHaFMsT0FBTyxDQUFFaU0sUUFBUSxDQUFDMEksZ0JBQWdCLElBQUkxSSxRQUFRLENBQUMwSCxxQkFBcUIsSUFBSTFILFFBQVEsQ0FBQzJJLHlCQUF5QixJQUFJM0ksUUFBUSxDQUFDMkgsOEJBQStCLENBQUM7UUFDckwsSUFBSTFCLHFCQUFxQixHQUFHbFMsT0FBTyxDQUFFaU0sUUFBUSxDQUFDNEksZ0JBQWdCLElBQUk1SSxRQUFRLENBQUM0SCxvQkFBb0IsSUFBSTVILFFBQVEsQ0FBQzZJLHdCQUF3QixJQUFJN0ksUUFBUSxDQUFDNkgsNkJBQThCLENBQUM7UUFDaEwsSUFBSXJDLGFBQWEsR0FBR3RXLE1BQU0sQ0FBQ3NJLE1BQU0sQ0FBRSxDQUFDLENBQUMsRUFBRXdJLFFBQVEsRUFBRTtVQUNoRDJGLGlCQUFpQixFQUFFLFlBQVksR0FBRzNGLFFBQVEsQ0FBQytILFdBQVc7VUFDdER6QixZQUFZLEVBQUVyRyxJQUFJLEdBQUdBLElBQUksQ0FBQ3FDLGNBQWMsR0FBR3JDLElBQUksQ0FBQ3NHLGFBQWEsR0FBRzVYLE1BQU0sQ0FBRXFSLFFBQVEsQ0FBQzhJLFVBQVUsSUFBSSxDQUFFLENBQUMsR0FBR0wsVUFBVSxHQUFHLENBQUM7VUFDbkhsQyxhQUFhLEVBQUV0RyxJQUFJLEdBQUdBLElBQUksQ0FBQ3NHLGFBQWEsR0FBR2tDLFVBQVUsR0FBRyxDQUFDO1VBQ3pEdEksY0FBYyxFQUFFQSxjQUFjO1VBQzlCdUcsWUFBWSxFQUFFQSxZQUFZO1VBQzFCWCx1QkFBdUIsRUFBRUEsdUJBQXVCO1VBQ2hERSxxQkFBcUIsRUFBRUEscUJBQXFCO1VBQzVDblMsVUFBVSxFQUFFLENBQUVrTSxRQUFRLENBQUNuTSxLQUFLLEVBQUVzTSxjQUFjLEVBQUV1RyxZQUFZLEVBQUVYLHVCQUF1QixHQUFHek8sSUFBSSxDQUFDMlEsZ0JBQWdCLEdBQUcsRUFBRSxFQUFFaEMscUJBQXFCLEdBQUczTyxJQUFJLENBQUM0USxlQUFlLEdBQUcsRUFBRSxDQUFFLENBQUMzVixNQUFNLENBQUV3QixPQUFRLENBQUMsQ0FBQ3FGLElBQUksQ0FBRSxJQUFLLENBQUM7VUFDcE11TixvQkFBb0IsRUFBRTNHLFFBQVEsQ0FBQzJHLG9CQUFvQixJQUFJckgsaUJBQWlCLENBQUVoSSxJQUFJLENBQUNzUCxjQUFjLEVBQUU7WUFBRS9TLEtBQUssRUFBRW1NLFFBQVEsQ0FBQ25NO1VBQU0sQ0FBRSxDQUFDO1VBQzFIZ1Qsc0JBQXNCLEVBQUU3RyxRQUFRLENBQUM2RyxzQkFBc0IsSUFBSXZILGlCQUFpQixDQUFFaEksSUFBSSxDQUFDd1AsbUJBQW1CLEVBQUU7WUFBRWpULEtBQUssRUFBRW1NLFFBQVEsQ0FBQ25NO1VBQU0sQ0FBRSxDQUFDO1VBQ25Ja1Qsa0JBQWtCLEVBQUV6SCxpQkFBaUIsQ0FBRWhJLElBQUksQ0FBQzBQLGVBQWUsRUFBRTtZQUFFblQsS0FBSyxFQUFFbU0sUUFBUSxDQUFDbk07VUFBTSxDQUFFO1FBQ3hGLENBQUUsQ0FBQztRQUVIMFIsaUJBQWlCLENBQUV2RixRQUFRLEVBQUV3RixhQUFhLEVBQUUsVUFBVyxDQUFDO1FBQ3hELE9BQU9BLGFBQWE7TUFDckIsQ0FBRSxDQUFDO01BQ0gsSUFBSXVELG9CQUFvQixHQUFHN1osTUFBTSxDQUFDQyxNQUFNLENBQUUsSUFBSyxDQUFDO01BQ2hEcVosZUFBZSxDQUFDMVgsT0FBTyxDQUFFLFVBQVdrUCxRQUFRLEVBQUc7UUFDOUMrSSxvQkFBb0IsQ0FBRS9JLFFBQVEsQ0FBQytILFdBQVcsQ0FBRSxHQUFHL0gsUUFBUTtNQUN4RCxDQUFFLENBQUM7TUFDSCxJQUFJZ0osbUJBQW1CLEdBQUc5Qyx1QkFBdUIsQ0FBQytDLE1BQU0sQ0FBRSxVQUFXQyxXQUFXLEVBQUVsSixRQUFRLEVBQUc7UUFDNUYsT0FBT3hSLElBQUksQ0FBQ0MsR0FBRyxDQUFFeWEsV0FBVyxFQUFFdmEsTUFBTSxDQUFFcVIsUUFBUSxDQUFDa0osV0FBVyxJQUFJLENBQUUsQ0FBRSxDQUFDO01BQ3BFLENBQUMsRUFBRSxDQUFFLENBQUM7TUFDTixJQUFJQyxzQkFBc0IsR0FBR2phLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztNQUNsRCxJQUFJaWEsZUFBZTtNQUVuQmxELHVCQUF1QixDQUFDL1AsTUFBTSxDQUFFcVMsZUFBZ0IsQ0FBQyxDQUFDMVgsT0FBTyxDQUFFLFVBQVdrUCxRQUFRLEVBQUc7UUFDaEZtSixzQkFBc0IsQ0FBRW5KLFFBQVEsQ0FBQytILFdBQVcsQ0FBRSxHQUFHL0gsUUFBUTtNQUMxRCxDQUFFLENBQUM7TUFDSG9KLGVBQWUsR0FBRzNMLFVBQVUsQ0FBQzRMLE9BQU8sQ0FBQ2pYLEdBQUcsQ0FBRSxVQUFXa1gsTUFBTSxFQUFHO1FBQzdELElBQUlDLGVBQWUsR0FBR0osc0JBQXNCLENBQUVHLE1BQU0sQ0FBQ3ZCLFdBQVcsQ0FBRTtRQUNsRSxJQUFJOUgsSUFBSSxHQUFHOEQsV0FBVyxDQUFFdUYsTUFBTSxDQUFDckosSUFBSSxDQUFFO1FBQ3JDLElBQUl1SixtQkFBbUIsR0FBRyxFQUFFO1FBQzVCLElBQUlDLFVBQVUsR0FBR0gsTUFBTSxDQUFDckosSUFBSSxJQUFJLGtCQUFrQixLQUFLcUosTUFBTSxDQUFDbEcsSUFBSSxHQUMvRDNFLGtCQUFrQixDQUFFNkssTUFBTSxDQUFDaFcsWUFBYSxDQUFDLEdBQUcsUUFBUSxHQUFHbUwsa0JBQWtCLENBQUU2SyxNQUFNLENBQUMvVixVQUFXLENBQUMsR0FDOUYsRUFBRTtRQUVMLElBQUtnVyxlQUFlLElBQUksZUFBZSxLQUFLRCxNQUFNLENBQUNsRyxJQUFJLEVBQUc7VUFDekRxRyxVQUFVLEdBQUcxSix3QkFBd0IsQ0FBRXdKLGVBQWUsRUFBRXRKLElBQUssQ0FBQztRQUMvRDtRQUNBLElBQUtzSixlQUFlLEtBQ25CQSxlQUFlLENBQUNiLGdCQUFnQixJQUM3QmEsZUFBZSxDQUFDN0IscUJBQXFCLElBQ3JDNkIsZUFBZSxDQUFDWix5QkFBeUIsSUFDekNZLGVBQWUsQ0FBQzVCLDhCQUE4QixDQUNqRCxFQUFHO1VBQ0g2QixtQkFBbUIsQ0FBQ2xQLElBQUksQ0FBRWhELElBQUksQ0FBQzJRLGdCQUFpQixDQUFDO1FBQ2xEO1FBQ0EsSUFBS3NCLGVBQWUsS0FDbkJBLGVBQWUsQ0FBQ1gsZ0JBQWdCLElBQzdCVyxlQUFlLENBQUMzQixvQkFBb0IsSUFDcEMyQixlQUFlLENBQUNWLHdCQUF3QixJQUN4Q1UsZUFBZSxDQUFDMUIsNkJBQTZCLENBQ2hELEVBQUc7VUFDSDJCLG1CQUFtQixDQUFDbFAsSUFBSSxDQUFFaEQsSUFBSSxDQUFDNFEsZUFBZ0IsQ0FBQztRQUNqRDtRQUNBLE9BQU9oWixNQUFNLENBQUNzSSxNQUFNLENBQUUsQ0FBQyxDQUFDLEVBQUU4UixNQUFNLEVBQUU7VUFDakMzRSxVQUFVLEVBQUV4QixzQkFBc0IsQ0FBRW1HLE1BQU0sQ0FBQ2xHLElBQUssQ0FBQztVQUNqRHFHLFVBQVUsRUFBRUEsVUFBVTtVQUN0Qi9DLFlBQVksRUFBRTZDLGVBQWUsR0FBRzVKLHdCQUF3QixDQUFFNEosZUFBZSxDQUFDalQsTUFBTyxDQUFDLEdBQUcsRUFBRTtVQUN2Rm9ULGtCQUFrQixFQUFFRixtQkFBbUIsQ0FBQ2pYLE1BQU0sQ0FBRXdCLE9BQVEsQ0FBQyxDQUFDcUYsSUFBSSxDQUFFLElBQUs7UUFDdEUsQ0FBRSxDQUFDO01BQ0osQ0FBRSxDQUFDO01BQ0g2SyxLQUFLLENBQUNuVCxPQUFPLENBQUUsVUFBV21QLElBQUksRUFBRztRQUNoQ0EsSUFBSSxDQUFDTyxVQUFVLENBQUMxUCxPQUFPLENBQUUsVUFBVzBULFVBQVUsRUFBRztVQUNoRDRFLGVBQWUsQ0FBQzlPLElBQUksQ0FBRTtZQUNyQnFQLFVBQVUsRUFBRSxjQUFjLEdBQUcxSixJQUFJLENBQUNBLElBQUksR0FBRyxHQUFHLEdBQUd1RSxVQUFVLENBQUNvRixhQUFhO1lBQ3ZFeEcsSUFBSSxFQUFFLGdCQUFnQjtZQUN0QnVCLFVBQVUsRUFBRXhCLHNCQUFzQixDQUFFLGdCQUFpQixDQUFDO1lBQ3REbEQsSUFBSSxFQUFFQSxJQUFJLENBQUNBLElBQUk7WUFDZjNNLFlBQVksRUFBRWtSLFVBQVUsQ0FBQ2xSLFlBQVk7WUFDckNDLFVBQVUsRUFBRWlSLFVBQVUsQ0FBQ2pSLFVBQVU7WUFDakNrVyxVQUFVLEVBQUVoTCxrQkFBa0IsQ0FBRStGLFVBQVUsQ0FBQ2xSLFlBQWEsQ0FBQyxHQUFHLFFBQVEsR0FBR21MLGtCQUFrQixDQUFFK0YsVUFBVSxDQUFDalIsVUFBVyxDQUFDO1lBQ2xITSxLQUFLLEVBQUUyUSxVQUFVLENBQUMzUSxLQUFLO1lBQ3ZCNlMsWUFBWSxFQUFFLEVBQUU7WUFDaEJnRCxrQkFBa0IsRUFBRTtVQUNyQixDQUFFLENBQUM7UUFDSixDQUFFLENBQUM7TUFDSixDQUFFLENBQUM7TUFDSE4sZUFBZSxDQUFDNVcsSUFBSSxDQUFFLFVBQVcyVixJQUFJLEVBQUVDLEtBQUssRUFBRztRQUM5QyxJQUFLLENBQUVELElBQUksQ0FBQ2xJLElBQUksSUFBSSxDQUFFbUksS0FBSyxDQUFDbkksSUFBSSxFQUFHO1VBQ2xDLE9BQU9uUixNQUFNLENBQUVxWixJQUFJLENBQUN3QixVQUFVLElBQUksRUFBRyxDQUFDLENBQUNFLGFBQWEsQ0FBRS9hLE1BQU0sQ0FBRXNaLEtBQUssQ0FBQ3VCLFVBQVUsSUFBSSxFQUFHLENBQUUsQ0FBQztRQUN6RjtRQUNBLElBQUssQ0FBRXhCLElBQUksQ0FBQ2xJLElBQUksRUFBRztVQUNsQixPQUFPLENBQUM7UUFDVDtRQUNBLElBQUssQ0FBRW1JLEtBQUssQ0FBQ25JLElBQUksRUFBRztVQUNuQixPQUFPLENBQUMsQ0FBQztRQUNWO1FBQ0EsT0FBT2tJLElBQUksQ0FBQ2xJLElBQUksQ0FBQzRKLGFBQWEsQ0FBRXpCLEtBQUssQ0FBQ25JLElBQUssQ0FBQyxJQUN4Q3RSLE1BQU0sQ0FBRXdaLElBQUksQ0FBQzdVLFlBQVksSUFBSSxDQUFFLENBQUMsR0FBRzNFLE1BQU0sQ0FBRXlaLEtBQUssQ0FBQzlVLFlBQVksSUFBSSxDQUFFLENBQUMsSUFDcEUzRSxNQUFNLENBQUV3WixJQUFJLENBQUM1VSxVQUFVLElBQUksQ0FBRSxDQUFDLEdBQUc1RSxNQUFNLENBQUV5WixLQUFLLENBQUM3VSxVQUFVLElBQUksQ0FBRSxDQUFDLElBQ2hFekUsTUFBTSxDQUFFcVosSUFBSSxDQUFDd0IsVUFBVSxJQUFJLEVBQUcsQ0FBQyxDQUFDRSxhQUFhLENBQUUvYSxNQUFNLENBQUVzWixLQUFLLENBQUN1QixVQUFVLElBQUksRUFBRyxDQUFFLENBQUM7TUFDdEYsQ0FBRSxDQUFDO01BRUg3VCxZQUFZLEdBQUdWLHNCQUFzQixDQUFFVSxZQUFhLENBQUM7TUFFckQsT0FBTztRQUNOdEUsY0FBYyxFQUFFN0MsTUFBTSxDQUFFTixhQUFhLENBQUNtRCxjQUFlLENBQUMsSUFBSSxDQUFDO1FBQzNEcUksU0FBUyxFQUFFNEQsVUFBVSxDQUFDNUQsU0FBUztRQUMvQmpKLFdBQVcsRUFBRTZNLFVBQVUsQ0FBQzdNLFdBQVc7UUFDbkNvSSxRQUFRLEVBQUV5RSxVQUFVLENBQUN6RSxRQUFRO1FBQzdCNEksS0FBSyxFQUFFMVMsTUFBTSxDQUFDc0ksTUFBTSxDQUFFLENBQUMsQ0FBQyxFQUFFaUcsVUFBVSxDQUFDbUUsS0FBSyxFQUFFO1VBQzNDL04sS0FBSyxFQUFFNEssa0JBQWtCLENBQUVoQixVQUFVLENBQUNtRSxLQUFLLENBQUN0TyxZQUFhLENBQUMsR0FBRyxHQUFHLEdBQUdtTCxrQkFBa0IsQ0FBRWhCLFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ3JPLFVBQVcsQ0FBQztVQUNwSHVXLFdBQVcsRUFBRXJMLGtCQUFrQixDQUFFaEIsVUFBVSxDQUFDbUUsS0FBSyxDQUFDdE8sWUFBYSxDQUFDO1VBQ2hFeVcsU0FBUyxFQUFFdEwsa0JBQWtCLENBQUVoQixVQUFVLENBQUNtRSxLQUFLLENBQUNyTyxVQUFXLENBQUM7VUFDNUR5VyxhQUFhLEVBQUVyYixNQUFNLENBQUUsQ0FBRSxHQUFHLEdBQUc4TyxVQUFVLENBQUNtRSxLQUFLLENBQUN0TyxZQUFZLEdBQUcsSUFBSSxFQUFHa1AsT0FBTyxDQUFFLENBQUUsQ0FBRSxDQUFDO1VBQ3BGeUgsV0FBVyxFQUFFdGIsTUFBTSxDQUFFLENBQUUsR0FBRyxHQUFHOE8sVUFBVSxDQUFDbUUsS0FBSyxDQUFDck8sVUFBVSxHQUFHLElBQUksRUFBR2lQLE9BQU8sQ0FBRSxDQUFFLENBQUUsQ0FBQztVQUNoRnhQLFlBQVksRUFBRTZRLGtCQUFrQjtVQUNoQ3FHLGdCQUFnQixFQUFFNUssaUJBQWlCLENBQUVoSSxJQUFJLENBQUM2UyxnQkFBZ0IsRUFBRTtZQUFFQyxJQUFJLEVBQUUzTCxrQkFBa0IsQ0FBRWhCLFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ3RPLFlBQWE7VUFBRSxDQUFFLENBQUM7VUFDM0grVyxjQUFjLEVBQUUvSyxpQkFBaUIsQ0FBRWhJLElBQUksQ0FBQ2dULGNBQWMsRUFBRTtZQUFFRixJQUFJLEVBQUUzTCxrQkFBa0IsQ0FBRWhCLFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ3JPLFVBQVc7VUFBRSxDQUFFLENBQUM7VUFDckhnWCxVQUFVLEVBQUVqTCxpQkFBaUIsQ0FBRWhJLElBQUksQ0FBQ2tULGdCQUFnQixFQUFFO1lBQ3JENUksS0FBSyxFQUFFbkQsa0JBQWtCLENBQUVoQixVQUFVLENBQUNtRSxLQUFLLENBQUN0TyxZQUFhLENBQUMsR0FBRyxHQUFHLEdBQUdtTCxrQkFBa0IsQ0FBRWhCLFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ3JPLFVBQVc7VUFDcEgsQ0FBRSxDQUFDO1VBQ0hrWCxPQUFPLEVBQUVqWCxzQkFBc0IsQ0FBQyxDQUFDLENBQUNwQixHQUFHLENBQUUsVUFBV3NCLE1BQU0sRUFBRztZQUMxRCxPQUFPeEUsTUFBTSxDQUFDc0ksTUFBTSxDQUFFLENBQUMsQ0FBQyxFQUFFOUQsTUFBTSxFQUFFO2NBQ2pDZ1gsU0FBUyxFQUFFLENBQUMsQ0FBRTVHLHFCQUFxQixJQUFJQSxxQkFBcUIsQ0FBQ3hSLEVBQUUsS0FBS29CLE1BQU0sQ0FBQ3BCO1lBQzVFLENBQUUsQ0FBQztVQUNKLENBQUU7UUFDSCxDQUFFLENBQUM7UUFDSCtDLElBQUksRUFBRTtVQUNMc1YsT0FBTyxFQUFFN1UsWUFBWTtVQUNyQm5CLFdBQVcsRUFBRVUsSUFBSSxDQUFDVixXQUFXO1VBQzdCQyxXQUFXLEVBQUVTLElBQUksQ0FBQ1QsV0FBVztVQUM3QkMsWUFBWSxFQUFFUSxJQUFJLENBQUNSLFlBQVk7VUFDL0JoQixLQUFLLEVBQUV5TCxpQkFBaUIsQ0FBRWhJLElBQUksQ0FBQ3NULGVBQWUsRUFBRTtZQUFFRCxPQUFPLEVBQUU3VTtVQUFhLENBQUU7UUFDM0UsQ0FBQztRQUNEK1UsY0FBYyxFQUFFcmMsSUFBSSxDQUFDQyxHQUFHLENBQUU0RyxJQUFJLENBQUNILHNCQUFzQixFQUFFMUcsSUFBSSxDQUFDMEUsS0FBSyxDQUFFdUssVUFBVSxDQUFDbUUsS0FBSyxDQUFDVyxZQUFZLEdBQUcsRUFBRSxHQUFHbE4sSUFBSSxDQUFDTCxjQUFjLEdBQUdjLFlBQVksR0FBRyxHQUFJLENBQUUsQ0FBQztRQUNwSmdWLGlCQUFpQixFQUFFdGMsSUFBSSxDQUFDQyxHQUFHLENBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUd1YSxtQkFBb0IsQ0FBQztRQUNoRStCLFVBQVUsRUFBRXBKLGdCQUFnQixDQUFFbEUsVUFBVSxDQUFDbUUsS0FBTSxDQUFDO1FBQ2hEcUMsS0FBSyxFQUFFQSxLQUFLO1FBQ1prQyxrQkFBa0IsRUFBRUEsa0JBQWtCO1FBQ3RDcUMsZUFBZSxFQUFFQSxlQUFlO1FBQ2hDd0MsZUFBZSxFQUFFdk4sVUFBVSxDQUFDdU4sZUFBZSxDQUFDNVksR0FBRyxDQUFFLFVBQVc2WSxRQUFRLEVBQUc7VUFDdEUsSUFBSWhMLElBQUksR0FBRzhELFdBQVcsQ0FBRWtILFFBQVEsQ0FBQ2hMLElBQUksQ0FBRTtVQUN2QyxJQUFJaUwsT0FBTyxHQUFHRCxRQUFRLENBQUNuRCxZQUFZLENBQUMxVixHQUFHLENBQUUsVUFBVzJWLFdBQVcsRUFBRztZQUNqRSxPQUFPZ0Isb0JBQW9CLENBQUVoQixXQUFXLENBQUU7VUFDM0MsQ0FBRSxDQUFDLENBQUN4VixNQUFNLENBQUV3QixPQUFRLENBQUM7VUFDckIsT0FBTzdFLE1BQU0sQ0FBQ3NJLE1BQU0sQ0FBRSxDQUFDLENBQUMsRUFBRXlULFFBQVEsRUFBRTtZQUNuQzNFLFlBQVksRUFBRXJHLElBQUksR0FBR0EsSUFBSSxDQUFDcUMsY0FBYyxHQUFHLElBQUksR0FBR3JDLElBQUksQ0FBQ3NHLGFBQWEsR0FBRyxDQUFDO1lBQ3hFQSxhQUFhLEVBQUV0RyxJQUFJLEdBQUcsR0FBRyxHQUFHQSxJQUFJLENBQUNzRyxhQUFhLEdBQUcsQ0FBQztZQUNsRHJCLFdBQVcsRUFBRXZXLE1BQU0sQ0FBRSxDQUFFLEdBQUcsSUFBS3NjLFFBQVEsQ0FBQ0UsaUJBQWlCLEdBQUcxTixVQUFVLENBQUNtRSxLQUFLLENBQUN0TyxZQUFZLENBQUUsR0FBR21LLFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ1csWUFBWSxFQUFHQyxPQUFPLENBQUUsQ0FBRSxDQUFFLENBQUM7WUFDNUkwSSxPQUFPLEVBQUVBLE9BQU87WUFDaEJwWCxVQUFVLEVBQUV3TCxpQkFBaUIsQ0FBRWhJLElBQUksQ0FBQzhULGFBQWEsRUFBRTtjQUFFQyxLQUFLLEVBQUVILE9BQU8sQ0FBQ3ZTO1lBQU8sQ0FBRTtVQUM5RSxDQUFFLENBQUM7UUFDSixDQUFFLENBQUM7UUFDSDJTLG1CQUFtQixFQUFFN04sVUFBVSxDQUFDVCxZQUFZLENBQUN1TyxNQUFNLENBQUNuWixHQUFHLENBQUUsVUFBV21KLEtBQUssRUFBRztVQUMzRSxJQUFJMEUsSUFBSSxHQUFHOEQsV0FBVyxDQUFFeEksS0FBSyxDQUFDMEUsSUFBSSxDQUFFO1VBQ3BDLE9BQU8vUSxNQUFNLENBQUNzSSxNQUFNLENBQUUsQ0FBQyxDQUFDLEVBQUUrRCxLQUFLLEVBQUU7WUFDaEMrSyxZQUFZLEVBQUVyRyxJQUFJLEdBQUdBLElBQUksQ0FBQ3FDLGNBQWMsR0FBRyxDQUFDO1lBQzVDaUUsYUFBYSxFQUFFdEcsSUFBSSxHQUFHQSxJQUFJLENBQUNzRyxhQUFhLEdBQUcsQ0FBQztZQUM1Q2lGLFNBQVMsRUFBRS9JLDBCQUEwQixDQUFFbEgsS0FBSyxDQUFDa1EsY0FBZSxDQUFDO1lBQzdENVgsS0FBSyxFQUFFMEgsS0FBSyxDQUFDbVEsYUFBYSxDQUFDdFMsSUFBSSxDQUFFLElBQUssQ0FBQyxJQUFJOUIsSUFBSSxDQUFDcVU7VUFDakQsQ0FBRSxDQUFDO1FBQ0osQ0FBRSxDQUFDO1FBQ0gxYixrQkFBa0IsRUFBRTtVQUNuQmdILEtBQUssRUFBRXdHLFVBQVUsQ0FBQ1QsWUFBWSxDQUFDL0YsS0FBSztVQUNwQ1osT0FBTyxFQUFFLFNBQVMsS0FBS29ILFVBQVUsQ0FBQ1QsWUFBWSxDQUFDL0YsS0FBSyxHQUNqREssSUFBSSxDQUFDc1Usb0JBQW9CLEdBQ3ZCLFFBQVEsS0FBS25PLFVBQVUsQ0FBQ1QsWUFBWSxDQUFDL0YsS0FBSyxHQUFHSyxJQUFJLENBQUN1VSxtQkFBbUIsR0FBR3ZVLElBQUksQ0FBQ3dVO1FBQ25GLENBQUM7UUFDRDFDLGVBQWUsRUFBRUEsZUFBZTtRQUNoQzlSLElBQUksRUFBRUEsSUFBSTtRQUNWME0sYUFBYSxFQUFFQSxhQUFhO1FBQzVCK0gsZ0JBQWdCLEVBQUV0VyxtQkFBbUIsQ0FBRWdJLFVBQVUsQ0FBQzdNLFdBQVk7TUFDL0QsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLGlCQUFpQkEsQ0FBRUQsV0FBVyxFQUFHO01BQ3pDLElBQUlVLEtBQUssR0FBR2xELEtBQUssR0FBR0EsS0FBSyxDQUFDNGQsZ0JBQWdCLENBQUUsNENBQTZDLENBQUMsR0FBRyxFQUFFO01BRS9GLE9BQU85WixLQUFLLENBQUMrWixTQUFTLENBQUMxWixNQUFNLENBQUMyWixJQUFJLENBQUU1YSxLQUFLLEVBQUUsVUFBV1AsSUFBSSxFQUFHO1FBQzVELE9BQU9wQyxNQUFNLENBQUVvQyxJQUFJLENBQUNvYixZQUFZLENBQUUsZ0NBQWlDLENBQUUsQ0FBQyxLQUFLeGQsTUFBTSxDQUFFaUMsV0FBWSxDQUFDLElBQzVGL0IsZUFBZSxLQUFLQyxNQUFNLENBQUVpQyxJQUFJLENBQUNvYixZQUFZLENBQUUsMENBQTJDLENBQUMsSUFBSSxFQUFHLENBQUM7TUFDeEcsQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxrQ0FBa0NBLENBQUVDLFlBQVksRUFBRUMsS0FBSyxFQUFHO01BQ2xFLElBQUlDLGNBQWMsR0FBR3hlLE1BQU0sQ0FBQ3llLHFCQUFxQjtNQUNqRCxJQUFJQyxvQkFBb0IsR0FBR0YsY0FBYyxJQUFJLFVBQVUsS0FBSyxPQUFPQSxjQUFjLENBQUNHLFlBQVksR0FDM0ZILGNBQWMsQ0FBQ0csWUFBWSxDQUFFLG9DQUFxQyxDQUFDLEdBQ25FLElBQUk7TUFDUCxJQUFJQyxrQkFBa0IsR0FBR3pkLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FBQztNQUM5QyxJQUFJeWQsbUJBQW1CLEdBQUdDLGdDQUFnQyxDQUFFUCxLQUFLLENBQUMxYixXQUFZLENBQUM7TUFDL0UsSUFBSWtjLGVBQWU7TUFFbkIsSUFBSyxDQUFFTCxvQkFBb0IsSUFBSSxDQUFFRyxtQkFBbUIsSUFBSSxVQUFVLEtBQUssT0FBT0gsb0JBQW9CLENBQUNNLDBCQUEwQixFQUFHO1FBQy9IO01BQ0Q7TUFDQUQsZUFBZSxHQUFHO1FBQ2pCamUsZUFBZSxFQUFFQSxlQUFlO1FBQ2hDK0IsV0FBVyxFQUFFakMsTUFBTSxDQUFFMmQsS0FBSyxDQUFDMWIsV0FBWSxDQUFDO1FBQ3hDaUosU0FBUyxFQUFFL0ssTUFBTSxDQUFFOGQsbUJBQW1CLENBQUMvUyxTQUFTLElBQUksRUFBRyxDQUFDO1FBQ3hEbVQsaUJBQWlCLEVBQUVKLG1CQUFtQixDQUFDSSxpQkFBaUIsSUFBSSxDQUFDLENBQUM7UUFDOURDLGFBQWEsRUFBRUwsbUJBQW1CLENBQUNLLGFBQWEsSUFBSSxDQUFDLENBQUM7UUFDdERuWCxZQUFZLEVBQUVuSCxNQUFNLENBQUVpZSxtQkFBbUIsQ0FBQzlXLFlBQVksSUFBSSxDQUFFO01BQzdELENBQUM7TUFDRCxJQUFLLFVBQVUsS0FBSyxPQUFPMlcsb0JBQW9CLENBQUNTLHVCQUF1QixFQUFHO1FBQ3pFVCxvQkFBb0IsQ0FBQ1MsdUJBQXVCLENBQUVKLGVBQWdCLENBQUM7TUFDaEU7TUFDQVIsS0FBSyxDQUFDdEksYUFBYSxDQUFDbFQsT0FBTyxDQUFFLFVBQVdxYyxZQUFZLEVBQUc7UUFDdERSLGtCQUFrQixDQUFFUSxZQUFZLENBQUN4SCxpQkFBaUIsQ0FBRSxHQUFHd0gsWUFBWTtNQUNwRSxDQUFFLENBQUM7TUFDSGQsWUFBWSxDQUFDdmIsT0FBTyxDQUFFLFVBQVdDLElBQUksRUFBRztRQUN2QyxJQUFJcWMsS0FBSyxHQUFHcmMsSUFBSSxJQUFJQSxJQUFJLENBQUNpYixnQkFBZ0IsR0FBR2piLElBQUksQ0FBQ2liLGdCQUFnQixDQUFFLDBDQUEyQyxDQUFDLEdBQUcsRUFBRTtRQUVwSDlaLEtBQUssQ0FBQytaLFNBQVMsQ0FBQ25iLE9BQU8sQ0FBQ29iLElBQUksQ0FBRWtCLEtBQUssRUFBRSxVQUFXQyxJQUFJLEVBQUc7VUFDdEQsSUFBSTFILGlCQUFpQixHQUFHN1csTUFBTSxDQUFFdWUsSUFBSSxDQUFDbEIsWUFBWSxDQUFFLCtCQUFnQyxDQUFDLElBQUksRUFBRyxDQUFDO1VBQzVGLElBQUlnQixZQUFZLEdBQUdSLGtCQUFrQixDQUFFaEgsaUJBQWlCLENBQUU7VUFFMUQsSUFBS3dILFlBQVksRUFBRztZQUNuQlYsb0JBQW9CLENBQUNNLDBCQUEwQixDQUM5Q00sSUFBSSxFQUNKRixZQUFZLENBQUN0USxPQUFPLEVBQ3BCeVAsS0FBSyxDQUFDUCxnQkFBZ0IsRUFDdEI3YyxNQUFNLENBQUNzSSxNQUFNLENBQUUsQ0FBQyxDQUFDLEVBQUVzVixlQUFlLEVBQUU7Y0FDbkNuSCxpQkFBaUIsRUFBRUEsaUJBQWlCO2NBQ3BDQyxhQUFhLEVBQUV1SCxZQUFZLENBQUN2SCxhQUFhO2NBQ3pDSCxnQkFBZ0IsRUFBRTBILFlBQVksQ0FBQzFILGdCQUFnQjtjQUMvQ0ksbUJBQW1CLEVBQUVzSCxZQUFZLENBQUN0SDtZQUNuQyxDQUFFLENBQ0gsQ0FBQztVQUNGO1FBQ0QsQ0FBRSxDQUFDO01BQ0osQ0FBRSxDQUFDO01BQ0gsSUFBSyxVQUFVLEtBQUssT0FBTzRHLG9CQUFvQixDQUFDYSwwQkFBMEIsRUFBRztRQUM1RWIsb0JBQW9CLENBQUNhLDBCQUEwQixDQUFFUixlQUFnQixDQUFDO01BQ25FO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTUyxhQUFhQSxDQUFFM2MsV0FBVyxFQUFFaUosU0FBUyxFQUFHO01BQ2hELElBQUkyVCxjQUFjO01BRWxCLElBQUssQ0FBRXBmLEtBQUssSUFBSSxVQUFVLEtBQUssT0FBT0EsS0FBSyxDQUFDcWYsYUFBYSxJQUFJLFVBQVUsS0FBSyxPQUFPMWYsTUFBTSxDQUFDMmYsV0FBVyxFQUFHO1FBQ3ZHO01BQ0Q7TUFDQUYsY0FBYyxHQUFHLElBQUl6ZixNQUFNLENBQUMyZixXQUFXLENBQUUseUNBQXlDLEVBQUU7UUFDbkZuYyxNQUFNLEVBQUU7VUFDUFgsV0FBVyxFQUFFakMsTUFBTSxDQUFFaUMsV0FBWSxDQUFDO1VBQ2xDL0IsZUFBZSxFQUFFQSxlQUFlO1VBQ2hDZ0wsU0FBUyxFQUFFL0ssTUFBTSxDQUFFK0ssU0FBUyxJQUFJLEVBQUc7UUFDcEM7TUFDRCxDQUFFLENBQUM7TUFDSHpMLEtBQUssQ0FBQ3FmLGFBQWEsQ0FBRUQsY0FBZSxDQUFDO0lBQ3RDOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0csd0NBQXdDQSxDQUFFL2MsV0FBVyxFQUFFZ2QsY0FBYyxFQUFHO01BQ2hGLElBQUlDLGNBQWMsR0FBR3ZNLFlBQVksQ0FBRSxPQUFRLENBQUM7TUFDNUMsSUFBSXdNLGlCQUFpQixHQUFHbGUsbUJBQW1CLENBQUVqQixNQUFNLENBQUVpQyxXQUFZLENBQUMsQ0FBRTtNQUNwRSxJQUFJbWQsa0JBQWtCLEdBQUdILGNBQWMsS0FBTSxDQUFFdmQsaUNBQWlDLElBQUl5ZCxpQkFBaUIsSUFBSUEsaUJBQWlCLENBQUNyUSxVQUFVLEdBQ2xJbUcsd0JBQXdCLENBQUVrSyxpQkFBaUIsQ0FBQ3JRLFVBQVUsRUFBRWxJLHlCQUF5QixDQUFFM0UsV0FBWSxDQUFFLENBQUMsR0FDbEcsSUFBSSxDQUFFO01BRVRDLGlCQUFpQixDQUFFRCxXQUFZLENBQUMsQ0FBQ0UsT0FBTyxDQUFFLFVBQVdDLElBQUksRUFBRztRQUMzRCxJQUFJaWQsS0FBSyxHQUFHamQsSUFBSSxJQUFJQSxJQUFJLENBQUN3RixhQUFhLEdBQUd4RixJQUFJLENBQUN3RixhQUFhLENBQUUsc0NBQXVDLENBQUMsR0FBRyxJQUFJO1FBQzVHLElBQUkwWCxVQUFVLEdBQUdsZCxJQUFJLElBQUlBLElBQUksQ0FBQ3dGLGFBQWEsR0FBR3hGLElBQUksQ0FBQ3dGLGFBQWEsQ0FBRSwyQ0FBNEMsQ0FBQyxHQUFHLElBQUk7UUFFdEgsSUFBSyxDQUFFeVgsS0FBSyxFQUFHO1VBQ2Q7UUFDRDtRQUNBLElBQUszZCxpQ0FBaUMsRUFBRztVQUN4QyxJQUFLLFVBQVUsS0FBSyxPQUFPMmQsS0FBSyxDQUFDRSxZQUFZLEVBQUc7WUFDL0NGLEtBQUssQ0FBQ0UsWUFBWSxDQUFFLFdBQVcsRUFBRSxNQUFPLENBQUM7WUFDekNGLEtBQUssQ0FBQ0UsWUFBWSxDQUFFLHlDQUF5QyxFQUFFLE1BQU8sQ0FBQztVQUN4RTtVQUNBLElBQUtELFVBQVUsSUFBSUosY0FBYyxFQUFHO1lBQ25DSSxVQUFVLENBQUNFLFNBQVMsR0FBR04sY0FBYyxDQUFFO2NBQ3RDNVcsS0FBSyxFQUFFLFlBQVk7Y0FDbkJaLE9BQU8sRUFBRXZILE1BQU0sQ0FBRVQsYUFBYSxDQUFDaUosSUFBSSxJQUFJakosYUFBYSxDQUFDaUosSUFBSSxDQUFDOFcsVUFBVSxJQUFJLEVBQUc7WUFDNUUsQ0FBRSxDQUFDO1VBQ0o7VUFDQTtRQUNEO1FBQ0EsSUFBSyxVQUFVLEtBQUssT0FBT0osS0FBSyxDQUFDSyxlQUFlLEVBQUc7VUFDbERMLEtBQUssQ0FBQ0ssZUFBZSxDQUFFLFdBQVksQ0FBQztVQUNwQ0wsS0FBSyxDQUFDSyxlQUFlLENBQUUseUNBQTBDLENBQUM7UUFDbkU7UUFDQSxJQUFLSixVQUFVLElBQUlKLGNBQWMsSUFBSUUsa0JBQWtCLEVBQUc7VUFDekRFLFVBQVUsQ0FBQ0UsU0FBUyxHQUFHTixjQUFjLENBQUVFLGtCQUFrQixDQUFDOWQsa0JBQW1CLENBQUM7UUFDL0U7TUFDRCxDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNxZSxlQUFlQSxDQUFFMWQsV0FBVyxFQUFFMmQsY0FBYyxFQUFHO01BQ3ZELElBQUlqZCxLQUFLLEdBQUdZLEtBQUssQ0FBQ0MsT0FBTyxDQUFFb2MsY0FBZSxDQUFDLElBQUlBLGNBQWMsQ0FBQzVWLE1BQU0sR0FBRzRWLGNBQWMsR0FBRzFkLGlCQUFpQixDQUFFRCxXQUFZLENBQUM7TUFDeEgsSUFBSTRkLGlCQUFpQixHQUFHbE4sWUFBWSxDQUFFLFVBQVcsQ0FBQztNQUNsRCxJQUFJbU4sZUFBZSxHQUFHbk4sWUFBWSxDQUFFLFFBQVMsQ0FBQztNQUM5QyxJQUFJdU0sY0FBYyxHQUFHdk0sWUFBWSxDQUFFLE9BQVEsQ0FBQztNQUM1QyxJQUFJb04sZ0JBQWdCLEdBQUdwTixZQUFZLENBQUUsU0FBVSxDQUFDO01BQ2hELElBQUk3RCxVQUFVO01BQ2QsSUFBSTZPLEtBQUs7TUFDVCxJQUFJRCxZQUFZLEdBQUcsRUFBRTtNQUVyQixJQUFLLENBQUVqZCxpQkFBaUIsQ0FBRVQsTUFBTSxDQUFFaUMsV0FBWSxDQUFDLENBQUUsSUFBSSxDQUFFNGQsaUJBQWlCLElBQUksQ0FBRUMsZUFBZSxJQUFJLENBQUVaLGNBQWMsSUFBSSxDQUFFYSxnQkFBZ0IsSUFBSSxDQUFFcGQsS0FBSyxDQUFDcUgsTUFBTSxFQUFHO1FBQzNKLE9BQU8sS0FBSztNQUNiO01BQ0E4RSxVQUFVLEdBQUdFLGdCQUFnQixDQUFFaFAsTUFBTSxDQUFFaUMsV0FBWSxDQUFDLEVBQUV1RCx5QkFBeUIsQ0FBRXZELFdBQVksQ0FBRSxDQUFDO01BQ2hHLElBQUssQ0FBRTZNLFVBQVUsRUFBRztRQUNuQixPQUFPLEtBQUs7TUFDYjtNQUNBNk8sS0FBSyxHQUFHMUksd0JBQXdCLENBQUVuRyxVQUFVLEVBQUVsSSx5QkFBeUIsQ0FBRTNFLFdBQVksQ0FBRSxDQUFDO01BQ3hGVSxLQUFLLENBQUNSLE9BQU8sQ0FBRSxVQUFXQyxJQUFJLEVBQUc7UUFDaEMsSUFBSTRkLElBQUksR0FBRzdmLE1BQU0sQ0FBRWlDLElBQUksQ0FBQ29iLFlBQVksQ0FBRSwwQ0FBMkMsQ0FBQyxJQUFJLEVBQUcsQ0FBQztRQUUxRixJQUFLLFVBQVUsS0FBS3dDLElBQUksRUFBRztVQUMxQjVkLElBQUksQ0FBQ29kLFNBQVMsR0FBR0ssaUJBQWlCLENBQUVsQyxLQUFNLENBQUM7VUFDM0M7UUFDRDtRQUNBLElBQUssUUFBUSxLQUFLcUMsSUFBSSxFQUFHO1VBQ3hCO1FBQ0Q7UUFDQTVkLElBQUksQ0FBQ29kLFNBQVMsR0FBR00sZUFBZSxDQUFFbkMsS0FBTSxDQUFDO1FBQ3pDRCxZQUFZLENBQUMvUixJQUFJLENBQUV2SixJQUFLLENBQUM7UUFDekIsSUFBS0EsSUFBSSxDQUFDd0YsYUFBYSxFQUFHO1VBQ3pCLElBQUkwWCxVQUFVLEdBQUdsZCxJQUFJLENBQUN3RixhQUFhLENBQUUsMkNBQTRDLENBQUM7VUFDbEYsSUFBSXFZLFlBQVksR0FBRzdkLElBQUksQ0FBQ3dGLGFBQWEsQ0FBRSw2Q0FBOEMsQ0FBQztVQUV0RixJQUFLMFgsVUFBVSxFQUFHO1lBQ2pCQSxVQUFVLENBQUNFLFNBQVMsR0FBR04sY0FBYyxDQUFFdkIsS0FBSyxDQUFDcmMsa0JBQW1CLENBQUM7VUFDbEU7VUFDQSxJQUFLMmUsWUFBWSxFQUFHO1lBQ25CQSxZQUFZLENBQUNULFNBQVMsR0FBR08sZ0JBQWdCLENBQUU7Y0FDMUM5ZCxXQUFXLEVBQUUwYixLQUFLLENBQUMxYixXQUFXO2NBQzlCc2EsT0FBTyxFQUFFb0IsS0FBSyxDQUFDbEQsZUFBZTtjQUM5QjlSLElBQUksRUFBRWdWLEtBQUssQ0FBQ2hWO1lBQ2IsQ0FBRSxDQUFDO1VBQ0o7UUFDRDtNQUNELENBQUUsQ0FBQztNQUNIOFUsa0NBQWtDLENBQUVDLFlBQVksRUFBRUMsS0FBTSxDQUFDO01BQ3pEcUIsd0NBQXdDLENBQUUvYyxXQUFXLEVBQUUwYixLQUFNLENBQUM7TUFDOURpQixhQUFhLENBQUUzYyxXQUFXLEVBQUU2TSxVQUFVLENBQUM1RCxTQUFVLENBQUM7TUFFbEQsT0FBTyxDQUFDLEdBQUd3UyxZQUFZLENBQUMxVCxNQUFNLElBQUlySCxLQUFLLENBQUNxSCxNQUFNLEdBQUcwVCxZQUFZLENBQUMxVCxNQUFNO0lBQ3JFOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTa1cscUJBQXFCQSxDQUFBLEVBQUc7TUFDaEMzZixNQUFNLENBQUMwSyxJQUFJLENBQUV4SyxpQkFBa0IsQ0FBQyxDQUFDMEIsT0FBTyxDQUFFLFVBQVdGLFdBQVcsRUFBRztRQUNsRTBkLGVBQWUsQ0FBRTNmLE1BQU0sQ0FBRWlDLFdBQVksQ0FBRSxDQUFDO01BQ3pDLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNrZSw2QkFBNkJBLENBQUUvUyxxQkFBcUIsRUFBRztNQUMvRCxJQUFJZ1QscUJBQXFCLEdBQUd6TixZQUFZLENBQUUsY0FBZSxDQUFDO01BQzFELElBQUl1TSxjQUFjLEdBQUd2TSxZQUFZLENBQUUsT0FBUSxDQUFDO01BQzVDLElBQUlvTixnQkFBZ0IsR0FBR3BOLFlBQVksQ0FBRSxTQUFVLENBQUM7TUFDaEQsSUFBSTBOLG1CQUFtQixHQUFHamQsc0JBQXNCLENBQUVnSyxxQkFBc0IsQ0FBQztNQUV6RSxJQUFLLENBQUVnVCxxQkFBcUIsSUFBSSxDQUFFbEIsY0FBYyxJQUFJLENBQUVhLGdCQUFnQixFQUFHO1FBQ3hFO01BQ0Q7TUFDQSxJQUFLLENBQUVNLG1CQUFtQixDQUFDclcsTUFBTSxFQUFHO1FBQ25DcVcsbUJBQW1CLEdBQUc5ZixNQUFNLENBQUMwSyxJQUFJLENBQUV4SyxpQkFBa0IsQ0FBQyxDQUFDZ0QsR0FBRyxDQUFFekQsTUFBTyxDQUFDO01BQ3JFO01BQ0FxZ0IsbUJBQW1CLENBQUNsZSxPQUFPLENBQUUsVUFBV0YsV0FBVyxFQUFHO1FBQ3JELElBQUk2TSxVQUFVO1FBQ2QsSUFBSTZPLEtBQUs7UUFFVCxJQUFLLENBQUVsZCxpQkFBaUIsQ0FBRXdCLFdBQVcsQ0FBRSxFQUFHO1VBQ3pDO1FBQ0Q7UUFDQTZNLFVBQVUsR0FBR0UsZ0JBQWdCLENBQUUvTSxXQUFXLEVBQUV1RCx5QkFBeUIsQ0FBRXZELFdBQVksQ0FBRSxDQUFDO1FBQ3RGLElBQUssQ0FBRTZNLFVBQVUsRUFBRztVQUNuQjtRQUNEO1FBQ0E2TyxLQUFLLEdBQUcxSSx3QkFBd0IsQ0FBRW5HLFVBQVUsRUFBRWxJLHlCQUF5QixDQUFFM0UsV0FBWSxDQUFFLENBQUM7UUFDeEZDLGlCQUFpQixDQUFFRCxXQUFZLENBQUMsQ0FBQ0UsT0FBTyxDQUFFLFVBQVdDLElBQUksRUFBRztVQUMzRCxJQUFJNGQsSUFBSSxHQUFHN2YsTUFBTSxDQUFFaUMsSUFBSSxDQUFDb2IsWUFBWSxDQUFFLDBDQUEyQyxDQUFDLElBQUksRUFBRyxDQUFDO1VBQzFGLElBQUk2QixLQUFLO1VBQ1QsSUFBSWlCLGlCQUFpQjtVQUNyQixJQUFJaEIsVUFBVTtVQUNkLElBQUlXLFlBQVk7VUFFaEIsSUFBSyxDQUFFN2QsSUFBSSxDQUFDd0YsYUFBYSxFQUFHO1lBQzNCO1VBQ0Q7VUFDQXlYLEtBQUssR0FBR2pkLElBQUksQ0FBQ3dGLGFBQWEsQ0FBRSxzQ0FBdUMsQ0FBQztVQUNwRSxJQUFLeVgsS0FBSyxJQUFJLFVBQVUsS0FBSyxPQUFPQSxLQUFLLENBQUNFLFlBQVksRUFBRztZQUN4RDtBQUNOO0FBQ0E7QUFDQTtBQUNBO1lBQ01GLEtBQUssQ0FBQ0UsWUFBWSxDQUNqQix3Q0FBd0MsRUFDeENwZixNQUFNLENBQUUyTyxVQUFVLENBQUM1RCxTQUFTLElBQUksRUFBRyxDQUNwQyxDQUFDO1VBQ0Y7VUFDQSxJQUFLLFFBQVEsS0FBSzhVLElBQUksRUFBRztZQUN4QjtVQUNEO1VBQ0FNLGlCQUFpQixHQUFHbGUsSUFBSSxDQUFDd0YsYUFBYSxDQUFFLGtEQUFtRCxDQUFDO1VBQzVGMFgsVUFBVSxHQUFHbGQsSUFBSSxDQUFDd0YsYUFBYSxDQUFFLDJDQUE0QyxDQUFDO1VBQzlFcVksWUFBWSxHQUFHN2QsSUFBSSxDQUFDd0YsYUFBYSxDQUFFLDZDQUE4QyxDQUFDO1VBQ2xGLElBQUswWSxpQkFBaUIsRUFBRztZQUN4QkEsaUJBQWlCLENBQUNkLFNBQVMsR0FBR1kscUJBQXFCLENBQUV6QyxLQUFNLENBQUM7VUFDN0Q7VUFDQSxJQUFLMkIsVUFBVSxFQUFHO1lBQ2pCQSxVQUFVLENBQUNFLFNBQVMsR0FBR04sY0FBYyxDQUFFdkIsS0FBSyxDQUFDcmMsa0JBQW1CLENBQUM7VUFDbEU7VUFDQSxJQUFLMmUsWUFBWSxFQUFHO1lBQ25CQSxZQUFZLENBQUNULFNBQVMsR0FBR08sZ0JBQWdCLENBQUU7Y0FDMUM5ZCxXQUFXLEVBQUUwYixLQUFLLENBQUMxYixXQUFXO2NBQzlCc2EsT0FBTyxFQUFFb0IsS0FBSyxDQUFDbEQsZUFBZTtjQUM5QjlSLElBQUksRUFBRWdWLEtBQUssQ0FBQ2hWO1lBQ2IsQ0FBRSxDQUFDO1VBQ0o7UUFDRCxDQUFFLENBQUM7UUFDSHFXLHdDQUF3QyxDQUFFL2MsV0FBVyxFQUFFMGIsS0FBTSxDQUFDO1FBQzlEaUIsYUFBYSxDQUFFM2MsV0FBVyxFQUFFNk0sVUFBVSxDQUFDNUQsU0FBVSxDQUFDO01BQ25ELENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNRLDJCQUEyQkEsQ0FBRXpKLFdBQVcsRUFBRztNQUNuRCxJQUFJc2UsTUFBTSxHQUFHLEdBQUcsR0FBR3ZnQixNQUFNLENBQUVpQyxXQUFZLENBQUM7TUFFeEMxQixNQUFNLENBQUMwSyxJQUFJLENBQUVsSyx1QkFBd0IsQ0FBQyxDQUFDb0IsT0FBTyxDQUFFLFVBQVcrSSxTQUFTLEVBQUc7UUFDdEUsSUFBS0EsU0FBUyxDQUFDMEIsS0FBSyxDQUFFLENBQUMyVCxNQUFNLENBQUN2VyxNQUFPLENBQUMsS0FBS3VXLE1BQU0sRUFBRztVQUNuRCxPQUFPeGYsdUJBQXVCLENBQUVtSyxTQUFTLENBQUU7UUFDNUM7TUFDRCxDQUFFLENBQUM7TUFDSDNLLE1BQU0sQ0FBQzBLLElBQUksQ0FBRWpLLGdCQUFpQixDQUFDLENBQUNtQixPQUFPLENBQUUsVUFBVzJILFVBQVUsRUFBRztRQUNoRSxPQUFPOUksZ0JBQWdCLENBQUU4SSxVQUFVLENBQUUsQ0FBRTlKLE1BQU0sQ0FBRWlDLFdBQVksQ0FBQyxDQUFFO1FBQzlELElBQUssQ0FBRTFCLE1BQU0sQ0FBQzBLLElBQUksQ0FBRWpLLGdCQUFnQixDQUFFOEksVUFBVSxDQUFHLENBQUMsQ0FBQ0UsTUFBTSxFQUFHO1VBQzdELE9BQU9oSixnQkFBZ0IsQ0FBRThJLFVBQVUsQ0FBRTtRQUN0QztNQUNELENBQUUsQ0FBQztNQUNILE9BQU83SSxtQkFBbUIsQ0FBRWpCLE1BQU0sQ0FBRWlDLFdBQVksQ0FBQyxDQUFFO0lBQ3BEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN1ZSwrQkFBK0JBLENBQUUvZCxLQUFLLEVBQUc7TUFDakQsSUFDQ21KLHNCQUFzQixDQUFFbkosS0FBSyxJQUFJQSxLQUFLLENBQUNHLE1BQU0sR0FBR0gsS0FBSyxDQUFDRyxNQUFNLEdBQUcsQ0FBQyxDQUFFLENBQUMsSUFDaEVqQix1QkFBdUIsSUFDdkJBLHVCQUF1QixDQUFDa0wscUJBQXFCLEVBQy9DO1FBQ0RxVCxxQkFBcUIsQ0FBQyxDQUFDO01BQ3hCO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU08sNEJBQTRCQSxDQUFFaGUsS0FBSyxFQUFHO01BQzlDLElBQ0N1SyxtQkFBbUIsQ0FBRXZLLEtBQUssSUFBSUEsS0FBSyxDQUFDRyxNQUFNLEdBQUdILEtBQUssQ0FBQ0csTUFBTSxHQUFHLENBQUMsQ0FBRSxDQUFDLElBQzdEaEIsNEJBQTRCLElBQzVCQSw0QkFBNEIsQ0FBQ2lMLHFCQUFxQixFQUNwRDtRQUNEc1QsNkJBQTZCLENBQUV2ZSw0QkFBNEIsQ0FBQ3dMLHFCQUFzQixDQUFDO01BQ3BGO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3NULG1DQUFtQ0EsQ0FBRWplLEtBQUssRUFBRztNQUNyRCxJQUFJRyxNQUFNLEdBQUdILEtBQUssSUFBSUEsS0FBSyxDQUFDRyxNQUFNLEdBQUdILEtBQUssQ0FBQ0csTUFBTSxHQUFHLENBQUMsQ0FBQztNQUN0RCxJQUFJa0osVUFBVSxHQUFHOUwsTUFBTSxDQUFFNEMsTUFBTSxDQUFDa0osVUFBVyxDQUFDO01BQzVDLElBQUl4RCxLQUFLLEdBQUduSSxNQUFNLENBQUV5QyxNQUFNLENBQUMwRixLQUFLLElBQUksRUFBRyxDQUFDO01BRXhDLElBQ0MsQ0FBQyxLQUFLdEksTUFBTSxDQUFFNEMsTUFBTSxDQUFDQyxjQUFlLENBQUMsSUFDbEMsQ0FBRTdDLE1BQU0sQ0FBQ2dELFNBQVMsQ0FBRThJLFVBQVcsQ0FBQyxJQUNoQ0EsVUFBVSxHQUFHckssaUNBQWlDLElBQzlDLENBQUMsQ0FBQyxLQUFLLENBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUUsQ0FBQzBKLE9BQU8sQ0FBRTdDLEtBQU0sQ0FBQyxFQUM3RDtRQUNEO01BQ0Q7TUFDQTdHLGlDQUFpQyxHQUFHcUssVUFBVTtNQUM5Q3BLLGlDQUFpQyxHQUFHLFNBQVMsS0FBSzRHLEtBQUs7TUFDdkQsSUFBSyxRQUFRLEtBQUtBLEtBQUssRUFBRztRQUN6QjRYLHFCQUFxQixDQUFDLENBQUM7UUFDdkI7TUFDRDtNQUNBM2YsTUFBTSxDQUFDMEssSUFBSSxDQUFFeEssaUJBQWtCLENBQUMsQ0FBQzBCLE9BQU8sQ0FBRSxVQUFXRixXQUFXLEVBQUc7UUFDbEUrYyx3Q0FBd0MsQ0FBRWhmLE1BQU0sQ0FBRWlDLFdBQVksQ0FBRSxDQUFDO01BQ2xFLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVMwZSwwQkFBMEJBLENBQUVDLE9BQU8sRUFBRztNQUM5QyxJQUFJQyxTQUFTLEdBQUdELE9BQU8sSUFBSUEsT0FBTyxDQUFDRSxPQUFPLEdBQUdGLE9BQU8sQ0FBQ0UsT0FBTyxDQUFFLDhDQUErQyxDQUFDLEdBQUcsSUFBSTtNQUVySCxJQUFLLENBQUVELFNBQVMsSUFBSSxDQUFFQSxTQUFTLENBQUNqWixhQUFhLEVBQUc7UUFDL0MsT0FBTyxJQUFJO01BQ1o7TUFDQSxPQUFPO1FBQ05pWixTQUFTLEVBQUVBLFNBQVM7UUFDcEIxSixLQUFLLEVBQUUwSixTQUFTLENBQUNqWixhQUFhLENBQUUsdURBQXdELENBQUM7UUFDekZ5UCxHQUFHLEVBQUV3SixTQUFTLENBQUNqWixhQUFhLENBQUUscURBQXNEO01BQ3JGLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbVosb0JBQW9CQSxDQUFFSCxPQUFPLEVBQUc7TUFDeEMsSUFBSUksUUFBUSxHQUFHTCwwQkFBMEIsQ0FBRUMsT0FBUSxDQUFDO01BQ3BELElBQUlLLFFBQVEsR0FBRzlnQixNQUFNLENBQUV5Z0IsT0FBTyxJQUFJQSxPQUFPLENBQUNwRCxZQUFZLEdBQUdvRCxPQUFPLENBQUNwRCxZQUFZLENBQUUsNkNBQThDLENBQUMsR0FBRyxFQUFHLENBQUM7TUFDckksSUFBSW5aLFlBQVksR0FBR0wsMkJBQTJCLENBQUMsQ0FBQztNQUNoRCxJQUFJVyxZQUFZO01BQ2hCLElBQUlDLFVBQVU7TUFDZCxJQUFJc2MsT0FBTztNQUNYLElBQUlDLE9BQU87TUFDWCxJQUFJMWMsWUFBWTtNQUNoQixJQUFJMFEscUJBQXFCO01BQ3pCLElBQUl4TSxJQUFJLEdBQUdqSixhQUFhLENBQUNpSixJQUFJLElBQUksQ0FBQyxDQUFDO01BRW5DLElBQUssQ0FBRXFZLFFBQVEsSUFBSSxDQUFFQSxRQUFRLENBQUM3SixLQUFLLElBQUksQ0FBRTZKLFFBQVEsQ0FBQzNKLEdBQUcsRUFBRztRQUN2RCxPQUFPLElBQUk7TUFDWjtNQUNBMVMsWUFBWSxHQUFHVCxxQkFBcUIsQ0FBRThjLFFBQVEsQ0FBQzdKLEtBQUssQ0FBQ2lLLEtBQUssRUFBRSxDQUFFLENBQUM7TUFDL0R4YyxVQUFVLEdBQUdWLHFCQUFxQixDQUFFOGMsUUFBUSxDQUFDM0osR0FBRyxDQUFDK0osS0FBSyxFQUFFLElBQUssQ0FBQztNQUM5RCxJQUFLLE9BQU8sS0FBS0gsUUFBUSxFQUFHO1FBQzNCdGMsWUFBWSxHQUFHOUUsSUFBSSxDQUFDRSxHQUFHLENBQUUsSUFBSSxHQUFHc0UsWUFBWSxFQUFFeEUsSUFBSSxDQUFDRSxHQUFHLENBQUU0RSxZQUFZLEVBQUVDLFVBQVUsR0FBR1AsWUFBYSxDQUFFLENBQUM7TUFDcEcsQ0FBQyxNQUFNO1FBQ05PLFVBQVUsR0FBRy9FLElBQUksQ0FBQ0MsR0FBRyxDQUFFdUUsWUFBWSxFQUFFeEUsSUFBSSxDQUFDQyxHQUFHLENBQUU4RSxVQUFVLEVBQUVELFlBQVksR0FBR04sWUFBYSxDQUFFLENBQUM7TUFDM0Y7TUFDQU0sWUFBWSxHQUFHOUUsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFNkUsWUFBYSxDQUFDO01BQzFDQyxVQUFVLEdBQUcvRSxJQUFJLENBQUNFLEdBQUcsQ0FBRSxJQUFJLEVBQUU2RSxVQUFXLENBQUM7TUFDekNvYyxRQUFRLENBQUM3SixLQUFLLENBQUNpSyxLQUFLLEdBQUd6YyxZQUFZO01BQ25DcWMsUUFBUSxDQUFDM0osR0FBRyxDQUFDK0osS0FBSyxHQUFHeGMsVUFBVTtNQUMvQm9jLFFBQVEsQ0FBQzdKLEtBQUssQ0FBQ29JLFlBQVksQ0FBRSxZQUFZLEVBQUU1TyxpQkFBaUIsQ0FBRWhJLElBQUksQ0FBQzZTLGdCQUFnQixFQUFFO1FBQUVDLElBQUksRUFBRTNMLGtCQUFrQixDQUFFbkwsWUFBYTtNQUFFLENBQUUsQ0FBRSxDQUFDO01BQ3JJcWMsUUFBUSxDQUFDM0osR0FBRyxDQUFDa0ksWUFBWSxDQUFFLFlBQVksRUFBRTVPLGlCQUFpQixDQUFFaEksSUFBSSxDQUFDZ1QsY0FBYyxFQUFFO1FBQUVGLElBQUksRUFBRTNMLGtCQUFrQixDQUFFbEwsVUFBVztNQUFFLENBQUUsQ0FBRSxDQUFDO01BQy9ILElBQUtvYyxRQUFRLENBQUNILFNBQVMsQ0FBQ1EsS0FBSyxJQUFJTCxRQUFRLENBQUNILFNBQVMsQ0FBQ1EsS0FBSyxDQUFDQyxXQUFXLEVBQUc7UUFDdkVOLFFBQVEsQ0FBQ0gsU0FBUyxDQUFDUSxLQUFLLENBQUNDLFdBQVcsQ0FBRSw4QkFBOEIsRUFBRXRoQixNQUFNLENBQUUsQ0FBRSxHQUFHLEdBQUcyRSxZQUFZLEdBQUcsSUFBSSxFQUFHa1AsT0FBTyxDQUFFLENBQUUsQ0FBRSxDQUFDLEdBQUcsR0FBSSxDQUFDO1FBQ2xJbU4sUUFBUSxDQUFDSCxTQUFTLENBQUNRLEtBQUssQ0FBQ0MsV0FBVyxDQUFFLDRCQUE0QixFQUFFdGhCLE1BQU0sQ0FBRSxDQUFFLEdBQUcsR0FBRzRFLFVBQVUsR0FBRyxJQUFJLEVBQUdpUCxPQUFPLENBQUUsQ0FBRSxDQUFFLENBQUMsR0FBRyxHQUFJLENBQUM7TUFDL0g7TUFDQXFOLE9BQU8sR0FBR0YsUUFBUSxDQUFDSCxTQUFTLENBQUN4RCxnQkFBZ0IsR0FBRzJELFFBQVEsQ0FBQ0gsU0FBUyxDQUFDeEQsZ0JBQWdCLENBQUUsNkNBQThDLENBQUMsR0FBRyxFQUFFO01BQ3pJOVosS0FBSyxDQUFDK1osU0FBUyxDQUFDbmIsT0FBTyxDQUFDb2IsSUFBSSxDQUFFMkQsT0FBTyxFQUFFLFVBQVdLLE1BQU0sRUFBRztRQUMxREEsTUFBTSxDQUFDMVosV0FBVyxHQUFHLE9BQU8sS0FBSzBaLE1BQU0sQ0FBQy9ELFlBQVksQ0FBRSwyQ0FBNEMsQ0FBQyxHQUNoRzFOLGtCQUFrQixDQUFFbkwsWUFBYSxDQUFDLEdBQ2xDbUwsa0JBQWtCLENBQUVsTCxVQUFXLENBQUM7TUFDcEMsQ0FBRSxDQUFDO01BQ0hILFlBQVksR0FBRztRQUFFQyxJQUFJLEVBQUUsUUFBUTtRQUFFQyxZQUFZLEVBQUVBLFlBQVk7UUFBRUMsVUFBVSxFQUFFQTtNQUFXLENBQUM7TUFDckZ1USxxQkFBcUIsR0FBRzlQLHlCQUF5QixDQUFFWixZQUFhLENBQUM7TUFDakUwYyxPQUFPLEdBQUdILFFBQVEsQ0FBQ0gsU0FBUyxDQUFDeEQsZ0JBQWdCLEdBQUcyRCxRQUFRLENBQUNILFNBQVMsQ0FBQ3hELGdCQUFnQixDQUFFLDJDQUE0QyxDQUFDLEdBQUcsRUFBRTtNQUN2STlaLEtBQUssQ0FBQytaLFNBQVMsQ0FBQ25iLE9BQU8sQ0FBQ29iLElBQUksQ0FBRTRELE9BQU8sRUFBRSxVQUFXMVksTUFBTSxFQUFHO1FBQzFELElBQUlzVCxTQUFTLEdBQUcsQ0FBQyxDQUFFNUcscUJBQXFCLElBQ3BDQSxxQkFBcUIsQ0FBQ3hSLEVBQUUsS0FBS3hELE1BQU0sQ0FBRXNJLE1BQU0sQ0FBQytVLFlBQVksQ0FBRSwyQ0FBNEMsQ0FBQyxJQUFJLEVBQUcsQ0FBQztRQUVuSC9VLE1BQU0sQ0FBQzhXLFlBQVksQ0FBRSxjQUFjLEVBQUV4RCxTQUFTLEdBQUcsTUFBTSxHQUFHLE9BQVEsQ0FBQztRQUNuRSxJQUFLdFQsTUFBTSxDQUFDcEcsU0FBUyxFQUFHO1VBQ3ZCb0csTUFBTSxDQUFDcEcsU0FBUyxDQUFDbWYsTUFBTSxDQUFFLFdBQVcsRUFBRXpGLFNBQVUsQ0FBQztRQUNsRDtNQUNELENBQUUsQ0FBQztNQUVILE9BQU90WCxZQUFZO0lBQ3BCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNnZCxrQkFBa0JBLENBQUVoZixLQUFLLEVBQUc7TUFDcEMsSUFBSW1lLE9BQU8sR0FBR25lLEtBQUssQ0FBQ2lmLE1BQU0sSUFBSWpmLEtBQUssQ0FBQ2lmLE1BQU0sQ0FBQ1osT0FBTyxHQUMvQ3JlLEtBQUssQ0FBQ2lmLE1BQU0sQ0FBQ1osT0FBTyxDQUFFLHNDQUF1QyxDQUFDLEdBQzlELElBQUk7TUFFUCxJQUFLRixPQUFPLEVBQUc7UUFDZEcsb0JBQW9CLENBQUVILE9BQVEsQ0FBQztNQUNoQztJQUNEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2UscUJBQXFCQSxDQUFFMWYsV0FBVyxFQUFFMmYsUUFBUSxFQUFHO01BQ3ZEMWYsaUJBQWlCLENBQUVELFdBQVksQ0FBQyxDQUFDeUwsSUFBSSxDQUFFLFVBQVd0TCxJQUFJLEVBQUc7UUFDeEQsSUFBSXdlLE9BQU8sR0FBR3hlLElBQUksSUFBSUEsSUFBSSxDQUFDd0YsYUFBYSxHQUFHeEYsSUFBSSxDQUFDd0YsYUFBYSxDQUFFZ2EsUUFBUyxDQUFDLEdBQUcsSUFBSTtRQUVoRixJQUFLLENBQUVoQixPQUFPLElBQUksVUFBVSxLQUFLLE9BQU9BLE9BQU8sQ0FBQ2lCLEtBQUssRUFBRztVQUN2RCxPQUFPLEtBQUs7UUFDYjtRQUNBakIsT0FBTyxDQUFDaUIsS0FBSyxDQUFDLENBQUM7UUFDZixPQUFPLElBQUk7TUFDWixDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxtQkFBbUJBLENBQUVyZixLQUFLLEVBQUc7TUFDckMsSUFBSW1lLE9BQU8sR0FBR25lLEtBQUssQ0FBQ2lmLE1BQU0sSUFBSWpmLEtBQUssQ0FBQ2lmLE1BQU0sQ0FBQ1osT0FBTyxHQUMvQ3JlLEtBQUssQ0FBQ2lmLE1BQU0sQ0FBQ1osT0FBTyxDQUFFLHNDQUF1QyxDQUFDLEdBQzlELElBQUk7TUFDUCxJQUFJN2UsV0FBVztNQUNmLElBQUl3QyxZQUFZO01BQ2hCLElBQUl3YyxRQUFRO01BRVosSUFBSyxDQUFFTCxPQUFPLEVBQUc7UUFDaEI7TUFDRDtNQUNBM2UsV0FBVyxHQUFHakMsTUFBTSxDQUFFNGdCLE9BQU8sQ0FBQ3BELFlBQVksQ0FBRSxnQ0FBaUMsQ0FBRSxDQUFDO01BQ2hGLElBQUssQ0FBRS9jLGlCQUFpQixDQUFFd0IsV0FBVyxDQUFFLEVBQUc7UUFDekM7TUFDRDtNQUNBd0MsWUFBWSxHQUFHc2Msb0JBQW9CLENBQUVILE9BQVEsQ0FBQztNQUM5QyxJQUFLLENBQUVuYyxZQUFZLEVBQUc7UUFDckI7TUFDRDtNQUNBd2MsUUFBUSxHQUFHLEtBQUssS0FBS0wsT0FBTyxDQUFDcEQsWUFBWSxDQUFFLDZDQUE4QyxDQUFDLEdBQUcsS0FBSyxHQUFHLE9BQU87TUFDNUc5YywwQkFBMEIsQ0FBRXVCLFdBQVcsQ0FBRSxHQUFHdUMsc0JBQXNCLENBQUVDLFlBQWEsQ0FBQztNQUNsRixPQUFPeEQsbUJBQW1CLENBQUVnQixXQUFXLENBQUU7TUFDekMwZCxlQUFlLENBQUUxZCxXQUFZLENBQUM7TUFDOUIwZixxQkFBcUIsQ0FBRTFmLFdBQVcsRUFBRSxnREFBZ0QsR0FBR2dmLFFBQVEsR0FBRyxJQUFLLENBQUM7TUFDeEcxWCxxQkFBcUIsQ0FBRXRILFdBQVksQ0FBQztJQUNyQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTOGYsbUJBQW1CQSxDQUFFdGYsS0FBSyxFQUFHO01BQ3JDLElBQUlnRyxNQUFNLEdBQUdoRyxLQUFLLENBQUNpZixNQUFNLElBQUlqZixLQUFLLENBQUNpZixNQUFNLENBQUNaLE9BQU8sR0FDOUNyZSxLQUFLLENBQUNpZixNQUFNLENBQUNaLE9BQU8sQ0FBRSwyQ0FBNEMsQ0FBQyxHQUNuRSxJQUFJO01BQ1AsSUFBSTdlLFdBQVc7TUFDZixJQUFJeUMsSUFBSTtNQUNSLElBQUlNLFNBQVM7TUFDYixJQUFJRCxNQUFNO01BQ1YsSUFBSU4sWUFBWTtNQUNoQixJQUFJdWQsY0FBYztNQUVsQixJQUFLLENBQUV2WixNQUFNLEVBQUc7UUFDZjtNQUNEO01BQ0F4RyxXQUFXLEdBQUdqQyxNQUFNLENBQUV5SSxNQUFNLENBQUMrVSxZQUFZLENBQUUsZ0NBQWlDLENBQUUsQ0FBQztNQUMvRTlZLElBQUksR0FBR3ZFLE1BQU0sQ0FBRXNJLE1BQU0sQ0FBQytVLFlBQVksQ0FBRSx5Q0FBMEMsQ0FBQyxJQUFJLEVBQUcsQ0FBQztNQUN2RixJQUFLLENBQUUvYyxpQkFBaUIsQ0FBRXdCLFdBQVcsQ0FBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUUsQ0FBQ2tKLE9BQU8sQ0FBRXpHLElBQUssQ0FBQyxFQUFHO1FBQ3BHO01BQ0Q7TUFDQUQsWUFBWSxHQUFHO1FBQUVDLElBQUksRUFBRUE7TUFBSyxDQUFDO01BQzdCc2QsY0FBYyxHQUFHLDRDQUE0QyxHQUFHdGQsSUFBSSxHQUFHLElBQUk7TUFDM0UsSUFBSyxRQUFRLEtBQUtBLElBQUksRUFBRztRQUN4Qk0sU0FBUyxHQUFHN0UsTUFBTSxDQUFFc0ksTUFBTSxDQUFDK1UsWUFBWSxDQUFFLDJDQUE0QyxDQUFDLElBQUksRUFBRyxDQUFDO1FBQzlGelksTUFBTSxHQUFHRixzQkFBc0IsQ0FBQyxDQUFDLENBQUNVLElBQUksQ0FBRSxVQUFXcEIsU0FBUyxFQUFHO1VBQzlELE9BQU9BLFNBQVMsQ0FBQ1IsRUFBRSxLQUFLcUIsU0FBUztRQUNsQyxDQUFFLENBQUM7UUFDSCxJQUFLLENBQUVELE1BQU0sRUFBRztVQUNmO1FBQ0Q7UUFDQU4sWUFBWSxHQUFHO1VBQ2RDLElBQUksRUFBRSxRQUFRO1VBQ2RDLFlBQVksRUFBRUksTUFBTSxDQUFDSixZQUFZO1VBQ2pDQyxVQUFVLEVBQUVHLE1BQU0sQ0FBQ0g7UUFDcEIsQ0FBQztRQUNEb2QsY0FBYyxJQUFJLDhDQUE4QyxHQUFHamQsTUFBTSxDQUFDcEIsRUFBRSxHQUFHLElBQUk7TUFDcEY7TUFDQWpELDBCQUEwQixDQUFFdUIsV0FBVyxDQUFFLEdBQUd1QyxzQkFBc0IsQ0FBRUMsWUFBYSxDQUFDO01BQ2xGLE9BQU94RCxtQkFBbUIsQ0FBRWdCLFdBQVcsQ0FBRTtNQUN6QzBkLGVBQWUsQ0FBRTFkLFdBQVksQ0FBQztNQUM5QjBmLHFCQUFxQixDQUFFMWYsV0FBVyxFQUFFK2YsY0FBZSxDQUFDO01BQ3BEelkscUJBQXFCLENBQUV0SCxXQUFZLENBQUM7SUFDckM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZ2dCLG1CQUFtQkEsQ0FBRWhnQixXQUFXLEVBQUVrRixZQUFZLEVBQUc7TUFDekQsSUFBSWdZLGlCQUFpQixHQUFHbGUsbUJBQW1CLENBQUVqQixNQUFNLENBQUVpQyxXQUFZLENBQUMsQ0FBRTtNQUNwRSxJQUFJeUUsSUFBSSxHQUFHakIsc0JBQXNCLENBQUMsQ0FBQztNQUNuQyxJQUFJeVcsY0FBYztNQUVsQixJQUFLLENBQUVpRCxpQkFBaUIsSUFBSSxDQUFFQSxpQkFBaUIsQ0FBQ3JRLFVBQVUsRUFBRztRQUM1RDtNQUNEO01BQ0FvTixjQUFjLEdBQUdyYyxJQUFJLENBQUNDLEdBQUcsQ0FDeEI0RyxJQUFJLENBQUNILHNCQUFzQixFQUMzQjFHLElBQUksQ0FBQzBFLEtBQUssQ0FBRTRhLGlCQUFpQixDQUFDclEsVUFBVSxDQUFDbUUsS0FBSyxDQUFDVyxZQUFZLEdBQUcsRUFBRSxHQUFHbE4sSUFBSSxDQUFDTCxjQUFjLEdBQUdjLFlBQVksR0FBRyxHQUFJLENBQzdHLENBQUM7TUFDRGpGLGlCQUFpQixDQUFFRCxXQUFZLENBQUMsQ0FBQ0UsT0FBTyxDQUFFLFVBQVdDLElBQUksRUFBRztRQUMzRCxJQUFJaWQsS0FBSyxHQUFHamQsSUFBSSxJQUFJQSxJQUFJLENBQUN3RixhQUFhLEdBQUd4RixJQUFJLENBQUN3RixhQUFhLENBQUUsc0NBQXVDLENBQUMsR0FBRyxJQUFJO1FBRTVHLElBQUt5WCxLQUFLLElBQUlBLEtBQUssQ0FBQ2dDLEtBQUssSUFBSWhDLEtBQUssQ0FBQ2dDLEtBQUssQ0FBQ0MsV0FBVyxFQUFHO1VBQ3REakMsS0FBSyxDQUFDZ0MsS0FBSyxDQUFDQyxXQUFXLENBQUUsOEJBQThCLEVBQUVwRixjQUFjLEdBQUcsSUFBSyxDQUFDO1FBQ2pGO01BQ0QsQ0FBRSxDQUFDO01BQ0gwQyxhQUFhLENBQUUzYyxXQUFXLEVBQUVrZCxpQkFBaUIsQ0FBQ2pVLFNBQVUsQ0FBQztJQUMxRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZ1gsaUJBQWlCQSxDQUFFemYsS0FBSyxFQUFHO01BQ25DLElBQUltZSxPQUFPLEdBQUduZSxLQUFLLENBQUNpZixNQUFNLElBQUlqZixLQUFLLENBQUNpZixNQUFNLENBQUNaLE9BQU8sR0FDL0NyZSxLQUFLLENBQUNpZixNQUFNLENBQUNaLE9BQU8sQ0FBRSxxQ0FBc0MsQ0FBQyxHQUM3RCxJQUFJO01BQ1AsSUFBSTdlLFdBQVc7TUFDZixJQUFJa0YsWUFBWTtNQUNoQixJQUFJa1ksS0FBSztNQUNULElBQUkxWCxNQUFNO01BQ1YsSUFBSXpDLEtBQUs7TUFFVCxJQUFLLENBQUUwYixPQUFPLEVBQUc7UUFDaEI7TUFDRDtNQUNBM2UsV0FBVyxHQUFHakMsTUFBTSxDQUFFNGdCLE9BQU8sQ0FBQ3BELFlBQVksQ0FBRSxnQ0FBaUMsQ0FBRSxDQUFDO01BQ2hGLElBQUssQ0FBRS9jLGlCQUFpQixDQUFFd0IsV0FBVyxDQUFFLEVBQUc7UUFDekM7TUFDRDtNQUNBa0YsWUFBWSxHQUFHVixzQkFBc0IsQ0FBRW1hLE9BQU8sQ0FBQ1EsS0FBTSxDQUFDO01BQ3REemdCLDRCQUE0QixDQUFFc0IsV0FBVyxDQUFFLEdBQUdrRixZQUFZO01BQzFEakMsS0FBSyxHQUFHeUwsaUJBQWlCLENBQUVqUixhQUFhLENBQUNpSixJQUFJLElBQUlqSixhQUFhLENBQUNpSixJQUFJLENBQUNzVCxlQUFlLEVBQUU7UUFBRUQsT0FBTyxFQUFFN1U7TUFBYSxDQUFFLENBQUM7TUFDaEh5WixPQUFPLENBQUNRLEtBQUssR0FBR2phLFlBQVk7TUFDNUJ5WixPQUFPLENBQUNyQixZQUFZLENBQUUsZ0JBQWdCLEVBQUVyYSxLQUFNLENBQUM7TUFDL0NtYSxLQUFLLEdBQUd1QixPQUFPLENBQUNFLE9BQU8sR0FBR0YsT0FBTyxDQUFDRSxPQUFPLENBQUUsc0NBQXVDLENBQUMsR0FBRyxJQUFJO01BQzFGblosTUFBTSxHQUFHMFgsS0FBSyxJQUFJQSxLQUFLLENBQUN6WCxhQUFhLEdBQUd5WCxLQUFLLENBQUN6WCxhQUFhLENBQUUsNENBQTZDLENBQUMsR0FBRyxJQUFJO01BQ2xILElBQUtELE1BQU0sRUFBRztRQUNiQSxNQUFNLENBQUNFLFdBQVcsR0FBRzNDLEtBQUs7TUFDM0I7TUFDQStjLG1CQUFtQixDQUFFaGdCLFdBQVcsRUFBRWtGLFlBQWEsQ0FBQztJQUNqRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZ2Isa0JBQWtCQSxDQUFFMWYsS0FBSyxFQUFHO01BQ3BDLElBQUltZSxPQUFPLEdBQUduZSxLQUFLLENBQUNpZixNQUFNLElBQUlqZixLQUFLLENBQUNpZixNQUFNLENBQUNaLE9BQU8sR0FDL0NyZSxLQUFLLENBQUNpZixNQUFNLENBQUNaLE9BQU8sQ0FBRSxxQ0FBc0MsQ0FBQyxHQUM3RCxJQUFJO01BQ1AsSUFBSTdlLFdBQVc7TUFFZixJQUFLLENBQUUyZSxPQUFPLEVBQUc7UUFDaEI7TUFDRDtNQUNBM2UsV0FBVyxHQUFHakMsTUFBTSxDQUFFNGdCLE9BQU8sQ0FBQ3BELFlBQVksQ0FBRSxnQ0FBaUMsQ0FBRSxDQUFDO01BQ2hGLElBQUsvYyxpQkFBaUIsQ0FBRXdCLFdBQVcsQ0FBRSxFQUFHO1FBQ3ZDc0gscUJBQXFCLENBQUV0SCxXQUFZLENBQUM7TUFDckM7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTbWdCLGtDQUFrQ0EsQ0FBRTNmLEtBQUssRUFBRztNQUNwRCxJQUFJRyxNQUFNLEdBQUdILEtBQUssSUFBSUEsS0FBSyxDQUFDRyxNQUFNLEdBQUdILEtBQUssQ0FBQ0csTUFBTSxHQUFHLENBQUMsQ0FBQztNQUN0RCxJQUFJeWYsT0FBTyxHQUFHLEVBQUU7TUFFaEIsSUFBSyxDQUFDLEtBQUtyaUIsTUFBTSxDQUFFNEMsTUFBTSxDQUFDQyxjQUFlLENBQUMsSUFBSSxVQUFVLEtBQUssT0FBT0QsTUFBTSxDQUFDMGYsVUFBVSxFQUFHO1FBQ3ZGO01BQ0Q7TUFDQS9oQixNQUFNLENBQUMwSyxJQUFJLENBQUVuSyxrQ0FBbUMsQ0FBQyxDQUFDcUIsT0FBTyxDQUFFLFVBQVdGLFdBQVcsRUFBRztRQUNuRixJQUFJcUcsS0FBSyxHQUFHeEgsa0NBQWtDLENBQUVtQixXQUFXLENBQUU7UUFFN0QsSUFBS3FHLEtBQUssQ0FBQ1AsS0FBSyxFQUFHO1VBQ2xCM0ksTUFBTSxDQUFDbUQsWUFBWSxDQUFFK0YsS0FBSyxDQUFDUCxLQUFNLENBQUM7VUFDbENPLEtBQUssQ0FBQ1AsS0FBSyxHQUFHLElBQUk7UUFDbkI7UUFDQU8sS0FBSyxDQUFDTCxPQUFPLEdBQUcsS0FBSztRQUNyQixJQUFLSyxLQUFLLENBQUNOLE9BQU8sSUFBSSxVQUFVLEtBQUssT0FBT00sS0FBSyxDQUFDTixPQUFPLENBQUNzQixNQUFNLEVBQUc7VUFDbEUrWSxPQUFPLENBQUMxVyxJQUFJLENBQUUsSUFBSXZNLE1BQU0sQ0FBQ21qQixPQUFPLENBQUUsVUFBV0MsT0FBTyxFQUFHO1lBQ3REbGEsS0FBSyxDQUFDTixPQUFPLENBQUNzQixNQUFNLENBQUVrWixPQUFRLENBQUM7VUFDaEMsQ0FBRSxDQUFFLENBQUM7UUFDTjtNQUNELENBQUUsQ0FBQztNQUNINWYsTUFBTSxDQUFDMGYsVUFBVSxDQUFFbGpCLE1BQU0sQ0FBQ21qQixPQUFPLENBQUNFLEdBQUcsQ0FBRUosT0FBUSxDQUFFLENBQUM7SUFDbkQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTSyx3QkFBd0JBLENBQUVqZ0IsS0FBSyxFQUFHO01BQzFDLElBQUssQ0FBQyxLQUFLekMsTUFBTSxDQUFFeUMsS0FBSyxJQUFJQSxLQUFLLENBQUNHLE1BQU0sSUFBSUgsS0FBSyxDQUFDRyxNQUFNLENBQUNDLGNBQWUsQ0FBQyxFQUFHO1FBQzNFO01BQ0Q7TUFDQXRDLE1BQU0sQ0FBQzBLLElBQUksQ0FBRW5LLGtDQUFtQyxDQUFDLENBQUNxQixPQUFPLENBQUVxSCw0QkFBNkIsQ0FBQztNQUN6RmpKLE1BQU0sQ0FBQzBLLElBQUksQ0FBRXJLLDZCQUE4QixDQUFDLENBQUM0RyxNQUFNLENBQUVqSCxNQUFNLENBQUMwSyxJQUFJLENBQUV4SyxpQkFBa0IsQ0FBRSxDQUFDLENBQUMwQixPQUFPLENBQUUsVUFBV0YsV0FBVyxFQUFHO1FBQ3pIQSxXQUFXLEdBQUdqQyxNQUFNLENBQUVpQyxXQUFZLENBQUM7UUFDbkN2QiwwQkFBMEIsQ0FBRXVCLFdBQVcsQ0FBRSxHQUFHO1VBQUV5QyxJQUFJLEVBQUU7UUFBTyxDQUFDO1FBQzVEL0QsNEJBQTRCLENBQUVzQixXQUFXLENBQUUsR0FBR3dELHNCQUFzQixDQUFDLENBQUMsQ0FBQ1UsZUFBZTtRQUN0RnRGLG9DQUFvQyxDQUFFb0IsV0FBVyxDQUFFLEdBQUcsSUFBSTtRQUMxRCxPQUFPckIsNkJBQTZCLENBQUVxQixXQUFXLENBQUU7UUFDbkQsT0FBT2hCLG1CQUFtQixDQUFFZ0IsV0FBVyxDQUFFO01BQzFDLENBQUUsQ0FBQztNQUNIaWUscUJBQXFCLENBQUMsQ0FBQztJQUN4Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTeUMsNkJBQTZCQSxDQUFFbGdCLEtBQUssRUFBRztNQUMvQyxJQUFJRyxNQUFNLEdBQUdILEtBQUssSUFBSUEsS0FBSyxDQUFDRyxNQUFNLEdBQUdILEtBQUssQ0FBQ0csTUFBTSxHQUFHLENBQUMsQ0FBQztNQUN0RCxJQUFJWCxXQUFXLEdBQUdqQyxNQUFNLENBQUU0QyxNQUFNLENBQUNYLFdBQVksQ0FBQztNQUU5QyxJQUFLL0IsZUFBZSxLQUFLQyxNQUFNLENBQUV5QyxNQUFNLENBQUMxQyxlQUFlLElBQUksRUFBRyxDQUFDLElBQUksQ0FBRUYsTUFBTSxDQUFDZ0QsU0FBUyxDQUFFZixXQUFZLENBQUMsSUFBSSxDQUFDLEdBQUdBLFdBQVcsRUFBRztRQUN6SDtNQUNEO01BQ0EsSUFBSyx1Q0FBdUMsS0FBS1EsS0FBSyxDQUFDbWdCLElBQUksSUFBTSw0Q0FBNEMsS0FBS25nQixLQUFLLENBQUNtZ0IsSUFBSSxJQUFJLElBQUksS0FBS2hnQixNQUFNLENBQUNpZ0IsT0FBUyxFQUFHO1FBQzNKcGlCLGlCQUFpQixDQUFFd0IsV0FBVyxDQUFFLEdBQUcsSUFBSTtRQUN2Q2dGLGdDQUFnQyxDQUFFaEYsV0FBWSxDQUFDO1FBQy9DMGQsZUFBZSxDQUFFMWQsV0FBVyxFQUFFVyxNQUFNLENBQUNELEtBQU0sQ0FBQztRQUM1QztNQUNEO01BQ0EsSUFBSyx1Q0FBdUMsS0FBS0YsS0FBSyxDQUFDbWdCLElBQUksSUFBSSx3Q0FBd0MsS0FBS25nQixLQUFLLENBQUNtZ0IsSUFBSSxFQUFHO1FBQ3hILE9BQU9uaUIsaUJBQWlCLENBQUV3QixXQUFXLENBQUU7UUFDdkN5SiwyQkFBMkIsQ0FBRXpKLFdBQVksQ0FBQztRQUMxQyxJQUFLLHdDQUF3QyxLQUFLUSxLQUFLLENBQUNtZ0IsSUFBSSxFQUFHO1VBQzlELE9BQU9saUIsMEJBQTBCLENBQUV1QixXQUFXLENBQUU7VUFDaEQsT0FBT3RCLDRCQUE0QixDQUFFc0IsV0FBVyxDQUFFO1VBQ2xELE9BQU9yQiw2QkFBNkIsQ0FBRXFCLFdBQVcsQ0FBRTtVQUNuRCxPQUFPcEIsb0NBQW9DLENBQUVvQixXQUFXLENBQUU7VUFDMUR1SCw0QkFBNEIsQ0FBRXZILFdBQVksQ0FBQztRQUM1QztNQUNEO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNpYyxnQ0FBZ0NBLENBQUVqYyxXQUFXLEVBQUc7TUFDeEQsSUFBSWtkLGlCQUFpQjtNQUNyQixJQUFJclEsVUFBVTtNQUNkLElBQUlwSSxJQUFJO01BRVJ6RSxXQUFXLEdBQUdqQyxNQUFNLENBQUVpQyxXQUFZLENBQUM7TUFDbkNrZCxpQkFBaUIsR0FBR2xlLG1CQUFtQixDQUFFZ0IsV0FBVyxDQUFFO01BQ3RENk0sVUFBVSxHQUFHcVEsaUJBQWlCLElBQUlBLGlCQUFpQixDQUFDclEsVUFBVTtNQUM5RCxJQUFLLENBQUVyTyxpQkFBaUIsQ0FBRXdCLFdBQVcsQ0FBRSxJQUFJLENBQUU2TSxVQUFVLElBQUksQ0FBRUEsVUFBVSxDQUFDdEUsUUFBUSxJQUFJLENBQUVqSCxLQUFLLENBQUNDLE9BQU8sQ0FBRXNMLFVBQVUsQ0FBQ3dHLEtBQU0sQ0FBQyxFQUFHO1FBQ3pILE9BQU8sSUFBSTtNQUNaO01BQ0E1TyxJQUFJLEdBQUdqQixzQkFBc0IsQ0FBQyxDQUFDO01BRS9CLE9BQU87UUFDTjVDLGNBQWMsRUFBRSxDQUFDO1FBQ2pCcUksU0FBUyxFQUFFL0ssTUFBTSxDQUFFMk8sVUFBVSxDQUFDNUQsU0FBUyxJQUFJLEVBQUcsQ0FBQztRQUMvQ21ULGlCQUFpQixFQUFFO1VBQ2xCcGMsV0FBVyxFQUFFQSxXQUFXO1VBQ3hCZ0ksb0JBQW9CLEVBQUU5SixNQUFNLENBQUUyTyxVQUFVLENBQUN0RSxRQUFRLENBQUNQLG9CQUFvQixJQUFJLEVBQUcsQ0FBQztVQUM5RS9JLGtCQUFrQixFQUFFbEIsTUFBTSxDQUFFOE8sVUFBVSxDQUFDdEUsUUFBUSxDQUFDdEosa0JBQWtCLElBQUksQ0FBRSxDQUFDO1VBQ3pFQyx1QkFBdUIsRUFBRW5CLE1BQU0sQ0FBRThPLFVBQVUsQ0FBQ3RFLFFBQVEsQ0FBQ3JKLHVCQUF1QixJQUFJLENBQUUsQ0FBQztVQUNuRjJoQixvQkFBb0IsRUFBRTFpQix3QkFBd0IsQ0FBQ3FELEdBQUcsQ0FBRSxVQUFXNkQsWUFBWSxFQUFHO1lBQzdFLE9BQU9uSCxNQUFNLENBQUVtSCxZQUFZLElBQUlBLFlBQVksQ0FBQ3lDLEdBQUcsSUFBSSxFQUFHLENBQUM7VUFDeEQsQ0FBRSxDQUFDLENBQUNuRyxNQUFNLENBQUV3QixPQUFRLENBQUM7VUFDckJpRixRQUFRLEVBQUVsSyxNQUFNLENBQUUyTyxVQUFVLENBQUN6RSxRQUFRLElBQUksRUFBRztRQUM3QyxDQUFDO1FBQ0Q2SCxVQUFVLEVBQUVwRCxVQUFVLENBQUN3RyxLQUFLLENBQUM3UixHQUFHLENBQUUsVUFBVzBPLFNBQVMsRUFBRztVQUN4RCxPQUFPO1lBQ05iLElBQUksRUFBRW5SLE1BQU0sQ0FBRWdTLFNBQVMsQ0FBQ2IsSUFBSSxJQUFJLEVBQUcsQ0FBQztZQUNwQ3BILFFBQVEsRUFBRS9KLE1BQU0sQ0FBRWdTLFNBQVMsQ0FBQ2pJLFFBQVEsSUFBSSxFQUFHLENBQUM7WUFDNUNDLE1BQU0sRUFBRWhLLE1BQU0sQ0FBRWdTLFNBQVMsQ0FBQ2hJLE1BQU0sSUFBSSxFQUFHLENBQUM7WUFDeEN1UCxXQUFXLEVBQUUxWixNQUFNLENBQUVtUyxTQUFTLENBQUN1SCxXQUFZLENBQUM7WUFDNUNxSixTQUFTLEVBQUUvaUIsTUFBTSxDQUFFbVMsU0FBUyxDQUFDNFEsU0FBVSxDQUFDO1lBQ3hDQyxlQUFlLEVBQUVoakIsTUFBTSxDQUFFbVMsU0FBUyxDQUFDNlEsZUFBZ0IsQ0FBQztZQUNwREMsWUFBWSxFQUFFampCLE1BQU0sQ0FBRW1TLFNBQVMsQ0FBQzhRLFlBQWEsQ0FBQztZQUM5Q0MsV0FBVyxFQUFFLENBQUUzZixLQUFLLENBQUNDLE9BQU8sQ0FBRTJPLFNBQVMsQ0FBQytRLFdBQVksQ0FBQyxHQUFHL1EsU0FBUyxDQUFDK1EsV0FBVyxHQUFHLEVBQUUsRUFBR3pmLEdBQUcsQ0FBRSxVQUFXb1MsVUFBVSxFQUFHO2NBQ2pILE9BQU87Z0JBQ05vRixhQUFhLEVBQUU5YSxNQUFNLENBQUUwVixVQUFVLENBQUNvRixhQUFhLElBQUksRUFBRyxDQUFDO2dCQUN2RGtJLEtBQUssRUFBRW5qQixNQUFNLENBQUU2VixVQUFVLENBQUNzTixLQUFNLENBQUM7Z0JBQ2pDMU8sSUFBSSxFQUFFdFUsTUFBTSxDQUFFMFYsVUFBVSxDQUFDcEIsSUFBSSxJQUFJLEVBQUcsQ0FBQztnQkFDckMyTyx1QkFBdUIsRUFBRXBqQixNQUFNLENBQUU2VixVQUFVLENBQUN1Tix1QkFBd0IsQ0FBQztnQkFDckVDLHFCQUFxQixFQUFFcmpCLE1BQU0sQ0FBRTZWLFVBQVUsQ0FBQ3dOLHFCQUFzQixDQUFDO2dCQUNqRWpOLHFCQUFxQixFQUFFcFcsTUFBTSxDQUFFNlYsVUFBVSxDQUFDTyxxQkFBc0IsQ0FBQztnQkFDakVFLG9CQUFvQixFQUFFdFcsTUFBTSxDQUFFNlYsVUFBVSxDQUFDUyxvQkFBcUI7Y0FDL0QsQ0FBQztZQUNGLENBQUU7VUFDSCxDQUFDO1FBQ0YsQ0FBRSxDQUFDO1FBQ0hnSSxhQUFhLEVBQUU7VUFDZDNaLFlBQVksRUFBRTNFLE1BQU0sQ0FBRThPLFVBQVUsQ0FBQ21FLEtBQUssSUFBSW5FLFVBQVUsQ0FBQ21FLEtBQUssQ0FBQ3RPLFlBQWEsQ0FBQztVQUN6RUMsVUFBVSxFQUFFNUUsTUFBTSxDQUFFOE8sVUFBVSxDQUFDbUUsS0FBSyxJQUFJbkUsVUFBVSxDQUFDbUUsS0FBSyxDQUFDck8sVUFBVztRQUNyRSxDQUFDO1FBQ0R1QyxZQUFZLEVBQUVQLHlCQUF5QixDQUFFM0UsV0FBWSxDQUFDO1FBQ3REb0UsY0FBYyxFQUFFSyxJQUFJLENBQUNMO01BQ3RCLENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU2lkLGtCQUFrQkEsQ0FBQSxFQUFHO01BQzdCLElBQUlDLGdCQUFnQixHQUFHaGpCLE1BQU0sQ0FBQzBLLElBQUksQ0FBRWpLLGdCQUFpQixDQUFDLENBQUNzWixNQUFNLENBQUUsVUFBV29DLEtBQUssRUFBRTVTLFVBQVUsRUFBRztRQUM3RixPQUFPNFMsS0FBSyxHQUFHbmMsTUFBTSxDQUFDMEssSUFBSSxDQUFFakssZ0JBQWdCLENBQUU4SSxVQUFVLENBQUcsQ0FBQyxDQUFDRSxNQUFNO01BQ3BFLENBQUMsRUFBRSxDQUFFLENBQUM7TUFFTixPQUFPO1FBQ045SSxrQkFBa0IsRUFBRUEsa0JBQWtCO1FBQ3RDQyx1QkFBdUIsRUFBRUEsdUJBQXVCO1FBQ2hERyxrQkFBa0IsRUFBRUEsa0JBQWtCO1FBQ3RDa2lCLG1CQUFtQixFQUFFampCLE1BQU0sQ0FBQzBLLElBQUksQ0FBRTNLLHlCQUEwQixDQUFDO1FBQzdEbWpCLHlCQUF5QixFQUFFcGpCLDZCQUE2QixDQUFDMkosTUFBTTtRQUMvRHZKLGlCQUFpQixFQUFFRixNQUFNLENBQUMwSyxJQUFJLENBQUV4SyxpQkFBa0IsQ0FBQyxDQUFDZ0QsR0FBRyxDQUFFekQsTUFBTyxDQUFDO1FBQ2pFMGpCLG9CQUFvQixFQUFFbmpCLE1BQU0sQ0FBQzBLLElBQUksQ0FBRWxLLHVCQUF3QixDQUFDLENBQUNpSixNQUFNO1FBQ25FMlosdUJBQXVCLEVBQUVwakIsTUFBTSxDQUFDMEssSUFBSSxDQUFFakssZ0JBQWlCLENBQUMsQ0FBQ2dKLE1BQU07UUFDL0R1WixnQkFBZ0IsRUFBRUEsZ0JBQWdCLEdBQy9CaGpCLE1BQU0sQ0FBQzBLLElBQUksQ0FBRWhLLG1CQUFvQixDQUFDLENBQUMrSSxNQUFNO1FBQzVDNFosd0JBQXdCLEVBQUVyakIsTUFBTSxDQUFDMEssSUFBSSxDQUFFaEssbUJBQW9CLENBQUMsQ0FBQytJLE1BQU07UUFDbkU1SSwyQkFBMkIsRUFBRUEsMkJBQTJCO1FBQ3hEQyxnQ0FBZ0MsRUFBRUEsZ0NBQWdDO1FBQ2xFSyxpQ0FBaUMsRUFBRUEsaUNBQWlDO1FBQ3BFQyx1QkFBdUIsRUFBRUEsdUJBQXVCO1FBQ2hEQyw0QkFBNEIsRUFBRUE7TUFDL0IsQ0FBQztJQUNGOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTaWlCLFVBQVVBLENBQUEsRUFBRztNQUNyQixJQUFLLENBQUVwa0IsS0FBSyxJQUFJb0MsY0FBYyxFQUFHO1FBQ2hDO01BQ0Q7TUFDQUEsY0FBYyxHQUFHLElBQUk7TUFDckJwQyxLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsNkNBQTZDLEVBQUV0RCwrQkFBZ0MsQ0FBQztNQUN4Ry9nQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUseUNBQXlDLEVBQUV0aEIsMkJBQTRCLENBQUM7TUFDaEcvQyxLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsMENBQTBDLEVBQUVyRCw0QkFBNkIsQ0FBQztNQUNsR2hoQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsaURBQWlELEVBQUVwRCxtQ0FBb0MsQ0FBQztNQUNoSGpoQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsc0NBQXNDLEVBQUVwQix3QkFBeUIsQ0FBQztNQUMxRmpqQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsMkNBQTJDLEVBQUUxQixrQ0FBbUMsQ0FBQztNQUN6RzNpQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsNENBQTRDLEVBQUVuQiw2QkFBOEIsQ0FBQztNQUNyR2xqQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsdUNBQXVDLEVBQUVuQiw2QkFBOEIsQ0FBQztNQUNoR2xqQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsdUNBQXVDLEVBQUVuQiw2QkFBOEIsQ0FBQztNQUNoR2xqQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsd0NBQXdDLEVBQUVuQiw2QkFBOEIsQ0FBQztNQUNqR2xqQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsT0FBTyxFQUFFckMsa0JBQW1CLENBQUM7TUFDckRoaUIsS0FBSyxDQUFDcWtCLGdCQUFnQixDQUFFLE9BQU8sRUFBRTVCLGlCQUFrQixDQUFDO01BQ3BEemlCLEtBQUssQ0FBQ3FrQixnQkFBZ0IsQ0FBRSxRQUFRLEVBQUVoQyxtQkFBb0IsQ0FBQztNQUN2RHJpQixLQUFLLENBQUNxa0IsZ0JBQWdCLENBQUUsUUFBUSxFQUFFM0Isa0JBQW1CLENBQUM7TUFDdEQxaUIsS0FBSyxDQUFDcWtCLGdCQUFnQixDQUFFLE9BQU8sRUFBRS9CLG1CQUFvQixDQUFDO0lBQ3ZEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZ0MsT0FBT0EsQ0FBQSxFQUFHO01BQ2xCLElBQUssQ0FBRXRrQixLQUFLLElBQUksQ0FBRW9DLGNBQWMsRUFBRztRQUNsQztNQUNEO01BQ0FwQyxLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsNkNBQTZDLEVBQUV4RCwrQkFBZ0MsQ0FBQztNQUMzRy9nQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUseUNBQXlDLEVBQUV4aEIsMkJBQTRCLENBQUM7TUFDbkcvQyxLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsMENBQTBDLEVBQUV2RCw0QkFBNkIsQ0FBQztNQUNyR2hoQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsaURBQWlELEVBQUV0RCxtQ0FBb0MsQ0FBQztNQUNuSGpoQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsc0NBQXNDLEVBQUV0Qix3QkFBeUIsQ0FBQztNQUM3RmpqQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsMkNBQTJDLEVBQUU1QixrQ0FBbUMsQ0FBQztNQUM1RzNpQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsNENBQTRDLEVBQUVyQiw2QkFBOEIsQ0FBQztNQUN4R2xqQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsdUNBQXVDLEVBQUVyQiw2QkFBOEIsQ0FBQztNQUNuR2xqQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsdUNBQXVDLEVBQUVyQiw2QkFBOEIsQ0FBQztNQUNuR2xqQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsd0NBQXdDLEVBQUVyQiw2QkFBOEIsQ0FBQztNQUNwR2xqQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsT0FBTyxFQUFFdkMsa0JBQW1CLENBQUM7TUFDeERoaUIsS0FBSyxDQUFDdWtCLG1CQUFtQixDQUFFLE9BQU8sRUFBRTlCLGlCQUFrQixDQUFDO01BQ3ZEemlCLEtBQUssQ0FBQ3VrQixtQkFBbUIsQ0FBRSxRQUFRLEVBQUVsQyxtQkFBb0IsQ0FBQztNQUMxRHJpQixLQUFLLENBQUN1a0IsbUJBQW1CLENBQUUsUUFBUSxFQUFFN0Isa0JBQW1CLENBQUM7TUFDekQxaUIsS0FBSyxDQUFDdWtCLG1CQUFtQixDQUFFLE9BQU8sRUFBRWpDLG1CQUFvQixDQUFDO01BQ3pEM2hCLHdCQUF3QixHQUFHLEVBQUU7TUFDN0JDLDZCQUE2QixHQUFHLEVBQUU7TUFDbENDLHlCQUF5QixHQUFHQyxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDakRDLGlCQUFpQixHQUFHRixNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDekNELE1BQU0sQ0FBQzBLLElBQUksQ0FBRW5LLGtDQUFtQyxDQUFDLENBQUNxQixPQUFPLENBQUVxSCw0QkFBNkIsQ0FBQztNQUN6RjlJLDBCQUEwQixHQUFHSCxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDbERHLDRCQUE0QixHQUFHSixNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDcERJLDZCQUE2QixHQUFHTCxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDckRLLG9DQUFvQyxHQUFHTixNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDNURNLGtDQUFrQyxHQUFHUCxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7TUFDMURjLGtCQUFrQixHQUFHLFNBQVM7TUFDOUJGLDJCQUEyQixHQUFHLENBQUM7TUFDL0JDLGdDQUFnQyxHQUFHLENBQUM7TUFDcENJLGlDQUFpQyxHQUFHLENBQUM7TUFDckNDLGlDQUFpQyxHQUFHLEtBQUs7TUFDekNDLHVCQUF1QixHQUFHLElBQUk7TUFDOUJDLDRCQUE0QixHQUFHLElBQUk7TUFDbkNFLHNCQUFzQixHQUFHLEtBQUs7TUFDOUIsSUFBS0MseUJBQXlCLEVBQUc7UUFDaEMzQyxNQUFNLENBQUNtRCxZQUFZLENBQUVSLHlCQUEwQixDQUFDO1FBQ2hEQSx5QkFBeUIsR0FBRyxDQUFDO01BQzlCO01BQ0EySSx1QkFBdUIsQ0FBQyxDQUFDO01BQ3pCN0ksY0FBYyxHQUFHLEtBQUs7SUFDdkI7SUFFQSxPQUFPO01BQ05naUIsVUFBVSxFQUFFQSxVQUFVO01BQ3RCRSxPQUFPLEVBQUVBLE9BQU87TUFDaEJuWSxzQkFBc0IsRUFBRUEsc0JBQXNCO01BQzlDb0IsbUJBQW1CLEVBQUVBLG1CQUFtQjtNQUN4Q2MseUJBQXlCLEVBQUVBLHlCQUF5QjtNQUNwRGUsZ0JBQWdCLEVBQUVBLGdCQUFnQjtNQUNsQ0csZ0JBQWdCLEVBQUVBLGdCQUFnQjtNQUNsQ2lHLHdCQUF3QixFQUFFQSx3QkFBd0I7TUFDbEQwSyxlQUFlLEVBQUVBLGVBQWU7TUFDaEN6QixnQ0FBZ0MsRUFBRUEsZ0NBQWdDO01BQ2xFb0Ysa0JBQWtCLEVBQUVBLGtCQUFrQjtNQUN0Q1csNEJBQTRCLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ3pDLE9BQU83akIsd0JBQXdCO01BQ2hDO0lBQ0QsQ0FBQztFQUNGO0VBRUEsSUFDQ2hCLE1BQU0sQ0FBQ3llLHFCQUFxQixJQUN6QixVQUFVLEtBQUssT0FBT3plLE1BQU0sQ0FBQ3llLHFCQUFxQixDQUFDcUcsZ0JBQWdCLEVBQ3JFO0lBQ0Q5a0IsTUFBTSxDQUFDeWUscUJBQXFCLENBQUNxRyxnQkFBZ0IsQ0FBRTVrQixTQUFTLEVBQUVDLDJCQUE0QixDQUFDO0VBQ3hGO0FBQ0QsQ0FBQyxFQUFFSCxNQUFNLEVBQUVBLE1BQU0sQ0FBQ0MsRUFBRyxDQUFDIiwiaWdub3JlTGlzdCI6W119
