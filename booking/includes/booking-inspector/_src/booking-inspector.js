/**
 * Reusable Booking Inspector domain adapter.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, wp ) {
	'use strict';

	/**
	 * Resolve an allow-listed WordPress template renderer.
	 *
	 * @param {string} template_id Server-declared template identifier.
	 * @return {Function|null} Template renderer or null.
	 */
	function get_template( template_id ) {
		return template_id && wp && 'function' === typeof wp.template ? wp.template( template_id ) : null;
	}

	/**
	 * Initialize one rendered tab set.
	 *
	 * Arrow keys follow the WAI-ARIA tabs pattern while Tab continues into the
	 * active panel. Tab selection itself never changes booking data.
	 *
	 * @param {HTMLElement} inspector_root Rendered booking-domain Inspector.
	 * @param {string}      initial_tab    Stable tab identifier to activate initially.
	 * @return {void}
	 */
	function initialize_tabs( inspector_root, initial_tab ) {
		var tablist = inspector_root ? inspector_root.querySelector( '[role="tablist"]' ) : null;
		var tabs = tablist ? Array.prototype.slice.call( tablist.querySelectorAll( '[role="tab"]' ) ) : [];
		var panels = inspector_root ? Array.prototype.slice.call( inspector_root.querySelectorAll( '[role="tabpanel"]' ) ) : [];

		if ( ! tablist || ! tabs.length || ! panels.length ) {
			return;
		}

		/**
		 * Activate one available tab and its controlled panel.
		 *
		 * @param {HTMLElement} tab        Tab button to activate.
		 * @param {boolean}     move_focus Whether keyboard focus follows activation.
		 * @return {void}
		 */
		function activate_tab( tab, move_focus ) {
			var controlled_panel_id = tab.getAttribute( 'aria-controls' );

			tabs.forEach( function ( candidate_tab ) {
				var is_active = candidate_tab === tab;
				candidate_tab.setAttribute( 'aria-selected', is_active ? 'true' : 'false' );
				candidate_tab.setAttribute( 'tabindex', is_active ? '0' : '-1' );
			} );
			panels.forEach( function ( panel ) {
				panel.hidden = panel.id !== controlled_panel_id;
			} );
			if ( move_focus ) {
				tab.focus();
			}
		}

		if ( initial_tab ) {
			tabs.some( function ( candidate_tab ) {
				if ( initial_tab !== candidate_tab.getAttribute( 'data-wpbc-booking-inspector-tab' ) ) {
					return false;
				}
				activate_tab( candidate_tab, false );
				return true;
			} );
		}

		tablist.addEventListener( 'click', function ( event ) {
			var tab = event.target.closest( '[role="tab"]' );

			if ( tab && tablist.contains( tab ) ) {
				activate_tab( tab, false );
			}
		} );

		inspector_root.addEventListener( 'click', function ( event ) {
			var tab_action = event.target.closest( '[data-wpbc-booking-inspector-open-tab]' );
			var requested_tab;
			var target_tab;

			if ( ! tab_action || ! inspector_root.contains( tab_action ) ) {
				return;
			}

			requested_tab = tab_action.getAttribute( 'data-wpbc-booking-inspector-open-tab' );
			target_tab = tabs.find( function ( candidate_tab ) {
				return requested_tab === candidate_tab.getAttribute( 'data-wpbc-booking-inspector-tab' );
			} );
			if ( target_tab ) {
				event.preventDefault();
				activate_tab( target_tab, true );
			}
		} );

		tablist.addEventListener( 'keydown', function ( event ) {
			var current_index = tabs.indexOf( event.target );
			var next_index = current_index;

			if ( -1 === current_index ) {
				return;
			}
			if ( 'ArrowRight' === event.key || 'ArrowDown' === event.key ) {
				next_index = ( current_index + 1 ) % tabs.length;
			} else if ( 'ArrowLeft' === event.key || 'ArrowUp' === event.key ) {
				next_index = ( current_index - 1 + tabs.length ) % tabs.length;
			} else if ( 'Home' === event.key ) {
				next_index = 0;
			} else if ( 'End' === event.key ) {
				next_index = tabs.length - 1;
			} else {
				return;
			}
			event.preventDefault();
			activate_tab( tabs[ next_index ], true );
		} );
	}

	/**
	 * Create one Booking Inspector adapter for a host view.
	 *
	 * The adapter owns booking transport, local template rendering, stale-request
	 * protection, and active booking-trigger state. The shared Inspector API owns
	 * only the shell lifecycle and focus behavior.
	 *
	 * @param {HTMLElement} host_root     View root containing booking triggers.
	 * @param {HTMLElement} shell_host    Empty host for the shared shell template.
	 * @param {Object}      configuration Server-owned booking domain configuration.
	 * @param {Object}      options       Host presentation options.
	 * @return {Object|null} Adapter API or null when required contracts are absent.
	 */
	function create( host_root, shell_host, configuration, options ) {
		var settings = configuration && 'object' === typeof configuration ? configuration : {};
		var host_options = options && 'object' === typeof options ? options : {};
		var i18n = settings.i18n && 'object' === typeof settings.i18n ? settings.i18n : {};
		var templates = settings.templates && 'object' === typeof settings.templates ? settings.templates : {};
		var transport = settings.transport && 'object' === typeof settings.transport ? settings.transport : {};
		var shell_template = get_template( templates.shell );
		var details_template = get_template( templates.details );
		var header_template = get_template( templates.header );
		var resource_template = get_template( templates.resource );
		var tabs_template = get_template( templates.tabs );
		var booking_fields_template = get_template( templates.booking_fields );
		var booking_field_row_template = get_template( templates.booking_field_row );
		var dates_template = get_template( templates.dates );
		var costs_template = get_template( templates.costs );
		var notes_template = get_template( templates.notes );
		var system_information_template = get_template( templates.system_information );
		var activity_template = get_template( templates.activity );
		var footer_template = get_template( templates.footer );
		var state_template = get_template( templates.state );
		var trigger_selector = host_options.trigger_selector || '[data-wpbc-booking-inspector-trigger]';
		var active_class = host_options.active_class || 'is-booking-inspector-open';
		var activation_mode = 'manual' === host_options.activation_mode ? 'manual' : 'delegated';
		var owns_trigger_aria = false !== host_options.owns_trigger_aria;
		var focus_selector = 'string' === typeof host_options.focus_selector ? host_options.focus_selector : '';
		var shared_inspector;
		var date_editor_controller = null;
		var rescheduling_controller = null;
		var shell_root;
		var active_trigger_id = '';
		var active_booking_id = 0;
		var host_refresh_generation = 0;
		var request = null;
		var save_request = null;
		var activity_request = null;
		var request_generation = 0;
		var save_request_generation = 0;
		var activity_request_generation = 0;
		var save_feedback_timer = null;
		var save_success_message_duration_ms = 5000;
		var active_booking = null;
		var pending_booking_actions = {};
		var clean_draft_json = '';
		var is_dirty = false;
		var is_saving = false;
		var saved_event_name = 'wpbc:booking-inspector:saved';

		/**
		 * Read the live notification choice owned by the current administration view.
		 *
		 * The value is read immediately before each mutation so changing the Timeline
		 * switch after opening an Inspector or Review still controls that operation.
		 *
		 * @return {number} One when the current operation requests email; otherwise zero.
		 */
		function get_send_modified_email_intent() {
			var notification_toggle = document.querySelector( '[data-wpbc-send-modified-email]' ) ||
				document.getElementById( 'is_send_email_for_pending' ) ||
				document.getElementById( 'ui_usr__send_emails' );

			return notification_toggle && notification_toggle.checked ? 1 : 0;
		}

		/**
		 * Keep established Booking Actions aligned with the Timeline notification switch.
		 *
		 * @return {void}
		 */
		function synchronize_listing_notification_intent() {
			if ( window.wpbc_ajx_booking_listing && 'function' === typeof window.wpbc_ajx_booking_listing.search_set_param ) {
				window.wpbc_ajx_booking_listing.search_set_param(
					'ui_usr__send_emails',
					get_send_modified_email_intent() ? 'send' : 'not_send'
				);
			}
		}

		/**
		 * Synchronize an in-page notification-toggle change without reloading Timeline.
		 *
		 * @param {Event} event Native change event.
		 * @return {void}
		 */
		function handle_notification_intent_change( event ) {
			if ( event.target && event.target.matches( '[data-wpbc-send-modified-email], #is_send_email_for_pending, #ui_usr__send_emails' ) ) {
				synchronize_listing_notification_intent();
			}
		}

		if (
			! host_root || ! shell_host || ! shell_template || ! details_template || ! header_template || ! resource_template ||
			! tabs_template || ! booking_fields_template || ! booking_field_row_template || ! dates_template ||
			! costs_template || ! notes_template || ! system_information_template || ! activity_template || ! footer_template || ! state_template ||
			! window.wpbc_shared_ui_inspector || 'function' !== typeof window.wpbc_shared_ui_inspector.create
		) {
			return null;
		}

		shell_host.innerHTML = shell_template( {
			id: settings.component_id || 'wpbc_booking_inspector',
			title: i18n.title || '',
			close_label: i18n.close_label || '',
			loading_label: i18n.loading || ''
		} );
		shell_root = shell_host.querySelector( '[data-wpbc-shared-ui-inspector]' );
		if ( ! shell_root ) {
			return null;
		}
		shell_root.classList.add( 'wpbc_booking_inspector_shell' );
		if ( window.wpbc_ajx_booking_listing && 'function' === typeof window.wpbc_ajx_booking_listing.set_secure_param ) {
			window.wpbc_ajx_booking_listing.set_secure_param( 'nonce', transport.listing_action_nonce || '' );
			window.wpbc_ajx_booking_listing.set_secure_param( 'user_id', transport.listing_action_user_id || 0 );
			window.wpbc_ajx_booking_listing.set_secure_param( 'locale', transport.listing_action_locale || '' );
		}
		synchronize_listing_notification_intent();
		document.addEventListener( 'change', handle_notification_intent_change, true );

		/**
		 * Abort the active read and invalidate every pending callback.
		 *
		 * @return {void}
		 */
		function abort_request() {
			request_generation += 1;
			save_request_generation += 1;
			activity_request_generation += 1;
			clear_save_feedback_timer();
			if ( request && 'function' === typeof request.abort ) {
				request.abort();
			}
			request = null;
			if ( save_request && 'function' === typeof save_request.abort ) {
				save_request.abort();
			}
			save_request = null;
			if ( activity_request && 'function' === typeof activity_request.abort ) {
				activity_request.abort();
			}
			activity_request = null;
			is_saving = false;
		}

		/**
		 * Cancel a pending success-message timeout.
		 *
		 * Save progress, errors, a new booking, and Inspector closure must not be
		 * affected by a timer created for an earlier successful request.
		 *
		 * @return {void}
		 */
		function clear_save_feedback_timer() {
			if ( null !== save_feedback_timer ) {
				window.clearTimeout( save_feedback_timer );
				save_feedback_timer = null;
			}
		}

		/**
		 * Return one trigger's stable host identity.
		 *
		 * @param {HTMLElement} trigger Booking trigger.
		 * @return {string} Stable identity or an empty string.
		 */
		function get_trigger_id( trigger ) {
			return trigger && trigger.getAttribute
				? String( trigger.getAttribute( 'data-wpbc-booking-inspector-trigger-id' ) || '' )
				: '';
		}

		/**
		 * Return the canonical booking identifier represented by a host trigger.
		 *
		 * Host markup may derive its visual segment identity from dates. Booking ID
		 * remains stable when a successful date mutation replaces that segment.
		 *
		 * @param {HTMLElement} trigger Booking trigger.
		 * @return {number} Positive booking identifier or zero.
		 */
		function get_trigger_booking_id( trigger ) {
			return trigger && trigger.getAttribute
				? Number( trigger.getAttribute( 'data-wpbc-booking-id' ) || 0 )
				: 0;
		}

		/**
		 * Remove the open state from every rendered booking trigger.
		 *
		 * @return {void}
		 */
		function clear_active_trigger() {
			Array.prototype.forEach.call( host_root.querySelectorAll( trigger_selector ), function ( trigger ) {
				trigger.classList.remove( active_class );
				if ( owns_trigger_aria ) {
					trigger.setAttribute( 'aria-expanded', 'false' );
				}
			} );
			active_trigger_id = '';
			active_booking_id = 0;
		}

		/**
		 * Mark one rendered trigger as the booking displayed in the Inspector.
		 *
		 * @param {HTMLElement} trigger Booking trigger.
		 * @return {void}
		 */
		function set_active_trigger( trigger ) {
			var trigger_id = get_trigger_id( trigger );
			var booking_id = get_trigger_booking_id( trigger );

			clear_active_trigger();
			if ( ! trigger_id || ! booking_id ) {
				return;
			}
			active_trigger_id = trigger_id;
			active_booking_id = booking_id;
			trigger.classList.add( active_class );
			if ( owns_trigger_aria ) {
				trigger.setAttribute( 'aria-expanded', 'true' );
			}
		}

		/**
		 * Restore active presentation after the host replaces booking markup.
		 *
		 * @return {void}
		 */
		function refresh() {
			if ( ! active_trigger_id || ! active_booking_id ) {
				return;
			}
			Array.prototype.some.call( host_root.querySelectorAll( trigger_selector ), function ( trigger ) {
				if ( active_trigger_id !== get_trigger_id( trigger ) && active_booking_id !== get_trigger_booking_id( trigger ) ) {
					return false;
				}
				active_trigger_id = get_trigger_id( trigger );
				trigger.classList.add( active_class );
				if ( owns_trigger_aria ) {
					trigger.setAttribute( 'aria-expanded', 'true' );
				}
				return true;
			} );
		}

		/**
		 * Find the currently active trigger in the latest host markup.
		 *
		 * The host may replace booking segments while the Inspector is open. The
		 * shared shell therefore cannot always restore focus to the original DOM
		 * node; the domain adapter resolves the equivalent current trigger.
		 *
		 * @return {HTMLElement|null} Current active trigger or null.
		 */
		function get_active_trigger() {
			var active_trigger = null;

			if ( ! active_trigger_id || ! active_booking_id ) {
				return null;
			}
			Array.prototype.some.call( host_root.querySelectorAll( trigger_selector ), function ( trigger ) {
				if ( active_trigger_id !== get_trigger_id( trigger ) && active_booking_id !== get_trigger_booking_id( trigger ) ) {
					return false;
				}
				active_trigger_id = get_trigger_id( trigger );
				active_trigger = trigger;
				return true;
			} );
			return active_trigger;
		}

		/**
		 * Resolve the focusable control associated with one host identity element.
		 *
		 * Manual hosts may keep Inspector identity on a non-interactive group while
		 * exposing a separate native selection control. Delegated hosts continue to
		 * restore focus to their trigger itself.
		 *
		 * @param {HTMLElement|null} trigger Current host identity element.
		 * @return {HTMLElement|null} Connected focus target or null.
		 */
		function get_trigger_focus_target( trigger ) {
			var focus_target = trigger;

			if ( trigger && focus_selector ) {
				focus_target = trigger.querySelector( focus_selector ) || trigger;
			}

			return focus_target && focus_target.isConnected ? focus_target : null;
		}

		/**
		 * Find the current Change dates control after a host or Inspector rerender.
		 *
		 * @return {HTMLElement|null} Current Date Editor opener or booking trigger.
		 */
		function get_date_editor_restore_focus() {
			var change_dates_button = shell_root.querySelector( '[data-wpbc-booking-date-editor-open]' );

			return change_dates_button || get_trigger_focus_target( get_active_trigger() );
		}

		/**
		 * Find the current Reschedule control after an Inspector rerender.
		 *
		 * @return {HTMLElement|null} Current opener or booking trigger.
		 */
		function get_rescheduling_restore_focus() {
			var reschedule_button = shell_root.querySelector( '[data-wpbc-booking-rescheduling-open]' );

			return reschedule_button || get_trigger_focus_target( get_active_trigger() );
		}

		/**
		 * Reconcile booking-domain state after the shared shell closes.
		 *
		 * @return {void}
		 */
		function handle_close() {
			var current_trigger = get_trigger_focus_target( get_active_trigger() );

			if ( date_editor_controller ) {
				date_editor_controller.force_close();
			}
			if ( rescheduling_controller ) {
				rescheduling_controller.force_close();
			}
			abort_request();
			clear_active_trigger();
			active_booking = null;
			clean_draft_json = '';
			is_dirty = false;
			if ( current_trigger ) {
				window.setTimeout( function () {
					if ( document.contains( current_trigger ) ) {
						current_trigger.focus();
					}
				}, 0 );
			}
		}

		shared_inspector = window.wpbc_shared_ui_inspector.create( shell_root, {
			on_close: handle_close,
			on_before_close: function () {
				if ( rescheduling_controller && rescheduling_controller.is_busy && rescheduling_controller.is_busy() ) {
					return rescheduling_controller.confirm_discard();
				}
				if ( rescheduling_controller && rescheduling_controller.is_dirty() ) {
					return is_dirty
						? window.confirm( i18n.discard_changes || '' )
						: rescheduling_controller.confirm_discard();
				}
				if ( date_editor_controller && date_editor_controller.is_dirty() ) {
					return is_dirty
						? window.confirm( i18n.discard_changes || '' )
						: date_editor_controller.confirm_discard();
				}

				return ! is_dirty || window.confirm( i18n.discard_changes || '' );
			}
		} );
		if ( ! shared_inspector ) {
			return null;
		}
		if ( window.wpbc_booking_date_editor && 'function' === typeof window.wpbc_booking_date_editor.create_controller ) {
			date_editor_controller = window.wpbc_booking_date_editor.create_controller( shell_root, settings.date_editor || {}, {
				url: transport.url || '',
				source: transport.source || '',
				get_restore_focus: get_date_editor_restore_focus,
				on_applied: handle_date_editor_applied,
				get_send_modified_email_intent: get_send_modified_email_intent
			} );
		}
		if ( window.wpbc_booking_rescheduling && 'function' === typeof window.wpbc_booking_rescheduling.create_controller ) {
			rescheduling_controller = window.wpbc_booking_rescheduling.create_controller( shell_root, settings.rescheduling || {}, {
				url: transport.url || '',
				source: transport.source || '',
				get_restore_focus: get_rescheduling_restore_focus,
				on_applied: handle_date_editor_applied,
				get_send_modified_email_intent: get_send_modified_email_intent
			} );
		}

		/**
		 * Return the currently selected tab identifier.
		 *
		 * @return {string} Active tab identifier.
		 */
		function get_active_tab() {
			var selected_tab = shell_root.querySelector( '[data-wpbc-booking-inspector-tab][aria-selected="true"]' );

			return selected_tab ? String( selected_tab.getAttribute( 'data-wpbc-booking-inspector-tab' ) || '' ) : 'details';
		}

		/**
		 * Collect one schema field from the full Booking Details panel.
		 *
		 * @param {HTMLElement} fields_root Full field-list root.
		 * @param {Object}      field       Authorized field DTO.
		 * @return {string|Array} Scalar or repeated draft value.
		 */
		function collect_field_value( fields_root, field ) {
			var controls = fields_root ? Array.prototype.slice.call( fields_root.querySelectorAll( '[data-wpbc-booking-field="' + field.key + '"]' ) ) : [];
			var values;

			if ( 'checkbox' === field.type || 'acceptance' === field.type ) {
				values = controls.filter( function ( control ) { return control.checked; } ).map( function ( control ) { return control.value; } );
				return values;
			}
			if ( 'radio' === field.type ) {
				values = controls.filter( function ( control ) { return control.checked; } );
				return values.length ? values[ 0 ].value : '';
			}
			if ( 'text' === field.type && field.multiple ) {
				return controls.map( function ( control ) { return control.value; } );
			}
			if ( controls.length && controls[ 0 ].multiple ) {
				return Array.prototype.filter.call( controls[ 0 ].options, function ( option ) { return option.selected; } ).map( function ( option ) { return option.value; } );
			}

			return controls.length ? controls[ 0 ].value : '';
		}

		/**
		 * Collect the complete data-only Inspector draft.
		 *
		 * @return {Object} Booking field, note, and financial draft.
		 */
		function collect_draft() {
			var inspector_root = shell_root.querySelector( '.wpbc_booking_inspector' );
			var fields_root = inspector_root ? inspector_root.querySelector( '[data-wpbc-booking-details-fields]' ) : null;
			var draft = { fields: {}, notes: {}, costs: {} };

			if ( ! inspector_root || ! active_booking ) {
				return draft;
			}
			( active_booking.fields || [] ).forEach( function ( field ) {
				if ( 'file' !== field.type && false !== field.editable ) {
					draft.fields[ field.key ] = collect_field_value( fields_root, field );
				}
			} );
			Array.prototype.forEach.call( inspector_root.querySelectorAll( '[data-wpbc-booking-note]' ), function ( control ) {
				if ( ! control.readOnly ) {
					draft.notes[ control.getAttribute( 'data-wpbc-booking-note' ) ] = control.value;
				}
			} );
			[ 'saved_cost', 'payment_status' ].forEach( function ( cost_key ) {
				var control = inspector_root.querySelector( '[data-wpbc-booking-cost="' + cost_key + '"]:not([disabled])' );
				if ( control && ! control.readOnly ) {
					draft.costs[ cost_key ] = control.value;
				}
			} );

			return draft;
		}

		/**
		 * Identify fields whose authoritative persisted values changed after save.
		 *
		 * The returned DTO is authoritative. Comparing it with the previously loaded
		 * DTO avoids marking submitted values that the server normalized back to the
		 * canonical value.
		 *
		 * @param {Object} previous_booking Previously loaded authorized booking DTO.
		 * @param {Object} saved_booking    Authoritative post-save booking DTO.
		 * @return {Array<string>} Ordered changed field keys present after save.
		 */
		function get_changed_field_keys( previous_booking, saved_booking ) {
			var previous_values = {};

			( previous_booking && previous_booking.fields ? previous_booking.fields : [] ).forEach( function ( field ) {
				previous_values[ field.key ] = JSON.stringify( field.values || [] );
			} );

			return ( saved_booking && saved_booking.fields ? saved_booking.fields : [] ).filter( function ( field ) {
				return Object.prototype.hasOwnProperty.call( previous_values, field.key ) &&
					previous_values[ field.key ] !== JSON.stringify( field.values || [] );
			} ).map( function ( field ) {
				return field.key;
			} );
		}

		/**
		 * Notify the active host that an authoritative booking mutation completed.
		 *
		 * The event exposes only stable identifiers and changed field keys. Timeline,
		 * Booking Listing, and future hosts remain responsible for refreshing through
		 * their own canonical read workflow. An empty changed-field list represents a
		 * canonical Booking Listing action whose extensible action contract does not
		 * expose an exact field-level diff.
		 *
		 * @param {Object}        saved_booking      Authoritative post-save booking DTO.
		 * @param {Array<string>} changed_field_keys Persisted fields changed by the save.
		 * @return {void}
		 */
		function dispatch_booking_saved( saved_booking, changed_field_keys ) {
			var event_detail;
			var saved_event;

			host_refresh_generation += 1;
			event_detail = {
				booking_id: Number( saved_booking && saved_booking.booking_id ? saved_booking.booking_id : 0 ),
				source: transport.source || '',
				changed_field_keys: changed_field_keys.slice( 0 ),
				refresh_generation: host_refresh_generation
			};

			if ( 'function' === typeof window.CustomEvent ) {
				saved_event = new window.CustomEvent( saved_event_name, { bubbles: true, detail: event_detail } );
			} else {
				saved_event = document.createEvent( 'CustomEvent' );
				saved_event.initCustomEvent( saved_event_name, true, false, event_detail );
			}
			host_root.dispatchEvent( saved_event );
		}

		/**
		 * Reread and render one booking after Date Editor persistence succeeds.
		 *
		 * The apply response is intentionally never rendered as Inspector state.
		 * Dates Overview and Activity are replaced only by the authorized Inspector
		 * DTO. The returned promise resolves after that canonical render, allowing
		 * the Date Editor to retain dirty protection when readback fails.
		 *
		 * @param {Object}  apply_result         Minimal canonical Apply result.
		 * @param {boolean} dispatch_saved_event Whether the host must receive a save event.
		 * @return {Object} jQuery-compatible promise resolving with the booking DTO.
		 */
		function handle_date_editor_applied( apply_result, dispatch_saved_event ) {
			var deferred = window.jQuery.Deferred();
			var expected_booking_id = Number( apply_result && apply_result.booking_id ? apply_result.booking_id : 0 );
			var previous_resource_id = Number( active_booking && active_booking.resource_id ? active_booking.resource_id : 0 );
			var preserved_tab = get_active_tab();
			var generation;
			var pending_readback_request;

			if (
				! expected_booking_id ||
				! active_booking ||
				expected_booking_id !== Number( active_booking.booking_id || 0 ) ||
				expected_booking_id !== active_booking_id ||
				! shared_inspector.is_open() ||
				! window.jQuery ||
				! transport.url ||
				! transport.action ||
				! transport.nonce ||
				is_dirty ||
				is_saving
			) {
				deferred.reject( { message: i18n.error || '' } );
				return deferred.promise();
			}

			abort_request();
			generation = request_generation;
			pending_readback_request = window.jQuery.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.action,
					nonce: transport.nonce,
					booking_id: expected_booking_id,
					source: transport.source
				}
			} ).done( function ( response ) {
				var canonical_booking;

				if (
					generation !== request_generation ||
					! shared_inspector.is_open() ||
					! response ||
					! response.success ||
					! response.data ||
					! response.data.booking
				) {
					deferred.reject( { message: i18n.error || '' } );
					return;
				}
				canonical_booking = response.data.booking;
				if (
					expected_booking_id !== Number( canonical_booking.booking_id || 0 ) ||
					expected_booking_id !== active_booking_id
				) {
					deferred.reject( { message: i18n.error || '' } );
					return;
				}

				render_booking( canonical_booking, i18n.saved || '', preserved_tab );
				if ( apply_result.changed && false !== dispatch_saved_event ) {
					var changed_field_keys = [ 'booking_dates' ];

					if ( previous_resource_id && previous_resource_id !== Number( canonical_booking.resource_id || 0 ) ) {
						changed_field_keys.push( 'booking_resource' );
					}
					dispatch_booking_saved( canonical_booking, changed_field_keys );
				}
				deferred.resolve( canonical_booking );
			} ).fail( function ( failed_request, request_status ) {
				if ( 'abort' === request_status || generation !== request_generation ) {
					deferred.reject( { message: i18n.error || '' } );
					return;
				}
				deferred.reject( { message: get_save_error_message( failed_request, '' ) } );
			} ).always( function () {
				if ( request === pending_readback_request ) {
					request = null;
				}
			} );
			request = pending_readback_request;

			return deferred.promise();
		}

		/**
		 * Reread an open matching Inspector after an external canonical mutation.
		 *
		 * Closed or unrelated Inspectors resolve without work. The caller already
		 * owns Timeline and Overview refresh, so this readback deliberately does
		 * not dispatch the normal Inspector-saved host event.
		 *
		 * @param {Object} apply_result Canonical Apply result.
		 * @return {Object} jQuery-compatible promise for the optional readback.
		 */
		function refresh_after_external_apply( apply_result ) {
			var deferred = window.jQuery.Deferred();
			var booking_id = Number( apply_result && apply_result.booking_id ? apply_result.booking_id : 0 );

			if ( ! booking_id || booking_id !== active_booking_id || ! shared_inspector.is_open() ) {
				deferred.resolve();
				return deferred.promise();
			}

			return handle_date_editor_applied( apply_result, false );
		}

		/**
		 * Update footer controls from the current draft state.
		 *
		 * @return {void}
		 */
		function update_dirty_state() {
			var inspector_root = shell_root.querySelector( '.wpbc_booking_inspector' );
			var save_button = inspector_root ? inspector_root.querySelector( '[data-wpbc-booking-inspector-save]' ) : null;
			var cancel_button = inspector_root ? inspector_root.querySelector( '[data-wpbc-booking-inspector-cancel]' ) : null;

			is_dirty = JSON.stringify( collect_draft() ) !== clean_draft_json;
			if ( save_button ) {
				save_button.disabled = ! is_dirty || is_saving;
			}
			if ( cancel_button ) {
				cancel_button.disabled = ! is_dirty || is_saving;
			}
		}

		/**
		 * Temporarily lock controls that belong to the submitted booking draft.
		 *
		 * Only controls that were enabled before the request receive the marker, so
		 * server-disabled controls remain disabled after failure.
		 * This prevents an in-flight edit from being silently replaced by the
		 * authoritative DTO returned for an earlier submitted draft.
		 *
		 * @param {boolean} is_locked Whether the submitted draft is being saved.
		 * @return {void}
		 */
		function set_draft_controls_locked( is_locked ) {
			var inspector_root = shell_root.querySelector( '.wpbc_booking_inspector' );
			var controls = inspector_root ? inspector_root.querySelectorAll( '[data-wpbc-booking-field], [data-wpbc-booking-note], [data-wpbc-booking-cost]' ) : [];

			Array.prototype.forEach.call( controls, function ( control ) {
				if ( is_locked && ! control.disabled ) {
					control.setAttribute( 'data-wpbc-booking-inspector-save-lock', 'true' );
					control.disabled = true;
				} else if ( ! is_locked && control.hasAttribute( 'data-wpbc-booking-inspector-save-lock' ) ) {
					control.removeAttribute( 'data-wpbc-booking-inspector-save-lock' );
					control.disabled = false;
				}
			} );
		}

		/**
		 * Present one booking-save state in the domain-owned sticky footer.
		 *
		 * The button exposes its busy state separately from the live result message,
		 * so sighted and assistive-technology users receive the same progress and
		 * completion feedback without adding booking behavior to the shared shell.
		 *
		 * @param {string} state   Stable idle, saving, success, or error state.
		 * @param {string} message Localized safe status or error message.
		 * @return {void}
		 */
		function set_save_feedback( state, message ) {
			var inspector_root = shell_root.querySelector( '.wpbc_booking_inspector' );
			var save_button = inspector_root ? inspector_root.querySelector( '[data-wpbc-booking-inspector-save]' ) : null;
			var save_label = save_button ? save_button.querySelector( '[data-wpbc-booking-inspector-save-label]' ) : null;
			var save_spinner = save_button ? save_button.querySelector( '[data-wpbc-booking-inspector-save-spinner]' ) : null;
			var status_message = inspector_root ? inspector_root.querySelector( '[data-wpbc-booking-inspector-message]' ) : null;
			var is_busy = 'saving' === state;
			var safe_message = String( message || '' );

			clear_save_feedback_timer();

			if ( inspector_root ) {
				inspector_root.setAttribute( 'aria-busy', is_busy ? 'true' : 'false' );
			}
			if ( save_button ) {
				save_button.setAttribute( 'aria-busy', is_busy ? 'true' : 'false' );
				save_button.classList.toggle( 'is-saving', is_busy );
			}
			if ( save_label ) {
				save_label.textContent = is_busy ? ( i18n.saving_button || i18n.saving || i18n.save_changes || '' ) : ( i18n.save_changes || '' );
			}
			if ( save_spinner ) {
				save_spinner.hidden = ! is_busy;
			}
			if ( status_message ) {
				status_message.hidden = ! safe_message;
				status_message.textContent = safe_message;
				status_message.classList.toggle( 'is-success', 'success' === state );
				status_message.classList.toggle( 'is-error', 'error' === state );
				status_message.setAttribute( 'role', 'error' === state ? 'alert' : 'status' );
				status_message.setAttribute( 'aria-live', 'error' === state ? 'assertive' : 'polite' );
			}
			if ( 'success' === state && safe_message ) {
				save_feedback_timer = window.setTimeout( function () {
					var current_message;

					save_feedback_timer = null;
					if ( ! shared_inspector.is_open() ) {
						return;
					}
					current_message = shell_root.querySelector( '[data-wpbc-booking-inspector-message].is-success' );
					if ( current_message ) {
						set_save_feedback( 'idle', '' );
					}
				}, save_success_message_duration_ms );
			}
		}

		/**
		 * Read one safe message from the normalized WordPress AJAX error contract.
		 *
		 * Raw response text is intentionally ignored because a failed PHP request may
		 * contain sensitive diagnostics or markup that does not belong in the UI.
		 *
		 * @param {Object} failed_request   jQuery AJAX request carrying responseJSON.
		 * @param {string} fallback_message Optional localized fallback.
		 * @return {string} Server-provided safe reason or the localized fallback.
		 */
		function get_save_error_message( failed_request, fallback_message ) {
			var response = failed_request && failed_request.responseJSON ? failed_request.responseJSON : {};
			var error_data = response && response.data ? response.data : {};

			if ( Array.isArray( error_data ) ) {
				error_data = error_data.length ? error_data[ 0 ] : {};
			}
			if ( error_data && 'string' === typeof error_data.message && error_data.message ) {
				return error_data.message;
			}
			if ( response && 'string' === typeof response.message && response.message ) {
				return response.message;
			}

			return 'string' === typeof fallback_message ? fallback_message : ( i18n.save_error || '' );
		}

		/**
		 * Render one standardized booking-domain state.
		 *
		 * @param {string}  state   Stable loading, empty, unsupported, or error state.
		 * @param {string}  message Localized safe state message.
		 * @param {boolean} is_busy Whether the shared shell remains busy.
		 * @return {void}
		 */
		function render_state( state, message, is_busy ) {
			if ( 'loading' === state ) {
				shared_inspector.set_loading( message || '' );
				return;
			}

			var icon_classes = {
				empty: 'wpbc-bi-inbox',
				unsupported: 'wpbc-bi-info-circle',
				error: 'wpbc-bi-exclamation-triangle'
			};
			var rendered_state = state_template( {
				state: state,
				message: message || '',
				icon_class: icon_classes[ state ] || ''
			} );

			if ( 'function' === typeof shared_inspector.set_state ) {
				shared_inspector.set_state( rendered_state, message || '', Boolean( is_busy ) );
			} else {
				shared_inspector.set_content( rendered_state, message || '' );
			}
		}

		/**
		 * Compose all allow-listed booking-domain templates for one DTO.
		 *
		 * @param {Object} booking_dto Authorized booking DTO.
		 * @param {Array<string>} recently_changed_field_keys Fields changed by the completed save.
		 * @return {string} Complete Inspector article markup.
		 */
		function render_booking_templates( booking_dto, recently_changed_field_keys ) {
			var view_data = Object.assign( {}, booking_dto, { i18n: i18n } );
			var changed_field_keys = Array.isArray( recently_changed_field_keys ) ? recently_changed_field_keys : [];
			var inspector_id = 'wpbc_booking_inspector_' + Number( booking_dto.booking_id || 0 );
			var costs_supported = Boolean( booking_dto.costs && booking_dto.costs.supported );
			var activity = booking_dto.activity && booking_dto.activity.events ? booking_dto.activity : { events: [], pagination: {} };
			var empty_state_html = state_template( { state: 'empty', message: i18n.not_available || '', icon_class: 'wpbc-bi-inbox' } );
			var notes_empty_state_html = state_template( { state: 'empty', message: i18n.no_notes || '', icon_class: 'wpbc-bi-inbox' } );
			var activity_empty_state_html = state_template( { state: 'empty', message: i18n.no_activity || '', icon_class: 'wpbc-bi-inbox' } );
			var field_rows_html = ( booking_dto.fields || [] ).map( function ( field, field_index ) {
				return booking_field_row_template( {
					field: field,
					field_id: inspector_id + '_field_' + field_index,
					can_edit_fields: Boolean( booking_dto.actions && booking_dto.actions.can_edit_fields ),
					recently_changed: -1 !== changed_field_keys.indexOf( field.key ),
					i18n: i18n
				} );
			} ).join( '' );
			var notes_html = notes_template( Object.assign( {}, view_data, { empty_state_html: notes_empty_state_html } ) );
			var system_information_html = system_information_template( view_data );
			var intervals = booking_dto.dates && Array.isArray( booking_dto.dates.intervals ) ? booking_dto.dates.intervals : [];
			var header_duration_label = 1 === intervals.length && intervals[ 0 ].duration_label
				? intervals[ 0 ].duration_label
				: ( booking_dto.dates && booking_dto.dates.summary ? booking_dto.dates.summary.selected_dates_label : '' );
			var header_view_data = Object.assign( {}, view_data, {
				costs_supported: costs_supported,
				header_duration_label: header_duration_label
			} );
			var footer_view_data = Object.assign( {}, booking_dto.action_context || {}, {
				can_update: Boolean( booking_dto.actions && booking_dto.actions.can_update ),
				i18n: i18n
			} );

			return details_template( {
				booking_id: booking_dto.booking_id,
				header_html: header_template( view_data ),
				resource_html: resource_template( header_view_data ),
				tabs_html: tabs_template( { inspector_id: inspector_id, costs_supported: costs_supported, i18n: i18n } ),
				booking_fields_html: booking_fields_template( Object.assign( {}, view_data, { inspector_id: inspector_id, field_rows_html: field_rows_html, empty_state_html: empty_state_html, notes_html: notes_html, system_information_html: system_information_html } ) ),
				dates_html: dates_template( Object.assign( {}, view_data, {
					inspector_id: inspector_id,
					empty_state_html: empty_state_html,
				} ) ),
				costs_html: costs_supported ? costs_template( Object.assign( {}, view_data, { inspector_id: inspector_id, costs_supported: true } ) ) : '',
				activity_html: activity_template( Object.assign( {}, view_data, { inspector_id: inspector_id, activity: activity, empty_state_html: activity_empty_state_html } ) ),
				footer_html: footer_template( footer_view_data )
			} );
		}

		/**
		 * Render an authoritative DTO and initialize its local interactions.
		 *
		 * @param {Object} booking_dto Authorized booking DTO.
		 * @param {string} announcement Accessible completion announcement.
		 * @param {string} initial_tab Tab to preserve after a refresh.
		 * @param {Array<string>} recently_changed_field_keys Fields changed by the completed save.
		 * @return {void}
		 */
		function render_booking( booking_dto, announcement, initial_tab, recently_changed_field_keys ) {
			var inspector_root;
			var domain_header;
			var status_label = booking_dto.status && booking_dto.status.label ? booking_dto.status.label : '';
			var accessible_title = ( i18n.booking_number || i18n.title || '' ) + ': ' + booking_dto.booking_id;

			active_booking = booking_dto;
			shared_inspector.set_content( render_booking_templates( booking_dto, recently_changed_field_keys ), announcement || '' );
			inspector_root = shell_root.querySelector( '.wpbc_booking_inspector' );
			domain_header = inspector_root ? inspector_root.querySelector( '[data-wpbc-booking-inspector-header]' ) : null;
			if ( status_label ) {
				accessible_title += ', ' + status_label;
			}
			if ( domain_header && 'function' === typeof shared_inspector.set_header ) {
				shared_inspector.set_header( domain_header.innerHTML, accessible_title );
				domain_header.remove();
			}
			initialize_action_resource_dialogs( booking_dto.action_context || {} );
			initialize_tabs( inspector_root, initial_tab || 'details' );
			clean_draft_json = JSON.stringify( collect_draft() );
			is_dirty = false;
			update_dirty_state();
		}

		/**
		 * Populate canonical Listing Resource dialogs for every Inspector host.
		 *
		 * Booking Listing normally renders these controls after its search request.
		 * Inspector hosts instead consume the authorized Resource choices included in
		 * the booking details DTO, so no host needs to copy Resource resolution.
		 *
		 * @param {Object} action_context Authorized canonical action context.
		 * @return {void}
		 */
		function initialize_action_resource_dialogs( action_context ) {
			var resources = Array.isArray( action_context.booking_resources ) ? action_context.booking_resources : [];
			var dialog_templates = [
				{ target: 'section_in_in_modal__change_booking_resource', template: 'wpbc_ajx__modal__change_booking_resource' },
				{ target: 'section_in_in_modal__duplicate_booking_to_other_resource', template: 'wpbc_ajx__modal__duplicate_booking_to_other_resource' }
			];

			if ( ! window.wp || 'function' !== typeof window.wp.template ) {
				return;
			}
			dialog_templates.forEach( function ( dialog_template ) {
				var target = document.getElementById( dialog_template.target );
				var template_node = document.getElementById( 'tmpl-' + dialog_template.template );
				if ( ! target || ! template_node ) {
					return;
				}
				target.innerHTML = window.wp.template( dialog_template.template )( {
					ajx_search_params: {},
					ajx_booking_resources: resources
				} );
			} );
		}

		/**
		 * Synchronize repeated editable controls and mark the booking draft dirty.
		 *
		 * @param {Event} event Input or change event.
		 * @return {void}
		 */
		function handle_draft_change( event ) {
			var control = event.target.closest( '[data-wpbc-booking-field], [data-wpbc-booking-note], [data-wpbc-booking-cost]' );
			var attribute_name;
			var attribute_value;

			if ( ! control || ! shell_root.contains( control ) ) {
				return;
			}
			attribute_name = control.hasAttribute( 'data-wpbc-booking-field' ) ? 'data-wpbc-booking-field' : ( control.hasAttribute( 'data-wpbc-booking-note' ) ? 'data-wpbc-booking-note' : 'data-wpbc-booking-cost' );
			attribute_value = control.getAttribute( attribute_name );
			Array.prototype.forEach.call( shell_root.querySelectorAll( '[' + attribute_name + '="' + attribute_value + '"]' ), function ( matching_control ) {
				if ( matching_control === control || 'checkbox' === control.type || 'radio' === control.type ) {
					return;
				}
				matching_control.value = control.value;
			} );
			if ( 'data-wpbc-booking-note' === attribute_name && 'private' === attribute_value && active_booking ) {
				var listing_note = shell_root.querySelector( '#set_booking_note_text_' + Number( active_booking.booking_id || 0 ) );
				if ( listing_note ) {
					listing_note.value = control.value;
				}
			}
			if ( ! is_saving ) {
				set_save_feedback( 'idle', '' );
			}
			update_dirty_state();
		}

		/**
		 * Restore every control from the last authoritative DTO.
		 *
		 * @return {void}
		 */
		function cancel_changes() {
			if ( active_booking && ! is_saving ) {
				render_booking( active_booking, '', get_active_tab() );
			}
		}

		/**
		 * Persist the current data-only draft through the authorized domain endpoint.
		 *
		 * @return {void}
		 */
		function save_changes() {
			var preserved_tab = get_active_tab();
			var save_generation;
			var pending_save_request;
			var submitted_draft;
			var booking_before_save;
			var changed_field_keys;

			if ( ! is_dirty || is_saving || ! active_booking || ! transport.update_action || ! transport.update_nonce ) {
				return;
			}
			submitted_draft = collect_draft();
			booking_before_save = active_booking;
			is_saving = true;
			save_request_generation += 1;
			save_generation = save_request_generation;
			update_dirty_state();
			set_save_feedback( 'saving', i18n.saving || '' );
			set_draft_controls_locked( true );
			pending_save_request = window.jQuery.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.update_action,
					nonce: transport.update_nonce,
					booking_id: active_booking.booking_id,
					source: transport.source,
					fingerprint: active_booking.fingerprint,
					draft: JSON.stringify( submitted_draft ),
					send_modified_email: get_send_modified_email_intent()
				}
			} ).done( function ( response ) {
				if ( save_generation !== save_request_generation || ! shared_inspector.is_open() ) {
					return;
				}
				if ( ! response || ! response.success || ! response.data || ! response.data.booking ) {
					is_saving = false;
					set_draft_controls_locked( false );
					set_save_feedback( 'error', get_save_error_message( { responseJSON: response } ) );
					update_dirty_state();
					return;
				}
				changed_field_keys = get_changed_field_keys( booking_before_save, response.data.booking );
				is_saving = false;
				render_booking( response.data.booking, i18n.saved || '', preserved_tab, changed_field_keys );
				set_save_feedback( 'success', i18n.saved || '' );
				if ( response.data.changed ) {
					dispatch_booking_saved( response.data.booking, changed_field_keys );
				}
				if ( 'timeline' === transport.source ) {
					window.setTimeout( function () {
						if ( save_generation === save_request_generation && shared_inspector.is_open() ) {
							shared_inspector.close();
						}
					}, 0 );
				}
			} ).fail( function ( failed_request, request_status ) {
				if ( 'abort' === request_status || save_generation !== save_request_generation || ! shared_inspector.is_open() ) {
					return;
				}
				is_saving = false;
				set_draft_controls_locked( false );
				set_save_feedback( 'error', get_save_error_message( failed_request ) );
				update_dirty_state();
			} ).always( function () {
				if ( save_request === pending_save_request ) {
					save_request = null;
				}
			} );
			save_request = pending_save_request;
		}

		/**
		 * Load one authorized activity page without mutating booking data.
		 *
		 * @param {number} page One-based activity page.
		 * @return {void}
		 */
		function load_activity_page( page ) {
			var generation = request_generation;
			var activity_generation;
			var pagination = active_booking && active_booking.activity ? active_booking.activity.pagination : {};
			var activity_message;
			var page_request;

			if ( is_dirty || is_saving || ! active_booking || ! transport.activity_action || ! transport.activity_nonce || page < 1 ) {
				return;
			}
			if ( activity_request && 'function' === typeof activity_request.abort ) {
				activity_request.abort();
			}
			activity_request_generation += 1;
			activity_generation = activity_request_generation;
			activity_message = shell_root.querySelector( '[data-wpbc-booking-activity-message]' );
			if ( activity_message ) {
				activity_message.textContent = i18n.loading_activity || '';
			}
			page_request = window.jQuery.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.activity_action,
					nonce: transport.activity_nonce,
					booking_id: active_booking.booking_id,
					source: transport.source,
					page: page,
					per_page: pagination && pagination.per_page ? pagination.per_page : 20
				}
			} ).done( function ( response ) {
				if ( generation !== request_generation || activity_generation !== activity_request_generation || ! response || ! response.success || ! response.data || ! response.data.activity || ! active_booking ) {
					return;
				}
				active_booking.activity = response.data.activity;
				render_booking( active_booking, '', 'activity' );
			} ).fail( function ( failed_request, request_status ) {
				var error;
				var message;

				if ( 'abort' === request_status || generation !== request_generation || activity_generation !== activity_request_generation || ! shared_inspector.is_open() ) {
					return;
				}
				error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
				message = shell_root.querySelector( '[data-wpbc-booking-activity-message]' );
				if ( message ) {
					message.textContent = error.message || i18n.activity_error || i18n.error || '';
				}
			} ).always( function () {
				if ( activity_request === page_request ) {
					activity_request = null;
				}
			} );
			activity_request = page_request;
		}

		/**
		 * Handle domain controls rendered inside the Inspector shell.
		 *
		 * @param {MouseEvent} event Inspector click event.
		 * @return {void}
		 */
		function handle_inspector_click( event ) {
			var activity_page_button = event.target.closest( '[data-wpbc-booking-activity-page]' );
			var date_editor_button = event.target.closest( '[data-wpbc-booking-date-editor-open]' );
			var rescheduling_button = event.target.closest( '[data-wpbc-booking-rescheduling-open]' );

			if ( date_editor_button && date_editor_controller && active_booking ) {
				event.preventDefault();
				if ( is_dirty || is_saving ) {
					set_save_feedback( 'error', i18n.finish_edits_before_action || '' );
					return;
				}
				if ( rescheduling_controller && ! rescheduling_controller.prepare_for_parent_switch() ) {
					return;
				}
				date_editor_controller.open( date_editor_button, { booking_id: active_booking.booking_id } );
			} else if ( rescheduling_button && rescheduling_controller && active_booking ) {
				event.preventDefault();
				if ( is_dirty || is_saving ) {
					set_save_feedback( 'error', i18n.finish_edits_before_action || '' );
					return;
				}
				if ( date_editor_controller && ! date_editor_controller.prepare_for_parent_switch() ) {
					return;
				}
				rescheduling_controller.open( rescheduling_button, { booking_id: active_booking.booking_id } );
			} else if ( activity_page_button ) {
				event.preventDefault();
				load_activity_page( Number( activity_page_button.getAttribute( 'data-wpbc-booking-activity-page' ) ) || 0 );
			} else if ( event.target.closest( '[data-wpbc-booking-inspector-cancel]' ) ) {
				event.preventDefault();
				cancel_changes();
			} else if ( event.target.closest( '[data-wpbc-booking-inspector-save]' ) ) {
				event.preventDefault();
				save_changes();
			}
		}

		/**
		 * Protect unsaved drafts from canonical Booking Listing actions.
		 *
		 * The capture phase prevents inline Listing handlers from running before
		 * the booking-domain dirty-state guard has evaluated the action.
		 *
		 * @param {MouseEvent} event Inspector action-menu click event.
		 * @return {void}
		 */
		function handle_action_menu_click( event ) {
			var action_link = event.target.closest( '.wpbc_booking_inspector__action_menu .ul_dropdown_menu_li_action' );
			var inspector_content;
			var inspector_header;

			if ( ! action_link || ! shell_root.contains( action_link ) ) {
				return;
			}
			synchronize_listing_notification_intent();
			if ( is_dirty || is_saving ) {
				event.preventDefault();
				event.stopImmediatePropagation();
				set_save_feedback( 'error', i18n.finish_edits_before_action || '' );
				return;
			}
			if ( action_link.classList.contains( 'ul_dropdown_menu_li_action_set_print' ) ) {
				event.preventDefault();
				event.stopImmediatePropagation();
				inspector_content = shell_root.querySelector( '.wpbc_booking_inspector' );
				inspector_header = shell_root.querySelector( '.wpbc_shared_ui_inspector__header_content' );
				if (
					'function' !== typeof window.wpbc_print_dialog__show_elements
					|| ! window.wpbc_print_dialog__show_elements(
						[ inspector_header, inspector_content ].filter( Boolean ),
						'wpbc_booking_inspector__print_content'
					)
				) {
					if ( 'function' === typeof window.wpbc_admin_show_message ) {
						window.wpbc_admin_show_message( i18n.action_error || '', 'error', 10000 );
					}
				}
			}
		}

		/**
		 * Build the stable identity for one canonical Booking Action request.
		 *
		 * @param {Object} action_result Normalized Booking Action event detail.
		 * @return {string} Booking and action identity, or an empty string when invalid.
		 */
		function get_booking_action_identity( action_result ) {
			var booking_id = Number( action_result && action_result.booking_id ? action_result.booking_id : 0 );
			var action = String( action_result && action_result.action ? action_result.action : '' );

			return booking_id && action ? String( booking_id ) + ':' + action : '';
		}

		/**
		 * Retain a canonical Booking Action started for the open Inspector booking.
		 *
		 * The request is owned by the established Booking Actions transport and can
		 * outlive this panel. Retaining only its stable identity lets completion
		 * invalidate the host even when the user closes or switches the Inspector.
		 *
		 * @param {CustomEvent} event Normalized booking-action start event.
		 * @return {void}
		 */
		function handle_booking_action_start( event ) {
			var action_result = event && event.detail ? event.detail : {};
			var action_identity = get_booking_action_identity( action_result );
			var booking_id = Number( action_result.booking_id || 0 );

			if ( ! action_identity || ! active_booking || booking_id !== Number( active_booking.booking_id || 0 ) ) {
				return;
			}
			pending_booking_actions[ action_identity ] = Number( pending_booking_actions[ action_identity ] || 0 ) + 1;
		}

		/**
		 * Consume one previously retained canonical Booking Action identity.
		 *
		 * @param {Object} action_result Normalized Booking Action completion detail.
		 * @return {boolean} Whether this Inspector observed the matching request start.
		 */
		function consume_pending_booking_action( action_result ) {
			var action_identity = get_booking_action_identity( action_result );
			var pending_count = action_identity ? Number( pending_booking_actions[ action_identity ] || 0 ) : 0;

			if ( ! pending_count ) {
				return false;
			}
			if ( 1 === pending_count ) {
				delete pending_booking_actions[ action_identity ];
			} else {
				pending_booking_actions[ action_identity ] = pending_count - 1;
			}
			return true;
		}

		/**
		 * Reconcile the Inspector and host after a canonical Booking Listing action.
		 *
		 * @param {CustomEvent} event Normalized booking-action completion event.
		 * @return {void}
		 */
		function handle_booking_action_complete( event ) {
			var action_result = event && event.detail ? event.detail : {};
			var action = String( action_result.action || '' );
			var action_message = String( action_result.message || '' );
			var completed_booking_id = Number( action_result.booking_id || 0 );
			var is_pending_action = consume_pending_booking_action( action_result );
			var is_active_booking = Boolean( active_booking && completed_booking_id === Number( active_booking.booking_id || 0 ) );
			var active_trigger;

			if ( ! is_pending_action && ! is_active_booking ) {
				return;
			}
			if ( ! action_result.success ) {
				if ( is_active_booking ) {
					set_save_feedback( 'error', action_message || i18n.action_error || '' );
				}
				return;
			}
			if ( is_pending_action && ! is_active_booking ) {
				dispatch_booking_saved( { booking_id: completed_booking_id }, [] );
				return;
			}
			if ( -1 !== [ 'move_booking_to_trash', 'delete_booking_completely' ].indexOf( action ) ) {
				dispatch_booking_saved( { booking_id: active_booking.booking_id }, [] );
				shared_inspector.close();
				return;
			}
			if ( is_dirty || is_saving ) {
				set_save_feedback( 'success', action_message );
				return;
			}
			active_trigger = get_active_trigger();
			if ( active_trigger ) {
				open( active_trigger, function ( refreshed_booking ) {
					dispatch_booking_saved( refreshed_booking, [] );
					set_save_feedback( 'success', action_message );
				} );
			} else {
				set_save_feedback( 'success', action_message );
			}
		}

		shell_root.addEventListener( 'input', handle_draft_change );
		shell_root.addEventListener( 'change', handle_draft_change );
		shell_root.addEventListener( 'click', handle_action_menu_click, true );
		shell_root.addEventListener( 'click', handle_inspector_click );

		/**
		 * Open one authorized booking and load its lazy details DTO.
		 *
		 * @param {HTMLElement} trigger           Activated booking trigger.
		 * @param {Function}    on_booking_loaded Optional callback receiving the authoritative booking DTO after render.
		 * @return {void}
		 */
		function open( trigger, on_booking_loaded ) {
			var booking_id = Number( trigger.getAttribute( 'data-wpbc-booking-id' ) ) || 0;
			var generation;
			var date_editor_is_dirty = Boolean( date_editor_controller && date_editor_controller.is_dirty() );
			var rescheduling_is_dirty = Boolean( rescheduling_controller && rescheduling_controller.is_dirty() );

			if ( ! booking_id || ! transport.source ) {
				return;
			}
			if ( rescheduling_controller && rescheduling_controller.is_busy && rescheduling_controller.is_busy() ) {
				set_save_feedback( 'error', i18n.finish_edits_before_action || '' );
				return;
			}
			if ( shared_inspector.is_open() && active_booking_id && ( is_dirty || date_editor_is_dirty || rescheduling_is_dirty ) ) {
				if ( ! window.confirm( i18n.discard_changes || '' ) ) {
					return;
				}
				if ( date_editor_controller ) {
					date_editor_controller.force_close();
				}
				if ( rescheduling_controller ) {
					rescheduling_controller.force_close();
				}
			} else {
				if ( date_editor_controller && ! date_editor_controller.prepare_for_parent_switch() ) {
					return;
				}
				if ( rescheduling_controller && ! rescheduling_controller.prepare_for_parent_switch() ) {
					return;
				}
			}

			abort_request();
			generation = request_generation;
			shared_inspector.open( get_trigger_focus_target( trigger ) || trigger );
			set_active_trigger( trigger );
			if ( 'function' === typeof shared_inspector.reset_header ) {
				shared_inspector.reset_header( i18n.title || '' );
			}
			render_state( 'loading', i18n.loading || '', true );
			if ( ! window.jQuery || ! transport.url || ! transport.action || ! transport.nonce ) {
				render_state( 'error', i18n.error || '', false );
				return;
			}

			request = window.jQuery.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.action,
					nonce: transport.nonce,
					booking_id: booking_id,
					source: transport.source
				}
			} ).done( function ( response ) {
				if ( generation !== request_generation || ! shared_inspector.is_open() || ! response || ! response.success || ! response.data || ! response.data.booking ) {
					return;
				}
				render_booking( response.data.booking, i18n.loaded || '', 'details' );
				if ( 'function' === typeof on_booking_loaded ) {
					on_booking_loaded( response.data.booking );
				}
			} ).fail( function ( failed_request, request_status ) {
				var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};

				if ( generation !== request_generation || 'abort' === request_status || ! shared_inspector.is_open() ) {
					return;
				}
				render_state( 'error', error.message || i18n.error || '', false );
			} ).always( function () {
				if ( generation === request_generation ) {
					request = null;
				}
			} );
		}

		/**
		 * Open one booking directly into its canonical full Reschedule dialog.
		 *
		 * The Inspector still performs its normal authorized booking read first. The
		 * rescheduling domain then receives only the canonical booking identifier and
		 * retains ownership of review, validation, focus, and future apply behavior.
		 *
		 * @param {HTMLElement} booking_trigger Booking identity trigger.
		 * @param {HTMLElement} action_trigger  Resize handle that restores focus.
		 * @return {void}
		 */
		function open_rescheduling( booking_trigger, action_trigger ) {
			open( booking_trigger, function ( booking ) {
				if ( rescheduling_controller && booking && booking.booking_id ) {
					rescheduling_controller.open( action_trigger || booking_trigger, { booking_id: booking.booking_id } );
				}
			} );
		}

		/**
		 * Activate a booking trigger through delegated pointer input.
		 *
		 * @param {MouseEvent} event Host click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var trigger = event.target.closest( trigger_selector );

			if ( ! trigger || ! host_root.contains( trigger ) ) {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			open( trigger );
		}

		/**
		 * Activate a focused booking trigger with Enter or Space.
		 *
		 * @param {KeyboardEvent} event Host keyboard event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			var trigger = event.target.closest( trigger_selector );

			if ( ! trigger || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || -1 === [ 'Enter', ' ' ].indexOf( event.key ) ) {
				return;
			}
			event.preventDefault();
			event.stopImmediatePropagation();
			open( trigger );
		}

		if ( 'delegated' === activation_mode ) {
			host_root.addEventListener( 'click', handle_click );
			host_root.addEventListener( 'keydown', handle_keydown );
		}
		window.addEventListener( 'wpbc:booking-action:start', handle_booking_action_start );
		window.addEventListener( 'wpbc:booking-action:complete', handle_booking_action_complete );

		return {
			open: open,
			open_rescheduling: open_rescheduling,
			refresh_after_external_apply: refresh_after_external_apply,
			refresh: refresh,
			close: function () {
				shared_inspector.close( true );
			},
			destroy: function () {
				if ( date_editor_controller ) {
					date_editor_controller.destroy();
					date_editor_controller = null;
				}
				if ( rescheduling_controller ) {
					rescheduling_controller.destroy();
					rescheduling_controller = null;
				}
				abort_request();
				clear_active_trigger();
				shell_root.removeEventListener( 'input', handle_draft_change );
				shell_root.removeEventListener( 'change', handle_draft_change );
				shell_root.removeEventListener( 'click', handle_action_menu_click, true );
				shell_root.removeEventListener( 'click', handle_inspector_click );
				if ( 'delegated' === activation_mode ) {
					host_root.removeEventListener( 'click', handle_click );
					host_root.removeEventListener( 'keydown', handle_keydown );
				}
				window.removeEventListener( 'wpbc:booking-action:start', handle_booking_action_start );
				window.removeEventListener( 'wpbc:booking-action:complete', handle_booking_action_complete );
				document.removeEventListener( 'change', handle_notification_intent_change, true );
			}
		};
	}

	window.wpbc_booking_inspector = window.wpbc_booking_inspector || {};
	window.wpbc_booking_inspector.create = create;
}( window, document, window.wp ) );
