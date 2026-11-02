/**
 * Timeline lazy Availability transport and bounded cache controller.
 *
 * Booking windows remain authoritative and render independently. This module
 * mirrors only the accepted previous/current/next window identities, loads the
 * data-only Availability projection in parallel, rejects stale responses, and
 * exposes a neutral cache miss when a read cannot be completed.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window ) {
	'use strict';

	var module_id = 'availability_cache';

	/**
	 * Create one bounded lazy Availability controller.
	 *
	 * @param {Object}   context                    Controller construction context.
	 * @param {Element}  context.mount              Timeline mount element.
	 * @param {Object}   context.settings           Server-localized Timeline settings.
	 * @param {Function} context.get_axis           Current composed-axis callback.
	 * @param {Function} context.get_geometry       Canonical axis-geometry callback.
	 * @param {Function} context.on_change          Optional cache-state callback.
	 * @param {Function} context.on_status_change   Optional aggregate read-status callback.
	 * @param {Function} context.send_request       Optional transport override for tests.
	 * @return {Object} Availability cache lifecycle and read API.
	 */
	function create_availability_cache_controller( context ) {
		var mount = context.mount || null;
		var settings = context.settings || {};
		var get_axis = 'function' === typeof context.get_axis ? context.get_axis : function () {
			return settings.axis || {};
		};
		var get_geometry = 'function' === typeof context.get_geometry ? context.get_geometry : function () {
			return {};
		};
		var on_change = 'function' === typeof context.on_change ? context.on_change : function () {};
		var on_status_change = 'function' === typeof context.on_status_change ? context.on_status_change : function () {};
		var send_request = 'function' === typeof context.send_request ? context.send_request : send_ajax_request;
		var cache_entries = Object.create( null );
		var active_requests = Object.create( null );
		var desired_descriptors = Object.create( null );
		var known_revisions = Object.create( null );
		var request_generation = 0;
		var status_notifications_suspended = false;
		var is_initialized = false;
		var availability_source_ids = {
			appointment_buffer: true,
			blocked_date: true,
			blocked_time: true,
			booking_buffer: true,
			seasonal_availability: true,
			unavailable_weekday: true,
			working_time: true
		};

		/**
		 * Return normalized Timeline loading limits.
		 *
		 * @return {Object} Bounded cache count and request timeout.
		 */
		function get_limits() {
			var limits = settings.metadata && settings.metadata.window_loading ? settings.metadata.window_loading : {};

			return {
				maximum_cached_windows: Math.max( 1, Math.min( 3, Number( limits.maximum_cached_windows ) || 3 ) ),
				request_timeout_ms: Math.max( 1000, Number( limits.request_timeout_ms ) || 15000 )
			};
		}

		/**
		 * Return sorted unique positive Resource IDs from one booking window.
		 *
		 * @param {Array<Object>} resources Authorized Resource DTOs.
		 * @return {Array<number>} Stable Resource ID set.
		 */
		function normalize_resource_ids( resources ) {
			var seen = Object.create( null );

			return ( Array.isArray( resources ) ? resources : [] ).map( function ( resource ) {
				return Number( resource && resource.id );
			} ).filter( function ( resource_id ) {
				if ( ! Number.isInteger( resource_id ) || 1 > resource_id || seen[ resource_id ] ) {
					return false;
				}
				seen[ resource_id ] = true;
				return true;
			} ).sort( function ( left_id, right_id ) {
				return left_id - right_id;
			} );
		}

		/**
		 * Build one exact, authorized cache descriptor from a booking-window entry.
		 *
		 * The identity includes both the opaque server fingerprint and explicit
		 * authorized Resource IDs, the half-open window, scale, timezone, and an
		 * Availability revision when the server exposes one.
		 *
		 * @param {Object} window_entry Window-cache `{ key, payload }` entry.
		 * @return {Object|null} Exact cache descriptor or null when incomplete.
		 */
		function build_descriptor( window_entry ) {
			var payload = window_entry && window_entry.payload ? window_entry.payload : {};
			var timeline_window = payload.window || {};
			var axis = payload.axis || {};
			var window_context = payload.window_context || {};
			var resource_ids = normalize_resource_ids( payload.resources );
			var explicit_revision = String(
				window_context.availability_revision
				|| timeline_window.availability_revision
				|| ''
			);
			var identity_parts;
			var base_key;
			var availability_revision;
			var request_values;

			if ( ! resource_ids.length || ! timeline_window.start_at || ! timeline_window.end_at || ! timeline_window.view || ! timeline_window.timezone ) {
				return null;
			}

			identity_parts = [
				String( window_context.resource_fingerprint || '' ),
				resource_ids.join( ',' ),
				String( timeline_window.start_at ),
				String( timeline_window.end_at ),
				String( timeline_window.view ),
				String( timeline_window.cell_minutes || axis.cell_minutes || '' ),
				String( timeline_window.timezone )
			];
			base_key = identity_parts.join( '|' );
			availability_revision = explicit_revision || String( known_revisions[ base_key ] || '' );
			request_values = {
				anchor_date: String( timeline_window.anchor_date || '' ),
				anchor_at: String( timeline_window.anchor_at || timeline_window.start_at ),
				anchor_ratio: Number( timeline_window.anchor_ratio || 0 ),
				window_position: Number( timeline_window.window_position || 0 ),
				view: String( timeline_window.view ),
				resource_ids: resource_ids.slice()
			};
			if ( 0 < Number( timeline_window.window_months || 0 ) ) {
				request_values.window_months = Number( timeline_window.window_months );
			} else {
				request_values.window_days = Number( timeline_window.window_days || 0 );
			}

			return {
				base_key: base_key,
				cache_key: base_key + '|' + availability_revision,
				window_key: String( window_entry.key || window_context.window_key || '' ),
				resource_ids: resource_ids,
				resource_fingerprint: String( window_context.resource_fingerprint || '' ),
				start_at: String( timeline_window.start_at ),
				end_at: String( timeline_window.end_at ),
				view: String( timeline_window.view ),
				cell_minutes: Number( timeline_window.cell_minutes || axis.cell_minutes || 0 ),
				timezone: String( timeline_window.timezone ),
				availability_revision: availability_revision,
				request_values: request_values
			};
		}

		/**
		 * Send one authenticated Availability request through the localized endpoint.
		 *
		 * @param {Object} request_values Validated booking-window request values.
		 * @param {number} timeout_ms    Request timeout in milliseconds.
		 * @return {Object|null} jQuery-compatible request transport.
		 */
		function send_ajax_request( request_values, timeout_ms ) {
			var transport = settings.transport && settings.transport.availability ? settings.transport.availability : {};

			if ( ! window.jQuery || ! settings.transport || ! settings.transport.url || ! transport.action || ! transport.nonce ) {
				return null;
			}

			return window.jQuery.ajax( {
				url: settings.transport.url,
				method: 'POST',
				dataType: 'json',
				data: Object.assign( {}, request_values, {
					action: transport.action,
					nonce: transport.nonce
				} ),
				timeout: timeout_ms
			} );
		}

		/**
		 * Compare a response with the exact requested authorized window identity.
		 *
		 * @param {Object} descriptor Exact request descriptor.
		 * @param {Object} payload    Availability response payload.
		 * @param {number} generation Owning request generation.
		 * @return {boolean} True when the response belongs to the request.
		 */
		function response_matches_descriptor( descriptor, payload, generation ) {
			var response_window = payload && payload.window ? payload.window : {};
			var response_resource_ids = normalize_resource_ids(
				( payload && Array.isArray( payload.resource_ids ) ? payload.resource_ids : [] ).map( function ( resource_id ) {
					return { id: resource_id };
				} )
			);

			return Number( response_window.request_generation ) === generation
				&& descriptor.start_at === String( response_window.start_at || '' )
				&& descriptor.end_at === String( response_window.end_at || '' )
				&& descriptor.view === String( response_window.view || '' )
				&& descriptor.cell_minutes === Number( response_window.cell_minutes || 0 )
				&& descriptor.timezone === String( response_window.timezone || '' )
				&& descriptor.resource_ids.join( ',' ) === response_resource_ids.join( ',' );
		}

		/**
		 * Parse one offset-explicit server timestamp into epoch seconds.
		 *
		 * @param {string} timestamp RFC 3339 server timestamp.
		 * @return {number|null} Epoch seconds, or null for an invalid timestamp.
		 */
		function parse_timestamp( timestamp ) {
			var normalized_timestamp = String( timestamp || '' );
			var milliseconds;

			if ( ! /(?:Z|[+-]\d{2}:\d{2})$/i.test( normalized_timestamp ) ) {
				return null;
			}
			milliseconds = Date.parse( normalized_timestamp );

			return Number.isFinite( milliseconds ) ? milliseconds / 1000 : null;
		}

		/**
		 * Remove every Availability presentation layer owned by this controller.
		 *
		 * @return {void}
		 */
		function clear_rendered_layers() {
			var layers = mount ? mount.querySelectorAll( '[data-wpbc-timeline-availability-layer]' ) : [];

			Array.prototype.forEach.call( layers, function ( layer ) {
				if ( layer.parentNode ) {
					layer.parentNode.removeChild( layer );
				}
			} );
		}

		/**
		 * Return the reusable pointer-transparent layer between cells and segments.
		 *
		 * @param {Element} track Resource-row Timeline track.
		 * @return {Element|null} Availability layer, or null without a segment host.
		 */
		function create_availability_layer( track ) {
			var segment_host = track ? track.querySelector( '[data-wpbc-timeline-segments]' ) : null;
			var layer = track ? track.querySelector( '[data-wpbc-timeline-availability-layer]' ) : null;

			if ( ! track || ! segment_host ) {
				return null;
			}
			if ( layer ) {
				layer.textContent = '';
				return layer;
			}

			layer = track.ownerDocument.createElement( 'div' );
			layer.className = 'wpbc_timeline__availability_layer';
			layer.setAttribute( 'data-wpbc-timeline-availability-layer', '' );
			layer.setAttribute( 'role', 'presentation' );
			layer.setAttribute( 'aria-hidden', 'true' );
			track.insertBefore( layer, segment_host );

			return layer;
		}

		/**
		 * Return the current block geometry of one related booking card.
		 *
		 * Buffer timestamps remain server-authoritative. The optional segment ID
		 * only lets the decorative layer reuse the already rendered card's lane
		 * and exact height; it never derives Availability from card geometry.
		 *
		 * @param {Element} layer              Resource Availability layer.
		 * @param {string}  related_segment_id Authorized booking segment identity.
		 * @return {Object|null} CSS `{ block_start, block_size }` values, or null.
		 */
		function get_related_booking_geometry( layer, related_segment_id ) {
			var track = layer ? layer.parentNode : null;
			var booking_segments = track ? track.querySelectorAll( '[data-wpbc-timeline-segment-id]' ) : [];
			var matched_segment = null;
			var block_start;
			var block_size;
			var lane_index;

			if ( ! related_segment_id ) {
				return null;
			}

			Array.prototype.some.call( booking_segments, function ( booking_segment ) {
				if ( related_segment_id !== String( booking_segment.getAttribute( 'data-wpbc-timeline-segment-id' ) || '' ) ) {
					return false;
				}
				matched_segment = booking_segment;
				return true;
			} );

			if ( ! matched_segment ) {
				return null;
			}

			block_start = Number( matched_segment.offsetTop );
			block_size = Number( matched_segment.offsetHeight );
			if ( Number.isFinite( block_start ) && Number.isFinite( block_size ) && 0 < block_size ) {
				return {
					block_start: Math.max( 0, block_start ) + 'px',
					block_size: block_size + 'px'
				};
			}

			lane_index = Number( matched_segment.getAttribute( 'data-wpbc-timeline-lane-index' ) );
			if ( ! Number.isInteger( lane_index ) || 0 > lane_index ) {
				return null;
			}
			return {
				block_start: 'calc(var(--wpbc_timeline_general__booking-lane-offset) + (' + lane_index + ' * var(--wpbc_timeline_general__lane-height)))',
				block_size: 'var(--wpbc_timeline_general__booking-card-height)'
			};
		}

		/**
		 * Return exact intervals clipped to both their loaded and composed windows.
		 *
		 * Adjacent window fragments merge only for the same Resource, source, and
		 * related booking segment. Keeping booking ownership prevents overlapping
		 * buffers in different card lanes from collapsing into a full-row interval.
		 * Unknown or conditional records are never promoted into rendered intervals.
		 *
		 * @param {Object} axis Current composed Timeline axis.
		 * @return {Array<Object>} Sorted, merged, clipped exact interval records.
		 */
		function get_renderable_intervals( axis ) {
			var axis_cells = axis && Array.isArray( axis.cells ) ? axis.cells : [];
			var axis_start = axis_cells.length ? Number( axis_cells[0].start_epoch ) : Number( axis.start_epoch );
			var axis_end = axis_cells.length ? Number( axis_cells[ axis_cells.length - 1 ].end_epoch ) : Number( axis.end_epoch );
			var intervals = [];
			var merged = [];

			if ( ! Number.isFinite( axis_start ) || ! Number.isFinite( axis_end ) || axis_start >= axis_end ) {
				return merged;
			}

			get_cached_windows().forEach( function ( cache_entry ) {
				var payload = cache_entry && cache_entry.payload ? cache_entry.payload : {};
				var loaded_window = payload.window || {};
				var loaded_start = parse_timestamp( loaded_window.start_at );
				var loaded_end = parse_timestamp( loaded_window.end_at );
				var loaded_resource_ids = Object.create( null );

				( Array.isArray( payload.resource_ids ) ? payload.resource_ids : [] ).forEach( function ( resource_id ) {
					resource_id = Number( resource_id );
					if ( Number.isInteger( resource_id ) && 1 <= resource_id ) {
						loaded_resource_ids[ resource_id ] = true;
					}
				} );

				if ( null === loaded_start || null === loaded_end || loaded_start >= loaded_end ) {
					return;
				}

				( Array.isArray( payload.intervals ) ? payload.intervals : [] ).forEach( function ( interval ) {
					var resource_id = Number( interval && interval.resource_id );
					var source = String( interval && interval.source || '' );
					var related_segment_id = String( interval && interval.related_segment_id || '' );
					var start_epoch = parse_timestamp( interval && interval.start_at );
					var end_epoch = parse_timestamp( interval && interval.end_at );

					if (
						'exact' !== String( interval && interval.state || '' )
						|| ! Number.isInteger( resource_id )
						|| 1 > resource_id
						|| ! loaded_resource_ids[ resource_id ]
						|| ! availability_source_ids[ source ]
						|| null === start_epoch
						|| null === end_epoch
					) {
						return;
					}

					start_epoch = Math.max( start_epoch, loaded_start, axis_start );
					end_epoch = Math.min( end_epoch, loaded_end, axis_end );
					if ( start_epoch >= end_epoch ) {
						return;
					}

					intervals.push( {
						resource_id: resource_id,
						source: source,
						related_segment_id: related_segment_id,
						start_epoch: start_epoch,
						end_epoch: end_epoch
					} );
				} );
			} );

			intervals.sort( function ( left_interval, right_interval ) {
				return left_interval.resource_id - right_interval.resource_id
					|| left_interval.source.localeCompare( right_interval.source )
					|| left_interval.related_segment_id.localeCompare( right_interval.related_segment_id )
					|| left_interval.start_epoch - right_interval.start_epoch
					|| left_interval.end_epoch - right_interval.end_epoch;
			} );
			intervals.forEach( function ( interval ) {
				var previous_interval = merged.length ? merged[ merged.length - 1 ] : null;

				if (
					previous_interval
					&& previous_interval.resource_id === interval.resource_id
					&& previous_interval.source === interval.source
					&& previous_interval.related_segment_id === interval.related_segment_id
					&& interval.start_epoch <= previous_interval.end_epoch
				) {
					previous_interval.end_epoch = Math.max( previous_interval.end_epoch, interval.end_epoch );
					return;
				}
				merged.push( interval );
			} );

			return merged;
		}

		/**
		 * Render cached exact intervals on the current composed server axis.
		 *
		 * Layers are resolved from the current booking rows after each row render and
		 * reused while those rows remain mounted. Absolute logical geometry and pointer
		 * transparency keep row heights, hitboxes, controls, and scrolling unchanged.
		 *
		 * @return {void}
		 */
		function render_cached_availability() {
			var axis = get_axis() || {};
			var tracks = mount ? mount.querySelectorAll( '[data-wpbc-timeline-selection-track]' ) : [];
			var layers_by_resource_id = Object.create( null );

			Array.prototype.forEach.call( tracks, function ( track ) {
				var resource_id = Number( track.getAttribute( 'data-wpbc-timeline-resource-id' ) );
				var layer = create_availability_layer( track );

				if ( layer && Number.isInteger( resource_id ) && 1 <= resource_id ) {
					layers_by_resource_id[ resource_id ] = layer;
				}
			} );

			get_renderable_intervals( axis ).forEach( function ( interval ) {
				var layer = layers_by_resource_id[ interval.resource_id ];
				var geometry = get_geometry( axis, interval.start_epoch, interval.end_epoch ) || {};
				var offset_percent = Number( geometry.offset_percent );
				var width_percent = Number( geometry.width_percent );
				var clamped_offset_percent;
				var clamped_width_percent;
				var interval_element;
				var related_booking_geometry;

				if ( ! layer || ! Number.isFinite( offset_percent ) || ! Number.isFinite( width_percent ) || 0 >= width_percent ) {
					return;
				}
				clamped_offset_percent = Math.max( 0, Math.min( 100, offset_percent ) );
				clamped_width_percent = Math.max( 0, Math.min( 100 - clamped_offset_percent, width_percent ) );
				if ( 0 >= clamped_width_percent ) {
					return;
				}

				interval_element = layer.ownerDocument.createElement( 'span' );
				interval_element.className = 'wpbc_timeline__availability_interval';
				interval_element.setAttribute( 'data-wpbc-timeline-availability-source', interval.source );
				interval_element.style.setProperty( '--wpbc-timeline-availability-inline-start', clamped_offset_percent + '%' );
				interval_element.style.setProperty( '--wpbc-timeline-availability-inline-size', clamped_width_percent + '%' );
				if ( 'booking_buffer' === interval.source || 'appointment_buffer' === interval.source ) {
					related_booking_geometry = get_related_booking_geometry( layer, interval.related_segment_id );
					if ( related_booking_geometry ) {
						interval_element.setAttribute( 'data-wpbc-timeline-buffer-aligned', 'true' );
						interval_element.style.setProperty( '--wpbc-timeline-availability-block-start', related_booking_geometry.block_start );
						interval_element.style.setProperty( '--wpbc-timeline-availability-block-size', related_booking_geometry.block_size );
					}
				}
				layer.appendChild( interval_element );
			} );
		}

		/**
		 * Notify the page coordinator without coupling failures to booking rendering.
		 *
		 * @param {string} state      Loaded or neutral state.
		 * @param {Object} descriptor Exact cache descriptor.
		 * @param {Object|null} payload Authorized Availability DTO when loaded.
		 * @return {void}
		 */
		function notify_change( state, descriptor, payload ) {
			render_cached_availability();
			on_change( {
				state: state,
				cache_key: descriptor.cache_key,
				window_key: descriptor.window_key,
				payload: payload,
				cached_windows: get_cached_windows()
			} );
		}

		/**
		 * Report aggregate lazy-read progress for the currently desired windows.
		 *
		 * This lifecycle is intentionally separate from `on_change`, whose events
		 * represent accepted Availability data. Page feedback may observe progress
		 * without making loading state look like a new authorized projection.
		 *
		 * @param {string} state Optional explicit lifecycle state.
		 * @return {void}
		 */
		function notify_status_change( state ) {
			var desired_keys;
			var pending_count;
			var loaded_count;

			if ( status_notifications_suspended ) {
				return;
			}
			desired_keys = Object.keys( desired_descriptors );
			pending_count = desired_keys.filter( function ( base_key ) {
				return Boolean(
					active_requests[ base_key ]
					&& active_requests[ base_key ].cache_key === desired_descriptors[ base_key ].cache_key
				);
			} ).length;
			loaded_count = desired_keys.filter( function ( base_key ) {
				var cached_entry = cache_entries[ base_key ];

				return Boolean(
					cached_entry
					&& ( ! desired_descriptors[ base_key ].availability_revision
						|| cached_entry.availability_revision === desired_descriptors[ base_key ].availability_revision )
				);
			} ).length;

			on_status_change( {
				schema_version: 1,
				state: state || ( pending_count ? 'loading' : 'settled' ),
				desired_count: desired_keys.length,
				pending_count: pending_count,
				loaded_count: loaded_count,
				failed_count: Math.max( 0, desired_keys.length - pending_count - loaded_count ),
				is_settled: 0 === pending_count
			} );
		}

		/**
		 * Cache one current Availability response.
		 *
		 * @param {Object} descriptor Exact cache descriptor.
		 * @param {Object} payload    Authorized Availability DTO.
		 * @return {void}
		 */
		function cache_response( descriptor, payload ) {
			var response_revision = String( payload.availability_revision || descriptor.availability_revision || '' );
			var cache_key = descriptor.base_key + '|' + response_revision;
			var notification_descriptor = Object.assign( {}, descriptor, {
				cache_key: cache_key,
				availability_revision: response_revision
			} );

			known_revisions[ descriptor.base_key ] = response_revision;
			cache_entries[ descriptor.base_key ] = {
				cache_key: cache_key,
				window_key: descriptor.window_key,
				availability_revision: response_revision,
				payload: payload
			};
			notify_change( 'loaded', notification_descriptor, payload );
		}

		/**
		 * Start one missing lazy read without blocking booking-window rendering.
		 *
		 * @param {Object} descriptor Exact cache descriptor.
		 * @return {void}
		 */
		function request_descriptor( descriptor ) {
			var generation;
			var request_values;
			var request;
			var cached_entry = cache_entries[ descriptor.base_key ];

			if ( cached_entry && ( ! descriptor.availability_revision || cached_entry.availability_revision === descriptor.availability_revision ) ) {
				return;
			}
			if ( cached_entry ) {
				delete cache_entries[ descriptor.base_key ];
			}
			if ( active_requests[ descriptor.base_key ] ) {
				if ( active_requests[ descriptor.base_key ].cache_key !== descriptor.cache_key ) {
					abort_request( descriptor.base_key );
				} else {
					return;
				}
			}

			request_generation += 1;
			generation = request_generation;
			request_values = Object.assign( {}, descriptor.request_values, {
				request_generation: generation
			} );
			request = send_request( request_values, get_limits().request_timeout_ms );
			if ( ! request || 'function' !== typeof request.done || 'function' !== typeof request.fail || 'function' !== typeof request.always ) {
				notify_change( 'neutral', descriptor, null );
				return;
			}

			active_requests[ descriptor.base_key ] = {
				cache_key: descriptor.cache_key,
				generation: generation,
				request: request
			};
			request.done( function ( response ) {
				var active_request = active_requests[ descriptor.base_key ];

				if (
					! active_request
					|| active_request.generation !== generation
					|| active_request.cache_key !== descriptor.cache_key
					|| ! desired_descriptors[ descriptor.base_key ]
					|| desired_descriptors[ descriptor.base_key ].cache_key !== descriptor.cache_key
				) {
					return;
				}
				if ( ! response || ! response.success || ! response.data || ! response_matches_descriptor( descriptor, response.data, generation ) ) {
					notify_change( 'neutral', descriptor, null );
					return;
				}
				cache_response( descriptor, response.data );
			} ).fail( function ( failed_request, request_status ) {
				var active_request = active_requests[ descriptor.base_key ];

				if ( active_request && active_request.generation === generation && desired_descriptors[ descriptor.base_key ] && 'abort' !== request_status ) {
					notify_change( 'neutral', descriptor, null );
				}
			} ).always( function () {
				var active_request = active_requests[ descriptor.base_key ];

				if ( active_request && active_request.generation === generation ) {
					delete active_requests[ descriptor.base_key ];
				}
				notify_status_change();
			} );
		}

		/**
		 * Abort one superseded request and invalidate all of its late callbacks.
		 *
		 * @param {string} base_key Exact Resource/window/scale/timezone identity.
		 * @return {void}
		 */
		function abort_request( base_key ) {
			var active_request = active_requests[ base_key ];

			if ( ! active_request ) {
				return;
			}
			delete active_requests[ base_key ];
			if ( active_request.request && 'function' === typeof active_request.request.abort ) {
				active_request.request.abort();
			}
		}

		/**
		 * Mirror the accepted previous/current/next booking-window cache.
		 *
		 * Existing exact matches are retained. Superseded requests are aborted,
		 * evicted windows are removed, and missing Availability reads start without
		 * returning a promise to the booking rendering path.
		 *
		 * @param {Array<Object>} window_entries Accepted booking-window entries.
		 * @return {void}
		 */
		function synchronize( window_entries ) {
			var next_descriptors = Object.create( null );
			var limits = get_limits();

			( Array.isArray( window_entries ) ? window_entries : [] ).slice( 0, limits.maximum_cached_windows ).forEach( function ( window_entry ) {
				var descriptor = build_descriptor( window_entry );

				if ( descriptor ) {
					next_descriptors[ descriptor.base_key ] = descriptor;
				}
			} );

			status_notifications_suspended = true;
			desired_descriptors = next_descriptors;
			Object.keys( active_requests ).forEach( function ( base_key ) {
				if ( ! desired_descriptors[ base_key ] || active_requests[ base_key ].cache_key !== desired_descriptors[ base_key ].cache_key ) {
					abort_request( base_key );
				}
			} );
			Object.keys( cache_entries ).forEach( function ( base_key ) {
				if ( ! desired_descriptors[ base_key ] ) {
					delete cache_entries[ base_key ];
				}
			} );
			Object.keys( desired_descriptors ).forEach( function ( base_key ) {
				request_descriptor( desired_descriptors[ base_key ] );
			} );
			status_notifications_suspended = false;
			render_cached_availability();
			notify_status_change();
		}

		/**
		 * Return loaded DTOs for the currently mirrored bounded windows.
		 *
		 * Cache misses and failures are intentionally omitted. Consumers must render
		 * those windows with a neutral background rather than infer availability.
		 *
		 * @return {Array<Object>} Loaded bounded cache entries.
		 */
		function get_cached_windows() {
			return Object.keys( desired_descriptors ).map( function ( base_key ) {
				return cache_entries[ base_key ] || null;
			} ).filter( function ( cache_entry ) {
				return Boolean( cache_entry );
			} );
		}

		/**
		 * Invalidate every cached Availability projection after a canonical mutation.
		 *
		 * Booking and manual Availability mutations can change intervals without
		 * changing the Resource/window cache identity. Aborting older reads and
		 * clearing both response and revision memory prevents stale intervals from
		 * being reused when the refreshed booking windows synchronize. Desired
		 * descriptors remain intact so the next normal synchronization reloads only
		 * the accepted previous/current/next windows.
		 *
		 * @return {void}
		 */
		function invalidate() {
			status_notifications_suspended = true;
			Object.keys( active_requests ).forEach( abort_request );
			cache_entries = Object.create( null );
			known_revisions = Object.create( null );
			clear_rendered_layers();
			status_notifications_suspended = false;
			on_change( {
				state: 'invalidated',
				cache_key: '',
				window_key: '',
				payload: null,
				cached_windows: []
			} );
			notify_status_change( 'invalidated' );
		}

		/**
		 * Initialize this independent cache owner.
		 *
		 * @return {void}
		 */
		function initialize() {
			is_initialized = true;
		}

		/**
		 * Abort all reads and remove page-lifetime Availability cache data.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! is_initialized ) {
				return;
			}
			status_notifications_suspended = true;
			Object.keys( active_requests ).forEach( abort_request );
			cache_entries = Object.create( null );
			desired_descriptors = Object.create( null );
			known_revisions = Object.create( null );
			clear_rendered_layers();
			status_notifications_suspended = false;
			is_initialized = false;
		}

		return {
			initialize: initialize,
			destroy: destroy,
			invalidate: invalidate,
			synchronize: synchronize,
			get_cached_windows: get_cached_windows
		};
	}

	if (
		window.wpbc_timeline_modules
		&& 'function' === typeof window.wpbc_timeline_modules.register_factory
	) {
		window.wpbc_timeline_modules.register_factory( module_id, create_availability_cache_controller );
	}
}( window ) );
