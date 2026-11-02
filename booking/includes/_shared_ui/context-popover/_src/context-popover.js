/**
 * Domain-neutral Context Popover shell and state controller.
 *
 * The shared controller owns only shell rendering, Tippy positioning, state
 * presentation, and component-local lifecycle. Domains own authorization,
 * data, templates, requests, actions, and suppression policy.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, wp ) {
	'use strict';

	var api = window.wpbc_shared_ui_context_popover || {};
	var active_controller = null;
	var visible_controllers = [];
	var registered_controllers = {};
	var layer_open_event = 'wpbc:shared-ui-layer-open';
	var layer_close_event = 'wpbc:shared-ui-layer-close';
	var legacy_popover_selector = '.popover_bottom.popover_click';
	var tooltip_owner_selector = '.tooltip_top, .tooltip_bottom, .tooltip_left, .tooltip_right, .tooltip_right_offset, [data-wpbc-ui-catalog-overflow-tooltip]';
	var clipped_title_tooltip_selector = '[data-wpbc-ui-catalog-overflow-tooltip], .wpbc_ui_listing__overflow_tooltip';
	var reserved_owner_selector = '[data-wpbc-shared-ui-popover]';
	var blocking_layer_types = [ 'context_popover', 'modal', 'inspector', 'disclosure', 'review', 'apply' ];
	var suspending_layer_types = [ 'modal', 'inspector', 'review', 'apply' ];
	var automatic_close_reasons = [
		'pointer_exit',
		'outside_pointer',
		'outside_focus',
		'external_scroll',
		'replacement'
	];
	var explicit_close_reasons = [
		'explicit_close',
		'escape',
		'inspector_handoff',
		'destroy',
		'authorization_invalidation',
		'programmatic',
		'uncontrolled_library_hide'
	];
	var suspension_reasons = [ 'blocking_layer', 'reference_refresh', 'reference_unavailable' ];
	var allowed_placements = [
		'auto',
		'auto-start',
		'auto-end',
		'top',
		'top-start',
		'top-end',
		'bottom',
		'bottom-start',
		'bottom-end',
		'left',
		'left-start',
		'left-end',
		'right',
		'right-start',
		'right-end'
	];

	/**
	 * Normalize a component identifier for DOM and ownership attributes.
	 *
	 * @param {*} candidate Candidate component identifier.
	 * @return {string} Safe identifier, or an empty string when invalid.
	 */
	function normalize_id( candidate ) {
		return String( candidate || '' ).replace( /[^A-Za-z0-9_-]/g, '' ).slice( 0, 120 );
	}

	/**
	 * Normalize a floating-layer descriptor to the public metadata boundary.
	 *
	 * The returned object deliberately contains only interaction identifiers.
	 * Domain records, nonces, form values, and authorization state are never
	 * accepted or forwarded by the shared protocol.
	 *
	 * @param {*} candidate Candidate descriptor.
	 * @return {Object|null} Four-key layer descriptor or null when invalid.
	 */
	function normalize_layer_descriptor( candidate ) {
		var descriptor;

		if ( ! candidate || 'object' !== typeof candidate ) {
			return null;
		}
		descriptor = {
			layer_type: normalize_id( candidate.layer_type ),
			instance_id: normalize_id( candidate.instance_id ),
			owner_id: normalize_id( candidate.owner_id ),
			interaction_group: normalize_id( candidate.interaction_group )
		};
		if ( ! descriptor.layer_type || ! descriptor.instance_id ) {
			return null;
		}

		return descriptor;
	}

	/**
	 * Dispatch one domain-neutral shared floating-layer lifecycle event.
	 *
	 * @param {string} event_name Open or close protocol event name.
	 * @param {Object} candidate  Candidate layer descriptor.
	 * @return {boolean} True when a normalized event was dispatched.
	 */
	function dispatch_layer_event( event_name, candidate ) {
		var descriptor = normalize_layer_descriptor( candidate );
		var layer_event;

		if ( ! descriptor || -1 === [ layer_open_event, layer_close_event ].indexOf( event_name ) ) {
			return false;
		}
		if ( 'function' === typeof window.CustomEvent ) {
			layer_event = new window.CustomEvent( event_name, {
				bubbles: false,
				detail: descriptor
			} );
		} else {
			layer_event = document.createEvent( 'CustomEvent' );
			layer_event.initCustomEvent( event_name, false, false, descriptor );
		}
		document.dispatchEvent( layer_event );

		return true;
	}

	/**
	 * Normalize a supported Context Popover mode.
	 *
	 * @param {*} candidate Candidate mode.
	 * @return {string} `interactive` or `preview`.
	 */
	function normalize_mode( candidate ) {
		return 'interactive' === String( candidate || '' ) ? 'interactive' : 'preview';
	}

	/**
	 * Normalize the optional pin policy.
	 *
	 * Pinning is deliberately disabled unless a domain opts into the neutral
	 * manual policy. The shared controller never infers whether domain content
	 * is safe to retain.
	 *
	 * @param {*} candidate Candidate pin policy.
	 * @return {string} `manual` or `none`.
	 */
	function normalize_pin_policy( candidate ) {
		return 'manual' === String( candidate || '' ) ? 'manual' : 'none';
	}

	/**
	 * Normalize external-scroll behavior for one popover instance.
	 *
	 * Existing consumers dismiss by default. The retain policy is an explicit,
	 * domain-neutral opt-in for surfaces whose controls must remain reachable
	 * while their page scrolls; Popper continues to own positioning.
	 *
	 * @param {*} candidate Candidate external-scroll policy.
	 * @return {string} `retain` or `dismiss`.
	 */
	function normalize_external_scroll_policy( candidate ) {
		return 'retain' === String( candidate || '' ) ? 'retain' : 'dismiss';
	}

	/**
	 * Normalize the optional automatic-dismiss policy.
	 *
	 * Explicit surfaces reject pointer-exit, outside-pointer, outside-focus,
	 * external-scroll, and replacement dismissal. Close, Escape, authorization
	 * invalidation, and caller programmatic closure remain available.
	 *
	 * @param {*} candidate Candidate dismissal policy.
	 * @return {string} `explicit` or `automatic`.
	 */
	function normalize_dismiss_policy( candidate ) {
		return 'explicit' === String( candidate || '' ) ? 'explicit' : 'automatic';
	}

	/**
	 * Normalize the optional Tippy portal host.
	 *
	 * @param {*} candidate Candidate portal host.
	 * @return {HTMLElement} Connected element host, or the document body.
	 */
	function normalize_portal_host( candidate ) {
		return candidate
			&& 1 === candidate.nodeType
			&& candidate.isConnected
			? candidate
			: document.body;
	}

	/**
	 * Normalize the Popper positioning strategy.
	 *
	 * @param {*} candidate Candidate strategy.
	 * @return {string} `absolute` or `fixed`.
	 */
	function normalize_positioning_strategy( candidate ) {
		return 'absolute' === String( candidate || '' ) ? 'absolute' : 'fixed';
	}

	/**
	 * Normalize the optional live-reference failure policy.
	 *
	 * Existing consumers retain the established fallback rectangle. A strict
	 * owner opts out of remembered coordinates so a detached domain owner cannot
	 * leave a visible surface pointing at stale screen geometry.
	 *
	 * @param {*} candidate Candidate reference policy.
	 * @return {string} `strict_live_owner` or `fallback`.
	 */
	function normalize_reference_policy( candidate ) {
		return 'strict_live_owner' === String( candidate || '' ) ? 'strict_live_owner' : 'fallback';
	}

	/**
	 * Normalize a close or suspension reason before lifecycle state changes.
	 *
	 * @param {*} candidate Candidate reason.
	 * @return {string} Allow-listed reason, or an empty string when invalid.
	 */
	function normalize_close_reason( candidate ) {
		candidate = String( candidate || '' );
		if (
			-1 !== automatic_close_reasons.indexOf( candidate )
			|| -1 !== explicit_close_reasons.indexOf( candidate )
			|| -1 !== suspension_reasons.indexOf( candidate )
		) {
			return candidate;
		}

		return '';
	}

	/**
	 * Report whether a reason is an automatic transient dismissal.
	 *
	 * @param {string} reason Normalized reason.
	 * @return {boolean} True for automatic dismissal.
	 */
	function is_automatic_close_reason( reason ) {
		return -1 !== automatic_close_reasons.indexOf( reason );
	}

	/**
	 * Put one visible controller at the top of shared surface ordering.
	 *
	 * @param {Object} controller Context Popover controller.
	 * @return {void}
	 */
	function register_visible_controller( controller ) {
		visible_controllers = visible_controllers.filter( function ( candidate ) {
			return candidate !== controller;
		} );
		visible_controllers.push( controller );
		active_controller = controller;
	}

	/**
	 * Remove one controller from visible ordering.
	 *
	 * @param {Object} controller Context Popover controller.
	 * @return {void}
	 */
	function unregister_visible_controller( controller ) {
		visible_controllers = visible_controllers.filter( function ( candidate ) {
			return candidate !== controller;
		} );
		active_controller = visible_controllers.length
			? visible_controllers[ visible_controllers.length - 1 ]
			: null;
	}

	/**
	 * Report whether a controller participates in visible arbitration.
	 *
	 * @param {Object} controller Context Popover controller.
	 * @return {boolean} True when visibly registered.
	 */
	function is_visible_controller( controller ) {
		return -1 !== visible_controllers.indexOf( controller );
	}

	/**
	 * Request replacement dismissal from every other visible controller.
	 *
	 * Pinned controllers reject this automatic reason while transient consumers
	 * preserve their established single-active-surface behavior.
	 *
	 * @param {Object} opening_controller Controller about to open.
	 * @return {void}
	 */
	function arbitrate_visible_controllers( opening_controller ) {
		visible_controllers.slice().forEach( function ( visible_controller ) {
			if ( visible_controller !== opening_controller ) {
				visible_controller.request_close( 'replacement', false );
			}
		} );
	}

	/**
	 * Resolve Escape to the focused owner, then the topmost eligible surface.
	 *
	 * @param {Node|null} event_target Current Escape target.
	 * @return {Object|null} Controller that owns this Escape, or null.
	 */
	function get_escape_controller( event_target ) {
		var focused_owner = null;
		var focused_child_owns_escape = false;
		var focused_shared_layer = null;
		var topmost_owner = null;
		var ordered_controllers = visible_controllers.slice().reverse();
		var event_element = get_element( event_target );

		ordered_controllers.some( function ( visible_controller ) {
			if ( visible_controller.owns_node( event_target ) ) {
				if ( visible_controller.can_handle_escape() ) {
					focused_owner = visible_controller;
				} else {
					focused_child_owns_escape = true;
				}
				return true;
			}
			return false;
		} );
		if ( focused_owner ) {
			return focused_owner;
		}
		if ( focused_child_owns_escape ) {
			return null;
		}
		focused_shared_layer = event_element
			? event_element.closest( '[data-wpbc-shared-ui-layer-instance]' )
			: null;
		if ( focused_shared_layer ) {
			return null;
		}
		ordered_controllers.some( function ( visible_controller ) {
			if ( visible_controller.can_handle_escape() ) {
				topmost_owner = visible_controller;
				return true;
			}
			return false;
		} );

		return topmost_owner;
	}

	/**
	 * Normalize the pointer reference geometry requested by a domain adapter.
	 *
	 * `point` keeps the original frozen pointer point. `trigger_block_edge`
	 * retains the pointer's inline coordinate for the arrow while using the
	 * trigger's top and bottom edges for vertical placement.
	 *
	 * @param {*} candidate Candidate pointer anchor mode.
	 * @return {string} Allow-listed pointer anchor mode.
	 */
	function normalize_pointer_anchor( candidate ) {
		return 'trigger_block_edge' === String( candidate || '' ) ? 'trigger_block_edge' : 'point';
	}

	/**
	 * Normalize a Popper placement against the shared allow list.
	 *
	 * @param {*} candidate Candidate placement.
	 * @return {string} Allow-listed placement.
	 */
	function normalize_placement( candidate ) {
		candidate = String( candidate || '' );

		return -1 === allowed_placements.indexOf( candidate ) ? 'auto-start' : candidate;
	}

	/**
	 * Normalize an ordered Popper placement list without duplicate values.
	 *
	 * Domains may use this neutral option when their surface must remain on one
	 * axis, for example above or below a long horizontal trigger. Popper still
	 * owns flipping and viewport-overflow prevention.
	 *
	 * @param {*} candidate Candidate placement list.
	 * @return {Array<string>} Ordered allow-listed placements.
	 */
	function normalize_placement_list( candidate ) {
		var normalized_placements = [];

		if ( ! Array.isArray( candidate ) ) {
			return normalized_placements;
		}
		candidate.forEach( function ( placement ) {
			placement = String( placement || '' );
			if (
				-1 !== allowed_placements.indexOf( placement )
				&& -1 === normalized_placements.indexOf( placement )
			) {
				normalized_placements.push( placement );
			}
		} );

		return normalized_placements;
	}

	/**
	 * Normalize one bounded delay in milliseconds.
	 *
	 * @param {*}      candidate Candidate delay.
	 * @param {number} fallback  Delay used when the candidate is not finite.
	 * @return {number} Integer delay between zero and two seconds.
	 */
	function normalize_delay( candidate, fallback ) {
		var delay = Number( candidate );

		if ( ! Number.isFinite( delay ) ) {
			delay = fallback;
		}

		return Math.min( 2000, Math.max( 0, Math.round( delay ) ) );
	}

	/**
	 * Normalize one domain-neutral CSS-pixel length.
	 *
	 * @param {*}      candidate Candidate CSS-pixel length.
	 * @param {number} fallback  Length used when the candidate is not finite.
	 * @param {number} minimum   Smallest permitted length.
	 * @param {number} maximum   Largest permitted length.
	 * @return {number} Bounded integer CSS-pixel length.
	 */
	function normalize_length( candidate, fallback, minimum, maximum ) {
		candidate = Number( candidate );
		if ( ! Number.isFinite( candidate ) ) {
			candidate = fallback;
		}

		return Math.max( minimum, Math.min( maximum, Math.round( candidate ) ) );
	}

	/**
	 * Normalize a domain-neutral popover width preference.
	 *
	 * The bounded value is presentation metadata only. It cannot select a
	 * template or change domain behavior, and existing consumers keep the
	 * established fallback when they do not opt in.
	 *
	 * @param {*}      candidate Candidate CSS-pixel width.
	 * @param {number} fallback  Width used when the candidate is not finite.
	 * @param {number} minimum   Smallest permitted width.
	 * @param {number} maximum   Largest permitted width.
	 * @return {number} Bounded integer CSS-pixel width.
	 */
	function normalize_width( candidate, fallback, minimum, maximum ) {
		return normalize_length( candidate, fallback, minimum, maximum );
	}

	/**
	 * Convert an arbitrary scalar to bounded plain text.
	 *
	 * @param {*}      candidate  Candidate text.
	 * @param {number} max_length Maximum returned characters.
	 * @return {string} Bounded plain text.
	 */
	function normalize_text( candidate, max_length ) {
		if ( null === candidate || 'undefined' === typeof candidate || ( 'string' !== typeof candidate && 'number' !== typeof candidate ) ) {
			return '';
		}

		return String( candidate ).slice( 0, max_length );
	}

	/**
	 * Read one positive integer layer token from the document root.
	 *
	 * @param {string} token_name CSS custom-property name.
	 * @param {number} fallback   Fallback layer value.
	 * @return {number} Positive integer z-index.
	 */
	function get_layer_token( token_name, fallback ) {
		var candidate = window.getComputedStyle( document.documentElement ).getPropertyValue( token_name );
		var layer = Math.round( Number( String( candidate || '' ).trim() ) );

		return Number.isFinite( layer ) && 0 < layer ? layer : fallback;
	}

	/**
	 * Normalize an optional per-instance floating-layer index.
	 *
	 * Domains may opt a surface into an existing host stacking contract without
	 * changing the shared default used by every other Context Popover consumer.
	 *
	 * @param {*}      candidate Candidate z-index.
	 * @param {number} fallback  Default shared layer.
	 * @return {number} Positive bounded integer z-index.
	 */
	function normalize_layer_index( candidate, fallback ) {
		candidate = Math.round( Number( candidate ) );
		if ( ! Number.isFinite( candidate ) || 0 >= candidate ) {
			candidate = fallback;
		}

		return Math.min( 1000000, candidate );
	}

	/**
	 * Normalize an optional Popper collision boundary.
	 *
	 * The boundary is presentation geometry only. A disconnected or non-element
	 * value retains the established viewport behavior.
	 *
	 * @param {*} candidate Candidate boundary element.
	 * @return {HTMLElement|string} Connected element or the viewport fallback.
	 */
	function normalize_positioning_boundary( candidate ) {
		return candidate && 1 === candidate.nodeType && candidate.isConnected ? candidate : 'viewport';
	}

	/**
	 * Normalize a rectangle for a Tippy virtual reference.
	 *
	 * @param {Object|null} candidate Candidate DOMRect-like object.
	 * @return {Object|null} Complete finite rectangle or null.
	 */
	function normalize_reference_rect( candidate ) {
		var left;
		var top;
		var width;
		var height;

		if ( ! candidate || 'object' !== typeof candidate ) {
			return null;
		}
		left = Number( candidate.left );
		top = Number( candidate.top );
		width = Math.max( 0, Number( candidate.width ) || 0 );
		height = Math.max( 0, Number( candidate.height ) || 0 );
		if ( ! Number.isFinite( left ) || ! Number.isFinite( top ) ) {
			return null;
		}

		return {
			x: left,
			y: top,
			left: left,
			top: top,
			right: left + width,
			bottom: top + height,
			width: width,
			height: height
		};
	}

	/**
	 * Create a zero-size virtual-reference rectangle at viewport coordinates.
	 *
	 * @param {number} client_x Horizontal viewport coordinate.
	 * @param {number} client_y Vertical viewport coordinate.
	 * @return {Object} Complete zero-size DOMRect-like value.
	 */
	function create_point_reference_rect( client_x, client_y ) {
		return {
			x: client_x,
			y: client_y,
			left: client_x,
			top: client_y,
			right: client_x,
			bottom: client_y,
			width: 0,
			height: 0
		};
	}

	/**
	 * Return an inert off-screen rectangle for a temporarily unavailable strict owner.
	 *
	 * This rectangle is never used as a visible fallback. It only satisfies
	 * Popper's synchronous virtual-element contract until the domain's coalesced
	 * geometry path suspends the surface.
	 *
	 * @return {Object} Zero-sized off-screen rectangle.
	 */
	function create_unavailable_reference_rect() {
		return {
			x: -10000,
			y: -10000,
			left: -10000,
			top: -10000,
			right: -10000,
			bottom: -10000,
			width: 0,
			height: 0
		};
	}

	/**
	 * Create the pointer reference requested by the domain adapter.
	 *
	 * Trigger-edge mode is useful for short horizontal objects: Popper places
	 * the surface above or below the complete object while its arrow remains
	 * aligned with the pointer's horizontal position. Its returned getter keeps
	 * that pointer offset attached to the live trigger while native document or
	 * host scrolling changes the trigger's viewport rectangle. Point mode keeps
	 * the established frozen coordinate contract.
	 *
	 * @param {HTMLElement|null} trigger             Activating trigger.
	 * @param {number}           client_x            Horizontal viewport coordinate.
	 * @param {number}           client_y            Vertical viewport coordinate.
	 * @param {string}           pointer_anchor_mode Normalized pointer anchor mode.
	 * @return {Object|Function|null} Frozen point, live getter, or null.
	 */
	function create_pointer_reference_rect( trigger, client_x, client_y, pointer_anchor_mode ) {
		var pointer_inline_offset;
		var trigger_rect;

		if ( 'trigger_block_edge' !== pointer_anchor_mode ) {
			return create_point_reference_rect( client_x, client_y );
		}
		if ( ! trigger || ! trigger.isConnected || 'function' !== typeof trigger.getBoundingClientRect ) {
			return null;
		}
		trigger_rect = normalize_reference_rect( trigger.getBoundingClientRect() );
		if ( ! trigger_rect || ! is_reference_rect_in_viewport( trigger_rect ) ) {
			return null;
		}
		pointer_inline_offset = Math.max( 0, Math.min( trigger_rect.width, client_x - trigger_rect.left ) );

		return function () {
			var current_pointer_x;
			var current_trigger_rect;

			if ( ! trigger.isConnected ) {
				return null;
			}
			current_trigger_rect = normalize_reference_rect( trigger.getBoundingClientRect() );
			if ( ! current_trigger_rect ) {
				return null;
			}
			current_pointer_x = current_trigger_rect.left + Math.min( pointer_inline_offset, current_trigger_rect.width );

			return {
				x: current_pointer_x,
				y: current_trigger_rect.top,
				left: current_pointer_x,
				top: current_trigger_rect.top,
				right: current_pointer_x,
				bottom: current_trigger_rect.bottom,
				width: 0,
				height: current_trigger_rect.height
			};
		};
	}

	/**
	 * Determine whether a reference rectangle intersects the current viewport.
	 *
	 * A disconnected or scrolled-away trigger must not be allowed to position a
	 * visible popover from the private sentinel at the document origin.
	 *
	 * @param {Object|null} reference_rect Normalized reference rectangle.
	 * @return {boolean} True when at least one point intersects the viewport.
	 */
	function is_reference_rect_in_viewport( reference_rect ) {
		var viewport_width = Math.max( document.documentElement.clientWidth || 0, window.innerWidth || 0 );
		var viewport_height = Math.max( document.documentElement.clientHeight || 0, window.innerHeight || 0 );

		return Boolean(
			reference_rect
			&& 0 < viewport_width
			&& 0 < viewport_height
			&& reference_rect.right >= 0
			&& reference_rect.bottom >= 0
			&& reference_rect.left <= viewport_width
			&& reference_rect.top <= viewport_height
		);
	}

	/**
	 * Create a harmless private reference used only while Tippy is hidden.
	 *
	 * Visible opens are validated separately. Keeping the dormant reference at
	 * the viewport center prevents a hidden sentinel at `(0, 0)` from becoming
	 * an accidental visible fallback during a Tippy lifecycle transition.
	 *
	 * @return {Object} Zero-size rectangle at the viewport center.
	 */
	function create_viewport_center_reference_rect() {
		var viewport_width = Math.max( document.documentElement.clientWidth || 0, window.innerWidth || 0 );
		var viewport_height = Math.max( document.documentElement.clientHeight || 0, window.innerHeight || 0 );

		return create_point_reference_rect( viewport_width / 2, viewport_height / 2 );
	}

	/**
	 * Create one Context Popover shell controller.
	 *
	 * The caller must supply authorized, locally rendered content. This method
	 * sends no request, selects no domain template, and creates no trigger-side
	 * Tippy property. Tippy is attached only to a private sentinel.
	 *
	 * @param {Object} options Executable options and localized shell labels.
	 * @return {Object|null} Component controller or null when dependencies or
	 *                       required configuration are unavailable.
	 */
	function create( options ) {
		var settings = options && 'object' === typeof options ? options : {};
		var component_id = normalize_id( settings.id );
		var mode = normalize_mode( settings.mode );
		var pointer_anchor = normalize_pointer_anchor( settings.pointer_anchor );
		var owner_id = normalize_id( settings.owner_id ) || component_id;
		var interaction_group = normalize_id( settings.interaction_group ) || component_id;
		var pin_policy = normalize_pin_policy( settings.pin_policy );
		var external_scroll_policy = normalize_external_scroll_policy( settings.external_scroll_policy );
		var dismiss_policy = normalize_dismiss_policy( settings.dismiss_policy );
		var reference_policy = normalize_reference_policy( settings.reference_policy );
		var portal_host = normalize_portal_host( settings.portal_host );
		var pinned_portal_host = normalize_portal_host( settings.pinned_portal_host );
		var positioning_strategy = normalize_positioning_strategy( settings.positioning_strategy );
		var fit_on_first_open = true === settings.fit_on_first_open;
		var pin_to_viewport = true === settings.pin_to_viewport;
		var draggable_when_pinned = pin_to_viewport && true === settings.draggable_when_pinned;
		var resizable_when_pinned = pin_to_viewport && true === settings.resizable_when_pinned;
		var context_popover_priority = true === settings.context_popover_priority;
		var layer_descriptor;
		var registered_child_layers = {};
		var open_child_layers = {};
		var suspending_layers = {};
		var layer_open_announced = false;
		var shell_template;
		var shell_wrapper;
		var surface;
		var sentinel;
		var tippy_instance;
		var current_trigger = null;
		var described_trigger = null;
		var reference_rect_provider = null;
		var reference_tracks_trigger = false;
		var last_valid_reference_rect = null;
		var activation_method = 'none';
		var fallback_placements = normalize_placement_list( settings.fallback_placements );
		var allow_flip = false !== settings.allow_flip;
		var get_initial_placement_bounds = 'function' === typeof settings.get_initial_placement_bounds
			? settings.get_initial_placement_bounds
			: null;
		var positioning_boundary = normalize_positioning_boundary( settings.positioning_boundary );
		var prevent_overflow = fit_on_first_open || false !== settings.prevent_overflow;
		var initial_fit_pending = false;
		var initial_fit_captured = false;
		var initial_fit_adjustment = {
			x: 0,
			y: 0
		};
		var pinned_viewport_position = null;
		var pinned_viewport_size = null;
		var active_drag = null;
		var active_resize = null;
		var flip_options = {
			boundary: positioning_boundary,
			rootBoundary: 'viewport',
			padding: 8
		};
		var popper_modifiers = [
			{
				enabled: allow_flip,
				name: 'flip',
				options: flip_options
			}
		];
		var show_delay_ms = normalize_delay( settings.show_delay_ms, 350 );
		var hide_delay_ms = normalize_delay( settings.hide_delay_ms, 120 );
		var external_scroll_grace_ms = normalize_delay( settings.external_scroll_grace_ms, 250 );
		var maximum_width = normalize_width( settings.maximum_width, 550, 240, 760 );
		var preferred_width = normalize_width( settings.preferred_width, 'interactive' === mode ? 420 : 360, 240, maximum_width );
		var fixed_unpinned_height = normalize_length( settings.fixed_unpinned_height, 0, 0, 1200 );
		var boundary_cross_axis = true === settings.boundary_cross_axis;
		var prevent_overflow_alt_axis = boundary_cross_axis && ! ( fit_on_first_open && 0 < fixed_unpinned_height );
		var maximum_resized_width = resizable_when_pinned
			? normalize_width( settings.maximum_resized_width, maximum_width, maximum_width, 1600 )
			: maximum_width;
		var minimum_resized_width = Math.min( maximum_width, 320 );
		var minimum_resized_height = 180;
		var layer_z_index = normalize_layer_index(
			settings.layer_z_index,
			get_layer_token( '--wpbc_shared_ui__context-popover-z-index', 100110 )
		);
		var hide_arrow_when_pinned = true === settings.hide_arrow_when_pinned;
		var boundary_tether = false !== settings.boundary_tether;
		var pending_show_timer = 0;
		var pending_close_timer = 0;
		var pending_focus_check_timer = 0;
		var pending_focus_entry_timer = 0;
		var suppressed_focus_timer = 0;
		var pending_surface_constraint_frame = 0;
		var pending_pointer_trigger = null;
		var pending_pointer_id = null;
		var latest_pointer_coordinates = null;
		var suppressed_focus_trigger = null;
		var pointer_inside_composite = false;
		var retained_scroll_until = 0;
		var pinned = false;
		var suspended = false;
		var suspension_reason = '';
		var external_suspension_hold = false;
		var approved_tippy_hide_reason = '';
		var owns_trigger_aria = true === settings.owns_trigger_aria;
		var owned_trigger_aria = null;
		var state = 'idle';
		var destroyed = false;
		var viewport_padding = 8;
		var available_height_property = '--wpbc_shared_ui_context_popover__available-height';
		var available_inline_size_property = '--wpbc_shared_ui_context_popover__available-inline-size';
		var fixed_unpinned_height_property = '--wpbc_shared_ui_context_popover__fixed-unpinned-height';
		var resized_width_property = '--wpbc_shared_ui_context_popover__resized-width';
		var resized_height_property = '--wpbc_shared_ui_context_popover__resized-height';
		var loading;
		var loading_label;
		var content;
		var empty;
		var error;
		var error_message;
		var retry_button;
		var pin_button;
		var pin_button_label;
		var drag_button;
		var resize_button;
		var status;
		var heading;
		var header_content;
		var default_heading = '';
		var controller;

		/*
		 * A scroll-owned portal may deliberately rely on its ancestor's native
		 * clipping instead of being translated back into the Visual Viewport.
		 * All existing consumers retain Popper overflow prevention by default.
		 */
		if ( prevent_overflow ) {
			popper_modifiers.push( {
				name: 'preventOverflow',
				options: {
					/*
					 * For top/bottom placements Popper's mainAxis is inline and its
					 * altAxis is vertical. An alt-axis correction may therefore move
					 * an exact-height surface across the reference it must point to.
					 */
					mainAxis: true,
					altAxis: prevent_overflow_alt_axis,
					boundary: positioning_boundary,
					rootBoundary: 'viewport',
					padding: 8,
					tether: boundary_tether
				}
			} );
		} else {
			popper_modifiers.push( {
				enabled: false,
				name: 'preventOverflow'
			} );
		}
		if ( fit_on_first_open ) {
			popper_modifiers.push( {
				name: 'wpbcInitialFit',
				enabled: true,
				phase: 'main',
				requires: [ 'popperOffsets' ],
				requiresIfExists: [ 'preventOverflow' ],
				fn: apply_initial_fit_modifier
			} );
		}
		if ( pin_to_viewport ) {
			popper_modifiers.push( {
				name: 'wpbcPinnedViewport',
				enabled: true,
				phase: 'beforeWrite',
				requires: [ 'computeStyles' ],
				fn: apply_pinned_viewport_modifier
			} );
		}

		layer_descriptor = normalize_layer_descriptor( {
			layer_type: 'context_popover',
			instance_id: component_id,
			owner_id: owner_id,
			interaction_group: interaction_group
		} );

		if (
			! component_id
			|| ! wp
			|| 'function' !== typeof wp.template
			|| 'function' !== typeof window.wpbc_tippy
			|| ! document.getElementById( 'tmpl-wpbc-shared-ui-context-popover-shell' )
			|| registered_controllers[ component_id ]
			|| document.getElementById( component_id )
		) {
			return null;
		}
		if ( allow_flip && fallback_placements.length ) {
			flip_options.fallbackPlacements = fallback_placements;
		}

		shell_template = wp.template( 'wpbc-shared-ui-context-popover-shell' );
		shell_wrapper = document.createElement( 'div' );
		shell_wrapper.innerHTML = shell_template( {
			id: component_id,
			mode: mode,
			owner_id: owner_id,
			interaction_group: interaction_group,
			pin_enabled: 'manual' === pin_policy,
			drag_enabled: draggable_when_pinned,
			drag_label: normalize_text( settings.drag_label, 160 ),
			resize_enabled: resizable_when_pinned,
			resize_label: normalize_text( settings.resize_label, 160 ),
			pin_label: normalize_text( settings.pin_label, 160 ),
			pinned_label: normalize_text( settings.pinned_label, 160 ),
			unpin_label: normalize_text( settings.unpin_label, 160 ),
			title: normalize_text( settings.title, 200 ),
			close_label: normalize_text( settings.close_label, 160 ),
			loading_label: normalize_text( settings.loading_label, 240 ),
			empty_label: normalize_text( settings.empty_label, 500 ),
			error_label: normalize_text( settings.error_label, 500 ),
			retry_label: normalize_text( settings.retry_label, 160 )
		} ).trim();
		surface = shell_wrapper.firstElementChild;
		if ( ! surface ) {
			return null;
		}
		surface.style.setProperty( '--wpbc_shared_ui_context_popover__preferred-width', preferred_width + 'px' );
		if ( 0 < fixed_unpinned_height ) {
			surface.style.setProperty( fixed_unpinned_height_property, fixed_unpinned_height + 'px' );
			surface.setAttribute( 'data-wpbc-shared-ui-context-popover-fixed-unpinned-height', 'true' );
		}
		constrain_surface_to_positioning_boundary();

		loading = surface.querySelector( '[data-wpbc-shared-ui-context-popover-loading]' );
		loading_label = surface.querySelector( '[data-wpbc-shared-ui-context-popover-loading-label]' );
		content = surface.querySelector( '[data-wpbc-shared-ui-context-popover-content]' );
		empty = surface.querySelector( '[data-wpbc-shared-ui-context-popover-empty]' );
		error = surface.querySelector( '[data-wpbc-shared-ui-context-popover-error]' );
		error_message = error ? error.querySelector( 'p' ) : null;
		retry_button = surface.querySelector( '[data-wpbc-shared-ui-context-popover-retry]' );
		pin_button = surface.querySelector( '[data-wpbc-shared-ui-context-popover-pin]' );
		pin_button_label = pin_button ? pin_button.querySelector( '[data-wpbc-shared-ui-context-popover-pin-label]' ) : null;
		drag_button = surface.querySelector( '[data-wpbc-shared-ui-context-popover-drag]' );
		resize_button = surface.querySelector( '[data-wpbc-shared-ui-context-popover-resize]' );
		status = surface.querySelector( '[data-wpbc-shared-ui-context-popover-status]' );
		heading = surface.querySelector( '[data-wpbc-shared-ui-context-popover-heading]' );
		header_content = surface.querySelector( '[data-wpbc-shared-ui-context-popover-header-content]' );
		default_heading = heading ? heading.textContent : '';
		if (
			! loading
			|| ! content
			|| ! empty
			|| ! error
			|| ! retry_button
			|| ! status
			|| ( 'manual' === pin_policy && ( ! pin_button || ! pin_button_label ) )
			|| ( draggable_when_pinned && ! drag_button )
			|| ( resizable_when_pinned && ! resize_button )
		) {
			return null;
		}

		sentinel = document.createElement( 'span' );
		sentinel.className = 'wpbc_shared_ui_context_popover__sentinel';
		sentinel.setAttribute( 'data-wpbc-shared-ui-context-popover-sentinel', component_id );
		sentinel.setAttribute( 'aria-hidden', 'true' );
		document.body.appendChild( sentinel );

		/**
		 * Resolve the current virtual reference without altering the trigger.
		 *
		 * @return {Object} Current finite reference rectangle.
		 */
		function get_reference_rect() {
			var candidate_rect = null;
			var normalized_rect;

			try {
				candidate_rect = 'function' === typeof reference_rect_provider ? reference_rect_provider() : reference_rect_provider;
			} catch ( error ) {
				candidate_rect = null;
			}
			normalized_rect = normalize_reference_rect( candidate_rect );

			if ( normalized_rect && ( reference_tracks_trigger || is_reference_rect_in_viewport( normalized_rect ) ) ) {
				last_valid_reference_rect = normalized_rect;
				return last_valid_reference_rect;
			}
			if ( 'strict_live_owner' === reference_policy ) {
				return create_unavailable_reference_rect();
			}
			if ( current_trigger && current_trigger.isConnected && 'function' === typeof current_trigger.getBoundingClientRect ) {
				normalized_rect = normalize_reference_rect( current_trigger.getBoundingClientRect() );
				if ( normalized_rect && ( reference_tracks_trigger || is_reference_rect_in_viewport( normalized_rect ) ) ) {
					last_valid_reference_rect = normalized_rect;
					return last_valid_reference_rect;
				}
			}
			if ( last_valid_reference_rect ) {
				return last_valid_reference_rect;
			}

			return create_viewport_center_reference_rect();
		}

		/**
		 * Preserve only the overflow correction calculated for the current open.
		 *
		 * Popper may fit the surface into the visible boundary once, but later
		 * scroll updates must retain that first correction so a scroll-owned
		 * portal continues to move and clip with its canvas.
		 *
		 * @param {Object} modifier_arguments Popper modifier state wrapper.
		 * @return {void}
		 */
		function apply_initial_fit_modifier( modifier_arguments ) {
			var modifier_data;
			var current_x;
			var current_y;

			if (
				! fit_on_first_open
				|| pinned
				|| ! modifier_arguments
				|| ! modifier_arguments.state
				|| ! modifier_arguments.state.modifiersData
				|| ! modifier_arguments.state.modifiersData.popperOffsets
				|| ( ! initial_fit_pending && ! initial_fit_captured )
			) {
				return;
			}
			modifier_data = modifier_arguments.state.modifiersData.preventOverflow || {};
			current_x = Number.isFinite( modifier_data.x ) ? modifier_data.x : 0;
			current_y = Number.isFinite( modifier_data.y ) ? modifier_data.y : 0;
			if ( initial_fit_pending || ! initial_fit_captured ) {
				initial_fit_adjustment = {
					x: current_x,
					y: current_y
				};
				initial_fit_pending = false;
				initial_fit_captured = true;
				return;
			}
			modifier_arguments.state.modifiersData.popperOffsets.x += initial_fit_adjustment.x - current_x;
			modifier_arguments.state.modifiersData.popperOffsets.y += initial_fit_adjustment.y - current_y;
		}

		/**
		 * Return the current Visual Viewport rectangle in layout coordinates.
		 *
		 * @return {Object} Finite left, top, right, bottom, width, and height.
		 */
		function get_visual_viewport_bounds() {
			var visual_viewport = window.visualViewport;
			var left = visual_viewport && Number.isFinite( visual_viewport.offsetLeft ) ? visual_viewport.offsetLeft : 0;
			var top = visual_viewport && Number.isFinite( visual_viewport.offsetTop ) ? visual_viewport.offsetTop : 0;
			var width = visual_viewport && Number.isFinite( visual_viewport.width )
				? visual_viewport.width
				: Math.max( document.documentElement.clientWidth || 0, window.innerWidth || 0 );
			var height = visual_viewport && Number.isFinite( visual_viewport.height )
				? visual_viewport.height
				: Math.max( document.documentElement.clientHeight || 0, window.innerHeight || 0 );

			return {
				left: left,
				top: top,
				right: left + width,
				bottom: top + height,
				width: width,
				height: height
			};
		}

		/**
		 * Keep a pinned surface reachable inside the current Visual Viewport.
		 *
		 * @param {number} left Requested viewport-relative left coordinate.
		 * @param {number} top  Requested viewport-relative top coordinate.
		 * @return {Object} Clamped left and top coordinates.
		 */
		function clamp_pinned_viewport_position( left, top ) {
			var viewport_bounds = get_visual_viewport_bounds();
			var surface_rect = surface.getBoundingClientRect();
			var surface_width = Math.max( 1, surface_rect.width || preferred_width );
			var surface_height = Math.max( 1, surface_rect.height || 1 );
			var minimum_left = viewport_bounds.left + viewport_padding;
			var minimum_top = viewport_bounds.top + viewport_padding;
			var maximum_left = Math.max( minimum_left, viewport_bounds.right - viewport_padding - surface_width );
			var maximum_top = Math.max( minimum_top, viewport_bounds.bottom - viewport_padding - surface_height );

			return {
				left: Math.min( maximum_left, Math.max( minimum_left, Number.isFinite( left ) ? left : minimum_left ) ),
				top: Math.min( maximum_top, Math.max( minimum_top, Number.isFinite( top ) ? top : minimum_top ) )
			};
		}

		/**
		 * Override Popper output only while the opted-in surface is viewport pinned.
		 *
		 * @param {Object} modifier_arguments Popper modifier state wrapper.
		 * @return {void}
		 */
		function apply_pinned_viewport_modifier( modifier_arguments ) {
			var popper_styles;

			if ( ! pinned || ! pinned_viewport_position || ! modifier_arguments || ! modifier_arguments.state ) {
				return;
			}
			popper_styles = modifier_arguments.state.styles.popper || {};
			popper_styles.position = 'fixed';
			popper_styles.left = '0';
			popper_styles.top = '0';
			popper_styles.right = 'auto';
			popper_styles.bottom = 'auto';
			popper_styles.transform = 'translate3d(' + pinned_viewport_position.left + 'px, ' + pinned_viewport_position.top + 'px, 0)';
			modifier_arguments.state.styles.popper = popper_styles;
		}

		/**
		 * Recreate Popper geometry after moving between canvas and viewport portals.
		 *
		 * @return {void}
		 */
		function apply_positioning_mode() {
			var active_portal_host;
			var active_positioning_strategy;

			if ( ! tippy_instance || ! tippy_instance.popper ) {
				return;
			}
			active_portal_host = pinned && pin_to_viewport ? pinned_portal_host : portal_host;
			active_positioning_strategy = pinned && pin_to_viewport ? 'fixed' : positioning_strategy;
			tippy_instance.setProps( {
				appendTo: function () {
					return active_portal_host;
				},
				maxWidth: pinned && resizable_when_pinned ? maximum_resized_width : maximum_width,
				popperOptions: {
					strategy: active_positioning_strategy,
					modifiers: popper_modifiers
				}
			} );
			if ( tippy_instance.popper.parentNode !== active_portal_host ) {
				active_portal_host.appendChild( tippy_instance.popper );
			}
			if ( tippy_instance.popperInstance ) {
				tippy_instance.popperInstance.forceUpdate();
			}
		}

		/**
		 * Create the live reference provider configured for one domain trigger.
		 *
		 * Domains may constrain visibility through `get_reference_rect`; existing
		 * consumers continue to use the native trigger rectangle.
		 *
		 * @param {HTMLElement} trigger Connected domain trigger.
		 * @return {Function} Live DOMRect-like provider.
		 */
		function create_trigger_reference_provider( trigger ) {
			return function () {
				if ( 'function' === typeof settings.get_reference_rect ) {
					return settings.get_reference_rect( trigger );
				}

				return trigger.getBoundingClientRect();
			};
		}

		/**
		 * Resolve and validate an explicit virtual-reference provider before show.
		 *
		 * @param {Object|Function|null} reference_rect         DOMRect-like value or getter.
		 * @param {boolean}              allow_outside_viewport Whether a retained viewport pin may use an off-screen owner.
		 * @return {Object|null} Visible normalized rectangle or null.
		 */
		function resolve_open_reference_rect( reference_rect, allow_outside_viewport ) {
			var candidate_rect = null;
			var normalized_rect;

			try {
				candidate_rect = 'function' === typeof reference_rect ? reference_rect() : reference_rect;
			} catch ( error ) {
				candidate_rect = null;
			}
			normalized_rect = normalize_reference_rect( candidate_rect );

			return normalized_rect && ( allow_outside_viewport || is_reference_rect_in_viewport( normalized_rect ) )
				? normalized_rect
				: null;
		}

		/**
		 * Remove the pending pointer activation timer and its temporary listeners.
		 *
		 * @return {void}
		 */
		function cancel_pending_open() {
			if ( pending_show_timer ) {
				window.clearTimeout( pending_show_timer );
				pending_show_timer = 0;
			}
			document.removeEventListener( 'pointermove', capture_pending_pointer, true );
			if ( pending_pointer_trigger ) {
				pending_pointer_trigger.removeEventListener( 'pointerleave', cancel_pending_open );
			}
			pending_pointer_trigger = null;
			pending_pointer_id = null;
			latest_pointer_coordinates = null;
		}

		/**
		 * Remember pointer movement only while a delayed activation is pending.
		 *
		 * The last coordinates are frozen when the delay completes. No listener
		 * remains after opening, so the visible surface never follows the cursor.
		 *
		 * @param {PointerEvent} event Pointer movement event.
		 * @return {void}
		 */
		function capture_pending_pointer( event ) {
			if (
				null !== pending_pointer_id
				&& event.pointerId !== pending_pointer_id
			) {
				return;
			}
			if ( Number.isFinite( event.clientX ) && Number.isFinite( event.clientY ) ) {
				latest_pointer_coordinates = {
					x: event.clientX,
					y: event.clientY
				};
			}
		}

		/**
		 * Resolve an event or focus node to an Element when possible.
		 *
		 * @param {Node|null} candidate Candidate DOM node.
		 * @return {Element|null} Element candidate or its parent Element.
		 */
		function get_element( candidate ) {
			if ( ! candidate ) {
				return null;
			}
			if ( 1 === candidate.nodeType ) {
				return candidate;
			}

			return candidate.parentElement || null;
		}

		/**
		 * Determine whether a node belongs directly to this popover surface.
		 *
		 * @param {Node|null} candidate Candidate pointer, focus, or scroll node.
		 * @return {boolean} True for the surface or an explicitly owned portal.
		 */
		function is_direct_popover_owned_node( candidate ) {
			var candidate_element = get_element( candidate );
			var owner_selector = '[data-wpbc-shared-ui-context-popover-owner="' + component_id + '"]';

			if ( ! candidate_element ) {
				return false;
			}
			if ( surface === candidate_element || surface.contains( candidate_element ) ) {
				return true;
			}

			return Boolean( candidate_element.closest( owner_selector ) );
		}

		/**
		 * Recognize a foreign Tippy portal whose reference belongs to this surface.
		 *
		 * The controller reads Tippy's public instance relationship only. It never
		 * hides, destroys, reconfigures, or replaces the child instance.
		 *
		 * @param {Node|null} candidate Candidate node inside a Tippy popper.
		 * @return {boolean} True when the Tippy reference is directly owned here.
		 */
		function is_owned_child_tippy_node( candidate ) {
			var candidate_element = get_element( candidate );
			var tippy_root;
			var child_tippy;

			if ( ! candidate_element || ! candidate_element.closest ) {
				return false;
			}
			tippy_root = candidate_element.closest( '[data-tippy-root]' );
			child_tippy = tippy_root && tippy_root._tippy;
			if ( ! child_tippy || ! child_tippy.reference ) {
				return false;
			}

			return is_direct_popover_owned_node( child_tippy.reference );
		}

		/**
		 * Determine whether a node belongs to the surface or a portaled owned child.
		 *
		 * Owned external surfaces must carry the controller's stable instance ID.
		 * This relationship is interaction metadata, not authorization.
		 *
		 * @param {Node|null} candidate Candidate pointer, focus, or scroll node.
		 * @return {boolean} True when the node belongs to this popover surface.
		 */
		function is_popover_owned_node( candidate ) {
			return is_direct_popover_owned_node( candidate ) || is_owned_child_tippy_node( candidate );
		}

		/**
		 * Determine whether an event target belongs to a clipped-title tooltip.
		 *
		 * @param {Node|null} candidate Candidate event target.
		 * @return {boolean} True when the catalog overflow-tooltip owner applies.
		 */
		function is_clipped_title_tooltip_target( candidate ) {
			var candidate_element = get_element( candidate );

			return Boolean( candidate_element && candidate_element.closest && candidate_element.closest( clipped_title_tooltip_selector ) );
		}

		/**
		 * Verify that a domain trigger does not already belong to another owner.
		 *
		 * Standard tooltip targets may be opted into Context Popover priority by
		 * the domain. Legacy click popovers and registered shared owners are never
		 * claimed by this controller.
		 *
		 * @param {HTMLElement|null} trigger Candidate domain trigger.
		 * @return {boolean} True when Context Popover may use the trigger.
		 */
		function can_use_trigger( trigger ) {
			if ( ! trigger || 1 !== trigger.nodeType || ! trigger.closest ) {
				return false;
			}
			if ( trigger.closest( legacy_popover_selector ) || trigger.closest( reserved_owner_selector ) ) {
				return false;
			}
			if ( trigger.closest( tooltip_owner_selector ) ) {
				return context_popover_priority;
			}

			return true;
		}

		/**
		 * Register one child floating layer that belongs to this interaction group.
		 *
		 * Registration affects collision and lifecycle ownership only. It does not
		 * grant access to content, data, or actions inside either component.
		 *
		 * @param {Object} candidate Candidate child layer descriptor.
		 * @return {boolean} True when the child descriptor was registered.
		 */
		function register_child_layer( candidate ) {
			var descriptor = normalize_layer_descriptor( candidate );

			if ( ! descriptor || descriptor.instance_id === component_id ) {
				return false;
			}
			registered_child_layers[ descriptor.instance_id ] = descriptor;

			return true;
		}

		/**
		 * Remove one child layer registration without altering its UI instance.
		 *
		 * @param {*} child_instance_id Stable child layer instance ID.
		 * @return {boolean} True when a registration was removed.
		 */
		function unregister_child_layer( child_instance_id ) {
			child_instance_id = normalize_id( child_instance_id );

			if ( ! child_instance_id || ! registered_child_layers[ child_instance_id ] ) {
				return false;
			}
			delete registered_child_layers[ child_instance_id ];
			delete open_child_layers[ child_instance_id ];

			return true;
		}

		/**
		 * Determine whether a layer event belongs to this composite interaction.
		 *
		 * @param {Object} descriptor Normalized layer descriptor.
		 * @return {boolean} True for this layer, an owned child, or a shared group.
		 */
		function is_related_layer( descriptor ) {
			var registered_child;

			if ( ! descriptor ) {
				return false;
			}
			if ( descriptor.layer_type === layer_descriptor.layer_type && descriptor.instance_id === component_id ) {
				return true;
			}
			registered_child = registered_child_layers[ descriptor.instance_id ];
			if ( registered_child && registered_child.layer_type === descriptor.layer_type ) {
				return true;
			}
			if ( descriptor.owner_id && ( descriptor.owner_id === component_id || descriptor.owner_id === owner_id ) ) {
				return true;
			}

			return Boolean( descriptor.interaction_group && descriptor.interaction_group === interaction_group );
		}

		/**
		 * Determine whether any registered child layer has announced itself open.
		 *
		 * @return {boolean} True while at least one related child remains open.
		 */
		function has_open_child_layers() {
			return 0 < Object.keys( open_child_layers ).length;
		}

		/**
		 * Close for a blocking unrelated shared layer while preserving child layers.
		 *
		 * @param {CustomEvent} event Shared floating-layer open event.
		 * @return {void}
		 */
		function handle_layer_open( event ) {
			var descriptor = normalize_layer_descriptor( event ? event.detail : null );

			if ( ! descriptor ) {
				return;
			}
			if ( is_related_layer( descriptor ) ) {
				if ( descriptor.instance_id !== component_id ) {
					open_child_layers[ descriptor.instance_id ] = descriptor;
				}
				return;
			}
			if (
				-1 !== blocking_layer_types.indexOf( descriptor.layer_type )
				&& ( is_visible_controller( controller ) || pending_show_timer || suspended )
			) {
				if ( pinned && -1 !== suspending_layer_types.indexOf( descriptor.layer_type ) ) {
					suspending_layers[ descriptor.instance_id ] = descriptor;
					suspend( 'blocking_layer', true );
					return;
				}
				request_close(
					'explicit' === dismiss_policy && 'context_popover' !== descriptor.layer_type
						? 'programmatic'
						: 'replacement',
					false
				);
			}
		}

		/**
		 * Forget only the open state of a related child layer.
		 *
		 * @param {CustomEvent} event Shared floating-layer close event.
		 * @return {void}
		 */
		function handle_layer_close( event ) {
			var descriptor = normalize_layer_descriptor( event ? event.detail : null );
			var open_child;
			var suspending_layer;

			suspending_layer = descriptor ? suspending_layers[ descriptor.instance_id ] : null;
			if ( suspending_layer && suspending_layer.layer_type === descriptor.layer_type ) {
				delete suspending_layers[ descriptor.instance_id ];
				if (
					suspended
					&& ! Object.keys( suspending_layers ).length
					&& ! external_suspension_hold
				) {
					resume( false );
				}
			}
			open_child = descriptor ? open_child_layers[ descriptor.instance_id ] : null;
			if ( open_child && open_child.layer_type === descriptor.layer_type ) {
				delete open_child_layers[ descriptor.instance_id ];
				if ( is_visible_controller( controller ) && ! pointer_inside_composite && ! is_composite_node( document.activeElement ) ) {
					schedule_close();
				}
			}
		}

		/**
		 * Announce this Context Popover once per visible lifecycle.
		 *
		 * @return {void}
		 */
		function announce_layer_open() {
			if ( layer_open_announced ) {
				return;
			}
			layer_open_announced = dispatch_layer_event( layer_open_event, layer_descriptor );
		}

		/**
		 * Announce this Context Popover close after releasing its visible state.
		 *
		 * @return {void}
		 */
		function announce_layer_close() {
			if ( ! layer_open_announced ) {
				return;
			}
			layer_open_announced = false;
			dispatch_layer_event( layer_close_event, layer_descriptor );
		}

		/**
		 * Determine whether a node is within the complete composite region.
		 *
		 * @param {Node|null} candidate Candidate pointer or focus node.
		 * @return {boolean} True for the active trigger, surface, or owned child.
		 */
		function is_composite_node( candidate ) {
			var candidate_element = get_element( candidate );

			if ( ! candidate_element ) {
				return false;
			}
			if ( current_trigger && ( current_trigger === candidate_element || current_trigger.contains( candidate_element ) ) ) {
				return true;
			}

			return is_popover_owned_node( candidate_element );
		}

		/**
		 * Cancel a delayed composite-region close.
		 *
		 * @return {void}
		 */
		function cancel_pending_close() {
			if ( pending_close_timer ) {
				window.clearTimeout( pending_close_timer );
				pending_close_timer = 0;
			}
		}

		/**
		 * Cancel delayed focus ownership work.
		 *
		 * @return {void}
		 */
		function cancel_pending_focus() {
			if ( pending_focus_check_timer ) {
				window.clearTimeout( pending_focus_check_timer );
				pending_focus_check_timer = 0;
			}
			if ( pending_focus_entry_timer ) {
				window.clearTimeout( pending_focus_entry_timer );
				pending_focus_entry_timer = 0;
			}
			if ( suppressed_focus_timer ) {
				window.clearTimeout( suppressed_focus_timer );
				suppressed_focus_timer = 0;
			}
			suppressed_focus_trigger = null;
		}

		/**
		 * Cancel every delayed open, close, and focus transition.
		 *
		 * Pin changes use this boundary so no callback queued under the previous
		 * policy can mutate the new state.
		 *
		 * @return {void}
		 */
		function cancel_interaction_timers() {
			cancel_pending_open();
			cancel_pending_close();
			cancel_pending_focus();
		}

		/**
		 * Stop the active pointer drag and release its temporary document listeners.
		 *
		 * @return {void}
		 */
		function finish_pinned_drag() {
			var pointer_id;

			if ( ! active_drag ) {
				return;
			}
			pointer_id = active_drag.pointer_id;
			document.removeEventListener( 'pointermove', handle_pinned_drag_pointer_move, true );
			document.removeEventListener( 'pointerup', finish_pinned_drag, true );
			document.removeEventListener( 'pointercancel', finish_pinned_drag, true );
			active_drag = null;
			surface.removeAttribute( 'data-wpbc-shared-ui-context-popover-dragging' );
			if (
				drag_button
				&& drag_button.hasPointerCapture
				&& drag_button.releasePointerCapture
				&& Number.isFinite( pointer_id )
				&& drag_button.hasPointerCapture( pointer_id )
			) {
				try {
					drag_button.releasePointerCapture( pointer_id );
				} catch ( error ) {
					// The user agent may already have released capture on pointerup.
				}
			}
		}

		/**
		 * Commit one clamped viewport position and refresh the pinned Popper output.
		 *
		 * @param {number} left Requested left coordinate.
		 * @param {number} top  Requested top coordinate.
		 * @return {void}
		 */
		function move_pinned_surface( left, top ) {
			if ( ! pinned || ! pin_to_viewport ) {
				return;
			}
			pinned_viewport_position = clamp_pinned_viewport_position( left, top );
			if ( tippy_instance && tippy_instance.popperInstance ) {
				tippy_instance.popperInstance.forceUpdate();
			}
		}

		/**
		 * Begin dragging an opted-in pinned surface from its accessible handle.
		 *
		 * @param {PointerEvent} event Pointer-down event on the drag handle.
		 * @return {void}
		 */
		function handle_pinned_drag_pointer_down( event ) {
			if ( ! pinned || ! draggable_when_pinned || ( Number.isFinite( event.button ) && 0 !== event.button ) ) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			active_drag = {
				pointer_id: event.pointerId,
				start_x: event.clientX,
				start_y: event.clientY,
				origin_left: pinned_viewport_position ? pinned_viewport_position.left : 0,
				origin_top: pinned_viewport_position ? pinned_viewport_position.top : 0
			};
			surface.setAttribute( 'data-wpbc-shared-ui-context-popover-dragging', 'true' );
			if ( drag_button.setPointerCapture && Number.isFinite( event.pointerId ) ) {
				try {
					drag_button.setPointerCapture( event.pointerId );
				} catch ( error ) {
					// Document listeners retain the gesture when capture is unavailable.
				}
			}
			document.addEventListener( 'pointermove', handle_pinned_drag_pointer_move, true );
			document.addEventListener( 'pointerup', finish_pinned_drag, true );
			document.addEventListener( 'pointercancel', finish_pinned_drag, true );
		}

		/**
		 * Move the pinned surface with the active pointer gesture.
		 *
		 * @param {PointerEvent} event Captured pointer movement.
		 * @return {void}
		 */
		function handle_pinned_drag_pointer_move( event ) {
			if ( ! active_drag || event.pointerId !== active_drag.pointer_id ) {
				return;
			}
			event.preventDefault();
			move_pinned_surface(
				active_drag.origin_left + event.clientX - active_drag.start_x,
				active_drag.origin_top + event.clientY - active_drag.start_y
			);
		}

		/**
		 * Move a pinned surface from the keyboard-accessible drag handle.
		 *
		 * Arrow keys move by ten pixels; Shift+Arrow provides one-pixel precision.
		 *
		 * @param {KeyboardEvent} event Drag-handle keyboard event.
		 * @return {void}
		 */
		function handle_pinned_drag_keydown( event ) {
			var offset_x = 0;
			var offset_y = 0;
			var distance = event.shiftKey ? 1 : 10;

			if ( ! pinned || ! draggable_when_pinned || ! pinned_viewport_position ) {
				return;
			}
			if ( 'ArrowLeft' === event.key ) {
				offset_x = -distance;
			} else if ( 'ArrowRight' === event.key ) {
				offset_x = distance;
			} else if ( 'ArrowUp' === event.key ) {
				offset_y = -distance;
			} else if ( 'ArrowDown' === event.key ) {
				offset_y = distance;
			} else {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			move_pinned_surface(
				pinned_viewport_position.left + offset_x,
				pinned_viewport_position.top + offset_y
			);
		}

		/**
		 * Report whether the surface currently uses right-to-left inline flow.
		 *
		 * The resize handle sits at the logical inline end, so RTL width changes
		 * keep the physical right edge fixed while the left edge moves.
		 *
		 * @return {boolean} True when the computed surface direction is RTL.
		 */
		function is_surface_right_to_left() {
			return 'rtl' === window.getComputedStyle( surface ).direction;
		}

		/**
		 * Stop the active pointer resize and release temporary document listeners.
		 *
		 * @param {PointerEvent} [event] Optional pointer completion event.
		 * @return {void}
		 */
		function finish_pinned_resize( event ) {
			var pointer_id;

			if ( ! active_resize ) {
				return;
			}
			if (
				event
				&& Number.isFinite( event.pointerId )
				&& event.pointerId !== active_resize.pointer_id
			) {
				return;
			}
			pointer_id = active_resize.pointer_id;
			document.removeEventListener( 'pointermove', handle_pinned_resize_pointer_move, true );
			document.removeEventListener( 'pointerup', finish_pinned_resize, true );
			document.removeEventListener( 'pointercancel', finish_pinned_resize, true );
			active_resize = null;
			surface.removeAttribute( 'data-wpbc-shared-ui-context-popover-resizing' );
			if (
				resize_button
				&& resize_button.hasPointerCapture
				&& resize_button.releasePointerCapture
				&& Number.isFinite( pointer_id )
				&& resize_button.hasPointerCapture( pointer_id )
			) {
				try {
					resize_button.releasePointerCapture( pointer_id );
				} catch ( error ) {
					// The user agent may already have released capture on pointerup.
				}
			}
		}

		/**
		 * Remove a user-selected pinned size and restore domain default dimensions.
		 *
		 * @return {void}
		 */
		function clear_pinned_surface_size() {
			pinned_viewport_size = null;
			surface.removeAttribute( 'data-wpbc-shared-ui-context-popover-resized' );
			surface.style.removeProperty( resized_width_property );
			surface.style.removeProperty( resized_height_property );
		}

		/**
		 * Commit a bounded size for one viewport-pinned surface.
		 *
		 * Width never exceeds the controller's configured maximum. Height and both
		 * dimensions remain within the Visual Viewport from the current pinned
		 * position. RTL resizing preserves the physical right edge because its
		 * logical resize handle is on the left.
		 *
		 * @param {number}  requested_width  Requested CSS-pixel width.
		 * @param {number}  requested_height Requested CSS-pixel height.
		 * @param {boolean} anchor_right     Whether to keep the physical right edge fixed.
		 * @return {boolean} True when a pinned size was committed.
		 */
		function resize_pinned_surface( requested_width, requested_height, anchor_right ) {
			var viewport_bounds;
			var surface_rect;
			var current_position;
			var minimum_left;
			var maximum_available_width;
			var maximum_available_height;
			var bounded_minimum_width;
			var bounded_minimum_height;
			var resized_width;
			var resized_height;
			var fixed_right;
			var resized_left;

			if ( ! pinned || ! pin_to_viewport || ! resizable_when_pinned ) {
				return false;
			}
			viewport_bounds = get_visual_viewport_bounds();
			surface_rect = surface.getBoundingClientRect();
			current_position = pinned_viewport_position || clamp_pinned_viewport_position( surface_rect.left, surface_rect.top );
			minimum_left = viewport_bounds.left + viewport_padding;
			fixed_right = current_position.left + Math.max( 1, surface_rect.width || preferred_width );
			maximum_available_width = anchor_right
				? fixed_right - minimum_left
				: viewport_bounds.right - viewport_padding - current_position.left;
			maximum_available_width = Math.max( 1, Math.min( maximum_resized_width, maximum_available_width ) );
			maximum_available_height = Math.max( 1, viewport_bounds.bottom - viewport_padding - current_position.top );
			bounded_minimum_width = Math.min( minimum_resized_width, maximum_available_width );
			bounded_minimum_height = Math.min( minimum_resized_height, maximum_available_height );
			requested_width = Number.isFinite( requested_width ) ? requested_width : surface_rect.width;
			requested_height = Number.isFinite( requested_height ) ? requested_height : surface_rect.height;
			resized_width = Math.min( maximum_available_width, Math.max( bounded_minimum_width, Math.round( requested_width ) ) );
			resized_height = Math.min( maximum_available_height, Math.max( bounded_minimum_height, Math.round( requested_height ) ) );
			resized_left = anchor_right ? fixed_right - resized_width : current_position.left;

			surface.style.setProperty( resized_width_property, resized_width + 'px' );
			surface.style.setProperty( resized_height_property, resized_height + 'px' );
			surface.setAttribute( 'data-wpbc-shared-ui-context-popover-resized', 'true' );
			pinned_viewport_size = {
				width: resized_width,
				height: resized_height
			};
			pinned_viewport_position = clamp_pinned_viewport_position( resized_left, current_position.top );
			if ( tippy_instance && tippy_instance.popperInstance ) {
				tippy_instance.popperInstance.forceUpdate();
			}

			return true;
		}

		/**
		 * Begin resizing an opted-in pinned surface from its corner control.
		 *
		 * @param {PointerEvent} event Pointer-down event on the resize control.
		 * @return {void}
		 */
		function handle_pinned_resize_pointer_down( event ) {
			var surface_rect;

			if ( ! pinned || ! resizable_when_pinned || ( Number.isFinite( event.button ) && 0 !== event.button ) ) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			surface_rect = surface.getBoundingClientRect();
			active_resize = {
				pointer_id: event.pointerId,
				start_x: event.clientX,
				start_y: event.clientY,
				origin_width: Math.max( 1, surface_rect.width || preferred_width ),
				origin_height: Math.max( 1, surface_rect.height || minimum_resized_height ),
				anchor_right: is_surface_right_to_left()
			};
			surface.setAttribute( 'data-wpbc-shared-ui-context-popover-resizing', 'true' );
			if ( resize_button.setPointerCapture && Number.isFinite( event.pointerId ) ) {
				try {
					resize_button.setPointerCapture( event.pointerId );
				} catch ( error ) {
					// Document listeners retain the gesture when capture is unavailable.
				}
			}
			document.addEventListener( 'pointermove', handle_pinned_resize_pointer_move, true );
			document.addEventListener( 'pointerup', finish_pinned_resize, true );
			document.addEventListener( 'pointercancel', finish_pinned_resize, true );
		}

		/**
		 * Resize the pinned surface with the active pointer gesture.
		 *
		 * @param {PointerEvent} event Captured pointer movement.
		 * @return {void}
		 */
		function handle_pinned_resize_pointer_move( event ) {
			var inline_delta;

			if ( ! active_resize || event.pointerId !== active_resize.pointer_id ) {
				return;
			}
			event.preventDefault();
			inline_delta = active_resize.anchor_right
				? active_resize.start_x - event.clientX
				: event.clientX - active_resize.start_x;
			resize_pinned_surface(
				active_resize.origin_width + inline_delta,
				active_resize.origin_height + event.clientY - active_resize.start_y,
				active_resize.anchor_right
			);
		}

		/**
		 * Resize a pinned surface from its keyboard-accessible corner control.
		 *
		 * Horizontal Arrow keys change width from the logical inline end. Vertical
		 * Arrow keys change height; Shift+Arrow provides one-pixel precision.
		 *
		 * @param {KeyboardEvent} event Resize-control keyboard event.
		 * @return {void}
		 */
		function handle_pinned_resize_keydown( event ) {
			var surface_rect;
			var width_delta = 0;
			var height_delta = 0;
			var distance = event.shiftKey ? 1 : 10;
			var anchor_right;

			if ( ! pinned || ! resizable_when_pinned ) {
				return;
			}
			anchor_right = is_surface_right_to_left();
			if ( 'ArrowLeft' === event.key ) {
				width_delta = anchor_right ? distance : -distance;
			} else if ( 'ArrowRight' === event.key ) {
				width_delta = anchor_right ? -distance : distance;
			} else if ( 'ArrowUp' === event.key ) {
				height_delta = -distance;
			} else if ( 'ArrowDown' === event.key ) {
				height_delta = distance;
			} else {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			surface_rect = surface.getBoundingClientRect();
			resize_pinned_surface(
				surface_rect.width + width_delta,
				surface_rect.height + height_delta,
				anchor_right
			);
		}

		/**
		 * Synchronize the optional neutral pin control.
		 *
		 * @return {void}
		 */
		function synchronize_pin_control() {
			var pin_label;

			if ( tippy_instance && tippy_instance.popper ) {
				if ( hide_arrow_when_pinned && pinned ) {
					tippy_instance.popper.setAttribute( 'data-wpbc-shared-ui-context-popover-hide-arrow', 'true' );
				} else {
					tippy_instance.popper.removeAttribute( 'data-wpbc-shared-ui-context-popover-hide-arrow' );
				}
			}

			if ( drag_button ) {
				drag_button.hidden = ! pinned;
				drag_button.disabled = ! pinned;
			}
			if ( resize_button ) {
				resize_button.hidden = ! pinned;
				resize_button.disabled = ! pinned;
			}
			surface.setAttribute( 'data-wpbc-shared-ui-context-popover-pinned', pinned ? 'true' : 'false' );
			if ( ! pin_button || ! pin_button_label ) {
				return;
			}
			pin_label = pinned
				? String( pin_button.getAttribute( 'data-pinned-label' ) || '' )
				: String( pin_button.getAttribute( 'data-pin-label' ) || '' );
			pin_button.setAttribute( 'aria-pressed', pinned ? 'true' : 'false' );
			pin_button.setAttribute(
				'aria-label',
				pinned
					? String( pin_button.getAttribute( 'data-unpin-label' ) || pin_label )
					: pin_label
			);
			pin_button_label.textContent = pin_label;
		}

		/**
		 * Change the neutral pin state for an opted-in controller.
		 *
		 * @param {boolean} should_pin Requested pin state.
		 * @return {boolean} True when the requested state is active.
		 */
		function set_pinned( should_pin ) {
			var popper_rect;

			should_pin = Boolean( should_pin );
			if ( destroyed || 'manual' !== pin_policy || ( should_pin && ! current_trigger ) ) {
				return false;
			}
			cancel_interaction_timers();
			if ( should_pin && ! pinned && pin_to_viewport && tippy_instance && tippy_instance.popper ) {
				popper_rect = tippy_instance.popper.getBoundingClientRect();
				pinned_viewport_position = clamp_pinned_viewport_position( popper_rect.left, popper_rect.top );
			}
			if ( ! should_pin ) {
				finish_pinned_drag();
				finish_pinned_resize();
				clear_pinned_surface_size();
			}
			pinned = should_pin;
			if ( pinned && current_trigger && ! pin_to_viewport ) {
				reference_rect_provider = create_trigger_reference_provider( current_trigger );
				reference_tracks_trigger = true;
				update_reference( reference_rect_provider );
			}
			if ( ! pinned ) {
				pinned_viewport_position = null;
			}
			apply_positioning_mode();
			synchronize_pin_control();
			schedule_surface_constraint_update();
			if ( 'function' === typeof settings.on_pin_change ) {
				settings.on_pin_change( controller, pinned );
			}
			if ( ! pinned && suspended ) {
				close_approved( false, 'programmatic' );
				return true;
			}
			if (
				! pinned
				&& ! suspended
				&& is_visible_controller( controller )
				&& ! pointer_inside_composite
				&& ! is_composite_node( document.activeElement )
			) {
				schedule_close();
			}

			return pinned === should_pin;
		}

		/**
		 * Report whether this controller currently retains pin identity.
		 *
		 * @return {boolean} True when pinned.
		 */
		function is_pinned() {
			return pinned;
		}

		/**
		 * Close after a bounded pointer corridor unless focus or pointer returned.
		 *
		 * @return {void}
		 */
		function schedule_close() {
			if ( destroyed || ! is_visible_controller( controller ) || ! tippy_instance.state.isVisible ) {
				return;
			}
			cancel_pending_close();
			pending_close_timer = window.setTimeout( function () {
				pending_close_timer = 0;
				if ( pointer_inside_composite || is_composite_node( document.activeElement ) || has_open_child_layers() ) {
					return;
				}
				request_close( 'pointer_exit', false );
			}, hide_delay_ms );
		}

		/**
		 * Record and optionally update trigger ARIA only after explicit ownership.
		 *
		 * Timeline booking cards do not grant this ownership because their ARIA
		 * relationship belongs to the Booking Inspector.
		 *
		 * @param {HTMLElement} trigger Trigger being opened.
		 * @return {void}
		 */
		function claim_trigger_aria( trigger ) {
			var requested_popup;

			if ( ! owns_trigger_aria || ! trigger ) {
				return;
			}
			if ( owned_trigger_aria && owned_trigger_aria.trigger === trigger ) {
				trigger.setAttribute( 'aria-expanded', 'true' );
				return;
			}
			owned_trigger_aria = {
				trigger: trigger,
				had_expanded: trigger.hasAttribute( 'aria-expanded' ),
				expanded: trigger.getAttribute( 'aria-expanded' ),
				had_haspopup: trigger.hasAttribute( 'aria-haspopup' ),
				haspopup: trigger.getAttribute( 'aria-haspopup' )
			};
			trigger.setAttribute( 'aria-expanded', 'true' );
			requested_popup = String( settings.aria_haspopup || '' );
			if ( -1 !== [ 'true', 'menu', 'listbox', 'tree', 'grid', 'dialog' ].indexOf( requested_popup ) ) {
				trigger.setAttribute( 'aria-haspopup', requested_popup );
			}
		}

		/**
		 * Release explicitly owned trigger ARIA without touching default consumers.
		 *
		 * @return {void}
		 */
		function release_trigger_aria() {
			var trigger;

			if ( ! owned_trigger_aria ) {
				return;
			}
			trigger = owned_trigger_aria.trigger;
			if ( trigger && trigger.isConnected ) {
				if ( owned_trigger_aria.had_expanded ) {
					trigger.setAttribute( 'aria-expanded', owned_trigger_aria.expanded );
				} else {
					trigger.removeAttribute( 'aria-expanded' );
				}
				if ( owned_trigger_aria.had_haspopup ) {
					trigger.setAttribute( 'aria-haspopup', owned_trigger_aria.haspopup );
				} else {
					trigger.removeAttribute( 'aria-haspopup' );
				}
			}
			owned_trigger_aria = null;
		}

		/**
		 * Find and focus the first enabled control inside this owned surface.
		 *
		 * @return {boolean} True when an owned control received focus.
		 */
		function focus_first_control() {
			var owner_selector = '[data-wpbc-shared-ui-context-popover-owner="' + component_id + '"]';
			var focusable_selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
			var owned_surfaces = document.querySelectorAll( owner_selector );
			var focused = false;

			Array.prototype.some.call( owned_surfaces, function ( owned_surface ) {
				return Array.prototype.some.call( owned_surface.querySelectorAll( focusable_selector ), function ( control ) {
					if ( control.hidden || control.closest( '[hidden], [aria-hidden="true"]' ) ) {
						return false;
					}
					control.focus();
					focused = document.activeElement === control;

					return focused;
				} );
			} );

			return focused;
		}

		/**
		 * Test the default or domain-supplied focus-entry keyboard command.
		 *
		 * @param {KeyboardEvent} event   Candidate keyboard event.
		 * @param {HTMLElement}  trigger Candidate trigger.
		 * @return {boolean} True when the event requests focus inside the popover.
		 */
		function is_focus_entry_command( event, trigger ) {
			if ( event && event.altKey && ! event.ctrlKey && ! event.metaKey && 'ArrowDown' === event.key ) {
				return true;
			}
			if ( 'function' === typeof settings.is_focus_entry_key ) {
				try {
					return true === settings.is_focus_entry_key( event, trigger, controller );
				} catch ( error ) {
					return false;
				}
			}

			return false;
		}

		/**
		 * Remove only this surface's accessible description token.
		 *
		 * @return {void}
		 */
		function remove_description() {
			var description_ids;

			if ( ! described_trigger ) {
				return;
			}
			description_ids = String( described_trigger.getAttribute( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( function ( description_id ) {
				return description_id && component_id !== description_id;
			} );
			if ( description_ids.length ) {
				described_trigger.setAttribute( 'aria-describedby', description_ids.join( ' ' ) );
			} else {
				described_trigger.removeAttribute( 'aria-describedby' );
			}
			described_trigger = null;
		}

		/**
		 * Add the preview surface as one description without replacing other IDs.
		 *
		 * @return {void}
		 */
		function add_description() {
			var description_ids;

			remove_description();
			if ( 'preview' !== mode || ! current_trigger ) {
				return;
			}
			description_ids = String( current_trigger.getAttribute( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
			if ( -1 === description_ids.indexOf( component_id ) ) {
				description_ids.push( component_id );
			}
			current_trigger.setAttribute( 'aria-describedby', description_ids.join( ' ' ) );
			described_trigger = current_trigger;
		}

		/**
		 * Hide all shell state hosts before activating one state.
		 *
		 * @return {void}
		 */
		function hide_state_hosts() {
			loading.hidden = true;
			content.hidden = true;
			empty.hidden = true;
			error.hidden = true;
		}

		/**
		 * Return the visible viewport's vertical bounds for fixed positioning.
		 *
		 * The Visual Viewport values keep the constraint correct during browser
		 * zoom without assigning the popover's actual coordinates.
		 *
		 * @return {Object} Numeric top and bottom viewport coordinates.
		 */
		function get_vertical_viewport_bounds() {
			var visual_viewport = window.visualViewport;
			var viewport_top = visual_viewport && Number.isFinite( visual_viewport.offsetTop )
				? visual_viewport.offsetTop
				: 0;
			var viewport_height = visual_viewport && Number.isFinite( visual_viewport.height )
				? visual_viewport.height
				: Math.max( document.documentElement.clientHeight || 0, window.innerHeight || 0 );

			return {
				top: viewport_top,
				bottom: viewport_top + viewport_height
			};
		}

		/**
		 * Resolve the vertical bounds used only for first-open side selection.
		 *
		 * Consumers with a clipped or sticky host may supply a live rectangle. The
		 * rectangle is intersected with the Visual Viewport so browser zoom remains
		 * authoritative. Invalid consumer output falls back to the viewport contract.
		 *
		 * @return {Object} Numeric top and bottom coordinates in viewport space.
		 */
		function get_initial_vertical_placement_bounds() {
			var viewport_bounds = get_vertical_viewport_bounds();
			var candidate_bounds;
			var candidate_rectangle;

			if ( ! get_initial_placement_bounds ) {
				return viewport_bounds;
			}
			try {
				candidate_rectangle = normalize_reference_rect( get_initial_placement_bounds() );
			} catch ( error ) {
				candidate_rectangle = null;
			}
			if ( ! candidate_rectangle ) {
				return viewport_bounds;
			}
			candidate_bounds = {
				top: Math.max( viewport_bounds.top, candidate_rectangle.top ),
				bottom: Math.min( viewport_bounds.bottom, candidate_rectangle.bottom )
			};

			return candidate_bounds.bottom > candidate_bounds.top ? candidate_bounds : viewport_bounds;
		}

		/**
		 * Measure the vertical room available on one reference side.
		 *
		 * Initial side selection uses the Visual Viewport intersected with an optional
		 * consumer-supplied visible host rectangle. The selected side is then retained
		 * while a scroll-owned host moves and clips the surface beneath sticky UI.
		 *
		 * @param {string} placement     Allow-listed Popper placement.
		 * @param {Object} reference_rect Normalized reference rectangle.
		 * @return {number} Available pixels, or negative infinity for a non-vertical side.
		 */
		function get_vertical_placement_space( placement, reference_rect ) {
			var placement_side = String( placement || '' ).split( '-' )[0];
			var visible_bounds = get_initial_vertical_placement_bounds();
			var reference_gap = 10;

			if ( 'bottom' === placement_side ) {
				return visible_bounds.bottom - reference_rect.bottom - reference_gap - viewport_padding;
			}
			if ( 'top' === placement_side ) {
				return reference_rect.top - reference_gap - visible_bounds.top - viewport_padding;
			}

			return Number.NEGATIVE_INFINITY;
		}

		/**
		 * Choose an allowed vertical side before the first Popper measurement.
		 *
		 * A fixed-height surface can make the requested side too short. In that
		 * case, allowing preventOverflow to translate the same placement would
		 * move the surface across its reference. Prefer a configured fallback that
		 * fits, or the side with the most room when neither side can fully fit.
		 * Popper remains responsible for exact coordinates, collision correction,
		 * and arrow alignment.
		 *
		 * @param {Object} reference_rect Normalized reference rectangle.
		 * @return {string} Requested or fallback allow-listed placement.
		 */
		function resolve_initial_placement( reference_rect ) {
			var requested_placement = normalize_placement( settings.placement );
			var requested_side = requested_placement.split( '-' )[0];
			var surface_rect;
			var required_height;
			var requested_space;
			var best_placement = requested_placement;
			var best_space;

			if (
				! fit_on_first_open
				|| pinned
				|| 0 >= fixed_unpinned_height
				|| -1 === [ 'top', 'bottom' ].indexOf( requested_side )
			) {
				return requested_placement;
			}
			surface_rect = surface.getBoundingClientRect();
			required_height = Math.max(
				fixed_unpinned_height,
				Number.isFinite( surface_rect.height ) ? surface_rect.height : 0
			);
			requested_space = get_vertical_placement_space( requested_placement, reference_rect );
			if ( requested_space >= required_height ) {
				return requested_placement;
			}
			best_space = requested_space;
			fallback_placements.some( function ( fallback_placement ) {
				var fallback_side = fallback_placement.split( '-' )[0];
				var fallback_space;

				if ( -1 === [ 'top', 'bottom' ].indexOf( fallback_side ) ) {
					return false;
				}
				fallback_space = get_vertical_placement_space( fallback_placement, reference_rect );
				if ( fallback_space > best_space ) {
					best_placement = fallback_placement;
					best_space = fallback_space;
				}
				return fallback_space >= required_height;
			} );

			return best_placement;
		}

		/**
		 * Bound the surface width to an opted-in host boundary and viewport.
		 *
		 * Popper remains responsible for coordinates. This method supplies only a
		 * CSS width limit so an oversized body portal cannot paint across a frozen
		 * sibling pane when the host's visible canvas is narrower than the preferred
		 * surface width.
		 *
		 * @return {void}
		 */
		function constrain_surface_to_positioning_boundary() {
			var boundary_rect;
			var visual_viewport = window.visualViewport;
			var viewport_left;
			var viewport_width;
			var visible_left;
			var visible_right;

			if ( ( pinned && pin_to_viewport ) || 'viewport' === positioning_boundary || ! positioning_boundary.isConnected ) {
				surface.style.removeProperty( available_inline_size_property );
				return;
			}
			boundary_rect = positioning_boundary.getBoundingClientRect();
			viewport_left = visual_viewport && Number.isFinite( visual_viewport.offsetLeft )
				? visual_viewport.offsetLeft
				: 0;
			viewport_width = visual_viewport && Number.isFinite( visual_viewport.width )
				? visual_viewport.width
				: Math.max( document.documentElement.clientWidth || 0, window.innerWidth || 0 );
			visible_left = Math.max( boundary_rect.left, viewport_left );
			visible_right = Math.min( boundary_rect.right, viewport_left + viewport_width );
			surface.style.setProperty(
				available_inline_size_property,
				Math.max( 1, Math.floor( visible_right - visible_left - ( 2 * viewport_padding ) ) ) + 'px'
			);
		}

		/**
		 * Remove a height retained from an earlier visible placement.
		 *
		 * @return {void}
		 */
		function clear_surface_height_constraint() {
			surface.style.removeProperty( available_height_property );
		}

		/**
		 * Include or exclude the Tippy root from layout and scrollable overflow.
		 *
		 * A hidden absolutely positioned root can otherwise retain stale transformed
		 * coordinates inside a scrolling portal and enlarge that portal's scrollable
		 * overflow after its domain content has been rerendered.
		 *
		 * @param {boolean} should_participate Whether the root may affect layout overflow.
		 * @return {void}
		 */
		function set_popper_layout_participation( should_participate ) {
			if ( ! tippy_instance || ! tippy_instance.popper ) {
				return;
			}
			if ( should_participate ) {
				tippy_instance.popper.removeAttribute( 'hidden' );
				return;
			}
			tippy_instance.popper.setAttribute( 'hidden', '' );
		}

		/**
		 * Return the base placement currently committed by Popper and Tippy.
		 *
		 * Tippy stores `data-placement` on its inner `.tippy-box`, not on the
		 * outer popper node. Popper state is authoritative; the DOM attributes
		 * remain compatibility fallbacks for versions that expose state later.
		 *
		 * @return {string} Base placement, or an empty string when unavailable.
		 */
		function get_current_placement() {
			var placement = '';
			var tippy_box;

			if (
				tippy_instance
				&& tippy_instance.popperInstance
				&& tippy_instance.popperInstance.state
			) {
				placement = String( tippy_instance.popperInstance.state.placement || '' );
			}
			if ( ! placement && tippy_instance && tippy_instance.popper ) {
				placement = String( tippy_instance.popper.getAttribute( 'data-popper-placement' ) || '' );
				tippy_box = tippy_instance.popper.querySelector( '.tippy-box[data-placement]' );
				if ( ! placement && tippy_box ) {
					placement = String( tippy_box.getAttribute( 'data-placement' ) || '' );
				}
			}

			return placement.split( '-' )[0];
		}

		/**
		 * Bound growing content to the space on its currently rendered side.
		 *
		 * The trigger-facing edge comes from the reference rectangle rather than a
		 * surface that Popper may already have translated to contain oversized
		 * content. This keeps the arrow attached and delegates overflow to the shell.
		 *
		 * @return {void}
		 */
		function constrain_surface_to_current_placement() {
			var placement;
			var reference_rect;
			var viewport_bounds;
			var available_height;
			var reference_gap = 10;

			if (
				! tippy_instance
				|| ! tippy_instance.state.isVisible
				|| ! tippy_instance.popper
				|| ! surface.getClientRects().length
			) {
				return;
			}
			if ( pinned && pin_to_viewport && pinned_viewport_position ) {
				viewport_bounds = get_vertical_viewport_bounds();
				available_height = viewport_bounds.bottom - viewport_bounds.top - ( 2 * viewport_padding );
				surface.style.setProperty(
					available_height_property,
					Math.max( 1, Math.floor( available_height ) ) + 'px'
				);
				move_pinned_surface( pinned_viewport_position.left, pinned_viewport_position.top );
				return;
			}
			placement = get_current_placement();
			if ( -1 === [ 'top', 'bottom', 'left', 'right' ].indexOf( placement ) ) {
				return;
			}
			reference_rect = get_reference_rect();
			viewport_bounds = get_vertical_viewport_bounds();
			if ( 'bottom' === placement ) {
				available_height = viewport_bounds.bottom - reference_rect.bottom - reference_gap - viewport_padding;
			} else if ( 'top' === placement ) {
				available_height = reference_rect.top - reference_gap - viewport_bounds.top - viewport_padding;
			} else {
				available_height = viewport_bounds.bottom - viewport_bounds.top - ( 2 * viewport_padding );
			}
			if ( 0 < available_height ) {
				surface.style.setProperty(
					available_height_property,
					Math.max( 1, Math.floor( available_height ) ) + 'px'
				);
			}
		}

		/**
		 * Cancel a queued post-layout viewport constraint.
		 *
		 * @return {void}
		 */
		function cancel_surface_constraint_update() {
			if ( pending_surface_constraint_frame ) {
				window.cancelAnimationFrame( pending_surface_constraint_frame );
				pending_surface_constraint_frame = 0;
			}
		}

		/**
		 * Recompute the surface limit after Popper has committed current geometry.
		 *
		 * State templates may be installed before the manual Tippy instance becomes
		 * visible. Batching the mounted, shown, replacement, and viewport paths into
		 * one animation frame prevents the first open from retaining the 100vh
		 * fallback and avoids repeated synchronous layout work.
		 *
		 * @return {void}
		 */
		function schedule_surface_constraint_update() {
			if ( destroyed || pending_surface_constraint_frame ) {
				return;
			}
			pending_surface_constraint_frame = window.requestAnimationFrame( function () {
				pending_surface_constraint_frame = 0;
				if ( destroyed || ! tippy_instance || ! tippy_instance.state.isVisible ) {
					return;
				}
				constrain_surface_to_positioning_boundary();
				if ( tippy_instance.popperInstance ) {
					tippy_instance.popperInstance.forceUpdate();
				}
				constrain_surface_to_current_placement();
				if ( tippy_instance.popperInstance ) {
					tippy_instance.popperInstance.forceUpdate();
				}
			} );
		}

		/**
		 * Commit a shell state and its polite announcement.
		 *
		 * @param {string}  next_state  Allow-listed shell state.
		 * @param {string}  announcement Plain localized announcement.
		 * @param {boolean} is_busy     Whether the shell remains busy.
		 * @return {void}
		 */
		function commit_state( next_state, announcement, is_busy ) {
			state = next_state;
			surface.setAttribute( 'data-wpbc-shared-ui-context-popover-state', next_state );
			surface.setAttribute( 'aria-busy', is_busy ? 'true' : 'false' );
			status.textContent = normalize_text( announcement, 500 );
			if ( tippy_instance && tippy_instance.popperInstance ) {
				tippy_instance.popperInstance.forceUpdate();
			}
			schedule_surface_constraint_update();
		}

		/**
		 * Show the neutral idle shell without state content.
		 *
		 * @param {string} announcement Optional localized announcement.
		 * @return {void}
		 */
		function set_idle( announcement ) {
			constrain_surface_to_current_placement();
			hide_state_hosts();
			content.textContent = '';
			commit_state( 'idle', announcement, false );
		}

		/**
		 * Show the loading state with a caller-owned localized label.
		 *
		 * @param {string} message Localized loading label.
		 * @return {void}
		 */
		function set_loading( message ) {
			message = normalize_text( message, 240 );
			constrain_surface_to_current_placement();
			hide_state_hosts();
			content.textContent = '';
			if ( loading_label && message ) {
				loading_label.textContent = message;
			}
			loading.hidden = false;
			commit_state( 'loading', message, true );
		}

		/**
		 * Show caller-rendered content from an allow-listed local template.
		 *
		 * The shared shell deliberately does not sanitize or authorize the supplied
		 * markup. Callers must render an authorized DTO through a fixed WordPress
		 * template before invoking this method.
		 *
		 * @param {string} rendered_content Locally rendered authorized markup.
		 * @param {string} announcement    Localized completion announcement.
		 * @return {void}
		 */
		function set_content( rendered_content, announcement ) {
			constrain_surface_to_current_placement();
			hide_state_hosts();
			content.innerHTML = String( rendered_content || '' );
			content.hidden = false;
			commit_state( 'content', announcement, false );
		}

		/**
		 * Update the stable shell heading without replacing shell controls.
		 *
		 * @param {string} title Plain localized title.
		 * @return {void}
		 */
		function set_title( title ) {
			title = normalize_text( title, 200 );
			if ( heading ) {
				heading.textContent = title;
			}
		}

		/**
		 * Replace the visible heading with caller-rendered domain header content.
		 *
		 * The shell-owned heading remains the accessible dialog name. The supplied
		 * markup must come from an allow-listed local WordPress template.
		 *
		 * @param {string} rendered_header Domain header markup.
		 * @param {string} accessible_title Plain localized dialog title.
		 * @return {void}
		 */
		function set_header( rendered_header, accessible_title ) {
			if ( ! heading || ! header_content ) {
				return;
			}
			heading.textContent = normalize_text( accessible_title, 200 ) || default_heading;
			heading.classList.add( 'wpbc_shared_ui_context_popover__heading--visually-hidden' );
			header_content.innerHTML = String( rendered_header || '' );
			header_content.hidden = false;
			schedule_surface_constraint_update();
		}

		/**
		 * Restore the shell's plain default heading.
		 *
		 * @param {string} accessible_title Optional replacement title.
		 * @return {void}
		 */
		function reset_header( accessible_title ) {
			if ( ! heading || ! header_content ) {
				return;
			}
			heading.textContent = normalize_text( accessible_title, 200 ) || default_heading;
			heading.classList.remove( 'wpbc_shared_ui_context_popover__heading--visually-hidden' );
			header_content.textContent = '';
			header_content.hidden = true;
			schedule_surface_constraint_update();
		}

		/**
		 * Report caller-owned partial work without replacing visible content.
		 *
		 * This neutral API exists for composite domain views whose known content
		 * must remain visible while one internal region loads. Domains remain
		 * responsible for setting aria-busy on the affected region itself.
		 *
		 * @param {boolean} is_busy      Whether partial work remains active.
		 * @param {string}  announcement Plain localized live announcement.
		 * @return {void}
		 */
		function set_busy( is_busy, announcement ) {
			surface.setAttribute( 'aria-busy', is_busy ? 'true' : 'false' );
			status.textContent = normalize_text( announcement, 500 );
			if ( tippy_instance && tippy_instance.popperInstance ) {
				tippy_instance.popperInstance.forceUpdate();
			}
			schedule_surface_constraint_update();
		}

		/**
		 * Show a plain-text empty state.
		 *
		 * @param {string} message Localized empty-state message.
		 * @return {void}
		 */
		function set_empty( message ) {
			var paragraph = empty.querySelector( 'p' );

			message = normalize_text( message, 500 );
			constrain_surface_to_current_placement();
			hide_state_hosts();
			content.textContent = '';
			if ( paragraph && message ) {
				paragraph.textContent = message;
			}
			empty.hidden = false;
			commit_state( 'empty', message, false );
		}

		/**
		 * Show a recoverable plain-text error and optional retry action.
		 *
		 * @param {string} message     Localized error message.
		 * @param {string} retry_label Localized retry label; empty hides retry.
		 * @return {void}
		 */
		function set_error( message, retry_label ) {
			message = normalize_text( message, 500 );
			retry_label = normalize_text( retry_label, 160 );
			constrain_surface_to_current_placement();
			hide_state_hosts();
			content.textContent = '';
			if ( error_message ) {
				error_message.textContent = message;
			}
			retry_button.hidden = ! retry_label || 'function' !== typeof settings.on_retry;
			if ( retry_label ) {
				retry_button.textContent = retry_label;
			}
			error.hidden = false;
			commit_state( 'error', message, false );
		}

		/**
		 * Open the shell against an explicit virtual-reference provider.
		 *
		 * @param {HTMLElement|null}    trigger                     Activating domain trigger.
		 * @param {Object|Function|null} reference_rect              DOMRect-like value or getter.
		 * @param {string}               requested_activation_method Internal activation-source label.
		 * @return {boolean} True when the open request was accepted.
		 */
		function open_with_reference( trigger, reference_rect, requested_activation_method ) {
			var initial_placement;
			var resolved_reference_rect;

			if ( destroyed || suspended || ! trigger || 1 !== trigger.nodeType || ! trigger.isConnected || ! can_use_trigger( trigger ) ) {
				return false;
			}
			if ( pinned && current_trigger && current_trigger !== trigger ) {
				return false;
			}
			resolved_reference_rect = resolve_open_reference_rect( reference_rect );
			if ( ! resolved_reference_rect ) {
				return false;
			}
			arbitrate_visible_controllers( controller );
			cancel_pending_close();
			if ( current_trigger && current_trigger !== trigger ) {
				remove_description();
				release_trigger_aria();
			}
			current_trigger = trigger;
			reference_rect_provider = reference_rect;
			reference_tracks_trigger = 'function' === typeof reference_rect;
			last_valid_reference_rect = resolved_reference_rect;
			activation_method = requested_activation_method;
			pointer_inside_composite = 'pointer' === requested_activation_method;
			initial_fit_pending = fit_on_first_open;
			initial_fit_captured = false;
			initial_fit_adjustment = {
				x: 0,
				y: 0
			};
			clear_surface_height_constraint();
			surface.hidden = false;
			set_popper_layout_participation( true );
			initial_placement = resolve_initial_placement( resolved_reference_rect );
			tippy_instance.setProps( {
				getReferenceClientRect: get_reference_rect,
				interactive: true,
				placement: initial_placement
			} );
			add_description();
			claim_trigger_aria( trigger );
			tippy_instance.show();
			register_visible_controller( controller );
			announce_layer_open();
			if ( 'function' === typeof settings.on_open ) {
				settings.on_open( controller, trigger );
			}

			return true;
		}

		/**
		 * Open against the trigger's live element rectangle.
		 *
		 * This general element-relative method never reads remembered pointer
		 * coordinates. Keyboard activation delegates to the same live getter.
		 *
		 * @param {HTMLElement|null} trigger Activating domain trigger.
		 * @return {boolean} True when the open request was accepted.
		 */
		function open( trigger ) {
			cancel_pending_open();

			return open_with_reference( trigger, create_trigger_reference_provider( trigger ), 'element' );
		}

		/**
		 * Open from keyboard focus using the trigger's current rectangle.
		 *
		 * @param {HTMLElement|null} trigger Focused domain trigger.
		 * @return {boolean} True when the open request was accepted.
		 */
		function open_keyboard( trigger ) {
			cancel_pending_open();
			if ( suppressed_focus_trigger === trigger ) {
				suppressed_focus_trigger = null;
				return false;
			}

			return open_with_reference( trigger, create_trigger_reference_provider( trigger ), 'keyboard' );
		}

		/**
		 * Move focus from a trigger into the first owned popover control.
		 *
		 * Domains may delegate keydown events to this method. Alt+ArrowDown is
		 * always supported; `is_focus_entry_key` may add one domain command.
		 *
		 * @param {HTMLElement|null} trigger Trigger receiving the keyboard event.
		 * @param {KeyboardEvent}     event   Trigger keyboard event.
		 * @return {boolean} True when the command was recognized.
		 */
		function handle_trigger_keydown( trigger, event ) {
			if ( destroyed || ! trigger || ! event || ! can_use_trigger( trigger ) || ! is_focus_entry_command( event, trigger ) ) {
				return false;
			}
			event.preventDefault();
			event.stopPropagation();
			if ( current_trigger !== trigger || ! tippy_instance.state.isVisible ) {
				open_keyboard( trigger );
			}
			if ( pending_focus_entry_timer ) {
				window.clearTimeout( pending_focus_entry_timer );
			}
			pending_focus_entry_timer = window.setTimeout( function () {
				pending_focus_entry_timer = 0;
				if ( is_visible_controller( controller ) && tippy_instance.state.isVisible ) {
					focus_first_control();
				}
			}, 0 );

			return true;
		}

		/**
		 * Schedule pointer activation and resolve its reference at delay expiry.
		 *
		 * @param {HTMLElement|null} trigger Activating domain trigger.
		 * @param {PointerEvent}     event   Initial pointer event.
		 * @return {boolean} True when a valid delayed open was scheduled.
		 */
		function schedule_pointer_open( trigger, event ) {
			if (
				destroyed
				|| ! trigger
				|| 1 !== trigger.nodeType
				|| ! trigger.isConnected
				|| ! can_use_trigger( trigger )
				|| ! event
				|| ! Number.isFinite( event.clientX )
				|| ! Number.isFinite( event.clientY )
			) {
				return false;
			}
			if ( is_visible_controller( controller ) && current_trigger === trigger && tippy_instance.state.isVisible ) {
				pointer_inside_composite = true;
				cancel_pending_close();
				return true;
			}

			cancel_pending_open();
			pending_pointer_trigger = trigger;
			pending_pointer_id = Number.isFinite( event.pointerId ) ? event.pointerId : null;
			latest_pointer_coordinates = {
				x: event.clientX,
				y: event.clientY
			};
			document.addEventListener( 'pointermove', capture_pending_pointer, true );
			trigger.addEventListener( 'pointerleave', cancel_pending_open );
			pending_show_timer = window.setTimeout( function () {
				var delayed_trigger = pending_pointer_trigger;
				var frozen_pointer = latest_pointer_coordinates;

				cancel_pending_open();
				if ( ! delayed_trigger || ! frozen_pointer ) {
					return;
				}
				open_with_reference(
					delayed_trigger,
					'function' === typeof settings.get_reference_rect
						? create_trigger_reference_provider( delayed_trigger )
						: create_pointer_reference_rect( delayed_trigger, frozen_pointer.x, frozen_pointer.y, pointer_anchor ),
					'pointer'
				);
			}, show_delay_ms );

			return true;
		}

		/**
		 * Finalize an approved close after policy has accepted its reason.
		 *
		 * @param {boolean} restore_focus Whether focus returns to the trigger.
		 * @param {string}  reason        Normalized approved close reason.
		 * @return {void}
		 */
		function finalize_close( restore_focus, reason ) {
			var focus_target = current_trigger;
			var had_owned_state;
			var should_restore;

			had_owned_state = Boolean(
				pending_show_timer
				|| current_trigger
				|| tippy_instance.state.isVisible
				|| is_visible_controller( controller )
				|| suspended
			);
			cancel_interaction_timers();
			if ( ! had_owned_state ) {
				return;
			}
			should_restore = Boolean( restore_focus && focus_target && focus_target.isConnected );
			remove_description();
			release_trigger_aria();
			unregister_visible_controller( controller );
			pointer_inside_composite = false;
			finish_pinned_drag();
			finish_pinned_resize();
			clear_pinned_surface_size();
			pinned = false;
			pinned_viewport_position = null;
			initial_fit_pending = false;
			initial_fit_captured = false;
			suspended = false;
			suspension_reason = '';
			external_suspension_hold = false;
			suspending_layers = {};
			synchronize_pin_control();
			apply_positioning_mode();
			surface.removeAttribute( 'data-wpbc-shared-ui-context-popover-suspended' );
			current_trigger = null;
			reference_rect_provider = null;
			reference_tracks_trigger = false;
			last_valid_reference_rect = null;
			activation_method = 'none';
			open_child_layers = {};
			announce_layer_close();
			if ( should_restore && 'function' === typeof focus_target.focus ) {
				suppressed_focus_trigger = focus_target;
				if ( suppressed_focus_timer ) {
					window.clearTimeout( suppressed_focus_timer );
				}
				focus_target.focus();
				suppressed_focus_timer = window.setTimeout( function () {
					suppressed_focus_trigger = null;
					suppressed_focus_timer = 0;
				}, 0 );
			}
			if ( 'function' === typeof settings.on_close ) {
				settings.on_close( controller, reason );
			}
		}

		/**
		 * Close the owned Tippy instance after policy approval.
		 *
		 * @param {boolean} restore_focus Whether focus returns to the trigger.
		 * @param {string}  reason        Normalized approved close reason.
		 * @return {void}
		 */
		function close_approved( restore_focus, reason ) {
			if ( tippy_instance.state.isVisible ) {
				approved_tippy_hide_reason = reason;
				tippy_instance.hide();
				if ( approved_tippy_hide_reason === reason ) {
					approved_tippy_hide_reason = '';
				}
			}
			finalize_close( restore_focus, reason );
		}

		/**
		 * Request a reasoned close before mutating owned lifecycle state.
		 *
		 * Automatic reasons are rejected while pinned. Explicit and authority
		 * reasons remain available. Suspension reasons retain an opted-in pin.
		 *
		 * @param {string}  reason        Dismissal or suspension reason.
		 * @param {boolean} restore_focus Whether focus returns to the trigger.
		 * @return {boolean} True when the request was accepted.
		 */
		function request_close( reason, restore_focus ) {
			reason = normalize_close_reason( reason );
			if ( destroyed || ! reason ) {
				return false;
			}
			if ( 'explicit' === dismiss_policy && is_automatic_close_reason( reason ) ) {
				return false;
			}
			if (
				'retain' === external_scroll_policy
				&& 'pointer_exit' === reason
				&& Date.now() < retained_scroll_until
			) {
				return false;
			}
			if ( pinned && -1 !== suspension_reasons.indexOf( reason ) ) {
				return suspend( reason );
			}
			if ( pinned && is_automatic_close_reason( reason ) ) {
				return false;
			}
			close_approved( Boolean( restore_focus ), reason );

			return true;
		}

		/**
		 * Preserve compatibility for existing explicit controller consumers.
		 *
		 * @param {boolean} restore_focus Whether focus returns to the trigger.
		 * @return {void}
		 */
		function close( restore_focus ) {
			request_close( 'programmatic', restore_focus );
		}

		/**
		 * Temporarily hide an opted-in pinned surface without clearing identity.
		 *
		 * @param {string}  reason                Neutral suspension reason.
		 * @param {boolean} [layer_owned=false] True when a shared layer owns the hold.
		 * @return {boolean} True when the pinned identity was retained.
		 */
		function suspend( reason, layer_owned ) {
			reason = normalize_close_reason( reason );
			if (
				destroyed
				|| ! pinned
				|| -1 === suspension_reasons.indexOf( reason )
				|| ! current_trigger
			) {
				return false;
			}
			if ( ! layer_owned ) {
				external_suspension_hold = true;
			}
			cancel_interaction_timers();
			if ( suspended ) {
				if ( 'reference_refresh' === reason ) {
					suspension_reason = reason;
					surface.setAttribute( 'data-wpbc-shared-ui-context-popover-suspended', reason );
				}
				return true;
			}
			suspended = true;
			suspension_reason = reason;
			surface.setAttribute( 'data-wpbc-shared-ui-context-popover-suspended', reason );
			remove_description();
			release_trigger_aria();
			unregister_visible_controller( controller );
			approved_tippy_hide_reason = reason;
			tippy_instance.hide();
			if ( approved_tippy_hide_reason === reason ) {
				approved_tippy_hide_reason = '';
			}
			announce_layer_close();
			if ( 'function' === typeof settings.on_suspend ) {
				settings.on_suspend( controller, reason );
			}

			return true;
		}

		/**
		 * Restore a safely retained pinned surface after blocking ownership ends.
		 *
		 * @param {boolean} [release_external_hold=true] True to release an adapter hold.
		 * @return {boolean} True when the surface resumed.
		 */
		function resume( release_external_hold ) {
			var resolved_reference_rect;

			if ( false !== release_external_hold ) {
				external_suspension_hold = false;
			}
			if (
				destroyed
				|| ! pinned
				|| ! suspended
				|| external_suspension_hold
				|| Object.keys( suspending_layers ).length
				|| ! current_trigger
				|| ! current_trigger.isConnected
			) {
				return false;
			}
			resolved_reference_rect = resolve_open_reference_rect( reference_rect_provider, pin_to_viewport );
			if ( ! resolved_reference_rect ) {
				return false;
			}
			last_valid_reference_rect = resolved_reference_rect;
			suspended = false;
			suspension_reason = '';
			surface.removeAttribute( 'data-wpbc-shared-ui-context-popover-suspended' );
			surface.hidden = false;
			set_popper_layout_participation( true );
			tippy_instance.setProps( {
				getReferenceClientRect: get_reference_rect,
				interactive: true,
				placement: normalize_placement( settings.placement )
			} );
			add_description();
			claim_trigger_aria( current_trigger );
			tippy_instance.show();
			register_visible_controller( controller );
			announce_layer_open();
			if ( 'function' === typeof settings.on_resume ) {
				settings.on_resume( controller, current_trigger );
			}

			return true;
		}

		/**
		 * Rebind retained identity to a replacement domain trigger.
		 *
		 * The domain remains responsible for proving that the replacement trigger
		 * has the same authorized meaning. Shared code validates only DOM ownership
		 * and reference geometry.
		 *
		 * @param {HTMLElement|null}    trigger        Replacement trigger.
		 * @param {Object|Function|null} reference_rect Optional reference provider.
		 * @return {boolean} True when rebinding succeeded.
		 */
		function rebind_trigger( trigger, reference_rect ) {
			var requested_reference = reference_rect || create_trigger_reference_provider( trigger );
			var resolved_reference_rect;

			if (
				destroyed
				|| ! current_trigger
				|| ! trigger
				|| 1 !== trigger.nodeType
				|| ! trigger.isConnected
				|| ! can_use_trigger( trigger )
			) {
				return false;
			}
			resolved_reference_rect = resolve_open_reference_rect( requested_reference, pinned && pin_to_viewport );
			if (
				! resolved_reference_rect
				&& ! (
					'strict_live_owner' === reference_policy
					&& pinned
					&& suspended
				)
			) {
				return false;
			}
			cancel_interaction_timers();
			remove_description();
			release_trigger_aria();
			current_trigger = trigger;
			reference_rect_provider = requested_reference;
			reference_tracks_trigger = 'function' === typeof requested_reference;
			last_valid_reference_rect = resolved_reference_rect;
			if ( ! suspended ) {
				add_description();
				claim_trigger_aria( trigger );
				update_reference();
			}
			if ( 'function' === typeof settings.on_rebind ) {
				settings.on_rebind( controller, trigger );
			}

			return true;
		}

		/**
		 * Recalculate the current Popper position after caller-owned content or
		 * reference geometry changes.
		 *
		 * @param {Object|Function|null} reference_rect Optional replacement getter.
		 * @return {boolean} True when a current live reference was measured.
		 */
		function update_reference( reference_rect ) {
			var resolved_reference_rect;

			if ( reference_rect ) {
				reference_rect_provider = reference_rect;
				reference_tracks_trigger = 'function' === typeof reference_rect;
			}
			resolved_reference_rect = resolve_open_reference_rect( reference_rect_provider, pinned && pin_to_viewport );
			if ( ! resolved_reference_rect ) {
				if ( 'strict_live_owner' === reference_policy ) {
					last_valid_reference_rect = null;
					if ( pinned ) {
						suspend( 'reference_unavailable' );
					} else {
						request_close( 'external_scroll', false );
					}
				}

				return false;
			}
			last_valid_reference_rect = resolved_reference_rect;
			if ( tippy_instance.popperInstance ) {
				tippy_instance.popperInstance.forceUpdate();
			}
			schedule_surface_constraint_update();

			return true;
		}

		/**
		 * Refresh only the neutral viewport constraint after viewport geometry moves.
		 *
		 * @return {void}
		 */
		function handle_viewport_geometry_change() {
			if ( is_visible_controller( controller ) ) {
				if ( pinned && pin_to_viewport && pinned_viewport_position ) {
					if ( pinned_viewport_size ) {
						resize_pinned_surface( pinned_viewport_size.width, pinned_viewport_size.height, false );
					}
					move_pinned_surface( pinned_viewport_position.left, pinned_viewport_position.top );
					schedule_surface_constraint_update();
				} else if ( 'strict_live_owner' === reference_policy ) {
					update_reference();
				} else {
					schedule_surface_constraint_update();
				}
			}
		}

		/**
		 * Pin the surface while the pointer is anywhere in the composite region.
		 *
		 * @param {PointerEvent} event Pointer-over event.
		 * @return {void}
		 */
		function handle_document_pointer_over( event ) {
			if ( ! is_visible_controller( controller ) || ! is_composite_node( event.target ) ) {
				return;
			}
			pointer_inside_composite = true;
			cancel_pending_close();
		}

		/**
		 * Start the pointer corridor delay after leaving the complete region.
		 *
		 * @param {PointerEvent} event Pointer-out event.
		 * @return {void}
		 */
		function handle_document_pointer_out( event ) {
			if (
				! is_visible_controller( controller )
				|| ! is_composite_node( event.target )
				|| is_composite_node( event.relatedTarget )
			) {
				return;
			}
			pointer_inside_composite = false;
			schedule_close();
		}

		/**
		 * Close before an outside pointer action without cancelling that action.
		 *
		 * @param {PointerEvent} event Captured pointer-down event.
		 * @return {void}
		 */
		function handle_document_pointer_down( event ) {
			if ( is_clipped_title_tooltip_target( event.target ) ) {
				return;
			}
			if (
				( is_visible_controller( controller ) || pending_show_timer )
				&& ! is_composite_node( event.target )
			) {
				request_close( 'outside_pointer', false );
			}
		}

		/**
		 * Pin the surface whenever focus enters any composite-region control.
		 *
		 * @param {FocusEvent} event Focus-in event.
		 * @return {void}
		 */
		function handle_document_focus_in( event ) {
			if ( ! is_visible_controller( controller ) || ! is_composite_node( event.target ) ) {
				return;
			}
			if ( pending_focus_check_timer ) {
				window.clearTimeout( pending_focus_check_timer );
				pending_focus_check_timer = 0;
			}
			if ( pending_focus_entry_timer ) {
				window.clearTimeout( pending_focus_entry_timer );
				pending_focus_entry_timer = 0;
			}
			cancel_pending_close();
		}

		/**
		 * Close after focus has settled outside the complete composite region.
		 *
		 * @param {FocusEvent} event Focus-out event.
		 * @return {void}
		 */
		function handle_document_focus_out( event ) {
			if ( ! is_visible_controller( controller ) || ! is_composite_node( event.target ) ) {
				return;
			}
			if ( pending_focus_check_timer ) {
				window.clearTimeout( pending_focus_check_timer );
			}
			pending_focus_check_timer = window.setTimeout( function () {
				pending_focus_check_timer = 0;
				if ( is_visible_controller( controller ) && ! is_composite_node( document.activeElement ) ) {
					request_close( 'outside_focus', false );
				}
			}, 0 );
		}

		/**
		 * Retain an opted-in surface while external scrolling changes geometry.
		 *
		 * The short grace period prevents a synthetic pointer exit caused only by
		 * moving content beneath a stationary pointer from closing the surface.
		 * Explicit outside-pointer, focus, Close, and Escape paths remain active.
		 *
		 * @return {void}
		 */
		function retain_during_external_scroll() {
			retained_scroll_until = Date.now() + external_scroll_grace_ms;
			cancel_pending_open();
			cancel_pending_close();
			if ( is_visible_controller( controller ) ) {
				schedule_surface_constraint_update();
			}
		}

		/**
		 * Apply the configured policy to a scroll outside the owned surface.
		 *
		 * @param {Event} event Captured scroll event.
		 * @return {void}
		 */
		function handle_document_scroll( event ) {
			if ( is_popover_owned_node( event.target ) ) {
				return;
			}
			if ( is_visible_controller( controller ) || pending_show_timer ) {
				if ( 'retain' === external_scroll_policy ) {
					retain_during_external_scroll();
					return;
				}
				if ( ! request_close( 'external_scroll', false ) && pinned && 'strict_live_owner' === reference_policy ) {
					update_reference();
				}
			}
		}

		/**
		 * Apply the configured policy when the document viewport itself scrolls.
		 *
		 * @return {void}
		 */
		function handle_window_scroll() {
			if ( is_visible_controller( controller ) || pending_show_timer ) {
				if ( 'retain' === external_scroll_policy ) {
					retain_during_external_scroll();
					return;
				}
				if ( ! request_close( 'external_scroll', false ) && pinned && 'strict_live_owner' === reference_policy ) {
					update_reference();
				}
			}
		}

		/**
		 * Prevent surface activation from reaching unrelated document consumers.
		 *
		 * Target controls still receive their native event and local handlers.
		 * External owned portals remain unstopped because their widgets may require
		 * document delegation and their body portal is outside the Timeline subtree.
		 *
		 * @param {Event} event Pointer-down or click event.
		 * @return {void}
		 */
		function handle_owned_activation( event ) {
			if ( is_visible_controller( controller ) && is_popover_owned_node( event.target ) ) {
				event.stopPropagation();
			}
		}

		/**
		 * Destroy only this component's surface, Tippy sentinel, and listeners.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( destroyed ) {
				return;
			}
			request_close( 'destroy', false );
			cancel_interaction_timers();
			cancel_surface_constraint_update();
			finish_pinned_drag();
			finish_pinned_resize();
			clear_pinned_surface_size();
			destroyed = true;
			remove_description();
			release_trigger_aria();
			surface.removeEventListener( 'click', handle_surface_click );
			surface.removeEventListener( 'pointerdown', handle_owned_activation );
			if ( drag_button ) {
				drag_button.removeEventListener( 'pointerdown', handle_pinned_drag_pointer_down );
				drag_button.removeEventListener( 'keydown', handle_pinned_drag_keydown );
			}
			if ( resize_button ) {
				resize_button.removeEventListener( 'pointerdown', handle_pinned_resize_pointer_down );
				resize_button.removeEventListener( 'keydown', handle_pinned_resize_keydown );
			}
			document.removeEventListener( 'keydown', handle_document_keydown, true );
			document.removeEventListener( 'pointerover', handle_document_pointer_over, true );
			document.removeEventListener( 'pointerout', handle_document_pointer_out, true );
			document.removeEventListener( 'pointerdown', handle_document_pointer_down, true );
			document.removeEventListener( 'focusin', handle_document_focus_in, true );
			document.removeEventListener( 'focusout', handle_document_focus_out, true );
			document.removeEventListener( 'scroll', handle_document_scroll, true );
			document.removeEventListener( layer_open_event, handle_layer_open );
			document.removeEventListener( layer_close_event, handle_layer_close );
			window.removeEventListener( 'scroll', handle_window_scroll );
			window.removeEventListener( 'resize', handle_viewport_geometry_change );
			if ( window.visualViewport ) {
				window.visualViewport.removeEventListener( 'resize', handle_viewport_geometry_change );
				window.visualViewport.removeEventListener( 'scroll', handle_viewport_geometry_change );
			}
			tippy_instance.destroy();
			if ( sentinel.parentNode ) {
				sentinel.parentNode.removeChild( sentinel );
			}
			unregister_visible_controller( controller );
			delete registered_controllers[ component_id ];
			current_trigger = null;
			reference_rect_provider = null;
			reference_tracks_trigger = false;
			last_valid_reference_rect = null;
			activation_method = 'none';
			pointer_inside_composite = false;
			suppressed_focus_trigger = null;
			registered_child_layers = {};
			open_child_layers = {};
			suspending_layers = {};
		}

		/**
		 * Handle shared close and recoverable-error controls.
		 *
		 * @param {MouseEvent} event Surface click event.
		 * @return {void}
		 */
		function handle_surface_click( event ) {
			event.stopPropagation();
			if ( event.target.closest( '[data-wpbc-shared-ui-context-popover-pin]' ) ) {
				event.preventDefault();
				set_pinned( ! pinned );
				return;
			}
			if ( event.target.closest( '[data-wpbc-shared-ui-context-popover-close]' ) ) {
				event.preventDefault();
				request_close( 'explicit_close', true );
				return;
			}
			if ( event.target.closest( '[data-wpbc-shared-ui-context-popover-retry]' ) && 'function' === typeof settings.on_retry ) {
				event.preventDefault();
				settings.on_retry( controller );
			}
		}

		/**
		 * Close only the active owned surface when Escape is pressed.
		 *
		 * @param {KeyboardEvent} event Document keyboard event.
		 * @return {void}
		 */
		function handle_document_keydown( event ) {
			if (
				'Escape' === event.key
				&& get_escape_controller( event.target ) === controller
				&& tippy_instance.state.isVisible
			) {
				event.preventDefault();
				event.stopImmediatePropagation();
				request_close( 'escape', true );
			}
		}

		tippy_instance = window.wpbc_tippy( sentinel, {
			allowHTML: true,
			arrow: true,
			appendTo: function () {
				return portal_host;
			},
			aria: {
				content: null,
				expanded: false
			},
			content: surface,
			duration: [ 120, 0 ],
			getReferenceClientRect: get_reference_rect,
			hideOnClick: false,
			interactive: true,
			interactiveBorder: 10,
			interactiveDebounce: 30,
			maxWidth: maximum_width,
			offset: [ 0, 10 ],
			placement: normalize_placement( settings.placement ),
			popperOptions: {
				strategy: positioning_strategy,
				modifiers: popper_modifiers
			},
			role: null,
			showOnCreate: false,
			theme: 'wpbc-shared-ui-context-popover',
			touch: false,
			trigger: 'manual',
			zIndex: layer_z_index,
			onHide: function () {
				var approved_reason = approved_tippy_hide_reason;

				if ( approved_reason ) {
					approved_tippy_hide_reason = '';
					return true;
				}
				if ( pinned ) {
					return false;
				}
				finalize_close( false, 'uncontrolled_library_hide' );

				return true;
			},
			onMount: function () {
				schedule_surface_constraint_update();
			},
			onShown: function () {
				schedule_surface_constraint_update();
			},
			onHidden: function () {
				cancel_surface_constraint_update();
				surface.hidden = true;
				set_popper_layout_participation( false );
				clear_surface_height_constraint();
			}
		} );

		if ( ! tippy_instance ) {
			if ( sentinel.parentNode ) {
				sentinel.parentNode.removeChild( sentinel );
			}
			return null;
		}

		surface.addEventListener( 'click', handle_surface_click );
		surface.addEventListener( 'pointerdown', handle_owned_activation );
		if ( drag_button ) {
			drag_button.addEventListener( 'pointerdown', handle_pinned_drag_pointer_down );
			drag_button.addEventListener( 'keydown', handle_pinned_drag_keydown );
		}
		if ( resize_button ) {
			resize_button.addEventListener( 'pointerdown', handle_pinned_resize_pointer_down );
			resize_button.addEventListener( 'keydown', handle_pinned_resize_keydown );
		}
		document.addEventListener( 'keydown', handle_document_keydown, true );
		document.addEventListener( 'pointerover', handle_document_pointer_over, true );
		document.addEventListener( 'pointerout', handle_document_pointer_out, true );
		document.addEventListener( 'pointerdown', handle_document_pointer_down, true );
		document.addEventListener( 'focusin', handle_document_focus_in, true );
		document.addEventListener( 'focusout', handle_document_focus_out, true );
		document.addEventListener( 'scroll', handle_document_scroll, true );
		document.addEventListener( layer_open_event, handle_layer_open );
		document.addEventListener( layer_close_event, handle_layer_close );
		window.addEventListener( 'scroll', handle_window_scroll, { passive: true } );
		window.addEventListener( 'resize', handle_viewport_geometry_change, { passive: true } );
		if ( window.visualViewport ) {
			window.visualViewport.addEventListener( 'resize', handle_viewport_geometry_change, { passive: true } );
			window.visualViewport.addEventListener( 'scroll', handle_viewport_geometry_change, { passive: true } );
		}
		set_idle( '' );

		controller = {
			open: open,
			open_keyboard: open_keyboard,
			handle_trigger_keydown: handle_trigger_keydown,
			focus_first_control: focus_first_control,
			schedule_pointer_open: schedule_pointer_open,
			cancel_pending_open: cancel_pending_open,
			cancel_pending_close: cancel_pending_close,
			register_child_layer: register_child_layer,
			unregister_child_layer: unregister_child_layer,
			can_use_trigger: can_use_trigger,
			close: close,
			request_close: request_close,
			set_pinned: set_pinned,
			is_pinned: is_pinned,
			suspend: suspend,
			resume: resume,
			rebind_trigger: rebind_trigger,
			destroy: destroy,
			set_idle: set_idle,
			set_loading: set_loading,
			set_content: set_content,
			set_title: set_title,
			set_header: set_header,
			reset_header: reset_header,
			set_busy: set_busy,
			set_empty: set_empty,
			set_error: set_error,
			update_reference: update_reference,
			get_state: function () {
				return state;
			},
			get_mode: function () {
				return mode;
			},
			get_surface: function () {
				return surface;
			},
			get_activation_method: function () {
				return activation_method;
			},
			get_reference_rect: function () {
				return get_reference_rect();
			},
			is_open: function () {
				return Boolean( tippy_instance.state.isVisible );
			},
			is_suspended: function () {
				return suspended;
			},
			get_suspension_reason: function () {
				return suspension_reason;
			},
			owns_node: function ( candidate ) {
				return is_composite_node( candidate );
			},
			can_handle_escape: function () {
				return Boolean(
					is_visible_controller( controller )
					&& tippy_instance.state.isVisible
					&& ! has_open_child_layers()
				);
			}
		};
		synchronize_pin_control();
		registered_controllers[ component_id ] = controller;

		return controller;
	}

	/**
	 * Close the active shared Context Popover, if any.
	 *
	 * @param {boolean} restore_focus Whether an interactive surface restores focus.
	 * @return {void}
	 */
	function close_active( restore_focus ) {
		if ( active_controller ) {
			active_controller.request_close( 'programmatic', Boolean( restore_focus ) );
		}
	}

	api.create = create;
	api.register = create;
	api.close_active = close_active;
	api.notify_layer_open = function ( descriptor ) {
		return dispatch_layer_event( layer_open_event, descriptor );
	};
	api.notify_layer_close = function ( descriptor ) {
		return dispatch_layer_event( layer_close_event, descriptor );
	};
	window.wpbc_shared_ui_context_popover = api;
}( window, document, window.wp ) );
