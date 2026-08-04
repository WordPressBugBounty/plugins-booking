"use strict";

/**
 * Parameters usually  defined in   Ajax Response or Front-End 	for  == _wpbc_settings.get_all_params__setup_wizard():
 *
 * In 	Front-End side as  JavaScript 		::		wpbc_ajx__setup_wizard_page__send_request_with_params( {  'current_step': 'date_availability', 'do_action': 'none', 'ui_clicked_element_id': 'btn__toolbar__buttons_prior'  } );
 *
 * After Ajax response in setup_ajax.js  as ::		_wpbc_settings.set_params_arr__setup_wizard( response_data[ 'ajx_data' ] );
 *
 */

// =====================================================================================================================
// ==  Set Request  for  Ajax  ==
// =====================================================================================================================
/**
 * Send Ajax Request 	after 	Updating Request Parameters
 *
 * @param params_arr
 *
 * 		Example 1:
 *
 * 			wpbc_ajx__setup_wizard_page__send_request_with_params( {
 *											'page_num': page_number
 *										} );
 * 		Example 2:
 *
 * 			wpbc_ajx__setup_wizard_page__send_request_with_params( {
 *											'current_step': '{{data.steps[ data.current_step ].prior}}',
 *											'do_action': 'none',
 *											'ui_clicked_element_id': 'btn__toolbar__buttons_prior'
 *										} );
 *
 */
function wpbc_ajx__setup_wizard_page__send_request_with_params ( params_arr ){

	// Define Params Array 	to 	Request
	_wpbc_settings.set_params_arr__setup_wizard( params_arr );

	// Send Ajax Request
	wpbc_ajx__setup_wizard_page__send_request();
}
// Example 1:  wpbc_ajx__setup_wizard_page__send_request_with_params( {  'page_num': page_number  } );
// Example 2:  wpbc_ajx__setup_wizard_page__send_request_with_params( {  'current_step': 'date_availability', 'do_action': 'none', 'ui_clicked_element_id': 'btn__toolbar__buttons_prior'  } );


// =====================================================================================================================
// == Show / Hide  Content ==
// =====================================================================================================================
/**
 * Show Main Content	...	_wpbc_settings.get_all_params__setup_wizard()  	-	must  be defined!
 */
function wpbc_setup_wizard_page__show_content() {

	var wpbc_template__stp_wiz__main_content = wp.template( 'wpbc_template__stp_wiz__main_content' );

	jQuery( _wpbc_settings.get_param__other( 'container__main_content' ) ).html(   wpbc_template__stp_wiz__main_content( _wpbc_settings.get_all_params__setup_wizard() )   );

	// Hide 'Processing' Notice
	jQuery( '.wpbc_processing.wpbc_spin').parent().parent().parent().parent( '[id^="wpbc_notice_"]' ).hide();

	//var header_menu_text = ' Step ' + wpbc_setup_wizard_page__get_actual_step_number() + ' / ' + wpbc_setup_wizard_page__get_steps_count();
	//jQuery( '.wpbc_header_menu_tabs .nav-tab-active .nav-tab-text').html( header_menu_text );
	//
	//jQuery( '.wpbc_navigation_menu_left_item ' ).removeClass( 'wpbc_active' );
	//jQuery( '#' + _wpbc_settings.get_param__setup_wizard( 'current_step' ) ).addClass( 'wpbc_active' );

	// Recheck Full Screen  mode,  by  removing top tab
	wpbc_check_full_screen_mode();

	// Scroll to top
	// wpbc_scroll_to(  '.wpbc_page_top__header_tabs' );
	wpbc_scroll_to(  '.wpbc__container_place__steps_for_timeline' );
}

/**
 * Hide Main Content
 */
function wpbc_setup_wizard_page__hide_content(){

	jQuery( _wpbc_settings.get_param__other( 'container__main_content' ) ).html(  '' );
}


/**
 * Update Plugin  menu progress   -> Progress line at  "Left Main Menu"
 */
function wpbc_setup_wizard_page__update_plugin_menu_progress( plugin_menu__setup_progress__html ){
	if ( 'undefined' != typeof (plugin_menu__setup_progress__html) ){
		jQuery( '.setup_wizard_page_container' ).parent().html( plugin_menu__setup_progress__html );
	}
}

