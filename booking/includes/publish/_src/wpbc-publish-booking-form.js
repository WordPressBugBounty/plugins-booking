/**
 * Neutral Booking Form publishing modal controller.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
( function( $, window, document ) {
	'use strict';

	var last_trigger = null;
	var pages_request = null;

	/**
	 * Return localized publishing configuration.
	 *
	 * @return {Object} Publishing configuration.
	 */
	function get_config() {
		return window.wpbc_publish_booking_form_vars || {};
	}

	/**
	 * Normalize a localized WordPress flag to a strict boolean.
	 *
	 * wp_localize_script() serializes scalar configuration values as strings,
	 * so the disabled value arrives as "0", which is otherwise truthy in
	 * JavaScript.
	 *
	 * @param {*} flag_value Localized flag value.
	 *
	 * @return {boolean} True only for an explicitly enabled flag.
	 */
	function is_true_flag( flag_value ) {
		return true === flag_value || 1 === flag_value || '1' === flag_value || 'true' === String( flag_value ).toLowerCase();
	}

	/**
	 * Return the native publishing modal.
	 *
	 * @return {jQuery} Modal element.
	 */
	function get_modal() {
		return $( get_config().modal_selector || '#wpbc_publish_booking_form__modal' );
	}

	/**
	 * Escape plain text before inserting it into status markup.
	 *
	 * @param {string} message Plain text.
	 *
	 * @return {string} Escaped text.
	 */
	function escape_html( message ) {
		return $( '<div>' ).text( String( message || '' ) ).html();
	}

	/**
	 * Extract a sanitized Booking Form name from a shortcode.
	 *
	 * @param {string} shortcode_raw Raw Booking shortcode.
	 *
	 * @return {string} Sanitized form name.
	 */
	function get_form_name( shortcode_raw ) {
		var match = String( shortcode_raw || '' ).match( /\bform_type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/i );
		var form_name = match ? ( match[ 1 ] || match[ 2 ] || match[ 3 ] || '' ) : '';

		form_name = String( form_name ).toLowerCase().replace( /[^a-z0-9_-]/g, '' );

		return form_name || 'standard';
	}

	/**
	 * Reset the modal to its initial chooser state.
	 *
	 * @return {void}
	 */
	function reset_modal() {
		var $modal = get_modal();
		var $page_list = $modal.find( '[data-wpbc-publish-booking-form-page-list]' );

		if ( pages_request && 'function' === typeof pages_request.abort ) {
			pages_request.abort();
		}
		pages_request = null;

		$modal.find( '.wpbc_publish_booking_form__notice' ).empty();
		$modal.find( '.wpbc_publish_booking_form__panel' ).hide();
		$modal.find( '.wpbc_publish_booking_form__result_actions' ).hide();
		$modal.find( '[data-wpbc-publish-booking-form-open-page], [data-wpbc-publish-booking-form-edit-page]' ).hide().attr( 'href', '#' );
		$modal.find( '.wpbc_publish_booking_form__chooser' ).show();
		$modal.find( '.modal-footer' ).hide();
		$page_list.find( 'option:not(:first)' ).remove();
		$page_list.val( '0' ).prop( 'disabled', true );
		$modal.find( '#wpbc_publish_booking_form_page_title' ).val( '' );
		set_busy( false );
	}

	/**
	 * Toggle all publishing controls while a request is active.
	 *
	 * @param {boolean} is_busy Whether publishing is active.
	 *
	 * @return {void}
	 */
	function set_busy( is_busy ) {
		get_modal().find( '[data-wpbc-publish-booking-form-mode], [data-wpbc-publish-booking-form-submit], [data-wpbc-publish-booking-form-back]' )
			.prop( 'disabled', Boolean( is_busy ) )
			.attr( 'aria-disabled', is_busy ? 'true' : 'false' );
	}

	/**
	 * Render a plain error inside the native modal.
	 *
	 * @param {string} message Error message.
	 *
	 * @return {void}
	 */
	function show_error( message ) {
		get_modal().find( '.wpbc_publish_booking_form__notice' ).html(
			'<div class="wpbc-settings-notice notice-error">' + escape_html( message ) + '</div>'
		);
	}

	/**
	 * Show the Booking Calendar mini spinner and loading label.
	 *
	 * @return {void}
	 */
	function show_loading( loading_message ) {
		var i18n = get_config().i18n || {};

		get_modal().find( '.wpbc_publish_booking_form__notice' ).html(
			'<div class="wpbc_spins_loading_container wpbc_publish_booking_form__loading" role="status">' +
				'<div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div>' +
				'<span>' + escape_html( loading_message || i18n.loading || 'Publishing booking form' ) + '...</span>' +
			'</div>'
		);
	}

	/**
	 * Load the editable WordPress pages through the authorized endpoint.
	 *
	 * Page titles are intentionally absent from the initial catalog markup. The
	 * live-demo guard runs before this request on the client and again before the
	 * page query on the server.
	 *
	 * @return {void}
	 */
	function load_publishable_pages() {
		var config = get_config();
		var i18n = config.i18n || {};
		var $modal = get_modal();
		var $page_list = $modal.find( '[data-wpbc-publish-booking-form-page-list]' );

		if ( is_true_flag( config.is_demo ) ) {
			show_error( i18n.demo_error || 'In the demo versions this operation is not allowed.' );
			return;
		}

		set_busy( true );
		show_loading( i18n.loading_pages || 'Loading pages' );

		pages_request = $.ajax(
			{
				url: config.ajax_url || window.ajaxurl || '',
				method: 'POST',
				dataType: 'json',
				data: {
					action: config.pages_action || 'WPBC_AJX_GET_PUBLISHABLE_PAGES',
					nonce: config.nonce || ''
				}
			}
		).done(
			function( response ) {
				var result = response && response.data ? response.data : {};
				var pages = $.isArray( result.pages ) ? result.pages : [];

				if ( ! response || ! response.success ) {
					show_error( result.message || i18n.generic_error || 'Unable to load pages.' );
					return;
				}

				$page_list.find( 'option:not(:first)' ).remove();
				$.each(
					pages,
					function( index, page ) {
						$( '<option>' ).val( parseInt( page.id, 10 ) || 0 ).text( String( page.title || '' ) ).appendTo( $page_list );
					}
				);

				$modal.find( '.wpbc_publish_booking_form__notice' ).empty();
				$page_list.prop( 'disabled', ! pages.length );
				if ( pages.length ) {
					$page_list.trigger( 'focus' );
				} else {
					show_error( i18n.no_pages || 'No editable pages are available.' );
				}
			}
		).fail(
			function( xhr, request_status ) {
				var response = xhr && xhr.responseJSON ? xhr.responseJSON : {};
				var result = response && response.data ? response.data : {};

				if ( 'abort' !== request_status ) {
					show_error( result.message || i18n.generic_error || 'Unable to load pages.' );
				}
			}
		).always(
			function() {
				pages_request = null;
				set_busy( false );
			}
		);
	}

	/**
	 * Open one create or edit panel.
	 *
	 * @param {string} publish_mode Create or edit.
	 *
	 * @return {void}
	 */
	function open_mode( publish_mode ) {
		var $modal = get_modal();
		var $panel;

		if ( 'create' !== publish_mode && 'edit' !== publish_mode ) {
			return;
		}

		$modal.find( '.wpbc_publish_booking_form__notice' ).empty();
		$modal.find( '.wpbc_publish_booking_form__chooser, .wpbc_publish_booking_form__panel, .wpbc_publish_booking_form__result_actions' ).hide();
		$panel = $modal.find( '.wpbc_publish_booking_form__panel--' + publish_mode ).show();
		$modal.find( '.modal-footer' ).show();
		if ( 'edit' === publish_mode ) {
			load_publishable_pages();
		} else {
			$panel.find( 'select, input, button' ).filter( ':visible' ).first().trigger( 'focus' );
		}
	}

	/**
	 * Return the chooser without closing the modal.
	 *
	 * @return {void}
	 */
	function go_back() {
		reset_modal();
		get_modal().find( '[data-wpbc-publish-booking-form-mode="edit"]' ).trigger( 'focus' );
	}

	/**
	 * Publish the current Resource shortcode through the neutral endpoint.
	 *
	 * @param {string} publish_mode Create or edit.
	 *
	 * @return {void}
	 */
	function submit_publish( publish_mode ) {
		var config = get_config();
		var i18n = config.i18n || {};
		var $modal = get_modal();
		var request_data = {
			action: config.action || 'WPBC_AJX_PUBLISH_BOOKING_FORM',
			nonce: config.nonce || '',
			publish_mode: publish_mode,
			resource_id: $modal.find( '[data-wpbc-publish-booking-form-resource-id]' ).val() || 0,
			form_name: $modal.find( '[data-wpbc-publish-booking-form-form-name]' ).val() || 'standard',
			shortcode_raw: $modal.find( '[data-wpbc-publish-booking-form-shortcode]' ).val() || '',
			page_id: $modal.find( '#wpbc_publish_booking_form_page_id' ).val() || 0,
			page_title: $modal.find( '#wpbc_publish_booking_form_page_title' ).val() || ''
		};

		if ( is_true_flag( config.is_demo ) ) {
			show_error( i18n.demo_error || 'In the demo versions this operation is not allowed.' );
			return;
		}
		if ( 'edit' === publish_mode && ! parseInt( request_data.page_id, 10 ) ) {
			show_error( i18n.select_page || 'Please select an existing page.' );
			return;
		}
		if ( 'create' === publish_mode && ! $.trim( request_data.page_title ) ) {
			show_error( i18n.enter_page_title || 'Please enter a page title.' );
			return;
		}

		set_busy( true );
		show_loading( i18n.loading || 'Publishing booking form' );

		$.ajax(
			{
				url: config.ajax_url || window.ajaxurl || '',
				method: 'POST',
				dataType: 'json',
				data: request_data
			}
		).done(
			function( response ) {
				var result = response && response.data ? response.data : {};

				if ( ! response || ! response.success ) {
					show_error( result.message || i18n.generic_error || 'Unable to publish the booking form.' );
					return;
				}

				$modal.find( '.wpbc_publish_booking_form__notice' ).html(
					'<div class="wpbc-settings-notice notice-success">' + ( result.message || '' ) + '</div>'
				);
				$modal.find( '.wpbc_publish_booking_form__chooser, .wpbc_publish_booking_form__panel' ).hide();
				$modal.find( '.modal-footer' ).hide();

				if ( result.view_url ) {
					$modal.find( '[data-wpbc-publish-booking-form-open-page]' ).attr( 'href', result.view_url ).show();
				}
				if ( result.edit_url ) {
					$modal.find( '[data-wpbc-publish-booking-form-edit-page]' ).attr( 'href', result.edit_url ).show();
				}
				$modal.find( '.wpbc_publish_booking_form__result_actions' ).show().find( 'a:visible' ).first().trigger( 'focus' );
			}
		).fail(
			function( xhr ) {
				var response = xhr && xhr.responseJSON ? xhr.responseJSON : {};
				var result = response && response.data ? response.data : {};

				show_error( result.message || i18n.generic_error || 'Unable to publish the booking form.' );
			}
		).always(
			function() {
				set_busy( false );
			}
		);
	}

	/**
	 * Open the neutral publishing modal for one Booking Resource.
	 *
	 * @param {number|string} resource_id   Booking Resource ID.
	 * @param {string}        shortcode_raw Raw Booking shortcode.
	 * @param {HTMLElement}   trigger       Optional opening control.
	 *
	 * @return {void}
	 */
	function open_modal( resource_id, shortcode_raw, trigger ) {
		var config = get_config();
		var i18n = config.i18n || {};
		var $modal = get_modal();

		if ( ! $modal.length || 'function' !== typeof $modal.wpbc_my_modal ) {
			window.alert( i18n.generic_error || 'Publishing dialog is not available.' );
			return;
		}

		last_trigger = trigger && document.contains( trigger ) ? trigger : document.activeElement;
		reset_modal();
		$modal.find( '[data-wpbc-publish-booking-form-resource-id]' ).val( parseInt( resource_id, 10 ) || 0 );
		$modal.find( '[data-wpbc-publish-booking-form-form-name]' ).val( get_form_name( shortcode_raw ) );
		$modal.find( '[data-wpbc-publish-booking-form-shortcode]' ).val( String( shortcode_raw || '' ) );

		$modal.off( 'hidden.wpbc.modal.wpbcPublishBookingForm hidden.bs.modal.wpbcPublishBookingForm' )
			.one(
				'hidden.wpbc.modal.wpbcPublishBookingForm hidden.bs.modal.wpbcPublishBookingForm',
				function() {
					if ( last_trigger && document.contains( last_trigger ) ) {
						last_trigger.focus();
					}
					last_trigger = null;
				}
			);

		$modal.wpbc_my_modal( 'show' );
		window.setTimeout(
			function() {
				$modal.find( '[data-wpbc-publish-booking-form-mode="edit"]' ).trigger( 'focus' );
			},
			0
		);
	}

	$( document ).on( 'click', '[data-wpbc-publish-booking-form-mode]', function() {
		open_mode( $( this ).attr( 'data-wpbc-publish-booking-form-mode' ) || '' );
	} );
	$( document ).on( 'click', '[data-wpbc-publish-booking-form-submit]', function() {
		submit_publish( $( this ).attr( 'data-wpbc-publish-booking-form-submit' ) || '' );
	} );
	$( document ).on( 'click', '[data-wpbc-publish-booking-form-back]', function() {
		go_back();
	} );

	window.wpbc_publish_booking_form__open = open_modal;
}( jQuery, window, document ) );
