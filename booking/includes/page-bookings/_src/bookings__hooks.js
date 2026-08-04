"use strict";

/**
 * Define HTML ui Hooks: on KeyUp | Change | -> Sort Order & Number Items / Page
 * * We are chnaged it once, because such  elements always the same
 */
function wpbc_ajx_booking_define_ui_hooks_once(){

	//------------------------------------------------------------------------------------------------------------------
	// Booked dates
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_booking_date' ).on( 'change', function( event ){

		var changed_value = JSON.parse( jQuery( '#wh_booking_date' ).val() );

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_booking_date': changed_value,
															'page_num'       : 1,
															// Frontend selected elements (saving for future use, after F5)
															'ui_wh_booking_date_radio'   : jQuery( 'input[name="ui_wh_booking_date_radio"]:checked' ).val(),
															'ui_wh_booking_date_next'    : jQuery( '#ui_wh_booking_date_next' ).val(),
															'ui_wh_booking_date_prior'   : jQuery( '#ui_wh_booking_date_prior' ).val(),
															'ui_wh_booking_date_checkin' : jQuery( '#ui_wh_booking_date_checkin' ).val(),
															'ui_wh_booking_date_checkout': jQuery( '#ui_wh_booking_date_checkout' ).val()
														} );
	} );

	//------------------------------------------------------------------------------------------------------------------
	// Approved | Pending | All
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_approved' ).on( 'change', function( event ){

		var changed_value = jQuery( '#wh_approved' ).val();

		changed_value = JSON.parse( changed_value );

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_approved': changed_value[ 0 ],
															'page_num'   : 1
														} );
	} );

	//------------------------------------------------------------------------------------------------------------------
	// Keywords
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wpbc_search_field' ).on( "keyup", function ( event ){
		if ( 13 !== event.which ){
			wpbc_ajx_booking_searching_after_few_seconds( '#wpbc_search_field' );										// Searching after 1.5 seconds after Key Up
		} else {
			wpbc_ajx_booking_searching_after_few_seconds( '#wpbc_search_field', 0 );									// Immediate search
		}
	} );

	//------------------------------------------------------------------------------------------------------------------
	// Existing | Trash | Any
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_trash' ).on( 'change', function( event ){

		var changed_value = JSON.parse( jQuery( '#wh_trash' ).val() );

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_trash': changed_value[ 0 ],
															'page_num': 1
														} );
	} );

	//------------------------------------------------------------------------------------------------------------------
	// All bookings | New bookings
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_what_bookings' ).on( 'change', function( event ){

		var changed_value = JSON.parse( jQuery( '#wh_what_bookings' ).val() );

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_what_bookings': changed_value[ 0 ],
															'page_num': 1
														} );
	} );

	//------------------------------------------------------------------------------------------------------------------
	// "Creation Date"   of bookings
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_modification_date' ).on( 'change', function( event ){

		var changed_value = JSON.parse( jQuery( '#wh_modification_date' ).val() );

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_modification_date': changed_value,
															'page_num'       : 1,
															// Frontend selected elements (saving for future use, after F5)
															'ui_wh_modification_date_radio'   : jQuery( 'input[name="ui_wh_modification_date_radio"]:checked' ).val(),
															'ui_wh_modification_date_prior'   : jQuery( '#ui_wh_modification_date_prior' ).val(),
															'ui_wh_modification_date_checkin' : jQuery( '#ui_wh_modification_date_checkin' ).val(),
															'ui_wh_modification_date_checkout': jQuery( '#ui_wh_modification_date_checkout' ).val()
														} );
	} );

	//------------------------------------------------------------------------------------------------------------------
	// Payment Status
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_pay_status' ).on( 'change', function( event ){

		var changed_value = JSON.parse( jQuery( '#wh_pay_status' ).val() );

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_pay_status': changed_value,
															'page_num'       : 1,
															// Frontend selected elements (saving for future use, after F5)
															'ui_wh_pay_status_radio' : ( ( undefined === jQuery( 'input[name="ui_wh_pay_status_radio"]:checked' ).val() )
																							? ''
																							: jQuery( 'input[name="ui_wh_pay_status_radio"]:checked' ).val()
																					   ),
															'ui_wh_pay_status_custom': jQuery( '#ui_wh_pay_status_custom' ).val()
														} );


	} );

	//------------------------------------------------------------------------------------------------------------------
	// Min Cost
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_cost' ).on( 'change', function( event ){

		var changed_value = jQuery( '#wh_cost' ).val();

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_cost' : changed_value,
															'page_num': 1
														} );
	} );

	//------------------------------------------------------------------------------------------------------------------
	// Max Cost
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_cost2' ).on( 'change', function( event ){

		var changed_value = jQuery( '#wh_cost2' ).val();

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_cost2' : changed_value,
															'page_num': 1
														} );
	} );

	//------------------------------------------------------------------------------------------------------------------
	// Reusable Chosen listing filters, such as Booking resources/Providers and Appointment Services.
	//------------------------------------------------------------------------------------------------------------------
	jQuery( 'select[data-wpbc-listing-filter-param]' ).on( 'change', function(){

		var listing_filter_param = jQuery( this ).attr( 'data-wpbc-listing-filter-param' );
		var changed_value;
		var request_updates;

		if ( ! listing_filter_param ) {
			return;
		}

		changed_value = ( 'function' === typeof window.wpbc_ui_chosen_filter_get_request_value )
			? window.wpbc_ui_chosen_filter_get_request_value( this )
			: jQuery( this ).val();
		request_updates = {
			'page_num': 1
		};
		request_updates[ listing_filter_param ] = changed_value;

		wpbc_ajx_booking_send_search_request_with_params( request_updates );
	} );


	//------------------------------------------------------------------------------------------------------------------
	// Sorting
	//------------------------------------------------------------------------------------------------------------------
	jQuery( '#wh_sort' ).on( 'change', function( event ){

		var changed_value = jQuery( '#wh_sort' ).val();

		changed_value = JSON.parse( changed_value );

		wpbc_ajx_booking_send_search_request_with_params( {
															'wh_sort': changed_value[ 0 ]
														} );
	} );

}

jQuery(document).ready(function(){
	wpbc_ajx_booking_define_ui_hooks_once();
});
