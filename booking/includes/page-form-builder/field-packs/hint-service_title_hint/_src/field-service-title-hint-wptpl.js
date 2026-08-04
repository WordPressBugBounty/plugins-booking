/**
 * Register the Appointment Service Hint field with the shared hint pack.
 *
 * The content exporter opt-in is unique to this hint because its validated
 * value is stored with the booking and is useful in Booking Listing output.
 */
(function ( w ) {
	'use strict';

	if ( typeof w.WPBC_BFB_RegisterShortcodeHintPack !== 'function' ) {
		return;
	}

	w.WPBC_BFB_RegisterShortcodeHintPack( {
		token: 'service_title_hint',
		shortcode: 'service_title_hint',
		prefix: 'Service:',
		label: 'Service',
		boot: 'WPBC_BFB_Service_Title_Hint_Boot',
		fallback: 'Consultation',
		export_to_booking_data: true
	} );
})( window );
