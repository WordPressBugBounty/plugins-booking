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
( function ( window, document, wp ) {
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
	function create_timeline_page_controller( context ) {
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
	var booking_creation_host_enabled = Boolean( settings.new_booking && settings.new_booking.launch_context );
	var active_booking_creation_readback_id = '';
	var completed_booking_creation_readback_ids = {};
	var completed_booking_creation_readback_order = [];
	var is_foreground_request_loading = false;
	var is_availability_loading = false;
	var is_selection_apply_loading = false;
	var selection_apply_loading_message = '';
	var extension_instance_ids = [];
	var preference_anchor_date = settings.preferences && settings.preferences.anchor_date
		? String( settings.preferences.anchor_date )
		: String( settings.window && settings.window.start_date ? settings.window.start_date : '' );
	var preference_anchor_ratio = settings.preferences && Number.isFinite( Number( settings.preferences.anchor_ratio ) )
		? Number( settings.preferences.anchor_ratio )
		: 0;
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
	function get_template( template_key ) {
		var template_id = settings.templates && settings.templates[ template_key ];

		if ( ! template_id || ! wp || 'function' !== typeof wp.template ) {
			return null;
		}

		return wp.template( template_id );
	}

	/**
	 * Render one allow-listed WordPress template into an existing host.
	 *
	 * @param {Element|null} target Target element.
	 * @param {string} template_key Template-pack key.
	 * @param {Object} view_model Authorized template data.
	 * @return {boolean} True when a template was rendered.
	 */
	function render_template( target, template_key, view_model ) {
		var template = get_template( template_key );

		if ( ! target || ! template ) {
			return false;
		}

		target.innerHTML = template( view_model );
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
	function emit_accepted_data_event( event_name, event_detail ) {
		var accepted_event;

		if ( ! extension_instance_ids.length || ! mount || 'function' !== typeof mount.dispatchEvent ) {
			return;
		}
		if ( 'function' === typeof window.CustomEvent ) {
			accepted_event = new window.CustomEvent( 'wpbc:timeline:data:' + event_name, {
				detail: event_detail
			} );
		} else if ( document.createEvent ) {
			accepted_event = document.createEvent( 'CustomEvent' );
			accepted_event.initCustomEvent( 'wpbc:timeline:data:' + event_name, false, false, event_detail );
		}
		if ( accepted_event ) {
			mount.dispatchEvent( accepted_event );
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
	function begin_authoritative_readback( reason ) {
		authoritative_readback_generation += 1;
		emit_accepted_data_event( 'authoritative-readback-state', {
			schema_version: 1,
			generation: authoritative_readback_generation,
			state: 'loading',
			reason: String( reason || '' )
		} );

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
	function complete_authoritative_readback( generation, state, reason ) {
		if ( generation !== authoritative_readback_generation ) {
			return;
		}
		emit_accepted_data_event( 'authoritative-readback-state', {
			schema_version: 1,
			generation: generation,
			state: 'accepted' === state ? 'accepted' : 'failed',
			reason: String( reason || '' )
		} );
		if (
			'accepted' !== state
			&& [ 'availability_mutation', 'booking_inspector', 'booking_geometry', 'booking_creation' ].indexOf(
				String( reason || '' )
			) !== -1
		) {
			set_availability_loading( false );
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
	function track_authoritative_readback( request, generation, reason ) {
		if ( ! request || 'function' !== typeof request.done || 'function' !== typeof request.fail ) {
			complete_authoritative_readback( generation, 'failed', reason );
			return request;
		}
		request.done( function () {
			complete_authoritative_readback( generation, 'accepted', reason );
		} ).fail( function () {
			complete_authoritative_readback( generation, 'failed', reason );
		} );

		return request;
	}

	/**
	 * Notify read-only consumers of the complete accepted bounded booking cache.
	 *
	 * @param {Array<Object>} window_entries Native ordered cache snapshot.
	 * @return {void}
	 */
	function notify_accepted_booking_windows( window_entries ) {
		if ( ! Array.isArray( window_entries ) ) {
			return;
		}
		accepted_booking_generation += 1;
		emit_accepted_data_event( 'booking-windows-accepted', {
			schema_version: 1,
			generation: accepted_booking_generation,
			current_window_key: String( settings.window_context && settings.window_context.window_key || '' ),
			resource_fingerprint: String( settings.window_context && settings.window_context.resource_fingerprint || '' ),
			timezone: String( settings.window && settings.window.timezone || '' ),
			windows: window_entries
		} );
	}

	/**
	 * Build one complete toolbar preference snapshot from authorized state.
	 *
	 * @return {Object|null} Preference payload, or null before a window exists.
	 */
	function get_timeline_preferences_snapshot() {
		var timeline_window = settings.window || {};
		var current_view = settings.current_axis && settings.current_axis.view
			? settings.current_axis.view
			: ( settings.axis ? settings.axis.view : '' );
		var visual_zoom_percent = toolbar_navigation_controller && 'function' === typeof toolbar_navigation_controller.get_visual_zoom_percent
			? toolbar_navigation_controller.get_visual_zoom_percent()
			: Number( settings.preferences && settings.preferences.visual_zoom_percent ) || 100;

		if ( ! preference_anchor_date || ! current_view || ( ! Number( timeline_window.window_days ) && ! Number( timeline_window.window_months ) ) ) {
			return null;
		}

		return {
			anchor_date: preference_anchor_date,
			anchor_ratio: Math.max( 0, Math.min( 1, preference_anchor_ratio ) ),
			window_days: Number( timeline_window.window_months ) ? 0 : Number( timeline_window.window_days ),
			window_months: Number( timeline_window.window_months ) || 0,
			view: String( current_view ),
			visual_zoom_percent: Number( visual_zoom_percent )
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
		if ( preferences_save_request ) {
			preferences_save_pending = true;
			return;
		}
		if ( ! preferences_save_pending || ! window.jQuery || ! settings.transport || ! settings.transport.url || ! transport.action || ! transport.nonce ) {
			return;
		}
		snapshot = get_timeline_preferences_snapshot();
		preferences_save_pending = false;
		if ( ! snapshot ) {
			return;
		}

		preferences_save_request = window.jQuery.ajax( {
			url: settings.transport.url,
			method: 'POST',
			dataType: 'json',
			data: Object.assign( {}, snapshot, {
				action: transport.action,
				nonce: transport.nonce
			} )
		} ).always( function () {
			preferences_save_request = null;
			if ( preferences_reset_pending && is_initialized ) {
				flush_timeline_preferences_reset();
				return;
			}
			if ( preferences_save_pending && is_initialized ) {
				flush_timeline_preferences_save();
			}
		} );
	}

	/**
	 * Queue a serialized per-user preference save after explicit UI changes.
	 *
	 * @param {Object} preference_overrides Optional anchor fields for cached navigation.
	 * @return {void}
	 */
	function queue_timeline_preferences_save( preference_overrides ) {
		var overrides = preference_overrides && 'object' === typeof preference_overrides ? preference_overrides : {};

		if ( overrides.anchor_date ) {
			preference_anchor_date = String( overrides.anchor_date );
		}
		if ( Number.isFinite( Number( overrides.anchor_ratio ) ) ) {
			preference_anchor_ratio = Number( overrides.anchor_ratio );
		}
		preferences_save_pending = true;
		if ( preferences_save_request || preferences_save_timer ) {
			return;
		}
		preferences_save_timer = window.setTimeout( flush_timeline_preferences_save, 250 );
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
	function set_timeline_preference_anchor( anchor_date, anchor_ratio ) {
		preference_anchor_date = String( anchor_date || '' );
		preference_anchor_ratio = Math.max( 0, Math.min( 1, Number( anchor_ratio ) || 0 ) );
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

		if ( preferences_save_request || ! preferences_reset_pending || ! preferences_reset_barrier_complete ) {
			return;
		}
		if ( ! window.jQuery || ! settings.transport || ! settings.transport.url || ! transport.reset_action || ! transport.nonce ) {
			preferences_reset_pending = false;
			if ( reset_button ) {
				reset_button.removeAttribute( 'aria-disabled' );
			}
			show_standard_admin_message( settings.i18n.timeline_reset_failed, 'error', 30000 );
			set_foreground_request_loading( false, '', 0 );
			return;
		}

		preferences_reset_pending = false;
		preferences_save_request = window.jQuery.ajax( {
			url: settings.transport.url,
			method: 'POST',
			dataType: 'json',
			data: {
				action: transport.reset_action,
				nonce: transport.nonce
			}
		} ).done( function ( response ) {
			if (
				response
				&& response.success
				&& response.data
				&& response.data.resource_view_context
				&& toolbar_navigation_controller
				&& 'function' === typeof toolbar_navigation_controller.reset_to_defaults
			) {
				settings.resource_view = response.data.resource_view || {};
				settings.resource_pagination = response.data.resource_pagination || {};
				settings.window_context = Object.assign( {}, settings.window_context || {}, {
					resource_view_context: String( response.data.resource_view_context )
				} );
				settings.preferences = Object.assign( {}, settings.preferences || {}, {
					expanded_resource_ids: [],
					expanded_parent_ids: []
				} );
				if ( resource_navigation_controller && 'function' === typeof resource_navigation_controller.refresh ) {
					resource_navigation_controller.refresh( settings.resource_view, settings.resource_pagination );
				}
				emit_accepted_data_event( 'preferences-reset', {
					schema_version: 1
				} );
				default_request_dispatched = toolbar_navigation_controller.reset_to_defaults();
			}
			if ( ! default_request_dispatched ) {
				show_standard_admin_message( settings.i18n.timeline_reset_failed, 'error', 30000 );
			}
		} ).fail( function ( request ) {
			var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};

			show_standard_admin_message( error.message || settings.i18n.timeline_reset_failed, 'error', 30000 );
		} ).always( function () {
			preferences_save_request = null;
			preferences_reset_button = null;
			if ( reset_button ) {
				reset_button.removeAttribute( 'aria-disabled' );
			}
			if ( ! default_request_dispatched ) {
				set_foreground_request_loading( false, '', 0 );
			}
			if ( preferences_save_pending && is_initialized ) {
				flush_timeline_preferences_save();
			}
		} );
	}

	/**
	 * Queue a reset after any already-started preference save finishes.
	 *
	 * @param {HTMLButtonElement|null} reset_button Initiating toolbar control.
	 * @return {void}
	 */
	function queue_timeline_preferences_reset( reset_button ) {
		var reset_waiters = [];
		var reset_requested_event;
		var wait_until = function ( promise ) {
			if ( promise && 'function' === typeof promise.then ) {
				reset_waiters.push( promise );
			}
		};

		if ( preferences_reset_pending ) {
			return;
		}
		if ( preferences_save_timer ) {
			window.clearTimeout( preferences_save_timer );
			preferences_save_timer = 0;
		}
		preferences_save_pending = false;
		preferences_reset_pending = true;
		preferences_reset_barrier_complete = false;
		preferences_reset_button = reset_button || null;
		if ( preferences_reset_button ) {
			preferences_reset_button.setAttribute( 'aria-disabled', 'true' );
		}
		set_foreground_request_loading( true, settings.i18n.resetting_timeline, 0 );
		if ( mount && 'function' === typeof mount.dispatchEvent && 'function' === typeof window.CustomEvent ) {
			reset_requested_event = new window.CustomEvent( 'wpbc:timeline:preferences:reset-requested', {
				detail: {
					schema_version: 1,
					wait_until: wait_until
				}
			} );
			mount.dispatchEvent( reset_requested_event );
		}
		window.Promise.all( reset_waiters.map( function ( waiter ) {
			return window.Promise.resolve( waiter ).catch( function () { return null; } );
		} ) ).then( function () {
			preferences_reset_barrier_complete = true;
			if ( ! preferences_save_request && preferences_reset_pending && is_initialized ) {
				flush_timeline_preferences_reset();
			}
		} );
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

		if ( ! module_runtime || 'function' !== typeof module_runtime.create ) {
			return;
		}
		window_cache_controller = module_runtime.create( 'window_cache', window_cache_instance_id, {
			mount: mount,
			settings: settings,
			synchronize_axis_scroll: synchronize_axis_scroll
		} );
	}

	/**
	 * Destroy the bounded-window controller created for this page instance.
	 *
	 * @return {void}
	 */
	function destroy_window_cache() {
		var module_runtime = window.wpbc_timeline_modules;

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			module_runtime.destroy( window_cache_instance_id );
		} else if ( window_cache_controller && 'function' === typeof window_cache_controller.destroy ) {
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

		if ( ! module_runtime || 'function' !== typeof module_runtime.create ) {
			return;
		}
		extension_instance_ids = [];
		( Array.isArray( settings.extensions ) ? settings.extensions : [] ).forEach( function ( extension ) {
			var module_id = extension && 'string' === typeof extension.module_id ? extension.module_id : '';
			var instance_id = extension && 'string' === typeof extension.instance_id ? extension.instance_id : '';
			var capabilities = extension && Array.isArray( extension.capabilities ) ? extension.capabilities : [];
			var extension_context;
			var extension_instance;

			if ( ! stable_identifier.test( module_id ) || ! stable_identifier.test( instance_id ) ) {
				return;
			}
			if ( 'function' === typeof module_runtime.has_factory && ! module_runtime.has_factory( module_id ) ) {
				return;
			}
			extension_context = {
				mount: mount,
				presentation_api: {
					open_first: function ( presentation_id ) {
						return rendering_controller && 'function' === typeof rendering_controller.open_first_row_presentation
							? rendering_controller.open_first_row_presentation( presentation_id )
							: 0;
					}
				},
				configuration: extension.configuration && 'object' === typeof extension.configuration
					? extension.configuration
					: {}
			};
			if ( capabilities.indexOf( 'selection_actions' ) !== -1 ) {
				extension_context.selection_api = {
					get_request_context: get_extension_selection_request_context,
					refresh_after_apply: function () {
						return refresh_after_availability_mutation( false );
					},
					announce: announce,
					is_host_active: function () {
						return is_initialized;
					}
				};
			}
			extension_instance = module_runtime.create( module_id, instance_id, extension_context );
			if ( extension_instance ) {
				extension_instance_ids.push( instance_id );
			}
		} );
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

		if ( ! extension_instance_ids.length || initial_canvas_ready_frame ) {
			return;
		}
		initial_canvas_ready_frame = window.requestAnimationFrame( function () {
			initial_canvas_ready_frame = window.requestAnimationFrame( function () {
				initial_canvas_ready_frame = 0;
				if ( ! is_initialized || ready_generation !== lifecycle_generation ) {
					return;
				}
				emit_accepted_data_event( 'initial-canvas-ready', {
					schema_version: 1,
					generation: ready_generation
				} );
			} );
		} );
	}

	/**
	 * Destroy every browser extension created for this Timeline instance.
	 *
	 * @return {void}
	 */
	function destroy_extensions() {
		var module_runtime = window.wpbc_timeline_modules;

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			extension_instance_ids.forEach( function ( instance_id ) {
				module_runtime.destroy( instance_id );
			} );
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

		if (
			! module_runtime
			|| 'function' !== typeof module_runtime.has_factory
			|| 'function' !== typeof module_runtime.create
			|| ! module_runtime.has_factory( 'availability_cache' )
		) {
			return;
		}

		availability_cache_controller = module_runtime.create(
			'availability_cache',
			availability_cache_instance_id,
			{
				mount: mount,
				settings: settings,
				get_axis: function () {
					return settings.axis || {};
				},
				get_geometry: get_composed_segment_geometry,
				on_change: handle_availability_cache_change,
				on_status_change: handle_availability_cache_status_change
			}
		);
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
	function handle_availability_cache_change( change ) {
		accepted_availability_generation += 1;
		emit_accepted_data_event( 'availability-accepted', Object.assign( {}, change || {}, {
			schema_version: 1,
			generation: accepted_availability_generation
		} ) );
		if (
			availability_failure_announced
			|| ! change
			|| 'neutral' !== change.state
			|| ! settings.i18n
			|| ! settings.i18n.availability_load_failed
		) {
			return;
		}

		availability_failure_announced = true;
		announce( settings.i18n.availability_load_failed );
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
	function handle_availability_cache_status_change( status ) {
		var was_loading;

		if (
			! status
			|| 1 !== Number( status.schema_version )
			|| 'invalidated' === status.state
		) {
			return;
		}

		if ( ! Boolean( status.is_settled ) || 0 < Number( status.pending_count ) ) {
			set_availability_loading( true );
			return;
		}
		was_loading = is_availability_loading;
		set_availability_loading( false );
		if (
			was_loading
			&& Number( status.loaded_count ) === Number( status.desired_count )
			&& 0 === Number( status.failed_count )
		) {
			announce( settings.i18n.timeline_refresh_complete );
		}
	}

	/**
	 * Toggle the Availability hold on the shared Timeline blocking overlay.
	 *
	 * @param {boolean} is_loading Whether one or more desired reads remain pending.
	 * @return {void}
	 */
	function set_availability_loading( is_loading ) {
		var should_show = Boolean( is_loading );

		if ( should_show === is_availability_loading ) {
			return;
		}
		is_availability_loading = should_show;
		if ( should_show ) {
			announce( settings.i18n.loading_availability_backgrounds );
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
	function synchronize_availability_cache( window_entries ) {
		if (
			! availability_cache_controller
			|| 'function' !== typeof availability_cache_controller.synchronize
			|| ! Array.isArray( window_entries )
		) {
			return;
		}

		availability_cache_controller.synchronize( window_entries );
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
		if ( availability_cache_controller && 'function' === typeof availability_cache_controller.invalidate ) {
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

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			module_runtime.destroy( availability_cache_instance_id );
		} else if ( availability_cache_controller && 'function' === typeof availability_cache_controller.destroy ) {
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
		if ( empty_range_selection_controller && empty_range_selection_controller.is_active() ) {
			empty_range_selection_controller.cancel( false );
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

		if (
			! module_runtime
			|| 'function' !== typeof module_runtime.has_factory
			|| 'function' !== typeof module_runtime.create
			|| ! module_runtime.has_factory( 'toolbar_navigation' )
		) {
			return false;
		}

		toolbar_navigation_controller = module_runtime.create(
			'toolbar_navigation',
			toolbar_navigation_instance_id,
			{
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
			}
		);

		return Boolean( toolbar_navigation_controller );
	}

	/**
	 * Destroy and forget the extracted toolbar/navigation controller.
	 *
	 * @return {void}
	 */
	function destroy_toolbar_navigation() {
		var module_runtime = window.wpbc_timeline_modules;

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			module_runtime.destroy( toolbar_navigation_instance_id );
		} else if ( toolbar_navigation_controller && 'function' === typeof toolbar_navigation_controller.destroy ) {
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

		if (
			! module_runtime
			|| 'function' !== typeof module_runtime.has_factory
			|| 'function' !== typeof module_runtime.create
			|| ! module_runtime.has_factory( 'resource_navigation' )
		) {
			return false;
		}

		resource_navigation_controller = module_runtime.create(
			'resource_navigation',
			resource_navigation_instance_id,
			{
				mount: mount,
				settings: settings,
				announce: announce,
				show_admin_message: show_standard_admin_message,
				replace_resource_view: replace_resource_view
			}
		);

		return Boolean( resource_navigation_controller );
	}

	/**
	 * Destroy and forget the focused Resource navigation controller.
	 *
	 * @return {void}
	 */
	function destroy_resource_navigation() {
		var module_runtime = window.wpbc_timeline_modules;

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			module_runtime.destroy( resource_navigation_instance_id );
		} else if ( resource_navigation_controller && 'function' === typeof resource_navigation_controller.destroy ) {
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

		if (
			! module_runtime
			|| 'function' !== typeof module_runtime.has_factory
			|| 'function' !== typeof module_runtime.create
			|| ! module_runtime.has_factory( 'resource_settings' )
		) {
			return false;
		}

		resource_settings_controller = module_runtime.create(
			'resource_settings',
			resource_settings_instance_id,
			{
				mount: mount,
				settings: settings,
				announce: announce,
				refresh_after_mutation: refresh_after_resource_settings_mutation
			}
		);

		return Boolean( resource_settings_controller );
	}

	/**
	 * Destroy and forget the focused Resource-settings adapter.
	 *
	 * @return {void}
	 */
	function destroy_resource_settings() {
		var module_runtime = window.wpbc_timeline_modules;

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			module_runtime.destroy( resource_settings_instance_id );
		} else if ( resource_settings_controller && 'function' === typeof resource_settings_controller.destroy ) {
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
		var readback_generation = begin_authoritative_readback( 'resource_settings' );

		return track_authoritative_readback( request_window( add_current_window_span( {
			anchor_at: anchor.at,
			anchor_ratio: anchor.ratio,
			window_position: 0,
			view: settings.current_axis ? settings.current_axis.view : settings.axis.view
		}, true ), anchor, true, {
			loading: settings.i18n.reloading_timeline,
			complete: settings.i18n.status_ready,
			suppress_complete_message: true,
			preserve_selection: true
		} ), readback_generation, 'resource_settings' );
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
			window_days: Number( settings.window.window_days ) || 0,
			window_months: Number( settings.window.window_months ) || 0,
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
		var selection_transport = settings.transport && settings.transport.selection
			? settings.transport.selection
			: {};

		return {
			transport: {
				url: String( settings.transport && settings.transport.url ? settings.transport.url : '' ),
				preview_action: String( selection_transport.preview_action || '' ),
				apply_action: String( selection_transport.apply_action || '' ),
				preview_nonce: String( selection_transport.preview_nonce || '' ),
				apply_nonce: String( selection_transport.apply_nonce || '' )
			},
			view: String( settings.axis && settings.axis.view ? settings.axis.view : '' ),
			loaded_start_at: String( settings.axis && settings.axis.start_at ? settings.axis.start_at : '' ),
			loaded_end_at: String( settings.axis && settings.axis.end_at ? settings.axis.end_at : '' ),
			loaded_context_tokens: get_loaded_empty_range_selection_context_tokens().slice( 0, 3 ),
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
		var readback_generation = begin_authoritative_readback( 'availability_mutation' );

		invalidate_availability_cache();
		return track_authoritative_readback( request_window( add_current_window_span( {
			anchor_at: anchor.at,
			anchor_ratio: anchor.ratio,
			window_position: 0,
			view: settings.axis.view
		}, true ), anchor, true, {
			loading: settings.i18n.applying_availability,
			complete: settings.i18n.status_ready,
			preserve_selection: true,
			suppress_complete_message: true
		} ), readback_generation, 'availability_mutation' );
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
	function handle_availability_timeslots_changed( event ) {
		var change = event && event.detail ? event.detail : {};

		if (
			! is_initialized
			|| 1 !== Number( change.schema_version )
			|| 1 > Number( change.resource_id )
			|| [ 'block', 'unblock' ].indexOf( String( change.mode || '' ) ) === -1
		) {
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

		if (
			! module_runtime
			|| 'function' !== typeof module_runtime.has_factory
			|| 'function' !== typeof module_runtime.create
			|| ! module_runtime.has_factory( 'empty_range_selection' )
		) {
			return false;
		}

		empty_range_selection_controller = module_runtime.create(
			'empty_range_selection',
			empty_range_selection_instance_id,
			{
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
			}
		);

		return Boolean( empty_range_selection_controller );
	}

	/**
	 * Destroy and forget the extracted empty-range controller.
	 *
	 * @return {void}
	 */
	function destroy_empty_range_selection() {
		var module_runtime = window.wpbc_timeline_modules;

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			module_runtime.destroy( empty_range_selection_instance_id );
		} else if ( empty_range_selection_controller && 'function' === typeof empty_range_selection_controller.destroy ) {
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
		var readback_generation = begin_authoritative_readback( 'booking_inspector' );

		invalidate_availability_cache();
		return track_authoritative_readback( request_window( add_current_window_span( {
			anchor_at: anchor.at,
			anchor_ratio: anchor.ratio,
			window_position: 0,
			view: settings.current_axis ? settings.current_axis.view : settings.axis.view
		}, true ), anchor, true, {
			loading: settings.i18n.reloading_timeline,
			complete: settings.i18n.status_ready,
			preserve_selection: true,
			suppress_complete_message: true
		} ), readback_generation, 'booking_inspector' );
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
	function dispatch_booking_creation_readback_result( detail ) {
		var readback_event;

		if ( ! mount || 'function' !== typeof mount.dispatchEvent ) {
			return;
		}
		if ( 'function' === typeof window.CustomEvent ) {
			readback_event = new window.CustomEvent( 'wpbc:booking-new-inspector:timeline-readback', {
				detail: detail
			} );
		} else if ( document.createEvent ) {
			readback_event = document.createEvent( 'CustomEvent' );
			readback_event.initCustomEvent( 'wpbc:booking-new-inspector:timeline-readback', false, false, detail );
		}
		if ( readback_event ) {
			mount.dispatchEvent( readback_event );
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
	function remember_booking_creation_readback_id( request_id ) {
		var oldest_request_id;

		if ( completed_booking_creation_readback_ids[ request_id ] ) {
			return;
		}
		completed_booking_creation_readback_ids[ request_id ] = true;
		completed_booking_creation_readback_order.push( request_id );
		if ( 20 < completed_booking_creation_readback_order.length ) {
			oldest_request_id = completed_booking_creation_readback_order.shift();
			delete completed_booking_creation_readback_ids[ oldest_request_id ];
		}
	}

	/**
	 * Restore focus to a visible authoritative created booking after shell close.
	 *
	 * @param {CustomEvent} event Creation Inspector focus-restoration request.
	 * @return {void}
	 */
	function handle_booking_creation_focus_created( event ) {
		var detail = event && event.detail && 'object' === typeof event.detail ? event.detail : {};
		var booking_id = Math.max( 0, Math.round( Number( detail.booking_id ) || 0 ) );

		if (
			1 === Number( detail.schema_version )
			&& booking_id
			&& booking_interactions_controller
			&& 'function' === typeof booking_interactions_controller.focus_created_booking
		) {
			booking_interactions_controller.focus_created_booking( booking_id );
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
	function consume_booking_creation_selection( detail ) {
		var module_runtime = window.wpbc_timeline_modules;
		var consumed = false;
		var token = String( detail.source_context_token || '' );
		var query_arg = String( detail.handoff_query_arg || '' );

		if ( ! token || ! query_arg ) {
			return false;
		}
		if (
			empty_range_selection_controller
			&& 'function' === typeof empty_range_selection_controller.consume_signed_action_context
		) {
			consumed = empty_range_selection_controller.consume_signed_action_context( 'new_booking', query_arg, token ) || consumed;
		}
		if ( ! module_runtime || 'function' !== typeof module_runtime.get_instance ) {
			return consumed;
		}
		extension_instance_ids.forEach( function ( instance_id ) {
			var extension_instance = module_runtime.get_instance( instance_id );

			if ( extension_instance && 'function' === typeof extension_instance.consume_signed_action_context ) {
				consumed = extension_instance.consume_signed_action_context( 'new_booking', query_arg, token ) || consumed;
			}
		} );

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
	function handle_booking_creation_created( event ) {
		var detail = event && event.detail && 'object' === typeof event.detail ? event.detail : {};
		var request_id = String( detail.request_id || '' );
		var booking_id = Math.max( 0, Math.round( Number( detail.booking_id ) || 0 ) );
		var resource_id = Math.max( 0, Math.round( Number( detail.resource_id ) || 0 ) );
		var anchor;
		var readback_generation;
		var readback_request;

		if (
			! booking_creation_host_enabled
			|| ! is_initialized
			|| 1 !== Number( detail.schema_version )
			|| ! /^[A-Za-z0-9._-]{1,191}$/.test( request_id )
			|| ! booking_id
			|| ! resource_id
			|| request_id === active_booking_creation_readback_id
			|| completed_booking_creation_readback_ids[ request_id ]
		) {
			return;
		}
		active_booking_creation_readback_id = request_id;
		if (
			booking_interactions_controller
			&& 'function' === typeof booking_interactions_controller.prepare_created_booking_readback
		) {
			booking_interactions_controller.prepare_created_booking_readback( booking_id );
		}
		consume_booking_creation_selection( detail );
		anchor = capture_axis_anchor();
		readback_generation = begin_authoritative_readback( 'booking_creation' );
		invalidate_availability_cache();
		readback_request = request_window( add_current_window_span( {
			anchor_at: anchor.at,
			anchor_ratio: anchor.ratio,
			window_position: 0,
			view: settings.current_axis ? settings.current_axis.view : settings.axis.view
		}, true ), anchor, true, {
			loading: settings.i18n.reloading_timeline,
			complete: settings.i18n.status_ready,
			preserve_selection: true,
			suppress_complete_message: true
		} );
		track_authoritative_readback( readback_request, readback_generation, 'booking_creation' );
		if ( ! readback_request || 'function' !== typeof readback_request.done || 'function' !== typeof readback_request.fail ) {
			active_booking_creation_readback_id = '';
			remember_booking_creation_readback_id( request_id );
			dispatch_booking_creation_readback_result( {
				schema_version: 1,
				request_id: request_id,
				state: 'failed',
				booking_id: booking_id,
				booking_visible: false
			} );
			return;
		}
		readback_request.done( function () {
			var booking_visible = false;
			var creation_inspector = mount.querySelector( '[data-wpbc-booking-new-inspector-host] [data-wpbc-shared-ui-inspector]' );

			if ( request_id !== active_booking_creation_readback_id ) {
				return;
			}
			if (
				booking_interactions_controller
				&& 'function' === typeof booking_interactions_controller.complete_created_booking_readback
			) {
				booking_visible = booking_interactions_controller.complete_created_booking_readback( booking_id );
			}
			active_booking_creation_readback_id = '';
			remember_booking_creation_readback_id( request_id );
			dispatch_booking_creation_readback_result( {
				schema_version: 1,
				request_id: request_id,
				state: 'accepted',
				booking_id: booking_id,
				booking_visible: booking_visible
			} );
			if (
				booking_visible
				&& true === detail.open_booking_inspector
				&& booking_interactions_controller
				&& 'function' === typeof booking_interactions_controller.open_created_booking_inspector
			) {
				booking_interactions_controller.open_created_booking_inspector( booking_id );
			} else if (
				booking_visible
				&& creation_inspector
				&& creation_inspector.hidden
				&& booking_interactions_controller
				&& 'function' === typeof booking_interactions_controller.focus_created_booking
			) {
				booking_interactions_controller.focus_created_booking( booking_id );
			}
		} ).fail( function () {
			if ( request_id !== active_booking_creation_readback_id ) {
				return;
			}
			active_booking_creation_readback_id = '';
			remember_booking_creation_readback_id( request_id );
			dispatch_booking_creation_readback_result( {
				schema_version: 1,
				request_id: request_id,
				state: 'failed',
				booking_id: booking_id,
				booking_visible: false
			} );
		} );
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
		var readback_generation = begin_authoritative_readback( 'booking_geometry' );

		invalidate_availability_cache();
		return track_authoritative_readback( request_window( add_current_window_span( {
			anchor_at: anchor.at,
			anchor_ratio: anchor.ratio,
			window_position: 0,
			view: settings.current_axis ? settings.current_axis.view : settings.axis.view
		}, true ), anchor, true, {
			loading: settings.i18n.reloading_timeline,
			complete: settings.i18n.status_ready,
			suppress_complete_message: true,
			preserve_selection: true
		} ), readback_generation, 'booking_geometry' );
	}

	/**
	 * Create the booking-interactions controller through the module registry.
	 *
	 * @return {boolean} True when booking interactions initialized.
	 */
	function initialize_booking_interactions() {
		var module_runtime = window.wpbc_timeline_modules;

		if (
			! module_runtime
			|| 'function' !== typeof module_runtime.has_factory
			|| 'function' !== typeof module_runtime.create
			|| ! module_runtime.has_factory( 'booking_interactions' )
		) {
			return false;
		}

		booking_interactions_controller = module_runtime.create(
			'booking_interactions',
			booking_interactions_instance_id,
			{
				mount: mount,
				settings: settings,
				is_empty_range_resizing: function () {
					return Boolean( empty_range_selection_controller && empty_range_selection_controller.is_resizing() );
				},
				refresh_after_inspector_save: refresh_after_booking_inspector_save,
				refresh_after_resize_apply: refresh_after_booking_resize_apply,
				scroll_axis_from_external_wheel: scroll_axis_from_external_wheel,
				is_host_active: function () {
					return is_initialized;
				},
				set_axis_window_loading_locked: set_axis_window_loading_locked,
				show_admin_message: show_standard_admin_message
			}
		);

		return Boolean( booking_interactions_controller );
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
	function set_axis_window_loading_locked( is_locked ) {
		is_axis_window_loading_locked = Boolean( is_locked );
		if ( is_axis_window_loading_locked ) {
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

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			module_runtime.destroy( booking_interactions_instance_id );
		} else if ( booking_interactions_controller && 'function' === typeof booking_interactions_controller.destroy ) {
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
		if ( booking_interactions_controller ) {
			booking_interactions_controller.schedule_layout();
		}
	}

	/**
	 * Ask booking interactions to reconcile geometry after axis motion settles.
	 *
	 * @return {void}
	 */
	function schedule_booking_interaction_layout_after_axis_motion() {
		if ( booking_interactions_controller ) {
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

		if (
			! module_runtime
			|| 'function' !== typeof module_runtime.has_factory
			|| 'function' !== typeof module_runtime.create
			|| ! module_runtime.has_factory( 'rendering' )
		) {
			return false;
		}

		rendering_controller = module_runtime.create(
			'rendering',
			rendering_instance_id,
			{
				mount: mount,
				settings: settings,
				get_template: get_template,
				begin_booking_refresh: function () {
					if ( booking_interactions_controller ) {
						booking_interactions_controller.begin_refresh();
					}
				},
				register_booking_segment: function ( segment_element, segment, resource_summary ) {
					if ( booking_interactions_controller ) {
						booking_interactions_controller.register_segment( segment_element, segment, resource_summary );
					}
				},
				complete_booking_refresh: function () {
					if ( booking_interactions_controller ) {
						booking_interactions_controller.complete_refresh();
					}
				},
				after_row_synchronization: handle_rows_synchronized,
				is_host_active: function () {
					return is_initialized;
				}
			}
		);

		return Boolean( rendering_controller );
	}

	/**
	 * Destroy and forget the extracted rendering controller.
	 *
	 * @return {void}
	 */
	function destroy_rendering() {
		var module_runtime = window.wpbc_timeline_modules;

		if ( module_runtime && 'function' === typeof module_runtime.destroy ) {
			module_runtime.destroy( rendering_instance_id );
		} else if ( rendering_controller && 'function' === typeof rendering_controller.destroy ) {
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
	function render_rows( initial ) {
		return Boolean( rendering_controller && rendering_controller.render_rows( initial ) );
	}

	/**
	 * Ask the rendering module to observe current row halves.
	 *
	 * @return {void}
	 */
	function observe_rendered_rows() {
		if ( rendering_controller ) {
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
	function synchronize_overflow_tooltips( timeline_mount ) {
		if ( ! timeline_mount || ! window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.synchronize_overflow_tooltips ) {
			return;
		}

		window.wpbc_ui_catalog.synchronize_overflow_tooltips( timeline_mount );
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
		if ( overflow_tooltip_frame ) {
			return;
		}

		overflow_tooltip_frame = window.requestAnimationFrame( function () {
			overflow_tooltip_frame = 0;
			synchronize_overflow_tooltips( mount );
		} );
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
		if ( window_cache_controller ) {
			window_cache_controller.abort_edge_requests();
		}
	}

	/**
	 * Reset the bounded cache around one authoritative current response.
	 *
	 * @param {Object} response Authorized window response.
	 * @return {Object} Normalized current payload.
	 */
	function reset_window_store( response ) {
		if ( empty_range_selection_controller && empty_range_selection_controller.is_active() ) {
			empty_range_selection_controller.reset();
		}

		return window_cache_controller ? window_cache_controller.reset( response ) : null;
	}

	/**
	 * Add one adjacent response only when it belongs to the current Resource set.
	 *
	 * @param {Object} response Authorized window response.
	 * @return {boolean} True when cached.
	 */
	function cache_adjacent_window( response ) {
		return window_cache_controller ? window_cache_controller.cache_adjacent( response ) : false;
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
	function map_timestamp_to_axis_position( timestamp, cells ) {
		return window_cache_controller ? window_cache_controller.map_timestamp_to_axis_position( timestamp, cells ) : 0;
	}

	/**
	 * Delegate composed-axis selection geometry to the window/cache controller.
	 *
	 * @param {Object} axis Composed axis DTO.
	 * @param {number} start_epoch Inclusive selection start.
	 * @param {number} end_epoch Exclusive selection end.
	 * @return {Object} Exact and cell-expanded percentage geometry.
	 */
	function get_composed_segment_geometry( axis, start_epoch, end_epoch ) {
		return window_cache_controller
			? window_cache_controller.get_composed_segment_geometry( axis, start_epoch, end_epoch )
			: {};
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
		var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );
		var axis_viewport = mount.querySelector( '[data-wpbc-timeline-axis-viewport]' );

		if ( ! canvas || ! axis_viewport ) {
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
		if ( window_cache_controller ) {
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
	function activate_adjacent_navigation_intent( direction, force ) {
		return window_cache_controller ? window_cache_controller.activate_adjacent_intent( direction, force ) : false;
	}

	/**
	 * Map a physical horizontal gesture to the logical Timeline edge.
	 *
	 * @param {number} horizontal_delta Signed wheel or trackpad delta.
	 * @return {string} Previous or next edge, or an empty string.
	 */
	function get_adjacent_direction_for_horizontal_delta( horizontal_delta ) {
		if ( 0 === horizontal_delta ) {
			return '';
		}

		if ( 0 > horizontal_delta ) {
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
	function get_horizontal_wheel_delta( event ) {
		var delta_x = Number( event.deltaX ) || 0;
		var delta_y = Number( event.deltaY ) || 0;

		if ( event.shiftKey && Math.abs( delta_y ) > Math.abs( delta_x ) ) {
			return delta_y;
		}
		if ( Math.abs( delta_x ) <= Math.abs( delta_y ) ) {
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
	function is_outward_canvas_gesture( canvas, horizontal_delta ) {
		var canvas_body = canvas.querySelector( '.wpbc_timeline__canvas_body' );
		var canvas_rectangle;
		var body_rectangle;
		var boundary_tolerance = 2;

		if ( ! canvas_body || 0 === horizontal_delta ) {
			return false;
		}

		canvas_rectangle = canvas.getBoundingClientRect();
		body_rectangle = canvas_body.getBoundingClientRect();

		if ( 0 > horizontal_delta ) {
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
	function contain_canvas_boundary_gesture( event ) {
		var horizontal_delta;
		var direction;
		var is_outward_gesture;

		if ( ! event.cancelable || event.ctrlKey || event.metaKey || event.altKey ) {
			return;
		}

		horizontal_delta = get_horizontal_wheel_delta( event );
		if ( ! horizontal_delta ) {
			return;
		}
		direction = get_adjacent_direction_for_horizontal_delta( horizontal_delta );
		activate_adjacent_navigation_intent( direction, false );
		is_outward_gesture = is_outward_canvas_gesture( event.currentTarget, horizontal_delta );
		if ( ! is_outward_gesture ) {
			return;
		}

		request_adjacent_window( direction );
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
	function get_horizontal_wheel_distance( event, horizontal_delta ) {
		if ( 1 === event.deltaMode ) {
			return horizontal_delta * 16;
		}
		if ( 2 === event.deltaMode ) {
			return horizontal_delta * Math.max( 1, axis_scroll_canvas ? axis_scroll_canvas.clientWidth : 1 );
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
	function scroll_axis_from_external_wheel( event ) {
		var horizontal_delta;
		var horizontal_distance;
		var direction;

		if (
			! axis_scroll_canvas
			|| ! event
			|| ! event.cancelable
			|| event.ctrlKey
			|| event.metaKey
			|| event.altKey
		) {
			return false;
		}

		horizontal_delta = get_horizontal_wheel_delta( event );
		if ( ! horizontal_delta ) {
			return false;
		}
		direction = get_adjacent_direction_for_horizontal_delta( horizontal_delta );
		activate_adjacent_navigation_intent( direction, false );
		if ( is_outward_canvas_gesture( axis_scroll_canvas, horizontal_delta ) ) {
			request_adjacent_window( direction );
			return true;
		}

		horizontal_distance = get_horizontal_wheel_distance( event, horizontal_delta );
		horizontal_distance = settings.is_rtl ? -horizontal_distance : horizontal_distance;
		if ( 'function' === typeof axis_scroll_canvas.scrollBy ) {
			axis_scroll_canvas.scrollBy( {
				behavior: 'auto',
				left: horizontal_distance,
				top: 0
			} );
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
	function handle_canvas_navigation_pointer_down( event ) {
		if ( 'mouse' === event.pointerType && 0 !== event.button ) {
			return;
		}
		if ( window_cache_controller ) {
			window_cache_controller.set_pointer_navigation_active( true );
		}
	}

	/**
	 * Connect the interactive horizontal scroller and contain its boundaries.
	 *
	 * @return {void}
	 */
	function initialize_axis_scroll_synchronization() {
		var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );

		if ( ! canvas || axis_scroll_canvas ) {
			return;
		}

		axis_scroll_canvas = canvas;
		document.documentElement.classList.add( 'wpbc_timeline_scroll_contained' );
		document.body.classList.add( 'wpbc_timeline_scroll_contained' );
		canvas.addEventListener( 'scroll', synchronize_axis_scroll, { passive: true } );
		canvas.addEventListener( 'scroll', handle_window_store_scroll, { passive: true } );
		canvas.addEventListener( 'scroll', schedule_edge_status_positioning, { passive: true } );
		canvas.addEventListener( 'scroll', position_empty_range_selection_popover, { passive: true } );
		canvas.addEventListener( 'wheel', contain_canvas_boundary_gesture, { passive: false } );
		canvas.addEventListener( 'pointerdown', handle_canvas_navigation_pointer_down, { passive: true } );
		window.addEventListener( 'resize', synchronize_axis_scroll );
		window.addEventListener( 'resize', schedule_edge_status_positioning );
		window.addEventListener( 'resize', position_empty_range_selection_popover );
		window.addEventListener( 'scroll', schedule_edge_status_positioning, { passive: true } );
		window.addEventListener( 'scroll', position_empty_range_selection_popover, { passive: true } );
		synchronize_axis_scroll();
	}

	/**
	 * Ask the extracted selection controller to reconcile its popover position.
	 *
	 * @return {void}
	 */
	function position_empty_range_selection_popover() {
		if ( empty_range_selection_controller ) {
			empty_range_selection_controller.position_popover();
		}
	}

	/**
	 * Update the screen-reader status without injecting markup.
	 *
	 * @param {string} message Status announcement.
	 * @return {void}
	 */
	function announce( message ) {
		if ( status_region ) {
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
	function show_standard_admin_message( message, message_type, delay ) {
		if ( 'function' !== typeof window.wpbc_admin_show_message ) {
			return;
		}

		window.wpbc_admin_show_message( escape_admin_message_text( message ), message_type, delay, false );
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
	function escape_admin_message_text( message ) {
		return String( message || '' )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
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
		var overlay = mount.querySelector( '[data-wpbc-timeline-request-overlay]' );
		var overlay_message = mount.querySelector( '[data-wpbc-timeline-request-overlay-message]' );
		var toolbar_controls = mount.querySelectorAll( '[data-wpbc-timeline-toolbar] button, [data-wpbc-timeline-toolbar] select, [data-wpbc-timeline-toolbar] input' );
		var blocking_surfaces = mount.querySelectorAll( '[data-wpbc-timeline-toolbar], .wpbc_timeline__sticky_header, .wpbc_timeline__body, [data-wpbc-timeline-state]' );
		var is_loading = is_selection_apply_loading || is_foreground_request_loading || is_availability_loading;
		var message = is_selection_apply_loading
			? selection_apply_loading_message
			: ( is_foreground_request_loading ? foreground_request_loading_message : settings.i18n.loading_availability_backgrounds );
		var focus_to_restore;

		if ( booking_interactions_controller ) {
			booking_interactions_controller.set_request_loading( is_loading );
		}
		mount.classList.toggle( 'is-request-loading', is_loading );
		mount.setAttribute( 'aria-busy', is_loading ? 'true' : 'false' );
		if ( overlay ) {
			overlay.hidden = ! is_loading;
			overlay.setAttribute( 'aria-hidden', is_loading ? 'false' : 'true' );
		}
		Array.prototype.forEach.call( blocking_surfaces, function ( blocking_surface ) {
			if ( is_loading ) {
				blocking_surface.setAttribute( 'inert', '' );
			} else {
				blocking_surface.removeAttribute( 'inert' );
			}
		} );
		if ( is_loading ) {
			if ( overlay_message ) {
				overlay_message.textContent = message || settings.i18n.loading;
			}
			if ( ! foreground_request_focus && document.activeElement && mount.contains( document.activeElement ) ) {
				foreground_request_focus = document.activeElement;
			}
			Array.prototype.forEach.call( toolbar_controls, function ( toolbar_control ) {
				toolbar_control.disabled = true;
			} );
			return;
		}

		Array.prototype.forEach.call( toolbar_controls, function ( toolbar_control ) {
			toolbar_control.disabled = false;
		} );
		if ( toolbar_navigation_controller ) {
			toolbar_navigation_controller.refresh_after_window_render();
		}
		focus_to_restore = foreground_request_focus;
		foreground_request_focus = null;
		if ( focus_to_restore && document.documentElement.contains( focus_to_restore ) ) {
			window.requestAnimationFrame( function () {
				if ( ! is_initialized ) {
					return;
				}
				try {
					focus_to_restore.focus( { preventScroll: true } );
				} catch ( error ) {
					focus_to_restore.focus();
				}
			} );
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
	function set_selection_apply_loading( is_loading, message ) {
		is_selection_apply_loading = Boolean( is_loading );
		selection_apply_loading_message = is_selection_apply_loading
			? ( message || settings.i18n.applying_availability || settings.i18n.loading )
			: '';
		if ( is_selection_apply_loading ) {
			announce( selection_apply_loading_message );
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
	function set_foreground_request_loading( is_loading, message, generation ) {
		if ( ! is_loading && generation && window_cache_controller && ! window_cache_controller.is_foreground_generation_current( generation ) ) {
			return;
		}
		is_foreground_request_loading = Boolean( is_loading );
		foreground_request_loading_message = is_foreground_request_loading ? ( message || settings.i18n.loading ) : '';
		if ( is_loading ) {
			announce( message || settings.i18n.loading );
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
	function set_row_expanded( row_key, is_expanded, trigger ) {
		if ( rendering_controller ) {
			rendering_controller.set_row_expanded( row_key, is_expanded, trigger );
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
	function set_hierarchy_expanded( parent_id, is_expanded, trigger ) {
		if ( rendering_controller ) {
			rendering_controller.set_hierarchy_expanded( parent_id, is_expanded, trigger );
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
		return window_cache_controller
			? window_cache_controller.capture_axis_anchor()
			: { at: settings.axis.anchor.at, ratio: 0.5, restore_focus: false };
	}



	/**
	 * Delegate physical anchor restoration to the window/cache controller.
	 *
	 * @param {Object} anchor Captured anchor state.
	 * @return {number|null} Remaining physical alignment error.
	 */
	function restore_axis_anchor( anchor ) {
		return window_cache_controller ? window_cache_controller.restore_axis_anchor( anchor ) : null;
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
		if ( window_cache_controller ) {
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
	function schedule_axis_anchor_restoration( anchor, on_complete ) {
		if ( window_cache_controller ) {
			window_cache_controller.schedule_anchor_restoration( anchor, on_complete );
		}
	}


	/**
	 * Resolve a requested date against a newly authorized server axis.
	 *
	 * @param {Object} anchor Requested navigation anchor.
	 * @param {Object} axis   Server-authoritative axis DTO.
	 * @return {boolean} True when the requested calendar date was resolved.
	 */
	function resolve_response_date_anchor( anchor, axis ) {
		return window_cache_controller ? window_cache_controller.resolve_response_date_anchor( anchor, axis ) : false;
	}

	/**
	 * Determine whether an anchor instant is already present in the bounded cache.
	 *
	 * @param {Object} anchor Timestamp anchor.
	 * @return {boolean} True when a cached authorized axis contains the instant.
	 */
	function is_anchor_loaded( anchor ) {
		return window_cache_controller ? window_cache_controller.is_anchor_loaded( anchor ) : false;
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
		if ( ! window_cache_controller || ! window_cache_controller.abort_foreground_request() ) {
			return;
		}
		show_standard_admin_message( settings.i18n.status_ready, 'info', 1000 );
		set_foreground_request_loading( false, '', 0 );
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
	function refresh_today_presentation( anchor ) {
		var anchor_epoch = Number( anchor.epoch );
		var cells = settings.axis && Array.isArray( settings.axis.cells ) ? settings.axis.cells : [];
		var target_cell = null;

		cells.some( function ( cell ) {
			if ( anchor_epoch >= Number( cell.start_epoch ) && anchor_epoch < Number( cell.end_epoch ) ) {
				target_cell = cell;
				return true;
			}
			return false;
		} );
		if ( ! target_cell ) {
			return;
		}

		if ( settings.axis.is_timed ) {
			var position_percent = 100 * map_timestamp_to_axis_position( anchor_epoch, cells ) / Math.max( 1, cells.length );

			Array.prototype.forEach.call(
				mount.querySelectorAll( '.wpbc_timeline__current_time_header, .wpbc_timeline__current_time_marker' ),
				function ( marker ) {
					marker.style.setProperty( 'inset-inline-start', position_percent + '%' );
				}
			);
			return;
		}

		Array.prototype.forEach.call( mount.querySelectorAll( '[data-wpbc-timeline-date]' ), function ( date_element ) {
			date_element.classList.toggle( 'is-today', target_cell.date === date_element.getAttribute( 'data-wpbc-timeline-date' ) );
		} );
	}

	/**
	 * Restore an already-authorized cached instant without issuing another read.
	 *
	 * @param {Object} anchor  Timestamp anchor.
	 * @param {Object} options Cached-navigation presentation options.
	 * @return {boolean} True when the cache handled the navigation.
	 */
	function restore_loaded_anchor( anchor, options ) {
		var state_host;
		var restore_options = Object.assign( {
			refresh_today: false,
			announcement: settings.i18n.status_ready
		}, options || {} );

		if ( ! is_anchor_loaded( anchor ) ) {
			return false;
		}

		abort_active_window_request();
		abort_edge_requests();
		cancel_axis_anchor_restoration();
		suspend_adjacent_loading_for_navigation();
		render_edge_states();
		if ( toolbar_navigation_controller ) {
			toolbar_navigation_controller.refresh_after_window_render();
		}
		state_host = mount.querySelector( '[data-wpbc-timeline-state]' );
		if ( state_host && state_host.querySelector( '.wpbc_timeline__state--error' ) ) {
			state_host.hidden = true;
		}
		window.requestAnimationFrame( function () {
			if ( ! is_initialized ) {
				return;
			}
			if ( restore_options.refresh_today ) {
				refresh_today_presentation( anchor );
			}
			restore_axis_anchor( anchor );
			announce( restore_options.announcement );
		} );

		return true;
	}

	/**
	 * Render one previous or next edge state into its header and canvas hosts.
	 *
	 * @param {string} direction Previous or next.
	 * @return {void}
	 */
	function render_edge_state( direction ) {
		var state = window_cache_controller ? window_cache_controller.get_edge_state( direction ) : { status: 'idle' };
		var template_key = 'edge_' + state.status;
		var header_host = mount.querySelector( '[data-wpbc-timeline-edge-header="' + direction + '"]' );
		var canvas_host = mount.querySelector( '[data-wpbc-timeline-edge-canvas="' + direction + '"]' );
		var edge_entry = get_edge_window_entry( direction );
		var window_context = edge_entry && edge_entry.payload.window_context ? edge_entry.payload.window_context : {};
		var previews = window_context.adjacent_previews && 'object' === typeof window_context.adjacent_previews
			? window_context.adjacent_previews
			: {};
		var preview = previews[ direction ] && 'object' === typeof previews[ direction ]
			? previews[ direction ]
			: {};
		var common_view_model = {
			direction: direction,
			i18n: settings.i18n,
			preview: {
				range_label: String( preview.range_label || '' ),
				is_timed: Boolean( preview.is_timed ),
				cells: Array.isArray( preview.cells ) ? preview.cells : []
			},
			placeholder_rows: build_edge_placeholder_rows()
		};

		render_template( header_host, template_key, Object.assign( {}, common_view_model, { area: 'header' } ) );
		render_template( canvas_host, template_key, Object.assign( {}, common_view_model, { area: 'canvas' } ) );
		schedule_edge_status_positioning();
	}

	/**
	 * Build row-height placeholders aligned with the currently visible canvas rows.
	 *
	 * @return {Array<Object>} Template-safe placeholder row records.
	 */
	function build_edge_placeholder_rows() {
		var cell_count = get_window_loading_limits().edge_placeholder_cells;
		var canvas_rows = mount.querySelectorAll( '.wpbc_timeline__canvas_row:not([hidden])' );
		var placeholder_rows = [];

		Array.prototype.forEach.call( canvas_rows, function ( canvas_row ) {
			var cells = [];
			var cell_index;

			for ( cell_index = 0; cell_index < cell_count; cell_index += 1 ) {
				cells.push( cell_index );
			}
			placeholder_rows.push( {
				height_px: Math.max( 1, Math.ceil( canvas_row.getBoundingClientRect().height ) ),
				cells: cells
			} );
		} );

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

		[ 'previous', 'next' ].forEach( function ( direction ) {
			var host = mount.querySelector( '[data-wpbc-timeline-edge-canvas="' + direction + '"]' );
			var rendered_rows = host ? host.querySelectorAll( '.wpbc_timeline__edge_placeholder_row' ) : [];

			if ( ! host || rendered_rows.length !== placeholder_rows.length ) {
				requires_render = Boolean( host );
				return;
			}

			Array.prototype.forEach.call( rendered_rows, function ( rendered_row, row_index ) {
				rendered_row.style.height = placeholder_rows[ row_index ].height_px + 'px';
			} );
		} );

		if ( requires_render ) {
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
		var sticky_header = mount.querySelector( '.wpbc_timeline__sticky_header' );
		var sticky_boundary = sticky_header && 'function' === typeof sticky_header.getBoundingClientRect
			? sticky_header.getBoundingClientRect().bottom
			: 0;
		var status_elements = mount.querySelectorAll(
			'.wpbc_timeline__edge_buffer.is-canvas .wpbc_timeline__edge_status'
		);
		var sticky_gap = 18;
		var viewport_height = document.documentElement.clientHeight || window.innerHeight || 0;

		Array.prototype.forEach.call( status_elements, function ( status_element ) {
			var edge_buffer = status_element.closest( '.wpbc_timeline__edge_buffer' );
			var buffer_rectangle;
			var maximum_offset;
			var desired_offset;
			var visible_space;

			if ( ! edge_buffer ) {
				return;
			}
			buffer_rectangle = edge_buffer.getBoundingClientRect();
			maximum_offset = Math.max(
				sticky_gap,
				edge_buffer.offsetHeight - status_element.offsetHeight - sticky_gap
			);
			visible_space = Math.max( 0, viewport_height - sticky_boundary - status_element.offsetHeight );
			desired_offset = Math.max(
				sticky_gap,
				sticky_boundary + Math.max( sticky_gap, visible_space / 3 ) - buffer_rectangle.top
			);
			status_element.style.setProperty(
				'--wpbc-timeline-edge-status-offset',
				Math.min( maximum_offset, desired_offset ) + 'px'
			);
		} );
	}

	/**
	 * Coalesce viewport and layout events into one sticky-card measurement.
	 *
	 * @return {void}
	 */
	function schedule_edge_status_positioning() {
		if ( edge_status_frame ) {
			return;
		}

		edge_status_frame = window.requestAnimationFrame( function () {
			edge_status_frame = 0;
			update_edge_status_positions();
		} );
	}

	/**
	 * Render both bounded edge states.
	 *
	 * @return {void}
	 */
	function render_edge_states() {
		if ( ! settings.initial || ! Array.isArray( settings.initial.resources ) || ! settings.initial.resources.length ) {
			[ 'previous', 'next' ].forEach( function ( direction ) {
				var header_host = mount.querySelector( '[data-wpbc-timeline-edge-header="' + direction + '"]' );
				var canvas_host = mount.querySelector( '[data-wpbc-timeline-edge-canvas="' + direction + '"]' );

				if ( header_host ) {
					header_host.textContent = '';
				}
				if ( canvas_host ) {
					canvas_host.textContent = '';
				}
			} );
			return;
		}
		render_edge_state( 'previous' );
		render_edge_state( 'next' );
	}

	/**
	 * Render the complete bounded cache through existing WordPress templates.
	 *
	 * @param {Object} anchor Timestamp and viewport position to restore.
	 * @param {string} announcement Optional screen-reader completion message.
	 * @return {boolean} True when a composed view was rendered.
	 */
	function render_window_store( anchor, announcement ) {
		var composed = compose_window_store();
		var state_host = mount.querySelector( '[data-wpbc-timeline-state]' );
		var browser_expansion_preferences = settings.preferences || {};
		var accepted_window_entries;

		if ( ! composed ) {
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
		settings.preferences = Object.assign( {}, composed.current.preferences || {}, {
			expanded_resource_ids: Array.isArray( browser_expansion_preferences.expanded_resource_ids )
				? browser_expansion_preferences.expanded_resource_ids.slice()
				: [],
			expanded_parent_ids: Array.isArray( browser_expansion_preferences.expanded_parent_ids )
				? browser_expansion_preferences.expanded_parent_ids.slice()
				: []
		} );
		settings.initial = {
			load_state: 'loaded',
			resources: composed.resources,
			segments: composed.segments,
			occupancy: composed.occupancy,
			time_slot_overflows: composed.time_slot_overflows || []
		};
		render_template( mount.querySelector( '[data-wpbc-timeline-axis-header]' ), 'axis_header', settings );
		render_template( mount.querySelector( '[data-wpbc-timeline-canvas-backdrop]' ), 'canvas_backdrop', settings );
		if ( toolbar_navigation_controller ) {
			toolbar_navigation_controller.refresh_after_window_render();
		}
		if ( resource_navigation_controller ) {
			resource_navigation_controller.refresh( settings.resource_view, settings.resource_pagination );
		}
		if ( render_rows( settings.initial ) ) {
			if ( resource_settings_controller ) {
				resource_settings_controller.refresh( settings.initial.resources );
			}
			state_host.hidden = true;
			if ( announcement ) {
				announce( announcement );
			}
		} else {
			state_host.hidden = false;
			render_template( state_host, 'empty', settings );
			announce( settings.i18n.status_empty );
		}
		if ( empty_range_selection_controller ) {
			empty_range_selection_controller.render();
		}
		render_edge_states();
		observe_rendered_rows();
		schedule_axis_anchor_restoration( anchor, initialize_edge_observer );
		accepted_window_entries = window_cache_controller && 'function' === typeof window_cache_controller.get_ordered_window_entries
			? window_cache_controller.get_ordered_window_entries()
			: [];
		notify_accepted_booking_windows( accepted_window_entries );
		synchronize_availability_cache( accepted_window_entries );

		return true;
	}

	/**
	 * Return the outer cached entry used to request one more adjacent window.
	 *
	 * @param {string} direction Previous or next.
	 * @return {Object|null} Cache entry or null.
	 */
	function get_edge_window_entry( direction ) {
		return window_cache_controller ? window_cache_controller.get_edge_window_entry( direction ) : null;
	}

	/**
	 * Promote the cached window containing the visible timestamp.
	 *
	 * @return {void}
	 */
	function promote_visible_window() {
		var anchor = capture_axis_anchor();
		var promotion = window_cache_controller ? window_cache_controller.promote_for_anchor( anchor ) : null;

		if ( ! promotion ) {
			return;
		}
		if ( promotion.trimmed ) {
			render_window_store( anchor, '' );
		} else {
			settings.window = promotion.entry.payload.window;
			settings.window_context = promotion.entry.payload.window_context;
			settings.view_policy = promotion.entry.payload.view_policy;
			settings.current_axis = promotion.entry.payload.axis;
			if ( toolbar_navigation_controller ) {
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
	function is_edge_sentinel_near( canvas_rectangle, sentinel_rectangle, expansion_percent ) {
		var threshold = canvas_rectangle.width * expansion_percent / 100;

		return sentinel_rectangle.right >= canvas_rectangle.left - threshold && sentinel_rectangle.left <= canvas_rectangle.right + threshold;
	}

	/**
	 * Process scroll-time promotion and the non-observer edge fallback once.
	 *
	 * @return {void}
	 */
	function handle_window_store_scroll() {
		var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );
		var limits = get_window_loading_limits();

		if ( is_axis_window_loading_locked || edge_scroll_frame || ! canvas ) {
			return;
		}
		edge_scroll_frame = window.requestAnimationFrame( function () {
			var canvas_rectangle = canvas.getBoundingClientRect();

			edge_scroll_frame = 0;
			promote_visible_window();
			[ 'previous', 'next' ].forEach( function ( direction ) {
				var sentinel = canvas.querySelector( '[data-wpbc-timeline-edge-sentinel="' + direction + '"]' );
				var sentinel_rectangle;
				var is_near_rearm;

				if ( ! sentinel || ! window_cache_controller ) {
					return;
				}
				sentinel_rectangle = sentinel.getBoundingClientRect();
				is_near_rearm = is_edge_sentinel_near( canvas_rectangle, sentinel_rectangle, limits.edge_rearm_percent );
				if ( window_cache_controller.update_edge_proximity(
					direction,
					is_near_rearm,
					is_edge_sentinel_near( canvas_rectangle, sentinel_rectangle, limits.edge_prefetch_percent )
				) ) {
					request_adjacent_window( direction );
				}
			} );
		} );
	}

	/**
	 * Observe bounded edge sentinels relative to the Timeline canvas.
	 *
	 * @return {void}
	 */
	function initialize_edge_observer() {
		var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );
		var limits = get_window_loading_limits();
		var margin = '0px ' + limits.edge_prefetch_percent + '%';

		if ( edge_observer ) {
			edge_observer.disconnect();
			edge_observer = null;
		}
		if ( ! canvas || 'function' !== typeof window.IntersectionObserver ) {
			return;
		}
		edge_observer = new window.IntersectionObserver( function ( entries ) {
			entries.forEach( function ( entry ) {
				var direction = entry.target.getAttribute( 'data-wpbc-timeline-edge-sentinel' );
				var state = window_cache_controller ? window_cache_controller.get_edge_state( direction ) : null;

				if ( entry.isIntersecting && direction && state && state.armed && state.user_intent && 'idle' === state.status ) {
					request_adjacent_window( direction );
				}
			} );
		}, { root: canvas, rootMargin: margin, threshold: 0.01 } );
		[ 'previous', 'next' ].forEach( function ( direction ) {
			var sentinel = canvas.querySelector( '[data-wpbc-timeline-edge-sentinel="' + direction + '"]' );
			var canvas_rectangle;
			var sentinel_rectangle;
			var state = window_cache_controller ? window_cache_controller.get_edge_state( direction ) : null;

			if ( sentinel && state ) {
				canvas_rectangle = canvas.getBoundingClientRect();
				sentinel_rectangle = sentinel.getBoundingClientRect();
				window_cache_controller.update_edge_proximity(
					direction,
					is_edge_sentinel_near( canvas_rectangle, sentinel_rectangle, limits.edge_rearm_percent ),
					false
				);
				edge_observer.observe( sentinel );
			}
		} );
	}

	/**
	 * Load one adjacent window without replacing the current working Timeline.
	 *
	 * @param {string} direction Previous or next.
	 * @param {Object} request_options Optional foreground-prime behavior.
	 * @return {Object|null} jQuery-compatible completion promise when available.
	 */
	function request_adjacent_window( direction, request_options ) {
		var transport = settings.transport || {};
		var options = Object.assign( {
			allow_without_user_intent: false,
			defer_render: false,
			silent: false,
			skip_promotion: false
		}, request_options || {} );
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

		if ( is_axis_window_loading_locked || ! completion ) {
			return null;
		}

		state = window_cache_controller ? window_cache_controller.get_edge_state( direction ) : null;
		had_user_intent = Boolean( state && state.user_intent );
		if ( ! options.skip_promotion ) {
			promote_visible_window();
		}
		if ( had_user_intent && ! options.allow_without_user_intent ) {
			activate_adjacent_navigation_intent( direction, true );
		}
		edge_entry = get_edge_window_entry( direction );
		descriptor = edge_entry && edge_entry.payload.window_context && edge_entry.payload.window_context.adjacent_requests ? edge_entry.payload.window_context.adjacent_requests[ direction ] : null;
		state = window_cache_controller ? window_cache_controller.get_edge_state( direction ) : null;
		limits = get_window_loading_limits();
		is_intent_blocked = ! options.allow_without_user_intent && (
			! state
			|| ! state.armed
			|| ! state.user_intent
			|| Date.now() < state.cooldown_until
		);

		if (
			! descriptor
			|| ! state
			|| ! edge_entry.payload.resources.length
			|| is_intent_blocked
			|| 'idle' !== state.status
			|| ! transport.url
			|| ! transport.action
			|| ! transport.nonce
		) {
			completion.resolve( false );
			return completion.promise();
		}
		generation = window_cache_controller.begin_edge_request( direction, options.allow_without_user_intent );
		if ( ! generation ) {
			completion.resolve( false );
			return completion.promise();
		}
		request_values = Object.assign( {}, descriptor, {
			action: transport.action,
			nonce: transport.nonce,
			request_generation: generation,
			resource_view_context: String( edge_entry.payload.window_context.resource_view_context || '' )
		} );
		if ( ! options.silent ) {
			render_edge_state( direction );
			announce( 'previous' === direction ? settings.i18n.loading_previous_dates : settings.i18n.loading_next_dates );
		}
		request = window.jQuery.ajax( {
			url: transport.url,
			method: 'POST',
			dataType: 'json',
			data: request_values,
			timeout: limits.request_timeout_ms
		} ).done( function ( response ) {
			if ( ! window_cache_controller.is_edge_generation_current( direction, generation ) ) {
				completion.reject( false );
				return;
			}
			if ( ! response || ! response.success || ! response.data || ! response.data.window || Number( response.data.window.request_generation ) !== generation ) {
				window_cache_controller.mark_edge_error( direction, generation );
				if ( ! options.silent ) {
					render_edge_state( direction );
					announce( settings.i18n.edge_load_failed );
				}
				completion.reject( false );
				return;
			}
			if ( ! cache_adjacent_window( response.data ) ) {
				window_cache_controller.mark_edge_error( direction, generation );
				if ( ! options.silent ) {
					render_edge_state( direction );
					announce( settings.i18n.edge_load_failed );
				}
				completion.reject( false );
				return;
			}
			trim_window_store();
			window_cache_controller.mark_edge_loaded( direction, generation );
			if ( ! options.defer_render ) {
				render_window_store( capture_axis_anchor(), settings.i18n.adjacent_dates_loaded );
			}
			completion.resolve( response.data );
		} ).fail( function ( request, request_status ) {
			if ( ! window_cache_controller.is_edge_generation_current( direction, generation ) || 'abort' === request_status ) {
				completion.reject( false );
				return;
			}
			window_cache_controller.mark_edge_error( direction, generation );
			if ( ! options.silent ) {
				render_edge_state( direction );
				announce( settings.i18n.edge_load_failed );
			}
			completion.reject( false );
		} ).always( function () {
			window_cache_controller.complete_edge_request( direction, generation );
		} );
		if ( window_cache_controller.set_edge_request( direction, generation, request ) ) {
			if ( ! options.silent ) {
				window_cache_controller.schedule_edge_slow_state( direction, generation, function () {
					render_edge_state( direction );
				} );
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
	function request_resource_context_neighbor( current_response, direction, generation ) {
		var transport = settings.transport || {};
		var window_context = current_response.window_context || {};
		var descriptors = window_context.adjacent_requests || {};
		var descriptor = descriptors[ direction ] || null;
		var completion = window.jQuery.Deferred();
		var request_values;
		var ajax_request = null;

		if ( ! descriptor || ! window_context.resource_view_context ) {
			completion.reject( false );
			return completion.promise();
		}
		request_values = Object.assign( {}, descriptor, {
			action: transport.action,
			nonce: transport.nonce,
			request_generation: generation,
			resource_view_context: String( window_context.resource_view_context )
		} );
		ajax_request = window.jQuery.ajax( {
			url: transport.url,
			method: 'POST',
			dataType: 'json',
			data: request_values,
			timeout: get_window_loading_limits().request_timeout_ms
		} ).done( function ( response ) {
			var response_context = response && response.data ? response.data.window_context || {} : {};

			if (
				! window_cache_controller.is_foreground_generation_current( generation )
				|| ! response
				|| ! response.success
				|| ! response.data
				|| ! response.data.window
				|| Number( response.data.window.request_generation ) !== generation
				|| String( response_context.resource_fingerprint || '' ) !== String( window_context.resource_fingerprint || '' )
			) {
				completion.reject( false );
				return;
			}
			completion.resolve( response.data );
		} ).fail( function () {
			completion.reject( false );
		} );

		return completion.promise( {
			abort: function () {
				if ( ajax_request && 'function' === typeof ajax_request.abort ) {
					ajax_request.abort();
				}
			}
		} );
	}

	/**
	 * Stage and atomically commit a complete new Resource three-window cache.
	 *
	 * @param {Object} current_response Authorized new current window.
	 * @param {number} generation Owning foreground generation.
	 * @return {Object} jQuery-compatible completion promise.
	 */
	function stage_resource_context_replacement( current_response, generation ) {
		var completion = window.jQuery.Deferred();
		var previous_request = request_resource_context_neighbor( current_response, 'previous', generation );
		var next_request = request_resource_context_neighbor( current_response, 'next', generation );

		window.jQuery.when( previous_request, next_request ).done( function ( previous_response, next_response ) {
			var committed;

			if ( ! window_cache_controller.is_foreground_generation_current( generation ) ) {
				completion.reject( false );
				return;
			}
			committed = window_cache_controller.replace_resource_context(
				current_response,
				[ previous_response, next_response ]
			);
			if ( ! committed ) {
				completion.reject( false );
				return;
			}
			completion.resolve( committed );
		} ).fail( function () {
			if ( previous_request && 'function' === typeof previous_request.abort ) {
				previous_request.abort();
			}
			if ( next_request && 'function' === typeof next_request.abort ) {
				next_request.abort();
			}
			completion.reject( false );
		} );

		return completion.promise( {
			abort: function () {
				if ( previous_request && 'function' === typeof previous_request.abort ) {
					previous_request.abort();
				}
				if ( next_request && 'function' === typeof next_request.abort ) {
					next_request.abort();
				}
			}
		} );
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
	function prime_surrounding_windows( anchor, announcement, foreground_generation ) {
		var completion = window.jQuery.Deferred();
		var remaining = 2;
		var settle = function () {
			remaining -= 1;
			if ( 0 < remaining ) {
				return;
			}
			if ( ! window_cache_controller.is_foreground_generation_current( foreground_generation ) ) {
				completion.reject( false );
				return;
			}
			trim_window_store();
			render_window_store( anchor, announcement );
			completion.resolve( true );
		};

		[ 'previous', 'next' ].forEach( function ( direction ) {
			var request = request_adjacent_window( direction, {
				allow_without_user_intent: true,
				defer_render: true,
				silent: true,
				skip_promotion: true
			} );

			if ( request && 'function' === typeof request.always ) {
				request.always( settle );
			} else {
				settle();
			}
		} );

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
	function cancel_adjacent_window( direction ) {
		if ( ! window_cache_controller || ! window_cache_controller.cancel_edge_request( direction ) ) {
			return;
		}
		render_edge_state( direction );
		announce( settings.i18n.loading_cancelled );
		window.requestAnimationFrame( function () {
			var load_button;

			if ( ! is_initialized ) {
				return;
			}
			load_button = mount.querySelector( '[data-wpbc-timeline-edge-load="' + direction + '"]' );
			if ( load_button ) {
				try {
					load_button.focus( { preventScroll: true } );
				} catch ( error ) {
					load_button.focus();
				}
			}
		} );
	}

	/**
	 * Render a safe full-window read error without exposing transport details.
	 *
	 * @param {string} error_message Authorized error text, or the generic fallback.
	 * @return {void}
	 */
	function render_window_error( error_message ) {
		var state_host = mount.querySelector( '[data-wpbc-timeline-state]' );

		settings.i18n.error_message = error_message || settings.i18n.error_message;
		if ( state_host ) {
			state_host.hidden = false;
			render_template( state_host, 'error', settings );
		}
		announce( settings.i18n.error_message );
	}

	/**
	 * Add the current server-approved day or calendar-month span to a request.
	 *
	 * @param {Object} request_values Mutable request values.
	 * @param {boolean} preserve_start Whether a month window must keep its exact start.
	 * @return {Object} The supplied request values.
	 */
	function add_current_window_span( request_values, preserve_start ) {
		if ( 0 < Number( settings.window.window_months ) ) {
			request_values.window_months = Number( settings.window.window_months );
			if ( preserve_start ) {
				request_values.anchor_at = settings.current_axis ? settings.current_axis.start_at : settings.axis.start_at;
				request_values.anchor_ratio = 0;
			}
		} else {
			request_values.window_days = Number( settings.window.window_days );
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
	function request_window( request_options, anchor, may_reduce, request_feedback ) {
		var transport = settings.transport || {};
		var feedback = Object.assign( {
			loading: settings.i18n.loading,
			complete: settings.i18n.status_ready
		}, request_feedback || {} );
		var generation;
		var request_values;
		var request;
		var resource_replacement;
		var completion = feedback.completion && 'function' === typeof feedback.completion.resolve
			? feedback.completion
			: ( window.jQuery ? window.jQuery.Deferred() : null );
		var finish_request = function () {
			if ( ! window_cache_controller.is_foreground_generation_current( generation ) ) {
				return;
			}
			window_cache_controller.complete_foreground_request( generation );
			set_foreground_request_loading( false, '', generation );
		};

		if ( is_axis_window_loading_locked ) {
			if ( completion ) {
				completion.reject( { message: '' } );
				return completion.promise();
			}
			return null;
		}
		if ( ! window.jQuery || ! transport.url || ! transport.action || ! transport.nonce ) {
			render_window_error( settings.i18n.error_message );
			if ( completion ) {
				completion.reject( { message: settings.i18n.error_message } );
				return completion.promise();
			}
			return null;
		}
		if ( empty_range_selection_controller && empty_range_selection_controller.is_active() && ! feedback.preserve_selection ) {
			empty_range_selection_controller.cancel( false );
		}
		abort_edge_requests();
		cancel_axis_anchor_restoration();
		generation = window_cache_controller.begin_foreground_request();
		request_values = Object.assign( {}, request_options, {
			action: transport.action,
			nonce: transport.nonce,
			request_generation: generation
		} );
		if ( ! request_values.resource_view_context && settings.window_context && settings.window_context.resource_view_context ) {
			request_values.resource_view_context = String( settings.window_context.resource_view_context );
		}
		set_foreground_request_loading( true, feedback.loading, generation );
		request = window.jQuery.ajax( {
			url: transport.url,
			method: 'POST',
			dataType: 'json',
			data: request_values,
			timeout: get_window_loading_limits().request_timeout_ms
		} ).done( function ( response ) {
			if ( ! window_cache_controller.is_foreground_generation_current( generation ) ) {
				completion.reject( { message: settings.i18n.error_message } );
				return;
			}
			if ( ! response || ! response.success || ! response.data || ! response.data.window || Number( response.data.window.request_generation ) !== generation ) {
				show_standard_admin_message( settings.i18n.error_message, 'error', 30000 );
				render_window_error( settings.i18n.error_message );
				completion.reject( { message: settings.i18n.error_message } );
				finish_request();
				return;
			}
			if ( anchor.target_date ) {
				if ( ! resolve_response_date_anchor( anchor, response.data.axis || {} ) && response.data.axis && response.data.axis.start_at ) {
					anchor.at = response.data.axis.start_at;
					delete anchor.epoch;
				}
			} else if ( anchor.use_response_start && response.data.axis && response.data.axis.start_at ) {
				anchor.at = response.data.axis.start_at;
			}
			if (
				window_cache_controller.get_resource_fingerprint()
				&& response.data.window_context
				&& response.data.window_context.resource_fingerprint
				&& window_cache_controller.get_resource_fingerprint() !== String( response.data.window_context.resource_fingerprint )
			) {
				resource_replacement = stage_resource_context_replacement( response.data, generation );
				window_cache_controller.set_foreground_request( generation, resource_replacement );
				resource_replacement.done( function () {
					settings.preferences = Object.assign( {}, settings.preferences || {}, {
						expanded_resource_ids: Array.isArray( response.data.preferences && response.data.preferences.expanded_resource_ids )
							? response.data.preferences.expanded_resource_ids.slice()
							: [],
						expanded_parent_ids: Array.isArray( response.data.preferences && response.data.preferences.expanded_parent_ids )
							? response.data.preferences.expanded_parent_ids.slice()
							: []
					} );
					render_window_store( anchor, feedback.complete );
					if ( feedback.persist_preferences ) {
						preference_anchor_date = String( response.data.window.start_date || response.data.window.anchor_date || preference_anchor_date );
						preference_anchor_ratio = 0;
						queue_timeline_preferences_save();
					}
					if ( ! feedback.suppress_complete_message ) {
						show_standard_admin_message( feedback.complete, 'success', 3000 );
					}
					completion.resolve( response.data );
					finish_request();
				} ).fail( function () {
					show_standard_admin_message( settings.i18n.error_message, 'error', 30000 );
					completion.reject( { message: settings.i18n.error_message } );
					finish_request();
				} );
				return;
			}
			reset_window_store( response.data );
			prime_surrounding_windows( anchor, feedback.complete, generation ).done( function () {
				if ( feedback.persist_preferences ) {
					preference_anchor_date = String( response.data.window.start_date || response.data.window.anchor_date || preference_anchor_date );
					preference_anchor_ratio = 0;
					queue_timeline_preferences_save();
				}
				if ( ! feedback.suppress_complete_message ) {
					show_standard_admin_message( feedback.complete, 'success', 3000 );
				}
				completion.resolve( response.data );
				finish_request();
			} ).fail( function () {
				completion.reject( { message: settings.i18n.error_message } );
			} );
		} ).fail( function ( request, request_status ) {
			var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};
			var suggested_days = error.details ? Number( error.details.suggested_window_days ) : 0;

			if ( ! window_cache_controller.is_foreground_generation_current( generation ) || 'abort' === request_status ) {
				completion.reject( { message: error.message || settings.i18n.error_message } );
				return;
			}
			if (
				may_reduce &&
				suggested_days &&
				( 0 < Number( request_values.window_months ) || suggested_days < Number( request_values.window_days ) )
			) {
				announce( settings.i18n.window_reduced );
				delete request_values.window_months;
				if ( anchor.target_date ) {
					delete request_values.anchor_at;
					request_values.anchor_date = anchor.target_date;
				} else {
					request_values.anchor_at = anchor.at;
				}
				request_values.anchor_ratio = anchor.ratio;
				request_values.window_days = suggested_days;
				request_window( request_values, anchor, false, {
					loading: settings.i18n.loading_reduced_window,
					complete: feedback.complete,
					persist_preferences: feedback.persist_preferences,
					suppress_complete_message: feedback.suppress_complete_message,
					preserve_selection: feedback.preserve_selection,
					completion: completion
				} );
				return;
			}
			show_standard_admin_message( error.message || settings.i18n.error_message, 'error', 30000 );
			render_window_error( error.message || settings.i18n.error_message );
			completion.reject( { message: error.message || settings.i18n.error_message } );
			finish_request();
		} );
		window_cache_controller.set_foreground_request( generation, request );

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
	function replace_resource_view( resource_view_context ) {
		var anchor = capture_axis_anchor();

		if ( ! resource_view_context ) {
			return null;
		}

		return request_window( add_current_window_span( {
			anchor_at: anchor.at,
			anchor_ratio: anchor.ratio,
			window_position: 0,
			view: settings.axis.view,
			resource_view_context: String( resource_view_context )
		}, true ), anchor, true, {
			loading: settings.i18n.reloading_timeline,
			complete: settings.i18n.status_ready,
			persist_preferences: false
		} );
	}

	/**
	 * Move keyboard focus between server-defined axis cells.
	 *
	 * @param {KeyboardEvent} event Key event from the axis.
	 * @return {void}
	 */
	function handle_axis_keydown( event ) {
		if ( booking_interactions_controller && booking_interactions_controller.handle_keydown( event ) ) {
			return;
		}
		if ( empty_range_selection_controller && empty_range_selection_controller.handle_keydown( event ) ) {
			return;
		}
		if ( toolbar_navigation_controller ) {
			toolbar_navigation_controller.handle_keydown( event );
		}
	}

	/**
	 * Handle Timeline shell actions through one delegated listener.
	 *
	 * @param {MouseEvent} event Browser click event.
	 * @return {void}
	 */
	function handle_click( event ) {
		var retry_button = event.target.closest( '[data-wpbc-timeline-retry]' );
		var edge_load_button = event.target.closest( '[data-wpbc-timeline-edge-load]' );
		var edge_cancel_button = event.target.closest( '[data-wpbc-timeline-edge-cancel]' );
		var row_toggle = event.target.closest( '[data-wpbc-timeline-row-toggle]' );
		var hierarchy_toggle = event.target.closest( '[data-wpbc-timeline-hierarchy-toggle]' );
		var anchor;
		var direction;

		if ( booking_interactions_controller && booking_interactions_controller.handle_click( event ) ) {
			return;
		}

		if ( empty_range_selection_controller && empty_range_selection_controller.handle_click( event ) ) {
			return;
		}

		if ( rendering_controller && rendering_controller.handle_row_presentation_click( event ) ) {
			return;
		}

		if ( edge_cancel_button ) {
			cancel_adjacent_window( edge_cancel_button.getAttribute( 'data-wpbc-timeline-edge-cancel' ) );
			return;
		}

		if ( edge_load_button ) {
			direction = edge_load_button.getAttribute( 'data-wpbc-timeline-edge-load' );
			if ( window_cache_controller && window_cache_controller.prepare_edge_retry( direction ) ) {
				activate_adjacent_navigation_intent( direction, true );
				request_adjacent_window( direction );
			}
			return;
		}

		if ( retry_button ) {
			anchor = capture_axis_anchor();
			request_window( add_current_window_span( {
				anchor_at: anchor.at,
				anchor_ratio: anchor.ratio,
				window_position: 0,
				view: settings.axis.view
			}, true ), anchor, true, {
				loading: settings.i18n.reloading_timeline,
				complete: settings.i18n.status_ready
			} );
			return;
		}

		if ( toolbar_navigation_controller && toolbar_navigation_controller.handle_click( event ) ) {
			return;
		}

		if ( hierarchy_toggle ) {
			set_hierarchy_expanded(
				Number( hierarchy_toggle.getAttribute( 'data-wpbc-timeline-hierarchy-toggle' ) ),
				'true' !== hierarchy_toggle.getAttribute( 'aria-expanded' ),
				hierarchy_toggle
			);
			return;
		}

		if ( row_toggle ) {
			set_row_expanded(
				row_toggle.getAttribute( 'data-wpbc-timeline-row-toggle' ),
				'true' !== row_toggle.getAttribute( 'aria-expanded' ),
				row_toggle
			);
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

		if ( ! mount || is_initialized || '1' === mount.getAttribute( 'data-wpbc-timeline-initialized' ) ) {
			return;
		}
		is_initialized = true;
		lifecycle_generation += 1;
		mount.setAttribute( 'data-wpbc-timeline-initialized', '1' );

		if ( ! render_template( mount, 'shell', settings ) ) {
			mount.textContent = settings.i18n ? settings.i18n.error_message : '';
			mount.setAttribute( 'aria-busy', 'false' );
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

		render_template( mount.querySelector( '[data-wpbc-timeline-toolbar]' ), 'toolbar', settings );
		if ( toolbar_navigation_controller ) {
			toolbar_navigation_controller.render_controls();
		}
		render_template( mount.querySelector( '[data-wpbc-timeline-axis-header]' ), 'axis_header', settings );
		render_template( mount.querySelector( '[data-wpbc-timeline-canvas-backdrop]' ), 'canvas_backdrop', settings );
		render_template( mount.querySelector( '[data-wpbc-timeline-legend]' ), 'legend', settings );
		if ( toolbar_navigation_controller ) {
			toolbar_navigation_controller.refresh_after_window_render();
		}
		initialize_axis_scroll_synchronization();

		state_host = mount.querySelector( '[data-wpbc-timeline-state]' );
		if ( settings.is_authorized && settings.initial && 'error' === settings.initial.load_state ) {
			settings.i18n.error_message = settings.initial.error && settings.initial.error.message ? settings.initial.error.message : settings.i18n.error_message;
			state_host.hidden = false;
			render_template( state_host, 'error', settings );
			announce( settings.i18n.error_message );
		} else if ( settings.is_authorized ) {
			initial_anchor = settings.axis.current_time_marker && settings.axis.current_time_marker.at
				? settings.axis.current_time_marker.at
				: settings.axis.anchor.at;
			reset_window_store( {
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
			} );
			if ( settings.initial_previous_window && settings.initial_previous_window.window && settings.initial_previous_window.axis ) {
				cache_adjacent_window( settings.initial_previous_window );
			}
			if ( settings.initial_next_window && settings.initial_next_window.window && settings.initial_next_window.axis ) {
				cache_adjacent_window( settings.initial_next_window );
			}
			trim_window_store();
			render_window_store(
				{
					at: initial_anchor,
					leading_cells_before: 1,
					restore_focus: false
				},
				settings.i18n.status_ready
			);
		} else {
			state_host.hidden = false;
			render_template( state_host, 'unauthorized', settings );
			announce( settings.i18n.status_unauthorized );
		}

		update_timeline_blocking_loading_state();
		mount.addEventListener( 'click', handle_click );
		mount.addEventListener( 'keydown', handle_axis_keydown );
		if ( booking_creation_host_enabled ) {
			mount.addEventListener( 'wpbc:booking-new-inspector:created', handle_booking_creation_created );
			mount.addEventListener( 'wpbc:booking-new-inspector:focus-created', handle_booking_creation_focus_created );
		}
		document.addEventListener( 'wpbc:availability-timeslots:changed', handle_availability_timeslots_changed );
		if ( settings.is_authorized && settings.initial && 'error' !== settings.initial.load_state ) {
			schedule_initial_canvas_ready();
		}
	}

	/**
	 * Remove the listeners owned by the Timeline mount.
	 *
	 * @return {void}
	 */
	function remove_mount_event_listeners() {
		if ( ! mount ) {
			return;
		}

		mount.removeEventListener( 'click', handle_click );
		mount.removeEventListener( 'keydown', handle_axis_keydown );
		if ( booking_creation_host_enabled ) {
			mount.removeEventListener( 'wpbc:booking-new-inspector:created', handle_booking_creation_created );
			mount.removeEventListener( 'wpbc:booking-new-inspector:focus-created', handle_booking_creation_focus_created );
		}
		document.removeEventListener( 'wpbc:availability-timeslots:changed', handle_availability_timeslots_changed );
	}

	/**
	 * Remove horizontal-axis and viewport listeners owned by this controller.
	 *
	 * @return {void}
	 */
	function destroy_axis_scroll_synchronization() {
		if ( axis_scroll_canvas ) {
			axis_scroll_canvas.removeEventListener( 'scroll', synchronize_axis_scroll );
			axis_scroll_canvas.removeEventListener( 'scroll', handle_window_store_scroll );
			axis_scroll_canvas.removeEventListener( 'scroll', schedule_edge_status_positioning );
			axis_scroll_canvas.removeEventListener( 'scroll', position_empty_range_selection_popover );
			axis_scroll_canvas.removeEventListener( 'wheel', contain_canvas_boundary_gesture );
			axis_scroll_canvas.removeEventListener( 'pointerdown', handle_canvas_navigation_pointer_down );
		}
		window.removeEventListener( 'resize', synchronize_axis_scroll );
		window.removeEventListener( 'resize', schedule_edge_status_positioning );
		window.removeEventListener( 'resize', position_empty_range_selection_popover );
		window.removeEventListener( 'scroll', schedule_edge_status_positioning );
		window.removeEventListener( 'scroll', position_empty_range_selection_popover );
		document.documentElement.classList.remove( 'wpbc_timeline_scroll_contained' );
		document.body.classList.remove( 'wpbc_timeline_scroll_contained' );
		axis_scroll_canvas = null;
	}

	/**
	 * Cancel Timeline-owned animation frames and short lifecycle timers.
	 *
	 * @return {void}
	 */
	function cancel_lifecycle_schedulers() {
		var animation_frames = [
			overflow_tooltip_frame,
			edge_status_frame,
			edge_scroll_frame,
			initial_canvas_ready_frame
		];
		animation_frames.forEach( function ( frame_id ) {
			if ( frame_id ) {
				window.cancelAnimationFrame( frame_id );
			}
		} );
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
		if ( ! is_initialized ) {
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
		if ( preferences_save_timer ) {
			window.clearTimeout( preferences_save_timer );
		}
		preferences_save_timer = 0;
		if ( preferences_save_request && 'function' === typeof preferences_save_request.abort ) {
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
		if ( edge_observer ) {
			edge_observer.disconnect();
		}
		edge_observer = null;
		foreground_request_focus = null;
		if ( mount ) {
			mount.classList.remove( 'is-request-loading' );
			mount.setAttribute( 'aria-busy', 'false' );
			mount.removeAttribute( 'data-wpbc-timeline-initialized' );
		}
		is_initialized = false;
	}

		return {
			initialize: initialize,
			replace_resource_view: replace_resource_view,
			destroy: destroy
		};
	}

	if (
		window.wpbc_timeline_modules
		&& 'function' === typeof window.wpbc_timeline_modules.register_factory
	) {
		window.wpbc_timeline_modules.register_factory( module_id, create_timeline_page_controller );
	}
}( window, document, window.wp ) );
