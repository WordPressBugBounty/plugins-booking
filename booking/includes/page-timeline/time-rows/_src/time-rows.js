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
( function ( window, wp ) {
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
	function create_time_rows_controller( context ) {
		var mount = context.mount || null;
		var configuration = context.configuration || {};
		var presentation_api = context.presentation_api || {};
		var maximum_cached_windows = Math.max( 1, Math.min( 3, Number( configuration.limits && configuration.limits.maximum_cached_windows ) || 3 ) );
		var presentation_id = String( configuration.presentation_id || '' );
		var accepted_booking_windows = [];
		var accepted_availability_windows = [];
		var booking_identities_by_key = Object.create( null );
		var open_resource_ids = Object.create( null );
		var range_policies_by_resource = Object.create( null );
		var zoom_percentages_by_resource = Object.create( null );
		var preference_loaded_by_resource = Object.create( null );
		var preference_reset_pending_by_resource = Object.create( null );
		var preference_save_states_by_resource = Object.create( null );
		var resource_window_indexes = Object.create( null );
		var projection_cache = Object.create( null );
		var projected_resources = Object.create( null );
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
		function clear_initial_open_animation( resource_id ) {
			get_current_hosts( resource_id ).forEach( function ( host ) {
				host.classList.remove( 'is-initial-auto-open' );
			} );
			if ( auto_open_animation_timer ) {
				window.clearTimeout( auto_open_animation_timer );
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
		function handle_initial_canvas_ready( event ) {
			var initial_open = configuration.initial_open || {};
			var resource_id;
			var hosts;

			if ( initial_open_completed || 1 !== Number( event && event.detail && event.detail.schema_version ) ) {
				return;
			}
			initial_open_completed = true;
			if ( true !== initial_open.first_resource || 'function' !== typeof presentation_api.open_first ) {
				return;
			}
			resource_id = Number( presentation_api.open_first( presentation_id ) );
			if ( ! Number.isInteger( resource_id ) || 1 > resource_id || true !== initial_open.animate ) {
				return;
			}
			hosts = get_current_hosts( resource_id );
			hosts.forEach( function ( host ) {
				host.classList.add( 'is-initial-auto-open' );
			} );
			auto_open_animation_timer = window.setTimeout( function () {
				clear_initial_open_animation( resource_id );
			}, 420 );
		}

		/**
		 * Return sorted unique positive Resource IDs.
		 *
		 * @param {Array<Object|number>} resources Resource DTOs or IDs.
		 * @return {Array<number>} Stable Resource IDs.
		 */
		function normalize_resource_ids( resources ) {
			var seen_ids = Object.create( null );

			return ( Array.isArray( resources ) ? resources : [] ).map( function ( resource ) {
				return Number( resource && 'object' === typeof resource ? resource.id : resource );
			} ).filter( function ( resource_id ) {
				if ( ! Number.isInteger( resource_id ) || 1 > resource_id || seen_ids[ resource_id ] ) {
					return false;
				}
				seen_ids[ resource_id ] = true;
				return true;
			} ).sort( function ( left_id, right_id ) {
				return left_id - right_id;
			} );
		}

		/**
		 * Return the configured wall-minute range increment.
		 *
		 * @return {number} Positive minute step bounded to one hour.
		 */
		function get_time_range_step_minutes() {
			return Math.max( 15, Math.min( 60, Number( configuration.limits && configuration.limits.time_range_step_minutes ) || 60 ) );
		}

		/**
		 * Normalize one wall-minute value to the configured local control step.
		 *
		 * @param {*} candidate Candidate wall minute.
		 * @param {number} fallback Value used when the candidate is not finite.
		 * @return {number} Bounded and stepped minute from local midnight.
		 */
		function normalize_wall_minute( candidate, fallback ) {
			var step_minutes = get_time_range_step_minutes();

			candidate = Number( candidate );
			if ( ! Number.isFinite( candidate ) ) {
				candidate = fallback;
			}
			return Math.max( 0, Math.min( 1440, Math.round( candidate / step_minutes ) * step_minutes ) );
		}

		/**
		 * Normalize one executable-free local visible-time policy.
		 *
		 * @param {Object} range_policy Auto, Full day, or explicit custom policy.
		 * @return {Object} Bounded policy accepted by the pure projector.
		 */
		function normalize_range_policy( range_policy ) {
			var mode = String( range_policy && range_policy.mode || 'auto' );
			var step_minutes = get_time_range_step_minutes();
			var start_minute;
			var end_minute;

			if ( 'full_day' === mode ) {
				return { mode: 'full_day' };
			}
			if ( 'custom' !== mode ) {
				return { mode: 'auto' };
			}
			start_minute = normalize_wall_minute( range_policy.start_minute, 0 );
			end_minute = normalize_wall_minute( range_policy.end_minute, 1440 );
			start_minute = Math.min( 1440 - step_minutes, start_minute );
			end_minute = Math.max( start_minute + step_minutes, end_minute );

			return {
				mode: 'custom',
				start_minute: start_minute,
				end_minute: Math.min( 1440, end_minute )
			};
		}

		/**
		 * Return valid server-defined visible-time preset DTOs.
		 *
		 * @return {Array<Object>} Ordered executable-free preset records.
		 */
		function get_time_range_presets() {
			var seen_ids = Object.create( null );

			return ( Array.isArray( configuration.range_presets ) ? configuration.range_presets : [] ).map( function ( preset ) {
				var preset_id = String( preset && preset.id || '' );
				var range_policy;

				if ( ! /^[a-z0-9_-]+$/.test( preset_id ) || seen_ids[ preset_id ] ) {
					return null;
				}
				range_policy = normalize_range_policy( {
					mode: 'custom',
					start_minute: preset.start_minute,
					end_minute: preset.end_minute
				} );
				if ( 'custom' !== range_policy.mode ) {
					return null;
				}
				seen_ids[ preset_id ] = true;
				return {
					id: preset_id,
					start_minute: range_policy.start_minute,
					end_minute: range_policy.end_minute,
					label: String( preset.label || '' ),
					aria_label: String( preset.aria_label || preset.label || '' )
				};
			} ).filter( Boolean );
		}

		/**
		 * Find the preset matching an explicit custom visible-time policy.
		 *
		 * @param {Object} range_policy Candidate normalized or raw policy.
		 * @return {Object|null} Matching preset or null.
		 */
		function get_matching_range_preset( range_policy ) {
			var normalized_policy = normalize_range_policy( range_policy );

			if ( 'custom' !== normalized_policy.mode ) {
				return null;
			}
			return get_time_range_presets().find( function ( preset ) {
				return preset.start_minute === normalized_policy.start_minute
					&& preset.end_minute === normalized_policy.end_minute;
			} ) || null;
		}

		/**
		 * Return one Resource's current local visible-time policy.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {Object} Normalized projector policy.
		 */
		function get_resource_range_policy( resource_id ) {
			return normalize_range_policy( range_policies_by_resource[ Number( resource_id ) ] || { mode: 'auto' } );
		}

		/**
		 * Return the configured vertical zoom bounds.
		 *
		 * @return {Object} Minimum, maximum, step, default, and height values.
		 */
		function get_zoom_configuration() {
			var limits = configuration.limits || {};
			var minimum = Math.max( 25, Number( limits.time_zoom_min_percent ) || 30 );
			var maximum = Math.max( minimum, Number( limits.time_zoom_max_percent ) || 300 );
			var step = Math.max( 5, Number( limits.time_zoom_step_percent ) || 10 );

			return {
				min_percent: minimum,
				max_percent: maximum,
				step_percent: step,
				default_percent: Math.max( minimum, Math.min( maximum, Number( limits.time_zoom_default_percent ) || 100 ) ),
				hour_height_px: Math.max( 24, Number( limits.time_hour_height_px ) || 52 ),
				minimum_body_height_px: Math.max( 160, Number( limits.time_body_min_height_px ) || 260 )
			};
		}

		/**
		 * Normalize a Resource-local vertical zoom percentage.
		 *
		 * @param {*} candidate Candidate percentage.
		 * @return {number} Bounded percentage aligned to the configured step.
		 */
		function normalize_zoom_percent( candidate ) {
			var zoom = get_zoom_configuration();
			var normalized = Number( candidate );

			if ( ! Number.isFinite( normalized ) ) {
				normalized = zoom.default_percent;
			}
			normalized = zoom.min_percent + Math.round( ( normalized - zoom.min_percent ) / zoom.step_percent ) * zoom.step_percent;

			return Math.max( zoom.min_percent, Math.min( zoom.max_percent, normalized ) );
		}

		/**
		 * Return one Resource's current local vertical zoom percentage.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {number} Normalized zoom percentage.
		 */
		function get_resource_zoom_percent( resource_id ) {
			return normalize_zoom_percent( zoom_percentages_by_resource[ Number( resource_id ) ] );
		}

		/**
		 * Return the accepted presentation settings embedded in one Resource DTO.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {Object|null} Accepted settings or null when unavailable.
		 */
		function get_accepted_resource_preferences( resource_id ) {
			var resource = get_source_resource( resource_id );
			var preferences = resource.row_presentation_preferences;

			if ( ! preferences || 'object' !== typeof preferences || ! preferences[ presentation_id ] ) {
				return null;
			}

			return preferences[ presentation_id ];
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
		function synchronize_resource_preferences( resource_id ) {
			var preferences = get_accepted_resource_preferences( resource_id );

			resource_id = Number( resource_id );
			if ( ! preferences || 1 !== Number( preferences.schema_version ) ) {
				return false;
			}
			if ( preference_reset_pending_by_resource[ resource_id ] && true === preferences.is_persisted ) {
				return false;
			}
			if ( preference_loaded_by_resource[ resource_id ] && ! preference_reset_pending_by_resource[ resource_id ] ) {
				return true;
			}

			range_policies_by_resource[ resource_id ] = normalize_range_policy( preferences.range_policy || { mode: 'auto' } );
			zoom_percentages_by_resource[ resource_id ] = normalize_zoom_percent( preferences.zoom_percent );
			preference_loaded_by_resource[ resource_id ] = true;
			delete preference_reset_pending_by_resource[ resource_id ];

			return true;
		}

		/**
		 * Initialize every Resource in the accepted bounded booking cache.
		 *
		 * @return {void}
		 */
		function synchronize_accepted_resource_preferences() {
			var resource_ids = [];

			accepted_booking_windows.forEach( function ( window_entry ) {
				var resources = window_entry && window_entry.payload && Array.isArray( window_entry.payload.resources )
					? window_entry.payload.resources
					: [];

				resource_ids = resource_ids.concat( normalize_resource_ids( resources ) );
			} );
			normalize_resource_ids( resource_ids ).forEach( synchronize_resource_preferences );
		}

		/**
		 * Announce a preference persistence result inside the domain-owned panel.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @param {string} message Localized status message, or empty to clear.
		 * @return {void}
		 */
		function announce_preference_status( resource_id, message ) {
			get_current_hosts( resource_id ).forEach( function ( host ) {
				var status = host && host.querySelector
					? host.querySelector( '[data-wpbc-timeline-time-rows-preference-status]' )
					: null;

				if ( status ) {
					status.textContent = String( message || '' );
				}
			} );
		}

		/**
		 * Return a Resource's mutable serialized save state.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {Object} Timer, request, and pending flags.
		 */
		function get_preference_save_state( resource_id ) {
			resource_id = Number( resource_id );
			if ( ! preference_save_states_by_resource[ resource_id ] ) {
				preference_save_states_by_resource[ resource_id ] = {
					timer: null,
					request: null,
					pending: false
				};
			}

			return preference_save_states_by_resource[ resource_id ];
		}

		/**
		 * Build the fixed scalar save payload for one Resource.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {Object} Executable-free preference values.
		 */
		function build_preference_save_payload( resource_id ) {
			var range_policy = get_resource_range_policy( resource_id );

			return {
				resource_id: Number( resource_id ),
				range_mode: range_policy.mode,
				start_minute: 'custom' === range_policy.mode ? range_policy.start_minute : 0,
				end_minute: 'custom' === range_policy.mode ? range_policy.end_minute : 1440,
				zoom_percent: get_resource_zoom_percent( resource_id )
			};
		}

		/**
		 * Flush one serialized preference save after an explicit control change.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {void}
		 */
		function flush_preference_save( resource_id ) {
			var transport = configuration.preferences || {};
			var state = get_preference_save_state( resource_id );
			var payload;

			resource_id = Number( resource_id );
			state.timer = null;
			if ( state.request || ! state.pending ) {
				return;
			}
			if ( ! window.jQuery || ! transport.url || ! transport.action || ! transport.nonce ) {
				state.pending = false;
				announce_preference_status( resource_id, configuration.i18n && configuration.i18n.preferences_save_failed );
				return;
			}

			state.pending = false;
			payload = Object.assign( {
				action: transport.action,
				nonce: transport.nonce
			}, build_preference_save_payload( resource_id ) );
			announce_preference_status( resource_id, '' );
			state.request = window.jQuery.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: payload
			} ).done( function ( response ) {
				var preferences = response && response.success && response.data
					? response.data.preferences
					: null;

				if ( state.pending || ! preferences || Number( response.data.resource_id ) !== resource_id ) {
					return;
				}
				range_policies_by_resource[ resource_id ] = normalize_range_policy( preferences.range_policy || { mode: 'auto' } );
				zoom_percentages_by_resource[ resource_id ] = normalize_zoom_percent( preferences.zoom_percent );
				preference_loaded_by_resource[ resource_id ] = true;
			} ).fail( function () {
				announce_preference_status( resource_id, configuration.i18n && configuration.i18n.preferences_save_failed );
			} ).always( function () {
				state.request = null;
				if ( state.pending && is_initialized ) {
					flush_preference_save( resource_id );
				}
			} );
		}

		/**
		 * Debounce one Resource-local preference save.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {void}
		 */
		function queue_preference_save( resource_id ) {
			var state = get_preference_save_state( resource_id );

			state.pending = true;
			if ( state.request || state.timer ) {
				return;
			}
			state.timer = window.setTimeout( function () {
				flush_preference_save( resource_id );
			}, 250 );
		}

		/**
		 * Cancel unsent state after a Resource is no longer authorized/present.
		 *
		 * @param {number} resource_id Removed Resource ID.
		 * @return {void}
		 */
		function remove_preference_save_state( resource_id ) {
			var state = preference_save_states_by_resource[ Number( resource_id ) ];

			if ( state && state.timer ) {
				window.clearTimeout( state.timer );
			}
			if ( state && state.request && 'function' === typeof state.request.abort ) {
				state.request.abort();
			}
			delete preference_save_states_by_resource[ Number( resource_id ) ];
		}

		/**
		 * Build an exact identity for one accepted native booking window.
		 *
		 * @param {Object} window_entry Native `{ key, payload }` cache entry.
		 * @return {Object|null} Exact identity or null when incomplete.
		 */
		function build_booking_identity( window_entry ) {
			var payload = window_entry && window_entry.payload ? window_entry.payload : {};
			var timeline_window = payload.window || {};
			var axis = payload.axis || {};
			var window_context = payload.window_context || {};
			var resource_ids = normalize_resource_ids( payload.resources );
			var window_key = String( window_entry && window_entry.key || window_context.window_key || '' );

			if (
				! window_key
				|| ! resource_ids.length
				|| ! window_context.resource_fingerprint
				|| ! timeline_window.start_at
				|| ! timeline_window.end_at
				|| ! timeline_window.view
				|| ! timeline_window.timezone
			) {
				return null;
			}

			return {
				window_key: window_key,
				resource_fingerprint: String( window_context.resource_fingerprint ),
				resource_ids: resource_ids,
				start_at: String( timeline_window.start_at ),
				end_at: String( timeline_window.end_at ),
				view: String( timeline_window.view ),
				cell_minutes: Number( timeline_window.cell_minutes || axis.cell_minutes || 0 ),
				timezone: String( timeline_window.timezone )
			};
		}

		/**
		 * Return the stable scalar signature for one booking identity.
		 *
		 * @param {Object} identity Exact booking-window identity.
		 * @return {string} Stable identity signature.
		 */
		function get_booking_identity_signature( identity ) {
			return [
				identity.window_key,
				identity.resource_fingerprint,
				identity.resource_ids.join( ',' ),
				identity.start_at,
				identity.end_at,
				identity.view,
				identity.cell_minutes,
				identity.timezone
			].join( '|' );
		}

		/**
		 * Clear every index and projected result after authoritative identity drift.
		 *
		 * @return {void}
		 */
		function invalidate_local_caches() {
			resource_window_indexes = Object.create( null );
			projection_cache = Object.create( null );
			projected_resources = Object.create( null );
		}

		/**
		 * Return accepted entries keyed by their native window identity.
		 *
		 * @param {Array<Object>} entries Accepted booking or Availability entries.
		 * @return {Object<string,Object>} Entry references keyed by window key.
		 */
		function index_entries_by_window_key( entries ) {
			var indexed_entries = Object.create( null );

			( Array.isArray( entries ) ? entries : [] ).forEach( function ( entry ) {
				var window_key = String( entry && ( entry.key || entry.window_key ) || '' );

				if ( window_key ) {
					indexed_entries[ window_key ] = entry;
				}
			} );

			return indexed_entries;
		}

		/**
		 * Evict local state owned by one native bounded window.
		 *
		 * @param {string} window_key Native booking-window key.
		 * @return {void}
		 */
		function evict_window_local_state( window_key ) {
			var cache_key_prefix = String( window_key || '' ) + '|';

			Object.keys( resource_window_indexes ).forEach( function ( cache_key ) {
				if ( 0 === cache_key.indexOf( cache_key_prefix ) ) {
					delete resource_window_indexes[ cache_key ];
				}
			} );
			delete projection_cache[ String( window_key || '' ) ];
		}

		/**
		 * Invalidate composed projections while retaining reusable window indexes.
		 *
		 * @return {void}
		 */
		function invalidate_composed_projections() {
			projected_resources = Object.create( null );
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
		function reconcile_authorized_open_resources( next_identities ) {
			var identity_keys = Object.keys( next_identities );
			var authorized_resource_ids = identity_keys.length ? next_identities[ identity_keys[ 0 ] ].resource_ids : [];
			var removed_resource_ids = [];

			Object.keys( open_resource_ids ).forEach( function ( resource_id ) {
				resource_id = Number( resource_id );
				if ( -1 !== authorized_resource_ids.indexOf( resource_id ) ) {
					return;
				}
				delete open_resource_ids[ resource_id ];
				remove_resource_local_state( resource_id );
				removed_resource_ids.push( resource_id );
			} );

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
		function accept_booking_windows( detail ) {
			var windows = detail && Array.isArray( detail.windows ) ? detail.windows : [];
			var generation = Number( detail && detail.generation );
			var next_identities = Object.create( null );
			var previous_entries_by_key = index_entries_by_window_key( accepted_booking_windows );
			var next_entries_by_key;
			var signatures = [];
			var next_signature;
			var changed_window_keys = [];
			var removed_window_keys = [];
			var retained_availability_windows;
			var removed_resource_ids;
			var current_window_found = false;
			var valid = 1 === Number( detail && detail.schema_version )
				&& Number.isInteger( generation )
				&& generation > booking_generation
				&& 0 < windows.length
				&& windows.length <= maximum_cached_windows;

			windows.forEach( function ( window_entry ) {
				var identity = build_booking_identity( window_entry );

				if (
					! identity
					|| identity.resource_fingerprint !== String( detail.resource_fingerprint || '' )
					|| identity.timezone !== String( detail.timezone || '' )
					|| next_identities[ identity.window_key ]
				) {
					valid = false;
					return;
				}
				next_identities[ identity.window_key ] = identity;
				signatures.push( get_booking_identity_signature( identity ) );
				if ( identity.window_key === String( detail.current_window_key || '' ) ) {
					current_window_found = true;
				}
			} );
			if ( ! valid || ! current_window_found ) {
				return false;
			}

			signatures.sort();
			next_signature = signatures.join( '||' );
			next_entries_by_key = index_entries_by_window_key( windows );
			Object.keys( next_entries_by_key ).forEach( function ( window_key ) {
				if (
					! previous_entries_by_key[ window_key ]
					|| previous_entries_by_key[ window_key ].payload !== next_entries_by_key[ window_key ].payload
					|| ! booking_identities_by_key[ window_key ]
					|| get_booking_identity_signature( booking_identities_by_key[ window_key ] ) !== get_booking_identity_signature( next_identities[ window_key ] )
				) {
					changed_window_keys.push( window_key );
				}
			} );
			Object.keys( previous_entries_by_key ).forEach( function ( window_key ) {
				if ( ! next_entries_by_key[ window_key ] ) {
					removed_window_keys.push( window_key );
				}
			} );
			changed_window_keys.concat( removed_window_keys ).forEach( evict_window_local_state );
			if ( changed_window_keys.length || removed_window_keys.length || booking_identity_signature !== next_signature ) {
				booking_projection_revision += 1;
				invalidate_composed_projections();
			}
			retained_availability_windows = accepted_availability_windows.filter( function ( availability_entry ) {
				var window_key = String( availability_entry && availability_entry.window_key || '' );
				var previous_identity = booking_identities_by_key[ window_key ];
				var next_identity = next_identities[ window_key ];

				return Boolean(
					next_entries_by_key[ window_key ]
					&& previous_identity
					&& next_identity
					&& get_booking_identity_signature( previous_identity ) === get_booking_identity_signature( next_identity )
				);
			} );
			if ( retained_availability_windows.length !== accepted_availability_windows.length ) {
				accepted_availability_windows = retained_availability_windows;
				availability_identity_signature = retained_availability_windows.map( function ( availability_entry ) {
					return String( availability_entry.cache_key || '' );
				} ).sort().join( '||' );
				availability_projection_revision += 1;
				availability_state = 'loading';
			}
			accepted_booking_windows = windows;
			booking_identities_by_key = next_identities;
			booking_identity_signature = next_signature;
			booking_generation = generation;
			removed_resource_ids = reconcile_authorized_open_resources( next_identities );
			last_booking_transition = {
				changed_window_keys: changed_window_keys.slice(),
				removed_window_keys: removed_window_keys.slice(),
				removed_resource_ids: removed_resource_ids,
				has_projection_change: Boolean( changed_window_keys.length || removed_window_keys.length )
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
		function availability_entry_matches_booking( availability_entry ) {
			var identity = booking_identities_by_key[ String( availability_entry && availability_entry.window_key || '' ) ];
			var payload = availability_entry && availability_entry.payload ? availability_entry.payload : {};
			var response_window = payload.window || {};
			var resource_ids = normalize_resource_ids( payload.resource_ids );

			return Boolean(
				identity
				&& identity.resource_ids.join( ',' ) === resource_ids.join( ',' )
				&& identity.start_at === String( response_window.start_at || '' )
				&& identity.end_at === String( response_window.end_at || '' )
				&& identity.view === String( response_window.view || '' )
				&& identity.cell_minutes === Number( response_window.cell_minutes || 0 )
				&& identity.timezone === String( response_window.timezone || '' )
			);
		}

		/**
		 * Accept Availability DTO references matching the current booking identities.
		 *
		 * @param {Object} detail Accepted Availability event detail.
		 * @return {boolean} True when the notification was current and valid.
		 */
		function accept_availability( detail ) {
			var generation = Number( detail && detail.generation );
			var cached_windows = detail && Array.isArray( detail.cached_windows ) ? detail.cached_windows : [];
			var previous_entries_by_key = index_entries_by_window_key( accepted_availability_windows );
			var next_entries_by_key;
			var accepted_windows = [];
			var signatures = [];
			var changed_window_keys = [];
			var next_availability_state;
			var next_signature;
			var has_projection_change;
			var affected_resource_ids = Object.create( null );
			var identities_match = true;

			if (
				1 !== Number( detail && detail.schema_version )
				|| ! Number.isInteger( generation )
				|| generation <= availability_generation
				|| cached_windows.length > maximum_cached_windows
			) {
				return false;
			}
			if ( 'loaded' === detail.state && detail.payload ) {
				if ( ! availability_entry_matches_booking( {
					window_key: detail.window_key,
					payload: detail.payload
				} ) ) {
					return false;
				}
			}

			cached_windows.forEach( function ( availability_entry ) {
				if ( ! availability_entry_matches_booking( availability_entry ) ) {
					identities_match = false;
					return;
				}
				accepted_windows.push( availability_entry );
				signatures.push( String( availability_entry.cache_key || '' ) );
			} );
			if ( ! identities_match ) {
				return false;
			}
			signatures.sort();
			next_signature = signatures.join( '||' );
			next_entries_by_key = index_entries_by_window_key( accepted_windows );
			Object.keys( previous_entries_by_key ).concat( Object.keys( next_entries_by_key ) ).filter( function ( window_key, window_index, all_keys ) {
				return all_keys.indexOf( window_key ) === window_index;
			} ).forEach( function ( window_key ) {
				var previous_entry = previous_entries_by_key[ window_key ];
				var next_entry = next_entries_by_key[ window_key ];

				if (
					! previous_entry
					|| ! next_entry
					|| String( previous_entry.cache_key || '' ) !== String( next_entry.cache_key || '' )
					|| previous_entry.payload !== next_entry.payload
				) {
					changed_window_keys.push( window_key );
					normalize_resource_ids( previous_entry && previous_entry.payload && previous_entry.payload.resource_ids ).concat(
						normalize_resource_ids( next_entry && next_entry.payload && next_entry.payload.resource_ids )
					).forEach( function ( resource_id ) {
						affected_resource_ids[ resource_id ] = true;
					} );
				}
			} );
			next_availability_state = 'invalidated' === String( detail.state || '' )
				? 'loading'
				: ( 'neutral' === String( detail.state || '' ) ? 'failed' : 'loaded' );
			if ( 'loaded' === next_availability_state ) {
				if ( accepted_windows.some( function ( availability_entry ) {
					return 'partial' === String( availability_entry && availability_entry.payload && availability_entry.payload.load_state || '' );
				} ) ) {
					next_availability_state = 'partial';
				} else if ( accepted_windows.length < accepted_booking_windows.length ) {
					next_availability_state = 'loading';
				}
			}
			changed_window_keys.forEach( evict_window_local_state );
			has_projection_change = Boolean(
				changed_window_keys.length
				|| availability_identity_signature !== next_signature
				|| availability_state !== next_availability_state
			);
			if ( availability_state !== next_availability_state ) {
				Object.keys( booking_identities_by_key ).forEach( function ( window_key ) {
					booking_identities_by_key[ window_key ].resource_ids.forEach( function ( resource_id ) {
						affected_resource_ids[ resource_id ] = true;
					} );
				} );
			}
			if ( has_projection_change ) {
				availability_projection_revision += 1;
				invalidate_composed_projections();
			}
			accepted_availability_windows = accepted_windows;
			availability_identity_signature = next_signature;
			availability_generation = generation;
			availability_state = next_availability_state;
			last_availability_transition = {
				changed_window_keys: changed_window_keys.slice(),
				affected_resource_ids: Object.keys( affected_resource_ids ).map( Number ),
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
		function get_booking_window_entry( window_key ) {
			return accepted_booking_windows.filter( function ( window_entry ) {
				return String( window_entry && window_entry.key || '' ) === String( window_key || '' );
			} )[ 0 ] || null;
		}

		/**
		 * Return matching accepted Availability data for one native window.
		 *
		 * @param {string} window_key Accepted native window key.
		 * @return {Object|null} Original accepted cache entry reference or null.
		 */
		function get_availability_window_entry( window_key ) {
			return accepted_availability_windows.filter( function ( availability_entry ) {
				return String( availability_entry && availability_entry.window_key || '' ) === String( window_key || '' );
			} )[ 0 ] || null;
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
		function get_resource_window_index( resource_id, window_key ) {
			var cache_key;
			var window_entry;
			var availability_entry;
			var availability_payload;
			var payload;
			var resource;

			resource_id = Number( resource_id );
			window_key = String( window_key || '' );
			if ( ! open_resource_ids[ resource_id ] || ! booking_identities_by_key[ window_key ] ) {
				return null;
			}
			cache_key = window_key + '|' + resource_id;
			if ( resource_window_indexes[ cache_key ] ) {
				return resource_window_indexes[ cache_key ];
			}
			window_entry = get_booking_window_entry( window_key );
			payload = window_entry ? window_entry.payload : null;
			resource = payload && Array.isArray( payload.resources ) ? payload.resources.filter( function ( resource_dto ) {
				return Number( resource_dto && resource_dto.id ) === resource_id;
			} )[ 0 ] : null;
			if ( ! payload || ! resource ) {
				return null;
			}
			availability_entry = get_availability_window_entry( window_key );
			availability_payload = availability_entry && availability_entry.payload ? availability_entry.payload : null;
			resource_window_indexes[ cache_key ] = {
				resource: resource,
				window: payload.window,
				axis: payload.axis,
				segments: ( payload.segments || [] ).filter( function ( segment ) {
					return Number( segment && segment.resource_id ) === resource_id;
				} ),
				occupancy: ( payload.occupancy || [] ).filter( function ( interval ) {
					return Number( interval && interval.resource_id ) === resource_id;
				} ),
				availability: availability_entry,
				availability_payload: availability_payload ? Object.assign( {}, availability_payload, {
					resource_ids: [ resource_id ],
					intervals: ( availability_payload.intervals || [] ).filter( function ( interval ) {
						return Number( interval && interval.resource_id ) === resource_id;
					} ),
					coverage: ( availability_payload.coverage || [] ).filter( function ( coverage ) {
						return Number( coverage && coverage.resource_id ) === resource_id;
					} ),
					unknown: ( availability_payload.unknown || [] ).filter( function ( unknown ) {
						return Number( unknown && unknown.resource_id ) === resource_id;
					} )
				} ) : null
			};

			return resource_window_indexes[ cache_key ];
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
		function get_resource_projection_booking_windows( resource_id ) {
			return accepted_booking_windows.map( function ( window_entry ) {
				var window_key = String( window_entry && window_entry.key || '' );
				var resource_index = get_resource_window_index( resource_id, window_key );

				if ( ! resource_index ) {
					return null;
				}
				return {
					key: window_key,
					payload: {
						window: resource_index.window,
						axis: resource_index.axis,
						resources: [ resource_index.resource ],
						segments: resource_index.segments,
						occupancy: resource_index.occupancy
					}
				};
			} ).filter( Boolean );
		}

		/**
		 * Build lightweight Resource-owned views over accepted Availability windows.
		 *
		 * @param {number} resource_id Authorized open Resource ID.
		 * @return {Array<Object>} Projector Availability-window inputs.
		 */
		function get_resource_projection_availability_windows( resource_id ) {
			return accepted_booking_windows.map( function ( booking_window_entry ) {
				var window_key = String( booking_window_entry && booking_window_entry.key || '' );
				var resource_index = get_resource_window_index( resource_id, window_key );

				if ( ! resource_index || ! resource_index.availability || ! resource_index.availability_payload ) {
					return null;
				}
				return {
					cache_key: String( resource_index.availability.cache_key || '' ),
					window_key: window_key,
					payload: resource_index.availability_payload
				};
			} ).filter( Boolean );
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
		function cache_projection( resource_id, window_key, projection ) {
			resource_id = Number( resource_id );
			window_key = String( window_key || '' );
			if ( ! open_resource_ids[ resource_id ] || ! booking_identities_by_key[ window_key ] ) {
				return false;
			}
			if ( ! projection_cache[ window_key ] ) {
				projection_cache[ window_key ] = Object.create( null );
			}
			projection_cache[ window_key ][ resource_id ] = projection;
			Object.keys( projection_cache ).forEach( function ( cached_window_key ) {
				if ( ! booking_identities_by_key[ cached_window_key ] ) {
					delete projection_cache[ cached_window_key ];
				}
			} );

			return Object.keys( projection_cache ).length <= maximum_cached_windows;
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
		function project_resource( resource_id, range_policy ) {
			var projector = window.wpbc_timeline_time_rows_projector;
			var identity;
			var projector_input;
			var cache_key;
			var projection;

			resource_id = Number( resource_id );
			if (
				! open_resource_ids[ resource_id ]
				|| ! projector
				|| 'function' !== typeof projector.project
				|| 'function' !== typeof projector.get_projection_cache_key
			) {
				return null;
			}
			identity = booking_identities_by_key[ Object.keys( booking_identities_by_key )[ 0 ] ];
			if ( ! identity || -1 === identity.resource_ids.indexOf( resource_id ) ) {
				return null;
			}
			projector_input = {
				resource_id: resource_id,
				resource_fingerprint: identity.resource_fingerprint,
				timezone: identity.timezone,
				booking_generation: booking_projection_revision,
				availability_generation: availability_projection_revision,
				availability_state: availability_state,
				booking_windows: get_resource_projection_booking_windows( resource_id ),
				availability_windows: get_resource_projection_availability_windows( resource_id ),
				range_policy: Object.assign( {
					mode: 'auto',
					safe_start_minute: Number( configuration.limits && configuration.limits.auto_safe_start_minute ) || 480,
					safe_end_minute: Number( configuration.limits && configuration.limits.auto_safe_end_minute ) || 1080
				}, range_policy || {} ),
				visible_lane_limit: Number( configuration.limits && configuration.limits.maximum_visible_lanes ) || 3
			};
			cache_key = projector.get_projection_cache_key( projector_input );
			if ( projected_resources[ resource_id ] && projected_resources[ resource_id ].cache_key === cache_key ) {
				return projected_resources[ resource_id ].projection;
			}
			projection = projector.project( projector_input );
			projected_resources[ resource_id ] = {
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
		function format_wall_minute( wall_minute ) {
			var bounded_minute = Math.max( 0, Math.min( 1440, Math.round( Number( wall_minute ) || 0 ) ) );
			var hours = Math.floor( bounded_minute / 60 );
			var minutes = bounded_minute % 60;

			return String( hours ).padStart( 2, '0' ) + ':' + String( minutes ).padStart( 2, '0' );
		}

		/**
		 * Format one exact UTC offset without consulting the browser timezone.
		 *
		 * @param {number} offset_minutes Signed offset minutes from UTC.
		 * @return {string} Signed HH:MM offset.
		 */
		function format_utc_offset( offset_minutes ) {
			var normalized_minutes = Math.round( Number( offset_minutes ) || 0 );
			var sign = 0 > normalized_minutes ? '-' : '+';
			var absolute_minutes = Math.abs( normalized_minutes );

			return sign + String( Math.floor( absolute_minutes / 60 ) ).padStart( 2, '0' ) + ':' + String( absolute_minutes % 60 ).padStart( 2, '0' );
		}

		/**
		 * Interpolate a localized label containing named placeholders.
		 *
		 * @param {string} pattern Localized pattern.
		 * @param {Object} values Plain scalar replacements.
		 * @return {string} Interpolated label.
		 */
		function interpolate_label( pattern, values ) {
			Object.keys( values || {} ).forEach( function ( key ) {
				pattern = String( pattern || '' ).replace( new RegExp( '\\{' + key + '\\}', 'g' ), String( values[ key ] ) );
			} );

			return String( pattern || '' );
		}

		/**
		 * Return the localized, non-color booking status label.
		 *
		 * @param {string} status Accepted booking status.
		 * @return {string} Localized status label.
		 */
		function get_booking_status_label( status ) {
			var i18n = configuration.i18n || {};

			if ( 'approved' === status ) {
				return String( i18n.status_approved || 'Approved' );
			}
			if ( 'pending' === status ) {
				return String( i18n.status_pending || 'Pending' );
			}
			return String( i18n.status_unknown || 'Booking status unavailable' );
		}

		/**
		 * Return an exact visible timed label, including offsets on DST dates.
		 *
		 * @param {Object} fragment Projected timed fragment.
		 * @param {Object} date Presentation date record.
		 * @return {string} Wall-clock range with an offset qualifier when required.
		 */
		function get_timed_schedule_label( fragment, date ) {
			var separator = '\u2013';
			var schedule_label = format_wall_minute( fragment.wall_start_minute ) + separator + format_wall_minute( fragment.wall_end_minute );
			var start_offset;
			var end_offset;

			if ( ! date || ! Array.isArray( date.dst_slices ) || ! date.dst_slices.length ) {
				return schedule_label;
			}
			start_offset = format_utc_offset( fragment.start_offset_minutes );
			end_offset = format_utc_offset( fragment.end_offset_minutes );
			return schedule_label + ' (UTC' + start_offset + ( start_offset === end_offset ? '' : separator + 'UTC' + end_offset ) + ')';
		}

		/**
		 * Return the first accepted date-band presentation record for one date.
		 *
		 * @param {string} date Site-local ISO date.
		 * @return {Object} Accepted server date-band metadata or an empty object.
		 */
		function get_source_date_band( date ) {
			var source_date_band = null;

			accepted_booking_windows.some( function ( window_entry ) {
				var axis = window_entry && window_entry.payload ? window_entry.payload.axis || {} : {};

				return ( Array.isArray( axis.date_bands ) ? axis.date_bands : [] ).some( function ( date_band ) {
					if ( String( date_band && date_band.date || '' ) !== String( date || '' ) ) {
						return false;
					}
					source_date_band = date_band;
					return true;
				} );
			} );

			return source_date_band || {};
		}

		/**
		 * Return the accepted authorized Resource summary for one identity.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {Object} Original accepted Resource DTO or an empty object.
		 */
		function get_source_resource( resource_id ) {
			var source_resource = null;

			accepted_booking_windows.some( function ( window_entry ) {
				var resources = window_entry && window_entry.payload && Array.isArray( window_entry.payload.resources )
					? window_entry.payload.resources
					: [];

				return resources.some( function ( resource ) {
					if ( Number( resource && resource.id ) !== Number( resource_id ) ) {
						return false;
					}
					source_resource = resource;
					return true;
				} );
			} );

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
		function get_source_segment_identity( source_segment_id, booking_id ) {
			return String( source_segment_id || '' ) + '|' + Number( booking_id || 0 );
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
		function build_source_segment_index( resource_id ) {
			var source_segments_by_identity = Object.create( null );

			accepted_booking_windows.forEach( function ( window_entry ) {
				var segments = window_entry && window_entry.payload && Array.isArray( window_entry.payload.segments )
					? window_entry.payload.segments
					: [];

				segments.forEach( function ( segment ) {
					var identity;

					if ( Number( segment && segment.resource_id ) !== Number( resource_id ) ) {
						return;
					}
					identity = get_source_segment_identity( segment && segment.segment_id, segment && segment.booking_id );
					if ( ! source_segments_by_identity[ identity ] ) {
						source_segments_by_identity[ identity ] = segment;
					}
				} );
			} );

			return source_segments_by_identity;
		}

		/**
		 * Return a fixed allow-listed WordPress template renderer.
		 *
		 * @param {string} template_slot Code-owned configuration slot.
		 * @return {Function|null} WordPress template function or null.
		 */
		function get_template( template_slot ) {
			var template_id = configuration.templates && configuration.templates[ template_slot ];

			return template_id && wp && 'function' === typeof wp.template ? wp.template( template_id ) : null;
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
		function build_time_ticks( range ) {
			var ticks = [];
			var tick_step_minutes = 15;
			var tick_minute = Math.ceil( range.start_minute / tick_step_minutes ) * tick_step_minutes;
			var is_hour;
			var is_half_hour;

			for ( ; tick_minute <= range.end_minute; tick_minute += tick_step_minutes ) {
				is_hour = 0 === tick_minute % 60;
				is_half_hour = 30 === tick_minute % 60;
				ticks.push( {
					minute: tick_minute,
					label: is_hour ? format_wall_minute( tick_minute ) : '',
					is_hour: is_hour,
					is_half_hour: is_half_hour,
					is_minor: ! is_hour && ! is_half_hour,
					is_boundary: tick_minute === range.start_minute || tick_minute === range.end_minute,
					offset_percent: Number( ( 100 * ( tick_minute - range.start_minute ) / range.span_minutes ).toFixed( 8 ) )
				} );
			}
			if ( ! ticks.length || ticks[ ticks.length - 1 ].minute !== range.end_minute ) {
				ticks.push( {
					minute: range.end_minute,
					label: format_wall_minute( range.end_minute ),
					is_hour: false,
					is_half_hour: false,
					is_minor: false,
					is_boundary: true,
					offset_percent: 100
				} );
			}

			return ticks;
		}

		/**
		 * Map an accepted Availability source to a code-owned CSS class.
		 *
		 * @param {string} source_id Accepted source identifier.
		 * @return {string} Fixed scoped modifier class.
		 */
		function get_availability_css_class( source_id ) {
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

			return classes[ String( source_id || '' ) ] || 'is-unknown';
		}

		/**
		 * Return the localized label for one summary record kind.
		 *
		 * @param {string} kind Projection summary kind.
		 * @return {string} Localized kind label.
		 */
		function get_summary_kind_label( kind ) {
			var i18n = configuration.i18n || {};
			var labels = {
				full_day_booking: i18n.full_day_booking,
				timed_booking: i18n.timed_booking,
				dst_transition: i18n.dst_transition,
				availability: i18n.availability_record,
				availability_clipped: i18n.availability_record,
				availability_state: i18n.availability_state_record
			};

			return String( labels[ kind ] || i18n.label || '' );
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
		function build_presentation_model( projection, zoom_percent ) {
			var i18n = configuration.i18n || {};
			var zoom = get_zoom_configuration();
			var range_step_minutes = get_time_range_step_minutes();
			var matching_range_preset = get_matching_range_preset( projection.range );
			var date_by_key = Object.create( null );
			var source_segments_by_identity = build_source_segment_index( projection.resource_id );
			var registrations = [];
			var dates = projection.dates.map( function ( date ) {
				var source_date = get_source_date_band( date.date );
				var projected_date = Object.assign( {}, date, {
					label: String( source_date.label || date.date ),
					weekday: String( source_date.weekday || date.date ),
					day_number: String( source_date.day_number || '' ),
					is_today: true === source_date.is_today,
					is_weekend: true === source_date.is_weekend,
					dst_slices: date.dst_slices.map( function ( transition ) {
						var visible_start = Math.max( projection.range.start_minute, transition.start_minute );
						var visible_end = Math.min( projection.range.end_minute, transition.end_minute );
						var kind_label = 'gap' === transition.kind ? i18n.dst_gap : i18n.dst_fold;
						var offset_before = format_utc_offset( Number( transition.offset_before_seconds || 0 ) / 60 );
						var offset_after = format_utc_offset( Number( transition.offset_after_seconds || 0 ) / 60 );

						return Object.assign( {}, transition, {
							top_percent: Number( ( 100 * ( visible_start - projection.range.start_minute ) / projection.range.span_minutes ).toFixed( 8 ) ),
							height_percent: Number( ( 100 * Math.max( 0, visible_end - visible_start ) / projection.range.span_minutes ).toFixed( 8 ) ),
							kind_label: String( kind_label || transition.kind ),
							offset_before: offset_before,
							offset_after: offset_after,
							label: interpolate_label( i18n.dst_transition_label, {
								kind: kind_label || transition.kind,
								before: offset_before,
								after: offset_after
							} )
						} );
					} ).filter( function ( transition ) {
						return 0 < transition.height_percent;
					} )
				} );

				date_by_key[ projected_date.date ] = projected_date;
				return projected_date;
			} );
			var register_fragment = function ( fragment, view_fragment, interaction_axis ) {
				var source_segment = source_segments_by_identity[ get_source_segment_identity( fragment.source_segment_id, fragment.booking_id ) ] || null;

				if ( source_segment ) {
					registrations.push( {
						render_segment_id: view_fragment.render_segment_id,
						segment: source_segment,
						is_overflowed: true === view_fragment.is_overflowed,
						interaction_axis: 'vertical' === interaction_axis ? 'vertical' : 'horizontal',
						boundary_visibility: {
							start: ! view_fragment.shows_earlier_indicator,
							end: ! view_fragment.shows_later_indicator
						}
					} );
				}
			};
			var full_day_fragment_views = projection.full_day_fragments.map( function ( fragment ) {
				var date = date_by_key[ fragment.date ];

				return Object.assign( {}, fragment, {
					date_index: date ? Number( date.index ) : 0,
					left_percent: date ? date.offset_percent : 0,
					width_percent: date ? date.width_percent : 0,
					stack_top_px: 6 + 34 * Number( fragment.stack_index || 0 ),
					status_label: get_booking_status_label( fragment.status ),
					selection_aria_label: fragment.selection_aria_label || interpolate_label( i18n.select_booking, { label: fragment.label } ),
					information_aria_label: fragment.information_aria_label || interpolate_label( i18n.booking_information, { label: fragment.label } ),
					details_aria_label: interpolate_label( i18n.booking_details, { label: fragment.label } )
				} );
			} );
			var full_day_groups = Object.create( null );
			var full_day_fragments = [];

			full_day_fragment_views.forEach( function ( fragment ) {
				var group_key = [ fragment.source_segment_id, fragment.booking_id, fragment.resource_id, fragment.stack_index ].join( '|' );

				if ( ! full_day_groups[ group_key ] ) {
					full_day_groups[ group_key ] = [];
				}
				full_day_groups[ group_key ].push( fragment );
			} );
			/**
			 * Append one contiguous full-day band without bridging an unloaded date.
			 *
			 * @param {string}        group_key Stable booking and stack identity.
			 * @param {Array<Object>} fragments Consecutive projected date fragments.
			 * @param {number}        band_index Zero-based band number within the group.
			 * @return {void}
			 */
			function append_full_day_band( group_key, fragments, band_index ) {
				var first_fragment = fragments[ 0 ];
				var last_fragment = fragments[ fragments.length - 1 ];
				var first_date = date_by_key[ first_fragment.date ];
				var last_date = date_by_key[ last_fragment.date ];
				var shows_earlier_indicator = Boolean( first_fragment.continues_before_date || first_fragment.continues_before_loaded_window );
				var shows_later_indicator = Boolean( last_fragment.continues_after_date || last_fragment.continues_after_loaded_window );
				var schedule_label = first_fragment.date === last_fragment.date ? first_fragment.date : first_fragment.date + '\u2013' + last_fragment.date;
				var view_fragment = Object.assign( {}, first_fragment, {
					fragment_ids: fragments.map( function ( fragment ) { return fragment.fragment_id; } ),
					date_end: last_fragment.date,
					render_segment_id: 'time-rows|full-day|' + group_key + '|' + band_index + '|' + first_fragment.date + '|' + last_fragment.date,
					left_percent: first_date ? first_date.offset_percent : 0,
					width_percent: first_date && last_date ? last_date.offset_percent + last_date.width_percent - first_date.offset_percent : 0,
					schedule_label: schedule_label,
					shows_earlier_indicator: shows_earlier_indicator,
					shows_later_indicator: shows_later_indicator,
					aria_label: [ first_fragment.label, schedule_label, first_fragment.status_label, shows_earlier_indicator ? i18n.continued_before : '', shows_later_indicator ? i18n.continued_after : '' ].filter( Boolean ).join( ', ' )
				} );

				register_fragment( first_fragment, view_fragment, 'horizontal' );
				full_day_fragments.push( view_fragment );
			}

			Object.keys( full_day_groups ).sort().forEach( function ( group_key ) {
				var fragments = full_day_groups[ group_key ].sort( function ( left, right ) {
					return left.date_index - right.date_index || left.start_epoch - right.start_epoch;
				} );
				var contiguous_fragments = [];
				var band_index = 0;

				fragments.forEach( function ( fragment ) {
					var previous_fragment = contiguous_fragments[ contiguous_fragments.length - 1 ];

					if ( previous_fragment && fragment.date_index !== previous_fragment.date_index + 1 ) {
						append_full_day_band( group_key, contiguous_fragments, band_index );
						contiguous_fragments = [];
						band_index += 1;
					}
					contiguous_fragments.push( fragment );
				} );
				if ( contiguous_fragments.length ) {
					append_full_day_band( group_key, contiguous_fragments, band_index );
				}
			} );
			var timed_fragments = projection.timed_fragments.map( function ( fragment ) {
				var date = date_by_key[ fragment.date ];
				var lane_count = Math.max( 1, Number( fragment.lane_count || 1 ) );
				var schedule_label = get_timed_schedule_label( fragment, date );
				var status_label = get_booking_status_label( fragment.status );
				var shows_earlier_indicator = Boolean( fragment.is_clipped_above || fragment.continues_before_date || fragment.continues_before_fragment || fragment.continues_before_loaded_window );
				var shows_later_indicator = Boolean( fragment.is_clipped_below || fragment.continues_after_date || fragment.continues_after_fragment || fragment.continues_after_loaded_window );
				var view_fragment = Object.assign( {}, fragment, {
					render_segment_id: 'time-rows|' + fragment.fragment_id,
					left_percent: date ? date.offset_percent + date.width_percent * Number( fragment.lane_index || 0 ) / lane_count : 0,
					width_percent: date ? date.width_percent / lane_count : 0,
					schedule_label: schedule_label,
					status_label: status_label,
					shows_earlier_indicator: shows_earlier_indicator,
					shows_later_indicator: shows_later_indicator,
					aria_label: [ fragment.label, schedule_label, status_label, shows_earlier_indicator ? i18n.continued_before : '', shows_later_indicator ? i18n.continued_after : '' ].filter( Boolean ).join( ', ' ),
					selection_aria_label: fragment.selection_aria_label || interpolate_label( i18n.select_booking, { label: fragment.label } ),
					information_aria_label: fragment.information_aria_label || interpolate_label( i18n.booking_information, { label: fragment.label } ),
					details_aria_label: interpolate_label( i18n.booking_details, { label: fragment.label } )
				} );

				register_fragment( fragment, view_fragment, 'vertical' );
				return view_fragment;
			} );
			var timed_fragment_by_id = Object.create( null );
			timed_fragments.forEach( function ( fragment ) {
				timed_fragment_by_id[ fragment.fragment_id ] = fragment;
			} );
			var all_day_stack_count = full_day_fragment_views.reduce( function ( stack_count, fragment ) {
				return Math.max( stack_count, Number( fragment.stack_count || 1 ) );
			}, 1 );
			var summary_fragment_by_id = Object.create( null );
			var summary_records;

			full_day_fragment_views.concat( timed_fragments ).forEach( function ( fragment ) {
				summary_fragment_by_id[ fragment.fragment_id ] = fragment;
			} );
			summary_records = projection.summary.map( function ( record ) {
				var source_fragment = summary_fragment_by_id[ record.fragment_id ];
				var date = date_by_key[ record.date ];
				var continuation_labels = [];
				var time_label = record.date && 'full_day_booking' !== record.kind
					? format_wall_minute( record.start_minute ) + '\u2013' + format_wall_minute( record.end_minute )
					: '';

				if ( source_fragment && 'timed_booking' === record.kind ) {
					time_label = get_timed_schedule_label( source_fragment, date );
				}
				if ( source_fragment && (
					source_fragment.is_clipped_above
					|| source_fragment.continues_before_date
					|| source_fragment.continues_before_fragment
					|| source_fragment.continues_before_loaded_window
				) ) {
					continuation_labels.push( i18n.continued_before );
				}
				if ( source_fragment && (
					source_fragment.is_clipped_below
					|| source_fragment.continues_after_date
					|| source_fragment.continues_after_fragment
					|| source_fragment.continues_after_loaded_window
				) ) {
					continuation_labels.push( i18n.continued_after );
				}
				return Object.assign( {}, record, {
					kind_label: get_summary_kind_label( record.kind ),
					time_label: time_label,
					status_label: source_fragment ? get_booking_status_label( source_fragment.status ) : '',
					continuation_label: continuation_labels.filter( Boolean ).join( ', ' )
				} );
			} );
			dates.forEach( function ( date ) {
				date.dst_slices.forEach( function ( transition ) {
					summary_records.push( {
						summary_id: 'summary|dst|' + date.date + '|' + transition.transition_id,
						kind: 'dst_transition',
						kind_label: get_summary_kind_label( 'dst_transition' ),
						date: date.date,
						start_minute: transition.start_minute,
						end_minute: transition.end_minute,
						time_label: format_wall_minute( transition.start_minute ) + '\u2013' + format_wall_minute( transition.end_minute ),
						label: transition.label,
						status_label: '',
						continuation_label: ''
					} );
				} );
			} );
			summary_records.sort( function ( left, right ) {
				if ( ! left.date && ! right.date ) {
					return String( left.summary_id || '' ).localeCompare( String( right.summary_id || '' ) );
				}
				if ( ! left.date ) {
					return 1;
				}
				if ( ! right.date ) {
					return -1;
				}
				return left.date.localeCompare( right.date )
					|| Number( left.start_minute || 0 ) - Number( right.start_minute || 0 )
					|| Number( left.end_minute || 0 ) - Number( right.end_minute || 0 )
					|| String( left.summary_id || '' ).localeCompare( String( right.summary_id || '' ) );
			} );

			zoom_percent = normalize_zoom_percent( zoom_percent );

			return {
				schema_version: Number( configuration.schema_version ) || 1,
				cache_key: projection.cache_key,
				resource_id: projection.resource_id,
				timezone: projection.timezone,
				range: Object.assign( {}, projection.range, {
					label: format_wall_minute( projection.range.start_minute ) + '–' + format_wall_minute( projection.range.end_minute ),
					start_label: format_wall_minute( projection.range.start_minute ),
					end_label: format_wall_minute( projection.range.end_minute ),
					start_percent: Number( ( 100 * projection.range.start_minute / 1440 ).toFixed( 8 ) ),
					end_percent: Number( ( 100 * projection.range.end_minute / 1440 ).toFixed( 8 ) ),
					step_minutes: range_step_minutes,
					start_aria_label: interpolate_label( i18n.time_range_start, { time: format_wall_minute( projection.range.start_minute ) } ),
					end_aria_label: interpolate_label( i18n.time_range_end, { time: format_wall_minute( projection.range.end_minute ) } ),
					auto_label: interpolate_label( i18n.auto_range_label, {
						range: format_wall_minute( projection.range.start_minute ) + '–' + format_wall_minute( projection.range.end_minute )
					} ),
					presets: get_time_range_presets().map( function ( preset ) {
						return Object.assign( {}, preset, {
							is_active: !! matching_range_preset && matching_range_preset.id === preset.id
						} );
					} )
				} ),
				zoom: {
					percent: zoom_percent,
					min_percent: zoom.min_percent,
					max_percent: zoom.max_percent,
					step_percent: zoom.step_percent,
					label: interpolate_label( i18n.time_zoom_value, { percent: zoom_percent } )
				},
				body_height_px: Math.max( zoom.minimum_body_height_px, Math.round( projection.range.span_minutes / 60 * zoom.hour_height_px * zoom_percent / 100 ) ),
				all_day_height_px: Math.max( 44, 12 + 34 * all_day_stack_count ),
				time_ticks: build_time_ticks( projection.range ),
				dates: dates,
				full_day_fragments: full_day_fragments,
				timed_fragments: timed_fragments,
				overflow_groups: projection.overflow_groups.map( function ( overflow ) {
					var date = date_by_key[ overflow.date ];
					var records = overflow.fragment_ids.map( function ( fragment_id ) {
						return timed_fragment_by_id[ fragment_id ];
					} ).filter( Boolean );
					return Object.assign( {}, overflow, {
						left_percent: date ? date.offset_percent + 0.68 * date.width_percent : 0,
						width_percent: date ? 0.3 * date.width_percent : 0,
						top_percent: Number( ( 100 * ( overflow.start_wall_minute - projection.range.start_minute ) / projection.range.span_minutes ).toFixed( 8 ) ),
						records: records,
						aria_label: interpolate_label( i18n.more_bookings, { count: records.length } )
					} );
				} ),
				availability_slices: projection.availability.slices.map( function ( slice ) {
					var date = date_by_key[ slice.date ];
					return Object.assign( {}, slice, {
						left_percent: date ? date.offset_percent : 0,
						width_percent: date ? date.width_percent : 0,
						css_class: get_availability_css_class( slice.winning_source ),
						label: slice.source_labels.join( ', ' ) || i18n.availability_unknown
					} );
				} ),
				availability_state: {
					state: projection.availability.state,
					message: 'partial' === projection.availability.state
						? i18n.availability_partial
						: ( 'failed' === projection.availability.state ? i18n.availability_failed : i18n.availability_loading )
				},
				summary_records: summary_records,
				i18n: i18n,
				registrations: registrations,
				resource_summary: get_source_resource( projection.resource_id )
			};
		}

		/**
		 * Return the current synchronized presentation hosts for one Resource.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {Array<Element>} Current Resource and canvas hosts.
		 */
		function get_current_hosts( resource_id ) {
			var hosts = mount ? mount.querySelectorAll( '[data-wpbc-timeline-row-presentation-host]' ) : [];

			return Array.prototype.filter.call( hosts, function ( host ) {
				return Number( host.getAttribute( 'data-wpbc-timeline-resource-id' ) ) === Number( resource_id )
					&& presentation_id === String( host.getAttribute( 'data-wpbc-timeline-row-presentation-host' ) || '' );
			} );
		}

		/**
		 * Register visible local booking projections with canonical read-only actions.
		 *
		 * @param {Array<Element>} canvas_hosts Rendered canvas-side hosts.
		 * @param {Object} model Presentation model and canonical registrations.
		 * @return {void}
		 */
		function register_read_only_booking_actions( canvas_hosts, model ) {
			var module_runtime = window.wpbc_timeline_modules;
			var booking_interactions = module_runtime && 'function' === typeof module_runtime.get_instance
				? module_runtime.get_instance( 'wpbc_timeline_booking_interactions' )
				: null;
			var registration_by_id = Object.create( null );
			var interaction_context = get_interaction_geometry_context( model.resource_id );
			var refresh_context;

			if ( ! booking_interactions || ! interaction_context || 'function' !== typeof booking_interactions.register_read_only_segment ) {
				return;
			}
			refresh_context = {
				presentation_id: presentation_id,
				resource_id: Number( model.resource_id ),
				cache_key: String( interaction_context.cache_key || '' ),
				accepted_identity: interaction_context.accepted_identity || {},
				visible_range: interaction_context.visible_range || {},
				zoom_percent: Number( interaction_context.zoom_percent || 0 )
			};
			if ( 'function' === typeof booking_interactions.begin_read_only_refresh ) {
				booking_interactions.begin_read_only_refresh( refresh_context );
			}
			model.registrations.forEach( function ( registration ) {
				registration_by_id[ registration.render_segment_id ] = registration;
			} );
			canvas_hosts.forEach( function ( host ) {
				var cards = host && host.querySelectorAll ? host.querySelectorAll( '[data-wpbc-timeline-time-rows-read-only]' ) : [];

				Array.prototype.forEach.call( cards, function ( card ) {
					var render_segment_id = String( card.getAttribute( 'data-wpbc-timeline-segment-id' ) || '' );
					var registration = registration_by_id[ render_segment_id ];

					if ( registration ) {
						booking_interactions.register_read_only_segment(
							card,
							registration.segment,
							model.resource_summary,
							Object.assign( {}, refresh_context, {
								render_segment_id: render_segment_id,
								is_overflowed: registration.is_overflowed,
								interaction_axis: registration.interaction_axis,
								boundary_visibility: registration.boundary_visibility
							} )
						);
					}
				} );
			} );
			if ( 'function' === typeof booking_interactions.complete_read_only_refresh ) {
				booking_interactions.complete_read_only_refresh( refresh_context );
			}
		}

		/**
		 * Notify shared rendering that local host contents are complete.
		 *
		 * @param {number} resource_id Rendered authorized Resource ID.
		 * @param {string} cache_key Complete accepted projection identity.
		 * @return {void}
		 */
		function emit_rendered( resource_id, cache_key ) {
			var rendered_event;

			if ( ! mount || 'function' !== typeof mount.dispatchEvent || 'function' !== typeof window.CustomEvent ) {
				return;
			}
			rendered_event = new window.CustomEvent( 'wpbc:timeline:row-presentation:rendered', {
				detail: {
					resource_id: Number( resource_id ),
					presentation_id: presentation_id,
					cache_key: String( cache_key || '' )
				}
			} );
			mount.dispatchEvent( rendered_event );
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
		function synchronize_authoritative_readback_state( resource_id, supplied_model ) {
			var state_template = get_template( 'state' );
			var projection_record = projected_resources[ Number( resource_id ) ];
			var presentation_model = supplied_model || ( ! is_authoritative_readback_pending && projection_record && projection_record.projection
				? build_presentation_model( projection_record.projection, get_resource_zoom_percent( resource_id ) )
				: null );

			get_current_hosts( resource_id ).forEach( function ( host ) {
				var panel = host && host.querySelector ? host.querySelector( '[data-wpbc-timeline-time-rows-panel]' ) : null;
				var state_host = host && host.querySelector ? host.querySelector( '[data-wpbc-timeline-time-rows-state-host]' ) : null;

				if ( ! panel ) {
					return;
				}
				if ( is_authoritative_readback_pending ) {
					if ( 'function' === typeof panel.setAttribute ) {
						panel.setAttribute( 'aria-busy', 'true' );
						panel.setAttribute( 'data-wpbc-timeline-time-rows-refreshing', 'true' );
					}
					if ( state_host && state_template ) {
						state_host.innerHTML = state_template( {
							state: 'refreshing',
							message: String( configuration.i18n && configuration.i18n.refreshing || '' )
						} );
					}
					return;
				}
				if ( 'function' === typeof panel.removeAttribute ) {
					panel.removeAttribute( 'aria-busy' );
					panel.removeAttribute( 'data-wpbc-timeline-time-rows-refreshing' );
				}
				if ( state_host && state_template && presentation_model ) {
					state_host.innerHTML = state_template( presentation_model.availability_state );
				}
			} );
		}

		/**
		 * Render one open Resource synchronously from already accepted local data.
		 *
		 * @param {number} resource_id Authorized open Resource ID.
		 * @param {Array<Element>} supplied_hosts Optional lifecycle-provided hosts.
		 * @return {boolean} True when useful local content replaced both hosts.
		 */
		function render_resource( resource_id, supplied_hosts ) {
			var hosts = Array.isArray( supplied_hosts ) && supplied_hosts.length ? supplied_hosts : get_current_hosts( resource_id );
			var resource_template = get_template( 'resource' );
			var canvas_template = get_template( 'canvas' );
			var state_template = get_template( 'state' );
			var summary_template = get_template( 'summary' );
			var projection;
			var model;
			var canvas_hosts = [];

			if ( ! open_resource_ids[ Number( resource_id ) ] || ! resource_template || ! canvas_template || ! state_template || ! summary_template || ! hosts.length ) {
				return false;
			}
			projection = project_resource( Number( resource_id ), get_resource_range_policy( resource_id ) );
			if ( ! projection ) {
				return false;
			}
			model = build_presentation_model( projection, get_resource_zoom_percent( resource_id ) );
			hosts.forEach( function ( host ) {
				var side = String( host.getAttribute( 'data-wpbc-timeline-row-presentation-side' ) || '' );

				if ( 'resource' === side ) {
					host.innerHTML = resource_template( model );
					return;
				}
				if ( 'canvas' !== side ) {
					return;
				}
				host.innerHTML = canvas_template( model );
				canvas_hosts.push( host );
				if ( host.querySelector ) {
					var state_host = host.querySelector( '[data-wpbc-timeline-time-rows-state-host]' );
					var summary_host = host.querySelector( '[data-wpbc-timeline-time-rows-summary-host]' );

					if ( state_host ) {
						state_host.innerHTML = state_template( model.availability_state );
					}
					if ( summary_host ) {
						summary_host.innerHTML = summary_template( {
							resource_id: model.resource_id,
							records: model.summary_records,
							i18n: model.i18n
						} );
					}
				}
			} );
			register_read_only_booking_actions( canvas_hosts, model );
			synchronize_authoritative_readback_state( resource_id, model );
			emit_rendered( resource_id, projection.cache_key );

			return 0 < canvas_hosts.length && hosts.length > canvas_hosts.length;
		}

		/**
		 * Rerender every currently open authorized Resource from accepted references.
		 *
		 * @return {void}
		 */
		function render_open_resources() {
			Object.keys( open_resource_ids ).forEach( function ( resource_id ) {
				render_resource( Number( resource_id ) );
			} );
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
		function render_availability_resources( affected_resource_ids ) {
			var availability_template = get_template( 'availability' );
			var state_template = get_template( 'state' );
			var summary_template = get_template( 'summary' );
			var target_resource_ids = normalize_resource_ids( affected_resource_ids );

			if ( ! availability_template || ! state_template || ! summary_template ) {
				return;
			}
			if ( ! target_resource_ids.length ) {
				target_resource_ids = Object.keys( open_resource_ids ).map( Number );
			}
			target_resource_ids.forEach( function ( resource_id ) {
				var projection;
				var model;

				if ( ! open_resource_ids[ resource_id ] ) {
					return;
				}
				projection = project_resource( resource_id, get_resource_range_policy( resource_id ) );
				if ( ! projection ) {
					return;
				}
				model = build_presentation_model( projection, get_resource_zoom_percent( resource_id ) );
				get_current_hosts( resource_id ).forEach( function ( host ) {
					var side = String( host.getAttribute( 'data-wpbc-timeline-row-presentation-side' ) || '' );
					var panel;
					var availability_host;
					var state_host;
					var summary_host;

					if ( ! host.querySelector ) {
						return;
					}
					panel = host.querySelector( '[data-wpbc-timeline-time-rows-panel]' );
					if ( panel && 'function' === typeof panel.setAttribute ) {
						/*
						 * Availability advances the composed projection identity without
						 * replacing either panel. Keep the rendered identity synchronized so
						 * later selection and movement snapshots are not rejected as stale.
						 */
						panel.setAttribute(
							'data-wpbc-timeline-time-rows-cache-key',
							String( projection.cache_key || '' )
						);
					}
					if ( 'canvas' !== side ) {
						return;
					}
					availability_host = host.querySelector( '[data-wpbc-timeline-time-rows-availability-host]' );
					state_host = host.querySelector( '[data-wpbc-timeline-time-rows-state-host]' );
					summary_host = host.querySelector( '[data-wpbc-timeline-time-rows-summary-host]' );
					if ( availability_host ) {
						availability_host.innerHTML = availability_template( model );
					}
					if ( state_host ) {
						state_host.innerHTML = state_template( model.availability_state );
					}
					if ( summary_host ) {
						summary_host.innerHTML = summary_template( {
							resource_id: model.resource_id,
							records: model.summary_records,
							i18n: model.i18n
						} );
					}
				} );
				synchronize_authoritative_readback_state( resource_id, model );
				emit_rendered( resource_id, projection.cache_key );
			} );
		}

		/**
		 * Remove one Resource's local indexes and projections.
		 *
		 * @param {number} resource_id Resource whose presentation closed/disappeared.
		 * @return {void}
		 */
		function remove_resource_local_state( resource_id ) {
			var suffix = '|' + Number( resource_id );

			Object.keys( resource_window_indexes ).forEach( function ( cache_key ) {
				if ( cache_key.slice( -suffix.length ) === suffix ) {
					delete resource_window_indexes[ cache_key ];
				}
			} );
			Object.keys( projection_cache ).forEach( function ( window_key ) {
				delete projection_cache[ window_key ][ Number( resource_id ) ];
				if ( ! Object.keys( projection_cache[ window_key ] ).length ) {
					delete projection_cache[ window_key ];
				}
			} );
			delete projected_resources[ Number( resource_id ) ];
		}

		/**
		 * Handle accepted native booking-window notifications.
		 *
		 * @param {CustomEvent} event Accepted-data event.
		 * @return {void}
		 */
		function handle_booking_windows_accepted( event ) {
			if (
				accept_booking_windows( event && event.detail ? event.detail : {} )
				&& last_booking_transition
				&& last_booking_transition.has_projection_change
			) {
				render_open_resources();
			}
		}

		/**
		 * Handle accepted native Availability notifications.
		 *
		 * @param {CustomEvent} event Accepted-data event.
		 * @return {void}
		 */
		function handle_availability_accepted( event ) {
			if (
				accept_availability( event && event.detail ? event.detail : {} )
				&& last_availability_transition
				&& last_availability_transition.has_projection_change
			) {
				render_availability_resources( last_availability_transition.affected_resource_ids );
			}
		}

		/**
		 * Reflect native mutation readback without owning its request or cache.
		 *
		 * @param {CustomEvent} event Neutral authoritative-readback lifecycle event.
		 * @return {void}
		 */
		function handle_authoritative_readback_state( event ) {
			var detail = event && event.detail ? event.detail : {};
			var generation = Number( detail.generation );
			var state = String( detail.state || '' );

			if (
				1 !== Number( detail.schema_version )
				|| ! Number.isInteger( generation )
				|| generation < authoritative_readback_generation
				|| -1 === [ 'loading', 'accepted', 'failed' ].indexOf( state )
			) {
				return;
			}
			authoritative_readback_generation = generation;
			is_authoritative_readback_pending = 'loading' === state;
			if ( 'failed' === state ) {
				render_open_resources();
				return;
			}
			Object.keys( open_resource_ids ).forEach( function ( resource_id ) {
				synchronize_authoritative_readback_state( Number( resource_id ) );
			} );
		}

		/**
		 * Return the paired dual-range controls containing one changed endpoint.
		 *
		 * @param {Element} control Start or end range input.
		 * @return {Object|null} Container and endpoint controls or null.
		 */
		function get_range_control_elements( control ) {
			var container = control && control.closest ? control.closest( '[data-wpbc-timeline-time-rows-range-control]' ) : null;

			if ( ! container || ! container.querySelector ) {
				return null;
			}
			return {
				container: container,
				start: container.querySelector( '[data-wpbc-timeline-time-rows-range-boundary="start"]' ),
				end: container.querySelector( '[data-wpbc-timeline-time-rows-range-boundary="end"]' )
			};
		}

		/**
		 * Update labels and the selected track while one range thumb moves.
		 *
		 * @param {Element} control Changed start or end range input.
		 * @return {Object|null} Normalized custom policy or null.
		 */
		function update_range_preview( control ) {
			var controls = get_range_control_elements( control );
			var boundary = String( control && control.getAttribute ? control.getAttribute( 'data-wpbc-timeline-time-rows-range-boundary' ) : '' );
			var step_minutes = get_time_range_step_minutes();
			var start_minute;
			var end_minute;
			var outputs;
			var actions;
			var range_policy;
			var matching_range_preset;
			var i18n = configuration.i18n || {};

			if ( ! controls || ! controls.start || ! controls.end ) {
				return null;
			}
			start_minute = normalize_wall_minute( controls.start.value, 0 );
			end_minute = normalize_wall_minute( controls.end.value, 1440 );
			if ( 'start' === boundary ) {
				start_minute = Math.min( 1440 - step_minutes, Math.min( start_minute, end_minute - step_minutes ) );
			} else {
				end_minute = Math.max( step_minutes, Math.max( end_minute, start_minute + step_minutes ) );
			}
			start_minute = Math.max( 0, start_minute );
			end_minute = Math.min( 1440, end_minute );
			controls.start.value = start_minute;
			controls.end.value = end_minute;
			controls.start.setAttribute( 'aria-label', interpolate_label( i18n.time_range_start, { time: format_wall_minute( start_minute ) } ) );
			controls.end.setAttribute( 'aria-label', interpolate_label( i18n.time_range_end, { time: format_wall_minute( end_minute ) } ) );
			if ( controls.container.style && controls.container.style.setProperty ) {
				controls.container.style.setProperty( '--wpbc-time-rows-range-start', Number( ( 100 * start_minute / 1440 ).toFixed( 8 ) ) + '%' );
				controls.container.style.setProperty( '--wpbc-time-rows-range-end', Number( ( 100 * end_minute / 1440 ).toFixed( 8 ) ) + '%' );
			}
			outputs = controls.container.querySelectorAll ? controls.container.querySelectorAll( '[data-wpbc-timeline-time-rows-range-output]' ) : [];
			Array.prototype.forEach.call( outputs, function ( output ) {
				output.textContent = 'start' === output.getAttribute( 'data-wpbc-timeline-time-rows-range-output' )
					? format_wall_minute( start_minute )
					: format_wall_minute( end_minute );
			} );
			range_policy = { mode: 'custom', start_minute: start_minute, end_minute: end_minute };
			matching_range_preset = get_matching_range_preset( range_policy );
			actions = controls.container.querySelectorAll ? controls.container.querySelectorAll( '[data-wpbc-timeline-time-rows-range-mode]' ) : [];
			Array.prototype.forEach.call( actions, function ( action ) {
				var is_active = !! matching_range_preset
					&& matching_range_preset.id === String( action.getAttribute( 'data-wpbc-timeline-time-rows-range-preset' ) || '' );

				action.setAttribute( 'aria-pressed', is_active ? 'true' : 'false' );
				if ( action.classList ) {
					action.classList.toggle( 'is-active', is_active );
				}
			} );

			return range_policy;
		}

		/**
		 * Preview one dual-range endpoint without projecting or requesting data.
		 *
		 * @param {Event} event Delegated Resource-side input event.
		 * @return {void}
		 */
		function handle_range_input( event ) {
			var control = event.target && event.target.closest
				? event.target.closest( '[data-wpbc-timeline-time-rows-range]' )
				: null;

			if ( control ) {
				update_range_preview( control );
			}
		}

		/**
		 * Restore focus to a code-owned control after its WordPress template rerenders.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @param {string} selector Fixed domain-owned selector.
		 * @return {void}
		 */
		function restore_control_focus( resource_id, selector ) {
			get_current_hosts( resource_id ).some( function ( host ) {
				var control = host && host.querySelector ? host.querySelector( selector ) : null;

				if ( ! control || 'function' !== typeof control.focus ) {
					return false;
				}
				control.focus();
				return true;
			} );
		}

		/**
		 * Commit one explicit dual-slider range without a request.
		 *
		 * @param {Event} event Delegated Resource-side change event.
		 * @return {void}
		 */
		function handle_range_change( event ) {
			var control = event.target && event.target.closest
				? event.target.closest( '[data-wpbc-timeline-time-rows-range]' )
				: null;
			var resource_id;
			var range_policy;
			var boundary;

			if ( ! control ) {
				return;
			}
			resource_id = Number( control.getAttribute( 'data-wpbc-timeline-resource-id' ) );
			if ( ! open_resource_ids[ resource_id ] ) {
				return;
			}
			range_policy = update_range_preview( control );
			if ( ! range_policy ) {
				return;
			}
			boundary = 'end' === control.getAttribute( 'data-wpbc-timeline-time-rows-range-boundary' ) ? 'end' : 'start';
			range_policies_by_resource[ resource_id ] = normalize_range_policy( range_policy );
			delete projected_resources[ resource_id ];
			render_resource( resource_id );
			restore_control_focus( resource_id, '[data-wpbc-timeline-time-rows-range-boundary="' + boundary + '"]' );
			queue_preference_save( resource_id );
		}

		/**
		 * Apply Auto, one server-defined preset, or Full day from range actions.
		 *
		 * @param {Event} event Delegated Resource-side click event.
		 * @return {void}
		 */
		function handle_range_action( event ) {
			var action = event.target && event.target.closest
				? event.target.closest( '[data-wpbc-timeline-time-rows-range-mode]' )
				: null;
			var resource_id;
			var mode;
			var preset_id;
			var preset;
			var range_policy;
			var focus_selector;

			if ( ! action ) {
				return;
			}
			resource_id = Number( action.getAttribute( 'data-wpbc-timeline-resource-id' ) );
			mode = String( action.getAttribute( 'data-wpbc-timeline-time-rows-range-mode' ) || '' );
			if ( ! open_resource_ids[ resource_id ] || -1 === [ 'auto', 'custom', 'full_day' ].indexOf( mode ) ) {
				return;
			}
			range_policy = { mode: mode };
			focus_selector = '[data-wpbc-timeline-time-rows-range-mode="' + mode + '"]';
			if ( 'custom' === mode ) {
				preset_id = String( action.getAttribute( 'data-wpbc-timeline-time-rows-range-preset' ) || '' );
				preset = get_time_range_presets().find( function ( candidate ) {
					return candidate.id === preset_id;
				} );
				if ( ! preset ) {
					return;
				}
				range_policy = {
					mode: 'custom',
					start_minute: preset.start_minute,
					end_minute: preset.end_minute
				};
				focus_selector += '[data-wpbc-timeline-time-rows-range-preset="' + preset.id + '"]';
			}
			range_policies_by_resource[ resource_id ] = normalize_range_policy( range_policy );
			delete projected_resources[ resource_id ];
			render_resource( resource_id );
			restore_control_focus( resource_id, focus_selector );
			queue_preference_save( resource_id );
		}

		/**
		 * Update both synchronized panel halves for one presentation-only zoom value.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @param {number} zoom_percent Normalized vertical zoom percentage.
		 * @return {void}
		 */
		function update_zoom_preview( resource_id, zoom_percent ) {
			var projection_record = projected_resources[ Number( resource_id ) ];
			var zoom = get_zoom_configuration();
			var body_height_px;

			if ( ! projection_record || ! projection_record.projection ) {
				return;
			}
			body_height_px = Math.max(
				zoom.minimum_body_height_px,
				Math.round( projection_record.projection.range.span_minutes / 60 * zoom.hour_height_px * zoom_percent / 100 )
			);
			get_current_hosts( resource_id ).forEach( function ( host ) {
				var panel = host && host.querySelector ? host.querySelector( '[data-wpbc-timeline-time-rows-panel]' ) : null;

				if ( panel && panel.style && panel.style.setProperty ) {
					panel.style.setProperty( '--wpbc-time-rows-body-height', body_height_px + 'px' );
				}
			} );
			emit_rendered( resource_id, projection_record.cache_key );
		}

		/**
		 * Apply a local vertical zoom preview without invalidating projection data.
		 *
		 * @param {Event} event Delegated Resource-side input event.
		 * @return {void}
		 */
		function handle_zoom_input( event ) {
			var control = event.target && event.target.closest
				? event.target.closest( '[data-wpbc-timeline-time-rows-zoom]' )
				: null;
			var resource_id;
			var zoom_percent;
			var panel;
			var status;
			var label;

			if ( ! control ) {
				return;
			}
			resource_id = Number( control.getAttribute( 'data-wpbc-timeline-resource-id' ) );
			if ( ! open_resource_ids[ resource_id ] ) {
				return;
			}
			zoom_percent = normalize_zoom_percent( control.value );
			zoom_percentages_by_resource[ resource_id ] = zoom_percent;
			label = interpolate_label( configuration.i18n && configuration.i18n.time_zoom_value, { percent: zoom_percent } );
			control.value = zoom_percent;
			control.setAttribute( 'aria-valuetext', label );
			panel = control.closest ? control.closest( '[data-wpbc-timeline-time-rows-panel]' ) : null;
			status = panel && panel.querySelector ? panel.querySelector( '[data-wpbc-timeline-time-rows-zoom-status]' ) : null;
			if ( status ) {
				status.textContent = label;
			}
			update_zoom_preview( resource_id, zoom_percent );
		}

		/**
		 * Persist the final density value after the native range interaction ends.
		 *
		 * @param {Event} event Delegated Resource-side change event.
		 * @return {void}
		 */
		function handle_zoom_change( event ) {
			var control = event.target && event.target.closest
				? event.target.closest( '[data-wpbc-timeline-time-rows-zoom]' )
				: null;
			var resource_id;

			if ( ! control ) {
				return;
			}
			resource_id = Number( control.getAttribute( 'data-wpbc-timeline-resource-id' ) );
			if ( open_resource_ids[ resource_id ] ) {
				queue_preference_save( resource_id );
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
		function handle_preferences_reset_requested( event ) {
			var detail = event && event.detail ? event.detail : {};
			var waiters = [];

			if ( 1 !== Number( detail.schema_version ) || 'function' !== typeof detail.wait_until ) {
				return;
			}
			Object.keys( preference_save_states_by_resource ).forEach( function ( resource_id ) {
				var state = preference_save_states_by_resource[ resource_id ];

				if ( state.timer ) {
					window.clearTimeout( state.timer );
					state.timer = null;
				}
				state.pending = false;
				if ( state.request && 'function' === typeof state.request.always ) {
					waiters.push( new window.Promise( function ( resolve ) {
						state.request.always( resolve );
					} ) );
				}
			} );
			detail.wait_until( window.Promise.all( waiters ) );
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
		function handle_preferences_reset( event ) {
			if ( 1 !== Number( event && event.detail && event.detail.schema_version ) ) {
				return;
			}
			Object.keys( preference_save_states_by_resource ).forEach( remove_preference_save_state );
			Object.keys( preference_loaded_by_resource ).concat( Object.keys( open_resource_ids ) ).forEach( function ( resource_id ) {
				resource_id = Number( resource_id );
				range_policies_by_resource[ resource_id ] = { mode: 'auto' };
				zoom_percentages_by_resource[ resource_id ] = get_zoom_configuration().default_percent;
				preference_reset_pending_by_resource[ resource_id ] = true;
				delete preference_loaded_by_resource[ resource_id ];
				delete projected_resources[ resource_id ];
			} );
			render_open_resources();
		}

		/**
		 * Handle neutral presentation host/open/close/removal lifecycle events.
		 *
		 * @param {CustomEvent} event Presentation lifecycle event.
		 * @return {void}
		 */
		function handle_presentation_lifecycle( event ) {
			var detail = event && event.detail ? event.detail : {};
			var resource_id = Number( detail.resource_id );

			if ( presentation_id !== String( detail.presentation_id || '' ) || ! Number.isInteger( resource_id ) || 1 > resource_id ) {
				return;
			}
			if ( 'wpbc:timeline:row-presentation:opened' === event.type || ( 'wpbc:timeline:row-presentation:hosts-ready' === event.type && true === detail.is_open ) ) {
				open_resource_ids[ resource_id ] = true;
				synchronize_resource_preferences( resource_id );
				render_resource( resource_id, detail.hosts );
				return;
			}
			if ( 'wpbc:timeline:row-presentation:closed' === event.type || 'wpbc:timeline:row-presentation:removed' === event.type ) {
				delete open_resource_ids[ resource_id ];
				remove_resource_local_state( resource_id );
				if ( 'wpbc:timeline:row-presentation:removed' === event.type ) {
					delete range_policies_by_resource[ resource_id ];
					delete zoom_percentages_by_resource[ resource_id ];
					delete preference_loaded_by_resource[ resource_id ];
					delete preference_reset_pending_by_resource[ resource_id ];
					remove_preference_save_state( resource_id );
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
		function get_interaction_geometry_context( resource_id ) {
			var projection_record;
			var projection;
			var zoom;

			resource_id = Number( resource_id );
			projection_record = projected_resources[ resource_id ];
			projection = projection_record && projection_record.projection;
			if ( ! open_resource_ids[ resource_id ] || ! projection || ! projection.identity || ! Array.isArray( projection.dates ) ) {
				return null;
			}
			zoom = get_zoom_configuration();

			return {
				schema_version: 1,
				cache_key: String( projection.cache_key || '' ),
				accepted_identity: {
					resource_id: resource_id,
					resource_fingerprint: String( projection.identity.resource_fingerprint || '' ),
					booking_generation: Number( projection.identity.booking_generation || 0 ),
					availability_generation: Number( projection.identity.availability_generation || 0 ),
					accepted_window_keys: accepted_booking_windows.map( function ( window_entry ) {
						return String( window_entry && window_entry.key || '' );
					} ).filter( Boolean ),
					timezone: String( projection.timezone || '' )
				},
				date_bands: projection.dates.map( function ( date_band ) {
					return {
						date: String( date_band.date || '' ),
						start_at: String( date_band.start_at || '' ),
						end_at: String( date_band.end_at || '' ),
						start_epoch: Number( date_band.start_epoch ),
						end_epoch: Number( date_band.end_epoch ),
						elapsed_minutes: Number( date_band.elapsed_minutes ),
						wall_minutes: Number( date_band.wall_minutes ),
						transitions: ( Array.isArray( date_band.transitions ) ? date_band.transitions : [] ).map( function ( transition ) {
							return {
								transition_id: String( transition.transition_id || '' ),
								epoch: Number( transition.epoch ),
								kind: String( transition.kind || '' ),
								wall_range_start_minute: Number( transition.wall_range_start_minute ),
								wall_range_end_minute: Number( transition.wall_range_end_minute ),
								offset_before_seconds: Number( transition.offset_before_seconds ),
								offset_after_seconds: Number( transition.offset_after_seconds )
							};
						} )
					};
				} ),
				visible_range: {
					start_minute: Number( projection.range && projection.range.start_minute ),
					end_minute: Number( projection.range && projection.range.end_minute )
				},
				zoom_percent: get_resource_zoom_percent( resource_id ),
				hour_height_px: zoom.hour_height_px
			};
		}

		/**
		 * Return bounded scalar state for development assertions.
		 *
		 * @return {Object} Generations, window keys, and cache counts.
		 */
		function get_state_snapshot() {
			var projection_count = Object.keys( projection_cache ).reduce( function ( count, window_key ) {
				return count + Object.keys( projection_cache[ window_key ] ).length;
			}, 0 );

			return {
				booking_generation: booking_generation,
				availability_generation: availability_generation,
				availability_state: availability_state,
				booking_window_keys: Object.keys( booking_identities_by_key ),
				availability_window_count: accepted_availability_windows.length,
				open_resource_ids: Object.keys( open_resource_ids ).map( Number ),
				resource_index_count: Object.keys( resource_window_indexes ).length,
				projection_window_count: Object.keys( projection_cache ).length,
				projection_count: projection_count
					+ Object.keys( projected_resources ).length,
				projected_resource_count: Object.keys( projected_resources ).length,
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
			if ( ! mount || is_initialized ) {
				return;
			}
			is_initialized = true;
			mount.addEventListener( 'wpbc:timeline:data:booking-windows-accepted', handle_booking_windows_accepted );
			mount.addEventListener( 'wpbc:timeline:data:initial-canvas-ready', handle_initial_canvas_ready );
			mount.addEventListener( 'wpbc:timeline:data:availability-accepted', handle_availability_accepted );
			mount.addEventListener( 'wpbc:timeline:data:authoritative-readback-state', handle_authoritative_readback_state );
			mount.addEventListener( 'wpbc:timeline:data:preferences-reset', handle_preferences_reset );
			mount.addEventListener( 'wpbc:timeline:preferences:reset-requested', handle_preferences_reset_requested );
			mount.addEventListener( 'wpbc:timeline:row-presentation:hosts-ready', handle_presentation_lifecycle );
			mount.addEventListener( 'wpbc:timeline:row-presentation:opened', handle_presentation_lifecycle );
			mount.addEventListener( 'wpbc:timeline:row-presentation:closed', handle_presentation_lifecycle );
			mount.addEventListener( 'wpbc:timeline:row-presentation:removed', handle_presentation_lifecycle );
			mount.addEventListener( 'input', handle_range_input );
			mount.addEventListener( 'input', handle_zoom_input );
			mount.addEventListener( 'change', handle_range_change );
			mount.addEventListener( 'change', handle_zoom_change );
			mount.addEventListener( 'click', handle_range_action );
		}

		/**
		 * Remove listeners and release every retained DTO reference.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! mount || ! is_initialized ) {
				return;
			}
			mount.removeEventListener( 'wpbc:timeline:data:booking-windows-accepted', handle_booking_windows_accepted );
			mount.removeEventListener( 'wpbc:timeline:data:initial-canvas-ready', handle_initial_canvas_ready );
			mount.removeEventListener( 'wpbc:timeline:data:availability-accepted', handle_availability_accepted );
			mount.removeEventListener( 'wpbc:timeline:data:authoritative-readback-state', handle_authoritative_readback_state );
			mount.removeEventListener( 'wpbc:timeline:data:preferences-reset', handle_preferences_reset );
			mount.removeEventListener( 'wpbc:timeline:preferences:reset-requested', handle_preferences_reset_requested );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:hosts-ready', handle_presentation_lifecycle );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:opened', handle_presentation_lifecycle );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:closed', handle_presentation_lifecycle );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:removed', handle_presentation_lifecycle );
			mount.removeEventListener( 'input', handle_range_input );
			mount.removeEventListener( 'input', handle_zoom_input );
			mount.removeEventListener( 'change', handle_range_change );
			mount.removeEventListener( 'change', handle_zoom_change );
			mount.removeEventListener( 'click', handle_range_action );
			accepted_booking_windows = [];
			accepted_availability_windows = [];
			booking_identities_by_key = Object.create( null );
			open_resource_ids = Object.create( null );
			Object.keys( preference_save_states_by_resource ).forEach( remove_preference_save_state );
			range_policies_by_resource = Object.create( null );
			zoom_percentages_by_resource = Object.create( null );
			preference_loaded_by_resource = Object.create( null );
			preference_reset_pending_by_resource = Object.create( null );
			preference_save_states_by_resource = Object.create( null );
			availability_state = 'loading';
			booking_projection_revision = 0;
			availability_projection_revision = 0;
			authoritative_readback_generation = 0;
			is_authoritative_readback_pending = false;
			last_booking_transition = null;
			last_availability_transition = null;
			initial_open_completed = false;
			if ( auto_open_animation_timer ) {
				window.clearTimeout( auto_open_animation_timer );
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

	if (
		window.wpbc_timeline_modules
		&& 'function' === typeof window.wpbc_timeline_modules.register_factory
	) {
		window.wpbc_timeline_modules.register_factory( module_id, create_time_rows_controller );
	}
}( window, window.wp ) );
