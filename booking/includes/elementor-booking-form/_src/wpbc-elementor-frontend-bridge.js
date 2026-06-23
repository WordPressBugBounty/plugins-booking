jQuery( document ).on( 'shown.wpbc.modal', '.wpbc_booking_form_popup_modal', function () {
	jQuery( window ).trigger( 'resize' );
	jQuery( this ).trigger( 'wpbc_booking_popup_opened' );
} );
