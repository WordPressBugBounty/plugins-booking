/**
 * Booking Date Editor native-calendar adapter.
 *
 * The controller opens only from an authorized Booking Inspector DTO. It asks
 * the Date Editor read endpoint for canonical calendar markup and bounded
 * initialization values, then delegates bookings and availability loading to
 * the standard native calendar request.
 *
 * Native WPBC APIs used here:
 *
 * - `window._wpbc` stores the standard calendar and page parameters.
 * - `window.wpbc_calendar_show()` initializes the existing datepicker.
 * - `window.wpbc_calendar__load_data__ajx()` requests canonical bookings and
 *   unavailable dates through `WPBC_AJX_CALENDAR_LOAD`.
 * - `window.wpbc_calendar__get_inst()` returns the mounted datepick instance.
 * - `window.wpbc_get__selected_dates_sql__as_arr()` returns every canonical
 *   selected date, including the middle dates represented only in the hidden
 *   field by native dynamic-range mode.
 * - `window.wpbc_cal_days_select__multiple()` enables native individual-date
 *   selection.
 * - `window.wpbc_cal_days_select__re_init()` and
 *   `window.wpbc_cal__re_init()` apply restored native policy parameters.
 * - `window.wpbc_calendar__scroll_to()` displays the first selected month.
 * - `window._wpbc.balancer__remove_from__wait_list()` removes a queued native
 *   load that has not created a cancellable request yet.
 * - `jQuery.datepick._formatDate()` and `_updateDatepick()` synchronize the
 *   existing instance without simulating clicks or changing availability.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

( function ( window, document, $ ) {
	'use strict';

	var EVENT_NAMESPACE = '.wpbcBookingDateEditor';
	var AJAX_CAPTURE_NAMESPACE = '.wpbcBookingDateEditorAjax';
	var MODE_INDIVIDUAL = 'individual';
	var MODE_POLICY = 'policy';
	var TIME_APPLICATION_FULL_DAY = 'full_day';
	var TIME_APPLICATION_BOUNDARY = 'boundary';
	var TIME_APPLICATION_PER_DATE = 'per_date';
	var NATIVE_LOAD_TIMEOUT_MS = 20000;
	var active_adapter = null;
	var calendar_parameter_names = [
		'is_enabled_change_over',
		'calendar_scroll_to',
		'calendar_dates_start',
		'calendar_dates_end',
		'booking_max_monthes_in_calendar',
		'booking_start_day_weeek',
		'calendar_number_of_months',
		'days_select_mode',
		'fixed__days_num',
		'fixed__week_days__start',
		'dynamic__days_min',
		'dynamic__days_max',
		'dynamic__days_specific',
		'dynamic__week_days__start',
		'range_selection_guidance_is_enabled',
		'booking_date_format',
		'booking_time_format',
		'is_parent_resource',
		'booking_capacity_field',
		'booking_is_dissbale_booking_for_different_sub_resources',
		'booking_recurrent_time',
		'saved_variable___days_select_initial',
		'conditions'
	];
	var other_parameter_names = [
		'this_page_booking_hash',
		'this_page_allow_past',
		'this_page_allow_past_arr'
	];
	var secure_parameter_names = [ 'nonce', 'user_id', 'locale' ];
	var request_parameter_names = [
		'resource_id',
		'booking_hash',
		'request_uri',
		'custom_form',
		'allow_past',
		'aggregate_resource_id_str',
		'aggregate_type',
		'skip_general_availability',
		'classic_booking_context_token'
	];

	/**
	 * Normalize one Resource identifier.
	 *
	 * @param {*} resource_id Candidate Resource identifier.
	 *
	 * @return {number} Positive Resource identifier, or zero when invalid.
	 */
	function normalize_resource_id( resource_id ) {
		resource_id = parseInt( resource_id, 10 );

		return resource_id > 0 ? resource_id : 0;
	}

	/**
	 * Normalize one Booking identifier.
	 *
	 * @param {*} booking_id Candidate Booking identifier.
	 *
	 * @return {number} Positive Booking identifier, or zero when invalid.
	 */
	function normalize_booking_id( booking_id ) {
		booking_id = parseInt( booking_id, 10 );

		return booking_id > 0 ? booking_id : 0;
	}

	/**
	 * Parse one strict ISO calendar date without a timezone conversion.
	 *
	 * @param {*} iso_date Candidate `YYYY-MM-DD` value.
	 *
	 * @return {Date|null} Local midnight date, or null when invalid.
	 */
	function parse_iso_date( iso_date ) {
		var date_match = String( iso_date || '' ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
		var parsed_date;

		if ( ! date_match ) {
			return null;
		}

		parsed_date = new Date(
			parseInt( date_match[ 1 ], 10 ),
			parseInt( date_match[ 2 ], 10 ) - 1,
			parseInt( date_match[ 3 ], 10 ),
			0,
			0,
			0,
			0
		);

		if (
			parsed_date.getFullYear() !== parseInt( date_match[ 1 ], 10 ) ||
			parsed_date.getMonth() !== parseInt( date_match[ 2 ], 10 ) - 1 ||
			parsed_date.getDate() !== parseInt( date_match[ 3 ], 10 )
		) {
			return null;
		}

		return parsed_date;
	}

	/**
	 * Format one local calendar date as a stable ISO value.
	 *
	 * @param {Date} selected_date Native datepicker date.
	 *
	 * @return {string} `YYYY-MM-DD`, or an empty string when invalid.
	 */
	function format_iso_date( selected_date ) {
		var year;
		var month;
		var day;

		if ( ! selected_date || isNaN( selected_date.getTime() ) ) {
			return '';
		}

		year = String( selected_date.getFullYear() );
		month = String( selected_date.getMonth() + 1 );
		day = String( selected_date.getDate() );

		return year + '-' + ( month.length < 2 ? '0' + month : month ) + '-' + ( day.length < 2 ? '0' + day : day );
	}

	/**
	 * Normalize, deduplicate, and order ISO date values.
	 *
	 * @param {*} selected_dates Candidate date array.
	 *
	 * @return {Array<string>} Ordered valid ISO dates.
	 */
	function normalize_iso_dates( selected_dates ) {
		var unique_dates = {};

		if ( ! Array.isArray( selected_dates ) ) {
			return [];
		}

		selected_dates.forEach( function ( selected_date ) {
			var parsed_date = parse_iso_date( selected_date );
			var normalized_date = parsed_date ? format_iso_date( parsed_date ) : '';

			if ( normalized_date ) {
				unique_dates[ normalized_date ] = true;
			}
		} );

		return Object.keys( unique_dates ).sort();
	}

	/**
	 * Normalize one exact-minute browser time without rounding.
	 *
	 * @param {*} time_value Candidate `HH:MM` value.
	 *
	 * @return {string} Exact 24-hour minute value, or an empty string.
	 */
	function normalize_exact_minute_time( time_value ) {
		time_value = String( time_value || '' );

		return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test( time_value ) ? time_value : '';
	}

	/**
	 * Copy only the server-defined native calendar parameter allow list.
	 *
	 * @param {*} calendar_parameters Candidate parameter record.
	 *
	 * @return {Object} Executable-free allow-listed parameter record.
	 */
	function normalize_calendar_parameters( calendar_parameters ) {
		var normalized_parameters = {};

		if ( ! calendar_parameters || 'object' !== typeof calendar_parameters || Array.isArray( calendar_parameters ) ) {
			return normalized_parameters;
		}

		calendar_parameter_names.forEach( function ( parameter_name ) {
			if ( Object.prototype.hasOwnProperty.call( calendar_parameters, parameter_name ) ) {
				normalized_parameters[ parameter_name ] = calendar_parameters[ parameter_name ];
			}
		} );

		return normalized_parameters;
	}

	/**
	 * Copy scalar values from one explicit allow list.
	 *
	 * @param {*}             candidate_values Candidate executable-free record.
	 * @param {Array<string>} allowed_names    Accepted property names.
	 *
	 * @return {Object} Bounded scalar record.
	 */
	function normalize_scalar_parameters( candidate_values, allowed_names ) {
		var normalized_values = {};

		if ( ! candidate_values || 'object' !== typeof candidate_values || Array.isArray( candidate_values ) ) {
			return normalized_values;
		}

		allowed_names.forEach( function ( parameter_name ) {
			var parameter_value;

			if ( ! Object.prototype.hasOwnProperty.call( candidate_values, parameter_name ) ) {
				return;
			}
			parameter_value = candidate_values[ parameter_name ];
			if ( null === parameter_value || -1 !== [ 'string', 'number', 'boolean' ].indexOf( typeof parameter_value ) ) {
				normalized_values[ parameter_name ] = parameter_value;
			}
		} );

		return normalized_values;
	}

	/**
	 * Remove every child node from a Date Editor calendar host.
	 *
	 * @param {Element|null} host Calendar host element.
	 *
	 * @return {void}
	 */
	function clear_host( host ) {
		if ( ! host ) {
			return;
		}

		while ( host.firstChild ) {
			host.removeChild( host.firstChild );
		}
	}

	/**
	 * Capture one native calendar registry entry before a temporary mount.
	 *
	 * The native calendar runtime stores Resource parameters in one global
	 * registry. A shallow property copy is sufficient here because the adapter
	 * replaces top-level parameters and does not mutate nested values inherited
	 * from another owner.
	 *
	 * @param {number} resource_id Booking Resource ID.
	 *
	 * @return {Object|null} Restorable registry snapshot, or null when unavailable.
	 */
	function capture_native_calendar_registry_entry( resource_id ) {
		var calendars;
		var registry_key;
		var registry_entry;
		var parameters = {};

		if (
			! window._wpbc ||
			'function' !== typeof window._wpbc.calendars_all__get ||
			! resource_id
		) {
			return null;
		}

		calendars = window._wpbc.calendars_all__get();
		calendars = calendars && 'object' === typeof calendars && ! Array.isArray( calendars ) ? calendars : {};
		registry_key = 'calendar_' + resource_id;

		if ( ! Object.prototype.hasOwnProperty.call( calendars, registry_key ) ) {
			return {
				key: registry_key,
				existed: false,
				parameters: null
			};
		}

		registry_entry = calendars[ registry_key ];
		if ( registry_entry && 'object' === typeof registry_entry && ! Array.isArray( registry_entry ) ) {
			Object.keys( registry_entry ).forEach( function ( parameter_name ) {
				parameters[ parameter_name ] = registry_entry[ parameter_name ];
			} );
		}

		return {
			key: registry_key,
			existed: true,
			parameters: parameters
		};
	}

	/**
	 * Restore or remove one temporary native calendar registry entry.
	 *
	 * Existing entries are restored without replacing other Resource entries.
	 * Entries created solely for an Inspector mount are removed so later mounts
	 * cannot inherit stale policy parameters from an earlier Resource.
	 *
	 * @param {Object|null} registry_snapshot Snapshot returned by the capture helper.
	 *
	 * @return {boolean} True when the registry was restored.
	 */
	function restore_native_calendar_registry_entry( registry_snapshot ) {
		var calendars;

		if (
			! registry_snapshot ||
			'string' !== typeof registry_snapshot.key ||
			! window._wpbc ||
			'function' !== typeof window._wpbc.calendars_all__get ||
			'function' !== typeof window._wpbc.calendars_all__set
		) {
			return false;
		}

		calendars = window._wpbc.calendars_all__get();
		calendars = calendars && 'object' === typeof calendars && ! Array.isArray( calendars ) ? calendars : {};

		if ( registry_snapshot.existed ) {
			calendars[ registry_snapshot.key ] = registry_snapshot.parameters || {};
		} else {
			delete calendars[ registry_snapshot.key ];
		}

		window._wpbc.calendars_all__set( calendars );

		return true;
	}

	/**
	 * Create one dormant native-calendar adapter.
	 *
	 * Only one adapter may own a mounted native calendar because WPBC calendars
	 * are keyed globally by Resource ID and use stable DOM identifiers.
	 *
	 * @return {Object} Controlled adapter API for the future Date Editor controller.
	 */
	function create_native_calendar_adapter() {
		var host = null;
		var resource_id = 0;
		var load_generation = 0;
		var pending_calendar_request = null;
		var policy_parameters = {};
		var calendar_registry_snapshot = null;
		var previous_other_parameters = {};
		var previous_secure_parameters = {};

		/**
		 * Confirm that every required native calendar API is available.
		 *
		 * @return {boolean} True when the standard runtime is ready.
		 */
		function has_native_api() {
			return Boolean(
				window._wpbc &&
				'function' === typeof window._wpbc.calendars_all__get &&
				'function' === typeof window._wpbc.calendars_all__set &&
				'function' === typeof window._wpbc.calendar__set_parameters &&
				'function' === typeof window._wpbc.calendar__get_param_value &&
				'function' === typeof window._wpbc.set_other_param &&
				'function' === typeof window._wpbc.get_other_param &&
				'function' === typeof window._wpbc.set_secure_param &&
				'function' === typeof window._wpbc.get_secure_param &&
				'function' === typeof window.wpbc_calendar_show &&
				'function' === typeof window.wpbc_calendar__load_data__ajx &&
				'function' === typeof window.wpbc_calendar__get_inst &&
				$.datepick &&
				'function' === typeof $.datepick._formatDate &&
				'function' === typeof $.datepick._updateDatepick
			);
		}

		/**
		 * Preserve and apply native AJAX security parameters for this mount.
		 *
		 * Native security state is global. The active-instance guard and teardown
		 * restoration ensure this editor cannot leak its nonce or locale into a
		 * later calendar consumer on the same administration page.
		 *
		 * @param {*} secure_parameters Authorized native security parameters.
		 *
		 * @return {void}
		 */
		function apply_secure_parameters( secure_parameters ) {
			var normalized_parameters = normalize_scalar_parameters( secure_parameters, secure_parameter_names );

			secure_parameter_names.forEach( function ( parameter_name ) {
				if ( ! Object.prototype.hasOwnProperty.call( normalized_parameters, parameter_name ) ) {
					return;
				}
				previous_secure_parameters[ parameter_name ] = window._wpbc.get_secure_param( parameter_name );
				window._wpbc.set_secure_param( parameter_name, normalized_parameters[ parameter_name ] );
			} );
		}

		/**
		 * Store and apply bounded native calendar parameters.
		 *
		 * @param {Object} calendar_parameters Allow-listed server values.
		 *
		 * @return {void}
		 */
		function apply_calendar_parameters( calendar_parameters ) {
			var normalized_parameters = normalize_calendar_parameters( calendar_parameters );

			window._wpbc.calendar__set_parameters( resource_id, normalized_parameters );
		}

		/**
		 * Store and apply the narrow global edit context used by native calendars.
		 *
		 * @param {*} context_parameters Candidate edit-context record.
		 *
		 * @return {void}
		 */
		function apply_context_parameters( context_parameters ) {
			if ( ! context_parameters || 'object' !== typeof context_parameters || Array.isArray( context_parameters ) ) {
				return;
			}

			other_parameter_names.forEach( function ( parameter_name ) {
				if ( ! Object.prototype.hasOwnProperty.call( context_parameters, parameter_name ) ) {
					return;
				}
				previous_other_parameters[ parameter_name ] = window._wpbc.get_other_param( parameter_name );
				window._wpbc.set_other_param( parameter_name, context_parameters[ parameter_name ] );
			} );
		}

		/**
		 * Read the complete canonical selection from the native calendar.
		 *
		 * Dynamic range mode stores only its boundary dates on the datepick instance,
		 * while the native helper returns the complete selection represented by the
		 * calendar's canonical hidden value. The instance remains a compatibility
		 * fallback for older native runtimes that do not expose that helper.
		 *
		 * @return {Array<string>} Ordered selected ISO dates.
		 */
		function get_selected_dates() {
			var calendar_instance;
			var selected_dates;

			if ( ! resource_id || 'function' !== typeof window.wpbc_calendar__get_inst ) {
				return [];
			}

			if ( 'function' === typeof window.wpbc_get__selected_dates_sql__as_arr ) {
				return normalize_iso_dates( window.wpbc_get__selected_dates_sql__as_arr( resource_id ) );
			}

			calendar_instance = window.wpbc_calendar__get_inst( resource_id );
			selected_dates = calendar_instance && Array.isArray( calendar_instance.dates )
				? calendar_instance.dates.map( format_iso_date )
				: [];

			return normalize_iso_dates( selected_dates );
		}

		/**
		 * Restore exact authorized dates without availability-gated click replay.
		 *
		 * This operation changes selection only. Existing availability data and day
		 * styling remain owned by the native calendar AJAX response.
		 *
		 * @param {Array<string>} selected_dates Exact saved or draft ISO dates.
		 *
		 * @return {boolean} True when the mounted instance was synchronized.
		 */
		function set_exact_selected_dates( selected_dates ) {
			var normalized_dates = normalize_iso_dates( selected_dates );
			var calendar_instance = window.wpbc_calendar__get_inst( resource_id );
			var native_dates;
			var hidden_date_field;
			var applied_dates;

			if ( ! calendar_instance ) {
				return false;
			}

			native_dates = normalized_dates.map( parse_iso_date ).filter( function ( selected_date ) {
				return null !== selected_date;
			} );
			hidden_date_field = document.getElementById( 'date_booking' + resource_id );

			calendar_instance.stayOpen = false;
			calendar_instance.dates = native_dates;
			if ( hidden_date_field ) {
				hidden_date_field.value = native_dates.map( function ( selected_date ) {
					return $.datepick._formatDate( calendar_instance, selected_date );
				} ).join( ', ' );
			}
			$.datepick._updateDatepick( calendar_instance );

			if ( native_dates.length && 'function' === typeof window.wpbc_calendar__scroll_to ) {
				window.wpbc_calendar__scroll_to(
					resource_id,
					native_dates[ 0 ].getFullYear(),
					native_dates[ 0 ].getMonth() + 1
				);
			}

			applied_dates = get_selected_dates();

			return normalized_dates.join( '|' ) === applied_dates.join( '|' );
		}

		/**
		 * Mount canonical server-rendered calendar markup and initialize datepick.
		 *
		 * @param {Element} calendar_host Empty Date Editor calendar host.
		 * @param {Object} mount_configuration Authorized, executable-free configuration.
		 *
		 * @return {boolean} True when this adapter owns an initialized calendar.
		 */
		function mount( calendar_host, mount_configuration ) {
			var requested_resource_id;
			var existing_calendar;

			mount_configuration = mount_configuration || {};
			requested_resource_id = normalize_resource_id( mount_configuration.resource_id );

			if (
				active_adapter ||
				! has_native_api() ||
				! calendar_host ||
				1 !== calendar_host.nodeType ||
				! requested_resource_id ||
				'string' !== typeof mount_configuration.calendar_html
			) {
				return false;
			}

			existing_calendar = document.getElementById( 'calendar_booking' + requested_resource_id );
			if ( existing_calendar && ! calendar_host.contains( existing_calendar ) ) {
				return false;
			}

			active_adapter = adapter_api;
			host = calendar_host;
			resource_id = requested_resource_id;
			calendar_registry_snapshot = capture_native_calendar_registry_entry( resource_id );
			policy_parameters = normalize_calendar_parameters( mount_configuration.policy_parameters );
			apply_calendar_parameters( mount_configuration.calendar_parameters );
			apply_context_parameters( mount_configuration.context_parameters );
			apply_secure_parameters( mount_configuration.secure_parameters );
			host.innerHTML = mount_configuration.calendar_html;

			if ( ! document.getElementById( 'calendar_booking' + resource_id ) || false === window.wpbc_calendar_show( resource_id ) ) {
				teardown();
				return false;
			}

			return true;
		}

		/**
		 * Start the canonical WPBC calendar-data request for this Resource.
		 *
		 * @param {Object}   request_parameters Standard calendar request parameters.
		 * @param {Function} on_loaded          Called only for this adapter's current load.
		 * @param {Function} on_failed          Called for a non-aborted matching request failure.
		 *
		 * @return {boolean} True when the request was dispatched.
		 */
		function load( request_parameters, on_loaded, on_failed ) {
			var current_generation;
			var normalized_request;
			var capture_handler;

			if ( active_adapter !== adapter_api || ! resource_id || 'function' !== typeof window.wpbc_calendar__load_data__ajx ) {
				return false;
			}

			abort_load();
			current_generation = load_generation;
			normalized_request = normalize_scalar_parameters( request_parameters, request_parameter_names );
			normalized_request.resource_id = resource_id;
			$( 'body' ).off( 'wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE );
			$( 'body' ).on( 'wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE, function ( event, loaded_resource_id ) {
				if (
					active_adapter !== adapter_api ||
					current_generation !== load_generation ||
					resource_id !== normalize_resource_id( loaded_resource_id ) ||
					! pending_calendar_request ||
					4 !== pending_calendar_request.readyState
				) {
					return;
				}

				$( 'body' ).off( 'wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE );
				$( document ).off( 'ajaxSend' + AJAX_CAPTURE_NAMESPACE );
				pending_calendar_request = null;
				if ( 'function' === typeof on_loaded ) {
					on_loaded( resource_id );
				}
			} );
			capture_handler = function ( event, jq_xhr, ajax_settings ) {
				var request_body = String( ajax_settings && ajax_settings.data ? ajax_settings.data : '' );
				var decoded_body;

				try {
					decoded_body = decodeURIComponent( request_body.replace( /\+/g, '%20' ) );
				} catch ( decode_error ) {
					decoded_body = request_body;
				}
				if (
					! /(?:^|&)action=WPBC_AJX_CALENDAR_LOAD(?:&|$)/.test( decoded_body ) ||
					! new RegExp( '(?:^|&)calendar_request_params\\[resource_id\\]=' + resource_id + '(?:&|$)' ).test( decoded_body )
				) {
					return;
				}
				$( document ).off( 'ajaxSend' + AJAX_CAPTURE_NAMESPACE, capture_handler );
				pending_calendar_request = jq_xhr;
				jq_xhr.fail( function ( failed_request, request_status ) {
					if (
					'abort' === request_status ||
					active_adapter !== adapter_api ||
					current_generation !== load_generation
				) {
						return;
					}
					$( 'body' ).off( 'wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE );
					pending_calendar_request = null;
					if ( 'function' === typeof on_failed ) {
						on_failed( failed_request );
					}
				} );
			};
			$( document ).off( 'ajaxSend' + AJAX_CAPTURE_NAMESPACE );
			$( document ).on( 'ajaxSend' + AJAX_CAPTURE_NAMESPACE, capture_handler );
			window.wpbc_calendar__load_data__ajx( normalized_request );

			return true;
		}

		/**
		 * Abort the adapter's matching native request and invalidate its callbacks.
		 *
		 * @return {void}
		 */
		function abort_load() {
			load_generation += 1;
			$( 'body' ).off( 'wpbc_calendar_ajx__loaded_data' + EVENT_NAMESPACE );
			$( document ).off( 'ajaxSend' + AJAX_CAPTURE_NAMESPACE );
			if ( window._wpbc && 'function' === typeof window._wpbc.balancer__remove_from__wait_list && resource_id ) {
				window._wpbc.balancer__remove_from__wait_list( resource_id, 'wpbc_calendar__load_data__ajx' );
			}
			if ( pending_calendar_request && 'function' === typeof pending_calendar_request.abort ) {
				pending_calendar_request.abort();
			}
			pending_calendar_request = null;
		}

		/**
		 * Switch between native policy and individual-date selection.
		 *
		 * @param {string} selection_mode `policy` or `individual`.
		 *
		 * @return {boolean} True when the native selection mode was applied.
		 */
		function set_selection_mode( selection_mode ) {
			var selected_dates;

			if ( active_adapter !== adapter_api || ! resource_id ) {
				return false;
			}

			selected_dates = get_selected_dates();
			if ( MODE_INDIVIDUAL === selection_mode ) {
				if ( 'function' !== typeof window.wpbc_cal_days_select__multiple ) {
					return false;
				}
				window.wpbc_cal_days_select__multiple( resource_id );
			} else if ( MODE_POLICY === selection_mode ) {
				if (
					'function' !== typeof window.wpbc_cal_days_select__re_init ||
					'function' !== typeof window.wpbc_cal__re_init
				) {
					return false;
				}
				window._wpbc.calendar__set_parameters( resource_id, policy_parameters );
				window.wpbc_cal_days_select__re_init( resource_id );
				window.wpbc_cal__re_init( resource_id );
			} else {
				return false;
			}

			// Policy changes may reject the existing shape. Preserve it directly when
			// possible, but keep the editor usable when the policy cannot reselect it.
			set_exact_selected_dates( selected_dates );

			return true;
		}

		/**
		 * Tear down only state owned by this adapter.
		 *
		 * @return {void}
		 */
		function teardown() {
			var calendar_element;

			abort_load();

			calendar_element = resource_id ? document.getElementById( 'calendar_booking' + resource_id ) : null;
			if ( calendar_element && $.fn.datepick ) {
				try {
					$( calendar_element ).datepick( 'destroy' );
				} catch ( destroy_error ) {
					// A partially initialized calendar still needs its owned markup removed.
				}
			}

			if ( window._wpbc && resource_id ) {
				restore_native_calendar_registry_entry( calendar_registry_snapshot );
				Object.keys( previous_other_parameters ).forEach( function ( parameter_name ) {
					window._wpbc.set_other_param( parameter_name, previous_other_parameters[ parameter_name ] );
				} );
				Object.keys( previous_secure_parameters ).forEach( function ( parameter_name ) {
					window._wpbc.set_secure_param( parameter_name, previous_secure_parameters[ parameter_name ] );
				} );
			}

			clear_host( host );
			host = null;
			resource_id = 0;
			policy_parameters = {};
			calendar_registry_snapshot = null;
			previous_other_parameters = {};
			previous_secure_parameters = {};
			if ( active_adapter === adapter_api ) {
				active_adapter = null;
			}
		}

		var adapter_api = {
			mount: mount,
			load: load,
			abort_load: abort_load,
			set_exact_selected_dates: set_exact_selected_dates,
			set_selection_mode: set_selection_mode,
			get_selected_dates: get_selected_dates,
			teardown: teardown
		};

		return adapter_api;
	}

	/**
	 * Clone the small JSON-safe Date Editor draft contract.
	 *
	 * @param {Object} editor_draft Date Editor draft.
	 *
	 * @return {Object} Independent draft copy.
	 */
	function clone_editor_draft( editor_draft ) {
		editor_draft = editor_draft && 'object' === typeof editor_draft ? editor_draft : {};

		return {
			selection_method: MODE_INDIVIDUAL === editor_draft.selection_method ? MODE_INDIVIDUAL : MODE_POLICY,
			time_application: -1 !== [ TIME_APPLICATION_FULL_DAY, TIME_APPLICATION_BOUNDARY, TIME_APPLICATION_PER_DATE ].indexOf( editor_draft.time_application ) ? editor_draft.time_application : TIME_APPLICATION_FULL_DAY,
			start_time: normalize_exact_minute_time( editor_draft.start_time ),
			end_time: normalize_exact_minute_time( editor_draft.end_time ),
			selected_dates: normalize_iso_dates( editor_draft.selected_dates )
		};
	}

	/**
	 * Create the immutable authorized saved snapshot.
	 *
	 * Freezing both levels prevents hydration fallback or later interaction from
	 * silently rewriting the canonical comparison source.
	 *
	 * @param {Object} editor_draft Authorized initial Date Editor values.
	 *
	 * @return {Object} Frozen saved snapshot.
	 */
	function freeze_editor_draft( editor_draft ) {
		var frozen_draft = clone_editor_draft( editor_draft );

		Object.freeze( frozen_draft.selected_dates );

		return Object.freeze( frozen_draft );
	}

	/**
	 * Build the semantic proposal used for dirty comparison.
	 *
	 * Full-day proposals retain time inputs in browser memory so switching modes
	 * is lossless, but the effective proposal deliberately has no boundaries.
	 *
	 * @param {Object} editor_draft Saved or mutable browser draft.
	 *
	 * @return {Object} Normalized non-persistent proposal.
	 */
	function get_effective_editor_draft( editor_draft ) {
		var effective_draft = clone_editor_draft( editor_draft );

		if ( TIME_APPLICATION_FULL_DAY === effective_draft.time_application ) {
			effective_draft.start_time = '';
			effective_draft.end_time = '';
		}

		return effective_draft;
	}

	/**
	 * Substitute ordered time values into one localized label template.
	 *
	 * @param {string}        label_template Localized `%s` or numbered placeholder template.
	 * @param {Array<string>} time_values    Exact-minute replacement values.
	 *
	 * @return {string} Localized time label.
	 */
	function format_editor_time_label( label_template, time_values ) {
		var formatted_label = String( label_template || '' );

		time_values.forEach( function ( time_value, time_index ) {
			formatted_label = formatted_label.replace( '%' + ( time_index + 1 ) + '$s', time_value );
			if ( 0 === time_index ) {
				formatted_label = formatted_label.replace( '%s', time_value );
			}
		} );

		return formatted_label;
	}

	/**
	 * Create the Date Editor interaction controller inside one Inspector shell.
	 *
	 * The controller owns browser drafts, native-calendar lifecycle, review
	 * presentation, and transport to the authoritative apply endpoint. It never
	 * authorizes a booking or treats native calendar state as persistence
	 * authority.
	 *
	 * @param {HTMLElement} inspector_shell Booking Inspector shell root.
	 * @param {Object}      configuration   Server-owned Date Editor configuration.
	 * @param {Object}      options         Inspector-owned transport and focus callbacks.
	 *
	 * @return {Object|null} Date Editor controller, or null when inactive.
	 */
	function create_controller( inspector_shell, configuration, options ) {
		var settings = configuration && 'object' === typeof configuration ? configuration : {};
		var controller_options = options && 'object' === typeof options ? options : {};
		var i18n = settings.i18n && 'object' === typeof settings.i18n ? settings.i18n : {};
		var read_settings = settings.read && 'object' === typeof settings.read ? settings.read : {};
		var review_settings = settings.review && 'object' === typeof settings.review ? settings.review : {};
		var apply_settings = settings.apply && 'object' === typeof settings.apply ? settings.apply : {};
		var template = window.wp && 'function' === typeof window.wp.template && settings.template_id
			? window.wp.template( settings.template_id )
			: null;
		var review_template = window.wp && 'function' === typeof window.wp.template && settings.review_template_id
			? window.wp.template( settings.review_template_id )
			: null;
		var inspector_panel = inspector_shell ? inspector_shell.querySelector( '.wpbc_shared_ui_inspector__panel' ) : null;
		var layer = null;
		var opener = null;
		var read_request = null;
		var review_request = null;
		var apply_request = null;
		var native_adapter = null;
		var active_editor = null;
		var active_review = null;
		var pending_apply_result = null;
		var saved_draft = null;
		var draft = null;
		var controller_generation = 0;
		var review_generation = 0;
		var apply_generation = 0;
		var native_load_timer = null;
		var dirty = false;

		if ( ! settings.active || ! inspector_shell || ! inspector_panel || ! template || ! review_template || ! window.jQuery ) {
			return null;
		}

		/**
		 * Announce and display one lifecycle message with accessible severity.
		 *
		 * @param {string}  message       Localized status message.
		 * @param {boolean} show_visually Whether the message needs a visible strip.
		 * @param {string}  [status_type] Optional warning or error severity.
		 *
		 * @return {void}
		 */
		function set_status( message, show_visually, status_type ) {
			var status = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-status]' ) : null;
			var is_visible = Boolean( show_visually && message );
			var normalized_status_type = 'error' === status_type ? 'error' : 'warning';

			if ( status ) {
				status.textContent = String( message || '' );
				status.classList.toggle( 'is-visible', is_visible );
				status.classList.toggle( 'is-warning', is_visible && 'warning' === normalized_status_type );
				status.classList.toggle( 'is-error', is_visible && 'error' === normalized_status_type );
				status.classList.remove( 'is-emphasized' );
				status.setAttribute( 'role', is_visible && 'error' === normalized_status_type ? 'alert' : 'status' );
				status.setAttribute( 'aria-live', is_visible && 'error' === normalized_status_type ? 'assertive' : 'polite' );

				if ( is_visible ) {
					// Restart the bounded emphasis when the same validation message is repeated.
					void status.offsetWidth;
					status.classList.add( 'is-emphasized' );
				}
			}
		}

		/**
		 * Show the established centered Inspector loading presentation.
		 *
		 * The visible loader mirrors the shared Inspector shell. Lifecycle text is
		 * also copied to the hidden live region so loading remains announced without
		 * reserving a persistent message strip above the editor.
		 *
		 * @param {string} message Localized loading message.
		 *
		 * @return {void}
		 */
		function show_loading( message ) {
			var loading = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-loading]' ) : null;
			var loading_label = loading ? loading.querySelector( '[data-wpbc-booking-date-editor-loading-label]' ) : null;
			var error_box = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-error]' ) : null;
			var editor_view = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-view="editor"]' ) : null;
			var review_view = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-view="review"]' ) : null;

			if ( error_box ) {
				error_box.hidden = true;
			}
			if ( editor_view ) {
				editor_view.hidden = true;
			}
			if ( review_view ) {
				review_view.hidden = true;
			}
			if ( loading_label ) {
				loading_label.textContent = String( message || i18n.loading_dates || '' );
			}
			if ( loading ) {
				loading.hidden = false;
			}
			set_status( message, false );
			if ( layer ) {
				layer.setAttribute( 'aria-busy', 'true' );
			}
		}

		/**
		 * Clear the native load timeout.
		 *
		 * @return {void}
		 */
		function clear_native_load_timer() {
			if ( null !== native_load_timer ) {
				window.clearTimeout( native_load_timer );
				native_load_timer = null;
			}
		}

		/**
		 * Notify the Inspector when this secondary layer changes dirty state.
		 *
		 * @return {void}
		 */
		function update_dirty_state() {
			var next_dirty = Boolean(
				saved_draft &&
				draft &&
				JSON.stringify( get_effective_editor_draft( saved_draft ) ) !== JSON.stringify( get_effective_editor_draft( draft ) )
			);

			if ( dirty === next_dirty ) {
				return;
			}
			dirty = next_dirty;
			if ( 'function' === typeof controller_options.on_dirty_change ) {
				controller_options.on_dirty_change( dirty );
			}
		}

		/**
		 * Remove the active layer and restore every native global it changed.
		 *
		 * @return {void}
		 */
		function teardown_layer() {
			controller_generation += 1;
			review_generation += 1;
			apply_generation += 1;
			clear_native_load_timer();
			if ( read_request && 'function' === typeof read_request.abort ) {
				read_request.abort();
			}
			read_request = null;
			if ( review_request && 'function' === typeof review_request.abort ) {
				review_request.abort();
			}
			review_request = null;
			if ( apply_request && 'function' === typeof apply_request.abort ) {
				apply_request.abort();
			}
			apply_request = null;
			if ( native_adapter ) {
				native_adapter.teardown();
			}
			native_adapter = null;
			if ( layer ) {
				window.jQuery( layer ).off( 'date_selected' + EVENT_NAMESPACE );
				layer.remove();
			}
			layer = null;
			active_editor = null;
			active_review = null;
			pending_apply_result = null;
			saved_draft = null;
			draft = null;
			dirty = false;
			if ( 'function' === typeof controller_options.on_dirty_change ) {
				controller_options.on_dirty_change( false );
			}
		}

		/**
		 * Resolve the best current focus target after the layer closes.
		 *
		 * @return {HTMLElement|null} Connected focus target or null.
		 */
		function get_restore_focus_target() {
			var fallback_focus;

			if ( opener && opener.isConnected && 'function' === typeof opener.focus ) {
				return opener;
			}
			fallback_focus = 'function' === typeof controller_options.get_restore_focus
				? controller_options.get_restore_focus()
				: null;

			return fallback_focus && fallback_focus.isConnected && 'function' === typeof fallback_focus.focus
				? fallback_focus
				: null;
		}

		/**
		 * Close the secondary layer with optional dirty protection.
		 *
		 * @param {boolean} restore_focus Whether to restore the activating control.
		 * @param {boolean} force         Whether an already-approved parent close skips prompting.
		 *
		 * @return {boolean} True when the layer is closed or was already closed.
		 */
		function close( restore_focus, force ) {
			var focus_target;

			if ( ! layer ) {
				return true;
			}
			if ( dirty && ! force && ! window.confirm( i18n.discard_changes || '' ) ) {
				return false;
			}
			focus_target = restore_focus ? get_restore_focus_target() : null;
			teardown_layer();
			opener = null;
			if ( focus_target ) {
				window.setTimeout( function () {
					if ( focus_target.isConnected ) {
						focus_target.focus();
					}
				}, 0 );
			}

			return true;
		}

		/**
		 * Render a fresh single Date Editor layer from the allow-listed template.
		 *
		 * @param {Object} template_values Authorized or empty presentation values.
		 *
		 * @return {HTMLElement|null} Rendered layer.
		 */
		function render_layer( template_values ) {
			var render_host = document.createElement( 'div' );
			var rendered_layer;
			var restore_layer_focus = Boolean( layer && layer.contains( document.activeElement ) );

			if ( layer ) {
				layer.remove();
				layer = null;
			}
			render_host.innerHTML = template( Object.assign( {
				inspector_id: 'wpbc_booking_inspector',
				i18n: i18n,
				selected_dates: []
			}, template_values || {} ) );
			rendered_layer = render_host.querySelector( '[data-wpbc-booking-date-editor-layer]' );
			if ( ! rendered_layer ) {
				return null;
			}
			inspector_panel.appendChild( rendered_layer );
			layer = rendered_layer;
			layer.hidden = false;
			if ( restore_layer_focus ) {
				window.requestAnimationFrame( function () {
					if ( layer ) {
						layer.focus();
					}
				} );
			}

			return layer;
		}

		/**
		 * Toggle the editable/error presentation without replacing native markup.
		 *
		 * @param {string}  message    Safe localized or endpoint-normalized message.
		 * @param {boolean} allow_retry Whether Retry remains available.
		 *
		 * @return {void}
		 */
		function show_error( message, allow_retry ) {
			var loading = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-loading]' ) : null;
			var error_box = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-error]' ) : null;
			var error_message = error_box ? error_box.querySelector( '[data-wpbc-booking-date-editor-error-message]' ) : null;
			var retry_button = error_box ? error_box.querySelector( '[data-wpbc-booking-date-editor-retry]' ) : null;
			var editor_view = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-view="editor"]' ) : null;
			var calendar_host = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-calendar-host]' ) : null;

			clear_native_load_timer();
			if ( loading ) {
				loading.hidden = true;
			}
			if ( editor_view ) {
				editor_view.hidden = true;
			}
			if ( error_box ) {
				error_box.hidden = false;
			}
			if ( error_message ) {
				error_message.textContent = String( message || i18n.load_error || '' );
			}
			if ( retry_button ) {
				retry_button.hidden = ! allow_retry;
			}
			if ( calendar_host ) {
				calendar_host.setAttribute( 'aria-busy', 'false' );
			}
			set_status( message, false );
			layer.setAttribute( 'aria-busy', 'false' );
		}

		/**
		 * Show controls after the native calendar has loaded.
		 *
		 * @param {string}  message        Completion or non-terminal warning.
		 * @param {boolean} display_warning Whether the message is an actionable visible warning.
		 *
		 * @return {void}
		 */
		function show_ready( message, display_warning ) {
			var loading = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-loading]' ) : null;
			var error_box = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-error]' ) : null;
			var editor_view = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-view="editor"]' ) : null;
			var calendar_host = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-calendar-host]' ) : null;

			if ( loading ) {
				loading.hidden = true;
			}
			if ( error_box ) {
				error_box.hidden = true;
			}
			if ( editor_view ) {
				editor_view.hidden = false;
			}
			if ( calendar_host ) {
				calendar_host.setAttribute( 'aria-busy', 'false' );
			}
			set_status( message, display_warning, 'warning' );
			layer.setAttribute( 'aria-busy', 'false' );
		}

		/**
		 * Determine whether the local draft is complete enough for server review.
		 *
		 * This is advisory only. The review endpoint repeats strict normalization,
		 * authorization, policy, time, and availability validation.
		 *
		 * @return {boolean} True when the Review changes request may be submitted.
		 */
		function is_draft_reviewable() {
			if ( ! draft || ! dirty || ! draft.selected_dates.length ) {
				return false;
			}

			return TIME_APPLICATION_FULL_DAY === draft.time_application || Boolean(
				normalize_exact_minute_time( draft.start_time ) && normalize_exact_minute_time( draft.end_time )
			);
		}

		/**
		 * Synchronize time-control visibility and selected-date summaries.
		 *
		 * @return {void}
		 */
		function render_draft_state() {
			var time_fields = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-time-fields]' ) : null;
			var time_help = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-time-help]' ) : null;
			var time_controls = layer ? layer.querySelectorAll( '[data-wpbc-booking-date-editor-time]' ) : [];
			var selected_list = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-selected-dates]' ) : null;
			var selected_output = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-summary="selected_dates"]' ) : null;
			var calendar_output = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-summary="calendar_days"]' ) : null;
			var nights_output = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-summary="nights"]' ) : null;
			var time_output = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-summary="time"]' ) : null;
			var review_button = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-review]' ) : null;
			var is_full_day;
			var time_interval;

			if ( ! draft ) {
				return;
			}
			is_full_day = TIME_APPLICATION_FULL_DAY === draft.time_application;
			time_interval = format_editor_time_label(
				i18n.time_interval || '%1$s – %2$s',
				[ draft.start_time, draft.end_time ]
			);
			if ( time_fields ) {
				time_fields.hidden = is_full_day;
			}
			if ( time_help ) {
				time_help.hidden = TIME_APPLICATION_PER_DATE !== draft.time_application;
			}
			Array.prototype.forEach.call( time_controls, function ( time_control ) {
				time_control.disabled = is_full_day;
			} );
			if ( selected_output ) {
				selected_output.textContent = String( draft.selected_dates.length );
			}
			if ( calendar_output ) {
				calendar_output.textContent = String( draft.selected_dates.length );
			}
			if ( nights_output ) {
				nights_output.textContent = String( TIME_APPLICATION_BOUNDARY === draft.time_application ? Math.max( 0, draft.selected_dates.length - 1 ) : 0 );
			}
			if ( time_output ) {
				time_output.textContent = is_full_day ? String( i18n.full_day || i18n.full_days || '' ) : time_interval;
			}
			if ( selected_list ) {
				selected_list.textContent = '';
				if ( ! draft.selected_dates.length ) {
					var empty_entry = document.createElement( 'li' );
					empty_entry.className = 'wpbc_booking_inspector__muted';
					empty_entry.textContent = String( i18n.no_selected_dates || '' );
					selected_list.appendChild( empty_entry );
				} else {
					draft.selected_dates.forEach( function ( selected_date, date_index ) {
						var date_entry = document.createElement( 'li' );
						var date_value = document.createElement( 'span' );
						var date_meta = document.createElement( 'span' );
						var is_first_date = 0 === date_index;
						var is_last_date = draft.selected_dates.length - 1 === date_index;

						date_value.setAttribute( 'data-wpbc-booking-date-editor-selected-date-value', '' );
						date_value.textContent = selected_date;
						date_meta.className = 'wpbc_booking_inspector__date_editor_selected_date_meta';
						date_meta.setAttribute( 'data-wpbc-booking-date-editor-selected-date-meta', '' );
						if ( is_full_day ) {
							date_meta.textContent = String( i18n.full_day || i18n.full_days || '' );
						} else if ( TIME_APPLICATION_PER_DATE === draft.time_application || ( is_first_date && is_last_date ) ) {
							date_meta.textContent = time_interval;
						} else if ( is_first_date ) {
							date_meta.textContent = format_editor_time_label( i18n.starts_at_time || 'Starts at %s', [ draft.start_time ] );
						} else if ( is_last_date ) {
							date_meta.textContent = format_editor_time_label( i18n.ends_at_time || 'Ends at %s', [ draft.end_time ] );
						} else {
							date_meta.textContent = String( i18n.full_day || i18n.full_days || '' );
						}
						date_entry.appendChild( date_value );
						date_entry.appendChild( date_meta );
						selected_list.appendChild( date_entry );
					} );
				}
			}
			update_dirty_state();
			if ( review_button ) {
				review_button.disabled = ! is_draft_reviewable();
				review_button.setAttribute( 'aria-disabled', is_draft_reviewable() ? 'false' : 'true' );
			}
		}

		/**
		 * Hydrate every current draft date after the matching native loaded event.
		 *
		 * A short animation-frame retry accommodates the datepicker's own refresh.
		 * Failure is non-terminal: individual selection remains available and the
		 * user receives a warning instead of a closed or unusable editor.
		 *
		 * @param {number} generation Current controller generation.
		 * @param {number} attempt    Zero-based hydration attempt.
		 *
		 * @return {void}
		 */
		function hydrate_draft_dates( generation, attempt ) {
			var hydration_complete;

			if ( generation !== controller_generation || ! native_adapter || ! draft ) {
				return;
			}
			hydration_complete = native_adapter.set_exact_selected_dates( draft.selected_dates );
			if ( hydration_complete ) {
				draft.selected_dates = native_adapter.get_selected_dates();
				render_draft_state();
				show_ready( i18n.calendar_loaded || '', false );
				return;
			}
			if ( attempt < 3 ) {
				window.requestAnimationFrame( function () {
					hydrate_draft_dates( generation, attempt + 1 );
				} );
				return;
			}

			native_adapter.set_selection_mode( MODE_INDIVIDUAL );
			hydration_complete = native_adapter.set_exact_selected_dates( draft.selected_dates );
			draft.selection_method = MODE_INDIVIDUAL;
			Array.prototype.forEach.call( layer.querySelectorAll( '[data-wpbc-booking-date-editor-selection-method]' ), function ( control ) {
				control.checked = MODE_INDIVIDUAL === control.value;
			} );
			draft.selected_dates = hydration_complete ? native_adapter.get_selected_dates() : draft.selected_dates.slice( 0 );
			render_draft_state();
			show_ready( i18n.hydration_warning || '', true );
		}

		/**
		 * Mount and load the standard native calendar for an authorized editor DTO.
		 *
		 * @param {number} generation Current controller generation.
		 *
		 * @return {void}
		 */
		function mount_native_calendar( generation ) {
			var calendar = active_editor && active_editor.calendar ? active_editor.calendar : {};
			var calendar_host = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-calendar-host]' ) : null;

			native_adapter = create_native_calendar_adapter();
			if ( calendar_host ) {
				calendar_host.setAttribute( 'aria-busy', 'true' );
			}
			if ( ! native_adapter.mount( calendar_host, {
				resource_id: active_editor.resource_id,
				calendar_html: calendar.html || '',
				calendar_parameters: calendar.calendar_parameters || {},
				policy_parameters: calendar.policy_parameters || {},
				context_parameters: calendar.context_parameters || {},
				secure_parameters: calendar.secure_parameters || {}
			} ) ) {
				show_error( i18n.calendar_error || '', true );
				return;
			}

			window.jQuery( layer ).off( 'date_selected' + EVENT_NAMESPACE ).on( 'date_selected' + EVENT_NAMESPACE, function ( event, selected_resource_id, clicked_dates, selected_dates ) {
				if ( generation !== controller_generation || normalize_resource_id( selected_resource_id ) !== normalize_resource_id( active_editor.resource_id ) || ! draft ) {
					return;
				}
				draft.selected_dates = normalize_iso_dates( selected_dates );
				render_draft_state();
			} );
			set_status( i18n.loading_calendar || '', false );
			clear_native_load_timer();
			native_load_timer = window.setTimeout( function () {
				if ( generation === controller_generation && layer ) {
					native_adapter.abort_load();
					show_error( i18n.calendar_error || '', true );
				}
			}, NATIVE_LOAD_TIMEOUT_MS );
			if ( ! native_adapter.load( calendar.request_parameters || {}, function () {
				clear_native_load_timer();
				if ( generation !== controller_generation || ! draft ) {
					return;
				}
				// Mode initialization and exact hydration are separate. A policy mode
				// rejection cannot turn a readable calendar into a terminal error.
				native_adapter.set_selection_mode( draft.selection_method );
				hydrate_draft_dates( generation, 0 );
			}, function () {
				clear_native_load_timer();
				if ( generation === controller_generation ) {
					show_error( i18n.calendar_error || '', true );
				}
			} ) ) {
				show_error( i18n.calendar_error || '', true );
			}
		}

		/**
		 * Render an authorized read response and begin the native follow-up load.
		 *
		 * @param {Object} editor_dto Authorized Date Editor DTO.
		 * @param {number} generation Current controller generation.
		 *
		 * @return {void}
		 */
		function initialize_editor( editor_dto, generation ) {
			var initial = editor_dto && editor_dto.initial ? editor_dto.initial : {};

			active_editor = editor_dto;
			if ( ! editor_dto.supported ) {
				render_layer( {
					supported: false,
					fallback: editor_dto.fallback || {},
					i18n: i18n
				} );
				show_error( i18n.unsupported_dates || '', false );
				return;
			}

			saved_draft = freeze_editor_draft( initial );
			draft = clone_editor_draft( initial );
			render_layer( Object.assign( {}, draft, {
				resource_id: editor_dto.resource_id,
				supported: true,
				i18n: i18n
			} ) );
			if ( ! layer ) {
				return;
			}
			show_loading( i18n.loading_dates || '' );
			render_draft_state();
			mount_native_calendar( generation );
		}

		/**
		 * Request a fresh authorized editor DTO for the active booking.
		 *
		 * @return {void}
		 */
		function request_editor() {
			var generation;
			var pending_request;
			var booking_id = active_editor ? normalize_booking_id( active_editor.booking_id ) : 0;

			if ( ! booking_id || ! controller_options.url || ! controller_options.source || ! read_settings.action || ! read_settings.nonce ) {
				show_error( i18n.load_error || '', true );
				return;
			}
			controller_generation += 1;
			generation = controller_generation;
			if ( read_request && 'function' === typeof read_request.abort ) {
				read_request.abort();
			}
			if ( review_request && 'function' === typeof review_request.abort ) {
				review_request.abort();
			}
			review_generation += 1;
			review_request = null;
			active_review = null;
			pending_apply_result = null;
			if ( native_adapter ) {
				native_adapter.teardown();
				native_adapter = null;
			}
			clear_native_load_timer();
			show_loading( i18n.loading_dates || '' );
			pending_request = window.jQuery.ajax( {
				url: controller_options.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: read_settings.action,
					nonce: read_settings.nonce,
					booking_id: booking_id,
					source: controller_options.source
				}
			} ).done( function ( response ) {
				if ( generation !== controller_generation || ! response || ! response.success || ! response.data || ! response.data.editor ) {
					return;
				}
				initialize_editor( response.data.editor, generation );
			} ).fail( function ( failed_request, request_status ) {
				var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};

				if ( 'abort' === request_status || generation !== controller_generation || ! layer ) {
					return;
				}
				show_error( error.message || i18n.load_error || '', true );
			} ).always( function () {
				if ( read_request === pending_request ) {
					read_request = null;
				}
			} );
			read_request = pending_request;
		}

		/**
		 * Render one authorized review DTO through the domain-owned template.
		 *
		 * @param {Object} review_response Signed server review response.
		 *
		 * @return {void}
		 */
		function render_review( review_response ) {
			var loading = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-loading]' ) : null;
			var error_box = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-error]' ) : null;
			var editor_view = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-view="editor"]' ) : null;
			var review_view = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-view="review"]' ) : null;
			var review_content = review_view ? review_view.querySelector( '[data-wpbc-booking-date-editor-review-content]' ) : null;
			var review_title = review_view ? review_view.querySelector( 'h4' ) : null;
			var back_button = review_view ? review_view.querySelector( '[data-wpbc-booking-date-editor-back]' ) : null;
			var apply_button = review_view ? review_view.querySelector( '[data-wpbc-booking-date-editor-apply]' ) : null;

			if (
				! review_view ||
				! review_content ||
				! review_response ||
				! review_response.review ||
				! review_response.plan ||
				! review_response.token ||
				! review_response.expires_at
			) {
				show_ready( '', false );
				set_status( i18n.review_error || '', true, 'error' );
				return;
			}
			active_review = review_response;
			review_content.innerHTML = review_template( {
				review: review_response.review || {},
				i18n: i18n
			} );
			if ( loading ) {
				loading.hidden = true;
			}
			if ( error_box ) {
				error_box.hidden = true;
			}
			if ( editor_view ) {
				editor_view.hidden = true;
			}
			review_view.hidden = false;
			if ( apply_button ) {
				apply_button.disabled = false;
				apply_button.setAttribute( 'aria-disabled', 'false' );
				apply_button.textContent = pending_apply_result ? ( i18n.retry_readback || i18n.retry || '' ) : ( i18n.apply_changes || '' );
			}
			if ( back_button ) {
				back_button.disabled = Boolean( pending_apply_result );
				back_button.setAttribute( 'aria-disabled', pending_apply_result ? 'true' : 'false' );
			}
			set_status( '', false );
			layer.setAttribute( 'aria-busy', 'false' );
			if ( review_title ) {
				review_title.focus();
			}
		}

		/**
		 * Return from the review to the unchanged mutable browser draft.
		 *
		 * @return {void}
		 */
		function show_editor_from_review() {
			var editor_view = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-view="editor"]' ) : null;
			var review_view = layer ? layer.querySelector( '[data-wpbc-booking-date-editor-view="review"]' ) : null;
			var review_button = editor_view ? editor_view.querySelector( '[data-wpbc-booking-date-editor-review]' ) : null;

			if ( pending_apply_result ) {
				set_status( i18n.readback_error || i18n.apply_error || '', true, 'error' );
				return;
			}

			active_review = null;
			if ( review_view ) {
				review_view.hidden = true;
			}
			if ( editor_view ) {
				editor_view.hidden = false;
			}
			set_status( '', false );
			if ( review_button ) {
				review_button.focus();
			}
		}

		/**
		 * Request one signed, non-mutating review for the current draft.
		 *
		 * @return {void}
		 */
		function request_review() {
			var generation;
			var pending_request;

			if (
				! is_draft_reviewable() ||
				! active_editor ||
				! active_editor.source_fingerprint ||
				! controller_options.url ||
				! controller_options.source ||
				! review_settings.action ||
				! review_settings.nonce
			) {
				set_status( i18n.review_error || '', true, 'error' );
				return;
			}

			review_generation += 1;
			generation = review_generation;
			if ( review_request && 'function' === typeof review_request.abort ) {
				review_request.abort();
			}
			show_loading( i18n.loading_review || '' );
			pending_request = window.jQuery.ajax( {
				url: controller_options.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: review_settings.action,
					nonce: review_settings.nonce,
					booking_id: active_editor.booking_id,
					source: controller_options.source,
					source_fingerprint: active_editor.source_fingerprint,
					proposal: JSON.stringify( get_effective_editor_draft( draft ) )
				}
			} ).done( function ( response ) {
				if ( generation !== review_generation || ! response || ! response.success || ! response.data ) {
					return;
				}
				render_review( response.data );
			} ).fail( function ( failed_request, request_status ) {
				var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};

				if ( 'abort' === request_status || generation !== review_generation || ! layer ) {
					return;
				}
				show_ready( '', false );
				set_status( error.message || i18n.review_error || '', true, 'error' );
			} ).always( function () {
				if ( review_request === pending_request ) {
					review_request = null;
				}
			} );
			review_request = pending_request;
		}

		/**
		 * Return one safe canonical-readback failure message.
		 *
		 * @param {*} readback_error Rejection value from the Inspector adapter.
		 *
		 * @return {string} Safe localized or adapter-provided message.
		 */
		function get_readback_error_message( readback_error ) {
			if ( readback_error && 'string' === typeof readback_error.message && readback_error.message ) {
				return readback_error.message;
			}

			return i18n.readback_error || i18n.apply_error || '';
		}

		/**
		 * Ask the Inspector to reread and render the authoritative booking.
		 *
		 * The Date Editor keeps its dirty review state until this asynchronous
		 * boundary resolves with the canonical Inspector DTO. A rejected readback
		 * never renders the apply response as booking state, and Retry refresh
		 * repeats only this read instead of submitting the signed mutation again.
		 *
		 * @param {Object} submitted_review Signed review displayed during apply.
		 *
		 * @return {void}
		 */
		function request_canonical_readback( submitted_review ) {
			var callback_result;
			var generation;

			if ( ! pending_apply_result || 'function' !== typeof controller_options.on_applied ) {
				render_review( submitted_review );
				set_status( i18n.readback_error || i18n.apply_error || '', true, 'error' );
				return;
			}

			apply_generation += 1;
			generation = apply_generation;
			show_loading( i18n.refreshing_booking || i18n.loading_dates || '' );
			try {
				callback_result = controller_options.on_applied( pending_apply_result );
			} catch ( readback_exception ) {
				callback_result = null;
			}
			if (
				! callback_result ||
				( 'function' !== typeof callback_result.then && 'function' !== typeof callback_result.done )
			) {
				render_review( submitted_review );
				set_status( i18n.readback_error || i18n.apply_error || '', true, 'error' );
				return;
			}

			window.jQuery.when( callback_result ).done( function ( canonical_booking ) {
				if (
					generation !== apply_generation ||
					! layer ||
					! canonical_booking ||
					Number( canonical_booking.booking_id || 0 ) !== Number( pending_apply_result.booking_id || 0 )
				) {
					return;
				}
				pending_apply_result = null;
				dirty = false;
				close( true, true );
			} ).fail( function ( readback_error ) {
				if ( generation !== apply_generation || ! layer ) {
					return;
				}
				render_review( submitted_review );
				set_status( get_readback_error_message( readback_error ), true, 'error' );
			} );
		}

		/**
		 * Apply the currently displayed signed review through the domain endpoint.
		 *
		 * Only the server-issued plan and signature are submitted. The mutable
		 * browser draft and native calendar selection are intentionally omitted.
		 *
		 * @return {void}
		 */
		function request_apply() {
			var generation;
			var pending_request;
			var submitted_review = active_review;

			if ( pending_apply_result ) {
				request_canonical_readback( submitted_review );
				return;
			}

			if (
				! submitted_review ||
				! submitted_review.plan ||
				! submitted_review.token ||
				! active_editor ||
				! controller_options.url ||
				! controller_options.source ||
				! apply_settings.action ||
				! apply_settings.nonce
			) {
				set_status( i18n.apply_error || '', true, 'error' );
				return;
			}

			apply_generation += 1;
			generation = apply_generation;
			if ( apply_request && 'function' === typeof apply_request.abort ) {
				apply_request.abort();
			}
			show_loading( i18n.applying_changes || '' );
			pending_request = window.jQuery.ajax( {
				url: controller_options.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: apply_settings.action,
					nonce: apply_settings.nonce,
					booking_id: active_editor.booking_id,
					source: controller_options.source,
					plan: JSON.stringify( submitted_review.plan ),
					token: submitted_review.token,
					send_modified_email: 'function' === typeof controller_options.get_send_modified_email_intent && controller_options.get_send_modified_email_intent() ? 1 : 0
				}
			} ).done( function ( response ) {
				var apply_result;

				if ( generation !== apply_generation ) {
					return;
				}
				if ( ! response || ! response.success || ! response.data || ! response.data.canonical ) {
					render_review( submitted_review );
					set_status( i18n.apply_error || '', true, 'error' );
					return;
				}
				apply_result = response.data;
				pending_apply_result = apply_result;
				request_canonical_readback( submitted_review );
			} ).fail( function ( failed_request, request_status ) {
				var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};

				if ( 'abort' === request_status || generation !== apply_generation || ! layer ) {
					return;
				}
				render_review( submitted_review );
				set_status( error.message || i18n.apply_error || '', true, 'error' );
			} ).always( function () {
				if ( apply_request === pending_request ) {
					apply_request = null;
				}
			} );
			apply_request = pending_request;
		}

		/**
		 * Open the Date Editor for one Inspector-authorized booking.
		 *
		 * @param {HTMLElement} trigger         Change dates button.
		 * @param {Object}      booking_context Booking identifier from the loaded Inspector DTO.
		 *
		 * @return {boolean} True when opening began.
		 */
		function open( trigger, booking_context ) {
			var booking_id = booking_context ? normalize_booking_id( booking_context.booking_id ) : 0;

			if ( ! booking_id || ! close( false, false ) ) {
				return false;
			}
			opener = trigger;
			active_editor = { booking_id: booking_id };
			if ( ! render_layer( { i18n: i18n } ) ) {
				return false;
			}
			show_loading( i18n.loading_dates || '' );
			window.requestAnimationFrame( function () {
				if ( layer ) {
					layer.focus();
				}
			} );
			request_editor();

			return true;
		}

		/**
		 * Synchronize the visible controls from the mutable browser draft.
		 *
		 * @return {void}
		 */
		function synchronize_controls_from_draft() {
			if ( ! layer || ! draft ) {
				return;
			}

			Array.prototype.forEach.call( layer.querySelectorAll( '[data-wpbc-booking-date-editor-selection-method]' ), function ( control ) {
				control.checked = draft.selection_method === control.value;
			} );
			Array.prototype.forEach.call( layer.querySelectorAll( '[data-wpbc-booking-date-editor-time-application]' ), function ( control ) {
				control.checked = draft.time_application === control.value;
			} );
			Array.prototype.forEach.call( layer.querySelectorAll( '[data-wpbc-booking-date-editor-time]' ), function ( control ) {
				control.value = draft[ control.getAttribute( 'data-wpbc-booking-date-editor-time' ) ] || '';
			} );
		}

		/**
		 * Handle secondary-layer buttons without leaking behavior into Inspector.
		 *
		 * @param {MouseEvent} event Inspector-shell click event.
		 *
		 * @return {void}
		 */
		function handle_click( event ) {
			var reset_button;
			var review_button;
			var back_button;
			var apply_button;
			var mode_was_restored;
			var dates_were_restored;

			if ( ! layer || ! layer.contains( event.target ) ) {
				return;
			}
			if ( event.target.closest( '[data-wpbc-booking-date-editor-close]' ) ) {
				event.preventDefault();
				close( true, false );
				return;
			}
			if ( event.target.closest( '[data-wpbc-booking-date-editor-retry]' ) ) {
				event.preventDefault();
				request_editor();
				return;
			}
			review_button = event.target.closest( '[data-wpbc-booking-date-editor-review]' );
			if ( review_button && ! review_button.disabled ) {
				event.preventDefault();
				request_review();
				return;
			}
			back_button = event.target.closest( '[data-wpbc-booking-date-editor-back]' );
			if ( back_button ) {
				event.preventDefault();
				show_editor_from_review();
				return;
			}
			apply_button = event.target.closest( '[data-wpbc-booking-date-editor-apply]' );
			if ( apply_button && ! apply_button.disabled ) {
				event.preventDefault();
				request_apply();
				return;
			}
			reset_button = event.target.closest( '[data-wpbc-booking-date-editor-reset]' );
			if ( reset_button && saved_draft && draft && native_adapter ) {
				event.preventDefault();
				active_review = null;
				draft = clone_editor_draft( saved_draft );
				mode_was_restored = native_adapter.set_selection_mode( draft.selection_method );
				dates_were_restored = mode_was_restored && native_adapter.set_exact_selected_dates( draft.selected_dates );
				synchronize_controls_from_draft();
				render_draft_state();
				set_status(
					dates_were_restored ? ( i18n.calendar_loaded || '' ) : ( i18n.hydration_warning || '' ),
					! dates_were_restored
				);
			}
		}

		/**
		 * Synchronize native mode and time controls into the browser draft.
		 *
		 * @param {Event} event Inspector-shell change/input event.
		 *
		 * @return {void}
		 */
		function handle_change( event ) {
			var selection_control;
			var time_application_control;
			var time_control;
			var requested_selection_method;
			var time_control_key;

			if ( ! layer || ! layer.contains( event.target ) || ! draft ) {
				return;
			}
			selection_control = event.target.closest( '[data-wpbc-booking-date-editor-selection-method]' );
			time_application_control = event.target.closest( '[data-wpbc-booking-date-editor-time-application]' );
			time_control = event.target.closest( '[data-wpbc-booking-date-editor-time]' );
			if ( selection_control ) {
				requested_selection_method = MODE_INDIVIDUAL === selection_control.value ? MODE_INDIVIDUAL : MODE_POLICY;
				if ( native_adapter && ! native_adapter.set_selection_mode( requested_selection_method ) ) {
					synchronize_controls_from_draft();
					set_status( i18n.hydration_warning || '', true );
					return;
				}
				draft.selection_method = requested_selection_method;
				draft.selected_dates = native_adapter ? native_adapter.get_selected_dates() : draft.selected_dates;
			} else if ( time_application_control ) {
				draft.time_application = -1 !== [ TIME_APPLICATION_FULL_DAY, TIME_APPLICATION_BOUNDARY, TIME_APPLICATION_PER_DATE ].indexOf( time_application_control.value )
					? time_application_control.value
					: TIME_APPLICATION_FULL_DAY;
			} else if ( time_control ) {
				time_control_key = time_control.getAttribute( 'data-wpbc-booking-date-editor-time' );
				if ( -1 === [ 'start_time', 'end_time' ].indexOf( time_control_key ) ) {
					return;
				}
				draft[ time_control_key ] = normalize_exact_minute_time( time_control.value );
			} else {
				return;
			}
			active_review = null;
			render_draft_state();
		}

		/**
		 * Close only the secondary layer on Escape before the parent shell sees it.
		 *
		 * @param {KeyboardEvent} event Inspector-shell keyboard event.
		 *
		 * @return {void}
		 */
		function handle_keydown( event ) {
			if ( 'Escape' !== event.key || ! layer ) {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			close( true, false );
		}

		inspector_shell.addEventListener( 'click', handle_click );
		inspector_shell.addEventListener( 'change', handle_change );
		inspector_shell.addEventListener( 'input', handle_change );
		inspector_shell.addEventListener( 'keydown', handle_keydown, true );

		return {
			open: open,
			is_open: function () {
				return Boolean( layer );
			},
			is_dirty: function () {
				return dirty;
			},
			confirm_discard: function () {
				return ! dirty || window.confirm( i18n.discard_changes || '' );
			},
			prepare_for_parent_switch: function () {
				return close( false, false );
			},
			force_close: function () {
				close( false, true );
			},
			destroy: function () {
				close( false, true );
				inspector_shell.removeEventListener( 'click', handle_click );
				inspector_shell.removeEventListener( 'change', handle_change );
				inspector_shell.removeEventListener( 'input', handle_change );
				inspector_shell.removeEventListener( 'keydown', handle_keydown, true );
			}
		};
	}

	window.wpbc_booking_date_editor = window.wpbc_booking_date_editor || {};
	window.wpbc_booking_date_editor.create_native_calendar_adapter = create_native_calendar_adapter;
	window.wpbc_booking_date_editor.create_controller = create_controller;
}( window, document, jQuery ) );
