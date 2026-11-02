/**
 * Pure Timeline time-rows two-dimensional projector.
 *
 * The projector transforms accepted Timeline DTOs into JSON-safe date, booking,
 * Availability, overflow, and accessible-summary records. It does not access
 * the DOM, transport, WordPress globals, or browser-local timezone rules.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window ) {
	'use strict';

	var projection_schema_version = 1;
	var minutes_per_day = 1440;
	var default_visible_lane_limit = 3;
	var availability_precedence = [
		'unknown',
		'blocked_date',
		'blocked_time',
		'unavailable_weekday',
		'seasonal_availability',
		'appointment_buffer',
		'booking_buffer',
		'working_time'
	];

	/**
	 * Return a bounded integer.
	 *
	 * @param {*} value Candidate numeric value.
	 * @param {number} minimum Inclusive minimum.
	 * @param {number} maximum Inclusive maximum.
	 * @param {number} fallback Value used when the candidate is not finite.
	 * @return {number} Bounded integer.
	 */
	function bounded_integer( value, minimum, maximum, fallback ) {
		value = Number( value );
		if ( ! Number.isFinite( value ) ) {
			value = fallback;
		}
		return Math.max( minimum, Math.min( maximum, Math.round( value ) ) );
	}

	/**
	 * Parse one exact offset-qualified RFC3339 timestamp without local timezone APIs.
	 *
	 * `Date.UTC()` is used only as a UTC calendar-to-epoch primitive. The explicit
	 * offset in the source timestamp remains authoritative.
	 *
	 * @param {string} timestamp Offset-qualified timestamp.
	 * @return {Object|null} Exact epoch, wall fields, and offset or null.
	 */
	function parse_exact_timestamp( timestamp ) {
		var matches = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-])(\d{2}):(\d{2})$/.exec( String( timestamp || '' ) );
		var offset_minutes;
		var epoch;

		if ( ! matches ) {
			return null;
		}
		offset_minutes = ( Number( matches[ 9 ] ) * 60 + Number( matches[ 10 ] ) ) * ( '-' === matches[ 8 ] ? -1 : 1 );
		epoch = Math.floor( Date.UTC(
			Number( matches[ 1 ] ),
			Number( matches[ 2 ] ) - 1,
			Number( matches[ 3 ] ),
			Number( matches[ 4 ] ),
			Number( matches[ 5 ] ),
			Number( matches[ 6 ] )
		) / 1000 ) - offset_minutes * 60;

		return {
			value: String( timestamp ),
			epoch: epoch,
			date: matches[ 1 ] + '-' + matches[ 2 ] + '-' + matches[ 3 ],
			hour: Number( matches[ 4 ] ),
			minute: Number( matches[ 5 ] ),
			second: Number( matches[ 6 ] ),
			wall_minute: Number( matches[ 4 ] ) * 60 + Number( matches[ 5 ] ) + Number( matches[ 6 ] ) / 60,
			offset_minutes: offset_minutes
		};
	}

	/**
	 * Sort an object's keys recursively for deterministic cache identities.
	 *
	 * @param {*} value JSON-safe value.
	 * @return {*} Recursively ordered JSON-safe value.
	 */
	function order_json_value( value ) {
		var ordered = {};

		if ( Array.isArray( value ) ) {
			return value.map( order_json_value );
		}
		if ( ! value || 'object' !== typeof value ) {
			return value;
		}
		Object.keys( value ).sort().forEach( function ( key ) {
			ordered[ key ] = order_json_value( value[ key ] );
		} );
		return ordered;
	}

	/**
	 * Return a deterministic compact hash for a JSON-safe identity.
	 *
	 * @param {*} value JSON-safe identity value.
	 * @return {string} Eight-character FNV-1a hash.
	 */
	function hash_identity( value ) {
		var source = JSON.stringify( order_json_value( value ) );
		var hash = 2166136261;
		var index;

		for ( index = 0; index < source.length; index++ ) {
			hash ^= source.charCodeAt( index );
			hash = Math.imul( hash, 16777619 );
		}
		return ( hash >>> 0 ).toString( 16 ).padStart( 8, '0' );
	}

	/**
	 * Return one normalized transition from a server date band.
	 *
	 * @param {Object} transition Server transition DTO.
	 * @return {Object|null} Normalized transition or null.
	 */
	function normalize_transition( transition ) {
		var epoch = Number( transition && transition.epoch );
		var before = parse_exact_timestamp( transition && transition.local_before_at );
		var after = parse_exact_timestamp( transition && transition.local_after_at );

		if ( ! Number.isInteger( epoch ) || ! before || ! after || ( 'gap' !== transition.kind && 'fold' !== transition.kind ) ) {
			return null;
		}
		return {
			transition_id: String( transition.transition_id || 'transition-' + epoch ),
			epoch: epoch,
			kind: transition.kind,
			local_before_at: before.value,
			local_after_at: after.value,
			wall_range_start_minute: bounded_integer( transition.wall_range_start_minute, 0, minutes_per_day, Math.min( before.wall_minute, after.wall_minute ) ),
			wall_range_end_minute: bounded_integer( transition.wall_range_end_minute, 0, minutes_per_day, Math.max( before.wall_minute, after.wall_minute ) ),
			offset_before_seconds: Number( transition.offset_before_seconds || before.offset_minutes * 60 ),
			offset_after_seconds: Number( transition.offset_after_seconds || after.offset_minutes * 60 )
		};
	}

	/**
	 * Collect unique authorized date bands from accepted native windows.
	 *
	 * @param {Array<Object>} booking_windows Accepted native window entries.
	 * @return {Array<Object>} Chronological normalized date bands.
	 */
	function collect_date_bands( booking_windows ) {
		var bands_by_date = Object.create( null );

		( Array.isArray( booking_windows ) ? booking_windows : [] ).forEach( function ( window_entry ) {
			var axis = window_entry && window_entry.payload ? window_entry.payload.axis || {} : {};

			( Array.isArray( axis.date_bands ) ? axis.date_bands : [] ).forEach( function ( date_band ) {
				var start = parse_exact_timestamp( date_band.start_at );
				var end = parse_exact_timestamp( date_band.end_at );
				var date = String( date_band.date || ( start ? start.date : '' ) );
				var transitions;

				if ( ! date || ! start || ! end || end.epoch <= start.epoch ) {
					return;
				}
				transitions = ( Array.isArray( date_band.transitions ) ? date_band.transitions : [] ).map( normalize_transition ).filter( Boolean ).sort( function ( left, right ) {
					return left.epoch - right.epoch;
				} );
				if ( bands_by_date[ date ] ) {
					if (
						bands_by_date[ date ].start_epoch !== start.epoch
						|| bands_by_date[ date ].end_epoch !== end.epoch
						|| hash_identity( bands_by_date[ date ].transitions ) !== hash_identity( transitions )
					) {
						throw new TypeError( 'Conflicting accepted date-band identity.' );
					}
					bands_by_date[ date ].span = Math.max( bands_by_date[ date ].span, Number( date_band.span || 1 ) );
					return;
				}
				if ( ! bands_by_date[ date ] ) {
					bands_by_date[ date ] = {
						date: date,
						start_at: start.value,
						end_at: end.value,
						start_epoch: start.epoch,
						end_epoch: end.epoch,
						elapsed_minutes: Number( date_band.elapsed_minutes || ( end.epoch - start.epoch ) / 60 ),
						wall_minutes: minutes_per_day,
						span: Math.max( 1, Number( date_band.span || 1 ) ),
						transitions: transitions
					};
				}
			} );
		} );

		var ordered_date_bands = Object.keys( bands_by_date ).map( function ( date ) {
			return bands_by_date[ date ];
		} ).sort( function ( left, right ) {
			return left.start_epoch - right.start_epoch;
		} );
		var total_span = ordered_date_bands.reduce( function ( span, date_band ) {
			return span + date_band.span;
		}, 0 );
		var consumed_span = 0;

		return ordered_date_bands.map( function ( date_band, index ) {
			var offset_percent = total_span ? 100 * consumed_span / total_span : 0;
			var width_percent = total_span ? 100 * date_band.span / total_span : 100;
			var normalized_date_band = Object.assign( {}, date_band, {
				index: index,
				offset_percent: Number( offset_percent.toFixed( 8 ) ),
				width_percent: Number( width_percent.toFixed( 8 ) ),
				dst_slices: date_band.transitions.map( function ( transition ) {
					return {
						transition_id: transition.transition_id,
						kind: transition.kind,
						start_minute: transition.wall_range_start_minute,
						end_minute: transition.wall_range_end_minute,
						offset_before_seconds: transition.offset_before_seconds,
						offset_after_seconds: transition.offset_after_seconds
					};
				} )
			} );

			consumed_span += date_band.span;
			return normalized_date_band;
		} );
	}

	/**
	 * Collect unique booking segments for one Resource from overlapping windows.
	 *
	 * @param {Array<Object>} booking_windows Accepted native window entries.
	 * @param {number} resource_id Authorized Resource ID.
	 * @return {Array<Object>} Stable deduplicated segments.
	 */
	function collect_booking_segments( booking_windows, resource_id ) {
		var segment_records_by_identity = Object.create( null );

		( Array.isArray( booking_windows ) ? booking_windows : [] ).forEach( function ( window_entry ) {
			var payload = window_entry && window_entry.payload ? window_entry.payload : {};

			( Array.isArray( payload.segments ) ? payload.segments : [] ).forEach( function ( segment ) {
				var start = parse_exact_timestamp( segment && segment.start );
				var end = parse_exact_timestamp( segment && segment.end );
				var identity;

				if ( Number( segment && segment.resource_id ) !== resource_id || ! start || ! end || end.epoch <= start.epoch ) {
					return;
				}
				identity = [ String( segment.segment_id || '' ), start.epoch, end.epoch, Number( segment.booking_id || 0 ), resource_id ].join( '|' );
				if ( ! segment_records_by_identity[ identity ] ) {
					segment_records_by_identity[ identity ] = {
						segment: segment,
						start_epoch: start.epoch,
						end_epoch: end.epoch
					};
				}
			} );
		} );

		return Object.keys( segment_records_by_identity ).map( function ( identity ) {
			return segment_records_by_identity[ identity ];
		} ).sort( function ( left, right ) {
			return left.start_epoch - right.start_epoch
				|| left.end_epoch - right.end_epoch
				|| String( left.segment.segment_id ).localeCompare( String( right.segment.segment_id ) );
		} ).map( function ( segment_record ) {
			return segment_record.segment;
		} );
	}

	/**
	 * Collect unique Availability intervals and coverage for one Resource.
	 *
	 * @param {Array<Object>} availability_windows Accepted Availability entries.
	 * @param {number} resource_id Authorized Resource ID.
	 * @return {Object} Deduplicated intervals, coverage, unknown records, and sources.
	 */
	function collect_availability( availability_windows, resource_id ) {
		var intervals_by_identity = Object.create( null );
		var coverage_by_identity = Object.create( null );
		var unknown_by_identity = Object.create( null );
		var sources_by_id = Object.create( null );
		var load_states = [];

		( Array.isArray( availability_windows ) ? availability_windows : [] ).forEach( function ( availability_entry ) {
			var payload = availability_entry && availability_entry.payload ? availability_entry.payload : {};

			load_states.push( String( payload.load_state || 'loaded' ) );
			( Array.isArray( payload.sources ) ? payload.sources : [] ).forEach( function ( source ) {
				if ( source && source.id ) {
					sources_by_id[ String( source.id ) ] = source;
				}
			} );
			( Array.isArray( payload.intervals ) ? payload.intervals : [] ).forEach( function ( interval ) {
				var start = parse_exact_timestamp( interval && interval.start_at );
				var end = parse_exact_timestamp( interval && interval.end_at );
				var identity;

				if ( Number( interval && interval.resource_id ) !== resource_id || ! start || ! end || end.epoch <= start.epoch ) {
					return;
				}
				identity = [ String( interval.interval_id || '' ), String( interval.source || '' ), start.epoch, end.epoch, String( interval.related_segment_id || '' ) ].join( '|' );
				if ( ! intervals_by_identity[ identity ] ) {
					intervals_by_identity[ identity ] = interval;
				}
			} );
			( Array.isArray( payload.coverage ) ? payload.coverage : [] ).forEach( function ( coverage ) {
				if ( Number( coverage && coverage.resource_id ) === resource_id && coverage.source ) {
					if ( ! coverage_by_identity[ String( coverage.source ) ] || 'unknown' === coverage.state ) {
						coverage_by_identity[ String( coverage.source ) ] = coverage;
					}
				}
			} );
			( Array.isArray( payload.unknown ) ? payload.unknown : [] ).forEach( function ( unknown ) {
				var identity = [ String( unknown && unknown.source || '' ), String( unknown && unknown.reason || '' ) ].join( '|' );

				if ( Number( unknown && unknown.resource_id ) === resource_id ) {
					unknown_by_identity[ identity ] = unknown;
				}
			} );
		} );

		return {
			load_state: -1 !== load_states.indexOf( 'partial' ) ? 'partial' : ( load_states.length ? 'loaded' : 'loading' ),
			intervals: Object.keys( intervals_by_identity ).map( function ( identity ) {
				return intervals_by_identity[ identity ];
			} ),
			coverage: Object.keys( coverage_by_identity ).sort().map( function ( identity ) {
				return coverage_by_identity[ identity ];
			} ),
			unknown: Object.keys( unknown_by_identity ).sort().map( function ( identity ) {
				return unknown_by_identity[ identity ];
			} ),
			sources: sources_by_id
		};
	}

	/**
	 * Resolve a local timestamp string for an exact split boundary.
	 *
	 * @param {number} epoch Exact boundary epoch.
	 * @param {string} role `start` or `end` fragment boundary role.
	 * @param {Object} interval Parsed source interval.
	 * @param {Object} date_band Server date band.
	 * @return {string} Offset-qualified local timestamp.
	 */
	function resolve_boundary_timestamp( epoch, role, interval, date_band ) {
		var matching_transition = date_band.transitions.filter( function ( transition ) {
			return transition.epoch === epoch;
		} )[ 0 ];

		if ( epoch === interval.start.epoch ) {
			return interval.start.value;
		}
		if ( epoch === interval.end.epoch ) {
			return interval.end.value;
		}
		if ( epoch === date_band.start_epoch ) {
			return date_band.start_at;
		}
		if ( epoch === date_band.end_epoch ) {
			return date_band.end_at;
		}
		if ( matching_transition ) {
			return 'end' === role ? matching_transition.local_before_at : matching_transition.local_after_at;
		}
		return '';
	}

	/**
	 * Split one exact interval at local midnights and DST transitions.
	 *
	 * @param {Object} source Source DTO carrying exact timestamps.
	 * @param {string} start_key Start timestamp field.
	 * @param {string} end_key End timestamp field.
	 * @param {Array<Object>} date_bands Accepted server date bands.
	 * @return {Array<Object>} Chronological exact date fragments.
	 */
	function split_exact_interval( source, start_key, end_key, date_bands ) {
		var start = parse_exact_timestamp( source && source[ start_key ] );
		var end = parse_exact_timestamp( source && source[ end_key ] );
		var interval;
		var fragments = [];

		if ( ! start || ! end || end.epoch <= start.epoch ) {
			return fragments;
		}
		interval = { start: start, end: end };
		date_bands.forEach( function ( date_band ) {
			var visible_start = Math.max( start.epoch, date_band.start_epoch );
			var visible_end = Math.min( end.epoch, date_band.end_epoch );
			var split_points;

			if ( visible_end <= visible_start ) {
				return;
			}
			split_points = [ visible_start ].concat( date_band.transitions.map( function ( transition ) {
				return transition.epoch;
			} ).filter( function ( epoch ) {
				return epoch > visible_start && epoch < visible_end;
			} ) ).concat( [ visible_end ] );
			split_points.forEach( function ( fragment_start_epoch, index ) {
				var fragment_end_epoch = split_points[ index + 1 ];
				var fragment_start_at;
				var fragment_end_at;
				var fragment_start;
				var fragment_end;

				if ( undefined === fragment_end_epoch ) {
					return;
				}
				fragment_start_at = resolve_boundary_timestamp( fragment_start_epoch, 'start', interval, date_band );
				fragment_end_at = resolve_boundary_timestamp( fragment_end_epoch, 'end', interval, date_band );
				fragment_start = parse_exact_timestamp( fragment_start_at );
				fragment_end = parse_exact_timestamp( fragment_end_at );
				if ( ! fragment_start || ! fragment_end ) {
					return;
				}
				fragments.push( {
					date: date_band.date,
					start_at: fragment_start_at,
					end_at: fragment_end_at,
					start_epoch: fragment_start_epoch,
					end_epoch: fragment_end_epoch,
					wall_start_minute: fragment_start_epoch === date_band.start_epoch ? 0 : fragment_start.wall_minute,
					wall_end_minute: fragment_end_epoch === date_band.end_epoch ? minutes_per_day : fragment_end.wall_minute,
					start_offset_minutes: fragment_start.offset_minutes,
					end_offset_minutes: fragment_end.offset_minutes,
					continues_before_date: start.epoch < date_band.start_epoch,
					continues_after_date: end.epoch > date_band.end_epoch,
					continues_before_fragment: fragment_start_epoch > visible_start,
					continues_after_fragment: fragment_end_epoch < visible_end,
					transition_before_id: fragment_start_epoch > visible_start ? ( date_band.transitions.filter( function ( transition ) { return transition.epoch === fragment_start_epoch; } )[ 0 ] || {} ).transition_id || '' : '',
					transition_after_id: fragment_end_epoch < visible_end ? ( date_band.transitions.filter( function ( transition ) { return transition.epoch === fragment_end_epoch; } )[ 0 ] || {} ).transition_id || '' : ''
				} );
			} );
		} );
		return fragments;
	}

	/**
	 * Determine the resolved vertical range.
	 *
	 * Auto begins with exact Working Time when its unavailable outside-ranges can
	 * be inverted safely; otherwise it uses the configured safe range. Timed
	 * bookings and booking/Appointment buffers expand the range. Other accepted
	 * Availability remains in summaries and receives explicit clipping flags.
	 *
	 * @param {Object} range_policy Requested Auto or Full day policy.
	 * @param {Array<Object>} timed_booking_fragments Unclipped booking fragments.
	 * @param {Array<Object>} availability_fragments Unclipped Availability fragments.
	 * @param {Array<Object>} coverage Availability coverage records.
	 * @return {Object} Resolved presentation range.
	 */
	function resolve_vertical_range( range_policy, timed_booking_fragments, availability_fragments, coverage ) {
		var requested_mode = String( range_policy && range_policy.mode );
		var mode = -1 !== [ 'auto', 'custom', 'full_day' ].indexOf( requested_mode ) ? requested_mode : 'auto';
		var start_minute = bounded_integer( range_policy && range_policy.safe_start_minute, 0, minutes_per_day - 60, 480 );
		var end_minute = bounded_integer( range_policy && range_policy.safe_end_minute, start_minute + 60, minutes_per_day, 1080 );
		var working_time_exact = coverage.some( function ( coverage_record ) {
			return 'working_time' === coverage_record.source && 'exact' === coverage_record.state;
		} );
		var working_fragments = availability_fragments.filter( function ( fragment ) {
			return 'working_time' === fragment.source;
		} );

		if ( 'full_day' === mode ) {
			return { mode: mode, start_minute: 0, end_minute: minutes_per_day, span_minutes: minutes_per_day };
		}
		if ( 'custom' === mode ) {
			start_minute = bounded_integer( range_policy && range_policy.start_minute, 0, minutes_per_day - 60, 0 );
			end_minute = bounded_integer( range_policy && range_policy.end_minute, start_minute + 60, minutes_per_day, minutes_per_day );

			return { mode: mode, start_minute: start_minute, end_minute: end_minute, span_minutes: end_minute - start_minute };
		}
		if ( working_time_exact && working_fragments.length ) {
			working_fragments.forEach( function ( fragment ) {
				if ( 0 === fragment.wall_start_minute ) {
					start_minute = Math.max( start_minute, fragment.wall_end_minute );
				}
				if ( minutes_per_day === fragment.wall_end_minute ) {
					end_minute = Math.min( end_minute, fragment.wall_start_minute );
				}
			} );
		}
		timed_booking_fragments.concat( availability_fragments.filter( function ( fragment ) {
			return 'booking_buffer' === fragment.source || 'appointment_buffer' === fragment.source;
		} ) ).forEach( function ( fragment ) {
			start_minute = Math.min( start_minute, Math.floor( fragment.wall_start_minute / 60 ) * 60 );
			end_minute = Math.max( end_minute, Math.ceil( fragment.wall_end_minute / 60 ) * 60 );
		} );
		start_minute = Math.max( 0, Math.min( minutes_per_day - 60, Math.floor( start_minute / 60 ) * 60 ) );
		end_minute = Math.max( start_minute + 60, Math.min( minutes_per_day, Math.ceil( end_minute / 60 ) * 60 ) );

		return { mode: mode, start_minute: start_minute, end_minute: end_minute, span_minutes: end_minute - start_minute };
	}

	/**
	 * Apply vertical clipping and percentage geometry to one wall-time fragment.
	 *
	 * @param {Object} fragment Unclipped wall-time fragment.
	 * @param {Object} range Resolved vertical range.
	 * @return {Object} Fragment with clipping and vertical geometry.
	 */
	function apply_vertical_range( fragment, range ) {
		var visible_start = Math.max( range.start_minute, fragment.wall_start_minute );
		var visible_end = Math.min( range.end_minute, fragment.wall_end_minute );
		var is_outside = visible_end <= visible_start;
		var span = Math.max( 1, range.span_minutes );

		return Object.assign( {}, fragment, {
			is_clipped_above: fragment.wall_start_minute < range.start_minute,
			is_clipped_below: fragment.wall_end_minute > range.end_minute,
			is_outside_range: is_outside,
			visible_wall_start_minute: is_outside ? null : visible_start,
			visible_wall_end_minute: is_outside ? null : visible_end,
			top_percent: is_outside ? null : Number( ( 100 * ( visible_start - range.start_minute ) / span ).toFixed( 8 ) ),
			height_percent: is_outside ? null : Number( ( 100 * ( visible_end - visible_start ) / span ).toFixed( 8 ) )
		} );
	}

	/**
	 * Map accepted booking segments into full-day and timed fragments.
	 *
	 * @param {Array<Object>} segments Exact authorized booking segments.
	 * @param {Array<Object>} date_bands Accepted date bands.
	 * @return {Object} Full-day and timed fragments before range and lane work.
	 */
	function project_booking_fragments( segments, date_bands ) {
		var full_day_fragments = [];
		var timed_fragments = [];
		var loaded_start = date_bands.length ? date_bands[ 0 ].start_epoch : 0;
		var loaded_end = date_bands.length ? date_bands[ date_bands.length - 1 ].end_epoch : 0;

		segments.forEach( function ( segment ) {
			var source_start = parse_exact_timestamp( segment.start );
			var source_end = parse_exact_timestamp( segment.end );
			var split_fragments = split_exact_interval( segment, 'start', 'end', date_bands );

			if ( segment.is_full_day ) {
				split_fragments = split_fragments.reduce( function ( fragments_by_date, fragment ) {
					var previous = fragments_by_date[ fragments_by_date.length - 1 ];

					if ( previous && previous.date === fragment.date ) {
						previous.end_at = fragment.end_at;
						previous.end_epoch = fragment.end_epoch;
						previous.wall_end_minute = fragment.wall_end_minute;
						previous.end_offset_minutes = fragment.end_offset_minutes;
						previous.continues_after_date = fragment.continues_after_date;
						previous.transition_after_id = fragment.transition_after_id;
						return fragments_by_date;
					}
					fragments_by_date.push( Object.assign( {}, fragment ) );
					return fragments_by_date;
				}, [] );
			}

			split_fragments.forEach( function ( fragment, index ) {
				var common = {
					fragment_id: [ String( segment.segment_id ), fragment.date, fragment.start_epoch, fragment.end_epoch ].join( '|' ),
					source_segment_id: String( segment.segment_id || '' ),
					series_key: String( segment.series_key || '' ),
					booking_id: Number( segment.booking_id || 0 ),
					resource_id: Number( segment.resource_id || 0 ),
					date: fragment.date,
					start_at: fragment.start_at,
					end_at: fragment.end_at,
					start_epoch: fragment.start_epoch,
					end_epoch: fragment.end_epoch,
					status: String( segment.status || '' ),
					label: String( segment.label || '' ),
					initials: String( segment.initials || '' ),
					schedule_label: String( segment.schedule_label || '' ),
					selection_aria_label: String( segment.selection_aria_label || segment.aria_label || '' ),
					information_aria_label: String( segment.information_aria_label || '' ),
					continues_before_date: fragment.continues_before_date,
					continues_after_date: fragment.continues_after_date,
					continues_before_loaded_window: Boolean( source_start && source_start.epoch < loaded_start ) || Boolean( segment.is_clipped_start && 0 === index ),
					continues_after_loaded_window: Boolean( source_end && source_end.epoch > loaded_end ) || Boolean( segment.is_clipped_end && index === split_fragments.length - 1 )
				};

				if ( segment.is_full_day ) {
					full_day_fragments.push( common );
					return;
				}
				timed_fragments.push( Object.assign( common, fragment, {
					occurrence_id: [ fragment.date, fragment.wall_start_minute, fragment.start_offset_minutes, fragment.start_epoch ].join( '|' )
				} ) );
			} );
		} );
		return { full_day_fragments: full_day_fragments, timed_fragments: timed_fragments };
	}

	/**
	 * Assign deterministic full-day stack indexes per date.
	 *
	 * @param {Array<Object>} full_day_fragments Full-day booking fragments.
	 * @return {Array<Object>} Sorted stack records.
	 */
	function assign_full_day_stacks( full_day_fragments ) {
		var groups_by_segment = Object.create( null );
		var lane_end_epochs = [];
		var date_stack_counts = Object.create( null );

		full_day_fragments.forEach( function ( fragment ) {
			var group_key = [ fragment.source_segment_id, fragment.booking_id, fragment.resource_id ].join( '|' );

			if ( ! groups_by_segment[ group_key ] ) {
				groups_by_segment[ group_key ] = {
					group_key: group_key,
					source_segment_id: fragment.source_segment_id,
					start_epoch: fragment.start_epoch,
					end_epoch: fragment.end_epoch,
					fragments: []
				};
			}
			groups_by_segment[ group_key ].start_epoch = Math.min( groups_by_segment[ group_key ].start_epoch, fragment.start_epoch );
			groups_by_segment[ group_key ].end_epoch = Math.max( groups_by_segment[ group_key ].end_epoch, fragment.end_epoch );
			groups_by_segment[ group_key ].fragments.push( fragment );
		} );

		Object.keys( groups_by_segment ).map( function ( group_key ) {
			return groups_by_segment[ group_key ];
		} ).sort( function ( left, right ) {
			return left.start_epoch - right.start_epoch
				|| right.end_epoch - left.end_epoch
				|| left.source_segment_id.localeCompare( right.source_segment_id );
		} ).forEach( function ( group ) {
			var lane_index = lane_end_epochs.findIndex( function ( lane_end_epoch ) {
				return lane_end_epoch <= group.start_epoch;
			} );

			if ( -1 === lane_index ) {
				lane_index = lane_end_epochs.length;
			}
			lane_end_epochs[ lane_index ] = group.end_epoch;
			group.fragments.forEach( function ( fragment ) {
				fragment.stack_index = lane_index;
				date_stack_counts[ fragment.date ] = Math.max( date_stack_counts[ fragment.date ] || 0, lane_index + 1 );
			} );
		} );

		return full_day_fragments.sort( function ( left, right ) {
			return left.date.localeCompare( right.date ) || left.start_epoch - right.start_epoch || left.end_epoch - right.end_epoch || left.source_segment_id.localeCompare( right.source_segment_id );
		} ).map( function ( fragment ) {
			return Object.assign( {}, fragment, { stack_count: date_stack_counts[ fragment.date ] } );
		} );
	}

	/**
	 * Assign deterministic overlap lanes and construct bounded overflow groups.
	 *
	 * @param {Array<Object>} timed_fragments Range-projected timed fragments.
	 * @param {number} visible_lane_limit Maximum directly visible lanes.
	 * @return {Object} Lane-assigned fragments and overflow groups.
	 */
	function assign_timed_lanes( timed_fragments, visible_lane_limit ) {
		var dates = Object.create( null );
		var overflow_groups = [];

		timed_fragments.forEach( function ( fragment ) {
			if ( ! dates[ fragment.date ] ) {
				dates[ fragment.date ] = [];
			}
			dates[ fragment.date ].push( fragment );
		} );
		Object.keys( dates ).sort().forEach( function ( date ) {
			var lane_ends = [];
			var cluster_fragments = [];
			var cluster_end = -1;
			var cluster_index = 0;
			var flush_cluster;

			flush_cluster = function () {
				var hidden = cluster_fragments.filter( function ( fragment ) { return fragment.lane_index >= visible_lane_limit; } );
				var cluster_lane_count = Math.min( visible_lane_limit, Math.max( 1, lane_ends.length ) );

				cluster_fragments.forEach( function ( fragment ) {
					fragment.lane_count = cluster_lane_count;
				} );

				if ( hidden.length ) {
					overflow_groups.push( {
						overflow_id: 'overflow|' + date + '|' + cluster_index,
						date: date,
						start_wall_minute: Math.min.apply( null, cluster_fragments.map( function ( fragment ) { return fragment.visible_wall_start_minute; } ) ),
						end_wall_minute: Math.max.apply( null, cluster_fragments.map( function ( fragment ) { return fragment.visible_wall_end_minute; } ) ),
						hidden_count: hidden.length,
						fragment_ids: hidden.map( function ( fragment ) { return fragment.fragment_id; } ),
						booking_ids: hidden.map( function ( fragment ) { return fragment.booking_id; } ),
						label: '+' + hidden.length + ' more'
					} );
				}
				cluster_fragments = [];
				cluster_end = -1;
				cluster_index += 1;
			};

			dates[ date ].sort( function ( left, right ) {
				return left.visible_wall_start_minute - right.visible_wall_start_minute
					|| left.start_epoch - right.start_epoch
					|| left.visible_wall_end_minute - right.visible_wall_end_minute
					|| left.source_segment_id.localeCompare( right.source_segment_id );
			} ).forEach( function ( fragment ) {
				var lane_index = -1;
				var lane_candidate;

				for ( lane_candidate = 0; lane_candidate < lane_ends.length; lane_candidate++ ) {
					if ( lane_ends[ lane_candidate ] <= fragment.visible_wall_start_minute ) {
						lane_index = lane_candidate;
						break;
					}
				}

				if ( cluster_fragments.length && fragment.visible_wall_start_minute >= cluster_end ) {
					flush_cluster();
					lane_ends = [];
				}
				if ( -1 === lane_index ) {
					lane_index = lane_ends.length;
				}
				lane_ends[ lane_index ] = fragment.visible_wall_end_minute;
				fragment.lane_index = lane_index;
				fragment.is_overflowed = lane_index >= visible_lane_limit;
				cluster_fragments.push( fragment );
				cluster_end = Math.max( cluster_end, fragment.visible_wall_end_minute );
			} );
			if ( cluster_fragments.length ) {
				flush_cluster();
			}
		} );

		return {
			fragments: timed_fragments.sort( function ( left, right ) {
				return left.date.localeCompare( right.date ) || left.visible_wall_start_minute - right.visible_wall_start_minute || left.start_epoch - right.start_epoch || left.source_segment_id.localeCompare( right.source_segment_id );
			} ),
			overflow_groups: overflow_groups
		};
	}

	/**
	 * Split Availability intervals into exact date/DST fragments.
	 *
	 * @param {Array<Object>} intervals Accepted Availability intervals.
	 * @param {Array<Object>} date_bands Accepted date bands.
	 * @return {Array<Object>} Unclipped Availability fragments.
	 */
	function project_availability_fragments( intervals, date_bands ) {
		var fragments = [];

		intervals.forEach( function ( interval ) {
			split_exact_interval( interval, 'start_at', 'end_at', date_bands ).forEach( function ( fragment ) {
				fragments.push( Object.assign( {}, fragment, {
					interval_id: String( interval.interval_id || '' ),
					source: String( interval.source || '' ),
					source_label: String( interval.source_label || '' ),
					related_segment_id: String( interval.related_segment_id || '' )
				} ) );
			} );
		} );
		return fragments;
	}

	/**
	 * Return the precedence rank for one Availability source.
	 *
	 * @param {string} source Availability source ID.
	 * @return {number} Lower values win.
	 */
	function get_availability_rank( source ) {
		var index = availability_precedence.indexOf( source );
		return -1 === index ? availability_precedence.length : index;
	}

	/**
	 * Combine Availability fragments into non-overlapping visual slices.
	 *
	 * @param {Array<Object>} fragments Exact Availability fragments.
	 * @param {Array<Object>} date_bands Accepted date bands.
	 * @param {Object} range Resolved vertical range.
	 * @param {string} availability_state Loaded, partial, failed, or loading.
	 * @param {Array<Object>} unknown_records Source-specific unknown coverage.
	 * @param {Object} source_definitions Authorized source definitions keyed by ID.
	 * @return {Array<Object>} Deterministic precedence-combined slices.
	 */
	function combine_availability_slices( fragments, date_bands, range, availability_state, unknown_records, source_definitions ) {
		var slices = [];
		var has_global_unknown = 'loading' === availability_state || 'failed' === availability_state;
		var fragments_by_date = Object.create( null );

		fragments.forEach( function ( fragment ) {
			if ( ! fragments_by_date[ fragment.date ] ) {
				fragments_by_date[ fragment.date ] = [];
			}
			fragments_by_date[ fragment.date ].push( fragment );
		} );

		date_bands.forEach( function ( date_band ) {
			var date_fragments = fragments_by_date[ date_band.date ] || [];
			var boundaries = [ range.start_minute, range.end_minute ];
			var boundaries_by_minute = Object.create( null );
			var unknown_source_ids = unknown_records.map( function ( record ) {
				return String( record.source || 'unknown' );
			} );
			var unknown_sources = has_global_unknown || unknown_source_ids.length ? [ 'unknown' ].concat( unknown_source_ids ) : [];

			date_fragments.forEach( function ( fragment ) {
				boundaries.push( Math.max( range.start_minute, Math.min( range.end_minute, fragment.wall_start_minute ) ) );
				boundaries.push( Math.max( range.start_minute, Math.min( range.end_minute, fragment.wall_end_minute ) ) );
			} );
			boundaries.forEach( function ( boundary ) {
				boundaries_by_minute[ String( boundary ) ] = boundary;
			} );
			boundaries = Object.keys( boundaries_by_minute ).map( function ( boundary_key ) {
				return boundaries_by_minute[ boundary_key ];
			} ).sort( function ( left, right ) { return left - right; } );
			boundaries.forEach( function ( start_minute, index ) {
				var end_minute = boundaries[ index + 1 ];
				var contributors;
				var source_ids;
				var winner;

				if ( undefined === end_minute || end_minute <= start_minute ) {
					return;
				}
				contributors = date_fragments.filter( function ( fragment ) {
					return fragment.wall_start_minute < end_minute && fragment.wall_end_minute > start_minute;
				} );
				source_ids = contributors.map( function ( fragment ) { return fragment.source; } ).concat( unknown_sources ).filter( function ( source, source_index, all_sources ) {
					return all_sources.indexOf( source ) === source_index;
				} ).sort( function ( left, right ) {
					return get_availability_rank( left ) - get_availability_rank( right ) || left.localeCompare( right );
				} );
				if ( ! source_ids.length ) {
					return;
				}
				winner = source_ids[ 0 ];
				slices.push( {
					slice_id: [ 'availability', date_band.date, start_minute, end_minute, winner ].join( '|' ),
					date: date_band.date,
					start_minute: start_minute,
					end_minute: end_minute,
					top_percent: Number( ( 100 * ( start_minute - range.start_minute ) / range.span_minutes ).toFixed( 8 ) ),
					height_percent: Number( ( 100 * ( end_minute - start_minute ) / range.span_minutes ).toFixed( 8 ) ),
					state: -1 !== source_ids.indexOf( 'unknown' ) || unknown_sources.length ? availability_state : 'exact',
					winning_source: winner,
					source_ids: source_ids,
					source_labels: source_ids.map( function ( source_id ) {
						var contributor = contributors.filter( function ( fragment ) { return fragment.source === source_id; } )[ 0 ];

						if ( 'unknown' === source_id ) {
							return 'Availability unknown';
						}
						return String( source_definitions[ source_id ] && source_definitions[ source_id ].label || contributor && contributor.source_label || source_id );
					} ),
					interval_ids: contributors.map( function ( fragment ) { return fragment.interval_id; } ).filter( function ( interval_id, interval_index, all_ids ) { return all_ids.indexOf( interval_id ) === interval_index; } ).sort(),
					related_segment_ids: contributors.map( function ( fragment ) { return fragment.related_segment_id; } ).filter( function ( segment_id, segment_index, all_ids ) { return segment_id && all_ids.indexOf( segment_id ) === segment_index; } ).sort()
				} );
			} );
		} );

		return slices;
	}

	/**
	 * Build chronological, presentation-neutral accessible summary records.
	 *
	 * @param {Array<Object>} full_day_fragments Full-day fragments.
	 * @param {Array<Object>} timed_fragments Timed fragments, including overflow.
	 * @param {Array<Object>} availability_slices Combined Availability slices.
	 * @param {Array<Object>} clipped_availability_fragments Explicit clipped source fragments.
	 * @param {string} availability_state Availability load state.
	 * @return {Array<Object>} Chronological summary records.
	 */
	function build_summary_records( full_day_fragments, timed_fragments, availability_slices, clipped_availability_fragments, availability_state ) {
		var records = [];

		full_day_fragments.forEach( function ( fragment ) {
			records.push( {
				summary_id: 'summary|' + fragment.fragment_id,
				kind: 'full_day_booking',
				date: fragment.date,
				start_minute: 0,
				end_minute: minutes_per_day,
				booking_id: fragment.booking_id,
				fragment_id: fragment.fragment_id,
				label: fragment.label,
				source_ids: []
			} );
		} );
		timed_fragments.forEach( function ( fragment ) {
			records.push( {
				summary_id: 'summary|' + fragment.fragment_id,
				kind: 'timed_booking',
				date: fragment.date,
				start_minute: fragment.wall_start_minute,
				end_minute: fragment.wall_end_minute,
				booking_id: fragment.booking_id,
				fragment_id: fragment.fragment_id,
				label: fragment.label,
				source_ids: []
			} );
		} );
		availability_slices.forEach( function ( slice ) {
			records.push( {
				summary_id: 'summary|' + slice.slice_id,
				kind: 'availability',
				date: slice.date,
				start_minute: slice.start_minute,
				end_minute: slice.end_minute,
				booking_id: 0,
				fragment_id: '',
				label: slice.source_labels.join( ', ' ),
				source_ids: slice.source_ids.slice()
			} );
		} );
		clipped_availability_fragments.forEach( function ( fragment ) {
			records.push( {
				summary_id: 'summary|clipped|' + fragment.interval_id + '|' + fragment.date + '|' + fragment.start_epoch,
				kind: 'availability_clipped',
				date: fragment.date,
				start_minute: fragment.wall_start_minute,
				end_minute: fragment.wall_end_minute,
				booking_id: 0,
				fragment_id: '',
				label: fragment.source_label || fragment.source,
				source_ids: [ fragment.source ]
			} );
		} );
		if ( 'loaded' !== availability_state ) {
			records.push( {
				summary_id: 'summary|availability-state|' + availability_state,
				kind: 'availability_state',
				date: '',
				start_minute: 0,
				end_minute: 0,
				booking_id: 0,
				fragment_id: '',
				label: availability_state,
				source_ids: [ 'unknown' ]
			} );
		}
		return records.sort( function ( left, right ) {
			return left.date.localeCompare( right.date ) || left.start_minute - right.start_minute || left.end_minute - right.end_minute || left.kind.localeCompare( right.kind ) || left.summary_id.localeCompare( right.summary_id );
		} );
	}

	/**
	 * Build the complete accepted-identity cache key.
	 *
	 * @param {Object} input Projector input.
	 * @param {Array<Object>} date_bands Normalized date bands.
	 * @param {Object} range_policy Requested range policy.
	 * @return {string} Stable projection cache key.
	 */
	function build_projection_cache_key( input, date_bands, range_policy ) {
		var window_identity = ( Array.isArray( input.booking_windows ) ? input.booking_windows : [] ).map( function ( window_entry ) {
			var payload = window_entry && window_entry.payload ? window_entry.payload : {};
			var timeline_window = payload.window || {};
			return {
				key: String( window_entry && window_entry.key || '' ),
				start_at: String( timeline_window.start_at || '' ),
				end_at: String( timeline_window.end_at || '' ),
				cell_minutes: Number( timeline_window.cell_minutes || 0 ),
				view: String( timeline_window.view || '' )
			};
		} );
		var identity = {
			schema_version: projection_schema_version,
			resource_id: Number( input.resource_id ),
			resource_fingerprint: String( input.resource_fingerprint || '' ),
			timezone: String( input.timezone || '' ),
			booking_generation: Number( input.booking_generation || 0 ),
			availability_generation: Number( input.availability_generation || 0 ),
			availability_state: String( input.availability_state || '' ),
			windows: window_identity,
			axis: date_bands.map( function ( date_band ) {
				return [ date_band.date, date_band.start_epoch, date_band.end_epoch, date_band.span, date_band.transitions.map( function ( transition ) { return transition.transition_id; } ) ];
			} ),
			range_policy: range_policy,
			visible_lane_limit: Number( input.visible_lane_limit || default_visible_lane_limit )
		};

		return 'time-rows-v' + projection_schema_version + '-r' + Number( input.resource_id ) + '-' + hash_identity( identity );
	}

	/**
	 * Build a cache key directly from accepted projector input.
	 *
	 * @param {Object} input Accepted booking, Availability, identity, and policy data.
	 * @return {string} Stable projection cache key.
	 */
	function get_projection_cache_key( input ) {
		var date_bands = collect_date_bands( input && input.booking_windows );
		var range_policy = Object.assign( {
			mode: 'auto',
			safe_start_minute: 480,
			safe_end_minute: 1080
		}, input && input.range_policy || {} );

		if ( ! date_bands.length ) {
			return '';
		}
		return build_projection_cache_key( input, date_bands, range_policy );
	}

	/**
	 * Project one authorized Resource from accepted native Timeline data.
	 *
	 * @param {Object} input Accepted booking, Availability, identity, and policy data.
	 * @return {Object} JSON-safe normalized time-rows projection DTO.
	 */
	function project( input ) {
		var resource_id = Number( input && input.resource_id );
		var date_bands;
		var segments;
		var availability;
		var availability_state;
		var booking_projection;
		var availability_fragments;
		var range_policy;
		var range;
		var timed_fragments;
		var lane_projection;
		var full_day_fragments;
		var availability_slices;
		var cache_key;

		if ( ! Number.isInteger( resource_id ) || 1 > resource_id ) {
			throw new TypeError( 'A positive authorized Resource ID is required.' );
		}
		date_bands = collect_date_bands( input.booking_windows );
		if ( ! date_bands.length ) {
			throw new TypeError( 'At least one exact server date band is required.' );
		}
		segments = collect_booking_segments( input.booking_windows, resource_id );
		availability = collect_availability( input.availability_windows, resource_id );
		availability_state = String( input.availability_state || availability.load_state || 'loading' );
		if ( -1 === [ 'loaded', 'partial', 'failed', 'loading' ].indexOf( availability_state ) ) {
			availability_state = 'loading';
		}
		booking_projection = project_booking_fragments( segments, date_bands );
		availability_fragments = project_availability_fragments( availability.intervals, date_bands );
		range_policy = Object.assign( {
			mode: 'auto',
			safe_start_minute: 480,
			safe_end_minute: 1080
		}, input.range_policy || {} );
		range = resolve_vertical_range( range_policy, booking_projection.timed_fragments, availability_fragments, availability.coverage );
		timed_fragments = booking_projection.timed_fragments.map( function ( fragment ) {
			return apply_vertical_range( fragment, range );
		} ).filter( function ( fragment ) {
			return ! fragment.is_outside_range;
		} );
		lane_projection = assign_timed_lanes( timed_fragments, bounded_integer( input.visible_lane_limit, 1, 10, default_visible_lane_limit ) );
		full_day_fragments = assign_full_day_stacks( booking_projection.full_day_fragments );
		availability_fragments = availability_fragments.map( function ( fragment ) {
			return apply_vertical_range( fragment, range );
		} );
		availability_slices = combine_availability_slices( availability_fragments, date_bands, range, availability_state, availability.unknown, availability.sources );
		cache_key = build_projection_cache_key( input, date_bands, range_policy );

		return {
			schema_version: projection_schema_version,
			cache_key: cache_key,
			resource_id: resource_id,
			timezone: String( input.timezone || '' ),
			identity: {
				resource_fingerprint: String( input.resource_fingerprint || '' ),
				booking_generation: Number( input.booking_generation || 0 ),
				availability_generation: Number( input.availability_generation || 0 )
			},
			window: {
				start_at: date_bands[ 0 ].start_at,
				end_at: date_bands[ date_bands.length - 1 ].end_at,
				start_epoch: date_bands[ 0 ].start_epoch,
				end_epoch: date_bands[ date_bands.length - 1 ].end_epoch
			},
			range: range,
			dates: date_bands,
			full_day_fragments: full_day_fragments,
			timed_fragments: lane_projection.fragments,
			overflow_groups: lane_projection.overflow_groups,
			availability: {
				state: availability_state,
				sources: Object.keys( availability.sources ).sort().map( function ( source_id ) { return availability.sources[ source_id ]; } ),
				coverage: availability.coverage,
				unknown: availability.unknown,
				slices: availability_slices,
				clipped_fragments: availability_fragments.filter( function ( fragment ) {
					return fragment.is_clipped_above || fragment.is_clipped_below || fragment.is_outside_range;
				} )
			},
			summary: build_summary_records(
				full_day_fragments,
				lane_projection.fragments,
				availability_slices,
				availability_fragments.filter( function ( fragment ) {
					return fragment.is_clipped_above || fragment.is_clipped_below || fragment.is_outside_range;
				} ),
				availability_state
			)
		};
	}

	window.wpbc_timeline_time_rows_projector = Object.freeze( {
		schema_version: projection_schema_version,
		availability_precedence: availability_precedence.slice(),
		parse_exact_timestamp: parse_exact_timestamp,
		get_projection_cache_key: get_projection_cache_key,
		build_projection_cache_key: build_projection_cache_key,
		project: project
	} );
}( window ) );
