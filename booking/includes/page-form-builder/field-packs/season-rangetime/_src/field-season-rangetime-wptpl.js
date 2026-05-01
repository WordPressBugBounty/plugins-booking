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
		m = ((m % 1440) + 1440) % 1440;
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
			var id = String((season && season.id) || '').replace(/[^0-9]/g, '');
			var key = String((season && season.key) || ('s' + id)).replace(/[^0-9A-Za-z_-]/g, '');
			var title = String((season && season.title) || '').trim();
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
		return [{ key: 'default', title: 'Default' }].concat(get_seasons());
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
		var base = [
			{ from: '10:00', to: '11:00' },
			{ from: '11:00', to: '12:00' },
			{ from: '12:00', to: '13:00' },
			{ from: '13:00', to: '14:00' },
			{ from: '14:00', to: '15:00' },
			{ from: '15:00', to: '16:00' },
			{ from: '16:00', to: '17:00' },
			{ from: '17:00', to: '18:00' }
		];
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
		return String((boot && boot.upgrade_text) || (field && field.upgrade_text) || 'This field is available only in Booking Calendar Business Medium or higher versions.');
	}

	function no_seasons_text(field) {
		var boot = get_boot();
		return String((boot && boot.no_seasons) || (field && field.no_seasons) || 'No season filters are available for the current user.');
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
			out.push({ from: min_to_time(from_min), to: min_to_time(to_min) });
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
			out.push({ from: min_to_time(minute), to: min_to_time(minute + step) });
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
		var start_min = time_to_min((start_el && start_el.value) || '10:00');
		var end_min = time_to_min((end_el && end_el.value) || '20:00');
		var step = normalize_step((step_el && step_el.value) || 60);
		if (start_min == null) {
			start_min = 10 * 60;
		}
		if (end_min == null) {
			end_min = 20 * 60;
		}
		if (end_min <= start_min) {
			end_min = Math.min(1440, start_min + step);
		}
		return { start_min: start_min, end_min: end_min, step: step };
	}

	function emit_change(el) {
		if (!el) {
			return;
		}
		try {
			if (w.jQuery) {
				w.jQuery(el).trigger('input').trigger('change');
			}
			el.dispatchEvent(new Event('input', { bubbles: true }));
			el.dispatchEvent(new Event('change', { bubbles: true }));
		} catch (e) {}
	}

	function render_grid_rows(panel) {
		var body = panel.querySelector('.wpbc_bfb__weekday_timegrid_body');
		if (!body) {
			return;
		}
		var state = get_state(panel);
		var template = (w.wp && w.wp.template) ? w.wp.template('wpbc-bfb-season-rangetime-row') : null;
		body.innerHTML = '';
		build_row_minutes(state.start_min, state.end_min, state.step).forEach(function (minute) {
			var html = template ? template({ minute: minute, label: min_to_time(minute), columns: season_columns() }) : '';
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
				drag = { day_idx: day_idx, minute: minute, mode: mode };
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
		var panel = root.matches && root.matches('.wpbc_bfb__inspector_season_rangetime')
			? root
			: root.querySelector('.wpbc_bfb__inspector_season_rangetime');
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
		observer.observe(d.documentElement, { childList: true, subtree: true });
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
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch];
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
		return [
			'[condition name="' + condition_name + '" type="season" value="' + escape_shortcode(value) + '"]',
			'\t' + select_shortcode,
			'[/condition]'
		].join('\n');
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
		var req = (Exp && Exp.is_required && Exp.is_required(field)) ? '*' : '';
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
				blocks.push(condition_block(
					condition_name,
					season_value,
					select_shortcode_for_slots(field, ranges)
				));
			});

			var body = blocks.join('\n');
			emit_label_then_clear(field, emit, body, cfg, ctx);
		});
	}

	if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
		register_booking_form_exporter();
	} else {
		d.addEventListener('wpbc:bfb:exporter-ready', register_booking_form_exporter, { once: true });
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
			var label = (field && typeof field.label === 'string' && field.label.trim()) ? field.label.trim() : 'Time slots';
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
		d.addEventListener('wpbc:bfb:content-exporter-ready', register_booking_data_exporter, { once: true });
	}

	var css = ''
		+ '.wpbc_bfb__weekday_time_preview{border:1px solid #e3e3e3;border-radius:6px;padding:8px;background:#fff;}'
		+ '.wpbc_bfb__weekday_time_preview__row{display:flex;align-items:flex-start;gap:8px;margin:3px 0;}'
		+ '.wpbc_bfb__weekday_time_preview__day{width:52px;font-size:12px;font-weight:600;opacity:.8;}'
		+ '.wpbc_bfb__weekday_time_preview__slots{flex:1;}'
		+ '.wpbc_bfb__weekday_time_badge{display:inline-block;border:1px solid #d5d5d5;border-radius:12px;padding:2px 8px;margin:0 4px 4px 0;font-size:11px;background:#f8f8f8;}'
		+ '.wpbc_bfb__weekday_time_badge--empty{opacity:.6;}'
		+ '.wpbc_bfb__weekday_timegrid_toolbar{display:flex;gap:8px;margin:8px 0;}'
		+ '.wpbc_bfb__weekday_timegrid_root{border:1px solid #ddd;border-radius:6px;overflow:auto;margin-top:6px;}'
		+ '.wpbc_bfb__weekday_timegrid_head,.wpbc_bfb__weekday_timegrid_row{display:grid;grid-template-columns:76px 92px repeat(7,64px);min-width:616px;}'
		+ '.wpbc_bfb__weekday_timegrid_cell{border-bottom:1px solid #eee;border-right:1px solid #f4f4f4;box-sizing:border-box;min-height:24px;padding:4px;}'
		+ '.wpbc_bfb__weekday_timegrid_cell--corner,.wpbc_bfb__weekday_timegrid_cell--day,.wpbc_bfb__weekday_timegrid_cell--time{background:#fafafa;}'
		+ '.wpbc_bfb__weekday_timegrid_cell--day{text-align:center;font-weight:600;}'
		+ '.wpbc_bfb__weekday_timegrid_cell--time{font-variant-numeric:tabular-nums;}'
		+ '.wpbc_bfb__weekday_timegrid_cell--slot{cursor:crosshair;}'
		+ '.wpbc_bfb__weekday_timegrid_cell--slot.is-on{background:rgba(0,120,212,.14);outline:1px solid rgba(0,120,212,.35);}';

	try {
		var style = d.createElement('style');
		style.type = 'text/css';
		style.appendChild(d.createTextNode(css));
		d.head.appendChild(style);
	} catch (e) {}
})(window, document);
