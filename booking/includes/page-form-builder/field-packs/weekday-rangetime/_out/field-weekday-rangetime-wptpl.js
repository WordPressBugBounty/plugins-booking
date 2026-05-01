"use strict";

// WPBC BFB Pack: Weekday Time Slots.
(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  function pad2(n) {
    n = parseInt(n, 10);
    return (n < 10 ? '0' : '') + n;
  }
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
  function min_to_time(mins) {
    var m = parseInt(mins, 10);
    if (!isFinite(m)) {
      m = 0;
    }
    m = (m % 1440 + 1440) % 1440;
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
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
  function day_order() {
    return ['default', '1', '2', '3', '4', '5', '6', '7'];
  }
  function weekday_order() {
    return ['1', '2', '3', '4', '5', '6', '7'];
  }
  function default_slots() {
    return {
      'default': [{
        from: '10:00',
        to: '11:00'
      }, {
        from: '11:00',
        to: '12:00'
      }, {
        from: '12:00',
        to: '13:00'
      }, {
        from: '13:00',
        to: '14:00'
      }, {
        from: '14:00',
        to: '15:00'
      }, {
        from: '15:00',
        to: '16:00'
      }, {
        from: '16:00',
        to: '17:00'
      }, {
        from: '17:00',
        to: '18:00'
      }],
      '1': [{
        from: '10:00',
        to: '12:00'
      }, {
        from: '12:00',
        to: '14:00'
      }],
      '2': [{
        from: '10:00',
        to: '12:00'
      }, {
        from: '12:00',
        to: '14:00'
      }],
      '3': [{
        from: '14:00',
        to: '16:00'
      }, {
        from: '16:00',
        to: '18:00'
      }, {
        from: '18:00',
        to: '20:00'
      }],
      '4': [{
        from: '14:00',
        to: '16:00'
      }, {
        from: '16:00',
        to: '18:00'
      }, {
        from: '18:00',
        to: '20:00'
      }],
      '5': [{
        from: '10:00',
        to: '12:00'
      }, {
        from: '12:00',
        to: '14:00'
      }, {
        from: '14:00',
        to: '16:00'
      }, {
        from: '16:00',
        to: '18:00'
      }, {
        from: '18:00',
        to: '20:00'
      }],
      '6': [{
        from: '10:00',
        to: '12:00'
      }, {
        from: '12:00',
        to: '14:00'
      }, {
        from: '14:00',
        to: '16:00'
      }, {
        from: '16:00',
        to: '18:00'
      }, {
        from: '18:00',
        to: '20:00'
      }],
      '7': [{
        from: '10:00',
        to: '12:00'
      }, {
        from: '12:00',
        to: '14:00'
      }, {
        from: '14:00',
        to: '16:00'
      }, {
        from: '16:00',
        to: '18:00'
      }, {
        from: '18:00',
        to: '20:00'
      }]
    };
  }
  function get_boot() {
    return w.WPBC_BFB_Weekday_Rangetime_Boot || {};
  }
  function is_supported_value(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }
  function is_pack_supported(field) {
    var boot = get_boot();
    if (boot && typeof boot.is_supported !== 'undefined') {
      return is_supported_value(boot.is_supported);
    }
    return is_supported_value(field && field.is_supported);
  }
  function upgrade_text(field) {
    var boot = get_boot();
    return String(boot && boot.upgrade_text || field && field.upgrade_text || 'This field is available only in Booking Calendar Business Medium or higher versions.');
  }
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
  function build_row_minutes(from_min, to_min, step) {
    var out = [];
    for (var m = from_min; m < to_min; m += step) {
      out.push(m);
    }
    return out;
  }
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
  function get_state(panel) {
    var start_el = panel.querySelector('[data-inspector-key="start_time"]');
    var end_el = panel.querySelector('[data-inspector-key="end_time"]');
    var step_el = panel.querySelector('[data-inspector-key="step_minutes"]');
    var start_min = time_to_min(start_el && start_el.value || '10:00');
    var end_min = time_to_min(end_el && end_el.value || '20:00');
    var step = normalize_step(step_el && step_el.value || 60);
    if (start_min == null) {
      start_min = 10 * 60;
    }
    if (end_min == null) {
      end_min = 20 * 60;
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
  function render_grid_rows(panel) {
    var body = panel.querySelector('.wpbc_bfb__weekday_timegrid_body');
    if (!body) {
      return;
    }
    var state = get_state(panel);
    var template = w.wp && w.wp.template ? w.wp.template('wpbc-bfb-weekday-rangetime-row') : null;
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
  function persist_slots(panel) {
    var state_el = panel.querySelector('.js-weekday-slots-json');
    if (!state_el) {
      return;
    }
    var slots = read_slots(panel);
    state_el.value = JSON.stringify(slots);
    emit_change(state_el);
  }
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
  function bind_grid(panel) {
    if (!panel || panel.__wpbc_weekday_rangetime_inited) {
      return;
    }
    panel.__wpbc_weekday_rangetime_inited = true;
    var state_el = panel.querySelector('.js-weekday-slots-json');
    var slots = normalize_slots(state_el ? state_el.value : {});
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
      locked.value = 'rangetime';
      emit_change(locked);
    }
    var locked_condition = panel.querySelector('.js-locked-condition-name[data-inspector-key="condition_name"]');
    if (locked_condition) {
      locked_condition.value = 'weekday-condition';
      emit_change(locked_condition);
    }
  }
  function try_init_panel(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var panel = root.matches && root.matches('.wpbc_bfb__inspector_weekday_rangetime') ? root : root.querySelector('.wpbc_bfb__inspector_weekday_rangetime');
    if (panel) {
      bind_grid(panel);
    }
  }
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
  function register_renderer() {
    with_registry(function (Registry, Base) {
      class WPBC_BFB_Field_Weekday_RangeTime extends Base {
        static template_id = 'wpbc-bfb-field-weekday_rangetime';
        static kind = 'weekday_rangetime';
        static get_defaults() {
          var base = super.get_defaults ? super.get_defaults() : {};
          return Object.assign({}, base, {
            type: 'weekday_rangetime',
            usage_key: 'rangetime',
            label: 'Time slots',
            name: 'rangetime',
            required: true,
            condition_name: 'weekday-condition',
            is_supported: is_pack_supported(),
            upgrade_text: upgrade_text(),
            start_time: '10:00',
            end_time: '20:00',
            step_minutes: 60,
            slots: default_slots(),
            min_width: '320px'
          });
        }
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
        static on_field_drop(data, el, ctx) {
          if (super.on_field_drop) {
            super.on_field_drop(data, el, ctx);
          }
          if (data) {
            data.usage_key = 'rangetime';
            data.name = 'rangetime';
            data.condition_name = 'weekday-condition';
            data.multiple = false;
            data.is_supported = is_pack_supported(data);
            data.upgrade_text = upgrade_text(data);
          }
          if (el && el.dataset) {
            el.dataset.usage_key = 'rangetime';
            el.dataset.name = 'rangetime';
            el.dataset.autoname = '0';
            el.dataset.fresh = '0';
            el.dataset.name_user_touched = '1';
          }
        }
      }
      try {
        Registry.register('weekday_rangetime', WPBC_BFB_Field_Weekday_RangeTime);
      } catch (e) {}
      w.WPBC_BFB_Field_Weekday_RangeTime = WPBC_BFB_Field_Weekday_RangeTime;
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
  function escape_shortcode(value) {
    var sanitize = (w.WPBC_BFB_Core || {}).WPBC_BFB_Sanitize || {};
    if (sanitize.escape_for_shortcode) {
      return sanitize.escape_for_shortcode(String(value || ''));
    }
    return String(value || '').replace(/"/g, '&quot;').replace(/\r?\n/g, ' ');
  }
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
  function sanitize_condition_name(value) {
    var sanitize = (w.WPBC_BFB_Core || {}).WPBC_BFB_Sanitize || {};
    if (sanitize.to_token) {
      return sanitize.to_token(String(value || 'weekday-condition')) || 'weekday-condition';
    }
    return String(value || 'weekday-condition').replace(/[^0-9A-Za-z:._-]/g, '') || 'weekday-condition';
  }
  function slots_signature(ranges) {
    return sanitize_ranges(ranges).map(function (range) {
      return range.from + '-' + range.to;
    }).join('|');
  }
  function slot_tokens(ranges) {
    return sanitize_ranges(ranges).map(function (range) {
      var value = range.from + ' - ' + range.to;
      return '"' + escape_shortcode(value) + '"';
    }).join(' ');
  }
  function weekday_to_condition_value(day_key) {
    return day_key === '7' ? '0' : day_key;
  }
  function condition_block(condition_name, value, select_shortcode) {
    return ['[condition name="' + condition_name + '" type="weekday" value="' + value + '"]', '\t' + select_shortcode, '[/condition]'].join('\n');
  }
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
  function wrap_body_if_needed(field, body, ctx) {
    var attrs = build_wrapper_attrs(field, ctx);
    if (!attrs) {
      return body;
    }
    return '<div' + attrs + '>\n' + body + '\n</div>';
  }
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
  function no_slots_markup() {
    return '<span class="wpbc_no_time_slots">No time slots available.</span>';
  }
  function select_shortcode_for_slots(field, ranges) {
    var Exp = w.WPBC_BFB_Exporter;
    var req = Exp && Exp.is_required && Exp.is_required(field) ? '*' : '';
    var tokens = slot_tokens(ranges);
    if (!tokens) {
      return no_slots_markup();
    }
    return '[selectbox' + req + ' rangetime ' + tokens + ']';
  }
  function register_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('weekday_rangetime')) {
      return;
    }
    Exp.register('weekday_rangetime', function (field, emit, extras) {
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
  function register_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('weekday_rangetime')) {
      return;
    }
    C.register('weekday_rangetime', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var label = field && typeof field.label === 'string' && field.label.trim() ? field.label.trim() : 'Time slots';
      if (!is_pack_supported(field)) {
        return;
      }
      if (C.emit_line_bold_field) {
        C.emit_line_bold_field(emit, label, 'rangetime', cfg);
      } else {
        emit('<b>' + escape_html(label) + '</b>: <f>[rangetime]</f><br>');
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvd2Vla2RheS1yYW5nZXRpbWUvX291dC9maWVsZC13ZWVrZGF5LXJhbmdldGltZS13cHRwbC5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJwYWQyIiwibiIsInBhcnNlSW50IiwidGltZV90b19taW4iLCJ0IiwibSIsIm1hdGNoIiwiaCIsIm1pbiIsIm1pbl90b190aW1lIiwibWlucyIsImlzRmluaXRlIiwiTWF0aCIsImZsb29yIiwibm9ybWFsaXplX3N0ZXAiLCJzdGVwIiwicyIsImRheV9vcmRlciIsIndlZWtkYXlfb3JkZXIiLCJkZWZhdWx0X3Nsb3RzIiwiZnJvbSIsInRvIiwiZ2V0X2Jvb3QiLCJXUEJDX0JGQl9XZWVrZGF5X1JhbmdldGltZV9Cb290IiwiaXNfc3VwcG9ydGVkX3ZhbHVlIiwidmFsdWUiLCJpc19wYWNrX3N1cHBvcnRlZCIsImZpZWxkIiwiYm9vdCIsImlzX3N1cHBvcnRlZCIsInVwZ3JhZGVfdGV4dCIsIlN0cmluZyIsIm5vcm1hbGl6ZV9zbG90cyIsInJhdyIsImJhc2UiLCJvdXQiLCJwYXJzZWQiLCJKU09OIiwicGFyc2UiLCJlIiwiQXJyYXkiLCJpc0FycmF5IiwiZm9yRWFjaCIsImtleSIsInJhbmdlcyIsInNhbml0aXplX3JhbmdlcyIsInJhbmdlIiwiZnJvbV9taW4iLCJ0b19taW4iLCJwdXNoIiwic29ydCIsImEiLCJiIiwiYnVpbGRfcm93X21pbnV0ZXMiLCJtaW51dGVzX3RvX3N0ZXBfc2xvdHMiLCJtaW51dGVzIiwibGVuZ3RoIiwibWludXRlIiwicmFuZ2VzX3RvX3NldCIsInNldCIsImdldF9zdGF0ZSIsInBhbmVsIiwic3RhcnRfZWwiLCJxdWVyeVNlbGVjdG9yIiwiZW5kX2VsIiwic3RlcF9lbCIsInN0YXJ0X21pbiIsImVuZF9taW4iLCJlbWl0X2NoYW5nZSIsImVsIiwialF1ZXJ5IiwidHJpZ2dlciIsImRpc3BhdGNoRXZlbnQiLCJFdmVudCIsImJ1YmJsZXMiLCJyZW5kZXJfZ3JpZF9yb3dzIiwiYm9keSIsInN0YXRlIiwidGVtcGxhdGUiLCJ3cCIsImlubmVySFRNTCIsImh0bWwiLCJsYWJlbCIsIndyYXAiLCJjcmVhdGVFbGVtZW50IiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJhcHBlbmRDaGlsZCIsInBhaW50X3Nsb3RzIiwic2xvdHMiLCJkYXlfa2V5IiwicXVlcnlTZWxlY3RvckFsbCIsImNlbGwiLCJnZXRBdHRyaWJ1dGUiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJyZWFkX3Nsb3RzIiwicGVyc2lzdF9zbG90cyIsInN0YXRlX2VsIiwic3RyaW5naWZ5IiwidG9nZ2xlX3JlY3QiLCJmcm9tX2RheV9pZHgiLCJ0b19kYXlfaWR4IiwibW9kZSIsImRheXMiLCJkYXlfc3RhcnQiLCJkYXlfZW5kIiwibWF4IiwibWluX3N0YXJ0IiwibWluX2VuZCIsImkiLCJhZGQiLCJyZW1vdmUiLCJiaW5kX2dyaWQiLCJfX3dwYmNfd2Vla2RheV9yYW5nZXRpbWVfaW5pdGVkIiwicmVidWlsZCIsImN1cnJlbnQiLCJhZGRFdmVudExpc3RlbmVyIiwiZ3JvdXAiLCJjbG9zZXN0IiwibnVtIiwiZHJhZyIsImV2IiwidGFyZ2V0IiwiZGF5X2lkeCIsImluZGV4T2YiLCJjb250YWlucyIsInByZXZlbnREZWZhdWx0IiwiY29weV9kZWZhdWx0IiwiY2xlYXJfd2Vla2RheXMiLCJsb2NrZWQiLCJsb2NrZWRfY29uZGl0aW9uIiwidHJ5X2luaXRfcGFuZWwiLCJyb290IiwibWF0Y2hlcyIsIndpdGhfcmVnaXN0cnkiLCJjYiIsInRyaWVzIiwibG9vcCIsInJlZ2lzdHJ5IiwiV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkiLCJXUEJDX0JGQl9GaWVsZF9CYXNlIiwiV1BCQ19CRkJfU2VsZWN0X0Jhc2UiLCJyZWdpc3RlciIsInNldFRpbWVvdXQiLCJyZWdpc3Rlcl9yZW5kZXJlciIsIlJlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX1dlZWtkYXlfUmFuZ2VUaW1lIiwidGVtcGxhdGVfaWQiLCJraW5kIiwiZ2V0X2RlZmF1bHRzIiwiT2JqZWN0IiwiYXNzaWduIiwidHlwZSIsInVzYWdlX2tleSIsIm5hbWUiLCJyZXF1aXJlZCIsImNvbmRpdGlvbl9uYW1lIiwic3RhcnRfdGltZSIsImVuZF90aW1lIiwic3RlcF9taW51dGVzIiwibWluX3dpZHRoIiwicmVuZGVyIiwiZGF0YSIsImN0eCIsImRhdGFzZXQiLCJvbl9maWVsZF9kcm9wIiwibXVsdGlwbGUiLCJhdXRvbmFtZSIsImZyZXNoIiwibmFtZV91c2VyX3RvdWNoZWQiLCJkZXRhaWwiLCJyZWFkeVN0YXRlIiwib2JzZXJ2ZXIiLCJNdXRhdGlvbk9ic2VydmVyIiwibXV0cyIsIm11dCIsInByb3RvdHlwZSIsImNhbGwiLCJhZGRlZE5vZGVzIiwibm9kZSIsIm5vZGVUeXBlIiwib2JzZXJ2ZSIsImRvY3VtZW50RWxlbWVudCIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJlc2NhcGVfc2hvcnRjb2RlIiwic2FuaXRpemUiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY2FwZV9mb3Jfc2hvcnRjb2RlIiwicmVwbGFjZSIsImVzY2FwZV9odG1sIiwiY2giLCJzYW5pdGl6ZV9jb25kaXRpb25fbmFtZSIsInRvX3Rva2VuIiwic2xvdHNfc2lnbmF0dXJlIiwibWFwIiwiam9pbiIsInNsb3RfdG9rZW5zIiwid2Vla2RheV90b19jb25kaXRpb25fdmFsdWUiLCJjb25kaXRpb25fYmxvY2siLCJzZWxlY3Rfc2hvcnRjb2RlIiwiYnVpbGRfd3JhcHBlcl9hdHRycyIsImF0dHJzIiwiY2xzIiwiY3NzY2xhc3MiLCJjbGFzcyIsImNsYXNzTmFtZSIsImh0bWxfaWQiLCJ0cmltIiwic2FuaXRpemVfY3NzX2NsYXNzbGlzdCIsInNhbml0aXplX2h0bWxfaWQiLCJ1c2VkSWRzIiwidW5pcXVlX2lkIiwic3VmZml4IiwiaGFzIiwid3JhcF9ib2R5X2lmX25lZWRlZCIsImVtaXRfbGFiZWxfdGhlbl9jbGVhciIsImVtaXQiLCJjZmciLCJhZGRfbGFiZWxzIiwiYWRkTGFiZWxzIiwiRXhwIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJyZXEiLCJpc19yZXF1aXJlZCIsIndyYXBwZWRfYm9keSIsIm5vX3Nsb3RzX21hcmt1cCIsInNlbGVjdF9zaG9ydGNvZGVfZm9yX3Nsb3RzIiwidG9rZW5zIiwicmVnaXN0ZXJfYm9va2luZ19mb3JtX2V4cG9ydGVyIiwiaGFzX2V4cG9ydGVyIiwiZXh0cmFzIiwiZGVmYXVsdF9yYW5nZXMiLCJibG9ja3MiLCJncm91cHMiLCJkZWZhdWx0X3NpZyIsInNpZyIsImtleXMiLCJvbmNlIiwicmVnaXN0ZXJfYm9va2luZ19kYXRhX2V4cG9ydGVyIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsImVtaXRfbGluZV9ib2xkX2ZpZWxkIiwiY3NzIiwic3R5bGUiLCJjcmVhdGVUZXh0Tm9kZSIsImhlYWQiLCJ3aW5kb3ciLCJkb2N1bWVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3dlZWtkYXktcmFuZ2V0aW1lL19zcmMvZmllbGQtd2Vla2RheS1yYW5nZXRpbWUtd3B0cGwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gV1BCQyBCRkIgUGFjazogV2Vla2RheSBUaW1lIFNsb3RzLlxyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cclxuXHRmdW5jdGlvbiBwYWQyKG4pIHtcclxuXHRcdG4gPSBwYXJzZUludChuLCAxMCk7XHJcblx0XHRyZXR1cm4gKG4gPCAxMCA/ICcwJyA6ICcnKSArIG47XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0aW1lX3RvX21pbih0KSB7XHJcblx0XHRpZiAoIXQgfHwgdHlwZW9mIHQgIT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdFx0dmFyIG0gPSB0Lm1hdGNoKC9eKFxcZHsxLDJ9KTooXFxkezJ9KSQvKTtcclxuXHRcdGlmICghbSkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHRcdHZhciBoID0gcGFyc2VJbnQobVsxXSwgMTApO1xyXG5cdFx0dmFyIG1pbiA9IHBhcnNlSW50KG1bMl0sIDEwKTtcclxuXHRcdGlmIChoIDwgMCB8fCBoID4gMjMgfHwgbWluIDwgMCB8fCBtaW4gPiA1OSkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBoICogNjAgKyBtaW47XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBtaW5fdG9fdGltZShtaW5zKSB7XHJcblx0XHR2YXIgbSA9IHBhcnNlSW50KG1pbnMsIDEwKTtcclxuXHRcdGlmICghaXNGaW5pdGUobSkpIHtcclxuXHRcdFx0bSA9IDA7XHJcblx0XHR9XHJcblx0XHRtID0gKChtICUgMTQ0MCkgKyAxNDQwKSAlIDE0NDA7XHJcblx0XHRyZXR1cm4gcGFkMihNYXRoLmZsb29yKG0gLyA2MCkpICsgJzonICsgcGFkMihtICUgNjApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX3N0ZXAoc3RlcCkge1xyXG5cdFx0dmFyIHMgPSBwYXJzZUludChzdGVwLCAxMCk7XHJcblx0XHRpZiAoIWlzRmluaXRlKHMpIHx8IHMgPCA1KSB7XHJcblx0XHRcdHMgPSA1O1xyXG5cdFx0fVxyXG5cdFx0aWYgKHMgPiAxODApIHtcclxuXHRcdFx0cyA9IDE4MDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBzO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZGF5X29yZGVyKCkge1xyXG5cdFx0cmV0dXJuIFsnZGVmYXVsdCcsICcxJywgJzInLCAnMycsICc0JywgJzUnLCAnNicsICc3J107XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3ZWVrZGF5X29yZGVyKCkge1xyXG5cdFx0cmV0dXJuIFsnMScsICcyJywgJzMnLCAnNCcsICc1JywgJzYnLCAnNyddO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZGVmYXVsdF9zbG90cygpIHtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdCdkZWZhdWx0JzogW1xyXG5cdFx0XHRcdHsgZnJvbTogJzEwOjAwJywgdG86ICcxMTowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxMTowMCcsIHRvOiAnMTI6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTI6MDAnLCB0bzogJzEzOjAwJyB9LFxyXG5cdFx0XHRcdHsgZnJvbTogJzEzOjAwJywgdG86ICcxNDowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxNDowMCcsIHRvOiAnMTU6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTU6MDAnLCB0bzogJzE2OjAwJyB9LFxyXG5cdFx0XHRcdHsgZnJvbTogJzE2OjAwJywgdG86ICcxNzowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxNzowMCcsIHRvOiAnMTg6MDAnIH1cclxuXHRcdFx0XSxcclxuXHRcdFx0JzEnOiBbXHJcblx0XHRcdFx0eyBmcm9tOiAnMTA6MDAnLCB0bzogJzEyOjAwJyB9LFxyXG5cdFx0XHRcdHsgZnJvbTogJzEyOjAwJywgdG86ICcxNDowMCcgfVxyXG5cdFx0XHRdLFxyXG5cdFx0XHQnMic6IFtcclxuXHRcdFx0XHR7IGZyb206ICcxMDowMCcsIHRvOiAnMTI6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTI6MDAnLCB0bzogJzE0OjAwJyB9XHJcblx0XHRcdF0sXHJcblx0XHRcdCczJzogW1xyXG5cdFx0XHRcdHsgZnJvbTogJzE0OjAwJywgdG86ICcxNjowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxNjowMCcsIHRvOiAnMTg6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTg6MDAnLCB0bzogJzIwOjAwJyB9XHJcblx0XHRcdF0sXHJcblx0XHRcdCc0JzogW1xyXG5cdFx0XHRcdHsgZnJvbTogJzE0OjAwJywgdG86ICcxNjowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxNjowMCcsIHRvOiAnMTg6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTg6MDAnLCB0bzogJzIwOjAwJyB9XHJcblx0XHRcdF0sXHJcblx0XHRcdCc1JzogW1xyXG5cdFx0XHRcdHsgZnJvbTogJzEwOjAwJywgdG86ICcxMjowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxMjowMCcsIHRvOiAnMTQ6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTQ6MDAnLCB0bzogJzE2OjAwJyB9LFxyXG5cdFx0XHRcdHsgZnJvbTogJzE2OjAwJywgdG86ICcxODowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxODowMCcsIHRvOiAnMjA6MDAnIH1cclxuXHRcdFx0XSxcclxuXHRcdFx0JzYnOiBbXHJcblx0XHRcdFx0eyBmcm9tOiAnMTA6MDAnLCB0bzogJzEyOjAwJyB9LFxyXG5cdFx0XHRcdHsgZnJvbTogJzEyOjAwJywgdG86ICcxNDowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxNDowMCcsIHRvOiAnMTY6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTY6MDAnLCB0bzogJzE4OjAwJyB9LFxyXG5cdFx0XHRcdHsgZnJvbTogJzE4OjAwJywgdG86ICcyMDowMCcgfVxyXG5cdFx0XHRdLFxyXG5cdFx0XHQnNyc6IFtcclxuXHRcdFx0XHR7IGZyb206ICcxMDowMCcsIHRvOiAnMTI6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTI6MDAnLCB0bzogJzE0OjAwJyB9LFxyXG5cdFx0XHRcdHsgZnJvbTogJzE0OjAwJywgdG86ICcxNjowMCcgfSxcclxuXHRcdFx0XHR7IGZyb206ICcxNjowMCcsIHRvOiAnMTg6MDAnIH0sXHJcblx0XHRcdFx0eyBmcm9tOiAnMTg6MDAnLCB0bzogJzIwOjAwJyB9XHJcblx0XHRcdF1cclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfYm9vdCgpIHtcclxuXHRcdHJldHVybiB3LldQQkNfQkZCX1dlZWtkYXlfUmFuZ2V0aW1lX0Jvb3QgfHwge307XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19zdXBwb3J0ZWRfdmFsdWUodmFsdWUpIHtcclxuXHRcdHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gJ3RydWUnIHx8IHZhbHVlID09PSAxIHx8IHZhbHVlID09PSAnMSc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19wYWNrX3N1cHBvcnRlZChmaWVsZCkge1xyXG5cdFx0dmFyIGJvb3QgPSBnZXRfYm9vdCgpO1xyXG5cdFx0aWYgKGJvb3QgJiYgdHlwZW9mIGJvb3QuaXNfc3VwcG9ydGVkICE9PSAndW5kZWZpbmVkJykge1xyXG5cdFx0XHRyZXR1cm4gaXNfc3VwcG9ydGVkX3ZhbHVlKGJvb3QuaXNfc3VwcG9ydGVkKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBpc19zdXBwb3J0ZWRfdmFsdWUoZmllbGQgJiYgZmllbGQuaXNfc3VwcG9ydGVkKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZ3JhZGVfdGV4dChmaWVsZCkge1xyXG5cdFx0dmFyIGJvb3QgPSBnZXRfYm9vdCgpO1xyXG5cdFx0cmV0dXJuIFN0cmluZygoYm9vdCAmJiBib290LnVwZ3JhZGVfdGV4dCkgfHwgKGZpZWxkICYmIGZpZWxkLnVwZ3JhZGVfdGV4dCkgfHwgJ1RoaXMgZmllbGQgaXMgYXZhaWxhYmxlIG9ubHkgaW4gQm9va2luZyBDYWxlbmRhciBCdXNpbmVzcyBNZWRpdW0gb3IgaGlnaGVyIHZlcnNpb25zLicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX3Nsb3RzKHJhdykge1xyXG5cdFx0dmFyIGJhc2UgPSBkZWZhdWx0X3Nsb3RzKCk7XHJcblx0XHR2YXIgb3V0ID0ge307XHJcblx0XHR2YXIgcGFyc2VkID0gcmF3O1xyXG5cclxuXHRcdGlmICh0eXBlb2YgcGFyc2VkID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHBhcnNlZCA9IEpTT04ucGFyc2UocGFyc2VkKTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdHBhcnNlZCA9IHt9O1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRpZiAoIXBhcnNlZCB8fCB0eXBlb2YgcGFyc2VkICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KHBhcnNlZCkpIHtcclxuXHRcdFx0cGFyc2VkID0ge307XHJcblx0XHR9XHJcblxyXG5cdFx0ZGF5X29yZGVyKCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XHJcblx0XHRcdHZhciByYW5nZXMgPSBBcnJheS5pc0FycmF5KHBhcnNlZFtrZXldKSA/IHBhcnNlZFtrZXldIDogYmFzZVtrZXldO1xyXG5cdFx0XHRvdXRba2V5XSA9IHNhbml0aXplX3JhbmdlcyhyYW5nZXMpO1xyXG5cdFx0fSk7XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2FuaXRpemVfcmFuZ2VzKHJhbmdlcykge1xyXG5cdFx0dmFyIG91dCA9IFtdO1xyXG5cdFx0KHJhbmdlcyB8fCBbXSkuZm9yRWFjaChmdW5jdGlvbiAocmFuZ2UpIHtcclxuXHRcdFx0dmFyIGZyb20gPSByYW5nZSAmJiByYW5nZS5mcm9tID8gU3RyaW5nKHJhbmdlLmZyb20pIDogJyc7XHJcblx0XHRcdHZhciB0byA9IHJhbmdlICYmIHJhbmdlLnRvID8gU3RyaW5nKHJhbmdlLnRvKSA6ICcnO1xyXG5cdFx0XHR2YXIgZnJvbV9taW4gPSB0aW1lX3RvX21pbihmcm9tKTtcclxuXHRcdFx0dmFyIHRvX21pbiA9IHRpbWVfdG9fbWluKHRvKTtcclxuXHRcdFx0aWYgKGZyb21fbWluID09IG51bGwgfHwgdG9fbWluID09IG51bGwgfHwgdG9fbWluIDw9IGZyb21fbWluKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdG91dC5wdXNoKHsgZnJvbTogbWluX3RvX3RpbWUoZnJvbV9taW4pLCB0bzogbWluX3RvX3RpbWUodG9fbWluKSB9KTtcclxuXHRcdH0pO1xyXG5cdFx0b3V0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuXHRcdFx0cmV0dXJuIHRpbWVfdG9fbWluKGEuZnJvbSkgLSB0aW1lX3RvX21pbihiLmZyb20pO1xyXG5cdFx0fSk7XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYnVpbGRfcm93X21pbnV0ZXMoZnJvbV9taW4sIHRvX21pbiwgc3RlcCkge1xyXG5cdFx0dmFyIG91dCA9IFtdO1xyXG5cdFx0Zm9yICh2YXIgbSA9IGZyb21fbWluOyBtIDwgdG9fbWluOyBtICs9IHN0ZXApIHtcclxuXHRcdFx0b3V0LnB1c2gobSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbWludXRlc190b19zdGVwX3Nsb3RzKG1pbnV0ZXMsIHN0ZXApIHtcclxuXHRcdHZhciBvdXQgPSBbXTtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShtaW51dGVzKSB8fCAhbWludXRlcy5sZW5ndGgpIHtcclxuXHRcdFx0cmV0dXJuIG91dDtcclxuXHRcdH1cclxuXHRcdG1pbnV0ZXMuc29ydChmdW5jdGlvbiAoYSwgYikge1xyXG5cdFx0XHRyZXR1cm4gYSAtIGI7XHJcblx0XHR9KTtcclxuXHRcdG1pbnV0ZXMuZm9yRWFjaChmdW5jdGlvbiAobWludXRlKSB7XHJcblx0XHRcdG91dC5wdXNoKHsgZnJvbTogbWluX3RvX3RpbWUobWludXRlKSwgdG86IG1pbl90b190aW1lKG1pbnV0ZSArIHN0ZXApIH0pO1xyXG5cdFx0fSk7XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmFuZ2VzX3RvX3NldChyYW5nZXMsIHN0ZXAsIGZyb21fbWluLCB0b19taW4pIHtcclxuXHRcdHZhciBzZXQgPSB7fTtcclxuXHRcdChyYW5nZXMgfHwgW10pLmZvckVhY2goZnVuY3Rpb24gKHJhbmdlKSB7XHJcblx0XHRcdHZhciBhID0gdGltZV90b19taW4ocmFuZ2UuZnJvbSk7XHJcblx0XHRcdHZhciBiID0gdGltZV90b19taW4ocmFuZ2UudG8pO1xyXG5cdFx0XHRpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCB8fCBiIDw9IGEpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Zm9yICh2YXIgbSA9IGE7IG0gPCBiOyBtICs9IHN0ZXApIHtcclxuXHRcdFx0XHRpZiAobSA+PSBmcm9tX21pbiAmJiBtIDwgdG9fbWluKSB7XHJcblx0XHRcdFx0XHRzZXRbbV0gPSB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0XHRyZXR1cm4gc2V0O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3N0YXRlKHBhbmVsKSB7XHJcblx0XHR2YXIgc3RhcnRfZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pbnNwZWN0b3Ita2V5PVwic3RhcnRfdGltZVwiXScpO1xyXG5cdFx0dmFyIGVuZF9lbCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJlbmRfdGltZVwiXScpO1xyXG5cdFx0dmFyIHN0ZXBfZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pbnNwZWN0b3Ita2V5PVwic3RlcF9taW51dGVzXCJdJyk7XHJcblx0XHR2YXIgc3RhcnRfbWluID0gdGltZV90b19taW4oKHN0YXJ0X2VsICYmIHN0YXJ0X2VsLnZhbHVlKSB8fCAnMTA6MDAnKTtcclxuXHRcdHZhciBlbmRfbWluID0gdGltZV90b19taW4oKGVuZF9lbCAmJiBlbmRfZWwudmFsdWUpIHx8ICcyMDowMCcpO1xyXG5cdFx0dmFyIHN0ZXAgPSBub3JtYWxpemVfc3RlcCgoc3RlcF9lbCAmJiBzdGVwX2VsLnZhbHVlKSB8fCA2MCk7XHJcblx0XHRpZiAoc3RhcnRfbWluID09IG51bGwpIHtcclxuXHRcdFx0c3RhcnRfbWluID0gMTAgKiA2MDtcclxuXHRcdH1cclxuXHRcdGlmIChlbmRfbWluID09IG51bGwpIHtcclxuXHRcdFx0ZW5kX21pbiA9IDIwICogNjA7XHJcblx0XHR9XHJcblx0XHRpZiAoZW5kX21pbiA8PSBzdGFydF9taW4pIHtcclxuXHRcdFx0ZW5kX21pbiA9IE1hdGgubWluKDE0NDAsIHN0YXJ0X21pbiArIHN0ZXApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHsgc3RhcnRfbWluOiBzdGFydF9taW4sIGVuZF9taW46IGVuZF9taW4sIHN0ZXA6IHN0ZXAgfTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVtaXRfY2hhbmdlKGVsKSB7XHJcblx0XHRpZiAoIWVsKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHRyeSB7XHJcblx0XHRcdGlmICh3LmpRdWVyeSkge1xyXG5cdFx0XHRcdHcualF1ZXJ5KGVsKS50cmlnZ2VyKCdpbnB1dCcpLnRyaWdnZXIoJ2NoYW5nZScpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcblx0XHRcdGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG5cdFx0fSBjYXRjaCAoZSkge31cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlbmRlcl9ncmlkX3Jvd3MocGFuZWwpIHtcclxuXHRcdHZhciBib2R5ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2JvZHknKTtcclxuXHRcdGlmICghYm9keSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgc3RhdGUgPSBnZXRfc3RhdGUocGFuZWwpO1xyXG5cdFx0dmFyIHRlbXBsYXRlID0gKHcud3AgJiYgdy53cC50ZW1wbGF0ZSkgPyB3LndwLnRlbXBsYXRlKCd3cGJjLWJmYi13ZWVrZGF5LXJhbmdldGltZS1yb3cnKSA6IG51bGw7XHJcblx0XHRib2R5LmlubmVySFRNTCA9ICcnO1xyXG5cdFx0YnVpbGRfcm93X21pbnV0ZXMoc3RhdGUuc3RhcnRfbWluLCBzdGF0ZS5lbmRfbWluLCBzdGF0ZS5zdGVwKS5mb3JFYWNoKGZ1bmN0aW9uIChtaW51dGUpIHtcclxuXHRcdFx0dmFyIGh0bWwgPSB0ZW1wbGF0ZSA/IHRlbXBsYXRlKHsgbWludXRlOiBtaW51dGUsIGxhYmVsOiBtaW5fdG9fdGltZShtaW51dGUpIH0pIDogJyc7XHJcblx0XHRcdHZhciB3cmFwID0gZC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuXHRcdFx0d3JhcC5pbm5lckhUTUwgPSBodG1sO1xyXG5cdFx0XHRpZiAod3JhcC5maXJzdEVsZW1lbnRDaGlsZCkge1xyXG5cdFx0XHRcdGJvZHkuYXBwZW5kQ2hpbGQod3JhcC5maXJzdEVsZW1lbnRDaGlsZCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGFpbnRfc2xvdHMocGFuZWwsIHNsb3RzKSB7XHJcblx0XHR2YXIgc3RhdGUgPSBnZXRfc3RhdGUocGFuZWwpO1xyXG5cdFx0dmFyIGJvZHkgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfYm9keScpO1xyXG5cdFx0aWYgKCFib2R5KSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGRheV9vcmRlcigpLmZvckVhY2goZnVuY3Rpb24gKGRheV9rZXkpIHtcclxuXHRcdFx0dmFyIHNldCA9IHJhbmdlc190b19zZXQoc2xvdHNbZGF5X2tleV0gfHwgW10sIHN0YXRlLnN0ZXAsIHN0YXRlLnN0YXJ0X21pbiwgc3RhdGUuZW5kX21pbik7XHJcblx0XHRcdGJvZHkucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3RbZGF0YS1kYXk9XCInICsgZGF5X2tleSArICdcIl0nKS5mb3JFYWNoKGZ1bmN0aW9uIChjZWxsKSB7XHJcblx0XHRcdFx0dmFyIG1pbnV0ZSA9IHBhcnNlSW50KGNlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLW1pbnV0ZScpLCAxMCk7XHJcblx0XHRcdFx0Y2VsbC5jbGFzc0xpc3QudG9nZ2xlKCdpcy1vbicsICEhc2V0W21pbnV0ZV0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVhZF9zbG90cyhwYW5lbCkge1xyXG5cdFx0dmFyIHN0YXRlID0gZ2V0X3N0YXRlKHBhbmVsKTtcclxuXHRcdHZhciBib2R5ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2JvZHknKTtcclxuXHRcdHZhciBvdXQgPSB7fTtcclxuXHRcdGlmICghYm9keSkge1xyXG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX3Nsb3RzKHt9KTtcclxuXHRcdH1cclxuXHRcdGRheV9vcmRlcigpLmZvckVhY2goZnVuY3Rpb24gKGRheV9rZXkpIHtcclxuXHRcdFx0dmFyIG1pbnV0ZXMgPSBbXTtcclxuXHRcdFx0Ym9keS5xdWVyeVNlbGVjdG9yQWxsKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tc2xvdFtkYXRhLWRheT1cIicgKyBkYXlfa2V5ICsgJ1wiXS5pcy1vbicpLmZvckVhY2goZnVuY3Rpb24gKGNlbGwpIHtcclxuXHRcdFx0XHRtaW51dGVzLnB1c2gocGFyc2VJbnQoY2VsbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbWludXRlJyksIDEwKSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRvdXRbZGF5X2tleV0gPSBtaW51dGVzX3RvX3N0ZXBfc2xvdHMobWludXRlcywgc3RhdGUuc3RlcCk7XHJcblx0XHR9KTtcclxuXHRcdHJldHVybiBvdXQ7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwZXJzaXN0X3Nsb3RzKHBhbmVsKSB7XHJcblx0XHR2YXIgc3RhdGVfZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtd2Vla2RheS1zbG90cy1qc29uJyk7XHJcblx0XHRpZiAoIXN0YXRlX2VsKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciBzbG90cyA9IHJlYWRfc2xvdHMocGFuZWwpO1xyXG5cdFx0c3RhdGVfZWwudmFsdWUgPSBKU09OLnN0cmluZ2lmeShzbG90cyk7XHJcblx0XHRlbWl0X2NoYW5nZShzdGF0ZV9lbCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0b2dnbGVfcmVjdChwYW5lbCwgZnJvbV9kYXlfaWR4LCB0b19kYXlfaWR4LCBmcm9tX21pbiwgdG9fbWluLCBtb2RlKSB7XHJcblx0XHR2YXIgZGF5cyA9IGRheV9vcmRlcigpO1xyXG5cdFx0dmFyIGJvZHkgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfYm9keScpO1xyXG5cdFx0aWYgKCFib2R5KSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciBkYXlfc3RhcnQgPSBNYXRoLm1pbihmcm9tX2RheV9pZHgsIHRvX2RheV9pZHgpO1xyXG5cdFx0dmFyIGRheV9lbmQgPSBNYXRoLm1heChmcm9tX2RheV9pZHgsIHRvX2RheV9pZHgpO1xyXG5cdFx0dmFyIG1pbl9zdGFydCA9IE1hdGgubWluKGZyb21fbWluLCB0b19taW4pO1xyXG5cdFx0dmFyIG1pbl9lbmQgPSBNYXRoLm1heChmcm9tX21pbiwgdG9fbWluKTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gZGF5X3N0YXJ0OyBpIDw9IGRheV9lbmQ7IGkrKykge1xyXG5cdFx0XHR2YXIgZGF5X2tleSA9IGRheXNbaV07XHJcblx0XHRcdGJvZHkucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3RbZGF0YS1kYXk9XCInICsgZGF5X2tleSArICdcIl0nKS5mb3JFYWNoKGZ1bmN0aW9uIChjZWxsKSB7XHJcblx0XHRcdFx0dmFyIG1pbnV0ZSA9IHBhcnNlSW50KGNlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLW1pbnV0ZScpLCAxMCk7XHJcblx0XHRcdFx0aWYgKG1pbnV0ZSA8IG1pbl9zdGFydCB8fCBtaW51dGUgPiBtaW5fZW5kKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmIChtb2RlID09PSAnb24nKSB7XHJcblx0XHRcdFx0XHRjZWxsLmNsYXNzTGlzdC5hZGQoJ2lzLW9uJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNlbGwuY2xhc3NMaXN0LnJlbW92ZSgnaXMtb24nKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYmluZF9ncmlkKHBhbmVsKSB7XHJcblx0XHRpZiAoIXBhbmVsIHx8IHBhbmVsLl9fd3BiY193ZWVrZGF5X3JhbmdldGltZV9pbml0ZWQpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0cGFuZWwuX193cGJjX3dlZWtkYXlfcmFuZ2V0aW1lX2luaXRlZCA9IHRydWU7XHJcblxyXG5cdFx0dmFyIHN0YXRlX2VsID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLXdlZWtkYXktc2xvdHMtanNvbicpO1xyXG5cdFx0dmFyIHNsb3RzID0gbm9ybWFsaXplX3Nsb3RzKHN0YXRlX2VsID8gc3RhdGVfZWwudmFsdWUgOiB7fSk7XHJcblxyXG5cdFx0ZnVuY3Rpb24gcmVidWlsZCgpIHtcclxuXHRcdFx0dmFyIGN1cnJlbnQgPSByZWFkX3Nsb3RzKHBhbmVsKTtcclxuXHRcdFx0cmVuZGVyX2dyaWRfcm93cyhwYW5lbCk7XHJcblx0XHRcdHBhaW50X3Nsb3RzKHBhbmVsLCBjdXJyZW50KTtcclxuXHRcdFx0cGVyc2lzdF9zbG90cyhwYW5lbCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmVuZGVyX2dyaWRfcm93cyhwYW5lbCk7XHJcblx0XHRwYWludF9zbG90cyhwYW5lbCwgc2xvdHMpO1xyXG5cdFx0cGVyc2lzdF9zbG90cyhwYW5lbCk7XHJcblxyXG5cdFx0cGFuZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtaW5zcGVjdG9yLWtleT1cInN0YXJ0X3RpbWVcIl0sIFtkYXRhLWluc3BlY3Rvci1rZXk9XCJlbmRfdGltZVwiXSwgW2RhdGEtaW5zcGVjdG9yLWtleT1cInN0ZXBfbWludXRlc1wiXScpLmZvckVhY2goZnVuY3Rpb24gKGVsKSB7XHJcblx0XHRcdGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHJlYnVpbGQpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0cGFuZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbGVuLWdyb3VwXSBbZGF0YS1sZW4tcmFuZ2VdJykuZm9yRWFjaChmdW5jdGlvbiAocmFuZ2UpIHtcclxuXHRcdFx0cmFuZ2UuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0dmFyIGdyb3VwID0gcmFuZ2UuY2xvc2VzdCgnW2RhdGEtbGVuLWdyb3VwXScpO1xyXG5cdFx0XHRcdHZhciBudW0gPSBncm91cCAmJiBncm91cC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1sZW4tdmFsdWVdJyk7XHJcblx0XHRcdFx0aWYgKG51bSkge1xyXG5cdFx0XHRcdFx0bnVtLnZhbHVlID0gcmFuZ2UudmFsdWU7XHJcblx0XHRcdFx0XHRlbWl0X2NoYW5nZShudW0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRwYW5lbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1sZW4tZ3JvdXBdIFtkYXRhLWxlbi12YWx1ZV0nKS5mb3JFYWNoKGZ1bmN0aW9uIChudW0pIHtcclxuXHRcdFx0bnVtLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHZhciBncm91cCA9IG51bS5jbG9zZXN0KCdbZGF0YS1sZW4tZ3JvdXBdJyk7XHJcblx0XHRcdFx0dmFyIHJhbmdlID0gZ3JvdXAgJiYgZ3JvdXAucXVlcnlTZWxlY3RvcignW2RhdGEtbGVuLXJhbmdlXScpO1xyXG5cdFx0XHRcdGlmIChyYW5nZSkge1xyXG5cdFx0XHRcdFx0cmFuZ2UudmFsdWUgPSBudW0udmFsdWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHZhciBib2R5ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2JvZHknKTtcclxuXHRcdHZhciBkcmFnID0gbnVsbDtcclxuXHRcdGlmIChib2R5KSB7XHJcblx0XHRcdGJvZHkuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZnVuY3Rpb24gKGV2KSB7XHJcblx0XHRcdFx0dmFyIGNlbGwgPSBldi50YXJnZXQgJiYgZXYudGFyZ2V0LmNsb3Nlc3QgJiYgZXYudGFyZ2V0LmNsb3Nlc3QoJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1zbG90Jyk7XHJcblx0XHRcdFx0aWYgKCFjZWxsKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHZhciBkYXlzID0gZGF5X29yZGVyKCk7XHJcblx0XHRcdFx0dmFyIGRheV9rZXkgPSBjZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1kYXknKTtcclxuXHRcdFx0XHR2YXIgZGF5X2lkeCA9IGRheXMuaW5kZXhPZihkYXlfa2V5KTtcclxuXHRcdFx0XHR2YXIgbWludXRlID0gcGFyc2VJbnQoY2VsbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbWludXRlJyksIDEwKTtcclxuXHRcdFx0XHR2YXIgbW9kZSA9IGNlbGwuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1vbicpID8gJ29mZicgOiAnb24nO1xyXG5cdFx0XHRcdGRyYWcgPSB7IGRheV9pZHg6IGRheV9pZHgsIG1pbnV0ZTogbWludXRlLCBtb2RlOiBtb2RlIH07XHJcblx0XHRcdFx0dG9nZ2xlX3JlY3QocGFuZWwsIGRheV9pZHgsIGRheV9pZHgsIG1pbnV0ZSwgbWludXRlLCBtb2RlKTtcclxuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0Ym9keS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW92ZXInLCBmdW5jdGlvbiAoZXYpIHtcclxuXHRcdFx0XHR2YXIgY2VsbCA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCAmJiBldi50YXJnZXQuY2xvc2VzdCgnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3QnKTtcclxuXHRcdFx0XHRpZiAoIWRyYWcgfHwgIWNlbGwpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dmFyIGRheXMgPSBkYXlfb3JkZXIoKTtcclxuXHRcdFx0XHR2YXIgZGF5X2lkeCA9IGRheXMuaW5kZXhPZihjZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1kYXknKSk7XHJcblx0XHRcdFx0dmFyIG1pbnV0ZSA9IHBhcnNlSW50KGNlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLW1pbnV0ZScpLCAxMCk7XHJcblx0XHRcdFx0dG9nZ2xlX3JlY3QocGFuZWwsIGRyYWcuZGF5X2lkeCwgZGF5X2lkeCwgZHJhZy5taW51dGUsIG1pbnV0ZSwgZHJhZy5tb2RlKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0XHR3LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmIChkcmFnKSB7XHJcblx0XHRcdFx0ZHJhZyA9IG51bGw7XHJcblx0XHRcdFx0cGVyc2lzdF9zbG90cyhwYW5lbCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHZhciBjb3B5X2RlZmF1bHQgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtY29weS1kZWZhdWx0Jyk7XHJcblx0XHRpZiAoY29weV9kZWZhdWx0KSB7XHJcblx0XHRcdGNvcHlfZGVmYXVsdC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChldikge1xyXG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0dmFyIGN1cnJlbnQgPSByZWFkX3Nsb3RzKHBhbmVsKTtcclxuXHRcdFx0XHR3ZWVrZGF5X29yZGVyKCkuZm9yRWFjaChmdW5jdGlvbiAoZGF5X2tleSkge1xyXG5cdFx0XHRcdFx0Y3VycmVudFtkYXlfa2V5XSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoY3VycmVudFsnZGVmYXVsdCddIHx8IFtdKSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0cGFpbnRfc2xvdHMocGFuZWwsIGN1cnJlbnQpO1xyXG5cdFx0XHRcdHBlcnNpc3Rfc2xvdHMocGFuZWwpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgY2xlYXJfd2Vla2RheXMgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtY2xlYXItd2Vla2RheXMnKTtcclxuXHRcdGlmIChjbGVhcl93ZWVrZGF5cykge1xyXG5cdFx0XHRjbGVhcl93ZWVrZGF5cy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChldikge1xyXG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0dmFyIGN1cnJlbnQgPSByZWFkX3Nsb3RzKHBhbmVsKTtcclxuXHRcdFx0XHR3ZWVrZGF5X29yZGVyKCkuZm9yRWFjaChmdW5jdGlvbiAoZGF5X2tleSkge1xyXG5cdFx0XHRcdFx0Y3VycmVudFtkYXlfa2V5XSA9IFtdO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHRcdHBhaW50X3Nsb3RzKHBhbmVsLCBjdXJyZW50KTtcclxuXHRcdFx0XHRwZXJzaXN0X3Nsb3RzKHBhbmVsKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGxvY2tlZCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1sb2NrZWQtbmFtZVtkYXRhLWluc3BlY3Rvci1rZXk9XCJuYW1lXCJdJyk7XHJcblx0XHRpZiAobG9ja2VkKSB7XHJcblx0XHRcdGxvY2tlZC52YWx1ZSA9ICdyYW5nZXRpbWUnO1xyXG5cdFx0XHRlbWl0X2NoYW5nZShsb2NrZWQpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGxvY2tlZF9jb25kaXRpb24gPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtbG9ja2VkLWNvbmRpdGlvbi1uYW1lW2RhdGEtaW5zcGVjdG9yLWtleT1cImNvbmRpdGlvbl9uYW1lXCJdJyk7XHJcblx0XHRpZiAobG9ja2VkX2NvbmRpdGlvbikge1xyXG5cdFx0XHRsb2NrZWRfY29uZGl0aW9uLnZhbHVlID0gJ3dlZWtkYXktY29uZGl0aW9uJztcclxuXHRcdFx0ZW1pdF9jaGFuZ2UobG9ja2VkX2NvbmRpdGlvbik7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0cnlfaW5pdF9wYW5lbChyb290KSB7XHJcblx0XHRpZiAoIXJvb3QgfHwgIXJvb3QucXVlcnlTZWxlY3Rvcikge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgcGFuZWwgPSByb290Lm1hdGNoZXMgJiYgcm9vdC5tYXRjaGVzKCcud3BiY19iZmJfX2luc3BlY3Rvcl93ZWVrZGF5X3JhbmdldGltZScpXHJcblx0XHRcdD8gcm9vdFxyXG5cdFx0XHQ6IHJvb3QucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19pbnNwZWN0b3Jfd2Vla2RheV9yYW5nZXRpbWUnKTtcclxuXHRcdGlmIChwYW5lbCkge1xyXG5cdFx0XHRiaW5kX2dyaWQocGFuZWwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd2l0aF9yZWdpc3RyeShjYikge1xyXG5cdFx0dmFyIHRyaWVzID0gMDtcclxuXHRcdChmdW5jdGlvbiBsb29wKCkge1xyXG5cdFx0XHR2YXIgcmVnaXN0cnkgPSAody5XUEJDX0JGQl9Db3JlIHx8IHt9KS5XUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeTtcclxuXHRcdFx0dmFyIGJhc2UgPSAody5XUEJDX0JGQl9Db3JlIHx8IHt9KS5XUEJDX0JGQl9GaWVsZF9CYXNlIHx8ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX1NlbGVjdF9CYXNlO1xyXG5cdFx0XHRpZiAocmVnaXN0cnkgJiYgcmVnaXN0cnkucmVnaXN0ZXIgJiYgYmFzZSkge1xyXG5cdFx0XHRcdGNiKHJlZ2lzdHJ5LCBiYXNlKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKHRyaWVzKysgPCAyMDApIHtcclxuXHRcdFx0XHRzZXRUaW1lb3V0KGxvb3AsIDUwKTtcclxuXHRcdFx0fVxyXG5cdFx0fSkoKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX3JlbmRlcmVyKCkge1xyXG5cdFx0d2l0aF9yZWdpc3RyeShmdW5jdGlvbiAoUmVnaXN0cnksIEJhc2UpIHtcclxuXHRcdFx0Y2xhc3MgV1BCQ19CRkJfRmllbGRfV2Vla2RheV9SYW5nZVRpbWUgZXh0ZW5kcyBCYXNlIHtcclxuXHRcdFx0XHRzdGF0aWMgdGVtcGxhdGVfaWQgPSAnd3BiYy1iZmItZmllbGQtd2Vla2RheV9yYW5nZXRpbWUnO1xyXG5cdFx0XHRcdHN0YXRpYyBraW5kID0gJ3dlZWtkYXlfcmFuZ2V0aW1lJztcclxuXHRcdFx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRcdFx0dmFyIGJhc2UgPSBzdXBlci5nZXRfZGVmYXVsdHMgPyBzdXBlci5nZXRfZGVmYXVsdHMoKSA6IHt9O1xyXG5cdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIGJhc2UsIHtcclxuXHRcdFx0XHRcdFx0dHlwZTogJ3dlZWtkYXlfcmFuZ2V0aW1lJyxcclxuXHRcdFx0XHRcdFx0dXNhZ2Vfa2V5OiAncmFuZ2V0aW1lJyxcclxuXHRcdFx0XHRcdFx0bGFiZWw6ICdUaW1lIHNsb3RzJyxcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3JhbmdldGltZScsXHJcblx0XHRcdFx0XHRcdHJlcXVpcmVkOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjb25kaXRpb25fbmFtZTogJ3dlZWtkYXktY29uZGl0aW9uJyxcclxuXHRcdFx0XHRcdFx0aXNfc3VwcG9ydGVkOiBpc19wYWNrX3N1cHBvcnRlZCgpLFxyXG5cdFx0XHRcdFx0XHR1cGdyYWRlX3RleHQ6IHVwZ3JhZGVfdGV4dCgpLFxyXG5cdFx0XHRcdFx0XHRzdGFydF90aW1lOiAnMTA6MDAnLFxyXG5cdFx0XHRcdFx0XHRlbmRfdGltZTogJzIwOjAwJyxcclxuXHRcdFx0XHRcdFx0c3RlcF9taW51dGVzOiA2MCxcclxuXHRcdFx0XHRcdFx0c2xvdHM6IGRlZmF1bHRfc2xvdHMoKSxcclxuXHRcdFx0XHRcdFx0bWluX3dpZHRoOiAnMzIwcHgnXHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0c3RhdGljIHJlbmRlcihlbCwgZGF0YSwgY3R4KSB7XHJcblx0XHRcdFx0XHRkYXRhID0gZGF0YSB8fCB7fTtcclxuXHRcdFx0XHRcdGRhdGEuaXNfc3VwcG9ydGVkID0gaXNfcGFja19zdXBwb3J0ZWQoZGF0YSk7XHJcblx0XHRcdFx0XHRkYXRhLnVwZ3JhZGVfdGV4dCA9IHVwZ3JhZGVfdGV4dChkYXRhKTtcclxuXHRcdFx0XHRcdGlmIChzdXBlci5yZW5kZXIpIHtcclxuXHRcdFx0XHRcdFx0c3VwZXIucmVuZGVyKGVsLCBkYXRhLCBjdHgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKGVsICYmIGVsLmRhdGFzZXQpIHtcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5pc19zdXBwb3J0ZWQgPSBkYXRhLmlzX3N1cHBvcnRlZCA/ICd0cnVlJyA6ICdmYWxzZSc7XHJcblx0XHRcdFx0XHRcdGVsLmRhdGFzZXQudXBncmFkZV90ZXh0ID0gZGF0YS51cGdyYWRlX3RleHQgfHwgJyc7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBjdHgpIHtcclxuXHRcdFx0XHRcdGlmIChzdXBlci5vbl9maWVsZF9kcm9wKSB7XHJcblx0XHRcdFx0XHRcdHN1cGVyLm9uX2ZpZWxkX2Ryb3AoZGF0YSwgZWwsIGN0eCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoZGF0YSkge1xyXG5cdFx0XHRcdFx0XHRkYXRhLnVzYWdlX2tleSA9ICdyYW5nZXRpbWUnO1xyXG5cdFx0XHRcdFx0XHRkYXRhLm5hbWUgPSAncmFuZ2V0aW1lJztcclxuXHRcdFx0XHRcdFx0ZGF0YS5jb25kaXRpb25fbmFtZSA9ICd3ZWVrZGF5LWNvbmRpdGlvbic7XHJcblx0XHRcdFx0XHRcdGRhdGEubXVsdGlwbGUgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0ZGF0YS5pc19zdXBwb3J0ZWQgPSBpc19wYWNrX3N1cHBvcnRlZChkYXRhKTtcclxuXHRcdFx0XHRcdFx0ZGF0YS51cGdyYWRlX3RleHQgPSB1cGdyYWRlX3RleHQoZGF0YSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoZWwgJiYgZWwuZGF0YXNldCkge1xyXG5cdFx0XHRcdFx0XHRlbC5kYXRhc2V0LnVzYWdlX2tleSA9ICdyYW5nZXRpbWUnO1xyXG5cdFx0XHRcdFx0XHRlbC5kYXRhc2V0Lm5hbWUgPSAncmFuZ2V0aW1lJztcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5hdXRvbmFtZSA9ICcwJztcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5mcmVzaCA9ICcwJztcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lX3VzZXJfdG91Y2hlZCA9ICcxJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRSZWdpc3RyeS5yZWdpc3Rlcignd2Vla2RheV9yYW5nZXRpbWUnLCBXUEJDX0JGQl9GaWVsZF9XZWVrZGF5X1JhbmdlVGltZSk7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHt9XHJcblx0XHRcdHcuV1BCQ19CRkJfRmllbGRfV2Vla2RheV9SYW5nZVRpbWUgPSBXUEJDX0JGQl9GaWVsZF9XZWVrZGF5X1JhbmdlVGltZTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0cmVnaXN0ZXJfcmVuZGVyZXIoKTtcclxuXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLCBmdW5jdGlvbiAoZXYpIHtcclxuXHRcdHRyeV9pbml0X3BhbmVsKGV2ICYmIGV2LmRldGFpbCAmJiBldi5kZXRhaWwucGFuZWwpO1xyXG5cdH0pO1xyXG5cclxuXHRpZiAoZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dHJ5X2luaXRfcGFuZWwoZCk7XHJcblx0XHR9KTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dHJ5X2luaXRfcGFuZWwoZCk7XHJcblx0fVxyXG5cclxuXHR0cnkge1xyXG5cdFx0dmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoZnVuY3Rpb24gKG11dHMpIHtcclxuXHRcdFx0bXV0cy5mb3JFYWNoKGZ1bmN0aW9uIChtdXQpIHtcclxuXHRcdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKG11dC5hZGRlZE5vZGVzIHx8IFtdLCBmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRcdFx0aWYgKG5vZGUubm9kZVR5cGUgPT09IDEpIHtcclxuXHRcdFx0XHRcdFx0dHJ5X2luaXRfcGFuZWwobm9kZSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRvYnNlcnZlci5vYnNlcnZlKGQuZG9jdW1lbnRFbGVtZW50LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcclxuXHR9IGNhdGNoIChlKSB7fVxyXG5cclxuXHRmdW5jdGlvbiBlc2NhcGVfc2hvcnRjb2RlKHZhbHVlKSB7XHJcblx0XHR2YXIgc2FuaXRpemUgPSAody5XUEJDX0JGQl9Db3JlIHx8IHt9KS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdGlmIChzYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSkge1xyXG5cdFx0XHRyZXR1cm4gc2FuaXRpemUuZXNjYXBlX2Zvcl9zaG9ydGNvZGUoU3RyaW5nKHZhbHVlIHx8ICcnKSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gU3RyaW5nKHZhbHVlIHx8ICcnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JykucmVwbGFjZSgvXFxyP1xcbi9nLCAnICcpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZXNjYXBlX2h0bWwodmFsdWUpIHtcclxuXHRcdHZhciBzYW5pdGl6ZSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cdFx0aWYgKHNhbml0aXplLmVzY2FwZV9odG1sKSB7XHJcblx0XHRcdHJldHVybiBzYW5pdGl6ZS5lc2NhcGVfaHRtbChTdHJpbmcodmFsdWUgfHwgJycpKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBTdHJpbmcodmFsdWUgfHwgJycpLnJlcGxhY2UoL1smPD5cIiddL2csIGZ1bmN0aW9uIChjaCkge1xyXG5cdFx0XHRyZXR1cm4geyAnJic6ICcmYW1wOycsICc8JzogJyZsdDsnLCAnPic6ICcmZ3Q7JywgJ1wiJzogJyZxdW90OycsIFwiJ1wiOiAnJiMwMzk7JyB9W2NoXTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2FuaXRpemVfY29uZGl0aW9uX25hbWUodmFsdWUpIHtcclxuXHRcdHZhciBzYW5pdGl6ZSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cdFx0aWYgKHNhbml0aXplLnRvX3Rva2VuKSB7XHJcblx0XHRcdHJldHVybiBzYW5pdGl6ZS50b190b2tlbihTdHJpbmcodmFsdWUgfHwgJ3dlZWtkYXktY29uZGl0aW9uJykpIHx8ICd3ZWVrZGF5LWNvbmRpdGlvbic7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gU3RyaW5nKHZhbHVlIHx8ICd3ZWVrZGF5LWNvbmRpdGlvbicpLnJlcGxhY2UoL1teMC05QS1aYS16Oi5fLV0vZywgJycpIHx8ICd3ZWVrZGF5LWNvbmRpdGlvbic7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzbG90c19zaWduYXR1cmUocmFuZ2VzKSB7XHJcblx0XHRyZXR1cm4gc2FuaXRpemVfcmFuZ2VzKHJhbmdlcykubWFwKGZ1bmN0aW9uIChyYW5nZSkge1xyXG5cdFx0XHRyZXR1cm4gcmFuZ2UuZnJvbSArICctJyArIHJhbmdlLnRvO1xyXG5cdFx0fSkuam9pbignfCcpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2xvdF90b2tlbnMocmFuZ2VzKSB7XHJcblx0XHRyZXR1cm4gc2FuaXRpemVfcmFuZ2VzKHJhbmdlcykubWFwKGZ1bmN0aW9uIChyYW5nZSkge1xyXG5cdFx0XHR2YXIgdmFsdWUgPSByYW5nZS5mcm9tICsgJyAtICcgKyByYW5nZS50bztcclxuXHRcdFx0cmV0dXJuICdcIicgKyBlc2NhcGVfc2hvcnRjb2RlKHZhbHVlKSArICdcIic7XHJcblx0XHR9KS5qb2luKCcgJyk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3ZWVrZGF5X3RvX2NvbmRpdGlvbl92YWx1ZShkYXlfa2V5KSB7XHJcblx0XHRyZXR1cm4gZGF5X2tleSA9PT0gJzcnID8gJzAnIDogZGF5X2tleTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNvbmRpdGlvbl9ibG9jayhjb25kaXRpb25fbmFtZSwgdmFsdWUsIHNlbGVjdF9zaG9ydGNvZGUpIHtcclxuXHRcdHJldHVybiBbXHJcblx0XHRcdCdbY29uZGl0aW9uIG5hbWU9XCInICsgY29uZGl0aW9uX25hbWUgKyAnXCIgdHlwZT1cIndlZWtkYXlcIiB2YWx1ZT1cIicgKyB2YWx1ZSArICdcIl0nLFxyXG5cdFx0XHQnXFx0JyArIHNlbGVjdF9zaG9ydGNvZGUsXHJcblx0XHRcdCdbL2NvbmRpdGlvbl0nXHJcblx0XHRdLmpvaW4oJ1xcbicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYnVpbGRfd3JhcHBlcl9hdHRycyhmaWVsZCwgY3R4KSB7XHJcblx0XHR2YXIgc2FuaXRpemUgPSAody5XUEJDX0JGQl9Db3JlIHx8IHt9KS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdHZhciBhdHRycyA9ICcnO1xyXG5cdFx0dmFyIGNscyA9IGZpZWxkICYmIChmaWVsZC5jc3NjbGFzcyB8fCBmaWVsZC5jbGFzcyB8fCBmaWVsZC5jbGFzc05hbWUpID8gU3RyaW5nKGZpZWxkLmNzc2NsYXNzIHx8IGZpZWxkLmNsYXNzIHx8IGZpZWxkLmNsYXNzTmFtZSkgOiAnJztcclxuXHRcdHZhciBodG1sX2lkID0gZmllbGQgJiYgZmllbGQuaHRtbF9pZCA/IFN0cmluZyhmaWVsZC5odG1sX2lkKSA6ICcnO1xyXG5cdFx0dmFyIG1pbl93aWR0aCA9IGZpZWxkICYmIGZpZWxkLm1pbl93aWR0aCA/IFN0cmluZyhmaWVsZC5taW5fd2lkdGgpLnRyaW0oKSA6ICcnO1xyXG5cclxuXHRcdGlmIChzYW5pdGl6ZS5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0KSB7XHJcblx0XHRcdGNscyA9IHNhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoY2xzKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGNscyA9IGNscy5yZXBsYWNlKC9bXjAtOUEtWmEtel8gLV0vZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHNhbml0aXplLnNhbml0aXplX2h0bWxfaWQpIHtcclxuXHRcdFx0aHRtbF9pZCA9IHNhbml0aXplLnNhbml0aXplX2h0bWxfaWQoaHRtbF9pZCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRodG1sX2lkID0gaHRtbF9pZC5yZXBsYWNlKC9bXjAtOUEtWmEtel8tXS9nLCAnJyk7XHJcblx0XHR9XHJcblx0XHRpZiAoaHRtbF9pZCAmJiBjdHggJiYgY3R4LnVzZWRJZHMpIHtcclxuXHRcdFx0dmFyIHVuaXF1ZV9pZCA9IGh0bWxfaWQ7XHJcblx0XHRcdHZhciBzdWZmaXggPSAyO1xyXG5cdFx0XHR3aGlsZSAoY3R4LnVzZWRJZHMuaGFzKHVuaXF1ZV9pZCkpIHtcclxuXHRcdFx0XHR1bmlxdWVfaWQgPSBodG1sX2lkICsgJ18nICsgc3VmZml4Kys7XHJcblx0XHRcdH1cclxuXHRcdFx0Y3R4LnVzZWRJZHMuYWRkKHVuaXF1ZV9pZCk7XHJcblx0XHRcdGh0bWxfaWQgPSB1bmlxdWVfaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGh0bWxfaWQpIHtcclxuXHRcdFx0YXR0cnMgKz0gJyBpZD1cIicgKyBlc2NhcGVfaHRtbChodG1sX2lkKSArICdcIic7XHJcblx0XHR9XHJcblx0XHRpZiAoY2xzKSB7XHJcblx0XHRcdGF0dHJzICs9ICcgY2xhc3M9XCInICsgZXNjYXBlX2h0bWwoY2xzKSArICdcIic7XHJcblx0XHR9XHJcblx0XHRpZiAobWluX3dpZHRoKSB7XHJcblx0XHRcdG1pbl93aWR0aCA9IG1pbl93aWR0aC5yZXBsYWNlKC9bXjAtOUEtWmEtei4lKCkgLCstXS9nLCAnJyk7XHJcblx0XHRcdGlmIChtaW5fd2lkdGgpIHtcclxuXHRcdFx0XHRhdHRycyArPSAnIHN0eWxlPVwibWluLXdpZHRoOicgKyBlc2NhcGVfaHRtbChtaW5fd2lkdGgpICsgJztcIic7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBhdHRycztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdyYXBfYm9keV9pZl9uZWVkZWQoZmllbGQsIGJvZHksIGN0eCkge1xyXG5cdFx0dmFyIGF0dHJzID0gYnVpbGRfd3JhcHBlcl9hdHRycyhmaWVsZCwgY3R4KTtcclxuXHRcdGlmICghYXR0cnMpIHtcclxuXHRcdFx0cmV0dXJuIGJvZHk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gJzxkaXYnICsgYXR0cnMgKyAnPlxcbicgKyBib2R5ICsgJ1xcbjwvZGl2Pic7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlbWl0X2xhYmVsX3RoZW5fY2xlYXIoZmllbGQsIGVtaXQsIGJvZHksIGNmZywgY3R4KSB7XHJcblx0XHRjZmcgPSBjZmcgfHwge307XHJcblx0XHR2YXIgYWRkX2xhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xyXG5cdFx0dmFyIGxhYmVsID0gZmllbGQgJiYgdHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyA/IGZpZWxkLmxhYmVsLnRyaW0oKSA6ICcnO1xyXG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHR2YXIgcmVxID0gRXhwICYmIEV4cC5pc19yZXF1aXJlZCAmJiBFeHAuaXNfcmVxdWlyZWQoZmllbGQpID8gJyonIDogJyc7XHJcblx0XHR2YXIgd3JhcHBlZF9ib2R5ID0gd3JhcF9ib2R5X2lmX25lZWRlZChmaWVsZCwgYm9keSwgY3R4KTtcclxuXHJcblx0XHRpZiAobGFiZWwgJiYgYWRkX2xhYmVscykge1xyXG5cdFx0XHRlbWl0KCc8bD4nICsgZXNjYXBlX2h0bWwobGFiZWwpICsgcmVxICsgJzwvbD4nKTtcclxuXHRcdFx0ZW1pdCgnPGRpdiBzdHlsZT1cImNsZWFyOmJvdGg7ZmxleDogMSAxIDEwMCU7XCI+PC9kaXY+Jyk7XHJcblx0XHRcdGVtaXQod3JhcHBlZF9ib2R5KTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0ZW1pdCh3cmFwcGVkX2JvZHkpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9fc2xvdHNfbWFya3VwKCkge1xyXG5cdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cIndwYmNfbm9fdGltZV9zbG90c1wiPk5vIHRpbWUgc2xvdHMgYXZhaWxhYmxlLjwvc3Bhbj4nO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2VsZWN0X3Nob3J0Y29kZV9mb3Jfc2xvdHMoZmllbGQsIHJhbmdlcykge1xyXG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHR2YXIgcmVxID0gKEV4cCAmJiBFeHAuaXNfcmVxdWlyZWQgJiYgRXhwLmlzX3JlcXVpcmVkKGZpZWxkKSkgPyAnKicgOiAnJztcclxuXHRcdHZhciB0b2tlbnMgPSBzbG90X3Rva2VucyhyYW5nZXMpO1xyXG5cdFx0aWYgKCF0b2tlbnMpIHtcclxuXHRcdFx0cmV0dXJuIG5vX3Nsb3RzX21hcmt1cCgpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICdbc2VsZWN0Ym94JyArIHJlcSArICcgcmFuZ2V0aW1lICcgKyB0b2tlbnMgKyAnXSc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSB7XHJcblx0XHR2YXIgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcclxuXHRcdGlmICghRXhwIHx8IHR5cGVvZiBFeHAucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHR5cGVvZiBFeHAuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEV4cC5oYXNfZXhwb3J0ZXIoJ3dlZWtkYXlfcmFuZ2V0aW1lJykpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdEV4cC5yZWdpc3Rlcignd2Vla2RheV9yYW5nZXRpbWUnLCBmdW5jdGlvbiAoZmllbGQsIGVtaXQsIGV4dHJhcykge1xyXG5cdFx0XHRleHRyYXMgPSBleHRyYXMgfHwge307XHJcblx0XHRcdHZhciBjZmcgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cdFx0XHR2YXIgY3R4ID0gZXh0cmFzLmN0eCB8fCB7fTtcclxuXHJcblx0XHRcdGlmICghaXNfcGFja19zdXBwb3J0ZWQoZmllbGQpKSB7XHJcblx0XHRcdFx0ZW1pdF9sYWJlbF90aGVuX2NsZWFyKGZpZWxkLCBlbWl0LCAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX191cGdyYWRlX3JlcXVpcmVkXCI+JyArIGVzY2FwZV9odG1sKHVwZ3JhZGVfdGV4dChmaWVsZCkpICsgJzwvZGl2PicsIGNmZywgY3R4KTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBjb25kaXRpb25fbmFtZSA9ICd3ZWVrZGF5LWNvbmRpdGlvbic7XHJcblx0XHRcdHZhciBzbG90cyA9IG5vcm1hbGl6ZV9zbG90cyhmaWVsZCAmJiBmaWVsZC5zbG90cyk7XHJcblx0XHRcdHZhciBkZWZhdWx0X3JhbmdlcyA9IHNsb3RzWydkZWZhdWx0J10gfHwgW107XHJcblx0XHRcdHZhciBibG9ja3MgPSBbXTtcclxuXHJcblx0XHRcdGJsb2Nrcy5wdXNoKGNvbmRpdGlvbl9ibG9jayhjb25kaXRpb25fbmFtZSwgJyonLCBzZWxlY3Rfc2hvcnRjb2RlX2Zvcl9zbG90cyhmaWVsZCwgZGVmYXVsdF9yYW5nZXMpKSk7XHJcblxyXG5cdFx0XHR2YXIgZ3JvdXBzID0ge307XHJcblx0XHRcdHZhciBkZWZhdWx0X3NpZyA9IHNsb3RzX3NpZ25hdHVyZShkZWZhdWx0X3Jhbmdlcyk7XHJcblx0XHRcdHdlZWtkYXlfb3JkZXIoKS5mb3JFYWNoKGZ1bmN0aW9uIChkYXlfa2V5KSB7XHJcblx0XHRcdFx0dmFyIHJhbmdlcyA9IHNsb3RzW2RheV9rZXldIHx8IFtdO1xyXG5cdFx0XHRcdHZhciBzaWcgPSBzbG90c19zaWduYXR1cmUocmFuZ2VzKTtcclxuXHRcdFx0XHRpZiAoc2lnID09PSBkZWZhdWx0X3NpZykge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIWdyb3Vwc1tzaWddKSB7XHJcblx0XHRcdFx0XHRncm91cHNbc2lnXSA9IHsgZGF5czogW10sIHJhbmdlczogcmFuZ2VzIH07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGdyb3Vwc1tzaWddLmRheXMucHVzaCh3ZWVrZGF5X3RvX2NvbmRpdGlvbl92YWx1ZShkYXlfa2V5KSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0T2JqZWN0LmtleXMoZ3JvdXBzKS5mb3JFYWNoKGZ1bmN0aW9uIChzaWcpIHtcclxuXHRcdFx0XHR2YXIgZ3JvdXAgPSBncm91cHNbc2lnXTtcclxuXHRcdFx0XHRibG9ja3MucHVzaChjb25kaXRpb25fYmxvY2soXHJcblx0XHRcdFx0XHRjb25kaXRpb25fbmFtZSxcclxuXHRcdFx0XHRcdGdyb3VwLmRheXMuam9pbignLCcpLFxyXG5cdFx0XHRcdFx0c2VsZWN0X3Nob3J0Y29kZV9mb3Jfc2xvdHMoZmllbGQsIGdyb3VwLnJhbmdlcylcclxuXHRcdFx0XHQpKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHR2YXIgYm9keSA9IGJsb2Nrcy5qb2luKCdcXG4nKTtcclxuXHRcdFx0ZW1pdF9sYWJlbF90aGVuX2NsZWFyKGZpZWxkLCBlbWl0LCBib2R5LCBjZmcsIGN0eCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGlmICh3LldQQkNfQkZCX0V4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0V4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRyZWdpc3Rlcl9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmJmYjpleHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX2Jvb2tpbmdfZm9ybV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfYm9va2luZ19kYXRhX2V4cG9ydGVyKCkge1xyXG5cdFx0dmFyIEMgPSB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlcjtcclxuXHRcdGlmICghQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRpZiAodHlwZW9mIEMuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEMuaGFzX2V4cG9ydGVyKCd3ZWVrZGF5X3JhbmdldGltZScpKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdEMucmVnaXN0ZXIoJ3dlZWtkYXlfcmFuZ2V0aW1lJywgZnVuY3Rpb24gKGZpZWxkLCBlbWl0LCBleHRyYXMpIHtcclxuXHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cdFx0XHR2YXIgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHRcdFx0dmFyIGxhYmVsID0gKGZpZWxkICYmIHR5cGVvZiBmaWVsZC5sYWJlbCA9PT0gJ3N0cmluZycgJiYgZmllbGQubGFiZWwudHJpbSgpKSA/IGZpZWxkLmxhYmVsLnRyaW0oKSA6ICdUaW1lIHNsb3RzJztcclxuXHRcdFx0aWYgKCFpc19wYWNrX3N1cHBvcnRlZChmaWVsZCkpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKEMuZW1pdF9saW5lX2JvbGRfZmllbGQpIHtcclxuXHRcdFx0XHRDLmVtaXRfbGluZV9ib2xkX2ZpZWxkKGVtaXQsIGxhYmVsLCAncmFuZ2V0aW1lJywgY2ZnKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbWl0KCc8Yj4nICsgZXNjYXBlX2h0bWwobGFiZWwpICsgJzwvYj46IDxmPltyYW5nZXRpbWVdPC9mPjxicj4nKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRpZiAody5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRyZWdpc3Rlcl9ib29raW5nX2RhdGFfZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfYm9va2luZ19kYXRhX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSk7XHJcblx0fVxyXG5cclxuXHR2YXIgY3NzID0gJydcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lX3ByZXZpZXd7Ym9yZGVyOjFweCBzb2xpZCAjZTNlM2UzO2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6OHB4O2JhY2tncm91bmQ6I2ZmZjt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVfcHJldmlld19fcm93e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2dhcDo4cHg7bWFyZ2luOjNweCAwO30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9wcmV2aWV3X19kYXl7d2lkdGg6NTJweDtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo2MDA7b3BhY2l0eTouODt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVfcHJldmlld19fc2xvdHN7ZmxleDoxO30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9iYWRnZXtkaXNwbGF5OmlubGluZS1ibG9jaztib3JkZXI6MXB4IHNvbGlkICNkNWQ1ZDU7Ym9yZGVyLXJhZGl1czoxMnB4O3BhZGRpbmc6MnB4IDhweDttYXJnaW46MCA0cHggNHB4IDA7Zm9udC1zaXplOjExcHg7YmFja2dyb3VuZDojZjhmOGY4O30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9iYWRnZS0tZW1wdHl7b3BhY2l0eTouNjt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX3Rvb2xiYXJ7ZGlzcGxheTpmbGV4O2dhcDo4cHg7bWFyZ2luOjhweCAwO30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfcm9vdHtib3JkZXI6MXB4IHNvbGlkICNkZGQ7Ym9yZGVyLXJhZGl1czo2cHg7b3ZlcmZsb3c6YXV0bzttYXJnaW4tdG9wOjZweDt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2hlYWQsLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX3Jvd3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjc2cHggOTJweCByZXBlYXQoNyw2NHB4KTttaW4td2lkdGg6NjE2cHg7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxse2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNlZWU7Ym9yZGVyLXJpZ2h0OjFweCBzb2xpZCAjZjRmNGY0O2JveC1zaXppbmc6Ym9yZGVyLWJveDttaW4taGVpZ2h0OjI0cHg7cGFkZGluZzo0cHg7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1jb3JuZXIsLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLWRheSwud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tdGltZXtiYWNrZ3JvdW5kOiNmYWZhZmE7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1kYXl7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC13ZWlnaHQ6NjAwO30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tdGltZXtmb250LXZhcmlhbnQtbnVtZXJpYzp0YWJ1bGFyLW51bXM7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1zbG90e2N1cnNvcjpjcm9zc2hhaXI7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1zbG90LmlzLW9ue2JhY2tncm91bmQ6cmdiYSgwLDEyMCwyMTIsLjE0KTtvdXRsaW5lOjFweCBzb2xpZCByZ2JhKDAsMTIwLDIxMiwuMzUpO30nO1xyXG5cclxuXHR0cnkge1xyXG5cdFx0dmFyIHN0eWxlID0gZC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xyXG5cdFx0c3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7XHJcblx0XHRzdHlsZS5hcHBlbmRDaGlsZChkLmNyZWF0ZVRleHROb2RlKGNzcykpO1xyXG5cdFx0ZC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcclxuXHR9IGNhdGNoIChlKSB7fVxyXG59KSh3aW5kb3csIGRvY3VtZW50KTtcclxuIl0sIm1hcHBp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QUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxFQUM5QjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLEVBQzlCO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxFQUM5QjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLENBQzlCO01BQ0QsR0FBRyxFQUFFLENBQ0o7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxFQUM5QjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLENBQzlCO01BQ0QsR0FBRyxFQUFFLENBQ0o7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxFQUM5QjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLENBQzlCO01BQ0QsR0FBRyxFQUFFLENBQ0o7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxFQUM5QjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLEVBQzlCO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsQ0FDOUI7TUFDRCxHQUFHLEVBQUUsQ0FDSjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLEVBQzlCO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxDQUM5QjtNQUNELEdBQUcsRUFBRSxDQUNKO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxFQUM5QjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLEVBQzlCO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxDQUM5QjtNQUNELEdBQUcsRUFBRSxDQUNKO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxFQUM5QjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLEVBQzlCO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxDQUM5QjtNQUNELEdBQUcsRUFBRSxDQUNKO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQyxFQUM5QjtRQUFFRCxJQUFJLEVBQUUsT0FBTztRQUFFQyxFQUFFLEVBQUU7TUFBUSxDQUFDLEVBQzlCO1FBQUVELElBQUksRUFBRSxPQUFPO1FBQUVDLEVBQUUsRUFBRTtNQUFRLENBQUMsRUFDOUI7UUFBRUQsSUFBSSxFQUFFLE9BQU87UUFBRUMsRUFBRSxFQUFFO01BQVEsQ0FBQztJQUVoQyxDQUFDO0VBQ0Y7RUFFQSxTQUFTQyxRQUFRQSxDQUFBLEVBQUc7SUFD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
