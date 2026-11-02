"use strict";

/**
 * Administration Timeline page-controller orchestration.
 *
 * The server owns all view data and WordPress templates. This controller only
 * mounts the page shell and delegates bounded-window composition, request
 * ownership, anchor restoration, toolbar/navigation, row rendering, row
 * synchronization, empty-range selection, and booking interactions to
 * registered modules.
 * Authorized reads and writes remain server-domain actions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document, wp) {
  'use strict';

  var module_id = 'page_controller';

  /**
   * Create the Timeline page controller behind the shared module lifecycle.
   *
   * The composition entry point supplies the server-owned mount, status region,
   * and configuration. Focused modules continue to own their bounded state
   * machines while this controller coordinates their page-level interactions.
   *
   * @param {Object}       context               Controller construction context.
   * @param {Element}      context.mount         Timeline mount element.
   * @param {Element|null} context.status_region Accessible live-status region.
   * @param {Object}       context.settings      Server-localized configuration.
   * @return {Object} Initialize and destroy lifecycle methods.
   */
  function create_timeline_page_controller(context) {
    var settings = context && context.settings ? context.settings : {};
    var mount = context && context.mount ? context.mount : null;
    var status_region = context && context.status_region ? context.status_region : null;
    var overflow_tooltip_frame = 0;
    var edge_status_frame = 0;
    var foreground_request_focus = null;
    var foreground_request_loading_message = '';
    var edge_observer = null;
    var edge_scroll_frame = 0;
    var initial_canvas_ready_frame = 0;
    var empty_range_selection_controller = null;
    var booking_interactions_controller = null;
    var rendering_controller = null;
    var window_cache_controller = null;
    var availability_cache_controller = null;
    var availability_failure_announced = false;
    var toolbar_navigation_controller = null;
    var resource_navigation_controller = null;
    var resource_settings_controller = null;
    var axis_scroll_canvas = null;
    var is_axis_window_loading_locked = false;
    var is_initialized = false;
    var lifecycle_generation = 0;
    var preferences_save_timer = 0;
    var preferences_save_request = null;
    var preferences_save_pending = false;
    var preferences_reset_pending = false;
    var preferences_reset_button = null;
    var preferences_reset_barrier_complete = true;
    var accepted_booking_generation = 0;
    var accepted_availability_generation = 0;
    var authoritative_readback_generation = 0;
    var booking_creation_host_enabled = Boolean(settings.new_booking && settings.new_booking.launch_context);
    var active_booking_creation_readback_id = '';
    var completed_booking_creation_readback_ids = {};
    var completed_booking_creation_readback_order = [];
    var is_foreground_request_loading = false;
    var is_availability_loading = false;
    var is_selection_apply_loading = false;
    var selection_apply_loading_message = '';
    var extension_instance_ids = [];
    var preference_anchor_date = settings.preferences && settings.preferences.anchor_date ? String(settings.preferences.anchor_date) : String(settings.window && settings.window.start_date ? settings.window.start_date : '');
    var preference_anchor_ratio = settings.preferences && Number.isFinite(Number(settings.preferences.anchor_ratio)) ? Number(settings.preferences.anchor_ratio) : 0;
    var empty_range_selection_instance_id = 'wpbc_timeline_empty_range_selection';
    var booking_interactions_instance_id = 'wpbc_timeline_booking_interactions';
    var rendering_instance_id = 'wpbc_timeline_rendering';
    var window_cache_instance_id = 'wpbc_timeline_window_cache';
    var availability_cache_instance_id = 'wpbc_timeline_availability_cache';
    var toolbar_navigation_instance_id = 'wpbc_timeline_toolbar_navigation';
    var resource_navigation_instance_id = 'wpbc_timeline_resource_navigation';
    var resource_settings_instance_id = 'wpbc_timeline_resource_settings';

    /**
     * Return one server-allow-listed WordPress template renderer.
     *
     * @param {string} template_key Stable key inside the selected template pack.
     * @return {Function|null} WordPress template renderer or null.
     */
    function get_template(template_key) {
      var template_id = settings.templates && settings.templates[template_key];
      if (!template_id || !wp || 'function' !== typeof wp.template) {
        return null;
      }
      return wp.template(template_id);
    }

    /**
     * Render one allow-listed WordPress template into an existing host.
     *
     * @param {Element|null} target Target element.
     * @param {string} template_key Template-pack key.
     * @param {Object} view_model Authorized template data.
     * @return {boolean} True when a template was rendered.
     */
    function render_template(target, template_key, view_model) {
      var template = get_template(template_key);
      if (!target || !template) {
        return false;
      }
      target.innerHTML = template(view_model);
      return true;
    }

    /**
     * Emit one neutral accepted-data lifecycle notification from the mount.
     *
     * Event detail contains shallow controller records and read-only references to
     * accepted DTOs. Consumers receive no cache controller or mutation authority.
     *
     * @param {string} event_name Stable accepted-data event suffix.
     * @param {Object} event_detail Executable-free notification detail.
     * @return {void}
     */
    function emit_accepted_data_event(event_name, event_detail) {
      var accepted_event;
      if (!extension_instance_ids.length || !mount || 'function' !== typeof mount.dispatchEvent) {
        return;
      }
      if ('function' === typeof window.CustomEvent) {
        accepted_event = new window.CustomEvent('wpbc:timeline:data:' + event_name, {
          detail: event_detail
        });
      } else if (document.createEvent) {
        accepted_event = document.createEvent('CustomEvent');
        accepted_event.initCustomEvent('wpbc:timeline:data:' + event_name, false, false, event_detail);
      }
      if (accepted_event) {
        mount.dispatchEvent(accepted_event);
      }
    }

    /**
     * Announce one mutation-triggered canonical readback lifecycle.
     *
     * The notification exposes only neutral scalar state. It does not grant
     * request, mutation, or cache authority to presentation extensions.
     *
     * @param {string} reason Stable readback reason.
     * @return {number} Monotonic readback generation.
     */
    function begin_authoritative_readback(reason) {
      authoritative_readback_generation += 1;
      emit_accepted_data_event('authoritative-readback-state', {
        schema_version: 1,
        generation: authoritative_readback_generation,
        state: 'loading',
        reason: String(reason || '')
      });
      return authoritative_readback_generation;
    }

    /**
     * Complete one current mutation-triggered canonical readback lifecycle.
     *
     * Superseded completions are ignored so a late request cannot clear the busy
     * state belonging to a newer authoritative readback.
     *
     * @param {number} generation Readback generation returned at start.
     * @param {string} state Accepted or failed terminal state.
     * @param {string} reason Stable readback reason.
     * @return {void}
     */
    function complete_authoritative_readback(generation, state, reason) {
      if (generation !== authoritative_readback_generation) {
        return;
      }
      emit_accepted_data_event('authoritative-readback-state', {
        schema_version: 1,
        generation: generation,
        state: 'accepted' === state ? 'accepted' : 'failed',
        reason: String(reason || '')
      });
      if ('accepted' !== state && ['availability_mutation', 'booking_inspector', 'booking_geometry', 'booking_creation'].indexOf(String(reason || '')) !== -1) {
        set_availability_loading(false);
      }
    }

    /**
     * Bind a canonical readback promise to its neutral lifecycle notification.
     *
     * @param {Object|null} request jQuery-compatible readback promise.
     * @param {number} generation Readback generation returned at start.
     * @param {string} reason Stable readback reason.
     * @return {Object|null} Original promise for the mutation owner.
     */
    function track_authoritative_readback(request, generation, reason) {
      if (!request || 'function' !== typeof request.done || 'function' !== typeof request.fail) {
        complete_authoritative_readback(generation, 'failed', reason);
        return request;
      }
      request.done(function () {
        complete_authoritative_readback(generation, 'accepted', reason);
      }).fail(function () {
        complete_authoritative_readback(generation, 'failed', reason);
      });
      return request;
    }

    /**
     * Notify read-only consumers of the complete accepted bounded booking cache.
     *
     * @param {Array<Object>} window_entries Native ordered cache snapshot.
     * @return {void}
     */
    function notify_accepted_booking_windows(window_entries) {
      if (!Array.isArray(window_entries)) {
        return;
      }
      accepted_booking_generation += 1;
      emit_accepted_data_event('booking-windows-accepted', {
        schema_version: 1,
        generation: accepted_booking_generation,
        current_window_key: String(settings.window_context && settings.window_context.window_key || ''),
        resource_fingerprint: String(settings.window_context && settings.window_context.resource_fingerprint || ''),
        timezone: String(settings.window && settings.window.timezone || ''),
        windows: window_entries
      });
    }

    /**
     * Build one complete toolbar preference snapshot from authorized state.
     *
     * @return {Object|null} Preference payload, or null before a window exists.
     */
    function get_timeline_preferences_snapshot() {
      var timeline_window = settings.window || {};
      var current_view = settings.current_axis && settings.current_axis.view ? settings.current_axis.view : settings.axis ? settings.axis.view : '';
      var visual_zoom_percent = toolbar_navigation_controller && 'function' === typeof toolbar_navigation_controller.get_visual_zoom_percent ? toolbar_navigation_controller.get_visual_zoom_percent() : Number(settings.preferences && settings.preferences.visual_zoom_percent) || 100;
      if (!preference_anchor_date || !current_view || !Number(timeline_window.window_days) && !Number(timeline_window.window_months)) {
        return null;
      }
      return {
        anchor_date: preference_anchor_date,
        anchor_ratio: Math.max(0, Math.min(1, preference_anchor_ratio)),
        window_days: Number(timeline_window.window_months) ? 0 : Number(timeline_window.window_days),
        window_months: Number(timeline_window.window_months) || 0,
        view: String(current_view),
        visual_zoom_percent: Number(visual_zoom_percent)
      };
    }

    /**
     * Send the newest complete preference snapshot without overlapping writes.
     *
     * @return {void}
     */
    function flush_timeline_preferences_save() {
      var transport = settings.transport && settings.transport.preferences ? settings.transport.preferences : {};
      var snapshot;
      preferences_save_timer = 0;
      if (preferences_save_request) {
        preferences_save_pending = true;
        return;
      }
      if (!preferences_save_pending || !window.jQuery || !settings.transport || !settings.transport.url || !transport.action || !transport.nonce) {
        return;
      }
      snapshot = get_timeline_preferences_snapshot();
      preferences_save_pending = false;
      if (!snapshot) {
        return;
      }
      preferences_save_request = window.jQuery.ajax({
        url: settings.transport.url,
        method: 'POST',
        dataType: 'json',
        data: Object.assign({}, snapshot, {
          action: transport.action,
          nonce: transport.nonce
        })
      }).always(function () {
        preferences_save_request = null;
        if (preferences_reset_pending && is_initialized) {
          flush_timeline_preferences_reset();
          return;
        }
        if (preferences_save_pending && is_initialized) {
          flush_timeline_preferences_save();
        }
      });
    }

    /**
     * Queue a serialized per-user preference save after explicit UI changes.
     *
     * @param {Object} preference_overrides Optional anchor fields for cached navigation.
     * @return {void}
     */
    function queue_timeline_preferences_save(preference_overrides) {
      var overrides = preference_overrides && 'object' === typeof preference_overrides ? preference_overrides : {};
      if (overrides.anchor_date) {
        preference_anchor_date = String(overrides.anchor_date);
      }
      if (Number.isFinite(Number(overrides.anchor_ratio))) {
        preference_anchor_ratio = Number(overrides.anchor_ratio);
      }
      preferences_save_pending = true;
      if (preferences_save_request || preferences_save_timer) {
        return;
      }
      preferences_save_timer = window.setTimeout(flush_timeline_preferences_save, 250);
    }

    /**
     * Update the in-memory opening anchor without scheduling persistence.
     *
     * Reset uses this before its default refresh so a later Density change saves
     * the new current-date position instead of reviving the cleared position.
     *
     * @param {string} anchor_date Site-local calendar date.
     * @param {number} anchor_ratio Visible-position ratio.
     * @return {void}
     */
    function set_timeline_preference_anchor(anchor_date, anchor_ratio) {
      preference_anchor_date = String(anchor_date || '');
      preference_anchor_ratio = Math.max(0, Math.min(1, Number(anchor_ratio) || 0));
    }

    /**
     * Perform one serialized, authorized toolbar preference reset.
     *
     * @return {void}
     */
    function flush_timeline_preferences_reset() {
      var transport = settings.transport && settings.transport.preferences ? settings.transport.preferences : {};
      var reset_button = preferences_reset_button;
      var default_request_dispatched = false;
      if (preferences_save_request || !preferences_reset_pending || !preferences_reset_barrier_complete) {
        return;
      }
      if (!window.jQuery || !settings.transport || !settings.transport.url || !transport.reset_action || !transport.nonce) {
        preferences_reset_pending = false;
        if (reset_button) {
          reset_button.removeAttribute('aria-disabled');
        }
        show_standard_admin_message(settings.i18n.timeline_reset_failed, 'error', 30000);
        set_foreground_request_loading(false, '', 0);
        return;
      }
      preferences_reset_pending = false;
      preferences_save_request = window.jQuery.ajax({
        url: settings.transport.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: transport.reset_action,
          nonce: transport.nonce
        }
      }).done(function (response) {
        if (response && response.success && response.data && response.data.resource_view_context && toolbar_navigation_controller && 'function' === typeof toolbar_navigation_controller.reset_to_defaults) {
          settings.resource_view = response.data.resource_view || {};
          settings.resource_pagination = response.data.resource_pagination || {};
          settings.window_context = Object.assign({}, settings.window_context || {}, {
            resource_view_context: String(response.data.resource_view_context)
          });
          settings.preferences = Object.assign({}, settings.preferences || {}, {
            expanded_resource_ids: [],
            expanded_parent_ids: []
          });
          if (resource_navigation_controller && 'function' === typeof resource_navigation_controller.refresh) {
            resource_navigation_controller.refresh(settings.resource_view, settings.resource_pagination);
          }
          emit_accepted_data_event('preferences-reset', {
            schema_version: 1
          });
          default_request_dispatched = toolbar_navigation_controller.reset_to_defaults();
        }
        if (!default_request_dispatched) {
          show_standard_admin_message(settings.i18n.timeline_reset_failed, 'error', 30000);
        }
      }).fail(function (request) {
        var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};
        show_standard_admin_message(error.message || settings.i18n.timeline_reset_failed, 'error', 30000);
      }).always(function () {
        preferences_save_request = null;
        preferences_reset_button = null;
        if (reset_button) {
          reset_button.removeAttribute('aria-disabled');
        }
        if (!default_request_dispatched) {
          set_foreground_request_loading(false, '', 0);
        }
        if (preferences_save_pending && is_initialized) {
          flush_timeline_preferences_save();
        }
      });
    }

    /**
     * Queue a reset after any already-started preference save finishes.
     *
     * @param {HTMLButtonElement|null} reset_button Initiating toolbar control.
     * @return {void}
     */
    function queue_timeline_preferences_reset(reset_button) {
      var reset_waiters = [];
      var reset_requested_event;
      var wait_until = function (promise) {
        if (promise && 'function' === typeof promise.then) {
          reset_waiters.push(promise);
        }
      };
      if (preferences_reset_pending) {
        return;
      }
      if (preferences_save_timer) {
        window.clearTimeout(preferences_save_timer);
        preferences_save_timer = 0;
      }
      preferences_save_pending = false;
      preferences_reset_pending = true;
      preferences_reset_barrier_complete = false;
      preferences_reset_button = reset_button || null;
      if (preferences_reset_button) {
        preferences_reset_button.setAttribute('aria-disabled', 'true');
      }
      set_foreground_request_loading(true, settings.i18n.resetting_timeline, 0);
      if (mount && 'function' === typeof mount.dispatchEvent && 'function' === typeof window.CustomEvent) {
        reset_requested_event = new window.CustomEvent('wpbc:timeline:preferences:reset-requested', {
          detail: {
            schema_version: 1,
            wait_until: wait_until
          }
        });
        mount.dispatchEvent(reset_requested_event);
      }
      window.Promise.all(reset_waiters.map(function (waiter) {
        return window.Promise.resolve(waiter).catch(function () {
          return null;
        });
      })).then(function () {
        preferences_reset_barrier_complete = true;
        if (!preferences_save_request && preferences_reset_pending && is_initialized) {
          flush_timeline_preferences_reset();
        }
      });
    }

    /**
     * Create the bounded-window cache and anchor controller.
     *
     * The module owns authorized response composition and request generations.
     * This page controller retains only DOM rendering and domain adapter handoff.
     *
     * @return {void}
     */
    function initialize_window_cache() {
      var module_runtime = window.wpbc_timeline_modules;
      if (!module_runtime || 'function' !== typeof module_runtime.create) {
        return;
      }
      window_cache_controller = module_runtime.create('window_cache', window_cache_instance_id, {
        mount: mount,
        settings: settings,
        synchronize_axis_scroll: synchronize_axis_scroll
      });
    }

    /**
     * Destroy the bounded-window controller created for this page instance.
     *
     * @return {void}
     */
    function destroy_window_cache() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        module_runtime.destroy(window_cache_instance_id);
      } else if (window_cache_controller && 'function' === typeof window_cache_controller.destroy) {
        window_cache_controller.destroy();
      }
      window_cache_controller = null;
    }

    /**
     * Initialize executable-free server-registered browser extensions.
     *
     * The shared controller understands only module and instance identities. Each
     * extension owns its data subscriptions, templates, caches, and presentation.
     *
     * @return {void}
     */
    function initialize_extensions() {
      var module_runtime = window.wpbc_timeline_modules;
      var stable_identifier = /^[a-z][a-z0-9_-]{0,63}$/;
      if (!module_runtime || 'function' !== typeof module_runtime.create) {
        return;
      }
      extension_instance_ids = [];
      (Array.isArray(settings.extensions) ? settings.extensions : []).forEach(function (extension) {
        var module_id = extension && 'string' === typeof extension.module_id ? extension.module_id : '';
        var instance_id = extension && 'string' === typeof extension.instance_id ? extension.instance_id : '';
        var capabilities = extension && Array.isArray(extension.capabilities) ? extension.capabilities : [];
        var extension_context;
        var extension_instance;
        if (!stable_identifier.test(module_id) || !stable_identifier.test(instance_id)) {
          return;
        }
        if ('function' === typeof module_runtime.has_factory && !module_runtime.has_factory(module_id)) {
          return;
        }
        extension_context = {
          mount: mount,
          presentation_api: {
            open_first: function (presentation_id) {
              return rendering_controller && 'function' === typeof rendering_controller.open_first_row_presentation ? rendering_controller.open_first_row_presentation(presentation_id) : 0;
            }
          },
          configuration: extension.configuration && 'object' === typeof extension.configuration ? extension.configuration : {}
        };
        if (capabilities.indexOf('selection_actions') !== -1) {
          extension_context.selection_api = {
            get_request_context: get_extension_selection_request_context,
            refresh_after_apply: function () {
              return refresh_after_availability_mutation(false);
            },
            announce: announce,
            is_host_active: function () {
              return is_initialized;
            }
          };
        }
        extension_instance = module_runtime.create(module_id, instance_id, extension_context);
        if (extension_instance) {
          extension_instance_ids.push(instance_id);
        }
      });
    }

    /**
     * Notify extensions after the initial accepted canvas has reached a paint boundary.
     *
     * Two animation frames keep the initial native Timeline render distinct from
     * an optional domain-owned presentation reveal. The event is one-shot for the
     * page-controller lifecycle and grants no request, cache, or mutation access.
     *
     * @return {void}
     */
    function schedule_initial_canvas_ready() {
      var ready_generation = lifecycle_generation;
      if (!extension_instance_ids.length || initial_canvas_ready_frame) {
        return;
      }
      initial_canvas_ready_frame = window.requestAnimationFrame(function () {
        initial_canvas_ready_frame = window.requestAnimationFrame(function () {
          initial_canvas_ready_frame = 0;
          if (!is_initialized || ready_generation !== lifecycle_generation) {
            return;
          }
          emit_accepted_data_event('initial-canvas-ready', {
            schema_version: 1,
            generation: ready_generation
          });
        });
      });
    }

    /**
     * Destroy every browser extension created for this Timeline instance.
     *
     * @return {void}
     */
    function destroy_extensions() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        extension_instance_ids.forEach(function (instance_id) {
          module_runtime.destroy(instance_id);
        });
      }
      extension_instance_ids = [];
    }

    /**
     * Create the independent lazy Availability transport and cache controller.
     *
     * The module is optional until its compiler-owned runtime asset exists. Its
     * absence or any later read failure must not affect booking-window rendering.
     *
     * @return {void}
     */
    function initialize_availability_cache() {
      var module_runtime = window.wpbc_timeline_modules;
      if (!module_runtime || 'function' !== typeof module_runtime.has_factory || 'function' !== typeof module_runtime.create || !module_runtime.has_factory('availability_cache')) {
        return;
      }
      availability_cache_controller = module_runtime.create('availability_cache', availability_cache_instance_id, {
        mount: mount,
        settings: settings,
        get_axis: function () {
          return settings.axis || {};
        },
        get_geometry: get_composed_segment_geometry,
        on_change: handle_availability_cache_change,
        on_status_change: handle_availability_cache_status_change
      });
    }

    /**
     * Announce the first lazy Availability failure without interrupting Timeline.
     *
     * A page-lifetime guard prevents the previous/current/next parallel reads
     * from repeating the same contextual message. Loaded intervals remain
     * decorative and are never announced individually.
     *
     * @param {Object} change Availability cache state notification.
     * @return {void}
     */
    function handle_availability_cache_change(change) {
      accepted_availability_generation += 1;
      emit_accepted_data_event('availability-accepted', Object.assign({}, change || {}, {
        schema_version: 1,
        generation: accepted_availability_generation
      }));
      if (availability_failure_announced || !change || 'neutral' !== change.state || !settings.i18n || !settings.i18n.availability_load_failed) {
        return;
      }
      availability_failure_announced = true;
      announce(settings.i18n.availability_load_failed);
    }

    /**
     * Reflect aggregate lazy Availability progress in the shared blocking overlay.
     *
     * These records never enter the accepted-data stream. They describe only the
     * current desired-window read lifecycle and cannot authorize or replace data.
     * The overlay remains active until every desired background read settles, so
     * the visible Timeline never appears complete while its unavailable-time
     * projection is still being assembled.
     *
     * @param {Object} status Aggregate Availability cache status.
     * @return {void}
     */
    function handle_availability_cache_status_change(status) {
      var was_loading;
      if (!status || 1 !== Number(status.schema_version) || 'invalidated' === status.state) {
        return;
      }
      if (!Boolean(status.is_settled) || 0 < Number(status.pending_count)) {
        set_availability_loading(true);
        return;
      }
      was_loading = is_availability_loading;
      set_availability_loading(false);
      if (was_loading && Number(status.loaded_count) === Number(status.desired_count) && 0 === Number(status.failed_count)) {
        announce(settings.i18n.timeline_refresh_complete);
      }
    }

    /**
     * Toggle the Availability hold on the shared Timeline blocking overlay.
     *
     * @param {boolean} is_loading Whether one or more desired reads remain pending.
     * @return {void}
     */
    function set_availability_loading(is_loading) {
      var should_show = Boolean(is_loading);
      if (should_show === is_availability_loading) {
        return;
      }
      is_availability_loading = should_show;
      if (should_show) {
        announce(settings.i18n.loading_availability_backgrounds);
      }
      update_timeline_blocking_loading_state();
    }

    /**
     * Mirror accepted booking windows into the independent Availability cache.
     *
     * This call intentionally returns no promise. Booking rows and navigation
     * remain independently authoritative while Availability loads, fails, or is
     * superseded. The page controller separately blocks interaction until the
     * aggregate background lifecycle settles.
     *
     * @param {Array<Object>} window_entries Native ordered cache snapshot.
     * @return {void}
     */
    function synchronize_availability_cache(window_entries) {
      if (!availability_cache_controller || 'function' !== typeof availability_cache_controller.synchronize || !Array.isArray(window_entries)) {
        return;
      }
      availability_cache_controller.synchronize(window_entries);
    }

    /**
     * Drop cached unavailable intervals after an authoritative mutation.
     *
     * The booking-window identity can remain unchanged after resizing a booking
     * or applying a manual block. The independent Availability cache must
     * therefore be invalidated explicitly before canonical readback; the normal
     * row-render lifecycle will synchronize and reload the bounded windows.
     *
     * @return {void}
     */
    function invalidate_availability_cache() {
      if (availability_cache_controller && 'function' === typeof availability_cache_controller.invalidate) {
        availability_cache_controller.invalidate();
      }
    }

    /**
     * Abort lazy Availability reads and release their bounded cache.
     *
     * @return {void}
     */
    function destroy_availability_cache() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        module_runtime.destroy(availability_cache_instance_id);
      } else if (availability_cache_controller && 'function' === typeof availability_cache_controller.destroy) {
        availability_cache_controller.destroy();
      }
      availability_cache_controller = null;
      availability_failure_announced = false;
    }

    /**
     * Cancel the active empty-range draft before explicit Timeline navigation.
     *
     * Navigation replaces the logical axis, so retaining a draft would expose
     * stale cell indexes to the independently owned selection controller.
     *
     * @return {void}
     */
    function cancel_active_empty_range_selection() {
      if (empty_range_selection_controller && empty_range_selection_controller.is_active()) {
        empty_range_selection_controller.cancel(false);
      }
    }

    /**
     * Create the extracted toolbar and navigation controller.
     *
     * The module owns range/scale selection, date navigation, presentation-only
     * density, and axis-cell keyboard movement. Timeline retains authoritative
     * window requests, bounded cache state, rendering, and cross-module priority.
     *
     * @return {boolean} True when toolbar and navigation initialized.
     */
    function initialize_toolbar_navigation() {
      var module_runtime = window.wpbc_timeline_modules;
      if (!module_runtime || 'function' !== typeof module_runtime.has_factory || 'function' !== typeof module_runtime.create || !module_runtime.has_factory('toolbar_navigation')) {
        return false;
      }
      toolbar_navigation_controller = module_runtime.create('toolbar_navigation', toolbar_navigation_instance_id, {
        mount: mount,
        settings: settings,
        window_cache: window_cache_controller,
        callbacks: {
          announce: announce,
          cancel_anchor_restoration: cancel_axis_anchor_restoration,
          suspend_adjacent_loading: suspend_adjacent_loading_for_navigation,
          schedule_overflow_tooltips: schedule_overflow_tooltip_synchronization,
          schedule_edge_status: schedule_edge_status_positioning,
          schedule_booking_layout: schedule_booking_interaction_layout_after_axis_motion,
          cancel_active_selection: cancel_active_empty_range_selection,
          restore_loaded_anchor: restore_loaded_anchor,
          request_window: request_window,
          add_current_window_span: add_current_window_span,
          activate_adjacent_intent: activate_adjacent_navigation_intent,
          request_adjacent_window: request_adjacent_window,
          synchronize_axis_scroll: synchronize_axis_scroll,
          save_preferences: queue_timeline_preferences_save,
          reset_preferences: queue_timeline_preferences_reset,
          set_preference_anchor: set_timeline_preference_anchor
        }
      });
      return Boolean(toolbar_navigation_controller);
    }

    /**
     * Destroy and forget the extracted toolbar/navigation controller.
     *
     * @return {void}
     */
    function destroy_toolbar_navigation() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        module_runtime.destroy(toolbar_navigation_instance_id);
      } else if (toolbar_navigation_controller && 'function' === typeof toolbar_navigation_controller.destroy) {
        toolbar_navigation_controller.destroy();
      }
      toolbar_navigation_controller = null;
    }

    /**
     * Create the focused Resource selector and Resource pagination controller.
     *
     * The module receives only presentation state plus the page controller's
     * signed Resource-context replacement function. It cannot inject Resource
     * identifiers into window reads or mutate the bounded cache directly.
     *
     * @return {boolean} True when the optional source/runtime module initialized.
     */
    function initialize_resource_navigation() {
      var module_runtime = window.wpbc_timeline_modules;
      if (!module_runtime || 'function' !== typeof module_runtime.has_factory || 'function' !== typeof module_runtime.create || !module_runtime.has_factory('resource_navigation')) {
        return false;
      }
      resource_navigation_controller = module_runtime.create('resource_navigation', resource_navigation_instance_id, {
        mount: mount,
        settings: settings,
        announce: announce,
        show_admin_message: show_standard_admin_message,
        replace_resource_view: replace_resource_view
      });
      return Boolean(resource_navigation_controller);
    }

    /**
     * Destroy and forget the focused Resource navigation controller.
     *
     * @return {void}
     */
    function destroy_resource_navigation() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        module_runtime.destroy(resource_navigation_instance_id);
      } else if (resource_navigation_controller && 'function' === typeof resource_navigation_controller.destroy) {
        resource_navigation_controller.destroy();
      }
      resource_navigation_controller = null;
    }

    /**
     * Create the focused Resource row-actions and settings-inspector adapter.
     *
     * The adapter receives presentation state only. Shared dropdown and inspector
     * components own their lifecycle while server endpoints remain authoritative.
     *
     * @return {boolean} True when the optional source/runtime module initialized.
     */
    function initialize_resource_settings() {
      var module_runtime = window.wpbc_timeline_modules;
      if (!module_runtime || 'function' !== typeof module_runtime.has_factory || 'function' !== typeof module_runtime.create || !module_runtime.has_factory('resource_settings')) {
        return false;
      }
      resource_settings_controller = module_runtime.create('resource_settings', resource_settings_instance_id, {
        mount: mount,
        settings: settings,
        announce: announce,
        refresh_after_mutation: refresh_after_resource_settings_mutation
      });
      return Boolean(resource_settings_controller);
    }

    /**
     * Destroy and forget the focused Resource-settings adapter.
     *
     * @return {void}
     */
    function destroy_resource_settings() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        module_runtime.destroy(resource_settings_instance_id);
      } else if (resource_settings_controller && 'function' === typeof resource_settings_controller.destroy) {
        resource_settings_controller.destroy();
      }
      resource_settings_controller = null;
    }

    /**
     * Refresh the current canonical window after a Resource preference mutation.
     *
     * The Resource-settings adapter closes its shared Inspector first. Timeline
     * then owns signed readback, stale-response rejection, bounded cache
     * replacement, date-anchor restoration, and normal loading feedback.
     *
     * @return {Object|null} jQuery-compatible promise for canonical Timeline readback.
     */
    function refresh_after_resource_settings_mutation() {
      var anchor = capture_axis_anchor();
      var readback_generation = begin_authoritative_readback('resource_settings');
      return track_authoritative_readback(request_window(add_current_window_span({
        anchor_at: anchor.at,
        anchor_ratio: anchor.ratio,
        window_position: 0,
        view: settings.current_axis ? settings.current_axis.view : settings.axis.view
      }, true), anchor, true, {
        loading: settings.i18n.reloading_timeline,
        complete: settings.i18n.status_ready,
        suppress_complete_message: true,
        preserve_selection: true
      }), readback_generation, 'resource_settings');
    }

    /**
     * Build bounded, non-authoritative return context for selection preview.
     *
     * The empty-range module owns request state, while Timeline remains the owner
     * of its current cached window and physical anchor.
     *
     * @return {Object} Current Timeline presentation context.
     */
    function get_empty_range_selection_return_context() {
      var anchor = capture_axis_anchor();
      return {
        window_days: Number(settings.window.window_days) || 0,
        window_months: Number(settings.window.window_months) || 0,
        view: settings.axis.view,
        anchor_at: anchor.at,
        anchor_ratio: anchor.ratio
      };
    }

    /**
     * Return signed selection context from each cached authorized window.
     *
     * @return {Array<string>} Bounded loaded-window context tokens.
     */
    function get_loaded_empty_range_selection_context_tokens() {
      return window_cache_controller ? window_cache_controller.get_selection_context_tokens() : [];
    }

    /**
     * Build the bounded request context shared by registered selection adapters.
     *
     * Timeline remains the owner of signed loaded-window coverage, return-anchor
     * state, request timeout, and the existing preview/apply transport. Extensions
     * receive a fresh scalar/array snapshot for each explicit request and cannot
     * replace cache state through this read boundary.
     *
     * @return {Object} Current selection request and transport context.
     */
    function get_extension_selection_request_context() {
      var selection_transport = settings.transport && settings.transport.selection ? settings.transport.selection : {};
      return {
        transport: {
          url: String(settings.transport && settings.transport.url ? settings.transport.url : ''),
          preview_action: String(selection_transport.preview_action || ''),
          apply_action: String(selection_transport.apply_action || ''),
          preview_nonce: String(selection_transport.preview_nonce || ''),
          apply_nonce: String(selection_transport.apply_nonce || '')
        },
        view: String(settings.axis && settings.axis.view ? settings.axis.view : ''),
        loaded_start_at: String(settings.axis && settings.axis.start_at ? settings.axis.start_at : ''),
        loaded_end_at: String(settings.axis && settings.axis.end_at ? settings.axis.end_at : ''),
        loaded_context_tokens: get_loaded_empty_range_selection_context_tokens().slice(0, 3),
        return_context: get_empty_range_selection_return_context(),
        request_timeout_ms: get_window_loading_limits().request_timeout_ms
      };
    }

    /**
     * Refresh the current Timeline after an authoritative Availability mutation.
     *
     * @return {Object|null} jQuery-compatible promise for canonical Timeline readback.
     */
    function refresh_after_availability_mutation() {
      var anchor = capture_axis_anchor();
      var readback_generation = begin_authoritative_readback('availability_mutation');
      invalidate_availability_cache();
      return track_authoritative_readback(request_window(add_current_window_span({
        anchor_at: anchor.at,
        anchor_ratio: anchor.ratio,
        window_position: 0,
        view: settings.axis.view
      }, true), anchor, true, {
        loading: settings.i18n.applying_availability,
        complete: settings.i18n.status_ready,
        preserve_selection: true,
        suppress_complete_message: true
      }), readback_generation, 'availability_mutation');
    }

    /**
     * Refresh Availability after the reusable Block Times component saves.
     *
     * The Block Times domain owns the mutation and its result. Timeline owns only
     * its cached read model, so it performs canonical readback, reports the later
     * read lifecycle without duplicating the mutation result, and keeps the current
     * anchor and selection.
     *
     * @param {CustomEvent} event Normalized Availability mutation notification.
     * @return {void}
     */
    function handle_availability_timeslots_changed(event) {
      var change = event && event.detail ? event.detail : {};
      if (!is_initialized || 1 !== Number(change.schema_version) || 1 > Number(change.resource_id) || ['block', 'unblock'].indexOf(String(change.mode || '')) === -1) {
        return;
      }
      refresh_after_availability_mutation();
    }

    /**
     * Create the extracted empty-range state machine through the module registry.
     *
     * @return {boolean} True when the focused module initialized.
     */
    function initialize_empty_range_selection() {
      var module_runtime = window.wpbc_timeline_modules;
      if (!module_runtime || 'function' !== typeof module_runtime.has_factory || 'function' !== typeof module_runtime.create || !module_runtime.has_factory('empty_range_selection')) {
        return false;
      }
      empty_range_selection_controller = module_runtime.create('empty_range_selection', empty_range_selection_instance_id, {
        mount: mount,
        settings: settings,
        get_template: get_template,
        get_segment_geometry: get_composed_segment_geometry,
        get_return_context: get_empty_range_selection_return_context,
        get_loaded_context_tokens: get_loaded_empty_range_selection_context_tokens,
        get_request_timeout_ms: function () {
          return get_window_loading_limits().request_timeout_ms;
        },
        refresh_after_apply: refresh_after_availability_mutation,
        set_apply_loading: set_selection_apply_loading,
        announce: announce,
        is_host_active: function () {
          return is_initialized;
        }
      });
      return Boolean(empty_range_selection_controller);
    }

    /**
     * Destroy and forget the extracted empty-range controller.
     *
     * @return {void}
     */
    function destroy_empty_range_selection() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        module_runtime.destroy(empty_range_selection_instance_id);
      } else if (empty_range_selection_controller && 'function' === typeof empty_range_selection_controller.destroy) {
        empty_range_selection_controller.destroy();
      }
      empty_range_selection_controller = null;
    }

    /**
     * Refresh the current window after an accepted Inspector save event.
     *
     * The booking-interactions module owns event generation and Overview cache
     * invalidation. Timeline retains its canonical window request, anchor, stale
     * response, loading, and rendering responsibilities.
     *
     * @return {Object|null} jQuery-compatible promise for canonical Timeline readback.
     */
    function refresh_after_booking_inspector_save() {
      var anchor = capture_axis_anchor();
      var readback_generation = begin_authoritative_readback('booking_inspector');
      invalidate_availability_cache();
      return track_authoritative_readback(request_window(add_current_window_span({
        anchor_at: anchor.at,
        anchor_ratio: anchor.ratio,
        window_position: 0,
        view: settings.current_axis ? settings.current_axis.view : settings.axis.view
      }, true), anchor, true, {
        loading: settings.i18n.reloading_timeline,
        complete: settings.i18n.status_ready,
        preserve_selection: true,
        suppress_complete_message: true
      }), readback_generation, 'booking_inspector');
    }

    /**
     * Dispatch one executable-free Timeline creation-readback result.
     *
     * The creation domain uses this result only to present persisted-success or
     * host-refresh status. Timeline remains the sole owner of its window cache,
     * rendered booking selection, and optional read-only Inspector handoff.
     *
     * @param {Object} detail Validated scalar result detail.
     * @return {void}
     */
    function dispatch_booking_creation_readback_result(detail) {
      var readback_event;
      if (!mount || 'function' !== typeof mount.dispatchEvent) {
        return;
      }
      if ('function' === typeof window.CustomEvent) {
        readback_event = new window.CustomEvent('wpbc:booking-new-inspector:timeline-readback', {
          detail: detail
        });
      } else if (document.createEvent) {
        readback_event = document.createEvent('CustomEvent');
        readback_event.initCustomEvent('wpbc:booking-new-inspector:timeline-readback', false, false, detail);
      }
      if (readback_event) {
        mount.dispatchEvent(readback_event);
      }
    }

    /**
     * Remember one terminal creation-readback correlation ID.
     *
     * The bounded history prevents a delayed or replayed browser event from
     * refreshing the same authoritative Timeline more than once without keeping
     * an unbounded page-lifetime collection.
     *
     * @param {string} request_id Validated creation-readback correlation ID.
     * @return {void}
     */
    function remember_booking_creation_readback_id(request_id) {
      var oldest_request_id;
      if (completed_booking_creation_readback_ids[request_id]) {
        return;
      }
      completed_booking_creation_readback_ids[request_id] = true;
      completed_booking_creation_readback_order.push(request_id);
      if (20 < completed_booking_creation_readback_order.length) {
        oldest_request_id = completed_booking_creation_readback_order.shift();
        delete completed_booking_creation_readback_ids[oldest_request_id];
      }
    }

    /**
     * Restore focus to a visible authoritative created booking after shell close.
     *
     * @param {CustomEvent} event Creation Inspector focus-restoration request.
     * @return {void}
     */
    function handle_booking_creation_focus_created(event) {
      var detail = event && event.detail && 'object' === typeof event.detail ? event.detail : {};
      var booking_id = Math.max(0, Math.round(Number(detail.booking_id) || 0));
      if (1 === Number(detail.schema_version) && booking_id && booking_interactions_controller && 'function' === typeof booking_interactions_controller.focus_created_booking) {
        booking_interactions_controller.focus_created_booking(booking_id);
      }
    }

    /**
     * Consume only the exact signed selection that launched the created booking.
     *
     * Empty top-navigation launches carry no token and therefore clear no local
     * selection. Selection modules compare the opaque token from their current
     * server-owned action URL; Timeline never decodes or authorizes it.
     *
     * @param {Object} detail Validated creation-readback request detail.
     * @return {boolean} True when one matching local selection was consumed.
     */
    function consume_booking_creation_selection(detail) {
      var module_runtime = window.wpbc_timeline_modules;
      var consumed = false;
      var token = String(detail.source_context_token || '');
      var query_arg = String(detail.handoff_query_arg || '');
      if (!token || !query_arg) {
        return false;
      }
      if (empty_range_selection_controller && 'function' === typeof empty_range_selection_controller.consume_signed_action_context) {
        consumed = empty_range_selection_controller.consume_signed_action_context('new_booking', query_arg, token) || consumed;
      }
      if (!module_runtime || 'function' !== typeof module_runtime.get_instance) {
        return consumed;
      }
      extension_instance_ids.forEach(function (instance_id) {
        var extension_instance = module_runtime.get_instance(instance_id);
        if (extension_instance && 'function' === typeof extension_instance.consume_signed_action_context) {
          consumed = extension_instance.consume_signed_action_context('new_booking', query_arg, token) || consumed;
        }
      });
      return consumed;
    }

    /**
     * Refresh the current Timeline exactly once after canonical booking creation.
     *
     * The current window span, zoom, horizontal anchor, Resource expansion, and
     * selection state remain owned by the standard foreground request lifecycle.
     * A retry uses a new correlation ID and can only repeat this readback.
     *
     * @param {CustomEvent} event Creation domain's executable-free notification.
     * @return {void}
     */
    function handle_booking_creation_created(event) {
      var detail = event && event.detail && 'object' === typeof event.detail ? event.detail : {};
      var request_id = String(detail.request_id || '');
      var booking_id = Math.max(0, Math.round(Number(detail.booking_id) || 0));
      var resource_id = Math.max(0, Math.round(Number(detail.resource_id) || 0));
      var anchor;
      var readback_generation;
      var readback_request;
      if (!booking_creation_host_enabled || !is_initialized || 1 !== Number(detail.schema_version) || !/^[A-Za-z0-9._-]{1,191}$/.test(request_id) || !booking_id || !resource_id || request_id === active_booking_creation_readback_id || completed_booking_creation_readback_ids[request_id]) {
        return;
      }
      active_booking_creation_readback_id = request_id;
      if (booking_interactions_controller && 'function' === typeof booking_interactions_controller.prepare_created_booking_readback) {
        booking_interactions_controller.prepare_created_booking_readback(booking_id);
      }
      consume_booking_creation_selection(detail);
      anchor = capture_axis_anchor();
      readback_generation = begin_authoritative_readback('booking_creation');
      invalidate_availability_cache();
      readback_request = request_window(add_current_window_span({
        anchor_at: anchor.at,
        anchor_ratio: anchor.ratio,
        window_position: 0,
        view: settings.current_axis ? settings.current_axis.view : settings.axis.view
      }, true), anchor, true, {
        loading: settings.i18n.reloading_timeline,
        complete: settings.i18n.status_ready,
        preserve_selection: true,
        suppress_complete_message: true
      });
      track_authoritative_readback(readback_request, readback_generation, 'booking_creation');
      if (!readback_request || 'function' !== typeof readback_request.done || 'function' !== typeof readback_request.fail) {
        active_booking_creation_readback_id = '';
        remember_booking_creation_readback_id(request_id);
        dispatch_booking_creation_readback_result({
          schema_version: 1,
          request_id: request_id,
          state: 'failed',
          booking_id: booking_id,
          booking_visible: false
        });
        return;
      }
      readback_request.done(function () {
        var booking_visible = false;
        var creation_inspector = mount.querySelector('[data-wpbc-booking-new-inspector-host] [data-wpbc-shared-ui-inspector]');
        if (request_id !== active_booking_creation_readback_id) {
          return;
        }
        if (booking_interactions_controller && 'function' === typeof booking_interactions_controller.complete_created_booking_readback) {
          booking_visible = booking_interactions_controller.complete_created_booking_readback(booking_id);
        }
        active_booking_creation_readback_id = '';
        remember_booking_creation_readback_id(request_id);
        dispatch_booking_creation_readback_result({
          schema_version: 1,
          request_id: request_id,
          state: 'accepted',
          booking_id: booking_id,
          booking_visible: booking_visible
        });
        if (booking_visible && true === detail.open_booking_inspector && booking_interactions_controller && 'function' === typeof booking_interactions_controller.open_created_booking_inspector) {
          booking_interactions_controller.open_created_booking_inspector(booking_id);
        } else if (booking_visible && creation_inspector && creation_inspector.hidden && booking_interactions_controller && 'function' === typeof booking_interactions_controller.focus_created_booking) {
          booking_interactions_controller.focus_created_booking(booking_id);
        }
      }).fail(function () {
        if (request_id !== active_booking_creation_readback_id) {
          return;
        }
        active_booking_creation_readback_id = '';
        remember_booking_creation_readback_id(request_id);
        dispatch_booking_creation_readback_result({
          schema_version: 1,
          request_id: request_id,
          state: 'failed',
          booking_id: booking_id,
          booking_visible: false
        });
      });
    }

    /**
     * Refresh the current canonical window after a successful resize Apply.
     *
     * The returned promise represents only readback. Retrying it cannot repeat
     * the already completed mutation. Existing window span, horizontal anchor,
     * booking selection, and normal render lifecycle remain authoritative.
     *
     * @return {Object} jQuery-compatible promise for canonical Timeline readback.
     */
    function refresh_after_booking_resize_apply() {
      var anchor = capture_axis_anchor();
      var readback_generation = begin_authoritative_readback('booking_geometry');
      invalidate_availability_cache();
      return track_authoritative_readback(request_window(add_current_window_span({
        anchor_at: anchor.at,
        anchor_ratio: anchor.ratio,
        window_position: 0,
        view: settings.current_axis ? settings.current_axis.view : settings.axis.view
      }, true), anchor, true, {
        loading: settings.i18n.reloading_timeline,
        complete: settings.i18n.status_ready,
        suppress_complete_message: true,
        preserve_selection: true
      }), readback_generation, 'booking_geometry');
    }

    /**
     * Create the booking-interactions controller through the module registry.
     *
     * @return {boolean} True when booking interactions initialized.
     */
    function initialize_booking_interactions() {
      var module_runtime = window.wpbc_timeline_modules;
      if (!module_runtime || 'function' !== typeof module_runtime.has_factory || 'function' !== typeof module_runtime.create || !module_runtime.has_factory('booking_interactions')) {
        return false;
      }
      booking_interactions_controller = module_runtime.create('booking_interactions', booking_interactions_instance_id, {
        mount: mount,
        settings: settings,
        is_empty_range_resizing: function () {
          return Boolean(empty_range_selection_controller && empty_range_selection_controller.is_resizing());
        },
        refresh_after_inspector_save: refresh_after_booking_inspector_save,
        refresh_after_resize_apply: refresh_after_booking_resize_apply,
        scroll_axis_from_external_wheel: scroll_axis_from_external_wheel,
        is_host_active: function () {
          return is_initialized;
        },
        set_axis_window_loading_locked: set_axis_window_loading_locked,
        show_admin_message: show_standard_admin_message
      });
      return Boolean(booking_interactions_controller);
    }

    /**
     * Temporarily prevent loaded-window promotion and adjacent reads.
     *
     * Pointer resizing owns an immutable axis snapshot. Locking at drag start
     * prevents asynchronous window composition from invalidating that snapshot;
     * every teardown path releases the lock.
     *
     * @param {boolean} is_locked Whether resize owns the loaded axis.
     * @return {void}
     */
    function set_axis_window_loading_locked(is_locked) {
      is_axis_window_loading_locked = Boolean(is_locked);
      if (is_axis_window_loading_locked) {
        abort_edge_requests();
        suspend_adjacent_loading_for_navigation();
      }
    }

    /**
     * Destroy and forget the extracted booking-interactions controller.
     *
     * @return {void}
     */
    function destroy_booking_interactions() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        module_runtime.destroy(booking_interactions_instance_id);
      } else if (booking_interactions_controller && 'function' === typeof booking_interactions_controller.destroy) {
        booking_interactions_controller.destroy();
      }
      booking_interactions_controller = null;
    }

    /**
     * Ask booking interactions to reconcile control-rail geometry next frame.
     *
     * @return {void}
     */
    function schedule_booking_interaction_layout() {
      if (booking_interactions_controller) {
        booking_interactions_controller.schedule_layout();
      }
    }

    /**
     * Ask booking interactions to reconcile geometry after axis motion settles.
     *
     * @return {void}
     */
    function schedule_booking_interaction_layout_after_axis_motion() {
      if (booking_interactions_controller) {
        booking_interactions_controller.schedule_layout_after_axis_motion();
      }
    }

    /**
     * Run Timeline-owned work after paired Resource/canvas rows are reconciled.
     *
     * The rendering module owns row measurement. The page controller retains
     * edge-state positioning, shared overflow-tooltip integration, and delegation
     * to the independently extracted booking-interactions controller.
     *
     * @return {void}
     */
    function handle_rows_synchronized() {
      schedule_overflow_tooltip_synchronization();
      synchronize_edge_placeholder_rows();
      schedule_edge_status_positioning();
      schedule_booking_interaction_layout();
    }

    /**
     * Create the extracted rendering and row-synchronization controller.
     *
     * @return {boolean} True when the rendering module initialized.
     */
    function initialize_rendering() {
      var module_runtime = window.wpbc_timeline_modules;
      if (!module_runtime || 'function' !== typeof module_runtime.has_factory || 'function' !== typeof module_runtime.create || !module_runtime.has_factory('rendering')) {
        return false;
      }
      rendering_controller = module_runtime.create('rendering', rendering_instance_id, {
        mount: mount,
        settings: settings,
        get_template: get_template,
        begin_booking_refresh: function () {
          if (booking_interactions_controller) {
            booking_interactions_controller.begin_refresh();
          }
        },
        register_booking_segment: function (segment_element, segment, resource_summary) {
          if (booking_interactions_controller) {
            booking_interactions_controller.register_segment(segment_element, segment, resource_summary);
          }
        },
        complete_booking_refresh: function () {
          if (booking_interactions_controller) {
            booking_interactions_controller.complete_refresh();
          }
        },
        after_row_synchronization: handle_rows_synchronized,
        is_host_active: function () {
          return is_initialized;
        }
      });
      return Boolean(rendering_controller);
    }

    /**
     * Destroy and forget the extracted rendering controller.
     *
     * @return {void}
     */
    function destroy_rendering() {
      var module_runtime = window.wpbc_timeline_modules;
      if (module_runtime && 'function' === typeof module_runtime.destroy) {
        module_runtime.destroy(rendering_instance_id);
      } else if (rendering_controller && 'function' === typeof rendering_controller.destroy) {
        rendering_controller.destroy();
      }
      rendering_controller = null;
    }

    /**
     * Render current authorized rows through the extracted rendering module.
     *
     * @param {Object} initial Authorized Resource and booking presentation DTOs.
     * @return {boolean} True when at least one Resource row was rendered.
     */
    function render_rows(initial) {
      return Boolean(rendering_controller && rendering_controller.render_rows(initial));
    }

    /**
     * Ask the rendering module to observe current row halves.
     *
     * @return {void}
     */
    function observe_rendered_rows() {
      if (rendering_controller) {
        rendering_controller.observe_rows();
      }
    }

    /**
     * Add full-text tooltips only to Timeline text that is visually clipped.
     *
     * The shared Catalog helper owns rendered-overflow measurement, keyboard
     * focus, Booking Calendar tooltip initialization, and native-title fallback.
     * Timeline templates opt in by providing authorized plain text through the
     * `data-wpbc-ui-catalog-overflow-tooltip` attribute.
     *
     * @param {HTMLElement} timeline_mount Timeline mount element.
     * @return {void}
     */
    function synchronize_overflow_tooltips(timeline_mount) {
      if (!timeline_mount || !window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.synchronize_overflow_tooltips) {
        return;
      }
      window.wpbc_ui_catalog.synchronize_overflow_tooltips(timeline_mount);
    }

    /**
     * Measure overflow after Timeline rows reach their final constrained width.
     *
     * Row synchronization itself runs in an animation frame. Deferring tooltip
     * synchronization by one additional frame prevents measurements against the
     * transient width used while Resource and canvas row heights are reconciled.
     *
     * @return {void}
     */
    function schedule_overflow_tooltip_synchronization() {
      if (overflow_tooltip_frame) {
        return;
      }
      overflow_tooltip_frame = window.requestAnimationFrame(function () {
        overflow_tooltip_frame = 0;
        synchronize_overflow_tooltips(mount);
      });
    }

    /**
     * Return Timeline adjacent-loading limits with safe local fallbacks.
     *
     * @return {Object} Normalized loading limits.
     */
    function get_window_loading_limits() {
      return window_cache_controller ? window_cache_controller.get_loading_limits() : {};
    }

    /**
     * Abort pending edge reads when the authoritative Timeline context changes.
     *
     * @return {void}
     */
    function abort_edge_requests() {
      if (window_cache_controller) {
        window_cache_controller.abort_edge_requests();
      }
    }

    /**
     * Reset the bounded cache around one authoritative current response.
     *
     * @param {Object} response Authorized window response.
     * @return {Object} Normalized current payload.
     */
    function reset_window_store(response) {
      if (empty_range_selection_controller && empty_range_selection_controller.is_active()) {
        empty_range_selection_controller.reset();
      }
      return window_cache_controller ? window_cache_controller.reset(response) : null;
    }

    /**
     * Add one adjacent response only when it belongs to the current Resource set.
     *
     * @param {Object} response Authorized window response.
     * @return {boolean} True when cached.
     */
    function cache_adjacent_window(response) {
      return window_cache_controller ? window_cache_controller.cache_adjacent(response) : false;
    }

    /**
     * Keep only the previous, current, and next cached windows.
     *
     * @return {boolean} True when a cached window was evicted.
     */
    function trim_window_store() {
      return window_cache_controller ? window_cache_controller.trim() : false;
    }

    /**
     * Map one timestamp to fractional units on an explicit DST-aware cell axis.
     *
     * @param {number} timestamp Epoch seconds.
     * @param {Array<Object>} cells Ordered axis cells.
     * @return {number} Fractional cell position.
     */
    function map_timestamp_to_axis_position(timestamp, cells) {
      return window_cache_controller ? window_cache_controller.map_timestamp_to_axis_position(timestamp, cells) : 0;
    }

    /**
     * Delegate composed-axis selection geometry to the window/cache controller.
     *
     * @param {Object} axis Composed axis DTO.
     * @param {number} start_epoch Inclusive selection start.
     * @param {number} end_epoch Exclusive selection end.
     * @return {Object} Exact and cell-expanded percentage geometry.
     */
    function get_composed_segment_geometry(axis, start_epoch, end_epoch) {
      return window_cache_controller ? window_cache_controller.get_composed_segment_geometry(axis, start_epoch, end_epoch) : {};
    }

    /**
     * Build one template-ready view model from the bounded cache.
     *
     * @return {Object|null} Composed view or null without a current window.
     */
    function compose_window_store() {
      return window_cache_controller ? window_cache_controller.compose() : null;
    }

    /**
     * Mirror only the native body scroll offset into the header viewport.
     *
     * The date header lives outside the horizontal scroll container so it can
     * remain sticky during document scrolling. Both elements inherit the same
     * direction, allowing the browser's native scrollLeft model to stay
     * authoritative in left-to-right and right-to-left interfaces. This hot path
     * deliberately performs no geometry reads, animation-frame scheduling, DOM
     * moves, or style calculation; CSS owns every sticky header and label.
     *
     * @return {void}
     */
    function synchronize_axis_scroll() {
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      var axis_viewport = mount.querySelector('[data-wpbc-timeline-axis-viewport]');
      if (!canvas || !axis_viewport) {
        return;
      }
      axis_viewport.scrollLeft = canvas.scrollLeft;
    }

    /**
     * Suspend automatic adjacent loading before a programmatic canvas position.
     *
     * Rendering, restoring an anchor, or changing visual density can place an
     * edge sentinel inside the prefetch threshold without user navigation. The
     * observer remains connected for proximity tracking, but an adjacent read is
     * not permitted until a later horizontal user interaction supplies intent.
     *
     * @return {void}
     */
    function suspend_adjacent_loading_for_navigation() {
      if (window_cache_controller) {
        window_cache_controller.suspend_adjacent_loading();
      }
    }

    /**
     * Record deliberate navigation toward one adjacent Timeline edge.
     *
     * A cancelled or already-requested edge remains blocked until it leaves the
     * rearm zone. Explicit edge buttons may override that block because they are
     * an unambiguous request from the user.
     *
     * @param {string} direction Previous or next edge.
     * @param {boolean} force Whether an explicit control may bypass reentry.
     * @return {boolean} True when the edge accepted navigation intent.
     */
    function activate_adjacent_navigation_intent(direction, force) {
      return window_cache_controller ? window_cache_controller.activate_adjacent_intent(direction, force) : false;
    }

    /**
     * Map a physical horizontal gesture to the logical Timeline edge.
     *
     * @param {number} horizontal_delta Signed wheel or trackpad delta.
     * @return {string} Previous or next edge, or an empty string.
     */
    function get_adjacent_direction_for_horizontal_delta(horizontal_delta) {
      if (0 === horizontal_delta) {
        return '';
      }
      if (0 > horizontal_delta) {
        return settings.is_rtl ? 'next' : 'previous';
      }
      return settings.is_rtl ? 'previous' : 'next';
    }

    /**
     * Resolve horizontal intent from a wheel or trackpad gesture.
     *
     * Shift plus a vertical mouse wheel is treated as horizontal input. Native
     * trackpad gestures must be predominantly horizontal so normal document
     * scrolling is never trapped by the Timeline.
     *
     * @param {WheelEvent} event Browser wheel event.
     * @return {number} Signed horizontal delta, or zero for vertical intent.
     */
    function get_horizontal_wheel_delta(event) {
      var delta_x = Number(event.deltaX) || 0;
      var delta_y = Number(event.deltaY) || 0;
      if (event.shiftKey && Math.abs(delta_y) > Math.abs(delta_x)) {
        return delta_y;
      }
      if (Math.abs(delta_x) <= Math.abs(delta_y)) {
        return 0;
      }
      return delta_x;
    }

    /**
     * Check whether a gesture is pushing past a visual canvas boundary.
     *
     * Bounding rectangles avoid browser-specific positive and negative
     * scrollLeft models in right-to-left interfaces.
     *
     * @param {Element} canvas Timeline horizontal scroll container.
     * @param {number} horizontal_delta Signed horizontal gesture delta.
     * @return {boolean} True when the gesture points outside the loaded axis.
     */
    function is_outward_canvas_gesture(canvas, horizontal_delta) {
      var canvas_body = canvas.querySelector('.wpbc_timeline__canvas_body');
      var canvas_rectangle;
      var body_rectangle;
      var boundary_tolerance = 2;
      if (!canvas_body || 0 === horizontal_delta) {
        return false;
      }
      canvas_rectangle = canvas.getBoundingClientRect();
      body_rectangle = canvas_body.getBoundingClientRect();
      if (0 > horizontal_delta) {
        return body_rectangle.left >= canvas_rectangle.left - boundary_tolerance;
      }
      return body_rectangle.right <= canvas_rectangle.right + boundary_tolerance;
    }

    /**
     * Keep outward Timeline trackpad momentum from becoming browser history.
     *
     * CSS overscroll containment is the primary protection. This narrow
     * non-passive fallback covers browsers that may still expose history-swipe
     * navigation at a nested horizontal scroller boundary. It never cancels
     * vertical scrolling or a horizontal gesture that can still move the axis.
     *
     * @param {WheelEvent} event Browser wheel event.
     * @return {void}
     */
    function contain_canvas_boundary_gesture(event) {
      var horizontal_delta;
      var direction;
      var is_outward_gesture;
      if (!event.cancelable || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      horizontal_delta = get_horizontal_wheel_delta(event);
      if (!horizontal_delta) {
        return;
      }
      direction = get_adjacent_direction_for_horizontal_delta(horizontal_delta);
      activate_adjacent_navigation_intent(direction, false);
      is_outward_gesture = is_outward_canvas_gesture(event.currentTarget, horizontal_delta);
      if (!is_outward_gesture) {
        return;
      }
      request_adjacent_window(direction);
      event.preventDefault();
    }

    /**
     * Convert one horizontal wheel delta to CSS pixels for programmatic scrolling.
     *
     * Pinned body-portal layers are no longer DOM descendants of the Timeline
     * canvas, so their accepted horizontal gesture must be applied explicitly.
     *
     * @param {WheelEvent} event            Browser wheel event.
     * @param {number}     horizontal_delta Signed horizontal intent.
     * @return {number} Signed distance in CSS pixels.
     */
    function get_horizontal_wheel_distance(event, horizontal_delta) {
      if (1 === event.deltaMode) {
        return horizontal_delta * 16;
      }
      if (2 === event.deltaMode) {
        return horizontal_delta * Math.max(1, axis_scroll_canvas ? axis_scroll_canvas.clientWidth : 1);
      }
      return horizontal_delta;
    }

    /**
     * Apply a horizontal gesture from a viewport-pinned Timeline-owned layer.
     *
     * The Timeline remains the sole horizontal scroll and adjacent-loading owner.
     * Vertical gestures return false so the Booking Overview body and WordPress
     * document retain their native scroll chain.
     *
     * @param {WheelEvent} event Browser wheel event from the pinned layer.
     * @return {boolean} True when Timeline accepted the horizontal gesture.
     */
    function scroll_axis_from_external_wheel(event) {
      var horizontal_delta;
      var horizontal_distance;
      var direction;
      if (!axis_scroll_canvas || !event || !event.cancelable || event.ctrlKey || event.metaKey || event.altKey) {
        return false;
      }
      horizontal_delta = get_horizontal_wheel_delta(event);
      if (!horizontal_delta) {
        return false;
      }
      direction = get_adjacent_direction_for_horizontal_delta(horizontal_delta);
      activate_adjacent_navigation_intent(direction, false);
      if (is_outward_canvas_gesture(axis_scroll_canvas, horizontal_delta)) {
        request_adjacent_window(direction);
        return true;
      }
      horizontal_distance = get_horizontal_wheel_distance(event, horizontal_delta);
      horizontal_distance = settings.is_rtl ? -horizontal_distance : horizontal_distance;
      if ('function' === typeof axis_scroll_canvas.scrollBy) {
        axis_scroll_canvas.scrollBy({
          behavior: 'auto',
          left: horizontal_distance,
          top: 0
        });
      } else {
        axis_scroll_canvas.scrollLeft += horizontal_distance;
      }
      return true;
    }

    /**
     * Mark pointer-driven canvas scrolling as deliberate navigation.
     *
     * The subsequent scroll handler activates only a nearby edge. Keeping this
     * session active also covers touch momentum and native scrollbar dragging;
     * the next programmatic positioning operation clears it.
     *
     * @param {PointerEvent} event Canvas pointer-down event.
     * @return {void}
     */
    function handle_canvas_navigation_pointer_down(event) {
      if ('mouse' === event.pointerType && 0 !== event.button) {
        return;
      }
      if (window_cache_controller) {
        window_cache_controller.set_pointer_navigation_active(true);
      }
    }

    /**
     * Connect the interactive horizontal scroller and contain its boundaries.
     *
     * @return {void}
     */
    function initialize_axis_scroll_synchronization() {
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      if (!canvas || axis_scroll_canvas) {
        return;
      }
      axis_scroll_canvas = canvas;
      document.documentElement.classList.add('wpbc_timeline_scroll_contained');
      document.body.classList.add('wpbc_timeline_scroll_contained');
      canvas.addEventListener('scroll', synchronize_axis_scroll, {
        passive: true
      });
      canvas.addEventListener('scroll', handle_window_store_scroll, {
        passive: true
      });
      canvas.addEventListener('scroll', schedule_edge_status_positioning, {
        passive: true
      });
      canvas.addEventListener('scroll', position_empty_range_selection_popover, {
        passive: true
      });
      canvas.addEventListener('wheel', contain_canvas_boundary_gesture, {
        passive: false
      });
      canvas.addEventListener('pointerdown', handle_canvas_navigation_pointer_down, {
        passive: true
      });
      window.addEventListener('resize', synchronize_axis_scroll);
      window.addEventListener('resize', schedule_edge_status_positioning);
      window.addEventListener('resize', position_empty_range_selection_popover);
      window.addEventListener('scroll', schedule_edge_status_positioning, {
        passive: true
      });
      window.addEventListener('scroll', position_empty_range_selection_popover, {
        passive: true
      });
      synchronize_axis_scroll();
    }

    /**
     * Ask the extracted selection controller to reconcile its popover position.
     *
     * @return {void}
     */
    function position_empty_range_selection_popover() {
      if (empty_range_selection_controller) {
        empty_range_selection_controller.position_popover();
      }
    }

    /**
     * Update the screen-reader status without injecting markup.
     *
     * @param {string} message Status announcement.
     * @return {void}
     */
    function announce(message) {
      if (status_region) {
        status_region.textContent = message || '';
      }
    }

    /**
     * Show one standard Booking Calendar administration message.
     *
     * The global message API owns its markup, iconography, replacement behavior,
     * and timeout. Timeline supplies only translated text and state.
     *
     * @param {string} message Translated message text.
     * @param {string} message_type Standard message type.
     * @param {number} delay Display duration in milliseconds.
     * @return {void}
     */
    function show_standard_admin_message(message, message_type, delay) {
      if ('function' !== typeof window.wpbc_admin_show_message) {
        return;
      }
      window.wpbc_admin_show_message(escape_admin_message_text(message), message_type, delay, false);
    }

    /**
     * Escape one plain-text administration message for the legacy HTML notice API.
     *
     * Timeline and its domain adapters provide text, while
     * `wpbc_admin_show_message()` accepts an HTML string so it can prepend the
     * standard icon. Escaping at this shared boundary prevents an AJAX error or
     * translated label from becoming executable notice markup.
     *
     * @param {string} message Plain-text message.
     * @return {string} HTML-safe message text.
     */
    function escape_admin_message_text(message) {
      return String(message || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    /**
     * Reconcile all Timeline-owned busy phases into one blocking overlay.
     *
     * Availability apply, canonical booking refresh, and lazy unavailable-time
     * reads can overlap. Independent show/hide calls would expose an incomplete
     * Timeline between those phases, so each phase owns a hold and this function
     * closes the overlay only after every hold is released.
     *
     * @return {void}
     */
    function update_timeline_blocking_loading_state() {
      var overlay = mount.querySelector('[data-wpbc-timeline-request-overlay]');
      var overlay_message = mount.querySelector('[data-wpbc-timeline-request-overlay-message]');
      var toolbar_controls = mount.querySelectorAll('[data-wpbc-timeline-toolbar] button, [data-wpbc-timeline-toolbar] select, [data-wpbc-timeline-toolbar] input');
      var blocking_surfaces = mount.querySelectorAll('[data-wpbc-timeline-toolbar], .wpbc_timeline__sticky_header, .wpbc_timeline__body, [data-wpbc-timeline-state]');
      var is_loading = is_selection_apply_loading || is_foreground_request_loading || is_availability_loading;
      var message = is_selection_apply_loading ? selection_apply_loading_message : is_foreground_request_loading ? foreground_request_loading_message : settings.i18n.loading_availability_backgrounds;
      var focus_to_restore;
      if (booking_interactions_controller) {
        booking_interactions_controller.set_request_loading(is_loading);
      }
      mount.classList.toggle('is-request-loading', is_loading);
      mount.setAttribute('aria-busy', is_loading ? 'true' : 'false');
      if (overlay) {
        overlay.hidden = !is_loading;
        overlay.setAttribute('aria-hidden', is_loading ? 'false' : 'true');
      }
      Array.prototype.forEach.call(blocking_surfaces, function (blocking_surface) {
        if (is_loading) {
          blocking_surface.setAttribute('inert', '');
        } else {
          blocking_surface.removeAttribute('inert');
        }
      });
      if (is_loading) {
        if (overlay_message) {
          overlay_message.textContent = message || settings.i18n.loading;
        }
        if (!foreground_request_focus && document.activeElement && mount.contains(document.activeElement)) {
          foreground_request_focus = document.activeElement;
        }
        Array.prototype.forEach.call(toolbar_controls, function (toolbar_control) {
          toolbar_control.disabled = true;
        });
        return;
      }
      Array.prototype.forEach.call(toolbar_controls, function (toolbar_control) {
        toolbar_control.disabled = false;
      });
      if (toolbar_navigation_controller) {
        toolbar_navigation_controller.refresh_after_window_render();
      }
      focus_to_restore = foreground_request_focus;
      foreground_request_focus = null;
      if (focus_to_restore && document.documentElement.contains(focus_to_restore)) {
        window.requestAnimationFrame(function () {
          if (!is_initialized) {
            return;
          }
          try {
            focus_to_restore.focus({
              preventScroll: true
            });
          } catch (error) {
            focus_to_restore.focus();
          }
        });
      }
    }

    /**
     * Toggle the state-changing Availability-apply hold.
     *
     * The request is intentionally not cancellable after submission: aborting a
     * browser transport cannot prove that the server mutation did not complete.
     *
     * @param {boolean} is_loading Whether an Availability apply is active.
     * @param {string}  message    Visible translated status text.
     * @return {void}
     */
    function set_selection_apply_loading(is_loading, message) {
      is_selection_apply_loading = Boolean(is_loading);
      selection_apply_loading_message = is_selection_apply_loading ? message || settings.i18n.applying_availability || settings.i18n.loading : '';
      if (is_selection_apply_loading) {
        announce(selection_apply_loading_message);
      }
      update_timeline_blocking_loading_state();
    }

    /**
     * Toggle the foreground blocking overlay and request controls.
     *
     * Adjacent-window prefetches deliberately use their existing inline edge
     * state instead. This foreground state is reserved for actions that replace
     * the current authorized window so automatic scrolling does not repeatedly
     * obscure the working Timeline or announce duplicate loading messages.
     *
     * @param {boolean} is_loading Whether a foreground request is active.
     * @param {string} message Visible and screen-reader loading message.
     * @param {number} generation Request generation that owns the state.
     * @return {void}
     */
    function set_foreground_request_loading(is_loading, message, generation) {
      if (!is_loading && generation && window_cache_controller && !window_cache_controller.is_foreground_generation_current(generation)) {
        return;
      }
      is_foreground_request_loading = Boolean(is_loading);
      foreground_request_loading_message = is_foreground_request_loading ? message || settings.i18n.loading : '';
      if (is_loading) {
        announce(message || settings.i18n.loading);
      }
      update_timeline_blocking_loading_state();
    }

    /**
     * Delegate one Resource-details expansion to the rendering module.
     *
     * @param {string}  row_key     Stable row identifier.
     * @param {boolean} is_expanded Desired details state.
     * @param {Element} trigger     Toggle that initiated the change.
     * @return {void}
     */
    function set_row_expanded(row_key, is_expanded, trigger) {
      if (rendering_controller) {
        rendering_controller.set_row_expanded(row_key, is_expanded, trigger);
      }
    }

    /**
     * Delegate one capacity-parent expansion to the rendering module.
     *
     * @param {number}  parent_id   Authorized parent Resource ID.
     * @param {boolean} is_expanded Desired child visibility.
     * @param {Element} trigger     Hierarchy toggle that initiated the change.
     * @return {void}
     */
    function set_hierarchy_expanded(parent_id, is_expanded, trigger) {
      if (rendering_controller) {
        rendering_controller.set_hierarchy_expanded(parent_id, is_expanded, trigger);
      }
    }

    /**
     * Locate the axis cell nearest the visible horizontal center.
     *
     * Bounding rectangles avoid assumptions about browser-specific RTL
     * scrollLeft signs. The returned server instant always includes an offset.
     *
     * @return {Object} Anchor instant and viewport ratio.
     */
    function capture_axis_anchor() {
      return window_cache_controller ? window_cache_controller.capture_axis_anchor() : {
        at: settings.axis.anchor.at,
        ratio: 0.5,
        restore_focus: false
      };
    }

    /**
     * Delegate physical anchor restoration to the window/cache controller.
     *
     * @param {Object} anchor Captured anchor state.
     * @return {number|null} Remaining physical alignment error.
     */
    function restore_axis_anchor(anchor) {
      return window_cache_controller ? window_cache_controller.restore_axis_anchor(anchor) : null;
    }

    /**
     * Cancel an obsolete post-render anchor restoration.
     *
     * A newer Timeline render owns the canvas position. Incrementing the
     * generation prevents a callback queued by an older response from moving it.
     *
     * @return {void}
     */
    function cancel_axis_anchor_restoration() {
      if (window_cache_controller) {
        window_cache_controller.cancel_anchor_restoration();
      }
    }

    /**
     * Restore and verify one post-render anchor after horizontal layout settles.
     *
     * Edge placeholders and synchronized Resource rows can finish their flex
     * measurements after the first paint. At least two frames are therefore
     * checked, and a bounded retry corrects any remaining physical offset. This
     * is especially important for exact custom-range starts, where even one
     * visible placeholder cell would misrepresent the selected range.
     *
     * @param {Object}   anchor      Captured anchor state.
     * @param {Function} on_complete Callback after restoration or bounded retry exhaustion.
     * @return {void}
     */
    function schedule_axis_anchor_restoration(anchor, on_complete) {
      if (window_cache_controller) {
        window_cache_controller.schedule_anchor_restoration(anchor, on_complete);
      }
    }

    /**
     * Resolve a requested date against a newly authorized server axis.
     *
     * @param {Object} anchor Requested navigation anchor.
     * @param {Object} axis   Server-authoritative axis DTO.
     * @return {boolean} True when the requested calendar date was resolved.
     */
    function resolve_response_date_anchor(anchor, axis) {
      return window_cache_controller ? window_cache_controller.resolve_response_date_anchor(anchor, axis) : false;
    }

    /**
     * Determine whether an anchor instant is already present in the bounded cache.
     *
     * @param {Object} anchor Timestamp anchor.
     * @return {boolean} True when a cached authorized axis contains the instant.
     */
    function is_anchor_loaded(anchor) {
      return window_cache_controller ? window_cache_controller.is_anchor_loaded(anchor) : false;
    }

    /**
     * Stop an obsolete primary read before restoring an already-cached instant.
     *
     * Incrementing the generation guarantees that an unusually late completion
     * cannot replace the cache after Today has restored the current instant.
     *
     * @return {void}
     */
    function abort_active_window_request() {
      if (!window_cache_controller || !window_cache_controller.abort_foreground_request()) {
        return;
      }
      show_standard_admin_message(settings.i18n.status_ready, 'info', 1000);
      set_foreground_request_loading(false, '', 0);
    }

    /**
     * Refresh the lightweight Today/current-time presentation in cached markup.
     *
     * The bounded cache can remain open across a minute or date boundary. Today
     * navigation therefore updates only the existing marker geometry or daily
     * cell class before scrolling; it does not rebuild rows or format site-local
     * labels in the browser.
     *
     * @param {Object} anchor Current-instant anchor.
     * @return {void}
     */
    function refresh_today_presentation(anchor) {
      var anchor_epoch = Number(anchor.epoch);
      var cells = settings.axis && Array.isArray(settings.axis.cells) ? settings.axis.cells : [];
      var target_cell = null;
      cells.some(function (cell) {
        if (anchor_epoch >= Number(cell.start_epoch) && anchor_epoch < Number(cell.end_epoch)) {
          target_cell = cell;
          return true;
        }
        return false;
      });
      if (!target_cell) {
        return;
      }
      if (settings.axis.is_timed) {
        var position_percent = 100 * map_timestamp_to_axis_position(anchor_epoch, cells) / Math.max(1, cells.length);
        Array.prototype.forEach.call(mount.querySelectorAll('.wpbc_timeline__current_time_header, .wpbc_timeline__current_time_marker'), function (marker) {
          marker.style.setProperty('inset-inline-start', position_percent + '%');
        });
        return;
      }
      Array.prototype.forEach.call(mount.querySelectorAll('[data-wpbc-timeline-date]'), function (date_element) {
        date_element.classList.toggle('is-today', target_cell.date === date_element.getAttribute('data-wpbc-timeline-date'));
      });
    }

    /**
     * Restore an already-authorized cached instant without issuing another read.
     *
     * @param {Object} anchor  Timestamp anchor.
     * @param {Object} options Cached-navigation presentation options.
     * @return {boolean} True when the cache handled the navigation.
     */
    function restore_loaded_anchor(anchor, options) {
      var state_host;
      var restore_options = Object.assign({
        refresh_today: false,
        announcement: settings.i18n.status_ready
      }, options || {});
      if (!is_anchor_loaded(anchor)) {
        return false;
      }
      abort_active_window_request();
      abort_edge_requests();
      cancel_axis_anchor_restoration();
      suspend_adjacent_loading_for_navigation();
      render_edge_states();
      if (toolbar_navigation_controller) {
        toolbar_navigation_controller.refresh_after_window_render();
      }
      state_host = mount.querySelector('[data-wpbc-timeline-state]');
      if (state_host && state_host.querySelector('.wpbc_timeline__state--error')) {
        state_host.hidden = true;
      }
      window.requestAnimationFrame(function () {
        if (!is_initialized) {
          return;
        }
        if (restore_options.refresh_today) {
          refresh_today_presentation(anchor);
        }
        restore_axis_anchor(anchor);
        announce(restore_options.announcement);
      });
      return true;
    }

    /**
     * Render one previous or next edge state into its header and canvas hosts.
     *
     * @param {string} direction Previous or next.
     * @return {void}
     */
    function render_edge_state(direction) {
      var state = window_cache_controller ? window_cache_controller.get_edge_state(direction) : {
        status: 'idle'
      };
      var template_key = 'edge_' + state.status;
      var header_host = mount.querySelector('[data-wpbc-timeline-edge-header="' + direction + '"]');
      var canvas_host = mount.querySelector('[data-wpbc-timeline-edge-canvas="' + direction + '"]');
      var edge_entry = get_edge_window_entry(direction);
      var window_context = edge_entry && edge_entry.payload.window_context ? edge_entry.payload.window_context : {};
      var previews = window_context.adjacent_previews && 'object' === typeof window_context.adjacent_previews ? window_context.adjacent_previews : {};
      var preview = previews[direction] && 'object' === typeof previews[direction] ? previews[direction] : {};
      var common_view_model = {
        direction: direction,
        i18n: settings.i18n,
        preview: {
          range_label: String(preview.range_label || ''),
          is_timed: Boolean(preview.is_timed),
          cells: Array.isArray(preview.cells) ? preview.cells : []
        },
        placeholder_rows: build_edge_placeholder_rows()
      };
      render_template(header_host, template_key, Object.assign({}, common_view_model, {
        area: 'header'
      }));
      render_template(canvas_host, template_key, Object.assign({}, common_view_model, {
        area: 'canvas'
      }));
      schedule_edge_status_positioning();
    }

    /**
     * Build row-height placeholders aligned with the currently visible canvas rows.
     *
     * @return {Array<Object>} Template-safe placeholder row records.
     */
    function build_edge_placeholder_rows() {
      var cell_count = get_window_loading_limits().edge_placeholder_cells;
      var canvas_rows = mount.querySelectorAll('.wpbc_timeline__canvas_row:not([hidden])');
      var placeholder_rows = [];
      Array.prototype.forEach.call(canvas_rows, function (canvas_row) {
        var cells = [];
        var cell_index;
        for (cell_index = 0; cell_index < cell_count; cell_index += 1) {
          cells.push(cell_index);
        }
        placeholder_rows.push({
          height_px: Math.max(1, Math.ceil(canvas_row.getBoundingClientRect().height)),
          cells: cells
        });
      });
      return placeholder_rows;
    }

    /**
     * Keep rendered edge skeleton rows synchronized after Resource row resizing.
     *
     * A hierarchy visibility change requires one template re-render because the
     * row count changed. Ordinary image, font, or detail-height changes update
     * only the existing presentation values.
     *
     * @return {void}
     */
    function synchronize_edge_placeholder_rows() {
      var placeholder_rows = build_edge_placeholder_rows();
      var requires_render = false;
      ['previous', 'next'].forEach(function (direction) {
        var host = mount.querySelector('[data-wpbc-timeline-edge-canvas="' + direction + '"]');
        var rendered_rows = host ? host.querySelectorAll('.wpbc_timeline__edge_placeholder_row') : [];
        if (!host || rendered_rows.length !== placeholder_rows.length) {
          requires_render = Boolean(host);
          return;
        }
        Array.prototype.forEach.call(rendered_rows, function (rendered_row, row_index) {
          rendered_row.style.height = placeholder_rows[row_index].height_px + 'px';
        });
      });
      if (requires_render) {
        render_edge_states();
      }
    }

    /**
     * Keep loading controls visible while the WordPress document scrolls.
     *
     * Native sticky positioning is bounded by the horizontally scrolling canvas.
     * This controller measures the already sticky Timeline header and applies a
     * clamped logical offset while the card remains owned by its edge buffer.
     *
     * @return {void}
     */
    function update_edge_status_positions() {
      var sticky_header = mount.querySelector('.wpbc_timeline__sticky_header');
      var sticky_boundary = sticky_header && 'function' === typeof sticky_header.getBoundingClientRect ? sticky_header.getBoundingClientRect().bottom : 0;
      var status_elements = mount.querySelectorAll('.wpbc_timeline__edge_buffer.is-canvas .wpbc_timeline__edge_status');
      var sticky_gap = 18;
      var viewport_height = document.documentElement.clientHeight || window.innerHeight || 0;
      Array.prototype.forEach.call(status_elements, function (status_element) {
        var edge_buffer = status_element.closest('.wpbc_timeline__edge_buffer');
        var buffer_rectangle;
        var maximum_offset;
        var desired_offset;
        var visible_space;
        if (!edge_buffer) {
          return;
        }
        buffer_rectangle = edge_buffer.getBoundingClientRect();
        maximum_offset = Math.max(sticky_gap, edge_buffer.offsetHeight - status_element.offsetHeight - sticky_gap);
        visible_space = Math.max(0, viewport_height - sticky_boundary - status_element.offsetHeight);
        desired_offset = Math.max(sticky_gap, sticky_boundary + Math.max(sticky_gap, visible_space / 3) - buffer_rectangle.top);
        status_element.style.setProperty('--wpbc-timeline-edge-status-offset', Math.min(maximum_offset, desired_offset) + 'px');
      });
    }

    /**
     * Coalesce viewport and layout events into one sticky-card measurement.
     *
     * @return {void}
     */
    function schedule_edge_status_positioning() {
      if (edge_status_frame) {
        return;
      }
      edge_status_frame = window.requestAnimationFrame(function () {
        edge_status_frame = 0;
        update_edge_status_positions();
      });
    }

    /**
     * Render both bounded edge states.
     *
     * @return {void}
     */
    function render_edge_states() {
      if (!settings.initial || !Array.isArray(settings.initial.resources) || !settings.initial.resources.length) {
        ['previous', 'next'].forEach(function (direction) {
          var header_host = mount.querySelector('[data-wpbc-timeline-edge-header="' + direction + '"]');
          var canvas_host = mount.querySelector('[data-wpbc-timeline-edge-canvas="' + direction + '"]');
          if (header_host) {
            header_host.textContent = '';
          }
          if (canvas_host) {
            canvas_host.textContent = '';
          }
        });
        return;
      }
      render_edge_state('previous');
      render_edge_state('next');
    }

    /**
     * Render the complete bounded cache through existing WordPress templates.
     *
     * @param {Object} anchor Timestamp and viewport position to restore.
     * @param {string} announcement Optional screen-reader completion message.
     * @return {boolean} True when a composed view was rendered.
     */
    function render_window_store(anchor, announcement) {
      var composed = compose_window_store();
      var state_host = mount.querySelector('[data-wpbc-timeline-state]');
      var browser_expansion_preferences = settings.preferences || {};
      var accepted_window_entries;
      if (!composed) {
        return false;
      }
      suspend_adjacent_loading_for_navigation();
      settings.window = composed.current.window;
      settings.window_context = composed.current.window_context;
      settings.resource_view = composed.current.resource_view || settings.resource_view || {};
      settings.resource_pagination = composed.current.resource_pagination || {};
      settings.view_policy = composed.current.view_policy;
      settings.current_axis = composed.current.axis;
      settings.axis = composed.axis;
      settings.preferences = Object.assign({}, composed.current.preferences || {}, {
        expanded_resource_ids: Array.isArray(browser_expansion_preferences.expanded_resource_ids) ? browser_expansion_preferences.expanded_resource_ids.slice() : [],
        expanded_parent_ids: Array.isArray(browser_expansion_preferences.expanded_parent_ids) ? browser_expansion_preferences.expanded_parent_ids.slice() : []
      });
      settings.initial = {
        load_state: 'loaded',
        resources: composed.resources,
        segments: composed.segments,
        occupancy: composed.occupancy,
        time_slot_overflows: composed.time_slot_overflows || []
      };
      render_template(mount.querySelector('[data-wpbc-timeline-axis-header]'), 'axis_header', settings);
      render_template(mount.querySelector('[data-wpbc-timeline-canvas-backdrop]'), 'canvas_backdrop', settings);
      if (toolbar_navigation_controller) {
        toolbar_navigation_controller.refresh_after_window_render();
      }
      if (resource_navigation_controller) {
        resource_navigation_controller.refresh(settings.resource_view, settings.resource_pagination);
      }
      if (render_rows(settings.initial)) {
        if (resource_settings_controller) {
          resource_settings_controller.refresh(settings.initial.resources);
        }
        state_host.hidden = true;
        if (announcement) {
          announce(announcement);
        }
      } else {
        state_host.hidden = false;
        render_template(state_host, 'empty', settings);
        announce(settings.i18n.status_empty);
      }
      if (empty_range_selection_controller) {
        empty_range_selection_controller.render();
      }
      render_edge_states();
      observe_rendered_rows();
      schedule_axis_anchor_restoration(anchor, initialize_edge_observer);
      accepted_window_entries = window_cache_controller && 'function' === typeof window_cache_controller.get_ordered_window_entries ? window_cache_controller.get_ordered_window_entries() : [];
      notify_accepted_booking_windows(accepted_window_entries);
      synchronize_availability_cache(accepted_window_entries);
      return true;
    }

    /**
     * Return the outer cached entry used to request one more adjacent window.
     *
     * @param {string} direction Previous or next.
     * @return {Object|null} Cache entry or null.
     */
    function get_edge_window_entry(direction) {
      return window_cache_controller ? window_cache_controller.get_edge_window_entry(direction) : null;
    }

    /**
     * Promote the cached window containing the visible timestamp.
     *
     * @return {void}
     */
    function promote_visible_window() {
      var anchor = capture_axis_anchor();
      var promotion = window_cache_controller ? window_cache_controller.promote_for_anchor(anchor) : null;
      if (!promotion) {
        return;
      }
      if (promotion.trimmed) {
        render_window_store(anchor, '');
      } else {
        settings.window = promotion.entry.payload.window;
        settings.window_context = promotion.entry.payload.window_context;
        settings.view_policy = promotion.entry.payload.view_policy;
        settings.current_axis = promotion.entry.payload.axis;
        if (toolbar_navigation_controller) {
          toolbar_navigation_controller.refresh_after_window_render();
        }
      }
    }

    /**
     * Determine whether an edge sentinel is inside a percentage-expanded viewport.
     *
     * This shared geometry keeps observer and scroll-fallback thresholds aligned
     * and works with physical browser rectangles in both LTR and RTL layouts.
     *
     * @param {DOMRect} canvas_rectangle Canvas viewport rectangle.
     * @param {DOMRect} sentinel_rectangle Edge sentinel rectangle.
     * @param {number} expansion_percent Horizontal viewport expansion percentage.
     * @return {boolean} True when the sentinel is within the expanded viewport.
     */
    function is_edge_sentinel_near(canvas_rectangle, sentinel_rectangle, expansion_percent) {
      var threshold = canvas_rectangle.width * expansion_percent / 100;
      return sentinel_rectangle.right >= canvas_rectangle.left - threshold && sentinel_rectangle.left <= canvas_rectangle.right + threshold;
    }

    /**
     * Process scroll-time promotion and the non-observer edge fallback once.
     *
     * @return {void}
     */
    function handle_window_store_scroll() {
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      var limits = get_window_loading_limits();
      if (is_axis_window_loading_locked || edge_scroll_frame || !canvas) {
        return;
      }
      edge_scroll_frame = window.requestAnimationFrame(function () {
        var canvas_rectangle = canvas.getBoundingClientRect();
        edge_scroll_frame = 0;
        promote_visible_window();
        ['previous', 'next'].forEach(function (direction) {
          var sentinel = canvas.querySelector('[data-wpbc-timeline-edge-sentinel="' + direction + '"]');
          var sentinel_rectangle;
          var is_near_rearm;
          if (!sentinel || !window_cache_controller) {
            return;
          }
          sentinel_rectangle = sentinel.getBoundingClientRect();
          is_near_rearm = is_edge_sentinel_near(canvas_rectangle, sentinel_rectangle, limits.edge_rearm_percent);
          if (window_cache_controller.update_edge_proximity(direction, is_near_rearm, is_edge_sentinel_near(canvas_rectangle, sentinel_rectangle, limits.edge_prefetch_percent))) {
            request_adjacent_window(direction);
          }
        });
      });
    }

    /**
     * Observe bounded edge sentinels relative to the Timeline canvas.
     *
     * @return {void}
     */
    function initialize_edge_observer() {
      var canvas = mount.querySelector('[data-wpbc-timeline-canvas]');
      var limits = get_window_loading_limits();
      var margin = '0px ' + limits.edge_prefetch_percent + '%';
      if (edge_observer) {
        edge_observer.disconnect();
        edge_observer = null;
      }
      if (!canvas || 'function' !== typeof window.IntersectionObserver) {
        return;
      }
      edge_observer = new window.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var direction = entry.target.getAttribute('data-wpbc-timeline-edge-sentinel');
          var state = window_cache_controller ? window_cache_controller.get_edge_state(direction) : null;
          if (entry.isIntersecting && direction && state && state.armed && state.user_intent && 'idle' === state.status) {
            request_adjacent_window(direction);
          }
        });
      }, {
        root: canvas,
        rootMargin: margin,
        threshold: 0.01
      });
      ['previous', 'next'].forEach(function (direction) {
        var sentinel = canvas.querySelector('[data-wpbc-timeline-edge-sentinel="' + direction + '"]');
        var canvas_rectangle;
        var sentinel_rectangle;
        var state = window_cache_controller ? window_cache_controller.get_edge_state(direction) : null;
        if (sentinel && state) {
          canvas_rectangle = canvas.getBoundingClientRect();
          sentinel_rectangle = sentinel.getBoundingClientRect();
          window_cache_controller.update_edge_proximity(direction, is_edge_sentinel_near(canvas_rectangle, sentinel_rectangle, limits.edge_rearm_percent), false);
          edge_observer.observe(sentinel);
        }
      });
    }

    /**
     * Load one adjacent window without replacing the current working Timeline.
     *
     * @param {string} direction Previous or next.
     * @param {Object} request_options Optional foreground-prime behavior.
     * @return {Object|null} jQuery-compatible completion promise when available.
     */
    function request_adjacent_window(direction, request_options) {
      var transport = settings.transport || {};
      var options = Object.assign({
        allow_without_user_intent: false,
        defer_render: false,
        silent: false,
        skip_promotion: false
      }, request_options || {});
      var edge_entry;
      var descriptor;
      var state;
      var had_user_intent;
      var limits;
      var generation;
      var request_values;
      var request;
      var completion = window.jQuery ? window.jQuery.Deferred() : null;
      var is_intent_blocked;
      if (is_axis_window_loading_locked || !completion) {
        return null;
      }
      state = window_cache_controller ? window_cache_controller.get_edge_state(direction) : null;
      had_user_intent = Boolean(state && state.user_intent);
      if (!options.skip_promotion) {
        promote_visible_window();
      }
      if (had_user_intent && !options.allow_without_user_intent) {
        activate_adjacent_navigation_intent(direction, true);
      }
      edge_entry = get_edge_window_entry(direction);
      descriptor = edge_entry && edge_entry.payload.window_context && edge_entry.payload.window_context.adjacent_requests ? edge_entry.payload.window_context.adjacent_requests[direction] : null;
      state = window_cache_controller ? window_cache_controller.get_edge_state(direction) : null;
      limits = get_window_loading_limits();
      is_intent_blocked = !options.allow_without_user_intent && (!state || !state.armed || !state.user_intent || Date.now() < state.cooldown_until);
      if (!descriptor || !state || !edge_entry.payload.resources.length || is_intent_blocked || 'idle' !== state.status || !transport.url || !transport.action || !transport.nonce) {
        completion.resolve(false);
        return completion.promise();
      }
      generation = window_cache_controller.begin_edge_request(direction, options.allow_without_user_intent);
      if (!generation) {
        completion.resolve(false);
        return completion.promise();
      }
      request_values = Object.assign({}, descriptor, {
        action: transport.action,
        nonce: transport.nonce,
        request_generation: generation,
        resource_view_context: String(edge_entry.payload.window_context.resource_view_context || '')
      });
      if (!options.silent) {
        render_edge_state(direction);
        announce('previous' === direction ? settings.i18n.loading_previous_dates : settings.i18n.loading_next_dates);
      }
      request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: request_values,
        timeout: limits.request_timeout_ms
      }).done(function (response) {
        if (!window_cache_controller.is_edge_generation_current(direction, generation)) {
          completion.reject(false);
          return;
        }
        if (!response || !response.success || !response.data || !response.data.window || Number(response.data.window.request_generation) !== generation) {
          window_cache_controller.mark_edge_error(direction, generation);
          if (!options.silent) {
            render_edge_state(direction);
            announce(settings.i18n.edge_load_failed);
          }
          completion.reject(false);
          return;
        }
        if (!cache_adjacent_window(response.data)) {
          window_cache_controller.mark_edge_error(direction, generation);
          if (!options.silent) {
            render_edge_state(direction);
            announce(settings.i18n.edge_load_failed);
          }
          completion.reject(false);
          return;
        }
        trim_window_store();
        window_cache_controller.mark_edge_loaded(direction, generation);
        if (!options.defer_render) {
          render_window_store(capture_axis_anchor(), settings.i18n.adjacent_dates_loaded);
        }
        completion.resolve(response.data);
      }).fail(function (request, request_status) {
        if (!window_cache_controller.is_edge_generation_current(direction, generation) || 'abort' === request_status) {
          completion.reject(false);
          return;
        }
        window_cache_controller.mark_edge_error(direction, generation);
        if (!options.silent) {
          render_edge_state(direction);
          announce(settings.i18n.edge_load_failed);
        }
        completion.reject(false);
      }).always(function () {
        window_cache_controller.complete_edge_request(direction, generation);
      });
      if (window_cache_controller.set_edge_request(direction, generation, request)) {
        if (!options.silent) {
          window_cache_controller.schedule_edge_slow_state(direction, generation, function () {
            render_edge_state(direction);
          });
        }
      }
      return completion.promise();
    }

    /**
     * Read one neighbor for a staged Resource-context replacement.
     *
     * The response is not inserted into the active cache. The caller commits
     * both neighbors and the current response together only after all three pass
     * the same fingerprint and foreground-generation checks.
     *
     * @param {Object} current_response Authorized new current window.
     * @param {string} direction Previous or next.
     * @param {number} generation Owning foreground generation.
     * @return {Object} jQuery-compatible completion promise.
     */
    function request_resource_context_neighbor(current_response, direction, generation) {
      var transport = settings.transport || {};
      var window_context = current_response.window_context || {};
      var descriptors = window_context.adjacent_requests || {};
      var descriptor = descriptors[direction] || null;
      var completion = window.jQuery.Deferred();
      var request_values;
      var ajax_request = null;
      if (!descriptor || !window_context.resource_view_context) {
        completion.reject(false);
        return completion.promise();
      }
      request_values = Object.assign({}, descriptor, {
        action: transport.action,
        nonce: transport.nonce,
        request_generation: generation,
        resource_view_context: String(window_context.resource_view_context)
      });
      ajax_request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: request_values,
        timeout: get_window_loading_limits().request_timeout_ms
      }).done(function (response) {
        var response_context = response && response.data ? response.data.window_context || {} : {};
        if (!window_cache_controller.is_foreground_generation_current(generation) || !response || !response.success || !response.data || !response.data.window || Number(response.data.window.request_generation) !== generation || String(response_context.resource_fingerprint || '') !== String(window_context.resource_fingerprint || '')) {
          completion.reject(false);
          return;
        }
        completion.resolve(response.data);
      }).fail(function () {
        completion.reject(false);
      });
      return completion.promise({
        abort: function () {
          if (ajax_request && 'function' === typeof ajax_request.abort) {
            ajax_request.abort();
          }
        }
      });
    }

    /**
     * Stage and atomically commit a complete new Resource three-window cache.
     *
     * @param {Object} current_response Authorized new current window.
     * @param {number} generation Owning foreground generation.
     * @return {Object} jQuery-compatible completion promise.
     */
    function stage_resource_context_replacement(current_response, generation) {
      var completion = window.jQuery.Deferred();
      var previous_request = request_resource_context_neighbor(current_response, 'previous', generation);
      var next_request = request_resource_context_neighbor(current_response, 'next', generation);
      window.jQuery.when(previous_request, next_request).done(function (previous_response, next_response) {
        var committed;
        if (!window_cache_controller.is_foreground_generation_current(generation)) {
          completion.reject(false);
          return;
        }
        committed = window_cache_controller.replace_resource_context(current_response, [previous_response, next_response]);
        if (!committed) {
          completion.reject(false);
          return;
        }
        completion.resolve(committed);
      }).fail(function () {
        if (previous_request && 'function' === typeof previous_request.abort) {
          previous_request.abort();
        }
        if (next_request && 'function' === typeof next_request.abort) {
          next_request.abort();
        }
        completion.reject(false);
      });
      return completion.promise({
        abort: function () {
          if (previous_request && 'function' === typeof previous_request.abort) {
            previous_request.abort();
          }
          if (next_request && 'function' === typeof next_request.abort) {
            next_request.abort();
          }
        }
      });
    }

    /**
     * Fill both neighbors around a newly authorized foreground window.
     *
     * The center response remains authoritative and the foreground overlay stays
     * active until both bounded neighbor reads settle. A failed neighbor is left
     * as the existing recoverable edge state and does not discard the center.
     *
     * @param {Object} anchor Anchor restored after all neighbor reads settle.
     * @param {string} announcement Screen-reader completion message.
     * @param {number} foreground_generation Owning foreground generation.
     * @return {Object} jQuery-compatible completion promise.
     */
    function prime_surrounding_windows(anchor, announcement, foreground_generation) {
      var completion = window.jQuery.Deferred();
      var remaining = 2;
      var settle = function () {
        remaining -= 1;
        if (0 < remaining) {
          return;
        }
        if (!window_cache_controller.is_foreground_generation_current(foreground_generation)) {
          completion.reject(false);
          return;
        }
        trim_window_store();
        render_window_store(anchor, announcement);
        completion.resolve(true);
      };
      ['previous', 'next'].forEach(function (direction) {
        var request = request_adjacent_window(direction, {
          allow_without_user_intent: true,
          defer_render: true,
          silent: true,
          skip_promotion: true
        });
        if (request && 'function' === typeof request.always) {
          request.always(settle);
        } else {
          settle();
        }
      });
      return completion.promise();
    }

    /**
     * Cancel one in-flight adjacent read without replacing the working window.
     *
     * The edge remains disarmed until the user leaves and re-enters the trigger
     * threshold, preventing an observer from immediately restarting a request
     * the user explicitly cancelled.
     *
     * @param {string} direction Previous or next edge.
     * @return {void}
     */
    function cancel_adjacent_window(direction) {
      if (!window_cache_controller || !window_cache_controller.cancel_edge_request(direction)) {
        return;
      }
      render_edge_state(direction);
      announce(settings.i18n.loading_cancelled);
      window.requestAnimationFrame(function () {
        var load_button;
        if (!is_initialized) {
          return;
        }
        load_button = mount.querySelector('[data-wpbc-timeline-edge-load="' + direction + '"]');
        if (load_button) {
          try {
            load_button.focus({
              preventScroll: true
            });
          } catch (error) {
            load_button.focus();
          }
        }
      });
    }

    /**
     * Render a safe full-window read error without exposing transport details.
     *
     * @param {string} error_message Authorized error text, or the generic fallback.
     * @return {void}
     */
    function render_window_error(error_message) {
      var state_host = mount.querySelector('[data-wpbc-timeline-state]');
      settings.i18n.error_message = error_message || settings.i18n.error_message;
      if (state_host) {
        state_host.hidden = false;
        render_template(state_host, 'error', settings);
      }
      announce(settings.i18n.error_message);
    }

    /**
     * Add the current server-approved day or calendar-month span to a request.
     *
     * @param {Object} request_values Mutable request values.
     * @param {boolean} preserve_start Whether a month window must keep its exact start.
     * @return {Object} The supplied request values.
     */
    function add_current_window_span(request_values, preserve_start) {
      if (0 < Number(settings.window.window_months)) {
        request_values.window_months = Number(settings.window.window_months);
        if (preserve_start) {
          request_values.anchor_at = settings.current_axis ? settings.current_axis.start_at : settings.axis.start_at;
          request_values.anchor_ratio = 0;
        }
      } else {
        request_values.window_days = Number(settings.window.window_days);
      }
      return request_values;
    }

    /**
     * Load one bounded read-only Timeline window.
     *
     * @param {Object} request_options Validated UI choices.
     * @param {Object} anchor Captured anchor state.
     * @param {boolean} may_reduce Whether one server-suggested retry is allowed.
     * @param {Object} request_feedback Foreground loading and completion messages.
     * @return {Object} jQuery-compatible completion promise.
     */
    function request_window(request_options, anchor, may_reduce, request_feedback) {
      var transport = settings.transport || {};
      var feedback = Object.assign({
        loading: settings.i18n.loading,
        complete: settings.i18n.status_ready
      }, request_feedback || {});
      var generation;
      var request_values;
      var request;
      var resource_replacement;
      var completion = feedback.completion && 'function' === typeof feedback.completion.resolve ? feedback.completion : window.jQuery ? window.jQuery.Deferred() : null;
      var finish_request = function () {
        if (!window_cache_controller.is_foreground_generation_current(generation)) {
          return;
        }
        window_cache_controller.complete_foreground_request(generation);
        set_foreground_request_loading(false, '', generation);
      };
      if (is_axis_window_loading_locked) {
        if (completion) {
          completion.reject({
            message: ''
          });
          return completion.promise();
        }
        return null;
      }
      if (!window.jQuery || !transport.url || !transport.action || !transport.nonce) {
        render_window_error(settings.i18n.error_message);
        if (completion) {
          completion.reject({
            message: settings.i18n.error_message
          });
          return completion.promise();
        }
        return null;
      }
      if (empty_range_selection_controller && empty_range_selection_controller.is_active() && !feedback.preserve_selection) {
        empty_range_selection_controller.cancel(false);
      }
      abort_edge_requests();
      cancel_axis_anchor_restoration();
      generation = window_cache_controller.begin_foreground_request();
      request_values = Object.assign({}, request_options, {
        action: transport.action,
        nonce: transport.nonce,
        request_generation: generation
      });
      if (!request_values.resource_view_context && settings.window_context && settings.window_context.resource_view_context) {
        request_values.resource_view_context = String(settings.window_context.resource_view_context);
      }
      set_foreground_request_loading(true, feedback.loading, generation);
      request = window.jQuery.ajax({
        url: transport.url,
        method: 'POST',
        dataType: 'json',
        data: request_values,
        timeout: get_window_loading_limits().request_timeout_ms
      }).done(function (response) {
        if (!window_cache_controller.is_foreground_generation_current(generation)) {
          completion.reject({
            message: settings.i18n.error_message
          });
          return;
        }
        if (!response || !response.success || !response.data || !response.data.window || Number(response.data.window.request_generation) !== generation) {
          show_standard_admin_message(settings.i18n.error_message, 'error', 30000);
          render_window_error(settings.i18n.error_message);
          completion.reject({
            message: settings.i18n.error_message
          });
          finish_request();
          return;
        }
        if (anchor.target_date) {
          if (!resolve_response_date_anchor(anchor, response.data.axis || {}) && response.data.axis && response.data.axis.start_at) {
            anchor.at = response.data.axis.start_at;
            delete anchor.epoch;
          }
        } else if (anchor.use_response_start && response.data.axis && response.data.axis.start_at) {
          anchor.at = response.data.axis.start_at;
        }
        if (window_cache_controller.get_resource_fingerprint() && response.data.window_context && response.data.window_context.resource_fingerprint && window_cache_controller.get_resource_fingerprint() !== String(response.data.window_context.resource_fingerprint)) {
          resource_replacement = stage_resource_context_replacement(response.data, generation);
          window_cache_controller.set_foreground_request(generation, resource_replacement);
          resource_replacement.done(function () {
            settings.preferences = Object.assign({}, settings.preferences || {}, {
              expanded_resource_ids: Array.isArray(response.data.preferences && response.data.preferences.expanded_resource_ids) ? response.data.preferences.expanded_resource_ids.slice() : [],
              expanded_parent_ids: Array.isArray(response.data.preferences && response.data.preferences.expanded_parent_ids) ? response.data.preferences.expanded_parent_ids.slice() : []
            });
            render_window_store(anchor, feedback.complete);
            if (feedback.persist_preferences) {
              preference_anchor_date = String(response.data.window.start_date || response.data.window.anchor_date || preference_anchor_date);
              preference_anchor_ratio = 0;
              queue_timeline_preferences_save();
            }
            if (!feedback.suppress_complete_message) {
              show_standard_admin_message(feedback.complete, 'success', 3000);
            }
            completion.resolve(response.data);
            finish_request();
          }).fail(function () {
            show_standard_admin_message(settings.i18n.error_message, 'error', 30000);
            completion.reject({
              message: settings.i18n.error_message
            });
            finish_request();
          });
          return;
        }
        reset_window_store(response.data);
        prime_surrounding_windows(anchor, feedback.complete, generation).done(function () {
          if (feedback.persist_preferences) {
            preference_anchor_date = String(response.data.window.start_date || response.data.window.anchor_date || preference_anchor_date);
            preference_anchor_ratio = 0;
            queue_timeline_preferences_save();
          }
          if (!feedback.suppress_complete_message) {
            show_standard_admin_message(feedback.complete, 'success', 3000);
          }
          completion.resolve(response.data);
          finish_request();
        }).fail(function () {
          completion.reject({
            message: settings.i18n.error_message
          });
        });
      }).fail(function (request, request_status) {
        var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};
        var suggested_days = error.details ? Number(error.details.suggested_window_days) : 0;
        if (!window_cache_controller.is_foreground_generation_current(generation) || 'abort' === request_status) {
          completion.reject({
            message: error.message || settings.i18n.error_message
          });
          return;
        }
        if (may_reduce && suggested_days && (0 < Number(request_values.window_months) || suggested_days < Number(request_values.window_days))) {
          announce(settings.i18n.window_reduced);
          delete request_values.window_months;
          if (anchor.target_date) {
            delete request_values.anchor_at;
            request_values.anchor_date = anchor.target_date;
          } else {
            request_values.anchor_at = anchor.at;
          }
          request_values.anchor_ratio = anchor.ratio;
          request_values.window_days = suggested_days;
          request_window(request_values, anchor, false, {
            loading: settings.i18n.loading_reduced_window,
            complete: feedback.complete,
            persist_preferences: feedback.persist_preferences,
            suppress_complete_message: feedback.suppress_complete_message,
            preserve_selection: feedback.preserve_selection,
            completion: completion
          });
          return;
        }
        show_standard_admin_message(error.message || settings.i18n.error_message, 'error', 30000);
        render_window_error(error.message || settings.i18n.error_message);
        completion.reject({
          message: error.message || settings.i18n.error_message
        });
        finish_request();
      });
      window_cache_controller.set_foreground_request(generation, request);
      return completion.promise();
    }

    /**
     * Replace the active Resource page while preserving the visible date anchor.
     *
     * Phase 4 selector UI may call this server-authoritative boundary after a
     * successful Resource-view save. No draft IDs are accepted here; only the
     * signed context returned by the save/reset endpoint is submitted.
     *
     * @param {string} resource_view_context Signed server Resource-view context.
     * @return {Object|null} jQuery-compatible completion promise when available.
     */
    function replace_resource_view(resource_view_context) {
      var anchor = capture_axis_anchor();
      if (!resource_view_context) {
        return null;
      }
      return request_window(add_current_window_span({
        anchor_at: anchor.at,
        anchor_ratio: anchor.ratio,
        window_position: 0,
        view: settings.axis.view,
        resource_view_context: String(resource_view_context)
      }, true), anchor, true, {
        loading: settings.i18n.reloading_timeline,
        complete: settings.i18n.status_ready,
        persist_preferences: false
      });
    }

    /**
     * Move keyboard focus between server-defined axis cells.
     *
     * @param {KeyboardEvent} event Key event from the axis.
     * @return {void}
     */
    function handle_axis_keydown(event) {
      if (booking_interactions_controller && booking_interactions_controller.handle_keydown(event)) {
        return;
      }
      if (empty_range_selection_controller && empty_range_selection_controller.handle_keydown(event)) {
        return;
      }
      if (toolbar_navigation_controller) {
        toolbar_navigation_controller.handle_keydown(event);
      }
    }

    /**
     * Handle Timeline shell actions through one delegated listener.
     *
     * @param {MouseEvent} event Browser click event.
     * @return {void}
     */
    function handle_click(event) {
      var retry_button = event.target.closest('[data-wpbc-timeline-retry]');
      var edge_load_button = event.target.closest('[data-wpbc-timeline-edge-load]');
      var edge_cancel_button = event.target.closest('[data-wpbc-timeline-edge-cancel]');
      var row_toggle = event.target.closest('[data-wpbc-timeline-row-toggle]');
      var hierarchy_toggle = event.target.closest('[data-wpbc-timeline-hierarchy-toggle]');
      var anchor;
      var direction;
      if (booking_interactions_controller && booking_interactions_controller.handle_click(event)) {
        return;
      }
      if (empty_range_selection_controller && empty_range_selection_controller.handle_click(event)) {
        return;
      }
      if (rendering_controller && rendering_controller.handle_row_presentation_click(event)) {
        return;
      }
      if (edge_cancel_button) {
        cancel_adjacent_window(edge_cancel_button.getAttribute('data-wpbc-timeline-edge-cancel'));
        return;
      }
      if (edge_load_button) {
        direction = edge_load_button.getAttribute('data-wpbc-timeline-edge-load');
        if (window_cache_controller && window_cache_controller.prepare_edge_retry(direction)) {
          activate_adjacent_navigation_intent(direction, true);
          request_adjacent_window(direction);
        }
        return;
      }
      if (retry_button) {
        anchor = capture_axis_anchor();
        request_window(add_current_window_span({
          anchor_at: anchor.at,
          anchor_ratio: anchor.ratio,
          window_position: 0,
          view: settings.axis.view
        }, true), anchor, true, {
          loading: settings.i18n.reloading_timeline,
          complete: settings.i18n.status_ready
        });
        return;
      }
      if (toolbar_navigation_controller && toolbar_navigation_controller.handle_click(event)) {
        return;
      }
      if (hierarchy_toggle) {
        set_hierarchy_expanded(Number(hierarchy_toggle.getAttribute('data-wpbc-timeline-hierarchy-toggle')), 'true' !== hierarchy_toggle.getAttribute('aria-expanded'), hierarchy_toggle);
        return;
      }
      if (row_toggle) {
        set_row_expanded(row_toggle.getAttribute('data-wpbc-timeline-row-toggle'), 'true' !== row_toggle.getAttribute('aria-expanded'), row_toggle);
      }
    }

    /**
     * Render the read-only shell and its authorized initial window.
     *
     * @return {void}
     */
    function initialize() {
      var state_host;
      var initial_anchor;
      if (!mount || is_initialized || '1' === mount.getAttribute('data-wpbc-timeline-initialized')) {
        return;
      }
      is_initialized = true;
      lifecycle_generation += 1;
      mount.setAttribute('data-wpbc-timeline-initialized', '1');
      if (!render_template(mount, 'shell', settings)) {
        mount.textContent = settings.i18n ? settings.i18n.error_message : '';
        mount.setAttribute('aria-busy', 'false');
        return;
      }
      initialize_window_cache();
      initialize_availability_cache();
      initialize_toolbar_navigation();
      initialize_empty_range_selection();
      initialize_booking_interactions();
      initialize_rendering();
      initialize_resource_navigation();
      initialize_resource_settings();
      initialize_extensions();
      render_template(mount.querySelector('[data-wpbc-timeline-toolbar]'), 'toolbar', settings);
      if (toolbar_navigation_controller) {
        toolbar_navigation_controller.render_controls();
      }
      render_template(mount.querySelector('[data-wpbc-timeline-axis-header]'), 'axis_header', settings);
      render_template(mount.querySelector('[data-wpbc-timeline-canvas-backdrop]'), 'canvas_backdrop', settings);
      render_template(mount.querySelector('[data-wpbc-timeline-legend]'), 'legend', settings);
      if (toolbar_navigation_controller) {
        toolbar_navigation_controller.refresh_after_window_render();
      }
      initialize_axis_scroll_synchronization();
      state_host = mount.querySelector('[data-wpbc-timeline-state]');
      if (settings.is_authorized && settings.initial && 'error' === settings.initial.load_state) {
        settings.i18n.error_message = settings.initial.error && settings.initial.error.message ? settings.initial.error.message : settings.i18n.error_message;
        state_host.hidden = false;
        render_template(state_host, 'error', settings);
        announce(settings.i18n.error_message);
      } else if (settings.is_authorized) {
        initial_anchor = settings.axis.current_time_marker && settings.axis.current_time_marker.at ? settings.axis.current_time_marker.at : settings.axis.anchor.at;
        reset_window_store({
          window: settings.window,
          axis: settings.axis,
          resources: settings.initial.resources || [],
          segments: settings.initial.segments || [],
          occupancy: settings.initial.occupancy || [],
          time_slot_overflows: settings.initial.time_slot_overflows || [],
          preferences: settings.preferences || {},
          resource_view: settings.resource_view || {},
          resource_pagination: settings.resource_pagination || {},
          window_context: settings.window_context || {},
          view_policy: settings.view_policy || {},
          diagnostics: settings.initial.diagnostics || {}
        });
        if (settings.initial_previous_window && settings.initial_previous_window.window && settings.initial_previous_window.axis) {
          cache_adjacent_window(settings.initial_previous_window);
        }
        if (settings.initial_next_window && settings.initial_next_window.window && settings.initial_next_window.axis) {
          cache_adjacent_window(settings.initial_next_window);
        }
        trim_window_store();
        render_window_store({
          at: initial_anchor,
          leading_cells_before: 1,
          restore_focus: false
        }, settings.i18n.status_ready);
      } else {
        state_host.hidden = false;
        render_template(state_host, 'unauthorized', settings);
        announce(settings.i18n.status_unauthorized);
      }
      update_timeline_blocking_loading_state();
      mount.addEventListener('click', handle_click);
      mount.addEventListener('keydown', handle_axis_keydown);
      if (booking_creation_host_enabled) {
        mount.addEventListener('wpbc:booking-new-inspector:created', handle_booking_creation_created);
        mount.addEventListener('wpbc:booking-new-inspector:focus-created', handle_booking_creation_focus_created);
      }
      document.addEventListener('wpbc:availability-timeslots:changed', handle_availability_timeslots_changed);
      if (settings.is_authorized && settings.initial && 'error' !== settings.initial.load_state) {
        schedule_initial_canvas_ready();
      }
    }

    /**
     * Remove the listeners owned by the Timeline mount.
     *
     * @return {void}
     */
    function remove_mount_event_listeners() {
      if (!mount) {
        return;
      }
      mount.removeEventListener('click', handle_click);
      mount.removeEventListener('keydown', handle_axis_keydown);
      if (booking_creation_host_enabled) {
        mount.removeEventListener('wpbc:booking-new-inspector:created', handle_booking_creation_created);
        mount.removeEventListener('wpbc:booking-new-inspector:focus-created', handle_booking_creation_focus_created);
      }
      document.removeEventListener('wpbc:availability-timeslots:changed', handle_availability_timeslots_changed);
    }

    /**
     * Remove horizontal-axis and viewport listeners owned by this controller.
     *
     * @return {void}
     */
    function destroy_axis_scroll_synchronization() {
      if (axis_scroll_canvas) {
        axis_scroll_canvas.removeEventListener('scroll', synchronize_axis_scroll);
        axis_scroll_canvas.removeEventListener('scroll', handle_window_store_scroll);
        axis_scroll_canvas.removeEventListener('scroll', schedule_edge_status_positioning);
        axis_scroll_canvas.removeEventListener('scroll', position_empty_range_selection_popover);
        axis_scroll_canvas.removeEventListener('wheel', contain_canvas_boundary_gesture);
        axis_scroll_canvas.removeEventListener('pointerdown', handle_canvas_navigation_pointer_down);
      }
      window.removeEventListener('resize', synchronize_axis_scroll);
      window.removeEventListener('resize', schedule_edge_status_positioning);
      window.removeEventListener('resize', position_empty_range_selection_popover);
      window.removeEventListener('scroll', schedule_edge_status_positioning);
      window.removeEventListener('scroll', position_empty_range_selection_popover);
      document.documentElement.classList.remove('wpbc_timeline_scroll_contained');
      document.body.classList.remove('wpbc_timeline_scroll_contained');
      axis_scroll_canvas = null;
    }

    /**
     * Cancel Timeline-owned animation frames and short lifecycle timers.
     *
     * @return {void}
     */
    function cancel_lifecycle_schedulers() {
      var animation_frames = [overflow_tooltip_frame, edge_status_frame, edge_scroll_frame, initial_canvas_ready_frame];
      animation_frames.forEach(function (frame_id) {
        if (frame_id) {
          window.cancelAnimationFrame(frame_id);
        }
      });
      overflow_tooltip_frame = 0;
      edge_status_frame = 0;
      edge_scroll_frame = 0;
      initial_canvas_ready_frame = 0;
    }

    /**
     * Destroy the current Timeline instance without removing its server mount.
     *
     * Teardown is idempotent and owns only resources created by this controller.
     * Shared UI globals remain intact, while Timeline-created booking adapters are
     * explicitly destroyed through their public contracts.
     *
     * @return {void}
     */
    function destroy() {
      if (!is_initialized) {
        return;
      }
      lifecycle_generation += 1;
      is_axis_window_loading_locked = false;
      preferences_save_pending = false;
      preferences_reset_pending = false;
      preferences_reset_button = null;
      preferences_reset_barrier_complete = true;
      accepted_booking_generation = 0;
      accepted_availability_generation = 0;
      authoritative_readback_generation = 0;
      active_booking_creation_readback_id = '';
      completed_booking_creation_readback_ids = {};
      completed_booking_creation_readback_order = [];
      is_foreground_request_loading = false;
      foreground_request_loading_message = '';
      is_availability_loading = false;
      is_selection_apply_loading = false;
      selection_apply_loading_message = '';
      if (preferences_save_timer) {
        window.clearTimeout(preferences_save_timer);
      }
      preferences_save_timer = 0;
      if (preferences_save_request && 'function' === typeof preferences_save_request.abort) {
        preferences_save_request.abort();
      }
      preferences_save_request = null;
      remove_mount_event_listeners();
      destroy_axis_scroll_synchronization();
      destroy_extensions();
      destroy_resource_navigation();
      destroy_resource_settings();
      destroy_toolbar_navigation();
      destroy_rendering();
      destroy_booking_interactions();
      destroy_empty_range_selection();
      cancel_lifecycle_schedulers();
      destroy_availability_cache();
      destroy_window_cache();
      if (edge_observer) {
        edge_observer.disconnect();
      }
      edge_observer = null;
      foreground_request_focus = null;
      if (mount) {
        mount.classList.remove('is-request-loading');
        mount.setAttribute('aria-busy', 'false');
        mount.removeAttribute('data-wpbc-timeline-initialized');
      }
      is_initialized = false;
    }
    return {
      initialize: initialize,
      replace_resource_view: replace_resource_view,
      destroy: destroy
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_timeline_page_controller);
  }
})(window, document, window.wp);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9fb3V0L3RpbWVsaW5lLXBhZ2UtY29udHJvbGxlci5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50Iiwid3AiLCJtb2R1bGVfaWQiLCJjcmVhdGVfdGltZWxpbmVfcGFnZV9jb250cm9sbGVyIiwiY29udGV4dCIsInNldHRpbmdzIiwibW91bnQiLCJzdGF0dXNfcmVnaW9uIiwib3ZlcmZsb3dfdG9vbHRpcF9mcmFtZSIsImVkZ2Vfc3RhdHVzX2ZyYW1lIiwiZm9yZWdyb3VuZF9yZXF1ZXN0X2ZvY3VzIiwiZm9yZWdyb3VuZF9yZXF1ZXN0X2xvYWRpbmdfbWVzc2FnZSIsImVkZ2Vfb2JzZXJ2ZXIiLCJlZGdlX3Njcm9sbF9mcmFtZSIsImluaXRpYWxfY2FudmFzX3JlYWR5X2ZyYW1lIiwiZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIiLCJib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyIiwicmVuZGVyaW5nX2NvbnRyb2xsZXIiLCJ3aW5kb3dfY2FjaGVfY29udHJvbGxlciIsImF2YWlsYWJpbGl0eV9jYWNoZV9jb250cm9sbGVyIiwiYXZhaWxhYmlsaXR5X2ZhaWx1cmVfYW5ub3VuY2VkIiwidG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIiLCJyZXNvdXJjZV9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIiLCJyZXNvdXJjZV9zZXR0aW5nc19jb250cm9sbGVyIiwiYXhpc19zY3JvbGxfY2FudmFzIiwiaXNfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQiLCJpc19pbml0aWFsaXplZCIsImxpZmVjeWNsZV9nZW5lcmF0aW9uIiwicHJlZmVyZW5jZXNfc2F2ZV90aW1lciIsInByZWZlcmVuY2VzX3NhdmVfcmVxdWVzdCIsInByZWZlcmVuY2VzX3NhdmVfcGVuZGluZyIsInByZWZlcmVuY2VzX3Jlc2V0X3BlbmRpbmciLCJwcmVmZXJlbmNlc19yZXNldF9idXR0b24iLCJwcmVmZXJlbmNlc19yZXNldF9iYXJyaWVyX2NvbXBsZXRlIiwiYWNjZXB0ZWRfYm9va2luZ19nZW5lcmF0aW9uIiwiYWNjZXB0ZWRfYXZhaWxhYmlsaXR5X2dlbmVyYXRpb24iLCJhdXRob3JpdGF0aXZlX3JlYWRiYWNrX2dlbmVyYXRpb24iLCJib29raW5nX2NyZWF0aW9uX2hvc3RfZW5hYmxlZCIsIkJvb2xlYW4iLCJuZXdfYm9va2luZyIsImxhdW5jaF9jb250ZXh0IiwiYWN0aXZlX2Jvb2tpbmdfY3JlYXRpb25fcmVhZGJhY2tfaWQiLCJjb21wbGV0ZWRfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19pZHMiLCJjb21wbGV0ZWRfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19vcmRlciIsImlzX2ZvcmVncm91bmRfcmVxdWVzdF9sb2FkaW5nIiwiaXNfYXZhaWxhYmlsaXR5X2xvYWRpbmciLCJpc19zZWxlY3Rpb25fYXBwbHlfbG9hZGluZyIsInNlbGVjdGlvbl9hcHBseV9sb2FkaW5nX21lc3NhZ2UiLCJleHRlbnNpb25faW5zdGFuY2VfaWRzIiwicHJlZmVyZW5jZV9hbmNob3JfZGF0ZSIsInByZWZlcmVuY2VzIiwiYW5jaG9yX2RhdGUiLCJTdHJpbmciLCJzdGFydF9kYXRlIiwicHJlZmVyZW5jZV9hbmNob3JfcmF0aW8iLCJOdW1iZXIiLCJpc0Zpbml0ZSIsImFuY2hvcl9yYXRpbyIsImVtcHR5X3JhbmdlX3NlbGVjdGlvbl9pbnN0YW5jZV9pZCIsImJvb2tpbmdfaW50ZXJhY3Rpb25zX2luc3RhbmNlX2lkIiwicmVuZGVyaW5nX2luc3RhbmNlX2lkIiwid2luZG93X2NhY2hlX2luc3RhbmNlX2lkIiwiYXZhaWxhYmlsaXR5X2NhY2hlX2luc3RhbmNlX2lkIiwidG9vbGJhcl9uYXZpZ2F0aW9uX2luc3RhbmNlX2lkIiwicmVzb3VyY2VfbmF2aWdhdGlvbl9pbnN0YW5jZV9pZCIsInJlc291cmNlX3NldHRpbmdzX2luc3RhbmNlX2lkIiwiZ2V0X3RlbXBsYXRlIiwidGVtcGxhdGVfa2V5IiwidGVtcGxhdGVfaWQiLCJ0ZW1wbGF0ZXMiLCJ0ZW1wbGF0ZSIsInJlbmRlcl90ZW1wbGF0ZSIsInRhcmdldCIsInZpZXdfbW9kZWwiLCJpbm5lckhUTUwiLCJlbWl0X2FjY2VwdGVkX2RhdGFfZXZlbnQiLCJldmVudF9uYW1lIiwiZXZlbnRfZGV0YWlsIiwiYWNjZXB0ZWRfZXZlbnQiLCJsZW5ndGgiLCJkaXNwYXRjaEV2ZW50IiwiQ3VzdG9tRXZlbnQiLCJkZXRhaWwiLCJjcmVhdGVFdmVudCIsImluaXRDdXN0b21FdmVudCIsImJlZ2luX2F1dGhvcml0YXRpdmVfcmVhZGJhY2siLCJyZWFzb24iLCJzY2hlbWFfdmVyc2lvbiIsImdlbmVyYXRpb24iLCJzdGF0ZSIsImNvbXBsZXRlX2F1dGhvcml0YXRpdmVfcmVhZGJhY2siLCJpbmRleE9mIiwic2V0X2F2YWlsYWJpbGl0eV9sb2FkaW5nIiwidHJhY2tfYXV0aG9yaXRhdGl2ZV9yZWFkYmFjayIsInJlcXVlc3QiLCJkb25lIiwiZmFpbCIsIm5vdGlmeV9hY2NlcHRlZF9ib29raW5nX3dpbmRvd3MiLCJ3aW5kb3dfZW50cmllcyIsIkFycmF5IiwiaXNBcnJheSIsImN1cnJlbnRfd2luZG93X2tleSIsIndpbmRvd19jb250ZXh0Iiwid2luZG93X2tleSIsInJlc291cmNlX2ZpbmdlcnByaW50IiwidGltZXpvbmUiLCJ3aW5kb3dzIiwiZ2V0X3RpbWVsaW5lX3ByZWZlcmVuY2VzX3NuYXBzaG90IiwidGltZWxpbmVfd2luZG93IiwiY3VycmVudF92aWV3IiwiY3VycmVudF9heGlzIiwidmlldyIsImF4aXMiLCJ2aXN1YWxfem9vbV9wZXJjZW50IiwiZ2V0X3Zpc3VhbF96b29tX3BlcmNlbnQiLCJ3aW5kb3dfZGF5cyIsIndpbmRvd19tb250aHMiLCJNYXRoIiwibWF4IiwibWluIiwiZmx1c2hfdGltZWxpbmVfcHJlZmVyZW5jZXNfc2F2ZSIsInRyYW5zcG9ydCIsInNuYXBzaG90IiwialF1ZXJ5IiwidXJsIiwiYWN0aW9uIiwibm9uY2UiLCJhamF4IiwibWV0aG9kIiwiZGF0YVR5cGUiLCJkYXRhIiwiT2JqZWN0IiwiYXNzaWduIiwiYWx3YXlzIiwiZmx1c2hfdGltZWxpbmVfcHJlZmVyZW5jZXNfcmVzZXQiLCJxdWV1ZV90aW1lbGluZV9wcmVmZXJlbmNlc19zYXZlIiwicHJlZmVyZW5jZV9vdmVycmlkZXMiLCJvdmVycmlkZXMiLCJzZXRUaW1lb3V0Iiwic2V0X3RpbWVsaW5lX3ByZWZlcmVuY2VfYW5jaG9yIiwicmVzZXRfYnV0dG9uIiwiZGVmYXVsdF9yZXF1ZXN0X2Rpc3BhdGNoZWQiLCJyZXNldF9hY3Rpb24iLCJyZW1vdmVBdHRyaWJ1dGUiLCJzaG93X3N0YW5kYXJkX2FkbWluX21lc3NhZ2UiLCJpMThuIiwidGltZWxpbmVfcmVzZXRfZmFpbGVkIiwic2V0X2ZvcmVncm91bmRfcmVxdWVzdF9sb2FkaW5nIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwicmVzb3VyY2Vfdmlld19jb250ZXh0IiwicmVzZXRfdG9fZGVmYXVsdHMiLCJyZXNvdXJjZV92aWV3IiwicmVzb3VyY2VfcGFnaW5hdGlvbiIsImV4cGFuZGVkX3Jlc291cmNlX2lkcyIsImV4cGFuZGVkX3BhcmVudF9pZHMiLCJyZWZyZXNoIiwiZXJyb3IiLCJyZXNwb25zZUpTT04iLCJtZXNzYWdlIiwicXVldWVfdGltZWxpbmVfcHJlZmVyZW5jZXNfcmVzZXQiLCJyZXNldF93YWl0ZXJzIiwicmVzZXRfcmVxdWVzdGVkX2V2ZW50Iiwid2FpdF91bnRpbCIsInByb21pc2UiLCJ0aGVuIiwicHVzaCIsImNsZWFyVGltZW91dCIsInNldEF0dHJpYnV0ZSIsInJlc2V0dGluZ190aW1lbGluZSIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJ3YWl0ZXIiLCJyZXNvbHZlIiwiY2F0Y2giLCJpbml0aWFsaXplX3dpbmRvd19jYWNoZSIsIm1vZHVsZV9ydW50aW1lIiwid3BiY190aW1lbGluZV9tb2R1bGVzIiwiY3JlYXRlIiwic3luY2hyb25pemVfYXhpc19zY3JvbGwiLCJkZXN0cm95X3dpbmRvd19jYWNoZSIsImRlc3Ryb3kiLCJpbml0aWFsaXplX2V4dGVuc2lvbnMiLCJzdGFibGVfaWRlbnRpZmllciIsImV4dGVuc2lvbnMiLCJmb3JFYWNoIiwiZXh0ZW5zaW9uIiwiaW5zdGFuY2VfaWQiLCJjYXBhYmlsaXRpZXMiLCJleHRlbnNpb25fY29udGV4dCIsImV4dGVuc2lvbl9pbnN0YW5jZSIsInRlc3QiLCJoYXNfZmFjdG9yeSIsInByZXNlbnRhdGlvbl9hcGkiLCJvcGVuX2ZpcnN0IiwicHJlc2VudGF0aW9uX2lkIiwib3Blbl9maXJzdF9yb3dfcHJlc2VudGF0aW9uIiwiY29uZmlndXJhdGlvbiIsInNlbGVjdGlvbl9hcGkiLCJnZXRfcmVxdWVzdF9jb250ZXh0IiwiZ2V0X2V4dGVuc2lvbl9zZWxlY3Rpb25fcmVxdWVzdF9jb250ZXh0IiwicmVmcmVzaF9hZnRlcl9hcHBseSIsInJlZnJlc2hfYWZ0ZXJfYXZhaWxhYmlsaXR5X211dGF0aW9uIiwiYW5ub3VuY2UiLCJpc19ob3N0X2FjdGl2ZSIsInNjaGVkdWxlX2luaXRpYWxfY2FudmFzX3JlYWR5IiwicmVhZHlfZ2VuZXJhdGlvbiIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImRlc3Ryb3lfZXh0ZW5zaW9ucyIsImluaXRpYWxpemVfYXZhaWxhYmlsaXR5X2NhY2hlIiwiZ2V0X2F4aXMiLCJnZXRfZ2VvbWV0cnkiLCJnZXRfY29tcG9zZWRfc2VnbWVudF9nZW9tZXRyeSIsIm9uX2NoYW5nZSIsImhhbmRsZV9hdmFpbGFiaWxpdHlfY2FjaGVfY2hhbmdlIiwib25fc3RhdHVzX2NoYW5nZSIsImhhbmRsZV9hdmFpbGFiaWxpdHlfY2FjaGVfc3RhdHVzX2NoYW5nZSIsImNoYW5nZSIsImF2YWlsYWJpbGl0eV9sb2FkX2ZhaWxlZCIsInN0YXR1cyIsIndhc19sb2FkaW5nIiwiaXNfc2V0dGxlZCIsInBlbmRpbmdfY291bnQiLCJsb2FkZWRfY291bnQiLCJkZXNpcmVkX2NvdW50IiwiZmFpbGVkX2NvdW50IiwidGltZWxpbmVfcmVmcmVzaF9jb21wbGV0ZSIsImlzX2xvYWRpbmciLCJzaG91bGRfc2hvdyIsImxvYWRpbmdfYXZhaWxhYmlsaXR5X2JhY2tncm91bmRzIiwidXBkYXRlX3RpbWVsaW5lX2Jsb2NraW5nX2xvYWRpbmdfc3RhdGUiLCJzeW5jaHJvbml6ZV9hdmFpbGFiaWxpdHlfY2FjaGUiLCJzeW5jaHJvbml6ZSIsImludmFsaWRhdGVfYXZhaWxhYmlsaXR5X2NhY2hlIiwiaW52YWxpZGF0ZSIsImRlc3Ryb3lfYXZhaWxhYmlsaXR5X2NhY2hlIiwiY2FuY2VsX2FjdGl2ZV9lbXB0eV9yYW5nZV9zZWxlY3Rpb24iLCJpc19hY3RpdmUiLCJjYW5jZWwiLCJpbml0aWFsaXplX3Rvb2xiYXJfbmF2aWdhdGlvbiIsIndpbmRvd19jYWNoZSIsImNhbGxiYWNrcyIsImNhbmNlbF9hbmNob3JfcmVzdG9yYXRpb24iLCJjYW5jZWxfYXhpc19hbmNob3JfcmVzdG9yYXRpb24iLCJzdXNwZW5kX2FkamFjZW50X2xvYWRpbmciLCJzdXNwZW5kX2FkamFjZW50X2xvYWRpbmdfZm9yX25hdmlnYXRpb24iLCJzY2hlZHVsZV9vdmVyZmxvd190b29sdGlwcyIsInNjaGVkdWxlX292ZXJmbG93X3Rvb2x0aXBfc3luY2hyb25pemF0aW9uIiwic2NoZWR1bGVfZWRnZV9zdGF0dXMiLCJzY2hlZHVsZV9lZGdlX3N0YXR1c19wb3NpdGlvbmluZyIsInNjaGVkdWxlX2Jvb2tpbmdfbGF5b3V0Iiwic2NoZWR1bGVfYm9va2luZ19pbnRlcmFjdGlvbl9sYXlvdXRfYWZ0ZXJfYXhpc19tb3Rpb24iLCJjYW5jZWxfYWN0aXZlX3NlbGVjdGlvbiIsInJlc3RvcmVfbG9hZGVkX2FuY2hvciIsInJlcXVlc3Rfd2luZG93IiwiYWRkX2N1cnJlbnRfd2luZG93X3NwYW4iLCJhY3RpdmF0ZV9hZGphY2VudF9pbnRlbnQiLCJhY3RpdmF0ZV9hZGphY2VudF9uYXZpZ2F0aW9uX2ludGVudCIsInJlcXVlc3RfYWRqYWNlbnRfd2luZG93Iiwic2F2ZV9wcmVmZXJlbmNlcyIsInJlc2V0X3ByZWZlcmVuY2VzIiwic2V0X3ByZWZlcmVuY2VfYW5jaG9yIiwiZGVzdHJveV90b29sYmFyX25hdmlnYXRpb24iLCJpbml0aWFsaXplX3Jlc291cmNlX25hdmlnYXRpb24iLCJzaG93X2FkbWluX21lc3NhZ2UiLCJyZXBsYWNlX3Jlc291cmNlX3ZpZXciLCJkZXN0cm95X3Jlc291cmNlX25hdmlnYXRpb24iLCJpbml0aWFsaXplX3Jlc291cmNlX3NldHRpbmdzIiwicmVmcmVzaF9hZnRlcl9tdXRhdGlvbiIsInJlZnJlc2hfYWZ0ZXJfcmVzb3VyY2Vfc2V0dGluZ3NfbXV0YXRpb24iLCJkZXN0cm95X3Jlc291cmNlX3NldHRpbmdzIiwiYW5jaG9yIiwiY2FwdHVyZV9heGlzX2FuY2hvciIsInJlYWRiYWNrX2dlbmVyYXRpb24iLCJhbmNob3JfYXQiLCJhdCIsInJhdGlvIiwid2luZG93X3Bvc2l0aW9uIiwibG9hZGluZyIsInJlbG9hZGluZ190aW1lbGluZSIsImNvbXBsZXRlIiwic3RhdHVzX3JlYWR5Iiwic3VwcHJlc3NfY29tcGxldGVfbWVzc2FnZSIsInByZXNlcnZlX3NlbGVjdGlvbiIsImdldF9lbXB0eV9yYW5nZV9zZWxlY3Rpb25fcmV0dXJuX2NvbnRleHQiLCJnZXRfbG9hZGVkX2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250ZXh0X3Rva2VucyIsImdldF9zZWxlY3Rpb25fY29udGV4dF90b2tlbnMiLCJzZWxlY3Rpb25fdHJhbnNwb3J0Iiwic2VsZWN0aW9uIiwicHJldmlld19hY3Rpb24iLCJhcHBseV9hY3Rpb24iLCJwcmV2aWV3X25vbmNlIiwiYXBwbHlfbm9uY2UiLCJsb2FkZWRfc3RhcnRfYXQiLCJzdGFydF9hdCIsImxvYWRlZF9lbmRfYXQiLCJlbmRfYXQiLCJsb2FkZWRfY29udGV4dF90b2tlbnMiLCJzbGljZSIsInJldHVybl9jb250ZXh0IiwicmVxdWVzdF90aW1lb3V0X21zIiwiZ2V0X3dpbmRvd19sb2FkaW5nX2xpbWl0cyIsImFwcGx5aW5nX2F2YWlsYWJpbGl0eSIsImhhbmRsZV9hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2NoYW5nZWQiLCJldmVudCIsInJlc291cmNlX2lkIiwibW9kZSIsImluaXRpYWxpemVfZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uIiwiZ2V0X3NlZ21lbnRfZ2VvbWV0cnkiLCJnZXRfcmV0dXJuX2NvbnRleHQiLCJnZXRfbG9hZGVkX2NvbnRleHRfdG9rZW5zIiwiZ2V0X3JlcXVlc3RfdGltZW91dF9tcyIsInNldF9hcHBseV9sb2FkaW5nIiwic2V0X3NlbGVjdGlvbl9hcHBseV9sb2FkaW5nIiwiZGVzdHJveV9lbXB0eV9yYW5nZV9zZWxlY3Rpb24iLCJyZWZyZXNoX2FmdGVyX2Jvb2tpbmdfaW5zcGVjdG9yX3NhdmUiLCJkaXNwYXRjaF9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX3Jlc3VsdCIsInJlYWRiYWNrX2V2ZW50IiwicmVtZW1iZXJfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19pZCIsInJlcXVlc3RfaWQiLCJvbGRlc3RfcmVxdWVzdF9pZCIsInNoaWZ0IiwiaGFuZGxlX2Jvb2tpbmdfY3JlYXRpb25fZm9jdXNfY3JlYXRlZCIsImJvb2tpbmdfaWQiLCJyb3VuZCIsImZvY3VzX2NyZWF0ZWRfYm9va2luZyIsImNvbnN1bWVfYm9va2luZ19jcmVhdGlvbl9zZWxlY3Rpb24iLCJjb25zdW1lZCIsInRva2VuIiwic291cmNlX2NvbnRleHRfdG9rZW4iLCJxdWVyeV9hcmciLCJoYW5kb2ZmX3F1ZXJ5X2FyZyIsImNvbnN1bWVfc2lnbmVkX2FjdGlvbl9jb250ZXh0IiwiZ2V0X2luc3RhbmNlIiwiaGFuZGxlX2Jvb2tpbmdfY3JlYXRpb25fY3JlYXRlZCIsInJlYWRiYWNrX3JlcXVlc3QiLCJwcmVwYXJlX2NyZWF0ZWRfYm9va2luZ19yZWFkYmFjayIsImJvb2tpbmdfdmlzaWJsZSIsImNyZWF0aW9uX2luc3BlY3RvciIsInF1ZXJ5U2VsZWN0b3IiLCJjb21wbGV0ZV9jcmVhdGVkX2Jvb2tpbmdfcmVhZGJhY2siLCJvcGVuX2Jvb2tpbmdfaW5zcGVjdG9yIiwib3Blbl9jcmVhdGVkX2Jvb2tpbmdfaW5zcGVjdG9yIiwiaGlkZGVuIiwicmVmcmVzaF9hZnRlcl9ib29raW5nX3Jlc2l6ZV9hcHBseSIsImluaXRpYWxpemVfYm9va2luZ19pbnRlcmFjdGlvbnMiLCJpc19lbXB0eV9yYW5nZV9yZXNpemluZyIsImlzX3Jlc2l6aW5nIiwicmVmcmVzaF9hZnRlcl9pbnNwZWN0b3Jfc2F2ZSIsInJlZnJlc2hfYWZ0ZXJfcmVzaXplX2FwcGx5Iiwic2Nyb2xsX2F4aXNfZnJvbV9leHRlcm5hbF93aGVlbCIsInNldF9heGlzX3dpbmRvd19sb2FkaW5nX2xvY2tlZCIsImlzX2xvY2tlZCIsImFib3J0X2VkZ2VfcmVxdWVzdHMiLCJkZXN0cm95X2Jvb2tpbmdfaW50ZXJhY3Rpb25zIiwic2NoZWR1bGVfYm9va2luZ19pbnRlcmFjdGlvbl9sYXlvdXQiLCJzY2hlZHVsZV9sYXlvdXQiLCJzY2hlZHVsZV9sYXlvdXRfYWZ0ZXJfYXhpc19tb3Rpb24iLCJoYW5kbGVfcm93c19zeW5jaHJvbml6ZWQiLCJzeW5jaHJvbml6ZV9lZGdlX3BsYWNlaG9sZGVyX3Jvd3MiLCJpbml0aWFsaXplX3JlbmRlcmluZyIsImJlZ2luX2Jvb2tpbmdfcmVmcmVzaCIsImJlZ2luX3JlZnJlc2giLCJyZWdpc3Rlcl9ib29raW5nX3NlZ21lbnQiLCJzZWdtZW50X2VsZW1lbnQiLCJzZWdtZW50IiwicmVzb3VyY2Vfc3VtbWFyeSIsInJlZ2lzdGVyX3NlZ21lbnQiLCJjb21wbGV0ZV9ib29raW5nX3JlZnJlc2giLCJjb21wbGV0ZV9yZWZyZXNoIiwiYWZ0ZXJfcm93X3N5bmNocm9uaXphdGlvbiIsImRlc3Ryb3lfcmVuZGVyaW5nIiwicmVuZGVyX3Jvd3MiLCJpbml0aWFsIiwib2JzZXJ2ZV9yZW5kZXJlZF9yb3dzIiwib2JzZXJ2ZV9yb3dzIiwic3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMiLCJ0aW1lbGluZV9tb3VudCIsIndwYmNfdWlfY2F0YWxvZyIsImdldF9sb2FkaW5nX2xpbWl0cyIsInJlc2V0X3dpbmRvd19zdG9yZSIsInJlc2V0IiwiY2FjaGVfYWRqYWNlbnRfd2luZG93IiwiY2FjaGVfYWRqYWNlbnQiLCJ0cmltX3dpbmRvd19zdG9yZSIsInRyaW0iLCJtYXBfdGltZXN0YW1wX3RvX2F4aXNfcG9zaXRpb24iLCJ0aW1lc3RhbXAiLCJjZWxscyIsInN0YXJ0X2Vwb2NoIiwiZW5kX2Vwb2NoIiwiY29tcG9zZV93aW5kb3dfc3RvcmUiLCJjb21wb3NlIiwiY2FudmFzIiwiYXhpc192aWV3cG9ydCIsInNjcm9sbExlZnQiLCJkaXJlY3Rpb24iLCJmb3JjZSIsImdldF9hZGphY2VudF9kaXJlY3Rpb25fZm9yX2hvcml6b250YWxfZGVsdGEiLCJob3Jpem9udGFsX2RlbHRhIiwiaXNfcnRsIiwiZ2V0X2hvcml6b250YWxfd2hlZWxfZGVsdGEiLCJkZWx0YV94IiwiZGVsdGFYIiwiZGVsdGFfeSIsImRlbHRhWSIsInNoaWZ0S2V5IiwiYWJzIiwiaXNfb3V0d2FyZF9jYW52YXNfZ2VzdHVyZSIsImNhbnZhc19ib2R5IiwiY2FudmFzX3JlY3RhbmdsZSIsImJvZHlfcmVjdGFuZ2xlIiwiYm91bmRhcnlfdG9sZXJhbmNlIiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwibGVmdCIsInJpZ2h0IiwiY29udGFpbl9jYW52YXNfYm91bmRhcnlfZ2VzdHVyZSIsImlzX291dHdhcmRfZ2VzdHVyZSIsImNhbmNlbGFibGUiLCJjdHJsS2V5IiwibWV0YUtleSIsImFsdEtleSIsImN1cnJlbnRUYXJnZXQiLCJwcmV2ZW50RGVmYXVsdCIsImdldF9ob3Jpem9udGFsX3doZWVsX2Rpc3RhbmNlIiwiZGVsdGFNb2RlIiwiY2xpZW50V2lkdGgiLCJob3Jpem9udGFsX2Rpc3RhbmNlIiwic2Nyb2xsQnkiLCJiZWhhdmlvciIsInRvcCIsImhhbmRsZV9jYW52YXNfbmF2aWdhdGlvbl9wb2ludGVyX2Rvd24iLCJwb2ludGVyVHlwZSIsImJ1dHRvbiIsInNldF9wb2ludGVyX25hdmlnYXRpb25fYWN0aXZlIiwiaW5pdGlhbGl6ZV9heGlzX3Njcm9sbF9zeW5jaHJvbml6YXRpb24iLCJkb2N1bWVudEVsZW1lbnQiLCJjbGFzc0xpc3QiLCJhZGQiLCJib2R5IiwiYWRkRXZlbnRMaXN0ZW5lciIsInBhc3NpdmUiLCJoYW5kbGVfd2luZG93X3N0b3JlX3Njcm9sbCIsInBvc2l0aW9uX2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9wb3BvdmVyIiwicG9zaXRpb25fcG9wb3ZlciIsInRleHRDb250ZW50IiwibWVzc2FnZV90eXBlIiwiZGVsYXkiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsImVzY2FwZV9hZG1pbl9tZXNzYWdlX3RleHQiLCJyZXBsYWNlIiwib3ZlcmxheSIsIm92ZXJsYXlfbWVzc2FnZSIsInRvb2xiYXJfY29udHJvbHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiYmxvY2tpbmdfc3VyZmFjZXMiLCJmb2N1c190b19yZXN0b3JlIiwic2V0X3JlcXVlc3RfbG9hZGluZyIsInRvZ2dsZSIsInByb3RvdHlwZSIsImNhbGwiLCJibG9ja2luZ19zdXJmYWNlIiwiYWN0aXZlRWxlbWVudCIsImNvbnRhaW5zIiwidG9vbGJhcl9jb250cm9sIiwiZGlzYWJsZWQiLCJyZWZyZXNoX2FmdGVyX3dpbmRvd19yZW5kZXIiLCJmb2N1cyIsInByZXZlbnRTY3JvbGwiLCJpc19mb3JlZ3JvdW5kX2dlbmVyYXRpb25fY3VycmVudCIsInNldF9yb3dfZXhwYW5kZWQiLCJyb3dfa2V5IiwiaXNfZXhwYW5kZWQiLCJ0cmlnZ2VyIiwic2V0X2hpZXJhcmNoeV9leHBhbmRlZCIsInBhcmVudF9pZCIsInJlc3RvcmVfZm9jdXMiLCJyZXN0b3JlX2F4aXNfYW5jaG9yIiwic2NoZWR1bGVfYXhpc19hbmNob3JfcmVzdG9yYXRpb24iLCJvbl9jb21wbGV0ZSIsInNjaGVkdWxlX2FuY2hvcl9yZXN0b3JhdGlvbiIsInJlc29sdmVfcmVzcG9uc2VfZGF0ZV9hbmNob3IiLCJpc19hbmNob3JfbG9hZGVkIiwiYWJvcnRfYWN0aXZlX3dpbmRvd19yZXF1ZXN0IiwiYWJvcnRfZm9yZWdyb3VuZF9yZXF1ZXN0IiwicmVmcmVzaF90b2RheV9wcmVzZW50YXRpb24iLCJhbmNob3JfZXBvY2giLCJlcG9jaCIsInRhcmdldF9jZWxsIiwic29tZSIsImNlbGwiLCJpc190aW1lZCIsInBvc2l0aW9uX3BlcmNlbnQiLCJtYXJrZXIiLCJzdHlsZSIsInNldFByb3BlcnR5IiwiZGF0ZV9lbGVtZW50IiwiZGF0ZSIsImdldEF0dHJpYnV0ZSIsIm9wdGlvbnMiLCJzdGF0ZV9ob3N0IiwicmVzdG9yZV9vcHRpb25zIiwicmVmcmVzaF90b2RheSIsImFubm91bmNlbWVudCIsInJlbmRlcl9lZGdlX3N0YXRlcyIsInJlbmRlcl9lZGdlX3N0YXRlIiwiZ2V0X2VkZ2Vfc3RhdGUiLCJoZWFkZXJfaG9zdCIsImNhbnZhc19ob3N0IiwiZWRnZV9lbnRyeSIsImdldF9lZGdlX3dpbmRvd19lbnRyeSIsInBheWxvYWQiLCJwcmV2aWV3cyIsImFkamFjZW50X3ByZXZpZXdzIiwicHJldmlldyIsImNvbW1vbl92aWV3X21vZGVsIiwicmFuZ2VfbGFiZWwiLCJwbGFjZWhvbGRlcl9yb3dzIiwiYnVpbGRfZWRnZV9wbGFjZWhvbGRlcl9yb3dzIiwiYXJlYSIsImNlbGxfY291bnQiLCJlZGdlX3BsYWNlaG9sZGVyX2NlbGxzIiwiY2FudmFzX3Jvd3MiLCJjYW52YXNfcm93IiwiY2VsbF9pbmRleCIsImhlaWdodF9weCIsImNlaWwiLCJoZWlnaHQiLCJyZXF1aXJlc19yZW5kZXIiLCJob3N0IiwicmVuZGVyZWRfcm93cyIsInJlbmRlcmVkX3JvdyIsInJvd19pbmRleCIsInVwZGF0ZV9lZGdlX3N0YXR1c19wb3NpdGlvbnMiLCJzdGlja3lfaGVhZGVyIiwic3RpY2t5X2JvdW5kYXJ5IiwiYm90dG9tIiwic3RhdHVzX2VsZW1lbnRzIiwic3RpY2t5X2dhcCIsInZpZXdwb3J0X2hlaWdodCIsImNsaWVudEhlaWdodCIsImlubmVySGVpZ2h0Iiwic3RhdHVzX2VsZW1lbnQiLCJlZGdlX2J1ZmZlciIsImNsb3Nlc3QiLCJidWZmZXJfcmVjdGFuZ2xlIiwibWF4aW11bV9vZmZzZXQiLCJkZXNpcmVkX29mZnNldCIsInZpc2libGVfc3BhY2UiLCJvZmZzZXRIZWlnaHQiLCJyZXNvdXJjZXMiLCJyZW5kZXJfd2luZG93X3N0b3JlIiwiY29tcG9zZWQiLCJicm93c2VyX2V4cGFuc2lvbl9wcmVmZXJlbmNlcyIsImFjY2VwdGVkX3dpbmRvd19lbnRyaWVzIiwiY3VycmVudCIsInZpZXdfcG9saWN5IiwibG9hZF9zdGF0ZSIsInNlZ21lbnRzIiwib2NjdXBhbmN5IiwidGltZV9zbG90X292ZXJmbG93cyIsInN0YXR1c19lbXB0eSIsInJlbmRlciIsImluaXRpYWxpemVfZWRnZV9vYnNlcnZlciIsImdldF9vcmRlcmVkX3dpbmRvd19lbnRyaWVzIiwicHJvbW90ZV92aXNpYmxlX3dpbmRvdyIsInByb21vdGlvbiIsInByb21vdGVfZm9yX2FuY2hvciIsInRyaW1tZWQiLCJlbnRyeSIsImlzX2VkZ2Vfc2VudGluZWxfbmVhciIsInNlbnRpbmVsX3JlY3RhbmdsZSIsImV4cGFuc2lvbl9wZXJjZW50IiwidGhyZXNob2xkIiwid2lkdGgiLCJsaW1pdHMiLCJzZW50aW5lbCIsImlzX25lYXJfcmVhcm0iLCJlZGdlX3JlYXJtX3BlcmNlbnQiLCJ1cGRhdGVfZWRnZV9wcm94aW1pdHkiLCJlZGdlX3ByZWZldGNoX3BlcmNlbnQiLCJtYXJnaW4iLCJkaXNjb25uZWN0IiwiSW50ZXJzZWN0aW9uT2JzZXJ2ZXIiLCJlbnRyaWVzIiwiaXNJbnRlcnNlY3RpbmciLCJhcm1lZCIsInVzZXJfaW50ZW50Iiwicm9vdCIsInJvb3RNYXJnaW4iLCJvYnNlcnZlIiwicmVxdWVzdF9vcHRpb25zIiwiYWxsb3dfd2l0aG91dF91c2VyX2ludGVudCIsImRlZmVyX3JlbmRlciIsInNpbGVudCIsInNraXBfcHJvbW90aW9uIiwiZGVzY3JpcHRvciIsImhhZF91c2VyX2ludGVudCIsInJlcXVlc3RfdmFsdWVzIiwiY29tcGxldGlvbiIsIkRlZmVycmVkIiwiaXNfaW50ZW50X2Jsb2NrZWQiLCJhZGphY2VudF9yZXF1ZXN0cyIsIkRhdGUiLCJub3ciLCJjb29sZG93bl91bnRpbCIsImJlZ2luX2VkZ2VfcmVxdWVzdCIsInJlcXVlc3RfZ2VuZXJhdGlvbiIsImxvYWRpbmdfcHJldmlvdXNfZGF0ZXMiLCJsb2FkaW5nX25leHRfZGF0ZXMiLCJ0aW1lb3V0IiwiaXNfZWRnZV9nZW5lcmF0aW9uX2N1cnJlbnQiLCJyZWplY3QiLCJtYXJrX2VkZ2VfZXJyb3IiLCJlZGdlX2xvYWRfZmFpbGVkIiwibWFya19lZGdlX2xvYWRlZCIsImFkamFjZW50X2RhdGVzX2xvYWRlZCIsInJlcXVlc3Rfc3RhdHVzIiwiY29tcGxldGVfZWRnZV9yZXF1ZXN0Iiwic2V0X2VkZ2VfcmVxdWVzdCIsInNjaGVkdWxlX2VkZ2Vfc2xvd19zdGF0ZSIsInJlcXVlc3RfcmVzb3VyY2VfY29udGV4dF9uZWlnaGJvciIsImN1cnJlbnRfcmVzcG9uc2UiLCJkZXNjcmlwdG9ycyIsImFqYXhfcmVxdWVzdCIsInJlc3BvbnNlX2NvbnRleHQiLCJhYm9ydCIsInN0YWdlX3Jlc291cmNlX2NvbnRleHRfcmVwbGFjZW1lbnQiLCJwcmV2aW91c19yZXF1ZXN0IiwibmV4dF9yZXF1ZXN0Iiwid2hlbiIsInByZXZpb3VzX3Jlc3BvbnNlIiwibmV4dF9yZXNwb25zZSIsImNvbW1pdHRlZCIsInJlcGxhY2VfcmVzb3VyY2VfY29udGV4dCIsInByaW1lX3N1cnJvdW5kaW5nX3dpbmRvd3MiLCJmb3JlZ3JvdW5kX2dlbmVyYXRpb24iLCJyZW1haW5pbmciLCJzZXR0bGUiLCJjYW5jZWxfYWRqYWNlbnRfd2luZG93IiwiY2FuY2VsX2VkZ2VfcmVxdWVzdCIsImxvYWRpbmdfY2FuY2VsbGVkIiwibG9hZF9idXR0b24iLCJyZW5kZXJfd2luZG93X2Vycm9yIiwiZXJyb3JfbWVzc2FnZSIsInByZXNlcnZlX3N0YXJ0IiwibWF5X3JlZHVjZSIsInJlcXVlc3RfZmVlZGJhY2siLCJmZWVkYmFjayIsInJlc291cmNlX3JlcGxhY2VtZW50IiwiZmluaXNoX3JlcXVlc3QiLCJjb21wbGV0ZV9mb3JlZ3JvdW5kX3JlcXVlc3QiLCJiZWdpbl9mb3JlZ3JvdW5kX3JlcXVlc3QiLCJ0YXJnZXRfZGF0ZSIsInVzZV9yZXNwb25zZV9zdGFydCIsImdldF9yZXNvdXJjZV9maW5nZXJwcmludCIsInNldF9mb3JlZ3JvdW5kX3JlcXVlc3QiLCJwZXJzaXN0X3ByZWZlcmVuY2VzIiwic3VnZ2VzdGVkX2RheXMiLCJkZXRhaWxzIiwic3VnZ2VzdGVkX3dpbmRvd19kYXlzIiwid2luZG93X3JlZHVjZWQiLCJsb2FkaW5nX3JlZHVjZWRfd2luZG93IiwiaGFuZGxlX2F4aXNfa2V5ZG93biIsImhhbmRsZV9rZXlkb3duIiwiaGFuZGxlX2NsaWNrIiwicmV0cnlfYnV0dG9uIiwiZWRnZV9sb2FkX2J1dHRvbiIsImVkZ2VfY2FuY2VsX2J1dHRvbiIsInJvd190b2dnbGUiLCJoaWVyYXJjaHlfdG9nZ2xlIiwiaGFuZGxlX3Jvd19wcmVzZW50YXRpb25fY2xpY2siLCJwcmVwYXJlX2VkZ2VfcmV0cnkiLCJpbml0aWFsaXplIiwiaW5pdGlhbF9hbmNob3IiLCJyZW5kZXJfY29udHJvbHMiLCJpc19hdXRob3JpemVkIiwiY3VycmVudF90aW1lX21hcmtlciIsImRpYWdub3N0aWNzIiwiaW5pdGlhbF9wcmV2aW91c193aW5kb3ciLCJpbml0aWFsX25leHRfd2luZG93IiwibGVhZGluZ19jZWxsc19iZWZvcmUiLCJzdGF0dXNfdW5hdXRob3JpemVkIiwicmVtb3ZlX21vdW50X2V2ZW50X2xpc3RlbmVycyIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJkZXN0cm95X2F4aXNfc2Nyb2xsX3N5bmNocm9uaXphdGlvbiIsInJlbW92ZSIsImNhbmNlbF9saWZlY3ljbGVfc2NoZWR1bGVycyIsImFuaW1hdGlvbl9mcmFtZXMiLCJmcmFtZV9pZCIsImNhbmNlbEFuaW1hdGlvbkZyYW1lIiwicmVnaXN0ZXJfZmFjdG9yeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtdGltZWxpbmUvX3NyYy90aW1lbGluZS1wYWdlLWNvbnRyb2xsZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBZG1pbmlzdHJhdGlvbiBUaW1lbGluZSBwYWdlLWNvbnRyb2xsZXIgb3JjaGVzdHJhdGlvbi5cbiAqXG4gKiBUaGUgc2VydmVyIG93bnMgYWxsIHZpZXcgZGF0YSBhbmQgV29yZFByZXNzIHRlbXBsYXRlcy4gVGhpcyBjb250cm9sbGVyIG9ubHlcbiAqIG1vdW50cyB0aGUgcGFnZSBzaGVsbCBhbmQgZGVsZWdhdGVzIGJvdW5kZWQtd2luZG93IGNvbXBvc2l0aW9uLCByZXF1ZXN0XG4gKiBvd25lcnNoaXAsIGFuY2hvciByZXN0b3JhdGlvbiwgdG9vbGJhci9uYXZpZ2F0aW9uLCByb3cgcmVuZGVyaW5nLCByb3dcbiAqIHN5bmNocm9uaXphdGlvbiwgZW1wdHktcmFuZ2Ugc2VsZWN0aW9uLCBhbmQgYm9va2luZyBpbnRlcmFjdGlvbnMgdG9cbiAqIHJlZ2lzdGVyZWQgbW9kdWxlcy5cbiAqIEF1dGhvcml6ZWQgcmVhZHMgYW5kIHdyaXRlcyByZW1haW4gc2VydmVyLWRvbWFpbiBhY3Rpb25zLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCwgd3AgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2lkID0gJ3BhZ2VfY29udHJvbGxlcic7XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgVGltZWxpbmUgcGFnZSBjb250cm9sbGVyIGJlaGluZCB0aGUgc2hhcmVkIG1vZHVsZSBsaWZlY3ljbGUuXG5cdCAqXG5cdCAqIFRoZSBjb21wb3NpdGlvbiBlbnRyeSBwb2ludCBzdXBwbGllcyB0aGUgc2VydmVyLW93bmVkIG1vdW50LCBzdGF0dXMgcmVnaW9uLFxuXHQgKiBhbmQgY29uZmlndXJhdGlvbi4gRm9jdXNlZCBtb2R1bGVzIGNvbnRpbnVlIHRvIG93biB0aGVpciBib3VuZGVkIHN0YXRlXG5cdCAqIG1hY2hpbmVzIHdoaWxlIHRoaXMgY29udHJvbGxlciBjb29yZGluYXRlcyB0aGVpciBwYWdlLWxldmVsIGludGVyYWN0aW9ucy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgIGNvbnRleHQgICAgICAgICAgICAgICBDb250cm9sbGVyIGNvbnN0cnVjdGlvbiBjb250ZXh0LlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9ICAgICAgY29udGV4dC5tb3VudCAgICAgICAgIFRpbWVsaW5lIG1vdW50IGVsZW1lbnQuXG5cdCAqIEBwYXJhbSB7RWxlbWVudHxudWxsfSBjb250ZXh0LnN0YXR1c19yZWdpb24gQWNjZXNzaWJsZSBsaXZlLXN0YXR1cyByZWdpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICBjb250ZXh0LnNldHRpbmdzICAgICAgU2VydmVyLWxvY2FsaXplZCBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEluaXRpYWxpemUgYW5kIGRlc3Ryb3kgbGlmZWN5Y2xlIG1ldGhvZHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfdGltZWxpbmVfcGFnZV9jb250cm9sbGVyKCBjb250ZXh0ICkge1xuXHR2YXIgc2V0dGluZ3MgPSBjb250ZXh0ICYmIGNvbnRleHQuc2V0dGluZ3MgPyBjb250ZXh0LnNldHRpbmdzIDoge307XG5cdHZhciBtb3VudCA9IGNvbnRleHQgJiYgY29udGV4dC5tb3VudCA/IGNvbnRleHQubW91bnQgOiBudWxsO1xuXHR2YXIgc3RhdHVzX3JlZ2lvbiA9IGNvbnRleHQgJiYgY29udGV4dC5zdGF0dXNfcmVnaW9uID8gY29udGV4dC5zdGF0dXNfcmVnaW9uIDogbnVsbDtcblx0dmFyIG92ZXJmbG93X3Rvb2x0aXBfZnJhbWUgPSAwO1xuXHR2YXIgZWRnZV9zdGF0dXNfZnJhbWUgPSAwO1xuXHR2YXIgZm9yZWdyb3VuZF9yZXF1ZXN0X2ZvY3VzID0gbnVsbDtcblx0dmFyIGZvcmVncm91bmRfcmVxdWVzdF9sb2FkaW5nX21lc3NhZ2UgPSAnJztcblx0dmFyIGVkZ2Vfb2JzZXJ2ZXIgPSBudWxsO1xuXHR2YXIgZWRnZV9zY3JvbGxfZnJhbWUgPSAwO1xuXHR2YXIgaW5pdGlhbF9jYW52YXNfcmVhZHlfZnJhbWUgPSAwO1xuXHR2YXIgZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIgPSBudWxsO1xuXHR2YXIgYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlciA9IG51bGw7XG5cdHZhciByZW5kZXJpbmdfY29udHJvbGxlciA9IG51bGw7XG5cdHZhciB3aW5kb3dfY2FjaGVfY29udHJvbGxlciA9IG51bGw7XG5cdHZhciBhdmFpbGFiaWxpdHlfY2FjaGVfY29udHJvbGxlciA9IG51bGw7XG5cdHZhciBhdmFpbGFiaWxpdHlfZmFpbHVyZV9hbm5vdW5jZWQgPSBmYWxzZTtcblx0dmFyIHRvb2xiYXJfbmF2aWdhdGlvbl9jb250cm9sbGVyID0gbnVsbDtcblx0dmFyIHJlc291cmNlX25hdmlnYXRpb25fY29udHJvbGxlciA9IG51bGw7XG5cdHZhciByZXNvdXJjZV9zZXR0aW5nc19jb250cm9sbGVyID0gbnVsbDtcblx0dmFyIGF4aXNfc2Nyb2xsX2NhbnZhcyA9IG51bGw7XG5cdHZhciBpc19heGlzX3dpbmRvd19sb2FkaW5nX2xvY2tlZCA9IGZhbHNlO1xuXHR2YXIgaXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0dmFyIGxpZmVjeWNsZV9nZW5lcmF0aW9uID0gMDtcblx0dmFyIHByZWZlcmVuY2VzX3NhdmVfdGltZXIgPSAwO1xuXHR2YXIgcHJlZmVyZW5jZXNfc2F2ZV9yZXF1ZXN0ID0gbnVsbDtcblx0dmFyIHByZWZlcmVuY2VzX3NhdmVfcGVuZGluZyA9IGZhbHNlO1xuXHR2YXIgcHJlZmVyZW5jZXNfcmVzZXRfcGVuZGluZyA9IGZhbHNlO1xuXHR2YXIgcHJlZmVyZW5jZXNfcmVzZXRfYnV0dG9uID0gbnVsbDtcblx0dmFyIHByZWZlcmVuY2VzX3Jlc2V0X2JhcnJpZXJfY29tcGxldGUgPSB0cnVlO1xuXHR2YXIgYWNjZXB0ZWRfYm9va2luZ19nZW5lcmF0aW9uID0gMDtcblx0dmFyIGFjY2VwdGVkX2F2YWlsYWJpbGl0eV9nZW5lcmF0aW9uID0gMDtcblx0dmFyIGF1dGhvcml0YXRpdmVfcmVhZGJhY2tfZ2VuZXJhdGlvbiA9IDA7XG5cdHZhciBib29raW5nX2NyZWF0aW9uX2hvc3RfZW5hYmxlZCA9IEJvb2xlYW4oIHNldHRpbmdzLm5ld19ib29raW5nICYmIHNldHRpbmdzLm5ld19ib29raW5nLmxhdW5jaF9jb250ZXh0ICk7XG5cdHZhciBhY3RpdmVfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19pZCA9ICcnO1xuXHR2YXIgY29tcGxldGVkX2Jvb2tpbmdfY3JlYXRpb25fcmVhZGJhY2tfaWRzID0ge307XG5cdHZhciBjb21wbGV0ZWRfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19vcmRlciA9IFtdO1xuXHR2YXIgaXNfZm9yZWdyb3VuZF9yZXF1ZXN0X2xvYWRpbmcgPSBmYWxzZTtcblx0dmFyIGlzX2F2YWlsYWJpbGl0eV9sb2FkaW5nID0gZmFsc2U7XG5cdHZhciBpc19zZWxlY3Rpb25fYXBwbHlfbG9hZGluZyA9IGZhbHNlO1xuXHR2YXIgc2VsZWN0aW9uX2FwcGx5X2xvYWRpbmdfbWVzc2FnZSA9ICcnO1xuXHR2YXIgZXh0ZW5zaW9uX2luc3RhbmNlX2lkcyA9IFtdO1xuXHR2YXIgcHJlZmVyZW5jZV9hbmNob3JfZGF0ZSA9IHNldHRpbmdzLnByZWZlcmVuY2VzICYmIHNldHRpbmdzLnByZWZlcmVuY2VzLmFuY2hvcl9kYXRlXG5cdFx0PyBTdHJpbmcoIHNldHRpbmdzLnByZWZlcmVuY2VzLmFuY2hvcl9kYXRlIClcblx0XHQ6IFN0cmluZyggc2V0dGluZ3Mud2luZG93ICYmIHNldHRpbmdzLndpbmRvdy5zdGFydF9kYXRlID8gc2V0dGluZ3Mud2luZG93LnN0YXJ0X2RhdGUgOiAnJyApO1xuXHR2YXIgcHJlZmVyZW5jZV9hbmNob3JfcmF0aW8gPSBzZXR0aW5ncy5wcmVmZXJlbmNlcyAmJiBOdW1iZXIuaXNGaW5pdGUoIE51bWJlciggc2V0dGluZ3MucHJlZmVyZW5jZXMuYW5jaG9yX3JhdGlvICkgKVxuXHRcdD8gTnVtYmVyKCBzZXR0aW5ncy5wcmVmZXJlbmNlcy5hbmNob3JfcmF0aW8gKVxuXHRcdDogMDtcblx0dmFyIGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9pbnN0YW5jZV9pZCA9ICd3cGJjX3RpbWVsaW5lX2VtcHR5X3JhbmdlX3NlbGVjdGlvbic7XG5cdHZhciBib29raW5nX2ludGVyYWN0aW9uc19pbnN0YW5jZV9pZCA9ICd3cGJjX3RpbWVsaW5lX2Jvb2tpbmdfaW50ZXJhY3Rpb25zJztcblx0dmFyIHJlbmRlcmluZ19pbnN0YW5jZV9pZCA9ICd3cGJjX3RpbWVsaW5lX3JlbmRlcmluZyc7XG5cdHZhciB3aW5kb3dfY2FjaGVfaW5zdGFuY2VfaWQgPSAnd3BiY190aW1lbGluZV93aW5kb3dfY2FjaGUnO1xuXHR2YXIgYXZhaWxhYmlsaXR5X2NhY2hlX2luc3RhbmNlX2lkID0gJ3dwYmNfdGltZWxpbmVfYXZhaWxhYmlsaXR5X2NhY2hlJztcblx0dmFyIHRvb2xiYXJfbmF2aWdhdGlvbl9pbnN0YW5jZV9pZCA9ICd3cGJjX3RpbWVsaW5lX3Rvb2xiYXJfbmF2aWdhdGlvbic7XG5cdHZhciByZXNvdXJjZV9uYXZpZ2F0aW9uX2luc3RhbmNlX2lkID0gJ3dwYmNfdGltZWxpbmVfcmVzb3VyY2VfbmF2aWdhdGlvbic7XG5cdHZhciByZXNvdXJjZV9zZXR0aW5nc19pbnN0YW5jZV9pZCA9ICd3cGJjX3RpbWVsaW5lX3Jlc291cmNlX3NldHRpbmdzJztcblxuXHQvKipcblx0ICogUmV0dXJuIG9uZSBzZXJ2ZXItYWxsb3ctbGlzdGVkIFdvcmRQcmVzcyB0ZW1wbGF0ZSByZW5kZXJlci5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX2tleSBTdGFibGUga2V5IGluc2lkZSB0aGUgc2VsZWN0ZWQgdGVtcGxhdGUgcGFjay5cblx0ICogQHJldHVybiB7RnVuY3Rpb258bnVsbH0gV29yZFByZXNzIHRlbXBsYXRlIHJlbmRlcmVyIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfdGVtcGxhdGUoIHRlbXBsYXRlX2tleSApIHtcblx0XHR2YXIgdGVtcGxhdGVfaWQgPSBzZXR0aW5ncy50ZW1wbGF0ZXMgJiYgc2V0dGluZ3MudGVtcGxhdGVzWyB0ZW1wbGF0ZV9rZXkgXTtcblxuXHRcdGlmICggISB0ZW1wbGF0ZV9pZCB8fCAhIHdwIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3cC50ZW1wbGF0ZSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB3cC50ZW1wbGF0ZSggdGVtcGxhdGVfaWQgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgb25lIGFsbG93LWxpc3RlZCBXb3JkUHJlc3MgdGVtcGxhdGUgaW50byBhbiBleGlzdGluZyBob3N0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR8bnVsbH0gdGFyZ2V0IFRhcmdldCBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfa2V5IFRlbXBsYXRlLXBhY2sga2V5LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gdmlld19tb2RlbCBBdXRob3JpemVkIHRlbXBsYXRlIGRhdGEuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIHRlbXBsYXRlIHdhcyByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl90ZW1wbGF0ZSggdGFyZ2V0LCB0ZW1wbGF0ZV9rZXksIHZpZXdfbW9kZWwgKSB7XG5cdFx0dmFyIHRlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCB0ZW1wbGF0ZV9rZXkgKTtcblxuXHRcdGlmICggISB0YXJnZXQgfHwgISB0ZW1wbGF0ZSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0YXJnZXQuaW5uZXJIVE1MID0gdGVtcGxhdGUoIHZpZXdfbW9kZWwgKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFbWl0IG9uZSBuZXV0cmFsIGFjY2VwdGVkLWRhdGEgbGlmZWN5Y2xlIG5vdGlmaWNhdGlvbiBmcm9tIHRoZSBtb3VudC5cblx0ICpcblx0ICogRXZlbnQgZGV0YWlsIGNvbnRhaW5zIHNoYWxsb3cgY29udHJvbGxlciByZWNvcmRzIGFuZCByZWFkLW9ubHkgcmVmZXJlbmNlcyB0b1xuXHQgKiBhY2NlcHRlZCBEVE9zLiBDb25zdW1lcnMgcmVjZWl2ZSBubyBjYWNoZSBjb250cm9sbGVyIG9yIG11dGF0aW9uIGF1dGhvcml0eS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50X25hbWUgU3RhYmxlIGFjY2VwdGVkLWRhdGEgZXZlbnQgc3VmZml4LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZXZlbnRfZGV0YWlsIEV4ZWN1dGFibGUtZnJlZSBub3RpZmljYXRpb24gZGV0YWlsLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZW1pdF9hY2NlcHRlZF9kYXRhX2V2ZW50KCBldmVudF9uYW1lLCBldmVudF9kZXRhaWwgKSB7XG5cdFx0dmFyIGFjY2VwdGVkX2V2ZW50O1xuXG5cdFx0aWYgKCAhIGV4dGVuc2lvbl9pbnN0YW5jZV9pZHMubGVuZ3RoIHx8ICEgbW91bnQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vdW50LmRpc3BhdGNoRXZlbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdGFjY2VwdGVkX2V2ZW50ID0gbmV3IHdpbmRvdy5DdXN0b21FdmVudCggJ3dwYmM6dGltZWxpbmU6ZGF0YTonICsgZXZlbnRfbmFtZSwge1xuXHRcdFx0XHRkZXRhaWw6IGV2ZW50X2RldGFpbFxuXHRcdFx0fSApO1xuXHRcdH0gZWxzZSBpZiAoIGRvY3VtZW50LmNyZWF0ZUV2ZW50ICkge1xuXHRcdFx0YWNjZXB0ZWRfZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xuXHRcdFx0YWNjZXB0ZWRfZXZlbnQuaW5pdEN1c3RvbUV2ZW50KCAnd3BiYzp0aW1lbGluZTpkYXRhOicgKyBldmVudF9uYW1lLCBmYWxzZSwgZmFsc2UsIGV2ZW50X2RldGFpbCApO1xuXHRcdH1cblx0XHRpZiAoIGFjY2VwdGVkX2V2ZW50ICkge1xuXHRcdFx0bW91bnQuZGlzcGF0Y2hFdmVudCggYWNjZXB0ZWRfZXZlbnQgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQW5ub3VuY2Ugb25lIG11dGF0aW9uLXRyaWdnZXJlZCBjYW5vbmljYWwgcmVhZGJhY2sgbGlmZWN5Y2xlLlxuXHQgKlxuXHQgKiBUaGUgbm90aWZpY2F0aW9uIGV4cG9zZXMgb25seSBuZXV0cmFsIHNjYWxhciBzdGF0ZS4gSXQgZG9lcyBub3QgZ3JhbnRcblx0ICogcmVxdWVzdCwgbXV0YXRpb24sIG9yIGNhY2hlIGF1dGhvcml0eSB0byBwcmVzZW50YXRpb24gZXh0ZW5zaW9ucy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHJlYXNvbiBTdGFibGUgcmVhZGJhY2sgcmVhc29uLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IE1vbm90b25pYyByZWFkYmFjayBnZW5lcmF0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gYmVnaW5fYXV0aG9yaXRhdGl2ZV9yZWFkYmFjayggcmVhc29uICkge1xuXHRcdGF1dGhvcml0YXRpdmVfcmVhZGJhY2tfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdGVtaXRfYWNjZXB0ZWRfZGF0YV9ldmVudCggJ2F1dGhvcml0YXRpdmUtcmVhZGJhY2stc3RhdGUnLCB7XG5cdFx0XHRzY2hlbWFfdmVyc2lvbjogMSxcblx0XHRcdGdlbmVyYXRpb246IGF1dGhvcml0YXRpdmVfcmVhZGJhY2tfZ2VuZXJhdGlvbixcblx0XHRcdHN0YXRlOiAnbG9hZGluZycsXG5cdFx0XHRyZWFzb246IFN0cmluZyggcmVhc29uIHx8ICcnIClcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19nZW5lcmF0aW9uO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbXBsZXRlIG9uZSBjdXJyZW50IG11dGF0aW9uLXRyaWdnZXJlZCBjYW5vbmljYWwgcmVhZGJhY2sgbGlmZWN5Y2xlLlxuXHQgKlxuXHQgKiBTdXBlcnNlZGVkIGNvbXBsZXRpb25zIGFyZSBpZ25vcmVkIHNvIGEgbGF0ZSByZXF1ZXN0IGNhbm5vdCBjbGVhciB0aGUgYnVzeVxuXHQgKiBzdGF0ZSBiZWxvbmdpbmcgdG8gYSBuZXdlciBhdXRob3JpdGF0aXZlIHJlYWRiYWNrLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZ2VuZXJhdGlvbiBSZWFkYmFjayBnZW5lcmF0aW9uIHJldHVybmVkIGF0IHN0YXJ0LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3RhdGUgQWNjZXB0ZWQgb3IgZmFpbGVkIHRlcm1pbmFsIHN0YXRlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcmVhc29uIFN0YWJsZSByZWFkYmFjayByZWFzb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjb21wbGV0ZV9hdXRob3JpdGF0aXZlX3JlYWRiYWNrKCBnZW5lcmF0aW9uLCBzdGF0ZSwgcmVhc29uICkge1xuXHRcdGlmICggZ2VuZXJhdGlvbiAhPT0gYXV0aG9yaXRhdGl2ZV9yZWFkYmFja19nZW5lcmF0aW9uICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRlbWl0X2FjY2VwdGVkX2RhdGFfZXZlbnQoICdhdXRob3JpdGF0aXZlLXJlYWRiYWNrLXN0YXRlJywge1xuXHRcdFx0c2NoZW1hX3ZlcnNpb246IDEsXG5cdFx0XHRnZW5lcmF0aW9uOiBnZW5lcmF0aW9uLFxuXHRcdFx0c3RhdGU6ICdhY2NlcHRlZCcgPT09IHN0YXRlID8gJ2FjY2VwdGVkJyA6ICdmYWlsZWQnLFxuXHRcdFx0cmVhc29uOiBTdHJpbmcoIHJlYXNvbiB8fCAnJyApXG5cdFx0fSApO1xuXHRcdGlmIChcblx0XHRcdCdhY2NlcHRlZCcgIT09IHN0YXRlXG5cdFx0XHQmJiBbICdhdmFpbGFiaWxpdHlfbXV0YXRpb24nLCAnYm9va2luZ19pbnNwZWN0b3InLCAnYm9va2luZ19nZW9tZXRyeScsICdib29raW5nX2NyZWF0aW9uJyBdLmluZGV4T2YoXG5cdFx0XHRcdFN0cmluZyggcmVhc29uIHx8ICcnIClcblx0XHRcdCkgIT09IC0xXG5cdFx0KSB7XG5cdFx0XHRzZXRfYXZhaWxhYmlsaXR5X2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEJpbmQgYSBjYW5vbmljYWwgcmVhZGJhY2sgcHJvbWlzZSB0byBpdHMgbmV1dHJhbCBsaWZlY3ljbGUgbm90aWZpY2F0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSByZXF1ZXN0IGpRdWVyeS1jb21wYXRpYmxlIHJlYWRiYWNrIHByb21pc2UuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBnZW5lcmF0aW9uIFJlYWRiYWNrIGdlbmVyYXRpb24gcmV0dXJuZWQgYXQgc3RhcnQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSByZWFzb24gU3RhYmxlIHJlYWRiYWNrIHJlYXNvbi5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IE9yaWdpbmFsIHByb21pc2UgZm9yIHRoZSBtdXRhdGlvbiBvd25lci5cblx0ICovXG5cdGZ1bmN0aW9uIHRyYWNrX2F1dGhvcml0YXRpdmVfcmVhZGJhY2soIHJlcXVlc3QsIGdlbmVyYXRpb24sIHJlYXNvbiApIHtcblx0XHRpZiAoICEgcmVxdWVzdCB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgcmVxdWVzdC5kb25lIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiByZXF1ZXN0LmZhaWwgKSB7XG5cdFx0XHRjb21wbGV0ZV9hdXRob3JpdGF0aXZlX3JlYWRiYWNrKCBnZW5lcmF0aW9uLCAnZmFpbGVkJywgcmVhc29uICk7XG5cdFx0XHRyZXR1cm4gcmVxdWVzdDtcblx0XHR9XG5cdFx0cmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb21wbGV0ZV9hdXRob3JpdGF0aXZlX3JlYWRiYWNrKCBnZW5lcmF0aW9uLCAnYWNjZXB0ZWQnLCByZWFzb24gKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29tcGxldGVfYXV0aG9yaXRhdGl2ZV9yZWFkYmFjayggZ2VuZXJhdGlvbiwgJ2ZhaWxlZCcsIHJlYXNvbiApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiByZXF1ZXN0O1xuXHR9XG5cblx0LyoqXG5cdCAqIE5vdGlmeSByZWFkLW9ubHkgY29uc3VtZXJzIG9mIHRoZSBjb21wbGV0ZSBhY2NlcHRlZCBib3VuZGVkIGJvb2tpbmcgY2FjaGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gd2luZG93X2VudHJpZXMgTmF0aXZlIG9yZGVyZWQgY2FjaGUgc25hcHNob3QuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBub3RpZnlfYWNjZXB0ZWRfYm9va2luZ193aW5kb3dzKCB3aW5kb3dfZW50cmllcyApIHtcblx0XHRpZiAoICEgQXJyYXkuaXNBcnJheSggd2luZG93X2VudHJpZXMgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YWNjZXB0ZWRfYm9va2luZ19nZW5lcmF0aW9uICs9IDE7XG5cdFx0ZW1pdF9hY2NlcHRlZF9kYXRhX2V2ZW50KCAnYm9va2luZy13aW5kb3dzLWFjY2VwdGVkJywge1xuXHRcdFx0c2NoZW1hX3ZlcnNpb246IDEsXG5cdFx0XHRnZW5lcmF0aW9uOiBhY2NlcHRlZF9ib29raW5nX2dlbmVyYXRpb24sXG5cdFx0XHRjdXJyZW50X3dpbmRvd19rZXk6IFN0cmluZyggc2V0dGluZ3Mud2luZG93X2NvbnRleHQgJiYgc2V0dGluZ3Mud2luZG93X2NvbnRleHQud2luZG93X2tleSB8fCAnJyApLFxuXHRcdFx0cmVzb3VyY2VfZmluZ2VycHJpbnQ6IFN0cmluZyggc2V0dGluZ3Mud2luZG93X2NvbnRleHQgJiYgc2V0dGluZ3Mud2luZG93X2NvbnRleHQucmVzb3VyY2VfZmluZ2VycHJpbnQgfHwgJycgKSxcblx0XHRcdHRpbWV6b25lOiBTdHJpbmcoIHNldHRpbmdzLndpbmRvdyAmJiBzZXR0aW5ncy53aW5kb3cudGltZXpvbmUgfHwgJycgKSxcblx0XHRcdHdpbmRvd3M6IHdpbmRvd19lbnRyaWVzXG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIG9uZSBjb21wbGV0ZSB0b29sYmFyIHByZWZlcmVuY2Ugc25hcHNob3QgZnJvbSBhdXRob3JpemVkIHN0YXRlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gUHJlZmVyZW5jZSBwYXlsb2FkLCBvciBudWxsIGJlZm9yZSBhIHdpbmRvdyBleGlzdHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfdGltZWxpbmVfcHJlZmVyZW5jZXNfc25hcHNob3QoKSB7XG5cdFx0dmFyIHRpbWVsaW5lX3dpbmRvdyA9IHNldHRpbmdzLndpbmRvdyB8fCB7fTtcblx0XHR2YXIgY3VycmVudF92aWV3ID0gc2V0dGluZ3MuY3VycmVudF9heGlzICYmIHNldHRpbmdzLmN1cnJlbnRfYXhpcy52aWV3XG5cdFx0XHQ/IHNldHRpbmdzLmN1cnJlbnRfYXhpcy52aWV3XG5cdFx0XHQ6ICggc2V0dGluZ3MuYXhpcyA/IHNldHRpbmdzLmF4aXMudmlldyA6ICcnICk7XG5cdFx0dmFyIHZpc3VhbF96b29tX3BlcmNlbnQgPSB0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIuZ2V0X3Zpc3VhbF96b29tX3BlcmNlbnRcblx0XHRcdD8gdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIuZ2V0X3Zpc3VhbF96b29tX3BlcmNlbnQoKVxuXHRcdFx0OiBOdW1iZXIoIHNldHRpbmdzLnByZWZlcmVuY2VzICYmIHNldHRpbmdzLnByZWZlcmVuY2VzLnZpc3VhbF96b29tX3BlcmNlbnQgKSB8fCAxMDA7XG5cblx0XHRpZiAoICEgcHJlZmVyZW5jZV9hbmNob3JfZGF0ZSB8fCAhIGN1cnJlbnRfdmlldyB8fCAoICEgTnVtYmVyKCB0aW1lbGluZV93aW5kb3cud2luZG93X2RheXMgKSAmJiAhIE51bWJlciggdGltZWxpbmVfd2luZG93LndpbmRvd19tb250aHMgKSApICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGFuY2hvcl9kYXRlOiBwcmVmZXJlbmNlX2FuY2hvcl9kYXRlLFxuXHRcdFx0YW5jaG9yX3JhdGlvOiBNYXRoLm1heCggMCwgTWF0aC5taW4oIDEsIHByZWZlcmVuY2VfYW5jaG9yX3JhdGlvICkgKSxcblx0XHRcdHdpbmRvd19kYXlzOiBOdW1iZXIoIHRpbWVsaW5lX3dpbmRvdy53aW5kb3dfbW9udGhzICkgPyAwIDogTnVtYmVyKCB0aW1lbGluZV93aW5kb3cud2luZG93X2RheXMgKSxcblx0XHRcdHdpbmRvd19tb250aHM6IE51bWJlciggdGltZWxpbmVfd2luZG93LndpbmRvd19tb250aHMgKSB8fCAwLFxuXHRcdFx0dmlldzogU3RyaW5nKCBjdXJyZW50X3ZpZXcgKSxcblx0XHRcdHZpc3VhbF96b29tX3BlcmNlbnQ6IE51bWJlciggdmlzdWFsX3pvb21fcGVyY2VudCApXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZW5kIHRoZSBuZXdlc3QgY29tcGxldGUgcHJlZmVyZW5jZSBzbmFwc2hvdCB3aXRob3V0IG92ZXJsYXBwaW5nIHdyaXRlcy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGZsdXNoX3RpbWVsaW5lX3ByZWZlcmVuY2VzX3NhdmUoKSB7XG5cdFx0dmFyIHRyYW5zcG9ydCA9IHNldHRpbmdzLnRyYW5zcG9ydCAmJiBzZXR0aW5ncy50cmFuc3BvcnQucHJlZmVyZW5jZXMgPyBzZXR0aW5ncy50cmFuc3BvcnQucHJlZmVyZW5jZXMgOiB7fTtcblx0XHR2YXIgc25hcHNob3Q7XG5cblx0XHRwcmVmZXJlbmNlc19zYXZlX3RpbWVyID0gMDtcblx0XHRpZiAoIHByZWZlcmVuY2VzX3NhdmVfcmVxdWVzdCApIHtcblx0XHRcdHByZWZlcmVuY2VzX3NhdmVfcGVuZGluZyA9IHRydWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggISBwcmVmZXJlbmNlc19zYXZlX3BlbmRpbmcgfHwgISB3aW5kb3cualF1ZXJ5IHx8ICEgc2V0dGluZ3MudHJhbnNwb3J0IHx8ICEgc2V0dGluZ3MudHJhbnNwb3J0LnVybCB8fCAhIHRyYW5zcG9ydC5hY3Rpb24gfHwgISB0cmFuc3BvcnQubm9uY2UgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHNuYXBzaG90ID0gZ2V0X3RpbWVsaW5lX3ByZWZlcmVuY2VzX3NuYXBzaG90KCk7XG5cdFx0cHJlZmVyZW5jZXNfc2F2ZV9wZW5kaW5nID0gZmFsc2U7XG5cdFx0aWYgKCAhIHNuYXBzaG90ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHByZWZlcmVuY2VzX3NhdmVfcmVxdWVzdCA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0dXJsOiBzZXR0aW5ncy50cmFuc3BvcnQudXJsLFxuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0ZGF0YTogT2JqZWN0LmFzc2lnbigge30sIHNuYXBzaG90LCB7XG5cdFx0XHRcdGFjdGlvbjogdHJhbnNwb3J0LmFjdGlvbixcblx0XHRcdFx0bm9uY2U6IHRyYW5zcG9ydC5ub25jZVxuXHRcdFx0fSApXG5cdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0cHJlZmVyZW5jZXNfc2F2ZV9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdGlmICggcHJlZmVyZW5jZXNfcmVzZXRfcGVuZGluZyAmJiBpc19pbml0aWFsaXplZCApIHtcblx0XHRcdFx0Zmx1c2hfdGltZWxpbmVfcHJlZmVyZW5jZXNfcmVzZXQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBwcmVmZXJlbmNlc19zYXZlX3BlbmRpbmcgJiYgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdGZsdXNoX3RpbWVsaW5lX3ByZWZlcmVuY2VzX3NhdmUoKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUXVldWUgYSBzZXJpYWxpemVkIHBlci11c2VyIHByZWZlcmVuY2Ugc2F2ZSBhZnRlciBleHBsaWNpdCBVSSBjaGFuZ2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcHJlZmVyZW5jZV9vdmVycmlkZXMgT3B0aW9uYWwgYW5jaG9yIGZpZWxkcyBmb3IgY2FjaGVkIG5hdmlnYXRpb24uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBxdWV1ZV90aW1lbGluZV9wcmVmZXJlbmNlc19zYXZlKCBwcmVmZXJlbmNlX292ZXJyaWRlcyApIHtcblx0XHR2YXIgb3ZlcnJpZGVzID0gcHJlZmVyZW5jZV9vdmVycmlkZXMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBwcmVmZXJlbmNlX292ZXJyaWRlcyA/IHByZWZlcmVuY2Vfb3ZlcnJpZGVzIDoge307XG5cblx0XHRpZiAoIG92ZXJyaWRlcy5hbmNob3JfZGF0ZSApIHtcblx0XHRcdHByZWZlcmVuY2VfYW5jaG9yX2RhdGUgPSBTdHJpbmcoIG92ZXJyaWRlcy5hbmNob3JfZGF0ZSApO1xuXHRcdH1cblx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggTnVtYmVyKCBvdmVycmlkZXMuYW5jaG9yX3JhdGlvICkgKSApIHtcblx0XHRcdHByZWZlcmVuY2VfYW5jaG9yX3JhdGlvID0gTnVtYmVyKCBvdmVycmlkZXMuYW5jaG9yX3JhdGlvICk7XG5cdFx0fVxuXHRcdHByZWZlcmVuY2VzX3NhdmVfcGVuZGluZyA9IHRydWU7XG5cdFx0aWYgKCBwcmVmZXJlbmNlc19zYXZlX3JlcXVlc3QgfHwgcHJlZmVyZW5jZXNfc2F2ZV90aW1lciApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cHJlZmVyZW5jZXNfc2F2ZV90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmbHVzaF90aW1lbGluZV9wcmVmZXJlbmNlc19zYXZlLCAyNTAgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBVcGRhdGUgdGhlIGluLW1lbW9yeSBvcGVuaW5nIGFuY2hvciB3aXRob3V0IHNjaGVkdWxpbmcgcGVyc2lzdGVuY2UuXG5cdCAqXG5cdCAqIFJlc2V0IHVzZXMgdGhpcyBiZWZvcmUgaXRzIGRlZmF1bHQgcmVmcmVzaCBzbyBhIGxhdGVyIERlbnNpdHkgY2hhbmdlIHNhdmVzXG5cdCAqIHRoZSBuZXcgY3VycmVudC1kYXRlIHBvc2l0aW9uIGluc3RlYWQgb2YgcmV2aXZpbmcgdGhlIGNsZWFyZWQgcG9zaXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBhbmNob3JfZGF0ZSBTaXRlLWxvY2FsIGNhbGVuZGFyIGRhdGUuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBhbmNob3JfcmF0aW8gVmlzaWJsZS1wb3NpdGlvbiByYXRpby5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNldF90aW1lbGluZV9wcmVmZXJlbmNlX2FuY2hvciggYW5jaG9yX2RhdGUsIGFuY2hvcl9yYXRpbyApIHtcblx0XHRwcmVmZXJlbmNlX2FuY2hvcl9kYXRlID0gU3RyaW5nKCBhbmNob3JfZGF0ZSB8fCAnJyApO1xuXHRcdHByZWZlcmVuY2VfYW5jaG9yX3JhdGlvID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCAxLCBOdW1iZXIoIGFuY2hvcl9yYXRpbyApIHx8IDAgKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBlcmZvcm0gb25lIHNlcmlhbGl6ZWQsIGF1dGhvcml6ZWQgdG9vbGJhciBwcmVmZXJlbmNlIHJlc2V0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZmx1c2hfdGltZWxpbmVfcHJlZmVyZW5jZXNfcmVzZXQoKSB7XG5cdFx0dmFyIHRyYW5zcG9ydCA9IHNldHRpbmdzLnRyYW5zcG9ydCAmJiBzZXR0aW5ncy50cmFuc3BvcnQucHJlZmVyZW5jZXMgPyBzZXR0aW5ncy50cmFuc3BvcnQucHJlZmVyZW5jZXMgOiB7fTtcblx0XHR2YXIgcmVzZXRfYnV0dG9uID0gcHJlZmVyZW5jZXNfcmVzZXRfYnV0dG9uO1xuXHRcdHZhciBkZWZhdWx0X3JlcXVlc3RfZGlzcGF0Y2hlZCA9IGZhbHNlO1xuXG5cdFx0aWYgKCBwcmVmZXJlbmNlc19zYXZlX3JlcXVlc3QgfHwgISBwcmVmZXJlbmNlc19yZXNldF9wZW5kaW5nIHx8ICEgcHJlZmVyZW5jZXNfcmVzZXRfYmFycmllcl9jb21wbGV0ZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAhIHdpbmRvdy5qUXVlcnkgfHwgISBzZXR0aW5ncy50cmFuc3BvcnQgfHwgISBzZXR0aW5ncy50cmFuc3BvcnQudXJsIHx8ICEgdHJhbnNwb3J0LnJlc2V0X2FjdGlvbiB8fCAhIHRyYW5zcG9ydC5ub25jZSApIHtcblx0XHRcdHByZWZlcmVuY2VzX3Jlc2V0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHRcdGlmICggcmVzZXRfYnV0dG9uICkge1xuXHRcdFx0XHRyZXNldF9idXR0b24ucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKTtcblx0XHRcdH1cblx0XHRcdHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSggc2V0dGluZ3MuaTE4bi50aW1lbGluZV9yZXNldF9mYWlsZWQsICdlcnJvcicsIDMwMDAwICk7XG5cdFx0XHRzZXRfZm9yZWdyb3VuZF9yZXF1ZXN0X2xvYWRpbmcoIGZhbHNlLCAnJywgMCApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHByZWZlcmVuY2VzX3Jlc2V0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHRwcmVmZXJlbmNlc19zYXZlX3JlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcblx0XHRcdHVybDogc2V0dGluZ3MudHJhbnNwb3J0LnVybCxcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdGRhdGE6IHtcblx0XHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQucmVzZXRfYWN0aW9uLFxuXHRcdFx0XHRub25jZTogdHJhbnNwb3J0Lm5vbmNlXG5cdFx0XHR9XG5cdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHJlc3BvbnNlXG5cdFx0XHRcdCYmIHJlc3BvbnNlLnN1Y2Nlc3Ncblx0XHRcdFx0JiYgcmVzcG9uc2UuZGF0YVxuXHRcdFx0XHQmJiByZXNwb25zZS5kYXRhLnJlc291cmNlX3ZpZXdfY29udGV4dFxuXHRcdFx0XHQmJiB0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlclxuXHRcdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIucmVzZXRfdG9fZGVmYXVsdHNcblx0XHRcdCkge1xuXHRcdFx0XHRzZXR0aW5ncy5yZXNvdXJjZV92aWV3ID0gcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV92aWV3IHx8IHt9O1xuXHRcdFx0XHRzZXR0aW5ncy5yZXNvdXJjZV9wYWdpbmF0aW9uID0gcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV9wYWdpbmF0aW9uIHx8IHt9O1xuXHRcdFx0XHRzZXR0aW5ncy53aW5kb3dfY29udGV4dCA9IE9iamVjdC5hc3NpZ24oIHt9LCBzZXR0aW5ncy53aW5kb3dfY29udGV4dCB8fCB7fSwge1xuXHRcdFx0XHRcdHJlc291cmNlX3ZpZXdfY29udGV4dDogU3RyaW5nKCByZXNwb25zZS5kYXRhLnJlc291cmNlX3ZpZXdfY29udGV4dCApXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0c2V0dGluZ3MucHJlZmVyZW5jZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgc2V0dGluZ3MucHJlZmVyZW5jZXMgfHwge30sIHtcblx0XHRcdFx0XHRleHBhbmRlZF9yZXNvdXJjZV9pZHM6IFtdLFxuXHRcdFx0XHRcdGV4cGFuZGVkX3BhcmVudF9pZHM6IFtdXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCByZXNvdXJjZV9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlc291cmNlX25hdmlnYXRpb25fY29udHJvbGxlci5yZWZyZXNoICkge1xuXHRcdFx0XHRcdHJlc291cmNlX25hdmlnYXRpb25fY29udHJvbGxlci5yZWZyZXNoKCBzZXR0aW5ncy5yZXNvdXJjZV92aWV3LCBzZXR0aW5ncy5yZXNvdXJjZV9wYWdpbmF0aW9uICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZW1pdF9hY2NlcHRlZF9kYXRhX2V2ZW50KCAncHJlZmVyZW5jZXMtcmVzZXQnLCB7XG5cdFx0XHRcdFx0c2NoZW1hX3ZlcnNpb246IDFcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRkZWZhdWx0X3JlcXVlc3RfZGlzcGF0Y2hlZCA9IHRvb2xiYXJfbmF2aWdhdGlvbl9jb250cm9sbGVyLnJlc2V0X3RvX2RlZmF1bHRzKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgZGVmYXVsdF9yZXF1ZXN0X2Rpc3BhdGNoZWQgKSB7XG5cdFx0XHRcdHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSggc2V0dGluZ3MuaTE4bi50aW1lbGluZV9yZXNldF9mYWlsZWQsICdlcnJvcicsIDMwMDAwICk7XG5cdFx0XHR9XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggcmVxdWVzdCApIHtcblx0XHRcdHZhciBlcnJvciA9IHJlcXVlc3QucmVzcG9uc2VKU09OICYmIHJlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgPyByZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhIDoge307XG5cblx0XHRcdHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSggZXJyb3IubWVzc2FnZSB8fCBzZXR0aW5ncy5pMThuLnRpbWVsaW5lX3Jlc2V0X2ZhaWxlZCwgJ2Vycm9yJywgMzAwMDAgKTtcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRwcmVmZXJlbmNlc19zYXZlX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0cHJlZmVyZW5jZXNfcmVzZXRfYnV0dG9uID0gbnVsbDtcblx0XHRcdGlmICggcmVzZXRfYnV0dG9uICkge1xuXHRcdFx0XHRyZXNldF9idXR0b24ucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKTtcblx0XHRcdH1cblx0XHRcdGlmICggISBkZWZhdWx0X3JlcXVlc3RfZGlzcGF0Y2hlZCApIHtcblx0XHRcdFx0c2V0X2ZvcmVncm91bmRfcmVxdWVzdF9sb2FkaW5nKCBmYWxzZSwgJycsIDAgKTtcblx0XHRcdH1cblx0XHRcdGlmICggcHJlZmVyZW5jZXNfc2F2ZV9wZW5kaW5nICYmIGlzX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRmbHVzaF90aW1lbGluZV9wcmVmZXJlbmNlc19zYXZlKCk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFF1ZXVlIGEgcmVzZXQgYWZ0ZXIgYW55IGFscmVhZHktc3RhcnRlZCBwcmVmZXJlbmNlIHNhdmUgZmluaXNoZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR8bnVsbH0gcmVzZXRfYnV0dG9uIEluaXRpYXRpbmcgdG9vbGJhciBjb250cm9sLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcXVldWVfdGltZWxpbmVfcHJlZmVyZW5jZXNfcmVzZXQoIHJlc2V0X2J1dHRvbiApIHtcblx0XHR2YXIgcmVzZXRfd2FpdGVycyA9IFtdO1xuXHRcdHZhciByZXNldF9yZXF1ZXN0ZWRfZXZlbnQ7XG5cdFx0dmFyIHdhaXRfdW50aWwgPSBmdW5jdGlvbiAoIHByb21pc2UgKSB7XG5cdFx0XHRpZiAoIHByb21pc2UgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHByb21pc2UudGhlbiApIHtcblx0XHRcdFx0cmVzZXRfd2FpdGVycy5wdXNoKCBwcm9taXNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGlmICggcHJlZmVyZW5jZXNfcmVzZXRfcGVuZGluZyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCBwcmVmZXJlbmNlc19zYXZlX3RpbWVyICkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCggcHJlZmVyZW5jZXNfc2F2ZV90aW1lciApO1xuXHRcdFx0cHJlZmVyZW5jZXNfc2F2ZV90aW1lciA9IDA7XG5cdFx0fVxuXHRcdHByZWZlcmVuY2VzX3NhdmVfcGVuZGluZyA9IGZhbHNlO1xuXHRcdHByZWZlcmVuY2VzX3Jlc2V0X3BlbmRpbmcgPSB0cnVlO1xuXHRcdHByZWZlcmVuY2VzX3Jlc2V0X2JhcnJpZXJfY29tcGxldGUgPSBmYWxzZTtcblx0XHRwcmVmZXJlbmNlc19yZXNldF9idXR0b24gPSByZXNldF9idXR0b24gfHwgbnVsbDtcblx0XHRpZiAoIHByZWZlcmVuY2VzX3Jlc2V0X2J1dHRvbiApIHtcblx0XHRcdHByZWZlcmVuY2VzX3Jlc2V0X2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ3RydWUnICk7XG5cdFx0fVxuXHRcdHNldF9mb3JlZ3JvdW5kX3JlcXVlc3RfbG9hZGluZyggdHJ1ZSwgc2V0dGluZ3MuaTE4bi5yZXNldHRpbmdfdGltZWxpbmUsIDAgKTtcblx0XHRpZiAoIG1vdW50ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBtb3VudC5kaXNwYXRjaEV2ZW50ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQ3VzdG9tRXZlbnQgKSB7XG5cdFx0XHRyZXNldF9yZXF1ZXN0ZWRfZXZlbnQgPSBuZXcgd2luZG93LkN1c3RvbUV2ZW50KCAnd3BiYzp0aW1lbGluZTpwcmVmZXJlbmNlczpyZXNldC1yZXF1ZXN0ZWQnLCB7XG5cdFx0XHRcdGRldGFpbDoge1xuXHRcdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiAxLFxuXHRcdFx0XHRcdHdhaXRfdW50aWw6IHdhaXRfdW50aWxcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0bW91bnQuZGlzcGF0Y2hFdmVudCggcmVzZXRfcmVxdWVzdGVkX2V2ZW50ICk7XG5cdFx0fVxuXHRcdHdpbmRvdy5Qcm9taXNlLmFsbCggcmVzZXRfd2FpdGVycy5tYXAoIGZ1bmN0aW9uICggd2FpdGVyICkge1xuXHRcdFx0cmV0dXJuIHdpbmRvdy5Qcm9taXNlLnJlc29sdmUoIHdhaXRlciApLmNhdGNoKCBmdW5jdGlvbiAoKSB7IHJldHVybiBudWxsOyB9ICk7XG5cdFx0fSApICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0cHJlZmVyZW5jZXNfcmVzZXRfYmFycmllcl9jb21wbGV0ZSA9IHRydWU7XG5cdFx0XHRpZiAoICEgcHJlZmVyZW5jZXNfc2F2ZV9yZXF1ZXN0ICYmIHByZWZlcmVuY2VzX3Jlc2V0X3BlbmRpbmcgJiYgaXNfaW5pdGlhbGl6ZWQgKSB7XG5cdFx0XHRcdGZsdXNoX3RpbWVsaW5lX3ByZWZlcmVuY2VzX3Jlc2V0KCk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgYm91bmRlZC13aW5kb3cgY2FjaGUgYW5kIGFuY2hvciBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBUaGUgbW9kdWxlIG93bnMgYXV0aG9yaXplZCByZXNwb25zZSBjb21wb3NpdGlvbiBhbmQgcmVxdWVzdCBnZW5lcmF0aW9ucy5cblx0ICogVGhpcyBwYWdlIGNvbnRyb2xsZXIgcmV0YWlucyBvbmx5IERPTSByZW5kZXJpbmcgYW5kIGRvbWFpbiBhZGFwdGVyIGhhbmRvZmYuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX3dpbmRvd19jYWNoZSgpIHtcblx0XHR2YXIgbW9kdWxlX3J1bnRpbWUgPSB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzO1xuXG5cdFx0aWYgKCAhIG1vZHVsZV9ydW50aW1lIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5jcmVhdGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHdpbmRvd19jYWNoZV9jb250cm9sbGVyID0gbW9kdWxlX3J1bnRpbWUuY3JlYXRlKCAnd2luZG93X2NhY2hlJywgd2luZG93X2NhY2hlX2luc3RhbmNlX2lkLCB7XG5cdFx0XHRtb3VudDogbW91bnQsXG5cdFx0XHRzZXR0aW5nczogc2V0dGluZ3MsXG5cdFx0XHRzeW5jaHJvbml6ZV9heGlzX3Njcm9sbDogc3luY2hyb25pemVfYXhpc19zY3JvbGxcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogRGVzdHJveSB0aGUgYm91bmRlZC13aW5kb3cgY29udHJvbGxlciBjcmVhdGVkIGZvciB0aGlzIHBhZ2UgaW5zdGFuY2UuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBkZXN0cm95X3dpbmRvd19jYWNoZSgpIHtcblx0XHR2YXIgbW9kdWxlX3J1bnRpbWUgPSB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzO1xuXG5cdFx0aWYgKCBtb2R1bGVfcnVudGltZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuZGVzdHJveSApIHtcblx0XHRcdG1vZHVsZV9ydW50aW1lLmRlc3Ryb3koIHdpbmRvd19jYWNoZV9pbnN0YW5jZV9pZCApO1xuXHRcdH0gZWxzZSBpZiAoIHdpbmRvd19jYWNoZV9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5kZXN0cm95ICkge1xuXHRcdFx0d2luZG93X2NhY2hlX2NvbnRyb2xsZXIuZGVzdHJveSgpO1xuXHRcdH1cblx0XHR3aW5kb3dfY2FjaGVfY29udHJvbGxlciA9IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSBleGVjdXRhYmxlLWZyZWUgc2VydmVyLXJlZ2lzdGVyZWQgYnJvd3NlciBleHRlbnNpb25zLlxuXHQgKlxuXHQgKiBUaGUgc2hhcmVkIGNvbnRyb2xsZXIgdW5kZXJzdGFuZHMgb25seSBtb2R1bGUgYW5kIGluc3RhbmNlIGlkZW50aXRpZXMuIEVhY2hcblx0ICogZXh0ZW5zaW9uIG93bnMgaXRzIGRhdGEgc3Vic2NyaXB0aW9ucywgdGVtcGxhdGVzLCBjYWNoZXMsIGFuZCBwcmVzZW50YXRpb24uXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2V4dGVuc2lvbnMoKSB7XG5cdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblx0XHR2YXIgc3RhYmxlX2lkZW50aWZpZXIgPSAvXlthLXpdW2EtejAtOV8tXXswLDYzfSQvO1xuXG5cdFx0aWYgKCAhIG1vZHVsZV9ydW50aW1lIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5jcmVhdGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGV4dGVuc2lvbl9pbnN0YW5jZV9pZHMgPSBbXTtcblx0XHQoIEFycmF5LmlzQXJyYXkoIHNldHRpbmdzLmV4dGVuc2lvbnMgKSA/IHNldHRpbmdzLmV4dGVuc2lvbnMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggZXh0ZW5zaW9uICkge1xuXHRcdFx0dmFyIG1vZHVsZV9pZCA9IGV4dGVuc2lvbiAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIGV4dGVuc2lvbi5tb2R1bGVfaWQgPyBleHRlbnNpb24ubW9kdWxlX2lkIDogJyc7XG5cdFx0XHR2YXIgaW5zdGFuY2VfaWQgPSBleHRlbnNpb24gJiYgJ3N0cmluZycgPT09IHR5cGVvZiBleHRlbnNpb24uaW5zdGFuY2VfaWQgPyBleHRlbnNpb24uaW5zdGFuY2VfaWQgOiAnJztcblx0XHRcdHZhciBjYXBhYmlsaXRpZXMgPSBleHRlbnNpb24gJiYgQXJyYXkuaXNBcnJheSggZXh0ZW5zaW9uLmNhcGFiaWxpdGllcyApID8gZXh0ZW5zaW9uLmNhcGFiaWxpdGllcyA6IFtdO1xuXHRcdFx0dmFyIGV4dGVuc2lvbl9jb250ZXh0O1xuXHRcdFx0dmFyIGV4dGVuc2lvbl9pbnN0YW5jZTtcblxuXHRcdFx0aWYgKCAhIHN0YWJsZV9pZGVudGlmaWVyLnRlc3QoIG1vZHVsZV9pZCApIHx8ICEgc3RhYmxlX2lkZW50aWZpZXIudGVzdCggaW5zdGFuY2VfaWQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuaGFzX2ZhY3RvcnkgJiYgISBtb2R1bGVfcnVudGltZS5oYXNfZmFjdG9yeSggbW9kdWxlX2lkICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGV4dGVuc2lvbl9jb250ZXh0ID0ge1xuXHRcdFx0XHRtb3VudDogbW91bnQsXG5cdFx0XHRcdHByZXNlbnRhdGlvbl9hcGk6IHtcblx0XHRcdFx0XHRvcGVuX2ZpcnN0OiBmdW5jdGlvbiAoIHByZXNlbnRhdGlvbl9pZCApIHtcblx0XHRcdFx0XHRcdHJldHVybiByZW5kZXJpbmdfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcmVuZGVyaW5nX2NvbnRyb2xsZXIub3Blbl9maXJzdF9yb3dfcHJlc2VudGF0aW9uXG5cdFx0XHRcdFx0XHRcdD8gcmVuZGVyaW5nX2NvbnRyb2xsZXIub3Blbl9maXJzdF9yb3dfcHJlc2VudGF0aW9uKCBwcmVzZW50YXRpb25faWQgKVxuXHRcdFx0XHRcdFx0XHQ6IDA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb25maWd1cmF0aW9uOiBleHRlbnNpb24uY29uZmlndXJhdGlvbiAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGV4dGVuc2lvbi5jb25maWd1cmF0aW9uXG5cdFx0XHRcdFx0PyBleHRlbnNpb24uY29uZmlndXJhdGlvblxuXHRcdFx0XHRcdDoge31cblx0XHRcdH07XG5cdFx0XHRpZiAoIGNhcGFiaWxpdGllcy5pbmRleE9mKCAnc2VsZWN0aW9uX2FjdGlvbnMnICkgIT09IC0xICkge1xuXHRcdFx0XHRleHRlbnNpb25fY29udGV4dC5zZWxlY3Rpb25fYXBpID0ge1xuXHRcdFx0XHRcdGdldF9yZXF1ZXN0X2NvbnRleHQ6IGdldF9leHRlbnNpb25fc2VsZWN0aW9uX3JlcXVlc3RfY29udGV4dCxcblx0XHRcdFx0XHRyZWZyZXNoX2FmdGVyX2FwcGx5OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVmcmVzaF9hZnRlcl9hdmFpbGFiaWxpdHlfbXV0YXRpb24oIGZhbHNlICk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhbm5vdW5jZTogYW5ub3VuY2UsXG5cdFx0XHRcdFx0aXNfaG9zdF9hY3RpdmU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBpc19pbml0aWFsaXplZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRleHRlbnNpb25faW5zdGFuY2UgPSBtb2R1bGVfcnVudGltZS5jcmVhdGUoIG1vZHVsZV9pZCwgaW5zdGFuY2VfaWQsIGV4dGVuc2lvbl9jb250ZXh0ICk7XG5cdFx0XHRpZiAoIGV4dGVuc2lvbl9pbnN0YW5jZSApIHtcblx0XHRcdFx0ZXh0ZW5zaW9uX2luc3RhbmNlX2lkcy5wdXNoKCBpbnN0YW5jZV9pZCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBOb3RpZnkgZXh0ZW5zaW9ucyBhZnRlciB0aGUgaW5pdGlhbCBhY2NlcHRlZCBjYW52YXMgaGFzIHJlYWNoZWQgYSBwYWludCBib3VuZGFyeS5cblx0ICpcblx0ICogVHdvIGFuaW1hdGlvbiBmcmFtZXMga2VlcCB0aGUgaW5pdGlhbCBuYXRpdmUgVGltZWxpbmUgcmVuZGVyIGRpc3RpbmN0IGZyb21cblx0ICogYW4gb3B0aW9uYWwgZG9tYWluLW93bmVkIHByZXNlbnRhdGlvbiByZXZlYWwuIFRoZSBldmVudCBpcyBvbmUtc2hvdCBmb3IgdGhlXG5cdCAqIHBhZ2UtY29udHJvbGxlciBsaWZlY3ljbGUgYW5kIGdyYW50cyBubyByZXF1ZXN0LCBjYWNoZSwgb3IgbXV0YXRpb24gYWNjZXNzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfaW5pdGlhbF9jYW52YXNfcmVhZHkoKSB7XG5cdFx0dmFyIHJlYWR5X2dlbmVyYXRpb24gPSBsaWZlY3ljbGVfZ2VuZXJhdGlvbjtcblxuXHRcdGlmICggISBleHRlbnNpb25faW5zdGFuY2VfaWRzLmxlbmd0aCB8fCBpbml0aWFsX2NhbnZhc19yZWFkeV9mcmFtZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aW5pdGlhbF9jYW52YXNfcmVhZHlfZnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpbml0aWFsX2NhbnZhc19yZWFkeV9mcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aW5pdGlhbF9jYW52YXNfcmVhZHlfZnJhbWUgPSAwO1xuXHRcdFx0XHRpZiAoICEgaXNfaW5pdGlhbGl6ZWQgfHwgcmVhZHlfZ2VuZXJhdGlvbiAhPT0gbGlmZWN5Y2xlX2dlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVtaXRfYWNjZXB0ZWRfZGF0YV9ldmVudCggJ2luaXRpYWwtY2FudmFzLXJlYWR5Jywge1xuXHRcdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiAxLFxuXHRcdFx0XHRcdGdlbmVyYXRpb246IHJlYWR5X2dlbmVyYXRpb25cblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXN0cm95IGV2ZXJ5IGJyb3dzZXIgZXh0ZW5zaW9uIGNyZWF0ZWQgZm9yIHRoaXMgVGltZWxpbmUgaW5zdGFuY2UuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBkZXN0cm95X2V4dGVuc2lvbnMoKSB7XG5cdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblxuXHRcdGlmICggbW9kdWxlX3J1bnRpbWUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG1vZHVsZV9ydW50aW1lLmRlc3Ryb3kgKSB7XG5cdFx0XHRleHRlbnNpb25faW5zdGFuY2VfaWRzLmZvckVhY2goIGZ1bmN0aW9uICggaW5zdGFuY2VfaWQgKSB7XG5cdFx0XHRcdG1vZHVsZV9ydW50aW1lLmRlc3Ryb3koIGluc3RhbmNlX2lkICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdGV4dGVuc2lvbl9pbnN0YW5jZV9pZHMgPSBbXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgdGhlIGluZGVwZW5kZW50IGxhenkgQXZhaWxhYmlsaXR5IHRyYW5zcG9ydCBhbmQgY2FjaGUgY29udHJvbGxlci5cblx0ICpcblx0ICogVGhlIG1vZHVsZSBpcyBvcHRpb25hbCB1bnRpbCBpdHMgY29tcGlsZXItb3duZWQgcnVudGltZSBhc3NldCBleGlzdHMuIEl0c1xuXHQgKiBhYnNlbmNlIG9yIGFueSBsYXRlciByZWFkIGZhaWx1cmUgbXVzdCBub3QgYWZmZWN0IGJvb2tpbmctd2luZG93IHJlbmRlcmluZy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfYXZhaWxhYmlsaXR5X2NhY2hlKCkge1xuXHRcdHZhciBtb2R1bGVfcnVudGltZSA9IHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXM7XG5cblx0XHRpZiAoXG5cdFx0XHQhIG1vZHVsZV9ydW50aW1lXG5cdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuaGFzX2ZhY3Rvcnlcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5jcmVhdGVcblx0XHRcdHx8ICEgbW9kdWxlX3J1bnRpbWUuaGFzX2ZhY3RvcnkoICdhdmFpbGFiaWxpdHlfY2FjaGUnIClcblx0XHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhdmFpbGFiaWxpdHlfY2FjaGVfY29udHJvbGxlciA9IG1vZHVsZV9ydW50aW1lLmNyZWF0ZShcblx0XHRcdCdhdmFpbGFiaWxpdHlfY2FjaGUnLFxuXHRcdFx0YXZhaWxhYmlsaXR5X2NhY2hlX2luc3RhbmNlX2lkLFxuXHRcdFx0e1xuXHRcdFx0XHRtb3VudDogbW91bnQsXG5cdFx0XHRcdHNldHRpbmdzOiBzZXR0aW5ncyxcblx0XHRcdFx0Z2V0X2F4aXM6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRyZXR1cm4gc2V0dGluZ3MuYXhpcyB8fCB7fTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0X2dlb21ldHJ5OiBnZXRfY29tcG9zZWRfc2VnbWVudF9nZW9tZXRyeSxcblx0XHRcdFx0b25fY2hhbmdlOiBoYW5kbGVfYXZhaWxhYmlsaXR5X2NhY2hlX2NoYW5nZSxcblx0XHRcdFx0b25fc3RhdHVzX2NoYW5nZTogaGFuZGxlX2F2YWlsYWJpbGl0eV9jYWNoZV9zdGF0dXNfY2hhbmdlXG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBbm5vdW5jZSB0aGUgZmlyc3QgbGF6eSBBdmFpbGFiaWxpdHkgZmFpbHVyZSB3aXRob3V0IGludGVycnVwdGluZyBUaW1lbGluZS5cblx0ICpcblx0ICogQSBwYWdlLWxpZmV0aW1lIGd1YXJkIHByZXZlbnRzIHRoZSBwcmV2aW91cy9jdXJyZW50L25leHQgcGFyYWxsZWwgcmVhZHNcblx0ICogZnJvbSByZXBlYXRpbmcgdGhlIHNhbWUgY29udGV4dHVhbCBtZXNzYWdlLiBMb2FkZWQgaW50ZXJ2YWxzIHJlbWFpblxuXHQgKiBkZWNvcmF0aXZlIGFuZCBhcmUgbmV2ZXIgYW5ub3VuY2VkIGluZGl2aWR1YWxseS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNoYW5nZSBBdmFpbGFiaWxpdHkgY2FjaGUgc3RhdGUgbm90aWZpY2F0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX2F2YWlsYWJpbGl0eV9jYWNoZV9jaGFuZ2UoIGNoYW5nZSApIHtcblx0XHRhY2NlcHRlZF9hdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdGVtaXRfYWNjZXB0ZWRfZGF0YV9ldmVudCggJ2F2YWlsYWJpbGl0eS1hY2NlcHRlZCcsIE9iamVjdC5hc3NpZ24oIHt9LCBjaGFuZ2UgfHwge30sIHtcblx0XHRcdHNjaGVtYV92ZXJzaW9uOiAxLFxuXHRcdFx0Z2VuZXJhdGlvbjogYWNjZXB0ZWRfYXZhaWxhYmlsaXR5X2dlbmVyYXRpb25cblx0XHR9ICkgKTtcblx0XHRpZiAoXG5cdFx0XHRhdmFpbGFiaWxpdHlfZmFpbHVyZV9hbm5vdW5jZWRcblx0XHRcdHx8ICEgY2hhbmdlXG5cdFx0XHR8fCAnbmV1dHJhbCcgIT09IGNoYW5nZS5zdGF0ZVxuXHRcdFx0fHwgISBzZXR0aW5ncy5pMThuXG5cdFx0XHR8fCAhIHNldHRpbmdzLmkxOG4uYXZhaWxhYmlsaXR5X2xvYWRfZmFpbGVkXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXZhaWxhYmlsaXR5X2ZhaWx1cmVfYW5ub3VuY2VkID0gdHJ1ZTtcblx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi5hdmFpbGFiaWxpdHlfbG9hZF9mYWlsZWQgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWZsZWN0IGFnZ3JlZ2F0ZSBsYXp5IEF2YWlsYWJpbGl0eSBwcm9ncmVzcyBpbiB0aGUgc2hhcmVkIGJsb2NraW5nIG92ZXJsYXkuXG5cdCAqXG5cdCAqIFRoZXNlIHJlY29yZHMgbmV2ZXIgZW50ZXIgdGhlIGFjY2VwdGVkLWRhdGEgc3RyZWFtLiBUaGV5IGRlc2NyaWJlIG9ubHkgdGhlXG5cdCAqIGN1cnJlbnQgZGVzaXJlZC13aW5kb3cgcmVhZCBsaWZlY3ljbGUgYW5kIGNhbm5vdCBhdXRob3JpemUgb3IgcmVwbGFjZSBkYXRhLlxuXHQgKiBUaGUgb3ZlcmxheSByZW1haW5zIGFjdGl2ZSB1bnRpbCBldmVyeSBkZXNpcmVkIGJhY2tncm91bmQgcmVhZCBzZXR0bGVzLCBzb1xuXHQgKiB0aGUgdmlzaWJsZSBUaW1lbGluZSBuZXZlciBhcHBlYXJzIGNvbXBsZXRlIHdoaWxlIGl0cyB1bmF2YWlsYWJsZS10aW1lXG5cdCAqIHByb2plY3Rpb24gaXMgc3RpbGwgYmVpbmcgYXNzZW1ibGVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc3RhdHVzIEFnZ3JlZ2F0ZSBBdmFpbGFiaWxpdHkgY2FjaGUgc3RhdHVzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX2F2YWlsYWJpbGl0eV9jYWNoZV9zdGF0dXNfY2hhbmdlKCBzdGF0dXMgKSB7XG5cdFx0dmFyIHdhc19sb2FkaW5nO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBzdGF0dXNcblx0XHRcdHx8IDEgIT09IE51bWJlciggc3RhdHVzLnNjaGVtYV92ZXJzaW9uIClcblx0XHRcdHx8ICdpbnZhbGlkYXRlZCcgPT09IHN0YXR1cy5zdGF0ZVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggISBCb29sZWFuKCBzdGF0dXMuaXNfc2V0dGxlZCApIHx8IDAgPCBOdW1iZXIoIHN0YXR1cy5wZW5kaW5nX2NvdW50ICkgKSB7XG5cdFx0XHRzZXRfYXZhaWxhYmlsaXR5X2xvYWRpbmcoIHRydWUgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0d2FzX2xvYWRpbmcgPSBpc19hdmFpbGFiaWxpdHlfbG9hZGluZztcblx0XHRzZXRfYXZhaWxhYmlsaXR5X2xvYWRpbmcoIGZhbHNlICk7XG5cdFx0aWYgKFxuXHRcdFx0d2FzX2xvYWRpbmdcblx0XHRcdCYmIE51bWJlciggc3RhdHVzLmxvYWRlZF9jb3VudCApID09PSBOdW1iZXIoIHN0YXR1cy5kZXNpcmVkX2NvdW50IClcblx0XHRcdCYmIDAgPT09IE51bWJlciggc3RhdHVzLmZhaWxlZF9jb3VudCApXG5cdFx0KSB7XG5cdFx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi50aW1lbGluZV9yZWZyZXNoX2NvbXBsZXRlICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFRvZ2dsZSB0aGUgQXZhaWxhYmlsaXR5IGhvbGQgb24gdGhlIHNoYXJlZCBUaW1lbGluZSBibG9ja2luZyBvdmVybGF5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvYWRpbmcgV2hldGhlciBvbmUgb3IgbW9yZSBkZXNpcmVkIHJlYWRzIHJlbWFpbiBwZW5kaW5nLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0X2F2YWlsYWJpbGl0eV9sb2FkaW5nKCBpc19sb2FkaW5nICkge1xuXHRcdHZhciBzaG91bGRfc2hvdyA9IEJvb2xlYW4oIGlzX2xvYWRpbmcgKTtcblxuXHRcdGlmICggc2hvdWxkX3Nob3cgPT09IGlzX2F2YWlsYWJpbGl0eV9sb2FkaW5nICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpc19hdmFpbGFiaWxpdHlfbG9hZGluZyA9IHNob3VsZF9zaG93O1xuXHRcdGlmICggc2hvdWxkX3Nob3cgKSB7XG5cdFx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi5sb2FkaW5nX2F2YWlsYWJpbGl0eV9iYWNrZ3JvdW5kcyApO1xuXHRcdH1cblx0XHR1cGRhdGVfdGltZWxpbmVfYmxvY2tpbmdfbG9hZGluZ19zdGF0ZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1pcnJvciBhY2NlcHRlZCBib29raW5nIHdpbmRvd3MgaW50byB0aGUgaW5kZXBlbmRlbnQgQXZhaWxhYmlsaXR5IGNhY2hlLlxuXHQgKlxuXHQgKiBUaGlzIGNhbGwgaW50ZW50aW9uYWxseSByZXR1cm5zIG5vIHByb21pc2UuIEJvb2tpbmcgcm93cyBhbmQgbmF2aWdhdGlvblxuXHQgKiByZW1haW4gaW5kZXBlbmRlbnRseSBhdXRob3JpdGF0aXZlIHdoaWxlIEF2YWlsYWJpbGl0eSBsb2FkcywgZmFpbHMsIG9yIGlzXG5cdCAqIHN1cGVyc2VkZWQuIFRoZSBwYWdlIGNvbnRyb2xsZXIgc2VwYXJhdGVseSBibG9ja3MgaW50ZXJhY3Rpb24gdW50aWwgdGhlXG5cdCAqIGFnZ3JlZ2F0ZSBiYWNrZ3JvdW5kIGxpZmVjeWNsZSBzZXR0bGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IHdpbmRvd19lbnRyaWVzIE5hdGl2ZSBvcmRlcmVkIGNhY2hlIHNuYXBzaG90LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfYXZhaWxhYmlsaXR5X2NhY2hlKCB3aW5kb3dfZW50cmllcyApIHtcblx0XHRpZiAoXG5cdFx0XHQhIGF2YWlsYWJpbGl0eV9jYWNoZV9jb250cm9sbGVyXG5cdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgYXZhaWxhYmlsaXR5X2NhY2hlX2NvbnRyb2xsZXIuc3luY2hyb25pemVcblx0XHRcdHx8ICEgQXJyYXkuaXNBcnJheSggd2luZG93X2VudHJpZXMgKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF2YWlsYWJpbGl0eV9jYWNoZV9jb250cm9sbGVyLnN5bmNocm9uaXplKCB3aW5kb3dfZW50cmllcyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERyb3AgY2FjaGVkIHVuYXZhaWxhYmxlIGludGVydmFscyBhZnRlciBhbiBhdXRob3JpdGF0aXZlIG11dGF0aW9uLlxuXHQgKlxuXHQgKiBUaGUgYm9va2luZy13aW5kb3cgaWRlbnRpdHkgY2FuIHJlbWFpbiB1bmNoYW5nZWQgYWZ0ZXIgcmVzaXppbmcgYSBib29raW5nXG5cdCAqIG9yIGFwcGx5aW5nIGEgbWFudWFsIGJsb2NrLiBUaGUgaW5kZXBlbmRlbnQgQXZhaWxhYmlsaXR5IGNhY2hlIG11c3Rcblx0ICogdGhlcmVmb3JlIGJlIGludmFsaWRhdGVkIGV4cGxpY2l0bHkgYmVmb3JlIGNhbm9uaWNhbCByZWFkYmFjazsgdGhlIG5vcm1hbFxuXHQgKiByb3ctcmVuZGVyIGxpZmVjeWNsZSB3aWxsIHN5bmNocm9uaXplIGFuZCByZWxvYWQgdGhlIGJvdW5kZWQgd2luZG93cy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGludmFsaWRhdGVfYXZhaWxhYmlsaXR5X2NhY2hlKCkge1xuXHRcdGlmICggYXZhaWxhYmlsaXR5X2NhY2hlX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGF2YWlsYWJpbGl0eV9jYWNoZV9jb250cm9sbGVyLmludmFsaWRhdGUgKSB7XG5cdFx0XHRhdmFpbGFiaWxpdHlfY2FjaGVfY29udHJvbGxlci5pbnZhbGlkYXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEFib3J0IGxhenkgQXZhaWxhYmlsaXR5IHJlYWRzIGFuZCByZWxlYXNlIHRoZWlyIGJvdW5kZWQgY2FjaGUuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBkZXN0cm95X2F2YWlsYWJpbGl0eV9jYWNoZSgpIHtcblx0XHR2YXIgbW9kdWxlX3J1bnRpbWUgPSB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzO1xuXG5cdFx0aWYgKCBtb2R1bGVfcnVudGltZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuZGVzdHJveSApIHtcblx0XHRcdG1vZHVsZV9ydW50aW1lLmRlc3Ryb3koIGF2YWlsYWJpbGl0eV9jYWNoZV9pbnN0YW5jZV9pZCApO1xuXHRcdH0gZWxzZSBpZiAoIGF2YWlsYWJpbGl0eV9jYWNoZV9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBhdmFpbGFiaWxpdHlfY2FjaGVfY29udHJvbGxlci5kZXN0cm95ICkge1xuXHRcdFx0YXZhaWxhYmlsaXR5X2NhY2hlX2NvbnRyb2xsZXIuZGVzdHJveSgpO1xuXHRcdH1cblx0XHRhdmFpbGFiaWxpdHlfY2FjaGVfY29udHJvbGxlciA9IG51bGw7XG5cdFx0YXZhaWxhYmlsaXR5X2ZhaWx1cmVfYW5ub3VuY2VkID0gZmFsc2U7XG5cdH1cblxuXHQvKipcblx0ICogQ2FuY2VsIHRoZSBhY3RpdmUgZW1wdHktcmFuZ2UgZHJhZnQgYmVmb3JlIGV4cGxpY2l0IFRpbWVsaW5lIG5hdmlnYXRpb24uXG5cdCAqXG5cdCAqIE5hdmlnYXRpb24gcmVwbGFjZXMgdGhlIGxvZ2ljYWwgYXhpcywgc28gcmV0YWluaW5nIGEgZHJhZnQgd291bGQgZXhwb3NlXG5cdCAqIHN0YWxlIGNlbGwgaW5kZXhlcyB0byB0aGUgaW5kZXBlbmRlbnRseSBvd25lZCBzZWxlY3Rpb24gY29udHJvbGxlci5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNhbmNlbF9hY3RpdmVfZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uKCkge1xuXHRcdGlmICggZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIgJiYgZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIuaXNfYWN0aXZlKCkgKSB7XG5cdFx0XHRlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlci5jYW5jZWwoIGZhbHNlICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgZXh0cmFjdGVkIHRvb2xiYXIgYW5kIG5hdmlnYXRpb24gY29udHJvbGxlci5cblx0ICpcblx0ICogVGhlIG1vZHVsZSBvd25zIHJhbmdlL3NjYWxlIHNlbGVjdGlvbiwgZGF0ZSBuYXZpZ2F0aW9uLCBwcmVzZW50YXRpb24tb25seVxuXHQgKiBkZW5zaXR5LCBhbmQgYXhpcy1jZWxsIGtleWJvYXJkIG1vdmVtZW50LiBUaW1lbGluZSByZXRhaW5zIGF1dGhvcml0YXRpdmVcblx0ICogd2luZG93IHJlcXVlc3RzLCBib3VuZGVkIGNhY2hlIHN0YXRlLCByZW5kZXJpbmcsIGFuZCBjcm9zcy1tb2R1bGUgcHJpb3JpdHkuXG5cdCAqXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0b29sYmFyIGFuZCBuYXZpZ2F0aW9uIGluaXRpYWxpemVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV90b29sYmFyX25hdmlnYXRpb24oKSB7XG5cdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblxuXHRcdGlmIChcblx0XHRcdCEgbW9kdWxlX3J1bnRpbWVcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5oYXNfZmFjdG9yeVxuXHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vZHVsZV9ydW50aW1lLmNyZWF0ZVxuXHRcdFx0fHwgISBtb2R1bGVfcnVudGltZS5oYXNfZmFjdG9yeSggJ3Rvb2xiYXJfbmF2aWdhdGlvbicgKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRvb2xiYXJfbmF2aWdhdGlvbl9jb250cm9sbGVyID0gbW9kdWxlX3J1bnRpbWUuY3JlYXRlKFxuXHRcdFx0J3Rvb2xiYXJfbmF2aWdhdGlvbicsXG5cdFx0XHR0b29sYmFyX25hdmlnYXRpb25faW5zdGFuY2VfaWQsXG5cdFx0XHR7XG5cdFx0XHRcdG1vdW50OiBtb3VudCxcblx0XHRcdFx0c2V0dGluZ3M6IHNldHRpbmdzLFxuXHRcdFx0XHR3aW5kb3dfY2FjaGU6IHdpbmRvd19jYWNoZV9jb250cm9sbGVyLFxuXHRcdFx0XHRjYWxsYmFja3M6IHtcblx0XHRcdFx0XHRhbm5vdW5jZTogYW5ub3VuY2UsXG5cdFx0XHRcdFx0Y2FuY2VsX2FuY2hvcl9yZXN0b3JhdGlvbjogY2FuY2VsX2F4aXNfYW5jaG9yX3Jlc3RvcmF0aW9uLFxuXHRcdFx0XHRcdHN1c3BlbmRfYWRqYWNlbnRfbG9hZGluZzogc3VzcGVuZF9hZGphY2VudF9sb2FkaW5nX2Zvcl9uYXZpZ2F0aW9uLFxuXHRcdFx0XHRcdHNjaGVkdWxlX292ZXJmbG93X3Rvb2x0aXBzOiBzY2hlZHVsZV9vdmVyZmxvd190b29sdGlwX3N5bmNocm9uaXphdGlvbixcblx0XHRcdFx0XHRzY2hlZHVsZV9lZGdlX3N0YXR1czogc2NoZWR1bGVfZWRnZV9zdGF0dXNfcG9zaXRpb25pbmcsXG5cdFx0XHRcdFx0c2NoZWR1bGVfYm9va2luZ19sYXlvdXQ6IHNjaGVkdWxlX2Jvb2tpbmdfaW50ZXJhY3Rpb25fbGF5b3V0X2FmdGVyX2F4aXNfbW90aW9uLFxuXHRcdFx0XHRcdGNhbmNlbF9hY3RpdmVfc2VsZWN0aW9uOiBjYW5jZWxfYWN0aXZlX2VtcHR5X3JhbmdlX3NlbGVjdGlvbixcblx0XHRcdFx0XHRyZXN0b3JlX2xvYWRlZF9hbmNob3I6IHJlc3RvcmVfbG9hZGVkX2FuY2hvcixcblx0XHRcdFx0XHRyZXF1ZXN0X3dpbmRvdzogcmVxdWVzdF93aW5kb3csXG5cdFx0XHRcdFx0YWRkX2N1cnJlbnRfd2luZG93X3NwYW46IGFkZF9jdXJyZW50X3dpbmRvd19zcGFuLFxuXHRcdFx0XHRcdGFjdGl2YXRlX2FkamFjZW50X2ludGVudDogYWN0aXZhdGVfYWRqYWNlbnRfbmF2aWdhdGlvbl9pbnRlbnQsXG5cdFx0XHRcdFx0cmVxdWVzdF9hZGphY2VudF93aW5kb3c6IHJlcXVlc3RfYWRqYWNlbnRfd2luZG93LFxuXHRcdFx0XHRcdHN5bmNocm9uaXplX2F4aXNfc2Nyb2xsOiBzeW5jaHJvbml6ZV9heGlzX3Njcm9sbCxcblx0XHRcdFx0XHRzYXZlX3ByZWZlcmVuY2VzOiBxdWV1ZV90aW1lbGluZV9wcmVmZXJlbmNlc19zYXZlLFxuXHRcdFx0XHRcdHJlc2V0X3ByZWZlcmVuY2VzOiBxdWV1ZV90aW1lbGluZV9wcmVmZXJlbmNlc19yZXNldCxcblx0XHRcdFx0XHRzZXRfcHJlZmVyZW5jZV9hbmNob3I6IHNldF90aW1lbGluZV9wcmVmZXJlbmNlX2FuY2hvclxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdHJldHVybiBCb29sZWFuKCB0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlciApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlc3Ryb3kgYW5kIGZvcmdldCB0aGUgZXh0cmFjdGVkIHRvb2xiYXIvbmF2aWdhdGlvbiBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGVzdHJveV90b29sYmFyX25hdmlnYXRpb24oKSB7XG5cdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblxuXHRcdGlmICggbW9kdWxlX3J1bnRpbWUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG1vZHVsZV9ydW50aW1lLmRlc3Ryb3kgKSB7XG5cdFx0XHRtb2R1bGVfcnVudGltZS5kZXN0cm95KCB0b29sYmFyX25hdmlnYXRpb25faW5zdGFuY2VfaWQgKTtcblx0XHR9IGVsc2UgaWYgKCB0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIuZGVzdHJveSApIHtcblx0XHRcdHRvb2xiYXJfbmF2aWdhdGlvbl9jb250cm9sbGVyLmRlc3Ryb3koKTtcblx0XHR9XG5cdFx0dG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIgPSBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgZm9jdXNlZCBSZXNvdXJjZSBzZWxlY3RvciBhbmQgUmVzb3VyY2UgcGFnaW5hdGlvbiBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBUaGUgbW9kdWxlIHJlY2VpdmVzIG9ubHkgcHJlc2VudGF0aW9uIHN0YXRlIHBsdXMgdGhlIHBhZ2UgY29udHJvbGxlcidzXG5cdCAqIHNpZ25lZCBSZXNvdXJjZS1jb250ZXh0IHJlcGxhY2VtZW50IGZ1bmN0aW9uLiBJdCBjYW5ub3QgaW5qZWN0IFJlc291cmNlXG5cdCAqIGlkZW50aWZpZXJzIGludG8gd2luZG93IHJlYWRzIG9yIG11dGF0ZSB0aGUgYm91bmRlZCBjYWNoZSBkaXJlY3RseS5cblx0ICpcblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBvcHRpb25hbCBzb3VyY2UvcnVudGltZSBtb2R1bGUgaW5pdGlhbGl6ZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX3Jlc291cmNlX25hdmlnYXRpb24oKSB7XG5cdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblxuXHRcdGlmIChcblx0XHRcdCEgbW9kdWxlX3J1bnRpbWVcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5oYXNfZmFjdG9yeVxuXHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vZHVsZV9ydW50aW1lLmNyZWF0ZVxuXHRcdFx0fHwgISBtb2R1bGVfcnVudGltZS5oYXNfZmFjdG9yeSggJ3Jlc291cmNlX25hdmlnYXRpb24nIClcblx0XHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXNvdXJjZV9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIgPSBtb2R1bGVfcnVudGltZS5jcmVhdGUoXG5cdFx0XHQncmVzb3VyY2VfbmF2aWdhdGlvbicsXG5cdFx0XHRyZXNvdXJjZV9uYXZpZ2F0aW9uX2luc3RhbmNlX2lkLFxuXHRcdFx0e1xuXHRcdFx0XHRtb3VudDogbW91bnQsXG5cdFx0XHRcdHNldHRpbmdzOiBzZXR0aW5ncyxcblx0XHRcdFx0YW5ub3VuY2U6IGFubm91bmNlLFxuXHRcdFx0XHRzaG93X2FkbWluX21lc3NhZ2U6IHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSxcblx0XHRcdFx0cmVwbGFjZV9yZXNvdXJjZV92aWV3OiByZXBsYWNlX3Jlc291cmNlX3ZpZXdcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0cmV0dXJuIEJvb2xlYW4oIHJlc291cmNlX25hdmlnYXRpb25fY29udHJvbGxlciApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlc3Ryb3kgYW5kIGZvcmdldCB0aGUgZm9jdXNlZCBSZXNvdXJjZSBuYXZpZ2F0aW9uIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBkZXN0cm95X3Jlc291cmNlX25hdmlnYXRpb24oKSB7XG5cdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblxuXHRcdGlmICggbW9kdWxlX3J1bnRpbWUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG1vZHVsZV9ydW50aW1lLmRlc3Ryb3kgKSB7XG5cdFx0XHRtb2R1bGVfcnVudGltZS5kZXN0cm95KCByZXNvdXJjZV9uYXZpZ2F0aW9uX2luc3RhbmNlX2lkICk7XG5cdFx0fSBlbHNlIGlmICggcmVzb3VyY2VfbmF2aWdhdGlvbl9jb250cm9sbGVyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiByZXNvdXJjZV9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIuZGVzdHJveSApIHtcblx0XHRcdHJlc291cmNlX25hdmlnYXRpb25fY29udHJvbGxlci5kZXN0cm95KCk7XG5cdFx0fVxuXHRcdHJlc291cmNlX25hdmlnYXRpb25fY29udHJvbGxlciA9IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIHRoZSBmb2N1c2VkIFJlc291cmNlIHJvdy1hY3Rpb25zIGFuZCBzZXR0aW5ncy1pbnNwZWN0b3IgYWRhcHRlci5cblx0ICpcblx0ICogVGhlIGFkYXB0ZXIgcmVjZWl2ZXMgcHJlc2VudGF0aW9uIHN0YXRlIG9ubHkuIFNoYXJlZCBkcm9wZG93biBhbmQgaW5zcGVjdG9yXG5cdCAqIGNvbXBvbmVudHMgb3duIHRoZWlyIGxpZmVjeWNsZSB3aGlsZSBzZXJ2ZXIgZW5kcG9pbnRzIHJlbWFpbiBhdXRob3JpdGF0aXZlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIG9wdGlvbmFsIHNvdXJjZS9ydW50aW1lIG1vZHVsZSBpbml0aWFsaXplZC5cblx0ICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfcmVzb3VyY2Vfc2V0dGluZ3MoKSB7XG5cdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblxuXHRcdGlmIChcblx0XHRcdCEgbW9kdWxlX3J1bnRpbWVcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5oYXNfZmFjdG9yeVxuXHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vZHVsZV9ydW50aW1lLmNyZWF0ZVxuXHRcdFx0fHwgISBtb2R1bGVfcnVudGltZS5oYXNfZmFjdG9yeSggJ3Jlc291cmNlX3NldHRpbmdzJyApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmVzb3VyY2Vfc2V0dGluZ3NfY29udHJvbGxlciA9IG1vZHVsZV9ydW50aW1lLmNyZWF0ZShcblx0XHRcdCdyZXNvdXJjZV9zZXR0aW5ncycsXG5cdFx0XHRyZXNvdXJjZV9zZXR0aW5nc19pbnN0YW5jZV9pZCxcblx0XHRcdHtcblx0XHRcdFx0bW91bnQ6IG1vdW50LFxuXHRcdFx0XHRzZXR0aW5nczogc2V0dGluZ3MsXG5cdFx0XHRcdGFubm91bmNlOiBhbm5vdW5jZSxcblx0XHRcdFx0cmVmcmVzaF9hZnRlcl9tdXRhdGlvbjogcmVmcmVzaF9hZnRlcl9yZXNvdXJjZV9zZXR0aW5nc19tdXRhdGlvblxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRyZXR1cm4gQm9vbGVhbiggcmVzb3VyY2Vfc2V0dGluZ3NfY29udHJvbGxlciApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlc3Ryb3kgYW5kIGZvcmdldCB0aGUgZm9jdXNlZCBSZXNvdXJjZS1zZXR0aW5ncyBhZGFwdGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGVzdHJveV9yZXNvdXJjZV9zZXR0aW5ncygpIHtcblx0XHR2YXIgbW9kdWxlX3J1bnRpbWUgPSB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzO1xuXG5cdFx0aWYgKCBtb2R1bGVfcnVudGltZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuZGVzdHJveSApIHtcblx0XHRcdG1vZHVsZV9ydW50aW1lLmRlc3Ryb3koIHJlc291cmNlX3NldHRpbmdzX2luc3RhbmNlX2lkICk7XG5cdFx0fSBlbHNlIGlmICggcmVzb3VyY2Vfc2V0dGluZ3NfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcmVzb3VyY2Vfc2V0dGluZ3NfY29udHJvbGxlci5kZXN0cm95ICkge1xuXHRcdFx0cmVzb3VyY2Vfc2V0dGluZ3NfY29udHJvbGxlci5kZXN0cm95KCk7XG5cdFx0fVxuXHRcdHJlc291cmNlX3NldHRpbmdzX2NvbnRyb2xsZXIgPSBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlZnJlc2ggdGhlIGN1cnJlbnQgY2Fub25pY2FsIHdpbmRvdyBhZnRlciBhIFJlc291cmNlIHByZWZlcmVuY2UgbXV0YXRpb24uXG5cdCAqXG5cdCAqIFRoZSBSZXNvdXJjZS1zZXR0aW5ncyBhZGFwdGVyIGNsb3NlcyBpdHMgc2hhcmVkIEluc3BlY3RvciBmaXJzdC4gVGltZWxpbmVcblx0ICogdGhlbiBvd25zIHNpZ25lZCByZWFkYmFjaywgc3RhbGUtcmVzcG9uc2UgcmVqZWN0aW9uLCBib3VuZGVkIGNhY2hlXG5cdCAqIHJlcGxhY2VtZW50LCBkYXRlLWFuY2hvciByZXN0b3JhdGlvbiwgYW5kIG5vcm1hbCBsb2FkaW5nIGZlZWRiYWNrLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0galF1ZXJ5LWNvbXBhdGlibGUgcHJvbWlzZSBmb3IgY2Fub25pY2FsIFRpbWVsaW5lIHJlYWRiYWNrLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVmcmVzaF9hZnRlcl9yZXNvdXJjZV9zZXR0aW5nc19tdXRhdGlvbigpIHtcblx0XHR2YXIgYW5jaG9yID0gY2FwdHVyZV9heGlzX2FuY2hvcigpO1xuXHRcdHZhciByZWFkYmFja19nZW5lcmF0aW9uID0gYmVnaW5fYXV0aG9yaXRhdGl2ZV9yZWFkYmFjayggJ3Jlc291cmNlX3NldHRpbmdzJyApO1xuXG5cdFx0cmV0dXJuIHRyYWNrX2F1dGhvcml0YXRpdmVfcmVhZGJhY2soIHJlcXVlc3Rfd2luZG93KCBhZGRfY3VycmVudF93aW5kb3dfc3Bhbigge1xuXHRcdFx0YW5jaG9yX2F0OiBhbmNob3IuYXQsXG5cdFx0XHRhbmNob3JfcmF0aW86IGFuY2hvci5yYXRpbyxcblx0XHRcdHdpbmRvd19wb3NpdGlvbjogMCxcblx0XHRcdHZpZXc6IHNldHRpbmdzLmN1cnJlbnRfYXhpcyA/IHNldHRpbmdzLmN1cnJlbnRfYXhpcy52aWV3IDogc2V0dGluZ3MuYXhpcy52aWV3XG5cdFx0fSwgdHJ1ZSApLCBhbmNob3IsIHRydWUsIHtcblx0XHRcdGxvYWRpbmc6IHNldHRpbmdzLmkxOG4ucmVsb2FkaW5nX3RpbWVsaW5lLFxuXHRcdFx0Y29tcGxldGU6IHNldHRpbmdzLmkxOG4uc3RhdHVzX3JlYWR5LFxuXHRcdFx0c3VwcHJlc3NfY29tcGxldGVfbWVzc2FnZTogdHJ1ZSxcblx0XHRcdHByZXNlcnZlX3NlbGVjdGlvbjogdHJ1ZVxuXHRcdH0gKSwgcmVhZGJhY2tfZ2VuZXJhdGlvbiwgJ3Jlc291cmNlX3NldHRpbmdzJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIGJvdW5kZWQsIG5vbi1hdXRob3JpdGF0aXZlIHJldHVybiBjb250ZXh0IGZvciBzZWxlY3Rpb24gcHJldmlldy5cblx0ICpcblx0ICogVGhlIGVtcHR5LXJhbmdlIG1vZHVsZSBvd25zIHJlcXVlc3Qgc3RhdGUsIHdoaWxlIFRpbWVsaW5lIHJlbWFpbnMgdGhlIG93bmVyXG5cdCAqIG9mIGl0cyBjdXJyZW50IGNhY2hlZCB3aW5kb3cgYW5kIHBoeXNpY2FsIGFuY2hvci5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fSBDdXJyZW50IFRpbWVsaW5lIHByZXNlbnRhdGlvbiBjb250ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9yZXR1cm5fY29udGV4dCgpIHtcblx0XHR2YXIgYW5jaG9yID0gY2FwdHVyZV9heGlzX2FuY2hvcigpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHdpbmRvd19kYXlzOiBOdW1iZXIoIHNldHRpbmdzLndpbmRvdy53aW5kb3dfZGF5cyApIHx8IDAsXG5cdFx0XHR3aW5kb3dfbW9udGhzOiBOdW1iZXIoIHNldHRpbmdzLndpbmRvdy53aW5kb3dfbW9udGhzICkgfHwgMCxcblx0XHRcdHZpZXc6IHNldHRpbmdzLmF4aXMudmlldyxcblx0XHRcdGFuY2hvcl9hdDogYW5jaG9yLmF0LFxuXHRcdFx0YW5jaG9yX3JhdGlvOiBhbmNob3IucmF0aW9cblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBzaWduZWQgc2VsZWN0aW9uIGNvbnRleHQgZnJvbSBlYWNoIGNhY2hlZCBhdXRob3JpemVkIHdpbmRvdy5cblx0ICpcblx0ICogQHJldHVybiB7QXJyYXk8c3RyaW5nPn0gQm91bmRlZCBsb2FkZWQtd2luZG93IGNvbnRleHQgdG9rZW5zLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2xvYWRlZF9lbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udGV4dF90b2tlbnMoKSB7XG5cdFx0cmV0dXJuIHdpbmRvd19jYWNoZV9jb250cm9sbGVyID8gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuZ2V0X3NlbGVjdGlvbl9jb250ZXh0X3Rva2VucygpIDogW107XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgdGhlIGJvdW5kZWQgcmVxdWVzdCBjb250ZXh0IHNoYXJlZCBieSByZWdpc3RlcmVkIHNlbGVjdGlvbiBhZGFwdGVycy5cblx0ICpcblx0ICogVGltZWxpbmUgcmVtYWlucyB0aGUgb3duZXIgb2Ygc2lnbmVkIGxvYWRlZC13aW5kb3cgY292ZXJhZ2UsIHJldHVybi1hbmNob3Jcblx0ICogc3RhdGUsIHJlcXVlc3QgdGltZW91dCwgYW5kIHRoZSBleGlzdGluZyBwcmV2aWV3L2FwcGx5IHRyYW5zcG9ydC4gRXh0ZW5zaW9uc1xuXHQgKiByZWNlaXZlIGEgZnJlc2ggc2NhbGFyL2FycmF5IHNuYXBzaG90IGZvciBlYWNoIGV4cGxpY2l0IHJlcXVlc3QgYW5kIGNhbm5vdFxuXHQgKiByZXBsYWNlIGNhY2hlIHN0YXRlIHRocm91Z2ggdGhpcyByZWFkIGJvdW5kYXJ5LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEN1cnJlbnQgc2VsZWN0aW9uIHJlcXVlc3QgYW5kIHRyYW5zcG9ydCBjb250ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2V4dGVuc2lvbl9zZWxlY3Rpb25fcmVxdWVzdF9jb250ZXh0KCkge1xuXHRcdHZhciBzZWxlY3Rpb25fdHJhbnNwb3J0ID0gc2V0dGluZ3MudHJhbnNwb3J0ICYmIHNldHRpbmdzLnRyYW5zcG9ydC5zZWxlY3Rpb25cblx0XHRcdD8gc2V0dGluZ3MudHJhbnNwb3J0LnNlbGVjdGlvblxuXHRcdFx0OiB7fTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHR0cmFuc3BvcnQ6IHtcblx0XHRcdFx0dXJsOiBTdHJpbmcoIHNldHRpbmdzLnRyYW5zcG9ydCAmJiBzZXR0aW5ncy50cmFuc3BvcnQudXJsID8gc2V0dGluZ3MudHJhbnNwb3J0LnVybCA6ICcnICksXG5cdFx0XHRcdHByZXZpZXdfYWN0aW9uOiBTdHJpbmcoIHNlbGVjdGlvbl90cmFuc3BvcnQucHJldmlld19hY3Rpb24gfHwgJycgKSxcblx0XHRcdFx0YXBwbHlfYWN0aW9uOiBTdHJpbmcoIHNlbGVjdGlvbl90cmFuc3BvcnQuYXBwbHlfYWN0aW9uIHx8ICcnICksXG5cdFx0XHRcdHByZXZpZXdfbm9uY2U6IFN0cmluZyggc2VsZWN0aW9uX3RyYW5zcG9ydC5wcmV2aWV3X25vbmNlIHx8ICcnICksXG5cdFx0XHRcdGFwcGx5X25vbmNlOiBTdHJpbmcoIHNlbGVjdGlvbl90cmFuc3BvcnQuYXBwbHlfbm9uY2UgfHwgJycgKVxuXHRcdFx0fSxcblx0XHRcdHZpZXc6IFN0cmluZyggc2V0dGluZ3MuYXhpcyAmJiBzZXR0aW5ncy5heGlzLnZpZXcgPyBzZXR0aW5ncy5heGlzLnZpZXcgOiAnJyApLFxuXHRcdFx0bG9hZGVkX3N0YXJ0X2F0OiBTdHJpbmcoIHNldHRpbmdzLmF4aXMgJiYgc2V0dGluZ3MuYXhpcy5zdGFydF9hdCA/IHNldHRpbmdzLmF4aXMuc3RhcnRfYXQgOiAnJyApLFxuXHRcdFx0bG9hZGVkX2VuZF9hdDogU3RyaW5nKCBzZXR0aW5ncy5heGlzICYmIHNldHRpbmdzLmF4aXMuZW5kX2F0ID8gc2V0dGluZ3MuYXhpcy5lbmRfYXQgOiAnJyApLFxuXHRcdFx0bG9hZGVkX2NvbnRleHRfdG9rZW5zOiBnZXRfbG9hZGVkX2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250ZXh0X3Rva2VucygpLnNsaWNlKCAwLCAzICksXG5cdFx0XHRyZXR1cm5fY29udGV4dDogZ2V0X2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9yZXR1cm5fY29udGV4dCgpLFxuXHRcdFx0cmVxdWVzdF90aW1lb3V0X21zOiBnZXRfd2luZG93X2xvYWRpbmdfbGltaXRzKCkucmVxdWVzdF90aW1lb3V0X21zXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWZyZXNoIHRoZSBjdXJyZW50IFRpbWVsaW5lIGFmdGVyIGFuIGF1dGhvcml0YXRpdmUgQXZhaWxhYmlsaXR5IG11dGF0aW9uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0galF1ZXJ5LWNvbXBhdGlibGUgcHJvbWlzZSBmb3IgY2Fub25pY2FsIFRpbWVsaW5lIHJlYWRiYWNrLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVmcmVzaF9hZnRlcl9hdmFpbGFiaWxpdHlfbXV0YXRpb24oKSB7XG5cdFx0dmFyIGFuY2hvciA9IGNhcHR1cmVfYXhpc19hbmNob3IoKTtcblx0XHR2YXIgcmVhZGJhY2tfZ2VuZXJhdGlvbiA9IGJlZ2luX2F1dGhvcml0YXRpdmVfcmVhZGJhY2soICdhdmFpbGFiaWxpdHlfbXV0YXRpb24nICk7XG5cblx0XHRpbnZhbGlkYXRlX2F2YWlsYWJpbGl0eV9jYWNoZSgpO1xuXHRcdHJldHVybiB0cmFja19hdXRob3JpdGF0aXZlX3JlYWRiYWNrKCByZXF1ZXN0X3dpbmRvdyggYWRkX2N1cnJlbnRfd2luZG93X3NwYW4oIHtcblx0XHRcdGFuY2hvcl9hdDogYW5jaG9yLmF0LFxuXHRcdFx0YW5jaG9yX3JhdGlvOiBhbmNob3IucmF0aW8sXG5cdFx0XHR3aW5kb3dfcG9zaXRpb246IDAsXG5cdFx0XHR2aWV3OiBzZXR0aW5ncy5heGlzLnZpZXdcblx0XHR9LCB0cnVlICksIGFuY2hvciwgdHJ1ZSwge1xuXHRcdFx0bG9hZGluZzogc2V0dGluZ3MuaTE4bi5hcHBseWluZ19hdmFpbGFiaWxpdHksXG5cdFx0XHRjb21wbGV0ZTogc2V0dGluZ3MuaTE4bi5zdGF0dXNfcmVhZHksXG5cdFx0XHRwcmVzZXJ2ZV9zZWxlY3Rpb246IHRydWUsXG5cdFx0XHRzdXBwcmVzc19jb21wbGV0ZV9tZXNzYWdlOiB0cnVlXG5cdFx0fSApLCByZWFkYmFja19nZW5lcmF0aW9uLCAnYXZhaWxhYmlsaXR5X211dGF0aW9uJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlZnJlc2ggQXZhaWxhYmlsaXR5IGFmdGVyIHRoZSByZXVzYWJsZSBCbG9jayBUaW1lcyBjb21wb25lbnQgc2F2ZXMuXG5cdCAqXG5cdCAqIFRoZSBCbG9jayBUaW1lcyBkb21haW4gb3ducyB0aGUgbXV0YXRpb24gYW5kIGl0cyByZXN1bHQuIFRpbWVsaW5lIG93bnMgb25seVxuXHQgKiBpdHMgY2FjaGVkIHJlYWQgbW9kZWwsIHNvIGl0IHBlcmZvcm1zIGNhbm9uaWNhbCByZWFkYmFjaywgcmVwb3J0cyB0aGUgbGF0ZXJcblx0ICogcmVhZCBsaWZlY3ljbGUgd2l0aG91dCBkdXBsaWNhdGluZyB0aGUgbXV0YXRpb24gcmVzdWx0LCBhbmQga2VlcHMgdGhlIGN1cnJlbnRcblx0ICogYW5jaG9yIGFuZCBzZWxlY3Rpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IE5vcm1hbGl6ZWQgQXZhaWxhYmlsaXR5IG11dGF0aW9uIG5vdGlmaWNhdGlvbi5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2NoYW5nZWQoIGV2ZW50ICkge1xuXHRcdHZhciBjaGFuZ2UgPSBldmVudCAmJiBldmVudC5kZXRhaWwgPyBldmVudC5kZXRhaWwgOiB7fTtcblxuXHRcdGlmIChcblx0XHRcdCEgaXNfaW5pdGlhbGl6ZWRcblx0XHRcdHx8IDEgIT09IE51bWJlciggY2hhbmdlLnNjaGVtYV92ZXJzaW9uIClcblx0XHRcdHx8IDEgPiBOdW1iZXIoIGNoYW5nZS5yZXNvdXJjZV9pZCApXG5cdFx0XHR8fCBbICdibG9jaycsICd1bmJsb2NrJyBdLmluZGV4T2YoIFN0cmluZyggY2hhbmdlLm1vZGUgfHwgJycgKSApID09PSAtMVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlZnJlc2hfYWZ0ZXJfYXZhaWxhYmlsaXR5X211dGF0aW9uKCk7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIHRoZSBleHRyYWN0ZWQgZW1wdHktcmFuZ2Ugc3RhdGUgbWFjaGluZSB0aHJvdWdoIHRoZSBtb2R1bGUgcmVnaXN0cnkuXG5cdCAqXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgZm9jdXNlZCBtb2R1bGUgaW5pdGlhbGl6ZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2VtcHR5X3JhbmdlX3NlbGVjdGlvbigpIHtcblx0XHR2YXIgbW9kdWxlX3J1bnRpbWUgPSB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBtb2R1bGVfcnVudGltZVxuXHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vZHVsZV9ydW50aW1lLmhhc19mYWN0b3J5XG5cdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuY3JlYXRlXG5cdFx0XHR8fCAhIG1vZHVsZV9ydW50aW1lLmhhc19mYWN0b3J5KCAnZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uJyApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0ZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIgPSBtb2R1bGVfcnVudGltZS5jcmVhdGUoXG5cdFx0XHQnZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uJyxcblx0XHRcdGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9pbnN0YW5jZV9pZCxcblx0XHRcdHtcblx0XHRcdFx0bW91bnQ6IG1vdW50LFxuXHRcdFx0XHRzZXR0aW5nczogc2V0dGluZ3MsXG5cdFx0XHRcdGdldF90ZW1wbGF0ZTogZ2V0X3RlbXBsYXRlLFxuXHRcdFx0XHRnZXRfc2VnbWVudF9nZW9tZXRyeTogZ2V0X2NvbXBvc2VkX3NlZ21lbnRfZ2VvbWV0cnksXG5cdFx0XHRcdGdldF9yZXR1cm5fY29udGV4dDogZ2V0X2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9yZXR1cm5fY29udGV4dCxcblx0XHRcdFx0Z2V0X2xvYWRlZF9jb250ZXh0X3Rva2VuczogZ2V0X2xvYWRlZF9lbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udGV4dF90b2tlbnMsXG5cdFx0XHRcdGdldF9yZXF1ZXN0X3RpbWVvdXRfbXM6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRyZXR1cm4gZ2V0X3dpbmRvd19sb2FkaW5nX2xpbWl0cygpLnJlcXVlc3RfdGltZW91dF9tcztcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVmcmVzaF9hZnRlcl9hcHBseTogcmVmcmVzaF9hZnRlcl9hdmFpbGFiaWxpdHlfbXV0YXRpb24sXG5cdFx0XHRcdHNldF9hcHBseV9sb2FkaW5nOiBzZXRfc2VsZWN0aW9uX2FwcGx5X2xvYWRpbmcsXG5cdFx0XHRcdGFubm91bmNlOiBhbm5vdW5jZSxcblx0XHRcdFx0aXNfaG9zdF9hY3RpdmU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRyZXR1cm4gaXNfaW5pdGlhbGl6ZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0cmV0dXJuIEJvb2xlYW4oIGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyICk7XG5cdH1cblxuXHQvKipcblx0ICogRGVzdHJveSBhbmQgZm9yZ2V0IHRoZSBleHRyYWN0ZWQgZW1wdHktcmFuZ2UgY29udHJvbGxlci5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGRlc3Ryb3lfZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uKCkge1xuXHRcdHZhciBtb2R1bGVfcnVudGltZSA9IHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXM7XG5cblx0XHRpZiAoIG1vZHVsZV9ydW50aW1lICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5kZXN0cm95ICkge1xuXHRcdFx0bW9kdWxlX3J1bnRpbWUuZGVzdHJveSggZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2luc3RhbmNlX2lkICk7XG5cdFx0fSBlbHNlIGlmICggZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyLmRlc3Ryb3kgKSB7XG5cdFx0XHRlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlci5kZXN0cm95KCk7XG5cdFx0fVxuXHRcdGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyID0gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWZyZXNoIHRoZSBjdXJyZW50IHdpbmRvdyBhZnRlciBhbiBhY2NlcHRlZCBJbnNwZWN0b3Igc2F2ZSBldmVudC5cblx0ICpcblx0ICogVGhlIGJvb2tpbmctaW50ZXJhY3Rpb25zIG1vZHVsZSBvd25zIGV2ZW50IGdlbmVyYXRpb24gYW5kIE92ZXJ2aWV3IGNhY2hlXG5cdCAqIGludmFsaWRhdGlvbi4gVGltZWxpbmUgcmV0YWlucyBpdHMgY2Fub25pY2FsIHdpbmRvdyByZXF1ZXN0LCBhbmNob3IsIHN0YWxlXG5cdCAqIHJlc3BvbnNlLCBsb2FkaW5nLCBhbmQgcmVuZGVyaW5nIHJlc3BvbnNpYmlsaXRpZXMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBqUXVlcnktY29tcGF0aWJsZSBwcm9taXNlIGZvciBjYW5vbmljYWwgVGltZWxpbmUgcmVhZGJhY2suXG5cdCAqL1xuXHRmdW5jdGlvbiByZWZyZXNoX2FmdGVyX2Jvb2tpbmdfaW5zcGVjdG9yX3NhdmUoKSB7XG5cdFx0dmFyIGFuY2hvciA9IGNhcHR1cmVfYXhpc19hbmNob3IoKTtcblx0XHR2YXIgcmVhZGJhY2tfZ2VuZXJhdGlvbiA9IGJlZ2luX2F1dGhvcml0YXRpdmVfcmVhZGJhY2soICdib29raW5nX2luc3BlY3RvcicgKTtcblxuXHRcdGludmFsaWRhdGVfYXZhaWxhYmlsaXR5X2NhY2hlKCk7XG5cdFx0cmV0dXJuIHRyYWNrX2F1dGhvcml0YXRpdmVfcmVhZGJhY2soIHJlcXVlc3Rfd2luZG93KCBhZGRfY3VycmVudF93aW5kb3dfc3Bhbigge1xuXHRcdFx0YW5jaG9yX2F0OiBhbmNob3IuYXQsXG5cdFx0XHRhbmNob3JfcmF0aW86IGFuY2hvci5yYXRpbyxcblx0XHRcdHdpbmRvd19wb3NpdGlvbjogMCxcblx0XHRcdHZpZXc6IHNldHRpbmdzLmN1cnJlbnRfYXhpcyA/IHNldHRpbmdzLmN1cnJlbnRfYXhpcy52aWV3IDogc2V0dGluZ3MuYXhpcy52aWV3XG5cdFx0fSwgdHJ1ZSApLCBhbmNob3IsIHRydWUsIHtcblx0XHRcdGxvYWRpbmc6IHNldHRpbmdzLmkxOG4ucmVsb2FkaW5nX3RpbWVsaW5lLFxuXHRcdFx0Y29tcGxldGU6IHNldHRpbmdzLmkxOG4uc3RhdHVzX3JlYWR5LFxuXHRcdFx0cHJlc2VydmVfc2VsZWN0aW9uOiB0cnVlLFxuXHRcdFx0c3VwcHJlc3NfY29tcGxldGVfbWVzc2FnZTogdHJ1ZVxuXHRcdH0gKSwgcmVhZGJhY2tfZ2VuZXJhdGlvbiwgJ2Jvb2tpbmdfaW5zcGVjdG9yJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc3BhdGNoIG9uZSBleGVjdXRhYmxlLWZyZWUgVGltZWxpbmUgY3JlYXRpb24tcmVhZGJhY2sgcmVzdWx0LlxuXHQgKlxuXHQgKiBUaGUgY3JlYXRpb24gZG9tYWluIHVzZXMgdGhpcyByZXN1bHQgb25seSB0byBwcmVzZW50IHBlcnNpc3RlZC1zdWNjZXNzIG9yXG5cdCAqIGhvc3QtcmVmcmVzaCBzdGF0dXMuIFRpbWVsaW5lIHJlbWFpbnMgdGhlIHNvbGUgb3duZXIgb2YgaXRzIHdpbmRvdyBjYWNoZSxcblx0ICogcmVuZGVyZWQgYm9va2luZyBzZWxlY3Rpb24sIGFuZCBvcHRpb25hbCByZWFkLW9ubHkgSW5zcGVjdG9yIGhhbmRvZmYuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkZXRhaWwgVmFsaWRhdGVkIHNjYWxhciByZXN1bHQgZGV0YWlsLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGlzcGF0Y2hfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19yZXN1bHQoIGRldGFpbCApIHtcblx0XHR2YXIgcmVhZGJhY2tfZXZlbnQ7XG5cblx0XHRpZiAoICEgbW91bnQgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vdW50LmRpc3BhdGNoRXZlbnQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdHJlYWRiYWNrX2V2ZW50ID0gbmV3IHdpbmRvdy5DdXN0b21FdmVudCggJ3dwYmM6Ym9va2luZy1uZXctaW5zcGVjdG9yOnRpbWVsaW5lLXJlYWRiYWNrJywge1xuXHRcdFx0XHRkZXRhaWw6IGRldGFpbFxuXHRcdFx0fSApO1xuXHRcdH0gZWxzZSBpZiAoIGRvY3VtZW50LmNyZWF0ZUV2ZW50ICkge1xuXHRcdFx0cmVhZGJhY2tfZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xuXHRcdFx0cmVhZGJhY2tfZXZlbnQuaW5pdEN1c3RvbUV2ZW50KCAnd3BiYzpib29raW5nLW5ldy1pbnNwZWN0b3I6dGltZWxpbmUtcmVhZGJhY2snLCBmYWxzZSwgZmFsc2UsIGRldGFpbCApO1xuXHRcdH1cblx0XHRpZiAoIHJlYWRiYWNrX2V2ZW50ICkge1xuXHRcdFx0bW91bnQuZGlzcGF0Y2hFdmVudCggcmVhZGJhY2tfZXZlbnQgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVtZW1iZXIgb25lIHRlcm1pbmFsIGNyZWF0aW9uLXJlYWRiYWNrIGNvcnJlbGF0aW9uIElELlxuXHQgKlxuXHQgKiBUaGUgYm91bmRlZCBoaXN0b3J5IHByZXZlbnRzIGEgZGVsYXllZCBvciByZXBsYXllZCBicm93c2VyIGV2ZW50IGZyb21cblx0ICogcmVmcmVzaGluZyB0aGUgc2FtZSBhdXRob3JpdGF0aXZlIFRpbWVsaW5lIG1vcmUgdGhhbiBvbmNlIHdpdGhvdXQga2VlcGluZ1xuXHQgKiBhbiB1bmJvdW5kZWQgcGFnZS1saWZldGltZSBjb2xsZWN0aW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcmVxdWVzdF9pZCBWYWxpZGF0ZWQgY3JlYXRpb24tcmVhZGJhY2sgY29ycmVsYXRpb24gSUQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZW1lbWJlcl9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkKCByZXF1ZXN0X2lkICkge1xuXHRcdHZhciBvbGRlc3RfcmVxdWVzdF9pZDtcblxuXHRcdGlmICggY29tcGxldGVkX2Jvb2tpbmdfY3JlYXRpb25fcmVhZGJhY2tfaWRzWyByZXF1ZXN0X2lkIF0gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbXBsZXRlZF9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkc1sgcmVxdWVzdF9pZCBdID0gdHJ1ZTtcblx0XHRjb21wbGV0ZWRfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19vcmRlci5wdXNoKCByZXF1ZXN0X2lkICk7XG5cdFx0aWYgKCAyMCA8IGNvbXBsZXRlZF9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX29yZGVyLmxlbmd0aCApIHtcblx0XHRcdG9sZGVzdF9yZXF1ZXN0X2lkID0gY29tcGxldGVkX2Jvb2tpbmdfY3JlYXRpb25fcmVhZGJhY2tfb3JkZXIuc2hpZnQoKTtcblx0XHRcdGRlbGV0ZSBjb21wbGV0ZWRfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19pZHNbIG9sZGVzdF9yZXF1ZXN0X2lkIF07XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlc3RvcmUgZm9jdXMgdG8gYSB2aXNpYmxlIGF1dGhvcml0YXRpdmUgY3JlYXRlZCBib29raW5nIGFmdGVyIHNoZWxsIGNsb3NlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBDcmVhdGlvbiBJbnNwZWN0b3IgZm9jdXMtcmVzdG9yYXRpb24gcmVxdWVzdC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9ib29raW5nX2NyZWF0aW9uX2ZvY3VzX2NyZWF0ZWQoIGV2ZW50ICkge1xuXHRcdHZhciBkZXRhaWwgPSBldmVudCAmJiBldmVudC5kZXRhaWwgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBldmVudC5kZXRhaWwgPyBldmVudC5kZXRhaWwgOiB7fTtcblx0XHR2YXIgYm9va2luZ19pZCA9IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIGRldGFpbC5ib29raW5nX2lkICkgfHwgMCApICk7XG5cblx0XHRpZiAoXG5cdFx0XHQxID09PSBOdW1iZXIoIGRldGFpbC5zY2hlbWFfdmVyc2lvbiApXG5cdFx0XHQmJiBib29raW5nX2lkXG5cdFx0XHQmJiBib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyXG5cdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlci5mb2N1c19jcmVhdGVkX2Jvb2tpbmdcblx0XHQpIHtcblx0XHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIuZm9jdXNfY3JlYXRlZF9ib29raW5nKCBib29raW5nX2lkICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENvbnN1bWUgb25seSB0aGUgZXhhY3Qgc2lnbmVkIHNlbGVjdGlvbiB0aGF0IGxhdW5jaGVkIHRoZSBjcmVhdGVkIGJvb2tpbmcuXG5cdCAqXG5cdCAqIEVtcHR5IHRvcC1uYXZpZ2F0aW9uIGxhdW5jaGVzIGNhcnJ5IG5vIHRva2VuIGFuZCB0aGVyZWZvcmUgY2xlYXIgbm8gbG9jYWxcblx0ICogc2VsZWN0aW9uLiBTZWxlY3Rpb24gbW9kdWxlcyBjb21wYXJlIHRoZSBvcGFxdWUgdG9rZW4gZnJvbSB0aGVpciBjdXJyZW50XG5cdCAqIHNlcnZlci1vd25lZCBhY3Rpb24gVVJMOyBUaW1lbGluZSBuZXZlciBkZWNvZGVzIG9yIGF1dGhvcml6ZXMgaXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkZXRhaWwgVmFsaWRhdGVkIGNyZWF0aW9uLXJlYWRiYWNrIHJlcXVlc3QgZGV0YWlsLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gb25lIG1hdGNoaW5nIGxvY2FsIHNlbGVjdGlvbiB3YXMgY29uc3VtZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBjb25zdW1lX2Jvb2tpbmdfY3JlYXRpb25fc2VsZWN0aW9uKCBkZXRhaWwgKSB7XG5cdFx0dmFyIG1vZHVsZV9ydW50aW1lID0gd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcztcblx0XHR2YXIgY29uc3VtZWQgPSBmYWxzZTtcblx0XHR2YXIgdG9rZW4gPSBTdHJpbmcoIGRldGFpbC5zb3VyY2VfY29udGV4dF90b2tlbiB8fCAnJyApO1xuXHRcdHZhciBxdWVyeV9hcmcgPSBTdHJpbmcoIGRldGFpbC5oYW5kb2ZmX3F1ZXJ5X2FyZyB8fCAnJyApO1xuXG5cdFx0aWYgKCAhIHRva2VuIHx8ICEgcXVlcnlfYXJnICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoXG5cdFx0XHRlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlclxuXHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyLmNvbnN1bWVfc2lnbmVkX2FjdGlvbl9jb250ZXh0XG5cdFx0KSB7XG5cdFx0XHRjb25zdW1lZCA9IGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyLmNvbnN1bWVfc2lnbmVkX2FjdGlvbl9jb250ZXh0KCAnbmV3X2Jvb2tpbmcnLCBxdWVyeV9hcmcsIHRva2VuICkgfHwgY29uc3VtZWQ7XG5cdFx0fVxuXHRcdGlmICggISBtb2R1bGVfcnVudGltZSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuZ2V0X2luc3RhbmNlICkge1xuXHRcdFx0cmV0dXJuIGNvbnN1bWVkO1xuXHRcdH1cblx0XHRleHRlbnNpb25faW5zdGFuY2VfaWRzLmZvckVhY2goIGZ1bmN0aW9uICggaW5zdGFuY2VfaWQgKSB7XG5cdFx0XHR2YXIgZXh0ZW5zaW9uX2luc3RhbmNlID0gbW9kdWxlX3J1bnRpbWUuZ2V0X2luc3RhbmNlKCBpbnN0YW5jZV9pZCApO1xuXG5cdFx0XHRpZiAoIGV4dGVuc2lvbl9pbnN0YW5jZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZXh0ZW5zaW9uX2luc3RhbmNlLmNvbnN1bWVfc2lnbmVkX2FjdGlvbl9jb250ZXh0ICkge1xuXHRcdFx0XHRjb25zdW1lZCA9IGV4dGVuc2lvbl9pbnN0YW5jZS5jb25zdW1lX3NpZ25lZF9hY3Rpb25fY29udGV4dCggJ25ld19ib29raW5nJywgcXVlcnlfYXJnLCB0b2tlbiApIHx8IGNvbnN1bWVkO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiBjb25zdW1lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWZyZXNoIHRoZSBjdXJyZW50IFRpbWVsaW5lIGV4YWN0bHkgb25jZSBhZnRlciBjYW5vbmljYWwgYm9va2luZyBjcmVhdGlvbi5cblx0ICpcblx0ICogVGhlIGN1cnJlbnQgd2luZG93IHNwYW4sIHpvb20sIGhvcml6b250YWwgYW5jaG9yLCBSZXNvdXJjZSBleHBhbnNpb24sIGFuZFxuXHQgKiBzZWxlY3Rpb24gc3RhdGUgcmVtYWluIG93bmVkIGJ5IHRoZSBzdGFuZGFyZCBmb3JlZ3JvdW5kIHJlcXVlc3QgbGlmZWN5Y2xlLlxuXHQgKiBBIHJldHJ5IHVzZXMgYSBuZXcgY29ycmVsYXRpb24gSUQgYW5kIGNhbiBvbmx5IHJlcGVhdCB0aGlzIHJlYWRiYWNrLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBDcmVhdGlvbiBkb21haW4ncyBleGVjdXRhYmxlLWZyZWUgbm90aWZpY2F0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX2Jvb2tpbmdfY3JlYXRpb25fY3JlYXRlZCggZXZlbnQgKSB7XG5cdFx0dmFyIGRldGFpbCA9IGV2ZW50ICYmIGV2ZW50LmRldGFpbCAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbCA6IHt9O1xuXHRcdHZhciByZXF1ZXN0X2lkID0gU3RyaW5nKCBkZXRhaWwucmVxdWVzdF9pZCB8fCAnJyApO1xuXHRcdHZhciBib29raW5nX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggZGV0YWlsLmJvb2tpbmdfaWQgKSB8fCAwICkgKTtcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCBkZXRhaWwucmVzb3VyY2VfaWQgKSB8fCAwICkgKTtcblx0XHR2YXIgYW5jaG9yO1xuXHRcdHZhciByZWFkYmFja19nZW5lcmF0aW9uO1xuXHRcdHZhciByZWFkYmFja19yZXF1ZXN0O1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBib29raW5nX2NyZWF0aW9uX2hvc3RfZW5hYmxlZFxuXHRcdFx0fHwgISBpc19pbml0aWFsaXplZFxuXHRcdFx0fHwgMSAhPT0gTnVtYmVyKCBkZXRhaWwuc2NoZW1hX3ZlcnNpb24gKVxuXHRcdFx0fHwgISAvXltBLVphLXowLTkuXy1dezEsMTkxfSQvLnRlc3QoIHJlcXVlc3RfaWQgKVxuXHRcdFx0fHwgISBib29raW5nX2lkXG5cdFx0XHR8fCAhIHJlc291cmNlX2lkXG5cdFx0XHR8fCByZXF1ZXN0X2lkID09PSBhY3RpdmVfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19pZFxuXHRcdFx0fHwgY29tcGxldGVkX2Jvb2tpbmdfY3JlYXRpb25fcmVhZGJhY2tfaWRzWyByZXF1ZXN0X2lkIF1cblx0XHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YWN0aXZlX2Jvb2tpbmdfY3JlYXRpb25fcmVhZGJhY2tfaWQgPSByZXF1ZXN0X2lkO1xuXHRcdGlmIChcblx0XHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXJcblx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyLnByZXBhcmVfY3JlYXRlZF9ib29raW5nX3JlYWRiYWNrXG5cdFx0KSB7XG5cdFx0XHRib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyLnByZXBhcmVfY3JlYXRlZF9ib29raW5nX3JlYWRiYWNrKCBib29raW5nX2lkICk7XG5cdFx0fVxuXHRcdGNvbnN1bWVfYm9va2luZ19jcmVhdGlvbl9zZWxlY3Rpb24oIGRldGFpbCApO1xuXHRcdGFuY2hvciA9IGNhcHR1cmVfYXhpc19hbmNob3IoKTtcblx0XHRyZWFkYmFja19nZW5lcmF0aW9uID0gYmVnaW5fYXV0aG9yaXRhdGl2ZV9yZWFkYmFjayggJ2Jvb2tpbmdfY3JlYXRpb24nICk7XG5cdFx0aW52YWxpZGF0ZV9hdmFpbGFiaWxpdHlfY2FjaGUoKTtcblx0XHRyZWFkYmFja19yZXF1ZXN0ID0gcmVxdWVzdF93aW5kb3coIGFkZF9jdXJyZW50X3dpbmRvd19zcGFuKCB7XG5cdFx0XHRhbmNob3JfYXQ6IGFuY2hvci5hdCxcblx0XHRcdGFuY2hvcl9yYXRpbzogYW5jaG9yLnJhdGlvLFxuXHRcdFx0d2luZG93X3Bvc2l0aW9uOiAwLFxuXHRcdFx0dmlldzogc2V0dGluZ3MuY3VycmVudF9heGlzID8gc2V0dGluZ3MuY3VycmVudF9heGlzLnZpZXcgOiBzZXR0aW5ncy5heGlzLnZpZXdcblx0XHR9LCB0cnVlICksIGFuY2hvciwgdHJ1ZSwge1xuXHRcdFx0bG9hZGluZzogc2V0dGluZ3MuaTE4bi5yZWxvYWRpbmdfdGltZWxpbmUsXG5cdFx0XHRjb21wbGV0ZTogc2V0dGluZ3MuaTE4bi5zdGF0dXNfcmVhZHksXG5cdFx0XHRwcmVzZXJ2ZV9zZWxlY3Rpb246IHRydWUsXG5cdFx0XHRzdXBwcmVzc19jb21wbGV0ZV9tZXNzYWdlOiB0cnVlXG5cdFx0fSApO1xuXHRcdHRyYWNrX2F1dGhvcml0YXRpdmVfcmVhZGJhY2soIHJlYWRiYWNrX3JlcXVlc3QsIHJlYWRiYWNrX2dlbmVyYXRpb24sICdib29raW5nX2NyZWF0aW9uJyApO1xuXHRcdGlmICggISByZWFkYmFja19yZXF1ZXN0IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiByZWFkYmFja19yZXF1ZXN0LmRvbmUgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHJlYWRiYWNrX3JlcXVlc3QuZmFpbCApIHtcblx0XHRcdGFjdGl2ZV9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkID0gJyc7XG5cdFx0XHRyZW1lbWJlcl9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkKCByZXF1ZXN0X2lkICk7XG5cdFx0XHRkaXNwYXRjaF9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX3Jlc3VsdCgge1xuXHRcdFx0XHRzY2hlbWFfdmVyc2lvbjogMSxcblx0XHRcdFx0cmVxdWVzdF9pZDogcmVxdWVzdF9pZCxcblx0XHRcdFx0c3RhdGU6ICdmYWlsZWQnLFxuXHRcdFx0XHRib29raW5nX2lkOiBib29raW5nX2lkLFxuXHRcdFx0XHRib29raW5nX3Zpc2libGU6IGZhbHNlXG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJlYWRiYWNrX3JlcXVlc3QuZG9uZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyIGJvb2tpbmdfdmlzaWJsZSA9IGZhbHNlO1xuXHRcdFx0dmFyIGNyZWF0aW9uX2luc3BlY3RvciA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctbmV3LWluc3BlY3Rvci1ob3N0XSBbZGF0YS13cGJjLXNoYXJlZC11aS1pbnNwZWN0b3JdJyApO1xuXG5cdFx0XHRpZiAoIHJlcXVlc3RfaWQgIT09IGFjdGl2ZV9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXJcblx0XHRcdFx0JiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIuY29tcGxldGVfY3JlYXRlZF9ib29raW5nX3JlYWRiYWNrXG5cdFx0XHQpIHtcblx0XHRcdFx0Ym9va2luZ192aXNpYmxlID0gYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlci5jb21wbGV0ZV9jcmVhdGVkX2Jvb2tpbmdfcmVhZGJhY2soIGJvb2tpbmdfaWQgKTtcblx0XHRcdH1cblx0XHRcdGFjdGl2ZV9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkID0gJyc7XG5cdFx0XHRyZW1lbWJlcl9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkKCByZXF1ZXN0X2lkICk7XG5cdFx0XHRkaXNwYXRjaF9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX3Jlc3VsdCgge1xuXHRcdFx0XHRzY2hlbWFfdmVyc2lvbjogMSxcblx0XHRcdFx0cmVxdWVzdF9pZDogcmVxdWVzdF9pZCxcblx0XHRcdFx0c3RhdGU6ICdhY2NlcHRlZCcsXG5cdFx0XHRcdGJvb2tpbmdfaWQ6IGJvb2tpbmdfaWQsXG5cdFx0XHRcdGJvb2tpbmdfdmlzaWJsZTogYm9va2luZ192aXNpYmxlXG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGJvb2tpbmdfdmlzaWJsZVxuXHRcdFx0XHQmJiB0cnVlID09PSBkZXRhaWwub3Blbl9ib29raW5nX2luc3BlY3RvclxuXHRcdFx0XHQmJiBib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyXG5cdFx0XHRcdCYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyLm9wZW5fY3JlYXRlZF9ib29raW5nX2luc3BlY3RvclxuXHRcdFx0KSB7XG5cdFx0XHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIub3Blbl9jcmVhdGVkX2Jvb2tpbmdfaW5zcGVjdG9yKCBib29raW5nX2lkICk7XG5cdFx0XHR9IGVsc2UgaWYgKFxuXHRcdFx0XHRib29raW5nX3Zpc2libGVcblx0XHRcdFx0JiYgY3JlYXRpb25faW5zcGVjdG9yXG5cdFx0XHRcdCYmIGNyZWF0aW9uX2luc3BlY3Rvci5oaWRkZW5cblx0XHRcdFx0JiYgYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlclxuXHRcdFx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlci5mb2N1c19jcmVhdGVkX2Jvb2tpbmdcblx0XHRcdCkge1xuXHRcdFx0XHRib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyLmZvY3VzX2NyZWF0ZWRfYm9va2luZyggYm9va2luZ19pZCApO1xuXHRcdFx0fVxuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoIHJlcXVlc3RfaWQgIT09IGFjdGl2ZV9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhY3RpdmVfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19pZCA9ICcnO1xuXHRcdFx0cmVtZW1iZXJfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19pZCggcmVxdWVzdF9pZCApO1xuXHRcdFx0ZGlzcGF0Y2hfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19yZXN1bHQoIHtcblx0XHRcdFx0c2NoZW1hX3ZlcnNpb246IDEsXG5cdFx0XHRcdHJlcXVlc3RfaWQ6IHJlcXVlc3RfaWQsXG5cdFx0XHRcdHN0YXRlOiAnZmFpbGVkJyxcblx0XHRcdFx0Ym9va2luZ19pZDogYm9va2luZ19pZCxcblx0XHRcdFx0Ym9va2luZ192aXNpYmxlOiBmYWxzZVxuXHRcdFx0fSApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWZyZXNoIHRoZSBjdXJyZW50IGNhbm9uaWNhbCB3aW5kb3cgYWZ0ZXIgYSBzdWNjZXNzZnVsIHJlc2l6ZSBBcHBseS5cblx0ICpcblx0ICogVGhlIHJldHVybmVkIHByb21pc2UgcmVwcmVzZW50cyBvbmx5IHJlYWRiYWNrLiBSZXRyeWluZyBpdCBjYW5ub3QgcmVwZWF0XG5cdCAqIHRoZSBhbHJlYWR5IGNvbXBsZXRlZCBtdXRhdGlvbi4gRXhpc3Rpbmcgd2luZG93IHNwYW4sIGhvcml6b250YWwgYW5jaG9yLFxuXHQgKiBib29raW5nIHNlbGVjdGlvbiwgYW5kIG5vcm1hbCByZW5kZXIgbGlmZWN5Y2xlIHJlbWFpbiBhdXRob3JpdGF0aXZlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IGpRdWVyeS1jb21wYXRpYmxlIHByb21pc2UgZm9yIGNhbm9uaWNhbCBUaW1lbGluZSByZWFkYmFjay5cblx0ICovXG5cdGZ1bmN0aW9uIHJlZnJlc2hfYWZ0ZXJfYm9va2luZ19yZXNpemVfYXBwbHkoKSB7XG5cdFx0dmFyIGFuY2hvciA9IGNhcHR1cmVfYXhpc19hbmNob3IoKTtcblx0XHR2YXIgcmVhZGJhY2tfZ2VuZXJhdGlvbiA9IGJlZ2luX2F1dGhvcml0YXRpdmVfcmVhZGJhY2soICdib29raW5nX2dlb21ldHJ5JyApO1xuXG5cdFx0aW52YWxpZGF0ZV9hdmFpbGFiaWxpdHlfY2FjaGUoKTtcblx0XHRyZXR1cm4gdHJhY2tfYXV0aG9yaXRhdGl2ZV9yZWFkYmFjayggcmVxdWVzdF93aW5kb3coIGFkZF9jdXJyZW50X3dpbmRvd19zcGFuKCB7XG5cdFx0XHRhbmNob3JfYXQ6IGFuY2hvci5hdCxcblx0XHRcdGFuY2hvcl9yYXRpbzogYW5jaG9yLnJhdGlvLFxuXHRcdFx0d2luZG93X3Bvc2l0aW9uOiAwLFxuXHRcdFx0dmlldzogc2V0dGluZ3MuY3VycmVudF9heGlzID8gc2V0dGluZ3MuY3VycmVudF9heGlzLnZpZXcgOiBzZXR0aW5ncy5heGlzLnZpZXdcblx0XHR9LCB0cnVlICksIGFuY2hvciwgdHJ1ZSwge1xuXHRcdFx0bG9hZGluZzogc2V0dGluZ3MuaTE4bi5yZWxvYWRpbmdfdGltZWxpbmUsXG5cdFx0XHRjb21wbGV0ZTogc2V0dGluZ3MuaTE4bi5zdGF0dXNfcmVhZHksXG5cdFx0XHRzdXBwcmVzc19jb21wbGV0ZV9tZXNzYWdlOiB0cnVlLFxuXHRcdFx0cHJlc2VydmVfc2VsZWN0aW9uOiB0cnVlXG5cdFx0fSApLCByZWFkYmFja19nZW5lcmF0aW9uLCAnYm9va2luZ19nZW9tZXRyeScgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgdGhlIGJvb2tpbmctaW50ZXJhY3Rpb25zIGNvbnRyb2xsZXIgdGhyb3VnaCB0aGUgbW9kdWxlIHJlZ2lzdHJ5LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYm9va2luZyBpbnRlcmFjdGlvbnMgaW5pdGlhbGl6ZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2Jvb2tpbmdfaW50ZXJhY3Rpb25zKCkge1xuXHRcdHZhciBtb2R1bGVfcnVudGltZSA9IHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXM7XG5cblx0XHRpZiAoXG5cdFx0XHQhIG1vZHVsZV9ydW50aW1lXG5cdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuaGFzX2ZhY3Rvcnlcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5jcmVhdGVcblx0XHRcdHx8ICEgbW9kdWxlX3J1bnRpbWUuaGFzX2ZhY3RvcnkoICdib29raW5nX2ludGVyYWN0aW9ucycgKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIgPSBtb2R1bGVfcnVudGltZS5jcmVhdGUoXG5cdFx0XHQnYm9va2luZ19pbnRlcmFjdGlvbnMnLFxuXHRcdFx0Ym9va2luZ19pbnRlcmFjdGlvbnNfaW5zdGFuY2VfaWQsXG5cdFx0XHR7XG5cdFx0XHRcdG1vdW50OiBtb3VudCxcblx0XHRcdFx0c2V0dGluZ3M6IHNldHRpbmdzLFxuXHRcdFx0XHRpc19lbXB0eV9yYW5nZV9yZXNpemluZzogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHJldHVybiBCb29sZWFuKCBlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlciAmJiBlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlci5pc19yZXNpemluZygpICk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlZnJlc2hfYWZ0ZXJfaW5zcGVjdG9yX3NhdmU6IHJlZnJlc2hfYWZ0ZXJfYm9va2luZ19pbnNwZWN0b3Jfc2F2ZSxcblx0XHRcdFx0cmVmcmVzaF9hZnRlcl9yZXNpemVfYXBwbHk6IHJlZnJlc2hfYWZ0ZXJfYm9va2luZ19yZXNpemVfYXBwbHksXG5cdFx0XHRcdHNjcm9sbF9heGlzX2Zyb21fZXh0ZXJuYWxfd2hlZWw6IHNjcm9sbF9heGlzX2Zyb21fZXh0ZXJuYWxfd2hlZWwsXG5cdFx0XHRcdGlzX2hvc3RfYWN0aXZlOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGlzX2luaXRpYWxpemVkO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXRfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQ6IHNldF9heGlzX3dpbmRvd19sb2FkaW5nX2xvY2tlZCxcblx0XHRcdFx0c2hvd19hZG1pbl9tZXNzYWdlOiBzaG93X3N0YW5kYXJkX2FkbWluX21lc3NhZ2Vcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0cmV0dXJuIEJvb2xlYW4oIGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUZW1wb3JhcmlseSBwcmV2ZW50IGxvYWRlZC13aW5kb3cgcHJvbW90aW9uIGFuZCBhZGphY2VudCByZWFkcy5cblx0ICpcblx0ICogUG9pbnRlciByZXNpemluZyBvd25zIGFuIGltbXV0YWJsZSBheGlzIHNuYXBzaG90LiBMb2NraW5nIGF0IGRyYWcgc3RhcnRcblx0ICogcHJldmVudHMgYXN5bmNocm9ub3VzIHdpbmRvdyBjb21wb3NpdGlvbiBmcm9tIGludmFsaWRhdGluZyB0aGF0IHNuYXBzaG90O1xuXHQgKiBldmVyeSB0ZWFyZG93biBwYXRoIHJlbGVhc2VzIHRoZSBsb2NrLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvY2tlZCBXaGV0aGVyIHJlc2l6ZSBvd25zIHRoZSBsb2FkZWQgYXhpcy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNldF9heGlzX3dpbmRvd19sb2FkaW5nX2xvY2tlZCggaXNfbG9ja2VkICkge1xuXHRcdGlzX2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkID0gQm9vbGVhbiggaXNfbG9ja2VkICk7XG5cdFx0aWYgKCBpc19heGlzX3dpbmRvd19sb2FkaW5nX2xvY2tlZCApIHtcblx0XHRcdGFib3J0X2VkZ2VfcmVxdWVzdHMoKTtcblx0XHRcdHN1c3BlbmRfYWRqYWNlbnRfbG9hZGluZ19mb3JfbmF2aWdhdGlvbigpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBEZXN0cm95IGFuZCBmb3JnZXQgdGhlIGV4dHJhY3RlZCBib29raW5nLWludGVyYWN0aW9ucyBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGVzdHJveV9ib29raW5nX2ludGVyYWN0aW9ucygpIHtcblx0XHR2YXIgbW9kdWxlX3J1bnRpbWUgPSB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzO1xuXG5cdFx0aWYgKCBtb2R1bGVfcnVudGltZSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuZGVzdHJveSApIHtcblx0XHRcdG1vZHVsZV9ydW50aW1lLmRlc3Ryb3koIGJvb2tpbmdfaW50ZXJhY3Rpb25zX2luc3RhbmNlX2lkICk7XG5cdFx0fSBlbHNlIGlmICggYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlci5kZXN0cm95ICkge1xuXHRcdFx0Ym9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlci5kZXN0cm95KCk7XG5cdFx0fVxuXHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIgPSBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFzayBib29raW5nIGludGVyYWN0aW9ucyB0byByZWNvbmNpbGUgY29udHJvbC1yYWlsIGdlb21ldHJ5IG5leHQgZnJhbWUuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzY2hlZHVsZV9ib29raW5nX2ludGVyYWN0aW9uX2xheW91dCgpIHtcblx0XHRpZiAoIGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyLnNjaGVkdWxlX2xheW91dCgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBBc2sgYm9va2luZyBpbnRlcmFjdGlvbnMgdG8gcmVjb25jaWxlIGdlb21ldHJ5IGFmdGVyIGF4aXMgbW90aW9uIHNldHRsZXMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzY2hlZHVsZV9ib29raW5nX2ludGVyYWN0aW9uX2xheW91dF9hZnRlcl9heGlzX21vdGlvbigpIHtcblx0XHRpZiAoIGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyLnNjaGVkdWxlX2xheW91dF9hZnRlcl9heGlzX21vdGlvbigpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSdW4gVGltZWxpbmUtb3duZWQgd29yayBhZnRlciBwYWlyZWQgUmVzb3VyY2UvY2FudmFzIHJvd3MgYXJlIHJlY29uY2lsZWQuXG5cdCAqXG5cdCAqIFRoZSByZW5kZXJpbmcgbW9kdWxlIG93bnMgcm93IG1lYXN1cmVtZW50LiBUaGUgcGFnZSBjb250cm9sbGVyIHJldGFpbnNcblx0ICogZWRnZS1zdGF0ZSBwb3NpdGlvbmluZywgc2hhcmVkIG92ZXJmbG93LXRvb2x0aXAgaW50ZWdyYXRpb24sIGFuZCBkZWxlZ2F0aW9uXG5cdCAqIHRvIHRoZSBpbmRlcGVuZGVudGx5IGV4dHJhY3RlZCBib29raW5nLWludGVyYWN0aW9ucyBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX3Jvd3Nfc3luY2hyb25pemVkKCkge1xuXHRcdHNjaGVkdWxlX292ZXJmbG93X3Rvb2x0aXBfc3luY2hyb25pemF0aW9uKCk7XG5cdFx0c3luY2hyb25pemVfZWRnZV9wbGFjZWhvbGRlcl9yb3dzKCk7XG5cdFx0c2NoZWR1bGVfZWRnZV9zdGF0dXNfcG9zaXRpb25pbmcoKTtcblx0XHRzY2hlZHVsZV9ib29raW5nX2ludGVyYWN0aW9uX2xheW91dCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgZXh0cmFjdGVkIHJlbmRlcmluZyBhbmQgcm93LXN5bmNocm9uaXphdGlvbiBjb250cm9sbGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIHJlbmRlcmluZyBtb2R1bGUgaW5pdGlhbGl6ZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX3JlbmRlcmluZygpIHtcblx0XHR2YXIgbW9kdWxlX3J1bnRpbWUgPSB3aW5kb3cud3BiY190aW1lbGluZV9tb2R1bGVzO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBtb2R1bGVfcnVudGltZVxuXHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIG1vZHVsZV9ydW50aW1lLmhhc19mYWN0b3J5XG5cdFx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgbW9kdWxlX3J1bnRpbWUuY3JlYXRlXG5cdFx0XHR8fCAhIG1vZHVsZV9ydW50aW1lLmhhc19mYWN0b3J5KCAncmVuZGVyaW5nJyApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmVuZGVyaW5nX2NvbnRyb2xsZXIgPSBtb2R1bGVfcnVudGltZS5jcmVhdGUoXG5cdFx0XHQncmVuZGVyaW5nJyxcblx0XHRcdHJlbmRlcmluZ19pbnN0YW5jZV9pZCxcblx0XHRcdHtcblx0XHRcdFx0bW91bnQ6IG1vdW50LFxuXHRcdFx0XHRzZXR0aW5nczogc2V0dGluZ3MsXG5cdFx0XHRcdGdldF90ZW1wbGF0ZTogZ2V0X3RlbXBsYXRlLFxuXHRcdFx0XHRiZWdpbl9ib29raW5nX3JlZnJlc2g6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoIGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRcdFx0XHRib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyLmJlZ2luX3JlZnJlc2goKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlZ2lzdGVyX2Jvb2tpbmdfc2VnbWVudDogZnVuY3Rpb24gKCBzZWdtZW50X2VsZW1lbnQsIHNlZ21lbnQsIHJlc291cmNlX3N1bW1hcnkgKSB7XG5cdFx0XHRcdFx0aWYgKCBib29raW5nX2ludGVyYWN0aW9uc19jb250cm9sbGVyICkge1xuXHRcdFx0XHRcdFx0Ym9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlci5yZWdpc3Rlcl9zZWdtZW50KCBzZWdtZW50X2VsZW1lbnQsIHNlZ21lbnQsIHJlc291cmNlX3N1bW1hcnkgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbXBsZXRlX2Jvb2tpbmdfcmVmcmVzaDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmICggYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlciApIHtcblx0XHRcdFx0XHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIuY29tcGxldGVfcmVmcmVzaCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0YWZ0ZXJfcm93X3N5bmNocm9uaXphdGlvbjogaGFuZGxlX3Jvd3Nfc3luY2hyb25pemVkLFxuXHRcdFx0XHRpc19ob3N0X2FjdGl2ZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHJldHVybiBpc19pbml0aWFsaXplZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRyZXR1cm4gQm9vbGVhbiggcmVuZGVyaW5nX2NvbnRyb2xsZXIgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXN0cm95IGFuZCBmb3JnZXQgdGhlIGV4dHJhY3RlZCByZW5kZXJpbmcgY29udHJvbGxlci5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGRlc3Ryb3lfcmVuZGVyaW5nKCkge1xuXHRcdHZhciBtb2R1bGVfcnVudGltZSA9IHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXM7XG5cblx0XHRpZiAoIG1vZHVsZV9ydW50aW1lICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBtb2R1bGVfcnVudGltZS5kZXN0cm95ICkge1xuXHRcdFx0bW9kdWxlX3J1bnRpbWUuZGVzdHJveSggcmVuZGVyaW5nX2luc3RhbmNlX2lkICk7XG5cdFx0fSBlbHNlIGlmICggcmVuZGVyaW5nX2NvbnRyb2xsZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlbmRlcmluZ19jb250cm9sbGVyLmRlc3Ryb3kgKSB7XG5cdFx0XHRyZW5kZXJpbmdfY29udHJvbGxlci5kZXN0cm95KCk7XG5cdFx0fVxuXHRcdHJlbmRlcmluZ19jb250cm9sbGVyID0gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgY3VycmVudCBhdXRob3JpemVkIHJvd3MgdGhyb3VnaCB0aGUgZXh0cmFjdGVkIHJlbmRlcmluZyBtb2R1bGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBpbml0aWFsIEF1dGhvcml6ZWQgUmVzb3VyY2UgYW5kIGJvb2tpbmcgcHJlc2VudGF0aW9uIERUT3MuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhdCBsZWFzdCBvbmUgUmVzb3VyY2Ugcm93IHdhcyByZW5kZXJlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9yb3dzKCBpbml0aWFsICkge1xuXHRcdHJldHVybiBCb29sZWFuKCByZW5kZXJpbmdfY29udHJvbGxlciAmJiByZW5kZXJpbmdfY29udHJvbGxlci5yZW5kZXJfcm93cyggaW5pdGlhbCApICk7XG5cdH1cblxuXHQvKipcblx0ICogQXNrIHRoZSByZW5kZXJpbmcgbW9kdWxlIHRvIG9ic2VydmUgY3VycmVudCByb3cgaGFsdmVzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb2JzZXJ2ZV9yZW5kZXJlZF9yb3dzKCkge1xuXHRcdGlmICggcmVuZGVyaW5nX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRyZW5kZXJpbmdfY29udHJvbGxlci5vYnNlcnZlX3Jvd3MoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQWRkIGZ1bGwtdGV4dCB0b29sdGlwcyBvbmx5IHRvIFRpbWVsaW5lIHRleHQgdGhhdCBpcyB2aXN1YWxseSBjbGlwcGVkLlxuXHQgKlxuXHQgKiBUaGUgc2hhcmVkIENhdGFsb2cgaGVscGVyIG93bnMgcmVuZGVyZWQtb3ZlcmZsb3cgbWVhc3VyZW1lbnQsIGtleWJvYXJkXG5cdCAqIGZvY3VzLCBCb29raW5nIENhbGVuZGFyIHRvb2x0aXAgaW5pdGlhbGl6YXRpb24sIGFuZCBuYXRpdmUtdGl0bGUgZmFsbGJhY2suXG5cdCAqIFRpbWVsaW5lIHRlbXBsYXRlcyBvcHQgaW4gYnkgcHJvdmlkaW5nIGF1dGhvcml6ZWQgcGxhaW4gdGV4dCB0aHJvdWdoIHRoZVxuXHQgKiBgZGF0YS13cGJjLXVpLWNhdGFsb2ctb3ZlcmZsb3ctdG9vbHRpcGAgYXR0cmlidXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0aW1lbGluZV9tb3VudCBUaW1lbGluZSBtb3VudCBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMoIHRpbWVsaW5lX21vdW50ICkge1xuXHRcdGlmICggISB0aW1lbGluZV9tb3VudCB8fCAhIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2NhdGFsb2cuc3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2luZG93LndwYmNfdWlfY2F0YWxvZy5zeW5jaHJvbml6ZV9vdmVyZmxvd190b29sdGlwcyggdGltZWxpbmVfbW91bnQgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBNZWFzdXJlIG92ZXJmbG93IGFmdGVyIFRpbWVsaW5lIHJvd3MgcmVhY2ggdGhlaXIgZmluYWwgY29uc3RyYWluZWQgd2lkdGguXG5cdCAqXG5cdCAqIFJvdyBzeW5jaHJvbml6YXRpb24gaXRzZWxmIHJ1bnMgaW4gYW4gYW5pbWF0aW9uIGZyYW1lLiBEZWZlcnJpbmcgdG9vbHRpcFxuXHQgKiBzeW5jaHJvbml6YXRpb24gYnkgb25lIGFkZGl0aW9uYWwgZnJhbWUgcHJldmVudHMgbWVhc3VyZW1lbnRzIGFnYWluc3QgdGhlXG5cdCAqIHRyYW5zaWVudCB3aWR0aCB1c2VkIHdoaWxlIFJlc291cmNlIGFuZCBjYW52YXMgcm93IGhlaWdodHMgYXJlIHJlY29uY2lsZWQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzY2hlZHVsZV9vdmVyZmxvd190b29sdGlwX3N5bmNocm9uaXphdGlvbigpIHtcblx0XHRpZiAoIG92ZXJmbG93X3Rvb2x0aXBfZnJhbWUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0b3ZlcmZsb3dfdG9vbHRpcF9mcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdG92ZXJmbG93X3Rvb2x0aXBfZnJhbWUgPSAwO1xuXHRcdFx0c3luY2hyb25pemVfb3ZlcmZsb3dfdG9vbHRpcHMoIG1vdW50ICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBUaW1lbGluZSBhZGphY2VudC1sb2FkaW5nIGxpbWl0cyB3aXRoIHNhZmUgbG9jYWwgZmFsbGJhY2tzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IE5vcm1hbGl6ZWQgbG9hZGluZyBsaW1pdHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfd2luZG93X2xvYWRpbmdfbGltaXRzKCkge1xuXHRcdHJldHVybiB3aW5kb3dfY2FjaGVfY29udHJvbGxlciA/IHdpbmRvd19jYWNoZV9jb250cm9sbGVyLmdldF9sb2FkaW5nX2xpbWl0cygpIDoge307XG5cdH1cblxuXG5cblxuXHQvKipcblx0ICogQWJvcnQgcGVuZGluZyBlZGdlIHJlYWRzIHdoZW4gdGhlIGF1dGhvcml0YXRpdmUgVGltZWxpbmUgY29udGV4dCBjaGFuZ2VzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYWJvcnRfZWRnZV9yZXF1ZXN0cygpIHtcblx0XHRpZiAoIHdpbmRvd19jYWNoZV9jb250cm9sbGVyICkge1xuXHRcdFx0d2luZG93X2NhY2hlX2NvbnRyb2xsZXIuYWJvcnRfZWRnZV9yZXF1ZXN0cygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNldCB0aGUgYm91bmRlZCBjYWNoZSBhcm91bmQgb25lIGF1dGhvcml0YXRpdmUgY3VycmVudCByZXNwb25zZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlIEF1dGhvcml6ZWQgd2luZG93IHJlc3BvbnNlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IE5vcm1hbGl6ZWQgY3VycmVudCBwYXlsb2FkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzZXRfd2luZG93X3N0b3JlKCByZXNwb25zZSApIHtcblx0XHRpZiAoIGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyICYmIGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyLmlzX2FjdGl2ZSgpICkge1xuXHRcdFx0ZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIucmVzZXQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIgPyB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5yZXNldCggcmVzcG9uc2UgKSA6IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogQWRkIG9uZSBhZGphY2VudCByZXNwb25zZSBvbmx5IHdoZW4gaXQgYmVsb25ncyB0byB0aGUgY3VycmVudCBSZXNvdXJjZSBzZXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBBdXRob3JpemVkIHdpbmRvdyByZXNwb25zZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGNhY2hlZC5cblx0ICovXG5cdGZ1bmN0aW9uIGNhY2hlX2FkamFjZW50X3dpbmRvdyggcmVzcG9uc2UgKSB7XG5cdFx0cmV0dXJuIHdpbmRvd19jYWNoZV9jb250cm9sbGVyID8gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuY2FjaGVfYWRqYWNlbnQoIHJlc3BvbnNlICkgOiBmYWxzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBLZWVwIG9ubHkgdGhlIHByZXZpb3VzLCBjdXJyZW50LCBhbmQgbmV4dCBjYWNoZWQgd2luZG93cy5cblx0ICpcblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgY2FjaGVkIHdpbmRvdyB3YXMgZXZpY3RlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHRyaW1fd2luZG93X3N0b3JlKCkge1xuXHRcdHJldHVybiB3aW5kb3dfY2FjaGVfY29udHJvbGxlciA/IHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnRyaW0oKSA6IGZhbHNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1hcCBvbmUgdGltZXN0YW1wIHRvIGZyYWN0aW9uYWwgdW5pdHMgb24gYW4gZXhwbGljaXQgRFNULWF3YXJlIGNlbGwgYXhpcy5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IHRpbWVzdGFtcCBFcG9jaCBzZWNvbmRzLlxuXHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IGNlbGxzIE9yZGVyZWQgYXhpcyBjZWxscy5cblx0ICogQHJldHVybiB7bnVtYmVyfSBGcmFjdGlvbmFsIGNlbGwgcG9zaXRpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXBfdGltZXN0YW1wX3RvX2F4aXNfcG9zaXRpb24oIHRpbWVzdGFtcCwgY2VsbHMgKSB7XG5cdFx0cmV0dXJuIHdpbmRvd19jYWNoZV9jb250cm9sbGVyID8gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIubWFwX3RpbWVzdGFtcF90b19heGlzX3Bvc2l0aW9uKCB0aW1lc3RhbXAsIGNlbGxzICkgOiAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlbGVnYXRlIGNvbXBvc2VkLWF4aXMgc2VsZWN0aW9uIGdlb21ldHJ5IHRvIHRoZSB3aW5kb3cvY2FjaGUgY29udHJvbGxlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGF4aXMgQ29tcG9zZWQgYXhpcyBEVE8uXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydF9lcG9jaCBJbmNsdXNpdmUgc2VsZWN0aW9uIHN0YXJ0LlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZW5kX2Vwb2NoIEV4Y2x1c2l2ZSBzZWxlY3Rpb24gZW5kLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEV4YWN0IGFuZCBjZWxsLWV4cGFuZGVkIHBlcmNlbnRhZ2UgZ2VvbWV0cnkuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfY29tcG9zZWRfc2VnbWVudF9nZW9tZXRyeSggYXhpcywgc3RhcnRfZXBvY2gsIGVuZF9lcG9jaCApIHtcblx0XHRyZXR1cm4gd2luZG93X2NhY2hlX2NvbnRyb2xsZXJcblx0XHRcdD8gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuZ2V0X2NvbXBvc2VkX3NlZ21lbnRfZ2VvbWV0cnkoIGF4aXMsIHN0YXJ0X2Vwb2NoLCBlbmRfZXBvY2ggKVxuXHRcdFx0OiB7fTtcblx0fVxuXG5cblx0LyoqXG5cdCAqIEJ1aWxkIG9uZSB0ZW1wbGF0ZS1yZWFkeSB2aWV3IG1vZGVsIGZyb20gdGhlIGJvdW5kZWQgY2FjaGUuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBDb21wb3NlZCB2aWV3IG9yIG51bGwgd2l0aG91dCBhIGN1cnJlbnQgd2luZG93LlxuXHQgKi9cblx0ZnVuY3Rpb24gY29tcG9zZV93aW5kb3dfc3RvcmUoKSB7XG5cdFx0cmV0dXJuIHdpbmRvd19jYWNoZV9jb250cm9sbGVyID8gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuY29tcG9zZSgpIDogbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBNaXJyb3Igb25seSB0aGUgbmF0aXZlIGJvZHkgc2Nyb2xsIG9mZnNldCBpbnRvIHRoZSBoZWFkZXIgdmlld3BvcnQuXG5cdCAqXG5cdCAqIFRoZSBkYXRlIGhlYWRlciBsaXZlcyBvdXRzaWRlIHRoZSBob3Jpem9udGFsIHNjcm9sbCBjb250YWluZXIgc28gaXQgY2FuXG5cdCAqIHJlbWFpbiBzdGlja3kgZHVyaW5nIGRvY3VtZW50IHNjcm9sbGluZy4gQm90aCBlbGVtZW50cyBpbmhlcml0IHRoZSBzYW1lXG5cdCAqIGRpcmVjdGlvbiwgYWxsb3dpbmcgdGhlIGJyb3dzZXIncyBuYXRpdmUgc2Nyb2xsTGVmdCBtb2RlbCB0byBzdGF5XG5cdCAqIGF1dGhvcml0YXRpdmUgaW4gbGVmdC10by1yaWdodCBhbmQgcmlnaHQtdG8tbGVmdCBpbnRlcmZhY2VzLiBUaGlzIGhvdCBwYXRoXG5cdCAqIGRlbGliZXJhdGVseSBwZXJmb3JtcyBubyBnZW9tZXRyeSByZWFkcywgYW5pbWF0aW9uLWZyYW1lIHNjaGVkdWxpbmcsIERPTVxuXHQgKiBtb3Zlcywgb3Igc3R5bGUgY2FsY3VsYXRpb247IENTUyBvd25zIGV2ZXJ5IHN0aWNreSBoZWFkZXIgYW5kIGxhYmVsLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfYXhpc19zY3JvbGwoKSB7XG5cdFx0dmFyIGNhbnZhcyA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWNhbnZhc10nICk7XG5cdFx0dmFyIGF4aXNfdmlld3BvcnQgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1heGlzLXZpZXdwb3J0XScgKTtcblxuXHRcdGlmICggISBjYW52YXMgfHwgISBheGlzX3ZpZXdwb3J0ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF4aXNfdmlld3BvcnQuc2Nyb2xsTGVmdCA9IGNhbnZhcy5zY3JvbGxMZWZ0O1xuXHR9XG5cblx0LyoqXG5cdCAqIFN1c3BlbmQgYXV0b21hdGljIGFkamFjZW50IGxvYWRpbmcgYmVmb3JlIGEgcHJvZ3JhbW1hdGljIGNhbnZhcyBwb3NpdGlvbi5cblx0ICpcblx0ICogUmVuZGVyaW5nLCByZXN0b3JpbmcgYW4gYW5jaG9yLCBvciBjaGFuZ2luZyB2aXN1YWwgZGVuc2l0eSBjYW4gcGxhY2UgYW5cblx0ICogZWRnZSBzZW50aW5lbCBpbnNpZGUgdGhlIHByZWZldGNoIHRocmVzaG9sZCB3aXRob3V0IHVzZXIgbmF2aWdhdGlvbi4gVGhlXG5cdCAqIG9ic2VydmVyIHJlbWFpbnMgY29ubmVjdGVkIGZvciBwcm94aW1pdHkgdHJhY2tpbmcsIGJ1dCBhbiBhZGphY2VudCByZWFkIGlzXG5cdCAqIG5vdCBwZXJtaXR0ZWQgdW50aWwgYSBsYXRlciBob3Jpem9udGFsIHVzZXIgaW50ZXJhY3Rpb24gc3VwcGxpZXMgaW50ZW50LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3VzcGVuZF9hZGphY2VudF9sb2FkaW5nX2Zvcl9uYXZpZ2F0aW9uKCkge1xuXHRcdGlmICggd2luZG93X2NhY2hlX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHR3aW5kb3dfY2FjaGVfY29udHJvbGxlci5zdXNwZW5kX2FkamFjZW50X2xvYWRpbmcoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVjb3JkIGRlbGliZXJhdGUgbmF2aWdhdGlvbiB0b3dhcmQgb25lIGFkamFjZW50IFRpbWVsaW5lIGVkZ2UuXG5cdCAqXG5cdCAqIEEgY2FuY2VsbGVkIG9yIGFscmVhZHktcmVxdWVzdGVkIGVkZ2UgcmVtYWlucyBibG9ja2VkIHVudGlsIGl0IGxlYXZlcyB0aGVcblx0ICogcmVhcm0gem9uZS4gRXhwbGljaXQgZWRnZSBidXR0b25zIG1heSBvdmVycmlkZSB0aGF0IGJsb2NrIGJlY2F1c2UgdGhleSBhcmVcblx0ICogYW4gdW5hbWJpZ3VvdXMgcmVxdWVzdCBmcm9tIHRoZSB1c2VyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZGlyZWN0aW9uIFByZXZpb3VzIG9yIG5leHQgZWRnZS5cblx0ICogQHBhcmFtIHtib29sZWFufSBmb3JjZSBXaGV0aGVyIGFuIGV4cGxpY2l0IGNvbnRyb2wgbWF5IGJ5cGFzcyByZWVudHJ5LlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGVkZ2UgYWNjZXB0ZWQgbmF2aWdhdGlvbiBpbnRlbnQuXG5cdCAqL1xuXHRmdW5jdGlvbiBhY3RpdmF0ZV9hZGphY2VudF9uYXZpZ2F0aW9uX2ludGVudCggZGlyZWN0aW9uLCBmb3JjZSApIHtcblx0XHRyZXR1cm4gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIgPyB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5hY3RpdmF0ZV9hZGphY2VudF9pbnRlbnQoIGRpcmVjdGlvbiwgZm9yY2UgKSA6IGZhbHNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1hcCBhIHBoeXNpY2FsIGhvcml6b250YWwgZ2VzdHVyZSB0byB0aGUgbG9naWNhbCBUaW1lbGluZSBlZGdlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gaG9yaXpvbnRhbF9kZWx0YSBTaWduZWQgd2hlZWwgb3IgdHJhY2twYWQgZGVsdGEuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gUHJldmlvdXMgb3IgbmV4dCBlZGdlLCBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfYWRqYWNlbnRfZGlyZWN0aW9uX2Zvcl9ob3Jpem9udGFsX2RlbHRhKCBob3Jpem9udGFsX2RlbHRhICkge1xuXHRcdGlmICggMCA9PT0gaG9yaXpvbnRhbF9kZWx0YSApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRpZiAoIDAgPiBob3Jpem9udGFsX2RlbHRhICkge1xuXHRcdFx0cmV0dXJuIHNldHRpbmdzLmlzX3J0bCA/ICduZXh0JyA6ICdwcmV2aW91cyc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHNldHRpbmdzLmlzX3J0bCA/ICdwcmV2aW91cycgOiAnbmV4dCc7XG5cdH1cblxuXHQvKipcblx0ICogUmVzb2x2ZSBob3Jpem9udGFsIGludGVudCBmcm9tIGEgd2hlZWwgb3IgdHJhY2twYWQgZ2VzdHVyZS5cblx0ICpcblx0ICogU2hpZnQgcGx1cyBhIHZlcnRpY2FsIG1vdXNlIHdoZWVsIGlzIHRyZWF0ZWQgYXMgaG9yaXpvbnRhbCBpbnB1dC4gTmF0aXZlXG5cdCAqIHRyYWNrcGFkIGdlc3R1cmVzIG11c3QgYmUgcHJlZG9taW5hbnRseSBob3Jpem9udGFsIHNvIG5vcm1hbCBkb2N1bWVudFxuXHQgKiBzY3JvbGxpbmcgaXMgbmV2ZXIgdHJhcHBlZCBieSB0aGUgVGltZWxpbmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2hlZWxFdmVudH0gZXZlbnQgQnJvd3NlciB3aGVlbCBldmVudC5cblx0ICogQHJldHVybiB7bnVtYmVyfSBTaWduZWQgaG9yaXpvbnRhbCBkZWx0YSwgb3IgemVybyBmb3IgdmVydGljYWwgaW50ZW50LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2hvcml6b250YWxfd2hlZWxfZGVsdGEoIGV2ZW50ICkge1xuXHRcdHZhciBkZWx0YV94ID0gTnVtYmVyKCBldmVudC5kZWx0YVggKSB8fCAwO1xuXHRcdHZhciBkZWx0YV95ID0gTnVtYmVyKCBldmVudC5kZWx0YVkgKSB8fCAwO1xuXG5cdFx0aWYgKCBldmVudC5zaGlmdEtleSAmJiBNYXRoLmFicyggZGVsdGFfeSApID4gTWF0aC5hYnMoIGRlbHRhX3ggKSApIHtcblx0XHRcdHJldHVybiBkZWx0YV95O1xuXHRcdH1cblx0XHRpZiAoIE1hdGguYWJzKCBkZWx0YV94ICkgPD0gTWF0aC5hYnMoIGRlbHRhX3kgKSApIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdHJldHVybiBkZWx0YV94O1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWNrIHdoZXRoZXIgYSBnZXN0dXJlIGlzIHB1c2hpbmcgcGFzdCBhIHZpc3VhbCBjYW52YXMgYm91bmRhcnkuXG5cdCAqXG5cdCAqIEJvdW5kaW5nIHJlY3RhbmdsZXMgYXZvaWQgYnJvd3Nlci1zcGVjaWZpYyBwb3NpdGl2ZSBhbmQgbmVnYXRpdmVcblx0ICogc2Nyb2xsTGVmdCBtb2RlbHMgaW4gcmlnaHQtdG8tbGVmdCBpbnRlcmZhY2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGNhbnZhcyBUaW1lbGluZSBob3Jpem9udGFsIHNjcm9sbCBjb250YWluZXIuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBob3Jpem9udGFsX2RlbHRhIFNpZ25lZCBob3Jpem9udGFsIGdlc3R1cmUgZGVsdGEuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgZ2VzdHVyZSBwb2ludHMgb3V0c2lkZSB0aGUgbG9hZGVkIGF4aXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBpc19vdXR3YXJkX2NhbnZhc19nZXN0dXJlKCBjYW52YXMsIGhvcml6b250YWxfZGVsdGEgKSB7XG5cdFx0dmFyIGNhbnZhc19ib2R5ID0gY2FudmFzLnF1ZXJ5U2VsZWN0b3IoICcud3BiY190aW1lbGluZV9fY2FudmFzX2JvZHknICk7XG5cdFx0dmFyIGNhbnZhc19yZWN0YW5nbGU7XG5cdFx0dmFyIGJvZHlfcmVjdGFuZ2xlO1xuXHRcdHZhciBib3VuZGFyeV90b2xlcmFuY2UgPSAyO1xuXG5cdFx0aWYgKCAhIGNhbnZhc19ib2R5IHx8IDAgPT09IGhvcml6b250YWxfZGVsdGEgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y2FudmFzX3JlY3RhbmdsZSA9IGNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRib2R5X3JlY3RhbmdsZSA9IGNhbnZhc19ib2R5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG5cdFx0aWYgKCAwID4gaG9yaXpvbnRhbF9kZWx0YSApIHtcblx0XHRcdHJldHVybiBib2R5X3JlY3RhbmdsZS5sZWZ0ID49IGNhbnZhc19yZWN0YW5nbGUubGVmdCAtIGJvdW5kYXJ5X3RvbGVyYW5jZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYm9keV9yZWN0YW5nbGUucmlnaHQgPD0gY2FudmFzX3JlY3RhbmdsZS5yaWdodCArIGJvdW5kYXJ5X3RvbGVyYW5jZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBLZWVwIG91dHdhcmQgVGltZWxpbmUgdHJhY2twYWQgbW9tZW50dW0gZnJvbSBiZWNvbWluZyBicm93c2VyIGhpc3RvcnkuXG5cdCAqXG5cdCAqIENTUyBvdmVyc2Nyb2xsIGNvbnRhaW5tZW50IGlzIHRoZSBwcmltYXJ5IHByb3RlY3Rpb24uIFRoaXMgbmFycm93XG5cdCAqIG5vbi1wYXNzaXZlIGZhbGxiYWNrIGNvdmVycyBicm93c2VycyB0aGF0IG1heSBzdGlsbCBleHBvc2UgaGlzdG9yeS1zd2lwZVxuXHQgKiBuYXZpZ2F0aW9uIGF0IGEgbmVzdGVkIGhvcml6b250YWwgc2Nyb2xsZXIgYm91bmRhcnkuIEl0IG5ldmVyIGNhbmNlbHNcblx0ICogdmVydGljYWwgc2Nyb2xsaW5nIG9yIGEgaG9yaXpvbnRhbCBnZXN0dXJlIHRoYXQgY2FuIHN0aWxsIG1vdmUgdGhlIGF4aXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2hlZWxFdmVudH0gZXZlbnQgQnJvd3NlciB3aGVlbCBldmVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNvbnRhaW5fY2FudmFzX2JvdW5kYXJ5X2dlc3R1cmUoIGV2ZW50ICkge1xuXHRcdHZhciBob3Jpem9udGFsX2RlbHRhO1xuXHRcdHZhciBkaXJlY3Rpb247XG5cdFx0dmFyIGlzX291dHdhcmRfZ2VzdHVyZTtcblxuXHRcdGlmICggISBldmVudC5jYW5jZWxhYmxlIHx8IGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQubWV0YUtleSB8fCBldmVudC5hbHRLZXkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aG9yaXpvbnRhbF9kZWx0YSA9IGdldF9ob3Jpem9udGFsX3doZWVsX2RlbHRhKCBldmVudCApO1xuXHRcdGlmICggISBob3Jpem9udGFsX2RlbHRhICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRkaXJlY3Rpb24gPSBnZXRfYWRqYWNlbnRfZGlyZWN0aW9uX2Zvcl9ob3Jpem9udGFsX2RlbHRhKCBob3Jpem9udGFsX2RlbHRhICk7XG5cdFx0YWN0aXZhdGVfYWRqYWNlbnRfbmF2aWdhdGlvbl9pbnRlbnQoIGRpcmVjdGlvbiwgZmFsc2UgKTtcblx0XHRpc19vdXR3YXJkX2dlc3R1cmUgPSBpc19vdXR3YXJkX2NhbnZhc19nZXN0dXJlKCBldmVudC5jdXJyZW50VGFyZ2V0LCBob3Jpem9udGFsX2RlbHRhICk7XG5cdFx0aWYgKCAhIGlzX291dHdhcmRfZ2VzdHVyZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXF1ZXN0X2FkamFjZW50X3dpbmRvdyggZGlyZWN0aW9uICk7XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0IG9uZSBob3Jpem9udGFsIHdoZWVsIGRlbHRhIHRvIENTUyBwaXhlbHMgZm9yIHByb2dyYW1tYXRpYyBzY3JvbGxpbmcuXG5cdCAqXG5cdCAqIFBpbm5lZCBib2R5LXBvcnRhbCBsYXllcnMgYXJlIG5vIGxvbmdlciBET00gZGVzY2VuZGFudHMgb2YgdGhlIFRpbWVsaW5lXG5cdCAqIGNhbnZhcywgc28gdGhlaXIgYWNjZXB0ZWQgaG9yaXpvbnRhbCBnZXN0dXJlIG11c3QgYmUgYXBwbGllZCBleHBsaWNpdGx5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge1doZWVsRXZlbnR9IGV2ZW50ICAgICAgICAgICAgQnJvd3NlciB3aGVlbCBldmVudC5cblx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICBob3Jpem9udGFsX2RlbHRhIFNpZ25lZCBob3Jpem9udGFsIGludGVudC5cblx0ICogQHJldHVybiB7bnVtYmVyfSBTaWduZWQgZGlzdGFuY2UgaW4gQ1NTIHBpeGVscy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9ob3Jpem9udGFsX3doZWVsX2Rpc3RhbmNlKCBldmVudCwgaG9yaXpvbnRhbF9kZWx0YSApIHtcblx0XHRpZiAoIDEgPT09IGV2ZW50LmRlbHRhTW9kZSApIHtcblx0XHRcdHJldHVybiBob3Jpem9udGFsX2RlbHRhICogMTY7XG5cdFx0fVxuXHRcdGlmICggMiA9PT0gZXZlbnQuZGVsdGFNb2RlICkge1xuXHRcdFx0cmV0dXJuIGhvcml6b250YWxfZGVsdGEgKiBNYXRoLm1heCggMSwgYXhpc19zY3JvbGxfY2FudmFzID8gYXhpc19zY3JvbGxfY2FudmFzLmNsaWVudFdpZHRoIDogMSApO1xuXHRcdH1cblxuXHRcdHJldHVybiBob3Jpem9udGFsX2RlbHRhO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGx5IGEgaG9yaXpvbnRhbCBnZXN0dXJlIGZyb20gYSB2aWV3cG9ydC1waW5uZWQgVGltZWxpbmUtb3duZWQgbGF5ZXIuXG5cdCAqXG5cdCAqIFRoZSBUaW1lbGluZSByZW1haW5zIHRoZSBzb2xlIGhvcml6b250YWwgc2Nyb2xsIGFuZCBhZGphY2VudC1sb2FkaW5nIG93bmVyLlxuXHQgKiBWZXJ0aWNhbCBnZXN0dXJlcyByZXR1cm4gZmFsc2Ugc28gdGhlIEJvb2tpbmcgT3ZlcnZpZXcgYm9keSBhbmQgV29yZFByZXNzXG5cdCAqIGRvY3VtZW50IHJldGFpbiB0aGVpciBuYXRpdmUgc2Nyb2xsIGNoYWluLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1doZWVsRXZlbnR9IGV2ZW50IEJyb3dzZXIgd2hlZWwgZXZlbnQgZnJvbSB0aGUgcGlubmVkIGxheWVyLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gVGltZWxpbmUgYWNjZXB0ZWQgdGhlIGhvcml6b250YWwgZ2VzdHVyZS5cblx0ICovXG5cdGZ1bmN0aW9uIHNjcm9sbF9heGlzX2Zyb21fZXh0ZXJuYWxfd2hlZWwoIGV2ZW50ICkge1xuXHRcdHZhciBob3Jpem9udGFsX2RlbHRhO1xuXHRcdHZhciBob3Jpem9udGFsX2Rpc3RhbmNlO1xuXHRcdHZhciBkaXJlY3Rpb247XG5cblx0XHRpZiAoXG5cdFx0XHQhIGF4aXNfc2Nyb2xsX2NhbnZhc1xuXHRcdFx0fHwgISBldmVudFxuXHRcdFx0fHwgISBldmVudC5jYW5jZWxhYmxlXG5cdFx0XHR8fCBldmVudC5jdHJsS2V5XG5cdFx0XHR8fCBldmVudC5tZXRhS2V5XG5cdFx0XHR8fCBldmVudC5hbHRLZXlcblx0XHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRob3Jpem9udGFsX2RlbHRhID0gZ2V0X2hvcml6b250YWxfd2hlZWxfZGVsdGEoIGV2ZW50ICk7XG5cdFx0aWYgKCAhIGhvcml6b250YWxfZGVsdGEgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGRpcmVjdGlvbiA9IGdldF9hZGphY2VudF9kaXJlY3Rpb25fZm9yX2hvcml6b250YWxfZGVsdGEoIGhvcml6b250YWxfZGVsdGEgKTtcblx0XHRhY3RpdmF0ZV9hZGphY2VudF9uYXZpZ2F0aW9uX2ludGVudCggZGlyZWN0aW9uLCBmYWxzZSApO1xuXHRcdGlmICggaXNfb3V0d2FyZF9jYW52YXNfZ2VzdHVyZSggYXhpc19zY3JvbGxfY2FudmFzLCBob3Jpem9udGFsX2RlbHRhICkgKSB7XG5cdFx0XHRyZXF1ZXN0X2FkamFjZW50X3dpbmRvdyggZGlyZWN0aW9uICk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRob3Jpem9udGFsX2Rpc3RhbmNlID0gZ2V0X2hvcml6b250YWxfd2hlZWxfZGlzdGFuY2UoIGV2ZW50LCBob3Jpem9udGFsX2RlbHRhICk7XG5cdFx0aG9yaXpvbnRhbF9kaXN0YW5jZSA9IHNldHRpbmdzLmlzX3J0bCA/IC1ob3Jpem9udGFsX2Rpc3RhbmNlIDogaG9yaXpvbnRhbF9kaXN0YW5jZTtcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBheGlzX3Njcm9sbF9jYW52YXMuc2Nyb2xsQnkgKSB7XG5cdFx0XHRheGlzX3Njcm9sbF9jYW52YXMuc2Nyb2xsQnkoIHtcblx0XHRcdFx0YmVoYXZpb3I6ICdhdXRvJyxcblx0XHRcdFx0bGVmdDogaG9yaXpvbnRhbF9kaXN0YW5jZSxcblx0XHRcdFx0dG9wOiAwXG5cdFx0XHR9ICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF4aXNfc2Nyb2xsX2NhbnZhcy5zY3JvbGxMZWZ0ICs9IGhvcml6b250YWxfZGlzdGFuY2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogTWFyayBwb2ludGVyLWRyaXZlbiBjYW52YXMgc2Nyb2xsaW5nIGFzIGRlbGliZXJhdGUgbmF2aWdhdGlvbi5cblx0ICpcblx0ICogVGhlIHN1YnNlcXVlbnQgc2Nyb2xsIGhhbmRsZXIgYWN0aXZhdGVzIG9ubHkgYSBuZWFyYnkgZWRnZS4gS2VlcGluZyB0aGlzXG5cdCAqIHNlc3Npb24gYWN0aXZlIGFsc28gY292ZXJzIHRvdWNoIG1vbWVudHVtIGFuZCBuYXRpdmUgc2Nyb2xsYmFyIGRyYWdnaW5nO1xuXHQgKiB0aGUgbmV4dCBwcm9ncmFtbWF0aWMgcG9zaXRpb25pbmcgb3BlcmF0aW9uIGNsZWFycyBpdC5cblx0ICpcblx0ICogQHBhcmFtIHtQb2ludGVyRXZlbnR9IGV2ZW50IENhbnZhcyBwb2ludGVyLWRvd24gZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2FudmFzX25hdmlnYXRpb25fcG9pbnRlcl9kb3duKCBldmVudCApIHtcblx0XHRpZiAoICdtb3VzZScgPT09IGV2ZW50LnBvaW50ZXJUeXBlICYmIDAgIT09IGV2ZW50LmJ1dHRvbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCB3aW5kb3dfY2FjaGVfY29udHJvbGxlciApIHtcblx0XHRcdHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnNldF9wb2ludGVyX25hdmlnYXRpb25fYWN0aXZlKCB0cnVlICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENvbm5lY3QgdGhlIGludGVyYWN0aXZlIGhvcml6b250YWwgc2Nyb2xsZXIgYW5kIGNvbnRhaW4gaXRzIGJvdW5kYXJpZXMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2F4aXNfc2Nyb2xsX3N5bmNocm9uaXphdGlvbigpIHtcblx0XHR2YXIgY2FudmFzID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtY2FudmFzXScgKTtcblxuXHRcdGlmICggISBjYW52YXMgfHwgYXhpc19zY3JvbGxfY2FudmFzICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF4aXNfc2Nyb2xsX2NhbnZhcyA9IGNhbnZhcztcblx0XHRkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xhc3NMaXN0LmFkZCggJ3dwYmNfdGltZWxpbmVfc2Nyb2xsX2NvbnRhaW5lZCcgKTtcblx0XHRkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoICd3cGJjX3RpbWVsaW5lX3Njcm9sbF9jb250YWluZWQnICk7XG5cdFx0Y2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBzeW5jaHJvbml6ZV9heGlzX3Njcm9sbCwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcblx0XHRjYW52YXMuYWRkRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIGhhbmRsZV93aW5kb3dfc3RvcmVfc2Nyb2xsLCB7IHBhc3NpdmU6IHRydWUgfSApO1xuXHRcdGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgc2NoZWR1bGVfZWRnZV9zdGF0dXNfcG9zaXRpb25pbmcsIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0Y2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBwb3NpdGlvbl9lbXB0eV9yYW5nZV9zZWxlY3Rpb25fcG9wb3ZlciwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcblx0XHRjYW52YXMuYWRkRXZlbnRMaXN0ZW5lciggJ3doZWVsJywgY29udGFpbl9jYW52YXNfYm91bmRhcnlfZ2VzdHVyZSwgeyBwYXNzaXZlOiBmYWxzZSB9ICk7XG5cdFx0Y2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoICdwb2ludGVyZG93bicsIGhhbmRsZV9jYW52YXNfbmF2aWdhdGlvbl9wb2ludGVyX2Rvd24sIHsgcGFzc2l2ZTogdHJ1ZSB9ICk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBzeW5jaHJvbml6ZV9heGlzX3Njcm9sbCApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncmVzaXplJywgc2NoZWR1bGVfZWRnZV9zdGF0dXNfcG9zaXRpb25pbmcgKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIHBvc2l0aW9uX2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9wb3BvdmVyICk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBzY2hlZHVsZV9lZGdlX3N0YXR1c19wb3NpdGlvbmluZywgeyBwYXNzaXZlOiB0cnVlIH0gKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIHBvc2l0aW9uX2VtcHR5X3JhbmdlX3NlbGVjdGlvbl9wb3BvdmVyLCB7IHBhc3NpdmU6IHRydWUgfSApO1xuXHRcdHN5bmNocm9uaXplX2F4aXNfc2Nyb2xsKCk7XG5cdH1cblxuXHQvKipcblx0ICogQXNrIHRoZSBleHRyYWN0ZWQgc2VsZWN0aW9uIGNvbnRyb2xsZXIgdG8gcmVjb25jaWxlIGl0cyBwb3BvdmVyIHBvc2l0aW9uLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcG9zaXRpb25fZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX3BvcG92ZXIoKSB7XG5cdFx0aWYgKCBlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlciApIHtcblx0XHRcdGVtcHR5X3JhbmdlX3NlbGVjdGlvbl9jb250cm9sbGVyLnBvc2l0aW9uX3BvcG92ZXIoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVXBkYXRlIHRoZSBzY3JlZW4tcmVhZGVyIHN0YXR1cyB3aXRob3V0IGluamVjdGluZyBtYXJrdXAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFN0YXR1cyBhbm5vdW5jZW1lbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBhbm5vdW5jZSggbWVzc2FnZSApIHtcblx0XHRpZiAoIHN0YXR1c19yZWdpb24gKSB7XG5cdFx0XHRzdGF0dXNfcmVnaW9uLnRleHRDb250ZW50ID0gbWVzc2FnZSB8fCAnJztcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogU2hvdyBvbmUgc3RhbmRhcmQgQm9va2luZyBDYWxlbmRhciBhZG1pbmlzdHJhdGlvbiBtZXNzYWdlLlxuXHQgKlxuXHQgKiBUaGUgZ2xvYmFsIG1lc3NhZ2UgQVBJIG93bnMgaXRzIG1hcmt1cCwgaWNvbm9ncmFwaHksIHJlcGxhY2VtZW50IGJlaGF2aW9yLFxuXHQgKiBhbmQgdGltZW91dC4gVGltZWxpbmUgc3VwcGxpZXMgb25seSB0cmFuc2xhdGVkIHRleHQgYW5kIHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUcmFuc2xhdGVkIG1lc3NhZ2UgdGV4dC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VfdHlwZSBTdGFuZGFyZCBtZXNzYWdlIHR5cGUuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBkZWxheSBEaXNwbGF5IGR1cmF0aW9uIGluIG1pbGxpc2Vjb25kcy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSggbWVzc2FnZSwgbWVzc2FnZV90eXBlLCBkZWxheSApIHtcblx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBlc2NhcGVfYWRtaW5fbWVzc2FnZV90ZXh0KCBtZXNzYWdlICksIG1lc3NhZ2VfdHlwZSwgZGVsYXksIGZhbHNlICk7XG5cdH1cblxuXHQvKipcblx0ICogRXNjYXBlIG9uZSBwbGFpbi10ZXh0IGFkbWluaXN0cmF0aW9uIG1lc3NhZ2UgZm9yIHRoZSBsZWdhY3kgSFRNTCBub3RpY2UgQVBJLlxuXHQgKlxuXHQgKiBUaW1lbGluZSBhbmQgaXRzIGRvbWFpbiBhZGFwdGVycyBwcm92aWRlIHRleHQsIHdoaWxlXG5cdCAqIGB3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSgpYCBhY2NlcHRzIGFuIEhUTUwgc3RyaW5nIHNvIGl0IGNhbiBwcmVwZW5kIHRoZVxuXHQgKiBzdGFuZGFyZCBpY29uLiBFc2NhcGluZyBhdCB0aGlzIHNoYXJlZCBib3VuZGFyeSBwcmV2ZW50cyBhbiBBSkFYIGVycm9yIG9yXG5cdCAqIHRyYW5zbGF0ZWQgbGFiZWwgZnJvbSBiZWNvbWluZyBleGVjdXRhYmxlIG5vdGljZSBtYXJrdXAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFBsYWluLXRleHQgbWVzc2FnZS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBIVE1MLXNhZmUgbWVzc2FnZSB0ZXh0LlxuXHQgKi9cblx0ZnVuY3Rpb24gZXNjYXBlX2FkbWluX21lc3NhZ2VfdGV4dCggbWVzc2FnZSApIHtcblx0XHRyZXR1cm4gU3RyaW5nKCBtZXNzYWdlIHx8ICcnIClcblx0XHRcdC5yZXBsYWNlKCAvJi9nLCAnJmFtcDsnIClcblx0XHRcdC5yZXBsYWNlKCAvPC9nLCAnJmx0OycgKVxuXHRcdFx0LnJlcGxhY2UoIC8+L2csICcmZ3Q7JyApXG5cdFx0XHQucmVwbGFjZSggL1wiL2csICcmcXVvdDsnIClcblx0XHRcdC5yZXBsYWNlKCAvJy9nLCAnJiMwMzk7JyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlY29uY2lsZSBhbGwgVGltZWxpbmUtb3duZWQgYnVzeSBwaGFzZXMgaW50byBvbmUgYmxvY2tpbmcgb3ZlcmxheS5cblx0ICpcblx0ICogQXZhaWxhYmlsaXR5IGFwcGx5LCBjYW5vbmljYWwgYm9va2luZyByZWZyZXNoLCBhbmQgbGF6eSB1bmF2YWlsYWJsZS10aW1lXG5cdCAqIHJlYWRzIGNhbiBvdmVybGFwLiBJbmRlcGVuZGVudCBzaG93L2hpZGUgY2FsbHMgd291bGQgZXhwb3NlIGFuIGluY29tcGxldGVcblx0ICogVGltZWxpbmUgYmV0d2VlbiB0aG9zZSBwaGFzZXMsIHNvIGVhY2ggcGhhc2Ugb3ducyBhIGhvbGQgYW5kIHRoaXMgZnVuY3Rpb25cblx0ICogY2xvc2VzIHRoZSBvdmVybGF5IG9ubHkgYWZ0ZXIgZXZlcnkgaG9sZCBpcyByZWxlYXNlZC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHVwZGF0ZV90aW1lbGluZV9ibG9ja2luZ19sb2FkaW5nX3N0YXRlKCkge1xuXHRcdHZhciBvdmVybGF5ID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVxdWVzdC1vdmVybGF5XScgKTtcblx0XHR2YXIgb3ZlcmxheV9tZXNzYWdlID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVxdWVzdC1vdmVybGF5LW1lc3NhZ2VdJyApO1xuXHRcdHZhciB0b29sYmFyX2NvbnRyb2xzID0gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtdG9vbGJhcl0gYnV0dG9uLCBbZGF0YS13cGJjLXRpbWVsaW5lLXRvb2xiYXJdIHNlbGVjdCwgW2RhdGEtd3BiYy10aW1lbGluZS10b29sYmFyXSBpbnB1dCcgKTtcblx0XHR2YXIgYmxvY2tpbmdfc3VyZmFjZXMgPSBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS10b29sYmFyXSwgLndwYmNfdGltZWxpbmVfX3N0aWNreV9oZWFkZXIsIC53cGJjX3RpbWVsaW5lX19ib2R5LCBbZGF0YS13cGJjLXRpbWVsaW5lLXN0YXRlXScgKTtcblx0XHR2YXIgaXNfbG9hZGluZyA9IGlzX3NlbGVjdGlvbl9hcHBseV9sb2FkaW5nIHx8IGlzX2ZvcmVncm91bmRfcmVxdWVzdF9sb2FkaW5nIHx8IGlzX2F2YWlsYWJpbGl0eV9sb2FkaW5nO1xuXHRcdHZhciBtZXNzYWdlID0gaXNfc2VsZWN0aW9uX2FwcGx5X2xvYWRpbmdcblx0XHRcdD8gc2VsZWN0aW9uX2FwcGx5X2xvYWRpbmdfbWVzc2FnZVxuXHRcdFx0OiAoIGlzX2ZvcmVncm91bmRfcmVxdWVzdF9sb2FkaW5nID8gZm9yZWdyb3VuZF9yZXF1ZXN0X2xvYWRpbmdfbWVzc2FnZSA6IHNldHRpbmdzLmkxOG4ubG9hZGluZ19hdmFpbGFiaWxpdHlfYmFja2dyb3VuZHMgKTtcblx0XHR2YXIgZm9jdXNfdG9fcmVzdG9yZTtcblxuXHRcdGlmICggYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlciApIHtcblx0XHRcdGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIuc2V0X3JlcXVlc3RfbG9hZGluZyggaXNfbG9hZGluZyApO1xuXHRcdH1cblx0XHRtb3VudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtcmVxdWVzdC1sb2FkaW5nJywgaXNfbG9hZGluZyApO1xuXHRcdG1vdW50LnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsIGlzX2xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0aWYgKCBvdmVybGF5ICkge1xuXHRcdFx0b3ZlcmxheS5oaWRkZW4gPSAhIGlzX2xvYWRpbmc7XG5cdFx0XHRvdmVybGF5LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgaXNfbG9hZGluZyA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHR9XG5cdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggYmxvY2tpbmdfc3VyZmFjZXMsIGZ1bmN0aW9uICggYmxvY2tpbmdfc3VyZmFjZSApIHtcblx0XHRcdGlmICggaXNfbG9hZGluZyApIHtcblx0XHRcdFx0YmxvY2tpbmdfc3VyZmFjZS5zZXRBdHRyaWJ1dGUoICdpbmVydCcsICcnICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRibG9ja2luZ19zdXJmYWNlLnJlbW92ZUF0dHJpYnV0ZSggJ2luZXJ0JyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRpZiAoIGlzX2xvYWRpbmcgKSB7XG5cdFx0XHRpZiAoIG92ZXJsYXlfbWVzc2FnZSApIHtcblx0XHRcdFx0b3ZlcmxheV9tZXNzYWdlLnRleHRDb250ZW50ID0gbWVzc2FnZSB8fCBzZXR0aW5ncy5pMThuLmxvYWRpbmc7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgZm9yZWdyb3VuZF9yZXF1ZXN0X2ZvY3VzICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgJiYgbW91bnQuY29udGFpbnMoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKSApIHtcblx0XHRcdFx0Zm9yZWdyb3VuZF9yZXF1ZXN0X2ZvY3VzID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblx0XHRcdH1cblx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIHRvb2xiYXJfY29udHJvbHMsIGZ1bmN0aW9uICggdG9vbGJhcl9jb250cm9sICkge1xuXHRcdFx0XHR0b29sYmFyX2NvbnRyb2wuZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIHRvb2xiYXJfY29udHJvbHMsIGZ1bmN0aW9uICggdG9vbGJhcl9jb250cm9sICkge1xuXHRcdFx0dG9vbGJhcl9jb250cm9sLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0fSApO1xuXHRcdGlmICggdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHR0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlci5yZWZyZXNoX2FmdGVyX3dpbmRvd19yZW5kZXIoKTtcblx0XHR9XG5cdFx0Zm9jdXNfdG9fcmVzdG9yZSA9IGZvcmVncm91bmRfcmVxdWVzdF9mb2N1cztcblx0XHRmb3JlZ3JvdW5kX3JlcXVlc3RfZm9jdXMgPSBudWxsO1xuXHRcdGlmICggZm9jdXNfdG9fcmVzdG9yZSAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGZvY3VzX3RvX3Jlc3RvcmUgKSApIHtcblx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCAhIGlzX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGZvY3VzX3RvX3Jlc3RvcmUuZm9jdXMoIHsgcHJldmVudFNjcm9sbDogdHJ1ZSB9ICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHRmb2N1c190b19yZXN0b3JlLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVG9nZ2xlIHRoZSBzdGF0ZS1jaGFuZ2luZyBBdmFpbGFiaWxpdHktYXBwbHkgaG9sZC5cblx0ICpcblx0ICogVGhlIHJlcXVlc3QgaXMgaW50ZW50aW9uYWxseSBub3QgY2FuY2VsbGFibGUgYWZ0ZXIgc3VibWlzc2lvbjogYWJvcnRpbmcgYVxuXHQgKiBicm93c2VyIHRyYW5zcG9ydCBjYW5ub3QgcHJvdmUgdGhhdCB0aGUgc2VydmVyIG11dGF0aW9uIGRpZCBub3QgY29tcGxldGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfbG9hZGluZyBXaGV0aGVyIGFuIEF2YWlsYWJpbGl0eSBhcHBseSBpcyBhY3RpdmUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgbWVzc2FnZSAgICBWaXNpYmxlIHRyYW5zbGF0ZWQgc3RhdHVzIHRleHQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzZXRfc2VsZWN0aW9uX2FwcGx5X2xvYWRpbmcoIGlzX2xvYWRpbmcsIG1lc3NhZ2UgKSB7XG5cdFx0aXNfc2VsZWN0aW9uX2FwcGx5X2xvYWRpbmcgPSBCb29sZWFuKCBpc19sb2FkaW5nICk7XG5cdFx0c2VsZWN0aW9uX2FwcGx5X2xvYWRpbmdfbWVzc2FnZSA9IGlzX3NlbGVjdGlvbl9hcHBseV9sb2FkaW5nXG5cdFx0XHQ/ICggbWVzc2FnZSB8fCBzZXR0aW5ncy5pMThuLmFwcGx5aW5nX2F2YWlsYWJpbGl0eSB8fCBzZXR0aW5ncy5pMThuLmxvYWRpbmcgKVxuXHRcdFx0OiAnJztcblx0XHRpZiAoIGlzX3NlbGVjdGlvbl9hcHBseV9sb2FkaW5nICkge1xuXHRcdFx0YW5ub3VuY2UoIHNlbGVjdGlvbl9hcHBseV9sb2FkaW5nX21lc3NhZ2UgKTtcblx0XHR9XG5cdFx0dXBkYXRlX3RpbWVsaW5lX2Jsb2NraW5nX2xvYWRpbmdfc3RhdGUoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUb2dnbGUgdGhlIGZvcmVncm91bmQgYmxvY2tpbmcgb3ZlcmxheSBhbmQgcmVxdWVzdCBjb250cm9scy5cblx0ICpcblx0ICogQWRqYWNlbnQtd2luZG93IHByZWZldGNoZXMgZGVsaWJlcmF0ZWx5IHVzZSB0aGVpciBleGlzdGluZyBpbmxpbmUgZWRnZVxuXHQgKiBzdGF0ZSBpbnN0ZWFkLiBUaGlzIGZvcmVncm91bmQgc3RhdGUgaXMgcmVzZXJ2ZWQgZm9yIGFjdGlvbnMgdGhhdCByZXBsYWNlXG5cdCAqIHRoZSBjdXJyZW50IGF1dGhvcml6ZWQgd2luZG93IHNvIGF1dG9tYXRpYyBzY3JvbGxpbmcgZG9lcyBub3QgcmVwZWF0ZWRseVxuXHQgKiBvYnNjdXJlIHRoZSB3b3JraW5nIFRpbWVsaW5lIG9yIGFubm91bmNlIGR1cGxpY2F0ZSBsb2FkaW5nIG1lc3NhZ2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2xvYWRpbmcgV2hldGhlciBhIGZvcmVncm91bmQgcmVxdWVzdCBpcyBhY3RpdmUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFZpc2libGUgYW5kIHNjcmVlbi1yZWFkZXIgbG9hZGluZyBtZXNzYWdlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZ2VuZXJhdGlvbiBSZXF1ZXN0IGdlbmVyYXRpb24gdGhhdCBvd25zIHRoZSBzdGF0ZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNldF9mb3JlZ3JvdW5kX3JlcXVlc3RfbG9hZGluZyggaXNfbG9hZGluZywgbWVzc2FnZSwgZ2VuZXJhdGlvbiApIHtcblx0XHRpZiAoICEgaXNfbG9hZGluZyAmJiBnZW5lcmF0aW9uICYmIHdpbmRvd19jYWNoZV9jb250cm9sbGVyICYmICEgd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuaXNfZm9yZWdyb3VuZF9nZW5lcmF0aW9uX2N1cnJlbnQoIGdlbmVyYXRpb24gKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aXNfZm9yZWdyb3VuZF9yZXF1ZXN0X2xvYWRpbmcgPSBCb29sZWFuKCBpc19sb2FkaW5nICk7XG5cdFx0Zm9yZWdyb3VuZF9yZXF1ZXN0X2xvYWRpbmdfbWVzc2FnZSA9IGlzX2ZvcmVncm91bmRfcmVxdWVzdF9sb2FkaW5nID8gKCBtZXNzYWdlIHx8IHNldHRpbmdzLmkxOG4ubG9hZGluZyApIDogJyc7XG5cdFx0aWYgKCBpc19sb2FkaW5nICkge1xuXHRcdFx0YW5ub3VuY2UoIG1lc3NhZ2UgfHwgc2V0dGluZ3MuaTE4bi5sb2FkaW5nICk7XG5cdFx0fVxuXHRcdHVwZGF0ZV90aW1lbGluZV9ibG9ja2luZ19sb2FkaW5nX3N0YXRlKCk7XG5cdH1cblxuXHQvKipcblx0ICogRGVsZWdhdGUgb25lIFJlc291cmNlLWRldGFpbHMgZXhwYW5zaW9uIHRvIHRoZSByZW5kZXJpbmcgbW9kdWxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gIHJvd19rZXkgICAgIFN0YWJsZSByb3cgaWRlbnRpZmllci5cblx0ICogQHBhcmFtIHtib29sZWFufSBpc19leHBhbmRlZCBEZXNpcmVkIGRldGFpbHMgc3RhdGUuXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdHJpZ2dlciAgICAgVG9nZ2xlIHRoYXQgaW5pdGlhdGVkIHRoZSBjaGFuZ2UuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzZXRfcm93X2V4cGFuZGVkKCByb3dfa2V5LCBpc19leHBhbmRlZCwgdHJpZ2dlciApIHtcblx0XHRpZiAoIHJlbmRlcmluZ19jb250cm9sbGVyICkge1xuXHRcdFx0cmVuZGVyaW5nX2NvbnRyb2xsZXIuc2V0X3Jvd19leHBhbmRlZCggcm93X2tleSwgaXNfZXhwYW5kZWQsIHRyaWdnZXIgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogRGVsZWdhdGUgb25lIGNhcGFjaXR5LXBhcmVudCBleHBhbnNpb24gdG8gdGhlIHJlbmRlcmluZyBtb2R1bGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSAgcGFyZW50X2lkICAgQXV0aG9yaXplZCBwYXJlbnQgUmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfZXhwYW5kZWQgRGVzaXJlZCBjaGlsZCB2aXNpYmlsaXR5LlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRyaWdnZXIgICAgIEhpZXJhcmNoeSB0b2dnbGUgdGhhdCBpbml0aWF0ZWQgdGhlIGNoYW5nZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNldF9oaWVyYXJjaHlfZXhwYW5kZWQoIHBhcmVudF9pZCwgaXNfZXhwYW5kZWQsIHRyaWdnZXIgKSB7XG5cdFx0aWYgKCByZW5kZXJpbmdfY29udHJvbGxlciApIHtcblx0XHRcdHJlbmRlcmluZ19jb250cm9sbGVyLnNldF9oaWVyYXJjaHlfZXhwYW5kZWQoIHBhcmVudF9pZCwgaXNfZXhwYW5kZWQsIHRyaWdnZXIgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogTG9jYXRlIHRoZSBheGlzIGNlbGwgbmVhcmVzdCB0aGUgdmlzaWJsZSBob3Jpem9udGFsIGNlbnRlci5cblx0ICpcblx0ICogQm91bmRpbmcgcmVjdGFuZ2xlcyBhdm9pZCBhc3N1bXB0aW9ucyBhYm91dCBicm93c2VyLXNwZWNpZmljIFJUTFxuXHQgKiBzY3JvbGxMZWZ0IHNpZ25zLiBUaGUgcmV0dXJuZWQgc2VydmVyIGluc3RhbnQgYWx3YXlzIGluY2x1ZGVzIGFuIG9mZnNldC5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fSBBbmNob3IgaW5zdGFudCBhbmQgdmlld3BvcnQgcmF0aW8uXG5cdCAqL1xuXHRmdW5jdGlvbiBjYXB0dXJlX2F4aXNfYW5jaG9yKCkge1xuXHRcdHJldHVybiB3aW5kb3dfY2FjaGVfY29udHJvbGxlclxuXHRcdFx0PyB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5jYXB0dXJlX2F4aXNfYW5jaG9yKClcblx0XHRcdDogeyBhdDogc2V0dGluZ3MuYXhpcy5hbmNob3IuYXQsIHJhdGlvOiAwLjUsIHJlc3RvcmVfZm9jdXM6IGZhbHNlIH07XG5cdH1cblxuXG5cblx0LyoqXG5cdCAqIERlbGVnYXRlIHBoeXNpY2FsIGFuY2hvciByZXN0b3JhdGlvbiB0byB0aGUgd2luZG93L2NhY2hlIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBhbmNob3IgQ2FwdHVyZWQgYW5jaG9yIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ8bnVsbH0gUmVtYWluaW5nIHBoeXNpY2FsIGFsaWdubWVudCBlcnJvci5cblx0ICovXG5cdGZ1bmN0aW9uIHJlc3RvcmVfYXhpc19hbmNob3IoIGFuY2hvciApIHtcblx0XHRyZXR1cm4gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIgPyB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5yZXN0b3JlX2F4aXNfYW5jaG9yKCBhbmNob3IgKSA6IG51bGw7XG5cdH1cblxuXHQvKipcblx0ICogQ2FuY2VsIGFuIG9ic29sZXRlIHBvc3QtcmVuZGVyIGFuY2hvciByZXN0b3JhdGlvbi5cblx0ICpcblx0ICogQSBuZXdlciBUaW1lbGluZSByZW5kZXIgb3ducyB0aGUgY2FudmFzIHBvc2l0aW9uLiBJbmNyZW1lbnRpbmcgdGhlXG5cdCAqIGdlbmVyYXRpb24gcHJldmVudHMgYSBjYWxsYmFjayBxdWV1ZWQgYnkgYW4gb2xkZXIgcmVzcG9uc2UgZnJvbSBtb3ZpbmcgaXQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjYW5jZWxfYXhpc19hbmNob3JfcmVzdG9yYXRpb24oKSB7XG5cdFx0aWYgKCB3aW5kb3dfY2FjaGVfY29udHJvbGxlciApIHtcblx0XHRcdHdpbmRvd19jYWNoZV9jb250cm9sbGVyLmNhbmNlbF9hbmNob3JfcmVzdG9yYXRpb24oKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVzdG9yZSBhbmQgdmVyaWZ5IG9uZSBwb3N0LXJlbmRlciBhbmNob3IgYWZ0ZXIgaG9yaXpvbnRhbCBsYXlvdXQgc2V0dGxlcy5cblx0ICpcblx0ICogRWRnZSBwbGFjZWhvbGRlcnMgYW5kIHN5bmNocm9uaXplZCBSZXNvdXJjZSByb3dzIGNhbiBmaW5pc2ggdGhlaXIgZmxleFxuXHQgKiBtZWFzdXJlbWVudHMgYWZ0ZXIgdGhlIGZpcnN0IHBhaW50LiBBdCBsZWFzdCB0d28gZnJhbWVzIGFyZSB0aGVyZWZvcmVcblx0ICogY2hlY2tlZCwgYW5kIGEgYm91bmRlZCByZXRyeSBjb3JyZWN0cyBhbnkgcmVtYWluaW5nIHBoeXNpY2FsIG9mZnNldC4gVGhpc1xuXHQgKiBpcyBlc3BlY2lhbGx5IGltcG9ydGFudCBmb3IgZXhhY3QgY3VzdG9tLXJhbmdlIHN0YXJ0cywgd2hlcmUgZXZlbiBvbmVcblx0ICogdmlzaWJsZSBwbGFjZWhvbGRlciBjZWxsIHdvdWxkIG1pc3JlcHJlc2VudCB0aGUgc2VsZWN0ZWQgcmFuZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgIGFuY2hvciAgICAgIENhcHR1cmVkIGFuY2hvciBzdGF0ZS5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gb25fY29tcGxldGUgQ2FsbGJhY2sgYWZ0ZXIgcmVzdG9yYXRpb24gb3IgYm91bmRlZCByZXRyeSBleGhhdXN0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfYXhpc19hbmNob3JfcmVzdG9yYXRpb24oIGFuY2hvciwgb25fY29tcGxldGUgKSB7XG5cdFx0aWYgKCB3aW5kb3dfY2FjaGVfY29udHJvbGxlciApIHtcblx0XHRcdHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnNjaGVkdWxlX2FuY2hvcl9yZXN0b3JhdGlvbiggYW5jaG9yLCBvbl9jb21wbGV0ZSApO1xuXHRcdH1cblx0fVxuXG5cblx0LyoqXG5cdCAqIFJlc29sdmUgYSByZXF1ZXN0ZWQgZGF0ZSBhZ2FpbnN0IGEgbmV3bHkgYXV0aG9yaXplZCBzZXJ2ZXIgYXhpcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGFuY2hvciBSZXF1ZXN0ZWQgbmF2aWdhdGlvbiBhbmNob3IuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBheGlzICAgU2VydmVyLWF1dGhvcml0YXRpdmUgYXhpcyBEVE8uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgcmVxdWVzdGVkIGNhbGVuZGFyIGRhdGUgd2FzIHJlc29sdmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzb2x2ZV9yZXNwb25zZV9kYXRlX2FuY2hvciggYW5jaG9yLCBheGlzICkge1xuXHRcdHJldHVybiB3aW5kb3dfY2FjaGVfY29udHJvbGxlciA/IHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnJlc29sdmVfcmVzcG9uc2VfZGF0ZV9hbmNob3IoIGFuY2hvciwgYXhpcyApIDogZmFsc2U7XG5cdH1cblxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYW4gYW5jaG9yIGluc3RhbnQgaXMgYWxyZWFkeSBwcmVzZW50IGluIHRoZSBib3VuZGVkIGNhY2hlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gYW5jaG9yIFRpbWVzdGFtcCBhbmNob3IuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIGNhY2hlZCBhdXRob3JpemVkIGF4aXMgY29udGFpbnMgdGhlIGluc3RhbnQuXG5cdCAqL1xuXHRmdW5jdGlvbiBpc19hbmNob3JfbG9hZGVkKCBhbmNob3IgKSB7XG5cdFx0cmV0dXJuIHdpbmRvd19jYWNoZV9jb250cm9sbGVyID8gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuaXNfYW5jaG9yX2xvYWRlZCggYW5jaG9yICkgOiBmYWxzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdG9wIGFuIG9ic29sZXRlIHByaW1hcnkgcmVhZCBiZWZvcmUgcmVzdG9yaW5nIGFuIGFscmVhZHktY2FjaGVkIGluc3RhbnQuXG5cdCAqXG5cdCAqIEluY3JlbWVudGluZyB0aGUgZ2VuZXJhdGlvbiBndWFyYW50ZWVzIHRoYXQgYW4gdW51c3VhbGx5IGxhdGUgY29tcGxldGlvblxuXHQgKiBjYW5ub3QgcmVwbGFjZSB0aGUgY2FjaGUgYWZ0ZXIgVG9kYXkgaGFzIHJlc3RvcmVkIHRoZSBjdXJyZW50IGluc3RhbnQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBhYm9ydF9hY3RpdmVfd2luZG93X3JlcXVlc3QoKSB7XG5cdFx0aWYgKCAhIHdpbmRvd19jYWNoZV9jb250cm9sbGVyIHx8ICEgd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuYWJvcnRfZm9yZWdyb3VuZF9yZXF1ZXN0KCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSggc2V0dGluZ3MuaTE4bi5zdGF0dXNfcmVhZHksICdpbmZvJywgMTAwMCApO1xuXHRcdHNldF9mb3JlZ3JvdW5kX3JlcXVlc3RfbG9hZGluZyggZmFsc2UsICcnLCAwICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVmcmVzaCB0aGUgbGlnaHR3ZWlnaHQgVG9kYXkvY3VycmVudC10aW1lIHByZXNlbnRhdGlvbiBpbiBjYWNoZWQgbWFya3VwLlxuXHQgKlxuXHQgKiBUaGUgYm91bmRlZCBjYWNoZSBjYW4gcmVtYWluIG9wZW4gYWNyb3NzIGEgbWludXRlIG9yIGRhdGUgYm91bmRhcnkuIFRvZGF5XG5cdCAqIG5hdmlnYXRpb24gdGhlcmVmb3JlIHVwZGF0ZXMgb25seSB0aGUgZXhpc3RpbmcgbWFya2VyIGdlb21ldHJ5IG9yIGRhaWx5XG5cdCAqIGNlbGwgY2xhc3MgYmVmb3JlIHNjcm9sbGluZzsgaXQgZG9lcyBub3QgcmVidWlsZCByb3dzIG9yIGZvcm1hdCBzaXRlLWxvY2FsXG5cdCAqIGxhYmVscyBpbiB0aGUgYnJvd3Nlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGFuY2hvciBDdXJyZW50LWluc3RhbnQgYW5jaG9yLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVmcmVzaF90b2RheV9wcmVzZW50YXRpb24oIGFuY2hvciApIHtcblx0XHR2YXIgYW5jaG9yX2Vwb2NoID0gTnVtYmVyKCBhbmNob3IuZXBvY2ggKTtcblx0XHR2YXIgY2VsbHMgPSBzZXR0aW5ncy5heGlzICYmIEFycmF5LmlzQXJyYXkoIHNldHRpbmdzLmF4aXMuY2VsbHMgKSA/IHNldHRpbmdzLmF4aXMuY2VsbHMgOiBbXTtcblx0XHR2YXIgdGFyZ2V0X2NlbGwgPSBudWxsO1xuXG5cdFx0Y2VsbHMuc29tZSggZnVuY3Rpb24gKCBjZWxsICkge1xuXHRcdFx0aWYgKCBhbmNob3JfZXBvY2ggPj0gTnVtYmVyKCBjZWxsLnN0YXJ0X2Vwb2NoICkgJiYgYW5jaG9yX2Vwb2NoIDwgTnVtYmVyKCBjZWxsLmVuZF9lcG9jaCApICkge1xuXHRcdFx0XHR0YXJnZXRfY2VsbCA9IGNlbGw7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gKTtcblx0XHRpZiAoICEgdGFyZ2V0X2NlbGwgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBzZXR0aW5ncy5heGlzLmlzX3RpbWVkICkge1xuXHRcdFx0dmFyIHBvc2l0aW9uX3BlcmNlbnQgPSAxMDAgKiBtYXBfdGltZXN0YW1wX3RvX2F4aXNfcG9zaXRpb24oIGFuY2hvcl9lcG9jaCwgY2VsbHMgKSAvIE1hdGgubWF4KCAxLCBjZWxscy5sZW5ndGggKTtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChcblx0XHRcdFx0bW91bnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3RpbWVsaW5lX19jdXJyZW50X3RpbWVfaGVhZGVyLCAud3BiY190aW1lbGluZV9fY3VycmVudF90aW1lX21hcmtlcicgKSxcblx0XHRcdFx0ZnVuY3Rpb24gKCBtYXJrZXIgKSB7XG5cdFx0XHRcdFx0bWFya2VyLnN0eWxlLnNldFByb3BlcnR5KCAnaW5zZXQtaW5saW5lLXN0YXJ0JywgcG9zaXRpb25fcGVyY2VudCArICclJyApO1xuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLWRhdGVdJyApLCBmdW5jdGlvbiAoIGRhdGVfZWxlbWVudCApIHtcblx0XHRcdGRhdGVfZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtdG9kYXknLCB0YXJnZXRfY2VsbC5kYXRlID09PSBkYXRlX2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWRhdGUnICkgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVzdG9yZSBhbiBhbHJlYWR5LWF1dGhvcml6ZWQgY2FjaGVkIGluc3RhbnQgd2l0aG91dCBpc3N1aW5nIGFub3RoZXIgcmVhZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGFuY2hvciAgVGltZXN0YW1wIGFuY2hvci5cblx0ICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgQ2FjaGVkLW5hdmlnYXRpb24gcHJlc2VudGF0aW9uIG9wdGlvbnMuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgY2FjaGUgaGFuZGxlZCB0aGUgbmF2aWdhdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIHJlc3RvcmVfbG9hZGVkX2FuY2hvciggYW5jaG9yLCBvcHRpb25zICkge1xuXHRcdHZhciBzdGF0ZV9ob3N0O1xuXHRcdHZhciByZXN0b3JlX29wdGlvbnMgPSBPYmplY3QuYXNzaWduKCB7XG5cdFx0XHRyZWZyZXNoX3RvZGF5OiBmYWxzZSxcblx0XHRcdGFubm91bmNlbWVudDogc2V0dGluZ3MuaTE4bi5zdGF0dXNfcmVhZHlcblx0XHR9LCBvcHRpb25zIHx8IHt9ICk7XG5cblx0XHRpZiAoICEgaXNfYW5jaG9yX2xvYWRlZCggYW5jaG9yICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0YWJvcnRfYWN0aXZlX3dpbmRvd19yZXF1ZXN0KCk7XG5cdFx0YWJvcnRfZWRnZV9yZXF1ZXN0cygpO1xuXHRcdGNhbmNlbF9heGlzX2FuY2hvcl9yZXN0b3JhdGlvbigpO1xuXHRcdHN1c3BlbmRfYWRqYWNlbnRfbG9hZGluZ19mb3JfbmF2aWdhdGlvbigpO1xuXHRcdHJlbmRlcl9lZGdlX3N0YXRlcygpO1xuXHRcdGlmICggdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHR0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlci5yZWZyZXNoX2FmdGVyX3dpbmRvd19yZW5kZXIoKTtcblx0XHR9XG5cdFx0c3RhdGVfaG9zdCA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXN0YXRlXScgKTtcblx0XHRpZiAoIHN0YXRlX2hvc3QgJiYgc3RhdGVfaG9zdC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmVfX3N0YXRlLS1lcnJvcicgKSApIHtcblx0XHRcdHN0YXRlX2hvc3QuaGlkZGVuID0gdHJ1ZTtcblx0XHR9XG5cdFx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCAhIGlzX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJlc3RvcmVfb3B0aW9ucy5yZWZyZXNoX3RvZGF5ICkge1xuXHRcdFx0XHRyZWZyZXNoX3RvZGF5X3ByZXNlbnRhdGlvbiggYW5jaG9yICk7XG5cdFx0XHR9XG5cdFx0XHRyZXN0b3JlX2F4aXNfYW5jaG9yKCBhbmNob3IgKTtcblx0XHRcdGFubm91bmNlKCByZXN0b3JlX29wdGlvbnMuYW5ub3VuY2VtZW50ICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIG9uZSBwcmV2aW91cyBvciBuZXh0IGVkZ2Ugc3RhdGUgaW50byBpdHMgaGVhZGVyIGFuZCBjYW52YXMgaG9zdHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9lZGdlX3N0YXRlKCBkaXJlY3Rpb24gKSB7XG5cdFx0dmFyIHN0YXRlID0gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIgPyB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5nZXRfZWRnZV9zdGF0ZSggZGlyZWN0aW9uICkgOiB7IHN0YXR1czogJ2lkbGUnIH07XG5cdFx0dmFyIHRlbXBsYXRlX2tleSA9ICdlZGdlXycgKyBzdGF0ZS5zdGF0dXM7XG5cdFx0dmFyIGhlYWRlcl9ob3N0ID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtZWRnZS1oZWFkZXI9XCInICsgZGlyZWN0aW9uICsgJ1wiXScgKTtcblx0XHR2YXIgY2FudmFzX2hvc3QgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1lZGdlLWNhbnZhcz1cIicgKyBkaXJlY3Rpb24gKyAnXCJdJyApO1xuXHRcdHZhciBlZGdlX2VudHJ5ID0gZ2V0X2VkZ2Vfd2luZG93X2VudHJ5KCBkaXJlY3Rpb24gKTtcblx0XHR2YXIgd2luZG93X2NvbnRleHQgPSBlZGdlX2VudHJ5ICYmIGVkZ2VfZW50cnkucGF5bG9hZC53aW5kb3dfY29udGV4dCA/IGVkZ2VfZW50cnkucGF5bG9hZC53aW5kb3dfY29udGV4dCA6IHt9O1xuXHRcdHZhciBwcmV2aWV3cyA9IHdpbmRvd19jb250ZXh0LmFkamFjZW50X3ByZXZpZXdzICYmICdvYmplY3QnID09PSB0eXBlb2Ygd2luZG93X2NvbnRleHQuYWRqYWNlbnRfcHJldmlld3Ncblx0XHRcdD8gd2luZG93X2NvbnRleHQuYWRqYWNlbnRfcHJldmlld3Ncblx0XHRcdDoge307XG5cdFx0dmFyIHByZXZpZXcgPSBwcmV2aWV3c1sgZGlyZWN0aW9uIF0gJiYgJ29iamVjdCcgPT09IHR5cGVvZiBwcmV2aWV3c1sgZGlyZWN0aW9uIF1cblx0XHRcdD8gcHJldmlld3NbIGRpcmVjdGlvbiBdXG5cdFx0XHQ6IHt9O1xuXHRcdHZhciBjb21tb25fdmlld19tb2RlbCA9IHtcblx0XHRcdGRpcmVjdGlvbjogZGlyZWN0aW9uLFxuXHRcdFx0aTE4bjogc2V0dGluZ3MuaTE4bixcblx0XHRcdHByZXZpZXc6IHtcblx0XHRcdFx0cmFuZ2VfbGFiZWw6IFN0cmluZyggcHJldmlldy5yYW5nZV9sYWJlbCB8fCAnJyApLFxuXHRcdFx0XHRpc190aW1lZDogQm9vbGVhbiggcHJldmlldy5pc190aW1lZCApLFxuXHRcdFx0XHRjZWxsczogQXJyYXkuaXNBcnJheSggcHJldmlldy5jZWxscyApID8gcHJldmlldy5jZWxscyA6IFtdXG5cdFx0XHR9LFxuXHRcdFx0cGxhY2Vob2xkZXJfcm93czogYnVpbGRfZWRnZV9wbGFjZWhvbGRlcl9yb3dzKClcblx0XHR9O1xuXG5cdFx0cmVuZGVyX3RlbXBsYXRlKCBoZWFkZXJfaG9zdCwgdGVtcGxhdGVfa2V5LCBPYmplY3QuYXNzaWduKCB7fSwgY29tbW9uX3ZpZXdfbW9kZWwsIHsgYXJlYTogJ2hlYWRlcicgfSApICk7XG5cdFx0cmVuZGVyX3RlbXBsYXRlKCBjYW52YXNfaG9zdCwgdGVtcGxhdGVfa2V5LCBPYmplY3QuYXNzaWduKCB7fSwgY29tbW9uX3ZpZXdfbW9kZWwsIHsgYXJlYTogJ2NhbnZhcycgfSApICk7XG5cdFx0c2NoZWR1bGVfZWRnZV9zdGF0dXNfcG9zaXRpb25pbmcoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZCByb3ctaGVpZ2h0IHBsYWNlaG9sZGVycyBhbGlnbmVkIHdpdGggdGhlIGN1cnJlbnRseSB2aXNpYmxlIGNhbnZhcyByb3dzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBUZW1wbGF0ZS1zYWZlIHBsYWNlaG9sZGVyIHJvdyByZWNvcmRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gYnVpbGRfZWRnZV9wbGFjZWhvbGRlcl9yb3dzKCkge1xuXHRcdHZhciBjZWxsX2NvdW50ID0gZ2V0X3dpbmRvd19sb2FkaW5nX2xpbWl0cygpLmVkZ2VfcGxhY2Vob2xkZXJfY2VsbHM7XG5cdFx0dmFyIGNhbnZhc19yb3dzID0gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3RpbWVsaW5lX19jYW52YXNfcm93Om5vdChbaGlkZGVuXSknICk7XG5cdFx0dmFyIHBsYWNlaG9sZGVyX3Jvd3MgPSBbXTtcblxuXHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGNhbnZhc19yb3dzLCBmdW5jdGlvbiAoIGNhbnZhc19yb3cgKSB7XG5cdFx0XHR2YXIgY2VsbHMgPSBbXTtcblx0XHRcdHZhciBjZWxsX2luZGV4O1xuXG5cdFx0XHRmb3IgKCBjZWxsX2luZGV4ID0gMDsgY2VsbF9pbmRleCA8IGNlbGxfY291bnQ7IGNlbGxfaW5kZXggKz0gMSApIHtcblx0XHRcdFx0Y2VsbHMucHVzaCggY2VsbF9pbmRleCApO1xuXHRcdFx0fVxuXHRcdFx0cGxhY2Vob2xkZXJfcm93cy5wdXNoKCB7XG5cdFx0XHRcdGhlaWdodF9weDogTWF0aC5tYXgoIDEsIE1hdGguY2VpbCggY2FudmFzX3Jvdy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgKSApLFxuXHRcdFx0XHRjZWxsczogY2VsbHNcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gcGxhY2Vob2xkZXJfcm93cztcblx0fVxuXG5cdC8qKlxuXHQgKiBLZWVwIHJlbmRlcmVkIGVkZ2Ugc2tlbGV0b24gcm93cyBzeW5jaHJvbml6ZWQgYWZ0ZXIgUmVzb3VyY2Ugcm93IHJlc2l6aW5nLlxuXHQgKlxuXHQgKiBBIGhpZXJhcmNoeSB2aXNpYmlsaXR5IGNoYW5nZSByZXF1aXJlcyBvbmUgdGVtcGxhdGUgcmUtcmVuZGVyIGJlY2F1c2UgdGhlXG5cdCAqIHJvdyBjb3VudCBjaGFuZ2VkLiBPcmRpbmFyeSBpbWFnZSwgZm9udCwgb3IgZGV0YWlsLWhlaWdodCBjaGFuZ2VzIHVwZGF0ZVxuXHQgKiBvbmx5IHRoZSBleGlzdGluZyBwcmVzZW50YXRpb24gdmFsdWVzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfZWRnZV9wbGFjZWhvbGRlcl9yb3dzKCkge1xuXHRcdHZhciBwbGFjZWhvbGRlcl9yb3dzID0gYnVpbGRfZWRnZV9wbGFjZWhvbGRlcl9yb3dzKCk7XG5cdFx0dmFyIHJlcXVpcmVzX3JlbmRlciA9IGZhbHNlO1xuXG5cdFx0WyAncHJldmlvdXMnLCAnbmV4dCcgXS5mb3JFYWNoKCBmdW5jdGlvbiAoIGRpcmVjdGlvbiApIHtcblx0XHRcdHZhciBob3N0ID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtZWRnZS1jYW52YXM9XCInICsgZGlyZWN0aW9uICsgJ1wiXScgKTtcblx0XHRcdHZhciByZW5kZXJlZF9yb3dzID0gaG9zdCA/IGhvc3QucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX3RpbWVsaW5lX19lZGdlX3BsYWNlaG9sZGVyX3JvdycgKSA6IFtdO1xuXG5cdFx0XHRpZiAoICEgaG9zdCB8fCByZW5kZXJlZF9yb3dzLmxlbmd0aCAhPT0gcGxhY2Vob2xkZXJfcm93cy5sZW5ndGggKSB7XG5cdFx0XHRcdHJlcXVpcmVzX3JlbmRlciA9IEJvb2xlYW4oIGhvc3QgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCByZW5kZXJlZF9yb3dzLCBmdW5jdGlvbiAoIHJlbmRlcmVkX3Jvdywgcm93X2luZGV4ICkge1xuXHRcdFx0XHRyZW5kZXJlZF9yb3cuc3R5bGUuaGVpZ2h0ID0gcGxhY2Vob2xkZXJfcm93c1sgcm93X2luZGV4IF0uaGVpZ2h0X3B4ICsgJ3B4Jztcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cblx0XHRpZiAoIHJlcXVpcmVzX3JlbmRlciApIHtcblx0XHRcdHJlbmRlcl9lZGdlX3N0YXRlcygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBLZWVwIGxvYWRpbmcgY29udHJvbHMgdmlzaWJsZSB3aGlsZSB0aGUgV29yZFByZXNzIGRvY3VtZW50IHNjcm9sbHMuXG5cdCAqXG5cdCAqIE5hdGl2ZSBzdGlja3kgcG9zaXRpb25pbmcgaXMgYm91bmRlZCBieSB0aGUgaG9yaXpvbnRhbGx5IHNjcm9sbGluZyBjYW52YXMuXG5cdCAqIFRoaXMgY29udHJvbGxlciBtZWFzdXJlcyB0aGUgYWxyZWFkeSBzdGlja3kgVGltZWxpbmUgaGVhZGVyIGFuZCBhcHBsaWVzIGFcblx0ICogY2xhbXBlZCBsb2dpY2FsIG9mZnNldCB3aGlsZSB0aGUgY2FyZCByZW1haW5zIG93bmVkIGJ5IGl0cyBlZGdlIGJ1ZmZlci5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHVwZGF0ZV9lZGdlX3N0YXR1c19wb3NpdGlvbnMoKSB7XG5cdFx0dmFyIHN0aWNreV9oZWFkZXIgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdGltZWxpbmVfX3N0aWNreV9oZWFkZXInICk7XG5cdFx0dmFyIHN0aWNreV9ib3VuZGFyeSA9IHN0aWNreV9oZWFkZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHN0aWNreV9oZWFkZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0XG5cdFx0XHQ/IHN0aWNreV9oZWFkZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuYm90dG9tXG5cdFx0XHQ6IDA7XG5cdFx0dmFyIHN0YXR1c19lbGVtZW50cyA9IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoXG5cdFx0XHQnLndwYmNfdGltZWxpbmVfX2VkZ2VfYnVmZmVyLmlzLWNhbnZhcyAud3BiY190aW1lbGluZV9fZWRnZV9zdGF0dXMnXG5cdFx0KTtcblx0XHR2YXIgc3RpY2t5X2dhcCA9IDE4O1xuXHRcdHZhciB2aWV3cG9ydF9oZWlnaHQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IHx8IHdpbmRvdy5pbm5lckhlaWdodCB8fCAwO1xuXG5cdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggc3RhdHVzX2VsZW1lbnRzLCBmdW5jdGlvbiAoIHN0YXR1c19lbGVtZW50ICkge1xuXHRcdFx0dmFyIGVkZ2VfYnVmZmVyID0gc3RhdHVzX2VsZW1lbnQuY2xvc2VzdCggJy53cGJjX3RpbWVsaW5lX19lZGdlX2J1ZmZlcicgKTtcblx0XHRcdHZhciBidWZmZXJfcmVjdGFuZ2xlO1xuXHRcdFx0dmFyIG1heGltdW1fb2Zmc2V0O1xuXHRcdFx0dmFyIGRlc2lyZWRfb2Zmc2V0O1xuXHRcdFx0dmFyIHZpc2libGVfc3BhY2U7XG5cblx0XHRcdGlmICggISBlZGdlX2J1ZmZlciApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YnVmZmVyX3JlY3RhbmdsZSA9IGVkZ2VfYnVmZmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0bWF4aW11bV9vZmZzZXQgPSBNYXRoLm1heChcblx0XHRcdFx0c3RpY2t5X2dhcCxcblx0XHRcdFx0ZWRnZV9idWZmZXIub2Zmc2V0SGVpZ2h0IC0gc3RhdHVzX2VsZW1lbnQub2Zmc2V0SGVpZ2h0IC0gc3RpY2t5X2dhcFxuXHRcdFx0KTtcblx0XHRcdHZpc2libGVfc3BhY2UgPSBNYXRoLm1heCggMCwgdmlld3BvcnRfaGVpZ2h0IC0gc3RpY2t5X2JvdW5kYXJ5IC0gc3RhdHVzX2VsZW1lbnQub2Zmc2V0SGVpZ2h0ICk7XG5cdFx0XHRkZXNpcmVkX29mZnNldCA9IE1hdGgubWF4KFxuXHRcdFx0XHRzdGlja3lfZ2FwLFxuXHRcdFx0XHRzdGlja3lfYm91bmRhcnkgKyBNYXRoLm1heCggc3RpY2t5X2dhcCwgdmlzaWJsZV9zcGFjZSAvIDMgKSAtIGJ1ZmZlcl9yZWN0YW5nbGUudG9wXG5cdFx0XHQpO1xuXHRcdFx0c3RhdHVzX2VsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXG5cdFx0XHRcdCctLXdwYmMtdGltZWxpbmUtZWRnZS1zdGF0dXMtb2Zmc2V0Jyxcblx0XHRcdFx0TWF0aC5taW4oIG1heGltdW1fb2Zmc2V0LCBkZXNpcmVkX29mZnNldCApICsgJ3B4J1xuXHRcdFx0KTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29hbGVzY2Ugdmlld3BvcnQgYW5kIGxheW91dCBldmVudHMgaW50byBvbmUgc3RpY2t5LWNhcmQgbWVhc3VyZW1lbnQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzY2hlZHVsZV9lZGdlX3N0YXR1c19wb3NpdGlvbmluZygpIHtcblx0XHRpZiAoIGVkZ2Vfc3RhdHVzX2ZyYW1lICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGVkZ2Vfc3RhdHVzX2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0ZWRnZV9zdGF0dXNfZnJhbWUgPSAwO1xuXHRcdFx0dXBkYXRlX2VkZ2Vfc3RhdHVzX3Bvc2l0aW9ucygpO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgYm90aCBib3VuZGVkIGVkZ2Ugc3RhdGVzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX2VkZ2Vfc3RhdGVzKCkge1xuXHRcdGlmICggISBzZXR0aW5ncy5pbml0aWFsIHx8ICEgQXJyYXkuaXNBcnJheSggc2V0dGluZ3MuaW5pdGlhbC5yZXNvdXJjZXMgKSB8fCAhIHNldHRpbmdzLmluaXRpYWwucmVzb3VyY2VzLmxlbmd0aCApIHtcblx0XHRcdFsgJ3ByZXZpb3VzJywgJ25leHQnIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBkaXJlY3Rpb24gKSB7XG5cdFx0XHRcdHZhciBoZWFkZXJfaG9zdCA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWVkZ2UtaGVhZGVyPVwiJyArIGRpcmVjdGlvbiArICdcIl0nICk7XG5cdFx0XHRcdHZhciBjYW52YXNfaG9zdCA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWVkZ2UtY2FudmFzPVwiJyArIGRpcmVjdGlvbiArICdcIl0nICk7XG5cblx0XHRcdFx0aWYgKCBoZWFkZXJfaG9zdCApIHtcblx0XHRcdFx0XHRoZWFkZXJfaG9zdC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggY2FudmFzX2hvc3QgKSB7XG5cdFx0XHRcdFx0Y2FudmFzX2hvc3QudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZW5kZXJfZWRnZV9zdGF0ZSggJ3ByZXZpb3VzJyApO1xuXHRcdHJlbmRlcl9lZGdlX3N0YXRlKCAnbmV4dCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW5kZXIgdGhlIGNvbXBsZXRlIGJvdW5kZWQgY2FjaGUgdGhyb3VnaCBleGlzdGluZyBXb3JkUHJlc3MgdGVtcGxhdGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gYW5jaG9yIFRpbWVzdGFtcCBhbmQgdmlld3BvcnQgcG9zaXRpb24gdG8gcmVzdG9yZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGFubm91bmNlbWVudCBPcHRpb25hbCBzY3JlZW4tcmVhZGVyIGNvbXBsZXRpb24gbWVzc2FnZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgY29tcG9zZWQgdmlldyB3YXMgcmVuZGVyZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfd2luZG93X3N0b3JlKCBhbmNob3IsIGFubm91bmNlbWVudCApIHtcblx0XHR2YXIgY29tcG9zZWQgPSBjb21wb3NlX3dpbmRvd19zdG9yZSgpO1xuXHRcdHZhciBzdGF0ZV9ob3N0ID0gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtc3RhdGVdJyApO1xuXHRcdHZhciBicm93c2VyX2V4cGFuc2lvbl9wcmVmZXJlbmNlcyA9IHNldHRpbmdzLnByZWZlcmVuY2VzIHx8IHt9O1xuXHRcdHZhciBhY2NlcHRlZF93aW5kb3dfZW50cmllcztcblxuXHRcdGlmICggISBjb21wb3NlZCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0c3VzcGVuZF9hZGphY2VudF9sb2FkaW5nX2Zvcl9uYXZpZ2F0aW9uKCk7XG5cdFx0c2V0dGluZ3Mud2luZG93ID0gY29tcG9zZWQuY3VycmVudC53aW5kb3c7XG5cdFx0c2V0dGluZ3Mud2luZG93X2NvbnRleHQgPSBjb21wb3NlZC5jdXJyZW50LndpbmRvd19jb250ZXh0O1xuXHRcdHNldHRpbmdzLnJlc291cmNlX3ZpZXcgPSBjb21wb3NlZC5jdXJyZW50LnJlc291cmNlX3ZpZXcgfHwgc2V0dGluZ3MucmVzb3VyY2VfdmlldyB8fCB7fTtcblx0XHRzZXR0aW5ncy5yZXNvdXJjZV9wYWdpbmF0aW9uID0gY29tcG9zZWQuY3VycmVudC5yZXNvdXJjZV9wYWdpbmF0aW9uIHx8IHt9O1xuXHRcdHNldHRpbmdzLnZpZXdfcG9saWN5ID0gY29tcG9zZWQuY3VycmVudC52aWV3X3BvbGljeTtcblx0XHRzZXR0aW5ncy5jdXJyZW50X2F4aXMgPSBjb21wb3NlZC5jdXJyZW50LmF4aXM7XG5cdFx0c2V0dGluZ3MuYXhpcyA9IGNvbXBvc2VkLmF4aXM7XG5cdFx0c2V0dGluZ3MucHJlZmVyZW5jZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgY29tcG9zZWQuY3VycmVudC5wcmVmZXJlbmNlcyB8fCB7fSwge1xuXHRcdFx0ZXhwYW5kZWRfcmVzb3VyY2VfaWRzOiBBcnJheS5pc0FycmF5KCBicm93c2VyX2V4cGFuc2lvbl9wcmVmZXJlbmNlcy5leHBhbmRlZF9yZXNvdXJjZV9pZHMgKVxuXHRcdFx0XHQ/IGJyb3dzZXJfZXhwYW5zaW9uX3ByZWZlcmVuY2VzLmV4cGFuZGVkX3Jlc291cmNlX2lkcy5zbGljZSgpXG5cdFx0XHRcdDogW10sXG5cdFx0XHRleHBhbmRlZF9wYXJlbnRfaWRzOiBBcnJheS5pc0FycmF5KCBicm93c2VyX2V4cGFuc2lvbl9wcmVmZXJlbmNlcy5leHBhbmRlZF9wYXJlbnRfaWRzIClcblx0XHRcdFx0PyBicm93c2VyX2V4cGFuc2lvbl9wcmVmZXJlbmNlcy5leHBhbmRlZF9wYXJlbnRfaWRzLnNsaWNlKClcblx0XHRcdFx0OiBbXVxuXHRcdH0gKTtcblx0XHRzZXR0aW5ncy5pbml0aWFsID0ge1xuXHRcdFx0bG9hZF9zdGF0ZTogJ2xvYWRlZCcsXG5cdFx0XHRyZXNvdXJjZXM6IGNvbXBvc2VkLnJlc291cmNlcyxcblx0XHRcdHNlZ21lbnRzOiBjb21wb3NlZC5zZWdtZW50cyxcblx0XHRcdG9jY3VwYW5jeTogY29tcG9zZWQub2NjdXBhbmN5LFxuXHRcdFx0dGltZV9zbG90X292ZXJmbG93czogY29tcG9zZWQudGltZV9zbG90X292ZXJmbG93cyB8fCBbXVxuXHRcdH07XG5cdFx0cmVuZGVyX3RlbXBsYXRlKCBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1heGlzLWhlYWRlcl0nICksICdheGlzX2hlYWRlcicsIHNldHRpbmdzICk7XG5cdFx0cmVuZGVyX3RlbXBsYXRlKCBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXMtYmFja2Ryb3BdJyApLCAnY2FudmFzX2JhY2tkcm9wJywgc2V0dGluZ3MgKTtcblx0XHRpZiAoIHRvb2xiYXJfbmF2aWdhdGlvbl9jb250cm9sbGVyICkge1xuXHRcdFx0dG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIucmVmcmVzaF9hZnRlcl93aW5kb3dfcmVuZGVyKCk7XG5cdFx0fVxuXHRcdGlmICggcmVzb3VyY2VfbmF2aWdhdGlvbl9jb250cm9sbGVyICkge1xuXHRcdFx0cmVzb3VyY2VfbmF2aWdhdGlvbl9jb250cm9sbGVyLnJlZnJlc2goIHNldHRpbmdzLnJlc291cmNlX3ZpZXcsIHNldHRpbmdzLnJlc291cmNlX3BhZ2luYXRpb24gKTtcblx0XHR9XG5cdFx0aWYgKCByZW5kZXJfcm93cyggc2V0dGluZ3MuaW5pdGlhbCApICkge1xuXHRcdFx0aWYgKCByZXNvdXJjZV9zZXR0aW5nc19jb250cm9sbGVyICkge1xuXHRcdFx0XHRyZXNvdXJjZV9zZXR0aW5nc19jb250cm9sbGVyLnJlZnJlc2goIHNldHRpbmdzLmluaXRpYWwucmVzb3VyY2VzICk7XG5cdFx0XHR9XG5cdFx0XHRzdGF0ZV9ob3N0LmhpZGRlbiA9IHRydWU7XG5cdFx0XHRpZiAoIGFubm91bmNlbWVudCApIHtcblx0XHRcdFx0YW5ub3VuY2UoIGFubm91bmNlbWVudCApO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdGF0ZV9ob3N0LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0cmVuZGVyX3RlbXBsYXRlKCBzdGF0ZV9ob3N0LCAnZW1wdHknLCBzZXR0aW5ncyApO1xuXHRcdFx0YW5ub3VuY2UoIHNldHRpbmdzLmkxOG4uc3RhdHVzX2VtcHR5ICk7XG5cdFx0fVxuXHRcdGlmICggZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlci5yZW5kZXIoKTtcblx0XHR9XG5cdFx0cmVuZGVyX2VkZ2Vfc3RhdGVzKCk7XG5cdFx0b2JzZXJ2ZV9yZW5kZXJlZF9yb3dzKCk7XG5cdFx0c2NoZWR1bGVfYXhpc19hbmNob3JfcmVzdG9yYXRpb24oIGFuY2hvciwgaW5pdGlhbGl6ZV9lZGdlX29ic2VydmVyICk7XG5cdFx0YWNjZXB0ZWRfd2luZG93X2VudHJpZXMgPSB3aW5kb3dfY2FjaGVfY29udHJvbGxlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuZ2V0X29yZGVyZWRfd2luZG93X2VudHJpZXNcblx0XHRcdD8gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuZ2V0X29yZGVyZWRfd2luZG93X2VudHJpZXMoKVxuXHRcdFx0OiBbXTtcblx0XHRub3RpZnlfYWNjZXB0ZWRfYm9va2luZ193aW5kb3dzKCBhY2NlcHRlZF93aW5kb3dfZW50cmllcyApO1xuXHRcdHN5bmNocm9uaXplX2F2YWlsYWJpbGl0eV9jYWNoZSggYWNjZXB0ZWRfd2luZG93X2VudHJpZXMgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgb3V0ZXIgY2FjaGVkIGVudHJ5IHVzZWQgdG8gcmVxdWVzdCBvbmUgbW9yZSBhZGphY2VudCB3aW5kb3cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IENhY2hlIGVudHJ5IG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZWRnZV93aW5kb3dfZW50cnkoIGRpcmVjdGlvbiApIHtcblx0XHRyZXR1cm4gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIgPyB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5nZXRfZWRnZV93aW5kb3dfZW50cnkoIGRpcmVjdGlvbiApIDogbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBQcm9tb3RlIHRoZSBjYWNoZWQgd2luZG93IGNvbnRhaW5pbmcgdGhlIHZpc2libGUgdGltZXN0YW1wLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcHJvbW90ZV92aXNpYmxlX3dpbmRvdygpIHtcblx0XHR2YXIgYW5jaG9yID0gY2FwdHVyZV9heGlzX2FuY2hvcigpO1xuXHRcdHZhciBwcm9tb3Rpb24gPSB3aW5kb3dfY2FjaGVfY29udHJvbGxlciA/IHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnByb21vdGVfZm9yX2FuY2hvciggYW5jaG9yICkgOiBudWxsO1xuXG5cdFx0aWYgKCAhIHByb21vdGlvbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCBwcm9tb3Rpb24udHJpbW1lZCApIHtcblx0XHRcdHJlbmRlcl93aW5kb3dfc3RvcmUoIGFuY2hvciwgJycgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2V0dGluZ3Mud2luZG93ID0gcHJvbW90aW9uLmVudHJ5LnBheWxvYWQud2luZG93O1xuXHRcdFx0c2V0dGluZ3Mud2luZG93X2NvbnRleHQgPSBwcm9tb3Rpb24uZW50cnkucGF5bG9hZC53aW5kb3dfY29udGV4dDtcblx0XHRcdHNldHRpbmdzLnZpZXdfcG9saWN5ID0gcHJvbW90aW9uLmVudHJ5LnBheWxvYWQudmlld19wb2xpY3k7XG5cdFx0XHRzZXR0aW5ncy5jdXJyZW50X2F4aXMgPSBwcm9tb3Rpb24uZW50cnkucGF5bG9hZC5heGlzO1xuXHRcdFx0aWYgKCB0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlciApIHtcblx0XHRcdFx0dG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIucmVmcmVzaF9hZnRlcl93aW5kb3dfcmVuZGVyKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIERldGVybWluZSB3aGV0aGVyIGFuIGVkZ2Ugc2VudGluZWwgaXMgaW5zaWRlIGEgcGVyY2VudGFnZS1leHBhbmRlZCB2aWV3cG9ydC5cblx0ICpcblx0ICogVGhpcyBzaGFyZWQgZ2VvbWV0cnkga2VlcHMgb2JzZXJ2ZXIgYW5kIHNjcm9sbC1mYWxsYmFjayB0aHJlc2hvbGRzIGFsaWduZWRcblx0ICogYW5kIHdvcmtzIHdpdGggcGh5c2ljYWwgYnJvd3NlciByZWN0YW5nbGVzIGluIGJvdGggTFRSIGFuZCBSVEwgbGF5b3V0cy5cblx0ICpcblx0ICogQHBhcmFtIHtET01SZWN0fSBjYW52YXNfcmVjdGFuZ2xlIENhbnZhcyB2aWV3cG9ydCByZWN0YW5nbGUuXG5cdCAqIEBwYXJhbSB7RE9NUmVjdH0gc2VudGluZWxfcmVjdGFuZ2xlIEVkZ2Ugc2VudGluZWwgcmVjdGFuZ2xlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZXhwYW5zaW9uX3BlcmNlbnQgSG9yaXpvbnRhbCB2aWV3cG9ydCBleHBhbnNpb24gcGVyY2VudGFnZS5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBzZW50aW5lbCBpcyB3aXRoaW4gdGhlIGV4cGFuZGVkIHZpZXdwb3J0LlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfZWRnZV9zZW50aW5lbF9uZWFyKCBjYW52YXNfcmVjdGFuZ2xlLCBzZW50aW5lbF9yZWN0YW5nbGUsIGV4cGFuc2lvbl9wZXJjZW50ICkge1xuXHRcdHZhciB0aHJlc2hvbGQgPSBjYW52YXNfcmVjdGFuZ2xlLndpZHRoICogZXhwYW5zaW9uX3BlcmNlbnQgLyAxMDA7XG5cblx0XHRyZXR1cm4gc2VudGluZWxfcmVjdGFuZ2xlLnJpZ2h0ID49IGNhbnZhc19yZWN0YW5nbGUubGVmdCAtIHRocmVzaG9sZCAmJiBzZW50aW5lbF9yZWN0YW5nbGUubGVmdCA8PSBjYW52YXNfcmVjdGFuZ2xlLnJpZ2h0ICsgdGhyZXNob2xkO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByb2Nlc3Mgc2Nyb2xsLXRpbWUgcHJvbW90aW9uIGFuZCB0aGUgbm9uLW9ic2VydmVyIGVkZ2UgZmFsbGJhY2sgb25jZS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV93aW5kb3dfc3RvcmVfc2Nyb2xsKCkge1xuXHRcdHZhciBjYW52YXMgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXNdJyApO1xuXHRcdHZhciBsaW1pdHMgPSBnZXRfd2luZG93X2xvYWRpbmdfbGltaXRzKCk7XG5cblx0XHRpZiAoIGlzX2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkIHx8IGVkZ2Vfc2Nyb2xsX2ZyYW1lIHx8ICEgY2FudmFzICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRlZGdlX3Njcm9sbF9mcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBjYW52YXNfcmVjdGFuZ2xlID0gY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG5cdFx0XHRlZGdlX3Njcm9sbF9mcmFtZSA9IDA7XG5cdFx0XHRwcm9tb3RlX3Zpc2libGVfd2luZG93KCk7XG5cdFx0XHRbICdwcmV2aW91cycsICduZXh0JyBdLmZvckVhY2goIGZ1bmN0aW9uICggZGlyZWN0aW9uICkge1xuXHRcdFx0XHR2YXIgc2VudGluZWwgPSBjYW52YXMucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtZWRnZS1zZW50aW5lbD1cIicgKyBkaXJlY3Rpb24gKyAnXCJdJyApO1xuXHRcdFx0XHR2YXIgc2VudGluZWxfcmVjdGFuZ2xlO1xuXHRcdFx0XHR2YXIgaXNfbmVhcl9yZWFybTtcblxuXHRcdFx0XHRpZiAoICEgc2VudGluZWwgfHwgISB3aW5kb3dfY2FjaGVfY29udHJvbGxlciApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VudGluZWxfcmVjdGFuZ2xlID0gc2VudGluZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdGlzX25lYXJfcmVhcm0gPSBpc19lZGdlX3NlbnRpbmVsX25lYXIoIGNhbnZhc19yZWN0YW5nbGUsIHNlbnRpbmVsX3JlY3RhbmdsZSwgbGltaXRzLmVkZ2VfcmVhcm1fcGVyY2VudCApO1xuXHRcdFx0XHRpZiAoIHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnVwZGF0ZV9lZGdlX3Byb3hpbWl0eShcblx0XHRcdFx0XHRkaXJlY3Rpb24sXG5cdFx0XHRcdFx0aXNfbmVhcl9yZWFybSxcblx0XHRcdFx0XHRpc19lZGdlX3NlbnRpbmVsX25lYXIoIGNhbnZhc19yZWN0YW5nbGUsIHNlbnRpbmVsX3JlY3RhbmdsZSwgbGltaXRzLmVkZ2VfcHJlZmV0Y2hfcGVyY2VudCApXG5cdFx0XHRcdCkgKSB7XG5cdFx0XHRcdFx0cmVxdWVzdF9hZGphY2VudF93aW5kb3coIGRpcmVjdGlvbiApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE9ic2VydmUgYm91bmRlZCBlZGdlIHNlbnRpbmVscyByZWxhdGl2ZSB0byB0aGUgVGltZWxpbmUgY2FudmFzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV9lZGdlX29ic2VydmVyKCkge1xuXHRcdHZhciBjYW52YXMgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXNdJyApO1xuXHRcdHZhciBsaW1pdHMgPSBnZXRfd2luZG93X2xvYWRpbmdfbGltaXRzKCk7XG5cdFx0dmFyIG1hcmdpbiA9ICcwcHggJyArIGxpbWl0cy5lZGdlX3ByZWZldGNoX3BlcmNlbnQgKyAnJSc7XG5cblx0XHRpZiAoIGVkZ2Vfb2JzZXJ2ZXIgKSB7XG5cdFx0XHRlZGdlX29ic2VydmVyLmRpc2Nvbm5lY3QoKTtcblx0XHRcdGVkZ2Vfb2JzZXJ2ZXIgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAoICEgY2FudmFzIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuSW50ZXJzZWN0aW9uT2JzZXJ2ZXIgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGVkZ2Vfb2JzZXJ2ZXIgPSBuZXcgd2luZG93LkludGVyc2VjdGlvbk9ic2VydmVyKCBmdW5jdGlvbiAoIGVudHJpZXMgKSB7XG5cdFx0XHRlbnRyaWVzLmZvckVhY2goIGZ1bmN0aW9uICggZW50cnkgKSB7XG5cdFx0XHRcdHZhciBkaXJlY3Rpb24gPSBlbnRyeS50YXJnZXQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWVkZ2Utc2VudGluZWwnICk7XG5cdFx0XHRcdHZhciBzdGF0ZSA9IHdpbmRvd19jYWNoZV9jb250cm9sbGVyID8gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuZ2V0X2VkZ2Vfc3RhdGUoIGRpcmVjdGlvbiApIDogbnVsbDtcblxuXHRcdFx0XHRpZiAoIGVudHJ5LmlzSW50ZXJzZWN0aW5nICYmIGRpcmVjdGlvbiAmJiBzdGF0ZSAmJiBzdGF0ZS5hcm1lZCAmJiBzdGF0ZS51c2VyX2ludGVudCAmJiAnaWRsZScgPT09IHN0YXRlLnN0YXR1cyApIHtcblx0XHRcdFx0XHRyZXF1ZXN0X2FkamFjZW50X3dpbmRvdyggZGlyZWN0aW9uICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9LCB7IHJvb3Q6IGNhbnZhcywgcm9vdE1hcmdpbjogbWFyZ2luLCB0aHJlc2hvbGQ6IDAuMDEgfSApO1xuXHRcdFsgJ3ByZXZpb3VzJywgJ25leHQnIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBkaXJlY3Rpb24gKSB7XG5cdFx0XHR2YXIgc2VudGluZWwgPSBjYW52YXMucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtZWRnZS1zZW50aW5lbD1cIicgKyBkaXJlY3Rpb24gKyAnXCJdJyApO1xuXHRcdFx0dmFyIGNhbnZhc19yZWN0YW5nbGU7XG5cdFx0XHR2YXIgc2VudGluZWxfcmVjdGFuZ2xlO1xuXHRcdFx0dmFyIHN0YXRlID0gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIgPyB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5nZXRfZWRnZV9zdGF0ZSggZGlyZWN0aW9uICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoIHNlbnRpbmVsICYmIHN0YXRlICkge1xuXHRcdFx0XHRjYW52YXNfcmVjdGFuZ2xlID0gY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRzZW50aW5lbF9yZWN0YW5nbGUgPSBzZW50aW5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0d2luZG93X2NhY2hlX2NvbnRyb2xsZXIudXBkYXRlX2VkZ2VfcHJveGltaXR5KFxuXHRcdFx0XHRcdGRpcmVjdGlvbixcblx0XHRcdFx0XHRpc19lZGdlX3NlbnRpbmVsX25lYXIoIGNhbnZhc19yZWN0YW5nbGUsIHNlbnRpbmVsX3JlY3RhbmdsZSwgbGltaXRzLmVkZ2VfcmVhcm1fcGVyY2VudCApLFxuXHRcdFx0XHRcdGZhbHNlXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGVkZ2Vfb2JzZXJ2ZXIub2JzZXJ2ZSggc2VudGluZWwgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogTG9hZCBvbmUgYWRqYWNlbnQgd2luZG93IHdpdGhvdXQgcmVwbGFjaW5nIHRoZSBjdXJyZW50IHdvcmtpbmcgVGltZWxpbmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0ICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3Rfb3B0aW9ucyBPcHRpb25hbCBmb3JlZ3JvdW5kLXByaW1lIGJlaGF2aW9yLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0galF1ZXJ5LWNvbXBhdGlibGUgY29tcGxldGlvbiBwcm9taXNlIHdoZW4gYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVxdWVzdF9hZGphY2VudF93aW5kb3coIGRpcmVjdGlvbiwgcmVxdWVzdF9vcHRpb25zICkge1xuXHRcdHZhciB0cmFuc3BvcnQgPSBzZXR0aW5ncy50cmFuc3BvcnQgfHwge307XG5cdFx0dmFyIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKCB7XG5cdFx0XHRhbGxvd193aXRob3V0X3VzZXJfaW50ZW50OiBmYWxzZSxcblx0XHRcdGRlZmVyX3JlbmRlcjogZmFsc2UsXG5cdFx0XHRzaWxlbnQ6IGZhbHNlLFxuXHRcdFx0c2tpcF9wcm9tb3Rpb246IGZhbHNlXG5cdFx0fSwgcmVxdWVzdF9vcHRpb25zIHx8IHt9ICk7XG5cdFx0dmFyIGVkZ2VfZW50cnk7XG5cdFx0dmFyIGRlc2NyaXB0b3I7XG5cdFx0dmFyIHN0YXRlO1xuXHRcdHZhciBoYWRfdXNlcl9pbnRlbnQ7XG5cdFx0dmFyIGxpbWl0cztcblx0XHR2YXIgZ2VuZXJhdGlvbjtcblx0XHR2YXIgcmVxdWVzdF92YWx1ZXM7XG5cdFx0dmFyIHJlcXVlc3Q7XG5cdFx0dmFyIGNvbXBsZXRpb24gPSB3aW5kb3cualF1ZXJ5ID8gd2luZG93LmpRdWVyeS5EZWZlcnJlZCgpIDogbnVsbDtcblx0XHR2YXIgaXNfaW50ZW50X2Jsb2NrZWQ7XG5cblx0XHRpZiAoIGlzX2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkIHx8ICEgY29tcGxldGlvbiApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHN0YXRlID0gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIgPyB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5nZXRfZWRnZV9zdGF0ZSggZGlyZWN0aW9uICkgOiBudWxsO1xuXHRcdGhhZF91c2VyX2ludGVudCA9IEJvb2xlYW4oIHN0YXRlICYmIHN0YXRlLnVzZXJfaW50ZW50ICk7XG5cdFx0aWYgKCAhIG9wdGlvbnMuc2tpcF9wcm9tb3Rpb24gKSB7XG5cdFx0XHRwcm9tb3RlX3Zpc2libGVfd2luZG93KCk7XG5cdFx0fVxuXHRcdGlmICggaGFkX3VzZXJfaW50ZW50ICYmICEgb3B0aW9ucy5hbGxvd193aXRob3V0X3VzZXJfaW50ZW50ICkge1xuXHRcdFx0YWN0aXZhdGVfYWRqYWNlbnRfbmF2aWdhdGlvbl9pbnRlbnQoIGRpcmVjdGlvbiwgdHJ1ZSApO1xuXHRcdH1cblx0XHRlZGdlX2VudHJ5ID0gZ2V0X2VkZ2Vfd2luZG93X2VudHJ5KCBkaXJlY3Rpb24gKTtcblx0XHRkZXNjcmlwdG9yID0gZWRnZV9lbnRyeSAmJiBlZGdlX2VudHJ5LnBheWxvYWQud2luZG93X2NvbnRleHQgJiYgZWRnZV9lbnRyeS5wYXlsb2FkLndpbmRvd19jb250ZXh0LmFkamFjZW50X3JlcXVlc3RzID8gZWRnZV9lbnRyeS5wYXlsb2FkLndpbmRvd19jb250ZXh0LmFkamFjZW50X3JlcXVlc3RzWyBkaXJlY3Rpb24gXSA6IG51bGw7XG5cdFx0c3RhdGUgPSB3aW5kb3dfY2FjaGVfY29udHJvbGxlciA/IHdpbmRvd19jYWNoZV9jb250cm9sbGVyLmdldF9lZGdlX3N0YXRlKCBkaXJlY3Rpb24gKSA6IG51bGw7XG5cdFx0bGltaXRzID0gZ2V0X3dpbmRvd19sb2FkaW5nX2xpbWl0cygpO1xuXHRcdGlzX2ludGVudF9ibG9ja2VkID0gISBvcHRpb25zLmFsbG93X3dpdGhvdXRfdXNlcl9pbnRlbnQgJiYgKFxuXHRcdFx0ISBzdGF0ZVxuXHRcdFx0fHwgISBzdGF0ZS5hcm1lZFxuXHRcdFx0fHwgISBzdGF0ZS51c2VyX2ludGVudFxuXHRcdFx0fHwgRGF0ZS5ub3coKSA8IHN0YXRlLmNvb2xkb3duX3VudGlsXG5cdFx0KTtcblxuXHRcdGlmIChcblx0XHRcdCEgZGVzY3JpcHRvclxuXHRcdFx0fHwgISBzdGF0ZVxuXHRcdFx0fHwgISBlZGdlX2VudHJ5LnBheWxvYWQucmVzb3VyY2VzLmxlbmd0aFxuXHRcdFx0fHwgaXNfaW50ZW50X2Jsb2NrZWRcblx0XHRcdHx8ICdpZGxlJyAhPT0gc3RhdGUuc3RhdHVzXG5cdFx0XHR8fCAhIHRyYW5zcG9ydC51cmxcblx0XHRcdHx8ICEgdHJhbnNwb3J0LmFjdGlvblxuXHRcdFx0fHwgISB0cmFuc3BvcnQubm9uY2Vcblx0XHQpIHtcblx0XHRcdGNvbXBsZXRpb24ucmVzb2x2ZSggZmFsc2UgKTtcblx0XHRcdHJldHVybiBjb21wbGV0aW9uLnByb21pc2UoKTtcblx0XHR9XG5cdFx0Z2VuZXJhdGlvbiA9IHdpbmRvd19jYWNoZV9jb250cm9sbGVyLmJlZ2luX2VkZ2VfcmVxdWVzdCggZGlyZWN0aW9uLCBvcHRpb25zLmFsbG93X3dpdGhvdXRfdXNlcl9pbnRlbnQgKTtcblx0XHRpZiAoICEgZ2VuZXJhdGlvbiApIHtcblx0XHRcdGNvbXBsZXRpb24ucmVzb2x2ZSggZmFsc2UgKTtcblx0XHRcdHJldHVybiBjb21wbGV0aW9uLnByb21pc2UoKTtcblx0XHR9XG5cdFx0cmVxdWVzdF92YWx1ZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgZGVzY3JpcHRvciwge1xuXHRcdFx0YWN0aW9uOiB0cmFuc3BvcnQuYWN0aW9uLFxuXHRcdFx0bm9uY2U6IHRyYW5zcG9ydC5ub25jZSxcblx0XHRcdHJlcXVlc3RfZ2VuZXJhdGlvbjogZ2VuZXJhdGlvbixcblx0XHRcdHJlc291cmNlX3ZpZXdfY29udGV4dDogU3RyaW5nKCBlZGdlX2VudHJ5LnBheWxvYWQud2luZG93X2NvbnRleHQucmVzb3VyY2Vfdmlld19jb250ZXh0IHx8ICcnIClcblx0XHR9ICk7XG5cdFx0aWYgKCAhIG9wdGlvbnMuc2lsZW50ICkge1xuXHRcdFx0cmVuZGVyX2VkZ2Vfc3RhdGUoIGRpcmVjdGlvbiApO1xuXHRcdFx0YW5ub3VuY2UoICdwcmV2aW91cycgPT09IGRpcmVjdGlvbiA/IHNldHRpbmdzLmkxOG4ubG9hZGluZ19wcmV2aW91c19kYXRlcyA6IHNldHRpbmdzLmkxOG4ubG9hZGluZ19uZXh0X2RhdGVzICk7XG5cdFx0fVxuXHRcdHJlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcblx0XHRcdHVybDogdHJhbnNwb3J0LnVybCxcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdGRhdGE6IHJlcXVlc3RfdmFsdWVzLFxuXHRcdFx0dGltZW91dDogbGltaXRzLnJlcXVlc3RfdGltZW91dF9tc1xuXHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCAhIHdpbmRvd19jYWNoZV9jb250cm9sbGVyLmlzX2VkZ2VfZ2VuZXJhdGlvbl9jdXJyZW50KCBkaXJlY3Rpb24sIGdlbmVyYXRpb24gKSApIHtcblx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgcmVzcG9uc2UuZGF0YS53aW5kb3cgfHwgTnVtYmVyKCByZXNwb25zZS5kYXRhLndpbmRvdy5yZXF1ZXN0X2dlbmVyYXRpb24gKSAhPT0gZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0d2luZG93X2NhY2hlX2NvbnRyb2xsZXIubWFya19lZGdlX2Vycm9yKCBkaXJlY3Rpb24sIGdlbmVyYXRpb24gKTtcblx0XHRcdFx0aWYgKCAhIG9wdGlvbnMuc2lsZW50ICkge1xuXHRcdFx0XHRcdHJlbmRlcl9lZGdlX3N0YXRlKCBkaXJlY3Rpb24gKTtcblx0XHRcdFx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi5lZGdlX2xvYWRfZmFpbGVkICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBjYWNoZV9hZGphY2VudF93aW5kb3coIHJlc3BvbnNlLmRhdGEgKSApIHtcblx0XHRcdFx0d2luZG93X2NhY2hlX2NvbnRyb2xsZXIubWFya19lZGdlX2Vycm9yKCBkaXJlY3Rpb24sIGdlbmVyYXRpb24gKTtcblx0XHRcdFx0aWYgKCAhIG9wdGlvbnMuc2lsZW50ICkge1xuXHRcdFx0XHRcdHJlbmRlcl9lZGdlX3N0YXRlKCBkaXJlY3Rpb24gKTtcblx0XHRcdFx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi5lZGdlX2xvYWRfZmFpbGVkICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyaW1fd2luZG93X3N0b3JlKCk7XG5cdFx0XHR3aW5kb3dfY2FjaGVfY29udHJvbGxlci5tYXJrX2VkZ2VfbG9hZGVkKCBkaXJlY3Rpb24sIGdlbmVyYXRpb24gKTtcblx0XHRcdGlmICggISBvcHRpb25zLmRlZmVyX3JlbmRlciApIHtcblx0XHRcdFx0cmVuZGVyX3dpbmRvd19zdG9yZSggY2FwdHVyZV9heGlzX2FuY2hvcigpLCBzZXR0aW5ncy5pMThuLmFkamFjZW50X2RhdGVzX2xvYWRlZCApO1xuXHRcdFx0fVxuXHRcdFx0Y29tcGxldGlvbi5yZXNvbHZlKCByZXNwb25zZS5kYXRhICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggcmVxdWVzdCwgcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRpZiAoICEgd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuaXNfZWRnZV9nZW5lcmF0aW9uX2N1cnJlbnQoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiApIHx8ICdhYm9ydCcgPT09IHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHRjb21wbGV0aW9uLnJlamVjdCggZmFsc2UgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0d2luZG93X2NhY2hlX2NvbnRyb2xsZXIubWFya19lZGdlX2Vycm9yKCBkaXJlY3Rpb24sIGdlbmVyYXRpb24gKTtcblx0XHRcdGlmICggISBvcHRpb25zLnNpbGVudCApIHtcblx0XHRcdFx0cmVuZGVyX2VkZ2Vfc3RhdGUoIGRpcmVjdGlvbiApO1xuXHRcdFx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi5lZGdlX2xvYWRfZmFpbGVkICk7XG5cdFx0XHR9XG5cdFx0XHRjb21wbGV0aW9uLnJlamVjdCggZmFsc2UgKTtcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR3aW5kb3dfY2FjaGVfY29udHJvbGxlci5jb21wbGV0ZV9lZGdlX3JlcXVlc3QoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiApO1xuXHRcdH0gKTtcblx0XHRpZiAoIHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnNldF9lZGdlX3JlcXVlc3QoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiwgcmVxdWVzdCApICkge1xuXHRcdFx0aWYgKCAhIG9wdGlvbnMuc2lsZW50ICkge1xuXHRcdFx0XHR3aW5kb3dfY2FjaGVfY29udHJvbGxlci5zY2hlZHVsZV9lZGdlX3Nsb3dfc3RhdGUoIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHJlbmRlcl9lZGdlX3N0YXRlKCBkaXJlY3Rpb24gKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBjb21wbGV0aW9uLnByb21pc2UoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWFkIG9uZSBuZWlnaGJvciBmb3IgYSBzdGFnZWQgUmVzb3VyY2UtY29udGV4dCByZXBsYWNlbWVudC5cblx0ICpcblx0ICogVGhlIHJlc3BvbnNlIGlzIG5vdCBpbnNlcnRlZCBpbnRvIHRoZSBhY3RpdmUgY2FjaGUuIFRoZSBjYWxsZXIgY29tbWl0c1xuXHQgKiBib3RoIG5laWdoYm9ycyBhbmQgdGhlIGN1cnJlbnQgcmVzcG9uc2UgdG9nZXRoZXIgb25seSBhZnRlciBhbGwgdGhyZWUgcGFzc1xuXHQgKiB0aGUgc2FtZSBmaW5nZXJwcmludCBhbmQgZm9yZWdyb3VuZC1nZW5lcmF0aW9uIGNoZWNrcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGN1cnJlbnRfcmVzcG9uc2UgQXV0aG9yaXplZCBuZXcgY3VycmVudCB3aW5kb3cuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGdlbmVyYXRpb24gT3duaW5nIGZvcmVncm91bmQgZ2VuZXJhdGlvbi5cblx0ICogQHJldHVybiB7T2JqZWN0fSBqUXVlcnktY29tcGF0aWJsZSBjb21wbGV0aW9uIHByb21pc2UuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXF1ZXN0X3Jlc291cmNlX2NvbnRleHRfbmVpZ2hib3IoIGN1cnJlbnRfcmVzcG9uc2UsIGRpcmVjdGlvbiwgZ2VuZXJhdGlvbiApIHtcblx0XHR2YXIgdHJhbnNwb3J0ID0gc2V0dGluZ3MudHJhbnNwb3J0IHx8IHt9O1xuXHRcdHZhciB3aW5kb3dfY29udGV4dCA9IGN1cnJlbnRfcmVzcG9uc2Uud2luZG93X2NvbnRleHQgfHwge307XG5cdFx0dmFyIGRlc2NyaXB0b3JzID0gd2luZG93X2NvbnRleHQuYWRqYWNlbnRfcmVxdWVzdHMgfHwge307XG5cdFx0dmFyIGRlc2NyaXB0b3IgPSBkZXNjcmlwdG9yc1sgZGlyZWN0aW9uIF0gfHwgbnVsbDtcblx0XHR2YXIgY29tcGxldGlvbiA9IHdpbmRvdy5qUXVlcnkuRGVmZXJyZWQoKTtcblx0XHR2YXIgcmVxdWVzdF92YWx1ZXM7XG5cdFx0dmFyIGFqYXhfcmVxdWVzdCA9IG51bGw7XG5cblx0XHRpZiAoICEgZGVzY3JpcHRvciB8fCAhIHdpbmRvd19jb250ZXh0LnJlc291cmNlX3ZpZXdfY29udGV4dCApIHtcblx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCBmYWxzZSApO1xuXHRcdFx0cmV0dXJuIGNvbXBsZXRpb24ucHJvbWlzZSgpO1xuXHRcdH1cblx0XHRyZXF1ZXN0X3ZhbHVlcyA9IE9iamVjdC5hc3NpZ24oIHt9LCBkZXNjcmlwdG9yLCB7XG5cdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5hY3Rpb24sXG5cdFx0XHRub25jZTogdHJhbnNwb3J0Lm5vbmNlLFxuXHRcdFx0cmVxdWVzdF9nZW5lcmF0aW9uOiBnZW5lcmF0aW9uLFxuXHRcdFx0cmVzb3VyY2Vfdmlld19jb250ZXh0OiBTdHJpbmcoIHdpbmRvd19jb250ZXh0LnJlc291cmNlX3ZpZXdfY29udGV4dCApXG5cdFx0fSApO1xuXHRcdGFqYXhfcmVxdWVzdCA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0dXJsOiB0cmFuc3BvcnQudXJsLFxuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0ZGF0YTogcmVxdWVzdF92YWx1ZXMsXG5cdFx0XHR0aW1lb3V0OiBnZXRfd2luZG93X2xvYWRpbmdfbGltaXRzKCkucmVxdWVzdF90aW1lb3V0X21zXG5cdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHR2YXIgcmVzcG9uc2VfY29udGV4dCA9IHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgPyByZXNwb25zZS5kYXRhLndpbmRvd19jb250ZXh0IHx8IHt9IDoge307XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ISB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5pc19mb3JlZ3JvdW5kX2dlbmVyYXRpb25fY3VycmVudCggZ2VuZXJhdGlvbiApXG5cdFx0XHRcdHx8ICEgcmVzcG9uc2Vcblx0XHRcdFx0fHwgISByZXNwb25zZS5zdWNjZXNzXG5cdFx0XHRcdHx8ICEgcmVzcG9uc2UuZGF0YVxuXHRcdFx0XHR8fCAhIHJlc3BvbnNlLmRhdGEud2luZG93XG5cdFx0XHRcdHx8IE51bWJlciggcmVzcG9uc2UuZGF0YS53aW5kb3cucmVxdWVzdF9nZW5lcmF0aW9uICkgIT09IGdlbmVyYXRpb25cblx0XHRcdFx0fHwgU3RyaW5nKCByZXNwb25zZV9jb250ZXh0LnJlc291cmNlX2ZpbmdlcnByaW50IHx8ICcnICkgIT09IFN0cmluZyggd2luZG93X2NvbnRleHQucmVzb3VyY2VfZmluZ2VycHJpbnQgfHwgJycgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCBmYWxzZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb21wbGV0aW9uLnJlc29sdmUoIHJlc3BvbnNlLmRhdGEgKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIGZhbHNlICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGNvbXBsZXRpb24ucHJvbWlzZSgge1xuXHRcdFx0YWJvcnQ6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBhamF4X3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGFqYXhfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0XHRhamF4X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdGFnZSBhbmQgYXRvbWljYWxseSBjb21taXQgYSBjb21wbGV0ZSBuZXcgUmVzb3VyY2UgdGhyZWUtd2luZG93IGNhY2hlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY3VycmVudF9yZXNwb25zZSBBdXRob3JpemVkIG5ldyBjdXJyZW50IHdpbmRvdy5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGdlbmVyYXRpb24gT3duaW5nIGZvcmVncm91bmQgZ2VuZXJhdGlvbi5cblx0ICogQHJldHVybiB7T2JqZWN0fSBqUXVlcnktY29tcGF0aWJsZSBjb21wbGV0aW9uIHByb21pc2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBzdGFnZV9yZXNvdXJjZV9jb250ZXh0X3JlcGxhY2VtZW50KCBjdXJyZW50X3Jlc3BvbnNlLCBnZW5lcmF0aW9uICkge1xuXHRcdHZhciBjb21wbGV0aW9uID0gd2luZG93LmpRdWVyeS5EZWZlcnJlZCgpO1xuXHRcdHZhciBwcmV2aW91c19yZXF1ZXN0ID0gcmVxdWVzdF9yZXNvdXJjZV9jb250ZXh0X25laWdoYm9yKCBjdXJyZW50X3Jlc3BvbnNlLCAncHJldmlvdXMnLCBnZW5lcmF0aW9uICk7XG5cdFx0dmFyIG5leHRfcmVxdWVzdCA9IHJlcXVlc3RfcmVzb3VyY2VfY29udGV4dF9uZWlnaGJvciggY3VycmVudF9yZXNwb25zZSwgJ25leHQnLCBnZW5lcmF0aW9uICk7XG5cblx0XHR3aW5kb3cualF1ZXJ5LndoZW4oIHByZXZpb3VzX3JlcXVlc3QsIG5leHRfcmVxdWVzdCApLmRvbmUoIGZ1bmN0aW9uICggcHJldmlvdXNfcmVzcG9uc2UsIG5leHRfcmVzcG9uc2UgKSB7XG5cdFx0XHR2YXIgY29tbWl0dGVkO1xuXG5cdFx0XHRpZiAoICEgd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuaXNfZm9yZWdyb3VuZF9nZW5lcmF0aW9uX2N1cnJlbnQoIGdlbmVyYXRpb24gKSApIHtcblx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbW1pdHRlZCA9IHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnJlcGxhY2VfcmVzb3VyY2VfY29udGV4dChcblx0XHRcdFx0Y3VycmVudF9yZXNwb25zZSxcblx0XHRcdFx0WyBwcmV2aW91c19yZXNwb25zZSwgbmV4dF9yZXNwb25zZSBdXG5cdFx0XHQpO1xuXHRcdFx0aWYgKCAhIGNvbW1pdHRlZCApIHtcblx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIGZhbHNlICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbXBsZXRpb24ucmVzb2x2ZSggY29tbWl0dGVkICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggcHJldmlvdXNfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcHJldmlvdXNfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cHJldmlvdXNfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBuZXh0X3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIG5leHRfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0bmV4dF9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRjb21wbGV0aW9uLnJlamVjdCggZmFsc2UgKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gY29tcGxldGlvbi5wcm9taXNlKCB7XG5cdFx0XHRhYm9ydDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIHByZXZpb3VzX3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHByZXZpb3VzX3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdFx0cHJldmlvdXNfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggbmV4dF9yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBuZXh0X3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRcdFx0bmV4dF9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogRmlsbCBib3RoIG5laWdoYm9ycyBhcm91bmQgYSBuZXdseSBhdXRob3JpemVkIGZvcmVncm91bmQgd2luZG93LlxuXHQgKlxuXHQgKiBUaGUgY2VudGVyIHJlc3BvbnNlIHJlbWFpbnMgYXV0aG9yaXRhdGl2ZSBhbmQgdGhlIGZvcmVncm91bmQgb3ZlcmxheSBzdGF5c1xuXHQgKiBhY3RpdmUgdW50aWwgYm90aCBib3VuZGVkIG5laWdoYm9yIHJlYWRzIHNldHRsZS4gQSBmYWlsZWQgbmVpZ2hib3IgaXMgbGVmdFxuXHQgKiBhcyB0aGUgZXhpc3RpbmcgcmVjb3ZlcmFibGUgZWRnZSBzdGF0ZSBhbmQgZG9lcyBub3QgZGlzY2FyZCB0aGUgY2VudGVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gYW5jaG9yIEFuY2hvciByZXN0b3JlZCBhZnRlciBhbGwgbmVpZ2hib3IgcmVhZHMgc2V0dGxlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYW5ub3VuY2VtZW50IFNjcmVlbi1yZWFkZXIgY29tcGxldGlvbiBtZXNzYWdlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZm9yZWdyb3VuZF9nZW5lcmF0aW9uIE93bmluZyBmb3JlZ3JvdW5kIGdlbmVyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdH0galF1ZXJ5LWNvbXBhdGlibGUgY29tcGxldGlvbiBwcm9taXNlLlxuXHQgKi9cblx0ZnVuY3Rpb24gcHJpbWVfc3Vycm91bmRpbmdfd2luZG93cyggYW5jaG9yLCBhbm5vdW5jZW1lbnQsIGZvcmVncm91bmRfZ2VuZXJhdGlvbiApIHtcblx0XHR2YXIgY29tcGxldGlvbiA9IHdpbmRvdy5qUXVlcnkuRGVmZXJyZWQoKTtcblx0XHR2YXIgcmVtYWluaW5nID0gMjtcblx0XHR2YXIgc2V0dGxlID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0cmVtYWluaW5nIC09IDE7XG5cdFx0XHRpZiAoIDAgPCByZW1haW5pbmcgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5pc19mb3JlZ3JvdW5kX2dlbmVyYXRpb25fY3VycmVudCggZm9yZWdyb3VuZF9nZW5lcmF0aW9uICkgKSB7XG5cdFx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCBmYWxzZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0cmltX3dpbmRvd19zdG9yZSgpO1xuXHRcdFx0cmVuZGVyX3dpbmRvd19zdG9yZSggYW5jaG9yLCBhbm5vdW5jZW1lbnQgKTtcblx0XHRcdGNvbXBsZXRpb24ucmVzb2x2ZSggdHJ1ZSApO1xuXHRcdH07XG5cblx0XHRbICdwcmV2aW91cycsICduZXh0JyBdLmZvckVhY2goIGZ1bmN0aW9uICggZGlyZWN0aW9uICkge1xuXHRcdFx0dmFyIHJlcXVlc3QgPSByZXF1ZXN0X2FkamFjZW50X3dpbmRvdyggZGlyZWN0aW9uLCB7XG5cdFx0XHRcdGFsbG93X3dpdGhvdXRfdXNlcl9pbnRlbnQ6IHRydWUsXG5cdFx0XHRcdGRlZmVyX3JlbmRlcjogdHJ1ZSxcblx0XHRcdFx0c2lsZW50OiB0cnVlLFxuXHRcdFx0XHRza2lwX3Byb21vdGlvbjogdHJ1ZVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoIHJlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlcXVlc3QuYWx3YXlzICkge1xuXHRcdFx0XHRyZXF1ZXN0LmFsd2F5cyggc2V0dGxlICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZXR0bGUoKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gY29tcGxldGlvbi5wcm9taXNlKCk7XG5cdH1cblxuXHQvKipcblx0ICogQ2FuY2VsIG9uZSBpbi1mbGlnaHQgYWRqYWNlbnQgcmVhZCB3aXRob3V0IHJlcGxhY2luZyB0aGUgd29ya2luZyB3aW5kb3cuXG5cdCAqXG5cdCAqIFRoZSBlZGdlIHJlbWFpbnMgZGlzYXJtZWQgdW50aWwgdGhlIHVzZXIgbGVhdmVzIGFuZCByZS1lbnRlcnMgdGhlIHRyaWdnZXJcblx0ICogdGhyZXNob2xkLCBwcmV2ZW50aW5nIGFuIG9ic2VydmVyIGZyb20gaW1tZWRpYXRlbHkgcmVzdGFydGluZyBhIHJlcXVlc3Rcblx0ICogdGhlIHVzZXIgZXhwbGljaXRseSBjYW5jZWxsZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gUHJldmlvdXMgb3IgbmV4dCBlZGdlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2FuY2VsX2FkamFjZW50X3dpbmRvdyggZGlyZWN0aW9uICkge1xuXHRcdGlmICggISB3aW5kb3dfY2FjaGVfY29udHJvbGxlciB8fCAhIHdpbmRvd19jYWNoZV9jb250cm9sbGVyLmNhbmNlbF9lZGdlX3JlcXVlc3QoIGRpcmVjdGlvbiApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZW5kZXJfZWRnZV9zdGF0ZSggZGlyZWN0aW9uICk7XG5cdFx0YW5ub3VuY2UoIHNldHRpbmdzLmkxOG4ubG9hZGluZ19jYW5jZWxsZWQgKTtcblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgbG9hZF9idXR0b247XG5cblx0XHRcdGlmICggISBpc19pbml0aWFsaXplZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bG9hZF9idXR0b24gPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1lZGdlLWxvYWQ9XCInICsgZGlyZWN0aW9uICsgJ1wiXScgKTtcblx0XHRcdGlmICggbG9hZF9idXR0b24gKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0bG9hZF9idXR0b24uZm9jdXMoIHsgcHJldmVudFNjcm9sbDogdHJ1ZSB9ICk7XG5cdFx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0XHRsb2FkX2J1dHRvbi5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBhIHNhZmUgZnVsbC13aW5kb3cgcmVhZCBlcnJvciB3aXRob3V0IGV4cG9zaW5nIHRyYW5zcG9ydCBkZXRhaWxzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZXJyb3JfbWVzc2FnZSBBdXRob3JpemVkIGVycm9yIHRleHQsIG9yIHRoZSBnZW5lcmljIGZhbGxiYWNrLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVuZGVyX3dpbmRvd19lcnJvciggZXJyb3JfbWVzc2FnZSApIHtcblx0XHR2YXIgc3RhdGVfaG9zdCA9IG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLXN0YXRlXScgKTtcblxuXHRcdHNldHRpbmdzLmkxOG4uZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UgfHwgc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlO1xuXHRcdGlmICggc3RhdGVfaG9zdCApIHtcblx0XHRcdHN0YXRlX2hvc3QuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRyZW5kZXJfdGVtcGxhdGUoIHN0YXRlX2hvc3QsICdlcnJvcicsIHNldHRpbmdzICk7XG5cdFx0fVxuXHRcdGFubm91bmNlKCBzZXR0aW5ncy5pMThuLmVycm9yX21lc3NhZ2UgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgdGhlIGN1cnJlbnQgc2VydmVyLWFwcHJvdmVkIGRheSBvciBjYWxlbmRhci1tb250aCBzcGFuIHRvIGEgcmVxdWVzdC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3RfdmFsdWVzIE11dGFibGUgcmVxdWVzdCB2YWx1ZXMuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJlc2VydmVfc3RhcnQgV2hldGhlciBhIG1vbnRoIHdpbmRvdyBtdXN0IGtlZXAgaXRzIGV4YWN0IHN0YXJ0LlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFRoZSBzdXBwbGllZCByZXF1ZXN0IHZhbHVlcy5cblx0ICovXG5cdGZ1bmN0aW9uIGFkZF9jdXJyZW50X3dpbmRvd19zcGFuKCByZXF1ZXN0X3ZhbHVlcywgcHJlc2VydmVfc3RhcnQgKSB7XG5cdFx0aWYgKCAwIDwgTnVtYmVyKCBzZXR0aW5ncy53aW5kb3cud2luZG93X21vbnRocyApICkge1xuXHRcdFx0cmVxdWVzdF92YWx1ZXMud2luZG93X21vbnRocyA9IE51bWJlciggc2V0dGluZ3Mud2luZG93LndpbmRvd19tb250aHMgKTtcblx0XHRcdGlmICggcHJlc2VydmVfc3RhcnQgKSB7XG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzLmFuY2hvcl9hdCA9IHNldHRpbmdzLmN1cnJlbnRfYXhpcyA/IHNldHRpbmdzLmN1cnJlbnRfYXhpcy5zdGFydF9hdCA6IHNldHRpbmdzLmF4aXMuc3RhcnRfYXQ7XG5cdFx0XHRcdHJlcXVlc3RfdmFsdWVzLmFuY2hvcl9yYXRpbyA9IDA7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlcXVlc3RfdmFsdWVzLndpbmRvd19kYXlzID0gTnVtYmVyKCBzZXR0aW5ncy53aW5kb3cud2luZG93X2RheXMgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVxdWVzdF92YWx1ZXM7XG5cdH1cblxuXHQvKipcblx0ICogTG9hZCBvbmUgYm91bmRlZCByZWFkLW9ubHkgVGltZWxpbmUgd2luZG93LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdF9vcHRpb25zIFZhbGlkYXRlZCBVSSBjaG9pY2VzLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gYW5jaG9yIENhcHR1cmVkIGFuY2hvciBzdGF0ZS5cblx0ICogQHBhcmFtIHtib29sZWFufSBtYXlfcmVkdWNlIFdoZXRoZXIgb25lIHNlcnZlci1zdWdnZXN0ZWQgcmV0cnkgaXMgYWxsb3dlZC5cblx0ICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3RfZmVlZGJhY2sgRm9yZWdyb3VuZCBsb2FkaW5nIGFuZCBjb21wbGV0aW9uIG1lc3NhZ2VzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IGpRdWVyeS1jb21wYXRpYmxlIGNvbXBsZXRpb24gcHJvbWlzZS5cblx0ICovXG5cdGZ1bmN0aW9uIHJlcXVlc3Rfd2luZG93KCByZXF1ZXN0X29wdGlvbnMsIGFuY2hvciwgbWF5X3JlZHVjZSwgcmVxdWVzdF9mZWVkYmFjayApIHtcblx0XHR2YXIgdHJhbnNwb3J0ID0gc2V0dGluZ3MudHJhbnNwb3J0IHx8IHt9O1xuXHRcdHZhciBmZWVkYmFjayA9IE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdGxvYWRpbmc6IHNldHRpbmdzLmkxOG4ubG9hZGluZyxcblx0XHRcdGNvbXBsZXRlOiBzZXR0aW5ncy5pMThuLnN0YXR1c19yZWFkeVxuXHRcdH0sIHJlcXVlc3RfZmVlZGJhY2sgfHwge30gKTtcblx0XHR2YXIgZ2VuZXJhdGlvbjtcblx0XHR2YXIgcmVxdWVzdF92YWx1ZXM7XG5cdFx0dmFyIHJlcXVlc3Q7XG5cdFx0dmFyIHJlc291cmNlX3JlcGxhY2VtZW50O1xuXHRcdHZhciBjb21wbGV0aW9uID0gZmVlZGJhY2suY29tcGxldGlvbiAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZmVlZGJhY2suY29tcGxldGlvbi5yZXNvbHZlXG5cdFx0XHQ/IGZlZWRiYWNrLmNvbXBsZXRpb25cblx0XHRcdDogKCB3aW5kb3cualF1ZXJ5ID8gd2luZG93LmpRdWVyeS5EZWZlcnJlZCgpIDogbnVsbCApO1xuXHRcdHZhciBmaW5pc2hfcmVxdWVzdCA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggISB3aW5kb3dfY2FjaGVfY29udHJvbGxlci5pc19mb3JlZ3JvdW5kX2dlbmVyYXRpb25fY3VycmVudCggZ2VuZXJhdGlvbiApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR3aW5kb3dfY2FjaGVfY29udHJvbGxlci5jb21wbGV0ZV9mb3JlZ3JvdW5kX3JlcXVlc3QoIGdlbmVyYXRpb24gKTtcblx0XHRcdHNldF9mb3JlZ3JvdW5kX3JlcXVlc3RfbG9hZGluZyggZmFsc2UsICcnLCBnZW5lcmF0aW9uICk7XG5cdFx0fTtcblxuXHRcdGlmICggaXNfYXhpc193aW5kb3dfbG9hZGluZ19sb2NrZWQgKSB7XG5cdFx0XHRpZiAoIGNvbXBsZXRpb24gKSB7XG5cdFx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCB7IG1lc3NhZ2U6ICcnIH0gKTtcblx0XHRcdFx0cmV0dXJuIGNvbXBsZXRpb24ucHJvbWlzZSgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICggISB3aW5kb3cualF1ZXJ5IHx8ICEgdHJhbnNwb3J0LnVybCB8fCAhIHRyYW5zcG9ydC5hY3Rpb24gfHwgISB0cmFuc3BvcnQubm9uY2UgKSB7XG5cdFx0XHRyZW5kZXJfd2luZG93X2Vycm9yKCBzZXR0aW5ncy5pMThuLmVycm9yX21lc3NhZ2UgKTtcblx0XHRcdGlmICggY29tcGxldGlvbiApIHtcblx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIHsgbWVzc2FnZTogc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlIH0gKTtcblx0XHRcdFx0cmV0dXJuIGNvbXBsZXRpb24ucHJvbWlzZSgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICggZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIgJiYgZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX2NvbnRyb2xsZXIuaXNfYWN0aXZlKCkgJiYgISBmZWVkYmFjay5wcmVzZXJ2ZV9zZWxlY3Rpb24gKSB7XG5cdFx0XHRlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlci5jYW5jZWwoIGZhbHNlICk7XG5cdFx0fVxuXHRcdGFib3J0X2VkZ2VfcmVxdWVzdHMoKTtcblx0XHRjYW5jZWxfYXhpc19hbmNob3JfcmVzdG9yYXRpb24oKTtcblx0XHRnZW5lcmF0aW9uID0gd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuYmVnaW5fZm9yZWdyb3VuZF9yZXF1ZXN0KCk7XG5cdFx0cmVxdWVzdF92YWx1ZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgcmVxdWVzdF9vcHRpb25zLCB7XG5cdFx0XHRhY3Rpb246IHRyYW5zcG9ydC5hY3Rpb24sXG5cdFx0XHRub25jZTogdHJhbnNwb3J0Lm5vbmNlLFxuXHRcdFx0cmVxdWVzdF9nZW5lcmF0aW9uOiBnZW5lcmF0aW9uXG5cdFx0fSApO1xuXHRcdGlmICggISByZXF1ZXN0X3ZhbHVlcy5yZXNvdXJjZV92aWV3X2NvbnRleHQgJiYgc2V0dGluZ3Mud2luZG93X2NvbnRleHQgJiYgc2V0dGluZ3Mud2luZG93X2NvbnRleHQucmVzb3VyY2Vfdmlld19jb250ZXh0ICkge1xuXHRcdFx0cmVxdWVzdF92YWx1ZXMucmVzb3VyY2Vfdmlld19jb250ZXh0ID0gU3RyaW5nKCBzZXR0aW5ncy53aW5kb3dfY29udGV4dC5yZXNvdXJjZV92aWV3X2NvbnRleHQgKTtcblx0XHR9XG5cdFx0c2V0X2ZvcmVncm91bmRfcmVxdWVzdF9sb2FkaW5nKCB0cnVlLCBmZWVkYmFjay5sb2FkaW5nLCBnZW5lcmF0aW9uICk7XG5cdFx0cmVxdWVzdCA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0dXJsOiB0cmFuc3BvcnQudXJsLFxuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0ZGF0YTogcmVxdWVzdF92YWx1ZXMsXG5cdFx0XHR0aW1lb3V0OiBnZXRfd2luZG93X2xvYWRpbmdfbGltaXRzKCkucmVxdWVzdF90aW1lb3V0X21zXG5cdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoICEgd2luZG93X2NhY2hlX2NvbnRyb2xsZXIuaXNfZm9yZWdyb3VuZF9nZW5lcmF0aW9uX2N1cnJlbnQoIGdlbmVyYXRpb24gKSApIHtcblx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIHsgbWVzc2FnZTogc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlIH0gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgfHwgISByZXNwb25zZS5kYXRhLndpbmRvdyB8fCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEud2luZG93LnJlcXVlc3RfZ2VuZXJhdGlvbiApICE9PSBnZW5lcmF0aW9uICkge1xuXHRcdFx0XHRzaG93X3N0YW5kYXJkX2FkbWluX21lc3NhZ2UoIHNldHRpbmdzLmkxOG4uZXJyb3JfbWVzc2FnZSwgJ2Vycm9yJywgMzAwMDAgKTtcblx0XHRcdFx0cmVuZGVyX3dpbmRvd19lcnJvciggc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlICk7XG5cdFx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCB7IG1lc3NhZ2U6IHNldHRpbmdzLmkxOG4uZXJyb3JfbWVzc2FnZSB9ICk7XG5cdFx0XHRcdGZpbmlzaF9yZXF1ZXN0KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggYW5jaG9yLnRhcmdldF9kYXRlICkge1xuXHRcdFx0XHRpZiAoICEgcmVzb2x2ZV9yZXNwb25zZV9kYXRlX2FuY2hvciggYW5jaG9yLCByZXNwb25zZS5kYXRhLmF4aXMgfHwge30gKSAmJiByZXNwb25zZS5kYXRhLmF4aXMgJiYgcmVzcG9uc2UuZGF0YS5heGlzLnN0YXJ0X2F0ICkge1xuXHRcdFx0XHRcdGFuY2hvci5hdCA9IHJlc3BvbnNlLmRhdGEuYXhpcy5zdGFydF9hdDtcblx0XHRcdFx0XHRkZWxldGUgYW5jaG9yLmVwb2NoO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCBhbmNob3IudXNlX3Jlc3BvbnNlX3N0YXJ0ICYmIHJlc3BvbnNlLmRhdGEuYXhpcyAmJiByZXNwb25zZS5kYXRhLmF4aXMuc3RhcnRfYXQgKSB7XG5cdFx0XHRcdGFuY2hvci5hdCA9IHJlc3BvbnNlLmRhdGEuYXhpcy5zdGFydF9hdDtcblx0XHRcdH1cblx0XHRcdGlmIChcblx0XHRcdFx0d2luZG93X2NhY2hlX2NvbnRyb2xsZXIuZ2V0X3Jlc291cmNlX2ZpbmdlcnByaW50KClcblx0XHRcdFx0JiYgcmVzcG9uc2UuZGF0YS53aW5kb3dfY29udGV4dFxuXHRcdFx0XHQmJiByZXNwb25zZS5kYXRhLndpbmRvd19jb250ZXh0LnJlc291cmNlX2ZpbmdlcnByaW50XG5cdFx0XHRcdCYmIHdpbmRvd19jYWNoZV9jb250cm9sbGVyLmdldF9yZXNvdXJjZV9maW5nZXJwcmludCgpICE9PSBTdHJpbmcoIHJlc3BvbnNlLmRhdGEud2luZG93X2NvbnRleHQucmVzb3VyY2VfZmluZ2VycHJpbnQgKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJlc291cmNlX3JlcGxhY2VtZW50ID0gc3RhZ2VfcmVzb3VyY2VfY29udGV4dF9yZXBsYWNlbWVudCggcmVzcG9uc2UuZGF0YSwgZ2VuZXJhdGlvbiApO1xuXHRcdFx0XHR3aW5kb3dfY2FjaGVfY29udHJvbGxlci5zZXRfZm9yZWdyb3VuZF9yZXF1ZXN0KCBnZW5lcmF0aW9uLCByZXNvdXJjZV9yZXBsYWNlbWVudCApO1xuXHRcdFx0XHRyZXNvdXJjZV9yZXBsYWNlbWVudC5kb25lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0c2V0dGluZ3MucHJlZmVyZW5jZXMgPSBPYmplY3QuYXNzaWduKCB7fSwgc2V0dGluZ3MucHJlZmVyZW5jZXMgfHwge30sIHtcblx0XHRcdFx0XHRcdGV4cGFuZGVkX3Jlc291cmNlX2lkczogQXJyYXkuaXNBcnJheSggcmVzcG9uc2UuZGF0YS5wcmVmZXJlbmNlcyAmJiByZXNwb25zZS5kYXRhLnByZWZlcmVuY2VzLmV4cGFuZGVkX3Jlc291cmNlX2lkcyApXG5cdFx0XHRcdFx0XHRcdD8gcmVzcG9uc2UuZGF0YS5wcmVmZXJlbmNlcy5leHBhbmRlZF9yZXNvdXJjZV9pZHMuc2xpY2UoKVxuXHRcdFx0XHRcdFx0XHQ6IFtdLFxuXHRcdFx0XHRcdFx0ZXhwYW5kZWRfcGFyZW50X2lkczogQXJyYXkuaXNBcnJheSggcmVzcG9uc2UuZGF0YS5wcmVmZXJlbmNlcyAmJiByZXNwb25zZS5kYXRhLnByZWZlcmVuY2VzLmV4cGFuZGVkX3BhcmVudF9pZHMgKVxuXHRcdFx0XHRcdFx0XHQ/IHJlc3BvbnNlLmRhdGEucHJlZmVyZW5jZXMuZXhwYW5kZWRfcGFyZW50X2lkcy5zbGljZSgpXG5cdFx0XHRcdFx0XHRcdDogW11cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0cmVuZGVyX3dpbmRvd19zdG9yZSggYW5jaG9yLCBmZWVkYmFjay5jb21wbGV0ZSApO1xuXHRcdFx0XHRcdGlmICggZmVlZGJhY2sucGVyc2lzdF9wcmVmZXJlbmNlcyApIHtcblx0XHRcdFx0XHRcdHByZWZlcmVuY2VfYW5jaG9yX2RhdGUgPSBTdHJpbmcoIHJlc3BvbnNlLmRhdGEud2luZG93LnN0YXJ0X2RhdGUgfHwgcmVzcG9uc2UuZGF0YS53aW5kb3cuYW5jaG9yX2RhdGUgfHwgcHJlZmVyZW5jZV9hbmNob3JfZGF0ZSApO1xuXHRcdFx0XHRcdFx0cHJlZmVyZW5jZV9hbmNob3JfcmF0aW8gPSAwO1xuXHRcdFx0XHRcdFx0cXVldWVfdGltZWxpbmVfcHJlZmVyZW5jZXNfc2F2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoICEgZmVlZGJhY2suc3VwcHJlc3NfY29tcGxldGVfbWVzc2FnZSApIHtcblx0XHRcdFx0XHRcdHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSggZmVlZGJhY2suY29tcGxldGUsICdzdWNjZXNzJywgMzAwMCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb21wbGV0aW9uLnJlc29sdmUoIHJlc3BvbnNlLmRhdGEgKTtcblx0XHRcdFx0XHRmaW5pc2hfcmVxdWVzdCgpO1xuXHRcdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSggc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlLCAnZXJyb3InLCAzMDAwMCApO1xuXHRcdFx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCB7IG1lc3NhZ2U6IHNldHRpbmdzLmkxOG4uZXJyb3JfbWVzc2FnZSB9ICk7XG5cdFx0XHRcdFx0ZmluaXNoX3JlcXVlc3QoKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXNldF93aW5kb3dfc3RvcmUoIHJlc3BvbnNlLmRhdGEgKTtcblx0XHRcdHByaW1lX3N1cnJvdW5kaW5nX3dpbmRvd3MoIGFuY2hvciwgZmVlZGJhY2suY29tcGxldGUsIGdlbmVyYXRpb24gKS5kb25lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggZmVlZGJhY2sucGVyc2lzdF9wcmVmZXJlbmNlcyApIHtcblx0XHRcdFx0XHRwcmVmZXJlbmNlX2FuY2hvcl9kYXRlID0gU3RyaW5nKCByZXNwb25zZS5kYXRhLndpbmRvdy5zdGFydF9kYXRlIHx8IHJlc3BvbnNlLmRhdGEud2luZG93LmFuY2hvcl9kYXRlIHx8IHByZWZlcmVuY2VfYW5jaG9yX2RhdGUgKTtcblx0XHRcdFx0XHRwcmVmZXJlbmNlX2FuY2hvcl9yYXRpbyA9IDA7XG5cdFx0XHRcdFx0cXVldWVfdGltZWxpbmVfcHJlZmVyZW5jZXNfc2F2ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggISBmZWVkYmFjay5zdXBwcmVzc19jb21wbGV0ZV9tZXNzYWdlICkge1xuXHRcdFx0XHRcdHNob3dfc3RhbmRhcmRfYWRtaW5fbWVzc2FnZSggZmVlZGJhY2suY29tcGxldGUsICdzdWNjZXNzJywgMzAwMCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbXBsZXRpb24ucmVzb2x2ZSggcmVzcG9uc2UuZGF0YSApO1xuXHRcdFx0XHRmaW5pc2hfcmVxdWVzdCgpO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0Y29tcGxldGlvbi5yZWplY3QoIHsgbWVzc2FnZTogc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlIH0gKTtcblx0XHRcdH0gKTtcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCByZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdHZhciBlcnJvciA9IHJlcXVlc3QucmVzcG9uc2VKU09OICYmIHJlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgPyByZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhIDoge307XG5cdFx0XHR2YXIgc3VnZ2VzdGVkX2RheXMgPSBlcnJvci5kZXRhaWxzID8gTnVtYmVyKCBlcnJvci5kZXRhaWxzLnN1Z2dlc3RlZF93aW5kb3dfZGF5cyApIDogMDtcblxuXHRcdFx0aWYgKCAhIHdpbmRvd19jYWNoZV9jb250cm9sbGVyLmlzX2ZvcmVncm91bmRfZ2VuZXJhdGlvbl9jdXJyZW50KCBnZW5lcmF0aW9uICkgfHwgJ2Fib3J0JyA9PT0gcmVxdWVzdF9zdGF0dXMgKSB7XG5cdFx0XHRcdGNvbXBsZXRpb24ucmVqZWN0KCB7IG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2UgfHwgc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlIH0gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKFxuXHRcdFx0XHRtYXlfcmVkdWNlICYmXG5cdFx0XHRcdHN1Z2dlc3RlZF9kYXlzICYmXG5cdFx0XHRcdCggMCA8IE51bWJlciggcmVxdWVzdF92YWx1ZXMud2luZG93X21vbnRocyApIHx8IHN1Z2dlc3RlZF9kYXlzIDwgTnVtYmVyKCByZXF1ZXN0X3ZhbHVlcy53aW5kb3dfZGF5cyApIClcblx0XHRcdCkge1xuXHRcdFx0XHRhbm5vdW5jZSggc2V0dGluZ3MuaTE4bi53aW5kb3dfcmVkdWNlZCApO1xuXHRcdFx0XHRkZWxldGUgcmVxdWVzdF92YWx1ZXMud2luZG93X21vbnRocztcblx0XHRcdFx0aWYgKCBhbmNob3IudGFyZ2V0X2RhdGUgKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHJlcXVlc3RfdmFsdWVzLmFuY2hvcl9hdDtcblx0XHRcdFx0XHRyZXF1ZXN0X3ZhbHVlcy5hbmNob3JfZGF0ZSA9IGFuY2hvci50YXJnZXRfZGF0ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXF1ZXN0X3ZhbHVlcy5hbmNob3JfYXQgPSBhbmNob3IuYXQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVxdWVzdF92YWx1ZXMuYW5jaG9yX3JhdGlvID0gYW5jaG9yLnJhdGlvO1xuXHRcdFx0XHRyZXF1ZXN0X3ZhbHVlcy53aW5kb3dfZGF5cyA9IHN1Z2dlc3RlZF9kYXlzO1xuXHRcdFx0XHRyZXF1ZXN0X3dpbmRvdyggcmVxdWVzdF92YWx1ZXMsIGFuY2hvciwgZmFsc2UsIHtcblx0XHRcdFx0XHRsb2FkaW5nOiBzZXR0aW5ncy5pMThuLmxvYWRpbmdfcmVkdWNlZF93aW5kb3csXG5cdFx0XHRcdFx0Y29tcGxldGU6IGZlZWRiYWNrLmNvbXBsZXRlLFxuXHRcdFx0XHRcdHBlcnNpc3RfcHJlZmVyZW5jZXM6IGZlZWRiYWNrLnBlcnNpc3RfcHJlZmVyZW5jZXMsXG5cdFx0XHRcdFx0c3VwcHJlc3NfY29tcGxldGVfbWVzc2FnZTogZmVlZGJhY2suc3VwcHJlc3NfY29tcGxldGVfbWVzc2FnZSxcblx0XHRcdFx0XHRwcmVzZXJ2ZV9zZWxlY3Rpb246IGZlZWRiYWNrLnByZXNlcnZlX3NlbGVjdGlvbixcblx0XHRcdFx0XHRjb21wbGV0aW9uOiBjb21wbGV0aW9uXG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c2hvd19zdGFuZGFyZF9hZG1pbl9tZXNzYWdlKCBlcnJvci5tZXNzYWdlIHx8IHNldHRpbmdzLmkxOG4uZXJyb3JfbWVzc2FnZSwgJ2Vycm9yJywgMzAwMDAgKTtcblx0XHRcdHJlbmRlcl93aW5kb3dfZXJyb3IoIGVycm9yLm1lc3NhZ2UgfHwgc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlICk7XG5cdFx0XHRjb21wbGV0aW9uLnJlamVjdCggeyBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIHx8IHNldHRpbmdzLmkxOG4uZXJyb3JfbWVzc2FnZSB9ICk7XG5cdFx0XHRmaW5pc2hfcmVxdWVzdCgpO1xuXHRcdH0gKTtcblx0XHR3aW5kb3dfY2FjaGVfY29udHJvbGxlci5zZXRfZm9yZWdyb3VuZF9yZXF1ZXN0KCBnZW5lcmF0aW9uLCByZXF1ZXN0ICk7XG5cblx0XHRyZXR1cm4gY29tcGxldGlvbi5wcm9taXNlKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVwbGFjZSB0aGUgYWN0aXZlIFJlc291cmNlIHBhZ2Ugd2hpbGUgcHJlc2VydmluZyB0aGUgdmlzaWJsZSBkYXRlIGFuY2hvci5cblx0ICpcblx0ICogUGhhc2UgNCBzZWxlY3RvciBVSSBtYXkgY2FsbCB0aGlzIHNlcnZlci1hdXRob3JpdGF0aXZlIGJvdW5kYXJ5IGFmdGVyIGFcblx0ICogc3VjY2Vzc2Z1bCBSZXNvdXJjZS12aWV3IHNhdmUuIE5vIGRyYWZ0IElEcyBhcmUgYWNjZXB0ZWQgaGVyZTsgb25seSB0aGVcblx0ICogc2lnbmVkIGNvbnRleHQgcmV0dXJuZWQgYnkgdGhlIHNhdmUvcmVzZXQgZW5kcG9pbnQgaXMgc3VibWl0dGVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcmVzb3VyY2Vfdmlld19jb250ZXh0IFNpZ25lZCBzZXJ2ZXIgUmVzb3VyY2UtdmlldyBjb250ZXh0LlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0galF1ZXJ5LWNvbXBhdGlibGUgY29tcGxldGlvbiBwcm9taXNlIHdoZW4gYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVwbGFjZV9yZXNvdXJjZV92aWV3KCByZXNvdXJjZV92aWV3X2NvbnRleHQgKSB7XG5cdFx0dmFyIGFuY2hvciA9IGNhcHR1cmVfYXhpc19hbmNob3IoKTtcblxuXHRcdGlmICggISByZXNvdXJjZV92aWV3X2NvbnRleHQgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVxdWVzdF93aW5kb3coIGFkZF9jdXJyZW50X3dpbmRvd19zcGFuKCB7XG5cdFx0XHRhbmNob3JfYXQ6IGFuY2hvci5hdCxcblx0XHRcdGFuY2hvcl9yYXRpbzogYW5jaG9yLnJhdGlvLFxuXHRcdFx0d2luZG93X3Bvc2l0aW9uOiAwLFxuXHRcdFx0dmlldzogc2V0dGluZ3MuYXhpcy52aWV3LFxuXHRcdFx0cmVzb3VyY2Vfdmlld19jb250ZXh0OiBTdHJpbmcoIHJlc291cmNlX3ZpZXdfY29udGV4dCApXG5cdFx0fSwgdHJ1ZSApLCBhbmNob3IsIHRydWUsIHtcblx0XHRcdGxvYWRpbmc6IHNldHRpbmdzLmkxOG4ucmVsb2FkaW5nX3RpbWVsaW5lLFxuXHRcdFx0Y29tcGxldGU6IHNldHRpbmdzLmkxOG4uc3RhdHVzX3JlYWR5LFxuXHRcdFx0cGVyc2lzdF9wcmVmZXJlbmNlczogZmFsc2Vcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogTW92ZSBrZXlib2FyZCBmb2N1cyBiZXR3ZWVuIHNlcnZlci1kZWZpbmVkIGF4aXMgY2VsbHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgS2V5IGV2ZW50IGZyb20gdGhlIGF4aXMuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfYXhpc19rZXlkb3duKCBldmVudCApIHtcblx0XHRpZiAoIGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIgJiYgYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlci5oYW5kbGVfa2V5ZG93biggZXZlbnQgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCBlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlciAmJiBlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlci5oYW5kbGVfa2V5ZG93biggZXZlbnQgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCB0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlciApIHtcblx0XHRcdHRvb2xiYXJfbmF2aWdhdGlvbl9jb250cm9sbGVyLmhhbmRsZV9rZXlkb3duKCBldmVudCApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBIYW5kbGUgVGltZWxpbmUgc2hlbGwgYWN0aW9ucyB0aHJvdWdoIG9uZSBkZWxlZ2F0ZWQgbGlzdGVuZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgQnJvd3NlciBjbGljayBldmVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggZXZlbnQgKSB7XG5cdFx0dmFyIHJldHJ5X2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yZXRyeV0nICk7XG5cdFx0dmFyIGVkZ2VfbG9hZF9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtZWRnZS1sb2FkXScgKTtcblx0XHR2YXIgZWRnZV9jYW5jZWxfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLWVkZ2UtY2FuY2VsXScgKTtcblx0XHR2YXIgcm93X3RvZ2dsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yb3ctdG9nZ2xlXScgKTtcblx0XHR2YXIgaGllcmFyY2h5X3RvZ2dsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1oaWVyYXJjaHktdG9nZ2xlXScgKTtcblx0XHR2YXIgYW5jaG9yO1xuXHRcdHZhciBkaXJlY3Rpb247XG5cblx0XHRpZiAoIGJvb2tpbmdfaW50ZXJhY3Rpb25zX2NvbnRyb2xsZXIgJiYgYm9va2luZ19pbnRlcmFjdGlvbnNfY29udHJvbGxlci5oYW5kbGVfY2xpY2soIGV2ZW50ICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlciAmJiBlbXB0eV9yYW5nZV9zZWxlY3Rpb25fY29udHJvbGxlci5oYW5kbGVfY2xpY2soIGV2ZW50ICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCByZW5kZXJpbmdfY29udHJvbGxlciAmJiByZW5kZXJpbmdfY29udHJvbGxlci5oYW5kbGVfcm93X3ByZXNlbnRhdGlvbl9jbGljayggZXZlbnQgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIGVkZ2VfY2FuY2VsX2J1dHRvbiApIHtcblx0XHRcdGNhbmNlbF9hZGphY2VudF93aW5kb3coIGVkZ2VfY2FuY2VsX2J1dHRvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtZWRnZS1jYW5jZWwnICkgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIGVkZ2VfbG9hZF9idXR0b24gKSB7XG5cdFx0XHRkaXJlY3Rpb24gPSBlZGdlX2xvYWRfYnV0dG9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1lZGdlLWxvYWQnICk7XG5cdFx0XHRpZiAoIHdpbmRvd19jYWNoZV9jb250cm9sbGVyICYmIHdpbmRvd19jYWNoZV9jb250cm9sbGVyLnByZXBhcmVfZWRnZV9yZXRyeSggZGlyZWN0aW9uICkgKSB7XG5cdFx0XHRcdGFjdGl2YXRlX2FkamFjZW50X25hdmlnYXRpb25faW50ZW50KCBkaXJlY3Rpb24sIHRydWUgKTtcblx0XHRcdFx0cmVxdWVzdF9hZGphY2VudF93aW5kb3coIGRpcmVjdGlvbiApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggcmV0cnlfYnV0dG9uICkge1xuXHRcdFx0YW5jaG9yID0gY2FwdHVyZV9heGlzX2FuY2hvcigpO1xuXHRcdFx0cmVxdWVzdF93aW5kb3coIGFkZF9jdXJyZW50X3dpbmRvd19zcGFuKCB7XG5cdFx0XHRcdGFuY2hvcl9hdDogYW5jaG9yLmF0LFxuXHRcdFx0XHRhbmNob3JfcmF0aW86IGFuY2hvci5yYXRpbyxcblx0XHRcdFx0d2luZG93X3Bvc2l0aW9uOiAwLFxuXHRcdFx0XHR2aWV3OiBzZXR0aW5ncy5heGlzLnZpZXdcblx0XHRcdH0sIHRydWUgKSwgYW5jaG9yLCB0cnVlLCB7XG5cdFx0XHRcdGxvYWRpbmc6IHNldHRpbmdzLmkxOG4ucmVsb2FkaW5nX3RpbWVsaW5lLFxuXHRcdFx0XHRjb21wbGV0ZTogc2V0dGluZ3MuaTE4bi5zdGF0dXNfcmVhZHlcblx0XHRcdH0gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIHRvb2xiYXJfbmF2aWdhdGlvbl9jb250cm9sbGVyICYmIHRvb2xiYXJfbmF2aWdhdGlvbl9jb250cm9sbGVyLmhhbmRsZV9jbGljayggZXZlbnQgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIGhpZXJhcmNoeV90b2dnbGUgKSB7XG5cdFx0XHRzZXRfaGllcmFyY2h5X2V4cGFuZGVkKFxuXHRcdFx0XHROdW1iZXIoIGhpZXJhcmNoeV90b2dnbGUuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWhpZXJhcmNoeS10b2dnbGUnICkgKSxcblx0XHRcdFx0J3RydWUnICE9PSBoaWVyYXJjaHlfdG9nZ2xlLmdldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnICksXG5cdFx0XHRcdGhpZXJhcmNoeV90b2dnbGVcblx0XHRcdCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCByb3dfdG9nZ2xlICkge1xuXHRcdFx0c2V0X3Jvd19leHBhbmRlZChcblx0XHRcdFx0cm93X3RvZ2dsZS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcm93LXRvZ2dsZScgKSxcblx0XHRcdFx0J3RydWUnICE9PSByb3dfdG9nZ2xlLmdldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnICksXG5cdFx0XHRcdHJvd190b2dnbGVcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciB0aGUgcmVhZC1vbmx5IHNoZWxsIGFuZCBpdHMgYXV0aG9yaXplZCBpbml0aWFsIHdpbmRvdy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemUoKSB7XG5cdFx0dmFyIHN0YXRlX2hvc3Q7XG5cdFx0dmFyIGluaXRpYWxfYW5jaG9yO1xuXG5cdFx0aWYgKCAhIG1vdW50IHx8IGlzX2luaXRpYWxpemVkIHx8ICcxJyA9PT0gbW91bnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLWluaXRpYWxpemVkJyApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpc19pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0bGlmZWN5Y2xlX2dlbmVyYXRpb24gKz0gMTtcblx0XHRtb3VudC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtaW5pdGlhbGl6ZWQnLCAnMScgKTtcblxuXHRcdGlmICggISByZW5kZXJfdGVtcGxhdGUoIG1vdW50LCAnc2hlbGwnLCBzZXR0aW5ncyApICkge1xuXHRcdFx0bW91bnQudGV4dENvbnRlbnQgPSBzZXR0aW5ncy5pMThuID8gc2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlIDogJyc7XG5cdFx0XHRtb3VudC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAnZmFsc2UnICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGluaXRpYWxpemVfd2luZG93X2NhY2hlKCk7XG5cdFx0aW5pdGlhbGl6ZV9hdmFpbGFiaWxpdHlfY2FjaGUoKTtcblx0XHRpbml0aWFsaXplX3Rvb2xiYXJfbmF2aWdhdGlvbigpO1xuXHRcdGluaXRpYWxpemVfZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uKCk7XG5cdFx0aW5pdGlhbGl6ZV9ib29raW5nX2ludGVyYWN0aW9ucygpO1xuXHRcdGluaXRpYWxpemVfcmVuZGVyaW5nKCk7XG5cdFx0aW5pdGlhbGl6ZV9yZXNvdXJjZV9uYXZpZ2F0aW9uKCk7XG5cdFx0aW5pdGlhbGl6ZV9yZXNvdXJjZV9zZXR0aW5ncygpO1xuXHRcdGluaXRpYWxpemVfZXh0ZW5zaW9ucygpO1xuXG5cdFx0cmVuZGVyX3RlbXBsYXRlKCBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS10b29sYmFyXScgKSwgJ3Rvb2xiYXInLCBzZXR0aW5ncyApO1xuXHRcdGlmICggdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHR0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlci5yZW5kZXJfY29udHJvbHMoKTtcblx0XHR9XG5cdFx0cmVuZGVyX3RlbXBsYXRlKCBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1heGlzLWhlYWRlcl0nICksICdheGlzX2hlYWRlcicsIHNldHRpbmdzICk7XG5cdFx0cmVuZGVyX3RlbXBsYXRlKCBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXMtYmFja2Ryb3BdJyApLCAnY2FudmFzX2JhY2tkcm9wJywgc2V0dGluZ3MgKTtcblx0XHRyZW5kZXJfdGVtcGxhdGUoIG1vdW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWVsaW5lLWxlZ2VuZF0nICksICdsZWdlbmQnLCBzZXR0aW5ncyApO1xuXHRcdGlmICggdG9vbGJhcl9uYXZpZ2F0aW9uX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHR0b29sYmFyX25hdmlnYXRpb25fY29udHJvbGxlci5yZWZyZXNoX2FmdGVyX3dpbmRvd19yZW5kZXIoKTtcblx0XHR9XG5cdFx0aW5pdGlhbGl6ZV9heGlzX3Njcm9sbF9zeW5jaHJvbml6YXRpb24oKTtcblxuXHRcdHN0YXRlX2hvc3QgPSBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1zdGF0ZV0nICk7XG5cdFx0aWYgKCBzZXR0aW5ncy5pc19hdXRob3JpemVkICYmIHNldHRpbmdzLmluaXRpYWwgJiYgJ2Vycm9yJyA9PT0gc2V0dGluZ3MuaW5pdGlhbC5sb2FkX3N0YXRlICkge1xuXHRcdFx0c2V0dGluZ3MuaTE4bi5lcnJvcl9tZXNzYWdlID0gc2V0dGluZ3MuaW5pdGlhbC5lcnJvciAmJiBzZXR0aW5ncy5pbml0aWFsLmVycm9yLm1lc3NhZ2UgPyBzZXR0aW5ncy5pbml0aWFsLmVycm9yLm1lc3NhZ2UgOiBzZXR0aW5ncy5pMThuLmVycm9yX21lc3NhZ2U7XG5cdFx0XHRzdGF0ZV9ob3N0LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0cmVuZGVyX3RlbXBsYXRlKCBzdGF0ZV9ob3N0LCAnZXJyb3InLCBzZXR0aW5ncyApO1xuXHRcdFx0YW5ub3VuY2UoIHNldHRpbmdzLmkxOG4uZXJyb3JfbWVzc2FnZSApO1xuXHRcdH0gZWxzZSBpZiAoIHNldHRpbmdzLmlzX2F1dGhvcml6ZWQgKSB7XG5cdFx0XHRpbml0aWFsX2FuY2hvciA9IHNldHRpbmdzLmF4aXMuY3VycmVudF90aW1lX21hcmtlciAmJiBzZXR0aW5ncy5heGlzLmN1cnJlbnRfdGltZV9tYXJrZXIuYXRcblx0XHRcdFx0PyBzZXR0aW5ncy5heGlzLmN1cnJlbnRfdGltZV9tYXJrZXIuYXRcblx0XHRcdFx0OiBzZXR0aW5ncy5heGlzLmFuY2hvci5hdDtcblx0XHRcdHJlc2V0X3dpbmRvd19zdG9yZSgge1xuXHRcdFx0XHR3aW5kb3c6IHNldHRpbmdzLndpbmRvdyxcblx0XHRcdFx0YXhpczogc2V0dGluZ3MuYXhpcyxcblx0XHRcdFx0cmVzb3VyY2VzOiBzZXR0aW5ncy5pbml0aWFsLnJlc291cmNlcyB8fCBbXSxcblx0XHRcdFx0c2VnbWVudHM6IHNldHRpbmdzLmluaXRpYWwuc2VnbWVudHMgfHwgW10sXG5cdFx0XHRcdG9jY3VwYW5jeTogc2V0dGluZ3MuaW5pdGlhbC5vY2N1cGFuY3kgfHwgW10sXG5cdFx0XHRcdHRpbWVfc2xvdF9vdmVyZmxvd3M6IHNldHRpbmdzLmluaXRpYWwudGltZV9zbG90X292ZXJmbG93cyB8fCBbXSxcblx0XHRcdFx0cHJlZmVyZW5jZXM6IHNldHRpbmdzLnByZWZlcmVuY2VzIHx8IHt9LFxuXHRcdFx0XHRyZXNvdXJjZV92aWV3OiBzZXR0aW5ncy5yZXNvdXJjZV92aWV3IHx8IHt9LFxuXHRcdFx0XHRyZXNvdXJjZV9wYWdpbmF0aW9uOiBzZXR0aW5ncy5yZXNvdXJjZV9wYWdpbmF0aW9uIHx8IHt9LFxuXHRcdFx0XHR3aW5kb3dfY29udGV4dDogc2V0dGluZ3Mud2luZG93X2NvbnRleHQgfHwge30sXG5cdFx0XHRcdHZpZXdfcG9saWN5OiBzZXR0aW5ncy52aWV3X3BvbGljeSB8fCB7fSxcblx0XHRcdFx0ZGlhZ25vc3RpY3M6IHNldHRpbmdzLmluaXRpYWwuZGlhZ25vc3RpY3MgfHwge31cblx0XHRcdH0gKTtcblx0XHRcdGlmICggc2V0dGluZ3MuaW5pdGlhbF9wcmV2aW91c193aW5kb3cgJiYgc2V0dGluZ3MuaW5pdGlhbF9wcmV2aW91c193aW5kb3cud2luZG93ICYmIHNldHRpbmdzLmluaXRpYWxfcHJldmlvdXNfd2luZG93LmF4aXMgKSB7XG5cdFx0XHRcdGNhY2hlX2FkamFjZW50X3dpbmRvdyggc2V0dGluZ3MuaW5pdGlhbF9wcmV2aW91c193aW5kb3cgKTtcblx0XHRcdH1cblx0XHRcdGlmICggc2V0dGluZ3MuaW5pdGlhbF9uZXh0X3dpbmRvdyAmJiBzZXR0aW5ncy5pbml0aWFsX25leHRfd2luZG93LndpbmRvdyAmJiBzZXR0aW5ncy5pbml0aWFsX25leHRfd2luZG93LmF4aXMgKSB7XG5cdFx0XHRcdGNhY2hlX2FkamFjZW50X3dpbmRvdyggc2V0dGluZ3MuaW5pdGlhbF9uZXh0X3dpbmRvdyApO1xuXHRcdFx0fVxuXHRcdFx0dHJpbV93aW5kb3dfc3RvcmUoKTtcblx0XHRcdHJlbmRlcl93aW5kb3dfc3RvcmUoXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRhdDogaW5pdGlhbF9hbmNob3IsXG5cdFx0XHRcdFx0bGVhZGluZ19jZWxsc19iZWZvcmU6IDEsXG5cdFx0XHRcdFx0cmVzdG9yZV9mb2N1czogZmFsc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0dGluZ3MuaTE4bi5zdGF0dXNfcmVhZHlcblx0XHRcdCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0YXRlX2hvc3QuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRyZW5kZXJfdGVtcGxhdGUoIHN0YXRlX2hvc3QsICd1bmF1dGhvcml6ZWQnLCBzZXR0aW5ncyApO1xuXHRcdFx0YW5ub3VuY2UoIHNldHRpbmdzLmkxOG4uc3RhdHVzX3VuYXV0aG9yaXplZCApO1xuXHRcdH1cblxuXHRcdHVwZGF0ZV90aW1lbGluZV9ibG9ja2luZ19sb2FkaW5nX3N0YXRlKCk7XG5cdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XG5cdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfYXhpc19rZXlkb3duICk7XG5cdFx0aWYgKCBib29raW5nX2NyZWF0aW9uX2hvc3RfZW5hYmxlZCApIHtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJvb2tpbmctbmV3LWluc3BlY3RvcjpjcmVhdGVkJywgaGFuZGxlX2Jvb2tpbmdfY3JlYXRpb25fY3JlYXRlZCApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6Ym9va2luZy1uZXctaW5zcGVjdG9yOmZvY3VzLWNyZWF0ZWQnLCBoYW5kbGVfYm9va2luZ19jcmVhdGlvbl9mb2N1c19jcmVhdGVkICk7XG5cdFx0fVxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmF2YWlsYWJpbGl0eS10aW1lc2xvdHM6Y2hhbmdlZCcsIGhhbmRsZV9hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2NoYW5nZWQgKTtcblx0XHRpZiAoIHNldHRpbmdzLmlzX2F1dGhvcml6ZWQgJiYgc2V0dGluZ3MuaW5pdGlhbCAmJiAnZXJyb3InICE9PSBzZXR0aW5ncy5pbml0aWFsLmxvYWRfc3RhdGUgKSB7XG5cdFx0XHRzY2hlZHVsZV9pbml0aWFsX2NhbnZhc19yZWFkeSgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZW1vdmUgdGhlIGxpc3RlbmVycyBvd25lZCBieSB0aGUgVGltZWxpbmUgbW91bnQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZW1vdmVfbW91bnRfZXZlbnRfbGlzdGVuZXJzKCkge1xuXHRcdGlmICggISBtb3VudCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfY2xpY2sgKTtcblx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9heGlzX2tleWRvd24gKTtcblx0XHRpZiAoIGJvb2tpbmdfY3JlYXRpb25faG9zdF9lbmFibGVkICkge1xuXHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6Ym9va2luZy1uZXctaW5zcGVjdG9yOmNyZWF0ZWQnLCBoYW5kbGVfYm9va2luZ19jcmVhdGlvbl9jcmVhdGVkICk7XG5cdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiYzpib29raW5nLW5ldy1pbnNwZWN0b3I6Zm9jdXMtY3JlYXRlZCcsIGhhbmRsZV9ib29raW5nX2NyZWF0aW9uX2ZvY3VzX2NyZWF0ZWQgKTtcblx0XHR9XG5cdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6YXZhaWxhYmlsaXR5LXRpbWVzbG90czpjaGFuZ2VkJywgaGFuZGxlX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfY2hhbmdlZCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbW92ZSBob3Jpem9udGFsLWF4aXMgYW5kIHZpZXdwb3J0IGxpc3RlbmVycyBvd25lZCBieSB0aGlzIGNvbnRyb2xsZXIuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBkZXN0cm95X2F4aXNfc2Nyb2xsX3N5bmNocm9uaXphdGlvbigpIHtcblx0XHRpZiAoIGF4aXNfc2Nyb2xsX2NhbnZhcyApIHtcblx0XHRcdGF4aXNfc2Nyb2xsX2NhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgc3luY2hyb25pemVfYXhpc19zY3JvbGwgKTtcblx0XHRcdGF4aXNfc2Nyb2xsX2NhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgaGFuZGxlX3dpbmRvd19zdG9yZV9zY3JvbGwgKTtcblx0XHRcdGF4aXNfc2Nyb2xsX2NhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgc2NoZWR1bGVfZWRnZV9zdGF0dXNfcG9zaXRpb25pbmcgKTtcblx0XHRcdGF4aXNfc2Nyb2xsX2NhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgcG9zaXRpb25fZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX3BvcG92ZXIgKTtcblx0XHRcdGF4aXNfc2Nyb2xsX2NhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCAnd2hlZWwnLCBjb250YWluX2NhbnZhc19ib3VuZGFyeV9nZXN0dXJlICk7XG5cdFx0XHRheGlzX3Njcm9sbF9jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3BvaW50ZXJkb3duJywgaGFuZGxlX2NhbnZhc19uYXZpZ2F0aW9uX3BvaW50ZXJfZG93biApO1xuXHRcdH1cblx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIHN5bmNocm9uaXplX2F4aXNfc2Nyb2xsICk7XG5cdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBzY2hlZHVsZV9lZGdlX3N0YXR1c19wb3NpdGlvbmluZyApO1xuXHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAncmVzaXplJywgcG9zaXRpb25fZW1wdHlfcmFuZ2Vfc2VsZWN0aW9uX3BvcG92ZXIgKTtcblx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3Njcm9sbCcsIHNjaGVkdWxlX2VkZ2Vfc3RhdHVzX3Bvc2l0aW9uaW5nICk7XG5cdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBwb3NpdGlvbl9lbXB0eV9yYW5nZV9zZWxlY3Rpb25fcG9wb3ZlciApO1xuXHRcdGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY190aW1lbGluZV9zY3JvbGxfY29udGFpbmVkJyApO1xuXHRcdGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfdGltZWxpbmVfc2Nyb2xsX2NvbnRhaW5lZCcgKTtcblx0XHRheGlzX3Njcm9sbF9jYW52YXMgPSBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhbmNlbCBUaW1lbGluZS1vd25lZCBhbmltYXRpb24gZnJhbWVzIGFuZCBzaG9ydCBsaWZlY3ljbGUgdGltZXJzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2FuY2VsX2xpZmVjeWNsZV9zY2hlZHVsZXJzKCkge1xuXHRcdHZhciBhbmltYXRpb25fZnJhbWVzID0gW1xuXHRcdFx0b3ZlcmZsb3dfdG9vbHRpcF9mcmFtZSxcblx0XHRcdGVkZ2Vfc3RhdHVzX2ZyYW1lLFxuXHRcdFx0ZWRnZV9zY3JvbGxfZnJhbWUsXG5cdFx0XHRpbml0aWFsX2NhbnZhc19yZWFkeV9mcmFtZVxuXHRcdF07XG5cdFx0YW5pbWF0aW9uX2ZyYW1lcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZyYW1lX2lkICkge1xuXHRcdFx0aWYgKCBmcmFtZV9pZCApIHtcblx0XHRcdFx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKCBmcmFtZV9pZCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRvdmVyZmxvd190b29sdGlwX2ZyYW1lID0gMDtcblx0XHRlZGdlX3N0YXR1c19mcmFtZSA9IDA7XG5cdFx0ZWRnZV9zY3JvbGxfZnJhbWUgPSAwO1xuXHRcdGluaXRpYWxfY2FudmFzX3JlYWR5X2ZyYW1lID0gMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXN0cm95IHRoZSBjdXJyZW50IFRpbWVsaW5lIGluc3RhbmNlIHdpdGhvdXQgcmVtb3ZpbmcgaXRzIHNlcnZlciBtb3VudC5cblx0ICpcblx0ICogVGVhcmRvd24gaXMgaWRlbXBvdGVudCBhbmQgb3ducyBvbmx5IHJlc291cmNlcyBjcmVhdGVkIGJ5IHRoaXMgY29udHJvbGxlci5cblx0ICogU2hhcmVkIFVJIGdsb2JhbHMgcmVtYWluIGludGFjdCwgd2hpbGUgVGltZWxpbmUtY3JlYXRlZCBib29raW5nIGFkYXB0ZXJzIGFyZVxuXHQgKiBleHBsaWNpdGx5IGRlc3Ryb3llZCB0aHJvdWdoIHRoZWlyIHB1YmxpYyBjb250cmFjdHMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBkZXN0cm95KCkge1xuXHRcdGlmICggISBpc19pbml0aWFsaXplZCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsaWZlY3ljbGVfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdGlzX2F4aXNfd2luZG93X2xvYWRpbmdfbG9ja2VkID0gZmFsc2U7XG5cdFx0cHJlZmVyZW5jZXNfc2F2ZV9wZW5kaW5nID0gZmFsc2U7XG5cdFx0cHJlZmVyZW5jZXNfcmVzZXRfcGVuZGluZyA9IGZhbHNlO1xuXHRcdHByZWZlcmVuY2VzX3Jlc2V0X2J1dHRvbiA9IG51bGw7XG5cdFx0cHJlZmVyZW5jZXNfcmVzZXRfYmFycmllcl9jb21wbGV0ZSA9IHRydWU7XG5cdFx0YWNjZXB0ZWRfYm9va2luZ19nZW5lcmF0aW9uID0gMDtcblx0XHRhY2NlcHRlZF9hdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbiA9IDA7XG5cdFx0YXV0aG9yaXRhdGl2ZV9yZWFkYmFja19nZW5lcmF0aW9uID0gMDtcblx0XHRhY3RpdmVfYm9va2luZ19jcmVhdGlvbl9yZWFkYmFja19pZCA9ICcnO1xuXHRcdGNvbXBsZXRlZF9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX2lkcyA9IHt9O1xuXHRcdGNvbXBsZXRlZF9ib29raW5nX2NyZWF0aW9uX3JlYWRiYWNrX29yZGVyID0gW107XG5cdFx0aXNfZm9yZWdyb3VuZF9yZXF1ZXN0X2xvYWRpbmcgPSBmYWxzZTtcblx0XHRmb3JlZ3JvdW5kX3JlcXVlc3RfbG9hZGluZ19tZXNzYWdlID0gJyc7XG5cdFx0aXNfYXZhaWxhYmlsaXR5X2xvYWRpbmcgPSBmYWxzZTtcblx0XHRpc19zZWxlY3Rpb25fYXBwbHlfbG9hZGluZyA9IGZhbHNlO1xuXHRcdHNlbGVjdGlvbl9hcHBseV9sb2FkaW5nX21lc3NhZ2UgPSAnJztcblx0XHRpZiAoIHByZWZlcmVuY2VzX3NhdmVfdGltZXIgKSB7XG5cdFx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBwcmVmZXJlbmNlc19zYXZlX3RpbWVyICk7XG5cdFx0fVxuXHRcdHByZWZlcmVuY2VzX3NhdmVfdGltZXIgPSAwO1xuXHRcdGlmICggcHJlZmVyZW5jZXNfc2F2ZV9yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBwcmVmZXJlbmNlc19zYXZlX3JlcXVlc3QuYWJvcnQgKSB7XG5cdFx0XHRwcmVmZXJlbmNlc19zYXZlX3JlcXVlc3QuYWJvcnQoKTtcblx0XHR9XG5cdFx0cHJlZmVyZW5jZXNfc2F2ZV9yZXF1ZXN0ID0gbnVsbDtcblx0XHRyZW1vdmVfbW91bnRfZXZlbnRfbGlzdGVuZXJzKCk7XG5cdFx0ZGVzdHJveV9heGlzX3Njcm9sbF9zeW5jaHJvbml6YXRpb24oKTtcblx0XHRkZXN0cm95X2V4dGVuc2lvbnMoKTtcblx0XHRkZXN0cm95X3Jlc291cmNlX25hdmlnYXRpb24oKTtcblx0XHRkZXN0cm95X3Jlc291cmNlX3NldHRpbmdzKCk7XG5cdFx0ZGVzdHJveV90b29sYmFyX25hdmlnYXRpb24oKTtcblx0XHRkZXN0cm95X3JlbmRlcmluZygpO1xuXHRcdGRlc3Ryb3lfYm9va2luZ19pbnRlcmFjdGlvbnMoKTtcblx0XHRkZXN0cm95X2VtcHR5X3JhbmdlX3NlbGVjdGlvbigpO1xuXHRcdGNhbmNlbF9saWZlY3ljbGVfc2NoZWR1bGVycygpO1xuXHRcdGRlc3Ryb3lfYXZhaWxhYmlsaXR5X2NhY2hlKCk7XG5cdFx0ZGVzdHJveV93aW5kb3dfY2FjaGUoKTtcblx0XHRpZiAoIGVkZ2Vfb2JzZXJ2ZXIgKSB7XG5cdFx0XHRlZGdlX29ic2VydmVyLmRpc2Nvbm5lY3QoKTtcblx0XHR9XG5cdFx0ZWRnZV9vYnNlcnZlciA9IG51bGw7XG5cdFx0Zm9yZWdyb3VuZF9yZXF1ZXN0X2ZvY3VzID0gbnVsbDtcblx0XHRpZiAoIG1vdW50ICkge1xuXHRcdFx0bW91bnQuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXJlcXVlc3QtbG9hZGluZycgKTtcblx0XHRcdG1vdW50LnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICdmYWxzZScgKTtcblx0XHRcdG1vdW50LnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1pbml0aWFsaXplZCcgKTtcblx0XHR9XG5cdFx0aXNfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGluaXRpYWxpemU6IGluaXRpYWxpemUsXG5cdFx0XHRyZXBsYWNlX3Jlc291cmNlX3ZpZXc6IHJlcGxhY2VfcmVzb3VyY2Vfdmlldyxcblx0XHRcdGRlc3Ryb3k6IGRlc3Ryb3lcblx0XHR9O1xuXHR9XG5cblx0aWYgKFxuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXNcblx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5XG5cdCkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSggbW9kdWxlX2lkLCBjcmVhdGVfdGltZWxpbmVfcGFnZV9jb250cm9s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
