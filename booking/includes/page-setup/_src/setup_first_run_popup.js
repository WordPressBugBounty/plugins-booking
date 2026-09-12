/**
 * First-install Setup Wizard and starter-pages prompt adapter.
 *
 * @package Booking Calendar
 * @since   11.8.1
 */
( function( window, document, $ ) {
	'use strict';

	var config = window.wpbc_setup_wizard_first_run_popup_vars || {};
	var setup_prompt = config.setup_prompt || {};
	var booking_pages_prompt = config.booking_pages_prompt || {};
	var setup_request = null;
	var booking_pages_request = null;
	var booking_pages_dialog_started = false;
	var redirect_started = false;
	var previous_focus = null;

	/**
	 * Persist the one-time Setup prompt choice without delaying dismissal.
	 *
	 * @param {string} choice Choice identifier: start or dismiss.
	 * @return {jqXHR|null} Active persistence request, or null when unavailable.
	 */
	function persist_setup_choice( choice ) {
		if ( setup_request ) {
			return setup_request;
		}

		if ( ! config.ajax_url || ! setup_prompt.action || ! setup_prompt.nonce ) {
			return null;
		}

		setup_request = $.post( config.ajax_url, {
			action: setup_prompt.action,
			nonce: setup_prompt.nonce,
			choice: choice
		} );

		return setup_request;
	}

	/**
	 * Persist permanent dismissal of the starter booking-pages prompt.
	 *
	 * @return {jqXHR|null} Active persistence request, or null when unavailable.
	 */
	function persist_booking_pages_dismissal() {
		if ( booking_pages_request ) {
			return booking_pages_request;
		}

		if ( ! config.ajax_url || ! booking_pages_prompt.action || ! booking_pages_prompt.nonce ) {
			return null;
		}

		booking_pages_request = $.post( config.ajax_url, {
			action: booking_pages_prompt.action,
			nonce: booking_pages_prompt.nonce
		} );

		return booking_pages_request;
	}

	/**
	 * Restore useful page focus after the automatic dialog closes.
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
	 * Confirm that an AJAX response represents a saved WordPress choice.
	 *
	 * @param {Object} response WordPress AJAX response.
	 * @return {boolean} True when the server saved the requested state.
	 */
	function is_success_response( response ) {
		return !! ( response && true === response.success );
	}

	/**
	 * Check whether the starter-pages dialog has usable preloaded data.
	 *
	 * @return {boolean} True when the dialog can be presented.
	 */
	function can_show_booking_pages_dialog() {
		return !! (
			! booking_pages_dialog_started &&
			booking_pages_prompt.available &&
			Array.isArray( booking_pages_prompt.booking_pages ) &&
			booking_pages_prompt.booking_pages.length &&
			document.getElementById( 'tmpl-wpbc-setup-wizard-booking-pages-popup' )
		);
	}

	/**
	 * Create and show the WordPress-templated starter booking-pages dialog.
	 *
	 * @param {boolean} should_consume_prompt Whether closing consumes automatic display.
	 * @return {void}
	 */
	function show_booking_pages_dialog( should_consume_prompt ) {
		var template;
		var $modal;
		var dismissal_started = false;

		if (
			! can_show_booking_pages_dialog() ||
			! window.wp || 'function' !== typeof window.wp.template ||
			'function' !== typeof $.fn.wpbc_my_modal
		) {
			restore_focus();
			return;
		}

		booking_pages_dialog_started = true;
		template = window.wp.template( 'wpbc-setup-wizard-booking-pages-popup' );
		$( document.body ).append( template( { booking_pages: booking_pages_prompt.booking_pages } ) );
		$modal = $( '#wpbc_setup_wizard_booking_pages_popup' );
		$modal.find( '.wpbc_setup_wizard_booking_pages_popup__image img' ).on( 'error.wpbcSetupBookingPages', function() {
			$( this ).closest( '.wpbc_setup_wizard_booking_pages_popup__image' ).remove();
		} );

		$modal.on( 'shown.wpbc.modal.wpbcSetupBookingPages', function() {
			$modal.attr( 'aria-hidden', 'false' );
			$( '.modal-backdrop' ).last().addClass( 'wpbc_setup_wizard_first_run_popup__backdrop' );
			$modal.find( '[data-wpbc-booking-pages-open]' ).first().trigger( 'focus' );
		} );

		$modal.on( 'hide.wpbc.modal.wpbcSetupBookingPages', function() {
			if ( should_consume_prompt && ! dismissal_started ) {
				dismissal_started = true;
				persist_booking_pages_dismissal();
			}
		} );

		$modal.on( 'hidden.wpbc.modal.wpbcSetupBookingPages', function() {
			$modal.attr( 'aria-hidden', 'true' ).remove();
			booking_pages_dialog_started = false;
			restore_focus();
		} );

		$modal.on( 'click.wpbcSetupBookingPages', '[data-wpbc-booking-pages-dismiss]', function( event ) {
			event.preventDefault();
			$modal.wpbc_my_modal( 'hide' );
		} );

		$modal.wpbc_my_modal( {
			backdrop: 'static',
			keyboard: true,
			show: true
		} );
	}

	/**
	 * Create and show the WordPress-templated first-run Setup dialog.
	 *
	 * @return {void}
	 */
	function show_setup_dialog() {
		var template;
		var $modal;
		var choice_started = false;
		var selected_choice = '';
		var dismissal_request_finished = false;
		var dismissal_saved = false;
		var setup_dialog_hidden = false;

		/**
		 * Continue only after both AJAX persistence and modal removal finish.
		 *
		 * @return {void}
		 */
		function finish_setup_dismissal() {
			if ( ! dismissal_request_finished || ! setup_dialog_hidden ) {
				return;
			}

			if ( dismissal_saved && can_show_booking_pages_dialog() ) {
				show_booking_pages_dialog( true );
				return;
			}

			restore_focus();
		}

		if (
			! config.ajax_url || ! setup_prompt.action || ! setup_prompt.nonce || ! setup_prompt.setup_url ||
			! window.wp || 'function' !== typeof window.wp.template || 'function' !== typeof $.fn.wpbc_my_modal ||
			! document.getElementById( 'tmpl-wpbc-setup-wizard-first-run-popup' )
		) {
			return;
		}

		template = window.wp.template( 'wpbc-setup-wizard-first-run-popup' );
		$( document.body ).append( template( {} ) );
		$modal = $( '#wpbc_setup_wizard_first_run_popup' );

		$modal.on( 'shown.wpbc.modal.wpbcSetupFirstRun', function() {
			$modal.attr( 'aria-hidden', 'false' );
			$( '.modal-backdrop' ).last().addClass( 'wpbc_setup_wizard_first_run_popup__backdrop' );
			$modal.find( '[data-wpbc-setup-first-run-start]' ).trigger( 'focus' );
		} );

		$modal.on( 'hide.wpbc.modal.wpbcSetupFirstRun', function() {
			var request;

			if ( ! choice_started ) {
				choice_started = true;
				selected_choice = 'dismiss';
				request = persist_setup_choice( 'dismiss' );
				if ( request ) {
					request.done( function( response ) {
						dismissal_saved = is_success_response( response );
					} );
					request.always( function() {
						dismissal_request_finished = true;
						finish_setup_dismissal();
					} );
				} else {
					dismissal_request_finished = true;
				}
			}
		} );

		$modal.on( 'hidden.wpbc.modal.wpbcSetupFirstRun', function() {
			$modal.attr( 'aria-hidden', 'true' ).remove();
			setup_dialog_hidden = true;
			restore_focus();
			if ( 'dismiss' === selected_choice ) {
				finish_setup_dismissal();
			}
		} );

		$modal.on( 'click.wpbcSetupFirstRun', '[data-wpbc-setup-first-run-dismiss]', function( event ) {
			event.preventDefault();
			$modal.wpbc_my_modal( 'hide' );
		} );

		$modal.on( 'click.wpbcSetupFirstRun', '[data-wpbc-setup-first-run-start]', function( event ) {
			var request;

			event.preventDefault();
			choice_started = true;
			selected_choice = 'start';
			request = persist_setup_choice( 'start' );
			if ( request ) {
				request.always( function() {
					if ( ! redirect_started ) {
						redirect_started = true;
						window.location.assign( setup_prompt.setup_url );
					}
				} );
			} else if ( ! redirect_started ) {
				redirect_started = true;
				window.location.assign( setup_prompt.setup_url );
			}
			$modal.wpbc_my_modal( 'hide' );
		} );

		$modal.wpbc_my_modal( {
			backdrop: 'static',
			keyboard: true,
			show: true
		} );
	}

	/**
	 * Start the first eligible dialog without allowing both to overlap.
	 *
	 * @return {void}
	 */
	function initialize_prompts() {
		previous_focus = document.activeElement;

		if ( setup_prompt.show ) {
			show_setup_dialog();
			return;
		}

		if ( booking_pages_prompt.show ) {
			show_booking_pages_dialog( true );
		}
	}

	/**
	 * Reopen the starter-pages dialog from an explicit Booking Listing control.
	 *
	 * Manual opening never re-enables or consumes automatic first-run display.
	 * Focus returns to the invoking button after the dialog closes.
	 *
	 * @param {Event} event Browser click event.
	 * @return {void}
	 */
	function open_booking_pages_dialog_manually( event ) {
		event.preventDefault();
		previous_focus = event.currentTarget;
		show_booking_pages_dialog( false );
	}

	$( document ).on( 'click.wpbcSetupBookingPagesLauncher', '[data-wpbc-booking-pages-open-dialog]', open_booking_pages_dialog_manually );
	$( initialize_prompts );
}( window, document, window.jQuery ) );
