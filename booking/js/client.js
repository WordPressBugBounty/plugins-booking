/**
 * Check errors in booking form  fields, and show warnings if some errors exist.
 * Check  errors,  like not selected dates or not filled requred form  fields, or not correct entering email or phone
 * fields,  etc...
 *
 * @param resource_id  int (ID of booking resource)
 */
function wpbc_check_errors_in_booking_form( resource_id ) {
	var $form                  = jQuery( '#booking_form' + resource_id );
	var fields_with_errors_arr = [];
	var is_error_in_field      = false;
	var skip_element_types     = [ 'hidden', 'button' ];

	if ( ! $form.length ) {
		return false;
	}

	/**
	 * Show a validation warning and register the related field as invalid.
	 *
	 * @param {HTMLElement|null} field          Field to focus after validation.
	 * @param {HTMLElement|jQuery|string} target Warning message target.
	 * @param {string} message                  Warning message.
	 */
	function add_validation_error( field, target, message ) {
		wpbc_front_end__show_message__warning( target, message, 'text' );
		is_error_in_field = true;

		if ( field ) {
			fields_with_errors_arr.push( field );
		}
	}

	/**
	 * Validate a required field.
	 *
	 * @param {HTMLElement} field  Form field.
	 * @param {jQuery}     $field Cached jQuery field.
	 * @param {string}     field_type Field type.
	 */
	function validate_required_field( field, $field, field_type ) {
		var warning_target;

		if ( ! $field.hasClass( 'wpdev-validates-as-required' ) ) {
			return;
		}

		if ( 'checkbox' === field_type ) {
			if ( ! $field.is( ':checked' ) && ! jQuery( ':checkbox[name="' + field.name + '"]', $form ).is( ':checked' ) ) {
				warning_target = $field.parents( '.wpdev-form-control-wrap' ).last();

				if ( ! warning_target.length ) {
					warning_target = $field.parents( '.controls' ).last();
				}
				if ( ! warning_target.length ) {
					warning_target = $field;
				}

				add_validation_error( field, warning_target, _wpbc.get_message( 'message_check_required_for_check_box' ) );
			}
			return;
		}

		if ( 'radio' === field_type ) {
			if ( ! jQuery( ':radio[name="' + field.name + '"]', $form ).is( ':checked' ) ) {
				add_validation_error( field, $field.parents( '.wpdev-form-control-wrap' ), _wpbc.get_message( 'message_check_required_for_radio_box' ) );
			}
			return;
		}

		if ( '' === wpbc_trim( $field.val() ) ) {
			add_validation_error( field, field, _wpbc.get_message( 'message_check_required' ) );
		}
	}

	/**
	 * Validate an email field and return its trimmed value.
	 *
	 * @param {HTMLElement} field  Form field.
	 * @param {jQuery}     $field Cached jQuery field.
	 * @returns {string}
	 */
	function validate_email_field( field, $field ) {
		var email_value = String( $field.val() || '' ).replace( /^\s+|\s+$/gm, '' );
		var email_regex = /^([A-Za-z0-9_\-\.\+])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,})$/;

		if ( '' !== email_value && ! email_regex.test( email_value ) ) {
			add_validation_error( field, field, _wpbc.get_message( 'message_check_email' ) );
		}

		return email_value;
	}

	/**
	 * Validate a confirmation email field using its same_as_NAME class.
	 *
	 * @param {HTMLElement} field       Form field.
	 * @param {string}      email_value Trimmed confirmation email value.
	 */
	function validate_confirmation_email_field( field, email_value ) {
		var primary_email_match;
		var primary_email_name;
		var $primary_email_field;

		if ( field.className.indexOf( 'same_as_' ) === -1 ) {
			return;
		}

		primary_email_match = field.className.match( /same_as_([^\s])+/gi );
		if ( null === primary_email_match ) {
			return;
		}

		primary_email_name   = primary_email_match[ 0 ].substr( 8 );
		$primary_email_field = $form.find( '[name="' + primary_email_name + resource_id + '"]' );

		if ( $primary_email_field.length && $primary_email_field.val() !== email_value ) {
			add_validation_error( field, field, _wpbc.get_message( 'message_check_same_email' ) );
		}
	}

	/**
	 * Validate fields using the validate_as_date, validate_as_digit, or validate_digit_N classes.
	 *
	 * @param {HTMLElement} field  Form field.
	 * @param {jQuery}     $field Cached jQuery field.
	 */
	function validate_custom_field_classes( field, $field ) {
		var class_list = $field.attr( 'class' );
		var field_value;

		if ( ! class_list ) {
			return;
		}

		field_value = $field.val();

		jQuery.each( class_list.split( /\s+/ ), function ( class_index, class_name ) {
			var digits_to_check;
			var message;
			var validation_regex;

			if ( 'validate_as_date' === class_name ) {
				validation_regex = new RegExp( '^[0-3]?\\d{1}[\\/\\.\\-]+[0-3]?\\d{1}[\\/\\.\\-]+[0-2]+\\d{3}$' );
				message          = _wpbc.get_message( 'message_check_valid_date' ).replace( '{date_example}', '09/25/2018' );

				if ( '' !== field_value && ! validation_regex.test( field_value ) ) {
					add_validation_error( field, field, message );
				}
				return;
			}

			if ( 'validate_as_digit' === class_name ) {
				validation_regex = new RegExp( '^[0-9]+\\.?[0-9]*$' );

				if ( '' !== field_value && ! validation_regex.test( field_value ) ) {
					add_validation_error( field, field, _wpbc.get_message( 'message_check_digits_only' ) );
				}
				return;
			}

			if ( 'validate_digit_' !== class_name.substring( 0, 15 ) ) {
				return;
			}

			digits_to_check = parseInt( class_name.substring( 15 ), 10 );
			if ( isNaN( digits_to_check ) ) {
				return;
			}

			validation_regex = new RegExp( '^\\d{' + digits_to_check + '}$' );
			message          = _wpbc.get_message( 'message_check_digits_count' ).replace( '{digits}', digits_to_check );

			if ( '' !== field_value && ! validation_regex.test( field_value ) ) {
				add_validation_error( field, field, message );
			}
		} );
	}

	$form.find( ':input' ).each( function () {
		var field      = this;
		var $field     = jQuery( field );
		var field_type = $field.attr( 'type' );
		var email_value;

		if ( -1 !== skip_element_types.indexOf( field_type ) ) {
			return;
		}

		if ( '1' === String( $field.attr( 'data-wpbc-booking-submit-ignore' ) || '' ) ) {
			return;
		}

		if (
			( 'date_booking' + resource_id === $field.attr( 'name' ) ) &&
			jQuery( '#calendar_booking' + resource_id ).is( ':visible' ) &&
			( '' === $field.val() ) &&
			( 0 === wpbc_get_arr_of_selected_additional_calendars( resource_id ).length )
		) {
			add_validation_error(
				null,
				'#booking_form_div' + resource_id + ' .bk_calendar_frame',
				_wpbc.get_message( 'message_check_no_selected_dates' )
			);
		}

		if ( ! $field.is( ':visible' ) ) {
			return;
		}

		validate_required_field( field, $field, field_type );

		if ( $field.hasClass( 'wpdev-validates-as-email' ) ) {
			email_value = validate_email_field( field, $field );
			validate_confirmation_email_field( field, email_value );
		}

		validate_custom_field_classes( field, $field );
	} );

	if ( fields_with_errors_arr.length ) {
		jQuery( fields_with_errors_arr[ 0 ] ).trigger( 'focus' );
	}

	return is_error_in_field;
}