// ---------------------------------------------------------------------------------------------------------------------
// ==  Steps Number Functions ==
// 					Gets data in   			_wpbc_settings.get_all_params__setup_wizard().steps
// 					which  defined in   	setup_ajax.php     															Ajax
// 					as 						$data_arr ['steps'] =  new WPBC_SETUP_WIZARD_STEPS();  $this->get_steps_arr();  			from 		setup_steps.php		structure.
// ---------------------------------------------------------------------------------------------------------------------

function wpbc_setup_wizard_page__get_steps_count() {

	var params_arr = _wpbc_settings.get_all_params__setup_wizard().steps
	var steps_count = 0
	_.each( params_arr, function ( p_val, p_key, p_data ) {
		steps_count++;
	} );
	return steps_count;
}

function wpbc_setup_wizard_page__get_actual_step_number() {

	var setup_params = _wpbc_settings.get_all_params__setup_wizard();
	var params_arr   = setup_params.steps;
	var current_step = setup_params.current_step;
	var step_number  = 1;
	var found_step   = false;

	_.each( params_arr, function ( p_val, p_key, p_data ) {
		if ( p_key === current_step ) {
			found_step = true;
			return false;
		}
		step_number++;
	} );

	return found_step ? step_number : 1;
}

function wpbc_setup_wizard_page__update_steps_status( steps_is_done_arr ){

	var params_arr = _wpbc_settings.get_all_params__setup_wizard().steps

	_.each( steps_is_done_arr, function ( p_val, p_key, p_data ) {
		if ( "undefined" !== typeof ( params_arr[ p_key ] ) ) {
			params_arr[ p_key ].is_done = (true === steps_is_done_arr[ p_key ]);
		}
	} );

	return params_arr;

}


function wpbc_setup_wizard_page__is_all_steps_completed(){

	var params_arr = _wpbc_settings.get_all_params__setup_wizard().steps
	var status = true;

	_.each( params_arr, function ( p_val, p_key, p_data ) {
		if ( ! p_val.is_done ){
			status = false;
		}
	} );

	return status;
}

/**
 * Show the configuration controls belonging to the selected booking behavior.
 *
 * @return {void}
 */
function wpbc_setup_wizard_page__refresh_booking_type_details() {

	var booking_type           = jQuery( '[name="wpbc_swp_booking_types"]:checked' ).val() || '';
	var fixed_appointment_type = jQuery( '[name="wpbc_swp_booking_mode"]:checked' )
		.closest( '.wpbc_setup_mode_choice' )
		.attr( 'data-wpbc-setup-fixed-appointment-type' ) || '';
	var is_fixed_appointment_mode = 'durationtime' === fixed_appointment_type;
	var $canonical_times_picker   = jQuery( '[name="wpbc_swp_booking_timeslot_picker"]' );
	var $appointment_times_picker = jQuery( '[name="wpbc_swp_booking_timeslot_picker_appointment"]' );

	jQuery( '.wpbc_in_radio_container_selectbox' ).hide();
	jQuery( '.wpbc_setup_appointment_mode_configuration' ).hide();

	if ( is_fixed_appointment_mode ) {
		if ( $canonical_times_picker.length && $appointment_times_picker.length ) {
			$appointment_times_picker.val( $canonical_times_picker.val() );
		}
		jQuery( '.wpbc_setup_appointment_mode_configuration' ).show();
	} else if ( 'time_slots_appointments' === booking_type ) {
		jQuery( '.wpbc_ui_booking_timeslot_picker__get_on_off__div' ).show();
	} else if ( 'changeover_multi_dates_bookings' === booking_type ) {
		jQuery( '.wpbc_ui_booking_change_over__get_on_off__div' ).show();
	}
}

/**
 * Apply the selected presentation mode to the Step 4 behavior choices.
 *
 * The presentation mode and booking behavior are intentionally independent
 * values. This function limits the visible behaviors to valid combinations
 * without coupling mode switching to any QuickStart content mutation.
 *
 * @return {void}
 */
