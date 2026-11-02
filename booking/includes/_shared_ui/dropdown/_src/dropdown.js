/**
 * Domain-neutral shared administration dropdown interactions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var root_selector = '[data-wpbc-shared-ui-dropdown]';
	var trigger_selector = '[data-wpbc-shared-ui-dropdown-trigger]';
	var option_selector = '[data-wpbc-shared-ui-dropdown-option]';
	var popover_panel_selector = '[data-wpbc-shared-ui-popover-panel]';
	var popover_open_dropdown_class = 'has-open-dropdown';
	var available_block_size_property = '--wpbc_shared_ui_dropdown__available-block-size';

	/**
	 * Allow a nested dropdown menu to escape its owning popover scroll box.
	 *
	 * The dropdown menu remains responsible for its own viewport-bounded scroll.
	 * This avoids two competing scrollbars when a dropdown is rendered inside a
	 * reusable popover such as Timeline's Advanced view.
	 *
	 * @param {HTMLElement} dropdown Dropdown root.
	 * @param {boolean}     is_open  Whether this dropdown is open.
	 * @return {void}
	 */
	function synchronize_owning_popover( dropdown, is_open ) {
		var popover_panel = dropdown.closest( popover_panel_selector );

		if ( ! popover_panel ) {
			return;
		}
		if ( is_open ) {
			popover_panel.classList.add( popover_open_dropdown_class );
			return;
		}
		if ( ! popover_panel.querySelector( root_selector + '.is-open' ) ) {
			popover_panel.classList.remove( popover_open_dropdown_class );
		}
	}

	/**
	 * Return enabled option controls for one dropdown.
	 *
	 * @param {HTMLElement} dropdown Dropdown root.
	 * @return {Array<HTMLElement>} Ordered enabled options.
	 */
	function get_enabled_options( dropdown ) {
		return Array.prototype.filter.call( dropdown.querySelectorAll( option_selector ), function ( option ) {
			return ! option.disabled && 'true' !== option.getAttribute( 'aria-disabled' );
		} );
	}

	/**
	 * Close one dropdown and optionally restore trigger focus.
	 *
	 * @param {HTMLElement} dropdown     Dropdown root.
	 * @param {boolean}     restore_focus Whether to focus the trigger.
	 * @return {void}
	 */
	function close_dropdown( dropdown, restore_focus ) {
		var panel = dropdown.querySelector( '[data-wpbc-shared-ui-dropdown-panel]' );
		var trigger = dropdown.querySelector( trigger_selector );

		if ( ! panel || ! trigger ) {
			return;
		}

		panel.hidden = true;
		trigger.setAttribute( 'aria-expanded', 'false' );
		dropdown.classList.remove( 'is-open', 'is-panel-edge-left', 'is-panel-edge-right', 'is-panel-edge-top' );
		panel.style.removeProperty( available_block_size_property );
		synchronize_owning_popover( dropdown, false );
		if ( restore_focus ) {
			trigger.focus();
		}
	}

	/**
	 * Close every open dropdown except an optional retained instance.
	 *
	 * @param {HTMLElement|null} retained_dropdown Dropdown that must remain open.
	 * @return {void}
	 */
	function close_other_dropdowns( retained_dropdown ) {
		Array.prototype.forEach.call( document.querySelectorAll( root_selector + '.is-open' ), function ( dropdown ) {
			if ( dropdown !== retained_dropdown ) {
				close_dropdown( dropdown, false );
			}
		} );
	}

	/**
	 * Open one dropdown and move focus into its selected or first option.
	 *
	 * @param {HTMLElement} dropdown Dropdown root.
	 * @param {boolean}     focus_last Whether to focus the last enabled option.
	 * @return {void}
	 */
	function open_dropdown( dropdown, focus_last ) {
		var panel = dropdown.querySelector( '[data-wpbc-shared-ui-dropdown-panel]' );
		var trigger = dropdown.querySelector( trigger_selector );
		var options = get_enabled_options( dropdown );
		var selected_option = dropdown.querySelector( option_selector + '[aria-selected="true"]:not(:disabled)' );
		var focus_target = focus_last ? options[ options.length - 1 ] : selected_option || options[ 0 ];

		if ( ! panel || ! trigger || trigger.disabled ) {
			return;
		}

		close_other_dropdowns( dropdown );
		panel.hidden = false;
		trigger.setAttribute( 'aria-expanded', 'true' );
		dropdown.classList.add( 'is-open' );
		synchronize_owning_popover( dropdown, true );
		position_panel_within_viewport( dropdown, panel );
		if ( focus_target ) {
			focus_target.focus();
		}
	}

	/**
	 * Keep an open panel inside the browser viewport.
	 *
	 * Logical CSS handles ordinary LTR/RTL placement. These physical fallback
	 * classes are applied only when that placement would clip the menu at an
	 * outer viewport edge.
	 *
	 * @param {HTMLElement} dropdown Dropdown root.
	 * @param {HTMLElement} panel    Visible dropdown panel.
	 * @return {void}
	 */
	function position_panel_within_viewport( dropdown, panel ) {
		var viewport_gap = 8;
		var panel_gap = 4;
		var panel_rectangle;
		var trigger = dropdown.querySelector( trigger_selector );
		var trigger_rectangle;
		var available_above;
		var available_below;
		var available_block_size;
		var opens_above = false;

		dropdown.classList.remove( 'is-panel-edge-left', 'is-panel-edge-right', 'is-panel-edge-top' );
		panel.style.removeProperty( available_block_size_property );
		panel_rectangle = panel.getBoundingClientRect();
		if ( panel_rectangle.right > window.innerWidth - viewport_gap ) {
			dropdown.classList.add( 'is-panel-edge-right' );
			panel_rectangle = panel.getBoundingClientRect();
		}
		if ( panel_rectangle.left < viewport_gap ) {
			dropdown.classList.remove( 'is-panel-edge-right' );
			dropdown.classList.add( 'is-panel-edge-left' );
		}

		if ( ! trigger ) {
			return;
		}
		trigger_rectangle = trigger.getBoundingClientRect();
		available_above = Math.max( 0, trigger_rectangle.top - viewport_gap - panel_gap );
		available_below = Math.max( 0, window.innerHeight - trigger_rectangle.bottom - viewport_gap - panel_gap );
		panel_rectangle = panel.getBoundingClientRect();
		if ( panel_rectangle.bottom > window.innerHeight - viewport_gap && available_above > available_below ) {
			dropdown.classList.add( 'is-panel-edge-top' );
			opens_above = true;
		}
		available_block_size = opens_above ? available_above : available_below;
		panel.style.setProperty( available_block_size_property, Math.floor( available_block_size ) + 'px' );
	}

	/**
	 * Recalculate open menu bounds after the viewport size changes.
	 *
	 * @return {void}
	 */
	function handle_resize() {
		Array.prototype.forEach.call( document.querySelectorAll( root_selector + '.is-open' ), function ( dropdown ) {
			var panel = dropdown.querySelector( '[data-wpbc-shared-ui-dropdown-panel]' );

			if ( panel ) {
				position_panel_within_viewport( dropdown, panel );
			}
		} );
	}

	/**
	 * Commit one option and announce a domain-neutral bubbling event.
	 *
	 * @param {HTMLElement} dropdown Dropdown root.
	 * @param {HTMLElement} option   Selected option control.
	 * @return {void}
	 */
	function select_option( dropdown, option ) {
		var selected_value = option.getAttribute( 'data-value' ) || '';
		var selected_label = option.textContent.trim();
		var previous_value = dropdown.getAttribute( 'data-wpbc-shared-ui-dropdown-value' ) || '';
		var label = dropdown.querySelector( '[data-wpbc-shared-ui-dropdown-label]' );
		var hidden_input = dropdown.querySelector( '[data-wpbc-shared-ui-dropdown-input]' );
		var component_id = dropdown.getAttribute( 'data-wpbc-shared-ui-dropdown' ) || '';

		if ( previous_value === selected_value ) {
			close_dropdown( dropdown, true );
			return;
		}

		Array.prototype.forEach.call( dropdown.querySelectorAll( option_selector ), function ( dropdown_option ) {
			var is_selected = dropdown_option === option;
			dropdown_option.setAttribute( 'aria-selected', is_selected ? 'true' : 'false' );
			dropdown_option.classList.toggle( 'is-selected', is_selected );
		} );
		dropdown.setAttribute( 'data-wpbc-shared-ui-dropdown-value', selected_value );
		if ( label ) {
			label.textContent = selected_label;
		}
		if ( hidden_input ) {
			hidden_input.value = selected_value;
		}
		close_dropdown( dropdown, true );
		dispatch_dropdown_change( dropdown, {
			id: component_id,
			value: selected_value,
			label: selected_label
		} );
	}

	/**
	 * Dispatch the shared change event with a legacy CustomEvent fallback.
	 *
	 * @param {HTMLElement} dropdown    Dropdown root.
	 * @param {Object}      event_detail Scalar selected-value detail.
	 * @return {void}
	 */
	function dispatch_dropdown_change( dropdown, event_detail ) {
		var dropdown_event;

		if ( 'function' === typeof window.CustomEvent ) {
			dropdown_event = new window.CustomEvent( 'wpbc:shared-ui-dropdown-change', {
				bubbles: true,
				detail: event_detail
			} );
		} else {
			dropdown_event = document.createEvent( 'CustomEvent' );
			dropdown_event.initCustomEvent( 'wpbc:shared-ui-dropdown-change', true, false, event_detail );
		}
		dropdown.dispatchEvent( dropdown_event );
	}

	/**
	 * Handle delegated pointer activation.
	 *
	 * @param {MouseEvent} event Document click event.
	 * @return {void}
	 */
	function handle_click( event ) {
		var trigger = event.target.closest( trigger_selector );
		var option = event.target.closest( option_selector );
		var dropdown = event.target.closest( root_selector );

		if ( option && dropdown ) {
			select_option( dropdown, option );
			return;
		}
		if ( trigger && dropdown ) {
			if ( dropdown.classList.contains( 'is-open' ) ) {
				close_dropdown( dropdown, false );
			} else {
				open_dropdown( dropdown, false );
			}
			return;
		}
		close_other_dropdowns( null );
	}

	/**
	 * Handle Escape, arrow, Home, End, Enter, and Space keyboard behavior.
	 *
	 * @param {KeyboardEvent} event Document keydown event.
	 * @return {void}
	 */
	function handle_keydown( event ) {
		var dropdown = event.target.closest( root_selector );
		var trigger = event.target.closest( trigger_selector );
		var option = event.target.closest( option_selector );
		var options;
		var current_index;
		var next_index;

		if ( ! dropdown ) {
			return;
		}
		if ( 'Escape' === event.key ) {
			event.preventDefault();
			close_dropdown( dropdown, true );
			return;
		}
		if ( trigger && ( 'ArrowDown' === event.key || 'ArrowUp' === event.key || 'Home' === event.key || 'End' === event.key ) ) {
			event.preventDefault();
			open_dropdown( dropdown, 'ArrowUp' === event.key || 'End' === event.key );
			return;
		}
		if ( ! option ) {
			return;
		}
		if ( 'Enter' === event.key || ' ' === event.key ) {
			event.preventDefault();
			select_option( dropdown, option );
			return;
		}
		options = get_enabled_options( dropdown );
		current_index = options.indexOf( option );
		if ( 'Home' === event.key || 'End' === event.key || 'ArrowDown' === event.key || 'ArrowUp' === event.key ) {
			event.preventDefault();
			next_index = current_index;
			if ( 'Home' === event.key ) {
				next_index = 0;
			} else if ( 'End' === event.key ) {
				next_index = options.length - 1;
			} else if ( 'ArrowDown' === event.key ) {
				next_index = Math.min( options.length - 1, current_index + 1 );
			} else {
				next_index = Math.max( 0, current_index - 1 );
			}
			if ( options[ next_index ] ) {
				options[ next_index ].focus();
			}
		}
	}

	/**
	 * Close menus after keyboard focus moves outside their component.
	 *
	 * @param {FocusEvent} event Document focus event.
	 * @return {void}
	 */
	function handle_focus_in( event ) {
		close_other_dropdowns( event.target.closest( root_selector ) );
	}

	document.addEventListener( 'click', handle_click );
	document.addEventListener( 'keydown', handle_keydown );
	document.addEventListener( 'focusin', handle_focus_in );
	window.addEventListener( 'resize', handle_resize );
}( window, document ) );
