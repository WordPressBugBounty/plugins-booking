/**
 * Booking Overview adapter for the shared Context Popover.
 *
 * The adapter owns the booking-domain DTO allow list, fixed WordPress template,
 * Timeline suppression policy, and Booking Inspector handoff. The shared
 * controller owns the configured portal, Tippy positioning, explicit-dismiss
 * lifecycle, and keyboard focus entry.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, wp, $ ) {
	'use strict';

	window.wpbc_booking_overview_tooltip = window.wpbc_booking_overview_tooltip || {};

	/**
	 * Create one host-scoped Booking Overview Context Popover adapter.
	 *
	 * @param {HTMLElement} root          Timeline root containing booking triggers.
	 * @param {Object}      configuration Executable-free server configuration.
	 * @param {Object}      callbacks     Timeline suppression and Inspector hooks.
	 * @return {Object|null} Domain adapter API, or null when dependencies are absent.
	 */
	function create_instance_controller( root, configuration, callbacks ) {
		configuration = configuration || {};
		callbacks = callbacks || {};
		if (
			! root
			|| ! configuration.active
			|| ! wp
			|| ! $
			|| 'function' !== typeof wp.template
			|| ! window.wpbc_shared_ui_context_popover
			|| 'function' !== typeof window.wpbc_shared_ui_context_popover.create
		) {
			return null;
		}

		var template = wp.template( String( configuration.template_id || '' ) );
		var header_template = wp.template( String( configuration.header_template_id || '' ) );
		var details_template = wp.template( String( configuration.details_template_id || '' ) );
		var summary_template = wp.template( String( configuration.summary_template_id || '' ) );
		var loading_template = wp.template( String( configuration.loading_template_id || '' ) );
		var error_template = wp.template( String( configuration.error_template_id || '' ) );
		var i18n = configuration.i18n && 'object' === typeof configuration.i18n ? configuration.i18n : {};
		var transport = configuration.transport && 'object' === typeof configuration.transport ? configuration.transport : {};
		var scroll_resume_delay_ms = normalize_delay( configuration.scroll_resume_delay_ms, 220, 100, 1000 );
		var positioning_boundary = root.querySelector( '[data-wpbc-timeline-canvas]' );
		var portal_host = root.querySelector( '[data-wpbc-timeline-canvas-axis-content]' );
		var trigger_dtos = new window.WeakMap();
		var trigger_contexts = new window.WeakMap();
		var trigger_cards = new window.WeakMap();
		var active_trigger = null;
		var active_generation = 0;
		var render_generation = 1;
		var details_cache = new window.Map();
		var inflight_requests = new window.Map();
		var maximum_cache_entries = 24;
		var scroll_timer = 0;
		var geometry_frame = 0;
		var geometry_resize_observer = null;
		var rebind_candidates = [];
		var refresh_rebind_pending = false;
		var blocking_suspension = false;
		var is_scrolling = false;
		var visibility_states = [ 'hidden', 'transient', 'pinned', 'temporarily_suspended' ];
		var details_states = [ 'idle', 'loading', 'ready', 'empty', 'error' ];
		var reference_states = [ 'live_control', 'temporarily_missing', 'outside_visible_canvas' ];
		var popover_state = create_empty_popover_state();
		var shared_controller;
		var popover_surface;

		if ( ! positioning_boundary || ! portal_host ) {
			return null;
		}

		shared_controller = window.wpbc_shared_ui_context_popover.create( {
			id: String( configuration.component_id || '' ),
			mode: 'interactive' === configuration.mode ? 'interactive' : 'preview',
			owner_id: String( configuration.owner_id || configuration.component_id || '' ),
			interaction_group: String( configuration.interaction_group || configuration.component_id || '' ),
			pin_policy: 'manual' === String( configuration.pin_policy || '' ) ? 'manual' : 'none',
			external_scroll_policy: 'retain' === String( configuration.external_scroll_policy || '' ) ? 'retain' : 'dismiss',
			dismiss_policy: 'explicit',
			external_scroll_grace_ms: scroll_resume_delay_ms,
			pin_label: normalize_text( i18n.pin, 160 ),
			pinned_label: normalize_text( i18n.pinned, 160 ),
			unpin_label: normalize_text( i18n.unpin, 160 ),
			drag_label: normalize_text( i18n.move, 160 ),
			title: normalize_text( i18n.title, 200 ),
			close_label: normalize_text( i18n.close, 160 ),
			show_delay_ms: configuration.show_delay_ms,
			hide_delay_ms: configuration.hide_delay_ms,
			pointer_anchor: 'trigger_block_edge',
			placement: 'bottom',
			fallback_placements: [ 'top' ],
			allow_flip: false,
			get_initial_placement_bounds: get_visible_timeline_rectangle,
			owns_trigger_aria: true,
			aria_haspopup: 'dialog',
			preferred_width: configuration.preferred_width,
			maximum_width: configuration.maximum_width,
			fixed_unpinned_height: configuration.fixed_unpinned_height,
			maximum_resized_width: configuration.maximum_resized_width,
			positioning_boundary: positioning_boundary,
			portal_host: portal_host,
			positioning_strategy: 'absolute',
			layer_z_index: configuration.layer_z_index,
			prevent_overflow: false,
			boundary_cross_axis: true,
			boundary_tether: false,
			fit_on_first_open: true === configuration.fit_on_first_open,
			pin_to_viewport: true === configuration.pin_to_viewport,
			draggable_when_pinned: true === configuration.draggable_when_pinned,
			resizable_when_pinned: true === configuration.resizable_when_pinned,
			resize_label: normalize_text( i18n.resize, 160 ),
			reference_policy: 'strict_live_owner',
			get_reference_rect: get_live_reference_rect,
			hide_arrow_when_pinned: true,
			on_open: handle_shared_open,
			on_close: handle_shared_close,
			on_pin_change: handle_shared_pin_change,
			on_suspend: handle_shared_suspend,
			on_resume: handle_shared_resume,
			on_retry: handle_retry
		} );
		popover_surface = shared_controller ? shared_controller.get_surface() : null;

		if ( ! shared_controller || ! popover_surface ) {
			return null;
		}
		popover_surface.classList.add( 'wpbc_booking_overview_tooltip__surface' );

		/**
		 * Create the independent page-memory state axes for Booking Overview.
		 *
		 * The owner uses canonical booking identity plus a render generation and
		 * segment hint. A DOM node is deliberately not part of this serializable
		 * state so a later phase can rebind after Timeline replaces card nodes.
		 *
		 * @return {Object} Empty visibility, details, owner, and reference state.
		 */
		function create_empty_popover_state() {
			return {
				visibility: 'hidden',
				details: 'idle',
				owner: {
					booking_id: 0,
					render_generation: 0,
					segment_hint: ''
				},
				reference: 'temporarily_missing'
			};
		}

		/**
		 * Commit one allow-listed popover state-axis value.
		 *
		 * @param {string} axis       Visibility, details, or reference axis.
		 * @param {string} next_value Candidate allow-listed value.
		 * @return {boolean} True when the requested value was accepted.
		 */
		function set_popover_axis( axis, next_value ) {
			var allowed_values = {
				visibility: visibility_states,
				details: details_states,
				reference: reference_states
			};

			if ( ! allowed_values[ axis ] || -1 === allowed_values[ axis ].indexOf( next_value ) ) {
				return false;
			}
			popover_state[ axis ] = next_value;

			return true;
		}

		/**
		 * Resolve the stable owner context registered for one rendered trigger.
		 *
		 * @param {HTMLElement|null} trigger Registered Timeline booking trigger.
		 * @return {Object} Canonical identity and render-generation context.
		 */
		function get_trigger_context( trigger ) {
			var context = trigger ? trigger_contexts.get( trigger ) : null;

			return context || {
				booking_id: 0,
				render_generation: 0,
				segment_hint: ''
			};
		}

		/**
		 * Return the visible viewport rectangle used by Timeline owner geometry.
		 *
		 * @return {Object} Physical viewport edges in CSS pixels.
		 */
		function get_visual_viewport_rectangle() {
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
				bottom: top + height
			};
		}

		/**
		 * Resolve the Timeline area in which a Booking Overview may be anchored.
		 *
		 * The visible area is the intersection of the time canvas and Visual
		 * Viewport below the sticky Resource/date header. Keeping this calculation
		 * in the Booking adapter preserves the shared controller's domain-neutral
		 * positioning contract.
		 *
		 * @return {Object|null} Physical visible edges in CSS pixels, or null.
		 */
		function get_visible_timeline_rectangle() {
			var canvas_rectangle;
			var viewport_rectangle;
			var sticky_header;
			var sticky_rectangle;
			var visible_left;
			var visible_top;
			var visible_right;
			var visible_bottom;

			if (
				! positioning_boundary
				|| ! positioning_boundary.isConnected
			) {
				return null;
			}
			canvas_rectangle = positioning_boundary.getBoundingClientRect();
			viewport_rectangle = get_visual_viewport_rectangle();
			visible_left = Math.max( canvas_rectangle.left, viewport_rectangle.left );
			visible_top = Math.max( canvas_rectangle.top, viewport_rectangle.top );
			visible_right = Math.min( canvas_rectangle.right, viewport_rectangle.right );
			visible_bottom = Math.min( canvas_rectangle.bottom, viewport_rectangle.bottom );
			sticky_header = root.querySelector( '.wpbc_timeline__sticky_header' );
			if ( sticky_header && sticky_header.getClientRects().length ) {
				sticky_rectangle = sticky_header.getBoundingClientRect();
				if (
					sticky_rectangle.bottom > visible_top
					&& sticky_rectangle.top < visible_bottom
					&& sticky_rectangle.right > visible_left
					&& sticky_rectangle.left < visible_right
				) {
					visible_top = Math.min( visible_bottom, Math.max( visible_top, sticky_rectangle.bottom ) );
				}
			}
			if ( visible_right <= visible_left || visible_bottom <= visible_top ) {
				return null;
			}

			return {
				left: visible_left,
				top: visible_top,
				right: visible_right,
				bottom: visible_bottom,
				width: visible_right - visible_left,
				height: visible_bottom - visible_top,
				x: visible_left,
				y: visible_top
			};
		}

		/**
		 * Resolve one registered information button's current physical rectangle.
		 *
		 * @param {HTMLElement|null} trigger Registered booking information button.
		 * @return {DOMRect|null} Current trigger rectangle or null when unavailable.
		 */
		function get_trigger_rectangle( trigger ) {
			if ( ! trigger || ! trigger.isConnected || ! root.contains( trigger ) ) {
				return null;
			}

			return trigger.getBoundingClientRect();
		}

		/**
		 * Determine whether two physical rectangles overlap with positive area.
		 *
		 * @param {Object} first_rectangle  First physical rectangle.
		 * @param {Object} second_rectangle Second physical rectangle.
		 * @return {boolean} True when the rectangles intersect.
		 */
		function rectangles_intersect( first_rectangle, second_rectangle ) {
			return first_rectangle.right > second_rectangle.left
				&& first_rectangle.left < second_rectangle.right
				&& first_rectangle.bottom > second_rectangle.top
				&& first_rectangle.top < second_rectangle.bottom;
		}

		/**
		 * Resolve the live reference for one authorized control.
		 *
		 * Detached controls still return null so the strict-owner policy can suspend
		 * safely. The raw rectangle lets the axis-owned portal move and clip with the
		 * booking instead of being held at a browser or canvas edge.
		 *
		 * @param {HTMLElement|null} trigger Registered booking information button.
		 * @return {Object|null} Popper-compatible reference rectangle or null.
		 */
		function get_live_reference_rect( trigger ) {
			return get_trigger_rectangle( trigger );
		}

		/**
		 * Classify the current trigger reference without making it the owner ID.
		 *
		 * @param {HTMLElement|null} trigger Registered Timeline booking trigger.
		 * @return {string} Allow-listed reference lifecycle state.
		 */
		function get_trigger_reference_state( trigger ) {
			var trigger_rectangle = get_trigger_rectangle( trigger );
			var visible_rectangle;

			if ( ! trigger_rectangle ) {
				return 'temporarily_missing';
			}
			visible_rectangle = get_visible_timeline_rectangle();
			if ( ! visible_rectangle || ! rectangles_intersect( trigger_rectangle, visible_rectangle ) ) {
				return 'outside_visible_canvas';
			}

			return 'live_control';
		}

		/**
		 * Copy state for diagnostics and future Timeline rebind orchestration.
		 *
		 * @return {Object} Executable-free snapshot with no DOM reference.
		 */
		function get_popover_state() {
			return {
				visibility: popover_state.visibility,
				details: popover_state.details,
				owner: {
					booking_id: popover_state.owner.booking_id,
					render_generation: popover_state.owner.render_generation,
					segment_hint: popover_state.owner.segment_hint
				},
				reference: popover_state.reference
			};
		}

		/**
		 * Retain the trigger accepted by this adapter's shared controller.
		 *
		 * @param {Object}      opened_controller Shared controller instance.
		 * @param {HTMLElement} trigger           Activating booking card.
		 * @return {void}
		 */
		function handle_shared_open( opened_controller, trigger ) {
			if ( opened_controller === shared_controller ) {
				active_trigger = trigger;
				popover_state.owner = get_trigger_context( trigger );
				set_popover_axis( 'visibility', shared_controller.is_pinned() ? 'pinned' : 'transient' );
				set_popover_axis( 'reference', get_trigger_reference_state( trigger ) );
				observe_active_geometry();
				load_details( trigger );
			}
		}

		/**
		 * Release the active booking trigger after this shared instance closes.
		 *
		 * @return {void}
		 */
		function handle_shared_close() {
			stop_geometry_tracking();
			active_generation += 1;
			active_trigger = null;
			popover_state = create_empty_popover_state();
		}

		/**
		 * Mirror the shared neutral pin state into domain page memory.
		 *
		 * @param {Object}  changed_controller Shared controller instance.
		 * @param {boolean} is_pinned         Current neutral pin state.
		 * @return {void}
		 */
		function handle_shared_pin_change( changed_controller, is_pinned ) {
			if ( changed_controller !== shared_controller || ! active_trigger ) {
				return;
			}
			set_popover_axis( 'visibility', is_pinned ? 'pinned' : 'transient' );
			schedule_live_geometry_update();
		}

		/**
		 * Retain domain identity while a blocking layer owns visual presence.
		 *
		 * @param {Object} suspended_controller Shared controller instance.
		 * @return {void}
		 */
		function handle_shared_suspend( suspended_controller ) {
			if ( suspended_controller === shared_controller && active_trigger ) {
				set_popover_axis( 'visibility', 'temporarily_suspended' );
				if ( 'temporarily_missing' !== popover_state.reference ) {
					set_popover_axis( 'reference', get_trigger_reference_state( active_trigger ) );
				}
			}
		}

		/**
		 * Restore pinned page-memory visibility after safe shared resumption.
		 *
		 * @param {Object} resumed_controller Shared controller instance.
		 * @return {void}
		 */
		function handle_shared_resume( resumed_controller ) {
			if ( resumed_controller === shared_controller && active_trigger ) {
				set_popover_axis( 'visibility', 'pinned' );
				set_popover_axis( 'reference', get_trigger_reference_state( active_trigger ) );
				observe_active_geometry();
				if ( -1 !== [ 'idle', 'loading' ].indexOf( popover_state.details ) ) {
					load_details( active_trigger );
				}
			}
		}

		/**
		 * Cancel the single pending geometry frame owned by this adapter.
		 *
		 * @return {void}
		 */
		function cancel_geometry_frame() {
			if ( geometry_frame ) {
				window.cancelAnimationFrame( geometry_frame );
				geometry_frame = 0;
			}
		}

		/**
		 * Stop active owner observation when the popover no longer owns a booking.
		 *
		 * @return {void}
		 */
		function stop_geometry_tracking() {
			cancel_geometry_frame();
			if ( geometry_resize_observer ) {
				geometry_resize_observer.disconnect();
			}
		}

		/**
		 * Observe only the current owner and its shared layout containers.
		 *
		 * One controller owns one observer; no observer is allocated per booking.
		 *
		 * @return {void}
		 */
		function observe_active_geometry() {
			var active_card = active_trigger ? trigger_cards.get( active_trigger ) : null;
			var observed_nodes = [ root, positioning_boundary, active_card, active_trigger ];

			if ( 'function' !== typeof window.ResizeObserver || ! active_trigger ) {
				return;
			}
			if ( ! geometry_resize_observer ) {
				geometry_resize_observer = new window.ResizeObserver( schedule_live_geometry_update );
			}
			geometry_resize_observer.disconnect();
			observed_nodes.forEach( function ( observed_node, observed_index ) {
				if (
					observed_node
					&& observed_node.isConnected
					&& observed_nodes.indexOf( observed_node ) === observed_index
				) {
					geometry_resize_observer.observe( observed_node );
				}
			} );
		}

		/**
		 * Apply one current owner measurement after coalesced layout changes.
		 *
		 * @return {void}
		 */
		function update_live_geometry() {
			var reference_state;
			var suspension_reason;

			if ( ! active_trigger || ( ! shared_controller.is_open() && ! shared_controller.is_pinned() ) ) {
				return;
			}
			reference_state = get_trigger_reference_state( active_trigger );
			set_popover_axis( 'reference', reference_state );
			if ( 'temporarily_missing' === reference_state ) {
				if ( shared_controller.is_pinned() ) {
					shared_controller.suspend( 'reference_unavailable' );
				} else if ( shared_controller.is_open() ) {
					shared_controller.request_close( 'external_scroll', false );
				}
				return;
			}
			if ( shared_controller.is_suspended() ) {
				suspension_reason = shared_controller.get_suspension_reason();
				if ( ! blocking_suspension && 'reference_unavailable' === suspension_reason ) {
					shared_controller.resume();
				}
				return;
			}
			shared_controller.update_reference();
		}

		/**
		 * Coalesce scroll, resize, image, and observer notifications into one frame.
		 *
		 * @return {void}
		 */
		function schedule_live_geometry_update() {
			if (
				geometry_frame
				|| ! active_trigger
				|| ( ! shared_controller.is_open() && ! shared_controller.is_pinned() )
			) {
				return;
			}
			geometry_frame = window.requestAnimationFrame( function () {
				geometry_frame = 0;
				update_live_geometry();
			} );
		}

		/**
		 * Retry the current booking without trusting stale error-state data.
		 *
		 * @return {void}
		 */
		function handle_retry() {
			var trigger = active_trigger;
			var booking_id;

			if ( ! trigger || ! trigger.isConnected || ! root.contains( trigger ) || ! get_trigger_context( trigger ).booking_id ) {
				shared_controller.request_close( 'authorization_invalidation', false );
				return;
			}
			booking_id = get_trigger_booking_id( trigger );
			if ( ! get_booking_view( booking_id ) ) {
				shared_controller.request_close( 'authorization_invalidation', false );
				return;
			}
			invalidate_booking( booking_id, false );
			load_details( trigger );
		}

		/**
		 * Normalize a bounded millisecond delay.
		 *
		 * @param {*}      candidate Candidate delay.
		 * @param {number} fallback  Fallback delay.
		 * @param {number} minimum   Minimum delay.
		 * @param {number} maximum   Maximum delay.
		 * @return {number} Bounded integer delay.
		 */
		function normalize_delay( candidate, fallback, minimum, maximum ) {
			candidate = Number( candidate );
			if ( ! Number.isFinite( candidate ) ) {
				candidate = fallback;
			}

			return Math.max( minimum, Math.min( maximum, Math.round( candidate ) ) );
		}

		/**
		 * Normalize one bounded tooltip DTO at the browser trust boundary.
		 *
		 * Unknown keys are discarded so compact card data cannot accidentally
		 * expand into notes, raw form storage, ownership, or financial fields.
		 *
		 * @param {Object} dto Server-authorized Booking Overview DTO.
		 * @return {Object|null} Executable-free allow-listed DTO, or null.
		 */
		function normalize_dto( dto, resource_summary ) {
			var booking_id = Math.max( 0, Math.round( Number( dto && dto.booking_id ) || 0 ) );
			var resource_id = Math.max( 0, Math.round( Number( dto && dto.resource_id ) || 0 ) );

			if ( ! dto || 1 !== Number( dto.schema_version ) || ! booking_id ) {
				return null;
			}

			return {
				schema_version: 1,
				booking_id: booking_id,
				resource_id: resource_id,
				heading: normalize_text( dto.heading, 160 ),
				label: normalize_text( dto.label, 200 ),
				status_key: 'pending' === String( dto.status_key || '' ) ? 'pending' : 'approved',
				status_label: normalize_text( dto.status_label, 160 ),
				start_label: normalize_text( dto.start_label, 160 ),
				end_label: normalize_text( dto.end_label, 160 ),
				date_label: normalize_text( dto.date_label, 160 ),
				duration_label: normalize_text( dto.duration_label, 160 ),
				is_clipped_start: Boolean( dto.is_clipped_start ),
				is_clipped_end: Boolean( dto.is_clipped_end ),
				continues_before_label: normalize_text( dto.continues_before_label, 160 ),
				continues_after_label: normalize_text( dto.continues_after_label, 160 ),
				open_details_label: normalize_text( i18n.open_details, 160 ),
				resource: normalize_resource_summary( resource_summary, resource_id )
			};
		}

		/**
		 * Reduce one already-authorized Timeline Resource list DTO for the summary.
		 *
		 * The Resource must match the segment's authorized Resource identity. Exact
		 * booking allocations and saved financial values remain lazy-only data.
		 *
		 * @param {Object} resource_summary Authorized host Resource list DTO.
		 * @param {number} resource_id      Expected segment Resource ID.
		 * @return {Object} Bounded presentation-only Resource summary.
		 */
		function normalize_resource_summary( resource_summary, resource_id ) {
			var candidate_id = Math.max( 0, Math.round( Number( resource_summary && resource_summary.id ) || 0 ) );

			if ( ! resource_id || candidate_id !== resource_id ) {
				return {
					resource_id: 0,
					title: '',
					subtitle: '',
					picture_url: ''
				};
			}

			return {
				resource_id: candidate_id,
				title: normalize_text( resource_summary.title, 240 ),
				subtitle: normalize_text( resource_summary.subtitle, 160 ),
				picture_url: normalize_url( resource_summary.image_url )
			};
		}

		/**
		 * Normalize the complete lazy response through an exact browser allow list.
		 *
		 * @param {Object} dto Server-authorized complete overview DTO.
		 * @return {Object|null} Template-safe details, or null.
		 */
		function normalize_details_dto( dto ) {
			var booking_id = Math.max( 0, Math.round( Number( dto && dto.booking_id ) || 0 ) );
			var status = dto && dto.status && 'object' === typeof dto.status ? dto.status : {};
			var resource = dto && dto.resource && 'object' === typeof dto.resource ? dto.resource : {};
			var pricing = resource.pricing && 'object' === typeof resource.pricing ? resource.pricing : {};
			var costs = dto && dto.costs && 'object' === typeof dto.costs ? dto.costs : {};
			var payment = costs.payment && 'object' === typeof costs.payment ? costs.payment : {};
			var truncation = dto && dto.truncation && 'object' === typeof dto.truncation ? dto.truncation : {};

			if ( ! dto || 1 !== Number( dto.schema_version ) || ! booking_id ) {
				return null;
			}

			return {
				schema_version: 1,
				booking_id: booking_id,
				heading: normalize_text( dto.heading, 160 ),
				title: normalize_text( dto.title, 240 ),
				status: {
					key: -1 !== [ 'approved', 'pending' ].indexOf( String( status.key || '' ) ) ? String( status.key ) : 'unknown',
					label: normalize_text( status.label, 160 )
				},
				resource: {
					resource_id: Math.max( 0, Math.round( Number( resource.resource_id ) || 0 ) ),
					title: normalize_text( resource.title, 240 ),
					description: normalize_text( resource.description, 1000 ),
					picture_url: normalize_url( resource.picture_url ),
					allocation_count: Math.max( 0, Math.round( Number( resource.allocation_count ) || 0 ) ),
					pricing: {
						supported: Boolean( pricing.supported ),
						formatted_cost: normalize_text( pricing.formatted_cost, 160 ),
						period_label: normalize_text( pricing.period_label, 80 )
					}
				},
				intervals: normalize_record_list( dto.intervals, 200, normalize_interval ),
				selected_dates: normalize_record_list( dto.selected_dates, 366, normalize_selected_date ),
				duration_metrics: normalize_text_list( dto.duration_metrics, 10, 200 ),
				fields: normalize_record_list( dto.fields, 100, normalize_field ),
				costs: {
					supported: Boolean( costs.supported ),
					has_saved_cost: Boolean( costs.has_saved_cost ),
					saved_cost_formatted: normalize_text( costs.saved_cost_formatted, 160 ),
					payment: {
						state: -1 !== [ 'paid', 'not_paid', 'unknown' ].indexOf( String( payment.state || '' ) ) ? String( payment.state ) : 'unknown',
						label: normalize_text( payment.label, 160 )
					}
				},
				created_label: normalize_text( dto.created_label, 200 ),
				truncation: {
					intervals: Boolean( truncation.intervals ),
					selected_dates: Boolean( truncation.selected_dates ),
					fields: Boolean( truncation.fields )
				},
				is_truncated: Boolean( truncation.intervals || truncation.selected_dates || truncation.fields ),
				open_details_label: normalize_text( i18n.open_details, 160 ),
				i18n: {
					resource: normalize_text( i18n.resource, 160 ),
					intervals: normalize_text( i18n.intervals, 160 ),
					selected_dates: normalize_text( i18n.selected_dates, 160 ),
					booking_data: normalize_text( i18n.booking_data, 160 ),
					saved_cost: normalize_text( i18n.saved_cost, 160 ),
					payment_status: normalize_text( i18n.payment_status, 160 ),
					created: normalize_text( i18n.created, 160 ),
					not_available: normalize_text( i18n.not_available, 160 ),
					empty_fields: normalize_text( i18n.empty_fields, 240 ),
					unsupported_financials: normalize_text( i18n.unsupported_financials, 240 ),
					truncated: normalize_text( i18n.truncated, 320 )
				}
			};
		}

		/**
		 * Normalize one canonical interval at the browser trust boundary.
		 *
		 * @param {Object} interval Candidate interval.
		 * @return {Object} One normalized interval.
		 */
		function normalize_interval( interval ) {
			return {
				start_at: normalize_text( interval.start_at, 80 ),
				end_at: normalize_text( interval.end_at, 80 ),
				start_label: normalize_text( interval.start_label, 200 ),
				end_label: normalize_text( interval.end_label, 200 ),
				duration_label: normalize_text( interval.duration_label, 160 ),
				is_full_day: Boolean( interval.is_full_day ),
				is_overnight: Boolean( interval.is_overnight )
			};
		}

		/**
		 * Normalize one individual selected-date projection.
		 *
		 * @param {Object} selected_date Candidate selected date.
		 * @return {Object} One normalized selected date.
		 */
		function normalize_selected_date( selected_date ) {
			return {
				date: normalize_text( selected_date.date, 20 ),
				date_label: normalize_text( selected_date.date_label, 160 ),
				time_label: normalize_text( selected_date.time_label, 160 ),
				boundary: normalize_text( selected_date.boundary, 20 )
			};
		}

		/**
		 * Normalize one authorized form-field display row.
		 *
		 * @param {Object} field Candidate form-field row.
		 * @return {Object} One normalized form-field display row.
		 */
		function normalize_field( field ) {
			return {
				label: normalize_text( field.label, 200 ),
				value: normalize_text( field.value, 2000 )
			};
		}

		/**
		 * Normalize a bounded list of plain records.
		 *
		 * @param {*}        records       Candidate records.
		 * @param {number}   maximum_items Maximum records.
		 * @param {Function} mapper        Record mapper.
		 * @return {Array} Normalized records.
		 */
		function normalize_record_list( records, maximum_items, mapper ) {
			return ( Array.isArray( records ) ? records : [] ).slice( 0, maximum_items ).filter( function ( record ) {
				return record && 'object' === typeof record && ! Array.isArray( record );
			} ).map( mapper );
		}

		/**
		 * Normalize a bounded list of scalar text values.
		 *
		 * @param {*}      values         Candidate values.
		 * @param {number} maximum_items  Maximum returned values.
		 * @param {number} maximum_length Maximum characters per value.
		 * @return {Array} Bounded scalar text values.
		 */
		function normalize_text_list( values, maximum_items, maximum_length ) {
			return ( Array.isArray( values ) ? values : [] ).slice( 0, maximum_items ).map( function ( value ) {
				return normalize_text( value, maximum_length );
			} ).filter( Boolean );
		}

		/**
		 * Keep only HTTP(S) or protocol-relative image URLs.
		 *
		 * @param {*} candidate Candidate URL.
		 * @return {string} HTTP(S) image URL or an empty string.
		 */
		function normalize_url( candidate ) {
			candidate = normalize_text( candidate, 2000 );
			return /^(https?:)?\/\//i.test( candidate ) ? candidate : '';
		}

		/**
		 * Convert one scalar to bounded plain text.
		 *
		 * @param {*}      candidate  Candidate scalar.
		 * @param {number} max_length Maximum character count.
		 * @return {string} Bounded plain text.
		 */
		function normalize_text( candidate, max_length ) {
			if ( null === candidate || 'undefined' === typeof candidate || ( 'string' !== typeof candidate && 'number' !== typeof candidate ) ) {
				return '';
			}

			return String( candidate ).slice( 0, max_length );
		}

		/**
		 * Return the authoritative booking ID associated with a registered trigger.
		 *
		 * @param {HTMLElement} trigger Registered booking trigger.
		 * @return {number} Positive booking ID, or zero.
		 */
		function get_trigger_booking_id( trigger ) {
			var dto = trigger ? trigger_dtos.get( trigger ) : null;

			return dto ? Math.max( 0, Math.round( Number( dto.booking_id ) || 0 ) ) : 0;
		}

		/**
		 * Determine whether an asynchronous result still owns the visible surface.
		 *
		 * @param {HTMLElement} trigger    Trigger captured at request time.
		 * @param {number}      generation Adapter generation captured at request time.
		 * @param {Object}      owner_context Stable owner and rebind generation.
		 * @return {boolean} True when the response may replace current content.
		 */
		function is_current_request( trigger, generation, owner_context ) {
			var current_context = get_trigger_context( trigger );

			return generation === active_generation
				&& trigger === active_trigger
				&& trigger.isConnected
				&& root.contains( trigger )
				&& shared_controller.is_open()
				&& owner_context.booking_id === popover_state.owner.booking_id
				&& owner_context.render_generation === popover_state.owner.render_generation
				&& owner_context.segment_hint === popover_state.owner.segment_hint
				&& owner_context.booking_id === current_context.booking_id
				&& owner_context.render_generation === current_context.render_generation
				&& owner_context.segment_hint === current_context.segment_hint;
		}

		/**
		 * Return the current stable booking-owned view for one booking identity.
		 *
		 * @param {number} booking_id Expected canonical booking ID.
		 * @return {HTMLElement|null} Current domain view, or null.
		 */
		function get_booking_view( booking_id ) {
			var view = popover_surface.querySelector( '[data-wpbc-booking-overview-view]' );

			return view && Number( view.getAttribute( 'data-wpbc-booking-id' ) ) === booking_id ? view : null;
		}

		/**
		 * Build common translated labels for booking-owned partial templates.
		 *
		 * @return {Object} Bounded presentation labels.
		 */
		function get_template_i18n() {
			return {
				resource: normalize_text( i18n.resource, 160 ),
				start: normalize_text( i18n.start, 160 ),
				end: normalize_text( i18n.end, 160 ),
				duration: normalize_text( i18n.duration, 160 ),
				intervals: normalize_text( i18n.intervals, 160 ),
				booking_data: normalize_text( i18n.booking_data, 160 ),
				selected_dates: normalize_text( i18n.selected_dates, 160 ),
				saved_cost: normalize_text( i18n.saved_cost, 160 ),
				payment_status: normalize_text( i18n.payment_status, 160 ),
				created: normalize_text( i18n.created, 160 ),
				not_available: normalize_text( i18n.not_available, 160 ),
				empty_fields: normalize_text( i18n.empty_fields, 240 ),
				unsupported_financials: normalize_text( i18n.unsupported_financials, 240 ),
				truncated: normalize_text( i18n.truncated, 320 )
			};
		}

		/**
		 * Build the left summary from the authorized card schedule, then enrich it
		 * with the canonical lazy Resource, interval, and selected dates.
		 *
		 * @param {Object}      compact_dto Authorized compact booking projection.
		 * @param {Object|null} details    Optional authorized lazy projection.
		 * @return {Object} Template-ready summary model.
		 */
		function build_summary_model( compact_dto, details ) {
			var first_interval = details && details.intervals.length ? details.intervals[ 0 ] : null;
			var resource = compact_dto.resource;
			var resource_pricing;

			if ( details && details.resource.resource_id ) {
				resource_pricing = details.resource.pricing;
				resource = {
					resource_id: details.resource.resource_id,
					title: details.resource.title,
					subtitle: resource_pricing.supported && resource_pricing.formatted_cost
						? resource_pricing.formatted_cost + ( resource_pricing.period_label ? ' / ' + resource_pricing.period_label : '' )
						: compact_dto.resource.subtitle,
					picture_url: details.resource.picture_url || compact_dto.resource.picture_url
				};
			}

			return {
				resource: resource,
				start_label: first_interval ? first_interval.start_label : compact_dto.start_label,
				end_label: first_interval ? first_interval.end_label : compact_dto.end_label,
				duration_label: first_interval ? first_interval.duration_label : compact_dto.duration_label,
				interval_count: details ? details.intervals.length : 0,
				additional_intervals: details && 1 < details.intervals.length ? details.intervals.slice( 1 ) : [],
				selected_dates: details ? details.selected_dates : [],
				i18n: get_template_i18n()
			};
		}

		/**
		 * Render the stable booking-owned view once for the current owner.
		 *
		 * @param {Object} compact_dto Authorized compact booking projection.
		 * @return {void}
		 */
		function render_booking_view( compact_dto ) {
			shared_controller.set_header(
				header_template( {
					heading: compact_dto.heading,
					label: compact_dto.label,
					status_key: compact_dto.status_key,
					status_label: compact_dto.status_label
				} ),
				compact_dto.heading
			);
			shared_controller.set_content(
				template( {
					booking_id: compact_dto.booking_id,
					summary_html: summary_template( build_summary_model( compact_dto, null ) ),
					details_html: loading_template( {
						message: normalize_text( i18n.loading, 240 )
					} ),
					open_details_label: compact_dto.open_details_label
				} ),
				''
			);
			shared_controller.set_busy( true, normalize_text( i18n.loading, 240 ) );
		}

		/**
		 * Replace one booking-owned partial while preserving focus in its host.
		 *
		 * @param {HTMLElement} host            Stable partial host.
		 * @param {string}      rendered_markup Fixed-template markup.
		 * @return {void}
		 */
		function replace_partial( host, rendered_markup ) {
			if ( ! host ) {
				return;
			}
			if ( host.contains( document.activeElement ) ) {
				host.focus();
			}
			host.innerHTML = String( rendered_markup || '' );
		}

		/**
		 * Render complete details and ask Popper to measure the changed surface.
		 *
		 * @param {Object}      details    Normalized complete details.
		 * @param {HTMLElement} trigger    Owning trigger.
		 * @param {number}      generation Owning adapter generation.
		 * @return {void}
		 */
		function render_details( details, trigger, generation, owner_context ) {
			var compact_dto;
			var view;
			var summary_host;
			var details_host;

			if ( ! is_current_request( trigger, generation, owner_context ) ) {
				return;
			}
			compact_dto = trigger_dtos.get( trigger );
			view = get_booking_view( details.booking_id );
			if ( ! compact_dto || ! view ) {
				return;
			}
			summary_host = view.querySelector( '[data-wpbc-booking-overview-summary-host]' );
			details_host = view.querySelector( '[data-wpbc-booking-overview-details-host]' );
			replace_partial( summary_host, summary_template( build_summary_model( compact_dto, details ) ) );
			replace_partial( details_host, details_template( details ) );
			if ( details_host ) {
				details_host.setAttribute( 'aria-busy', 'false' );
			}
			set_popover_axis( 'details', 'ready' );
			shared_controller.set_busy( false, normalize_text( i18n.loaded, 240 ) );
			window.requestAnimationFrame( function () {
				if ( is_current_request( trigger, generation, owner_context ) ) {
					shared_controller.update_reference();
				}
			} );
		}

		/**
		 * Render a recoverable right-column error without replacing known summary,
		 * shell controls, or the Open booking details action.
		 *
		 * @param {HTMLElement} trigger       Current booking owner.
		 * @param {number}      generation    Current request generation.
		 * @param {Object}      owner_context Stable owner and rebind generation.
		 * @return {void}
		 */
		function render_details_error( trigger, generation, owner_context ) {
			var view;
			var details_host;

			if ( ! is_current_request( trigger, generation, owner_context ) ) {
				return;
			}
			view = get_booking_view( owner_context.booking_id );
			details_host = view ? view.querySelector( '[data-wpbc-booking-overview-details-host]' ) : null;
			replace_partial( details_host, error_template( {
				message: normalize_text( i18n.error, 500 ),
				retry_label: normalize_text( i18n.retry, 160 )
			} ) );
			if ( details_host ) {
				details_host.setAttribute( 'aria-busy', 'false' );
			}
			set_popover_axis( 'details', 'error' );
			shared_controller.set_busy( false, normalize_text( i18n.error, 500 ) );
			shared_controller.update_reference();
		}

		/**
		 * Render the booking-owned right-column loading state in place.
		 *
		 * @param {HTMLElement} trigger Current booking owner.
		 * @return {void}
		 */
		function render_details_loading( trigger ) {
			var booking_id = get_trigger_booking_id( trigger );
			var view = get_booking_view( booking_id );
			var details_host = view ? view.querySelector( '[data-wpbc-booking-overview-details-host]' ) : null;

			replace_partial( details_host, loading_template( {
				message: normalize_text( i18n.loading, 240 )
			} ) );
			if ( details_host ) {
				details_host.setAttribute( 'aria-busy', 'true' );
			}
			shared_controller.set_busy( true, normalize_text( i18n.loading, 240 ) );
		}

		/**
		 * Start or join one booking-details request and guard every UI update.
		 *
		 * @param {HTMLElement} trigger Active booking trigger.
		 * @return {void}
		 */
		function load_details( trigger ) {
			var booking_id = get_trigger_booking_id( trigger );
			var cache_key = String( booking_id );
			var generation = active_generation + 1;
			var owner_context = get_trigger_context( trigger );
			var request_entry;
			var cached_details;

			active_generation = generation;
			set_popover_axis( 'details', 'loading' );
			if ( ! booking_id || ! transport.url || ! transport.action || ! transport.nonce || ! transport.source ) {
				render_details_error( trigger, generation, owner_context );
				return;
			}
			if ( details_cache.has( cache_key ) ) {
				cached_details = details_cache.get( cache_key );
				details_cache.delete( cache_key );
				details_cache.set( cache_key, cached_details );
				render_details( cached_details, trigger, generation, owner_context );
				return;
			}
			render_details_loading( trigger );
			if ( inflight_requests.has( cache_key ) ) {
				request_entry = inflight_requests.get( cache_key );
			} else {
				request_entry = {
					request: $.ajax( {
						url: String( transport.url ),
						method: 'POST',
						dataType: 'json',
						data: {
							action: String( transport.action ),
							nonce: String( transport.nonce ),
							source: String( transport.source ),
							booking_id: booking_id
						}
					} )
				};
				inflight_requests.set( cache_key, request_entry );
				request_entry.request.always( function () {
					if ( inflight_requests.get( cache_key ) === request_entry ) {
						inflight_requests.delete( cache_key );
					}
				} );
			}

			request_entry.request.done( function ( response ) {
				var details = normalize_details_dto( response && response.success && response.data ? response.data.overview : null );

				if ( ! details || details.booking_id !== booking_id ) {
					render_details_error( trigger, generation, owner_context );
					return;
				}
				if ( details_cache.has( cache_key ) ) {
					details_cache.delete( cache_key );
				}
				details_cache.set( cache_key, details );
				while ( maximum_cache_entries < details_cache.size ) {
					details_cache.delete( details_cache.keys().next().value );
				}
				render_details( details, trigger, generation, owner_context );
			} );
			request_entry.request.fail( function ( request, request_status ) {
				if ( 'abort' === request_status ) {
					return;
				}
				if ( -1 !== [ 401, 403, 404 ].indexOf( Number( request && request.status ) ) ) {
					clear_details_state();
					shared_controller.request_close( 'authorization_invalidation', false );
					return;
				}
				render_details_error( trigger, generation, owner_context );
			} );
		}

		/**
		 * Abort and forget one cached or in-flight booking read.
		 *
		 * @param {number}  booking_id      Booking ID, or zero for no specific record.
		 * @param {boolean} increment_state Whether active response generations become stale.
		 * @return {void}
		 */
		function invalidate_booking( booking_id, increment_state ) {
			var cache_key = String( Math.max( 0, Math.round( Number( booking_id ) || 0 ) ) );
			var request_entry = inflight_requests.get( cache_key );

			if ( increment_state ) {
				active_generation += 1;
			}
			details_cache.delete( cache_key );
			if ( request_entry && request_entry.request && 'function' === typeof request_entry.request.abort ) {
				request_entry.request.abort();
			}
			inflight_requests.delete( cache_key );
		}

		/**
		 * Abort all pending reads and clear the page-memory cache.
		 *
		 * @return {void}
		 */
		function clear_details_state() {
			active_generation += 1;
			inflight_requests.forEach( function ( request_entry ) {
				if ( request_entry.request && 'function' === typeof request_entry.request.abort ) {
					request_entry.request.abort();
				}
			} );
			inflight_requests.clear();
			details_cache.clear();
		}

		/**
		 * Resolve only the dedicated registered information control.
		 *
		 * @param {EventTarget|null} event_target Event target.
		 * @return {HTMLElement|null} Registered trigger, or null.
		 */
		function get_trigger( event_target ) {
			var element = event_target && 1 === event_target.nodeType ? event_target : null;
			var trigger;

			if ( ! element || element.closest( '[data-wpbc-ui-catalog-overflow-tooltip]' ) ) {
				return null;
			}
			trigger = element.closest( '[data-wpbc-booking-overview-info-trigger]' );

			return trigger && root.contains( trigger ) && trigger_dtos.has( trigger ) ? trigger : null;
		}

		/**
		 * Verify that a dedicated trigger still belongs to its registered card.
		 *
		 * Narrow Timeline segments may move the same control node into a row-scoped
		 * overlay after layout. In that state DOM containment is intentionally no
		 * longer the identity boundary, so the domain-owned booking ID and stable
		 * segment hint must match the separate card context exactly.
		 *
		 * @param {HTMLElement} trigger Dedicated information control.
		 * @param {HTMLElement} card    Separate Timeline booking card.
		 * @param {Object}      dto     Normalized compact booking DTO.
		 * @return {boolean} True when containment or explicit identity proves ownership.
		 */
		function trigger_belongs_to_card( trigger, card, dto ) {
			var trigger_booking_id;
			var card_booking_id;
			var trigger_segment_hint;
			var card_segment_hint;

			if ( card.contains( trigger ) ) {
				return true;
			}
			trigger_booking_id = Math.max( 0, Math.round( Number( trigger.getAttribute( 'data-wpbc-timeline-booking-id' ) ) || 0 ) );
			card_booking_id = Math.max( 0, Math.round( Number( card.getAttribute( 'data-wpbc-timeline-booking-id' ) ) || 0 ) );
			trigger_segment_hint = String( trigger.getAttribute( 'data-wpbc-timeline-segment-hint' ) || '' );
			card_segment_hint = String( card.getAttribute( 'data-wpbc-timeline-segment-id' ) || '' );

			return Boolean(
				trigger_booking_id
				&& trigger_booking_id === card_booking_id
				&& trigger_booking_id === Number( dto.booking_id )
				&& trigger_segment_hint
				&& trigger_segment_hint === card_segment_hint
			);
		}

		/**
		 * Determine whether an accessible modal layer is visibly rendered.
		 *
		 * @return {boolean} True when at least one modal layer is visible.
		 */
		function has_visible_modal_layer() {
			return Array.prototype.some.call( document.querySelectorAll( '[aria-modal="true"]' ), function ( modal_layer ) {
				if ( modal_layer.hidden || modal_layer.closest( '[hidden]' ) || modal_layer.closest( '[aria-hidden="true"]' ) ) {
					return false;
				}

				return 0 < modal_layer.getClientRects().length;
			} );
		}

		/**
		 * Determine whether Timeline state blocks a Booking Overview activation.
		 *
		 * @return {boolean} True while another layer or gesture owns attention.
		 */
		function is_suppressed() {
			if ( is_scrolling ) {
				return true;
			}
			if ( 'function' === typeof callbacks.is_suppressed && callbacks.is_suppressed() ) {
				return true;
			}

			return has_visible_modal_layer();
		}

		/**
		 * Render the fixed booking-domain template into the shared shell.
		 *
		 * @param {HTMLElement} trigger Registered booking trigger.
		 * @return {boolean} True when authorized compact content was prepared.
		 */
		function prepare_content( trigger ) {
			var dto = trigger ? trigger_dtos.get( trigger ) : null;

			if ( ! dto || ! trigger.isConnected || ! root.contains( trigger ) ) {
				return false;
			}
			if ( active_trigger && active_trigger !== trigger ) {
				if ( shared_controller.is_pinned() ) {
					return false;
				}
				shared_controller.request_close( 'programmatic', false );
			}
			render_booking_view( dto );

			return true;
		}

		/**
		 * Hand one registered booking card to the existing Inspector adapter.
		 *
		 * This is the sole booking-domain handoff used by the explicit popover action.
		 * It closes the current overview without restoring focus and never changes
		 * booking data.
		 *
		 * @param {HTMLElement} trigger Registered booking information control.
		 * @param {Event|null}  event   Optional activating browser event.
		 * @return {boolean} True when a current registered card was handed off.
		 */
		function handoff_to_booking_inspector( trigger, event ) {
			var card = trigger ? trigger_cards.get( trigger ) : null;

			if (
				! trigger
				|| ! card
				|| ! trigger.isConnected
				|| ! card.isConnected
				|| ! root.contains( trigger )
				|| ! root.contains( card )
				|| 'function' !== typeof callbacks.open_booking_details
			) {
				return false;
			}
			if ( event ) {
				event.preventDefault();
				event.stopPropagation();
			}
			shared_controller.request_close( 'inspector_handoff', false );
			if ( 'function' === typeof callbacks.open_booking_details ) {
				callbacks.open_booking_details( card );
			}

			return true;
		}

		/**
		 * Toggle Booking Overview from a native information-control activation.
		 *
		 * @param {MouseEvent} event Delegated click event.
		 * @return {boolean} True when the registered overview opened or closed.
		 */
		function handle_trigger_click( event ) {
			var trigger = get_trigger( event.target );

			if ( ! trigger || is_suppressed() ) {
				return false;
			}
			if ( active_trigger === trigger && ( shared_controller.is_open() || shared_controller.is_pinned() ) ) {
				if ( event ) {
					event.preventDefault();
				}

				return shared_controller.request_close( 'explicit_close', false );
			}
			if ( ! prepare_content( trigger ) ) {
				return false;
			}
			if ( event ) {
				event.preventDefault();
			}

			return shared_controller.open( trigger );
		}

		/**
		 * Suppress new activation while shared scroll policy resolves the owner.
		 *
		 * Both transient and pinned overviews retain their current canonical owner.
		 * The coalesced geometry path follows a visible information control and
		 * clamps an off-screen control to the nearest Timeline edge.
		 *
		 * @return {void}
		 */
		function handle_scroll() {
			is_scrolling = true;
			shared_controller.cancel_pending_open();
			schedule_live_geometry_update();
			window.clearTimeout( scroll_timer );
			scroll_timer = window.setTimeout( function () {
				is_scrolling = false;
				scroll_timer = 0;
			}, scroll_resume_delay_ms );
		}

		/**
		 * Recalculate current owner geometry after non-scroll layout changes.
		 *
		 * @return {void}
		 */
		function handle_geometry_change() {
			schedule_live_geometry_update();
		}

		/**
		 * Recalculate after an image changes a rendered booking row's geometry.
		 *
		 * @param {Event} event Captured Resource or booking image load event.
		 * @return {void}
		 */
		function handle_geometry_image_load( event ) {
			if ( event.target && 'IMG' === event.target.nodeName ) {
				schedule_live_geometry_update();
			}
		}

		/**
		 * Select and rebind the retained canonical booking after a complete render.
		 *
		 * The same visible segment hint wins. Otherwise another visible authorized
		 * segment wins, followed by a connected off-screen segment that can retain
		 * identity through a live reference while the canvas clips its surface.
		 *
		 * @return {void}
		 */
		function complete_refresh_rebind() {
			var owner_booking_id = popover_state.owner.booking_id;
			var owner_segment_hint = popover_state.owner.segment_hint;
			var authorized_candidates;
			var visible_candidates;
			var selected_candidate = null;

			if ( ! refresh_rebind_pending ) {
				return;
			}
			refresh_rebind_pending = false;
			if ( ! shared_controller.is_pinned() || ! owner_booking_id ) {
				rebind_candidates = [];
				return;
			}
			authorized_candidates = rebind_candidates.filter( function ( candidate ) {
				return candidate.context.booking_id === owner_booking_id
					&& candidate.trigger.isConnected
					&& root.contains( candidate.trigger );
			} );
			visible_candidates = authorized_candidates.filter( function ( candidate ) {
				return 'live_control' === get_trigger_reference_state( candidate.trigger );
			} );
			selected_candidate = visible_candidates.filter( function ( candidate ) {
				return candidate.context.segment_hint === owner_segment_hint;
			} )[ 0 ] || visible_candidates[ 0 ] || authorized_candidates.filter( function ( candidate ) {
				return candidate.context.segment_hint === owner_segment_hint;
			} )[ 0 ] || authorized_candidates[ 0 ] || null;
			rebind_candidates = [];
			if ( ! selected_candidate ) {
				shared_controller.request_close( 'authorization_invalidation', false );
				return;
			}
			if ( ! shared_controller.rebind_trigger( selected_candidate.trigger ) ) {
				shared_controller.request_close( 'authorization_invalidation', false );
				return;
			}
			active_trigger = selected_candidate.trigger;
			popover_state.owner = selected_candidate.context;
			set_popover_axis( 'reference', get_trigger_reference_state( active_trigger ) );
			set_popover_axis( 'details', 'idle' );
			render_booking_view( selected_candidate.dto );
			observe_active_geometry();
			if (
				'temporarily_missing' !== popover_state.reference
				&& ! blocking_suspension
				&& shared_controller.is_suspended()
				&& 'reference_refresh' === shared_controller.get_suspension_reason()
			) {
				shared_controller.resume();
				return;
			}
			schedule_live_geometry_update();
		}

		/**
		 * Open the authoritative Booking Inspector from the popover action.
		 *
		 * @param {MouseEvent} event Popover click event.
		 * @return {void}
		 */
		function handle_popover_click( event ) {
			var retry_button = event.target.closest( '[data-wpbc-booking-overview-retry]' );
			var open_button = event.target.closest( '[data-wpbc-booking-overview-open-details]' );
			var trigger = active_trigger;

			if ( retry_button ) {
				event.preventDefault();
				event.stopPropagation();
				handle_retry();
				return;
			}
			if ( ! open_button ) {
				return;
			}
			handoff_to_booking_inspector( trigger, event );
		}

		/**
		 * Forward pinned horizontal input to the Timeline canvas scroll owner.
		 *
		 * Unpinned surfaces remain canvas descendants and therefore use native
		 * event bubbling. A pinned root lives under the document body, so only its
		 * horizontal gesture needs the domain callback; vertical input retains the
		 * native detail-body and WordPress document scroll chain.
		 *
		 * @param {WheelEvent} event Browser wheel event over the popover surface.
		 * @return {void}
		 */
		function handle_popover_wheel( event ) {
			if (
				! shared_controller.is_pinned()
				|| 'function' !== typeof callbacks.scroll_timeline
			) {
				return;
			}
			if ( callbacks.scroll_timeline( event ) ) {
				event.preventDefault();
			}
		}

		root.addEventListener( 'load', handle_geometry_image_load, true );
		popover_surface.addEventListener( 'click', handle_popover_click );
		popover_surface.addEventListener( 'wheel', handle_popover_wheel, { passive: false } );
		root.addEventListener( 'scroll', handle_scroll, true );
		window.addEventListener( 'scroll', handle_scroll, { passive: true } );
		window.addEventListener( 'resize', handle_geometry_change, { passive: true } );
		if ( window.visualViewport ) {
			window.visualViewport.addEventListener( 'resize', handle_geometry_change, { passive: true } );
			window.visualViewport.addEventListener( 'scroll', handle_scroll, { passive: true } );
		}

		return {
			/**
			 * Toggle this booking instance from its native information-control click.
			 *
			 * @param {HTMLElement} trigger Registered booking information control.
			 * @param {MouseEvent}  event   Native click event.
			 * @return {boolean} True when the popover opened or closed.
			 */
			open_trigger: function ( trigger, event ) {
				return handle_trigger_click( {
					target: trigger,
					preventDefault: function () {
						if ( event && 'function' === typeof event.preventDefault ) {
							event.preventDefault();
						}
					}
				} );
			},
			/**
			 * Move keyboard focus into an already open booking surface.
			 *
			 * This never opens a closed surface; click remains the only activation.
			 *
			 * @param {HTMLElement} trigger Registered booking information control.
			 * @param {KeyboardEvent} event Focus-entry command.
			 * @return {boolean} True when the command was handled.
			 */
			focus_surface: function ( trigger, event ) {
				if ( ! shared_controller.is_open() ) {
					return false;
				}

				return shared_controller.handle_trigger_keydown( trigger, event );
			},
			/**
			 * Associate one information control and card with its overview projection.
			 *
			 * @param {HTMLElement} trigger Dedicated native information control.
			 * @param {HTMLElement} card    Separate Timeline card/Inspector identity.
			 * @param {Object}      dto              Authorized compact card projection.
			 * @param {Object}      resource_summary Authorized Timeline Resource list summary.
			 * @return {void}
			 */
			register: function ( trigger, card, dto, resource_summary ) {
				var normalized_dto = normalize_dto( dto, resource_summary );
				var trigger_context;

				if (
					trigger
					&& card
					&& normalized_dto
					&& root.contains( trigger )
					&& root.contains( card )
					&& trigger_belongs_to_card( trigger, card, normalized_dto )
					&& shared_controller.can_use_trigger( trigger )
				) {
					trigger_dtos.set( trigger, normalized_dto );
					trigger_cards.set( trigger, card );
					trigger_context = {
						booking_id: normalized_dto.booking_id,
						render_generation: render_generation,
						segment_hint: String( card.getAttribute( 'data-wpbc-timeline-segment-id' ) || '' )
					};
					trigger_contexts.set( trigger, trigger_context );
					if (
						refresh_rebind_pending
						&& shared_controller.is_pinned()
						&& popover_state.owner.booking_id === trigger_context.booking_id
					) {
						rebind_candidates.push( {
							trigger: trigger,
							context: trigger_context,
							dto: normalized_dto
						} );
					}
				}
			},
			/**
			 * Finalize retained-owner authorization after all cards are registered.
			 *
			 * @return {void}
			 */
			complete_refresh: complete_refresh_rebind,
			/**
			 * Invalidate registrations before Timeline replaces card nodes.
			 *
			 * @return {void}
			 */
			refresh: function () {
				var retain_pin = shared_controller.is_pinned();

				render_generation += 1;
				stop_geometry_tracking();
				rebind_candidates = [];
				refresh_rebind_pending = retain_pin;
				if ( active_trigger ) {
					set_popover_axis( 'visibility', 'temporarily_suspended' );
					set_popover_axis( 'reference', 'temporarily_missing' );
				}
				if ( retain_pin ) {
					shared_controller.suspend( 'reference_refresh' );
				} else {
					shared_controller.request_close( 'programmatic', false );
				}
				clear_details_state();
				trigger_dtos = new window.WeakMap();
				trigger_contexts = new window.WeakMap();
				trigger_cards = new window.WeakMap();
			},
			/**
			 * Invalidate one booking immediately after a canonical mutation.
			 *
			 * @param {number} booking_id Mutated booking ID.
			 * @return {void}
			 */
			invalidate: function ( booking_id ) {
				booking_id = Math.max( 0, Math.round( Number( booking_id ) || 0 ) );
				if ( booking_id && booking_id === popover_state.owner.booking_id ) {
					invalidate_booking( booking_id, true );
					set_popover_axis( 'details', 'idle' );
					if ( shared_controller.is_pinned() ) {
						set_popover_axis( 'visibility', 'temporarily_suspended' );
						shared_controller.suspend( 'reference_refresh' );
						return;
					}
					shared_controller.request_close( 'authorization_invalidation', false );
					return;
				}
				invalidate_booking( booking_id, true );
			},
			/**
			 * Close this domain's popover without restoring focus.
			 *
			 * @return {void}
			 */
			suspend: function () {
				blocking_suspension = true;
				if ( shared_controller.is_pinned() ) {
					shared_controller.suspend( 'blocking_layer' );
					return;
				}
				shared_controller.request_close( 'programmatic', false );
			},
			/**
			 * Resume a retained pin after Timeline blocking state is removed.
			 *
			 * Missing replacement authorization closes the retained identity instead
			 * of displaying stale content against a detached reference.
			 *
			 * @return {void}
			 */
			resume: function () {
				blocking_suspension = false;
				if ( ! shared_controller.is_pinned() || ! shared_controller.is_suspended() ) {
					return;
				}
				if (
					! active_trigger
					|| ! active_trigger.isConnected
					|| ! root.contains( active_trigger )
					|| ! trigger_dtos.has( active_trigger )
					|| ! trigger_cards.has( active_trigger )
				) {
					shared_controller.request_close( 'authorization_invalidation', false );
					return;
				}
				if ( 'temporarily_missing' === get_trigger_reference_state( active_trigger ) ) {
					set_popover_axis( 'reference', get_trigger_reference_state( active_trigger ) );
					schedule_live_geometry_update();
					return;
				}
				if ( shared_controller.resume() ) {
					set_popover_axis( 'visibility', 'pinned' );
					set_popover_axis( 'reference', get_trigger_reference_state( active_trigger ) );
				}
			},
			/**
			 * Report whether the shared controller currently displays this overview.
			 *
			 * @return {boolean} True when the popover is visible.
			 */
			is_open: function () {
				return shared_controller.is_open();
			},
			/**
			 * Notify the adapter after Timeline-owned layout changes settle.
			 *
			 * @return {void}
			 */
			update_geometry: schedule_live_geometry_update,
			/**
			 * Return the current independent popover state axes.
			 *
			 * @return {Object} Executable-free page-memory state snapshot.
			 */
			get_state: get_popover_state,
			/**
			 * Remove domain listeners and destroy only this shared controller instance.
			 *
			 * @return {void}
			 */
			destroy: function () {
				window.clearTimeout( scroll_timer );
				stop_geometry_tracking();
				clear_details_state();
				root.removeEventListener( 'load', handle_geometry_image_load, true );
				popover_surface.removeEventListener( 'click', handle_popover_click );
				popover_surface.removeEventListener( 'wheel', handle_popover_wheel );
				root.removeEventListener( 'scroll', handle_scroll, true );
				window.removeEventListener( 'scroll', handle_scroll );
				window.removeEventListener( 'resize', handle_geometry_change );
				if ( window.visualViewport ) {
					window.visualViewport.removeEventListener( 'resize', handle_geometry_change );
					window.visualViewport.removeEventListener( 'scroll', handle_scroll );
				}
				shared_controller.destroy();
				geometry_resize_observer = null;
				rebind_candidates = [];
				trigger_dtos = new window.WeakMap();
				trigger_contexts = new window.WeakMap();
				trigger_cards = new window.WeakMap();
				active_trigger = null;
				popover_state = create_empty_popover_state();
			}
		};
	}

	/**
	 * Create a Timeline-scoped manager that lazily owns one popover per booking.
	 *
	 * A controller is allocated only after its information button is clicked.
	 * Separate booking controllers can therefore remain visible together without
	 * creating document listeners for every rendered card up front.
	 *
	 * @param {HTMLElement} root          Timeline root containing booking triggers.
	 * @param {Object}      configuration Executable-free server configuration.
	 * @param {Object}      callbacks     Timeline suppression and Inspector hooks.
	 * @return {Object|null} Multi-booking adapter API, or null when unavailable.
	 */
	function create_controller( root, configuration, callbacks ) {
		configuration = configuration || {};
		callbacks = callbacks || {};
		if (
			! root
			|| ! configuration.active
			|| ! window.wpbc_shared_ui_context_popover
			|| 'function' !== typeof window.wpbc_shared_ui_context_popover.create
		) {
			return null;
		}

		var base_component_id = String( configuration.component_id || '' ).replace( /[^A-Za-z0-9_-]/g, '' );
		var booking_controllers = new window.Map();
		var booking_registrations = new window.Map();
		var trigger_booking_ids = new window.WeakMap();

		/**
		 * Return one positive booking identity.
		 *
		 * @param {*} candidate Candidate booking identity.
		 * @return {number} Positive integer booking ID, or zero.
		 */
		function normalize_booking_id( candidate ) {
			return Math.max( 0, Math.round( Number( candidate ) || 0 ) );
		}

		/**
		 * Build an isolated configuration for one booking-owned surface.
		 *
		 * @param {number} booking_id Canonical booking identity.
		 * @return {Object} Per-instance configuration.
		 */
		function create_instance_configuration( booking_id ) {
			var instance_configuration = {};
			var instance_id = base_component_id + '__booking_' + booking_id;

			Object.keys( configuration ).forEach( function ( configuration_key ) {
				instance_configuration[ configuration_key ] = configuration[ configuration_key ];
			} );
			instance_configuration.component_id = instance_id;
			instance_configuration.owner_id = instance_id;
			instance_configuration.interaction_group = instance_id;

			return instance_configuration;
		}

		/**
		 * Register every current segment for a newly allocated booking controller.
		 *
		 * @param {number} booking_id Canonical booking identity.
		 * @param {Object} controller Booking instance controller.
		 * @return {void}
		 */
		function register_current_segments( booking_id, controller ) {
			var registrations = booking_registrations.get( booking_id ) || [];

			registrations.forEach( function ( registration ) {
				controller.register(
					registration.trigger,
					registration.card,
					registration.dto,
					registration.resource_summary
				);
			} );
		}

		/**
		 * Resolve or lazily create one booking-owned popover controller.
		 *
		 * @param {number} booking_id Canonical booking identity.
		 * @return {Object|null} Booking instance controller, or null.
		 */
		function get_booking_controller( booking_id ) {
			var controller = booking_controllers.get( booking_id ) || null;

			if ( controller ) {
				return controller;
			}
			controller = create_instance_controller(
				root,
				create_instance_configuration( booking_id ),
				callbacks
			);
			if ( ! controller ) {
				return null;
			}
			booking_controllers.set( booking_id, controller );
			register_current_segments( booking_id, controller );

			return controller;
		}

		/**
		 * Toggle only from a native click on a registered information button.
		 *
		 * Native button activation preserves Enter and Space keyboard access while
		 * pointer hover and focus alone deliberately perform no opening action. A
		 * second click on the same button closes only that booking's instance.
		 *
		 * @param {MouseEvent} event Delegated Timeline click.
		 * @return {void}
		 */
		function handle_trigger_click( event ) {
			var element = event.target && 1 === event.target.nodeType ? event.target : null;
			var trigger = element ? element.closest( '[data-wpbc-booking-overview-info-trigger]' ) : null;
			var booking_id;
			var controller;

			if (
				! trigger
				|| ! root.contains( trigger )
				|| element.closest( '[data-wpbc-ui-catalog-overflow-tooltip]' )
			) {
				return;
			}
			booking_id = normalize_booking_id( trigger_booking_ids.get( trigger ) );
			controller = booking_id ? get_booking_controller( booking_id ) : null;
			if ( controller ) {
				controller.open_trigger( trigger, event );
			}
		}

		/**
		 * Move focus into an already clicked overview without opening on focus.
		 *
		 * @param {KeyboardEvent} event Delegated Timeline keydown.
		 * @return {void}
		 */
		function handle_trigger_keydown( event ) {
			var element = event.target && 1 === event.target.nodeType ? event.target : null;
			var trigger = element ? element.closest( '[data-wpbc-booking-overview-info-trigger]' ) : null;
			var booking_id = trigger ? normalize_booking_id( trigger_booking_ids.get( trigger ) ) : 0;
			var controller = booking_id ? booking_controllers.get( booking_id ) : null;

			if ( controller && controller.is_open() ) {
				controller.focus_surface( trigger, event );
			}
		}

		root.addEventListener( 'click', handle_trigger_click );
		root.addEventListener( 'keydown', handle_trigger_keydown, true );

		return {
			/**
			 * Register one currently rendered booking segment.
			 *
			 * @param {HTMLElement} trigger          Information button.
			 * @param {HTMLElement} card             Timeline booking card.
			 * @param {Object}      dto              Authorized compact DTO.
			 * @param {Object}      resource_summary Authorized Resource summary.
			 * @return {void}
			 */
			register: function ( trigger, card, dto, resource_summary ) {
				var booking_id = normalize_booking_id( dto && dto.booking_id );
				var registrations;
				var controller;

				if ( ! booking_id || ! trigger || ! card || ! root.contains( trigger ) || ! root.contains( card ) ) {
					return;
				}
				registrations = booking_registrations.get( booking_id ) || [];
				registrations.push( {
					trigger: trigger,
					card: card,
					dto: dto,
					resource_summary: resource_summary || {}
				} );
				booking_registrations.set( booking_id, registrations );
				trigger_booking_ids.set( trigger, booking_id );
				controller = booking_controllers.get( booking_id );
				if ( controller ) {
					controller.register( trigger, card, dto, resource_summary || {} );
				}
			},
			/**
			 * Prepare every allocated controller for a Timeline rerender.
			 *
			 * @return {void}
			 */
			refresh: function () {
				booking_controllers.forEach( function ( controller ) {
					controller.refresh();
				} );
				booking_registrations.clear();
				trigger_booking_ids = new window.WeakMap();
			},
			/**
			 * Complete authorization-aware trigger rebinding after a rerender.
			 *
			 * @return {void}
			 */
			complete_refresh: function () {
				booking_controllers.forEach( function ( controller ) {
					controller.complete_refresh();
				} );
			},
			/**
			 * Invalidate cached data for one booking controller.
			 *
			 * @param {number} booking_id Canonical booking identity.
			 * @return {void}
			 */
			invalidate: function ( booking_id ) {
				var controller = booking_controllers.get( normalize_booking_id( booking_id ) );

				if ( controller ) {
					controller.invalidate( booking_id );
				}
			},
			/**
			 * Suspend every allocated booking surface during blocking Timeline work.
			 *
			 * @return {void}
			 */
			suspend: function () {
				booking_controllers.forEach( function ( controller ) {
					controller.suspend();
				} );
			},
			/**
			 * Resume every safely retained booking surface.
			 *
			 * @return {void}
			 */
			resume: function () {
				booking_controllers.forEach( function ( controller ) {
					controller.resume();
				} );
			},
			/**
			 * Recalculate every visible booking surface after Timeline geometry changes.
			 *
			 * @return {void}
			 */
			update_geometry: function () {
				booking_controllers.forEach( function ( controller ) {
					controller.update_geometry();
				} );
			},
			/**
			 * Report whether at least one booking surface is open.
			 *
			 * @return {boolean} True when at least one booking surface is open.
			 */
			is_open: function () {
				var is_open = false;

				booking_controllers.forEach( function ( controller ) {
					is_open = is_open || controller.is_open();
				} );

				return is_open;
			},
			/**
			 * Destroy every booking surface and manager-owned listener.
			 *
			 * @return {void}
			 */
			destroy: function () {
				root.removeEventListener( 'click', handle_trigger_click );
				root.removeEventListener( 'keydown', handle_trigger_keydown, true );
				booking_controllers.forEach( function ( controller ) {
					controller.destroy();
				} );
				booking_controllers.clear();
				booking_registrations.clear();
				trigger_booking_ids = new window.WeakMap();
			}
		};
	}

	window.wpbc_booking_overview_tooltip.create_controller = create_controller;
}( window, document, window.wp, window.jQuery ) );