/**
 * Hint labels inside of input boxes.
 */
jQuery( document ).ready(
	function () {

		jQuery( 'div.inside_hint' ).on(
			'click',
			function () {
				jQuery( this ).css( 'visibility', 'hidden' ).siblings( '.has-inside-hint' ).trigger( 'focus' );
			}
		);

		jQuery( 'input.has-inside-hint' ).on(
			'blur',
			function () {
				if ( '' === this.value ) {
					jQuery( this ).siblings( '.inside_hint' ).css( 'visibility', '' );
				}
			}
		).on(
			'focus',
			function () {
				jQuery( this ).siblings( '.inside_hint' ).css( 'visibility', 'hidden' );
			}
		);

		jQuery( '.booking_form_div input[type=button]' ).prop( "disabled", false );
	}
);

// == WIZARD ===========================================================================================================

/**
 * Go to next  specific step in Wizard style booking form, with
 * check all required elements specific step, otherwise show warning message!
 *
 * @param el
 * @param step_num
 * @returns {boolean}
 */
function wpbc_wizard_step(el, step_num, step_from) {

	var br_id = jQuery( el ).closest( 'form' ).find( 'input[name^="bk_type"]' ).val();

	// FixIn: 8.8.1.5.
	if ( (undefined == step_from) || (step_num > step_from) ) {
		if ( 1 != step_num ) {                                                                       					// FixIn: 8.7.7.8.
			var is_error = wpbc_check_errors_in_booking_form( br_id );
			if ( is_error ) {
				return false;
			}
		}
	}

	if ( wpbc_is_some_elements_visible( br_id, [ 'rangetime', 'durationtime', 'starttime', 'endtime' ] ) ) {
		if ( wpbc_is_this_time_selection_not_available( br_id, document.getElementById( 'booking_form' + br_id ) ) ) {
			return false;
		}
	}

	if ( br_id != undefined ) {
		jQuery( "#booking_form" + br_id + " .wpbc_wizard_step" ).css( { "display": "none" } )
		                                                        .removeClass( 'wpbc_wizard_step_hidden' );
		jQuery( "#booking_form" + br_id + " .wpbc_wizard_step" + step_num ).css( { "display": "block" } );
		return jQuery( "#booking_form" + br_id + " .wpbc_wizard_step" + step_num );
	}
}


