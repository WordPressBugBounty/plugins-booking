"use strict";

// File: /includes/page-form-builder/field-packs/time-slots/_out/field-time-slots-wptpl.js
(function (w, d) {
  'use strict';

  /**
   * WPBC BFB — Time Slots (robust)
   * - Defers renderer registration until Core/Registry exists (prevents "No renderer found").
   * - Initializes the Inspector via custom event, DOMContentLoaded, and MutationObserver fallbacks.
   * - Implements toolbar buttons: rename, duplicate, clear, copy ← day, copy ← week, Fill row…, Fill column…
   * - All helpers and identifiers use snake_case where possible.
   */

  /* ====================== Tiny utils ====================== */
  function pad2(n) {
    n = parseInt(n, 10);
    return n < 10 ? '0' + n : '' + n;
  }
  function time_to_min(t) {
    if (!t || 'string' !== typeof t) {
      return null;
    }
    var m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
      return null;
    }
    var hh = parseInt(m[1], 10),
      mm = parseInt(m[2], 10);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return null;
    }
    return hh * 60 + mm;
  }
  function min_to_time(mins) {
    var m = parseInt(mins, 10);
    if (!isFinite(m)) {
      m = 0;
    }
    if (m < 0) {
      m = 0;
    }
    m = m % (24 * 60);
    var hh = Math.floor(m / 60),
      mm = m % 60;
    return pad2(hh) + ':' + pad2(mm);
  }
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
  function build_row_minutes(from_min, to_min, step) {
    var arr = [];
    for (var m = from_min; m < to_min; m += step) {
      arr.push(m);
    }
    return arr;
  }

  /**
   * Merge minute indexes into continuous time ranges.
   *
   * @param {Array<number>} selected_minutes Sorted minute indexes (start of each slot)
   * @param {number} step Step in minutes
   * @return {Array<{from:string,to:string}>}
   */
  function merge_day_ranges(selected_minutes, step) {
    var out = [];
    if (!Array.isArray(selected_minutes) || !selected_minutes.length) {
      return out;
    }
    selected_minutes.sort(function (a, b) {
      return a - b;
    });
    var run_start = selected_minutes[0],
      prev = run_start,
      i,
      m;
    for (i = 1; i < selected_minutes.length; i++) {
      m = selected_minutes[i];
      if (m === prev + step) {
        prev = m;
        continue;
      }
      out.push({
        from: min_to_time(run_start),
        to: min_to_time(prev + step)
      });
      run_start = m;
      prev = m;
    }
    out.push({
      from: min_to_time(run_start),
      to: min_to_time(prev + step)
    });
    return out;
  }

  /**
   * Expand ranges to a set of "on" minute cells for easy painting.
   */
  function expand_day_ranges(ranges, step, from_min, to_min) {
    var set = Object.create(null);
    (ranges || []).forEach(function (r) {
      var a = time_to_min(r.from),
        b = time_to_min(r.to);
      if (a == null || b == null) {
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
   * Keep profiles length in sync with week_cycle.
   */
  function reconcile_profiles(profiles, week_cycle) {
    var out = [],
      labels = ['Week A', 'Week B', 'Week C', 'Week D', 'Week E', 'Week F'],
      i;
    for (i = 0; i < week_cycle; i++) {
      if (profiles && profiles[i]) {
        out.push(profiles[i]);
      } else {
        out.push({
          key: String.fromCharCode(65 + i),
          label: labels[i] || 'Week ' + (i + 1),
          slots: {
            '1': [],
            '2': [],
            '3': [],
            '4': [],
            '5': [],
            '6': [],
            '7': []
          }
        });
      }
    }
    return out;
  }

  /**
   * Snap a minute value to a step grid.
   *
   * @param {number} m Minute value
   * @param {number} step Step in minutes
   * @param {'down'|'up'} dir Direction
   */
  function snap_to_step(m, step, dir) {
    var q = Math.floor(m / step) * step;
    if ('up' === dir && q < m) {
      q += step;
    }
    return q;
  }

  /* ====================== Templates ====================== */

  var tmpl_fn = w.wp && w.wp.template ? w.wp.template : function () {
    return function () {
      return '';
    };
  };
  function render_grid_rows(body_el, start_min, end_min, step) {
    body_el.innerHTML = '';
    var row_t = tmpl_fn('wpbc-bfb-timegrid-row');
    build_row_minutes(start_min, end_min, step).forEach(function (minute) {
      var html = row_t({
        minute: minute,
        label: min_to_time(minute)
      });
      var wrap = d.createElement('div');
      wrap.innerHTML = html;
      var row = wrap.firstElementChild;
      if (row) {
        body_el.appendChild(row);
      }
    });
  }
  function paint_selection(root, profile, start_min, end_min, step) {
    var body = root.querySelector('.wpbc_bfb__timegrid_body');
    if (!body || !profile || !profile.slots) {
      return;
    }
    for (var d_i = 1; d_i <= 7; d_i++) {
      var ranges = profile.slots[String(d_i)] || [];
      var set = expand_day_ranges(ranges, step, start_min, end_min);
      var cells = body.querySelectorAll('.wpbc_bfb__timegrid_cell--slot[data-day="' + d_i + '"]');
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var mm = parseInt(c.getAttribute('data-minute'), 10);
        if (set[mm]) {
          c.classList.add('is-on');
        } else {
          c.classList.remove('is-on');
        }
      }
    }
  }
  function read_selection_into_profile(root, profile, start_min, end_min, step) {
    var body = root.querySelector('.wpbc_bfb__timegrid_body');
    if (!body || !profile) {
      return;
    }
    for (var d_i = 1; d_i <= 7; d_i++) {
      var cells = body.querySelectorAll('.wpbc_bfb__timegrid_cell--slot[data-day="' + d_i + '"].is-on');
      var minutes = [],
        i;
      for (i = 0; i < cells.length; i++) {
        minutes.push(parseInt(cells[i].getAttribute('data-minute'), 10));
      }
      profile.slots[String(d_i)] = merge_day_ranges(minutes, step);
    }
  }
  function toggle_rect(root, day_from, day_to, min_from, min_to, mode) {
    var body = root.querySelector('.wpbc_bfb__timegrid_body');
    if (!body) {
      return;
    }
    var df = Math.min(day_from, day_to),
      dt = Math.max(day_from, day_to);
    var mf = Math.min(min_from, min_to),
      mt = Math.max(min_from, min_to);
    for (var d_i = df; d_i <= dt; d_i++) {
      var cells = body.querySelectorAll('.wpbc_bfb__timegrid_cell--slot[data-day="' + d_i + '"]');
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i],
          mm = parseInt(c.getAttribute('data-minute'), 10);
        if (mm >= mf && mm <= mt) {
          if ('on' === mode) {
            c.classList.add('is-on');
          } else if ('off' === mode) {
            c.classList.remove('is-on');
          } else {
            c.classList.toggle('is-on');
          }
        }
      }
    }
  }

  /* ====================== Inspector controller ====================== */

  /**
   * Parse day tokens like "Mon,Wed,Fri", "1-5", "Mon-Fri".
   *
   * @return {Array<number>} days 1..7
   */
  function parse_days_input(txt) {
    var map = {
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
      sun: 7
    };
    if (!txt || 'string' !== typeof txt) {
      return [1, 2, 3, 4, 5, 6, 7];
    }
    var t = txt.toLowerCase().replace(/\s+/g, '').trim();
    if (!t) {
      return [1, 2, 3, 4, 5, 6, 7];
    }
    function push_range(a, b, out) {
      var i,
        s = Math.min(a, b),
        e = Math.max(a, b);
      for (i = s; i <= e; i++) {
        out.push(i);
      }
    }
    var out = [];
    // split by comma first, then support ranges with '-'
    var parts = t.split(',');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) {
        continue;
      }
      var rng = p.split('-');
      if (rng.length === 2) {
        var a = map[rng[0]] || parseInt(rng[0], 10);
        var b = map[rng[1]] || parseInt(rng[1], 10);
        if (isFinite(a) && isFinite(b)) {
          push_range(a, b, out);
        }
      } else {
        var v = map[p] || parseInt(p, 10);
        if (isFinite(v)) {
          out.push(v);
        }
      }
    }
    // sanitize to 1..7 unique
    var seen = {};
    out = out.filter(function (n) {
      if (n < 1 || n > 7 || seen[n]) {
        return false;
      }
      seen[n] = true;
      return true;
    });
    return out.length ? out : [1, 2, 3, 4, 5, 6, 7];
  }

  /**
   * Initialize grid (rows, painting, events) and wire toolbar actions.
   */
  function init_grid_controller(inspector_root, data_obj, update_hidden_json_cb) {
    if (inspector_root.__wpbc_timegrid_inited) {
      return;
    }
    inspector_root.__wpbc_timegrid_inited = true;
    var grid_root = inspector_root.querySelector('.wpbc_bfb__timegrid_root');
    var body_el = grid_root.querySelector('.wpbc_bfb__timegrid_body');
    var start_time_in = inspector_root.querySelector('[data-inspector-key="start_time"]');
    var end_time_in = inspector_root.querySelector('[data-inspector-key="end_time"]');
    var step_in = inspector_root.querySelector('[data-inspector-key="step_minutes"]');
    var week_cycle_in = inspector_root.querySelector('.js-week-cycle');
    var profile_sel = inspector_root.querySelector('.js-profile-select');
    var btn_rename = inspector_root.querySelector('.js-profile-rename');
    var btn_duplicate = inspector_root.querySelector('.js-profile-duplicate');
    var btn_clear = inspector_root.querySelector('.js-profile-clear');
    var btn_row_fill = inspector_root.querySelector('.js-row-fill');
    var btn_col_fill = inspector_root.querySelector('.js-col-fill');
    var btn_copy_day = inspector_root.querySelector('.js-copy-prev-day');
    var btn_copy_week = inspector_root.querySelector('.js-copy-prev-week');
    function get_state() {
      var start_min = time_to_min(start_time_in && start_time_in.value || '08:00');
      var end_min = time_to_min(end_time_in && end_time_in.value || '20:00');
      var step = normalize_step(step_in && step_in.value || 30);
      if (start_min == null) {
        start_min = 8 * 60;
      }
      if (end_min == null) {
        end_min = 20 * 60;
      }
      if (end_min <= start_min) {
        end_min = start_min + step;
      }
      return {
        start_min: start_min,
        end_min: end_min,
        step: step
      };
    }
    function refresh_profile_selector() {
      profile_sel.innerHTML = '';
      (data_obj.profiles || []).forEach(function (p, i) {
        var opt = d.createElement('option');
        opt.value = '' + i;
        opt.textContent = p && p.label ? p.label : 'Week ' + (i + 1);
        profile_sel.appendChild(opt);
      });
      if (data_obj.profiles.length) {
        profile_sel.value = '0';
      }
    }
    function current_profile_index() {
      var idx = parseInt(profile_sel.value || '0', 10);
      if (!isFinite(idx) || idx < 0) {
        idx = 0;
      }
      if (idx >= data_obj.profiles.length) {
        idx = data_obj.profiles.length - 1;
      }
      return idx;
    }
    function current_profile() {
      return data_obj.profiles[current_profile_index()];
    }
    function rebuild_rows_and_paint() {
      var st = get_state();
      render_grid_rows(body_el, st.start_min, st.end_min, st.step);
      paint_selection(grid_root, current_profile(), st.start_min, st.end_min, st.step);
    }
    function persist_profiles() {
      var st = get_state();
      read_selection_into_profile(grid_root, current_profile(), st.start_min, st.end_min, st.step);
      update_hidden_json_cb(data_obj.profiles);
    }

    /* ---------- Toolbar actions (buttons) ---------- */

    // Rename profile
    if (btn_rename) {
      btn_rename.addEventListener('click', function () {
        var p = current_profile();
        if (!p) {
          return;
        }
        var nv = w.prompt('Profile name:', p.label || '');
        if (nv != null) {
          p.label = ('' + nv).trim() || p.label;
          var keep = current_profile_index();
          refresh_profile_selector();
          profile_sel.value = '' + keep;
          persist_profiles();
        }
      });
    }

    // Duplicate profile (max 6, per UI)
    if (btn_duplicate) {
      btn_duplicate.addEventListener('click', function () {
        if (data_obj.profiles.length >= 6) {
          w.alert('Maximum profiles reached (6).');
          return;
        }
        var idx = current_profile_index();
        var p = current_profile();
        var copy = JSON.parse(JSON.stringify(p));
        copy.label = (p.label || 'Week') + ' (copy)';
        data_obj.profiles.splice(idx + 1, 0, copy);

        // Adjust cycle to fit
        var wc = parseInt(week_cycle_in && week_cycle_in.value || '1', 10);
        if (!isFinite(wc) || wc < 1) {
          wc = 1;
        }
        wc = Math.min(6, Math.max(wc, data_obj.profiles.length));
        if (week_cycle_in) {
          week_cycle_in.value = '' + wc;
        }
        data_obj.week_cycle = wc;
        refresh_profile_selector();
        profile_sel.value = '' + (idx + 1);
        rebuild_rows_and_paint();
        persist_profiles();
      });
    }

    // Clear all slots in current profile
    if (btn_clear) {
      btn_clear.addEventListener('click', function () {
        var p = current_profile();
        if (!p) {
          return;
        }
        p.slots = {
          '1': [],
          '2': [],
          '3': [],
          '4': [],
          '5': [],
          '6': [],
          '7': []
        };
        rebuild_rows_and_paint();
        persist_profiles();
      });
    }

    // Copy ← day : copy day-1 into day, for 2..7
    if (btn_copy_day) {
      btn_copy_day.addEventListener('click', function () {
        var p = current_profile();
        if (!p) {
          return;
        }
        var st = get_state();
        read_selection_into_profile(grid_root, p, st.start_min, st.end_min, st.step);
        for (var d_i = 2; d_i <= 7; d_i++) {
          p.slots[String(d_i)] = JSON.parse(JSON.stringify(p.slots[String(d_i - 1)] || []));
        }
        rebuild_rows_and_paint();
        persist_profiles();
      });
    }

    // Copy ← week : copy previous profile slots into current
    if (btn_copy_week) {
      btn_copy_week.addEventListener('click', function () {
        var idx = current_profile_index();
        if (idx <= 0) {
          return;
        }
        var prev = data_obj.profiles[idx - 1];
        var cur = data_obj.profiles[idx];
        cur.slots = JSON.parse(JSON.stringify(prev && prev.slots ? prev.slots : {
          '1': [],
          '2': [],
          '3': [],
          '4': [],
          '5': [],
          '6': [],
          '7': []
        }));
        rebuild_rows_and_paint();
        persist_profiles();
      });
    }

    // Fill row… : prompt for time range; apply across ALL days
    if (btn_row_fill) {
      btn_row_fill.addEventListener('click', function () {
        var st = get_state();
        var rng = w.prompt('Enter time range to fill across ALL days (e.g. 09:00-12:00):', '');
        if (!rng) {
          return;
        }
        var mm = rng.replace(/\s+/g, '').split('-');
        if (mm.length !== 2) {
          return;
        }
        var a = time_to_min(mm[0]),
          b = time_to_min(mm[1]);
        if (a == null || b == null) {
          return;
        }
        a = snap_to_step(a, st.step, 'down');
        b = snap_to_step(b, st.step, 'up');
        if (b <= a) {
          return;
        }
        // paint DOM rectangle then persist (automatic merge)
        toggle_rect(grid_root, 1, 7, a, b - st.step, 'on');
        persist_profiles();
        paint_selection(grid_root, current_profile(), st.start_min, st.end_min, st.step);
      });
    }

    // Fill column… : prompt for time range and days (e.g. "Mon-Fri" or "1,3,5")
    if (btn_col_fill) {
      btn_col_fill.addEventListener('click', function () {
        var st = get_state();
        var rng = w.prompt('Enter time range (e.g. 10:00-14:00):', '');
        if (!rng) {
          return;
        }
        var days = w.prompt('Enter days (Mon-Fri, 1-7, Mon,Wed,Fri). Leave empty for Mon-Fri:', 'Mon-Fri');
        var day_list = parse_days_input(days || 'Mon-Fri');
        var mm = rng.replace(/\s+/g, '').split('-');
        if (mm.length !== 2) {
          return;
        }
        var a = time_to_min(mm[0]),
          b = time_to_min(mm[1]);
        if (a == null || b == null) {
          return;
        }
        a = snap_to_step(a, st.step, 'down');
        b = snap_to_step(b, st.step, 'up');
        if (b <= a) {
          return;
        }

        // apply to selected days only
        for (var i = 0; i < day_list.length; i++) {
          var d_i = day_list[i];
          toggle_rect(grid_root, d_i, d_i, a, b - st.step, 'on');
        }
        persist_profiles();
        paint_selection(grid_root, current_profile(), st.start_min, st.end_min, st.step);
      });
    }

    /* ---------- Core UI bindings ---------- */

    // Week cycle
    if (week_cycle_in) {
      week_cycle_in.addEventListener('change', function () {
        var wc = parseInt(week_cycle_in.value || '1', 10);
        if (!isFinite(wc) || wc < 1) {
          wc = 1;
        }
        if (wc > 6) {
          wc = 6;
        }
        data_obj.week_cycle = wc;
        data_obj.profiles = reconcile_profiles(data_obj.profiles || [], wc);
        var keep_idx = 0;
        refresh_profile_selector();
        profile_sel.value = '' + keep_idx;
        rebuild_rows_and_paint();
        persist_profiles();
      });
    }

    // Profile switch
    if (profile_sel) {
      profile_sel.addEventListener('change', function () {
        rebuild_rows_and_paint();
      });
    }

    // Time range / step
    [start_time_in, end_time_in, step_in].forEach(function (el) {
      if (el) {
        el.addEventListener('change', function () {
          rebuild_rows_and_paint();
          persist_profiles();
        });
      }
    });

    // Drag selection
    var drag_state = null;
    body_el.addEventListener('mousedown', function (ev) {
      var cell = ev.target && ev.target.closest && ev.target.closest('.wpbc_bfb__timegrid_cell--slot');
      if (!cell) {
        return;
      }
      var day = parseInt(cell.getAttribute('data-day'), 10);
      var mm = parseInt(cell.getAttribute('data-minute'), 10);
      var will_on = !cell.classList.contains('is-on');
      drag_state = {
        day0: day,
        mm0: mm,
        mode: will_on ? 'on' : 'off'
      };
      toggle_rect(grid_root, day, day, mm, mm, drag_state.mode);
      ev.preventDefault();
    });
    body_el.addEventListener('mouseover', function (ev) {
      if (!drag_state) {
        return;
      }
      var cell = ev.target && ev.target.closest && ev.target.closest('.wpbc_bfb__timegrid_cell--slot');
      if (!cell) {
        return;
      }
      var day = parseInt(cell.getAttribute('data-day'), 10);
      var mm = parseInt(cell.getAttribute('data-minute'), 10);
      toggle_rect(grid_root, drag_state.day0, day, drag_state.mm0, mm, drag_state.mode);
    });
    w.addEventListener('mouseup', function () {
      if (drag_state) {
        drag_state = null;
        persist_profiles();
      }
    });

    // First render
    data_obj.week_cycle = parseInt(data_obj.week_cycle || 1, 10);
    if (!isFinite(data_obj.week_cycle) || data_obj.week_cycle < 1) {
      data_obj.week_cycle = 1;
    }
    if (data_obj.week_cycle > 6) {
      data_obj.week_cycle = 6;
    }
    data_obj.profiles = reconcile_profiles(Array.isArray(data_obj.profiles) ? data_obj.profiles : [], data_obj.week_cycle);
    refresh_profile_selector();
    rebuild_rows_and_paint();
    persist_profiles();
  }

  /* ====================== Registration (deferred) ====================== */

  function with_registry(cb) {
    var tries = 0,
      max_tries = 200;
    (function loop() {
      var Core = w.WPBC_BFB_Core || {};
      var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
      var Field_Base = Core.WPBC_BFB_Field_Base || Core.WPBC_BFB_Select_Base;
      if (Registry && Registry.register && Field_Base) {
        cb(Registry, Field_Base);
      } else if (tries++ < max_tries) {
        setTimeout(loop, 50);
      } else if (w.console) {
        w.console.error('[WPBC][time_slots] Core/Registry not available.');
      }
    })();
  }
  function register_time_slots() {
    with_registry(function (Registry, Field_Base) {
      class wpbc_bfb_field_time_slots extends Field_Base {
        static template_id = 'wpbc-bfb-field-time-slots';
        static kind = 'time_slots';
        static get_defaults() {
          var d = super.get_defaults ? super.get_defaults() : {};
          return Object.assign({}, d, {
            type: 'time_slots',
            label: 'Time Slots',
            cssclass: '',
            help: '',
            start_time: '08:00',
            end_time: '20:00',
            step_minutes: 30,
            week_cycle: 1,
            profiles: [{
              key: 'A',
              label: 'Week A',
              slots: {
                '1': [],
                '2': [],
                '3': [],
                '4': [],
                '5': [],
                '6': [],
                '7': []
              }
            }],
            min_width: '320px'
          });
        }
      }
      try {
        Registry.register('time_slots', wpbc_bfb_field_time_slots);
      } catch (e) {
        if (w.console) {
          w.console.error('[WPBC][time_slots] register failed:', e);
        }
      }
      w.WPBC_BFB_Field_Time_Slots = wpbc_bfb_field_time_slots; // for debugging
    });
  }
  register_time_slots();

  /* ====================== Inspector init bindings ====================== */

  function try_init_on_panel(panel) {
    if (!panel) {
      return;
    }
    var grid_root = panel.querySelector('.wpbc_bfb__timegrid_root');
    var json_el = panel.querySelector('.js-profiles-json');
    if (!grid_root || !json_el) {
      return;
    }
    if (panel.__wpbc_timegrid_inited) {
      return;
    }
    var profiles = [];
    try {
      profiles = JSON.parse(json_el.value || '[]');
    } catch (e) {
      profiles = [];
    }
    function update_hidden_json(profiles_arr) {
      try {
        json_el.value = JSON.stringify(profiles_arr || []);
        var evt = d.createEvent('HTMLEvents');
        evt.initEvent('change', true, false);
        json_el.dispatchEvent(evt);
      } catch (e) {}
    }
    var data_obj = {
      start_time: (panel.querySelector('[data-inspector-key="start_time"]') || {}).value || '08:00',
      end_time: (panel.querySelector('[data-inspector-key="end_time"]') || {}).value || '20:00',
      step_minutes: parseInt((panel.querySelector('[data-inspector-key="step_minutes"]') || {}).value || '30', 10),
      week_cycle: parseInt((panel.querySelector('.js-week-cycle') || {}).value || '1', 10),
      profiles: profiles
    };
    init_grid_controller(panel, data_obj, update_hidden_json);
  }
  d.addEventListener('wpbc_bfb_inspector_ready', function (ev) {
    try {
      try_init_on_panel(ev && ev.detail && ev.detail.panel);
    } catch (e) {}
  });
  d.addEventListener('DOMContentLoaded', function () {
    var panels = d.querySelectorAll('.wpbc_bfb__inspector__body');
    for (var i = 0; i < panels.length; i++) {
      try_init_on_panel(panels[i]);
    }
  });
  try {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var n = muts[i].target;
        if (!n) {
          continue;
        }
        if (n.classList && n.classList.contains('wpbc_bfb__inspector__body')) {
          try_init_on_panel(n);
        } else if (n.querySelector) {
          var p = n.querySelector('.wpbc_bfb__inspector__body');
          if (p) {
            try_init_on_panel(p);
          }
        }
      }
    });
    mo.observe(d.documentElement, {
      childList: true,
      subtree: true
    });
  } catch (e) {}

  /* ====================== Minimal CSS (scoped) ====================== */

  var css = '' + '.wpbc_bfb__time_preview__week{border:1px solid #e5e5e5;border-radius:6px;padding:8px;margin:8px 0;}' + '.wpbc_bfb__time_preview__week_title{margin-bottom:6px;}' + '.wpbc_bfb__time_preview__row{display:flex;align-items:center;margin:2px 0;}' + '.wpbc_bfb__time_preview__day{width:42px;opacity:.8;font-size:12px;}' + '.wpbc_bfb__time_badge{display:inline-block;border:1px solid #d0d0d0;border-radius:12px;padding:2px 8px;margin:0 4px 4px 0;font-size:11px;background:#f7f7f7;}' + '.wpbc_bfb__time_badge--empty{opacity:.6;}' + '.wpbc_bfb__timegrid_root{border:1px solid #e1e1e1;border-radius:6px;overflow:hidden;margin-top:6px;}' + '.wpbc_bfb__timegrid_head,.wpbc_bfb__timegrid_row{display:grid;grid-template-columns:80px repeat(7,1fr);}' + '.wpbc_bfb__timegrid_cell{border-bottom:1px solid #f0f0f0;border-right:1px solid #f5f5f5;padding:4px;min-height:24px;box-sizing:border-box;}' + '.wpbc_bfb__timegrid_cell--corner{background:#fafafa;}' + '.wpbc_bfb__timegrid_cell--day{background:#fafafa;text-align:center;font-weight:600;}' + '.wpbc_bfb__timegrid_cell--time{background:#fafafa;font-variant-numeric:tabular-nums;}' + '.wpbc_bfb__timegrid_cell--slot{cursor:crosshair;}' + '.wpbc_bfb__timegrid_cell--slot.is-on{background:rgba(0,120,212,.12);outline:1px solid rgba(0,120,212,.35);}' + '.wpbc_bfb__timegrid_toolbar{display:flex;justify-content:space-between;gap:8px;margin:8px 0;}' + '.wpbc_bfb__timegrid_profiles select{min-width:140px;}';
  try {
    var st = d.createElement('style');
    st.type = 'text/css';
    st.appendChild(d.createTextNode(css));
    d.head.appendChild(st);
  } catch (e) {}
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGltZS1ncmlkL19vdXQvdGltZS1ncmlkLXdwdHBsLmpzIiwibmFtZXMiOlsidyIsImQiLCJwYWQyIiwibiIsInBhcnNlSW50IiwidGltZV90b19taW4iLCJ0IiwibSIsIm1hdGNoIiwiaGgiLCJtbSIsIm1pbl90b190aW1lIiwibWlucyIsImlzRmluaXRlIiwiTWF0aCIsImZsb29yIiwibm9ybWFsaXplX3N0ZXAiLCJzdGVwIiwicyIsImJ1aWxkX3Jvd19taW51dGVzIiwiZnJvbV9taW4iLCJ0b19taW4iLCJhcnIiLCJwdXNoIiwibWVyZ2VfZGF5X3JhbmdlcyIsInNlbGVjdGVkX21pbnV0ZXMiLCJvdXQiLCJBcnJheSIsImlzQXJyYXkiLCJsZW5ndGgiLCJzb3J0IiwiYSIsImIiLCJydW5fc3RhcnQiLCJwcmV2IiwiaSIsImZyb20iLCJ0byIsImV4cGFuZF9kYXlfcmFuZ2VzIiwicmFuZ2VzIiwic2V0IiwiT2JqZWN0IiwiY3JlYXRlIiwiZm9yRWFjaCIsInIiLCJyZWNvbmNpbGVfcHJvZmlsZXMiLCJwcm9maWxlcyIsIndlZWtfY3ljbGUiLCJsYWJlbHMiLCJrZXkiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJsYWJlbCIsInNsb3RzIiwic25hcF90b19zdGVwIiwiZGlyIiwicSIsInRtcGxfZm4iLCJ3cCIsInRlbXBsYXRlIiwicmVuZGVyX2dyaWRfcm93cyIsImJvZHlfZWwiLCJzdGFydF9taW4iLCJlbmRfbWluIiwiaW5uZXJIVE1MIiwicm93X3QiLCJtaW51dGUiLCJodG1sIiwid3JhcCIsImNyZWF0ZUVsZW1lbnQiLCJyb3ciLCJmaXJzdEVsZW1lbnRDaGlsZCIsImFwcGVuZENoaWxkIiwicGFpbnRfc2VsZWN0aW9uIiwicm9vdCIsInByb2ZpbGUiLCJib2R5IiwicXVlcnlTZWxlY3RvciIsImRfaSIsImNlbGxzIiwicXVlcnlTZWxlY3RvckFsbCIsImMiLCJnZXRBdHRyaWJ1dGUiLCJjbGFzc0xpc3QiLCJhZGQiLCJyZW1vdmUiLCJyZWFkX3NlbGVjdGlvbl9pbnRvX3Byb2ZpbGUiLCJtaW51dGVzIiwidG9nZ2xlX3JlY3QiLCJkYXlfZnJvbSIsImRheV90byIsIm1pbl9mcm9tIiwibWluX3RvIiwibW9kZSIsImRmIiwibWluIiwiZHQiLCJtYXgiLCJtZiIsIm10IiwidG9nZ2xlIiwicGFyc2VfZGF5c19pbnB1dCIsInR4dCIsIm1hcCIsIm1vbiIsInR1ZSIsIndlZCIsInRodSIsImZyaSIsInNhdCIsInN1biIsInRvTG93ZXJDYXNlIiwicmVwbGFjZSIsInRyaW0iLCJwdXNoX3JhbmdlIiwiZSIsInBhcnRzIiwic3BsaXQiLCJwIiwicm5nIiwidiIsInNlZW4iLCJmaWx0ZXIiLCJpbml0X2dyaWRfY29udHJvbGxlciIsImluc3BlY3Rvcl9yb290IiwiZGF0YV9vYmoiLCJ1cGRhdGVfaGlkZGVuX2pzb25fY2IiLCJfX3dwYmNfdGltZWdyaWRfaW5pdGVkIiwiZ3JpZF9yb290Iiwic3RhcnRfdGltZV9pbiIsImVuZF90aW1lX2luIiwic3RlcF9pbiIsIndlZWtfY3ljbGVfaW4iLCJwcm9maWxlX3NlbCIsImJ0bl9yZW5hbWUiLCJidG5fZHVwbGljYXRlIiwiYnRuX2NsZWFyIiwiYnRuX3Jvd19maWxsIiwiYnRuX2NvbF9maWxsIiwiYnRuX2NvcHlfZGF5IiwiYnRuX2NvcHlfd2VlayIsImdldF9zdGF0ZSIsInZhbHVlIiwicmVmcmVzaF9wcm9maWxlX3NlbGVjdG9yIiwib3B0IiwidGV4dENvbnRlbnQiLCJjdXJyZW50X3Byb2ZpbGVfaW5kZXgiLCJpZHgiLCJjdXJyZW50X3Byb2ZpbGUiLCJyZWJ1aWxkX3Jvd3NfYW5kX3BhaW50Iiwic3QiLCJwZXJzaXN0X3Byb2ZpbGVzIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm52IiwicHJvbXB0Iiwia2VlcCIsImFsZXJ0IiwiY29weSIsIkpTT04iLCJwYXJzZSIsInN0cmluZ2lmeSIsInNwbGljZSIsIndjIiwiY3VyIiwiZGF5cyIsImRheV9saXN0Iiwia2VlcF9pZHgiLCJlbCIsImRyYWdfc3RhdGUiLCJldiIsImNlbGwiLCJ0YXJnZXQiLCJjbG9zZXN0IiwiZGF5Iiwid2lsbF9vbiIsImNvbnRhaW5zIiwiZGF5MCIsIm1tMCIsInByZXZlbnREZWZhdWx0Iiwid2l0aF9yZWdpc3RyeSIsImNiIiwidHJpZXMiLCJtYXhfdHJpZXMiLCJsb29wIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJSZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiRmllbGRfQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJXUEJDX0JGQl9TZWxlY3RfQmFzZSIsInJlZ2lzdGVyIiwic2V0VGltZW91dCIsImNvbnNvbGUiLCJlcnJvciIsInJlZ2lzdGVyX3RpbWVfc2xvdHMiLCJ3cGJjX2JmYl9maWVsZF90aW1lX3Nsb3RzIiwidGVtcGxhdGVfaWQiLCJraW5kIiwiZ2V0X2RlZmF1bHRzIiwiYXNzaWduIiwidHlwZSIsImNzc2NsYXNzIiwiaGVscCIsInN0YXJ0X3RpbWUiLCJlbmRfdGltZSIsInN0ZXBfbWludXRlcyIsIm1pbl93aWR0aCIsIldQQkNfQkZCX0ZpZWxkX1RpbWVfU2xvdHMiLCJ0cnlfaW5pdF9vbl9wYW5lbCIsInBhbmVsIiwianNvbl9lbCIsInVwZGF0ZV9oaWRkZW5fanNvbiIsInByb2ZpbGVzX2FyciIsImV2dCIsImNyZWF0ZUV2ZW50IiwiaW5pdEV2ZW50IiwiZGlzcGF0Y2hFdmVudCIsImRldGFpbCIsInBhbmVscyIsIm1vIiwiTXV0YXRpb25PYnNlcnZlciIsIm11dHMiLCJvYnNlcnZlIiwiZG9jdW1lbnRFbGVtZW50IiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsImNzcyIsImNyZWF0ZVRleHROb2RlIiwiaGVhZCIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGltZS1ncmlkL19zcmMvdGltZS1ncmlkLXdwdHBsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIEZpbGU6IC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy90aW1lLXNsb3RzL19vdXQvZmllbGQtdGltZS1zbG90cy13cHRwbC5qc1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkMgQkZCIOKAlCBUaW1lIFNsb3RzIChyb2J1c3QpXHJcblx0ICogLSBEZWZlcnMgcmVuZGVyZXIgcmVnaXN0cmF0aW9uIHVudGlsIENvcmUvUmVnaXN0cnkgZXhpc3RzIChwcmV2ZW50cyBcIk5vIHJlbmRlcmVyIGZvdW5kXCIpLlxyXG5cdCAqIC0gSW5pdGlhbGl6ZXMgdGhlIEluc3BlY3RvciB2aWEgY3VzdG9tIGV2ZW50LCBET01Db250ZW50TG9hZGVkLCBhbmQgTXV0YXRpb25PYnNlcnZlciBmYWxsYmFja3MuXHJcblx0ICogLSBJbXBsZW1lbnRzIHRvb2xiYXIgYnV0dG9uczogcmVuYW1lLCBkdXBsaWNhdGUsIGNsZWFyLCBjb3B5IOKGkCBkYXksIGNvcHkg4oaQIHdlZWssIEZpbGwgcm934oCmLCBGaWxsIGNvbHVtbuKAplxyXG5cdCAqIC0gQWxsIGhlbHBlcnMgYW5kIGlkZW50aWZpZXJzIHVzZSBzbmFrZV9jYXNlIHdoZXJlIHBvc3NpYmxlLlxyXG5cdCAqL1xyXG5cclxuXHQvKiA9PT09PT09PT09PT09PT09PT09PT09IFRpbnkgdXRpbHMgPT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuXHRmdW5jdGlvbiBwYWQyKCBuICkgeyBuID0gcGFyc2VJbnQoIG4sIDEwICk7IHJldHVybiAoIG4gPCAxMCA/ICcwJyArIG4gOiAnJyArIG4gKTsgfVxyXG5cclxuXHRmdW5jdGlvbiB0aW1lX3RvX21pbiggdCApIHtcclxuXHRcdGlmICggISB0IHx8ICdzdHJpbmcnICE9PSB0eXBlb2YgdCApIHsgcmV0dXJuIG51bGw7IH1cclxuXHRcdHZhciBtID0gdC5tYXRjaCggL14oXFxkezEsMn0pOihcXGR7Mn0pJC8gKTtcclxuXHRcdGlmICggISBtICkgeyByZXR1cm4gbnVsbDsgfVxyXG5cdFx0dmFyIGhoID0gcGFyc2VJbnQoIG1bMV0sIDEwICksIG1tID0gcGFyc2VJbnQoIG1bMl0sIDEwICk7XHJcblx0XHRpZiAoIGhoIDwgMCB8fCBoaCA+IDIzIHx8IG1tIDwgMCB8fCBtbSA+IDU5ICkgeyByZXR1cm4gbnVsbDsgfVxyXG5cdFx0cmV0dXJuIGhoICogNjAgKyBtbTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1pbl90b190aW1lKCBtaW5zICkge1xyXG5cdFx0dmFyIG0gPSBwYXJzZUludCggbWlucywgMTAgKTtcclxuXHRcdGlmICggISBpc0Zpbml0ZSggbSApICkgeyBtID0gMDsgfVxyXG5cdFx0aWYgKCBtIDwgMCApIHsgbSA9IDA7IH1cclxuXHRcdG0gPSBtICUgKCAyNCAqIDYwICk7XHJcblx0XHR2YXIgaGggPSBNYXRoLmZsb29yKCBtIC8gNjAgKSwgbW0gPSBtICUgNjA7XHJcblx0XHRyZXR1cm4gcGFkMiggaGggKSArICc6JyArIHBhZDIoIG1tICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBub3JtYWxpemVfc3RlcCggc3RlcCApIHtcclxuXHRcdHZhciBzID0gcGFyc2VJbnQoIHN0ZXAsIDEwICk7XHJcblx0XHRpZiAoICEgaXNGaW5pdGUoIHMgKSB8fCBzIDwgNSApIHsgcyA9IDU7IH1cclxuXHRcdGlmICggcyA+IDE4MCApIHsgcyA9IDE4MDsgfVxyXG5cdFx0cmV0dXJuIHM7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBidWlsZF9yb3dfbWludXRlcyggZnJvbV9taW4sIHRvX21pbiwgc3RlcCApIHtcclxuXHRcdHZhciBhcnIgPSBbXTsgZm9yICggdmFyIG0gPSBmcm9tX21pbjsgbSA8IHRvX21pbjsgbSArPSBzdGVwICkgeyBhcnIucHVzaCggbSApOyB9IHJldHVybiBhcnI7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSBtaW51dGUgaW5kZXhlcyBpbnRvIGNvbnRpbnVvdXMgdGltZSByYW5nZXMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0FycmF5PG51bWJlcj59IHNlbGVjdGVkX21pbnV0ZXMgU29ydGVkIG1pbnV0ZSBpbmRleGVzIChzdGFydCBvZiBlYWNoIHNsb3QpXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IHN0ZXAgU3RlcCBpbiBtaW51dGVzXHJcblx0ICogQHJldHVybiB7QXJyYXk8e2Zyb206c3RyaW5nLHRvOnN0cmluZ30+fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIG1lcmdlX2RheV9yYW5nZXMoIHNlbGVjdGVkX21pbnV0ZXMsIHN0ZXAgKSB7XHJcblx0XHR2YXIgb3V0ID0gW107XHJcblx0XHRpZiAoICEgQXJyYXkuaXNBcnJheSggc2VsZWN0ZWRfbWludXRlcyApIHx8ICEgc2VsZWN0ZWRfbWludXRlcy5sZW5ndGggKSB7IHJldHVybiBvdXQ7IH1cclxuXHRcdHNlbGVjdGVkX21pbnV0ZXMuc29ydCggZnVuY3Rpb24oYSxiKXsgcmV0dXJuIGEgLSBiOyB9ICk7XHJcblx0XHR2YXIgcnVuX3N0YXJ0ID0gc2VsZWN0ZWRfbWludXRlc1swXSwgcHJldiA9IHJ1bl9zdGFydCwgaSwgbTtcclxuXHRcdGZvciAoIGkgPSAxOyBpIDwgc2VsZWN0ZWRfbWludXRlcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0bSA9IHNlbGVjdGVkX21pbnV0ZXNbaV07XHJcblx0XHRcdGlmICggbSA9PT0gcHJldiArIHN0ZXAgKSB7IHByZXYgPSBtOyBjb250aW51ZTsgfVxyXG5cdFx0XHRvdXQucHVzaCggeyBmcm9tOiBtaW5fdG9fdGltZSggcnVuX3N0YXJ0ICksIHRvOiBtaW5fdG9fdGltZSggcHJldiArIHN0ZXAgKSB9ICk7XHJcblx0XHRcdHJ1bl9zdGFydCA9IG07IHByZXYgPSBtO1xyXG5cdFx0fVxyXG5cdFx0b3V0LnB1c2goIHsgZnJvbTogbWluX3RvX3RpbWUoIHJ1bl9zdGFydCApLCB0bzogbWluX3RvX3RpbWUoIHByZXYgKyBzdGVwICkgfSApO1xyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEV4cGFuZCByYW5nZXMgdG8gYSBzZXQgb2YgXCJvblwiIG1pbnV0ZSBjZWxscyBmb3IgZWFzeSBwYWludGluZy5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBleHBhbmRfZGF5X3JhbmdlcyggcmFuZ2VzLCBzdGVwLCBmcm9tX21pbiwgdG9fbWluICkge1xyXG5cdFx0dmFyIHNldCA9IE9iamVjdC5jcmVhdGUoIG51bGwgKTtcclxuXHRcdCggcmFuZ2VzIHx8IFtdICkuZm9yRWFjaCggZnVuY3Rpb24oIHIgKSB7XHJcblx0XHRcdHZhciBhID0gdGltZV90b19taW4oIHIuZnJvbSApLCBiID0gdGltZV90b19taW4oIHIudG8gKTtcclxuXHRcdFx0aWYgKCBhID09IG51bGwgfHwgYiA9PSBudWxsICkgeyByZXR1cm47IH1cclxuXHRcdFx0Zm9yICggdmFyIG0gPSBhOyBtIDwgYjsgbSArPSBzdGVwICkge1xyXG5cdFx0XHRcdGlmICggbSA+PSBmcm9tX21pbiAmJiBtIDwgdG9fbWluICkgeyBzZXRbIG0gXSA9IHRydWU7IH1cclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdFx0cmV0dXJuIHNldDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEtlZXAgcHJvZmlsZXMgbGVuZ3RoIGluIHN5bmMgd2l0aCB3ZWVrX2N5Y2xlLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJlY29uY2lsZV9wcm9maWxlcyggcHJvZmlsZXMsIHdlZWtfY3ljbGUgKSB7XHJcblx0XHR2YXIgb3V0ID0gW10sIGxhYmVscyA9IFsnV2VlayBBJywnV2VlayBCJywnV2VlayBDJywnV2VlayBEJywnV2VlayBFJywnV2VlayBGJ10sIGk7XHJcblx0XHRmb3IgKCBpID0gMDsgaSA8IHdlZWtfY3ljbGU7IGkrKyApIHtcclxuXHRcdFx0aWYgKCBwcm9maWxlcyAmJiBwcm9maWxlc1tpXSApIHtcclxuXHRcdFx0XHRvdXQucHVzaCggcHJvZmlsZXNbaV0gKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRvdXQucHVzaCggeyBrZXk6IFN0cmluZy5mcm9tQ2hhckNvZGUoIDY1ICsgaSApLCBsYWJlbDogbGFiZWxzW2ldIHx8ICggJ1dlZWsgJyArICggaSArIDEgKSApLCBzbG90czogeyAnMSc6W10sICcyJzpbXSwgJzMnOltdLCAnNCc6W10sICc1JzpbXSwgJzYnOltdLCAnNyc6W10gfSB9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBvdXQ7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTbmFwIGEgbWludXRlIHZhbHVlIHRvIGEgc3RlcCBncmlkLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IG0gTWludXRlIHZhbHVlXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IHN0ZXAgU3RlcCBpbiBtaW51dGVzXHJcblx0ICogQHBhcmFtIHsnZG93bid8J3VwJ30gZGlyIERpcmVjdGlvblxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHNuYXBfdG9fc3RlcCggbSwgc3RlcCwgZGlyICkge1xyXG5cdFx0dmFyIHEgPSBNYXRoLmZsb29yKCBtIC8gc3RlcCApICogc3RlcDtcclxuXHRcdGlmICggJ3VwJyA9PT0gZGlyICYmIHEgPCBtICkgeyBxICs9IHN0ZXA7IH1cclxuXHRcdHJldHVybiBxO1xyXG5cdH1cclxuXHJcblx0LyogPT09PT09PT09PT09PT09PT09PT09PSBUZW1wbGF0ZXMgPT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuXHR2YXIgdG1wbF9mbiA9ICggdy53cCAmJiB3LndwLnRlbXBsYXRlICkgPyB3LndwLnRlbXBsYXRlIDogZnVuY3Rpb24oKXsgcmV0dXJuIGZ1bmN0aW9uKCl7IHJldHVybiAnJzsgfTsgfTtcclxuXHJcblx0ZnVuY3Rpb24gcmVuZGVyX2dyaWRfcm93cyggYm9keV9lbCwgc3RhcnRfbWluLCBlbmRfbWluLCBzdGVwICkge1xyXG5cdFx0Ym9keV9lbC5pbm5lckhUTUwgPSAnJztcclxuXHRcdHZhciByb3dfdCA9IHRtcGxfZm4oICd3cGJjLWJmYi10aW1lZ3JpZC1yb3cnICk7XHJcblx0XHRidWlsZF9yb3dfbWludXRlcyggc3RhcnRfbWluLCBlbmRfbWluLCBzdGVwICkuZm9yRWFjaCggZnVuY3Rpb24oIG1pbnV0ZSApIHtcclxuXHRcdFx0dmFyIGh0bWwgPSByb3dfdCggeyBtaW51dGU6IG1pbnV0ZSwgbGFiZWw6IG1pbl90b190aW1lKCBtaW51dGUgKSB9ICk7XHJcblx0XHRcdHZhciB3cmFwID0gZC5jcmVhdGVFbGVtZW50KCAnZGl2JyApOyB3cmFwLmlubmVySFRNTCA9IGh0bWw7XHJcblx0XHRcdHZhciByb3cgPSB3cmFwLmZpcnN0RWxlbWVudENoaWxkOyBpZiAoIHJvdyApIHsgYm9keV9lbC5hcHBlbmRDaGlsZCggcm93ICk7IH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHBhaW50X3NlbGVjdGlvbiggcm9vdCwgcHJvZmlsZSwgc3RhcnRfbWluLCBlbmRfbWluLCBzdGVwICkge1xyXG5cdFx0dmFyIGJvZHkgPSByb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3RpbWVncmlkX2JvZHknICk7XHJcblx0XHRpZiAoICEgYm9keSB8fCAhIHByb2ZpbGUgfHwgISBwcm9maWxlLnNsb3RzICkgeyByZXR1cm47IH1cclxuXHRcdGZvciAoIHZhciBkX2kgPSAxOyBkX2kgPD0gNzsgZF9pKysgKSB7XHJcblx0XHRcdHZhciByYW5nZXMgPSBwcm9maWxlLnNsb3RzWyBTdHJpbmcoIGRfaSApIF0gfHwgW107XHJcblx0XHRcdHZhciBzZXQgICAgPSBleHBhbmRfZGF5X3JhbmdlcyggcmFuZ2VzLCBzdGVwLCBzdGFydF9taW4sIGVuZF9taW4gKTtcclxuXHRcdFx0dmFyIGNlbGxzICA9IGJvZHkucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fdGltZWdyaWRfY2VsbC0tc2xvdFtkYXRhLWRheT1cIicgKyBkX2kgKyAnXCJdJyApO1xyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBjZWxscy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHR2YXIgYyAgPSBjZWxsc1sgaSBdO1xyXG5cdFx0XHRcdHZhciBtbSA9IHBhcnNlSW50KCBjLmdldEF0dHJpYnV0ZSggJ2RhdGEtbWludXRlJyApLCAxMCApO1xyXG5cdFx0XHRcdGlmICggc2V0WyBtbSBdICkgeyBjLmNsYXNzTGlzdC5hZGQoICdpcy1vbicgKTsgfSBlbHNlIHsgYy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtb24nICk7IH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVhZF9zZWxlY3Rpb25faW50b19wcm9maWxlKCByb290LCBwcm9maWxlLCBzdGFydF9taW4sIGVuZF9taW4sIHN0ZXAgKSB7XHJcblx0XHR2YXIgYm9keSA9IHJvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fdGltZWdyaWRfYm9keScgKTtcclxuXHRcdGlmICggISBib2R5IHx8ICEgcHJvZmlsZSApIHsgcmV0dXJuOyB9XHJcblx0XHRmb3IgKCB2YXIgZF9pID0gMTsgZF9pIDw9IDc7IGRfaSsrICkge1xyXG5cdFx0XHR2YXIgY2VsbHMgPSBib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3RpbWVncmlkX2NlbGwtLXNsb3RbZGF0YS1kYXk9XCInICsgZF9pICsgJ1wiXS5pcy1vbicgKTtcclxuXHRcdFx0dmFyIG1pbnV0ZXMgPSBbXSwgaTtcclxuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBjZWxscy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRtaW51dGVzLnB1c2goIHBhcnNlSW50KCBjZWxsc1tpXS5nZXRBdHRyaWJ1dGUoICdkYXRhLW1pbnV0ZScgKSwgMTAgKSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHByb2ZpbGUuc2xvdHNbIFN0cmluZyggZF9pICkgXSA9IG1lcmdlX2RheV9yYW5nZXMoIG1pbnV0ZXMsIHN0ZXAgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHRvZ2dsZV9yZWN0KCByb290LCBkYXlfZnJvbSwgZGF5X3RvLCBtaW5fZnJvbSwgbWluX3RvLCBtb2RlICkge1xyXG5cdFx0dmFyIGJvZHkgPSByb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3RpbWVncmlkX2JvZHknICk7XHJcblx0XHRpZiAoICEgYm9keSApIHsgcmV0dXJuOyB9XHJcblx0XHR2YXIgZGYgPSBNYXRoLm1pbiggZGF5X2Zyb20sIGRheV90byApLCBkdCA9IE1hdGgubWF4KCBkYXlfZnJvbSwgZGF5X3RvICk7XHJcblx0XHR2YXIgbWYgPSBNYXRoLm1pbiggbWluX2Zyb20sIG1pbl90byApLCAgbXQgPSBNYXRoLm1heCggbWluX2Zyb20sIG1pbl90byApO1xyXG5cdFx0Zm9yICggdmFyIGRfaSA9IGRmOyBkX2kgPD0gZHQ7IGRfaSsrICkge1xyXG5cdFx0XHR2YXIgY2VsbHMgPSBib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3RpbWVncmlkX2NlbGwtLXNsb3RbZGF0YS1kYXk9XCInICsgZF9pICsgJ1wiXScgKTtcclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgY2VsbHMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0dmFyIGMgID0gY2VsbHNbaV0sIG1tID0gcGFyc2VJbnQoIGMuZ2V0QXR0cmlidXRlKCAnZGF0YS1taW51dGUnICksIDEwICk7XHJcblx0XHRcdFx0aWYgKCBtbSA+PSBtZiAmJiBtbSA8PSBtdCApIHtcclxuXHRcdFx0XHRcdGlmICggJ29uJyA9PT0gbW9kZSApIHsgYy5jbGFzc0xpc3QuYWRkKCAnaXMtb24nICk7IH1cclxuXHRcdFx0XHRcdGVsc2UgaWYgKCAnb2ZmJyA9PT0gbW9kZSApIHsgYy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtb24nICk7IH1cclxuXHRcdFx0XHRcdGVsc2UgeyBjLmNsYXNzTGlzdC50b2dnbGUoICdpcy1vbicgKTsgfVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyogPT09PT09PT09PT09PT09PT09PT09PSBJbnNwZWN0b3IgY29udHJvbGxlciA9PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIFBhcnNlIGRheSB0b2tlbnMgbGlrZSBcIk1vbixXZWQsRnJpXCIsIFwiMS01XCIsIFwiTW9uLUZyaVwiLlxyXG5cdCAqXHJcblx0ICogQHJldHVybiB7QXJyYXk8bnVtYmVyPn0gZGF5cyAxLi43XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcGFyc2VfZGF5c19pbnB1dCggdHh0ICkge1xyXG5cdFx0dmFyIG1hcCA9IHsgbW9uOjEsIHR1ZToyLCB3ZWQ6MywgdGh1OjQsIGZyaTo1LCBzYXQ6Niwgc3VuOjcgfTtcclxuXHRcdGlmICggISB0eHQgfHwgJ3N0cmluZycgIT09IHR5cGVvZiB0eHQgKSB7IHJldHVybiBbMSwyLDMsNCw1LDYsN107IH1cclxuXHRcdHZhciB0ID0gdHh0LnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvXFxzKy9nLCcnKS50cmltKCk7XHJcblx0XHRpZiAoICEgdCApIHsgcmV0dXJuIFsxLDIsMyw0LDUsNiw3XTsgfVxyXG5cclxuXHRcdGZ1bmN0aW9uIHB1c2hfcmFuZ2UoIGEsIGIsIG91dCApIHtcclxuXHRcdFx0dmFyIGksIHMgPSBNYXRoLm1pbiggYSwgYiApLCBlID0gTWF0aC5tYXgoIGEsIGIgKTtcclxuXHRcdFx0Zm9yICggaSA9IHM7IGkgPD0gZTsgaSsrICkgeyBvdXQucHVzaCggaSApOyB9XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG91dCA9IFtdO1xyXG5cdFx0Ly8gc3BsaXQgYnkgY29tbWEgZmlyc3QsIHRoZW4gc3VwcG9ydCByYW5nZXMgd2l0aCAnLSdcclxuXHRcdHZhciBwYXJ0cyA9IHQuc3BsaXQoJywnKTtcclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHR2YXIgcCA9IHBhcnRzW2ldO1xyXG5cdFx0XHRpZiAoICEgcCApIHsgY29udGludWU7IH1cclxuXHRcdFx0dmFyIHJuZyA9IHAuc3BsaXQoJy0nKTtcclxuXHRcdFx0aWYgKCBybmcubGVuZ3RoID09PSAyICkge1xyXG5cdFx0XHRcdHZhciBhID0gbWFwWyBybmdbMF0gXSB8fCBwYXJzZUludCggcm5nWzBdLCAxMCApO1xyXG5cdFx0XHRcdHZhciBiID0gbWFwWyBybmdbMV0gXSB8fCBwYXJzZUludCggcm5nWzFdLCAxMCApO1xyXG5cdFx0XHRcdGlmICggaXNGaW5pdGUoIGEgKSAmJiBpc0Zpbml0ZSggYiApICkgeyBwdXNoX3JhbmdlKCBhLCBiLCBvdXQgKTsgfVxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZhciB2ID0gbWFwWyBwIF0gfHwgcGFyc2VJbnQoIHAsIDEwICk7XHJcblx0XHRcdFx0aWYgKCBpc0Zpbml0ZSggdiApICkgeyBvdXQucHVzaCggdiApOyB9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdC8vIHNhbml0aXplIHRvIDEuLjcgdW5pcXVlXHJcblx0XHR2YXIgc2VlbiA9IHt9OyBvdXQgPSBvdXQuZmlsdGVyKCBmdW5jdGlvbihuKXsgaWYgKCBuIDwgMSB8fCBuID4gNyB8fCBzZWVuW25dICl7IHJldHVybiBmYWxzZTsgfSBzZWVuW25dID0gdHJ1ZTsgcmV0dXJuIHRydWU7IH0gKTtcclxuXHRcdHJldHVybiBvdXQubGVuZ3RoID8gb3V0IDogWzEsMiwzLDQsNSw2LDddO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSW5pdGlhbGl6ZSBncmlkIChyb3dzLCBwYWludGluZywgZXZlbnRzKSBhbmQgd2lyZSB0b29sYmFyIGFjdGlvbnMuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gaW5pdF9ncmlkX2NvbnRyb2xsZXIoIGluc3BlY3Rvcl9yb290LCBkYXRhX29iaiwgdXBkYXRlX2hpZGRlbl9qc29uX2NiICkge1xyXG5cdFx0aWYgKCBpbnNwZWN0b3Jfcm9vdC5fX3dwYmNfdGltZWdyaWRfaW5pdGVkICkgeyByZXR1cm47IH1cclxuXHRcdGluc3BlY3Rvcl9yb290Ll9fd3BiY190aW1lZ3JpZF9pbml0ZWQgPSB0cnVlO1xyXG5cclxuXHRcdHZhciBncmlkX3Jvb3QgICAgID0gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fdGltZWdyaWRfcm9vdCcgKTtcclxuXHRcdHZhciBib2R5X2VsICAgICAgID0gZ3JpZF9yb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3RpbWVncmlkX2JvZHknICk7XHJcblx0XHR2YXIgc3RhcnRfdGltZV9pbiA9IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1pbnNwZWN0b3Ita2V5PVwic3RhcnRfdGltZVwiXScgKTtcclxuXHRcdHZhciBlbmRfdGltZV9pbiAgID0gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJlbmRfdGltZVwiXScgKTtcclxuXHRcdHZhciBzdGVwX2luICAgICAgID0gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJzdGVwX21pbnV0ZXNcIl0nICk7XHJcblx0XHR2YXIgd2Vla19jeWNsZV9pbiA9IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICcuanMtd2Vlay1jeWNsZScgKTtcclxuXHRcdHZhciBwcm9maWxlX3NlbCAgID0gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJy5qcy1wcm9maWxlLXNlbGVjdCcgKTtcclxuXHJcblx0XHR2YXIgYnRuX3JlbmFtZSAgICA9IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICcuanMtcHJvZmlsZS1yZW5hbWUnICk7XHJcblx0XHR2YXIgYnRuX2R1cGxpY2F0ZSA9IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICcuanMtcHJvZmlsZS1kdXBsaWNhdGUnICk7XHJcblx0XHR2YXIgYnRuX2NsZWFyICAgICA9IGluc3BlY3Rvcl9yb290LnF1ZXJ5U2VsZWN0b3IoICcuanMtcHJvZmlsZS1jbGVhcicgKTtcclxuXHRcdHZhciBidG5fcm93X2ZpbGwgID0gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJy5qcy1yb3ctZmlsbCcgKTtcclxuXHRcdHZhciBidG5fY29sX2ZpbGwgID0gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJy5qcy1jb2wtZmlsbCcgKTtcclxuXHRcdHZhciBidG5fY29weV9kYXkgID0gaW5zcGVjdG9yX3Jvb3QucXVlcnlTZWxlY3RvciggJy5qcy1jb3B5LXByZXYtZGF5JyApO1xyXG5cdFx0dmFyIGJ0bl9jb3B5X3dlZWsgPSBpbnNwZWN0b3Jfcm9vdC5xdWVyeVNlbGVjdG9yKCAnLmpzLWNvcHktcHJldi13ZWVrJyApO1xyXG5cclxuXHRcdGZ1bmN0aW9uIGdldF9zdGF0ZSgpIHtcclxuXHRcdFx0dmFyIHN0YXJ0X21pbiA9IHRpbWVfdG9fbWluKCAoIHN0YXJ0X3RpbWVfaW4gJiYgc3RhcnRfdGltZV9pbi52YWx1ZSApIHx8ICcwODowMCcgKTtcclxuXHRcdFx0dmFyIGVuZF9taW4gICA9IHRpbWVfdG9fbWluKCAoIGVuZF90aW1lX2luICAgJiYgZW5kX3RpbWVfaW4udmFsdWUgICApIHx8ICcyMDowMCcgKTtcclxuXHRcdFx0dmFyIHN0ZXAgICAgICA9IG5vcm1hbGl6ZV9zdGVwKCAoIHN0ZXBfaW4gICAgICYmIHN0ZXBfaW4udmFsdWUgKSB8fCAzMCApO1xyXG5cdFx0XHRpZiAoIHN0YXJ0X21pbiA9PSBudWxsICkgeyBzdGFydF9taW4gPSA4ICogNjA7IH1cclxuXHRcdFx0aWYgKCBlbmRfbWluICAgPT0gbnVsbCApIHsgZW5kX21pbiAgID0gMjAgKiA2MDsgfVxyXG5cdFx0XHRpZiAoIGVuZF9taW4gPD0gc3RhcnRfbWluICkgeyBlbmRfbWluID0gc3RhcnRfbWluICsgc3RlcDsgfVxyXG5cdFx0XHRyZXR1cm4geyBzdGFydF9taW46IHN0YXJ0X21pbiwgZW5kX21pbjogZW5kX21pbiwgc3RlcDogc3RlcCB9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIHJlZnJlc2hfcHJvZmlsZV9zZWxlY3RvcigpIHtcclxuXHRcdFx0cHJvZmlsZV9zZWwuaW5uZXJIVE1MID0gJyc7XHJcblx0XHRcdCggZGF0YV9vYmoucHJvZmlsZXMgfHwgW10gKS5mb3JFYWNoKCBmdW5jdGlvbiggcCwgaSApIHtcclxuXHRcdFx0XHR2YXIgb3B0ID0gZC5jcmVhdGVFbGVtZW50KCAnb3B0aW9uJyApO1xyXG5cdFx0XHRcdG9wdC52YWx1ZSA9ICcnICsgaTtcclxuXHRcdFx0XHRvcHQudGV4dENvbnRlbnQgPSAoIHAgJiYgcC5sYWJlbCApID8gcC5sYWJlbCA6ICggJ1dlZWsgJyArICggaSArIDEgKSApO1xyXG5cdFx0XHRcdHByb2ZpbGVfc2VsLmFwcGVuZENoaWxkKCBvcHQgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRpZiAoIGRhdGFfb2JqLnByb2ZpbGVzLmxlbmd0aCApIHsgcHJvZmlsZV9zZWwudmFsdWUgPSAnMCc7IH1cclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBjdXJyZW50X3Byb2ZpbGVfaW5kZXgoKSB7XHJcblx0XHRcdHZhciBpZHggPSBwYXJzZUludCggcHJvZmlsZV9zZWwudmFsdWUgfHwgJzAnLCAxMCApO1xyXG5cdFx0XHRpZiAoICEgaXNGaW5pdGUoIGlkeCApIHx8IGlkeCA8IDAgKSB7IGlkeCA9IDA7IH1cclxuXHRcdFx0aWYgKCBpZHggPj0gZGF0YV9vYmoucHJvZmlsZXMubGVuZ3RoICkgeyBpZHggPSBkYXRhX29iai5wcm9maWxlcy5sZW5ndGggLSAxOyB9XHJcblx0XHRcdHJldHVybiBpZHg7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gY3VycmVudF9wcm9maWxlKCkge1xyXG5cdFx0XHRyZXR1cm4gZGF0YV9vYmoucHJvZmlsZXNbIGN1cnJlbnRfcHJvZmlsZV9pbmRleCgpIF07XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gcmVidWlsZF9yb3dzX2FuZF9wYWludCgpIHtcclxuXHRcdFx0dmFyIHN0ID0gZ2V0X3N0YXRlKCk7XHJcblx0XHRcdHJlbmRlcl9ncmlkX3Jvd3MoIGJvZHlfZWwsIHN0LnN0YXJ0X21pbiwgc3QuZW5kX21pbiwgc3Quc3RlcCApO1xyXG5cdFx0XHRwYWludF9zZWxlY3Rpb24oIGdyaWRfcm9vdCwgY3VycmVudF9wcm9maWxlKCksIHN0LnN0YXJ0X21pbiwgc3QuZW5kX21pbiwgc3Quc3RlcCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIHBlcnNpc3RfcHJvZmlsZXMoKSB7XHJcblx0XHRcdHZhciBzdCA9IGdldF9zdGF0ZSgpO1xyXG5cdFx0XHRyZWFkX3NlbGVjdGlvbl9pbnRvX3Byb2ZpbGUoIGdyaWRfcm9vdCwgY3VycmVudF9wcm9maWxlKCksIHN0LnN0YXJ0X21pbiwgc3QuZW5kX21pbiwgc3Quc3RlcCApO1xyXG5cdFx0XHR1cGRhdGVfaGlkZGVuX2pzb25fY2IoIGRhdGFfb2JqLnByb2ZpbGVzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyogLS0tLS0tLS0tLSBUb29sYmFyIGFjdGlvbnMgKGJ1dHRvbnMpIC0tLS0tLS0tLS0gKi9cclxuXHJcblx0XHQvLyBSZW5hbWUgcHJvZmlsZVxyXG5cdFx0aWYgKCBidG5fcmVuYW1lICkge1xyXG5cdFx0XHRidG5fcmVuYW1lLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdHZhciBwID0gY3VycmVudF9wcm9maWxlKCk7IGlmICggISBwICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHR2YXIgbnYgPSB3LnByb21wdCggJ1Byb2ZpbGUgbmFtZTonLCBwLmxhYmVsIHx8ICcnICk7XHJcblx0XHRcdFx0aWYgKCBudiAhPSBudWxsICkge1xyXG5cdFx0XHRcdFx0cC5sYWJlbCA9ICggJycgKyBudiApLnRyaW0oKSB8fCBwLmxhYmVsO1xyXG5cdFx0XHRcdFx0dmFyIGtlZXAgPSBjdXJyZW50X3Byb2ZpbGVfaW5kZXgoKTtcclxuXHRcdFx0XHRcdHJlZnJlc2hfcHJvZmlsZV9zZWxlY3RvcigpO1xyXG5cdFx0XHRcdFx0cHJvZmlsZV9zZWwudmFsdWUgPSAnJyArIGtlZXA7XHJcblx0XHRcdFx0XHRwZXJzaXN0X3Byb2ZpbGVzKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRHVwbGljYXRlIHByb2ZpbGUgKG1heCA2LCBwZXIgVUkpXHJcblx0XHRpZiAoIGJ0bl9kdXBsaWNhdGUgKSB7XHJcblx0XHRcdGJ0bl9kdXBsaWNhdGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0aWYgKCBkYXRhX29iai5wcm9maWxlcy5sZW5ndGggPj0gNiApIHtcclxuXHRcdFx0XHRcdHcuYWxlcnQoICdNYXhpbXVtIHByb2ZpbGVzIHJlYWNoZWQgKDYpLicgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dmFyIGlkeCA9IGN1cnJlbnRfcHJvZmlsZV9pbmRleCgpO1xyXG5cdFx0XHRcdHZhciBwICAgPSBjdXJyZW50X3Byb2ZpbGUoKTtcclxuXHRcdFx0XHR2YXIgY29weSA9IEpTT04ucGFyc2UoIEpTT04uc3RyaW5naWZ5KCBwICkgKTtcclxuXHRcdFx0XHRjb3B5LmxhYmVsID0gKCBwLmxhYmVsIHx8ICdXZWVrJyApICsgJyAoY29weSknO1xyXG5cdFx0XHRcdGRhdGFfb2JqLnByb2ZpbGVzLnNwbGljZSggaWR4ICsgMSwgMCwgY29weSApO1xyXG5cclxuXHRcdFx0XHQvLyBBZGp1c3QgY3ljbGUgdG8gZml0XHJcblx0XHRcdFx0dmFyIHdjID0gcGFyc2VJbnQoICggd2Vla19jeWNsZV9pbiAmJiB3ZWVrX2N5Y2xlX2luLnZhbHVlICkgfHwgJzEnLCAxMCApO1xyXG5cdFx0XHRcdGlmICggISBpc0Zpbml0ZSggd2MgKSB8fCB3YyA8IDEgKSB7IHdjID0gMTsgfVxyXG5cdFx0XHRcdHdjID0gTWF0aC5taW4oIDYsIE1hdGgubWF4KCB3YywgZGF0YV9vYmoucHJvZmlsZXMubGVuZ3RoICkgKTtcclxuXHRcdFx0XHRpZiAoIHdlZWtfY3ljbGVfaW4gKSB7IHdlZWtfY3ljbGVfaW4udmFsdWUgPSAnJyArIHdjOyB9XHJcblx0XHRcdFx0ZGF0YV9vYmoud2Vla19jeWNsZSA9IHdjO1xyXG5cclxuXHRcdFx0XHRyZWZyZXNoX3Byb2ZpbGVfc2VsZWN0b3IoKTtcclxuXHRcdFx0XHRwcm9maWxlX3NlbC52YWx1ZSA9ICcnICsgKCBpZHggKyAxICk7XHJcblx0XHRcdFx0cmVidWlsZF9yb3dzX2FuZF9wYWludCgpO1xyXG5cdFx0XHRcdHBlcnNpc3RfcHJvZmlsZXMoKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIENsZWFyIGFsbCBzbG90cyBpbiBjdXJyZW50IHByb2ZpbGVcclxuXHRcdGlmICggYnRuX2NsZWFyICkge1xyXG5cdFx0XHRidG5fY2xlYXIuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0dmFyIHAgPSBjdXJyZW50X3Byb2ZpbGUoKTsgaWYgKCAhIHAgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdHAuc2xvdHMgPSB7ICcxJzpbXSwgJzInOltdLCAnMyc6W10sICc0JzpbXSwgJzUnOltdLCAnNic6W10sICc3JzpbXSB9O1xyXG5cdFx0XHRcdHJlYnVpbGRfcm93c19hbmRfcGFpbnQoKTtcclxuXHRcdFx0XHRwZXJzaXN0X3Byb2ZpbGVzKCk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBDb3B5IOKGkCBkYXkgOiBjb3B5IGRheS0xIGludG8gZGF5LCBmb3IgMi4uN1xyXG5cdFx0aWYgKCBidG5fY29weV9kYXkgKSB7XHJcblx0XHRcdGJ0bl9jb3B5X2RheS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR2YXIgcCA9IGN1cnJlbnRfcHJvZmlsZSgpOyBpZiAoICEgcCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0dmFyIHN0ID0gZ2V0X3N0YXRlKCk7XHJcblx0XHRcdFx0cmVhZF9zZWxlY3Rpb25faW50b19wcm9maWxlKCBncmlkX3Jvb3QsIHAsIHN0LnN0YXJ0X21pbiwgc3QuZW5kX21pbiwgc3Quc3RlcCApO1xyXG5cdFx0XHRcdGZvciAoIHZhciBkX2kgPSAyOyBkX2kgPD0gNzsgZF9pKysgKSB7XHJcblx0XHRcdFx0XHRwLnNsb3RzWyBTdHJpbmcoIGRfaSApIF0gPSBKU09OLnBhcnNlKCBKU09OLnN0cmluZ2lmeSggcC5zbG90c1sgU3RyaW5nKCBkX2kgLSAxICkgXSB8fCBbXSApICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJlYnVpbGRfcm93c19hbmRfcGFpbnQoKTtcclxuXHRcdFx0XHRwZXJzaXN0X3Byb2ZpbGVzKCk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBDb3B5IOKGkCB3ZWVrIDogY29weSBwcmV2aW91cyBwcm9maWxlIHNsb3RzIGludG8gY3VycmVudFxyXG5cdFx0aWYgKCBidG5fY29weV93ZWVrICkge1xyXG5cdFx0XHRidG5fY29weV93ZWVrLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdHZhciBpZHggPSBjdXJyZW50X3Byb2ZpbGVfaW5kZXgoKTtcclxuXHRcdFx0XHRpZiAoIGlkeCA8PSAwICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHR2YXIgcHJldiA9IGRhdGFfb2JqLnByb2ZpbGVzWyBpZHggLSAxIF07XHJcblx0XHRcdFx0dmFyIGN1ciAgPSBkYXRhX29iai5wcm9maWxlc1sgaWR4IF07XHJcblx0XHRcdFx0Y3VyLnNsb3RzID0gSlNPTi5wYXJzZSggSlNPTi5zdHJpbmdpZnkoIHByZXYgJiYgcHJldi5zbG90cyA/IHByZXYuc2xvdHMgOiB7ICcxJzpbXSwgJzInOltdLCAnMyc6W10sICc0JzpbXSwgJzUnOltdLCAnNic6W10sICc3JzpbXSB9ICkgKTtcclxuXHRcdFx0XHRyZWJ1aWxkX3Jvd3NfYW5kX3BhaW50KCk7XHJcblx0XHRcdFx0cGVyc2lzdF9wcm9maWxlcygpO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRmlsbCByb3figKYgOiBwcm9tcHQgZm9yIHRpbWUgcmFuZ2U7IGFwcGx5IGFjcm9zcyBBTEwgZGF5c1xyXG5cdFx0aWYgKCBidG5fcm93X2ZpbGwgKSB7XHJcblx0XHRcdGJ0bl9yb3dfZmlsbC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR2YXIgc3QgPSBnZXRfc3RhdGUoKTtcclxuXHRcdFx0XHR2YXIgcm5nID0gdy5wcm9tcHQoICdFbnRlciB0aW1lIHJhbmdlIHRvIGZpbGwgYWNyb3NzIEFMTCBkYXlzIChlLmcuIDA5OjAwLTEyOjAwKTonLCAnJyApO1xyXG5cdFx0XHRcdGlmICggISBybmcgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdHZhciBtbSA9IHJuZy5yZXBsYWNlKC9cXHMrL2csJycpLnNwbGl0KCctJyk7XHJcblx0XHRcdFx0aWYgKCBtbS5sZW5ndGggIT09IDIgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdHZhciBhID0gdGltZV90b19taW4oIG1tWzBdICksIGIgPSB0aW1lX3RvX21pbiggbW1bMV0gKTtcclxuXHRcdFx0XHRpZiAoIGEgPT0gbnVsbCB8fCBiID09IG51bGwgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdGEgPSBzbmFwX3RvX3N0ZXAoIGEsIHN0LnN0ZXAsICdkb3duJyApO1xyXG5cdFx0XHRcdGIgPSBzbmFwX3RvX3N0ZXAoIGIsIHN0LnN0ZXAsICd1cCcgKTtcclxuXHRcdFx0XHRpZiAoIGIgPD0gYSApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0Ly8gcGFpbnQgRE9NIHJlY3RhbmdsZSB0aGVuIHBlcnNpc3QgKGF1dG9tYXRpYyBtZXJnZSlcclxuXHRcdFx0XHR0b2dnbGVfcmVjdCggZ3JpZF9yb290LCAxLCA3LCBhLCBiIC0gc3Quc3RlcCwgJ29uJyApO1xyXG5cdFx0XHRcdHBlcnNpc3RfcHJvZmlsZXMoKTtcclxuXHRcdFx0XHRwYWludF9zZWxlY3Rpb24oIGdyaWRfcm9vdCwgY3VycmVudF9wcm9maWxlKCksIHN0LnN0YXJ0X21pbiwgc3QuZW5kX21pbiwgc3Quc3RlcCApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRmlsbCBjb2x1bW7igKYgOiBwcm9tcHQgZm9yIHRpbWUgcmFuZ2UgYW5kIGRheXMgKGUuZy4gXCJNb24tRnJpXCIgb3IgXCIxLDMsNVwiKVxyXG5cdFx0aWYgKCBidG5fY29sX2ZpbGwgKSB7XHJcblx0XHRcdGJ0bl9jb2xfZmlsbC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR2YXIgc3QgPSBnZXRfc3RhdGUoKTtcclxuXHRcdFx0XHR2YXIgcm5nID0gdy5wcm9tcHQoICdFbnRlciB0aW1lIHJhbmdlIChlLmcuIDEwOjAwLTE0OjAwKTonLCAnJyApO1xyXG5cdFx0XHRcdGlmICggISBybmcgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdHZhciBkYXlzID0gdy5wcm9tcHQoICdFbnRlciBkYXlzIChNb24tRnJpLCAxLTcsIE1vbixXZWQsRnJpKS4gTGVhdmUgZW1wdHkgZm9yIE1vbi1Gcmk6JywgJ01vbi1GcmknICk7XHJcblx0XHRcdFx0dmFyIGRheV9saXN0ID0gcGFyc2VfZGF5c19pbnB1dCggZGF5cyB8fCAnTW9uLUZyaScgKTtcclxuXHJcblx0XHRcdFx0dmFyIG1tID0gcm5nLnJlcGxhY2UoL1xccysvZywnJykuc3BsaXQoJy0nKTtcclxuXHRcdFx0XHRpZiAoIG1tLmxlbmd0aCAhPT0gMiApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0dmFyIGEgPSB0aW1lX3RvX21pbiggbW1bMF0gKSwgYiA9IHRpbWVfdG9fbWluKCBtbVsxXSApO1xyXG5cdFx0XHRcdGlmICggYSA9PSBudWxsIHx8IGIgPT0gbnVsbCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0YSA9IHNuYXBfdG9fc3RlcCggYSwgc3Quc3RlcCwgJ2Rvd24nICk7XHJcblx0XHRcdFx0YiA9IHNuYXBfdG9fc3RlcCggYiwgc3Quc3RlcCwgJ3VwJyApO1xyXG5cdFx0XHRcdGlmICggYiA8PSBhICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0Ly8gYXBwbHkgdG8gc2VsZWN0ZWQgZGF5cyBvbmx5XHJcblx0XHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgZGF5X2xpc3QubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0XHR2YXIgZF9pID0gZGF5X2xpc3RbaV07XHJcblx0XHRcdFx0XHR0b2dnbGVfcmVjdCggZ3JpZF9yb290LCBkX2ksIGRfaSwgYSwgYiAtIHN0LnN0ZXAsICdvbicgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cGVyc2lzdF9wcm9maWxlcygpO1xyXG5cdFx0XHRcdHBhaW50X3NlbGVjdGlvbiggZ3JpZF9yb290LCBjdXJyZW50X3Byb2ZpbGUoKSwgc3Quc3RhcnRfbWluLCBzdC5lbmRfbWluLCBzdC5zdGVwICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiAtLS0tLS0tLS0tIENvcmUgVUkgYmluZGluZ3MgLS0tLS0tLS0tLSAqL1xyXG5cclxuXHRcdC8vIFdlZWsgY3ljbGVcclxuXHRcdGlmICggd2Vla19jeWNsZV9pbiApIHtcclxuXHRcdFx0d2Vla19jeWNsZV9pbi5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0dmFyIHdjID0gcGFyc2VJbnQoIHdlZWtfY3ljbGVfaW4udmFsdWUgfHwgJzEnLCAxMCApO1xyXG5cdFx0XHRcdGlmICggISBpc0Zpbml0ZSggd2MgKSB8fCB3YyA8IDEgKSB7IHdjID0gMTsgfVxyXG5cdFx0XHRcdGlmICggd2MgPiA2ICkgeyB3YyA9IDY7IH1cclxuXHRcdFx0XHRkYXRhX29iai53ZWVrX2N5Y2xlID0gd2M7XHJcblx0XHRcdFx0ZGF0YV9vYmoucHJvZmlsZXMgICA9IHJlY29uY2lsZV9wcm9maWxlcyggZGF0YV9vYmoucHJvZmlsZXMgfHwgW10sIHdjICk7XHJcblx0XHRcdFx0dmFyIGtlZXBfaWR4ID0gMDtcclxuXHRcdFx0XHRyZWZyZXNoX3Byb2ZpbGVfc2VsZWN0b3IoKTtcclxuXHRcdFx0XHRwcm9maWxlX3NlbC52YWx1ZSA9ICcnICsga2VlcF9pZHg7XHJcblx0XHRcdFx0cmVidWlsZF9yb3dzX2FuZF9wYWludCgpO1xyXG5cdFx0XHRcdHBlcnNpc3RfcHJvZmlsZXMoKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFByb2ZpbGUgc3dpdGNoXHJcblx0XHRpZiAoIHByb2ZpbGVfc2VsICkge1xyXG5cdFx0XHRwcm9maWxlX3NlbC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24oKSB7XHJcblx0XHRcdFx0cmVidWlsZF9yb3dzX2FuZF9wYWludCgpO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVGltZSByYW5nZSAvIHN0ZXBcclxuXHRcdFsgc3RhcnRfdGltZV9pbiwgZW5kX3RpbWVfaW4sIHN0ZXBfaW4gXS5mb3JFYWNoKCBmdW5jdGlvbiggZWwgKSB7XHJcblx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0ZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0cmVidWlsZF9yb3dzX2FuZF9wYWludCgpO1xyXG5cdFx0XHRcdFx0cGVyc2lzdF9wcm9maWxlcygpO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdC8vIERyYWcgc2VsZWN0aW9uXHJcblx0XHR2YXIgZHJhZ19zdGF0ZSA9IG51bGw7XHJcblx0XHRib2R5X2VsLmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBmdW5jdGlvbiggZXYgKSB7XHJcblx0XHRcdHZhciBjZWxsID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX190aW1lZ3JpZF9jZWxsLS1zbG90JyApO1xyXG5cdFx0XHRpZiAoICEgY2VsbCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdHZhciBkYXkgPSBwYXJzZUludCggY2VsbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWRheScgKSwgMTAgKTtcclxuXHRcdFx0dmFyIG1tICA9IHBhcnNlSW50KCBjZWxsLmdldEF0dHJpYnV0ZSggJ2RhdGEtbWludXRlJyApLCAxMCApO1xyXG5cdFx0XHR2YXIgd2lsbF9vbiA9ICEgY2VsbC5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1vbicgKTtcclxuXHRcdFx0ZHJhZ19zdGF0ZSA9IHsgZGF5MDogZGF5LCBtbTA6IG1tLCBtb2RlOiB3aWxsX29uID8gJ29uJyA6ICdvZmYnIH07XHJcblx0XHRcdHRvZ2dsZV9yZWN0KCBncmlkX3Jvb3QsIGRheSwgZGF5LCBtbSwgbW0sIGRyYWdfc3RhdGUubW9kZSApO1xyXG5cdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0fSApO1xyXG5cdFx0Ym9keV9lbC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2VvdmVyJywgZnVuY3Rpb24oIGV2ICkge1xyXG5cdFx0XHRpZiAoICEgZHJhZ19zdGF0ZSApIHsgcmV0dXJuOyB9XHJcblx0XHRcdHZhciBjZWxsID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX190aW1lZ3JpZF9jZWxsLS1zbG90JyApO1xyXG5cdFx0XHRpZiAoICEgY2VsbCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdHZhciBkYXkgPSBwYXJzZUludCggY2VsbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWRheScgKSwgMTAgKTtcclxuXHRcdFx0dmFyIG1tICA9IHBhcnNlSW50KCBjZWxsLmdldEF0dHJpYnV0ZSggJ2RhdGEtbWludXRlJyApLCAxMCApO1xyXG5cdFx0XHR0b2dnbGVfcmVjdCggZ3JpZF9yb290LCBkcmFnX3N0YXRlLmRheTAsIGRheSwgZHJhZ19zdGF0ZS5tbTAsIG1tLCBkcmFnX3N0YXRlLm1vZGUgKTtcclxuXHRcdH0gKTtcclxuXHRcdHcuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNldXAnLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0aWYgKCBkcmFnX3N0YXRlICkge1xyXG5cdFx0XHRcdGRyYWdfc3RhdGUgPSBudWxsO1xyXG5cdFx0XHRcdHBlcnNpc3RfcHJvZmlsZXMoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdC8vIEZpcnN0IHJlbmRlclxyXG5cdFx0ZGF0YV9vYmoud2Vla19jeWNsZSA9IHBhcnNlSW50KCBkYXRhX29iai53ZWVrX2N5Y2xlIHx8IDEsIDEwICk7XHJcblx0XHRpZiAoICEgaXNGaW5pdGUoIGRhdGFfb2JqLndlZWtfY3ljbGUgKSB8fCBkYXRhX29iai53ZWVrX2N5Y2xlIDwgMSApIHsgZGF0YV9vYmoud2Vla19jeWNsZSA9IDE7IH1cclxuXHRcdGlmICggZGF0YV9vYmoud2Vla19jeWNsZSA+IDYgKSB7IGRhdGFfb2JqLndlZWtfY3ljbGUgPSA2OyB9XHJcblx0XHRkYXRhX29iai5wcm9maWxlcyA9IHJlY29uY2lsZV9wcm9maWxlcyggQXJyYXkuaXNBcnJheSggZGF0YV9vYmoucHJvZmlsZXMgKSA/IGRhdGFfb2JqLnByb2ZpbGVzIDogW10sIGRhdGFfb2JqLndlZWtfY3ljbGUgKTtcclxuXHJcblx0XHRyZWZyZXNoX3Byb2ZpbGVfc2VsZWN0b3IoKTtcclxuXHRcdHJlYnVpbGRfcm93c19hbmRfcGFpbnQoKTtcclxuXHRcdHBlcnNpc3RfcHJvZmlsZXMoKTtcclxuXHR9XHJcblxyXG5cdC8qID09PT09PT09PT09PT09PT09PT09PT0gUmVnaXN0cmF0aW9uIChkZWZlcnJlZCkgPT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuXHRmdW5jdGlvbiB3aXRoX3JlZ2lzdHJ5KCBjYiApIHtcclxuXHRcdHZhciB0cmllcyA9IDAsIG1heF90cmllcyA9IDIwMDtcclxuXHRcdChmdW5jdGlvbiBsb29wKCkge1xyXG5cdFx0XHR2YXIgQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fTtcclxuXHRcdFx0dmFyIFJlZ2lzdHJ5ID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeTtcclxuXHRcdFx0dmFyIEZpZWxkX0Jhc2UgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX0Jhc2UgfHwgQ29yZS5XUEJDX0JGQl9TZWxlY3RfQmFzZTtcclxuXHRcdFx0aWYgKCBSZWdpc3RyeSAmJiBSZWdpc3RyeS5yZWdpc3RlciAmJiBGaWVsZF9CYXNlICkge1xyXG5cdFx0XHRcdGNiKCBSZWdpc3RyeSwgRmllbGRfQmFzZSApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCB0cmllcysrIDwgbWF4X3RyaWVzICkge1xyXG5cdFx0XHRcdHNldFRpbWVvdXQoIGxvb3AsIDUwICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIHcuY29uc29sZSApIHtcclxuXHRcdFx0XHR3LmNvbnNvbGUuZXJyb3IoICdbV1BCQ11bdGltZV9zbG90c10gQ29yZS9SZWdpc3RyeSBub3QgYXZhaWxhYmxlLicgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSkoKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX3RpbWVfc2xvdHMoKSB7XHJcblx0XHR3aXRoX3JlZ2lzdHJ5KCBmdW5jdGlvbiggUmVnaXN0cnksIEZpZWxkX0Jhc2UgKSB7XHJcblx0XHRcdGNsYXNzIHdwYmNfYmZiX2ZpZWxkX3RpbWVfc2xvdHMgZXh0ZW5kcyBGaWVsZF9CYXNlIHtcclxuXHRcdFx0XHRzdGF0aWMgdGVtcGxhdGVfaWQgPSAnd3BiYy1iZmItZmllbGQtdGltZS1zbG90cyc7XHJcblx0XHRcdFx0c3RhdGljIGtpbmQgICAgICAgID0gJ3RpbWVfc2xvdHMnO1xyXG5cdFx0XHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XHJcblx0XHRcdFx0XHR2YXIgZCA9ICggc3VwZXIuZ2V0X2RlZmF1bHRzID8gc3VwZXIuZ2V0X2RlZmF1bHRzKCkgOiB7fSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oIHt9LCBkLCB7XHJcblx0XHRcdFx0XHRcdHR5cGUgICAgICAgIDogJ3RpbWVfc2xvdHMnLFxyXG5cdFx0XHRcdFx0XHRsYWJlbCAgICAgICA6ICdUaW1lIFNsb3RzJyxcclxuXHRcdFx0XHRcdFx0Y3NzY2xhc3MgICAgOiAnJyxcclxuXHRcdFx0XHRcdFx0aGVscCAgICAgICAgOiAnJyxcclxuXHRcdFx0XHRcdFx0c3RhcnRfdGltZSAgOiAnMDg6MDAnLFxyXG5cdFx0XHRcdFx0XHRlbmRfdGltZSAgICA6ICcyMDowMCcsXHJcblx0XHRcdFx0XHRcdHN0ZXBfbWludXRlczogMzAsXHJcblx0XHRcdFx0XHRcdHdlZWtfY3ljbGUgIDogMSxcclxuXHRcdFx0XHRcdFx0cHJvZmlsZXMgICAgOiBbXHJcblx0XHRcdFx0XHRcdFx0eyBrZXk6ICdBJywgbGFiZWw6ICdXZWVrIEEnLCBzbG90czogeyAnMSc6W10sICcyJzpbXSwgJzMnOltdLCAnNCc6W10sICc1JzpbXSwgJzYnOltdLCAnNyc6W10gfSB9XHJcblx0XHRcdFx0XHRcdF0sXHJcblx0XHRcdFx0XHRcdG1pbl93aWR0aCAgIDogJzMyMHB4J1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHR0cnkgeyBSZWdpc3RyeS5yZWdpc3RlciggJ3RpbWVfc2xvdHMnLCB3cGJjX2JmYl9maWVsZF90aW1lX3Nsb3RzICk7IH1cclxuXHRcdFx0Y2F0Y2ggKCBlICkgeyBpZiAoIHcuY29uc29sZSApIHsgdy5jb25zb2xlLmVycm9yKCAnW1dQQkNdW3RpbWVfc2xvdHNdIHJlZ2lzdGVyIGZhaWxlZDonLCBlICk7IH0gfVxyXG5cdFx0XHR3LldQQkNfQkZCX0ZpZWxkX1RpbWVfU2xvdHMgPSB3cGJjX2JmYl9maWVsZF90aW1lX3Nsb3RzOyAvLyBmb3IgZGVidWdnaW5nXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cdHJlZ2lzdGVyX3RpbWVfc2xvdHMoKTtcclxuXHJcblx0LyogPT09PT09PT09PT09PT09PT09PT09PSBJbnNwZWN0b3IgaW5pdCBiaW5kaW5ncyA9PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5cdGZ1bmN0aW9uIHRyeV9pbml0X29uX3BhbmVsKCBwYW5lbCApIHtcclxuXHRcdGlmICggISBwYW5lbCApIHsgcmV0dXJuOyB9XHJcblx0XHR2YXIgZ3JpZF9yb290ID0gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fdGltZWdyaWRfcm9vdCcgKTtcclxuXHRcdHZhciBqc29uX2VsICAgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLXByb2ZpbGVzLWpzb24nICk7XHJcblx0XHRpZiAoICEgZ3JpZF9yb290IHx8ICEganNvbl9lbCApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIHBhbmVsLl9fd3BiY190aW1lZ3JpZF9pbml0ZWQgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBwcm9maWxlcyA9IFtdO1xyXG5cdFx0dHJ5IHsgcHJvZmlsZXMgPSBKU09OLnBhcnNlKCBqc29uX2VsLnZhbHVlIHx8ICdbXScgKTsgfSBjYXRjaCAoZSkgeyBwcm9maWxlcyA9IFtdOyB9XHJcblxyXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX2hpZGRlbl9qc29uKCBwcm9maWxlc19hcnIgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0anNvbl9lbC52YWx1ZSA9IEpTT04uc3RyaW5naWZ5KCBwcm9maWxlc19hcnIgfHwgW10gKTtcclxuXHRcdFx0XHR2YXIgZXZ0ID0gZC5jcmVhdGVFdmVudCggJ0hUTUxFdmVudHMnICk7IGV2dC5pbml0RXZlbnQoICdjaGFuZ2UnLCB0cnVlLCBmYWxzZSApOyBqc29uX2VsLmRpc3BhdGNoRXZlbnQoIGV2dCApO1xyXG5cdFx0XHR9IGNhdGNoIChlKSB7fVxyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBkYXRhX29iaiA9IHtcclxuXHRcdFx0c3RhcnRfdGltZSAgOiAoICggcGFuZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJzdGFydF90aW1lXCJdJyApIHx8IHt9ICkudmFsdWUgKSB8fCAnMDg6MDAnLFxyXG5cdFx0XHRlbmRfdGltZSAgICA6ICggKCBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtaW5zcGVjdG9yLWtleT1cImVuZF90aW1lXCJdJyApICAgfHwge30gKS52YWx1ZSApIHx8ICcyMDowMCcsXHJcblx0XHRcdHN0ZXBfbWludXRlczogcGFyc2VJbnQoICggKCBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtaW5zcGVjdG9yLWtleT1cInN0ZXBfbWludXRlc1wiXScgKSB8fCB7fSApLnZhbHVlICkgfHwgJzMwJywgMTAgKSxcclxuXHRcdFx0d2Vla19jeWNsZSAgOiBwYXJzZUludCggKCAoIHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtd2Vlay1jeWNsZScgKSB8fCB7fSApLnZhbHVlICkgfHwgJzEnLCAxMCApLFxyXG5cdFx0XHRwcm9maWxlcyAgICA6IHByb2ZpbGVzXHJcblx0XHR9O1xyXG5cclxuXHRcdGluaXRfZ3JpZF9jb250cm9sbGVyKCBwYW5lbCwgZGF0YV9vYmosIHVwZGF0ZV9oaWRkZW5fanNvbiApO1xyXG5cdH1cclxuXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19iZmJfaW5zcGVjdG9yX3JlYWR5JywgZnVuY3Rpb24oIGV2ICkge1xyXG5cdFx0dHJ5IHsgdHJ5X2luaXRfb25fcGFuZWwoIGV2ICYmIGV2LmRldGFpbCAmJiBldi5kZXRhaWwucGFuZWwgKTsgfSBjYXRjaCAoZSkge31cclxuXHR9ICk7XHJcblxyXG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBmdW5jdGlvbigpIHtcclxuXHRcdHZhciBwYW5lbHMgPSBkLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2luc3BlY3Rvcl9fYm9keScgKTtcclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHBhbmVscy5sZW5ndGg7IGkrKyApIHsgdHJ5X2luaXRfb25fcGFuZWwoIHBhbmVsc1sgaSBdICk7IH1cclxuXHR9ICk7XHJcblxyXG5cdHRyeSB7XHJcblx0XHR2YXIgbW8gPSBuZXcgTXV0YXRpb25PYnNlcnZlciggZnVuY3Rpb24oIG11dHMgKSB7XHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IG11dHMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0dmFyIG4gPSBtdXRzWyBpIF0udGFyZ2V0O1xyXG5cdFx0XHRcdGlmICggISBuICkgeyBjb250aW51ZTsgfVxyXG5cdFx0XHRcdGlmICggbi5jbGFzc0xpc3QgJiYgbi5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApICkge1xyXG5cdFx0XHRcdFx0dHJ5X2luaXRfb25fcGFuZWwoIG4gKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBuLnF1ZXJ5U2VsZWN0b3IgKSB7XHJcblx0XHRcdFx0XHR2YXIgcCA9IG4ucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApO1xyXG5cdFx0XHRcdFx0aWYgKCBwICkgeyB0cnlfaW5pdF9vbl9wYW5lbCggcCApOyB9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0XHRtby5vYnNlcnZlKCBkLmRvY3VtZW50RWxlbWVudCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSApO1xyXG5cdH0gY2F0Y2ggKGUpIHt9XHJcblxyXG5cdC8qID09PT09PT09PT09PT09PT09PT09PT0gTWluaW1hbCBDU1MgKHNjb3BlZCkgPT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuXHR2YXIgY3NzID0gJydcclxuXHQrICcud3BiY19iZmJfX3RpbWVfcHJldmlld19fd2Vla3tib3JkZXI6MXB4IHNvbGlkICNlNWU1ZTU7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo4cHg7bWFyZ2luOjhweCAwO30nXHJcblx0KyAnLndwYmNfYmZiX190aW1lX3ByZXZpZXdfX3dlZWtfdGl0bGV7bWFyZ2luLWJvdHRvbTo2cHg7fSdcclxuXHQrICcud3BiY19iZmJfX3RpbWVfcHJldmlld19fcm93e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7bWFyZ2luOjJweCAwO30nXHJcblx0KyAnLndwYmNfYmZiX190aW1lX3ByZXZpZXdfX2RheXt3aWR0aDo0MnB4O29wYWNpdHk6Ljg7Zm9udC1zaXplOjEycHg7fSdcclxuXHQrICcud3BiY19iZmJfX3RpbWVfYmFkZ2V7ZGlzcGxheTppbmxpbmUtYmxvY2s7Ym9yZGVyOjFweCBzb2xpZCAjZDBkMGQwO2JvcmRlci1yYWRpdXM6MTJweDtwYWRkaW5nOjJweCA4cHg7bWFyZ2luOjAgNHB4IDRweCAwO2ZvbnQtc2l6ZToxMXB4O2JhY2tncm91bmQ6I2Y3ZjdmNzt9J1xyXG5cdCsgJy53cGJjX2JmYl9fdGltZV9iYWRnZS0tZW1wdHl7b3BhY2l0eTouNjt9J1xyXG5cdCsgJy53cGJjX2JmYl9fdGltZWdyaWRfcm9vdHtib3JkZXI6MXB4IHNvbGlkICNlMWUxZTE7Ym9yZGVyLXJhZGl1czo2cHg7b3ZlcmZsb3c6aGlkZGVuO21hcmdpbi10b3A6NnB4O30nXHJcblx0KyAnLndwYmNfYmZiX190aW1lZ3JpZF9oZWFkLC53cGJjX2JmYl9fdGltZWdyaWRfcm93e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6ODBweCByZXBlYXQoNywxZnIpO30nXHJcblx0KyAnLndwYmNfYmZiX190aW1lZ3JpZF9jZWxse2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNmMGYwZjA7Ym9yZGVyLXJpZ2h0OjFweCBzb2xpZCAjZjVmNWY1O3BhZGRpbmc6NHB4O21pbi1oZWlnaHQ6MjRweDtib3gtc2l6aW5nOmJvcmRlci1ib3g7fSdcclxuXHQrICcud3BiY19iZmJfX3RpbWVncmlkX2NlbGwtLWNvcm5lcntiYWNrZ3JvdW5kOiNmYWZhZmE7fSdcclxuXHQrICcud3BiY19iZmJfX3RpbWVncmlkX2NlbGwtLWRheXtiYWNrZ3JvdW5kOiNmYWZhZmE7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC13ZWlnaHQ6NjAwO30nXHJcblx0KyAnLndwYmNfYmZiX190aW1lZ3JpZF9jZWxsLS10aW1le2JhY2tncm91bmQ6I2ZhZmFmYTtmb250LXZhcmlhbnQtbnVtZXJpYzp0YWJ1bGFyLW51bXM7fSdcclxuXHQrICcud3BiY19iZmJfX3RpbWVncmlkX2NlbGwtLXNsb3R7Y3Vyc29yOmNyb3NzaGFpcjt9J1xyXG5cdCsgJy53cGJjX2JmYl9fdGltZWdyaWRfY2VsbC0tc2xvdC5pcy1vbntiYWNrZ3JvdW5kOnJnYmEoMCwxMjAsMjEyLC4xMik7b3V0bGluZToxcHggc29saWQgcmdiYSgwLDEyMCwyMTIsLjM1KTt9J1xyXG5cdCsgJy53cGJjX2JmYl9fdGltZWdyaWRfdG9vbGJhcntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjhweDttYXJnaW46OHB4IDA7fSdcclxuXHQrICcud3BiY19iZmJfX3RpbWVncmlkX3Byb2ZpbGVzIHNlbGVjdHttaW4td2lkdGg6MTQwcHg7fSc7XHJcblxyXG5cdHRyeSB7IHZhciBzdCA9IGQuY3JlYXRlRWxlbWVudCggJ3N0eWxlJyApOyBzdC50eXBlID0gJ3RleHQvY3NzJzsgc3QuYXBwZW5kQ2hpbGQoIGQuY3JlYXRlVGV4dE5vZGUoIGNzcyApICk7IGQuaGVhZC5hcHBlbmRDaGlsZCggc3QgKTsgfSBjYXRjaCAoZSkge31cclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7RUFFQztFQUVBLFNBQVNDLElBQUlBLENBQUVDLENBQUMsRUFBRztJQUFFQSxDQUFDLEdBQUdDLFFBQVEsQ0FBRUQsQ0FBQyxFQUFFLEVBQUcs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
