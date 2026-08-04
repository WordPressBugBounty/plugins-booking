/** Add Booking administrator inspector interactions. */
( function ( $ ) {
	'use strict';

	var active_days_selection_override = '';
	var days_selection_enforcement_timers = [];

	/**
	 * Show the panel controlled by one compact right-sidebar tab.
	 *
	 * @param {jQuery} $tab Selected tab button.
	 * @return {void}
	 */
	function switch_right_panel( $tab ) {
		var panel_id = $tab.attr( 'aria-controls' );
		var $tabs = $tab.closest( '.wpbc_add_booking__rightbar_tabs' ).find( '[role="tab"]' );
		var $panels = $( '.wpbc_add_booking__rightbar' ).find( '[role="tabpanel"]' );

		if ( ! panel_id || ! $( '#' + panel_id ).length ) {
			return;
		}

		$tabs.attr( 'aria-selected', 'false' );
		$tab.attr( 'aria-selected', 'true' );
		$panels.attr( { hidden: true, 'aria-hidden': 'true' } );
		$( '#' + panel_id ).removeAttr( 'hidden' ).attr( 'aria-hidden', 'false' );
	}

	/**
	 * Expand an inspector group and focus one of its controls.
	 *
	 * The shared collapsible controller is used when available so exclusive
	 * groups and ARIA state stay synchronized. The header click is a safe
	 * fallback for older Booking Calendar admin bundles.
	 *
	 * @param {string} group_name Group data key.
	 * @param {string} focus_selector Optional control to focus after expansion.
	 * @return {void}
	 */
	function open_settings_group( group_name, focus_selector ) {
		var $group = $( '.wpbc_add_booking__inspector_settings .wpbc_ui__collapsible_group[data-group="' + group_name + '"]' ).first();
		var root;
		var controller;

		if ( ! $group.length ) {
			return;
		}

		root = $group.closest( '.wpbc_collapsible' ).get( 0 );
		controller = root && root.__wpbc_collapsible_instance ? root.__wpbc_collapsible_instance : null;

		if ( controller && 'function' === typeof controller.expand ) {
			controller.expand( $group.get( 0 ) );
		} else {
			$group.siblings( '.wpbc_ui__collapsible_group' ).each( function () {
				var $sibling = $( this );

				$sibling.removeClass( 'is-open' );
				$sibling.children( '.group__header' ).attr( 'aria-expanded', 'false' );
				$sibling.children( '.group__fields' ).attr( { hidden: true, 'aria-hidden': 'true' } );
			} );
			$group.addClass( 'is-open' );
			$group.children( '.group__header' ).attr( 'aria-expanded', 'true' );
			$group.children( '.group__fields' ).removeAttr( 'hidden' ).attr( 'aria-hidden', 'false' );
		}

		window.requestAnimationFrame( function () {
			$group.get( 0 ).scrollIntoView( { behavior: 'smooth', block: 'start' } );
			if ( focus_selector ) {
				window.setTimeout( function () {
					$( focus_selector ).first().trigger( 'focus' );
				}, 250 );
			}
		} );
	}

	/**
	 * Synchronize Booking Tools status links with their current toggle values.
	 *
	 * @return {void}
	 */
	function refresh_booking_tools_summary() {
		var $summary = $( '.wpbc_add_booking__setup_summary' ).first();
		var enabled_label;
		var disabled_label;

		if ( ! $summary.length ) {
			return;
		}

		enabled_label = $summary.attr( 'data-wpbc-add-booking-enabled-label' ) || 'Enabled';
		disabled_label = $summary.attr( 'data-wpbc-add-booking-disabled-label' ) || 'Disabled';

		$summary.find( '[data-wpbc-add-booking-summary="emails"]' ).text(
			$( '#is_send_email_for_pending' ).is( ':checked' ) ? enabled_label : disabled_label
		);
		$summary.find( '[data-wpbc-add-booking-summary="allow-past"]' ).text(
			$( '#is_allow_bookings_in_past' ).is( ':checked' ) ? enabled_label : disabled_label
		);
	}

	/**
	 * Get the Add Booking date-selection radio container.
	 *
	 * @return {jQuery} Date-selection container, when rendered.
	 */
	function get_days_selection_container() {
		return $( '[data-wpbc-add-booking-days-selection="1"]' ).first();
	}

	/**
	 * Normalize calendar engine modes to the three administrator radio choices.
	 *
	 * @param {string} mode Calendar or radio mode.
	 * @return {string} single, multiple, range, or an empty string.
	 */
	function normalize_days_selection_mode( mode ) {
		mode = String( mode || '' );

		if ( 'fixed' === mode || 'dynamic' === mode || 'range' === mode ) {
			return 'range';
		}

		return 'single' === mode || 'multiple' === mode ? mode : '';
	}

	/**
	 * Get the current Add Booking resource ID from the radio control context.
	 *
	 * @return {number} Positive resource ID, or zero when unavailable.
	 */
	function get_days_selection_resource_id() {
		var resource_id = parseInt( get_days_selection_container().attr( 'data-wpbc-resource-id' ), 10 );

		if ( ! resource_id && window.wpbc_add_booking_component_context ) {
			resource_id = parseInt( window.wpbc_add_booking_component_context.resource_id, 10 );
		}

		return resource_id > 0 ? resource_id : 0;
	}

	/**
	 * Read one calendar parameter without exposing page state globally.
	 *
	 * @param {number} resource_id Booking resource ID.
	 * @param {string} parameter_name Calendar parameter name.
	 * @return {*} Current parameter value, or null when the calendar is unavailable.
	 */
	function get_calendar_parameter( resource_id, parameter_name ) {
		if ( ! window._wpbc || ! window._wpbc.calendar || 'function' !== typeof window._wpbc.calendar__get_param_value ) {
			return null;
		}

		return window._wpbc.calendar__get_param_value( resource_id, parameter_name );
	}

	/**
	 * Normalize an array or comma-separated calendar parameter into integers.
	 *
	 * @param {Array|number|string} parameter_value Calendar parameter value.
	 * @param {Array} fallback_value Value returned when no valid numbers exist.
	 * @return {Array} Integer values.
	 */
	function normalize_calendar_number_list( parameter_value, fallback_value ) {
		var values = Array.isArray( parameter_value ) ? parameter_value : String( parameter_value || '' ).split( ',' );
		var normalized_values = [];

		$.each( values, function ( index, number_value ) {
			var parsed_number = parseInt( number_value, 10 );

			if ( ! isNaN( parsed_number ) ) {
				normalized_values.push( parsed_number );
			}
		} );

		return normalized_values.length ? normalized_values : fallback_value;
	}

	/**
	 * Get the fixed/dynamic engine to use for the Range days radio choice.
	 *
	 * @return {string} fixed or dynamic.
	 */
	function get_range_engine_mode() {
		var range_engine_mode = String( get_days_selection_container().attr( 'data-wpbc-range-engine-mode' ) || 'dynamic' );

		return 'fixed' === range_engine_mode ? 'fixed' : 'dynamic';
	}

	/**
	 * Update the checked radio and visible setup summary from an effective mode.
	 *
	 * @param {string} mode Calendar or radio mode.
	 * @return {void}
	 */
	function sync_days_selection_controls( mode ) {
		var normalized_mode = normalize_days_selection_mode( mode );
		var $container = get_days_selection_container();
		var $radio;
		var mode_label;

		if ( ! normalized_mode || ! $container.length ) {
			return;
		}

		$radio = $container.find( 'input[name="wpbc_add_booking_days_selection_mode"][value="' + normalized_mode + '"]' );
		if ( 1 !== $radio.length ) {
			return;
		}

		$radio.prop( 'checked', true );
		mode_label = $radio.attr( 'data-wpbc-days-selection-label' ) || normalized_mode;
		$( '[data-wpbc-add-booking-summary="days-selection"]' ).text( mode_label );
	}

	/**
	 * Clear selected dates before changing their selection semantics.
	 *
	 * Customer fields remain untouched. Existing calendar helpers are used when
	 * available so Datepick state and the hidden selected-date field stay aligned.
	 *
	 * @param {number} resource_id Booking resource ID.
	 * @return {void}
	 */
	function clear_selected_booking_dates( resource_id ) {
		var $date_field = $( '#date_booking' + resource_id );

		if ( ! $date_field.length || ! String( $date_field.val() || '' ).trim() ) {
			return;
		}

		if ( 'function' === typeof window.wpbc_calendar__unselect_all_dates ) {
			window.wpbc_calendar__unselect_all_dates( resource_id );
		} else {
			$date_field.val( '' );
		}

		if ( 'function' === typeof window.wpbc_disable_time_fields_in_booking_form ) {
			window.wpbc_disable_time_fields_in_booking_form( resource_id );
		}
	}

	/**
	 * Apply one radio mode through the shared immediate calendar helpers.
	 *
	 * Range mode retains the configured fixed/dynamic subtype and its existing
	 * number-of-days and weekday parameters. No settings are saved.
	 *
	 * @param {string} mode Requested radio mode.
	 * @param {boolean} clear_dates Whether an existing selection must be cleared.
	 * @return {boolean} True when the requested helper was applied or already active.
	 */
	function apply_days_selection_mode( mode, clear_dates ) {
		var normalized_mode = normalize_days_selection_mode( mode );
		var resource_id = get_days_selection_resource_id();
		var desired_engine_mode = 'range' === normalized_mode ? get_range_engine_mode() : normalized_mode;
		var current_engine_mode;
		var fixed_days_number;

		if ( ! normalized_mode || ! resource_id ) {
			return false;
		}

		current_engine_mode = String( get_calendar_parameter( resource_id, 'days_select_mode' ) || '' );
		if ( desired_engine_mode === current_engine_mode ) {
			sync_days_selection_controls( normalized_mode );
			return true;
		}

		if ( clear_dates ) {
			clear_selected_booking_dates( resource_id );
		}

		if ( 'single' === normalized_mode && 'function' === typeof window.wpbc_cal_days_select__single ) {
			window.wpbc_cal_days_select__single( resource_id );
		} else if ( 'multiple' === normalized_mode && 'function' === typeof window.wpbc_cal_days_select__multiple ) {
			window.wpbc_cal_days_select__multiple( resource_id );
		} else if ( 'range' === normalized_mode && 'fixed' === desired_engine_mode && 'function' === typeof window.wpbc_cal_days_select__fixed ) {
			fixed_days_number = parseInt( get_calendar_parameter( resource_id, 'fixed__days_num' ), 10 );
			window.wpbc_cal_days_select__fixed(
				resource_id,
				fixed_days_number > 0 ? fixed_days_number : 3,
				normalize_calendar_number_list( get_calendar_parameter( resource_id, 'fixed__week_days__start' ), [ -1 ] )
			);
		} else if ( 'range' === normalized_mode && 'function' === typeof window.wpbc_cal_days_select__range_mode ) {
			window.wpbc_cal_days_select__range_mode( resource_id );
		} else {
			return false;
		}

		sync_days_selection_controls( normalized_mode );
		return true;
	}

	/**
	 * Synchronize controls with the calendar, or enforce a user-selected override.
	 *
	 * @return {void}
	 */
	function synchronize_days_selection_mode() {
		var resource_id = get_days_selection_resource_id();
		var current_engine_mode;

		if ( ! resource_id ) {
			return;
		}

		if ( active_days_selection_override ) {
			apply_days_selection_mode( active_days_selection_override, false );
			return;
		}

		current_engine_mode = get_calendar_parameter( resource_id, 'days_select_mode' );
		sync_days_selection_controls( current_engine_mode );
	}

	/**
	 * Recheck mode after the selected Booking Form's legacy delayed initializer.
	 *
	 * Existing timers are cancelled so repeated clicks cannot accumulate work.
	 * Reapplication occurs only when the calendar engine mode was changed by a
	 * later initializer, avoiding unnecessary calendar renders.
	 *
	 * @return {void}
	 */
	function schedule_days_selection_synchronization() {
		$.each( days_selection_enforcement_timers, function ( index, timer_id ) {
			window.clearTimeout( timer_id );
		} );
		days_selection_enforcement_timers = [];

		$.each( [ 0, 120, 1150, 2200 ], function ( index, delay ) {
			days_selection_enforcement_timers.push( window.setTimeout( synchronize_days_selection_mode, delay ) );
		} );
	}

	$( document ).on( 'click', '.wpbc_add_booking__rightbar_tabs [role="tab"]', function () {
		switch_right_panel( $( this ) );
	} );

	$( document ).on( 'click', '.wpbc_add_booking__setup_summary_link', function ( event ) {
		event.preventDefault();
		open_settings_group( $( this ).attr( 'data-wpbc-add-booking-open-group' ), $( this ).attr( 'data-wpbc-add-booking-focus' ) || '' );
	} );

	$( document ).on( 'change', '#is_send_email_for_pending, #is_allow_bookings_in_past', refresh_booking_tools_summary );
	$( document ).on( 'click', 'input[name="wpbc_add_booking_days_selection_mode"]', function () {
		active_days_selection_override = normalize_days_selection_mode( $( this ).val() );
		apply_days_selection_mode( active_days_selection_override, true );
		schedule_days_selection_synchronization();
	} );
	$( refresh_booking_tools_summary );
	$( schedule_days_selection_synchronization );
}( jQuery ) );
