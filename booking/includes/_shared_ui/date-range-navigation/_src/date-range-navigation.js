/**
 * Domain-neutral shared administration date-range navigation interactions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, $ ) {
	'use strict';

	var root_selector = '[data-wpbc-shared-ui-date-range-navigation]';
	var start_selector = '[data-wpbc-shared-ui-date-range-start]';
	var end_selector = '[data-wpbc-shared-ui-date-range-end]';
	var trigger_selector = '[data-wpbc-shared-ui-popover-trigger]';
	var datepick_marker_attribute = 'data-wpbc-shared-ui-date-range-navigation-datepick';
	var component_state_key = 'wpbc_shared_ui_date_range_navigation_state';

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
	 * Format a Date as a strict local ISO calendar date.
	 *
	 * @param {Date} date_value Calendar date.
	 * @return {string} YYYY-MM-DD value.
	 */
	function format_iso_date( date_value ) {
		var year = date_value.getFullYear();
		var month = ( '0' + String( date_value.getMonth() + 1 ) ).slice( -2 );
		var day = ( '0' + String( date_value.getDate() ) ).slice( -2 );

		return year + '-' + month + '-' + day;
	}

	/**
	 * Return the inclusive number of calendar days between two dates.
	 *
	 * UTC arithmetic prevents daylight-saving transitions from changing the
	 * number of selected calendar dates.
	 *
	 * @param {Date} start_date Inclusive first date.
	 * @param {Date} end_date   Inclusive last date.
	 * @return {number} Inclusive signed day count.
	 */
	function get_inclusive_day_count( start_date, end_date ) {
		var start_epoch = Date.UTC( start_date.getFullYear(), start_date.getMonth(), start_date.getDate() );
		var end_epoch = Date.UTC( end_date.getFullYear(), end_date.getMonth(), end_date.getDate() );

		return Math.round( ( end_epoch - start_epoch ) / 86400000 ) + 1;
	}

	/**
	 * Add whole calendar days to one local Date without mutating the source.
	 *
	 * @param {Date} date_value Source calendar date.
	 * @param {number} day_count Number of days to add.
	 * @return {Date} Shifted calendar date.
	 */
	function add_days( date_value, day_count ) {
		var shifted_date = new Date( date_value.getFullYear(), date_value.getMonth(), date_value.getDate() );

		shifted_date.setDate( shifted_date.getDate() + day_count );
		return shifted_date;
	}

	/**
	 * Read and validate the current paired-date draft.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {Object} Validation result and normalized dates.
	 */
	function validate_draft( root ) {
		var start_input = root.querySelector( start_selector );
		var end_input = root.querySelector( end_selector );
		var maximum_span_days = Math.max( 1, Number( root.getAttribute( 'data-maximum-span-days' ) ) || 1 );
		var start_date = start_input ? parse_iso_date( start_input.value ) : null;
		var end_date = end_input ? parse_iso_date( end_input.value ) : null;
		var span_days = start_date && end_date ? get_inclusive_day_count( start_date, end_date ) : 0;
		var is_ordered = 0 < span_days;
		var is_within_maximum = is_ordered && span_days <= maximum_span_days;

		return {
			is_valid: Boolean( start_date && end_date && is_ordered && is_within_maximum ),
			is_within_maximum: is_within_maximum,
			start_date: start_date,
			end_date: end_date,
			start_value: start_date ? format_iso_date( start_date ) : '',
			end_value: end_date ? format_iso_date( end_date ) : '',
			span_days: span_days
		};
	}

	/**
	 * Display validation state without changing the caller's authorized data.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {Object} Current validation result.
	 */
	function synchronize_validation( root ) {
		var validation = validate_draft( root );
		var start_input = root.querySelector( start_selector );
		var end_input = root.querySelector( end_selector );
		var apply_button = root.querySelector( '[data-wpbc-shared-ui-date-range-apply]' );
		var status = root.querySelector( '[data-wpbc-shared-ui-date-range-status]' );
		var invalid_message = root.querySelector( '[data-wpbc-shared-ui-date-range-invalid-message]' );
		var maximum_message = root.querySelector( '[data-wpbc-shared-ui-date-range-maximum-message]' );
		var message = '';

		if ( ! validation.is_valid ) {
			message = 0 < validation.span_days && ! validation.is_within_maximum
				? ( maximum_message ? maximum_message.textContent : '' )
				: ( invalid_message ? invalid_message.textContent : '' );
		}
		if ( start_input ) {
			start_input.setAttribute( 'aria-invalid', validation.start_date ? 'false' : 'true' );
		}
		if ( end_input ) {
			end_input.setAttribute( 'aria-invalid', validation.end_date && 0 < validation.span_days ? 'false' : 'true' );
		}
		if ( apply_button ) {
			apply_button.disabled = ! validation.is_valid;
		}
		if ( status ) {
			status.textContent = message;
		}
		return validation;
	}

	/**
	 * Return private interaction state for one rendered component.
	 *
	 * Canonical dates may change without replacing the toolbar node after an AJAX
	 * response. Detecting that change resets draft sequencing so an End-first
	 * interaction is again measured from the newly authorized Timeline range.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {Object} Mutable component-local interaction state.
	 */
	function get_component_state( root ) {
		var canonical_start = root.getAttribute( 'data-start-date' ) || '';
		var canonical_end = root.getAttribute( 'data-end-date' ) || '';
		var state = $.data( root, component_state_key );

		if ( ! state ) {
			state = {
				active_input: null,
				canonical_start: canonical_start,
				canonical_end: canonical_end,
				pending_end_handoff: false,
				start_was_edited: false
			};
			$.data( root, component_state_key, state );
		} else if ( state.canonical_start !== canonical_start || state.canonical_end !== canonical_end ) {
			state.active_input = null;
			state.canonical_start = canonical_start;
			state.canonical_end = canonical_end;
			state.pending_end_handoff = false;
			state.start_was_edited = false;
		}
		return state;
	}

	/**
	 * Return dynamic options for the datepicker instance being opened.
	 *
	 * The bundled datepicker uses one popup for every input. Its public `option`
	 * command redraws that singleton, so changing End while Start is visible can
	 * transfer the rendered calendar to the wrong field. Returning options from
	 * `beforeShow` configures only the instance that is about to become active.
	 * End remains unconstrained when it is the first edited boundary so users can
	 * move the existing inclusive range in either direction.
	 *
	 * @param {HTMLElement} root  Component root.
	 * @param {HTMLElement} input Date input that is about to open.
	 * @param {Object}      state Component-local interaction state.
	 * @return {Object} Datepicker options for this open operation.
	 */
	function get_datepicker_open_options( root, input, state ) {
		var start_input = root.querySelector( start_selector );
		var start_date = start_input ? parse_iso_date( start_input.value ) : null;
		var maximum_span_days = Math.max( 1, Number( root.getAttribute( 'data-maximum-span-days' ) ) || 1 );

		if ( ! input.matches( end_selector ) || ! state.start_was_edited || ! start_date ) {
			return {
				minDate: null,
				maxDate: null
			};
		}
		return {
			minDate: start_date,
			maxDate: add_days( start_date, maximum_span_days - 1 )
		};
	}

	/**
	 * Preserve the canonical inclusive span when End is selected first.
	 *
	 * This changes only the local Start draft. It does not focus Start, open its
	 * datepicker, dispatch an apply event, or write domain data.
	 *
	 * @param {HTMLElement} root              Component root.
	 * @param {Date}        selected_end_date Newly selected End calendar date.
	 * @return {void}
	 */
	function preserve_span_from_selected_end( root, selected_end_date ) {
		var start_input = root.querySelector( start_selector );
		var canonical_start = parse_iso_date( root.getAttribute( 'data-start-date' ) || '' );
		var canonical_end = parse_iso_date( root.getAttribute( 'data-end-date' ) || '' );
		var canonical_span_days = canonical_start && canonical_end
			? get_inclusive_day_count( canonical_start, canonical_end )
			: 0;

		if ( ! start_input || ! selected_end_date || canonical_span_days < 1 ) {
			return;
		}
		start_input.value = format_iso_date( add_days( selected_end_date, 1 - canonical_span_days ) );
	}

	/**
	 * Return the single popup owned by the bundled Booking Calendar datepicker.
	 *
	 * The datepicker reuses one body-appended element for every input. Referencing
	 * that singleton directly avoids styling inline calendars or popup elements
	 * created by unrelated libraries.
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
	 * Mark the shared datepicker popup for scoped presentation.
	 *
	 * @param {HTMLElement} root Component root that owns the portaled datepicker.
	 * @return {void}
	 */
	function mark_datepick_popup( root ) {
		var popover = root.querySelector( '[data-wpbc-shared-ui-popover]' );
		var owner_id = popover ? popover.getAttribute( 'data-wpbc-shared-ui-popover' ) : '';
		var $datepick_popup = get_datepick_popup();

		$datepick_popup.attr( datepick_marker_attribute, 'true' );
		if ( owner_id ) {
			$datepick_popup.attr( 'data-wpbc-shared-ui-popover-owner', owner_id );
		}
	}

	/**
	 * Remove external ownership after the standard datepicker closes.
	 *
	 * @param {HTMLElement} root Component root that owned the datepicker.
	 * @return {void}
	 */
	function unmark_datepick_popup( root ) {
		var popover = root.querySelector( '[data-wpbc-shared-ui-popover]' );
		var owner_id = popover ? popover.getAttribute( 'data-wpbc-shared-ui-popover' ) : '';

		get_datepick_popup().each( function () {
			var $datepick_popup = $( this );

			if ( owner_id === $datepick_popup.attr( 'data-wpbc-shared-ui-popover-owner' ) ) {
				$datepick_popup.removeAttr( 'data-wpbc-shared-ui-popover-owner' ).removeAttr( datepick_marker_attribute );
			}
		} );
	}

	/**
	 * Release popup ownership after the datepicker completes its close cycle.
	 *
	 * Switching directly between the paired inputs closes the first datepicker
	 * while opening the second one in the same JavaScript turn. Deferring cleanup
	 * lets the new active instance retain the component marker used for sizing,
	 * positioning, and outside-click ownership.
	 *
	 * @param {HTMLElement} root Component root that owned the datepicker.
	 * @return {void}
	 */
	function schedule_datepick_popup_cleanup( root ) {
		window.setTimeout( function () {
			var current_instance = $.datepick ? $.datepick._curInst : null;
			var current_input = current_instance && current_instance.input ? current_instance.input[ 0 ] : null;
			var current_root = current_input && current_input.closest ? current_input.closest( root_selector ) : null;

			if ( $.datepick && $.datepick._datepickerShowing && current_root === root ) {
				mark_datepick_popup( root );
				return;
			}
			unmark_datepick_popup( root );
		}, 0 );
	}

	/**
	 * Open the standard datepicker when direct focus initialized it too late.
	 *
	 * Normal pointer and keyboard paths initialize from the range trigger before a
	 * date field receives focus. This fallback preserves programmatic focus and
	 * dynamically revealed input paths where the plugin missed that focus event.
	 *
	 * @param {HTMLElement} input Date input.
	 * @param {HTMLElement} root  Component root.
	 * @return {void}
	 */
	function show_datepicker( input, root ) {
		var current_instance;
		var current_input;

		if ( ! input || ! $.datepick || ! $.datepick._showDatepick || ! $( input ).hasClass( $.datepick.markerClassName ) ) {
			return;
		}
		current_instance = $.datepick._curInst;
		current_input = current_instance && current_instance.input ? current_instance.input[ 0 ] : null;
		if ( $.datepick._datepickerShowing && current_input === input ) {
			mark_datepick_popup( root );
			return;
		}
		if ( $.datepick._datepickerShowing && current_input && current_input !== input && $.datepick._hideDatepick ) {
			$.datepick._hideDatepick( null, '' );
		}
		if ( $.datepick._lastInput === input ) {
			$.datepick._lastInput = null;
		}
		$.datepick._showDatepick( input );
	}

	/**
	 * Configure and open End after the Start picker has completely closed.
	 *
	 * The legacy datepicker shares one popup between every input. Updating End
	 * options while Start is still active redraws that shared popup with End data
	 * while its internal active instance still points to Start. Deferring the
	 * complete transition until the close callback prevents that split state.
	 *
	 * @param {HTMLElement} root      Component root.
	 * @param {HTMLElement} end_input End-date input.
	 * @return {void}
	 */
	function schedule_end_datepicker_handoff( root, end_input ) {
		window.setTimeout( function () {
			var panel = root.querySelector( '[data-wpbc-shared-ui-popover-panel]' );

			if ( ! document.documentElement.contains( root ) || ! panel || panel.hidden || end_input.disabled ) {
				return;
			}
			end_input.focus();
			show_datepicker( end_input, root );
		}, 0 );
	}

	/**
	 * Initialize the standard Booking Calendar datepicker for one component.
	 *
	 * @param {HTMLElement} root Component root.
	 * @return {boolean} True when this call initialized the component.
	 */
	function initialize_datepickers( root ) {
		var start_input = root.querySelector( start_selector );
		var end_input = root.querySelector( end_selector );
		var first_day = Math.max( 0, Math.min( 6, Number( root.getAttribute( 'data-first-day' ) ) || 0 ) );
		var state;

		if ( ! start_input || ! end_input || ! $.fn.datepick || root.hasAttribute( 'data-datepick-initialized' ) ) {
			return false;
		}
		root.setAttribute( 'data-datepick-initialized', 'true' );
		state = get_component_state( root );

		[ start_input, end_input ].forEach( function ( input ) {
			$( input ).datepick( {
				beforeShow: function () {
					state.active_input = this;
					mark_datepick_popup( root );
					return get_datepicker_open_options( root, this, state );
				},
				beforeShowDay: function () {
					return [ true, 'date_available' ];
				},
				onSelect: function ( selected_date ) {
					var selected_input = this;
					var selected_value = String( selected_date || '' ).split( /\s+-\s+|,\s*/ )[ 0 ];
					var parsed_selected_date = parse_iso_date( selected_value );

					if ( ! parsed_selected_date || ( selected_input !== start_input && selected_input !== end_input ) ) {
						return;
					}
					selected_input.value = selected_value;
					if ( selected_input === start_input ) {
						state.start_was_edited = true;
						end_input.value = selected_value;
						state.pending_end_handoff = true;
					} else if ( ! state.start_was_edited ) {
						preserve_span_from_selected_end( root, parsed_selected_date );
					}
					synchronize_validation( root );
				},
				onClose: function () {
					var closed_input = this;

					if ( closed_input === start_input && state.pending_end_handoff ) {
						state.pending_end_handoff = false;
						schedule_end_datepicker_handoff( root, end_input );
					}
					if ( state.active_input === closed_input ) {
						state.active_input = null;
					}
					schedule_datepick_popup_cleanup( root );
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
		} );
		synchronize_validation( root );
		return true;
	}

	/**
	 * Prime a component before its first date field receives focus.
	 *
	 * The bundled datepicker binds its own focus listener during initialization.
	 * Preparing from the range trigger or the pointer-down that precedes focus
	 * lets that public listener handle the first field interaction immediately.
	 *
	 * @param {Event} event Pointer, focus, or activation event.
	 * @return {void}
	 */
	function prepare_datepickers( event ) {
		var target = event.target && event.target.closest ? event.target : null;
		var preparation_target = target ? target.closest( trigger_selector + ', ' + start_selector + ', ' + end_selector ) : null;
		var root = preparation_target ? preparation_target.closest( root_selector ) : null;

		if ( root ) {
			initialize_datepickers( root );
		}
	}

	/**
	 * Close the range panel and optionally restore trigger focus.
	 *
	 * @param {HTMLElement} root          Component root.
	 * @param {boolean}     restore_focus Whether to focus the range trigger.
	 * @return {void}
	 */
	function close_panel( root, restore_focus ) {
		var popover = root.querySelector( '[data-wpbc-shared-ui-popover]' );
		var trigger = root.querySelector( '[data-wpbc-shared-ui-popover-trigger]' );
		var panel = root.querySelector( '[data-wpbc-shared-ui-popover-panel]' );

		if ( panel ) {
			panel.hidden = true;
		}
		if ( trigger ) {
			trigger.setAttribute( 'aria-expanded', 'false' );
		}
		if ( popover ) {
			popover.classList.remove( 'is-open', 'is-panel-edge-left', 'is-panel-edge-right', 'is-panel-edge-top' );
		}
		if ( restore_focus && trigger ) {
			trigger.focus();
		}
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
	 * Handle component buttons with one delegated document listener.
	 *
	 * @param {MouseEvent} event Browser click event.
	 * @return {void}
	 */
	function handle_click( event ) {
		var root = event.target.closest( root_selector );
		var shift_button;
		var apply_button;
		var reset_button;
		var start_input;
		var end_input;
		var state;
		var validation;

		if ( ! root ) {
			return;
		}
		shift_button = event.target.closest( '[data-wpbc-shared-ui-date-range-shift]' );
		apply_button = event.target.closest( '[data-wpbc-shared-ui-date-range-apply]' );
		reset_button = event.target.closest( '[data-wpbc-shared-ui-date-range-reset]' );

		if ( shift_button ) {
			dispatch_component_event( root, 'wpbc:shared-ui-date-range-shift', {
				id: root.getAttribute( 'data-wpbc-shared-ui-date-range-navigation' ) || '',
				direction: shift_button.getAttribute( 'data-wpbc-shared-ui-date-range-shift' ) || ''
			} );
			return;
		}
		if ( reset_button ) {
			state = get_component_state( root );
			start_input = root.querySelector( start_selector );
			end_input = root.querySelector( end_selector );
			if ( start_input ) {
				start_input.value = root.getAttribute( 'data-start-date' ) || '';
			}
			if ( end_input ) {
				end_input.value = root.getAttribute( 'data-end-date' ) || '';
			}
			state.pending_end_handoff = false;
			state.start_was_edited = false;
			synchronize_validation( root );
			if ( start_input ) {
				start_input.focus();
			}
			return;
		}
		if ( ! apply_button ) {
			return;
		}
		validation = synchronize_validation( root );
		if ( ! validation.is_valid ) {
			return;
		}
		close_panel( root, true );
		dispatch_component_event( root, 'wpbc:shared-ui-date-range-apply', {
			id: root.getAttribute( 'data-wpbc-shared-ui-date-range-navigation' ) || '',
			start_date: validation.start_value,
			end_date: validation.end_value,
			span_days: validation.span_days
		} );
	}

	/**
	 * Initialize and validate date fields when users interact with them.
	 *
	 * @param {Event} event Focus or input event.
	 * @return {void}
	 */
	function handle_date_field_event( event ) {
		var input = event.target.closest( start_selector + ', ' + end_selector );
		var root = input ? input.closest( root_selector ) : null;
		var state;

		if ( ! root ) {
			return;
		}
		initialize_datepickers( root );
		state = get_component_state( root );
		if ( input.matches( start_selector ) && ( 'input' === event.type || 'change' === event.type ) ) {
			state.start_was_edited = true;
		}
		synchronize_validation( root );
		if ( 'click' === event.type || 'focusin' === event.type ) {
			show_datepicker( input, root );
		}
	}

	document.addEventListener( 'mousedown', prepare_datepickers, true );
	document.addEventListener( 'focusin', prepare_datepickers );
	document.addEventListener( 'click', prepare_datepickers );
	document.addEventListener( 'click', handle_click );
	document.addEventListener( 'click', handle_date_field_event );
	document.addEventListener( 'focusin', handle_date_field_event );
	document.addEventListener( 'input', handle_date_field_event );
	document.addEventListener( 'change', handle_date_field_event );
}( window, document, window.jQuery ) );
