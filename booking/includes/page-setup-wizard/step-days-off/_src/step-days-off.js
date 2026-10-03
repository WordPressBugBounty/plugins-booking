/**
 * Coordinate the reusable Setup Wizard Days Off editor.
 *
 * The browser selects a bounded range with Booking Calendar's standard
	 * datepicker. Add/remove actions update a bounded browser proposal only. The
	 * shared Save boundary remains authoritative for Resource access, stale
	 * revisions, validation, and canonical Days Availability writes.
 *
 * @package Booking Calendar
 */
( function ( $, window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_days_off || { i18n: {} };
	var request_sequence = 0;

	/**
	 * Create the Days Off adapter accepted by the shared Setup Wizard shell.
	 *
	 * @param {Object} config Authorized endpoint and translated labels.
	 * @return {Object} Step adapter.
	 */
	function create_days_off_adapter( config ) {
		var shell_api = null;
		var editor = null;
		var state = {};
		var all_unavailable_dates = {};
		var base_revision = '';
		var selected_first_date = '';
		var selected_last_date = '';

		/**
		 * Return one translated label with a safe fallback.
		 *
		 * @param {string} key      Translation key.
		 * @param {string} fallback Fallback text.
		 * @return {string} Translation or fallback.
		 */
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? String( config.i18n[ key ] ) : fallback;
		}

		/**
		 * Restore keyboard focus without moving the wizard or browser viewport.
		 *
		 * Re-rendering the unavailable-range list removes the activated delete
		 * button. The replacement focus target must remain accessible without
		 * making the independently scrolling wizard jump to its top.
		 *
		 * @param {HTMLElement|null} focus_target Remaining control to receive focus.
		 * @return {void}
		 */
		function focus_without_scrolling( focus_target ) {
			var scroll_container = editor && editor.node ? editor.node.closest( '.wpbc_setup_wizard__main' ) : null;
			var container_scroll_top = scroll_container ? scroll_container.scrollTop : 0;
			var container_scroll_left = scroll_container ? scroll_container.scrollLeft : 0;
			var window_scroll_x = window.pageXOffset || document.documentElement.scrollLeft || 0;
			var window_scroll_y = window.pageYOffset || document.documentElement.scrollTop || 0;

			if ( ! focus_target || focus_target.disabled || ! document.body.contains( focus_target ) ) {
				return;
			}

			try {
				focus_target.focus( { preventScroll: true } );
			} catch ( focus_error ) {
				focus_target.focus();
			}

			if ( scroll_container ) {
				scroll_container.scrollTop = container_scroll_top;
				scroll_container.scrollLeft = container_scroll_left;
			}
			if ( window.scrollTo && ( window_scroll_x !== window.pageXOffset || window_scroll_y !== window.pageYOffset ) ) {
				window.scrollTo( window_scroll_x, window_scroll_y );
			}
		}

		/**
		 * Parse one exact ISO calendar date without UTC conversion drift.
		 *
		 * @param {string} iso_date Date in YYYY-MM-DD format.
		 * @return {Date|null} Local-midnight Date or null.
		 */
		function parse_iso_date( iso_date ) {
			var parts = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec( String( iso_date || '' ) );
			var parsed_date;

			if ( ! parts ) {
				return null;
			}

			parsed_date = new Date( parseInt( parts[ 1 ], 10 ), parseInt( parts[ 2 ], 10 ) - 1, parseInt( parts[ 3 ], 10 ) );
			return parsed_date.getFullYear() === parseInt( parts[ 1 ], 10 ) && parsed_date.getMonth() === parseInt( parts[ 2 ], 10 ) - 1 && parsed_date.getDate() === parseInt( parts[ 3 ], 10 ) ? parsed_date : null;
		}

		/**
		 * Format a Date as canonical YYYY-MM-DD.
		 *
		 * @param {Date} date Local Date instance.
		 * @return {string} ISO date.
		 */
		function format_iso_date( date ) {
			var month = ( '0' + String( date.getMonth() + 1 ) ).slice( -2 );
			var day = ( '0' + String( date.getDate() ) ).slice( -2 );

			return String( date.getFullYear() ) + '-' + month + '-' + day;
		}

		/**
		 * Format one ISO date for visible labels while preserving ISO transport.
		 *
		 * @param {string} iso_date Canonical date.
		 * @return {string} Localized short label.
		 */
		function format_date_label( iso_date ) {
			var date = parse_iso_date( iso_date );
			var locale = String( config.locale || '' ).replace( '_', '-' );

			if ( ! date || ! window.Intl || ! window.Intl.DateTimeFormat ) {
				return iso_date;
			}

			try {
				return new window.Intl.DateTimeFormat( locale || undefined, {
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				} ).format( date );
			} catch ( locale_error ) {
				return iso_date;
			}
		}

		/**
		 * Return the inclusive number of selected calendar days.
		 *
		 * @return {number} Inclusive day count, or zero for an invalid range.
		 */
		function get_selected_day_count() {
			var first_date = parse_iso_date( selected_first_date );
			var last_date = parse_iso_date( selected_last_date );

			if ( ! first_date || ! last_date || last_date < first_date ) {
				return 0;
			}

			return Math.round( ( last_date.getTime() - first_date.getTime() ) / 86400000 ) + 1;
		}

		/**
		 * Normalize server state to the data-only fields used by this adapter.
		 *
		 * @param {Object} next_state Authorized server state.
		 * @return {Object} Safe normalized state.
		 */
		function normalize_state( next_state ) {
			next_state = next_state && 'object' === typeof next_state ? next_state : {};

			return {
				can_manage: true === next_state.can_manage,
				has_resources: true === next_state.has_resources,
				scope: 'string' === typeof next_state.scope ? next_state.scope : 'all',
				resources: Array.isArray( next_state.resources ) ? next_state.resources : [],
				unavailable_dates: next_state.unavailable_dates && 'object' === typeof next_state.unavailable_dates ? next_state.unavailable_dates : {},
				date_states: next_state.date_states && 'object' === typeof next_state.date_states ? next_state.date_states : {},
				booking_date_states: next_state.booking_date_states && 'object' === typeof next_state.booking_date_states ? next_state.booking_date_states : {},
				ranges: Array.isArray( next_state.ranges ) ? next_state.ranges : [],
				revision: 'string' === typeof next_state.revision ? next_state.revision : '',
				today: 'string' === typeof next_state.today ? next_state.today : '',
				is_aggregate_scope: true === next_state.is_aggregate_scope,
				default_first_date: 'string' === typeof next_state.default_first_date ? next_state.default_first_date : '',
				default_last_date: 'string' === typeof next_state.default_last_date ? next_state.default_last_date : '',
				first_day: Math.max( 0, Math.min( 6, parseInt( next_state.first_day || 0, 10 ) || 0 ) ),
				max_range_days: Math.max( 1, parseInt( next_state.max_range_days || 366, 10 ) || 366 )
			};
		}

		/**
		 * Normalize the complete staged map without sharing mutable arrays.
		 *
		 * @param {Object} dates_by_resource Dates keyed by Resource ID.
		 * @return {Object} Safe cloned date map.
		 */
		function normalize_unavailable_dates( dates_by_resource ) {
			var normalized = {};

			state.resources.forEach( function ( resource ) {
				var resource_id = String( parseInt( resource.id, 10 ) || 0 );
				var dates = dates_by_resource && Array.isArray( dates_by_resource[ resource_id ] ) ? dates_by_resource[ resource_id ] : [];

				if ( '0' === resource_id ) {
					return;
				}
				normalized[ resource_id ] = dates.filter( function ( date ) {
					return null !== parse_iso_date( date );
				} ).filter( function ( date, index, source ) {
					return source.indexOf( date ) === index;
				} ).sort();
			} );

			return normalized;
		}

		/**
		 * Return Resource IDs affected by one visible scope.
		 *
		 * @param {string} scope Resource ID or `all`.
		 * @return {string[]} Authorized Resource IDs.
		 */
		function get_scope_resource_ids( scope ) {
			var resource_ids = state.resources.map( function ( resource ) {
				return String( parseInt( resource.id, 10 ) || 0 );
			} ).filter( function ( resource_id ) {
				return '0' !== resource_id;
			} );

			return 'all' === scope ? resource_ids : resource_ids.filter( function ( resource_id ) {
				return resource_id === scope;
			} );
		}

		/**
		 * Expand a bounded inclusive range into ISO dates.
		 *
		 * @param {string} first_date First ISO date.
		 * @param {string} last_date  Last ISO date.
		 * @return {string[]} Inclusive date list.
		 */
		function expand_date_range( first_date, last_date ) {
			var cursor = parse_iso_date( first_date );
			var end = parse_iso_date( last_date );
			var dates = [];

			while ( cursor && end && cursor <= end && dates.length < state.max_range_days ) {
				dates.push( format_iso_date( cursor ) );
				cursor.setDate( cursor.getDate() + 1 );
			}

			return dates;
		}

		/**
		 * Collapse ordered ISO dates into inclusive range records.
		 *
		 * @param {string[]} dates ISO dates.
		 * @return {Object[]} Consecutive ranges.
		 */
		function collapse_dates( dates ) {
			var ranges = [];
			var first_date = '';
			var last_date = '';

			dates.slice().sort().forEach( function ( date ) {
				var expected_next;

				if ( ! first_date ) {
					first_date = date;
					last_date = date;
					return;
				}
				expected_next = parse_iso_date( last_date );
				expected_next.setDate( expected_next.getDate() + 1 );
				if ( format_iso_date( expected_next ) === date ) {
					last_date = date;
					return;
				}
				ranges.push( { first_date: first_date, last_date: last_date } );
				first_date = date;
				last_date = date;
			} );
			if ( first_date ) {
				ranges.push( { first_date: first_date, last_date: last_date } );
			}

			return ranges;
		}

		/**
		 * Build display ranges from the complete staged proposal.
		 *
		 * @param {string[]} resource_ids Scoped Resource IDs.
		 * @param {string}   scope        Current scope.
		 * @return {Object[]} Display range records.
		 */
		function build_range_records( resource_ids, scope ) {
			var range_counts = {};
			var resource_ranges = {};
			var resource_labels = {};
			var shared_added = {};
			var records = [];

			state.resources.forEach( function ( resource ) {
				resource_labels[ String( resource.id ) ] = String( resource.label || '' );
			} );
			resource_ids.forEach( function ( resource_id ) {
				resource_ranges[ resource_id ] = collapse_dates( all_unavailable_dates[ resource_id ] || [] );
				resource_ranges[ resource_id ].forEach( function ( range ) {
					var key = range.first_date + '|' + range.last_date;

					range_counts[ key ] = ( range_counts[ key ] || 0 ) + 1;
				} );
			} );
			resource_ids.forEach( function ( resource_id ) {
				resource_ranges[ resource_id ].forEach( function ( range ) {
					var key = range.first_date + '|' + range.last_date;
					var is_shared = 1 < resource_ids.length && range_counts[ key ] === resource_ids.length;
					var range_scope = is_shared ? 'all' : ( 1 === resource_ids.length ? scope : resource_id );

					if ( is_shared && shared_added[ key ] ) {
						return;
					}
					records.push( {
						first_date: range.first_date,
						last_date: range.last_date,
						label: format_date_label( range.first_date ) + ( range.first_date === range.last_date ? '' : ' \u2013 ' + format_date_label( range.last_date ) ),
						scope: range_scope,
						scope_label: 'all' === range_scope ? get_message( 'all_booking_items', 'All booking items' ) : resource_labels[ resource_id ]
					} );
					if ( is_shared ) {
						shared_added[ key ] = true;
					}
				} );
			} );

			return records.sort( function ( first_range, second_range ) {
				return ( first_range.first_date + '|' + first_range.scope ).localeCompare( second_range.first_date + '|' + second_range.scope );
			} );
		}

		/**
		 * Synchronize the complete staged proposal into the shared wizard form.
		 *
		 * @return {void}
		 */
		function sync_staged_value() {
			if ( editor && editor.value ) {
				editor.value.value = JSON.stringify( {
					revision: base_revision,
					unavailable_dates: all_unavailable_dates
				} );
			}
		}

		/**
		 * Rebuild calendar and list presentation from the browser proposal.
		 *
		 * @param {string} requested_scope Current authorized scope.
		 * @return {void}
		 */
		function rebuild_staged_state( requested_scope ) {
			var resource_ids = get_scope_resource_ids( requested_scope );
			var date_counts = {};

			state.scope = requested_scope;
			state.unavailable_dates = {};
			resource_ids.forEach( function ( resource_id ) {
				state.unavailable_dates[ resource_id ] = ( all_unavailable_dates[ resource_id ] || [] ).slice();
				state.unavailable_dates[ resource_id ].forEach( function ( date ) {
					date_counts[ date ] = ( date_counts[ date ] || 0 ) + 1;
				} );
			} );
			state.date_states = {};
			Object.keys( date_counts ).forEach( function ( date ) {
				state.date_states[ date ] = date_counts[ date ] === resource_ids.length ? 'unavailable' : 'partially_available';
			} );
			state.ranges = build_range_records( resource_ids, requested_scope );
			state.is_aggregate_scope = 'all' === requested_scope && 1 < resource_ids.length;
			apply_scope_value( requested_scope );
			if ( editor.aggregate_legend ) {
				editor.aggregate_legend.hidden = ! state.is_aggregate_scope;
			}
			if ( editor.resource_legend ) {
				editor.resource_legend.hidden = state.is_aggregate_scope;
			}
			sync_staged_value();
			render_ranges();
			refresh_calendar();
		}

		/**
		 * Parse the hex-escaped initial state emitted by the domain template.
		 *
		 * @param {HTMLElement} editor_node Editor root.
		 * @return {Object} Parsed state or an empty object.
		 */
		function read_initial_state( editor_node ) {
			var state_node = editor_node.querySelector( '[data-wpbc-days-off-state]' );

			if ( ! state_node ) {
				return {};
			}

			try {
				return JSON.parse( state_node.textContent || '{}' );
			} catch ( parse_error ) {
				return {};
			}
		}

		/**
		 * Return native Booking Calendar classes for one scoped calendar date.
		 *
		 * @param {Date} date Calendar date.
		 * Availability remains selectable on this editor. Canonical booked-date
		 * states are read-only context and follow the same full-day/time-slot class
		 * vocabulary as the native Days Availability calendar.
		 *
		 * @return {Object} Native day classes and an accessible status title.
		 */
		function get_calendar_day_presentation( date ) {
			var iso_date = format_iso_date( date );
			var state_class = String( state.date_states[ iso_date ] || '' );
			var booking_state = String( state.booking_date_states[ iso_date ] || '' );
			var native_date_class = 'cal4date-' + String( date.getMonth() + 1 ) + '-' + String( date.getDate() ) + '-' + String( date.getFullYear() );
			var css_classes = native_date_class + ' date_available';
			var status_labels = [];

			if ( 'unavailable' === state_class ) {
				return {
					css_classes: native_date_class + ' date_user_unavailable resource_unavailable wpbc_setup_wizard__calendar-date--unavailable',
					status_title: get_message( 'unavailable', 'Unavailable' )
				};
			}
			if ( 'partially_available' === state_class ) {
				css_classes += ' wpbc_resources_partially_unavailable wpbc_setup_wizard__calendar-date--partially-available';
				status_labels.push( get_message( 'some_resources_unavailable', 'Some booking items unavailable' ) );
			}

			if ( 'resources_have_bookings' === booking_state ) {
				css_classes += ' wpbc_resources_have_bookings';
				status_labels.push( get_message( 'resources_have_bookings', 'Bookings exist for one or more booking items' ) );
			} else if ( 'approved_full' === booking_state ) {
				css_classes = native_date_class + ' date_approved full_day_booking';
				status_labels.push( get_message( 'approved_booking', 'Approved booking' ) );
			} else if ( 'pending_full' === booking_state ) {
				css_classes = native_date_class + ' date2approve full_day_booking';
				status_labels.push( get_message( 'pending_booking', 'Pending booking' ) );
			} else if ( 'approved_partial' === booking_state ) {
				css_classes += ' date_approved timespartly times_clock';
				status_labels.push( get_message( 'partially_booked', 'Partially booked' ) );
			} else if ( 'pending_partial' === booking_state ) {
				css_classes += ' date2approve timespartly times_clock';
				status_labels.push( get_message( 'partially_booked_pending', 'Partially booked; pending booking' ) );
			}

			return {
				css_classes: css_classes,
				status_title: status_labels.join( '. ' )
			};
		}

		/**
		 * Refresh the visible selected range and action state.
		 *
		 * @return {void}
		 */
		function render_selection_summary() {
			var day_count = get_selected_day_count();
			var count_label = 1 === day_count
				? get_message( 'one_unavailable_day', '1 unavailable day' )
				: get_message( 'many_unavailable_days', '%s unavailable days' ).replace( '%s', String( day_count ) );

			editor.first_date.textContent = selected_first_date ? format_date_label( selected_first_date ) : '';
			editor.last_date.textContent = selected_last_date ? format_date_label( selected_last_date ) : '';
			editor.summary_range.textContent = day_count ? format_date_label( selected_first_date ) + ( selected_first_date === selected_last_date ? '' : ' \u2013 ' + format_date_label( selected_last_date ) ) : '';
			editor.summary_count.textContent = day_count ? count_label : '';
			editor.add_button.disabled = ! day_count || day_count > state.max_range_days;
		}

		/**
		 * Create one accessible range row using text-only DOM APIs.
		 *
		 * @param {Object} range Authorized range record.
		 * @return {HTMLElement|null} List row or null.
		 */
		function create_range_row( range ) {
			var row;
			var date_label;
			var scope_label;
			var remove_button;
			var remove_icon;

			if ( ! range || 'string' !== typeof range.first_date || 'string' !== typeof range.last_date || 'string' !== typeof range.scope ) {
				return null;
			}

			row = document.createElement( 'li' );
			date_label = document.createElement( 'span' );
			scope_label = document.createElement( 'span' );
			remove_button = document.createElement( 'button' );
			remove_icon = document.createElement( 'i' );

			date_label.textContent = String( range.label || range.first_date );
			scope_label.textContent = String( range.scope_label || '' );
			remove_button.type = 'button';
			remove_button.className = 'wpbc_setup_wizard__days-off-remove';
			remove_button.setAttribute( 'data-wpbc-days-off-remove', '' );
			remove_button.setAttribute( 'data-first-date', range.first_date );
			remove_button.setAttribute( 'data-last-date', range.last_date );
			remove_button.setAttribute( 'data-scope', range.scope );
			remove_button.setAttribute( 'aria-label', get_message( 'remove_range', 'Remove unavailable date range' ) );
			remove_icon.className = 'menu_icon icon-1x wpbc_icn_delete_outline';
			remove_icon.setAttribute( 'aria-hidden', 'true' );
			remove_button.appendChild( remove_icon );
			row.appendChild( date_label );
			row.appendChild( scope_label );
			row.appendChild( remove_button );

			return row;
		}

		/**
		 * Replace the upcoming-range list from server-authorized records.
		 *
		 * @return {void}
		 */
		function render_ranges() {
			editor.range_list.textContent = '';
			state.ranges.forEach( function ( range ) {
				var row = create_range_row( range );

				if ( row ) {
					editor.range_list.appendChild( row );
				}
			} );
			editor.empty.hidden = 0 < editor.range_list.children.length;
		}

		/**
		 * Refresh the inline calendar after server state or scope changes.
		 *
		 * @return {void}
		 */
		function refresh_calendar() {
			if ( editor.calendar.hasClass( $.datepick.markerClassName ) ) {
				editor.calendar.datepick( 'refresh' );
			}
		}

		/**
		 * Mark only the scoped calendar area as loading.
		 *
		 * Resource changes are read-only and should not cover the complete wizard
		 * with the mutation overlay. The disabled selector also prevents a second
		 * scope change while the authoritative response is pending.
		 *
		 * @param {boolean} is_loading Whether an AJAX scope request is active.
		 * @return {void}
		 */
		function set_calendar_loading( is_loading ) {
			editor.calendar_column.classList.toggle( 'is-loading', is_loading );
			editor.calendar_column.setAttribute( 'aria-busy', is_loading ? 'true' : 'false' );
			editor.scope.disabled = is_loading;
			editor.node.querySelectorAll( '[data-wpbc-days-off-remove]' ).forEach( function ( remove_button ) {
				remove_button.disabled = is_loading;
			} );
			if ( is_loading ) {
				editor.add_button.disabled = true;
			} else {
				render_selection_summary();
			}
		}

		/**
		 * Select the response scope only when it is still an authorized option.
		 *
		 * @param {string} scope Authorized scope returned by the server.
		 * @return {void}
		 */
		function apply_scope_value( scope ) {
			var has_scope = Array.prototype.some.call( editor.scope.options, function ( option ) {
				return String( option.value ) === scope;
			} );

			if ( has_scope ) {
				editor.scope.value = scope;
			}
		}

		/**
		 * Apply the initial server state without trusting browser-derived records.
		 *
		 * @param {Object} next_state Authorized response state.
		 * @return {void}
		 */
		function apply_state( next_state ) {
			state = normalize_state( next_state );
			base_revision = state.revision;
			all_unavailable_dates = normalize_unavailable_dates( state.unavailable_dates );
			apply_scope_value( state.scope );
			if ( editor.aggregate_legend ) {
				editor.aggregate_legend.hidden = ! state.is_aggregate_scope;
			}
			if ( editor.resource_legend ) {
				editor.resource_legend.hidden = state.is_aggregate_scope;
			}
			render_ranges();
			refresh_calendar();
			sync_staged_value();
		}

		/**
		 * Clear only the pending browser selection and rebuild the datepicker.
		 *
		 * Canonical unavailable dates and booked-date context stay in server state.
		 * Reinitialization removes the datepicker's private range selection without
		 * mutating either domain.
		 *
		 * @return {void}
		 */
		function clear_selected_range() {
			selected_first_date = '';
			selected_last_date = '';
			editor.error.textContent = '';
			if ( editor.calendar.hasClass( $.datepick.markerClassName ) ) {
				editor.calendar.datepick( 'destroy' );
			}
			initialize_calendar();
			render_selection_summary();
		}

		/**
		 * Return a safe AJAX error message.
		 *
		 * @param {Object} xhr jQuery request object.
		 * @return {string} Error message.
		 */
		function get_error_message( xhr ) {
			if ( xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message ) {
				return String( xhr.responseJSON.data.message );
			}

			return get_message( 'error', 'Date availability could not be updated. Try again.' );
		}

		/**
		 * Load booking context for one authorized Resource scope.
		 *
		 * Canonical unavailable dates in the response are deliberately ignored so a
		 * scope switch cannot discard the browser proposal waiting for Save.
		 *
		 * @param {string} requested_scope Resource ID or all-resources scope.
		 * @return {void}
		 */
		function load_scope( requested_scope ) {
			var previous_scope = state.scope;
			var sequence;
			var request_id;
			var request;

			request_sequence += 1;
			sequence = request_sequence;
			request_id = 'days_off_load_' + Date.now() + '_' + sequence;
			editor.error.textContent = '';
			set_calendar_loading( true );

			request = $.ajax( {
				url: config.ajax_url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: config.load_action,
					nonce: config.nonce,
					scope: requested_scope,
					request_id: request_id
				}
			} );

			request.done( function ( response ) {
				if ( sequence !== request_sequence || ! response || ! response.success || ! response.data || response.data.request_id !== request_id ) {
					return;
				}

				var loaded_state = normalize_state( response.data.state );

				state.booking_date_states = loaded_state.booking_date_states;
				state.today = loaded_state.today || state.today;
				state.first_day = loaded_state.first_day;
				state.max_range_days = loaded_state.max_range_days;
				rebuild_staged_state( loaded_state.scope );
			} );

			request.fail( function ( xhr ) {
				var message;

				if ( sequence !== request_sequence ) {
					return;
				}

				apply_scope_value( previous_scope );
				message = get_error_message( xhr );
				editor.error.textContent = message;
				shell_api.set_status( message );
			} );

			request.always( function () {
				if ( sequence !== request_sequence ) {
					return;
				}

				set_calendar_loading( false );
				editor.scope.focus();
			} );
		}

		/**
		 * Stage one explicit add/remove operation for the shared Save boundary.
		 *
		 * @param {string} operation  Add or remove.
		 * @param {string} scope      Authorized scope value.
		 * @param {string} first_date First ISO date.
		 * @param {string} last_date  Last ISO date.
		 * @param {HTMLElement|null} focus_target Focus target restored after completion.
		 * @param {number}           remove_index Index of the removed row for focus recovery.
		 * @return {void}
		 */
		function stage_range( operation, scope, first_date, last_date, focus_target, remove_index ) {
			var resource_ids = get_scope_resource_ids( scope );
			var range_dates = expand_date_range( first_date, last_date );

			if ( ! resource_ids.length || ! range_dates.length ) {
				editor.error.textContent = get_message( 'range_invalid', 'Select a valid unavailable date range.' );
				return;
			}
			resource_ids.forEach( function ( resource_id ) {
				var current_dates = all_unavailable_dates[ resource_id ] || [];

				if ( 'add' === operation ) {
					all_unavailable_dates[ resource_id ] = current_dates.concat( range_dates ).filter( function ( date, index, source ) {
						return source.indexOf( date ) === index;
					} ).sort();
				} else {
					all_unavailable_dates[ resource_id ] = current_dates.filter( function ( date ) {
						return range_dates.indexOf( date ) === -1;
					} );
				}
			} );

			editor.error.textContent = '';
			rebuild_staged_state( String( editor.scope.value || 'all' ) );
			if ( 'add' === operation ) {
				clear_selected_range();
			}
			shell_api.set_status( 'add' === operation ? get_message( 'added', 'The unavailable date range is staged.' ) : get_message( 'removed', 'The unavailable date range removal is staged.' ) );
			window.setTimeout( function () {
				var remaining_remove_buttons = Array.prototype.slice.call( editor.node.querySelectorAll( '[data-wpbc-days-off-remove]' ) );
				var fallback_target = null;

				if ( focus_target && ! focus_target.disabled && document.body.contains( focus_target ) ) {
					focus_without_scrolling( focus_target );
					return;
				}
				if ( 'remove' === operation && remaining_remove_buttons.length && remove_index >= 0 ) {
					fallback_target = remaining_remove_buttons[ Math.min( remove_index, remaining_remove_buttons.length - 1 ) ];
				}
				focus_without_scrolling( fallback_target || editor.scope );
			}, 0 );
		}

		/**
		 * Reproduce the native Booking Calendar range-hover highlight.
		 *
		 * @param {string} hovered_value Datepicker value supplied by the plugin.
		 * @param {Date}   hovered_date  Calendar day currently under the pointer.
		 * @return {boolean} True so the datepicker continues its normal handling.
		 */
		function handle_calendar_hover( hovered_value, hovered_date ) {
			var datepick_instance;
			var range_start;
			var cursor_date;
			var safety_count = 0;

			editor.calendar.find( '.datepick-days-cell-over' ).removeClass( 'datepick-days-cell-over' );
			if ( ! hovered_date || ! $.datepick || 'function' !== typeof $.datepick._getInst ) {
				return true;
			}

			datepick_instance = $.datepick._getInst( editor.calendar[ 0 ] );
			if ( ! datepick_instance || ! datepick_instance.dates || 1 !== datepick_instance.dates.length || ! datepick_instance.dates[ 0 ] ) {
				return true;
			}

			range_start = new Date( datepick_instance.dates[ 0 ].getTime() );
			if ( hovered_date < range_start ) {
				return true;
			}

			cursor_date = new Date( range_start.getTime() );
			while ( cursor_date <= hovered_date && safety_count <= state.max_range_days ) {
				editor.calendar.find( '.cal4date-' + String( cursor_date.getMonth() + 1 ) + '-' + String( cursor_date.getDate() ) + '-' + String( cursor_date.getFullYear() ) ).addClass( 'datepick-days-cell-over' );
				cursor_date.setDate( cursor_date.getDate() + 1 );
				safety_count += 1;
			}

			return true;
		}

		/**
		 * Initialize Booking Calendar's standard two-month range datepicker.
		 *
		 * @return {void}
		 */
		function initialize_calendar() {
			var first_date = parse_iso_date( selected_first_date );
			var last_date = parse_iso_date( selected_last_date );

			if ( ! $.fn.datepick ) {
				editor.error.textContent = get_message( 'calendar_unavailable', 'The date selector could not be loaded. Reload the page and try again.' );
				return;
			}

			editor.calendar.datepick( {
				beforeShowDay: function ( date ) {
					var day_presentation = get_calendar_day_presentation( date );

					return [ true, day_presentation.css_classes, day_presentation.status_title ];
				},
				onHover: handle_calendar_hover,
				onSelect: function ( date_string, selected_dates ) {
					if ( ! Array.isArray( selected_dates ) || ! selected_dates[ 0 ] ) {
						return;
					}

					selected_first_date = format_iso_date( selected_dates[ 0 ] );
					selected_last_date = format_iso_date( selected_dates[ 1 ] || selected_dates[ 0 ] );
					editor.error.textContent = '';
					render_selection_summary();
				},
				showOn: 'none',
				numberOfMonths: 2,
				stepMonths: 1,
				prevText: '&lsaquo;',
				nextText: '&rsaquo;',
				dateFormat: 'yy-mm-dd',
				changeMonth: false,
				changeYear: false,
				minDate: parse_iso_date( state.today ) || 0,
				maxDate: '10y',
				showStatus: false,
				closeAtTop: false,
				firstDay: state.first_day,
				gotoCurrent: false,
				hideIfNoPrevNext: true,
				multiSeparator: ', ',
				multiSelect: 0,
				rangeSelect: true,
				rangeSeparator: ' ~ ',
				useThemeRoller: false,
				mandatory: true
			} );

			if ( first_date && last_date ) {
				editor.calendar.datepick( 'setDate', first_date, last_date );
			}
		}

		/**
		 * Handle Add, Clear, and Remove actions.
		 *
		 * @param {MouseEvent} event Delegated click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var remove_button = event.target.closest( '[data-wpbc-days-off-remove]' );
			var remove_buttons;
			var remove_index;
			var day_count;

			if ( event.target.closest( '[data-wpbc-days-off-add]' ) ) {
				event.preventDefault();
				day_count = get_selected_day_count();
				if ( ! day_count || day_count > state.max_range_days ) {
					editor.error.textContent = get_message( 'range_invalid', 'Select a valid unavailable date range.' );
					return;
				}
				stage_range( 'add', String( editor.scope.value || 'all' ), selected_first_date, selected_last_date, editor.add_button, -1 );
				return;
			}

			if ( event.target.closest( '[data-wpbc-days-off-clear]' ) ) {
				event.preventDefault();
				clear_selected_range();
				return;
			}

			if ( remove_button ) {
				event.preventDefault();
				remove_buttons = Array.prototype.slice.call( editor.node.querySelectorAll( '[data-wpbc-days-off-remove]' ) );
				remove_index = remove_buttons.indexOf( remove_button );
				stage_range(
					'remove',
					String( remove_button.getAttribute( 'data-scope' ) || '' ),
					String( remove_button.getAttribute( 'data-first-date' ) || '' ),
					String( remove_button.getAttribute( 'data-last-date' ) || '' ),
					null,
					remove_index
				);
			}
		}

		/**
		 * Initialize the editor against domain-neutral shell services.
		 *
		 * @param {Object} registered_shell_api Shared shell services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var editor_node;

			shell_api = registered_shell_api;
			editor_node = shell_api.root.querySelector( '[data-wpbc-days-off-editor]' );
			if ( ! editor_node ) {
				return;
			}

			state = normalize_state( read_initial_state( editor_node ) );
			if ( ! state.can_manage || ! state.has_resources ) {
				return;
			}

			editor = {
				node: editor_node,
				calendar_column: editor_node.querySelector( '[data-wpbc-days-off-calendar-column]' ),
				calendar: $( editor_node.querySelector( '[data-wpbc-days-off-calendar]' ) ),
				first_date: editor_node.querySelector( '[data-wpbc-days-off-first-date]' ),
				last_date: editor_node.querySelector( '[data-wpbc-days-off-last-date]' ),
				scope: editor_node.querySelector( '[data-wpbc-days-off-scope]' ),
				aggregate_legend: editor_node.querySelector( '[data-wpbc-days-off-aggregate-legend]' ),
				resource_legend: editor_node.querySelector( '[data-wpbc-days-off-resource-legend]' ),
				summary_range: editor_node.querySelector( '[data-wpbc-days-off-summary-range]' ),
				summary_count: editor_node.querySelector( '[data-wpbc-days-off-summary-count]' ),
				add_button: editor_node.querySelector( '[data-wpbc-days-off-add]' ),
				error: editor_node.querySelector( '[data-wpbc-days-off-error]' ),
				range_list: editor_node.querySelector( '[data-wpbc-days-off-ranges]' ),
				empty: editor_node.querySelector( '[data-wpbc-days-off-empty]' ),
				value: shell_api.root.querySelector( '[data-wpbc-days-off-value]' )
			};
			base_revision = state.revision;
			all_unavailable_dates = normalize_unavailable_dates( state.unavailable_dates );

			selected_first_date = state.default_first_date || state.today;
			selected_last_date = state.default_last_date || selected_first_date;
			apply_scope_value( state.scope );
			editor.node.addEventListener( 'click', handle_click );
			editor.scope.addEventListener( 'change', function () {
				load_scope( String( editor.scope.value || 'all' ) );
			} );
			initialize_calendar();
			render_selection_summary();
			render_ranges();
			sync_staged_value();
		}

		return {
			initialize: initialize,
			sync: sync_staged_value,
			validate: function () {
				return null;
			}
		};
	}

	window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
	window.wpbc_setup_editor_modules.days_off = {
		create: create_days_off_adapter
	};

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_days_off_adapter( module_config ) );
	}
}( jQuery, window, document ) );
