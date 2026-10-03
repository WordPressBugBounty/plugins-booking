/**
 * Published booking-pages dialog adapter.
 *
 * @package Booking Calendar
 */
( function( window, document, $ ) {
	'use strict';

	var config = window.wpbc_setup_wizard_booking_pages_vars || {};
	var dismissal_request = null;
	var dialog_started = false;
	var previous_focus = null;

	/**
	 * Restore focus after the dialog is removed.
	 *
	 * @return {void}
	 */
	function restore_focus() {
		var fallback_focus;

		if ( previous_focus && document.body !== previous_focus && document.contains( previous_focus ) ) {
			previous_focus.focus();
			return;
		}
		fallback_focus = document.querySelector( '[data-wpbc-booking-pages-open-dialog], #wpbc_booking_listing_add_booking_button, .wpbc_ui_el__top_nav a, #wpbody-content h1' );
		if ( fallback_focus && 'function' === typeof fallback_focus.focus ) {
			fallback_focus.focus();
		}
	}

	/**
	 * Persist automatic prompt consumption once.
	 *
	 * @return {jqXHR|null} Active request, or null without an AJAX contract.
	 */
	function persist_dismissal() {
		if ( dismissal_request ) {
			return dismissal_request;
		}
		if ( ! config.ajax_url || ! config.action || ! config.nonce ) {
			return null;
		}
		dismissal_request = $.post( config.ajax_url, { action: config.action, nonce: config.nonce } );
		return dismissal_request;
	}

	/**
	 * Open the dialog with authorized localized card data.
	 *
	 * @param {boolean} should_consume_prompt Whether closing consumes automatic display.
	 * @param {Element|null} return_focus Control that should regain focus.
	 * @return {void}
	 */
	function show_dialog( should_consume_prompt, return_focus ) {
		var template;
		var $modal;
		var dismissal_started = false;

		if ( dialog_started || ! Array.isArray( config.booking_pages ) || ! config.booking_pages.length || ! window.wp || 'function' !== typeof window.wp.template || 'function' !== typeof $.fn.wpbc_my_modal || ! document.getElementById( 'tmpl-wpbc-setup-wizard-booking-pages-popup' ) ) {
			return;
		}

		previous_focus = return_focus || document.activeElement;
		dialog_started = true;
		template = window.wp.template( 'wpbc-setup-wizard-booking-pages-popup' );
		$( document.body ).append( template( {
			booking_pages: config.booking_pages,
			description: config.description || '',
			dismiss_label: config.dismiss_label || ''
		} ) );
		$modal = $( '#wpbc_setup_wizard_booking_pages_popup' );
		$modal.find( '.wpbc_setup_wizard_booking_pages_popup__image img' ).on( 'error.wpbcSetupBookingPages', function() {
			$( this ).closest( '.wpbc_setup_wizard_booking_pages_popup__image' ).remove();
		} );

		$modal.on( 'shown.wpbc.modal.wpbcSetupBookingPages', function() {
			$modal.attr( 'aria-hidden', 'false' );
			$( '.modal-backdrop' ).last().addClass( 'wpbc_setup_wizard_booking_pages_popup__backdrop' );
			$modal.find( '[data-wpbc-booking-pages-open]' ).first().trigger( 'focus' );
		} );
		$modal.on( 'hide.wpbc.modal.wpbcSetupBookingPages', function() {
			if ( should_consume_prompt && ! dismissal_started ) {
				dismissal_started = true;
				persist_dismissal();
			}
		} );
		$modal.on( 'hidden.wpbc.modal.wpbcSetupBookingPages', function() {
			$modal.attr( 'aria-hidden', 'true' ).remove();
			dialog_started = false;
			restore_focus();
		} );
		$modal.on( 'click.wpbcSetupBookingPages', '[data-wpbc-booking-pages-dismiss]', function( event ) {
			event.preventDefault();
			$modal.wpbc_my_modal( 'hide' );
		} );
		$modal.wpbc_my_modal( { backdrop: 'static', keyboard: true, show: true } );
	}

	$( document ).on( 'click.wpbcSetupBookingPagesLauncher', '[data-wpbc-booking-pages-open-dialog]', function( event ) {
		event.preventDefault();
		show_dialog( false, event.currentTarget );
	} );
	$( document ).on( 'wpbc:setup-booking-pages-open', function( event, options ) {
		options = options || {};
		show_dialog( !! options.consume_prompt, options.return_focus || null );
	} );
	$( function() {
		if ( config.show ) {
			show_dialog( true, document.activeElement );
		}
	} );
}( window, document, window.jQuery ) );
