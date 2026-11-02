"use strict";

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
(function (window) {
  'use strict';

  var projection_schema_version = 1;
  var minutes_per_day = 1440;
  var default_visible_lane_limit = 3;
  var availability_precedence = ['unknown', 'blocked_date', 'blocked_time', 'unavailable_weekday', 'seasonal_availability', 'appointment_buffer', 'booking_buffer', 'working_time'];

  /**
   * Return a bounded integer.
   *
   * @param {*} value Candidate numeric value.
   * @param {number} minimum Inclusive minimum.
   * @param {number} maximum Inclusive maximum.
   * @param {number} fallback Value used when the candidate is not finite.
   * @return {number} Bounded integer.
   */
  function bounded_integer(value, minimum, maximum, fallback) {
    value = Number(value);
    if (!Number.isFinite(value)) {
      value = fallback;
    }
    return Math.max(minimum, Math.min(maximum, Math.round(value)));
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
  function parse_exact_timestamp(timestamp) {
    var matches = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-])(\d{2}):(\d{2})$/.exec(String(timestamp || ''));
    var offset_minutes;
    var epoch;
    if (!matches) {
      return null;
    }
    offset_minutes = (Number(matches[9]) * 60 + Number(matches[10])) * ('-' === matches[8] ? -1 : 1);
    epoch = Math.floor(Date.UTC(Number(matches[1]), Number(matches[2]) - 1, Number(matches[3]), Number(matches[4]), Number(matches[5]), Number(matches[6])) / 1000) - offset_minutes * 60;
    return {
      value: String(timestamp),
      epoch: epoch,
      date: matches[1] + '-' + matches[2] + '-' + matches[3],
      hour: Number(matches[4]),
      minute: Number(matches[5]),
      second: Number(matches[6]),
      wall_minute: Number(matches[4]) * 60 + Number(matches[5]) + Number(matches[6]) / 60,
      offset_minutes: offset_minutes
    };
  }

  /**
   * Sort an object's keys recursively for deterministic cache identities.
   *
   * @param {*} value JSON-safe value.
   * @return {*} Recursively ordered JSON-safe value.
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
   * Return a deterministic compact hash for a JSON-safe identity.
   *
   * @param {*} value JSON-safe identity value.
   * @return {string} Eight-character FNV-1a hash.
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
   * Return one normalized transition from a server date band.
   *
   * @param {Object} transition Server transition DTO.
   * @return {Object|null} Normalized transition or null.
   */
  function normalize_transition(transition) {
    var epoch = Number(transition && transition.epoch);
    var before = parse_exact_timestamp(transition && transition.local_before_at);
    var after = parse_exact_timestamp(transition && transition.local_after_at);
    if (!Number.isInteger(epoch) || !before || !after || 'gap' !== transition.kind && 'fold' !== transition.kind) {
      return null;
    }
    return {
      transition_id: String(transition.transition_id || 'transition-' + epoch),
      epoch: epoch,
      kind: transition.kind,
      local_before_at: before.value,
      local_after_at: after.value,
      wall_range_start_minute: bounded_integer(transition.wall_range_start_minute, 0, minutes_per_day, Math.min(before.wall_minute, after.wall_minute)),
      wall_range_end_minute: bounded_integer(transition.wall_range_end_minute, 0, minutes_per_day, Math.max(before.wall_minute, after.wall_minute)),
      offset_before_seconds: Number(transition.offset_before_seconds || before.offset_minutes * 60),
      offset_after_seconds: Number(transition.offset_after_seconds || after.offset_minutes * 60)
    };
  }

  /**
   * Collect unique authorized date bands from accepted native windows.
   *
   * @param {Array<Object>} booking_windows Accepted native window entries.
   * @return {Array<Object>} Chronological normalized date bands.
   */
  function collect_date_bands(booking_windows) {
    var bands_by_date = Object.create(null);
    (Array.isArray(booking_windows) ? booking_windows : []).forEach(function (window_entry) {
      var axis = window_entry && window_entry.payload ? window_entry.payload.axis || {} : {};
      (Array.isArray(axis.date_bands) ? axis.date_bands : []).forEach(function (date_band) {
        var start = parse_exact_timestamp(date_band.start_at);
        var end = parse_exact_timestamp(date_band.end_at);
        var date = String(date_band.date || (start ? start.date : ''));
        var transitions;
        if (!date || !start || !end || end.epoch <= start.epoch) {
          return;
        }
        transitions = (Array.isArray(date_band.transitions) ? date_band.transitions : []).map(normalize_transition).filter(Boolean).sort(function (left, right) {
          return left.epoch - right.epoch;
        });
        if (bands_by_date[date]) {
          if (bands_by_date[date].start_epoch !== start.epoch || bands_by_date[date].end_epoch !== end.epoch || hash_identity(bands_by_date[date].transitions) !== hash_identity(transitions)) {
            throw new TypeError('Conflicting accepted date-band identity.');
          }
          bands_by_date[date].span = Math.max(bands_by_date[date].span, Number(date_band.span || 1));
          return;
        }
        if (!bands_by_date[date]) {
          bands_by_date[date] = {
            date: date,
            start_at: start.value,
            end_at: end.value,
            start_epoch: start.epoch,
            end_epoch: end.epoch,
            elapsed_minutes: Number(date_band.elapsed_minutes || (end.epoch - start.epoch) / 60),
            wall_minutes: minutes_per_day,
            span: Math.max(1, Number(date_band.span || 1)),
            transitions: transitions
          };
        }
      });
    });
    var ordered_date_bands = Object.keys(bands_by_date).map(function (date) {
      return bands_by_date[date];
    }).sort(function (left, right) {
      return left.start_epoch - right.start_epoch;
    });
    var total_span = ordered_date_bands.reduce(function (span, date_band) {
      return span + date_band.span;
    }, 0);
    var consumed_span = 0;
    return ordered_date_bands.map(function (date_band, index) {
      var offset_percent = total_span ? 100 * consumed_span / total_span : 0;
      var width_percent = total_span ? 100 * date_band.span / total_span : 100;
      var normalized_date_band = Object.assign({}, date_band, {
        index: index,
        offset_percent: Number(offset_percent.toFixed(8)),
        width_percent: Number(width_percent.toFixed(8)),
        dst_slices: date_band.transitions.map(function (transition) {
          return {
            transition_id: transition.transition_id,
            kind: transition.kind,
            start_minute: transition.wall_range_start_minute,
            end_minute: transition.wall_range_end_minute,
            offset_before_seconds: transition.offset_before_seconds,
            offset_after_seconds: transition.offset_after_seconds
          };
        })
      });
      consumed_span += date_band.span;
      return normalized_date_band;
    });
  }

  /**
   * Collect unique booking segments for one Resource from overlapping windows.
   *
   * @param {Array<Object>} booking_windows Accepted native window entries.
   * @param {number} resource_id Authorized Resource ID.
   * @return {Array<Object>} Stable deduplicated segments.
   */
  function collect_booking_segments(booking_windows, resource_id) {
    var segment_records_by_identity = Object.create(null);
    (Array.isArray(booking_windows) ? booking_windows : []).forEach(function (window_entry) {
      var payload = window_entry && window_entry.payload ? window_entry.payload : {};
      (Array.isArray(payload.segments) ? payload.segments : []).forEach(function (segment) {
        var start = parse_exact_timestamp(segment && segment.start);
        var end = parse_exact_timestamp(segment && segment.end);
        var identity;
        if (Number(segment && segment.resource_id) !== resource_id || !start || !end || end.epoch <= start.epoch) {
          return;
        }
        identity = [String(segment.segment_id || ''), start.epoch, end.epoch, Number(segment.booking_id || 0), resource_id].join('|');
        if (!segment_records_by_identity[identity]) {
          segment_records_by_identity[identity] = {
            segment: segment,
            start_epoch: start.epoch,
            end_epoch: end.epoch
          };
        }
      });
    });
    return Object.keys(segment_records_by_identity).map(function (identity) {
      return segment_records_by_identity[identity];
    }).sort(function (left, right) {
      return left.start_epoch - right.start_epoch || left.end_epoch - right.end_epoch || String(left.segment.segment_id).localeCompare(String(right.segment.segment_id));
    }).map(function (segment_record) {
      return segment_record.segment;
    });
  }

  /**
   * Collect unique Availability intervals and coverage for one Resource.
   *
   * @param {Array<Object>} availability_windows Accepted Availability entries.
   * @param {number} resource_id Authorized Resource ID.
   * @return {Object} Deduplicated intervals, coverage, unknown records, and sources.
   */
  function collect_availability(availability_windows, resource_id) {
    var intervals_by_identity = Object.create(null);
    var coverage_by_identity = Object.create(null);
    var unknown_by_identity = Object.create(null);
    var sources_by_id = Object.create(null);
    var load_states = [];
    (Array.isArray(availability_windows) ? availability_windows : []).forEach(function (availability_entry) {
      var payload = availability_entry && availability_entry.payload ? availability_entry.payload : {};
      load_states.push(String(payload.load_state || 'loaded'));
      (Array.isArray(payload.sources) ? payload.sources : []).forEach(function (source) {
        if (source && source.id) {
          sources_by_id[String(source.id)] = source;
        }
      });
      (Array.isArray(payload.intervals) ? payload.intervals : []).forEach(function (interval) {
        var start = parse_exact_timestamp(interval && interval.start_at);
        var end = parse_exact_timestamp(interval && interval.end_at);
        var identity;
        if (Number(interval && interval.resource_id) !== resource_id || !start || !end || end.epoch <= start.epoch) {
          return;
        }
        identity = [String(interval.interval_id || ''), String(interval.source || ''), start.epoch, end.epoch, String(interval.related_segment_id || '')].join('|');
        if (!intervals_by_identity[identity]) {
          intervals_by_identity[identity] = interval;
        }
      });
      (Array.isArray(payload.coverage) ? payload.coverage : []).forEach(function (coverage) {
        if (Number(coverage && coverage.resource_id) === resource_id && coverage.source) {
          if (!coverage_by_identity[String(coverage.source)] || 'unknown' === coverage.state) {
            coverage_by_identity[String(coverage.source)] = coverage;
          }
        }
      });
      (Array.isArray(payload.unknown) ? payload.unknown : []).forEach(function (unknown) {
        var identity = [String(unknown && unknown.source || ''), String(unknown && unknown.reason || '')].join('|');
        if (Number(unknown && unknown.resource_id) === resource_id) {
          unknown_by_identity[identity] = unknown;
        }
      });
    });
    return {
      load_state: -1 !== load_states.indexOf('partial') ? 'partial' : load_states.length ? 'loaded' : 'loading',
      intervals: Object.keys(intervals_by_identity).map(function (identity) {
        return intervals_by_identity[identity];
      }),
      coverage: Object.keys(coverage_by_identity).sort().map(function (identity) {
        return coverage_by_identity[identity];
      }),
      unknown: Object.keys(unknown_by_identity).sort().map(function (identity) {
        return unknown_by_identity[identity];
      }),
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
  function resolve_boundary_timestamp(epoch, role, interval, date_band) {
    var matching_transition = date_band.transitions.filter(function (transition) {
      return transition.epoch === epoch;
    })[0];
    if (epoch === interval.start.epoch) {
      return interval.start.value;
    }
    if (epoch === interval.end.epoch) {
      return interval.end.value;
    }
    if (epoch === date_band.start_epoch) {
      return date_band.start_at;
    }
    if (epoch === date_band.end_epoch) {
      return date_band.end_at;
    }
    if (matching_transition) {
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
  function split_exact_interval(source, start_key, end_key, date_bands) {
    var start = parse_exact_timestamp(source && source[start_key]);
    var end = parse_exact_timestamp(source && source[end_key]);
    var interval;
    var fragments = [];
    if (!start || !end || end.epoch <= start.epoch) {
      return fragments;
    }
    interval = {
      start: start,
      end: end
    };
    date_bands.forEach(function (date_band) {
      var visible_start = Math.max(start.epoch, date_band.start_epoch);
      var visible_end = Math.min(end.epoch, date_band.end_epoch);
      var split_points;
      if (visible_end <= visible_start) {
        return;
      }
      split_points = [visible_start].concat(date_band.transitions.map(function (transition) {
        return transition.epoch;
      }).filter(function (epoch) {
        return epoch > visible_start && epoch < visible_end;
      })).concat([visible_end]);
      split_points.forEach(function (fragment_start_epoch, index) {
        var fragment_end_epoch = split_points[index + 1];
        var fragment_start_at;
        var fragment_end_at;
        var fragment_start;
        var fragment_end;
        if (undefined === fragment_end_epoch) {
          return;
        }
        fragment_start_at = resolve_boundary_timestamp(fragment_start_epoch, 'start', interval, date_band);
        fragment_end_at = resolve_boundary_timestamp(fragment_end_epoch, 'end', interval, date_band);
        fragment_start = parse_exact_timestamp(fragment_start_at);
        fragment_end = parse_exact_timestamp(fragment_end_at);
        if (!fragment_start || !fragment_end) {
          return;
        }
        fragments.push({
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
          transition_before_id: fragment_start_epoch > visible_start ? (date_band.transitions.filter(function (transition) {
            return transition.epoch === fragment_start_epoch;
          })[0] || {}).transition_id || '' : '',
          transition_after_id: fragment_end_epoch < visible_end ? (date_band.transitions.filter(function (transition) {
            return transition.epoch === fragment_end_epoch;
          })[0] || {}).transition_id || '' : ''
        });
      });
    });
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
  function resolve_vertical_range(range_policy, timed_booking_fragments, availability_fragments, coverage) {
    var requested_mode = String(range_policy && range_policy.mode);
    var mode = -1 !== ['auto', 'custom', 'full_day'].indexOf(requested_mode) ? requested_mode : 'auto';
    var start_minute = bounded_integer(range_policy && range_policy.safe_start_minute, 0, minutes_per_day - 60, 480);
    var end_minute = bounded_integer(range_policy && range_policy.safe_end_minute, start_minute + 60, minutes_per_day, 1080);
    var working_time_exact = coverage.some(function (coverage_record) {
      return 'working_time' === coverage_record.source && 'exact' === coverage_record.state;
    });
    var working_fragments = availability_fragments.filter(function (fragment) {
      return 'working_time' === fragment.source;
    });
    if ('full_day' === mode) {
      return {
        mode: mode,
        start_minute: 0,
        end_minute: minutes_per_day,
        span_minutes: minutes_per_day
      };
    }
    if ('custom' === mode) {
      start_minute = bounded_integer(range_policy && range_policy.start_minute, 0, minutes_per_day - 60, 0);
      end_minute = bounded_integer(range_policy && range_policy.end_minute, start_minute + 60, minutes_per_day, minutes_per_day);
      return {
        mode: mode,
        start_minute: start_minute,
        end_minute: end_minute,
        span_minutes: end_minute - start_minute
      };
    }
    if (working_time_exact && working_fragments.length) {
      working_fragments.forEach(function (fragment) {
        if (0 === fragment.wall_start_minute) {
          start_minute = Math.max(start_minute, fragment.wall_end_minute);
        }
        if (minutes_per_day === fragment.wall_end_minute) {
          end_minute = Math.min(end_minute, fragment.wall_start_minute);
        }
      });
    }
    timed_booking_fragments.concat(availability_fragments.filter(function (fragment) {
      return 'booking_buffer' === fragment.source || 'appointment_buffer' === fragment.source;
    })).forEach(function (fragment) {
      start_minute = Math.min(start_minute, Math.floor(fragment.wall_start_minute / 60) * 60);
      end_minute = Math.max(end_minute, Math.ceil(fragment.wall_end_minute / 60) * 60);
    });
    start_minute = Math.max(0, Math.min(minutes_per_day - 60, Math.floor(start_minute / 60) * 60));
    end_minute = Math.max(start_minute + 60, Math.min(minutes_per_day, Math.ceil(end_minute / 60) * 60));
    return {
      mode: mode,
      start_minute: start_minute,
      end_minute: end_minute,
      span_minutes: end_minute - start_minute
    };
  }

  /**
   * Apply vertical clipping and percentage geometry to one wall-time fragment.
   *
   * @param {Object} fragment Unclipped wall-time fragment.
   * @param {Object} range Resolved vertical range.
   * @return {Object} Fragment with clipping and vertical geometry.
   */
  function apply_vertical_range(fragment, range) {
    var visible_start = Math.max(range.start_minute, fragment.wall_start_minute);
    var visible_end = Math.min(range.end_minute, fragment.wall_end_minute);
    var is_outside = visible_end <= visible_start;
    var span = Math.max(1, range.span_minutes);
    return Object.assign({}, fragment, {
      is_clipped_above: fragment.wall_start_minute < range.start_minute,
      is_clipped_below: fragment.wall_end_minute > range.end_minute,
      is_outside_range: is_outside,
      visible_wall_start_minute: is_outside ? null : visible_start,
      visible_wall_end_minute: is_outside ? null : visible_end,
      top_percent: is_outside ? null : Number((100 * (visible_start - range.start_minute) / span).toFixed(8)),
      height_percent: is_outside ? null : Number((100 * (visible_end - visible_start) / span).toFixed(8))
    });
  }

  /**
   * Map accepted booking segments into full-day and timed fragments.
   *
   * @param {Array<Object>} segments Exact authorized booking segments.
   * @param {Array<Object>} date_bands Accepted date bands.
   * @return {Object} Full-day and timed fragments before range and lane work.
   */
  function project_booking_fragments(segments, date_bands) {
    var full_day_fragments = [];
    var timed_fragments = [];
    var loaded_start = date_bands.length ? date_bands[0].start_epoch : 0;
    var loaded_end = date_bands.length ? date_bands[date_bands.length - 1].end_epoch : 0;
    segments.forEach(function (segment) {
      var source_start = parse_exact_timestamp(segment.start);
      var source_end = parse_exact_timestamp(segment.end);
      var split_fragments = split_exact_interval(segment, 'start', 'end', date_bands);
      if (segment.is_full_day) {
        split_fragments = split_fragments.reduce(function (fragments_by_date, fragment) {
          var previous = fragments_by_date[fragments_by_date.length - 1];
          if (previous && previous.date === fragment.date) {
            previous.end_at = fragment.end_at;
            previous.end_epoch = fragment.end_epoch;
            previous.wall_end_minute = fragment.wall_end_minute;
            previous.end_offset_minutes = fragment.end_offset_minutes;
            previous.continues_after_date = fragment.continues_after_date;
            previous.transition_after_id = fragment.transition_after_id;
            return fragments_by_date;
          }
          fragments_by_date.push(Object.assign({}, fragment));
          return fragments_by_date;
        }, []);
      }
      split_fragments.forEach(function (fragment, index) {
        var common = {
          fragment_id: [String(segment.segment_id), fragment.date, fragment.start_epoch, fragment.end_epoch].join('|'),
          source_segment_id: String(segment.segment_id || ''),
          series_key: String(segment.series_key || ''),
          booking_id: Number(segment.booking_id || 0),
          resource_id: Number(segment.resource_id || 0),
          date: fragment.date,
          start_at: fragment.start_at,
          end_at: fragment.end_at,
          start_epoch: fragment.start_epoch,
          end_epoch: fragment.end_epoch,
          status: String(segment.status || ''),
          label: String(segment.label || ''),
          initials: String(segment.initials || ''),
          schedule_label: String(segment.schedule_label || ''),
          selection_aria_label: String(segment.selection_aria_label || segment.aria_label || ''),
          information_aria_label: String(segment.information_aria_label || ''),
          continues_before_date: fragment.continues_before_date,
          continues_after_date: fragment.continues_after_date,
          continues_before_loaded_window: Boolean(source_start && source_start.epoch < loaded_start) || Boolean(segment.is_clipped_start && 0 === index),
          continues_after_loaded_window: Boolean(source_end && source_end.epoch > loaded_end) || Boolean(segment.is_clipped_end && index === split_fragments.length - 1)
        };
        if (segment.is_full_day) {
          full_day_fragments.push(common);
          return;
        }
        timed_fragments.push(Object.assign(common, fragment, {
          occurrence_id: [fragment.date, fragment.wall_start_minute, fragment.start_offset_minutes, fragment.start_epoch].join('|')
        }));
      });
    });
    return {
      full_day_fragments: full_day_fragments,
      timed_fragments: timed_fragments
    };
  }

  /**
   * Assign deterministic full-day stack indexes per date.
   *
   * @param {Array<Object>} full_day_fragments Full-day booking fragments.
   * @return {Array<Object>} Sorted stack records.
   */
  function assign_full_day_stacks(full_day_fragments) {
    var groups_by_segment = Object.create(null);
    var lane_end_epochs = [];
    var date_stack_counts = Object.create(null);
    full_day_fragments.forEach(function (fragment) {
      var group_key = [fragment.source_segment_id, fragment.booking_id, fragment.resource_id].join('|');
      if (!groups_by_segment[group_key]) {
        groups_by_segment[group_key] = {
          group_key: group_key,
          source_segment_id: fragment.source_segment_id,
          start_epoch: fragment.start_epoch,
          end_epoch: fragment.end_epoch,
          fragments: []
        };
      }
      groups_by_segment[group_key].start_epoch = Math.min(groups_by_segment[group_key].start_epoch, fragment.start_epoch);
      groups_by_segment[group_key].end_epoch = Math.max(groups_by_segment[group_key].end_epoch, fragment.end_epoch);
      groups_by_segment[group_key].fragments.push(fragment);
    });
    Object.keys(groups_by_segment).map(function (group_key) {
      return groups_by_segment[group_key];
    }).sort(function (left, right) {
      return left.start_epoch - right.start_epoch || right.end_epoch - left.end_epoch || left.source_segment_id.localeCompare(right.source_segment_id);
    }).forEach(function (group) {
      var lane_index = lane_end_epochs.findIndex(function (lane_end_epoch) {
        return lane_end_epoch <= group.start_epoch;
      });
      if (-1 === lane_index) {
        lane_index = lane_end_epochs.length;
      }
      lane_end_epochs[lane_index] = group.end_epoch;
      group.fragments.forEach(function (fragment) {
        fragment.stack_index = lane_index;
        date_stack_counts[fragment.date] = Math.max(date_stack_counts[fragment.date] || 0, lane_index + 1);
      });
    });
    return full_day_fragments.sort(function (left, right) {
      return left.date.localeCompare(right.date) || left.start_epoch - right.start_epoch || left.end_epoch - right.end_epoch || left.source_segment_id.localeCompare(right.source_segment_id);
    }).map(function (fragment) {
      return Object.assign({}, fragment, {
        stack_count: date_stack_counts[fragment.date]
      });
    });
  }

  /**
   * Assign deterministic overlap lanes and construct bounded overflow groups.
   *
   * @param {Array<Object>} timed_fragments Range-projected timed fragments.
   * @param {number} visible_lane_limit Maximum directly visible lanes.
   * @return {Object} Lane-assigned fragments and overflow groups.
   */
  function assign_timed_lanes(timed_fragments, visible_lane_limit) {
    var dates = Object.create(null);
    var overflow_groups = [];
    timed_fragments.forEach(function (fragment) {
      if (!dates[fragment.date]) {
        dates[fragment.date] = [];
      }
      dates[fragment.date].push(fragment);
    });
    Object.keys(dates).sort().forEach(function (date) {
      var lane_ends = [];
      var cluster_fragments = [];
      var cluster_end = -1;
      var cluster_index = 0;
      var flush_cluster;
      flush_cluster = function () {
        var hidden = cluster_fragments.filter(function (fragment) {
          return fragment.lane_index >= visible_lane_limit;
        });
        var cluster_lane_count = Math.min(visible_lane_limit, Math.max(1, lane_ends.length));
        cluster_fragments.forEach(function (fragment) {
          fragment.lane_count = cluster_lane_count;
        });
        if (hidden.length) {
          overflow_groups.push({
            overflow_id: 'overflow|' + date + '|' + cluster_index,
            date: date,
            start_wall_minute: Math.min.apply(null, cluster_fragments.map(function (fragment) {
              return fragment.visible_wall_start_minute;
            })),
            end_wall_minute: Math.max.apply(null, cluster_fragments.map(function (fragment) {
              return fragment.visible_wall_end_minute;
            })),
            hidden_count: hidden.length,
            fragment_ids: hidden.map(function (fragment) {
              return fragment.fragment_id;
            }),
            booking_ids: hidden.map(function (fragment) {
              return fragment.booking_id;
            }),
            label: '+' + hidden.length + ' more'
          });
        }
        cluster_fragments = [];
        cluster_end = -1;
        cluster_index += 1;
      };
      dates[date].sort(function (left, right) {
        return left.visible_wall_start_minute - right.visible_wall_start_minute || left.start_epoch - right.start_epoch || left.visible_wall_end_minute - right.visible_wall_end_minute || left.source_segment_id.localeCompare(right.source_segment_id);
      }).forEach(function (fragment) {
        var lane_index = -1;
        var lane_candidate;
        for (lane_candidate = 0; lane_candidate < lane_ends.length; lane_candidate++) {
          if (lane_ends[lane_candidate] <= fragment.visible_wall_start_minute) {
            lane_index = lane_candidate;
            break;
          }
        }
        if (cluster_fragments.length && fragment.visible_wall_start_minute >= cluster_end) {
          flush_cluster();
          lane_ends = [];
        }
        if (-1 === lane_index) {
          lane_index = lane_ends.length;
        }
        lane_ends[lane_index] = fragment.visible_wall_end_minute;
        fragment.lane_index = lane_index;
        fragment.is_overflowed = lane_index >= visible_lane_limit;
        cluster_fragments.push(fragment);
        cluster_end = Math.max(cluster_end, fragment.visible_wall_end_minute);
      });
      if (cluster_fragments.length) {
        flush_cluster();
      }
    });
    return {
      fragments: timed_fragments.sort(function (left, right) {
        return left.date.localeCompare(right.date) || left.visible_wall_start_minute - right.visible_wall_start_minute || left.start_epoch - right.start_epoch || left.source_segment_id.localeCompare(right.source_segment_id);
      }),
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
  function project_availability_fragments(intervals, date_bands) {
    var fragments = [];
    intervals.forEach(function (interval) {
      split_exact_interval(interval, 'start_at', 'end_at', date_bands).forEach(function (fragment) {
        fragments.push(Object.assign({}, fragment, {
          interval_id: String(interval.interval_id || ''),
          source: String(interval.source || ''),
          source_label: String(interval.source_label || ''),
          related_segment_id: String(interval.related_segment_id || '')
        }));
      });
    });
    return fragments;
  }

  /**
   * Return the precedence rank for one Availability source.
   *
   * @param {string} source Availability source ID.
   * @return {number} Lower values win.
   */
  function get_availability_rank(source) {
    var index = availability_precedence.indexOf(source);
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
  function combine_availability_slices(fragments, date_bands, range, availability_state, unknown_records, source_definitions) {
    var slices = [];
    var has_global_unknown = 'loading' === availability_state || 'failed' === availability_state;
    var fragments_by_date = Object.create(null);
    fragments.forEach(function (fragment) {
      if (!fragments_by_date[fragment.date]) {
        fragments_by_date[fragment.date] = [];
      }
      fragments_by_date[fragment.date].push(fragment);
    });
    date_bands.forEach(function (date_band) {
      var date_fragments = fragments_by_date[date_band.date] || [];
      var boundaries = [range.start_minute, range.end_minute];
      var boundaries_by_minute = Object.create(null);
      var unknown_source_ids = unknown_records.map(function (record) {
        return String(record.source || 'unknown');
      });
      var unknown_sources = has_global_unknown || unknown_source_ids.length ? ['unknown'].concat(unknown_source_ids) : [];
      date_fragments.forEach(function (fragment) {
        boundaries.push(Math.max(range.start_minute, Math.min(range.end_minute, fragment.wall_start_minute)));
        boundaries.push(Math.max(range.start_minute, Math.min(range.end_minute, fragment.wall_end_minute)));
      });
      boundaries.forEach(function (boundary) {
        boundaries_by_minute[String(boundary)] = boundary;
      });
      boundaries = Object.keys(boundaries_by_minute).map(function (boundary_key) {
        return boundaries_by_minute[boundary_key];
      }).sort(function (left, right) {
        return left - right;
      });
      boundaries.forEach(function (start_minute, index) {
        var end_minute = boundaries[index + 1];
        var contributors;
        var source_ids;
        var winner;
        if (undefined === end_minute || end_minute <= start_minute) {
          return;
        }
        contributors = date_fragments.filter(function (fragment) {
          return fragment.wall_start_minute < end_minute && fragment.wall_end_minute > start_minute;
        });
        source_ids = contributors.map(function (fragment) {
          return fragment.source;
        }).concat(unknown_sources).filter(function (source, source_index, all_sources) {
          return all_sources.indexOf(source) === source_index;
        }).sort(function (left, right) {
          return get_availability_rank(left) - get_availability_rank(right) || left.localeCompare(right);
        });
        if (!source_ids.length) {
          return;
        }
        winner = source_ids[0];
        slices.push({
          slice_id: ['availability', date_band.date, start_minute, end_minute, winner].join('|'),
          date: date_band.date,
          start_minute: start_minute,
          end_minute: end_minute,
          top_percent: Number((100 * (start_minute - range.start_minute) / range.span_minutes).toFixed(8)),
          height_percent: Number((100 * (end_minute - start_minute) / range.span_minutes).toFixed(8)),
          state: -1 !== source_ids.indexOf('unknown') || unknown_sources.length ? availability_state : 'exact',
          winning_source: winner,
          source_ids: source_ids,
          source_labels: source_ids.map(function (source_id) {
            var contributor = contributors.filter(function (fragment) {
              return fragment.source === source_id;
            })[0];
            if ('unknown' === source_id) {
              return 'Availability unknown';
            }
            return String(source_definitions[source_id] && source_definitions[source_id].label || contributor && contributor.source_label || source_id);
          }),
          interval_ids: contributors.map(function (fragment) {
            return fragment.interval_id;
          }).filter(function (interval_id, interval_index, all_ids) {
            return all_ids.indexOf(interval_id) === interval_index;
          }).sort(),
          related_segment_ids: contributors.map(function (fragment) {
            return fragment.related_segment_id;
          }).filter(function (segment_id, segment_index, all_ids) {
            return segment_id && all_ids.indexOf(segment_id) === segment_index;
          }).sort()
        });
      });
    });
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
  function build_summary_records(full_day_fragments, timed_fragments, availability_slices, clipped_availability_fragments, availability_state) {
    var records = [];
    full_day_fragments.forEach(function (fragment) {
      records.push({
        summary_id: 'summary|' + fragment.fragment_id,
        kind: 'full_day_booking',
        date: fragment.date,
        start_minute: 0,
        end_minute: minutes_per_day,
        booking_id: fragment.booking_id,
        fragment_id: fragment.fragment_id,
        label: fragment.label,
        source_ids: []
      });
    });
    timed_fragments.forEach(function (fragment) {
      records.push({
        summary_id: 'summary|' + fragment.fragment_id,
        kind: 'timed_booking',
        date: fragment.date,
        start_minute: fragment.wall_start_minute,
        end_minute: fragment.wall_end_minute,
        booking_id: fragment.booking_id,
        fragment_id: fragment.fragment_id,
        label: fragment.label,
        source_ids: []
      });
    });
    availability_slices.forEach(function (slice) {
      records.push({
        summary_id: 'summary|' + slice.slice_id,
        kind: 'availability',
        date: slice.date,
        start_minute: slice.start_minute,
        end_minute: slice.end_minute,
        booking_id: 0,
        fragment_id: '',
        label: slice.source_labels.join(', '),
        source_ids: slice.source_ids.slice()
      });
    });
    clipped_availability_fragments.forEach(function (fragment) {
      records.push({
        summary_id: 'summary|clipped|' + fragment.interval_id + '|' + fragment.date + '|' + fragment.start_epoch,
        kind: 'availability_clipped',
        date: fragment.date,
        start_minute: fragment.wall_start_minute,
        end_minute: fragment.wall_end_minute,
        booking_id: 0,
        fragment_id: '',
        label: fragment.source_label || fragment.source,
        source_ids: [fragment.source]
      });
    });
    if ('loaded' !== availability_state) {
      records.push({
        summary_id: 'summary|availability-state|' + availability_state,
        kind: 'availability_state',
        date: '',
        start_minute: 0,
        end_minute: 0,
        booking_id: 0,
        fragment_id: '',
        label: availability_state,
        source_ids: ['unknown']
      });
    }
    return records.sort(function (left, right) {
      return left.date.localeCompare(right.date) || left.start_minute - right.start_minute || left.end_minute - right.end_minute || left.kind.localeCompare(right.kind) || left.summary_id.localeCompare(right.summary_id);
    });
  }

  /**
   * Build the complete accepted-identity cache key.
   *
   * @param {Object} input Projector input.
   * @param {Array<Object>} date_bands Normalized date bands.
   * @param {Object} range_policy Requested range policy.
   * @return {string} Stable projection cache key.
   */
  function build_projection_cache_key(input, date_bands, range_policy) {
    var window_identity = (Array.isArray(input.booking_windows) ? input.booking_windows : []).map(function (window_entry) {
      var payload = window_entry && window_entry.payload ? window_entry.payload : {};
      var timeline_window = payload.window || {};
      return {
        key: String(window_entry && window_entry.key || ''),
        start_at: String(timeline_window.start_at || ''),
        end_at: String(timeline_window.end_at || ''),
        cell_minutes: Number(timeline_window.cell_minutes || 0),
        view: String(timeline_window.view || '')
      };
    });
    var identity = {
      schema_version: projection_schema_version,
      resource_id: Number(input.resource_id),
      resource_fingerprint: String(input.resource_fingerprint || ''),
      timezone: String(input.timezone || ''),
      booking_generation: Number(input.booking_generation || 0),
      availability_generation: Number(input.availability_generation || 0),
      availability_state: String(input.availability_state || ''),
      windows: window_identity,
      axis: date_bands.map(function (date_band) {
        return [date_band.date, date_band.start_epoch, date_band.end_epoch, date_band.span, date_band.transitions.map(function (transition) {
          return transition.transition_id;
        })];
      }),
      range_policy: range_policy,
      visible_lane_limit: Number(input.visible_lane_limit || default_visible_lane_limit)
    };
    return 'time-rows-v' + projection_schema_version + '-r' + Number(input.resource_id) + '-' + hash_identity(identity);
  }

  /**
   * Build a cache key directly from accepted projector input.
   *
   * @param {Object} input Accepted booking, Availability, identity, and policy data.
   * @return {string} Stable projection cache key.
   */
  function get_projection_cache_key(input) {
    var date_bands = collect_date_bands(input && input.booking_windows);
    var range_policy = Object.assign({
      mode: 'auto',
      safe_start_minute: 480,
      safe_end_minute: 1080
    }, input && input.range_policy || {});
    if (!date_bands.length) {
      return '';
    }
    return build_projection_cache_key(input, date_bands, range_policy);
  }

  /**
   * Project one authorized Resource from accepted native Timeline data.
   *
   * @param {Object} input Accepted booking, Availability, identity, and policy data.
   * @return {Object} JSON-safe normalized time-rows projection DTO.
   */
  function project(input) {
    var resource_id = Number(input && input.resource_id);
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
    if (!Number.isInteger(resource_id) || 1 > resource_id) {
      throw new TypeError('A positive authorized Resource ID is required.');
    }
    date_bands = collect_date_bands(input.booking_windows);
    if (!date_bands.length) {
      throw new TypeError('At least one exact server date band is required.');
    }
    segments = collect_booking_segments(input.booking_windows, resource_id);
    availability = collect_availability(input.availability_windows, resource_id);
    availability_state = String(input.availability_state || availability.load_state || 'loading');
    if (-1 === ['loaded', 'partial', 'failed', 'loading'].indexOf(availability_state)) {
      availability_state = 'loading';
    }
    booking_projection = project_booking_fragments(segments, date_bands);
    availability_fragments = project_availability_fragments(availability.intervals, date_bands);
    range_policy = Object.assign({
      mode: 'auto',
      safe_start_minute: 480,
      safe_end_minute: 1080
    }, input.range_policy || {});
    range = resolve_vertical_range(range_policy, booking_projection.timed_fragments, availability_fragments, availability.coverage);
    timed_fragments = booking_projection.timed_fragments.map(function (fragment) {
      return apply_vertical_range(fragment, range);
    }).filter(function (fragment) {
      return !fragment.is_outside_range;
    });
    lane_projection = assign_timed_lanes(timed_fragments, bounded_integer(input.visible_lane_limit, 1, 10, default_visible_lane_limit));
    full_day_fragments = assign_full_day_stacks(booking_projection.full_day_fragments);
    availability_fragments = availability_fragments.map(function (fragment) {
      return apply_vertical_range(fragment, range);
    });
    availability_slices = combine_availability_slices(availability_fragments, date_bands, range, availability_state, availability.unknown, availability.sources);
    cache_key = build_projection_cache_key(input, date_bands, range_policy);
    return {
      schema_version: projection_schema_version,
      cache_key: cache_key,
      resource_id: resource_id,
      timezone: String(input.timezone || ''),
      identity: {
        resource_fingerprint: String(input.resource_fingerprint || ''),
        booking_generation: Number(input.booking_generation || 0),
        availability_generation: Number(input.availability_generation || 0)
      },
      window: {
        start_at: date_bands[0].start_at,
        end_at: date_bands[date_bands.length - 1].end_at,
        start_epoch: date_bands[0].start_epoch,
        end_epoch: date_bands[date_bands.length - 1].end_epoch
      },
      range: range,
      dates: date_bands,
      full_day_fragments: full_day_fragments,
      timed_fragments: lane_projection.fragments,
      overflow_groups: lane_projection.overflow_groups,
      availability: {
        state: availability_state,
        sources: Object.keys(availability.sources).sort().map(function (source_id) {
          return availability.sources[source_id];
        }),
        coverage: availability.coverage,
        unknown: availability.unknown,
        slices: availability_slices,
        clipped_fragments: availability_fragments.filter(function (fragment) {
          return fragment.is_clipped_above || fragment.is_clipped_below || fragment.is_outside_range;
        })
      },
      summary: build_summary_records(full_day_fragments, lane_projection.fragments, availability_slices, availability_fragments.filter(function (fragment) {
        return fragment.is_clipped_above || fragment.is_clipped_below || fragment.is_outside_range;
      }), availability_state)
    };
  }
  window.wpbc_timeline_time_rows_projector = Object.freeze({
    schema_version: projection_schema_version,
    availability_precedence: availability_precedence.slice(),
    parse_exact_timestamp: parse_exact_timestamp,
    get_projection_cache_key: get_projection_cache_key,
    build_projection_cache_key: build_projection_cache_key,
    project: project
  });
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS90aW1lLXJvd3MvX291dC90aW1lLXJvd3MtcHJvamVjdG9yLmpzIiwibmFtZXMiOlsid2luZG93IiwicHJvamVjdGlvbl9zY2hlbWFfdmVyc2lvbiIsIm1pbnV0ZXNfcGVyX2RheSIsImRlZmF1bHRfdmlzaWJsZV9sYW5lX2xpbWl0IiwiYXZhaWxhYmlsaXR5X3ByZWNlZGVuY2UiLCJib3VuZGVkX2ludGVnZXIiLCJ2YWx1ZSIsIm1pbmltdW0iLCJtYXhpbXVtIiwiZmFsbGJhY2siLCJOdW1iZXIiLCJpc0Zpbml0ZSIsIk1hdGgiLCJtYXgiLCJtaW4iLCJyb3VuZCIsInBhcnNlX2V4YWN0X3RpbWVzdGFtcCIsInRpbWVzdGFtcCIsIm1hdGNoZXMiLCJleGVjIiwiU3RyaW5nIiwib2Zmc2V0X21pbnV0ZXMiLCJlcG9jaCIsImZsb29yIiwiRGF0ZSIsIlVUQyIsImRhdGUiLCJob3VyIiwibWludXRlIiwic2Vjb25kIiwid2FsbF9taW51dGUiLCJvcmRlcl9qc29uX3ZhbHVlIiwib3JkZXJlZCIsIkFycmF5IiwiaXNBcnJheSIsIm1hcCIsIk9iamVjdCIsImtleXMiLCJzb3J0IiwiZm9yRWFjaCIsImtleSIsImhhc2hfaWRlbnRpdHkiLCJzb3VyY2UiLCJKU09OIiwic3RyaW5naWZ5IiwiaGFzaCIsImluZGV4IiwibGVuZ3RoIiwiY2hhckNvZGVBdCIsImltdWwiLCJ0b1N0cmluZyIsInBhZFN0YXJ0Iiwibm9ybWFsaXplX3RyYW5zaXRpb24iLCJ0cmFuc2l0aW9uIiwiYmVmb3JlIiwibG9jYWxfYmVmb3JlX2F0IiwiYWZ0ZXIiLCJsb2NhbF9hZnRlcl9hdCIsImlzSW50ZWdlciIsImtpbmQiLCJ0cmFuc2l0aW9uX2lkIiwid2FsbF9yYW5nZV9zdGFydF9taW51dGUiLCJ3YWxsX3JhbmdlX2VuZF9taW51dGUiLCJvZmZzZXRfYmVmb3JlX3NlY29uZHMiLCJvZmZzZXRfYWZ0ZXJfc2Vjb25kcyIsImNvbGxlY3RfZGF0ZV9iYW5kcyIsImJvb2tpbmdfd2luZG93cyIsImJhbmRzX2J5X2RhdGUiLCJjcmVhdGUiLCJ3aW5kb3dfZW50cnkiLCJheGlzIiwicGF5bG9hZCIsImRhdGVfYmFuZHMiLCJkYXRlX2JhbmQiLCJzdGFydCIsInN0YXJ0X2F0IiwiZW5kIiwiZW5kX2F0IiwidHJhbnNpdGlvbnMiLCJmaWx0ZXIiLCJCb29sZWFuIiwibGVmdCIsInJpZ2h0Iiwic3RhcnRfZXBvY2giLCJlbmRfZXBvY2giLCJUeXBlRXJyb3IiLCJzcGFuIiwiZWxhcHNlZF9taW51dGVzIiwid2FsbF9taW51dGVzIiwib3JkZXJlZF9kYXRlX2JhbmRzIiwidG90YWxfc3BhbiIsInJlZHVjZSIsImNvbnN1bWVkX3NwYW4iLCJvZmZzZXRfcGVyY2VudCIsIndpZHRoX3BlcmNlbnQiLCJub3JtYWxpemVkX2RhdGVfYmFuZCIsImFzc2lnbiIsInRvRml4ZWQiLCJkc3Rfc2xpY2VzIiwic3RhcnRfbWludXRlIiwiZW5kX21pbnV0ZSIsImNvbGxlY3RfYm9va2luZ19zZWdtZW50cyIsInJlc291cmNlX2lkIiwic2VnbWVudF9yZWNvcmRzX2J5X2lkZW50aXR5Iiwic2VnbWVudHMiLCJzZWdtZW50IiwiaWRlbnRpdHkiLCJzZWdtZW50X2lkIiwiYm9va2luZ19pZCIsImpvaW4iLCJsb2NhbGVDb21wYXJlIiwic2VnbWVudF9yZWNvcmQiLCJjb2xsZWN0X2F2YWlsYWJpbGl0eSIsImF2YWlsYWJpbGl0eV93aW5kb3dzIiwiaW50ZXJ2YWxzX2J5X2lkZW50aXR5IiwiY292ZXJhZ2VfYnlfaWRlbnRpdHkiLCJ1bmtub3duX2J5X2lkZW50aXR5Iiwic291cmNlc19ieV9pZCIsImxvYWRfc3RhdGVzIiwiYXZhaWxhYmlsaXR5X2VudHJ5IiwicHVzaCIsImxvYWRfc3RhdGUiLCJzb3VyY2VzIiwiaWQiLCJpbnRlcnZhbHMiLCJpbnRlcnZhbCIsImludGVydmFsX2lkIiwicmVsYXRlZF9zZWdtZW50X2lkIiwiY292ZXJhZ2UiLCJzdGF0ZSIsInVua25vd24iLCJyZWFzb24iLCJpbmRleE9mIiwicmVzb2x2ZV9ib3VuZGFyeV90aW1lc3RhbXAiLCJyb2xlIiwibWF0Y2hpbmdfdHJhbnNpdGlvbiIsInNwbGl0X2V4YWN0X2ludGVydmFsIiwic3RhcnRfa2V5IiwiZW5kX2tleSIsImZyYWdtZW50cyIsInZpc2libGVfc3RhcnQiLCJ2aXNpYmxlX2VuZCIsInNwbGl0X3BvaW50cyIsImNvbmNhdCIsImZyYWdtZW50X3N0YXJ0X2Vwb2NoIiwiZnJhZ21lbnRfZW5kX2Vwb2NoIiwiZnJhZ21lbnRfc3RhcnRfYXQiLCJmcmFnbWVudF9lbmRfYXQiLCJmcmFnbWVudF9zdGFydCIsImZyYWdtZW50X2VuZCIsInVuZGVmaW5lZCIsIndhbGxfc3RhcnRfbWludXRlIiwid2FsbF9lbmRfbWludXRlIiwic3RhcnRfb2Zmc2V0X21pbnV0ZXMiLCJlbmRfb2Zmc2V0X21pbnV0ZXMiLCJjb250aW51ZXNfYmVmb3JlX2RhdGUiLCJjb250aW51ZXNfYWZ0ZXJfZGF0ZSIsImNvbnRpbnVlc19iZWZvcmVfZnJhZ21lbnQiLCJjb250aW51ZXNfYWZ0ZXJfZnJhZ21lbnQiLCJ0cmFuc2l0aW9uX2JlZm9yZV9pZCIsInRyYW5zaXRpb25fYWZ0ZXJfaWQiLCJyZXNvbHZlX3ZlcnRpY2FsX3JhbmdlIiwicmFuZ2VfcG9saWN5IiwidGltZWRfYm9va2luZ19mcmFnbWVudHMiLCJhdmFpbGFiaWxpdHlfZnJhZ21lbnRzIiwicmVxdWVzdGVkX21vZGUiLCJtb2RlIiwic2FmZV9zdGFydF9taW51dGUiLCJzYWZlX2VuZF9taW51dGUiLCJ3b3JraW5nX3RpbWVfZXhhY3QiLCJzb21lIiwiY292ZXJhZ2VfcmVjb3JkIiwid29ya2luZ19mcmFnbWVudHMiLCJmcmFnbWVudCIsInNwYW5fbWludXRlcyIsImNlaWwiLCJhcHBseV92ZXJ0aWNhbF9yYW5nZSIsInJhbmdlIiwiaXNfb3V0c2lkZSIsImlzX2NsaXBwZWRfYWJvdmUiLCJpc19jbGlwcGVkX2JlbG93IiwiaXNfb3V0c2lkZV9yYW5nZSIsInZpc2libGVfd2FsbF9zdGFydF9taW51dGUiLCJ2aXNpYmxlX3dhbGxfZW5kX21pbnV0ZSIsInRvcF9wZXJjZW50IiwiaGVpZ2h0X3BlcmNlbnQiLCJwcm9qZWN0X2Jvb2tpbmdfZnJhZ21lbnRzIiwiZnVsbF9kYXlfZnJhZ21lbnRzIiwidGltZWRfZnJhZ21lbnRzIiwibG9hZGVkX3N0YXJ0IiwibG9hZGVkX2VuZCIsInNvdXJjZV9zdGFydCIsInNvdXJjZV9lbmQiLCJzcGxpdF9mcmFnbWVudHMiLCJpc19mdWxsX2RheSIsImZyYWdtZW50c19ieV9kYXRlIiwicHJldmlvdXMiLCJjb21tb24iLCJmcmFnbWVudF9pZCIsInNvdXJjZV9zZWdtZW50X2lkIiwic2VyaWVzX2tleSIsInN0YXR1cyIsImxhYmVsIiwiaW5pdGlhbHMiLCJzY2hlZHVsZV9sYWJlbCIsInNlbGVjdGlvbl9hcmlhX2xhYmVsIiwiYXJpYV9sYWJlbCIsImluZm9ybWF0aW9uX2FyaWFfbGFiZWwiLCJjb250aW51ZXNfYmVmb3JlX2xvYWRlZF93aW5kb3ciLCJpc19jbGlwcGVkX3N0YXJ0IiwiY29udGludWVzX2FmdGVyX2xvYWRlZF93aW5kb3ciLCJpc19jbGlwcGVkX2VuZCIsIm9jY3VycmVuY2VfaWQiLCJhc3NpZ25fZnVsbF9kYXlfc3RhY2tzIiwiZ3JvdXBzX2J5X3NlZ21lbnQiLCJsYW5lX2VuZF9lcG9jaHMiLCJkYXRlX3N0YWNrX2NvdW50cyIsImdyb3VwX2tleSIsImdyb3VwIiwibGFuZV9pbmRleCIsImZpbmRJbmRleCIsImxhbmVfZW5kX2Vwb2NoIiwic3RhY2tfaW5kZXgiLCJzdGFja19jb3VudCIsImFzc2lnbl90aW1lZF9sYW5lcyIsInZpc2libGVfbGFuZV9saW1pdCIsImRhdGVzIiwib3ZlcmZsb3dfZ3JvdXBzIiwibGFuZV9lbmRzIiwiY2x1c3Rlcl9mcmFnbWVudHMiLCJjbHVzdGVyX2VuZCIsImNsdXN0ZXJfaW5kZXgiLCJmbHVzaF9jbHVzdGVyIiwiaGlkZGVuIiwiY2x1c3Rlcl9sYW5lX2NvdW50IiwibGFuZV9jb3VudCIsIm92ZXJmbG93X2lkIiwic3RhcnRfd2FsbF9taW51dGUiLCJhcHBseSIsImVuZF93YWxsX21pbnV0ZSIsImhpZGRlbl9jb3VudCIsImZyYWdtZW50X2lkcyIsImJvb2tpbmdfaWRzIiwibGFuZV9jYW5kaWRhdGUiLCJpc19vdmVyZmxvd2VkIiwicHJvamVjdF9hdmFpbGFiaWxpdHlfZnJhZ21lbnRzIiwic291cmNlX2xhYmVsIiwiZ2V0X2F2YWlsYWJpbGl0eV9yYW5rIiwiY29tYmluZV9hdmFpbGFiaWxpdHlfc2xpY2VzIiwiYXZhaWxhYmlsaXR5X3N0YXRlIiwidW5rbm93bl9yZWNvcmRzIiwic291cmNlX2RlZmluaXRpb25zIiwic2xpY2VzIiwiaGFzX2dsb2JhbF91bmtub3duIiwiZGF0ZV9mcmFnbWVudHMiLCJib3VuZGFyaWVzIiwiYm91bmRhcmllc19ieV9taW51dGUiLCJ1bmtub3duX3NvdXJjZV9pZHMiLCJyZWNvcmQiLCJ1bmtub3duX3NvdXJjZXMiLCJib3VuZGFyeSIsImJvdW5kYXJ5X2tleSIsImNvbnRyaWJ1dG9ycyIsInNvdXJjZV9pZHMiLCJ3aW5uZXIiLCJzb3VyY2VfaW5kZXgiLCJhbGxfc291cmNlcyIsInNsaWNlX2lkIiwid2lubmluZ19zb3VyY2UiLCJzb3VyY2VfbGFiZWxzIiwic291cmNlX2lkIiwiY29udHJpYnV0b3IiLCJpbnRlcnZhbF9pZHMiLCJpbnRlcnZhbF9pbmRleCIsImFsbF9pZHMiLCJyZWxhdGVkX3NlZ21lbnRfaWRzIiwic2VnbWVudF9pbmRleCIsImJ1aWxkX3N1bW1hcnlfcmVjb3JkcyIsImF2YWlsYWJpbGl0eV9zbGljZXMiLCJjbGlwcGVkX2F2YWlsYWJpbGl0eV9mcmFnbWVudHMiLCJyZWNvcmRzIiwic3VtbWFyeV9pZCIsInNsaWNlIiwiYnVpbGRfcHJvamVjdGlvbl9jYWNoZV9rZXkiLCJpbnB1dCIsIndpbmRvd19pZGVudGl0eSIsInRpbWVsaW5lX3dpbmRvdyIsImNlbGxfbWludXRlcyIsInZpZXciLCJzY2hlbWFfdmVyc2lvbiIsInJlc291cmNlX2ZpbmdlcnByaW50IiwidGltZXpvbmUiLCJib29raW5nX2dlbmVyYXRpb24iLCJhdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbiIsIndpbmRvd3MiLCJnZXRfcHJvamVjdGlvbl9jYWNoZV9rZXkiLCJwcm9qZWN0IiwiYXZhaWxhYmlsaXR5IiwiYm9va2luZ19wcm9qZWN0aW9uIiwibGFuZV9wcm9qZWN0aW9uIiwiY2FjaGVfa2V5IiwiY2xpcHBlZF9mcmFnbWVudHMiLCJzdW1tYXJ5Iiwid3BiY190aW1lbGluZV90aW1lX3Jvd3NfcHJvamVjdG9yIiwiZnJlZXplIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS10aW1lbGluZS90aW1lLXJvd3MvX3NyYy90aW1lLXJvd3MtcHJvamVjdG9yLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHVyZSBUaW1lbGluZSB0aW1lLXJvd3MgdHdvLWRpbWVuc2lvbmFsIHByb2plY3Rvci5cbiAqXG4gKiBUaGUgcHJvamVjdG9yIHRyYW5zZm9ybXMgYWNjZXB0ZWQgVGltZWxpbmUgRFRPcyBpbnRvIEpTT04tc2FmZSBkYXRlLCBib29raW5nLFxuICogQXZhaWxhYmlsaXR5LCBvdmVyZmxvdywgYW5kIGFjY2Vzc2libGUtc3VtbWFyeSByZWNvcmRzLiBJdCBkb2VzIG5vdCBhY2Nlc3NcbiAqIHRoZSBET00sIHRyYW5zcG9ydCwgV29yZFByZXNzIGdsb2JhbHMsIG9yIGJyb3dzZXItbG9jYWwgdGltZXpvbmUgcnVsZXMuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICogQHNpbmNlICAgMTIuMC4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3cgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgcHJvamVjdGlvbl9zY2hlbWFfdmVyc2lvbiA9IDE7XG5cdHZhciBtaW51dGVzX3Blcl9kYXkgPSAxNDQwO1xuXHR2YXIgZGVmYXVsdF92aXNpYmxlX2xhbmVfbGltaXQgPSAzO1xuXHR2YXIgYXZhaWxhYmlsaXR5X3ByZWNlZGVuY2UgPSBbXG5cdFx0J3Vua25vd24nLFxuXHRcdCdibG9ja2VkX2RhdGUnLFxuXHRcdCdibG9ja2VkX3RpbWUnLFxuXHRcdCd1bmF2YWlsYWJsZV93ZWVrZGF5Jyxcblx0XHQnc2Vhc29uYWxfYXZhaWxhYmlsaXR5Jyxcblx0XHQnYXBwb2ludG1lbnRfYnVmZmVyJyxcblx0XHQnYm9va2luZ19idWZmZXInLFxuXHRcdCd3b3JraW5nX3RpbWUnXG5cdF07XG5cblx0LyoqXG5cdCAqIFJldHVybiBhIGJvdW5kZWQgaW50ZWdlci5cblx0ICpcblx0ICogQHBhcmFtIHsqfSB2YWx1ZSBDYW5kaWRhdGUgbnVtZXJpYyB2YWx1ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IG1pbmltdW0gSW5jbHVzaXZlIG1pbmltdW0uXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBtYXhpbXVtIEluY2x1c2l2ZSBtYXhpbXVtLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZmFsbGJhY2sgVmFsdWUgdXNlZCB3aGVuIHRoZSBjYW5kaWRhdGUgaXMgbm90IGZpbml0ZS5cblx0ICogQHJldHVybiB7bnVtYmVyfSBCb3VuZGVkIGludGVnZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBib3VuZGVkX2ludGVnZXIoIHZhbHVlLCBtaW5pbXVtLCBtYXhpbXVtLCBmYWxsYmFjayApIHtcblx0XHR2YWx1ZSA9IE51bWJlciggdmFsdWUgKTtcblx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCB2YWx1ZSApICkge1xuXHRcdFx0dmFsdWUgPSBmYWxsYmFjaztcblx0XHR9XG5cdFx0cmV0dXJuIE1hdGgubWF4KCBtaW5pbXVtLCBNYXRoLm1pbiggbWF4aW11bSwgTWF0aC5yb3VuZCggdmFsdWUgKSApICk7XG5cdH1cblxuXHQvKipcblx0ICogUGFyc2Ugb25lIGV4YWN0IG9mZnNldC1xdWFsaWZpZWQgUkZDMzMzOSB0aW1lc3RhbXAgd2l0aG91dCBsb2NhbCB0aW1lem9uZSBBUElzLlxuXHQgKlxuXHQgKiBgRGF0ZS5VVEMoKWAgaXMgdXNlZCBvbmx5IGFzIGEgVVRDIGNhbGVuZGFyLXRvLWVwb2NoIHByaW1pdGl2ZS4gVGhlIGV4cGxpY2l0XG5cdCAqIG9mZnNldCBpbiB0aGUgc291cmNlIHRpbWVzdGFtcCByZW1haW5zIGF1dGhvcml0YXRpdmUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0aW1lc3RhbXAgT2Zmc2V0LXF1YWxpZmllZCB0aW1lc3RhbXAuXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBFeGFjdCBlcG9jaCwgd2FsbCBmaWVsZHMsIGFuZCBvZmZzZXQgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIHBhcnNlX2V4YWN0X3RpbWVzdGFtcCggdGltZXN0YW1wICkge1xuXHRcdHZhciBtYXRjaGVzID0gL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KVQoXFxkezJ9KTooXFxkezJ9KTooXFxkezJ9KSg/OlxcLihcXGQrKSk/KFsrLV0pKFxcZHsyfSk6KFxcZHsyfSkkLy5leGVjKCBTdHJpbmcoIHRpbWVzdGFtcCB8fCAnJyApICk7XG5cdFx0dmFyIG9mZnNldF9taW51dGVzO1xuXHRcdHZhciBlcG9jaDtcblxuXHRcdGlmICggISBtYXRjaGVzICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdG9mZnNldF9taW51dGVzID0gKCBOdW1iZXIoIG1hdGNoZXNbIDkgXSApICogNjAgKyBOdW1iZXIoIG1hdGNoZXNbIDEwIF0gKSApICogKCAnLScgPT09IG1hdGNoZXNbIDggXSA/IC0xIDogMSApO1xuXHRcdGVwb2NoID0gTWF0aC5mbG9vciggRGF0ZS5VVEMoXG5cdFx0XHROdW1iZXIoIG1hdGNoZXNbIDEgXSApLFxuXHRcdFx0TnVtYmVyKCBtYXRjaGVzWyAyIF0gKSAtIDEsXG5cdFx0XHROdW1iZXIoIG1hdGNoZXNbIDMgXSApLFxuXHRcdFx0TnVtYmVyKCBtYXRjaGVzWyA0IF0gKSxcblx0XHRcdE51bWJlciggbWF0Y2hlc1sgNSBdICksXG5cdFx0XHROdW1iZXIoIG1hdGNoZXNbIDYgXSApXG5cdFx0KSAvIDEwMDAgKSAtIG9mZnNldF9taW51dGVzICogNjA7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dmFsdWU6IFN0cmluZyggdGltZXN0YW1wICksXG5cdFx0XHRlcG9jaDogZXBvY2gsXG5cdFx0XHRkYXRlOiBtYXRjaGVzWyAxIF0gKyAnLScgKyBtYXRjaGVzWyAyIF0gKyAnLScgKyBtYXRjaGVzWyAzIF0sXG5cdFx0XHRob3VyOiBOdW1iZXIoIG1hdGNoZXNbIDQgXSApLFxuXHRcdFx0bWludXRlOiBOdW1iZXIoIG1hdGNoZXNbIDUgXSApLFxuXHRcdFx0c2Vjb25kOiBOdW1iZXIoIG1hdGNoZXNbIDYgXSApLFxuXHRcdFx0d2FsbF9taW51dGU6IE51bWJlciggbWF0Y2hlc1sgNCBdICkgKiA2MCArIE51bWJlciggbWF0Y2hlc1sgNSBdICkgKyBOdW1iZXIoIG1hdGNoZXNbIDYgXSApIC8gNjAsXG5cdFx0XHRvZmZzZXRfbWludXRlczogb2Zmc2V0X21pbnV0ZXNcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFNvcnQgYW4gb2JqZWN0J3Mga2V5cyByZWN1cnNpdmVseSBmb3IgZGV0ZXJtaW5pc3RpYyBjYWNoZSBpZGVudGl0aWVzLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHZhbHVlIEpTT04tc2FmZSB2YWx1ZS5cblx0ICogQHJldHVybiB7Kn0gUmVjdXJzaXZlbHkgb3JkZXJlZCBKU09OLXNhZmUgdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBvcmRlcl9qc29uX3ZhbHVlKCB2YWx1ZSApIHtcblx0XHR2YXIgb3JkZXJlZCA9IHt9O1xuXG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCB2YWx1ZSApICkge1xuXHRcdFx0cmV0dXJuIHZhbHVlLm1hcCggb3JkZXJfanNvbl92YWx1ZSApO1xuXHRcdH1cblx0XHRpZiAoICEgdmFsdWUgfHwgJ29iamVjdCcgIT09IHR5cGVvZiB2YWx1ZSApIHtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdFx0T2JqZWN0LmtleXMoIHZhbHVlICkuc29ydCgpLmZvckVhY2goIGZ1bmN0aW9uICgga2V5ICkge1xuXHRcdFx0b3JkZXJlZFsga2V5IF0gPSBvcmRlcl9qc29uX3ZhbHVlKCB2YWx1ZVsga2V5IF0gKTtcblx0XHR9ICk7XG5cdFx0cmV0dXJuIG9yZGVyZWQ7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGEgZGV0ZXJtaW5pc3RpYyBjb21wYWN0IGhhc2ggZm9yIGEgSlNPTi1zYWZlIGlkZW50aXR5LlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IHZhbHVlIEpTT04tc2FmZSBpZGVudGl0eSB2YWx1ZS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBFaWdodC1jaGFyYWN0ZXIgRk5WLTFhIGhhc2guXG5cdCAqL1xuXHRmdW5jdGlvbiBoYXNoX2lkZW50aXR5KCB2YWx1ZSApIHtcblx0XHR2YXIgc291cmNlID0gSlNPTi5zdHJpbmdpZnkoIG9yZGVyX2pzb25fdmFsdWUoIHZhbHVlICkgKTtcblx0XHR2YXIgaGFzaCA9IDIxNjYxMzYyNjE7XG5cdFx0dmFyIGluZGV4O1xuXG5cdFx0Zm9yICggaW5kZXggPSAwOyBpbmRleCA8IHNvdXJjZS5sZW5ndGg7IGluZGV4KysgKSB7XG5cdFx0XHRoYXNoIF49IHNvdXJjZS5jaGFyQ29kZUF0KCBpbmRleCApO1xuXHRcdFx0aGFzaCA9IE1hdGguaW11bCggaGFzaCwgMTY3Nzc2MTkgKTtcblx0XHR9XG5cdFx0cmV0dXJuICggaGFzaCA+Pj4gMCApLnRvU3RyaW5nKCAxNiApLnBhZFN0YXJ0KCA4LCAnMCcgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gb25lIG5vcm1hbGl6ZWQgdHJhbnNpdGlvbiBmcm9tIGEgc2VydmVyIGRhdGUgYmFuZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHRyYW5zaXRpb24gU2VydmVyIHRyYW5zaXRpb24gRFRPLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTm9ybWFsaXplZCB0cmFuc2l0aW9uIG9yIG51bGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfdHJhbnNpdGlvbiggdHJhbnNpdGlvbiApIHtcblx0XHR2YXIgZXBvY2ggPSBOdW1iZXIoIHRyYW5zaXRpb24gJiYgdHJhbnNpdGlvbi5lcG9jaCApO1xuXHRcdHZhciBiZWZvcmUgPSBwYXJzZV9leGFjdF90aW1lc3RhbXAoIHRyYW5zaXRpb24gJiYgdHJhbnNpdGlvbi5sb2NhbF9iZWZvcmVfYXQgKTtcblx0XHR2YXIgYWZ0ZXIgPSBwYXJzZV9leGFjdF90aW1lc3RhbXAoIHRyYW5zaXRpb24gJiYgdHJhbnNpdGlvbi5sb2NhbF9hZnRlcl9hdCApO1xuXG5cdFx0aWYgKCAhIE51bWJlci5pc0ludGVnZXIoIGVwb2NoICkgfHwgISBiZWZvcmUgfHwgISBhZnRlciB8fCAoICdnYXAnICE9PSB0cmFuc2l0aW9uLmtpbmQgJiYgJ2ZvbGQnICE9PSB0cmFuc2l0aW9uLmtpbmQgKSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0dHJhbnNpdGlvbl9pZDogU3RyaW5nKCB0cmFuc2l0aW9uLnRyYW5zaXRpb25faWQgfHwgJ3RyYW5zaXRpb24tJyArIGVwb2NoICksXG5cdFx0XHRlcG9jaDogZXBvY2gsXG5cdFx0XHRraW5kOiB0cmFuc2l0aW9uLmtpbmQsXG5cdFx0XHRsb2NhbF9iZWZvcmVfYXQ6IGJlZm9yZS52YWx1ZSxcblx0XHRcdGxvY2FsX2FmdGVyX2F0OiBhZnRlci52YWx1ZSxcblx0XHRcdHdhbGxfcmFuZ2Vfc3RhcnRfbWludXRlOiBib3VuZGVkX2ludGVnZXIoIHRyYW5zaXRpb24ud2FsbF9yYW5nZV9zdGFydF9taW51dGUsIDAsIG1pbnV0ZXNfcGVyX2RheSwgTWF0aC5taW4oIGJlZm9yZS53YWxsX21pbnV0ZSwgYWZ0ZXIud2FsbF9taW51dGUgKSApLFxuXHRcdFx0d2FsbF9yYW5nZV9lbmRfbWludXRlOiBib3VuZGVkX2ludGVnZXIoIHRyYW5zaXRpb24ud2FsbF9yYW5nZV9lbmRfbWludXRlLCAwLCBtaW51dGVzX3Blcl9kYXksIE1hdGgubWF4KCBiZWZvcmUud2FsbF9taW51dGUsIGFmdGVyLndhbGxfbWludXRlICkgKSxcblx0XHRcdG9mZnNldF9iZWZvcmVfc2Vjb25kczogTnVtYmVyKCB0cmFuc2l0aW9uLm9mZnNldF9iZWZvcmVfc2Vjb25kcyB8fCBiZWZvcmUub2Zmc2V0X21pbnV0ZXMgKiA2MCApLFxuXHRcdFx0b2Zmc2V0X2FmdGVyX3NlY29uZHM6IE51bWJlciggdHJhbnNpdGlvbi5vZmZzZXRfYWZ0ZXJfc2Vjb25kcyB8fCBhZnRlci5vZmZzZXRfbWludXRlcyAqIDYwIClcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbGxlY3QgdW5pcXVlIGF1dGhvcml6ZWQgZGF0ZSBiYW5kcyBmcm9tIGFjY2VwdGVkIG5hdGl2ZSB3aW5kb3dzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IGJvb2tpbmdfd2luZG93cyBBY2NlcHRlZCBuYXRpdmUgd2luZG93IGVudHJpZXMuXG5cdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IENocm9ub2xvZ2ljYWwgbm9ybWFsaXplZCBkYXRlIGJhbmRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gY29sbGVjdF9kYXRlX2JhbmRzKCBib29raW5nX3dpbmRvd3MgKSB7XG5cdFx0dmFyIGJhbmRzX2J5X2RhdGUgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cblx0XHQoIEFycmF5LmlzQXJyYXkoIGJvb2tpbmdfd2luZG93cyApID8gYm9va2luZ193aW5kb3dzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHdpbmRvd19lbnRyeSApIHtcblx0XHRcdHZhciBheGlzID0gd2luZG93X2VudHJ5ICYmIHdpbmRvd19lbnRyeS5wYXlsb2FkID8gd2luZG93X2VudHJ5LnBheWxvYWQuYXhpcyB8fCB7fSA6IHt9O1xuXG5cdFx0XHQoIEFycmF5LmlzQXJyYXkoIGF4aXMuZGF0ZV9iYW5kcyApID8gYXhpcy5kYXRlX2JhbmRzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGRhdGVfYmFuZCApIHtcblx0XHRcdFx0dmFyIHN0YXJ0ID0gcGFyc2VfZXhhY3RfdGltZXN0YW1wKCBkYXRlX2JhbmQuc3RhcnRfYXQgKTtcblx0XHRcdFx0dmFyIGVuZCA9IHBhcnNlX2V4YWN0X3RpbWVzdGFtcCggZGF0ZV9iYW5kLmVuZF9hdCApO1xuXHRcdFx0XHR2YXIgZGF0ZSA9IFN0cmluZyggZGF0ZV9iYW5kLmRhdGUgfHwgKCBzdGFydCA/IHN0YXJ0LmRhdGUgOiAnJyApICk7XG5cdFx0XHRcdHZhciB0cmFuc2l0aW9ucztcblxuXHRcdFx0XHRpZiAoICEgZGF0ZSB8fCAhIHN0YXJ0IHx8ICEgZW5kIHx8IGVuZC5lcG9jaCA8PSBzdGFydC5lcG9jaCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dHJhbnNpdGlvbnMgPSAoIEFycmF5LmlzQXJyYXkoIGRhdGVfYmFuZC50cmFuc2l0aW9ucyApID8gZGF0ZV9iYW5kLnRyYW5zaXRpb25zIDogW10gKS5tYXAoIG5vcm1hbGl6ZV90cmFuc2l0aW9uICkuZmlsdGVyKCBCb29sZWFuICkuc29ydCggZnVuY3Rpb24gKCBsZWZ0LCByaWdodCApIHtcblx0XHRcdFx0XHRyZXR1cm4gbGVmdC5lcG9jaCAtIHJpZ2h0LmVwb2NoO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdGlmICggYmFuZHNfYnlfZGF0ZVsgZGF0ZSBdICkge1xuXHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdGJhbmRzX2J5X2RhdGVbIGRhdGUgXS5zdGFydF9lcG9jaCAhPT0gc3RhcnQuZXBvY2hcblx0XHRcdFx0XHRcdHx8IGJhbmRzX2J5X2RhdGVbIGRhdGUgXS5lbmRfZXBvY2ggIT09IGVuZC5lcG9jaFxuXHRcdFx0XHRcdFx0fHwgaGFzaF9pZGVudGl0eSggYmFuZHNfYnlfZGF0ZVsgZGF0ZSBdLnRyYW5zaXRpb25zICkgIT09IGhhc2hfaWRlbnRpdHkoIHRyYW5zaXRpb25zIClcblx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoICdDb25mbGljdGluZyBhY2NlcHRlZCBkYXRlLWJhbmQgaWRlbnRpdHkuJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRiYW5kc19ieV9kYXRlWyBkYXRlIF0uc3BhbiA9IE1hdGgubWF4KCBiYW5kc19ieV9kYXRlWyBkYXRlIF0uc3BhbiwgTnVtYmVyKCBkYXRlX2JhbmQuc3BhbiB8fCAxICkgKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCAhIGJhbmRzX2J5X2RhdGVbIGRhdGUgXSApIHtcblx0XHRcdFx0XHRiYW5kc19ieV9kYXRlWyBkYXRlIF0gPSB7XG5cdFx0XHRcdFx0XHRkYXRlOiBkYXRlLFxuXHRcdFx0XHRcdFx0c3RhcnRfYXQ6IHN0YXJ0LnZhbHVlLFxuXHRcdFx0XHRcdFx0ZW5kX2F0OiBlbmQudmFsdWUsXG5cdFx0XHRcdFx0XHRzdGFydF9lcG9jaDogc3RhcnQuZXBvY2gsXG5cdFx0XHRcdFx0XHRlbmRfZXBvY2g6IGVuZC5lcG9jaCxcblx0XHRcdFx0XHRcdGVsYXBzZWRfbWludXRlczogTnVtYmVyKCBkYXRlX2JhbmQuZWxhcHNlZF9taW51dGVzIHx8ICggZW5kLmVwb2NoIC0gc3RhcnQuZXBvY2ggKSAvIDYwICksXG5cdFx0XHRcdFx0XHR3YWxsX21pbnV0ZXM6IG1pbnV0ZXNfcGVyX2RheSxcblx0XHRcdFx0XHRcdHNwYW46IE1hdGgubWF4KCAxLCBOdW1iZXIoIGRhdGVfYmFuZC5zcGFuIHx8IDEgKSApLFxuXHRcdFx0XHRcdFx0dHJhbnNpdGlvbnM6IHRyYW5zaXRpb25zXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH0gKTtcblxuXHRcdHZhciBvcmRlcmVkX2RhdGVfYmFuZHMgPSBPYmplY3Qua2V5cyggYmFuZHNfYnlfZGF0ZSApLm1hcCggZnVuY3Rpb24gKCBkYXRlICkge1xuXHRcdFx0cmV0dXJuIGJhbmRzX2J5X2RhdGVbIGRhdGUgXTtcblx0XHR9ICkuc29ydCggZnVuY3Rpb24gKCBsZWZ0LCByaWdodCApIHtcblx0XHRcdHJldHVybiBsZWZ0LnN0YXJ0X2Vwb2NoIC0gcmlnaHQuc3RhcnRfZXBvY2g7XG5cdFx0fSApO1xuXHRcdHZhciB0b3RhbF9zcGFuID0gb3JkZXJlZF9kYXRlX2JhbmRzLnJlZHVjZSggZnVuY3Rpb24gKCBzcGFuLCBkYXRlX2JhbmQgKSB7XG5cdFx0XHRyZXR1cm4gc3BhbiArIGRhdGVfYmFuZC5zcGFuO1xuXHRcdH0sIDAgKTtcblx0XHR2YXIgY29uc3VtZWRfc3BhbiA9IDA7XG5cblx0XHRyZXR1cm4gb3JkZXJlZF9kYXRlX2JhbmRzLm1hcCggZnVuY3Rpb24gKCBkYXRlX2JhbmQsIGluZGV4ICkge1xuXHRcdFx0dmFyIG9mZnNldF9wZXJjZW50ID0gdG90YWxfc3BhbiA/IDEwMCAqIGNvbnN1bWVkX3NwYW4gLyB0b3RhbF9zcGFuIDogMDtcblx0XHRcdHZhciB3aWR0aF9wZXJjZW50ID0gdG90YWxfc3BhbiA/IDEwMCAqIGRhdGVfYmFuZC5zcGFuIC8gdG90YWxfc3BhbiA6IDEwMDtcblx0XHRcdHZhciBub3JtYWxpemVkX2RhdGVfYmFuZCA9IE9iamVjdC5hc3NpZ24oIHt9LCBkYXRlX2JhbmQsIHtcblx0XHRcdFx0aW5kZXg6IGluZGV4LFxuXHRcdFx0XHRvZmZzZXRfcGVyY2VudDogTnVtYmVyKCBvZmZzZXRfcGVyY2VudC50b0ZpeGVkKCA4ICkgKSxcblx0XHRcdFx0d2lkdGhfcGVyY2VudDogTnVtYmVyKCB3aWR0aF9wZXJjZW50LnRvRml4ZWQoIDggKSApLFxuXHRcdFx0XHRkc3Rfc2xpY2VzOiBkYXRlX2JhbmQudHJhbnNpdGlvbnMubWFwKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHRyYW5zaXRpb25faWQ6IHRyYW5zaXRpb24udHJhbnNpdGlvbl9pZCxcblx0XHRcdFx0XHRcdGtpbmQ6IHRyYW5zaXRpb24ua2luZCxcblx0XHRcdFx0XHRcdHN0YXJ0X21pbnV0ZTogdHJhbnNpdGlvbi53YWxsX3JhbmdlX3N0YXJ0X21pbnV0ZSxcblx0XHRcdFx0XHRcdGVuZF9taW51dGU6IHRyYW5zaXRpb24ud2FsbF9yYW5nZV9lbmRfbWludXRlLFxuXHRcdFx0XHRcdFx0b2Zmc2V0X2JlZm9yZV9zZWNvbmRzOiB0cmFuc2l0aW9uLm9mZnNldF9iZWZvcmVfc2Vjb25kcyxcblx0XHRcdFx0XHRcdG9mZnNldF9hZnRlcl9zZWNvbmRzOiB0cmFuc2l0aW9uLm9mZnNldF9hZnRlcl9zZWNvbmRzXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSApXG5cdFx0XHR9ICk7XG5cblx0XHRcdGNvbnN1bWVkX3NwYW4gKz0gZGF0ZV9iYW5kLnNwYW47XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplZF9kYXRlX2JhbmQ7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbGxlY3QgdW5pcXVlIGJvb2tpbmcgc2VnbWVudHMgZm9yIG9uZSBSZXNvdXJjZSBmcm9tIG92ZXJsYXBwaW5nIHdpbmRvd3MuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gYm9va2luZ193aW5kb3dzIEFjY2VwdGVkIG5hdGl2ZSB3aW5kb3cgZW50cmllcy5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IFN0YWJsZSBkZWR1cGxpY2F0ZWQgc2VnbWVudHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBjb2xsZWN0X2Jvb2tpbmdfc2VnbWVudHMoIGJvb2tpbmdfd2luZG93cywgcmVzb3VyY2VfaWQgKSB7XG5cdFx0dmFyIHNlZ21lbnRfcmVjb3Jkc19ieV9pZGVudGl0eSA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblxuXHRcdCggQXJyYXkuaXNBcnJheSggYm9va2luZ193aW5kb3dzICkgPyBib29raW5nX3dpbmRvd3MgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggd2luZG93X2VudHJ5ICkge1xuXHRcdFx0dmFyIHBheWxvYWQgPSB3aW5kb3dfZW50cnkgJiYgd2luZG93X2VudHJ5LnBheWxvYWQgPyB3aW5kb3dfZW50cnkucGF5bG9hZCA6IHt9O1xuXG5cdFx0XHQoIEFycmF5LmlzQXJyYXkoIHBheWxvYWQuc2VnbWVudHMgKSA/IHBheWxvYWQuc2VnbWVudHMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggc2VnbWVudCApIHtcblx0XHRcdFx0dmFyIHN0YXJ0ID0gcGFyc2VfZXhhY3RfdGltZXN0YW1wKCBzZWdtZW50ICYmIHNlZ21lbnQuc3RhcnQgKTtcblx0XHRcdFx0dmFyIGVuZCA9IHBhcnNlX2V4YWN0X3RpbWVzdGFtcCggc2VnbWVudCAmJiBzZWdtZW50LmVuZCApO1xuXHRcdFx0XHR2YXIgaWRlbnRpdHk7XG5cblx0XHRcdFx0aWYgKCBOdW1iZXIoIHNlZ21lbnQgJiYgc2VnbWVudC5yZXNvdXJjZV9pZCApICE9PSByZXNvdXJjZV9pZCB8fCAhIHN0YXJ0IHx8ICEgZW5kIHx8IGVuZC5lcG9jaCA8PSBzdGFydC5lcG9jaCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWRlbnRpdHkgPSBbIFN0cmluZyggc2VnbWVudC5zZWdtZW50X2lkIHx8ICcnICksIHN0YXJ0LmVwb2NoLCBlbmQuZXBvY2gsIE51bWJlciggc2VnbWVudC5ib29raW5nX2lkIHx8IDAgKSwgcmVzb3VyY2VfaWQgXS5qb2luKCAnfCcgKTtcblx0XHRcdFx0aWYgKCAhIHNlZ21lbnRfcmVjb3Jkc19ieV9pZGVudGl0eVsgaWRlbnRpdHkgXSApIHtcblx0XHRcdFx0XHRzZWdtZW50X3JlY29yZHNfYnlfaWRlbnRpdHlbIGlkZW50aXR5IF0gPSB7XG5cdFx0XHRcdFx0XHRzZWdtZW50OiBzZWdtZW50LFxuXHRcdFx0XHRcdFx0c3RhcnRfZXBvY2g6IHN0YXJ0LmVwb2NoLFxuXHRcdFx0XHRcdFx0ZW5kX2Vwb2NoOiBlbmQuZXBvY2hcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKCBzZWdtZW50X3JlY29yZHNfYnlfaWRlbnRpdHkgKS5tYXAoIGZ1bmN0aW9uICggaWRlbnRpdHkgKSB7XG5cdFx0XHRyZXR1cm4gc2VnbWVudF9yZWNvcmRzX2J5X2lkZW50aXR5WyBpZGVudGl0eSBdO1xuXHRcdH0gKS5zb3J0KCBmdW5jdGlvbiAoIGxlZnQsIHJpZ2h0ICkge1xuXHRcdFx0cmV0dXJuIGxlZnQuc3RhcnRfZXBvY2ggLSByaWdodC5zdGFydF9lcG9jaFxuXHRcdFx0XHR8fCBsZWZ0LmVuZF9lcG9jaCAtIHJpZ2h0LmVuZF9lcG9jaFxuXHRcdFx0XHR8fCBTdHJpbmcoIGxlZnQuc2VnbWVudC5zZWdtZW50X2lkICkubG9jYWxlQ29tcGFyZSggU3RyaW5nKCByaWdodC5zZWdtZW50LnNlZ21lbnRfaWQgKSApO1xuXHRcdH0gKS5tYXAoIGZ1bmN0aW9uICggc2VnbWVudF9yZWNvcmQgKSB7XG5cdFx0XHRyZXR1cm4gc2VnbWVudF9yZWNvcmQuc2VnbWVudDtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29sbGVjdCB1bmlxdWUgQXZhaWxhYmlsaXR5IGludGVydmFscyBhbmQgY292ZXJhZ2UgZm9yIG9uZSBSZXNvdXJjZS5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBhdmFpbGFiaWxpdHlfd2luZG93cyBBY2NlcHRlZCBBdmFpbGFiaWxpdHkgZW50cmllcy5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRGVkdXBsaWNhdGVkIGludGVydmFscywgY292ZXJhZ2UsIHVua25vd24gcmVjb3JkcywgYW5kIHNvdXJjZXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBjb2xsZWN0X2F2YWlsYWJpbGl0eSggYXZhaWxhYmlsaXR5X3dpbmRvd3MsIHJlc291cmNlX2lkICkge1xuXHRcdHZhciBpbnRlcnZhbHNfYnlfaWRlbnRpdHkgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIGNvdmVyYWdlX2J5X2lkZW50aXR5ID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciB1bmtub3duX2J5X2lkZW50aXR5ID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciBzb3VyY2VzX2J5X2lkID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciBsb2FkX3N0YXRlcyA9IFtdO1xuXG5cdFx0KCBBcnJheS5pc0FycmF5KCBhdmFpbGFiaWxpdHlfd2luZG93cyApID8gYXZhaWxhYmlsaXR5X3dpbmRvd3MgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggYXZhaWxhYmlsaXR5X2VudHJ5ICkge1xuXHRcdFx0dmFyIHBheWxvYWQgPSBhdmFpbGFiaWxpdHlfZW50cnkgJiYgYXZhaWxhYmlsaXR5X2VudHJ5LnBheWxvYWQgPyBhdmFpbGFiaWxpdHlfZW50cnkucGF5bG9hZCA6IHt9O1xuXG5cdFx0XHRsb2FkX3N0YXRlcy5wdXNoKCBTdHJpbmcoIHBheWxvYWQubG9hZF9zdGF0ZSB8fCAnbG9hZGVkJyApICk7XG5cdFx0XHQoIEFycmF5LmlzQXJyYXkoIHBheWxvYWQuc291cmNlcyApID8gcGF5bG9hZC5zb3VyY2VzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHNvdXJjZSApIHtcblx0XHRcdFx0aWYgKCBzb3VyY2UgJiYgc291cmNlLmlkICkge1xuXHRcdFx0XHRcdHNvdXJjZXNfYnlfaWRbIFN0cmluZyggc291cmNlLmlkICkgXSA9IHNvdXJjZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0KCBBcnJheS5pc0FycmF5KCBwYXlsb2FkLmludGVydmFscyApID8gcGF5bG9hZC5pbnRlcnZhbHMgOiBbXSApLmZvckVhY2goIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdHZhciBzdGFydCA9IHBhcnNlX2V4YWN0X3RpbWVzdGFtcCggaW50ZXJ2YWwgJiYgaW50ZXJ2YWwuc3RhcnRfYXQgKTtcblx0XHRcdFx0dmFyIGVuZCA9IHBhcnNlX2V4YWN0X3RpbWVzdGFtcCggaW50ZXJ2YWwgJiYgaW50ZXJ2YWwuZW5kX2F0ICk7XG5cdFx0XHRcdHZhciBpZGVudGl0eTtcblxuXHRcdFx0XHRpZiAoIE51bWJlciggaW50ZXJ2YWwgJiYgaW50ZXJ2YWwucmVzb3VyY2VfaWQgKSAhPT0gcmVzb3VyY2VfaWQgfHwgISBzdGFydCB8fCAhIGVuZCB8fCBlbmQuZXBvY2ggPD0gc3RhcnQuZXBvY2ggKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlkZW50aXR5ID0gWyBTdHJpbmcoIGludGVydmFsLmludGVydmFsX2lkIHx8ICcnICksIFN0cmluZyggaW50ZXJ2YWwuc291cmNlIHx8ICcnICksIHN0YXJ0LmVwb2NoLCBlbmQuZXBvY2gsIFN0cmluZyggaW50ZXJ2YWwucmVsYXRlZF9zZWdtZW50X2lkIHx8ICcnICkgXS5qb2luKCAnfCcgKTtcblx0XHRcdFx0aWYgKCAhIGludGVydmFsc19ieV9pZGVudGl0eVsgaWRlbnRpdHkgXSApIHtcblx0XHRcdFx0XHRpbnRlcnZhbHNfYnlfaWRlbnRpdHlbIGlkZW50aXR5IF0gPSBpbnRlcnZhbDtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0KCBBcnJheS5pc0FycmF5KCBwYXlsb2FkLmNvdmVyYWdlICkgPyBwYXlsb2FkLmNvdmVyYWdlIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvdmVyYWdlICkge1xuXHRcdFx0XHRpZiAoIE51bWJlciggY292ZXJhZ2UgJiYgY292ZXJhZ2UucmVzb3VyY2VfaWQgKSA9PT0gcmVzb3VyY2VfaWQgJiYgY292ZXJhZ2Uuc291cmNlICkge1xuXHRcdFx0XHRcdGlmICggISBjb3ZlcmFnZV9ieV9pZGVudGl0eVsgU3RyaW5nKCBjb3ZlcmFnZS5zb3VyY2UgKSBdIHx8ICd1bmtub3duJyA9PT0gY292ZXJhZ2Uuc3RhdGUgKSB7XG5cdFx0XHRcdFx0XHRjb3ZlcmFnZV9ieV9pZGVudGl0eVsgU3RyaW5nKCBjb3ZlcmFnZS5zb3VyY2UgKSBdID0gY292ZXJhZ2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHQoIEFycmF5LmlzQXJyYXkoIHBheWxvYWQudW5rbm93biApID8gcGF5bG9hZC51bmtub3duIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHVua25vd24gKSB7XG5cdFx0XHRcdHZhciBpZGVudGl0eSA9IFsgU3RyaW5nKCB1bmtub3duICYmIHVua25vd24uc291cmNlIHx8ICcnICksIFN0cmluZyggdW5rbm93biAmJiB1bmtub3duLnJlYXNvbiB8fCAnJyApIF0uam9pbiggJ3wnICk7XG5cblx0XHRcdFx0aWYgKCBOdW1iZXIoIHVua25vd24gJiYgdW5rbm93bi5yZXNvdXJjZV9pZCApID09PSByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHR1bmtub3duX2J5X2lkZW50aXR5WyBpZGVudGl0eSBdID0gdW5rbm93bjtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRsb2FkX3N0YXRlOiAtMSAhPT0gbG9hZF9zdGF0ZXMuaW5kZXhPZiggJ3BhcnRpYWwnICkgPyAncGFydGlhbCcgOiAoIGxvYWRfc3RhdGVzLmxlbmd0aCA/ICdsb2FkZWQnIDogJ2xvYWRpbmcnICksXG5cdFx0XHRpbnRlcnZhbHM6IE9iamVjdC5rZXlzKCBpbnRlcnZhbHNfYnlfaWRlbnRpdHkgKS5tYXAoIGZ1bmN0aW9uICggaWRlbnRpdHkgKSB7XG5cdFx0XHRcdHJldHVybiBpbnRlcnZhbHNfYnlfaWRlbnRpdHlbIGlkZW50aXR5IF07XG5cdFx0XHR9ICksXG5cdFx0XHRjb3ZlcmFnZTogT2JqZWN0LmtleXMoIGNvdmVyYWdlX2J5X2lkZW50aXR5ICkuc29ydCgpLm1hcCggZnVuY3Rpb24gKCBpZGVudGl0eSApIHtcblx0XHRcdFx0cmV0dXJuIGNvdmVyYWdlX2J5X2lkZW50aXR5WyBpZGVudGl0eSBdO1xuXHRcdFx0fSApLFxuXHRcdFx0dW5rbm93bjogT2JqZWN0LmtleXMoIHVua25vd25fYnlfaWRlbnRpdHkgKS5zb3J0KCkubWFwKCBmdW5jdGlvbiAoIGlkZW50aXR5ICkge1xuXHRcdFx0XHRyZXR1cm4gdW5rbm93bl9ieV9pZGVudGl0eVsgaWRlbnRpdHkgXTtcblx0XHRcdH0gKSxcblx0XHRcdHNvdXJjZXM6IHNvdXJjZXNfYnlfaWRcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc29sdmUgYSBsb2NhbCB0aW1lc3RhbXAgc3RyaW5nIGZvciBhbiBleGFjdCBzcGxpdCBib3VuZGFyeS5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IGVwb2NoIEV4YWN0IGJvdW5kYXJ5IGVwb2NoLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcm9sZSBgc3RhcnRgIG9yIGBlbmRgIGZyYWdtZW50IGJvdW5kYXJ5IHJvbGUuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBpbnRlcnZhbCBQYXJzZWQgc291cmNlIGludGVydmFsLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGF0ZV9iYW5kIFNlcnZlciBkYXRlIGJhbmQuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gT2Zmc2V0LXF1YWxpZmllZCBsb2NhbCB0aW1lc3RhbXAuXG5cdCAqL1xuXHRmdW5jdGlvbiByZXNvbHZlX2JvdW5kYXJ5X3RpbWVzdGFtcCggZXBvY2gsIHJvbGUsIGludGVydmFsLCBkYXRlX2JhbmQgKSB7XG5cdFx0dmFyIG1hdGNoaW5nX3RyYW5zaXRpb24gPSBkYXRlX2JhbmQudHJhbnNpdGlvbnMuZmlsdGVyKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRyZXR1cm4gdHJhbnNpdGlvbi5lcG9jaCA9PT0gZXBvY2g7XG5cdFx0fSApWyAwIF07XG5cblx0XHRpZiAoIGVwb2NoID09PSBpbnRlcnZhbC5zdGFydC5lcG9jaCApIHtcblx0XHRcdHJldHVybiBpbnRlcnZhbC5zdGFydC52YWx1ZTtcblx0XHR9XG5cdFx0aWYgKCBlcG9jaCA9PT0gaW50ZXJ2YWwuZW5kLmVwb2NoICkge1xuXHRcdFx0cmV0dXJuIGludGVydmFsLmVuZC52YWx1ZTtcblx0XHR9XG5cdFx0aWYgKCBlcG9jaCA9PT0gZGF0ZV9iYW5kLnN0YXJ0X2Vwb2NoICkge1xuXHRcdFx0cmV0dXJuIGRhdGVfYmFuZC5zdGFydF9hdDtcblx0XHR9XG5cdFx0aWYgKCBlcG9jaCA9PT0gZGF0ZV9iYW5kLmVuZF9lcG9jaCApIHtcblx0XHRcdHJldHVybiBkYXRlX2JhbmQuZW5kX2F0O1xuXHRcdH1cblx0XHRpZiAoIG1hdGNoaW5nX3RyYW5zaXRpb24gKSB7XG5cdFx0XHRyZXR1cm4gJ2VuZCcgPT09IHJvbGUgPyBtYXRjaGluZ190cmFuc2l0aW9uLmxvY2FsX2JlZm9yZV9hdCA6IG1hdGNoaW5nX3RyYW5zaXRpb24ubG9jYWxfYWZ0ZXJfYXQ7XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdC8qKlxuXHQgKiBTcGxpdCBvbmUgZXhhY3QgaW50ZXJ2YWwgYXQgbG9jYWwgbWlkbmlnaHRzIGFuZCBEU1QgdHJhbnNpdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgU291cmNlIERUTyBjYXJyeWluZyBleGFjdCB0aW1lc3RhbXBzLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3RhcnRfa2V5IFN0YXJ0IHRpbWVzdGFtcCBmaWVsZC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGVuZF9rZXkgRW5kIHRpbWVzdGFtcCBmaWVsZC5cblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBkYXRlX2JhbmRzIEFjY2VwdGVkIHNlcnZlciBkYXRlIGJhbmRzLlxuXHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBDaHJvbm9sb2dpY2FsIGV4YWN0IGRhdGUgZnJhZ21lbnRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gc3BsaXRfZXhhY3RfaW50ZXJ2YWwoIHNvdXJjZSwgc3RhcnRfa2V5LCBlbmRfa2V5LCBkYXRlX2JhbmRzICkge1xuXHRcdHZhciBzdGFydCA9IHBhcnNlX2V4YWN0X3RpbWVzdGFtcCggc291cmNlICYmIHNvdXJjZVsgc3RhcnRfa2V5IF0gKTtcblx0XHR2YXIgZW5kID0gcGFyc2VfZXhhY3RfdGltZXN0YW1wKCBzb3VyY2UgJiYgc291cmNlWyBlbmRfa2V5IF0gKTtcblx0XHR2YXIgaW50ZXJ2YWw7XG5cdFx0dmFyIGZyYWdtZW50cyA9IFtdO1xuXG5cdFx0aWYgKCAhIHN0YXJ0IHx8ICEgZW5kIHx8IGVuZC5lcG9jaCA8PSBzdGFydC5lcG9jaCApIHtcblx0XHRcdHJldHVybiBmcmFnbWVudHM7XG5cdFx0fVxuXHRcdGludGVydmFsID0geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG5cdFx0ZGF0ZV9iYW5kcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGRhdGVfYmFuZCApIHtcblx0XHRcdHZhciB2aXNpYmxlX3N0YXJ0ID0gTWF0aC5tYXgoIHN0YXJ0LmVwb2NoLCBkYXRlX2JhbmQuc3RhcnRfZXBvY2ggKTtcblx0XHRcdHZhciB2aXNpYmxlX2VuZCA9IE1hdGgubWluKCBlbmQuZXBvY2gsIGRhdGVfYmFuZC5lbmRfZXBvY2ggKTtcblx0XHRcdHZhciBzcGxpdF9wb2ludHM7XG5cblx0XHRcdGlmICggdmlzaWJsZV9lbmQgPD0gdmlzaWJsZV9zdGFydCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0c3BsaXRfcG9pbnRzID0gWyB2aXNpYmxlX3N0YXJ0IF0uY29uY2F0KCBkYXRlX2JhbmQudHJhbnNpdGlvbnMubWFwKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7XG5cdFx0XHRcdHJldHVybiB0cmFuc2l0aW9uLmVwb2NoO1xuXHRcdFx0fSApLmZpbHRlciggZnVuY3Rpb24gKCBlcG9jaCApIHtcblx0XHRcdFx0cmV0dXJuIGVwb2NoID4gdmlzaWJsZV9zdGFydCAmJiBlcG9jaCA8IHZpc2libGVfZW5kO1xuXHRcdFx0fSApICkuY29uY2F0KCBbIHZpc2libGVfZW5kIF0gKTtcblx0XHRcdHNwbGl0X3BvaW50cy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZyYWdtZW50X3N0YXJ0X2Vwb2NoLCBpbmRleCApIHtcblx0XHRcdFx0dmFyIGZyYWdtZW50X2VuZF9lcG9jaCA9IHNwbGl0X3BvaW50c1sgaW5kZXggKyAxIF07XG5cdFx0XHRcdHZhciBmcmFnbWVudF9zdGFydF9hdDtcblx0XHRcdFx0dmFyIGZyYWdtZW50X2VuZF9hdDtcblx0XHRcdFx0dmFyIGZyYWdtZW50X3N0YXJ0O1xuXHRcdFx0XHR2YXIgZnJhZ21lbnRfZW5kO1xuXG5cdFx0XHRcdGlmICggdW5kZWZpbmVkID09PSBmcmFnbWVudF9lbmRfZXBvY2ggKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZyYWdtZW50X3N0YXJ0X2F0ID0gcmVzb2x2ZV9ib3VuZGFyeV90aW1lc3RhbXAoIGZyYWdtZW50X3N0YXJ0X2Vwb2NoLCAnc3RhcnQnLCBpbnRlcnZhbCwgZGF0ZV9iYW5kICk7XG5cdFx0XHRcdGZyYWdtZW50X2VuZF9hdCA9IHJlc29sdmVfYm91bmRhcnlfdGltZXN0YW1wKCBmcmFnbWVudF9lbmRfZXBvY2gsICdlbmQnLCBpbnRlcnZhbCwgZGF0ZV9iYW5kICk7XG5cdFx0XHRcdGZyYWdtZW50X3N0YXJ0ID0gcGFyc2VfZXhhY3RfdGltZXN0YW1wKCBmcmFnbWVudF9zdGFydF9hdCApO1xuXHRcdFx0XHRmcmFnbWVudF9lbmQgPSBwYXJzZV9leGFjdF90aW1lc3RhbXAoIGZyYWdtZW50X2VuZF9hdCApO1xuXHRcdFx0XHRpZiAoICEgZnJhZ21lbnRfc3RhcnQgfHwgISBmcmFnbWVudF9lbmQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZyYWdtZW50cy5wdXNoKCB7XG5cdFx0XHRcdFx0ZGF0ZTogZGF0ZV9iYW5kLmRhdGUsXG5cdFx0XHRcdFx0c3RhcnRfYXQ6IGZyYWdtZW50X3N0YXJ0X2F0LFxuXHRcdFx0XHRcdGVuZF9hdDogZnJhZ21lbnRfZW5kX2F0LFxuXHRcdFx0XHRcdHN0YXJ0X2Vwb2NoOiBmcmFnbWVudF9zdGFydF9lcG9jaCxcblx0XHRcdFx0XHRlbmRfZXBvY2g6IGZyYWdtZW50X2VuZF9lcG9jaCxcblx0XHRcdFx0XHR3YWxsX3N0YXJ0X21pbnV0ZTogZnJhZ21lbnRfc3RhcnRfZXBvY2ggPT09IGRhdGVfYmFuZC5zdGFydF9lcG9jaCA/IDAgOiBmcmFnbWVudF9zdGFydC53YWxsX21pbnV0ZSxcblx0XHRcdFx0XHR3YWxsX2VuZF9taW51dGU6IGZyYWdtZW50X2VuZF9lcG9jaCA9PT0gZGF0ZV9iYW5kLmVuZF9lcG9jaCA/IG1pbnV0ZXNfcGVyX2RheSA6IGZyYWdtZW50X2VuZC53YWxsX21pbnV0ZSxcblx0XHRcdFx0XHRzdGFydF9vZmZzZXRfbWludXRlczogZnJhZ21lbnRfc3RhcnQub2Zmc2V0X21pbnV0ZXMsXG5cdFx0XHRcdFx0ZW5kX29mZnNldF9taW51dGVzOiBmcmFnbWVudF9lbmQub2Zmc2V0X21pbnV0ZXMsXG5cdFx0XHRcdFx0Y29udGludWVzX2JlZm9yZV9kYXRlOiBzdGFydC5lcG9jaCA8IGRhdGVfYmFuZC5zdGFydF9lcG9jaCxcblx0XHRcdFx0XHRjb250aW51ZXNfYWZ0ZXJfZGF0ZTogZW5kLmVwb2NoID4gZGF0ZV9iYW5kLmVuZF9lcG9jaCxcblx0XHRcdFx0XHRjb250aW51ZXNfYmVmb3JlX2ZyYWdtZW50OiBmcmFnbWVudF9zdGFydF9lcG9jaCA+IHZpc2libGVfc3RhcnQsXG5cdFx0XHRcdFx0Y29udGludWVzX2FmdGVyX2ZyYWdtZW50OiBmcmFnbWVudF9lbmRfZXBvY2ggPCB2aXNpYmxlX2VuZCxcblx0XHRcdFx0XHR0cmFuc2l0aW9uX2JlZm9yZV9pZDogZnJhZ21lbnRfc3RhcnRfZXBvY2ggPiB2aXNpYmxlX3N0YXJ0ID8gKCBkYXRlX2JhbmQudHJhbnNpdGlvbnMuZmlsdGVyKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7IHJldHVybiB0cmFuc2l0aW9uLmVwb2NoID09PSBmcmFnbWVudF9zdGFydF9lcG9jaDsgfSApWyAwIF0gfHwge30gKS50cmFuc2l0aW9uX2lkIHx8ICcnIDogJycsXG5cdFx0XHRcdFx0dHJhbnNpdGlvbl9hZnRlcl9pZDogZnJhZ21lbnRfZW5kX2Vwb2NoIDwgdmlzaWJsZV9lbmQgPyAoIGRhdGVfYmFuZC50cmFuc2l0aW9ucy5maWx0ZXIoIGZ1bmN0aW9uICggdHJhbnNpdGlvbiApIHsgcmV0dXJuIHRyYW5zaXRpb24uZXBvY2ggPT09IGZyYWdtZW50X2VuZF9lcG9jaDsgfSApWyAwIF0gfHwge30gKS50cmFuc2l0aW9uX2lkIHx8ICcnIDogJydcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdH0gKTtcblx0XHRyZXR1cm4gZnJhZ21lbnRzO1xuXHR9XG5cblx0LyoqXG5cdCAqIERldGVybWluZSB0aGUgcmVzb2x2ZWQgdmVydGljYWwgcmFuZ2UuXG5cdCAqXG5cdCAqIEF1dG8gYmVnaW5zIHdpdGggZXhhY3QgV29ya2luZyBUaW1lIHdoZW4gaXRzIHVuYXZhaWxhYmxlIG91dHNpZGUtcmFuZ2VzIGNhblxuXHQgKiBiZSBpbnZlcnRlZCBzYWZlbHk7IG90aGVyd2lzZSBpdCB1c2VzIHRoZSBjb25maWd1cmVkIHNhZmUgcmFuZ2UuIFRpbWVkXG5cdCAqIGJvb2tpbmdzIGFuZCBib29raW5nL0FwcG9pbnRtZW50IGJ1ZmZlcnMgZXhwYW5kIHRoZSByYW5nZS4gT3RoZXIgYWNjZXB0ZWRcblx0ICogQXZhaWxhYmlsaXR5IHJlbWFpbnMgaW4gc3VtbWFyaWVzIGFuZCByZWNlaXZlcyBleHBsaWNpdCBjbGlwcGluZyBmbGFncy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJhbmdlX3BvbGljeSBSZXF1ZXN0ZWQgQXV0byBvciBGdWxsIGRheSBwb2xpY3kuXG5cdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gdGltZWRfYm9va2luZ19mcmFnbWVudHMgVW5jbGlwcGVkIGJvb2tpbmcgZnJhZ21lbnRzLlxuXHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IGF2YWlsYWJpbGl0eV9mcmFnbWVudHMgVW5jbGlwcGVkIEF2YWlsYWJpbGl0eSBmcmFnbWVudHMuXG5cdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gY292ZXJhZ2UgQXZhaWxhYmlsaXR5IGNvdmVyYWdlIHJlY29yZHMuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gUmVzb2x2ZWQgcHJlc2VudGF0aW9uIHJhbmdlLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzb2x2ZV92ZXJ0aWNhbF9yYW5nZSggcmFuZ2VfcG9saWN5LCB0aW1lZF9ib29raW5nX2ZyYWdtZW50cywgYXZhaWxhYmlsaXR5X2ZyYWdtZW50cywgY292ZXJhZ2UgKSB7XG5cdFx0dmFyIHJlcXVlc3RlZF9tb2RlID0gU3RyaW5nKCByYW5nZV9wb2xpY3kgJiYgcmFuZ2VfcG9saWN5Lm1vZGUgKTtcblx0XHR2YXIgbW9kZSA9IC0xICE9PSBbICdhdXRvJywgJ2N1c3RvbScsICdmdWxsX2RheScgXS5pbmRleE9mKCByZXF1ZXN0ZWRfbW9kZSApID8gcmVxdWVzdGVkX21vZGUgOiAnYXV0byc7XG5cdFx0dmFyIHN0YXJ0X21pbnV0ZSA9IGJvdW5kZWRfaW50ZWdlciggcmFuZ2VfcG9saWN5ICYmIHJhbmdlX3BvbGljeS5zYWZlX3N0YXJ0X21pbnV0ZSwgMCwgbWludXRlc19wZXJfZGF5IC0gNjAsIDQ4MCApO1xuXHRcdHZhciBlbmRfbWludXRlID0gYm91bmRlZF9pbnRlZ2VyKCByYW5nZV9wb2xpY3kgJiYgcmFuZ2VfcG9saWN5LnNhZmVfZW5kX21pbnV0ZSwgc3RhcnRfbWludXRlICsgNjAsIG1pbnV0ZXNfcGVyX2RheSwgMTA4MCApO1xuXHRcdHZhciB3b3JraW5nX3RpbWVfZXhhY3QgPSBjb3ZlcmFnZS5zb21lKCBmdW5jdGlvbiAoIGNvdmVyYWdlX3JlY29yZCApIHtcblx0XHRcdHJldHVybiAnd29ya2luZ190aW1lJyA9PT0gY292ZXJhZ2VfcmVjb3JkLnNvdXJjZSAmJiAnZXhhY3QnID09PSBjb3ZlcmFnZV9yZWNvcmQuc3RhdGU7XG5cdFx0fSApO1xuXHRcdHZhciB3b3JraW5nX2ZyYWdtZW50cyA9IGF2YWlsYWJpbGl0eV9mcmFnbWVudHMuZmlsdGVyKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkge1xuXHRcdFx0cmV0dXJuICd3b3JraW5nX3RpbWUnID09PSBmcmFnbWVudC5zb3VyY2U7XG5cdFx0fSApO1xuXG5cdFx0aWYgKCAnZnVsbF9kYXknID09PSBtb2RlICkge1xuXHRcdFx0cmV0dXJuIHsgbW9kZTogbW9kZSwgc3RhcnRfbWludXRlOiAwLCBlbmRfbWludXRlOiBtaW51dGVzX3Blcl9kYXksIHNwYW5fbWludXRlczogbWludXRlc19wZXJfZGF5IH07XG5cdFx0fVxuXHRcdGlmICggJ2N1c3RvbScgPT09IG1vZGUgKSB7XG5cdFx0XHRzdGFydF9taW51dGUgPSBib3VuZGVkX2ludGVnZXIoIHJhbmdlX3BvbGljeSAmJiByYW5nZV9wb2xpY3kuc3RhcnRfbWludXRlLCAwLCBtaW51dGVzX3Blcl9kYXkgLSA2MCwgMCApO1xuXHRcdFx0ZW5kX21pbnV0ZSA9IGJvdW5kZWRfaW50ZWdlciggcmFuZ2VfcG9saWN5ICYmIHJhbmdlX3BvbGljeS5lbmRfbWludXRlLCBzdGFydF9taW51dGUgKyA2MCwgbWludXRlc19wZXJfZGF5LCBtaW51dGVzX3Blcl9kYXkgKTtcblxuXHRcdFx0cmV0dXJuIHsgbW9kZTogbW9kZSwgc3RhcnRfbWludXRlOiBzdGFydF9taW51dGUsIGVuZF9taW51dGU6IGVuZF9taW51dGUsIHNwYW5fbWludXRlczogZW5kX21pbnV0ZSAtIHN0YXJ0X21pbnV0ZSB9O1xuXHRcdH1cblx0XHRpZiAoIHdvcmtpbmdfdGltZV9leGFjdCAmJiB3b3JraW5nX2ZyYWdtZW50cy5sZW5ndGggKSB7XG5cdFx0XHR3b3JraW5nX2ZyYWdtZW50cy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkge1xuXHRcdFx0XHRpZiAoIDAgPT09IGZyYWdtZW50LndhbGxfc3RhcnRfbWludXRlICkge1xuXHRcdFx0XHRcdHN0YXJ0X21pbnV0ZSA9IE1hdGgubWF4KCBzdGFydF9taW51dGUsIGZyYWdtZW50LndhbGxfZW5kX21pbnV0ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggbWludXRlc19wZXJfZGF5ID09PSBmcmFnbWVudC53YWxsX2VuZF9taW51dGUgKSB7XG5cdFx0XHRcdFx0ZW5kX21pbnV0ZSA9IE1hdGgubWluKCBlbmRfbWludXRlLCBmcmFnbWVudC53YWxsX3N0YXJ0X21pbnV0ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXHRcdHRpbWVkX2Jvb2tpbmdfZnJhZ21lbnRzLmNvbmNhdCggYXZhaWxhYmlsaXR5X2ZyYWdtZW50cy5maWx0ZXIoIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRyZXR1cm4gJ2Jvb2tpbmdfYnVmZmVyJyA9PT0gZnJhZ21lbnQuc291cmNlIHx8ICdhcHBvaW50bWVudF9idWZmZXInID09PSBmcmFnbWVudC5zb3VyY2U7XG5cdFx0fSApICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdHN0YXJ0X21pbnV0ZSA9IE1hdGgubWluKCBzdGFydF9taW51dGUsIE1hdGguZmxvb3IoIGZyYWdtZW50LndhbGxfc3RhcnRfbWludXRlIC8gNjAgKSAqIDYwICk7XG5cdFx0XHRlbmRfbWludXRlID0gTWF0aC5tYXgoIGVuZF9taW51dGUsIE1hdGguY2VpbCggZnJhZ21lbnQud2FsbF9lbmRfbWludXRlIC8gNjAgKSAqIDYwICk7XG5cdFx0fSApO1xuXHRcdHN0YXJ0X21pbnV0ZSA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggbWludXRlc19wZXJfZGF5IC0gNjAsIE1hdGguZmxvb3IoIHN0YXJ0X21pbnV0ZSAvIDYwICkgKiA2MCApICk7XG5cdFx0ZW5kX21pbnV0ZSA9IE1hdGgubWF4KCBzdGFydF9taW51dGUgKyA2MCwgTWF0aC5taW4oIG1pbnV0ZXNfcGVyX2RheSwgTWF0aC5jZWlsKCBlbmRfbWludXRlIC8gNjAgKSAqIDYwICkgKTtcblxuXHRcdHJldHVybiB7IG1vZGU6IG1vZGUsIHN0YXJ0X21pbnV0ZTogc3RhcnRfbWludXRlLCBlbmRfbWludXRlOiBlbmRfbWludXRlLCBzcGFuX21pbnV0ZXM6IGVuZF9taW51dGUgLSBzdGFydF9taW51dGUgfTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBseSB2ZXJ0aWNhbCBjbGlwcGluZyBhbmQgcGVyY2VudGFnZSBnZW9tZXRyeSB0byBvbmUgd2FsbC10aW1lIGZyYWdtZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZnJhZ21lbnQgVW5jbGlwcGVkIHdhbGwtdGltZSBmcmFnbWVudC5cblx0ICogQHBhcmFtIHtPYmplY3R9IHJhbmdlIFJlc29sdmVkIHZlcnRpY2FsIHJhbmdlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEZyYWdtZW50IHdpdGggY2xpcHBpbmcgYW5kIHZlcnRpY2FsIGdlb21ldHJ5LlxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwbHlfdmVydGljYWxfcmFuZ2UoIGZyYWdtZW50LCByYW5nZSApIHtcblx0XHR2YXIgdmlzaWJsZV9zdGFydCA9IE1hdGgubWF4KCByYW5nZS5zdGFydF9taW51dGUsIGZyYWdtZW50LndhbGxfc3RhcnRfbWludXRlICk7XG5cdFx0dmFyIHZpc2libGVfZW5kID0gTWF0aC5taW4oIHJhbmdlLmVuZF9taW51dGUsIGZyYWdtZW50LndhbGxfZW5kX21pbnV0ZSApO1xuXHRcdHZhciBpc19vdXRzaWRlID0gdmlzaWJsZV9lbmQgPD0gdmlzaWJsZV9zdGFydDtcblx0XHR2YXIgc3BhbiA9IE1hdGgubWF4KCAxLCByYW5nZS5zcGFuX21pbnV0ZXMgKTtcblxuXHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgZnJhZ21lbnQsIHtcblx0XHRcdGlzX2NsaXBwZWRfYWJvdmU6IGZyYWdtZW50LndhbGxfc3RhcnRfbWludXRlIDwgcmFuZ2Uuc3RhcnRfbWludXRlLFxuXHRcdFx0aXNfY2xpcHBlZF9iZWxvdzogZnJhZ21lbnQud2FsbF9lbmRfbWludXRlID4gcmFuZ2UuZW5kX21pbnV0ZSxcblx0XHRcdGlzX291dHNpZGVfcmFuZ2U6IGlzX291dHNpZGUsXG5cdFx0XHR2aXNpYmxlX3dhbGxfc3RhcnRfbWludXRlOiBpc19vdXRzaWRlID8gbnVsbCA6IHZpc2libGVfc3RhcnQsXG5cdFx0XHR2aXNpYmxlX3dhbGxfZW5kX21pbnV0ZTogaXNfb3V0c2lkZSA/IG51bGwgOiB2aXNpYmxlX2VuZCxcblx0XHRcdHRvcF9wZXJjZW50OiBpc19vdXRzaWRlID8gbnVsbCA6IE51bWJlciggKCAxMDAgKiAoIHZpc2libGVfc3RhcnQgLSByYW5nZS5zdGFydF9taW51dGUgKSAvIHNwYW4gKS50b0ZpeGVkKCA4ICkgKSxcblx0XHRcdGhlaWdodF9wZXJjZW50OiBpc19vdXRzaWRlID8gbnVsbCA6IE51bWJlciggKCAxMDAgKiAoIHZpc2libGVfZW5kIC0gdmlzaWJsZV9zdGFydCApIC8gc3BhbiApLnRvRml4ZWQoIDggKSApXG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1hcCBhY2NlcHRlZCBib29raW5nIHNlZ21lbnRzIGludG8gZnVsbC1kYXkgYW5kIHRpbWVkIGZyYWdtZW50cy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBzZWdtZW50cyBFeGFjdCBhdXRob3JpemVkIGJvb2tpbmcgc2VnbWVudHMuXG5cdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gZGF0ZV9iYW5kcyBBY2NlcHRlZCBkYXRlIGJhbmRzLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEZ1bGwtZGF5IGFuZCB0aW1lZCBmcmFnbWVudHMgYmVmb3JlIHJhbmdlIGFuZCBsYW5lIHdvcmsuXG5cdCAqL1xuXHRmdW5jdGlvbiBwcm9qZWN0X2Jvb2tpbmdfZnJhZ21lbnRzKCBzZWdtZW50cywgZGF0ZV9iYW5kcyApIHtcblx0XHR2YXIgZnVsbF9kYXlfZnJhZ21lbnRzID0gW107XG5cdFx0dmFyIHRpbWVkX2ZyYWdtZW50cyA9IFtdO1xuXHRcdHZhciBsb2FkZWRfc3RhcnQgPSBkYXRlX2JhbmRzLmxlbmd0aCA/IGRhdGVfYmFuZHNbIDAgXS5zdGFydF9lcG9jaCA6IDA7XG5cdFx0dmFyIGxvYWRlZF9lbmQgPSBkYXRlX2JhbmRzLmxlbmd0aCA/IGRhdGVfYmFuZHNbIGRhdGVfYmFuZHMubGVuZ3RoIC0gMSBdLmVuZF9lcG9jaCA6IDA7XG5cblx0XHRzZWdtZW50cy5mb3JFYWNoKCBmdW5jdGlvbiAoIHNlZ21lbnQgKSB7XG5cdFx0XHR2YXIgc291cmNlX3N0YXJ0ID0gcGFyc2VfZXhhY3RfdGltZXN0YW1wKCBzZWdtZW50LnN0YXJ0ICk7XG5cdFx0XHR2YXIgc291cmNlX2VuZCA9IHBhcnNlX2V4YWN0X3RpbWVzdGFtcCggc2VnbWVudC5lbmQgKTtcblx0XHRcdHZhciBzcGxpdF9mcmFnbWVudHMgPSBzcGxpdF9leGFjdF9pbnRlcnZhbCggc2VnbWVudCwgJ3N0YXJ0JywgJ2VuZCcsIGRhdGVfYmFuZHMgKTtcblxuXHRcdFx0aWYgKCBzZWdtZW50LmlzX2Z1bGxfZGF5ICkge1xuXHRcdFx0XHRzcGxpdF9mcmFnbWVudHMgPSBzcGxpdF9mcmFnbWVudHMucmVkdWNlKCBmdW5jdGlvbiAoIGZyYWdtZW50c19ieV9kYXRlLCBmcmFnbWVudCApIHtcblx0XHRcdFx0XHR2YXIgcHJldmlvdXMgPSBmcmFnbWVudHNfYnlfZGF0ZVsgZnJhZ21lbnRzX2J5X2RhdGUubGVuZ3RoIC0gMSBdO1xuXG5cdFx0XHRcdFx0aWYgKCBwcmV2aW91cyAmJiBwcmV2aW91cy5kYXRlID09PSBmcmFnbWVudC5kYXRlICkge1xuXHRcdFx0XHRcdFx0cHJldmlvdXMuZW5kX2F0ID0gZnJhZ21lbnQuZW5kX2F0O1xuXHRcdFx0XHRcdFx0cHJldmlvdXMuZW5kX2Vwb2NoID0gZnJhZ21lbnQuZW5kX2Vwb2NoO1xuXHRcdFx0XHRcdFx0cHJldmlvdXMud2FsbF9lbmRfbWludXRlID0gZnJhZ21lbnQud2FsbF9lbmRfbWludXRlO1xuXHRcdFx0XHRcdFx0cHJldmlvdXMuZW5kX29mZnNldF9taW51dGVzID0gZnJhZ21lbnQuZW5kX29mZnNldF9taW51dGVzO1xuXHRcdFx0XHRcdFx0cHJldmlvdXMuY29udGludWVzX2FmdGVyX2RhdGUgPSBmcmFnbWVudC5jb250aW51ZXNfYWZ0ZXJfZGF0ZTtcblx0XHRcdFx0XHRcdHByZXZpb3VzLnRyYW5zaXRpb25fYWZ0ZXJfaWQgPSBmcmFnbWVudC50cmFuc2l0aW9uX2FmdGVyX2lkO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZyYWdtZW50c19ieV9kYXRlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmcmFnbWVudHNfYnlfZGF0ZS5wdXNoKCBPYmplY3QuYXNzaWduKCB7fSwgZnJhZ21lbnQgKSApO1xuXHRcdFx0XHRcdHJldHVybiBmcmFnbWVudHNfYnlfZGF0ZTtcblx0XHRcdFx0fSwgW10gKTtcblx0XHRcdH1cblxuXHRcdFx0c3BsaXRfZnJhZ21lbnRzLmZvckVhY2goIGZ1bmN0aW9uICggZnJhZ21lbnQsIGluZGV4ICkge1xuXHRcdFx0XHR2YXIgY29tbW9uID0ge1xuXHRcdFx0XHRcdGZyYWdtZW50X2lkOiBbIFN0cmluZyggc2VnbWVudC5zZWdtZW50X2lkICksIGZyYWdtZW50LmRhdGUsIGZyYWdtZW50LnN0YXJ0X2Vwb2NoLCBmcmFnbWVudC5lbmRfZXBvY2ggXS5qb2luKCAnfCcgKSxcblx0XHRcdFx0XHRzb3VyY2Vfc2VnbWVudF9pZDogU3RyaW5nKCBzZWdtZW50LnNlZ21lbnRfaWQgfHwgJycgKSxcblx0XHRcdFx0XHRzZXJpZXNfa2V5OiBTdHJpbmcoIHNlZ21lbnQuc2VyaWVzX2tleSB8fCAnJyApLFxuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IE51bWJlciggc2VnbWVudC5ib29raW5nX2lkIHx8IDAgKSxcblx0XHRcdFx0XHRyZXNvdXJjZV9pZDogTnVtYmVyKCBzZWdtZW50LnJlc291cmNlX2lkIHx8IDAgKSxcblx0XHRcdFx0XHRkYXRlOiBmcmFnbWVudC5kYXRlLFxuXHRcdFx0XHRcdHN0YXJ0X2F0OiBmcmFnbWVudC5zdGFydF9hdCxcblx0XHRcdFx0XHRlbmRfYXQ6IGZyYWdtZW50LmVuZF9hdCxcblx0XHRcdFx0XHRzdGFydF9lcG9jaDogZnJhZ21lbnQuc3RhcnRfZXBvY2gsXG5cdFx0XHRcdFx0ZW5kX2Vwb2NoOiBmcmFnbWVudC5lbmRfZXBvY2gsXG5cdFx0XHRcdFx0c3RhdHVzOiBTdHJpbmcoIHNlZ21lbnQuc3RhdHVzIHx8ICcnICksXG5cdFx0XHRcdFx0bGFiZWw6IFN0cmluZyggc2VnbWVudC5sYWJlbCB8fCAnJyApLFxuXHRcdFx0XHRcdGluaXRpYWxzOiBTdHJpbmcoIHNlZ21lbnQuaW5pdGlhbHMgfHwgJycgKSxcblx0XHRcdFx0XHRzY2hlZHVsZV9sYWJlbDogU3RyaW5nKCBzZWdtZW50LnNjaGVkdWxlX2xhYmVsIHx8ICcnICksXG5cdFx0XHRcdFx0c2VsZWN0aW9uX2FyaWFfbGFiZWw6IFN0cmluZyggc2VnbWVudC5zZWxlY3Rpb25fYXJpYV9sYWJlbCB8fCBzZWdtZW50LmFyaWFfbGFiZWwgfHwgJycgKSxcblx0XHRcdFx0XHRpbmZvcm1hdGlvbl9hcmlhX2xhYmVsOiBTdHJpbmcoIHNlZ21lbnQuaW5mb3JtYXRpb25fYXJpYV9sYWJlbCB8fCAnJyApLFxuXHRcdFx0XHRcdGNvbnRpbnVlc19iZWZvcmVfZGF0ZTogZnJhZ21lbnQuY29udGludWVzX2JlZm9yZV9kYXRlLFxuXHRcdFx0XHRcdGNvbnRpbnVlc19hZnRlcl9kYXRlOiBmcmFnbWVudC5jb250aW51ZXNfYWZ0ZXJfZGF0ZSxcblx0XHRcdFx0XHRjb250aW51ZXNfYmVmb3JlX2xvYWRlZF93aW5kb3c6IEJvb2xlYW4oIHNvdXJjZV9zdGFydCAmJiBzb3VyY2Vfc3RhcnQuZXBvY2ggPCBsb2FkZWRfc3RhcnQgKSB8fCBCb29sZWFuKCBzZWdtZW50LmlzX2NsaXBwZWRfc3RhcnQgJiYgMCA9PT0gaW5kZXggKSxcblx0XHRcdFx0XHRjb250aW51ZXNfYWZ0ZXJfbG9hZGVkX3dpbmRvdzogQm9vbGVhbiggc291cmNlX2VuZCAmJiBzb3VyY2VfZW5kLmVwb2NoID4gbG9hZGVkX2VuZCApIHx8IEJvb2xlYW4oIHNlZ21lbnQuaXNfY2xpcHBlZF9lbmQgJiYgaW5kZXggPT09IHNwbGl0X2ZyYWdtZW50cy5sZW5ndGggLSAxIClcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZiAoIHNlZ21lbnQuaXNfZnVsbF9kYXkgKSB7XG5cdFx0XHRcdFx0ZnVsbF9kYXlfZnJhZ21lbnRzLnB1c2goIGNvbW1vbiApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aW1lZF9mcmFnbWVudHMucHVzaCggT2JqZWN0LmFzc2lnbiggY29tbW9uLCBmcmFnbWVudCwge1xuXHRcdFx0XHRcdG9jY3VycmVuY2VfaWQ6IFsgZnJhZ21lbnQuZGF0ZSwgZnJhZ21lbnQud2FsbF9zdGFydF9taW51dGUsIGZyYWdtZW50LnN0YXJ0X29mZnNldF9taW51dGVzLCBmcmFnbWVudC5zdGFydF9lcG9jaCBdLmpvaW4oICd8JyApXG5cdFx0XHRcdH0gKSApO1xuXHRcdFx0fSApO1xuXHRcdH0gKTtcblx0XHRyZXR1cm4geyBmdWxsX2RheV9mcmFnbWVudHM6IGZ1bGxfZGF5X2ZyYWdtZW50cywgdGltZWRfZnJhZ21lbnRzOiB0aW1lZF9mcmFnbWVudHMgfTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBc3NpZ24gZGV0ZXJtaW5pc3RpYyBmdWxsLWRheSBzdGFjayBpbmRleGVzIHBlciBkYXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IGZ1bGxfZGF5X2ZyYWdtZW50cyBGdWxsLWRheSBib29raW5nIGZyYWdtZW50cy5cblx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gU29ydGVkIHN0YWNrIHJlY29yZHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBhc3NpZ25fZnVsbF9kYXlfc3RhY2tzKCBmdWxsX2RheV9mcmFnbWVudHMgKSB7XG5cdFx0dmFyIGdyb3Vwc19ieV9zZWdtZW50ID0gT2JqZWN0LmNyZWF0ZSggbnVsbCApO1xuXHRcdHZhciBsYW5lX2VuZF9lcG9jaHMgPSBbXTtcblx0XHR2YXIgZGF0ZV9zdGFja19jb3VudHMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cblx0XHRmdWxsX2RheV9mcmFnbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdHZhciBncm91cF9rZXkgPSBbIGZyYWdtZW50LnNvdXJjZV9zZWdtZW50X2lkLCBmcmFnbWVudC5ib29raW5nX2lkLCBmcmFnbWVudC5yZXNvdXJjZV9pZCBdLmpvaW4oICd8JyApO1xuXG5cdFx0XHRpZiAoICEgZ3JvdXBzX2J5X3NlZ21lbnRbIGdyb3VwX2tleSBdICkge1xuXHRcdFx0XHRncm91cHNfYnlfc2VnbWVudFsgZ3JvdXBfa2V5IF0gPSB7XG5cdFx0XHRcdFx0Z3JvdXBfa2V5OiBncm91cF9rZXksXG5cdFx0XHRcdFx0c291cmNlX3NlZ21lbnRfaWQ6IGZyYWdtZW50LnNvdXJjZV9zZWdtZW50X2lkLFxuXHRcdFx0XHRcdHN0YXJ0X2Vwb2NoOiBmcmFnbWVudC5zdGFydF9lcG9jaCxcblx0XHRcdFx0XHRlbmRfZXBvY2g6IGZyYWdtZW50LmVuZF9lcG9jaCxcblx0XHRcdFx0XHRmcmFnbWVudHM6IFtdXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRncm91cHNfYnlfc2VnbWVudFsgZ3JvdXBfa2V5IF0uc3RhcnRfZXBvY2ggPSBNYXRoLm1pbiggZ3JvdXBzX2J5X3NlZ21lbnRbIGdyb3VwX2tleSBdLnN0YXJ0X2Vwb2NoLCBmcmFnbWVudC5zdGFydF9lcG9jaCApO1xuXHRcdFx0Z3JvdXBzX2J5X3NlZ21lbnRbIGdyb3VwX2tleSBdLmVuZF9lcG9jaCA9IE1hdGgubWF4KCBncm91cHNfYnlfc2VnbWVudFsgZ3JvdXBfa2V5IF0uZW5kX2Vwb2NoLCBmcmFnbWVudC5lbmRfZXBvY2ggKTtcblx0XHRcdGdyb3Vwc19ieV9zZWdtZW50WyBncm91cF9rZXkgXS5mcmFnbWVudHMucHVzaCggZnJhZ21lbnQgKTtcblx0XHR9ICk7XG5cblx0XHRPYmplY3Qua2V5cyggZ3JvdXBzX2J5X3NlZ21lbnQgKS5tYXAoIGZ1bmN0aW9uICggZ3JvdXBfa2V5ICkge1xuXHRcdFx0cmV0dXJuIGdyb3Vwc19ieV9zZWdtZW50WyBncm91cF9rZXkgXTtcblx0XHR9ICkuc29ydCggZnVuY3Rpb24gKCBsZWZ0LCByaWdodCApIHtcblx0XHRcdHJldHVybiBsZWZ0LnN0YXJ0X2Vwb2NoIC0gcmlnaHQuc3RhcnRfZXBvY2hcblx0XHRcdFx0fHwgcmlnaHQuZW5kX2Vwb2NoIC0gbGVmdC5lbmRfZXBvY2hcblx0XHRcdFx0fHwgbGVmdC5zb3VyY2Vfc2VnbWVudF9pZC5sb2NhbGVDb21wYXJlKCByaWdodC5zb3VyY2Vfc2VnbWVudF9pZCApO1xuXHRcdH0gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGdyb3VwICkge1xuXHRcdFx0dmFyIGxhbmVfaW5kZXggPSBsYW5lX2VuZF9lcG9jaHMuZmluZEluZGV4KCBmdW5jdGlvbiAoIGxhbmVfZW5kX2Vwb2NoICkge1xuXHRcdFx0XHRyZXR1cm4gbGFuZV9lbmRfZXBvY2ggPD0gZ3JvdXAuc3RhcnRfZXBvY2g7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGlmICggLTEgPT09IGxhbmVfaW5kZXggKSB7XG5cdFx0XHRcdGxhbmVfaW5kZXggPSBsYW5lX2VuZF9lcG9jaHMubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0bGFuZV9lbmRfZXBvY2hzWyBsYW5lX2luZGV4IF0gPSBncm91cC5lbmRfZXBvY2g7XG5cdFx0XHRncm91cC5mcmFnbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdFx0ZnJhZ21lbnQuc3RhY2tfaW5kZXggPSBsYW5lX2luZGV4O1xuXHRcdFx0XHRkYXRlX3N0YWNrX2NvdW50c1sgZnJhZ21lbnQuZGF0ZSBdID0gTWF0aC5tYXgoIGRhdGVfc3RhY2tfY291bnRzWyBmcmFnbWVudC5kYXRlIF0gfHwgMCwgbGFuZV9pbmRleCArIDEgKTtcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gZnVsbF9kYXlfZnJhZ21lbnRzLnNvcnQoIGZ1bmN0aW9uICggbGVmdCwgcmlnaHQgKSB7XG5cdFx0XHRyZXR1cm4gbGVmdC5kYXRlLmxvY2FsZUNvbXBhcmUoIHJpZ2h0LmRhdGUgKSB8fCBsZWZ0LnN0YXJ0X2Vwb2NoIC0gcmlnaHQuc3RhcnRfZXBvY2ggfHwgbGVmdC5lbmRfZXBvY2ggLSByaWdodC5lbmRfZXBvY2ggfHwgbGVmdC5zb3VyY2Vfc2VnbWVudF9pZC5sb2NhbGVDb21wYXJlKCByaWdodC5zb3VyY2Vfc2VnbWVudF9pZCApO1xuXHRcdH0gKS5tYXAoIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbigge30sIGZyYWdtZW50LCB7IHN0YWNrX2NvdW50OiBkYXRlX3N0YWNrX2NvdW50c1sgZnJhZ21lbnQuZGF0ZSBdIH0gKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQXNzaWduIGRldGVybWluaXN0aWMgb3ZlcmxhcCBsYW5lcyBhbmQgY29uc3RydWN0IGJvdW5kZWQgb3ZlcmZsb3cgZ3JvdXBzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IHRpbWVkX2ZyYWdtZW50cyBSYW5nZS1wcm9qZWN0ZWQgdGltZWQgZnJhZ21lbnRzLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gdmlzaWJsZV9sYW5lX2xpbWl0IE1heGltdW0gZGlyZWN0bHkgdmlzaWJsZSBsYW5lcy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBMYW5lLWFzc2lnbmVkIGZyYWdtZW50cyBhbmQgb3ZlcmZsb3cgZ3JvdXBzLlxuXHQgKi9cblx0ZnVuY3Rpb24gYXNzaWduX3RpbWVkX2xhbmVzKCB0aW1lZF9mcmFnbWVudHMsIHZpc2libGVfbGFuZV9saW1pdCApIHtcblx0XHR2YXIgZGF0ZXMgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0dmFyIG92ZXJmbG93X2dyb3VwcyA9IFtdO1xuXG5cdFx0dGltZWRfZnJhZ21lbnRzLmZvckVhY2goIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRpZiAoICEgZGF0ZXNbIGZyYWdtZW50LmRhdGUgXSApIHtcblx0XHRcdFx0ZGF0ZXNbIGZyYWdtZW50LmRhdGUgXSA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0ZGF0ZXNbIGZyYWdtZW50LmRhdGUgXS5wdXNoKCBmcmFnbWVudCApO1xuXHRcdH0gKTtcblx0XHRPYmplY3Qua2V5cyggZGF0ZXMgKS5zb3J0KCkuZm9yRWFjaCggZnVuY3Rpb24gKCBkYXRlICkge1xuXHRcdFx0dmFyIGxhbmVfZW5kcyA9IFtdO1xuXHRcdFx0dmFyIGNsdXN0ZXJfZnJhZ21lbnRzID0gW107XG5cdFx0XHR2YXIgY2x1c3Rlcl9lbmQgPSAtMTtcblx0XHRcdHZhciBjbHVzdGVyX2luZGV4ID0gMDtcblx0XHRcdHZhciBmbHVzaF9jbHVzdGVyO1xuXG5cdFx0XHRmbHVzaF9jbHVzdGVyID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHR2YXIgaGlkZGVuID0gY2x1c3Rlcl9mcmFnbWVudHMuZmlsdGVyKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkgeyByZXR1cm4gZnJhZ21lbnQubGFuZV9pbmRleCA+PSB2aXNpYmxlX2xhbmVfbGltaXQ7IH0gKTtcblx0XHRcdFx0dmFyIGNsdXN0ZXJfbGFuZV9jb3VudCA9IE1hdGgubWluKCB2aXNpYmxlX2xhbmVfbGltaXQsIE1hdGgubWF4KCAxLCBsYW5lX2VuZHMubGVuZ3RoICkgKTtcblxuXHRcdFx0XHRjbHVzdGVyX2ZyYWdtZW50cy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkge1xuXHRcdFx0XHRcdGZyYWdtZW50LmxhbmVfY291bnQgPSBjbHVzdGVyX2xhbmVfY291bnQ7XG5cdFx0XHRcdH0gKTtcblxuXHRcdFx0XHRpZiAoIGhpZGRlbi5sZW5ndGggKSB7XG5cdFx0XHRcdFx0b3ZlcmZsb3dfZ3JvdXBzLnB1c2goIHtcblx0XHRcdFx0XHRcdG92ZXJmbG93X2lkOiAnb3ZlcmZsb3d8JyArIGRhdGUgKyAnfCcgKyBjbHVzdGVyX2luZGV4LFxuXHRcdFx0XHRcdFx0ZGF0ZTogZGF0ZSxcblx0XHRcdFx0XHRcdHN0YXJ0X3dhbGxfbWludXRlOiBNYXRoLm1pbi5hcHBseSggbnVsbCwgY2x1c3Rlcl9mcmFnbWVudHMubWFwKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkgeyByZXR1cm4gZnJhZ21lbnQudmlzaWJsZV93YWxsX3N0YXJ0X21pbnV0ZTsgfSApICksXG5cdFx0XHRcdFx0XHRlbmRfd2FsbF9taW51dGU6IE1hdGgubWF4LmFwcGx5KCBudWxsLCBjbHVzdGVyX2ZyYWdtZW50cy5tYXAoIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7IHJldHVybiBmcmFnbWVudC52aXNpYmxlX3dhbGxfZW5kX21pbnV0ZTsgfSApICksXG5cdFx0XHRcdFx0XHRoaWRkZW5fY291bnQ6IGhpZGRlbi5sZW5ndGgsXG5cdFx0XHRcdFx0XHRmcmFnbWVudF9pZHM6IGhpZGRlbi5tYXAoIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7IHJldHVybiBmcmFnbWVudC5mcmFnbWVudF9pZDsgfSApLFxuXHRcdFx0XHRcdFx0Ym9va2luZ19pZHM6IGhpZGRlbi5tYXAoIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7IHJldHVybiBmcmFnbWVudC5ib29raW5nX2lkOyB9ICksXG5cdFx0XHRcdFx0XHRsYWJlbDogJysnICsgaGlkZGVuLmxlbmd0aCArICcgbW9yZSdcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2x1c3Rlcl9mcmFnbWVudHMgPSBbXTtcblx0XHRcdFx0Y2x1c3Rlcl9lbmQgPSAtMTtcblx0XHRcdFx0Y2x1c3Rlcl9pbmRleCArPSAxO1xuXHRcdFx0fTtcblxuXHRcdFx0ZGF0ZXNbIGRhdGUgXS5zb3J0KCBmdW5jdGlvbiAoIGxlZnQsIHJpZ2h0ICkge1xuXHRcdFx0XHRyZXR1cm4gbGVmdC52aXNpYmxlX3dhbGxfc3RhcnRfbWludXRlIC0gcmlnaHQudmlzaWJsZV93YWxsX3N0YXJ0X21pbnV0ZVxuXHRcdFx0XHRcdHx8IGxlZnQuc3RhcnRfZXBvY2ggLSByaWdodC5zdGFydF9lcG9jaFxuXHRcdFx0XHRcdHx8IGxlZnQudmlzaWJsZV93YWxsX2VuZF9taW51dGUgLSByaWdodC52aXNpYmxlX3dhbGxfZW5kX21pbnV0ZVxuXHRcdFx0XHRcdHx8IGxlZnQuc291cmNlX3NlZ21lbnRfaWQubG9jYWxlQ29tcGFyZSggcmlnaHQuc291cmNlX3NlZ21lbnRfaWQgKTtcblx0XHRcdH0gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkge1xuXHRcdFx0XHR2YXIgbGFuZV9pbmRleCA9IC0xO1xuXHRcdFx0XHR2YXIgbGFuZV9jYW5kaWRhdGU7XG5cblx0XHRcdFx0Zm9yICggbGFuZV9jYW5kaWRhdGUgPSAwOyBsYW5lX2NhbmRpZGF0ZSA8IGxhbmVfZW5kcy5sZW5ndGg7IGxhbmVfY2FuZGlkYXRlKysgKSB7XG5cdFx0XHRcdFx0aWYgKCBsYW5lX2VuZHNbIGxhbmVfY2FuZGlkYXRlIF0gPD0gZnJhZ21lbnQudmlzaWJsZV93YWxsX3N0YXJ0X21pbnV0ZSApIHtcblx0XHRcdFx0XHRcdGxhbmVfaW5kZXggPSBsYW5lX2NhbmRpZGF0ZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICggY2x1c3Rlcl9mcmFnbWVudHMubGVuZ3RoICYmIGZyYWdtZW50LnZpc2libGVfd2FsbF9zdGFydF9taW51dGUgPj0gY2x1c3Rlcl9lbmQgKSB7XG5cdFx0XHRcdFx0Zmx1c2hfY2x1c3RlcigpO1xuXHRcdFx0XHRcdGxhbmVfZW5kcyA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggLTEgPT09IGxhbmVfaW5kZXggKSB7XG5cdFx0XHRcdFx0bGFuZV9pbmRleCA9IGxhbmVfZW5kcy5sZW5ndGg7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGFuZV9lbmRzWyBsYW5lX2luZGV4IF0gPSBmcmFnbWVudC52aXNpYmxlX3dhbGxfZW5kX21pbnV0ZTtcblx0XHRcdFx0ZnJhZ21lbnQubGFuZV9pbmRleCA9IGxhbmVfaW5kZXg7XG5cdFx0XHRcdGZyYWdtZW50LmlzX292ZXJmbG93ZWQgPSBsYW5lX2luZGV4ID49IHZpc2libGVfbGFuZV9saW1pdDtcblx0XHRcdFx0Y2x1c3Rlcl9mcmFnbWVudHMucHVzaCggZnJhZ21lbnQgKTtcblx0XHRcdFx0Y2x1c3Rlcl9lbmQgPSBNYXRoLm1heCggY2x1c3Rlcl9lbmQsIGZyYWdtZW50LnZpc2libGVfd2FsbF9lbmRfbWludXRlICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoIGNsdXN0ZXJfZnJhZ21lbnRzLmxlbmd0aCApIHtcblx0XHRcdFx0Zmx1c2hfY2x1c3RlcigpO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRmcmFnbWVudHM6IHRpbWVkX2ZyYWdtZW50cy5zb3J0KCBmdW5jdGlvbiAoIGxlZnQsIHJpZ2h0ICkge1xuXHRcdFx0XHRyZXR1cm4gbGVmdC5kYXRlLmxvY2FsZUNvbXBhcmUoIHJpZ2h0LmRhdGUgKSB8fCBsZWZ0LnZpc2libGVfd2FsbF9zdGFydF9taW51dGUgLSByaWdodC52aXNpYmxlX3dhbGxfc3RhcnRfbWludXRlIHx8IGxlZnQuc3RhcnRfZXBvY2ggLSByaWdodC5zdGFydF9lcG9jaCB8fCBsZWZ0LnNvdXJjZV9zZWdtZW50X2lkLmxvY2FsZUNvbXBhcmUoIHJpZ2h0LnNvdXJjZV9zZWdtZW50X2lkICk7XG5cdFx0XHR9ICksXG5cdFx0XHRvdmVyZmxvd19ncm91cHM6IG92ZXJmbG93X2dyb3Vwc1xuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogU3BsaXQgQXZhaWxhYmlsaXR5IGludGVydmFscyBpbnRvIGV4YWN0IGRhdGUvRFNUIGZyYWdtZW50cy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBpbnRlcnZhbHMgQWNjZXB0ZWQgQXZhaWxhYmlsaXR5IGludGVydmFscy5cblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBkYXRlX2JhbmRzIEFjY2VwdGVkIGRhdGUgYmFuZHMuXG5cdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IFVuY2xpcHBlZCBBdmFpbGFiaWxpdHkgZnJhZ21lbnRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gcHJvamVjdF9hdmFpbGFiaWxpdHlfZnJhZ21lbnRzKCBpbnRlcnZhbHMsIGRhdGVfYmFuZHMgKSB7XG5cdFx0dmFyIGZyYWdtZW50cyA9IFtdO1xuXG5cdFx0aW50ZXJ2YWxzLmZvckVhY2goIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRzcGxpdF9leGFjdF9pbnRlcnZhbCggaW50ZXJ2YWwsICdzdGFydF9hdCcsICdlbmRfYXQnLCBkYXRlX2JhbmRzICkuZm9yRWFjaCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdFx0ZnJhZ21lbnRzLnB1c2goIE9iamVjdC5hc3NpZ24oIHt9LCBmcmFnbWVudCwge1xuXHRcdFx0XHRcdGludGVydmFsX2lkOiBTdHJpbmcoIGludGVydmFsLmludGVydmFsX2lkIHx8ICcnICksXG5cdFx0XHRcdFx0c291cmNlOiBTdHJpbmcoIGludGVydmFsLnNvdXJjZSB8fCAnJyApLFxuXHRcdFx0XHRcdHNvdXJjZV9sYWJlbDogU3RyaW5nKCBpbnRlcnZhbC5zb3VyY2VfbGFiZWwgfHwgJycgKSxcblx0XHRcdFx0XHRyZWxhdGVkX3NlZ21lbnRfaWQ6IFN0cmluZyggaW50ZXJ2YWwucmVsYXRlZF9zZWdtZW50X2lkIHx8ICcnIClcblx0XHRcdFx0fSApICk7XG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXHRcdHJldHVybiBmcmFnbWVudHM7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBwcmVjZWRlbmNlIHJhbmsgZm9yIG9uZSBBdmFpbGFiaWxpdHkgc291cmNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc291cmNlIEF2YWlsYWJpbGl0eSBzb3VyY2UgSUQuXG5cdCAqIEByZXR1cm4ge251bWJlcn0gTG93ZXIgdmFsdWVzIHdpbi5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9hdmFpbGFiaWxpdHlfcmFuayggc291cmNlICkge1xuXHRcdHZhciBpbmRleCA9IGF2YWlsYWJpbGl0eV9wcmVjZWRlbmNlLmluZGV4T2YoIHNvdXJjZSApO1xuXHRcdHJldHVybiAtMSA9PT0gaW5kZXggPyBhdmFpbGFiaWxpdHlfcHJlY2VkZW5jZS5sZW5ndGggOiBpbmRleDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb21iaW5lIEF2YWlsYWJpbGl0eSBmcmFnbWVudHMgaW50byBub24tb3ZlcmxhcHBpbmcgdmlzdWFsIHNsaWNlcy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBmcmFnbWVudHMgRXhhY3QgQXZhaWxhYmlsaXR5IGZyYWdtZW50cy5cblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBkYXRlX2JhbmRzIEFjY2VwdGVkIGRhdGUgYmFuZHMuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByYW5nZSBSZXNvbHZlZCB2ZXJ0aWNhbCByYW5nZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGF2YWlsYWJpbGl0eV9zdGF0ZSBMb2FkZWQsIHBhcnRpYWwsIGZhaWxlZCwgb3IgbG9hZGluZy5cblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSB1bmtub3duX3JlY29yZHMgU291cmNlLXNwZWNpZmljIHVua25vd24gY292ZXJhZ2UuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2VfZGVmaW5pdGlvbnMgQXV0aG9yaXplZCBzb3VyY2UgZGVmaW5pdGlvbnMga2V5ZWQgYnkgSUQuXG5cdCAqIEByZXR1cm4ge0FycmF5PE9iamVjdD59IERldGVybWluaXN0aWMgcHJlY2VkZW5jZS1jb21iaW5lZCBzbGljZXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBjb21iaW5lX2F2YWlsYWJpbGl0eV9zbGljZXMoIGZyYWdtZW50cywgZGF0ZV9iYW5kcywgcmFuZ2UsIGF2YWlsYWJpbGl0eV9zdGF0ZSwgdW5rbm93bl9yZWNvcmRzLCBzb3VyY2VfZGVmaW5pdGlvbnMgKSB7XG5cdFx0dmFyIHNsaWNlcyA9IFtdO1xuXHRcdHZhciBoYXNfZ2xvYmFsX3Vua25vd24gPSAnbG9hZGluZycgPT09IGF2YWlsYWJpbGl0eV9zdGF0ZSB8fCAnZmFpbGVkJyA9PT0gYXZhaWxhYmlsaXR5X3N0YXRlO1xuXHRcdHZhciBmcmFnbWVudHNfYnlfZGF0ZSA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcblxuXHRcdGZyYWdtZW50cy5mb3JFYWNoKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkge1xuXHRcdFx0aWYgKCAhIGZyYWdtZW50c19ieV9kYXRlWyBmcmFnbWVudC5kYXRlIF0gKSB7XG5cdFx0XHRcdGZyYWdtZW50c19ieV9kYXRlWyBmcmFnbWVudC5kYXRlIF0gPSBbXTtcblx0XHRcdH1cblx0XHRcdGZyYWdtZW50c19ieV9kYXRlWyBmcmFnbWVudC5kYXRlIF0ucHVzaCggZnJhZ21lbnQgKTtcblx0XHR9ICk7XG5cblx0XHRkYXRlX2JhbmRzLmZvckVhY2goIGZ1bmN0aW9uICggZGF0ZV9iYW5kICkge1xuXHRcdFx0dmFyIGRhdGVfZnJhZ21lbnRzID0gZnJhZ21lbnRzX2J5X2RhdGVbIGRhdGVfYmFuZC5kYXRlIF0gfHwgW107XG5cdFx0XHR2YXIgYm91bmRhcmllcyA9IFsgcmFuZ2Uuc3RhcnRfbWludXRlLCByYW5nZS5lbmRfbWludXRlIF07XG5cdFx0XHR2YXIgYm91bmRhcmllc19ieV9taW51dGUgPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdFx0XHR2YXIgdW5rbm93bl9zb3VyY2VfaWRzID0gdW5rbm93bl9yZWNvcmRzLm1hcCggZnVuY3Rpb24gKCByZWNvcmQgKSB7XG5cdFx0XHRcdHJldHVybiBTdHJpbmcoIHJlY29yZC5zb3VyY2UgfHwgJ3Vua25vd24nICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR2YXIgdW5rbm93bl9zb3VyY2VzID0gaGFzX2dsb2JhbF91bmtub3duIHx8IHVua25vd25fc291cmNlX2lkcy5sZW5ndGggPyBbICd1bmtub3duJyBdLmNvbmNhdCggdW5rbm93bl9zb3VyY2VfaWRzICkgOiBbXTtcblxuXHRcdFx0ZGF0ZV9mcmFnbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdFx0Ym91bmRhcmllcy5wdXNoKCBNYXRoLm1heCggcmFuZ2Uuc3RhcnRfbWludXRlLCBNYXRoLm1pbiggcmFuZ2UuZW5kX21pbnV0ZSwgZnJhZ21lbnQud2FsbF9zdGFydF9taW51dGUgKSApICk7XG5cdFx0XHRcdGJvdW5kYXJpZXMucHVzaCggTWF0aC5tYXgoIHJhbmdlLnN0YXJ0X21pbnV0ZSwgTWF0aC5taW4oIHJhbmdlLmVuZF9taW51dGUsIGZyYWdtZW50LndhbGxfZW5kX21pbnV0ZSApICkgKTtcblx0XHRcdH0gKTtcblx0XHRcdGJvdW5kYXJpZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBib3VuZGFyeSApIHtcblx0XHRcdFx0Ym91bmRhcmllc19ieV9taW51dGVbIFN0cmluZyggYm91bmRhcnkgKSBdID0gYm91bmRhcnk7XG5cdFx0XHR9ICk7XG5cdFx0XHRib3VuZGFyaWVzID0gT2JqZWN0LmtleXMoIGJvdW5kYXJpZXNfYnlfbWludXRlICkubWFwKCBmdW5jdGlvbiAoIGJvdW5kYXJ5X2tleSApIHtcblx0XHRcdFx0cmV0dXJuIGJvdW5kYXJpZXNfYnlfbWludXRlWyBib3VuZGFyeV9rZXkgXTtcblx0XHRcdH0gKS5zb3J0KCBmdW5jdGlvbiAoIGxlZnQsIHJpZ2h0ICkgeyByZXR1cm4gbGVmdCAtIHJpZ2h0OyB9ICk7XG5cdFx0XHRib3VuZGFyaWVzLmZvckVhY2goIGZ1bmN0aW9uICggc3RhcnRfbWludXRlLCBpbmRleCApIHtcblx0XHRcdFx0dmFyIGVuZF9taW51dGUgPSBib3VuZGFyaWVzWyBpbmRleCArIDEgXTtcblx0XHRcdFx0dmFyIGNvbnRyaWJ1dG9ycztcblx0XHRcdFx0dmFyIHNvdXJjZV9pZHM7XG5cdFx0XHRcdHZhciB3aW5uZXI7XG5cblx0XHRcdFx0aWYgKCB1bmRlZmluZWQgPT09IGVuZF9taW51dGUgfHwgZW5kX21pbnV0ZSA8PSBzdGFydF9taW51dGUgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnRyaWJ1dG9ycyA9IGRhdGVfZnJhZ21lbnRzLmZpbHRlciggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZnJhZ21lbnQud2FsbF9zdGFydF9taW51dGUgPCBlbmRfbWludXRlICYmIGZyYWdtZW50LndhbGxfZW5kX21pbnV0ZSA+IHN0YXJ0X21pbnV0ZTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRzb3VyY2VfaWRzID0gY29udHJpYnV0b3JzLm1hcCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHsgcmV0dXJuIGZyYWdtZW50LnNvdXJjZTsgfSApLmNvbmNhdCggdW5rbm93bl9zb3VyY2VzICkuZmlsdGVyKCBmdW5jdGlvbiAoIHNvdXJjZSwgc291cmNlX2luZGV4LCBhbGxfc291cmNlcyApIHtcblx0XHRcdFx0XHRyZXR1cm4gYWxsX3NvdXJjZXMuaW5kZXhPZiggc291cmNlICkgPT09IHNvdXJjZV9pbmRleDtcblx0XHRcdFx0fSApLnNvcnQoIGZ1bmN0aW9uICggbGVmdCwgcmlnaHQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGdldF9hdmFpbGFiaWxpdHlfcmFuayggbGVmdCApIC0gZ2V0X2F2YWlsYWJpbGl0eV9yYW5rKCByaWdodCApIHx8IGxlZnQubG9jYWxlQ29tcGFyZSggcmlnaHQgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRpZiAoICEgc291cmNlX2lkcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHdpbm5lciA9IHNvdXJjZV9pZHNbIDAgXTtcblx0XHRcdFx0c2xpY2VzLnB1c2goIHtcblx0XHRcdFx0XHRzbGljZV9pZDogWyAnYXZhaWxhYmlsaXR5JywgZGF0ZV9iYW5kLmRhdGUsIHN0YXJ0X21pbnV0ZSwgZW5kX21pbnV0ZSwgd2lubmVyIF0uam9pbiggJ3wnICksXG5cdFx0XHRcdFx0ZGF0ZTogZGF0ZV9iYW5kLmRhdGUsXG5cdFx0XHRcdFx0c3RhcnRfbWludXRlOiBzdGFydF9taW51dGUsXG5cdFx0XHRcdFx0ZW5kX21pbnV0ZTogZW5kX21pbnV0ZSxcblx0XHRcdFx0XHR0b3BfcGVyY2VudDogTnVtYmVyKCAoIDEwMCAqICggc3RhcnRfbWludXRlIC0gcmFuZ2Uuc3RhcnRfbWludXRlICkgLyByYW5nZS5zcGFuX21pbnV0ZXMgKS50b0ZpeGVkKCA4ICkgKSxcblx0XHRcdFx0XHRoZWlnaHRfcGVyY2VudDogTnVtYmVyKCAoIDEwMCAqICggZW5kX21pbnV0ZSAtIHN0YXJ0X21pbnV0ZSApIC8gcmFuZ2Uuc3Bhbl9taW51dGVzICkudG9GaXhlZCggOCApICksXG5cdFx0XHRcdFx0c3RhdGU6IC0xICE9PSBzb3VyY2VfaWRzLmluZGV4T2YoICd1bmtub3duJyApIHx8IHVua25vd25fc291cmNlcy5sZW5ndGggPyBhdmFpbGFiaWxpdHlfc3RhdGUgOiAnZXhhY3QnLFxuXHRcdFx0XHRcdHdpbm5pbmdfc291cmNlOiB3aW5uZXIsXG5cdFx0XHRcdFx0c291cmNlX2lkczogc291cmNlX2lkcyxcblx0XHRcdFx0XHRzb3VyY2VfbGFiZWxzOiBzb3VyY2VfaWRzLm1hcCggZnVuY3Rpb24gKCBzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdFx0XHR2YXIgY29udHJpYnV0b3IgPSBjb250cmlidXRvcnMuZmlsdGVyKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkgeyByZXR1cm4gZnJhZ21lbnQuc291cmNlID09PSBzb3VyY2VfaWQ7IH0gKVsgMCBdO1xuXG5cdFx0XHRcdFx0XHRpZiAoICd1bmtub3duJyA9PT0gc291cmNlX2lkICkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gJ0F2YWlsYWJpbGl0eSB1bmtub3duJztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBTdHJpbmcoIHNvdXJjZV9kZWZpbml0aW9uc1sgc291cmNlX2lkIF0gJiYgc291cmNlX2RlZmluaXRpb25zWyBzb3VyY2VfaWQgXS5sYWJlbCB8fCBjb250cmlidXRvciAmJiBjb250cmlidXRvci5zb3VyY2VfbGFiZWwgfHwgc291cmNlX2lkICk7XG5cdFx0XHRcdFx0fSApLFxuXHRcdFx0XHRcdGludGVydmFsX2lkczogY29udHJpYnV0b3JzLm1hcCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHsgcmV0dXJuIGZyYWdtZW50LmludGVydmFsX2lkOyB9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIGludGVydmFsX2lkLCBpbnRlcnZhbF9pbmRleCwgYWxsX2lkcyApIHsgcmV0dXJuIGFsbF9pZHMuaW5kZXhPZiggaW50ZXJ2YWxfaWQgKSA9PT0gaW50ZXJ2YWxfaW5kZXg7IH0gKS5zb3J0KCksXG5cdFx0XHRcdFx0cmVsYXRlZF9zZWdtZW50X2lkczogY29udHJpYnV0b3JzLm1hcCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHsgcmV0dXJuIGZyYWdtZW50LnJlbGF0ZWRfc2VnbWVudF9pZDsgfSApLmZpbHRlciggZnVuY3Rpb24gKCBzZWdtZW50X2lkLCBzZWdtZW50X2luZGV4LCBhbGxfaWRzICkgeyByZXR1cm4gc2VnbWVudF9pZCAmJiBhbGxfaWRzLmluZGV4T2YoIHNlZ21lbnRfaWQgKSA9PT0gc2VnbWVudF9pbmRleDsgfSApLnNvcnQoKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHNsaWNlcztcblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZCBjaHJvbm9sb2dpY2FsLCBwcmVzZW50YXRpb24tbmV1dHJhbCBhY2Nlc3NpYmxlIHN1bW1hcnkgcmVjb3Jkcy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBmdWxsX2RheV9mcmFnbWVudHMgRnVsbC1kYXkgZnJhZ21lbnRzLlxuXHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IHRpbWVkX2ZyYWdtZW50cyBUaW1lZCBmcmFnbWVudHMsIGluY2x1ZGluZyBvdmVyZmxvdy5cblx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBhdmFpbGFiaWxpdHlfc2xpY2VzIENvbWJpbmVkIEF2YWlsYWJpbGl0eSBzbGljZXMuXG5cdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gY2xpcHBlZF9hdmFpbGFiaWxpdHlfZnJhZ21lbnRzIEV4cGxpY2l0IGNsaXBwZWQgc291cmNlIGZyYWdtZW50cy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGF2YWlsYWJpbGl0eV9zdGF0ZSBBdmFpbGFiaWxpdHkgbG9hZCBzdGF0ZS5cblx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gQ2hyb25vbG9naWNhbCBzdW1tYXJ5IHJlY29yZHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBidWlsZF9zdW1tYXJ5X3JlY29yZHMoIGZ1bGxfZGF5X2ZyYWdtZW50cywgdGltZWRfZnJhZ21lbnRzLCBhdmFpbGFiaWxpdHlfc2xpY2VzLCBjbGlwcGVkX2F2YWlsYWJpbGl0eV9mcmFnbWVudHMsIGF2YWlsYWJpbGl0eV9zdGF0ZSApIHtcblx0XHR2YXIgcmVjb3JkcyA9IFtdO1xuXG5cdFx0ZnVsbF9kYXlfZnJhZ21lbnRzLmZvckVhY2goIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRyZWNvcmRzLnB1c2goIHtcblx0XHRcdFx0c3VtbWFyeV9pZDogJ3N1bW1hcnl8JyArIGZyYWdtZW50LmZyYWdtZW50X2lkLFxuXHRcdFx0XHRraW5kOiAnZnVsbF9kYXlfYm9va2luZycsXG5cdFx0XHRcdGRhdGU6IGZyYWdtZW50LmRhdGUsXG5cdFx0XHRcdHN0YXJ0X21pbnV0ZTogMCxcblx0XHRcdFx0ZW5kX21pbnV0ZTogbWludXRlc19wZXJfZGF5LFxuXHRcdFx0XHRib29raW5nX2lkOiBmcmFnbWVudC5ib29raW5nX2lkLFxuXHRcdFx0XHRmcmFnbWVudF9pZDogZnJhZ21lbnQuZnJhZ21lbnRfaWQsXG5cdFx0XHRcdGxhYmVsOiBmcmFnbWVudC5sYWJlbCxcblx0XHRcdFx0c291cmNlX2lkczogW11cblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cdFx0dGltZWRfZnJhZ21lbnRzLmZvckVhY2goIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRyZWNvcmRzLnB1c2goIHtcblx0XHRcdFx0c3VtbWFyeV9pZDogJ3N1bW1hcnl8JyArIGZyYWdtZW50LmZyYWdtZW50X2lkLFxuXHRcdFx0XHRraW5kOiAndGltZWRfYm9va2luZycsXG5cdFx0XHRcdGRhdGU6IGZyYWdtZW50LmRhdGUsXG5cdFx0XHRcdHN0YXJ0X21pbnV0ZTogZnJhZ21lbnQud2FsbF9zdGFydF9taW51dGUsXG5cdFx0XHRcdGVuZF9taW51dGU6IGZyYWdtZW50LndhbGxfZW5kX21pbnV0ZSxcblx0XHRcdFx0Ym9va2luZ19pZDogZnJhZ21lbnQuYm9va2luZ19pZCxcblx0XHRcdFx0ZnJhZ21lbnRfaWQ6IGZyYWdtZW50LmZyYWdtZW50X2lkLFxuXHRcdFx0XHRsYWJlbDogZnJhZ21lbnQubGFiZWwsXG5cdFx0XHRcdHNvdXJjZV9pZHM6IFtdXG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXHRcdGF2YWlsYWJpbGl0eV9zbGljZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBzbGljZSApIHtcblx0XHRcdHJlY29yZHMucHVzaCgge1xuXHRcdFx0XHRzdW1tYXJ5X2lkOiAnc3VtbWFyeXwnICsgc2xpY2Uuc2xpY2VfaWQsXG5cdFx0XHRcdGtpbmQ6ICdhdmFpbGFiaWxpdHknLFxuXHRcdFx0XHRkYXRlOiBzbGljZS5kYXRlLFxuXHRcdFx0XHRzdGFydF9taW51dGU6IHNsaWNlLnN0YXJ0X21pbnV0ZSxcblx0XHRcdFx0ZW5kX21pbnV0ZTogc2xpY2UuZW5kX21pbnV0ZSxcblx0XHRcdFx0Ym9va2luZ19pZDogMCxcblx0XHRcdFx0ZnJhZ21lbnRfaWQ6ICcnLFxuXHRcdFx0XHRsYWJlbDogc2xpY2Uuc291cmNlX2xhYmVscy5qb2luKCAnLCAnICksXG5cdFx0XHRcdHNvdXJjZV9pZHM6IHNsaWNlLnNvdXJjZV9pZHMuc2xpY2UoKVxuXHRcdFx0fSApO1xuXHRcdH0gKTtcblx0XHRjbGlwcGVkX2F2YWlsYWJpbGl0eV9mcmFnbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdHJlY29yZHMucHVzaCgge1xuXHRcdFx0XHRzdW1tYXJ5X2lkOiAnc3VtbWFyeXxjbGlwcGVkfCcgKyBmcmFnbWVudC5pbnRlcnZhbF9pZCArICd8JyArIGZyYWdtZW50LmRhdGUgKyAnfCcgKyBmcmFnbWVudC5zdGFydF9lcG9jaCxcblx0XHRcdFx0a2luZDogJ2F2YWlsYWJpbGl0eV9jbGlwcGVkJyxcblx0XHRcdFx0ZGF0ZTogZnJhZ21lbnQuZGF0ZSxcblx0XHRcdFx0c3RhcnRfbWludXRlOiBmcmFnbWVudC53YWxsX3N0YXJ0X21pbnV0ZSxcblx0XHRcdFx0ZW5kX21pbnV0ZTogZnJhZ21lbnQud2FsbF9lbmRfbWludXRlLFxuXHRcdFx0XHRib29raW5nX2lkOiAwLFxuXHRcdFx0XHRmcmFnbWVudF9pZDogJycsXG5cdFx0XHRcdGxhYmVsOiBmcmFnbWVudC5zb3VyY2VfbGFiZWwgfHwgZnJhZ21lbnQuc291cmNlLFxuXHRcdFx0XHRzb3VyY2VfaWRzOiBbIGZyYWdtZW50LnNvdXJjZSBdXG5cdFx0XHR9ICk7XG5cdFx0fSApO1xuXHRcdGlmICggJ2xvYWRlZCcgIT09IGF2YWlsYWJpbGl0eV9zdGF0ZSApIHtcblx0XHRcdHJlY29yZHMucHVzaCgge1xuXHRcdFx0XHRzdW1tYXJ5X2lkOiAnc3VtbWFyeXxhdmFpbGFiaWxpdHktc3RhdGV8JyArIGF2YWlsYWJpbGl0eV9zdGF0ZSxcblx0XHRcdFx0a2luZDogJ2F2YWlsYWJpbGl0eV9zdGF0ZScsXG5cdFx0XHRcdGRhdGU6ICcnLFxuXHRcdFx0XHRzdGFydF9taW51dGU6IDAsXG5cdFx0XHRcdGVuZF9taW51dGU6IDAsXG5cdFx0XHRcdGJvb2tpbmdfaWQ6IDAsXG5cdFx0XHRcdGZyYWdtZW50X2lkOiAnJyxcblx0XHRcdFx0bGFiZWw6IGF2YWlsYWJpbGl0eV9zdGF0ZSxcblx0XHRcdFx0c291cmNlX2lkczogWyAndW5rbm93bicgXVxuXHRcdFx0fSApO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVjb3Jkcy5zb3J0KCBmdW5jdGlvbiAoIGxlZnQsIHJpZ2h0ICkge1xuXHRcdFx0cmV0dXJuIGxlZnQuZGF0ZS5sb2NhbGVDb21wYXJlKCByaWdodC5kYXRlICkgfHwgbGVmdC5zdGFydF9taW51dGUgLSByaWdodC5zdGFydF9taW51dGUgfHwgbGVmdC5lbmRfbWludXRlIC0gcmlnaHQuZW5kX21pbnV0ZSB8fCBsZWZ0LmtpbmQubG9jYWxlQ29tcGFyZSggcmlnaHQua2luZCApIHx8IGxlZnQuc3VtbWFyeV9pZC5sb2NhbGVDb21wYXJlKCByaWdodC5zdW1tYXJ5X2lkICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIHRoZSBjb21wbGV0ZSBhY2NlcHRlZC1pZGVudGl0eSBjYWNoZSBrZXkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dCBQcm9qZWN0b3IgaW5wdXQuXG5cdCAqIEBwYXJhbSB7QXJyYXk8T2JqZWN0Pn0gZGF0ZV9iYW5kcyBOb3JtYWxpemVkIGRhdGUgYmFuZHMuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByYW5nZV9wb2xpY3kgUmVxdWVzdGVkIHJhbmdlIHBvbGljeS5cblx0ICogQHJldHVybiB7c3RyaW5nfSBTdGFibGUgcHJvamVjdGlvbiBjYWNoZSBrZXkuXG5cdCAqL1xuXHRmdW5jdGlvbiBidWlsZF9wcm9qZWN0aW9uX2NhY2hlX2tleSggaW5wdXQsIGRhdGVfYmFuZHMsIHJhbmdlX3BvbGljeSApIHtcblx0XHR2YXIgd2luZG93X2lkZW50aXR5ID0gKCBBcnJheS5pc0FycmF5KCBpbnB1dC5ib29raW5nX3dpbmRvd3MgKSA/IGlucHV0LmJvb2tpbmdfd2luZG93cyA6IFtdICkubWFwKCBmdW5jdGlvbiAoIHdpbmRvd19lbnRyeSApIHtcblx0XHRcdHZhciBwYXlsb2FkID0gd2luZG93X2VudHJ5ICYmIHdpbmRvd19lbnRyeS5wYXlsb2FkID8gd2luZG93X2VudHJ5LnBheWxvYWQgOiB7fTtcblx0XHRcdHZhciB0aW1lbGluZV93aW5kb3cgPSBwYXlsb2FkLndpbmRvdyB8fCB7fTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGtleTogU3RyaW5nKCB3aW5kb3dfZW50cnkgJiYgd2luZG93X2VudHJ5LmtleSB8fCAnJyApLFxuXHRcdFx0XHRzdGFydF9hdDogU3RyaW5nKCB0aW1lbGluZV93aW5kb3cuc3RhcnRfYXQgfHwgJycgKSxcblx0XHRcdFx0ZW5kX2F0OiBTdHJpbmcoIHRpbWVsaW5lX3dpbmRvdy5lbmRfYXQgfHwgJycgKSxcblx0XHRcdFx0Y2VsbF9taW51dGVzOiBOdW1iZXIoIHRpbWVsaW5lX3dpbmRvdy5jZWxsX21pbnV0ZXMgfHwgMCApLFxuXHRcdFx0XHR2aWV3OiBTdHJpbmcoIHRpbWVsaW5lX3dpbmRvdy52aWV3IHx8ICcnIClcblx0XHRcdH07XG5cdFx0fSApO1xuXHRcdHZhciBpZGVudGl0eSA9IHtcblx0XHRcdHNjaGVtYV92ZXJzaW9uOiBwcm9qZWN0aW9uX3NjaGVtYV92ZXJzaW9uLFxuXHRcdFx0cmVzb3VyY2VfaWQ6IE51bWJlciggaW5wdXQucmVzb3VyY2VfaWQgKSxcblx0XHRcdHJlc291cmNlX2ZpbmdlcnByaW50OiBTdHJpbmcoIGlucHV0LnJlc291cmNlX2ZpbmdlcnByaW50IHx8ICcnICksXG5cdFx0XHR0aW1lem9uZTogU3RyaW5nKCBpbnB1dC50aW1lem9uZSB8fCAnJyApLFxuXHRcdFx0Ym9va2luZ19nZW5lcmF0aW9uOiBOdW1iZXIoIGlucHV0LmJvb2tpbmdfZ2VuZXJhdGlvbiB8fCAwICksXG5cdFx0XHRhdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbjogTnVtYmVyKCBpbnB1dC5hdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbiB8fCAwICksXG5cdFx0XHRhdmFpbGFiaWxpdHlfc3RhdGU6IFN0cmluZyggaW5wdXQuYXZhaWxhYmlsaXR5X3N0YXRlIHx8ICcnICksXG5cdFx0XHR3aW5kb3dzOiB3aW5kb3dfaWRlbnRpdHksXG5cdFx0XHRheGlzOiBkYXRlX2JhbmRzLm1hcCggZnVuY3Rpb24gKCBkYXRlX2JhbmQgKSB7XG5cdFx0XHRcdHJldHVybiBbIGRhdGVfYmFuZC5kYXRlLCBkYXRlX2JhbmQuc3RhcnRfZXBvY2gsIGRhdGVfYmFuZC5lbmRfZXBvY2gsIGRhdGVfYmFuZC5zcGFuLCBkYXRlX2JhbmQudHJhbnNpdGlvbnMubWFwKCBmdW5jdGlvbiAoIHRyYW5zaXRpb24gKSB7IHJldHVybiB0cmFuc2l0aW9uLnRyYW5zaXRpb25faWQ7IH0gKSBdO1xuXHRcdFx0fSApLFxuXHRcdFx0cmFuZ2VfcG9saWN5OiByYW5nZV9wb2xpY3ksXG5cdFx0XHR2aXNpYmxlX2xhbmVfbGltaXQ6IE51bWJlciggaW5wdXQudmlzaWJsZV9sYW5lX2xpbWl0IHx8IGRlZmF1bHRfdmlzaWJsZV9sYW5lX2xpbWl0IClcblx0XHR9O1xuXG5cdFx0cmV0dXJuICd0aW1lLXJvd3MtdicgKyBwcm9qZWN0aW9uX3NjaGVtYV92ZXJzaW9uICsgJy1yJyArIE51bWJlciggaW5wdXQucmVzb3VyY2VfaWQgKSArICctJyArIGhhc2hfaWRlbnRpdHkoIGlkZW50aXR5ICk7XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgYSBjYWNoZSBrZXkgZGlyZWN0bHkgZnJvbSBhY2NlcHRlZCBwcm9qZWN0b3IgaW5wdXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dCBBY2NlcHRlZCBib29raW5nLCBBdmFpbGFiaWxpdHksIGlkZW50aXR5LCBhbmQgcG9saWN5IGRhdGEuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhYmxlIHByb2plY3Rpb24gY2FjaGUga2V5LlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3Byb2plY3Rpb25fY2FjaGVfa2V5KCBpbnB1dCApIHtcblx0XHR2YXIgZGF0ZV9iYW5kcyA9IGNvbGxlY3RfZGF0ZV9iYW5kcyggaW5wdXQgJiYgaW5wdXQuYm9va2luZ193aW5kb3dzICk7XG5cdFx0dmFyIHJhbmdlX3BvbGljeSA9IE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdG1vZGU6ICdhdXRvJyxcblx0XHRcdHNhZmVfc3RhcnRfbWludXRlOiA0ODAsXG5cdFx0XHRzYWZlX2VuZF9taW51dGU6IDEwODBcblx0XHR9LCBpbnB1dCAmJiBpbnB1dC5yYW5nZV9wb2xpY3kgfHwge30gKTtcblxuXHRcdGlmICggISBkYXRlX2JhbmRzLmxlbmd0aCApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0cmV0dXJuIGJ1aWxkX3Byb2plY3Rpb25fY2FjaGVfa2V5KCBpbnB1dCwgZGF0ZV9iYW5kcywgcmFuZ2VfcG9saWN5ICk7XG5cdH1cblxuXHQvKipcblx0ICogUHJvamVjdCBvbmUgYXV0aG9yaXplZCBSZXNvdXJjZSBmcm9tIGFjY2VwdGVkIG5hdGl2ZSBUaW1lbGluZSBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gaW5wdXQgQWNjZXB0ZWQgYm9va2luZywgQXZhaWxhYmlsaXR5LCBpZGVudGl0eSwgYW5kIHBvbGljeSBkYXRhLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEpTT04tc2FmZSBub3JtYWxpemVkIHRpbWUtcm93cyBwcm9qZWN0aW9uIERUTy5cblx0ICovXG5cdGZ1bmN0aW9uIHByb2plY3QoIGlucHV0ICkge1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggaW5wdXQgJiYgaW5wdXQucmVzb3VyY2VfaWQgKTtcblx0XHR2YXIgZGF0ZV9iYW5kcztcblx0XHR2YXIgc2VnbWVudHM7XG5cdFx0dmFyIGF2YWlsYWJpbGl0eTtcblx0XHR2YXIgYXZhaWxhYmlsaXR5X3N0YXRlO1xuXHRcdHZhciBib29raW5nX3Byb2plY3Rpb247XG5cdFx0dmFyIGF2YWlsYWJpbGl0eV9mcmFnbWVudHM7XG5cdFx0dmFyIHJhbmdlX3BvbGljeTtcblx0XHR2YXIgcmFuZ2U7XG5cdFx0dmFyIHRpbWVkX2ZyYWdtZW50cztcblx0XHR2YXIgbGFuZV9wcm9qZWN0aW9uO1xuXHRcdHZhciBmdWxsX2RheV9mcmFnbWVudHM7XG5cdFx0dmFyIGF2YWlsYWJpbGl0eV9zbGljZXM7XG5cdFx0dmFyIGNhY2hlX2tleTtcblxuXHRcdGlmICggISBOdW1iZXIuaXNJbnRlZ2VyKCByZXNvdXJjZV9pZCApIHx8IDEgPiByZXNvdXJjZV9pZCApIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoICdBIHBvc2l0aXZlIGF1dGhvcml6ZWQgUmVzb3VyY2UgSUQgaXMgcmVxdWlyZWQuJyApO1xuXHRcdH1cblx0XHRkYXRlX2JhbmRzID0gY29sbGVjdF9kYXRlX2JhbmRzKCBpbnB1dC5ib29raW5nX3dpbmRvd3MgKTtcblx0XHRpZiAoICEgZGF0ZV9iYW5kcy5sZW5ndGggKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCAnQXQgbGVhc3Qgb25lIGV4YWN0IHNlcnZlciBkYXRlIGJhbmQgaXMgcmVxdWlyZWQuJyApO1xuXHRcdH1cblx0XHRzZWdtZW50cyA9IGNvbGxlY3RfYm9va2luZ19zZWdtZW50cyggaW5wdXQuYm9va2luZ193aW5kb3dzLCByZXNvdXJjZV9pZCApO1xuXHRcdGF2YWlsYWJpbGl0eSA9IGNvbGxlY3RfYXZhaWxhYmlsaXR5KCBpbnB1dC5hdmFpbGFiaWxpdHlfd2luZG93cywgcmVzb3VyY2VfaWQgKTtcblx0XHRhdmFpbGFiaWxpdHlfc3RhdGUgPSBTdHJpbmcoIGlucHV0LmF2YWlsYWJpbGl0eV9zdGF0ZSB8fCBhdmFpbGFiaWxpdHkubG9hZF9zdGF0ZSB8fCAnbG9hZGluZycgKTtcblx0XHRpZiAoIC0xID09PSBbICdsb2FkZWQnLCAncGFydGlhbCcsICdmYWlsZWQnLCAnbG9hZGluZycgXS5pbmRleE9mKCBhdmFpbGFiaWxpdHlfc3RhdGUgKSApIHtcblx0XHRcdGF2YWlsYWJpbGl0eV9zdGF0ZSA9ICdsb2FkaW5nJztcblx0XHR9XG5cdFx0Ym9va2luZ19wcm9qZWN0aW9uID0gcHJvamVjdF9ib29raW5nX2ZyYWdtZW50cyggc2VnbWVudHMsIGRhdGVfYmFuZHMgKTtcblx0XHRhdmFpbGFiaWxpdHlfZnJhZ21lbnRzID0gcHJvamVjdF9hdmFpbGFiaWxpdHlfZnJhZ21lbnRzKCBhdmFpbGFiaWxpdHkuaW50ZXJ2YWxzLCBkYXRlX2JhbmRzICk7XG5cdFx0cmFuZ2VfcG9saWN5ID0gT2JqZWN0LmFzc2lnbigge1xuXHRcdFx0bW9kZTogJ2F1dG8nLFxuXHRcdFx0c2FmZV9zdGFydF9taW51dGU6IDQ4MCxcblx0XHRcdHNhZmVfZW5kX21pbnV0ZTogMTA4MFxuXHRcdH0sIGlucHV0LnJhbmdlX3BvbGljeSB8fCB7fSApO1xuXHRcdHJhbmdlID0gcmVzb2x2ZV92ZXJ0aWNhbF9yYW5nZSggcmFuZ2VfcG9saWN5LCBib29raW5nX3Byb2plY3Rpb24udGltZWRfZnJhZ21lbnRzLCBhdmFpbGFiaWxpdHlfZnJhZ21lbnRzLCBhdmFpbGFiaWxpdHkuY292ZXJhZ2UgKTtcblx0XHR0aW1lZF9mcmFnbWVudHMgPSBib29raW5nX3Byb2plY3Rpb24udGltZWRfZnJhZ21lbnRzLm1hcCggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdHJldHVybiBhcHBseV92ZXJ0aWNhbF9yYW5nZSggZnJhZ21lbnQsIHJhbmdlICk7XG5cdFx0fSApLmZpbHRlciggZnVuY3Rpb24gKCBmcmFnbWVudCApIHtcblx0XHRcdHJldHVybiAhIGZyYWdtZW50LmlzX291dHNpZGVfcmFuZ2U7XG5cdFx0fSApO1xuXHRcdGxhbmVfcHJvamVjdGlvbiA9IGFzc2lnbl90aW1lZF9sYW5lcyggdGltZWRfZnJhZ21lbnRzLCBib3VuZGVkX2ludGVnZXIoIGlucHV0LnZpc2libGVfbGFuZV9saW1pdCwgMSwgMTAsIGRlZmF1bHRfdmlzaWJsZV9sYW5lX2xpbWl0ICkgKTtcblx0XHRmdWxsX2RheV9mcmFnbWVudHMgPSBhc3NpZ25fZnVsbF9kYXlfc3RhY2tzKCBib29raW5nX3Byb2plY3Rpb24uZnVsbF9kYXlfZnJhZ21lbnRzICk7XG5cdFx0YXZhaWxhYmlsaXR5X2ZyYWdtZW50cyA9IGF2YWlsYWJpbGl0eV9mcmFnbWVudHMubWFwKCBmdW5jdGlvbiAoIGZyYWdtZW50ICkge1xuXHRcdFx0cmV0dXJuIGFwcGx5X3ZlcnRpY2FsX3JhbmdlKCBmcmFnbWVudCwgcmFuZ2UgKTtcblx0XHR9ICk7XG5cdFx0YXZhaWxhYmlsaXR5X3NsaWNlcyA9IGNvbWJpbmVfYXZhaWxhYmlsaXR5X3NsaWNlcyggYXZhaWxhYmlsaXR5X2ZyYWdtZW50cywgZGF0ZV9iYW5kcywgcmFuZ2UsIGF2YWlsYWJpbGl0eV9zdGF0ZSwgYXZhaWxhYmlsaXR5LnVua25vd24sIGF2YWlsYWJpbGl0eS5zb3VyY2VzICk7XG5cdFx0Y2FjaGVfa2V5ID0gYnVpbGRfcHJvamVjdGlvbl9jYWNoZV9rZXkoIGlucHV0LCBkYXRlX2JhbmRzLCByYW5nZV9wb2xpY3kgKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRzY2hlbWFfdmVyc2lvbjogcHJvamVjdGlvbl9zY2hlbWFfdmVyc2lvbixcblx0XHRcdGNhY2hlX2tleTogY2FjaGVfa2V5LFxuXHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxuXHRcdFx0dGltZXpvbmU6IFN0cmluZyggaW5wdXQudGltZXpvbmUgfHwgJycgKSxcblx0XHRcdGlkZW50aXR5OiB7XG5cdFx0XHRcdHJlc291cmNlX2ZpbmdlcnByaW50OiBTdHJpbmcoIGlucHV0LnJlc291cmNlX2ZpbmdlcnByaW50IHx8ICcnICksXG5cdFx0XHRcdGJvb2tpbmdfZ2VuZXJhdGlvbjogTnVtYmVyKCBpbnB1dC5ib29raW5nX2dlbmVyYXRpb24gfHwgMCApLFxuXHRcdFx0XHRhdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbjogTnVtYmVyKCBpbnB1dC5hdmFpbGFiaWxpdHlfZ2VuZXJhdGlvbiB8fCAwIClcblx0XHRcdH0sXG5cdFx0XHR3aW5kb3c6IHtcblx0XHRcdFx0c3RhcnRfYXQ6IGRhdGVfYmFuZHNbIDAgXS5zdGFydF9hdCxcblx0XHRcdFx0ZW5kX2F0OiBkYXRlX2JhbmRzWyBkYXRlX2JhbmRzLmxlbmd0aCAtIDEgXS5lbmRfYXQsXG5cdFx0XHRcdHN0YXJ0X2Vwb2NoOiBkYXRlX2JhbmRzWyAwIF0uc3RhcnRfZXBvY2gsXG5cdFx0XHRcdGVuZF9lcG9jaDogZGF0ZV9iYW5kc1sgZGF0ZV9iYW5kcy5sZW5ndGggLSAxIF0uZW5kX2Vwb2NoXG5cdFx0XHR9LFxuXHRcdFx0cmFuZ2U6IHJhbmdlLFxuXHRcdFx0ZGF0ZXM6IGRhdGVfYmFuZHMsXG5cdFx0XHRmdWxsX2RheV9mcmFnbWVudHM6IGZ1bGxfZGF5X2ZyYWdtZW50cyxcblx0XHRcdHRpbWVkX2ZyYWdtZW50czogbGFuZV9wcm9qZWN0aW9uLmZyYWdtZW50cyxcblx0XHRcdG92ZXJmbG93X2dyb3VwczogbGFuZV9wcm9qZWN0aW9uLm92ZXJmbG93X2dyb3Vwcyxcblx0XHRcdGF2YWlsYWJpbGl0eToge1xuXHRcdFx0XHRzdGF0ZTogYXZhaWxhYmlsaXR5X3N0YXRlLFxuXHRcdFx0XHRzb3VyY2VzOiBPYmplY3Qua2V5cyggYXZhaWxhYmlsaXR5LnNvdXJjZXMgKS5zb3J0KCkubWFwKCBmdW5jdGlvbiAoIHNvdXJjZV9pZCApIHsgcmV0dXJuIGF2YWlsYWJpbGl0eS5zb3VyY2VzWyBzb3VyY2VfaWQgXTsgfSApLFxuXHRcdFx0XHRjb3ZlcmFnZTogYXZhaWxhYmlsaXR5LmNvdmVyYWdlLFxuXHRcdFx0XHR1bmtub3duOiBhdmFpbGFiaWxpdHkudW5rbm93bixcblx0XHRcdFx0c2xpY2VzOiBhdmFpbGFiaWxpdHlfc2xpY2VzLFxuXHRcdFx0XHRjbGlwcGVkX2ZyYWdtZW50czogYXZhaWxhYmlsaXR5X2ZyYWdtZW50cy5maWx0ZXIoIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZyYWdtZW50LmlzX2NsaXBwZWRfYWJvdmUgfHwgZnJhZ21lbnQuaXNfY2xpcHBlZF9iZWxvdyB8fCBmcmFnbWVudC5pc19vdXRzaWRlX3JhbmdlO1xuXHRcdFx0XHR9IClcblx0XHRcdH0sXG5cdFx0XHRzdW1tYXJ5OiBidWlsZF9zdW1tYXJ5X3JlY29yZHMoXG5cdFx0XHRcdGZ1bGxfZGF5X2ZyYWdtZW50cyxcblx0XHRcdFx0bGFuZV9wcm9qZWN0aW9uLmZyYWdtZW50cyxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X3NsaWNlcyxcblx0XHRcdFx0YXZhaWxhYmlsaXR5X2ZyYWdtZW50cy5maWx0ZXIoIGZ1bmN0aW9uICggZnJhZ21lbnQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZyYWdtZW50LmlzX2NsaXBwZWRfYWJvdmUgfHwgZnJhZ21lbnQuaXNfY2xpcHBlZF9iZWxvdyB8fCBmcmFnbWVudC5pc19vdXRzaWRlX3JhbmdlO1xuXHRcdFx0XHR9ICksXG5cdFx0XHRcdGF2YWlsYWJpbGl0eV9zdGF0ZVxuXHRcdFx0KVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY190aW1lbGluZV90aW1lX3Jvd3NfcHJvamVjdG9yID0gT2JqZWN0LmZyZWV6ZSgge1xuXHRcdHNjaGVtYV92ZXJzaW9uOiBwcm9qZWN0aW9uX3NjaGVtYV92ZXJzaW9uLFxuXHRcdGF2YWlsYWJpbGl0eV9wcmVjZWRlbmNlOiBhdmFpbGFiaWxpdHlfcHJlY2VkZW5jZS5zbGljZSgpLFxuXHRcdHBhcnNlX2V4YWN0X3RpbWVzdGFtcDogcGFyc2VfZXhhY3RfdGltZXN0YW1wLFxuXHRcdGdldF9wcm9qZWN0aW9uX2NhY2hlX2tleTogZ2V0X3Byb2plY3Rpb25fY2FjaGVfa2V5LFxuXHRcdGJ1aWxkX3Byb2plY3Rpb25fY2FjaGVfa2V5OiBidWlsZF9wcm9qZWN0aW9uX2NhY2hlX2tleSxcblx0XHRwcm9qZWN0OiBwcm9qZWN0XG5cdH0gKTtcbn0oIHdpbmRvdyApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxNQUFNLEVBQUc7RUFDckIsWUFBWTs7RUFFWixJQUFJQyx5QkFBeUIsR0FBRyxDQUFDO0VBQ2pDLElBQUlDLGVBQWUsR0FBRyxJQUFJO0VBQzFCLElBQUlDLDBCQUEwQixHQUFHLENBQUM7RUFDbEMsSUFBSUMsdUJBQXVCLEdBQUcsQ0FDN0IsU0FBUyxFQUNULGNBQWMsRUFDZCxjQUFjLEVBQ2QscUJBQXFCLEVBQ3JCLHVCQUF1QixFQUN2QixvQkFBb0IsRUFDcEIsZ0JBQWdCLEVBQ2hCLGNBQWMsQ0FDZDs7RUFFRDtBQUNEO0FBQ0E7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
