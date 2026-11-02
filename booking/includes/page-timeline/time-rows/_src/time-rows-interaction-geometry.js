/**
 * Pure Timeline time-row interaction geometry.
 *
 * The kernel converts explicit accepted server-axis DTOs and logical
 * coordinates into exact, gap, or fold results. It owns no DOM, transport,
 * mutation, browser-timezone, or retained interaction state.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window ) {
	'use strict';

	var schema_version = 1;
	var minutes_per_day = 1440;
	var seconds_per_minute = 60;
	var minimum_zoom_percent = 30;
	var maximum_zoom_percent = 300;
	/* Browser layout may report the same shared edge with opposing subpixel rounding. */
	var column_boundary_epsilon_px = 0.5;

	/**
	 * Recursively order JSON-safe values for stable identities.
	 *
	 * @param {*} value Candidate value.
	 * @return {*} Ordered value.
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
	 * Hash one JSON-safe identity with deterministic FNV-1a.
	 *
	 * @param {*} value JSON-safe identity.
	 * @return {string} Eight-character hash.
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
	 * Confirm one Gregorian calendar date without a browser timezone.
	 *
	 * @param {number} year Four-digit year.
	 * @param {number} month One-based month.
	 * @param {number} day One-based day.
	 * @return {boolean} Whether the date exists.
	 */
	function is_valid_calendar_date( year, month, day ) {
		var days_by_month = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
		var is_leap_year;

		if ( ! Number.isInteger( year ) || ! Number.isInteger( month ) || ! Number.isInteger( day ) || month < 1 || month > 12 || day < 1 ) {
			return false;
		}
		is_leap_year = 0 === year % 4 && ( 0 !== year % 100 || 0 === year % 400 );
		if ( is_leap_year ) {
			days_by_month[ 1 ] = 29;
		}

		return day <= days_by_month[ month - 1 ];
	}

	/**
	 * Parse an offset-qualified RFC3339 instant without local timezone APIs.
	 *
	 * Date.UTC is used only as an explicit UTC calendar-to-epoch primitive.
	 *
	 * @param {*} timestamp Candidate timestamp.
	 * @return {Object|null} Exact parsed value or null.
	 */
	function parse_exact_timestamp( timestamp ) {
		var matches = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-])(\d{2}):(\d{2})$/.exec( String( timestamp || '' ) );
		var offset_minutes;
		var wall_epoch;
		var year;
		var month;
		var day;
		var hour;
		var minute;
		var second;

		if ( ! matches ) {
			return null;
		}
		year = Number( matches[ 1 ] );
		month = Number( matches[ 2 ] );
		day = Number( matches[ 3 ] );
		hour = Number( matches[ 4 ] );
		minute = Number( matches[ 5 ] );
		second = Number( matches[ 6 ] );
		if (
			! is_valid_calendar_date( year, month, day )
			|| hour > 23
			|| minute > 59
			|| 0 !== second
			|| ( matches[ 7 ] && /[1-9]/.test( matches[ 7 ] ) )
			|| Number( matches[ 9 ] ) > 23
			|| Number( matches[ 10 ] ) > 59
		) {
			return null;
		}
		offset_minutes = ( Number( matches[ 9 ] ) * 60 + Number( matches[ 10 ] ) ) * ( '-' === matches[ 8 ] ? -1 : 1 );
		wall_epoch = Math.floor( Date.UTC(
			year,
			month - 1,
			day,
			hour,
			minute,
			second
		) / 1000 );

		return {
			at: String( timestamp ),
			epoch: wall_epoch - offset_minutes * seconds_per_minute,
			date: matches[ 1 ] + '-' + matches[ 2 ] + '-' + matches[ 3 ],
			wall_minute: hour * 60 + minute,
			offset_minutes: offset_minutes
		};
	}

	/**
	 * Convert an explicit wall minute and offset into an epoch.
	 *
	 * Date.UTC is used only as an explicit UTC calendar-to-epoch primitive.
	 *
	 * @param {string} date Site-local date.
	 * @param {number} wall_minute Wall-clock minute, including 1440 as next midnight.
	 * @param {number} offset_seconds Signed UTC offset seconds.
	 * @return {number} Exact epoch seconds.
	 */
	function wall_minute_to_epoch( date, wall_minute, offset_seconds ) {
		var date_parts = date.split( '-' ).map( Number );
		var hour = Math.floor( wall_minute / 60 );
		var minute = wall_minute % 60;

		return Math.floor( Date.UTC( date_parts[ 0 ], date_parts[ 1 ] - 1, date_parts[ 2 ], hour, minute, 0 ) / 1000 ) - offset_seconds;
	}

	/**
	 * Return a safe invalid-result DTO.
	 *
	 * @param {string} code Stable failure code.
	 * @return {Object} Invalid result.
	 */
	function invalid_result( code ) {
		return {
			schema_version: schema_version,
			status: 'invalid',
			code: String( code || 'geometry_invalid' )
		};
	}

	/**
	 * Normalize one server transition.
	 *
	 * @param {*} transition Candidate transition.
	 * @return {Object|null} Normalized transition or null.
	 */
	function normalize_transition( transition ) {
		var kind = String( transition && transition.kind || '' );
		var epoch = Number( transition && transition.epoch );
		var wall_start = Number( transition && transition.wall_range_start_minute );
		var wall_end = Number( transition && transition.wall_range_end_minute );
		var offset_before = Number( transition && transition.offset_before_seconds );
		var offset_after = Number( transition && transition.offset_after_seconds );
		var range_seconds;

		if (
			( 'gap' !== kind && 'fold' !== kind )
			|| ! Number.isInteger( epoch )
			|| ! Number.isInteger( wall_start )
			|| ! Number.isInteger( wall_end )
			|| wall_start < 0
			|| wall_end > minutes_per_day
			|| wall_start >= wall_end
			|| ! Number.isInteger( offset_before )
			|| ! Number.isInteger( offset_after )
			|| 0 !== offset_before % seconds_per_minute
			|| 0 !== offset_after % seconds_per_minute
		) {
			return null;
		}
		range_seconds = ( wall_end - wall_start ) * seconds_per_minute;
		if (
			( 'gap' === kind && offset_after - offset_before !== range_seconds )
			|| ( 'fold' === kind && offset_before - offset_after !== range_seconds )
		) {
			return null;
		}

		return {
			transition_id: String( transition.transition_id || 'transition-' + epoch ),
			epoch: epoch,
			kind: kind,
			wall_range_start_minute: wall_start,
			wall_range_end_minute: wall_end,
			offset_before_seconds: offset_before,
			offset_after_seconds: offset_after
		};
	}

	/**
	 * Normalize one exact server date band.
	 *
	 * @param {*} date_band Candidate date band.
	 * @return {Object|null} Normalized date band or null.
	 */
	function normalize_date_band( date_band ) {
		var start = parse_exact_timestamp( date_band && date_band.start_at );
		var end = parse_exact_timestamp( date_band && date_band.end_at );
		var date = String( date_band && date_band.date || ( start ? start.date : '' ) );
		var supplied_start_epoch = Number( date_band && date_band.start_epoch );
		var supplied_end_epoch = Number( date_band && date_band.end_epoch );
		var supplied_elapsed_minutes = Number( date_band && date_band.elapsed_minutes );
		var supplied_wall_minutes = Number( date_band && date_band.wall_minutes );
		var transitions;
		var transition_invalid = false;
		var expected_start_offset_seconds;

		if (
			! start
			|| ! end
			|| ! date
			|| start.date !== date
			|| start.epoch >= end.epoch
			|| ( Number.isFinite( supplied_start_epoch ) && supplied_start_epoch !== start.epoch )
			|| ( Number.isFinite( supplied_end_epoch ) && supplied_end_epoch !== end.epoch )
			|| ( Number.isFinite( supplied_elapsed_minutes ) && supplied_elapsed_minutes !== ( end.epoch - start.epoch ) / seconds_per_minute )
			|| ( Number.isFinite( supplied_wall_minutes ) && minutes_per_day !== supplied_wall_minutes )
		) {
			return null;
		}
		transitions = ( Array.isArray( date_band.transitions ) ? date_band.transitions : [] )
			.map( normalize_transition )
			.filter( Boolean )
			.sort( function ( left, right ) {
				return left.epoch - right.epoch;
			} );
		if ( transitions.length !== ( Array.isArray( date_band.transitions ) ? date_band.transitions.length : 0 ) ) {
			return null;
		}
		transitions.forEach( function ( transition, index ) {
			var before_wall_minute = 'gap' === transition.kind ? transition.wall_range_start_minute : transition.wall_range_end_minute;
			var after_wall_minute = 'gap' === transition.kind ? transition.wall_range_end_minute : transition.wall_range_start_minute;
			var previous_transition = index > 0 ? transitions[ index - 1 ] : null;

			if (
				transition.epoch < start.epoch
				|| transition.epoch >= end.epoch
				|| transition.epoch !== wall_minute_to_epoch( date, before_wall_minute, transition.offset_before_seconds )
				|| transition.epoch !== wall_minute_to_epoch( date, after_wall_minute, transition.offset_after_seconds )
				|| ( previous_transition && previous_transition.wall_range_end_minute > transition.wall_range_start_minute )
				|| ( previous_transition && previous_transition.offset_after_seconds !== transition.offset_before_seconds )
			) {
				transition_invalid = true;
			}
		} );
		expected_start_offset_seconds = transitions.length && transitions[ 0 ].epoch === start.epoch
			? transitions[ 0 ].offset_after_seconds
			: ( transitions.length ? transitions[ 0 ].offset_before_seconds : start.offset_minutes * seconds_per_minute );
		if (
			transition_invalid
			|| start.offset_minutes * seconds_per_minute !== expected_start_offset_seconds
			|| ( transitions.length && end.offset_minutes * seconds_per_minute !== transitions[ transitions.length - 1 ].offset_after_seconds )
		) {
			return null;
		}

		return {
			date: date,
			start_at: start.at,
			end_at: end.at,
			start_epoch: start.epoch,
			end_epoch: end.epoch,
			start_offset_minutes: start.offset_minutes,
			end_offset_minutes: end.offset_minutes,
			elapsed_minutes: ( end.epoch - start.epoch ) / seconds_per_minute,
			transitions: transitions
		};
	}

	/**
	 * Normalize the accepted identity used by both interaction modules.
	 *
	 * @param {*} identity Candidate accepted identity.
	 * @return {Object|null} JSON-safe identity or null.
	 */
	function normalize_accepted_identity( identity ) {
		var resource_id = Number( identity && identity.resource_id );
		var booking_generation = Number( identity && identity.booking_generation );
		var availability_generation = Number( identity && identity.availability_generation );
		var resource_fingerprint = identity && 'string' === typeof identity.resource_fingerprint ? identity.resource_fingerprint : '';
		var timezone = identity && 'string' === typeof identity.timezone ? identity.timezone : '';
		var supplied_window_keys = Array.isArray( identity && identity.accepted_window_keys ) ? identity.accepted_window_keys : [];
		var seen_window_keys = Object.create( null );
		var duplicate_window_key = false;
		var window_keys;

		if (
			! Number.isInteger( resource_id )
			|| resource_id <= 0
			|| ! Number.isInteger( booking_generation )
			|| booking_generation < 0
			|| ! Number.isInteger( availability_generation )
			|| availability_generation < 0
			|| ! resource_fingerprint
			|| ! timezone
		) {
			return null;
		}
		window_keys = supplied_window_keys.filter( function ( window_key ) {
			if ( 'string' !== typeof window_key || ! window_key || seen_window_keys[ window_key ] ) {
				duplicate_window_key = duplicate_window_key || Boolean( seen_window_keys[ window_key ] );
				return false;
			}
			seen_window_keys[ window_key ] = true;

			return true;
		} );
		if ( ! window_keys.length || window_keys.length !== supplied_window_keys.length || duplicate_window_key ) {
			return null;
		}

		return {
			resource_id: resource_id,
			resource_fingerprint: resource_fingerprint,
			booking_generation: booking_generation,
			availability_generation: availability_generation,
			accepted_window_keys: window_keys,
			timezone: timezone
		};
	}

	/**
	 * Prepare one immutable-data geometry snapshot with bounded sorting work.
	 *
	 * The returned DTO contains indexes as JSON-safe records. Callers may retain
	 * the DTO, but the kernel retains no reference or request state.
	 *
	 * @param {*} input Geometry input DTO.
	 * @return {Object} Ready snapshot result or invalid result.
	 */
	function prepare_geometry( input ) {
		var identity = normalize_accepted_identity( input && input.accepted_identity );
		var visible_range = input && input.visible_range || {};
		var range_start = Number( visible_range.start_minute );
		var range_end = Number( visible_range.end_minute );
		var zoom_percent = Number( input && input.zoom_percent );
		var hour_height_px = Number( input && input.hour_height_px );
		var block_extent_px = Number( input && input.block_extent_px );
		var selection_step_minutes = Number( input && input.selection_step_minutes );
		var direction = String( input && input.direction || '' ).toLowerCase();
		var bands_by_date = Object.create( null );
		var date_bands = [];
		var date_order = Object.create( null );
		var column_dates = Object.create( null );
		var date_columns;
		var inline_extent = 0;
		var invalid_band = false;

		if ( ! identity ) {
			return invalid_result( 'accepted_identity_invalid' );
		}
		if (
			! Number.isInteger( range_start )
			|| ! Number.isInteger( range_end )
			|| range_start < 0
			|| range_end > minutes_per_day
			|| range_start >= range_end
		) {
			return invalid_result( 'visible_range_invalid' );
		}
		if (
			! Number.isInteger( selection_step_minutes )
			|| selection_step_minutes <= 0
			|| 0 !== minutes_per_day % selection_step_minutes
			|| 0 !== range_start % selection_step_minutes
			|| 0 !== range_end % selection_step_minutes
		) {
			return invalid_result( 'selection_step_invalid' );
		}
		if ( ! Number.isFinite( zoom_percent ) || zoom_percent < minimum_zoom_percent || zoom_percent > maximum_zoom_percent ) {
			return invalid_result( 'zoom_invalid' );
		}
		if ( ! Number.isFinite( hour_height_px ) || hour_height_px <= 0 || hour_height_px > 1000 ) {
			return invalid_result( 'hour_height_invalid' );
		}
		if ( ! Number.isFinite( block_extent_px ) || block_extent_px <= 0 || block_extent_px > 100000 ) {
			return invalid_result( 'block_extent_invalid' );
		}
		if ( 'ltr' !== direction && 'rtl' !== direction ) {
			return invalid_result( 'direction_invalid' );
		}

		( Array.isArray( input.date_bands ) ? input.date_bands : [] ).forEach( function ( candidate_band ) {
			var date_band = normalize_date_band( candidate_band );

			if ( ! date_band ) {
				invalid_band = true;
				return;
			}
			if ( bands_by_date[ date_band.date ] ) {
				if ( hash_identity( bands_by_date[ date_band.date ] ) !== hash_identity( date_band ) ) {
					invalid_band = true;
				}
				return;
			}
			bands_by_date[ date_band.date ] = date_band;
			date_bands.push( date_band );
		} );
		date_bands.sort( function ( left, right ) {
			return left.start_epoch - right.start_epoch;
		} );
		date_bands.forEach( function ( date_band, index ) {
			date_order[ date_band.date ] = index;
		} );
		if ( invalid_band || ! date_bands.length ) {
			return invalid_result( 'date_band_invalid' );
		}

		date_columns = ( Array.isArray( input.date_columns ) ? input.date_columns : [] ).map( function ( date_column ) {
			var logical_start = Number( date_column && date_column.logical_start );
			var logical_end = Number( date_column && date_column.logical_end );
			var date = String( date_column && date_column.date || '' );

			if ( ! bands_by_date[ date ] || column_dates[ date ] || ! Number.isFinite( logical_start ) || ! Number.isFinite( logical_end ) || logical_start < 0 || logical_start >= logical_end ) {
				return null;
			}
			column_dates[ date ] = true;
			inline_extent = Math.max( inline_extent, logical_end );

			return {
				date: date,
				logical_start: logical_start,
				logical_end: logical_end
			};
		} ).filter( Boolean ).sort( function ( left, right ) {
			return left.logical_start - right.logical_start;
		} );
		if ( ! date_columns.length || date_columns.length !== ( Array.isArray( input.date_columns ) ? input.date_columns.length : 0 ) ) {
			return invalid_result( 'date_column_invalid' );
		}
		date_columns.forEach( function ( column, index ) {
			var previous_column = index > 0 ? date_columns[ index - 1 ] : null;
			var boundary_difference;

			if ( ! previous_column ) {
				return;
			}
			boundary_difference = column.logical_start - previous_column.logical_end;
			if ( Math.abs( boundary_difference ) <= column_boundary_epsilon_px ) {
				/* Preserve one deterministic half-open edge across browser zoom rounding. */
				column.logical_start = previous_column.logical_end;
			}
		} );
		if ( date_columns.some( function ( column, index ) {
			return index > 0 && date_columns[ index - 1 ].logical_end > column.logical_start;
		} ) ) {
			return invalid_result( 'date_column_overlap' );
		}
		if ( date_columns.some( function ( column, index ) {
			var previous_column = index > 0 ? date_columns[ index - 1 ] : null;

			return previous_column && (
				date_order[ column.date ] !== date_order[ previous_column.date ] + 1
				|| bands_by_date[ previous_column.date ].end_epoch !== bands_by_date[ column.date ].start_epoch
			);
		} ) ) {
			return invalid_result( 'date_column_coverage_gap' );
		}

		return {
			schema_version: schema_version,
			status: 'ready',
			snapshot: {
				schema_version: schema_version,
				accepted_identity: identity,
				accepted_identity_hash: hash_identity( identity ),
				geometry_identity_hash: hash_identity( {
					accepted_identity: identity,
					date_bands: date_bands.map( function ( date_band ) {
						return [ date_band.date, date_band.start_epoch, date_band.end_epoch, date_band.transitions ];
					} ),
					visible_range: [ range_start, range_end ],
					zoom_percent: zoom_percent,
					hour_height_px: hour_height_px,
					block_extent_px: block_extent_px,
					selection_step_minutes: selection_step_minutes,
					direction: direction
				} ),
				date_bands: date_bands,
				bands_by_date: bands_by_date,
				date_order: date_order,
				date_columns: date_columns,
				inline_extent: inline_extent,
				visible_range: {
					start_minute: range_start,
					end_minute: range_end
				},
				zoom_percent: zoom_percent,
				hour_height_px: hour_height_px,
				block_extent_px: block_extent_px,
				selection_step_minutes: selection_step_minutes,
				direction: direction,
				pixels_per_minute: block_extent_px / ( range_end - range_start )
			}
		};
	}

	/**
	 * Locate a date column by an increasing logical inline coordinate.
	 *
	 * @param {Array<Object>} date_columns Sorted date columns.
	 * @param {number} logical_inline Logical coordinate.
	 * @return {Object|null} Matching half-open column or null.
	 */
	function find_date_column( date_columns, logical_inline ) {
		var low = 0;
		var high = date_columns.length - 1;
		var middle;
		var column;

		while ( low <= high ) {
			middle = Math.floor( ( low + high ) / 2 );
			column = date_columns[ middle ];
			if ( logical_inline < column.logical_start ) {
				high = middle - 1;
			} else if ( logical_inline >= column.logical_end ) {
				low = middle + 1;
			} else {
				return column;
			}
		}

		return null;
	}

	/**
	 * Format one offset in RFC3339 form.
	 *
	 * @param {number} offset_minutes Signed offset minutes.
	 * @return {string} `+HH:MM` or `-HH:MM`.
	 */
	function format_offset( offset_minutes ) {
		var absolute_minutes = Math.abs( offset_minutes );
		var hours = Math.floor( absolute_minutes / 60 );
		var minutes = absolute_minutes % 60;

		return ( offset_minutes < 0 ? '-' : '+' )
			+ String( hours ).padStart( 2, '0' )
			+ ':'
			+ String( minutes ).padStart( 2, '0' );
	}

	/**
	 * Build one exact candidate from server-owned offset metadata.
	 *
	 * @param {Object} date_band Exact date band.
	 * @param {number} wall_minute Wall-clock minute.
	 * @param {number} offset_seconds Signed offset seconds.
	 * @param {string} occurrence Occurrence label.
	 * @param {string} occurrence_id Stable occurrence identity.
	 * @return {Object|null} Exact candidate or null outside the date band.
	 */
	function build_candidate( date_band, wall_minute, offset_seconds, occurrence, occurrence_id ) {
		var hour = Math.floor( wall_minute / 60 );
		var minute = wall_minute % 60;
		var epoch = wall_minute_to_epoch( date_band.date, wall_minute, offset_seconds );
		var offset_minutes = offset_seconds / seconds_per_minute;

		if ( epoch < date_band.start_epoch || epoch >= date_band.end_epoch ) {
			return null;
		}

		return {
			date: date_band.date,
			wall_minute: wall_minute,
			at: date_band.date + 'T' + String( hour ).padStart( 2, '0' ) + ':' + String( minute ).padStart( 2, '0' ) + ':00' + format_offset( offset_minutes ),
			epoch: epoch,
			offset_minutes: offset_minutes,
			wall_occurrence: occurrence,
			occurrence_id: occurrence_id
		};
	}

	/**
	 * Resolve one exact wall boundary from server date-band transitions.
	 *
	 * @param {Object} snapshot Prepared geometry snapshot.
	 * @param {string} date Site-local date.
	 * @param {number} wall_minute Wall-clock minute.
	 * @param {string} occurrence_id Optional explicit fold occurrence.
	 * @return {Object} Exact, gap, fold, or outside result.
	 */
	function resolve_wall_boundary( snapshot, date, wall_minute, occurrence_id ) {
		var date_band = snapshot.bands_by_date[ date ];
		var active_offset_seconds;
		var transition_match = null;
		var candidates = [];

		if ( ! date_band || ! Number.isInteger( wall_minute ) || wall_minute < 0 || wall_minute > minutes_per_day ) {
			return { status: 'outside', code: 'coverage_outside', candidates: [] };
		}
		if ( minutes_per_day === wall_minute ) {
			return {
				status: 'exact',
				transition_id: '',
				candidates: [ {
					date: date,
					wall_minute: minutes_per_day,
					at: date_band.end_at,
					epoch: date_band.end_epoch,
					offset_minutes: date_band.end_offset_minutes,
					wall_occurrence: 'only',
					occurrence_id: date + '-end'
				} ]
			};
		}

		active_offset_seconds = date_band.start_offset_minutes * seconds_per_minute;
		date_band.transitions.forEach( function ( transition ) {
			if ( wall_minute >= transition.wall_range_start_minute && wall_minute < transition.wall_range_end_minute ) {
				transition_match = transition;
			}
			if ( wall_minute >= transition.wall_range_end_minute ) {
				active_offset_seconds = transition.offset_after_seconds;
			}
		} );

		if ( transition_match && 'gap' === transition_match.kind ) {
			return {
				status: 'gap',
				transition_id: transition_match.transition_id,
				candidates: []
			};
		}
		if ( transition_match && 'fold' === transition_match.kind ) {
			candidates = [
				build_candidate( date_band, wall_minute, transition_match.offset_before_seconds, 'first', transition_match.transition_id + ':first' ),
				build_candidate( date_band, wall_minute, transition_match.offset_after_seconds, 'second', transition_match.transition_id + ':second' )
			].filter( Boolean ).sort( function ( left, right ) {
				return left.epoch - right.epoch;
			} );
			if ( occurrence_id ) {
				candidates = candidates.filter( function ( candidate ) {
					return candidate.occurrence_id === occurrence_id;
				} );
				if ( 1 !== candidates.length ) {
					return { status: 'outside', code: 'fold_occurrence_invalid', transition_id: transition_match.transition_id, candidates: [] };
				}
				return { status: 'exact', transition_id: transition_match.transition_id, candidates: candidates };
			}

			return { status: 'fold', transition_id: transition_match.transition_id, candidates: candidates };
		}

		candidates = [ build_candidate( date_band, wall_minute, active_offset_seconds, 'only', date + '-' + wall_minute ) ].filter( Boolean );

		return 1 === candidates.length
			? { status: 'exact', transition_id: '', candidates: candidates }
			: { status: 'outside', code: 'coverage_outside', transition_id: '', candidates: [] };
	}

	/**
	 * Resolve one exact wall minute independently of the selection-step grid.
	 *
	 * Existing bookings may retain canonical minute boundaries that do not align
	 * with the current drafting step. This neutral resolver preserves those exact
	 * minutes while continuing to use server-authored date bands and transition
	 * candidates for gap and fold handling.
	 *
	 * @param {Object} snapshot      Prepared immutable geometry snapshot.
	 * @param {string} date          Covered ISO calendar date.
	 * @param {number} wall_minute   Exact wall minute from 0 through 1440.
	 * @param {string} occurrence_id Optional explicit fold occurrence identifier.
	 * @return {Object} Exact, gap, fold, outside, or invalid wall-time result.
	 */
	function resolve_wall_time( snapshot, date, wall_minute, occurrence_id ) {
		var boundary;
		var exact_candidate;

		if ( ! snapshot || schema_version !== snapshot.schema_version ) {
			return invalid_result( 'snapshot_invalid' );
		}
		date = String( date || '' );
		wall_minute = Number( wall_minute );
		if ( ! snapshot.bands_by_date[ date ] || ! Number.isInteger( wall_minute ) ) {
			return invalid_result( 'wall_time_invalid' );
		}
		boundary = resolve_wall_boundary( snapshot, date, wall_minute, String( occurrence_id || '' ) );
		exact_candidate = 'exact' === boundary.status && 1 === boundary.candidates.length ? boundary.candidates[ 0 ] : null;

		return {
			schema_version: schema_version,
			status: boundary.status,
			code: boundary.code || '',
			accepted_identity_hash: snapshot.accepted_identity_hash,
			date: date,
			wall_minute: wall_minute,
			exact_at: exact_candidate ? exact_candidate.at : '',
			epoch: exact_candidate ? exact_candidate.epoch : null,
			offset_minutes: exact_candidate ? exact_candidate.offset_minutes : null,
			transition_id: boundary.transition_id || '',
			candidates: boundary.candidates
		};
	}

	/**
	 * Resolve the exclusive boundary after one selected cell.
	 *
	 * A cell ending at a transition uses the chronological side reached from
	 * its selected start occurrence. This keeps the preceding spring cell and
	 * both repeated fall cells exact without treating a gap cell as selectable.
	 *
	 * @param {Object} snapshot Prepared geometry snapshot.
	 * @param {string} date Site-local date.
	 * @param {number} wall_minute Exclusive wall-clock boundary.
	 * @param {Object} start_candidate Exact selected-cell start candidate.
	 * @param {string} occurrence_id Optional explicit fold end occurrence.
	 * @return {Object} Exact, gap, fold, or outside result.
	 */
	function resolve_exclusive_end_boundary( snapshot, date, wall_minute, start_candidate, occurrence_id ) {
		var date_band = snapshot.bands_by_date[ date ];
		var transition_match = null;
		var occurrence = '';
		var offset_seconds;
		var candidate;

		if ( ! date_band ) {
			return { status: 'outside', code: 'coverage_outside', candidates: [] };
		}
		date_band.transitions.some( function ( transition ) {
			if ( wall_minute >= transition.wall_range_start_minute && wall_minute <= transition.wall_range_end_minute ) {
				transition_match = transition;
				return true;
			}

			return false;
		} );
		if ( ! transition_match ) {
			return resolve_wall_boundary( snapshot, date, wall_minute, occurrence_id );
		}
		if ( 'gap' === transition_match.kind ) {
			if ( wall_minute === transition_match.wall_range_start_minute ) {
				candidate = build_candidate(
					date_band,
					wall_minute,
					transition_match.offset_before_seconds,
					'before_transition',
					transition_match.transition_id + ':before'
				);

				return candidate
					? { status: 'exact', transition_id: transition_match.transition_id, candidates: [ candidate ] }
					: { status: 'outside', code: 'coverage_outside', transition_id: transition_match.transition_id, candidates: [] };
			}
			if ( wall_minute < transition_match.wall_range_end_minute ) {
				return { status: 'gap', transition_id: transition_match.transition_id, candidates: [] };
			}

			return resolve_wall_boundary( snapshot, date, wall_minute, occurrence_id );
		}

		if ( occurrence_id ) {
			if ( transition_match.transition_id + ':first' === occurrence_id ) {
				occurrence = 'first';
			} else if ( transition_match.transition_id + ':second' === occurrence_id ) {
				occurrence = 'second';
			} else {
				return { status: 'outside', code: 'fold_occurrence_invalid', transition_id: transition_match.transition_id, candidates: [] };
			}
		} else if ( 'first' === start_candidate.wall_occurrence || 'second' === start_candidate.wall_occurrence ) {
			occurrence = start_candidate.wall_occurrence;
		} else {
			occurrence = 'first';
		}
		offset_seconds = 'first' === occurrence ? transition_match.offset_before_seconds : transition_match.offset_after_seconds;
		candidate = build_candidate(
			date_band,
			wall_minute,
			offset_seconds,
			occurrence,
			transition_match.transition_id + ':' + occurrence
		);

		return candidate
			? { status: 'exact', transition_id: transition_match.transition_id, candidates: [ candidate ] }
			: { status: 'outside', code: 'coverage_outside', transition_id: transition_match.transition_id, candidates: [] };
	}

	/**
	 * Convert a pointer or keyboard coordinate into one snapped local cell.
	 *
	 * @param {Object} snapshot Prepared geometry snapshot.
	 * @param {*} coordinate Untrusted coordinate DTO.
	 * @return {Object} Coordinate result.
	 */
	function resolve_coordinate( snapshot, coordinate ) {
		var source;
		var selection_kind;
		var date;
		var wall_minute;
		var snap_index;
		var logical_inline;
		var date_column;
		var block_position;
		var body_height;
		var clipping = {
			before_visible_range: false,
			after_visible_range: false
		};
		var boundary;
		var exact_candidate;

		if ( ! snapshot || schema_version !== snapshot.schema_version || ! coordinate || 'object' !== typeof coordinate ) {
			return invalid_result( 'snapshot_or_coordinate_invalid' );
		}
		source = String( coordinate.source || '' );
		selection_kind = String( coordinate.selection_kind || 'timed' );
		if ( 'pointer' !== source && 'keyboard' !== source ) {
			return invalid_result( 'coordinate_source_invalid' );
		}
		if ( 'timed' !== selection_kind && 'all_day' !== selection_kind ) {
			return invalid_result( 'selection_kind_invalid' );
		}

		if ( 'pointer' === source ) {
			logical_inline = Number( coordinate.inline_px );
			if ( ! Number.isFinite( logical_inline ) ) {
				return invalid_result( 'inline_coordinate_invalid' );
			}
			if ( 'rtl' === snapshot.direction ) {
				logical_inline = snapshot.inline_extent - logical_inline;
			}
			date_column = find_date_column( snapshot.date_columns, logical_inline );
			if ( ! date_column ) {
				return {
					schema_version: schema_version,
					status: 'outside',
					code: 'date_coverage_outside'
				};
			}
			date = date_column.date;
			if ( 'all_day' === selection_kind ) {
				wall_minute = 0;
				snap_index = 0;
			} else {
				block_position = Number( coordinate.block_px );
				if ( ! Number.isFinite( block_position ) ) {
					return invalid_result( 'block_coordinate_invalid' );
				}
				body_height = ( snapshot.visible_range.end_minute - snapshot.visible_range.start_minute ) * snapshot.pixels_per_minute;
				if ( block_position < 0 ) {
					block_position = 0;
					clipping.before_visible_range = true;
				} else if ( block_position >= body_height ) {
					block_position = Math.max( 0, body_height - 0.0001 );
					clipping.after_visible_range = true;
				}
				snap_index = Math.floor( block_position / ( snapshot.selection_step_minutes * snapshot.pixels_per_minute ) );
				wall_minute = snapshot.visible_range.start_minute + snap_index * snapshot.selection_step_minutes;
			}
		} else {
			date = String( coordinate.date || '' );
			snap_index = Number( coordinate.snap_index );
			if ( ! snapshot.bands_by_date[ date ] || ! Number.isInteger( snap_index ) || snap_index < 0 ) {
				return invalid_result( 'keyboard_coordinate_invalid' );
			}
			wall_minute = 'all_day' === selection_kind
				? 0
				: snapshot.visible_range.start_minute + snap_index * snapshot.selection_step_minutes;
			if ( 'timed' === selection_kind && wall_minute >= snapshot.visible_range.end_minute ) {
				return {
					schema_version: schema_version,
					status: 'outside',
					code: 'visible_range_outside'
				};
			}
		}

		boundary = 'all_day' === selection_kind
			? {
				status: 'exact',
				transition_id: '',
				candidates: [ {
					date: date,
					wall_minute: 0,
					at: snapshot.bands_by_date[ date ].start_at,
					epoch: snapshot.bands_by_date[ date ].start_epoch,
					offset_minutes: snapshot.bands_by_date[ date ].start_offset_minutes,
					wall_occurrence: 'only',
					occurrence_id: date + '-start'
				} ]
			}
			: resolve_wall_boundary( snapshot, date, wall_minute, String( coordinate.occurrence_id || '' ) );
		exact_candidate = 'exact' === boundary.status && 1 === boundary.candidates.length ? boundary.candidates[ 0 ] : null;

		return {
			schema_version: schema_version,
			status: boundary.status,
			code: boundary.code || '',
			accepted_identity_hash: snapshot.accepted_identity_hash,
			date: date,
			wall_minute: wall_minute,
			snap_index: snap_index,
			selection_kind: selection_kind,
			exact_at: exact_candidate ? exact_candidate.at : '',
			epoch: exact_candidate ? exact_candidate.epoch : null,
			offset_minutes: exact_candidate ? exact_candidate.offset_minutes : null,
			transition_id: boundary.transition_id || '',
			candidates: boundary.candidates,
			clipping: {
				is_clipped: clipping.before_visible_range || clipping.after_visible_range,
				before_visible_range: clipping.before_visible_range,
				after_visible_range: clipping.after_visible_range
			},
			continuation: {
				continues_before_visible_range: clipping.before_visible_range,
				continues_after_visible_range: clipping.after_visible_range
			},
			draft_identity: [
				'time-row-draft',
				snapshot.geometry_identity_hash,
				date,
				selection_kind,
				snap_index,
				exact_candidate ? 'offset-' + exact_candidate.offset_minutes + '-' + exact_candidate.wall_occurrence : 'unresolved-' + boundary.status
			].join( '-' )
		};
	}

	/**
	 * Build one stable non-exact draft result.
	 *
	 * @param {Object} snapshot Prepared geometry snapshot.
	 * @param {string} status Gap or fold status.
	 * @param {Object} anchor Resolved anchor coordinate.
	 * @param {Object} focus Resolved focus coordinate.
	 * @param {Object|null} end_boundary Optional non-exact exclusive boundary.
	 * @return {Object} Stable non-exact draft DTO.
	 */
	function build_non_exact_draft( snapshot, status, anchor, focus, end_boundary ) {
		var before_visible_range = Boolean( anchor.clipping.before_visible_range || focus.clipping.before_visible_range );
		var after_visible_range = Boolean( anchor.clipping.after_visible_range || focus.clipping.after_visible_range );

		return {
			schema_version: schema_version,
			status: status,
			accepted_identity_hash: snapshot.accepted_identity_hash,
			selection_kind: anchor.selection_kind === focus.selection_kind ? anchor.selection_kind : '',
			anchor: anchor,
			focus: focus,
			end_boundary: end_boundary || null,
			clipping: {
				is_clipped: before_visible_range || after_visible_range,
				before_visible_range: before_visible_range,
				after_visible_range: after_visible_range
			},
			continuation: {
				continues_before_visible_range: before_visible_range,
				continues_after_visible_range: after_visible_range
			},
			draft_identity: 'time-row-draft-' + hash_identity( {
				geometry_identity_hash: snapshot.geometry_identity_hash,
				status: status,
				anchor_identity: anchor.draft_identity,
				focus_identity: focus.draft_identity,
				end_transition_id: end_boundary ? end_boundary.transition_id || '' : ''
			} )
		};
	}

	/**
	 * Resolve an inclusive pair of selected cells into one half-open draft.
	 *
	 * Fold boundaries remain unresolved until coordinates carry explicit
	 * occurrence IDs. No mutation or request plan is created here.
	 *
	 * @param {Object} snapshot Prepared geometry snapshot.
	 * @param {*} anchor_coordinate First selected cell.
	 * @param {*} focus_coordinate Current selected cell.
	 * @return {Object} Exact draft, fold/gap result, or invalid result.
	 */
	function resolve_draft( snapshot, anchor_coordinate, focus_coordinate ) {
		var anchor = resolve_coordinate( snapshot, anchor_coordinate );
		var focus = resolve_coordinate( snapshot, focus_coordinate );
		var anchor_epoch;
		var focus_epoch;
		var first;
		var last;
		var last_coordinate;
		var end_boundary;
		var selection_kind;
		var end_wall_minute;
		var start_candidate;
		var end_candidate;

		if ( 'invalid' === anchor.status || 'invalid' === focus.status || 'outside' === anchor.status || 'outside' === focus.status ) {
			return invalid_result( 'draft_coordinate_invalid' );
		}
		if ( anchor.selection_kind !== focus.selection_kind ) {
			return invalid_result( 'selection_kind_mismatch' );
		}
		if ( 'gap' === anchor.status || 'gap' === focus.status ) {
			return build_non_exact_draft( snapshot, 'gap', anchor, focus, null );
		}
		if ( 'fold' === anchor.status || 'fold' === focus.status ) {
			return build_non_exact_draft( snapshot, 'fold', anchor, focus, null );
		}
		selection_kind = anchor.selection_kind;
		anchor_epoch = anchor.candidates[ 0 ].epoch;
		focus_epoch = focus.candidates[ 0 ].epoch;
		first = anchor_epoch <= focus_epoch ? anchor : focus;
		last = anchor_epoch <= focus_epoch ? focus : anchor;
		last_coordinate = anchor_epoch <= focus_epoch ? focus_coordinate : anchor_coordinate;
		end_wall_minute = 'all_day' === selection_kind
			? minutes_per_day
			: last.wall_minute + snapshot.selection_step_minutes;
		end_boundary = resolve_exclusive_end_boundary(
			snapshot,
			last.date,
			end_wall_minute,
			last.candidates[ 0 ],
			String( last_coordinate.end_occurrence_id || '' )
		);
		if ( 'gap' === end_boundary.status || 'fold' === end_boundary.status ) {
			return build_non_exact_draft( snapshot, end_boundary.status, anchor, focus, end_boundary );
		}
		if ( 'exact' !== end_boundary.status || 1 !== end_boundary.candidates.length ) {
			return invalid_result( 'draft_end_invalid' );
		}

		start_candidate = first.candidates[ 0 ];
		end_candidate = end_boundary.candidates[ 0 ];
		if ( end_candidate.epoch <= start_candidate.epoch ) {
			return invalid_result( 'draft_interval_invalid' );
		}

		return {
			schema_version: schema_version,
			status: 'exact',
			accepted_identity_hash: snapshot.accepted_identity_hash,
			selection_kind: selection_kind,
			start: start_candidate,
			end: end_candidate,
			duration_minutes: ( end_candidate.epoch - start_candidate.epoch ) / seconds_per_minute,
			is_half_open: true,
			clipping: {
				is_clipped: anchor.clipping.is_clipped || focus.clipping.is_clipped,
				before_visible_range: anchor.clipping.before_visible_range || focus.clipping.before_visible_range,
				after_visible_range: anchor.clipping.after_visible_range || focus.clipping.after_visible_range
			},
			continuation: {
				continues_before_visible_range: anchor.continuation.continues_before_visible_range || focus.continuation.continues_before_visible_range,
				continues_after_visible_range: anchor.continuation.continues_after_visible_range || focus.continuation.continues_after_visible_range
			},
			draft_identity: 'time-row-draft-' + hash_identity( {
				geometry_identity_hash: snapshot.geometry_identity_hash,
				selection_kind: selection_kind,
				start_at: start_candidate.at,
				end_at: end_candidate.at
			} )
		};
	}

	window.wpbc_timeline_time_rows_interaction_geometry = Object.freeze( {
		schema_version: schema_version,
		prepare_geometry: prepare_geometry,
		resolve_coordinate: resolve_coordinate,
		resolve_wall_time: resolve_wall_time,
		resolve_draft: resolve_draft
	} );
}( window ) );
