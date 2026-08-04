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
		m = ((m % 1440) + 1440) % 1440;
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
		var slots = [ { from: '10:00', to: '17:00' } ];

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
		return String((boot && boot.upgrade_text) || (field && field.upgrade_text) || 'This field is available only in Booking Calendar Business Medium or higher versions.');
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
			out.push({ from: min_to_time(from_min), to: min_to_time(to_min) });
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
			out.push({ from: min_to_time(minute), to: min_to_time(minute + step) });
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
		var start_min = time_to_min((start_el && start_el.value) || '10:00');
		var end_min = time_to_min((end_el && end_el.value) || '17:00');
		var step = normalize_step((step_el && step_el.value) || 30);
		if (start_min == null) {
			start_min = 10 * 60;
		}
		if (end_min == null) {
			end_min = 17 * 60;
		}
		if (end_min <= start_min) {
			end_min = Math.min(1440, start_min + step);
		}
		return { start_min: start_min, end_min: end_min, step: step };
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
			el.dispatchEvent(new Event('input', { bubbles: true }));
			el.dispatchEvent(new Event('change', { bubbles: true }));
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
		var template = (w.wp && w.wp.template) ? w.wp.template('wpbc-bfb-weekday-starttime-row') : null;
		body.innerHTML = '';
		build_row_minutes(state.start_min, state.end_min, state.step).forEach(function (minute) {
			var html = template ? template({ minute: minute, label: min_to_time(minute) }) : '';
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
		var panel = root.matches && root.matches('.wpbc_bfb__inspector_weekday_starttime')
			? root
			: root.querySelector('.wpbc_bfb__inspector_weekday_starttime');
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
		observer.observe(d.documentElement, { childList: true, subtree: true });
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
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch];
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
		return [
			'[condition name="' + condition_name + '" type="weekday" value="' + value + '"]',
			'\t' + select_shortcode,
			'[/condition]'
		].join('\n');
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
		var req = (Exp && Exp.is_required && Exp.is_required(field)) ? '*' : '';
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
					groups[sig] = { days: [], ranges: ranges };
				}
				groups[sig].days.push(weekday_to_condition_value(day_key));
			});

			Object.keys(groups).forEach(function (sig) {
				var group = groups[sig];
				blocks.push(condition_block(
					condition_name,
					group.days.join(','),
					select_shortcode_for_slots(field, group.ranges)
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
			var label = (field && typeof field.label === 'string' && field.label.trim()) ? field.label.trim() : 'Start time';
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