function wpbc_setup_wizard_page__refresh_booking_mode_choices() {

	var $mode_input = jQuery( '[name="wpbc_swp_booking_mode"]:checked' ).first();
	var $mode_choice;
	var allowed_booking_types;
	var default_booking_type;
	var fixed_appointment_type;
	var is_fixed_appointment_mode;
	var $selected_booking_type;

	if ( ! $mode_input.length ) {
		$mode_input = jQuery( '[name="wpbc_swp_booking_mode"]' ).first().prop( 'checked', true );
	}

	$mode_choice = $mode_input.closest( '.wpbc_setup_mode_choice' );
	if ( ! $mode_choice.length ) {
		wpbc_setup_wizard_page__refresh_booking_type_details();
		return;
	}

	allowed_booking_types = String( $mode_choice.attr( 'data-wpbc-setup-booking-types' ) || '' ).split( ',' );
	default_booking_type = String( $mode_choice.attr( 'data-wpbc-setup-default-booking-type' ) || '' );
	fixed_appointment_type = String( $mode_choice.attr( 'data-wpbc-setup-fixed-appointment-type' ) || '' );
	is_fixed_appointment_mode = 'durationtime' === fixed_appointment_type;

	jQuery( '.wpbc_setup_preferences_heading' ).text( $mode_choice.attr( 'data-wpbc-setup-preference-title' ) || '' );
	jQuery( '.wpbc_setup_booking_type_choice' ).each( function() {
		var booking_type = String( jQuery( this ).attr( 'data-wpbc-setup-booking-type' ) || '' );
		jQuery( this ).toggle( -1 !== jQuery.inArray( booking_type, allowed_booking_types ) );
	} );

	$selected_booking_type = jQuery( '[name="wpbc_swp_booking_types"]:checked' );
	if (
		! $selected_booking_type.length
		|| -1 === jQuery.inArray( String( $selected_booking_type.val() || '' ), allowed_booking_types )
		|| $selected_booking_type.is( ':disabled' )
	) {
		$selected_booking_type = jQuery( '[name="wpbc_swp_booking_types"][value="' + default_booking_type + '"]:not(:disabled)' ).first();
		if ( ! $selected_booking_type.length ) {
			$selected_booking_type = jQuery( '.wpbc_setup_booking_type_choice:visible [name="wpbc_swp_booking_types"]:not(:disabled)' ).first();
		}
		$selected_booking_type.prop( 'checked', true );
	}

	if ( is_fixed_appointment_mode ) {
		jQuery( '[name="wpbc_swp_booking_appointments_type"][value="' + fixed_appointment_type + '"]' ).prop( 'checked', true );
	}

	jQuery( '.wpbc_setup_preferences_heading_row' ).toggle( ! is_fixed_appointment_mode );
	jQuery( '.wpbc_setup_booking_type_choices' ).toggle( ! is_fixed_appointment_mode );

	jQuery( '[name="wpbc_swp_booking_mode"], [name="wpbc_swp_booking_types"]' ).each( function() {
		wpbc_ui_el__radio_container_selection( this );
	} );

	wpbc_setup_wizard_page__refresh_booking_type_details();
}


/**
 * Define UI hooks for elements, after showing in Ajax.
 *
 * Because each  time,  when  we show content in Ajax, all Hooks needs re-defined.
 */
