"use strict";

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
(function (window, document, $) {
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
  function normalize_id(candidate) {
    var normalized = Number(candidate);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : 0;
  }

  /**
   * Normalize one exact-minute time.
   *
   * @param {*} candidate Candidate time.
   * @return {string} `HH:MM` or an empty string.
   */
  function normalize_time(candidate) {
    var normalized = String(candidate || '').trim();
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : '';
  }

  /**
   * Normalize strict ISO dates without applying timezone conversion.
   *
   * @param {*} candidates Candidate date collection.
   * @return {Array<string>} Ordered unique valid dates.
   */
  function normalize_dates(candidates) {
    var unique_dates = {};
    (Array.isArray(candidates) ? candidates : []).forEach(function (candidate) {
      var date_value = String(candidate || '');
      var date_parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date_value);
      var test_date;
      if (!date_parts) {
        return;
      }
      test_date = new Date(Date.UTC(Number(date_parts[1]), Number(date_parts[2]) - 1, Number(date_parts[3])));
      if (test_date.getUTCFullYear() === Number(date_parts[1]) && test_date.getUTCMonth() === Number(date_parts[2]) - 1 && test_date.getUTCDate() === Number(date_parts[3])) {
        unique_dates[date_value] = date_value;
      }
    });
    return Object.keys(unique_dates).sort();
  }

  /**
   * Clone the executable-free local proposal draft.
   *
   * @param {Object} candidate Candidate draft.
   * @return {Object} Independent normalized draft.
   */
  function clone_draft(candidate) {
    candidate = candidate && 'object' === typeof candidate ? candidate : {};
    return {
      target_resource_id: normalize_id(candidate.target_resource_id),
      selection_method: MODE_INDIVIDUAL === candidate.selection_method ? MODE_INDIVIDUAL : MODE_POLICY,
      time_application: -1 !== [TIME_FULL_DAY, TIME_BOUNDARY, TIME_PER_DATE].indexOf(candidate.time_application) ? candidate.time_application : TIME_FULL_DAY,
      start_time: normalize_time(candidate.start_time),
      end_time: normalize_time(candidate.end_time),
      selected_dates: normalize_dates(candidate.selected_dates),
      proposal_revision: Math.max(1, normalize_id(candidate.proposal_revision))
    };
  }

  /**
   * Freeze the immutable saved proposal state.
   *
   * @param {Object} candidate Candidate server initial state.
   * @return {Object} Frozen normalized draft.
   */
  function freeze_draft(candidate) {
    var frozen = clone_draft(candidate);
    Object.freeze(frozen.selected_dates);
    return Object.freeze(frozen);
  }

  /**
   * Return the meaningful comparison projection for dirty-state checks.
   *
   * @param {Object} candidate Normalized draft.
   * @return {Object} Stable comparison record.
   */
  function compare_draft(candidate) {
    var normalized = clone_draft(candidate);
    delete normalized.proposal_revision;
    if (TIME_FULL_DAY === normalized.time_application) {
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
  function add_days(iso_date, day_count) {
    var parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso_date);
    var shifted;
    if (!parts) {
      return '';
    }
    shifted = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]) + day_count));
    return shifted.getUTCFullYear() + '-' + String(shifted.getUTCMonth() + 1).padStart(2, '0') + '-' + String(shifted.getUTCDate()).padStart(2, '0');
  }

  /**
   * Convert an offset in minutes to an RFC3339 suffix.
   *
   * @param {number} offset_minutes Minutes east of UTC.
   * @return {string} Signed `HH:MM` offset.
   */
  function format_offset(offset_minutes) {
    var sign = offset_minutes < 0 ? '-' : '+';
    var absolute = Math.abs(offset_minutes);
    return sign + String(Math.floor(absolute / 60)).padStart(2, '0') + ':' + String(absolute % 60).padStart(2, '0');
  }

  /**
   * Read wall-clock parts for one instant in an IANA timezone.
   *
   * @param {number} timestamp_ms UTC timestamp in milliseconds.
   * @param {string} timezone_name IANA timezone name.
   * @return {Object|null} Numeric wall parts or null when unsupported.
   */
  function get_zoned_parts(timestamp_ms, timezone_name) {
    var formatter;
    var parts;
    var result = {};
    try {
      formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone_name,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
      parts = formatter.formatToParts(new Date(timestamp_ms));
    } catch (timezone_error) {
      return null;
    }
    parts.forEach(function (part) {
      if (-1 !== ['year', 'month', 'day', 'hour', 'minute'].indexOf(part.type)) {
        result[part.type] = Number(part.value);
      }
    });
    return 5 === Object.keys(result).length ? result : null;
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
  function wall_time_to_rfc3339(iso_date, exact_time, timezone_name) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso_date);
    var time_match = /^(\d{2}):(\d{2})$/.exec(exact_time);
    var fixed_offset = /^([+-])(\d{2}):(\d{2})$/.exec(timezone_name);
    var wall_timestamp;
    var offsets = {};
    var matches = [];
    if (!match || !time_match) {
      return null;
    }
    if (fixed_offset) {
      return iso_date + 'T' + exact_time + ':00' + timezone_name;
    }
    wall_timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(time_match[1]), Number(time_match[2]));
    [-172800000, -86400000, 0, 86400000, 172800000].forEach(function (delta) {
      var zoned_parts = get_zoned_parts(wall_timestamp + delta, timezone_name);
      var zoned_as_utc;
      if (zoned_parts) {
        zoned_as_utc = Date.UTC(zoned_parts.year, zoned_parts.month - 1, zoned_parts.day, zoned_parts.hour, zoned_parts.minute);
        offsets[Math.round((zoned_as_utc - (wall_timestamp + delta)) / 60000)] = true;
      }
    });
    Object.keys(offsets).forEach(function (offset_key) {
      var offset_minutes = Number(offset_key);
      var candidate_timestamp = wall_timestamp - offset_minutes * 60000;
      var candidate_parts = get_zoned_parts(candidate_timestamp, timezone_name);
      if (candidate_parts && candidate_parts.year === Number(match[1]) && candidate_parts.month === Number(match[2]) && candidate_parts.day === Number(match[3]) && candidate_parts.hour === Number(time_match[1]) && candidate_parts.minute === Number(time_match[2])) {
        matches.push(iso_date + 'T' + exact_time + ':00' + format_offset(offset_minutes));
      }
    });
    return 1 === matches.length ? matches[0] : null;
  }

  /**
   * Create one accessible rescheduling controller inside an Inspector shell.
   *
   * @param {HTMLElement} inspector_shell Booking Inspector root.
   * @param {Object}      configuration   Server-owned dialog configuration.
   * @param {Object}      options         Host transport and readback callbacks.
   * @return {Object|null} Controller API or null when dependencies are absent.
   */
  function create_controller(inspector_shell, configuration, options) {
    var settings = configuration && 'object' === typeof configuration ? configuration : {};
    var controller_options = options && 'object' === typeof options ? options : {};
    var templates = settings.templates && 'object' === typeof settings.templates ? settings.templates : {};
    var i18n = settings.i18n && 'object' === typeof settings.i18n ? settings.i18n : {};
    var dialog_template = window.wp && templates.dialog ? window.wp.template(templates.dialog) : null;
    var review_template = window.wp && templates.review ? window.wp.template(templates.review) : null;
    var inspector_panel = inspector_shell ? inspector_shell.querySelector('.wpbc_shared_ui_inspector__panel') : null;
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
    if (!settings.active || !dialog_template || !review_template || !inspector_panel || !window.jQuery || !window.wpbc_booking_date_editor || 'function' !== typeof window.wpbc_booking_date_editor.create_native_calendar_adapter) {
      return null;
    }

    /** @return {void} Clear the bounded native-load timeout. */
    function clear_native_timeout() {
      if (null !== native_timeout) {
        window.clearTimeout(native_timeout);
        native_timeout = null;
      }
    }

    /**
     * Update the Inspector-owned dirty state.
     *
     * @return {void}
     */
    function update_dirty() {
      var next_dirty = Boolean(saved_draft && draft && JSON.stringify(compare_draft(saved_draft)) !== JSON.stringify(compare_draft(draft)));
      if (next_dirty !== dirty) {
        dirty = next_dirty;
        if ('function' === typeof controller_options.on_dirty_change) {
          controller_options.on_dirty_change(dirty);
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
    function set_status(message, visible, severity) {
      var status = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-status]') : null;
      if (!status) {
        return;
      }
      status.textContent = String(message || '');
      status.classList.toggle('is-visible', Boolean(visible && message));
      status.classList.toggle('is-error', Boolean(visible && message && 'error' === severity));
      status.classList.toggle('is-warning', Boolean(visible && message && 'error' !== severity));
      status.setAttribute('role', 'error' === severity ? 'alert' : 'status');
      status.setAttribute('aria-live', 'error' === severity ? 'assertive' : 'polite');
    }

    /**
     * Show the loading state without discarding the current proposal.
     *
     * @param {string} message Loading message.
     * @return {void}
     */
    function show_loading(message) {
      var loading = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-loading]') : null;
      var label = loading ? loading.querySelector('[data-wpbc-booking-rescheduling-loading-label]') : null;
      var error = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-error]') : null;
      var editor = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-view="editor"]') : null;
      var review = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-view="review"]') : null;
      if (label) {
        label.textContent = String(message || i18n.loading || '');
      }
      if (loading) {
        loading.hidden = false;
      }
      if (error) {
        error.hidden = true;
      }
      if (editor) {
        editor.hidden = true;
      }
      if (review) {
        review.hidden = true;
      }
      if (layer) {
        layer.setAttribute('aria-busy', 'true');
      }
      set_status(message, false, 'warning');
    }

    /**
     * Show one recoverable safe error.
     *
     * @param {string} message Error message.
     * @return {void}
     */
    function show_error(message) {
      var loading = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-loading]') : null;
      var error = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-error]') : null;
      var error_message = error ? error.querySelector('[data-wpbc-booking-rescheduling-error-message]') : null;
      clear_native_timeout();
      if (loading) {
        loading.hidden = true;
      }
      if (error) {
        error.hidden = false;
      }
      if (error_message) {
        error_message.textContent = String(message || i18n.load_error || '');
      }
      if (layer) {
        layer.setAttribute('aria-busy', 'false');
      }
      set_status(message, false, 'error');
    }

    /**
     * Return the best focus restoration target after rerenders.
     *
     * @return {HTMLElement|null} Connected focus target.
     */
    function get_restore_focus() {
      var fallback;
      if (opener && opener.isConnected) {
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
      [read_request, review_request, apply_request].forEach(function (pending_request) {
        if (pending_request && 'function' === typeof pending_request.abort) {
          pending_request.abort();
        }
      });
      read_request = null;
      review_request = null;
      apply_request = null;
      if (native_adapter) {
        native_adapter.teardown();
      }
      native_adapter = null;
      if (layer) {
        window.jQuery(layer).off('date_selected' + EVENT_NAMESPACE);
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
      if ('function' === typeof controller_options.on_dirty_change) {
        controller_options.on_dirty_change(false);
      }
    }

    /**
     * Close with optional dirty protection and focus restoration.
     *
     * @param {boolean} restore_focus Whether to restore the opener.
     * @param {boolean} force         Whether a parent already approved discard.
     * @return {boolean} True when closed or already closed.
     */
    function close(restore_focus, force) {
      var focus_target;
      if (!layer) {
        return true;
      }
      if (!force && (apply_request || pending_apply_result)) {
        set_status(pending_apply_result ? i18n.readback_error || '' : i18n.applying || '', true, pending_apply_result ? 'error' : 'warning');
        return false;
      }
      if (dirty && !force && !window.confirm(i18n.discard_changes || '')) {
        return false;
      }
      focus_target = restore_focus ? get_restore_focus() : null;
      teardown();
      opener = null;
      if (focus_target) {
        window.setTimeout(function () {
          if (focus_target.isConnected) {
            focus_target.focus();
          }
        }, 0);
      }
      return true;
    }

    /**
     * Render the dialog through its allow-listed domain template.
     *
     * @param {Object} template_values Authorized DTO and draft values.
     * @return {HTMLElement|null} Rendered layer.
     */
    function render_layer(template_values) {
      var host = document.createElement('div');
      var rendered;
      if (layer) {
        layer.remove();
      }
      host.innerHTML = dialog_template(Object.assign({
        inspector_id: 'wpbc_booking_inspector',
        i18n: i18n,
        resources: [],
        selected_dates: []
      }, template_values || {}));
      rendered = host.querySelector('[data-wpbc-booking-rescheduling-layer]');
      if (!rendered) {
        return null;
      }
      inspector_panel.appendChild(rendered);
      layer = rendered;
      return layer;
    }

    /**
     * Synchronize visible controls and dirty state from the mutable draft.
     *
     * @return {void}
     */
    function render_draft() {
      var selected_list = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-selected-dates]') : null;
      var time_fields = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-time-fields]') : null;
      var review_button = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-review]') : null;
      var reviewable;
      if (!draft) {
        return;
      }
      if (time_fields) {
        time_fields.hidden = TIME_FULL_DAY === draft.time_application;
      }
      if (selected_list) {
        selected_list.textContent = '';
        if (!draft.selected_dates.length) {
          var empty_item = document.createElement('li');
          empty_item.className = 'wpbc_booking_inspector__muted';
          empty_item.textContent = String(i18n.no_selected_dates || '');
          selected_list.appendChild(empty_item);
        } else {
          draft.selected_dates.forEach(function (selected_date) {
            var date_item = document.createElement('li');
            date_item.textContent = selected_date;
            selected_list.appendChild(date_item);
          });
        }
      }
      update_dirty();
      reviewable = dirty && draft.selected_dates.length > 0 && (TIME_FULL_DAY === draft.time_application || Boolean(normalize_time(draft.start_time) && normalize_time(draft.end_time)));
      if (review_button) {
        review_button.disabled = !reviewable;
        review_button.setAttribute('aria-disabled', reviewable ? 'false' : 'true');
      }
    }

    /**
     * Show the editor after a successful native calendar load.
     *
     * @param {string}  message Completion message.
     * @param {boolean} warning Whether the message is a visible warning.
     * @return {void}
     */
    function show_ready(message, warning) {
      var loading = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-loading]') : null;
      var error = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-error]') : null;
      var editor = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-view="editor"]') : null;
      if (loading) {
        loading.hidden = true;
      }
      if (error) {
        error.hidden = true;
      }
      if (editor) {
        editor.hidden = false;
      }
      if (layer) {
        layer.setAttribute('aria-busy', 'false');
      }
      set_status(message, warning, 'warning');
    }

    /**
     * Restore exact proposed dates after canonical native availability loads.
     *
     * @param {number} current_generation Matching controller generation.
     * @param {number} attempt            Zero-based animation-frame attempt.
     * @return {void}
     */
    function hydrate_dates(current_generation, attempt) {
      var restored;
      if (current_generation !== generation || !native_adapter || !draft) {
        return;
      }
      restored = native_adapter.set_exact_selected_dates(draft.selected_dates);
      if (restored) {
        draft.selected_dates = native_adapter.get_selected_dates();
        render_draft();
        show_ready(i18n.loaded || '', false);
        return;
      }
      if (attempt < 3) {
        window.requestAnimationFrame(function () {
          hydrate_dates(current_generation, attempt + 1);
        });
        return;
      }
      native_adapter.set_selection_mode(MODE_INDIVIDUAL);
      restored = native_adapter.set_exact_selected_dates(draft.selected_dates);
      draft.selection_method = MODE_INDIVIDUAL;
      draft.selected_dates = restored ? native_adapter.get_selected_dates() : draft.selected_dates.slice(0);
      Array.prototype.forEach.call(layer.querySelectorAll('[data-wpbc-booking-rescheduling-selection-method]'), function (control) {
        control.checked = MODE_INDIVIDUAL === control.value;
      });
      render_draft();
      show_ready(i18n.hydration_warning || '', true);
    }

    /**
     * Mount the sole shared native calendar adapter and load availability.
     *
     * @param {number} current_generation Matching controller generation.
     * @return {void}
     */
    function mount_calendar(current_generation) {
      var calendar = active_dto && active_dto.calendar ? active_dto.calendar : {};
      var calendar_host = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-calendar-host]') : null;
      native_adapter = window.wpbc_booking_date_editor.create_native_calendar_adapter();
      if (!native_adapter.mount(calendar_host, {
        resource_id: active_dto.target_resource_id,
        calendar_html: calendar.html || '',
        calendar_parameters: calendar.calendar_parameters || {},
        policy_parameters: calendar.policy_parameters || {},
        context_parameters: calendar.context_parameters || {},
        secure_parameters: calendar.secure_parameters || {}
      })) {
        show_error(i18n.calendar_error || '');
        return;
      }
      window.jQuery(layer).off('date_selected' + EVENT_NAMESPACE).on('date_selected' + EVENT_NAMESPACE, function (event, resource_id, clicked_dates, selected_dates) {
        if (current_generation !== generation || normalize_id(resource_id) !== normalize_id(active_dto.target_resource_id) || !draft) {
          return;
        }
        draft.selected_dates = normalize_dates(selected_dates);
        draft.proposal_revision += 1;
        active_review = null;
        render_draft();
      });
      set_status(i18n.loading_calendar || '', false, 'warning');
      clear_native_timeout();
      native_timeout = window.setTimeout(function () {
        if (current_generation === generation && native_adapter) {
          native_adapter.abort_load();
          show_error(i18n.calendar_error || '');
        }
      }, NATIVE_LOAD_TIMEOUT_MS);
      if (!native_adapter.load(calendar.request_parameters || {}, function () {
        clear_native_timeout();
        if (current_generation !== generation || !draft) {
          return;
        }
        native_adapter.set_selection_mode(draft.selection_method);
        hydrate_dates(current_generation, 0);
      }, function () {
        clear_native_timeout();
        if (current_generation === generation) {
          show_error(i18n.calendar_error || '');
        }
      })) {
        show_error(i18n.calendar_error || '');
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
    function initialize(dialog_dto, current_generation, preserved_draft) {
      var initial;
      active_dto = dialog_dto;
      if (!dialog_dto.supported) {
        show_error(i18n.unsupported || '');
        return;
      }
      initial = Object.assign({}, dialog_dto.initial || {}, {
        proposal_revision: dialog_dto.proposal_revision || 1
      });
      if (!saved_draft) {
        saved_draft = freeze_draft(initial);
      }
      draft = clone_draft(preserved_draft || initial);
      draft.target_resource_id = normalize_id(dialog_dto.target_resource_id);
      retry_draft = clone_draft(draft);
      render_layer(Object.assign({}, draft, {
        i18n: i18n,
        resources: dialog_dto.choices && dialog_dto.choices.resources ? dialog_dto.choices.resources : []
      }));
      show_loading(i18n.loading_calendar || '');
      render_draft();
      mount_calendar(current_generation);
    }

    /**
     * Request a fresh authorized initialization DTO for a target Resource.
     *
     * @param {number} target_resource_id Requested target, or zero initially.
     * @param {Object|null} preserved_draft Proposal to restore after reload.
     * @return {void}
     */
    function request_read(target_resource_id, preserved_draft) {
      var booking_id = active_dto ? normalize_id(active_dto.booking_id) : 0;
      var current_generation;
      var pending_request;
      if (!booking_id || !controller_options.url || !controller_options.source || !settings.read || !settings.read.action || !settings.read.nonce) {
        show_error(i18n.load_error || '');
        return;
      }
      generation += 1;
      current_generation = generation;
      if (read_request && 'function' === typeof read_request.abort) {
        read_request.abort();
      }
      if (review_request && 'function' === typeof review_request.abort) {
        review_request.abort();
      }
      review_generation += 1;
      review_request = null;
      active_review = null;
      if (native_adapter) {
        native_adapter.teardown();
        native_adapter = null;
      }
      clear_native_timeout();
      retry_draft = preserved_draft ? clone_draft(preserved_draft) : retry_draft;
      show_loading(i18n.loading || '');
      pending_request = window.jQuery.ajax({
        url: controller_options.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: settings.read.action,
          nonce: settings.read.nonce,
          booking_id: booking_id,
          source: controller_options.source,
          target_resource_id: normalize_id(target_resource_id),
          source_context_token: active_dto && active_dto.source_context_token ? String(active_dto.source_context_token) : ''
        }
      }).done(function (response) {
        if (current_generation !== generation || !response || !response.success || !response.data || !response.data.rescheduling) {
          return;
        }
        initialize(response.data.rescheduling, current_generation, preserved_draft);
      }).fail(function (failed_request, request_status) {
        var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
        if ('abort' !== request_status && current_generation === generation && layer) {
          show_error(error.message || i18n.load_error || '');
        }
      }).always(function () {
        if (read_request === pending_request) {
          read_request = null;
        }
      });
      read_request = pending_request;
    }

    /**
     * Build the bounded browser proposal for authoritative review.
     *
     * @return {Object|null} Proposal or null for invalid/ambiguous site time.
     */
    function build_proposal() {
      var timezone_name = active_dto && active_dto.timezone ? String(active_dto.timezone.name || '') : '';
      var proposal;
      var first_date;
      var last_date;
      var intervals;
      if (!active_dto || !draft || !draft.selected_dates.length) {
        return null;
      }
      proposal = {
        schema_version: Number(settings.schema_version || 0),
        booking_id: normalize_id(active_dto.booking_id),
        interaction_source: 'dialog',
        operation: draft.target_resource_id === normalize_id(active_dto.current_resource_id) ? 'replace_dates' : 'change_resource',
        target_resource_id: draft.target_resource_id,
        selection_method: draft.selection_method,
        proposal_revision: Math.max(1, draft.proposal_revision),
        source_context_token: String(active_dto.source_context_token || '')
      };
      if (TIME_FULL_DAY === draft.time_application) {
        proposal.proposed_dates = draft.selected_dates.slice(0);
        return proposal;
      }
      first_date = draft.selected_dates[0];
      last_date = draft.selected_dates[draft.selected_dates.length - 1];
      if (TIME_BOUNDARY === draft.time_application) {
        if (first_date === last_date && draft.end_time <= draft.start_time) {
          last_date = add_days(last_date, 1);
        }
        intervals = [{
          start: wall_time_to_rfc3339(first_date, draft.start_time, timezone_name),
          end: wall_time_to_rfc3339(last_date, draft.end_time, timezone_name)
        }];
      } else {
        intervals = draft.selected_dates.map(function (selected_date) {
          var end_date = draft.end_time <= draft.start_time ? add_days(selected_date, 1) : selected_date;
          return {
            start: wall_time_to_rfc3339(selected_date, draft.start_time, timezone_name),
            end: wall_time_to_rfc3339(end_date, draft.end_time, timezone_name)
          };
        });
      }
      if (intervals.some(function (interval) {
        return !interval.start || !interval.end;
      })) {
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
    function render_review(response) {
      var loading = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-loading]') : null;
      var editor = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-view="editor"]') : null;
      var review = layer ? layer.querySelector('[data-wpbc-booking-rescheduling-view="review"]') : null;
      var content = review ? review.querySelector('[data-wpbc-booking-rescheduling-review-content]') : null;
      var apply_button = review ? review.querySelector('[data-wpbc-booking-rescheduling-apply]') : null;
      var back_button = review ? review.querySelector('[data-wpbc-booking-rescheduling-back]') : null;
      var heading;
      if (!response || !response.review || !response.plan || !response.token || !response.expires_at || !content) {
        show_ready('', false);
        set_status(i18n.review_error || '', true, 'error');
        return;
      }
      active_review = response;
      content.innerHTML = review_template(response.review);
      if (loading) {
        loading.hidden = true;
      }
      if (editor) {
        editor.hidden = true;
      }
      review.hidden = false;
      if (apply_button) {
        apply_button.disabled = false;
        apply_button.setAttribute('aria-disabled', 'false');
        apply_button.textContent = pending_apply_result ? String(i18n.retry_refresh || i18n.retry || '') : String(i18n.apply_changes || '');
      }
      if (back_button) {
        back_button.disabled = Boolean(pending_apply_result);
      }
      layer.setAttribute('aria-busy', 'false');
      set_status('', false, 'warning');
      heading = content.querySelector('h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }

    /** @return {void} Submit the current proposal for non-mutating review. */
    function request_review() {
      var proposal = build_proposal();
      var current_generation;
      var pending_request;
      if (!proposal) {
        set_status(i18n.timezone_error || i18n.review_error || '', true, 'error');
        return;
      }
      review_generation += 1;
      current_generation = review_generation;
      if (review_request && 'function' === typeof review_request.abort) {
        review_request.abort();
      }
      show_loading(i18n.loading_review || '');
      pending_request = window.jQuery.ajax({
        url: controller_options.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: settings.review.action,
          nonce: settings.review.nonce,
          booking_id: active_dto.booking_id,
          source: controller_options.source,
          proposal: JSON.stringify(proposal)
        }
      }).done(function (response) {
        if (current_generation === review_generation && response && response.success && response.data) {
          render_review(response.data);
        }
      }).fail(function (failed_request, request_status) {
        var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
        if ('abort' !== request_status && current_generation === review_generation && layer) {
          show_ready('', false);
          set_status(error.message || i18n.review_error || '', true, 'error');
        }
      }).always(function () {
        if (review_request === pending_request) {
          review_request = null;
        }
      });
      review_request = pending_request;
    }

    /**
     * Ask the Inspector to replace itself from canonical readback.
     *
     * @param {Object} submitted_review Review retained for Retry refresh.
     * @return {void}
     */
    function request_readback(submitted_review) {
      var readback;
      var current_generation;
      if (!pending_apply_result || 'function' !== typeof controller_options.on_applied) {
        render_review(submitted_review);
        set_status(i18n.readback_error || '', true, 'error');
        return;
      }
      apply_generation += 1;
      current_generation = apply_generation;
      show_loading(i18n.refreshing || '');
      try {
        readback = controller_options.on_applied(pending_apply_result);
      } catch (readback_error) {
        readback = null;
      }
      if (!readback || 'function' !== typeof readback.then && 'function' !== typeof readback.done) {
        render_review(submitted_review);
        set_status(i18n.readback_error || '', true, 'error');
        return;
      }
      window.jQuery.when(readback).done(function (booking) {
        if (current_generation === apply_generation && booking && Number(booking.booking_id || 0) === Number(pending_apply_result.booking_id || 0)) {
          pending_apply_result = null;
          dirty = false;
          close(true, true);
        }
      }).fail(function (error) {
        if (current_generation === apply_generation && layer) {
          render_review(submitted_review);
          set_status(error && error.message ? error.message : i18n.readback_error || '', true, 'error');
        }
      });
    }

    /** @return {void} Apply only the currently displayed signed plan. */
    function request_apply() {
      var submitted_review = active_review;
      var current_generation;
      var pending_request;
      if (pending_apply_result) {
        request_readback(submitted_review);
        return;
      }
      if (!submitted_review || !submitted_review.plan || !submitted_review.token) {
        set_status(i18n.apply_error || '', true, 'error');
        return;
      }
      apply_generation += 1;
      current_generation = apply_generation;
      show_loading(i18n.applying || '');
      pending_request = window.jQuery.ajax({
        url: controller_options.url,
        method: 'POST',
        dataType: 'json',
        data: {
          action: settings.apply.action,
          nonce: settings.apply.nonce,
          booking_id: active_dto.booking_id,
          source: controller_options.source,
          plan: JSON.stringify(submitted_review.plan),
          token: submitted_review.token,
          send_modified_email: 'function' === typeof controller_options.get_send_modified_email_intent && controller_options.get_send_modified_email_intent() ? 1 : 0
        }
      }).done(function (response) {
        if (current_generation !== apply_generation) {
          return;
        }
        if (!response || !response.success || !response.data || !normalize_id(response.data.booking_id) || !response.data.host_refresh) {
          render_review(submitted_review);
          set_status(i18n.apply_error || '', true, 'error');
          return;
        }
        pending_apply_result = response.data;
        request_readback(submitted_review);
      }).fail(function (failed_request, request_status) {
        var error = failed_request.responseJSON && failed_request.responseJSON.data ? failed_request.responseJSON.data : {};
        if ('abort' !== request_status && current_generation === apply_generation && layer) {
          render_review(submitted_review);
          set_status(error.message || i18n.apply_error || '', true, 'error');
        }
      }).always(function () {
        if (apply_request === pending_request) {
          apply_request = null;
        }
      });
      apply_request = pending_request;
    }

    /**
     * Open for one Inspector-authorized booking.
     *
     * @param {HTMLElement} trigger         Activating control.
     * @param {Object}      booking_context Authorized booking identity.
     * @return {boolean} True when opening began.
     */
    function open(trigger, booking_context) {
      var booking_id = booking_context ? normalize_id(booking_context.booking_id) : 0;
      if (!booking_id || !close(false, false)) {
        return false;
      }
      opener = trigger;
      active_dto = {
        booking_id: booking_id
      };
      render_layer({
        i18n: i18n
      });
      show_loading(i18n.loading || '');
      window.requestAnimationFrame(function () {
        if (layer) {
          layer.focus();
        }
      });
      request_read(0, null);
      return true;
    }

    /**
     * Handle dialog actions.
     *
     * @param {MouseEvent} event Click event.
     * @return {void}
     */
    function handle_click(event) {
      if (!layer || !layer.contains(event.target)) {
        return;
      }
      if (event.target.closest('[data-wpbc-booking-rescheduling-close]')) {
        event.preventDefault();
        close(true, false);
      } else if (event.target.closest('[data-wpbc-booking-rescheduling-retry]')) {
        event.preventDefault();
        request_read(draft ? draft.target_resource_id : 0, retry_draft || draft);
      } else if (event.target.closest('[data-wpbc-booking-rescheduling-reset]') && saved_draft) {
        event.preventDefault();
        draft = clone_draft(saved_draft);
        active_review = null;
        request_read(draft.target_resource_id, draft);
      } else if (event.target.closest('[data-wpbc-booking-rescheduling-review]')) {
        event.preventDefault();
        request_review();
      } else if (event.target.closest('[data-wpbc-booking-rescheduling-back]')) {
        event.preventDefault();
        active_review = null;
        layer.querySelector('[data-wpbc-booking-rescheduling-view="review"]').hidden = true;
        layer.querySelector('[data-wpbc-booking-rescheduling-view="editor"]').hidden = false;
        layer.querySelector('[data-wpbc-booking-rescheduling-review]').focus();
      } else if (event.target.closest('[data-wpbc-booking-rescheduling-apply]')) {
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
    function handle_change(event) {
      var resource_control;
      var selection_control;
      var time_application_control;
      var time_control;
      var requested_mode;
      if (!layer || !layer.contains(event.target) || !draft) {
        return;
      }
      resource_control = event.target.closest('[data-wpbc-booking-rescheduling-resource]');
      selection_control = event.target.closest('[data-wpbc-booking-rescheduling-selection-method]');
      time_application_control = event.target.closest('[data-wpbc-booking-rescheduling-time-application]');
      time_control = event.target.closest('[data-wpbc-booking-rescheduling-time]');
      if (resource_control) {
        draft.target_resource_id = normalize_id(resource_control.value);
        draft.proposal_revision += 1;
        update_dirty();
        request_read(draft.target_resource_id, draft);
        return;
      }
      if (selection_control) {
        requested_mode = MODE_INDIVIDUAL === selection_control.value ? MODE_INDIVIDUAL : MODE_POLICY;
        if (native_adapter && !native_adapter.set_selection_mode(requested_mode)) {
          set_status(i18n.hydration_warning || '', true, 'warning');
          return;
        }
        draft.selection_method = requested_mode;
        draft.selected_dates = native_adapter ? native_adapter.get_selected_dates() : draft.selected_dates;
      } else if (time_application_control) {
        draft.time_application = -1 !== [TIME_FULL_DAY, TIME_BOUNDARY, TIME_PER_DATE].indexOf(time_application_control.value) ? time_application_control.value : TIME_FULL_DAY;
      } else if (time_control) {
        draft[time_control.getAttribute('data-wpbc-booking-rescheduling-time')] = normalize_time(time_control.value);
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
    function handle_keydown(event) {
      var focusable;
      var first;
      var last;
      if (!layer) {
        return;
      }
      if ('Escape' === event.key) {
        event.preventDefault();
        event.stopImmediatePropagation();
        close(true, false);
        return;
      }
      if ('Tab' !== event.key) {
        return;
      }
      focusable = Array.prototype.filter.call(layer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'), function (control) {
        return !control.hidden && null !== control.offsetParent;
      });
      if (!focusable.length) {
        event.preventDefault();
        layer.focus();
        return;
      }
      first = focusable[0];
      last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    inspector_shell.addEventListener('click', handle_click);
    inspector_shell.addEventListener('change', handle_change);
    inspector_shell.addEventListener('input', handle_change);
    inspector_shell.addEventListener('keydown', handle_keydown, true);
    return {
      open: open,
      is_open: function () {
        return Boolean(layer);
      },
      is_dirty: function () {
        return dirty;
      },
      is_busy: function () {
        return Boolean(apply_request || pending_apply_result);
      },
      confirm_discard: function () {
        if (apply_request || pending_apply_result) {
          set_status(pending_apply_result ? i18n.readback_error || '' : i18n.applying || '', true, pending_apply_result ? 'error' : 'warning');
          return false;
        }
        return !dirty || window.confirm(i18n.discard_changes || '');
      },
      prepare_for_parent_switch: function () {
        return close(false, false);
      },
      force_close: function () {
        close(false, true);
      },
      destroy: function () {
        close(false, true);
        inspector_shell.removeEventListener('click', handle_click);
        inspector_shell.removeEventListener('change', handle_change);
        inspector_shell.removeEventListener('input', handle_change);
        inspector_shell.removeEventListener('keydown', handle_keydown, true);
      }
    };
  }
  window.wpbc_booking_rescheduling = window.wpbc_booking_rescheduling || {};
  window.wpbc_booking_rescheduling.create_controller = create_controller;
})(window, document, jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1yZXNjaGVkdWxpbmcvX291dC9ib29raW5nLXJlc2NoZWR1bGluZy5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwiJCIsIkVWRU5UX05BTUVTUEFDRSIsIk5BVElWRV9MT0FEX1RJTUVPVVRfTVMiLCJNT0RFX1BPTElDWSIsIk1PREVfSU5ESVZJRFVBTCIsIlRJTUVfRlVMTF9EQVkiLCJUSU1FX0JPVU5EQVJZIiwiVElNRV9QRVJfREFURSIsIm5vcm1hbGl6ZV9pZCIsImNhbmRpZGF0ZSIsIm5vcm1hbGl6ZWQiLCJOdW1iZXIiLCJpc0ludGVnZXIiLCJub3JtYWxpemVfdGltZSIsIlN0cmluZyIsInRyaW0iLCJ0ZXN0Iiwibm9ybWFsaXplX2RhdGVzIiwiY2FuZGlkYXRlcyIsInVuaXF1ZV9kYXRlcyIsIkFycmF5IiwiaXNBcnJheSIsImZvckVhY2giLCJkYXRlX3ZhbHVlIiwiZGF0ZV9wYXJ0cyIsImV4ZWMiLCJ0ZXN0X2RhdGUiLCJEYXRlIiwiVVRDIiwiZ2V0VVRDRnVsbFllYXIiLCJnZXRVVENNb250aCIsImdldFVUQ0RhdGUiLCJPYmplY3QiLCJrZXlzIiwic29ydCIsImNsb25lX2RyYWZ0IiwidGFyZ2V0X3Jlc291cmNlX2lkIiwic2VsZWN0aW9uX21ldGhvZCIsInRpbWVfYXBwbGljYXRpb24iLCJpbmRleE9mIiwic3RhcnRfdGltZSIsImVuZF90aW1lIiwic2VsZWN0ZWRfZGF0ZXMiLCJwcm9wb3NhbF9yZXZpc2lvbiIsIk1hdGgiLCJtYXgiLCJmcmVlemVfZHJhZnQiLCJmcm96ZW4iLCJmcmVlemUiLCJjb21wYXJlX2RyYWZ0IiwiYWRkX2RheXMiLCJpc29fZGF0ZSIsImRheV9jb3VudCIsInBhcnRzIiwic2hpZnRlZCIsInBhZFN0YXJ0IiwiZm9ybWF0X29mZnNldCIsIm9mZnNldF9taW51dGVzIiwic2lnbiIsImFic29sdXRlIiwiYWJzIiwiZmxvb3IiLCJnZXRfem9uZWRfcGFydHMiLCJ0aW1lc3RhbXBfbXMiLCJ0aW1lem9uZV9uYW1lIiwiZm9ybWF0dGVyIiwicmVzdWx0IiwiSW50bCIsIkRhdGVUaW1lRm9ybWF0IiwidGltZVpvbmUiLCJ5ZWFyIiwibW9udGgiLCJkYXkiLCJob3VyIiwibWludXRlIiwiaG91ckN5Y2xlIiwiZm9ybWF0VG9QYXJ0cyIsInRpbWV6b25lX2Vycm9yIiwicGFydCIsInR5cGUiLCJ2YWx1ZSIsImxlbmd0aCIsIndhbGxfdGltZV90b19yZmMzMzM5IiwiZXhhY3RfdGltZSIsIm1hdGNoIiwidGltZV9tYXRjaCIsImZpeGVkX29mZnNldCIsIndhbGxfdGltZXN0YW1wIiwib2Zmc2V0cyIsIm1hdGNoZXMiLCJkZWx0YSIsInpvbmVkX3BhcnRzIiwiem9uZWRfYXNfdXRjIiwicm91bmQiLCJvZmZzZXRfa2V5IiwiY2FuZGlkYXRlX3RpbWVzdGFtcCIsImNhbmRpZGF0ZV9wYXJ0cyIsInB1c2giLCJjcmVhdGVfY29udHJvbGxlciIsImluc3BlY3Rvcl9zaGVsbCIsImNvbmZpZ3VyYXRpb24iLCJvcHRpb25zIiwic2V0dGluZ3MiLCJjb250cm9sbGVyX29wdGlvbnMiLCJ0ZW1wbGF0ZXMiLCJpMThuIiwiZGlhbG9nX3RlbXBsYXRlIiwid3AiLCJkaWFsb2ciLCJ0ZW1wbGF0ZSIsInJldmlld190ZW1wbGF0ZSIsInJldmlldyIsImluc3BlY3Rvcl9wYW5lbCIsInF1ZXJ5U2VsZWN0b3IiLCJsYXllciIsIm9wZW5lciIsImFjdGl2ZV9kdG8iLCJzYXZlZF9kcmFmdCIsImRyYWZ0IiwicmV0cnlfZHJhZnQiLCJhY3RpdmVfcmV2aWV3IiwicGVuZGluZ19hcHBseV9yZXN1bHQiLCJuYXRpdmVfYWRhcHRlciIsInJlYWRfcmVxdWVzdCIsInJldmlld19yZXF1ZXN0IiwiYXBwbHlfcmVxdWVzdCIsImdlbmVyYXRpb24iLCJyZXZpZXdfZ2VuZXJhdGlvbiIsImFwcGx5X2dlbmVyYXRpb24iLCJuYXRpdmVfdGltZW91dCIsImRpcnR5IiwiYWN0aXZlIiwialF1ZXJ5Iiwid3BiY19ib29raW5nX2RhdGVfZWRpdG9yIiwiY3JlYXRlX25hdGl2ZV9jYWxlbmRhcl9hZGFwdGVyIiwiY2xlYXJfbmF0aXZlX3RpbWVvdXQiLCJjbGVhclRpbWVvdXQiLCJ1cGRhdGVfZGlydHkiLCJuZXh0X2RpcnR5IiwiQm9vbGVhbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJvbl9kaXJ0eV9jaGFuZ2UiLCJzZXRfc3RhdHVzIiwibWVzc2FnZSIsInZpc2libGUiLCJzZXZlcml0eSIsInN0YXR1cyIsInRleHRDb250ZW50IiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwic2V0QXR0cmlidXRlIiwic2hvd19sb2FkaW5nIiwibG9hZGluZyIsImxhYmVsIiwiZXJyb3IiLCJlZGl0b3IiLCJoaWRkZW4iLCJzaG93X2Vycm9yIiwiZXJyb3JfbWVzc2FnZSIsImxvYWRfZXJyb3IiLCJnZXRfcmVzdG9yZV9mb2N1cyIsImZhbGxiYWNrIiwiaXNDb25uZWN0ZWQiLCJ0ZWFyZG93biIsInBlbmRpbmdfcmVxdWVzdCIsImFib3J0Iiwib2ZmIiwicmVtb3ZlIiwiY2xvc2UiLCJyZXN0b3JlX2ZvY3VzIiwiZm9yY2UiLCJmb2N1c190YXJnZXQiLCJyZWFkYmFja19lcnJvciIsImFwcGx5aW5nIiwiY29uZmlybSIsImRpc2NhcmRfY2hhbmdlcyIsInNldFRpbWVvdXQiLCJmb2N1cyIsInJlbmRlcl9sYXllciIsInRlbXBsYXRlX3ZhbHVlcyIsImhvc3QiLCJjcmVhdGVFbGVtZW50IiwicmVuZGVyZWQiLCJpbm5lckhUTUwiLCJhc3NpZ24iLCJpbnNwZWN0b3JfaWQiLCJyZXNvdXJjZXMiLCJhcHBlbmRDaGlsZCIsInJlbmRlcl9kcmFmdCIsInNlbGVjdGVkX2xpc3QiLCJ0aW1lX2ZpZWxkcyIsInJldmlld19idXR0b24iLCJyZXZpZXdhYmxlIiwiZW1wdHlfaXRlbSIsImNsYXNzTmFtZSIsIm5vX3NlbGVjdGVkX2RhdGVzIiwic2VsZWN0ZWRfZGF0ZSIsImRhdGVfaXRlbSIsImRpc2FibGVkIiwic2hvd19yZWFkeSIsIndhcm5pbmciLCJoeWRyYXRlX2RhdGVzIiwiY3VycmVudF9nZW5lcmF0aW9uIiwiYXR0ZW1wdCIsInJlc3RvcmVkIiwic2V0X2V4YWN0X3NlbGVjdGVkX2RhdGVzIiwiZ2V0X3NlbGVjdGVkX2RhdGVzIiwibG9hZGVkIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwic2V0X3NlbGVjdGlvbl9tb2RlIiwic2xpY2UiLCJwcm90b3R5cGUiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsImNvbnRyb2wiLCJjaGVja2VkIiwiaHlkcmF0aW9uX3dhcm5pbmciLCJtb3VudF9jYWxlbmRhciIsImNhbGVuZGFyIiwiY2FsZW5kYXJfaG9zdCIsIm1vdW50IiwicmVzb3VyY2VfaWQiLCJjYWxlbmRhcl9odG1sIiwiaHRtbCIsImNhbGVuZGFyX3BhcmFtZXRlcnMiLCJwb2xpY3lfcGFyYW1ldGVycyIsImNvbnRleHRfcGFyYW1ldGVycyIsInNlY3VyZV9wYXJhbWV0ZXJzIiwiY2FsZW5kYXJfZXJyb3IiLCJvbiIsImV2ZW50IiwiY2xpY2tlZF9kYXRlcyIsImxvYWRpbmdfY2FsZW5kYXIiLCJhYm9ydF9sb2FkIiwibG9hZCIsInJlcXVlc3RfcGFyYW1ldGVycyIsImluaXRpYWxpemUiLCJkaWFsb2dfZHRvIiwicHJlc2VydmVkX2RyYWZ0IiwiaW5pdGlhbCIsInN1cHBvcnRlZCIsInVuc3VwcG9ydGVkIiwiY2hvaWNlcyIsInJlcXVlc3RfcmVhZCIsImJvb2tpbmdfaWQiLCJ1cmwiLCJzb3VyY2UiLCJyZWFkIiwiYWN0aW9uIiwibm9uY2UiLCJhamF4IiwibWV0aG9kIiwiZGF0YVR5cGUiLCJkYXRhIiwic291cmNlX2NvbnRleHRfdG9rZW4iLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwicmVzY2hlZHVsaW5nIiwiZmFpbCIsImZhaWxlZF9yZXF1ZXN0IiwicmVxdWVzdF9zdGF0dXMiLCJyZXNwb25zZUpTT04iLCJhbHdheXMiLCJidWlsZF9wcm9wb3NhbCIsInRpbWV6b25lIiwibmFtZSIsInByb3Bvc2FsIiwiZmlyc3RfZGF0ZSIsImxhc3RfZGF0ZSIsImludGVydmFscyIsInNjaGVtYV92ZXJzaW9uIiwiaW50ZXJhY3Rpb25fc291cmNlIiwib3BlcmF0aW9uIiwiY3VycmVudF9yZXNvdXJjZV9pZCIsInByb3Bvc2VkX2RhdGVzIiwic3RhcnQiLCJlbmQiLCJtYXAiLCJlbmRfZGF0ZSIsInNvbWUiLCJpbnRlcnZhbCIsInByb3Bvc2VkX2ludGVydmFscyIsInJlbmRlcl9yZXZpZXciLCJjb250ZW50IiwiYXBwbHlfYnV0dG9uIiwiYmFja19idXR0b24iLCJoZWFkaW5nIiwicGxhbiIsInRva2VuIiwiZXhwaXJlc19hdCIsInJldmlld19lcnJvciIsInJldHJ5X3JlZnJlc2giLCJyZXRyeSIsImFwcGx5X2NoYW5nZXMiLCJyZXF1ZXN0X3JldmlldyIsImxvYWRpbmdfcmV2aWV3IiwicmVxdWVzdF9yZWFkYmFjayIsInN1Ym1pdHRlZF9yZXZpZXciLCJyZWFkYmFjayIsIm9uX2FwcGxpZWQiLCJyZWZyZXNoaW5nIiwidGhlbiIsIndoZW4iLCJib29raW5nIiwicmVxdWVzdF9hcHBseSIsImFwcGx5X2Vycm9yIiwiYXBwbHkiLCJzZW5kX21vZGlmaWVkX2VtYWlsIiwiZ2V0X3NlbmRfbW9kaWZpZWRfZW1haWxfaW50ZW50IiwiaG9zdF9yZWZyZXNoIiwib3BlbiIsInRyaWdnZXIiLCJib29raW5nX2NvbnRleHQiLCJoYW5kbGVfY2xpY2siLCJjb250YWlucyIsInRhcmdldCIsImNsb3Nlc3QiLCJwcmV2ZW50RGVmYXVsdCIsImhhbmRsZV9jaGFuZ2UiLCJyZXNvdXJjZV9jb250cm9sIiwic2VsZWN0aW9uX2NvbnRyb2wiLCJ0aW1lX2FwcGxpY2F0aW9uX2NvbnRyb2wiLCJ0aW1lX2NvbnRyb2wiLCJyZXF1ZXN0ZWRfbW9kZSIsImdldEF0dHJpYnV0ZSIsImhhbmRsZV9rZXlkb3duIiwiZm9jdXNhYmxlIiwiZmlyc3QiLCJsYXN0Iiwia2V5Iiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwiZmlsdGVyIiwib2Zmc2V0UGFyZW50Iiwic2hpZnRLZXkiLCJhY3RpdmVFbGVtZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsImlzX29wZW4iLCJpc19kaXJ0eSIsImlzX2J1c3kiLCJjb25maXJtX2Rpc2NhcmQiLCJwcmVwYXJlX2Zvcl9wYXJlbnRfc3dpdGNoIiwiZm9yY2VfY2xvc2UiLCJkZXN0cm95IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIndwYmNfYm9va2luZ19yZXNjaGVkdWxpbmciXSwic291cmNlcyI6WyJpbmNsdWRlcy9ib29raW5nLXJlc2NoZWR1bGluZy9fc3JjL2Jvb2tpbmctcmVzY2hlZHVsaW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWNjZXNzaWJsZSBCb29raW5nIFJlc2NoZWR1bGluZyBkaWFsb2cgYWRhcHRlci5cbiAqXG4gKiBUaGlzIGFkYXB0ZXIgb3ducyBsb2NhbCBkcmFmdCwgZGlhbG9nLCByZXZpZXcsIHJlcXVlc3QtY2FuY2VsbGF0aW9uLCBhbmRcbiAqIGZvY3VzIGJlaGF2aW9yLiBJdCBkZWxpYmVyYXRlbHkgZGVsZWdhdGVzIGV2ZXJ5IG5hdGl2ZSBjYWxlbmRhciBnbG9iYWwgYW5kXG4gKiB0aGUgc3RhbmRhcmQgY2FsZW5kYXIgQUpBWCByZXF1ZXN0IHRvIHRoZSBEYXRlIEVkaXRvcidzIGV4cG9ydGVkIGFkYXB0ZXIuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICogQHNpbmNlICAgMTIuMC4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50LCAkICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIEVWRU5UX05BTUVTUEFDRSA9ICcud3BiY0Jvb2tpbmdSZXNjaGVkdWxpbmcnO1xuXHR2YXIgTkFUSVZFX0xPQURfVElNRU9VVF9NUyA9IDMwMDAwO1xuXHR2YXIgTU9ERV9QT0xJQ1kgPSAncG9saWN5Jztcblx0dmFyIE1PREVfSU5ESVZJRFVBTCA9ICdpbmRpdmlkdWFsJztcblx0dmFyIFRJTUVfRlVMTF9EQVkgPSAnZnVsbF9kYXknO1xuXHR2YXIgVElNRV9CT1VOREFSWSA9ICdib3VuZGFyeSc7XG5cdHZhciBUSU1FX1BFUl9EQVRFID0gJ3Blcl9kYXRlJztcblxuXHQvKipcblx0ICogUmV0dXJuIGEgcG9zaXRpdmUgaW50ZWdlciBvciB6ZXJvLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGNhbmRpZGF0ZSBDYW5kaWRhdGUgaWRlbnRpZmllci5cblx0ICogQHJldHVybiB7bnVtYmVyfSBQb3NpdGl2ZSBpbnRlZ2VyIG9yIHplcm8uXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfaWQoIGNhbmRpZGF0ZSApIHtcblx0XHR2YXIgbm9ybWFsaXplZCA9IE51bWJlciggY2FuZGlkYXRlICk7XG5cblx0XHRyZXR1cm4gTnVtYmVyLmlzSW50ZWdlciggbm9ybWFsaXplZCApICYmIG5vcm1hbGl6ZWQgPiAwID8gbm9ybWFsaXplZCA6IDA7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIG9uZSBleGFjdC1taW51dGUgdGltZS5cblx0ICpcblx0ICogQHBhcmFtIHsqfSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHRpbWUuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gYEhIOk1NYCBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfdGltZSggY2FuZGlkYXRlICkge1xuXHRcdHZhciBub3JtYWxpemVkID0gU3RyaW5nKCBjYW5kaWRhdGUgfHwgJycgKS50cmltKCk7XG5cblx0XHRyZXR1cm4gL14oPzpbMDFdXFxkfDJbMC0zXSk6WzAtNV1cXGQkLy50ZXN0KCBub3JtYWxpemVkICkgPyBub3JtYWxpemVkIDogJyc7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHN0cmljdCBJU08gZGF0ZXMgd2l0aG91dCBhcHBseWluZyB0aW1lem9uZSBjb252ZXJzaW9uLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGNhbmRpZGF0ZXMgQ2FuZGlkYXRlIGRhdGUgY29sbGVjdGlvbi5cblx0ICogQHJldHVybiB7QXJyYXk8c3RyaW5nPn0gT3JkZXJlZCB1bmlxdWUgdmFsaWQgZGF0ZXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfZGF0ZXMoIGNhbmRpZGF0ZXMgKSB7XG5cdFx0dmFyIHVuaXF1ZV9kYXRlcyA9IHt9O1xuXG5cdFx0KCBBcnJheS5pc0FycmF5KCBjYW5kaWRhdGVzICkgPyBjYW5kaWRhdGVzIDogW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZSApIHtcblx0XHRcdHZhciBkYXRlX3ZhbHVlID0gU3RyaW5nKCBjYW5kaWRhdGUgfHwgJycgKTtcblx0XHRcdHZhciBkYXRlX3BhcnRzID0gL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvLmV4ZWMoIGRhdGVfdmFsdWUgKTtcblx0XHRcdHZhciB0ZXN0X2RhdGU7XG5cblx0XHRcdGlmICggISBkYXRlX3BhcnRzICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0ZXN0X2RhdGUgPSBuZXcgRGF0ZSggRGF0ZS5VVEMoIE51bWJlciggZGF0ZV9wYXJ0c1sgMSBdICksIE51bWJlciggZGF0ZV9wYXJ0c1sgMiBdICkgLSAxLCBOdW1iZXIoIGRhdGVfcGFydHNbIDMgXSApICkgKTtcblx0XHRcdGlmIChcblx0XHRcdFx0dGVzdF9kYXRlLmdldFVUQ0Z1bGxZZWFyKCkgPT09IE51bWJlciggZGF0ZV9wYXJ0c1sgMSBdICkgJiZcblx0XHRcdFx0dGVzdF9kYXRlLmdldFVUQ01vbnRoKCkgPT09IE51bWJlciggZGF0ZV9wYXJ0c1sgMiBdICkgLSAxICYmXG5cdFx0XHRcdHRlc3RfZGF0ZS5nZXRVVENEYXRlKCkgPT09IE51bWJlciggZGF0ZV9wYXJ0c1sgMyBdIClcblx0XHRcdCkge1xuXHRcdFx0XHR1bmlxdWVfZGF0ZXNbIGRhdGVfdmFsdWUgXSA9IGRhdGVfdmFsdWU7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKCB1bmlxdWVfZGF0ZXMgKS5zb3J0KCk7XG5cdH1cblxuXHQvKipcblx0ICogQ2xvbmUgdGhlIGV4ZWN1dGFibGUtZnJlZSBsb2NhbCBwcm9wb3NhbCBkcmFmdC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNhbmRpZGF0ZSBDYW5kaWRhdGUgZHJhZnQuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gSW5kZXBlbmRlbnQgbm9ybWFsaXplZCBkcmFmdC5cblx0ICovXG5cdGZ1bmN0aW9uIGNsb25lX2RyYWZ0KCBjYW5kaWRhdGUgKSB7XG5cdFx0Y2FuZGlkYXRlID0gY2FuZGlkYXRlICYmICdvYmplY3QnID09PSB0eXBlb2YgY2FuZGlkYXRlID8gY2FuZGlkYXRlIDoge307XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dGFyZ2V0X3Jlc291cmNlX2lkOiBub3JtYWxpemVfaWQoIGNhbmRpZGF0ZS50YXJnZXRfcmVzb3VyY2VfaWQgKSxcblx0XHRcdHNlbGVjdGlvbl9tZXRob2Q6IE1PREVfSU5ESVZJRFVBTCA9PT0gY2FuZGlkYXRlLnNlbGVjdGlvbl9tZXRob2QgPyBNT0RFX0lORElWSURVQUwgOiBNT0RFX1BPTElDWSxcblx0XHRcdHRpbWVfYXBwbGljYXRpb246IC0xICE9PSBbIFRJTUVfRlVMTF9EQVksIFRJTUVfQk9VTkRBUlksIFRJTUVfUEVSX0RBVEUgXS5pbmRleE9mKCBjYW5kaWRhdGUudGltZV9hcHBsaWNhdGlvbiApID8gY2FuZGlkYXRlLnRpbWVfYXBwbGljYXRpb24gOiBUSU1FX0ZVTExfREFZLFxuXHRcdFx0c3RhcnRfdGltZTogbm9ybWFsaXplX3RpbWUoIGNhbmRpZGF0ZS5zdGFydF90aW1lICksXG5cdFx0XHRlbmRfdGltZTogbm9ybWFsaXplX3RpbWUoIGNhbmRpZGF0ZS5lbmRfdGltZSApLFxuXHRcdFx0c2VsZWN0ZWRfZGF0ZXM6IG5vcm1hbGl6ZV9kYXRlcyggY2FuZGlkYXRlLnNlbGVjdGVkX2RhdGVzICksXG5cdFx0XHRwcm9wb3NhbF9yZXZpc2lvbjogTWF0aC5tYXgoIDEsIG5vcm1hbGl6ZV9pZCggY2FuZGlkYXRlLnByb3Bvc2FsX3JldmlzaW9uICkgKVxuXHRcdH07XG5cdH1cblxuXHQvKipcblx0ICogRnJlZXplIHRoZSBpbW11dGFibGUgc2F2ZWQgcHJvcG9zYWwgc3RhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjYW5kaWRhdGUgQ2FuZGlkYXRlIHNlcnZlciBpbml0aWFsIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IEZyb3plbiBub3JtYWxpemVkIGRyYWZ0LlxuXHQgKi9cblx0ZnVuY3Rpb24gZnJlZXplX2RyYWZ0KCBjYW5kaWRhdGUgKSB7XG5cdFx0dmFyIGZyb3plbiA9IGNsb25lX2RyYWZ0KCBjYW5kaWRhdGUgKTtcblxuXHRcdE9iamVjdC5mcmVlemUoIGZyb3plbi5zZWxlY3RlZF9kYXRlcyApO1xuXG5cdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoIGZyb3plbiApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgbWVhbmluZ2Z1bCBjb21wYXJpc29uIHByb2plY3Rpb24gZm9yIGRpcnR5LXN0YXRlIGNoZWNrcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNhbmRpZGF0ZSBOb3JtYWxpemVkIGRyYWZ0LlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IFN0YWJsZSBjb21wYXJpc29uIHJlY29yZC5cblx0ICovXG5cdGZ1bmN0aW9uIGNvbXBhcmVfZHJhZnQoIGNhbmRpZGF0ZSApIHtcblx0XHR2YXIgbm9ybWFsaXplZCA9IGNsb25lX2RyYWZ0KCBjYW5kaWRhdGUgKTtcblxuXHRcdGRlbGV0ZSBub3JtYWxpemVkLnByb3Bvc2FsX3JldmlzaW9uO1xuXHRcdGlmICggVElNRV9GVUxMX0RBWSA9PT0gbm9ybWFsaXplZC50aW1lX2FwcGxpY2F0aW9uICkge1xuXHRcdFx0bm9ybWFsaXplZC5zdGFydF90aW1lID0gJyc7XG5cdFx0XHRub3JtYWxpemVkLmVuZF90aW1lID0gJyc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWQ7XG5cdH1cblxuXHQvKipcblx0ICogQWRkIGNhbGVuZGFyIGRheXMgdG8gb25lIHN0cmljdCBJU08gZGF0ZSB3aXRob3V0IGxvY2FsLXRpbWUgY29udmVyc2lvbi5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGlzb19kYXRlIFN0cmljdCBJU08gZGF0ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGRheV9jb3VudCBTaWduZWQgbnVtYmVyIG9mIGRheXMuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU2hpZnRlZCBJU08gZGF0ZSBvciBhbiBlbXB0eSBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGRfZGF5cyggaXNvX2RhdGUsIGRheV9jb3VudCApIHtcblx0XHR2YXIgcGFydHMgPSAvXihcXGR7NH0pLShcXGR7Mn0pLShcXGR7Mn0pJC8uZXhlYyggaXNvX2RhdGUgKTtcblx0XHR2YXIgc2hpZnRlZDtcblxuXHRcdGlmICggISBwYXJ0cyApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0c2hpZnRlZCA9IG5ldyBEYXRlKCBEYXRlLlVUQyggTnVtYmVyKCBwYXJ0c1sgMSBdICksIE51bWJlciggcGFydHNbIDIgXSApIC0gMSwgTnVtYmVyKCBwYXJ0c1sgMyBdICkgKyBkYXlfY291bnQgKSApO1xuXG5cdFx0cmV0dXJuIHNoaWZ0ZWQuZ2V0VVRDRnVsbFllYXIoKSArICctJyArIFN0cmluZyggc2hpZnRlZC5nZXRVVENNb250aCgpICsgMSApLnBhZFN0YXJ0KCAyLCAnMCcgKSArICctJyArIFN0cmluZyggc2hpZnRlZC5nZXRVVENEYXRlKCkgKS5wYWRTdGFydCggMiwgJzAnICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydCBhbiBvZmZzZXQgaW4gbWludXRlcyB0byBhbiBSRkMzMzM5IHN1ZmZpeC5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IG9mZnNldF9taW51dGVzIE1pbnV0ZXMgZWFzdCBvZiBVVEMuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU2lnbmVkIGBISDpNTWAgb2Zmc2V0LlxuXHQgKi9cblx0ZnVuY3Rpb24gZm9ybWF0X29mZnNldCggb2Zmc2V0X21pbnV0ZXMgKSB7XG5cdFx0dmFyIHNpZ24gPSBvZmZzZXRfbWludXRlcyA8IDAgPyAnLScgOiAnKyc7XG5cdFx0dmFyIGFic29sdXRlID0gTWF0aC5hYnMoIG9mZnNldF9taW51dGVzICk7XG5cblx0XHRyZXR1cm4gc2lnbiArIFN0cmluZyggTWF0aC5mbG9vciggYWJzb2x1dGUgLyA2MCApICkucGFkU3RhcnQoIDIsICcwJyApICsgJzonICsgU3RyaW5nKCBhYnNvbHV0ZSAlIDYwICkucGFkU3RhcnQoIDIsICcwJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlYWQgd2FsbC1jbG9jayBwYXJ0cyBmb3Igb25lIGluc3RhbnQgaW4gYW4gSUFOQSB0aW1lem9uZS5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IHRpbWVzdGFtcF9tcyBVVEMgdGltZXN0YW1wIGluIG1pbGxpc2Vjb25kcy5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRpbWV6b25lX25hbWUgSUFOQSB0aW1lem9uZSBuYW1lLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTnVtZXJpYyB3YWxsIHBhcnRzIG9yIG51bGwgd2hlbiB1bnN1cHBvcnRlZC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF96b25lZF9wYXJ0cyggdGltZXN0YW1wX21zLCB0aW1lem9uZV9uYW1lICkge1xuXHRcdHZhciBmb3JtYXR0ZXI7XG5cdFx0dmFyIHBhcnRzO1xuXHRcdHZhciByZXN1bHQgPSB7fTtcblxuXHRcdHRyeSB7XG5cdFx0XHRmb3JtYXR0ZXIgPSBuZXcgSW50bC5EYXRlVGltZUZvcm1hdCggJ2VuLUNBJywge1xuXHRcdFx0XHR0aW1lWm9uZTogdGltZXpvbmVfbmFtZSxcblx0XHRcdFx0eWVhcjogJ251bWVyaWMnLFxuXHRcdFx0XHRtb250aDogJzItZGlnaXQnLFxuXHRcdFx0XHRkYXk6ICcyLWRpZ2l0Jyxcblx0XHRcdFx0aG91cjogJzItZGlnaXQnLFxuXHRcdFx0XHRtaW51dGU6ICcyLWRpZ2l0Jyxcblx0XHRcdFx0aG91ckN5Y2xlOiAnaDIzJ1xuXHRcdFx0fSApO1xuXHRcdFx0cGFydHMgPSBmb3JtYXR0ZXIuZm9ybWF0VG9QYXJ0cyggbmV3IERhdGUoIHRpbWVzdGFtcF9tcyApICk7XG5cdFx0fSBjYXRjaCAoIHRpbWV6b25lX2Vycm9yICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHBhcnRzLmZvckVhY2goIGZ1bmN0aW9uICggcGFydCApIHtcblx0XHRcdGlmICggLTEgIT09IFsgJ3llYXInLCAnbW9udGgnLCAnZGF5JywgJ2hvdXInLCAnbWludXRlJyBdLmluZGV4T2YoIHBhcnQudHlwZSApICkge1xuXHRcdFx0XHRyZXN1bHRbIHBhcnQudHlwZSBdID0gTnVtYmVyKCBwYXJ0LnZhbHVlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIDUgPT09IE9iamVjdC5rZXlzKCByZXN1bHQgKS5sZW5ndGggPyByZXN1bHQgOiBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc29sdmUgb25lIHNpdGUtbG9jYWwgZXhhY3QgbWludXRlIHRvIGFuIHVuYW1iaWd1b3VzIFJGQzMzMzkgaW5zdGFudC5cblx0ICpcblx0ICogQ2FuZGlkYXRlIG9mZnNldHMgYXJlIGRlcml2ZWQgZnJvbSB0aGUgc2l0ZSB0aW1lem9uZSBhcm91bmQgdGhlIHdhbGwgdGltZS5cblx0ICogWmVybyBtYXRjaGVzIHJlamVjdHMgYSBub25leGlzdGVudCBEU1QgbWludXRlOyBtdWx0aXBsZSBtYXRjaGVzIHJlamVjdHMgYW5cblx0ICogYW1iaWd1b3VzIHJlcGVhdGVkIG1pbnV0ZSByYXRoZXIgdGhhbiBzaWxlbnRseSBjaG9vc2luZyBhIGZvbGQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBpc29fZGF0ZSAgICAgIFN0cmljdCBsb2NhbCBzaXRlIGRhdGUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBleGFjdF90aW1lICAgIFN0cmljdCBleGFjdC1taW51dGUgdGltZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRpbWV6b25lX25hbWUgV29yZFByZXNzIHNpdGUgdGltZXpvbmUgbmFtZSBvciBmaXhlZCBvZmZzZXQuXG5cdCAqIEByZXR1cm4ge3N0cmluZ3xudWxsfSBSRkMzMzM5IGluc3RhbnQgb3IgbnVsbCB3aGVuIGludmFsaWQvYW1iaWd1b3VzLlxuXHQgKi9cblx0ZnVuY3Rpb24gd2FsbF90aW1lX3RvX3JmYzMzMzkoIGlzb19kYXRlLCBleGFjdF90aW1lLCB0aW1lem9uZV9uYW1lICkge1xuXHRcdHZhciBtYXRjaCA9IC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkkLy5leGVjKCBpc29fZGF0ZSApO1xuXHRcdHZhciB0aW1lX21hdGNoID0gL14oXFxkezJ9KTooXFxkezJ9KSQvLmV4ZWMoIGV4YWN0X3RpbWUgKTtcblx0XHR2YXIgZml4ZWRfb2Zmc2V0ID0gL14oWystXSkoXFxkezJ9KTooXFxkezJ9KSQvLmV4ZWMoIHRpbWV6b25lX25hbWUgKTtcblx0XHR2YXIgd2FsbF90aW1lc3RhbXA7XG5cdFx0dmFyIG9mZnNldHMgPSB7fTtcblx0XHR2YXIgbWF0Y2hlcyA9IFtdO1xuXG5cdFx0aWYgKCAhIG1hdGNoIHx8ICEgdGltZV9tYXRjaCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoIGZpeGVkX29mZnNldCApIHtcblx0XHRcdHJldHVybiBpc29fZGF0ZSArICdUJyArIGV4YWN0X3RpbWUgKyAnOjAwJyArIHRpbWV6b25lX25hbWU7XG5cdFx0fVxuXHRcdHdhbGxfdGltZXN0YW1wID0gRGF0ZS5VVEMoIE51bWJlciggbWF0Y2hbIDEgXSApLCBOdW1iZXIoIG1hdGNoWyAyIF0gKSAtIDEsIE51bWJlciggbWF0Y2hbIDMgXSApLCBOdW1iZXIoIHRpbWVfbWF0Y2hbIDEgXSApLCBOdW1iZXIoIHRpbWVfbWF0Y2hbIDIgXSApICk7XG5cdFx0WyAtMTcyODAwMDAwLCAtODY0MDAwMDAsIDAsIDg2NDAwMDAwLCAxNzI4MDAwMDAgXS5mb3JFYWNoKCBmdW5jdGlvbiAoIGRlbHRhICkge1xuXHRcdFx0dmFyIHpvbmVkX3BhcnRzID0gZ2V0X3pvbmVkX3BhcnRzKCB3YWxsX3RpbWVzdGFtcCArIGRlbHRhLCB0aW1lem9uZV9uYW1lICk7XG5cdFx0XHR2YXIgem9uZWRfYXNfdXRjO1xuXG5cdFx0XHRpZiAoIHpvbmVkX3BhcnRzICkge1xuXHRcdFx0XHR6b25lZF9hc191dGMgPSBEYXRlLlVUQyggem9uZWRfcGFydHMueWVhciwgem9uZWRfcGFydHMubW9udGggLSAxLCB6b25lZF9wYXJ0cy5kYXksIHpvbmVkX3BhcnRzLmhvdXIsIHpvbmVkX3BhcnRzLm1pbnV0ZSApO1xuXHRcdFx0XHRvZmZzZXRzWyBNYXRoLnJvdW5kKCAoIHpvbmVkX2FzX3V0YyAtICggd2FsbF90aW1lc3RhbXAgKyBkZWx0YSApICkgLyA2MDAwMCApIF0gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRPYmplY3Qua2V5cyggb2Zmc2V0cyApLmZvckVhY2goIGZ1bmN0aW9uICggb2Zmc2V0X2tleSApIHtcblx0XHRcdHZhciBvZmZzZXRfbWludXRlcyA9IE51bWJlciggb2Zmc2V0X2tleSApO1xuXHRcdFx0dmFyIGNhbmRpZGF0ZV90aW1lc3RhbXAgPSB3YWxsX3RpbWVzdGFtcCAtICggb2Zmc2V0X21pbnV0ZXMgKiA2MDAwMCApO1xuXHRcdFx0dmFyIGNhbmRpZGF0ZV9wYXJ0cyA9IGdldF96b25lZF9wYXJ0cyggY2FuZGlkYXRlX3RpbWVzdGFtcCwgdGltZXpvbmVfbmFtZSApO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdGNhbmRpZGF0ZV9wYXJ0cyAmJlxuXHRcdFx0XHRjYW5kaWRhdGVfcGFydHMueWVhciA9PT0gTnVtYmVyKCBtYXRjaFsgMSBdICkgJiZcblx0XHRcdFx0Y2FuZGlkYXRlX3BhcnRzLm1vbnRoID09PSBOdW1iZXIoIG1hdGNoWyAyIF0gKSAmJlxuXHRcdFx0XHRjYW5kaWRhdGVfcGFydHMuZGF5ID09PSBOdW1iZXIoIG1hdGNoWyAzIF0gKSAmJlxuXHRcdFx0XHRjYW5kaWRhdGVfcGFydHMuaG91ciA9PT0gTnVtYmVyKCB0aW1lX21hdGNoWyAxIF0gKSAmJlxuXHRcdFx0XHRjYW5kaWRhdGVfcGFydHMubWludXRlID09PSBOdW1iZXIoIHRpbWVfbWF0Y2hbIDIgXSApXG5cdFx0XHQpIHtcblx0XHRcdFx0bWF0Y2hlcy5wdXNoKCBpc29fZGF0ZSArICdUJyArIGV4YWN0X3RpbWUgKyAnOjAwJyArIGZvcm1hdF9vZmZzZXQoIG9mZnNldF9taW51dGVzICkgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gMSA9PT0gbWF0Y2hlcy5sZW5ndGggPyBtYXRjaGVzWyAwIF0gOiBudWxsO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgYWNjZXNzaWJsZSByZXNjaGVkdWxpbmcgY29udHJvbGxlciBpbnNpZGUgYW4gSW5zcGVjdG9yIHNoZWxsLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBpbnNwZWN0b3Jfc2hlbGwgQm9va2luZyBJbnNwZWN0b3Igcm9vdC5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29uZmlndXJhdGlvbiAgIFNlcnZlci1vd25lZCBkaWFsb2cgY29uZmlndXJhdGlvbi5cblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgb3B0aW9ucyAgICAgICAgIEhvc3QgdHJhbnNwb3J0IGFuZCByZWFkYmFjayBjYWxsYmFja3MuXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBDb250cm9sbGVyIEFQSSBvciBudWxsIHdoZW4gZGVwZW5kZW5jaWVzIGFyZSBhYnNlbnQuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfY29udHJvbGxlciggaW5zcGVjdG9yX3NoZWxsLCBjb25maWd1cmF0aW9uLCBvcHRpb25zICkge1xuXHRcdHZhciBzZXR0aW5ncyA9IGNvbmZpZ3VyYXRpb24gJiYgJ29iamVjdCcgPT09IHR5cGVvZiBjb25maWd1cmF0aW9uID8gY29uZmlndXJhdGlvbiA6IHt9O1xuXHRcdHZhciBjb250cm9sbGVyX29wdGlvbnMgPSBvcHRpb25zICYmICdvYmplY3QnID09PSB0eXBlb2Ygb3B0aW9ucyA/IG9wdGlvbnMgOiB7fTtcblx0XHR2YXIgdGVtcGxhdGVzID0gc2V0dGluZ3MudGVtcGxhdGVzICYmICdvYmplY3QnID09PSB0eXBlb2Ygc2V0dGluZ3MudGVtcGxhdGVzID8gc2V0dGluZ3MudGVtcGxhdGVzIDoge307XG5cdFx0dmFyIGkxOG4gPSBzZXR0aW5ncy5pMThuICYmICdvYmplY3QnID09PSB0eXBlb2Ygc2V0dGluZ3MuaTE4biA/IHNldHRpbmdzLmkxOG4gOiB7fTtcblx0XHR2YXIgZGlhbG9nX3RlbXBsYXRlID0gd2luZG93LndwICYmIHRlbXBsYXRlcy5kaWFsb2cgPyB3aW5kb3cud3AudGVtcGxhdGUoIHRlbXBsYXRlcy5kaWFsb2cgKSA6IG51bGw7XG5cdFx0dmFyIHJldmlld190ZW1wbGF0ZSA9IHdpbmRvdy53cCAmJiB0ZW1wbGF0ZXMucmV2aWV3ID8gd2luZG93LndwLnRlbXBsYXRlKCB0ZW1wbGF0ZXMucmV2aWV3ICkgOiBudWxsO1xuXHRcdHZhciBpbnNwZWN0b3JfcGFuZWwgPSBpbnNwZWN0b3Jfc2hlbGwgPyBpbnNwZWN0b3Jfc2hlbGwucXVlcnlTZWxlY3RvciggJy53cGJjX3NoYXJlZF91aV9pbnNwZWN0b3JfX3BhbmVsJyApIDogbnVsbDtcblx0XHR2YXIgbGF5ZXIgPSBudWxsO1xuXHRcdHZhciBvcGVuZXIgPSBudWxsO1xuXHRcdHZhciBhY3RpdmVfZHRvID0gbnVsbDtcblx0XHR2YXIgc2F2ZWRfZHJhZnQgPSBudWxsO1xuXHRcdHZhciBkcmFmdCA9IG51bGw7XG5cdFx0dmFyIHJldHJ5X2RyYWZ0ID0gbnVsbDtcblx0XHR2YXIgYWN0aXZlX3JldmlldyA9IG51bGw7XG5cdFx0dmFyIHBlbmRpbmdfYXBwbHlfcmVzdWx0ID0gbnVsbDtcblx0XHR2YXIgbmF0aXZlX2FkYXB0ZXIgPSBudWxsO1xuXHRcdHZhciByZWFkX3JlcXVlc3QgPSBudWxsO1xuXHRcdHZhciByZXZpZXdfcmVxdWVzdCA9IG51bGw7XG5cdFx0dmFyIGFwcGx5X3JlcXVlc3QgPSBudWxsO1xuXHRcdHZhciBnZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgcmV2aWV3X2dlbmVyYXRpb24gPSAwO1xuXHRcdHZhciBhcHBseV9nZW5lcmF0aW9uID0gMDtcblx0XHR2YXIgbmF0aXZlX3RpbWVvdXQgPSBudWxsO1xuXHRcdHZhciBkaXJ0eSA9IGZhbHNlO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBzZXR0aW5ncy5hY3RpdmUgfHwgISBkaWFsb2dfdGVtcGxhdGUgfHwgISByZXZpZXdfdGVtcGxhdGUgfHwgISBpbnNwZWN0b3JfcGFuZWwgfHwgISB3aW5kb3cualF1ZXJ5IHx8XG5cdFx0XHQhIHdpbmRvdy53cGJjX2Jvb2tpbmdfZGF0ZV9lZGl0b3IgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2Jvb2tpbmdfZGF0ZV9lZGl0b3IuY3JlYXRlX25hdGl2ZV9jYWxlbmRhcl9hZGFwdGVyXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvKiogQHJldHVybiB7dm9pZH0gQ2xlYXIgdGhlIGJvdW5kZWQgbmF0aXZlLWxvYWQgdGltZW91dC4gKi9cblx0XHRmdW5jdGlvbiBjbGVhcl9uYXRpdmVfdGltZW91dCgpIHtcblx0XHRcdGlmICggbnVsbCAhPT0gbmF0aXZlX3RpbWVvdXQgKSB7XG5cdFx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIG5hdGl2ZV90aW1lb3V0ICk7XG5cdFx0XHRcdG5hdGl2ZV90aW1lb3V0ID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgdGhlIEluc3BlY3Rvci1vd25lZCBkaXJ0eSBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX2RpcnR5KCkge1xuXHRcdFx0dmFyIG5leHRfZGlydHkgPSBCb29sZWFuKCBzYXZlZF9kcmFmdCAmJiBkcmFmdCAmJiBKU09OLnN0cmluZ2lmeSggY29tcGFyZV9kcmFmdCggc2F2ZWRfZHJhZnQgKSApICE9PSBKU09OLnN0cmluZ2lmeSggY29tcGFyZV9kcmFmdCggZHJhZnQgKSApICk7XG5cblx0XHRcdGlmICggbmV4dF9kaXJ0eSAhPT0gZGlydHkgKSB7XG5cdFx0XHRcdGRpcnR5ID0gbmV4dF9kaXJ0eTtcblx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udHJvbGxlcl9vcHRpb25zLm9uX2RpcnR5X2NoYW5nZSApIHtcblx0XHRcdFx0XHRjb250cm9sbGVyX29wdGlvbnMub25fZGlydHlfY2hhbmdlKCBkaXJ0eSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQW5ub3VuY2Ugb25lIHNhZmUgbGlmZWN5Y2xlIG1lc3NhZ2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIG1lc3NhZ2UgTWVzc2FnZSB0ZXh0LlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gdmlzaWJsZSBXaGV0aGVyIHRoZSBzdHJpcCBpcyB2aXNpYmxlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgc2V2ZXJpdHkgYHdhcm5pbmdgIG9yIGBlcnJvcmAuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfc3RhdHVzKCBtZXNzYWdlLCB2aXNpYmxlLCBzZXZlcml0eSApIHtcblx0XHRcdHZhciBzdGF0dXMgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzY2hlZHVsaW5nLXN0YXR1c10nICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoICEgc3RhdHVzICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBTdHJpbmcoIG1lc3NhZ2UgfHwgJycgKTtcblx0XHRcdHN0YXR1cy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtdmlzaWJsZScsIEJvb2xlYW4oIHZpc2libGUgJiYgbWVzc2FnZSApICk7XG5cdFx0XHRzdGF0dXMuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWVycm9yJywgQm9vbGVhbiggdmlzaWJsZSAmJiBtZXNzYWdlICYmICdlcnJvcicgPT09IHNldmVyaXR5ICkgKTtcblx0XHRcdHN0YXR1cy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtd2FybmluZycsIEJvb2xlYW4oIHZpc2libGUgJiYgbWVzc2FnZSAmJiAnZXJyb3InICE9PSBzZXZlcml0eSApICk7XG5cdFx0XHRzdGF0dXMuc2V0QXR0cmlidXRlKCAncm9sZScsICdlcnJvcicgPT09IHNldmVyaXR5ID8gJ2FsZXJ0JyA6ICdzdGF0dXMnICk7XG5cdFx0XHRzdGF0dXMuc2V0QXR0cmlidXRlKCAnYXJpYS1saXZlJywgJ2Vycm9yJyA9PT0gc2V2ZXJpdHkgPyAnYXNzZXJ0aXZlJyA6ICdwb2xpdGUnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2hvdyB0aGUgbG9hZGluZyBzdGF0ZSB3aXRob3V0IGRpc2NhcmRpbmcgdGhlIGN1cnJlbnQgcHJvcG9zYWwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBMb2FkaW5nIG1lc3NhZ2UuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzaG93X2xvYWRpbmcoIG1lc3NhZ2UgKSB7XG5cdFx0XHR2YXIgbG9hZGluZyA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctbG9hZGluZ10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGxhYmVsID0gbG9hZGluZyA/IGxvYWRpbmcucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctbG9hZGluZy1sYWJlbF0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVycm9yID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1lcnJvcl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVkaXRvciA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctdmlldz1cImVkaXRvclwiXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmV2aWV3ID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy12aWV3PVwicmV2aWV3XCJdJyApIDogbnVsbDtcblxuXHRcdFx0aWYgKCBsYWJlbCApIHtcblx0XHRcdFx0bGFiZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoIG1lc3NhZ2UgfHwgaTE4bi5sb2FkaW5nIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGxvYWRpbmcgKSB7XG5cdFx0XHRcdGxvYWRpbmcuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVycm9yICkge1xuXHRcdFx0XHRlcnJvci5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlZGl0b3IgKSB7XG5cdFx0XHRcdGVkaXRvci5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCByZXZpZXcgKSB7XG5cdFx0XHRcdHJldmlldy5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBsYXllciApIHtcblx0XHRcdFx0bGF5ZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgJ3RydWUnICk7XG5cdFx0XHR9XG5cdFx0XHRzZXRfc3RhdHVzKCBtZXNzYWdlLCBmYWxzZSwgJ3dhcm5pbmcnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2hvdyBvbmUgcmVjb3ZlcmFibGUgc2FmZSBlcnJvci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIEVycm9yIG1lc3NhZ2UuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzaG93X2Vycm9yKCBtZXNzYWdlICkge1xuXHRcdFx0dmFyIGxvYWRpbmcgPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzY2hlZHVsaW5nLWxvYWRpbmddJyApIDogbnVsbDtcblx0XHRcdHZhciBlcnJvciA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctZXJyb3JdJyApIDogbnVsbDtcblx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gZXJyb3IgPyBlcnJvci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1lcnJvci1tZXNzYWdlXScgKSA6IG51bGw7XG5cblx0XHRcdGNsZWFyX25hdGl2ZV90aW1lb3V0KCk7XG5cdFx0XHRpZiAoIGxvYWRpbmcgKSB7XG5cdFx0XHRcdGxvYWRpbmcuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZXJyb3IgKSB7XG5cdFx0XHRcdGVycm9yLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlcnJvcl9tZXNzYWdlICkge1xuXHRcdFx0XHRlcnJvcl9tZXNzYWdlLnRleHRDb250ZW50ID0gU3RyaW5nKCBtZXNzYWdlIHx8IGkxOG4ubG9hZF9lcnJvciB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBsYXllciApIHtcblx0XHRcdFx0bGF5ZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgJ2ZhbHNlJyApO1xuXHRcdFx0fVxuXHRcdFx0c2V0X3N0YXR1cyggbWVzc2FnZSwgZmFsc2UsICdlcnJvcicgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGJlc3QgZm9jdXMgcmVzdG9yYXRpb24gdGFyZ2V0IGFmdGVyIHJlcmVuZGVycy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IENvbm5lY3RlZCBmb2N1cyB0YXJnZXQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jlc3RvcmVfZm9jdXMoKSB7XG5cdFx0XHR2YXIgZmFsbGJhY2s7XG5cblx0XHRcdGlmICggb3BlbmVyICYmIG9wZW5lci5pc0Nvbm5lY3RlZCApIHtcblx0XHRcdFx0cmV0dXJuIG9wZW5lcjtcblx0XHRcdH1cblx0XHRcdGZhbGxiYWNrID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRyb2xsZXJfb3B0aW9ucy5nZXRfcmVzdG9yZV9mb2N1cyA/IGNvbnRyb2xsZXJfb3B0aW9ucy5nZXRfcmVzdG9yZV9mb2N1cygpIDogbnVsbDtcblxuXHRcdFx0cmV0dXJuIGZhbGxiYWNrICYmIGZhbGxiYWNrLmlzQ29ubmVjdGVkID8gZmFsbGJhY2sgOiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFib3J0IHJlcXVlc3RzLCB0ZWFyIGRvd24gdGhlIHNoYXJlZCBhZGFwdGVyLCBhbmQgcmVtb3ZlIHRoZSBsYXllci5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdGVhcmRvd24oKSB7XG5cdFx0XHRnZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRyZXZpZXdfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0YXBwbHlfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0Y2xlYXJfbmF0aXZlX3RpbWVvdXQoKTtcblx0XHRcdFsgcmVhZF9yZXF1ZXN0LCByZXZpZXdfcmVxdWVzdCwgYXBwbHlfcmVxdWVzdCBdLmZvckVhY2goIGZ1bmN0aW9uICggcGVuZGluZ19yZXF1ZXN0ICkge1xuXHRcdFx0XHRpZiAoIHBlbmRpbmdfcmVxdWVzdCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgcGVuZGluZ19yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRcdHBlbmRpbmdfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRyZWFkX3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0cmV2aWV3X3JlcXVlc3QgPSBudWxsO1xuXHRcdFx0YXBwbHlfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRpZiAoIG5hdGl2ZV9hZGFwdGVyICkge1xuXHRcdFx0XHRuYXRpdmVfYWRhcHRlci50ZWFyZG93bigpO1xuXHRcdFx0fVxuXHRcdFx0bmF0aXZlX2FkYXB0ZXIgPSBudWxsO1xuXHRcdFx0aWYgKCBsYXllciApIHtcblx0XHRcdFx0d2luZG93LmpRdWVyeSggbGF5ZXIgKS5vZmYoICdkYXRlX3NlbGVjdGVkJyArIEVWRU5UX05BTUVTUEFDRSApO1xuXHRcdFx0XHRsYXllci5yZW1vdmUoKTtcblx0XHRcdH1cblx0XHRcdGxheWVyID0gbnVsbDtcblx0XHRcdGFjdGl2ZV9kdG8gPSBudWxsO1xuXHRcdFx0c2F2ZWRfZHJhZnQgPSBudWxsO1xuXHRcdFx0ZHJhZnQgPSBudWxsO1xuXHRcdFx0cmV0cnlfZHJhZnQgPSBudWxsO1xuXHRcdFx0YWN0aXZlX3JldmlldyA9IG51bGw7XG5cdFx0XHRwZW5kaW5nX2FwcGx5X3Jlc3VsdCA9IG51bGw7XG5cdFx0XHRkaXJ0eSA9IGZhbHNlO1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udHJvbGxlcl9vcHRpb25zLm9uX2RpcnR5X2NoYW5nZSApIHtcblx0XHRcdFx0Y29udHJvbGxlcl9vcHRpb25zLm9uX2RpcnR5X2NoYW5nZSggZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDbG9zZSB3aXRoIG9wdGlvbmFsIGRpcnR5IHByb3RlY3Rpb24gYW5kIGZvY3VzIHJlc3RvcmF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSByZXN0b3JlX2ZvY3VzIFdoZXRoZXIgdG8gcmVzdG9yZSB0aGUgb3BlbmVyLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZm9yY2UgICAgICAgICBXaGV0aGVyIGEgcGFyZW50IGFscmVhZHkgYXBwcm92ZWQgZGlzY2FyZC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gY2xvc2VkIG9yIGFscmVhZHkgY2xvc2VkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNsb3NlKCByZXN0b3JlX2ZvY3VzLCBmb3JjZSApIHtcblx0XHRcdHZhciBmb2N1c190YXJnZXQ7XG5cblx0XHRcdGlmICggISBsYXllciApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgZm9yY2UgJiYgKCBhcHBseV9yZXF1ZXN0IHx8IHBlbmRpbmdfYXBwbHlfcmVzdWx0ICkgKSB7XG5cdFx0XHRcdHNldF9zdGF0dXMoIHBlbmRpbmdfYXBwbHlfcmVzdWx0ID8gKCBpMThuLnJlYWRiYWNrX2Vycm9yIHx8ICcnICkgOiAoIGkxOG4uYXBwbHlpbmcgfHwgJycgKSwgdHJ1ZSwgcGVuZGluZ19hcHBseV9yZXN1bHQgPyAnZXJyb3InIDogJ3dhcm5pbmcnICk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggZGlydHkgJiYgISBmb3JjZSAmJiAhIHdpbmRvdy5jb25maXJtKCBpMThuLmRpc2NhcmRfY2hhbmdlcyB8fCAnJyApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRmb2N1c190YXJnZXQgPSByZXN0b3JlX2ZvY3VzID8gZ2V0X3Jlc3RvcmVfZm9jdXMoKSA6IG51bGw7XG5cdFx0XHR0ZWFyZG93bigpO1xuXHRcdFx0b3BlbmVyID0gbnVsbDtcblx0XHRcdGlmICggZm9jdXNfdGFyZ2V0ICkge1xuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmICggZm9jdXNfdGFyZ2V0LmlzQ29ubmVjdGVkICkge1xuXHRcdFx0XHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCAwICk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciB0aGUgZGlhbG9nIHRocm91Z2ggaXRzIGFsbG93LWxpc3RlZCBkb21haW4gdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gdGVtcGxhdGVfdmFsdWVzIEF1dGhvcml6ZWQgRFRPIGFuZCBkcmFmdCB2YWx1ZXMuXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gUmVuZGVyZWQgbGF5ZXIuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2xheWVyKCB0ZW1wbGF0ZV92YWx1ZXMgKSB7XG5cdFx0XHR2YXIgaG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0XHR2YXIgcmVuZGVyZWQ7XG5cblx0XHRcdGlmICggbGF5ZXIgKSB7XG5cdFx0XHRcdGxheWVyLnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aG9zdC5pbm5lckhUTUwgPSBkaWFsb2dfdGVtcGxhdGUoIE9iamVjdC5hc3NpZ24oIHtcblx0XHRcdFx0aW5zcGVjdG9yX2lkOiAnd3BiY19ib29raW5nX2luc3BlY3RvcicsXG5cdFx0XHRcdGkxOG46IGkxOG4sXG5cdFx0XHRcdHJlc291cmNlczogW10sXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzOiBbXVxuXHRcdFx0fSwgdGVtcGxhdGVfdmFsdWVzIHx8IHt9ICkgKTtcblx0XHRcdHJlbmRlcmVkID0gaG9zdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1sYXllcl0nICk7XG5cdFx0XHRpZiAoICEgcmVuZGVyZWQgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aW5zcGVjdG9yX3BhbmVsLmFwcGVuZENoaWxkKCByZW5kZXJlZCApO1xuXHRcdFx0bGF5ZXIgPSByZW5kZXJlZDtcblxuXHRcdFx0cmV0dXJuIGxheWVyO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIHZpc2libGUgY29udHJvbHMgYW5kIGRpcnR5IHN0YXRlIGZyb20gdGhlIG11dGFibGUgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9kcmFmdCgpIHtcblx0XHRcdHZhciBzZWxlY3RlZF9saXN0ID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1zZWxlY3RlZC1kYXRlc10nICkgOiBudWxsO1xuXHRcdFx0dmFyIHRpbWVfZmllbGRzID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy10aW1lLWZpZWxkc10nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJldmlld19idXR0b24gPSBsYXllciA/IGxheWVyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzY2hlZHVsaW5nLXJldmlld10nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJldmlld2FibGU7XG5cblx0XHRcdGlmICggISBkcmFmdCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCB0aW1lX2ZpZWxkcyApIHtcblx0XHRcdFx0dGltZV9maWVsZHMuaGlkZGVuID0gVElNRV9GVUxMX0RBWSA9PT0gZHJhZnQudGltZV9hcHBsaWNhdGlvbjtcblx0XHRcdH1cblx0XHRcdGlmICggc2VsZWN0ZWRfbGlzdCApIHtcblx0XHRcdFx0c2VsZWN0ZWRfbGlzdC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0XHRpZiAoICEgZHJhZnQuc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoICkge1xuXHRcdFx0XHRcdHZhciBlbXB0eV9pdGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpJyApO1xuXHRcdFx0XHRcdGVtcHR5X2l0ZW0uY2xhc3NOYW1lID0gJ3dwYmNfYm9va2luZ19pbnNwZWN0b3JfX211dGVkJztcblx0XHRcdFx0XHRlbXB0eV9pdGVtLnRleHRDb250ZW50ID0gU3RyaW5nKCBpMThuLm5vX3NlbGVjdGVkX2RhdGVzIHx8ICcnICk7XG5cdFx0XHRcdFx0c2VsZWN0ZWRfbGlzdC5hcHBlbmRDaGlsZCggZW1wdHlfaXRlbSApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRyYWZ0LnNlbGVjdGVkX2RhdGVzLmZvckVhY2goIGZ1bmN0aW9uICggc2VsZWN0ZWRfZGF0ZSApIHtcblx0XHRcdFx0XHRcdHZhciBkYXRlX2l0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGknICk7XG5cdFx0XHRcdFx0XHRkYXRlX2l0ZW0udGV4dENvbnRlbnQgPSBzZWxlY3RlZF9kYXRlO1xuXHRcdFx0XHRcdFx0c2VsZWN0ZWRfbGlzdC5hcHBlbmRDaGlsZCggZGF0ZV9pdGVtICk7XG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR1cGRhdGVfZGlydHkoKTtcblx0XHRcdHJldmlld2FibGUgPSBkaXJ0eSAmJiBkcmFmdC5zZWxlY3RlZF9kYXRlcy5sZW5ndGggPiAwICYmICggVElNRV9GVUxMX0RBWSA9PT0gZHJhZnQudGltZV9hcHBsaWNhdGlvbiB8fCBCb29sZWFuKCBub3JtYWxpemVfdGltZSggZHJhZnQuc3RhcnRfdGltZSApICYmIG5vcm1hbGl6ZV90aW1lKCBkcmFmdC5lbmRfdGltZSApICkgKTtcblx0XHRcdGlmICggcmV2aWV3X2J1dHRvbiApIHtcblx0XHRcdFx0cmV2aWV3X2J1dHRvbi5kaXNhYmxlZCA9ICEgcmV2aWV3YWJsZTtcblx0XHRcdFx0cmV2aWV3X2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgcmV2aWV3YWJsZSA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaG93IHRoZSBlZGl0b3IgYWZ0ZXIgYSBzdWNjZXNzZnVsIG5hdGl2ZSBjYWxlbmRhciBsb2FkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBtZXNzYWdlIENvbXBsZXRpb24gbWVzc2FnZS5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHdhcm5pbmcgV2hldGhlciB0aGUgbWVzc2FnZSBpcyBhIHZpc2libGUgd2FybmluZy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNob3dfcmVhZHkoIG1lc3NhZ2UsIHdhcm5pbmcgKSB7XG5cdFx0XHR2YXIgbG9hZGluZyA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctbG9hZGluZ10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVycm9yID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1lcnJvcl0nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVkaXRvciA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctdmlldz1cImVkaXRvclwiXScgKSA6IG51bGw7XG5cblx0XHRcdGlmICggbG9hZGluZyApIHtcblx0XHRcdFx0bG9hZGluZy5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBlcnJvciApIHtcblx0XHRcdFx0ZXJyb3IuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICggZWRpdG9yICkge1xuXHRcdFx0XHRlZGl0b3IuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGxheWVyICkge1xuXHRcdFx0XHRsYXllci5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAnZmFsc2UnICk7XG5cdFx0XHR9XG5cdFx0XHRzZXRfc3RhdHVzKCBtZXNzYWdlLCB3YXJuaW5nLCAnd2FybmluZycgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIGV4YWN0IHByb3Bvc2VkIGRhdGVzIGFmdGVyIGNhbm9uaWNhbCBuYXRpdmUgYXZhaWxhYmlsaXR5IGxvYWRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGN1cnJlbnRfZ2VuZXJhdGlvbiBNYXRjaGluZyBjb250cm9sbGVyIGdlbmVyYXRpb24uXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGF0dGVtcHQgICAgICAgICAgICBaZXJvLWJhc2VkIGFuaW1hdGlvbi1mcmFtZSBhdHRlbXB0LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaHlkcmF0ZV9kYXRlcyggY3VycmVudF9nZW5lcmF0aW9uLCBhdHRlbXB0ICkge1xuXHRcdFx0dmFyIHJlc3RvcmVkO1xuXG5cdFx0XHRpZiAoIGN1cnJlbnRfZ2VuZXJhdGlvbiAhPT0gZ2VuZXJhdGlvbiB8fCAhIG5hdGl2ZV9hZGFwdGVyIHx8ICEgZHJhZnQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlc3RvcmVkID0gbmF0aXZlX2FkYXB0ZXIuc2V0X2V4YWN0X3NlbGVjdGVkX2RhdGVzKCBkcmFmdC5zZWxlY3RlZF9kYXRlcyApO1xuXHRcdFx0aWYgKCByZXN0b3JlZCApIHtcblx0XHRcdFx0ZHJhZnQuc2VsZWN0ZWRfZGF0ZXMgPSBuYXRpdmVfYWRhcHRlci5nZXRfc2VsZWN0ZWRfZGF0ZXMoKTtcblx0XHRcdFx0cmVuZGVyX2RyYWZ0KCk7XG5cdFx0XHRcdHNob3dfcmVhZHkoIGkxOG4ubG9hZGVkIHx8ICcnLCBmYWxzZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGF0dGVtcHQgPCAzICkge1xuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aHlkcmF0ZV9kYXRlcyggY3VycmVudF9nZW5lcmF0aW9uLCBhdHRlbXB0ICsgMSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG5hdGl2ZV9hZGFwdGVyLnNldF9zZWxlY3Rpb25fbW9kZSggTU9ERV9JTkRJVklEVUFMICk7XG5cdFx0XHRyZXN0b3JlZCA9IG5hdGl2ZV9hZGFwdGVyLnNldF9leGFjdF9zZWxlY3RlZF9kYXRlcyggZHJhZnQuc2VsZWN0ZWRfZGF0ZXMgKTtcblx0XHRcdGRyYWZ0LnNlbGVjdGlvbl9tZXRob2QgPSBNT0RFX0lORElWSURVQUw7XG5cdFx0XHRkcmFmdC5zZWxlY3RlZF9kYXRlcyA9IHJlc3RvcmVkID8gbmF0aXZlX2FkYXB0ZXIuZ2V0X3NlbGVjdGVkX2RhdGVzKCkgOiBkcmFmdC5zZWxlY3RlZF9kYXRlcy5zbGljZSggMCApO1xuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggbGF5ZXIucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctc2VsZWN0aW9uLW1ldGhvZF0nICksIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5jaGVja2VkID0gTU9ERV9JTkRJVklEVUFMID09PSBjb250cm9sLnZhbHVlO1xuXHRcdFx0fSApO1xuXHRcdFx0cmVuZGVyX2RyYWZ0KCk7XG5cdFx0XHRzaG93X3JlYWR5KCBpMThuLmh5ZHJhdGlvbl93YXJuaW5nIHx8ICcnLCB0cnVlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogTW91bnQgdGhlIHNvbGUgc2hhcmVkIG5hdGl2ZSBjYWxlbmRhciBhZGFwdGVyIGFuZCBsb2FkIGF2YWlsYWJpbGl0eS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBjdXJyZW50X2dlbmVyYXRpb24gTWF0Y2hpbmcgY29udHJvbGxlciBnZW5lcmF0aW9uLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbW91bnRfY2FsZW5kYXIoIGN1cnJlbnRfZ2VuZXJhdGlvbiApIHtcblx0XHRcdHZhciBjYWxlbmRhciA9IGFjdGl2ZV9kdG8gJiYgYWN0aXZlX2R0by5jYWxlbmRhciA/IGFjdGl2ZV9kdG8uY2FsZW5kYXIgOiB7fTtcblx0XHRcdHZhciBjYWxlbmRhcl9ob3N0ID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1jYWxlbmRhci1ob3N0XScgKSA6IG51bGw7XG5cblx0XHRcdG5hdGl2ZV9hZGFwdGVyID0gd2luZG93LndwYmNfYm9va2luZ19kYXRlX2VkaXRvci5jcmVhdGVfbmF0aXZlX2NhbGVuZGFyX2FkYXB0ZXIoKTtcblx0XHRcdGlmICggISBuYXRpdmVfYWRhcHRlci5tb3VudCggY2FsZW5kYXJfaG9zdCwge1xuXHRcdFx0XHRyZXNvdXJjZV9pZDogYWN0aXZlX2R0by50YXJnZXRfcmVzb3VyY2VfaWQsXG5cdFx0XHRcdGNhbGVuZGFyX2h0bWw6IGNhbGVuZGFyLmh0bWwgfHwgJycsXG5cdFx0XHRcdGNhbGVuZGFyX3BhcmFtZXRlcnM6IGNhbGVuZGFyLmNhbGVuZGFyX3BhcmFtZXRlcnMgfHwge30sXG5cdFx0XHRcdHBvbGljeV9wYXJhbWV0ZXJzOiBjYWxlbmRhci5wb2xpY3lfcGFyYW1ldGVycyB8fCB7fSxcblx0XHRcdFx0Y29udGV4dF9wYXJhbWV0ZXJzOiBjYWxlbmRhci5jb250ZXh0X3BhcmFtZXRlcnMgfHwge30sXG5cdFx0XHRcdHNlY3VyZV9wYXJhbWV0ZXJzOiBjYWxlbmRhci5zZWN1cmVfcGFyYW1ldGVycyB8fCB7fVxuXHRcdFx0fSApICkge1xuXHRcdFx0XHRzaG93X2Vycm9yKCBpMThuLmNhbGVuZGFyX2Vycm9yIHx8ICcnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHdpbmRvdy5qUXVlcnkoIGxheWVyICkub2ZmKCAnZGF0ZV9zZWxlY3RlZCcgKyBFVkVOVF9OQU1FU1BBQ0UgKS5vbiggJ2RhdGVfc2VsZWN0ZWQnICsgRVZFTlRfTkFNRVNQQUNFLCBmdW5jdGlvbiAoIGV2ZW50LCByZXNvdXJjZV9pZCwgY2xpY2tlZF9kYXRlcywgc2VsZWN0ZWRfZGF0ZXMgKSB7XG5cdFx0XHRcdGlmICggY3VycmVudF9nZW5lcmF0aW9uICE9PSBnZW5lcmF0aW9uIHx8IG5vcm1hbGl6ZV9pZCggcmVzb3VyY2VfaWQgKSAhPT0gbm9ybWFsaXplX2lkKCBhY3RpdmVfZHRvLnRhcmdldF9yZXNvdXJjZV9pZCApIHx8ICEgZHJhZnQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRyYWZ0LnNlbGVjdGVkX2RhdGVzID0gbm9ybWFsaXplX2RhdGVzKCBzZWxlY3RlZF9kYXRlcyApO1xuXHRcdFx0XHRkcmFmdC5wcm9wb3NhbF9yZXZpc2lvbiArPSAxO1xuXHRcdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdFx0cmVuZGVyX2RyYWZ0KCk7XG5cdFx0XHR9ICk7XG5cdFx0XHRzZXRfc3RhdHVzKCBpMThuLmxvYWRpbmdfY2FsZW5kYXIgfHwgJycsIGZhbHNlLCAnd2FybmluZycgKTtcblx0XHRcdGNsZWFyX25hdGl2ZV90aW1lb3V0KCk7XG5cdFx0XHRuYXRpdmVfdGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggY3VycmVudF9nZW5lcmF0aW9uID09PSBnZW5lcmF0aW9uICYmIG5hdGl2ZV9hZGFwdGVyICkge1xuXHRcdFx0XHRcdG5hdGl2ZV9hZGFwdGVyLmFib3J0X2xvYWQoKTtcblx0XHRcdFx0XHRzaG93X2Vycm9yKCBpMThuLmNhbGVuZGFyX2Vycm9yIHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIE5BVElWRV9MT0FEX1RJTUVPVVRfTVMgKTtcblx0XHRcdGlmICggISBuYXRpdmVfYWRhcHRlci5sb2FkKCBjYWxlbmRhci5yZXF1ZXN0X3BhcmFtZXRlcnMgfHwge30sIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0Y2xlYXJfbmF0aXZlX3RpbWVvdXQoKTtcblx0XHRcdFx0aWYgKCBjdXJyZW50X2dlbmVyYXRpb24gIT09IGdlbmVyYXRpb24gfHwgISBkcmFmdCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0bmF0aXZlX2FkYXB0ZXIuc2V0X3NlbGVjdGlvbl9tb2RlKCBkcmFmdC5zZWxlY3Rpb25fbWV0aG9kICk7XG5cdFx0XHRcdGh5ZHJhdGVfZGF0ZXMoIGN1cnJlbnRfZ2VuZXJhdGlvbiwgMCApO1xuXHRcdFx0fSwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRjbGVhcl9uYXRpdmVfdGltZW91dCgpO1xuXHRcdFx0XHRpZiAoIGN1cnJlbnRfZ2VuZXJhdGlvbiA9PT0gZ2VuZXJhdGlvbiApIHtcblx0XHRcdFx0XHRzaG93X2Vycm9yKCBpMThuLmNhbGVuZGFyX2Vycm9yIHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKSApIHtcblx0XHRcdFx0c2hvd19lcnJvciggaTE4bi5jYWxlbmRhcl9lcnJvciB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgdGhlIGxvY2FsIGltbXV0YWJsZSBzYXZlZCBzdGF0ZSBhbmQgbXV0YWJsZSBwcm9wb3NlZCBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkaWFsb2dfZHRvICAgICAgIEF1dGhvcml6ZWQgc2VydmVyIERUTy5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gY3VycmVudF9nZW5lcmF0aW9uIE1hdGNoaW5nIGdlbmVyYXRpb24uXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gcHJlc2VydmVkX2RyYWZ0IERyYWZ0IHByZXNlcnZlZCBhY3Jvc3MgdGFyZ2V0IHJlbG9hZC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGluaXRpYWxpemUoIGRpYWxvZ19kdG8sIGN1cnJlbnRfZ2VuZXJhdGlvbiwgcHJlc2VydmVkX2RyYWZ0ICkge1xuXHRcdFx0dmFyIGluaXRpYWw7XG5cblx0XHRcdGFjdGl2ZV9kdG8gPSBkaWFsb2dfZHRvO1xuXHRcdFx0aWYgKCAhIGRpYWxvZ19kdG8uc3VwcG9ydGVkICkge1xuXHRcdFx0XHRzaG93X2Vycm9yKCBpMThuLnVuc3VwcG9ydGVkIHx8ICcnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGluaXRpYWwgPSBPYmplY3QuYXNzaWduKCB7fSwgZGlhbG9nX2R0by5pbml0aWFsIHx8IHt9LCB7IHByb3Bvc2FsX3JldmlzaW9uOiBkaWFsb2dfZHRvLnByb3Bvc2FsX3JldmlzaW9uIHx8IDEgfSApO1xuXHRcdFx0aWYgKCAhIHNhdmVkX2RyYWZ0ICkge1xuXHRcdFx0XHRzYXZlZF9kcmFmdCA9IGZyZWV6ZV9kcmFmdCggaW5pdGlhbCApO1xuXHRcdFx0fVxuXHRcdFx0ZHJhZnQgPSBjbG9uZV9kcmFmdCggcHJlc2VydmVkX2RyYWZ0IHx8IGluaXRpYWwgKTtcblx0XHRcdGRyYWZ0LnRhcmdldF9yZXNvdXJjZV9pZCA9IG5vcm1hbGl6ZV9pZCggZGlhbG9nX2R0by50YXJnZXRfcmVzb3VyY2VfaWQgKTtcblx0XHRcdHJldHJ5X2RyYWZ0ID0gY2xvbmVfZHJhZnQoIGRyYWZ0ICk7XG5cdFx0XHRyZW5kZXJfbGF5ZXIoIE9iamVjdC5hc3NpZ24oIHt9LCBkcmFmdCwge1xuXHRcdFx0XHRpMThuOiBpMThuLFxuXHRcdFx0XHRyZXNvdXJjZXM6IGRpYWxvZ19kdG8uY2hvaWNlcyAmJiBkaWFsb2dfZHRvLmNob2ljZXMucmVzb3VyY2VzID8gZGlhbG9nX2R0by5jaG9pY2VzLnJlc291cmNlcyA6IFtdXG5cdFx0XHR9ICkgKTtcblx0XHRcdHNob3dfbG9hZGluZyggaTE4bi5sb2FkaW5nX2NhbGVuZGFyIHx8ICcnICk7XG5cdFx0XHRyZW5kZXJfZHJhZnQoKTtcblx0XHRcdG1vdW50X2NhbGVuZGFyKCBjdXJyZW50X2dlbmVyYXRpb24gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXF1ZXN0IGEgZnJlc2ggYXV0aG9yaXplZCBpbml0aWFsaXphdGlvbiBEVE8gZm9yIGEgdGFyZ2V0IFJlc291cmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHRhcmdldF9yZXNvdXJjZV9pZCBSZXF1ZXN0ZWQgdGFyZ2V0LCBvciB6ZXJvIGluaXRpYWxseS5cblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBwcmVzZXJ2ZWRfZHJhZnQgUHJvcG9zYWwgdG8gcmVzdG9yZSBhZnRlciByZWxvYWQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X3JlYWQoIHRhcmdldF9yZXNvdXJjZV9pZCwgcHJlc2VydmVkX2RyYWZ0ICkge1xuXHRcdFx0dmFyIGJvb2tpbmdfaWQgPSBhY3RpdmVfZHRvID8gbm9ybWFsaXplX2lkKCBhY3RpdmVfZHRvLmJvb2tpbmdfaWQgKSA6IDA7XG5cdFx0XHR2YXIgY3VycmVudF9nZW5lcmF0aW9uO1xuXHRcdFx0dmFyIHBlbmRpbmdfcmVxdWVzdDtcblxuXHRcdFx0aWYgKCAhIGJvb2tpbmdfaWQgfHwgISBjb250cm9sbGVyX29wdGlvbnMudXJsIHx8ICEgY29udHJvbGxlcl9vcHRpb25zLnNvdXJjZSB8fCAhIHNldHRpbmdzLnJlYWQgfHwgISBzZXR0aW5ncy5yZWFkLmFjdGlvbiB8fCAhIHNldHRpbmdzLnJlYWQubm9uY2UgKSB7XG5cdFx0XHRcdHNob3dfZXJyb3IoIGkxOG4ubG9hZF9lcnJvciB8fCAnJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRnZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRjdXJyZW50X2dlbmVyYXRpb24gPSBnZW5lcmF0aW9uO1xuXHRcdFx0aWYgKCByZWFkX3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJlYWRfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmVhZF9yZXF1ZXN0LmFib3J0KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHJldmlld19yZXF1ZXN0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiByZXZpZXdfcmVxdWVzdC5hYm9ydCApIHtcblx0XHRcdFx0cmV2aWV3X3JlcXVlc3QuYWJvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJldmlld19nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRyZXZpZXdfcmVxdWVzdCA9IG51bGw7XG5cdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdGlmICggbmF0aXZlX2FkYXB0ZXIgKSB7XG5cdFx0XHRcdG5hdGl2ZV9hZGFwdGVyLnRlYXJkb3duKCk7XG5cdFx0XHRcdG5hdGl2ZV9hZGFwdGVyID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdGNsZWFyX25hdGl2ZV90aW1lb3V0KCk7XG5cdFx0XHRyZXRyeV9kcmFmdCA9IHByZXNlcnZlZF9kcmFmdCA/IGNsb25lX2RyYWZ0KCBwcmVzZXJ2ZWRfZHJhZnQgKSA6IHJldHJ5X2RyYWZ0O1xuXHRcdFx0c2hvd19sb2FkaW5nKCBpMThuLmxvYWRpbmcgfHwgJycgKTtcblx0XHRcdHBlbmRpbmdfcmVxdWVzdCA9IHdpbmRvdy5qUXVlcnkuYWpheCgge1xuXHRcdFx0XHR1cmw6IGNvbnRyb2xsZXJfb3B0aW9ucy51cmwsXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb24nLFxuXHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0YWN0aW9uOiBzZXR0aW5ncy5yZWFkLmFjdGlvbixcblx0XHRcdFx0XHRub25jZTogc2V0dGluZ3MucmVhZC5ub25jZSxcblx0XHRcdFx0XHRib29raW5nX2lkOiBib29raW5nX2lkLFxuXHRcdFx0XHRcdHNvdXJjZTogY29udHJvbGxlcl9vcHRpb25zLnNvdXJjZSxcblx0XHRcdFx0XHR0YXJnZXRfcmVzb3VyY2VfaWQ6IG5vcm1hbGl6ZV9pZCggdGFyZ2V0X3Jlc291cmNlX2lkICksXG5cdFx0XHRcdFx0c291cmNlX2NvbnRleHRfdG9rZW46IGFjdGl2ZV9kdG8gJiYgYWN0aXZlX2R0by5zb3VyY2VfY29udGV4dF90b2tlbiA/IFN0cmluZyggYWN0aXZlX2R0by5zb3VyY2VfY29udGV4dF90b2tlbiApIDogJydcblx0XHRcdFx0fVxuXHRcdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdGlmICggY3VycmVudF9nZW5lcmF0aW9uICE9PSBnZW5lcmF0aW9uIHx8ICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSB8fCAhIHJlc3BvbnNlLmRhdGEucmVzY2hlZHVsaW5nICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbml0aWFsaXplKCByZXNwb25zZS5kYXRhLnJlc2NoZWR1bGluZywgY3VycmVudF9nZW5lcmF0aW9uLCBwcmVzZXJ2ZWRfZHJhZnQgKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGZhaWxlZF9yZXF1ZXN0LCByZXF1ZXN0X3N0YXR1cyApIHtcblx0XHRcdFx0dmFyIGVycm9yID0gZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OICYmIGZhaWxlZF9yZXF1ZXN0LnJlc3BvbnNlSlNPTi5kYXRhID8gZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgOiB7fTtcblxuXHRcdFx0XHRpZiAoICdhYm9ydCcgIT09IHJlcXVlc3Rfc3RhdHVzICYmIGN1cnJlbnRfZ2VuZXJhdGlvbiA9PT0gZ2VuZXJhdGlvbiAmJiBsYXllciApIHtcblx0XHRcdFx0XHRzaG93X2Vycm9yKCBlcnJvci5tZXNzYWdlIHx8IGkxOG4ubG9hZF9lcnJvciB8fCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggcmVhZF9yZXF1ZXN0ID09PSBwZW5kaW5nX3JlcXVlc3QgKSB7XG5cdFx0XHRcdFx0cmVhZF9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmVhZF9yZXF1ZXN0ID0gcGVuZGluZ19yZXF1ZXN0O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIHRoZSBib3VuZGVkIGJyb3dzZXIgcHJvcG9zYWwgZm9yIGF1dGhvcml0YXRpdmUgcmV2aWV3LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFByb3Bvc2FsIG9yIG51bGwgZm9yIGludmFsaWQvYW1iaWd1b3VzIHNpdGUgdGltZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBidWlsZF9wcm9wb3NhbCgpIHtcblx0XHRcdHZhciB0aW1lem9uZV9uYW1lID0gYWN0aXZlX2R0byAmJiBhY3RpdmVfZHRvLnRpbWV6b25lID8gU3RyaW5nKCBhY3RpdmVfZHRvLnRpbWV6b25lLm5hbWUgfHwgJycgKSA6ICcnO1xuXHRcdFx0dmFyIHByb3Bvc2FsO1xuXHRcdFx0dmFyIGZpcnN0X2RhdGU7XG5cdFx0XHR2YXIgbGFzdF9kYXRlO1xuXHRcdFx0dmFyIGludGVydmFscztcblxuXHRcdFx0aWYgKCAhIGFjdGl2ZV9kdG8gfHwgISBkcmFmdCB8fCAhIGRyYWZ0LnNlbGVjdGVkX2RhdGVzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRwcm9wb3NhbCA9IHtcblx0XHRcdFx0c2NoZW1hX3ZlcnNpb246IE51bWJlciggc2V0dGluZ3Muc2NoZW1hX3ZlcnNpb24gfHwgMCApLFxuXHRcdFx0XHRib29raW5nX2lkOiBub3JtYWxpemVfaWQoIGFjdGl2ZV9kdG8uYm9va2luZ19pZCApLFxuXHRcdFx0XHRpbnRlcmFjdGlvbl9zb3VyY2U6ICdkaWFsb2cnLFxuXHRcdFx0XHRvcGVyYXRpb246IGRyYWZ0LnRhcmdldF9yZXNvdXJjZV9pZCA9PT0gbm9ybWFsaXplX2lkKCBhY3RpdmVfZHRvLmN1cnJlbnRfcmVzb3VyY2VfaWQgKSA/ICdyZXBsYWNlX2RhdGVzJyA6ICdjaGFuZ2VfcmVzb3VyY2UnLFxuXHRcdFx0XHR0YXJnZXRfcmVzb3VyY2VfaWQ6IGRyYWZ0LnRhcmdldF9yZXNvdXJjZV9pZCxcblx0XHRcdFx0c2VsZWN0aW9uX21ldGhvZDogZHJhZnQuc2VsZWN0aW9uX21ldGhvZCxcblx0XHRcdFx0cHJvcG9zYWxfcmV2aXNpb246IE1hdGgubWF4KCAxLCBkcmFmdC5wcm9wb3NhbF9yZXZpc2lvbiApLFxuXHRcdFx0XHRzb3VyY2VfY29udGV4dF90b2tlbjogU3RyaW5nKCBhY3RpdmVfZHRvLnNvdXJjZV9jb250ZXh0X3Rva2VuIHx8ICcnIClcblx0XHRcdH07XG5cdFx0XHRpZiAoIFRJTUVfRlVMTF9EQVkgPT09IGRyYWZ0LnRpbWVfYXBwbGljYXRpb24gKSB7XG5cdFx0XHRcdHByb3Bvc2FsLnByb3Bvc2VkX2RhdGVzID0gZHJhZnQuc2VsZWN0ZWRfZGF0ZXMuc2xpY2UoIDAgKTtcblx0XHRcdFx0cmV0dXJuIHByb3Bvc2FsO1xuXHRcdFx0fVxuXHRcdFx0Zmlyc3RfZGF0ZSA9IGRyYWZ0LnNlbGVjdGVkX2RhdGVzWyAwIF07XG5cdFx0XHRsYXN0X2RhdGUgPSBkcmFmdC5zZWxlY3RlZF9kYXRlc1sgZHJhZnQuc2VsZWN0ZWRfZGF0ZXMubGVuZ3RoIC0gMSBdO1xuXHRcdFx0aWYgKCBUSU1FX0JPVU5EQVJZID09PSBkcmFmdC50aW1lX2FwcGxpY2F0aW9uICkge1xuXHRcdFx0XHRpZiAoIGZpcnN0X2RhdGUgPT09IGxhc3RfZGF0ZSAmJiBkcmFmdC5lbmRfdGltZSA8PSBkcmFmdC5zdGFydF90aW1lICkge1xuXHRcdFx0XHRcdGxhc3RfZGF0ZSA9IGFkZF9kYXlzKCBsYXN0X2RhdGUsIDEgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnRlcnZhbHMgPSBbIHtcblx0XHRcdFx0XHRzdGFydDogd2FsbF90aW1lX3RvX3JmYzMzMzkoIGZpcnN0X2RhdGUsIGRyYWZ0LnN0YXJ0X3RpbWUsIHRpbWV6b25lX25hbWUgKSxcblx0XHRcdFx0XHRlbmQ6IHdhbGxfdGltZV90b19yZmMzMzM5KCBsYXN0X2RhdGUsIGRyYWZ0LmVuZF90aW1lLCB0aW1lem9uZV9uYW1lIClcblx0XHRcdFx0fSBdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aW50ZXJ2YWxzID0gZHJhZnQuc2VsZWN0ZWRfZGF0ZXMubWFwKCBmdW5jdGlvbiAoIHNlbGVjdGVkX2RhdGUgKSB7XG5cdFx0XHRcdFx0dmFyIGVuZF9kYXRlID0gZHJhZnQuZW5kX3RpbWUgPD0gZHJhZnQuc3RhcnRfdGltZSA/IGFkZF9kYXlzKCBzZWxlY3RlZF9kYXRlLCAxICkgOiBzZWxlY3RlZF9kYXRlO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHN0YXJ0OiB3YWxsX3RpbWVfdG9fcmZjMzMzOSggc2VsZWN0ZWRfZGF0ZSwgZHJhZnQuc3RhcnRfdGltZSwgdGltZXpvbmVfbmFtZSApLFxuXHRcdFx0XHRcdFx0ZW5kOiB3YWxsX3RpbWVfdG9fcmZjMzMzOSggZW5kX2RhdGUsIGRyYWZ0LmVuZF90aW1lLCB0aW1lem9uZV9uYW1lIClcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGludGVydmFscy5zb21lKCBmdW5jdGlvbiAoIGludGVydmFsICkgeyByZXR1cm4gISBpbnRlcnZhbC5zdGFydCB8fCAhIGludGVydmFsLmVuZDsgfSApICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHByb3Bvc2FsLnByb3Bvc2VkX2ludGVydmFscyA9IGludGVydmFscztcblxuXHRcdFx0cmV0dXJuIHByb3Bvc2FsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlbmRlciB0aGUgc2VydmVyLWF1dGhvcml0YXRpdmUgcmV2aWV3IERUTy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZXNwb25zZSBTaWduZWQgcmV2aWV3IGVudmVsb3BlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3JldmlldyggcmVzcG9uc2UgKSB7XG5cdFx0XHR2YXIgbG9hZGluZyA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctbG9hZGluZ10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGVkaXRvciA9IGxheWVyID8gbGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctdmlldz1cImVkaXRvclwiXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgcmV2aWV3ID0gbGF5ZXIgPyBsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy12aWV3PVwicmV2aWV3XCJdJyApIDogbnVsbDtcblx0XHRcdHZhciBjb250ZW50ID0gcmV2aWV3ID8gcmV2aWV3LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzY2hlZHVsaW5nLXJldmlldy1jb250ZW50XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgYXBwbHlfYnV0dG9uID0gcmV2aWV3ID8gcmV2aWV3LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzY2hlZHVsaW5nLWFwcGx5XScgKSA6IG51bGw7XG5cdFx0XHR2YXIgYmFja19idXR0b24gPSByZXZpZXcgPyByZXZpZXcucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctYmFja10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGhlYWRpbmc7XG5cblx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnJldmlldyB8fCAhIHJlc3BvbnNlLnBsYW4gfHwgISByZXNwb25zZS50b2tlbiB8fCAhIHJlc3BvbnNlLmV4cGlyZXNfYXQgfHwgISBjb250ZW50ICkge1xuXHRcdFx0XHRzaG93X3JlYWR5KCAnJywgZmFsc2UgKTtcblx0XHRcdFx0c2V0X3N0YXR1cyggaTE4bi5yZXZpZXdfZXJyb3IgfHwgJycsIHRydWUsICdlcnJvcicgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YWN0aXZlX3JldmlldyA9IHJlc3BvbnNlO1xuXHRcdFx0Y29udGVudC5pbm5lckhUTUwgPSByZXZpZXdfdGVtcGxhdGUoIHJlc3BvbnNlLnJldmlldyApO1xuXHRcdFx0aWYgKCBsb2FkaW5nICkge1xuXHRcdFx0XHRsb2FkaW5nLmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVkaXRvciApIHtcblx0XHRcdFx0ZWRpdG9yLmhpZGRlbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXZpZXcuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRpZiAoIGFwcGx5X2J1dHRvbiApIHtcblx0XHRcdFx0YXBwbHlfYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHRcdGFwcGx5X2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyApO1xuXHRcdFx0XHRhcHBseV9idXR0b24udGV4dENvbnRlbnQgPSBwZW5kaW5nX2FwcGx5X3Jlc3VsdCA/IFN0cmluZyggaTE4bi5yZXRyeV9yZWZyZXNoIHx8IGkxOG4ucmV0cnkgfHwgJycgKSA6IFN0cmluZyggaTE4bi5hcHBseV9jaGFuZ2VzIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGJhY2tfYnV0dG9uICkge1xuXHRcdFx0XHRiYWNrX2J1dHRvbi5kaXNhYmxlZCA9IEJvb2xlYW4oIHBlbmRpbmdfYXBwbHlfcmVzdWx0ICk7XG5cdFx0XHR9XG5cdFx0XHRsYXllci5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAnZmFsc2UnICk7XG5cdFx0XHRzZXRfc3RhdHVzKCAnJywgZmFsc2UsICd3YXJuaW5nJyApO1xuXHRcdFx0aGVhZGluZyA9IGNvbnRlbnQucXVlcnlTZWxlY3RvciggJ2gzJyApO1xuXHRcdFx0aWYgKCBoZWFkaW5nICkge1xuXHRcdFx0XHRoZWFkaW5nLnNldEF0dHJpYnV0ZSggJ3RhYmluZGV4JywgJy0xJyApO1xuXHRcdFx0XHRoZWFkaW5nLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqIEByZXR1cm4ge3ZvaWR9IFN1Ym1pdCB0aGUgY3VycmVudCBwcm9wb3NhbCBmb3Igbm9uLW11dGF0aW5nIHJldmlldy4gKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X3JldmlldygpIHtcblx0XHRcdHZhciBwcm9wb3NhbCA9IGJ1aWxkX3Byb3Bvc2FsKCk7XG5cdFx0XHR2YXIgY3VycmVudF9nZW5lcmF0aW9uO1xuXHRcdFx0dmFyIHBlbmRpbmdfcmVxdWVzdDtcblxuXHRcdFx0aWYgKCAhIHByb3Bvc2FsICkge1xuXHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLnRpbWV6b25lX2Vycm9yIHx8IGkxOG4ucmV2aWV3X2Vycm9yIHx8ICcnLCB0cnVlLCAnZXJyb3InICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJldmlld19nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRjdXJyZW50X2dlbmVyYXRpb24gPSByZXZpZXdfZ2VuZXJhdGlvbjtcblx0XHRcdGlmICggcmV2aWV3X3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHJldmlld19yZXF1ZXN0LmFib3J0ICkge1xuXHRcdFx0XHRyZXZpZXdfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0c2hvd19sb2FkaW5nKCBpMThuLmxvYWRpbmdfcmV2aWV3IHx8ICcnICk7XG5cdFx0XHRwZW5kaW5nX3JlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcblx0XHRcdFx0dXJsOiBjb250cm9sbGVyX29wdGlvbnMudXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogc2V0dGluZ3MucmV2aWV3LmFjdGlvbixcblx0XHRcdFx0XHRub25jZTogc2V0dGluZ3MucmV2aWV3Lm5vbmNlLFxuXHRcdFx0XHRcdGJvb2tpbmdfaWQ6IGFjdGl2ZV9kdG8uYm9va2luZ19pZCxcblx0XHRcdFx0XHRzb3VyY2U6IGNvbnRyb2xsZXJfb3B0aW9ucy5zb3VyY2UsXG5cdFx0XHRcdFx0cHJvcG9zYWw6IEpTT04uc3RyaW5naWZ5KCBwcm9wb3NhbCApXG5cdFx0XHRcdH1cblx0XHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0XHRpZiAoIGN1cnJlbnRfZ2VuZXJhdGlvbiA9PT0gcmV2aWV3X2dlbmVyYXRpb24gJiYgcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyAmJiByZXNwb25zZS5kYXRhICkge1xuXHRcdFx0XHRcdHJlbmRlcl9yZXZpZXcoIHJlc3BvbnNlLmRhdGEgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHR2YXIgZXJyb3IgPSBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gJiYgZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgPyBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IHt9O1xuXG5cdFx0XHRcdGlmICggJ2Fib3J0JyAhPT0gcmVxdWVzdF9zdGF0dXMgJiYgY3VycmVudF9nZW5lcmF0aW9uID09PSByZXZpZXdfZ2VuZXJhdGlvbiAmJiBsYXllciApIHtcblx0XHRcdFx0XHRzaG93X3JlYWR5KCAnJywgZmFsc2UgKTtcblx0XHRcdFx0XHRzZXRfc3RhdHVzKCBlcnJvci5tZXNzYWdlIHx8IGkxOG4ucmV2aWV3X2Vycm9yIHx8ICcnLCB0cnVlLCAnZXJyb3InICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCByZXZpZXdfcmVxdWVzdCA9PT0gcGVuZGluZ19yZXF1ZXN0ICkge1xuXHRcdFx0XHRcdHJldmlld19yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmV2aWV3X3JlcXVlc3QgPSBwZW5kaW5nX3JlcXVlc3Q7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXNrIHRoZSBJbnNwZWN0b3IgdG8gcmVwbGFjZSBpdHNlbGYgZnJvbSBjYW5vbmljYWwgcmVhZGJhY2suXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc3VibWl0dGVkX3JldmlldyBSZXZpZXcgcmV0YWluZWQgZm9yIFJldHJ5IHJlZnJlc2guXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXF1ZXN0X3JlYWRiYWNrKCBzdWJtaXR0ZWRfcmV2aWV3ICkge1xuXHRcdFx0dmFyIHJlYWRiYWNrO1xuXHRcdFx0dmFyIGN1cnJlbnRfZ2VuZXJhdGlvbjtcblxuXHRcdFx0aWYgKCAhIHBlbmRpbmdfYXBwbHlfcmVzdWx0IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBjb250cm9sbGVyX29wdGlvbnMub25fYXBwbGllZCApIHtcblx0XHRcdFx0cmVuZGVyX3Jldmlldyggc3VibWl0dGVkX3JldmlldyApO1xuXHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLnJlYWRiYWNrX2Vycm9yIHx8ICcnLCB0cnVlLCAnZXJyb3InICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFwcGx5X2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdGN1cnJlbnRfZ2VuZXJhdGlvbiA9IGFwcGx5X2dlbmVyYXRpb247XG5cdFx0XHRzaG93X2xvYWRpbmcoIGkxOG4ucmVmcmVzaGluZyB8fCAnJyApO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmVhZGJhY2sgPSBjb250cm9sbGVyX29wdGlvbnMub25fYXBwbGllZCggcGVuZGluZ19hcHBseV9yZXN1bHQgKTtcblx0XHRcdH0gY2F0Y2ggKCByZWFkYmFja19lcnJvciApIHtcblx0XHRcdFx0cmVhZGJhY2sgPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlYWRiYWNrIHx8ICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHJlYWRiYWNrLnRoZW4gJiYgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHJlYWRiYWNrLmRvbmUgKSApIHtcblx0XHRcdFx0cmVuZGVyX3Jldmlldyggc3VibWl0dGVkX3JldmlldyApO1xuXHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLnJlYWRiYWNrX2Vycm9yIHx8ICcnLCB0cnVlLCAnZXJyb3InICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHdpbmRvdy5qUXVlcnkud2hlbiggcmVhZGJhY2sgKS5kb25lKCBmdW5jdGlvbiAoIGJvb2tpbmcgKSB7XG5cdFx0XHRcdGlmICggY3VycmVudF9nZW5lcmF0aW9uID09PSBhcHBseV9nZW5lcmF0aW9uICYmIGJvb2tpbmcgJiYgTnVtYmVyKCBib29raW5nLmJvb2tpbmdfaWQgfHwgMCApID09PSBOdW1iZXIoIHBlbmRpbmdfYXBwbHlfcmVzdWx0LmJvb2tpbmdfaWQgfHwgMCApICkge1xuXHRcdFx0XHRcdHBlbmRpbmdfYXBwbHlfcmVzdWx0ID0gbnVsbDtcblx0XHRcdFx0XHRkaXJ0eSA9IGZhbHNlO1xuXHRcdFx0XHRcdGNsb3NlKCB0cnVlLCB0cnVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0XHRpZiAoIGN1cnJlbnRfZ2VuZXJhdGlvbiA9PT0gYXBwbHlfZ2VuZXJhdGlvbiAmJiBsYXllciApIHtcblx0XHRcdFx0XHRyZW5kZXJfcmV2aWV3KCBzdWJtaXR0ZWRfcmV2aWV3ICk7XG5cdFx0XHRcdFx0c2V0X3N0YXR1cyggZXJyb3IgJiYgZXJyb3IubWVzc2FnZSA/IGVycm9yLm1lc3NhZ2UgOiAoIGkxOG4ucmVhZGJhY2tfZXJyb3IgfHwgJycgKSwgdHJ1ZSwgJ2Vycm9yJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqIEByZXR1cm4ge3ZvaWR9IEFwcGx5IG9ubHkgdGhlIGN1cnJlbnRseSBkaXNwbGF5ZWQgc2lnbmVkIHBsYW4uICovXG5cdFx0ZnVuY3Rpb24gcmVxdWVzdF9hcHBseSgpIHtcblx0XHRcdHZhciBzdWJtaXR0ZWRfcmV2aWV3ID0gYWN0aXZlX3Jldmlldztcblx0XHRcdHZhciBjdXJyZW50X2dlbmVyYXRpb247XG5cdFx0XHR2YXIgcGVuZGluZ19yZXF1ZXN0O1xuXG5cdFx0XHRpZiAoIHBlbmRpbmdfYXBwbHlfcmVzdWx0ICkge1xuXHRcdFx0XHRyZXF1ZXN0X3JlYWRiYWNrKCBzdWJtaXR0ZWRfcmV2aWV3ICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggISBzdWJtaXR0ZWRfcmV2aWV3IHx8ICEgc3VibWl0dGVkX3Jldmlldy5wbGFuIHx8ICEgc3VibWl0dGVkX3Jldmlldy50b2tlbiApIHtcblx0XHRcdFx0c2V0X3N0YXR1cyggaTE4bi5hcHBseV9lcnJvciB8fCAnJywgdHJ1ZSwgJ2Vycm9yJyApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhcHBseV9nZW5lcmF0aW9uICs9IDE7XG5cdFx0XHRjdXJyZW50X2dlbmVyYXRpb24gPSBhcHBseV9nZW5lcmF0aW9uO1xuXHRcdFx0c2hvd19sb2FkaW5nKCBpMThuLmFwcGx5aW5nIHx8ICcnICk7XG5cdFx0XHRwZW5kaW5nX3JlcXVlc3QgPSB3aW5kb3cualF1ZXJ5LmFqYXgoIHtcblx0XHRcdFx0dXJsOiBjb250cm9sbGVyX29wdGlvbnMudXJsLFxuXHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdFx0ZGF0YToge1xuXHRcdFx0XHRcdGFjdGlvbjogc2V0dGluZ3MuYXBwbHkuYWN0aW9uLFxuXHRcdFx0XHRcdG5vbmNlOiBzZXR0aW5ncy5hcHBseS5ub25jZSxcblx0XHRcdFx0XHRib29raW5nX2lkOiBhY3RpdmVfZHRvLmJvb2tpbmdfaWQsXG5cdFx0XHRcdFx0c291cmNlOiBjb250cm9sbGVyX29wdGlvbnMuc291cmNlLFxuXHRcdFx0XHRcdHBsYW46IEpTT04uc3RyaW5naWZ5KCBzdWJtaXR0ZWRfcmV2aWV3LnBsYW4gKSxcblx0XHRcdFx0XHR0b2tlbjogc3VibWl0dGVkX3Jldmlldy50b2tlbixcblx0XHRcdFx0XHRzZW5kX21vZGlmaWVkX2VtYWlsOiAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udHJvbGxlcl9vcHRpb25zLmdldF9zZW5kX21vZGlmaWVkX2VtYWlsX2ludGVudCAmJiBjb250cm9sbGVyX29wdGlvbnMuZ2V0X3NlbmRfbW9kaWZpZWRfZW1haWxfaW50ZW50KCkgPyAxIDogMFxuXHRcdFx0XHR9XG5cdFx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdFx0aWYgKCBjdXJyZW50X2dlbmVyYXRpb24gIT09IGFwcGx5X2dlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8ICEgbm9ybWFsaXplX2lkKCByZXNwb25zZS5kYXRhLmJvb2tpbmdfaWQgKSB8fCAhIHJlc3BvbnNlLmRhdGEuaG9zdF9yZWZyZXNoICkge1xuXHRcdFx0XHRcdHJlbmRlcl9yZXZpZXcoIHN1Ym1pdHRlZF9yZXZpZXcgKTtcblx0XHRcdFx0XHRzZXRfc3RhdHVzKCBpMThuLmFwcGx5X2Vycm9yIHx8ICcnLCB0cnVlLCAnZXJyb3InICk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHBlbmRpbmdfYXBwbHlfcmVzdWx0ID0gcmVzcG9uc2UuZGF0YTtcblx0XHRcdFx0cmVxdWVzdF9yZWFkYmFjayggc3VibWl0dGVkX3JldmlldyApO1xuXHRcdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggZmFpbGVkX3JlcXVlc3QsIHJlcXVlc3Rfc3RhdHVzICkge1xuXHRcdFx0XHR2YXIgZXJyb3IgPSBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04gJiYgZmFpbGVkX3JlcXVlc3QucmVzcG9uc2VKU09OLmRhdGEgPyBmYWlsZWRfcmVxdWVzdC5yZXNwb25zZUpTT04uZGF0YSA6IHt9O1xuXG5cdFx0XHRcdGlmICggJ2Fib3J0JyAhPT0gcmVxdWVzdF9zdGF0dXMgJiYgY3VycmVudF9nZW5lcmF0aW9uID09PSBhcHBseV9nZW5lcmF0aW9uICYmIGxheWVyICkge1xuXHRcdFx0XHRcdHJlbmRlcl9yZXZpZXcoIHN1Ym1pdHRlZF9yZXZpZXcgKTtcblx0XHRcdFx0XHRzZXRfc3RhdHVzKCBlcnJvci5tZXNzYWdlIHx8IGkxOG4uYXBwbHlfZXJyb3IgfHwgJycsIHRydWUsICdlcnJvcicgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoIGFwcGx5X3JlcXVlc3QgPT09IHBlbmRpbmdfcmVxdWVzdCApIHtcblx0XHRcdFx0XHRhcHBseV9yZXF1ZXN0ID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0YXBwbHlfcmVxdWVzdCA9IHBlbmRpbmdfcmVxdWVzdDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBPcGVuIGZvciBvbmUgSW5zcGVjdG9yLWF1dGhvcml6ZWQgYm9va2luZy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRyaWdnZXIgICAgICAgICBBY3RpdmF0aW5nIGNvbnRyb2wuXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgYm9va2luZ19jb250ZXh0IEF1dGhvcml6ZWQgYm9va2luZyBpZGVudGl0eS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gb3BlbmluZyBiZWdhbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvcGVuKCB0cmlnZ2VyLCBib29raW5nX2NvbnRleHQgKSB7XG5cdFx0XHR2YXIgYm9va2luZ19pZCA9IGJvb2tpbmdfY29udGV4dCA/IG5vcm1hbGl6ZV9pZCggYm9va2luZ19jb250ZXh0LmJvb2tpbmdfaWQgKSA6IDA7XG5cblx0XHRcdGlmICggISBib29raW5nX2lkIHx8ICEgY2xvc2UoIGZhbHNlLCBmYWxzZSApICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRvcGVuZXIgPSB0cmlnZ2VyO1xuXHRcdFx0YWN0aXZlX2R0byA9IHsgYm9va2luZ19pZDogYm9va2luZ19pZCB9O1xuXHRcdFx0cmVuZGVyX2xheWVyKCB7IGkxOG46IGkxOG4gfSApO1xuXHRcdFx0c2hvd19sb2FkaW5nKCBpMThuLmxvYWRpbmcgfHwgJycgKTtcblx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCBsYXllciApIHtcblx0XHRcdFx0XHRsYXllci5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRyZXF1ZXN0X3JlYWQoIDAsIG51bGwgKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGRpYWxvZyBhY3Rpb25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBDbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggZXZlbnQgKSB7XG5cdFx0XHRpZiAoICEgbGF5ZXIgfHwgISBsYXllci5jb250YWlucyggZXZlbnQudGFyZ2V0ICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzY2hlZHVsaW5nLWNsb3NlXScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2xvc2UoIHRydWUsIGZhbHNlICk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctcmV0cnldJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXF1ZXN0X3JlYWQoIGRyYWZ0ID8gZHJhZnQudGFyZ2V0X3Jlc291cmNlX2lkIDogMCwgcmV0cnlfZHJhZnQgfHwgZHJhZnQgKTtcblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1yZXNldF0nICkgJiYgc2F2ZWRfZHJhZnQgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGRyYWZ0ID0gY2xvbmVfZHJhZnQoIHNhdmVkX2RyYWZ0ICk7XG5cdFx0XHRcdGFjdGl2ZV9yZXZpZXcgPSBudWxsO1xuXHRcdFx0XHRyZXF1ZXN0X3JlYWQoIGRyYWZ0LnRhcmdldF9yZXNvdXJjZV9pZCwgZHJhZnQgKTtcblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1yZXZpZXddJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXF1ZXN0X3JldmlldygpO1xuXHRcdFx0fSBlbHNlIGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJvb2tpbmctcmVzY2hlZHVsaW5nLWJhY2tdJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRhY3RpdmVfcmV2aWV3ID0gbnVsbDtcblx0XHRcdFx0bGF5ZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctdmlldz1cInJldmlld1wiXScgKS5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0XHRsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy12aWV3PVwiZWRpdG9yXCJdJyApLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0XHRsYXllci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1ib29raW5nLXJlc2NoZWR1bGluZy1yZXZpZXddJyApLmZvY3VzKCk7XG5cdFx0XHR9IGVsc2UgaWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctYXBwbHldJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXF1ZXN0X2FwcGx5KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgY29udHJvbHMgaW50byB0aGUgbXV0YWJsZSBwcm9wb3NhbC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IElucHV0IG9yIGNoYW5nZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jaGFuZ2UoIGV2ZW50ICkge1xuXHRcdFx0dmFyIHJlc291cmNlX2NvbnRyb2w7XG5cdFx0XHR2YXIgc2VsZWN0aW9uX2NvbnRyb2w7XG5cdFx0XHR2YXIgdGltZV9hcHBsaWNhdGlvbl9jb250cm9sO1xuXHRcdFx0dmFyIHRpbWVfY29udHJvbDtcblx0XHRcdHZhciByZXF1ZXN0ZWRfbW9kZTtcblxuXHRcdFx0aWYgKCAhIGxheWVyIHx8ICEgbGF5ZXIuY29udGFpbnMoIGV2ZW50LnRhcmdldCApIHx8ICEgZHJhZnQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlc291cmNlX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctcmVzb3VyY2VdJyApO1xuXHRcdFx0c2VsZWN0aW9uX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctc2VsZWN0aW9uLW1ldGhvZF0nICk7XG5cdFx0XHR0aW1lX2FwcGxpY2F0aW9uX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctdGltZS1hcHBsaWNhdGlvbl0nICk7XG5cdFx0XHR0aW1lX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctdGltZV0nICk7XG5cdFx0XHRpZiAoIHJlc291cmNlX2NvbnRyb2wgKSB7XG5cdFx0XHRcdGRyYWZ0LnRhcmdldF9yZXNvdXJjZV9pZCA9IG5vcm1hbGl6ZV9pZCggcmVzb3VyY2VfY29udHJvbC52YWx1ZSApO1xuXHRcdFx0XHRkcmFmdC5wcm9wb3NhbF9yZXZpc2lvbiArPSAxO1xuXHRcdFx0XHR1cGRhdGVfZGlydHkoKTtcblx0XHRcdFx0cmVxdWVzdF9yZWFkKCBkcmFmdC50YXJnZXRfcmVzb3VyY2VfaWQsIGRyYWZ0ICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggc2VsZWN0aW9uX2NvbnRyb2wgKSB7XG5cdFx0XHRcdHJlcXVlc3RlZF9tb2RlID0gTU9ERV9JTkRJVklEVUFMID09PSBzZWxlY3Rpb25fY29udHJvbC52YWx1ZSA/IE1PREVfSU5ESVZJRFVBTCA6IE1PREVfUE9MSUNZO1xuXHRcdFx0XHRpZiAoIG5hdGl2ZV9hZGFwdGVyICYmICEgbmF0aXZlX2FkYXB0ZXIuc2V0X3NlbGVjdGlvbl9tb2RlKCByZXF1ZXN0ZWRfbW9kZSApICkge1xuXHRcdFx0XHRcdHNldF9zdGF0dXMoIGkxOG4uaHlkcmF0aW9uX3dhcm5pbmcgfHwgJycsIHRydWUsICd3YXJuaW5nJyApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRkcmFmdC5zZWxlY3Rpb25fbWV0aG9kID0gcmVxdWVzdGVkX21vZGU7XG5cdFx0XHRcdGRyYWZ0LnNlbGVjdGVkX2RhdGVzID0gbmF0aXZlX2FkYXB0ZXIgPyBuYXRpdmVfYWRhcHRlci5nZXRfc2VsZWN0ZWRfZGF0ZXMoKSA6IGRyYWZ0LnNlbGVjdGVkX2RhdGVzO1xuXHRcdFx0fSBlbHNlIGlmICggdGltZV9hcHBsaWNhdGlvbl9jb250cm9sICkge1xuXHRcdFx0XHRkcmFmdC50aW1lX2FwcGxpY2F0aW9uID0gLTEgIT09IFsgVElNRV9GVUxMX0RBWSwgVElNRV9CT1VOREFSWSwgVElNRV9QRVJfREFURSBdLmluZGV4T2YoIHRpbWVfYXBwbGljYXRpb25fY29udHJvbC52YWx1ZSApID8gdGltZV9hcHBsaWNhdGlvbl9jb250cm9sLnZhbHVlIDogVElNRV9GVUxMX0RBWTtcblx0XHRcdH0gZWxzZSBpZiAoIHRpbWVfY29udHJvbCApIHtcblx0XHRcdFx0ZHJhZnRbIHRpbWVfY29udHJvbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYm9va2luZy1yZXNjaGVkdWxpbmctdGltZScgKSBdID0gbm9ybWFsaXplX3RpbWUoIHRpbWVfY29udHJvbC52YWx1ZSApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZHJhZnQucHJvcG9zYWxfcmV2aXNpb24gKz0gMTtcblx0XHRcdGFjdGl2ZV9yZXZpZXcgPSBudWxsO1xuXHRcdFx0cmVuZGVyX2RyYWZ0KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udGFpbiBrZXlib2FyZCBmb2N1cyBhbmQgY2xvc2Ugb25seSB0aGlzIHNlY29uZGFyeSBkaWFsb2cgb24gRXNjYXBlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBLZXlib2FyZCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdHZhciBmb2N1c2FibGU7XG5cdFx0XHR2YXIgZmlyc3Q7XG5cdFx0XHR2YXIgbGFzdDtcblxuXHRcdFx0aWYgKCAhIGxheWVyICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICdFc2NhcGUnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRjbG9zZSggdHJ1ZSwgZmFsc2UgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnVGFiJyAhPT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb2N1c2FibGUgPSBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoIGxheWVyLnF1ZXJ5U2VsZWN0b3JBbGwoICdhW2hyZWZdLCBidXR0b246bm90KFtkaXNhYmxlZF0pLCBpbnB1dDpub3QoW2Rpc2FibGVkXSksIHNlbGVjdDpub3QoW2Rpc2FibGVkXSksIFt0YWJpbmRleF06bm90KFt0YWJpbmRleD1cIi0xXCJdKScgKSwgZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRyZXR1cm4gISBjb250cm9sLmhpZGRlbiAmJiBudWxsICE9PSBjb250cm9sLm9mZnNldFBhcmVudDtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggISBmb2N1c2FibGUubGVuZ3RoICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRsYXllci5mb2N1cygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmaXJzdCA9IGZvY3VzYWJsZVsgMCBdO1xuXHRcdFx0bGFzdCA9IGZvY3VzYWJsZVsgZm9jdXNhYmxlLmxlbmd0aCAtIDEgXTtcblx0XHRcdGlmICggZXZlbnQuc2hpZnRLZXkgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gZmlyc3QgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGxhc3QuZm9jdXMoKTtcblx0XHRcdH0gZWxzZSBpZiAoICEgZXZlbnQuc2hpZnRLZXkgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gbGFzdCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Zmlyc3QuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpbnNwZWN0b3Jfc2hlbGwuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XG5cdFx0aW5zcGVjdG9yX3NoZWxsLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfY2hhbmdlICk7XG5cdFx0aW5zcGVjdG9yX3NoZWxsLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZV9jaGFuZ2UgKTtcblx0XHRpbnNwZWN0b3Jfc2hlbGwuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfa2V5ZG93biwgdHJ1ZSApO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG9wZW46IG9wZW4sXG5cdFx0XHRpc19vcGVuOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKCBsYXllciApO1xuXHRcdFx0fSxcblx0XHRcdGlzX2RpcnR5OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBkaXJ0eTtcblx0XHRcdH0sXG5cdFx0XHRpc19idXN5OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBCb29sZWFuKCBhcHBseV9yZXF1ZXN0IHx8IHBlbmRpbmdfYXBwbHlfcmVzdWx0ICk7XG5cdFx0XHR9LFxuXHRcdFx0Y29uZmlybV9kaXNjYXJkOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggYXBwbHlfcmVxdWVzdCB8fCBwZW5kaW5nX2FwcGx5X3Jlc3VsdCApIHtcblx0XHRcdFx0XHRzZXRfc3RhdHVzKCBwZW5kaW5nX2FwcGx5X3Jlc3VsdCA/ICggaTE4bi5yZWFkYmFja19lcnJvciB8fCAnJyApIDogKCBpMThuLmFwcGx5aW5nIHx8ICcnICksIHRydWUsIHBlbmRpbmdfYXBwbHlfcmVzdWx0ID8gJ2Vycm9yJyA6ICd3YXJuaW5nJyApO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiAhIGRpcnR5IHx8IHdpbmRvdy5jb25maXJtKCBpMThuLmRpc2NhcmRfY2hhbmdlcyB8fCAnJyApO1xuXHRcdFx0fSxcblx0XHRcdHByZXBhcmVfZm9yX3BhcmVudF9zd2l0Y2g6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGNsb3NlKCBmYWxzZSwgZmFsc2UgKTtcblx0XHRcdH0sXG5cdFx0XHRmb3JjZV9jbG9zZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRjbG9zZSggZmFsc2UsIHRydWUgKTtcblx0XHRcdH0sXG5cdFx0XHRkZXN0cm95OiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNsb3NlKCBmYWxzZSwgdHJ1ZSApO1xuXHRcdFx0XHRpbnNwZWN0b3Jfc2hlbGwucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgaGFuZGxlX2NsaWNrICk7XG5cdFx0XHRcdGluc3BlY3Rvcl9zaGVsbC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlX2NoYW5nZSApO1xuXHRcdFx0XHRpbnNwZWN0b3Jfc2hlbGwucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgaGFuZGxlX2NoYW5nZSApO1xuXHRcdFx0XHRpbnNwZWN0b3Jfc2hlbGwucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBoYW5kbGVfa2V5ZG93biwgdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY19ib29raW5nX3Jlc2NoZWR1bGluZyA9IHdpbmRvdy53cGJjX2Jvb2tpbmdfcmVzY2hlZHVsaW5nIHx8IHt9O1xuXHR3aW5kb3cud3BiY19ib29raW5nX3Jlc2NoZWR1bGluZy5jcmVhdGVfY29udHJvbGxlciA9IGNyZWF0ZV9jb250cm9sbGVyO1xufSggd2luZG93LCBkb2N1bWVudCwgalF1ZXJ5ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFFQyxDQUFDLEVBQUc7RUFDbEMsWUFBWTs7RUFFWixJQUFJQyxlQUFlLEdBQUcsMEJBQTBCO0VBQ2hELElBQUlDLHNCQUFzQixHQUFHLEtBQUs7RUFDbEMsSUFBSUMsV0FBVyxHQUFHLFFBQVE7RUFDMUIsSUFBSUMsZUFBZSxHQUFHLFlBQVk7RUFDbEMsSUFBSUMsYUFBYSxH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
