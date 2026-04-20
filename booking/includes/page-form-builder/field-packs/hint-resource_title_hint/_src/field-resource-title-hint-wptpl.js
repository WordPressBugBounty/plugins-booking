// == WPBC BFB Pack: Resource Title Hint
(function ( w ) {
	'use strict';

	if ( typeof w.WPBC_BFB_RegisterShortcodeHintPack !== 'function' ) {
		return;
	}

	w.WPBC_BFB_RegisterShortcodeHintPack( {
		token: 'resource_title_hint',
		shortcode: 'resource_title_hint',
		prefix: 'Selected Resource:',
		label: 'Selected Resource Title',
		boot: 'WPBC_BFB_Resource_Title_Hint_Boot',
		fallback: 'Standard Room'
	} );
})( window );
