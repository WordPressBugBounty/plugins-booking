/**
 * Timeline booking-resizing pointer-preview controller.
 *
 * The server authorizes an immutable resize context. This controller owns
 * pointer capture, bounded loaded-axis geometry, presentation-only ghosts, one
 * canonical non-mutating Review request after pointer release, and one guarded
 * Apply request for the resulting signed plan. Canonical validation,
 * persistence, and readback remain server-owned.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var template_keys = [ 'loading', 'handles', 'ghost', 'review', 'live_region' ];
	var supported_shapes = [ 'single_timed_interval', 'continuous_boundary_interval', 'single_full_day', 'continuous_full_day_range', 'independent_full_days', 'recurrent_timed_intervals', 'discontinuous_timed_intervals' ];
	var full_day_shapes = [ 'single_full_day', 'continuous_full_day_range', 'independent_full_days' ];
	var operations = [ 'resize_start', 'resize_end' ];
	var drag_threshold = 5;
	var touch_vertical_threshold = 8;
	var auto_scroll_edge = 56;
	var auto_scroll_step = 22;
	var review_gap = 8;

	/**
	 * Create one card-scoped resize presentation controller.
	 *
	 * @param {HTMLElement} mount         Timeline mount.
	 * @param {Object}      configuration Server-owned transport and template DTO.
	 * @param {Object}      callbacks     Bounded Timeline integration callbacks.
	 * @return {Object|null} Controller API or null for an incomplete contract.
	 */
	function create_controller( mount, configuration, callbacks ) {
		var transport = configuration && configuration.transport ? configuration.transport : {};
		var review_transport = configuration && configuration.review_transport ? configuration.review_transport : {};
		var apply_transport = configuration && configuration.apply_transport ? configuration.apply_transport : {};
		var templates = configuration && configuration.templates ? configuration.templates : {};
		var pointer_configuration = configuration && configuration.pointer ? configuration.pointer : {};
		var i18n = configuration && configuration.i18n ? configuration.i18n : {};
		var snap_to_timeline_step = false !== pointer_configuration.snap_to_timeline_step;
		var segment_records = new WeakMap();
		var visible_segments = [];
		var active_ghost_records = [];
		var active_selection = null;
		var eligibility_request = null;
		var request_generation = 0;
		var presentation_generation = 0;
		var interaction_state = 'idle';
		var pointer_gesture = null;
		var preview_frame = 0;
		var transient_scroll_canvas = null;
		var review_request = null;
		var review_generation = 0;
		var review_host = null;
		var review_scroll_canvas = null;
		var review_position_frame = 0;
		var review_focus_target = null;
		var review_memory = null;
		var review_error_base = null;
		var apply_request = null;
		var apply_generation = 0;
		var pending_apply_result = null;
		var apply_focus_operation = '';
		var suppress_handle_click = false;
		var is_destroyed = false;

		if ( ! mount || ! has_required_contract() ) {
			return null;
		}
		mount.addEventListener( 'pointerdown', handle_pointer_down, true );

		/**
		 * Validate the fixed transport and allow-listed templates.
		 *
		 * @return {boolean} True when the static contract is usable.
		 */
		function has_required_contract() {
			return Boolean(
				window.jQuery && window.wp && 'function' === typeof window.wp.template
				&& transport.url && transport.action && transport.nonce && 'timeline' === transport.source
				&& review_transport.url && review_transport.action && review_transport.nonce && 'timeline' === review_transport.source
				&& 0 < Number( review_transport.schema_version )
				&& apply_transport.url && apply_transport.action && apply_transport.nonce && 'timeline' === apply_transport.source
				&& template_keys.every( function ( key ) {
					return 'string' === typeof templates[ key ] && /^[a-z0-9_-]+$/.test( templates[ key ] );
				} )
			);
		}

		/**
		 * Resolve one fixed template through the server allow list.
		 *
		 * @param {string} key Fixed semantic key.
		 * @return {Function|null} WordPress template renderer or null.
		 */
		function get_template( key ) {
			return -1 !== template_keys.indexOf( key ) && templates[ key ] ? window.wp.template( templates[ key ] ) : null;
		}

		/**
		 * Render one template without rewriting an unchanged host.
		 *
		 * @param {HTMLElement|null} host Target host.
		 * @param {string} key Template key.
		 * @param {Object} view_model Authorized presentation values.
		 * @return {boolean} True when markup changed.
		 */
		function render_template( host, key, view_model ) {
			var renderer = get_template( key );
			var markup;

			if ( ! host || ! renderer ) {
				return false;
			}
			markup = renderer( view_model || {} );
			if ( markup === host.innerHTML ) {
				return false;
			}
			host.innerHTML = markup;
			return true;
		}

		/**
		 * Clear a non-empty dedicated host.
		 *
		 * @param {HTMLElement|null} host Dedicated host.
		 * @return {boolean} True when content was removed.
		 */
		function clear_host( host ) {
			if ( ! host || ( ! host.childNodes.length && ! host.textContent ) ) {
				return false;
			}
			host.replaceChildren();
			return true;
		}

		/**
		 * Resolve dedicated resize hosts within an exact card.
		 *
		 * @param {HTMLElement|null} card Registered card.
		 * @return {Object} Root, visual, live-region, and review hosts.
		 */
		function get_hosts( card ) {
			var root = card && card.querySelector ? card.querySelector( '[data-wpbc-timeline-booking-resize-host]' ) : null;
			return {
				root: root,
				visual: root ? root.querySelector( '[data-wpbc-timeline-booking-resize-visual-host]' ) : null,
				live: root ? root.querySelector( '[data-wpbc-timeline-booking-resize-live-host]' ) : null,
				review: root ? root.querySelector( '[data-wpbc-timeline-booking-resize-review-host]' ) : null
			};
		}

		/**
		 * Remove proposal-only handle offsets from one canonical card.
		 *
		 * Handles are rendered inside the unchanged booking card. Dragging can
		 * temporarily project them to dashed boundaries, so every terminal path
		 * restores their canonical CSS positions before Review presentation.
		 *
		 * @param {HTMLElement|null} card Registered card.
		 * @return {void}
		 */
		function clear_handle_offsets( card ) {
			if ( ! card || ! card.style || 'function' !== typeof card.style.removeProperty ) {
				return;
			}
			card.style.removeProperty( '--wpbc-timeline-booking-resize-start-offset' );
			card.style.removeProperty( '--wpbc-timeline-booking-resize-end-offset' );
		}

		/**
		 * Reflect loading, ready, or denied presentation.
		 *
		 * An authorized resize handle owns the same visual boundary as Timeline's
		 * ordinary selection dot. Boundary-specific ready classes let CSS replace
		 * only that duplicate dot. When the booking remains eligible but one exact
		 * boundary is unavailable, a separate class converts that ordinary dot into
		 * a non-interactive unavailable marker instead of implying it can be moved.
		 *
		 * @param {HTMLElement|null} card Active card.
		 * @param {string} state Presentation state.
		 * @return {void}
		 */
		function set_presentation_state( card, state ) {
			var is_ready = 'ready' === state;
			var handles = is_ready && active_selection && active_selection.card === card
				? active_selection.handles
				: null;
			var start_is_eligible = Boolean( handles && handles.start && handles.start.eligible );
			var end_is_eligible = Boolean( handles && handles.end && handles.end.eligible );
			var start_is_unavailable = Boolean( is_ready && handles && handles.start && ! start_is_eligible );
			var end_is_unavailable = Boolean( is_ready && handles && handles.end && ! end_is_eligible );

			if ( card && card.classList ) {
				card.classList.toggle( 'is-booking-resize-loading', 'loading' === state );
				card.classList.toggle( 'is-booking-resize-ready', is_ready );
				card.classList.toggle( 'is-booking-resize-start-ready', start_is_eligible );
				card.classList.toggle( 'is-booking-resize-end-ready', end_is_eligible );
				card.classList.toggle( 'is-booking-resize-start-unavailable', start_is_unavailable );
				card.classList.toggle( 'is-booking-resize-end-unavailable', end_is_unavailable );
			}
			mount.classList.toggle( 'is-booking-resize-denied', 'denied' === state );
		}

		/**
		 * Announce one state through the domain live-region template.
		 *
		 * @param {HTMLElement|null} card Active card.
		 * @param {string} message Localized message.
		 * @return {void}
		 */
		function announce( card, message ) {
			var host = get_hosts( card ).live;
			if ( message ) {
				render_template( host, 'live_region', { message: String( message ) } );
			} else {
				clear_host( host );
			}
		}

		/**
		 * Show one standard global administration notice for an actionable result.
		 *
		 * Loading and successful non-mutating checks remain card-local. This callback
		 * is reserved for an explicit denial or failure so pointer movement and
		 * Timeline scrolling can never produce repeated global messages.
		 *
		 * @param {string} message      Plain-text authorized message.
		 * @param {string} message_type Standard administration notice type.
		 * @param {number} delay        Visible duration in milliseconds.
		 * @return {void}
		 */
		function show_admin_notice( message, message_type, delay ) {
			if ( message && callbacks && 'function' === typeof callbacks.show_admin_message ) {
				callbacks.show_admin_message( String( message ), message_type, delay );
			}
		}

		/**
		 * Resolve an authorized eligibility reason into translated user guidance.
		 *
		 * @param {Object|null} dto     Raw authorized resize-context DTO.
		 * @param {Object|null} context Validated immutable resize context.
		 * @param {Object|null} handles Projected handle presentation.
		 * @return {string} Translated warning text, or an empty string when fully ready.
		 */
		function get_eligibility_warning( dto, context, handles ) {
			var denial_reasons = i18n.denial_reasons && 'object' === typeof i18n.denial_reasons ? i18n.denial_reasons : {};
			var reason = '';
			var boundaries = dto && dto.boundaries ? dto.boundaries : {};

			if ( ! handles ) {
				reason = dto && dto.fallback ? String( dto.fallback.reason || '' ) : '';
				return denial_reasons[ reason ] || i18n.denied || '';
			}
			if ( context && ! context.boundaries.start && boundaries.start ) {
				reason = String( boundaries.start.fallback_reason || '' );
			}
			if ( ! reason && context && ! context.boundaries.end && boundaries.end ) {
				reason = String( boundaries.end.fallback_reason || '' );
			}

			return reason ? ( denial_reasons[ reason ] || i18n.partially_ready || '' ) : '';
		}

		/**
		 * Read a safe endpoint error message with a translated fallback.
		 *
		 * @param {Object} failed_request Failed jQuery request.
		 * @param {string} fallback       Translated fallback message.
		 * @return {string} Plain-text error message.
		 */
		function get_request_error_message( failed_request, fallback ) {
			var error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;

			return error_data && 'string' === typeof error_data.message && error_data.message
				? error_data.message
				: String( fallback || '' );
		}

		/**
		 * Remove only the ghosts created for the active affected occurrences.
		 *
		 * @return {void}
		 */
		function clear_ghosts() {
			active_ghost_records.forEach( function ( record ) {
				if ( record.ghost_host && record.ghost_host.parentNode ) {
					record.ghost_host.parentNode.removeChild( record.ghost_host );
				}
				record.ghost_host = null;
				record.ghost = null;
				record.ghost_interval_index = -1;
				record.ghost_geometry_key = '';
				if ( record.card && record.card.classList ) {
					record.card.classList.toggle( 'is-booking-resizing', false );
					record.card.classList.toggle( 'is-booking-resize-dragging', false );
				}
			} );
			active_ghost_records = [];
		}

		/**
		 * Toggle active-drag chrome suppression on affected occurrence cards.
		 *
		 * Live pointer movement suppresses inactive chrome while retaining one small
		 * active boundary dot and a scoped horizontal-resize cursor. Canonical Review
		 * owns attention immediately after release.
		 *
		 * @param {boolean} is_dragging Whether pointer movement is active.
		 * @return {void}
		 */
		function set_dragging_presentation( is_dragging ) {
			var active_handle = pointer_gesture && pointer_gesture.handle ? pointer_gesture.handle : null;

			active_ghost_records.forEach( function ( record ) {
				if ( record.card && record.card.classList ) {
					record.card.classList.toggle( 'is-booking-resize-dragging', is_dragging );
				}
			} );
			if ( active_selection && active_selection.card && active_selection.card.classList ) {
				active_selection.card.classList.toggle( 'is-booking-resize-dragging', is_dragging );
			}
			if ( active_handle && active_handle.classList ) {
				active_handle.classList.toggle( 'is-booking-resize-active-boundary', is_dragging );
			}
			if ( mount && mount.classList ) {
				mount.classList.toggle( 'is-booking-resize-pointer-active', is_dragging );
			}
		}

		/**
		 * Clear resize presentation from one card only.
		 *
		 * @param {HTMLElement|null} card Previously active card.
		 * @return {void}
		 */
		function clear_card( card ) {
			var hosts = get_hosts( card );
			set_presentation_state( card, '' );
			clear_handle_offsets( card );
			if ( card && card.classList ) {
				card.classList.toggle( 'is-booking-resizing', false );
				card.classList.toggle( 'is-booking-resize-dragging', false );
			}
			clear_host( hosts.visual );
			clear_host( hosts.live );
			if ( hosts.review && hosts.review.parentNode ) {
				hosts.review.parentNode.removeChild( hosts.review );
			}
		}

		/**
		 * Determine whether a string is an exact offset-bearing instant.
		 *
		 * @param {string} instant Candidate instant.
		 * @return {boolean} True for a parseable exact instant.
		 */
		function is_exact_instant( instant ) {
			return 'string' === typeof instant
				&& /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test( instant )
				&& ! Number.isNaN( Date.parse( instant ) );
		}

		/**
		 * Normalize one explicitly registered segment.
		 *
		 * @param {HTMLElement} card Rendered card.
		 * @param {Object} segment Authorized compact segment DTO.
		 * @return {Object|null} Bounded record or null.
		 */
		function normalize_segment( card, segment ) {
			var booking_id = Math.max( 0, Math.round( Number( segment && segment.booking_id ) || 0 ) );
			var segment_id = String( segment && segment.segment_id || '' );
			var visible_start = String( segment && segment.visible_start || '' );
			var visible_end = String( segment && segment.visible_end || '' );

			if ( ! card || ! booking_id || ! segment_id || ! is_exact_instant( visible_start ) || ! is_exact_instant( visible_end ) ) {
				return null;
			}
			return {
				card: card,
				booking_id: booking_id,
				segment_id: segment_id,
				visible_start: visible_start,
				visible_end: visible_end,
				visible_start_epoch: Date.parse( visible_start ),
				visible_end_epoch: Date.parse( visible_end ),
				show_start: ! Boolean( segment.is_clipped_start ),
				show_end: ! Boolean( segment.is_clipped_end ),
				key: [ booking_id, segment_id, visible_start, visible_end ].join( '|' ),
				ghost_host: null,
				ghost: null,
				ghost_interval_index: -1,
				ghost_geometry_key: ''
			};
		}

		/**
		 * Normalize and freeze one exact interval.
		 *
		 * @param {Object} interval Server interval DTO.
		 * @return {Object|null} Immutable interval or null.
		 */
		function normalize_interval( interval ) {
			var start = interval ? String( interval.start || '' ) : '';
			var end = interval ? String( interval.end || '' ) : '';
			if ( ! is_exact_instant( start ) || ! is_exact_instant( end ) || Date.parse( end ) <= Date.parse( start ) ) {
				return null;
			}
			return Object.freeze( { start: start, end: end, start_epoch: Date.parse( start ), end_epoch: Date.parse( end ) } );
		}

		/**
		 * Validate and freeze the authoritative resize context.
		 *
		 * @param {Object} response AJAX response.
		 * @return {Object|null} Immutable context or null when fail-closed.
		 */
		function normalize_context( response ) {
			var dto = response && response.success && response.data ? response.data.resize_context : null;
			var boundaries = dto && dto.boundaries ? dto.boundaries : {};
			var immutable_interval;
			var affected_intervals;
			var anchor_interval_index = -1;
			var shape;

			if ( ! active_selection || ! dto || ! dto.eligible || Number( dto.schema_version ) !== Number( configuration.schema_version ) || Number( dto.booking_id ) !== active_selection.booking_id || ! Number( dto.target_resource_id ) || 'resize' !== dto.interaction_source || ! String( dto.source_context_token || '' ) ) {
				return null;
			}
			shape = String( dto.saved_shape || '' );
			immutable_interval = normalize_interval( dto.immutable_interval );
			affected_intervals = Array.isArray( dto.affected_intervals ) ? dto.affected_intervals.map( normalize_interval ).filter( Boolean ) : [];
			if ( -1 === supported_shapes.indexOf( shape ) || ! immutable_interval || ! affected_intervals.length || affected_intervals.length !== Number( dto.affected_interval_count ) ) {
				return null;
			}
			affected_intervals.some( function ( interval, index ) {
				if ( interval.start_epoch === immutable_interval.start_epoch && interval.end_epoch === immutable_interval.end_epoch ) {
					anchor_interval_index = index;
					return true;
				}
				return false;
			} );
			if ( -1 === anchor_interval_index ) {
				return null;
			}
			return Object.freeze( {
				booking_id: active_selection.booking_id,
				target_resource_id: Math.round( Number( dto.target_resource_id ) ),
				saved_shape: shape,
				resize_scope: String( dto.resize_scope || '' ),
				source_context_token: String( dto.source_context_token ),
				proposal_revision_seed: Math.max( 1, Math.round( Number( dto.proposal_revision ) || 1 ) ),
				anchor_interval_index: anchor_interval_index,
				immutable_interval: immutable_interval,
				affected_intervals: Object.freeze( affected_intervals.slice() ),
				boundaries: Object.freeze( {
					start: Boolean( active_selection.show_start && boundaries.start && boundaries.start.eligible && 'resize_start' === boundaries.start.operation ),
					end: Boolean( active_selection.show_end && boundaries.end && boundaries.end.eligible && 'resize_end' === boundaries.end.operation )
				} )
			} );
		}

		/**
		 * Build the safe handle view model.
		 *
		 * @param {Object} context Immutable resize context.
		 * @return {Object|null} Handle view model or null.
		 */
		function project_handles( context ) {
			if ( ! context || ( ! context.boundaries.start && ! context.boundaries.end ) ) {
				return null;
			}
			return {
				group_label: i18n.group_label || '',
				start: { eligible: context.boundaries.start, operation: 'resize_start', label: i18n.resize_start || '' },
				end: { eligible: context.boundaries.end, operation: 'resize_end', label: i18n.resize_end || '' }
			};
		}

		/**
		 * Determine whether a ready native presentation owns both boundary records.
		 *
		 * Time Rows forwards a signed proposal into this controller without creating
		 * native horizontal handles. A Timeline replacement can reattach that booking
		 * card after the external Review has been cancelled, so `state: ready` alone is
		 * not sufficient proof that native handle presentation can be rendered.
		 *
		 * @param {Object|null} handles Candidate handle view model.
		 * @return {boolean} True when both native boundary records are present.
		 */
		function has_complete_handle_view_model( handles ) {
			return Boolean( handles && handles.start && handles.end );
		}

		/**
		 * Reset selection-owned eligibility after its authoritative context is stale.
		 *
		 * The canonical booking identity and replacement card remain selected. A fresh
		 * eligibility read must rebuild authority and native handle presentation.
		 *
		 * @return {void}
		 */
		function reset_active_selection_eligibility() {
			if ( ! active_selection ) {
				return;
			}
			active_selection.context = null;
			active_selection.handles = null;
			active_selection.state = 'idle';
			active_selection.request_state = 'idle';
			active_selection.proposal = null;
			active_selection.message = '';
			active_selection.is_external = false;
		}

		/**
		 * Render the active loading, ready, denied, or error state.
		 *
		 * @return {void}
		 */
		function render_active_state() {
			var hosts;
			if ( ! active_selection || ! active_selection.card || ! active_selection.card.isConnected ) {
				return;
			}
			if ( 'ready' === active_selection.state && ! has_complete_handle_view_model( active_selection.handles ) ) {
				set_presentation_state( active_selection.card, 'idle' );
				hosts = get_hosts( active_selection.card );
				clear_host( hosts.visual );
				return;
			}
			set_presentation_state( active_selection.card, active_selection.state );
			hosts = get_hosts( active_selection.card );
			if ( 'loading' === active_selection.state ) {
				render_template( hosts.visual, 'loading', { show_start: active_selection.show_start, show_end: active_selection.show_end } );
				announce( active_selection.card, i18n.checking || '' );
				return;
			}
			if ( 'ready' === active_selection.state ) {
				render_template( hosts.visual, 'handles', active_selection.handles );
				announce(
					active_selection.card,
					( ! active_selection.handles.start.eligible || ! active_selection.handles.end.eligible )
						? ( i18n.partially_ready || i18n.ready || '' )
						: ( i18n.ready || '' )
				);
				restore_apply_handle_focus();
				return;
			}
			clear_host( hosts.visual );
			announce( active_selection.card, active_selection.message || '' );
		}

		/**
		 * Restore logical focus to the applied boundary after canonical refresh.
		 *
		 * Focus waits for the fresh eligibility response so it can target a newly
		 * authorized handle rather than stale pre-save markup.
		 *
		 * @return {void}
		 */
		function restore_apply_handle_focus() {
			var focus_target;

			if ( ! apply_focus_operation || ! active_selection || ! active_selection.card ) {
				return;
			}
			if (
				'function' === typeof active_selection.restore_focus
				&& true === active_selection.restore_focus( active_selection.booking_id, apply_focus_operation )
			) {
				apply_focus_operation = '';
				return;
			}
			focus_target = active_selection.card.querySelector( '[data-wpbc-timeline-booking-resize-operation="' + apply_focus_operation + '"]' );
			if ( ! focus_target || focus_target.disabled || 'function' !== typeof focus_target.focus ) {
				return;
			}
			apply_focus_operation = '';
			focus_target.focus();
		}

		/**
		 * Abort the eligibility request and invalidate its callbacks.
		 *
		 * @return {void}
		 */
		function abort_request() {
			request_generation += 1;
			if ( eligibility_request && 'function' === typeof eligibility_request.abort ) {
				eligibility_request.abort();
			}
			eligibility_request = null;
		}

		/**
		 * Send exactly one eligibility request for this selection generation.
		 *
		 * @return {void}
		 */
		function load_eligibility() {
			var generation;
			if ( ! active_selection || eligibility_request || 'loading' === active_selection.request_state ) {
				return;
			}
			interaction_state = 'eligibility_loading';
			active_selection.state = 'loading';
			active_selection.request_state = 'loading';
			render_active_state();
			generation = request_generation;
			eligibility_request = window.jQuery.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.action,
					nonce: transport.nonce,
					booking_id: active_selection.booking_id,
					source: 'timeline',
					visible_start_at: active_selection.visible_start,
					visible_end_at: active_selection.visible_end
				}
			} ).done( function ( response ) {
				var dto = response && response.success && response.data ? response.data.resize_context : null;
				var context;
				var handles;
				var warning_message;
				var is_explicit_denial;
				if ( is_destroyed || generation !== request_generation || ! active_selection ) {
					return;
				}
				context = normalize_context( response );
				handles = project_handles( context );
				is_explicit_denial = Boolean( dto && false === dto.eligible );
				warning_message = is_explicit_denial || handles ? get_eligibility_warning( dto, context, handles ) : '';
				active_selection.request_state = 'complete';
				active_selection.state = handles ? 'ready' : ( is_explicit_denial ? 'denied' : 'error' );
				active_selection.handles = handles;
				active_selection.context = handles ? context : null;
				active_selection.next_proposal_revision = context ? context.proposal_revision_seed : 1;
				active_selection.message = handles ? '' : ( is_explicit_denial ? warning_message : ( i18n.error || '' ) );
				interaction_state = handles ? 'ready' : 'idle';
				render_active_state();
				if ( warning_message ) {
					show_admin_notice( warning_message, 'warning', 3000 );
				} else if ( ! handles ) {
					show_admin_notice( active_selection.message, 'error', 10000 );
				}
			} ).fail( function ( failed_request, request_status ) {
				if ( is_destroyed || generation !== request_generation || 'abort' === request_status || ! active_selection ) {
					return;
				}
				active_selection.request_state = 'complete';
				active_selection.state = 'error';
				active_selection.context = null;
				active_selection.message = get_request_error_message( failed_request, i18n.error || '' );
				interaction_state = 'idle';
				render_active_state();
				show_admin_notice( active_selection.message, 'error', 10000 );
			} ).always( function () {
				if ( generation === request_generation ) {
					eligibility_request = null;
				}
			} );
		}

		/**
		 * Register one freshly rendered segment through the explicit lifecycle.
		 *
		 * @param {HTMLElement} card Rendered canonical card.
		 * @param {Object} segment Authorized compact segment DTO.
		 * @return {void}
		 */
		function register_segment( card, segment ) {
			var record = normalize_segment( card, segment );
			if ( ! record ) {
				return;
			}
			segment_records.set( card, record );
			visible_segments.push( record );
			if (
				active_selection
				&& (
					record.key === active_selection.key
					|| ( ! active_selection.card && record.booking_id === active_selection.booking_id && record.segment_id === active_selection.segment_id )
				)
			) {
				active_selection.card = card;
				active_selection.key = record.key;
				active_selection.visible_start = record.visible_start;
				active_selection.visible_end = record.visible_end;
				active_selection.show_start = record.show_start;
				active_selection.show_end = record.show_end;
			}
		}

		/**
		 * Activate the exact segment selected through delegated input.
		 *
		 * @param {HTMLElement} selection_source Card or selection control.
		 * @return {boolean} True when a registered segment was accepted.
		 */
		function select( selection_source ) {
			var card = selection_source && selection_source.closest ? selection_source.closest( '[data-wpbc-timeline-segment-id]' ) : null;
			var record = card ? segment_records.get( card ) : null;
			if ( ! record ) {
				return false;
			}
			if ( -1 !== [ 'apply_pending', 'refresh_pending' ].indexOf( interaction_state ) ) {
				return false;
			}
			if ( active_selection && active_selection.key === record.key ) {
				active_selection.card = card;
				render_active_state();
				return true;
			}
			cancel_interaction( false, 'selection_replaced' );
			if ( active_selection ) {
				clear_card( active_selection.card );
			}
			abort_request();
			presentation_generation += 1;
			active_selection = {
				card: card,
				booking_id: record.booking_id,
				segment_id: record.segment_id,
				visible_start: record.visible_start,
				visible_end: record.visible_end,
				show_start: record.show_start,
				show_end: record.show_end,
				key: record.key,
				state: 'idle',
				request_state: 'idle',
				handles: null,
				context: null,
				proposal: null,
				next_proposal_revision: 1,
				message: ''
			};
			load_eligibility();
			return true;
		}

		/**
		 * Build an immutable physical axis snapshot from the active row only.
		 *
		 * @param {HTMLElement} card Active card.
		 * @return {Object|null} Loaded-axis snapshot or null.
		 */
		function create_axis_snapshot( card ) {
			var row = card ? card.closest( '.wpbc_timeline__canvas_row' ) : null;
			var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );
			var elements = row ? row.querySelectorAll( '.wpbc_timeline__canvas_cell' ) : [];
			var cells = [];
			var axis = callbacks && 'function' === typeof callbacks.get_axis ? callbacks.get_axis() : {};

			Array.prototype.forEach.call( elements, function ( element ) {
				var start = String( element.getAttribute( 'data-wpbc-timeline-cell-start' ) || '' );
				var end = String( element.getAttribute( 'data-wpbc-timeline-cell-end' ) || '' );
				if ( is_exact_instant( start ) && is_exact_instant( end ) && Date.parse( end ) > Date.parse( start ) ) {
					cells.push( {
						element: element,
						start: start,
						end: end,
						start_epoch: Date.parse( start ),
						end_epoch: Date.parse( end ),
						rectangle: element.getBoundingClientRect()
					} );
				}
			} );
			if ( ! canvas || ! cells.length ) {
				return null;
			}
			return Object.freeze( {
				canvas: canvas,
				cells: cells,
				is_rtl: 1 < cells.length ? cells[0].rectangle.left > cells[cells.length - 1].rectangle.left : Boolean( axis.is_rtl ),
				cell_minutes: Math.max( 1, Math.round( Number( axis.cell_minutes ) || 1 ) ),
				timezone: String( axis.timezone || '' ),
				generation: presentation_generation,
				min_epoch: cells[0].start_epoch,
				max_epoch: cells[cells.length - 1].end_epoch
			} );
		}

		/**
		 * Refresh cached cell rectangles after horizontal scrolling.
		 *
		 * @param {Object} snapshot Axis snapshot.
		 * @return {void}
		 */
		function refresh_axis_rectangles( snapshot ) {
			snapshot.cells.forEach( function ( cell ) {
				cell.rectangle = cell.element.getBoundingClientRect();
			} );
		}

		/**
		 * Resolve a physical pointer coordinate on the chronological axis.
		 *
		 * @param {Object} snapshot Axis snapshot.
		 * @param {number} client_x Physical viewport coordinate.
		 * @return {Object} Cell, chronological index, ratio, units, and instant.
		 */
		function pointer_to_axis_position( snapshot, client_x ) {
			var cell = snapshot.cells[0];
			var cell_index = 0;
			var closest_distance = Number.POSITIVE_INFINITY;
			var ratio;

			snapshot.cells.some( function ( candidate, candidate_index ) {
				var distance;
				if ( client_x >= candidate.rectangle.left && client_x <= candidate.rectangle.right ) {
					cell = candidate;
					cell_index = candidate_index;
					return true;
				}
				distance = Math.min( Math.abs( client_x - candidate.rectangle.left ), Math.abs( client_x - candidate.rectangle.right ) );
				if ( distance < closest_distance ) {
					closest_distance = distance;
					cell = candidate;
					cell_index = candidate_index;
				}
				return false;
			} );
			ratio = ( client_x - cell.rectangle.left ) / Math.max( 1, cell.rectangle.width );
			ratio = Math.max( 0, Math.min( 1, snapshot.is_rtl ? 1 - ratio : ratio ) );

			return {
				cell: cell,
				cell_index: cell_index,
				ratio: ratio,
				units: cell_index + ratio,
				epoch: Math.round( ( cell.start_epoch + ( cell.end_epoch - cell.start_epoch ) * ratio ) / 60000 ) * 60000
			};
		}

		/**
		 * Project a physical pointer coordinate into a loaded-axis instant.
		 *
		 * @param {Object} snapshot Axis snapshot.
		 * @param {number} client_x Physical viewport coordinate.
		 * @param {string} operation Resize operation.
		 * @param {boolean} is_full_day Whether whole-day snapping is required.
		 * @return {number} Bounded epoch milliseconds.
		 */
		function pointer_to_epoch( snapshot, client_x, operation, is_full_day ) {
			var position = pointer_to_axis_position( snapshot, client_x );
			if ( is_full_day ) {
				return 'resize_start' === operation ? position.cell.start_epoch : position.cell.end_epoch;
			}
			return position.epoch;
		}

		/**
		 * Convert a fractional chronological axis position into an exact instant.
		 *
		 * @param {Object} snapshot Loaded-axis geometry snapshot.
		 * @param {number} units Fractional cell position from the chronological start.
		 * @return {number} Minute-rounded, loaded-axis-bounded epoch milliseconds.
		 */
		function axis_units_to_epoch( snapshot, units ) {
			var bounded_units = Math.max( 0, Math.min( snapshot.cells.length, units ) );
			var cell_index;
			var cell;
			var ratio;

			if ( bounded_units >= snapshot.cells.length ) {
				return snapshot.cells[snapshot.cells.length - 1].end_epoch;
			}
			cell_index = Math.min( snapshot.cells.length - 1, Math.floor( bounded_units ) );
			cell = snapshot.cells[cell_index];
			ratio = bounded_units - cell_index;

			return Math.round( ( cell.start_epoch + ( cell.end_epoch - cell.start_epoch ) * ratio ) / 60000 ) * 60000;
		}

		/**
		 * Move an exact boundary by the pointer delta from a visual card-edge handle.
		 *
		 * A semantic day card is wider than its canonical time slot. Its handle is
		 * intentionally rendered on the visible card edge, so absolute pointer-to-time
		 * projection would jump to midnight as soon as dragging starts. Relative axis
		 * movement keeps the immutable saved wall time as the drag origin. Release keeps
		 * this minute projection for semantic day cards, while canonical Review remains
		 * authoritative.
		 *
		 * @param {Object} snapshot Loaded-axis geometry snapshot.
		 * @param {number} client_x Current physical pointer coordinate.
		 * @param {Object} gesture Active pointer gesture.
		 * @return {number} Exact presentation boundary after applying pointer movement.
		 */
		function pointer_delta_to_epoch( snapshot, client_x, gesture ) {
			var current_position = pointer_to_axis_position( snapshot, client_x );
			var anchor_interval = get_gesture_anchor_interval();
			var boundary_epoch = 'resize_start' === gesture.operation ? anchor_interval.start_epoch : anchor_interval.end_epoch;
			var boundary_cell_index = find_axis_cell_index( snapshot, boundary_epoch );
			var boundary_cell;
			var boundary_ratio;
			var boundary_units;

			if ( -1 === boundary_cell_index ) {
				return boundary_epoch;
			}
			boundary_cell = snapshot.cells[boundary_cell_index];
			boundary_ratio = ( boundary_epoch - boundary_cell.start_epoch ) / Math.max( 1, boundary_cell.end_epoch - boundary_cell.start_epoch );
			boundary_units = boundary_cell_index + Math.max( 0, Math.min( 1, boundary_ratio ) );

			return axis_units_to_epoch( snapshot, boundary_units + current_position.units - gesture.start_axis_units );
		}

		/**
		 * Round an axis-unit delta symmetrically at half a cell.
		 *
		 * Native Math.round() maps -0.5 to negative zero, which would make the
		 * same physical threshold behave differently for start and end contraction.
		 *
		 * @param {number} delta Fractional Timeline-cell delta.
		 * @return {number} Signed whole-cell delta.
		 */
		function round_axis_steps( delta ) {
			return 0 > delta ? -Math.round( Math.abs( delta ) ) : Math.round( delta );
		}

		/**
		 * Find the loaded cell containing one exact boundary.
		 *
		 * @param {Object} snapshot Axis snapshot.
		 * @param {number} epoch Exact boundary epoch.
		 * @return {number} Chronological cell index, or -1 outside the loaded axis.
		 */
		function find_axis_cell_index( snapshot, epoch ) {
			var match = -1;
			snapshot.cells.some( function ( cell, index ) {
				if ( epoch >= cell.start_epoch && ( epoch < cell.end_epoch || ( index === snapshot.cells.length - 1 && epoch <= cell.end_epoch ) ) ) {
					match = index;
					return true;
				}
				return false;
			} );

			return match;
		}

		/**
		 * Format one epoch as local numeric parts in the site timezone.
		 *
		 * @param {number} epoch Exact epoch milliseconds.
		 * @param {string} timezone IANA site timezone.
		 * @return {Object|null} Numeric local parts, or null without Intl support.
		 */
		function get_zoned_parts( epoch, timezone ) {
			var intl_api = window.Intl || ( 'undefined' !== typeof Intl ? Intl : null );
			var formatter;
			var values = {};

			if ( ! intl_api || ! timezone || ! intl_api.DateTimeFormat.prototype.formatToParts ) {
				return null;
			}
			try {
				formatter = new intl_api.DateTimeFormat( 'en-US', {
					timeZone: timezone,
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					hourCycle: 'h23',
					minute: '2-digit',
					second: '2-digit'
				} );
				formatter.formatToParts( new Date( epoch ) ).forEach( function ( part ) {
					if ( 'literal' !== part.type ) {
						values[ part.type ] = Number( part.value );
					}
				} );
			} catch ( error ) {
				return null;
			}

			return values.year && values.month && values.day ? values : null;
		}

		/**
		 * Pad one non-negative integer for an exact instant.
		 *
		 * @param {number} value Numeric date or offset part.
		 * @param {number} length Required output length.
		 * @return {string} Zero-padded integer.
		 */
		function pad_instant_part( value, length ) {
			return String( Math.abs( Math.round( value ) ) ).padStart( length, '0' );
		}

		/**
		 * Format one epoch as an exact minute in the authoritative site timezone.
		 *
		 * The canonical server repeats timezone, offset, ambiguity, nonexistent-time,
		 * and overnight validation. This browser formatter only preserves the exact
		 * bounded instant selected on the Timeline axis.
		 *
		 * @param {number} epoch Exact boundary epoch in milliseconds.
		 * @param {string} timezone IANA site timezone.
		 * @return {string} RFC3339 minute instant, or an empty string on failure.
		 */
		function format_review_instant( epoch, timezone ) {
			var parts = get_zoned_parts( epoch, timezone );
			var represented_epoch;
			var offset_minutes;
			var offset_sign;

			if ( ! parts ) {
				return '';
			}
			represented_epoch = Date.UTC( parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second );
			offset_minutes = Math.round( ( represented_epoch - epoch ) / 60000 );
			offset_sign = 0 <= offset_minutes ? '+' : '-';

			return [
				pad_instant_part( parts.year, 4 ), '-', pad_instant_part( parts.month, 2 ), '-', pad_instant_part( parts.day, 2 ),
				'T', pad_instant_part( parts.hour, 2 ), ':', pad_instant_part( parts.minute, 2 ), ':00',
				offset_sign, pad_instant_part( Math.floor( Math.abs( offset_minutes ) / 60 ), 2 ), ':', pad_instant_part( Math.abs( offset_minutes ) % 60, 2 )
			].join( '' );
		}

		/**
		 * Resolve local wall-clock parts to an exact instant in the site timezone.
		 *
		 * The canonical Review service still rejects ambiguous or nonexistent DST
		 * results. This bounded projection exists only to preserve the saved clock
		 * time while presenting whole-day pointer steps.
		 *
		 * @param {Object} local_parts Complete local date and time parts.
		 * @param {string} timezone IANA site timezone.
		 * @return {number|null} Exact epoch milliseconds, or null without support.
		 */
		function zoned_parts_to_epoch( local_parts, timezone ) {
			var utc_guess = Date.UTC( local_parts.year, local_parts.month - 1, local_parts.day, local_parts.hour, local_parts.minute, local_parts.second, local_parts.millisecond );
			var candidate = utc_guess;
			var iteration;
			var candidate_parts;
			var represented_epoch;

			for ( iteration = 0; iteration < 2; iteration += 1 ) {
				candidate_parts = get_zoned_parts( candidate, timezone );
				if ( ! candidate_parts ) {
					return null;
				}
				represented_epoch = Date.UTC( candidate_parts.year, candidate_parts.month - 1, candidate_parts.day, candidate_parts.hour, candidate_parts.minute, candidate_parts.second, local_parts.millisecond );
				candidate += utc_guess - represented_epoch;
			}

			return candidate;
		}

		/**
		 * Move an immutable boundary by whole Timeline cells.
		 *
		 * Sub-day scales retain the exact offset inside their fixed-size cell. The
		 * one-day scale reconstructs the same site-local wall clock on the target
		 * date so a 14:00 boundary remains 14:00 across ordinary and DST dates.
		 *
		 * @param {Object} snapshot Axis snapshot.
		 * @param {number} boundary_epoch Immutable boundary epoch.
		 * @param {number} step_delta Signed whole-cell delta.
		 * @return {number} Exact target boundary within the loaded axis.
		 */
		function shift_boundary_by_axis_steps( snapshot, boundary_epoch, step_delta ) {
			var source_index = find_axis_cell_index( snapshot, boundary_epoch );
			var target_index;
			var source_cell;
			var target_cell;
			var boundary_parts;
			var target_parts;
			var target_epoch;

			if ( -1 === source_index ) {
				return boundary_epoch;
			}
			target_index = Math.max( 0, Math.min( snapshot.cells.length - 1, source_index + step_delta ) );
			source_cell = snapshot.cells[source_index];
			target_cell = snapshot.cells[target_index];

			if ( 1440 === snapshot.cell_minutes && snapshot.timezone ) {
				boundary_parts = get_zoned_parts( boundary_epoch, snapshot.timezone );
				target_parts = get_zoned_parts( target_cell.start_epoch, snapshot.timezone );
				if ( boundary_parts && target_parts ) {
					target_epoch = zoned_parts_to_epoch( {
						year: target_parts.year,
						month: target_parts.month,
						day: target_parts.day,
						hour: boundary_parts.hour,
						minute: boundary_parts.minute,
						second: boundary_parts.second,
						millisecond: new Date( boundary_epoch ).getUTCMilliseconds()
					}, snapshot.timezone );
					if ( null !== target_epoch ) {
						return target_epoch;
					}
				}
			}

			return target_cell.start_epoch + ( boundary_epoch - source_cell.start_epoch );
		}

		/**
		 * Project the pointer as a relative whole-cell movement.
		 *
		 * @param {Object} snapshot Axis snapshot.
		 * @param {number} client_x Physical viewport coordinate.
		 * @param {Object} gesture Active pointer gesture.
		 * @return {number} Exact immutable-boundary projection.
		 */
		function pointer_to_step_epoch( snapshot, client_x, gesture ) {
			var current_position = pointer_to_axis_position( snapshot, client_x );
			var step_delta = round_axis_steps( current_position.units - gesture.start_axis_units );
			var anchor_interval = get_gesture_anchor_interval();
			var boundary_epoch = 'resize_start' === gesture.operation ? anchor_interval.start_epoch : anchor_interval.end_epoch;

			return shift_boundary_by_axis_steps( snapshot, boundary_epoch, step_delta );
		}

		/**
		 * Determine whether release should replace the live proposal with cell snapping.
		 *
		 * A same-day timed booking uses the complete day cell as a readable visual card,
		 * so its border is not the saved time boundary. Its relative minute projection
		 * must therefore survive release; snapping that visual border by whole day cells
		 * can collapse a real drag back to the unchanged saved time and skip Review.
		 * Ordinary timed and full-day cards retain the configured Timeline-step policy.
		 *
		 * @param {Object} gesture Active pointer gesture.
		 * @return {boolean} True when final release uses Timeline-cell snapping.
		 */
		function should_snap_release_to_timeline_step( gesture ) {
			return snap_to_timeline_step && ! gesture.uses_visual_boundary_handle;
		}

		/**
		 * Return the anchor interval at the start of one pointer gesture.
		 *
		 * The first gesture starts from the immutable server context. A deliberate
		 * continuation from either reviewed boundary starts from the frozen local
		 * proposal, while canonical Review still derives grouped effects from the
		 * verified signed base instead of trusting browser-selected group members.
		 *
		 * @return {Object} Exact presentation interval for the gesture anchor.
		 */
		function get_gesture_anchor_interval() {
			var context = active_selection.context;
			var base_intervals = pointer_gesture && pointer_gesture.base_intervals
				? pointer_gesture.base_intervals
				: context.affected_intervals;

			return base_intervals[ context.anchor_interval_index ];
		}

		/**
		 * Convert one loaded-axis instant to a physical viewport coordinate.
		 *
		 * @param {Object} snapshot Axis snapshot.
		 * @param {number} epoch Exact epoch milliseconds.
		 * @return {number} Physical viewport coordinate.
		 */
		function epoch_to_x( snapshot, epoch ) {
			var cell = snapshot.cells[0];
			var ratio;
			if ( epoch <= snapshot.min_epoch ) {
				return snapshot.is_rtl ? snapshot.cells[0].rectangle.right : snapshot.cells[0].rectangle.left;
			}
			if ( epoch >= snapshot.max_epoch ) {
				return snapshot.is_rtl
					? snapshot.cells[snapshot.cells.length - 1].rectangle.left
					: snapshot.cells[snapshot.cells.length - 1].rectangle.right;
			}
			snapshot.cells.some( function ( candidate, index ) {
				cell = candidate;
				return epoch >= candidate.start_epoch && ( epoch < candidate.end_epoch || ( index === snapshot.cells.length - 1 && epoch <= candidate.end_epoch ) );
			} );
			ratio = Math.max( 0, Math.min( 1, ( epoch - cell.start_epoch ) / Math.max( 1, cell.end_epoch - cell.start_epoch ) ) );
			return snapshot.is_rtl ? cell.rectangle.right - cell.rectangle.width * ratio : cell.rectangle.left + cell.rectangle.width * ratio;
		}

		/**
		 * Construct the mutable proposal from immutable server intervals.
		 *
		 * The same boundary delta is projected across every recurrent or
		 * discontinuous occurrence. Canonical Review will later derive and validate
		 * the corresponding wall-clock boundary independently for each occurrence.
		 *
		 * @param {Object} gesture Active gesture.
		 * @param {number} candidate_epoch Projected boundary.
		 * @return {Object} Mutable presentation proposal.
		 */
		function create_proposal( gesture, candidate_epoch ) {
			var context = active_selection.context;
			var base_intervals = gesture.base_intervals || context.affected_intervals;
			var anchor_interval = base_intervals[ context.anchor_interval_index ];
			// Drag-time full-day candidates may be presentation-only partial days;
			// release projects them back to exact calendar-cell boundaries. A positive
			// instant guard keeps the continuous preview from crossing without rejecting
			// valid 23-hour or 25-hour local days at a daylight-saving transition.
			var minimum_duration = -1 !== full_day_shapes.indexOf( context.saved_shape ) ? 1 : 60000;
			var changed_boundaries = {
				start: 'resize_start' === gesture.operation,
				end: 'resize_end' === gesture.operation
			};
			var bounded_epoch;
			var delta;
			var intervals;

			if ( 'resize_start' === gesture.operation ) {
				bounded_epoch = Math.max( gesture.axis.min_epoch, Math.min( candidate_epoch, anchor_interval.end_epoch - minimum_duration ) );
				delta = bounded_epoch - anchor_interval.start_epoch;
			} else {
				bounded_epoch = Math.min( gesture.axis.max_epoch, Math.max( candidate_epoch, anchor_interval.start_epoch + minimum_duration ) );
				delta = bounded_epoch - anchor_interval.end_epoch;
			}
			intervals = base_intervals.map( function ( interval ) {
				return {
					start_epoch: 'resize_start' === gesture.operation ? interval.start_epoch + delta : interval.start_epoch,
					end_epoch: 'resize_end' === gesture.operation ? interval.end_epoch + delta : interval.end_epoch
				};
			} );
			return {
				interaction_source: 'resize',
				operation: gesture.operation,
				source_context_token: context.source_context_token,
				proposal_revision: context.proposal_revision_seed,
				boundary_epoch: bounded_epoch,
				boundary_instant: new Date( bounded_epoch ).toISOString(),
				intervals: intervals,
				changed_boundaries: changed_boundaries,
				signature: [
					changed_boundaries.start ? 'start' : '',
					changed_boundaries.end ? 'end' : '',
					intervals.map( function ( interval ) {
						return interval.start_epoch + ':' + interval.end_epoch;
					} ).join( ',' )
				].join( '|' )
			};
		}

		/**
		 * Freeze the exact browser proposal accepted by canonical Review.
		 *
		 * Only the gesture-anchor interval is transmitted. The source-context token
		 * binds the server-derived resize scope and immutable anchor, while canonical
		 * Review reloads the booking and derives every affected grouped occurrence.
		 * This prevents the browser from choosing or omitting group members.
		 *
		 * @param {Object} local_proposal Presentation-only proposal.
		 * @param {string} timezone Authoritative Timeline axis timezone.
		 * @return {Object|null} Frozen canonical Review proposal or null.
		 */
		function freeze_review_proposal( local_proposal, timezone ) {
			var context = active_selection ? active_selection.context : null;
			var interval = context && local_proposal ? local_proposal.intervals[ context.anchor_interval_index ] : null;
			var start;
			var end;
			var revision;

			if ( ! context || ! interval || -1 === operations.indexOf( local_proposal.operation ) ) {
				return null;
			}
			start = format_review_instant( interval.start_epoch, timezone );
			end = format_review_instant( interval.end_epoch, timezone );
			if ( ! start || ! end || Date.parse( end ) <= Date.parse( start ) ) {
				return null;
			}
			revision = Math.max( context.proposal_revision_seed, active_selection.next_proposal_revision || context.proposal_revision_seed );
			active_selection.next_proposal_revision = revision + 1;

			return Object.freeze( {
				schema_version: Math.round( Number( review_transport.schema_version ) ),
				booking_id: context.booking_id,
				interaction_source: 'resize',
				operation: local_proposal.operation,
				target_resource_id: context.target_resource_id,
				selection_method: 'independent_full_days' === context.saved_shape ? 'individual' : 'policy',
				proposed_intervals: Object.freeze( [ Object.freeze( { start: start, end: end } ) ] ),
				proposal_revision: revision,
				source_context_token: context.source_context_token
			} );
		}

		/**
		 * Create the document-level host for the bounded Review panel.
		 *
		 * The Timeline canvas must retain horizontal scroll ownership and therefore
		 * clips block-axis overflow. Mounting Review in the document body keeps
		 * its actions reachable without weakening any Timeline clipping boundary.
		 *
		 * @return {HTMLElement|null} Dedicated host or null.
		 */
		function ensure_review_host() {
			if ( review_host && review_host.isConnected !== false ) {
				return review_host;
			}
			if ( ! active_selection || ! active_selection.card || ! document.body ) {
				return null;
			}
			review_host = document.createElement( 'div' );
			review_host.className = 'wpbc_timeline_booking_resize__review_host wpbc_timeline_booking_resize__review_portal';
			review_host.setAttribute( 'data-wpbc-timeline-booking-resize-review-host', '' );
			review_host.addEventListener( 'click', handle_click );
			document.body.appendChild( review_host );

			return review_host;
		}

		/**
		 * Size and reposition the existing Review surface without rebuilding it.
		 *
		 * @return {void}
		 */
		function position_review_popover() {
			var card_rectangle;
			var canvas_rectangle;
			var maximum_inline_size;
			var surface;
			var surface_rectangle;
			var surface_width;
			var surface_height;
			var viewport_width;
			var viewport_height;
			var desired_left;
			var desired_top;
			var minimum_left;
			var maximum_left;
			var minimum_top;
			var maximum_bottom;
			var below_top;
			var above_top;
			var placement = 'below';

			review_position_frame = 0;
			if ( ! review_host || ! active_selection || ! active_selection.card || ! review_scroll_canvas ) {
				return;
			}
			card_rectangle = active_selection.card.getBoundingClientRect();
			canvas_rectangle = review_scroll_canvas.getBoundingClientRect();
			surface = review_host.firstElementChild;
			if ( ! surface || ! surface.getBoundingClientRect ) {
				return;
			}
			viewport_width = Math.max( 0, Number( window.innerWidth ) || document.documentElement.clientWidth || 0 );
			viewport_height = Math.max( 0, Number( window.innerHeight ) || document.documentElement.clientHeight || 0 );
			minimum_left = Math.max( review_gap, canvas_rectangle.left + review_gap );
			maximum_inline_size = Math.max( 0, Math.min( viewport_width - review_gap, canvas_rectangle.right - review_gap ) - minimum_left );
			if ( surface.style && 0 < maximum_inline_size ) {
				if ( 'function' === typeof surface.style.setProperty ) {
					surface.style.setProperty( '--wpbc-timeline-booking-resize-review-max-inline-size', Math.round( maximum_inline_size ) + 'px' );
				} else {
					surface.style[ '--wpbc-timeline-booking-resize-review-max-inline-size' ] = Math.round( maximum_inline_size ) + 'px';
				}
			}
			surface_rectangle = surface.getBoundingClientRect();
			surface_width = surface_rectangle.width;
			surface_height = surface_rectangle.height;
			maximum_left = Math.max( minimum_left, Math.min( viewport_width - review_gap, canvas_rectangle.right - review_gap ) - surface_width );
			desired_left = Math.max( minimum_left, Math.min( maximum_left, card_rectangle.left ) );
			minimum_top = Math.max( review_gap, canvas_rectangle.top + review_gap );
			maximum_bottom = Math.min( viewport_height - review_gap, canvas_rectangle.bottom - review_gap );
			if ( maximum_bottom <= minimum_top ) {
				minimum_top = review_gap;
				maximum_bottom = viewport_height - review_gap;
			}
			below_top = card_rectangle.bottom + review_gap;
			above_top = card_rectangle.top - surface_height - review_gap;
			if ( below_top + surface_height <= maximum_bottom ) {
				desired_top = below_top;
			} else if ( above_top >= minimum_top ) {
				desired_top = above_top;
				placement = 'above';
			} else if ( card_rectangle.top - minimum_top > maximum_bottom - card_rectangle.bottom ) {
				desired_top = Math.max( minimum_top, above_top );
				placement = 'above';
			} else {
				desired_top = Math.max( minimum_top, Math.min( maximum_bottom - surface_height, below_top ) );
			}
			review_host.style.left = Math.round( desired_left ) + 'px';
			review_host.style.top = Math.round( desired_top ) + 'px';
			review_host.setAttribute( 'data-wpbc-timeline-booking-resize-review-placement', placement );
		}

		/**
		 * Coalesce Review-popover positioning during scrolling and viewport changes.
		 *
		 * @return {void}
		 */
		function handle_review_scroll() {
			if ( ! review_position_frame && review_host ) {
				review_position_frame = window.requestAnimationFrame( position_review_popover );
			}
		}

		/**
		 * Render one Review state through the fixed domain template.
		 *
		 * @param {Object} view_model Authorized normalized presentation fields.
		 * @return {void}
		 */
		function render_review( view_model ) {
			var host = ensure_review_host();
			if ( ! host ) {
				return;
			}
			render_template( host, 'review', view_model );
			position_review_popover();
		}

		/**
		 * Attach the transient scroll positioner while one Review is visible.
		 *
		 * @return {void}
		 */
		function attach_review_positioning() {
			var canvas = mount.querySelector( '[data-wpbc-timeline-canvas]' );
			if ( ! canvas ) {
				return;
			}
			if ( review_scroll_canvas && canvas !== review_scroll_canvas ) {
				review_scroll_canvas.removeEventListener( 'scroll', handle_review_scroll );
			}
			if ( canvas !== review_scroll_canvas ) {
				review_scroll_canvas = canvas;
				review_scroll_canvas.addEventListener( 'scroll', handle_review_scroll, { passive: true } );
				window.addEventListener( 'scroll', handle_review_scroll, { capture: true, passive: true } );
				window.addEventListener( 'resize', handle_review_scroll, { passive: true } );
			}
			position_review_popover();
		}

		/**
		 * Remove Review request, positioning, DOM, and signed in-memory state.
		 *
		 * @param {boolean} abort_pending Whether to abort an active request.
		 * @return {void}
		 */
		function clear_review( abort_pending ) {
			review_generation += 1;
			if ( abort_pending && review_request && 'function' === typeof review_request.abort ) {
				review_request.abort();
			}
			review_request = null;
			review_memory = null;
			if ( review_position_frame ) {
				window.cancelAnimationFrame( review_position_frame );
				review_position_frame = 0;
			}
			if ( review_scroll_canvas ) {
				review_scroll_canvas.removeEventListener( 'scroll', handle_review_scroll );
				window.removeEventListener( 'scroll', handle_review_scroll, true );
				window.removeEventListener( 'resize', handle_review_scroll );
				review_scroll_canvas = null;
			}
			if ( review_host && review_host.parentNode ) {
				review_host.removeEventListener( 'click', handle_click );
				review_host.parentNode.removeChild( review_host );
			}
			review_host = null;
		}

		/**
		 * Leave a successful Review so an explicit handle gesture can continue.
		 *
		 * The reviewed local intervals remain the base for either boundary. The prior
		 * signed plan is transferred into this one gesture only, then removed from
		 * the visible Review state. On release the server verifies that base Review
		 * before authorizing the next one-boundary change as a cumulative proposal.
		 *
		 * @param {string} operation Requested resize operation.
		 * @return {Object} Immutable intervals and signed base Review for the gesture.
		 */
		function leave_review_for_pointer( operation ) {
			var context = active_selection.context;
			var reviewed_proposal = active_selection.proposal;
			var can_continue = reviewed_proposal && review_memory && -1 !== operations.indexOf( operation );
			var base_intervals = can_continue ? reviewed_proposal.intervals : context.affected_intervals;
			var base_review = can_continue
				? Object.freeze( {
					plan: review_memory.plan,
					token: review_memory.token,
					expires_at: review_memory.expires_at,
					view_model: review_memory.view_model,
					proposal: reviewed_proposal,
					intervals: Object.freeze( base_intervals.map( function ( interval ) {
						return Object.freeze( {
							start_epoch: interval.start_epoch,
							end_epoch: interval.end_epoch
						} );
					} ) )
				} )
				: null;

			clear_review( false );
			interaction_state = 'ready';
			review_focus_target = null;
			if ( ! can_continue ) {
				clear_ghosts();
				clear_handle_offsets( active_selection.card );
				active_selection.proposal = null;
			}

			return Object.freeze( {
				intervals: Object.freeze( base_intervals.map( function ( interval ) {
					return Object.freeze( {
						start_epoch: interval.start_epoch,
						end_epoch: interval.end_epoch
					} );
				} ) ),
				base_review: base_review
			} );
		}

		/**
		 * Restore the prior successful Review after a release snaps to its boundary.
		 *
		 * The signed plan never leaves controller memory and no request is sent because
		 * the proposed schedule is byte-for-byte unchanged from the reviewed base.
		 *
		 * @param {Object} base_review Prior successful signed Review state.
		 * @return {boolean} True when the Review was restored.
		 */
		function restore_base_review( base_review ) {
			if (
				! active_selection ||
				! base_review ||
				! base_review.plan ||
				! base_review.proposal ||
				! base_review.view_model ||
				! /^[a-f0-9]{64}$/i.test( String( base_review.token || '' ) )
			) {
				return false;
			}

			active_selection.proposal = base_review.proposal;
			review_memory = Object.freeze( {
				plan: base_review.plan,
				token: String( base_review.token ),
				expires_at: Number( base_review.expires_at ) || 0,
				view_model: base_review.view_model
			} );
			review_error_base = null;
			interaction_state = 'review_ready';
			render_review( base_review.view_model );
			attach_review_positioning();
			announce( active_selection.card, i18n.review_ready || '' );

			return true;
		}

		/**
		 * Leave a failed Review so an eligible boundary can be corrected directly.
		 *
		 * Reusing the same boundary keeps the rejected local intervals as the next
		 * gesture base. When that rejected step followed a successful cumulative
		 * Review, the last valid signed base is retained so the server can authorize
		 * the protected opposite boundary. Switching boundaries discards only the
		 * rejected step and resumes from that last valid base. A first-step failure,
		 * which has no signed base, continues to use the immutable saved interval.
		 *
		 * @param {string} operation Requested resize operation.
		 * @return {Object} Immutable intervals and the last valid signed base Review, when available.
		 */
		function leave_review_error_for_pointer( operation ) {
			var context = active_selection.context;
			var failed_proposal = active_selection.proposal;
			var can_correct = failed_proposal && failed_proposal.operation === operation && -1 !== operations.indexOf( operation );
			var signed_base = review_error_base;
			var has_signed_base = signed_base && signed_base.plan && /^[a-f0-9]{64}$/i.test( String( signed_base.token || '' ) ) && Array.isArray( signed_base.intervals );
			var base_intervals = can_correct
				? failed_proposal.intervals
				: ( has_signed_base ? signed_base.intervals : context.affected_intervals );
			var base_review = has_signed_base ? signed_base : null;

			clear_review( false );
			review_error_base = null;
			interaction_state = 'ready';
			review_focus_target = null;
			if ( ! can_correct ) {
				clear_ghosts();
				clear_handle_offsets( active_selection.card );
				active_selection.proposal = null;
			}

			return Object.freeze( {
				intervals: Object.freeze( base_intervals.map( function ( interval ) {
					return Object.freeze( {
						start_epoch: interval.start_epoch,
						end_epoch: interval.end_epoch
					} );
				} ) ),
				base_review: base_review
			} );
		}

		/**
		 * Read one normalized error record from a failed canonical Review response.
		 *
		 * @param {Object} failed_request  jQuery request.
		 * @param {string} fallback_message Operation-specific safe fallback.
		 * @return {Object} Safe code and message.
		 */
		function get_review_error( failed_request, fallback_message ) {
			var error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
			return {
				code: error_data && 'string' === typeof error_data.code ? error_data.code : '',
				message: error_data && 'string' === typeof error_data.message && error_data.message
					? error_data.message
					: ( fallback_message || i18n.review_error || i18n.error || '' )
			};
		}

		/**
		 * Classify one canonical Review failure for administration feedback.
		 *
		 * HTTP 409 represents an actionable conflict with current booking policy or
		 * state. Authentication, malformed, transport, and server failures remain
		 * errors even when the endpoint supplies a safe error code.
		 *
		 * @param {Object} failed_request Failed jQuery request.
		 * @return {string} Standard administration notice type.
		 */
		function get_review_notice_type( failed_request ) {
			return 409 === Number( failed_request && failed_request.status ) ? 'warning' : 'error';
		}

		/**
		 * Reload direct-resize eligibility once after a stale source response.
		 *
		 * Review is never retried automatically. A new gesture requires the newly
		 * issued source-context token and a new explicit pointer release.
		 *
		 * @return {void}
		 */
		function reload_stale_eligibility() {
			var card = active_selection ? active_selection.card : null;
			var booking_id = active_selection ? active_selection.booking_id : 0;
			var restore_focus = active_selection ? active_selection.restore_focus : null;
			var on_source_stale = active_selection ? active_selection.on_source_stale : null;
			var is_external = Boolean( active_selection && active_selection.is_external );
			clear_review( false );
			review_error_base = null;
			document.removeEventListener( 'keydown', handle_interaction_keydown, true );
			clear_ghosts();
			if ( ! active_selection ) {
				return;
			}
			clear_handle_offsets( card );
			if ( callbacks && 'function' === typeof callbacks.resume_overview ) {
				callbacks.resume_overview();
			}
			active_selection.proposal = null;
			active_selection.context = null;
			active_selection.handles = null;
			active_selection.state = 'idle';
			active_selection.request_state = 'idle';
			active_selection.message = i18n.review_stale || '';
			review_focus_target = null;
			interaction_state = 'idle';
			announce( card, active_selection.message );
			show_admin_notice( active_selection.message, 'warning', 5000 );
			if ( is_external ) {
				active_selection = null;
				interaction_state = 'idle';
				if ( 'function' === typeof on_source_stale ) {
					on_source_stale( booking_id );
				}
				if ( 'function' === typeof restore_focus ) {
					restore_focus( booking_id, '' );
				}
				return;
			}
			load_eligibility();
		}

		/**
		 * Send exactly one canonical Review request for one frozen pointer release.
		 *
		 * @param {Object} frozen_proposal Exact immutable Review proposal.
		 * @param {Object|null} base_review Prior signed Review for a cumulative adjustment.
		 * @return {void}
		 */
		function request_review( frozen_proposal, base_review ) {
			var generation;
			var request_data;

			if ( ! active_selection || review_request || ! frozen_proposal ) {
				return;
			}
			interaction_state = 'review_pending';
			review_memory = null;
			review_error_base = null;
			render_review( {
				state: 'busy',
				title: i18n.review_title || '',
				message: i18n.review_pending || '',
				can_cancel: true,
				cancel_label: i18n.cancel || ''
			} );
			attach_review_positioning();
			generation = review_generation;
			request_data = {
				action: review_transport.action,
				nonce: review_transport.nonce,
				booking_id: frozen_proposal.booking_id,
				source: review_transport.source,
				proposal: JSON.stringify( frozen_proposal )
			};
			if ( base_review && base_review.plan && /^[a-f0-9]{64}$/i.test( String( base_review.token || '' ) ) ) {
				request_data.base_plan = JSON.stringify( base_review.plan );
				request_data.base_token = String( base_review.token );
			}
			review_request = window.jQuery.ajax( {
				url: review_transport.url,
				method: 'POST',
				dataType: 'json',
				data: request_data
			} ).done( function ( response ) {
				var result = response && response.success ? response.data : null;
				var review = result && result.review ? result.review : null;
				var review_view_model;
				if ( is_destroyed || generation !== review_generation || ! active_selection ) {
					return;
				}
				if ( ! review || Number( review.booking_id ) !== frozen_proposal.booking_id || 'resize' !== review.interaction_source || frozen_proposal.operation !== review.operation || ! result.plan || ! /^[a-f0-9]{64}$/i.test( String( result.token || '' ) ) || Number( result.expires_at ) <= Date.now() / 1000 ) {
					interaction_state = 'review_error';
					review_memory = null;
					review_error_base = base_review || null;
					render_review( {
						state: 'error',
						title: i18n.review_title || '',
						message: i18n.review_error || i18n.error || '',
						cancel_label: i18n.cancel || '',
						show_fallback: Boolean( callbacks && 'function' === typeof callbacks.open_full_reschedule ),
						fallback_label: i18n.full_dialog || ''
					} );
					show_admin_notice( i18n.review_error || i18n.error || '', 'error', 10000 );
					return;
				}
				review_view_model = Object.freeze( {
					state: 'ready',
					title: i18n.review_title || '',
					resize_impact: review.resize_impact || {},
					interval_description: '',
					duration_description: review.duration && review.duration.proposed_label ? String( review.duration.proposed_label ) : '',
					can_cancel: true,
					cancel_label: i18n.cancel || '',
					apply_label: i18n.apply || ''
				} );
				review_memory = Object.freeze( {
					plan: result.plan,
					token: String( result.token ),
					expires_at: Number( result.expires_at ) || 0,
					view_model: review_view_model
				} );
				review_error_base = null;
				interaction_state = 'review_ready';
				render_review( review_view_model );
				announce( active_selection.card, i18n.review_ready || '' );
			} ).fail( function ( failed_request, request_status ) {
				var error;
				var notice_type;
				if ( is_destroyed || generation !== review_generation || 'abort' === request_status || ! active_selection ) {
					return;
				}
				error = get_review_error( failed_request );
				if ( 'wpbc_booking_rescheduling_source_stale' === error.code ) {
					reload_stale_eligibility();
					return;
				}
				review_memory = null;
				review_error_base = base_review || null;
				interaction_state = 'review_error';
				render_review( {
					state: 'error',
					title: i18n.review_title || '',
					message: error.message,
					cancel_label: i18n.cancel || '',
					show_fallback: Boolean( callbacks && 'function' === typeof callbacks.open_full_reschedule ),
					fallback_label: i18n.full_dialog || ''
				} );
				notice_type = get_review_notice_type( failed_request );
				show_admin_notice( error.message, notice_type, 'warning' === notice_type ? 5000 : 10000 );
			} ).always( function () {
				if ( generation === review_generation ) {
					review_request = null;
				}
			} );
		}

		/**
		 * Start canonical Resize Review for geometry owned by another presentation.
		 *
		 * The caller supplies no mutation authority. This method accepts only the
		 * established `resize_start` or `resize_end` proposal shape and submits it to
		 * the existing signed Review endpoint. Apply and readback remain unchanged.
		 *
		 * @param {Object} proposal Exact executable-free Resize Review proposal.
		 * @param {Object} state    Presentation card, focus, and stale-state callbacks.
		 * @return {boolean} True when the canonical Review lifecycle started.
		 */
		function review_resize_proposal( proposal, state ) {
			var interval = proposal && Array.isArray( proposal.proposed_intervals ) ? proposal.proposed_intervals[ 0 ] : null;
			var operation = String( proposal && proposal.operation || '' );
			var card = state && state.card ? state.card : null;
			var frozen_proposal;

			if (
				is_destroyed
				|| -1 !== [ 'pointer_candidate', 'dragging', 'review_pending', 'review_ready', 'apply_pending', 'refresh_pending' ].indexOf( interaction_state )
				|| ! card
				|| false === card.isConnected
				|| Number( proposal && proposal.schema_version ) !== Number( review_transport.schema_version )
				|| ! Number( proposal && proposal.booking_id )
				|| 'resize' !== String( proposal && proposal.interaction_source || '' )
				|| -1 === operations.indexOf( operation )
				|| ! Number( proposal && proposal.target_resource_id )
				|| -1 === [ 'policy', 'individual' ].indexOf( String( proposal && proposal.selection_method || '' ) )
				|| ! interval
				|| 1 !== proposal.proposed_intervals.length
				|| ! is_exact_instant( interval.start )
				|| ! is_exact_instant( interval.end )
				|| Date.parse( interval.end ) <= Date.parse( interval.start )
				|| ! Number( proposal && proposal.proposal_revision )
				|| ! String( proposal && proposal.source_context_token || '' )
			) {
				return false;
			}

			cancel_interaction( false, 'external_replaced' );
			if ( active_selection && active_selection.card ) {
				clear_card( active_selection.card );
			}
			abort_request();
			presentation_generation += 1;
			frozen_proposal = Object.freeze( {
				schema_version: Math.round( Number( proposal.schema_version ) ),
				booking_id: Math.round( Number( proposal.booking_id ) ),
				interaction_source: 'resize',
				operation: operation,
				target_resource_id: Math.round( Number( proposal.target_resource_id ) ),
				selection_method: String( proposal.selection_method ),
				proposed_intervals: Object.freeze( [ Object.freeze( {
					start: String( interval.start ),
					end: String( interval.end )
				} ) ] ),
				proposal_revision: Math.round( Number( proposal.proposal_revision ) ),
				source_context_token: String( proposal.source_context_token )
			} );
			active_selection = {
				card: card,
				booking_id: frozen_proposal.booking_id,
				segment_id: String( state.segment_id || '' ),
				visible_start: String( state.visible_start || interval.start ),
				visible_end: String( state.visible_end || interval.end ),
				show_start: 'resize_start' === operation,
				show_end: 'resize_end' === operation,
				key: 'external-resize-' + frozen_proposal.booking_id,
				state: 'ready',
				request_state: 'complete',
				handles: null,
				context: state.resize_context || null,
				proposal: {
					operation: operation,
					intervals: [ {
						start_epoch: Date.parse( interval.start ),
						end_epoch: Date.parse( interval.end )
					} ]
				},
				next_proposal_revision: frozen_proposal.proposal_revision + 1,
				message: '',
				is_external: true,
				restore_focus: 'function' === typeof state.restore_focus ? state.restore_focus : null,
				on_source_stale: 'function' === typeof state.on_source_stale ? state.on_source_stale : null
			};
			review_focus_target = state.focus || null;
			if ( callbacks && 'function' === typeof callbacks.suspend_overview ) {
				callbacks.suspend_overview( card );
			}
			document.addEventListener( 'keydown', handle_interaction_keydown, true );
			request_review( frozen_proposal, null );

			return true;
		}

		/**
		 * Finish a successful Apply only after every canonical host readback succeeds.
		 *
		 * @return {void}
		 */
		function finish_apply_refresh() {
			var card = active_selection ? active_selection.card : null;

			clear_review( false );
			review_error_base = null;
			pending_apply_result = null;
			document.removeEventListener( 'keydown', handle_interaction_keydown, true );
			clear_ghosts();
			if ( active_selection ) {
				clear_handle_offsets( card );
				active_selection.proposal = null;
				interaction_state = active_selection.context ? 'ready' : 'idle';
			}
			if ( callbacks && 'function' === typeof callbacks.resume_overview ) {
				callbacks.resume_overview();
			}
			restore_apply_handle_focus();
			show_admin_notice( i18n.applied || '', 'success', 3000 );
		}

		/**
		 * Refresh canonical Timeline and Inspector projections after persistence.
		 *
		 * The retained Apply result is a success identity, not mutation input. A
		 * retry invokes only this readback callback and can never resend Apply.
		 *
		 * @return {void}
		 */
		function refresh_after_apply() {
			var refresh_result;

			if ( ! pending_apply_result || 'refresh_pending' === interaction_state ) {
				return;
			}
			interaction_state = 'refresh_pending';
			render_review( {
				state: 'busy',
				title: i18n.review_title || '',
				message: i18n.refreshing || '',
				can_cancel: false,
				cancel_label: i18n.cancel || ''
			} );
			attach_review_positioning();

			if ( ! callbacks || 'function' !== typeof callbacks.refresh_after_apply ) {
				interaction_state = 'refresh_error';
				render_review( {
					state: 'refresh_error',
					title: i18n.review_title || '',
					message: i18n.refresh_error || '',
					can_cancel: true,
					cancel_label: i18n.close || i18n.cancel || '',
					retry_refresh_label: i18n.retry_refresh || ''
				} );
				show_admin_notice( i18n.refresh_error || '', 'warning', 10000 );
				return;
			}

			try {
				refresh_result = callbacks.refresh_after_apply( pending_apply_result );
			} catch ( refresh_error ) {
				refresh_result = window.jQuery.Deferred().reject( refresh_error ).promise();
			}
			window.jQuery.when( refresh_result ).done( function () {
				if ( is_destroyed || ! pending_apply_result ) {
					return;
				}
				finish_apply_refresh();
			} ).fail( function () {
				if ( is_destroyed || ! pending_apply_result ) {
					return;
				}
				interaction_state = 'refresh_error';
				render_review( {
					state: 'refresh_error',
					title: i18n.review_title || '',
					message: i18n.refresh_error || '',
					can_cancel: true,
					cancel_label: i18n.close || i18n.cancel || '',
					retry_refresh_label: i18n.retry_refresh || ''
				} );
				attach_review_positioning();
				show_admin_notice( i18n.refresh_error || '', 'warning', 10000 );
			} );
		}

		/**
		 * Submit exactly one mutation request for the current signed Review.
		 *
		 * @return {void}
		 */
		function request_apply() {
			var apply_memory;
			var booking_id;
			var generation;

			if (
				'review_ready' !== interaction_state
				|| apply_request
				|| pending_apply_result
				|| ! active_selection
				|| ! review_memory
				|| ! review_memory.plan
				|| ! /^[a-f0-9]{64}$/i.test( String( review_memory.token || '' ) )
			) {
				return;
			}

			apply_memory = review_memory;
			booking_id = active_selection.booking_id;
			apply_focus_operation = active_selection.proposal && -1 !== operations.indexOf( active_selection.proposal.operation )
				? active_selection.proposal.operation
				: '';
			interaction_state = 'apply_pending';
			render_review( {
				state: 'busy',
				title: i18n.review_title || '',
				message: i18n.applying || '',
				can_cancel: false,
				cancel_label: i18n.cancel || ''
			} );
			generation = apply_generation;
			apply_request = window.jQuery.ajax( {
				url: apply_transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: apply_transport.action,
					nonce: apply_transport.nonce,
					booking_id: booking_id,
					source: apply_transport.source,
					send_modified_email: get_send_modified_email_intent(),
					plan: JSON.stringify( apply_memory.plan ),
					token: apply_memory.token
				}
			} ).done( function ( response ) {
				var result = response && response.success ? response.data : null;
				var identity = result && result.canonical_identity ? result.canonical_identity : null;

				if ( is_destroyed || generation !== apply_generation || ! active_selection ) {
					return;
				}
				if ( ! result || Number( result.booking_id || 0 ) !== booking_id || ! identity || Number( identity.booking_id || 0 ) !== booking_id || ! String( identity.modification_date || '' ) ) {
					pending_apply_result = result || { booking_id: booking_id };
					interaction_state = 'refresh_error';
					render_review( {
						state: 'refresh_error',
						title: i18n.review_title || '',
						message: i18n.refresh_error || '',
						can_cancel: true,
						cancel_label: i18n.close || i18n.cancel || '',
						retry_refresh_label: i18n.retry_refresh || ''
					} );
					show_admin_notice( i18n.refresh_error || '', 'warning', 10000 );
					return;
				}
				pending_apply_result = result;
				review_memory = null;
				refresh_after_apply();
			} ).fail( function ( failed_request, request_status ) {
				var error;
				var notice_type;

				if ( is_destroyed || generation !== apply_generation || 'abort' === request_status || ! active_selection ) {
					return;
				}
				error = get_review_error( failed_request, i18n.apply_error || i18n.error || '' );
				review_memory = null;
				review_error_base = null;
				interaction_state = 'review_error';
				render_review( {
					state: 'error',
					title: i18n.review_title || '',
					message: error.message,
					can_cancel: true,
					cancel_label: i18n.cancel || '',
					show_fallback: Boolean( callbacks && 'function' === typeof callbacks.open_full_reschedule ),
					fallback_label: i18n.full_dialog || ''
				} );
				notice_type = get_review_notice_type( failed_request );
				show_admin_notice( error.message, notice_type, 'warning' === notice_type ? 5000 : 10000 );
			} ).always( function () {
				if ( generation === apply_generation ) {
					apply_request = null;
				}
			} );
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
		 * Find an affected interval intersecting one visible segment.
		 *
		 * @param {Object} record Registered segment.
		 * @param {Array<Object>} intervals Immutable intervals.
		 * @return {number} Matching index or -1.
		 */
		function affected_interval_index( record, intervals ) {
			var match = -1;
			intervals.some( function ( interval, index ) {
				if ( record.visible_start_epoch < interval.end_epoch && record.visible_end_epoch > interval.start_epoch ) {
					match = index;
					return true;
				}
				return false;
			} );
			return match;
		}

		/**
		 * Create at most one template-owned ghost per visible occurrence.
		 *
		 * @return {void}
		 */
		function create_ghosts() {
			var renderer = get_template( 'ghost' );
			if ( ! renderer ) {
				return;
			}
			clear_ghosts();
			visible_segments.forEach( function ( record ) {
				var hosts;
				var interval_index;
				if ( record.booking_id !== active_selection.booking_id || ! record.card.isConnected ) {
					return;
				}
				interval_index = affected_interval_index( record, active_selection.context.affected_intervals );
				if ( -1 === interval_index ) {
					return;
				}
				hosts = get_hosts( record.card );
				if ( ! hosts.root ) {
					return;
				}
				record.ghost_host = document.createElement( 'span' );
				record.ghost_host.className = 'wpbc_timeline_booking_resize__ghost_host';
				record.ghost_host.innerHTML = renderer( { duration_label: '' } );
				hosts.root.appendChild( record.ghost_host );
				record.ghost = record.ghost_host.querySelector( '[data-wpbc-timeline-booking-resize-ghost]' );
				record.ghost_interval_index = interval_index;
				record.card.classList.toggle( 'is-booking-resizing', true );
				active_ghost_records.push( record );
			} );
		}

		/**
		 * Format a localized presentation-only duration in compound units.
		 *
		 * @param {number} milliseconds Positive duration.
		 * @return {string} Compact duration label.
		 */
		function format_duration( milliseconds ) {
			var total_minutes = Math.max( 0, Math.round( milliseconds / 60000 ) );
			var days = Math.floor( total_minutes / 1440 );
			var hours = Math.floor( ( total_minutes % 1440 ) / 60 );
			var minutes = total_minutes % 60;
			var parts = [];

			if ( days ) {
				parts.push( String( 1 === days ? ( i18n.duration_day || '%s day' ) : ( i18n.duration_days || '%s days' ) ).replace( '%s', days ) );
			}
			if ( hours ) {
				parts.push( String( 1 === hours ? ( i18n.duration_hour || '%s hour' ) : ( i18n.duration_hours || '%s hours' ) ).replace( '%s', hours ) );
			}
			if ( minutes || ! parts.length ) {
				parts.push( String( 1 === minutes ? ( i18n.duration_minute || '%s minute' ) : ( i18n.duration_minutes || '%s minutes' ) ).replace( '%s', minutes ) );
			}

			return parts.join( ' ' );
		}

		/**
		 * Determine whether one proposal boundary differs from canonical state.
		 *
		 * A cumulative resize can contain an earlier reviewed change on the boundary
		 * opposite the current gesture. Geometry must therefore compare both exact
		 * proposal instants with the immutable server interval instead of relying on
		 * the current gesture's one-boundary authorization flags.
		 *
		 * @param {Object|null} proposal_interval  Current presentation interval.
		 * @param {Object|null} canonical_interval Immutable server interval.
		 * @param {string}      boundary           Start or end boundary key.
		 * @return {boolean} True when the exact boundary has changed.
		 */
		function has_proposed_boundary_change( proposal_interval, canonical_interval, boundary ) {
			var epoch_key = 'start' === boundary ? 'start_epoch' : 'end_epoch';

			return Boolean(
				proposal_interval && canonical_interval
				&& Number( proposal_interval[ epoch_key ] ) !== Number( canonical_interval[ epoch_key ] )
			);
		}

		/**
		 * Project drag-time handle hit areas to the active proposal boundaries.
		 *
		 * The canonical booking card and authorized handle DOM remain unchanged.
		 * Physical pixel offsets are derived from the same refreshed axis snapshot
		 * as the dashed ghost, which keeps LTR, RTL, zoom, and horizontal scrolling
		 * geometry consistent without adding a permanent scroll listener.
		 *
		 * @param {Object} proposal Mutable presentation proposal.
		 * @param {Object} snapshot Loaded-axis geometry snapshot.
		 * @return {void}
		 */
		function update_handle_offsets( proposal, snapshot ) {
			var card = active_selection && active_selection.card ? active_selection.card : null;
			var context = active_selection ? active_selection.context : null;
			var interval = context && proposal.intervals ? proposal.intervals[ context.anchor_interval_index ] : null;
			var canonical_interval = context && context.affected_intervals ? context.affected_intervals[ context.anchor_interval_index ] : null;
			var card_rectangle;
			var visual_start_x;
			var visual_end_x;
			var proposed_start_x;
			var proposed_end_x;
			var start_offset;
			var end_offset;

			if ( ! card || ! card.style || 'function' !== typeof card.style.setProperty || ! interval ) {
				return;
			}
			card_rectangle = card.getBoundingClientRect();
			visual_start_x = snapshot.is_rtl ? card_rectangle.right : card_rectangle.left;
			visual_end_x = snapshot.is_rtl ? card_rectangle.left : card_rectangle.right;
			proposed_start_x = has_proposed_boundary_change( interval, canonical_interval, 'start' ) ? epoch_to_x( snapshot, interval.start_epoch ) : visual_start_x;
			proposed_end_x = has_proposed_boundary_change( interval, canonical_interval, 'end' ) ? epoch_to_x( snapshot, interval.end_epoch ) : visual_end_x;
			start_offset = Math.round( ( proposed_start_x - visual_start_x ) * 100 ) / 100;
			end_offset = Math.round( ( proposed_end_x - visual_end_x ) * 100 ) / 100;
			card.style.setProperty( '--wpbc-timeline-booking-resize-start-offset', start_offset + 'px' );
			card.style.setProperty( '--wpbc-timeline-booking-resize-end-offset', end_offset + 'px' );
		}

		/**
		 * Update existing ghost styles only when geometry changed.
		 *
		 * @param {Object} proposal Mutable proposal.
		 * @param {Object} snapshot Axis snapshot.
		 * @return {void}
		 */
		function update_ghosts( proposal, snapshot ) {
			update_handle_offsets( proposal, snapshot );
			active_ghost_records.forEach( function ( record ) {
				var interval;
				var canonical_interval;
				var card_rectangle;
				var start_x;
				var end_x;
				var left;
				var width;
				var duration;
				var key;
				if ( ! record.ghost || -1 === record.ghost_interval_index || ! proposal.intervals[ record.ghost_interval_index ] ) {
					return;
				}
				interval = proposal.intervals[ record.ghost_interval_index ];
				canonical_interval = active_selection.context.affected_intervals[ record.ghost_interval_index ];
				card_rectangle = record.card.getBoundingClientRect();
				start_x = has_proposed_boundary_change( interval, canonical_interval, 'start' )
					? epoch_to_x( snapshot, interval.start_epoch )
					: ( snapshot.is_rtl ? card_rectangle.right : card_rectangle.left );
				end_x = has_proposed_boundary_change( interval, canonical_interval, 'end' )
					? epoch_to_x( snapshot, interval.end_epoch )
					: ( snapshot.is_rtl ? card_rectangle.left : card_rectangle.right );
				left = Math.min( start_x, end_x ) - card_rectangle.left;
				width = Math.max( 2, Math.abs( end_x - start_x ) );
				duration = format_duration( interval.end_epoch - interval.start_epoch );
				key = [ Math.round( left * 100 ) / 100, Math.round( width * 100 ) / 100, duration ].join( '|' );
				if ( key === record.ghost_geometry_key ) {
					return;
				}
				record.ghost.style.left = left + 'px';
				record.ghost.style.top = '0';
				record.ghost.style.width = width + 'px';
				record.ghost.style.height = Math.max( 44, card_rectangle.height ) + 'px';
				if ( record.ghost.firstElementChild ) {
					record.ghost.firstElementChild.textContent = duration;
				}
				record.ghost_geometry_key = key;
			} );
		}

		/**
		 * Schedule at most one pointer or scroll geometry frame.
		 *
		 * @return {void}
		 */
		function schedule_preview() {
			if ( ! preview_frame && pointer_gesture && 'dragging' === interaction_state ) {
				preview_frame = window.requestAnimationFrame( update_preview );
			}
		}

		/**
		 * Auto-scroll only within the already-loaded Timeline axis.
		 *
		 * @param {Object} gesture Active pointer gesture.
		 * @return {void}
		 */
		function auto_scroll_loaded_axis( gesture ) {
			var rectangle = gesture.axis.canvas.getBoundingClientRect();
			var first_rectangle = gesture.axis.cells[0].rectangle;
			var last_rectangle = gesture.axis.cells[gesture.axis.cells.length - 1].rectangle;
			var loaded_left = Math.min( first_rectangle.left, last_rectangle.left );
			var loaded_right = Math.max( first_rectangle.right, last_rectangle.right );
			var distance = 0;
			if ( gesture.client_x < rectangle.left + auto_scroll_edge && loaded_left < rectangle.left - 0.5 ) {
				distance = -auto_scroll_step * ( 1 - Math.max( 0, gesture.client_x - rectangle.left ) / auto_scroll_edge );
			} else if ( gesture.client_x > rectangle.right - auto_scroll_edge && loaded_right > rectangle.right + 0.5 ) {
				distance = auto_scroll_step * ( 1 - Math.max( 0, rectangle.right - gesture.client_x ) / auto_scroll_edge );
			}
			if ( ! distance ) {
				return;
			}
			if ( gesture.axis.is_rtl ) {
				distance *= -1;
			}
			if ( 'function' === typeof gesture.axis.canvas.scrollBy ) {
				gesture.axis.canvas.scrollBy( { left: distance, top: 0, behavior: 'auto' } );
			} else {
				gesture.axis.canvas.scrollLeft += distance;
			}
		}

		/**
		 * Project the latest pointer into local proposal presentation.
		 *
		 * Drag frames follow the minute-level pointer coordinate continuously. Final
		 * pointer release applies the configured Timeline-step snap except for a
		 * semantic day time-slot card, whose visible edge is not its saved boundary.
		 * This keeps movement responsive while retaining deterministic boundaries.
		 *
		 * @param {boolean} snap_for_release Whether this is the final release projection.
		 * @return {void}
		 */
		function project_preview( snap_for_release ) {
			var gesture = pointer_gesture;
			var candidate_epoch;
			var is_full_day;
			var proposal;
			preview_frame = 0;
			if ( ! gesture || 'dragging' !== interaction_state || gesture.generation !== presentation_generation ) {
				return;
			}
			refresh_axis_rectangles( gesture.axis );
			auto_scroll_loaded_axis( gesture );
			is_full_day = -1 !== full_day_shapes.indexOf( active_selection.context.saved_shape );
			candidate_epoch = snap_for_release && should_snap_release_to_timeline_step( gesture )
				? pointer_to_step_epoch( gesture.axis, gesture.client_x, gesture )
				: ( gesture.uses_visual_boundary_handle
					? pointer_delta_to_epoch( gesture.axis, gesture.client_x, gesture )
					: pointer_to_epoch(
						gesture.axis,
						gesture.client_x,
						gesture.operation,
						snap_for_release && is_full_day
					) );
			proposal = create_proposal( gesture, candidate_epoch );
			if ( active_selection.proposal && active_selection.proposal.signature === proposal.signature && ! gesture.did_scroll ) {
				return;
			}
			gesture.did_scroll = false;
			active_selection.proposal = proposal;
			update_ghosts( proposal, gesture.axis );
		}

		/**
		 * Recalculate a continuous drag preview from the latest pointer position.
		 *
		 * @return {void}
		 */
		function update_preview() {
			project_preview( false );
		}

		/**
		 * Recalculate and snap the final proposal immediately before Review.
		 *
		 * @return {void}
		 */
		function finalize_preview() {
			project_preview( true );
		}

		/**
		 * Determine whether the final snapped proposal changed its requested boundary.
		 *
		 * @param {Object|null} proposal       Final local proposal.
		 * @param {Array}       base_intervals Immutable intervals at gesture start.
		 * @return {boolean} True when Review must validate a changed schedule.
		 */
		function proposal_changes_base_boundary( proposal, base_intervals ) {
			var boundary_key;
			if ( ! proposal || ! Array.isArray( proposal.intervals ) || ! Array.isArray( base_intervals ) || proposal.intervals.length !== base_intervals.length ) {
				return true;
			}
			boundary_key = 'resize_start' === proposal.operation ? 'start_epoch' : 'end_epoch';

			return proposal.intervals.some( function ( interval, interval_index ) {
				return Number( interval[ boundary_key ] ) !== Number( base_intervals[ interval_index ][ boundary_key ] );
			} );
		}

		/**
		 * Start drag ownership after the threshold is crossed.
		 *
		 * @return {boolean} True when the immutable axis snapshot was acquired.
		 */
		function begin_dragging() {
			var snapshot;
			if ( ! pointer_gesture || ! active_selection || ! active_selection.context ) {
				return false;
			}
			snapshot = create_axis_snapshot( active_selection.card );
			if ( ! snapshot || snapshot.generation !== presentation_generation ) {
				cancel_interaction( true, 'stale_axis' );
				return false;
			}
			pointer_gesture.axis = snapshot;
			pointer_gesture.start_axis_units = pointer_to_axis_position( snapshot, pointer_gesture.start_x ).units;
			interaction_state = 'dragging';
			active_selection.card.classList.toggle( 'is-booking-resizing', true );
			if ( callbacks && 'function' === typeof callbacks.set_axis_window_loading_locked ) {
				callbacks.set_axis_window_loading_locked( true );
			}
			transient_scroll_canvas = snapshot.canvas;
			transient_scroll_canvas.addEventListener( 'scroll', handle_resize_scroll, { passive: true } );
			create_ghosts();
			set_dragging_presentation( true );
			schedule_preview();
			return true;
		}

		/**
		 * Resolve an authorized handle from one event.
		 *
		 * @param {Event} event Browser input event.
		 * @return {HTMLElement|null} Active handle or null.
		 */
		function get_active_handle( event ) {
			var handle = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-booking-resize-handle]' ) : null;
			var operation = handle ? String( handle.getAttribute( 'data-wpbc-timeline-booking-resize-operation' ) || '' ) : '';
			if ( -1 === [ 'ready', 'review_ready', 'review_error' ].indexOf( interaction_state ) || ! handle || ! active_selection || ! active_selection.context || ! active_selection.card || ! active_selection.card.contains( handle ) || -1 === operations.indexOf( operation ) ) {
				return null;
			}
			if ( ( 'resize_start' === operation && ! active_selection.context.boundaries.start ) || ( 'resize_end' === operation && ! active_selection.context.boundaries.end ) ) {
				return null;
			}
			return handle;
		}

		/**
		 * Enter pointer-candidate state through delegated pointer input.
		 *
		 * @param {PointerEvent} event Pointer-down event.
		 * @return {void}
		 */
		function handle_pointer_down( event ) {
			var handle = get_active_handle( event );
			var operation;
			var base_intervals;
			var continuation_state;
			var corrects_review_error;
			var continues_review;
			if ( ! handle || pointer_gesture || ( 'mouse' === event.pointerType && 0 !== event.button ) || false === event.isPrimary ) {
				return;
			}
			operation = String( handle.getAttribute( 'data-wpbc-timeline-booking-resize-operation' ) );
			continues_review = 'review_ready' === interaction_state;
			corrects_review_error = 'review_error' === interaction_state;
			continuation_state = continues_review
				? leave_review_for_pointer( operation )
				: ( corrects_review_error ? leave_review_error_for_pointer( operation ) : null );
			base_intervals = continuation_state ? continuation_state.intervals : active_selection.context.affected_intervals;
			if ( ! continues_review && ! corrects_review_error ) {
				cancel_interaction( false, 'new_pointer' );
			}
			interaction_state = 'pointer_candidate';
			pointer_gesture = {
				handle: handle,
				operation: operation,
				base_intervals: base_intervals,
				base_review: continuation_state ? continuation_state.base_review : null,
				pointer_id: event.pointerId,
				pointer_type: event.pointerType || 'mouse',
				start_x: event.clientX,
				start_y: event.clientY,
				client_x: event.clientX,
				client_y: event.clientY,
				generation: presentation_generation,
				axis: null,
				uses_visual_boundary_handle: active_selection.card.classList.contains( 'is-day-time-slot' ),
				did_scroll: false,
				is_finishing: false
			};
			handle.addEventListener( 'pointermove', handle_pointer_move );
			handle.addEventListener( 'pointerup', handle_pointer_up );
			handle.addEventListener( 'pointercancel', handle_pointer_cancel );
			handle.addEventListener( 'lostpointercapture', handle_lost_pointer_capture );
			document.addEventListener( 'keydown', handle_interaction_keydown, true );
			if ( 'function' === typeof handle.setPointerCapture ) {
				handle.setPointerCapture( event.pointerId );
			}
			if ( ! continues_review && ! corrects_review_error && callbacks && 'function' === typeof callbacks.suspend_overview ) {
				callbacks.suspend_overview( active_selection.card );
			}
			event.stopPropagation();
		}

		/**
		 * Update one candidate or active drag pointer.
		 *
		 * @param {PointerEvent} event Pointer-move event.
		 * @return {void}
		 */
		function handle_pointer_move( event ) {
			var delta_x;
			var delta_y;
			if ( ! pointer_gesture || event.pointerId !== pointer_gesture.pointer_id ) {
				return;
			}
			pointer_gesture.client_x = event.clientX;
			pointer_gesture.client_y = event.clientY;
			delta_x = event.clientX - pointer_gesture.start_x;
			delta_y = event.clientY - pointer_gesture.start_y;
			if ( 'pointer_candidate' === interaction_state ) {
				if ( 'touch' === pointer_gesture.pointer_type && Math.abs( delta_y ) >= touch_vertical_threshold && Math.abs( delta_y ) > Math.abs( delta_x ) ) {
					cancel_interaction( false, 'touch_scroll' );
					return;
				}
				if ( Math.sqrt( delta_x * delta_x + delta_y * delta_y ) < drag_threshold || ! begin_dragging() ) {
					return;
				}
			}
			if ( 'dragging' === interaction_state ) {
				event.preventDefault();
				event.stopPropagation();
				schedule_preview();
			}
		}

		/**
		 * Finish pointer capture, freeze the proposal, and request Review once.
		 *
		 * @param {PointerEvent} event Pointer-up event.
		 * @return {void}
		 */
		function handle_pointer_up( event ) {
			var frozen_proposal;
			var base_review;
			var base_intervals;
			var timezone;
			if ( ! pointer_gesture || event.pointerId !== pointer_gesture.pointer_id ) {
				return;
			}
			if ( 'dragging' !== interaction_state ) {
				cancel_interaction( true, 'pointer_click' );
				return;
			}
			pointer_gesture.client_x = event.clientX;
			if ( preview_frame ) {
				window.cancelAnimationFrame( preview_frame );
				preview_frame = 0;
			}
			finalize_preview();
			base_review = pointer_gesture.base_review;
			base_intervals = pointer_gesture.base_intervals;
			if ( ! proposal_changes_base_boundary( active_selection.proposal, base_intervals ) ) {
				review_focus_target = pointer_gesture.handle;
				suppress_handle_click = true;
				window.setTimeout( function () {
					suppress_handle_click = false;
				}, 0 );
				if ( base_review ) {
					release_pointer_resources( false );
					if ( ! restore_base_review( base_review ) ) {
						cancel_interaction( true, 'no_change' );
					}
				} else {
					cancel_interaction( true, 'no_change' );
				}
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			timezone = pointer_gesture.axis ? pointer_gesture.axis.timezone : '';
			review_focus_target = pointer_gesture.handle;
			frozen_proposal = freeze_review_proposal( active_selection.proposal, timezone );
			suppress_handle_click = true;
			window.setTimeout( function () {
				suppress_handle_click = false;
			}, 0 );
			/* Keep title and Overview tooltips suspended while Review owns attention. */
			release_pointer_resources( false );
			if ( frozen_proposal ) {
				request_review( frozen_proposal, base_review );
			} else {
				interaction_state = 'review_error';
				render_review( {
					state: 'error',
					title: i18n.review_title || '',
					message: i18n.review_error || i18n.error || '',
					cancel_label: i18n.cancel || '',
					show_fallback: Boolean( callbacks && 'function' === typeof callbacks.open_full_reschedule ),
					fallback_label: i18n.full_dialog || ''
				} );
				attach_review_positioning();
				show_admin_notice( i18n.review_error || i18n.error || '', 'error', 10000 );
			}
			event.preventDefault();
			event.stopPropagation();
		}

		/**
		 * Cancel from the browser pointer-cancellation path.
		 *
		 * @param {PointerEvent} event Pointer-cancel event.
		 * @return {void}
		 */
		function handle_pointer_cancel( event ) {
			if ( pointer_gesture && event.pointerId === pointer_gesture.pointer_id ) {
				cancel_interaction( true, 'pointer_cancel' );
			}
		}

		/**
		 * Cancel when pointer capture is unexpectedly lost.
		 *
		 * @param {PointerEvent} event Lost-capture event.
		 * @return {void}
		 */
		function handle_lost_pointer_capture( event ) {
			if ( pointer_gesture && event.pointerId === pointer_gesture.pointer_id && ! pointer_gesture.is_finishing ) {
				cancel_interaction( true, 'lost_capture' );
			}
		}

		/**
		 * Coalesce transient resize scrolling into the preview frame.
		 *
		 * @return {void}
		 */
		function handle_resize_scroll() {
			if ( pointer_gesture && 'dragging' === interaction_state ) {
				pointer_gesture.did_scroll = true;
				schedule_preview();
			}
		}

		/**
		 * Cancel candidate, drag, or canonical Review with Escape.
		 *
		 * @param {KeyboardEvent} event Document key event.
		 * @return {void}
		 */
		function handle_interaction_keydown( event ) {
			if ( 'Escape' === event.key && is_interacting() ) {
				event.preventDefault();
				event.stopPropagation();
				cancel_interaction( true, 'escape' );
			}
		}

		/**
		 * Remove pointer, frame, scroll, Overview, and axis-lock resources.
		 *
		 * @param {boolean} resume_overview Whether the Overview may resume.
		 * @return {void}
		 */
		function release_pointer_resources( resume_overview ) {
			var gesture = pointer_gesture;
			set_dragging_presentation( false );
			if ( preview_frame ) {
				window.cancelAnimationFrame( preview_frame );
				preview_frame = 0;
			}
			if ( transient_scroll_canvas ) {
				transient_scroll_canvas.removeEventListener( 'scroll', handle_resize_scroll );
				transient_scroll_canvas = null;
			}
			if ( callbacks && 'function' === typeof callbacks.set_axis_window_loading_locked ) {
				callbacks.set_axis_window_loading_locked( false );
			}
			if ( gesture && gesture.handle ) {
				gesture.is_finishing = true;
				gesture.handle.removeEventListener( 'pointermove', handle_pointer_move );
				gesture.handle.removeEventListener( 'pointerup', handle_pointer_up );
				gesture.handle.removeEventListener( 'pointercancel', handle_pointer_cancel );
				gesture.handle.removeEventListener( 'lostpointercapture', handle_lost_pointer_capture );
				if ( 'function' === typeof gesture.handle.hasPointerCapture && gesture.handle.hasPointerCapture( gesture.pointer_id ) ) {
					gesture.handle.releasePointerCapture( gesture.pointer_id );
				}
			}
			pointer_gesture = null;
			if ( resume_overview && callbacks && 'function' === typeof callbacks.resume_overview ) {
				callbacks.resume_overview();
			}
		}

		/**
		 * Cancel all pointer-preview state without changing canonical cards.
		 *
		 * @param {boolean} restore_focus Whether to focus the originating handle.
		 * @param {string} reason Internal teardown reason.
		 * @return {void}
		 */
		function cancel_interaction( restore_focus, reason ) {
			var focus_target = pointer_gesture && pointer_gesture.handle ? pointer_gesture.handle : review_focus_target;
			if ( -1 !== [ 'apply_pending', 'refresh_pending' ].indexOf( interaction_state ) ) {
				return;
			}
			if ( ! is_interacting() && ! ( active_selection && active_selection.proposal ) ) {
				return;
			}
			interaction_state = 'cancelled';
			clear_review( true );
			review_error_base = null;
			pending_apply_result = null;
			apply_focus_operation = '';
			release_pointer_resources( true );
			document.removeEventListener( 'keydown', handle_interaction_keydown, true );
			clear_ghosts();
			if ( active_selection ) {
				clear_handle_offsets( active_selection.card );
				if ( active_selection.card && active_selection.card.classList ) {
					active_selection.card.classList.toggle( 'is-booking-resizing', false );
					active_selection.card.classList.toggle( 'is-booking-resize-dragging', false );
				}
				active_selection.proposal = null;
			}
			interaction_state = active_selection && active_selection.context ? 'ready' : 'idle';
			review_focus_target = null;
			if ( active_selection ) {
				announce( active_selection.card, 'escape' === reason ? ( i18n.cancelled || '' ) : '' );
			}
			if ( restore_focus && focus_target && focus_target.isConnected && 'function' === typeof focus_target.focus ) {
				focus_target.focus();
			}
		}

		/**
		 * Prepare for explicit Timeline replacement without DOM observation.
		 *
		 * @return {void}
		 */
		function begin_refresh() {
			var preserves_apply_success = pending_apply_result && 'refresh_pending' === interaction_state;

			presentation_generation += 1;
			if ( ! preserves_apply_success ) {
				cancel_interaction( false, 'window_replaced' );
				if ( active_selection && active_selection.is_external ) {
					reset_active_selection_eligibility();
				}
			} else {
				release_pointer_resources( false );
				clear_ghosts();
				clear_handle_offsets( active_selection ? active_selection.card : null );
				reset_active_selection_eligibility();
			}
			visible_segments = [];
			segment_records = new WeakMap();
			if ( ! active_selection ) {
				return;
			}
			clear_card( active_selection.card );
			active_selection.card = null;
			if ( eligibility_request ) {
				abort_request();
				active_selection.state = 'idle';
				active_selection.request_state = 'idle';
			}
		}

		/**
		 * Reconcile selected identity after explicit Timeline replacement.
		 *
		 * @param {Object} selection_state Timeline selection identity.
		 * @return {void}
		 */
		function complete_refresh( selection_state ) {
			var replacement_record = null;

			if ( ! active_selection || ! selection_state ) {
				return;
			}
			if ( Number( selection_state.booking_id || 0 ) !== active_selection.booking_id ) {
				clear_card( active_selection.card );
				abort_request();
				active_selection = null;
				interaction_state = 'idle';
				return;
			}
			if ( ! active_selection.card ) {
				visible_segments.some( function ( record ) {
					if ( record.booking_id === active_selection.booking_id && record.segment_id === String( selection_state.segment_hint || '' ) ) {
						replacement_record = record;
						return true;
					}
					return false;
				} );
				if ( ! replacement_record ) {
					visible_segments.some( function ( record ) {
						if ( record.booking_id === active_selection.booking_id ) {
							replacement_record = record;
							return true;
						}
						return false;
					} );
				}
				if ( replacement_record ) {
					active_selection.card = replacement_record.card;
					active_selection.segment_id = replacement_record.segment_id;
					active_selection.key = replacement_record.key;
					active_selection.visible_start = replacement_record.visible_start;
					active_selection.visible_end = replacement_record.visible_end;
					active_selection.show_start = replacement_record.show_start;
					active_selection.show_end = replacement_record.show_end;
					reset_active_selection_eligibility();
				}
			}
			if ( ! active_selection.card ) {
				return;
			}
			if ( 'ready' === active_selection.state && ! has_complete_handle_view_model( active_selection.handles ) ) {
				reset_active_selection_eligibility();
			}
			if ( 'idle' === active_selection.request_state ) {
				load_eligibility();
				return;
			}
			render_active_state();
		}

		/**
		 * Open canonical full Reschedule from keyboard activation only.
		 *
		 * @param {KeyboardEvent} event Keyboard event.
		 * @return {boolean} True when the handle owned the event.
		 */
		function activate_handle_from_keyboard( event ) {
			var handle = get_active_handle( event );
			if ( ! handle ) {
				return false;
			}
			event.preventDefault();
			event.stopPropagation();
			if ( callbacks && 'function' === typeof callbacks.open_full_reschedule ) {
				callbacks.open_full_reschedule( active_selection.card, handle );
			}
			return true;
		}

		/**
		 * Consume handle clicks so pointer input never opens the dialog.
		 *
		 * @param {MouseEvent} event Timeline click event.
		 * @return {boolean} True when a resize handle owned the event.
		 */
		function handle_click( event ) {
			var cancel = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-booking-resize-cancel]' ) : null;
			var fallback = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-booking-resize-fallback]' ) : null;
			var apply = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-booking-resize-apply]' ) : null;
			var retry_refresh = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-booking-resize-retry-refresh]' ) : null;
			var handle = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-booking-resize-handle]' ) : null;
			var card;
			var focus_target;
			if ( cancel ) {
				event.preventDefault();
				event.stopPropagation();
				cancel_interaction( true, 'review_cancel' );
				return true;
			}
			if ( fallback ) {
				event.preventDefault();
				event.stopPropagation();
				card = active_selection ? active_selection.card : null;
				focus_target = review_focus_target;
				cancel_interaction( false, 'review_fallback' );
				if ( card && callbacks && 'function' === typeof callbacks.open_full_reschedule ) {
					callbacks.open_full_reschedule( card, focus_target );
				}
				return true;
			}
			if ( apply ) {
				event.preventDefault();
				event.stopPropagation();
				request_apply();
				return true;
			}
			if ( retry_refresh ) {
				event.preventDefault();
				event.stopPropagation();
				refresh_after_apply();
				return true;
			}
			if ( ! handle ) {
				return false;
			}
			event.preventDefault();
			event.stopPropagation();
			if ( suppress_handle_click ) {
				suppress_handle_click = false;
			}
			return true;
		}

		/**
		 * Handle Enter or Space without a keyboard resize mode.
		 *
		 * @param {KeyboardEvent} event Timeline key event.
		 * @return {boolean} True when an active handle owned the event.
		 */
		function handle_keydown( event ) {
			if ( event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || -1 === [ 'Enter', ' ' ].indexOf( event.key ) ) {
				return false;
			}
			return activate_handle_from_keyboard( event );
		}

		/**
		 * Report whether pointer-preview state owns interaction attention.
		 *
		 * @return {boolean} True while pointer preview or Review owns attention.
		 */
		function is_interacting() {
			return -1 !== [ 'pointer_candidate', 'dragging', 'review_pending', 'review_ready', 'review_error', 'apply_pending', 'refresh_pending', 'refresh_error' ].indexOf( interaction_state );
		}

		/**
		 * Destroy all owned requests, listeners, frames, and presentation.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( is_destroyed ) {
				return;
			}
			is_destroyed = true;
			apply_generation += 1;
			mount.removeEventListener( 'pointerdown', handle_pointer_down, true );
			if ( -1 === [ 'apply_pending', 'refresh_pending' ].indexOf( interaction_state ) ) {
				cancel_interaction( false, 'destroyed' );
			} else {
				clear_review( false );
			}
			document.removeEventListener( 'keydown', handle_interaction_keydown, true );
			if ( active_selection ) {
				clear_card( active_selection.card );
			}
			clear_ghosts();
			abort_request();
			apply_request = null;
			pending_apply_result = null;
			active_selection = null;
			visible_segments = [];
			interaction_state = 'idle';
		}

		return {
			select: select,
			register_segment: register_segment,
			begin_refresh: begin_refresh,
			complete_refresh: complete_refresh,
			handle_click: handle_click,
			handle_keydown: handle_keydown,
			review_resize_proposal: review_resize_proposal,
			is_interacting: is_interacting,
			destroy: destroy
		};
	}

	window.wpbc_timeline_booking_resizing = window.wpbc_timeline_booking_resizing || {};
	window.wpbc_timeline_booking_resizing.create_controller = create_controller;
}( window, document ) );
