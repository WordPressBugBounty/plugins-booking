/**
 * Creation-only schedule workflow for Add New Booking Inspector.
 *
 * This source file is compiled by the normal WPBC asset process. It deliberately
 * owns no Inspector host, button, template, review, apply, or persistence logic.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

( function ( window, document, $ ) {
	'use strict';

	var EVENT_NAMESPACE = '.wpbcBookingNewInspectorSchedule';
	var NATIVE_LOAD_TIMEOUT_MS = 30000;

	/**
	 * Normalize a positive Resource identifier.
	 *
	 * @param {*} resource_id Candidate Resource ID.
	 * @return {number} Positive Resource ID or zero.
	 */
	function normalize_resource_id( resource_id ) {
		resource_id = Number( resource_id );

		return Number.isInteger( resource_id ) && resource_id > 0 ? resource_id : 0;
	}

	/**
	 * Normalize ordered unique ISO calendar dates.
	 *
	 * @param {*} selected_dates Candidate date list.
	 * @return {Array<string>} Ordered unique strict ISO dates.
	 */
	function normalize_iso_dates( selected_dates ) {
		var unique_dates = {};

		if ( ! Array.isArray( selected_dates ) ) {
			return [];
		}
		selected_dates.forEach( function ( selected_date ) {
			if ( 'string' === typeof selected_date && /^\d{4}-\d{2}-\d{2}$/.test( selected_date ) ) {
				unique_dates[ selected_date ] = selected_date;
			}
		} );

		return Object.keys( unique_dates ).sort();
	}

	/**
	 * Normalize one exact-minute wall time.
	 *
	 * @param {*} time_value Candidate time.
	 * @return {string} Strict HH:MM value or empty string.
	 */
	function normalize_time( time_value ) {
		time_value = 'string' === typeof time_value ? time_value.trim() : '';

		return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test( time_value ) ? time_value : '';
	}

	/**
	 * Clone the bounded creation schedule DTO.
	 *
	 * @param {*} schedule Candidate server or local schedule.
	 * @return {Object} Independent normalized draft.
	 */
	function clone_schedule( schedule ) {
		schedule = schedule && 'object' === typeof schedule && ! Array.isArray( schedule ) ? schedule : {};

		return {
			selection_method: 'individual' === schedule.selection_method ? 'individual' : 'policy',
			time_application: -1 !== [ 'full_day', 'boundary', 'per_date' ].indexOf( schedule.time_application ) ? schedule.time_application : 'full_day',
			selected_dates: normalize_iso_dates( schedule.selected_dates ),
			start_time: normalize_time( schedule.start_time ),
			end_time: normalize_time( schedule.end_time ),
			seed_source: -1 !== [ 'empty', 'timeline', 'draft' ].indexOf( schedule.seed_source ) ? schedule.seed_source : 'empty',
			exact_timeline_seed: true === schedule.exact_timeline_seed
		};
	}

	/**
	 * Compare two normalized creation schedules without sharing references.
	 *
	 * The draft is bounded to the fixed schedule DTO, so a stable property-by-
	 * property comparison is sufficient and avoids treating native calendar DOM
	 * state as authoritative.
	 *
	 * @param {*} left_schedule  First candidate schedule.
	 * @param {*} right_schedule Second candidate schedule.
	 * @return {boolean} True when both normalized schedules are identical.
	 */
	function schedules_are_equal( left_schedule, right_schedule ) {
		var left = clone_schedule( left_schedule );
		var right = clone_schedule( right_schedule );

		return left.selection_method === right.selection_method
			&& left.time_application === right.time_application
			&& left.selected_dates.join( '|' ) === right.selected_dates.join( '|' )
			&& left.start_time === right.start_time
			&& left.end_time === right.end_time
			&& left.seed_source === right.seed_source
			&& left.exact_timeline_seed === right.exact_timeline_seed;
	}

	/**
	 * Create one dormant creation-schedule workflow.
	 *
	 * The workflow calls only its creation schedule read endpoint and the shared
	 * native calendar adapter. Date Editor read, review, and apply actions are not
	 * dependencies. The caller owns presentation and creation state transitions.
	 *
	 * @param {Object} configuration Authorized runtime configuration and callbacks.
	 * @return {Object} Creation schedule workflow API.
	 */
	function create_schedule_workflow( configuration ) {
		var root;
		var calendar_host;
		var generation = 0;
		var pending_request = null;
		var native_adapter = null;
		var native_load_timer = null;
		var initial_draft = null;
		var draft = null;
		var active_response = null;

		configuration = configuration && 'object' === typeof configuration ? configuration : {};
		root = configuration.root && 1 === configuration.root.nodeType ? configuration.root : null;
		calendar_host = configuration.calendar_host && 1 === configuration.calendar_host.nodeType ? configuration.calendar_host : null;

		/**
		 * Resolve the current domain-owned calendar host after a template refresh.
		 *
		 * @return {Element|null} Current calendar host or null.
		 */
		function get_calendar_host() {
			var refreshed_host = 'function' === typeof configuration.get_calendar_host
				? configuration.get_calendar_host()
				: null;

			if ( refreshed_host && 1 === refreshed_host.nodeType ) {
				calendar_host = refreshed_host;
			}

			return calendar_host;
		}

		/**
		 * Report whether the local schedule differs from its immutable server seed.
		 *
		 * @return {boolean} True only after a successful read and a local change.
		 */
		function is_dirty() {
			return Boolean( initial_draft && draft && ! schedules_are_equal( initial_draft, draft ) );
		}

		/**
		 * Notify the host that the local schedule draft changed.
		 *
		 * @return {void}
		 */
		function notify_change() {
			if ( 'function' === typeof configuration.on_change && draft ) {
				configuration.on_change( clone_schedule( draft ), { is_dirty: is_dirty() } );
			}
		}

		/**
		 * Notify the host about the current loading state.
		 *
		 * @param {boolean} is_loading Whether a schedule or availability read is active.
		 * @return {void}
		 */
		function notify_loading( is_loading ) {
			if ( 'function' === typeof configuration.on_loading ) {
				configuration.on_loading( Boolean( is_loading ) );
			}
		}

		/**
		 * Notify the host about one safe read or native-calendar failure.
		 *
		 * @param {*} error_value Error DTO or native failure.
		 * @return {void}
		 */
		function notify_error( error_value ) {
			if ( 'function' === typeof configuration.on_error ) {
				configuration.on_error( error_value || {} );
			}
		}

		/**
		 * Clear the bounded native availability timeout.
		 *
		 * @return {void}
		 */
		function clear_native_timer() {
			if ( native_load_timer ) {
				window.clearTimeout( native_load_timer );
				native_load_timer = null;
			}
		}

		/**
		 * Abort reads and remove native state owned by the current generation.
		 *
		 * @return {void}
		 */
		function teardown_active_reads() {
			clear_native_timer();
			if ( pending_request && 'function' === typeof pending_request.abort ) {
				pending_request.abort();
			}
			pending_request = null;
			if ( root ) {
				$( root ).off( EVENT_NAMESPACE );
			}
			if ( native_adapter ) {
				native_adapter.teardown();
			}
			native_adapter = null;
		}

		/**
		 * Hydrate exact draft dates after the matching native availability response.
		 *
		 * @param {number} current_generation Active request generation.
		 * @param {number} attempt            Zero-based animation-frame attempt.
		 * @return {void}
		 */
		function hydrate_dates( current_generation, attempt ) {
			var hydrated;

			if ( current_generation !== generation || ! native_adapter || ! draft ) {
				return;
			}
			hydrated = native_adapter.set_exact_selected_dates( draft.selected_dates );
			if ( hydrated ) {
				draft.selected_dates = native_adapter.get_selected_dates();
				notify_loading( false );
				notify_change();
				return;
			}
			if ( attempt < 3 ) {
				window.requestAnimationFrame( function () {
					hydrate_dates( current_generation, attempt + 1 );
				} );
				return;
			}

			if ( active_response && active_response.choices && active_response.choices.selection_methods.some( function ( choice ) {
				return choice && 'individual' === choice.id;
			} ) ) {
				native_adapter.set_selection_mode( 'individual' );
				hydrated = native_adapter.set_exact_selected_dates( draft.selected_dates );
				draft.selection_method = 'individual';
			}
			draft.selected_dates = hydrated ? native_adapter.get_selected_dates() : draft.selected_dates.slice( 0 );
			notify_loading( false );
			notify_change();
			if ( ! hydrated ) {
				notify_error( { code: 'wpbc_booking_new_inspector_schedule_hydration_failed' } );
			}
		}

		/**
		 * Mount and load native availability for one current server response.
		 *
		 * @param {number} current_generation Active request generation.
		 * @return {void}
		 */
		function mount_native_calendar( current_generation ) {
			var calendar = active_response && active_response.calendar ? active_response.calendar : {};
			var adapter_factory = window.wpbc_booking_date_editor && window.wpbc_booking_date_editor.create_native_calendar_adapter;
			var active_calendar_host = get_calendar_host();

			if ( 'function' !== typeof adapter_factory || ! active_calendar_host ) {
				notify_loading( false );
				notify_error( { code: 'wpbc_booking_new_inspector_native_calendar_unavailable' } );
				return;
			}
			native_adapter = adapter_factory();
			if ( ! native_adapter.mount( active_calendar_host, {
				resource_id: active_response.resource_id,
				calendar_html: calendar.html || '',
				calendar_parameters: calendar.calendar_parameters || {},
				policy_parameters: calendar.policy_parameters || {},
				context_parameters: calendar.context_parameters || {},
				secure_parameters: calendar.secure_parameters || {}
			} ) ) {
				notify_loading( false );
				notify_error( { code: 'wpbc_booking_new_inspector_native_calendar_unavailable' } );
				return;
			}

			if ( root ) {
				$( root ).off( 'date_selected' + EVENT_NAMESPACE ).on( 'date_selected' + EVENT_NAMESPACE, function ( event, selected_resource_id, clicked_dates, selected_dates ) {
					if ( current_generation !== generation || normalize_resource_id( selected_resource_id ) !== normalize_resource_id( active_response.resource_id ) || ! draft ) {
						return;
					}
					draft.selected_dates = normalize_iso_dates( selected_dates );
					draft.seed_source = 'draft';
					draft.exact_timeline_seed = false;
					notify_change();
				} );
			}

			clear_native_timer();
			native_load_timer = window.setTimeout( function () {
				if ( current_generation === generation && native_adapter ) {
					native_adapter.abort_load();
					notify_loading( false );
					notify_error( { code: 'wpbc_booking_new_inspector_native_calendar_timeout' } );
				}
			}, NATIVE_LOAD_TIMEOUT_MS );
			if ( ! native_adapter.load( calendar.request_parameters || {}, function () {
				clear_native_timer();
				if ( current_generation !== generation || ! draft ) {
					return;
				}
				native_adapter.set_selection_mode( draft.selection_method );
				hydrate_dates( current_generation, 0 );
			}, function ( failed_request ) {
				clear_native_timer();
				if ( current_generation === generation ) {
					notify_loading( false );
					notify_error( failed_request || { code: 'wpbc_booking_new_inspector_native_calendar_failed' } );
				}
			} ) ) {
				clear_native_timer();
				notify_loading( false );
				notify_error( { code: 'wpbc_booking_new_inspector_native_calendar_unavailable' } );
			}
		}

		/**
		 * Load an authorized creation schedule and then native availability.
		 *
		 * @param {Object} request_values Data-only schedule request.
		 * @return {boolean} True when the schedule request was dispatched.
		 */
		function load( request_values ) {
			var current_generation;

			generation += 1;
			current_generation = generation;
			teardown_active_reads();
			notify_loading( true );
			pending_request = $.ajax( {
				url: configuration.ajax_url || window.ajaxurl || '',
				method: 'POST',
				dataType: 'json',
				data: {
					action: configuration.action || 'wpbc_booking_new_inspector_schedule',
					nonce: configuration.nonce || '',
					request: JSON.stringify( request_values || {} )
				}
			} ).done( function ( response ) {
				var response_data;

				if ( current_generation !== generation ) {
					return;
				}
				pending_request = null;
				response_data = response && true === response.success && response.data ? response.data : null;
				if ( ! response_data || response_data.request_id !== request_values.request_id ) {
					notify_loading( false );
					notify_error( response && response.data ? response.data : {} );
					return;
				}
				active_response = response_data;
				initial_draft = clone_schedule( response_data.schedule );
				draft = clone_schedule( initial_draft );
				if ( 'function' === typeof configuration.on_ready ) {
					configuration.on_ready( {
						schedule: clone_schedule( draft ),
						choices: response_data.choices && 'object' === typeof response_data.choices ? response_data.choices : {}
					} );
				}
				notify_change();
				mount_native_calendar( current_generation );
			} ).fail( function ( failed_request, request_status ) {
				if ( 'abort' === request_status || current_generation !== generation ) {
					return;
				}
				pending_request = null;
				notify_loading( false );
				notify_error( failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : {} );
			} );

			return true;
		}

		/**
		 * Restore the immutable server-authorized initial draft.
		 *
		 * @return {boolean} True when a mounted draft was restored.
		 */
		function reset() {
			var restored;

			if ( ! initial_draft || ! native_adapter ) {
				return false;
			}
			draft = clone_schedule( initial_draft );
			restored = native_adapter.set_selection_mode( draft.selection_method );
			restored = native_adapter.set_exact_selected_dates( draft.selected_dates ) && restored;
			notify_change();

			return restored;
		}

		/**
		 * Set one authorized local native selection mode.
		 *
		 * @param {string} selection_method Policy or individual.
		 * @return {boolean} True when accepted and applied.
		 */
		function set_selection_method( selection_method ) {
			var is_authorized;

			is_authorized = active_response && active_response.choices && active_response.choices.selection_methods.some( function ( choice ) {
				return choice && selection_method === choice.id;
			} );
			if ( ! is_authorized || ! draft || ! native_adapter || ! native_adapter.set_selection_mode( selection_method ) ) {
				return false;
			}
			draft.selection_method = selection_method;
			draft.seed_source = 'draft';
			draft.exact_timeline_seed = false;
			notify_change();

			return true;
		}

		/**
		 * Set the local time-application mode.
		 *
		 * @param {string} time_application Full day, boundary, or per date.
		 * @return {boolean} True when the server choice list permits the mode.
		 */
		function set_time_application( time_application ) {
			var is_authorized;

			is_authorized = active_response && active_response.choices && active_response.choices.time_applications.some( function ( choice ) {
				return choice && time_application === choice.id;
			} );
			if ( ! is_authorized || ! draft ) {
				return false;
			}
			draft.time_application = time_application;
			if ( 'full_day' === time_application ) {
				draft.start_time = '';
				draft.end_time = '';
			}
			draft.seed_source = 'draft';
			draft.exact_timeline_seed = false;
			notify_change();

			return true;
		}

		/**
		 * Set exact local boundary or per-date times.
		 *
		 * @param {string} start_time Exact HH:MM start.
		 * @param {string} end_time   Exact HH:MM end.
		 * @return {boolean} True when both times are valid and the draft is timed.
		 */
		function set_times( start_time, end_time ) {
			start_time = normalize_time( start_time );
			end_time = normalize_time( end_time );
			if ( ! draft || 'full_day' === draft.time_application || ! start_time || ! end_time ) {
				return false;
			}
			draft.start_time = start_time;
			draft.end_time = end_time;
			draft.seed_source = 'draft';
			draft.exact_timeline_seed = false;
			notify_change();

			return true;
		}

		/**
		 * Return an isolated copy of the current local schedule draft.
		 *
		 * @return {Object|null} Current draft or null before a successful read.
		 */
		function get_draft() {
			return draft ? clone_schedule( draft ) : null;
		}

		/**
		 * Abort reads, invalidate stale callbacks, and release native calendar state.
		 *
		 * @return {void}
		 */
		function destroy() {
			generation += 1;
			teardown_active_reads();
			initial_draft = null;
			draft = null;
			active_response = null;
			notify_loading( false );
		}

		return {
			load: load,
			reset: reset,
			set_selection_method: set_selection_method,
			set_time_application: set_time_application,
			set_times: set_times,
			get_draft: get_draft,
			is_dirty: is_dirty,
			destroy: destroy
		};
	}

	window.wpbc_booking_new_inspector = window.wpbc_booking_new_inspector || {};
	window.wpbc_booking_new_inspector.create_schedule_workflow = create_schedule_workflow;
}( window, document, jQuery ) );