/**
 *  Init Buttons in Booking form Wizard
 */
function wpbc_hook__init_booking_form_wizard_buttons() {

	// CSS classes in Wizard Next / Prior links can  be like this:  <a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_1">Step 1</a>   |  <a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_2">Step 2</a> .

	jQuery( '.wpbc_wizard_step_button' ).attr(
		{
			href: 'javascript:void(0)',
		}
	);

	jQuery( '.wpbc_wizard_step_button' ).off( 'click.wpbc_booking_form_wizard' ).on(
		'click.wpbc_booking_form_wizard',
		function (event) {
			var found_steps_arr = jQuery( this ).attr( 'class' ).match( /wpbc\_wizard\_step\_([\d]+)([\s'"]+|$)/ );

			if ( (null !== found_steps_arr) && (found_steps_arr.length > 2) ) {
				var step = parseInt( found_steps_arr[1] );
				if ( step > 0 ) {
					var jq_step_element;
					// Check actual step in booking form for getting step_from number.
					var this_formsteps_arr = jQuery( this ).parents( '.wpbc_wizard_step' ).attr( 'class' ).match( /wpbc\_wizard\_step([\d]+)([\s'"]+|$)/ );
					if ( (null !== this_formsteps_arr) && (this_formsteps_arr.length > 2) ) {
						var step_from   = parseInt( this_formsteps_arr[1] );
						jq_step_element = wpbc_wizard_step( this, step, step_from );
					} else {
						jq_step_element = wpbc_wizard_step( this, step );
					}
					// Do Scroll.
					if ( false !== jq_step_element ) {
						wpbc_do_scroll( jq_step_element ); // wpbc_do_scroll( jQuery('.wpbc_wizard_step:visible') );.
					}
				}
			}
		}
	);
}


/**
 * Check if at least  one element from  array  of  elements names in booking form  visible  or not.
 * Usage Example:   if ( wpbc_is_some_elements_visible( br_id, ['rangetime', 'durationtime', 'starttime', 'endtime'] )
 * ){ ... }
 *
 * @param resource_id
 * @param elements_names
 * @returns {boolean}
 */
function wpbc_is_some_elements_visible(resource_id, elements_names) {

	var my_form = jQuery( '#booking_form' + resource_id );

	if ( ! my_form.length ) {
		return  false;
	}

	var is_some_elements_visible = false;
	// Pseudo-selector that get form elements <input , <textarea , <select, <button...
	my_form.find( ':input' ).each(
		function (index, el) {

			// Skip some elements.
			var skip_elements = [ 'hidden', 'button' ];

			if ( -1 == skip_elements.indexOf( jQuery( el ).attr( 'type' ) ) ) {

				for ( var ei = 0; ei < (elements_names.length - 1); ei++ ) {

					// Check Calendar Dates Selection.
					if ( (elements_names[ei] + resource_id) == jQuery( el ).attr( 'name' ) ) {

						if ( jQuery( el ).is( ':visible' ) ) {
							is_some_elements_visible = true;
						}
					}
				}
			}
		}
	);

	return is_some_elements_visible;
}


jQuery( document ).ready(
	function () {
		wpbc_hook__init_booking_form_wizard_buttons();
	}
);


// == DAYS_SELECTIONS ==================================================================================================

/**
 * Get first day of selection
 *
 * @param dates
 * @returns {string|*}
 */
function get_first_day_of_selection(dates) {

    // Multiple days selections
    if ( dates.indexOf( ',' ) != -1 ){
        var dates_array = dates.split( /,\s*/ );
        var length = dates_array.length;
        var element = null;
        var new_dates_array = [];

        for ( var i = 0; i < length; i++ ){

            element = dates_array[ i ].split( /\./ );

            new_dates_array[ new_dates_array.length ] = element[ 2 ] + '.' + element[ 1 ] + '.' + element[ 0 ];       //2013.12.20
        }
        new_dates_array.sort();

        element = new_dates_array[ 0 ].split( /\./ );

        return element[ 2 ] + '.' + element[ 1 ] + '.' + element[ 0 ];                    //20.12.2013
    }

    // Range days selection
    if ( dates.indexOf( ' - ' ) != -1 ){
        var start_end_date = dates.split( " - " );
        return start_end_date[ 0 ];
    }

    // Single day selection
    return dates;                                                               //20.12.2013
}


/**
 * Get last day of selection.
 *
 * @param dates
 * @returns {*|string}
 */
function get_last_day_of_selection(dates) {

    // Multiple days selections
    if ( dates.indexOf(',') != -1 ){
        var dates_array =dates.split(/,\s*/);
        var length = dates_array.length;
        var element = null;
        var new_dates_array = [];

        for (var i = 0; i < length; i++) {

          element = dates_array[i].split(/\./);

          new_dates_array[new_dates_array.length] = element[2]+'.' + element[1]+'.' + element[0];       //2013.12.20
        }
        new_dates_array.sort();

        element = new_dates_array[(new_dates_array.length-1)].split(/\./);

        return element[2]+'.' + element[1]+'.' + element[0];                    //20.12.2013
    }

    // Range days selection
    if ( dates.indexOf(' - ') != -1 ){
        var start_end_date = dates.split(" - ");
        return start_end_date[(start_end_date.length-1)];
    }

    // Single day selection
    return dates;                                                               //20.12.2013
}


/**
 * Check ID of selected additional calendars
 *
 * @param int bk_type
 * @returns array
 */
function wpbc_get_arr_of_selected_additional_calendars( bk_type ){                                                      // FixIn: 8.5.2.26.

    var selected_additionl_calendars = [];

    // Checking according additional calendars
    if ( document.getElementById( 'additional_calendars' + bk_type ) != null ){

        var id_additional_str = document.getElementById( 'additional_calendars' + bk_type ).value;
        var id_additional_arr = id_additional_str.split( ',' );

        for ( var ia = 0; ia < id_additional_arr.length; ia++ ){
            if ( document.getElementById( 'date_booking' + id_additional_arr[ ia ] ).value != '' ){
                selected_additionl_calendars.push( id_additional_arr[ ia ] );
            }
        }
    }
    return selected_additionl_calendars;
}


// == ELEMENTOR Ready Widget Update ====================================================================================

jQuery( function ($) {
	// FixIn: 10.14.15.1.
	if ( (window.elementorFrontend) && ('undefined' !== typeof (elementorFrontend.hooks)) ) {

		elementorFrontend.hooks.addAction( 'frontend/element_ready/wpbc_widget_booking_form_1.default', function ($scope) {
			// Simulate DOM ready,  after  updating Elementor Widget.
			jQuery( document ).trigger( 'wpbc_elementor_ready' );
		} );

		// Catch all widget re-renders.
		// elementorFrontend.hooks.addAction( 'frontend/element_ready/global', function ($scope) {
		// 	console.log( 'Some widget was re-rendered:', $scope );
		// } );
	}
} );

// Elementor widget  reinit. So  we need to reinit all "jQuery( document ).ready( ...) " again with custom 'wpbc_elementor_ready' event.
jQuery( document ).on(
	'wpbc_elementor_ready',
	function () {

		wpbc_hook__init_booking_form_wizard_buttons();

		if ( 'function' === typeof (wpbc_hook__init_timeselector) ) {
			wpbc_hook__init_timeselector();
		}

		if ( 'function' === typeof (wpbc_update_capacity_hint) ) {
			jQuery( '.booking_form_div' ).on(
				'wpbc_booking_date_or_option_selected',
				function (event, resource_id) {
					wpbc_update_capacity_hint( resource_id );
				}
			);
		}

	}
);
