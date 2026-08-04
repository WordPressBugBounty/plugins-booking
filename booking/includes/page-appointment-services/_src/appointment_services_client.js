( function ( w, $ ) {
	'use strict';
	/** Update the visible duration summary for a resource-specific Service selector. */
	function updateSummary( $select ) {
		var $option = $select.find( 'option:selected' ), duration = Number( $option.data( 'duration' ) || 0 ), parts = [];
		if ( duration ) { parts.push( duration + ' min' ); }
		$select.closest( '.wpbc_appointment_service_selector' ).find( '.wpbc_appointment_service_summary' ).text( parts.join( ' · ' ) );
	}
	$( document ).on( 'change', '.wpbc_appointment_service_select', function () { updateSummary( $( this ) ); } );
	$( 'body' ).on( 'wpbc_before_booking_create', function ( event, resourceId, params ) {
		var $select = $( '#wpbc_appointment_service_' + Number( resourceId ) );
		if ( $select.length ) {
			var $option = $select.find( 'option:selected' );
			params.service_id = Number( $select.val() || 0 );
			params.appointment_service_required = 1;
			params.appointment_context_token = String( $option.attr( 'data-appointment-context-token' ) || '' );
		}
	} );
	$( function () { $( '.wpbc_appointment_service_select' ).each( function () { updateSummary( $( this ) ); } ); } );
} )( window, jQuery );
