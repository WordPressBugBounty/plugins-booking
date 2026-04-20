// == WPBC BFB Pack: Capacity Hint
(function ( w ) {
	'use strict';

	if ( typeof w.WPBC_BFB_RegisterShortcodeHintPack !== 'function' ) {
		return;
	}

	w.WPBC_BFB_RegisterShortcodeHintPack( {
		token: 'capacity_hint',
		shortcode: 'capacity_hint',
		prefix: 'Availability:',
		label: 'Availability',
		boot: 'WPBC_BFB_Capacity_Hint_Boot',
		fallback: '4'
	} );
})( window );
