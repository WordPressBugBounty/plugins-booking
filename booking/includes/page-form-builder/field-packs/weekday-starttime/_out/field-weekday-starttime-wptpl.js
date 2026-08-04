"use strict";

// WPBC BFB Pack: Weekday Start Time.
(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};

  /**
   * Pad an integer to two digits.
   *
   * @param {number|string} n Number to pad.
   * @returns {string} Two-digit number string.
   */
  function pad2(n) {
    n = parseInt(n, 10);
    return (n < 10 ? '0' : '') + n;
  }

  /**
   * Convert a 24-hour time string to minutes after midnight.
   *
   * @param {string} t Time in HH:MM format.
   * @returns {number|null} Minute value, or null for invalid input.
   */
  function time_to_min(t) {
    if (!t || typeof t !== 'string') {
      return null;
    }
    var m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
      return null;
    }
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) {
      return null;
    }
    return h * 60 + min;
  }

  /**
   * Convert minutes after midnight to a normalized 24-hour time.
   *
   * @param {number|string} mins Minute value.
   * @returns {string} Time in HH:MM format.
   */
  function min_to_time(mins) {
    var m = parseInt(mins, 10);
    if (!isFinite(m)) {
      m = 0;
    }
    m = (m % 1440 + 1440) % 1440;
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }

  /**
   * Normalize the grid interval to the supported range.
   *
   * @param {number|string} step Requested interval in minutes.
   * @returns {number} Interval between 5 and 180 minutes.
   */
  function normalize_step(step) {
    var s = parseInt(step, 10);
    if (!isFinite(s) || s < 5) {
      s = 5;
    }
    if (s > 180) {
      s = 180;
    }
    return s;
  }

  /**
   * Return the persisted start-time group order.
   *
   * @returns {string[]} Default group followed by Monday through Sunday.
   */
  function day_order() {
    return ['default', '1', '2', '3', '4', '5', '6', '7'];
  }

  /**
   * Return weekday keys without the default group.
   *
   * @returns {string[]} Monday through Sunday keys.
   */
  function weekday_order() {
    return ['1', '2', '3', '4', '5', '6', '7'];
  }

  /**
   * Build the default 10:00 through 16:30 weekday start-time windows.
   *
   * Ranges remain the compact persisted representation; the exporter expands
   * each range into individual start times using the configured interval.
   *
   * @returns {Object<string, Array<{from:string,to:string}>>} Default ranges by weekday.
   */
  function default_slots() {
    var slots = [{
      from: '10:00',
      to: '17:00'
    }];
    return {
      'default': slots.slice(),
      '1': slots.slice(),
      '2': slots.slice(),
      '3': slots.slice(),
      '4': slots.slice(),
      '5': slots.slice(),
      '6': slots.slice(),
      '7': slots.slice()
    };
  }

  /**
   * Read server-localized edition support data.
   *
   * @returns {Object} Localized field-pack configuration.
   */
  function get_boot() {
    return w.WPBC_BFB_Weekday_Starttime_Boot || {};
  }

  /**
   * Interpret supported-state values from PHP or persisted JSON.
   *
   * @param {*} value Candidate supported-state value.
   * @returns {boolean} Whether the value represents true.
   */
  function is_supported_value(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  /**
   * Determine whether the active edition supports weekday conditions.
   *
   * @param {Object} [field] Persisted field data fallback.
   * @returns {boolean} Whether the pack can export an operational field.
   */
  function is_pack_supported(field) {
    var boot = get_boot();
    if (boot && typeof boot.is_supported !== 'undefined') {
      return is_supported_value(boot.is_supported);
    }
    return is_supported_value(field && field.is_supported);
  }

  /**
   * Resolve the edition-upgrade message.
   *
   * @param {Object} [field] Persisted field data fallback.
   * @returns {string} Upgrade guidance.
   */
  function upgrade_text(field) {
    var boot = get_boot();
    return String(boot && boot.upgrade_text || field && field.upgrade_text || 'This field is available only in Booking Calendar Business Medium or higher versions.');
  }

  /**
   * Normalize persisted weekday ranges and fill missing groups.
   *
   * @param {Object|string} raw Persisted range map or JSON string.
   * @returns {Object<string, Array<{from:string,to:string}>>} Sanitized ranges.
   */
  function normalize_slots(raw) {
    var base = default_slots();
    var out = {};
    var parsed = raw;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        parsed = {};
      }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      parsed = {};
    }
    day_order().forEach(function (key) {
      var ranges = Array.isArray(parsed[key]) ? parsed[key] : base[key];
      out[key] = sanitize_ranges(ranges);
    });
    return out;
  }

  /**
   * Sanitize, sort, and normalize compact time ranges.
   *
   * @param {Array<{from:string,to:string}>} ranges Candidate time ranges.
   * @returns {Array<{from:string,to:string}>} Valid ordered ranges.
   */
  function sanitize_ranges(ranges) {
    var out = [];
    (ranges || []).forEach(function (range) {
      var from = range && range.from ? String(range.from) : '';
      var to = range && range.to ? String(range.to) : '';
      var from_min = time_to_min(from);
      var to_min = time_to_min(to);
      if (from_min == null || to_min == null || to_min <= from_min) {
        return;
      }
      out.push({
        from: min_to_time(from_min),
        to: min_to_time(to_min)
      });
    });
    out.sort(function (a, b) {
      return time_to_min(a.from) - time_to_min(b.from);
    });
    return out;
  }

  /**
   * Build minute values represented by visible grid rows.
   *
   * @param {number} from_min First minute in the grid.
   * @param {number} to_min Exclusive grid end minute.
   * @param {number} step Row interval in minutes.
   * @returns {number[]} Grid row minutes.
   */
  function build_row_minutes(from_min, to_min, step) {
    var out = [];
    for (var m = from_min; m < to_min; m += step) {
      out.push(m);
    }
    return out;
  }

  /**
   * Compress selected minutes into adjacent persisted ranges.
   *
   * @param {number[]} minutes Selected minute values.
   * @param {number} step Grid interval in minutes.
   * @returns {Array<{from:string,to:string}>} Compact selected ranges.
   */
  function minutes_to_step_slots(minutes, step) {
    var out = [];
    if (!Array.isArray(minutes) || !minutes.length) {
      return out;
    }
    minutes.sort(function (a, b) {
      return a - b;
    });
    minutes.forEach(function (minute) {
      out.push({
        from: min_to_time(minute),
        to: min_to_time(minute + step)
      });
    });
    return out;
  }

  /**
   * Expand ranges into a set of selected grid minutes.
   *
   * @param {Array<{from:string,to:string}>} ranges Persisted ranges.
   * @param {number} step Grid interval in minutes.
   * @param {number} from_min First visible grid minute.
   * @param {number} to_min Exclusive visible grid end minute.
   * @returns {Set<number>} Selected grid minutes.
   */
  function ranges_to_set(ranges, step, from_min, to_min) {
    var set = {};
    (ranges || []).forEach(function (range) {
      var a = time_to_min(range.from);
      var b = time_to_min(range.to);
      if (a == null || b == null || b <= a) {
        return;
      }
      for (var m = a; m < b; m += step) {
        if (m >= from_min && m < to_min) {
          set[m] = true;
        }
      }
    });
    return set;
  }

  /**
   * Read and normalize the current inspector grid state.
   *
   * @param {HTMLElement} panel Weekday start-time inspector panel.
   * @returns {{start_min:number,end_min:number,step:number,slots:Object,state_el:HTMLElement|null}} Grid state.
   */
  function get_state(panel) {
    var start_el = panel.querySelector('[data-inspector-key="start_time"]');
    var end_el = panel.querySelector('[data-inspector-key="end_time"]');
    var step_el = panel.querySelector('[data-inspector-key="step_minutes"]');
    var start_min = time_to_min(start_el && start_el.value || '10:00');
    var end_min = time_to_min(end_el && end_el.value || '17:00');
    var step = normalize_step(step_el && step_el.value || 30);
    if (start_min == null) {
      start_min = 10 * 60;
    }
    if (end_min == null) {
      end_min = 17 * 60;
    }
    if (end_min <= start_min) {
      end_min = Math.min(1440, start_min + step);
    }
    return {
      start_min: start_min,
      end_min: end_min,
      step: step
    };
  }

  /**
   * Notify the Builder that a persisted inspector control changed.
   *
   * @param {HTMLElement|null} el Changed inspector control.
   * @returns {void}
   */
  function emit_change(el) {
    if (!el) {
      return;
    }
    try {
      if (w.jQuery) {
        w.jQuery(el).trigger('input').trigger('change');
      }
      el.dispatchEvent(new Event('input', {
        bubbles: true
      }));
      el.dispatchEvent(new Event('change', {
        bubbles: true
      }));
    } catch (e) {}
  }

  /**
   * Render the inspector grid rows for the configured interval.
   *
   * @param {HTMLElement} panel Weekday start-time inspector panel.
   * @returns {void}
   */
  function render_grid_rows(panel) {
    var body = panel.querySelector('.wpbc_bfb__weekday_timegrid_body');
    if (!body) {
      return;
    }
    var state = get_state(panel);
    var template = w.wp && w.wp.template ? w.wp.template('wpbc-bfb-weekday-starttime-row') : null;
    body.innerHTML = '';
    build_row_minutes(state.start_min, state.end_min, state.step).forEach(function (minute) {
      var html = template ? template({
        minute: minute,
        label: min_to_time(minute)
      }) : '';
      var wrap = d.createElement('div');
      wrap.innerHTML = html;
      if (wrap.firstElementChild) {
        body.appendChild(wrap.firstElementChild);
      }
    });
  }

  /**
   * Paint persisted weekday ranges into the interactive grid.
   *
   * @param {HTMLElement} panel Weekday start-time inspector panel.
   * @param {Object<string, Array<{from:string,to:string}>>} slots Persisted ranges.
   * @returns {void}
   */
  function paint_slots(panel, slots) {
    var state = get_state(panel);
    var body = panel.querySelector('.wpbc_bfb__weekday_timegrid_body');
    if (!body) {
      return;
    }
    day_order().forEach(function (day_key) {
      var set = ranges_to_set(slots[day_key] || [], state.step, state.start_min, state.end_min);
      body.querySelectorAll('.wpbc_bfb__weekday_timegrid_cell--slot[data-day="' + day_key + '"]').forEach(function (cell) {
        var minute = parseInt(cell.getAttribute('data-minute'), 10);
        cell.classList.toggle('is-on', !!set[minute]);
      });
    });
  }

  /**
   * Read selected cells and compress them into persisted ranges.
   *
   * @param {HTMLElement} panel Weekday start-time inspector panel.
   * @returns {Object<string, Array<{from:string,to:string}>>} Selected ranges by weekday.
   */
  function read_slots(panel) {
    var state = get_state(panel);
    var body = panel.querySelector('.wpbc_bfb__weekday_timegrid_body');
    var out = {};
    if (!body) {
      return normalize_slots({});
    }
    day_order().forEach(function (day_key) {
      var minutes = [];
      body.querySelectorAll('.wpbc_bfb__weekday_timegrid_cell--slot[data-day="' + day_key + '"].is-on').forEach(function (cell) {
        minutes.push(parseInt(cell.getAttribute('data-minute'), 10));
      });
      out[day_key] = minutes_to_step_slots(minutes, state.step);
    });
    return out;
  }

  /**
   * Persist the current grid selection through the standard inspector control.
   *
   * @param {HTMLElement} panel Weekday start-time inspector panel.
   * @returns {void}
   */
  function persist_slots(panel) {
    var state_el = panel.querySelector('.js-weekday-slots-json');
    if (!state_el) {
      return;
    }
    var slots = read_slots(panel);
    state_el.value = JSON.stringify(slots);
    emit_change(state_el);
  }

  /**
   * Apply a drag or click state to a rectangular weekday/time selection.
   *
   * @param {HTMLElement} panel Weekday start-time inspector panel.
   * @param {number} from_day_idx Starting weekday column index.
   * @param {number} to_day_idx Ending weekday column index.
   * @param {number} from_min Starting minute.
   * @param {number} to_min Ending minute.
   * @param {boolean} mode True to select, false to clear.
   * @returns {void}
   */
  function toggle_rect(panel, from_day_idx, to_day_idx, from_min, to_min, mode) {
    var days = day_order();
    var body = panel.querySelector('.wpbc_bfb__weekday_timegrid_body');
    if (!body) {
      return;
    }
    var day_start = Math.min(from_day_idx, to_day_idx);
    var day_end = Math.max(from_day_idx, to_day_idx);
    var min_start = Math.min(from_min, to_min);
    var min_end = Math.max(from_min, to_min);
    for (var i = day_start; i <= day_end; i++) {
      var day_key = days[i];
      body.querySelectorAll('.wpbc_bfb__weekday_timegrid_cell--slot[data-day="' + day_key + '"]').forEach(function (cell) {
        var minute = parseInt(cell.getAttribute('data-minute'), 10);
        if (minute < min_start || minute > min_end) {
          return;
        }
        if (mode === 'on') {
          cell.classList.add('is-on');
        } else {
          cell.classList.remove('is-on');
        }
      });
    }
  }

  /**
   * Bind grid editing and locked-name enforcement to one inspector panel.
   *
   * @param {HTMLElement} panel Weekday start-time inspector panel.
   * @returns {void}
   */
  function bind_grid(panel) {
    if (!panel || panel.__wpbc_weekday_starttime_inited) {
      return;
    }
    panel.__wpbc_weekday_starttime_inited = true;
    var state_el = panel.querySelector('.js-weekday-slots-json');
    var slots = normalize_slots(state_el ? state_el.value : {});

    /**
     * Rebuild grid rows after changing the visible range or interval.
     *
     * @returns {void}
     */
    function rebuild() {
      var current = read_slots(panel);
      render_grid_rows(panel);
      paint_slots(panel, current);
      persist_slots(panel);
    }
    render_grid_rows(panel);
    paint_slots(panel, slots);
    persist_slots(panel);
    panel.querySelectorAll('[data-inspector-key="start_time"], [data-inspector-key="end_time"], [data-inspector-key="step_minutes"]').forEach(function (el) {
      el.addEventListener('change', rebuild);
    });
    panel.querySelectorAll('[data-len-group] [data-len-range]').forEach(function (range) {
      range.addEventListener('input', function () {
        var group = range.closest('[data-len-group]');
        var num = group && group.querySelector('[data-len-value]');
        if (num) {
          num.value = range.value;
          emit_change(num);
        }
      });
    });
    panel.querySelectorAll('[data-len-group] [data-len-value]').forEach(function (num) {
      num.addEventListener('input', function () {
        var group = num.closest('[data-len-group]');
        var range = group && group.querySelector('[data-len-range]');
        if (range) {
          range.value = num.value;
        }
      });
    });
    var body = panel.querySelector('.wpbc_bfb__weekday_timegrid_body');
    var drag = null;
    if (body) {
      body.addEventListener('mousedown', function (ev) {
        var cell = ev.target && ev.target.closest && ev.target.closest('.wpbc_bfb__weekday_timegrid_cell--slot');
        if (!cell) {
          return;
        }
        var days = day_order();
        var day_key = cell.getAttribute('data-day');
        var day_idx = days.indexOf(day_key);
        var minute = parseInt(cell.getAttribute('data-minute'), 10);
        var mode = cell.classList.contains('is-on') ? 'off' : 'on';
        drag = {
          day_idx: day_idx,
          minute: minute,
          mode: mode
        };
        toggle_rect(panel, day_idx, day_idx, minute, minute, mode);
        ev.preventDefault();
      });
      body.addEventListener('mouseover', function (ev) {
        var cell = ev.target && ev.target.closest && ev.target.closest('.wpbc_bfb__weekday_timegrid_cell--slot');
        if (!drag || !cell) {
          return;
        }
        var days = day_order();
        var day_idx = days.indexOf(cell.getAttribute('data-day'));
        var minute = parseInt(cell.getAttribute('data-minute'), 10);
        toggle_rect(panel, drag.day_idx, day_idx, drag.minute, minute, drag.mode);
      });
    }
    w.addEventListener('mouseup', function () {
      if (drag) {
        drag = null;
        persist_slots(panel);
      }
    });
    var copy_default = panel.querySelector('.js-copy-default');
    if (copy_default) {
      copy_default.addEventListener('click', function (ev) {
        ev.preventDefault();
        var current = read_slots(panel);
        weekday_order().forEach(function (day_key) {
          current[day_key] = JSON.parse(JSON.stringify(current['default'] || []));
        });
        paint_slots(panel, current);
        persist_slots(panel);
      });
    }
    var clear_weekdays = panel.querySelector('.js-clear-weekdays');
    if (clear_weekdays) {
      clear_weekdays.addEventListener('click', function (ev) {
        ev.preventDefault();
        var current = read_slots(panel);
        weekday_order().forEach(function (day_key) {
          current[day_key] = [];
        });
        paint_slots(panel, current);
        persist_slots(panel);
      });
    }
    var locked = panel.querySelector('.js-locked-name[data-inspector-key="name"]');
    if (locked) {
      locked.value = 'starttime';
      emit_change(locked);
    }
    var locked_condition = panel.querySelector('.js-locked-condition-name[data-inspector-key="condition_name"]');
    if (locked_condition) {
      locked_condition.value = 'weekday-condition';
      emit_change(locked_condition);
    }
  }

  /**
   * Initialize a newly rendered Weekday start-time inspector when present.
   *
   * @param {Document|HTMLElement} root DOM root to search.
   * @returns {void}
   */
  function try_init_panel(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var panel = root.matches && root.matches('.wpbc_bfb__inspector_weekday_starttime') ? root : root.querySelector('.wpbc_bfb__inspector_weekday_starttime');
    if (panel) {
      bind_grid(panel);
    }
  }

  /**
   * Run a callback after the field renderer registry becomes available.
   *
   * @param {Function} cb Callback receiving the registry and base class.
   * @returns {void}
   */
  function with_registry(cb) {
    var tries = 0;
    (function loop() {
      var registry = (w.WPBC_BFB_Core || {}).WPBC_BFB_Field_Renderer_Registry;
      var base = (w.WPBC_BFB_Core || {}).WPBC_BFB_Field_Base || (w.WPBC_BFB_Core || {}).WPBC_BFB_Select_Base;
      if (registry && registry.register && base) {
        cb(registry, base);
        return;
      }
      if (tries++ < 200) {
        setTimeout(loop, 50);
      }
    })();
  }

  /**
   * Register the Weekday start-time field renderer.
   *
   * @returns {void}
   */
  function register_renderer() {
    with_registry(function (Registry, Base) {
      /**
       * Render and normalize the Weekday start-time Builder field.
       */
      class WPBC_BFB_Field_Weekday_StartTime extends Base {
        static template_id = 'wpbc-bfb-field-weekday_starttime';
        static kind = 'weekday_starttime';

        /**
         * Return persisted defaults for newly inserted fields.
         *
         * @returns {Object} Field defaults merged with the base renderer.
         */
        static get_defaults() {
          var base = super.get_defaults ? super.get_defaults() : {};
          return Object.assign({}, base, {
            type: 'weekday_starttime',
            usage_key: 'starttime',
            label: 'Start time',
            name: 'starttime',
            required: true,
            condition_name: 'weekday-condition',
            is_supported: is_pack_supported(),
            upgrade_text: upgrade_text(),
            start_time: '10:00',
            end_time: '17:00',
            step_minutes: 30,
            slots: default_slots(),
            min_width: '320px'
          });
        }
        /**
         * Render the field preview with current edition support data.
         *
         * @param {HTMLElement} el Field preview element.
         * @param {Object} data Field data.
         * @param {Object} ctx Builder rendering context.
         * @returns {void}
         */
        static render(el, data, ctx) {
          data = data || {};
          data.is_supported = is_pack_supported(data);
          data.upgrade_text = upgrade_text(data);
          if (super.render) {
            super.render(el, data, ctx);
          }
          if (el && el.dataset) {
            el.dataset.is_supported = data.is_supported ? 'true' : 'false';
            el.dataset.upgrade_text = data.upgrade_text || '';
          }
        }
        /**
         * Lock the canonical starttime name after a palette drop.
         *
         * @param {Object} data New field data.
         * @param {HTMLElement} el Dropped field element.
         * @param {Object} ctx Builder drop context.
         * @returns {void}
         */
        static on_field_drop(data, el, ctx) {
          if (super.on_field_drop) {
            super.on_field_drop(data, el, ctx);
          }
          if (data) {
            data.usage_key = 'starttime';
            data.name = 'starttime';
            data.condition_name = 'weekday-condition';
            data.multiple = false;
            data.is_supported = is_pack_supported(data);
            data.upgrade_text = upgrade_text(data);
          }
          if (el && el.dataset) {
            el.dataset.usage_key = 'starttime';
            el.dataset.name = 'starttime';
            el.dataset.autoname = '0';
            el.dataset.fresh = '0';
            el.dataset.name_user_touched = '1';
          }
        }
      }
      try {
        Registry.register('weekday_starttime', WPBC_BFB_Field_Weekday_StartTime);
      } catch (e) {}
      w.WPBC_BFB_Field_Weekday_StartTime = WPBC_BFB_Field_Weekday_StartTime;
    });
  }
  register_renderer();
  d.addEventListener('wpbc_bfb_inspector_ready', function (ev) {
    try_init_panel(ev && ev.detail && ev.detail.panel);
  });
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', function () {
      try_init_panel(d);
    });
  } else {
    try_init_panel(d);
  }
  try {
    var observer = new MutationObserver(function (muts) {
      muts.forEach(function (mut) {
        Array.prototype.forEach.call(mut.addedNodes || [], function (node) {
          if (node.nodeType === 1) {
            try_init_panel(node);
          }
        });
      });
    });
    observer.observe(d.documentElement, {
      childList: true,
      subtree: true
    });
  } catch (e) {}

  /**
   * Escape text for a Booking Form shortcode option.
   *
   * @param {*} value Candidate shortcode value.
   * @returns {string} Escaped shortcode value.
   */
  function escape_shortcode(value) {
    var sanitize = (w.WPBC_BFB_Core || {}).WPBC_BFB_Sanitize || {};
    if (sanitize.escape_for_shortcode) {
      return sanitize.escape_for_shortcode(String(value || ''));
    }
    return String(value || '').replace(/"/g, '&quot;').replace(/\r?\n/g, ' ');
  }

  /**
   * Escape text for generated Advanced-form HTML.
   *
   * @param {*} value Candidate HTML text.
   * @returns {string} Escaped HTML text.
   */
  function escape_html(value) {
    var sanitize = (w.WPBC_BFB_Core || {}).WPBC_BFB_Sanitize || {};
    if (sanitize.escape_html) {
      return sanitize.escape_html(String(value || ''));
    }
    return String(value || '').replace(/[&<>"']/g, function (ch) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[ch];
    });
  }

  /**
   * Sanitize the fixed weekday-condition token.
   *
   * @param {*} value Candidate condition name.
   * @returns {string} Safe condition token.
   */
  function sanitize_condition_name(value) {
    var sanitize = (w.WPBC_BFB_Core || {}).WPBC_BFB_Sanitize || {};
    if (sanitize.to_token) {
      return sanitize.to_token(String(value || 'weekday-condition')) || 'weekday-condition';
    }
    return String(value || 'weekday-condition').replace(/[^0-9A-Za-z:._-]/g, '') || 'weekday-condition';
  }

  /**
   * Build a stable signature for grouping matching weekday ranges.
   *
   * @param {Array<{from:string,to:string}>} ranges Persisted ranges.
   * @returns {string} Comparable range signature.
   */
  function slots_signature(ranges) {
    return sanitize_ranges(ranges).map(function (range) {
      return range.from + '-' + range.to;
    }).join('|');
  }

  /**
   * Expand compact ranges into individual start-time shortcode tokens.
   *
   * @param {Array<{from:string,to:string}>} ranges Persisted ranges.
   * @param {number|string} step_minutes Start-time interval.
   * @returns {string} Space-delimited quoted shortcode options.
   */
  function slot_tokens(ranges, step_minutes) {
    var tokens = [];
    var step = normalize_step(step_minutes);
    sanitize_ranges(ranges).forEach(function (range) {
      var from_min = time_to_min(range.from);
      var to_min = time_to_min(range.to);
      for (var minute = from_min; minute < to_min; minute += step) {
        tokens.push('"' + escape_shortcode(min_to_time(minute)) + '"');
      }
    });
    return tokens.join(' ');
  }

  /**
   * Convert the Sunday field key to the condition shortcode value.
   *
   * @param {string} day_key Persisted weekday key.
   * @returns {string} Weekday condition value.
   */
  function weekday_to_condition_value(day_key) {
    return day_key === '7' ? '0' : day_key;
  }

  /**
   * Build one weekday condition shortcode block.
   *
   * @param {string} condition_name Condition group name.
   * @param {string} value Weekday values or wildcard.
   * @param {string} select_shortcode Generated starttime selector.
   * @returns {string} Complete condition block.
   */
  function condition_block(condition_name, value, select_shortcode) {
    return ['[condition name="' + condition_name + '" type="weekday" value="' + value + '"]', '\t' + select_shortcode, '[/condition]'].join('\n');
  }

  /**
   * Build safe wrapper attributes used by the exported field.
   *
   * @param {Object} field Field data.
   * @param {Object} ctx Exporter context containing used HTML IDs.
   * @returns {string} Escaped HTML attribute string.
   */
  function build_wrapper_attrs(field, ctx) {
    var sanitize = (w.WPBC_BFB_Core || {}).WPBC_BFB_Sanitize || {};
    var attrs = '';
    var cls = field && (field.cssclass || field.class || field.className) ? String(field.cssclass || field.class || field.className) : '';
    var html_id = field && field.html_id ? String(field.html_id) : '';
    var min_width = field && field.min_width ? String(field.min_width).trim() : '';
    if (sanitize.sanitize_css_classlist) {
      cls = sanitize.sanitize_css_classlist(cls);
    } else {
      cls = cls.replace(/[^0-9A-Za-z_ -]/g, '').replace(/\s+/g, ' ').trim();
    }
    if (sanitize.sanitize_html_id) {
      html_id = sanitize.sanitize_html_id(html_id);
    } else {
      html_id = html_id.replace(/[^0-9A-Za-z_-]/g, '');
    }
    if (html_id && ctx && ctx.usedIds) {
      var unique_id = html_id;
      var suffix = 2;
      while (ctx.usedIds.has(unique_id)) {
        unique_id = html_id + '_' + suffix++;
      }
      ctx.usedIds.add(unique_id);
      html_id = unique_id;
    }
    if (html_id) {
      attrs += ' id="' + escape_html(html_id) + '"';
    }
    if (cls) {
      attrs += ' class="' + escape_html(cls) + '"';
    }
    if (min_width) {
      min_width = min_width.replace(/[^0-9A-Za-z.%() ,+-]/g, '');
      if (min_width) {
        attrs += ' style="min-width:' + escape_html(min_width) + ';"';
      }
    }
    return attrs;
  }

  /**
   * Wrap exported condition blocks when appearance attributes require it.
   *
   * @param {Object} field Field data.
   * @param {string} body Generated field body.
   * @param {Object} ctx Exporter context.
   * @returns {string} Original or wrapped field body.
   */
  function wrap_body_if_needed(field, body, ctx) {
    var attrs = build_wrapper_attrs(field, ctx);
    if (!attrs) {
      return body;
    }
    return '<div' + attrs + '>\n' + body + '\n</div>';
  }

  /**
   * Emit an optional label followed by exported condition blocks.
   *
   * @param {Object} field Field data.
   * @param {Function} emit Exporter output callback.
   * @param {string} body Generated field body.
   * @param {Object} cfg Exporter configuration.
   * @param {Object} ctx Exporter context.
   * @returns {void}
   */
  function emit_label_then_clear(field, emit, body, cfg, ctx) {
    cfg = cfg || {};
    var add_labels = cfg.addLabels !== false;
    var label = field && typeof field.label === 'string' ? field.label.trim() : '';
    var Exp = w.WPBC_BFB_Exporter;
    var req = Exp && Exp.is_required && Exp.is_required(field) ? '*' : '';
    var wrapped_body = wrap_body_if_needed(field, body, ctx);
    if (label && add_labels) {
      emit('<l>' + escape_html(label) + req + '</l>');
      emit('<div style="clear:both;flex: 1 1 100%;"></div>');
      emit(wrapped_body);
      return;
    }
    emit(wrapped_body);
  }

  /**
   * Return frontend markup used when a weekday has no start times.
   *
   * @returns {string} No-start-times markup.
   */
  function no_slots_markup() {
    return '<span class="wpbc_no_time_slots">No start times available.</span>';
  }

  /**
   * Build a canonical starttime selector for one weekday group.
   *
   * @param {Object} field Field data.
   * @param {Array<{from:string,to:string}>} ranges Persisted ranges.
   * @returns {string} Starttime shortcode or empty-state markup.
   */
  function select_shortcode_for_slots(field, ranges) {
    var Exp = w.WPBC_BFB_Exporter;
    var req = Exp && Exp.is_required && Exp.is_required(field) ? '*' : '';
    var tokens = slot_tokens(ranges, field && field.step_minutes);
    if (!tokens) {
      return no_slots_markup();
    }
    return '[selectbox' + req + ' starttime ' + tokens + ']';
  }

  /**
   * Register Advanced booking-form export for weekday start times.
   *
   * @returns {void}
   */
  function register_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('weekday_starttime')) {
      return;
    }
    Exp.register('weekday_starttime', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var ctx = extras.ctx || {};
      if (!is_pack_supported(field)) {
        emit_label_then_clear(field, emit, '<div class="wpbc_bfb__upgrade_required">' + escape_html(upgrade_text(field)) + '</div>', cfg, ctx);
        return;
      }
      var condition_name = 'weekday-condition';
      var slots = normalize_slots(field && field.slots);
      var default_ranges = slots['default'] || [];
      var blocks = [];
      blocks.push(condition_block(condition_name, '*', select_shortcode_for_slots(field, default_ranges)));
      var groups = {};
      var default_sig = slots_signature(default_ranges);
      weekday_order().forEach(function (day_key) {
        var ranges = slots[day_key] || [];
        var sig = slots_signature(ranges);
        if (sig === default_sig) {
          return;
        }
        if (!groups[sig]) {
          groups[sig] = {
            days: [],
            ranges: ranges
          };
        }
        groups[sig].days.push(weekday_to_condition_value(day_key));
      });
      Object.keys(groups).forEach(function (sig) {
        var group = groups[sig];
        blocks.push(condition_block(condition_name, group.days.join(','), select_shortcode_for_slots(field, group.ranges)));
      });
      var body = blocks.join('\n');
      emit_label_then_clear(field, emit, body, cfg, ctx);
    });
  }
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_booking_form_exporter();
  } else {
    d.addEventListener('wpbc:bfb:exporter-ready', register_booking_form_exporter, {
      once: true
    });
  }

  /**
   * Register Booking Data export for the canonical starttime field.
   *
   * @returns {void}
   */
  function register_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('weekday_starttime')) {
      return;
    }
    C.register('weekday_starttime', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var label = field && typeof field.label === 'string' && field.label.trim() ? field.label.trim() : 'Start time';
      if (!is_pack_supported(field)) {
        return;
      }
      if (C.emit_line_bold_field) {
        C.emit_line_bold_field(emit, label, 'starttime', cfg);
      } else {
        emit('<b>' + escape_html(label) + '</b>: <f>[starttime]</f><br>');
      }
    });
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_booking_data_exporter();
  } else {
    d.addEventListener('wpbc:bfb:content-exporter-ready', register_booking_data_exporter, {
      once: true
    });
  }
  var css = '' + '.wpbc_bfb__weekday_time_preview{border:1px solid #e3e3e3;border-radius:6px;padding:8px;background:#fff;}' + '.wpbc_bfb__weekday_time_preview__row{display:flex;align-items:flex-start;gap:8px;margin:3px 0;}' + '.wpbc_bfb__weekday_time_preview__day{width:52px;font-size:12px;font-weight:600;opacity:.8;}' + '.wpbc_bfb__weekday_time_preview__slots{flex:1;}' + '.wpbc_bfb__weekday_time_badge{display:inline-block;border:1px solid #d5d5d5;border-radius:12px;padding:2px 8px;margin:0 4px 4px 0;font-size:11px;background:#f8f8f8;}' + '.wpbc_bfb__weekday_time_badge--empty{opacity:.6;}' + '.wpbc_bfb__weekday_timegrid_toolbar{display:flex;gap:8px;margin:8px 0;}' + '.wpbc_bfb__weekday_timegrid_root{border:1px solid #ddd;border-radius:6px;overflow:auto;margin-top:6px;}' + '.wpbc_bfb__weekday_timegrid_head,.wpbc_bfb__weekday_timegrid_row{display:grid;grid-template-columns:76px 92px repeat(7,64px);min-width:616px;}' + '.wpbc_bfb__weekday_timegrid_cell{border-bottom:1px solid #eee;border-right:1px solid #f4f4f4;box-sizing:border-box;min-height:24px;padding:4px;}' + '.wpbc_bfb__weekday_timegrid_cell--corner,.wpbc_bfb__weekday_timegrid_cell--day,.wpbc_bfb__weekday_timegrid_cell--time{background:#fafafa;}' + '.wpbc_bfb__weekday_timegrid_cell--day{text-align:center;font-weight:600;}' + '.wpbc_bfb__weekday_timegrid_cell--time{font-variant-numeric:tabular-nums;}' + '.wpbc_bfb__weekday_timegrid_cell--slot{cursor:crosshair;}' + '.wpbc_bfb__weekday_timegrid_cell--slot.is-on{background:rgba(0,120,212,.14);outline:1px solid rgba(0,120,212,.35);}';
  try {
    var style = d.createElement('style');
    style.type = 'text/css';
    style.appendChild(d.createTextNode(css));
    d.head.appendChild(style);
  } catch (e) {}
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvd2Vla2RheS1zdGFydHRpbWUvX291dC9maWVsZC13ZWVrZGF5LXN0YXJ0dGltZS13cHRwbC5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJwYWQyIiwibiIsInBhcnNlSW50IiwidGltZV90b19taW4iLCJ0IiwibSIsIm1hdGNoIiwiaCIsIm1pbiIsIm1pbl90b190aW1lIiwibWlucyIsImlzRmluaXRlIiwiTWF0aCIsImZsb29yIiwibm9ybWFsaXplX3N0ZXAiLCJzdGVwIiwicyIsImRheV9vcmRlciIsIndlZWtkYXlfb3JkZXIiLCJkZWZhdWx0X3Nsb3RzIiwic2xvdHMiLCJmcm9tIiwidG8iLCJzbGljZSIsImdldF9ib290IiwiV1BCQ19CRkJfV2Vla2RheV9TdGFydHRpbWVfQm9vdCIsImlzX3N1cHBvcnRlZF92YWx1ZSIsInZhbHVlIiwiaXNfcGFja19zdXBwb3J0ZWQiLCJmaWVsZCIsImJvb3QiLCJpc19zdXBwb3J0ZWQiLCJ1cGdyYWRlX3RleHQiLCJTdHJpbmciLCJub3JtYWxpemVfc2xvdHMiLCJyYXciLCJiYXNlIiwib3V0IiwicGFyc2VkIiwiSlNPTiIsInBhcnNlIiwiZSIsIkFycmF5IiwiaXNBcnJheSIsImZvckVhY2giLCJrZXkiLCJyYW5nZXMiLCJzYW5pdGl6ZV9yYW5nZXMiLCJyYW5nZSIsImZyb21fbWluIiwidG9fbWluIiwicHVzaCIsInNvcnQiLCJhIiwiYiIsImJ1aWxkX3Jvd19taW51dGVzIiwibWludXRlc190b19zdGVwX3Nsb3RzIiwibWludXRlcyIsImxlbmd0aCIsIm1pbnV0ZSIsInJhbmdlc190b19zZXQiLCJzZXQiLCJnZXRfc3RhdGUiLCJwYW5lbCIsInN0YXJ0X2VsIiwicXVlcnlTZWxlY3RvciIsImVuZF9lbCIsInN0ZXBfZWwiLCJzdGFydF9taW4iLCJlbmRfbWluIiwiZW1pdF9jaGFuZ2UiLCJlbCIsImpRdWVyeSIsInRyaWdnZXIiLCJkaXNwYXRjaEV2ZW50IiwiRXZlbnQiLCJidWJibGVzIiwicmVuZGVyX2dyaWRfcm93cyIsImJvZHkiLCJzdGF0ZSIsInRlbXBsYXRlIiwid3AiLCJpbm5lckhUTUwiLCJodG1sIiwibGFiZWwiLCJ3cmFwIiwiY3JlYXRlRWxlbWVudCIsImZpcnN0RWxlbWVudENoaWxkIiwiYXBwZW5kQ2hpbGQiLCJwYWludF9zbG90cyIsImRheV9rZXkiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY2VsbCIsImdldEF0dHJpYnV0ZSIsImNsYXNzTGlzdCIsInRvZ2dsZSIsInJlYWRfc2xvdHMiLCJwZXJzaXN0X3Nsb3RzIiwic3RhdGVfZWwiLCJzdHJpbmdpZnkiLCJ0b2dnbGVfcmVjdCIsImZyb21fZGF5X2lkeCIsInRvX2RheV9pZHgiLCJtb2RlIiwiZGF5cyIsImRheV9zdGFydCIsImRheV9lbmQiLCJtYXgiLCJtaW5fc3RhcnQiLCJtaW5fZW5kIiwiaSIsImFkZCIsInJlbW92ZSIsImJpbmRfZ3JpZCIsIl9fd3BiY193ZWVrZGF5X3N0YXJ0dGltZV9pbml0ZWQiLCJyZWJ1aWxkIiwiY3VycmVudCIsImFkZEV2ZW50TGlzdGVuZXIiLCJncm91cCIsImNsb3Nlc3QiLCJudW0iLCJkcmFnIiwiZXYiLCJ0YXJnZXQiLCJkYXlfaWR4IiwiaW5kZXhPZiIsImNvbnRhaW5zIiwicHJldmVudERlZmF1bHQiLCJjb3B5X2RlZmF1bHQiLCJjbGVhcl93ZWVrZGF5cyIsImxvY2tlZCIsImxvY2tlZF9jb25kaXRpb24iLCJ0cnlfaW5pdF9wYW5lbCIsInJvb3QiLCJtYXRjaGVzIiwid2l0aF9yZWdpc3RyeSIsImNiIiwidHJpZXMiLCJsb29wIiwicmVnaXN0cnkiLCJXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJXUEJDX0JGQl9TZWxlY3RfQmFzZSIsInJlZ2lzdGVyIiwic2V0VGltZW91dCIsInJlZ2lzdGVyX3JlbmRlcmVyIiwiUmVnaXN0cnkiLCJCYXNlIiwiV1BCQ19CRkJfRmllbGRfV2Vla2RheV9TdGFydFRpbWUiLCJ0ZW1wbGF0ZV9pZCIsImtpbmQiLCJnZXRfZGVmYXVsdHMiLCJPYmplY3QiLCJhc3NpZ24iLCJ0eXBlIiwidXNhZ2Vfa2V5IiwibmFtZSIsInJlcXVpcmVkIiwiY29uZGl0aW9uX25hbWUiLCJzdGFydF90aW1lIiwiZW5kX3RpbWUiLCJzdGVwX21pbnV0ZXMiLCJtaW5fd2lkdGgiLCJyZW5kZXIiLCJkYXRhIiwiY3R4IiwiZGF0YXNldCIsIm9uX2ZpZWxkX2Ryb3AiLCJtdWx0aXBsZSIsImF1dG9uYW1lIiwiZnJlc2giLCJuYW1lX3VzZXJfdG91Y2hlZCIsImRldGFpbCIsInJlYWR5U3RhdGUiLCJvYnNlcnZlciIsIk11dGF0aW9uT2JzZXJ2ZXIiLCJtdXRzIiwibXV0IiwicHJvdG90eXBlIiwiY2FsbCIsImFkZGVkTm9kZXMiLCJub2RlIiwibm9kZVR5cGUiLCJvYnNlcnZlIiwiZG9jdW1lbnRFbGVtZW50IiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsImVzY2FwZV9zaG9ydGNvZGUiLCJzYW5pdGl6ZSIsIldQQkNfQkZCX1Nhbml0aXplIiwiZXNjYXBlX2Zvcl9zaG9ydGNvZGUiLCJyZXBsYWNlIiwiZXNjYXBlX2h0bWwiLCJjaCIsInNhbml0aXplX2NvbmRpdGlvbl9uYW1lIiwidG9fdG9rZW4iLCJzbG90c19zaWduYXR1cmUiLCJtYXAiLCJqb2luIiwic2xvdF90b2tlbnMiLCJ0b2tlbnMiLCJ3ZWVrZGF5X3RvX2NvbmRpdGlvbl92YWx1ZSIsImNvbmRpdGlvbl9ibG9jayIsInNlbGVjdF9zaG9ydGNvZGUiLCJidWlsZF93cmFwcGVyX2F0dHJzIiwiYXR0cnMiLCJjbHMiLCJjc3NjbGFzcyIsImNsYXNzIiwiY2xhc3NOYW1lIiwiaHRtbF9pZCIsInRyaW0iLCJzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0Iiwic2FuaXRpemVfaHRtbF9pZCIsInVzZWRJZHMiLCJ1bmlxdWVfaWQiLCJzdWZmaXgiLCJoYXMiLCJ3cmFwX2JvZHlfaWZfbmVlZGVkIiwiZW1pdF9sYWJlbF90aGVuX2NsZWFyIiwiZW1pdCIsImNmZyIsImFkZF9sYWJlbHMiLCJhZGRMYWJlbHMiLCJFeHAiLCJXUEJDX0JGQl9FeHBvcnRlciIsInJlcSIsImlzX3JlcXVpcmVkIiwid3JhcHBlZF9ib2R5Iiwibm9fc2xvdHNfbWFya3VwIiwic2VsZWN0X3Nob3J0Y29kZV9mb3Jfc2xvdHMiLCJyZWdpc3Rlcl9ib29raW5nX2Zvcm1fZXhwb3J0ZXIiLCJoYXNfZXhwb3J0ZXIiLCJleHRyYXMiLCJkZWZhdWx0X3JhbmdlcyIsImJsb2NrcyIsImdyb3VwcyIsImRlZmF1bHRfc2lnIiwic2lnIiwia2V5cyIsIm9uY2UiLCJyZWdpc3Rlcl9ib29raW5nX2RhdGFfZXhwb3J0ZXIiLCJDIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwiZW1pdF9saW5lX2JvbGRfZmllbGQiLCJjc3MiLCJzdHlsZSIsImNyZWF0ZVRleHROb2RlIiwiaGVhZCIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvd2Vla2RheS1zdGFydHRpbWUvX3NyYy9maWVsZC13ZWVrZGF5LXN0YXJ0dGltZS13cHRwbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBXUEJDIEJGQiBQYWNrOiBXZWVrZGF5IFN0YXJ0IFRpbWUuXG4oZnVuY3Rpb24gKHcsIGQpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBDb3JlID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xuXG5cdC8qKlxuXHQgKiBQYWQgYW4gaW50ZWdlciB0byB0d28gZGlnaXRzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IG4gTnVtYmVyIHRvIHBhZC5cblx0ICogQHJldHVybnMge3N0cmluZ30gVHdvLWRpZ2l0IG51bWJlciBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiBwYWQyKG4pIHtcblx0XHRuID0gcGFyc2VJbnQobiwgMTApO1xuXHRcdHJldHVybiAobiA8IDEwID8gJzAnIDogJycpICsgbjtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0IGEgMjQtaG91ciB0aW1lIHN0cmluZyB0byBtaW51dGVzIGFmdGVyIG1pZG5pZ2h0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdCBUaW1lIGluIEhIOk1NIGZvcm1hdC5cblx0ICogQHJldHVybnMge251bWJlcnxudWxsfSBNaW51dGUgdmFsdWUsIG9yIG51bGwgZm9yIGludmFsaWQgaW5wdXQuXG5cdCAqL1xuXHRmdW5jdGlvbiB0aW1lX3RvX21pbih0KSB7XG5cdFx0aWYgKCF0IHx8IHR5cGVvZiB0ICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHZhciBtID0gdC5tYXRjaCgvXihcXGR7MSwyfSk6KFxcZHsyfSkkLyk7XG5cdFx0aWYgKCFtKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0dmFyIGggPSBwYXJzZUludChtWzFdLCAxMCk7XG5cdFx0dmFyIG1pbiA9IHBhcnNlSW50KG1bMl0sIDEwKTtcblx0XHRpZiAoaCA8IDAgfHwgaCA+IDIzIHx8IG1pbiA8IDAgfHwgbWluID4gNTkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gaCAqIDYwICsgbWluO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnQgbWludXRlcyBhZnRlciBtaWRuaWdodCB0byBhIG5vcm1hbGl6ZWQgMjQtaG91ciB0aW1lLlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IG1pbnMgTWludXRlIHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfSBUaW1lIGluIEhIOk1NIGZvcm1hdC5cblx0ICovXG5cdGZ1bmN0aW9uIG1pbl90b190aW1lKG1pbnMpIHtcblx0XHR2YXIgbSA9IHBhcnNlSW50KG1pbnMsIDEwKTtcblx0XHRpZiAoIWlzRmluaXRlKG0pKSB7XG5cdFx0XHRtID0gMDtcblx0XHR9XG5cdFx0bSA9ICgobSAlIDE0NDApICsgMTQ0MCkgJSAxNDQwO1xuXHRcdHJldHVybiBwYWQyKE1hdGguZmxvb3IobSAvIDYwKSkgKyAnOicgKyBwYWQyKG0gJSA2MCk7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHRoZSBncmlkIGludGVydmFsIHRvIHRoZSBzdXBwb3J0ZWQgcmFuZ2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gc3RlcCBSZXF1ZXN0ZWQgaW50ZXJ2YWwgaW4gbWludXRlcy5cblx0ICogQHJldHVybnMge251bWJlcn0gSW50ZXJ2YWwgYmV0d2VlbiA1IGFuZCAxODAgbWludXRlcy5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zdGVwKHN0ZXApIHtcblx0XHR2YXIgcyA9IHBhcnNlSW50KHN0ZXAsIDEwKTtcblx0XHRpZiAoIWlzRmluaXRlKHMpIHx8IHMgPCA1KSB7XG5cdFx0XHRzID0gNTtcblx0XHR9XG5cdFx0aWYgKHMgPiAxODApIHtcblx0XHRcdHMgPSAxODA7XG5cdFx0fVxuXHRcdHJldHVybiBzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgcGVyc2lzdGVkIHN0YXJ0LXRpbWUgZ3JvdXAgb3JkZXIuXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtzdHJpbmdbXX0gRGVmYXVsdCBncm91cCBmb2xsb3dlZCBieSBNb25kYXkgdGhyb3VnaCBTdW5kYXkuXG5cdCAqL1xuXHRmdW5jdGlvbiBkYXlfb3JkZXIoKSB7XG5cdFx0cmV0dXJuIFsnZGVmYXVsdCcsICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3J107XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHdlZWtkYXkga2V5cyB3aXRob3V0IHRoZSBkZWZhdWx0IGdyb3VwLlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nW119IE1vbmRheSB0aHJvdWdoIFN1bmRheSBrZXlzLlxuXHQgKi9cblx0ZnVuY3Rpb24gd2Vla2RheV9vcmRlcigpIHtcblx0XHRyZXR1cm4gWycxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3J107XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgdGhlIGRlZmF1bHQgMTA6MDAgdGhyb3VnaCAxNjozMCB3ZWVrZGF5IHN0YXJ0LXRpbWUgd2luZG93cy5cblx0ICpcblx0ICogUmFuZ2VzIHJlbWFpbiB0aGUgY29tcGFjdCBwZXJzaXN0ZWQgcmVwcmVzZW50YXRpb247IHRoZSBleHBvcnRlciBleHBhbmRzXG5cdCAqIGVhY2ggcmFuZ2UgaW50byBpbmRpdmlkdWFsIHN0YXJ0IHRpbWVzIHVzaW5nIHRoZSBjb25maWd1cmVkIGludGVydmFsLlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7T2JqZWN0PHN0cmluZywgQXJyYXk8e2Zyb206c3RyaW5nLHRvOnN0cmluZ30+Pn0gRGVmYXVsdCByYW5nZXMgYnkgd2Vla2RheS5cblx0ICovXG5cdGZ1bmN0aW9uIGRlZmF1bHRfc2xvdHMoKSB7XG5cdFx0dmFyIHNsb3RzID0gWyB7IGZyb206ICcxMDowMCcsIHRvOiAnMTc6MDAnIH0gXTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHQnZGVmYXVsdCc6IHNsb3RzLnNsaWNlKCksXG5cdFx0XHQnMSc6IHNsb3RzLnNsaWNlKCksXG5cdFx0XHQnMic6IHNsb3RzLnNsaWNlKCksXG5cdFx0XHQnMyc6IHNsb3RzLnNsaWNlKCksXG5cdFx0XHQnNCc6IHNsb3RzLnNsaWNlKCksXG5cdFx0XHQnNSc6IHNsb3RzLnNsaWNlKCksXG5cdFx0XHQnNic6IHNsb3RzLnNsaWNlKCksXG5cdFx0XHQnNyc6IHNsb3RzLnNsaWNlKClcblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlYWQgc2VydmVyLWxvY2FsaXplZCBlZGl0aW9uIHN1cHBvcnQgZGF0YS5cblx0ICpcblx0ICogQHJldHVybnMge09iamVjdH0gTG9jYWxpemVkIGZpZWxkLXBhY2sgY29uZmlndXJhdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9ib290KCkge1xuXHRcdHJldHVybiB3LldQQkNfQkZCX1dlZWtkYXlfU3RhcnR0aW1lX0Jvb3QgfHwge307XG5cdH1cblxuXHQvKipcblx0ICogSW50ZXJwcmV0IHN1cHBvcnRlZC1zdGF0ZSB2YWx1ZXMgZnJvbSBQSFAgb3IgcGVyc2lzdGVkIEpTT04uXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gdmFsdWUgQ2FuZGlkYXRlIHN1cHBvcnRlZC1zdGF0ZSB2YWx1ZS5cblx0ICogQHJldHVybnMge2Jvb2xlYW59IFdoZXRoZXIgdGhlIHZhbHVlIHJlcHJlc2VudHMgdHJ1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGlzX3N1cHBvcnRlZF92YWx1ZSh2YWx1ZSkge1xuXHRcdHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3RydWUnIHx8IHZhbHVlID09PSAxIHx8IHZhbHVlID09PSAnMSc7XG5cdH1cblxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIGFjdGl2ZSBlZGl0aW9uIHN1cHBvcnRzIHdlZWtkYXkgY29uZGl0aW9ucy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IFtmaWVsZF0gUGVyc2lzdGVkIGZpZWxkIGRhdGEgZmFsbGJhY2suXG5cdCAqIEByZXR1cm5zIHtib29sZWFufSBXaGV0aGVyIHRoZSBwYWNrIGNhbiBleHBvcnQgYW4gb3BlcmF0aW9uYWwgZmllbGQuXG5cdCAqL1xuXHRmdW5jdGlvbiBpc19wYWNrX3N1cHBvcnRlZChmaWVsZCkge1xuXHRcdHZhciBib290ID0gZ2V0X2Jvb3QoKTtcblx0XHRpZiAoYm9vdCAmJiB0eXBlb2YgYm9vdC5pc19zdXBwb3J0ZWQgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gaXNfc3VwcG9ydGVkX3ZhbHVlKGJvb3QuaXNfc3VwcG9ydGVkKTtcblx0XHR9XG5cdFx0cmV0dXJuIGlzX3N1cHBvcnRlZF92YWx1ZShmaWVsZCAmJiBmaWVsZC5pc19zdXBwb3J0ZWQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc29sdmUgdGhlIGVkaXRpb24tdXBncmFkZSBtZXNzYWdlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2ZpZWxkXSBQZXJzaXN0ZWQgZmllbGQgZGF0YSBmYWxsYmFjay5cblx0ICogQHJldHVybnMge3N0cmluZ30gVXBncmFkZSBndWlkYW5jZS5cblx0ICovXG5cdGZ1bmN0aW9uIHVwZ3JhZGVfdGV4dChmaWVsZCkge1xuXHRcdHZhciBib290ID0gZ2V0X2Jvb3QoKTtcblx0XHRyZXR1cm4gU3RyaW5nKChib290ICYmIGJvb3QudXBncmFkZV90ZXh0KSB8fCAoZmllbGQgJiYgZmllbGQudXBncmFkZV90ZXh0KSB8fCAnVGhpcyBmaWVsZCBpcyBhdmFpbGFibGUgb25seSBpbiBCb29raW5nIENhbGVuZGFyIEJ1c2luZXNzIE1lZGl1bSBvciBoaWdoZXIgdmVyc2lvbnMuJyk7XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIHBlcnNpc3RlZCB3ZWVrZGF5IHJhbmdlcyBhbmQgZmlsbCBtaXNzaW5nIGdyb3Vwcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R8c3RyaW5nfSByYXcgUGVyc2lzdGVkIHJhbmdlIG1hcCBvciBKU09OIHN0cmluZy5cblx0ICogQHJldHVybnMge09iamVjdDxzdHJpbmcsIEFycmF5PHtmcm9tOnN0cmluZyx0bzpzdHJpbmd9Pj59IFNhbml0aXplZCByYW5nZXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfc2xvdHMocmF3KSB7XG5cdFx0dmFyIGJhc2UgPSBkZWZhdWx0X3Nsb3RzKCk7XG5cdFx0dmFyIG91dCA9IHt9O1xuXHRcdHZhciBwYXJzZWQgPSByYXc7XG5cblx0XHRpZiAodHlwZW9mIHBhcnNlZCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHBhcnNlZCA9IEpTT04ucGFyc2UocGFyc2VkKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0cGFyc2VkID0ge307XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghcGFyc2VkIHx8IHR5cGVvZiBwYXJzZWQgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocGFyc2VkKSkge1xuXHRcdFx0cGFyc2VkID0ge307XG5cdFx0fVxuXG5cdFx0ZGF5X29yZGVyKCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG5cdFx0XHR2YXIgcmFuZ2VzID0gQXJyYXkuaXNBcnJheShwYXJzZWRba2V5XSkgPyBwYXJzZWRba2V5XSA6IGJhc2Vba2V5XTtcblx0XHRcdG91dFtrZXldID0gc2FuaXRpemVfcmFuZ2VzKHJhbmdlcyk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBTYW5pdGl6ZSwgc29ydCwgYW5kIG5vcm1hbGl6ZSBjb21wYWN0IHRpbWUgcmFuZ2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PHtmcm9tOnN0cmluZyx0bzpzdHJpbmd9Pn0gcmFuZ2VzIENhbmRpZGF0ZSB0aW1lIHJhbmdlcy5cblx0ICogQHJldHVybnMge0FycmF5PHtmcm9tOnN0cmluZyx0bzpzdHJpbmd9Pn0gVmFsaWQgb3JkZXJlZCByYW5nZXMuXG5cdCAqL1xuXHRmdW5jdGlvbiBzYW5pdGl6ZV9yYW5nZXMocmFuZ2VzKSB7XG5cdFx0dmFyIG91dCA9IFtdO1xuXHRcdChyYW5nZXMgfHwgW10pLmZvckVhY2goZnVuY3Rpb24gKHJhbmdlKSB7XG5cdFx0XHR2YXIgZnJvbSA9IHJhbmdlICYmIHJhbmdlLmZyb20gPyBTdHJpbmcocmFuZ2UuZnJvbSkgOiAnJztcblx0XHRcdHZhciB0byA9IHJhbmdlICYmIHJhbmdlLnRvID8gU3RyaW5nKHJhbmdlLnRvKSA6ICcnO1xuXHRcdFx0dmFyIGZyb21fbWluID0gdGltZV90b19taW4oZnJvbSk7XG5cdFx0XHR2YXIgdG9fbWluID0gdGltZV90b19taW4odG8pO1xuXHRcdFx0aWYgKGZyb21fbWluID09IG51bGwgfHwgdG9fbWluID09IG51bGwgfHwgdG9fbWluIDw9IGZyb21fbWluKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG91dC5wdXNoKHsgZnJvbTogbWluX3RvX3RpbWUoZnJvbV9taW4pLCB0bzogbWluX3RvX3RpbWUodG9fbWluKSB9KTtcblx0XHR9KTtcblx0XHRvdXQuc29ydChmdW5jdGlvbiAoYSwgYikge1xuXHRcdFx0cmV0dXJuIHRpbWVfdG9fbWluKGEuZnJvbSkgLSB0aW1lX3RvX21pbihiLmZyb20pO1xuXHRcdH0pO1xuXHRcdHJldHVybiBvdXQ7XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgbWludXRlIHZhbHVlcyByZXByZXNlbnRlZCBieSB2aXNpYmxlIGdyaWQgcm93cy5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IGZyb21fbWluIEZpcnN0IG1pbnV0ZSBpbiB0aGUgZ3JpZC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHRvX21pbiBFeGNsdXNpdmUgZ3JpZCBlbmQgbWludXRlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gc3RlcCBSb3cgaW50ZXJ2YWwgaW4gbWludXRlcy5cblx0ICogQHJldHVybnMge251bWJlcltdfSBHcmlkIHJvdyBtaW51dGVzLlxuXHQgKi9cblx0ZnVuY3Rpb24gYnVpbGRfcm93X21pbnV0ZXMoZnJvbV9taW4sIHRvX21pbiwgc3RlcCkge1xuXHRcdHZhciBvdXQgPSBbXTtcblx0XHRmb3IgKHZhciBtID0gZnJvbV9taW47IG0gPCB0b19taW47IG0gKz0gc3RlcCkge1xuXHRcdFx0b3V0LnB1c2gobSk7XG5cdFx0fVxuXHRcdHJldHVybiBvdXQ7XG5cdH1cblxuXHQvKipcblx0ICogQ29tcHJlc3Mgc2VsZWN0ZWQgbWludXRlcyBpbnRvIGFkamFjZW50IHBlcnNpc3RlZCByYW5nZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyW119IG1pbnV0ZXMgU2VsZWN0ZWQgbWludXRlIHZhbHVlcy5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHN0ZXAgR3JpZCBpbnRlcnZhbCBpbiBtaW51dGVzLlxuXHQgKiBAcmV0dXJucyB7QXJyYXk8e2Zyb206c3RyaW5nLHRvOnN0cmluZ30+fSBDb21wYWN0IHNlbGVjdGVkIHJhbmdlcy5cblx0ICovXG5cdGZ1bmN0aW9uIG1pbnV0ZXNfdG9fc3RlcF9zbG90cyhtaW51dGVzLCBzdGVwKSB7XG5cdFx0dmFyIG91dCA9IFtdO1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShtaW51dGVzKSB8fCAhbWludXRlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBvdXQ7XG5cdFx0fVxuXHRcdG1pbnV0ZXMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuXHRcdFx0cmV0dXJuIGEgLSBiO1xuXHRcdH0pO1xuXHRcdG1pbnV0ZXMuZm9yRWFjaChmdW5jdGlvbiAobWludXRlKSB7XG5cdFx0XHRvdXQucHVzaCh7IGZyb206IG1pbl90b190aW1lKG1pbnV0ZSksIHRvOiBtaW5fdG9fdGltZShtaW51dGUgKyBzdGVwKSB9KTtcblx0XHR9KTtcblx0XHRyZXR1cm4gb3V0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4cGFuZCByYW5nZXMgaW50byBhIHNldCBvZiBzZWxlY3RlZCBncmlkIG1pbnV0ZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QXJyYXk8e2Zyb206c3RyaW5nLHRvOnN0cmluZ30+fSByYW5nZXMgUGVyc2lzdGVkIHJhbmdlcy5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHN0ZXAgR3JpZCBpbnRlcnZhbCBpbiBtaW51dGVzLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZnJvbV9taW4gRmlyc3QgdmlzaWJsZSBncmlkIG1pbnV0ZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHRvX21pbiBFeGNsdXNpdmUgdmlzaWJsZSBncmlkIGVuZCBtaW51dGUuXG5cdCAqIEByZXR1cm5zIHtTZXQ8bnVtYmVyPn0gU2VsZWN0ZWQgZ3JpZCBtaW51dGVzLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmFuZ2VzX3RvX3NldChyYW5nZXMsIHN0ZXAsIGZyb21fbWluLCB0b19taW4pIHtcblx0XHR2YXIgc2V0ID0ge307XG5cdFx0KHJhbmdlcyB8fCBbXSkuZm9yRWFjaChmdW5jdGlvbiAocmFuZ2UpIHtcblx0XHRcdHZhciBhID0gdGltZV90b19taW4ocmFuZ2UuZnJvbSk7XG5cdFx0XHR2YXIgYiA9IHRpbWVfdG9fbWluKHJhbmdlLnRvKTtcblx0XHRcdGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsIHx8IGIgPD0gYSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb3IgKHZhciBtID0gYTsgbSA8IGI7IG0gKz0gc3RlcCkge1xuXHRcdFx0XHRpZiAobSA+PSBmcm9tX21pbiAmJiBtIDwgdG9fbWluKSB7XG5cdFx0XHRcdFx0c2V0W21dID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiBzZXQ7XG5cdH1cblxuXHQvKipcblx0ICogUmVhZCBhbmQgbm9ybWFsaXplIHRoZSBjdXJyZW50IGluc3BlY3RvciBncmlkIHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBXZWVrZGF5IHN0YXJ0LXRpbWUgaW5zcGVjdG9yIHBhbmVsLlxuXHQgKiBAcmV0dXJucyB7e3N0YXJ0X21pbjpudW1iZXIsZW5kX21pbjpudW1iZXIsc3RlcDpudW1iZXIsc2xvdHM6T2JqZWN0LHN0YXRlX2VsOkhUTUxFbGVtZW50fG51bGx9fSBHcmlkIHN0YXRlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3N0YXRlKHBhbmVsKSB7XG5cdFx0dmFyIHN0YXJ0X2VsID0gcGFuZWwucXVlcnlTZWxlY3RvcignW2RhdGEtaW5zcGVjdG9yLWtleT1cInN0YXJ0X3RpbWVcIl0nKTtcblx0XHR2YXIgZW5kX2VsID0gcGFuZWwucXVlcnlTZWxlY3RvcignW2RhdGEtaW5zcGVjdG9yLWtleT1cImVuZF90aW1lXCJdJyk7XG5cdFx0dmFyIHN0ZXBfZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pbnNwZWN0b3Ita2V5PVwic3RlcF9taW51dGVzXCJdJyk7XG5cdFx0dmFyIHN0YXJ0X21pbiA9IHRpbWVfdG9fbWluKChzdGFydF9lbCAmJiBzdGFydF9lbC52YWx1ZSkgfHwgJzEwOjAwJyk7XG5cdFx0dmFyIGVuZF9taW4gPSB0aW1lX3RvX21pbigoZW5kX2VsICYmIGVuZF9lbC52YWx1ZSkgfHwgJzE3OjAwJyk7XG5cdFx0dmFyIHN0ZXAgPSBub3JtYWxpemVfc3RlcCgoc3RlcF9lbCAmJiBzdGVwX2VsLnZhbHVlKSB8fCAzMCk7XG5cdFx0aWYgKHN0YXJ0X21pbiA9PSBudWxsKSB7XG5cdFx0XHRzdGFydF9taW4gPSAxMCAqIDYwO1xuXHRcdH1cblx0XHRpZiAoZW5kX21pbiA9PSBudWxsKSB7XG5cdFx0XHRlbmRfbWluID0gMTcgKiA2MDtcblx0XHR9XG5cdFx0aWYgKGVuZF9taW4gPD0gc3RhcnRfbWluKSB7XG5cdFx0XHRlbmRfbWluID0gTWF0aC5taW4oMTQ0MCwgc3RhcnRfbWluICsgc3RlcCk7XG5cdFx0fVxuXHRcdHJldHVybiB7IHN0YXJ0X21pbjogc3RhcnRfbWluLCBlbmRfbWluOiBlbmRfbWluLCBzdGVwOiBzdGVwIH07XG5cdH1cblxuXHQvKipcblx0ICogTm90aWZ5IHRoZSBCdWlsZGVyIHRoYXQgYSBwZXJzaXN0ZWQgaW5zcGVjdG9yIGNvbnRyb2wgY2hhbmdlZC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBlbCBDaGFuZ2VkIGluc3BlY3RvciBjb250cm9sLlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGVtaXRfY2hhbmdlKGVsKSB7XG5cdFx0aWYgKCFlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0aWYgKHcualF1ZXJ5KSB7XG5cdFx0XHRcdHcualF1ZXJ5KGVsKS50cmlnZ2VyKCdpbnB1dCcpLnRyaWdnZXIoJ2NoYW5nZScpO1xuXHRcdFx0fVxuXHRcdFx0ZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRcdGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdH0gY2F0Y2ggKGUpIHt9XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIHRoZSBpbnNwZWN0b3IgZ3JpZCByb3dzIGZvciB0aGUgY29uZmlndXJlZCBpbnRlcnZhbC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgV2Vla2RheSBzdGFydC10aW1lIGluc3BlY3RvciBwYW5lbC5cblx0ICogQHJldHVybnMge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZW5kZXJfZ3JpZF9yb3dzKHBhbmVsKSB7XG5cdFx0dmFyIGJvZHkgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfYm9keScpO1xuXHRcdGlmICghYm9keSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgc3RhdGUgPSBnZXRfc3RhdGUocGFuZWwpO1xuXHRcdHZhciB0ZW1wbGF0ZSA9ICh3LndwICYmIHcud3AudGVtcGxhdGUpID8gdy53cC50ZW1wbGF0ZSgnd3BiYy1iZmItd2Vla2RheS1zdGFydHRpbWUtcm93JykgOiBudWxsO1xuXHRcdGJvZHkuaW5uZXJIVE1MID0gJyc7XG5cdFx0YnVpbGRfcm93X21pbnV0ZXMoc3RhdGUuc3RhcnRfbWluLCBzdGF0ZS5lbmRfbWluLCBzdGF0ZS5zdGVwKS5mb3JFYWNoKGZ1bmN0aW9uIChtaW51dGUpIHtcblx0XHRcdHZhciBodG1sID0gdGVtcGxhdGUgPyB0ZW1wbGF0ZSh7IG1pbnV0ZTogbWludXRlLCBsYWJlbDogbWluX3RvX3RpbWUobWludXRlKSB9KSA6ICcnO1xuXHRcdFx0dmFyIHdyYXAgPSBkLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0d3JhcC5pbm5lckhUTUwgPSBodG1sO1xuXHRcdFx0aWYgKHdyYXAuZmlyc3RFbGVtZW50Q2hpbGQpIHtcblx0XHRcdFx0Ym9keS5hcHBlbmRDaGlsZCh3cmFwLmZpcnN0RWxlbWVudENoaWxkKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQYWludCBwZXJzaXN0ZWQgd2Vla2RheSByYW5nZXMgaW50byB0aGUgaW50ZXJhY3RpdmUgZ3JpZC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgV2Vla2RheSBzdGFydC10aW1lIGluc3BlY3RvciBwYW5lbC5cblx0ICogQHBhcmFtIHtPYmplY3Q8c3RyaW5nLCBBcnJheTx7ZnJvbTpzdHJpbmcsdG86c3RyaW5nfT4+fSBzbG90cyBQZXJzaXN0ZWQgcmFuZ2VzLlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHBhaW50X3Nsb3RzKHBhbmVsLCBzbG90cykge1xuXHRcdHZhciBzdGF0ZSA9IGdldF9zdGF0ZShwYW5lbCk7XG5cdFx0dmFyIGJvZHkgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfYm9keScpO1xuXHRcdGlmICghYm9keSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRkYXlfb3JkZXIoKS5mb3JFYWNoKGZ1bmN0aW9uIChkYXlfa2V5KSB7XG5cdFx0XHR2YXIgc2V0ID0gcmFuZ2VzX3RvX3NldChzbG90c1tkYXlfa2V5XSB8fCBbXSwgc3RhdGUuc3RlcCwgc3RhdGUuc3RhcnRfbWluLCBzdGF0ZS5lbmRfbWluKTtcblx0XHRcdGJvZHkucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3RbZGF0YS1kYXk9XCInICsgZGF5X2tleSArICdcIl0nKS5mb3JFYWNoKGZ1bmN0aW9uIChjZWxsKSB7XG5cdFx0XHRcdHZhciBtaW51dGUgPSBwYXJzZUludChjZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1taW51dGUnKSwgMTApO1xuXHRcdFx0XHRjZWxsLmNsYXNzTGlzdC50b2dnbGUoJ2lzLW9uJywgISFzZXRbbWludXRlXSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWFkIHNlbGVjdGVkIGNlbGxzIGFuZCBjb21wcmVzcyB0aGVtIGludG8gcGVyc2lzdGVkIHJhbmdlcy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgV2Vla2RheSBzdGFydC10aW1lIGluc3BlY3RvciBwYW5lbC5cblx0ICogQHJldHVybnMge09iamVjdDxzdHJpbmcsIEFycmF5PHtmcm9tOnN0cmluZyx0bzpzdHJpbmd9Pj59IFNlbGVjdGVkIHJhbmdlcyBieSB3ZWVrZGF5LlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVhZF9zbG90cyhwYW5lbCkge1xuXHRcdHZhciBzdGF0ZSA9IGdldF9zdGF0ZShwYW5lbCk7XG5cdFx0dmFyIGJvZHkgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfYm9keScpO1xuXHRcdHZhciBvdXQgPSB7fTtcblx0XHRpZiAoIWJvZHkpIHtcblx0XHRcdHJldHVybiBub3JtYWxpemVfc2xvdHMoe30pO1xuXHRcdH1cblx0XHRkYXlfb3JkZXIoKS5mb3JFYWNoKGZ1bmN0aW9uIChkYXlfa2V5KSB7XG5cdFx0XHR2YXIgbWludXRlcyA9IFtdO1xuXHRcdFx0Ym9keS5xdWVyeVNlbGVjdG9yQWxsKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tc2xvdFtkYXRhLWRheT1cIicgKyBkYXlfa2V5ICsgJ1wiXS5pcy1vbicpLmZvckVhY2goZnVuY3Rpb24gKGNlbGwpIHtcblx0XHRcdFx0bWludXRlcy5wdXNoKHBhcnNlSW50KGNlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLW1pbnV0ZScpLCAxMCkpO1xuXHRcdFx0fSk7XG5cdFx0XHRvdXRbZGF5X2tleV0gPSBtaW51dGVzX3RvX3N0ZXBfc2xvdHMobWludXRlcywgc3RhdGUuc3RlcCk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBQZXJzaXN0IHRoZSBjdXJyZW50IGdyaWQgc2VsZWN0aW9uIHRocm91Z2ggdGhlIHN0YW5kYXJkIGluc3BlY3RvciBjb250cm9sLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbCBXZWVrZGF5IHN0YXJ0LXRpbWUgaW5zcGVjdG9yIHBhbmVsLlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHBlcnNpc3Rfc2xvdHMocGFuZWwpIHtcblx0XHR2YXIgc3RhdGVfZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtd2Vla2RheS1zbG90cy1qc29uJyk7XG5cdFx0aWYgKCFzdGF0ZV9lbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgc2xvdHMgPSByZWFkX3Nsb3RzKHBhbmVsKTtcblx0XHRzdGF0ZV9lbC52YWx1ZSA9IEpTT04uc3RyaW5naWZ5KHNsb3RzKTtcblx0XHRlbWl0X2NoYW5nZShzdGF0ZV9lbCk7XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgYSBkcmFnIG9yIGNsaWNrIHN0YXRlIHRvIGEgcmVjdGFuZ3VsYXIgd2Vla2RheS90aW1lIHNlbGVjdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgV2Vla2RheSBzdGFydC10aW1lIGluc3BlY3RvciBwYW5lbC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGZyb21fZGF5X2lkeCBTdGFydGluZyB3ZWVrZGF5IGNvbHVtbiBpbmRleC5cblx0ICogQHBhcmFtIHtudW1iZXJ9IHRvX2RheV9pZHggRW5kaW5nIHdlZWtkYXkgY29sdW1uIGluZGV4LlxuXHQgKiBAcGFyYW0ge251bWJlcn0gZnJvbV9taW4gU3RhcnRpbmcgbWludXRlLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gdG9fbWluIEVuZGluZyBtaW51dGUuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gbW9kZSBUcnVlIHRvIHNlbGVjdCwgZmFsc2UgdG8gY2xlYXIuXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gdG9nZ2xlX3JlY3QocGFuZWwsIGZyb21fZGF5X2lkeCwgdG9fZGF5X2lkeCwgZnJvbV9taW4sIHRvX21pbiwgbW9kZSkge1xuXHRcdHZhciBkYXlzID0gZGF5X29yZGVyKCk7XG5cdFx0dmFyIGJvZHkgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfYm9keScpO1xuXHRcdGlmICghYm9keSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgZGF5X3N0YXJ0ID0gTWF0aC5taW4oZnJvbV9kYXlfaWR4LCB0b19kYXlfaWR4KTtcblx0XHR2YXIgZGF5X2VuZCA9IE1hdGgubWF4KGZyb21fZGF5X2lkeCwgdG9fZGF5X2lkeCk7XG5cdFx0dmFyIG1pbl9zdGFydCA9IE1hdGgubWluKGZyb21fbWluLCB0b19taW4pO1xuXHRcdHZhciBtaW5fZW5kID0gTWF0aC5tYXgoZnJvbV9taW4sIHRvX21pbik7XG5cblx0XHRmb3IgKHZhciBpID0gZGF5X3N0YXJ0OyBpIDw9IGRheV9lbmQ7IGkrKykge1xuXHRcdFx0dmFyIGRheV9rZXkgPSBkYXlzW2ldO1xuXHRcdFx0Ym9keS5xdWVyeVNlbGVjdG9yQWxsKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tc2xvdFtkYXRhLWRheT1cIicgKyBkYXlfa2V5ICsgJ1wiXScpLmZvckVhY2goZnVuY3Rpb24gKGNlbGwpIHtcblx0XHRcdFx0dmFyIG1pbnV0ZSA9IHBhcnNlSW50KGNlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLW1pbnV0ZScpLCAxMCk7XG5cdFx0XHRcdGlmIChtaW51dGUgPCBtaW5fc3RhcnQgfHwgbWludXRlID4gbWluX2VuZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobW9kZSA9PT0gJ29uJykge1xuXHRcdFx0XHRcdGNlbGwuY2xhc3NMaXN0LmFkZCgnaXMtb24nKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjZWxsLmNsYXNzTGlzdC5yZW1vdmUoJ2lzLW9uJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBCaW5kIGdyaWQgZWRpdGluZyBhbmQgbG9ja2VkLW5hbWUgZW5mb3JjZW1lbnQgdG8gb25lIGluc3BlY3RvciBwYW5lbC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgV2Vla2RheSBzdGFydC10aW1lIGluc3BlY3RvciBwYW5lbC5cblx0ICogQHJldHVybnMge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBiaW5kX2dyaWQocGFuZWwpIHtcblx0XHRpZiAoIXBhbmVsIHx8IHBhbmVsLl9fd3BiY193ZWVrZGF5X3N0YXJ0dGltZV9pbml0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cGFuZWwuX193cGJjX3dlZWtkYXlfc3RhcnR0aW1lX2luaXRlZCA9IHRydWU7XG5cblx0XHR2YXIgc3RhdGVfZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtd2Vla2RheS1zbG90cy1qc29uJyk7XG5cdFx0dmFyIHNsb3RzID0gbm9ybWFsaXplX3Nsb3RzKHN0YXRlX2VsID8gc3RhdGVfZWwudmFsdWUgOiB7fSk7XG5cblx0XHQvKipcblx0XHQgKiBSZWJ1aWxkIGdyaWQgcm93cyBhZnRlciBjaGFuZ2luZyB0aGUgdmlzaWJsZSByYW5nZSBvciBpbnRlcnZhbC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlYnVpbGQoKSB7XG5cdFx0XHR2YXIgY3VycmVudCA9IHJlYWRfc2xvdHMocGFuZWwpO1xuXHRcdFx0cmVuZGVyX2dyaWRfcm93cyhwYW5lbCk7XG5cdFx0XHRwYWludF9zbG90cyhwYW5lbCwgY3VycmVudCk7XG5cdFx0XHRwZXJzaXN0X3Nsb3RzKHBhbmVsKTtcblx0XHR9XG5cblx0XHRyZW5kZXJfZ3JpZF9yb3dzKHBhbmVsKTtcblx0XHRwYWludF9zbG90cyhwYW5lbCwgc2xvdHMpO1xuXHRcdHBlcnNpc3Rfc2xvdHMocGFuZWwpO1xuXG5cdFx0cGFuZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaW5zcGVjdG9yLWtleT1cInN0YXJ0X3RpbWVcIl0sIFtkYXRhLWluc3BlY3Rvci1rZXk9XCJlbmRfdGltZVwiXSwgW2RhdGEtaW5zcGVjdG9yLWtleT1cInN0ZXBfbWludXRlc1wiXScpLmZvckVhY2goZnVuY3Rpb24gKGVsKSB7XG5cdFx0XHRlbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCByZWJ1aWxkKTtcblx0XHR9KTtcblxuXHRcdHBhbmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWxlbi1ncm91cF0gW2RhdGEtbGVuLXJhbmdlXScpLmZvckVhY2goZnVuY3Rpb24gKHJhbmdlKSB7XG5cdFx0XHRyYW5nZS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyIGdyb3VwID0gcmFuZ2UuY2xvc2VzdCgnW2RhdGEtbGVuLWdyb3VwXScpO1xuXHRcdFx0XHR2YXIgbnVtID0gZ3JvdXAgJiYgZ3JvdXAucXVlcnlTZWxlY3RvcignW2RhdGEtbGVuLXZhbHVlXScpO1xuXHRcdFx0XHRpZiAobnVtKSB7XG5cdFx0XHRcdFx0bnVtLnZhbHVlID0gcmFuZ2UudmFsdWU7XG5cdFx0XHRcdFx0ZW1pdF9jaGFuZ2UobnVtKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRwYW5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1sZW4tZ3JvdXBdIFtkYXRhLWxlbi12YWx1ZV0nKS5mb3JFYWNoKGZ1bmN0aW9uIChudW0pIHtcblx0XHRcdG51bS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0dmFyIGdyb3VwID0gbnVtLmNsb3Nlc3QoJ1tkYXRhLWxlbi1ncm91cF0nKTtcblx0XHRcdFx0dmFyIHJhbmdlID0gZ3JvdXAgJiYgZ3JvdXAucXVlcnlTZWxlY3RvcignW2RhdGEtbGVuLXJhbmdlXScpO1xuXHRcdFx0XHRpZiAocmFuZ2UpIHtcblx0XHRcdFx0XHRyYW5nZS52YWx1ZSA9IG51bS52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR2YXIgYm9keSA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9ib2R5Jyk7XG5cdFx0dmFyIGRyYWcgPSBudWxsO1xuXHRcdGlmIChib2R5KSB7XG5cdFx0XHRib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGZ1bmN0aW9uIChldikge1xuXHRcdFx0XHR2YXIgY2VsbCA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCAmJiBldi50YXJnZXQuY2xvc2VzdCgnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3QnKTtcblx0XHRcdFx0aWYgKCFjZWxsKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBkYXlzID0gZGF5X29yZGVyKCk7XG5cdFx0XHRcdHZhciBkYXlfa2V5ID0gY2VsbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGF5Jyk7XG5cdFx0XHRcdHZhciBkYXlfaWR4ID0gZGF5cy5pbmRleE9mKGRheV9rZXkpO1xuXHRcdFx0XHR2YXIgbWludXRlID0gcGFyc2VJbnQoY2VsbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbWludXRlJyksIDEwKTtcblx0XHRcdFx0dmFyIG1vZGUgPSBjZWxsLmNsYXNzTGlzdC5jb250YWlucygnaXMtb24nKSA/ICdvZmYnIDogJ29uJztcblx0XHRcdFx0ZHJhZyA9IHsgZGF5X2lkeDogZGF5X2lkeCwgbWludXRlOiBtaW51dGUsIG1vZGU6IG1vZGUgfTtcblx0XHRcdFx0dG9nZ2xlX3JlY3QocGFuZWwsIGRheV9pZHgsIGRheV9pZHgsIG1pbnV0ZSwgbWludXRlLCBtb2RlKTtcblx0XHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH0pO1xuXHRcdFx0Ym9keS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW92ZXInLCBmdW5jdGlvbiAoZXYpIHtcblx0XHRcdFx0dmFyIGNlbGwgPSBldi50YXJnZXQgJiYgZXYudGFyZ2V0LmNsb3Nlc3QgJiYgZXYudGFyZ2V0LmNsb3Nlc3QoJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1zbG90Jyk7XG5cdFx0XHRcdGlmICghZHJhZyB8fCAhY2VsbCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgZGF5cyA9IGRheV9vcmRlcigpO1xuXHRcdFx0XHR2YXIgZGF5X2lkeCA9IGRheXMuaW5kZXhPZihjZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1kYXknKSk7XG5cdFx0XHRcdHZhciBtaW51dGUgPSBwYXJzZUludChjZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1taW51dGUnKSwgMTApO1xuXHRcdFx0XHR0b2dnbGVfcmVjdChwYW5lbCwgZHJhZy5kYXlfaWR4LCBkYXlfaWR4LCBkcmFnLm1pbnV0ZSwgbWludXRlLCBkcmFnLm1vZGUpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHcuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmIChkcmFnKSB7XG5cdFx0XHRcdGRyYWcgPSBudWxsO1xuXHRcdFx0XHRwZXJzaXN0X3Nsb3RzKHBhbmVsKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHZhciBjb3B5X2RlZmF1bHQgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtY29weS1kZWZhdWx0Jyk7XG5cdFx0aWYgKGNvcHlfZGVmYXVsdCkge1xuXHRcdFx0Y29weV9kZWZhdWx0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGV2KSB7XG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHZhciBjdXJyZW50ID0gcmVhZF9zbG90cyhwYW5lbCk7XG5cdFx0XHRcdHdlZWtkYXlfb3JkZXIoKS5mb3JFYWNoKGZ1bmN0aW9uIChkYXlfa2V5KSB7XG5cdFx0XHRcdFx0Y3VycmVudFtkYXlfa2V5XSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoY3VycmVudFsnZGVmYXVsdCddIHx8IFtdKSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRwYWludF9zbG90cyhwYW5lbCwgY3VycmVudCk7XG5cdFx0XHRcdHBlcnNpc3Rfc2xvdHMocGFuZWwpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dmFyIGNsZWFyX3dlZWtkYXlzID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLWNsZWFyLXdlZWtkYXlzJyk7XG5cdFx0aWYgKGNsZWFyX3dlZWtkYXlzKSB7XG5cdFx0XHRjbGVhcl93ZWVrZGF5cy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChldikge1xuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHR2YXIgY3VycmVudCA9IHJlYWRfc2xvdHMocGFuZWwpO1xuXHRcdFx0XHR3ZWVrZGF5X29yZGVyKCkuZm9yRWFjaChmdW5jdGlvbiAoZGF5X2tleSkge1xuXHRcdFx0XHRcdGN1cnJlbnRbZGF5X2tleV0gPSBbXTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHBhaW50X3Nsb3RzKHBhbmVsLCBjdXJyZW50KTtcblx0XHRcdFx0cGVyc2lzdF9zbG90cyhwYW5lbCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR2YXIgbG9ja2VkID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLWxvY2tlZC1uYW1lW2RhdGEtaW5zcGVjdG9yLWtleT1cIm5hbWVcIl0nKTtcblx0XHRpZiAobG9ja2VkKSB7XG5cdFx0XHRsb2NrZWQudmFsdWUgPSAnc3RhcnR0aW1lJztcblx0XHRcdGVtaXRfY2hhbmdlKGxvY2tlZCk7XG5cdFx0fVxuXHRcdHZhciBsb2NrZWRfY29uZGl0aW9uID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLWxvY2tlZC1jb25kaXRpb24tbmFtZVtkYXRhLWluc3BlY3Rvci1rZXk9XCJjb25kaXRpb25fbmFtZVwiXScpO1xuXHRcdGlmIChsb2NrZWRfY29uZGl0aW9uKSB7XG5cdFx0XHRsb2NrZWRfY29uZGl0aW9uLnZhbHVlID0gJ3dlZWtkYXktY29uZGl0aW9uJztcblx0XHRcdGVtaXRfY2hhbmdlKGxvY2tlZF9jb25kaXRpb24pO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplIGEgbmV3bHkgcmVuZGVyZWQgV2Vla2RheSBzdGFydC10aW1lIGluc3BlY3RvciB3aGVuIHByZXNlbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RG9jdW1lbnR8SFRNTEVsZW1lbnR9IHJvb3QgRE9NIHJvb3QgdG8gc2VhcmNoLlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHRyeV9pbml0X3BhbmVsKHJvb3QpIHtcblx0XHRpZiAoIXJvb3QgfHwgIXJvb3QucXVlcnlTZWxlY3Rvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgcGFuZWwgPSByb290Lm1hdGNoZXMgJiYgcm9vdC5tYXRjaGVzKCcud3BiY19iZmJfX2luc3BlY3Rvcl93ZWVrZGF5X3N0YXJ0dGltZScpXG5cdFx0XHQ/IHJvb3Rcblx0XHRcdDogcm9vdC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX2luc3BlY3Rvcl93ZWVrZGF5X3N0YXJ0dGltZScpO1xuXHRcdGlmIChwYW5lbCkge1xuXHRcdFx0YmluZF9ncmlkKHBhbmVsKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUnVuIGEgY2FsbGJhY2sgYWZ0ZXIgdGhlIGZpZWxkIHJlbmRlcmVyIHJlZ2lzdHJ5IGJlY29tZXMgYXZhaWxhYmxlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYiBDYWxsYmFjayByZWNlaXZpbmcgdGhlIHJlZ2lzdHJ5IGFuZCBiYXNlIGNsYXNzLlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHdpdGhfcmVnaXN0cnkoY2IpIHtcblx0XHR2YXIgdHJpZXMgPSAwO1xuXHRcdChmdW5jdGlvbiBsb29wKCkge1xuXHRcdFx0dmFyIHJlZ2lzdHJ5ID0gKHcuV1BCQ19CRkJfQ29yZSB8fCB7fSkuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XG5cdFx0XHR2YXIgYmFzZSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX0ZpZWxkX0Jhc2UgfHwgKHcuV1BCQ19CRkJfQ29yZSB8fCB7fSkuV1BCQ19CRkJfU2VsZWN0X0Jhc2U7XG5cdFx0XHRpZiAocmVnaXN0cnkgJiYgcmVnaXN0cnkucmVnaXN0ZXIgJiYgYmFzZSkge1xuXHRcdFx0XHRjYihyZWdpc3RyeSwgYmFzZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICh0cmllcysrIDwgMjAwKSB7XG5cdFx0XHRcdHNldFRpbWVvdXQobG9vcCwgNTApO1xuXHRcdFx0fVxuXHRcdH0pKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVnaXN0ZXIgdGhlIFdlZWtkYXkgc3RhcnQtdGltZSBmaWVsZCByZW5kZXJlci5cblx0ICpcblx0ICogQHJldHVybnMge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZWdpc3Rlcl9yZW5kZXJlcigpIHtcblx0XHR3aXRoX3JlZ2lzdHJ5KGZ1bmN0aW9uIChSZWdpc3RyeSwgQmFzZSkge1xuXHRcdFx0LyoqXG5cdFx0XHQgKiBSZW5kZXIgYW5kIG5vcm1hbGl6ZSB0aGUgV2Vla2RheSBzdGFydC10aW1lIEJ1aWxkZXIgZmllbGQuXG5cdFx0XHQgKi9cblx0XHRcdGNsYXNzIFdQQkNfQkZCX0ZpZWxkX1dlZWtkYXlfU3RhcnRUaW1lIGV4dGVuZHMgQmFzZSB7XG5cdFx0XHRcdHN0YXRpYyB0ZW1wbGF0ZV9pZCA9ICd3cGJjLWJmYi1maWVsZC13ZWVrZGF5X3N0YXJ0dGltZSc7XG5cdFx0XHRcdHN0YXRpYyBraW5kID0gJ3dlZWtkYXlfc3RhcnR0aW1lJztcblxuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogUmV0dXJuIHBlcnNpc3RlZCBkZWZhdWx0cyBmb3IgbmV3bHkgaW5zZXJ0ZWQgZmllbGRzLlxuXHRcdFx0XHQgKlxuXHRcdFx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fSBGaWVsZCBkZWZhdWx0cyBtZXJnZWQgd2l0aCB0aGUgYmFzZSByZW5kZXJlci5cblx0XHRcdFx0ICovXG5cdFx0XHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XG5cdFx0XHRcdFx0dmFyIGJhc2UgPSBzdXBlci5nZXRfZGVmYXVsdHMgPyBzdXBlci5nZXRfZGVmYXVsdHMoKSA6IHt9O1xuXHRcdFx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBiYXNlLCB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnd2Vla2RheV9zdGFydHRpbWUnLFxuXHRcdFx0XHRcdFx0dXNhZ2Vfa2V5OiAnc3RhcnR0aW1lJyxcblx0XHRcdFx0XHRcdGxhYmVsOiAnU3RhcnQgdGltZScsXG5cdFx0XHRcdFx0XHRuYW1lOiAnc3RhcnR0aW1lJyxcblx0XHRcdFx0XHRcdHJlcXVpcmVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0Y29uZGl0aW9uX25hbWU6ICd3ZWVrZGF5LWNvbmRpdGlvbicsXG5cdFx0XHRcdFx0XHRpc19zdXBwb3J0ZWQ6IGlzX3BhY2tfc3VwcG9ydGVkKCksXG5cdFx0XHRcdFx0XHR1cGdyYWRlX3RleHQ6IHVwZ3JhZGVfdGV4dCgpLFxuXHRcdFx0XHRcdFx0c3RhcnRfdGltZTogJzEwOjAwJyxcblx0XHRcdFx0XHRcdGVuZF90aW1lOiAnMTc6MDAnLFxuXHRcdFx0XHRcdFx0c3RlcF9taW51dGVzOiAzMCxcblx0XHRcdFx0XHRcdHNsb3RzOiBkZWZhdWx0X3Nsb3RzKCksXG5cdFx0XHRcdFx0XHRtaW5fd2lkdGg6ICczMjBweCdcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogUmVuZGVyIHRoZSBmaWVsZCBwcmV2aWV3IHdpdGggY3VycmVudCBlZGl0aW9uIHN1cHBvcnQgZGF0YS5cblx0XHRcdFx0ICpcblx0XHRcdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgRmllbGQgcHJldmlldyBlbGVtZW50LlxuXHRcdFx0XHQgKiBAcGFyYW0ge09iamVjdH0gZGF0YSBGaWVsZCBkYXRhLlxuXHRcdFx0XHQgKiBAcGFyYW0ge09iamVjdH0gY3R4IEJ1aWxkZXIgcmVuZGVyaW5nIGNvbnRleHQuXG5cdFx0XHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdFx0XHQgKi9cblx0XHRcdFx0c3RhdGljIHJlbmRlcihlbCwgZGF0YSwgY3R4KSB7XG5cdFx0XHRcdFx0ZGF0YSA9IGRhdGEgfHwge307XG5cdFx0XHRcdFx0ZGF0YS5pc19zdXBwb3J0ZWQgPSBpc19wYWNrX3N1cHBvcnRlZChkYXRhKTtcblx0XHRcdFx0XHRkYXRhLnVwZ3JhZGVfdGV4dCA9IHVwZ3JhZGVfdGV4dChkYXRhKTtcblx0XHRcdFx0XHRpZiAoc3VwZXIucmVuZGVyKSB7XG5cdFx0XHRcdFx0XHRzdXBlci5yZW5kZXIoZWwsIGRhdGEsIGN0eCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChlbCAmJiBlbC5kYXRhc2V0KSB7XG5cdFx0XHRcdFx0XHRlbC5kYXRhc2V0LmlzX3N1cHBvcnRlZCA9IGRhdGEuaXNfc3VwcG9ydGVkID8gJ3RydWUnIDogJ2ZhbHNlJztcblx0XHRcdFx0XHRcdGVsLmRhdGFzZXQudXBncmFkZV90ZXh0ID0gZGF0YS51cGdyYWRlX3RleHQgfHwgJyc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdC8qKlxuXHRcdFx0XHQgKiBMb2NrIHRoZSBjYW5vbmljYWwgc3RhcnR0aW1lIG5hbWUgYWZ0ZXIgYSBwYWxldHRlIGRyb3AuXG5cdFx0XHRcdCAqXG5cdFx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIE5ldyBmaWVsZCBkYXRhLlxuXHRcdFx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCBEcm9wcGVkIGZpZWxkIGVsZW1lbnQuXG5cdFx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBjdHggQnVpbGRlciBkcm9wIGNvbnRleHQuXG5cdFx0XHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdFx0XHQgKi9cblx0XHRcdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoZGF0YSwgZWwsIGN0eCkge1xuXHRcdFx0XHRcdGlmIChzdXBlci5vbl9maWVsZF9kcm9wKSB7XG5cdFx0XHRcdFx0XHRzdXBlci5vbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBjdHgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZGF0YSkge1xuXHRcdFx0XHRcdFx0ZGF0YS51c2FnZV9rZXkgPSAnc3RhcnR0aW1lJztcblx0XHRcdFx0XHRcdGRhdGEubmFtZSA9ICdzdGFydHRpbWUnO1xuXHRcdFx0XHRcdFx0ZGF0YS5jb25kaXRpb25fbmFtZSA9ICd3ZWVrZGF5LWNvbmRpdGlvbic7XG5cdFx0XHRcdFx0XHRkYXRhLm11bHRpcGxlID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRkYXRhLmlzX3N1cHBvcnRlZCA9IGlzX3BhY2tfc3VwcG9ydGVkKGRhdGEpO1xuXHRcdFx0XHRcdFx0ZGF0YS51cGdyYWRlX3RleHQgPSB1cGdyYWRlX3RleHQoZGF0YSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChlbCAmJiBlbC5kYXRhc2V0KSB7XG5cdFx0XHRcdFx0XHRlbC5kYXRhc2V0LnVzYWdlX2tleSA9ICdzdGFydHRpbWUnO1xuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lID0gJ3N0YXJ0dGltZSc7XG5cdFx0XHRcdFx0XHRlbC5kYXRhc2V0LmF1dG9uYW1lID0gJzAnO1xuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5mcmVzaCA9ICcwJztcblx0XHRcdFx0XHRcdGVsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgPSAnMSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRSZWdpc3RyeS5yZWdpc3Rlcignd2Vla2RheV9zdGFydHRpbWUnLCBXUEJDX0JGQl9GaWVsZF9XZWVrZGF5X1N0YXJ0VGltZSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7fVxuXHRcdFx0dy5XUEJDX0JGQl9GaWVsZF9XZWVrZGF5X1N0YXJ0VGltZSA9IFdQQkNfQkZCX0ZpZWxkX1dlZWtkYXlfU3RhcnRUaW1lO1xuXHRcdH0pO1xuXHR9XG5cblx0cmVnaXN0ZXJfcmVuZGVyZXIoKTtcblxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZWFkeScsIGZ1bmN0aW9uIChldikge1xuXHRcdHRyeV9pbml0X3BhbmVsKGV2ICYmIGV2LmRldGFpbCAmJiBldi5kZXRhaWwucGFuZWwpO1xuXHR9KTtcblxuXHRpZiAoZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR0cnlfaW5pdF9wYW5lbChkKTtcblx0XHR9KTtcblx0fSBlbHNlIHtcblx0XHR0cnlfaW5pdF9wYW5lbChkKTtcblx0fVxuXG5cdHRyeSB7XG5cdFx0dmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoZnVuY3Rpb24gKG11dHMpIHtcblx0XHRcdG11dHMuZm9yRWFjaChmdW5jdGlvbiAobXV0KSB7XG5cdFx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwobXV0LmFkZGVkTm9kZXMgfHwgW10sIGZ1bmN0aW9uIChub2RlKSB7XG5cdFx0XHRcdFx0aWYgKG5vZGUubm9kZVR5cGUgPT09IDEpIHtcblx0XHRcdFx0XHRcdHRyeV9pbml0X3BhbmVsKG5vZGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRvYnNlcnZlci5vYnNlcnZlKGQuZG9jdW1lbnRFbGVtZW50LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcblx0fSBjYXRjaCAoZSkge31cblxuXHQvKipcblx0ICogRXNjYXBlIHRleHQgZm9yIGEgQm9va2luZyBGb3JtIHNob3J0Y29kZSBvcHRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gdmFsdWUgQ2FuZGlkYXRlIHNob3J0Y29kZSB2YWx1ZS5cblx0ICogQHJldHVybnMge3N0cmluZ30gRXNjYXBlZCBzaG9ydGNvZGUgdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBlc2NhcGVfc2hvcnRjb2RlKHZhbHVlKSB7XG5cdFx0dmFyIHNhbml0aXplID0gKHcuV1BCQ19CRkJfQ29yZSB8fCB7fSkuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XG5cdFx0aWYgKHNhbml0aXplLmVzY2FwZV9mb3Jfc2hvcnRjb2RlKSB7XG5cdFx0XHRyZXR1cm4gc2FuaXRpemUuZXNjYXBlX2Zvcl9zaG9ydGNvZGUoU3RyaW5nKHZhbHVlIHx8ICcnKSk7XG5cdFx0fVxuXHRcdHJldHVybiBTdHJpbmcodmFsdWUgfHwgJycpLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKS5yZXBsYWNlKC9cXHI/XFxuL2csICcgJyk7XG5cdH1cblxuXHQvKipcblx0ICogRXNjYXBlIHRleHQgZm9yIGdlbmVyYXRlZCBBZHZhbmNlZC1mb3JtIEhUTUwuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gdmFsdWUgQ2FuZGlkYXRlIEhUTUwgdGV4dC5cblx0ICogQHJldHVybnMge3N0cmluZ30gRXNjYXBlZCBIVE1MIHRleHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBlc2NhcGVfaHRtbCh2YWx1ZSkge1xuXHRcdHZhciBzYW5pdGl6ZSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xuXHRcdGlmIChzYW5pdGl6ZS5lc2NhcGVfaHRtbCkge1xuXHRcdFx0cmV0dXJuIHNhbml0aXplLmVzY2FwZV9odG1sKFN0cmluZyh2YWx1ZSB8fCAnJykpO1xuXHRcdH1cblx0XHRyZXR1cm4gU3RyaW5nKHZhbHVlIHx8ICcnKS5yZXBsYWNlKC9bJjw+XCInXS9nLCBmdW5jdGlvbiAoY2gpIHtcblx0XHRcdHJldHVybiB7ICcmJzogJyZhbXA7JywgJzwnOiAnJmx0OycsICc+JzogJyZndDsnLCAnXCInOiAnJnF1b3Q7JywgXCInXCI6ICcmIzAzOTsnIH1bY2hdO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNhbml0aXplIHRoZSBmaXhlZCB3ZWVrZGF5LWNvbmRpdGlvbiB0b2tlbi5cblx0ICpcblx0ICogQHBhcmFtIHsqfSB2YWx1ZSBDYW5kaWRhdGUgY29uZGl0aW9uIG5hbWUuXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IFNhZmUgY29uZGl0aW9uIHRva2VuLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2FuaXRpemVfY29uZGl0aW9uX25hbWUodmFsdWUpIHtcblx0XHR2YXIgc2FuaXRpemUgPSAody5XUEJDX0JGQl9Db3JlIHx8IHt9KS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcblx0XHRpZiAoc2FuaXRpemUudG9fdG9rZW4pIHtcblx0XHRcdHJldHVybiBzYW5pdGl6ZS50b190b2tlbihTdHJpbmcodmFsdWUgfHwgJ3dlZWtkYXktY29uZGl0aW9uJykpIHx8ICd3ZWVrZGF5LWNvbmRpdGlvbic7XG5cdFx0fVxuXHRcdHJldHVybiBTdHJpbmcodmFsdWUgfHwgJ3dlZWtkYXktY29uZGl0aW9uJykucmVwbGFjZSgvW14wLTlBLVphLXo6Ll8tXS9nLCAnJykgfHwgJ3dlZWtkYXktY29uZGl0aW9uJztcblx0fVxuXG5cdC8qKlxuXHQgKiBCdWlsZCBhIHN0YWJsZSBzaWduYXR1cmUgZm9yIGdyb3VwaW5nIG1hdGNoaW5nIHdlZWtkYXkgcmFuZ2VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0FycmF5PHtmcm9tOnN0cmluZyx0bzpzdHJpbmd9Pn0gcmFuZ2VzIFBlcnNpc3RlZCByYW5nZXMuXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IENvbXBhcmFibGUgcmFuZ2Ugc2lnbmF0dXJlLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2xvdHNfc2lnbmF0dXJlKHJhbmdlcykge1xuXHRcdHJldHVybiBzYW5pdGl6ZV9yYW5nZXMocmFuZ2VzKS5tYXAoZnVuY3Rpb24gKHJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gcmFuZ2UuZnJvbSArICctJyArIHJhbmdlLnRvO1xuXHRcdH0pLmpvaW4oJ3wnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeHBhbmQgY29tcGFjdCByYW5nZXMgaW50byBpbmRpdmlkdWFsIHN0YXJ0LXRpbWUgc2hvcnRjb2RlIHRva2Vucy5cblx0ICpcblx0ICogQHBhcmFtIHtBcnJheTx7ZnJvbTpzdHJpbmcsdG86c3RyaW5nfT59IHJhbmdlcyBQZXJzaXN0ZWQgcmFuZ2VzLlxuXHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHN0ZXBfbWludXRlcyBTdGFydC10aW1lIGludGVydmFsLlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfSBTcGFjZS1kZWxpbWl0ZWQgcXVvdGVkIHNob3J0Y29kZSBvcHRpb25zLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2xvdF90b2tlbnMocmFuZ2VzLCBzdGVwX21pbnV0ZXMpIHtcblx0XHR2YXIgdG9rZW5zID0gW107XG5cdFx0dmFyIHN0ZXAgPSBub3JtYWxpemVfc3RlcChzdGVwX21pbnV0ZXMpO1xuXG5cdFx0c2FuaXRpemVfcmFuZ2VzKHJhbmdlcykuZm9yRWFjaChmdW5jdGlvbiAocmFuZ2UpIHtcblx0XHRcdHZhciBmcm9tX21pbiA9IHRpbWVfdG9fbWluKHJhbmdlLmZyb20pO1xuXHRcdFx0dmFyIHRvX21pbiA9IHRpbWVfdG9fbWluKHJhbmdlLnRvKTtcblxuXHRcdFx0Zm9yICh2YXIgbWludXRlID0gZnJvbV9taW47IG1pbnV0ZSA8IHRvX21pbjsgbWludXRlICs9IHN0ZXApIHtcblx0XHRcdFx0dG9rZW5zLnB1c2goJ1wiJyArIGVzY2FwZV9zaG9ydGNvZGUobWluX3RvX3RpbWUobWludXRlKSkgKyAnXCInKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiB0b2tlbnMuam9pbignICcpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnQgdGhlIFN1bmRheSBmaWVsZCBrZXkgdG8gdGhlIGNvbmRpdGlvbiBzaG9ydGNvZGUgdmFsdWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBkYXlfa2V5IFBlcnNpc3RlZCB3ZWVrZGF5IGtleS5cblx0ICogQHJldHVybnMge3N0cmluZ30gV2Vla2RheSBjb25kaXRpb24gdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiB3ZWVrZGF5X3RvX2NvbmRpdGlvbl92YWx1ZShkYXlfa2V5KSB7XG5cdFx0cmV0dXJuIGRheV9rZXkgPT09ICc3JyA/ICcwJyA6IGRheV9rZXk7XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgb25lIHdlZWtkYXkgY29uZGl0aW9uIHNob3J0Y29kZSBibG9jay5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGNvbmRpdGlvbl9uYW1lIENvbmRpdGlvbiBncm91cCBuYW1lLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgV2Vla2RheSB2YWx1ZXMgb3Igd2lsZGNhcmQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3Rfc2hvcnRjb2RlIEdlbmVyYXRlZCBzdGFydHRpbWUgc2VsZWN0b3IuXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IENvbXBsZXRlIGNvbmRpdGlvbiBibG9jay5cblx0ICovXG5cdGZ1bmN0aW9uIGNvbmRpdGlvbl9ibG9jayhjb25kaXRpb25fbmFtZSwgdmFsdWUsIHNlbGVjdF9zaG9ydGNvZGUpIHtcblx0XHRyZXR1cm4gW1xuXHRcdFx0J1tjb25kaXRpb24gbmFtZT1cIicgKyBjb25kaXRpb25fbmFtZSArICdcIiB0eXBlPVwid2Vla2RheVwiIHZhbHVlPVwiJyArIHZhbHVlICsgJ1wiXScsXG5cdFx0XHQnXFx0JyArIHNlbGVjdF9zaG9ydGNvZGUsXG5cdFx0XHQnWy9jb25kaXRpb25dJ1xuXHRcdF0uam9pbignXFxuJyk7XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGQgc2FmZSB3cmFwcGVyIGF0dHJpYnV0ZXMgdXNlZCBieSB0aGUgZXhwb3J0ZWQgZmllbGQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZCBGaWVsZCBkYXRhLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY3R4IEV4cG9ydGVyIGNvbnRleHQgY29udGFpbmluZyB1c2VkIEhUTUwgSURzLlxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfSBFc2NhcGVkIEhUTUwgYXR0cmlidXRlIHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIGJ1aWxkX3dyYXBwZXJfYXR0cnMoZmllbGQsIGN0eCkge1xuXHRcdHZhciBzYW5pdGl6ZSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xuXHRcdHZhciBhdHRycyA9ICcnO1xuXHRcdHZhciBjbHMgPSBmaWVsZCAmJiAoZmllbGQuY3NzY2xhc3MgfHwgZmllbGQuY2xhc3MgfHwgZmllbGQuY2xhc3NOYW1lKSA/IFN0cmluZyhmaWVsZC5jc3NjbGFzcyB8fCBmaWVsZC5jbGFzcyB8fCBmaWVsZC5jbGFzc05hbWUpIDogJyc7XG5cdFx0dmFyIGh0bWxfaWQgPSBmaWVsZCAmJiBmaWVsZC5odG1sX2lkID8gU3RyaW5nKGZpZWxkLmh0bWxfaWQpIDogJyc7XG5cdFx0dmFyIG1pbl93aWR0aCA9IGZpZWxkICYmIGZpZWxkLm1pbl93aWR0aCA/IFN0cmluZyhmaWVsZC5taW5fd2lkdGgpLnRyaW0oKSA6ICcnO1xuXG5cdFx0aWYgKHNhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QpIHtcblx0XHRcdGNscyA9IHNhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoY2xzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2xzID0gY2xzLnJlcGxhY2UoL1teMC05QS1aYS16XyAtXS9nLCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKTtcblx0XHR9XG5cblx0XHRpZiAoc2FuaXRpemUuc2FuaXRpemVfaHRtbF9pZCkge1xuXHRcdFx0aHRtbF9pZCA9IHNhbml0aXplLnNhbml0aXplX2h0bWxfaWQoaHRtbF9pZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGh0bWxfaWQgPSBodG1sX2lkLnJlcGxhY2UoL1teMC05QS1aYS16Xy1dL2csICcnKTtcblx0XHR9XG5cdFx0aWYgKGh0bWxfaWQgJiYgY3R4ICYmIGN0eC51c2VkSWRzKSB7XG5cdFx0XHR2YXIgdW5pcXVlX2lkID0gaHRtbF9pZDtcblx0XHRcdHZhciBzdWZmaXggPSAyO1xuXHRcdFx0d2hpbGUgKGN0eC51c2VkSWRzLmhhcyh1bmlxdWVfaWQpKSB7XG5cdFx0XHRcdHVuaXF1ZV9pZCA9IGh0bWxfaWQgKyAnXycgKyBzdWZmaXgrKztcblx0XHRcdH1cblx0XHRcdGN0eC51c2VkSWRzLmFkZCh1bmlxdWVfaWQpO1xuXHRcdFx0aHRtbF9pZCA9IHVuaXF1ZV9pZDtcblx0XHR9XG5cblx0XHRpZiAoaHRtbF9pZCkge1xuXHRcdFx0YXR0cnMgKz0gJyBpZD1cIicgKyBlc2NhcGVfaHRtbChodG1sX2lkKSArICdcIic7XG5cdFx0fVxuXHRcdGlmIChjbHMpIHtcblx0XHRcdGF0dHJzICs9ICcgY2xhc3M9XCInICsgZXNjYXBlX2h0bWwoY2xzKSArICdcIic7XG5cdFx0fVxuXHRcdGlmIChtaW5fd2lkdGgpIHtcblx0XHRcdG1pbl93aWR0aCA9IG1pbl93aWR0aC5yZXBsYWNlKC9bXjAtOUEtWmEtei4lKCkgLCstXS9nLCAnJyk7XG5cdFx0XHRpZiAobWluX3dpZHRoKSB7XG5cdFx0XHRcdGF0dHJzICs9ICcgc3R5bGU9XCJtaW4td2lkdGg6JyArIGVzY2FwZV9odG1sKG1pbl93aWR0aCkgKyAnO1wiJztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGF0dHJzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFdyYXAgZXhwb3J0ZWQgY29uZGl0aW9uIGJsb2NrcyB3aGVuIGFwcGVhcmFuY2UgYXR0cmlidXRlcyByZXF1aXJlIGl0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZmllbGQgRmllbGQgZGF0YS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGJvZHkgR2VuZXJhdGVkIGZpZWxkIGJvZHkuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjdHggRXhwb3J0ZXIgY29udGV4dC5cblx0ICogQHJldHVybnMge3N0cmluZ30gT3JpZ2luYWwgb3Igd3JhcHBlZCBmaWVsZCBib2R5LlxuXHQgKi9cblx0ZnVuY3Rpb24gd3JhcF9ib2R5X2lmX25lZWRlZChmaWVsZCwgYm9keSwgY3R4KSB7XG5cdFx0dmFyIGF0dHJzID0gYnVpbGRfd3JhcHBlcl9hdHRycyhmaWVsZCwgY3R4KTtcblx0XHRpZiAoIWF0dHJzKSB7XG5cdFx0XHRyZXR1cm4gYm9keTtcblx0XHR9XG5cdFx0cmV0dXJuICc8ZGl2JyArIGF0dHJzICsgJz5cXG4nICsgYm9keSArICdcXG48L2Rpdj4nO1xuXHR9XG5cblx0LyoqXG5cdCAqIEVtaXQgYW4gb3B0aW9uYWwgbGFiZWwgZm9sbG93ZWQgYnkgZXhwb3J0ZWQgY29uZGl0aW9uIGJsb2Nrcy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGZpZWxkIEZpZWxkIGRhdGEuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGVtaXQgRXhwb3J0ZXIgb3V0cHV0IGNhbGxiYWNrLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYm9keSBHZW5lcmF0ZWQgZmllbGQgYm9keS5cblx0ICogQHBhcmFtIHtPYmplY3R9IGNmZyBFeHBvcnRlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY3R4IEV4cG9ydGVyIGNvbnRleHQuXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZW1pdF9sYWJlbF90aGVuX2NsZWFyKGZpZWxkLCBlbWl0LCBib2R5LCBjZmcsIGN0eCkge1xuXHRcdGNmZyA9IGNmZyB8fCB7fTtcblx0XHR2YXIgYWRkX2xhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xuXHRcdHZhciBsYWJlbCA9IGZpZWxkICYmIHR5cGVvZiBmaWVsZC5sYWJlbCA9PT0gJ3N0cmluZycgPyBmaWVsZC5sYWJlbC50cmltKCkgOiAnJztcblx0XHR2YXIgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcblx0XHR2YXIgcmVxID0gRXhwICYmIEV4cC5pc19yZXF1aXJlZCAmJiBFeHAuaXNfcmVxdWlyZWQoZmllbGQpID8gJyonIDogJyc7XG5cdFx0dmFyIHdyYXBwZWRfYm9keSA9IHdyYXBfYm9keV9pZl9uZWVkZWQoZmllbGQsIGJvZHksIGN0eCk7XG5cblx0XHRpZiAobGFiZWwgJiYgYWRkX2xhYmVscykge1xuXHRcdFx0ZW1pdCgnPGw+JyArIGVzY2FwZV9odG1sKGxhYmVsKSArIHJlcSArICc8L2w+Jyk7XG5cdFx0XHRlbWl0KCc8ZGl2IHN0eWxlPVwiY2xlYXI6Ym90aDtmbGV4OiAxIDEgMTAwJTtcIj48L2Rpdj4nKTtcblx0XHRcdGVtaXQod3JhcHBlZF9ib2R5KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZW1pdCh3cmFwcGVkX2JvZHkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBmcm9udGVuZCBtYXJrdXAgdXNlZCB3aGVuIGEgd2Vla2RheSBoYXMgbm8gc3RhcnQgdGltZXMuXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IE5vLXN0YXJ0LXRpbWVzIG1hcmt1cC5cblx0ICovXG5cdGZ1bmN0aW9uIG5vX3Nsb3RzX21hcmt1cCgpIHtcblx0XHRyZXR1cm4gJzxzcGFuIGNsYXNzPVwid3BiY19ub190aW1lX3Nsb3RzXCI+Tm8gc3RhcnQgdGltZXMgYXZhaWxhYmxlLjwvc3Bhbj4nO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIGEgY2Fub25pY2FsIHN0YXJ0dGltZSBzZWxlY3RvciBmb3Igb25lIHdlZWtkYXkgZ3JvdXAuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZCBGaWVsZCBkYXRhLlxuXHQgKiBAcGFyYW0ge0FycmF5PHtmcm9tOnN0cmluZyx0bzpzdHJpbmd9Pn0gcmFuZ2VzIFBlcnNpc3RlZCByYW5nZXMuXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9IFN0YXJ0dGltZSBzaG9ydGNvZGUgb3IgZW1wdHktc3RhdGUgbWFya3VwLlxuXHQgKi9cblx0ZnVuY3Rpb24gc2VsZWN0X3Nob3J0Y29kZV9mb3Jfc2xvdHMoZmllbGQsIHJhbmdlcykge1xuXHRcdHZhciBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xuXHRcdHZhciByZXEgPSAoRXhwICYmIEV4cC5pc19yZXF1aXJlZCAmJiBFeHAuaXNfcmVxdWlyZWQoZmllbGQpKSA/ICcqJyA6ICcnO1xuXHRcdHZhciB0b2tlbnMgPSBzbG90X3Rva2VucyhyYW5nZXMsIGZpZWxkICYmIGZpZWxkLnN0ZXBfbWludXRlcyk7XG5cdFx0aWYgKCF0b2tlbnMpIHtcblx0XHRcdHJldHVybiBub19zbG90c19tYXJrdXAoKTtcblx0XHR9XG5cdFx0cmV0dXJuICdbc2VsZWN0Ym94JyArIHJlcSArICcgc3RhcnR0aW1lICcgKyB0b2tlbnMgKyAnXSc7XG5cdH1cblxuXHQvKipcblx0ICogUmVnaXN0ZXIgQWR2YW5jZWQgYm9va2luZy1mb3JtIGV4cG9ydCBmb3Igd2Vla2RheSBzdGFydCB0aW1lcy5cblx0ICpcblx0ICogQHJldHVybnMge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZWdpc3Rlcl9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSB7XG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XG5cdFx0aWYgKCFFeHAgfHwgdHlwZW9mIEV4cC5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlcignd2Vla2RheV9zdGFydHRpbWUnKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdEV4cC5yZWdpc3Rlcignd2Vla2RheV9zdGFydHRpbWUnLCBmdW5jdGlvbiAoZmllbGQsIGVtaXQsIGV4dHJhcykge1xuXHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xuXHRcdFx0dmFyIGNmZyA9IGV4dHJhcy5jZmcgfHwge307XG5cdFx0XHR2YXIgY3R4ID0gZXh0cmFzLmN0eCB8fCB7fTtcblxuXHRcdFx0aWYgKCFpc19wYWNrX3N1cHBvcnRlZChmaWVsZCkpIHtcblx0XHRcdFx0ZW1pdF9sYWJlbF90aGVuX2NsZWFyKGZpZWxkLCBlbWl0LCAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX191cGdyYWRlX3JlcXVpcmVkXCI+JyArIGVzY2FwZV9odG1sKHVwZ3JhZGVfdGV4dChmaWVsZCkpICsgJzwvZGl2PicsIGNmZywgY3R4KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgY29uZGl0aW9uX25hbWUgPSAnd2Vla2RheS1jb25kaXRpb24nO1xuXHRcdFx0dmFyIHNsb3RzID0gbm9ybWFsaXplX3Nsb3RzKGZpZWxkICYmIGZpZWxkLnNsb3RzKTtcblx0XHRcdHZhciBkZWZhdWx0X3JhbmdlcyA9IHNsb3RzWydkZWZhdWx0J10gfHwgW107XG5cdFx0XHR2YXIgYmxvY2tzID0gW107XG5cblx0XHRcdGJsb2Nrcy5wdXNoKGNvbmRpdGlvbl9ibG9jayhjb25kaXRpb25fbmFtZSwgJyonLCBzZWxlY3Rfc2hvcnRjb2RlX2Zvcl9zbG90cyhmaWVsZCwgZGVmYXVsdF9yYW5nZXMpKSk7XG5cblx0XHRcdHZhciBncm91cHMgPSB7fTtcblx0XHRcdHZhciBkZWZhdWx0X3NpZyA9IHNsb3RzX3NpZ25hdHVyZShkZWZhdWx0X3Jhbmdlcyk7XG5cdFx0XHR3ZWVrZGF5X29yZGVyKCkuZm9yRWFjaChmdW5jdGlvbiAoZGF5X2tleSkge1xuXHRcdFx0XHR2YXIgcmFuZ2VzID0gc2xvdHNbZGF5X2tleV0gfHwgW107XG5cdFx0XHRcdHZhciBzaWcgPSBzbG90c19zaWduYXR1cmUocmFuZ2VzKTtcblx0XHRcdFx0aWYgKHNpZyA9PT0gZGVmYXVsdF9zaWcpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFncm91cHNbc2lnXSkge1xuXHRcdFx0XHRcdGdyb3Vwc1tzaWddID0geyBkYXlzOiBbXSwgcmFuZ2VzOiByYW5nZXMgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRncm91cHNbc2lnXS5kYXlzLnB1c2god2Vla2RheV90b19jb25kaXRpb25fdmFsdWUoZGF5X2tleSkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdE9iamVjdC5rZXlzKGdyb3VwcykuZm9yRWFjaChmdW5jdGlvbiAoc2lnKSB7XG5cdFx0XHRcdHZhciBncm91cCA9IGdyb3Vwc1tzaWddO1xuXHRcdFx0XHRibG9ja3MucHVzaChjb25kaXRpb25fYmxvY2soXG5cdFx0XHRcdFx0Y29uZGl0aW9uX25hbWUsXG5cdFx0XHRcdFx0Z3JvdXAuZGF5cy5qb2luKCcsJyksXG5cdFx0XHRcdFx0c2VsZWN0X3Nob3J0Y29kZV9mb3Jfc2xvdHMoZmllbGQsIGdyb3VwLnJhbmdlcylcblx0XHRcdFx0KSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dmFyIGJvZHkgPSBibG9ja3Muam9pbignXFxuJyk7XG5cdFx0XHRlbWl0X2xhYmVsX3RoZW5fY2xlYXIoZmllbGQsIGVtaXQsIGJvZHksIGNmZywgY3R4KTtcblx0XHR9KTtcblx0fVxuXG5cdGlmICh3LldQQkNfQkZCX0V4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0cmVnaXN0ZXJfYm9va2luZ19mb3JtX2V4cG9ydGVyKCk7XG5cdH0gZWxzZSB7XG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmJmYjpleHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX2Jvb2tpbmdfZm9ybV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlZ2lzdGVyIEJvb2tpbmcgRGF0YSBleHBvcnQgZm9yIHRoZSBjYW5vbmljYWwgc3RhcnR0aW1lIGZpZWxkLlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcblx0XHR2YXIgQyA9IHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyO1xuXHRcdGlmICghQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIEMuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEMuaGFzX2V4cG9ydGVyKCd3ZWVrZGF5X3N0YXJ0dGltZScpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdEMucmVnaXN0ZXIoJ3dlZWtkYXlfc3RhcnR0aW1lJywgZnVuY3Rpb24gKGZpZWxkLCBlbWl0LCBleHRyYXMpIHtcblx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcblx0XHRcdHZhciBjZmcgPSBleHRyYXMuY2ZnIHx8IHt9O1xuXHRcdFx0dmFyIGxhYmVsID0gKGZpZWxkICYmIHR5cGVvZiBmaWVsZC5sYWJlbCA9PT0gJ3N0cmluZycgJiYgZmllbGQubGFiZWwudHJpbSgpKSA/IGZpZWxkLmxhYmVsLnRyaW0oKSA6ICdTdGFydCB0aW1lJztcblx0XHRcdGlmICghaXNfcGFja19zdXBwb3J0ZWQoZmllbGQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChDLmVtaXRfbGluZV9ib2xkX2ZpZWxkKSB7XG5cdFx0XHRcdEMuZW1pdF9saW5lX2JvbGRfZmllbGQoZW1pdCwgbGFiZWwsICdzdGFydHRpbWUnLCBjZmcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZW1pdCgnPGI+JyArIGVzY2FwZV9odG1sKGxhYmVsKSArICc8L2I+OiA8Zj5bc3RhcnR0aW1lXTwvZj48YnI+Jyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRpZiAody5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0cmVnaXN0ZXJfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XG5cdH0gZWxzZSB7XG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfYm9va2luZ19kYXRhX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSk7XG5cdH1cblxuXHR2YXIgY3NzID0gJydcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9wcmV2aWV3e2JvcmRlcjoxcHggc29saWQgI2UzZTNlMztib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjhweDtiYWNrZ3JvdW5kOiNmZmY7fSdcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9wcmV2aWV3X19yb3d7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7Z2FwOjhweDttYXJnaW46M3B4IDA7fSdcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9wcmV2aWV3X19kYXl7d2lkdGg6NTJweDtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7b3BhY2l0eTouODt9J1xuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lX3ByZXZpZXdfX3Nsb3Rze2ZsZXg6MTt9J1xuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lX2JhZGdle2Rpc3BsYXk6aW5saW5lLWJsb2NrO2JvcmRlcjoxcHggc29saWQgI2Q1ZDVkNTtib3JkZXItcmFkaXVzOjEycHg7cGFkZGluZzoycHggOHB4O21hcmdpbjowIDRweCA0cHggMDtmb250LXNpemU6MTFweDtiYWNrZ3JvdW5kOiNmOGY4Zjg7fSdcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9iYWRnZS0tZW1wdHl7b3BhY2l0eTouNjt9J1xuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF90b29sYmFye2Rpc3BsYXk6ZmxleDtnYXA6OHB4O21hcmdpbjo4cHggMDt9J1xuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9yb290e2JvcmRlcjoxcHggc29saWQgI2RkZDtib3JkZXItcmFkaXVzOjZweDtvdmVyZmxvdzphdXRvO21hcmdpbi10b3A6NnB4O30nXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2hlYWQsLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX3Jvd3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjc2cHggOTJweCByZXBlYXQoNyw2NHB4KTttaW4td2lkdGg6NjE2cHg7fSdcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbHtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjZWVlO2JvcmRlci1yaWdodDoxcHggc29saWQgI2Y0ZjRmNDtib3gtc2l6aW5nOmJvcmRlci1ib3g7bWluLWhlaWdodDoyNHB4O3BhZGRpbmc6NHB4O30nXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLWNvcm5lciwud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tZGF5LC53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS10aW1le2JhY2tncm91bmQ6I2ZhZmFmYTt9J1xuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1kYXl7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC13ZWlnaHQ6NjAwO30nXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXRpbWV7Zm9udC12YXJpYW50LW51bWVyaWM6dGFidWxhci1udW1zO30nXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3R7Y3Vyc29yOmNyb3NzaGFpcjt9J1xuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1zbG90LmlzLW9ue2JhY2tncm91bmQ6cmdiYSgwLDEyMCwyMTIsLjE0KTtvdXRsaW5lOjFweCBzb2xpZCByZ2JhKDAsMTIwLDIxMiwuMzUpO30nO1xuXG5cdHRyeSB7XG5cdFx0dmFyIHN0eWxlID0gZC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuXHRcdHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO1xuXHRcdHN0eWxlLmFwcGVuZENoaWxkKGQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7XG5cdFx0ZC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcblx0fSBjYXRjaCAoZSkge31cbn0pKHdpbmRvdywgZG9jdW1lbnQpO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaLElBQUlDLElBQUksR0FBR0YsQ0FBQyxDQUFDRyxhQUFhLElBQUksQ0FBQyxDQUFDOztFQUVoQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxJQUFJQSxDQUFDQyxDQUFDLEVBQUU7SUFDaEJBLENBQUMsR0FBR0MsUUFBUSxDQUFDRCxDQUFDLEVBQUUsRUFBRSxDQUFDO0lBQ25CLE9BQU8sQ0FBQ0EsQ0FBQyxHQUFHLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxJQUFJQSxDQUFDO0VBQy9COztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNFLFdBQVdBLENBQUNDLENBQUMsRUFBRTtJQUN2QixJQUFJLENBQUNBLENBQUMsSUFBSSxPQUFPQSxDQUFDLEtBQUssUUFBUSxFQUFFO01BQ2hDLE9BQU8sSUFBSTtJQUNaO0lBQ0EsSUFBSUMsQ0FBQyxHQUFHRCxDQUFDLENBQUNFLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQztJQUN0QyxJQUFJLENBQUNELENBQUMsRUFBRTtNQUNQLE9BQU8sSUFBSTtJQUNaO0lBQ0EsSUFBSUUsQ0FBQyxHQUFHTCxRQUFRLENBQUNHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7SUFDMUIsSUFBSUcsR0FBRyxHQUFHTixRQUFRLENBQUNHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7SUFDNUIsSUFBSUUsQ0FBQyxHQUFHLENBQUMsSUFBSUEsQ0FBQyxHQUFHLEVBQUUsSUFBSUMsR0FBRyxHQUFHLENBQUMsSUFBSUEsR0FBRyxHQUFHLEVBQUUsRUFBRTtNQUMzQyxPQUFPLElBQUk7SUFDWjtJQUNBLE9BQU9ELENBQUMs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QUFDLENBQUMsR0FBRyxZQUFZO01BQ2hILElBQUksQ0FBQ3ZMLGlCQUFpQixDQUFDQyxLQUFLLENBQUMsRUFBRTtRQUM5QjtNQUNEO01BQ0EsSUFBSXFOLENBQUMsQ0FBQ0Usb0JBQW9CLEVBQUU7UUFDM0JGLENBQUMsQ0FBQ0Usb0JBQW9CLENBQUN4QixJQUFJLEVBQUV4SSxLQUFLLEVBQUUsV0FBVyxFQUFFeUksR0FBRyxDQUFDO01BQ3RELENBQUMsTUFBTTtRQUNORCxJQUFJLENBQUMsS0FBSyxHQUFHNUIsV0FBVyxDQUFDNUcsS0FBSyxDQUFDLEdBQUcsOEJBQThCLENBQUM7TUFDbEU7SUFDRCxDQUFDLENBQUM7RUFDSDtFQUVBLElBQUl4RixDQUFDLENBQUN1UCx3QkFBd0IsSUFBSSxPQUFPdlAsQ0FBQyxDQUFDdVAsd0JBQXdCLENBQUNwRyxRQUFRLEtBQUssVUFBVSxFQUFFO0lBQzVGa0csOEJBQThCLENBQUMsQ0FBQztFQUNqQyxDQUFDLE1BQU07SUFDTnBQLENBQUMsQ0FBQ3dILGdCQUFnQixDQUFDLGlDQUFpQyxFQUFFNEgsOEJBQThCLEVBQUU7TUFBRUQsSUFBSSxFQUFFO0lBQUssQ0FBQyxDQUFDO0VBQ3RHO0VBRUEsSUFBSUssR0FBRyxHQUFHLEVBQUUsR0FDVCwwR0FBMEcsR0FDMUcsaUdBQWlHLEdBQ2pHLDZGQUE2RixHQUM3RixpREFBaUQsR0FDakQsdUtBQXVLLEdBQ3ZLLG1EQUFtRCxHQUNuRCx5RUFBeUUsR0FDekUseUdBQXlHLEdBQ3pHLGdKQUFnSixHQUNoSixrSkFBa0osR0FDbEosNElBQTRJLEdBQzVJLDJFQUEyRSxHQUMzRSw0RUFBNEUsR0FDNUUsMkRBQTJELEdBQzNELHFIQUFxSDtFQUV4SCxJQUFJO0lBQ0gsSUFBSUMsS0FBSyxHQUFHelAsQ0FBQyxDQUFDeUYsYUFBYSxDQUFDLE9BQU8sQ0FBQztJQUNwQ2dLLEtBQUssQ0FBQzVGLElBQUksR0FBRyxVQUFVO0lBQ3ZCNEYsS0FBSyxDQUFDOUosV0FBVyxDQUFDM0YsQ0FBQyxDQUFDMFAsY0FBYyxDQUFDRixHQUFHLENBQUMsQ0FBQztJQUN4Q3hQLENBQUMsQ0FBQzJQLElBQUksQ0FBQ2hLLFdBQVcsQ0FBQzhKLEtBQUssQ0FBQztFQUMxQixDQUFDLENBQUMsT0FBTzdNLENBQUMsRUFBRSxDQUFDO0FBQ2QsQ0FBQyxFQUFFZ04sTUFBTSxFQUFFQyxRQUFRLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
