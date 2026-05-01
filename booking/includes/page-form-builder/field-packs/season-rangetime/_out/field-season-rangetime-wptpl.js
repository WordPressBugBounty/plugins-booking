"use strict";

// WPBC BFB Pack: Season time slots.
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
  function get_boot() {
    return w.WPBC_BFB_season_rangetime_Boot || {};
  }
  function get_seasons() {
    var boot = get_boot();
    var raw = Array.isArray(boot.seasons) ? boot.seasons : [];
    return raw.map(function (season) {
      var id = String(season && season.id || '').replace(/[^0-9]/g, '');
      var key = String(season && season.key || 's' + id).replace(/[^0-9A-Za-z_-]/g, '');
      var title = String(season && season.title || '').trim();
      if (!id || !key || !title) {
        return null;
      }
      return {
        id: id,
        key: key,
        title: title,
        user_id: season && season.user_id ? String(season.user_id) : ''
      };
    }).filter(Boolean);
  }
  function season_columns() {
    return [{
      key: 'default',
      title: 'Default'
    }].concat(get_seasons());
  }
  function day_order() {
    return season_columns().map(function (season) {
      return season.key;
    });
  }
  function season_order() {
    return get_seasons().map(function (season) {
      return season.key;
    });
  }
  function season_by_key(key) {
    var seasons = get_seasons();
    for (var i = 0; i < seasons.length; i++) {
      if (seasons[i].key === key) {
        return seasons[i];
      }
    }
    return null;
  }
  function default_slots() {
    var defaults = {};
    var base = [{
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
    }];
    day_order().forEach(function (key) {
      defaults[key] = JSON.parse(JSON.stringify(base));
    });
    return defaults;
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
  function no_seasons_text(field) {
    var boot = get_boot();
    return String(boot && boot.no_seasons || field && field.no_seasons || 'No season filters are available for the current user.');
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
    var template = w.wp && w.wp.template ? w.wp.template('wpbc-bfb-season-rangetime-row') : null;
    body.innerHTML = '';
    build_row_minutes(state.start_min, state.end_min, state.step).forEach(function (minute) {
      var html = template ? template({
        minute: minute,
        label: min_to_time(minute),
        columns: season_columns()
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
    if (!panel || panel.__wpbc_season_rangetime_inited) {
      return;
    }
    panel.__wpbc_season_rangetime_inited = true;
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
        season_order().forEach(function (day_key) {
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
        season_order().forEach(function (day_key) {
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
      locked_condition.value = 'season-condition';
      emit_change(locked_condition);
    }
  }
  function try_init_panel(root) {
    if (!root || !root.querySelector) {
      return;
    }
    var panel = root.matches && root.matches('.wpbc_bfb__inspector_season_rangetime') ? root : root.querySelector('.wpbc_bfb__inspector_season_rangetime');
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
      class WPBC_BFB_Field_season_rangetime extends Base {
        static template_id = 'wpbc-bfb-field-season_rangetime';
        static kind = 'season_rangetime';
        static get_defaults() {
          var base = super.get_defaults ? super.get_defaults() : {};
          return Object.assign({}, base, {
            type: 'season_rangetime',
            usage_key: 'rangetime',
            label: 'Time slots',
            name: 'rangetime',
            required: true,
            condition_name: 'season-condition',
            is_supported: is_pack_supported(),
            upgrade_text: upgrade_text(),
            no_seasons: no_seasons_text(),
            seasons: get_seasons(),
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
          data.no_seasons = no_seasons_text(data);
          data.seasons = get_seasons();
          data.slots = normalize_slots(data.slots);
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
            data.condition_name = 'season-condition';
            data.multiple = false;
            data.is_supported = is_pack_supported(data);
            data.upgrade_text = upgrade_text(data);
            data.no_seasons = no_seasons_text(data);
            data.seasons = get_seasons();
            data.slots = normalize_slots(data.slots);
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
        Registry.register('season_rangetime', WPBC_BFB_Field_season_rangetime);
      } catch (e) {}
      w.WPBC_BFB_Field_season_rangetime = WPBC_BFB_Field_season_rangetime;
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
      return sanitize.to_token(String(value || 'season-condition')) || 'season-condition';
    }
    return String(value || 'season-condition').replace(/[^0-9A-Za-z:._-]/g, '') || 'season-condition';
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
  function season_to_condition_value(season_key) {
    var season = season_by_key(season_key);
    return season ? season.title : '';
  }
  function condition_block(condition_name, value, select_shortcode) {
    return ['[condition name="' + condition_name + '" type="season" value="' + escape_shortcode(value) + '"]', '\t' + select_shortcode, '[/condition]'].join('\n');
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
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('season_rangetime')) {
      return;
    }
    Exp.register('season_rangetime', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var ctx = extras.ctx || {};
      if (!is_pack_supported(field)) {
        emit_label_then_clear(field, emit, '<div class="wpbc_bfb__upgrade_required">' + escape_html(upgrade_text(field)) + '</div>', cfg, ctx);
        return;
      }
      var condition_name = 'season-condition';
      var slots = normalize_slots(field && field.slots);
      var default_ranges = slots['default'] || [];
      var blocks = [];
      blocks.push(condition_block(condition_name, '*', select_shortcode_for_slots(field, default_ranges)));
      var default_sig = slots_signature(default_ranges);
      season_order().forEach(function (day_key) {
        var ranges = slots[day_key] || [];
        var sig = slots_signature(ranges);
        if (sig === default_sig) {
          return;
        }
        var season_value = season_to_condition_value(day_key);
        if (!season_value) {
          return;
        }
        blocks.push(condition_block(condition_name, season_value, select_shortcode_for_slots(field, ranges)));
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
    if (typeof C.has_exporter === 'function' && C.has_exporter('season_rangetime')) {
      return;
    }
    C.register('season_rangetime', function (field, emit, extras) {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc2Vhc29uLXJhbmdldGltZS9fb3V0L2ZpZWxkLXNlYXNvbi1yYW5nZXRpbWUtd3B0cGwuanMiLCJuYW1lcyI6WyJ3IiwiZCIsIkNvcmUiLCJXUEJDX0JGQl9Db3JlIiwicGFkMiIsIm4iLCJwYXJzZUludCIsInRpbWVfdG9fbWluIiwidCIsIm0iLCJtYXRjaCIsImgiLCJtaW4iLCJtaW5fdG9fdGltZSIsIm1pbnMiLCJpc0Zpbml0ZSIsIk1hdGgiLCJmbG9vciIsIm5vcm1hbGl6ZV9zdGVwIiwic3RlcCIsInMiLCJnZXRfYm9vdCIsIldQQkNfQkZCX3NlYXNvbl9yYW5nZXRpbWVfQm9vdCIsImdldF9zZWFzb25zIiwiYm9vdCIsInJhdyIsIkFycmF5IiwiaXNBcnJheSIsInNlYXNvbnMiLCJtYXAiLCJzZWFzb24iLCJpZCIsIlN0cmluZyIsInJlcGxhY2UiLCJrZXkiLCJ0aXRsZSIsInRyaW0iLCJ1c2VyX2lkIiwiZmlsdGVyIiwiQm9vbGVhbiIsInNlYXNvbl9jb2x1bW5zIiwiY29uY2F0IiwiZGF5X29yZGVyIiwic2Vhc29uX29yZGVyIiwic2Vhc29uX2J5X2tleSIsImkiLCJsZW5ndGgiLCJkZWZhdWx0X3Nsb3RzIiwiZGVmYXVsdHMiLCJiYXNlIiwiZnJvbSIsInRvIiwiZm9yRWFjaCIsIkpTT04iLCJwYXJzZSIsInN0cmluZ2lmeSIsImlzX3N1cHBvcnRlZF92YWx1ZSIsInZhbHVlIiwiaXNfcGFja19zdXBwb3J0ZWQiLCJmaWVsZCIsImlzX3N1cHBvcnRlZCIsInVwZ3JhZGVfdGV4dCIsIm5vX3NlYXNvbnNfdGV4dCIsIm5vX3NlYXNvbnMiLCJub3JtYWxpemVfc2xvdHMiLCJvdXQiLCJwYXJzZWQiLCJlIiwicmFuZ2VzIiwic2FuaXRpemVfcmFuZ2VzIiwicmFuZ2UiLCJmcm9tX21pbiIsInRvX21pbiIsInB1c2giLCJzb3J0IiwiYSIsImIiLCJidWlsZF9yb3dfbWludXRlcyIsIm1pbnV0ZXNfdG9fc3RlcF9zbG90cyIsIm1pbnV0ZXMiLCJtaW51dGUiLCJyYW5nZXNfdG9fc2V0Iiwic2V0IiwiZ2V0X3N0YXRlIiwicGFuZWwiLCJzdGFydF9lbCIsInF1ZXJ5U2VsZWN0b3IiLCJlbmRfZWwiLCJzdGVwX2VsIiwic3RhcnRfbWluIiwiZW5kX21pbiIsImVtaXRfY2hhbmdlIiwiZWwiLCJqUXVlcnkiLCJ0cmlnZ2VyIiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiYnViYmxlcyIsInJlbmRlcl9ncmlkX3Jvd3MiLCJib2R5Iiwic3RhdGUiLCJ0ZW1wbGF0ZSIsIndwIiwiaW5uZXJIVE1MIiwiaHRtbCIsImxhYmVsIiwiY29sdW1ucyIsIndyYXAiLCJjcmVhdGVFbGVtZW50IiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJhcHBlbmRDaGlsZCIsInBhaW50X3Nsb3RzIiwic2xvdHMiLCJkYXlfa2V5IiwicXVlcnlTZWxlY3RvckFsbCIsImNlbGwiLCJnZXRBdHRyaWJ1dGUiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJyZWFkX3Nsb3RzIiwicGVyc2lzdF9zbG90cyIsInN0YXRlX2VsIiwidG9nZ2xlX3JlY3QiLCJmcm9tX2RheV9pZHgiLCJ0b19kYXlfaWR4IiwibW9kZSIsImRheXMiLCJkYXlfc3RhcnQiLCJkYXlfZW5kIiwibWF4IiwibWluX3N0YXJ0IiwibWluX2VuZCIsImFkZCIsInJlbW92ZSIsImJpbmRfZ3JpZCIsIl9fd3BiY19zZWFzb25fcmFuZ2V0aW1lX2luaXRlZCIsInJlYnVpbGQiLCJjdXJyZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsImdyb3VwIiwiY2xvc2VzdCIsIm51bSIsImRyYWciLCJldiIsInRhcmdldCIsImRheV9pZHgiLCJpbmRleE9mIiwiY29udGFpbnMiLCJwcmV2ZW50RGVmYXVsdCIsImNvcHlfZGVmYXVsdCIsImNsZWFyX3dlZWtkYXlzIiwibG9ja2VkIiwibG9ja2VkX2NvbmRpdGlvbiIsInRyeV9pbml0X3BhbmVsIiwicm9vdCIsIm1hdGNoZXMiLCJ3aXRoX3JlZ2lzdHJ5IiwiY2IiLCJ0cmllcyIsImxvb3AiLCJyZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiV1BCQ19CRkJfRmllbGRfQmFzZSIsIldQQkNfQkZCX1NlbGVjdF9CYXNlIiwicmVnaXN0ZXIiLCJzZXRUaW1lb3V0IiwicmVnaXN0ZXJfcmVuZGVyZXIiLCJSZWdpc3RyeSIsIkJhc2UiLCJXUEJDX0JGQl9GaWVsZF9zZWFzb25fcmFuZ2V0aW1lIiwidGVtcGxhdGVfaWQiLCJraW5kIiwiZ2V0X2RlZmF1bHRzIiwiT2JqZWN0IiwiYXNzaWduIiwidHlwZSIsInVzYWdlX2tleSIsIm5hbWUiLCJyZXF1aXJlZCIsImNvbmRpdGlvbl9uYW1lIiwic3RhcnRfdGltZSIsImVuZF90aW1lIiwic3RlcF9taW51dGVzIiwibWluX3dpZHRoIiwicmVuZGVyIiwiZGF0YSIsImN0eCIsImRhdGFzZXQiLCJvbl9maWVsZF9kcm9wIiwibXVsdGlwbGUiLCJhdXRvbmFtZSIsImZyZXNoIiwibmFtZV91c2VyX3RvdWNoZWQiLCJkZXRhaWwiLCJyZWFkeVN0YXRlIiwib2JzZXJ2ZXIiLCJNdXRhdGlvbk9ic2VydmVyIiwibXV0cyIsIm11dCIsInByb3RvdHlwZSIsImNhbGwiLCJhZGRlZE5vZGVzIiwibm9kZSIsIm5vZGVUeXBlIiwib2JzZXJ2ZSIsImRvY3VtZW50RWxlbWVudCIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJlc2NhcGVfc2hvcnRjb2RlIiwic2FuaXRpemUiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY2FwZV9mb3Jfc2hvcnRjb2RlIiwiZXNjYXBlX2h0bWwiLCJjaCIsInNhbml0aXplX2NvbmRpdGlvbl9uYW1lIiwidG9fdG9rZW4iLCJzbG90c19zaWduYXR1cmUiLCJqb2luIiwic2xvdF90b2tlbnMiLCJzZWFzb25fdG9fY29uZGl0aW9uX3ZhbHVlIiwic2Vhc29uX2tleSIsImNvbmRpdGlvbl9ibG9jayIsInNlbGVjdF9zaG9ydGNvZGUiLCJidWlsZF93cmFwcGVyX2F0dHJzIiwiYXR0cnMiLCJjbHMiLCJjc3NjbGFzcyIsImNsYXNzIiwiY2xhc3NOYW1lIiwiaHRtbF9pZCIsInNhbml0aXplX2Nzc19jbGFzc2xpc3QiLCJzYW5pdGl6ZV9odG1sX2lkIiwidXNlZElkcyIsInVuaXF1ZV9pZCIsInN1ZmZpeCIsImhhcyIsIndyYXBfYm9keV9pZl9uZWVkZWQiLCJlbWl0X2xhYmVsX3RoZW5fY2xlYXIiLCJlbWl0IiwiY2ZnIiwiYWRkX2xhYmVscyIsImFkZExhYmVscyIsIkV4cCIsIldQQkNfQkZCX0V4cG9ydGVyIiwicmVxIiwiaXNfcmVxdWlyZWQiLCJ3cmFwcGVkX2JvZHkiLCJub19zbG90c19tYXJrdXAiLCJzZWxlY3Rfc2hvcnRjb2RlX2Zvcl9zbG90cyIsInRva2VucyIsInJlZ2lzdGVyX2Jvb2tpbmdfZm9ybV9leHBvcnRlciIsImhhc19leHBvcnRlciIsImV4dHJhcyIsImRlZmF1bHRfcmFuZ2VzIiwiYmxvY2tzIiwiZGVmYXVsdF9zaWciLCJzaWciLCJzZWFzb25fdmFsdWUiLCJvbmNlIiwicmVnaXN0ZXJfYm9va2luZ19kYXRhX2V4cG9ydGVyIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsImVtaXRfbGluZV9ib2xkX2ZpZWxkIiwiY3NzIiwic3R5bGUiLCJjcmVhdGVUZXh0Tm9kZSIsImhlYWQiLCJ3aW5kb3ciLCJkb2N1bWVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3NlYXNvbi1yYW5nZXRpbWUvX3NyYy9maWVsZC1zZWFzb24tcmFuZ2V0aW1lLXdwdHBsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIFdQQkMgQkZCIFBhY2s6IFNlYXNvbiB0aW1lIHNsb3RzLlxyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cclxuXHRmdW5jdGlvbiBwYWQyKG4pIHtcclxuXHRcdG4gPSBwYXJzZUludChuLCAxMCk7XHJcblx0XHRyZXR1cm4gKG4gPCAxMCA/ICcwJyA6ICcnKSArIG47XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0aW1lX3RvX21pbih0KSB7XHJcblx0XHRpZiAoIXQgfHwgdHlwZW9mIHQgIT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdFx0dmFyIG0gPSB0Lm1hdGNoKC9eKFxcZHsxLDJ9KTooXFxkezJ9KSQvKTtcclxuXHRcdGlmICghbSkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHRcdHZhciBoID0gcGFyc2VJbnQobVsxXSwgMTApO1xyXG5cdFx0dmFyIG1pbiA9IHBhcnNlSW50KG1bMl0sIDEwKTtcclxuXHRcdGlmIChoIDwgMCB8fCBoID4gMjMgfHwgbWluIDwgMCB8fCBtaW4gPiA1OSkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBoICogNjAgKyBtaW47XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBtaW5fdG9fdGltZShtaW5zKSB7XHJcblx0XHR2YXIgbSA9IHBhcnNlSW50KG1pbnMsIDEwKTtcclxuXHRcdGlmICghaXNGaW5pdGUobSkpIHtcclxuXHRcdFx0bSA9IDA7XHJcblx0XHR9XHJcblx0XHRtID0gKChtICUgMTQ0MCkgKyAxNDQwKSAlIDE0NDA7XHJcblx0XHRyZXR1cm4gcGFkMihNYXRoLmZsb29yKG0gLyA2MCkpICsgJzonICsgcGFkMihtICUgNjApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX3N0ZXAoc3RlcCkge1xyXG5cdFx0dmFyIHMgPSBwYXJzZUludChzdGVwLCAxMCk7XHJcblx0XHRpZiAoIWlzRmluaXRlKHMpIHx8IHMgPCA1KSB7XHJcblx0XHRcdHMgPSA1O1xyXG5cdFx0fVxyXG5cdFx0aWYgKHMgPiAxODApIHtcclxuXHRcdFx0cyA9IDE4MDtcclxuXHRcdH1cclxuXHRcdHJldHVybiBzO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2Jvb3QoKSB7XHJcblx0XHRyZXR1cm4gdy5XUEJDX0JGQl9zZWFzb25fcmFuZ2V0aW1lX0Jvb3QgfHwge307XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc2Vhc29ucygpIHtcclxuXHRcdHZhciBib290ID0gZ2V0X2Jvb3QoKTtcclxuXHRcdHZhciByYXcgPSBBcnJheS5pc0FycmF5KGJvb3Quc2Vhc29ucykgPyBib290LnNlYXNvbnMgOiBbXTtcclxuXHRcdHJldHVybiByYXcubWFwKGZ1bmN0aW9uIChzZWFzb24pIHtcclxuXHRcdFx0dmFyIGlkID0gU3RyaW5nKChzZWFzb24gJiYgc2Vhc29uLmlkKSB8fCAnJykucmVwbGFjZSgvW14wLTldL2csICcnKTtcclxuXHRcdFx0dmFyIGtleSA9IFN0cmluZygoc2Vhc29uICYmIHNlYXNvbi5rZXkpIHx8ICgncycgKyBpZCkpLnJlcGxhY2UoL1teMC05QS1aYS16Xy1dL2csICcnKTtcclxuXHRcdFx0dmFyIHRpdGxlID0gU3RyaW5nKChzZWFzb24gJiYgc2Vhc29uLnRpdGxlKSB8fCAnJykudHJpbSgpO1xyXG5cdFx0XHRpZiAoIWlkIHx8ICFrZXkgfHwgIXRpdGxlKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRpZDogaWQsXHJcblx0XHRcdFx0a2V5OiBrZXksXHJcblx0XHRcdFx0dGl0bGU6IHRpdGxlLFxyXG5cdFx0XHRcdHVzZXJfaWQ6IHNlYXNvbiAmJiBzZWFzb24udXNlcl9pZCA/IFN0cmluZyhzZWFzb24udXNlcl9pZCkgOiAnJ1xyXG5cdFx0XHR9O1xyXG5cdFx0fSkuZmlsdGVyKEJvb2xlYW4pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2Vhc29uX2NvbHVtbnMoKSB7XHJcblx0XHRyZXR1cm4gW3sga2V5OiAnZGVmYXVsdCcsIHRpdGxlOiAnRGVmYXVsdCcgfV0uY29uY2F0KGdldF9zZWFzb25zKCkpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZGF5X29yZGVyKCkge1xyXG5cdFx0cmV0dXJuIHNlYXNvbl9jb2x1bW5zKCkubWFwKGZ1bmN0aW9uIChzZWFzb24pIHtcclxuXHRcdFx0cmV0dXJuIHNlYXNvbi5rZXk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNlYXNvbl9vcmRlcigpIHtcclxuXHRcdHJldHVybiBnZXRfc2Vhc29ucygpLm1hcChmdW5jdGlvbiAoc2Vhc29uKSB7XHJcblx0XHRcdHJldHVybiBzZWFzb24ua2V5O1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZWFzb25fYnlfa2V5KGtleSkge1xyXG5cdFx0dmFyIHNlYXNvbnMgPSBnZXRfc2Vhc29ucygpO1xyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBzZWFzb25zLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGlmIChzZWFzb25zW2ldLmtleSA9PT0ga2V5KSB7XHJcblx0XHRcdFx0cmV0dXJuIHNlYXNvbnNbaV07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZGVmYXVsdF9zbG90cygpIHtcclxuXHRcdHZhciBkZWZhdWx0cyA9IHt9O1xyXG5cdFx0dmFyIGJhc2UgPSBbXHJcblx0XHRcdHsgZnJvbTogJzEwOjAwJywgdG86ICcxMTowMCcgfSxcclxuXHRcdFx0eyBmcm9tOiAnMTE6MDAnLCB0bzogJzEyOjAwJyB9LFxyXG5cdFx0XHR7IGZyb206ICcxMjowMCcsIHRvOiAnMTM6MDAnIH0sXHJcblx0XHRcdHsgZnJvbTogJzEzOjAwJywgdG86ICcxNDowMCcgfSxcclxuXHRcdFx0eyBmcm9tOiAnMTQ6MDAnLCB0bzogJzE1OjAwJyB9LFxyXG5cdFx0XHR7IGZyb206ICcxNTowMCcsIHRvOiAnMTY6MDAnIH0sXHJcblx0XHRcdHsgZnJvbTogJzE2OjAwJywgdG86ICcxNzowMCcgfSxcclxuXHRcdFx0eyBmcm9tOiAnMTc6MDAnLCB0bzogJzE4OjAwJyB9XHJcblx0XHRdO1xyXG5cdFx0ZGF5X29yZGVyKCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XHJcblx0XHRcdGRlZmF1bHRzW2tleV0gPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGJhc2UpKTtcclxuXHRcdH0pO1xyXG5cdFx0cmV0dXJuIGRlZmF1bHRzO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfc3VwcG9ydGVkX3ZhbHVlKHZhbHVlKSB7XHJcblx0XHRyZXR1cm4gdmFsdWUgPT09IHRydWUgfHwgdmFsdWUgPT09ICd0cnVlJyB8fCB2YWx1ZSA9PT0gMSB8fCB2YWx1ZSA9PT0gJzEnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfcGFja19zdXBwb3J0ZWQoZmllbGQpIHtcclxuXHRcdHZhciBib290ID0gZ2V0X2Jvb3QoKTtcclxuXHRcdGlmIChib290ICYmIHR5cGVvZiBib290LmlzX3N1cHBvcnRlZCAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdFx0cmV0dXJuIGlzX3N1cHBvcnRlZF92YWx1ZShib290LmlzX3N1cHBvcnRlZCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gaXNfc3VwcG9ydGVkX3ZhbHVlKGZpZWxkICYmIGZpZWxkLmlzX3N1cHBvcnRlZCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGdyYWRlX3RleHQoZmllbGQpIHtcclxuXHRcdHZhciBib290ID0gZ2V0X2Jvb3QoKTtcclxuXHRcdHJldHVybiBTdHJpbmcoKGJvb3QgJiYgYm9vdC51cGdyYWRlX3RleHQpIHx8IChmaWVsZCAmJiBmaWVsZC51cGdyYWRlX3RleHQpIHx8ICdUaGlzIGZpZWxkIGlzIGF2YWlsYWJsZSBvbmx5IGluIEJvb2tpbmcgQ2FsZW5kYXIgQnVzaW5lc3MgTWVkaXVtIG9yIGhpZ2hlciB2ZXJzaW9ucy4nKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG5vX3NlYXNvbnNfdGV4dChmaWVsZCkge1xyXG5cdFx0dmFyIGJvb3QgPSBnZXRfYm9vdCgpO1xyXG5cdFx0cmV0dXJuIFN0cmluZygoYm9vdCAmJiBib290Lm5vX3NlYXNvbnMpIHx8IChmaWVsZCAmJiBmaWVsZC5ub19zZWFzb25zKSB8fCAnTm8gc2Vhc29uIGZpbHRlcnMgYXJlIGF2YWlsYWJsZSBmb3IgdGhlIGN1cnJlbnQgdXNlci4nKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zbG90cyhyYXcpIHtcclxuXHRcdHZhciBiYXNlID0gZGVmYXVsdF9zbG90cygpO1xyXG5cdFx0dmFyIG91dCA9IHt9O1xyXG5cdFx0dmFyIHBhcnNlZCA9IHJhdztcclxuXHJcblx0XHRpZiAodHlwZW9mIHBhcnNlZCA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRwYXJzZWQgPSBKU09OLnBhcnNlKHBhcnNlZCk7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRwYXJzZWQgPSB7fTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0aWYgKCFwYXJzZWQgfHwgdHlwZW9mIHBhcnNlZCAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShwYXJzZWQpKSB7XHJcblx0XHRcdHBhcnNlZCA9IHt9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGRheV9vcmRlcigpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xyXG5cdFx0XHR2YXIgcmFuZ2VzID0gQXJyYXkuaXNBcnJheShwYXJzZWRba2V5XSkgPyBwYXJzZWRba2V5XSA6IGJhc2Vba2V5XTtcclxuXHRcdFx0b3V0W2tleV0gPSBzYW5pdGl6ZV9yYW5nZXMocmFuZ2VzKTtcclxuXHRcdH0pO1xyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNhbml0aXplX3JhbmdlcyhyYW5nZXMpIHtcclxuXHRcdHZhciBvdXQgPSBbXTtcclxuXHRcdChyYW5nZXMgfHwgW10pLmZvckVhY2goZnVuY3Rpb24gKHJhbmdlKSB7XHJcblx0XHRcdHZhciBmcm9tID0gcmFuZ2UgJiYgcmFuZ2UuZnJvbSA/IFN0cmluZyhyYW5nZS5mcm9tKSA6ICcnO1xyXG5cdFx0XHR2YXIgdG8gPSByYW5nZSAmJiByYW5nZS50byA/IFN0cmluZyhyYW5nZS50bykgOiAnJztcclxuXHRcdFx0dmFyIGZyb21fbWluID0gdGltZV90b19taW4oZnJvbSk7XHJcblx0XHRcdHZhciB0b19taW4gPSB0aW1lX3RvX21pbih0byk7XHJcblx0XHRcdGlmIChmcm9tX21pbiA9PSBudWxsIHx8IHRvX21pbiA9PSBudWxsIHx8IHRvX21pbiA8PSBmcm9tX21pbikge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRvdXQucHVzaCh7IGZyb206IG1pbl90b190aW1lKGZyb21fbWluKSwgdG86IG1pbl90b190aW1lKHRvX21pbikgfSk7XHJcblx0XHR9KTtcclxuXHRcdG91dC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcblx0XHRcdHJldHVybiB0aW1lX3RvX21pbihhLmZyb20pIC0gdGltZV90b19taW4oYi5mcm9tKTtcclxuXHRcdH0pO1xyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGJ1aWxkX3Jvd19taW51dGVzKGZyb21fbWluLCB0b19taW4sIHN0ZXApIHtcclxuXHRcdHZhciBvdXQgPSBbXTtcclxuXHRcdGZvciAodmFyIG0gPSBmcm9tX21pbjsgbSA8IHRvX21pbjsgbSArPSBzdGVwKSB7XHJcblx0XHRcdG91dC5wdXNoKG0pO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1pbnV0ZXNfdG9fc3RlcF9zbG90cyhtaW51dGVzLCBzdGVwKSB7XHJcblx0XHR2YXIgb3V0ID0gW107XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkobWludXRlcykgfHwgIW1pbnV0ZXMubGVuZ3RoKSB7XHJcblx0XHRcdHJldHVybiBvdXQ7XHJcblx0XHR9XHJcblx0XHRtaW51dGVzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuXHRcdFx0cmV0dXJuIGEgLSBiO1xyXG5cdFx0fSk7XHJcblx0XHRtaW51dGVzLmZvckVhY2goZnVuY3Rpb24gKG1pbnV0ZSkge1xyXG5cdFx0XHRvdXQucHVzaCh7IGZyb206IG1pbl90b190aW1lKG1pbnV0ZSksIHRvOiBtaW5fdG9fdGltZShtaW51dGUgKyBzdGVwKSB9KTtcclxuXHRcdH0pO1xyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJhbmdlc190b19zZXQocmFuZ2VzLCBzdGVwLCBmcm9tX21pbiwgdG9fbWluKSB7XHJcblx0XHR2YXIgc2V0ID0ge307XHJcblx0XHQocmFuZ2VzIHx8IFtdKS5mb3JFYWNoKGZ1bmN0aW9uIChyYW5nZSkge1xyXG5cdFx0XHR2YXIgYSA9IHRpbWVfdG9fbWluKHJhbmdlLmZyb20pO1xyXG5cdFx0XHR2YXIgYiA9IHRpbWVfdG9fbWluKHJhbmdlLnRvKTtcclxuXHRcdFx0aWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwgfHwgYiA8PSBhKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGZvciAodmFyIG0gPSBhOyBtIDwgYjsgbSArPSBzdGVwKSB7XHJcblx0XHRcdFx0aWYgKG0gPj0gZnJvbV9taW4gJiYgbSA8IHRvX21pbikge1xyXG5cdFx0XHRcdFx0c2V0W21dID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdFx0cmV0dXJuIHNldDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9zdGF0ZShwYW5lbCkge1xyXG5cdFx0dmFyIHN0YXJ0X2VsID0gcGFuZWwucXVlcnlTZWxlY3RvcignW2RhdGEtaW5zcGVjdG9yLWtleT1cInN0YXJ0X3RpbWVcIl0nKTtcclxuXHRcdHZhciBlbmRfZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1pbnNwZWN0b3Ita2V5PVwiZW5kX3RpbWVcIl0nKTtcclxuXHRcdHZhciBzdGVwX2VsID0gcGFuZWwucXVlcnlTZWxlY3RvcignW2RhdGEtaW5zcGVjdG9yLWtleT1cInN0ZXBfbWludXRlc1wiXScpO1xyXG5cdFx0dmFyIHN0YXJ0X21pbiA9IHRpbWVfdG9fbWluKChzdGFydF9lbCAmJiBzdGFydF9lbC52YWx1ZSkgfHwgJzEwOjAwJyk7XHJcblx0XHR2YXIgZW5kX21pbiA9IHRpbWVfdG9fbWluKChlbmRfZWwgJiYgZW5kX2VsLnZhbHVlKSB8fCAnMjA6MDAnKTtcclxuXHRcdHZhciBzdGVwID0gbm9ybWFsaXplX3N0ZXAoKHN0ZXBfZWwgJiYgc3RlcF9lbC52YWx1ZSkgfHwgNjApO1xyXG5cdFx0aWYgKHN0YXJ0X21pbiA9PSBudWxsKSB7XHJcblx0XHRcdHN0YXJ0X21pbiA9IDEwICogNjA7XHJcblx0XHR9XHJcblx0XHRpZiAoZW5kX21pbiA9PSBudWxsKSB7XHJcblx0XHRcdGVuZF9taW4gPSAyMCAqIDYwO1xyXG5cdFx0fVxyXG5cdFx0aWYgKGVuZF9taW4gPD0gc3RhcnRfbWluKSB7XHJcblx0XHRcdGVuZF9taW4gPSBNYXRoLm1pbigxNDQwLCBzdGFydF9taW4gKyBzdGVwKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB7IHN0YXJ0X21pbjogc3RhcnRfbWluLCBlbmRfbWluOiBlbmRfbWluLCBzdGVwOiBzdGVwIH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlbWl0X2NoYW5nZShlbCkge1xyXG5cdFx0aWYgKCFlbCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAody5qUXVlcnkpIHtcclxuXHRcdFx0XHR3LmpRdWVyeShlbCkudHJpZ2dlcignaW5wdXQnKS50cmlnZ2VyKCdjaGFuZ2UnKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG5cdFx0XHRlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnY2hhbmdlJywgeyBidWJibGVzOiB0cnVlIH0pKTtcclxuXHRcdH0gY2F0Y2ggKGUpIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZW5kZXJfZ3JpZF9yb3dzKHBhbmVsKSB7XHJcblx0XHR2YXIgYm9keSA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9ib2R5Jyk7XHJcblx0XHRpZiAoIWJvZHkpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHN0YXRlID0gZ2V0X3N0YXRlKHBhbmVsKTtcclxuXHRcdHZhciB0ZW1wbGF0ZSA9ICh3LndwICYmIHcud3AudGVtcGxhdGUpID8gdy53cC50ZW1wbGF0ZSgnd3BiYy1iZmItc2Vhc29uLXJhbmdldGltZS1yb3cnKSA6IG51bGw7XHJcblx0XHRib2R5LmlubmVySFRNTCA9ICcnO1xyXG5cdFx0YnVpbGRfcm93X21pbnV0ZXMoc3RhdGUuc3RhcnRfbWluLCBzdGF0ZS5lbmRfbWluLCBzdGF0ZS5zdGVwKS5mb3JFYWNoKGZ1bmN0aW9uIChtaW51dGUpIHtcclxuXHRcdFx0dmFyIGh0bWwgPSB0ZW1wbGF0ZSA/IHRlbXBsYXRlKHsgbWludXRlOiBtaW51dGUsIGxhYmVsOiBtaW5fdG9fdGltZShtaW51dGUpLCBjb2x1bW5zOiBzZWFzb25fY29sdW1ucygpIH0pIDogJyc7XHJcblx0XHRcdHZhciB3cmFwID0gZC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuXHRcdFx0d3JhcC5pbm5lckhUTUwgPSBodG1sO1xyXG5cdFx0XHRpZiAod3JhcC5maXJzdEVsZW1lbnRDaGlsZCkge1xyXG5cdFx0XHRcdGJvZHkuYXBwZW5kQ2hpbGQod3JhcC5maXJzdEVsZW1lbnRDaGlsZCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGFpbnRfc2xvdHMocGFuZWwsIHNsb3RzKSB7XHJcblx0XHR2YXIgc3RhdGUgPSBnZXRfc3RhdGUocGFuZWwpO1xyXG5cdFx0dmFyIGJvZHkgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfYm9keScpO1xyXG5cdFx0aWYgKCFib2R5KSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGRheV9vcmRlcigpLmZvckVhY2goZnVuY3Rpb24gKGRheV9rZXkpIHtcclxuXHRcdFx0dmFyIHNldCA9IHJhbmdlc190b19zZXQoc2xvdHNbZGF5X2tleV0gfHwgW10sIHN0YXRlLnN0ZXAsIHN0YXRlLnN0YXJ0X21pbiwgc3RhdGUuZW5kX21pbik7XHJcblx0XHRcdGJvZHkucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3RbZGF0YS1kYXk9XCInICsgZGF5X2tleSArICdcIl0nKS5mb3JFYWNoKGZ1bmN0aW9uIChjZWxsKSB7XHJcblx0XHRcdFx0dmFyIG1pbnV0ZSA9IHBhcnNlSW50KGNlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLW1pbnV0ZScpLCAxMCk7XHJcblx0XHRcdFx0Y2VsbC5jbGFzc0xpc3QudG9nZ2xlKCdpcy1vbicsICEhc2V0W21pbnV0ZV0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVhZF9zbG90cyhwYW5lbCkge1xyXG5cdFx0dmFyIHN0YXRlID0gZ2V0X3N0YXRlKHBhbmVsKTtcclxuXHRcdHZhciBib2R5ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2JvZHknKTtcclxuXHRcdHZhciBvdXQgPSB7fTtcclxuXHRcdGlmICghYm9keSkge1xyXG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX3Nsb3RzKHt9KTtcclxuXHRcdH1cclxuXHRcdGRheV9vcmRlcigpLmZvckVhY2goZnVuY3Rpb24gKGRheV9rZXkpIHtcclxuXHRcdFx0dmFyIG1pbnV0ZXMgPSBbXTtcclxuXHRcdFx0Ym9keS5xdWVyeVNlbGVjdG9yQWxsKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tc2xvdFtkYXRhLWRheT1cIicgKyBkYXlfa2V5ICsgJ1wiXS5pcy1vbicpLmZvckVhY2goZnVuY3Rpb24gKGNlbGwpIHtcclxuXHRcdFx0XHRtaW51dGVzLnB1c2gocGFyc2VJbnQoY2VsbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbWludXRlJyksIDEwKSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRvdXRbZGF5X2tleV0gPSBtaW51dGVzX3RvX3N0ZXBfc2xvdHMobWludXRlcywgc3RhdGUuc3RlcCk7XHJcblx0XHR9KTtcclxuXHRcdHJldHVybiBvdXQ7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwZXJzaXN0X3Nsb3RzKHBhbmVsKSB7XHJcblx0XHR2YXIgc3RhdGVfZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtd2Vla2RheS1zbG90cy1qc29uJyk7XHJcblx0XHRpZiAoIXN0YXRlX2VsKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciBzbG90cyA9IHJlYWRfc2xvdHMocGFuZWwpO1xyXG5cdFx0c3RhdGVfZWwudmFsdWUgPSBKU09OLnN0cmluZ2lmeShzbG90cyk7XHJcblx0XHRlbWl0X2NoYW5nZShzdGF0ZV9lbCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0b2dnbGVfcmVjdChwYW5lbCwgZnJvbV9kYXlfaWR4LCB0b19kYXlfaWR4LCBmcm9tX21pbiwgdG9fbWluLCBtb2RlKSB7XHJcblx0XHR2YXIgZGF5cyA9IGRheV9vcmRlcigpO1xyXG5cdFx0dmFyIGJvZHkgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfYm9keScpO1xyXG5cdFx0aWYgKCFib2R5KSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciBkYXlfc3RhcnQgPSBNYXRoLm1pbihmcm9tX2RheV9pZHgsIHRvX2RheV9pZHgpO1xyXG5cdFx0dmFyIGRheV9lbmQgPSBNYXRoLm1heChmcm9tX2RheV9pZHgsIHRvX2RheV9pZHgpO1xyXG5cdFx0dmFyIG1pbl9zdGFydCA9IE1hdGgubWluKGZyb21fbWluLCB0b19taW4pO1xyXG5cdFx0dmFyIG1pbl9lbmQgPSBNYXRoLm1heChmcm9tX21pbiwgdG9fbWluKTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gZGF5X3N0YXJ0OyBpIDw9IGRheV9lbmQ7IGkrKykge1xyXG5cdFx0XHR2YXIgZGF5X2tleSA9IGRheXNbaV07XHJcblx0XHRcdGJvZHkucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3RbZGF0YS1kYXk9XCInICsgZGF5X2tleSArICdcIl0nKS5mb3JFYWNoKGZ1bmN0aW9uIChjZWxsKSB7XHJcblx0XHRcdFx0dmFyIG1pbnV0ZSA9IHBhcnNlSW50KGNlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLW1pbnV0ZScpLCAxMCk7XHJcblx0XHRcdFx0aWYgKG1pbnV0ZSA8IG1pbl9zdGFydCB8fCBtaW51dGUgPiBtaW5fZW5kKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmIChtb2RlID09PSAnb24nKSB7XHJcblx0XHRcdFx0XHRjZWxsLmNsYXNzTGlzdC5hZGQoJ2lzLW9uJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNlbGwuY2xhc3NMaXN0LnJlbW92ZSgnaXMtb24nKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYmluZF9ncmlkKHBhbmVsKSB7XHJcblx0XHRpZiAoIXBhbmVsIHx8IHBhbmVsLl9fd3BiY19zZWFzb25fcmFuZ2V0aW1lX2luaXRlZCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRwYW5lbC5fX3dwYmNfc2Vhc29uX3JhbmdldGltZV9pbml0ZWQgPSB0cnVlO1xyXG5cclxuXHRcdHZhciBzdGF0ZV9lbCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy13ZWVrZGF5LXNsb3RzLWpzb24nKTtcclxuXHRcdHZhciBzbG90cyA9IG5vcm1hbGl6ZV9zbG90cyhzdGF0ZV9lbCA/IHN0YXRlX2VsLnZhbHVlIDoge30pO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHJlYnVpbGQoKSB7XHJcblx0XHRcdHZhciBjdXJyZW50ID0gcmVhZF9zbG90cyhwYW5lbCk7XHJcblx0XHRcdHJlbmRlcl9ncmlkX3Jvd3MocGFuZWwpO1xyXG5cdFx0XHRwYWludF9zbG90cyhwYW5lbCwgY3VycmVudCk7XHJcblx0XHRcdHBlcnNpc3Rfc2xvdHMocGFuZWwpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJlbmRlcl9ncmlkX3Jvd3MocGFuZWwpO1xyXG5cdFx0cGFpbnRfc2xvdHMocGFuZWwsIHNsb3RzKTtcclxuXHRcdHBlcnNpc3Rfc2xvdHMocGFuZWwpO1xyXG5cclxuXHRcdHBhbmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJzdGFydF90aW1lXCJdLCBbZGF0YS1pbnNwZWN0b3Ita2V5PVwiZW5kX3RpbWVcIl0sIFtkYXRhLWluc3BlY3Rvci1rZXk9XCJzdGVwX21pbnV0ZXNcIl0nKS5mb3JFYWNoKGZ1bmN0aW9uIChlbCkge1xyXG5cdFx0XHRlbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCByZWJ1aWxkKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHBhbmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWxlbi1ncm91cF0gW2RhdGEtbGVuLXJhbmdlXScpLmZvckVhY2goZnVuY3Rpb24gKHJhbmdlKSB7XHJcblx0XHRcdHJhbmdlLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHZhciBncm91cCA9IHJhbmdlLmNsb3Nlc3QoJ1tkYXRhLWxlbi1ncm91cF0nKTtcclxuXHRcdFx0XHR2YXIgbnVtID0gZ3JvdXAgJiYgZ3JvdXAucXVlcnlTZWxlY3RvcignW2RhdGEtbGVuLXZhbHVlXScpO1xyXG5cdFx0XHRcdGlmIChudW0pIHtcclxuXHRcdFx0XHRcdG51bS52YWx1ZSA9IHJhbmdlLnZhbHVlO1xyXG5cdFx0XHRcdFx0ZW1pdF9jaGFuZ2UobnVtKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0cGFuZWwucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbGVuLWdyb3VwXSBbZGF0YS1sZW4tdmFsdWVdJykuZm9yRWFjaChmdW5jdGlvbiAobnVtKSB7XHJcblx0XHRcdG51bS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR2YXIgZ3JvdXAgPSBudW0uY2xvc2VzdCgnW2RhdGEtbGVuLWdyb3VwXScpO1xyXG5cdFx0XHRcdHZhciByYW5nZSA9IGdyb3VwICYmIGdyb3VwLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWxlbi1yYW5nZV0nKTtcclxuXHRcdFx0XHRpZiAocmFuZ2UpIHtcclxuXHRcdFx0XHRcdHJhbmdlLnZhbHVlID0gbnVtLnZhbHVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR2YXIgYm9keSA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9ib2R5Jyk7XHJcblx0XHR2YXIgZHJhZyA9IG51bGw7XHJcblx0XHRpZiAoYm9keSkge1xyXG5cdFx0XHRib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGZ1bmN0aW9uIChldikge1xyXG5cdFx0XHRcdHZhciBjZWxsID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tc2xvdCcpO1xyXG5cdFx0XHRcdGlmICghY2VsbCkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR2YXIgZGF5cyA9IGRheV9vcmRlcigpO1xyXG5cdFx0XHRcdHZhciBkYXlfa2V5ID0gY2VsbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGF5Jyk7XHJcblx0XHRcdFx0dmFyIGRheV9pZHggPSBkYXlzLmluZGV4T2YoZGF5X2tleSk7XHJcblx0XHRcdFx0dmFyIG1pbnV0ZSA9IHBhcnNlSW50KGNlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLW1pbnV0ZScpLCAxMCk7XHJcblx0XHRcdFx0dmFyIG1vZGUgPSBjZWxsLmNsYXNzTGlzdC5jb250YWlucygnaXMtb24nKSA/ICdvZmYnIDogJ29uJztcclxuXHRcdFx0XHRkcmFnID0geyBkYXlfaWR4OiBkYXlfaWR4LCBtaW51dGU6IG1pbnV0ZSwgbW9kZTogbW9kZSB9O1xyXG5cdFx0XHRcdHRvZ2dsZV9yZWN0KHBhbmVsLCBkYXlfaWR4LCBkYXlfaWR4LCBtaW51dGUsIG1pbnV0ZSwgbW9kZSk7XHJcblx0XHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0fSk7XHJcblx0XHRcdGJvZHkuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdmVyJywgZnVuY3Rpb24gKGV2KSB7XHJcblx0XHRcdFx0dmFyIGNlbGwgPSBldi50YXJnZXQgJiYgZXYudGFyZ2V0LmNsb3Nlc3QgJiYgZXYudGFyZ2V0LmNsb3Nlc3QoJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS1zbG90Jyk7XHJcblx0XHRcdFx0aWYgKCFkcmFnIHx8ICFjZWxsKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHZhciBkYXlzID0gZGF5X29yZGVyKCk7XHJcblx0XHRcdFx0dmFyIGRheV9pZHggPSBkYXlzLmluZGV4T2YoY2VsbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGF5JykpO1xyXG5cdFx0XHRcdHZhciBtaW51dGUgPSBwYXJzZUludChjZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1taW51dGUnKSwgMTApO1xyXG5cdFx0XHRcdHRvZ2dsZV9yZWN0KHBhbmVsLCBkcmFnLmRheV9pZHgsIGRheV9pZHgsIGRyYWcubWludXRlLCBtaW51dGUsIGRyYWcubW9kZSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdFx0dy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoZHJhZykge1xyXG5cdFx0XHRcdGRyYWcgPSBudWxsO1xyXG5cdFx0XHRcdHBlcnNpc3Rfc2xvdHMocGFuZWwpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHR2YXIgY29weV9kZWZhdWx0ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLWNvcHktZGVmYXVsdCcpO1xyXG5cdFx0aWYgKGNvcHlfZGVmYXVsdCkge1xyXG5cdFx0XHRjb3B5X2RlZmF1bHQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZXYpIHtcclxuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdHZhciBjdXJyZW50ID0gcmVhZF9zbG90cyhwYW5lbCk7XHJcblx0XHRcdFx0c2Vhc29uX29yZGVyKCkuZm9yRWFjaChmdW5jdGlvbiAoZGF5X2tleSkge1xyXG5cdFx0XHRcdFx0Y3VycmVudFtkYXlfa2V5XSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoY3VycmVudFsnZGVmYXVsdCddIHx8IFtdKSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0cGFpbnRfc2xvdHMocGFuZWwsIGN1cnJlbnQpO1xyXG5cdFx0XHRcdHBlcnNpc3Rfc2xvdHMocGFuZWwpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgY2xlYXJfd2Vla2RheXMgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtY2xlYXItd2Vla2RheXMnKTtcclxuXHRcdGlmIChjbGVhcl93ZWVrZGF5cykge1xyXG5cdFx0XHRjbGVhcl93ZWVrZGF5cy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChldikge1xyXG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0dmFyIGN1cnJlbnQgPSByZWFkX3Nsb3RzKHBhbmVsKTtcclxuXHRcdFx0XHRzZWFzb25fb3JkZXIoKS5mb3JFYWNoKGZ1bmN0aW9uIChkYXlfa2V5KSB7XHJcblx0XHRcdFx0XHRjdXJyZW50W2RheV9rZXldID0gW107XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0cGFpbnRfc2xvdHMocGFuZWwsIGN1cnJlbnQpO1xyXG5cdFx0XHRcdHBlcnNpc3Rfc2xvdHMocGFuZWwpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbG9ja2VkID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLWxvY2tlZC1uYW1lW2RhdGEtaW5zcGVjdG9yLWtleT1cIm5hbWVcIl0nKTtcclxuXHRcdGlmIChsb2NrZWQpIHtcclxuXHRcdFx0bG9ja2VkLnZhbHVlID0gJ3JhbmdldGltZSc7XHJcblx0XHRcdGVtaXRfY2hhbmdlKGxvY2tlZCk7XHJcblx0XHR9XHJcblx0XHR2YXIgbG9ja2VkX2NvbmRpdGlvbiA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1sb2NrZWQtY29uZGl0aW9uLW5hbWVbZGF0YS1pbnNwZWN0b3Ita2V5PVwiY29uZGl0aW9uX25hbWVcIl0nKTtcclxuXHRcdGlmIChsb2NrZWRfY29uZGl0aW9uKSB7XHJcblx0XHRcdGxvY2tlZF9jb25kaXRpb24udmFsdWUgPSAnc2Vhc29uLWNvbmRpdGlvbic7XHJcblx0XHRcdGVtaXRfY2hhbmdlKGxvY2tlZF9jb25kaXRpb24pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdHJ5X2luaXRfcGFuZWwocm9vdCkge1xyXG5cdFx0aWYgKCFyb290IHx8ICFyb290LnF1ZXJ5U2VsZWN0b3IpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHBhbmVsID0gcm9vdC5tYXRjaGVzICYmIHJvb3QubWF0Y2hlcygnLndwYmNfYmZiX19pbnNwZWN0b3Jfc2Vhc29uX3JhbmdldGltZScpXHJcblx0XHRcdD8gcm9vdFxyXG5cdFx0XHQ6IHJvb3QucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19pbnNwZWN0b3Jfc2Vhc29uX3JhbmdldGltZScpO1xyXG5cdFx0aWYgKHBhbmVsKSB7XHJcblx0XHRcdGJpbmRfZ3JpZChwYW5lbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3aXRoX3JlZ2lzdHJ5KGNiKSB7XHJcblx0XHR2YXIgdHJpZXMgPSAwO1xyXG5cdFx0KGZ1bmN0aW9uIGxvb3AoKSB7XHJcblx0XHRcdHZhciByZWdpc3RyeSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdFx0XHR2YXIgYmFzZSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX0ZpZWxkX0Jhc2UgfHwgKHcuV1BCQ19CRkJfQ29yZSB8fCB7fSkuV1BCQ19CRkJfU2VsZWN0X0Jhc2U7XHJcblx0XHRcdGlmIChyZWdpc3RyeSAmJiByZWdpc3RyeS5yZWdpc3RlciAmJiBiYXNlKSB7XHJcblx0XHRcdFx0Y2IocmVnaXN0cnksIGJhc2UpO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAodHJpZXMrKyA8IDIwMCkge1xyXG5cdFx0XHRcdHNldFRpbWVvdXQobG9vcCwgNTApO1xyXG5cdFx0XHR9XHJcblx0XHR9KSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfcmVuZGVyZXIoKSB7XHJcblx0XHR3aXRoX3JlZ2lzdHJ5KGZ1bmN0aW9uIChSZWdpc3RyeSwgQmFzZSkge1xyXG5cdFx0XHRjbGFzcyBXUEJDX0JGQl9GaWVsZF9zZWFzb25fcmFuZ2V0aW1lIGV4dGVuZHMgQmFzZSB7XHJcblx0XHRcdFx0c3RhdGljIHRlbXBsYXRlX2lkID0gJ3dwYmMtYmZiLWZpZWxkLXNlYXNvbl9yYW5nZXRpbWUnO1xyXG5cdFx0XHRcdHN0YXRpYyBraW5kID0gJ3NlYXNvbl9yYW5nZXRpbWUnO1xyXG5cdFx0XHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XHJcblx0XHRcdFx0XHR2YXIgYmFzZSA9IHN1cGVyLmdldF9kZWZhdWx0cyA/IHN1cGVyLmdldF9kZWZhdWx0cygpIDoge307XHJcblx0XHRcdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgYmFzZSwge1xyXG5cdFx0XHRcdFx0XHR0eXBlOiAnc2Vhc29uX3JhbmdldGltZScsXHJcblx0XHRcdFx0XHRcdHVzYWdlX2tleTogJ3JhbmdldGltZScsXHJcblx0XHRcdFx0XHRcdGxhYmVsOiAnVGltZSBzbG90cycsXHJcblx0XHRcdFx0XHRcdG5hbWU6ICdyYW5nZXRpbWUnLFxyXG5cdFx0XHRcdFx0XHRyZXF1aXJlZDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y29uZGl0aW9uX25hbWU6ICdzZWFzb24tY29uZGl0aW9uJyxcclxuXHRcdFx0XHRcdFx0aXNfc3VwcG9ydGVkOiBpc19wYWNrX3N1cHBvcnRlZCgpLFxyXG5cdFx0XHRcdFx0XHR1cGdyYWRlX3RleHQ6IHVwZ3JhZGVfdGV4dCgpLFxyXG5cdFx0XHRcdFx0XHRub19zZWFzb25zOiBub19zZWFzb25zX3RleHQoKSxcclxuXHRcdFx0XHRcdFx0c2Vhc29uczogZ2V0X3NlYXNvbnMoKSxcclxuXHRcdFx0XHRcdFx0c3RhcnRfdGltZTogJzEwOjAwJyxcclxuXHRcdFx0XHRcdFx0ZW5kX3RpbWU6ICcyMDowMCcsXHJcblx0XHRcdFx0XHRcdHN0ZXBfbWludXRlczogNjAsXHJcblx0XHRcdFx0XHRcdHNsb3RzOiBkZWZhdWx0X3Nsb3RzKCksXHJcblx0XHRcdFx0XHRcdG1pbl93aWR0aDogJzMyMHB4J1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0YXRpYyByZW5kZXIoZWwsIGRhdGEsIGN0eCkge1xyXG5cdFx0XHRcdFx0ZGF0YSA9IGRhdGEgfHwge307XHJcblx0XHRcdFx0XHRkYXRhLmlzX3N1cHBvcnRlZCA9IGlzX3BhY2tfc3VwcG9ydGVkKGRhdGEpO1xyXG5cdFx0XHRcdFx0ZGF0YS51cGdyYWRlX3RleHQgPSB1cGdyYWRlX3RleHQoZGF0YSk7XHJcblx0XHRcdFx0XHRkYXRhLm5vX3NlYXNvbnMgPSBub19zZWFzb25zX3RleHQoZGF0YSk7XHJcblx0XHRcdFx0XHRkYXRhLnNlYXNvbnMgPSBnZXRfc2Vhc29ucygpO1xyXG5cdFx0XHRcdFx0ZGF0YS5zbG90cyA9IG5vcm1hbGl6ZV9zbG90cyhkYXRhLnNsb3RzKTtcclxuXHRcdFx0XHRcdGlmIChzdXBlci5yZW5kZXIpIHtcclxuXHRcdFx0XHRcdFx0c3VwZXIucmVuZGVyKGVsLCBkYXRhLCBjdHgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKGVsICYmIGVsLmRhdGFzZXQpIHtcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5pc19zdXBwb3J0ZWQgPSBkYXRhLmlzX3N1cHBvcnRlZCA/ICd0cnVlJyA6ICdmYWxzZSc7XHJcblx0XHRcdFx0XHRcdGVsLmRhdGFzZXQudXBncmFkZV90ZXh0ID0gZGF0YS51cGdyYWRlX3RleHQgfHwgJyc7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBjdHgpIHtcclxuXHRcdFx0XHRcdGlmIChzdXBlci5vbl9maWVsZF9kcm9wKSB7XHJcblx0XHRcdFx0XHRcdHN1cGVyLm9uX2ZpZWxkX2Ryb3AoZGF0YSwgZWwsIGN0eCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoZGF0YSkge1xyXG5cdFx0XHRcdFx0XHRkYXRhLnVzYWdlX2tleSA9ICdyYW5nZXRpbWUnO1xyXG5cdFx0XHRcdFx0XHRkYXRhLm5hbWUgPSAncmFuZ2V0aW1lJztcclxuXHRcdFx0XHRcdFx0ZGF0YS5jb25kaXRpb25fbmFtZSA9ICdzZWFzb24tY29uZGl0aW9uJztcclxuXHRcdFx0XHRcdFx0ZGF0YS5tdWx0aXBsZSA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHRkYXRhLmlzX3N1cHBvcnRlZCA9IGlzX3BhY2tfc3VwcG9ydGVkKGRhdGEpO1xyXG5cdFx0XHRcdFx0XHRkYXRhLnVwZ3JhZGVfdGV4dCA9IHVwZ3JhZGVfdGV4dChkYXRhKTtcclxuXHRcdFx0XHRcdFx0ZGF0YS5ub19zZWFzb25zID0gbm9fc2Vhc29uc190ZXh0KGRhdGEpO1xyXG5cdFx0XHRcdFx0XHRkYXRhLnNlYXNvbnMgPSBnZXRfc2Vhc29ucygpO1xyXG5cdFx0XHRcdFx0XHRkYXRhLnNsb3RzID0gbm9ybWFsaXplX3Nsb3RzKGRhdGEuc2xvdHMpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKGVsICYmIGVsLmRhdGFzZXQpIHtcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC51c2FnZV9rZXkgPSAncmFuZ2V0aW1lJztcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lID0gJ3JhbmdldGltZSc7XHJcblx0XHRcdFx0XHRcdGVsLmRhdGFzZXQuYXV0b25hbWUgPSAnMCc7XHJcblx0XHRcdFx0XHRcdGVsLmRhdGFzZXQuZnJlc2ggPSAnMCc7XHJcblx0XHRcdFx0XHRcdGVsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgPSAnMSc7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0UmVnaXN0cnkucmVnaXN0ZXIoJ3NlYXNvbl9yYW5nZXRpbWUnLCBXUEJDX0JGQl9GaWVsZF9zZWFzb25fcmFuZ2V0aW1lKTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge31cclxuXHRcdFx0dy5XUEJDX0JGQl9GaWVsZF9zZWFzb25fcmFuZ2V0aW1lID0gV1BCQ19CRkJfRmllbGRfc2Vhc29uX3JhbmdldGltZTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0cmVnaXN0ZXJfcmVuZGVyZXIoKTtcclxuXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLCBmdW5jdGlvbiAoZXYpIHtcclxuXHRcdHRyeV9pbml0X3BhbmVsKGV2ICYmIGV2LmRldGFpbCAmJiBldi5kZXRhaWwucGFuZWwpO1xyXG5cdH0pO1xyXG5cclxuXHRpZiAoZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dHJ5X2luaXRfcGFuZWwoZCk7XHJcblx0XHR9KTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dHJ5X2luaXRfcGFuZWwoZCk7XHJcblx0fVxyXG5cclxuXHR0cnkge1xyXG5cdFx0dmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoZnVuY3Rpb24gKG11dHMpIHtcclxuXHRcdFx0bXV0cy5mb3JFYWNoKGZ1bmN0aW9uIChtdXQpIHtcclxuXHRcdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKG11dC5hZGRlZE5vZGVzIHx8IFtdLCBmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRcdFx0aWYgKG5vZGUubm9kZVR5cGUgPT09IDEpIHtcclxuXHRcdFx0XHRcdFx0dHJ5X2luaXRfcGFuZWwobm9kZSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRvYnNlcnZlci5vYnNlcnZlKGQuZG9jdW1lbnRFbGVtZW50LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcclxuXHR9IGNhdGNoIChlKSB7fVxyXG5cclxuXHRmdW5jdGlvbiBlc2NhcGVfc2hvcnRjb2RlKHZhbHVlKSB7XHJcblx0XHR2YXIgc2FuaXRpemUgPSAody5XUEJDX0JGQl9Db3JlIHx8IHt9KS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdGlmIChzYW5pdGl6ZS5lc2NhcGVfZm9yX3Nob3J0Y29kZSkge1xyXG5cdFx0XHRyZXR1cm4gc2FuaXRpemUuZXNjYXBlX2Zvcl9zaG9ydGNvZGUoU3RyaW5nKHZhbHVlIHx8ICcnKSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gU3RyaW5nKHZhbHVlIHx8ICcnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JykucmVwbGFjZSgvXFxyP1xcbi9nLCAnICcpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZXNjYXBlX2h0bWwodmFsdWUpIHtcclxuXHRcdHZhciBzYW5pdGl6ZSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cdFx0aWYgKHNhbml0aXplLmVzY2FwZV9odG1sKSB7XHJcblx0XHRcdHJldHVybiBzYW5pdGl6ZS5lc2NhcGVfaHRtbChTdHJpbmcodmFsdWUgfHwgJycpKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBTdHJpbmcodmFsdWUgfHwgJycpLnJlcGxhY2UoL1smPD5cIiddL2csIGZ1bmN0aW9uIChjaCkge1xyXG5cdFx0XHRyZXR1cm4geyAnJic6ICcmYW1wOycsICc8JzogJyZsdDsnLCAnPic6ICcmZ3Q7JywgJ1wiJzogJyZxdW90OycsIFwiJ1wiOiAnJiMwMzk7JyB9W2NoXTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2FuaXRpemVfY29uZGl0aW9uX25hbWUodmFsdWUpIHtcclxuXHRcdHZhciBzYW5pdGl6ZSA9ICh3LldQQkNfQkZCX0NvcmUgfHwge30pLldQQkNfQkZCX1Nhbml0aXplIHx8IHt9O1xyXG5cdFx0aWYgKHNhbml0aXplLnRvX3Rva2VuKSB7XHJcblx0XHRcdHJldHVybiBzYW5pdGl6ZS50b190b2tlbihTdHJpbmcodmFsdWUgfHwgJ3NlYXNvbi1jb25kaXRpb24nKSkgfHwgJ3NlYXNvbi1jb25kaXRpb24nO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIFN0cmluZyh2YWx1ZSB8fCAnc2Vhc29uLWNvbmRpdGlvbicpLnJlcGxhY2UoL1teMC05QS1aYS16Oi5fLV0vZywgJycpIHx8ICdzZWFzb24tY29uZGl0aW9uJztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNsb3RzX3NpZ25hdHVyZShyYW5nZXMpIHtcclxuXHRcdHJldHVybiBzYW5pdGl6ZV9yYW5nZXMocmFuZ2VzKS5tYXAoZnVuY3Rpb24gKHJhbmdlKSB7XHJcblx0XHRcdHJldHVybiByYW5nZS5mcm9tICsgJy0nICsgcmFuZ2UudG87XHJcblx0XHR9KS5qb2luKCd8Jyk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzbG90X3Rva2VucyhyYW5nZXMpIHtcclxuXHRcdHJldHVybiBzYW5pdGl6ZV9yYW5nZXMocmFuZ2VzKS5tYXAoZnVuY3Rpb24gKHJhbmdlKSB7XHJcblx0XHRcdHZhciB2YWx1ZSA9IHJhbmdlLmZyb20gKyAnIC0gJyArIHJhbmdlLnRvO1xyXG5cdFx0XHRyZXR1cm4gJ1wiJyArIGVzY2FwZV9zaG9ydGNvZGUodmFsdWUpICsgJ1wiJztcclxuXHRcdH0pLmpvaW4oJyAnKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNlYXNvbl90b19jb25kaXRpb25fdmFsdWUoc2Vhc29uX2tleSkge1xyXG5cdFx0dmFyIHNlYXNvbiA9IHNlYXNvbl9ieV9rZXkoc2Vhc29uX2tleSk7XHJcblx0XHRyZXR1cm4gc2Vhc29uID8gc2Vhc29uLnRpdGxlIDogJyc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjb25kaXRpb25fYmxvY2soY29uZGl0aW9uX25hbWUsIHZhbHVlLCBzZWxlY3Rfc2hvcnRjb2RlKSB7XHJcblx0XHRyZXR1cm4gW1xyXG5cdFx0XHQnW2NvbmRpdGlvbiBuYW1lPVwiJyArIGNvbmRpdGlvbl9uYW1lICsgJ1wiIHR5cGU9XCJzZWFzb25cIiB2YWx1ZT1cIicgKyBlc2NhcGVfc2hvcnRjb2RlKHZhbHVlKSArICdcIl0nLFxyXG5cdFx0XHQnXFx0JyArIHNlbGVjdF9zaG9ydGNvZGUsXHJcblx0XHRcdCdbL2NvbmRpdGlvbl0nXHJcblx0XHRdLmpvaW4oJ1xcbicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYnVpbGRfd3JhcHBlcl9hdHRycyhmaWVsZCwgY3R4KSB7XHJcblx0XHR2YXIgc2FuaXRpemUgPSAody5XUEJDX0JGQl9Db3JlIHx8IHt9KS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdHZhciBhdHRycyA9ICcnO1xyXG5cdFx0dmFyIGNscyA9IGZpZWxkICYmIChmaWVsZC5jc3NjbGFzcyB8fCBmaWVsZC5jbGFzcyB8fCBmaWVsZC5jbGFzc05hbWUpID8gU3RyaW5nKGZpZWxkLmNzc2NsYXNzIHx8IGZpZWxkLmNsYXNzIHx8IGZpZWxkLmNsYXNzTmFtZSkgOiAnJztcclxuXHRcdHZhciBodG1sX2lkID0gZmllbGQgJiYgZmllbGQuaHRtbF9pZCA/IFN0cmluZyhmaWVsZC5odG1sX2lkKSA6ICcnO1xyXG5cdFx0dmFyIG1pbl93aWR0aCA9IGZpZWxkICYmIGZpZWxkLm1pbl93aWR0aCA/IFN0cmluZyhmaWVsZC5taW5fd2lkdGgpLnRyaW0oKSA6ICcnO1xyXG5cclxuXHRcdGlmIChzYW5pdGl6ZS5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0KSB7XHJcblx0XHRcdGNscyA9IHNhbml0aXplLnNhbml0aXplX2Nzc19jbGFzc2xpc3QoY2xzKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGNscyA9IGNscy5yZXBsYWNlKC9bXjAtOUEtWmEtel8gLV0vZywgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHNhbml0aXplLnNhbml0aXplX2h0bWxfaWQpIHtcclxuXHRcdFx0aHRtbF9pZCA9IHNhbml0aXplLnNhbml0aXplX2h0bWxfaWQoaHRtbF9pZCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRodG1sX2lkID0gaHRtbF9pZC5yZXBsYWNlKC9bXjAtOUEtWmEtel8tXS9nLCAnJyk7XHJcblx0XHR9XHJcblx0XHRpZiAoaHRtbF9pZCAmJiBjdHggJiYgY3R4LnVzZWRJZHMpIHtcclxuXHRcdFx0dmFyIHVuaXF1ZV9pZCA9IGh0bWxfaWQ7XHJcblx0XHRcdHZhciBzdWZmaXggPSAyO1xyXG5cdFx0XHR3aGlsZSAoY3R4LnVzZWRJZHMuaGFzKHVuaXF1ZV9pZCkpIHtcclxuXHRcdFx0XHR1bmlxdWVfaWQgPSBodG1sX2lkICsgJ18nICsgc3VmZml4Kys7XHJcblx0XHRcdH1cclxuXHRcdFx0Y3R4LnVzZWRJZHMuYWRkKHVuaXF1ZV9pZCk7XHJcblx0XHRcdGh0bWxfaWQgPSB1bmlxdWVfaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGh0bWxfaWQpIHtcclxuXHRcdFx0YXR0cnMgKz0gJyBpZD1cIicgKyBlc2NhcGVfaHRtbChodG1sX2lkKSArICdcIic7XHJcblx0XHR9XHJcblx0XHRpZiAoY2xzKSB7XHJcblx0XHRcdGF0dHJzICs9ICcgY2xhc3M9XCInICsgZXNjYXBlX2h0bWwoY2xzKSArICdcIic7XHJcblx0XHR9XHJcblx0XHRpZiAobWluX3dpZHRoKSB7XHJcblx0XHRcdG1pbl93aWR0aCA9IG1pbl93aWR0aC5yZXBsYWNlKC9bXjAtOUEtWmEtei4lKCkgLCstXS9nLCAnJyk7XHJcblx0XHRcdGlmIChtaW5fd2lkdGgpIHtcclxuXHRcdFx0XHRhdHRycyArPSAnIHN0eWxlPVwibWluLXdpZHRoOicgKyBlc2NhcGVfaHRtbChtaW5fd2lkdGgpICsgJztcIic7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBhdHRycztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdyYXBfYm9keV9pZl9uZWVkZWQoZmllbGQsIGJvZHksIGN0eCkge1xyXG5cdFx0dmFyIGF0dHJzID0gYnVpbGRfd3JhcHBlcl9hdHRycyhmaWVsZCwgY3R4KTtcclxuXHRcdGlmICghYXR0cnMpIHtcclxuXHRcdFx0cmV0dXJuIGJvZHk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gJzxkaXYnICsgYXR0cnMgKyAnPlxcbicgKyBib2R5ICsgJ1xcbjwvZGl2Pic7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlbWl0X2xhYmVsX3RoZW5fY2xlYXIoZmllbGQsIGVtaXQsIGJvZHksIGNmZywgY3R4KSB7XHJcblx0XHRjZmcgPSBjZmcgfHwge307XHJcblx0XHR2YXIgYWRkX2xhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xyXG5cdFx0dmFyIGxhYmVsID0gZmllbGQgJiYgdHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyA/IGZpZWxkLmxhYmVsLnRyaW0oKSA6ICcnO1xyXG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHR2YXIgcmVxID0gRXhwICYmIEV4cC5pc19yZXF1aXJlZCAmJiBFeHAuaXNfcmVxdWlyZWQoZmllbGQpID8gJyonIDogJyc7XHJcblx0XHR2YXIgd3JhcHBlZF9ib2R5ID0gd3JhcF9ib2R5X2lmX25lZWRlZChmaWVsZCwgYm9keSwgY3R4KTtcclxuXHJcblx0XHRpZiAobGFiZWwgJiYgYWRkX2xhYmVscykge1xyXG5cdFx0XHRlbWl0KCc8bD4nICsgZXNjYXBlX2h0bWwobGFiZWwpICsgcmVxICsgJzwvbD4nKTtcclxuXHRcdFx0ZW1pdCgnPGRpdiBzdHlsZT1cImNsZWFyOmJvdGg7ZmxleDogMSAxIDEwMCU7XCI+PC9kaXY+Jyk7XHJcblx0XHRcdGVtaXQod3JhcHBlZF9ib2R5KTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0ZW1pdCh3cmFwcGVkX2JvZHkpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9fc2xvdHNfbWFya3VwKCkge1xyXG5cdFx0cmV0dXJuICc8c3BhbiBjbGFzcz1cIndwYmNfbm9fdGltZV9zbG90c1wiPk5vIHRpbWUgc2xvdHMgYXZhaWxhYmxlLjwvc3Bhbj4nO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2VsZWN0X3Nob3J0Y29kZV9mb3Jfc2xvdHMoZmllbGQsIHJhbmdlcykge1xyXG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHR2YXIgcmVxID0gKEV4cCAmJiBFeHAuaXNfcmVxdWlyZWQgJiYgRXhwLmlzX3JlcXVpcmVkKGZpZWxkKSkgPyAnKicgOiAnJztcclxuXHRcdHZhciB0b2tlbnMgPSBzbG90X3Rva2VucyhyYW5nZXMpO1xyXG5cdFx0aWYgKCF0b2tlbnMpIHtcclxuXHRcdFx0cmV0dXJuIG5vX3Nsb3RzX21hcmt1cCgpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICdbc2VsZWN0Ym94JyArIHJlcSArICcgcmFuZ2V0aW1lICcgKyB0b2tlbnMgKyAnXSc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSB7XHJcblx0XHR2YXIgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcclxuXHRcdGlmICghRXhwIHx8IHR5cGVvZiBFeHAucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHR5cGVvZiBFeHAuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEV4cC5oYXNfZXhwb3J0ZXIoJ3NlYXNvbl9yYW5nZXRpbWUnKSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0RXhwLnJlZ2lzdGVyKCdzZWFzb25fcmFuZ2V0aW1lJywgZnVuY3Rpb24gKGZpZWxkLCBlbWl0LCBleHRyYXMpIHtcclxuXHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cdFx0XHR2YXIgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHRcdFx0dmFyIGN0eCA9IGV4dHJhcy5jdHggfHwge307XHJcblxyXG5cdFx0XHRpZiAoIWlzX3BhY2tfc3VwcG9ydGVkKGZpZWxkKSkge1xyXG5cdFx0XHRcdGVtaXRfbGFiZWxfdGhlbl9jbGVhcihmaWVsZCwgZW1pdCwgJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fdXBncmFkZV9yZXF1aXJlZFwiPicgKyBlc2NhcGVfaHRtbCh1cGdyYWRlX3RleHQoZmllbGQpKSArICc8L2Rpdj4nLCBjZmcsIGN0eCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgY29uZGl0aW9uX25hbWUgPSAnc2Vhc29uLWNvbmRpdGlvbic7XHJcblx0XHRcdHZhciBzbG90cyA9IG5vcm1hbGl6ZV9zbG90cyhmaWVsZCAmJiBmaWVsZC5zbG90cyk7XHJcblx0XHRcdHZhciBkZWZhdWx0X3JhbmdlcyA9IHNsb3RzWydkZWZhdWx0J10gfHwgW107XHJcblx0XHRcdHZhciBibG9ja3MgPSBbXTtcclxuXHJcblx0XHRcdGJsb2Nrcy5wdXNoKGNvbmRpdGlvbl9ibG9jayhjb25kaXRpb25fbmFtZSwgJyonLCBzZWxlY3Rfc2hvcnRjb2RlX2Zvcl9zbG90cyhmaWVsZCwgZGVmYXVsdF9yYW5nZXMpKSk7XHJcblxyXG5cdFx0XHR2YXIgZGVmYXVsdF9zaWcgPSBzbG90c19zaWduYXR1cmUoZGVmYXVsdF9yYW5nZXMpO1xyXG5cdFx0XHRzZWFzb25fb3JkZXIoKS5mb3JFYWNoKGZ1bmN0aW9uIChkYXlfa2V5KSB7XHJcblx0XHRcdFx0dmFyIHJhbmdlcyA9IHNsb3RzW2RheV9rZXldIHx8IFtdO1xyXG5cdFx0XHRcdHZhciBzaWcgPSBzbG90c19zaWduYXR1cmUocmFuZ2VzKTtcclxuXHRcdFx0XHRpZiAoc2lnID09PSBkZWZhdWx0X3NpZykge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR2YXIgc2Vhc29uX3ZhbHVlID0gc2Vhc29uX3RvX2NvbmRpdGlvbl92YWx1ZShkYXlfa2V5KTtcclxuXHRcdFx0XHRpZiAoIXNlYXNvbl92YWx1ZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRibG9ja3MucHVzaChjb25kaXRpb25fYmxvY2soXHJcblx0XHRcdFx0XHRjb25kaXRpb25fbmFtZSxcclxuXHRcdFx0XHRcdHNlYXNvbl92YWx1ZSxcclxuXHRcdFx0XHRcdHNlbGVjdF9zaG9ydGNvZGVfZm9yX3Nsb3RzKGZpZWxkLCByYW5nZXMpXHJcblx0XHRcdFx0KSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0dmFyIGJvZHkgPSBibG9ja3Muam9pbignXFxuJyk7XHJcblx0XHRcdGVtaXRfbGFiZWxfdGhlbl9jbGVhcihmaWVsZCwgZW1pdCwgYm9keSwgY2ZnLCBjdHgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRpZiAody5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0cmVnaXN0ZXJfYm9va2luZ19mb3JtX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9ib29raW5nX2Zvcm1fZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcclxuXHRcdHZhciBDID0gdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXI7XHJcblx0XHRpZiAoIUMgfHwgdHlwZW9mIEMucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHR5cGVvZiBDLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBDLmhhc19leHBvcnRlcignc2Vhc29uX3JhbmdldGltZScpKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdEMucmVnaXN0ZXIoJ3NlYXNvbl9yYW5nZXRpbWUnLCBmdW5jdGlvbiAoZmllbGQsIGVtaXQsIGV4dHJhcykge1xyXG5cdFx0XHRleHRyYXMgPSBleHRyYXMgfHwge307XHJcblx0XHRcdHZhciBjZmcgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cdFx0XHR2YXIgbGFiZWwgPSAoZmllbGQgJiYgdHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyAmJiBmaWVsZC5sYWJlbC50cmltKCkpID8gZmllbGQubGFiZWwudHJpbSgpIDogJ1RpbWUgc2xvdHMnO1xyXG5cdFx0XHRpZiAoIWlzX3BhY2tfc3VwcG9ydGVkKGZpZWxkKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoQy5lbWl0X2xpbmVfYm9sZF9maWVsZCkge1xyXG5cdFx0XHRcdEMuZW1pdF9saW5lX2JvbGRfZmllbGQoZW1pdCwgbGFiZWwsICdyYW5nZXRpbWUnLCBjZmcpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVtaXQoJzxiPicgKyBlc2NhcGVfaHRtbChsYWJlbCkgKyAnPC9iPjogPGY+W3JhbmdldGltZV08L2Y+PGJyPicpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGlmICh3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdHJlZ2lzdGVyX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ3dwYmM6YmZiOmNvbnRlbnQtZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9ib29raW5nX2RhdGFfZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9KTtcclxuXHR9XHJcblxyXG5cdHZhciBjc3MgPSAnJ1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVfcHJldmlld3tib3JkZXI6MXB4IHNvbGlkICNlM2UzZTM7Ym9yZGVyLXJhZGl1czo2cHg7cGFkZGluZzo4cHg7YmFja2dyb3VuZDojZmZmO30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9wcmV2aWV3X19yb3d7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7Z2FwOjhweDttYXJnaW46M3B4IDA7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lX3ByZXZpZXdfX2RheXt3aWR0aDo1MnB4O2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDtvcGFjaXR5Oi44O30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZV9wcmV2aWV3X19zbG90c3tmbGV4OjE7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lX2JhZGdle2Rpc3BsYXk6aW5saW5lLWJsb2NrO2JvcmRlcjoxcHggc29saWQgI2Q1ZDVkNTtib3JkZXItcmFkaXVzOjEycHg7cGFkZGluZzoycHggOHB4O21hcmdpbjowIDRweCA0cHggMDtmb250LXNpemU6MTFweDtiYWNrZ3JvdW5kOiNmOGY4Zjg7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lX2JhZGdlLS1lbXB0eXtvcGFjaXR5Oi42O30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfdG9vbGJhcntkaXNwbGF5OmZsZXg7Z2FwOjhweDttYXJnaW46OHB4IDA7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9yb290e2JvcmRlcjoxcHggc29saWQgI2RkZDtib3JkZXItcmFkaXVzOjZweDtvdmVyZmxvdzphdXRvO21hcmdpbi10b3A6NnB4O30nXHJcblx0XHQrICcud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfaGVhZCwud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfcm93e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6NzZweCA5MnB4IHJlcGVhdCg3LDY0cHgpO21pbi13aWR0aDo2MTZweDt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGx7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgI2VlZTtib3JkZXItcmlnaHQ6MXB4IHNvbGlkICNmNGY0ZjQ7Ym94LXNpemluZzpib3JkZXItYm94O21pbi1oZWlnaHQ6MjRweDtwYWRkaW5nOjRweDt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLWNvcm5lciwud3BiY19iZmJfX3dlZWtkYXlfdGltZWdyaWRfY2VsbC0tZGF5LC53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS10aW1le2JhY2tncm91bmQ6I2ZhZmFmYTt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLWRheXt0ZXh0LWFsaWduOmNlbnRlcjtmb250LXdlaWdodDo2MDA7fSdcclxuXHRcdCsgJy53cGJjX2JmYl9fd2Vla2RheV90aW1lZ3JpZF9jZWxsLS10aW1le2ZvbnQtdmFyaWFudC1udW1lcmljOnRhYnVsYXItbnVtczt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3R7Y3Vyc29yOmNyb3NzaGFpcjt9J1xyXG5cdFx0KyAnLndwYmNfYmZiX193ZWVrZGF5X3RpbWVncmlkX2NlbGwtLXNsb3QuaXMtb257YmFja2dyb3VuZDpyZ2JhKDAsMTIwLDIxMiwuMTQpO291dGxpbmU6MXB4IHNvbGlkIHJnYmEoMCwxMjAsMjEyLC4zNSk7fSc7XHJcblxyXG5cdHRyeSB7XHJcblx0XHR2YXIgc3R5bGUgPSBkLmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XHJcblx0XHRzdHlsZS50eXBlID0gJ3RleHQvY3NzJztcclxuXHRcdHN0eWxlLmFwcGVuZENoaWxkKGQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7XHJcblx0XHRkLmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xyXG5cdH0gY2F0Y2ggKGUpIHt9XHJcbn0pKHdpbmRvdywgZG9jdW1lbnQpO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0VBQ2hCLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFHRixDQUFDLENBQUNHLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFFaEMsU0FBU0MsSUFBSUEsQ0FBQ0MsQ0FBQyxFQUFFO0lBQ2hCQSxDQUFDLEdBQUdDLFFBQVEsQ0FBQ0QsQ0FBQyxFQUFFLEVBQUUsQ0FBQztJQUNuQixPQUFPLENBQUNBLENBQUMsR0FBRyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsSUFBSUEsQ0FBQztFQUMv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
