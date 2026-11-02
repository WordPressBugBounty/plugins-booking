/**
 * Development-only Timeline time-row selection and action adapter.
 *
 * The adapter owns local gestures and one presentation-only draft. It consumes
 * accepted geometry from the time-rows module. The existing Timeline server
 * endpoints remain authoritative for preview, action eligibility, mutation,
 * and canonical readback.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, wp ) {
	'use strict';

	var module_id = 'time_rows_selection';
	var surface_selector = '.wpbc_timeline_time_rows__timed_surface';
	var panel_selector = '[data-wpbc-timeline-time-rows-panel="canvas"]';
	var canvas_selector = '[data-wpbc-timeline-canvas]';
	var column_selector = '[data-wpbc-timeline-time-rows-date]';
	var overlay_selector = '[data-wpbc-timeline-time-rows-selection-overlay]';
	var boundary_selector = '[data-wpbc-timeline-time-rows-selection-boundary]';
	var fold_choice_selector = '[data-wpbc-timeline-time-rows-selection-fold-choice]';
	var actions_selector = '[data-wpbc-timeline-time-rows-selection-actions]';
	var ready_actions_inline_size = 560;
	var status_actions_inline_size = 440;
	var minimum_actions_inline_size = 340;
	var minimum_actions_block_size = 150;
	var actions_separation_pixels = 8;
	var excluded_selector = [
		'.wpbc_timeline_time_rows__booking',
		'.wpbc_timeline_time_rows__overflow',
		'.wpbc_timeline_time_rows__canvas_toolbar',
		'[data-wpbc-timeline-booking-select]',
		'[data-wpbc-booking-overview-info-trigger]',
		'[data-wpbc-timeline-booking-details-action]',
		'[data-wpbc-timeline-booking-movement-grip]',
		'[data-wpbc-timeline-booking-resize-handle]',
		'[data-wpbc-timeline-booking-resize-host]',
		overlay_selector,
		'button',
		'a',
		'input',
		'select',
		'textarea',
		'summary',
		'details'
	].join( ',' );

	/**
	 * Choose an action-popover side from measured available space.
	 *
	 * Expanded time rows prefer a horizontal side that preserves the readable
	 * minimum width. When both sides fit, the roomier side wins; an exact tie
	 * uses logical inline-end. Narrow layouts fall back to the established
	 * below/above policy without covering the selected range.
	 *
	 * @param {number} minimum_inline_size Readable minimum popover width.
	 * @param {number} actions_block_size  Measured popover block size.
	 * @param {number} available_left      Available pixels left of the selection.
	 * @param {number} available_right     Available pixels right of the selection.
	 * @param {number} available_above     Available pixels above the selection.
	 * @param {number} available_below     Available pixels below the selection.
	 * @param {string} direction           Accepted `ltr` or `rtl` direction.
	 * @return {string} `left`, `right`, `above`, or `below`.
	 */
	function resolve_actions_placement( minimum_inline_size, actions_block_size, available_left, available_right, available_above, available_below, direction ) {
		var left_fits = available_left >= minimum_inline_size;
		var right_fits = available_right >= minimum_inline_size;

		if ( left_fits && right_fits ) {
			if ( available_left === available_right ) {
				return 'rtl' === direction ? 'left' : 'right';
			}
			return available_left > available_right ? 'left' : 'right';
		}
		if ( right_fits ) {
			return 'right';
		}
		if ( left_fits ) {
			return 'left';
		}
		if ( available_below >= actions_block_size ) {
			return 'below';
		}
		if ( available_above >= actions_block_size ) {
			return 'above';
		}

		return available_above > available_below ? 'above' : 'below';
	}

	/**
	 * Position an action popover beyond the complete selected block range.
	 *
	 * Keeping this calculation independent from viewport clamping prevents a
	 * constrained popover from covering either editable boundary control.
	 *
	 * @param {string} placement            `above` or `below`.
	 * @param {number} selection_block_start Selected range outer start edge.
	 * @param {number} selection_block_end   Selected range outer end edge.
	 * @param {number} actions_block_size    Rendered popover block size.
	 * @param {number} separation_pixels     Required visual separation.
	 * @return {number} Popover block-start coordinate.
	 */
	function resolve_actions_block_start( placement, selection_block_start, selection_block_end, actions_block_size, separation_pixels ) {
		return 'above' === placement
			? selection_block_start - actions_block_size - separation_pixels
			: selection_block_end + separation_pixels;
	}

	/**
	 * Position a horizontally placed popover outside the selected slice union.
	 *
	 * @param {string} placement             Physical `left` or `right` side.
	 * @param {number} selection_inline_left Selected range physical left edge.
	 * @param {number} selection_inline_right Selected range physical right edge.
	 * @param {number} actions_inline_size   Rendered popover inline size.
	 * @param {number} separation_pixels     Required visual separation.
	 * @return {number} Physical popover inline-start coordinate.
	 */
	function resolve_actions_inline_start( placement, selection_inline_left, selection_inline_right, actions_inline_size, separation_pixels ) {
		return 'left' === placement
			? selection_inline_left - actions_inline_size - separation_pixels
			: selection_inline_right + separation_pixels;
	}

	/**
	 * Report whether a chronological boundary would cross its opposite endpoint.
	 *
	 * @param {string} boundary_name  Start or end.
	 * @param {number} coordinate_order Candidate chronological order.
	 * @param {number} opposite_order   Opposite endpoint order.
	 * @return {boolean} True when the candidate must clamp to the opposite end.
	 */
	function is_boundary_crossing( boundary_name, coordinate_order, opposite_order ) {
		return (
			( 'start' === boundary_name && coordinate_order > opposite_order )
			|| ( 'end' === boundary_name && coordinate_order < opposite_order )
		);
	}

	/**
	 * Create one local draft controller.
	 *
	 * @param {Object}  context               Timeline module context.
	 * @param {Element} context.mount         Timeline mount.
	 * @param {Object}  context.configuration Executable-free configuration.
	 * @return {Object} Symmetric lifecycle and development inspection API.
	 */
	function create_selection_controller( context ) {
		var mount = context.mount || null;
		var configuration = context.configuration || {};
		var selection_api = context.selection_api || {};
		var modules = window.wpbc_timeline_modules || null;
		var geometry = window.wpbc_timeline_time_rows_interaction_geometry || null;
		var time_rows_configuration = configuration.time_rows || {};
		var template_ids = configuration.templates || {};
		var i18n = configuration.i18n || {};
		var selection_step_minutes = Number( configuration.selection_step_minutes );
		var touch_tolerance_pixels = Math.max( 0, Number( configuration.gesture && configuration.gesture.touch_tolerance_pixels ) || 8 );
		var enhanced_surfaces = [];
		var active_state = null;
		var pending_touch = null;
		var pending_frame = 0;
		var pending_focus_coordinate = null;
		var selection_request = null;
		var selection_request_generation = 0;
		var preserve_draft_during_booking_creation_readback = false;
		var is_initialized = false;

		/**
		 * Interpolate a fixed translated label.
		 *
		 * @param {string} label        Source label.
		 * @param {Object} replacements Plain replacement strings.
		 * @return {string} Interpolated label.
		 */
		function interpolate_label( label, replacements ) {
			return Object.keys( replacements || {} ).reduce( function ( result, key ) {
				return result.split( '{' + key + '}' ).join( String( replacements[ key ] ) );
			}, String( label || '' ) );
		}

		/**
		 * Return a fixed allow-listed WordPress template.
		 *
		 * @param {string} key Semantic template key.
		 * @return {Function|null} Template function or null.
		 */
		function get_template( key ) {
			var template_id = String( template_ids[ key ] || '' );

			if ( ! template_id || ! wp || 'function' !== typeof wp.template ) {
				return null;
			}

			return wp.template( template_id );
		}

		/**
		 * Format a wall minute without browser timezone conversion.
		 *
		 * @param {number} wall_minute Minute from local midnight.
		 * @return {string} Stable HH:MM label.
		 */
		function format_wall_minute( wall_minute ) {
			var bounded_minute = Math.max( 0, Math.min( 1440, Number( wall_minute ) || 0 ) );
			var hour = Math.floor( bounded_minute / 60 );
			var minute = bounded_minute % 60;

			return String( hour ).padStart( 2, '0' ) + ':' + String( minute ).padStart( 2, '0' );
		}

		/**
		 * Format a server-derived numeric UTC offset without browser timezone APIs.
		 *
		 * @param {number} offset_minutes Signed minutes east of UTC.
		 * @return {string} Exact UTC offset such as UTC+02:00.
		 */
		function format_utc_offset( offset_minutes ) {
			var normalized_offset = Number( offset_minutes );
			var sign;
			var absolute_offset;

			if ( ! Number.isFinite( normalized_offset ) ) {
				return '';
			}
			sign = 0 <= normalized_offset ? '+' : '-';
			absolute_offset = Math.abs( normalized_offset );

			return 'UTC' + sign
				+ String( Math.floor( absolute_offset / 60 ) ).padStart( 2, '0' )
				+ ':' + String( absolute_offset % 60 ).padStart( 2, '0' );
		}

		/**
		 * Format an exact draft duration without browser-timezone conversion.
		 *
		 * @param {number} duration_minutes Exact elapsed duration in minutes.
		 * @return {string} Compact translated hours-and-minutes label.
		 */
		function format_duration( duration_minutes ) {
			var total_minutes = Math.max( 0, Math.round( Number( duration_minutes ) || 0 ) );
			var hours = Math.floor( total_minutes / 60 );
			var minutes = total_minutes % 60;
			var hours_label = hours ? interpolate_label( i18n.duration_hours_short, { count: hours } ) : '';
			var minutes_label = minutes || ! hours ? interpolate_label( i18n.duration_minutes_short, { count: minutes } ) : '';

			if ( hours_label && minutes_label ) {
				return interpolate_label( i18n.duration_hours_minutes_short, {
					hours: hours_label,
					minutes: minutes_label
				} );
			}

			return hours_label || minutes_label;
		}

		/**
		 * Format one exact geometry candidate for a concise visible endpoint label.
		 *
		 * The pure geometry kernel supplies the wall date, minute, and authoritative
		 * numeric offset. The visible boundary intentionally shows only the accepted
		 * wall date and time; exact offsets remain available in fold choices and the
		 * authoritative preview contract.
		 *
		 * @param {Object} candidate Exact start or end geometry candidate.
		 * @return {string} Accepted wall date and time.
		 */
		function format_visible_endpoint( candidate ) {
			if ( ! candidate || ! candidate.date || ! Number.isFinite( Number( candidate.wall_minute ) ) ) {
				return '';
			}

			return candidate.date + ' ' + format_wall_minute( candidate.wall_minute );
		}

		/**
		 * Return the current time-rows instance without retaining it.
		 *
		 * @return {Object|null} Time-rows instance or null.
		 */
		function get_time_rows_instance() {
			if ( ! modules || 'function' !== typeof modules.get_instance ) {
				return null;
			}

			return modules.get_instance( String( time_rows_configuration.instance_id || '' ) );
		}

		/**
		 * Resolve a surface's Resource and accepted cache identity.
		 *
		 * @param {Element} surface Timed surface.
		 * @return {Object|null} Panel identity or null.
		 */
		function get_surface_identity( surface ) {
			var panel = surface && surface.closest ? surface.closest( panel_selector ) : null;
			var resource_id = Number( panel && panel.getAttribute( 'data-wpbc-timeline-time-rows-resource-id' ) );

			if ( ! panel || ! Number.isInteger( resource_id ) || 1 > resource_id ) {
				return null;
			}

			return {
				panel: panel,
				resource_id: resource_id,
				cache_key: String( panel.getAttribute( 'data-wpbc-timeline-time-rows-cache-key' ) || '' )
			};
		}

		/**
		 * Find the current rendered timed surface for one Resource.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @return {Element|null} Current surface or null after removal.
		 */
		function find_current_surface( resource_id ) {
			return Array.prototype.find.call( mount ? mount.querySelectorAll( surface_selector ) : [], function ( surface ) {
				var identity = get_surface_identity( surface );

				return identity && identity.resource_id === Number( resource_id );
			} ) || null;
		}

		/**
		 * Measure logical date columns for one immutable gesture snapshot.
		 *
		 * @param {Element} surface Timed surface.
		 * @param {string}  direction ltr or rtl.
		 * @return {Array<Object>} Ordered logical column DTOs.
		 */
		function measure_date_columns( surface, direction ) {
			var surface_rect = surface.getBoundingClientRect();

			return Array.prototype.map.call( surface.querySelectorAll( column_selector ), function ( column ) {
				var column_rect = column.getBoundingClientRect();
				var logical_start = 'rtl' === direction
					? surface_rect.right - column_rect.right
					: column_rect.left - surface_rect.left;
				var logical_end = 'rtl' === direction
					? surface_rect.right - column_rect.left
					: column_rect.right - surface_rect.left;

				return {
					date: String( column.getAttribute( 'data-wpbc-timeline-time-rows-date' ) || '' ),
					logical_start: Math.max( 0, logical_start ),
					logical_end: Math.max( 0, logical_end )
				};
			} );
		}

		/**
		 * Prepare exactly one accepted and measured snapshot for a gesture.
		 *
		 * @param {Element} surface Timed surface.
		 * @return {Object|null} Gesture context or null when identity is stale.
		 */
		function prepare_gesture_context( surface ) {
			var surface_identity = get_surface_identity( surface );
			var time_rows = get_time_rows_instance();
			var accepted_context;
			var direction;
			var surface_style;
			var surface_rect;
			var booking_column_gutter_px;
			var prepared;

			if ( ! surface_identity || ! geometry || 'function' !== typeof geometry.prepare_geometry || ! time_rows || 'function' !== typeof time_rows.get_interaction_geometry_context ) {
				return null;
			}
			accepted_context = time_rows.get_interaction_geometry_context( surface_identity.resource_id );
			if ( ! accepted_context || surface_identity.cache_key !== String( accepted_context.cache_key || '' ) ) {
				return null;
			}
			surface_style = window.getComputedStyle( surface );
			direction = 'rtl' === surface_style.direction ? 'rtl' : 'ltr';
			booking_column_gutter_px = parseFloat( surface_style.getPropertyValue( '--wpbc-time-rows-booking-column-gutter' ) );
			booking_column_gutter_px = Number.isFinite( booking_column_gutter_px ) ? Math.max( 0, booking_column_gutter_px ) : 0;
			surface_rect = surface.getBoundingClientRect();
			prepared = geometry.prepare_geometry( {
				accepted_identity: accepted_context.accepted_identity,
				date_bands: accepted_context.date_bands,
				date_columns: measure_date_columns( surface, direction ),
				visible_range: accepted_context.visible_range,
				zoom_percent: accepted_context.zoom_percent,
				hour_height_px: accepted_context.hour_height_px,
				block_extent_px: surface_rect.height,
				selection_step_minutes: selection_step_minutes,
				direction: direction
			} );
			if ( ! prepared || 'ready' !== prepared.status ) {
				return null;
			}

			return {
				surface: surface,
				panel: surface_identity.panel,
				resource_id: surface_identity.resource_id,
				cache_key: surface_identity.cache_key,
				surface_rect: surface_rect,
				booking_column_gutter_px: booking_column_gutter_px,
				snapshot: prepared.snapshot
			};
		}

		/**
		 * Convert a PointerEvent into the snapshot's physical coordinate DTO.
		 *
		 * @param {Object} gesture_context Immutable gesture context.
		 * @param {Object} event           Pointer-like event.
		 * @return {Object} Geometry coordinate.
		 */
		function pointer_coordinate( gesture_context, event ) {
			return {
				source: 'pointer',
				selection_kind: String( configuration.selection_kind || 'timed' ),
				inline_px: Number( event.clientX ) - gesture_context.surface_rect.left,
				block_px: Number( event.clientY ) - gesture_context.surface_rect.top
			};
		}

		/**
		 * Convert one visible boundary position to its endpoint cell coordinate.
		 *
		 * End controls are painted at the half-open interval end, while the pure
		 * geometry kernel stores the selected cell whose end creates that boundary.
		 * Subtracting one approved step keeps pointer edits aligned with keyboard
		 * edits and exact server instants.
		 *
		 * @param {string}       boundary_name Start or end.
		 * @param {PointerEvent} event         Active boundary pointer event.
		 * @return {Object} Bounded pointer coordinate for the geometry kernel.
		 */
		function pointer_boundary_coordinate( boundary_name, event ) {
			var snapshot = active_state.snapshot;
			var step_extent = snapshot.selection_step_minutes * snapshot.pixels_per_minute;
			var maximum_block = Math.max( 0, snapshot.block_extent_px - step_extent );
			var maximum_inline = Math.max( 0, active_state.surface_rect.width - 0.001 );
			var coordinate = pointer_coordinate( {
				surface_rect: active_state.surface_rect
			}, event );

			if ( 'end' === boundary_name ) {
				coordinate.block_px -= step_extent;
			}
			coordinate.inline_px = Math.max( 0, Math.min( maximum_inline, coordinate.inline_px ) );
			coordinate.block_px = Math.max( 0, Math.min( maximum_block, coordinate.block_px ) );

			return coordinate;
		}

		/**
		 * Build a keyboard coordinate from a date and bounded snap index.
		 *
		 * @param {Object} snapshot Geometry snapshot.
		 * @param {string} date     Accepted date.
		 * @param {number} index    Candidate snap index.
		 * @return {Object} Keyboard coordinate.
		 */
		function keyboard_coordinate( snapshot, date, index ) {
			var maximum_index = Math.max( 0, Math.ceil( ( snapshot.visible_range.end_minute - snapshot.visible_range.start_minute ) / snapshot.selection_step_minutes ) - 1 );

			return {
				source: 'keyboard',
				selection_kind: String( configuration.selection_kind || 'timed' ),
				date: String( date || '' ),
				snap_index: Math.max( 0, Math.min( maximum_index, Number( index ) || 0 ) )
			};
		}

		/**
		 * Locate one rendered date inside the gesture-owned column collection.
		 *
		 * @param {Object} snapshot Geometry snapshot.
		 * @param {string} date     Server date key.
		 * @return {number} Zero-based column index or -1.
		 */
		function get_column_index( snapshot, date ) {
			return snapshot.date_columns.findIndex( function ( column ) {
				return column.date === date;
			} );
		}

		/**
		 * Resolve the model coordinates used even for non-exact DST drafts.
		 *
		 * @param {Object} draft Draft result.
		 * @return {Object|null} Ordered start/end cells or null.
		 */
		function get_draft_cells( draft ) {
			var anchor;
			var focus;
			var anchor_key;
			var focus_key;

			if ( ! draft || ! active_state ) {
				return null;
			}
			anchor = geometry.resolve_coordinate( active_state.snapshot, active_state.anchor_coordinate );
			focus = geometry.resolve_coordinate( active_state.snapshot, active_state.focus_coordinate );
			if ( ! anchor || ! focus || [ 'invalid', 'outside' ].indexOf( anchor.status ) !== -1 || [ 'invalid', 'outside' ].indexOf( focus.status ) !== -1 ) {
				return null;
			}
			anchor_key = get_column_index( active_state.snapshot, anchor.date ) * 100000 + anchor.snap_index;
			focus_key = get_column_index( active_state.snapshot, focus.date ) * 100000 + focus.snap_index;

			return anchor_key <= focus_key
				? { start: anchor, end: focus, start_endpoint: 'anchor' }
				: { start: focus, end: anchor, start_endpoint: 'focus' };
		}

		/**
		 * Return one geometry coordinate's stable chronological order.
		 *
		 * @param {Object} coordinate Pointer or keyboard geometry coordinate.
		 * @return {number|null} Comparable accepted order or null.
		 */
		function get_coordinate_order( coordinate ) {
			var resolved = geometry.resolve_coordinate( active_state.snapshot, coordinate );
			var date_index;

			if ( ! resolved || [ 'invalid', 'outside' ].indexOf( resolved.status ) !== -1 ) {
				return null;
			}
			date_index = get_column_index( active_state.snapshot, resolved.date );

			return -1 === date_index ? null : date_index * 100000 + resolved.snap_index;
		}

		/**
		 * Replace the endpoint currently represented by a chronological boundary.
		 *
		 * Crossing boundaries swaps which raw gesture endpoint owns Start or End.
		 * Resolving that mapping for every update keeps the dragged control attached
		 * to the same chronological boundary.
		 *
		 * @param {string} boundary_name Start or end.
		 * @param {Object} coordinate    Replacement pointer or keyboard coordinate.
		 * @return {void}
		 */
		function update_boundary_coordinate( boundary_name, coordinate ) {
			var boundary_uses_anchor = (
				( 'start' === boundary_name && 'anchor' === active_state.start_endpoint )
				|| ( 'end' === boundary_name && 'focus' === active_state.start_endpoint )
			);
			var opposite_coordinate = boundary_uses_anchor ? active_state.focus_coordinate : active_state.anchor_coordinate;
			var coordinate_order = get_coordinate_order( coordinate );
			var opposite_order = get_coordinate_order( opposite_coordinate );

			if (
				null !== coordinate_order
				&& null !== opposite_order
				&& is_boundary_crossing( boundary_name, coordinate_order, opposite_order )
			) {
				coordinate = opposite_coordinate;
			}

			if ( boundary_uses_anchor ) {
				active_state.anchor_coordinate = coordinate;
			} else {
				active_state.focus_coordinate = coordinate;
			}
		}

		/**
		 * Build at most one visual slice for each accepted date in the draft.
		 *
		 * @param {Object} cells          Ordered selected cells.
		 * @param {string} duration_label Exact visual duration or an empty string.
		 * @return {Array<Object>} Bounded template slice models.
		 */
		function build_slices( cells, duration_label ) {
			var snapshot = active_state.snapshot;
			var booking_column_gutter_px = Math.max( 0, Number( active_state.booking_column_gutter_px ) || 0 );
			var start_order = snapshot.date_order[ cells.start.date ];
			var end_order = snapshot.date_order[ cells.end.date ];
			var visible_start = snapshot.visible_range.start_minute;
			var visible_end = snapshot.visible_range.end_minute;
			var slices = [];
			var duration_slice = null;

			snapshot.date_columns.forEach( function ( column ) {
				var order = snapshot.date_order[ column.date ];
				var column_width = column.logical_end - column.logical_start;
				var column_gutter = Math.min( booking_column_gutter_px, Math.max( 0, ( column_width - 2 ) / 2 ) );
				var start_minute;
				var end_minute;

				if ( order < start_order || order > end_order ) {
					return;
				}
				start_minute = column.date === cells.start.date ? cells.start.wall_minute : visible_start;
				end_minute = column.date === cells.end.date ? cells.end.wall_minute + snapshot.selection_step_minutes : visible_end;
				start_minute = Math.max( visible_start, Math.min( visible_end, start_minute ) );
				end_minute = Math.max( start_minute, Math.min( visible_end, end_minute ) );
				slices.push( {
					inline_start_px: Number( ( column.logical_start + column_gutter ).toFixed( 3 ) ),
					inline_size_px: Number( Math.max( 2, column_width - column_gutter * 2 ).toFixed( 3 ) ),
					block_start_px: Number( ( ( start_minute - visible_start ) * snapshot.pixels_per_minute ).toFixed( 3 ) ),
					block_size_px: Number( Math.max( 2, ( end_minute - start_minute ) * snapshot.pixels_per_minute ).toFixed( 3 ) )
				} );
			} );
			if ( duration_label ) {
				duration_slice = slices.reduce( function ( selected_slice, slice ) {
					return ! selected_slice || slice.block_size_px > selected_slice.block_size_px ? slice : selected_slice;
				}, null );
				if ( duration_slice ) {
					duration_slice.duration_label = duration_label;
				}
			}

			return slices;
		}

		/**
		 * Return one boundary's accessible template model.
		 *
		 * @param {Object} cell         Resolved cell.
		 * @param {string} boundary     start or end.
		 * @return {Object} Slider and position model.
		 */
		function build_boundary_model( cell, boundary ) {
			var snapshot = active_state.snapshot;
			var column = snapshot.date_columns[ get_column_index( snapshot, cell.date ) ];
			var is_end = 'end' === boundary;
			var wall_minute = cell.wall_minute + ( is_end ? snapshot.selection_step_minutes : 0 );
			var label = cell.date + ' ' + format_wall_minute( wall_minute );
			var maximum_index = Math.max( 0, Math.ceil( ( snapshot.visible_range.end_minute - snapshot.visible_range.start_minute ) / snapshot.selection_step_minutes ) - 1 );

			return {
				label: interpolate_label( is_end ? i18n.end_control_label : i18n.start_control_label, { time: label } ),
				value_min: 0,
				value_max: maximum_index,
				value_now: cell.snap_index,
				value_text: label,
				inline_px: Number( ( column.logical_start + ( column.logical_end - column.logical_start ) / 2 ).toFixed( 3 ) ),
				block_px: Number( Math.max( 0, Math.min( snapshot.block_extent_px, ( wall_minute - snapshot.visible_range.start_minute ) * snapshot.pixels_per_minute ) ).toFixed( 3 ) )
			};
		}

		/**
		 * Build executable-free choices for every unresolved repeated-hour boundary.
		 *
		 * Candidate instants and offsets come from the accepted server date bands.
		 * The adapter never derives an authoritative offset from the browser timezone.
		 *
		 * @param {Object} cells Chronologically ordered start and end cells.
		 * @return {Array<Object>} Ordered accessible fold-choice template models.
		 */
		function build_fold_choices( cells ) {
			var choices = [];
			var start_endpoint = String( cells && cells.start_endpoint || '' );

			[ 'start', 'end' ].forEach( function ( boundary_name ) {
				var cell = cells && cells[ boundary_name ];
				var endpoint = 'start' === boundary_name
					? start_endpoint
					: ( 'anchor' === start_endpoint ? 'focus' : 'anchor' );
				var boundary_label = 'start' === boundary_name ? i18n.fold_start_boundary : i18n.fold_end_boundary;

				if ( ! cell || 'fold' !== cell.status || ! Array.isArray( cell.candidates ) ) {
					return;
				}
				cell.candidates.forEach( function ( candidate ) {
					var offset_label = format_utc_offset( candidate.offset_minutes );

					if ( ! candidate.occurrence_id || ! offset_label ) {
						return;
					}
					choices.push( {
						endpoint: endpoint,
						occurrence_id: String( candidate.occurrence_id ),
						label: interpolate_label( i18n.fold_choice_label, {
							boundary: boundary_label,
							date: cell.date,
							time: format_wall_minute( cell.wall_minute ),
							offset: offset_label
						} )
					} );
				} );
			} );

			return choices;
		}

		/**
		 * Announce local draft state without invoking a request.
		 *
		 * @param {string} message Accessible message.
		 * @return {void}
		 */
		function announce( message ) {
			var status = active_state && active_state.surface.querySelector( '[data-wpbc-timeline-time-rows-selection-status]' );

			if ( status ) {
				status.textContent = String( message || '' );
			}
		}

		/**
		 * Keep one action popover inside the visible Timeline canvas.
		 *
		 * This is presentation-only geometry. Selection instants continue using the
		 * immutable gesture snapshot and server-axis geometry.
		 *
		 * @param {Element} actions       Rendered action popover.
		 * @param {Object}  state         Active local selection state.
		 * @param {Object}  start_control Start boundary presentation model.
		 * @param {Object}  end_control   End boundary presentation model.
		 * @return {void}
		 */
		function position_actions( actions, state, start_control, end_control ) {
			var canvas = state.panel && state.panel.closest
				? state.panel.closest( canvas_selector )
				: ( mount ? mount.querySelector( canvas_selector ) : null );
			var duration = actions.parentNode ? actions.parentNode.querySelector( '[data-wpbc-timeline-time-rows-selection-duration]' ) : null;
			var surface_rectangle = state.surface.getBoundingClientRect();
			var canvas_rectangle = canvas ? canvas.getBoundingClientRect() : surface_rectangle;
			var anchor_rectangle = duration ? duration.getBoundingClientRect() : null;
			var presentation_slices = Array.isArray( state.presentation_slices ) ? state.presentation_slices : [];
			var viewport_width = window.innerWidth || ( document.documentElement ? document.documentElement.clientWidth : 0 );
			var viewport_height = window.innerHeight || ( document.documentElement ? document.documentElement.clientHeight : 0 );
			var visible_inline_start = Math.max( canvas_rectangle.left, 8 );
			var visible_inline_end = Math.min( canvas_rectangle.right, viewport_width || canvas_rectangle.right ) - 8;
			var visible_block_start = Math.max( surface_rectangle.top, 8 );
			var visible_block_end = Math.min( surface_rectangle.bottom, viewport_height || surface_rectangle.bottom ) - 8;
			var desired_inline_size = 'ready' === state.phase ? ready_actions_inline_size : status_actions_inline_size;
			var available_inline_size = Math.max( 1, visible_inline_end - visible_inline_start );
			var available_block_size = Math.max( 80, visible_block_end - visible_block_start );
			var actions_inline_size = Math.min( desired_inline_size, available_inline_size );
			var actions_block_size;
			var anchor_inline;
			var anchor_block_center;
			var anchor_block_start;
			var anchor_block_end;
			var selection_inline_start;
			var selection_inline_end;
			var selection_inline_left;
			var selection_inline_right;
			var selection_block_start;
			var selection_block_end;
			var inline_start;
			var block_start;
			var available_left;
			var available_right;
			var available_above;
			var available_below;
			var placement;
			var placement_space;
			var placement_block_limit;
			var logical_inline_start;

			actions.style.setProperty( '--wpbc-time-rows-selection-popover-inline-size', Math.floor( actions_inline_size ) + 'px' );
			actions.style.setProperty( '--wpbc-time-rows-selection-popover-min-inline-size', Math.floor( Math.min( minimum_actions_inline_size, available_inline_size ) ) + 'px' );
			actions.style.setProperty( '--wpbc-time-rows-selection-popover-min-block-size', Math.floor( Math.min( minimum_actions_block_size, available_block_size ) ) + 'px' );
			actions.style.removeProperty( '--wpbc-time-rows-selection-popover-max-block-size' );
			actions_block_size = actions.offsetHeight || 190;

			anchor_inline = anchor_rectangle
				? anchor_rectangle.left + anchor_rectangle.width / 2
				: ( 'rtl' === state.snapshot.direction ? surface_rectangle.right - end_control.inline_px : surface_rectangle.left + end_control.inline_px );
			selection_block_start = presentation_slices.reduce( function ( current_start, slice ) {
				return Math.min( current_start, Number( slice.block_start_px ) );
			}, Math.min( start_control.block_px, end_control.block_px ) );
			selection_block_end = presentation_slices.reduce( function ( current_end, slice ) {
				return Math.max( current_end, Number( slice.block_start_px ) + Number( slice.block_size_px ) );
			}, Math.max( start_control.block_px, end_control.block_px ) );
			selection_inline_start = presentation_slices.reduce( function ( current_start, slice ) {
				return Math.min( current_start, Number( slice.inline_start_px ) );
			}, Math.min( start_control.inline_px, end_control.inline_px ) );
			selection_inline_end = presentation_slices.reduce( function ( current_end, slice ) {
				return Math.max( current_end, Number( slice.inline_start_px ) + Number( slice.inline_size_px ) );
			}, Math.max( start_control.inline_px, end_control.inline_px ) );
			selection_inline_left = 'rtl' === state.snapshot.direction
				? surface_rectangle.right - selection_inline_end
				: surface_rectangle.left + selection_inline_start;
			selection_inline_right = 'rtl' === state.snapshot.direction
				? surface_rectangle.right - selection_inline_start
				: surface_rectangle.left + selection_inline_end;
			anchor_block_start = surface_rectangle.top + selection_block_start;
			anchor_block_end = surface_rectangle.top + selection_block_end;
			available_left = Math.max( 0, selection_inline_left - visible_inline_start - actions_separation_pixels );
			available_right = Math.max( 0, visible_inline_end - selection_inline_right - actions_separation_pixels );
			available_above = Math.max( 0, anchor_block_start - visible_block_start - actions_separation_pixels );
			available_below = Math.max( 0, visible_block_end - anchor_block_end - actions_separation_pixels );
			placement = resolve_actions_placement(
				minimum_actions_inline_size,
				actions_block_size,
				available_left,
				available_right,
				available_above,
				available_below,
				state.snapshot.direction
			);

			if ( 'left' === placement || 'right' === placement ) {
				placement_space = 'left' === placement ? available_left : available_right;
				actions_inline_size = Math.min( desired_inline_size, placement_space );
				actions.style.setProperty( '--wpbc-time-rows-selection-popover-inline-size', Math.floor( actions_inline_size ) + 'px' );
				actions_block_size = actions.offsetHeight || 190;
				placement_block_limit = available_block_size;
			} else {
				placement_space = 'above' === placement ? available_above : available_below;
				placement_block_limit = Math.max( 80, Math.min( placement_space, available_block_size ) );
			}

			actions.style.setProperty( '--wpbc-time-rows-selection-popover-min-block-size', Math.floor( Math.min( minimum_actions_block_size, placement_block_limit ) ) + 'px' );
			if ( placement_block_limit < actions_block_size ) {
				actions.style.setProperty( '--wpbc-time-rows-selection-popover-max-block-size', Math.floor( placement_block_limit ) + 'px' );
				actions_block_size = actions.offsetHeight || Math.min( 190, placement_block_limit );
			}

			if ( 'left' === placement || 'right' === placement ) {
				inline_start = resolve_actions_inline_start( placement, selection_inline_left, selection_inline_right, actions_inline_size, actions_separation_pixels );
				anchor_block_center = anchor_rectangle
					? anchor_rectangle.top + anchor_rectangle.height / 2
					: ( anchor_block_start + anchor_block_end ) / 2;
				block_start = Math.max( visible_block_start, Math.min( visible_block_end - actions_block_size, anchor_block_center - actions_block_size / 2 ) );
			} else {
				inline_start = Math.max( visible_inline_start, Math.min( visible_inline_end - actions_inline_size, anchor_inline - actions_inline_size / 2 ) );
				block_start = resolve_actions_block_start( placement, anchor_block_start, anchor_block_end, actions_block_size, actions_separation_pixels );
			}
			logical_inline_start = 'rtl' === state.snapshot.direction
				? surface_rectangle.right - inline_start - actions_inline_size
				: inline_start - surface_rectangle.left;

			actions.setAttribute( 'data-wpbc-timeline-time-rows-selection-placement', placement );
			actions.style.setProperty( '--wpbc-time-rows-selection-popover-inline', logical_inline_start + 'px' );
			actions.style.setProperty( '--wpbc-time-rows-selection-popover-block', block_start - surface_rectangle.top + 'px' );
		}

		/**
		 * Render the authoritative preview/action state inside the retained overlay.
		 *
		 * @param {Element} overlay Current draft overlay.
		 * @return {void}
		 */
		function render_actions( overlay ) {
			var state = active_state;
			var actions_template = get_template( 'actions' );
			var holder;
			var actions;
			var start_control;
			var end_control;

			if (
				! state
				|| ! overlay
				|| ! actions_template
				|| [ 'previewing', 'ready', 'error', 'applying', 'awaiting_readback' ].indexOf( state.phase ) === -1
			) {
				return;
			}
			start_control = build_boundary_model( state.cells.start, 'start' );
			end_control = build_boundary_model( state.cells.end, 'end' );
			holder = document.createElement( 'div' );
			holder.innerHTML = actions_template( {
				state: state.phase,
				preview: state.preview,
				error_message: state.error_message,
				i18n: i18n
			} );
			actions = holder.firstElementChild;
			if ( ! actions ) {
				return;
			}
			overlay.appendChild( actions );
			position_actions( actions, state, start_control, end_control );
		}

		/**
		 * Render one bounded overlay through the fixed WordPress template.
		 *
		 * @return {void}
		 */
		function render_draft() {
			var state = active_state;
			var draft_template = get_template( 'draft' );
			var draft;
			var cells;
			var holder;
			var overlay;
			var start_label;
			var end_label;
			var duration_label;
			var start_endpoint_label;
			var end_endpoint_label;
			var status_message;
			var presentation_slices;
			var start_control;
			var end_control;

			pending_frame = 0;
			if ( ! state || ! state.surface.isConnected || ! draft_template ) {
				return;
			}
			draft = geometry.resolve_draft( state.snapshot, state.anchor_coordinate, state.focus_coordinate );
			cells = get_draft_cells( draft );
			if ( ! draft || ! cells || 'invalid' === draft.status ) {
				return;
			}
			start_label = cells.start.date + ' ' + format_wall_minute( cells.start.wall_minute );
			end_label = cells.end.date + ' ' + format_wall_minute( cells.end.wall_minute + state.snapshot.selection_step_minutes );
			duration_label = 'exact' === draft.status ? format_duration( draft.duration_minutes ) : '';
			start_endpoint_label = duration_label
				? interpolate_label( i18n.draft_start_summary, { start: format_visible_endpoint( draft.start ) } )
				: '';
			end_endpoint_label = duration_label
				? interpolate_label( i18n.draft_end_summary, { end: format_visible_endpoint( draft.end ) } )
				: '';
			status_message = 'gap' === draft.status ? i18n.dst_gap : ( 'fold' === draft.status ? i18n.dst_fold : i18n.draft_ready );
			if ( 'previewing' === state.phase ) {
				status_message = i18n.checking_selection;
			} else if ( 'ready' === state.phase ) {
				status_message = i18n.preview_ready;
			} else if ( 'applying' === state.phase ) {
				status_message = i18n.applying_availability;
			} else if ( 'awaiting_readback' === state.phase ) {
				status_message = i18n.awaiting_readback;
			} else if ( 'error' === state.phase ) {
				status_message = state.error_message || i18n.preview_error;
			}

			state.surface.querySelectorAll( overlay_selector ).forEach( function ( existing_overlay ) {
				existing_overlay.remove();
			} );
			start_control = build_boundary_model( cells.start, 'start' );
			end_control = build_boundary_model( cells.end, 'end' );
			presentation_slices = build_slices( cells, duration_label );
			holder = document.createElement( 'div' );
			holder.innerHTML = draft_template( {
				status: draft.status,
				phase: state.phase,
				draft_identity: String( draft.draft_identity || '' ),
				resource_id: state.resource_id,
				label: interpolate_label( duration_label ? i18n.draft_label_with_duration : i18n.draft_label, {
					start: start_label,
					end: end_label,
					duration: duration_label
				} ),
				status_id: state.status_id,
				active_boundary: state.pointer_boundary,
				slices: presentation_slices,
				start_endpoint_label: start_endpoint_label,
				end_endpoint_label: end_endpoint_label,
				start_control: start_control,
				end_control: end_control,
				fold_choices: build_fold_choices( cells ),
				fold_group_label: i18n.fold_group_label,
				fold_instructions: i18n.fold_instructions
			} );
			overlay = holder.firstElementChild;
			if ( ! overlay ) {
				return;
			}
			state.surface.appendChild( overlay );
			state.draft = draft;
			state.cells = cells;
			state.start_endpoint = cells.start_endpoint;
			state.presentation_slices = presentation_slices;
			render_actions( overlay );
			if ( state.focus_actions_after_render ) {
				state.focus_actions_after_render = false;
				window.requestAnimationFrame( function () {
					var first_action = state.surface.querySelector( actions_selector + ' a[href], ' + actions_selector + ' button:not([disabled])' );

					if ( first_action ) {
						first_action.focus();
					}
				} );
			}
			announce( status_message );
			if ( state.focus_boundary ) {
				window.requestAnimationFrame( function () {
					var boundary = state.surface.querySelector( boundary_selector + '[data-wpbc-timeline-time-rows-selection-boundary="' + state.focus_boundary + '"]' );

					state.focus_boundary = '';
					if ( boundary ) {
						boundary.focus();
					}
				} );
			}
			if ( state.commit_after_render && 'exact' === draft.status ) {
				state.commit_after_render = false;
				window.requestAnimationFrame( request_selection_preview );
			}
		}

		/**
		 * Coalesce visual-only draft updates into one animation frame.
		 *
		 * @param {Object|null} focus_coordinate Optional replacement focus coordinate.
		 * @return {void}
		 */
		function schedule_render( focus_coordinate ) {
			if ( focus_coordinate ) {
				pending_focus_coordinate = focus_coordinate;
			}
			if ( pending_frame ) {
				return;
			}
			pending_frame = window.requestAnimationFrame( function () {
				if ( active_state && pending_focus_coordinate ) {
					active_state.focus_coordinate = pending_focus_coordinate;
				}
				pending_focus_coordinate = null;
				render_draft();
			} );
		}

		/**
		 * Abort only the adapter-owned preview or mutation request.
		 *
		 * Canonical Timeline readback remains page-controller owned and is never
		 * cancelled by closing this local presentation.
		 *
		 * @return {void}
		 */
		function abort_selection_request() {
			if ( selection_request && 'function' === typeof selection_request.abort ) {
				selection_request.abort();
			}
			selection_request = null;
			selection_request_generation += 1;
		}

		/**
		 * Remove the draft and optionally restore its captured focus origin.
		 *
		 * @param {boolean} restore_focus Whether focus should return to its origin.
		 * @param {boolean} announce_cancel Whether to announce cancellation first.
		 * @return {void}
		 */
		function cancel_draft( restore_focus, announce_cancel ) {
			var state = active_state;
			var focus_origin = state && state.focus_origin;
			var resource_id = state && state.resource_id;

			if ( pending_frame ) {
				window.cancelAnimationFrame( pending_frame );
				pending_frame = 0;
			}
			pending_focus_coordinate = null;
			pending_touch = null;
			abort_selection_request();
			if ( state && announce_cancel ) {
				announce( i18n.cancelled );
			}
			if ( state && state.surface ) {
				state.surface.querySelectorAll( overlay_selector ).forEach( function ( overlay ) {
					overlay.remove();
				} );
			}
			active_state = null;
			if ( restore_focus && focus_origin && focus_origin.isConnected && 'function' === typeof focus_origin.focus ) {
				focus_origin.focus();
			} else if ( restore_focus && resource_id ) {
				window.requestAnimationFrame( function () {
					var replacement_surface;

					if ( is_initialized ) {
						enhance_surfaces();
					}
					replacement_surface = find_current_surface( resource_id );
					if ( replacement_surface && 'function' === typeof replacement_surface.focus ) {
						replacement_surface.focus();
					}
				} );
			}
		}

		/**
		 * Consume a ready timed selection only when its signed action token matches.
		 *
		 * The token is compared as an opaque scalar from the current server-owned
		 * action URL. Unrelated timed drafts survive toolbar and other-surface
		 * creation readbacks.
		 *
		 * @param {string} action_id Stable preview action identifier.
		 * @param {string} query_arg Signed-token query argument name.
		 * @param {string} token     Opaque signed token consumed by creation.
		 * @return {boolean} True when the current timed draft matched and was cleared.
		 */
		function consume_signed_action_context( action_id, query_arg, token ) {
			var action = active_state && active_state.preview && active_state.preview.actions
				? active_state.preview.actions[ action_id ]
				: null;
			var action_url;

			if (
				! active_state
				|| 'ready' !== active_state.phase
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
			cancel_draft( false, false );

			return true;
		}

		/**
		 * Return fresh Timeline-owned request, coverage, and return context.
		 *
		 * @return {Object|null} Bounded request context or null.
		 */
		function get_selection_request_context() {
			if ( 'function' !== typeof selection_api.get_request_context ) {
				return null;
			}

			return selection_api.get_request_context();
		}

		/**
		 * Request one authoritative preview for the current exact half-open draft.
		 *
		 * The server owns the selection step, signed loaded-window coverage,
		 * Resource authorization, fresh domain reads, and enabled actions. A changed
		 * draft/cache identity invalidates the response before it can render.
		 *
		 * @return {void}
		 */
		function request_selection_preview() {
			var state = active_state;
			var request_context = get_selection_request_context();
			var transport = request_context && request_context.transport ? request_context.transport : {};
			var draft_identity;
			var cache_key;
			var generation;

			if (
				! state
				|| ! state.draft
				|| 'exact' !== state.draft.status
				|| ! window.jQuery
				|| ! request_context
				|| ! transport.url
				|| ! transport.preview_action
				|| ! transport.preview_nonce
				|| [ 'applying', 'awaiting_readback' ].indexOf( state.phase ) !== -1
			) {
				return;
			}
			abort_selection_request();
			generation = selection_request_generation;
			draft_identity = String( state.draft.draft_identity || '' );
			cache_key = state.cache_key;
			state.phase = 'previewing';
			state.preview = null;
			state.error_message = '';
			render_draft();
			announce( i18n.checking_selection );
			selection_request = window.jQuery.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				timeout: Math.max( 1000, Number( request_context.request_timeout_ms ) || 15000 ),
				data: {
					action: transport.preview_action,
					nonce: transport.preview_nonce,
					resource_id: state.resource_id,
					selection_surface: String( configuration.selection_surface || 'time_rows' ),
					selection_kind: String( state.draft.selection_kind || configuration.selection_kind || 'timed' ),
					view: String( request_context.view || '' ),
					start_at: state.draft.start.at,
					end_at: state.draft.end.at,
					loaded_start_at: String( request_context.loaded_start_at || '' ),
					loaded_end_at: String( request_context.loaded_end_at || '' ),
					loaded_context_tokens: Array.isArray( request_context.loaded_context_tokens ) ? request_context.loaded_context_tokens.slice( 0, 3 ) : [],
					return_context: request_context.return_context && 'object' === typeof request_context.return_context ? request_context.return_context : {}
				}
			} ).done( function ( response ) {
				if (
					generation !== selection_request_generation
					|| ! active_state
					|| cache_key !== active_state.cache_key
					|| ! active_state.draft
					|| draft_identity !== String( active_state.draft.draft_identity || '' )
				) {
					return;
				}
				if (
					! response
					|| ! response.success
					|| ! response.data
					|| ! response.data.selection
					|| String( response.data.selection.selection_surface || '' ) !== String( configuration.selection_surface || 'time_rows' )
				) {
					active_state.phase = 'error';
					active_state.error_message = i18n.preview_error;
					return;
				}
				active_state.preview = response.data;
				active_state.phase = 'ready';
				active_state.focus_actions_after_render = true;
				announce( i18n.preview_ready );
			} ).fail( function ( request, request_status ) {
				var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};

				if ( generation !== selection_request_generation || 'abort' === request_status || ! active_state ) {
					return;
				}
				active_state.phase = 'error';
				active_state.error_message = error.message || i18n.preview_error;
			} ).always( function () {
				if ( generation !== selection_request_generation ) {
					return;
				}
				selection_request = null;
				render_draft();
			} );
		}

		/**
		 * Apply one explicitly activated server-authorized Availability action.
		 *
		 * @param {string} mode Block or unblock.
		 * @return {void}
		 */
		function apply_selection_availability( mode ) {
			var state = active_state;
			var action = state && state.preview && state.preview.actions ? state.preview.actions[ mode ] : null;
			var request_context = get_selection_request_context();
			var transport = request_context && request_context.transport ? request_context.transport : {};
			var generation;
			var draft_identity;

			if (
				[ 'block', 'unblock' ].indexOf( mode ) === -1
				|| ! state
				|| 'ready' !== state.phase
				|| ! action
				|| true !== action.authorized
				|| true !== action.enabled
				|| ! state.preview.block_token
				|| ! window.jQuery
				|| ! transport.url
				|| ! transport.apply_action
				|| ! transport.apply_nonce
			) {
				return;
			}
			selection_request_generation += 1;
			generation = selection_request_generation;
			draft_identity = String( state.draft.draft_identity || '' );
			state.phase = 'applying';
			state.error_message = '';
			render_draft();
			announce( i18n.applying_availability );
			selection_request = window.jQuery.ajax( {
				url: transport.url,
				method: 'POST',
				dataType: 'json',
				timeout: Math.max( 1000, Number( request_context.request_timeout_ms ) || 15000 ),
				data: {
					action: transport.apply_action,
					nonce: transport.apply_nonce,
					block_token: state.preview.block_token,
					mode: mode
				}
			} ).done( function ( response ) {
				var readback_request;

				if ( generation !== selection_request_generation || ! active_state || draft_identity !== String( active_state.draft.draft_identity || '' ) ) {
					return;
				}
				if ( ! response || ! response.success ) {
					active_state.phase = 'error';
					active_state.error_message = response && response.data && response.data.message ? response.data.message : i18n.apply_error;
					return;
				}
				selection_request = null;
				active_state.phase = 'awaiting_readback';
				render_draft();
				announce( i18n.awaiting_readback );
				readback_request = 'function' === typeof selection_api.refresh_after_apply
					? selection_api.refresh_after_apply()
					: null;
				if ( ! readback_request || 'function' !== typeof readback_request.done || 'function' !== typeof readback_request.fail ) {
					active_state.phase = 'error';
					active_state.error_message = i18n.apply_error;
					render_draft();
					return;
				}
				readback_request.done( function () {
					if ( active_state && 'awaiting_readback' === active_state.phase && draft_identity === String( active_state.draft.draft_identity || '' ) ) {
						cancel_draft( true, false );
					}
				} ).fail( function () {
					if ( active_state && 'awaiting_readback' === active_state.phase && draft_identity === String( active_state.draft.draft_identity || '' ) ) {
						active_state.phase = 'error';
						active_state.error_message = i18n.apply_error;
						render_draft();
					}
				} );
			} ).fail( function ( request, request_status ) {
				var error = request.responseJSON && request.responseJSON.data ? request.responseJSON.data : {};

				if ( generation !== selection_request_generation || 'abort' === request_status || ! active_state ) {
					return;
				}
				active_state.phase = 'error';
				active_state.error_message = error.message || i18n.apply_error;
			} ).always( function () {
				if ( generation === selection_request_generation && active_state && 'awaiting_readback' !== active_state.phase ) {
					selection_request = null;
					render_draft();
				}
			} );
		}

		/**
		 * Begin one local draft with a gesture-owned geometry snapshot.
		 *
		 * @param {Object} gesture_context Immutable gesture context.
		 * @param {Object} coordinate      Initial geometry coordinate.
		 * @param {Element} focus_origin   Focus restoration target.
		 * @return {boolean} True when a resolvable draft began.
		 */
		function begin_draft( gesture_context, coordinate, focus_origin ) {
			var resolved = geometry.resolve_coordinate( gesture_context.snapshot, coordinate );

			if ( ! resolved || [ 'invalid', 'outside', 'gap' ].indexOf( resolved.status ) !== -1 ) {
				return false;
			}
			cancel_draft( false, false );
			active_state = {
				surface: gesture_context.surface,
				panel: gesture_context.panel,
				resource_id: gesture_context.resource_id,
				cache_key: gesture_context.cache_key,
				surface_rect: gesture_context.surface_rect,
				booking_column_gutter_px: gesture_context.booking_column_gutter_px,
				snapshot: gesture_context.snapshot,
				anchor_coordinate: coordinate,
				focus_coordinate: coordinate,
				focus_origin: focus_origin || gesture_context.surface,
				restore_focus_on_cancel: gesture_context.surface.contains( document.activeElement ),
				pointer_id: null,
				pointer_type: '',
				pointer_boundary: '',
				boundary_drag_origin: null,
				touch_origin: null,
				status_id: 'wpbc-time-rows-selection-status-' + gesture_context.resource_id,
				focus_boundary: '',
				focus_actions_after_render: false,
				commit_after_render: false,
				phase: 'drafting',
				preview: null,
				error_message: '',
				draft: null,
				cells: null
			};
			schedule_render( coordinate );

			return true;
		}

		/**
		 * Begin editing an existing draft through one visible boundary control.
		 *
		 * Existing preview authority is discarded immediately because any boundary
		 * movement creates a new exact interval that requires a fresh explicit
		 * commit. Pointer capture stays on the persistent timed surface because the
		 * overlay and its controls are replaced during frame-coalesced rendering.
		 *
		 * @param {Element}      boundary Boundary slider control.
		 * @param {PointerEvent} event    Primary pointer event.
		 * @return {boolean} True when boundary editing started.
		 */
		function begin_boundary_drag( boundary, event ) {
			var boundary_name;

			if (
				! active_state
				|| ! boundary
				|| ! active_state.surface.contains( boundary )
				|| [ 'applying', 'awaiting_readback' ].indexOf( active_state.phase ) !== -1
				|| ( 'mouse' === event.pointerType && 0 !== event.button )
			) {
				return false;
			}
			boundary_name = String( boundary.getAttribute( 'data-wpbc-timeline-time-rows-selection-boundary' ) || '' );
			if ( [ 'start', 'end' ].indexOf( boundary_name ) === -1 ) {
				return false;
			}
			active_state.surface_rect = active_state.surface.getBoundingClientRect();
			active_state.boundary_drag_origin = {
				anchor_coordinate: active_state.anchor_coordinate,
				focus_coordinate: active_state.focus_coordinate,
				phase: active_state.phase,
				preview: active_state.preview,
				error_message: active_state.error_message
			};
			abort_selection_request();
			active_state.pointer_id = event.pointerId;
			active_state.pointer_type = event.pointerType || 'mouse';
			active_state.pointer_boundary = boundary_name;
			active_state.phase = 'draft';
			active_state.preview = null;
			active_state.error_message = '';
			active_state.commit_after_render = false;
			active_state.surface.setPointerCapture( event.pointerId );
			schedule_render();
			event.preventDefault();

			return true;
		}

		/**
		 * Restore a cancelled boundary drag without discarding the whole selection.
		 *
		 * @param {PointerEvent} event Cancelled pointer event.
		 * @return {void}
		 */
		function restore_boundary_drag( event ) {
			var origin = active_state && active_state.boundary_drag_origin;

			if ( ! active_state || ! origin ) {
				return;
			}
			active_state.anchor_coordinate = origin.anchor_coordinate;
			active_state.focus_coordinate = origin.focus_coordinate;
			active_state.phase = 'previewing' === origin.phase ? 'draft' : origin.phase;
			active_state.preview = 'previewing' === origin.phase ? null : origin.preview;
			active_state.error_message = 'previewing' === origin.phase ? '' : origin.error_message;
			active_state.pointer_id = null;
			active_state.pointer_type = '';
			active_state.pointer_boundary = '';
			active_state.boundary_drag_origin = null;
			if ( active_state.surface.hasPointerCapture( event.pointerId ) ) {
				active_state.surface.releasePointerCapture( event.pointerId );
			}
			schedule_render();
		}

		/**
		 * Reject non-empty or reserved interaction targets.
		 *
		 * @param {Element} target Event target.
		 * @param {Element} surface Candidate timed surface.
		 * @return {boolean} True only for an eligible empty timed location.
		 */
		function is_empty_surface_target( target, surface ) {
			return Boolean( target && surface && surface.contains( target ) && ! target.closest( excluded_selector ) );
		}

		/**
		 * Start mouse/pen dragging or a scroll-safe touch tap candidate.
		 *
		 * @param {PointerEvent} event Pointer down event.
		 * @return {void}
		 */
		function handle_pointer_down( event ) {
			var boundary = event.target && event.target.closest ? event.target.closest( boundary_selector ) : null;
			var surface = event.target && event.target.closest ? event.target.closest( surface_selector ) : null;
			var gesture_context;
			var coordinate;

			if ( boundary && begin_boundary_drag( boundary, event ) ) {
				return;
			}
			if ( ! surface || ! mount.contains( surface ) || ! is_empty_surface_target( event.target, surface ) || ( 'mouse' === event.pointerType && 0 !== event.button ) ) {
				return;
			}
			gesture_context = prepare_gesture_context( surface );
			if ( ! gesture_context ) {
				return;
			}
			coordinate = pointer_coordinate( gesture_context, event );
			if ( 'touch' === event.pointerType ) {
				pending_touch = {
					surface: surface,
					panel: gesture_context.panel,
					resource_id: gesture_context.resource_id,
					cache_key: gesture_context.cache_key,
					surface_rect: gesture_context.surface_rect,
					snapshot: gesture_context.snapshot,
					pointer_id: event.pointerId,
					coordinate: coordinate,
					origin: { x: event.clientX, y: event.clientY }
				};
				return;
			}
			if ( begin_draft( gesture_context, coordinate, surface ) ) {
				active_state.pointer_id = event.pointerId;
				active_state.pointer_type = event.pointerType || 'mouse';
				surface.setPointerCapture( event.pointerId );
				event.preventDefault();
			}
		}

		/**
		 * Coalesce active mouse/pen drag updates; touch remains native scrolling.
		 *
		 * @param {PointerEvent} event Pointer move event.
		 * @return {void}
		 */
		function handle_pointer_move( event ) {
			if ( ! active_state || active_state.pointer_id !== event.pointerId ) {
				return;
			}
			if ( active_state.pointer_boundary ) {
				update_boundary_coordinate(
					active_state.pointer_boundary,
					pointer_boundary_coordinate( active_state.pointer_boundary, event )
				);
				schedule_render();
				event.preventDefault();
				return;
			}
			if ( 'touch' === active_state.pointer_type ) {
				return;
			}
			schedule_render( pointer_coordinate( {
				surface_rect: active_state.surface_rect
			}, event ) );
			event.preventDefault();
		}

		/**
		 * Complete a pointer draft or promote a stationary touch to one tap draft.
		 *
		 * @param {PointerEvent} event Pointer up event.
		 * @return {void}
		 */
		function handle_pointer_up( event ) {
			var movement;
			var coordinate;

			if ( pending_touch && pending_touch.pointer_id === event.pointerId ) {
				movement = Math.hypot( event.clientX - pending_touch.origin.x, event.clientY - pending_touch.origin.y );
				if ( movement > touch_tolerance_pixels ) {
					pending_touch = null;
					return;
				}
				if ( begin_draft( pending_touch, pending_touch.coordinate, pending_touch.surface ) ) {
					active_state.phase = 'draft';
					active_state.commit_after_render = true;
				}
				pending_touch = null;
				return;
			}
			if ( ! active_state || active_state.pointer_id !== event.pointerId ) {
				return;
			}
			if ( active_state.pointer_boundary ) {
				update_boundary_coordinate(
					active_state.pointer_boundary,
					pointer_boundary_coordinate( active_state.pointer_boundary, event )
				);
				active_state.pointer_id = null;
				active_state.pointer_type = '';
				active_state.pointer_boundary = '';
				active_state.boundary_drag_origin = null;
				active_state.phase = 'draft';
				active_state.preview = null;
				active_state.error_message = '';
				active_state.commit_after_render = true;
				schedule_render();
				if ( active_state.surface.hasPointerCapture( event.pointerId ) ) {
					active_state.surface.releasePointerCapture( event.pointerId );
				}
				event.preventDefault();
				return;
			}
			coordinate = pointer_coordinate( {
				surface_rect: active_state.surface_rect
			}, event );
			active_state.pointer_id = null;
			active_state.pointer_type = '';
			active_state.phase = 'draft';
			active_state.commit_after_render = true;
			schedule_render( coordinate );
			if ( active_state.surface.hasPointerCapture( event.pointerId ) ) {
				active_state.surface.releasePointerCapture( event.pointerId );
			}
			event.preventDefault();
		}

		/**
		 * Abandon only an unfinished pointer gesture.
		 *
		 * @param {PointerEvent} event Pointer cancellation event.
		 * @return {void}
		 */
		function handle_pointer_cancel( event ) {
			if ( pending_touch && pending_touch.pointer_id === event.pointerId ) {
				pending_touch = null;
				return;
			}
			if ( active_state && active_state.pointer_id === event.pointerId ) {
				if ( active_state.pointer_boundary ) {
					restore_boundary_drag( event );
					return;
				}
				cancel_draft( false, false );
			}
		}

		/**
		 * Move one keyboard coordinate by a physical arrow or boundary command.
		 *
		 * @param {Object} coordinate Current coordinate.
		 * @param {string} key        Keyboard key.
		 * @return {Object} Bounded replacement coordinate.
		 */
		function move_keyboard_coordinate( coordinate, key ) {
			var snapshot = active_state.snapshot;
			var date_index = get_column_index( snapshot, coordinate.date );
			var snap_index = coordinate.snap_index;
			var maximum_index = Math.max( 0, Math.ceil( ( snapshot.visible_range.end_minute - snapshot.visible_range.start_minute ) / snapshot.selection_step_minutes ) - 1 );
			var date_delta = 0;

			if ( 'ArrowUp' === key ) {
				snap_index -= 1;
			} else if ( 'ArrowDown' === key ) {
				snap_index += 1;
			} else if ( 'Home' === key ) {
				snap_index = 0;
			} else if ( 'End' === key ) {
				snap_index = maximum_index;
			} else if ( 'ArrowLeft' === key ) {
				date_delta = 'rtl' === snapshot.direction ? 1 : -1;
			} else if ( 'ArrowRight' === key ) {
				date_delta = 'rtl' === snapshot.direction ? -1 : 1;
			}
			date_index = Math.max( 0, Math.min( snapshot.date_columns.length - 1, date_index + date_delta ) );

			return keyboard_coordinate( snapshot, snapshot.date_columns[ date_index ].date, snap_index );
		}

		/**
		 * Start a keyboard draft or update the focused accessible boundary.
		 *
		 * @param {KeyboardEvent} event Keyboard event.
		 * @return {void}
		 */
		function handle_key_down( event ) {
			var boundary = event.target && event.target.closest ? event.target.closest( boundary_selector ) : null;
			var surface = event.target && event.target.closest ? event.target.closest( surface_selector ) : null;
			var gesture_context;
			var coordinate;
			var boundary_name;

			if ( 'Escape' === event.key && active_state ) {
				event.preventDefault();
				if ( [ 'applying', 'awaiting_readback' ].indexOf( active_state.phase ) !== -1 ) {
					return;
				}
				cancel_draft( true, true );
				return;
			}
			if ( boundary && active_state ) {
				if ( [ 'applying', 'awaiting_readback' ].indexOf( active_state.phase ) !== -1 ) {
					event.preventDefault();
					return;
				}
				if ( 'Enter' === event.key ) {
					event.preventDefault();
					request_selection_preview();
					return;
				}
				if ( [ 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End' ].indexOf( event.key ) === -1 ) {
					return;
				}
				boundary_name = String( boundary.getAttribute( 'data-wpbc-timeline-time-rows-selection-boundary' ) || '' );
				coordinate = (
					( 'start' === boundary_name && 'anchor' === active_state.start_endpoint )
					|| ( 'end' === boundary_name && 'focus' === active_state.start_endpoint )
				) ? active_state.anchor_coordinate : active_state.focus_coordinate;
				coordinate = move_keyboard_coordinate( coordinate, event.key );
				update_boundary_coordinate( boundary_name, coordinate );
				active_state.focus_boundary = boundary_name;
				abort_selection_request();
				active_state.phase = 'draft';
				active_state.preview = null;
				active_state.error_message = '';
				schedule_render();
				event.preventDefault();
				return;
			}
			if ( ! surface || event.target !== surface || ( 'Enter' !== event.key && ' ' !== event.key ) ) {
				return;
			}
			gesture_context = prepare_gesture_context( surface );
			if ( ! gesture_context || ! gesture_context.snapshot.date_columns.length ) {
				return;
			}
			coordinate = keyboard_coordinate( gesture_context.snapshot, gesture_context.snapshot.date_columns[ 0 ].date, 0 );
			if ( begin_draft( gesture_context, coordinate, surface ) ) {
				active_state.focus_boundary = 'end';
				active_state.phase = 'draft';
				event.preventDefault();
			}
		}

		/**
		 * Handle explicit cancel, retry, Block, and Unblock activations.
		 *
		 * New Booking remains an ordinary server-signed link.
		 *
		 * @param {MouseEvent} event Delegated click event.
		 * @return {void}
		 */
		function handle_action_click( event ) {
			var cancel_control = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-time-rows-selection-cancel]' ) : null;
			var retry_control = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-time-rows-selection-retry]' ) : null;
			var availability_control = event.target && event.target.closest ? event.target.closest( '[data-wpbc-timeline-time-rows-selection-availability]' ) : null;
			var fold_control = event.target && event.target.closest ? event.target.closest( fold_choice_selector ) : null;
			var endpoint;
			var occurrence_id;
			var coordinate_key;

			if ( fold_control && mount.contains( fold_control ) && active_state ) {
				endpoint = String( fold_control.getAttribute( 'data-wpbc-timeline-time-rows-selection-fold-endpoint' ) || '' );
				occurrence_id = String( fold_control.getAttribute( 'data-wpbc-timeline-time-rows-selection-fold-choice' ) || '' );
				coordinate_key = 'anchor' === endpoint ? 'anchor_coordinate' : ( 'focus' === endpoint ? 'focus_coordinate' : '' );
				if ( coordinate_key && occurrence_id && active_state[ coordinate_key ] ) {
					event.preventDefault();
					active_state[ coordinate_key ] = Object.assign( {}, active_state[ coordinate_key ], {
						occurrence_id: occurrence_id
					} );
					active_state.phase = 'draft';
					active_state.preview = null;
					active_state.error_message = '';
					schedule_render();
				}
				return;
			}

			if ( cancel_control && mount.contains( cancel_control ) ) {
				event.preventDefault();
				if ( active_state && [ 'applying', 'awaiting_readback' ].indexOf( active_state.phase ) === -1 ) {
					cancel_draft( true, true );
				}
				return;
			}
			if ( retry_control && mount.contains( retry_control ) ) {
				event.preventDefault();
				request_selection_preview();
				return;
			}
			if ( availability_control && mount.contains( availability_control ) ) {
				event.preventDefault();
				apply_selection_availability( String( availability_control.getAttribute( 'data-wpbc-timeline-time-rows-selection-availability' ) || '' ) );
			}
		}

		/**
		 * Remember when keyboard focus is owned by the current draft surface.
		 *
		 * @param {FocusEvent} event Delegated focus event.
		 * @return {void}
		 */
		function handle_focus_in( event ) {
			if ( active_state ) {
				active_state.restore_focus_on_cancel = active_state.surface.contains( event.target );
			}
		}

		/**
		 * Stop automatic restoration after the user deliberately leaves a draft.
		 *
		 * DOM replacement may disconnect the surface before focusout; retaining the
		 * flag in that case permits restoration to the replacement surface.
		 *
		 * @param {FocusEvent} event Delegated focus event.
		 * @return {void}
		 */
		function handle_focus_out( event ) {
			if (
				active_state
				&& active_state.surface.isConnected
				&& active_state.surface.contains( event.target )
				&& ( ! event.relatedTarget || ! active_state.surface.contains( event.relatedTarget ) )
			) {
				active_state.restore_focus_on_cancel = false;
			}
		}

		/**
		 * Add keyboard semantics and an allow-listed status template to new surfaces.
		 *
		 * @return {void}
		 */
		function enhance_surfaces() {
			var status_template = get_template( 'status' );

			if ( ! mount || ! status_template ) {
				return;
			}
			mount.querySelectorAll( surface_selector ).forEach( function ( surface ) {
				var identity;
				var record;
				var holder;

				if ( 'true' === surface.getAttribute( 'data-wpbc-timeline-time-rows-selection-ready' ) ) {
					return;
				}
				identity = get_surface_identity( surface );
				if ( ! identity ) {
					return;
				}
				record = {
					surface: surface,
					tabindex: surface.getAttribute( 'tabindex' ),
					aria_label: surface.getAttribute( 'aria-label' ),
					aria_description: surface.getAttribute( 'aria-description' )
				};
				surface.setAttribute( 'data-wpbc-timeline-time-rows-selection-ready', 'true' );
				surface.setAttribute( 'tabindex', '0' );
				surface.setAttribute( 'aria-label', String( i18n.surface_label || '' ) );
				surface.setAttribute( 'aria-description', String( i18n.instructions || '' ) );
				holder = document.createElement( 'div' );
				holder.innerHTML = status_template( {
					status_id: 'wpbc-time-rows-selection-status-' + identity.resource_id,
					message: ''
				} );
				if ( holder.firstElementChild ) {
					surface.appendChild( holder.firstElementChild );
				}
				enhanced_surfaces.push( record );
			} );
		}

		/**
		 * Cancel drafts whenever accepted data or rendered identity changes.
		 *
		 * @param {CustomEvent} event Lifecycle event.
		 * @return {void}
		 */
		function handle_identity_change( event ) {
			var detail = event && event.detail || {};
			var is_global_identity_change = 'wpbc:timeline:data:booking-windows-accepted' === event.type
				|| 'wpbc:timeline:data:availability-accepted' === event.type;
			var is_readback_state = 'wpbc:timeline:data:authoritative-readback-state' === event.type;

			if (
				is_readback_state
				&& 'booking_creation' === String( detail.reason || '' )
				&& 'loading' === String( detail.state || '' )
			) {
				preserve_draft_during_booking_creation_readback = true;
				return;
			}
			if (
				preserve_draft_during_booking_creation_readback
				&& ( 'wpbc:timeline:data:booking-windows-accepted' === event.type || 'wpbc:timeline:data:availability-accepted' === event.type )
			) {
				window.requestAnimationFrame( enhance_surfaces );
				return;
			}
			if (
				is_readback_state
				&& 'booking_creation' === String( detail.reason || '' )
				&& [ 'accepted', 'failed' ].indexOf( String( detail.state || '' ) ) !== -1
			) {
				preserve_draft_during_booking_creation_readback = false;
				window.requestAnimationFrame( enhance_surfaces );
				return;
			}
			if ( is_readback_state && 'loading' === String( detail.state || '' ) ) {
				return;
			}
			if ( is_readback_state && 'failed' === String( detail.state || '' ) ) {
				if ( active_state && 'awaiting_readback' === active_state.phase ) {
					active_state.phase = 'error';
					active_state.error_message = i18n.apply_error;
					render_draft();
				}
				return;
			}
			is_global_identity_change = is_global_identity_change
				|| ( is_readback_state && 'accepted' === String( detail.state || '' ) );

			if ( pending_touch && ( is_global_identity_change || Number( detail.resource_id ) === pending_touch.resource_id ) ) {
				pending_touch = null;
			}

			if ( active_state && (
				is_global_identity_change
				|| Number( detail.resource_id ) === active_state.resource_id
			) ) {
				cancel_draft( Boolean( active_state.restore_focus_on_cancel ), false );
			}
			window.requestAnimationFrame( enhance_surfaces );
		}

		/**
		 * Initialize delegated local interaction listeners.
		 *
		 * @return {void}
		 */
		function initialize() {
			if ( is_initialized || ! mount || ! geometry || ! Number.isInteger( selection_step_minutes ) || 1 > selection_step_minutes ) {
				return;
			}
			is_initialized = true;
			mount.addEventListener( 'pointerdown', handle_pointer_down );
			mount.addEventListener( 'pointermove', handle_pointer_move );
			mount.addEventListener( 'pointerup', handle_pointer_up );
			mount.addEventListener( 'pointercancel', handle_pointer_cancel );
			mount.addEventListener( 'keydown', handle_key_down );
			mount.addEventListener( 'click', handle_action_click );
			mount.addEventListener( 'focusin', handle_focus_in );
			mount.addEventListener( 'focusout', handle_focus_out );
			mount.addEventListener( 'wpbc:timeline:data:booking-windows-accepted', handle_identity_change );
			mount.addEventListener( 'wpbc:timeline:data:availability-accepted', handle_identity_change );
			mount.addEventListener( 'wpbc:timeline:data:authoritative-readback-state', handle_identity_change );
			mount.addEventListener( 'wpbc:timeline:row-presentation:rendered', handle_identity_change );
			mount.addEventListener( 'wpbc:timeline:row-presentation:closed', handle_identity_change );
			mount.addEventListener( 'wpbc:timeline:row-presentation:removed', handle_identity_change );
			enhance_surfaces();
		}

		/**
		 * Destroy local state and restore attributes added by this adapter.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! is_initialized || ! mount ) {
				return;
			}
			mount.removeEventListener( 'pointerdown', handle_pointer_down );
			mount.removeEventListener( 'pointermove', handle_pointer_move );
			mount.removeEventListener( 'pointerup', handle_pointer_up );
			mount.removeEventListener( 'pointercancel', handle_pointer_cancel );
			mount.removeEventListener( 'keydown', handle_key_down );
			mount.removeEventListener( 'click', handle_action_click );
			mount.removeEventListener( 'focusin', handle_focus_in );
			mount.removeEventListener( 'focusout', handle_focus_out );
			mount.removeEventListener( 'wpbc:timeline:data:booking-windows-accepted', handle_identity_change );
			mount.removeEventListener( 'wpbc:timeline:data:availability-accepted', handle_identity_change );
			mount.removeEventListener( 'wpbc:timeline:data:authoritative-readback-state', handle_identity_change );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:rendered', handle_identity_change );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:closed', handle_identity_change );
			mount.removeEventListener( 'wpbc:timeline:row-presentation:removed', handle_identity_change );
			cancel_draft( false, false );
			pending_touch = null;
			enhanced_surfaces.forEach( function ( record ) {
				var surface = record.surface;

				if ( ! surface || ! surface.isConnected ) {
					return;
				}
				surface.removeAttribute( 'data-wpbc-timeline-time-rows-selection-ready' );
				[ [ 'tabindex', record.tabindex ], [ 'aria-label', record.aria_label ], [ 'aria-description', record.aria_description ] ].forEach( function ( attribute ) {
					if ( null === attribute[ 1 ] ) {
						surface.removeAttribute( attribute[ 0 ] );
					} else {
						surface.setAttribute( attribute[ 0 ], attribute[ 1 ] );
					}
				} );
				surface.querySelectorAll( '[data-wpbc-timeline-time-rows-selection-status]' ).forEach( function ( status ) {
					status.remove();
				} );
			} );
			enhanced_surfaces = [];
			preserve_draft_during_booking_creation_readback = false;
			is_initialized = false;
		}

		/**
		 * Return bounded scalar state for development assertions.
		 *
		 * @return {Object} Draft lifecycle snapshot.
		 */
		function get_state_snapshot() {
			return {
				is_initialized: is_initialized,
				has_draft: Boolean( active_state && active_state.draft ),
				resource_id: active_state ? active_state.resource_id : 0,
				cache_key: active_state ? active_state.cache_key : '',
				draft_identity: active_state && active_state.draft ? String( active_state.draft.draft_identity || '' ) : '',
				status: active_state && active_state.draft ? String( active_state.draft.status || '' ) : 'idle',
				phase: active_state ? String( active_state.phase || '' ) : 'idle',
				has_preview: Boolean( active_state && active_state.preview ),
				has_request: Boolean( selection_request ),
				has_pending_frame: Boolean( pending_frame )
			};
		}

		return {
			initialize: initialize,
			destroy: destroy,
			cancel: function () {
				cancel_draft( true, true );
			},
			consume_signed_action_context: consume_signed_action_context,
			get_state_snapshot: get_state_snapshot
		};
	}

	if ( window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory ) {
		window.wpbc_timeline_modules.register_factory( module_id, create_selection_controller );
	}
}( window, document, window.wp ) );
