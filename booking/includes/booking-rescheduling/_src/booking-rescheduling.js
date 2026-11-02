/**
 * Accessible Booking Rescheduling dialog adapter.
 *
 * This adapter owns local draft, dialog, review, request-cancellation, and
 * focus behavior. It deliberately delegates every native calendar global and
 * the standard calendar AJAX request to the Date Editor's exported adapter.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, $ ) {
	'use strict';

	var EVENT_NAMESPACE = '.wpbcBookingRescheduling';
	var NATIVE_LOAD_TIMEOUT_MS = 30000;
	var MODE_POLICY = 'policy';
	var MODE_INDIVIDUAL = 'individual';
	var TIME_FULL_DAY = 'full_day';
	var TIME_BOUNDARY = 'boundary';
	var TIME_PER_DATE = 'per_date';

	/**
	 * Return a positive integer or zero.
	 *
	 * @param {*} candidate Candidate identifier.
	 * @return {number} Positive integer or zero.
	 */
	function normalize_id( candidate ) {
		var normalized = Number( candidate );

		return Number.isInteger( normalized ) && normalized > 0 ? normalized : 0;
	}

	/**
	 * Normalize one exact-minute time.
	 *
	 * @param {*} candidate Candidate time.
	 * @return {string} `HH:MM` or an empty string.
	 */
	function normalize_time( candidate ) {
		var normalized = String( candidate || '' ).trim();

		return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test( normalized ) ? normalized : '';
	}

	/**
	 * Normalize strict ISO dates without applying timezone conversion.
	 *
	 * @param {*} candidates Candidate date collection.
	 * @return {Array<string>} Ordered unique valid dates.
	 */
	function normalize_dates( candidates ) {
		var unique_dates = {};

		( Array.isArray( candidates ) ? candidates : [] ).forEach( function ( candidate ) {
			var date_value = String( candidate || '' );
			var date_parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec( date_value );
			var test_date;

			if ( ! date_parts ) {
				return;
			}
			test_date = new Date( Date.UTC( Number( date_parts[ 1 ] ), Number( date_parts[ 2 ] ) - 1, Number( date_parts[ 3 ] ) ) );
			if (
				test_date.getUTCFullYear() === Number( date_parts[ 1 ] ) &&
				test_date.getUTCMonth() === Number( date_parts[ 2 ] ) - 1 &&
				test_date.getUTCDate() === Number( date_parts[ 3 ] )
			) {
				unique_dates[ date_value ] = date_value;
			}
		} );

		return Object.keys( unique_dates ).sort();
	}

	/**
	 * Clone the executable-free local proposal draft.
	 *
	 * @param {Object} candidate Candidate draft.
	 * @return {Object} Independent normalized draft.
	 */
	function clone_draft( candidate ) {
		candidate = candidate && 'object' === typeof candidate ? candidate : {};

		return {
			target_resource_id: normalize_id( candidate.target_resource_id ),
			selection_method: MODE_INDIVIDUAL === candidate.selection_method ? MODE_INDIVIDUAL : MODE_POLICY,
			time_application: -1 !== [ TIME_FULL_DAY, TIME_BOUNDARY, TIME_PER_DATE ].indexOf( candidate.time_application ) ? candidate.time_application : TIME_FULL_DAY,
			start_time: normalize_time( candidate.start_time ),
			end_time: normalize_time( candidate.end_time ),
			selected_dates: normalize_dates( candidate.selected_dates ),
			proposal_revision: Math.max( 1, normalize_id( candidate.proposal_revision ) )
		};
	}

	/**
	 * Freeze the immutable saved proposal state.
	 *
	 * @param {Object} candidate Candidate server initial state.
	 * @return {Object} Frozen normalized draft.
	 */
	function freeze_draft( candidate ) {
		var frozen = clone_draft( candidate );

		Object.freeze( frozen.selected_dates );

		return Object.freeze( frozen );
	}

	/**
	 * Return the meaningful comparison projection for dirty-state checks.
	 *
	 * @param {Object} candidate Normalized draft.
	 * @return {Object} Stable comparison record.
	 */
	function compare_draft( candidate ) {
		var normalized = clone_draft( candidate );

		delete normalized.proposal_revision;
		if ( TIME_FULL_DAY === normalized.time_application ) {
			normalized.start_time = '';
			normalized.end_time = '';
		}

		return normalized;
	}

	/**
	 * Add calendar days to one strict ISO date without local-time conversion.
	 *
	 * @param {string} iso_date Strict ISO date.
	 * @param {number} day_count Signed number of days.
	 * @return {string} Shifted ISO date or an empty string.
	 */
	function add_days( iso_date, day_count ) {
		var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec( iso_date );
		var shifted;

		if ( ! parts ) {
			return '';
		}
		shifted = new Date( Date.UTC( Number( parts[ 1 ] ), Number( parts[ 2 ] ) - 1, Number( parts[ 3 ] ) + day_count ) );

		return shifted.getUTCFullYear() + '-' + String( shifted.getUTCMonth() + 1 ).padStart( 2, '0' ) + '-' + String( shifted.getUTCDate() ).padStart( 2, '0' );
	}

	/**
	 * Convert an offset in minutes to an RFC3339 suffix.
	 *
	 * @param {number} offset_minutes Minutes east of UTC.
	 * @return {string} Signed `HH:MM` offset.
	 */
	function format_offset( offset_minutes ) {
		var sign = offset_minutes < 0 ? '-' : '+';
		var absolute = Math.abs( offset_minutes );

		return sign + String( Math.floor( absolute / 60 ) ).padStart( 2, '0' ) + ':' + String( absolute % 60 ).padStart( 2, '0' );
	}

	/**
	 * Read wall-clock parts for one instant in an IANA timezone.
	 *
	 * @param {number} timestamp_ms UTC timestamp in milliseconds.
	 * @param {string} timezone_name IANA timezone name.
	 * @return {Object|null} Numeric wall parts or null when unsupported.
	 */
	function get_zoned_parts( timestamp_ms, timezone_name ) {
		var formatter;
		var parts;
		var result = {};

		try {
			formatter = new Intl.DateTimeFormat( 'en-CA', {
				timeZone: timezone_name,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23'
			} );
			parts = formatter.formatToParts( new Date( timestamp_ms ) );
		} catch ( timezone_error ) {
			return null;
		}
		parts.forEach( function ( part ) {
			if ( -1 !== [ 'year', 'month', 'day', 'hour', 'minute' ].indexOf( part.type ) ) {
				result[ part.type ] = Number( part.value );
			}
		} );

		return 5 === Object.keys( result ).length ? result : null;
	}

	/**
	 * Resolve one site-local exact minute to an unambiguous RFC3339 instant.
	 *
	 * Candidate offsets are derived from the site timezone around the wall time.
	 * Zero matches rejects a nonexistent DST minute; multiple matches rejects an
	 * ambiguous repeated minute rather than silently choosing a fold.
	 *
	 * @param {string} iso_date      Strict local site date.
	 * @param {string} exact_time    Strict exact-minute time.
	 * @param {string} timezone_name WordPress site timezone name or fixed offset.
	 * @return {string|null} RFC3339 instant or null when invalid/ambiguous.
	 */
	function wall_time_to_rfc3339( iso_date, exact_time, timezone_name ) {
		var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec( iso_date );
		var time_match = /^(\d{2}):(\d{2})$/.exec( exact_time );
		var fixed_offset = /^([+-])(\d{2}):(\d{2})$/.exec( timezone_name );
		var wall_timestamp;
		var offsets = {};
		var matches = [];

		if ( ! match || ! time_match ) {
			return null;
		}
		if ( fixed_offset ) {
			return iso_date + 'T' + exact_time + ':00' + timezone_name;
		}
		wall_timestamp = Date.UTC( Number( match[ 1 ] ), Number( match[ 2 ] ) - 1, Number( match[ 3 ] ), Number( time_match[ 1 ] ), Number( time_match[ 2 ] ) );
		[ -172800000, -86400000, 0, 86400000, 172800000 ].forEach( function ( delta ) {
			var zoned_parts = get_zoned_parts( wall_timestamp + delta, timezone_name );
			var zoned_as_utc;

			if ( zoned_parts ) {
				zoned_as_utc = Date.UTC( zoned_parts.year, zoned_parts.month - 1, zoned_parts.day, zoned_parts.hour, zoned_parts.minute );
				offsets[ Math.round( ( zoned_as_utc - ( wall_timestamp + delta ) ) / 60000 ) ] = true;
			}
		} );
		Object.keys( offsets ).forEach( function ( offset_key ) {
			var offset_minutes = Number( offset_key );
			var candidate_timestamp = wall_timestamp - ( offset_minutes * 60000 );
			var candidate_parts = get_zoned_parts( candidate_timestamp, timezone_name );

			if (
				candidate_parts &&
				candidate_parts.year === Number( match[ 1 ] ) &&
				candidate_parts.month === Number( match[ 2 ] ) &&
				candidate_parts.day === Number( match[ 3 ] ) &&
				candidate_parts.hour === Number( time_match[ 1 ] ) &&
				candidate_parts.minute === Number( time_match[ 2 ] )
			) {
				matches.push( iso_date + 'T' + exact_time + ':00' + format_offset( offset_minutes ) );
			}
		} );

		return 1 === matches.length ? matches[ 0 ] : null;
	}

	/**
	 * Create one accessible rescheduling controller inside an Inspector shell.
	 *
	 * @param {HTMLElement} inspector_shell Booking Inspector root.
	 * @param {Object}      configuration   Server-owned dialog configuration.
	 * @param {Object}      options         Host transport and readback callbacks.
	 * @return {Object|null} Controller API or null when dependencies are absent.
	 */
	function create_controller( inspector_shell, configuration, options ) {
		var settings = configuration && 'object' === typeof configuration ? configuration : {};
		var controller_options = options && 'object' === typeof options ? options : {};
		var templates = settings.templates && 'object' === typeof settings.templates ? settings.templates : {};
		var i18n = settings.i18n && 'object' === typeof settings.i18n ? settings.i18n : {};
		var dialog_template = window.wp && templates.dialog ? window.wp.template( templates.dialog ) : null;
		var review_template = window.wp && templates.review ? window.wp.template( templates.review ) : null;
		var inspector_panel = inspector_shell ? inspector_shell.querySelector( '.wpbc_shared_ui_inspector__panel' ) : null;
		var layer = null;
		var opener = null;
		var active_dto = null;
		var saved_draft = null;
		var draft = null;
		var retry_draft = null;
		var active_review = null;
		var pending_apply_result = null;
		var native_adapter = null;
		var read_request = null;
		var review_request = null;
		var apply_request = null;
		var generation = 0;
		var review_generation = 0;
		var apply_generation = 0;
		var native_timeout = null;
		var dirty = false;

		if (
			! settings.active || ! dialog_template || ! review_template || ! inspector_panel || ! window.jQuery ||
			! window.wpbc_booking_date_editor || 'function' !== typeof window.wpbc_booking_date_editor.create_native_calendar_adapter
		) {
			return null;
		}

		/** @return {void} Clear the bounded native-load timeout. */
		function clear_native_timeout() {
			if ( null !== native_timeout ) {
				window.clearTimeout( native_timeout );
				native_timeout = null;
			}
		}

		/**
		 * Update the Inspector-owned dirty state.
		 *
		 * @return {void}
		 */
		function update_dirty() {
			var next_dirty = Boolean( saved_draft && draft && JSON.stringify( compare_draft( saved_draft ) ) !== JSON.stringify( compare_draft( draft ) ) );

			if ( next_dirty !== dirty ) {
				dirty = next_dirty;
				if ( 'function' === typeof controller_options.on_dirty_change ) {
					controller_options.on_dirty_change( dirty );
				}
			}
		}

		/**
		 * Announce one safe lifecycle message.
		 *
		 * @param {string}  message Message text.
		 * @param {boolean} visible Whether the strip is visible.
		 * @param {string}  severity `warning` or `error`.
		 * @return {void}
		 */
		function set_status( message, visible, severity ) {
			var status = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-status]' ) : null;

			if ( ! status ) {
				return;
			}
			status.textContent = String( message || '' );
			status.classList.toggle( 'is-visible', Boolean( visible && message ) );
			status.classList.toggle( 'is-error', Boolean( visible && message && 'error' === severity ) );
			status.classList.toggle( 'is-warning', Boolean( visible && message && 'error' !== severity ) );
			status.setAttribute( 'role', 'error' === severity ? 'alert' : 'status' );
			status.setAttribute( 'aria-live', 'error' === severity ? 'assertive' : 'polite' );
		}

		/**
		 * Show the loading state without discarding the current proposal.
		 *
		 * @param {string} message Loading message.
		 * @return {void}
		 */
		function show_loading( message ) {
			var loading = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-loading]' ) : null;
			var label = loading ? loading.querySelector( '[data-wpbc-booking-rescheduling-loading-label]' ) : null;
			var error = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-error]' ) : null;
			var editor = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-view="editor"]' ) : null;
			var review = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-view="review"]' ) : null;

			if ( label ) {
				label.textContent = String( message || i18n.loading || '' );
			}
			if ( loading ) {
				loading.hidden = false;
			}
			if ( error ) {
				error.hidden = true;
			}
			if ( editor ) {
				editor.hidden = true;
			}
			if ( review ) {
				review.hidden = true;
			}
			if ( layer ) {
				layer.setAttribute( 'aria-busy', 'true' );
			}
			set_status( message, false, 'warning' );
		}

		/**
		 * Show one recoverable safe error.
		 *
		 * @param {string} message Error message.
		 * @return {void}
		 */
		function show_error( message ) {
			var loading = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-loading]' ) : null;
			var error = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-error]' ) : null;
			var error_message = error ? error.querySelector( '[data-wpbc-booking-rescheduling-error-message]' ) : null;

			clear_native_timeout();
			if ( loading ) {
				loading.hidden = true;
			}
			if ( error ) {
				error.hidden = false;
			}
			if ( error_message ) {
				error_message.textContent = String( message || i18n.load_error || '' );
			}
			if ( layer ) {
				layer.setAttribute( 'aria-busy', 'false' );
			}
			set_status( message, false, 'error' );
		}

		/**
		 * Return the best focus restoration target after rerenders.
		 *
		 * @return {HTMLElement|null} Connected focus target.
		 */
		function get_restore_focus() {
			var fallback;

			if ( opener && opener.isConnected ) {
				return opener;
			}
			fallback = 'function' === typeof controller_options.get_restore_focus ? controller_options.get_restore_focus() : null;

			return fallback && fallback.isConnected ? fallback : null;
		}

		/**
		 * Abort requests, tear down the shared adapter, and remove the layer.
		 *
		 * @return {void}
		 */
		function teardown() {
			generation += 1;
			review_generation += 1;
			apply_generation += 1;
			clear_native_timeout();
			[ read_request, review_request, apply_request ].forEach( function ( pending_request ) {
				if ( pending_request && 'function' === typeof pending_request.abort ) {
					pending_request.abort();
				}
			} );
			read_request = null;
			review_request = null;
			apply_request = null;
			if ( native_adapter ) {
				native_adapter.teardown();
			}
			native_adapter = null;
			if ( layer ) {
				window.jQuery( layer ).off( 'date_selected' + EVENT_NAMESPACE );
				layer.remove();
			}
			layer = null;
			active_dto = null;
			saved_draft = null;
			draft = null;
			retry_draft = null;
			active_review = null;
			pending_apply_result = null;
			dirty = false;
			if ( 'function' === typeof controller_options.on_dirty_change ) {
				controller_options.on_dirty_change( false );
			}
		}

		/**
		 * Close with optional dirty protection and focus restoration.
		 *
		 * @param {boolean} restore_focus Whether to restore the opener.
		 * @param {boolean} force         Whether a parent already approved discard.
		 * @return {boolean} True when closed or already closed.
		 */
		function close( restore_focus, force ) {
			var focus_target;

			if ( ! layer ) {
				return true;
			}
			if ( ! force && ( apply_request || pending_apply_result ) ) {
				set_status( pending_apply_result ? ( i18n.readback_error || '' ) : ( i18n.applying || '' ), true, pending_apply_result ? 'error' : 'warning' );
				return false;
			}
			if ( dirty && ! force && ! window.confirm( i18n.discard_changes || '' ) ) {
				return false;
			}
			focus_target = restore_focus ? get_restore_focus() : null;
			teardown();
			opener = null;
			if ( focus_target ) {
				window.setTimeout( function () {
					if ( focus_target.isConnected ) {
						focus_target.focus();
					}
				}, 0 );
			}

			return true;
		}

		/**
		 * Render the dialog through its allow-listed domain template.
		 *
		 * @param {Object} template_values Authorized DTO and draft values.
		 * @return {HTMLElement|null} Rendered layer.
		 */
		function render_layer( template_values ) {
			var host = document.createElement( 'div' );
			var rendered;

			if ( layer ) {
				layer.remove();
			}
			host.innerHTML = dialog_template( Object.assign( {
				inspector_id: 'wpbc_booking_inspector',
				i18n: i18n,
				resources: [],
				selected_dates: []
			}, template_values || {} ) );
			rendered = host.querySelector( '[data-wpbc-booking-rescheduling-layer]' );
			if ( ! rendered ) {
				return null;
			}
			inspector_panel.appendChild( rendered );
			layer = rendered;

			return layer;
		}

		/**
		 * Synchronize visible controls and dirty state from the mutable draft.
		 *
		 * @return {void}
		 */
		function render_draft() {
			var selected_list = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-selected-dates]' ) : null;
			var time_fields = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-time-fields]' ) : null;
			var review_button = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-review]' ) : null;
			var reviewable;

			if ( ! draft ) {
				return;
			}
			if ( time_fields ) {
				time_fields.hidden = TIME_FULL_DAY === draft.time_application;
			}
			if ( selected_list ) {
				selected_list.textContent = '';
				if ( ! draft.selected_dates.length ) {
					var empty_item = document.createElement( 'li' );
					empty_item.className = 'wpbc_booking_inspector__muted';
					empty_item.textContent = String( i18n.no_selected_dates || '' );
					selected_list.appendChild( empty_item );
				} else {
					draft.selected_dates.forEach( function ( selected_date ) {
						var date_item = document.createElement( 'li' );
						date_item.textContent = selected_date;
						selected_list.appendChild( date_item );
					} );
				}
			}
			update_dirty();
			reviewable = dirty && draft.selected_dates.length > 0 && ( TIME_FULL_DAY === draft.time_application || Boolean( normalize_time( draft.start_time ) && normalize_time( draft.end_time ) ) );
			if ( review_button ) {
				review_button.disabled = ! reviewable;
				review_button.setAttribute( 'aria-disabled', reviewable ? 'false' : 'true' );
			}
		}

		/**
		 * Show the editor after a successful native calendar load.
		 *
		 * @param {string}  message Completion message.
		 * @param {boolean} warning Whether the message is a visible warning.
		 * @return {void}
		 */
		function show_ready( message, warning ) {
			var loading = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-loading]' ) : null;
			var error = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-error]' ) : null;
			var editor = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-view="editor"]' ) : null;

			if ( loading ) {
				loading.hidden = true;
			}
			if ( error ) {
				error.hidden = true;
			}
			if ( editor ) {
				editor.hidden = false;
			}
			if ( layer ) {
				layer.setAttribute( 'aria-busy', 'false' );
			}
			set_status( message, warning, 'warning' );
		}

		/**
		 * Restore exact proposed dates after canonical native availability loads.
		 *
		 * @param {number} current_generation Matching controller generation.
		 * @param {number} attempt            Zero-based animation-frame attempt.
		 * @return {void}
		 */
		function hydrate_dates( current_generation, attempt ) {
			var restored;

			if ( current_generation !== generation || ! native_adapter || ! draft ) {
				return;
			}
			restored = native_adapter.set_exact_selected_dates( draft.selected_dates );
			if ( restored ) {
				draft.selected_dates = native_adapter.get_selected_dates();
				render_draft();
				show_ready( i18n.loaded || '', false );
				return;
			}
			if ( attempt < 3 ) {
				window.requestAnimationFrame( function () {
					hydrate_dates( current_generation, attempt + 1 );
				} );
				return;
			}
			native_adapter.set_selection_mode( MODE_INDIVIDUAL );
			restored = native_adapter.set_exact_selected_dates( draft.selected_dates );
			draft.selection_method = MODE_INDIVIDUAL;
			draft.selected_dates = restored ? native_adapter.get_selected_dates() : draft.selected_dates.slice( 0 );
			Array.prototype.forEach.call( layer.querySelectorAll( '[data-wpbc-booking-rescheduling-selection-method]' ), function ( control ) {
				control.checked = MODE_INDIVIDUAL === control.value;
			} );
			render_draft();
			show_ready( i18n.hydration_warning || '', true );
		}

		/**
		 * Mount the sole shared native calendar adapter and load availability.
		 *
		 * @param {number} current_generation Matching controller generation.
		 * @return {void}
		 */
		function mount_calendar( current_generation ) {
			var calendar = active_dto && active_dto.calendar ? active_dto.calendar : {};
			var calendar_host = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-calendar-host]' ) : null;

			native_adapter = window.wpbc_booking_date_editor.create_native_calendar_adapter();
			if ( ! native_adapter.mount( calendar_host, {
				resource_id: active_dto.target_resource_id,
				calendar_html: calendar.html || '',
				calendar_parameters: calendar.calendar_parameters || {},
				policy_parameters: calendar.policy_parameters || {},
				context_parameters: calendar.context_parameters || {},
				secure_parameters: calendar.secure_parameters || {}
			} ) ) {
				show_error( i18n.calendar_error || '' );
				return;
			}
			window.jQuery( layer ).off( 'date_selected' + EVENT_NAMESPACE ).on( 'date_selected' + EVENT_NAMESPACE, function ( event, resource_id, clicked_dates, selected_dates ) {
				if ( current_generation !== generation || normalize_id( resource_id ) !== normalize_id( active_dto.target_resource_id ) || ! draft ) {
					return;
				}
				draft.selected_dates = normalize_dates( selected_dates );
				draft.proposal_revision += 1;
				active_review = null;
				render_draft();
			} );
			set_status( i18n.loading_calendar || '', false, 'warning' );
			clear_native_timeout();
			native_timeout = window.setTimeout( function () {
				if ( current_generation === generation && native_adapter ) {
					native_adapter.abort_load();
					show_error( i18n.calendar_error || '' );
				}
			}, NATIVE_LOAD_TIMEOUT_MS );
			if ( ! native_adapter.load( calendar.request_parameters || {}, function () {
				clear_native_timeout();
				if ( current_generation !== generation || ! draft ) {
					return;
				}
				native_adapter.set_selection_mode( draft.selection_method );
				hydrate_dates( current_generation, 0 );
			}, function () {
				clear_native_timeout();
				if ( current_generation === generation ) {
					show_error( i18n.calendar_error || '' );
				}
			} ) ) {
				show_error( i18n.calendar_error || '' );
			}
		}

		/**
		 * Initialize the local immutable saved state and mutable proposed state.
		 *
		 * @param {Object} dialog_dto       Authorized server DTO.
		 * @param {number} current_generation Matching generation.
		 * @param {Object|null} preserved_draft Draft preserved across target reload.
		 * @return {void}
		 */
		function initialize( dialog_dto, current_generation, preserved_draft ) {
			var initial;

			active_dto = dialog_dto;
			if ( ! dialog_dto.supported ) {
				show_error( i18n.unsupported || '' );
				return;
			}
			initial = Object.assign( {}, dialog_dto.initial || {}, { proposal_revision: dialog_dto.proposal_revision || 1 } );
			if ( ! saved_draft ) {
				saved_draft = freeze_draft( initial );
			}
			draft = clone_draft( preserved_draft || initial );
			draft.target_resource_id = normalize_id( dialog_dto.target_resource_id );
			retry_draft = clone_draft( draft );
			render_layer( Object.assign( {}, draft, {
				i18n: i18n,
				resources: dialog_dto.choices && dialog_dto.choices.resources ? dialog_dto.choices.resources : []
			} ) );
			show_loading( i18n.loading_calendar || '' );
			render_draft();
			mount_calendar( current_generation );
		}

		/**
		 * Request a fresh authorized initialization DTO for a target Resource.
		 *
		 * @param {number} target_resource_id Requested target, or zero initially.
		 * @param {Object|null} preserved_draft Proposal to restore after reload.
		 * @return {void}
		 */
		function request_read( target_resource_id, preserved_draft ) {
			var booking_id = active_dto ? normalize_id( active_dto.booking_id ) : 0;
			var current_generation;
			var pending_request;

			if ( ! booking_id || ! controller_options.url || ! controller_options.source || ! settings.read || ! settings.read.action || ! settings.read.nonce ) {
				show_error( i18n.load_error || '' );
				return;
			}
			generation += 1;
			current_generation = generation;
			if ( read_request && 'function' === typeof read_request.abort ) {
				read_request.abort();
			}
			if ( review_request && 'function' === typeof review_request.abort ) {
				review_request.abort();
			}
			review_generation += 1;
			review_request = null;
			active_review = null;
			if ( native_adapter ) {
				native_adapter.teardown();
				native_adapter = null;
			}
			clear_native_timeout();
			retry_draft = preserved_draft ? clone_draft( preserved_draft ) : retry_draft;
			show_loading( i18n.loading || '' );
			pending_request = window.jQuery.ajax( {
				url: controller_options.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: settings.read.action,
					nonce: settings.read.nonce,
					booking_id: booking_id,
					source: controller_options.source,
					target_resource_id: normalize_id( target_resource_id ),
					source_context_token: active_dto && active_dto.source_context_token ? String( active_dto.source_context_token ) : ''
				}
			} ).done( function ( response ) {
				if ( current_generation !== generation || ! response || ! response.success || ! response.data || ! response.data.rescheduling ) {
					return;
				}
				initialize( response.data.rescheduling, current_generation, preserved_draft );
			} ).fail( function ( failed_request, request_status ) {
				var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};

				if ( 'abort' !== request_status && current_generation === generation && layer ) {
					show_error( error.message || i18n.load_error || '' );
				}
			} ).always( function () {
				if ( read_request === pending_request ) {
					read_request = null;
				}
			} );
			read_request = pending_request;
		}

		/**
		 * Build the bounded browser proposal for authoritative review.
		 *
		 * @return {Object|null} Proposal or null for invalid/ambiguous site time.
		 */
		function build_proposal() {
			var timezone_name = active_dto && active_dto.timezone ? String( active_dto.timezone.name || '' ) : '';
			var proposal;
			var first_date;
			var last_date;
			var intervals;

			if ( ! active_dto || ! draft || ! draft.selected_dates.length ) {
				return null;
			}
			proposal = {
				schema_version: Number( settings.schema_version || 0 ),
				booking_id: normalize_id( active_dto.booking_id ),
				interaction_source: 'dialog',
				operation: draft.target_resource_id === normalize_id( active_dto.current_resource_id ) ? 'replace_dates' : 'change_resource',
				target_resource_id: draft.target_resource_id,
				selection_method: draft.selection_method,
				proposal_revision: Math.max( 1, draft.proposal_revision ),
				source_context_token: String( active_dto.source_context_token || '' )
			};
			if ( TIME_FULL_DAY === draft.time_application ) {
				proposal.proposed_dates = draft.selected_dates.slice( 0 );
				return proposal;
			}
			first_date = draft.selected_dates[ 0 ];
			last_date = draft.selected_dates[ draft.selected_dates.length - 1 ];
			if ( TIME_BOUNDARY === draft.time_application ) {
				if ( first_date === last_date && draft.end_time <= draft.start_time ) {
					last_date = add_days( last_date, 1 );
				}
				intervals = [ {
					start: wall_time_to_rfc3339( first_date, draft.start_time, timezone_name ),
					end: wall_time_to_rfc3339( last_date, draft.end_time, timezone_name )
				} ];
			} else {
				intervals = draft.selected_dates.map( function ( selected_date ) {
					var end_date = draft.end_time <= draft.start_time ? add_days( selected_date, 1 ) : selected_date;

					return {
						start: wall_time_to_rfc3339( selected_date, draft.start_time, timezone_name ),
						end: wall_time_to_rfc3339( end_date, draft.end_time, timezone_name )
					};
				} );
			}
			if ( intervals.some( function ( interval ) { return ! interval.start || ! interval.end; } ) ) {
				return null;
			}
			proposal.proposed_intervals = intervals;

			return proposal;
		}

		/**
		 * Render the server-authoritative review DTO.
		 *
		 * @param {Object} response Signed review envelope.
		 * @return {void}
		 */
		function render_review( response ) {
			var loading = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-loading]' ) : null;
			var editor = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-view="editor"]' ) : null;
			var review = layer ? layer.querySelector( '[data-wpbc-booking-rescheduling-view="review"]' ) : null;
			var content = review ? review.querySelector( '[data-wpbc-booking-rescheduling-review-content]' ) : null;
			var apply_button = review ? review.querySelector( '[data-wpbc-booking-rescheduling-apply]' ) : null;
			var back_button = review ? review.querySelector( '[data-wpbc-booking-rescheduling-back]' ) : null;
			var heading;

			if ( ! response || ! response.review || ! response.plan || ! response.token || ! response.expires_at || ! content ) {
				show_ready( '', false );
				set_status( i18n.review_error || '', true, 'error' );
				return;
			}
			active_review = response;
			content.innerHTML = review_template( response.review );
			if ( loading ) {
				loading.hidden = true;
			}
			if ( editor ) {
				editor.hidden = true;
			}
			review.hidden = false;
			if ( apply_button ) {
				apply_button.disabled = false;
				apply_button.setAttribute( 'aria-disabled', 'false' );
				apply_button.textContent = pending_apply_result ? String( i18n.retry_refresh || i18n.retry || '' ) : String( i18n.apply_changes || '' );
			}
			if ( back_button ) {
				back_button.disabled = Boolean( pending_apply_result );
			}
			layer.setAttribute( 'aria-busy', 'false' );
			set_status( '', false, 'warning' );
			heading = content.querySelector( 'h3' );
			if ( heading ) {
				heading.setAttribute( 'tabindex', '-1' );
				heading.focus();
			}
		}

		/** @return {void} Submit the current proposal for non-mutating review. */
		function request_review() {
			var proposal = build_proposal();
			var current_generation;
			var pending_request;

			if ( ! proposal ) {
				set_status( i18n.timezone_error || i18n.review_error || '', true, 'error' );
				return;
			}
			review_generation += 1;
			current_generation = review_generation;
			if ( review_request && 'function' === typeof review_request.abort ) {
				review_request.abort();
			}
			show_loading( i18n.loading_review || '' );
			pending_request = window.jQuery.ajax( {
				url: controller_options.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: settings.review.action,
					nonce: settings.review.nonce,
					booking_id: active_dto.booking_id,
					source: controller_options.source,
					proposal: JSON.stringify( proposal )
				}
			} ).done( function ( response ) {
				if ( current_generation === review_generation && response && response.success && response.data ) {
					render_review( response.data );
				}
			} ).fail( function ( failed_request, request_status ) {
				var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};

				if ( 'abort' !== request_status && current_generation === review_generation && layer ) {
					show_ready( '', false );
					set_status( error.message || i18n.review_error || '', true, 'error' );
				}
			} ).always( function () {
				if ( review_request === pending_request ) {
					review_request = null;
				}
			} );
			review_request = pending_request;
		}

		/**
		 * Ask the Inspector to replace itself from canonical readback.
		 *
		 * @param {Object} submitted_review Review retained for Retry refresh.
		 * @return {void}
		 */
		function request_readback( submitted_review ) {
			var readback;
			var current_generation;

			if ( ! pending_apply_result || 'function' !== typeof controller_options.on_applied ) {
				render_review( submitted_review );
				set_status( i18n.readback_error || '', true, 'error' );
				return;
			}
			apply_generation += 1;
			current_generation = apply_generation;
			show_loading( i18n.refreshing || '' );
			try {
				readback = controller_options.on_applied( pending_apply_result );
			} catch ( readback_error ) {
				readback = null;
			}
			if ( ! readback || ( 'function' !== typeof readback.then && 'function' !== typeof readback.done ) ) {
				render_review( submitted_review );
				set_status( i18n.readback_error || '', true, 'error' );
				return;
			}
			window.jQuery.when( readback ).done( function ( booking ) {
				if ( current_generation === apply_generation && booking && Number( booking.booking_id || 0 ) === Number( pending_apply_result.booking_id || 0 ) ) {
					pending_apply_result = null;
					dirty = false;
					close( true, true );
				}
			} ).fail( function ( error ) {
				if ( current_generation === apply_generation && layer ) {
					render_review( submitted_review );
					set_status( error && error.message ? error.message : ( i18n.readback_error || '' ), true, 'error' );
				}
			} );
		}

		/** @return {void} Apply only the currently displayed signed plan. */
		function request_apply() {
			var submitted_review = active_review;
			var current_generation;
			var pending_request;

			if ( pending_apply_result ) {
				request_readback( submitted_review );
				return;
			}
			if ( ! submitted_review || ! submitted_review.plan || ! submitted_review.token ) {
				set_status( i18n.apply_error || '', true, 'error' );
				return;
			}
			apply_generation += 1;
			current_generation = apply_generation;
			show_loading( i18n.applying || '' );
			pending_request = window.jQuery.ajax( {
				url: controller_options.url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: settings.apply.action,
					nonce: settings.apply.nonce,
					booking_id: active_dto.booking_id,
					source: controller_options.source,
					plan: JSON.stringify( submitted_review.plan ),
					token: submitted_review.token,
					send_modified_email: 'function' === typeof controller_options.get_send_modified_email_intent && controller_options.get_send_modified_email_intent() ? 1 : 0
				}
			} ).done( function ( response ) {
				if ( current_generation !== apply_generation ) {
					return;
				}
				if ( ! response || ! response.success || ! response.data || ! normalize_id( response.data.booking_id ) || ! response.data.host_refresh ) {
					render_review( submitted_review );
					set_status( i18n.apply_error || '', true, 'error' );
					return;
				}
				pending_apply_result = response.data;
				request_readback( submitted_review );
			} ).fail( function ( failed_request, request_status ) {
				var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};

				if ( 'abort' !== request_status && current_generation === apply_generation && layer ) {
					render_review( submitted_review );
					set_status( error.message || i18n.apply_error || '', true, 'error' );
				}
			} ).always( function () {
				if ( apply_request === pending_request ) {
					apply_request = null;
				}
			} );
			apply_request = pending_request;
		}

		/**
		 * Open for one Inspector-authorized booking.
		 *
		 * @param {HTMLElement} trigger         Activating control.
		 * @param {Object}      booking_context Authorized booking identity.
		 * @return {boolean} True when opening began.
		 */
		function open( trigger, booking_context ) {
			var booking_id = booking_context ? normalize_id( booking_context.booking_id ) : 0;

			if ( ! booking_id || ! close( false, false ) ) {
				return false;
			}
			opener = trigger;
			active_dto = { booking_id: booking_id };
			render_layer( { i18n: i18n } );
			show_loading( i18n.loading || '' );
			window.requestAnimationFrame( function () {
				if ( layer ) {
					layer.focus();
				}
			} );
			request_read( 0, null );

			return true;
		}

		/**
		 * Handle dialog actions.
		 *
		 * @param {MouseEvent} event Click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			if ( ! layer || ! layer.contains( event.target ) ) {
				return;
			}
			if ( event.target.closest( '[data-wpbc-booking-rescheduling-close]' ) ) {
				event.preventDefault();
				close( true, false );
			} else if ( event.target.closest( '[data-wpbc-booking-rescheduling-retry]' ) ) {
				event.preventDefault();
				request_read( draft ? draft.target_resource_id : 0, retry_draft || draft );
			} else if ( event.target.closest( '[data-wpbc-booking-rescheduling-reset]' ) && saved_draft ) {
				event.preventDefault();
				draft = clone_draft( saved_draft );
				active_review = null;
				request_read( draft.target_resource_id, draft );
			} else if ( event.target.closest( '[data-wpbc-booking-rescheduling-review]' ) ) {
				event.preventDefault();
				request_review();
			} else if ( event.target.closest( '[data-wpbc-booking-rescheduling-back]' ) ) {
				event.preventDefault();
				active_review = null;
				layer.querySelector( '[data-wpbc-booking-rescheduling-view="review"]' ).hidden = true;
				layer.querySelector( '[data-wpbc-booking-rescheduling-view="editor"]' ).hidden = false;
				layer.querySelector( '[data-wpbc-booking-rescheduling-review]' ).focus();
			} else if ( event.target.closest( '[data-wpbc-booking-rescheduling-apply]' ) ) {
				event.preventDefault();
				request_apply();
			}
		}

		/**
		 * Synchronize controls into the mutable proposal.
		 *
		 * @param {Event} event Input or change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			var resource_control;
			var selection_control;
			var time_application_control;
			var time_control;
			var requested_mode;

			if ( ! layer || ! layer.contains( event.target ) || ! draft ) {
				return;
			}
			resource_control = event.target.closest( '[data-wpbc-booking-rescheduling-resource]' );
			selection_control = event.target.closest( '[data-wpbc-booking-rescheduling-selection-method]' );
			time_application_control = event.target.closest( '[data-wpbc-booking-rescheduling-time-application]' );
			time_control = event.target.closest( '[data-wpbc-booking-rescheduling-time]' );
			if ( resource_control ) {
				draft.target_resource_id = normalize_id( resource_control.value );
				draft.proposal_revision += 1;
				update_dirty();
				request_read( draft.target_resource_id, draft );
				return;
			}
			if ( selection_control ) {
				requested_mode = MODE_INDIVIDUAL === selection_control.value ? MODE_INDIVIDUAL : MODE_POLICY;
				if ( native_adapter && ! native_adapter.set_selection_mode( requested_mode ) ) {
					set_status( i18n.hydration_warning || '', true, 'warning' );
					return;
				}
				draft.selection_method = requested_mode;
				draft.selected_dates = native_adapter ? native_adapter.get_selected_dates() : draft.selected_dates;
			} else if ( time_application_control ) {
				draft.time_application = -1 !== [ TIME_FULL_DAY, TIME_BOUNDARY, TIME_PER_DATE ].indexOf( time_application_control.value ) ? time_application_control.value : TIME_FULL_DAY;
			} else if ( time_control ) {
				draft[ time_control.getAttribute( 'data-wpbc-booking-rescheduling-time' ) ] = normalize_time( time_control.value );
			} else {
				return;
			}
			draft.proposal_revision += 1;
			active_review = null;
			render_draft();
		}

		/**
		 * Contain keyboard focus and close only this secondary dialog on Escape.
		 *
		 * @param {KeyboardEvent} event Keyboard event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			var focusable;
			var first;
			var last;

			if ( ! layer ) {
				return;
			}
			if ( 'Escape' === event.key ) {
				event.preventDefault();
				event.stopImmediatePropagation();
				close( true, false );
				return;
			}
			if ( 'Tab' !== event.key ) {
				return;
			}
			focusable = Array.prototype.filter.call( layer.querySelectorAll( 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])' ), function ( control ) {
				return ! control.hidden && null !== control.offsetParent;
			} );
			if ( ! focusable.length ) {
				event.preventDefault();
				layer.focus();
				return;
			}
			first = focusable[ 0 ];
			last = focusable[ focusable.length - 1 ];
			if ( event.shiftKey && document.activeElement === first ) {
				event.preventDefault();
				last.focus();
			} else if ( ! event.shiftKey && document.activeElement === last ) {
				event.preventDefault();
				first.focus();
			}
		}

		inspector_shell.addEventListener( 'click', handle_click );
		inspector_shell.addEventListener( 'change', handle_change );
		inspector_shell.addEventListener( 'input', handle_change );
		inspector_shell.addEventListener( 'keydown', handle_keydown, true );

		return {
			open: open,
			is_open: function () {
				return Boolean( layer );
			},
			is_dirty: function () {
				return dirty;
			},
			is_busy: function () {
				return Boolean( apply_request || pending_apply_result );
			},
			confirm_discard: function () {
				if ( apply_request || pending_apply_result ) {
					set_status( pending_apply_result ? ( i18n.readback_error || '' ) : ( i18n.applying || '' ), true, pending_apply_result ? 'error' : 'warning' );
					return false;
				}

				return ! dirty || window.confirm( i18n.discard_changes || '' );
			},
			prepare_for_parent_switch: function () {
				return close( false, false );
			},
			force_close: function () {
				close( false, true );
			},
			destroy: function () {
				close( false, true );
				inspector_shell.removeEventListener( 'click', handle_click );
				inspector_shell.removeEventListener( 'change', handle_change );
				inspector_shell.removeEventListener( 'input', handle_change );
				inspector_shell.removeEventListener( 'keydown', handle_keydown, true );
			}
		};
	}

	window.wpbc_booking_rescheduling = window.wpbc_booking_rescheduling || {};
	window.wpbc_booking_rescheduling.create_controller = create_controller;
}( window, document, jQuery ) );
