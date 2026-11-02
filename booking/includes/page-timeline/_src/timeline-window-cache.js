/**
 * Timeline bounded-window cache, request ownership, and anchor controller.
 *
 * The server remains authoritative for every window, axis, Resource, booking,
 * and occupancy DTO. This controller owns only browser-side composition of the
 * previous/current/next authorized responses, stale request generations, edge
 * rearming, cached Today/date resolution, and physical canvas anchor restore.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document ) {
	'use strict';

	var module_id = 'window_cache';
	/**
	 * Maximum harmless rounding drift between adjacent percentage boundaries.
	 *
	 * Percentage starts and widths are calculated independently. This tolerance
	 * prevents binary residue from turning one shared half-open boundary into a
	 * visual collision while remaining far below the narrowest supported cell.
	 *
	 * @type {number}
	 */
	var presentation_geometry_epsilon = 0.0000001;

	/**
	 * Create one bounded Timeline window/cache controller.
	 *
	 * @param {Object} context Controller-owned settings, mount, and scroll callback.
	 * @return {Object} Window/cache lifecycle and state-machine API.
	 */
	function create_window_cache_controller( context ) {
		var settings = context.settings || {};
		var mount = context.mount || null;
		var synchronize_axis_scroll = 'function' === typeof context.synchronize_axis_scroll ? context.synchronize_axis_scroll : function () {};
		var get_now = 'function' === typeof context.get_now ? context.get_now : function () {
			return new Date();
		};
		var window_store = {
			current_key: '',
			resource_fingerprint: '',
			resource_order: [],
			windows: {}
		};
		var active_request = null;
		var request_generation = 0;
		var edge_requests = {
			previous: null,
			next: null
		};
		var edge_request_generations = {
			previous: 0,
			next: 0
		};
		var edge_states = {
			previous: create_idle_edge_state(),
			next: create_idle_edge_state()
		};
		var canvas_pointer_navigation_active = false;
		var axis_anchor_restoration_frame = 0;
		var axis_anchor_restoration_generation = 0;
		var axis_anchor_restoration_minimum_attempts = 2;
		var axis_anchor_restoration_maximum_attempts = 4;
		var axis_anchor_restoration_tolerance_px = 1;
		var is_initialized = false;

		/**
		 * Return a fresh idle edge state.
		 *
		 * @return {Object} Mutable edge state owned by this instance.
		 */
		function create_idle_edge_state() {
			return {
				status: 'idle',
				slow_timer: 0,
				cooldown_until: 0,
				armed: false,
				user_intent: false,
				reentry_required: false
			};
		}

		/**
		 * Return Timeline adjacent-loading limits with bounded fallbacks.
		 *
		 * @return {Object} Normalized loading limits.
		 */
		function get_loading_limits() {
			var limits = settings.metadata && settings.metadata.window_loading ? settings.metadata.window_loading : {};

			return {
				maximum_cached_windows: Math.max( 1, Number( limits.maximum_cached_windows ) || 3 ),
				edge_placeholder_cells: Math.max( 1, Number( limits.edge_placeholder_cells ) || 3 ),
				edge_prefetch_percent: Math.max( 1, Math.min( 49, Number( limits.edge_prefetch_percent ) || 18 ) ),
				edge_rearm_percent: Math.max( 1, Math.min( 90, Number( limits.edge_rearm_percent ) || 32 ) ),
				request_cooldown_ms: Math.max( 0, Number( limits.request_cooldown_ms ) || 400 ),
				slow_loading_ms: Math.max( 0, Number( limits.slow_loading_ms ) || 3000 ),
				request_timeout_ms: Math.max( 1000, Number( limits.request_timeout_ms ) || 15000 )
			};
		}

		/**
		 * Normalize one authorized server response for bounded browser storage.
		 *
		 * @param {Object} response Authorized window response.
		 * @return {Object} Cache payload containing JSON-safe DTO collections.
		 */
		function normalize_window_payload( response ) {
			response = response || {};

			return {
				window: response.window || {},
				axis: response.axis || {},
				resources: Array.isArray( response.resources ) ? response.resources : [],
				segments: Array.isArray( response.segments ) ? response.segments : [],
				occupancy: Array.isArray( response.occupancy ) ? response.occupancy : [],
				time_slot_overflows: Array.isArray( response.time_slot_overflows ) ? response.time_slot_overflows : [],
				preferences: response.preferences || {},
				resource_view: response.resource_view || {},
				resource_pagination: response.resource_pagination || {},
				window_context: response.window_context || {},
				view_policy: response.view_policy || {},
				diagnostics: response.diagnostics || {}
			};
		}

		/**
		 * Return the server key or a compatibility key for an older response.
		 *
		 * @param {Object} payload Normalized window payload.
		 * @return {string} Stable cache key.
		 */
		function get_window_key( payload ) {
			if ( payload.window_context && payload.window_context.window_key ) {
				return String( payload.window_context.window_key );
			}

			return [ payload.axis.start_at || '', payload.axis.end_at || '', payload.axis.view || '' ].join( '|' );
		}

		/**
		 * Return cached windows ordered by their server start epoch.
		 *
		 * @return {Array<Object>} Ordered `{ key, payload }` entries.
		 */
		function get_ordered_window_entries() {
			return Object.keys( window_store.windows ).map( function ( window_key ) {
				return {
					key: window_key,
					payload: window_store.windows[ window_key ]
				};
			} ).sort( function ( left_entry, right_entry ) {
				return Number( left_entry.payload.axis.start_epoch ) - Number( right_entry.payload.axis.start_epoch );
			} );
		}

		/**
		 * Return signed selection tokens from the bounded authorized cache.
		 *
		 * @return {Array<string>} At most the configured cache count of tokens.
		 */
		function get_selection_context_tokens() {
			return get_ordered_window_entries().map( function ( entry ) {
				return entry.payload.window_context && entry.payload.window_context.selection_token
					? String( entry.payload.window_context.selection_token )
					: '';
			} ).filter( function ( token ) {
				return Boolean( token );
			} ).slice( 0, get_loading_limits().maximum_cached_windows );
		}

		/**
		 * Abort both adjacent requests and invalidate their late callbacks.
		 *
		 * @return {void}
		 */
		function abort_edge_requests() {
			[ 'previous', 'next' ].forEach( function ( direction ) {
				var state = edge_states[ direction ];

				if ( edge_requests[ direction ] && 'function' === typeof edge_requests[ direction ].abort ) {
					edge_requests[ direction ].abort();
				}
				edge_requests[ direction ] = null;
				edge_request_generations[ direction ] += 1;
				if ( state.slow_timer ) {
					window.clearTimeout( state.slow_timer );
				}
				edge_states[ direction ] = create_idle_edge_state();
			} );
		}

		/**
		 * Reset the bounded cache around one authoritative current response.
		 *
		 * @param {Object} response Authorized window response.
		 * @return {Object} Normalized current payload.
		 */
		function reset( response ) {
			var payload = normalize_window_payload( response );
			var window_key = get_window_key( payload );

			abort_edge_requests();
			window_store = {
				current_key: window_key,
				resource_fingerprint: String( payload.window_context.resource_fingerprint || '' ),
				resource_order: payload.resources.map( function ( resource ) {
					return Number( resource && resource.id );
				} ).filter( function ( resource_id ) {
					return Number.isInteger( resource_id ) && 1 <= resource_id;
				} ),
				windows: {}
			};
			window_store.windows[ window_key ] = payload;

			return payload;
		}

		/**
		 * Atomically replace the complete three-window Resource context.
		 *
		 * Every payload must carry the same non-empty server fingerprint. The
		 * existing store remains untouched until the complete candidate store has
		 * been validated, preventing old and new Resource pages from coexisting.
		 *
		 * @param {Object} current_response Authorized current-window response.
		 * @param {Array<Object>} adjacent_responses Authorized previous and next responses.
		 * @return {Object|null} Normalized current payload, or null when rejected.
		 */
		function replace_resource_context( current_response, adjacent_responses ) {
			var current_payload = normalize_window_payload( current_response );
			var resource_fingerprint = String( current_payload.window_context.resource_fingerprint || '' );
			var candidate_windows = {};
			var candidate_payloads = Array.isArray( adjacent_responses ) ? adjacent_responses.map( normalize_window_payload ) : [];
			var current_key = get_window_key( current_payload );
			var is_valid = Boolean( resource_fingerprint && current_key && 2 === candidate_payloads.length );

			candidate_windows[ current_key ] = current_payload;
			candidate_payloads.forEach( function ( payload ) {
				var window_key = get_window_key( payload );

				if ( ! window_key || resource_fingerprint !== String( payload.window_context.resource_fingerprint || '' ) ) {
					is_valid = false;
					return;
				}
				candidate_windows[ window_key ] = payload;
			} );
			if ( ! is_valid || 3 !== Object.keys( candidate_windows ).length ) {
				return null;
			}

			abort_edge_requests();
			window_store = {
				current_key: current_key,
				resource_fingerprint: resource_fingerprint,
				resource_order: current_payload.resources.map( function ( resource ) {
					return Number( resource && resource.id );
				} ).filter( function ( resource_id ) {
					return Number.isInteger( resource_id ) && 1 <= resource_id;
				} ),
				windows: candidate_windows
			};

			return current_payload;
		}

		/**
		 * Return the current opaque server Resource fingerprint.
		 *
		 * @return {string} Fingerprint, or an empty string before initialization.
		 */
		function get_resource_fingerprint() {
			return String( window_store.resource_fingerprint || '' );
		}

		/**
		 * Add an adjacent response only for the current authorized Resource set.
		 *
		 * @param {Object} response Authorized adjacent response.
		 * @return {boolean} True when the response was accepted into the cache.
		 */
		function cache_adjacent( response ) {
			var payload = normalize_window_payload( response );
			var resource_fingerprint = String( payload.window_context.resource_fingerprint || '' );
			var window_key = get_window_key( payload );

			if ( window_store.resource_fingerprint && resource_fingerprint !== window_store.resource_fingerprint ) {
				return false;
			}
			if ( ! window_store.resource_fingerprint ) {
				window_store.resource_fingerprint = resource_fingerprint;
			}
			window_store.windows[ window_key ] = payload;

			return true;
		}

		/**
		 * Keep only the nearest previous/current/next authorized responses.
		 *
		 * @return {boolean} True when at least one response was evicted.
		 */
		function trim() {
			var limits = get_loading_limits();
			var entries = get_ordered_window_entries();
			var current_index = 0;
			var changed = false;

			entries.some( function ( entry, entry_index ) {
				if ( entry.key === window_store.current_key ) {
					current_index = entry_index;
					return true;
				}
				return false;
			} );

			while ( entries.length > limits.maximum_cached_windows ) {
				var first_distance = Math.abs( current_index );
				var last_distance = Math.abs( entries.length - 1 - current_index );
				var remove_index = last_distance > first_distance ? entries.length - 1 : 0;

				delete window_store.windows[ entries[ remove_index ].key ];
				entries.splice( remove_index, 1 );
				if ( 0 === remove_index ) {
					current_index -= 1;
				}
				changed = true;
			}

			return changed;
		}

		/**
		 * Map an epoch to fractional units on an explicit DST-aware axis.
		 *
		 * @param {number} timestamp Epoch seconds.
		 * @param {Array<Object>} cells Ordered server cells.
		 * @return {number} Fractional cell position.
		 */
		function map_timestamp_to_axis_position( timestamp, cells ) {
			var position = 0;

			Array.prototype.some.call( cells, function ( cell, cell_index ) {
				var start_epoch = Number( cell.start_epoch );
				var end_epoch = Number( cell.end_epoch );

				if ( timestamp <= start_epoch ) {
					position = cell_index;
					return true;
				}
				if ( timestamp < end_epoch ) {
					position = cell_index + ( timestamp - start_epoch ) / Math.max( 1, end_epoch - start_epoch );
					return true;
				}
				position = cell_index + 1;
				return false;
			} );

			return position;
		}

		/**
		 * Calculate exact and visual geometry against the composed axis.
		 *
		 * @param {Object} axis Composed axis DTO.
		 * @param {number} start_epoch Inclusive start.
		 * @param {number} end_epoch Exclusive end.
		 * @return {Object} Percentage geometry.
		 */
		function get_composed_segment_geometry( axis, start_epoch, end_epoch ) {
			var cell_count = Math.max( 1, axis.cells.length );
			var start_units = map_timestamp_to_axis_position( start_epoch, axis.cells );
			var end_units = map_timestamp_to_axis_position( end_epoch, axis.cells );
			var visual_start = Math.max( 0, Math.min( cell_count - 1, Math.floor( start_units ) ) );
			var visual_end = Math.max( visual_start + 1, Math.min( cell_count, Math.ceil( end_units ) ) );

			return {
				offset_percent: 100 * start_units / cell_count,
				width_percent: 100 * Math.max( 0, end_units - start_units ) / cell_count,
				visual_offset_percent: 100 * visual_start / cell_count,
				visual_width_percent: 100 * ( visual_end - visual_start ) / cell_count
			};
		}

		/**
		 * Select shape-aware card geometry after cached windows are recomposed.
		 *
		 * Full-day records keep whole-cell presentation. Timed and changeover
		 * records retain their exact fractional boundaries, matching the server DTO
		 * and the resize proposal shown before and after a canonical refresh.
		 *
		 * @param {Object} geometry Exact and cell-expanded axis geometry.
		 * @param {boolean} is_full_day Whether the record represents full dates.
		 * @param {boolean} is_day_time_slot Whether a same-day slot uses a semantic day card.
		 * @return {Object} Shape-aware card presentation geometry.
		 */
		function get_composed_presentation_geometry( geometry, is_full_day, is_day_time_slot ) {
			var use_complete_cells = is_full_day || is_day_time_slot;

			return {
				presentation_offset_percent: use_complete_cells ? geometry.visual_offset_percent : geometry.offset_percent,
				presentation_width_percent: use_complete_cells ? geometry.visual_width_percent : geometry.width_percent
			};
		}

		/**
		 * Compose cached server axes without inventing local date labels.
		 *
		 * @param {Array<Object>} entries Ordered cached windows.
		 * @param {Object} current_payload Current logical window.
		 * @return {Object} Combined axis DTO.
		 */
		function compose_cached_axis( entries, current_payload ) {
			var cell_map = {};
			var cells = [];
			var month_bands = [];
			var date_bands = [];
			var month_map = {};
			var date_map = {};
			var date_metadata_by_key = {};
			var current_marker = Object.assign( {}, current_payload.axis.current_time_marker || {} );
			var now_epoch = Math.floor( get_now().getTime() / 1000 );

			entries.forEach( function ( entry ) {
				( entry.payload.axis.date_bands || [] ).forEach( function ( date_band ) {
					var date_key = String( date_band.date || '' );

					if ( date_key && ! date_metadata_by_key[ date_key ] ) {
						date_metadata_by_key[ date_key ] = Object.assign( {}, date_band );
					}
				} );
				( entry.payload.axis.cells || [] ).forEach( function ( cell ) {
					var cell_key = String( cell.start_epoch ) + ':' + String( cell.end_epoch );

					if ( ! cell_map[ cell_key ] ) {
						cell_map[ cell_key ] = Object.assign( {}, cell );
						cells.push( cell_map[ cell_key ] );
					}
				} );
			} );
			cells.sort( function ( left_cell, right_cell ) {
				return Number( left_cell.start_epoch ) - Number( right_cell.start_epoch );
			} );
			cells.forEach( function ( cell, cell_index ) {
				var month_key = String( cell.month_key || cell.date || '' ).substring( 0, 7 );
				var date_key = String( cell.date || '' );
				var date_metadata = date_metadata_by_key[ date_key ] || {};

				cell.index = cell_index;
				cell.offset_percent = cells.length ? 100 * cell_index / cells.length : 0;
				cell.width_percent = cells.length ? 100 / cells.length : 100;
				if ( ! month_map[ month_key ] ) {
					month_map[ month_key ] = {
						key: month_key,
						label: cell.month_label || month_key,
						span: 0
					};
					month_bands.push( month_map[ month_key ] );
				}
				month_map[ month_key ].span += 1;
				if ( ! date_map[ date_key ] ) {
					date_map[ date_key ] = {
						date: date_key,
						label: date_metadata.label || date_key,
						weekday: date_metadata.weekday || '',
						day_number: date_metadata.day_number || cell.day_number || '',
						today_label: date_metadata.today_label || date_key,
						is_today: 'undefined' !== typeof date_metadata.is_today ? Boolean( date_metadata.is_today ) : Boolean( cell.is_today ),
						is_weekend: 'undefined' !== typeof date_metadata.is_weekend ? Boolean( date_metadata.is_weekend ) : Boolean( cell.is_weekend ),
						start_at: date_metadata.start_at || cell.start_at,
						end_at: date_metadata.end_at || cell.end_at,
						start_epoch: 'undefined' !== typeof date_metadata.start_epoch ? Number( date_metadata.start_epoch ) : Number( cell.start_epoch ),
						end_epoch: 'undefined' !== typeof date_metadata.end_epoch ? Number( date_metadata.end_epoch ) : Number( cell.end_epoch ),
						elapsed_minutes: 'undefined' !== typeof date_metadata.elapsed_minutes ? Number( date_metadata.elapsed_minutes ) : Math.max( 0, ( Number( cell.end_epoch ) - Number( cell.start_epoch ) ) / 60 ),
						wall_minutes: 'undefined' !== typeof date_metadata.wall_minutes ? Number( date_metadata.wall_minutes ) : 1440,
						utc_offset_start_seconds: 'undefined' !== typeof date_metadata.utc_offset_start_seconds ? Number( date_metadata.utc_offset_start_seconds ) : 0,
						utc_offset_end_seconds: 'undefined' !== typeof date_metadata.utc_offset_end_seconds ? Number( date_metadata.utc_offset_end_seconds ) : 0,
						transitions: Array.isArray( date_metadata.transitions ) ? date_metadata.transitions.map( function ( transition ) {
							return Object.assign( {}, transition );
						} ) : [],
						span: 0
					};
					date_bands.push( date_map[ date_key ] );
				}
				date_map[ date_key ].span += 1;
			} );

			current_marker.is_visible = Boolean( current_payload.axis.is_timed && cells.length && now_epoch >= Number( cells[ 0 ].start_epoch ) && now_epoch < Number( cells[ cells.length - 1 ].end_epoch ) );
			current_marker.position_percent = cells.length ? 100 * map_timestamp_to_axis_position( now_epoch, cells ) / cells.length : 0;

			return Object.assign( {}, current_payload.axis, {
				cell_count: cells.length,
				cells: cells,
				month_bands: month_bands,
				date_bands: date_bands,
				start_at: cells.length ? cells[ 0 ].start_at : current_payload.axis.start_at,
				end_at: cells.length ? cells[ cells.length - 1 ].end_at : current_payload.axis.end_at,
				start_epoch: cells.length ? Number( cells[ 0 ].start_epoch ) : Number( current_payload.axis.start_epoch ),
				end_epoch: cells.length ? Number( cells[ cells.length - 1 ].end_epoch ) : Number( current_payload.axis.end_epoch ),
				current_time_marker: current_marker
			} );
		}

		/**
		 * Assign deterministic collision lanes to composed visible segments.
		 *
		 * @param {Array<Object>} segments Composed booking card DTOs.
		 * @param {Array<Object>} time_slot_overflows Composed day-cell overflow DTOs.
		 * @return {Object} Lane counts keyed by Resource ID.
		 */
		function assign_composed_segment_lanes( segments, time_slot_overflows ) {
			var by_resource = {};
			var lane_counts = {};

			segments.forEach( function ( segment, segment_index ) {
				var resource_id = Number( segment.resource_id );

				if ( false === segment.is_visible || true === segment.is_time_slot_overflow_item ) {
					segment.lane_index = 0;
					return;
				}
				by_resource[ resource_id ] = by_resource[ resource_id ] || [];
				by_resource[ resource_id ].push( {
					type: 'segment',
					index: segment_index,
					start: Number( segment.presentation_offset_percent ),
					end: Number( segment.presentation_offset_percent ) + Number( segment.presentation_width_percent ),
					sort_order: 0,
					id: String( segment.segment_id || '' )
				} );
			} );
			( time_slot_overflows || [] ).forEach( function ( overflow, overflow_index ) {
				var resource_id = Number( overflow.resource_id );

				by_resource[ resource_id ] = by_resource[ resource_id ] || [];
				by_resource[ resource_id ].push( {
					type: 'overflow',
					index: overflow_index,
					start: Number( overflow.presentation_offset_percent ),
					end: Number( overflow.presentation_offset_percent ) + Number( overflow.presentation_width_percent ),
					sort_order: 1,
					id: String( overflow.overflow_id || '' )
				} );
			} );
			Object.keys( by_resource ).forEach( function ( resource_id ) {
				var lane_ends = [];

				by_resource[ resource_id ].sort( function ( left_entry, right_entry ) {
					return left_entry.start - right_entry.start || left_entry.sort_order - right_entry.sort_order || left_entry.id.localeCompare( right_entry.id );
				} ).forEach( function ( entry ) {
					var lane_index = 0;

					while ( 'undefined' !== typeof lane_ends[ lane_index ] && lane_ends[ lane_index ] - entry.start > presentation_geometry_epsilon ) {
						lane_index += 1;
					}
					lane_ends[ lane_index ] = entry.end;
					if ( 'segment' === entry.type ) {
						segments[ entry.index ].lane_index = lane_index;
					} else {
						time_slot_overflows[ entry.index ].lane_index = lane_index;
					}
				} );
				lane_counts[ resource_id ] = Math.max( 1, lane_ends.length );
			} );

			return lane_counts;
		}

		/**
		 * Build compact overflow controls for dense same-date timed bookings.
		 *
		 * The operation changes presentation fields only. Exact intervals remain in
		 * every segment and in the independent occupancy collection.
		 *
		 * @param {Array<Object>} segments Composed booking card DTOs.
		 * @return {Array<Object>} Template-ready overflow controls.
		 */
		function build_composed_time_slot_overflows( segments ) {
			var maximum_visible_slots = 3;
			var groups = {};
			var overflows = [];

			segments.forEach( function ( segment ) {
				segment.is_time_slot_overflow_item = false;
				if ( false === segment.is_visible || ! segment.is_day_time_slot || ! segment.time_slot_group_key ) {
					return;
				}
				groups[ segment.time_slot_group_key ] = groups[ segment.time_slot_group_key ] || [];
				groups[ segment.time_slot_group_key ].push( segment );
			} );
			Object.keys( groups ).forEach( function ( group_key ) {
				var group_segments = groups[ group_key ].sort( function ( left_segment, right_segment ) {
					return Date.parse( left_segment.start ) - Date.parse( right_segment.start ) || String( left_segment.segment_id ).localeCompare( String( right_segment.segment_id ) );
				} );
				var hidden_segments;
				var first_segment;
				var count_text;
				var date_label;
				var visible_slot_limit = maximum_visible_slots;

				if ( group_segments.length > maximum_visible_slots ) {
					visible_slot_limit = maximum_visible_slots - 1;
				}

				group_segments.forEach( function ( segment, group_index ) {
					segment.time_slot_group_index = group_index;
					segment.is_time_slot_overflow_item = group_index >= visible_slot_limit;
				} );
				if ( group_segments.length <= maximum_visible_slots ) {
					return;
				}
				first_segment = group_segments[0];
				hidden_segments = group_segments.slice( visible_slot_limit );
				count_text = String( hidden_segments.length );
				date_label = String( first_segment.time_slot_date_label || first_segment.time_slot_date || '' );
				overflows.push( {
					overflow_id: 'wpbc-time-slot-overflow-' + String( first_segment.resource_id ) + '-' + String( first_segment.time_slot_date || '' ).replace( /[^0-9-]/g, '' ),
					group_key: group_key,
					resource_id: Number( first_segment.resource_id ),
					date: String( first_segment.time_slot_date || '' ),
					date_label: date_label,
					presentation_offset_percent: Number( first_segment.presentation_offset_percent ),
					presentation_width_percent: Number( first_segment.presentation_width_percent ),
					hidden_count: hidden_segments.length,
					more_label: String( settings.i18n.time_slot_more || '+{count} more' ).replace( '{count}', count_text ),
					aria_label: String( settings.i18n.time_slot_more_label || 'Show {count} more bookings on {date}' ).replace( '{count}', count_text ).replace( '{date}', date_label ),
					heading: String( settings.i18n.time_slot_more_heading || 'More bookings on {date}' ).replace( '{date}', date_label ),
					items: hidden_segments.map( function ( segment ) {
						return {
							booking_id: Number( segment.booking_id ),
							segment_id: String( segment.segment_id || '' ),
							label: String( segment.label || '' ),
							time_label: String( segment.time_slot_time_label || '' ),
							duration_label: String( segment.duration_label || '' ),
							aria_label: String( segment.aria_label || segment.label || '' )
						};
					} ),
					lane_index: 0
				} );
			} );

			return overflows;
		}

		/**
		 * Merge stable projections and recalculate their composed-axis geometry.
		 *
		 * @param {Array<Object>} entries Ordered cached windows.
		 * @param {Object} axis Composed axis DTO.
		 * @param {string} collection_key Segment or occupancy collection key.
		 * @return {Array<Object>} Deduplicated projected records.
		 */
		function compose_projected_records( entries, axis, collection_key ) {
			var record_map = {};
			var records = [];

			entries.forEach( function ( entry ) {
				( entry.payload[ collection_key ] || [] ).forEach( function ( source_record ) {
					var record_key = String( source_record.segment_id || '' );
					var start_epoch;
					var end_epoch;
					var visible_start_epoch;
					var visible_end_epoch;
					var visible_start;
					var visible_end;
					var geometry;
					var presentation_geometry;
					var record;

					if ( ! record_key || record_map[ record_key ] ) {
						return;
					}
					start_epoch = Math.floor( Date.parse( source_record.start ) / 1000 );
					end_epoch = Math.floor( Date.parse( source_record.end ) / 1000 );
					if ( end_epoch <= Number( axis.start_epoch ) || start_epoch >= Number( axis.end_epoch ) ) {
						return;
					}
					visible_start_epoch = Math.max( start_epoch, Number( axis.start_epoch ) );
					visible_end_epoch = Math.min( end_epoch, Number( axis.end_epoch ) );
					// Keep the exact request instants synchronized with recomposed geometry.
					// Resize eligibility compares these instants with canonical boundaries.
					visible_start = visible_start_epoch === start_epoch ? source_record.start : axis.start_at;
					visible_end = visible_end_epoch === end_epoch ? source_record.end : axis.end_at;
					geometry = get_composed_segment_geometry( axis, visible_start_epoch, visible_end_epoch );
					presentation_geometry = get_composed_presentation_geometry(
						geometry,
						true === source_record.is_full_day,
						true === source_record.is_day_time_slot
					);
					record = Object.assign( {}, source_record, geometry, presentation_geometry, {
						is_clipped_start: start_epoch < Number( axis.start_epoch ),
						is_clipped_end: end_epoch > Number( axis.end_epoch ),
						visible_start: visible_start,
						visible_end: visible_end,
						visible_start_epoch: visible_start_epoch,
						visible_end_epoch: visible_end_epoch,
						is_compact: true === source_record.is_day_time_slot
							? false
							: presentation_geometry.presentation_width_percent <= 100 / Math.max( 1, axis.cell_count ) + 0.000001
					} );
					record_map[ record_key ] = record;
					records.push( record );
				} );
			} );

			return records;
		}

		/**
		 * Restore the canonical Resource presentation order captured at reset.
		 *
		 * Adjacent exact-ID reads authorize the same Resource set independently,
		 * but an edition-specific repository must not reshuffle parent and child
		 * rows when that response becomes current. Unknown IDs are appended
		 * defensively; fingerprint validation still owns set equality.
		 *
		 * @param {Array<Object>} resources Authorized Resource DTOs.
		 * @return {Array<Object>} Resources in stable presentation order.
		 */
		function order_resources( resources ) {
			var resources_by_id = Object.create( null );
			var ordered_resources = [];

			( Array.isArray( resources ) ? resources : [] ).forEach( function ( resource ) {
				var resource_id = Number( resource && resource.id );

				if ( Number.isInteger( resource_id ) && 1 <= resource_id ) {
					resources_by_id[ resource_id ] = resource;
				}
			} );
			window_store.resource_order.forEach( function ( resource_id ) {
				if ( resources_by_id[ resource_id ] ) {
					ordered_resources.push( resources_by_id[ resource_id ] );
					delete resources_by_id[ resource_id ];
				}
			} );
			Object.keys( resources_by_id ).forEach( function ( resource_id ) {
				ordered_resources.push( resources_by_id[ resource_id ] );
			} );

			return ordered_resources;
		}

		/**
		 * Compose one template-ready view from the bounded cache.
		 *
		 * @return {Object|null} Composed view or null without a current window.
		 */
		function compose() {
			var entries = get_ordered_window_entries();
			var current_payload = window_store.windows[ window_store.current_key ];
			var axis;
			var segments;
			var occupancy;
			var time_slot_overflows;
			var lane_counts;
			var resources;

			if ( ! current_payload || ! entries.length ) {
				return null;
			}
			axis = compose_cached_axis( entries, current_payload );
			segments = compose_projected_records( entries, axis, 'segments' );
			occupancy = compose_projected_records( entries, axis, 'occupancy' );
			time_slot_overflows = build_composed_time_slot_overflows( segments );
			lane_counts = assign_composed_segment_lanes( segments, time_slot_overflows );
			resources = order_resources( current_payload.resources ).map( function ( resource ) {
				return Object.assign( {}, resource, {
					lane_count: lane_counts[ Number( resource.id ) ] || 1
				} );
			} );

			return {
				current: current_payload,
				axis: axis,
				resources: resources,
				segments: segments,
				occupancy: occupancy,
				time_slot_overflows: time_slot_overflows
			};
		}

		/**
		 * Return the outer cached entry used to request an adjacent window.
		 *
		 * @param {string} direction Previous or next.
		 * @return {Object|null} Outer cache entry or null.
		 */
		function get_edge_window_entry( direction ) {
			var entries = get_ordered_window_entries();

			if ( ! entries.length || -1 === [ 'previous', 'next' ].indexOf( direction ) ) {
				return null;
			}

			return 'previous' === direction ? entries[ 0 ] : entries[ entries.length - 1 ];
		}

		/**
		 * Promote the cached response containing an anchor to logical current.
		 *
		 * @param {Object} anchor Captured server-offset timestamp anchor.
		 * @return {Object|null} Promotion result, or null when unchanged.
		 */
		function promote_for_anchor( anchor ) {
			var anchor_epoch = Math.floor( Date.parse( anchor && anchor.at ? anchor.at : '' ) / 1000 );
			var promoted_entry = null;

			get_ordered_window_entries().some( function ( entry ) {
				if ( anchor_epoch >= Number( entry.payload.axis.start_epoch ) && anchor_epoch < Number( entry.payload.axis.end_epoch ) ) {
					promoted_entry = entry;
					return true;
				}
				return false;
			} );
			if ( ! promoted_entry || promoted_entry.key === window_store.current_key ) {
				return null;
			}
			window_store.current_key = promoted_entry.key;

			return {
				entry: promoted_entry,
				trimmed: trim()
			};
		}

		/**
		 * Return a read-only snapshot of one controller-owned edge.
		 *
		 * @param {string} direction Previous or next.
		 * @return {Object|null} Edge-state snapshot or null for an invalid direction.
		 */
		function get_edge_state( direction ) {
			return edge_states[ direction ] ? Object.assign( {}, edge_states[ direction ] ) : null;
		}

		/**
		 * Suspend automatic loading before programmatic canvas movement.
		 *
		 * @return {void}
		 */
		function suspend_adjacent_loading() {
			canvas_pointer_navigation_active = false;
			[ 'previous', 'next' ].forEach( function ( direction ) {
				var state = edge_states[ direction ];

				if ( 'idle' !== state.status ) {
					return;
				}
				state.armed = false;
				state.user_intent = false;
				state.reentry_required = false;
			} );
		}

		/**
		 * Record deliberate navigation toward an adjacent edge.
		 *
		 * @param {string} direction Previous or next.
		 * @param {boolean} force Whether an explicit control bypasses reentry.
		 * @return {boolean} True when intent was accepted.
		 */
		function activate_adjacent_intent( direction, force ) {
			var state = edge_states[ direction ];

			if ( ! state || 'idle' !== state.status || ( state.reentry_required && ! force ) ) {
				return false;
			}
			state.armed = true;
			state.user_intent = true;
			if ( force ) {
				state.reentry_required = false;
			}

			return true;
		}

		/**
		 * Record whether a pointer may be driving native horizontal movement.
		 *
		 * @param {boolean} is_active Whether pointer navigation is active.
		 * @return {void}
		 */
		function set_pointer_navigation_active( is_active ) {
			canvas_pointer_navigation_active = Boolean( is_active );
		}

		/**
		 * Update reentry and return whether one edge may request now.
		 *
		 * @param {string} direction Previous or next.
		 * @param {boolean} is_near_rearm Whether sentinel is within rearm zone.
		 * @param {boolean} is_near_prefetch Whether sentinel is in request zone.
		 * @return {boolean} True when the caller should request this edge.
		 */
		function update_edge_proximity( direction, is_near_rearm, is_near_prefetch ) {
			var state = edge_states[ direction ];

			if ( ! state ) {
				return false;
			}
			if ( state.reentry_required && ! is_near_rearm ) {
				state.reentry_required = false;
				state.armed = false;
				state.user_intent = false;
			}
			if ( canvas_pointer_navigation_active ) {
				activate_adjacent_intent( direction, false );
			}

			return Boolean( state.armed && state.user_intent && 'idle' === state.status && is_near_prefetch );
		}

		/**
		 * Start one foreground generation and abort its obsolete predecessor.
		 *
		 * @return {number} New request generation.
		 */
		function begin_foreground_request() {
			var request_to_abort = active_request;

			request_generation += 1;
			active_request = null;
			if ( request_to_abort && 'function' === typeof request_to_abort.abort ) {
				request_to_abort.abort();
			}

			return request_generation;
		}

		/**
		 * Attach a transport to its current foreground generation.
		 *
		 * @param {number} generation Request generation.
		 * @param {Object} request Abortable transport.
		 * @return {boolean} True when the transport remains current.
		 */
		function set_foreground_request( generation, request ) {
			if ( generation !== request_generation ) {
				if ( request && 'function' === typeof request.abort ) {
					request.abort();
				}
				return false;
			}
			active_request = request || null;
			return true;
		}

		/**
		 * Report whether a foreground callback still owns current state.
		 *
		 * @param {number} generation Request generation.
		 * @return {boolean} True when current.
		 */
		function is_foreground_generation_current( generation ) {
			return generation === request_generation;
		}

		/**
		 * Release the current foreground transport without changing generation.
		 *
		 * @param {number} generation Request generation.
		 * @return {boolean} True when released.
		 */
		function complete_foreground_request( generation ) {
			if ( generation !== request_generation ) {
				return false;
			}
			active_request = null;
			return true;
		}

		/**
		 * Abort and invalidate the current foreground transport.
		 *
		 * @return {boolean} True when an abortable request existed.
		 */
		function abort_foreground_request() {
			var request_to_abort = active_request;

			request_generation += 1;
			active_request = null;
			if ( ! request_to_abort || 'function' !== typeof request_to_abort.abort ) {
				return false;
			}
			request_to_abort.abort();
			return true;
		}

		/**
		 * Start one adjacent request generation and mark its edge busy.
		 *
		 * @param {string} direction Previous or next.
		 * @param {boolean} allow_without_user_intent Whether foreground priming may bypass user intent.
		 * @return {number} New generation, or zero for an invalid/busy edge.
		 */
		function begin_edge_request( direction, allow_without_user_intent ) {
			var state = edge_states[ direction ];

			if ( ! state || 'idle' !== state.status || ( ! allow_without_user_intent && ( ! state.armed || ! state.user_intent ) ) ) {
				return 0;
			}
			edge_request_generations[ direction ] += 1;
			state.armed = false;
			state.user_intent = false;
			state.reentry_required = true;
			state.status = 'loading';
			return edge_request_generations[ direction ];
		}

		/**
		 * Attach an adjacent transport to its current generation.
		 *
		 * @param {string} direction Previous or next.
		 * @param {number} generation Edge generation.
		 * @param {Object} request Abortable transport.
		 * @return {boolean} True when attached.
		 */
		function set_edge_request( direction, generation, request ) {
			if ( ! is_edge_generation_current( direction, generation ) ) {
				if ( request && 'function' === typeof request.abort ) {
					request.abort();
				}
				return false;
			}
			edge_requests[ direction ] = request || null;
			return true;
		}

		/**
		 * Report whether an adjacent callback still owns its edge.
		 *
		 * @param {string} direction Previous or next.
		 * @param {number} generation Edge generation.
		 * @return {boolean} True when current.
		 */
		function is_edge_generation_current( direction, generation ) {
			return Boolean( edge_states[ direction ] && generation === edge_request_generations[ direction ] );
		}

		/**
		 * Return one current adjacent request.
		 *
		 * @param {string} direction Previous or next.
		 * @return {Object|null} Request transport or null.
		 */
		function get_edge_request( direction ) {
			return edge_requests[ direction ] || null;
		}

		/**
		 * Start the slow-response timer for one current adjacent request.
		 *
		 * The controller owns the timer and status transition while the caller
		 * remains responsible only for repainting the domain-neutral edge shell.
		 *
		 * @param {string}   direction Previous or next.
		 * @param {number}   generation Edge generation.
		 * @param {Function} on_slow Callback after the current edge becomes slow.
		 * @return {boolean} True when the timer was scheduled.
		 */
		function schedule_edge_slow_state( direction, generation, on_slow ) {
			var state = edge_states[ direction ];

			if ( ! state || ! is_edge_generation_current( direction, generation ) ) {
				return false;
			}
			if ( state.slow_timer ) {
				window.clearTimeout( state.slow_timer );
			}
			state.slow_timer = window.setTimeout( function () {
				state.slow_timer = 0;
				if ( ! get_edge_request( direction ) || ! is_edge_generation_current( direction, generation ) ) {
					return;
				}
				state.status = 'slow';
				if ( 'function' === typeof on_slow ) {
					on_slow();
				}
			}, get_loading_limits().slow_loading_ms );

			return true;
		}

		/**
		 * Mark one current adjacent request as failed.
		 *
		 * @param {string} direction Previous or next.
		 * @param {number} generation Edge generation.
		 * @return {boolean} True when the current edge was updated.
		 */
		function mark_edge_error( direction, generation ) {
			var state = edge_states[ direction ];

			if ( ! state || ! is_edge_generation_current( direction, generation ) ) {
				return false;
			}
			if ( state.slow_timer ) {
				window.clearTimeout( state.slow_timer );
				state.slow_timer = 0;
			}
			state.status = 'error';
			state.cooldown_until = Date.now() + get_loading_limits().request_cooldown_ms;

			return true;
		}

		/**
		 * Set the post-load edge state after an authorized response is rendered.
		 *
		 * @param {string} direction Previous or next.
		 * @param {number} generation Edge generation.
		 * @return {boolean} True when the current edge was updated.
		 */
		function mark_edge_loaded( direction, generation ) {
			var state = edge_states[ direction ];

			if ( ! state || ! is_edge_generation_current( direction, generation ) ) {
				return false;
			}
			if ( state.slow_timer ) {
				window.clearTimeout( state.slow_timer );
				state.slow_timer = 0;
			}
			state.status = 'idle';
			state.cooldown_until = Date.now() + get_loading_limits().request_cooldown_ms;
			state.armed = false;
			state.user_intent = false;
			state.reentry_required = true;

			return true;
		}

		/**
		 * Clear a recoverable edge error before an explicit retry.
		 *
		 * @param {string} direction Previous or next.
		 * @return {boolean} True when the edge can be retried.
		 */
		function prepare_edge_retry( direction ) {
			var state = edge_states[ direction ];

			if ( ! state || edge_requests[ direction ] ) {
				return false;
			}
			if ( state.slow_timer ) {
				window.clearTimeout( state.slow_timer );
				state.slow_timer = 0;
			}
			state.status = 'idle';
			state.cooldown_until = 0;

			return true;
		}

		/**
		 * Release one adjacent transport if its generation remains current.
		 *
		 * @param {string} direction Previous or next.
		 * @param {number} generation Edge generation.
		 * @return {boolean} True when released.
		 */
		function complete_edge_request( direction, generation ) {
			var state = edge_states[ direction ];

			if ( ! is_edge_generation_current( direction, generation ) ) {
				return false;
			}
			if ( state.slow_timer ) {
				window.clearTimeout( state.slow_timer );
				state.slow_timer = 0;
			}
			edge_requests[ direction ] = null;
			return true;
		}

		/**
		 * Cancel one adjacent request and require threshold reentry.
		 *
		 * @param {string} direction Previous or next.
		 * @return {boolean} True when an abortable request was cancelled.
		 */
		function cancel_edge_request( direction ) {
			var request = edge_requests[ direction ];
			var state = edge_states[ direction ];

			if ( ! request || ! state || 'function' !== typeof request.abort ) {
				return false;
			}
			edge_request_generations[ direction ] += 1;
			edge_requests[ direction ] = null;
			if ( state.slow_timer ) {
				window.clearTimeout( state.slow_timer );
			}
			state.slow_timer = 0;
			state.status = 'idle';
			state.armed = false;
			state.user_intent = false;
			state.reentry_required = true;
			state.cooldown_until = Date.now() + get_loading_limits().request_cooldown_ms;
			request.abort();
			return true;
		}

		/**
		 * Locate the server axis cell nearest the visible canvas center.
		 *
		 * @return {Object} Offset-explicit timestamp and viewport geometry.
		 */
		function capture_axis_anchor() {
			var canvas = mount ? mount.querySelector( '[data-wpbc-timeline-canvas]' ) : null;
			var focused_cell = document.activeElement && document.activeElement.closest ? document.activeElement.closest( '[data-wpbc-timeline-axis-cell]' ) : null;
			var cells = mount ? mount.querySelectorAll( '[data-wpbc-timeline-axis-cell]' ) : [];
			var target_cell = focused_cell;
			var target_index = 0;
			var center_x;
			var closest_distance = Infinity;

			if ( ! canvas || ! cells.length ) {
				return { at: settings.axis.anchor.at, ratio: 0.5, restore_focus: false };
			}
			center_x = canvas.getBoundingClientRect().left + canvas.clientWidth / 2;
			if ( ! target_cell ) {
				Array.prototype.forEach.call( cells, function ( cell, cell_index ) {
					var rectangle = cell.getBoundingClientRect();
					var distance = Math.abs( rectangle.left + rectangle.width / 2 - center_x );

					if ( distance < closest_distance ) {
						closest_distance = distance;
						target_cell = cell;
						target_index = cell_index;
					}
				} );
			} else {
				target_index = Array.prototype.indexOf.call( cells, target_cell );
			}

			return {
				at: settings.axis.cells[ Math.max( 0, target_index ) ].start_at,
				ratio: canvas.clientWidth ? Math.max( 0, Math.min( 1, ( target_cell.getBoundingClientRect().left + target_cell.getBoundingClientRect().width / 2 - canvas.getBoundingClientRect().left ) / canvas.clientWidth ) ) : 0.5,
				viewport_offset_px: target_cell.getBoundingClientRect().left + target_cell.getBoundingClientRect().width / 2 - canvas.getBoundingClientRect().left,
				restore_focus: Boolean( focused_cell )
			};
		}

		/**
		 * Restore an anchor by moving only the authoritative Timeline canvas.
		 *
		 * @param {Object} anchor Captured anchor state.
		 * @return {number|null} Remaining error, or null without a rendered target.
		 */
		function restore_axis_anchor( anchor ) {
			var canvas = mount ? mount.querySelector( '[data-wpbc-timeline-canvas]' ) : null;
			var header_cells = mount ? mount.querySelectorAll( '[data-wpbc-timeline-axis-cell]' ) : [];
			var canvas_cells = canvas ? canvas.querySelectorAll( '[data-wpbc-timeline-canvas-anchor-cell]' ) : [];
			var cells = canvas_cells.length ? canvas_cells : header_cells;
			var anchor_epoch = Math.floor( Date.parse( anchor.at ) / 1000 );
			var target_cell = null;
			var focus_cell = null;
			var target_start_epoch = 0;
			var target_end_epoch = 0;
			var remaining_error = null;

			Array.prototype.some.call( cells, function ( cell ) {
				var start_epoch = Number( cell.getAttribute( 'data-wpbc-timeline-cell-start' ) );
				var end_epoch = Number( cell.getAttribute( 'data-wpbc-timeline-cell-end' ) );

				if ( anchor_epoch >= start_epoch && anchor_epoch < end_epoch ) {
					target_cell = cell;
					target_start_epoch = start_epoch;
					target_end_epoch = end_epoch;
					return true;
				}
				return false;
			} );
			if ( ! target_cell && cells.length ) {
				target_cell = cells[ 0 ];
				target_start_epoch = Number( target_cell.getAttribute( 'data-wpbc-timeline-cell-start' ) );
				target_end_epoch = Number( target_cell.getAttribute( 'data-wpbc-timeline-cell-end' ) );
			}
			if ( target_cell && canvas ) {
				var canvas_rectangle;
				var cell_rectangle;
				var anchor_fraction;
				var has_viewport_offset = window.isFinite( Number( anchor.viewport_offset_px ) );
				var current_offset;
				var desired_offset;
				var physical_delta;

				synchronize_axis_scroll();
				canvas_rectangle = canvas.getBoundingClientRect();
				cell_rectangle = target_cell.getBoundingClientRect();
				anchor_fraction = Math.max( 0, Math.min( 1, ( anchor_epoch - target_start_epoch ) / Math.max( 1, target_end_epoch - target_start_epoch ) ) );
				current_offset = has_viewport_offset
					? cell_rectangle.left + cell_rectangle.width / 2 - canvas_rectangle.left
					: ( settings.is_rtl ? cell_rectangle.right - ( cell_rectangle.width * anchor_fraction ) - canvas_rectangle.left : cell_rectangle.left + ( cell_rectangle.width * anchor_fraction ) - canvas_rectangle.left );
				if ( has_viewport_offset ) {
					desired_offset = Number( anchor.viewport_offset_px );
				} else if ( 0 <= Number( anchor.leading_cells_before ) ) {
					desired_offset = cell_rectangle.width * ( Number( anchor.leading_cells_before ) + anchor_fraction );
					if ( settings.is_rtl ) {
						desired_offset = canvas.clientWidth - desired_offset;
					}
				} else {
					desired_offset = canvas.clientWidth * Math.max( 0, Math.min( 1, Number( anchor.ratio ) || 0.5 ) );
				}
				physical_delta = current_offset - desired_offset;
				canvas.scrollLeft += settings.is_rtl ? -physical_delta : physical_delta;
				canvas_rectangle = canvas.getBoundingClientRect();
				cell_rectangle = target_cell.getBoundingClientRect();
				current_offset = has_viewport_offset
					? cell_rectangle.left + cell_rectangle.width / 2 - canvas_rectangle.left
					: ( settings.is_rtl ? cell_rectangle.right - ( cell_rectangle.width * anchor_fraction ) - canvas_rectangle.left : cell_rectangle.left + ( cell_rectangle.width * anchor_fraction ) - canvas_rectangle.left );
				remaining_error = Math.abs( current_offset - desired_offset );
				if ( anchor.restore_focus ) {
					Array.prototype.some.call( header_cells, function ( header_cell ) {
						if ( Number( header_cell.getAttribute( 'data-wpbc-timeline-cell-start' ) ) === target_start_epoch ) {
							focus_cell = header_cell;
							return true;
						}
						return false;
					} );
					if ( focus_cell ) {
						focus_cell.setAttribute( 'tabindex', '0' );
						try {
							focus_cell.focus( { preventScroll: true } );
						} catch ( error ) {
							focus_cell.focus();
						}
					}
				}
			}
			synchronize_axis_scroll();
			return remaining_error;
		}

		/**
		 * Cancel an obsolete post-render anchor restoration.
		 *
		 * @return {void}
		 */
		function cancel_anchor_restoration() {
			axis_anchor_restoration_generation += 1;
			if ( axis_anchor_restoration_frame ) {
				window.cancelAnimationFrame( axis_anchor_restoration_frame );
				axis_anchor_restoration_frame = 0;
			}
		}

		/**
		 * Restore one post-render anchor after bounded layout settling.
		 *
		 * @param {Object} anchor Captured anchor state.
		 * @param {Function} on_complete Completion callback.
		 * @return {void}
		 */
		function schedule_anchor_restoration( anchor, on_complete ) {
			var restoration_generation;
			var attempt_count = 0;

			cancel_anchor_restoration();
			restoration_generation = axis_anchor_restoration_generation;

			function restore_after_layout() {
				var remaining_error;

				axis_anchor_restoration_frame = 0;
				if ( restoration_generation !== axis_anchor_restoration_generation ) {
					return;
				}
				attempt_count += 1;
				remaining_error = restore_axis_anchor( anchor );
				if (
					attempt_count < axis_anchor_restoration_maximum_attempts
					&& ( attempt_count < axis_anchor_restoration_minimum_attempts || null === remaining_error || remaining_error > axis_anchor_restoration_tolerance_px )
				) {
					axis_anchor_restoration_frame = window.requestAnimationFrame( restore_after_layout );
					return;
				}
				if ( 'function' === typeof on_complete ) {
					on_complete();
				}
			}

			axis_anchor_restoration_frame = window.requestAnimationFrame( restore_after_layout );
		}

		/**
		 * Build the canonical second-precision current-instant anchor.
		 *
		 * @return {Object} Current instant and restoration preferences.
		 */
		function create_today_anchor() {
			var current_date = get_now();

			return {
				at: current_date.toISOString().slice( 0, 19 ) + '+00:00',
				epoch: Math.floor( current_date.getTime() / 1000 ),
				leading_cells_before: 1,
				restore_focus: false
			};
		}

		/**
		 * Resolve a strict site-local date from server cells already in cache.
		 *
		 * @param {string} iso_date Strict YYYY-MM-DD date.
		 * @return {Object|null} Cached axis anchor, or null.
		 */
		function create_loaded_date_anchor( iso_date ) {
			var resolved_anchor = null;

			if ( ! /^\d{4}-\d{2}-\d{2}$/.test( String( iso_date || '' ) ) ) {
				return null;
			}
			get_ordered_window_entries().some( function ( entry ) {
				var cells = entry.payload.axis && Array.isArray( entry.payload.axis.cells ) ? entry.payload.axis.cells : [];

				return cells.some( function ( cell ) {
					if ( String( cell.date || '' ) !== iso_date ) {
						return false;
					}
					resolved_anchor = {
						at: String( cell.start_at || '' ),
						epoch: Number( cell.start_epoch ),
						leading_cells_before: 1,
						restore_focus: false,
						target_date: iso_date
					};
					return true;
				} );
			} );

			return resolved_anchor;
		}

		/**
		 * Resolve a requested date against one newly authorized axis.
		 *
		 * @param {Object} anchor Requested navigation anchor.
		 * @param {Object} axis Server-authoritative axis DTO.
		 * @return {boolean} True when resolved.
		 */
		function resolve_response_date_anchor( anchor, axis ) {
			var cells = axis && Array.isArray( axis.cells ) ? axis.cells : [];
			var target_date = String( anchor && anchor.target_date ? anchor.target_date : '' );
			var was_resolved = false;

			if ( ! target_date ) {
				return false;
			}
			cells.some( function ( cell ) {
				if ( String( cell.date || '' ) !== target_date ) {
					return false;
				}
				anchor.at = String( cell.start_at || axis.start_at || anchor.at || '' );
				anchor.epoch = Number( cell.start_epoch );
				was_resolved = true;
				return true;
			} );

			return was_resolved;
		}

		/**
		 * Determine whether an anchor is inside any authorized cached axis.
		 *
		 * @param {Object} anchor Timestamp anchor.
		 * @return {boolean} True when loaded.
		 */
		function is_anchor_loaded( anchor ) {
			var anchor_epoch = anchor && window.isFinite( Number( anchor.epoch ) )
				? Number( anchor.epoch )
				: Math.floor( Date.parse( anchor && anchor.at ? anchor.at : '' ) / 1000 );

			if ( ! window.isFinite( anchor_epoch ) ) {
				return false;
			}
			return get_ordered_window_entries().some( function ( entry ) {
				return anchor_epoch >= Number( entry.payload.axis.start_epoch ) && anchor_epoch < Number( entry.payload.axis.end_epoch );
			} );
		}

		/**
		 * Return the server anchor ratio used by Today and selected-date reads.
		 *
		 * @return {number} Bounded server anchor ratio.
		 */
		function get_today_request_anchor_ratio() {
			var window_days = Number( settings.window.window_days );

			if ( 0 < Number( settings.window.window_months ) || 1 >= window_days ) {
				return 0;
			}

			return Math.min( 1, 1.5 / window_days );
		}

		/**
		 * Resolve whether Today can use cache or needs an authorized read.
		 *
		 * @return {Object} Today anchor, ratio, and cache decision.
		 */
		function resolve_today_navigation() {
			var anchor = create_today_anchor();
			var anchor_ratio = get_today_request_anchor_ratio();

			anchor.ratio = anchor_ratio;
			return {
				anchor: anchor,
				anchor_ratio: anchor_ratio,
				is_loaded: is_anchor_loaded( anchor )
			};
		}

		/**
		 * Initialize this controller once.
		 *
		 * @return {void}
		 */
		function initialize() {
			is_initialized = true;
		}

		/**
		 * Abort owned requests and scheduled anchor work.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! is_initialized ) {
				return;
			}
			abort_foreground_request();
			abort_edge_requests();
			cancel_anchor_restoration();
			window_store = {
				current_key: '',
				resource_fingerprint: '',
				windows: {}
			};
			canvas_pointer_navigation_active = false;
			is_initialized = false;
		}

		return {
			initialize: initialize,
			destroy: destroy,
			get_loading_limits: get_loading_limits,
			get_ordered_window_entries: get_ordered_window_entries,
			get_selection_context_tokens: get_selection_context_tokens,
			get_resource_fingerprint: get_resource_fingerprint,
			reset: reset,
			replace_resource_context: replace_resource_context,
			cache_adjacent: cache_adjacent,
			trim: trim,
			compose: compose,
			map_timestamp_to_axis_position: map_timestamp_to_axis_position,
			get_composed_segment_geometry: get_composed_segment_geometry,
			get_edge_window_entry: get_edge_window_entry,
			promote_for_anchor: promote_for_anchor,
			get_edge_state: get_edge_state,
			suspend_adjacent_loading: suspend_adjacent_loading,
			activate_adjacent_intent: activate_adjacent_intent,
			set_pointer_navigation_active: set_pointer_navigation_active,
			update_edge_proximity: update_edge_proximity,
			abort_edge_requests: abort_edge_requests,
			begin_foreground_request: begin_foreground_request,
			set_foreground_request: set_foreground_request,
			is_foreground_generation_current: is_foreground_generation_current,
			complete_foreground_request: complete_foreground_request,
			abort_foreground_request: abort_foreground_request,
			begin_edge_request: begin_edge_request,
			set_edge_request: set_edge_request,
			is_edge_generation_current: is_edge_generation_current,
			get_edge_request: get_edge_request,
			schedule_edge_slow_state: schedule_edge_slow_state,
			mark_edge_error: mark_edge_error,
			mark_edge_loaded: mark_edge_loaded,
			prepare_edge_retry: prepare_edge_retry,
			complete_edge_request: complete_edge_request,
			cancel_edge_request: cancel_edge_request,
			capture_axis_anchor: capture_axis_anchor,
			restore_axis_anchor: restore_axis_anchor,
			cancel_anchor_restoration: cancel_anchor_restoration,
			schedule_anchor_restoration: schedule_anchor_restoration,
			create_today_anchor: create_today_anchor,
			create_loaded_date_anchor: create_loaded_date_anchor,
			resolve_response_date_anchor: resolve_response_date_anchor,
			is_anchor_loaded: is_anchor_loaded,
			get_today_request_anchor_ratio: get_today_request_anchor_ratio,
			resolve_today_navigation: resolve_today_navigation
		};
	}

	if ( window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory ) {
		window.wpbc_timeline_modules.register_factory( module_id, create_window_cache_controller );
	}
}( window, document ) );
