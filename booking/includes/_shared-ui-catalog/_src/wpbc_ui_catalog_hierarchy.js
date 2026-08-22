/**
 * Manage reusable disclosure mechanics for independent WPBC catalogs.
 *
 * The controller understands only opaque node relationships and rendered DOM
 * attributes. Domain repositories, DTOs, templates, permissions, and business
 * values remain outside this shared presentation module.
 *
 * @since 11.6.0
 */
( function ( window, document ) {
	'use strict';

	var node_selector = '[data-wpbc-ui-catalog-node-id]';
	var toggle_selector = '[data-wpbc-ui-catalog-hierarchy-toggle]';
	var toggle_all_selector = '[data-wpbc-ui-catalog-hierarchy-toggle-all]';

	/**
	 * Create a key map without inherited object properties.
	 *
	 * @return {Object} Empty identifier map.
	 */
	function create_map() {
		return Object.create( null );
	}

	/**
	 * Clear indexes captured from a previous rendered response.
	 *
	 * @param {Object} controller Hierarchy controller state.
	 * @return {void}
	 */
	function reset_structure( controller ) {
		controller.nodes = [];
		controller.nodes_by_id = create_map();
		controller.summaries_by_node = create_map();
		controller.toggles_by_node = create_map();
		controller.expandable_node_ids = [];
	}

	/**
	 * Normalize an opaque DOM node identifier.
	 *
	 * @param {*} node_id Candidate identifier.
	 * @return {string} Trimmed identifier or an empty string.
	 */
	function normalize_node_id( node_id ) {
		return null === node_id || 'undefined' === typeof node_id ? '' : String( node_id ).trim();
	}

	/**
	 * Return the effective catalog-wide disclosure state from a response.
	 *
	 * @param {Object} hierarchy_response Normalized hierarchy response section.
	 * @return {boolean} Whether containers start expanded.
	 */
	function get_initial_expanded( hierarchy_response ) {
		var preference_state = hierarchy_response && hierarchy_response.preference_state
			? hierarchy_response.preference_state
			: {};

		if ( true === preference_state.all_expanded || false === preference_state.all_expanded ) {
			return preference_state.all_expanded;
		}

		return !! ( hierarchy_response && hierarchy_response.expanded_by_default );
	}

	/**
	 * Collect the rendered node, child, summary, and toggle indexes once.
	 *
	 * @param {Object} controller Hierarchy controller state.
	 * @return {void}
	 */
	function collect_structure( controller ) {
		reset_structure( controller );

		controller.mount_element.querySelectorAll( node_selector ).forEach( function ( node_element ) {
			var node_id = normalize_node_id( node_element.getAttribute( 'data-wpbc-ui-catalog-node-id' ) );
			var parent_node_id = normalize_node_id( node_element.getAttribute( 'data-wpbc-ui-catalog-parent-node-id' ) );
			var node_record;

			if ( ! node_id || controller.nodes_by_id[ node_id ] ) {
				return;
			}
			node_record = {
				element: node_element,
				is_container: node_element.hasAttribute( 'data-wpbc-ui-catalog-hierarchy-container' ),
				is_expandable: node_element.hasAttribute( 'data-wpbc-ui-catalog-hierarchy-expandable' ),
				node_id: node_id,
				parent_node_id: parent_node_id
			};
			controller.nodes.push( node_record );
			controller.nodes_by_id[ node_id ] = node_record;
			if ( node_record.is_container && node_record.is_expandable ) {
				controller.expandable_node_ids.push( node_id );
			}
		} );

		controller.mount_element.querySelectorAll( '[data-wpbc-ui-catalog-hierarchy-summary-for]' ).forEach( function ( summary_element ) {
			var node_id = normalize_node_id( summary_element.getAttribute( 'data-wpbc-ui-catalog-hierarchy-summary-for' ) );
			if ( node_id ) {
				controller.summaries_by_node[ node_id ] = controller.summaries_by_node[ node_id ] || [];
				controller.summaries_by_node[ node_id ].push( summary_element );
			}
		} );

		controller.mount_element.querySelectorAll( toggle_selector ).forEach( function ( toggle ) {
			var node_id = normalize_node_id( toggle.getAttribute( 'data-wpbc-ui-catalog-hierarchy-toggle' ) );
			if ( node_id ) {
				controller.toggles_by_node[ node_id ] = controller.toggles_by_node[ node_id ] || [];
				controller.toggles_by_node[ node_id ].push( toggle );
			}
		} );
	}

	/**
	 * Synchronize one disclosure button with its current expanded state.
	 *
	 * @param {HTMLElement} toggle      Disclosure button.
	 * @param {boolean}     is_expanded Current state.
	 * @return {void}
	 */
	function synchronize_toggle( toggle, is_expanded ) {
		var toggle_icon = toggle.querySelector( '[data-wpbc-ui-catalog-hierarchy-toggle-icon]' );
		var toggle_label = is_expanded ? toggle.dataset.collapseLabel || '' : toggle.dataset.expandLabel || '';

		toggle.setAttribute( 'aria-expanded', is_expanded ? 'true' : 'false' );
		toggle.setAttribute( 'aria-label', toggle_label );
		toggle.setAttribute( 'title', toggle_label );
		if ( toggle_icon ) {
			toggle_icon.classList.remove( 'wpbc-bi-chevron-down', 'wpbc-bi-chevron-right' );
			toggle_icon.classList.add( is_expanded ? 'wpbc-bi-chevron-down' : 'wpbc-bi-chevron-right' );
		}
	}

	/**
	 * Return whether a rendered node is visible through all of its ancestors.
	 *
	 * Parents are guaranteed to precede children by the server contract, so the
	 * visibility map is complete when each child is evaluated.
	 *
	 * @param {Object} node_record       Rendered node record.
	 * @param {Object} visible_by_node   Visibility values already calculated.
	 * @param {Object} expanded_by_node  Current container disclosure values.
	 * @return {boolean} Whether the node row should be visible.
	 */
	function is_node_visible( node_record, visible_by_node, expanded_by_node ) {
		if ( ! node_record.parent_node_id ) {
			return true;
		}

		return true === visible_by_node[ node_record.parent_node_id ]
			&& true === expanded_by_node[ node_record.parent_node_id ];
	}

	/**
	 * Apply the current disclosure map to nodes, summaries, and buttons.
	 *
	 * @param {Object} controller Hierarchy controller state.
	 * @return {void}
	 */
	function apply_visibility( controller ) {
		var visible_by_node = create_map();

		controller.nodes.forEach( function ( node_record ) {
			var is_expanded = true === controller.expanded_by_node[ node_record.node_id ];
			var is_visible = is_node_visible( node_record, visible_by_node, controller.expanded_by_node );

			visible_by_node[ node_record.node_id ] = is_visible;
			node_record.element.hidden = ! is_visible;
			if ( node_record.is_container ) {
				node_record.element.classList.toggle( 'is-expanded', is_expanded );
			}
		} );

		Object.keys( controller.summaries_by_node ).forEach( function ( node_id ) {
			var node_is_visible = true === visible_by_node[ node_id ];
			var is_expanded = true === controller.expanded_by_node[ node_id ];

			controller.summaries_by_node[ node_id ].forEach( function ( summary_element ) {
				summary_element.hidden = ! node_is_visible || is_expanded;
			} );
		} );

		Object.keys( controller.toggles_by_node ).forEach( function ( node_id ) {
			controller.toggles_by_node[ node_id ].forEach( function ( toggle ) {
				synchronize_toggle( toggle, true === controller.expanded_by_node[ node_id ] );
			} );
		} );
	}

	/**
	 * Synchronize the expand-all button with all rendered containers.
	 *
	 * @param {Object} controller Hierarchy controller state.
	 * @return {void}
	 */
	function synchronize_toggle_all( controller ) {
		var toggle_all = controller.mount_element.querySelector( toggle_all_selector );
		var all_expanded = 0 < controller.expandable_node_ids.length && controller.expandable_node_ids.every( function ( node_id ) {
			return true === controller.expanded_by_node[ node_id ];
		} );
		var label;
		var icon;

		if ( ! toggle_all ) {
			return;
		}
		toggle_all.hidden = ! controller.enabled || 0 === controller.expandable_node_ids.length;
		label = all_expanded ? controller.i18n.collapse_all || '' : controller.i18n.expand_all || '';
		toggle_all.setAttribute( 'aria-pressed', all_expanded ? 'true' : 'false' );
		toggle_all.setAttribute( 'aria-label', label );
		toggle_all.setAttribute( 'title', label );
		icon = toggle_all.querySelector( '[data-wpbc-ui-catalog-hierarchy-toggle-all-icon]' ) || toggle_all.querySelector( 'span' );
		if ( icon ) {
			icon.classList.remove( 'wpbc-bi-arrows-collapse-vertical', 'wpbc-bi-arrows-expand-vertical' );
			icon.classList.add( all_expanded ? 'wpbc-bi-arrows-collapse-vertical' : 'wpbc-bi-arrows-expand-vertical' );
		}
	}

	/**
	 * Dispatch one domain-neutral hierarchy state event.
	 *
	 * @param {Object} controller  Hierarchy controller state.
	 * @param {string} node_id     Changed node identifier or an empty string.
	 * @param {boolean} is_expanded Current disclosure state.
	 * @param {boolean} is_global   Whether expand-all initiated the change.
	 * @return {void}
	 */
	function dispatch_change( controller, node_id, is_expanded, is_global ) {
		var hierarchy_event;
		var event_detail = {
			all_expanded: is_global ? is_expanded : null,
			catalog_id: controller.catalog_id,
			expanded: is_expanded,
			global: is_global,
			node_id: node_id
		};

		if ( 'function' === typeof window.CustomEvent ) {
			hierarchy_event = new window.CustomEvent( 'wpbc:ui-catalog-hierarchy-change', {
				bubbles: true,
				detail: event_detail
			} );
		} else {
			hierarchy_event = document.createEvent( 'CustomEvent' );
			hierarchy_event.initCustomEvent( 'wpbc:ui-catalog-hierarchy-change', true, false, event_detail );
		}
		controller.mount_element.dispatchEvent( hierarchy_event );
	}

	/**
	 * Persist the global disclosure Boolean through the owning catalog callback.
	 *
	 * @param {Object} controller Hierarchy controller state.
	 * @return {void}
	 */
	function schedule_preference_save( controller ) {
		if ( 'global' !== controller.persistence || 'function' !== typeof controller.save_preferences ) {
			return;
		}

		window.clearTimeout( controller.save_timer );
		controller.save_timer = window.setTimeout( function () {
			controller.save_preferences( {
				all_expanded: controller.global_expanded
			} );
		}, 250 );
	}

	/**
	 * Expand or collapse one rendered container without persisting per-node state.
	 *
	 * @param {Object}  controller  Hierarchy controller state.
	 * @param {string}  node_id     Opaque container node identifier.
	 * @param {boolean} is_expanded Requested disclosure state.
	 * @param {boolean} restore_parent_focus Whether a summary activation should focus its parent toggle.
	 * @return {boolean} Whether a container state changed.
	 */
	function set_node_expanded( controller, node_id, is_expanded, restore_parent_focus ) {
		var node_record = controller.nodes_by_id[ node_id ];
		var parent_toggle;

		if ( ! controller.enabled || ! node_record || ! node_record.is_expandable ) {
			return false;
		}
		controller.expanded_by_node[ node_id ] = !! is_expanded;
		apply_visibility( controller );
		synchronize_toggle_all( controller );
		dispatch_change( controller, node_id, !! is_expanded, false );

		if ( restore_parent_focus ) {
			parent_toggle = get_parent_toggle( controller, node_id );
			if ( parent_toggle && 'function' === typeof parent_toggle.focus ) {
				parent_toggle.focus();
			}
		}

		return true;
	}

	/**
	 * Expand or collapse every rendered container and persist one Boolean.
	 *
	 * @param {Object}  controller  Hierarchy controller state.
	 * @param {boolean} is_expanded Requested global state.
	 * @return {void}
	 */
	function set_all_expanded( controller, is_expanded ) {
		controller.expandable_node_ids.forEach( function ( node_id ) {
			controller.expanded_by_node[ node_id ] = !! is_expanded;
		} );
		controller.global_expanded = !! is_expanded;
		apply_visibility( controller );
		synchronize_toggle_all( controller );
		dispatch_change( controller, '', !! is_expanded, true );
		schedule_preference_save( controller );
	}

	/**
	 * Return the primary container-row toggle for one node.
	 *
	 * @param {Object} controller Hierarchy controller state.
	 * @param {string} node_id    Opaque node identifier.
	 * @return {HTMLElement|null} Parent toggle or null.
	 */
	function get_parent_toggle( controller, node_id ) {
		var toggles = controller.toggles_by_node[ node_id ] || [];
		var parent_toggle = null;

		toggles.some( function ( toggle ) {
			if ( toggle.hasAttribute( 'data-wpbc-ui-catalog-hierarchy-parent-toggle' ) ) {
				parent_toggle = toggle;
				return true;
			}
			return false;
		} );

		return parent_toggle;
	}

	/**
	 * Capture hierarchy focus before AJAX replaces the current rows.
	 *
	 * @param {Object} controller Hierarchy controller state.
	 * @return {void}
	 */
	function capture_focus( controller ) {
		var active_element = document.activeElement;
		var toggle;

		controller.focus_token = null;
		if ( ! active_element || ! controller.mount_element.contains( active_element ) ) {
			return;
		}
		if ( active_element.closest( toggle_all_selector ) ) {
			controller.focus_token = { type: 'all' };
			return;
		}
		toggle = active_element.closest( toggle_selector );
		if ( toggle ) {
			controller.focus_token = {
				node_id: normalize_node_id( toggle.getAttribute( 'data-wpbc-ui-catalog-hierarchy-toggle' ) ),
				type: 'node'
			};
		}
	}

	/**
	 * Restore hierarchy focus after current rows have been mounted.
	 *
	 * @param {Object} controller Hierarchy controller state.
	 * @return {void}
	 */
	function restore_focus( controller ) {
		var focus_target = null;
		var focus_token = controller.focus_token;

		controller.focus_token = null;
		if ( ! focus_token ) {
			return;
		}
		if ( 'all' === focus_token.type ) {
			focus_target = controller.mount_element.querySelector( toggle_all_selector );
		} else if ( 'node' === focus_token.type ) {
			focus_target = get_parent_toggle( controller, focus_token.node_id );
		}
		if ( focus_target && ! focus_target.hidden && 'function' === typeof focus_target.focus ) {
			focus_target.focus();
		}
	}

	/**
	 * Handle delegated hierarchy clicks.
	 *
	 * @param {Object}     controller Hierarchy controller state.
	 * @param {MouseEvent} event      Catalog click event.
	 * @return {void}
	 */
	function handle_click( controller, event ) {
		var toggle_all = event.target.closest( toggle_all_selector );
		var toggle = event.target.closest( toggle_selector );
		var node_id;

		if ( toggle_all && controller.mount_element.contains( toggle_all ) ) {
			event.preventDefault();
			set_all_expanded( controller, 'true' !== toggle_all.getAttribute( 'aria-pressed' ) );
			return;
		}
		if ( ! toggle || ! controller.mount_element.contains( toggle ) ) {
			return;
		}

		event.preventDefault();
		node_id = normalize_node_id( toggle.getAttribute( 'data-wpbc-ui-catalog-hierarchy-toggle' ) );
		set_node_expanded(
			controller,
			node_id,
			'true' !== toggle.getAttribute( 'aria-expanded' ),
			toggle.hasAttribute( 'data-wpbc-ui-catalog-hierarchy-summary-toggle' )
		);
	}

	/**
	 * Support conventional Left/Right disclosure keyboard behavior.
	 *
	 * @param {Object}        controller Hierarchy controller state.
	 * @param {KeyboardEvent} event      Catalog keyboard event.
	 * @return {void}
	 */
	function handle_keydown( controller, event ) {
		var toggle = event.target.closest( toggle_selector );
		var node_id;

		if ( ! toggle || ! controller.mount_element.contains( toggle ) || ( 'ArrowLeft' !== event.key && 'ArrowRight' !== event.key ) ) {
			return;
		}
		event.preventDefault();
		node_id = normalize_node_id( toggle.getAttribute( 'data-wpbc-ui-catalog-hierarchy-toggle' ) );
		set_node_expanded( controller, node_id, 'ArrowRight' === event.key, false );
	}

	/**
	 * Refresh one hierarchy controller from newly rendered response rows.
	 *
	 * @param {Object} controller         Hierarchy controller state.
	 * @param {Object} hierarchy_response Normalized response hierarchy section.
	 * @return {boolean} Whether hierarchy behavior is active.
	 */
	function refresh_controller( controller, hierarchy_response ) {
		controller.enabled = !! ( hierarchy_response && hierarchy_response.enabled );
		controller.expanded_by_node = create_map();
		controller.global_expanded = get_initial_expanded( hierarchy_response || {} );
		if ( ! controller.enabled ) {
			reset_structure( controller );
			synchronize_toggle_all( controller );
			controller.focus_token = null;
			return false;
		}
		collect_structure( controller );
		controller.nodes.forEach( function ( node_record ) {
			if ( node_record.is_container && ! node_record.is_expandable ) {
				controller.expanded_by_node[ node_record.node_id ] = true;
			}
		} );
		controller.expandable_node_ids.forEach( function ( node_id ) {
			controller.expanded_by_node[ node_id ] = controller.global_expanded;
		} );
		apply_visibility( controller );
		synchronize_toggle_all( controller );
		restore_focus( controller );

		return controller.enabled;
	}

	/**
	 * Initialize hierarchy mechanics for one mounted catalog.
	 *
	 * @param {HTMLElement} mount_element    Catalog mount element.
	 * @param {Object}      config           Registered browser configuration.
	 * @param {Function}    save_preferences Callback accepting normalized global state.
	 * @return {Object|false} Hierarchy controller API or false when unavailable.
	 */
	function initialize_hierarchy( mount_element, config, save_preferences ) {
		var hierarchy_configuration;
		var controller;

		if ( ! mount_element || mount_element._wpbc_ui_catalog_hierarchy_controller ) {
			return mount_element ? mount_element._wpbc_ui_catalog_hierarchy_controller : false;
		}
		hierarchy_configuration = config && config.hierarchy ? config.hierarchy : {};
		controller = {
			catalog_id: config && config.id ? String( config.id ) : '',
			expandable_node_ids: [],
			enabled: false,
			expanded_by_node: create_map(),
			focus_token: null,
			global_expanded: false,
			i18n: config && config.i18n ? config.i18n : {},
			mount_element: mount_element,
			nodes: [],
			nodes_by_id: create_map(),
			persistence: hierarchy_configuration.persistence || 'none',
			save_preferences: save_preferences,
			save_timer: 0,
			summaries_by_node: create_map(),
			toggles_by_node: create_map()
		};

		mount_element.addEventListener( 'click', function ( event ) {
			handle_click( controller, event );
		} );
		mount_element.addEventListener( 'keydown', function ( event ) {
			handle_keydown( controller, event );
		} );
		mount_element.addEventListener( 'wpbc:ui-catalog-before-render', function () {
			capture_focus( controller );
		} );

		controller.api = {
			get_all_expanded: function () {
				return controller.global_expanded;
			},
			refresh: function ( hierarchy_response ) {
				return refresh_controller( controller, hierarchy_response || {} );
			},
			set_all_expanded: function ( is_expanded ) {
				set_all_expanded( controller, !! is_expanded );
			},
			set_node_expanded: function ( node_id, is_expanded ) {
				return set_node_expanded( controller, normalize_node_id( node_id ), !! is_expanded, false );
			}
		};
		mount_element._wpbc_ui_catalog_hierarchy_controller = controller.api;

		return controller.api;
	}

	window.wpbc_ui_catalog_hierarchy = window.wpbc_ui_catalog_hierarchy || {};
	window.wpbc_ui_catalog_hierarchy.get_initial_expanded = get_initial_expanded;
	window.wpbc_ui_catalog_hierarchy.initialize = initialize_hierarchy;
}( window, document ) );
