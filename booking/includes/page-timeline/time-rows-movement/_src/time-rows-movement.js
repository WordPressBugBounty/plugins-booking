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
( function ( window, document, wp ) {
	'use strict';

	var module_id = 'time_rows_movement';
	var module_instance_id = 'wpbc_timeline_time_rows_movement';
	var exact_instant_pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/;
	var timed_surface_selector = '.wpbc_timeline_time_rows__timed_surface';
	var all_day_surface_selector = '.wpbc_timeline_time_rows__all_day_surface';
	var date_column_selector = '[data-wpbc-timeline-time-rows-date]';
	var movement_grip_selector = '[data-wpbc-timeline-time-rows-movement-grip]';
	var resize_handle_selector = '[data-wpbc-timeline-time-rows-resize-handle]';
	var supported_timed_resize_shapes = [
		'single_timed_interval',
		'continuous_boundary_interval',
		'recurrent_timed_intervals',
		'discontinuous_timed_intervals'
	];
	var supported_full_day_resize_shapes = [
		'single_full_day',
		'continuous_full_day_range',
		'independent_full_days'
	];
	var time_rows_panel_selector = '[data-wpbc-timeline-time-rows-panel="canvas"]';
	var booking_interaction_callbacks = null;

	/**
	 * Normalize one positive integer without accepting presentation strings.
	 *
	 * @param {*} candidate Candidate scalar.
	 * @return {number} Positive integer, or zero.
	 */
	function normalize_positive_integer( candidate ) {
		candidate = Number( candidate );

		return Number.isInteger( candidate ) && 0 < candidate ? candidate : 0;
	}

	/**
	 * Build one immutable accepted-identity key including local geometry.
	 *
	 * @param {Object} context Accepted interaction context from time rows.
	 * @param {number} selection_step_minutes Server-owned interaction step.
	 * @return {string} Stable identity key, or an empty string.
	 */
	function build_accepted_identity_key( context, selection_step_minutes ) {
		var identity = context && context.accepted_identity ? context.accepted_identity : {};
		var visible_range = context && context.visible_range ? context.visible_range : {};
		var resource_id = normalize_positive_integer( identity.resource_id );
		var window_keys = Array.isArray( identity.accepted_window_keys )
			? identity.accepted_window_keys.map( String ).filter( Boolean )
			: [];

		if (
			! resource_id
			|| ! String( context && context.cache_key || '' )
			|| ! String( identity.resource_fingerprint || '' )
			|| ! String( identity.timezone || '' )
			|| ! window_keys.length
			|| ! Number.isFinite( Number( visible_range.start_minute ) )
			|| ! Number.isFinite( Number( visible_range.end_minute ) )
			|| Number( visible_range.end_minute ) <= Number( visible_range.start_minute )
			|| ! Number.isFinite( Number( context.zoom_percent ) )
			|| ! Number.isInteger( Number( selection_step_minutes ) )
			|| 1 > Number( selection_step_minutes )
		) {
			return '';
		}

		return [
			resource_id,
			String( context.cache_key ),
			String( identity.resource_fingerprint ),
			Number( identity.booking_generation || 0 ),
			Number( identity.availability_generation || 0 ),
			window_keys.join( ',' ),
			String( identity.timezone ),
			Number( visible_range.start_minute ),
			Number( visible_range.end_minute ),
			Number( context.zoom_percent ),
			Number( selection_step_minutes )
		].join( '|' );
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
	function build_canonical_key( identity_key, booking_id, resource_id, segment_id, visible_start, visible_end ) {
		return [ identity_key, booking_id, resource_id, segment_id, visible_start, visible_end ].join( '|' );
	}

	/**
	 * Create one page-local projected-booking eligibility controller.
	 *
	 * @param {Object} context Timeline extension context.
	 * @return {Object} Symmetric module lifecycle and neutral bridge API.
	 */
	function create_controller( context ) {
		var mount = context.mount || null;
		var configuration = context.configuration || {};
		var time_rows_configuration = configuration.time_rows || {};
		var transport = configuration.transport || {};
		var templates = configuration.templates || {};
		var i18n = configuration.i18n || {};
		var optional_gestures = configuration.optional_gestures || {};
		var geometry = window.wpbc_timeline_time_rows_interaction_geometry || null;
		var callbacks = context.callbacks || booking_interaction_callbacks || {};
		var selection_step_minutes = Number( configuration.selection_step_minutes || 0 );
		var full_day_movement_enabled = true === optional_gestures.full_day_movement;
		var full_day_resize_enabled = true === optional_gestures.full_day_resize;
		var cross_resource_movement_enabled = true === optional_gestures.cross_resource_movement;
		var registrations_by_render_id = Object.create( null );
		var registration_ids_by_resource = Object.create( null );
		var refresh_identity_by_resource = Object.create( null );
		var eligibility_cache = Object.create( null );
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

			return modules && 'function' === typeof modules.get_instance
				? modules.get_instance( String( time_rows_configuration.instance_id || '' ) )
				: null;
		}

		/**
		 * Read the current accepted identity directly from its authoritative owner.
		 *
		 * @param {number} resource_id Authorized open Resource ID.
		 * @return {Object|null} Current accepted interaction context or null.
		 */
		function get_live_interaction_context( resource_id ) {
			var time_rows = get_time_rows_controller();

			if ( ! time_rows || 'function' !== typeof time_rows.get_interaction_geometry_context ) {
				return null;
		}

			return time_rows.get_interaction_geometry_context( resource_id );
		}

		/**
		 * Return a fixed allow-listed WordPress template renderer.
		 *
		 * @param {string} template_slot Server-owned template slot.
		 * @return {Function|null} Template renderer or null.
		 */
		function get_template( template_slot ) {
			var template_id = templates[ template_slot ];

			return template_id && wp && 'function' === typeof wp.template ? wp.template( template_id ) : null;
		}

		/**
		 * Remove every pending eligibility read and advance stale-response state.
		 *
		 * @param {number} resource_id Optional Resource-scoped cancellation.
		 * @return {void}
		 */
		function abort_requests( resource_id ) {
			resource_id = normalize_positive_integer( resource_id );
			if ( resource_id && active_request_resource_id && resource_id !== active_request_resource_id ) {
				return;
			}
			active_requests.forEach( function ( request ) {
				if ( request && 'function' === typeof request.abort ) {
					request.abort();
				}
			} );
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
			if ( reconcile_frame && 'function' === typeof window.cancelAnimationFrame ) {
				window.cancelAnimationFrame( reconcile_frame );
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
		function clear_registration_host( registration ) {
			var hosts = registration && registration.card && registration.card.querySelectorAll
				? registration.card.querySelectorAll( '[data-wpbc-timeline-time-rows-movement-host]' )
				: [];

			Array.prototype.forEach.call( hosts, function ( host ) {
				host.remove();
			} );
		}

		/**
		 * Remove module presentation from every retained projected segment.
		 *
		 * @return {void}
		 */
		function clear_all_registration_hosts() {
			Object.keys( registrations_by_render_id ).forEach( function ( render_id ) {
				clear_registration_host( registrations_by_render_id[ render_id ] );
			} );
		}

		/**
		 * Invalidate every eligibility record and remove current controls.
		 *
		 * @return {void}
		 */
		function invalidate_all() {
			cancel_gesture( false, '' );
			abort_requests();
			cancel_reconcile_selection();
			clear_all_registration_hosts();
			eligibility_cache = Object.create( null );
			selected_canonical_key = '';
		}

		/**
		 * Remove all registrations and eligibility owned by one Resource.
		 *
		 * @param {number}  resource_id          Resource whose projection was replaced.
		 * @param {boolean} preserve_eligibility Whether same-identity cache may remain.
		 * @return {void}
		 */
		function invalidate_resource( resource_id, preserve_eligibility ) {
			var render_ids = registration_ids_by_resource[ resource_id ] || [];

			if (
				active_gesture
				&& (
					active_gesture.registration.resource_id === resource_id
					|| active_gesture.target_resource_id === resource_id
				)
			) {
				cancel_gesture( false, '' );
			}
			abort_requests( resource_id );
			render_ids.forEach( function ( render_id ) {
				var registration = registrations_by_render_id[ render_id ];

				clear_registration_host( registration );
				if ( ! preserve_eligibility && registration && eligibility_cache[ registration.canonical_key ] ) {
					delete eligibility_cache[ registration.canonical_key ];
				}
				delete registrations_by_render_id[ render_id ];
			} );
			delete registration_ids_by_resource[ resource_id ];
			delete refresh_identity_by_resource[ resource_id ];
			if ( selected_canonical_key && ! Object.keys( registrations_by_render_id ).some( function ( render_id ) {
				return registrations_by_render_id[ render_id ].canonical_key === selected_canonical_key;
			} ) ) {
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
		function normalize_registration( card, segment, presentation_context ) {
			var resource_id = normalize_positive_integer( segment && segment.resource_id );
			var booking_id = normalize_positive_integer( segment && segment.booking_id );
			var segment_id = String( segment && segment.segment_id || '' );
			var visible_start = String( segment && segment.visible_start || '' );
			var visible_end = String( segment && segment.visible_end || '' );
			var render_id = String( presentation_context && presentation_context.render_segment_id || '' );
			var identity_key = refresh_identity_by_resource[ resource_id ] || '';
			var boundaries = presentation_context && presentation_context.boundary_visibility
				? presentation_context.boundary_visibility
				: {};
			var interaction_axis = 'vertical' === String( presentation_context && presentation_context.interaction_axis || '' )
				? 'vertical'
				: 'horizontal';

			if (
				! card
				|| ! card.isConnected
				|| ! booking_id
				|| ! resource_id
				|| ! segment_id
				|| ! render_id
				|| ! identity_key
				|| ! exact_instant_pattern.test( visible_start )
				|| ! exact_instant_pattern.test( visible_end )
			) {
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
				canonical_key: build_canonical_key( identity_key, booking_id, resource_id, segment_id, visible_start, visible_end ),
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
		function begin_read_only_refresh( refresh_context ) {
			var resource_id = normalize_positive_integer( refresh_context && refresh_context.resource_id );
			var live_context;
			var identity_key;
			var previous_identity_key;

			if (
				String( refresh_context && refresh_context.presentation_id || '' ) !== String( time_rows_configuration.presentation_id || '' )
				|| ! resource_id
			) {
				return;
			}
			live_context = get_live_interaction_context( resource_id );
			identity_key = build_accepted_identity_key( live_context, selection_step_minutes );
			previous_identity_key = refresh_identity_by_resource[ resource_id ] || '';
			invalidate_resource( resource_id, Boolean( identity_key && identity_key === previous_identity_key ) );
			if ( identity_key ) {
				refresh_identity_by_resource[ resource_id ] = identity_key;
				registration_ids_by_resource[ resource_id ] = [];
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
		function register_read_only_segment( card, segment, resource_summary, presentation_context ) {
			var registration = normalize_registration( card, segment, presentation_context );

			if ( ! registration ) {
				return;
			}
			registrations_by_render_id[ registration.render_id ] = registration;
			registration_ids_by_resource[ registration.resource_id ] = registration_ids_by_resource[ registration.resource_id ] || [];
			registration_ids_by_resource[ registration.resource_id ].push( registration.render_id );
		}

		/**
		 * Normalize an authoritative movement-context response.
		 *
		 * @param {Object} response AJAX response envelope.
		 * @param {Object} registration Requested canonical registration.
		 * @return {Object|null} Normalized movement eligibility or null.
		 */
		function normalize_movement_response( response, registration ) {
			var movement = response && response.success && response.data ? response.data.movement_context : null;
			var availability = movement && movement.gesture_availability ? movement.gesture_availability : {};
			var schedule_seed = movement && movement.schedule_seed ? movement.schedule_seed : {};
			var selected_dates = Array.isArray( schedule_seed.selected_dates ) ? schedule_seed.selected_dates.map( String ) : [];
			var exact_intervals = Array.isArray( schedule_seed.exact_intervals ) ? schedule_seed.exact_intervals.map( function ( interval ) {
				return Object.freeze( {
					start: String( interval && interval.start || '' ),
					end: String( interval && interval.end || '' )
				} );
			} ) : [];
			var same_resource = true === availability.same_resource;
			var cross_resource = true === availability.cross_resource;
			var source_context_token = String( movement && movement.source_context_token || '' );
			var time_application = String( schedule_seed.time_application || '' );
			var selection_method = String( schedule_seed.selection_method || '' );

			if (
				! movement
				|| Number( movement.booking_id ) !== registration.booking_id
				|| ! normalize_positive_integer( movement.primary_resource_id )
				|| ! normalize_positive_integer( movement.proposal_revision )
				|| ! selected_dates.length
				|| -1 === [ 'policy', 'individual' ].indexOf( selection_method )
			) {
				return null;
			}
			if ( 'full_day' !== time_application && ( ! exact_intervals.length || exact_intervals.some( function ( interval ) {
				return ! exact_instant_pattern.test( interval.start )
					|| ! exact_instant_pattern.test( interval.end )
					|| Date.parse( interval.end ) <= Date.parse( interval.start );
			} ) ) ) {
				return null;
			}
			if ( ( same_resource || cross_resource ) && ! source_context_token ) {
				return null;
			}

			return {
				allowed: same_resource || cross_resource,
				same_resource: same_resource,
				cross_resource: cross_resource,
				source_context_token: source_context_token,
				booking_id: registration.booking_id,
				primary_resource_id: normalize_positive_integer( movement.primary_resource_id ),
				proposal_revision: normalize_positive_integer( movement.proposal_revision ),
				selection_method: selection_method,
				time_application: time_application,
				selected_dates: Object.freeze( selected_dates ),
				exact_intervals: Object.freeze( exact_intervals )
			};
		}

		/**
		 * Normalize an authoritative resize-context response.
		 *
		 * @param {Object} response AJAX response envelope.
		 * @param {Object} registration Requested canonical registration.
		 * @return {Object|null} Normalized boundary eligibility or null.
		 */
		function normalize_resize_response( response, registration ) {
			var resize = response && response.success && response.data ? response.data.resize_context : null;
			var boundaries = resize && resize.boundaries ? resize.boundaries : {};
			var fallback = resize && resize.fallback ? resize.fallback : {};
			var start = boundaries.start || {};
			var end = boundaries.end || {};
			var start_allowed = true === start.eligible && 'resize_start' === String( start.operation || '' );
			var end_allowed = true === end.eligible && 'resize_end' === String( end.operation || '' );
			var source_context_token = String( resize && resize.source_context_token || '' );
			var saved_shape = String( resize && resize.saved_shape || '' );
			var affected_intervals = [];
			var immutable_interval = null;
			var anchor_interval_index = -1;

			if (
				! resize
				|| Number( resize.schema_version ) !== Number( transport.resize && transport.resize.schema_version )
				|| Number( resize.booking_id ) !== registration.booking_id
				|| ! normalize_positive_integer( resize.target_resource_id )
				|| 'resize' !== String( resize.interaction_source || '' )
				|| 'boolean' !== typeof resize.eligible
			) {
				return null;
			}
			if ( ( true === resize.eligible || start_allowed || end_allowed ) && ! source_context_token ) {
				return null;
			}
			if ( false === resize.eligible && ( start_allowed || end_allowed ) ) {
				return null;
			}
			if ( false === resize.eligible ) {
				return {
					allowed: false,
					start: false,
					end: false,
					fallback_reason: String( fallback.reason || '' ),
					source_context_token: ''
				};
			}

			if (
				-1 === supported_timed_resize_shapes.indexOf( saved_shape )
				&& ( ! full_day_resize_enabled || -1 === supported_full_day_resize_shapes.indexOf( saved_shape ) )
			) {
				return {
					allowed: false,
					start: false,
					end: false,
					fallback_reason: 'full_reschedule',
					source_context_token: ''
				};
			}
			affected_intervals = Array.isArray( resize.affected_intervals ) ? resize.affected_intervals.map( function ( interval ) {
				var normalized = {
					start: String( interval && interval.start || '' ),
					end: String( interval && interval.end || '' )
				};

				return exact_instant_pattern.test( normalized.start )
					&& exact_instant_pattern.test( normalized.end )
					&& Date.parse( normalized.end ) > Date.parse( normalized.start )
					? Object.freeze( normalized )
					: null;
			} ).filter( Boolean ) : [];
			immutable_interval = resize.immutable_interval ? {
				start: String( resize.immutable_interval.start || '' ),
				end: String( resize.immutable_interval.end || '' )
			} : null;
			if (
				! source_context_token
				|| ! normalize_positive_integer( resize.proposal_revision )
				|| ! immutable_interval
				|| ! exact_instant_pattern.test( immutable_interval.start )
				|| ! exact_instant_pattern.test( immutable_interval.end )
				|| Date.parse( immutable_interval.end ) <= Date.parse( immutable_interval.start )
				|| ! affected_intervals.length
				|| affected_intervals.length !== Number( resize.affected_interval_count )
			) {
				return null;
			}
			affected_intervals.some( function ( interval, index ) {
				if ( interval.start === immutable_interval.start && interval.end === immutable_interval.end ) {
					anchor_interval_index = index;
					return true;
				}

				return false;
			} );
			if ( -1 === anchor_interval_index || ( ! start_allowed && ! end_allowed ) ) {
				return null;
			}

			return {
				allowed: true,
				start: start_allowed,
				end: end_allowed,
				booking_id: registration.booking_id,
				target_resource_id: normalize_positive_integer( resize.target_resource_id ),
				saved_shape: saved_shape,
				resize_scope: String( resize.resize_scope || '' ),
				proposal_revision: normalize_positive_integer( resize.proposal_revision ),
				source_context_token: source_context_token,
				immutable_interval: Object.freeze( immutable_interval ),
				affected_intervals: Object.freeze( affected_intervals ),
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
		function is_registration_current( registration ) {
			var live_context = registration ? get_live_interaction_context( registration.resource_id ) : null;

			return Boolean(
				registration
				&& registration.card
				&& registration.card.isConnected
				&& registration.identity_key === refresh_identity_by_resource[ registration.resource_id ]
				&& registration.identity_key === build_accepted_identity_key( live_context, selection_step_minutes )
			);
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
		function create_control_host( registration ) {
			var host;

			if ( ! registration.card || ! registration.card.appendChild || registration.is_overflowed ) {
				return null;
			}
			host = document.createElement( 'span' );
			host.className = 'wpbc_timeline_time_rows_movement__host is-' + registration.interaction_axis;
			host.setAttribute( 'data-wpbc-timeline-time-rows-movement-host', '' );
			registration.card.appendChild( host );

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
		function render_template( host, template_slot, model ) {
			var template = get_template( template_slot );

			if ( ! host || ! template ) {
				return false;
			}
			host.insertAdjacentHTML( 'beforeend', template( model || {} ) );

			return true;
		}

		/**
		 * Return all live fragments resolved to one canonical accepted segment.
		 *
		 * @param {string} canonical_key Accepted canonical cache key.
		 * @return {Array<Object>} Current canonical registrations.
		 */
		function get_canonical_registrations( canonical_key ) {
			return Object.keys( registrations_by_render_id ).map( function ( render_id ) {
				return registrations_by_render_id[ render_id ];
			} ).filter( function ( registration ) {
				return registration.canonical_key === canonical_key && is_registration_current( registration );
			} );
		}

		/**
		 * Measure logical date columns for one gesture-owned geometry snapshot.
		 *
		 * @param {Element} surface   Expanded all-day or timed surface.
		 * @param {string}  direction ltr or rtl.
		 * @return {Array<Object>} Ordered logical column DTOs.
		 */
		function measure_date_columns( surface, direction ) {
			var surface_rect = surface.getBoundingClientRect();

			return Array.prototype.map.call( surface.querySelectorAll( date_column_selector ), function ( column ) {
				var column_rect = column.getBoundingClientRect();

				return {
					date: String( column.getAttribute( 'data-wpbc-timeline-time-rows-date' ) || '' ),
					logical_start: Math.max( 0, 'rtl' === direction ? surface_rect.right - column_rect.right : column_rect.left - surface_rect.left ),
					logical_end: Math.max( 0, 'rtl' === direction ? surface_rect.right - column_rect.left : column_rect.right - surface_rect.left )
				};
			} );
		}

		/**
		 * Prepare one immutable accepted and measured surface snapshot.
		 *
		 * @param {number} resource_id Authorized open Resource ID.
		 * @param {Element} surface Expanded all-day or timed surface.
		 * @param {string} interaction_axis horizontal or vertical.
		 * @return {Object|null} Gesture context or null when identity is stale.
		 */
		function prepare_surface_context( resource_id, surface, interaction_axis ) {
			var accepted_context = get_live_interaction_context( resource_id );
			var direction;
			var surface_style;
			var surface_rect;
			var booking_column_gutter_px;
			var prepared;
			var identity_key;

			if (
				! surface
				|| ! accepted_context
				|| ! geometry
				|| 'function' !== typeof geometry.prepare_geometry
				|| ! Number.isInteger( selection_step_minutes )
				|| 1 > selection_step_minutes
			) {
				return null;
			}
			identity_key = build_accepted_identity_key( accepted_context, selection_step_minutes );
			if ( ! identity_key || identity_key !== refresh_identity_by_resource[ resource_id ] ) {
				return null;
			}
			surface_style = window.getComputedStyle( surface );
			direction = 'rtl' === surface_style.direction ? 'rtl' : 'ltr';
			booking_column_gutter_px = parseFloat( surface_style.getPropertyValue( '--wpbc-time-rows-booking-column-gutter' ) );
			booking_column_gutter_px = Number.isFinite( booking_column_gutter_px ) ? Math.max( 0, booking_column_gutter_px ) : 0;
			surface_rect = surface.getBoundingClientRect();
			prepared = geometry.prepare_geometry( {
				accepted_identity: accepted_context.accepted_identity,
				date_bands: accepted_context.date_bands,
				date_columns: measure_date_columns( surface, direction ),
				visible_range: accepted_context.visible_range,
				zoom_percent: accepted_context.zoom_percent,
				hour_height_px: accepted_context.hour_height_px,
				block_extent_px: surface_rect.height,
				selection_step_minutes: selection_step_minutes,
				direction: direction
			} );
			if ( ! prepared || 'ready' !== prepared.status ) {
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
		function prepare_gesture_context( registration ) {
			var surface = registration && registration.card && registration.card.closest
				? registration.card.closest( 'vertical' === registration.interaction_axis ? timed_surface_selector : all_day_surface_selector )
				: null;

			if ( ! registration || ! surface || ! is_registration_current( registration ) ) {
				return null;
			}

			return prepare_surface_context( registration.resource_id, surface, registration.interaction_axis );
		}

		/**
		 * Convert one pointer event to a pure geometry coordinate.
		 *
		 * @param {Object} gesture_context Frozen geometry context.
		 * @param {Object} event           Pointer-like event.
		 * @return {Object} Geometry coordinate DTO.
		 */
		function pointer_coordinate( gesture_context, event ) {
			var surface_rect = gesture_context.surface_rect;

			return {
				source: 'pointer',
				selection_kind: gesture_context.selection_kind,
				inline_px: Number( event.clientX ) - surface_rect.left,
				block_px: Number( event.clientY ) - surface_rect.top
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
		function timed_resize_pointer_coordinate( gesture, event ) {
			var snapshot = gesture.context.snapshot;
			var step_height = snapshot.selection_step_minutes * snapshot.pixels_per_minute;
			var pointer_delta = Number( event.clientY ) - gesture.pointer_start_client_y;
			var step_delta = 0 > pointer_delta
				? -Math.round( Math.abs( pointer_delta / step_height ) )
				: Math.round( pointer_delta / step_height );
			var minimum_step_delta = Math.ceil(
				( snapshot.visible_range.start_minute - gesture.origin.wall_minute ) / snapshot.selection_step_minutes
			);
			var maximum_step_delta = Math.floor(
				( snapshot.visible_range.end_minute - gesture.origin.wall_minute ) / snapshot.selection_step_minutes
			);

			step_delta = Math.max( minimum_step_delta, Math.min( maximum_step_delta, step_delta ) );

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
		function is_gesture_context_current( gesture_context ) {
			var accepted_context = gesture_context ? get_live_interaction_context( gesture_context.resource_id ) : null;

			return Boolean(
				gesture_context
				&& gesture_context.surface
				&& gesture_context.surface.isConnected
				&& gesture_context.identity_key === refresh_identity_by_resource[ gesture_context.resource_id ]
				&& gesture_context.identity_key === build_accepted_identity_key( accepted_context, selection_step_minutes )
			);
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
		function resolve_pointer_movement_target( gesture, event ) {
			var selector = 'vertical' === gesture.registration.interaction_axis ? timed_surface_selector : all_day_surface_selector;
			var client_x = Number( event.clientX );
			var client_y = Number( event.clientY );
			var point_target = document && 'function' === typeof document.elementFromPoint
				? document.elementFromPoint( client_x, client_y )
				: null;
			var matched_surface = null;
			var surfaces;
			var panel;
			var resource_id;
			var is_cross_resource;
			var target_context;

			matched_surface = point_target && point_target.closest ? point_target.closest( selector ) : null;
			if ( matched_surface && mount && 'function' === typeof mount.contains && ! mount.contains( matched_surface ) ) {
				matched_surface = null;
			}
			if ( ! matched_surface && ! point_target ) {
				surfaces = mount && mount.querySelectorAll ? mount.querySelectorAll( selector ) : [];
				Array.prototype.some.call( surfaces, function ( surface ) {
					var rectangle = surface.getBoundingClientRect();

					if (
						client_x < rectangle.left
						|| client_x > rectangle.right
						|| client_y < rectangle.top
						|| client_y > rectangle.bottom
					) {
						return false;
					}
					matched_surface = surface;

					return true;
				} );
			}
			if ( ! matched_surface ) {
				return null;
			}
			panel = matched_surface.closest ? matched_surface.closest( time_rows_panel_selector ) : null;
			resource_id = normalize_positive_integer( panel && panel.getAttribute( 'data-wpbc-timeline-time-rows-resource-id' ) );
			is_cross_resource = resource_id && resource_id !== gesture.registration.resource_id;
			if (
				! resource_id
				|| ( ! is_cross_resource && ! gesture.eligibility.movement.same_resource )
				|| (
					is_cross_resource
					&& ( ! cross_resource_movement_enabled || ! gesture.eligibility.movement.cross_resource )
				)
			) {
				return null;
			}
			gesture.target_contexts = gesture.target_contexts || Object.create( null );
			target_context = gesture.target_contexts[ resource_id ];
			if ( ! target_context || target_context.surface !== matched_surface || ! is_gesture_context_current( target_context ) ) {
				target_context = prepare_surface_context( resource_id, matched_surface, gesture.registration.interaction_axis );
				if ( ! target_context ) {
					return null;
				}
				gesture.target_contexts[ resource_id ] = target_context;
			}

			return {
				context: target_context,
				resource_id: resource_id,
				is_cross_resource: is_cross_resource,
				coordinate: pointer_coordinate( target_context, event )
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
		function keyboard_coordinate( snapshot, selection_kind, date, snap_index ) {
			var maximum_index = 'all_day' === selection_kind
				? 0
				: Math.max( 0, Math.ceil( ( snapshot.visible_range.end_minute - snapshot.visible_range.start_minute ) / snapshot.selection_step_minutes ) - 1 );

			return {
				source: 'keyboard',
				selection_kind: selection_kind,
				date: String( date || '' ),
				snap_index: Math.max( 0, Math.min( maximum_index, Number( snap_index ) || 0 ) )
			};
		}

		/**
		 * Shift one strict ISO date by whole calendar days without local timezone use.
		 *
		 * @param {string} value ISO date.
		 * @param {number} days  Signed calendar-day count.
		 * @return {string} Shifted date or an empty string.
		 */
		function shift_date( value, days ) {
			var match = String( value || '' ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var shifted;

			if ( ! match || ! Number.isInteger( days ) ) {
				return '';
			}
			shifted = new Date( Date.UTC( Number( match[ 1 ] ), Number( match[ 2 ] ) - 1, Number( match[ 3 ] ) + days ) );

			return shifted.toISOString().slice( 0, 10 );
		}

		/**
		 * Calculate a civil calendar-day delta without browser-local timezone use.
		 *
		 * @param {string} start_date ISO source date.
		 * @param {string} end_date ISO target date.
		 * @return {number|null} Signed whole-day delta, or null for malformed dates.
		 */
		function calendar_day_delta( start_date, end_date ) {
			var start_match = String( start_date || '' ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var end_match = String( end_date || '' ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var start_epoch;
			var end_epoch;

			if ( ! start_match || ! end_match ) {
				return null;
			}
			start_epoch = Date.UTC( Number( start_match[ 1 ] ), Number( start_match[ 2 ] ) - 1, Number( start_match[ 3 ] ) );
			end_epoch = Date.UTC( Number( end_match[ 1 ] ), Number( end_match[ 2 ] ) - 1, Number( end_match[ 3 ] ) );

			return Math.round( ( end_epoch - start_epoch ) / 86400000 );
		}

		/**
		 * Resolve one full-day source boundary through accepted server date bands.
		 *
		 * @param {Object} snapshot Prepared immutable geometry snapshot.
		 * @param {string} instant Exact offset-qualified canonical instant.
		 * @param {string} operation resize_start or resize_end.
		 * @return {Object|null} Exact boundary result or null outside coverage.
		 */
		function resolve_full_day_instant_boundary( snapshot, instant, operation ) {
			var exact_epoch = Date.parse( instant ) / 1000;
			var date_band = null;

			if ( ! Number.isFinite( exact_epoch ) ) {
				return null;
			}
			snapshot.date_bands.some( function ( candidate ) {
				var matches = 'resize_end' === operation
					? candidate.end_epoch === exact_epoch
					: candidate.start_epoch === exact_epoch;

				if ( matches ) {
					date_band = candidate;
				}

				return matches;
			} );
			if ( ! date_band ) {
				return null;
			}

			return {
				status: 'exact',
				date: date_band.date,
				wall_minute: 'resize_end' === operation ? 1440 : 0,
				snap_index: 0,
				epoch: exact_epoch,
				exact_at: String( instant ),
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
		function resolve_full_day_target_boundary( snapshot, resolved, operation ) {
			var date_band = resolved && snapshot.bands_by_date[ resolved.date ];

			if ( ! date_band || 'exact' !== resolved.status ) {
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
		function format_instant( epoch_seconds, timezone ) {
			var values = {};
			var formatter;
			var represented;
			var offset_minutes;
			var sign;
			var pad = function ( value, length ) {
				return String( Math.abs( Math.round( value ) ) ).padStart( length, '0' );
			};

			try {
				formatter = new window.Intl.DateTimeFormat( 'en-US', {
					timeZone: timezone,
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					hourCycle: 'h23',
					minute: '2-digit',
					second: '2-digit'
				} );
				formatter.formatToParts( new Date( epoch_seconds * 1000 ) ).forEach( function ( part ) {
					if ( 'literal' !== part.type ) {
						values[ part.type ] = Number( part.value );
					}
				} );
			} catch ( error ) {
				return '';
			}
			if ( ! values.year ) {
				return '';
			}
			represented = Date.UTC( values.year, values.month - 1, values.day, values.hour, values.minute, values.second ) / 1000;
			offset_minutes = Math.round( ( represented - epoch_seconds ) / 60 );
			sign = 0 <= offset_minutes ? '+' : '-';

			return pad( values.year, 4 ) + '-' + pad( values.month, 2 ) + '-' + pad( values.day, 2 )
				+ 'T' + pad( values.hour, 2 ) + ':' + pad( values.minute, 2 ) + ':00'
				+ sign + pad( Math.floor( Math.abs( offset_minutes ) / 60 ), 2 ) + ':' + pad( Math.abs( offset_minutes ) % 60, 2 );
		}

		/**
		 * Build one same-Resource `drag + shift` proposal from exact cells.
		 *
		 * @param {Object} gesture Active gesture state.
		 * @return {Object|null} Executable-free proposal or null for no movement.
		 */
		function build_movement_proposal( gesture ) {
			var movement = gesture.eligibility.movement;
			var origin = gesture.origin;
			var current = gesture.current;
			var date_delta = calendar_day_delta( origin.date, current.date );
			var instant_delta = Number( current.epoch ) - Number( origin.epoch );
			var target_surface_resource_id = normalize_positive_integer( gesture.target_resource_id ) || gesture.registration.resource_id;
			var is_cross_resource = target_surface_resource_id !== gesture.registration.resource_id;
			var target_resource_id = is_cross_resource ? target_surface_resource_id : movement.primary_resource_id;
			var proposal = {
				schema_version: Number( movement.review_schema_version || configuration.review_schema_version || 1 ),
				booking_id: movement.booking_id,
				interaction_source: is_cross_resource ? 'cross_resource_drag' : 'drag',
				operation: is_cross_resource ? 'change_resource' : 'shift',
				target_resource_id: target_resource_id,
				selection_method: movement.selection_method,
				proposal_revision: movement.proposal_revision,
				source_context_token: movement.source_context_token
			};

			if (
				( is_cross_resource && ( ! cross_resource_movement_enabled || ! movement.cross_resource ) )
				|| ( ! is_cross_resource && ! movement.same_resource )
			) {
				return null;
			}
			if ( 'full_day' === movement.time_application ) {
				if ( ! full_day_movement_enabled || null === date_delta || ( ! date_delta && ! is_cross_resource ) ) {
					return null;
				}
				proposal.proposed_dates = movement.selected_dates.map( function ( date ) {
					return shift_date( date, date_delta );
				} );

				return proposal.proposed_dates.every( Boolean ) ? Object.freeze( proposal ) : null;
			}
			if ( ! instant_delta && ! is_cross_resource ) {
				return null;
			}
			proposal.proposed_intervals = movement.exact_intervals.map( function ( interval ) {
				var start_epoch = Date.parse( interval.start ) / 1000 + instant_delta;
				var end_epoch = Date.parse( interval.end ) / 1000 + instant_delta;

				return Object.freeze( {
					start: format_instant( start_epoch, gesture.context.snapshot.accepted_identity.timezone ),
					end: format_instant( end_epoch, gesture.context.snapshot.accepted_identity.timezone )
				} );
			} );

			return proposal.proposed_intervals.every( function ( interval ) {
				return exact_instant_pattern.test( interval.start )
					&& exact_instant_pattern.test( interval.end )
					&& Date.parse( interval.end ) - Date.parse( interval.start ) > 0;
			} ) ? Object.freeze( proposal ) : null;
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
		function resolve_instant_boundary( snapshot, instant ) {
			var match = String( instant || '' ).match( /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00/ );
			var wall_minute = match ? Number( match[ 2 ] ) * 60 + Number( match[ 3 ] ) : -1;
			var resolved;
			var exact_epoch = Date.parse( instant ) / 1000;

			if (
				! match
				|| ! Number.isFinite( exact_epoch )
				|| ! snapshot.bands_by_date[ match[ 1 ] ]
				|| wall_minute < snapshot.visible_range.start_minute
				|| wall_minute > snapshot.visible_range.end_minute
				|| ! geometry
				|| 'function' !== typeof geometry.resolve_wall_time
			) {
				return null;
			}
			resolved = geometry.resolve_wall_time( snapshot, match[ 1 ], wall_minute, '' );
			if ( resolved && 'fold' === resolved.status ) {
				resolved.candidates.some( function ( candidate ) {
					if ( Number( candidate.epoch ) === exact_epoch ) {
						resolved = geometry.resolve_wall_time( snapshot, match[ 1 ], wall_minute, candidate.occurrence_id );
						return true;
					}

					return false;
				} );
			}

			return resolved && 'exact' === resolved.status && Number( resolved.epoch ) === exact_epoch ? resolved : null;
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
		function build_resize_projection( gesture ) {
			var resize = gesture.eligibility.resize;
			var operation = gesture.operation;
			var immutable_start = Date.parse( resize.immutable_interval.start ) / 1000;
			var immutable_end = Date.parse( resize.immutable_interval.end ) / 1000;
			var source_boundary = 'resize_start' === operation ? immutable_start : immutable_end;
			var delta = Number( gesture.current.epoch ) - source_boundary;
			var is_full_day = -1 !== supported_full_day_resize_shapes.indexOf( resize.saved_shape );
			var minimum_duration = is_full_day ? 1 : selection_step_minutes * 60;
			var intervals;
			var anchor;
			var anchor_start;
			var anchor_end;

			if ( ! delta || -1 === [ 'resize_start', 'resize_end' ].indexOf( operation ) ) {
				return null;
			}
			intervals = resize.affected_intervals.map( function ( interval ) {
				var start_epoch = Date.parse( interval.start ) / 1000;
				var end_epoch = Date.parse( interval.end ) / 1000;

				return Object.freeze( {
					start_epoch: 'resize_start' === operation ? start_epoch + delta : start_epoch,
					end_epoch: 'resize_end' === operation ? end_epoch + delta : end_epoch
				} );
			} );
			if ( intervals.some( function ( interval ) {
				return interval.end_epoch - interval.start_epoch < minimum_duration;
			} ) ) {
				return null;
			}
			anchor = intervals[ resize.anchor_interval_index ];
			if ( ! anchor ) {
				return null;
			}
			anchor_start = 'resize_start' === operation ? String( gesture.current.exact_at || '' ) : resize.immutable_interval.start;
			anchor_end = 'resize_end' === operation ? String( gesture.current.exact_at || '' ) : resize.immutable_interval.end;
			if (
				! exact_instant_pattern.test( anchor_start )
				|| ! exact_instant_pattern.test( anchor_end )
				|| Date.parse( anchor_end ) - Date.parse( anchor_start ) < minimum_duration * 1000
			) {
				return null;
			}

			return {
				intervals: Object.freeze( intervals ),
				proposal: Object.freeze( {
					schema_version: Number( configuration.review_schema_version || 1 ),
					booking_id: resize.booking_id,
					interaction_source: 'resize',
					operation: operation,
					target_resource_id: resize.target_resource_id,
					selection_method: resize.selection_method,
					proposed_intervals: Object.freeze( [ Object.freeze( {
						start: anchor_start,
						end: anchor_end
					} ) ] ),
					proposal_revision: resize.proposal_revision,
					source_context_token: resize.source_context_token
				} )
			};
		}

		/**
		 * Format resize duration in the same compound units as native Timeline.
		 *
		 * @param {number} seconds Positive elapsed seconds.
		 * @return {string} Localized presentation-only duration.
		 */
		function format_resize_duration( seconds ) {
			var minutes = Math.max( 0, Math.round( Number( seconds ) / 60 ) );
			var days = Math.floor( minutes / 1440 );
			var hours = Math.floor( ( minutes % 1440 ) / 60 );
			var remaining_minutes = minutes % 60;
			var parts = [];

			if ( days ) {
				parts.push( String( 1 === days
					? ( i18n.resize_duration_day || '%s day' )
					: ( i18n.resize_duration_days || '%s days' ) ).replace( '%s', days ) );
			}
			if ( hours ) {
				parts.push( String( 1 === hours
					? ( i18n.resize_duration_hour || '%s hour' )
					: ( i18n.resize_duration_hours || '%s hours' ) ).replace( '%s', hours ) );
			}
			if ( remaining_minutes || ! parts.length ) {
				parts.push( String( 1 === remaining_minutes
					? ( i18n.resize_duration_minute || '%s minute' )
					: ( i18n.resize_duration_minutes || '%s minutes' ) ).replace( '%s', remaining_minutes ) );
			}

			return parts.join( ' ' );
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
		function format_resize_visible_endpoint( epoch_seconds, timezone ) {
			var instant = format_instant( epoch_seconds, timezone );
			var match = instant.match( /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):00[+-]\d{2}:\d{2}$/ );

			return match ? match[ 1 ] + ' ' + match[ 2 ] : instant;
		}

		/**
		 * Build separate presentation labels without changing exact proposal data.
		 *
		 * @param {Object} interval Accepted local resize projection interval.
		 * @param {Object} snapshot Prepared accepted geometry snapshot.
		 * @return {Object} Visible start, end, and elapsed-duration labels.
		 */
		function build_resize_range_labels( interval, snapshot ) {
			var timezone = snapshot && snapshot.accepted_identity ? snapshot.accepted_identity.timezone : '';

			return {
				start: format_resize_visible_endpoint( interval.start_epoch, timezone ),
				end: format_resize_visible_endpoint( interval.end_epoch, timezone ),
				duration: format_resize_duration( interval.end_epoch - interval.start_epoch )
			};
		}

		/**
		 * Convert one exact epoch to bounded logical Time Rows geometry.
		 *
		 * @param {Object} snapshot Prepared geometry snapshot.
		 * @param {number} epoch    Exact epoch seconds.
		 * @return {Object|null} Date-column and block-axis point, or null.
		 */
		function get_resize_visual_point( snapshot, epoch ) {
			var instant = format_instant( epoch, snapshot.accepted_identity.timezone );
			var match = instant.match( /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00/ );
			var column = match && snapshot.date_columns[ snapshot.date_order[ match[ 1 ] ] ];
			var wall_minute = match ? Number( match[ 2 ] ) * 60 + Number( match[ 3 ] ) : 0;

			if ( ! column ) {
				return null;
			}

			return {
				date: match[ 1 ],
				left: 'rtl' === snapshot.direction ? snapshot.inline_extent - column.logical_end : column.logical_start,
				width: column.logical_end - column.logical_start,
				top: ( wall_minute - snapshot.visible_range.start_minute ) * snapshot.pixels_per_minute
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
		function get_timed_resize_visual_fragments( snapshot, start_epoch, end_epoch ) {
			var timezone = snapshot.accepted_identity.timezone;
			var date_bands = snapshot.date_bands;
			var fragments = [];
			var low = 0;
			var high = date_bands.length;
			var middle;
			var band_index;

			/* Skip non-intersecting earlier windows without scanning every band. */
			while ( low < high ) {
				middle = Math.floor( ( low + high ) / 2 );
				if ( Number( date_bands[ middle ].end_epoch ) <= start_epoch ) {
					low = middle + 1;
				} else {
					high = middle;
				}
			}

			for ( band_index = low; band_index < date_bands.length; band_index++ ) {
				var date_band = date_bands[ band_index ];
				var segment_start_epoch = Math.max( start_epoch, Number( date_band.start_epoch ) );
				var segment_end_epoch = Math.min( end_epoch, Number( date_band.end_epoch ) );
				var column = snapshot.date_columns[ snapshot.date_order[ date_band.date ] ];
				var start_match;
				var end_match;
				var start_wall_minute;
				var end_wall_minute;
				var visible_start_minute;
				var visible_end_minute;
				var left;

				if ( Number( date_band.start_epoch ) >= end_epoch ) {
					break;
				}
				if ( ! column || segment_end_epoch <= segment_start_epoch ) {
					continue;
				}
				start_match = format_instant( segment_start_epoch, timezone ).match( /T(\d{2}):(\d{2}):00/ );
				end_match = format_instant( segment_end_epoch, timezone ).match( /T(\d{2}):(\d{2}):00/ );
				start_wall_minute = segment_start_epoch === Number( date_band.start_epoch )
					? 0
					: ( start_match ? Number( start_match[ 1 ] ) * 60 + Number( start_match[ 2 ] ) : -1 );
				end_wall_minute = segment_end_epoch === Number( date_band.end_epoch )
					? 1440
					: ( end_match ? Number( end_match[ 1 ] ) * 60 + Number( end_match[ 2 ] ) : -1 );
				visible_start_minute = Math.max( start_wall_minute, snapshot.visible_range.start_minute );
				visible_end_minute = Math.min( end_wall_minute, snapshot.visible_range.end_minute );
				if ( 0 > start_wall_minute || 0 > end_wall_minute || visible_end_minute <= visible_start_minute ) {
					continue;
				}
				left = 'rtl' === snapshot.direction
					? snapshot.inline_extent - column.logical_end
					: column.logical_start;

				fragments.push( {
					date: date_band.date,
					left: left,
					width: column.logical_end - column.logical_start,
					top: ( visible_start_minute - snapshot.visible_range.start_minute ) * snapshot.pixels_per_minute,
					height: ( visible_end_minute - visible_start_minute ) * snapshot.pixels_per_minute,
					start_boundary_visible: start_epoch >= Number( date_band.start_epoch )
						&& start_epoch < Number( date_band.end_epoch )
						&& start_wall_minute >= snapshot.visible_range.start_minute
						&& start_wall_minute < snapshot.visible_range.end_minute,
					end_boundary_visible: end_epoch > Number( date_band.start_epoch )
						&& end_epoch <= Number( date_band.end_epoch )
						&& end_wall_minute > snapshot.visible_range.start_minute
						&& end_wall_minute <= snapshot.visible_range.end_minute
				} );
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
		function get_full_day_visual_range( snapshot, start_epoch, end_epoch ) {
			var visible_bands = snapshot.date_bands.filter( function ( date_band ) {
				return date_band.end_epoch > start_epoch && date_band.start_epoch < end_epoch;
			} );
			var left = Number.POSITIVE_INFINITY;
			var right = Number.NEGATIVE_INFINITY;

			visible_bands.forEach( function ( date_band ) {
				var column = snapshot.date_columns[ snapshot.date_order[ date_band.date ] ];
				var physical_left;
				var physical_right;

				if ( ! column ) {
					return;
				}
				physical_left = 'rtl' === snapshot.direction ? snapshot.inline_extent - column.logical_end : column.logical_start;
				physical_right = physical_left + column.logical_end - column.logical_start;
				left = Math.min( left, physical_left );
				right = Math.max( right, physical_right );
			} );

			return visible_bands.length && Number.isFinite( left ) && Number.isFinite( right )
				? { left: left, right: right, day_count: visible_bands.length }
				: null;
		}

		/**
		 * Count whole local calendar days without assuming every day is 24 hours.
		 *
		 * @param {Object} snapshot Prepared server-timezone geometry.
		 * @param {number} start_epoch Inclusive start epoch.
		 * @param {number} end_epoch Exclusive end epoch.
		 * @return {number} Positive civil-day count, or zero for invalid input.
		 */
		function get_full_day_interval_count( snapshot, start_epoch, end_epoch ) {
			var timezone = snapshot && snapshot.accepted_identity ? snapshot.accepted_identity.timezone : '';
			var start_date = format_instant( start_epoch, timezone ).slice( 0, 10 );
			var end_date = format_instant( end_epoch, timezone ).slice( 0, 10 );
			var day_count = calendar_day_delta( start_date, end_date );

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
		function render_resize_ghosts( gesture, resize_projection ) {
			var renderer = get_template( 'ghost' );
			var snapshot = gesture.context.snapshot;
			var occurrence_count = resize_projection.intervals.length;
			var is_full_day = 'all_day' === gesture.context.selection_kind;
			var booking_column_gutter_px = is_full_day ? 0 : Math.max( 0, Number( gesture.context.booking_column_gutter_px ) || 0 );
			var presentations = [];

			if ( ! renderer ) {
				return;
			}
			gesture.ghosts = gesture.ghosts || [];
			resize_projection.intervals.forEach( function ( interval ) {
				var full_day_range = is_full_day ? get_full_day_visual_range( snapshot, interval.start_epoch, interval.end_epoch ) : null;
				var timed_fragments = is_full_day ? [] : get_timed_resize_visual_fragments( snapshot, interval.start_epoch, interval.end_epoch );
				var labels;
				var largest_height;
				var duration_index;
				var start_index;
				var end_index;

				labels = is_full_day
					? { start: '', end: '', duration: String( i18n.resize_duration_days || '%s days' ).replace( '%s', get_full_day_interval_count( snapshot, interval.start_epoch, interval.end_epoch ) ) }
					: build_resize_range_labels( interval, snapshot );
				if ( 1 < occurrence_count ) {
					labels.duration += ' ' + String( i18n.resize_group || '%s occurrences' ).replace( '%s', occurrence_count );
				}
				if ( is_full_day ) {
					if ( full_day_range ) {
						presentations.push( {
							left: full_day_range.left,
							top: Math.max( 0, gesture.card_rect.top - gesture.context.surface.getBoundingClientRect().top ),
							width: full_day_range.right - full_day_range.left,
							height: gesture.card_rect.height,
							start_label: '',
							duration_label: labels.duration,
							end_label: '',
							active_boundary: ''
						} );
					}
					return;
				}
				start_index = timed_fragments.findIndex( function ( candidate ) {
					return candidate.start_boundary_visible;
				} );
				end_index = timed_fragments.findIndex( function ( candidate ) {
					return candidate.end_boundary_visible;
				} );
				largest_height = timed_fragments.length ? Math.max.apply( null, timed_fragments.map( function ( candidate ) {
					return candidate.height;
				} ) ) : 0;
				duration_index = timed_fragments.findIndex( function ( candidate ) {
					return candidate.height === largest_height;
				} );

				timed_fragments.forEach( function ( fragment, fragment_index ) {
					var column_gutter = Math.min( booking_column_gutter_px, Math.max( 0, ( fragment.width - 2 ) / 2 ) );
					var active_boundary = 'resize_start' === gesture.operation && fragment.start_boundary_visible
						? 'start'
						: ( 'resize_end' === gesture.operation && fragment.end_boundary_visible ? 'end' : '' );

					presentations.push( {
						left: fragment.left + column_gutter,
						top: fragment.top,
						width: Math.max( 2, fragment.width - column_gutter * 2 ),
						height: fragment.height,
						start_label: fragment_index === start_index ? labels.start : '',
						duration_label: fragment_index === duration_index ? labels.duration : '',
						end_label: fragment_index === end_index ? labels.end : '',
						active_boundary: active_boundary
					} );
				} );
			} );
			presentations.forEach( function ( presentation, index ) {
				var model_key = presentation.active_boundary
					+ '|' + ( presentation.start_label ? 'start' : '' )
					+ '|' + ( presentation.duration_label ? 'duration' : '' )
					+ '|' + ( presentation.end_label ? 'end' : '' );
				var ghost = gesture.ghosts[ index ];
				var buffer;
				var start_label_element;
				var duration_label_element;
				var end_label_element;

				if ( ! ghost || ghost.wpbc_model_key !== model_key ) {
					if ( ghost ) {
						ghost.remove();
					}
					buffer = document.createElement( 'span' );
					buffer.innerHTML = renderer( {
						start_label: presentation.start_label,
						duration_label: presentation.duration_label,
						end_label: presentation.end_label,
						show_start: 'start' === presentation.active_boundary,
						show_end: 'end' === presentation.active_boundary
					} );
					ghost = buffer.firstElementChild;
					if ( ! ghost ) {
						return;
					}
					ghost.classList.add( 'is-resize' );
					ghost.wpbc_model_key = model_key;
					gesture.context.surface.appendChild( ghost );
					gesture.ghosts[ index ] = ghost;
				}
				start_label_element = ghost.querySelector ? ghost.querySelector( '[data-wpbc-timeline-time-rows-resize-start-label]' ) : null;
				duration_label_element = ghost.querySelector ? ghost.querySelector( '[data-wpbc-timeline-time-rows-resize-duration]' ) : null;
				end_label_element = ghost.querySelector ? ghost.querySelector( '[data-wpbc-timeline-time-rows-resize-end-label]' ) : null;
				if ( start_label_element ) {
					start_label_element.textContent = presentation.start_label;
				}
				if ( duration_label_element ) {
					duration_label_element.textContent = presentation.duration_label;
				}
				if ( end_label_element ) {
					end_label_element.textContent = presentation.end_label;
				}
				ghost.style.left = Math.max( 0, presentation.left ) + 'px';
				ghost.style.top = Math.max( 0, presentation.top ) + 'px';
				ghost.style.width = Math.max( 2, Math.min( snapshot.inline_extent - Math.max( 0, presentation.left ), presentation.width ) ) + 'px';
				ghost.style.height = Math.max( 2, Math.min( snapshot.block_extent_px - Math.max( 0, presentation.top ), presentation.height ) ) + 'px';
			} );
			while ( gesture.ghosts.length > presentations.length ) {
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
		function announce_gesture( gesture, message ) {
			var status = gesture && gesture.registration && gesture.registration.card
				? gesture.registration.card.querySelector( '[data-wpbc-timeline-time-rows-movement-status]' )
				: null;

			if ( status ) {
				status.textContent = String( message || '' );
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
		function set_gesture_target_surface( gesture, surface, is_cross_resource ) {
			if ( gesture.target_surface && gesture.target_surface.classList ) {
				gesture.target_surface.classList.remove( 'is-time-rows-movement-target' );
			}
			gesture.target_surface = surface || null;
			if ( is_cross_resource && surface && surface.classList ) {
				surface.classList.add( 'is-time-rows-movement-target' );
			}
		}

		/**
		 * Resolve the visual translation between two geometry cells.
		 *
		 * @param {Object} gesture Active gesture state.
		 * @return {Object} Physical inline and block deltas.
		 */
		function get_visual_delta( gesture ) {
			var origin_snapshot = gesture.context.snapshot;
			var current_snapshot = gesture.current_context ? gesture.current_context.snapshot : origin_snapshot;
			var origin_column = origin_snapshot.date_columns[ origin_snapshot.date_order[ gesture.origin.date ] ];
			var current_column = current_snapshot.date_columns[ current_snapshot.date_order[ gesture.current.date ] ];
			var logical_delta = current_column.logical_start - origin_column.logical_start;

			return {
				inline: 'rtl' === current_snapshot.direction ? -logical_delta : logical_delta,
				block: 'timed' === gesture.context.selection_kind
					? ( gesture.current.wall_minute - gesture.origin.wall_minute ) * current_snapshot.pixels_per_minute
					: 0
			};
		}

		/**
		 * Position one movement ghost inside a different authorized Resource.
		 *
		 * @param {Object} gesture Active cross-Resource movement gesture.
		 * @return {boolean} True when target geometry was available.
		 */
		function position_cross_resource_movement_ghost( gesture ) {
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

			if ( 'full_day' === movement.time_application ) {
				date_delta = calendar_day_delta( gesture.origin.date, gesture.current.date );
				shifted_dates = null === date_delta ? [] : movement.selected_dates.map( function ( date ) {
					return shift_date( date, date_delta );
				} );
				start_band = shifted_dates.length ? snapshot.bands_by_date[ shifted_dates[ 0 ] ] : null;
				end_band = shifted_dates.length ? snapshot.bands_by_date[ shifted_dates[ shifted_dates.length - 1 ] ] : null;
				full_day_range = start_band && end_band
					? get_full_day_visual_range( snapshot, start_band.start_epoch, end_band.end_epoch )
					: null;
				if ( ! full_day_range ) {
					return false;
				}
				gesture.ghost.style.left = full_day_range.left + 'px';
				gesture.ghost.style.top = Math.max( 0, gesture.card_rect.top - gesture.context.surface.getBoundingClientRect().top ) + 'px';
				gesture.ghost.style.width = Math.max( 2, full_day_range.right - full_day_range.left ) + 'px';
				gesture.ghost.style.height = gesture.card_rect.height + 'px';
				gesture.ghost.style.transform = 'none';

				return true;
			}
			point = get_resize_visual_point( snapshot, gesture.current.epoch );
			duration_seconds = movement.exact_intervals.length
				? ( Date.parse( movement.exact_intervals[ 0 ].end ) - Date.parse( movement.exact_intervals[ 0 ].start ) ) / 1000
				: 0;
			end_point = 0 < duration_seconds ? get_resize_visual_point( snapshot, gesture.current.epoch + duration_seconds ) : null;
			if ( ! point ) {
				return false;
			}
			gesture.ghost.style.left = point.left + 4 + 'px';
			gesture.ghost.style.top = Math.max( 0, point.top ) + 'px';
			gesture.ghost.style.width = Math.max( 2, point.width - 8 ) + 'px';
			gesture.ghost.style.height = end_point && end_point.date === point.date
				? Math.max( 2, end_point.top - point.top ) + 'px'
				: gesture.card_rect.height + 'px';
			gesture.ghost.style.transform = 'none';

			return true;
		}

		/**
		 * Render or update the presentation-only proposal ghost.
		 *
		 * @param {Object} gesture Active gesture state.
		 * @return {void}
		 */
		function render_gesture_ghost( gesture ) {
			var renderer = get_template( 'ghost' );
			var buffer;
			var delta;
			var time_label;
			var resize_projection;

			if ( ! renderer || ! gesture.current || 'exact' !== gesture.current.status ) {
				return;
			}
			if ( 'resize' === gesture.gesture_type ) {
				resize_projection = build_resize_projection( gesture );
				if ( resize_projection ) {
					gesture.resize_projection = resize_projection;
					render_resize_ghosts( gesture, resize_projection );
				}
				return;
			}
			if ( ! gesture.ghost ) {
				buffer = document.createElement( 'span' );
				time_label = String( gesture.current.date ) + ( 'timed' === gesture.context.selection_kind
					? ' ' + String( Math.floor( gesture.current.wall_minute / 60 ) ).padStart( 2, '0' ) + ':' + String( gesture.current.wall_minute % 60 ).padStart( 2, '0' )
					: '' );
				buffer.innerHTML = renderer( { label: time_label } );
				gesture.ghost = buffer.firstElementChild;
				if ( ! gesture.ghost ) {
					return;
				}
				gesture.ghost.style.left = gesture.card_rect.left - gesture.context.surface.getBoundingClientRect().left + 'px';
				gesture.ghost.style.top = gesture.card_rect.top - gesture.context.surface.getBoundingClientRect().top + 'px';
				gesture.ghost.style.width = gesture.card_rect.width + 'px';
				gesture.ghost.style.height = gesture.card_rect.height + 'px';
			}
			if ( gesture.ghost.parentNode !== gesture.current_context.surface ) {
				gesture.current_context.surface.appendChild( gesture.ghost );
			}
			if ( gesture.target_resource_id !== gesture.registration.resource_id ) {
				position_cross_resource_movement_ghost( gesture );
				return;
			}
			delta = get_visual_delta( gesture );
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
			if ( ! gesture || ! gesture.pending_coordinate || ! is_registration_current( gesture.registration ) ) {
				return;
			}
			target_context = gesture.pending_context || gesture.context;
			target_resource_id = normalize_positive_integer( gesture.pending_target_resource_id ) || gesture.registration.resource_id;
			target_is_cross_resource = 'movement' === gesture.gesture_type
				&& target_resource_id !== gesture.registration.resource_id;
			if ( ! is_gesture_context_current( target_context ) ) {
				gesture.pending_coordinate = null;
				gesture.pending_context = null;
				set_gesture_target_surface( gesture, null, false );
				announce_gesture( gesture, i18n.outside_unavailable );
				return;
			}
			resolved = 'resize' === gesture.gesture_type
				&& 'timed' === target_context.selection_kind
				&& 'relative_resize' === gesture.pending_coordinate.source
				&& geometry
				&& 'function' === typeof geometry.resolve_wall_time
				? geometry.resolve_wall_time(
					target_context.snapshot,
					gesture.pending_coordinate.date,
					gesture.pending_coordinate.wall_minute,
					''
				)
				: geometry.resolve_coordinate( target_context.snapshot, gesture.pending_coordinate );
			if ( 'resize' === gesture.gesture_type && 'all_day' === target_context.selection_kind ) {
				resolved = resolve_full_day_target_boundary( target_context.snapshot, resolved, gesture.operation );
			}
			gesture.current = resolved;
			gesture.current_context = target_context;
			gesture.target_resource_id = target_resource_id;
			gesture.pending_coordinate = null;
			gesture.pending_context = null;
			gesture.pending_target_resource_id = 0;
			if ( ! gesture.current || 'exact' !== gesture.current.status ) {
				set_gesture_target_surface( gesture, null, false );
				announce_gesture( gesture, 'gap' === ( gesture.current && gesture.current.status ) ? i18n.gap_unavailable : ( 'fold' === ( gesture.current && gesture.current.status ) ? i18n.fold_unavailable : i18n.outside_unavailable ) );
				return;
			}
			set_gesture_target_surface( gesture, target_context.surface, target_is_cross_resource );
			render_gesture_ghost( gesture );
			proposed_time = 'all_day' === target_context.selection_kind
				? ''
				: String( Math.floor( gesture.current.wall_minute / 60 ) ).padStart( 2, '0' ) + ':' + String( gesture.current.wall_minute % 60 ).padStart( 2, '0' );
			if ( 'resize' === gesture.gesture_type ) {
				announce_gesture( gesture, String( ( 'all_day' === target_context.selection_kind
					? i18n.resize_proposal_changed_all_day
					: i18n.resize_proposal_changed ) || '' )
					.replace( /%1?\$?s/, gesture.current.date )
					.replace( '%2$s', proposed_time )
					+ ( 1 < gesture.eligibility.resize.affected_intervals.length ? ' ' + String( i18n.resize_group_explanation || '' ) : '' ) );
				return;
			}
			if ( target_is_cross_resource ) {
				announce_gesture( gesture, String( ( 'all_day' === target_context.selection_kind
					? i18n.cross_resource_changed_all_day
					: i18n.cross_resource_changed ) || '' )
					.replace( '%1$s', String( target_resource_id ) )
					.replace( '%2$s', gesture.current.date )
					.replace( '%3$s', proposed_time ) );
				return;
			}
			announce_gesture( gesture, String( ( 'all_day' === target_context.selection_kind
				? i18n.proposal_changed_all_day
				: i18n.proposal_changed ) || '' )
				.replace( /%1?\$?s/, gesture.current.date )
				.replace( '%2$s', proposed_time )
				+ ( 1 < gesture.eligibility.movement.selected_dates.length ? ' ' + String( i18n.group_shift || '' ) : '' ) );
		}

		/**
		 * Schedule at most one visual update per animation frame.
		 *
		 * @return {void}
		 */
		function schedule_gesture_frame() {
			if ( gesture_frame ) {
				return;
			}
			if ( 'function' !== typeof window.requestAnimationFrame ) {
				flush_gesture_frame();
				return;
			}
			gesture_frame = window.requestAnimationFrame( flush_gesture_frame );
		}

		/**
		 * Release one transient gesture and optionally restore its grip focus.
		 *
		 * @param {boolean} restore_focus Whether to restore focus to the movement grip.
		 * @param {string}  message       Optional localized status announcement.
		 * @return {void}
		 */
		function cancel_gesture( restore_focus, message ) {
			var gesture = active_gesture;

			if ( gesture_frame && 'function' === typeof window.cancelAnimationFrame ) {
				window.cancelAnimationFrame( gesture_frame );
			}
			gesture_frame = 0;
			active_gesture = null;
			if ( ! gesture ) {
				return;
			}
			if ( gesture.pointer_id && gesture.grip && 'function' === typeof gesture.grip.releasePointerCapture ) {
				try {
					gesture.grip.releasePointerCapture( gesture.pointer_id );
				} catch ( error ) {
					// Pointer capture may already be released by the browser.
				}
			}
			if ( gesture.ghost ) {
				gesture.ghost.remove();
			}
			set_gesture_target_surface( gesture, null, false );
			( gesture.ghosts || [] ).forEach( function ( ghost ) {
				if ( ghost ) {
					ghost.remove();
				}
			} );
			gesture.registration.card.classList.remove( 'is-time-rows-moving' );
			gesture.registration.card.classList.remove( 'is-time-rows-resizing' );
			if ( callbacks.set_interaction_suspended ) {
				callbacks.set_interaction_suspended( false, gesture.registration.card );
			}
			if ( callbacks.set_axis_window_loading_locked ) {
				callbacks.set_axis_window_loading_locked( false );
			}
			announce_gesture( gesture, message || '' );
			if ( restore_focus && gesture.grip && gesture.grip.isConnected ) {
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
		function restore_projected_focus( booking_id, operation ) {
			var registration = Object.keys( registrations_by_render_id ).map( function ( render_id ) {
				return registrations_by_render_id[ render_id ];
			} ).find( function ( candidate ) {
				return candidate.booking_id === Number( booking_id ) && is_registration_current( candidate ) && ! candidate.is_overflowed;
			} );
			var operation_selector = -1 !== [ 'resize_start', 'resize_end' ].indexOf( String( operation || '' ) )
				? '[data-wpbc-timeline-time-rows-resize-operation="' + String( operation ) + '"]'
				: '';
			var focus_target = registration && registration.card
				? registration.card.querySelector( operation_selector || ( movement_grip_selector + ', [data-wpbc-timeline-booking-select]' ) )
				: null;

			if ( ! focus_target ) {
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

			if ( ! gesture ) {
				return;
			}
			if ( gesture.pending_coordinate ) {
				flush_gesture_frame();
			}
			resize_projection = 'resize' === gesture.gesture_type && gesture.current && 'exact' === gesture.current.status
				? build_resize_projection( gesture )
				: null;
			proposal = 'resize' === gesture.gesture_type
				? ( resize_projection ? resize_projection.proposal : null )
				: ( gesture.current && 'exact' === gesture.current.status ? build_movement_proposal( gesture ) : null );
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
			cancel_gesture( false, '' );
			if ( ! proposal ) {
				if ( gesture.grip && gesture.grip.isConnected ) {
					gesture.grip.focus();
				}
				announce_gesture( gesture, 'resize' === gesture.gesture_type ? i18n.resize_no_change : i18n.no_change );
				return;
			}
			if ( 'resize' === gesture.gesture_type ) {
				if ( ! callbacks.review_booking_resize_proposal || ! callbacks.review_booking_resize_proposal( proposal, review_state ) ) {
					announce_gesture( gesture, i18n.resize_review_unavailable );
					if ( gesture.grip && gesture.grip.isConnected ) {
						gesture.grip.focus();
					}
				}
				return;
			}
			if ( ! callbacks.review_booking_movement_proposal || ! callbacks.review_booking_movement_proposal( proposal, review_state ) ) {
				announce_gesture( gesture, i18n.review_unavailable );
				if ( gesture.grip && gesture.grip.isConnected ) {
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
		function begin_gesture( registration, grip, input_mode, coordinate, pointer_id ) {
			var eligibility = eligibility_cache[ registration.canonical_key ];
			var gesture_context;
			var target_contexts;
			var origin;

			if (
				active_gesture
				|| ! eligibility
				|| eligibility.error
				|| ( ! eligibility.movement.same_resource && ( ! cross_resource_movement_enabled || ! eligibility.movement.cross_resource ) )
				|| ( 'horizontal' === registration.interaction_axis && ! full_day_movement_enabled )
				|| ! is_registration_current( registration )
				|| ( callbacks.can_start_interaction && ! callbacks.can_start_interaction() )
			) {
				return false;
			}
			gesture_context = prepare_gesture_context( registration );
			origin = gesture_context ? geometry.resolve_coordinate( gesture_context.snapshot, coordinate ) : null;
			if ( ! origin || 'exact' !== origin.status ) {
				return false;
			}
			target_contexts = Object.create( null );
			target_contexts[ registration.resource_id ] = gesture_context;
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
				canvas: mount.querySelector ? mount.querySelector( '[data-wpbc-timeline-canvas]' ) : null
			};
			registration.card.classList.add( 'is-time-rows-moving' );
			if ( callbacks.set_interaction_suspended ) {
				callbacks.set_interaction_suspended( true, registration.card );
			}
			if ( callbacks.set_axis_window_loading_locked ) {
				callbacks.set_axis_window_loading_locked( true );
			}
			announce_gesture(
				active_gesture,
				'keyboard' === input_mode
					? i18n.keyboard_started
					: ( ! eligibility.movement.same_resource && eligibility.movement.cross_resource ? i18n.cross_resource_started : i18n.gesture_started )
			);

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
		function begin_resize_gesture( registration, handle, operation, pointer_id, pointer_y ) {
			var eligibility = eligibility_cache[ registration.canonical_key ];
			var gesture_context;
			var boundary_instant;
			var origin;

			if (
				active_gesture
				|| ( 'horizontal' === registration.interaction_axis && ! full_day_resize_enabled )
				|| ! eligibility
				|| eligibility.error
				|| ! eligibility.resize.allowed
				|| ( 'resize_start' === operation && ! eligibility.resize.start )
				|| ( 'resize_end' === operation && ! eligibility.resize.end )
				|| -1 === [ 'resize_start', 'resize_end' ].indexOf( operation )
				|| ! Number.isFinite( pointer_y )
				|| ! is_registration_current( registration )
				|| ( callbacks.can_start_interaction && ! callbacks.can_start_interaction() )
			) {
				return false;
			}
			gesture_context = prepare_gesture_context( registration );
			boundary_instant = 'resize_start' === operation
				? eligibility.resize.immutable_interval.start
				: eligibility.resize.immutable_interval.end;
			origin = gesture_context
				? ( 'all_day' === gesture_context.selection_kind
					? resolve_full_day_instant_boundary( gesture_context.snapshot, boundary_instant, operation )
					: resolve_instant_boundary( gesture_context.snapshot, boundary_instant ) )
				: null;
			if ( ! origin ) {
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
				canvas: mount.querySelector ? mount.querySelector( '[data-wpbc-timeline-canvas]' ) : null
			};
			registration.card.classList.add( 'is-time-rows-resizing' );
			if ( callbacks.set_interaction_suspended ) {
				callbacks.set_interaction_suspended( true, registration.card );
			}
			if ( callbacks.set_axis_window_loading_locked ) {
				callbacks.set_axis_window_loading_locked( true );
			}
			announce_gesture( active_gesture, i18n.resize_gesture_started );

			return true;
		}

		/**
		 * Resolve an authorized grip back to its retained canonical registration.
		 *
		 * @param {Element} grip Movement grip inside a registered projected card.
		 * @return {Object|null} Current registration or null.
		 */
		function find_registration_for_grip( grip ) {
			return Object.keys( registrations_by_render_id ).map( function ( render_id ) {
				return registrations_by_render_id[ render_id ];
			} ).find( function ( registration ) {
				return registration.card && registration.card.contains && registration.card.contains( grip ) && is_registration_current( registration );
			} ) || null;
		}

		/**
		 * Build the initial keyboard cell from canonical saved schedule context.
		 *
		 * @param {Object} registration Current canonical registration.
		 * @param {Object} eligibility  Fresh accepted eligibility.
		 * @return {Object|null} Keyboard coordinate or null outside coverage.
		 */
		function get_keyboard_origin_coordinate( registration, eligibility ) {
			var gesture_context = prepare_gesture_context( registration );
			var movement = eligibility && eligibility.movement ? eligibility.movement : {};
			var exact_start = movement.exact_intervals && movement.exact_intervals[ 0 ] ? movement.exact_intervals[ 0 ].start : '';
			var start_match = String( exact_start ).match( /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):00/ );
			var date = 'full_day' === movement.time_application ? String( movement.selected_dates[ 0 ] || '' ) : ( start_match ? start_match[ 1 ] : '' );
			var wall_minute = start_match ? Number( start_match[ 2 ] ) * 60 + Number( start_match[ 3 ] ) : 0;
			var snap_index;

			if ( ! gesture_context || ! gesture_context.snapshot.bands_by_date[ date ] ) {
				return null;
			}
			snap_index = 'all_day' === gesture_context.selection_kind
				? 0
				: Math.round( ( wall_minute - gesture_context.snapshot.visible_range.start_minute ) / gesture_context.snapshot.selection_step_minutes );

			return keyboard_coordinate( gesture_context.snapshot, gesture_context.selection_kind, date, snap_index );
		}

		/**
		 * Start Pointer Events movement only from an authorized grip.
		 *
		 * @param {PointerEvent} event Captured pointerdown event.
		 * @return {void}
		 */
		function handle_pointer_down( event ) {
			var resize_handle = event.target && event.target.closest ? event.target.closest( resize_handle_selector ) : null;
			var grip = ! resize_handle && event.target && event.target.closest ? event.target.closest( movement_grip_selector ) : null;
			var operation = resize_handle ? String( resize_handle.getAttribute( 'data-wpbc-timeline-time-rows-resize-operation' ) || '' ) : '';
			var control = resize_handle || grip;
			var registration = control ? find_registration_for_grip( control ) : null;
			var surface;
			var surface_rect;
			var coordinate;

			if ( ! registration || ( Number.isFinite( Number( event.button ) ) && 0 !== Number( event.button ) ) ) {
				return;
			}
			if ( resize_handle ) {
				if ( ! begin_resize_gesture( registration, resize_handle, operation, Number( event.pointerId ) || 0, Number( event.clientY ) ) ) {
					return;
				}
				if ( 'function' === typeof resize_handle.setPointerCapture && event.pointerId ) {
					try {
						resize_handle.setPointerCapture( event.pointerId );
					} catch ( error ) {
						// Document listeners still own completion when capture is unavailable.
					}
				}
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			surface = registration.card.closest( 'vertical' === registration.interaction_axis ? timed_surface_selector : all_day_surface_selector );
			if ( ! surface ) {
				return;
			}
			surface_rect = surface.getBoundingClientRect();
			coordinate = {
				source: 'pointer',
				selection_kind: 'vertical' === registration.interaction_axis ? 'timed' : 'all_day',
				inline_px: Number( event.clientX ) - surface_rect.left,
				block_px: Number( event.clientY ) - surface_rect.top
			};
			if ( ! begin_gesture( registration, grip, 'pointer', coordinate, Number( event.pointerId ) || 0 ) ) {
				return;
			}
			if ( 'function' === typeof grip.setPointerCapture && event.pointerId ) {
				try {
					grip.setPointerCapture( event.pointerId );
				} catch ( error ) {
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
		function handle_pointer_move( event ) {
			var target;

			if ( ! active_gesture || 'pointer' !== active_gesture.input_mode || Number( event.pointerId ) !== active_gesture.pointer_id ) {
				return;
			}
			if ( 'movement' === active_gesture.gesture_type ) {
				target = resolve_pointer_movement_target( active_gesture, event );
				active_gesture.pending_coordinate = target ? target.coordinate : null;
				active_gesture.pending_context = target ? target.context : null;
				active_gesture.pending_target_resource_id = target ? target.resource_id : 0;
				if ( ! target ) {
					set_gesture_target_surface( active_gesture, null, false );
					announce_gesture( active_gesture, i18n.outside_unavailable );
				}
			} else {
				active_gesture.pending_coordinate = 'timed' === active_gesture.context.selection_kind
					? timed_resize_pointer_coordinate( active_gesture, event )
					: pointer_coordinate( active_gesture.context, event );
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
		function handle_pointer_up( event ) {
			var target;

			if ( ! active_gesture || 'pointer' !== active_gesture.input_mode || Number( event.pointerId ) !== active_gesture.pointer_id ) {
				return;
			}
			if ( 'movement' === active_gesture.gesture_type ) {
				target = resolve_pointer_movement_target( active_gesture, event );
				if ( ! target ) {
					event.preventDefault();
					cancel_gesture( true, i18n.cancelled );
					return;
				}
				active_gesture.pending_coordinate = target.coordinate;
				active_gesture.pending_context = target.context;
				active_gesture.pending_target_resource_id = target.resource_id;
			} else {
				active_gesture.pending_coordinate = 'timed' === active_gesture.context.selection_kind
					? timed_resize_pointer_coordinate( active_gesture, event )
					: pointer_coordinate( active_gesture.context, event );
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
		function handle_pointer_cancel( event ) {
			if ( active_gesture && 'pointer' === active_gesture.input_mode && Number( event.pointerId ) === active_gesture.pointer_id ) {
				cancel_gesture( true, 'resize' === active_gesture.gesture_type ? i18n.resize_cancelled : i18n.cancelled );
			}
		}

		/**
		 * Operate the accessible keyboard movement state machine.
		 *
		 * @param {KeyboardEvent} event Keydown event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			var resize_handle = event.target && event.target.closest ? event.target.closest( resize_handle_selector ) : null;
			var grip = ! resize_handle && event.target && event.target.closest ? event.target.closest( movement_grip_selector ) : null;
			var resize_registration = resize_handle ? find_registration_for_grip( resize_handle ) : null;
			var registration = grip ? find_registration_for_grip( grip ) : null;
			var eligibility;
			var origin_coordinate;
			var snapshot;
			var date_index;
			var date_delta = 0;
			var snap_delta = 0;

			if ( active_gesture && 'Escape' === event.key ) {
				event.preventDefault();
				cancel_gesture( true, 'resize' === active_gesture.gesture_type ? i18n.resize_cancelled : i18n.cancelled );
				return;
			}
			if (
				! active_gesture
				&& resize_handle
				&& resize_registration
				&& ( 'Enter' === event.key || ' ' === event.key )
			) {
				event.preventDefault();
				event.stopPropagation();
				if ( callbacks.open_booking_full_reschedule ) {
					callbacks.open_booking_full_reschedule( resize_registration.card, resize_handle );
				}
				return;
			}
			if ( active_gesture && 'keyboard' === active_gesture.input_mode ) {
				if ( 'Enter' === event.key || ' ' === event.key ) {
					event.preventDefault();
					complete_gesture();
					return;
				}
				if ( -1 === [ 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ].indexOf( event.key ) ) {
					return;
				}
				event.preventDefault();
				snapshot = active_gesture.context.snapshot;
				date_delta = 'ArrowLeft' === event.key ? -1 : ( 'ArrowRight' === event.key ? 1 : 0 );
				if ( 'rtl' === snapshot.direction ) {
					date_delta *= -1;
				}
				snap_delta = 'ArrowUp' === event.key ? -1 : ( 'ArrowDown' === event.key ? 1 : 0 );
				date_index = Math.max( 0, Math.min( snapshot.date_columns.length - 1, snapshot.date_order[ active_gesture.current.date ] + date_delta ) );
				active_gesture.pending_coordinate = keyboard_coordinate(
					snapshot,
					active_gesture.context.selection_kind,
					snapshot.date_columns[ date_index ].date,
					active_gesture.current.snap_index + snap_delta
				);
				flush_gesture_frame();
				return;
			}
			if ( ! registration || ( 'Enter' !== event.key && ' ' !== event.key ) ) {
				return;
			}
			eligibility = eligibility_cache[ registration.canonical_key ];
			if ( eligibility && ! eligibility.error && ! eligibility.movement.same_resource ) {
				event.preventDefault();
				if ( callbacks.open_booking_full_reschedule ) {
					callbacks.open_booking_full_reschedule( registration.card, grip );
				}
				return;
			}
			origin_coordinate = get_keyboard_origin_coordinate( registration, eligibility );
			if ( ! origin_coordinate ) {
				return;
			}
			event.preventDefault();
			begin_gesture( registration, grip, 'keyboard', origin_coordinate, 0 );
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
		function get_resize_denial_message( eligibility ) {
			var reasons = i18n.resize_denial_reasons && 'object' === typeof i18n.resize_denial_reasons
				? i18n.resize_denial_reasons
				: {};
			var resize = eligibility && eligibility.resize ? eligibility.resize : {};
			var reason = String( resize.fallback_reason || '' );

			return ! resize.allowed && reason ? String( reasons[ reason ] || i18n.denied || '' ) : '';
		}

		/**
		 * Render controls only for independently enabled, server-authorized gestures.
		 *
		 * @param {Object} registration Selected canonical anchor registration.
		 * @param {Object} eligibility Fresh combined eligibility result.
		 * @return {void}
		 */
		function render_eligibility( registration, eligibility ) {
			var canonical_registrations = get_canonical_registrations( registration.canonical_key );
			var anchor_registration = canonical_registrations.filter( function ( candidate ) {
				return ! candidate.is_overflowed;
			} )[ 0 ] || registration;
			var status_id = 'wpbc-time-rows-movement-status-' + registration.booking_id + '-' + request_generation;
			var resize_denial_message = get_resize_denial_message( eligibility );
			var status_message = eligibility.error
				? i18n.error
				: ( resize_denial_message || ( eligibility.movement.allowed || eligibility.resize.start || eligibility.resize.end ? i18n.ready : i18n.denied ) );

			clear_all_registration_hosts();
			canonical_registrations.forEach( function ( candidate ) {
				var host = create_control_host( candidate );
				var is_anchor = candidate.render_id === anchor_registration.render_id;
				var is_timed_resize = 'vertical' === candidate.interaction_axis
					&& -1 !== supported_timed_resize_shapes.indexOf( eligibility.resize.saved_shape );
				var is_full_day_resize = full_day_resize_enabled
					&& 'horizontal' === candidate.interaction_axis
					&& -1 !== supported_full_day_resize_shapes.indexOf( eligibility.resize.saved_shape );
				var show_start = ! eligibility.error && eligibility.resize.allowed && ( is_timed_resize || is_full_day_resize ) && eligibility.resize.start && candidate.boundary_start_visible;
				var show_end = ! eligibility.error && eligibility.resize.allowed && ( is_timed_resize || is_full_day_resize ) && eligibility.resize.end && candidate.boundary_end_visible;

				if ( ! host ) {
					return;
				}
				if ( is_anchor ) {
					render_template( host, 'status', {
						status_id: status_id,
						message: status_message
					} );
				}
				if (
					is_anchor
					&& ! eligibility.error
					&& ( eligibility.movement.same_resource || ( cross_resource_movement_enabled && eligibility.movement.cross_resource ) )
					&& ( 'vertical' === candidate.interaction_axis || full_day_movement_enabled )
				) {
					render_template( host, 'grip', {
						label: i18n.movement_label,
						status_id: status_id,
							keyboard_instructions: 'horizontal' === candidate.interaction_axis
								? i18n.full_day_keyboard_instructions
								: i18n.keyboard_instructions
					} );
				}
				if ( show_start || show_end ) {
					render_template( host, 'resize_handles', {
						start: show_start,
						end: show_end,
						group_label: i18n.resize_group_label,
						start_label: i18n.resize_start_label,
						end_label: i18n.resize_end_label,
						status_id: status_id,
						keyboard_fallback: i18n.resize_keyboard_fallback
					} );
				}
			} );
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
		function render_checking_status( registration ) {
			var canonical_registrations = get_canonical_registrations( registration.canonical_key );
			var anchor_registration = canonical_registrations.filter( function ( candidate ) {
				return ! candidate.is_overflowed;
			} )[ 0 ] || registration;

			clear_all_registration_hosts();
			canonical_registrations.forEach( function ( candidate ) {
				var host = create_control_host( candidate );
				var is_anchor = candidate.render_id === anchor_registration.render_id;

				if ( ! host ) {
					return;
				}
				render_template( host, 'status', {
					is_loading: true,
					show_start: candidate.boundary_start_visible,
					show_end: candidate.boundary_end_visible,
					status_id: is_anchor ? 'wpbc-time-rows-movement-status-' + registration.booking_id + '-' + request_generation : '',
					message: is_anchor ? i18n.checking : ''
				} );
			} );
		}

		/**
		 * Complete two authoritative eligibility reads for one accepted identity.
		 *
		 * @param {Object} registration Selected canonical registration.
		 * @return {void}
		 */
		function request_eligibility( registration ) {
			var movement_transport = transport.movement || {};
			var resize_transport = transport.resize || {};
			var generation;
			var remaining = 2;
			var movement_result = null;
			var resize_result = null;
			var has_error = false;
			var movement_request;
			var resize_request;

			if (
				! window.jQuery
				|| ! movement_transport.url
				|| ! resize_transport.url
				|| ! is_registration_current( registration )
			) {
				return;
			}
			if ( eligibility_cache[ registration.canonical_key ] ) {
				render_eligibility( registration, eligibility_cache[ registration.canonical_key ] );
				return;
			}
			abort_requests();
			generation = request_generation;
			active_request_resource_id = registration.resource_id;
			render_checking_status( registration );

			/**
			 * Commit the combined result only while every identity remains current.
			 *
			 * @return {void}
			 */
			function complete_one_request() {
				var eligibility;
				var resize_denial_message;

				remaining -= 1;
				if ( remaining || generation !== request_generation || ! is_registration_current( registration ) || registration.canonical_key !== selected_canonical_key ) {
					return;
				}
				active_requests = [];
				active_request_resource_id = 0;
				eligibility = {
					identity_key: registration.identity_key,
					movement: movement_result || { allowed: false, same_resource: false, cross_resource: false, source_context_token: '' },
					resize: resize_result || { start: false, end: false, source_context_token: '' },
					error: has_error || ! movement_result || ! resize_result
				};
				if ( ! eligibility.error ) {
					eligibility_cache[ registration.canonical_key ] = eligibility;
				}
				render_eligibility( registration, eligibility );
				resize_denial_message = get_resize_denial_message( eligibility );
				if ( resize_denial_message && callbacks.show_admin_message ) {
					callbacks.show_admin_message( resize_denial_message, 'warning', 5000 );
				}
			}

			movement_request = window.jQuery.ajax( {
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
			} ).done( function ( response ) {
				movement_result = normalize_movement_response( response, registration );
				has_error = has_error || ! movement_result;
			} ).fail( function ( request, request_status ) {
				if ( 'abort' !== request_status ) {
					has_error = true;
				}
			} ).always( complete_one_request );

			resize_request = window.jQuery.ajax( {
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
			} ).done( function ( response ) {
				resize_result = normalize_resize_response( response, registration );
				has_error = has_error || ! resize_result;
			} ).fail( function ( request, request_status ) {
				if ( 'abort' !== request_status ) {
					has_error = true;
				}
			} ).always( complete_one_request );
			active_requests = [ movement_request, resize_request ];
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
		function reload_selected_eligibility( booking_id ) {
			var registration = Object.keys( registrations_by_render_id ).map( function ( render_id ) {
				return registrations_by_render_id[ render_id ];
			} ).find( function ( candidate ) {
				return candidate.booking_id === Number( booking_id ) && candidate.canonical_key === selected_canonical_key && is_registration_current( candidate );
			} );

			if ( ! registration ) {
				return;
			}
			delete eligibility_cache[ registration.canonical_key ];
			request_eligibility( registration );
		}

		/**
		 * Resolve selected presentation identity to accepted canonical data.
		 *
		 * @param {Object} selection_state Booking-wide shared selection state.
		 * @return {Object|null} Canonical selected registration or null.
		 */
		function resolve_selected_registration( selection_state ) {
			var render_id = String( selection_state && selection_state.segment_hint || '' );
			var booking_id = normalize_positive_integer( selection_state && selection_state.booking_id );
			var registration = registrations_by_render_id[ render_id ] || null;

			if ( ! registration || registration.booking_id !== booking_id || ! is_registration_current( registration ) ) {
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
		function reconcile_selection( selection_state ) {
			var registration = resolve_selected_registration( selection_state );

			selected_booking_id = normalize_positive_integer( selection_state && selection_state.booking_id );
			selected_render_id = String( selection_state && selection_state.segment_hint || '' );
			if ( ! registration || is_request_loading ) {
				abort_requests();
				clear_all_registration_hosts();
				selected_canonical_key = '';
				return;
			}
			selected_canonical_key = registration.canonical_key;
			request_eligibility( registration );
		}

		/**
		 * Coalesce selection reconciliation across synchronous multi-Resource renders.
		 *
		 * @param {Object} selection_state Booking-wide shared selection state.
		 * @return {void}
		 */
		function schedule_selection_reconciliation( selection_state ) {
			pending_selection_state = {
				booking_id: normalize_positive_integer( selection_state && selection_state.booking_id ),
				segment_hint: String( selection_state && selection_state.segment_hint || '' )
			};
			if ( reconcile_frame ) {
				return;
			}
			if ( 'function' !== typeof window.requestAnimationFrame ) {
				reconcile_selection( pending_selection_state );
				pending_selection_state = null;
				return;
			}
			reconcile_frame = window.requestAnimationFrame( function () {
				var next_selection_state = pending_selection_state;

				reconcile_frame = 0;
				pending_selection_state = null;
				reconcile_selection( next_selection_state );
			} );
		}

		/**
		 * React to one shared booking selection without reading card authority.
		 *
		 * @param {HTMLElement} segment_element Selected rendered segment.
		 * @param {Object} selection_state Booking-wide shared selection state.
		 * @return {void}
		 */
		function select_segment( segment_element, selection_state ) {
			schedule_selection_reconciliation( selection_state );
		}

		/**
		 * Complete one projected Resource refresh and reconcile current selection.
		 *
		 * @param {Object} refresh_context Accepted presentation refresh context.
		 * @param {Object} selection_state Booking-wide shared selection state.
		 * @return {void}
		 */
		function complete_read_only_refresh( refresh_context, selection_state ) {
			if ( String( refresh_context && refresh_context.presentation_id || '' ) !== String( time_rows_configuration.presentation_id || '' ) ) {
				return;
			}
			schedule_selection_reconciliation( selection_state );
		}

		/**
		 * Suspend or resume eligibility presentation during canonical loading.
		 *
		 * @param {boolean} is_loading Whether Timeline replacement is active.
		 * @return {void}
		 */
		function set_request_loading( is_loading ) {
			is_request_loading = true === is_loading;
			if ( is_request_loading ) {
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
		function refresh_retained_resource_identity( resource_id, identity_key ) {
			var render_ids = registration_ids_by_resource[ resource_id ] || [];

			if ( active_gesture && active_gesture.registration.resource_id === resource_id ) {
				cancel_gesture( false, '' );
			}
			abort_requests( resource_id );
			render_ids.forEach( function ( render_id ) {
				var registration = registrations_by_render_id[ render_id ];

				if ( ! registration ) {
					return;
				}
				clear_registration_host( registration );
				delete eligibility_cache[ registration.canonical_key ];
				registration.identity_key = identity_key;
				registration.canonical_key = build_canonical_key(
					identity_key,
					registration.booking_id,
					registration.resource_id,
					registration.segment_id,
					registration.visible_start,
					registration.visible_end
				);
			} );
			refresh_identity_by_resource[ resource_id ] = identity_key;
			selected_canonical_key = '';
		}

		/**
		 * Invalidate only registrations whose accepted identity is now stale.
		 *
		 * @return {void}
		 */
		function handle_accepted_data_replacement() {
			Object.keys( refresh_identity_by_resource ).forEach( function ( resource_id ) {
				var numeric_resource_id = normalize_positive_integer( resource_id );
				var live_identity_key = build_accepted_identity_key( get_live_interaction_context( numeric_resource_id ), selection_step_minutes );

				if ( ! live_identity_key ) {
					invalidate_resource( numeric_resource_id, false );
					return;
				}
				if ( live_identity_key !== refresh_identity_by_resource[ numeric_resource_id ] ) {
					refresh_retained_resource_identity( numeric_resource_id, live_identity_key );
				}
			} );
			if ( selected_booking_id && selected_render_id ) {
				schedule_selection_reconciliation( {
					booking_id: selected_booking_id,
					segment_hint: selected_render_id
				} );
			}
		}

		/**
		 * Release one removed or closed Resource projection.
		 *
		 * @param {CustomEvent} event Presentation lifecycle event.
		 * @return {void}
		 */
		function handle_presentation_removed( event ) {
			var detail = event && event.detail ? event.detail : {};
			var resource_id = normalize_positive_integer( detail.resource_id );

			if ( String( detail.presentation_id || '' ) === String( time_rows_configuration.presentation_id || '' ) && resource_id ) {
				invalidate_resource( resource_id, false );
			}
		}

		/**
		 * Cancel a proposal when the document can no longer guarantee completion.
		 *
		 * @return {void}
		 */
		function handle_environment_loss() {
			cancel_gesture( false, '' );
		}

		/**
		 * Cancel when the document becomes hidden during a gesture.
		 *
		 * @return {void}
		 */
		function handle_visibility_change() {
			if ( document.hidden ) {
				handle_environment_loss();
			}
		}

		/**
		 * Report whether this extension currently owns gesture attention.
		 *
		 * @return {boolean} True during a pointer or keyboard proposal.
		 */
		function is_interacting() {
			return Boolean( active_gesture );
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
		function set_interaction_callbacks( next_callbacks ) {
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
				registration_count: Object.keys( registrations_by_render_id ).length,
				resource_identity_count: Object.keys( refresh_identity_by_resource ).length,
				eligibility_cache_count: Object.keys( eligibility_cache ).length,
				request_count: active_requests.length,
				request_generation: request_generation,
				selected_booking_id: selected_booking_id,
				selected_render_id: selected_render_id,
				has_selected_canonical_identity: Boolean( selected_canonical_key ),
				is_request_loading: is_request_loading,
				has_active_gesture: Boolean( active_gesture )
			};
		}

		/**
		 * Attach accepted-data invalidation listeners.
		 *
		 * @return {void}
		 */
		function initialize() {
			if ( ! mount || is_initialized ) {
				return;
			}
			is_initialized = true;
			mount.addEventListener( 'wpbc:timeline:data:booking-windows-accepted', handle_accepted_data_replacement );
			mount.addEventListener( 'wpbc:timeline:data:availability-accepted', handle_accepted_data_replacement );
			mount.addEventListener( 'wpbc:timeline:row-presentation:closed', handle_presentation_removed );
			mount.addEventListener( 'wpbc:timeline:row-presentation:removed', handle_presentation_removed );
			mount.addEventListener( 'pointerdown', handle_pointer_down, true );
			document.addEventListener( 'pointermove', handle_pointer_move, { passive: false } );
			document.addEventListener( 'pointerup', handle_pointer_up, { passive: false } );
			document.addEventListener( 'pointercancel', handle_pointer_cancel );
			document.addEventListener( 'keydown', handle_keydown );
			document.addEventListener( 'visibilitychange', handle_visibility_change );
			window.addEventListener( 'blur', handle_environment_loss );
			window.addEventListener( 'pagehide', handle_environment_loss );
		}

		/**
		 * Remove listeners, requests, accepted references, and presentation.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! mount || ! is_initialized ) {
				return;
			}
			mount.removeEventListener( 'wpbc:timeline:data:booking-windows-accepted', handle_accepted_data_replacement );
			mount.removeEventListener( 'wpbc:timeline:data:availability-accepted', handle_accepted_data_replacement );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:closed', handle_presentation_removed );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:removed', handle_presentation_removed );
			mount.removeEventListener( 'pointerdown', handle_pointer_down, true );
			document.removeEventListener( 'pointermove', handle_pointer_move, { passive: false } );
			document.removeEventListener( 'pointerup', handle_pointer_up, { passive: false } );
			document.removeEventListener( 'pointercancel', handle_pointer_cancel );
			document.removeEventListener( 'keydown', handle_keydown );
			document.removeEventListener( 'visibilitychange', handle_visibility_change );
			window.removeEventListener( 'blur', handle_environment_loss );
			window.removeEventListener( 'pagehide', handle_environment_loss );
			invalidate_all();
			registrations_by_render_id = Object.create( null );
			registration_ids_by_resource = Object.create( null );
			refresh_identity_by_resource = Object.create( null );
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

		return modules && 'function' === typeof modules.get_instance
			? modules.get_instance( module_instance_id )
			: null;
	}

	/**
	 * Invoke one optional method on the active isolated controller.
	 *
	 * @param {string} method_name Stable controller method.
	 * @param {Array} method_arguments Ordered callback arguments.
	 * @return {*} Controller result when available.
	 */
	function invoke_active_controller( method_name, method_arguments ) {
		var controller = get_active_controller();

		if ( controller && 'function' === typeof controller[ method_name ] ) {
			return controller[ method_name ].apply( controller, method_arguments || [] );
		}

		return undefined;
	}

	if ( window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory ) {
		window.wpbc_timeline_modules.register_factory( module_id, create_controller );
	}

	if (
		window.wpbc_timeline_booking_interactions
		&& 'function' === typeof window.wpbc_timeline_booking_interactions.register_extension_factory
	) {
		window.wpbc_timeline_booking_interactions.register_extension_factory( function ( interaction_context ) {
			var bridge_callbacks = interaction_context && interaction_context.callbacks && 'object' === typeof interaction_context.callbacks
				? interaction_context.callbacks
				: {};

			return {
				initialize: function () {
					booking_interaction_callbacks = bridge_callbacks;
					invoke_active_controller( 'set_interaction_callbacks', [ bridge_callbacks ] );
				},
				destroy: function () {
					invoke_active_controller( 'set_interaction_callbacks', [ null ] );
					if ( booking_interaction_callbacks === bridge_callbacks ) {
						booking_interaction_callbacks = null;
					}
				},
				begin_refresh: function () {
					invoke_active_controller( 'invalidate_all', [] );
				},
				begin_read_only_refresh: function ( refresh_context ) {
					invoke_active_controller( 'begin_read_only_refresh', [ refresh_context ] );
				},
				register_read_only_segment: function ( card, segment, resource_summary, presentation_context ) {
					invoke_active_controller( 'register_read_only_segment', [ card, segment, resource_summary, presentation_context ] );
				},
				complete_read_only_refresh: function ( refresh_context, selection_state ) {
					invoke_active_controller( 'complete_read_only_refresh', [ refresh_context, selection_state ] );
				},
				select_segment: function ( segment_element, selection_state ) {
					invoke_active_controller( 'select_segment', [ segment_element, selection_state ] );
				},
				set_request_loading: function ( is_loading ) {
					invoke_active_controller( 'set_request_loading', [ is_loading ] );
				}
			};
		} );
	}
}( window, document, window.wp ) );
