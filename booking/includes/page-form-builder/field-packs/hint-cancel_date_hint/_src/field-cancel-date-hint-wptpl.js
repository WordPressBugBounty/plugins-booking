// == WPBC BFB Pack: Cancel Date Hint
(function ( w ) {
	'use strict';
	if ( typeof w.WPBC_BFB_RegisterShortcodeHintPack !== 'function' ) { return; }
	w.WPBC_BFB_RegisterShortcodeHintPack( { token: 'cancel_date_hint', shortcode: 'cancel_date_hint', prefix: 'Cancel Until:', label: 'Cancel Date', boot: 'WPBC_BFB_Cancel_Date_Hint_Boot', fallback: '04/04/2026 00:00' } );
})( window );