function wpbc_setup_wizard_page__define_ui_hooks(){

	// -----------------------------------------------------------------------------------------------------------------
	// Tooltips
	if ( 'function' === typeof( wpbc_define_tippy_tooltips ) ) {
		var parent_css_class =  _wpbc_settings.get_param__other( 'container__main_content' )  + ' '
		wpbc_define_tippy_tooltips( parent_css_class );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Change Radio Containers
	jQuery( '.wpbc_ui_radio_choice_input' ).on( 'change', function( event ){

		wpbc_ui_el__radio_container_selection( this );

		//wpbc_ajx__setup_wizard_page__send_request_with_params( {   'page_items_count': jQuery( this ).val(),   'page_num': 1   } );
	} );

	jQuery( '.wpbc_ui_radio_choice_input' ).each(function (index ){
		wpbc_ui_el__radio_container_selection( this );
	});

	// Define ability to click on Radio Containers (not only radio-buttons)
	jQuery( '.wpbc_ui_radio_container' ).on( 'click', function( event ){
		wpbc_ui_el__radio_container_click( this );
	} );

	jQuery( '[name="wpbc_swp_booking_mode"]' ).on( 'change', function() {
		wpbc_setup_wizard_page__refresh_booking_mode_choices();
	} );

	jQuery( '[name="wpbc_swp_booking_types"]' ).on( 'change', function() {
		wpbc_setup_wizard_page__refresh_booking_type_details();
	} );

	// Save the Appointment-only presentation control through the historical canonical field.
	jQuery( '[name="wpbc_swp_booking_timeslot_picker_appointment"]' ).on( 'change', function() {
		jQuery( '[name="wpbc_swp_booking_timeslot_picker"]' ).val( jQuery( this ).val() );
	} );

	wpbc_setup_wizard_page__refresh_booking_mode_choices();

	// -----------------------------------------------------------------------------------------------------------------


}


// ---------------------------------------------------------------------------------------------------------------------
// ==  M e s s a g e  ==
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Show message in content
 *
 * @param message				Message HTML
 * @param params = {
 *                   ['type']				'warning' | 'info' | 'error' | 'success'		default: 'warning'
 *                   ['container']			'.wpbc_ajx_cstm__section_left'		default: _wpbc_settings.get_param__other( 'container__main_content')
 *                   ['is_append']			true | false						default: true
 *				   }
 * Example:
 * 			var html_id = wpbc_setup_wizard_page__show_message( 'You can test days selection in calendar', 'info', '.wpbc_ajx_cstm__section_left', true );
 *
 *
 * @returns string  - HTML ID
 */
function wpbc_setup_wizard_page__show_message( message, params = {} ){

	var params_default = {
								'type'     : 'warning',
								'container': _wpbc_settings.get_param__other( 'container__main_content'),
								'is_append': true,
								'style'    : 'text-align:left;',
								'delay'    : 0
							};
	_.each( params, function ( p_val, p_key, p_data ){
		params_default[ p_key ] = p_val;
	} );
	params = params_default;

    var unique_div_id = new Date();
    unique_div_id = 'wpbc_notice_' + unique_div_id.getTime();

	var alert_class = 'notice ';
	if ( params['type'] == 'error' ){
		alert_class += 'notice-error ';
		message = '<i style="margin-right: 0.5em;color: #d63638;" class="menu_icon icon-1x wpbc_icn_report_gmailerrorred"></i>' + message;
	}
	if ( params['type'] == 'warning' ){
		alert_class += 'notice-warning ';
		message = '<i style="margin-right: 0.5em;color: #e9aa04;" class="menu_icon icon-1x wpbc_icn_warning"></i>' + message;
	}
	if ( params['type'] == 'info' ){
		alert_class += 'notice-info ';
	}
	if ( params['type'] == 'success' ){
		alert_class += 'notice-info alert-success updated ';
		message = '<i style="margin-right: 0.5em;color: #64aa45;" class="menu_icon icon-1x wpbc_icn_done_outline"></i>' + message;
	}

	message = '<div id="' + unique_div_id + '" class="wpbc-settings-notice ' + alert_class + '" style="' + params[ 'style' ] + '">' + message + '</div>';

	if ( params['is_append'] ){
		jQuery( params['container'] ).append( message );
	} else {
		jQuery( params['container'] ).html( message );
	}

	params['delay'] = parseInt( params['delay'] );
	if ( params['delay'] > 0 ){

		var closed_timer = setTimeout( function (){
													jQuery( '#' + unique_div_id ).fadeOut( 1500 );
												}
												, params[ 'delay' ]
											 );
	}
	return unique_div_id;
}


// ---------------------------------------------------------------------------------------------------------------------
// ==  Support Functions - Spin Icon in Top Bar Menu -> '  Initial Setup'  ==
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Spin button in Filter toolbar  -  Start
 */
function wpbc_setup_wizard_page_reload_button__spin_start(){
	return false; // Currently  disabled,  maybe activate it for some other element.
	jQuery( '#wpbc_initial_setup_top_menu_item .menu_icon.wpbc_spin').removeClass( 'wpbc_animation_pause' );
}

/**
 * Spin button in Filter toolbar  -  Pause
 */
function wpbc_setup_wizard_page_reload_button__spin_pause(){
	jQuery( '#wpbc_initial_setup_top_menu_item .menu_icon.wpbc_spin' ).addClass( 'wpbc_animation_pause' );
}

/**
 * Spin button in Filter toolbar  -  is Spinning ?
 *
 * @returns {boolean}
 */
function wpbc_setup_wizard_page_reload_button__is_spin(){
    if ( jQuery( '#wpbc_initial_setup_top_menu_item .menu_icon.wpbc_spin' ).hasClass( 'wpbc_animation_pause' ) ){
		return true;
	} else {
		return false;
	}
}
