// WPBC BFB Pack: Range Time (time-slots)
// Uses shared helpers from WPBC_BFB_Core.Time
// Version 1.7.2 — add Booking Form + Booking Data exporters for "rangetime"
// File: ../includes/page-form-builder/field-packs/time-range/_out/field-rangetime-wptpl.js
// 31.10.2025 13:54

(function (w, d) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base || null;
	var Time     = (Core && Core.Time) ? Core.Time : null;

	if ( !Registry || typeof Registry.register !== 'function' || !Base || !Time ) {
		if (w._wpbc && w._wpbc.dev && w._wpbc.dev.error) {
			w._wpbc.dev.error('wpbc_bfb_field_rangetime', 'Missing Core registry/base/time-utils');
		}
		return;
	}

	// ---------------------------------------------------------------------
	// Small helpers local to this pack
	// ---------------------------------------------------------------------
	function emit_inspector_change(el){
		if (!el) return;
		if (el.__wpbc_emitting) return;
		el.__wpbc_emitting = true;
		try {
			if (w.jQuery) { w.jQuery(el).trigger('input').trigger('change'); }
			el.dispatchEvent(new Event('input', {bubbles:true}));
			el.dispatchEvent(new Event('change', {bubbles:true}));
		} finally {
			el.__wpbc_emitting = false;
		}
		Time.schedule_init_timeselector();
	}

	function get_current_format(panel){
		var fmt = 'ampm';
		panel.querySelectorAll('.js-rt-label-fmt').forEach(function (r) {
			if (r.checked) fmt = (r.value === '24h') ? '24h' : 'ampm';
		});
		return fmt;
	}

	function update_gen_visibility(panel){
		var fmt = get_current_format(panel);
		var g24 = panel.querySelector('.js-rt-24h');
		var gam = panel.querySelector('.js-rt-ampm');
		if (g24) { g24.style.display = (fmt === '24h') ? '' : 'none'; g24.hidden = (fmt !== '24h'); }
		if (gam) { gam.style.display = (fmt === 'ampm') ? '' : 'none'; gam.hidden = (fmt !== 'ampm'); }
	}

	function enforce_locked_name(panel){
		var hidden = panel && panel.querySelector('.js-locked-name[data-inspector-key="name"]');
		if (!hidden) return;
		hidden.value = (hidden.value && hidden.value.trim() !== '') ? hidden.value : 'rangetime';
		emit_inspector_change(hidden);
	}

	// ---------------------------------------------------------------------
	// Canvas observer (to reinvoke external timeselector and sync inspectors)
	// ---------------------------------------------------------------------
	(function attachCanvasObserver(){
		var root = d.body, mo;

		function runSync(){
			try { w.__wpbc_rt_mo_pause && w.__wpbc_rt_mo_pause(); } catch(e){}
			d.querySelectorAll('.wpbc_bfb__inspector_rangetime').forEach(function(panel){
				try { wpbc_bfb_field_rangetime.sync_state_from_rows(panel); } catch(e){}
			});
			try { w.__wpbc_rt_mo_resume && w.__wpbc_rt_mo_resume(); } catch(e){}
		}

		function handle(muts){
			var found = false;
			for (var i=0;i<muts.length && !found;i++){
				var m = muts[i];
				// select itself modified
				if (m.type === 'childList' && m.target && m.target.matches && m.target.matches('.wpbc_bfb__preview-rangetime')) found = true;
				// added nodes?
				for (var j=0;j<m.addedNodes.length && !found;j++){
					var n = m.addedNodes[j];
					if (n.nodeType !== 1) continue;
					 if ( n.matches && (n.matches('.wpbc_bfb__preview-rangetime') || n.matches('.wpbc_bfb__preview-timepicker')) ) { found = true; }
					 else if ( n.querySelector && (n.querySelector('.wpbc_bfb__preview-rangetime') || n.querySelector('.wpbc_bfb__preview-timepicker')) ) { found = true; }
				}
				// attribute changes on select
				if (!found && m.type === 'attributes' && m.target && m.target.matches && m.target.matches('.wpbc_bfb__preview-rangetime')) found = true;
			}
			if (found) Time.schedule_init_timeselector();
			if (found) runSync();
		}

		try {
			mo = new MutationObserver(handle);
			mo.observe(root, {
				childList:true, subtree:true, attributes:true, attributeFilter:['value','class']
			});
		} catch(e) {}

		w.__wpbc_rt_mo_pause  = function(){ try { mo && mo.disconnect(); } catch(e){} };
		w.__wpbc_rt_mo_resume = function(){ try {
			mo && mo.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['value','class'] });
		} catch(e){} };
	})();

	// ---------------------------------------------------------------------
	// Renderer
	// ---------------------------------------------------------------------
	const wpbc_bfb_field_rangetime = class extends Base {
		static template_id = 'wpbc-bfb-field-rangetime';
		static kind        = 'rangetime';

		static get_defaults(){
			return {
				kind            : 'field',
				type            : 'rangetime',
				label           : 'Time',
				name            : 'rangetime',
				html_id         : '',
				required        : true,
				multiple        : false,
				size            : null,
				cssclass        : '',
				help            : '',
				default_value   : '',
				placeholder     : '--- Select time ---',
				value_differs   : true,
				min_width       : '240px',
				options         : [
					{ label: '10:00 AM - 12:00 PM', value: '10:00 - 12:00', selected: false },
					{ label: '12:00 PM - 02:00 PM', value: '12:00 - 14:00', selected: false },
					{ label: '02:00 PM - 04:00 PM', value: '14:00 - 16:00', selected: false },
					{ label: '04:00 PM - 06:00 PM', value: '16:00 - 18:00', selected: false },
					{ label: '06:00 PM - 08:00 PM', value: '18:00 - 20:00', selected: false }
				],
				gen_label_fmt   : 'ampm',
				gen_start_24h   : '09:00',
				gen_end_24h     : '18:00',
				gen_start_ampm_t: '09:00',
				gen_end_ampm_t  : '18:00',
				gen_step_h      : 0,
				gen_step_m      : 30
			};
		}

		/**
		 * Executed after the field is dropped from the palette.
		 * Locks canonical name and disables future auto-naming.
		 *
		 * @param {Object}      data
		 * @param {HTMLElement} el
		 * @param {Object}      ctx
		 */
		static on_field_drop(data, el, ctx){
			if (super.on_field_drop) super.on_field_drop(data, el, ctx);
			try {
				// Keep data model canonical
				if (data && typeof data === 'object') {
					data.name     = 'rangetime';
					data.required = true;
				}
				// Lock dataset flags on the dropped element
				if (el && el.dataset) {
					el.dataset.name              = 'rangetime';
					el.dataset.autoname          = '0';
					el.dataset.fresh             = '0';
					el.dataset.name_user_touched = '1';
					el.setAttribute('data-required','true');
				}
				// Sync the preview control (<select>) immediately
				var sel = el && el.querySelector('select.wpbc_bfb__preview-rangetime');
				if (sel) sel.setAttribute('name','rangetime');
				// If Inspector is present, update the hidden "name" proxy and notify
				var hidden = d.querySelector('.wpbc_bfb__inspector_rangetime .js-locked-name[data-inspector-key="name"]');
				if (hidden) { hidden.value = 'rangetime'; hidden.setAttribute('data-locked','1'); if (typeof emit_inspector_change==='function') emit_inspector_change(hidden); }
			} catch(e){}
		}

		// Bind once for all inspector panels (events).
		static bind_inspector_events_once(){
			if (this._bound_once) return;
			this._bound_once = true;

			// Persist placeholder when toggling global picker
			d.addEventListener( 'change', function (ev) {
				var tgl = ev.target && ev.target.closest( '.wpbc_bfb__inspector_rangetime .js-toggle-timeslot-picker' );
				if ( !tgl ) return;
				var panel = tgl.closest( '.wpbc_bfb__inspector_rangetime' );
				var ph    = panel && panel.querySelector( '.js-placeholder' );
				if ( ph ) emit_inspector_change( ph );
			} );

			// AM/PM <-> 24h switch
			d.addEventListener('change', function(ev){
				var radio = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-rt-label-fmt');
				if (!radio) return;

				var panel = radio.closest('.wpbc_bfb__inspector_rangetime');
				if (!panel) return;

				var fmt = get_current_format(panel); // 'ampm' | '24h'
				var proxy = panel.querySelector('.js-rt-label-fmt-value');
				if (proxy){ proxy.value = fmt; emit_inspector_change(proxy); }

				update_gen_visibility(panel);

				// Sync generator values across groups.
				if (fmt === '24h'){
					var s_t = (panel.querySelector('.js-gen-start-ampm-time')||{}).value || '';
					var e_t = (panel.querySelector('.js-gen-end-ampm-time')||{}).value || '';
					var s_m = Time.parse_hhmm_24h(s_t), e_m = Time.parse_hhmm_24h(e_t);
					var s24 = isNaN(s_m) ? '' : Time.format_minutes_24h(s_m);
					var e24 = isNaN(e_m) ? '' : Time.format_minutes_24h(e_m);
					var s24el = panel.querySelector('.js-gen-start-24h');
					var e24el = panel.querySelector('.js-gen-end-24h');
					if (s24el){ s24el.value = s24; emit_inspector_change(s24el); }
					if (e24el){ e24el.value = e24; emit_inspector_change(e24el); }
				} else {
					var s24t = (panel.querySelector('.js-gen-start-24h')||{}).value || '';
					var e24t = (panel.querySelector('.js-gen-end-24h')||{}).value || '';
					var s_m2 = Time.parse_hhmm_24h(s24t), e_m2 = Time.parse_hhmm_24h(e24t);
					var sam = isNaN(s_m2) ? '' : Time.format_minutes_24h(s_m2);
					var eam = isNaN(e_m2) ? '' : Time.format_minutes_24h(e_m2);
					var st_el = panel.querySelector('.js-gen-start-ampm-time');
					var et_el = panel.querySelector('.js-gen-end-ampm-time');
					if (st_el){ st_el.value = sam; emit_inspector_change(st_el); }
					if (et_el){ et_el.value = eam; emit_inspector_change(et_el); }
				}

				Time.rebuild_all_rows_to_format(panel, fmt);
				if (fmt === '24h') Time.apply_imask_in_container_24h(panel);
				wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
				Core.UI.pulse_query_debounced( panel, '.js-rt-generate' ); // avoid reflow spam while typing
 			});

			// Mask on focus (24h)
			d.addEventListener('focusin', function(ev){
				var el = ev.target && ev.target.closest('.js-rt-mask[data-mask-kind="24h"]');
				if (el && !el._imask) Time.apply_imask_to_input(el);
			});

			// Duration range <-> number sync
			d.addEventListener('input', function(ev){
				var range = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime [data-len-group] [data-len-range]');
				if (!range) return;
				var group = range.closest('[data-len-group]');
				var num   = group && group.querySelector('[data-len-value]');
				if (num){
					num.value = range.value;
					if (num.hasAttribute('data-inspector-key')) emit_inspector_change(num);
				}
				const panel = (range || num).closest('.wpbc_bfb__inspector_rangetime');
				Core.UI.pulse_query_debounced( panel, '.js-rt-generate' ); // avoid reflow spam while typing
			});
			d.addEventListener('input', function(ev){
				var num = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime [data-len-group] [data-len-value]');
				if (!num) return;
				var group = num.closest('[data-len-group]');
				var range = group && group.querySelector('[data-len-range]');
				if (range) range.value = num.value;
				const panel = (range || num).closest('.wpbc_bfb__inspector_rangetime');
				Core.UI.pulse_query_debounced( panel, '.js-rt-generate' ); // avoid reflow spam while typing
			});

			// Pulse when any generator input changes (both formats + step)
			d.addEventListener('input', function(ev){
				const genInput = ev.target && ev.target.closest(
					'.wpbc_bfb__inspector_rangetime .js-gen-start-24h,' +
					'.wpbc_bfb__inspector_rangetime .js-gen-end-24h,' +
					'.wpbc_bfb__inspector_rangetime .js-gen-start-ampm-time,' +
					'.wpbc_bfb__inspector_rangetime .js-gen-end-ampm-time,' +
					'.wpbc_bfb__inspector_rangetime .js-gen-step-h,' +
					'.wpbc_bfb__inspector_rangetime .js-gen-step-m'
				);
				if (!genInput) return;
				const panel = genInput.closest('.wpbc_bfb__inspector_rangetime');
				Core.UI.pulse_query_debounced( panel, '.js-rt-generate' ); // avoid reflow spam while typing
			});

			// Generate slots
			d.addEventListener('click', function(ev){
				var btn = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-rt-generate');
				if (!btn) return;
				ev.preventDefault();

				var panel = btn.closest('.wpbc_bfb__inspector_rangetime');
				if (!panel) return;

				var fmt = get_current_format(panel);
				var start_m, end_m;
				if (fmt === '24h'){
					var s24 = (panel.querySelector('.js-gen-start-24h')||{}).value || '';
					var e24 = (panel.querySelector('.js-gen-end-24h')||{}).value || '';
					start_m = Time.parse_hhmm_24h(s24);
					end_m   = Time.parse_hhmm_24h(e24);
				} else {
					var s_am = (panel.querySelector('.js-gen-start-ampm-time')||{}).value || '';
					var e_am = (panel.querySelector('.js-gen-end-ampm-time')||{}).value || '';
					start_m  = Time.parse_hhmm_24h(s_am); // input[type=time] => "HH:MM"
					end_m    = Time.parse_hhmm_24h(e_am);
				}
				var step_h = parseInt((panel.querySelector('.js-gen-step-h')||{}).value, 10) || 0;
				var step_m = parseInt((panel.querySelector('.js-gen-step-m')||{}).value, 10) || 0;
				var step   = Math.max(1, step_h * 60 + step_m);

				var slots = Time.build_time_slots(start_m, end_m, step, fmt);
				wpbc_bfb_field_rangetime.replace_options_in_panel(panel, slots);
				Time.rebuild_all_rows_to_format(panel, fmt);
				if (fmt === '24h') Time.apply_imask_in_container_24h(panel);
				wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
			});

			// Clear
			d.addEventListener('click', function(ev){
				var btn = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-rt-clear');
				if (!btn) return;
				ev.preventDefault();
				var panel = btn.closest('.wpbc_bfb__inspector_rangetime');
				if (!panel) return;
				wpbc_bfb_field_rangetime.replace_options_in_panel(panel, []);
				wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
				Core.UI.pulse_query_debounced(panel, '.js-rt-generate' ); // avoid reflow spam while typing
			});

			// Add option
			d.addEventListener('click', function(ev){
				var btn = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-rt-add-option');
				if (!btn) return;
				ev.preventDefault();
				var panel = btn.closest('.wpbc_bfb__inspector_rangetime');
				if (!panel) return;

				wpbc_bfb_field_rangetime.add_option_row(panel);
				var fmt = get_current_format(panel);
				if (fmt === '24h') Time.apply_imask_in_container_24h(panel);
				wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
			});

			// Row dropdown actions
			d.addEventListener('click', function(ev){
				var a = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .rt_dropdown_action');
				if (!a) return;
				ev.preventDefault();

				var action = a.getAttribute('data-rt-action') || '';
				var row    = a.closest('.wpbc_bfb__options_row');
				var panel  = a.closest('.wpbc_bfb__inspector_rangetime');
				if (!row || !panel) return;

				if (action === 'add_after') {
					wpbc_bfb_field_rangetime.insert_row_after(panel, row, null);
				} else if (action === 'duplicate') {
					var fmt = get_current_format(panel);
					var data = wpbc_bfb_field_rangetime.read_row(row, fmt);
					wpbc_bfb_field_rangetime.insert_row_after(panel, row, data);
				} else if (action === 'remove') {
					var listEl = row.parentNode;
					listEl.removeChild(row);
					wpbc_bfb_field_rangetime.reindex_rows(listEl);
				}
				var fmt2 = get_current_format(panel);
				Time.rebuild_all_rows_to_format(panel, fmt2);
				if (fmt2 === '24h') Time.apply_imask_in_container_24h(panel);
				wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
			});

			// Row edits -> sync
			d.addEventListener('input', function(ev){
				var row = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .wpbc_bfb__options_row');
				if (!row) return;
				var panel = row.closest('.wpbc_bfb__inspector_rangetime');
				wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
			});
			d.addEventListener('change', function(ev){
				var row = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .wpbc_bfb__options_row');
				if (!row) return;

				if (ev.target.classList.contains('wpbc_bfb__opt-selected-chk')){
					var panel = row.closest('.wpbc_bfb__inspector_rangetime');
					if (panel && !panel.querySelector('.js-opt-multiple:checked')) {
						panel.querySelectorAll('.wpbc_bfb__opt-selected-chk').forEach(function(chk){
							if (chk !== ev.target) {
								chk.checked = false;
								chk.setAttribute('aria-checked', 'false');
							}
						});
						ev.target.setAttribute('aria-checked', 'true');
					}
				}
				var panel2 = row.closest('.wpbc_bfb__inspector_rangetime');
				wpbc_bfb_field_rangetime.sync_state_from_rows(panel2);
			});

			// Init on load for existing panels
			var init = function(){
				d.querySelectorAll('.wpbc_bfb__inspector_rangetime').forEach(function(panel){
					update_gen_visibility(panel);
					var fmt = get_current_format(panel);
					if (fmt === '24h') Time.apply_imask_in_container_24h(panel);

					// placeholder disabled state mirror (if multiple is shown in future)
					var mul    = panel.querySelector('.js-opt-multiple');
					var ph     = panel.querySelector('.js-placeholder');
					var phNote = panel.querySelector('.js-placeholder-note');
					if (mul && ph) ph.disabled = !!mul.checked;
					if (mul && phNote) phNote.style.display = mul.checked ? 'none' : '';

					enforce_locked_name(panel);
					var ph_init = panel.querySelector('.js-placeholder');
					if (ph_init) emit_inspector_change(ph_init);
				});
			};
			(d.readyState === 'loading') ? d.addEventListener('DOMContentLoaded', init) : init();

			// Re-apply when Inspector re-renders a panel
			d.addEventListener('wpbc_bfb_inspector_ready', function(ev){
				var panel = ev && ev.detail && ev.detail.panel;
				if (!panel) return;
				var rtPanel = panel.closest
					? (panel.matches('.wpbc_bfb__inspector_rangetime') ? panel : panel.closest('.wpbc_bfb__inspector_rangetime'))
					: null;
				if (!rtPanel) return;

				update_gen_visibility(rtPanel);
				var fmt = get_current_format(rtPanel);
				if (fmt === '24h') Time.apply_imask_in_container_24h(rtPanel);

				enforce_locked_name(rtPanel);
				var ph_init = rtPanel.querySelector('.js-placeholder');
				if (ph_init) emit_inspector_change(ph_init);
			});
		}

		// ------- Rows & state --------
		static build_row_html(data, fmt, panel){
			var label = (data && data.label) || '';
			var value = (data && data.value) || '';
			var parts = String(value).split(/\s*-\s*/);
			var start = parts[0] || '';
			var end   = parts[1] || '';
			var uid   = 'wpbc_ins_rt_' + Math.random().toString(36).slice(2,10);
			var sel   = !!(data && (true === data.selected || 'true' === data.selected || 1 === data.selected || '1' === data.selected));
			var i18n  = {
				add      : (panel && panel.dataset.i18nAdd) || 'Add New',
				duplicate: (panel && panel.dataset.i18nDuplicate) || 'Duplicate',
				remove   : (panel && panel.dataset.i18nRemove) || 'Remove',
				def      : (panel && panel.dataset.i18nDefault) || (w.wpbc_i18n_default || 'Default'),
				reorder  : (panel && panel.dataset.i18nReorder) || 'Drag to reorder',
				rowlabel : (panel && panel.dataset.i18nRowlabel) || 'Label (e.g. 10:00 AM - 10:30 AM)'
			};
			var time_inputs_html;
			if (fmt === '24h') {
				time_inputs_html =
					'<input type="text" class="wpbc_bfb__opt-start js-rt-mask" data-mask-kind="24h" placeholder="HH:MM" value="' + Time.esc_attr(start) + '">' +
					'<span class="wpbc_bfb__opt-sep" aria-hidden="true">-</span>' +
					'<input type="text" class="wpbc_bfb__opt-end js-rt-mask" data-mask-kind="24h" placeholder="HH:MM" value="' + Time.esc_attr(end) + '">';
			} else {
				time_inputs_html =
					'<input type="time" class="wpbc_bfb__opt-start js-rt-start-time" step="300" value="' + Time.esc_attr(start) + '">' +
					'<span class="wpbc_bfb__opt-sep" aria-hidden="true">-</span>' +
					'<input type="time" class="wpbc_bfb__opt-end js-rt-end-time" step="300" value="' + Time.esc_attr(end) + '">';
			}

			return '' +
				'<div class="wpbc_bfb__options_row" data-index="0">' +
					'<span class="wpbc_bfb__drag-handle" title="' + i18n.reorder + '"><span class="wpbc_icn_drag_indicator"></span></span>' +
					'<input type="text" class="wpbc_bfb__opt-label" placeholder="' + i18n.rowlabel + '" value="' + Time.esc_attr(label) + '">' +
					time_inputs_html +
					'<input type="text" class="wpbc_bfb__opt-value" value="' + Time.esc_attr(value || (start && end ? (start + ' - ' + end) : '')) + '" hidden>' +
					'<div class="wpbc_bfb__opt-selected">' +
						'<div class="inspector__control wpbc_ui__toggle">' +
							'<input type="checkbox" class="wpbc_bfb__opt-selected-chk inspector__input" id="' + uid + '" role="switch" ' + (sel ? 'checked aria-checked="true"' : 'aria-checked="false"') + '>' +
							'<label class="wpbc_ui__toggle_icon_radio" for="' + uid + '"></label>' +
							'<label class="wpbc_ui__toggle_label" for="' + uid + '">' + i18n.def + '</label>' +
						'</div>' +
					'</div>' +
					'<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown">' +
						'<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false" class="ul_dropdown_menu_toggle">' +
							'<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>' +
						'</a>' +
						'<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">' +
							'<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="add_after" href="javascript:void(0)">' + i18n.add + '<i class="menu_icon icon-1x wpbc_icn_add_circle"></i></a></li>' +
							'<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="duplicate" href="javascript:void(0)">' + i18n.duplicate + '<i class="menu_icon icon-1x wpbc_icn_content_copy"></i></a></li>' +
							'<li class="divider"></li>' +
							'<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="remove" href="javascript:void(0)">' + i18n.remove + '<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></a></li>' +
						'</ul>' +
					'</div>' +
				'</div>';
		}

		static add_option_row(panel){
			var list = panel.querySelector('.wpbc_bfb__options_list');
			if (!list) return;
			var fmt = get_current_format(panel);
			var s = 9 * 60, e = s + 30;
			var start = Time.format_minutes_24h(s);
			var end   = Time.format_minutes_24h(e);
			var label = (fmt === '24h') ? (start + ' - ' + end) : (Time.format_minutes_ampm(s) + ' - ' + Time.format_minutes_ampm(e));
			var html = wpbc_bfb_field_rangetime.build_row_html({ label: label, value: start + ' - ' + end, selected:false }, fmt, panel);

			var tmp = d.createElement('div'); tmp.innerHTML = html;
			var row = tmp.firstElementChild;
			list.appendChild(row);
			wpbc_bfb_field_rangetime.reindex_rows(list);
			if (fmt === '24h') {
				Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-start'));
				Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-end'));
			}
		}

		static insert_row_after(panel, after_row, data){
			var list = panel.querySelector('.wpbc_bfb__options_list');
			if (!list) return;
			var fmt = get_current_format(panel);
			if (!data){
				var s = 9 * 60, e = s + 30;
				var start = Time.format_minutes_24h(s), end = Time.format_minutes_24h(e);
				data = {
					label   : (fmt === '24h') ? (start + ' - ' + end) : (Time.format_minutes_ampm(s) + ' - ' + Time.format_minutes_ampm(e)),
					value   : start + ' - ' + end,
					selected: false
				};
			}
			var html = wpbc_bfb_field_rangetime.build_row_html(data, fmt, panel);
			var tmp = d.createElement('div'); tmp.innerHTML = html;
			var row = tmp.firstElementChild;
			after_row.parentNode.insertBefore(row, after_row.nextSibling);
			wpbc_bfb_field_rangetime.reindex_rows(list);
			if (fmt === '24h') {
				Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-start'));
				Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-end'));
			}
		}

		static read_row(row, fmt){
			var label = (row.querySelector('.wpbc_bfb__opt-label')||{}).value || '';
			var s_el  = row.querySelector('.wpbc_bfb__opt-start');
			var e_el  = row.querySelector('.wpbc_bfb__opt-end');
			var s_m   = Time.parse_hhmm_24h(s_el ? s_el.value : '');
			var e_m   = Time.parse_hhmm_24h(e_el ? e_el.value : '');
			if (isNaN(s_m)) s_m = Time.parse_minutes(s_el ? s_el.value : '');
			if (isNaN(e_m)) e_m = Time.parse_minutes(e_el ? e_el.value : '');

			// Allow export even when end <= start (overnight ranges)
			var value = (!isNaN(s_m) && !isNaN(e_m)) ? (Time.format_minutes_24h(s_m) + ' - ' + Time.format_minutes_24h(e_m)) : '';
			var sel   = !!((row.querySelector('.wpbc_bfb__opt-selected-chk')||{}).checked);
			return { label: label, value: value, selected: sel };
		}

		static sync_state_from_rows(panel){
			if (!panel) return;
			var list  = panel.querySelector('.wpbc_bfb__options_list');
			var state = panel.querySelector('.wpbc_bfb__options_state');
			if (!list || !state) return;

			var isMultiple   = !!panel.querySelector('.js-opt-multiple:checked');
			var seenSelected = false;
			var fmt = get_current_format(panel);
			var out = [];

			list.querySelectorAll('.wpbc_bfb__options_row').forEach(function (row) {
				var obj = wpbc_bfb_field_rangetime.read_row(row, fmt);
				if (!isMultiple && obj.selected) {
					if (!seenSelected) {
						seenSelected = true;
					} else {
						obj.selected = false;
						var chk = row.querySelector('.wpbc_bfb__opt-selected-chk');
						if (chk){ chk.checked = false; chk.setAttribute('aria-checked', 'false'); }
					}
				}
				out.push(obj);
				var hv = row.querySelector('.wpbc_bfb__opt-value');
				if (hv) hv.value = obj.value || '';
			});

			try { state.value = JSON.stringify(out); } catch(e){ state.value = '[]'; }
			emit_inspector_change(state);
		}

		static replace_options_in_panel(panel, slots){
			var list  = panel.querySelector('.wpbc_bfb__options_list');
			var state = panel.querySelector('.wpbc_bfb__options_state');
			if (!list || !state) return;

			var fmt = get_current_format(panel);
			list.innerHTML = '';
			(slots || []).forEach(function(opt){
				var html = wpbc_bfb_field_rangetime.build_row_html(opt, fmt, panel);
				var tmp = d.createElement('div'); tmp.innerHTML = html;
				list.appendChild(tmp.firstElementChild);
			});
			wpbc_bfb_field_rangetime.reindex_rows(list);
			if (fmt === '24h') Time.apply_imask_in_container_24h(panel);

			try { state.value = JSON.stringify(slots || []); } catch(e){ state.value = '[]'; }
			emit_inspector_change(state);
		}

		static reindex_rows(list){
			if (!list) return;
			var i = 0;
			list.querySelectorAll('.wpbc_bfb__options_row').forEach(function(row){
				row.setAttribute('data-index', String(i++));
			});
		}
	};

	try { Registry.register('rangetime', wpbc_bfb_field_rangetime); }
	catch (e) { if (w._wpbc && w._wpbc.dev && w._wpbc.dev.error) w._wpbc.dev.error('wpbc_bfb_field_rangetime.register', e); }

	wpbc_bfb_field_rangetime.bind_inspector_events_once();
	w.WPBC_BFB_Field_RangeTime = wpbc_bfb_field_rangetime;



	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback for "rangetime".
	 *
	 * Mirrors the legacy behavior:
	 *   WPBC_BFB_Exporter.emit_time_select( name, field, req_mark, id_opt, cls_opts, emit_label_then );
	 *
	 * So the final shortcode body and label handling are identical to the old
	 * switch/case path in builder-exporter.js, just moved into this pack.
	 */
	function register_rangetime_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'rangetime' ) ) { return; }

		var S        = Core.WPBC_BFB_Sanitize || {};
		var esc_html = S.escape_html || function( v ){ return String( v ); };

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 */
		var exporter_callback = function( field, emit, extras ) {
			extras = extras || {};

			var cfg = extras.cfg || {};
			var ctx = extras.ctx;

			// Shared label wrapper: prefer global helper; fall back to local behavior.
			var emit_label_then = function( body ) {
				// Preferred path: centralized helper in builder-exporter.js
				if ( Exp && typeof Exp.emit_label_then === 'function' ) {
					Exp.emit_label_then( field, emit, body, cfg );
					return;
				}
			};

			// Required marker (same semantics as other text-like fields).
			var is_req   = Exp.is_required( field );
			var req_mark = is_req ? '*' : '';

			// Name / id / classes from shared helpers so they stay in sync.
			var name     = Exp.compute_name( 'rangetime', field );
			var id_opt   = Exp.id_option( field, ctx );
			var cls_opts = Exp.class_options( field );

			// Prefer the dedicated time helper to keep exact legacy shortcode shape.
			if ( typeof Exp.emit_time_select === 'function' ) {
				Exp.emit_time_select( name, field, req_mark, id_opt, cls_opts, emit_label_then );
				return;
			}
		};

		Exp.register( 'rangetime', exporter_callback );
	}

	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_rangetime_booking_form_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_rangetime_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter callback for "rangetime".
	 *
	 * Default behavior:
	 *   <b>Label</b>: <f>[rangetime]</f><br>
	 *
	 * The exported token name is kept fully in sync with the Booking Form exporter
	 * via Exp.compute_name('rangetime', field).
	 */
	function register_rangetime_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'rangetime' ) ) { return; }

		C.register( 'rangetime', function( field, emit, extras ) {
			extras = extras || {};
			var cfg = extras.cfg || {};

			var Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

			// Keep exported name identical to the Booking Form exporter.
			var name = Exp.compute_name( 'rangetime', field );
			if ( ! name ) { return; }

			var raw_label = ( typeof field.label === 'string' ) ? field.label : '';
			var label     = raw_label.trim() || name;

			// Shared helper: <b>Label</b>: <f>[name]</f><br>
			C.emit_line_bold_field( emit, label, name, cfg );
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_rangetime_booking_data_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_rangetime_booking_data_exporter, { once: true } );
	}

})(window, document);
