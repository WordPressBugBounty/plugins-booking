/**
 * Timeline booking selection, control rails, Inspector, and Overview adapter.
 *
 * The module owns browser-only booking interaction state and geometry. Timeline
 * continues to own authorized window reads and rendering, while the Booking
 * Inspector and Booking Overview domains remain authoritative for their DTOs,
 * requests, templates, focus lifecycles, and permissions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var module_id = 'booking_interactions';
	var extension_factories = [];

	/**
	 * Register one domain-owned booking-interaction extension factory.
	 *
	 * The shared controller owns only lifecycle fan-out. Factories retain their
	 * own data, authorization, rendering, and interaction rules. Duplicate
	 * registration of the same function is idempotent.
	 *
	 * @param {Function} extension_factory Factory receiving neutral host context.
	 * @return {boolean} True when the factory is available to future controllers.
	 */
	function register_extension_factory( extension_factory ) {
		if ( 'function' !== typeof extension_factory ) {
			return false;
		}
		if ( -1 === extension_factories.indexOf( extension_factory ) ) {
			extension_factories.push( extension_factory );
		}

		return true;
	}

	window.wpbc_timeline_booking_interactions = {
		register_extension_factory: register_extension_factory
	};

	/**
	 * Create one booking-interactions controller for a Timeline mount.
	 *
	 * @param {Object} context Timeline-owned mount, settings, and bounded callbacks.
	 * @return {Object} Booking interaction lifecycle and delegation API.
	 */
	function create_booking_interactions_controller( context ) {
		var mount = context.mount || null;
		var settings = context.settings || {};
		var booking_inspector_adapter = null;
		var booking_overview_tooltip_controller = null;
		var booking_resizing_controller = null;
		var extension_controllers = [];
		var suspended_booking_overflow_tooltips = [];
		var booking_selection_state = create_empty_booking_selection_state();
		var booking_inspector_refresh_generation = 0;
		var booking_control_rail_frame = 0;
		var booking_control_rail_settle_timer = 0;
		var booking_control_rail_settle_delay = 80;
		var axis_scroll_canvas = null;
		var axis_scroll_uses_scrollend = false;
		var active_time_slot_overflow = null;
		var time_slot_overflow_frame = 0;
		var is_initialized = false;

		/**
		 * Invoke one optional lifecycle method on every initialized extension.
		 *
		 * @param {string} method_name Stable lifecycle method name.
		 * @param {Array}  method_arguments Ordered method arguments.
		 * @return {Array} Ordered non-undefined extension results.
		 */
		function invoke_extension_method( method_name, method_arguments ) {
			var results = [];

			extension_controllers.forEach( function ( extension_controller ) {
				var result;

				if ( ! extension_controller || 'function' !== typeof extension_controller[ method_name ] ) {
					return;
				}
				result = extension_controller[ method_name ].apply( extension_controller, method_arguments || [] );
				if ( 'undefined' !== typeof result ) {
					results.push( result );
				}
			} );

			return results;
		}

		/**
		 * Report whether a focused domain extension currently owns interaction.
		 *
		 * @return {boolean} True when an extension reports an active interaction.
		 */
		function is_extension_interacting() {
			return invoke_extension_method( 'is_interacting', [] ).some( Boolean );
		}

		/**
		 * Determine whether a new external booking interaction may start.
		 *
		 * @return {boolean} True when Timeline and existing domains are idle.
		 */
		function can_start_extension_interaction() {
			return Boolean(
				mount
				&& is_initialized
				&& ( 'function' !== typeof context.is_host_active || context.is_host_active() )
				&& ! is_extension_interacting()
				&& ! active_time_slot_overflow
				&& ! ( booking_resizing_controller && 'function' === typeof booking_resizing_controller.is_interacting && booking_resizing_controller.is_interacting() )
				&& ! mount.classList.contains( 'is-request-loading' )
				&& 'true' !== mount.getAttribute( 'aria-busy' )
				&& ! mount.querySelector( '[data-wpbc-booking-inspector-trigger].is-booking-details-open' )
				&& ! mount.querySelector( '[data-wpbc-booking-date-editor-layer]:not([hidden]), [data-wpbc-booking-rescheduling-layer]:not([hidden])' )
			);
		}

		/**
		 * Delegate one same-Resource movement proposal to the domain-owned Review workflow.
		 *
		 * Expanded presentations may own different gesture geometry, but they must
		 * not duplicate Booking Rescheduling Review, Apply, or canonical readback.
		 * The first registered domain extension that accepts the proposal owns the
		 * complete authoritative lifecycle.
		 *
		 * @param {Object} proposal Executable-free booking movement proposal.
		 * @param {Object} state    Restored presentation and focus context.
		 * @return {boolean} True when a domain extension accepted the proposal.
		 */
		function review_booking_movement_proposal( proposal, state ) {
			return invoke_extension_method( 'review_movement_proposal', [ proposal, state ] ).some( Boolean );
		}

		/**
		 * Hand one presentation-neutral resize proposal to the canonical controller.
		 *
		 * Time-row geometry remains extension-owned. This bridge only forwards the
		 * executable-free proposal to the already mounted Booking Resizing domain.
		 *
		 * @param {Object} proposal Executable-free booking resize proposal.
		 * @param {Object} state    Restored presentation and focus context.
		 * @return {boolean} True when canonical Resize Review accepted the proposal.
		 */
		function review_booking_resize_proposal( proposal, state ) {
			return Boolean(
				booking_resizing_controller
					&& 'function' === typeof booking_resizing_controller.review_resize_proposal
					&& booking_resizing_controller.review_resize_proposal( proposal, state )
			);
		}

		/**
		 * Suspend or resume conflicting Timeline booking presentation adapters.
		 *
		 * @param {boolean} is_suspended Whether an extension owns pointer attention.
		 * @param {Element} owner_card   Optional booking card owning the gesture.
		 * @return {void}
		 */
		function set_extension_interaction_suspended( is_suspended, owner_card ) {
			if ( is_suspended ) {
				close_time_slot_overflow( false );
				suspend_booking_overflow_tooltips( owner_card || null );
				if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.suspend ) {
					booking_overview_tooltip_controller.suspend();
				}
				return;
			}

			resume_booking_overflow_tooltips();
			if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.resume ) {
				booking_overview_tooltip_controller.resume();
			}
		}

		/**
		 * Initialize registered domain extensions through one neutral lifecycle.
		 *
		 * @return {void}
		 */
		function initialize_extensions() {
			var extension_context = {
				mount: mount,
				settings: settings,
				callbacks: {
					can_start_interaction: can_start_extension_interaction,
					review_booking_movement_proposal: review_booking_movement_proposal,
					review_booking_resize_proposal: review_booking_resize_proposal,
					open_booking_full_reschedule: open_full_reschedule_from_handle,
					set_interaction_suspended: set_extension_interaction_suspended,
					set_axis_window_loading_locked: context.set_axis_window_loading_locked,
					show_admin_message: context.show_admin_message,
					refresh_after_apply: refresh_after_resize_apply,
					get_axis: function () {
						return settings.axis || {};
					},
					is_host_active: context.is_host_active,
					schedule_layout: schedule_booking_control_rail_layout
				}
			};

			extension_factories.forEach( function ( extension_factory ) {
				var extension_controller = extension_factory( extension_context );

				if (
					! extension_controller
					|| 'function' !== typeof extension_controller.initialize
					|| 'function' !== typeof extension_controller.destroy
				) {
					return;
				}
				extension_controllers.push( extension_controller );
				extension_controller.initialize();
			} );
		}

		/**
		 * Destroy every initialized domain extension in reverse ownership order.
		 *
		 * @return {void}
		 */
		function destroy_extensions() {
			extension_controllers.slice().reverse().forEach( function ( extension_controller ) {
				extension_controller.destroy();
			} );
			extension_controllers = [];
		}

		/**
		 * Position the active time-slot list beside its existing overflow button.
		 *
		 * The list is temporarily portaled to the document body so row and canvas
		 * clipping cannot cut it off. Scrolling only updates fixed positioning; it
		 * never reconstructs the server-owned template.
		 *
		 * @return {void}
		 */
		function position_time_slot_overflow() {
			var trigger_rectangle;
			var popover_rectangle;
			var viewport_width;
			var viewport_height;
			var viewport_margin = 8;
			var left;
			var top;

			time_slot_overflow_frame = 0;
			if ( ! active_time_slot_overflow || ! active_time_slot_overflow.trigger.isConnected ) {
				close_time_slot_overflow( false );
				return;
			}
			trigger_rectangle = active_time_slot_overflow.trigger.getBoundingClientRect();
			popover_rectangle = active_time_slot_overflow.popover.getBoundingClientRect();
			viewport_width = document.documentElement.clientWidth;
			viewport_height = document.documentElement.clientHeight;
			left = Math.min(
				Math.max( viewport_margin, trigger_rectangle.left ),
				Math.max( viewport_margin, viewport_width - popover_rectangle.width - viewport_margin )
			);
			top = trigger_rectangle.bottom + 6;
			if ( top + popover_rectangle.height > viewport_height - viewport_margin ) {
				top = Math.max( viewport_margin, trigger_rectangle.top - popover_rectangle.height - 6 );
			}
			active_time_slot_overflow.popover.style.left = Math.round( left ) + 'px';
			active_time_slot_overflow.popover.style.top = Math.round( top ) + 'px';
		}

		/**
		 * Schedule one geometry update for the active time-slot list.
		 *
		 * @return {void}
		 */
		function schedule_time_slot_overflow_position() {
			if ( ! active_time_slot_overflow || time_slot_overflow_frame ) {
				return;
			}
			time_slot_overflow_frame = window.requestAnimationFrame( position_time_slot_overflow );
		}

		/**
		 * Handle document clicks while a portaled time-slot list is open.
		 *
		 * @param {MouseEvent} event Browser click event.
		 * @return {void}
		 */
		function handle_time_slot_overflow_document_click( event ) {
			var close_button;
			var booking_item;

			if ( ! active_time_slot_overflow ) {
				return;
			}
			close_button = event.target.closest( '[data-wpbc-timeline-time-slot-close]' );
			booking_item = event.target.closest( '[data-wpbc-timeline-time-slot-item]' );
			if ( close_button && active_time_slot_overflow.popover.contains( close_button ) ) {
				event.preventDefault();
				close_time_slot_overflow( true );
				return;
			}
			if ( booking_item && active_time_slot_overflow.popover.contains( booking_item ) ) {
				event.preventDefault();
				close_time_slot_overflow( false );
				if ( booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.open ) {
					booking_inspector_adapter.open( booking_item );
				}
				return;
			}
			if (
				! active_time_slot_overflow.popover.contains( event.target )
				&& ! active_time_slot_overflow.trigger.contains( event.target )
			) {
				close_time_slot_overflow( false );
			}
		}

		/**
		 * Close the active time-slot list and remove every transient listener.
		 *
		 * @param {boolean} restore_focus Whether focus returns to the overflow button.
		 * @return {void}
		 */
		function close_time_slot_overflow( restore_focus ) {
			var overflow_state = active_time_slot_overflow;

			if ( time_slot_overflow_frame ) {
				window.cancelAnimationFrame( time_slot_overflow_frame );
				time_slot_overflow_frame = 0;
			}
			document.removeEventListener( 'click', handle_time_slot_overflow_document_click );
			document.removeEventListener( 'keydown', handle_time_slot_overflow_keydown );
			document.removeEventListener( 'scroll', schedule_time_slot_overflow_position, true );
			window.removeEventListener( 'resize', schedule_time_slot_overflow_position );
			active_time_slot_overflow = null;
			if ( ! overflow_state ) {
				return;
			}
			overflow_state.trigger.setAttribute( 'aria-expanded', 'false' );
			overflow_state.popover.hidden = true;
			overflow_state.popover.classList.remove( 'is-portaled' );
			overflow_state.popover.style.removeProperty( 'left' );
			overflow_state.popover.style.removeProperty( 'top' );
			overflow_state.wrapper.appendChild( overflow_state.popover );
			if ( restore_focus && overflow_state.trigger.isConnected ) {
				overflow_state.trigger.focus();
			}
		}

		/**
		 * Close the active time-slot list with Escape.
		 *
		 * @param {KeyboardEvent} event Browser keyboard event.
		 * @return {void}
		 */
		function handle_time_slot_overflow_keydown( event ) {
			if ( 'Escape' !== event.key || ! active_time_slot_overflow ) {
				return;
			}
			event.preventDefault();
			close_time_slot_overflow( true );
		}

		/**
		 * Open one existing server-rendered time-slot overflow list.
		 *
		 * @param {HTMLElement} trigger Overflow button inside the Timeline row.
		 * @return {boolean} True when a list was opened or toggled closed.
		 */
		function toggle_time_slot_overflow( trigger ) {
			var wrapper = trigger.closest( '[data-wpbc-timeline-time-slot-overflow]' );
			var popover = wrapper ? wrapper.querySelector( '[data-wpbc-timeline-time-slot-popover]' ) : null;

			if ( ! wrapper || ! popover ) {
				return false;
			}
			if ( active_time_slot_overflow && active_time_slot_overflow.trigger === trigger ) {
				close_time_slot_overflow( true );
				return true;
			}
			close_time_slot_overflow( false );
			active_time_slot_overflow = {
				wrapper: wrapper,
				trigger: trigger,
				popover: popover
			};
			trigger.setAttribute( 'aria-expanded', 'true' );
			popover.hidden = false;
			popover.classList.add( 'is-portaled' );
			document.body.appendChild( popover );
			document.addEventListener( 'click', handle_time_slot_overflow_document_click );
			document.addEventListener( 'keydown', handle_time_slot_overflow_keydown );
			document.addEventListener( 'scroll', schedule_time_slot_overflow_position, true );
			window.addEventListener( 'resize', schedule_time_slot_overflow_position, { passive: true } );
			schedule_time_slot_overflow_position();
			window.requestAnimationFrame( function () {
				var first_item = active_time_slot_overflow && active_time_slot_overflow.popover.querySelector( '[data-wpbc-timeline-time-slot-item]' );

				if ( first_item ) {
					first_item.focus();
				}
			} );

			return true;
		}

		/**
		 * Create the empty selected-booking state for this Timeline page.
		 *
		 * Canonical booking identity is independent from a rendered segment. The
		 * segment hint is retained only for focus and geometry reconciliation when
		 * one booking is represented by several visible cards.
		 *
		 * @return {Object} Empty booking selection state.
		 */
		function create_empty_booking_selection_state() {
			return {
				booking_id: 0,
				segment_hint: ''
			};
		}

		/**
		 * Report whether the Timeline host can still accept asynchronous work.
		 *
		 * @return {boolean} True while the page controller remains active.
		 */
		function is_host_active() {
			return is_initialized && ( 'function' !== typeof context.is_host_active || context.is_host_active() );
		}

		/**
		 * Return one rendered segment's canonical booking and presentation identity.
		 *
		 * @param {HTMLElement|null} segment Rendered booking card or selection control.
		 * @return {Object} Positive booking ID and stable segment hint when valid.
		 */
		function get_booking_segment_identity( segment ) {
			var card = segment && segment.closest ? segment.closest( '[data-wpbc-timeline-segment-id]' ) : null;

			if ( ! card || ! card.getAttribute ) {
				return create_empty_booking_selection_state();
			}

			return {
				booking_id: Math.max( 0, Math.round( Number( card.getAttribute( 'data-wpbc-timeline-booking-id' ) ) || 0 ) ),
				segment_hint: String( card.getAttribute( 'data-wpbc-timeline-segment-id' ) || '' )
			};
		}

		/**
		 * Apply selected-booking state to every current segment of that booking.
		 *
		 * Inspector open state deliberately remains on `is-booking-details-open`.
		 * Selection uses its own class and pressed state so neither Inspector nor
		 * Booking Overview ARIA becomes its authority.
		 *
		 * @return {void}
		 */
		function synchronize_booking_selection() {
			var fallback_segment_hint = '';
			var has_segment_hint = false;

			Array.prototype.forEach.call( mount.querySelectorAll( '[data-wpbc-timeline-booking-select]' ), function ( selection_control ) {
				var card = selection_control.closest( '[data-wpbc-timeline-segment-id]' );
				var identity = get_booking_segment_identity( selection_control );
				var is_selected = Boolean( booking_selection_state.booking_id && identity.booking_id === booking_selection_state.booking_id );

				if ( card ) {
					card.classList.toggle( 'is-booking-selected', is_selected );
				}
				selection_control.setAttribute( 'aria-pressed', is_selected ? 'true' : 'false' );
				if ( is_selected && ! fallback_segment_hint ) {
					fallback_segment_hint = identity.segment_hint;
				}
				if ( is_selected && identity.segment_hint === booking_selection_state.segment_hint ) {
					has_segment_hint = true;
				}
			} );
			Array.prototype.forEach.call( mount.querySelectorAll( '[data-wpbc-timeline-booking-control-rail]' ), function ( rail ) {
				var rail_booking_id = Math.max( 0, Math.round( Number( rail.getAttribute( 'data-wpbc-timeline-booking-id' ) ) || 0 ) );
				var is_selected = Boolean( booking_selection_state.booking_id && rail_booking_id === booking_selection_state.booking_id );
				var details_action = rail.querySelector( '[data-wpbc-timeline-booking-details-action]' );

				rail.classList.toggle( 'is-booking-selected', is_selected );
				if ( details_action ) {
					details_action.hidden = ! is_selected;
				}
			} );

			if ( booking_selection_state.booking_id && fallback_segment_hint && ! has_segment_hint ) {
				booking_selection_state.segment_hint = fallback_segment_hint;
			}
		}

		/**
		 * Close clipped-text hover aids owned by one selected booking card.
		 *
		 * Selection moves focus to the booking control for its own accessible action.
		 * The control's accessible name already contains the complete booking label
		 * and schedule, so previously opened pointer tooltips must not remain over the
		 * selected card or reopen merely because that control retains focus.
		 *
		 * @param {HTMLElement|null} segment Rendered booking card or child control.
		 * @return {void}
		 */
		function dismiss_booking_overflow_tooltips( segment ) {
			var card = segment && segment.closest ? segment.closest( '[data-wpbc-timeline-segment-id]' ) : null;
			var tooltip_owners = card && card.querySelectorAll
				? card.querySelectorAll( '[data-wpbc-ui-catalog-overflow-tooltip-focus="pointer-only"]' )
				: [];

			Array.prototype.forEach.call( tooltip_owners, function ( tooltip_owner ) {
				if ( tooltip_owner._tippy && 'function' === typeof tooltip_owner._tippy.hide ) {
					tooltip_owner._tippy.hide();
				}
			} );
		}

		/**
		 * Hide and disable the active card's pointer-only overflow tooltips.
		 *
		 * Pointer capture can otherwise leave the hover tooltip flipping above a
		 * moving ghost. The exact card-owned Tippy instances are retained and
		 * re-enabled once by resize teardown; no global tooltip scan is required.
		 *
		 * @param {HTMLElement|null} card Exact gesture-anchor card.
		 * @return {void}
		 */
		function suspend_booking_overflow_tooltips( card ) {
			var tooltip_owners = card && card.querySelectorAll
				? card.querySelectorAll( '[data-wpbc-ui-catalog-overflow-tooltip-focus="pointer-only"]' )
				: [];

			suspended_booking_overflow_tooltips = [];
			Array.prototype.forEach.call( tooltip_owners, function ( tooltip_owner ) {
				if ( ! tooltip_owner._tippy ) {
					return;
				}
				if ( 'function' === typeof tooltip_owner._tippy.hide ) {
					tooltip_owner._tippy.hide();
				}
				if ( 'function' === typeof tooltip_owner._tippy.disable ) {
					tooltip_owner._tippy.disable();
					suspended_booking_overflow_tooltips.push( tooltip_owner._tippy );
				}
			} );
		}

		/**
		 * Re-enable the card-owned tooltips disabled for pointer resizing.
		 *
		 * @return {void}
		 */
		function resume_booking_overflow_tooltips() {
			for ( var tooltip_index = 0; tooltip_index < suspended_booking_overflow_tooltips.length; tooltip_index++ ) {
				if ( 'function' === typeof suspended_booking_overflow_tooltips[ tooltip_index ].enable ) {
					suspended_booking_overflow_tooltips[ tooltip_index ].enable();
				}
			}
			suspended_booking_overflow_tooltips = [];
		}

		/**
		 * Select one canonical booking without opening Overview or Inspector.
		 *
		 * @param {HTMLElement} segment Rendered Timeline booking segment.
		 * @return {boolean} True when a valid booking was selected.
		 */
		function select_booking_segment( segment ) {
			var identity = get_booking_segment_identity( segment );

			if ( ! identity.booking_id || ! identity.segment_hint ) {
				return false;
			}
			dismiss_booking_overflow_tooltips( segment );
			booking_selection_state = identity;
			synchronize_booking_selection();
			schedule_booking_control_rail_layout();
			if ( booking_resizing_controller && 'function' === typeof booking_resizing_controller.select ) {
				booking_resizing_controller.select( segment );
			}
			invoke_extension_method( 'select_segment', [ segment, booking_selection_state ] );

			return true;
		}

		/**
		 * Preserve a newly created booking identity across the host-owned rerender.
		 *
		 * The card does not exist yet, so only the authoritative positive booking ID
		 * is retained. Normal refresh reconciliation supplies a current segment hint.
		 *
		 * @param {number} booking_id Authoritative created booking ID.
		 * @return {boolean} True when the identity was accepted.
		 */
		function prepare_created_booking_readback( booking_id ) {
			booking_id = Math.max( 0, Math.round( Number( booking_id ) || 0 ) );
			if ( ! booking_id ) {
				return false;
			}
			booking_selection_state = {
				booking_id: booking_id,
				segment_hint: ''
			};

			return true;
		}

		/**
		 * Select and highlight the authoritative created booking after Timeline readback.
		 *
		 * @param {number} booking_id Authoritative created booking ID.
		 * @return {boolean} True when the booking is visible in the current Resource view.
		 */
		function complete_created_booking_readback( booking_id ) {
			var card;
			var selection_control;

			booking_id = Math.max( 0, Math.round( Number( booking_id ) || 0 ) );
			if ( ! booking_id ) {
				return false;
			}
			card = mount.querySelector( '[data-wpbc-timeline-booking-id="' + String( booking_id ) + '"][data-wpbc-timeline-segment-id]' );
			selection_control = card ? card.querySelector( '[data-wpbc-timeline-booking-select]' ) : null;
			if ( ! card || ! selection_control ) {
				booking_selection_state = {
					booking_id: booking_id,
					segment_hint: ''
				};
				synchronize_booking_selection();
				return false;
			}
			select_booking_segment( selection_control );

			return true;
		}

		/**
		 * Open the existing read-only Booking Inspector for one visible created card.
		 *
		 * This optional presentation handoff runs only after the creation Inspector
		 * receives an accepted host readback and closes its own shared shell.
		 *
		 * @param {number} booking_id Authoritative created booking ID.
		 * @return {boolean} True when the read-only Inspector accepted the card.
		 */
		function open_created_booking_inspector( booking_id ) {
			var card;

			booking_id = Math.max( 0, Math.round( Number( booking_id ) || 0 ) );
			card = booking_id
				? mount.querySelector( '[data-wpbc-timeline-booking-id="' + String( booking_id ) + '"][data-wpbc-timeline-segment-id]' )
				: null;
			if ( ! card || ! booking_inspector_adapter || 'function' !== typeof booking_inspector_adapter.open ) {
				return false;
			}
			booking_inspector_adapter.open( card );

			return true;
		}

		/**
		 * Focus the selected control for one authoritative created booking.
		 *
		 * @param {number} booking_id Authoritative created booking ID.
		 * @return {boolean} True when the visible booking control received focus.
		 */
		function focus_created_booking( booking_id ) {
			var card;
			var selection_control;

			booking_id = Math.max( 0, Math.round( Number( booking_id ) || 0 ) );
			card = booking_id
				? mount.querySelector( '[data-wpbc-timeline-booking-id="' + String( booking_id ) + '"][data-wpbc-timeline-segment-id]' )
				: null;
			selection_control = card ? card.querySelector( '[data-wpbc-timeline-booking-select]' ) : null;
			if ( ! selection_control || 'function' !== typeof selection_control.focus ) {
				return false;
			}
			selection_control.focus();

			return true;
		}

		/**
		 * Write one inline style only when its serialized value changed.
		 *
		 * @param {HTMLElement} element Element receiving the style.
		 * @param {string} property_name CSS property or custom-property name.
		 * @param {string} property_value Serialized CSS value.
		 * @return {void}
		 */
		function set_changed_style_property( element, property_name, property_value ) {
			if ( element.style.getPropertyValue( property_name ) !== property_value ) {
				element.style.setProperty( property_name, property_value );
			}
		}

		/**
		 * Resolve the canonical card for an in-card or row-overlay accessory.
		 *
		 * @param {HTMLElement|null} accessory Accessory rail, dock, or child control.
		 * @param {Map|null} card_by_segment_id Optional frame-local card lookup.
		 * @return {HTMLElement|null} Canonical rendered booking card, or null.
		 */
		function get_booking_accessory_card( accessory, card_by_segment_id ) {
			var card = accessory && accessory.closest ? accessory.closest( '[data-wpbc-timeline-segment-id]' ) : null;
			var rail;
			var segment_hint;
			var cards;

			if ( card ) {
				return card;
			}
			rail = accessory && accessory.closest ? accessory.closest( '[data-wpbc-timeline-booking-control-rail]' ) : null;
			segment_hint = rail ? String( rail.getAttribute( 'data-wpbc-timeline-accessory-segment-id' ) || '' ) : '';
			if ( ! segment_hint ) {
				return null;
			}
			if ( card_by_segment_id && card_by_segment_id.has( segment_hint ) ) {
				return card_by_segment_id.get( segment_hint );
			}
			cards = mount.querySelectorAll( '[data-wpbc-timeline-segment-id]' );
			Array.prototype.some.call( cards, function ( candidate ) {
				if ( segment_hint === String( candidate.getAttribute( 'data-wpbc-timeline-segment-id' ) || '' ) ) {
					card = candidate;
					return true;
				}
				return false;
			} );

			return card;
		}

		/**
		 * Return the physically visible time-canvas rectangle.
		 *
		 * Bounding rectangles avoid browser-specific RTL scrollLeft models and keep
		 * controls outside the frozen Resource column.
		 *
		 * @param {HTMLElement} canvas Timeline horizontal scroll container.
		 * @return {Object} Physical left/right/top/bottom canvas boundaries.
		 */
		function get_visible_time_canvas_rectangle( canvas ) {
			var canvas_rectangle = canvas.getBoundingClientRect();
			var resource_column = mount.querySelector( '.wpbc_timeline__resources' );
			var resource_rectangle = resource_column ? resource_column.getBoundingClientRect() : null;
			var visual_viewport = window.visualViewport || null;
			var viewport_left = visual_viewport ? Math.max( 0, Number( visual_viewport.offsetLeft ) || 0 ) : 0;
			var viewport_width = visual_viewport
				? Math.max( 0, Number( visual_viewport.width ) || 0 )
				: Math.max( 0, document.documentElement.clientWidth || window.innerWidth || 0 );
			var viewport_right = viewport_width ? viewport_left + viewport_width : canvas_rectangle.right;
			var visible_left = Math.max( viewport_left, canvas_rectangle.left );
			var visible_right = Math.min( viewport_right, canvas_rectangle.right );

			if ( resource_rectangle && resource_rectangle.right > visible_left && resource_rectangle.left <= visible_left ) {
				visible_left = Math.max( visible_left, resource_rectangle.right );
			}
			if ( resource_rectangle && resource_rectangle.left < visible_right && resource_rectangle.right >= visible_right ) {
				visible_right = Math.min( visible_right, resource_rectangle.left );
			}

			return {
				left: visible_left,
				right: Math.max( visible_left, visible_right ),
				top: canvas_rectangle.top,
				bottom: canvas_rectangle.bottom
			};
		}

		/**
		 * Read one positive pixel token from Timeline custom properties.
		 *
		 * @param {CSSStyleDeclaration} computed_style Computed Timeline style.
		 * @param {string} property_name CSS custom-property name.
		 * @param {number} fallback_px Fallback CSS-pixel value.
		 * @return {number} Positive CSS-pixel value.
		 */
		function get_booking_layout_token( computed_style, property_name, fallback_px ) {
			var parsed_value = parseFloat( computed_style.getPropertyValue( property_name ) );

			return Number.isFinite( parsed_value ) && 0 < parsed_value ? parsed_value : fallback_px;
		}

		/**
		 * Move a booking control rail without discarding keyboard focus.
		 *
		 * @param {HTMLElement} rail Control rail to move.
		 * @param {HTMLElement} parent Destination parent.
		 * @param {?Node} reference_node Node before which the rail is inserted.
		 * @return {void}
		 */
		function move_booking_control_rail( rail, parent, reference_node ) {
			var focused_control = ! rail.hidden && rail.contains( document.activeElement )
				? document.activeElement
				: null;

			parent.insertBefore( rail, reference_node || null );
			if ( focused_control && document.activeElement !== focused_control ) {
				try {
					focused_control.focus( { preventScroll: true } );
				} catch ( error ) {
					focused_control.focus();
				}
			}
		}

		/**
		 * Restore a control rail to its card-owned accessory dock.
		 *
		 * @param {HTMLElement} card Canonical booking card.
		 * @param {HTMLElement} rail Segment control rail.
		 * @return {void}
		 */
		function restore_booking_control_rail( card, rail ) {
			var dock = card.querySelector( '.wpbc_timeline__booking_accessory_dock' );

			if ( ! dock ) {
				return;
			}
			if ( rail.parentNode !== dock ) {
				move_booking_control_rail( rail, dock, null );
			}
			rail.classList.remove( 'is-row-overlay', 'is-docked-inline-start', 'is-docked-inline-end', 'is-docked-clamped' );
			card.classList.remove( 'is-booking-accessory-docked' );
		}

		/**
		 * Report whether a rail must remain a descendant of its canonical card.
		 *
		 * Domain extensions use this neutral geometry contract when a control's
		 * interaction library requires its handle to remain inside the owning node.
		 * The marker affects presentation ownership only; it grants no permission.
		 *
		 * @param {HTMLElement} rail Booking control rail.
		 * @return {boolean} True when row-overlay detachment is prohibited.
		 */
		function is_booking_control_rail_card_owned( rail ) {
			return Boolean( rail && rail.hasAttribute( 'data-wpbc-timeline-booking-control-rail-card-owned' ) );
		}

		/**
		 * Choose a bounded physical position beside a narrow visible segment.
		 *
		 * @param {Object} visible_segment Physical visible segment boundaries.
		 * @param {Object} visible_canvas Physical visible canvas boundaries.
		 * @param {number} rail_width Control-rail width in CSS pixels.
		 * @param {number} rail_gap Gap between segment and overlay rail.
		 * @return {Object} Physical left position and chosen logical side.
		 */
		function get_booking_overlay_rail_position( visible_segment, visible_canvas, rail_width, rail_gap ) {
			var inline_end_left = settings.is_rtl
				? visible_segment.left - rail_gap - rail_width
				: visible_segment.right + rail_gap;
			var inline_start_left = settings.is_rtl
				? visible_segment.right + rail_gap
				: visible_segment.left - rail_gap - rail_width;
			var fits = function ( physical_left ) {
				return physical_left >= visible_canvas.left && physical_left + rail_width <= visible_canvas.right;
			};
			var available_before = Math.max( 0, visible_segment.left - visible_canvas.left );
			var available_after = Math.max( 0, visible_canvas.right - visible_segment.right );
			var physical_left;
			var logical_side;

			if ( fits( inline_end_left ) ) {
				physical_left = inline_end_left;
				logical_side = 'end';
			} else if ( fits( inline_start_left ) ) {
				physical_left = inline_start_left;
				logical_side = 'start';
			} else if ( available_after >= available_before ) {
				physical_left = Math.min( visible_canvas.right - rail_width, visible_segment.right + rail_gap );
				logical_side = settings.is_rtl ? 'start' : 'end';
			} else {
				physical_left = Math.max( visible_canvas.left, visible_segment.left - rail_gap - rail_width );
				logical_side = settings.is_rtl ? 'end' : 'start';
			}
			physical_left = Math.max( visible_canvas.left, Math.min( visible_canvas.right - rail_width, physical_left ) );

			return {
				left: physical_left,
				logical_side: logical_side
			};
		}

		/**
		 * Position every booking information rail against the visible canvas.
		 *
		 * Long cards retain CSS-sticky controls. Only a truly narrow canonical card
		 * moves its rail into the row overlay, without changing booking occupancy.
		 *
		 * @return {void}
		 */
		function layout_booking_control_rails() {
			var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );
			var visible_canvas;
			var rails;
			var card_by_segment_id = new Map();

			booking_control_rail_frame = 0;
			if ( ! canvas || ! is_host_active() ) {
				return;
			}
			visible_canvas = get_visible_time_canvas_rectangle( canvas );
			Array.prototype.forEach.call( mount.querySelectorAll( '[data-wpbc-timeline-segment-id]' ), function ( card ) {
				var segment_id = String( card.getAttribute( 'data-wpbc-timeline-segment-id' ) || '' );

				if ( segment_id ) {
					card_by_segment_id.set( segment_id, card );
				}
			} );
			rails = mount.querySelectorAll( '[data-wpbc-timeline-booking-control-rail]' );
			Array.prototype.forEach.call( rails, function ( rail ) {
				var card = get_booking_accessory_card( rail, card_by_segment_id );
				var segment_host = card ? card.parentElement : null;
				var card_rectangle;
				var host_rectangle;
				var is_booking_selected;
				var visible_segment;
				var visible_width;
				var card_width;
				var computed_style;
				var accessory_size;
				var drag_indicator_size;
				var accessory_gap;
				var accessory_padding;
				var avatar_size;
				var selection_edge_reserve;
				var continuation_width;
				var accessory_count;
				var drag_indicator;
				var has_visible_drag_indicator;
				var accessory_content_width;
				var avatar;
				var has_expanded_avatar;
				var rail_width;
				var required_width;
				var expanded_required_width;
				var should_condense;
				var should_minimize;
				var start_rail_reserve;
				var end_rail_reserve;
				var start_boundary_position;
				var end_boundary_position;
				var start_boundary_visible;
				var end_boundary_visible;
				var overlay_position;
				var overlay_gap;
				var requires_clamped_overlay;
				var logical_rail_start;
				var rail_block_start;

				if ( ! card || ! segment_host || card.hidden || card.closest( '[hidden]' ) ) {
					rail.hidden = true;
					return;
				}
				card_rectangle = card.getBoundingClientRect();
				card_width = Math.max( 0, card_rectangle.width );
				visible_segment = {
					left: Math.max( card_rectangle.left, visible_canvas.left ),
					right: Math.min( card_rectangle.right, visible_canvas.right )
				};
				visible_width = Math.max( 0, visible_segment.right - visible_segment.left );
				if ( 0 >= visible_width || card_rectangle.bottom <= visible_canvas.top || card_rectangle.top >= visible_canvas.bottom ) {
					rail.hidden = true;
					restore_booking_control_rail( card, rail );
					card.classList.add( 'is-booking-outside-visible-canvas' );
					return;
				}

				rail.hidden = false;
				card.classList.remove( 'is-booking-outside-visible-canvas' );
				is_booking_selected = card.classList.contains( 'is-booking-selected' );
				rail.classList.toggle( 'is-booking-selected', is_booking_selected );
				computed_style = window.getComputedStyle( card );
				accessory_size = get_booking_layout_token( computed_style, '--wpbc_timeline_general__booking-accessory-size', 28 );
				drag_indicator_size = get_booking_layout_token( computed_style, '--wpbc_timeline_general__booking-drag-indicator-size', 20 );
				accessory_gap = get_booking_layout_token( computed_style, '--wpbc_timeline_general__booking-accessory-gap', 4 );
				accessory_padding = get_booking_layout_token( computed_style, '--wpbc_timeline_general__booking-accessory-padding', 4 );
				avatar_size = get_booking_layout_token( computed_style, '--wpbc_timeline_general__booking-avatar-size', 26 );
				selection_edge_reserve = get_booking_layout_token( computed_style, '--wpbc-timeline-booking-selection-edge-reserve', 0 );
				continuation_width = get_booking_layout_token( computed_style, '--wpbc_timeline_general__booking-continuation-width', 28 );
				accessory_count = rail.querySelectorAll( '.wpbc_timeline__booking_accessory:not([hidden])' ).length;
				drag_indicator = rail.querySelector( '.wpbc_timeline__booking_drag_indicator:not([hidden])' );
				has_visible_drag_indicator = Boolean( drag_indicator && is_booking_selected );
				if ( drag_indicator && ! has_visible_drag_indicator ) {
					accessory_count = Math.max( 0, accessory_count - 1 );
				}
				accessory_content_width = ( Math.max( 0, accessory_count - ( has_visible_drag_indicator ? 1 : 0 ) ) * accessory_size )
					+ ( has_visible_drag_indicator ? drag_indicator_size : 0 );
				avatar = card.querySelector( '.wpbc_timeline__booking_avatar' );
				has_expanded_avatar = Boolean( avatar ) && ! card.classList.contains( 'is-compact' );
				rail_width = Math.max(
					accessory_size + ( 2 * accessory_padding ),
					accessory_content_width + ( Math.max( 0, accessory_count - 1 ) * accessory_gap ) + ( 2 * accessory_padding )
				);
				start_boundary_position = settings.is_rtl ? card_rectangle.right : card_rectangle.left;
				end_boundary_position = settings.is_rtl ? card_rectangle.left : card_rectangle.right;
				start_boundary_visible = start_boundary_position >= visible_canvas.left - 0.5 && start_boundary_position <= visible_canvas.right + 0.5;
				end_boundary_visible = end_boundary_position >= visible_canvas.left - 0.5 && end_boundary_position <= visible_canvas.right + 0.5;
				start_rail_reserve = accessory_padding;
				end_rail_reserve = accessory_padding;
				if ( start_boundary_visible && card.classList.contains( 'is-clipped-start' ) ) {
					start_rail_reserve = Math.max( start_rail_reserve, continuation_width + accessory_gap );
				}
				if ( end_boundary_visible && card.classList.contains( 'is-clipped-end' ) ) {
					end_rail_reserve = Math.max( end_rail_reserve, continuation_width + accessory_gap );
				}
				expanded_required_width = rail_width
					+ ( has_expanded_avatar ? avatar_size + accessory_gap : 0 )
					+ Math.max( 0, start_rail_reserve - accessory_padding )
					+ Math.max( 0, end_rail_reserve - accessory_padding )
					+ ( 2 * selection_edge_reserve );
				set_changed_style_property( card, '--wpbc-timeline-booking-start-rail-reserve', Math.round( start_rail_reserve * 100 ) / 100 + 'px' );
				set_changed_style_property( card, '--wpbc-timeline-booking-end-rail-reserve', Math.round( end_rail_reserve * 100 ) / 100 + 'px' );

				should_condense = card_width < Math.max( 120, expanded_required_width + 40 );
				required_width = rail_width
					+ Math.max( 0, start_rail_reserve - accessory_padding )
					+ Math.max( 0, end_rail_reserve - accessory_padding )
					+ ( 2 * selection_edge_reserve );
				should_minimize = card_width < required_width + 16;
				card.classList.toggle( 'is-booking-info-condensed', should_condense );
				card.classList.toggle( 'is-booking-info-minimal', should_minimize );
				rail.classList.toggle( 'is-booking-info-condensed', should_condense );
				if ( card_width + 0.5 >= required_width || is_booking_control_rail_card_owned( rail ) ) {
					restore_booking_control_rail( card, rail );
					return;
				}

				overlay_gap = accessory_gap + selection_edge_reserve;
				overlay_position = get_booking_overlay_rail_position( visible_segment, visible_canvas, rail_width, overlay_gap );
				host_rectangle = segment_host.getBoundingClientRect();
				requires_clamped_overlay = card_rectangle.left < visible_canvas.left - 0.5
					|| card_rectangle.right > visible_canvas.right + 0.5;
				rail_block_start = card_rectangle.top - host_rectangle.top + Math.max( 0, ( card_rectangle.height - accessory_size - 6 ) / 2 );
				if ( rail.parentNode !== segment_host ) {
					move_booking_control_rail( rail, segment_host, null );
				}
				rail.classList.add( 'is-row-overlay' );
				rail.classList.toggle( 'is-docked-inline-start', 'start' === overlay_position.logical_side );
				rail.classList.toggle( 'is-docked-inline-end', 'end' === overlay_position.logical_side );
				rail.classList.toggle( 'is-docked-clamped', requires_clamped_overlay );
				card.classList.add( 'is-booking-accessory-docked' );
				set_changed_style_property( rail, '--wpbc-timeline-booking-rail-block-start', Math.round( rail_block_start * 100 ) / 100 + 'px' );
				set_changed_style_property( rail, '--wpbc-timeline-booking-rail-gap', Math.round( overlay_gap * 100 ) / 100 + 'px' );
				if ( requires_clamped_overlay ) {
					logical_rail_start = settings.is_rtl
						? host_rectangle.right - ( overlay_position.left + rail_width )
						: overlay_position.left - host_rectangle.left;
					set_changed_style_property( rail, '--wpbc-timeline-booking-rail-clamped-inline-start', Math.round( logical_rail_start * 100 ) / 100 + 'px' );
				} else {
					rail.style.removeProperty( '--wpbc-timeline-booking-rail-clamped-inline-start' );
				}
			} );
			if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.update_geometry ) {
				booking_overview_tooltip_controller.update_geometry();
			}
		}

		/**
		 * Request one animation-frame batch for booking control-rail geometry.
		 *
		 * @return {void}
		 */
		function schedule_booking_control_rail_layout() {
			if ( booking_control_rail_settle_timer ) {
				window.clearTimeout( booking_control_rail_settle_timer );
				booking_control_rail_settle_timer = 0;
			}
			if ( booking_control_rail_frame ) {
				return;
			}
			booking_control_rail_frame = window.requestAnimationFrame( layout_booking_control_rails );
		}

		/**
		 * Reconcile measured narrow-card fallbacks after axis motion settles.
		 *
		 * @return {void}
		 */
		function schedule_booking_control_rail_layout_after_axis_motion() {
			if ( booking_control_rail_settle_timer ) {
				window.clearTimeout( booking_control_rail_settle_timer );
			}
			booking_control_rail_settle_timer = window.setTimeout( function () {
				booking_control_rail_settle_timer = 0;
				if ( ! is_host_active() ) {
					return;
				}
				schedule_booking_control_rail_layout();
			}, booking_control_rail_settle_delay );
		}

		/**
		 * Mount the reusable Booking Inspector domain in the Timeline host.
		 *
		 * @return {boolean} True when the adapter is available.
		 */
		function initialize_booking_inspector() {
			var host = mount.querySelector( '[data-wpbc-timeline-booking-inspector-host]' );

			if ( ! host || ! window.wpbc_booking_inspector_hosts || 'function' !== typeof window.wpbc_booking_inspector_hosts.create_timeline ) {
				return false;
			}
			booking_inspector_adapter = window.wpbc_booking_inspector_hosts.create_timeline( mount, host, settings.booking_inspector );

			return Boolean( booking_inspector_adapter );
		}

		/**
		 * Open the canonical full Reschedule dialog for a static resize handle.
		 *
		 * @param {HTMLElement} card   Exact selected Timeline card.
		 * @param {HTMLElement} handle Accessible resize-handle button.
		 * @return {void}
		 */
		function open_full_reschedule_from_handle( card, handle ) {
			if ( booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.open_rescheduling ) {
				booking_inspector_adapter.open_rescheduling( card, handle );
			}
		}

		/**
		 * Refresh every visible booking projection after canonical booking Apply.
		 *
		 * Booking Overview is invalidated before Timeline replacement. An open
		 * matching Inspector performs its own authorized readback, including
		 * Activity. The returned promise contains no mutation path and is therefore
		 * safe for domain controllers' explicit Retry refresh actions. The shared
		 * callback performs reads only and contains no resize or movement rules.
		 *
		 * @param {Object} apply_result Canonical server Apply result.
		 * @return {Object} jQuery-compatible combined readback promise.
		 */
		function refresh_after_resize_apply( apply_result ) {
			var refresh_requests = [];
			var booking_id = Number( apply_result && apply_result.booking_id ? apply_result.booking_id : 0 );

			if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.invalidate ) {
				booking_overview_tooltip_controller.invalidate( booking_id );
			}
			if ( booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.refresh_after_external_apply ) {
				refresh_requests.push( booking_inspector_adapter.refresh_after_external_apply( apply_result ) );
			}
			if ( 'function' !== typeof context.refresh_after_resize_apply ) {
				return window.jQuery.Deferred().reject( { message: '' } ).promise();
			}
			refresh_requests.push( context.refresh_after_resize_apply( apply_result ) );

			return window.jQuery.when.apply( window.jQuery, refresh_requests );
		}

		/**
		 * Mount the domain-owned static booking-resizing presentation controller.
		 *
		 * @return {boolean} True when the booking-resizing controller is available.
		 */
		function initialize_booking_resizing() {
			if ( ! window.wpbc_timeline_booking_resizing || 'function' !== typeof window.wpbc_timeline_booking_resizing.create_controller ) {
				return false;
			}
			booking_resizing_controller = window.wpbc_timeline_booking_resizing.create_controller(
				mount,
				settings.booking_resizing || {},
				{
					open_full_reschedule: open_full_reschedule_from_handle,
					refresh_after_apply: refresh_after_resize_apply,
					set_axis_window_loading_locked: context.set_axis_window_loading_locked,
					show_admin_message: context.show_admin_message,
					get_axis: function () {
						return settings.axis || {};
					},
					is_host_active: context.is_host_active,
					suspend_overview: function ( card ) {
						suspend_booking_overflow_tooltips( card );
						if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.suspend ) {
							booking_overview_tooltip_controller.suspend();
						}
					},
					resume_overview: function () {
						resume_booking_overflow_tooltips();
						if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.resume ) {
							booking_overview_tooltip_controller.resume();
						}
					}
				}
			);

			return Boolean( booking_resizing_controller );
		}

		/**
		 * Determine whether another Timeline interaction currently owns attention.
		 *
		 * @return {boolean} True while Booking Overview must remain suppressed.
		 */
		function is_booking_overview_tooltip_suppressed() {
			if ( is_extension_interacting() ) {
				return true;
			}
			if ( active_time_slot_overflow ) {
				return true;
			}
			if ( booking_resizing_controller && 'function' === typeof booking_resizing_controller.is_interacting && booking_resizing_controller.is_interacting() ) {
				return true;
			}
			if (
				mount.classList.contains( 'is-request-loading' )
				|| 'true' === mount.getAttribute( 'aria-busy' )
				|| ( 'function' === typeof context.is_empty_range_resizing && context.is_empty_range_resizing() )
			) {
				return true;
			}
			if ( mount.querySelector( '[data-wpbc-booking-inspector-trigger].is-booking-details-open' ) ) {
				return true;
			}
			if ( mount.querySelector( '[data-wpbc-booking-date-editor-layer]:not([hidden]), [data-wpbc-booking-rescheduling-layer]:not([hidden]), [data-wpbc-booking-date-editor-view="review"]:not([hidden]), [data-wpbc-booking-rescheduling-view="review"]:not([hidden])' ) ) {
				return true;
			}

			return Boolean( mount.querySelector( '.sortable-chosen, .sortable-drag, .is-dragging, .is-resizing, [data-wpbc-timeline-dragging="true"], [data-wpbc-timeline-resizing="true"]' ) );
		}

		/**
		 * Open Booking Inspector from the booking-owned Overview action.
		 *
		 * @param {HTMLElement} card Registered Timeline Inspector identity.
		 * @return {void}
		 */
		function open_booking_details_from_overview( card ) {
			if ( booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.open ) {
				booking_inspector_adapter.open( card );
			}
		}

		/**
		 * Return pinned Booking Overview horizontal input to Timeline ownership.
		 *
		 * @param {WheelEvent} event Browser wheel event from the pinned surface.
		 * @return {boolean} True when the Timeline page accepted the gesture.
		 */
		function scroll_timeline_from_overview( event ) {
			if ( 'function' !== typeof context.scroll_axis_from_external_wheel ) {
				return false;
			}

			return context.scroll_axis_from_external_wheel( event );
		}

		/**
		 * Mount the booking-owned adapter over the shared Context Popover.
		 *
		 * @return {boolean} True when the Overview adapter is available.
		 */
		function initialize_booking_overview_tooltip() {
			if ( ! window.wpbc_booking_overview_tooltip || 'function' !== typeof window.wpbc_booking_overview_tooltip.create_controller ) {
				return false;
			}
			booking_overview_tooltip_controller = window.wpbc_booking_overview_tooltip.create_controller(
				mount,
				settings.booking_overview_tooltip || {},
				{
					is_suppressed: is_booking_overview_tooltip_suppressed,
					open_booking_details: open_booking_details_from_overview,
					scroll_timeline: scroll_timeline_from_overview
				}
			);

			return Boolean( booking_overview_tooltip_controller );
		}

		/**
		 * Refresh the canonical Timeline after one accepted Inspector save event.
		 *
		 * @param {CustomEvent} event Booking Inspector save-completion event.
		 * @return {void}
		 */
		function handle_booking_inspector_saved( event ) {
			var event_detail = event && event.detail ? event.detail : {};
			var refresh_generation = Number( event_detail.refresh_generation || 0 );

			if ( 'timeline' !== event_detail.source ) {
				return;
			}
			if ( refresh_generation && refresh_generation <= booking_inspector_refresh_generation ) {
				return;
			}
			if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.invalidate ) {
				booking_overview_tooltip_controller.invalidate( Number( event_detail.booking_id || 0 ) );
			}
			booking_inspector_refresh_generation = refresh_generation || booking_inspector_refresh_generation + 1;
			if ( 'function' === typeof context.refresh_after_inspector_save ) {
				context.refresh_after_inspector_save( event_detail );
			}
		}

		/**
		 * Handle booking selection through the Timeline delegated keydown path.
		 *
		 * @param {KeyboardEvent} event Timeline key event.
		 * @return {boolean} True when the booking interaction owned the event.
		 */
		function handle_keydown( event ) {
			var selection_control = event.target.closest( '[data-wpbc-timeline-booking-select]' );

			if ( is_extension_interacting() ) {
				if ( 'Escape' !== event.key ) {
					event.preventDefault();
				}
				return true;
			}

			if ( booking_resizing_controller && booking_resizing_controller.handle_keydown( event ) ) {
				return true;
			}

			if (
				! selection_control
				|| event.target !== selection_control
				|| event.ctrlKey
				|| event.metaKey
				|| event.altKey
				|| event.shiftKey
				|| -1 === [ 'Enter', ' ' ].indexOf( event.key )
			) {
				return false;
			}
			event.preventDefault();
			select_booking_segment( selection_control );

			return true;
		}

		/**
		 * Handle booking accessories and selection through delegated click events.
		 *
		 * @param {MouseEvent} event Timeline click event.
		 * @return {boolean} True when a booking interaction owned the event.
		 */
		function handle_click( event ) {
			var time_slot_more = event.target.closest( '[data-wpbc-timeline-time-slot-more]' );
			var details_action = event.target.closest( '[data-wpbc-timeline-booking-details-action]' );
			var accessory = event.target.closest( '[data-wpbc-timeline-booking-accessory]' );
			var selection_control = event.target.closest( '[data-wpbc-timeline-booking-select]' );
			var card;

			if ( is_extension_interacting() ) {
				event.preventDefault();
				return true;
			}

			if ( time_slot_more ) {
				event.preventDefault();
				return toggle_time_slot_overflow( time_slot_more );
			}

			if ( booking_resizing_controller && booking_resizing_controller.handle_click( event ) ) {
				return true;
			}

			if ( details_action ) {
				event.preventDefault();
				card = get_booking_accessory_card( details_action, null );
				if ( card && booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.open ) {
					booking_inspector_adapter.open( card );
				}
				return true;
			}

			if ( accessory ) {
				return true;
			}
			if ( selection_control ) {
				select_booking_segment( selection_control );
				return true;
			}

			return false;
		}

		/**
		 * Notify Overview before Timeline replaces every rendered booking card.
		 *
		 * @return {void}
		 */
		function begin_refresh() {
			invoke_extension_method( 'begin_refresh', [] );
			close_time_slot_overflow( false );
			if ( booking_resizing_controller && 'function' === typeof booking_resizing_controller.begin_refresh ) {
				booking_resizing_controller.begin_refresh();
			}
			if ( booking_overview_tooltip_controller ) {
				booking_overview_tooltip_controller.refresh();
			}
		}

		/**
		 * Register one freshly rendered segment with Booking Overview.
		 *
		 * @param {HTMLElement} segment_element Rendered canonical segment.
		 * @param {Object} segment Authorized compact booking DTO.
		 * @param {Object} resource_summary Authorized Resource summary.
		 * @return {void}
		 */
		function register_segment( segment_element, segment, resource_summary ) {
			invoke_extension_method( 'register_segment', [ segment_element, segment, resource_summary || {} ] );
			if ( booking_resizing_controller && segment_element && 'function' === typeof booking_resizing_controller.register_segment ) {
				booking_resizing_controller.register_segment( segment_element, segment );
			}
			if ( ! booking_overview_tooltip_controller || ! segment_element ) {
				return;
			}
			booking_overview_tooltip_controller.register(
				segment_element.querySelector( '[data-wpbc-booking-overview-info-trigger]' ),
				segment_element,
				segment,
				resource_summary || {}
			);
		}

		/**
		 * Begin one focused read-only projection refresh.
		 *
		 * The shared controller forwards only an executable-free presentation
		 * identity. Domain extensions own cache invalidation and never receive
		 * authority from rendered markup.
		 *
		 * @param {Object} refresh_context Presentation-owned accepted identity.
		 * @return {void}
		 */
		function begin_read_only_refresh( refresh_context ) {
			invoke_extension_method( 'begin_read_only_refresh', [ refresh_context || {} ] );
		}

		/**
		 * Register one read-only projection of an accepted booking segment.
		 *
		 * Read-only projections reuse canonical selection, Overview, and Inspector.
		 * Focused domain extensions may observe the accepted canonical segment and
		 * presentation context, but must independently obtain fresh server authority
		 * before exposing an interaction. The supplied DTO is never reconstructed
		 * from DOM attributes.
		 *
		 * @param {HTMLElement} segment_element Rendered read-only booking projection.
		 * @param {Object} segment Accepted authorized booking segment DTO.
		 * @param {Object} resource_summary Accepted authorized Resource summary.
		 * @param {Object} presentation_context Presentation-only render and boundary data.
		 * @return {void}
		 */
		function register_read_only_segment( segment_element, segment, resource_summary, presentation_context ) {
			invoke_extension_method( 'register_read_only_segment', [ segment_element, segment, resource_summary || {}, presentation_context || {} ] );
			if ( ! booking_overview_tooltip_controller || ! segment_element ) {
				return;
			}
			booking_overview_tooltip_controller.register(
				segment_element.querySelector( '[data-wpbc-booking-overview-info-trigger]' ),
				segment_element,
				segment,
				resource_summary || {}
			);
		}

		/**
		 * Reconcile canonical read-only booking presentation after local rendering.
		 *
		 * This intentionally excludes resize and movement refresh lifecycles because
		 * a read-only projection must never become mutation authority.
		 *
		 * @return {void}
		 */
		function complete_read_only_refresh( refresh_context ) {
			if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.complete_refresh ) {
				booking_overview_tooltip_controller.complete_refresh();
			}
			if ( booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.refresh ) {
				booking_inspector_adapter.refresh();
			}
			synchronize_booking_selection();
			invoke_extension_method( 'complete_read_only_refresh', [ refresh_context || {}, booking_selection_state ] );
			schedule_booking_control_rail_layout();
		}

		/**
		 * Reconcile adapters, selection, and geometry after booking rerender.
		 *
		 * @return {void}
		 */
		function complete_refresh() {
			if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.complete_refresh ) {
				booking_overview_tooltip_controller.complete_refresh();
			}
			if ( booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.refresh ) {
				booking_inspector_adapter.refresh();
			}
			synchronize_booking_selection();
			if ( booking_resizing_controller && 'function' === typeof booking_resizing_controller.complete_refresh ) {
				booking_resizing_controller.complete_refresh( booking_selection_state );
			}
			invoke_extension_method( 'complete_refresh', [ booking_selection_state ] );
			schedule_booking_control_rail_layout();
		}

		/**
		 * Suspend or resume Booking Overview during canonical Timeline loading.
		 *
		 * @param {boolean} is_loading Whether foreground replacement is active.
		 * @return {void}
		 */
		function set_request_loading( is_loading ) {
			invoke_extension_method( 'set_request_loading', [ Boolean( is_loading ) ] );
			if ( is_loading && booking_overview_tooltip_controller ) {
				booking_overview_tooltip_controller.suspend();
				return;
			}
			if ( ! is_loading && booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.resume ) {
				booking_overview_tooltip_controller.resume();
			}
		}

		/**
		 * Attach the settled rail geometry lifecycle to the Timeline axis.
		 *
		 * @return {void}
		 */
		function initialize_axis_rail_lifecycle() {
			axis_scroll_canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );
			if ( ! axis_scroll_canvas ) {
				return;
			}
			axis_scroll_uses_scrollend = 'onscrollend' in axis_scroll_canvas;
			if ( axis_scroll_uses_scrollend ) {
				axis_scroll_canvas.addEventListener( 'scrollend', schedule_booking_control_rail_layout, { passive: true } );
			} else {
				axis_scroll_canvas.addEventListener( 'scroll', schedule_booking_control_rail_layout_after_axis_motion, { passive: true } );
			}
			if ( window.visualViewport ) {
				window.visualViewport.addEventListener( 'resize', schedule_booking_control_rail_layout, { passive: true } );
				window.visualViewport.addEventListener( 'scroll', schedule_booking_control_rail_layout, { passive: true } );
			}
		}

		/**
		 * Remove axis and viewport listeners owned by booking geometry.
		 *
		 * @return {void}
		 */
		function destroy_axis_rail_lifecycle() {
			if ( axis_scroll_canvas ) {
				if ( axis_scroll_uses_scrollend ) {
					axis_scroll_canvas.removeEventListener( 'scrollend', schedule_booking_control_rail_layout );
				} else {
					axis_scroll_canvas.removeEventListener( 'scroll', schedule_booking_control_rail_layout_after_axis_motion );
				}
			}
			if ( window.visualViewport ) {
				window.visualViewport.removeEventListener( 'resize', schedule_booking_control_rail_layout );
				window.visualViewport.removeEventListener( 'scroll', schedule_booking_control_rail_layout );
			}
			axis_scroll_canvas = null;
			axis_scroll_uses_scrollend = false;
		}

		/**
		 * Initialize adapters, canonical refresh listener, and rail lifecycle once.
		 *
		 * @return {void}
		 */
		function initialize() {
			if ( ! mount || is_initialized ) {
				return;
			}
			is_initialized = true;
			initialize_booking_inspector();
			initialize_booking_resizing();
			initialize_booking_overview_tooltip();
			initialize_extensions();
			initialize_axis_rail_lifecycle();
			mount.addEventListener( 'wpbc:booking-inspector:saved', handle_booking_inspector_saved );
		}

		/**
		 * Destroy adapters, listeners, frames, timers, and browser-only state.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! is_initialized ) {
				return;
			}
			mount.removeEventListener( 'wpbc:booking-inspector:saved', handle_booking_inspector_saved );
			close_time_slot_overflow( false );
			destroy_extensions();
			resume_booking_overflow_tooltips();
			destroy_axis_rail_lifecycle();
			if ( booking_control_rail_settle_timer ) {
				window.clearTimeout( booking_control_rail_settle_timer );
				booking_control_rail_settle_timer = 0;
			}
			if ( booking_control_rail_frame ) {
				window.cancelAnimationFrame( booking_control_rail_frame );
				booking_control_rail_frame = 0;
			}
			if ( booking_overview_tooltip_controller && 'function' === typeof booking_overview_tooltip_controller.destroy ) {
				booking_overview_tooltip_controller.destroy();
			}
			if ( booking_resizing_controller && 'function' === typeof booking_resizing_controller.destroy ) {
				booking_resizing_controller.destroy();
			}
			if ( booking_inspector_adapter && 'function' === typeof booking_inspector_adapter.destroy ) {
				booking_inspector_adapter.destroy();
			}
			booking_overview_tooltip_controller = null;
			booking_resizing_controller = null;
			booking_inspector_adapter = null;
			booking_selection_state = create_empty_booking_selection_state();
			booking_inspector_refresh_generation = 0;
			is_initialized = false;
		}

		return {
			initialize: initialize,
			destroy: destroy,
			handle_click: handle_click,
			handle_keydown: handle_keydown,
			begin_refresh: begin_refresh,
			register_segment: register_segment,
			begin_read_only_refresh: begin_read_only_refresh,
			register_read_only_segment: register_read_only_segment,
			complete_refresh: complete_refresh,
			complete_read_only_refresh: complete_read_only_refresh,
			set_request_loading: set_request_loading,
			prepare_created_booking_readback: prepare_created_booking_readback,
			complete_created_booking_readback: complete_created_booking_readback,
			open_created_booking_inspector: open_created_booking_inspector,
			focus_created_booking: focus_created_booking,
			schedule_layout: schedule_booking_control_rail_layout,
			schedule_layout_after_axis_motion: schedule_booking_control_rail_layout_after_axis_motion,
			is_overview_suppressed: is_booking_overview_tooltip_suppressed
		};
	}

	if ( window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory ) {
		window.wpbc_timeline_modules.register_factory( module_id, create_booking_interactions_controller );
	}
}( window, document ) );
