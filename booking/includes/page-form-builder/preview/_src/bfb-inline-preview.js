/**
 * Replace request-local Form Builder previews using a data-only WPBC bootstrap.
 *
 * The helper owns only domain-neutral DOM and Booking Calendar initialization
 * mechanics. It never evaluates returned JavaScript. Callers remain responsible
 * for authorization, request validation, stale-response ownership, and visible
 * user interface state.
 *
 * @package Booking Calendar
 */
( function ( window, document, $ ) {
	'use strict';

	/**
	 * Return a rejected jQuery promise with one controlled message.
	 *
	 * @param {string} message Error message.
	 * @return {Object} Rejected promise.
	 */
	function rejected_preview( message ) {
		var deferred = $.Deferred();

		deferred.reject( new Error( message || '' ) );
		return deferred.promise();
	}

	/**
	 * Destroy Datepick instances before their preview DOM is removed.
	 *
	 * @param {HTMLElement} container Inline preview content container.
	 * @return {void}
	 */
	function cleanup_calendars( container ) {
		if ( ! container || ! $.datepick ) {
			return;
		}

		$( container ).find( '[id^="calendar_booking"]' ).each( function () {
			var $calendar = $( this );

			if ( typeof $calendar.datepick !== 'function' ) {
				return;
			}

			try {
				if ( 'function' === typeof $.datepick._getInst && $.datepick._getInst( this ) ) {
					$calendar.datepick( 'destroy' );
				}
			} catch ( error ) {
				$calendar.removeClass( 'hasDatepick' );
			}
		} );
	}

	/**
	 * Convert one value to a finite integer with a bounded fallback.
	 *
	 * @param {*}      value    Candidate value.
	 * @param {number} fallback Fallback value.
	 * @return {number} Normalized integer.
	 */
	function to_integer( value, fallback ) {
		var parsed = parseInt( value, 10 );

		return isFinite( parsed ) ? parsed : fallback;
	}

	/**
	 * Copy only scalar request values from the server-owned bootstrap contract.
	 *
	 * @param {Object} request_values Candidate request values.
	 * @return {Object} Allow-listed calendar AJAX request.
	 */
	function get_calendar_request( request_values ) {
		var source = request_values && 'object' === typeof request_values ? request_values : {};
		var request = {
			resource_id: Math.max( 1, to_integer( source.resource_id, 1 ) ),
			booking_hash: String( source.booking_hash || '' ),
			request_uri: String( source.request_uri || '' ),
			custom_form: String( source.custom_form || 'standard' ),
			aggregate_resource_id_str: String( source.aggregate_resource_id_str || '' ),
			aggregate_type: String( source.aggregate_type || 'all' ),
			skip_general_availability: source.skip_general_availability ? 1 : 0,
			classic_booking_context_token: String( source.classic_booking_context_token || '' )
		};
		var marker_keys = [
			'wpbc_settings_calendar_preview',
			'wpbc_setup_wizard_date_selection_preview'
		];
		var toggle_keys = [
			'wpbc_settings_calendar_preview_changeover',
			'wpbc_settings_calendar_preview_triangles',
			'wpbc_settings_calendar_preview_recurrent_time',
			'wpbc_settings_calendar_preview_last_checkout',
			'wpbc_settings_calendar_preview_show_legend',
			'wpbc_settings_calendar_preview_legend_show_numbers',
			'wpbc_settings_calendar_preview_legend_vertical',
			'wpbc_settings_calendar_preview_legend_show_available',
			'wpbc_settings_calendar_preview_legend_show_pending',
			'wpbc_settings_calendar_preview_legend_show_approved',
			'wpbc_settings_calendar_preview_legend_show_partially',
			'wpbc_settings_calendar_preview_legend_show_unavailable'
		];
		var text_keys = [
			'wpbc_setup_wizard_date_selection_preview_nonce',
			'wpbc_settings_calendar_preview_legend_text_available',
			'wpbc_settings_calendar_preview_legend_text_pending',
			'wpbc_settings_calendar_preview_legend_text_approved',
			'wpbc_settings_calendar_preview_legend_text_partially',
			'wpbc_settings_calendar_preview_legend_text_unavailable'
		];

		$.each( marker_keys, function ( index, key ) {
			if ( source[ key ] ) {
				request[ key ] = 1;
			}
		} );
		$.each( toggle_keys, function ( index, key ) {
			if ( 'On' === source[ key ] || 'Off' === source[ key ] ) {
				request[ key ] = source[ key ];
			}
		} );
		$.each( text_keys, function ( index, key ) {
			if ( Object.prototype.hasOwnProperty.call( source, key ) ) {
				request[ key ] = String( source[ key ] || '' );
			}
		} );

		return request;
	}

	/**
	 * Set one calendar parameter through the established WPBC state API.
	 *
	 * @param {number} resource_id Booking resource ID.
	 * @param {string} key         Allow-listed parameter key.
	 * @param {*}      value       JSON-safe parameter value.
	 * @return {void}
	 */
	function set_calendar_parameter( resource_id, key, value ) {
		if ( window._wpbc && 'function' === typeof window._wpbc.calendar__set_param_value ) {
			window._wpbc.calendar__set_param_value( resource_id, key, value );
		}
	}

	/**
	 * Apply the fixed calendar-parameter contract returned by the server.
	 *
	 * @param {number} resource_id         Booking resource ID.
	 * @param {Object} calendar_parameters Validated server parameter map.
	 * @return {void}
	 */
	function apply_calendar_parameters( resource_id, calendar_parameters ) {
		var parameters = calendar_parameters && 'object' === typeof calendar_parameters ? calendar_parameters : {};
		var allowed_keys = [
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
			'booking_recurrent_time'
		];

		$.each( allowed_keys, function ( index, key ) {
			if ( Object.prototype.hasOwnProperty.call( parameters, key ) ) {
				set_calendar_parameter( resource_id, key, parameters[ key ] );
			}
		} );
	}

	/**
	 * Initialize a rendered form through known Booking Calendar functions only.
	 *
	 * @param {Object} bootstrap JSON-safe bootstrap data returned by WPBC.
	 * @return {Object} Resolved or rejected jQuery promise.
	 */
	function initialize_booking_form( bootstrap ) {
		var config = bootstrap && 'object' === typeof bootstrap ? bootstrap : {};
		var calendar_request = get_calendar_request( config.calendar_request );
		var resource_id = calendar_request.resource_id;
		var secure_parameters = config.secure_parameters && 'object' === typeof config.secure_parameters ? config.secure_parameters : {};

		if (
			! window._wpbc ||
			'function' !== typeof window.wpbc_calendar_show ||
			'function' !== typeof window.wpbc_calendar__load_data__ajx ||
			'function' !== typeof window._wpbc.set_secure_param
		) {
			return rejected_preview( '' );
		}

		if ( 'function' === typeof window._wpbc.balancer__set_max_threads ) {
			window._wpbc.balancer__set_max_threads( Math.max( 1, to_integer( config.balancer_max_threads, 1 ) ) );
		}

		apply_calendar_parameters( resource_id, config.calendar_parameters );

		if ( window._wpbc.booking__set_param_value && 'function' === typeof window._wpbc.booking__set_param_value ) {
			window._wpbc.booking__set_param_value(
				resource_id,
				'classic_booking_context_token',
				String( config.classic_booking_context_token || '' )
			);
		}

		if ( 'function' === typeof window._wpbc.set_other_param && Object.prototype.hasOwnProperty.call( config, 'is_enabled_change_over' ) ) {
			window._wpbc.set_other_param( 'is_enabled_change_over', Boolean( config.is_enabled_change_over ) );
		}

		if ( 'function' === typeof window.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm ) {
			window.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm( resource_id );
		}

		window.wpbc_calendar_show( String( resource_id ) );
		window._wpbc.set_secure_param( 'nonce', String( secure_parameters.nonce || '' ) );
		window._wpbc.set_secure_param( 'user_id', String( secure_parameters.user_id || '' ) );
		window._wpbc.set_secure_param( 'locale', String( secure_parameters.locale || '' ) );
		window.wpbc_calendar__load_data__ajx( calendar_request );

		if ( 'function' === typeof window.wpbc_hook__init_booking_form_wizard_buttons ) {
			window.wpbc_hook__init_booking_form_wizard_buttons();
		}

		return $.Deferred().resolve().promise();
	}

	/**
	 * Create a reusable inline Form Builder preview renderer.
	 *
	 * Only server-rendered HTML and structured bootstrap data from an authorized
	 * WPBC endpoint may be passed to `replace()`. Script elements are always
	 * discarded; this component never evaluates response code.
	 *
	 * @param {HTMLElement} container Inline preview content container.
	 * @return {Object|null} Preview renderer API, or null for invalid input.
	 */
	function create_inline_preview( container ) {
		var replacement_sequence = 0;

		if ( ! container || 1 !== container.nodeType ) {
			return null;
		}

		container.setAttribute( 'data-wpbc-inline-booking-preview', '1' );

		/**
		 * Replace preview markup and initialize its known WPBC components.
		 *
		 * @param {string}   html         Trusted server-rendered preview HTML.
		 * @param {Object}   bootstrap    JSON-safe WPBC bootstrap contract.
		 * @param {Function} owns_request Callback returning whether the request remains current.
		 * @return {Object} jQuery promise.
		 */
		function replace( html, bootstrap, owns_request ) {
			var replacement_id = ++replacement_sequence;
			var parsed = $.parseHTML( String( html || '' ), document, false ) || [];
			var $parsed_container = $( '<div>' ).append( parsed );
			var owns_preview = function () {
				return replacement_id === replacement_sequence && ( ! owns_request || owns_request() );
			};

			if ( ! owns_preview() ) {
				return rejected_preview( '' );
			}

			$parsed_container.find( 'script' ).addBack( 'script' ).remove();
			cleanup_calendars( container );
			$( container ).empty().append( $parsed_container.contents() );

			if ( ! owns_preview() ) {
				return rejected_preview( '' );
			}

			return initialize_booking_form( bootstrap );
		}

		/**
		 * Invalidate pending replacements and release calendar instances.
		 *
		 * @return {void}
		 */
		function destroy() {
			replacement_sequence += 1;
			cleanup_calendars( container );
		}

		return {
			replace: replace,
			destroy: destroy
		};
	}

	window.wpbc_bfb_inline_preview = {
		create: create_inline_preview
	};
}( window, document, window.jQuery ) );
