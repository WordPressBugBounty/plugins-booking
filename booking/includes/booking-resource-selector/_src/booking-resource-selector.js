( function ( window, $ ) {
	'use strict';

	var config = window.wpbc_booking_resource_selector_config || {};
	var active_native_contexts = {};
	var loaded_script_urls = {};

	$( 'script[src]' ).each( function () {
		loaded_script_urls[ String( this.src || '' ) ] = true;
	} );

	/** Return a normalized Booking Resource ID from a selection form. */
	function get_selected_resource_id( $form ) {
		return Number( $form.find( '[name="wpbc_resource_selector_resource"]:checked' ).first().val() || 0 );
	}

	/**
	 * Apply the public text search for one Resource catalog.
	 *
	 * Filtering only hides cards already authorized and rendered by the server;
	 * it cannot add Resource IDs to the signed selection context.
	 *
	 * @param {jQuery} $catalog Resource catalog root.
	 * @return {void}
	 */
	function filter_resource_catalog( $catalog ) {
		var search_term = String( $catalog.find( '[data-wpbc-resource-catalog-search]' ).val() || '' ).toLocaleLowerCase().trim();
		var visible_count = 0;

		$catalog.find( '[data-resource-id]' ).each( function () {
			var $card = $( this );
			var searchable_text = String( $card.attr( 'data-resource-search' ) || '' ).toLocaleLowerCase();
			var is_visible = ! search_term || searchable_text.indexOf( search_term ) !== -1;
			var $resource_input = $card.find( '[name="wpbc_resource_selector_resource"]' );

			$card.prop( 'hidden', ! is_visible );
			$resource_input.prop( 'disabled', ! is_visible );
			if ( is_visible ) {
				visible_count += 1;
			} else if ( $resource_input.prop( 'checked' ) ) {
				$resource_input.prop( 'checked', false );
				$card.removeClass( 'is-selected' );
			}
		} );

		$catalog.find( '[data-wpbc-resource-catalog-empty]' ).prop( 'hidden', 0 !== visible_count );
		$catalog.find( '[data-wpbc-resource-catalog-status]' ).text(
			String( visible_count ) + ' ' + ( 1 === visible_count ? ( config.resource_found || 'Booking Resource found.' ) : ( config.resources_found || 'Booking Resources found.' ) )
		);
	}

	/** Toggle one selector loading state without clearing its current stage. */
	function set_loading( $root, is_loading ) {
		$root.toggleClass( 'is-loading', is_loading ).attr( 'aria-busy', is_loading ? 'true' : 'false' );
		$root.find( '> .wpbc_booking_resource_selector__stage' ).attr( 'aria-busy', is_loading ? 'true' : 'false' );
		$root.find( '> .wpbc_booking_resource_selector__loading' ).prop( 'hidden', ! is_loading ).attr( 'aria-hidden', is_loading ? 'false' : 'true' );
		$root.find( '.wpbc_booking_resource_selector__selection_form :input' ).prop( 'disabled', is_loading );
		if ( ! is_loading ) {
			$root.find( '[data-wpbc-resource-catalog]' ).each( function () {
				filter_resource_catalog( $( this ) );
			} );
		}
	}

	/** Display and focus one controlled AJAX or initialization error. */
	function show_error( $root, message ) {
		var $notice = $root.find( '> .wpbc_booking_resource_selector__ajax_notice' );
		$notice.empty().append( $( '<span>' ).text( message || config.error || 'Unable to load the booking form.' ) ).prop( 'hidden', false );
		if ( $notice.get( 0 ) && typeof $notice.get( 0 ).focus === 'function' ) {
			$notice.trigger( 'focus' );
		}
	}

	/** Clear the selector AJAX error. */
	function clear_error( $root ) {
		$root.find( '> .wpbc_booking_resource_selector__ajax_notice' ).empty().prop( 'hidden', true );
	}

	/** Return a registered context only while its native form remains live. */
	function get_native_context( resource_id ) {
		resource_id = Number( resource_id || 0 );
		var context = active_native_contexts[ resource_id ];
		if ( ! context || ! context.element || ! document.documentElement.contains( context.element ) ) {
			delete active_native_contexts[ resource_id ];
			return null;
		}
		return context;
	}

	/** Detect any other live native Booking Calendar form for the same resource. */
	function has_duplicate_resource_form( $root, resource_id ) {
		resource_id = Number( resource_id || 0 );
		if ( ! resource_id ) {
			return false;
		}

		var context = get_native_context( resource_id );
		if ( context && ! $.contains( $root.get( 0 ), context.element ) ) {
			return true;
		}

		return $( '[id="booking_form' + resource_id + '"]' ).filter( function () {
			return ! $.contains( $root.get( 0 ), this );
		} ).length > 0;
	}

	/** Register the signed resource context used by final booking submission. */
	function register_native_form( $native ) {
		var resource_id = Number( $native.data( 'resource-id' ) || 0 );
		var context_token = String( $native.attr( 'data-resource-selector-context-token' ) || '' );
		var allow_past = '1' === String( $native.attr( 'data-allow-past' ) || '0' ) ? 1 : 0;
		var existing = get_native_context( resource_id );

		if ( ! resource_id || ! context_token ) {
			return false;
		}
		if ( existing && existing.element !== $native.get( 0 ) ) {
			return false;
		}

		active_native_contexts[ resource_id ] = {
			element: $native.get( 0 ),
			resource_id: resource_id,
			context_token: context_token,
			allow_past: allow_past
		};
		return true;
	}

	/** Remove one native form from the local submission registry. */
	function unregister_native_form( $native ) {
		var resource_id = Number( $native.data( 'resource-id' ) || 0 );
		var context = get_native_context( resource_id );
		if ( context && context.element === $native.get( 0 ) ) {
			delete active_native_contexts[ resource_id ];
		}
	}

	/** Prepare a newly inserted native form for resource-bound submission. */
	function prepare_native_form( $scope ) {
		var $native = $scope.find( '.wpbc_booking_resource_selector__native_form' ).first();
		if ( ! $native.length ) {
			return true;
		}

		return register_native_form( $native );
	}

	/** Convert a script URL to the same absolute form used by script elements. */
	function get_absolute_script_url( url ) {
		var anchor = document.createElement( 'a' );
		anchor.href = String( url || '' );
		return anchor.href;
	}

	/** Return a rejected promise carrying one controlled message. */
	function rejected_stage( message ) {
		var deferred = $.Deferred();
		deferred.reject( { wpbc_message: message } );
		return deferred.promise();
	}

	/** Execute renderer scripts sequentially while the request owns the stage. */
	function execute_scripts( scripts, owns_stage ) {
		var sequence = $.Deferred().resolve().promise();

		$.each( scripts, function ( index, script ) {
			sequence = sequence.then( function () {
				if ( ! owns_stage() ) {
					return rejected_stage( '' );
				}
				if ( script.src ) {
					var absolute_url = get_absolute_script_url( script.src );
					if ( loaded_script_urls[ absolute_url ] ) {
						return undefined;
					}
					return $.ajax( { url: absolute_url, dataType: 'script', cache: true } ).then( function () {
						loaded_script_urls[ absolute_url ] = true;
					} );
				}
				if ( script.code ) {
					$.globalEval( script.code );
				}
				return undefined;
			} );
		} );

		return sequence;
	}

	/** Initialize native controls whose core handlers bind on document ready. */
	function initialize_ajax_form_controls() {
		if ( typeof window.wpbc_hook__init_booking_form_wizard_buttons === 'function' ) {
			window.wpbc_hook__init_booking_form_wizard_buttons();
		}
	}

	/** Destroy native calendars and unregister context before stage removal. */
	function cleanup_native_form( $root ) {
		$root.find( '.wpbc_booking_resource_selector__native_form' ).each( function () {
			var $native = $( this );
			var resource_id = Number( $native.data( 'resource-id' ) || 0 );
			var $calendar = $native.find( '#calendar_booking' + resource_id );

			unregister_native_form( $native );
			if ( ! resource_id || ! $calendar.length || ! $.datepick || typeof $calendar.datepick !== 'function' ) {
				return;
			}

			try {
				var instance = typeof $.datepick._getInst === 'function' ? $.datepick._getInst( $calendar.get( 0 ) ) : null;
				if ( instance ) {
					$calendar.datepick( 'destroy' );
				}
			} catch ( error ) {
				$calendar.removeClass( 'hasDatepick' );
			}
		} );
	}

	/** Restore the configured initial Resource choice after Start over. */
	function restore_resource_selection( $root ) {
		var resource_id = Number( $root.attr( 'data-selected-resource-id' ) || 0 );
		if ( ! resource_id ) {
			return;
		}
		var $input = $root.find( '[name="wpbc_resource_selector_resource"][value="' + resource_id + '"]' ).first();
		if ( $input.length ) {
			$input.closest( '.wpbc_booking_resource_selector__choices' ).find( '.wpbc_booking_resource_selector__choice' ).removeClass( 'is-selected' );
			$input.prop( 'checked', true ).closest( '.wpbc_booking_resource_selector__choice' ).addClass( 'is-selected' );
		}
	}

	/** Focus the new stage heading and keep the component near the viewport. */
	function focus_stage( $root ) {
		var $target = $root.find( '> .wpbc_booking_resource_selector__stage .wpbc_booking_resource_selector__heading h3, > .wpbc_booking_resource_selector__stage .wpbc_booking_resource_selector__notice' ).first();
		if ( $target.length ) {
			$target.attr( 'tabindex', '-1' );
			try {
				$target.get( 0 ).focus( { preventScroll: true } );
			} catch ( error ) {
				$target.trigger( 'focus' );
			}
		}

		if ( $root.get( 0 ) && typeof $root.get( 0 ).scrollIntoView === 'function' ) {
			var reduce_motion = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
			$root.get( 0 ).scrollIntoView( { behavior: reduce_motion ? 'auto' : 'smooth', block: 'nearest' } );
		}
	}

	/** Determine whether an AJAX callback still owns the component state. */
	function is_current_request( $root, request_id ) {
		return Number( $root.data( 'wpbc-resource-selector-request-id' ) || 0 ) === Number( request_id );
	}

	/** Finish only the current request so stale callbacks cannot alter the UI. */
	function finish_request( $root, request_id ) {
		if ( ! is_current_request( $root, request_id ) ) {
			return;
		}
		$root.removeData( 'wpbc-resource-selector-request' );
		set_loading( $root, false );
	}

	/** Replace a complete stage with DOM-before-script initialization ordering. */
	function replace_stage( $root, html, stage, resource_id, request_id ) {
		if ( ! is_current_request( $root, request_id ) ) {
			return rejected_stage( '' );
		}
		if ( 'booking' === stage && has_duplicate_resource_form( $root, resource_id ) ) {
			return rejected_stage( config.duplicate_resource );
		}

		var parsed = $.parseHTML( String( html || '' ), document, true ) || [];
		var scripts = [];
		var $container = $( '<div>' ).append( parsed );

		$container.find( 'script' ).addBack( 'script' ).each( function () {
			scripts.push( { src: this.src || '', code: this.src ? '' : ( this.text || this.textContent || '' ) } );
			$( this ).remove();
		} );

		cleanup_native_form( $root );
		$root.attr( 'data-resource-selector-stage', stage );
		$root.find( '> .wpbc_booking_resource_selector__stage' ).empty().append( $container.contents() );

		if ( ! prepare_native_form( $root ) ) {
			cleanup_native_form( $root );
			$root.find( '.wpbc_booking_resource_selector__native_form :input' ).prop( 'disabled', true );
			return rejected_stage( config.initialization_error || config.error );
		}

		return execute_scripts( scripts, function () {
			return is_current_request( $root, request_id );
		} ).then( function () {
			if ( ! is_current_request( $root, request_id ) ) {
				return rejected_stage( '' );
			}
			initialize_ajax_form_controls();
			if ( 'resource' === stage ) {
				restore_resource_selection( $root );
			}
		} );
	}

	/** Request and render the next Booking Resource selector stage. */
	function resolve_stage( $root, resource_id ) {
		if ( ! $root || ! $root.length ) {
			return;
		}

		resource_id = Number( resource_id || 0 );
		if ( resource_id ) {
			$root.attr( 'data-selected-resource-id', resource_id );
		}

		var previous_request = $root.data( 'wpbc-resource-selector-request' );
		var request_id = Number( $root.data( 'wpbc-resource-selector-request-id' ) || 0 ) + 1;
		$root.data( 'wpbc-resource-selector-request-id', request_id );
		if ( previous_request && previous_request.readyState !== 4 ) {
			previous_request.abort();
		}

		clear_error( $root );
		set_loading( $root, true );
		var request = $.post( config.ajax_url, {
			action: config.action,
			nonce: config.nonce,
			config_token: $root.attr( 'data-config-token' ) || '',
			resource_id: resource_id
		} );
		$root.data( 'wpbc-resource-selector-request', request );

		request.done( function ( response ) {
			if ( ! is_current_request( $root, request_id ) ) {
				return;
			}
			if ( ! response || ! response.success || ! response.data ) {
				show_error( $root, response && response.data && response.data.message ? response.data.message : config.error );
				finish_request( $root, request_id );
				return;
			}

			var stage = response.data.stage || '';
			var replacement = replace_stage( $root, response.data.html, stage, response.data.resource_id, request_id );
			replacement.done( function () {
				if ( ! is_current_request( $root, request_id ) ) {
					return;
				}
				if ( Number( response.data.resource_id || 0 ) ) {
					$root.attr( 'data-selected-resource-id', Number( response.data.resource_id ) );
				}
				finish_request( $root, request_id );
				focus_stage( $root );
			} ).fail( function ( error ) {
				if ( ! is_current_request( $root, request_id ) ) {
					return;
				}
				show_error( $root, error && error.wpbc_message ? error.wpbc_message : ( config.initialization_error || config.error ) );
				finish_request( $root, request_id );
			} );
		} ).fail( function ( xhr, status ) {
			if ( 'abort' === status || ! is_current_request( $root, request_id ) ) {
				return;
			}
			var response = xhr.responseJSON;
			show_error( $root, response && response.data && response.data.message ? response.data.message : config.error );
			finish_request( $root, request_id );
		} );
	}

	/** Resolve the selected Booking Resource through AJAX. */
	$( document ).on( 'submit', '.wpbc_booking_resource_selector__selection_form', function ( event ) {
		if ( ! config.ajax_url || ! config.action ) {
			return;
		}
		event.preventDefault();
		var $form = $( this );
		resolve_stage( $form.closest( '.wpbc_booking_resource_selector' ), get_selected_resource_id( $form ) );
	} );

	/** Keep selected card styling independent from CSS :has() support. */
	$( document ).on( 'change', '.wpbc_booking_resource_selector__choice > input', function () {
		var $input = $( this );
		$input.closest( '.wpbc_booking_resource_selector__choices' ).find( '.wpbc_booking_resource_selector__choice' ).removeClass( 'is-selected' );
		$input.closest( '.wpbc_booking_resource_selector__choice' ).addClass( 'is-selected' );
	} );

	/** Filter cards without changing the server-authorized Resource set. */
	$( document ).on( 'input', '.wpbc_booking_resource_catalog [data-wpbc-resource-catalog-search]', function () {
		filter_resource_catalog( $( this ).closest( '[data-wpbc-resource-catalog]' ) );
	} );

	/** Return to Resource selection without reloading the public page. */
	$( document ).on( 'click', '.wpbc_booking_resource_selector [data-wpbc-resource-selector-action="start-over"]', function ( event ) {
		if ( ! config.ajax_url || ! config.action ) {
			return;
		}
		event.preventDefault();
		var $root = $( this ).closest( '.wpbc_booking_resource_selector' );
		if ( $root.hasClass( 'is-loading' ) ) {
			return;
		}
		resolve_stage( $root, 0 );
	} );

	/** Add the signed resource context to the core booking-create request. */
	$( 'body' ).on( 'wpbc_before_booking_create.wpbc_booking_resource_selector', function ( event, resource_id, params ) {
		var context = get_native_context( resource_id );
		if ( ! context || ! params ) {
			return;
		}
		params.resource_selector_required = 1;
		params.resource_selector_context_token = context.context_token;
		params.allow_past = context.allow_past;
	} );

	$( function () {
		$( '.wpbc_booking_resource_selector' ).each( function () {
			var $root = $( this );
			var $native = $root.find( '.wpbc_booking_resource_selector__native_form' ).first();
			if ( $native.length ) {
				$root.attr( 'data-selected-resource-id', Number( $native.data( 'resource-id' ) || 0 ) );
			}
			var duplicate = $native.length && has_duplicate_resource_form( $root, Number( $native.data( 'resource-id' ) || 0 ) );
			if ( duplicate || ! prepare_native_form( $root ) ) {
				cleanup_native_form( $root );
				$root.find( '.wpbc_booking_resource_selector__native_form :input' ).prop( 'disabled', true );
				show_error( $root, duplicate ? config.duplicate_resource : config.initialization_error );
			}
		} );
	} );
} )( window, jQuery );
