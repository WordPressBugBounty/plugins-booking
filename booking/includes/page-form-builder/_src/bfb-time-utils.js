/**
 * WPBC BFB Core: Time Utilities
 *
 * One place for all time parsing/formatting/masking helpers + small UI helpers used by time-based packs.
 *
 * - Pure helpers (parse/format minutes, AM/PM conversion)
 * - iMask integration for "HH:MM" inputs
 * - Input-node conversion (type=time <-> masked text)
 * - Small UI helpers for global "time-slot picker" toggle (placeholder row, checkbox sync)
 * - Debounced init for external "time selector" (wpbc_hook__init_timeselector)
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @version   1.0.0
 * @modified: 2025-10-31 12:32
 *
 * ../includes/page-form-builder/_out/bfb-time-utils.js
 */

/* global window, document */
(function (w, d) {
	'use strict';

	var Core = w.WPBC_BFB_Core || (w.WPBC_BFB_Core = {});
	var Time = Core.Time || (Core.Time = {});

	var IMask = w.IMask || null;

	// -----------------------------------------------------------------------------------------------------------------
	// Basic helpers
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Coerce mixed values to boolean.
	 * Accepts booleans, numbers, and common strings: "on"/"off", "true"/"false", "1"/"0", "yes"/"no".
	 * @param {*} v
	 * @return {boolean}
	 */
	Time.coerce_to_bool = function (v) {
		if (typeof v === 'boolean') return v;
		if (typeof v === 'number') return v !== 0;
		if (typeof v === 'string') {
			var s = v.trim().toLowerCase();
			if (s === 'on' || s === 'true' || s === '1' || s === 'yes') return true;
			if (s === 'off' || s === 'false' || s === '0' || s === 'no' || s === '') return false;
		}
		return !!v;
	};

	/**
	 * Parse "HH:MM" 24h -> minutes since 00:00. Returns NaN on invalid.
	 * @param {string} hhmm
	 * @return {number}
	 */
	Time.parse_hhmm_24h = function (hhmm) {
		if (!hhmm) return NaN;
		var m = String(hhmm).trim().match(/^(\d{1,2})\s*:\s*(\d{2})$/);
		if (!m) return NaN;
		var H = Number(m[1]), M = Number(m[2]);
		if (H < 0 || H > 23 || M < 0 || M > 59) return NaN;
		return H * 60 + M;
	};

	/**
	 * Parse "h:MM AM/PM" -> minutes since 00:00. Returns NaN on invalid.
	 * @param {string} txt
	 * @return {number}
	 */
	Time.parse_ampm_text = function (txt) {
		if (!txt) return NaN;
		var m = String(txt).trim().match(/^(\d{1,2})\s*:\s*(\d{2})\s*([AaPp][Mm])$/);
		if (!m) return NaN;
		var h12 = Number(m[1]), mm = Number(m[2]), ap = String(m[3]).toUpperCase();
		if (h12 < 1 || h12 > 12 || mm < 0 || mm > 59) return NaN;
		var h24 = (h12 % 12) + (ap === 'PM' ? 12 : 0);
		return h24 * 60 + mm;
	};

	/**
	 * Try 24h "HH:MM" first, fall back to AM/PM text.
	 * @param {string} v
	 * @return {number}
	 */
	Time.parse_minutes = function (v) {
		var s = String(v || '').trim();
		var m2 = Time.parse_hhmm_24h(s);
		return isNaN(m2) ? Time.parse_ampm_text(s) : m2;
	};

	/**
	 * Format minutes -> "HH:MM" 24h.
	 * @param {number} minutes
	 * @return {string}
	 */
	Time.format_minutes_24h = function (minutes) {
		var H = Math.floor(minutes / 60) % 24;
		var M = minutes % 60;
		var HH = (H < 10 ? '0' + H : '' + H);
		var MM = (M < 10 ? '0' + M : '' + M);
		return HH + ':' + MM;
	};

	/**
	 * Format minutes -> "h:MM AM/PM".
	 * @param {number} minutes
	 * @return {string}
	 */
	Time.format_minutes_ampm = function (minutes) {
		var H24 = Math.floor(minutes / 60) % 24;
		var M   = minutes % 60;
		var is_am = (H24 < 12);
		var h12 = H24 % 12;
		if (h12 === 0) h12 = 12;
		var MM = (M < 10 ? '0' + M : '' + M);
		return h12 + ':' + MM + ' ' + (is_am ? 'AM' : 'PM');
	};

	/**
	 * Escape attribute text.
	 * @param {string} v
	 * @return {string}
	 */
	Time.esc_attr = function (v) {
		return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
	};

	// -----------------------------------------------------------------------------------------------------------------
	// iMask helpers (used by 24h text inputs)
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Apply iMask "HH:MM" to input.
	 * @param {HTMLInputElement} el
	 */
	Time.apply_imask_to_input = function (el) {
		if (!IMask || !el) return;
		if (el._imask) {
			try { el._imask.destroy(); } catch (e) {}
			el._imask = null;
		}
		el._imask = IMask(el, {
			mask: 'HH:MM',
			blocks: {
				HH: { mask: IMask.MaskedRange, from: 0, to: 23, maxLength: 2 },
				MM: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 }
			},
			lazy: false
		});
	};

	/**
	 * Destroy iMask instance if present.
	 * @param {HTMLInputElement} el
	 */
	Time.clear_imask = function (el) {
		if (el && el._imask) {
			try { el._imask.destroy(); } catch (e) {}
			el._imask = null;
		}
	};

	// -----------------------------------------------------------------------------------------------------------------
	// Node conversion: type=time <-> masked text
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Convert a single start/end input node to '24h' (masked text) or 'ampm' (type="time").
	 * @param {HTMLElement} node
	 * @param {'24h'|'ampm'} to_fmt
	 * @param {number} value_minutes
	 * @return {HTMLInputElement}
	 */
	Time.convert_input_node_to_format = function (node, to_fmt, value_minutes) {
		var parent = node.parentNode;
		var cls    = node.className;
		var is_start = node.classList.contains('wpbc_bfb__opt-start');

		var new_el;
		if (to_fmt === '24h') {
			new_el           = d.createElement('input');
			new_el.type      = 'text';
			new_el.className = cls.replace(/\bjs-rt-start-time\b|\bjs-rt-end-time\b/g, '').trim();
			new_el.classList.add('js-rt-mask');
			new_el.setAttribute('data-mask-kind', '24h');
			new_el.setAttribute('placeholder', 'HH:MM');
			new_el.value = isNaN(value_minutes) ? '' : Time.format_minutes_24h(value_minutes);
		} else {
			new_el           = d.createElement('input');
			new_el.type      = 'time';
			new_el.step      = '300';
			new_el.className = cls.replace(/\bjs-rt-mask\b/g, '').trim();
			new_el.classList.add(is_start ? 'js-rt-start-time' : 'js-rt-end-time');
			// <input type="time"> expects "HH:MM" 24h string
			new_el.value = isNaN(value_minutes) ? '' : Time.format_minutes_24h(value_minutes);
		}

		Time.clear_imask(node);
		parent.replaceChild(new_el, node);
		return new_el;
	};

	/**
	 * Rebuild both start/end inputs inside a row to target format.
	 * @param {HTMLElement} row
	 * @param {'24h'|'ampm'} to_fmt
	 */
	Time.rebuild_row_inputs_to_format = function (row, to_fmt) {
		var s_el = row.querySelector('.wpbc_bfb__opt-start');
		var e_el = row.querySelector('.wpbc_bfb__opt-end');
		if (!s_el || !e_el) return;

		var s_m = Time.parse_minutes(s_el.value);
		var e_m = Time.parse_minutes(e_el.value);

		var s_new = Time.convert_input_node_to_format(s_el, to_fmt, s_m);
		var e_new = Time.convert_input_node_to_format(e_el, to_fmt, e_m);

		if (to_fmt === '24h') {
			Time.apply_imask_to_input(s_new);
			Time.apply_imask_to_input(e_new);
		} else {
			Time.clear_imask(s_new);
			Time.clear_imask(e_new);
		}
	};

	/**
	 * Rebuild all rows under container to target format.
	 * @param {HTMLElement} container
	 * @param {'24h'|'ampm'} to_fmt
	 */
	Time.rebuild_all_rows_to_format = function (container, to_fmt) {
		if (!container) return;
		container.querySelectorAll('.wpbc_bfb__options_row').forEach(function (row) {
			Time.rebuild_row_inputs_to_format(row, to_fmt);
		});
	};

	/**
	 * Apply iMask to all 24h-masked inputs within container.
	 * @param {HTMLElement} container
	 */
	Time.apply_imask_in_container_24h = function (container) {
		if ( !IMask || !container ) return;
		container.querySelectorAll( 'input[data-mask-kind="24h"]' ).forEach( function (el) {
			Time.apply_imask_to_input( el );
		} );
	};

	// -----------------------------------------------------------------------------------------------------------------
	// Slot generation
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Build slots: [{label, value, selected:false}, ...]
	 * Note: generation expects end > start. (Overnight ranges are entered manually via editor.)
	 * @param {number} start_minutes
	 * @param {number} end_minutes
	 * @param {number} step_minutes
	 * @param {'24h'|'ampm'} label_fmt
	 * @return {Array<{label:string,value:string,selected:boolean}>}
	 */
	Time.build_time_slots = function (start_minutes, end_minutes, step_minutes, label_fmt) {
		if (isNaN(start_minutes) || isNaN(end_minutes) || isNaN(step_minutes)) return [];
		if (end_minutes <= start_minutes || step_minutes <= 0) return [];
		var out = [];
		for (var t = start_minutes; (t + step_minutes) <= end_minutes; t += step_minutes) {
			var t2  = t + step_minutes;
			var v1  = Time.format_minutes_24h(t);
			var v2  = Time.format_minutes_24h(t2);
			var l1  = (label_fmt === '24h') ? v1 : Time.format_minutes_ampm(t);
			var l2  = (label_fmt === '24h') ? v2 : Time.format_minutes_ampm(t2);
			out.push({ label: l1 + ' - ' + l2, value: v1 + ' - ' + v2, selected: false });
		}
		return out;
	};

	// -----------------------------------------------------------------------------------------------------------------
	// Global "time-slot picker" flag helpers
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Read global time-slot picker flag (saved via _wpbc other params).
	 * @return {boolean}
	 */
	Time.read_picker_enabled = function () {
		try {
			if (!(w._wpbc && typeof w._wpbc.get_other_param === 'function')) return false;
			return Time.coerce_to_bool(w._wpbc.get_other_param('is_enabled_booking_timeslot_picker'));
		} catch (e) { return false; }
	};

	/**
	 * Persist global time-slot picker flag.
	 * @param {boolean} enabled
	 */
	Time.set_picker_enabled = function (enabled) {
		try {
			if (w._wpbc && typeof w._wpbc.set_other_param === 'function') {
				w._wpbc.set_other_param('is_enabled_booking_timeslot_picker', !!enabled);
			}
		} catch (e) {}
	};

	/**
	 * Set toggle + hide/show placeholder row within a single Inspector panel.
	 * @param {HTMLElement} panel
	 * @param {boolean} enabled
	 */
	Time.ui_set_picker_toggle_for_panel = function (panel, enabled) {
		if (!panel) return;
		var chk = panel.querySelector('.js-toggle-timeslot-picker');
		if (chk) chk.checked = !!enabled;

		var phRow = panel.querySelector('.js-placeholder-row');
		if (phRow) {
			if (enabled) { phRow.style.display = 'none'; phRow.hidden = true; }
			else { phRow.style.display = ''; phRow.hidden = false; }
		}
	};

	/**
	 * Apply picker flag to all open Time inspectors.
	 * @param {boolean} enabled
	 */
	Time.ui_apply_picker_enabled_to_all = function (enabled) {
		d.querySelectorAll( '.wpbc_bfb__inspector_timepicker' ).forEach( function (panel) {
			// Set toggle + hide/show placeholder row within a single Inspector panel.
			Time.ui_set_picker_toggle_for_panel( panel, enabled );
		} );
	};

	// -----------------------------------------------------------------------------------------------------------------
	// Debounced init for external time selector (canvas preview)
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Debounced call to global initializer (if present): wpbc_hook__init_timeselector()
	 */
	Time.schedule_init_timeselector = (function () {
		let scheduled = false;
		let tid = null;
		const DELAY = 30;
		return function () {
			if (scheduled) return;
			scheduled = true;
			clearTimeout(tid);
			tid = setTimeout(function run() {
				scheduled = false;
				if (!d.querySelector('.wpbc_bfb__preview-timepicker')) return;
				if (typeof w.wpbc_hook__init_timeselector === 'function') {
					try {
						w.__wpbc_rt_mo_pause && w.__wpbc_rt_mo_pause();
						w.__wpbc_st_mo_pause && w.__wpbc_st_mo_pause();
						w.wpbc_hook__init_timeselector();
					} catch ( e ) {/* no-op */
					} finally {
						w.__wpbc_rt_mo_resume && w.__wpbc_rt_mo_resume();
						w.__wpbc_st_mo_resume && w.__wpbc_st_mo_resume();
					}
				}
			}, DELAY );
		};
	})();


	/**
	 * Mirror to Settings UI without firing DOM 'change' (loop-safe).
	 */
	Time.mirror_settings_toggle = function (enabled) {
		wpbc_bfb__dispatch_event_safe(
			'wpbc:bfb:settings:set',
			{
				key   : 'booking_timeslot_picker',
				value : enabled ? 'On' : 'Off',
				source: 'time-utils'
			}
		);
	};

	/**
	 * Preview refresh for time-slot picker toggle.
	 * - ON: just init external time selector.
	 * - OFF: teardown widgets and unhide <select> controls, then soft re-render (no rebuild).
	 */
	Time.sync_preview_after_flag = function (enabled) {
		if ( enabled ) {
			Time.schedule_init_timeselector();
			return;
		}
		try {
			document.querySelectorAll( '.wpbc_times_selector' ).forEach( function (el) {
				if ( el.parentNode ) el.parentNode.removeChild( el );
			} );
			document.querySelectorAll(
				'.wpbc_bfb__preview-select.wpbc_bfb__preview-rangetime,' +
				'select[name^="rangetime"], select[name^="starttime"], select[name^="endtime"], select[name^="durationtime"]'
			).forEach( function (s) {
				s.style.removeProperty( 'display' );
				s.hidden = false;
			} );
		} catch ( e ) {
		}
		if ( window.WPBC_BFB_Settings && typeof window.WPBC_BFB_Settings.when_builder_ready === 'function' ) {
			window.WPBC_BFB_Settings.when_builder_ready( function (b) {
				if ( !b || !b.preview_mode ) return;
				if ( typeof b.refresh_canvas === 'function' ) {
					b.refresh_canvas( {
						hard             : true,
						rebuild          : false,   // critical: no load_saved_structure()
						reinit           : false,
						restore_selection: true,
						restore_scroll   : true,
						silent_inspector : true,
						source           : 'settings:timeslot'
					} );
				} else if ( typeof b.render_preview_all === 'function' ) {
					b.render_preview_all();
				}
			} );
		}
	};

	/**
	 * One-call universal setter used by Settings + all time-field inspectors.
	 */
	Time.set_global_timeslot_picker = function (enabled, opts) {
		opts = opts || {};
		Time.set_picker_enabled( enabled );                 // persist in-memory flag
		Time.ui_apply_picker_enabled_to_all( enabled );     // sync all open inspectors
		if ( opts.mirror_settings !== false ) {
			Time.mirror_settings_toggle( enabled );           // mirror Settings toggle (no 'change' event)
		}
		if ( opts.refresh_preview !== false ) {
			Time.sync_preview_after_flag( enabled );          // safe preview refresh
		}
	};

	// -----------------------------------------------------------------------------------------------------------------
	// Global binder: select vs. time picker toggle (ONE-TIME, shared by all time-based packs)
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Bind once to:
	 *  - initialize all open Inspector panels with the current global flag,
	 *  - react to newly added Inspector panels via MutationObserver,
	 *  - persist and broadcast changes when the "Show as time picker" checkbox toggles.
	 */
	Time.ensure_global_timepicker_toggle_binder = function () {

		if (Time.__toggleBinderBound) return;
		Time.__toggleBinderBound = true;

		// 1) Init all currently open panels
		function init_all_panels() {
			Time.ui_apply_picker_enabled_to_all(Time.read_picker_enabled());
		}
		(d.readyState === 'loading')
			? d.addEventListener('DOMContentLoaded', init_all_panels)
			: init_all_panels();

		// 2) Observe Inspector panels that appear later
		try {
			var mo = new MutationObserver(function (muts) {
				var enabled = Time.read_picker_enabled();
				for (var i = 0; i < muts.length; i++) {
					var m = muts[i];
					for (var j = 0; j < m.addedNodes.length; j++) {
						var n = m.addedNodes[j];
						if (!n || n.nodeType !== 1) continue;

						if (n.matches && n.matches('.wpbc_bfb__inspector_timepicker')) {
							try { Time.ui_set_picker_toggle_for_panel(n, enabled); } catch (e) {}
						} else if (n.querySelector) {
							n.querySelectorAll('.wpbc_bfb__inspector_timepicker').forEach(function (panel) {
								try { Time.ui_set_picker_toggle_for_panel(panel, enabled); } catch (e) {}
							});
						}
					}
				}
			});
			mo.observe(d.body, { childList: true, subtree: true });
			// Optional pause/resume hooks if other modules want to suspend observers temporarily:
			w.__wpbc_timepicker_toggle_mo_pause  = function(){ try { mo.disconnect(); } catch(e){} };
			w.__wpbc_timepicker_toggle_mo_resume = function(){
				try { mo.observe(d.body, { childList: true, subtree: true }); } catch(e){}
			};
		} catch (e) {}

		// 3) Checkbox handler (delegated)
		d.addEventListener('change', function (ev) {
			var t = ev.target;
			if (!t || !t.classList || !t.classList.contains('js-toggle-timeslot-picker')) return;

			var enabled = !!t.checked;
			Time.set_global_timeslot_picker( enabled, { source: 'inspector' } );
		});
	};

	// Auto-bind on script load.
	try { Time.ensure_global_timepicker_toggle_binder(); } catch (e) {}

	// -----------------------------------------------------------------------------------------------------------------
	// Builder canvas refresh hooks (moved out of bfb-builder.js)
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Bind pause/resume hooks to Builder canvas refresh events.
	 *
	 * Why here:
	 * - This module owns the timepicker-toggle MutationObserver and time selector init.
	 * - Builder should not know about pack-specific observers.
	 *
	 * Safety:
	 * - Idempotent (binds once).
	 * - Waits for wpbc_bfb_api.ready.
	 * - No hard dependency: if builder/bus/events are absent, it silently no-ops.
	 *
	 * @returns {void}
	 */
	Time.ensure_builder_canvas_refresh_hooks = function () {

		if ( Time.__builder_canvas_refresh_hooks_bound ) {
			return;
		}
		Time.__builder_canvas_refresh_hooks_bound = true;

		// Builder API must exist.
		if ( !w.wpbc_bfb_api || !w.wpbc_bfb_api.ready || (typeof w.wpbc_bfb_api.ready.then !== 'function') ) {
			return;
		}

		w.wpbc_bfb_api.ready.then( function (builder) {

			// Builder might resolve null (timeout) – just ignore.
			if ( !builder || !builder.bus || (typeof builder.bus.on !== 'function') ) {
				return;
			}

			var EVS       = (w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Events) ? w.WPBC_BFB_Core.WPBC_BFB_Events : {};
			var EV_BEFORE = EVS.CANVAS_REFRESH || 'wpbc:bfb:canvas-refresh';
			var EV_AFTER  = EVS.CANVAS_REFRESHED || 'wpbc:bfb:canvas-refreshed';

			// BEFORE refresh: pause observers to avoid loops / extra work while DOM is being rebuilt.
			builder.bus.on( EV_BEFORE, function () {
				try {
					if ( typeof w.__wpbc_rt_mo_pause === 'function' ) {
						w.__wpbc_rt_mo_pause();
					}
				} catch ( e ) {
				}
				try {
					if ( typeof w.__wpbc_st_mo_pause === 'function' ) {
						w.__wpbc_st_mo_pause();
					}
				} catch ( e ) {
				}
				try {
					if ( typeof w.__wpbc_timepicker_toggle_mo_pause === 'function' ) {
						w.__wpbc_timepicker_toggle_mo_pause();
					}
				} catch ( e ) {
				}
			} );

			// AFTER refresh: resume and (if needed) re-init timeselector widgets.
			builder.bus.on( EV_AFTER, function () {
				try {
					if ( typeof w.__wpbc_rt_mo_resume === 'function' ) {
						w.__wpbc_rt_mo_resume();
					}
				} catch ( e ) {
				}
				try {
					if ( typeof w.__wpbc_st_mo_resume === 'function' ) {
						w.__wpbc_st_mo_resume();
					}
				} catch ( e ) {
				}
				try {
					if ( typeof w.__wpbc_timepicker_toggle_mo_resume === 'function' ) {
						w.__wpbc_timepicker_toggle_mo_resume();
					}
				} catch ( e ) {
				}

				// If time-slot picker is enabled and builder is in preview mode, re-init the time selector UI.
				try {
					if ( builder.preview_mode && typeof Time.read_picker_enabled === 'function' && Time.read_picker_enabled() ) {
						if ( typeof Time.schedule_init_timeselector === 'function' ) {
							Time.schedule_init_timeselector();
						}
					}
				} catch ( e ) {
				}
			} );

		} );
	};

	// Call once on load.
	try {
		Time.ensure_builder_canvas_refresh_hooks();
	} catch ( e ) {
	}


})(window, document);
