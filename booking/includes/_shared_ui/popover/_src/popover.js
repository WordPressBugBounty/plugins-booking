/**
 * Domain-neutral shared administration popover interactions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var root_selector = '[data-wpbc-shared-ui-popover]';
	var trigger_selector = '[data-wpbc-shared-ui-popover-trigger]';
	var panel_selector = '[data-wpbc-shared-ui-popover-panel]';
	var close_selector = '[data-wpbc-shared-ui-popover-close]';
	var external_owner_selector = '[data-wpbc-shared-ui-popover-owner]';
	var active_external_popover = null;
	var external_interaction_timer = 0;
	var layer_open_event = 'wpbc:shared-ui-layer-open';
	var layer_close_event = 'wpbc:shared-ui-layer-close';

	/**
	 * Normalize one disclosure interaction identifier.
	 *
	 * @param {*} candidate Candidate identifier.
	 * @return {string} Bounded DOM-safe identifier.
	 */
	function normalize_layer_id( candidate ) {
		return String( candidate || '' ).replace( /[^A-Za-z0-9_-]/g, '' ).slice( 0, 120 );
	}

	/**
	 * Declare one disclosure root and panel as a shared floating layer.
	 *
	 * @param {HTMLElement} popover Shared disclosure root.
	 * @return {Object|null} Four-key descriptor or null for invalid markup.
	 */
	function declare_layer( popover ) {
		var panel = popover && popover.querySelector ? popover.querySelector( panel_selector ) : null;
		var instance_id = normalize_layer_id( popover ? popover.getAttribute( 'data-wpbc-shared-ui-popover' ) : '' );
		var owner_id = normalize_layer_id( popover ? popover.getAttribute( 'data-wpbc-shared-ui-layer-owner' ) : '' ) || instance_id;
		var interaction_group = normalize_layer_id( popover ? popover.getAttribute( 'data-wpbc-shared-ui-layer-interaction-group' ) : '' ) || instance_id;
		var descriptor;

		if ( ! popover || ! panel || ! instance_id ) {
			return null;
		}
		descriptor = {
			layer_type: 'disclosure',
			instance_id: instance_id,
			owner_id: owner_id,
			interaction_group: interaction_group
		};
		[ popover, panel ].forEach( function ( layer_element ) {
			layer_element.setAttribute( 'data-wpbc-shared-ui-layer-type', descriptor.layer_type );
			layer_element.setAttribute( 'data-wpbc-shared-ui-layer-instance', descriptor.instance_id );
			layer_element.setAttribute( 'data-wpbc-shared-ui-layer-owner', descriptor.owner_id );
			layer_element.setAttribute( 'data-wpbc-shared-ui-layer-interaction-group', descriptor.interaction_group );
		} );

		return descriptor;
	}

	/**
	 * Announce a disclosure lifecycle using identifier-only metadata.
	 *
	 * @param {string} event_name Open or close protocol event name.
	 * @param {Object} descriptor Normalized disclosure descriptor.
	 * @return {void}
	 */
	function dispatch_layer_event( event_name, descriptor ) {
		var layer_event;

		if ( ! descriptor || -1 === [ layer_open_event, layer_close_event ].indexOf( event_name ) ) {
			return;
		}
		if ( 'function' === typeof window.CustomEvent ) {
			layer_event = new window.CustomEvent( event_name, { detail: descriptor } );
		} else {
			layer_event = document.createEvent( 'CustomEvent' );
			layer_event.initCustomEvent( event_name, false, false, descriptor );
		}
		document.dispatchEvent( layer_event );
	}

	/**
	 * Find a registered popover by its stable component ID.
	 *
	 * Iteration avoids requiring CSS.escape() in supported legacy browsers.
	 *
	 * @param {string} popover_id Stable popover ID.
	 * @return {HTMLElement|null} Matching popover root or null.
	 */
	function find_popover_by_id( popover_id ) {
		var matching_popover = null;

		Array.prototype.some.call( document.querySelectorAll( root_selector ), function ( popover ) {
			if ( popover.getAttribute( 'data-wpbc-shared-ui-popover' ) === popover_id ) {
				matching_popover = popover;
				return true;
			}
			return false;
		} );
		return matching_popover;
	}

	/**
	 * Resolve a DOM event target to its inline or externally portaled popover.
	 *
	 * @param {Element|null} target Browser event target.
	 * @return {HTMLElement|null} Owning popover root or null.
	 */
	function resolve_event_popover( target ) {
		var inline_popover;
		var external_surface;

		if ( ! target || ! target.closest ) {
			return null;
		}
		inline_popover = target.closest( root_selector );
		if ( inline_popover ) {
			return inline_popover;
		}
		external_surface = target.closest( external_owner_selector );
		if ( ! external_surface ) {
			return null;
		}
		return find_popover_by_id( external_surface.getAttribute( 'data-wpbc-shared-ui-popover-owner' ) || '' );
	}

	/**
	 * Retain external-surface ownership across pointer-induced focus changes.
	 *
	 * Portaled widgets may temporarily move focus to body before their click
	 * handler restores focus. The short-lived owner prevents that intermediate
	 * focus transition from being mistaken for an outside interaction.
	 *
	 * @param {MouseEvent} event Capturing mousedown event.
	 * @return {void}
	 */
	function handle_pointer_down( event ) {
		var external_surface = event.target.closest ? event.target.closest( external_owner_selector ) : null;

		window.clearTimeout( external_interaction_timer );
		active_external_popover = external_surface ? resolve_event_popover( external_surface ) : null;
		external_interaction_timer = window.setTimeout( function () {
			active_external_popover = null;
		}, 500 );
	}

	/**
	 * Close one popover and optionally restore trigger focus.
	 *
	 * @param {HTMLElement} popover      Popover root.
	 * @param {boolean}     restore_focus Whether to focus its trigger.
	 * @return {void}
	 */
	function close_popover( popover, restore_focus ) {
		var trigger = popover.querySelector( trigger_selector );
		var panel = popover.querySelector( panel_selector );
		var was_open = popover.classList.contains( 'is-open' );
		var layer_descriptor;

		if ( ! trigger || ! panel ) {
			return;
		}
		panel.hidden = true;
		panel.style.removeProperty( '--wpbc_shared_ui_popover__available-block-size' );
		trigger.setAttribute( 'aria-expanded', 'false' );
		popover.classList.remove( 'is-open', 'is-panel-edge-left', 'is-panel-edge-right', 'is-panel-edge-top' );
		if ( was_open ) {
			layer_descriptor = declare_layer( popover );
			dispatch_layer_event( layer_close_event, layer_descriptor );
		}
		if ( restore_focus ) {
			trigger.focus();
		}
	}

	/**
	 * Close every open popover except an optional retained instance.
	 *
	 * @param {HTMLElement|null} retained_popover Popover that may remain open.
	 * @return {void}
	 */
	function close_other_popovers( retained_popover ) {
		Array.prototype.forEach.call( document.querySelectorAll( root_selector + '.is-open' ), function ( popover ) {
			if ( popover !== retained_popover ) {
				close_popover( popover, false );
			}
		} );
	}

	/**
	 * Resolve the visible vertical interval shared by the viewport and clipping ancestors.
	 *
	 * Absolutely positioned panels can still be clipped by an ancestor using
	 * hidden, clip, auto, or scroll overflow. Measuring only window.innerHeight
	 * therefore overstates the usable height on bounded administration surfaces.
	 *
	 * @param {HTMLElement} panel        Visible popover panel.
	 * @param {number}      viewport_gap Required gap from every clipping edge.
	 * @return {Object} Numeric start and end viewport coordinates.
	 */
	function get_block_clipping_bounds( panel, viewport_gap ) {
		var block_start = viewport_gap;
		var block_end = Math.max( viewport_gap + 1, window.innerHeight - viewport_gap );
		var ancestor = panel.parentElement;

		while ( ancestor && ancestor !== document.body && ancestor !== document.documentElement ) {
			var ancestor_style = window.getComputedStyle ? window.getComputedStyle( ancestor ) : null;
			var overflow_y = ancestor_style ? String( ancestor_style.overflowY || '' ) : '';
			var ancestor_rectangle;

			if ( -1 !== [ 'auto', 'clip', 'hidden', 'scroll' ].indexOf( overflow_y ) ) {
				ancestor_rectangle = ancestor.getBoundingClientRect();
				if ( 0 < ancestor_rectangle.height ) {
					block_start = Math.max( block_start, ancestor_rectangle.top + viewport_gap );
					block_end = Math.min( block_end, ancestor_rectangle.bottom - viewport_gap );
				}
			}
			ancestor = ancestor.parentElement;
		}

		return {
			start: block_start,
			end: Math.max( block_start + 1, block_end )
		};
	}

	/**
	 * Keep one open panel inside the browser viewport.
	 *
	 * @param {HTMLElement} popover Popover root.
	 * @param {HTMLElement} panel   Visible panel.
	 * @return {void}
	 */
	function position_panel( popover, panel ) {
		var viewport_gap = 8;
		var panel_offset = 6;
		var block_bounds;
		var block_overflow;
		var panel_rectangle;
		var trigger = popover.querySelector( trigger_selector );
		var trigger_rectangle;
		var available_above;
		var available_below;
		var available_block_size;

		popover.classList.remove( 'is-panel-edge-left', 'is-panel-edge-right', 'is-panel-edge-top' );
		panel.style.removeProperty( '--wpbc_shared_ui_popover__available-block-size' );
		panel_rectangle = panel.getBoundingClientRect();
		if ( panel_rectangle.right > window.innerWidth - viewport_gap ) {
			popover.classList.add( 'is-panel-edge-right' );
			panel_rectangle = panel.getBoundingClientRect();
		}
		if ( panel_rectangle.left < viewport_gap ) {
			popover.classList.remove( 'is-panel-edge-right' );
			popover.classList.add( 'is-panel-edge-left' );
		}
		trigger_rectangle = trigger ? trigger.getBoundingClientRect() : popover.getBoundingClientRect();
		block_bounds = get_block_clipping_bounds( panel, viewport_gap );
		available_above = Math.max( 1, trigger_rectangle.top - panel_offset - block_bounds.start );
		available_below = Math.max( 1, block_bounds.end - trigger_rectangle.bottom - panel_offset );
		if ( panel_rectangle.height > available_below && available_above > available_below ) {
			popover.classList.add( 'is-panel-edge-top' );
		}
		available_block_size = popover.classList.contains( 'is-panel-edge-top' ) ? available_above : available_below;
		panel.style.setProperty( '--wpbc_shared_ui_popover__available-block-size', Math.floor( available_block_size ) + 'px' );

		// Reconcile line-box and logical-inset differences against the rendered panel.
		panel_rectangle = panel.getBoundingClientRect();
		block_overflow = popover.classList.contains( 'is-panel-edge-top' )
			? block_bounds.start - panel_rectangle.top
			: panel_rectangle.bottom - block_bounds.end;
		if ( 0 < block_overflow ) {
			available_block_size = Math.max( 1, available_block_size - Math.ceil( block_overflow ) );
			panel.style.setProperty( '--wpbc_shared_ui_popover__available-block-size', Math.floor( available_block_size ) + 'px' );
		}
	}

	/**
	 * Open one popover without forcing focus away from its trigger.
	 *
	 * @param {HTMLElement} popover Popover root.
	 * @return {void}
	 */
	function open_popover( popover ) {
		var trigger = popover.querySelector( trigger_selector );
		var panel = popover.querySelector( panel_selector );
		var layer_descriptor;

		if ( ! trigger || ! panel || trigger.disabled ) {
			return;
		}
		close_other_popovers( popover );
		panel.hidden = false;
		trigger.setAttribute( 'aria-expanded', 'true' );
		popover.classList.add( 'is-open' );
		position_panel( popover, panel );
		layer_descriptor = declare_layer( popover );
		dispatch_layer_event( layer_open_event, layer_descriptor );
	}

	/**
	 * Toggle triggers, close buttons, and outside pointer activation.
	 *
	 * @param {MouseEvent} event Document click event.
	 * @return {void}
	 */
	function handle_click( event ) {
		var trigger = event.target.closest( trigger_selector );
		var close_button = event.target.closest( close_selector );
		var popover = resolve_event_popover( event.target ) || active_external_popover;

		if ( close_button && popover ) {
			close_popover( popover, true );
			return;
		}
		if ( trigger && popover ) {
			if ( popover.classList.contains( 'is-open' ) ) {
				close_popover( popover, false );
			} else {
				open_popover( popover );
			}
			return;
		}
		if ( ! popover ) {
			close_other_popovers( null );
		}
	}

	/**
	 * Close the active popover with Escape and restore trigger focus.
	 *
	 * @param {KeyboardEvent} event Document keydown event.
	 * @return {void}
	 */
	function handle_keydown( event ) {
		var popover = resolve_event_popover( event.target );

		if ( popover && 'Escape' === event.key && popover.classList.contains( 'is-open' ) ) {
			event.preventDefault();
			close_popover( popover, true );
		}
	}

	/**
	 * Close other panels when keyboard focus moves to another component.
	 *
	 * @param {FocusEvent} event Document focus event.
	 * @return {void}
	 */
	function handle_focus_in( event ) {
		close_other_popovers( resolve_event_popover( event.target ) || active_external_popover );
	}

	/**
	 * Reposition open panels after the browser viewport changes.
	 *
	 * @return {void}
	 */
	function handle_resize() {
		Array.prototype.forEach.call( document.querySelectorAll( root_selector + '.is-open' ), function ( popover ) {
			var panel = popover.querySelector( panel_selector );

			if ( panel ) {
				position_panel( popover, panel );
			}
		} );
	}

	document.addEventListener( 'mousedown', handle_pointer_down, true );
	document.addEventListener( 'click', handle_click );
	document.addEventListener( 'keydown', handle_keydown );
	document.addEventListener( 'focusin', handle_focus_in );
	window.addEventListener( 'resize', handle_resize );
	Array.prototype.forEach.call( document.querySelectorAll( root_selector ), declare_layer );
}( window, document ) );
