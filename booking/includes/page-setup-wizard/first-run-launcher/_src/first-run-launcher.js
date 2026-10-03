/**
 * First-install Setup Wizard invitation adapter.
 *
 * @package Booking Calendar
 */
( function( window, document, $ ) {
	'use strict';

	var config = window.wpbc_setup_wizard_first_run_launcher_vars || {};
	var request = null;
	var previous_focus = null;
	var redirect_started = false;

	/**
	 * Restore focus to the pre-dialog control or a stable Booking Listing control.
	 *
	 * @return {void}
	 */
	function restore_focus() {
		var fallback_focus;

		if ( previous_focus && document.body !== previous_focus && document.contains( previous_focus ) ) {
			previous_focus.focus();
			return;
		}

		fallback_focus = document.querySelector( '#wpbc_booking_listing_add_booking_button, .wpbc_ui_el__top_nav a, #wpbody-content h1' );
		if ( fallback_focus && 'function' === typeof fallback_focus.focus ) {
			fallback_focus.focus();
		}
	}

	/**
	 * Persist one validated launcher choice once per request.
	 *
	 * @param {string} choice Choice identifier.
	 * @return {jqXHR|null} Request, or null when configuration is incomplete.
	 */
	function persist_choice( choice ) {
		if ( request ) {
			return request;
		}
		if ( ! config.ajax_url || ! config.action || ! config.nonce ) {
			return null;
		}

		request = $.post( config.ajax_url, {
			action: config.action,
			nonce: config.nonce,
			choice: choice
		} );

		return request;
	}

	/**
	 * Render and open the invitation when all runtime dependencies exist.
	 *
	 * @return {void}
	 */
	function show_dialog() {
		var template;
		var $modal;
		var choice_started = false;
		var selected_choice = '';
		var request_finished = false;
		var request_saved = false;
		var modal_hidden = false;

		/**
		 * Continue after both persistence and modal removal finish.
		 *
		 * @return {void}
		 */
		function finish_dismissal() {
			if ( ! request_finished || ! modal_hidden ) {
				return;
			}

			if ( request_saved && config.show_booking_pages_after_dismiss ) {
				$( document ).trigger( 'wpbc:setup-booking-pages-open', [ {
					consume_prompt: true,
					return_focus: previous_focus
				} ] );
				return;
			}

			restore_focus();
		}

		if ( ! config.setup_url || ! window.wp || 'function' !== typeof window.wp.template || 'function' !== typeof $.fn.wpbc_my_modal || ! document.getElementById( 'tmpl-wpbc-setup-wizard-first-run-popup' ) ) {
			return;
		}

		previous_focus = document.activeElement;
		template = window.wp.template( 'wpbc-setup-wizard-first-run-popup' );
		$( document.body ).append( template( {} ) );
		$modal = $( '#wpbc_setup_wizard_first_run_popup' );

		$modal.on( 'shown.wpbc.modal.wpbcSetupFirstRun', function() {
			$modal.attr( 'aria-hidden', 'false' );
			$( '.modal-backdrop' ).last().addClass( 'wpbc_setup_wizard_first_run_popup__backdrop' );
			$modal.find( '[data-wpbc-setup-first-run-start]' ).trigger( 'focus' );
		} );

		$modal.on( 'hide.wpbc.modal.wpbcSetupFirstRun', function() {
			var dismissal_request;

			if ( choice_started ) {
				return;
			}
			choice_started = true;
			selected_choice = 'dismiss';
			dismissal_request = persist_choice( selected_choice );
			if ( ! dismissal_request ) {
				request_finished = true;
				return;
			}
			dismissal_request.done( function( response ) {
				request_saved = !! ( response && true === response.success );
			} ).always( function() {
				request_finished = true;
				finish_dismissal();
			} );
		} );

		$modal.on( 'hidden.wpbc.modal.wpbcSetupFirstRun', function() {
			$modal.attr( 'aria-hidden', 'true' ).remove();
			modal_hidden = true;
			if ( 'dismiss' === selected_choice ) {
				finish_dismissal();
			}
		} );

		$modal.on( 'click.wpbcSetupFirstRun', '[data-wpbc-setup-first-run-dismiss]', function( event ) {
			event.preventDefault();
			$modal.wpbc_my_modal( 'hide' );
		} );

		$modal.on( 'click.wpbcSetupFirstRun', '[data-wpbc-setup-first-run-start]', function( event ) {
			var start_request;

			event.preventDefault();
			choice_started = true;
			selected_choice = 'start';
			start_request = persist_choice( selected_choice );
			if ( start_request ) {
				start_request.always( function() {
					if ( ! redirect_started ) {
						redirect_started = true;
						window.location.assign( config.setup_url );
					}
				} );
			} else if ( ! redirect_started ) {
				redirect_started = true;
				window.location.assign( config.setup_url );
			}
			$modal.wpbc_my_modal( 'hide' );
		} );

		$modal.wpbc_my_modal( { backdrop: 'static', keyboard: true, show: true } );
	}

	$( function() {
		if ( config.show ) {
			show_dialog();
		}
	} );
}( window, document, window.jQuery ) );
