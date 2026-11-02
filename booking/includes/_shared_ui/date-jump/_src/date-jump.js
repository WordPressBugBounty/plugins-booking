/**
 * Domain-neutral shared administration date-jump interactions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, $ ) {
	'use strict';

	var root_selector = '[data-wpbc-shared-ui-date-jump]';
	var input_selector = '[data-wpbc-shared-ui-date-jump-input]';
	var toggle_selector = '[data-wpbc-shared-ui-date-jump-toggle]';
	var datepick_marker_attribute = 'data-wpbc-shared-ui-date-jump-datepick';
	var datepick_owner_attribute = 'data-wpbc-shared-ui-date-jump-owner';
	var component_state_key = 'wpbc_shared_ui_date_jump_state';

	/**
	 * Parse one strict ISO calendar date without timezone conversion.
	 *
	 * @param {string} date_value Candidate YYYY-MM-DD value.
	 * @return {Date|null} Local Date instance or null.
	 */
	function parse_iso_date( date_value ) {
		var match = String( date_value || '' ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
		var parsed_date;

		if ( ! match ) {
			return null;
		}
		parsed_date = new Date( Number( match[ 1 ] ), Number( match[ 2 ] ) - 1, Number( match[ 3 ] ) );
		if (
			parsed_date.getFullYear() !== Number( match[ 1 ] ) ||
			parsed_date.getMonth() !== Number( match[ 2 ] ) - 1 ||
			parsed_date.getDate() !== Number( match[ 3 ] )
		) {
			return null;
		}
		return parsed_date;
	}

	/**
	 * Return the single popup owned by the bundled Booking Calendar datepicker.
	 *
	 * @return {jQuery} Datepicker popup, or an empty jQuery collection.
	 */
	function get_datepick_popup() {
		if ( $.datepick && $.datepick.dpDiv && $.datepick.dpDiv.length ) {
			return $.datepick.dpDiv;
		}
		return $( '#datepick-div' ).first();
	}

	/**
	 * Return private interaction state for one rendered component.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {Object} Mutable component-local state.
	 */
	function get_component_state( root ) {
		var state = $.data( root, component_state_key );

		if ( ! state ) {
			state = {
				pending_selected_date: '',
				position_frame: 0,
				restore_toggle_focus: false,
				was_open_on_pointer_down: false
			};
			$.data( root, component_state_key, state );
		}
		return state;
	}

	/**
	 * Determine whether the shared singleton datepicker is open for one input.
	 *
	 * @param {HTMLElement} input Date input.
	 * @return {boolean} True when the popup is open for the supplied input.
	 */
	function is_datepicker_open_for_input( input ) {
		var current_instance = $.datepick ? $.datepick._curInst : null;
		var current_input = current_instance && current_instance.input ? current_instance.input[ 0 ] : null;

		return Boolean( $.datepick && $.datepick._datepickerShowing && current_input === input );
	}

	/**
	 * Read one pixel-valued component token with a safe numeric fallback.
	 *
	 * @param {HTMLElement} root           Component root.
	 * @param {string}      property_name  CSS custom property name.
	 * @param {number}      fallback_value Value used when the token is unavailable.
	 * @return {number} Parsed non-negative pixel value.
	 */
	function get_pixel_token( root, property_name, fallback_value ) {
		var parsed_value = parseFloat( window.getComputedStyle( root ).getPropertyValue( property_name ) );

		return Number.isFinite( parsed_value ) && parsed_value >= 0 ? parsed_value : fallback_value;
	}

	/**
	 * Position the portaled datepicker against the visible disclosure button.
	 *
	 * The bundled datepicker normally anchors itself to its associated input.
	 * This component keeps that input visually hidden, so the visible toggle is
	 * the stable interaction and placement anchor instead.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {void}
	 */
	function position_datepick_popup( root ) {
		var toggle = root.querySelector( toggle_selector );
		var $popup = get_datepick_popup();
		var popup = $popup[ 0 ];
		var toggle_rectangle;
		var popup_rectangle;
		var viewport_width;
		var viewport_height;
		var scroll_x;
		var scroll_y;
		var viewport_gutter;
		var popup_gap;
		var minimum_left;
		var maximum_left;
		var left;
		var below;
		var above;
		var top;
		var is_rtl;

		if ( ! toggle || ! popup || ! root.classList.contains( 'is-open' ) || ! is_datepicker_open_for_input( root.querySelector( input_selector ) ) ) {
			return;
		}
		toggle_rectangle = toggle.getBoundingClientRect();
		popup_rectangle = popup.getBoundingClientRect();
		viewport_width = document.documentElement.clientWidth || window.innerWidth;
		viewport_height = document.documentElement.clientHeight || window.innerHeight;
		scroll_x = window.pageXOffset || document.documentElement.scrollLeft || 0;
		scroll_y = window.pageYOffset || document.documentElement.scrollTop || 0;
		viewport_gutter = get_pixel_token( root, '--wpbc_shared_ui_date_jump__viewport-edge-gap', 8 );
		popup_gap = get_pixel_token( root, '--wpbc_shared_ui_date_jump__popup-gap', 6 );
		minimum_left = scroll_x + viewport_gutter;
		maximum_left = Math.max( minimum_left, scroll_x + viewport_width - popup_rectangle.width - viewport_gutter );
		is_rtl = 'rtl' === window.getComputedStyle( root ).direction;
		left = is_rtl ? toggle_rectangle.left + scroll_x : toggle_rectangle.right + scroll_x - popup_rectangle.width;
		left = Math.min( Math.max( left, minimum_left ), maximum_left );
		below = toggle_rectangle.bottom + scroll_y + popup_gap;
		above = toggle_rectangle.top + scroll_y - popup_rectangle.height - popup_gap;
		top = below;
		if ( below + popup_rectangle.height > scroll_y + viewport_height - viewport_gutter && above >= scroll_y + viewport_gutter ) {
			top = above;
		}
		$popup.css( {
			left: Math.round( left ) + 'px',
			position: 'absolute',
			top: Math.round( Math.max( scroll_y + viewport_gutter, top ) ) + 'px'
		} );
	}

	/**
	 * Schedule one placement pass after datepicker rendering or viewport movement.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {void}
	 */
	function schedule_datepick_position( root ) {
		var state = get_component_state( root );
		var request_frame = window.requestAnimationFrame || function ( callback ) {
			return window.setTimeout( callback, 16 );
		};

		if ( state.position_frame ) {
			return;
		}
		state.position_frame = request_frame( function () {
			state.position_frame = 0;
			position_datepick_popup( root );
		} );
	}

	/**
	 * Cancel a pending placement pass for a closing component.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {void}
	 */
	function cancel_datepick_position( root ) {
		var state = get_component_state( root );
		var cancel_frame = window.cancelAnimationFrame || window.clearTimeout;

		if ( state.position_frame ) {
			cancel_frame.call( window, state.position_frame );
			state.position_frame = 0;
		}
	}

	/**
	 * Mark the shared singleton datepicker as owned by this component.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {void}
	 */
	function mark_datepick_popup( root ) {
		get_datepick_popup()
			.attr( datepick_marker_attribute, 'true' )
			.attr( datepick_owner_attribute, root.getAttribute( 'data-wpbc-shared-ui-date-jump' ) || '' );
	}

	/**
	 * Release the singleton datepicker marker only when this component owns it.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {void}
	 */
	function unmark_datepick_popup( root ) {
		var owner_id = root.getAttribute( 'data-wpbc-shared-ui-date-jump' ) || '';

		get_datepick_popup().each( function () {
			var $popup = $( this );

			if ( owner_id === $popup.attr( datepick_owner_attribute ) ) {
				$popup.removeAttr( datepick_owner_attribute ).removeAttr( datepick_marker_attribute );
			}
		} );
	}

	/**
	 * Dispatch one neutral bubbling component event.
	 *
	 * @param {HTMLElement} root         Component root.
	 * @param {string}      event_name   Custom event name.
	 * @param {Object}      event_detail Scalar event values.
	 * @return {void}
	 */
	function dispatch_component_event( root, event_name, event_detail ) {
		var component_event;

		if ( 'function' === typeof window.CustomEvent ) {
			component_event = new window.CustomEvent( event_name, {
				bubbles: true,
				detail: event_detail
			} );
		} else {
			component_event = document.createEvent( 'CustomEvent' );
			component_event.initCustomEvent( event_name, true, false, event_detail );
		}
		root.dispatchEvent( component_event );
	}

	/**
	 * Open an initialized standard datepicker for the component input.
	 *
	 * @param {HTMLElement} input Date input.
	 * @param {HTMLElement} root  Component root.
	 * @return {void}
	 */
	function show_datepicker( input, root ) {
		var state;

		if ( ! input || ! $.datepick || ! $.datepick._showDatepick || ! $( input ).hasClass( $.datepick.markerClassName ) ) {
			return;
		}
		state = get_component_state( root );
		if ( state.was_open_on_pointer_down || is_datepicker_open_for_input( input ) ) {
			state.was_open_on_pointer_down = false;
			state.restore_toggle_focus = true;
			if ( $.datepick._datepickerShowing ) {
				$.datepick._hideDatepick( null, '' );
			}
			return;
		}
		state.was_open_on_pointer_down = false;
		if ( $.datepick._datepickerShowing && $.datepick._hideDatepick ) {
			$.datepick._hideDatepick( null, '' );
		}
		if ( $.datepick._lastInput === input ) {
			$.datepick._lastInput = null;
		}
		state.restore_toggle_focus = true;
		$.datepick._showDatepick( input );
		position_datepick_popup( root );
		schedule_datepick_position( root );
	}

	/**
	 * Initialize the standard datepicker for one date-jump component.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {boolean} True when this call initialized the component.
	 */
	function initialize_datepicker( root ) {
		var input = root.querySelector( input_selector );
		var toggle = root.querySelector( toggle_selector );
		var first_day = Math.max( 0, Math.min( 6, Number( root.getAttribute( 'data-first-day' ) ) || 0 ) );
		var state;

		if ( ! input || ! toggle || ! $.fn.datepick || root.hasAttribute( 'data-datepick-initialized' ) ) {
			return false;
		}
		root.setAttribute( 'data-datepick-initialized', 'true' );
		state = get_component_state( root );
		$( input ).datepick( {
			beforeShow: function () {
				root.classList.add( 'is-open' );
				toggle.setAttribute( 'aria-expanded', 'true' );
				mark_datepick_popup( root );
			},
			beforeShowDay: function () {
				return [ true, 'date_available' ];
			},
			onSelect: function ( selected_date ) {
				var selected_value = String( selected_date || '' ).split( /\s+-\s+|,\s*/ )[ 0 ];

				if ( ! parse_iso_date( selected_value ) ) {
					return;
				}
				input.value = selected_value;
				root.setAttribute( 'data-selected-date', selected_value );
				state.pending_selected_date = selected_value;
				state.restore_toggle_focus = true;
			},
			onClose: function () {
				cancel_datepick_position( root );
				root.classList.remove( 'is-open' );
				toggle.setAttribute( 'aria-expanded', 'false' );
				window.setTimeout( function () {
					var selected_value = state.pending_selected_date;

					unmark_datepick_popup( root );
					if ( state.restore_toggle_focus && document.documentElement.contains( toggle ) ) {
						state.restore_toggle_focus = false;
						toggle.focus();
					}
					if ( selected_value ) {
						state.pending_selected_date = '';
						dispatch_component_event( root, 'wpbc:shared-ui-date-jump-select', {
							id: root.getAttribute( 'data-wpbc-shared-ui-date-jump' ) || '',
							date: selected_value
						} );
					}
				}, 0 );
			},
			showOn: 'focus',
			showAnim: 'show',
			duration: '',
			multiSelect: 0,
			numberOfMonths: 1,
			stepMonths: 1,
			prevText: '&lsaquo;',
			nextText: '&rsaquo;',
			dateFormat: 'yy-mm-dd',
			changeMonth: false,
			changeYear: false,
			minDate: null,
			maxDate: null,
			showStatus: false,
			multiSeparator: ', ',
			closeAtTop: null,
			firstDay: first_day,
			gotoCurrent: false,
			hideIfNoPrevNext: true,
			useThemeRoller: false,
			mandatory: true
		} );
		return true;
	}

	/**
	 * Preserve pre-activation state before the datepicker outside-click handler.
	 *
	 * The bundled datepicker closes portaled popups during mousedown. Recording
	 * the prior state lets a second disclosure activation remain a true close
	 * instead of closing on mousedown and reopening during the following click.
	 *
	 * @param {MouseEvent} event Capturing mousedown event.
	 * @return {void}
	 */
	function handle_pointer_down( event ) {
		var toggle = event.target.closest ? event.target.closest( toggle_selector ) : null;
		var root = toggle ? toggle.closest( root_selector ) : null;
		var input = root ? root.querySelector( input_selector ) : null;

		if ( root && input ) {
			get_component_state( root ).was_open_on_pointer_down = is_datepicker_open_for_input( input );
		}
	}

	/**
	 * Handle the split action and datepicker toggle through delegation.
	 *
	 * @param {MouseEvent} event Browser click event.
	 * @return {void}
	 */
	function handle_click( event ) {
		var action = event.target.closest( '[data-wpbc-shared-ui-date-jump-action]' );
		var toggle = event.target.closest( toggle_selector );
		var root = action || toggle ? event.target.closest( root_selector ) : null;
		var input;

		if ( ! root ) {
			return;
		}
		if ( action ) {
			dispatch_component_event( root, 'wpbc:shared-ui-date-jump-action', {
				id: root.getAttribute( 'data-wpbc-shared-ui-date-jump' ) || ''
			} );
			return;
		}
		initialize_datepicker( root );
		input = root.querySelector( input_selector );
		if ( input && $.datepick && $( input ).hasClass( $.datepick.markerClassName ) ) {
			show_datepicker( input, root );
		}
	}

	/**
	 * Keep an open portaled datepicker attached to its visible disclosure.
	 *
	 * @return {void}
	 */
	function handle_viewport_change() {
		Array.prototype.forEach.call( document.querySelectorAll( root_selector + '.is-open' ), function ( root ) {
			schedule_datepick_position( root );
		} );
	}

	document.addEventListener( 'mousedown', handle_pointer_down, true );
	document.addEventListener( 'click', handle_click );
	document.addEventListener( 'scroll', handle_viewport_change, true );
	window.addEventListener( 'resize', handle_viewport_change );
}( window, document, window.jQuery ) );
