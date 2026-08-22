/**
 * Manage reusable selection behavior for independent WPBC catalogs.
 *
 * Selection is presentation state only. This controller never sends requests
 * or performs mutations; domain code may observe the emitted selection events.
 *
 * @since 11.6.0
 */
( function ( window, document ) {
	'use strict';

	var sticky_controllers = [];
	var sticky_frame = 0;
	var viewport_events_bound = false;

	/**
	 * Return a stable string identifier from one checkbox value.
	 *
	 * @param {*} control_value Candidate checkbox value.
	 * @return {string} Non-empty identifier or an empty string.
	 */
	function normalize_item_id( control_value ) {
		return null === control_value || 'undefined' === typeof control_value
			? ''
			: String( control_value ).trim();
	}

	/**
	 * Create an identifier map without inherited object-property collisions.
	 *
	 * @return {Object} Empty selected-identifier map.
	 */
	function create_selected_ids() {
		return Object.create( null );
	}

	/**
	 * Return all currently rendered item-selection controls.
	 *
	 * @param {Object} controller Selection controller state.
	 * @return {HTMLElement[]} Visible item checkbox controls.
	 */
	function get_item_controls( controller ) {
		return Array.prototype.slice.call(
			controller.mount_element.querySelectorAll( '[data-wpbc-ui-catalog-select-item]' )
		);
	}

	/**
	 * Return the currently selected identifiers.
	 *
	 * @param {Object} controller Selection controller state.
	 * @return {string[]} Selected catalog item identifiers.
	 */
	function get_selected_ids( controller ) {
		return Object.keys( controller.selected_ids );
	}

	/**
	 * Remove browser text selection created by an intentional Shift-click range.
	 *
	 * Normal text remains selectable because this runs only for a Shift-click on
	 * an opted-in catalog item checkbox.
	 *
	 * @return {void}
	 */
	function clear_range_selection_text() {
		var text_selection;

		if ( 'function' !== typeof window.getSelection ) {
			return;
		}
		text_selection = window.getSelection();
		if ( text_selection && 'function' === typeof text_selection.removeAllRanges ) {
			text_selection.removeAllRanges();
		}
	}

	/**
	 * Return the fixed administration header offset above a selection summary.
	 *
	 * @param {HTMLElement} summary Selection summary element.
	 * @return {number} Viewport offset in pixels.
	 */
	function get_sticky_top( summary ) {
		var admin_root = summary.closest( '.wpbc_admin' ) || document.documentElement;
		var booking_bar = admin_root.querySelector( '.wpbc_ui_el__top_nav' );
		var wordpress_bar = document.getElementById( 'wpadminbar' );
		var sticky_top = 0;

		[ wordpress_bar, booking_bar ].forEach( function ( navigation_bar ) {
			if ( navigation_bar && 'fixed' === window.getComputedStyle( navigation_bar ).position ) {
				sticky_top = Math.max( sticky_top, navigation_bar.getBoundingClientRect().bottom );
			}
		} );

		return sticky_top + 8;
	}

	/**
	 * Restore one summary to normal document flow.
	 *
	 * @param {Object} controller Selection controller state.
	 * @return {void}
	 */
	function reset_sticky_summary( controller ) {
		controller.summary.classList.remove( 'is-viewport-sticky' );
		controller.summary.style.removeProperty( 'left' );
		controller.summary.style.removeProperty( 'top' );
		controller.summary.style.removeProperty( 'width' );
		if ( ! controller.placeholder ) {
			return;
		}
		controller.placeholder.hidden = true;
		controller.placeholder.style.removeProperty( 'height' );
		controller.placeholder.style.removeProperty( 'margin-bottom' );
		controller.placeholder.style.removeProperty( 'margin-top' );
	}

	/**
	 * Move focus to a stable selection control after the clear button disappears.
	 *
	 * @param {Object} controller Selection controller state.
	 * @return {void}
	 */
	function focus_selection_fallback( controller ) {
		var focus_target = controller.mount_element.querySelector( '[data-wpbc-ui-catalog-select-all]' )
			|| controller.mount_element.querySelector( '[data-wpbc-ui-catalog-select-item]' )
			|| controller.mount_element.querySelector( '[data-wpbc-catalog-heading]' );

		if ( focus_target && 'function' === typeof focus_target.focus ) {
			focus_target.focus();
		}
	}

	/**
	 * Keep one visible summary inside its catalog's viewport bounds.
	 *
	 * @param {Object} controller Selection controller state.
	 * @return {void}
	 */
	function update_sticky_summary( controller ) {
		var is_sticky = controller.summary.classList.contains( 'is-viewport-sticky' );
		var listing_rect;
		var source_rect;
		var sticky_top;
		var summary_rect;
		var summary_style;

		if (
			controller.summary.hidden
			|| 'none' === window.getComputedStyle( controller.summary ).display
			|| ! document.documentElement.contains( controller.listing_element )
		) {
			reset_sticky_summary( controller );
			return;
		}

		sticky_top = get_sticky_top( controller.summary );
		source_rect = ( is_sticky ? controller.placeholder : controller.summary ).getBoundingClientRect();
		listing_rect = controller.listing_element.getBoundingClientRect();
		if ( source_rect.top > sticky_top || listing_rect.bottom <= sticky_top + controller.summary.offsetHeight ) {
			reset_sticky_summary( controller );
			return;
		}

		if ( ! is_sticky ) {
			summary_rect = controller.summary.getBoundingClientRect();
			summary_style = window.getComputedStyle( controller.summary );
			controller.placeholder.style.height = summary_rect.height + 'px';
			controller.placeholder.style.marginTop = summary_style.marginTop;
			controller.placeholder.style.marginBottom = summary_style.marginBottom;
			controller.placeholder.hidden = false;
			controller.summary.classList.add( 'is-viewport-sticky' );
		}

		source_rect = controller.placeholder.getBoundingClientRect();
		controller.summary.style.left = source_rect.left + 'px';
		controller.summary.style.top = sticky_top + 'px';
		controller.summary.style.width = source_rect.width + 'px';
	}

	/**
	 * Schedule all sticky summaries for the next animation frame.
	 *
	 * @return {void}
	 */
	function schedule_sticky_summaries() {
		if ( sticky_frame ) {
			return;
		}

		sticky_frame = window.requestAnimationFrame( function () {
			sticky_frame = 0;
			sticky_controllers.forEach( update_sticky_summary );
		} );
	}

	/**
	 * Register an additional catalog control for bounded viewport-sticky behavior.
	 *
	 * Domain catalogs can render editing or status bars after the shared catalog
	 * controller mounts. Registering the rendered element here gives those bars
	 * the same measured WordPress-header offset and catalog boundary as the
	 * selection summary without introducing domain knowledge into shared code.
	 *
	 * @param {Object}      controller     Selection controller state.
	 * @param {HTMLElement} sticky_element Opt-in catalog control element.
	 * @return {boolean} True when a new sticky controller was registered.
	 */
	function register_viewport_sticky( controller, sticky_element ) {
		var placeholder;
		var sticky_controller;

		if (
			! sticky_element
			|| ! controller.listing_element
			|| '1' === sticky_element.getAttribute( 'data-wpbc-ui-catalog-viewport-sticky-initialized' )
		) {
			return false;
		}

		placeholder = document.createElement( 'div' );
		placeholder.className = 'wpbc_ui_listing__viewport_sticky_placeholder';
		placeholder.setAttribute( 'aria-hidden', 'true' );
		placeholder.hidden = true;
		sticky_element.parentNode.insertBefore( placeholder, sticky_element );
		sticky_element.setAttribute( 'data-wpbc-ui-catalog-viewport-sticky-initialized', '1' );
		sticky_controller = {
			listing_element: controller.listing_element,
			placeholder: placeholder,
			summary: sticky_element
		};
		sticky_controllers.push( sticky_controller );

		if ( 'function' === typeof window.ResizeObserver ) {
			sticky_controller.resize_observer = new window.ResizeObserver( schedule_sticky_summaries );
			sticky_controller.resize_observer.observe( controller.listing_element );
			sticky_controller.resize_observer.observe( sticky_element );
		}
		if ( ! viewport_events_bound ) {
			viewport_events_bound = true;
			window.addEventListener( 'scroll', schedule_sticky_summaries, true );
			window.addEventListener( 'resize', schedule_sticky_summaries );
		}
		schedule_sticky_summaries();

		return true;
	}

	/**
	 * Emit a domain-neutral selection lifecycle event.
	 *
	 * @param {Object} controller Selection controller state.
	 * @param {string} event_name Catalog selection event name.
	 * @return {void}
	 */
	function dispatch_selection_event( controller, event_name ) {
		var item_controls = get_item_controls( controller );
		var visible_selected_ids = item_controls.filter( function ( control ) {
			return control.checked;
		} ).map( function ( control ) {
			return normalize_item_id( control.value );
		} );
		var event_detail = {
			catalog_id: controller.catalog_id,
			selected_ids: get_selected_ids( controller ),
			visible_selected_ids: visible_selected_ids
		};
		var selection_event;

		if ( 'function' === typeof window.CustomEvent ) {
			selection_event = new window.CustomEvent( event_name, { bubbles: true, detail: event_detail } );
		} else {
			selection_event = document.createEvent( 'CustomEvent' );
			selection_event.initCustomEvent( event_name, true, false, event_detail );
		}
		controller.mount_element.dispatchEvent( selection_event );
	}

	/**
	 * Synchronize checkboxes, row styling, select-all state, and summary status.
	 *
	 * @param {Object}  controller     Selection controller state.
	 * @param {boolean} dispatch_change Whether to emit a selection-change event.
	 * @return {void}
	 */
	function synchronize_selection( controller, dispatch_change ) {
		var item_controls = get_item_controls( controller );
		var select_all = controller.mount_element.querySelector( '[data-wpbc-ui-catalog-select-all]' );
		var selected_count = get_selected_ids( controller ).length;

		item_controls.forEach( function ( control ) {
			var item_id = normalize_item_id( control.value );
			var is_selected = '' !== item_id && !! controller.selected_ids[ item_id ];
			var row = control.closest( '[data-wpbc-ui-catalog-selectable-row]' )
				|| control.closest( '[data-wpbc-booking-resource-id]' );

			control.checked = is_selected;
			if ( row ) {
				row.classList.toggle( 'is-selected', is_selected );
				if ( row.hasAttribute( 'data-wpbc-ui-catalog-selection-checkbox-only' ) ) {
					row.removeAttribute( 'aria-selected' );
				} else {
					row.setAttribute( 'aria-selected', is_selected ? 'true' : 'false' );
				}
			}
		} );

		if ( select_all ) {
			select_all.checked = 0 < item_controls.length && item_controls.every( function ( control ) {
				return control.checked;
			} );
			select_all.indeterminate = ! select_all.checked && item_controls.some( function ( control ) {
				return control.checked;
			} );
		}

		if ( controller.summary ) {
			controller.summary.hidden = 0 === selected_count;
		}
		if ( controller.summary_count ) {
			controller.summary_count.textContent = String( selected_count );
		}

		schedule_sticky_summaries();
		if ( dispatch_change ) {
			dispatch_selection_event( controller, 'wpbc:ui-catalog-selection-change' );
		}
	}

	/**
	 * Remember the focused selection control before response markup is replaced.
	 *
	 * @param {Object} controller Selection controller state.
	 * @return {void}
	 */
	function capture_selection_focus( controller ) {
		var active_element = document.activeElement;
		var item_control;

		controller.focus_token = null;
		if ( ! active_element || ! controller.mount_element.contains( active_element ) ) {
			return;
		}

		item_control = active_element.closest( '[data-wpbc-ui-catalog-select-item]' );
		if ( item_control ) {
			controller.focus_token = { type: 'item', item_id: normalize_item_id( item_control.value ) };
		} else if ( active_element.closest( '[data-wpbc-ui-catalog-select-all]' ) ) {
			controller.focus_token = { type: 'select_all' };
		} else if ( active_element.closest( '[data-wpbc-ui-catalog-selection-clear]' ) ) {
			controller.focus_token = { type: 'clear' };
		}
	}

	/**
	 * Restore focus after selected rows are rebuilt by an AJAX response.
	 *
	 * @param {Object} controller Selection controller state.
	 * @return {void}
	 */
	function restore_selection_focus( controller ) {
		var focus_target = null;
		var focus_token = controller.focus_token;

		controller.focus_token = null;
		if ( ! focus_token ) {
			return;
		}

		if ( 'item' === focus_token.type ) {
			get_item_controls( controller ).some( function ( control ) {
				if ( focus_token.item_id === normalize_item_id( control.value ) ) {
					focus_target = control;
					return true;
				}
				return false;
			} );
		} else if ( 'select_all' === focus_token.type ) {
			focus_target = controller.mount_element.querySelector( '[data-wpbc-ui-catalog-select-all]' );
		} else if ( 'clear' === focus_token.type && ! controller.summary.hidden ) {
			focus_target = controller.mount_element.querySelector( '[data-wpbc-ui-catalog-selection-clear]' );
		}

		if ( ! focus_target ) {
			focus_target = controller.mount_element.querySelector( '[data-wpbc-catalog-heading]' );
		}
		if ( focus_target && 'function' === typeof focus_target.focus ) {
			focus_target.focus();
		}
	}

	/**
	 * Apply a checked or unchecked state to a visible inclusive range.
	 *
	 * @param {Object}      controller     Selection controller state.
	 * @param {HTMLElement} target_control Range endpoint checkbox.
	 * @return {boolean} True when a visible range was applied.
	 */
	function apply_selection_range( controller, target_control ) {
		var item_controls = get_item_controls( controller );
		var anchor_index = -1;
		var target_index = item_controls.indexOf( target_control );

		item_controls.some( function ( control, control_index ) {
			if ( controller.range_anchor_id === normalize_item_id( control.value ) ) {
				anchor_index = control_index;
				return true;
			}
			return false;
		} );
		if ( 0 > anchor_index || 0 > target_index ) {
			return false;
		}

		item_controls.slice( Math.min( anchor_index, target_index ), Math.max( anchor_index, target_index ) + 1 ).forEach( function ( control ) {
			var item_id = normalize_item_id( control.value );
			if ( '' === item_id ) {
				return;
			}
			if ( target_control.checked ) {
				controller.selected_ids[ item_id ] = true;
			} else {
				delete controller.selected_ids[ item_id ];
			}
		} );

		return true;
	}

	/**
	 * Handle delegated selection clicks and capture Shift range intent.
	 *
	 * @param {Object}     controller Selection controller state.
	 * @param {MouseEvent} event      Catalog click event.
	 * @return {void}
	 */
	function handle_click( controller, event ) {
		var clear_control = event.target.closest( '[data-wpbc-ui-catalog-selection-clear]' );
		var item_control = event.target.closest( '[data-wpbc-ui-catalog-select-item]' );

		if ( clear_control ) {
			event.preventDefault();
			controller.selected_ids = create_selected_ids();
			controller.range_anchor_id = '';
			synchronize_selection( controller, true );
			focus_selection_fallback( controller );
			return;
		}

		controller.shift_control = null;
		if ( item_control && controller.range_selection_enabled && event.shiftKey ) {
			controller.shift_control = item_control;
			clear_range_selection_text();
			window.setTimeout( clear_range_selection_text, 0 );
		}
	}

	/**
	 * Handle item and select-all checkbox state changes.
	 *
	 * @param {Object} controller Selection controller state.
	 * @param {Event}  event      Catalog change event.
	 * @return {void}
	 */
	function handle_change( controller, event ) {
		var item_controls;
		var item_id;

		if ( event.target.matches( '[data-wpbc-ui-catalog-select-all]' ) ) {
			item_controls = get_item_controls( controller );
			item_controls.forEach( function ( control ) {
				var visible_item_id = normalize_item_id( control.value );
				if ( '' === visible_item_id ) {
					return;
				}
				if ( event.target.checked ) {
					controller.selected_ids[ visible_item_id ] = true;
				} else {
					delete controller.selected_ids[ visible_item_id ];
				}
			} );
			controller.range_anchor_id = '';
		} else if ( event.target.matches( '[data-wpbc-ui-catalog-select-item]' ) ) {
			item_id = normalize_item_id( event.target.value );
			if ( '' === item_id ) {
				return;
			}
			if ( controller.shift_control !== event.target || ! controller.range_anchor_id || ! apply_selection_range( controller, event.target ) ) {
				if ( event.target.checked ) {
					controller.selected_ids[ item_id ] = true;
				} else {
					delete controller.selected_ids[ item_id ];
				}
			}
			controller.range_anchor_id = item_id;
			controller.shift_control = null;
		} else {
			return;
		}

		synchronize_selection( controller, true );
	}

	/**
	 * Initialize selection state for one mounted catalog.
	 *
	 * @param {HTMLElement} mount_element Catalog mount element.
	 * @param {Object}      config        Registered browser configuration.
	 * @return {Object|false} Selection controller API or false when unavailable.
	 */
	function initialize_selection( mount_element, config ) {
		var controller;
		var placeholder;

		if ( ! mount_element || mount_element._wpbc_ui_catalog_selection_controller ) {
			return mount_element ? mount_element._wpbc_ui_catalog_selection_controller : false;
		}

		controller = {
			catalog_id: config && config.id ? String( config.id ) : '',
			focus_token: null,
			listing_element: mount_element.querySelector( '[data-wpbc-ui-catalog-listing]' ),
			mount_element: mount_element,
			placeholder: null,
			range_anchor_id: '',
			range_selection_enabled: !! ( config && config.features && config.features.range_selection ),
			selected_ids: create_selected_ids(),
			shift_control: null,
			summary: mount_element.querySelector( '[data-wpbc-ui-catalog-selection-summary]' ),
			summary_count: mount_element.querySelector( '[data-wpbc-ui-catalog-selection-count]' )
		};
		if ( ! controller.listing_element || ! controller.summary ) {
			return false;
		}

		if ( '1' === controller.summary.getAttribute( 'data-wpbc-ui-catalog-selection-summary-sticky' ) ) {
			placeholder = document.createElement( 'div' );
			placeholder.className = 'wpbc_ui_listing__selection_summary_placeholder';
			placeholder.setAttribute( 'aria-hidden', 'true' );
			placeholder.hidden = true;
			controller.summary.parentNode.insertBefore( placeholder, controller.summary );
			controller.placeholder = placeholder;
			sticky_controllers.push( controller );
		}

		mount_element.addEventListener( 'click', function ( event ) {
			handle_click( controller, event );
		} );
		mount_element.addEventListener( 'change', function ( event ) {
			handle_change( controller, event );
		} );
		mount_element.addEventListener( 'wpbc:ui-catalog-before-render', function () {
			capture_selection_focus( controller );
		} );
		mount_element.addEventListener( 'wpbc:ui-catalog-rendered', function () {
			synchronize_selection( controller, false );
			dispatch_selection_event( controller, 'wpbc:ui-catalog-selection-restored' );
			restore_selection_focus( controller );
		} );

		if ( controller.placeholder && 'function' === typeof window.ResizeObserver ) {
			controller.resize_observer = new window.ResizeObserver( schedule_sticky_summaries );
			controller.resize_observer.observe( controller.listing_element );
		}
		if ( controller.placeholder && ! viewport_events_bound ) {
			viewport_events_bound = true;
			window.addEventListener( 'scroll', schedule_sticky_summaries, true );
			window.addEventListener( 'resize', schedule_sticky_summaries );
		}

		controller.api = {
			clear: function () {
				controller.selected_ids = create_selected_ids();
				controller.range_anchor_id = '';
				synchronize_selection( controller, true );
			},
			get_selected_ids: function () {
				return get_selected_ids( controller );
			},
			register_viewport_sticky: function ( sticky_element ) {
				return register_viewport_sticky( controller, sticky_element );
			},
			refresh_viewport_sticky: function () {
				schedule_sticky_summaries();
			},
			synchronize: function () {
				synchronize_selection( controller, false );
			}
		};
		mount_element._wpbc_ui_catalog_selection_controller = controller.api;
		synchronize_selection( controller, false );

		return controller.api;
	}

	window.wpbc_ui_catalog_selection = window.wpbc_ui_catalog_selection || {};
	window.wpbc_ui_catalog_selection.initialize = initialize_selection;
}( window, document ) );
