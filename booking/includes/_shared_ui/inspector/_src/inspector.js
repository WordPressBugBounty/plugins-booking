/**
 * Domain-neutral administration inspector lifecycle and focus mechanics.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var focusable_selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
	var layer_open_event = 'wpbc:shared-ui-layer-open';
	var layer_close_event = 'wpbc:shared-ui-layer-close';

	/**
	 * Normalize an Inspector interaction identifier.
	 *
	 * @param {*} candidate Candidate identifier.
	 * @return {string} Bounded DOM-safe identifier.
	 */
	function normalize_layer_id( candidate ) {
		return String( candidate || '' ).replace( /[^A-Za-z0-9_-]/g, '' ).slice( 0, 120 );
	}

	/**
	 * Declare the Inspector's domain-neutral floating-layer ownership metadata.
	 *
	 * @param {HTMLElement} root     Shared Inspector root.
	 * @param {Object}      settings Controller options.
	 * @return {Object|null} Four-key descriptor or null when the ID is invalid.
	 */
	function declare_layer( root, settings ) {
		var panel = root && root.querySelector ? root.querySelector( '.wpbc_shared_ui_inspector__panel' ) : null;
		var instance_id = normalize_layer_id( root ? root.getAttribute( 'data-wpbc-shared-ui-inspector' ) : '' );
		var owner_id = normalize_layer_id( settings.owner_id ) || instance_id;
		var interaction_group = normalize_layer_id( settings.interaction_group ) || instance_id;
		var descriptor;

		if ( ! instance_id ) {
			return null;
		}
		descriptor = {
			layer_type: 'inspector',
			instance_id: instance_id,
			owner_id: owner_id,
			interaction_group: interaction_group
		};
		[ root, panel ].forEach( function ( layer_element ) {
			if ( ! layer_element ) {
				return;
			}
			layer_element.setAttribute( 'data-wpbc-shared-ui-layer-type', descriptor.layer_type );
			layer_element.setAttribute( 'data-wpbc-shared-ui-layer-instance', descriptor.instance_id );
			layer_element.setAttribute( 'data-wpbc-shared-ui-layer-owner', descriptor.owner_id );
			layer_element.setAttribute( 'data-wpbc-shared-ui-layer-interaction-group', descriptor.interaction_group );
		} );

		return descriptor;
	}

	/**
	 * Announce an Inspector layer lifecycle using identifier-only metadata.
	 *
	 * @param {string} event_name Open or close protocol event name.
	 * @param {Object} descriptor Normalized Inspector descriptor.
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
	 * Create one inspector controller for an already rendered shell.
	 *
	 * The caller owns all domain data and renders domain templates into the
	 * content host. The controller never sends a request or mutates domain data.
	 *
	 * @param {HTMLElement} root     Rendered shared inspector root.
	 * @param {Object}      options  Optional lifecycle callbacks.
	 * @return {Object|null} Inspector API or null for invalid markup.
	 */
	function create( root, options ) {
		var settings = options && 'object' === typeof options ? options : {};
		var panel = root && root.querySelector ? root.querySelector( '.wpbc_shared_ui_inspector__panel' ) : null;
		var heading = root && root.querySelector ? root.querySelector( '.wpbc_shared_ui_inspector__heading' ) : null;
		var header_content = root && root.querySelector ? root.querySelector( '[data-wpbc-shared-ui-inspector-header-content]' ) : null;
		var status = root && root.querySelector ? root.querySelector( '[data-wpbc-shared-ui-inspector-status]' ) : null;
		var loading = root && root.querySelector ? root.querySelector( '[data-wpbc-shared-ui-inspector-loading]' ) : null;
		var loading_label = root && root.querySelector ? root.querySelector( '[data-wpbc-shared-ui-inspector-loading-label]' ) : null;
		var error = root && root.querySelector ? root.querySelector( '[data-wpbc-shared-ui-inspector-error]' ) : null;
		var content = root && root.querySelector ? root.querySelector( '[data-wpbc-shared-ui-inspector-content]' ) : null;
		var return_focus = null;
		var layer_descriptor;

		if ( ! root || ! panel || ! heading || ! header_content || ! status || ! loading || ! error || ! content ) {
			return null;
		}
		layer_descriptor = declare_layer( root, settings );
		if ( ! layer_descriptor ) {
			return null;
		}

		var default_heading = heading.textContent;

		/**
		 * Return currently operable controls inside the inspector panel.
		 *
		 * @return {Array} Focusable elements in DOM order.
		 */
		function get_focusable_elements() {
			return Array.prototype.filter.call( panel.querySelectorAll( focusable_selector ), function ( element ) {
				return ! element.hidden && null !== element.offsetParent;
			} );
		}

		/**
		 * Close the inspector and optionally restore its activating element.
		 *
		 * @param {boolean} restore_focus Whether to restore activation focus.
		 * @return {void}
		 */
		function close( restore_focus ) {
			var focus_target = return_focus;

			if ( root.hidden ) {
				return;
			}
			if ( 'function' === typeof settings.on_before_close && false === settings.on_before_close() ) {
				return;
			}
			root.hidden = true;
			root.classList.remove( 'is-open' );
			status.textContent = '';
			if ( 'function' === typeof settings.on_close ) {
				settings.on_close();
			}
			dispatch_layer_event( layer_close_event, layer_descriptor );
			return_focus = null;
			if ( restore_focus && focus_target && focus_target.isConnected && 'function' === typeof focus_target.focus ) {
				focus_target.focus();
			}
		}

		/**
		 * Open the inspector and move focus to its accessible heading.
		 *
		 * @param {HTMLElement|null} trigger Activating element for focus restoration.
		 * @return {void}
		 */
		function open( trigger ) {
			return_focus = trigger && 'function' === typeof trigger.focus ? trigger : document.activeElement;
			root.hidden = false;
			root.classList.add( 'is-open' );
			dispatch_layer_event( layer_open_event, layer_descriptor );
			window.requestAnimationFrame( function () {
				if ( ! root.hidden ) {
					heading.focus();
				}
			} );
		}

		/**
		 * Show an inspector loading state with a caller-owned label.
		 *
		 * @param {string} message Localized loading message.
		 * @return {void}
		 */
		function set_loading( message ) {
			loading.hidden = false;
			error.hidden = true;
			content.hidden = true;
			content.textContent = '';
			if ( loading_label ) {
				loading_label.textContent = String( message || '' );
			}
			status.textContent = String( message || '' );
			panel.setAttribute( 'aria-busy', 'true' );
		}

		/**
		 * Show a safe caller-owned error without interpreting markup.
		 *
		 * @param {string} message Localized safe error message.
		 * @return {void}
		 */
		function set_error( message ) {
			var paragraph = error.querySelector( 'p' );

			loading.hidden = true;
			content.hidden = true;
			error.hidden = false;
			if ( paragraph ) {
				paragraph.textContent = String( message || '' );
			}
			status.textContent = String( message || '' );
			panel.setAttribute( 'aria-busy', 'false' );
		}

		/**
		 * Display caller-rendered domain template output.
		 *
		 * The HTML must be produced locally from an allow-listed WordPress
		 * template and authorized DTO data; it must never be server-returned HTML.
		 *
		 * @param {string} rendered_content Domain template output.
		 * @param {string} announcement     Localized completion announcement.
		 * @return {void}
		 */
		function set_content( rendered_content, announcement ) {
			loading.hidden = true;
			error.hidden = true;
			content.innerHTML = String( rendered_content || '' );
			content.hidden = false;
			status.textContent = String( announcement || '' );
			panel.setAttribute( 'aria-busy', 'false' );
		}

		/**
		 * Display caller-rendered state content while preserving shell mechanics.
		 *
		 * The state HTML remains domain-owned and must be produced from an
		 * allow-listed local WordPress template. The shared shell owns only the
		 * visibility, announcement, and aria-busy behavior.
		 *
		 * @param {string}  rendered_content Caller-rendered state markup.
		 * @param {string}  announcement     Localized state announcement.
		 * @param {boolean} is_busy          Whether the panel remains busy.
		 * @return {void}
		 */
		function set_state( rendered_content, announcement, is_busy ) {
			loading.hidden = true;
			error.hidden = true;
			content.innerHTML = String( rendered_content || '' );
			content.hidden = false;
			status.textContent = String( announcement || '' );
			panel.setAttribute( 'aria-busy', is_busy ? 'true' : 'false' );
		}

		/**
		 * Replace the visible header with caller-rendered domain content.
		 *
		 * The accessible dialog name remains plain text in the shell-owned heading.
		 * The supplied HTML must come from an allow-listed local WordPress template.
		 *
		 * @param {string} rendered_header Domain header markup.
		 * @param {string} accessible_title Plain localized dialog title.
		 * @return {void}
		 */
		function set_header( rendered_header, accessible_title ) {
			heading.textContent = String( accessible_title || default_heading || '' );
			heading.classList.add( 'wpbc_shared_ui_inspector__heading--visually-hidden' );
			header_content.innerHTML = String( rendered_header || '' );
			header_content.hidden = false;
		}

		/**
		 * Restore the default shell heading before loading another domain record.
		 *
		 * @param {string} accessible_title Optional replacement default title.
		 * @return {void}
		 */
		function reset_header( accessible_title ) {
			heading.textContent = String( accessible_title || default_heading || '' );
			heading.classList.remove( 'wpbc_shared_ui_inspector__heading--visually-hidden' );
			header_content.textContent = '';
			header_content.hidden = true;
		}

		/**
		 * Handle close controls and the modal backdrop.
		 *
		 * @param {MouseEvent} event Inspector click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			if ( event.target.closest( '[data-wpbc-shared-ui-inspector-close]' ) ) {
				event.preventDefault();
				close( true );
			}
		}

		/**
		 * Close with Escape and contain Tab focus while the modal is open.
		 *
		 * @param {KeyboardEvent} event Inspector key event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			var focusable_elements;
			var first_element;
			var last_element;

			if ( 'Escape' === event.key ) {
				event.preventDefault();
				close( true );
				return;
			}
			if ( 'Tab' !== event.key ) {
				return;
			}
			focusable_elements = get_focusable_elements();
			if ( ! focusable_elements.length ) {
				event.preventDefault();
				panel.focus();
				return;
			}
			first_element = focusable_elements[ 0 ];
			last_element = focusable_elements[ focusable_elements.length - 1 ];
			if ( event.shiftKey && ( document.activeElement === first_element || document.activeElement === panel || document.activeElement === heading ) ) {
				event.preventDefault();
				last_element.focus();
			} else if ( ! event.shiftKey && document.activeElement === last_element ) {
				event.preventDefault();
				first_element.focus();
			}
		}

		root.addEventListener( 'click', handle_click );
		root.addEventListener( 'keydown', handle_keydown );

		return {
			open: open,
			close: close,
			set_loading: set_loading,
			set_error: set_error,
			set_content: set_content,
			set_state: set_state,
			set_header: set_header,
			reset_header: reset_header,
			is_open: function () {
				return ! root.hidden;
			}
		};
	}

	window.wpbc_shared_ui_inspector = window.wpbc_shared_ui_inspector || {};
	window.wpbc_shared_ui_inspector.create = create;
}( window, document ) );
