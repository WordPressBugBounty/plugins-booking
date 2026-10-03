( function () {
	'use strict';

	var restart_form = document.querySelector( '[data-wpbc-setup-overview-restart-form]' );

	if ( restart_form ) {
		restart_form.addEventListener( 'submit', function ( event ) {
			var confirmation_message = restart_form.getAttribute( 'data-confirm-message' ) || '';

			if ( confirmation_message && ! window.confirm( confirmation_message ) ) {
				event.preventDefault();
			}
		} );
	}
}() );
