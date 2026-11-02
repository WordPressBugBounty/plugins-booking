/**
 * Timeline empty-range selection state machine and Availability actions.
 *
 * The module owns local pointer, touch, keyboard, resize, preview, Retry,
 * Block/Unblock, focus-restoration, and stale-response behavior. Timeline owns
 * the surrounding axis/window cache and supplies narrow callbacks; the server
 * remains authoritative for validation, authorization, and persistence.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var module_id = 'empty_range_selection';

	/**
	 * Create one empty-range selection controller.
	 *
	 * @param {Object} context Timeline-owned mount, settings, and bounded callbacks.
	 * @return {Object} Empty-range selection lifecycle and delegation API.
	 */
	function create_empty_range_selection_controller( context ) {
		var mount = context.mount || null;
		var settings = context.settings || {};
		var selection_request = null;
		var selection_request_generation = 0;
		var selection_preview_timer = 0;
		var touch_selection_candidate = null;
		var selection_resize_state = null;
		var selection_state = create_empty_selection_state();
		var is_initialized = false;

		/**
		 * Create the canonical empty local-selection state.
		 *
		 * @return {Object} Empty selection state.
		 */
		function create_empty_selection_state() {
			return {
				phase: 'idle',
				resource_id: 0,
				anchor_index: -1,
				start_index: -1,
				end_index: -1,
				start_at: '',
				end_at: '',
				start_epoch: 0,
				end_epoch: 0,
				preview: null,
				error_message: '',
				pointer_id: null
			};
		}

		/**
		 * Report whether the Timeline host is still active.
		 *
		 * @return {boolean} True while callbacks and focus restoration are safe.
		 */
		function is_host_active() {
			return is_initialized && ( 'function' !== typeof context.is_host_active || context.is_host_active() );
		}

		/**
		 * Return one server-allow-listed Timeline template renderer.
		 *
		 * @param {string} template_key Stable template-pack key.
		 * @return {Function|null} WordPress template renderer or null.
		 */
		function get_template( template_key ) {
			return 'function' === typeof context.get_template ? context.get_template( template_key ) : null;
		}

		/**
		 * Announce one selection lifecycle message through the Timeline live region.
		 *
		 * @param {string} message Authorized localized message.
		 * @return {void}
		 */
		function announce( message ) {
			if ( 'function' === typeof context.announce ) {
				context.announce( message );
			}
		}

		/**
		 * Return the active axis cell duration in minutes.
		 *
		 * @return {number} Positive allow-listed cell duration.
		 */
		function get_selection_cell_minutes() {
			var views = settings.metadata && Array.isArray( settings.metadata.views ) ? settings.metadata.views : [];
			var minutes = 1440;

			views.some( function ( view ) {
				if ( view && view.id === settings.axis.view ) {
					minutes = Number( view.cell_minutes ) || minutes;
					return true;
				}
				return false;
			} );

			return minutes;
		}

		/**
		 * Format a local draft duration before the server returns localized detail.
		 *
		 * @param {number} minutes Duration in minutes.
		 * @return {string} Compact duration label.
		 */
		function format_selection_duration( minutes ) {
			var duration_minutes = Math.max( 1, Math.round( Number( minutes ) || 0 ) );
			var days = Math.floor( duration_minutes / 1440 );
			var remaining_minutes = duration_minutes % 1440;
			var hours = Math.floor( remaining_minutes / 60 );
			var minute_remainder = remaining_minutes % 60;
			var parts = [];

			if ( days ) {
				parts.push( String( settings.i18n.selection_days_short || '%s d' ).replace( '%s', days ) );
			}
			if ( hours ) {
				parts.push( String( settings.i18n.selection_hours_short || '%s h' ).replace( '%s', hours ) );
			}
			if ( minute_remainder || ! parts.length ) {
				parts.push( String( settings.i18n.selection_minutes_short || '%s min' ).replace( '%s', minute_remainder ) );
			}

			return parts.join( ' ' );
		}

		/**
		 * Locate a rendered selection track by authorized Resource ID.
		 *
		 * @param {number} resource_id Booking Resource ID.
		 * @return {Element|null} Track element or null.
		 */
		function get_selection_track( resource_id ) {
			var tracks = mount ? mount.querySelectorAll( '[data-wpbc-timeline-selection-track]' ) : [];
			var matched_track = null;

			Array.prototype.some.call( tracks, function ( track ) {
				if ( Number( track.getAttribute( 'data-wpbc-timeline-resource-id' ) ) === Number( resource_id ) ) {
					matched_track = track;
					return true;
				}
				return false;
			} );

			return matched_track;
		}

		/**
		 * Locate the physical cell under a pointer without assuming RTL scroll signs.
		 *
		 * @param {Element} track Resource track.
		 * @param {number} client_x Pointer viewport X coordinate.
		 * @return {number} Bounded cell index.
		 */
		function get_selection_cell_index( track, client_x ) {
			var cells = track.querySelectorAll( '.wpbc_timeline__canvas_cell' );
			var closest_index = 0;
			var closest_distance = Infinity;

			Array.prototype.some.call( cells, function ( cell, cell_index ) {
				var rectangle = cell.getBoundingClientRect();
				var distance;

				if ( client_x >= rectangle.left && client_x <= rectangle.right ) {
					closest_index = cell_index;
					return true;
				}
				distance = Math.abs( client_x - ( rectangle.left + rectangle.width / 2 ) );
				if ( distance < closest_distance ) {
					closest_distance = distance;
					closest_index = cell_index;
				}
				return false;
			} );

			return Math.max( 0, Math.min( Math.max( 0, cells.length - 1 ), closest_index ) );
		}

		/**
		 * Update the local half-open draft from two inclusive cell indexes.
		 *
		 * @param {number} resource_id Authorized Resource ID from the rendered DTO.
		 * @param {number} first_index First selected cell.
		 * @param {number} last_index Last selected cell.
		 * @param {string} phase Selection state phase.
		 * @return {boolean} True when the axis boundaries were available.
		 */
		function set_selection_range( resource_id, first_index, last_index, phase ) {
			var cells = settings.axis && Array.isArray( settings.axis.cells ) ? settings.axis.cells : [];
			var start_index = Math.max( 0, Math.min( first_index, last_index ) );
			var end_index = Math.min( cells.length - 1, Math.max( first_index, last_index ) );
			var start_cell = cells[ start_index ];
			var end_cell = cells[ end_index ];

			if ( ! start_cell || ! end_cell ) {
				return false;
			}
			selection_state.phase = phase;
			selection_state.resource_id = Number( resource_id );
			selection_state.start_index = start_index;
			selection_state.end_index = end_index;
			selection_state.start_at = start_cell.start_at;
			selection_state.end_at = end_cell.end_at;
			selection_state.start_epoch = Number( start_cell.start_epoch );
			selection_state.end_epoch = Number( end_cell.end_epoch );
			selection_state.preview = null;
			selection_state.error_message = '';
			render_selection();
			return true;
		}

		/**
		 * Keep the selection popover inside the visible Timeline canvas.
		 *
		 * The popover is row-owned so it scrolls horizontally with the selected
		 * range. The canvas clips vertical overflow, therefore the preferred
		 * block placement must be selected against the visible canvas body and
		 * viewport instead of always opening below the selection.
		 *
		 * @return {void}
		 */
		function position_selection_popover() {
			var popover = mount ? mount.querySelector( '[data-wpbc-timeline-selection-popover]' ) : null;
			var canvas = mount ? mount.querySelector( '[data-wpbc-timeline-canvas]' ) : null;
			var canvas_body = canvas ? canvas.querySelector( '.wpbc_timeline__canvas_body' ) : null;
			var selection = mount ? mount.querySelector( '[data-wpbc-timeline-selection]' ) : null;
			var popover_rectangle;
			var canvas_rectangle;
			var canvas_body_rectangle;
			var selection_rectangle;
			var viewport_width;
			var viewport_height;
			var visible_inline_start;
			var visible_inline_end;
			var visible_block_start;
			var visible_block_end;
			var available_above;
			var available_below;
			var placement = 'below';
			var placement_space = 0;
			var shift = 0;

			if ( ! popover || ! canvas ) {
				return;
			}
			viewport_width = window.innerWidth || ( document.documentElement ? document.documentElement.clientWidth : 0 );
			viewport_height = window.innerHeight || ( document.documentElement ? document.documentElement.clientHeight : 0 );
			popover.style.setProperty( '--wpbc-timeline-selection-popover-shift', '0px' );
			popover.style.removeProperty( '--wpbc-timeline-selection-popover-max-block-size' );
			popover.setAttribute( 'data-wpbc-timeline-selection-popover-placement', placement );
			popover_rectangle = popover.getBoundingClientRect();
			canvas_rectangle = canvas.getBoundingClientRect();
			canvas_body_rectangle = canvas_body ? canvas_body.getBoundingClientRect() : canvas_rectangle;
			selection_rectangle = selection ? selection.getBoundingClientRect() : null;
			visible_inline_start = Math.max( canvas_rectangle.left, 8 );
			visible_inline_end = Math.min( canvas_rectangle.right, viewport_width || canvas_rectangle.right ) - 8;
			visible_block_start = Math.max( canvas_rectangle.top, canvas_body_rectangle.top, 8 );
			visible_block_end = Math.min( canvas_rectangle.bottom, canvas_body_rectangle.bottom, viewport_height || canvas_rectangle.bottom ) - 8;

			if ( selection_rectangle && visible_block_end > visible_block_start ) {
				available_above = Math.max( 0, selection_rectangle.top - visible_block_start - 8 );
				available_below = Math.max( 0, visible_block_end - selection_rectangle.bottom - 8 );
				if ( available_below < popover_rectangle.height && available_above > available_below ) {
					placement = 'above';
				}
				placement_space = 'above' === placement ? available_above : available_below;
				popover.setAttribute( 'data-wpbc-timeline-selection-popover-placement', placement );
				if ( placement_space < popover_rectangle.height ) {
					popover.style.setProperty( '--wpbc-timeline-selection-popover-max-block-size', Math.max( 80, Math.floor( placement_space ) ) + 'px' );
				}
			}

			popover_rectangle = popover.getBoundingClientRect();
			if ( popover_rectangle.left < visible_inline_start ) {
				shift += visible_inline_start - popover_rectangle.left;
			}
			if ( popover_rectangle.right + shift > visible_inline_end ) {
				shift -= popover_rectangle.right + shift - visible_inline_end;
			}
			popover.style.setProperty( '--wpbc-timeline-selection-popover-shift', shift + 'px' );
		}

		/**
		 * Rebase an active selection onto the current authoritative axis.
		 *
		 * @return {boolean} True when the selection is idle or valid on this axis.
		 */
		function reconcile_selection_with_axis() {
			var cells = settings.axis && Array.isArray( settings.axis.cells ) ? settings.axis.cells : [];
			var previous_start_index = Number( selection_state.start_index );
			var start_index = -1;
			var end_index = -1;
			var index_shift;

			if ( 'idle' === selection_state.phase ) {
				return true;
			}
			if ( ! cells.length || ! selection_state.start_epoch || selection_state.end_epoch <= selection_state.start_epoch ) {
				reset_selection_state();
				return false;
			}
			cells.some( function ( cell, cell_index ) {
				if ( Number( cell.start_epoch ) === Number( selection_state.start_epoch ) ) {
					start_index = cell_index;
					return true;
				}
				return false;
			} );
			cells.some( function ( cell, cell_index ) {
				if ( Number( cell.end_epoch ) === Number( selection_state.end_epoch ) ) {
					end_index = cell_index;
					return true;
				}
				return false;
			} );
			if ( 0 > start_index || start_index > end_index ) {
				reset_selection_state();
				return false;
			}
			index_shift = 0 <= previous_start_index ? start_index - previous_start_index : 0;
			selection_state.start_index = start_index;
			selection_state.end_index = end_index;
			if ( 0 <= selection_state.anchor_index ) {
				selection_state.anchor_index = Math.max( start_index, Math.min( end_index, selection_state.anchor_index + index_shift ) );
			}

			return true;
		}

		/**
		 * Render the local selection into its Resource row only.
		 *
		 * @return {void}
		 */
		function render_selection() {
			var hosts = mount ? mount.querySelectorAll( '[data-wpbc-timeline-selection-host]' ) : [];
			var cells = settings.axis && Array.isArray( settings.axis.cells ) ? settings.axis.cells : [];
			var start_cell;
			var end_cell;
			var end_boundary_cell;
			var track;
			var host;
			var geometry;
			var selection_template;
			var popover_template;
			var template_buffer;
			var duration_minutes;
			var view_model;

			Array.prototype.forEach.call( hosts, function ( current_host ) {
				current_host.textContent = '';
			} );
			if ( 'idle' === selection_state.phase || ! selection_state.resource_id || ! cells.length ) {
				return;
			}
			if ( ! reconcile_selection_with_axis() ) {
				return;
			}
			start_cell = cells[ selection_state.start_index ];
			end_cell = cells[ selection_state.end_index ];
			if ( ! start_cell || ! end_cell ) {
				reset_selection_state();
				return;
			}
			track = get_selection_track( selection_state.resource_id );
			host = track ? track.querySelector( '[data-wpbc-timeline-selection-host]' ) : null;
			if ( ! host || selection_state.start_epoch < Number( settings.axis.start_epoch ) || selection_state.end_epoch > Number( settings.axis.end_epoch ) ) {
				return;
			}
			geometry = 'function' === typeof context.get_segment_geometry
				? context.get_segment_geometry( settings.axis, selection_state.start_epoch, selection_state.end_epoch )
				: { offset_percent: 0, width_percent: 0 };
			duration_minutes = Math.max( get_selection_cell_minutes(), Math.round( ( selection_state.end_epoch - selection_state.start_epoch ) / 60 ) );
			end_boundary_cell = cells[ selection_state.end_index + 1 ];
			view_model = {
				offset_percent: geometry.offset_percent,
				width_percent: geometry.width_percent,
				center_percent: geometry.offset_percent + geometry.width_percent / 2,
				active_boundary: selection_resize_state ? selection_resize_state.boundary : '',
				duration_label: selection_state.preview && selection_state.preview.selection ? selection_state.preview.selection.duration_label : format_selection_duration( duration_minutes ),
				aria_label: settings.i18n.selection_preview,
				start_handle: {
					label: settings.i18n.selection_start_handle,
					min: 1,
					max: selection_state.end_index + 1,
					now: selection_state.start_index + 1,
					value_text: start_cell.aria_label || selection_state.start_at
				},
				end_handle: {
					label: settings.i18n.selection_end_handle,
					min: selection_state.start_index + 1,
					max: cells.length,
					now: selection_state.end_index + 1,
					value_text: end_boundary_cell && end_boundary_cell.aria_label ? end_boundary_cell.aria_label : selection_state.end_at
				},
				state: selection_state.phase,
				preview: selection_state.preview,
				error_message: selection_state.error_message,
				i18n: settings.i18n
			};
			selection_template = get_template( 'selection' );
			popover_template = get_template( 'selection_popover' );
			if ( selection_template ) {
				template_buffer = document.createElement( 'div' );
				template_buffer.innerHTML = selection_template( view_model );
				while ( template_buffer.firstChild ) {
					host.appendChild( template_buffer.firstChild );
				}
			}
			if ( popover_template && -1 !== [ 'loading', 'ready', 'error' ].indexOf( selection_state.phase ) ) {
				template_buffer = document.createElement( 'div' );
				template_buffer.innerHTML = popover_template( view_model );
				while ( template_buffer.firstChild ) {
					host.appendChild( template_buffer.firstChild );
				}
				window.requestAnimationFrame( position_selection_popover );
			}
		}

		/**
		 * Abort the current selection preview and invalidate pending callbacks.
		 *
		 * @return {void}
		 */
		function abort_selection_preview_request() {
			if ( selection_preview_timer ) {
				window.clearTimeout( selection_preview_timer );
				selection_preview_timer = 0;
			}
			if ( selection_request && 'function' === typeof selection_request.abort ) {
				selection_request.abort();
			}
			selection_request = null;
			selection_request_generation += 1;
		}

		/**
		 * Reset the local selection without rendering or announcing.
		 *
		 * @return {void}
		 */
		function reset_selection_state() {
			abort_selection_preview_request();
			selection_resize_state = null;
			touch_selection_candidate = null;
			selection_state = create_empty_selection_state();
		}

		/**
		 * Debounce an authoritative preview after keyboard boundary adjustments.
		 *
		 * @param {number} delay_ms Delay in milliseconds.
		 * @return {void}
		 */
		function schedule_selection_preview( delay_ms ) {
			if ( selection_preview_timer ) {
				window.clearTimeout( selection_preview_timer );
			}
			selection_preview_timer = window.setTimeout( function () {
				selection_preview_timer = 0;
				if ( ! is_host_active() ) {
					return;
				}
				request_selection_preview();
			}, Math.max( 0, Number( delay_ms ) || 0 ) );
		}

		/**
		 * Restore keyboard focus after rendering replaces a selection handle.
		 *
		 * @param {string} boundary Start or end boundary.
		 * @return {void}
		 */
		function focus_selection_handle( boundary ) {
			window.requestAnimationFrame( function () {
				var handle;

				if ( ! is_host_active() ) {
					return;
				}
				handle = mount.querySelector( '[data-wpbc-timeline-selection-handle="' + boundary + '"]' );
				if ( handle ) {
					handle.focus();
				}
			} );
		}

		/**
		 * Cancel the local draft and any in-flight preview without writing data.
		 *
		 * @param {boolean} should_announce Whether to announce cancellation.
		 * @return {void}
		 */
		function cancel_selection( should_announce ) {
			if ( 'applying' === selection_state.phase ) {
				return;
			}
			reset_selection_state();
			render_selection();
			if ( should_announce ) {
				announce( settings.i18n.selection_cancelled );
			}
		}

		/**
		 * Consume a ready selection only when its signed action token is exact.
		 *
		 * The token remains opaque. This comparison prevents an unrelated draft from
		 * being cleared by a booking created from the toolbar or another selection
		 * surface.
		 *
		 * @param {string} action_id Stable preview action identifier.
		 * @param {string} query_arg Signed-token query argument name.
		 * @param {string} token     Opaque signed token consumed by creation.
		 * @return {boolean} True when the current selection matched and was cleared.
		 */
		function consume_signed_action_context( action_id, query_arg, token ) {
			var action = selection_state.preview && selection_state.preview.actions
				? selection_state.preview.actions[ action_id ]
				: null;
			var action_url;

			if (
				'ready' !== selection_state.phase
				|| ! action
				|| true !== action.authorized
				|| true !== action.enabled
				|| ! action.url
				|| ! /^[a-zA-Z0-9_-]{1,64}$/.test( String( query_arg || '' ) )
				|| ! /^[A-Za-z0-9._-]{1,8192}$/.test( String( token || '' ) )
				|| ! window.URL
			) {
				return false;
			}
			try {
				action_url = new window.URL( String( action.url ), window.location.href );
			} catch ( error ) {
				return false;
			}
			if ( String( action_url.searchParams.get( query_arg ) || '' ) !== String( token ) ) {
				return false;
			}
			cancel_selection( false );

			return true;
		}

		/**
		 * Return signed context for each currently cached authorized window.
		 *
		 * @return {Array<string>} Bounded loaded-window tokens.
		 */
		function get_loaded_selection_context_tokens() {
			if ( 'function' !== typeof context.get_loaded_context_tokens ) {
				return [];
			}

			return context.get_loaded_context_tokens();
		}

		/**
		 * Reload authorization and domain projections for the completed local draft.
		 *
		 * @return {void}
		 */
		function request_selection_preview() {
			var transport = settings.transport && settings.transport.selection ? settings.transport.selection : {};
			var generation;

			if ( ! window.jQuery || ! settings.transport.url || ! transport.preview_action || ! transport.preview_nonce || 'idle' === selection_state.phase ) {
				return;
			}
			abort_selection_preview_request();
			generation = selection_request_generation;
			selection_state.phase = 'loading';
			selection_state.error_message = '';
			render_selection();
			announce( settings.i18n.selection_ready );
			selection_request = window.jQuery.ajax( {
				url: settings.transport.url,
				method: 'POST',
				dataType: 'json',
				timeout: 'function' === typeof context.get_request_timeout_ms ? context.get_request_timeout_ms() : 15000,
				data: {
					action: transport.preview_action,
					nonce: transport.preview_nonce,
					resource_id: selection_state.resource_id,
					view: settings.axis.view,
					start_at: selection_state.start_at,
					end_at: selection_state.end_at,
					loaded_start_at: settings.axis.start_at,
					loaded_end_at: settings.axis.end_at,
					loaded_context_tokens: get_loaded_selection_context_tokens(),
					return_context: 'function' === typeof context.get_return_context ? context.get_return_context() : {}
				}
			} ).done( function ( response ) {
				if ( generation !== selection_request_generation ) {
					return;
				}
				if ( ! response || ! response.success || ! response.data || ! response.data.selection ) {
					selection_state.phase = 'error';
					selection_state.error_message = settings.i18n.error_message;
					return;
				}
				selection_state.preview = response.data;
				selection_state.phase = 'ready';
			} ).fail( function ( request, request_status ) {
				var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};

				if ( generation !== selection_request_generation || 'abort' === request_status ) {
					return;
				}
				selection_state.phase = 'error';
				selection_state.error_message = error.message || settings.i18n.error_message;
			} ).always( function () {
				if ( generation !== selection_request_generation ) {
					return;
				}
				selection_request = null;
				render_selection();
			} );
		}

		/**
		 * Update one selection boundary without allowing the handles to cross.
		 *
		 * @param {string} boundary Start or end boundary.
		 * @param {number} requested_index Requested server-axis cell index.
		 * @param {string} phase Selection state phase.
		 * @return {boolean} True when the boundary was updated.
		 */
		function set_selection_boundary( boundary, requested_index, phase ) {
			var maximum_index = settings.axis && Array.isArray( settings.axis.cells ) ? settings.axis.cells.length - 1 : -1;
			var bounded_index;

			if ( 0 > maximum_index || -1 === [ 'start', 'end' ].indexOf( boundary ) ) {
				return false;
			}
			if ( 'start' === boundary ) {
				bounded_index = Math.max( 0, Math.min( selection_state.end_index, requested_index ) );
				if ( bounded_index === selection_state.start_index ) {
					return false;
				}
				return set_selection_range( selection_state.resource_id, bounded_index, selection_state.end_index, phase );
			}
			bounded_index = Math.max( selection_state.start_index, Math.min( maximum_index, requested_index ) );
			if ( bounded_index === selection_state.end_index ) {
				return false;
			}
			return set_selection_range( selection_state.resource_id, selection_state.start_index, bounded_index, phase );
		}

		/**
		 * Begin a pointer-owned boundary resize while preserving the prior draft.
		 *
		 * @param {PointerEvent} event Pointer-down event.
		 * @param {Element} handle Activated selection handle.
		 * @param {Element} track Stable Resource selection track.
		 * @return {boolean} True when the resize gesture started.
		 */
		function begin_selection_resize( event, handle, track ) {
			var boundary = handle.getAttribute( 'data-wpbc-timeline-selection-handle' );

			if ( 'idle' === selection_state.phase || 'applying' === selection_state.phase || -1 === [ 'start', 'end' ].indexOf( boundary ) ) {
				return false;
			}
			selection_resize_state = {
				boundary: boundary,
				pointer_id: event.pointerId,
				phase: selection_state.phase,
				start_index: selection_state.start_index,
				end_index: selection_state.end_index,
				start_at: selection_state.start_at,
				end_at: selection_state.end_at,
				start_epoch: selection_state.start_epoch,
				end_epoch: selection_state.end_epoch,
				preview: selection_state.preview,
				error_message: selection_state.error_message
			};
			abort_selection_preview_request();
			touch_selection_candidate = null;
			selection_state.phase = 'resizing';
			selection_state.pointer_id = event.pointerId;
			selection_state.preview = null;
			selection_state.error_message = '';
			event.preventDefault();
			event.stopPropagation();
			track.setPointerCapture( event.pointerId );
			render_selection();
			focus_selection_handle( boundary );
			return true;
		}

		/**
		 * Restore the exact selection that existed before a cancelled resize.
		 *
		 * @param {boolean} should_focus Whether to restore focus to the handle.
		 * @return {void}
		 */
		function restore_selection_resize( should_focus ) {
			var previous_state = selection_resize_state;
			var boundary;
			var should_reload_preview;

			if ( ! previous_state ) {
				return;
			}
			boundary = previous_state.boundary;
			should_reload_preview = 'loading' === previous_state.phase;
			selection_resize_state = null;
			selection_state.phase = should_reload_preview ? 'draft' : previous_state.phase;
			selection_state.start_index = previous_state.start_index;
			selection_state.end_index = previous_state.end_index;
			selection_state.start_at = previous_state.start_at;
			selection_state.end_at = previous_state.end_at;
			selection_state.start_epoch = previous_state.start_epoch;
			selection_state.end_epoch = previous_state.end_epoch;
			selection_state.preview = previous_state.preview;
			selection_state.error_message = previous_state.error_message;
			selection_state.pointer_id = null;
			render_selection();
			if ( should_focus ) {
				focus_selection_handle( boundary );
			}
			if ( should_reload_preview ) {
				request_selection_preview();
			}
		}

		/**
		 * Commit a local boundary gesture and request a fresh server preview.
		 *
		 * @param {PointerEvent} event Pointer-up event.
		 * @return {void}
		 */
		function complete_selection_resize( event ) {
			var previous_state = selection_resize_state;
			var boundary;
			var changed;

			if ( ! previous_state || previous_state.pointer_id !== event.pointerId ) {
				return;
			}
			boundary = previous_state.boundary;
			changed = previous_state.start_index !== selection_state.start_index || previous_state.end_index !== selection_state.end_index;
			if ( ! changed ) {
				restore_selection_resize( true );
				return;
			}
			selection_resize_state = null;
			selection_state.phase = 'draft';
			selection_state.pointer_id = null;
			render_selection();
			focus_selection_handle( boundary );
			request_selection_preview();
		}

		/**
		 * Adjust one selection slider with physical-direction keyboard controls.
		 *
		 * @param {KeyboardEvent} event Keyboard event.
		 * @param {Element} handle Focused selection handle.
		 * @return {boolean} True when the key belonged to the handle.
		 */
		function handle_selection_handle_keydown( event, handle ) {
			var boundary = handle.getAttribute( 'data-wpbc-timeline-selection-handle' );
			var supported_keys = [ 'ArrowLeft', 'ArrowRight', 'Home', 'End' ];
			var requested_index;
			var direction;

			if ( -1 === supported_keys.indexOf( event.key ) ) {
				return false;
			}
			event.preventDefault();
			event.stopPropagation();
			if ( 'applying' === selection_state.phase ) {
				return true;
			}
			requested_index = 'start' === boundary ? selection_state.start_index : selection_state.end_index;
			if ( 'Home' === event.key ) {
				requested_index = 'start' === boundary ? 0 : selection_state.start_index;
			} else if ( 'End' === event.key ) {
				requested_index = 'start' === boundary ? selection_state.end_index : settings.axis.cells.length - 1;
			} else {
				direction = ( 'ArrowRight' === event.key ? 1 : -1 ) * ( settings.is_rtl ? -1 : 1 );
				requested_index += direction;
			}
			if ( 'start' === boundary ) {
				requested_index = Math.max( 0, Math.min( selection_state.end_index, requested_index ) );
			} else {
				requested_index = Math.max( selection_state.start_index, Math.min( settings.axis.cells.length - 1, requested_index ) );
			}
			if ( ( 'start' === boundary && requested_index !== selection_state.start_index ) || ( 'end' === boundary && requested_index !== selection_state.end_index ) ) {
				abort_selection_preview_request();
			}
			if ( set_selection_boundary( boundary, requested_index, 'draft' ) ) {
				focus_selection_handle( boundary );
				schedule_selection_preview( 180 );
			}
			return true;
		}

		/**
		 * Apply one reviewed Availability-domain action.
		 *
		 * @param {string} mode Block or unblock.
		 * @return {void}
		 */
		function apply_selection_block( mode ) {
			var transport = settings.transport && settings.transport.selection ? settings.transport.selection : {};
			var generation;

			if ( ! window.jQuery || ! selection_state.preview || ! selection_state.preview.block_token || ! transport.apply_action || ! transport.apply_nonce ) {
				return;
			}
			selection_request_generation += 1;
			generation = selection_request_generation;
			selection_state.phase = 'applying';
			render_selection();
			if ( 'function' === typeof context.set_apply_loading ) {
				context.set_apply_loading( true, settings.i18n.applying_availability );
			}
			selection_request = window.jQuery.ajax( {
				url: settings.transport.url,
				method: 'POST',
				dataType: 'json',
				timeout: 'function' === typeof context.get_request_timeout_ms ? context.get_request_timeout_ms() : 15000,
				data: {
					action: transport.apply_action,
					nonce: transport.apply_nonce,
					block_token: selection_state.preview.block_token,
					mode: mode
				}
			} ).done( function ( response ) {
				if ( generation !== selection_request_generation ) {
					return;
				}
				if ( ! response || ! response.success ) {
					selection_state.phase = 'error';
					selection_state.error_message = response && response.data && response.data.message ? response.data.message : settings.i18n.error_message;
					return;
				}
				selection_resize_state = null;
				touch_selection_candidate = null;
				selection_state = create_empty_selection_state();
				render_selection();
				if ( 'function' === typeof context.refresh_after_apply ) {
					context.refresh_after_apply();
				}
			} ).fail( function ( request, request_status ) {
				var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};

				if ( generation !== selection_request_generation || 'abort' === request_status ) {
					return;
				}
				selection_state.phase = 'error';
				selection_state.error_message = error.message || settings.i18n.error_message;
			} ).always( function () {
				if ( generation === selection_request_generation ) {
					selection_request = null;
					if ( 'function' === typeof context.set_apply_loading ) {
						context.set_apply_loading( false, '' );
					}
					render_selection();
				}
			} );
		}

		/**
		 * Start mouse/pen selection or record a touch tap candidate.
		 *
		 * @param {PointerEvent} event Pointer-down event.
		 * @return {void}
		 */
		function handle_selection_pointer_down( event ) {
			var track = event.target.closest( '[data-wpbc-timeline-selection-track]' );
			var handle = event.target.closest( '[data-wpbc-timeline-selection-handle]' );
			var cell_index;
			var resource_id;

			if ( handle ) {
				if ( track ) {
					begin_selection_resize( event, handle, track );
				}
				return;
			}
			if ( ! track || event.target.closest( '[data-wpbc-timeline-sortable-exclude], [data-wpbc-booking-overview-info-trigger], [data-wpbc-timeline-segment-id], [data-wpbc-timeline-selection-popover], button, a' ) || ( 'mouse' === event.pointerType && 0 !== event.button ) ) {
				return;
			}
			cell_index = get_selection_cell_index( track, event.clientX );
			resource_id = Number( track.getAttribute( 'data-wpbc-timeline-resource-id' ) );
			if ( 'touch' === event.pointerType ) {
				if ( 'touch_start' !== selection_state.phase || selection_state.resource_id !== resource_id ) {
					abort_selection_preview_request();
				}
				touch_selection_candidate = {
					pointer_id: event.pointerId,
					resource_id: resource_id,
					cell_index: cell_index,
					start_x: event.clientX,
					start_y: event.clientY,
					moved: false
				};
				return;
			}
			event.preventDefault();
			abort_selection_preview_request();
			selection_state.pointer_id = event.pointerId;
			set_selection_range( resource_id, cell_index, cell_index, 'drawing' );
			selection_state.anchor_index = cell_index;
			track.setPointerCapture( event.pointerId );
		}

		/**
		 * Extend a mouse/pen draft while preserving ordinary touch scrolling.
		 *
		 * @param {PointerEvent} event Pointer-move event.
		 * @return {void}
		 */
		function handle_selection_pointer_move( event ) {
			var track;
			var cell_index;

			if ( selection_resize_state && selection_resize_state.pointer_id === event.pointerId ) {
				track = get_selection_track( selection_state.resource_id );
				if ( ! track ) {
					return;
				}
				event.preventDefault();
				cell_index = get_selection_cell_index( track, event.clientX );
				set_selection_boundary( selection_resize_state.boundary, cell_index, 'resizing' );
				selection_state.pointer_id = event.pointerId;
				focus_selection_handle( selection_resize_state.boundary );
				return;
			}
			if ( touch_selection_candidate && touch_selection_candidate.pointer_id === event.pointerId ) {
				if ( 8 < Math.abs( event.clientX - touch_selection_candidate.start_x ) || 8 < Math.abs( event.clientY - touch_selection_candidate.start_y ) ) {
					touch_selection_candidate.moved = true;
				}
				return;
			}
			if ( 'drawing' !== selection_state.phase || selection_state.pointer_id !== event.pointerId ) {
				return;
			}
			track = get_selection_track( selection_state.resource_id );
			if ( ! track ) {
				return;
			}
			event.preventDefault();
			cell_index = get_selection_cell_index( track, event.clientX );
			set_selection_range( selection_state.resource_id, selection_state.anchor_index, cell_index, 'drawing' );
			selection_state.pointer_id = event.pointerId;
		}

		/**
		 * Complete a pointer draft or process one touch-safe boundary tap.
		 *
		 * @param {PointerEvent} event Pointer-up event.
		 * @return {void}
		 */
		function handle_selection_pointer_up( event ) {
			var candidate;

			if ( selection_resize_state && selection_resize_state.pointer_id === event.pointerId ) {
				complete_selection_resize( event );
				return;
			}
			if ( touch_selection_candidate && touch_selection_candidate.pointer_id === event.pointerId ) {
				candidate = touch_selection_candidate;
				touch_selection_candidate = null;
				if ( candidate.moved ) {
					return;
				}
				if ( 'touch_start' === selection_state.phase && selection_state.resource_id === candidate.resource_id ) {
					set_selection_range( candidate.resource_id, selection_state.anchor_index, candidate.cell_index, 'draft' );
					request_selection_preview();
				} else {
					set_selection_range( candidate.resource_id, candidate.cell_index, candidate.cell_index, 'touch_start' );
					selection_state.anchor_index = candidate.cell_index;
				}
				return;
			}
			if ( 'drawing' !== selection_state.phase || selection_state.pointer_id !== event.pointerId ) {
				return;
			}
			selection_state.pointer_id = null;
			selection_state.phase = 'draft';
			render_selection();
			request_selection_preview();
		}

		/**
		 * Abandon only the active pointer gesture when the browser cancels it.
		 *
		 * @param {PointerEvent} event Cancelled pointer event.
		 * @return {void}
		 */
		function handle_selection_pointer_cancel( event ) {
			if ( touch_selection_candidate && touch_selection_candidate.pointer_id === event.pointerId ) {
				touch_selection_candidate = null;
			}
			if ( selection_resize_state && selection_resize_state.pointer_id === event.pointerId ) {
				restore_selection_resize( true );
			} else if ( 'drawing' === selection_state.phase && selection_state.pointer_id === event.pointerId ) {
				cancel_selection( false );
			}
		}

		/**
		 * Treat unexpected pointer-capture loss as a cancelled local gesture.
		 *
		 * @param {PointerEvent} event Lost-pointer-capture event.
		 * @return {void}
		 */
		function handle_selection_lost_pointer_capture( event ) {
			if ( selection_resize_state && selection_resize_state.pointer_id === event.pointerId ) {
				restore_selection_resize( true );
			} else if ( 'drawing' === selection_state.phase && selection_state.pointer_id === event.pointerId ) {
				cancel_selection( false );
			}
		}

		/**
		 * Provide start/end selection through the focused Resource row.
		 *
		 * @param {KeyboardEvent} event Keyboard event.
		 * @return {boolean} True when the event belonged to selection mechanics.
		 */
		function handle_selection_keydown( event ) {
			var track = event.target.closest( '[data-wpbc-timeline-selection-track]' );
			var handle = event.target.closest( '[data-wpbc-timeline-selection-handle]' );
			var resource_id;
			var cursor_index;
			var direction;

			if ( 'Escape' === event.key && 'idle' !== selection_state.phase ) {
				event.preventDefault();
				if ( 'applying' === selection_state.phase ) {
					return true;
				}
				if ( selection_resize_state ) {
					restore_selection_resize( true );
				} else {
					cancel_selection( true );
				}
				return true;
			}
			if ( handle && handle_selection_handle_keydown( event, handle ) ) {
				return true;
			}
			if ( ! track || -1 === [ 'ArrowLeft', 'ArrowRight', 'Enter', ' ' ].indexOf( event.key ) ) {
				return false;
			}
			resource_id = Number( track.getAttribute( 'data-wpbc-timeline-resource-id' ) );
			cursor_index = Number( track.getAttribute( 'data-wpbc-timeline-selection-cursor' ) );
			if ( ! Number.isFinite( cursor_index ) || 0 > cursor_index ) {
				cursor_index = Math.max( 0, Math.min( settings.axis.cells.length - 1, Math.floor( settings.axis.cells.length / 2 ) ) );
			}
			if ( 'ArrowLeft' === event.key || 'ArrowRight' === event.key ) {
				event.preventDefault();
				direction = ( 'ArrowRight' === event.key ? 1 : -1 ) * ( settings.is_rtl ? -1 : 1 );
				cursor_index = Math.max( 0, Math.min( settings.axis.cells.length - 1, cursor_index + direction ) );
				track.setAttribute( 'data-wpbc-timeline-selection-cursor', cursor_index );
				if ( event.shiftKey ) {
					if ( 'keyboard_start' !== selection_state.phase || selection_state.resource_id !== resource_id ) {
						set_selection_range( resource_id, cursor_index - direction, cursor_index, 'keyboard_start' );
						selection_state.anchor_index = cursor_index - direction;
					} else {
						set_selection_range( resource_id, selection_state.anchor_index, cursor_index, 'keyboard_start' );
					}
				}
				Array.prototype.forEach.call( track.querySelectorAll( '.wpbc_timeline__canvas_cell' ), function ( cell, cell_index ) {
					cell.classList.toggle( 'is-selection-cursor', cell_index === cursor_index );
				} );
				return true;
			}
			event.preventDefault();
			if ( 'keyboard_start' === selection_state.phase && selection_state.resource_id === resource_id ) {
				selection_state.phase = 'draft';
				render_selection();
				request_selection_preview();
			} else {
				abort_selection_preview_request();
				set_selection_range( resource_id, cursor_index, cursor_index, 'keyboard_start' );
				selection_state.anchor_index = cursor_index;
			}
			return true;
		}

		/**
		 * Handle selection popover actions through Timeline's delegated click path.
		 *
		 * @param {MouseEvent} event Timeline click event.
		 * @return {boolean} True when a selection action owned the event.
		 */
		function handle_click( event ) {
			var selection_cancel = event.target.closest( '[data-wpbc-timeline-selection-cancel]' );
			var selection_retry = event.target.closest( '[data-wpbc-timeline-selection-retry]' );
			var selection_block = event.target.closest( '[data-wpbc-timeline-selection-block]' );

			if ( selection_cancel ) {
				cancel_selection( true );
				return true;
			}
			if ( selection_retry ) {
				request_selection_preview();
				return true;
			}
			if ( selection_block ) {
				apply_selection_block( selection_block.getAttribute( 'data-wpbc-timeline-selection-block' ) );
				return true;
			}

			return false;
		}

		/**
		 * Report whether a local empty-range draft currently exists.
		 *
		 * @return {boolean} True for every non-idle selection phase.
		 */
		function is_active() {
			return 'idle' !== selection_state.phase;
		}

		/**
		 * Report whether a boundary pointer gesture currently owns attention.
		 *
		 * @return {boolean} True while a start/end handle is being resized.
		 */
		function is_resizing() {
			return Boolean( selection_resize_state );
		}

		/**
		 * Initialize pointer ownership exactly once for this Timeline mount.
		 *
		 * @return {void}
		 */
		function initialize() {
			if ( ! mount || is_initialized ) {
				return;
			}
			is_initialized = true;
			mount.setAttribute( 'data-wpbc-timeline-empty-range-selection-ready', 'true' );
			mount.addEventListener( 'pointerdown', handle_selection_pointer_down );
			mount.addEventListener( 'pointermove', handle_selection_pointer_move );
			mount.addEventListener( 'pointerup', handle_selection_pointer_up );
			mount.addEventListener( 'pointercancel', handle_selection_pointer_cancel );
			mount.addEventListener( 'lostpointercapture', handle_selection_lost_pointer_capture );
		}

		/**
		 * Tear down requests, pointer capture, listeners, timers, and local state.
		 *
		 * @return {void}
		 */
		function destroy() {
			var active_pointer_id = selection_resize_state ? selection_resize_state.pointer_id : selection_state.pointer_id;
			var selection_track = get_selection_track( selection_state.resource_id );

			if ( ! is_initialized ) {
				return;
			}
			if (
				selection_track
				&& null !== active_pointer_id
				&& 'function' === typeof selection_track.hasPointerCapture
				&& 'function' === typeof selection_track.releasePointerCapture
				&& selection_track.hasPointerCapture( active_pointer_id )
			) {
				selection_track.releasePointerCapture( active_pointer_id );
			}
			mount.removeEventListener( 'pointerdown', handle_selection_pointer_down );
			mount.removeEventListener( 'pointermove', handle_selection_pointer_move );
			mount.removeEventListener( 'pointerup', handle_selection_pointer_up );
			mount.removeEventListener( 'pointercancel', handle_selection_pointer_cancel );
			mount.removeEventListener( 'lostpointercapture', handle_selection_lost_pointer_capture );
			mount.removeAttribute( 'data-wpbc-timeline-empty-range-selection-ready' );
			is_initialized = false;
			if ( 'function' === typeof context.set_apply_loading ) {
				context.set_apply_loading( false, '' );
			}
			reset_selection_state();
			render_selection();
		}

		return {
			initialize: initialize,
			destroy: destroy,
			handle_click: handle_click,
			handle_keydown: handle_selection_keydown,
			is_active: is_active,
			is_resizing: is_resizing,
			consume_signed_action_context: consume_signed_action_context,
			cancel: cancel_selection,
			reset: function () {
				cancel_selection( false );
			},
			render: render_selection,
			position_popover: position_selection_popover
		};
	}

	if ( window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory ) {
		window.wpbc_timeline_modules.register_factory( module_id, create_empty_range_selection_controller );
	}
}( window, document ) );
