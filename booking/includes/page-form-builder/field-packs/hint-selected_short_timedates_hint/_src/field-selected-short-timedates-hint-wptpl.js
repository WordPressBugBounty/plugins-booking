// == WPBC BFB Pack: Selected Short Dates and Times Hint
(function ( w ) {
	'use strict';

	if ( typeof w.WPBC_BFB_RegisterShortcodeHintPack !== 'function' ) {
		return;
	}

	w.WPBC_BFB_RegisterShortcodeHintPack( {
		token: 'selected_short_timedates_hint',
		shortcode: 'selected_short_timedates_hint',
		prefix: 'Dates:',
		label: 'Selected Short Dates and Times',
		boot: 'WPBC_BFB_Selected_Short_Timedates_Hint_Boot',
		fallback: '04/18/2026 14:00 - 04/20/2026 12:00'
	} );
})( window );
