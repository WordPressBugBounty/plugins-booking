/**
 * Free date hints runtime.
 *
 * Mirrors the public Pro cost-hint trigger names when they are not already
 * present, so existing integrations can call the same functions.
 */
// FixIn: 10.15.6.2.
(function ( w, $ ) {
	'use strict';

	var knownHints = [
		'check_in_date_hint',
		'check_out_date_hint',
		'selected_dates_hint',
		'days_number_hint',
		'start_time_hint',
		'end_time_hint'
	];

	w.wpbc_free_date_hints__apply = function ( resourceId, hints ) {
		resourceId = parseInt( resourceId, 10 ) || 1;
		hints = hints || {};

		$.each( hints, function ( hintName, hintValue ) {
			var valueText = $( '<div />' ).html( hintValue ).text();

			$( '#' + hintName + '_tip' + resourceId + ',.' + hintName + '_tip' + resourceId ).html( hintValue );
			$( '#' + hintName + resourceId ).val( valueText );

			if ( typeof w.wpbc__spin_loader__micro__hide === 'function' ) {
				w.wpbc__spin_loader__micro__hide( hintName + '_tip' + resourceId );
			}
		} );
	};

	if ( typeof w.wpbc_send_ajax__show_cost_hints !== 'function' ) {
		w.wpbc_send_ajax__show_cost_hints = function ( resourceId ) {
			var allDates,
				formData,
				myBookingFormName = '',
				nonceEl,
				inst;

			resourceId = parseInt( resourceId, 10 ) || 1;

			$( '.booking_form_div' ).trigger( 'before_show_cost_hints', [ resourceId ] );

			if ( document.getElementById( 'parent_of_additional_calendar' + resourceId ) !== null ) {
				resourceId = parseInt( document.getElementById( 'parent_of_additional_calendar' + resourceId ).value, 10 ) || resourceId;
			}

			if ( 0 === $( '#booking_form' + resourceId ).find( '.wpbc_free_date_hint' ).length ) {
				return false;
			}

			allDates = $( '#date_booking' + resourceId ).val() || '';

			if (
				'undefined' !== typeof _wpbc &&
				'dynamic' === _wpbc.calendar__get_param_value( resourceId, 'days_select_mode' )
			) {
				inst = ( typeof w.wpbc_calendar__get_inst === 'function' ) ? w.wpbc_calendar__get_inst( resourceId ) : null;
				$( '.wpbc_select_check_out_date_message' ).remove();
				if ( null !== inst && inst.stayOpen === true ) {
					$( '.wpbc_free_date_hint' ).html( '...' );
					return false;
				}
			}

			$.each( knownHints, function ( index, hintName ) {
				var hintId = hintName + '_tip' + resourceId;

				if ( typeof w.wpbc__spin_loader__micro__show__inside === 'function' ) {
					w.wpbc__spin_loader__micro__show__inside( hintId, '#' + hintId + ',.' + hintId );
				} else {
					$( '#' + hintId + ',.' + hintId ).html( '...' );
				}
			} );

			if ( document.getElementById( 'booking_form_type' + resourceId ) !== null ) {
				myBookingFormName = document.getElementById( 'booking_form_type' + resourceId ).value;
			}

			nonceEl = document.getElementById( 'wpbc_nonceCALCULATE_THE_COST' + resourceId );
			if ( ! nonceEl ) {
				return false;
			}

			formData = wpbc_free_date_hints__get_form_fields_as_string( resourceId );

			$.ajax( {
				url: w.wpbc_url_ajax,
				type: 'POST',
				success: function ( data, textStatus ) {
					if ( 'success' === textStatus ) {
						$( '#ajax_respond_insert' + resourceId ).html( data );
					}
					$( '.booking_form_div' ).trigger( 'after_show_cost_hints', [ resourceId ] );
				},
				error: function ( XMLHttpRequest, textStatus ) {
					w.status = 'Ajax sending Error status:' + textStatus;
					if ( w.console && w.console.error ) {
						w.console.error( XMLHttpRequest.status + ' ' + XMLHttpRequest.statusText );
					}
				},
				data: {
					action: 'CALCULATE_THE_COST',
					form: formData,
					all_dates: allDates,
					bk_type: resourceId,
					booking_form_type: myBookingFormName,
					wpdev_active_locale: ( 'undefined' !== typeof _wpbc ) ? _wpbc.get_other_param( 'locale_active' ) : '',
					wpbc_nonce: nonceEl.value
				}
			} );

			$( '.booking_form_div' ).trigger( 'show_cost_hints', [ resourceId ] );
			$( '.booking_form_div' ).trigger( 'wpbc_booking_date_or_option_selected', [ resourceId ] );

			return false;
		};
	}

	if ( typeof w.wpbc_show_cost_hints_after_few_seconds !== 'function' ) {
		w.wpbc_show_cost_hints_after_few_seconds = (function () {
			var closedTimer = 0;

			return function ( resourceId, timerDelay ) {
				timerDelay = typeof timerDelay !== 'undefined' ? timerDelay : 250;
				clearTimeout( closedTimer );
				closedTimer = setTimeout( w.wpbc_send_ajax__show_cost_hints.bind( null, resourceId ), timerDelay );
			};
		}());
	}

	if ( typeof w.showCostHintInsideBkForm !== 'function' ) {
		w.showCostHintInsideBkForm = function ( resourceId ) {
			w.wpbc_show_cost_hints_after_few_seconds( resourceId );
		};
	}

	$( function () {
		$( 'body' ).on( 'wpbc_calendar_ajx__loaded_data', function ( event, loadedResourceId ) {
			w.wpbc_show_cost_hints_after_few_seconds( loadedResourceId );
		} );

		$( '.booking_form_div' ).on( 'date_selected', function ( event, resourceId ) {
			w.wpbc_show_cost_hints_after_few_seconds( resourceId );
		} );

		$( document ).on( 'change', '.booking_form_div input, .booking_form_div select, .booking_form_div textarea', function () {
			var form = $( this ).closest( 'form.booking_form' ),
				resourceId;

			if ( ! form.length || /^date_booking/.test( this.name || '' ) ) {
				return;
			}

			resourceId = parseInt( form.attr( 'id' ).replace( 'booking_form', '' ), 10 );
			if ( resourceId > 0 ) {
				w.wpbc_show_cost_hints_after_few_seconds( resourceId );
			}
		} );
	} );

	function wpbc_free_date_hints__get_form_fields_as_string( resourceId ) {
		var form = document.getElementById( 'booking_form' + resourceId ),
			formData = '',
			count,
			i,
			element,
			elementType,
			inputValue;

		if ( ! form || ! form.elements ) {
			return '';
		}

		count = form.elements.length;
		for ( i = 0; i < count; i++ ) {
			element = form.elements[ i ];

			if ( ! element || ! element.name ) {
				continue;
			}

			if (
				'button' === element.type ||
				'hidden' === element.type ||
				element.name === ( 'date_booking' + resourceId ) ||
				element.name === ( 'captcha_input' + resourceId )
			) {
				continue;
			}

			elementType = element.type;

			if ( 'checkbox' === element.type ) {
				inputValue = element.checked ? element.value : '';
			} else if ( 'radio' === element.type ) {
				if ( ! element.checked ) {
					continue;
				}
				inputValue = element.value;
			} else {
				inputValue = $( element ).val();
			}

			if ( 'selectbox-multiple' === element.type || 'select-multiple' === element.type ) {
				inputValue = $( '[name="' + element.name + '"]' ).val();
				if ( inputValue === null || inputValue.toString() === '' ) {
					inputValue = '';
				}
			}

			elementType = ( element.className.indexOf( 'wpdev-validates-as-email' ) !== -1 ) ? 'email' : elementType;
			elementType = ( element.className.indexOf( 'wpdev-validates-as-coupon' ) !== -1 ) ? 'coupon' : elementType;
			elementType = ( 'select-one' === elementType ) ? 'selectbox-one' : elementType;
			elementType = ( 'select-multiple' === elementType ) ? 'selectbox-multiple' : elementType;

			if ( formData !== '' ) {
				formData += '~';
			}
			formData += elementType + '^' + element.name + '^' + inputValue;
		}

		return formData;
	}
}( window, jQuery ));
