/**
 * Administration Timeline composition entry point.
 *
 * Focused modules register their factories before this file executes. This
 * entry point resolves the server-rendered page hosts and creates exactly one
 * page-controller instance through the Timeline module lifecycle registry.
 * It intentionally owns no Timeline rendering, requests, or interaction state.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var module_id = 'page_controller';
	var module_instance_id = 'wpbc_timeline';

	/**
	 * Mount the registered Timeline page controller once the document is ready.
	 *
	 * Missing hosts or factories are treated as an incomplete asset contract and
	 * leave the server-rendered loading shell in place. The release parity suite
	 * verifies that the ordered runtime bundle always supplies the factory.
	 *
	 * @return {void}
	 */
	function mount_timeline_controller() {
		var module_runtime = window.wpbc_timeline_modules;
		var mount = document.querySelector( '[data-wpbc-timeline-mount="wpbc_timeline"]' );
		var status_region = document.querySelector( '[data-wpbc-timeline-status]' );

		if (
			! mount
			|| ! module_runtime
			|| 'function' !== typeof module_runtime.has_factory
			|| 'function' !== typeof module_runtime.create
			|| ! module_runtime.has_factory( module_id )
		) {
			return;
		}

		module_runtime.create( module_id, module_instance_id, {
			mount: mount,
			status_region: status_region,
			settings: window.wpbc_timeline_config || {}
		} );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', mount_timeline_controller );
	} else {
		mount_timeline_controller();
	}
}( window, document ) );
