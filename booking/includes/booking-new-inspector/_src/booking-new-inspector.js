/**
 * Timeline host adapter for the Add New Booking Inspector editing shell.
 *
 * The canonical top-navigation link works without this adapter. When compiled and
 * enqueued, this source intercepts only the authorized stable marker, opens the
 * shared Inspector, and performs authenticated data-only bootstrap, schedule,
 * cost reads, signed Review, idempotent Apply, and host-owned Timeline readback.
 * Persistence remains server-authoritative and cannot be initiated by rendering.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, wp, $ ) {
	'use strict';

	var launch_selector = '[data-wpbc-booking-new-inspector-open]';
	var created_event_name = 'wpbc:booking-new-inspector:created';
	var timeline_readback_event_name = 'wpbc:booking-new-inspector:timeline-readback';
	var focus_created_event_name = 'wpbc:booking-new-inspector:focus-created';
	var controller = null;

	/**
	 * Resolve the bounded bootstrap envelope for one server-marked launch link.
	 *
	 * Selection links contribute only the opaque signed token already present in
	 * their canonical Add Booking URL. This adapter never decodes the token or
	 * derives dates and times from Timeline geometry.
	 *
	 * @param {Element} trigger       Authorized server-rendered launch anchor.
	 * @param {Object} configuration Executable-free domain configuration.
	 * @return {Object|null} Bootstrap launch values, or null to preserve navigation.
	 */
	function get_launch_request( trigger, configuration ) {
		var launch_context = trigger && 'function' === typeof trigger.getAttribute
			? String( trigger.getAttribute( 'data-wpbc-booking-new-inspector-open' ) || '' )
			: '';
		var launch_contexts = configuration.launch_contexts && 'object' === typeof configuration.launch_contexts
			? configuration.launch_contexts
			: {};
		var handoff_query_arg = String( configuration.handoff_query_arg || '' );
		var max_token_bytes = Number( configuration.max_context_token_bytes || 0 );
		var canonical_url;
		var source_context_token;

		if ( String( launch_contexts.toolbar || '' ) === launch_context ) {
			return { selection_source: 'empty' };
		}
		if (
			String( launch_contexts.timeline_selection || '' ) !== launch_context
			&& String( launch_contexts.timeline_time_rows || '' ) !== launch_context
		) {
			return null;
		}
		if ( ! handoff_query_arg || ! max_token_bytes || ! window.URL || ! trigger.href ) {
			return null;
		}

		try {
			canonical_url = new window.URL( trigger.href, window.location.href );
			source_context_token = String( canonical_url.searchParams.get( handoff_query_arg ) || '' );
		} catch ( error ) {
			return null;
		}

		if (
			! source_context_token
			|| max_token_bytes < source_context_token.length
			|| ! /^[A-Za-z0-9._-]+$/.test( source_context_token )
		) {
			return null;
		}

		return {
			selection_source: 'timeline',
			source_context_token: source_context_token
		};
	}

	/**
	 * Resolve one server-allow-listed WordPress template.
	 *
	 * @param {string} template_id Stable server-supplied template identifier.
	 * @return {Function|null} Template renderer or null.
	 */
	function get_template( template_id ) {
		return template_id && wp && 'function' === typeof wp.template ? wp.template( template_id ) : null;
	}

	/**
	 * Read bounded customer-field values rendered from authorized DTOs.
	 *
	 * The snapshot supports local dirty-state comparison only. It does not
	 * serialize markup, authorize values, or produce a server request payload.
	 *
	 * @param {Element|null} content_root Active domain content root.
	 * @return {Array<Object>} Ordered field keys with ordered scalar values.
	 */
	function get_customer_field_snapshot( content_root ) {
		var fields = [];
		var field_positions = {};
		var controls = content_root
			? content_root.querySelectorAll( '[data-wpbc-booking-new-inspector-field-input]' )
			: [];

		Array.prototype.forEach.call( controls, function ( control ) {
			var field_key = String( control.getAttribute( 'data-wpbc-booking-new-inspector-field-input' ) || '' );
			var field_record;

			if ( ! field_key ) {
				return;
			}
			if ( ! Object.prototype.hasOwnProperty.call( field_positions, field_key ) ) {
				field_positions[ field_key ] = fields.length;
				fields.push( { key: field_key, values: [] } );
			}
			field_record = fields[ field_positions[ field_key ] ];
			if ( 'checkbox' === control.type || 'radio' === control.type ) {
				if ( control.checked ) {
					field_record.values.push( String( control.value || '' ) );
				}
				return;
			}
			if ( control.multiple && control.options ) {
				Array.prototype.forEach.call( control.options, function ( option ) {
					if ( option.selected ) {
						field_record.values.push( String( option.value || '' ) );
					}
				} );
				return;
			}
			field_record.values.push( String( control.value || '' ) );
		} );

		return fields;
	}

	/**
	 * Read the exact authorized note controls rendered by the domain template.
	 *
	 * @param {Element|null} content_root Active domain content root.
	 * @return {Object} Note values keyed by their stable authorized type.
	 */
	function get_note_snapshot( content_root ) {
		var notes = {};
		var controls = content_root
			? content_root.querySelectorAll( '[data-wpbc-booking-new-inspector-note]' )
			: [];

		Array.prototype.forEach.call( controls, function ( control ) {
			var note_type = String( control.getAttribute( 'data-wpbc-booking-new-inspector-note' ) || '' );

			if ( 'public' === note_type || 'private' === note_type ) {
				notes[ note_type ] = String( control.value || '' );
			}
		} );

		return notes;
	}

	/**
	 * Return today's strict site-local calendar date without UTC date rollover.
	 *
	 * Empty top-navigation launches have no signed schedule seed. This value is
	 * presentation-only and tells the native calendar which month to display; it
	 * never selects a date or grants booking authority.
	 *
	 * The native calendar already receives WordPress's site-local date through
	 * `_wpbc.today_arr`. Reusing that value prevents an administrator's browser
	 * timezone from opening the adjacent month. The browser-local date remains a
	 * compatibility fallback when the established WordPress registry is absent.
	 *
	 * @return {string} Site-local YYYY-MM-DD date, or browser-local fallback.
	 */
	function get_today_calendar_anchor_date() {
		var today_parts = window._wpbc && 'function' === typeof window._wpbc.get_other_param
			? window._wpbc.get_other_param( 'today_arr' )
			: [];
		var site_year = Array.isArray( today_parts ) ? parseInt( today_parts[ 0 ], 10 ) : 0;
		var site_month = Array.isArray( today_parts ) ? parseInt( today_parts[ 1 ], 10 ) : 0;
		var site_day = Array.isArray( today_parts ) ? parseInt( today_parts[ 2 ], 10 ) : 0;
		var site_today = new Date( site_year, site_month - 1, site_day );
		var has_valid_site_today = site_year >= 1000
			&& site_month >= 1
			&& site_month <= 12
			&& site_day >= 1
			&& site_day <= 31
			&& site_today.getFullYear() === site_year
			&& site_today.getMonth() === site_month - 1
			&& site_today.getDate() === site_day;
		var today = has_valid_site_today ? site_today : new Date();
		var year = String( today.getFullYear() );
		var month = ( '0' + String( today.getMonth() + 1 ) ).slice( -2 );
		var day = ( '0' + String( today.getDate() ) ).slice( -2 );

		return year + '-' + month + '-' + day;
	}

	/**
	 * Read the current schedule's first date as a presentation-only month anchor.
	 *
	 * Resource and form changes discard the old signed Timeline authority. A
	 * bounded selected date keeps the replacement Resource calendar on the
	 * reviewed month while its schedule proposal is revalidated independently by
	 * the server. An empty draft returns to the current site-local month instead
	 * of letting the native calendar fall back to its oldest allowed past month.
	 *
	 * @param {Object|null} schedule_workflow Active creation schedule workflow.
	 * @return {string} Strict selected-date or site-today YYYY-MM-DD anchor.
	 */
	function get_schedule_calendar_anchor_date( schedule_workflow ) {
		var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft
			? schedule_workflow.get_draft()
			: null;
		var first_date = schedule && Array.isArray( schedule.selected_dates ) && schedule.selected_dates.length
			? String( schedule.selected_dates[ 0 ] || '' )
			: '';

		return /^\d{4}-\d{2}-\d{2}$/.test( first_date ) ? first_date : get_today_calendar_anchor_date();
	}

	/**
	 * Project the active schedule into the bounded direct-reload request shape.
	 *
	 * A Resource/form replacement cannot reuse a signed Timeline token because
	 * that token binds its original Resource. The current normalized dates and
	 * times may instead be proposed to the schedule endpoint, which repeats
	 * Resource/form authorization and policy validation before native availability
	 * hydrates the replacement calendar.
	 *
	 * @param {Object|null} schedule_workflow Active creation schedule workflow.
	 * @return {Object|null} Exact schedule fields, or null when unavailable/empty.
	 */
	function get_schedule_reload_draft( schedule_workflow ) {
		var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft
			? schedule_workflow.get_draft()
			: null;
		var selected_dates;

		if ( ! schedule || ! Array.isArray( schedule.selected_dates ) ) {
			return null;
		}
		selected_dates = schedule.selected_dates.filter( function ( selected_date ) {
			return 'string' === typeof selected_date && /^\d{4}-\d{2}-\d{2}$/.test( selected_date );
		} ).slice( 0 );
		if ( ! selected_dates.length ) {
			return null;
		}

		return {
			selection_method: 'individual' === schedule.selection_method ? 'individual' : 'policy',
			time_application: -1 !== [ 'full_day', 'boundary', 'per_date' ].indexOf( schedule.time_application ) ? schedule.time_application : 'full_day',
			selected_dates: selected_dates,
			start_time: 'string' === typeof schedule.start_time ? schedule.start_time : '',
			end_time: 'string' === typeof schedule.end_time ? schedule.end_time : ''
		};
	}

	/**
	 * Create the isolated Timeline Inspector adapter lazily.
	 *
	 * Delaying initialization until an authorized click ensures the Timeline
	 * shell and its domain host have already been rendered by the main runtime.
	 *
	 * @param {Object} configuration Authorized domain browser configuration.
	 * @return {Object|null} Adapter controller or null when contracts are absent.
	 */
	function create_controller( configuration ) {
		var timeline_root = document.querySelector( '[data-wpbc-timeline-component]' );
		// The Timeline controller owns the outer mount and these events do not bubble.
		var timeline_event_root = timeline_root
			? timeline_root.closest( '[data-wpbc-timeline-mount]' ) || timeline_root
			: null;
		var shell_host = timeline_root ? timeline_root.querySelector( '[data-wpbc-booking-new-inspector-host]' ) : null;
		var templates = configuration.templates && 'object' === typeof configuration.templates ? configuration.templates : {};
		var transport = configuration.transport && 'object' === typeof configuration.transport ? configuration.transport : {};
		var i18n = configuration.i18n && 'object' === typeof configuration.i18n ? configuration.i18n : {};
		var shared_template = get_template( configuration.shared_template );
		var shell_template = get_template( templates.shell );
		var header_template = get_template( templates.header );
		var resource_template = get_template( templates.resource );
		var fields_template = get_template( templates.fields );
		var field_template = get_template( templates.field );
		var notes_template = get_template( templates.notes );
		var dates_template = get_template( templates.dates );
		var costs_template = get_template( templates.costs );
		var footer_template = get_template( templates.footer );
		var review_template = get_template( templates.review );
		var created_template = get_template( templates.created );
		var state_template = get_template( templates.state );
		var unsupported_template = get_template( templates.unsupported_form );
		var shared_inspector;
		var shell_root;
		var shared_content_root;
		var pending_request = null;
		var pending_cost_request = null;
		var pending_review_request = null;
		var pending_apply_request = null;
		var pending_created_readback = null;
		var cost_preview_timer = null;
		var cost_preview_deferred = false;
		var cost_section_dismissed = false;
		var schedule_workflow = null;
		var active_content_root = null;
		var active_review_root = null;
		var active_review = null;
		var active_bootstrap = null;
		var active_fallback_url = configuration.canonical_url || '';
		var last_choices = {};
		var last_launch_request = { selection_source: 'empty' };
		var last_calendar_anchor_date = '';
		var last_schedule_draft = null;
		var request_generation = 0;
		var cost_request_generation = 0;
		var review_request_generation = 0;
		var apply_request_generation = 0;
		var request_sequence = 0;
		var readback_sequence = 0;
		var created_booking_id = 0;
		var draft_revision = 0;
		var schedule_ready = false;
		var customer_field_baseline = null;
		var note_baseline = null;
		var schedule_input_dirty = false;
		var cost_correction = '';
		var state = 'closed';
		var allowed_transitions = {
			closed: [ 'loading' ],
			loading: [ 'editing', 'error', 'closed' ],
			editing: [ 'loading', 'cost_preview', 'review', 'error', 'closed' ],
			cost_preview: [ 'editing', 'loading', 'review', 'error', 'closed' ],
			review: [ 'editing', 'applying', 'error', 'closed' ],
			applying: [ 'created', 'error' ],
			created: [ 'closed' ],
			error: [ 'loading', 'editing', 'review', 'applying', 'closed' ]
		};

		if (
			! timeline_root || ! shell_host || ! shared_template || ! shell_template || ! header_template
			|| ! resource_template || ! fields_template || ! field_template || ! notes_template || ! dates_template
			|| ! costs_template || ! footer_template || ! review_template || ! created_template || ! state_template || ! unsupported_template
			|| ! window.wpbc_shared_ui_inspector || 'function' !== typeof window.wpbc_shared_ui_inspector.create
			|| ! window.wpbc_booking_new_inspector || 'function' !== typeof window.wpbc_booking_new_inspector.create_schedule_workflow
			|| ! transport.url || ! transport.bootstrap_action || ! transport.bootstrap_nonce
			|| ! transport.schedule_action || ! transport.schedule_nonce
			|| ! transport.cost_action || ! transport.cost_nonce
			|| ! transport.review_action || ! transport.review_nonce
			|| ! transport.apply_action || ! transport.apply_nonce
		) {
			return null;
		}

		shell_host.innerHTML = shared_template( {
			id: configuration.component_id,
			title: i18n.title || '',
			close_label: i18n.close || '',
			loading_label: i18n.loading || ''
		} );
		shell_root = shell_host.querySelector( '[data-wpbc-shared-ui-inspector]' );
		if ( ! shell_root ) {
			return null;
		}
		shared_content_root = shell_root.querySelector( '[data-wpbc-shared-ui-inspector-content]' );
		if ( ! shared_content_root ) {
			return null;
		}
		shared_content_root.setAttribute( 'data-wpbc-booking-new-inspector-content', '' );

		/**
		 * Abort the active read and invalidate every older callback.
		 *
		 * @return {void}
		 */
		function abort_request() {
			request_generation += 1;
			if ( pending_request && 'function' === typeof pending_request.abort ) {
				pending_request.abort();
			}
			pending_request = null;
			if ( cost_preview_timer ) {
				window.clearTimeout( cost_preview_timer );
				cost_preview_timer = null;
			}
			cost_preview_deferred = false;
			cost_request_generation += 1;
			if ( pending_cost_request && 'function' === typeof pending_cost_request.abort ) {
				pending_cost_request.abort();
			}
			pending_cost_request = null;
			review_request_generation += 1;
			if ( pending_review_request && 'function' === typeof pending_review_request.abort ) {
				pending_review_request.abort();
			}
			pending_review_request = null;
			apply_request_generation += 1;
			if ( pending_apply_request && 'function' === typeof pending_apply_request.abort ) {
				pending_apply_request.abort();
			}
			pending_apply_request = null;
			pending_created_readback = null;
			created_booking_id = 0;
			if ( schedule_workflow ) {
				schedule_workflow.destroy();
			}
			schedule_workflow = null;
			active_content_root = null;
			active_review_root = null;
			active_review = null;
			active_bootstrap = null;
			draft_revision = 0;
			schedule_ready = false;
			customer_field_baseline = null;
			note_baseline = null;
			schedule_input_dirty = false;
			cost_correction = '';
			shell_root.setAttribute( 'data-wpbc-booking-new-inspector-dirty', 'false' );
		}

		/**
		 * Apply one allowed Inspector state transition.
		 *
		 * @param {string} next_state Stable next state.
		 * @return {boolean} True when the transition was accepted.
		 */
		function transition( next_state ) {
			if ( state === next_state ) {
				return true;
			}
			if ( ! allowed_transitions[ state ] || -1 === allowed_transitions[ state ].indexOf( next_state ) ) {
				return false;
			}
			state = next_state;
			if ( shell_root ) {
				shell_root.setAttribute( 'data-wpbc-booking-new-inspector-state', state );
			}

			return true;
		}

		/**
		 * Report whether customer fields or the creation schedule differ from seed.
		 *
		 * @return {boolean} True when closing or replacing the draft needs consent.
		 */
		function is_dirty() {
			var customer_fields_changed = null !== customer_field_baseline
				&& customer_field_baseline !== JSON.stringify( get_customer_field_snapshot( active_content_root ) );
			var notes_changed = null !== note_baseline
				&& note_baseline !== JSON.stringify( get_note_snapshot( active_content_root ) );
			var schedule_changed = schedule_workflow
				&& 'function' === typeof schedule_workflow.is_dirty
				&& schedule_workflow.is_dirty();

			return Boolean( customer_fields_changed || notes_changed || schedule_changed || schedule_input_dirty || '' !== cost_correction );
		}

		/**
		 * Expose the draft state to presentation and accessibility diagnostics.
		 *
		 * @return {void}
		 */
		function update_dirty_state() {
			shell_root.setAttribute( 'data-wpbc-booking-new-inspector-dirty', is_dirty() ? 'true' : 'false' );
		}

		/**
		 * Report whether the current authorized edition exposes Inspector pricing.
		 *
		 * @return {boolean} True only for Business Small or higher capability DTOs.
		 */
		function can_preview_cost() {
			return Boolean( active_bootstrap && active_bootstrap.edition_capabilities && active_bootstrap.edition_capabilities.cost_preview );
		}

		/**
		 * Invalidate any displayed or in-flight cost after a draft change.
		 *
		 * @return {void}
		 */
		function invalidate_cost_preview() {
			var cost_status;
			var cost_button;

			if ( cost_preview_timer ) {
				window.clearTimeout( cost_preview_timer );
				cost_preview_timer = null;
			}
			draft_revision += 1;
			cost_request_generation += 1;
			invalidate_review();
			if ( 'cost_preview' === state ) {
				transition( 'editing' );
			}
			if ( can_preview_cost() ) {
				cost_status = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-cost-status]' ) : null;
				if ( cost_status ) {
					cost_status.textContent = i18n.cost_stale || '';
				}
				cost_button = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-cost-preview]' ) : null;
				if ( cost_button ) {
					cost_button.disabled = false;
				}
			}
			if ( active_content_root && can_preview_cost() ) {
				active_content_root.setAttribute( 'data-wpbc-booking-new-inspector-cost-state', 'stale' );
			}
		}

		/**
		 * Queue one automatic non-mutating preview after the current draft settles.
		 *
		 * Dates, completed times, and Booking Form controls can emit several native
		 * events for one user action. A short debounce avoids redundant pricing reads.
		 * If an older read is already in flight, one trailing preview waits for it to
		 * settle; generation/revision guards ignore that older response without
		 * producing a browser-level aborted request.
		 *
		 * @param {number} delay_ms Debounce delay in milliseconds.
		 * @return {void}
		 */
		function queue_cost_preview( delay_ms ) {
			var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft
				? schedule_workflow.get_draft()
				: null;

			if ( cost_preview_timer ) {
				window.clearTimeout( cost_preview_timer );
				cost_preview_timer = null;
			}
			if (
				! active_content_root
				|| ! can_preview_cost()
				|| ! schedule_ready
				|| schedule_input_dirty
				|| ! schedule
				|| ! Array.isArray( schedule.selected_dates )
				|| ! schedule.selected_dates.length
			) {
				return;
			}

			cost_preview_timer = window.setTimeout( function () {
				cost_preview_timer = null;
				request_cost_preview();
			}, Math.max( 0, Number( delay_ms ) || 0 ) );
		}

		/**
		 * Invalidate any signed review after the local draft changes.
		 *
		 * @return {void}
		 */
		function invalidate_review() {
			review_request_generation += 1;
			if ( pending_review_request && 'function' === typeof pending_review_request.abort ) {
				pending_review_request.abort();
			}
			pending_review_request = null;
			active_review = null;
		}

		/**
		 * Confirm replacement or closure of one locally changed creation draft.
		 *
		 * @return {boolean} True when no draft is dirty or discard was confirmed.
		 */
		function confirm_discard_changes() {
			if ( 'applying' === state ) {
				return false;
			}
			if ( 'created' === state ) {
				return true;
			}
			if ( ! is_dirty() ) {
				return true;
			}

			return 'function' === typeof window.confirm
				&& window.confirm( i18n.discard_changes || '' );
		}

		/**
		 * Dispatch one executable-free creation readback request to the Timeline.
		 *
		 * Apply has already persisted and authoritatively read back the booking.
		 * This notification grants no mutation authority; it asks the host to reload
		 * its current window and reconcile the exact created booking ID.
		 *
		 * @param {Object} response_data Accepted Apply response DTO.
		 * @return {boolean} True when a browser event was dispatched.
		 */
		function request_timeline_readback( response_data ) {
			var booking = response_data && response_data.booking && 'object' === typeof response_data.booking
				? response_data.booking
				: {};
			var booking_id = Math.max( 0, Math.round( Number( booking.booking_id ) || 0 ) );
			var resource_id = Math.max( 0, Math.round( Number( booking.resource_id ) || 0 ) );
			var source_context_token = String( last_launch_request.source_context_token || '' );
			var event_detail;
			var created_event;

			if ( ! booking_id || ! resource_id ) {
				return false;
			}
			readback_sequence += 1;
			event_detail = {
				schema_version: Number( configuration.schema_version ) || 1,
				request_id: String( response_data.request_id || 'created' ) + '-timeline-' + String( readback_sequence ),
				apply_request_id: String( response_data.request_id || '' ),
				booking_id: booking_id,
				resource_id: resource_id,
				source_context_token: source_context_token,
				handoff_query_arg: String( configuration.handoff_query_arg || '' ),
				open_booking_inspector: true === configuration.open_created_booking_inspector
			};
			pending_created_readback = {
				request_id: event_detail.request_id,
				response: response_data
			};
			if ( 'function' === typeof window.CustomEvent ) {
				created_event = new window.CustomEvent( created_event_name, { detail: event_detail } );
			} else if ( document.createEvent ) {
				created_event = document.createEvent( 'CustomEvent' );
				created_event.initCustomEvent( created_event_name, false, false, event_detail );
			}
			if ( ! created_event ) {
				return false;
			}
			timeline_event_root.dispatchEvent( created_event );

			return true;
		}

		/**
		 * Ask Timeline to focus the authoritative created card after shell closure.
		 *
		 * @param {number} booking_id Positive authoritative booking ID.
		 * @return {void}
		 */
		function request_created_booking_focus( booking_id ) {
			var focus_event;

			booking_id = Math.max( 0, Math.round( Number( booking_id ) || 0 ) );
			if ( ! booking_id ) {
				return;
			}
			if ( 'function' === typeof window.CustomEvent ) {
				focus_event = new window.CustomEvent( focus_created_event_name, {
					detail: { schema_version: 1, booking_id: booking_id }
				} );
			} else if ( document.createEvent ) {
				focus_event = document.createEvent( 'CustomEvent' );
				focus_event.initCustomEvent( focus_created_event_name, false, false, { schema_version: 1, booking_id: booking_id } );
			}
			if ( focus_event ) {
				timeline_event_root.dispatchEvent( focus_event );
			}
		}

		/**
		 * Reconcile the creation Inspector after Timeline's host-owned readback.
		 *
		 * A failed host refresh is a persisted-success warning, never an Apply
		 * failure. Retry requests only reload Timeline and cannot create a duplicate.
		 *
		 * @param {CustomEvent} event Timeline readback completion event.
		 * @return {void}
		 */
		function handle_timeline_readback( event ) {
			var detail = event && event.detail && 'object' === typeof event.detail ? event.detail : {};
			var status = shared_content_root
				? shared_content_root.querySelector( '[data-wpbc-booking-new-inspector-readback-status]' )
				: null;
			var retry = shared_content_root
				? shared_content_root.querySelector( '[data-wpbc-booking-new-inspector-readback-retry]' )
				: null;

			if (
				'created' !== state
				|| ! pending_created_readback
				|| 1 !== Number( detail.schema_version )
				|| created_booking_id !== Math.max( 0, Math.round( Number( detail.booking_id ) || 0 ) )
				|| String( detail.request_id || '' ) !== pending_created_readback.request_id
			) {
				return;
			}
			if ( 'accepted' === detail.state ) {
				pending_created_readback = null;
				if ( status ) {
					status.removeAttribute( 'role' );
					status.textContent = true === detail.booking_visible
						? i18n.timeline_refreshed || ''
						: i18n.timeline_record_not_visible || '';
				}
				if ( retry ) {
					retry.hidden = true;
				}
				shared_inspector.close( false );
				return;
			}
			if ( 'failed' !== detail.state ) {
				return;
			}
			if ( status ) {
				status.setAttribute( 'role', 'alert' );
				status.textContent = i18n.timeline_refresh_failed || '';
			}
			if ( retry ) {
				retry.hidden = false;
				retry.focus();
			}
		}

		/**
		 * Build a bounded browser correlation identifier.
		 *
		 * @return {string} Request ID accepted by the server contract.
		 */
		function create_request_id() {
			request_sequence += 1;

			return 'timeline-launch-' + Date.now().toString( 36 ) + '-' + request_sequence.toString( 36 );
		}

		/**
		 * Render one domain-owned loading, empty, or error state.
		 *
		 * @param {string}  state_id Stable state identifier.
		 * @param {string}  title    Localized state title.
		 * @param {string}  message  Localized safe state message.
		 * @param {boolean} retry    Whether a read-only retry is available.
		 * @return {void}
		 */
		function render_state( state_id, title, message, retry ) {
			shared_inspector.set_state( state_template( {
				state: state_id,
				title: title,
				message: message,
				retry: Boolean( retry ),
				url: 'loading' === state_id ? '' : active_fallback_url,
				i18n: i18n
			} ), message, 'loading' === state_id );
		}

		/**
		 * Resolve the rendered nodes for one exact server-authorized field key.
		 *
		 * Attribute values are compared as strings instead of interpolated into a
		 * selector, so a malformed response cannot become executable selector text.
		 *
		 * @param {string} field_key Exact field key returned by server validation.
		 * @return {Object} Matching field row, controls, fieldset, and error node.
		 */
		function get_field_feedback_nodes( field_key ) {
			var feedback = { field: null, controls: [], fieldset: null, error: null };

			field_key = String( field_key || '' );
			if ( ! active_content_root || ! field_key ) {
				return feedback;
			}
			Array.prototype.some.call( active_content_root.querySelectorAll( '[data-wpbc-booking-new-inspector-field]' ), function ( field ) {
				if ( field_key !== String( field.getAttribute( 'data-wpbc-booking-new-inspector-field' ) || '' ) ) {
					return false;
				}
				feedback.field = field;
				feedback.controls = Array.prototype.slice.call( field.querySelectorAll( '[data-wpbc-booking-new-inspector-field-input]' ) );
				feedback.fieldset = field.querySelector( 'fieldset' );
				feedback.error = field.querySelector( '[data-wpbc-booking-new-inspector-field-error]' );

				return true;
			} );

			return feedback;
		}

		/**
		 * Clear one rendered validation error after the exact field changes.
		 *
		 * @param {string} field_key Exact rendered field key.
		 * @return {boolean} True when visible feedback was cleared.
		 */
		function clear_field_error( field_key ) {
			var feedback = get_field_feedback_nodes( field_key );
			var had_error = Boolean( feedback.error && ! feedback.error.hidden );

			feedback.controls.forEach( function ( control ) {
				control.removeAttribute( 'aria-invalid' );
			} );
			if ( feedback.fieldset ) {
				feedback.fieldset.removeAttribute( 'aria-invalid' );
			}
			if ( feedback.field ) {
				feedback.field.classList.remove( 'has-error' );
			}
			if ( feedback.error ) {
				feedback.error.textContent = '';
				feedback.error.hidden = true;
			}

			return had_error;
		}

		/**
		 * Clear all Review validation feedback before a new authoritative request.
		 *
		 * @return {void}
		 */
		function clear_review_errors() {
			var review_error = active_content_root
				? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-review-error]' )
				: null;

			Array.prototype.forEach.call( active_content_root ? active_content_root.querySelectorAll( '[data-wpbc-booking-new-inspector-field-error]' ) : [], function ( error_node ) {
				clear_field_error( error_node.getAttribute( 'data-wpbc-booking-new-inspector-field-error' ) );
			} );
			if ( review_error ) {
				review_error.hidden = true;
				if ( review_error.querySelector( 'p' ) ) {
					review_error.querySelector( 'p' ).textContent = '';
				}
			}
		}

		/**
		 * Clear feedback for the customer control currently being corrected.
		 *
		 * The summary remains visible while any other rejected field is unresolved.
		 *
		 * @param {Element|null} control Changed customer control.
		 * @return {void}
		 */
		function clear_control_error( control ) {
			var field_key;
			var review_error;

			if ( ! control || ! active_content_root ) {
				return;
			}
			field_key = String( control.getAttribute( 'data-wpbc-booking-new-inspector-field-input' ) || '' );
			if ( ! clear_field_error( field_key ) ) {
				return;
			}
			if (
				active_content_root.querySelector( '[data-wpbc-booking-new-inspector-field-error]:not([hidden])' )
				|| active_content_root.querySelector( '[data-wpbc-booking-new-inspector-schedule-error]:not([hidden])' )
			) {
				return;
			}
			review_error = active_content_root.querySelector( '[data-wpbc-booking-new-inspector-review-error]' );
			if ( review_error ) {
				review_error.hidden = true;
			}
		}

		/**
		 * Render bounded server field errors and focus the first rejected control.
		 *
		 * Unknown keys remain covered by the safe summary and are never rendered as
		 * selectors or markup. Exact messages are assigned with textContent only.
		 *
		 * @param {Object|null}  error_data      Normalized server or local readiness error response.
		 * @param {Element|null} fallback_target Optional safe rendered target when no field matches.
		 * @return {boolean} True when at least one exact rendered field was rejected.
		 */
		function render_review_errors( error_data, fallback_target ) {
			var field_errors = error_data && Array.isArray( error_data.field_errors ) ? error_data.field_errors : [];
			var review_error = active_content_root
				? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-review-error]' )
				: null;
			var first_control = null;
			var first_field = null;
			var seen_fields = {};
			var matched_error = false;

			clear_review_errors();
			if ( review_error ) {
				review_error.hidden = false;
				if ( review_error.querySelector( 'p' ) ) {
					review_error.querySelector( 'p' ).textContent = String( error_data && error_data.message ? error_data.message : i18n.review_failed || '' );
				}
			}
			field_errors.forEach( function ( field_error ) {
				var field_key = field_error && field_error.key ? String( field_error.key ) : '';
				var message = field_error && field_error.message ? String( field_error.message ) : '';
				var feedback;

				if ( ! field_key || ! message || Object.prototype.hasOwnProperty.call( seen_fields, field_key ) ) {
					return;
				}
				seen_fields[ field_key ] = true;
				feedback = get_field_feedback_nodes( field_key );
				if ( ! feedback.field || ! feedback.error ) {
					return;
				}
				matched_error = true;
				feedback.field.classList.add( 'has-error' );
				feedback.error.textContent = message;
				feedback.error.hidden = false;
				feedback.controls.forEach( function ( control ) {
					control.setAttribute( 'aria-invalid', 'true' );
					if ( ! first_control && ! control.disabled && 'function' === typeof control.focus ) {
						first_control = control;
					}
				} );
				if ( feedback.fieldset ) {
					feedback.fieldset.setAttribute( 'aria-invalid', 'true' );
				}
				first_field = first_field || feedback.field;
			} );

			( window.requestAnimationFrame || function ( callback ) {
				window.setTimeout( callback, 0 );
			} )( function () {
				var scroll_target = first_field || fallback_target || review_error;
				var focus_target = first_control || fallback_target || review_error;
				var reduced_motion = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

				if ( scroll_target && 'function' === typeof scroll_target.scrollIntoView ) {
					try {
						scroll_target.scrollIntoView( { behavior: reduced_motion ? 'auto' : 'smooth', block: 'center' } );
					} catch ( scroll_error ) {
						scroll_target.scrollIntoView();
					}
				}
				if ( focus_target && 'function' === typeof focus_target.focus ) {
					try {
						focus_target.focus( { preventScroll: true } );
					} catch ( focus_error ) {
						focus_target.focus();
					}
				}
			} );

			return matched_error;
		}

		/**
		 * Build presentation-only errors for empty required controls.
		 *
		 * This preflight is used only when an incomplete schedule prevents the
		 * authoritative Review request from being constructed. Every request that
		 * reaches the server still reruns the complete exact-form validator.
		 *
		 * @return {Array<Object>} Ordered exact field-error DTOs for empty required controls.
		 */
		function get_missing_required_field_errors() {
			var field_snapshots = get_customer_field_snapshot( active_content_root );
			var values_by_key = {};
			var authorized_fields = active_bootstrap && Array.isArray( active_bootstrap.fields ) ? active_bootstrap.fields : [];
			var field_errors = [];

			field_snapshots.forEach( function ( field_snapshot ) {
				values_by_key[ String( field_snapshot.key || '' ) ] = Array.isArray( field_snapshot.values ) ? field_snapshot.values : [];
			} );
			authorized_fields.forEach( function ( field_contract ) {
				var field_key = field_contract && field_contract.key ? String( field_contract.key ) : '';
				var field_values = Object.prototype.hasOwnProperty.call( values_by_key, field_key ) ? values_by_key[ field_key ] : [];
				var has_value = field_values.some( function ( field_value ) {
					return '' !== String( field_value || '' ).trim();
				} );

				if ( ! field_key || true !== field_contract.required || has_value ) {
					return;
				}
				field_errors.push( {
					key: field_key,
					code: 'required',
					message: i18n.field_required || ''
				} );
			} );

			return field_errors;
		}

		/**
		 * Explain why Review cannot yet construct its authoritative request.
		 *
		 * @return {void}
		 */
		function render_review_readiness_errors() {
			var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft ? schedule_workflow.get_draft() : null;
			var has_selected_dates = Boolean( schedule && Array.isArray( schedule.selected_dates ) && schedule.selected_dates.length );
			var field_errors = get_missing_required_field_errors();
			var schedule_message = has_selected_dates ? i18n.schedule_not_ready || '' : i18n.schedule_required || '';
			var review_message = ! has_selected_dates && field_errors.length ? i18n.review_incomplete || '' : schedule_message;
			var schedule_error;

			set_schedule_error( true, schedule_message );
			schedule_error = active_content_root
				? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-schedule-error]' )
				: null;
			render_review_errors( {
				message: review_message,
				field_errors: field_errors
			}, schedule_error );
		}

		/**
		 * Synchronize schedule controls and selected-date overview from one draft.
		 *
		 * @param {Object} schedule Current normalized non-mutating schedule draft.
		 * @return {void}
		 */
		function synchronize_schedule( schedule, change_context ) {
			var selected_dates = schedule && Array.isArray( schedule.selected_dates ) ? schedule.selected_dates : [];
			var dates_list = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-selected-dates]' ) : null;
			var selected_count = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-selected-count]' ) : null;
			var time_row = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-time-row]' ) : null;
			var start_time = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-start-time]' ) : null;
			var end_time = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-end-time]' ) : null;
			var reset_button = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-schedule-reset]' ) : null;
			var review_error;

			if ( selected_count ) {
				selected_count.textContent = String( selected_dates.length );
			}
			if ( dates_list ) {
				dates_list.textContent = '';
				( selected_dates.length ? selected_dates : [ i18n.no_dates || '' ] ).forEach( function ( selected_date ) {
					var date_entry = document.createElement( 'li' );
					date_entry.textContent = String( selected_date );
					dates_list.appendChild( date_entry );
				} );
			}
			if ( time_row ) {
				time_row.hidden = 'full_day' === schedule.time_application;
			}
			if ( start_time ) {
				start_time.value = schedule.start_time || '';
			}
			if ( end_time ) {
				end_time.value = schedule.end_time || '';
			}
			if ( reset_button ) {
				reset_button.disabled = ! selected_dates.length;
			}
			if ( selected_dates.length ) {
				set_schedule_error( false );
				if (
					active_content_root
					&& ! active_content_root.querySelector( '[data-wpbc-booking-new-inspector-field-error]:not([hidden])' )
				) {
					review_error = active_content_root.querySelector( '[data-wpbc-booking-new-inspector-review-error]' );

					if ( review_error ) {
						review_error.hidden = true;
					}
				}
			}
			Array.prototype.forEach.call( active_content_root ? active_content_root.querySelectorAll( '[data-wpbc-booking-new-inspector-selection-method]' ) : [], function ( control ) {
				control.checked = control.value === schedule.selection_method;
			} );
			Array.prototype.forEach.call( active_content_root ? active_content_root.querySelectorAll( '[data-wpbc-booking-new-inspector-time-application]' ) : [], function ( control ) {
				control.checked = control.value === schedule.time_application;
			} );
			if ( ! schedule_ready ) {
				schedule_ready = true;
			} else if ( ! change_context || change_context.is_dirty ) {
				invalidate_cost_preview();
			}
			update_dirty_state();
			queue_cost_preview( 250 );
		}

		/**
		 * Apply visible time inputs to the bounded schedule draft when complete.
		 *
		 * A partial or invalid local time remains presentation-only, but still marks
		 * the Inspector dirty so Escape or Cancel cannot discard it silently.
		 *
		 * @return {void}
		 */
		function update_schedule_times() {
			var start_time = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-start-time]' ) : null;
			var end_time = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-end-time]' ) : null;
			var accepted = schedule_workflow && start_time && end_time
				? schedule_workflow.set_times( start_time.value, end_time.value )
				: false;

			schedule_input_dirty = ! accepted;
			update_dirty_state();
		}

		/**
		 * Update the native-calendar loading presentation without replacing content.
		 *
		 * @param {boolean} is_loading Whether the schedule workflow is loading.
		 * @return {void}
		 */
		function set_schedule_loading( is_loading ) {
			var calendar_host = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-calendar-host]' ) : null;
			var status_host = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-schedule-status]' ) : null;
			var reset_button = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-schedule-reset]' ) : null;
			var selected_count = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-selected-count]' ) : null;
			var schedule_controls = active_content_root ? active_content_root.querySelectorAll(
				'[data-wpbc-booking-new-inspector-selection-method], '
				+ '[data-wpbc-booking-new-inspector-time-application], '
				+ '[data-wpbc-booking-new-inspector-start-time], '
				+ '[data-wpbc-booking-new-inspector-end-time]'
			) : [];

			if ( calendar_host ) {
				calendar_host.setAttribute( 'aria-busy', is_loading ? 'true' : 'false' );
			}
			if ( status_host ) {
				status_host.textContent = is_loading ? i18n.loading_schedule || '' : '';
			}
			if ( reset_button ) {
				reset_button.disabled = is_loading || ! selected_count || '0' === selected_count.textContent;
			}
			Array.prototype.forEach.call( schedule_controls, function ( control ) {
				control.disabled = Boolean( is_loading );
			} );
		}

		/**
		 * Show or clear the local schedule-read error state.
		 *
		 * @param {boolean} has_error Whether a schedule read or Review readiness check failed.
		 * @param {string}  message   Optional plain-text error message.
		 * @return {void}
		 */
		function set_schedule_error( has_error, message ) {
			var error_host = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-schedule-error]' ) : null;
			var reset_button = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-schedule-reset]' ) : null;
			var error_message = error_host ? error_host.querySelector( 'p' ) : null;

			if ( error_host ) {
				error_host.hidden = ! has_error;
			}
			if ( error_message ) {
				error_message.textContent = has_error ? String( message || i18n.schedule_failed || '' ) : '';
			}
			if ( has_error && reset_button ) {
				reset_button.disabled = true;
			}
		}

		/**
		 * Map bounded server field errors to authorized plain-text cost messages.
		 *
		 * Cost preview must never build selectors from rejected keys or expose raw
		 * field metadata. Exact Bootstrap labels are used when available; all other
		 * errors retain only their safe server message.
		 *
		 * @param {Object|null} error_data Normalized cost error response.
		 * @return {Array<string>} Ordered visible validation messages.
		 */
		function get_cost_validation_messages( error_data ) {
			var field_errors = error_data && Array.isArray( error_data.field_errors ) ? error_data.field_errors : [];
			var authorized_fields = active_bootstrap && Array.isArray( active_bootstrap.fields ) ? active_bootstrap.fields : [];
			var labels_by_key = {};

			authorized_fields.forEach( function ( field_contract ) {
				var field_key = field_contract && field_contract.key ? String( field_contract.key ) : '';

				if ( field_key ) {
					labels_by_key[ field_key ] = String( field_contract.label || i18n.booking_details || '' );
				}
			} );

			return field_errors.slice( 0, 20 ).map( function ( field_error ) {
				var field_key = field_error && field_error.key ? String( field_error.key ) : '';
				var message = field_error && field_error.message ? String( field_error.message ) : '';
				var field_label = Object.prototype.hasOwnProperty.call( labels_by_key, field_key ) ? labels_by_key[ field_key ] : '';

				return field_label && message ? field_label + ': ' + message : message;
			} ).filter( function ( message ) {
				return Boolean( message );
			} );
		}

		/**
		 * Render one server-authoritative cost DTO without trusting markup.
		 *
		 * @param {Object}        cost_dto           Current cost DTO.
		 * @param {Object|null}   fallback           Optional canonical fallback DTO.
		 * @param {Array<string>} validation_messages Optional bounded validation messages.
		 * @return {void}
		 */
		function render_cost( cost_dto, fallback, validation_messages ) {
			var costs_host = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-costs-host]' ) : null;
			var restore_cost_focus;
			var next_cost_button;

			if ( ! costs_host ) {
				return;
			}
			if ( cost_section_dismissed ) {
				costs_host.hidden = true;
				costs_host.innerHTML = '';
				return;
			}
			costs_host.hidden = false;
			restore_cost_focus = Boolean(
				document.activeElement
				&& 'function' === typeof document.activeElement.closest
				&& document.activeElement.closest( '[data-wpbc-booking-new-inspector-cost-preview]' )
			);
			costs_host.innerHTML = costs_template( {
				cost: cost_dto || {},
				fallback: fallback || null,
				upgrade_required: ! can_preview_cost(),
				correction_allowed: Boolean( active_bootstrap && active_bootstrap.edition_capabilities && active_bootstrap.edition_capabilities.cost_correction ),
				correction_value: cost_correction,
				validation_messages: Array.isArray( validation_messages ) ? validation_messages : [],
				i18n: i18n
			} );
			active_content_root.setAttribute( 'data-wpbc-booking-new-inspector-cost-state', String( cost_dto && cost_dto.status ? cost_dto.status : 'unavailable' ) );
			if ( restore_cost_focus ) {
				next_cost_button = costs_host.querySelector( '[data-wpbc-booking-new-inspector-cost-preview]' );
				if ( next_cost_button && 'function' === typeof next_cost_button.focus ) {
					next_cost_button.focus();
				}
			}
		}

		/**
		 * Build the exact structured draft sent to the authenticated cost service.
		 *
		 * @return {Object|null} Draft request or null before schedule hydration.
		 */
		function get_draft_request() {
			var schedule = schedule_workflow && 'function' === typeof schedule_workflow.get_draft ? schedule_workflow.get_draft() : null;

			if (
				! active_bootstrap
				|| ! schedule
				|| ! schedule_ready
				|| schedule_input_dirty
				|| ! Array.isArray( schedule.selected_dates )
				|| ! schedule.selected_dates.length
			) {
				return null;
			}

			return {
				schema_version: configuration.schema_version,
				request_id: create_request_id(),
				resource_id: active_bootstrap.selected_resource_id,
				form_id: active_bootstrap.selected_form_id,
				form_source: active_bootstrap.form_source,
				selection_source: last_launch_request.selection_source || 'empty',
				source_context_token: last_launch_request.source_context_token || '',
				schedule: {
					selection_method: schedule.selection_method,
					time_application: schedule.time_application,
					selected_dates: Array.isArray( schedule.selected_dates ) ? schedule.selected_dates.slice( 0 ) : [],
					start_time: schedule.start_time || '',
					end_time: schedule.end_time || ''
				},
				fields: get_customer_field_snapshot( active_content_root ),
				notes: get_note_snapshot( active_content_root ),
				email_intent: 'canonical_default',
				cost_intent: '' === cost_correction ? 'canonical' : 'corrected',
				corrected_cost: cost_correction,
				draft_revision: draft_revision
			};
		}

		/**
		 * Request a current non-mutating cost preview for the exact local revision.
		 *
		 * @return {void}
		 */
		function request_cost_preview() {
			var request_values = get_draft_request();
			var current_generation;
			var requested_revision;
			var cost_status;
			var cost_button;
			var cost_request;

			if ( ! can_preview_cost() ) {
				return;
			}
			if ( cost_preview_timer ) {
				window.clearTimeout( cost_preview_timer );
				cost_preview_timer = null;
			}
			if ( ! request_values ) {
				cost_status = active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-cost-status]' ) : null;
				if ( cost_status ) {
					cost_status.textContent = i18n.cost_failed || '';
				}
				return;
			}
			if ( pending_cost_request ) {
				cost_preview_deferred = true;
				return;
			}

			cost_request_generation += 1;
			current_generation = cost_request_generation;
			requested_revision = request_values.draft_revision;
			cost_preview_deferred = false;
			cost_status = active_content_root.querySelector( '[data-wpbc-booking-new-inspector-cost-status]' );
			cost_button = active_content_root.querySelector( '[data-wpbc-booking-new-inspector-cost-preview]' );
			if ( cost_status ) {
				cost_status.textContent = i18n.calculating_cost || '';
			}
			if ( cost_button ) {
				cost_button.disabled = true;
			}
			active_content_root.setAttribute( 'data-wpbc-booking-new-inspector-cost-state', 'loading' );

			cost_request = $.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.cost_action,
					nonce: transport.cost_nonce,
					request: JSON.stringify( request_values )
				}
			} );
			pending_cost_request = cost_request;
			cost_request.done( function ( response ) {
				var response_data = response && true === response.success ? response.data : null;

				if ( current_generation !== cost_request_generation || requested_revision !== draft_revision || ! active_content_root ) {
					return;
				}
				if ( ! response_data || response_data.request_id !== request_values.request_id || response_data.draft_revision !== requested_revision ) {
					transition( 'editing' );
					render_cost( { status: 'stale', message: i18n.cost_stale || '', line_items: [] }, null );
					return;
				}
				if ( 'cost_preview' === response_data.state ) {
					transition( 'cost_preview' );
					render_cost( response_data.cost || {}, null, response_data.warnings || [] );
				} else {
					transition( 'editing' );
					render_cost( response_data.cost || {}, response_data.fallback || null, response_data.warnings || [] );
				}
			} ).fail( function ( failed_request, request_status ) {
				var error_data;
				var review_button;

				if ( 'abort' === request_status || current_generation !== cost_request_generation || requested_revision !== draft_revision || ! active_content_root ) {
					return;
				}
				error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
				transition( 'editing' );
				render_cost(
					{ status: 'unavailable', message: error_data && error_data.message ? error_data.message : i18n.cost_failed || '', line_items: [] },
					null,
					get_cost_validation_messages( error_data )
				);
			} ).always( function () {
				var request_latest_preview = cost_preview_deferred;

				if ( pending_cost_request === cost_request ) {
					pending_cost_request = null;
				}
				cost_preview_deferred = false;
				if ( request_latest_preview ) {
					queue_cost_preview( 0 );
				}
			} );
		}

		/**
		 * Request a current signed non-mutating Review for the exact local revision.
		 *
		 * @return {void}
		 */
		function request_review() {
			var request_values;
			var current_generation;
			var requested_revision;
			var review_button;

			if ( ! active_content_root ) {
				return;
			}
			request_values = get_draft_request();
			if ( ! request_values ) {
				clear_review_errors();
				render_review_readiness_errors();
				return;
			}
			review_request_generation += 1;
			current_generation = review_request_generation;
			requested_revision = request_values.draft_revision;
			if ( pending_review_request && 'function' === typeof pending_review_request.abort ) {
				pending_review_request.abort();
			}
			clear_review_errors();
			review_button = active_content_root.querySelector( '[data-wpbc-booking-new-inspector-review]' );
			if ( review_button ) {
				review_button.disabled = true;
				review_button.setAttribute( 'aria-busy', 'true' );
			}

			pending_review_request = $.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.review_action,
					nonce: transport.review_nonce,
					request: JSON.stringify( request_values )
				}
			} ).done( function ( response ) {
				var response_data = response && true === response.success ? response.data : null;
				var review_cancel;

				if ( current_generation !== review_request_generation || requested_revision !== draft_revision || ! active_content_root ) {
					return;
				}
				pending_review_request = null;
				if ( ! response_data || response_data.request_id !== request_values.request_id || 'review' !== response_data.state ) {
					if ( review_button ) {
						review_button.disabled = false;
						review_button.removeAttribute( 'aria-busy' );
					}
					return;
				}
				if ( ! transition( 'review' ) ) {
					return;
				}
				active_review = response_data;
				active_content_root.hidden = true;
				shared_content_root.insertAdjacentHTML( 'beforeend', review_template( { review: response_data.review || {}, i18n: i18n } ) );
				active_review_root = shared_content_root.querySelector( '[data-wpbc-booking-new-inspector-review-view]' );
				review_cancel = active_review_root ? active_review_root.querySelector( '[data-wpbc-booking-new-inspector-review-cancel]' ) : null;
				if ( review_cancel && 'function' === typeof review_cancel.focus ) {
					review_cancel.focus();
				}
			} ).fail( function ( failed_request, request_status ) {
				var error_data;
				var has_field_errors;

				if ( 'abort' === request_status || current_generation !== review_request_generation || requested_revision !== draft_revision || ! active_content_root ) {
					return;
				}
				pending_review_request = null;
				error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
				if ( review_button ) {
					review_button.disabled = false;
					review_button.removeAttribute( 'aria-busy' );
				}
				if ( error_data && error_data.fallback && error_data.fallback.url ) {
					active_fallback_url = error_data.fallback.url;
				}
				has_field_errors = render_review_errors( error_data );
				if ( ! has_field_errors ) {
					render_cost( { status: 'unavailable', message: error_data && error_data.message ? error_data.message : i18n.review_failed || '', line_items: [] }, error_data ? error_data.fallback : null );
				}
			} );
		}

		/**
		 * Return from signed Review to the exact retained editing draft.
		 *
		 * @return {void}
		 */
		function cancel_review() {
			var review_button;

			if ( 'review' !== state || ! active_content_root ) {
				return;
			}
			if ( active_review_root && active_review_root.parentNode ) {
				active_review_root.parentNode.removeChild( active_review_root );
			}
			active_review_root = null;
			active_review = null;
			active_content_root.hidden = false;
			transition( 'editing' );
			review_button = active_content_root.querySelector( '[data-wpbc-booking-new-inspector-review]' );
			if ( review_button ) {
				review_button.disabled = false;
				review_button.removeAttribute( 'aria-busy' );
				if ( 'function' === typeof review_button.focus ) {
					review_button.focus();
				}
			}
		}

		/**
		 * Apply the exact signed Review through the idempotent server boundary.
		 *
		 * @return {void}
		 */
		function apply_review() {
			var apply_button;
			var apply_message;
			var previous_apply_message;
			var request_values;
			var current_generation;

			if ( 'review' !== state || ! active_review || ! active_review_root ) {
				return;
			}
			request_values = {
				schema_version: configuration.schema_version,
				request_id: create_request_id(),
				plan: active_review.plan,
				token: active_review.token,
				idempotency_key: active_review.idempotency_key
			};
			apply_request_generation += 1;
			current_generation = apply_request_generation;
			apply_button = active_review_root.querySelector( '[data-wpbc-booking-new-inspector-create]' );
			if ( apply_button ) {
				apply_button.disabled = true;
				apply_button.setAttribute( 'aria-busy', 'true' );
			}
			previous_apply_message = active_review_root.querySelector( '.wpbc_booking_new_inspector__apply_status' );
			if ( previous_apply_message ) {
				previous_apply_message.remove();
			}
			apply_message = document.createElement( 'p' );
			apply_message.className = 'wpbc_booking_new_inspector__apply_status';
			apply_message.setAttribute( 'role', 'status' );
			apply_message.textContent = i18n.creating_booking || '';
			active_review_root.querySelector( '.wpbc_booking_new_inspector__footer_actions' ).insertBefore( apply_message, active_review_root.querySelector( '.wpbc_booking_new_inspector__footer_actions' ).firstChild );
			if ( ! transition( 'applying' ) ) {
				return;
			}

			pending_apply_request = $.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.apply_action,
					nonce: transport.apply_nonce,
					request: JSON.stringify( request_values )
				}
			} ).done( function ( response ) {
				var response_data = response && true === response.success ? response.data : null;
				var created_status;
				var readback_status;
				var readback_retry;

				if ( current_generation !== apply_request_generation || ! response_data || request_values.request_id !== response_data.request_id || 'created' !== response_data.state ) {
					return;
				}
				pending_apply_request = null;
				if ( ! transition( 'created' ) ) {
					return;
				}
				created_booking_id = Math.max( 0, Math.round( Number( response_data.booking && response_data.booking.booking_id ) || 0 ) );
				active_review_root.remove();
				active_review_root = null;
				active_review = null;
				if ( schedule_workflow ) {
					schedule_workflow.destroy();
				}
				schedule_workflow = null;
				if ( active_content_root && active_content_root.parentNode ) {
					active_content_root.remove();
				}
				active_content_root = null;
				customer_field_baseline = null;
				note_baseline = null;
				schedule_input_dirty = false;
				shell_root.setAttribute( 'data-wpbc-booking-new-inspector-dirty', 'false' );
				shared_content_root.insertAdjacentHTML( 'beforeend', created_template( {
					booking: response_data.booking || {},
					warnings: response_data.warnings || [],
					i18n: i18n
				} ) );
				created_status = shared_content_root.querySelector( '[data-wpbc-booking-new-inspector-created-status]' );
				if ( created_status && 'function' === typeof created_status.focus ) {
					created_status.focus();
				}
				if ( ! request_timeline_readback( response_data ) ) {
					readback_status = shared_content_root.querySelector( '[data-wpbc-booking-new-inspector-readback-status]' );
					readback_retry = shared_content_root.querySelector( '[data-wpbc-booking-new-inspector-readback-retry]' );
					if ( readback_status ) {
						readback_status.setAttribute( 'role', 'alert' );
						readback_status.textContent = i18n.timeline_refresh_failed || '';
					}
					if ( readback_retry ) {
						readback_retry.hidden = true;
					}
				}
			} ).fail( function ( failed_request, request_status ) {
				var error_data;

				if ( 'abort' === request_status || current_generation !== apply_request_generation || ! active_review_root ) {
					return;
				}
				pending_apply_request = null;
				error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
				transition( 'error' );
				if ( error_data && 'editing' === error_data.retry_state ) {
					active_review_root.remove();
					active_review_root = null;
					active_review = null;
					active_content_root.hidden = false;
					transition( 'editing' );
					review_button = active_content_root.querySelector( '[data-wpbc-booking-new-inspector-review]' );
					if ( review_button ) {
						review_button.disabled = false;
						review_button.removeAttribute( 'aria-busy' );
					}
					render_review_errors( error_data, review_button );
					return;
				}
				transition( 'review' );
				if ( apply_message ) {
					apply_message.setAttribute( 'role', 'alert' );
					apply_message.textContent = error_data && error_data.message ? error_data.message : i18n.create_failed || '';
				}
				if ( apply_button ) {
					apply_button.disabled = false;
					apply_button.removeAttribute( 'aria-busy' );
					apply_button.focus();
				}
			} );
		}

		/**
		 * Start the existing Phase 4 read-only schedule and native-calendar workflow.
		 *
		 * @param {Object} bootstrap            Authorized bootstrap DTO.
		 * @param {Object} launch_request       Validated bootstrap launch envelope.
		 * @param {string}      calendar_anchor_date Presentation-only month anchor retained across a Resource/form reload.
		 * @param {Object|null} schedule_draft       Server-revalidated schedule proposal retained across the reload.
		 * @return {void}
		 */
		function start_schedule_workflow( bootstrap, launch_request, calendar_anchor_date, schedule_draft ) {
			var dates_host = active_content_root.querySelector( '[data-wpbc-booking-new-inspector-dates-host]' );
			var schedule_request = {
				schema_version: configuration.schema_version,
				request_id: create_request_id(),
				selection_source: launch_request.selection_source,
				resource_id: bootstrap.selected_resource_id,
				form_id: bootstrap.selected_form_id
			};

			if ( launch_request.source_context_token ) {
				schedule_request.source_context_token = launch_request.source_context_token;
			}
			if ( /^\d{4}-\d{2}-\d{2}$/.test( String( calendar_anchor_date || '' ) ) ) {
				schedule_request.calendar_anchor_date = String( calendar_anchor_date );
			}
			if ( 'empty' === launch_request.selection_source && schedule_draft ) {
				schedule_request.schedule = schedule_draft;
			}
			schedule_workflow = window.wpbc_booking_new_inspector.create_schedule_workflow( {
				root: active_content_root,
				ajax_url: transport.url,
				action: transport.schedule_action,
				nonce: transport.schedule_nonce,
				get_calendar_host: function () {
					return active_content_root ? active_content_root.querySelector( '[data-wpbc-booking-new-inspector-calendar-host]' ) : null;
				},
				on_ready: function ( schedule_context ) {
					if ( ! dates_host || ! active_content_root ) {
						return;
					}
					dates_host.innerHTML = dates_template( {
						schedule: schedule_context.schedule || {},
						choices: schedule_context.choices || {},
						i18n: i18n
					} );
					set_schedule_error( false );
					schedule_input_dirty = false;
					set_schedule_loading( true );
				},
				on_change: synchronize_schedule,
				on_loading: set_schedule_loading,
				on_error: function () {
					set_schedule_loading( false );
					set_schedule_error( true );
				}
			} );
			if ( ! schedule_workflow || ! schedule_workflow.load( schedule_request ) ) {
				set_schedule_loading( false );
				set_schedule_error( true );
			}
		}

		/**
		 * Render authorized editing DTOs through domain-owned templates.
		 *
		 * @param {Object} bootstrap            Authorized bootstrap response.
		 * @param {Object} launch_request       Validated bootstrap launch envelope.
		 * @param {string}      calendar_anchor_date Presentation-only month anchor retained across a Resource/form reload.
		 * @param {Object|null} schedule_draft       Server-revalidated schedule proposal retained across the reload.
		 * @return {void}
		 */
		function render_editing( bootstrap, launch_request, calendar_anchor_date, schedule_draft ) {
			var content_root;
			var resource_host;
			var fields_host;
			var fields_container;
			var notes_host;
			var dates_host;
			var costs_host;
			var footer_host;

			if ( bootstrap.support && 'unsupported' === bootstrap.support.status ) {
				active_fallback_url = bootstrap.fallback && bootstrap.fallback.url ? bootstrap.fallback.url : active_fallback_url;
				shared_inspector.set_content( unsupported_template( {
					i18n: i18n,
					support: bootstrap.support,
					fallback: bootstrap.fallback,
					canonical_url: configuration.canonical_url || ''
				} ), i18n.loaded || '' );
				return;
			}
			if ( ! bootstrap.resources || ! bootstrap.resources.length || ! bootstrap.forms || ! bootstrap.forms.length ) {
				render_state( 'empty', i18n.empty_title || '', i18n.empty_message || '', false );
				return;
			}

			shared_inspector.set_content( shell_template( {} ), i18n.loaded || '' );
			active_content_root = shell_root.querySelector( '.wpbc_booking_new_inspector' );
			active_bootstrap = bootstrap;
			draft_revision = 0;
			schedule_ready = false;
			cost_correction = '';
			content_root = active_content_root;
			if ( ! active_content_root ) {
				return;
			}

			resource_host = content_root.querySelector( '[data-wpbc-booking-new-inspector-resource-host]' );
			fields_host = content_root.querySelector( '[data-wpbc-booking-new-inspector-fields-host]' );
			notes_host = content_root.querySelector( '[data-wpbc-booking-new-inspector-notes-host]' );
			dates_host = content_root.querySelector( '[data-wpbc-booking-new-inspector-dates-host]' );
			costs_host = content_root.querySelector( '[data-wpbc-booking-new-inspector-costs-host]' );
			footer_host = content_root.querySelector( '[data-wpbc-booking-new-inspector-footer-host]' );
			resource_host.innerHTML = resource_template( { resources: bootstrap.resources || [], forms: bootstrap.forms || [], i18n: i18n } );
			fields_host.innerHTML = fields_template( { fields: bootstrap.fields || [], i18n: i18n } );
			fields_container = fields_host.querySelector( '[data-wpbc-booking-new-inspector-fields]' );
			if ( fields_container ) {
				( bootstrap.fields || [] ).forEach( function ( field, field_index ) {
					var field_view = Object.assign( {}, field );
					field_view.field_id = 'wpbc_booking_new_inspector_field_' + field_index;
					field_view.error_id = field_view.field_id + '_error';
					fields_container.insertAdjacentHTML( 'beforeend', field_template( field_view ) );
				} );
			}
			customer_field_baseline = JSON.stringify( get_customer_field_snapshot( active_content_root ) );
			notes_host.innerHTML = notes_template( { notes: bootstrap.notes || [], i18n: i18n } );
			note_baseline = JSON.stringify( get_note_snapshot( active_content_root ) );
			update_dirty_state();
			dates_host.innerHTML = dates_template( { schedule: bootstrap.schedule || {}, choices: {}, i18n: i18n } );
			render_cost( bootstrap.cost || {}, null );
			footer_host.innerHTML = footer_template( { url: active_fallback_url, i18n: i18n } );
			start_schedule_workflow( bootstrap, launch_request, calendar_anchor_date, schedule_draft );

			content_root.addEventListener( 'change', function ( event ) {
				var resource_select = event.target.closest( '[data-wpbc-booking-new-inspector-resource]' );
				var form_select = event.target.closest( '[data-wpbc-booking-new-inspector-form]' );
				var selected_resource = content_root.querySelector( '[data-wpbc-booking-new-inspector-resource]' );
				var selection_method = event.target.closest( '[data-wpbc-booking-new-inspector-selection-method]' );
				var time_application = event.target.closest( '[data-wpbc-booking-new-inspector-time-application]' );
				var start_time = content_root.querySelector( '[data-wpbc-booking-new-inspector-start-time]' );
				var end_time = content_root.querySelector( '[data-wpbc-booking-new-inspector-end-time]' );
				var customer_field = event.target.closest( '[data-wpbc-booking-new-inspector-field-input]' );
				var note_field = event.target.closest( '[data-wpbc-booking-new-inspector-note]' );
				var cost_correction_input = event.target.closest( '[data-wpbc-booking-new-inspector-cost-correction]' );

				if ( resource_select ) {
					var resource_calendar_anchor_date = get_schedule_calendar_anchor_date( schedule_workflow );
					var resource_schedule_draft = get_schedule_reload_draft( schedule_workflow );

					if ( ! confirm_discard_changes() ) {
						resource_select.value = String( bootstrap.selected_resource_id || '' );
						return;
					}
					active_fallback_url = configuration.canonical_url || '';
					load( { resource_id: resource_select.value }, { selection_source: 'empty' }, resource_calendar_anchor_date, resource_schedule_draft );
				} else if ( form_select ) {
					var form_calendar_anchor_date = get_schedule_calendar_anchor_date( schedule_workflow );
					var form_schedule_draft = get_schedule_reload_draft( schedule_workflow );

					if ( ! confirm_discard_changes() ) {
						form_select.value = String( bootstrap.selected_form_id || '' );
						return;
					}
					active_fallback_url = configuration.canonical_url || '';
					load( { resource_id: selected_resource ? selected_resource.value : '', form_id: form_select.value }, { selection_source: 'empty' }, form_calendar_anchor_date, form_schedule_draft );
				} else if ( selection_method && schedule_workflow ) {
					schedule_workflow.set_selection_method( selection_method.value );
				} else if ( time_application && schedule_workflow ) {
					schedule_workflow.set_time_application( time_application.value );
				} else if ( schedule_workflow && ( event.target === start_time || event.target === end_time ) ) {
					update_schedule_times();
				} else if ( cost_correction_input ) {
					cost_correction = String( cost_correction_input.value || '' ).trim();
					invalidate_cost_preview();
					update_dirty_state();
					queue_cost_preview( 250 );
				} else if ( customer_field || note_field ) {
					if ( customer_field ) {
						clear_control_error( customer_field );
					}
					invalidate_cost_preview();
					update_dirty_state();
					queue_cost_preview( 250 );
				}
			} );
			content_root.addEventListener( 'input', function ( event ) {
				var cost_correction_input = event.target.closest( '[data-wpbc-booking-new-inspector-cost-correction]' );

				if ( cost_correction_input ) {
					cost_correction = String( cost_correction_input.value || '' ).trim();
					invalidate_cost_preview();
					update_dirty_state();
				} else if (
					event.target.closest( '[data-wpbc-booking-new-inspector-start-time]' )
					|| event.target.closest( '[data-wpbc-booking-new-inspector-end-time]' )
				) {
					update_schedule_times();
				} else if (
					event.target.closest( '[data-wpbc-booking-new-inspector-field-input]' )
					|| event.target.closest( '[data-wpbc-booking-new-inspector-note]' )
				) {
					clear_control_error( event.target.closest( '[data-wpbc-booking-new-inspector-field-input]' ) );
					invalidate_cost_preview();
					update_dirty_state();
				}
			} );
			content_root.addEventListener( 'click', function ( event ) {
				if ( event.target.closest( '[data-wpbc-booking-new-inspector-schedule-reset]' ) && schedule_workflow ) {
					event.preventDefault();
					schedule_workflow.reset();
					schedule_input_dirty = false;
					update_dirty_state();
				} else if ( event.target.closest( '[data-wpbc-booking-new-inspector-cost-preview]' ) ) {
					event.preventDefault();
					request_cost_preview();
				} else if ( event.target.closest( '[data-wpbc-booking-new-inspector-dismiss-cost]' ) ) {
					var review_button = content_root.querySelector( '[data-wpbc-booking-new-inspector-review]' );

					event.preventDefault();
					cost_section_dismissed = true;
					render_cost( {}, null );
					if ( review_button && 'function' === typeof review_button.focus ) {
						review_button.focus();
					}
				} else if ( event.target.closest( '[data-wpbc-booking-new-inspector-review]' ) ) {
					event.preventDefault();
					request_review();
				}
			} );
		}

		/**
		 * Load one authorized bootstrap using an empty or signed Timeline launch.
		 *
		 * The empty top-navigation launch passes no Resource, form, date, or time. The server
		 * selects the authorized defaults. Later select changes may send only the
		 * chosen Resource/form identities plus an optional bounded schedule proposal
		 * for exact server revalidation.
		 *
		 * @param {Object} choices               Optional explicit Resource/form choices.
		 * @param {Object} launch_request        Validated browser launch envelope.
		 * @param {string}      calendar_anchor_date Optional presentation-only month anchor.
		 * @param {Object|null} schedule_draft      Optional bounded schedule proposal for a Resource/form reload.
		 * @return {void}
		 */
		function load( choices, launch_request, calendar_anchor_date, schedule_draft ) {
			var request_values;
			var current_generation;

			launch_request = launch_request && 'object' === typeof launch_request
				? launch_request
				: { selection_source: 'empty' };
			request_values = {
				schema_version: configuration.schema_version,
				request_id: create_request_id(),
				selection_source: launch_request.selection_source
			};

			choices = choices && 'object' === typeof choices ? choices : {};
			calendar_anchor_date = /^\d{4}-\d{2}-\d{2}$/.test( String( calendar_anchor_date || '' ) )
				? String( calendar_anchor_date )
				: '';
			last_choices = Object.assign( {}, choices );
			last_launch_request = Object.assign( {}, launch_request );
			last_calendar_anchor_date = calendar_anchor_date;
			last_schedule_draft = schedule_draft ? Object.assign( {}, schedule_draft, {
				selected_dates: Array.isArray( schedule_draft.selected_dates ) ? schedule_draft.selected_dates.slice( 0 ) : []
			} ) : null;
			if ( launch_request.source_context_token ) {
				request_values.source_context_token = launch_request.source_context_token;
			}
			if ( choices.resource_id && /^[1-9][0-9]*$/.test( String( choices.resource_id ) ) ) {
				request_values.resource_id = String( choices.resource_id );
			}
			if ( choices.form_id ) {
				request_values.form_id = String( choices.form_id );
			}

			abort_request();
			if ( ! transition( 'loading' ) ) {
				return;
			}
			shared_inspector.reset_header( i18n.title || '' );
			render_state( 'loading', i18n.loading_title || i18n.title || '', i18n.loading || '', false );
			request_generation += 1;
			current_generation = request_generation;
			pending_request = $.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.bootstrap_action,
					nonce: transport.bootstrap_nonce,
					request: JSON.stringify( request_values )
				}
			} ).done( function ( response ) {
				var bootstrap = response && true === response.success ? response.data : null;

				if ( current_generation !== request_generation || ! shared_inspector.is_open() ) {
					return;
				}
				pending_request = null;
				if ( ! bootstrap || bootstrap.request_id !== request_values.request_id || 'editing' !== bootstrap.state ) {
					transition( 'error' );
					render_state( 'error', i18n.error_title || '', response && response.data && response.data.message ? response.data.message : i18n.load_failed || '', true );
					return;
				}

				transition( 'editing' );
				shared_inspector.set_header( header_template( { title: i18n.title || '', subtitle: i18n.subtitle || '' } ), i18n.title || '' );
				render_editing( bootstrap, launch_request, calendar_anchor_date, last_schedule_draft );
			} ).fail( function ( failed_request, request_status ) {
				var error_data;

				if ( 'abort' === request_status || current_generation !== request_generation || ! shared_inspector.is_open() ) {
					return;
				}
				pending_request = null;
				transition( 'error' );
				error_data = failed_request && failed_request.responseJSON ? failed_request.responseJSON.data : null;
				render_state( 'error', i18n.error_title || '', error_data && error_data.message ? error_data.message : i18n.load_failed || '', true );
			} );
		}

		shared_inspector = window.wpbc_shared_ui_inspector.create( shell_root, {
			owner_id: configuration.component_id,
			interaction_group: configuration.component_id,
			on_before_close: confirm_discard_changes,
			on_close: function () {
				var focus_booking_id = 'created' === state ? created_booking_id : 0;

				abort_request();
				state = 'closed';
				shell_root.setAttribute( 'data-wpbc-booking-new-inspector-state', state );
				request_created_booking_focus( focus_booking_id );
			}
		} );
		if ( ! shared_inspector ) {
			return null;
		}
		shell_root.addEventListener( 'click', function ( event ) {
			if ( event.target.closest( '[data-wpbc-booking-new-inspector-retry]' ) ) {
				event.preventDefault();
				load( last_choices, last_launch_request, last_calendar_anchor_date, last_schedule_draft );
			} else if ( event.target.closest( '[data-wpbc-booking-new-inspector-review-cancel]' ) ) {
				event.preventDefault();
				cancel_review();
			} else if ( event.target.closest( '[data-wpbc-booking-new-inspector-create]' ) ) {
				event.preventDefault();
				apply_review();
			} else if ( event.target.closest( '[data-wpbc-booking-new-inspector-readback-retry]' ) ) {
				event.preventDefault();
				if ( pending_created_readback && pending_created_readback.response ) {
					request_timeline_readback( pending_created_readback.response );
				}
			}
		} );
		timeline_event_root.addEventListener( timeline_readback_event_name, handle_timeline_readback );

		return {
			open: function ( trigger, launch_request ) {
				if ( 'closed' !== state ) {
					shared_inspector.close( false );
					if ( shared_inspector.is_open() ) {
						return false;
					}
				}
				active_fallback_url = trigger && trigger.href ? trigger.href : configuration.canonical_url || '';
				cost_section_dismissed = false;
				shared_inspector.open( trigger );
				load(
					{},
					launch_request,
					'empty' === launch_request.selection_source ? get_today_calendar_anchor_date() : '',
					null
				);

				return true;
			}
		};
	}

	/**
	 * Intercept the stable authorized Timeline launch link when the adapter is ready.
	 *
	 * If any runtime contract is absent, navigation is intentionally left alone so
	 * the canonical Add Booking destination remains available.
	 *
	 * @param {MouseEvent} event Delegated document click.
	 * @return {void}
	 */
	function handle_click( event ) {
		var trigger = event.target.closest( launch_selector );
		var timeline_settings = window.wpbc_timeline_config && 'object' === typeof window.wpbc_timeline_config ? window.wpbc_timeline_config : {};
		var action = timeline_settings.new_booking && 'object' === typeof timeline_settings.new_booking ? timeline_settings.new_booking : {};
		var configuration = action.inspector && 'object' === typeof action.inspector ? action.inspector : null;
		var launch_request;

		if ( ! trigger || ! configuration ) {
			return;
		}
		launch_request = get_launch_request( trigger, configuration );
		if ( ! launch_request ) {
			return;
		}
		if ( ! controller ) {
			controller = create_controller( configuration );
		}
		if ( ! controller ) {
			return;
		}

		event.preventDefault();
		controller.open( trigger, launch_request );
	}

	document.addEventListener( 'click', handle_click );
}( window, document, window.wp, window.jQuery ) );
