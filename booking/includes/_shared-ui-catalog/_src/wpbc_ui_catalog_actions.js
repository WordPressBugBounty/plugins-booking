/**
 * Provide accessible row-action menu mechanics for independent WPBC catalogs.
 *
 * Menus expose action intent only. Domain scripts remain responsible for
 * interpreting an action and no mutation is performed by this controller.
 *
 * @since 11.6.0
 */
( function ( window, document ) {
	'use strict';

	var root_selector = '[data-wpbc-ui-catalog-action-menu]';
	var toggle_selector = '[data-wpbc-ui-catalog-action-toggle]';
	var menu_selector = '[data-wpbc-ui-catalog-action-menu-list]';
	var menu_item_selector = '[role="menuitem"]';

	/**
	 * Return enabled menu items from one row-action menu.
	 *
	 * @param {HTMLElement} menu Action menu element.
	 * @return {HTMLElement[]} Enabled menu items.
	 */
	function get_menu_items( menu ) {
		return Array.prototype.filter.call( menu.querySelectorAll( menu_item_selector ), function ( menu_item ) {
			return ! menu_item.hasAttribute( 'disabled' ) && 'true' !== menu_item.getAttribute( 'aria-disabled' );
		} );
	}

	/**
	 * Close one action menu and optionally restore focus to its toggle.
	 *
	 * @param {HTMLElement} root          Action menu wrapper.
	 * @param {boolean}     restore_focus Whether the toggle should regain focus.
	 * @return {void}
	 */
	function close_menu( root, restore_focus ) {
		var menu = root ? root.querySelector( menu_selector ) : null;
		var toggle = root ? root.querySelector( toggle_selector ) : null;

		if ( ! root || ! menu || ! toggle || menu.hidden ) {
			return;
		}
		menu.hidden = true;
		menu.style.removeProperty( 'left' );
		menu.style.removeProperty( 'top' );
		toggle.setAttribute( 'aria-expanded', 'false' );
		root.classList.remove( 'is-open' );
		if ( restore_focus && 'function' === typeof toggle.focus ) {
			toggle.focus();
		}
	}

	/**
	 * Close all open action menus in one mounted catalog.
	 *
	 * @param {Object}          controller    Action controller state.
	 * @param {HTMLElement|null} excluded_root Optional menu to leave open.
	 * @param {boolean}         restore_focus Whether a closed toggle regains focus.
	 * @return {void}
	 */
	function close_all_menus( controller, excluded_root, restore_focus ) {
		controller.mount_element.querySelectorAll( root_selector + '.is-open' ).forEach( function ( root ) {
			if ( root !== excluded_root ) {
				close_menu( root, restore_focus );
			}
		} );
	}

	/**
	 * Position one fixed menu inside the current viewport.
	 *
	 * @param {HTMLElement} toggle Menu toggle.
	 * @param {HTMLElement} menu   Menu element.
	 * @return {void}
	 */
	function position_menu( toggle, menu ) {
		var viewport_margin = 8;
		var toggle_rect = toggle.getBoundingClientRect();
		var menu_rect = menu.getBoundingClientRect();
		var viewport_width = document.documentElement.clientWidth || window.innerWidth || 0;
		var viewport_height = window.innerHeight || document.documentElement.clientHeight || 0;
		var left = Math.min( toggle_rect.right - menu_rect.width, viewport_width - menu_rect.width - viewport_margin );
		var top = toggle_rect.bottom + 6;

		left = Math.max( viewport_margin, left );
		if ( top + menu_rect.height > viewport_height - viewport_margin ) {
			top = Math.max( viewport_margin, toggle_rect.top - menu_rect.height - 6 );
		}
		menu.style.left = Math.round( left ) + 'px';
		menu.style.top = Math.round( top ) + 'px';
	}

	/**
	 * Open one menu and optionally move focus to an edge menu item.
	 *
	 * @param {Object}      controller      Action controller state.
	 * @param {HTMLElement} root            Action menu wrapper.
	 * @param {string}      focus_direction first, last, or an empty string.
	 * @return {void}
	 */
	function open_menu( controller, root, focus_direction ) {
		var menu = root ? root.querySelector( menu_selector ) : null;
		var toggle = root ? root.querySelector( toggle_selector ) : null;
		var menu_items;

		if ( ! root || ! menu || ! toggle ) {
			return;
		}
		close_all_menus( controller, root, false );
		menu.hidden = false;
		toggle.setAttribute( 'aria-expanded', 'true' );
		root.classList.add( 'is-open' );
		position_menu( toggle, menu );

		if ( focus_direction ) {
			menu_items = get_menu_items( menu );
			if ( menu_items.length ) {
				menu_items[ 'last' === focus_direction ? menu_items.length - 1 : 0 ].focus();
			}
		}
	}

	/**
	 * Move focus through one action menu with wrapping.
	 *
	 * @param {HTMLElement} menu         Action menu element.
	 * @param {HTMLElement} current_item Currently focused menu item.
	 * @param {number}      direction    Positive for next or negative for previous.
	 * @return {void}
	 */
	function move_menu_focus( menu, current_item, direction ) {
		var menu_items = get_menu_items( menu );
		var current_index = menu_items.indexOf( current_item );
		var next_index;

		if ( ! menu_items.length ) {
			return;
		}
		next_index = ( current_index + direction + menu_items.length ) % menu_items.length;
		menu_items[ next_index ].focus();
	}

	/**
	 * Capture the focused row action before response markup is replaced.
	 *
	 * @param {Object} controller Action controller state.
	 * @return {void}
	 */
	function capture_action_focus( controller ) {
		var active_element = document.activeElement;
		var root;

		controller.focus_item_id = '';
		if ( ! active_element || ! controller.mount_element.contains( active_element ) ) {
			return;
		}
		root = active_element.closest( root_selector );
		if ( root ) {
			controller.focus_item_id = root.getAttribute( 'data-wpbc-ui-catalog-action-item' ) || '';
		}
	}

	/**
	 * Restore focus to the same row's action toggle after an AJAX rebuild.
	 *
	 * @param {Object} controller Action controller state.
	 * @return {void}
	 */
	function restore_action_focus( controller ) {
		var focus_target = null;
		var focus_item_id = controller.focus_item_id;

		controller.focus_item_id = '';
		if ( ! focus_item_id ) {
			return;
		}
		controller.mount_element.querySelectorAll( root_selector ).forEach( function ( root ) {
			if ( ! focus_target && focus_item_id === root.getAttribute( 'data-wpbc-ui-catalog-action-item' ) ) {
				focus_target = root.querySelector( toggle_selector );
			}
		} );
		if ( ! focus_target ) {
			focus_target = controller.mount_element.querySelector( '[data-wpbc-catalog-heading]' );
		}
		if ( focus_target && 'function' === typeof focus_target.focus ) {
			focus_target.focus();
		}
	}

	/**
	 * Handle delegated pointer activation for action menus.
	 *
	 * @param {Object}     controller Action controller state.
	 * @param {MouseEvent} event      Catalog click event.
	 * @return {void}
	 */
	function handle_click( controller, event ) {
		var menu_item = event.target.closest( menu_item_selector );
		var root;
		var toggle = event.target.closest( toggle_selector );

		if ( toggle ) {
			event.preventDefault();
			root = toggle.closest( root_selector );
			if ( root.classList.contains( 'is-open' ) ) {
				close_menu( root, false );
			} else {
				open_menu( controller, root, 0 === event.detail ? 'first' : '' );
			}
			return;
		}
		if ( menu_item ) {
			root = menu_item.closest( root_selector );
			close_menu( root, false );
			window.setTimeout( function () {
				var toggle_after_action = root.querySelector( toggle_selector );
				if ( root.contains( document.activeElement ) && toggle_after_action && 'function' === typeof toggle_after_action.focus ) {
					toggle_after_action.focus();
				}
			}, 0 );
		}
	}

	/**
	 * Handle action-menu keyboard navigation.
	 *
	 * @param {Object}        controller Action controller state.
	 * @param {KeyboardEvent} event      Catalog keyboard event.
	 * @return {void}
	 */
	function handle_keydown( controller, event ) {
		var menu;
		var menu_item = event.target.closest( menu_item_selector );
		var menu_items;
		var root;
		var toggle = event.target.closest( toggle_selector );

		if ( toggle ) {
			root = toggle.closest( root_selector );
			if ( 'ArrowDown' === event.key || 'ArrowUp' === event.key ) {
				event.preventDefault();
				open_menu( controller, root, 'ArrowUp' === event.key ? 'last' : 'first' );
			} else if ( 'Escape' === event.key ) {
				event.preventDefault();
				close_menu( root, false );
			}
			return;
		}
		if ( ! menu_item ) {
			return;
		}

		root = menu_item.closest( root_selector );
		menu = menu_item.closest( menu_selector );
		if ( 'Escape' === event.key ) {
			event.preventDefault();
			close_menu( root, true );
		} else if ( 'ArrowDown' === event.key || 'ArrowUp' === event.key ) {
			event.preventDefault();
			move_menu_focus( menu, menu_item, 'ArrowDown' === event.key ? 1 : -1 );
		} else if ( 'Home' === event.key || 'End' === event.key ) {
			event.preventDefault();
			menu_items = get_menu_items( menu );
			if ( menu_items.length ) {
				menu_items[ 'End' === event.key ? menu_items.length - 1 : 0 ].focus();
			}
		}
	}

	/**
	 * Initialize accessible action menus for one mounted catalog.
	 *
	 * @param {HTMLElement} mount_element Catalog mount element.
	 * @param {Object}      config        Registered browser configuration.
	 * @return {Object|false} Action controller API or false when unavailable.
	 */
	function initialize_actions( mount_element, config ) {
		var controller;

		if ( ! mount_element || mount_element._wpbc_ui_catalog_actions_controller ) {
			return mount_element ? mount_element._wpbc_ui_catalog_actions_controller : false;
		}
		controller = {
			catalog_id: config && config.id ? String( config.id ) : '',
			focus_item_id: '',
			mount_element: mount_element
		};

		mount_element.addEventListener( 'click', function ( event ) {
			handle_click( controller, event );
		} );
		mount_element.addEventListener( 'keydown', function ( event ) {
			handle_keydown( controller, event );
		} );
		mount_element.addEventListener( 'focusout', function ( event ) {
			var root = event.target.closest( root_selector );
			if ( root ) {
				window.setTimeout( function () {
					if ( ! root.contains( document.activeElement ) ) {
						close_menu( root, false );
					}
				}, 0 );
			}
		} );
		mount_element.addEventListener( 'wpbc:ui-catalog-before-render', function () {
			capture_action_focus( controller );
			close_all_menus( controller, null, false );
		} );
		mount_element.addEventListener( 'wpbc:ui-catalog-rendered', function () {
			restore_action_focus( controller );
		} );
		document.addEventListener( 'click', function ( event ) {
			var clicked_root = event.target.closest( root_selector );
			if ( ! clicked_root || ! controller.mount_element.contains( clicked_root ) ) {
				close_all_menus( controller, null, false );
			}
		} );
		window.addEventListener( 'resize', function () {
			close_all_menus( controller, null, false );
		} );
		window.addEventListener( 'scroll', function () {
			close_all_menus( controller, null, false );
		}, true );

		controller.api = {
			close_all: function ( restore_focus ) {
				close_all_menus( controller, null, !! restore_focus );
			}
		};
		mount_element._wpbc_ui_catalog_actions_controller = controller.api;

		return controller.api;
	}

	window.wpbc_ui_catalog_actions = window.wpbc_ui_catalog_actions || {};
	window.wpbc_ui_catalog_actions.initialize = initialize_actions;
}( window, document ) );
