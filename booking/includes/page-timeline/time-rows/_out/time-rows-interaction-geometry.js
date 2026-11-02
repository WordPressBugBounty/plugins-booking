"use strict";

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
(function (window) {
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
  function order_json_value(value) {
    var ordered = {};
    if (Array.isArray(value)) {
      return value.map(order_json_value);
    }
    if (!value || 'object' !== typeof value) {
      return value;
    }
    Object.keys(value).sort().forEach(function (key) {
      ordered[key] = order_json_value(value[key]);
    });
    return ordered;
  }

  /**
   * Hash one JSON-safe identity with deterministic FNV-1a.
   *
   * @param {*} value JSON-safe identity.
   * @return {string} Eight-character hash.
   */
  function hash_identity(value) {
    var source = JSON.stringify(order_json_value(value));
    var hash = 2166136261;
    var index;
    for (index = 0; index < source.length; index++) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Confirm one Gregorian calendar date without a browser timezone.
   *
   * @param {number} year Four-digit year.
   * @param {number} month One-based month.
   * @param {number} day One-based day.
   * @return {boolean} Whether the date exists.
   */
  function is_valid_calendar_date(year, month, day) {
    var days_by_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var is_leap_year;
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
      return false;
    }
    is_leap_year = 0 === year % 4 && (0 !== year % 100 || 0 === year % 400);
    if (is_leap_year) {
      days_by_month[1] = 29;
    }
    return day <= days_by_month[month - 1];
  }

  /**
   * Parse an offset-qualified RFC3339 instant without local timezone APIs.
   *
   * Date.UTC is used only as an explicit UTC calendar-to-epoch primitive.
   *
   * @param {*} timestamp Candidate timestamp.
   * @return {Object|null} Exact parsed value or null.
   */
  function parse_exact_timestamp(timestamp) {
    var matches = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-])(\d{2}):(\d{2})$/.exec(String(timestamp || ''));
    var offset_minutes;
    var wall_epoch;
    var year;
    var month;
    var day;
    var hour;
    var minute;
    var second;
    if (!matches) {
      return null;
    }
    year = Number(matches[1]);
    month = Number(matches[2]);
    day = Number(matches[3]);
    hour = Number(matches[4]);
    minute = Number(matches[5]);
    second = Number(matches[6]);
    if (!is_valid_calendar_date(year, month, day) || hour > 23 || minute > 59 || 0 !== second || matches[7] && /[1-9]/.test(matches[7]) || Number(matches[9]) > 23 || Number(matches[10]) > 59) {
      return null;
    }
    offset_minutes = (Number(matches[9]) * 60 + Number(matches[10])) * ('-' === matches[8] ? -1 : 1);
    wall_epoch = Math.floor(Date.UTC(year, month - 1, day, hour, minute, second) / 1000);
    return {
      at: String(timestamp),
      epoch: wall_epoch - offset_minutes * seconds_per_minute,
      date: matches[1] + '-' + matches[2] + '-' + matches[3],
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
  function wall_minute_to_epoch(date, wall_minute, offset_seconds) {
    var date_parts = date.split('-').map(Number);
    var hour = Math.floor(wall_minute / 60);
    var minute = wall_minute % 60;
    return Math.floor(Date.UTC(date_parts[0], date_parts[1] - 1, date_parts[2], hour, minute, 0) / 1000) - offset_seconds;
  }

  /**
   * Return a safe invalid-result DTO.
   *
   * @param {string} code Stable failure code.
   * @return {Object} Invalid result.
   */
  function invalid_result(code) {
    return {
      schema_version: schema_version,
      status: 'invalid',
      code: String(code || 'geometry_invalid')
    };
  }

  /**
   * Normalize one server transition.
   *
   * @param {*} transition Candidate transition.
   * @return {Object|null} Normalized transition or null.
   */
  function normalize_transition(transition) {
    var kind = String(transition && transition.kind || '');
    var epoch = Number(transition && transition.epoch);
    var wall_start = Number(transition && transition.wall_range_start_minute);
    var wall_end = Number(transition && transition.wall_range_end_minute);
    var offset_before = Number(transition && transition.offset_before_seconds);
    var offset_after = Number(transition && transition.offset_after_seconds);
    var range_seconds;
    if ('gap' !== kind && 'fold' !== kind || !Number.isInteger(epoch) || !Number.isInteger(wall_start) || !Number.isInteger(wall_end) || wall_start < 0 || wall_end > minutes_per_day || wall_start >= wall_end || !Number.isInteger(offset_before) || !Number.isInteger(offset_after) || 0 !== offset_before % seconds_per_minute || 0 !== offset_after % seconds_per_minute) {
      return null;
    }
    range_seconds = (wall_end - wall_start) * seconds_per_minute;
    if ('gap' === kind && offset_after - offset_before !== range_seconds || 'fold' === kind && offset_before - offset_after !== range_seconds) {
      return null;
    }
    return {
      transition_id: String(transition.transition_id || 'transition-' + epoch),
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
  function normalize_date_band(date_band) {
    var start = parse_exact_timestamp(date_band && date_band.start_at);
    var end = parse_exact_timestamp(date_band && date_band.end_at);
    var date = String(date_band && date_band.date || (start ? start.date : ''));
    var supplied_start_epoch = Number(date_band && date_band.start_epoch);
    var supplied_end_epoch = Number(date_band && date_band.end_epoch);
    var supplied_elapsed_minutes = Number(date_band && date_band.elapsed_minutes);
    var supplied_wall_minutes = Number(date_band && date_band.wall_minutes);
    var transitions;
    var transition_invalid = false;
    var expected_start_offset_seconds;
    if (!start || !end || !date || start.date !== date || start.epoch >= end.epoch || Number.isFinite(supplied_start_epoch) && supplied_start_epoch !== start.epoch || Number.isFinite(supplied_end_epoch) && supplied_end_epoch !== end.epoch || Number.isFinite(supplied_elapsed_minutes) && supplied_elapsed_minutes !== (end.epoch - start.epoch) / seconds_per_minute || Number.isFinite(supplied_wall_minutes) && minutes_per_day !== supplied_wall_minutes) {
      return null;
    }
    transitions = (Array.isArray(date_band.transitions) ? date_band.transitions : []).map(normalize_transition).filter(Boolean).sort(function (left, right) {
      return left.epoch - right.epoch;
    });
    if (transitions.length !== (Array.isArray(date_band.transitions) ? date_band.transitions.length : 0)) {
      return null;
    }
    transitions.forEach(function (transition, index) {
      var before_wall_minute = 'gap' === transition.kind ? transition.wall_range_start_minute : transition.wall_range_end_minute;
      var after_wall_minute = 'gap' === transition.kind ? transition.wall_range_end_minute : transition.wall_range_start_minute;
      var previous_transition = index > 0 ? transitions[index - 1] : null;
      if (transition.epoch < start.epoch || transition.epoch >= end.epoch || transition.epoch !== wall_minute_to_epoch(date, before_wall_minute, transition.offset_before_seconds) || transition.epoch !== wall_minute_to_epoch(date, after_wall_minute, transition.offset_after_seconds) || previous_transition && previous_transition.wall_range_end_minute > transition.wall_range_start_minute || previous_transition && previous_transition.offset_after_seconds !== transition.offset_before_seconds) {
        transition_invalid = true;
      }
    });
    expected_start_offset_seconds = transitions.length && transitions[0].epoch === start.epoch ? transitions[0].offset_after_seconds : transitions.length ? transitions[0].offset_before_seconds : start.offset_minutes * seconds_per_minute;
    if (transition_invalid || start.offset_minutes * seconds_per_minute !== expected_start_offset_seconds || transitions.length && end.offset_minutes * seconds_per_minute !== transitions[transitions.length - 1].offset_after_seconds) {
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
      elapsed_minutes: (end.epoch - start.epoch) / seconds_per_minute,
      transitions: transitions
    };
  }

  /**
   * Normalize the accepted identity used by both interaction modules.
   *
   * @param {*} identity Candidate accepted identity.
   * @return {Object|null} JSON-safe identity or null.
   */
  function normalize_accepted_identity(identity) {
    var resource_id = Number(identity && identity.resource_id);
    var booking_generation = Number(identity && identity.booking_generation);
    var availability_generation = Number(identity && identity.availability_generation);
    var resource_fingerprint = identity && 'string' === typeof identity.resource_fingerprint ? identity.resource_fingerprint : '';
    var timezone = identity && 'string' === typeof identity.timezone ? identity.timezone : '';
    var supplied_window_keys = Array.isArray(identity && identity.accepted_window_keys) ? identity.accepted_window_keys : [];
    var seen_window_keys = Object.create(null);
    var duplicate_window_key = false;
    var window_keys;
    if (!Number.isInteger(resource_id) || resource_id <= 0 || !Number.isInteger(booking_generation) || booking_generation < 0 || !Number.isInteger(availability_generation) || availability_generation < 0 || !resource_fingerprint || !timezone) {
      return null;
    }
    window_keys = supplied_window_keys.filter(function (window_key) {
      if ('string' !== typeof window_key || !window_key || seen_window_keys[window_key]) {
        duplicate_window_key = duplicate_window_key || Boolean(seen_window_keys[window_key]);
        return false;
      }
      seen_window_keys[window_key] = true;
      return true;
    });
    if (!window_keys.length || window_keys.length !== supplied_window_keys.length || duplicate_window_key) {
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
  function prepare_geometry(input) {
    var identity = normalize_accepted_identity(input && input.accepted_identity);
    var visible_range = input && input.visible_range || {};
    var range_start = Number(visible_range.start_minute);
    var range_end = Number(visible_range.end_minute);
    var zoom_percent = Number(input && input.zoom_percent);
    var hour_height_px = Number(input && input.hour_height_px);
    var block_extent_px = Number(input && input.block_extent_px);
    var selection_step_minutes = Number(input && input.selection_step_minutes);
    var direction = String(input && input.direction || '').toLowerCase();
    var bands_by_date = Object.create(null);
    var date_bands = [];
    var date_order = Object.create(null);
    var column_dates = Object.create(null);
    var date_columns;
    var inline_extent = 0;
    var invalid_band = false;
    if (!identity) {
      return invalid_result('accepted_identity_invalid');
    }
    if (!Number.isInteger(range_start) || !Number.isInteger(range_end) || range_start < 0 || range_end > minutes_per_day || range_start >= range_end) {
      return invalid_result('visible_range_invalid');
    }
    if (!Number.isInteger(selection_step_minutes) || selection_step_minutes <= 0 || 0 !== minutes_per_day % selection_step_minutes || 0 !== range_start % selection_step_minutes || 0 !== range_end % selection_step_minutes) {
      return invalid_result('selection_step_invalid');
    }
    if (!Number.isFinite(zoom_percent) || zoom_percent < minimum_zoom_percent || zoom_percent > maximum_zoom_percent) {
      return invalid_result('zoom_invalid');
    }
    if (!Number.isFinite(hour_height_px) || hour_height_px <= 0 || hour_height_px > 1000) {
      return invalid_result('hour_height_invalid');
    }
    if (!Number.isFinite(block_extent_px) || block_extent_px <= 0 || block_extent_px > 100000) {
      return invalid_result('block_extent_invalid');
    }
    if ('ltr' !== direction && 'rtl' !== direction) {
      return invalid_result('direction_invalid');
    }
    (Array.isArray(input.date_bands) ? input.date_bands : []).forEach(function (candidate_band) {
      var date_band = normalize_date_band(candidate_band);
      if (!date_band) {
        invalid_band = true;
        return;
      }
      if (bands_by_date[date_band.date]) {
        if (hash_identity(bands_by_date[date_band.date]) !== hash_identity(date_band)) {
          invalid_band = true;
        }
        return;
      }
      bands_by_date[date_band.date] = date_band;
      date_bands.push(date_band);
    });
    date_bands.sort(function (left, right) {
      return left.start_epoch - right.start_epoch;
    });
    date_bands.forEach(function (date_band, index) {
      date_order[date_band.date] = index;
    });
    if (invalid_band || !date_bands.length) {
      return invalid_result('date_band_invalid');
    }
    date_columns = (Array.isArray(input.date_columns) ? input.date_columns : []).map(function (date_column) {
      var logical_start = Number(date_column && date_column.logical_start);
      var logical_end = Number(date_column && date_column.logical_end);
      var date = String(date_column && date_column.date || '');
      if (!bands_by_date[date] || column_dates[date] || !Number.isFinite(logical_start) || !Number.isFinite(logical_end) || logical_start < 0 || logical_start >= logical_end) {
        return null;
      }
      column_dates[date] = true;
      inline_extent = Math.max(inline_extent, logical_end);
      return {
        date: date,
        logical_start: logical_start,
        logical_end: logical_end
      };
    }).filter(Boolean).sort(function (left, right) {
      return left.logical_start - right.logical_start;
    });
    if (!date_columns.length || date_columns.length !== (Array.isArray(input.date_columns) ? input.date_columns.length : 0)) {
      return invalid_result('date_column_invalid');
    }
    date_columns.forEach(function (column, index) {
      var previous_column = index > 0 ? date_columns[index - 1] : null;
      var boundary_difference;
      if (!previous_column) {
        return;
      }
      boundary_difference = column.logical_start - previous_column.logical_end;
      if (Math.abs(boundary_difference) <= column_boundary_epsilon_px) {
        /* Preserve one deterministic half-open edge across browser zoom rounding. */
        column.logical_start = previous_column.logical_end;
      }
    });
    if (date_columns.some(function (column, index) {
      return index > 0 && date_columns[index - 1].logical_end > column.logical_start;
    })) {
      return invalid_result('date_column_overlap');
    }
    if (date_columns.some(function (column, index) {
      var previous_column = index > 0 ? date_columns[index - 1] : null;
      return previous_column && (date_order[column.date] !== date_order[previous_column.date] + 1 || bands_by_date[previous_column.date].end_epoch !== bands_by_date[column.date].start_epoch);
    })) {
      return invalid_result('date_column_coverage_gap');
    }
    return {
      schema_version: schema_version,
      status: 'ready',
      snapshot: {
        schema_version: schema_version,
        accepted_identity: identity,
        accepted_identity_hash: hash_identity(identity),
        geometry_identity_hash: hash_identity({
          accepted_identity: identity,
          date_bands: date_bands.map(function (date_band) {
            return [date_band.date, date_band.start_epoch, date_band.end_epoch, date_band.transitions];
          }),
          visible_range: [range_start, range_end],
          zoom_percent: zoom_percent,
          hour_height_px: hour_height_px,
          block_extent_px: block_extent_px,
          selection_step_minutes: selection_step_minutes,
          direction: direction
        }),
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
        pixels_per_minute: block_extent_px / (range_end - range_start)
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
  function find_date_column(date_columns, logical_inline) {
    var low = 0;
    var high = date_columns.length - 1;
    var middle;
    var column;
    while (low <= high) {
      middle = Math.floor((low + high) / 2);
      column = date_columns[middle];
      if (logical_inline < column.logical_start) {
        high = middle - 1;
      } else if (logical_inline >= column.logical_end) {
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
  function format_offset(offset_minutes) {
    var absolute_minutes = Math.abs(offset_minutes);
    var hours = Math.floor(absolute_minutes / 60);
    var minutes = absolute_minutes % 60;
    return (offset_minutes < 0 ? '-' : '+') + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
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
  function build_candidate(date_band, wall_minute, offset_seconds, occurrence, occurrence_id) {
    var hour = Math.floor(wall_minute / 60);
    var minute = wall_minute % 60;
    var epoch = wall_minute_to_epoch(date_band.date, wall_minute, offset_seconds);
    var offset_minutes = offset_seconds / seconds_per_minute;
    if (epoch < date_band.start_epoch || epoch >= date_band.end_epoch) {
      return null;
    }
    return {
      date: date_band.date,
      wall_minute: wall_minute,
      at: date_band.date + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00' + format_offset(offset_minutes),
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
  function resolve_wall_boundary(snapshot, date, wall_minute, occurrence_id) {
    var date_band = snapshot.bands_by_date[date];
    var active_offset_seconds;
    var transition_match = null;
    var candidates = [];
    if (!date_band || !Number.isInteger(wall_minute) || wall_minute < 0 || wall_minute > minutes_per_day) {
      return {
        status: 'outside',
        code: 'coverage_outside',
        candidates: []
      };
    }
    if (minutes_per_day === wall_minute) {
      return {
        status: 'exact',
        transition_id: '',
        candidates: [{
          date: date,
          wall_minute: minutes_per_day,
          at: date_band.end_at,
          epoch: date_band.end_epoch,
          offset_minutes: date_band.end_offset_minutes,
          wall_occurrence: 'only',
          occurrence_id: date + '-end'
        }]
      };
    }
    active_offset_seconds = date_band.start_offset_minutes * seconds_per_minute;
    date_band.transitions.forEach(function (transition) {
      if (wall_minute >= transition.wall_range_start_minute && wall_minute < transition.wall_range_end_minute) {
        transition_match = transition;
      }
      if (wall_minute >= transition.wall_range_end_minute) {
        active_offset_seconds = transition.offset_after_seconds;
      }
    });
    if (transition_match && 'gap' === transition_match.kind) {
      return {
        status: 'gap',
        transition_id: transition_match.transition_id,
        candidates: []
      };
    }
    if (transition_match && 'fold' === transition_match.kind) {
      candidates = [build_candidate(date_band, wall_minute, transition_match.offset_before_seconds, 'first', transition_match.transition_id + ':first'), build_candidate(date_band, wall_minute, transition_match.offset_after_seconds, 'second', transition_match.transition_id + ':second')].filter(Boolean).sort(function (left, right) {
        return left.epoch - right.epoch;
      });
      if (occurrence_id) {
        candidates = candidates.filter(function (candidate) {
          return candidate.occurrence_id === occurrence_id;
        });
        if (1 !== candidates.length) {
          return {
            status: 'outside',
            code: 'fold_occurrence_invalid',
            transition_id: transition_match.transition_id,
            candidates: []
          };
        }
        return {
          status: 'exact',
          transition_id: transition_match.transition_id,
          candidates: candidates
        };
      }
      return {
        status: 'fold',
        transition_id: transition_match.transition_id,
        candidates: candidates
      };
    }
    candidates = [build_candidate(date_band, wall_minute, active_offset_seconds, 'only', date + '-' + wall_minute)].filter(Boolean);
    return 1 === candidates.length ? {
      status: 'exact',
      transition_id: '',
      candidates: candidates
    } : {
      status: 'outside',
      code: 'coverage_outside',
      transition_id: '',
      candidates: []
    };
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
  function resolve_wall_time(snapshot, date, wall_minute, occurrence_id) {
    var boundary;
    var exact_candidate;
    if (!snapshot || schema_version !== snapshot.schema_version) {
      return invalid_result('snapshot_invalid');
    }
    date = String(date || '');
    wall_minute = Number(wall_minute);
    if (!snapshot.bands_by_date[date] || !Number.isInteger(wall_minute)) {
      return invalid_result('wall_time_invalid');
    }
    boundary = resolve_wall_boundary(snapshot, date, wall_minute, String(occurrence_id || ''));
    exact_candidate = 'exact' === boundary.status && 1 === boundary.candidates.length ? boundary.candidates[0] : null;
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
  function resolve_exclusive_end_boundary(snapshot, date, wall_minute, start_candidate, occurrence_id) {
    var date_band = snapshot.bands_by_date[date];
    var transition_match = null;
    var occurrence = '';
    var offset_seconds;
    var candidate;
    if (!date_band) {
      return {
        status: 'outside',
        code: 'coverage_outside',
        candidates: []
      };
    }
    date_band.transitions.some(function (transition) {
      if (wall_minute >= transition.wall_range_start_minute && wall_minute <= transition.wall_range_end_minute) {
        transition_match = transition;
        return true;
      }
      return false;
    });
    if (!transition_match) {
      return resolve_wall_boundary(snapshot, date, wall_minute, occurrence_id);
    }
    if ('gap' === transition_match.kind) {
      if (wall_minute === transition_match.wall_range_start_minute) {
        candidate = build_candidate(date_band, wall_minute, transition_match.offset_before_seconds, 'before_transition', transition_match.transition_id + ':before');
        return candidate ? {
          status: 'exact',
          transition_id: transition_match.transition_id,
          candidates: [candidate]
        } : {
          status: 'outside',
          code: 'coverage_outside',
          transition_id: transition_match.transition_id,
          candidates: []
        };
      }
      if (wall_minute < transition_match.wall_range_end_minute) {
        return {
          status: 'gap',
          transition_id: transition_match.transition_id,
          candidates: []
        };
      }
      return resolve_wall_boundary(snapshot, date, wall_minute, occurrence_id);
    }
    if (occurrence_id) {
      if (transition_match.transition_id + ':first' === occurrence_id) {
        occurrence = 'first';
      } else if (transition_match.transition_id + ':second' === occurrence_id) {
        occurrence = 'second';
      } else {
        return {
          status: 'outside',
          code: 'fold_occurrence_invalid',
          transition_id: transition_match.transition_id,
          candidates: []
        };
      }
    } else if ('first' === start_candidate.wall_occurrence || 'second' === start_candidate.wall_occurrence) {
      occurrence = start_candidate.wall_occurrence;
    } else {
      occurrence = 'first';
    }
    offset_seconds = 'first' === occurrence ? transition_match.offset_before_seconds : transition_match.offset_after_seconds;
    candidate = build_candidate(date_band, wall_minute, offset_seconds, occurrence, transition_match.transition_id + ':' + occurrence);
    return candidate ? {
      status: 'exact',
      transition_id: transition_match.transition_id,
      candidates: [candidate]
    } : {
      status: 'outside',
      code: 'coverage_outside',
      transition_id: transition_match.transition_id,
      candidates: []
    };
  }

  /**
   * Convert a pointer or keyboard coordinate into one snapped local cell.
   *
   * @param {Object} snapshot Prepared geometry snapshot.
   * @param {*} coordinate Untrusted coordinate DTO.
   * @return {Object} Coordinate result.
   */
  function resolve_coordinate(snapshot, coordinate) {
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
    if (!snapshot || schema_version !== snapshot.schema_version || !coordinate || 'object' !== typeof coordinate) {
      return invalid_result('snapshot_or_coordinate_invalid');
    }
    source = String(coordinate.source || '');
    selection_kind = String(coordinate.selection_kind || 'timed');
    if ('pointer' !== source && 'keyboard' !== source) {
      return invalid_result('coordinate_source_invalid');
    }
    if ('timed' !== selection_kind && 'all_day' !== selection_kind) {
      return invalid_result('selection_kind_invalid');
    }
    if ('pointer' === source) {
      logical_inline = Number(coordinate.inline_px);
      if (!Number.isFinite(logical_inline)) {
        return invalid_result('inline_coordinate_invalid');
      }
      if ('rtl' === snapshot.direction) {
        logical_inline = snapshot.inline_extent - logical_inline;
      }
      date_column = find_date_column(snapshot.date_columns, logical_inline);
      if (!date_column) {
        return {
          schema_version: schema_version,
          status: 'outside',
          code: 'date_coverage_outside'
        };
      }
      date = date_column.date;
      if ('all_day' === selection_kind) {
        wall_minute = 0;
        snap_index = 0;
      } else {
        block_position = Number(coordinate.block_px);
        if (!Number.isFinite(block_position)) {
          return invalid_result('block_coordinate_invalid');
        }
        body_height = (snapshot.visible_range.end_minute - snapshot.visible_range.start_minute) * snapshot.pixels_per_minute;
        if (block_position < 0) {
          block_position = 0;
          clipping.before_visible_range = true;
        } else if (block_position >= body_height) {
          block_position = Math.max(0, body_height - 0.0001);
          clipping.after_visible_range = true;
        }
        snap_index = Math.floor(block_position / (snapshot.selection_step_minutes * snapshot.pixels_per_minute));
        wall_minute = snapshot.visible_range.start_minute + snap_index * snapshot.selection_step_minutes;
      }
    } else {
      date = String(coordinate.date || '');
      snap_index = Number(coordinate.snap_index);
      if (!snapshot.bands_by_date[date] || !Number.isInteger(snap_index) || snap_index < 0) {
        return invalid_result('keyboard_coordinate_invalid');
      }
      wall_minute = 'all_day' === selection_kind ? 0 : snapshot.visible_range.start_minute + snap_index * snapshot.selection_step_minutes;
      if ('timed' === selection_kind && wall_minute >= snapshot.visible_range.end_minute) {
        return {
          schema_version: schema_version,
          status: 'outside',
          code: 'visible_range_outside'
        };
      }
    }
    boundary = 'all_day' === selection_kind ? {
      status: 'exact',
      transition_id: '',
      candidates: [{
        date: date,
        wall_minute: 0,
        at: snapshot.bands_by_date[date].start_at,
        epoch: snapshot.bands_by_date[date].start_epoch,
        offset_minutes: snapshot.bands_by_date[date].start_offset_minutes,
        wall_occurrence: 'only',
        occurrence_id: date + '-start'
      }]
    } : resolve_wall_boundary(snapshot, date, wall_minute, String(coordinate.occurrence_id || ''));
    exact_candidate = 'exact' === boundary.status && 1 === boundary.candidates.length ? boundary.candidates[0] : null;
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
      draft_identity: ['time-row-draft', snapshot.geometry_identity_hash, date, selection_kind, snap_index, exact_candidate ? 'offset-' + exact_candidate.offset_minutes + '-' + exact_candidate.wall_occurrence : 'unresolved-' + boundary.status].join('-')
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
  function build_non_exact_draft(snapshot, status, anchor, focus, end_boundary) {
    var before_visible_range = Boolean(anchor.clipping.before_visible_range || focus.clipping.before_visible_range);
    var after_visible_range = Boolean(anchor.clipping.after_visible_range || focus.clipping.after_visible_range);
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
      draft_identity: 'time-row-draft-' + hash_identity({
        geometry_identity_hash: snapshot.geometry_identity_hash,
        status: status,
        anchor_identity: anchor.draft_identity,
        focus_identity: focus.draft_identity,
        end_transition_id: end_boundary ? end_boundary.transition_id || '' : ''
      })
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
  function resolve_draft(snapshot, anchor_coordinate, focus_coordinate) {
    var anchor = resolve_coordinate(snapshot, anchor_coordinate);
    var focus = resolve_coordinate(snapshot, focus_coordinate);
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
    if ('invalid' === anchor.status || 'invalid' === focus.status || 'outside' === anchor.status || 'outside' === focus.status) {
      return invalid_result('draft_coordinate_invalid');
    }
    if (anchor.selection_kind !== focus.selection_kind) {
      return invalid_result('selection_kind_mismatch');
    }
    if ('gap' === anchor.status || 'gap' === focus.status) {
      return build_non_exact_draft(snapshot, 'gap', anchor, focus, null);
    }
    if ('fold' === anchor.status || 'fold' === focus.status) {
      return build_non_exact_draft(snapshot, 'fold', anchor, focus, null);
    }
    selection_kind = anchor.selection_kind;
    anchor_epoch = anchor.candidates[0].epoch;
    focus_epoch = focus.candidates[0].epoch;
    first = anchor_epoch <= focus_epoch ? anchor : focus;
    last = anchor_epoch <= focus_epoch ? focus : anchor;
    last_coordinate = anchor_epoch <= focus_epoch ? focus_coordinate : anchor_coordinate;
    end_wall_minute = 'all_day' === selection_kind ? minutes_per_day : last.wall_minute + snapshot.selection_step_minutes;
    end_boundary = resolve_exclusive_end_boundary(snapshot, last.date, end_wall_minute, last.candidates[0], String(last_coordinate.end_occurrence_id || ''));
    if ('gap' === end_boundary.status || 'fold' === end_boundary.status) {
      return build_non_exact_draft(snapshot, end_boundary.status, anchor, focus, end_boundary);
    }
    if ('exact' !== end_boundary.status || 1 !== end_boundary.candidates.length) {
      return invalid_result('draft_end_invalid');
    }
    start_candidate = first.candidates[0];
    end_candidate = end_boundary.candidates[0];
    if (end_candidate.epoch <= start_candidate.epoch) {
      return invalid_result('draft_interval_invalid');
    }
    return {
      schema_version: schema_version,
      status: 'exact',
      accepted_identity_hash: snapshot.accepted_identity_hash,
      selection_kind: selection_kind,
      start: start_candidate,
      end: end_candidate,
      duration_minutes: (end_candidate.epoch - start_candidate.epoch) / seconds_per_minute,
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
      draft_identity: 'time-row-draft-' + hash_identity({
        geometry_identity_hash: snapshot.geometry_identity_hash,
        selection_kind: selection_kind,
        start_at: start_candidate.at,
        end_at: end_candidate.at
      })
    };
  }
  window.wpbc_timeline_time_rows_interaction_geometry = Object.freeze({
    schema_version: schema_version,
    prepare_geometry: prepare_geometry,
    resolve_coordinate: resolve_coordinate,
    resolve_wall_time: resolve_wall_time,
    resolve_draft: resolve_draft
  });
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS90aW1lLXJvd3MvX291dC90aW1lLXJvd3MtaW50ZXJhY3Rpb24tZ2VvbWV0cnkuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJzY2hlbWFfdmVyc2lvbiIsIm1pbnV0ZXNfcGVyX2RheSIsInNlY29uZHNfcGVyX21pbnV0ZSIsIm1pbmltdW1fem9vbV9wZXJjZW50IiwibWF4aW11bV96b29tX3BlcmNlbnQiLCJjb2x1bW5fYm91bmRhcnlfZXBzaWxvbl9weCIsIm9yZGVyX2pzb25fdmFsdWUiLCJ2YWx1ZSIsIm9yZGVyZWQiLCJBcnJheSIsImlzQXJyYXkiLCJtYXAiLCJPYmplY3QiLCJrZXlzIiwic29ydCIsImZvckVhY2giLCJrZXkiLCJoYXNoX2lkZW50aXR5Iiwic291cmNlIiwiSlNPTiIsInN0cmluZ2lmeSIsImhhc2giLCJpbmRleCIsImxlbmd0aCIsImNoYXJDb2RlQXQiLCJNYXRoIiwiaW11bCIsInRvU3RyaW5nIiwicGFkU3RhcnQiLCJpc192YWxpZF9jYWxlbmRhcl9kYXRlIiwieWVhciIsIm1vbnRoIiwiZGF5IiwiZGF5c19ieV9tb250aCIsImlzX2xlYXBfeWVhciIsIk51bWJlciIsImlzSW50ZWdlciIsInBhcnNlX2V4YWN0X3RpbWVzdGFtcCIsInRpbWVzdGFtcCIsIm1hdGNoZXMiLCJleGVjIiwiU3RyaW5nIiwib2Zmc2V0X21pbnV0ZXMiLCJ3YWxsX2Vwb2NoIiwiaG91ciIsIm1pbnV0ZSIsInNlY29uZCIsInRlc3QiLCJmbG9vciIsIkRhdGUiLCJVVEMiLCJhdCIsImVwb2NoIiwiZGF0ZSIsIndhbGxfbWludXRlIiwid2FsbF9taW51dGVfdG9fZXBvY2giLCJvZmZzZXRfc2Vjb25kcyIsImRhdGVfcGFydHMiLCJzcGxpdCIsImludmFsaWRfcmVzdWx0IiwiY29kZSIsInN0YXR1cyIsIm5vcm1hbGl6ZV90cmFuc2l0aW9uIiwidHJhbnNpdGlvbiIsImtpbmQiLCJ3YWxsX3N0YXJ0Iiwid2FsbF9yYW5nZV9zdGFydF9taW51dGUiLCJ3YWxsX2VuZCIsIndhbGxfcmFuZ2VfZW5kX21pbnV0ZSIsIm9mZnNldF9iZWZvcmUiLCJvZmZzZXRfYmVmb3JlX3NlY29uZHMiLCJvZmZzZXRfYWZ0ZXIiLCJvZmZzZXRfYWZ0ZXJfc2Vjb25kcyIsInJhbmdlX3NlY29uZHMiLCJ0cmFuc2l0aW9uX2lkIiwibm9ybWFsaXplX2RhdGVfYmFuZCIsImRhdGVfYmFuZCIsInN0YXJ0Iiwic3RhcnRfYXQiLCJlbmQiLCJlbmRfYXQiLCJzdXBwbGllZF9zdGFydF9lcG9jaCIsInN0YXJ0X2Vwb2NoIiwic3VwcGxpZWRfZW5kX2Vwb2NoIiwiZW5kX2Vwb2NoIiwic3VwcGxpZWRfZWxhcHNlZF9taW51dGVzIiwiZWxhcHNlZF9taW51dGVzIiwic3VwcGxpZWRfd2FsbF9taW51dGVzIiwid2FsbF9taW51dGVzIiwidHJhbnNpdGlvbnMiLCJ0cmFuc2l0aW9uX2ludmFsaWQiLCJleHBlY3RlZF9zdGFydF9vZmZzZXRfc2Vjb25kcyIsImlzRmluaXRlIiwiZmlsdGVyIiwiQm9vbGVhbiIsImxlZnQiLCJyaWdodCIsImJlZm9yZV93YWxsX21pbnV0ZSIsImFmdGVyX3dhbGxfbWludXRlIiwicHJldmlvdXNfdHJhbnNpdGlvbiIsInN0YXJ0X29mZnNldF9taW51dGVzIiwiZW5kX29mZnNldF9taW51dGVzIiwibm9ybWFsaXplX2FjY2VwdGVkX2lkZW50aXR5IiwiaWRlbnRpdHkiLCJyZXNvdXJjZV9pZCIsImJvb2tpbmdfZ2VuZXJhdGlvbiIsImF2YWlsYWJpbGl0eV9nZW5lcmF0aW9uIiwicmVzb3VyY2VfZmluZ2VycHJpbnQiLCJ0aW1lem9uZSIsInN1cHBsaWVkX3dpbmRvd19rZXlzIiwiYWNjZXB0ZWRfd2luZG93X2tleXMiLCJzZWVuX3dpbmRvd19rZXlzIiwiY3JlYXRlIiwiZHVwbGljYXRlX3dpbmRvd19rZXkiLCJ3aW5kb3dfa2V5cyIsIndpbmRvd19rZXkiLCJwcmVwYXJlX2dlb21ldHJ5IiwiaW5wdXQiLCJhY2NlcHRlZF9pZGVudGl0eSIsInZpc2libGVfcmFuZ2UiLCJyYW5nZV9zdGFydCIsInN0YXJ0X21pbnV0ZSIsInJhbmdlX2VuZCIsImVuZF9taW51dGUiLCJ6b29tX3BlcmNlbnQiLCJob3VyX2hlaWdodF9weCIsImJsb2NrX2V4dGVudF9weCIsInNlbGVjdGlvbl9zdGVwX21pbnV0ZXMiLCJkaXJlY3Rpb24iLCJ0b0xvd2VyQ2FzZSIsImJhbmRzX2J5X2RhdGUiLCJkYXRlX2JhbmRzIiwiZGF0ZV9vcmRlciIsImNvbHVtbl9kYXRlcyIsImRhdGVfY29sdW1ucyIsImlubGluZV9leHRlbnQiLCJpbnZhbGlkX2JhbmQiLCJjYW5kaWRhdGVfYmFuZCIsInB1c2giLCJkYXRlX2NvbHVtbiIsImxvZ2ljYWxfc3RhcnQiLCJsb2dpY2FsX2VuZCIsIm1heCIsImNvbHVtbiIsInByZXZpb3VzX2NvbHVtbiIsImJvdW5kYXJ5X2RpZmZlcmVuY2UiLCJhYnMiLCJzb21lIiwic25hcHNob3QiLCJhY2NlcHRlZF9pZGVudGl0eV9oYXNoIiwiZ2VvbWV0cnlfaWRlbnRpdHlfaGFzaCIsInBpeGVsc19wZXJfbWludXRlIiwiZmluZF9kYXRlX2NvbHVtbiIsImxvZ2ljYWxfaW5saW5lIiwibG93IiwiaGlnaCIsIm1pZGRsZSIsImZvcm1hdF9vZmZzZXQiLCJhYnNvbHV0ZV9taW51dGVzIiwiaG91cnMiLCJtaW51dGVzIiwiYnVpbGRfY2FuZGlkYXRlIiwib2NjdXJyZW5jZSIsIm9jY3VycmVuY2VfaWQiLCJ3YWxsX29jY3VycmVuY2UiLCJyZXNvbHZlX3dhbGxfYm91bmRhcnkiLCJhY3RpdmVfb2Zmc2V0X3NlY29uZHMiLCJ0cmFuc2l0aW9uX21hdGNoIiwiY2FuZGlkYXRlcyIsImNhbmRpZGF0ZSIsInJlc29sdmVfd2FsbF90aW1lIiwiYm91bmRhcnkiLCJleGFjdF9jYW5kaWRhdGUiLCJleGFjdF9hdCIsInJlc29sdmVfZXhjbHVzaXZlX2VuZF9ib3VuZGFyeSIsInN0YXJ0X2NhbmRpZGF0ZSIsInJlc29sdmVfY29vcmRpbmF0ZSIsImNvb3JkaW5hdGUiLCJzZWxlY3Rpb25fa2luZCIsInNuYXBfaW5kZXgiLCJibG9ja19wb3NpdGlvbiIsImJvZHlfaGVpZ2h0IiwiY2xpcHBpbmciLCJiZWZvcmVfdmlzaWJsZV9yYW5nZSIsImFmdGVyX3Zpc2libGVfcmFuZ2UiLCJpbmxpbmVfcHgiLCJibG9ja19weCIsImlzX2NsaXBwZWQiLCJjb250aW51YXRpb24iLCJjb250aW51ZXNfYmVmb3JlX3Zpc2libGVfcmFuZ2UiLCJjb250aW51ZXNfYWZ0ZXJfdmlzaWJsZV9yYW5nZSIsImRyYWZ0X2lkZW50aXR5Iiwiam9pbiIsImJ1aWxkX25vbl9leGFjdF9kcmFmdCIsImFuY2hvciIsImZvY3VzIiwiZW5kX2JvdW5kYXJ5IiwiYW5jaG9yX2lkZW50aXR5IiwiZm9jdXNfaWRlbnRpdHkiLCJlbmRfdHJhbnNpdGlvbl9pZCIsInJlc29sdmVfZHJhZnQiLCJhbmNob3JfY29vcmRpbmF0ZSIsImZvY3VzX2Nvb3JkaW5hdGUiLCJhbmNob3JfZXBvY2giLCJmb2N1c19lcG9jaCIsImZpcnN0IiwibGFzdCIsImxhc3RfY29vcmRpbmF0ZSIsImVuZF93YWxsX21pbnV0ZSIsImVuZF9jYW5kaWRhdGUiLCJlbmRfb2NjdXJyZW5jZV9pZCIsImR1cmF0aW9uX21pbnV0ZXMiLCJpc19oYWxmX29wZW4iLCJ3cGJjX3RpbWVsaW5lX3RpbWVfcm93c19pbnRlcmFjdGlvbl9nZW9tZXRyeSIsImZyZWV6ZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtdGltZWxpbmUvdGltZS1yb3dzL19zcmMvdGltZS1yb3dzLWludGVyYWN0aW9uLWdlb21ldHJ5LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHVyZSBUaW1lbGluZSB0aW1lLXJvdyBpbnRlcmFjdGlvbiBnZW9tZXRyeS5cbiAqXG4gKiBUaGUga2VybmVsIGNvbnZlcnRzIGV4cGxpY2l0IGFjY2VwdGVkIHNlcnZlci1heGlzIERUT3MgYW5kIGxvZ2ljYWxcbiAqIGNvb3JkaW5hdGVzIGludG8gZXhhY3QsIGdhcCwgb3IgZm9sZCByZXN1bHRzLiBJdCBvd25zIG5vIERPTSwgdHJhbnNwb3J0LFxuICogbXV0YXRpb24sIGJyb3dzZXItdGltZXpvbmUsIG9yIHJldGFpbmVkIGludGVyYWN0aW9uIHN0YXRlLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIHNjaGVtYV92ZXJzaW9uID0gMTtcblx0dmFyIG1pbnV0ZXNfcGVyX2RheSA9IDE0NDA7XG5cdHZhciBzZWNvbmRzX3Blcl9taW51dGUgPSA2MDtcblx0dmFyIG1pbmltdW1fem9vbV9wZXJjZW50ID0gMzA7XG5cdHZhciBtYXhpbXVtX3pvb21fcGVyY2VudCA9IDMwMDtcblx0LyogQnJvd3NlciBsYXlvdXQgbWF5IHJlcG9ydCB0aGUgc2FtZSBzaGFyZWQgZWRnZSB3aXRoIG9wcG9zaW5nIHN1YnBpeGVsIHJvdW5kaW5nLiAqL1xuXHR2YXIgY29sdW1uX2JvdW5kYXJ5X2Vwc2lsb25fcHggPSAwLjU7XG5cblx0LyoqXG5cdCAqIFJlY3Vyc2l2ZWx5IG9yZGVyIEpTT04tc2FmZSB2YWx1ZXMgZm9yIHN0YWJsZSBpZGVudGl0aWVzLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHZhbHVlIENhbmRpZGF0ZSB2YWx1ZS5cblx0ICogQHJldHVybiB7Kn0gT3JkZXJlZCB2YWx1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIG9yZGVyX2pzb25fdmFsdWUoIHZhbHVlICkge1xuXHRcdHZhciBvcmRlcmVkID0ge307XG5cblx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIHZhbHVlICkgKSB7XG5cdFx0XHRyZXR1cm4gdmFsdWUubWFwKCBvcmRlcl9qc29uX3ZhbHVlICk7XG5cdFx0fVxuXHRcdGlmICggISB2YWx1ZSB8fCAnb2JqZWN0JyAhPT0gdHlwZW9mIHZhbHVlICkge1xuXHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdH1cblx0XHRPYmplY3Qua2V5cyggdmFsdWUgKS5zb3J0KCkuZm9yRWFjaCggZnVuY3Rpb24gKCBrZXkgKSB7XG5cdFx0XHRvcmRlcmVkWyBrZXkgXSA9IG9yZGVyX2pzb25fdmFsdWUoIHZhbHVlWyBrZXkgXSApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBvcmRlcmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEhhc2ggb25lIEpTT04tc2FmZSBpZGVudGl0eSB3aXRoIGRldGVybWluaXN0aWMgRk5WLTFhLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHZhbHVlIEpTT04tc2FmZSBpZGVudGl0eS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBFaWdodC1jaGFyYWN0ZXIgaGFzaC5cblx0ICovXG5cdGZ1bmN0aW9uIGhhc2hfaWRlbnRpdHkoIHZhbHVlICkge1xuXHRcdHZhciBzb3VyY2UgPSBKU09OLnN0cmluZ2lmeSggb3JkZXJfanNvbl92YWx1ZSggdmFsdWUgKSApO1xuXHRcdHZhciBoYXNoID0gMjE2NjEzNjI2MTtcblx0XHR2YXIgaW5kZXg7XG5cblx0XHRmb3IgKCBpbmRleCA9IDA7IGluZGV4IDwgc291cmNlLmxlbmd0aDsgaW5kZXgrKyApIHtcblx0XHRcdGhhc2ggXj0gc291cmNlLmNoYXJDb2RlQXQoIGluZGV4ICk7XG5cdFx0XHRoYXNoID0gTWF0aC5pbXVsKCBoYXNoLCAxNjc3NzYxOSApO1xuXHRcdH1cblxuXHRcdHJldHVybiAoIGhhc2ggPj4+IDAgKS50b1N0cmluZyggMTYgKS5wYWRTdGFydCggOCwgJzAnICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29uZmlybSBvbmUgR3JlZ29yaWFuIGNhbGVuZGFyIGRhdGUgd2l0aG91dCBhIGJyb3dzZXIgdGltZXpvbmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSB5ZWFyIEZvdXItZGlnaXQgeWVhci5cblx0ICogQHBhcmFtIHtudW1iZXJ9IG1vbnRoIE9uZS1iYXNlZCBtb250aC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGRheSBPbmUtYmFzZWQgZGF5LlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBXaGV0aGVyIHRoZSBkYXRlIGV4aXN0cy5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX3ZhbGlkX2NhbGVuZGFyX2RhdGUoIHllYXIsIG1vbnRoLCBkYXkgKSB7XG5cdFx0dmFyIGRheXNfYnlfbW9udGggPSBbIDMxLCAyOCwgMzEsIDMwLCAzMSwgMzAsIDMxLCAzMSwgMzAsIDMxLCAzMCwgMzEgXTtcblx0XHR2YXIgaXNfbGVhcF95ZWFyO1xuXG5cdFx0aWYgKCAhIE51bWJlci5pc0ludGVnZXIoIHllYXIgKSB8fCAhIE51bWJlci5pc0ludGVnZXIoIG1vbnRoICkgfHwgISBOdW1iZXIuaXNJbnRlZ2VyKCBkYXkgKSB8fCBtb250aCA8IDEgfHwgbW9udGggPiAxMiB8fCBkYXkgPCAxICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpc19sZWFwX3llYXIgPSAwID09PSB5ZWFyICUgNCAmJiAoIDAgIT09IHllYXIgJSAxMDAgfHwgMCA9PT0geWVhciAlIDQwMCApO1xuXHRcdGlmICggaXNfbGVhcF95ZWFyICkge1xuXHRcdFx0ZGF5c19ieV9tb250aFsgMSBdID0gMjk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRheSA8PSBkYXlzX2J5X21vbnRoWyBtb250aCAtIDEgXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQYXJzZSBhbiBvZmZzZXQtcXVhbGlmaWVkIFJGQzMzMzkgaW5zdGFudCB3aXRob3V0IGxvY2FsIHRpbWV6b25lIEFQSXMuXG5cdCAqXG5cdCAqIERhdGUuVVRDIGlzIHVzZWQgb25seSBhcyBhbiBleHBsaWNpdCBVVEMgY2FsZW5kYXItdG8tZXBvY2ggcHJpbWl0aXZlLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHRpbWVzdGFtcCBDYW5kaWRhdGUgdGltZXN0YW1wLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gRXhhY3QgcGFyc2VkIHZhbHVlIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBwYXJzZV9leGFjdF90aW1lc3RhbXAoIHRpbWVzdGFtcCApIHtcblx0XHR2YXIgbWF0Y2hlcyA9IC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSlUKFxcZHsyfSk6KFxcZHsyfSk6KFxcZHsyfSkoPzpcXC4oXFxkKykpPyhbKy1dKShcXGR7Mn0pOihcXGR7Mn0pJC8uZXhlYyggU3RyaW5nKCB0aW1lc3RhbXAgfHwgJycgKSApO1xuXHRcdHZhciBvZmZzZXRfbWludXRlcztcblx0XHR2YXIgd2FsbF9lcG9jaDtcblx0XHR2YXIgeWVhcjtcblx0XHR2YXIgbW9udGg7XG5cdFx0dmFyIGRheTtcblx0XHR2YXIgaG91cjtcblx0XHR2YXIgbWludXRlO1xuXHRcdHZhciBzZWNvbmQ7XG5cblx0XHRpZiAoICEgbWF0Y2hlcyApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHR5ZWFyID0gTnVtYmVyKCBtYXRjaGVzWyAxIF0gKTtcblx0XHRtb250aCA9IE51bWJlciggbWF0Y2hlc1sgMiBdICk7XG5cdFx0ZGF5ID0gTnVtYmVyKCBtYXRjaGVzWyAzIF0gKTtcblx0XHRob3VyID0gTnVtYmVyKCBtYXRjaGVzWyA0IF0gKTtcblx0XHRtaW51dGUgPSBOdW1iZXIoIG1hdGNoZXNbIDUgXSApO1xuXHRcdHNlY29uZCA9IE51bWJlciggbWF0Y2hlc1sgNiBdICk7XG5cdFx0aWYgKFxuXHRcdFx0ISBpc192YWxpZF9jYWxlbmRhcl9kYXRlKCB5ZWFyLCBtb250aCwgZGF5IClcblx0XHRcdHx8IGhvdXIgPiAyM1xuXHRcdFx0fHwgbWludXRlID4gNTlcblx0XHRcdHx8IDAgIT09IHNlY29uZFxuXHRcdFx0fHwgKCBtYXRjaGVzWyA3IF0gJiYgL1sxLTldLy50ZXN0KCBtYXRjaGVzWyA3IF0gKSApXG5cdFx0XHR8fCBOdW1iZXIoIG1hdGNoZXNbIDkgXSApID4gMjNcblx0XHRcdHx8IE51bWJlciggbWF0Y2hlc1sgMTAgXSApID4gNTlcblx0XHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRvZmZzZXRfbWludXRlcyA9ICggTnVtYmVyKCBtYXRjaGVzWyA5IF0gKSAqIDYwICsgTnVtYmVyKCBtYXRjaGVzWyAxMCBdICkgKSAqICggJy0nID09PSBtYXRjaGVzWyA4IF0gPyAtMSA6IDEgKTtcblx0XHR3YWxsX2Vwb2NoID0gTWF0aC5mbG9vciggRGF0ZS5VVEMoXG5cdFx0XHR5ZWFyLFxuXHRcdFx0bW9udGggLSAxLFxuXHRcdFx0ZGF5LFxuXHRcdFx0aG91cixcblx0XHRcdG1pbnV0ZSxcblx0XHRcdHNlY29uZFxuXHRcdCkgLyAxMDAwICk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0YXQ6IFN0cmluZyggdGltZXN0YW1wICksXG5cdFx0XHRlcG9jaDogd2FsbF9lcG9jaCAtIG9mZnNldF9taW51dGVzICogc2Vjb25kc19wZXJfbWludXRlLFxuXHRcdFx0ZGF0ZTogbWF0Y2hlc1sgMSBdICsgJy0nICsgbWF0Y2hlc1sgMiBdICsgJy0nICsgbWF0Y2hlc1sgMyBdLFxuXHRcdFx0d2FsbF9taW51dGU6IGhvdXIgKiA2MCArIG1pbnV0ZSxcblx0XHRcdG9mZnNldF9taW51dGVzOiBvZmZzZXRfbWludXRlc1xuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydCBhbiBleHBsaWNpdCB3YWxsIG1pbnV0ZSBhbmQgb2Zmc2V0IGludG8gYW4gZXBvY2guXG5cdCAqXG5cdCAqIERhdGUuVVRDIGlzIHVzZWQgb25seSBhcyBhbiBleHBsaWNpdCBVVEMgY2FsZW5kYXItdG8tZXBvY2ggcHJpbWl0aXZlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZGF0ZSBTaXRlLWxvY2FsIGRhdGUuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSB3YWxsX21pbnV0ZSBXYWxsLWNsb2NrIG1pbnV0ZSwgaW5jbHVkaW5nIDE0NDAgYXMgbmV4dCBtaWRuaWdodC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IG9mZnNldF9zZWNvbmRzIFNpZ25lZCBVVEMgb2Zmc2V0IHNlY29uZHMuXG5cdCAqIEByZXR1cm4ge251bWJlcn0gRXhhY3QgZXBvY2ggc2Vjb25kcy5cblx0ICovXG5cdGZ1bmN0aW9uIHdhbGxfbWludXRlX3RvX2Vwb2NoKCBkYXRlLCB3YWxsX21pbnV0ZSwgb2Zmc2V0X3NlY29uZHMgKSB7XG5cdFx0dmFyIGRhdGVfcGFydHMgPSBkYXRlLnNwbGl0KCAnLScgKS5tYXAoIE51bWJlciApO1xuXHRcdHZhciBob3VyID0gTWF0aC5mbG9vciggd2FsbF9taW51dGUgLyA2MCApO1xuXHRcdHZhciBtaW51dGUgPSB3YWxsX21pbnV0ZSAlIDYwO1xuXG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoIERhdGUuVVRDKCBkYXRlX3BhcnRzWyAwIF0sIGRhdGVfcGFydHNbIDEgXSAtIDEsIGRhdGVfcGFydHNbIDIgXSwgaG91ciwgbWludXRlLCAwICkgLyAxMDAwICkgLSBvZmZzZXRfc2Vjb25kcztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYSBzYWZlIGludmFsaWQtcmVzdWx0IERUTy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGNvZGUgU3RhYmxlIGZhaWx1cmUgY29kZS5cblx0ICogQHJldHVybiB7T2JqZWN0fSBJbnZhbGlkIHJlc3VsdC5cblx0ICovXG5cdGZ1bmN0aW9uIGludmFsaWRfcmVzdWx0KCBjb2RlICkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzY2hlbWFfdmVyc2lvbjogc2NoZW1hX3ZlcnNpb24sXG5cdFx0XHRzdGF0dXM6ICdpbnZhbGlkJyxcblx0XHRcdGNvZGU6IFN0cmluZyggY29kZSB8fCAnZ2VvbWV0cnlfaW52YWxpZCcgKVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIG9uZSBzZXJ2ZXIgdHJhbnNpdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHsqfSB0cmFuc2l0aW9uIENhbmRpZGF0ZSB0cmFuc2l0aW9uLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTm9ybWFsaXplZCB0cmFuc2l0aW9uIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfdHJhbnNpdGlvbiggdHJhbnNpdGlvbiApIHtcblx0XHR2YXIga2luZCA9IFN0cmluZyggdHJhbnNpdGlvbiAmJiB0cmFuc2l0aW9uLmtpbmQgfHwgJycgKTtcblx0XHR2YXIgZXBvY2ggPSBOdW1iZXIoIHRyYW5zaXRpb24gJiYgdHJhbnNpdGlvbi5lcG9jaCApO1xuXHRcdHZhciB3YWxsX3N0YXJ0ID0gTnVtYmVyKCB0cmFuc2l0aW9uICYmIHRyYW5zaXRpb24ud2FsbF9yYW5nZV9zdGFydF9taW51dGUgKTtcblx0XHR2YXIgd2FsbF9lbmQgPSBOdW1iZXIoIHRyYW5zaXRpb24gJiYgdHJhbnNpdGlvbi53YWxsX3JhbmdlX2VuZF9taW51dGUgKTtcblx0XHR2YXIgb2Zmc2V0X2JlZm9yZSA9IE51bWJlciggdHJhbnNpdGlvbiAmJiB0cmFuc2l0aW9uLm9mZnNldF9iZWZvcmVfc2Vjb25kcyApO1xuXHRcdHZhciBvZmZzZXRfYWZ0ZXIgPSBOdW1iZXIoIHRyYW5zaXRpb24gJiYgdHJhbnNpdGlvbi5vZmZzZXRfYWZ0ZXJfc2Vjb25kcyApO1xuXHRcdHZhciByYW5nZV9zZWNvbmRzO1xuXG5cdFx0aWYgKFxuXHRcdFx0KCAnZ2FwJyAhPT0ga2luZCAmJiAnZm9sZCcgIT09IGtpbmQgKVxuXHRcdFx0fHwgISBOdW1iZXIuaXNJbnRlZ2VyKCBlcG9jaCApXG5cdFx0XHR8fCAhIE51bWJlci5pc0ludGVnZXIoIHdhbGxfc3RhcnQgKVxuXHRcdFx0fHwgISBOdW1iZXIuaXNJbnRlZ2VyKCB3YWxsX2VuZCApXG5cdFx0XHR8fCB3YWxsX3N0YXJ0IDwgMFxuXHRcdFx0fHwgd2FsbF9lbmQgPiBtaW51dGVzX3Blcl9kYXlcblx0XHRcdHx8IHdhbGxfc3RhcnQgPj0gd2FsbF9lbmRcblx0XHRcdHx8ICEgTnVtYmVyLmlzSW50ZWdlciggb2Zmc2V0X2JlZm9yZSApXG5cdFx0XHR8fCAhIE51bWJlci5pc0ludGVnZXIoIG9mZnNldF9hZnRlciApXG5cdFx0XHR8fCAwICE9PSBvZmZzZXRfYmVmb3JlICUgc2Vjb25kc19wZXJfbWludXRlXG5cdFx0XHR8fCAwICE9PSBvZmZzZXRfYWZ0ZXIgJSBzZWNvbmRzX3Blcl9taW51dGVcblx0XHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyYW5nZV9zZWNvbmRzID0gKCB3YWxsX2VuZCAtIHdhbGxfc3RhcnQgKSAqIHNlY29uZHNfcGVyX21pbnV0ZTtcblx0XHRpZiAoXG5cdFx0XHQoICdnYXAnID09PSBraW5kICYmIG9mZnNldF9hZnRlciAtIG9mZnNldF9iZWZvcmUgIT09IHJhbmdlX3NlY29uZHMgKVxuXHRcdFx0fHwgKCAnZm9sZCcgPT09IGtpbmQgJiYgb2Zmc2V0X2JlZm9yZSAtIG9mZnNldF9hZnRlciAhPT0gcmFuZ2Vfc2Vjb25kcyApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dHJhbnNpdGlvbl9pZDogU3RyaW5nKCB0cmFuc2l0aW9uLnRyYW5zaXRpb25faWQgfHwgJ3RyYW5zaXRpb24tJyArIGVwb2NoICksXG5cdFx0XHRlcG9jaDogZXBvY2gsXG5cdFx0XHRraW5kOiBraW5kLFxuXHRcdFx0d2FsbF9yYW5nZV9zdGFydF9taW51dGU6IHdhbGxfc3RhcnQsXG5cdFx0XHR3YWxsX3JhbmdlX2VuZF9taW51dGU6IHdhbGxfZW5kLFxuXHRcdFx0b2Zmc2V0X2JlZm9yZV9zZWNvbmRzOiBvZmZzZXRfYmVmb3JlLFxuXHRcdFx0b2Zmc2V0X2FmdGVyX3NlY29uZHM6IG9mZnNldF9hZnRlclxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIG9uZSBleGFjdCBzZXJ2ZXIgZGF0ZSBiYW5kLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGRhdGVfYmFuZCBDYW5kaWRhdGUgZGF0ZSBiYW5kLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTm9ybWFsaXplZCBkYXRlIGJhbmQgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9kYXRlX2JhbmQoIGRhdGVfYmFuZCApIHtcblx0XHR2YXIgc3RhcnQgPSBwYXJzZV9leGFjdF90aW1lc3RhbXAoIGRhdGVfYmFuZCAmJiBkYXRlX2JhbmQuc3RhcnRfYXQgKTtcblx0XHR2YXIgZW5kID0gcGFyc2VfZXhhY3RfdGltZXN0YW1wKCBkYXRlX2JhbmQgJiYgZGF0ZV9iYW5kLmVuZF9hdCApO1xuXHRcdHZhciBkYXRlID0gU3RyaW5nKCBkYXRlX2JhbmQgJiYgZGF0ZV9iYW5kLmRhdGUgfHwgKCBzdGFydCA/IHN0YXJ0LmRhdGUgOiAnJyApICk7XG5cdFx0dmFyIHN1cHBsaWVkX3N0YXJ0X2Vwb2NoID0gTnVtYmVyKCBkYXRlX2JhbmQgJiYgZGF0ZV9iYW5kLnN0YXJ0X2Vwb2NoICk7XG5cdFx0dmFyIHN1cHBsaWVkX2VuZF9lcG9jaCA9IE51bWJlciggZGF0ZV9iYW5kICYmIGRhdGVfYmFuZC5lbmRfZXBvY2ggKTtcblx0XHR2YXIgc3VwcGxpZWRfZWxhcHNlZF9taW51dGVzID0gTnVtYmVyKCBkYXRlX2JhbmQgJiYgZGF0ZV9iYW5kLmVsYXBzZWRfbWludXRlcyApO1xuXHRcdHZhciBzdXBwbGllZF93YWxsX21pbnV0ZXMgPSBOdW1iZXIoIGRhdGVfYmFuZCAmJiBkYXRlX2JhbmQud2FsbF9taW51dGVzICk7XG5cdFx0dmFyIHRyYW5zaXRpb25zO1xuXHRcdHZhciB0cmFuc2l0aW9uX2ludmFsaWQgPSBmYWxzZTtcblx0XHR2YXIgZXhwZWN0ZWRfc3RhcnRfb2Zmc2V0X3NlY29uZHM7XG5cblx0XHRpZiAoXG5cdFx0XHQhIHN0YXJ0XG5cdFx0XHR8fCAhIGVuZFxuXHRcdFx0fHwgISBkYXRlXG5cdFx0XHR8fCBzdGFydC5kYXRlICE9PSBkYXRlXG5cdFx0XHR8fCBzdGFydC5lcG9jaCA+PSBlbmQuZXBvY2hcblx0XHRcdHx8ICggTnVtYmVyLmlzRmluaXRlKCBzdXBwbGllZF9zdGFydF9lcG9jaCApICYmIHN1cHBsaWVkX3N0YXJ0X2Vwb2NoICE9PSBzdGFydC5lcG9jaCApXG5cdFx0XHR8fCAoIE51bWJlci5pc0Zpbml0ZSggc3VwcGxpZWRfZW5kX2Vwb2NoICkgJiYgc3VwcGxpZWRfZW5kX2Vwb2NoICE9PSBlbmQuZXBvY2ggKVxuXHRcdFx0fHwgKCBOdW1iZXIuaXNGaW5pdGUoIHN1cHBsaWVkX2VsYXBzZWRfbWludXRlcyApICYmIHN1cHBsaWVkX2VsYXBzZWRfbWludXRlcyAhPT0gKCBlbmQuZXBvY2ggLSBzdGFydC5lcG9jaCApIC8gc2Vjb25kc19wZXJfbWludXRlIClcblx0XHRcdHx8ICggTnVtYmVyLmlzRmluaXRlKCBzdXBwbGllZF93YWxsX21pbnV0ZXMgKSAmJiBtaW51dGVzX3Blcl9kYXkgIT09IHN1cHBsaWVkX3dhbGxfbWludXRlcyApXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0dHJhbnNpdGlvbnMgPSAoIEFycmF5LmlzQXJyYXkoIGRhdGVfYmFuZC50cmFuc2l0aW9ucyApID8gZGF0ZV9iYW5kLnRyYW5zaXRpb25zIDogW10gKVxuXHRcdFx0Lm1hcCggbm9ybWFsaXplX3RyYW5zaXRpb24gKVxuXHRcdFx0LmZpbHRlciggQm9vbGVhbiApXG5cdFx0XHQuc29ydCggZnVuY3Rpb24gKCBsZWZ0LCByaWdodCApIHtcblx0XHRcdFx0cmV0dXJuIGxlZnQuZXBvY2ggLSByaWdodC5lcG9jaDtcblx0XHRcdH0gKTtcblx0XHRpZiAoIHRyYW5zaXRpb25zLmxlbmd0aCAhPT0gKCBBcnJheS5pc0FycmF5KCBkYXRlX2JhbmQudHJhbnNpdGlvbnMgKSA/IGRhdGVfYmFuZC50cmFuc2l0aW9ucy5sZW5ndGggOiAwICkgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0dHJhbnNpdGlvbnMuZm9yRWFjaCggZnVuY3Rpb24gKCB0cmFuc2l0aW9uLCBpbmRleCApIHtcblx0XHRcdHZhciBiZWZvcmVfd2FsbF9taW51dGUgPSAnZ2FwJyA9PT0gdHJhbnNpdGlvbi5raW5kID8gdHJhbnNpdGlvbi53YWxsX3JhbmdlX3N0YXJ0X21pbnV0ZSA6IHRyYW5zaXRpb24ud2FsbF9yYW5nZV9lbmRfbWludXRlO1xuXHRcdFx0dmFyIGFmdGVyX3dhbGxfbWludXRlID0gJ2dhcCcgPT09IHRyYW5zaXRpb24ua2luZCA/IHRyYW5zaXRpb24ud2FsbF9yYW5nZV9lbmRfbWludXRlIDogdHJhbnNpdGlvbi53YWxsX3JhbmdlX3N0YXJ0X21pbnV0ZTtcblx0XHRcdHZhciBwcmV2aW91c190cmFuc2l0aW9uID0gaW5kZXggPiAwID8gdHJhbnNpdGlvbnNbIGluZGV4IC0gMSBdIDogbnVsbDtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHR0cmFuc2l0aW9uLmVwb2NoIDwgc3RhcnQuZXBvY2hcblx0XHRcdFx0fHwgdHJhbnNpdGlvbi5lcG9jaCA+PSBlbmQuZXBvY2hcblx0XHRcdFx0fHwgdHJhbnNpdGlvbi5lcG9jaCAhPT0gd2FsbF9taW51dGVfdG9fZXBvY2goIGRhdGUsIGJlZm9yZV93YWxsX21pbnV0ZSwgdHJhbnNpdGlvbi5vZmZzZXRfYmVmb3JlX3NlY29uZHMgKVxuXHRcdFx0XHR8fCB0cmFuc2l0aW9uLmVwb2NoICE9PSB3YWxsX21pbnV0ZV90b19lcG9jaCggZGF0ZSwgYWZ0ZXJfd2FsbF9taW51dGUsIHRyYW5zaXRpb24ub2Zmc2V0X2FmdGVyX3NlY29uZHMgKVxuXHRcdFx0XHR8fCAoIHByZXZpb3VzX3RyYW5zaXRpb24gJiYgcHJldmlvdXNfdHJhbnNpdGlvbi53YWxsX3JhbmdlX2VuZF9taW51dGUgPiB0cmFuc2l0aW9uLndhbGxfcmFuZ2Vfc3RhcnRfbWludXRlIClcblx0XHRcdFx0fHwgKCBwcmV2aW91c190cmFuc2l0aW9uICYmIHByZXZpb3VzX3RyYW5zaXRpb24ub2Zmc2V0X2FmdGVyX3NlY29uZHMgIT09IHRyYW5zaXRpb24ub2Zmc2V0X2JlZm9yZV9zZWNvbmRzIClcblx0XHRcdCkge1xuXHRcdFx0XHR0cmFuc2l0aW9uX2ludmFsaWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRleHBlY3RlZF9zdGFydF9vZmZzZXRfc2Vjb25kcyA9IHRyYW5zaXRpb25zLmxlbmd0aCAmJiB0cmFuc2l0aW9uc1sgMCBdLmVwb2NoID09PSBzdGFydC5lcG9jaFxuXHRcdFx0PyB0cmFuc2l0aW9uc1sgMCBdLm9mZnNldF9hZnRlcl9zZWNvbmRzXG5cdFx0XHQ6ICggdHJhbnNpdGlvbnMubGVuZ3RoID8gdHJhbnNpdGlvbnNbIDAgXS5vZmZzZXRfYmVmb3JlX3NlY29uZHMgOiBzdGFydC5vZmZzZXRfbWludXRlcyAqIHNlY29uZHNfcGVyX21pbnV0ZSApO1xuXHRcdGlmIChcblx0XHRcdHRyYW5zaXRpb25faW52YWxpZFxuXHRcdFx0fHwgc3RhcnQub2Zmc2V0X21pbnV0ZXMgKiBzZWNvbmRzX3Blcl9taW51dGUgIT09IGV4cGVjdGVkX3N0YXJ0X29mZnNldF9zZWNvbmRzXG5cdFx0XHR8fCAoIHRyYW5zaXRpb25zLmxlbmd0aCAmJiBlbmQub2Zmc2V0X21pbnV0ZXMgKiBzZWNvbmRzX3Blcl9taW51dGUgIT09IHRyYW5zaXRpb25zWyB0cmFuc2l0aW9ucy5sZW5ndGggLSAxIF0ub2Zmc2V0X2FmdGVyX3NlY29uZHMgKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRhdGU6IGRhdGUsXG5cdFx0XHRzdGFydF9hdDogc3RhcnQuYXQsXG5cdFx0XHRlbmRfYXQ6IGVuZC5hdCxcblx0XHRcdHN0YXJ0X2Vwb2NoOiBzdGFydC5lcG9jaCxcblx0XHRcdGVuZF9lcG9jaDogZW5kLmVwb2NoLFxuXHRcdFx0c3RhcnRfb2Zmc2V0X21pbnV0ZXM6IHN0YXJ0Lm9mZnNldF9taW51dGVzLFxuXHRcdFx0ZW5kX29mZnNldF9taW51dGVzOiBlbmQub2Zmc2V0X21pbnV0ZXMsXG5cdFx0XHRlbGFwc2VkX21pbnV0ZXM6ICggZW5kLmVwb2NoIC0gc3RhcnQuZXBvY2ggKSAvIHNlY29uZHNfcGVyX21pbnV0ZSxcblx0XHRcdHRyYW5zaXRpb25zOiB0cmFuc2l0aW9uc1xuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHRoZSBhY2NlcHRlZCBpZGVudGl0eSB1c2VkIGJ5IGJvdGggaW50ZXJhY3Rpb24gbW9kdWxlcy5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBpZGVudGl0eSBDYW5kaWRhdGUgYWNjZXB0ZWQgaWRlbnRpdHkuXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBKU09OLXNhZmUgaWRlbnRpdHkgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9hY2NlcHRlZF9pZGVudGl0eSggaWRlbnRpdHkgKSB7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCBpZGVudGl0eSAmJiBpZGVudGl0eS5yZXNvdXJjZV9pZCApO1xuXHRcdHZhciBib29raW5nX2dlbmVyYXRpb24gPSBOdW1iZXIoIGlkZW50aXR5ICYmIGlkZW50aXR5LmJvb2tpbmdfZ2VuZXJhdGlvbiApO1xuXHRcdHZhciBhdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbiA9IE51bWJlciggaWRlbnRpdHkgJiYgaWRlbnRpdHkuYXZhaWxhYmlsaXR5X2dlbmVyYXRpb24gKTtcblx0XHR2YXIgcmVzb3VyY2VfZmluZ2VycHJpbnQgPSBpZGVudGl0eSAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIGlkZW50aXR5LnJlc291cmNlX2ZpbmdlcnByaW50ID8gaWRlbnRpdHkucmVzb3VyY2VfZmluZ2VycHJpbnQgOiAnJztcblx0XHR2YXIgdGltZXpvbmUgPSBpZGVudGl0eSAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIGlkZW50aXR5LnRpbWV6b25lID8gaWRlbnRpdHkudGltZXpvbmUgOiAnJztcblx0XHR2YXIgc3VwcGxpZWRfd2luZG93X2tleXMgPSBBcnJheS5pc0FycmF5KCBpZGVudGl0eSAmJiBpZGVudGl0eS5hY2NlcHRlZF93aW5kb3dfa2V5cyApID8gaWRlbnRpdHkuYWNjZXB0ZWRfd2luZG93X2tleXMgOiBbXTtcblx0XHR2YXIgc2Vlbl93aW5kb3dfa2V5cyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIgZHVwbGljYXRlX3dpbmRvd19rZXkgPSBmYWxzZTtcblx0XHR2YXIgd2luZG93X2tleXM7XG5cblx0XHRpZiAoXG5cdFx0XHQhIE51bWJlci5pc0ludGVnZXIoIHJlc291cmNlX2lkIClcblx0XHRcdHx8IHJlc291cmNlX2lkIDw9IDBcblx0XHRcdHx8ICEgTnVtYmVyLmlzSW50ZWdlciggYm9va2luZ19nZW5lcmF0aW9uIClcblx0XHRcdHx8IGJvb2tpbmdfZ2VuZXJhdGlvbiA8IDBcblx0XHRcdHx8ICEgTnVtYmVyLmlzSW50ZWdlciggYXZhaWxhYmlsaXR5X2dlbmVyYXRpb24gKVxuXHRcdFx0fHwgYXZhaWxhYmlsaXR5X2dlbmVyYXRpb24gPCAwXG5cdFx0XHR8fCAhIHJlc291cmNlX2ZpbmdlcnByaW50XG5cdFx0XHR8fCAhIHRpbWV6b25lXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0d2luZG93X2tleXMgPSBzdXBwbGllZF93aW5kb3dfa2V5cy5maWx0ZXIoIGZ1bmN0aW9uICggd2luZG93X2tleSApIHtcblx0XHRcdGlmICggJ3N0cmluZycgIT09IHR5cGVvZiB3aW5kb3dfa2V5IHx8ICEgd2luZG93X2tleSB8fCBzZWVuX3dpbmRvd19rZXlzWyB3aW5kb3dfa2V5IF0gKSB7XG5cdFx0XHRcdGR1cGxpY2F0ZV93aW5kb3dfa2V5ID0gZHVwbGljYXRlX3dpbmRvd19rZXkgfHwgQm9vbGVhbiggc2Vlbl93aW5kb3dfa2V5c1sgd2luZG93X2tleSBdICk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHNlZW5fd2luZG93X2tleXNbIHdpbmRvd19rZXkgXSA9IHRydWU7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gKTtcblx0XHRpZiAoICEgd2luZG93X2tleXMubGVuZ3RoIHx8IHdpbmRvd19rZXlzLmxlbmd0aCAhPT0gc3VwcGxpZWRfd2luZG93X2tleXMubGVuZ3RoIHx8IGR1cGxpY2F0ZV93aW5kb3dfa2V5ICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcblx0XHRcdHJlc291cmNlX2ZpbmdlcnByaW50OiByZXNvdXJjZV9maW5nZXJwcmludCxcblx0XHRcdGJvb2tpbmdfZ2VuZXJhdGlvbjogYm9va2luZ19nZW5lcmF0aW9uLFxuXHRcdFx0YXZhaWxhYmlsaXR5X2dlbmVyYXRpb246IGF2YWlsYWJpbGl0eV9nZW5lcmF0aW9uLFxuXHRcdFx0YWNjZXB0ZWRfd2luZG93X2tleXM6IHdpbmRvd19rZXlzLFxuXHRcdFx0dGltZXpvbmU6IHRpbWV6b25lXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQcmVwYXJlIG9uZSBpbW11dGFibGUtZGF0YSBnZW9tZXRyeSBzbmFwc2hvdCB3aXRoIGJvdW5kZWQgc29ydGluZyB3b3JrLlxuXHQgKlxuXHQgKiBUaGUgcmV0dXJuZWQgRFRPIGNvbnRhaW5zIGluZGV4ZXMgYXMgSlNPTi1zYWZlIHJlY29yZHMuIENhbGxlcnMgbWF5IHJldGFpblxuXHQgKiB0aGUgRFRPLCBidXQgdGhlIGtlcm5lbCByZXRhaW5zIG5vIHJlZmVyZW5jZSBvciByZXF1ZXN0IHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGlucHV0IEdlb21ldHJ5IGlucHV0IERUTy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBSZWFkeSBzbmFwc2hvdCByZXN1bHQgb3IgaW52YWxpZCByZXN1bHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBwcmVwYXJlX2dlb21ldHJ5KCBpbnB1dCApIHtcblx0XHR2YXIgaWRlbnRpdHkgPSBub3JtYWxpemVfYWNjZXB0ZWRfaWRlbnRpdHkoIGlucHV0ICYmIGlucHV0LmFjY2VwdGVkX2lkZW50aXR5ICk7XG5cdFx0dmFyIHZpc2libGVfcmFuZ2UgPSBpbnB1dCAmJiBpbnB1dC52aXNpYmxlX3JhbmdlIHx8IHt9O1xuXHRcdHZhciByYW5nZV9zdGFydCA9IE51bWJlciggdmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGUgKTtcblx0XHR2YXIgcmFuZ2VfZW5kID0gTnVtYmVyKCB2aXNpYmxlX3JhbmdlLmVuZF9taW51dGUgKTtcblx0XHR2YXIgem9vbV9wZXJjZW50ID0gTnVtYmVyKCBpbnB1dCAmJiBpbnB1dC56b29tX3BlcmNlbnQgKTtcblx0XHR2YXIgaG91cl9oZWlnaHRfcHggPSBOdW1iZXIoIGlucHV0ICYmIGlucHV0LmhvdXJfaGVpZ2h0X3B4ICk7XG5cdFx0dmFyIGJsb2NrX2V4dGVudF9weCA9IE51bWJlciggaW5wdXQgJiYgaW5wdXQuYmxvY2tfZXh0ZW50X3B4ICk7XG5cdFx0dmFyIHNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgPSBOdW1iZXIoIGlucHV0ICYmIGlucHV0LnNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgKTtcblx0XHR2YXIgZGlyZWN0aW9uID0gU3RyaW5nKCBpbnB1dCAmJiBpbnB1dC5kaXJlY3Rpb24gfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xuXHRcdHZhciBiYW5kc19ieV9kYXRlID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciBkYXRlX2JhbmRzID0gW107XG5cdFx0dmFyIGRhdGVfb3JkZXIgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIGNvbHVtbl9kYXRlcyA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblx0XHR2YXIgZGF0ZV9jb2x1bW5zO1xuXHRcdHZhciBpbmxpbmVfZXh0ZW50ID0gMDtcblx0XHR2YXIgaW52YWxpZF9iYW5kID0gZmFsc2U7XG5cblx0XHRpZiAoICEgaWRlbnRpdHkgKSB7XG5cdFx0XHRyZXR1cm4gaW52YWxpZF9yZXN1bHQoICdhY2NlcHRlZF9pZGVudGl0eV9pbnZhbGlkJyApO1xuXHRcdH1cblx0XHRpZiAoXG5cdFx0XHQhIE51bWJlci5pc0ludGVnZXIoIHJhbmdlX3N0YXJ0IClcblx0XHRcdHx8ICEgTnVtYmVyLmlzSW50ZWdlciggcmFuZ2VfZW5kIClcblx0XHRcdHx8IHJhbmdlX3N0YXJ0IDwgMFxuXHRcdFx0fHwgcmFuZ2VfZW5kID4gbWludXRlc19wZXJfZGF5XG5cdFx0XHR8fCByYW5nZV9zdGFydCA+PSByYW5nZV9lbmRcblx0XHQpIHtcblx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ3Zpc2libGVfcmFuZ2VfaW52YWxpZCcgKTtcblx0XHR9XG5cdFx0aWYgKFxuXHRcdFx0ISBOdW1iZXIuaXNJbnRlZ2VyKCBzZWxlY3Rpb25fc3RlcF9taW51dGVzIClcblx0XHRcdHx8IHNlbGVjdGlvbl9zdGVwX21pbnV0ZXMgPD0gMFxuXHRcdFx0fHwgMCAhPT0gbWludXRlc19wZXJfZGF5ICUgc2VsZWN0aW9uX3N0ZXBfbWludXRlc1xuXHRcdFx0fHwgMCAhPT0gcmFuZ2Vfc3RhcnQgJSBzZWxlY3Rpb25fc3RlcF9taW51dGVzXG5cdFx0XHR8fCAwICE9PSByYW5nZV9lbmQgJSBzZWxlY3Rpb25fc3RlcF9taW51dGVzXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gaW52YWxpZF9yZXN1bHQoICdzZWxlY3Rpb25fc3RlcF9pbnZhbGlkJyApO1xuXHRcdH1cblx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCB6b29tX3BlcmNlbnQgKSB8fCB6b29tX3BlcmNlbnQgPCBtaW5pbXVtX3pvb21fcGVyY2VudCB8fCB6b29tX3BlcmNlbnQgPiBtYXhpbXVtX3pvb21fcGVyY2VudCApIHtcblx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ3pvb21faW52YWxpZCcgKTtcblx0XHR9XG5cdFx0aWYgKCAhIE51bWJlci5pc0Zpbml0ZSggaG91cl9oZWlnaHRfcHggKSB8fCBob3VyX2hlaWdodF9weCA8PSAwIHx8IGhvdXJfaGVpZ2h0X3B4ID4gMTAwMCApIHtcblx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ2hvdXJfaGVpZ2h0X2ludmFsaWQnICk7XG5cdFx0fVxuXHRcdGlmICggISBOdW1iZXIuaXNGaW5pdGUoIGJsb2NrX2V4dGVudF9weCApIHx8IGJsb2NrX2V4dGVudF9weCA8PSAwIHx8IGJsb2NrX2V4dGVudF9weCA+IDEwMDAwMCApIHtcblx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ2Jsb2NrX2V4dGVudF9pbnZhbGlkJyApO1xuXHRcdH1cblx0XHRpZiAoICdsdHInICE9PSBkaXJlY3Rpb24gJiYgJ3J0bCcgIT09IGRpcmVjdGlvbiApIHtcblx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ2RpcmVjdGlvbl9pbnZhbGlkJyApO1xuXHRcdH1cblxuXHRcdCggQXJyYXkuaXNBcnJheSggaW5wdXQuZGF0ZV9iYW5kcyApID8gaW5wdXQuZGF0ZV9iYW5kcyA6IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjYW5kaWRhdGVfYmFuZCApIHtcblx0XHRcdHZhciBkYXRlX2JhbmQgPSBub3JtYWxpemVfZGF0ZV9iYW5kKCBjYW5kaWRhdGVfYmFuZCApO1xuXG5cdFx0XHRpZiAoICEgZGF0ZV9iYW5kICkge1xuXHRcdFx0XHRpbnZhbGlkX2JhbmQgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJhbmRzX2J5X2RhdGVbIGRhdGVfYmFuZC5kYXRlIF0gKSB7XG5cdFx0XHRcdGlmICggaGFzaF9pZGVudGl0eSggYmFuZHNfYnlfZGF0ZVsgZGF0ZV9iYW5kLmRhdGUgXSApICE9PSBoYXNoX2lkZW50aXR5KCBkYXRlX2JhbmQgKSApIHtcblx0XHRcdFx0XHRpbnZhbGlkX2JhbmQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGJhbmRzX2J5X2RhdGVbIGRhdGVfYmFuZC5kYXRlIF0gPSBkYXRlX2JhbmQ7XG5cdFx0XHRkYXRlX2JhbmRzLnB1c2goIGRhdGVfYmFuZCApO1xuXHRcdH0gKTtcblx0XHRkYXRlX2JhbmRzLnNvcnQoIGZ1bmN0aW9uICggbGVmdCwgcmlnaHQgKSB7XG5cdFx0XHRyZXR1cm4gbGVmdC5zdGFydF9lcG9jaCAtIHJpZ2h0LnN0YXJ0X2Vwb2NoO1xuXHRcdH0gKTtcblx0XHRkYXRlX2JhbmRzLmZvckVhY2goIGZ1bmN0aW9uICggZGF0ZV9iYW5kLCBpbmRleCApIHtcblx0XHRcdGRhdGVfb3JkZXJbIGRhdGVfYmFuZC5kYXRlIF0gPSBpbmRleDtcblx0XHR9ICk7XG5cdFx0aWYgKCBpbnZhbGlkX2JhbmQgfHwgISBkYXRlX2JhbmRzLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ2RhdGVfYmFuZF9pbnZhbGlkJyApO1xuXHRcdH1cblxuXHRcdGRhdGVfY29sdW1ucyA9ICggQXJyYXkuaXNBcnJheSggaW5wdXQuZGF0ZV9jb2x1bW5zICkgPyBpbnB1dC5kYXRlX2NvbHVtbnMgOiBbXSApLm1hcCggZnVuY3Rpb24gKCBkYXRlX2NvbHVtbiApIHtcblx0XHRcdHZhciBsb2dpY2FsX3N0YXJ0ID0gTnVtYmVyKCBkYXRlX2NvbHVtbiAmJiBkYXRlX2NvbHVtbi5sb2dpY2FsX3N0YXJ0ICk7XG5cdFx0XHR2YXIgbG9naWNhbF9lbmQgPSBOdW1iZXIoIGRhdGVfY29sdW1uICYmIGRhdGVfY29sdW1uLmxvZ2ljYWxfZW5kICk7XG5cdFx0XHR2YXIgZGF0ZSA9IFN0cmluZyggZGF0ZV9jb2x1bW4gJiYgZGF0ZV9jb2x1bW4uZGF0ZSB8fCAnJyApO1xuXG5cdFx0XHRpZiAoICEgYmFuZHNfYnlfZGF0ZVsgZGF0ZSBdIHx8IGNvbHVtbl9kYXRlc1sgZGF0ZSBdIHx8ICEgTnVtYmVyLmlzRmluaXRlKCBsb2dpY2FsX3N0YXJ0ICkgfHwgISBOdW1iZXIuaXNGaW5pdGUoIGxvZ2ljYWxfZW5kICkgfHwgbG9naWNhbF9zdGFydCA8IDAgfHwgbG9naWNhbF9zdGFydCA+PSBsb2dpY2FsX2VuZCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjb2x1bW5fZGF0ZXNbIGRhdGUgXSA9IHRydWU7XG5cdFx0XHRpbmxpbmVfZXh0ZW50ID0gTWF0aC5tYXgoIGlubGluZV9leHRlbnQsIGxvZ2ljYWxfZW5kICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGRhdGU6IGRhdGUsXG5cdFx0XHRcdGxvZ2ljYWxfc3RhcnQ6IGxvZ2ljYWxfc3RhcnQsXG5cdFx0XHRcdGxvZ2ljYWxfZW5kOiBsb2dpY2FsX2VuZFxuXHRcdFx0fTtcblx0XHR9ICkuZmlsdGVyKCBCb29sZWFuICkuc29ydCggZnVuY3Rpb24gKCBsZWZ0LCByaWdodCApIHtcblx0XHRcdHJldHVybiBsZWZ0LmxvZ2ljYWxfc3RhcnQgLSByaWdodC5sb2dpY2FsX3N0YXJ0O1xuXHRcdH0gKTtcblx0XHRpZiAoICEgZGF0ZV9jb2x1bW5zLmxlbmd0aCB8fCBkYXRlX2NvbHVtbnMubGVuZ3RoICE9PSAoIEFycmF5LmlzQXJyYXkoIGlucHV0LmRhdGVfY29sdW1ucyApID8gaW5wdXQuZGF0ZV9jb2x1bW5zLmxlbmd0aCA6IDAgKSApIHtcblx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ2RhdGVfY29sdW1uX2ludmFsaWQnICk7XG5cdFx0fVxuXHRcdGRhdGVfY29sdW1ucy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbHVtbiwgaW5kZXggKSB7XG5cdFx0XHR2YXIgcHJldmlvdXNfY29sdW1uID0gaW5kZXggPiAwID8gZGF0ZV9jb2x1bW5zWyBpbmRleCAtIDEgXSA6IG51bGw7XG5cdFx0XHR2YXIgYm91bmRhcnlfZGlmZmVyZW5jZTtcblxuXHRcdFx0aWYgKCAhIHByZXZpb3VzX2NvbHVtbiApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Ym91bmRhcnlfZGlmZmVyZW5jZSA9IGNvbHVtbi5sb2dpY2FsX3N0YXJ0IC0gcHJldmlvdXNfY29sdW1uLmxvZ2ljYWxfZW5kO1xuXHRcdFx0aWYgKCBNYXRoLmFicyggYm91bmRhcnlfZGlmZmVyZW5jZSApIDw9IGNvbHVtbl9ib3VuZGFyeV9lcHNpbG9uX3B4ICkge1xuXHRcdFx0XHQvKiBQcmVzZXJ2ZSBvbmUgZGV0ZXJtaW5pc3RpYyBoYWxmLW9wZW4gZWRnZSBhY3Jvc3MgYnJvd3NlciB6b29tIHJvdW5kaW5nLiAqL1xuXHRcdFx0XHRjb2x1bW4ubG9naWNhbF9zdGFydCA9IHByZXZpb3VzX2NvbHVtbi5sb2dpY2FsX2VuZDtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0aWYgKCBkYXRlX2NvbHVtbnMuc29tZSggZnVuY3Rpb24gKCBjb2x1bW4sIGluZGV4ICkge1xuXHRcdFx0cmV0dXJuIGluZGV4ID4gMCAmJiBkYXRlX2NvbHVtbnNbIGluZGV4IC0gMSBdLmxvZ2ljYWxfZW5kID4gY29sdW1uLmxvZ2ljYWxfc3RhcnQ7XG5cdFx0fSApICkge1xuXHRcdFx0cmV0dXJuIGludmFsaWRfcmVzdWx0KCAnZGF0ZV9jb2x1bW5fb3ZlcmxhcCcgKTtcblx0XHR9XG5cdFx0aWYgKCBkYXRlX2NvbHVtbnMuc29tZSggZnVuY3Rpb24gKCBjb2x1bW4sIGluZGV4ICkge1xuXHRcdFx0dmFyIHByZXZpb3VzX2NvbHVtbiA9IGluZGV4ID4gMCA/IGRhdGVfY29sdW1uc1sgaW5kZXggLSAxIF0gOiBudWxsO1xuXG5cdFx0XHRyZXR1cm4gcHJldmlvdXNfY29sdW1uICYmIChcblx0XHRcdFx0ZGF0ZV9vcmRlclsgY29sdW1uLmRhdGUgXSAhPT0gZGF0ZV9vcmRlclsgcHJldmlvdXNfY29sdW1uLmRhdGUgXSArIDFcblx0XHRcdFx0fHwgYmFuZHNfYnlfZGF0ZVsgcHJldmlvdXNfY29sdW1uLmRhdGUgXS5lbmRfZXBvY2ggIT09IGJhbmRzX2J5X2RhdGVbIGNvbHVtbi5kYXRlIF0uc3RhcnRfZXBvY2hcblx0XHRcdCk7XG5cdFx0fSApICkge1xuXHRcdFx0cmV0dXJuIGludmFsaWRfcmVzdWx0KCAnZGF0ZV9jb2x1bW5fY292ZXJhZ2VfZ2FwJyApO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzY2hlbWFfdmVyc2lvbjogc2NoZW1hX3ZlcnNpb24sXG5cdFx0XHRzdGF0dXM6ICdyZWFkeScsXG5cdFx0XHRzbmFwc2hvdDoge1xuXHRcdFx0XHRzY2hlbWFfdmVyc2lvbjogc2NoZW1hX3ZlcnNpb24sXG5cdFx0XHRcdGFjY2VwdGVkX2lkZW50aXR5OiBpZGVudGl0eSxcblx0XHRcdFx0YWNjZXB0ZWRfaWRlbnRpdHlfaGFzaDogaGFzaF9pZGVudGl0eSggaWRlbnRpdHkgKSxcblx0XHRcdFx0Z2VvbWV0cnlfaWRlbnRpdHlfaGFzaDogaGFzaF9pZGVudGl0eSgge1xuXHRcdFx0XHRcdGFjY2VwdGVkX2lkZW50aXR5OiBpZGVudGl0eSxcblx0XHRcdFx0XHRkYXRlX2JhbmRzOiBkYXRlX2JhbmRzLm1hcCggZnVuY3Rpb24gKCBkYXRlX2JhbmQgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gWyBkYXRlX2JhbmQuZGF0ZSwgZGF0ZV9iYW5kLnN0YXJ0X2Vwb2NoLCBkYXRlX2JhbmQuZW5kX2Vwb2NoLCBkYXRlX2JhbmQudHJhbnNpdGlvbnMgXTtcblx0XHRcdFx0XHR9ICksXG5cdFx0XHRcdFx0dmlzaWJsZV9yYW5nZTogWyByYW5nZV9zdGFydCwgcmFuZ2VfZW5kIF0sXG5cdFx0XHRcdFx0em9vbV9wZXJjZW50OiB6b29tX3BlcmNlbnQsXG5cdFx0XHRcdFx0aG91cl9oZWlnaHRfcHg6IGhvdXJfaGVpZ2h0X3B4LFxuXHRcdFx0XHRcdGJsb2NrX2V4dGVudF9weDogYmxvY2tfZXh0ZW50X3B4LFxuXHRcdFx0XHRcdHNlbGVjdGlvbl9zdGVwX21pbnV0ZXM6IHNlbGVjdGlvbl9zdGVwX21pbnV0ZXMsXG5cdFx0XHRcdFx0ZGlyZWN0aW9uOiBkaXJlY3Rpb25cblx0XHRcdFx0fSApLFxuXHRcdFx0XHRkYXRlX2JhbmRzOiBkYXRlX2JhbmRzLFxuXHRcdFx0XHRiYW5kc19ieV9kYXRlOiBiYW5kc19ieV9kYXRlLFxuXHRcdFx0XHRkYXRlX29yZGVyOiBkYXRlX29yZGVyLFxuXHRcdFx0XHRkYXRlX2NvbHVtbnM6IGRhdGVfY29sdW1ucyxcblx0XHRcdFx0aW5saW5lX2V4dGVudDogaW5saW5lX2V4dGVudCxcblx0XHRcdFx0dmlzaWJsZV9yYW5nZToge1xuXHRcdFx0XHRcdHN0YXJ0X21pbnV0ZTogcmFuZ2Vfc3RhcnQsXG5cdFx0XHRcdFx0ZW5kX21pbnV0ZTogcmFuZ2VfZW5kXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHpvb21fcGVyY2VudDogem9vbV9wZXJjZW50LFxuXHRcdFx0XHRob3VyX2hlaWdodF9weDogaG91cl9oZWlnaHRfcHgsXG5cdFx0XHRcdGJsb2NrX2V4dGVudF9weDogYmxvY2tfZXh0ZW50X3B4LFxuXHRcdFx0XHRzZWxlY3Rpb25fc3RlcF9taW51dGVzOiBzZWxlY3Rpb25fc3RlcF9taW51dGVzLFxuXHRcdFx0XHRkaXJlY3Rpb246IGRpcmVjdGlvbixcblx0XHRcdFx0cGl4ZWxzX3Blcl9taW51dGU6IGJsb2NrX2V4dGVudF9weCAvICggcmFuZ2VfZW5kIC0gcmFuZ2Vfc3RhcnQgKVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogTG9jYXRlIGEgZGF0ZSBjb2x1bW4gYnkgYW4gaW5jcmVhc2luZyBsb2dpY2FsIGlubGluZSBjb29yZGluYXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IGRhdGVfY29sdW1ucyBTb3J0ZWQgZGF0ZSBjb2x1bW5zLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gbG9naWNhbF9pbmxpbmUgTG9naWNhbCBjb29yZGluYXRlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTWF0Y2hpbmcgaGFsZi1vcGVuIGNvbHVtbiBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gZmluZF9kYXRlX2NvbHVtbiggZGF0ZV9jb2x1bW5zLCBsb2dpY2FsX2lubGluZSApIHtcblx0XHR2YXIgbG93ID0gMDtcblx0XHR2YXIgaGlnaCA9IGRhdGVfY29sdW1ucy5sZW5ndGggLSAxO1xuXHRcdHZhciBtaWRkbGU7XG5cdFx0dmFyIGNvbHVtbjtcblxuXHRcdHdoaWxlICggbG93IDw9IGhpZ2ggKSB7XG5cdFx0XHRtaWRkbGUgPSBNYXRoLmZsb29yKCAoIGxvdyArIGhpZ2ggKSAvIDIgKTtcblx0XHRcdGNvbHVtbiA9IGRhdGVfY29sdW1uc1sgbWlkZGxlIF07XG5cdFx0XHRpZiAoIGxvZ2ljYWxfaW5saW5lIDwgY29sdW1uLmxvZ2ljYWxfc3RhcnQgKSB7XG5cdFx0XHRcdGhpZ2ggPSBtaWRkbGUgLSAxO1xuXHRcdFx0fSBlbHNlIGlmICggbG9naWNhbF9pbmxpbmUgPj0gY29sdW1uLmxvZ2ljYWxfZW5kICkge1xuXHRcdFx0XHRsb3cgPSBtaWRkbGUgKyAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGNvbHVtbjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBGb3JtYXQgb25lIG9mZnNldCBpbiBSRkMzMzM5IGZvcm0uXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXRfbWludXRlcyBTaWduZWQgb2Zmc2V0IG1pbnV0ZXMuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gYCtISDpNTWAgb3IgYC1ISDpNTWAuXG5cdCAqL1xuXHRmdW5jdGlvbiBmb3JtYXRfb2Zmc2V0KCBvZmZzZXRfbWludXRlcyApIHtcblx0XHR2YXIgYWJzb2x1dGVfbWludXRlcyA9IE1hdGguYWJzKCBvZmZzZXRfbWludXRlcyApO1xuXHRcdHZhciBob3VycyA9IE1hdGguZmxvb3IoIGFic29sdXRlX21pbnV0ZXMgLyA2MCApO1xuXHRcdHZhciBtaW51dGVzID0gYWJzb2x1dGVfbWludXRlcyAlIDYwO1xuXG5cdFx0cmV0dXJuICggb2Zmc2V0X21pbnV0ZXMgPCAwID8gJy0nIDogJysnIClcblx0XHRcdCsgU3RyaW5nKCBob3VycyApLnBhZFN0YXJ0KCAyLCAnMCcgKVxuXHRcdFx0KyAnOidcblx0XHRcdCsgU3RyaW5nKCBtaW51dGVzICkucGFkU3RhcnQoIDIsICcwJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIG9uZSBleGFjdCBjYW5kaWRhdGUgZnJvbSBzZXJ2ZXItb3duZWQgb2Zmc2V0IG1ldGFkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGF0ZV9iYW5kIEV4YWN0IGRhdGUgYmFuZC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHdhbGxfbWludXRlIFdhbGwtY2xvY2sgbWludXRlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0X3NlY29uZHMgU2lnbmVkIG9mZnNldCBzZWNvbmRzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gb2NjdXJyZW5jZSBPY2N1cnJlbmNlIGxhYmVsLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gb2NjdXJyZW5jZV9pZCBTdGFibGUgb2NjdXJyZW5jZSBpZGVudGl0eS5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEV4YWN0IGNhbmRpZGF0ZSBvciBudWxsIG91dHNpZGUgdGhlIGRhdGUgYmFuZC5cblx0ICovXG5cdGZ1bmN0aW9uIGJ1aWxkX2NhbmRpZGF0ZSggZGF0ZV9iYW5kLCB3YWxsX21pbnV0ZSwgb2Zmc2V0X3NlY29uZHMsIG9jY3VycmVuY2UsIG9jY3VycmVuY2VfaWQgKSB7XG5cdFx0dmFyIGhvdXIgPSBNYXRoLmZsb29yKCB3YWxsX21pbnV0ZSAvIDYwICk7XG5cdFx0dmFyIG1pbnV0ZSA9IHdhbGxfbWludXRlICUgNjA7XG5cdFx0dmFyIGVwb2NoID0gd2FsbF9taW51dGVfdG9fZXBvY2goIGRhdGVfYmFuZC5kYXRlLCB3YWxsX21pbnV0ZSwgb2Zmc2V0X3NlY29uZHMgKTtcblx0XHR2YXIgb2Zmc2V0X21pbnV0ZXMgPSBvZmZzZXRfc2Vjb25kcyAvIHNlY29uZHNfcGVyX21pbnV0ZTtcblxuXHRcdGlmICggZXBvY2ggPCBkYXRlX2JhbmQuc3RhcnRfZXBvY2ggfHwgZXBvY2ggPj0gZGF0ZV9iYW5kLmVuZF9lcG9jaCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRlOiBkYXRlX2JhbmQuZGF0ZSxcblx0XHRcdHdhbGxfbWludXRlOiB3YWxsX21pbnV0ZSxcblx0XHRcdGF0OiBkYXRlX2JhbmQuZGF0ZSArICdUJyArIFN0cmluZyggaG91ciApLnBhZFN0YXJ0KCAyLCAnMCcgKSArICc6JyArIFN0cmluZyggbWludXRlICkucGFkU3RhcnQoIDIsICcwJyApICsgJzowMCcgKyBmb3JtYXRfb2Zmc2V0KCBvZmZzZXRfbWludXRlcyApLFxuXHRcdFx0ZXBvY2g6IGVwb2NoLFxuXHRcdFx0b2Zmc2V0X21pbnV0ZXM6IG9mZnNldF9taW51dGVzLFxuXHRcdFx0d2FsbF9vY2N1cnJlbmNlOiBvY2N1cnJlbmNlLFxuXHRcdFx0b2NjdXJyZW5jZV9pZDogb2NjdXJyZW5jZV9pZFxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogUmVzb2x2ZSBvbmUgZXhhY3Qgd2FsbCBib3VuZGFyeSBmcm9tIHNlcnZlciBkYXRlLWJhbmQgdHJhbnNpdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzbmFwc2hvdCBQcmVwYXJlZCBnZW9tZXRyeSBzbmFwc2hvdC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGRhdGUgU2l0ZS1sb2NhbCBkYXRlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gd2FsbF9taW51dGUgV2FsbC1jbG9jayBtaW51dGUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBvY2N1cnJlbmNlX2lkIE9wdGlvbmFsIGV4cGxpY2l0IGZvbGQgb2NjdXJyZW5jZS5cblx0ICogQHJldHVybiB7T2JqZWN0fSBFeGFjdCwgZ2FwLCBmb2xkLCBvciBvdXRzaWRlIHJlc3VsdC5cblx0ICovXG5cdGZ1bmN0aW9uIHJlc29sdmVfd2FsbF9ib3VuZGFyeSggc25hcHNob3QsIGRhdGUsIHdhbGxfbWludXRlLCBvY2N1cnJlbmNlX2lkICkge1xuXHRcdHZhciBkYXRlX2JhbmQgPSBzbmFwc2hvdC5iYW5kc19ieV9kYXRlWyBkYXRlIF07XG5cdFx0dmFyIGFjdGl2ZV9vZmZzZXRfc2Vjb25kcztcblx0XHR2YXIgdHJhbnNpdGlvbl9tYXRjaCA9IG51bGw7XG5cdFx0dmFyIGNhbmRpZGF0ZXMgPSBbXTtcblxuXHRcdGlmICggISBkYXRlX2JhbmQgfHwgISBOdW1iZXIuaXNJbnRlZ2VyKCB3YWxsX21pbnV0ZSApIHx8IHdhbGxfbWludXRlIDwgMCB8fCB3YWxsX21pbnV0ZSA+IG1pbnV0ZXNfcGVyX2RheSApIHtcblx0XHRcdHJldHVybiB7IHN0YXR1czogJ291dHNpZGUnLCBjb2RlOiAnY292ZXJhZ2Vfb3V0c2lkZScsIGNhbmRpZGF0ZXM6IFtdIH07XG5cdFx0fVxuXHRcdGlmICggbWludXRlc19wZXJfZGF5ID09PSB3YWxsX21pbnV0ZSApIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHN0YXR1czogJ2V4YWN0Jyxcblx0XHRcdFx0dHJhbnNpdGlvbl9pZDogJycsXG5cdFx0XHRcdGNhbmRpZGF0ZXM6IFsge1xuXHRcdFx0XHRcdGRhdGU6IGRhdGUsXG5cdFx0XHRcdFx0d2FsbF9taW51dGU6IG1pbnV0ZXNfcGVyX2RheSxcblx0XHRcdFx0XHRhdDogZGF0ZV9iYW5kLmVuZF9hdCxcblx0XHRcdFx0XHRlcG9jaDogZGF0ZV9iYW5kLmVuZF9lcG9jaCxcblx0XHRcdFx0XHRvZmZzZXRfbWludXRlczogZGF0ZV9iYW5kLmVuZF9vZmZzZXRfbWludXRlcyxcblx0XHRcdFx0XHR3YWxsX29jY3VycmVuY2U6ICdvbmx5Jyxcblx0XHRcdFx0XHRvY2N1cnJlbmNlX2lkOiBkYXRlICsgJy1lbmQnXG5cdFx0XHRcdH0gXVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRhY3RpdmVfb2Zmc2V0X3NlY29uZHMgPSBkYXRlX2JhbmQuc3RhcnRfb2Zmc2V0X21pbnV0ZXMgKiBzZWNvbmRzX3Blcl9taW51dGU7XG5cdFx0ZGF0ZV9iYW5kLnRyYW5zaXRpb25zLmZvckVhY2goIGZ1bmN0aW9uICggdHJhbnNpdGlvbiApIHtcblx0XHRcdGlmICggd2FsbF9taW51dGUgPj0gdHJhbnNpdGlvbi53YWxsX3JhbmdlX3N0YXJ0X21pbnV0ZSAmJiB3YWxsX21pbnV0ZSA8IHRyYW5zaXRpb24ud2FsbF9yYW5nZV9lbmRfbWludXRlICkge1xuXHRcdFx0XHR0cmFuc2l0aW9uX21hdGNoID0gdHJhbnNpdGlvbjtcblx0XHRcdH1cblx0XHRcdGlmICggd2FsbF9taW51dGUgPj0gdHJhbnNpdGlvbi53YWxsX3JhbmdlX2VuZF9taW51dGUgKSB7XG5cdFx0XHRcdGFjdGl2ZV9vZmZzZXRfc2Vjb25kcyA9IHRyYW5zaXRpb24ub2Zmc2V0X2FmdGVyX3NlY29uZHM7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0aWYgKCB0cmFuc2l0aW9uX21hdGNoICYmICdnYXAnID09PSB0cmFuc2l0aW9uX21hdGNoLmtpbmQgKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRzdGF0dXM6ICdnYXAnLFxuXHRcdFx0XHR0cmFuc2l0aW9uX2lkOiB0cmFuc2l0aW9uX21hdGNoLnRyYW5zaXRpb25faWQsXG5cdFx0XHRcdGNhbmRpZGF0ZXM6IFtdXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRpZiAoIHRyYW5zaXRpb25fbWF0Y2ggJiYgJ2ZvbGQnID09PSB0cmFuc2l0aW9uX21hdGNoLmtpbmQgKSB7XG5cdFx0XHRjYW5kaWRhdGVzID0gW1xuXHRcdFx0XHRidWlsZF9jYW5kaWRhdGUoIGRhdGVfYmFuZCwgd2FsbF9taW51dGUsIHRyYW5zaXRpb25fbWF0Y2gub2Zmc2V0X2JlZm9yZV9zZWNvbmRzLCAnZmlyc3QnLCB0cmFuc2l0aW9uX21hdGNoLnRyYW5zaXRpb25faWQgKyAnOmZpcnN0JyApLFxuXHRcdFx0XHRidWlsZF9jYW5kaWRhdGUoIGRhdGVfYmFuZCwgd2FsbF9taW51dGUsIHRyYW5zaXRpb25fbWF0Y2gub2Zmc2V0X2FmdGVyX3NlY29uZHMsICdzZWNvbmQnLCB0cmFuc2l0aW9uX21hdGNoLnRyYW5zaXRpb25faWQgKyAnOnNlY29uZCcgKVxuXHRcdFx0XS5maWx0ZXIoIEJvb2xlYW4gKS5zb3J0KCBmdW5jdGlvbiAoIGxlZnQsIHJpZ2h0ICkge1xuXHRcdFx0XHRyZXR1cm4gbGVmdC5lcG9jaCAtIHJpZ2h0LmVwb2NoO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKCBvY2N1cnJlbmNlX2lkICkge1xuXHRcdFx0XHRjYW5kaWRhdGVzID0gY2FuZGlkYXRlcy5maWx0ZXIoIGZ1bmN0aW9uICggY2FuZGlkYXRlICkge1xuXHRcdFx0XHRcdHJldHVybiBjYW5kaWRhdGUub2NjdXJyZW5jZV9pZCA9PT0gb2NjdXJyZW5jZV9pZDtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiAoIDEgIT09IGNhbmRpZGF0ZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHJldHVybiB7IHN0YXR1czogJ291dHNpZGUnLCBjb2RlOiAnZm9sZF9vY2N1cnJlbmNlX2ludmFsaWQnLCB0cmFuc2l0aW9uX2lkOiB0cmFuc2l0aW9uX21hdGNoLnRyYW5zaXRpb25faWQsIGNhbmRpZGF0ZXM6IFtdIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHsgc3RhdHVzOiAnZXhhY3QnLCB0cmFuc2l0aW9uX2lkOiB0cmFuc2l0aW9uX21hdGNoLnRyYW5zaXRpb25faWQsIGNhbmRpZGF0ZXM6IGNhbmRpZGF0ZXMgfTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHsgc3RhdHVzOiAnZm9sZCcsIHRyYW5zaXRpb25faWQ6IHRyYW5zaXRpb25fbWF0Y2gudHJhbnNpdGlvbl9pZCwgY2FuZGlkYXRlczogY2FuZGlkYXRlcyB9O1xuXHRcdH1cblxuXHRcdGNhbmRpZGF0ZXMgPSBbIGJ1aWxkX2NhbmRpZGF0ZSggZGF0ZV9iYW5kLCB3YWxsX21pbnV0ZSwgYWN0aXZlX29mZnNldF9zZWNvbmRzLCAnb25seScsIGRhdGUgKyAnLScgKyB3YWxsX21pbnV0ZSApIF0uZmlsdGVyKCBCb29sZWFuICk7XG5cblx0XHRyZXR1cm4gMSA9PT0gY2FuZGlkYXRlcy5sZW5ndGhcblx0XHRcdD8geyBzdGF0dXM6ICdleGFjdCcsIHRyYW5zaXRpb25faWQ6ICcnLCBjYW5kaWRhdGVzOiBjYW5kaWRhdGVzIH1cblx0XHRcdDogeyBzdGF0dXM6ICdvdXRzaWRlJywgY29kZTogJ2NvdmVyYWdlX291dHNpZGUnLCB0cmFuc2l0aW9uX2lkOiAnJywgY2FuZGlkYXRlczogW10gfTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIG9uZSBleGFjdCB3YWxsIG1pbnV0ZSBpbmRlcGVuZGVudGx5IG9mIHRoZSBzZWxlY3Rpb24tc3RlcCBncmlkLlxuXHQgKlxuXHQgKiBFeGlzdGluZyBib29raW5ncyBtYXkgcmV0YWluIGNhbm9uaWNhbCBtaW51dGUgYm91bmRhcmllcyB0aGF0IGRvIG5vdCBhbGlnblxuXHQgKiB3aXRoIHRoZSBjdXJyZW50IGRyYWZ0aW5nIHN0ZXAuIFRoaXMgbmV1dHJhbCByZXNvbHZlciBwcmVzZXJ2ZXMgdGhvc2UgZXhhY3Rcblx0ICogbWludXRlcyB3aGlsZSBjb250aW51aW5nIHRvIHVzZSBzZXJ2ZXItYXV0aG9yZWQgZGF0ZSBiYW5kcyBhbmQgdHJhbnNpdGlvblxuXHQgKiBjYW5kaWRhdGVzIGZvciBnYXAgYW5kIGZvbGQgaGFuZGxpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzbmFwc2hvdCAgICAgIFByZXBhcmVkIGltbXV0YWJsZSBnZW9tZXRyeSBzbmFwc2hvdC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGRhdGUgICAgICAgICAgQ292ZXJlZCBJU08gY2FsZW5kYXIgZGF0ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHdhbGxfbWludXRlICAgRXhhY3Qgd2FsbCBtaW51dGUgZnJvbSAwIHRocm91Z2ggMTQ0MC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG9jY3VycmVuY2VfaWQgT3B0aW9uYWwgZXhwbGljaXQgZm9sZCBvY2N1cnJlbmNlIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRXhhY3QsIGdhcCwgZm9sZCwgb3V0c2lkZSwgb3IgaW52YWxpZCB3YWxsLXRpbWUgcmVzdWx0LlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzb2x2ZV93YWxsX3RpbWUoIHNuYXBzaG90LCBkYXRlLCB3YWxsX21pbnV0ZSwgb2NjdXJyZW5jZV9pZCApIHtcblx0XHR2YXIgYm91bmRhcnk7XG5cdFx0dmFyIGV4YWN0X2NhbmRpZGF0ZTtcblxuXHRcdGlmICggISBzbmFwc2hvdCB8fCBzY2hlbWFfdmVyc2lvbiAhPT0gc25hcHNob3Quc2NoZW1hX3ZlcnNpb24gKSB7XG5cdFx0XHRyZXR1cm4gaW52YWxpZF9yZXN1bHQoICdzbmFwc2hvdF9pbnZhbGlkJyApO1xuXHRcdH1cblx0XHRkYXRlID0gU3RyaW5nKCBkYXRlIHx8ICcnICk7XG5cdFx0d2FsbF9taW51dGUgPSBOdW1iZXIoIHdhbGxfbWludXRlICk7XG5cdFx0aWYgKCAhIHNuYXBzaG90LmJhbmRzX2J5X2RhdGVbIGRhdGUgXSB8fCAhIE51bWJlci5pc0ludGVnZXIoIHdhbGxfbWludXRlICkgKSB7XG5cdFx0XHRyZXR1cm4gaW52YWxpZF9yZXN1bHQoICd3YWxsX3RpbWVfaW52YWxpZCcgKTtcblx0XHR9XG5cdFx0Ym91bmRhcnkgPSByZXNvbHZlX3dhbGxfYm91bmRhcnkoIHNuYXBzaG90LCBkYXRlLCB3YWxsX21pbnV0ZSwgU3RyaW5nKCBvY2N1cnJlbmNlX2lkIHx8ICcnICkgKTtcblx0XHRleGFjdF9jYW5kaWRhdGUgPSAnZXhhY3QnID09PSBib3VuZGFyeS5zdGF0dXMgJiYgMSA9PT0gYm91bmRhcnkuY2FuZGlkYXRlcy5sZW5ndGggPyBib3VuZGFyeS5jYW5kaWRhdGVzWyAwIF0gOiBudWxsO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNjaGVtYV92ZXJzaW9uOiBzY2hlbWFfdmVyc2lvbixcblx0XHRcdHN0YXR1czogYm91bmRhcnkuc3RhdHVzLFxuXHRcdFx0Y29kZTogYm91bmRhcnkuY29kZSB8fCAnJyxcblx0XHRcdGFjY2VwdGVkX2lkZW50aXR5X2hhc2g6IHNuYXBzaG90LmFjY2VwdGVkX2lkZW50aXR5X2hhc2gsXG5cdFx0XHRkYXRlOiBkYXRlLFxuXHRcdFx0d2FsbF9taW51dGU6IHdhbGxfbWludXRlLFxuXHRcdFx0ZXhhY3RfYXQ6IGV4YWN0X2NhbmRpZGF0ZSA/IGV4YWN0X2NhbmRpZGF0ZS5hdCA6ICcnLFxuXHRcdFx0ZXBvY2g6IGV4YWN0X2NhbmRpZGF0ZSA/IGV4YWN0X2NhbmRpZGF0ZS5lcG9jaCA6IG51bGwsXG5cdFx0XHRvZmZzZXRfbWludXRlczogZXhhY3RfY2FuZGlkYXRlID8gZXhhY3RfY2FuZGlkYXRlLm9mZnNldF9taW51dGVzIDogbnVsbCxcblx0XHRcdHRyYW5zaXRpb25faWQ6IGJvdW5kYXJ5LnRyYW5zaXRpb25faWQgfHwgJycsXG5cdFx0XHRjYW5kaWRhdGVzOiBib3VuZGFyeS5jYW5kaWRhdGVzXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIHRoZSBleGNsdXNpdmUgYm91bmRhcnkgYWZ0ZXIgb25lIHNlbGVjdGVkIGNlbGwuXG5cdCAqXG5cdCAqIEEgY2VsbCBlbmRpbmcgYXQgYSB0cmFuc2l0aW9uIHVzZXMgdGhlIGNocm9ub2xvZ2ljYWwgc2lkZSByZWFjaGVkIGZyb21cblx0ICogaXRzIHNlbGVjdGVkIHN0YXJ0IG9jY3VycmVuY2UuIFRoaXMga2VlcHMgdGhlIHByZWNlZGluZyBzcHJpbmcgY2VsbCBhbmRcblx0ICogYm90aCByZXBlYXRlZCBmYWxsIGNlbGxzIGV4YWN0IHdpdGhvdXQgdHJlYXRpbmcgYSBnYXAgY2VsbCBhcyBzZWxlY3RhYmxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgUHJlcGFyZWQgZ2VvbWV0cnkgc25hcHNob3QuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkYXRlIFNpdGUtbG9jYWwgZGF0ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHdhbGxfbWludXRlIEV4Y2x1c2l2ZSB3YWxsLWNsb2NrIGJvdW5kYXJ5LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc3RhcnRfY2FuZGlkYXRlIEV4YWN0IHNlbGVjdGVkLWNlbGwgc3RhcnQgY2FuZGlkYXRlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gb2NjdXJyZW5jZV9pZCBPcHRpb25hbCBleHBsaWNpdCBmb2xkIGVuZCBvY2N1cnJlbmNlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEV4YWN0LCBnYXAsIGZvbGQsIG9yIG91dHNpZGUgcmVzdWx0LlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzb2x2ZV9leGNsdXNpdmVfZW5kX2JvdW5kYXJ5KCBzbmFwc2hvdCwgZGF0ZSwgd2FsbF9taW51dGUsIHN0YXJ0X2NhbmRpZGF0ZSwgb2NjdXJyZW5jZV9pZCApIHtcblx0XHR2YXIgZGF0ZV9iYW5kID0gc25hcHNob3QuYmFuZHNfYnlfZGF0ZVsgZGF0ZSBdO1xuXHRcdHZhciB0cmFuc2l0aW9uX21hdGNoID0gbnVsbDtcblx0XHR2YXIgb2NjdXJyZW5jZSA9ICcnO1xuXHRcdHZhciBvZmZzZXRfc2Vjb25kcztcblx0XHR2YXIgY2FuZGlkYXRlO1xuXG5cdFx0aWYgKCAhIGRhdGVfYmFuZCApIHtcblx0XHRcdHJldHVybiB7IHN0YXR1czogJ291dHNpZGUnLCBjb2RlOiAnY292ZXJhZ2Vfb3V0c2lkZScsIGNhbmRpZGF0ZXM6IFtdIH07XG5cdFx0fVxuXHRcdGRhdGVfYmFuZC50cmFuc2l0aW9ucy5zb21lKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRpZiAoIHdhbGxfbWludXRlID49IHRyYW5zaXRpb24ud2FsbF9yYW5nZV9zdGFydF9taW51dGUgJiYgd2FsbF9taW51dGUgPD0gdHJhbnNpdGlvbi53YWxsX3JhbmdlX2VuZF9taW51dGUgKSB7XG5cdFx0XHRcdHRyYW5zaXRpb25fbWF0Y2ggPSB0cmFuc2l0aW9uO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gKTtcblx0XHRpZiAoICEgdHJhbnNpdGlvbl9tYXRjaCApIHtcblx0XHRcdHJldHVybiByZXNvbHZlX3dhbGxfYm91bmRhcnkoIHNuYXBzaG90LCBkYXRlLCB3YWxsX21pbnV0ZSwgb2NjdXJyZW5jZV9pZCApO1xuXHRcdH1cblx0XHRpZiAoICdnYXAnID09PSB0cmFuc2l0aW9uX21hdGNoLmtpbmQgKSB7XG5cdFx0XHRpZiAoIHdhbGxfbWludXRlID09PSB0cmFuc2l0aW9uX21hdGNoLndhbGxfcmFuZ2Vfc3RhcnRfbWludXRlICkge1xuXHRcdFx0XHRjYW5kaWRhdGUgPSBidWlsZF9jYW5kaWRhdGUoXG5cdFx0XHRcdFx0ZGF0ZV9iYW5kLFxuXHRcdFx0XHRcdHdhbGxfbWludXRlLFxuXHRcdFx0XHRcdHRyYW5zaXRpb25fbWF0Y2gub2Zmc2V0X2JlZm9yZV9zZWNvbmRzLFxuXHRcdFx0XHRcdCdiZWZvcmVfdHJhbnNpdGlvbicsXG5cdFx0XHRcdFx0dHJhbnNpdGlvbl9tYXRjaC50cmFuc2l0aW9uX2lkICsgJzpiZWZvcmUnXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZVxuXHRcdFx0XHRcdD8geyBzdGF0dXM6ICdleGFjdCcsIHRyYW5zaXRpb25faWQ6IHRyYW5zaXRpb25fbWF0Y2gudHJhbnNpdGlvbl9pZCwgY2FuZGlkYXRlczogWyBjYW5kaWRhdGUgXSB9XG5cdFx0XHRcdFx0OiB7IHN0YXR1czogJ291dHNpZGUnLCBjb2RlOiAnY292ZXJhZ2Vfb3V0c2lkZScsIHRyYW5zaXRpb25faWQ6IHRyYW5zaXRpb25fbWF0Y2gudHJhbnNpdGlvbl9pZCwgY2FuZGlkYXRlczogW10gfTtcblx0XHRcdH1cblx0XHRcdGlmICggd2FsbF9taW51dGUgPCB0cmFuc2l0aW9uX21hdGNoLndhbGxfcmFuZ2VfZW5kX21pbnV0ZSApIHtcblx0XHRcdFx0cmV0dXJuIHsgc3RhdHVzOiAnZ2FwJywgdHJhbnNpdGlvbl9pZDogdHJhbnNpdGlvbl9tYXRjaC50cmFuc2l0aW9uX2lkLCBjYW5kaWRhdGVzOiBbXSB9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzb2x2ZV93YWxsX2JvdW5kYXJ5KCBzbmFwc2hvdCwgZGF0ZSwgd2FsbF9taW51dGUsIG9jY3VycmVuY2VfaWQgKTtcblx0XHR9XG5cblx0XHRpZiAoIG9jY3VycmVuY2VfaWQgKSB7XG5cdFx0XHRpZiAoIHRyYW5zaXRpb25fbWF0Y2gudHJhbnNpdGlvbl9pZCArICc6Zmlyc3QnID09PSBvY2N1cnJlbmNlX2lkICkge1xuXHRcdFx0XHRvY2N1cnJlbmNlID0gJ2ZpcnN0Jztcblx0XHRcdH0gZWxzZSBpZiAoIHRyYW5zaXRpb25fbWF0Y2gudHJhbnNpdGlvbl9pZCArICc6c2Vjb25kJyA9PT0gb2NjdXJyZW5jZV9pZCApIHtcblx0XHRcdFx0b2NjdXJyZW5jZSA9ICdzZWNvbmQnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHsgc3RhdHVzOiAnb3V0c2lkZScsIGNvZGU6ICdmb2xkX29jY3VycmVuY2VfaW52YWxpZCcsIHRyYW5zaXRpb25faWQ6IHRyYW5zaXRpb25fbWF0Y2gudHJhbnNpdGlvbl9pZCwgY2FuZGlkYXRlczogW10gfTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKCAnZmlyc3QnID09PSBzdGFydF9jYW5kaWRhdGUud2FsbF9vY2N1cnJlbmNlIHx8ICdzZWNvbmQnID09PSBzdGFydF9jYW5kaWRhdGUud2FsbF9vY2N1cnJlbmNlICkge1xuXHRcdFx0b2NjdXJyZW5jZSA9IHN0YXJ0X2NhbmRpZGF0ZS53YWxsX29jY3VycmVuY2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9jY3VycmVuY2UgPSAnZmlyc3QnO1xuXHRcdH1cblx0XHRvZmZzZXRfc2Vjb25kcyA9ICdmaXJzdCcgPT09IG9jY3VycmVuY2UgPyB0cmFuc2l0aW9uX21hdGNoLm9mZnNldF9iZWZvcmVfc2Vjb25kcyA6IHRyYW5zaXRpb25fbWF0Y2gub2Zmc2V0X2FmdGVyX3NlY29uZHM7XG5cdFx0Y2FuZGlkYXRlID0gYnVpbGRfY2FuZGlkYXRlKFxuXHRcdFx0ZGF0ZV9iYW5kLFxuXHRcdFx0d2FsbF9taW51dGUsXG5cdFx0XHRvZmZzZXRfc2Vjb25kcyxcblx0XHRcdG9jY3VycmVuY2UsXG5cdFx0XHR0cmFuc2l0aW9uX21hdGNoLnRyYW5zaXRpb25faWQgKyAnOicgKyBvY2N1cnJlbmNlXG5cdFx0KTtcblxuXHRcdHJldHVybiBjYW5kaWRhdGVcblx0XHRcdD8geyBzdGF0dXM6ICdleGFjdCcsIHRyYW5zaXRpb25faWQ6IHRyYW5zaXRpb25fbWF0Y2gudHJhbnNpdGlvbl9pZCwgY2FuZGlkYXRlczogWyBjYW5kaWRhdGUgXSB9XG5cdFx0XHQ6IHsgc3RhdHVzOiAnb3V0c2lkZScsIGNvZGU6ICdjb3ZlcmFnZV9vdXRzaWRlJywgdHJhbnNpdGlvbl9pZDogdHJhbnNpdGlvbl9tYXRjaC50cmFuc2l0aW9uX2lkLCBjYW5kaWRhdGVzOiBbXSB9O1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnQgYSBwb2ludGVyIG9yIGtleWJvYXJkIGNvb3JkaW5hdGUgaW50byBvbmUgc25hcHBlZCBsb2NhbCBjZWxsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgUHJlcGFyZWQgZ2VvbWV0cnkgc25hcHNob3QuXG5cdCAqIEBwYXJhbSB7Kn0gY29vcmRpbmF0ZSBVbnRydXN0ZWQgY29vcmRpbmF0ZSBEVE8uXG5cdCAqIEByZXR1cm4ge09iamVjdH0gQ29vcmRpbmF0ZSByZXN1bHQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXNvbHZlX2Nvb3JkaW5hdGUoIHNuYXBzaG90LCBjb29yZGluYXRlICkge1xuXHRcdHZhciBzb3VyY2U7XG5cdFx0dmFyIHNlbGVjdGlvbl9raW5kO1xuXHRcdHZhciBkYXRlO1xuXHRcdHZhciB3YWxsX21pbnV0ZTtcblx0XHR2YXIgc25hcF9pbmRleDtcblx0XHR2YXIgbG9naWNhbF9pbmxpbmU7XG5cdFx0dmFyIGRhdGVfY29sdW1uO1xuXHRcdHZhciBibG9ja19wb3NpdGlvbjtcblx0XHR2YXIgYm9keV9oZWlnaHQ7XG5cdFx0dmFyIGNsaXBwaW5nID0ge1xuXHRcdFx0YmVmb3JlX3Zpc2libGVfcmFuZ2U6IGZhbHNlLFxuXHRcdFx0YWZ0ZXJfdmlzaWJsZV9yYW5nZTogZmFsc2Vcblx0XHR9O1xuXHRcdHZhciBib3VuZGFyeTtcblx0XHR2YXIgZXhhY3RfY2FuZGlkYXRlO1xuXG5cdFx0aWYgKCAhIHNuYXBzaG90IHx8IHNjaGVtYV92ZXJzaW9uICE9PSBzbmFwc2hvdC5zY2hlbWFfdmVyc2lvbiB8fCAhIGNvb3JkaW5hdGUgfHwgJ29iamVjdCcgIT09IHR5cGVvZiBjb29yZGluYXRlICkge1xuXHRcdFx0cmV0dXJuIGludmFsaWRfcmVzdWx0KCAnc25hcHNob3Rfb3JfY29vcmRpbmF0ZV9pbnZhbGlkJyApO1xuXHRcdH1cblx0XHRzb3VyY2UgPSBTdHJpbmcoIGNvb3JkaW5hdGUuc291cmNlIHx8ICcnICk7XG5cdFx0c2VsZWN0aW9uX2tpbmQgPSBTdHJpbmcoIGNvb3JkaW5hdGUuc2VsZWN0aW9uX2tpbmQgfHwgJ3RpbWVkJyApO1xuXHRcdGlmICggJ3BvaW50ZXInICE9PSBzb3VyY2UgJiYgJ2tleWJvYXJkJyAhPT0gc291cmNlICkge1xuXHRcdFx0cmV0dXJuIGludmFsaWRfcmVzdWx0KCAnY29vcmRpbmF0ZV9zb3VyY2VfaW52YWxpZCcgKTtcblx0XHR9XG5cdFx0aWYgKCAndGltZWQnICE9PSBzZWxlY3Rpb25fa2luZCAmJiAnYWxsX2RheScgIT09IHNlbGVjdGlvbl9raW5kICkge1xuXHRcdFx0cmV0dXJuIGludmFsaWRfcmVzdWx0KCAnc2VsZWN0aW9uX2tpbmRfaW52YWxpZCcgKTtcblx0XHR9XG5cblx0XHRpZiAoICdwb2ludGVyJyA9PT0gc291cmNlICkge1xuXHRcdFx0bG9naWNhbF9pbmxpbmUgPSBOdW1iZXIoIGNvb3JkaW5hdGUuaW5saW5lX3B4ICk7XG5cdFx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCBsb2dpY2FsX2lubGluZSApICkge1xuXHRcdFx0XHRyZXR1cm4gaW52YWxpZF9yZXN1bHQoICdpbmxpbmVfY29vcmRpbmF0ZV9pbnZhbGlkJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAncnRsJyA9PT0gc25hcHNob3QuZGlyZWN0aW9uICkge1xuXHRcdFx0XHRsb2dpY2FsX2lubGluZSA9IHNuYXBzaG90LmlubGluZV9leHRlbnQgLSBsb2dpY2FsX2lubGluZTtcblx0XHRcdH1cblx0XHRcdGRhdGVfY29sdW1uID0gZmluZF9kYXRlX2NvbHVtbiggc25hcHNob3QuZGF0ZV9jb2x1bW5zLCBsb2dpY2FsX2lubGluZSApO1xuXHRcdFx0aWYgKCAhIGRhdGVfY29sdW1uICkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHNjaGVtYV92ZXJzaW9uOiBzY2hlbWFfdmVyc2lvbixcblx0XHRcdFx0XHRzdGF0dXM6ICdvdXRzaWRlJyxcblx0XHRcdFx0XHRjb2RlOiAnZGF0ZV9jb3ZlcmFnZV9vdXRzaWRlJ1xuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0ZGF0ZSA9IGRhdGVfY29sdW1uLmRhdGU7XG5cdFx0XHRpZiAoICdhbGxfZGF5JyA9PT0gc2VsZWN0aW9uX2tpbmQgKSB7XG5cdFx0XHRcdHdhbGxfbWludXRlID0gMDtcblx0XHRcdFx0c25hcF9pbmRleCA9IDA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRibG9ja19wb3NpdGlvbiA9IE51bWJlciggY29vcmRpbmF0ZS5ibG9ja19weCApO1xuXHRcdFx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCBibG9ja19wb3NpdGlvbiApICkge1xuXHRcdFx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ2Jsb2NrX2Nvb3JkaW5hdGVfaW52YWxpZCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRib2R5X2hlaWdodCA9ICggc25hcHNob3QudmlzaWJsZV9yYW5nZS5lbmRfbWludXRlIC0gc25hcHNob3QudmlzaWJsZV9yYW5nZS5zdGFydF9taW51dGUgKSAqIHNuYXBzaG90LnBpeGVsc19wZXJfbWludXRlO1xuXHRcdFx0XHRpZiAoIGJsb2NrX3Bvc2l0aW9uIDwgMCApIHtcblx0XHRcdFx0XHRibG9ja19wb3NpdGlvbiA9IDA7XG5cdFx0XHRcdFx0Y2xpcHBpbmcuYmVmb3JlX3Zpc2libGVfcmFuZ2UgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCBibG9ja19wb3NpdGlvbiA+PSBib2R5X2hlaWdodCApIHtcblx0XHRcdFx0XHRibG9ja19wb3NpdGlvbiA9IE1hdGgubWF4KCAwLCBib2R5X2hlaWdodCAtIDAuMDAwMSApO1xuXHRcdFx0XHRcdGNsaXBwaW5nLmFmdGVyX3Zpc2libGVfcmFuZ2UgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNuYXBfaW5kZXggPSBNYXRoLmZsb29yKCBibG9ja19wb3NpdGlvbiAvICggc25hcHNob3Quc2VsZWN0aW9uX3N0ZXBfbWludXRlcyAqIHNuYXBzaG90LnBpeGVsc19wZXJfbWludXRlICkgKTtcblx0XHRcdFx0d2FsbF9taW51dGUgPSBzbmFwc2hvdC52aXNpYmxlX3JhbmdlLnN0YXJ0X21pbnV0ZSArIHNuYXBfaW5kZXggKiBzbmFwc2hvdC5zZWxlY3Rpb25fc3RlcF9taW51dGVzO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRlID0gU3RyaW5nKCBjb29yZGluYXRlLmRhdGUgfHwgJycgKTtcblx0XHRcdHNuYXBfaW5kZXggPSBOdW1iZXIoIGNvb3JkaW5hdGUuc25hcF9pbmRleCApO1xuXHRcdFx0aWYgKCAhIHNuYXBzaG90LmJhbmRzX2J5X2RhdGVbIGRhdGUgXSB8fCAhIE51bWJlci5pc0ludGVnZXIoIHNuYXBfaW5kZXggKSB8fCBzbmFwX2luZGV4IDwgMCApIHtcblx0XHRcdFx0cmV0dXJuIGludmFsaWRfcmVzdWx0KCAna2V5Ym9hcmRfY29vcmRpbmF0ZV9pbnZhbGlkJyApO1xuXHRcdFx0fVxuXHRcdFx0d2FsbF9taW51dGUgPSAnYWxsX2RheScgPT09IHNlbGVjdGlvbl9raW5kXG5cdFx0XHRcdD8gMFxuXHRcdFx0XHQ6IHNuYXBzaG90LnZpc2libGVfcmFuZ2Uuc3RhcnRfbWludXRlICsgc25hcF9pbmRleCAqIHNuYXBzaG90LnNlbGVjdGlvbl9zdGVwX21pbnV0ZXM7XG5cdFx0XHRpZiAoICd0aW1lZCcgPT09IHNlbGVjdGlvbl9raW5kICYmIHdhbGxfbWludXRlID49IHNuYXBzaG90LnZpc2libGVfcmFuZ2UuZW5kX21pbnV0ZSApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzY2hlbWFfdmVyc2lvbjogc2NoZW1hX3ZlcnNpb24sXG5cdFx0XHRcdFx0c3RhdHVzOiAnb3V0c2lkZScsXG5cdFx0XHRcdFx0Y29kZTogJ3Zpc2libGVfcmFuZ2Vfb3V0c2lkZSdcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRib3VuZGFyeSA9ICdhbGxfZGF5JyA9PT0gc2VsZWN0aW9uX2tpbmRcblx0XHRcdD8ge1xuXHRcdFx0XHRzdGF0dXM6ICdleGFjdCcsXG5cdFx0XHRcdHRyYW5zaXRpb25faWQ6ICcnLFxuXHRcdFx0XHRjYW5kaWRhdGVzOiBbIHtcblx0XHRcdFx0XHRkYXRlOiBkYXRlLFxuXHRcdFx0XHRcdHdhbGxfbWludXRlOiAwLFxuXHRcdFx0XHRcdGF0OiBzbmFwc2hvdC5iYW5kc19ieV9kYXRlWyBkYXRlIF0uc3RhcnRfYXQsXG5cdFx0XHRcdFx0ZXBvY2g6IHNuYXBzaG90LmJhbmRzX2J5X2RhdGVbIGRhdGUgXS5zdGFydF9lcG9jaCxcblx0XHRcdFx0XHRvZmZzZXRfbWludXRlczogc25hcHNob3QuYmFuZHNfYnlfZGF0ZVsgZGF0ZSBdLnN0YXJ0X29mZnNldF9taW51dGVzLFxuXHRcdFx0XHRcdHdhbGxfb2NjdXJyZW5jZTogJ29ubHknLFxuXHRcdFx0XHRcdG9jY3VycmVuY2VfaWQ6IGRhdGUgKyAnLXN0YXJ0J1xuXHRcdFx0XHR9IF1cblx0XHRcdH1cblx0XHRcdDogcmVzb2x2ZV93YWxsX2JvdW5kYXJ5KCBzbmFwc2hvdCwgZGF0ZSwgd2FsbF9taW51dGUsIFN0cmluZyggY29vcmRpbmF0ZS5vY2N1cnJlbmNlX2lkIHx8ICcnICkgKTtcblx0XHRleGFjdF9jYW5kaWRhdGUgPSAnZXhhY3QnID09PSBib3VuZGFyeS5zdGF0dXMgJiYgMSA9PT0gYm91bmRhcnkuY2FuZGlkYXRlcy5sZW5ndGggPyBib3VuZGFyeS5jYW5kaWRhdGVzWyAwIF0gOiBudWxsO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNjaGVtYV92ZXJzaW9uOiBzY2hlbWFfdmVyc2lvbixcblx0XHRcdHN0YXR1czogYm91bmRhcnkuc3RhdHVzLFxuXHRcdFx0Y29kZTogYm91bmRhcnkuY29kZSB8fCAnJyxcblx0XHRcdGFjY2VwdGVkX2lkZW50aXR5X2hhc2g6IHNuYXBzaG90LmFjY2VwdGVkX2lkZW50aXR5X2hhc2gsXG5cdFx0XHRkYXRlOiBkYXRlLFxuXHRcdFx0d2FsbF9taW51dGU6IHdhbGxfbWludXRlLFxuXHRcdFx0c25hcF9pbmRleDogc25hcF9pbmRleCxcblx0XHRcdHNlbGVjdGlvbl9raW5kOiBzZWxlY3Rpb25fa2luZCxcblx0XHRcdGV4YWN0X2F0OiBleGFjdF9jYW5kaWRhdGUgPyBleGFjdF9jYW5kaWRhdGUuYXQgOiAnJyxcblx0XHRcdGVwb2NoOiBleGFjdF9jYW5kaWRhdGUgPyBleGFjdF9jYW5kaWRhdGUuZXBvY2ggOiBudWxsLFxuXHRcdFx0b2Zmc2V0X21pbnV0ZXM6IGV4YWN0X2NhbmRpZGF0ZSA/IGV4YWN0X2NhbmRpZGF0ZS5vZmZzZXRfbWludXRlcyA6IG51bGwsXG5cdFx0XHR0cmFuc2l0aW9uX2lkOiBib3VuZGFyeS50cmFuc2l0aW9uX2lkIHx8ICcnLFxuXHRcdFx0Y2FuZGlkYXRlczogYm91bmRhcnkuY2FuZGlkYXRlcyxcblx0XHRcdGNsaXBwaW5nOiB7XG5cdFx0XHRcdGlzX2NsaXBwZWQ6IGNsaXBwaW5nLmJlZm9yZV92aXNpYmxlX3JhbmdlIHx8IGNsaXBwaW5nLmFmdGVyX3Zpc2libGVfcmFuZ2UsXG5cdFx0XHRcdGJlZm9yZV92aXNpYmxlX3JhbmdlOiBjbGlwcGluZy5iZWZvcmVfdmlzaWJsZV9yYW5nZSxcblx0XHRcdFx0YWZ0ZXJfdmlzaWJsZV9yYW5nZTogY2xpcHBpbmcuYWZ0ZXJfdmlzaWJsZV9yYW5nZVxuXHRcdFx0fSxcblx0XHRcdGNvbnRpbnVhdGlvbjoge1xuXHRcdFx0XHRjb250aW51ZXNfYmVmb3JlX3Zpc2libGVfcmFuZ2U6IGNsaXBwaW5nLmJlZm9yZV92aXNpYmxlX3JhbmdlLFxuXHRcdFx0XHRjb250aW51ZXNfYWZ0ZXJfdmlzaWJsZV9yYW5nZTogY2xpcHBpbmcuYWZ0ZXJfdmlzaWJsZV9yYW5nZVxuXHRcdFx0fSxcblx0XHRcdGRyYWZ0X2lkZW50aXR5OiBbXG5cdFx0XHRcdCd0aW1lLXJvdy1kcmFmdCcsXG5cdFx0XHRcdHNuYXBzaG90Lmdlb21ldHJ5X2lkZW50aXR5X2hhc2gsXG5cdFx0XHRcdGRhdGUsXG5cdFx0XHRcdHNlbGVjdGlvbl9raW5kLFxuXHRcdFx0XHRzbmFwX2luZGV4LFxuXHRcdFx0XHRleGFjdF9jYW5kaWRhdGUgPyAnb2Zmc2V0LScgKyBleGFjdF9jYW5kaWRhdGUub2Zmc2V0X21pbnV0ZXMgKyAnLScgKyBleGFjdF9jYW5kaWRhdGUud2FsbF9vY2N1cnJlbmNlIDogJ3VucmVzb2x2ZWQtJyArIGJvdW5kYXJ5LnN0YXR1c1xuXHRcdFx0XS5qb2luKCAnLScgKVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgb25lIHN0YWJsZSBub24tZXhhY3QgZHJhZnQgcmVzdWx0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc25hcHNob3QgUHJlcGFyZWQgZ2VvbWV0cnkgc25hcHNob3QuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzdGF0dXMgR2FwIG9yIGZvbGQgc3RhdHVzLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gYW5jaG9yIFJlc29sdmVkIGFuY2hvciBjb29yZGluYXRlLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZm9jdXMgUmVzb2x2ZWQgZm9jdXMgY29vcmRpbmF0ZS5cblx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gZW5kX2JvdW5kYXJ5IE9wdGlvbmFsIG5vbi1leGFjdCBleGNsdXNpdmUgYm91bmRhcnkuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gU3RhYmxlIG5vbi1leGFjdCBkcmFmdCBEVE8uXG5cdCAqL1xuXHRmdW5jdGlvbiBidWlsZF9ub25fZXhhY3RfZHJhZnQoIHNuYXBzaG90LCBzdGF0dXMsIGFuY2hvciwgZm9jdXMsIGVuZF9ib3VuZGFyeSApIHtcblx0XHR2YXIgYmVmb3JlX3Zpc2libGVfcmFuZ2UgPSBCb29sZWFuKCBhbmNob3IuY2xpcHBpbmcuYmVmb3JlX3Zpc2libGVfcmFuZ2UgfHwgZm9jdXMuY2xpcHBpbmcuYmVmb3JlX3Zpc2libGVfcmFuZ2UgKTtcblx0XHR2YXIgYWZ0ZXJfdmlzaWJsZV9yYW5nZSA9IEJvb2xlYW4oIGFuY2hvci5jbGlwcGluZy5hZnRlcl92aXNpYmxlX3JhbmdlIHx8IGZvY3VzLmNsaXBwaW5nLmFmdGVyX3Zpc2libGVfcmFuZ2UgKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRzY2hlbWFfdmVyc2lvbjogc2NoZW1hX3ZlcnNpb24sXG5cdFx0XHRzdGF0dXM6IHN0YXR1cyxcblx0XHRcdGFjY2VwdGVkX2lkZW50aXR5X2hhc2g6IHNuYXBzaG90LmFjY2VwdGVkX2lkZW50aXR5X2hhc2gsXG5cdFx0XHRzZWxlY3Rpb25fa2luZDogYW5jaG9yLnNlbGVjdGlvbl9raW5kID09PSBmb2N1cy5zZWxlY3Rpb25fa2luZCA/IGFuY2hvci5zZWxlY3Rpb25fa2luZCA6ICcnLFxuXHRcdFx0YW5jaG9yOiBhbmNob3IsXG5cdFx0XHRmb2N1czogZm9jdXMsXG5cdFx0XHRlbmRfYm91bmRhcnk6IGVuZF9ib3VuZGFyeSB8fCBudWxsLFxuXHRcdFx0Y2xpcHBpbmc6IHtcblx0XHRcdFx0aXNfY2xpcHBlZDogYmVmb3JlX3Zpc2libGVfcmFuZ2UgfHwgYWZ0ZXJfdmlzaWJsZV9yYW5nZSxcblx0XHRcdFx0YmVmb3JlX3Zpc2libGVfcmFuZ2U6IGJlZm9yZV92aXNpYmxlX3JhbmdlLFxuXHRcdFx0XHRhZnRlcl92aXNpYmxlX3JhbmdlOiBhZnRlcl92aXNpYmxlX3JhbmdlXG5cdFx0XHR9LFxuXHRcdFx0Y29udGludWF0aW9uOiB7XG5cdFx0XHRcdGNvbnRpbnVlc19iZWZvcmVfdmlzaWJsZV9yYW5nZTogYmVmb3JlX3Zpc2libGVfcmFuZ2UsXG5cdFx0XHRcdGNvbnRpbnVlc19hZnRlcl92aXNpYmxlX3JhbmdlOiBhZnRlcl92aXNpYmxlX3JhbmdlXG5cdFx0XHR9LFxuXHRcdFx0ZHJhZnRfaWRlbnRpdHk6ICd0aW1lLXJvdy1kcmFmdC0nICsgaGFzaF9pZGVudGl0eSgge1xuXHRcdFx0XHRnZW9tZXRyeV9pZGVudGl0eV9oYXNoOiBzbmFwc2hvdC5nZW9tZXRyeV9pZGVudGl0eV9oYXNoLFxuXHRcdFx0XHRzdGF0dXM6IHN0YXR1cyxcblx0XHRcdFx0YW5jaG9yX2lkZW50aXR5OiBhbmNob3IuZHJhZnRfaWRlbnRpdHksXG5cdFx0XHRcdGZvY3VzX2lkZW50aXR5OiBmb2N1cy5kcmFmdF9pZGVudGl0eSxcblx0XHRcdFx0ZW5kX3RyYW5zaXRpb25faWQ6IGVuZF9ib3VuZGFyeSA/IGVuZF9ib3VuZGFyeS50cmFuc2l0aW9uX2lkIHx8ICcnIDogJydcblx0XHRcdH0gKVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogUmVzb2x2ZSBhbiBpbmNsdXNpdmUgcGFpciBvZiBzZWxlY3RlZCBjZWxscyBpbnRvIG9uZSBoYWxmLW9wZW4gZHJhZnQuXG5cdCAqXG5cdCAqIEZvbGQgYm91bmRhcmllcyByZW1haW4gdW5yZXNvbHZlZCB1bnRpbCBjb29yZGluYXRlcyBjYXJyeSBleHBsaWNpdFxuXHQgKiBvY2N1cnJlbmNlIElEcy4gTm8gbXV0YXRpb24gb3IgcmVxdWVzdCBwbGFuIGlzIGNyZWF0ZWQgaGVyZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHNuYXBzaG90IFByZXBhcmVkIGdlb21ldHJ5IHNuYXBzaG90LlxuXHQgKiBAcGFyYW0geyp9IGFuY2hvcl9jb29yZGluYXRlIEZpcnN0IHNlbGVjdGVkIGNlbGwuXG5cdCAqIEBwYXJhbSB7Kn0gZm9jdXNfY29vcmRpbmF0ZSBDdXJyZW50IHNlbGVjdGVkIGNlbGwuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRXhhY3QgZHJhZnQsIGZvbGQvZ2FwIHJlc3VsdCwgb3IgaW52YWxpZCByZXN1bHQuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXNvbHZlX2RyYWZ0KCBzbmFwc2hvdCwgYW5jaG9yX2Nvb3JkaW5hdGUsIGZvY3VzX2Nvb3JkaW5hdGUgKSB7XG5cdFx0dmFyIGFuY2hvciA9IHJlc29sdmVfY29vcmRpbmF0ZSggc25hcHNob3QsIGFuY2hvcl9jb29yZGluYXRlICk7XG5cdFx0dmFyIGZvY3VzID0gcmVzb2x2ZV9jb29yZGluYXRlKCBzbmFwc2hvdCwgZm9jdXNfY29vcmRpbmF0ZSApO1xuXHRcdHZhciBhbmNob3JfZXBvY2g7XG5cdFx0dmFyIGZvY3VzX2Vwb2NoO1xuXHRcdHZhciBmaXJzdDtcblx0XHR2YXIgbGFzdDtcblx0XHR2YXIgbGFzdF9jb29yZGluYXRlO1xuXHRcdHZhciBlbmRfYm91bmRhcnk7XG5cdFx0dmFyIHNlbGVjdGlvbl9raW5kO1xuXHRcdHZhciBlbmRfd2FsbF9taW51dGU7XG5cdFx0dmFyIHN0YXJ0X2NhbmRpZGF0ZTtcblx0XHR2YXIgZW5kX2NhbmRpZGF0ZTtcblxuXHRcdGlmICggJ2ludmFsaWQnID09PSBhbmNob3Iuc3RhdHVzIHx8ICdpbnZhbGlkJyA9PT0gZm9jdXMuc3RhdHVzIHx8ICdvdXRzaWRlJyA9PT0gYW5jaG9yLnN0YXR1cyB8fCAnb3V0c2lkZScgPT09IGZvY3VzLnN0YXR1cyApIHtcblx0XHRcdHJldHVybiBpbnZhbGlkX3Jlc3VsdCggJ2RyYWZ0X2Nvb3JkaW5hdGVfaW52YWxpZCcgKTtcblx0XHR9XG5cdFx0aWYgKCBhbmNob3Iuc2VsZWN0aW9uX2tpbmQgIT09IGZvY3VzLnNlbGVjdGlvbl9raW5kICkge1xuXHRcdFx0cmV0dXJuIGludmFsaWRfcmVzdWx0KCAnc2VsZWN0aW9uX2tpbmRfbWlzbWF0Y2gnICk7XG5cdFx0fVxuXHRcdGlmICggJ2dhcCcgPT09IGFuY2hvci5zdGF0dXMgfHwgJ2dhcCcgPT09IGZvY3VzLnN0YXR1cyApIHtcblx0XHRcdHJldHVybiBidWlsZF9ub25fZXhhY3RfZHJhZnQoIHNuYXBzaG90LCAnZ2FwJywgYW5jaG9yLCBmb2N1cywgbnVsbCApO1xuXHRcdH1cblx0XHRpZiAoICdmb2xkJyA9PT0gYW5jaG9yLnN0YXR1cyB8fCAnZm9sZCcgPT09IGZvY3VzLnN0YXR1cyApIHtcblx0XHRcdHJldHVybiBidWlsZF9ub25fZXhhY3RfZHJhZnQoIHNuYXBzaG90LCAnZm9sZCcsIGFuY2hvciwgZm9jdXMsIG51bGwgKTtcblx0XHR9XG5cdFx0c2VsZWN0aW9uX2tpbmQgPSBhbmNob3Iuc2VsZWN0aW9uX2tpbmQ7XG5cdFx0YW5jaG9yX2Vwb2NoID0gYW5jaG9yLmNhbmRpZGF0ZXNbIDAgXS5lcG9jaDtcblx0XHRmb2N1c19lcG9jaCA9IGZvY3VzLmNhbmRpZGF0ZXNbIDAgXS5lcG9jaDtcblx0XHRmaXJzdCA9IGFuY2hvcl9lcG9jaCA8PSBmb2N1c19lcG9jaCA/IGFuY2hvciA6IGZvY3VzO1xuXHRcdGxhc3QgPSBhbmNob3JfZXBvY2ggPD0gZm9jdXNfZXBvY2ggPyBmb2N1cyA6IGFuY2hvcjtcblx0XHRsYXN0X2Nvb3JkaW5hdGUgPSBhbmNob3JfZXBvY2ggPD0gZm9jdXNfZXBvY2ggPyBmb2N1c19jb29yZGluYXRlIDogYW5jaG9yX2Nvb3JkaW5hdGU7XG5cdFx0ZW5kX3dhbGxfbWludXRlID0gJ2FsbF9kYXknID09PSBzZWxlY3Rpb25fa2luZFxuXHRcdFx0PyBtaW51dGVzX3Blcl9kYXlcblx0XHRcdDogbGFzdC53YWxsX21pbnV0ZSArIHNuYXBzaG90LnNlbGVjdGlvbl9zdGVwX21pbnV0ZXM7XG5cdFx0ZW5kX2JvdW5kYXJ5ID0gcmVzb2x2ZV9leGNsdXNpdmVfZW5kX2JvdW5kYXJ5KFxuXHRcdFx0c25hcHNob3QsXG5cdFx0XHRsYXN0LmRhdGUsXG5cdFx0XHRlbmRfd2FsbF9taW51dGUsXG5cdFx0XHRsYXN0LmNhbmRpZGF0ZXNbIDAgXSxcblx0XHRcdFN0cmluZyggbGFzdF9jb29yZGluYXRlLmVuZF9vY2N1cnJlbmNlX2lkIHx8ICcnIClcblx0XHQpO1xuXHRcdGlmICggJ2dhcCcgPT09IGVuZF9ib3VuZGFyeS5zdGF0dXMgfHwgJ2ZvbGQnID09PSBlbmRfYm91bmRhcnkuc3RhdHVzICkge1xuXHRcdFx0cmV0dXJuIGJ1aWxkX25vbl9leGFjdF9kcmFmdCggc25hcHNob3QsIGVuZF9ib3VuZGFyeS5zdGF0dXMsIGFuY2hvciwgZm9jdXMsIGVuZF9ib3VuZGFyeSApO1xuXHRcdH1cblx0XHRpZiAoICdleGFjdCcgIT09IGVuZF9ib3VuZGFyeS5zdGF0dXMgfHwgMSAhPT0gZW5kX2JvdW5kYXJ5LmNhbmRpZGF0ZXMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuIGludmFsaWRfcmVzdWx0KCAnZHJhZnRfZW5kX2ludmFsaWQnICk7XG5cdFx0fVxuXG5cdFx0c3RhcnRfY2FuZGlkYXRlID0gZmlyc3QuY2FuZGlkYXRlc1sgMCBdO1xuXHRcdGVuZF9jYW5kaWRhdGUgPSBlbmRfYm91bmRhcnkuY2FuZGlkYXRlc1sgMCBdO1xuXHRcdGlmICggZW5kX2NhbmRpZGF0ZS5lcG9jaCA8PSBzdGFydF9jYW5kaWRhdGUuZXBvY2ggKSB7XG5cdFx0XHRyZXR1cm4gaW52YWxpZF9yZXN1bHQoICdkcmFmdF9pbnRlcnZhbF9pbnZhbGlkJyApO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzY2hlbWFfdmVyc2lvbjogc2NoZW1hX3ZlcnNpb24sXG5cdFx0XHRzdGF0dXM6ICdleGFjdCcsXG5cdFx0XHRhY2NlcHRlZF9pZGVudGl0eV9oYXNoOiBzbmFwc2hvdC5hY2NlcHRlZF9pZGVudGl0eV9oYXNoLFxuXHRcdFx0c2VsZWN0aW9uX2tpbmQ6IHNlbGVjdGlvbl9raW5kLFxuXHRcdFx0c3RhcnQ6IHN0YXJ0X2NhbmRpZGF0ZSxcblx0XHRcdGVuZDogZW5kX2NhbmRpZGF0ZSxcblx0XHRcdGR1cmF0aW9uX21pbnV0ZXM6ICggZW5kX2NhbmRpZGF0ZS5lcG9jaCAtIHN0YXJ0X2NhbmRpZGF0ZS5lcG9jaCApIC8gc2Vjb25kc19wZXJfbWludXRlLFxuXHRcdFx0aXNfaGFsZl9vcGVuOiB0cnVlLFxuXHRcdFx0Y2xpcHBpbmc6IHtcblx0XHRcdFx0aXNfY2xpcHBlZDogYW5jaG9yLmNsaXBwaW5nLmlzX2NsaXBwZWQgfHwgZm9jdXMuY2xpcHBpbmcuaXNfY2xpcHBlZCxcblx0XHRcdFx0YmVmb3JlX3Zpc2libGVfcmFuZ2U6IGFuY2hvci5jbGlwcGluZy5iZWZvcmVfdmlzaWJsZV9yYW5nZSB8fCBmb2N1cy5jbGlwcGluZy5iZWZvcmVfdmlzaWJsZV9yYW5nZSxcblx0XHRcdFx0YWZ0ZXJfdmlzaWJsZV9yYW5nZTogYW5jaG9yLmNsaXBwaW5nLmFmdGVyX3Zpc2libGVfcmFuZ2UgfHwgZm9jdXMuY2xpcHBpbmcuYWZ0ZXJfdmlzaWJsZV9yYW5nZVxuXHRcdFx0fSxcblx0XHRcdGNvbnRpbnVhdGlvbjoge1xuXHRcdFx0XHRjb250aW51ZXNfYmVmb3JlX3Zpc2libGVfcmFuZ2U6IGFuY2hvci5jb250aW51YXRpb24uY29udGludWVzX2JlZm9yZV92aXNpYmxlX3JhbmdlIHx8IGZvY3VzLmNvbnRpbnVhdGlvbi5jb250aW51ZXNfYmVmb3JlX3Zpc2libGVfcmFuZ2UsXG5cdFx0XHRcdGNvbnRpbnVlc19hZnRlcl92aXNpYmxlX3JhbmdlOiBhbmNob3IuY29udGludWF0aW9uLmNvbnRpbnVlc19hZnRlcl92aXNpYmxlX3JhbmdlIHx8IGZvY3VzLmNvbnRpbnVhdGlvbi5jb250aW51ZXNfYWZ0ZXJfdmlzaWJsZV9yYW5nZVxuXHRcdFx0fSxcblx0XHRcdGRyYWZ0X2lkZW50aXR5OiAndGltZS1yb3ctZHJhZnQtJyArIGhhc2hfaWRlbnRpdHkoIHtcblx0XHRcdFx0Z2VvbWV0cnlfaWRlbnRpdHlfaGFzaDogc25hcHNob3QuZ2VvbWV0cnlfaWRlbnRpdHlfaGFzaCxcblx0XHRcdFx0c2VsZWN0aW9uX2tpbmQ6IHNlbGVjdGlvbl9raW5kLFxuXHRcdFx0XHRzdGFydF9hdDogc3RhcnRfY2FuZGlkYXRlLmF0LFxuXHRcdFx0XHRlbmRfYXQ6IGVuZF9jYW5kaWRhdGUuYXRcblx0XHRcdH0gKVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY190aW1lbGluZV90aW1lX3Jvd3NfaW50ZXJhY3Rpb25fZ2VvbWV0cnkgPSBPYmplY3QuZnJlZXplKCB7XG5cdFx0c2NoZW1hX3ZlcnNpb246IHNjaGVtYV92ZXJzaW9uLFxuXHRcdHByZXBhcmVfZ2VvbWV0cnk6IHByZXBhcmVfZ2VvbWV0cnksXG5cdFx0cmVzb2x2ZV9jb29yZGluYXRlOiByZXNvbHZlX2Nvb3JkaW5hdGUsXG5cdFx0cmVzb2x2ZV93YWxsX3RpbWU6IHJlc29sdmVfd2FsbF90aW1lLFxuXHRcdHJlc29sdmVfZHJhZnQ6IHJlc29sdmVfZHJhZnRcblx0fSApO1xufSggd2luZG93ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRztFQUNyQixZQUFZOztFQUVaLElBQUlDLGNBQWMsR0FBRyxDQUFDO0VBQ3RCLElBQUlDLGVBQWUsR0FBRyxJQUFJO0VBQzFCLElBQUlDLGtCQUFrQixHQUFHLEVBQUU7RUFDM0IsSUFBSUMsb0JBQW9CLEdBQUcsRUFBRTtFQUM3QixJQUFJQyxvQkFBb0IsR0FBRyxHQUFHO0VBQzlCO0VBQ0EsSUFBSUMsMEJBQTBCLEdBQUcsR0FBRzs7RUFFcEM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsZ0JBQWdCQSxDQUFFQyxLQUFLLEVBQUc7SUFDbEMsSUFBSUMsT0FBTyxHQUFHLENBQUMsQ0FBQztJQUVoQixJQUFLQyxLQUFLLENBQUNDLE9BQU8sQ0FBRUgsS0FBTSxDQUFDLEVBQUc7TUFDN0IsT0FBT0EsS0FBSyxDQUFDSSxHQUFHLENBQUVMLGdCQUFpQixDQUFDO0lBQ3JDO0lBQ0EsSUFBSyxDQUFFQyxLQUFLLElBQUksUUFBUSxLQUFLLE9BQU9BLEtBQUssRUFBRztNQUMzQyxPQUFPQSxLQUFLO0lBQ2I7SUFDQUssTUFBTSxDQUFDQyxJQUFJLENBQUVOLEtBQU0sQ0FBQyxDQUFDTyxJQUFJLENBQUMsQ0FBQyxDQUFDQyxPQUFPLENBQUUsVUFBV0MsR0FBRyxFQUFHO01BQ3JEUixPQUFPLENBQUVRLEdBQUcsQ0FBRSxHQUFHVixnQkFBZ0IsQ0FBRUMsS0FBSyxDQUFFUyxHQUFHLENBQUcsQ0FBQztJQUNsRCxDQUFFLENBQUM7SUFFSCxPQUFPUixPQUFPO0VBQ2Y7O0VBRUE7QUFDRDtBQUNB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
