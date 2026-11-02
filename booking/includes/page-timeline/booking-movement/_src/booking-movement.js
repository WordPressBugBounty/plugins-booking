/**
 * Isolated SortableJS adapter for reviewed Timeline booking movement.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var modules = window.wpbc_timeline_modules;
	var interactions = window.wpbc_timeline_booking_interactions;
	var config = window.wpbc_timeline_booking_movement_config || {};

	if (
		! modules
		|| 'function' !== typeof modules.register_factory
		|| ! interactions
		|| 'function' !== typeof interactions.register_extension_factory
		|| 'function' !== typeof window.Sortable
		|| ! window.jQuery
		|| ! window.wp
		|| 'function' !== typeof window.wp.template
	) {
		return;
	}

	/**
	 * Create one movement adapter for one Timeline mount.
	 *
	 * @param {Object} host_context Domain-neutral Timeline callbacks.
	 * @return {Object} Movement lifecycle controller.
	 */
	function create_controller( host_context ) {
		var mount = host_context.mount;
		var callbacks = host_context.callbacks || {};
		var transport = config.transport || {};
		var review_transport = config.review_transport || {};
		var apply_transport = config.apply_transport || {};
		var sortable_config = config.sortable || {};
		var templates = config.templates || {};
		var i18n = config.i18n || {};
		var records = new WeakMap();
		var visible_records = [];
		var requests = new WeakMap();
		var sortables = [];
		var generation = 0;
		var pending_pointer = null;
		var gesture = null;
		var review_request = null;
		var review_loading_state = null;
		var review_host = null;
		var review_memory = null;
		var apply_request = null;
		var apply_processing_notice = null;
		var pending_apply_result = null;
		var pending_completion = null;
		var lifecycle_state = 'idle';
		var lifecycle_generation = 0;
		var lifecycle_anchor = null;
		var pending_grip_focus_booking_id = 0;
		var replacement_card = null;
		var live_region = null;
		var scroll_frame = 0;
		var initialized = false;
		var is_destroyed = false;
		var group_name = 'wpbc-timeline-movement-' + Math.random().toString( 36 ).slice( 2 );
		var filter_selector = [
			'[data-wpbc-timeline-sortable-exclude]',
			'button:not([data-wpbc-timeline-booking-movement-grip])',
			'a', 'input', 'select', 'textarea',
			'[data-wpbc-timeline-booking-resize-host]'
		].join( ',' );

		/**
		 * Return a fixed WordPress template.
		 *
		 * @param {string} template_id Allow-listed template ID.
		 * @return {Function|null} Template renderer or null.
		 */
		function template( template_id ) {
			try {
				return template_id ? window.wp.template( template_id ) : null;
			} catch ( error ) {
				return null;
			}
		}

		/**
		 * Announce an authorized localized message.
		 *
		 * @param {string} message Status text.
		 * @return {void}
		 */
		function announce( message ) {
			if ( live_region ) {
				live_region.textContent = String( message || '' );
			}
		}

		/**
		 * Normalize the source-only movement response.
		 *
		 * @param {Object} response AJAX response.
		 * @param {Object} record Source segment.
		 * @return {Object|null} Immutable movement context.
		 */
		function normalize_context( response, record ) {
			var dto = response && response.success && response.data ? response.data.movement_context : null;
			var seed = dto && dto.schedule_seed ? dto.schedule_seed : {};
			var availability = dto && dto.gesture_availability ? dto.gesture_availability : {};
			var restrictions = dto && dto.gesture_restrictions ? dto.gesture_restrictions : {};
			var dates = Array.isArray( seed.selected_dates ) ? seed.selected_dates.map( String ) : [];
			var intervals = Array.isArray( seed.exact_intervals ) ? seed.exact_intervals.map( function ( interval ) {
				return Object.freeze( { start: String( interval.start || '' ), end: String( interval.end || '' ) } );
			} ) : [];

			if ( ! dto || Number( dto.booking_id ) !== record.booking_id || ! Number( dto.primary_resource_id ) || ! Number( dto.proposal_revision ) || ! String( dto.source_context_token || '' ) || ( ! availability.same_resource && ! availability.cross_resource ) || ! dates.length || ! [ 'policy', 'individual' ].includes( String( seed.selection_method ) ) ) {
				return null;
			}
			if ( 'full_day' !== seed.time_application && ( ! intervals.length || intervals.some( function ( interval ) {
				return ! Date.parse( interval.start ) || Date.parse( interval.end ) <= Date.parse( interval.start );
			} ) ) ) {
				return null;
			}
			return Object.freeze( {
				booking_id: record.booking_id,
				primary_resource_id: Math.round( Number( dto.primary_resource_id ) ),
				proposal_revision: Math.round( Number( dto.proposal_revision ) ),
				source_context_token: String( dto.source_context_token ),
				same_resource_available: Boolean( availability.same_resource ),
				cross_resource_available: Boolean( availability.cross_resource ),
				same_resource_restriction: availability.same_resource ? '' : String( restrictions.same_resource || dto.fallback_reason || 'operation_unsupported' ),
				cross_resource_restriction: availability.cross_resource ? '' : String( restrictions.cross_resource || dto.fallback_reason || 'operation_unsupported' ),
				selection_method: String( seed.selection_method ),
				time_application: String( seed.time_application ),
				selected_dates: Object.freeze( dates ),
				exact_intervals: Object.freeze( intervals )
			} );
		}

		/**
		 * Hide the decorative indicator until source eligibility is confirmed.
		 *
		 * The server remains authoritative for movement eligibility. Registration
		 * hides the non-interactive marker before selection can imply that dragging
		 * is available. A successful response replaces it with the explicit button;
		 * every other outcome leaves it hidden until canonical Timeline rerender.
		 *
		 * @param {Object} record Source segment awaiting canonical context.
		 * @return {void}
		 */
		function hide_unresolved_indicator( record ) {
			var indicator = record && record.rail
				? record.rail.querySelector( '.wpbc_timeline__booking_drag_indicator' )
				: null;

			if ( ! indicator || indicator.hidden || indicator.hasAttribute( 'data-wpbc-timeline-booking-movement-grip' ) ) {
				return;
			}
			indicator.hidden = true;
			if ( 'function' === typeof callbacks.schedule_layout ) {
				callbacks.schedule_layout();
			}
		}

		/**
		 * Render the explicit grip after server eligibility succeeds.
		 *
		 * @param {Object} record Authorized source segment.
		 * @return {void}
		 */
		function render_grip( record ) {
			var renderer = template( templates.grip );
			var rail = record.rail;
			var indicator = rail ? rail.querySelector( '.wpbc_timeline__booking_drag_indicator' ) : null;
			var dock = record.card.querySelector( '.wpbc_timeline__booking_accessory_dock' );
			var buffer = document.createElement( 'span' );
			var grip;

			if ( ! renderer || ! indicator || indicator.querySelector( '[data-wpbc-timeline-booking-movement-grip]' ) ) {
				return;
			}
			buffer.innerHTML = renderer( { booking_id: record.booking_id, label: i18n.grip_label || '' } );
			if ( ! buffer.firstElementChild ) {
				return;
			}
			indicator.replaceWith( buffer.firstElementChild );
			[ rail, dock ].forEach( function ( element ) {
				if ( element ) {
					element.removeAttribute( 'data-wpbc-timeline-sortable-exclude' );
				}
			} );
			rail.setAttribute( 'data-wpbc-timeline-booking-control-rail-card-owned', '' );
			record.card.setAttribute( 'data-wpbc-timeline-booking-movable', 'true' );
			if ( 'function' === typeof callbacks.schedule_layout ) {
				callbacks.schedule_layout();
			}
			if ( pending_grip_focus_booking_id === record.booking_id ) {
				grip = record.card.querySelector( '[data-wpbc-timeline-booking-movement-grip]' );
				pending_grip_focus_booking_id = 0;
				if ( grip && grip.isConnected ) {
					grip.focus();
				}
			}
		}

		/**
		 * Request source eligibility without requesting any target authority.
		 *
		 * @param {Object} record Canonical rendered segment.
		 * @return {void}
		 */
		function request_context( record ) {
			var request_generation;
			var pending;

			if ( ! record || 'idle' !== record.state || ! transport.url ) {
				return;
			}
			generation += 1;
			request_generation = generation;
			record.state = 'loading';
			record.generation = request_generation;
			hide_unresolved_indicator( record );
			pending = window.jQuery.ajax( {
				url: transport.url, method: 'POST', dataType: 'json',
				data: {
					action: transport.action, nonce: transport.nonce, booking_id: record.booking_id,
					source: 'timeline', segment_id: record.segment_id, segment_resource_id: record.resource_id,
					visible_start_at: record.visible_start, visible_end_at: record.visible_end, proposal_revision: 1
				}
			} ).done( function ( response ) {
				var movement_context;

				if ( request_generation !== record.generation || records.get( record.card ) !== record || ! record.card.isConnected ) {
					return;
				}
				movement_context = normalize_context( response, record );
				record.context = movement_context;
				record.state = movement_context ? 'ready' : 'denied';
				if ( movement_context ) {
					render_grip( record );
				}
			} ).fail( function ( failed_request, status ) {
				if ( 'abort' !== status && request_generation === record.generation && records.get( record.card ) === record ) {
					record.state = 'error';
				}
			} ).always( function () {
				if ( requests.get( record.card ) === pending ) {
					requests.delete( record.card );
				}
			} );
			requests.set( record.card, pending );
		}

		/**
		 * Lazily request context on deliberate indicator hover or card focus.
		 *
		 * @param {Event} event Pointer or focus event.
		 * @return {void}
		 */
		function on_context_intent( event ) {
			var card = resolve_accessory_card( event.target );
			var record = card ? records.get( card ) : null;

			if ( record && ( 'focusin' === event.type || card.classList.contains( 'is-booking-selected' ) ) ) {
				request_context( record );
			}
		}

		/**
		 * Capture pointer origin only from an authorized explicit grip.
		 *
		 * @param {PointerEvent} event Pointer-down event.
		 * @return {void}
		 */
		function on_pointer_down( event ) {
			var grip = event.target.closest( '[data-wpbc-timeline-booking-movement-grip]' );
			var card = grip ? resolve_accessory_card( grip ) : null;
			var record = card ? records.get( card ) : null;

			if ( record && record.context && ( 'function' !== typeof callbacks.can_start_interaction || callbacks.can_start_interaction() ) ) {
				pending_pointer = { card: card, x: Number( event.clientX ), y: Number( event.clientY ) };
			}
		}

		/**
		 * Resolve a canonical card from an in-card or detached control rail.
		 *
		 * @param {HTMLElement} accessory Control or accessory descendant.
		 * @return {HTMLElement|null} Canonical card or null.
		 */
		function resolve_accessory_card( accessory ) {
			var card = accessory && accessory.closest ? accessory.closest( '[data-wpbc-timeline-segment-id]' ) : null;
			var rail;
			var segment_id;

			if ( card ) {
				return card;
			}
			rail = accessory && accessory.closest ? accessory.closest( '[data-wpbc-timeline-booking-control-rail]' ) : null;
			segment_id = rail ? String( rail.getAttribute( 'data-wpbc-timeline-accessory-segment-id' ) || '' ) : '';
			if ( ! segment_id ) {
				return null;
			}
			mount.querySelectorAll( '[data-wpbc-timeline-segment-id]' ).forEach( function ( candidate ) {
				if ( ! card && segment_id === String( candidate.getAttribute( 'data-wpbc-timeline-segment-id' ) || '' ) ) {
					card = candidate;
				}
			} );

			return card;
		}

		/**
		 * Capture axis DTOs with their current physical rectangles.
		 *
		 * @return {Object} Immutable axis snapshot.
		 */
		function capture_axis() {
			var axis = 'function' === typeof callbacks.get_axis ? callbacks.get_axis() || {} : {};
			var headers = mount.querySelectorAll( '[data-wpbc-timeline-axis-cell]' );
			var cells = Array.isArray( axis.cells ) ? axis.cells.map( function ( cell, index ) {
				var rectangle = headers[index] ? headers[index].getBoundingClientRect() : null;
				return rectangle ? Object.freeze( {
					start_epoch: Number( cell.start_epoch ), end_epoch: Number( cell.end_epoch ), date: String( cell.date || '' ),
					left: rectangle.left, right: rectangle.right
				} ) : null;
			} ).filter( Boolean ) : [];

			return Object.freeze( {
				cells: Object.freeze( cells ), timezone: String( axis.timezone || 'UTC' ),
				is_rtl: 'rtl' === window.getComputedStyle( mount ).direction
			} );
		}

		/**
		 * Capture every visible Resource-row target, including empty rows.
		 *
		 * @return {Array<Object>} Immutable target records.
		 */
		function capture_rows() {
			var rows = Array.prototype.map.call( mount.querySelectorAll( '[data-wpbc-timeline-segments]' ), function ( host, order ) {
				var track = host.closest( '[data-wpbc-timeline-resource-id]' );
				var rectangle = host.getBoundingClientRect();
				return Object.freeze( {
					host: host, resource_id: Number( track && track.getAttribute( 'data-wpbc-timeline-resource-id' ) ), order: order,
					top: rectangle.top, bottom: rectangle.bottom, left: rectangle.left, right: rectangle.right
				} );
			} ).filter( function ( row ) {
				return row.resource_id && row.right > row.left && row.bottom > row.top;
			} );

			return Object.freeze( rows );
		}

		/**
		 * Snapshot DOM, axis, rows, scroll, selection, and focus on choose.
		 *
		 * @param {Object} event Sortable choose event.
		 * @return {void}
		 */
		function on_choose( event ) {
			var record = records.get( event.item );
			var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );
			var title = event.item.querySelector( '.wpbc_timeline__booking_details strong' );
			var duration = event.item.querySelector( '.wpbc_timeline__booking_secondary' );
			var source_host = event.item.parentNode;

			if ( ! record || ! record.context || ! pending_pointer || pending_pointer.card !== event.item ) {
				return;
			}
			gesture = {
				card: event.item, record: record, parent: event.item.parentNode, next: event.item.nextSibling,
				style: event.item.getAttribute( 'style' ), class_name: event.item.getAttribute( 'class' ),
				axis: capture_axis(), rows: capture_rows(), canvas: canvas, canvas_scroll: canvas ? canvas.scrollLeft : 0,
				canvas_rectangle: canvas ? canvas.getBoundingClientRect() : null,
				doc_x: window.pageXOffset || 0, doc_y: window.pageYOffset || 0,
				selected: event.item.classList.contains( 'is-booking-selected' ), focus: document.activeElement,
				start_x: pending_pointer.x, start_y: pending_pointer.y, x: pending_pointer.x, y: pending_pointer.y,
				candidate: null, pending_candidate: null, candidate_since: 0, origin: null, started: false,
				source_row: null, visual_drop_intent: null, drop_intent: null, sortable_destination: null,
				candidate_ghost: null, candidate_ghost_host: null,
				ghost_data: Object.freeze( {
					title: title ? String( title.textContent || '' ).trim() : '',
					duration_label: duration ? String( duration.textContent || '' ).trim() : ''
				} )
			};
			gesture.source_row = get_row_for_host( gesture, source_host );
			if ( ! gesture.source_row ) {
				gesture = null;
				pending_pointer = null;
			}
		}

		/**
		 * Make a clone presentation-only and inert.
		 *
		 * @param {HTMLElement} clone Clone to sanitize.
		 * @return {void}
		 */
		function sanitize_clone( clone ) {
			if ( ! clone ) {
				return;
			}
			clone.setAttribute( 'aria-hidden', 'true' );
			clone.style.pointerEvents = 'none';
			clone.querySelectorAll( '[id]' ).forEach( function ( node ) { node.removeAttribute( 'id' ); } );
			clone.querySelectorAll( '[tabindex], button, a, input, select, textarea' ).forEach( function ( node ) {
				node.removeAttribute( 'tabindex' );
				node.setAttribute( 'aria-hidden', 'true' );
				if ( 'disabled' in node ) {
					node.disabled = true;
				}
			} );
			clone.querySelectorAll( '[data-wpbc-booking-inspector-trigger], [data-wpbc-booking-overview-info-trigger], [data-wpbc-timeline-booking-details-action], [data-wpbc-timeline-booking-resize-host], [data-wpbc-timeline-booking-movement-grip]' ).forEach( function ( node ) {
				[ 'data-wpbc-booking-inspector-trigger', 'data-wpbc-booking-overview-info-trigger', 'data-wpbc-timeline-booking-details-action', 'data-wpbc-timeline-booking-resize-host', 'data-wpbc-timeline-booking-movement-grip' ].forEach( function ( attribute ) { node.removeAttribute( attribute ); } );
			} );
		}

		/**
		 * Sanitize Sortable's mirror clone.
		 *
		 * @param {Object} event Sortable clone event.
		 * @return {void}
		 */
		function on_clone( event ) {
			sanitize_clone( event.clone );
			if ( event.clone ) {
				event.clone.classList.add( 'wpbc_timeline_booking_movement__mirror' );
			}
		}

		/**
		 * Start locks, origin representation, targets, and owned autoscroll.
		 *
		 * @return {void}
		 */
		function on_start() {
			if ( ! gesture ) {
				return;
			}
			gesture.started = true;
			gesture.origin = gesture.card.cloneNode( true );
			sanitize_clone( gesture.origin );
			gesture.origin.classList.add( 'wpbc_timeline_booking_movement__origin' );
			gesture.origin.removeAttribute( 'data-wpbc-timeline-booking-movable' );
			gesture.parent.insertBefore( gesture.origin, gesture.next );
			mount.classList.add( 'is-booking-movement-active' );
			if ( callbacks.set_interaction_suspended ) { callbacks.set_interaction_suspended( true, gesture.card ); }
			if ( callbacks.set_axis_window_loading_locked ) { callbacks.set_axis_window_loading_locked( true ); }
			document.addEventListener( 'pointermove', on_pointer_move, true );
			document.addEventListener( 'pointerup', on_pointer_completion, true );
			document.addEventListener( 'pointercancel', on_lost_pointer, true );
			start_autoscroll();
		}

		/**
		 * Return one row captured for a Sortable segment host.
		 *
		 * @param {Object} state Active movement gesture.
		 * @param {HTMLElement|null} host Sortable destination host.
		 * @return {Object|null} Captured row or null.
		 */
		function get_row_for_host( state, host ) {
			var matched = null;

			if ( ! state || ! host ) {
				return null;
			}
			state.rows.some( function ( row ) {
				if ( row.host === host ) {
					matched = row;
					return true;
				}
				return false;
			} );

			return matched;
		}

		/**
		 * Return one row rectangle in captured or current viewport coordinates.
		 *
		 * Captured geometry is rebased by document and Timeline-canvas scrolling.
		 * Current geometry is read back from the same stable host immediately before
		 * use. A disconnected or collapsed host is not a valid destination.
		 *
		 * @param {Object} state Active movement gesture.
		 * @param {Object} row Captured row record.
		 * @param {string} geometry Geometry source: `captured` or `current`.
		 * @return {Object|null} Viewport rectangle or null.
		 */
		function get_row_rectangle( state, row, geometry ) {
			var rectangle;
			var document_delta_x;
			var document_delta_y;
			var canvas_delta_x;

			if ( 'current' === geometry ) {
				if ( ! row.host.isConnected ) {
					return null;
				}
				rectangle = row.host.getBoundingClientRect();
				return rectangle.right > rectangle.left && rectangle.bottom > rectangle.top ? rectangle : null;
			}
			document_delta_x = ( window.pageXOffset || 0 ) - state.doc_x;
			document_delta_y = ( window.pageYOffset || 0 ) - state.doc_y;
			canvas_delta_x = state.canvas ? state.canvas.scrollLeft - state.canvas_scroll : 0;

			return {
				left: row.left - document_delta_x - canvas_delta_x,
				right: row.right - document_delta_x - canvas_delta_x,
				top: row.top - document_delta_y,
				bottom: row.bottom - document_delta_y
			};
		}

		/**
		 * Return the visible Timeline canvas window for row hit-testing.
		 *
		 * @param {Object} state Active movement gesture.
		 * @param {string} geometry Geometry source: `captured` or `current`.
		 * @return {Object|null} Clipped viewport rectangle or null.
		 */
		function get_canvas_window( state, geometry ) {
			var rectangle;
			var document_delta_x;
			var document_delta_y;

			if ( ! state.canvas || ! state.canvas_rectangle ) {
				return null;
			}
			if ( 'current' === geometry ) {
				rectangle = state.canvas.getBoundingClientRect();
			} else {
				document_delta_x = ( window.pageXOffset || 0 ) - state.doc_x;
				document_delta_y = ( window.pageYOffset || 0 ) - state.doc_y;
				rectangle = {
					left: state.canvas_rectangle.left - document_delta_x,
					right: state.canvas_rectangle.right - document_delta_x,
					top: state.canvas_rectangle.top - document_delta_y,
					bottom: state.canvas_rectangle.bottom - document_delta_y
				};
			}

			return {
				left: Math.max( 0, rectangle.left ),
				right: Math.min( document.documentElement.clientWidth, rectangle.right ),
				top: Math.max( 0, rectangle.top ),
				bottom: Math.min( document.documentElement.clientHeight, rectangle.bottom )
			};
		}

		/**
		 * Resolve one unique neutral row candidate from explicit geometry.
		 *
		 * Equal-distance overlaps are rejected instead of being resolved by DOM order.
		 * The stable row order is retained only to make inspection deterministic; it
		 * never breaks an ambiguous tie.
		 *
		 * @param {Object} state Active movement gesture.
		 * @param {number} x Viewport X coordinate.
		 * @param {number} y Viewport Y coordinate.
		 * @param {string} geometry Geometry source: `captured` or `current`.
		 * @return {Object} Resolution record with status and optional row.
		 */
		function resolve_row( state, x, y, geometry ) {
			var threshold = Number( sortable_config.empty_insert_threshold ) || 18;
			var canvas_window = get_canvas_window( state, geometry );
			var matches = [];

			if (
				! canvas_window ||
				x < canvas_window.left || x > canvas_window.right ||
				y < canvas_window.top || y > canvas_window.bottom
			) {
				return { status: 'out_of_window', row: null };
			}
			state.rows.forEach( function ( row ) {
				var rectangle = get_row_rectangle( state, row, geometry );
				var row_distance;

				if ( ! rectangle || x < Math.max( rectangle.left, canvas_window.left ) || x > Math.min( rectangle.right, canvas_window.right ) ) {
					return;
				}
				row_distance = y < rectangle.top ? rectangle.top - y : ( y > rectangle.bottom ? y - rectangle.bottom : 0 );
				if ( row_distance <= threshold ) {
					matches.push( { row: row, distance: row_distance } );
				}
			} );
			matches.sort( function ( first, second ) {
				return first.distance === second.distance
					? first.row.order - second.row.order
					: first.distance - second.distance;
			} );
			if ( ! matches.length ) {
				return { status: 'none', row: null };
			}
			if ( 1 < matches.length && Math.abs( matches[0].distance - matches[1].distance ) < 0.5 ) {
				return { status: 'ambiguous', row: null };
			}

			return { status: 'resolved', row: matches[0].row };
		}

		/**
		 * Validate the frozen drop intent against the last rendered WPBC ghost.
		 *
		 * The visible custom ghost is created before Sortable completion bookkeeping.
		 * Its stored Resource identity therefore remains stable even when Sortable
		 * reparents or restores the real card before invoking `onEnd`. No target
		 * authorization is inferred by this comparison.
		 *
		 * @param {Object} state Completed movement gesture.
		 * @return {Object|null} Unique candidate row or null.
		 */
		function resolve_drop_candidate( state ) {
			var frozen_target = state.drop_intent
				? state.rows.filter( function ( row ) { return row.resource_id === state.drop_intent.target_resource_id; } )[0]
				: null;
			var visual_target = state.candidate_ghost_host
				? get_row_for_host( state, state.candidate_ghost_host )
				: null;

			if (
				! frozen_target ||
				! visual_target ||
				! frozen_target.host.isConnected ||
				visual_target.resource_id !== frozen_target.resource_id
			) {
				return null;
			}

			return frozen_target;
		}

		/**
		 * Freeze the Resource identity already attached to the visible WPBC ghost.
		 *
		 * The visual intent is recorded during pointer movement, when the custom ghost
		 * is rendered. This function only promotes that already-captured identity to
		 * the immutable completion intent. It deliberately reads no pointer-completion
		 * coordinates and no Sortable `event.to` value because Sortable may process its
		 * own earlier-registered document listener before WPBC receives `pointerup`.
		 *
		 * This records interaction identity only. It does not authorize the Resource;
		 * canonical Review must still reauthorize the submitted target server-side.
		 *
		 * @param {Object} state Active movement gesture.
		 * @return {Object|null} Frozen target row or null when reconciliation fails.
		 */
		function freeze_drop_intent( state ) {
			var target_row;

			if ( ! state || state.drop_intent ) {
				return state && state.drop_intent
					? state.rows.filter( function ( row ) { return row.resource_id === state.drop_intent.target_resource_id; } )[0] || null
					: null;
			}
			if ( ! state.source_row || ! state.visual_drop_intent ) {
				return null;
			}
			target_row = state.rows.filter( function ( row ) {
				return row.resource_id === state.visual_drop_intent.target_resource_id;
			} )[0] || null;
			if ( ! target_row || target_row.host !== state.visual_drop_intent.target_host || ! target_row.host.isConnected ) {
				return null;
			}
			state.drop_intent = state.visual_drop_intent;

			return target_row;
		}

		/**
		 * Remove the presentation-only ghost owned by one movement gesture.
		 *
		 * @param {Object} state Active movement gesture.
		 * @return {void}
		 */
		function clear_candidate_ghost( state ) {
			if ( ! state ) {
				return;
			}
			if ( state.candidate_ghost ) {
				state.candidate_ghost.remove();
			}
			state.candidate_ghost = null;
			state.candidate_ghost_host = null;
			state.visual_drop_intent = null;
		}

		/**
		 * Return the server-owned restriction for one visible destination row.
		 *
		 * A missing reason never makes an unavailable gesture eligible. It falls back
		 * to the generic operation restriction so the explicit drop can still explain
		 * why the canonical card returned to its saved position.
		 *
		 * @param {Object} state Active movement gesture.
		 * @param {Object|null} candidate Candidate Resource row.
		 * @return {string} Stable restriction key, or an empty string when eligible.
		 */
		function get_candidate_restriction( state, candidate ) {
			var movement = state && state.record ? state.record.context : null;
			var source_resource_id;
			var is_cross_resource;

			if ( ! movement || ! candidate ) {
				return '';
			}
			source_resource_id = state.source_row ? Number( state.source_row.resource_id ) : Number( state.record.resource_id );
			is_cross_resource = Number( candidate.resource_id ) !== source_resource_id;
			if ( is_cross_resource ) {
				return movement.cross_resource_available ? '' : String( movement.cross_resource_restriction || 'operation_unsupported' );
			}

			return movement.same_resource_available ? '' : String( movement.same_resource_restriction || 'operation_unsupported' );
		}

		/**
		 * Show one accessible warning after an explicitly denied destination drop.
		 *
		 * Pointer movement remains quiet so crossing Resource rows cannot create a
		 * stream of global notices. The warning is emitted only after the user drops.
		 *
		 * @param {string} reason Server-owned restriction key.
		 * @return {void}
		 */
		function show_destination_warning( reason ) {
			var denial_reasons = i18n.denial_reasons && 'object' === typeof i18n.denial_reasons ? i18n.denial_reasons : {};
			var message = denial_reasons[ reason ] || i18n.destination_unavailable || i18n.unavailable || '';

			announce( message );
			if ( message && callbacks && 'function' === typeof callbacks.show_admin_message ) {
				callbacks.show_admin_message( String( message ), 'warning', 7000 );
			}
		}

		/**
		 * Render the neutral ghost only inside the stabilized WPBC candidate row.
		 *
		 * Geometry is derived from the captured canonical card and the same snapped
		 * axis-cell delta later used by proposal construction. It communicates only
		 * placement intent; the server still authorizes the Resource and schedule.
		 * Cross-Resource feedback uses the neutral first lane because copying a
		 * deeper source lane could paint outside a shorter candidate Resource row.
		 *
		 * @param {Object} state Active movement gesture.
		 * @return {void}
		 */
		function update_candidate_ghost( state ) {
			var renderer;
			var buffer;
			var axis_delta;
			var candidate_top;
			var physical_delta;

			if ( ! state || ! state.candidate || ! state.axis.cells.length || get_candidate_restriction( state, state.candidate ) ) {
				clear_candidate_ghost( state );
				return;
			}
			axis_delta = get_pointer_axis_delta( state );
			if ( ! axis_delta || ! has_meaningful_movement( state, axis_delta ) ) {
				clear_candidate_ghost( state );
				return;
			}
			if ( ! state.candidate_ghost || state.candidate_ghost_host !== state.candidate.host ) {
				clear_candidate_ghost( state );
				renderer = template( templates.ghost );
				buffer = document.createElement( 'div' );
				if ( ! renderer ) {
					return;
				}
				buffer.innerHTML = renderer( state.ghost_data );
				state.candidate_ghost = buffer.firstElementChild;
				if ( ! state.candidate_ghost ) {
					return;
				}
				state.candidate_ghost_host = state.candidate.host;
				candidate_top = state.candidate.resource_id === state.record.resource_id
					? state.card.style.getPropertyValue( 'top' )
					: 'var(--wpbc_timeline_general__booking-lane-offset)';
				state.candidate_ghost.style.setProperty( 'inset-inline-start', state.card.style.getPropertyValue( 'inset-inline-start' ) );
				state.candidate_ghost.style.setProperty( 'width', state.card.style.getPropertyValue( 'width' ) );
				state.candidate_ghost.style.setProperty( 'top', candidate_top );
				state.candidate_ghost_host.appendChild( state.candidate_ghost );
			}
			physical_delta = 'full_day' === state.record.context.time_application
				? axis_delta.calendar_physical_delta_pixels
				: axis_delta.physical_delta_pixels;
			state.candidate_ghost.style.transform = 'translate3d(' + physical_delta + 'px, 0, 0)';
			state.visual_drop_intent = Object.freeze( {
				source_resource_id: Number( state.source_row ? state.source_row.resource_id : state.record.resource_id ),
				target_resource_id: Number( state.candidate.resource_id ),
				target_host: state.candidate_ghost_host
			} );
		}

		/**
		 * Stabilize neutral candidate feedback without claiming authorization.
		 *
		 * @param {Object|null} candidate Candidate row.
		 * @return {void}
		 */
		function stabilize_candidate( candidate ) {
			var now = window.performance.now();
			var moved = Math.hypot( gesture.x - gesture.start_x, gesture.y - gesture.start_y );
			var restriction;

			if ( moved < ( Number( sortable_config.deliberate_movement_pixels ) || 6 ) ) { candidate = null; }
			if ( candidate !== gesture.pending_candidate ) {
				gesture.pending_candidate = candidate;
				gesture.candidate_since = now;
				return;
			}
			if ( now - gesture.candidate_since < ( Number( sortable_config.candidate_dwell_milliseconds ) || 90 ) || candidate === gesture.candidate ) { return; }
			if ( gesture.candidate ) { gesture.candidate.host.classList.remove( 'is-booking-movement-candidate' ); }
			clear_candidate_ghost( gesture );
			gesture.candidate = candidate;
			if ( candidate ) {
				restriction = get_candidate_restriction( gesture, candidate );
				if ( ! restriction ) {
					candidate.host.classList.add( 'is-booking-movement-candidate' );
					announce( String( i18n.candidate_target || '' ).replace( '%s', String( candidate.resource_id ) ) );
				}
			}
			update_candidate_ghost( gesture );
		}

		/**
		 * Record pointer geometry only; never request or authorize in onMove.
		 *
		 * @param {PointerEvent} event Pointer-move event.
		 * @return {void}
		 */
		function on_pointer_move( event ) {
			var resolution;

			if ( gesture ) {
				gesture.x = Number( event.clientX ); gesture.y = Number( event.clientY );
				resolution = resolve_row( gesture, gesture.x, gesture.y, 'current' );
				stabilize_candidate( 'resolved' === resolution.status ? resolution.row : null );
				update_candidate_ghost( gesture );
			}
		}

		/**
		 * Mirror Sortable move events into the deterministic hit test.
		 *
		 * @param {Object} event Sortable move event.
		 * @param {Event} original_event Original input event.
		 * @return {boolean} Whether Sortable may track the reconciled row destination.
		 */
		function on_move( event, original_event ) {
			var pointer = original_event || event.originalEvent;
			var resolution;
			var sortable_destination;
			if ( gesture && pointer && Number.isFinite( Number( pointer.clientX ) ) ) {
				gesture.x = Number( pointer.clientX ); gesture.y = Number( pointer.clientY );
				resolution = resolve_row( gesture, gesture.x, gesture.y, 'current' );
				sortable_destination = get_row_for_host( gesture, event.to );
				gesture.sortable_destination = sortable_destination;
				if ( 'resolved' !== resolution.status || ! sortable_destination || resolution.row.resource_id !== sortable_destination.resource_id ) {
					stabilize_candidate( null );
					update_candidate_ghost( gesture );
					return false;
				}
				stabilize_candidate( resolution.row );
				update_candidate_ghost( gesture );
				return ! get_candidate_restriction( gesture, resolution.row );
			}
			return false;
		}

		/** Run owned dual-axis autoscroll. @return {void} */
		function autoscroll() {
			var edge = Number( sortable_config.autoscroll_edge_pixels ) || 48;
			var maximum = Number( sortable_config.autoscroll_max_pixels ) || 18;
			var rectangle;
			var delta = 0;

			scroll_frame = 0;
			if ( ! gesture || ! gesture.started ) { return; }
			if ( gesture.canvas ) {
				rectangle = gesture.canvas.getBoundingClientRect();
				if ( gesture.x < rectangle.left + edge ) { delta = -maximum; }
				if ( gesture.x > rectangle.right - edge ) { delta = maximum; }
				gesture.canvas.scrollLeft += delta;
			}
			delta = gesture.y < edge ? -maximum : ( gesture.y > document.documentElement.clientHeight - edge ? maximum : 0 );
			if ( delta ) { window.scrollBy( 0, delta ); }
			scroll_frame = window.requestAnimationFrame( autoscroll );
		}

		/** Start the movement-owned autoscroll loop. @return {void} */
		function start_autoscroll() {
			if ( ! scroll_frame ) { scroll_frame = window.requestAnimationFrame( autoscroll ); }
		}

		/** Stop the movement-owned autoscroll loop. @return {void} */
		function stop_autoscroll() {
			if ( scroll_frame ) { window.cancelAnimationFrame( scroll_frame ); scroll_frame = 0; }
		}

		/**
		 * Restore the real card to its captured DOM position and attributes.
		 *
		 * @param {Object} state Captured gesture state.
		 * @return {void}
		 */
		function restore_card( state ) {
			state.parent.insertBefore( state.card, state.next );
			if ( null === state.style ) { state.card.removeAttribute( 'style' ); } else { state.card.setAttribute( 'style', state.style ); }
			state.card.setAttribute( 'class', state.class_name );
			if ( state.origin ) { state.origin.remove(); state.origin = null; }
		}

		/**
		 * Release every temporary target, listener, mirror, and interaction lock.
		 *
		 * @param {Object} state Captured gesture state.
		 * @return {void}
		 */
		function release( state ) {
			stop_autoscroll();
			clear_candidate_ghost( state );
			document.removeEventListener( 'pointermove', on_pointer_move, true );
			document.removeEventListener( 'pointerup', on_pointer_completion, true );
			document.removeEventListener( 'pointercancel', on_lost_pointer, true );
			mount.classList.remove( 'is-booking-movement-active' );
			mount.querySelectorAll( '.is-booking-movement-candidate' ).forEach( function ( node ) { node.classList.remove( 'is-booking-movement-candidate' ); } );
			document.querySelectorAll( '.wpbc_timeline_booking_movement__sortable-fallback, .wpbc_timeline_booking_movement__mirror' ).forEach( function ( node ) {
				if ( node !== state.card ) { node.remove(); }
			} );
			if ( callbacks.set_axis_window_loading_locked ) { callbacks.set_axis_window_loading_locked( false ); }
			if ( callbacks.set_interaction_suspended ) { callbacks.set_interaction_suspended( false, state.card ); }
			pending_pointer = null;
		}

		/**
		 * Return the clamped axis cell under one physical coordinate.
		 *
		 * @param {Object} axis Captured axis.
		 * @param {number} x Viewport X coordinate.
		 * @return {number} Axis-cell index.
		 */
		function cell_index( axis, x ) {
			var found = -1;
			axis.cells.some( function ( cell, index ) {
				if ( x >= cell.left && x <= cell.right ) { found = index; return true; }
				return false;
			} );
			if ( -1 !== found ) { return found; }
			if ( axis.is_rtl ) { return x > axis.cells[0].right ? 0 : axis.cells.length - 1; }
			return x < axis.cells[0].left ? 0 : axis.cells.length - 1;
		}

		/**
		 * Return the signed whole-day distance between strict ISO calendar dates.
		 *
		 * Axis cells at hour and minute scales share the same site-local date. Using
		 * this value prevents one sub-day cell from becoming a one-day full-day move.
		 *
		 * @param {string} source_date Source ISO date.
		 * @param {string} target_date Target ISO date.
		 * @return {number|null} Signed calendar-day distance, or null.
		 */
		function calendar_day_delta( source_date, target_date ) {
			var source_match = String( source_date ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var target_match = String( target_date ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var source_epoch;
			var target_epoch;

			if ( ! source_match || ! target_match ) { return null; }
			source_epoch = Date.UTC( Number( source_match[1] ), Number( source_match[2] ) - 1, Number( source_match[3] ) );
			target_epoch = Date.UTC( Number( target_match[1] ), Number( target_match[2] ) - 1, Number( target_match[3] ) );

			return Math.round( ( target_epoch - source_epoch ) / 86400000 );
		}

		/**
		 * Return the first captured axis cell for one site-local date.
		 *
		 * @param {Object} axis Captured Timeline axis.
		 * @param {string} date ISO calendar date.
		 * @return {number} Cell index, or -1 when absent.
		 */
		function first_date_cell_index( axis, date ) {
			var found = -1;

			axis.cells.some( function ( cell, index ) {
				if ( date === cell.date ) {
					found = index;
					return true;
				}
				return false;
			} );

			return found;
		}

		/**
		 * Convert physical pointer movement into one immutable Timeline-axis delta.
		 *
		 * The pointer start and current pointer position are both resolved against
		 * the captured axis. This deliberately ignores Sortable list indexes and the
		 * rendered card origin, which may represent only a clipped schedule segment.
		 * Canvas scrolling is rebased into the captured coordinate space so the same
		 * delta drives both the destination ghost and the canonical schedule seed.
		 *
		 * @param {Object} state Captured gesture state.
		 * @return {Object|null} Snapped cell, instant, and physical deltas, or null.
		 */
		function get_pointer_axis_delta( state ) {
			var source_index;
			var target_index;
			var target_x;
			var day_delta;
			var source_day_index;
			var target_day_index;

			if ( ! state || ! state.axis || ! state.axis.cells.length ) {
				return null;
			}
			source_index = cell_index( state.axis, state.start_x );
			target_x = state.x + ( state.canvas ? state.canvas.scrollLeft - state.canvas_scroll : 0 );
			target_index = cell_index( state.axis, target_x );
			day_delta = calendar_day_delta( state.axis.cells[source_index].date, state.axis.cells[target_index].date );
			source_day_index = first_date_cell_index( state.axis, state.axis.cells[source_index].date );
			target_day_index = first_date_cell_index( state.axis, state.axis.cells[target_index].date );
			if ( null === day_delta || 0 > source_day_index || 0 > target_day_index ) { return null; }

			return Object.freeze( {
				source_index: source_index,
				target_index: target_index,
				cell_delta: target_index - source_index,
				calendar_day_delta: day_delta,
				/* Timeline axis epochs are Unix seconds; browser Date timestamps are milliseconds. */
				instant_delta_milliseconds: 1000 * ( state.axis.cells[target_index].start_epoch - state.axis.cells[source_index].start_epoch ),
				calendar_physical_delta_pixels: state.axis.cells[target_day_index].left - state.axis.cells[source_day_index].left,
				physical_delta_pixels: state.axis.cells[target_index].left - state.axis.cells[source_index].left
			} );
		}

		/**
		 * Whether a snapped pointer destination changes date/time or Resource.
		 *
		 * @param {Object} state Captured gesture state.
		 * @param {Object} axis_delta Captured pointer-to-axis delta.
		 * @return {boolean} True when canonical Review has a meaningful proposal.
		 */
		function has_meaningful_movement( state, axis_delta ) {
			var movement_resources = get_movement_resources( state );

			if ( movement_resources.is_cross_resource ) { return true; }
			if ( 'full_day' === state.record.context.time_application ) {
				return 0 !== axis_delta.calendar_day_delta;
			}

			return 0 !== axis_delta.instant_delta_milliseconds;
		}

		/**
		 * Resolve immutable source and target row identities for proposal semantics.
		 *
		 * The segment DTO identifies the canonical source allocation used by the
		 * context endpoint, but it must not decide whether the completed pointer
		 * gesture crossed visible Resource rows. That interaction meaning comes from
		 * the captured source host and the reconciled final destination host. The
		 * server continues to authorize the submitted target independently.
		 *
		 * @param {Object} state Captured gesture state.
		 * @return {Object} Source Resource, target Resource, and cross-row flag.
		 */
		function get_movement_resources( state ) {
			var source_resource = state.source_row ? Number( state.source_row.resource_id ) : Number( state.record.resource_id );
			var target_resource = state.drop_intent
				? Number( state.drop_intent.target_resource_id )
				: ( state.candidate ? Number( state.candidate.resource_id ) : source_resource );

			return Object.freeze( {
				source_resource_id: source_resource,
				target_resource_id: target_resource,
				is_cross_resource: Boolean( source_resource && target_resource && source_resource !== target_resource )
			} );
		}

		/**
		 * Shift a strict ISO calendar date by whole calendar days.
		 *
		 * @param {string} value ISO date.
		 * @param {number} days Signed day count.
		 * @return {string} Shifted ISO date or empty string.
		 */
		function shift_date( value, days ) {
			var match = String( value ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var date;
			if ( ! match ) { return ''; }
			date = new Date( Date.UTC( Number( match[1] ), Number( match[2] ) - 1, Number( match[3] ) + days ) );
			return date.toISOString().slice( 0, 10 );
		}

		/**
		 * Return site-timezone date parts for one epoch.
		 *
		 * @param {number} epoch Epoch milliseconds.
		 * @param {string} timezone IANA timezone.
		 * @return {Object|null} Zoned parts or null.
		 */
		function zoned_parts( epoch, timezone ) {
			var values = {};
			var formatter;
			try {
				formatter = new window.Intl.DateTimeFormat( 'en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', minute: '2-digit', second: '2-digit' } );
				formatter.formatToParts( new Date( epoch ) ).forEach( function ( part ) { if ( 'literal' !== part.type ) { values[part.type] = Number( part.value ); } } );
			} catch ( error ) { return null; }
			return values.year ? values : null;
		}

		/**
		 * Format an epoch as an RFC3339 exact minute in the site timezone.
		 *
		 * @param {number} epoch Epoch milliseconds.
		 * @param {string} timezone IANA timezone.
		 * @return {string} Exact-minute instant or empty string.
		 */
		function format_instant( epoch, timezone ) {
			var parts = zoned_parts( epoch, timezone );
			var represented;
			var offset;
			var sign;
			var pad = function ( value, length ) { return String( Math.abs( Math.round( value ) ) ).padStart( length, '0' ); };
			if ( ! parts ) { return ''; }
			represented = Date.UTC( parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second );
			offset = Math.round( ( represented - epoch ) / 60000 ); sign = 0 <= offset ? '+' : '-';
			return pad( parts.year, 4 ) + '-' + pad( parts.month, 2 ) + '-' + pad( parts.day, 2 ) + 'T' + pad( parts.hour, 2 ) + ':' + pad( parts.minute, 2 ) + ':00' + sign + pad( Math.floor( Math.abs( offset ) / 60 ), 2 ) + ':' + pad( Math.abs( offset ) % 60, 2 );
		}

		/**
		 * Build the bounded non-authoritative proposal after DOM restoration.
		 *
		 * @param {Object} state Captured gesture state.
		 * @return {Object|null} Review proposal or null.
		 */
		function proposal_from( state ) {
			var axis_delta;
			var movement = state.record.context;
			var movement_resources = get_movement_resources( state );
			var cross_resource = movement_resources.is_cross_resource;
			var target_resource = cross_resource ? movement_resources.target_resource_id : movement.primary_resource_id;
			var proposal;

			axis_delta = get_pointer_axis_delta( state );
			if ( ! axis_delta || ! has_meaningful_movement( state, axis_delta ) ) { return null; }
			if ( ( cross_resource && ! movement.cross_resource_available ) || ( ! cross_resource && ! movement.same_resource_available ) ) { return null; }
			proposal = {
				schema_version: Number( review_transport.schema_version ), booking_id: movement.booking_id,
				interaction_source: cross_resource ? 'cross_resource_drag' : 'drag',
				operation: cross_resource ? 'change_resource' : 'shift', target_resource_id: target_resource,
				selection_method: movement.selection_method, proposal_revision: movement.proposal_revision,
				source_context_token: movement.source_context_token
			};
			if ( 'full_day' === movement.time_application ) {
				proposal.proposed_dates = movement.selected_dates.map( function ( date ) { return shift_date( date, axis_delta.calendar_day_delta ); } );
				return proposal.proposed_dates.every( Boolean ) ? Object.freeze( proposal ) : null;
			}
			proposal.proposed_intervals = movement.exact_intervals.map( function ( interval ) {
				return Object.freeze( { start: format_instant( Date.parse( interval.start ) + axis_delta.instant_delta_milliseconds, state.axis.timezone ), end: format_instant( Date.parse( interval.end ) + axis_delta.instant_delta_milliseconds, state.axis.timezone ) } );
			} );
			return proposal.proposed_intervals.every( function ( interval ) { return interval.start && interval.end; } ) ? Object.freeze( proposal ) : null;
		}

		/**
		 * Mark the restored canonical card and Timeline busy for one Review request.
		 *
		 * The returned object owns every DOM and interaction change. Its identity
		 * prevents an older request from releasing a newer request's loading state.
		 *
		 * @param {HTMLElement} card Canonical booking card restored after the drop.
		 * @return {Object} Request-owned loading state.
		 */
		function begin_review_loading( card ) {
			var renderer = template( templates.loading );
			var buffer = document.createElement( 'span' );
			var state;

			end_review_loading( review_loading_state );
			state = {
				card: card,
				overlay: null,
				processing_notice: null,
				previous_aria_busy: card ? card.getAttribute( 'aria-busy' ) : null,
				released: false
			};
			if ( card && renderer ) {
				buffer.innerHTML = renderer( {} );
				state.overlay = buffer.firstElementChild;
				if ( state.overlay ) {
					card.appendChild( state.overlay );
				}
			}
			if ( card ) {
				card.classList.add( 'is-booking-movement-review-loading' );
				card.setAttribute( 'aria-busy', 'true' );
			}
			mount.classList.add( 'is-booking-movement-review-loading' );
			review_loading_state = state;
			if ( callbacks.set_interaction_suspended ) { callbacks.set_interaction_suspended( true, card ); }
			if ( callbacks.set_axis_window_loading_locked ) { callbacks.set_axis_window_loading_locked( true ); }

			return state;
		}

		/**
		 * Release the exact canonical-card loading state owned by one request.
		 *
		 * @param {Object|null} state Request-owned loading state.
		 * @return {void}
		 */
		function end_review_loading( state ) {
			if ( ! state || state.released ) {
				return;
			}
			state.released = true;
			hide_processing_notice( state.processing_notice );
			state.processing_notice = null;
			if ( state.overlay ) {
				state.overlay.remove();
				state.overlay = null;
			}
			if ( state.card ) {
				state.card.classList.remove( 'is-booking-movement-review-loading' );
				if ( null === state.previous_aria_busy ) {
					state.card.removeAttribute( 'aria-busy' );
				} else {
					state.card.setAttribute( 'aria-busy', state.previous_aria_busy );
				}
			}
			if ( review_loading_state !== state ) {
				return;
			}
			review_loading_state = null;
			mount.classList.remove( 'is-booking-movement-review-loading' );
			if ( callbacks.set_axis_window_loading_locked ) { callbacks.set_axis_window_loading_locked( false ); }
			if ( callbacks.set_interaction_suspended ) { callbacks.set_interaction_suspended( false, state.card ); }
		}

		/**
		 * Restore the scroll position captured before the movement Review lifecycle.
		 *
		 * @return {void}
		 */
		function restore_lifecycle_scroll() {
			var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );

			if ( ! lifecycle_anchor ) {
				return;
			}
			if ( canvas ) {
				canvas.scrollLeft = Number( lifecycle_anchor.canvas_scroll ) || 0;
			}
			window.scrollTo( Number( lifecycle_anchor.doc_x ) || 0, Number( lifecycle_anchor.doc_y ) || 0 );
		}

		/**
		 * Find the preferred canonical replacement card for the moved booking.
		 *
		 * @param {number} booking_id Canonical booking ID.
		 * @return {HTMLElement|null} Selected or first visible booking card.
		 */
		function find_booking_card( booking_id ) {
			var selected_card = null;
			var first_card = null;

			visible_records.some( function ( record ) {
				if ( record.booking_id !== booking_id || ! record.card.isConnected ) {
					return false;
				}
				if ( ! first_card ) {
					first_card = record.card;
				}
				if ( record.card.classList.contains( 'is-booking-selected' ) ) {
					selected_card = record.card;
					return true;
				}
				return false;
			} );

			return selected_card || first_card;
		}

		/**
		 * Restore focus to the canonical card and prefer its authorized movement grip.
		 *
		 * The selection control is a stable fallback and intentionally receives focus
		 * first. Its focus event requests fresh movement eligibility; once the server
		 * supplies the new grip, `render_grip()` transfers focus to that control.
		 *
		 * @param {number} booking_id Canonical booking ID.
		 * @return {void}
		 */
		function restore_lifecycle_focus( booking_id ) {
			if (
				lifecycle_anchor
				&& 'function' === typeof lifecycle_anchor.restore_focus
				&& true === lifecycle_anchor.restore_focus( booking_id )
			) {
				pending_grip_focus_booking_id = 0;
				return;
			}
			var card = replacement_card && replacement_card.isConnected ? replacement_card : find_booking_card( booking_id );
			var grip = card ? card.querySelector( '[data-wpbc-timeline-booking-movement-grip]' ) : null;
			var selection = card ? card.querySelector( '[data-wpbc-timeline-booking-select]' ) : null;

			if ( grip ) {
				pending_grip_focus_booking_id = 0;
				grip.focus();
				return;
			}
			pending_grip_focus_booking_id = booking_id;
			if ( selection ) {
				selection.focus();
				return;
			}
			if ( lifecycle_anchor && lifecycle_anchor.focus && lifecycle_anchor.focus.isConnected ) {
				pending_grip_focus_booking_id = 0;
				lifecycle_anchor.focus.focus();
			}
		}

		/** Remove only the movement-owned Review surface. @return {void} */
		function remove_review_host() {
			if ( review_host ) {
				review_host.remove();
				review_host = null;
			}
		}

		/**
		 * Release an idle or cancellable Review and restore its saved presentation.
		 *
		 * Apply and canonical recovery are deliberately not cancellable because the
		 * browser cannot know whether persistence completed.
		 *
		 * @return {void}
		 */
		function close_review() {
			var booking_id = lifecycle_anchor ? lifecycle_anchor.booking_id : 0;

			if ( -1 !== [ 'apply_pending', 'refresh_pending', 'refresh_error' ].indexOf( lifecycle_state ) ) {
				return;
			}
			lifecycle_generation += 1;
			if ( review_request && review_request.abort ) {
				review_request.abort();
			}
			review_request = null;
			review_memory = null;
			pending_apply_result = null;
			pending_completion = null;
			end_review_loading( review_loading_state );
			remove_review_host();
			mount.classList.remove( 'is-booking-movement-apply-pending' );
			lifecycle_state = 'idle';
			restore_lifecycle_scroll();
			restore_lifecycle_focus( booking_id );
			lifecycle_anchor = null;
			replacement_card = null;
		}

		/**
		 * Show the standard Booking Calendar Processing notice for Review loading.
		 *
		 * The legacy notice API does not return the element it creates. Capture the
		 * newest Processing wrapper immediately so this request can later hide only
		 * its own notice without affecting another administration request.
		 *
		 * @return {Object|null} Request-owned jQuery notice wrapper, or null.
		 */
		function show_processing_notice() {
			if ( 'function' !== typeof window.wpbc_admin_show_message_processing ) {
				return null;
			}

			window.wpbc_admin_show_message_processing( '' );

			return window.jQuery( '#ajax_working .wpbc_processing.wpbc_spin' ).last().closest( '[id^="wpbc_notice_"]' );
		}

		/**
		 * Hide the exact Processing notice owned by one settled Review request.
		 *
		 * @param {Object|null} processing_notice Request-owned jQuery wrapper.
		 * @return {void}
		 */
		function hide_processing_notice( processing_notice ) {
			if ( processing_notice && processing_notice.length ) {
				processing_notice.stop( true, true ).hide();
			}
		}

		/**
		 * Show one standard top-right administration error for Review failure.
		 *
		 * The page controller escapes the authorized plain-text message before it
		 * reaches the legacy HTML-capable notice API. Movement must not create or
		 * position a feature-specific notice surface.
		 *
		 * @param {string} message Safe localized error message.
		 * @return {void}
		 */
		function show_review_error_notice( message ) {
			if ( message && callbacks && 'function' === typeof callbacks.show_admin_message ) {
				callbacks.show_admin_message( String( message ), 'error', 10000 );
			}
		}

		/**
		 * Read one safe canonical error from a normalized AJAX response.
		 *
		 * @param {Object} failed_request Failed jQuery request.
		 * @param {string} fallback_message Translated operation fallback.
		 * @return {Object} Safe code and message.
		 */
		function get_request_error( failed_request, fallback_message ) {
			var error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;

			return {
				code: error_data && 'string' === typeof error_data.code ? error_data.code : '',
				message: error_data && 'string' === typeof error_data.message && error_data.message
					? error_data.message
					: String( fallback_message || '' )
			};
		}

		/**
		 * Bind the exact controls permitted for the current Review state.
		 *
		 * @return {void}
		 */
		function bind_review_controls() {
			var cancel_control = review_host ? review_host.querySelector( '[data-wpbc-timeline-booking-movement-review-close]' ) : null;
			var apply_control = review_host ? review_host.querySelector( '[data-wpbc-timeline-booking-movement-apply]' ) : null;
			var retry_control = review_host ? review_host.querySelector( '[data-wpbc-timeline-booking-movement-retry-refresh]' ) : null;

			if ( cancel_control ) {
				cancel_control.addEventListener( 'click', close_review );
			}
			if ( apply_control ) {
				apply_control.addEventListener( 'click', request_apply );
			}
			if ( retry_control ) {
				retry_control.addEventListener( 'click', refresh_after_apply );
			}
		}

		/**
		 * Render the module-owned shell around the canonical Review template.
		 *
		 * @param {Object} view_model Authorized presentation state.
		 * @return {boolean} True when the shell rendered.
		 */
		function render_review_surface( view_model ) {
			var shell = template( templates.review );
			var initial_focus;

			if ( ! shell ) {
				return false;
			}
			remove_review_host();
			review_host = document.createElement( 'div' );
			review_host.className = 'wpbc_shared_ui_inspector wpbc_timeline_booking_movement__review_host';
			review_host.innerHTML = shell( view_model );
			document.body.appendChild( review_host );
			bind_review_controls();
			initial_focus = review_host.querySelector( '[data-wpbc-timeline-booking-movement-apply], [data-wpbc-timeline-booking-movement-review-close], [data-wpbc-timeline-booking-movement-retry-refresh], [data-wpbc-timeline-booking-movement-review]' );
			if ( initial_focus ) {
				initial_focus.focus();
			}

			return true;
		}

		/**
		 * Render the current signed Review with state-specific actions.
		 *
		 * @param {string} status Visible localized lifecycle message.
		 * @param {Object} actions Allowed footer actions and busy state.
		 * @return {boolean} True when rendered.
		 */
		function render_signed_review( status, actions ) {
			var allowed_actions = actions || {};

			if ( ! review_memory || ! review_memory.review_html ) {
				return false;
			}

			return render_review_surface( {
				title: i18n.review_title || '',
				status: status || '',
				review_html: review_memory.review_html,
				cancel_label: i18n.cancel || '',
				apply_label: i18n.apply || '',
				retry_refresh_label: i18n.retry_refresh || '',
				can_cancel: Boolean( allowed_actions.can_cancel ),
				can_apply: Boolean( allowed_actions.can_apply ),
				can_retry_refresh: Boolean( allowed_actions.can_retry_refresh ),
				is_busy: Boolean( allowed_actions.is_busy )
			} );
		}

		/**
		 * Finish a non-mutating Review failure at the unchanged canonical card.
		 *
		 * @param {string} error_message Authorized plain-text error.
		 * @return {void}
		 */
		function finish_review_failure( error_message ) {
			var booking_id = lifecycle_anchor ? lifecycle_anchor.booking_id : 0;

			review_memory = null;
			remove_review_host();
			lifecycle_state = 'idle';
			restore_lifecycle_scroll();
			restore_lifecycle_focus( booking_id );
			announce( error_message );
			show_review_error_notice( error_message );
			lifecycle_anchor = null;
			replacement_card = null;
		}

		/**
		 * Render and retain one canonical signed Review for a single Apply attempt.
		 *
		 * @param {Object} response Canonical Review response.
		 * @param {Object} proposal Frozen browser proposal.
		 * @return {boolean} True when the response and templates are valid.
		 */
		function render_review( response, proposal ) {
			var canonical = template( review_transport.template_id );
			var review = response && response.review ? response.review : null;
			var review_resources = review && review.resources ? review.resources : {};
			var expected_resource_change = 'cross_resource_drag' === proposal.interaction_source;
			var token = String( response && response.token ? response.token : '' );

			if (
				! canonical
				|| ! review
				|| Number( review.booking_id || 0 ) !== proposal.booking_id
				|| String( review.interaction_source || '' ) !== proposal.interaction_source
				|| String( review.operation || '' ) !== proposal.operation
				|| Number( review_resources.proposed_target && review_resources.proposed_target.id || 0 ) !== Number( proposal.target_resource_id )
				|| Boolean( review_resources.resource_changed ) !== expected_resource_change
				|| ! response.plan
				|| ! /^[a-f0-9]{64}$/i.test( token )
				|| Number( response.expires_at || 0 ) <= Date.now() / 1000
				|| ! apply_transport.url
				|| ! apply_transport.action
				|| ! apply_transport.nonce
			) {
				return false;
			}
			review_memory = Object.freeze( {
				booking_id: proposal.booking_id,
				plan: response.plan,
				token: token,
				expires_at: Number( response.expires_at ),
				review_html: canonical( review )
			} );
			lifecycle_state = 'review_ready';

			return render_signed_review( i18n.review_ready || '', { can_cancel: true, can_apply: true } );
		}

		/**
		 * Request canonical non-mutating Review for one restored movement proposal.
		 *
		 * @param {Object} proposal Frozen browser proposal.
		 * @param {Object} state Restored gesture state.
		 * @return {void}
		 */
		function open_canonical_review( proposal, state ) {
			var pending;
			var loading_state;
			var error_message;
			var request_generation;

			lifecycle_anchor = {
				booking_id: proposal.booking_id,
				canvas_scroll: state.canvas_scroll,
				doc_x: state.doc_x,
				doc_y: state.doc_y,
				focus: state.focus,
				restore_focus: 'function' === typeof state.restore_focus ? state.restore_focus : null
			};
			replacement_card = state.card;
			lifecycle_generation += 1;
			request_generation = lifecycle_generation;
			lifecycle_state = 'review_pending';
			if ( ! review_transport.url ) {
				finish_review_failure( String( i18n.review_failed || '' ) );
				return;
			}
			announce( i18n.review_loading || '' );
			loading_state = begin_review_loading( state.card );
			loading_state.processing_notice = show_processing_notice();
			pending = window.jQuery.ajax( {
				url: review_transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: review_transport.action,
					nonce: review_transport.nonce,
					booking_id: proposal.booking_id,
					source: review_transport.source || 'timeline',
					proposal: JSON.stringify( proposal )
				}
			} ).done( function ( response ) {
				if ( request_generation !== lifecycle_generation || review_request !== pending ) {
					return;
				}
				if ( ! response || ! response.success || ! render_review( response.data, proposal ) ) {
					error_message = String( i18n.review_failed || '' );
					finish_review_failure( error_message );
				}
			} ).fail( function ( failed_request, request_status ) {
				if ( request_generation !== lifecycle_generation || 'abort' === request_status || review_request !== pending ) {
					return;
				}
				error_message = get_request_error( failed_request, i18n.review_failed || '' ).message;
				finish_review_failure( error_message );
			} ).always( function () {
				end_review_loading( loading_state );
				if ( review_request === pending ) {
					review_request = null;
				}
			} );
			review_request = pending;
		}

		/**
		 * Accept a proposal produced by another registered Timeline presentation.
		 *
		 * This method accepts only the two movement-policy pairs already used by the
		 * native Timeline: `drag + shift` and `cross_resource_drag + change_resource`.
		 * It remains presentation-neutral. The canonical Review endpoint still reloads authority, validates
		 * allocation identity, Appointment rules, availability, and conflicts before
		 * it returns a signed Apply plan.
		 *
		 * @param {Object} proposal Executable-free movement proposal.
		 * @param {Object} state    Restored card, scroll, and focus context.
		 * @return {boolean} True when the canonical Review lifecycle started.
		 */
		function review_movement_proposal( proposal, state ) {
			var has_dates = Array.isArray( proposal && proposal.proposed_dates ) && proposal.proposed_dates.length;
			var has_intervals = Array.isArray( proposal && proposal.proposed_intervals ) && proposal.proposed_intervals.length;
			var interaction_source = String( proposal && proposal.interaction_source || '' );
			var operation = String( proposal && proposal.operation || '' );
			var is_same_resource = 'drag' === interaction_source && 'shift' === operation;
			var is_cross_resource = 'cross_resource_drag' === interaction_source && 'change_resource' === operation;

			if (
				'idle' !== lifecycle_state
				|| gesture
				|| review_request
				|| ! proposal
				|| Number( proposal.schema_version ) !== Number( review_transport.schema_version )
				|| ! Number( proposal.booking_id )
				|| ( ! is_same_resource && ! is_cross_resource )
				|| ! Number( proposal.target_resource_id )
				|| ! [ 'policy', 'individual' ].includes( String( proposal.selection_method || '' ) )
				|| ! Number( proposal.proposal_revision )
				|| ! String( proposal.source_context_token || '' )
				|| Boolean( has_dates ) === Boolean( has_intervals )
				|| ! state
				|| ! state.card
				|| ! state.card.isConnected
			) {
				return false;
			}
			open_canonical_review( Object.freeze( proposal ), state );

			return true;
		}

		/**
		 * Verify the minimum canonical identity required before host readback.
		 *
		 * @param {Object} result Canonical Apply response.
		 * @param {number} booking_id Expected booking ID.
		 * @return {boolean} True when the response can identify one saved booking.
		 */
		function is_apply_result_valid( result, booking_id ) {
			var identity = result && result.canonical_identity ? result.canonical_identity : null;
			var host_refresh = result && result.host_refresh ? result.host_refresh : null;

			return Boolean(
				result
				&& Number( result.booking_id || 0 ) === booking_id
				&& identity
				&& Number( identity.booking_id || 0 ) === booking_id
				&& String( identity.modification_date || '' )
				&& host_refresh
				&& true === host_refresh.required
				&& Number( host_refresh.booking_id || 0 ) === booking_id
			);
		}

		/**
		 * Decide whether a failed Apply may have reached persistence.
		 *
		 * Network failures, server failures, and failed compensation cannot safely
		 * restore the pre-Apply card from browser memory. They require canonical
		 * readback before the Timeline is presented as restored.
		 *
		 * @param {Object} failed_request Failed jQuery request.
		 * @param {string} request_status jQuery request status.
		 * @param {Object} error Normalized server error.
		 * @return {boolean} True when persistence outcome is uncertain.
		 */
		function is_uncertain_apply_failure( failed_request, request_status, error ) {
			var status = Number( failed_request && failed_request.status ? failed_request.status : 0 );

			return 'abort' !== request_status && (
				! status
				|| 500 <= status
				|| 'wpbc_booking_date_editor_compensation_failed' === error.code
			);
		}

		/**
		 * Restore canonical scroll and focus after one completed readback lifecycle.
		 *
		 * @param {number} booking_id Canonical booking ID.
		 * @return {void}
		 */
		function restore_after_readback( booking_id ) {
			var expected_anchor = lifecycle_anchor;

			restore_lifecycle_scroll();
			restore_lifecycle_focus( booking_id );
			window.requestAnimationFrame( function () {
				if ( expected_anchor !== lifecycle_anchor ) {
					return;
				}
				restore_lifecycle_scroll();
				window.requestAnimationFrame( function () {
					if ( expected_anchor !== lifecycle_anchor ) {
						return;
					}
					restore_lifecycle_scroll();
					restore_lifecycle_focus( booking_id );
					lifecycle_anchor = null;
					replacement_card = null;
				} );
			} );
		}

		/**
		 * Finish success or failure only after canonical readback has settled.
		 *
		 * @return {void}
		 */
		function finish_after_readback() {
			var completion = pending_completion || {};
			var booking_id = pending_apply_result ? Number( pending_apply_result.booking_id || 0 ) : 0;

			remove_review_host();
			review_memory = null;
			pending_apply_result = null;
			pending_completion = null;
			mount.classList.remove( 'is-booking-movement-apply-pending' );
			lifecycle_state = 'idle';
			restore_after_readback( booking_id );
			announce( completion.message || '' );
			if ( completion.message && callbacks && 'function' === typeof callbacks.show_admin_message ) {
				callbacks.show_admin_message( completion.message, completion.type || 'success', Number( completion.delay ) || 3000 );
			}
		}

		/**
		 * Render an explicit readback-only recovery action.
		 *
		 * @return {void}
		 */
		function render_refresh_error() {
			lifecycle_state = 'refresh_error';
			render_signed_review( i18n.refresh_failed || '', { can_retry_refresh: true } );
			announce( i18n.refresh_failed || '' );
			show_review_error_notice( i18n.refresh_failed || '' );
		}

		/**
		 * Refresh every canonical host projection after Apply or uncertain persistence.
		 *
		 * Retrying this method can repeat only read operations. The signed Apply plan
		 * has already been discarded and is never submitted automatically again.
		 *
		 * @return {void}
		 */
		function refresh_after_apply() {
			var refresh_result;
			var request_generation;

			if ( ! pending_apply_result || 'refresh_pending' === lifecycle_state ) {
				return;
			}
			lifecycle_state = 'refresh_pending';
			mount.classList.add( 'is-booking-movement-apply-pending' );
			render_signed_review( i18n.refreshing || '', { is_busy: true } );
			request_generation = lifecycle_generation;
			if ( ! callbacks || 'function' !== typeof callbacks.refresh_after_apply ) {
				render_refresh_error();
				return;
			}
			try {
				refresh_result = callbacks.refresh_after_apply( pending_apply_result );
			} catch ( refresh_error ) {
				refresh_result = window.jQuery.Deferred().reject( refresh_error ).promise();
			}
			window.jQuery.when( refresh_result ).done( function () {
				if ( is_destroyed || request_generation !== lifecycle_generation || ! pending_apply_result ) {
					return;
				}
				finish_after_readback();
			} ).fail( function () {
				if ( is_destroyed || request_generation !== lifecycle_generation || ! pending_apply_result ) {
					return;
				}
				render_refresh_error();
			} );
		}

		/**
		 * Finish a known non-persistent Apply rejection at the original card.
		 *
		 * @param {string} error_message Authorized plain-text error.
		 * @return {void}
		 */
		function finish_apply_rejection( error_message ) {
			var booking_id = lifecycle_anchor ? lifecycle_anchor.booking_id : 0;

			review_memory = null;
			remove_review_host();
			mount.classList.remove( 'is-booking-movement-apply-pending' );
			lifecycle_state = 'idle';
			restore_lifecycle_scroll();
			restore_lifecycle_focus( booking_id );
			announce( error_message );
			show_review_error_notice( error_message );
			lifecycle_anchor = null;
			replacement_card = null;
		}

		/**
		 * Force canonical readback when Apply persistence cannot be inferred safely.
		 *
		 * @param {number} booking_id Canonical booking ID.
		 * @param {string} error_message Error to display after successful readback.
		 * @return {void}
		 */
		function recover_uncertain_apply( booking_id, error_message ) {
			review_memory = review_memory ? Object.freeze( {
				booking_id: review_memory.booking_id,
				plan: null,
				token: '',
				expires_at: 0,
				review_html: review_memory.review_html
			} ) : null;
			pending_apply_result = { booking_id: booking_id, changed: false, recovery_readback: true };
			pending_completion = { message: error_message, type: 'error', delay: 10000 };
			refresh_after_apply();
		}

		/**
		 * Submit the signed Review exactly once and never retry its mutation.
		 *
		 * @return {void}
		 */
		function request_apply() {
			var apply_memory;
			var booking_id;
			var request_generation;
			var pending;

			if (
				'review_ready' !== lifecycle_state
				|| apply_request
				|| pending_apply_result
				|| ! review_memory
				|| ! review_memory.plan
				|| ! /^[a-f0-9]{64}$/i.test( String( review_memory.token || '' ) )
				|| ! apply_transport.url
				|| ! apply_transport.action
				|| ! apply_transport.nonce
			) {
				return;
			}
			apply_memory = review_memory;
			booking_id = review_memory.booking_id;
			request_generation = lifecycle_generation;
			lifecycle_state = 'apply_pending';
			mount.classList.add( 'is-booking-movement-apply-pending' );
			render_signed_review( i18n.applying || '', { is_busy: true } );
			apply_processing_notice = show_processing_notice();
			pending = window.jQuery.ajax( {
				url: apply_transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: apply_transport.action,
					nonce: apply_transport.nonce,
					booking_id: booking_id,
					source: apply_transport.source || 'timeline',
					send_modified_email: get_send_modified_email_intent(),
					plan: JSON.stringify( apply_memory.plan ),
					token: apply_memory.token
				}
			} ).done( function ( response ) {
				var result = response && response.success ? response.data : null;

				if ( is_destroyed || request_generation !== lifecycle_generation || apply_request !== pending ) {
					return;
				}
				review_memory = Object.freeze( {
					booking_id: apply_memory.booking_id,
					plan: null,
					token: '',
					expires_at: 0,
					review_html: apply_memory.review_html
				} );
				if ( ! is_apply_result_valid( result, booking_id ) ) {
					recover_uncertain_apply( booking_id, i18n.apply_failed || '' );
					return;
				}
				pending_apply_result = result;
				pending_completion = { message: i18n.applied || '', type: 'success', delay: 3000 };
				refresh_after_apply();
			} ).fail( function ( failed_request, request_status ) {
				var error;

				if ( is_destroyed || request_generation !== lifecycle_generation || 'abort' === request_status || apply_request !== pending ) {
					return;
				}
				error = get_request_error( failed_request, i18n.apply_failed || '' );
				if ( is_uncertain_apply_failure( failed_request, request_status, error ) ) {
					recover_uncertain_apply( booking_id, error.message );
					return;
				}
				finish_apply_rejection( error.message );
			} ).always( function () {
				hide_processing_notice( apply_processing_notice );
				apply_processing_notice = null;
				if ( apply_request === pending ) {
					apply_request = null;
				}
			} );
			apply_request = pending;
		}

		/**
		 * Read the live Timeline notification preference at mutation time.
		 *
		 * Review is intentionally non-mutating, so the current toggle value must be
		 * read only when Apply is submitted rather than stored in the signed plan.
		 *
		 * @return {number} One when the Modified email was requested; otherwise zero.
		 */
		function get_send_modified_email_intent() {
			var email_toggle;

			if ( 'undefined' === typeof document || 'function' !== typeof document.querySelector ) {
				return 0;
			}
			email_toggle = document.querySelector( '[data-wpbc-send-modified-email]' );

			return email_toggle && email_toggle.checked ? 1 : 0;
		}

		/**
		 * Restore the canonical card before constructing and reviewing the proposal.
		 *
		 * @param {Object} event Sortable completion event.
		 * @return {void}
		 */
		function on_end( event ) {
			var state = gesture;
			var drop_candidate;
			var proposal;
			var destination_restriction;
			if ( ! state ) { return; }
			destination_restriction = get_candidate_restriction( state, state.candidate );
			freeze_drop_intent( state );
			drop_candidate = resolve_drop_candidate( state );
			state.candidate = drop_candidate;
			if ( ! drop_candidate ) { state.drop_intent = null; }
			restore_card( state ); release( state ); gesture = null;
			proposal = proposal_from( state );
			if ( state.canvas ) { state.canvas.scrollLeft = state.canvas_scroll; }
			window.scrollTo( state.doc_x, state.doc_y );
			if ( proposal ) {
				open_canonical_review( proposal, state );
			} else {
				if ( destination_restriction ) {
					show_destination_warning( destination_restriction );
				}
				if ( state.focus && state.focus.isConnected ) { state.focus.focus(); }
			}
		}

		/**
		 * Cancel and restore DOM, scroll, focus, selection, and locks.
		 *
		 * @param {boolean} restore_scroll Whether to restore scroll anchors.
		 * @return {void}
		 */
		function cancel( restore_scroll ) {
			var state = gesture;
			if ( ! state ) { return; }
			restore_card( state ); release( state ); gesture = null;
			if ( restore_scroll ) {
				if ( state.canvas ) { state.canvas.scrollLeft = state.canvas_scroll; }
				window.scrollTo( state.doc_x, state.doc_y );
			}
			if ( state.focus && state.focus.isConnected ) { state.focus.focus(); }
			announce( i18n.cancelled || '' );
		}

		/**
		 * Preserve the already-rendered visual intent at pointer completion.
		 *
		 * Sortable may invoke `onEnd` from its own earlier-registered document listener
		 * before this listener runs. Correctness therefore comes from the visual intent
		 * captured during pointer movement, not from this listener's execution order.
		 * The deferred cancellation remains a fail-safe when Sortable never dispatches
		 * `onEnd` after the pointer is released.
		 *
		 * @param {PointerEvent} event Pointer completion event.
		 * @return {void}
		 */
		function on_pointer_completion( event ) {
			var destination_restriction = '';

			if ( gesture ) {
				destination_restriction = get_candidate_restriction( gesture, gesture.candidate );
				freeze_drop_intent( gesture );
			}
			window.setTimeout( function () {
				if ( gesture ) {
					cancel( true );
					if ( destination_restriction ) {
						show_destination_warning( destination_restriction );
					}
				}
			}, 0 );
		}
		/** Cancel after lost pointer completion. @return {void} */
		function on_lost_pointer() { cancel( true ); }
		/**
		 * Keep keyboard focus within the movement Review dialog.
		 *
		 * @param {KeyboardEvent} event Keyboard event.
		 * @return {void}
		 */
		function trap_review_focus( event ) {
			var controls;
			var first;
			var last;

			if ( 'Tab' !== event.key || ! review_host ) {
				return;
			}
			controls = Array.prototype.filter.call(
				review_host.querySelectorAll( 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])' ),
				function ( control ) { return ! control.hidden && null !== control.offsetParent; }
			);
			if ( ! controls.length ) {
				return;
			}
			first = controls[0];
			last = controls[ controls.length - 1 ];
			if ( event.shiftKey && document.activeElement === first ) {
				event.preventDefault();
				last.focus();
			} else if ( ! event.shiftKey && document.activeElement === last ) {
				event.preventDefault();
				first.focus();
			} else if ( ! review_host.contains( document.activeElement ) ) {
				event.preventDefault();
				first.focus();
			}
		}

		/**
		 * Cancel movement or close Review with Escape.
		 *
		 * @param {KeyboardEvent} event Keyboard event.
		 * @return {void}
		 */
		function on_keydown( event ) {
			if ( 'Escape' === event.key ) {
				if ( gesture ) { event.preventDefault(); cancel( true ); } else if ( review_request || review_loading_state || review_host ) { event.preventDefault(); close_review(); }
				return;
			}
			trap_review_focus( event );
		}
		/**
		 * Cancel only an unfinished pointer gesture when browser focus leaves.
		 *
		 * A completed drop already owns a canonical Review request. Browser chrome,
		 * developer tools, password managers, and operating-system dialogs can blur
		 * the content window without navigation, so blur must not abort that request.
		 *
		 * @return {void}
		 */
		function on_blur() {
			if ( gesture ) {
				cancel( true );
			}
		}
		/**
		 * Cancel only an unfinished pointer gesture when the document is hidden.
		 *
		 * A pending read-only Review may safely settle while its tab is temporarily
		 * hidden. Its request-owned loading state remains visible when focus returns.
		 *
		 * @return {void}
		 */
		function on_visibility() {
			if ( document.hidden && gesture ) {
				cancel( true );
			}
		}

		/**
		 * Cancel all movement work when the page is actually being discarded.
		 *
		 * Unlike a temporary blur, pagehide is a navigation/teardown boundary and no
		 * Review UI can be delivered into the departing document.
		 *
		 * @return {void}
		 */
		function on_page_hide() {
			cancel( true );
			force_lifecycle_teardown();
		}

		/** Destroy movement-owned Sortable instances. @return {void} */
		function destroy_sortables() {
			sortables.forEach( function ( sortable ) { if ( sortable && sortable.destroy ) { sortable.destroy(); } } );
			sortables = [];
		}

		/** Create Sortable targets for visible Resource rows. @return {void} */
		function synchronize_sortables() {
			destroy_sortables();
			mount.querySelectorAll( '[data-wpbc-timeline-segments]' ).forEach( function ( row ) {
				sortables.push( new window.Sortable( row, {
					group: { name: group_name, pull: true, put: true }, sort: false, direction: 'horizontal',
					handle: '[data-wpbc-timeline-booking-movement-grip]', draggable: '[data-wpbc-timeline-booking-movable="true"]',
					filter: filter_selector, preventOnFilter: false, forceFallback: true, fallbackOnBody: true,
					fallbackTolerance: Number( sortable_config.fallback_tolerance ) || 8, animation: 0,
					emptyInsertThreshold: Number( sortable_config.empty_insert_threshold ) || 18, scroll: false,
					fallbackClass: 'wpbc_timeline_booking_movement__sortable-fallback', ghostClass: 'wpbc_timeline_booking_movement__sortable-ghost', chosenClass: 'wpbc_timeline_booking_movement__sortable-chosen',
					onChoose: on_choose, onClone: on_clone, onStart: on_start, onMove: on_move, onEnd: on_end
				} ) );
			} );
		}

		/**
		 * Register one canonical segment DTO after rendering.
		 *
		 * @param {HTMLElement} card Rendered booking card.
		 * @param {Object} segment Authorized segment DTO.
		 * @return {void}
		 */
		function register_segment( card, segment ) {
			var booking_id = Number( segment.booking_id );
			var record;

			if ( card && booking_id && segment.segment_id && segment.visible_start && segment.visible_end ) {
				record = { card: card, rail: card.querySelector( '[data-wpbc-timeline-booking-control-rail]' ), booking_id: booking_id, resource_id: Number( segment.resource_id ), segment_id: String( segment.segment_id ), visible_start: String( segment.visible_start ), visible_end: String( segment.visible_end ), state: 'idle', generation: 0, context: null };
				records.set( card, record );
				visible_records.push( record );
				hide_unresolved_indicator( record );
			}
		}

		/**
		 * Prepare for canonical Timeline replacement.
		 *
		 * A readback requested after Apply must retain only its immutable result and
		 * recovery state while every rendered booking card is discarded.
		 *
		 * @return {void}
		 */
		function begin_refresh() {
			var preserves_apply_readback = -1 !== [ 'apply_pending', 'refresh_pending', 'refresh_error' ].indexOf( lifecycle_state );

			cancel( true );
			if ( ! preserves_apply_readback ) {
				close_review();
			}
			destroy_sortables();
			generation += 1;
			records = new WeakMap();
			visible_records = [];
			requests = new WeakMap();
			replacement_card = null;
		}

		/**
		 * Rebuild targets and identify the canonical moved card after readback.
		 *
		 * @param {Object} selection_state Canonical Timeline booking selection.
		 * @return {void}
		 */
		function complete_refresh( selection_state ) {
			synchronize_sortables();
			if ( pending_apply_result ) {
				replacement_card = find_booking_card( Number( pending_apply_result.booking_id || 0 ) );
				if ( selection_state && Number( selection_state.booking_id || 0 ) !== Number( pending_apply_result.booking_id || 0 ) ) {
					replacement_card = find_booking_card( Number( pending_apply_result.booking_id || 0 ) );
				}
			}
		}
		/**
		 * Cancel when foreground loading begins.
		 *
		 * @param {boolean} is_loading Whether loading is active.
		 * @return {void}
		 */
		function set_request_loading( is_loading ) {
			if ( is_loading && -1 === [ 'apply_pending', 'refresh_pending', 'refresh_error' ].indexOf( lifecycle_state ) ) {
				cancel( true );
				close_review();
			}
		}
		/** Report movement ownership. @return {boolean} Ownership state. */
		function is_interacting() {
			return Boolean( gesture || review_request || review_loading_state || review_host || 'idle' !== lifecycle_state );
		}

		/** Initialize listeners and live region. @return {void} */
		function initialize() {
			var renderer;
			var buffer;
			if ( initialized || ! mount ) { return; }
			initialized = true;
			is_destroyed = false;
			renderer = template( templates.live_region );
			if ( renderer ) { buffer = document.createElement( 'span' ); buffer.innerHTML = renderer( {} ); live_region = buffer.firstElementChild; if ( live_region ) { mount.appendChild( live_region ); } }
			mount.addEventListener( 'pointerover', on_context_intent ); mount.addEventListener( 'focusin', on_context_intent ); mount.addEventListener( 'pointerdown', on_pointer_down, true );
			document.addEventListener( 'keydown', on_keydown ); document.addEventListener( 'visibilitychange', on_visibility ); window.addEventListener( 'blur', on_blur ); window.addEventListener( 'pagehide', on_page_hide );
			synchronize_sortables();
		}

		/**
		 * Abort browser work and remove all transient lifecycle presentation.
		 *
		 * This is reserved for navigation and module teardown. It does not present a
		 * restored card because the owning document is being replaced.
		 *
		 * @return {void}
		 */
		function force_lifecycle_teardown() {
			lifecycle_generation += 1;
			if ( review_request && review_request.abort ) {
				review_request.abort();
			}
			if ( apply_request && apply_request.abort ) {
				apply_request.abort();
			}
			review_request = null;
			apply_request = null;
			hide_processing_notice( apply_processing_notice );
			apply_processing_notice = null;
			end_review_loading( review_loading_state );
			remove_review_host();
			review_memory = null;
			pending_apply_result = null;
			pending_completion = null;
			lifecycle_anchor = null;
			replacement_card = null;
			pending_grip_focus_booking_id = 0;
			lifecycle_state = 'idle';
			mount.classList.remove( 'is-booking-movement-apply-pending' );
		}

		/** Destroy movement-owned state and listeners. @return {void} */
		function destroy() {
			if ( ! initialized ) { return; }
			is_destroyed = true;
			cancel( true ); force_lifecycle_teardown(); destroy_sortables(); generation += 1; records = new WeakMap(); visible_records = []; requests = new WeakMap();
			mount.removeEventListener( 'pointerover', on_context_intent ); mount.removeEventListener( 'focusin', on_context_intent ); mount.removeEventListener( 'pointerdown', on_pointer_down, true );
			document.removeEventListener( 'keydown', on_keydown ); document.removeEventListener( 'visibilitychange', on_visibility ); window.removeEventListener( 'blur', on_blur ); window.removeEventListener( 'pagehide', on_page_hide );
			if ( live_region ) { live_region.remove(); live_region = null; }
			initialized = false;
		}

		return { initialize: initialize, destroy: destroy, begin_refresh: begin_refresh, register_segment: register_segment, complete_refresh: complete_refresh, set_request_loading: set_request_loading, is_interacting: is_interacting, review_movement_proposal: review_movement_proposal };
	}

	interactions.register_extension_factory( create_controller );
	modules.register_factory( 'booking_movement', function () {
		return { initialize: function () {}, destroy: function () {}, is_available: function () { return true; } };
	} );
}( window, document ) );
