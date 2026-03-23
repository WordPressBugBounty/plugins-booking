"use strict";

// WPBC BFB Pack: Range Time (time-slots)
// Uses shared helpers from WPBC_BFB_Core.Time
// Version 1.7.2 — add Booking Form + Booking Data exporters for "rangetime"
// File: ../includes/page-form-builder/field-packs/time-range/_out/field-rangetime-wptpl.js
// 31.10.2025 13:54

(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base || null;
  var Time = Core && Core.Time ? Core.Time : null;
  if (!Registry || typeof Registry.register !== 'function' || !Base || !Time) {
    if (w._wpbc && w._wpbc.dev && w._wpbc.dev.error) {
      w._wpbc.dev.error('wpbc_bfb_field_rangetime', 'Missing Core registry/base/time-utils');
    }
    return;
  }

  // ---------------------------------------------------------------------
  // Small helpers local to this pack
  // ---------------------------------------------------------------------
  function emit_inspector_change(el) {
    if (!el) return;
    if (el.__wpbc_emitting) return;
    el.__wpbc_emitting = true;
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
    } finally {
      el.__wpbc_emitting = false;
    }
    Time.schedule_init_timeselector();
  }
  function get_current_format(panel) {
    var fmt = 'ampm';
    panel.querySelectorAll('.js-rt-label-fmt').forEach(function (r) {
      if (r.checked) fmt = r.value === '24h' ? '24h' : 'ampm';
    });
    return fmt;
  }
  function update_gen_visibility(panel) {
    var fmt = get_current_format(panel);
    var g24 = panel.querySelector('.js-rt-24h');
    var gam = panel.querySelector('.js-rt-ampm');
    if (g24) {
      g24.style.display = fmt === '24h' ? '' : 'none';
      g24.hidden = fmt !== '24h';
    }
    if (gam) {
      gam.style.display = fmt === 'ampm' ? '' : 'none';
      gam.hidden = fmt !== 'ampm';
    }
  }
  function enforce_locked_name(panel) {
    var hidden = panel && panel.querySelector('.js-locked-name[data-inspector-key="name"]');
    if (!hidden) return;
    hidden.value = hidden.value && hidden.value.trim() !== '' ? hidden.value : 'rangetime';
    emit_inspector_change(hidden);
  }

  // ---------------------------------------------------------------------
  // Canvas observer (to reinvoke external timeselector and sync inspectors)
  // ---------------------------------------------------------------------
  (function attachCanvasObserver() {
    var root = d.body,
      mo;
    function runSync() {
      try {
        w.__wpbc_rt_mo_pause && w.__wpbc_rt_mo_pause();
      } catch (e) {}
      d.querySelectorAll('.wpbc_bfb__inspector_rangetime').forEach(function (panel) {
        try {
          wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
        } catch (e) {}
      });
      try {
        w.__wpbc_rt_mo_resume && w.__wpbc_rt_mo_resume();
      } catch (e) {}
    }
    function handle(muts) {
      var found = false;
      for (var i = 0; i < muts.length && !found; i++) {
        var m = muts[i];
        // select itself modified
        if (m.type === 'childList' && m.target && m.target.matches && m.target.matches('.wpbc_bfb__preview-rangetime')) found = true;
        // added nodes?
        for (var j = 0; j < m.addedNodes.length && !found; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (n.matches && (n.matches('.wpbc_bfb__preview-rangetime') || n.matches('.wpbc_bfb__preview-timepicker'))) {
            found = true;
          } else if (n.querySelector && (n.querySelector('.wpbc_bfb__preview-rangetime') || n.querySelector('.wpbc_bfb__preview-timepicker'))) {
            found = true;
          }
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
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value', 'class']
      });
    } catch (e) {}
    w.__wpbc_rt_mo_pause = function () {
      try {
        mo && mo.disconnect();
      } catch (e) {}
    };
    w.__wpbc_rt_mo_resume = function () {
      try {
        mo && mo.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['value', 'class']
        });
      } catch (e) {}
    };
  })();

  // ---------------------------------------------------------------------
  // Renderer
  // ---------------------------------------------------------------------
  const wpbc_bfb_field_rangetime = class extends Base {
    static template_id = 'wpbc-bfb-field-rangetime';
    static kind = 'rangetime';
    static get_defaults() {
      return {
        kind: 'field',
        type: 'rangetime',
        label: 'Time',
        name: 'rangetime',
        html_id: '',
        required: true,
        multiple: false,
        size: null,
        cssclass: '',
        help: '',
        default_value: '',
        placeholder: '--- Select time ---',
        value_differs: true,
        min_width: '240px',
        options: [{
          label: '10:00 AM - 12:00 PM',
          value: '10:00 - 12:00',
          selected: false
        }, {
          label: '12:00 PM - 02:00 PM',
          value: '12:00 - 14:00',
          selected: false
        }, {
          label: '02:00 PM - 04:00 PM',
          value: '14:00 - 16:00',
          selected: false
        }, {
          label: '04:00 PM - 06:00 PM',
          value: '16:00 - 18:00',
          selected: false
        }, {
          label: '06:00 PM - 08:00 PM',
          value: '18:00 - 20:00',
          selected: false
        }],
        gen_label_fmt: 'ampm',
        gen_start_24h: '09:00',
        gen_end_24h: '18:00',
        gen_start_ampm_t: '09:00',
        gen_end_ampm_t: '18:00',
        gen_step_h: 0,
        gen_step_m: 30
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
    static on_field_drop(data, el, ctx) {
      if (super.on_field_drop) super.on_field_drop(data, el, ctx);
      try {
        // Keep data model canonical
        if (data && typeof data === 'object') {
          data.name = 'rangetime';
          data.required = true;
        }
        // Lock dataset flags on the dropped element
        if (el && el.dataset) {
          el.dataset.name = 'rangetime';
          el.dataset.autoname = '0';
          el.dataset.fresh = '0';
          el.dataset.name_user_touched = '1';
          el.setAttribute('data-required', 'true');
        }
        // Sync the preview control (<select>) immediately
        var sel = el && el.querySelector('select.wpbc_bfb__preview-rangetime');
        if (sel) sel.setAttribute('name', 'rangetime');
        // If Inspector is present, update the hidden "name" proxy and notify
        var hidden = d.querySelector('.wpbc_bfb__inspector_rangetime .js-locked-name[data-inspector-key="name"]');
        if (hidden) {
          hidden.value = 'rangetime';
          hidden.setAttribute('data-locked', '1');
          if (typeof emit_inspector_change === 'function') emit_inspector_change(hidden);
        }
      } catch (e) {}
    }

    // Bind once for all inspector panels (events).
    static bind_inspector_events_once() {
      if (this._bound_once) return;
      this._bound_once = true;

      // Persist placeholder when toggling global picker
      d.addEventListener('change', function (ev) {
        var tgl = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-toggle-timeslot-picker');
        if (!tgl) return;
        var panel = tgl.closest('.wpbc_bfb__inspector_rangetime');
        var ph = panel && panel.querySelector('.js-placeholder');
        if (ph) emit_inspector_change(ph);
      });

      // AM/PM <-> 24h switch
      d.addEventListener('change', function (ev) {
        var radio = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-rt-label-fmt');
        if (!radio) return;
        var panel = radio.closest('.wpbc_bfb__inspector_rangetime');
        if (!panel) return;
        var fmt = get_current_format(panel); // 'ampm' | '24h'
        var proxy = panel.querySelector('.js-rt-label-fmt-value');
        if (proxy) {
          proxy.value = fmt;
          emit_inspector_change(proxy);
        }
        update_gen_visibility(panel);

        // Sync generator values across groups.
        if (fmt === '24h') {
          var s_t = (panel.querySelector('.js-gen-start-ampm-time') || {}).value || '';
          var e_t = (panel.querySelector('.js-gen-end-ampm-time') || {}).value || '';
          var s_m = Time.parse_hhmm_24h(s_t),
            e_m = Time.parse_hhmm_24h(e_t);
          var s24 = isNaN(s_m) ? '' : Time.format_minutes_24h(s_m);
          var e24 = isNaN(e_m) ? '' : Time.format_minutes_24h(e_m);
          var s24el = panel.querySelector('.js-gen-start-24h');
          var e24el = panel.querySelector('.js-gen-end-24h');
          if (s24el) {
            s24el.value = s24;
            emit_inspector_change(s24el);
          }
          if (e24el) {
            e24el.value = e24;
            emit_inspector_change(e24el);
          }
        } else {
          var s24t = (panel.querySelector('.js-gen-start-24h') || {}).value || '';
          var e24t = (panel.querySelector('.js-gen-end-24h') || {}).value || '';
          var s_m2 = Time.parse_hhmm_24h(s24t),
            e_m2 = Time.parse_hhmm_24h(e24t);
          var sam = isNaN(s_m2) ? '' : Time.format_minutes_24h(s_m2);
          var eam = isNaN(e_m2) ? '' : Time.format_minutes_24h(e_m2);
          var st_el = panel.querySelector('.js-gen-start-ampm-time');
          var et_el = panel.querySelector('.js-gen-end-ampm-time');
          if (st_el) {
            st_el.value = sam;
            emit_inspector_change(st_el);
          }
          if (et_el) {
            et_el.value = eam;
            emit_inspector_change(et_el);
          }
        }
        Time.rebuild_all_rows_to_format(panel, fmt);
        if (fmt === '24h') Time.apply_imask_in_container_24h(panel);
        wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
        Core.UI.pulse_query_debounced(panel, '.js-rt-generate'); // avoid reflow spam while typing
      });

      // Mask on focus (24h)
      d.addEventListener('focusin', function (ev) {
        var el = ev.target && ev.target.closest('.js-rt-mask[data-mask-kind="24h"]');
        if (el && !el._imask) Time.apply_imask_to_input(el);
      });

      // Duration range <-> number sync
      d.addEventListener('input', function (ev) {
        var range = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime [data-len-group] [data-len-range]');
        if (!range) return;
        var group = range.closest('[data-len-group]');
        var num = group && group.querySelector('[data-len-value]');
        if (num) {
          num.value = range.value;
          if (num.hasAttribute('data-inspector-key')) emit_inspector_change(num);
        }
        const panel = (range || num).closest('.wpbc_bfb__inspector_rangetime');
        Core.UI.pulse_query_debounced(panel, '.js-rt-generate'); // avoid reflow spam while typing
      });
      d.addEventListener('input', function (ev) {
        var num = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime [data-len-group] [data-len-value]');
        if (!num) return;
        var group = num.closest('[data-len-group]');
        var range = group && group.querySelector('[data-len-range]');
        if (range) range.value = num.value;
        const panel = (range || num).closest('.wpbc_bfb__inspector_rangetime');
        Core.UI.pulse_query_debounced(panel, '.js-rt-generate'); // avoid reflow spam while typing
      });

      // Pulse when any generator input changes (both formats + step)
      d.addEventListener('input', function (ev) {
        const genInput = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-gen-start-24h,' + '.wpbc_bfb__inspector_rangetime .js-gen-end-24h,' + '.wpbc_bfb__inspector_rangetime .js-gen-start-ampm-time,' + '.wpbc_bfb__inspector_rangetime .js-gen-end-ampm-time,' + '.wpbc_bfb__inspector_rangetime .js-gen-step-h,' + '.wpbc_bfb__inspector_rangetime .js-gen-step-m');
        if (!genInput) return;
        const panel = genInput.closest('.wpbc_bfb__inspector_rangetime');
        Core.UI.pulse_query_debounced(panel, '.js-rt-generate'); // avoid reflow spam while typing
      });

      // Generate slots
      d.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-rt-generate');
        if (!btn) return;
        ev.preventDefault();
        var panel = btn.closest('.wpbc_bfb__inspector_rangetime');
        if (!panel) return;
        var fmt = get_current_format(panel);
        var start_m, end_m;
        if (fmt === '24h') {
          var s24 = (panel.querySelector('.js-gen-start-24h') || {}).value || '';
          var e24 = (panel.querySelector('.js-gen-end-24h') || {}).value || '';
          start_m = Time.parse_hhmm_24h(s24);
          end_m = Time.parse_hhmm_24h(e24);
        } else {
          var s_am = (panel.querySelector('.js-gen-start-ampm-time') || {}).value || '';
          var e_am = (panel.querySelector('.js-gen-end-ampm-time') || {}).value || '';
          start_m = Time.parse_hhmm_24h(s_am); // input[type=time] => "HH:MM"
          end_m = Time.parse_hhmm_24h(e_am);
        }
        var step_h = parseInt((panel.querySelector('.js-gen-step-h') || {}).value, 10) || 0;
        var step_m = parseInt((panel.querySelector('.js-gen-step-m') || {}).value, 10) || 0;
        var step = Math.max(1, step_h * 60 + step_m);
        var slots = Time.build_time_slots(start_m, end_m, step, fmt);
        wpbc_bfb_field_rangetime.replace_options_in_panel(panel, slots);
        Time.rebuild_all_rows_to_format(panel, fmt);
        if (fmt === '24h') Time.apply_imask_in_container_24h(panel);
        wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
      });

      // Clear
      d.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .js-rt-clear');
        if (!btn) return;
        ev.preventDefault();
        var panel = btn.closest('.wpbc_bfb__inspector_rangetime');
        if (!panel) return;
        wpbc_bfb_field_rangetime.replace_options_in_panel(panel, []);
        wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
        Core.UI.pulse_query_debounced(panel, '.js-rt-generate'); // avoid reflow spam while typing
      });

      // Add option
      d.addEventListener('click', function (ev) {
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
      d.addEventListener('click', function (ev) {
        var a = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .rt_dropdown_action');
        if (!a) return;
        ev.preventDefault();
        var action = a.getAttribute('data-rt-action') || '';
        var row = a.closest('.wpbc_bfb__options_row');
        var panel = a.closest('.wpbc_bfb__inspector_rangetime');
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
      d.addEventListener('input', function (ev) {
        var row = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .wpbc_bfb__options_row');
        if (!row) return;
        var panel = row.closest('.wpbc_bfb__inspector_rangetime');
        wpbc_bfb_field_rangetime.sync_state_from_rows(panel);
      });
      d.addEventListener('change', function (ev) {
        var row = ev.target && ev.target.closest('.wpbc_bfb__inspector_rangetime .wpbc_bfb__options_row');
        if (!row) return;
        if (ev.target.classList.contains('wpbc_bfb__opt-selected-chk')) {
          var panel = row.closest('.wpbc_bfb__inspector_rangetime');
          if (panel && !panel.querySelector('.js-opt-multiple:checked')) {
            panel.querySelectorAll('.wpbc_bfb__opt-selected-chk').forEach(function (chk) {
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
      var init = function () {
        d.querySelectorAll('.wpbc_bfb__inspector_rangetime').forEach(function (panel) {
          update_gen_visibility(panel);
          var fmt = get_current_format(panel);
          if (fmt === '24h') Time.apply_imask_in_container_24h(panel);

          // placeholder disabled state mirror (if multiple is shown in future)
          var mul = panel.querySelector('.js-opt-multiple');
          var ph = panel.querySelector('.js-placeholder');
          var phNote = panel.querySelector('.js-placeholder-note');
          if (mul && ph) ph.disabled = !!mul.checked;
          if (mul && phNote) phNote.style.display = mul.checked ? 'none' : '';
          enforce_locked_name(panel);
          var ph_init = panel.querySelector('.js-placeholder');
          if (ph_init) emit_inspector_change(ph_init);
        });
      };
      d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', init) : init();

      // Re-apply when Inspector re-renders a panel
      d.addEventListener('wpbc_bfb_inspector_ready', function (ev) {
        var panel = ev && ev.detail && ev.detail.panel;
        if (!panel) return;
        var rtPanel = panel.closest ? panel.matches('.wpbc_bfb__inspector_rangetime') ? panel : panel.closest('.wpbc_bfb__inspector_rangetime') : null;
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
    static build_row_html(data, fmt, panel) {
      var label = data && data.label || '';
      var value = data && data.value || '';
      var parts = String(value).split(/\s*-\s*/);
      var start = parts[0] || '';
      var end = parts[1] || '';
      var uid = 'wpbc_ins_rt_' + Math.random().toString(36).slice(2, 10);
      var sel = !!(data && (true === data.selected || 'true' === data.selected || 1 === data.selected || '1' === data.selected));
      var i18n = {
        add: panel && panel.dataset.i18nAdd || 'Add New',
        duplicate: panel && panel.dataset.i18nDuplicate || 'Duplicate',
        remove: panel && panel.dataset.i18nRemove || 'Remove',
        def: panel && panel.dataset.i18nDefault || w.wpbc_i18n_default || 'Default',
        reorder: panel && panel.dataset.i18nReorder || 'Drag to reorder',
        rowlabel: panel && panel.dataset.i18nRowlabel || 'Label (e.g. 10:00 AM - 10:30 AM)'
      };
      var time_inputs_html;
      if (fmt === '24h') {
        time_inputs_html = '<input type="text" class="wpbc_bfb__opt-start js-rt-mask" data-mask-kind="24h" placeholder="HH:MM" value="' + Time.esc_attr(start) + '">' + '<span class="wpbc_bfb__opt-sep" aria-hidden="true">-</span>' + '<input type="text" class="wpbc_bfb__opt-end js-rt-mask" data-mask-kind="24h" placeholder="HH:MM" value="' + Time.esc_attr(end) + '">';
      } else {
        time_inputs_html = '<input type="time" class="wpbc_bfb__opt-start js-rt-start-time" step="300" value="' + Time.esc_attr(start) + '">' + '<span class="wpbc_bfb__opt-sep" aria-hidden="true">-</span>' + '<input type="time" class="wpbc_bfb__opt-end js-rt-end-time" step="300" value="' + Time.esc_attr(end) + '">';
      }
      return '' + '<div class="wpbc_bfb__options_row" data-index="0">' + '<span class="wpbc_bfb__drag-handle" title="' + i18n.reorder + '"><span class="wpbc_icn_drag_indicator"></span></span>' + '<input type="text" class="wpbc_bfb__opt-label" placeholder="' + i18n.rowlabel + '" value="' + Time.esc_attr(label) + '">' + time_inputs_html + '<input type="text" class="wpbc_bfb__opt-value" value="' + Time.esc_attr(value || (start && end ? start + ' - ' + end : '')) + '" hidden>' + '<div class="wpbc_bfb__opt-selected">' + '<div class="inspector__control wpbc_ui__toggle">' + '<input type="checkbox" class="wpbc_bfb__opt-selected-chk inspector__input" id="' + uid + '" role="switch" ' + (sel ? 'checked aria-checked="true"' : 'aria-checked="false"') + '>' + '<label class="wpbc_ui__toggle_icon_radio" for="' + uid + '"></label>' + '<label class="wpbc_ui__toggle_label" for="' + uid + '">' + i18n.def + '</label>' + '</div>' + '</div>' + '<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown">' + '<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false" class="ul_dropdown_menu_toggle">' + '<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>' + '</a>' + '<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">' + '<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="add_after" href="javascript:void(0)">' + i18n.add + '<i class="menu_icon icon-1x wpbc_icn_add_circle"></i></a></li>' + '<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="duplicate" href="javascript:void(0)">' + i18n.duplicate + '<i class="menu_icon icon-1x wpbc_icn_content_copy"></i></a></li>' + '<li class="divider"></li>' + '<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="remove" href="javascript:void(0)">' + i18n.remove + '<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></a></li>' + '</ul>' + '</div>' + '</div>';
    }
    static add_option_row(panel) {
      var list = panel.querySelector('.wpbc_bfb__options_list');
      if (!list) return;
      var fmt = get_current_format(panel);
      var s = 9 * 60,
        e = s + 30;
      var start = Time.format_minutes_24h(s);
      var end = Time.format_minutes_24h(e);
      var label = fmt === '24h' ? start + ' - ' + end : Time.format_minutes_ampm(s) + ' - ' + Time.format_minutes_ampm(e);
      var html = wpbc_bfb_field_rangetime.build_row_html({
        label: label,
        value: start + ' - ' + end,
        selected: false
      }, fmt, panel);
      var tmp = d.createElement('div');
      tmp.innerHTML = html;
      var row = tmp.firstElementChild;
      list.appendChild(row);
      wpbc_bfb_field_rangetime.reindex_rows(list);
      if (fmt === '24h') {
        Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-start'));
        Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-end'));
      }
    }
    static insert_row_after(panel, after_row, data) {
      var list = panel.querySelector('.wpbc_bfb__options_list');
      if (!list) return;
      var fmt = get_current_format(panel);
      if (!data) {
        var s = 9 * 60,
          e = s + 30;
        var start = Time.format_minutes_24h(s),
          end = Time.format_minutes_24h(e);
        data = {
          label: fmt === '24h' ? start + ' - ' + end : Time.format_minutes_ampm(s) + ' - ' + Time.format_minutes_ampm(e),
          value: start + ' - ' + end,
          selected: false
        };
      }
      var html = wpbc_bfb_field_rangetime.build_row_html(data, fmt, panel);
      var tmp = d.createElement('div');
      tmp.innerHTML = html;
      var row = tmp.firstElementChild;
      after_row.parentNode.insertBefore(row, after_row.nextSibling);
      wpbc_bfb_field_rangetime.reindex_rows(list);
      if (fmt === '24h') {
        Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-start'));
        Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-end'));
      }
    }
    static read_row(row, fmt) {
      var label = (row.querySelector('.wpbc_bfb__opt-label') || {}).value || '';
      var s_el = row.querySelector('.wpbc_bfb__opt-start');
      var e_el = row.querySelector('.wpbc_bfb__opt-end');
      var s_m = Time.parse_hhmm_24h(s_el ? s_el.value : '');
      var e_m = Time.parse_hhmm_24h(e_el ? e_el.value : '');
      if (isNaN(s_m)) s_m = Time.parse_minutes(s_el ? s_el.value : '');
      if (isNaN(e_m)) e_m = Time.parse_minutes(e_el ? e_el.value : '');

      // Allow export even when end <= start (overnight ranges)
      var value = !isNaN(s_m) && !isNaN(e_m) ? Time.format_minutes_24h(s_m) + ' - ' + Time.format_minutes_24h(e_m) : '';
      var sel = !!(row.querySelector('.wpbc_bfb__opt-selected-chk') || {}).checked;
      return {
        label: label,
        value: value,
        selected: sel
      };
    }
    static sync_state_from_rows(panel) {
      if (!panel) return;
      var list = panel.querySelector('.wpbc_bfb__options_list');
      var state = panel.querySelector('.wpbc_bfb__options_state');
      if (!list || !state) return;
      var isMultiple = !!panel.querySelector('.js-opt-multiple:checked');
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
            if (chk) {
              chk.checked = false;
              chk.setAttribute('aria-checked', 'false');
            }
          }
        }
        out.push(obj);
        var hv = row.querySelector('.wpbc_bfb__opt-value');
        if (hv) hv.value = obj.value || '';
      });
      try {
        state.value = JSON.stringify(out);
      } catch (e) {
        state.value = '[]';
      }
      emit_inspector_change(state);
    }
    static replace_options_in_panel(panel, slots) {
      var list = panel.querySelector('.wpbc_bfb__options_list');
      var state = panel.querySelector('.wpbc_bfb__options_state');
      if (!list || !state) return;
      var fmt = get_current_format(panel);
      list.innerHTML = '';
      (slots || []).forEach(function (opt) {
        var html = wpbc_bfb_field_rangetime.build_row_html(opt, fmt, panel);
        var tmp = d.createElement('div');
        tmp.innerHTML = html;
        list.appendChild(tmp.firstElementChild);
      });
      wpbc_bfb_field_rangetime.reindex_rows(list);
      if (fmt === '24h') Time.apply_imask_in_container_24h(panel);
      try {
        state.value = JSON.stringify(slots || []);
      } catch (e) {
        state.value = '[]';
      }
      emit_inspector_change(state);
    }
    static reindex_rows(list) {
      if (!list) return;
      var i = 0;
      list.querySelectorAll('.wpbc_bfb__options_row').forEach(function (row) {
        row.setAttribute('data-index', String(i++));
      });
    }
  };
  try {
    Registry.register('rangetime', wpbc_bfb_field_rangetime);
  } catch (e) {
    if (w._wpbc && w._wpbc.dev && w._wpbc.dev.error) w._wpbc.dev.error('wpbc_bfb_field_rangetime.register', e);
  }
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
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('rangetime')) {
      return;
    }
    var S = Core.WPBC_BFB_Sanitize || {};
    var esc_html = S.escape_html || function (v) {
      return String(v);
    };

    /**
     * @type {WPBC_BFB_ExporterCallback}
     */
    var exporter_callback = function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var ctx = extras.ctx;

      // Shared label wrapper: prefer global helper; fall back to local behavior.
      var emit_label_then = function (body) {
        // Preferred path: centralized helper in builder-exporter.js
        if (Exp && typeof Exp.emit_label_then === 'function') {
          Exp.emit_label_then(field, emit, body, cfg);
          return;
        }
      };

      // Required marker (same semantics as other text-like fields).
      var is_req = Exp.is_required(field);
      var req_mark = is_req ? '*' : '';

      // Name / id / classes from shared helpers so they stay in sync.
      var name = Exp.compute_name('rangetime', field);
      var id_opt = Exp.id_option(field, ctx);
      var cls_opts = Exp.class_options(field);

      // Prefer the dedicated time helper to keep exact legacy shortcode shape.
      if (typeof Exp.emit_time_select === 'function') {
        Exp.emit_time_select(name, field, req_mark, id_opt, cls_opts, emit_label_then);
        return;
      }
    };
    Exp.register('rangetime', exporter_callback);
  }
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_rangetime_booking_form_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:exporter-ready', register_rangetime_booking_form_exporter, {
      once: true
    });
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
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('rangetime')) {
      return;
    }
    C.register('rangetime', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }

      // Keep exported name identical to the Booking Form exporter.
      var name = Exp.compute_name('rangetime', field);
      if (!name) {
        return;
      }
      var raw_label = typeof field.label === 'string' ? field.label : '';
      var label = raw_label.trim() || name;

      // Shared helper: <b>Label</b>: <f>[name]</f><br>
      C.emit_line_bold_field(emit, label, name, cfg);
    });
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_rangetime_booking_data_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_rangetime_booking_data_exporter, {
      once: true
    });
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGltZS1yYW5nZS9fb3V0L2ZpZWxkLXJhbmdldGltZS13cHRwbC5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJSZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJUaW1lIiwicmVnaXN0ZXIiLCJfd3BiYyIsImRldiIsImVycm9yIiwiZW1pdF9pbnNwZWN0b3JfY2hhbmdlIiwiZWwiLCJfX3dwYmNfZW1pdHRpbmciLCJqUXVlcnkiLCJ0cmlnZ2VyIiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiYnViYmxlcyIsInNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yIiwiZ2V0X2N1cnJlbnRfZm9ybWF0IiwicGFuZWwiLCJmbXQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsInIiLCJjaGVja2VkIiwidmFsdWUiLCJ1cGRhdGVfZ2VuX3Zpc2liaWxpdHkiLCJnMjQiLCJxdWVyeVNlbGVjdG9yIiwiZ2FtIiwic3R5bGUiLCJkaXNwbGF5IiwiaGlkZGVuIiwiZW5mb3JjZV9sb2NrZWRfbmFtZSIsInRyaW0iLCJhdHRhY2hDYW52YXNPYnNlcnZlciIsInJvb3QiLCJib2R5IiwibW8iLCJydW5TeW5jIiwiX193cGJjX3J0X21vX3BhdXNlIiwiZSIsIndwYmNfYmZiX2ZpZWxkX3JhbmdldGltZSIsInN5bmNfc3RhdGVfZnJvbV9yb3dzIiwiX193cGJjX3J0X21vX3Jlc3VtZSIsImhhbmRsZSIsIm11dHMiLCJmb3VuZCIsImkiLCJsZW5ndGgiLCJtIiwidHlwZSIsInRhcmdldCIsIm1hdGNoZXMiLCJqIiwiYWRkZWROb2RlcyIsIm4iLCJub2RlVHlwZSIsIk11dGF0aW9uT2JzZXJ2ZXIiLCJvYnNlcnZlIiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsImF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVGaWx0ZXIiLCJkaXNjb25uZWN0IiwidGVtcGxhdGVfaWQiLCJraW5kIiwiZ2V0X2RlZmF1bHRzIiwibGFiZWwiLCJuYW1lIiwiaHRtbF9pZCIsInJlcXVpcmVkIiwibXVsdGlwbGUiLCJzaXplIiwiY3NzY2xhc3MiLCJoZWxwIiwiZGVmYXVsdF92YWx1ZSIsInBsYWNlaG9sZGVyIiwidmFsdWVfZGlmZmVycyIsIm1pbl93aWR0aCIsIm9wdGlvbnMiLCJzZWxlY3RlZCIsImdlbl9sYWJlbF9mbXQiLCJnZW5fc3RhcnRfMjRoIiwiZ2VuX2VuZF8yNGgiLCJnZW5fc3RhcnRfYW1wbV90IiwiZ2VuX2VuZF9hbXBtX3QiLCJnZW5fc3RlcF9oIiwiZ2VuX3N0ZXBfbSIsIm9uX2ZpZWxkX2Ryb3AiLCJkYXRhIiwiY3R4IiwiZGF0YXNldCIsImF1dG9uYW1lIiwiZnJlc2giLCJuYW1lX3VzZXJfdG91Y2hlZCIsInNldEF0dHJpYnV0ZSIsInNlbCIsImJpbmRfaW5zcGVjdG9yX2V2ZW50c19vbmNlIiwiX2JvdW5kX29uY2UiLCJhZGRFdmVudExpc3RlbmVyIiwiZXYiLCJ0Z2wiLCJjbG9zZXN0IiwicGgiLCJyYWRpbyIsInByb3h5Iiwic190IiwiZV90Iiwic19tIiwicGFyc2VfaGhtbV8yNGgiLCJlX20iLCJzMjQiLCJpc05hTiIsImZvcm1hdF9taW51dGVzXzI0aCIsImUyNCIsInMyNGVsIiwiZTI0ZWwiLCJzMjR0IiwiZTI0dCIsInNfbTIiLCJlX20yIiwic2FtIiwiZWFtIiwic3RfZWwiLCJldF9lbCIsInJlYnVpbGRfYWxsX3Jvd3NfdG9fZm9ybWF0IiwiYXBwbHlfaW1hc2tfaW5fY29udGFpbmVyXzI0aCIsIlVJIiwicHVsc2VfcXVlcnlfZGVib3VuY2VkIiwiX2ltYXNrIiwiYXBwbHlfaW1hc2tfdG9faW5wdXQiLCJyYW5nZSIsImdyb3VwIiwibnVtIiwiaGFzQXR0cmlidXRlIiwiZ2VuSW5wdXQiLCJidG4iLCJwcmV2ZW50RGVmYXVsdCIsInN0YXJ0X20iLCJlbmRfbSIsInNfYW0iLCJlX2FtIiwic3RlcF9oIiwicGFyc2VJbnQiLCJzdGVwX20iLCJzdGVwIiwiTWF0aCIsIm1heCIsInNsb3RzIiwiYnVpbGRfdGltZV9zbG90cyIsInJlcGxhY2Vfb3B0aW9uc19pbl9wYW5lbCIsImFkZF9vcHRpb25fcm93IiwiYSIsImFjdGlvbiIsImdldEF0dHJpYnV0ZSIsInJvdyIsImluc2VydF9yb3dfYWZ0ZXIiLCJyZWFkX3JvdyIsImxpc3RFbCIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsInJlaW5kZXhfcm93cyIsImZtdDIiLCJjbGFzc0xpc3QiLCJjb250YWlucyIsImNoayIsInBhbmVsMiIsImluaXQiLCJtdWwiLCJwaE5vdGUiLCJkaXNhYmxlZCIsInBoX2luaXQiLCJyZWFkeVN0YXRlIiwiZGV0YWlsIiwicnRQYW5lbCIsImJ1aWxkX3Jvd19odG1sIiwicGFydHMiLCJTdHJpbmciLCJzcGxpdCIsInN0YXJ0IiwiZW5kIiwidWlkIiwicmFuZG9tIiwidG9TdHJpbmciLCJzbGljZSIsImkxOG4iLCJhZGQiLCJpMThuQWRkIiwiZHVwbGljYXRlIiwiaTE4bkR1cGxpY2F0ZSIsInJlbW92ZSIsImkxOG5SZW1vdmUiLCJkZWYiLCJpMThuRGVmYXVsdCIsIndwYmNfaTE4bl9kZWZhdWx0IiwicmVvcmRlciIsImkxOG5SZW9yZGVyIiwicm93bGFiZWwiLCJpMThuUm93bGFiZWwiLCJ0aW1lX2lucHV0c19odG1sIiwiZXNjX2F0dHIiLCJsaXN0IiwicyIsImZvcm1hdF9taW51dGVzX2FtcG0iLCJodG1sIiwidG1wIiwiY3JlYXRlRWxlbWVudCIsImlubmVySFRNTCIsImZpcnN0RWxlbWVudENoaWxkIiwiYXBwZW5kQ2hpbGQiLCJhZnRlcl9yb3ciLCJpbnNlcnRCZWZvcmUiLCJuZXh0U2libGluZyIsInNfZWwiLCJlX2VsIiwicGFyc2VfbWludXRlcyIsInN0YXRlIiwiaXNNdWx0aXBsZSIsInNlZW5TZWxlY3RlZCIsIm91dCIsIm9iaiIsInB1c2giLCJodiIsIkpTT04iLCJzdHJpbmdpZnkiLCJvcHQiLCJXUEJDX0JGQl9GaWVsZF9SYW5nZVRpbWUiLCJyZWdpc3Rlcl9yYW5nZXRpbWVfYm9va2luZ19mb3JtX2V4cG9ydGVyIiwiRXhwIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJoYXNfZXhwb3J0ZXIiLCJTIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJlc2NfaHRtbCIsImVzY2FwZV9odG1sIiwidiIsImV4cG9ydGVyX2NhbGxiYWNrIiwiZmllbGQiLCJlbWl0IiwiZXh0cmFzIiwiY2ZnIiwiZW1pdF9sYWJlbF90aGVuIiwiaXNfcmVxIiwiaXNfcmVxdWlyZWQiLCJyZXFfbWFyayIsImNvbXB1dGVfbmFtZSIsImlkX29wdCIsImlkX29wdGlvbiIsImNsc19vcHRzIiwiY2xhc3Nfb3B0aW9ucyIsImVtaXRfdGltZV9zZWxlY3QiLCJkb2N1bWVudCIsIm9uY2UiLCJyZWdpc3Rlcl9yYW5nZXRpbWVfYm9va2luZ19kYXRhX2V4cG9ydGVyIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsInJhd19sYWJlbCIsImVtaXRfbGluZV9ib2xkX2ZpZWxkIiwid2luZG93Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGltZS1yYW5nZS9fc3JjL2ZpZWxkLXJhbmdldGltZS13cHRwbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBXUEJDIEJGQiBQYWNrOiBSYW5nZSBUaW1lICh0aW1lLXNsb3RzKVxyXG4vLyBVc2VzIHNoYXJlZCBoZWxwZXJzIGZyb20gV1BCQ19CRkJfQ29yZS5UaW1lXHJcbi8vIFZlcnNpb24gMS43LjIg4oCUIGFkZCBCb29raW5nIEZvcm0gKyBCb29raW5nIERhdGEgZXhwb3J0ZXJzIGZvciBcInJhbmdldGltZVwiXHJcbi8vIEZpbGU6IC4uL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3RpbWUtcmFuZ2UvX291dC9maWVsZC1yYW5nZXRpbWUtd3B0cGwuanNcclxuLy8gMzEuMTAuMjAyNSAxMzo1NFxyXG5cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHR2YXIgQ29yZSAgICAgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0dmFyIFJlZ2lzdHJ5ID0gQ29yZS5XUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeTtcclxuXHR2YXIgQmFzZSAgICAgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX0Jhc2UgfHwgbnVsbDtcclxuXHR2YXIgVGltZSAgICAgPSAoQ29yZSAmJiBDb3JlLlRpbWUpID8gQ29yZS5UaW1lIDogbnVsbDtcclxuXHJcblx0aWYgKCAhUmVnaXN0cnkgfHwgdHlwZW9mIFJlZ2lzdHJ5LnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nIHx8ICFCYXNlIHx8ICFUaW1lICkge1xyXG5cdFx0aWYgKHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgdy5fd3BiYy5kZXYuZXJyb3IpIHtcclxuXHRcdFx0dy5fd3BiYy5kZXYuZXJyb3IoJ3dwYmNfYmZiX2ZpZWxkX3JhbmdldGltZScsICdNaXNzaW5nIENvcmUgcmVnaXN0cnkvYmFzZS90aW1lLXV0aWxzJyk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBTbWFsbCBoZWxwZXJzIGxvY2FsIHRvIHRoaXMgcGFja1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIGVtaXRfaW5zcGVjdG9yX2NoYW5nZShlbCl7XHJcblx0XHRpZiAoIWVsKSByZXR1cm47XHJcblx0XHRpZiAoZWwuX193cGJjX2VtaXR0aW5nKSByZXR1cm47XHJcblx0XHRlbC5fX3dwYmNfZW1pdHRpbmcgPSB0cnVlO1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKHcualF1ZXJ5KSB7IHcualF1ZXJ5KGVsKS50cmlnZ2VyKCdpbnB1dCcpLnRyaWdnZXIoJ2NoYW5nZScpOyB9XHJcblx0XHRcdGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHtidWJibGVzOnRydWV9KSk7XHJcblx0XHRcdGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnLCB7YnViYmxlczp0cnVlfSkpO1xyXG5cdFx0fSBmaW5hbGx5IHtcclxuXHRcdFx0ZWwuX193cGJjX2VtaXR0aW5nID0gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRUaW1lLnNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfY3VycmVudF9mb3JtYXQocGFuZWwpe1xyXG5cdFx0dmFyIGZtdCA9ICdhbXBtJztcclxuXHRcdHBhbmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5qcy1ydC1sYWJlbC1mbXQnKS5mb3JFYWNoKGZ1bmN0aW9uIChyKSB7XHJcblx0XHRcdGlmIChyLmNoZWNrZWQpIGZtdCA9IChyLnZhbHVlID09PSAnMjRoJykgPyAnMjRoJyA6ICdhbXBtJztcclxuXHRcdH0pO1xyXG5cdFx0cmV0dXJuIGZtdDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZV9nZW5fdmlzaWJpbGl0eShwYW5lbCl7XHJcblx0XHR2YXIgZm10ID0gZ2V0X2N1cnJlbnRfZm9ybWF0KHBhbmVsKTtcclxuXHRcdHZhciBnMjQgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtcnQtMjRoJyk7XHJcblx0XHR2YXIgZ2FtID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLXJ0LWFtcG0nKTtcclxuXHRcdGlmIChnMjQpIHsgZzI0LnN0eWxlLmRpc3BsYXkgPSAoZm10ID09PSAnMjRoJykgPyAnJyA6ICdub25lJzsgZzI0LmhpZGRlbiA9IChmbXQgIT09ICcyNGgnKTsgfVxyXG5cdFx0aWYgKGdhbSkgeyBnYW0uc3R5bGUuZGlzcGxheSA9IChmbXQgPT09ICdhbXBtJykgPyAnJyA6ICdub25lJzsgZ2FtLmhpZGRlbiA9IChmbXQgIT09ICdhbXBtJyk7IH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVuZm9yY2VfbG9ja2VkX25hbWUocGFuZWwpe1xyXG5cdFx0dmFyIGhpZGRlbiA9IHBhbmVsICYmIHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1sb2NrZWQtbmFtZVtkYXRhLWluc3BlY3Rvci1rZXk9XCJuYW1lXCJdJyk7XHJcblx0XHRpZiAoIWhpZGRlbikgcmV0dXJuO1xyXG5cdFx0aGlkZGVuLnZhbHVlID0gKGhpZGRlbi52YWx1ZSAmJiBoaWRkZW4udmFsdWUudHJpbSgpICE9PSAnJykgPyBoaWRkZW4udmFsdWUgOiAncmFuZ2V0aW1lJztcclxuXHRcdGVtaXRfaW5zcGVjdG9yX2NoYW5nZShoaWRkZW4pO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ2FudmFzIG9ic2VydmVyICh0byByZWludm9rZSBleHRlcm5hbCB0aW1lc2VsZWN0b3IgYW5kIHN5bmMgaW5zcGVjdG9ycylcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQoZnVuY3Rpb24gYXR0YWNoQ2FudmFzT2JzZXJ2ZXIoKXtcclxuXHRcdHZhciByb290ID0gZC5ib2R5LCBtbztcclxuXHJcblx0XHRmdW5jdGlvbiBydW5TeW5jKCl7XHJcblx0XHRcdHRyeSB7IHcuX193cGJjX3J0X21vX3BhdXNlICYmIHcuX193cGJjX3J0X21vX3BhdXNlKCk7IH0gY2F0Y2goZSl7fVxyXG5cdFx0XHRkLnF1ZXJ5U2VsZWN0b3JBbGwoJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZScpLmZvckVhY2goZnVuY3Rpb24ocGFuZWwpe1xyXG5cdFx0XHRcdHRyeSB7IHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5zeW5jX3N0YXRlX2Zyb21fcm93cyhwYW5lbCk7IH0gY2F0Y2goZSl7fVxyXG5cdFx0XHR9KTtcclxuXHRcdFx0dHJ5IHsgdy5fX3dwYmNfcnRfbW9fcmVzdW1lICYmIHcuX193cGJjX3J0X21vX3Jlc3VtZSgpOyB9IGNhdGNoKGUpe31cclxuXHRcdH1cclxuXHJcblx0XHRmdW5jdGlvbiBoYW5kbGUobXV0cyl7XHJcblx0XHRcdHZhciBmb3VuZCA9IGZhbHNlO1xyXG5cdFx0XHRmb3IgKHZhciBpPTA7aTxtdXRzLmxlbmd0aCAmJiAhZm91bmQ7aSsrKXtcclxuXHRcdFx0XHR2YXIgbSA9IG11dHNbaV07XHJcblx0XHRcdFx0Ly8gc2VsZWN0IGl0c2VsZiBtb2RpZmllZFxyXG5cdFx0XHRcdGlmIChtLnR5cGUgPT09ICdjaGlsZExpc3QnICYmIG0udGFyZ2V0ICYmIG0udGFyZ2V0Lm1hdGNoZXMgJiYgbS50YXJnZXQubWF0Y2hlcygnLndwYmNfYmZiX19wcmV2aWV3LXJhbmdldGltZScpKSBmb3VuZCA9IHRydWU7XHJcblx0XHRcdFx0Ly8gYWRkZWQgbm9kZXM/XHJcblx0XHRcdFx0Zm9yICh2YXIgaj0wO2o8bS5hZGRlZE5vZGVzLmxlbmd0aCAmJiAhZm91bmQ7aisrKXtcclxuXHRcdFx0XHRcdHZhciBuID0gbS5hZGRlZE5vZGVzW2pdO1xyXG5cdFx0XHRcdFx0aWYgKG4ubm9kZVR5cGUgIT09IDEpIGNvbnRpbnVlO1xyXG5cdFx0XHRcdFx0IGlmICggbi5tYXRjaGVzICYmIChuLm1hdGNoZXMoJy53cGJjX2JmYl9fcHJldmlldy1yYW5nZXRpbWUnKSB8fCBuLm1hdGNoZXMoJy53cGJjX2JmYl9fcHJldmlldy10aW1lcGlja2VyJykpICkgeyBmb3VuZCA9IHRydWU7IH1cclxuXHRcdFx0XHRcdCBlbHNlIGlmICggbi5xdWVyeVNlbGVjdG9yICYmIChuLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fcHJldmlldy1yYW5nZXRpbWUnKSB8fCBuLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fcHJldmlldy10aW1lcGlja2VyJykpICkgeyBmb3VuZCA9IHRydWU7IH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gYXR0cmlidXRlIGNoYW5nZXMgb24gc2VsZWN0XHJcblx0XHRcdFx0aWYgKCFmb3VuZCAmJiBtLnR5cGUgPT09ICdhdHRyaWJ1dGVzJyAmJiBtLnRhcmdldCAmJiBtLnRhcmdldC5tYXRjaGVzICYmIG0udGFyZ2V0Lm1hdGNoZXMoJy53cGJjX2JmYl9fcHJldmlldy1yYW5nZXRpbWUnKSkgZm91bmQgPSB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChmb3VuZCkgVGltZS5zY2hlZHVsZV9pbml0X3RpbWVzZWxlY3RvcigpO1xyXG5cdFx0XHRpZiAoZm91bmQpIHJ1blN5bmMoKTtcclxuXHRcdH1cclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRtbyA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGhhbmRsZSk7XHJcblx0XHRcdG1vLm9ic2VydmUocm9vdCwge1xyXG5cdFx0XHRcdGNoaWxkTGlzdDp0cnVlLCBzdWJ0cmVlOnRydWUsIGF0dHJpYnV0ZXM6dHJ1ZSwgYXR0cmlidXRlRmlsdGVyOlsndmFsdWUnLCdjbGFzcyddXHJcblx0XHRcdH0pO1xyXG5cdFx0fSBjYXRjaChlKSB7fVxyXG5cclxuXHRcdHcuX193cGJjX3J0X21vX3BhdXNlICA9IGZ1bmN0aW9uKCl7IHRyeSB7IG1vICYmIG1vLmRpc2Nvbm5lY3QoKTsgfSBjYXRjaChlKXt9IH07XHJcblx0XHR3Ll9fd3BiY19ydF9tb19yZXN1bWUgPSBmdW5jdGlvbigpeyB0cnkge1xyXG5cdFx0XHRtbyAmJiBtby5vYnNlcnZlKHJvb3QsIHsgY2hpbGRMaXN0OnRydWUsIHN1YnRyZWU6dHJ1ZSwgYXR0cmlidXRlczp0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6Wyd2YWx1ZScsJ2NsYXNzJ10gfSk7XHJcblx0XHR9IGNhdGNoKGUpe30gfTtcclxuXHR9KSgpO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBSZW5kZXJlclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGNvbnN0IHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZSA9IGNsYXNzIGV4dGVuZHMgQmFzZSB7XHJcblx0XHRzdGF0aWMgdGVtcGxhdGVfaWQgPSAnd3BiYy1iZmItZmllbGQtcmFuZ2V0aW1lJztcclxuXHRcdHN0YXRpYyBraW5kICAgICAgICA9ICdyYW5nZXRpbWUnO1xyXG5cclxuXHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKXtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRraW5kICAgICAgICAgICAgOiAnZmllbGQnLFxyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgICA6ICdyYW5nZXRpbWUnLFxyXG5cdFx0XHRcdGxhYmVsICAgICAgICAgICA6ICdUaW1lJyxcclxuXHRcdFx0XHRuYW1lICAgICAgICAgICAgOiAncmFuZ2V0aW1lJyxcclxuXHRcdFx0XHRodG1sX2lkICAgICAgICAgOiAnJyxcclxuXHRcdFx0XHRyZXF1aXJlZCAgICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdG11bHRpcGxlICAgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdHNpemUgICAgICAgICAgICA6IG51bGwsXHJcblx0XHRcdFx0Y3NzY2xhc3MgICAgICAgIDogJycsXHJcblx0XHRcdFx0aGVscCAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0ZGVmYXVsdF92YWx1ZSAgIDogJycsXHJcblx0XHRcdFx0cGxhY2Vob2xkZXIgICAgIDogJy0tLSBTZWxlY3QgdGltZSAtLS0nLFxyXG5cdFx0XHRcdHZhbHVlX2RpZmZlcnMgICA6IHRydWUsXHJcblx0XHRcdFx0bWluX3dpZHRoICAgICAgIDogJzI0MHB4JyxcclxuXHRcdFx0XHRvcHRpb25zICAgICAgICAgOiBbXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMTA6MDAgQU0gLSAxMjowMCBQTScsIHZhbHVlOiAnMTA6MDAgLSAxMjowMCcsIHNlbGVjdGVkOiBmYWxzZSB9LFxyXG5cdFx0XHRcdFx0eyBsYWJlbDogJzEyOjAwIFBNIC0gMDI6MDAgUE0nLCB2YWx1ZTogJzEyOjAwIC0gMTQ6MDAnLCBzZWxlY3RlZDogZmFsc2UgfSxcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICcwMjowMCBQTSAtIDA0OjAwIFBNJywgdmFsdWU6ICcxNDowMCAtIDE2OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDQ6MDAgUE0gLSAwNjowMCBQTScsIHZhbHVlOiAnMTY6MDAgLSAxODowMCcsIHNlbGVjdGVkOiBmYWxzZSB9LFxyXG5cdFx0XHRcdFx0eyBsYWJlbDogJzA2OjAwIFBNIC0gMDg6MDAgUE0nLCB2YWx1ZTogJzE4OjAwIC0gMjA6MDAnLCBzZWxlY3RlZDogZmFsc2UgfVxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdFx0Z2VuX2xhYmVsX2ZtdCAgIDogJ2FtcG0nLFxyXG5cdFx0XHRcdGdlbl9zdGFydF8yNGggICA6ICcwOTowMCcsXHJcblx0XHRcdFx0Z2VuX2VuZF8yNGggICAgIDogJzE4OjAwJyxcclxuXHRcdFx0XHRnZW5fc3RhcnRfYW1wbV90OiAnMDk6MDAnLFxyXG5cdFx0XHRcdGdlbl9lbmRfYW1wbV90ICA6ICcxODowMCcsXHJcblx0XHRcdFx0Z2VuX3N0ZXBfaCAgICAgIDogMCxcclxuXHRcdFx0XHRnZW5fc3RlcF9tICAgICAgOiAzMFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXhlY3V0ZWQgYWZ0ZXIgdGhlIGZpZWxkIGlzIGRyb3BwZWQgZnJvbSB0aGUgcGFsZXR0ZS5cclxuXHRcdCAqIExvY2tzIGNhbm9uaWNhbCBuYW1lIGFuZCBkaXNhYmxlcyBmdXR1cmUgYXV0by1uYW1pbmcuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGN0eFxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgb25fZmllbGRfZHJvcChkYXRhLCBlbCwgY3R4KXtcclxuXHRcdFx0aWYgKHN1cGVyLm9uX2ZpZWxkX2Ryb3ApIHN1cGVyLm9uX2ZpZWxkX2Ryb3AoZGF0YSwgZWwsIGN0eCk7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Ly8gS2VlcCBkYXRhIG1vZGVsIGNhbm9uaWNhbFxyXG5cdFx0XHRcdGlmIChkYXRhICYmIHR5cGVvZiBkYXRhID09PSAnb2JqZWN0Jykge1xyXG5cdFx0XHRcdFx0ZGF0YS5uYW1lICAgICA9ICdyYW5nZXRpbWUnO1xyXG5cdFx0XHRcdFx0ZGF0YS5yZXF1aXJlZCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIExvY2sgZGF0YXNldCBmbGFncyBvbiB0aGUgZHJvcHBlZCBlbGVtZW50XHJcblx0XHRcdFx0aWYgKGVsICYmIGVsLmRhdGFzZXQpIHtcclxuXHRcdFx0XHRcdGVsLmRhdGFzZXQubmFtZSAgICAgICAgICAgICAgPSAncmFuZ2V0aW1lJztcclxuXHRcdFx0XHRcdGVsLmRhdGFzZXQuYXV0b25hbWUgICAgICAgICAgPSAnMCc7XHJcblx0XHRcdFx0XHRlbC5kYXRhc2V0LmZyZXNoICAgICAgICAgICAgID0gJzAnO1xyXG5cdFx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lX3VzZXJfdG91Y2hlZCA9ICcxJztcclxuXHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSgnZGF0YS1yZXF1aXJlZCcsJ3RydWUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gU3luYyB0aGUgcHJldmlldyBjb250cm9sICg8c2VsZWN0PikgaW1tZWRpYXRlbHlcclxuXHRcdFx0XHR2YXIgc2VsID0gZWwgJiYgZWwucXVlcnlTZWxlY3Rvcignc2VsZWN0LndwYmNfYmZiX19wcmV2aWV3LXJhbmdldGltZScpO1xyXG5cdFx0XHRcdGlmIChzZWwpIHNlbC5zZXRBdHRyaWJ1dGUoJ25hbWUnLCdyYW5nZXRpbWUnKTtcclxuXHRcdFx0XHQvLyBJZiBJbnNwZWN0b3IgaXMgcHJlc2VudCwgdXBkYXRlIHRoZSBoaWRkZW4gXCJuYW1lXCIgcHJveHkgYW5kIG5vdGlmeVxyXG5cdFx0XHRcdHZhciBoaWRkZW4gPSBkLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZSAuanMtbG9ja2VkLW5hbWVbZGF0YS1pbnNwZWN0b3Ita2V5PVwibmFtZVwiXScpO1xyXG5cdFx0XHRcdGlmIChoaWRkZW4pIHsgaGlkZGVuLnZhbHVlID0gJ3JhbmdldGltZSc7IGhpZGRlbi5zZXRBdHRyaWJ1dGUoJ2RhdGEtbG9ja2VkJywnMScpOyBpZiAodHlwZW9mIGVtaXRfaW5zcGVjdG9yX2NoYW5nZT09PSdmdW5jdGlvbicpIGVtaXRfaW5zcGVjdG9yX2NoYW5nZShoaWRkZW4pOyB9XHJcblx0XHRcdH0gY2F0Y2goZSl7fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEJpbmQgb25jZSBmb3IgYWxsIGluc3BlY3RvciBwYW5lbHMgKGV2ZW50cykuXHJcblx0XHRzdGF0aWMgYmluZF9pbnNwZWN0b3JfZXZlbnRzX29uY2UoKXtcclxuXHRcdFx0aWYgKHRoaXMuX2JvdW5kX29uY2UpIHJldHVybjtcclxuXHRcdFx0dGhpcy5fYm91bmRfb25jZSA9IHRydWU7XHJcblxyXG5cdFx0XHQvLyBQZXJzaXN0IHBsYWNlaG9sZGVyIHdoZW4gdG9nZ2xpbmcgZ2xvYmFsIHBpY2tlclxyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoZXYpIHtcclxuXHRcdFx0XHR2YXIgdGdsID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC5qcy10b2dnbGUtdGltZXNsb3QtcGlja2VyJyApO1xyXG5cdFx0XHRcdGlmICggIXRnbCApIHJldHVybjtcclxuXHRcdFx0XHR2YXIgcGFuZWwgPSB0Z2wuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZScgKTtcclxuXHRcdFx0XHR2YXIgcGggICAgPSBwYW5lbCAmJiBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLXBsYWNlaG9sZGVyJyApO1xyXG5cdFx0XHRcdGlmICggcGggKSBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UoIHBoICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIEFNL1BNIDwtPiAyNGggc3dpdGNoXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZnVuY3Rpb24oZXYpe1xyXG5cdFx0XHRcdHZhciByYWRpbyA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC5qcy1ydC1sYWJlbC1mbXQnKTtcclxuXHRcdFx0XHRpZiAoIXJhZGlvKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdHZhciBwYW5lbCA9IHJhZGlvLmNsb3Nlc3QoJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZScpO1xyXG5cdFx0XHRcdGlmICghcGFuZWwpIHJldHVybjtcclxuXHJcblx0XHRcdFx0dmFyIGZtdCA9IGdldF9jdXJyZW50X2Zvcm1hdChwYW5lbCk7IC8vICdhbXBtJyB8ICcyNGgnXHJcblx0XHRcdFx0dmFyIHByb3h5ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLXJ0LWxhYmVsLWZtdC12YWx1ZScpO1xyXG5cdFx0XHRcdGlmIChwcm94eSl7IHByb3h5LnZhbHVlID0gZm10OyBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UocHJveHkpOyB9XHJcblxyXG5cdFx0XHRcdHVwZGF0ZV9nZW5fdmlzaWJpbGl0eShwYW5lbCk7XHJcblxyXG5cdFx0XHRcdC8vIFN5bmMgZ2VuZXJhdG9yIHZhbHVlcyBhY3Jvc3MgZ3JvdXBzLlxyXG5cdFx0XHRcdGlmIChmbXQgPT09ICcyNGgnKXtcclxuXHRcdFx0XHRcdHZhciBzX3QgPSAocGFuZWwucXVlcnlTZWxlY3RvcignLmpzLWdlbi1zdGFydC1hbXBtLXRpbWUnKXx8e30pLnZhbHVlIHx8ICcnO1xyXG5cdFx0XHRcdFx0dmFyIGVfdCA9IChwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtZ2VuLWVuZC1hbXBtLXRpbWUnKXx8e30pLnZhbHVlIHx8ICcnO1xyXG5cdFx0XHRcdFx0dmFyIHNfbSA9IFRpbWUucGFyc2VfaGhtbV8yNGgoc190KSwgZV9tID0gVGltZS5wYXJzZV9oaG1tXzI0aChlX3QpO1xyXG5cdFx0XHRcdFx0dmFyIHMyNCA9IGlzTmFOKHNfbSkgPyAnJyA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfMjRoKHNfbSk7XHJcblx0XHRcdFx0XHR2YXIgZTI0ID0gaXNOYU4oZV9tKSA/ICcnIDogVGltZS5mb3JtYXRfbWludXRlc18yNGgoZV9tKTtcclxuXHRcdFx0XHRcdHZhciBzMjRlbCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1nZW4tc3RhcnQtMjRoJyk7XHJcblx0XHRcdFx0XHR2YXIgZTI0ZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtZ2VuLWVuZC0yNGgnKTtcclxuXHRcdFx0XHRcdGlmIChzMjRlbCl7IHMyNGVsLnZhbHVlID0gczI0OyBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UoczI0ZWwpOyB9XHJcblx0XHRcdFx0XHRpZiAoZTI0ZWwpeyBlMjRlbC52YWx1ZSA9IGUyNDsgZW1pdF9pbnNwZWN0b3JfY2hhbmdlKGUyNGVsKTsgfVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR2YXIgczI0dCA9IChwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtZ2VuLXN0YXJ0LTI0aCcpfHx7fSkudmFsdWUgfHwgJyc7XHJcblx0XHRcdFx0XHR2YXIgZTI0dCA9IChwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtZ2VuLWVuZC0yNGgnKXx8e30pLnZhbHVlIHx8ICcnO1xyXG5cdFx0XHRcdFx0dmFyIHNfbTIgPSBUaW1lLnBhcnNlX2hobW1fMjRoKHMyNHQpLCBlX20yID0gVGltZS5wYXJzZV9oaG1tXzI0aChlMjR0KTtcclxuXHRcdFx0XHRcdHZhciBzYW0gPSBpc05hTihzX20yKSA/ICcnIDogVGltZS5mb3JtYXRfbWludXRlc18yNGgoc19tMik7XHJcblx0XHRcdFx0XHR2YXIgZWFtID0gaXNOYU4oZV9tMikgPyAnJyA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfMjRoKGVfbTIpO1xyXG5cdFx0XHRcdFx0dmFyIHN0X2VsID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLWdlbi1zdGFydC1hbXBtLXRpbWUnKTtcclxuXHRcdFx0XHRcdHZhciBldF9lbCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1nZW4tZW5kLWFtcG0tdGltZScpO1xyXG5cdFx0XHRcdFx0aWYgKHN0X2VsKXsgc3RfZWwudmFsdWUgPSBzYW07IGVtaXRfaW5zcGVjdG9yX2NoYW5nZShzdF9lbCk7IH1cclxuXHRcdFx0XHRcdGlmIChldF9lbCl7IGV0X2VsLnZhbHVlID0gZWFtOyBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UoZXRfZWwpOyB9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRUaW1lLnJlYnVpbGRfYWxsX3Jvd3NfdG9fZm9ybWF0KHBhbmVsLCBmbXQpO1xyXG5cdFx0XHRcdGlmIChmbXQgPT09ICcyNGgnKSBUaW1lLmFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGgocGFuZWwpO1xyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5zeW5jX3N0YXRlX2Zyb21fcm93cyhwYW5lbCk7XHJcblx0XHRcdFx0Q29yZS5VSS5wdWxzZV9xdWVyeV9kZWJvdW5jZWQoIHBhbmVsLCAnLmpzLXJ0LWdlbmVyYXRlJyApOyAvLyBhdm9pZCByZWZsb3cgc3BhbSB3aGlsZSB0eXBpbmdcclxuIFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Ly8gTWFzayBvbiBmb2N1cyAoMjRoKVxyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzaW4nLCBmdW5jdGlvbihldil7XHJcblx0XHRcdFx0dmFyIGVsID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCcuanMtcnQtbWFza1tkYXRhLW1hc2sta2luZD1cIjI0aFwiXScpO1xyXG5cdFx0XHRcdGlmIChlbCAmJiAhZWwuX2ltYXNrKSBUaW1lLmFwcGx5X2ltYXNrX3RvX2lucHV0KGVsKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHQvLyBEdXJhdGlvbiByYW5nZSA8LT4gbnVtYmVyIHN5bmNcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGZ1bmN0aW9uKGV2KXtcclxuXHRcdFx0XHR2YXIgcmFuZ2UgPSBldi50YXJnZXQgJiYgZXYudGFyZ2V0LmNsb3Nlc3QoJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZSBbZGF0YS1sZW4tZ3JvdXBdIFtkYXRhLWxlbi1yYW5nZV0nKTtcclxuXHRcdFx0XHRpZiAoIXJhbmdlKSByZXR1cm47XHJcblx0XHRcdFx0dmFyIGdyb3VwID0gcmFuZ2UuY2xvc2VzdCgnW2RhdGEtbGVuLWdyb3VwXScpO1xyXG5cdFx0XHRcdHZhciBudW0gICA9IGdyb3VwICYmIGdyb3VwLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWxlbi12YWx1ZV0nKTtcclxuXHRcdFx0XHRpZiAobnVtKXtcclxuXHRcdFx0XHRcdG51bS52YWx1ZSA9IHJhbmdlLnZhbHVlO1xyXG5cdFx0XHRcdFx0aWYgKG51bS5oYXNBdHRyaWJ1dGUoJ2RhdGEtaW5zcGVjdG9yLWtleScpKSBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UobnVtKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSAocmFuZ2UgfHwgbnVtKS5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUnKTtcclxuXHRcdFx0XHRDb3JlLlVJLnB1bHNlX3F1ZXJ5X2RlYm91bmNlZCggcGFuZWwsICcuanMtcnQtZ2VuZXJhdGUnICk7IC8vIGF2b2lkIHJlZmxvdyBzcGFtIHdoaWxlIHR5cGluZ1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGZ1bmN0aW9uKGV2KXtcclxuXHRcdFx0XHR2YXIgbnVtID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUgW2RhdGEtbGVuLWdyb3VwXSBbZGF0YS1sZW4tdmFsdWVdJyk7XHJcblx0XHRcdFx0aWYgKCFudW0pIHJldHVybjtcclxuXHRcdFx0XHR2YXIgZ3JvdXAgPSBudW0uY2xvc2VzdCgnW2RhdGEtbGVuLWdyb3VwXScpO1xyXG5cdFx0XHRcdHZhciByYW5nZSA9IGdyb3VwICYmIGdyb3VwLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWxlbi1yYW5nZV0nKTtcclxuXHRcdFx0XHRpZiAocmFuZ2UpIHJhbmdlLnZhbHVlID0gbnVtLnZhbHVlO1xyXG5cdFx0XHRcdGNvbnN0IHBhbmVsID0gKHJhbmdlIHx8IG51bSkuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lJyk7XHJcblx0XHRcdFx0Q29yZS5VSS5wdWxzZV9xdWVyeV9kZWJvdW5jZWQoIHBhbmVsLCAnLmpzLXJ0LWdlbmVyYXRlJyApOyAvLyBhdm9pZCByZWZsb3cgc3BhbSB3aGlsZSB0eXBpbmdcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHQvLyBQdWxzZSB3aGVuIGFueSBnZW5lcmF0b3IgaW5wdXQgY2hhbmdlcyAoYm90aCBmb3JtYXRzICsgc3RlcClcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGZ1bmN0aW9uKGV2KXtcclxuXHRcdFx0XHRjb25zdCBnZW5JbnB1dCA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdChcclxuXHRcdFx0XHRcdCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUgLmpzLWdlbi1zdGFydC0yNGgsJyArXHJcblx0XHRcdFx0XHQnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC5qcy1nZW4tZW5kLTI0aCwnICtcclxuXHRcdFx0XHRcdCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUgLmpzLWdlbi1zdGFydC1hbXBtLXRpbWUsJyArXHJcblx0XHRcdFx0XHQnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC5qcy1nZW4tZW5kLWFtcG0tdGltZSwnICtcclxuXHRcdFx0XHRcdCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUgLmpzLWdlbi1zdGVwLWgsJyArXHJcblx0XHRcdFx0XHQnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC5qcy1nZW4tc3RlcC1tJ1xyXG5cdFx0XHRcdCk7XHJcblx0XHRcdFx0aWYgKCFnZW5JbnB1dCkgcmV0dXJuO1xyXG5cdFx0XHRcdGNvbnN0IHBhbmVsID0gZ2VuSW5wdXQuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lJyk7XHJcblx0XHRcdFx0Q29yZS5VSS5wdWxzZV9xdWVyeV9kZWJvdW5jZWQoIHBhbmVsLCAnLmpzLXJ0LWdlbmVyYXRlJyApOyAvLyBhdm9pZCByZWZsb3cgc3BhbSB3aGlsZSB0eXBpbmdcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHQvLyBHZW5lcmF0ZSBzbG90c1xyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oZXYpe1xyXG5cdFx0XHRcdHZhciBidG4gPSBldi50YXJnZXQgJiYgZXYudGFyZ2V0LmNsb3Nlc3QoJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZSAuanMtcnQtZ2VuZXJhdGUnKTtcclxuXHRcdFx0XHRpZiAoIWJ0bikgcmV0dXJuO1xyXG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRcdHZhciBwYW5lbCA9IGJ0bi5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUnKTtcclxuXHRcdFx0XHRpZiAoIXBhbmVsKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdHZhciBmbXQgPSBnZXRfY3VycmVudF9mb3JtYXQocGFuZWwpO1xyXG5cdFx0XHRcdHZhciBzdGFydF9tLCBlbmRfbTtcclxuXHRcdFx0XHRpZiAoZm10ID09PSAnMjRoJyl7XHJcblx0XHRcdFx0XHR2YXIgczI0ID0gKHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1nZW4tc3RhcnQtMjRoJyl8fHt9KS52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdHZhciBlMjQgPSAocGFuZWwucXVlcnlTZWxlY3RvcignLmpzLWdlbi1lbmQtMjRoJyl8fHt9KS52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdHN0YXJ0X20gPSBUaW1lLnBhcnNlX2hobW1fMjRoKHMyNCk7XHJcblx0XHRcdFx0XHRlbmRfbSAgID0gVGltZS5wYXJzZV9oaG1tXzI0aChlMjQpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR2YXIgc19hbSA9IChwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtZ2VuLXN0YXJ0LWFtcG0tdGltZScpfHx7fSkudmFsdWUgfHwgJyc7XHJcblx0XHRcdFx0XHR2YXIgZV9hbSA9IChwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtZ2VuLWVuZC1hbXBtLXRpbWUnKXx8e30pLnZhbHVlIHx8ICcnO1xyXG5cdFx0XHRcdFx0c3RhcnRfbSAgPSBUaW1lLnBhcnNlX2hobW1fMjRoKHNfYW0pOyAvLyBpbnB1dFt0eXBlPXRpbWVdID0+IFwiSEg6TU1cIlxyXG5cdFx0XHRcdFx0ZW5kX20gICAgPSBUaW1lLnBhcnNlX2hobW1fMjRoKGVfYW0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR2YXIgc3RlcF9oID0gcGFyc2VJbnQoKHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1nZW4tc3RlcC1oJyl8fHt9KS52YWx1ZSwgMTApIHx8IDA7XHJcblx0XHRcdFx0dmFyIHN0ZXBfbSA9IHBhcnNlSW50KChwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtZ2VuLXN0ZXAtbScpfHx7fSkudmFsdWUsIDEwKSB8fCAwO1xyXG5cdFx0XHRcdHZhciBzdGVwICAgPSBNYXRoLm1heCgxLCBzdGVwX2ggKiA2MCArIHN0ZXBfbSk7XHJcblxyXG5cdFx0XHRcdHZhciBzbG90cyA9IFRpbWUuYnVpbGRfdGltZV9zbG90cyhzdGFydF9tLCBlbmRfbSwgc3RlcCwgZm10KTtcclxuXHRcdFx0XHR3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUucmVwbGFjZV9vcHRpb25zX2luX3BhbmVsKHBhbmVsLCBzbG90cyk7XHJcblx0XHRcdFx0VGltZS5yZWJ1aWxkX2FsbF9yb3dzX3RvX2Zvcm1hdChwYW5lbCwgZm10KTtcclxuXHRcdFx0XHRpZiAoZm10ID09PSAnMjRoJykgVGltZS5hcHBseV9pbWFza19pbl9jb250YWluZXJfMjRoKHBhbmVsKTtcclxuXHRcdFx0XHR3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUuc3luY19zdGF0ZV9mcm9tX3Jvd3MocGFuZWwpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdC8vIENsZWFyXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihldil7XHJcblx0XHRcdFx0dmFyIGJ0biA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC5qcy1ydC1jbGVhcicpO1xyXG5cdFx0XHRcdGlmICghYnRuKSByZXR1cm47XHJcblx0XHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHR2YXIgcGFuZWwgPSBidG4uY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lJyk7XHJcblx0XHRcdFx0aWYgKCFwYW5lbCkgcmV0dXJuO1xyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5yZXBsYWNlX29wdGlvbnNfaW5fcGFuZWwocGFuZWwsIFtdKTtcclxuXHRcdFx0XHR3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUuc3luY19zdGF0ZV9mcm9tX3Jvd3MocGFuZWwpO1xyXG5cdFx0XHRcdENvcmUuVUkucHVsc2VfcXVlcnlfZGVib3VuY2VkKHBhbmVsLCAnLmpzLXJ0LWdlbmVyYXRlJyApOyAvLyBhdm9pZCByZWZsb3cgc3BhbSB3aGlsZSB0eXBpbmdcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHQvLyBBZGQgb3B0aW9uXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihldil7XHJcblx0XHRcdFx0dmFyIGJ0biA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC5qcy1ydC1hZGQtb3B0aW9uJyk7XHJcblx0XHRcdFx0aWYgKCFidG4pIHJldHVybjtcclxuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdHZhciBwYW5lbCA9IGJ0bi5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUnKTtcclxuXHRcdFx0XHRpZiAoIXBhbmVsKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5hZGRfb3B0aW9uX3JvdyhwYW5lbCk7XHJcblx0XHRcdFx0dmFyIGZtdCA9IGdldF9jdXJyZW50X2Zvcm1hdChwYW5lbCk7XHJcblx0XHRcdFx0aWYgKGZtdCA9PT0gJzI0aCcpIFRpbWUuYXBwbHlfaW1hc2tfaW5fY29udGFpbmVyXzI0aChwYW5lbCk7XHJcblx0XHRcdFx0d3BiY19iZmJfZmllbGRfcmFuZ2V0aW1lLnN5bmNfc3RhdGVfZnJvbV9yb3dzKHBhbmVsKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHQvLyBSb3cgZHJvcGRvd24gYWN0aW9uc1xyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oZXYpe1xyXG5cdFx0XHRcdHZhciBhID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUgLnJ0X2Ryb3Bkb3duX2FjdGlvbicpO1xyXG5cdFx0XHRcdGlmICghYSkgcmV0dXJuO1xyXG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRcdHZhciBhY3Rpb24gPSBhLmdldEF0dHJpYnV0ZSgnZGF0YS1ydC1hY3Rpb24nKSB8fCAnJztcclxuXHRcdFx0XHR2YXIgcm93ICAgID0gYS5jbG9zZXN0KCcud3BiY19iZmJfX29wdGlvbnNfcm93Jyk7XHJcblx0XHRcdFx0dmFyIHBhbmVsICA9IGEuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lJyk7XHJcblx0XHRcdFx0aWYgKCFyb3cgfHwgIXBhbmVsKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdGlmIChhY3Rpb24gPT09ICdhZGRfYWZ0ZXInKSB7XHJcblx0XHRcdFx0XHR3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUuaW5zZXJ0X3Jvd19hZnRlcihwYW5lbCwgcm93LCBudWxsKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2R1cGxpY2F0ZScpIHtcclxuXHRcdFx0XHRcdHZhciBmbXQgPSBnZXRfY3VycmVudF9mb3JtYXQocGFuZWwpO1xyXG5cdFx0XHRcdFx0dmFyIGRhdGEgPSB3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUucmVhZF9yb3cocm93LCBmbXQpO1xyXG5cdFx0XHRcdFx0d3BiY19iZmJfZmllbGRfcmFuZ2V0aW1lLmluc2VydF9yb3dfYWZ0ZXIocGFuZWwsIHJvdywgZGF0YSk7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChhY3Rpb24gPT09ICdyZW1vdmUnKSB7XHJcblx0XHRcdFx0XHR2YXIgbGlzdEVsID0gcm93LnBhcmVudE5vZGU7XHJcblx0XHRcdFx0XHRsaXN0RWwucmVtb3ZlQ2hpbGQocm93KTtcclxuXHRcdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5yZWluZGV4X3Jvd3MobGlzdEVsKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dmFyIGZtdDIgPSBnZXRfY3VycmVudF9mb3JtYXQocGFuZWwpO1xyXG5cdFx0XHRcdFRpbWUucmVidWlsZF9hbGxfcm93c190b19mb3JtYXQocGFuZWwsIGZtdDIpO1xyXG5cdFx0XHRcdGlmIChmbXQyID09PSAnMjRoJykgVGltZS5hcHBseV9pbWFza19pbl9jb250YWluZXJfMjRoKHBhbmVsKTtcclxuXHRcdFx0XHR3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUuc3luY19zdGF0ZV9mcm9tX3Jvd3MocGFuZWwpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdC8vIFJvdyBlZGl0cyAtPiBzeW5jXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBmdW5jdGlvbihldil7XHJcblx0XHRcdFx0dmFyIHJvdyA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC53cGJjX2JmYl9fb3B0aW9uc19yb3cnKTtcclxuXHRcdFx0XHRpZiAoIXJvdykgcmV0dXJuO1xyXG5cdFx0XHRcdHZhciBwYW5lbCA9IHJvdy5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUnKTtcclxuXHRcdFx0XHR3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUuc3luY19zdGF0ZV9mcm9tX3Jvd3MocGFuZWwpO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBmdW5jdGlvbihldil7XHJcblx0XHRcdFx0dmFyIHJvdyA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lIC53cGJjX2JmYl9fb3B0aW9uc19yb3cnKTtcclxuXHRcdFx0XHRpZiAoIXJvdykgcmV0dXJuO1xyXG5cclxuXHRcdFx0XHRpZiAoZXYudGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnd3BiY19iZmJfX29wdC1zZWxlY3RlZC1jaGsnKSl7XHJcblx0XHRcdFx0XHR2YXIgcGFuZWwgPSByb3cuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3JfcmFuZ2V0aW1lJyk7XHJcblx0XHRcdFx0XHRpZiAocGFuZWwgJiYgIXBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1vcHQtbXVsdGlwbGU6Y2hlY2tlZCcpKSB7XHJcblx0XHRcdFx0XHRcdHBhbmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy53cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoaycpLmZvckVhY2goZnVuY3Rpb24oY2hrKXtcclxuXHRcdFx0XHRcdFx0XHRpZiAoY2hrICE9PSBldi50YXJnZXQpIHtcclxuXHRcdFx0XHRcdFx0XHRcdGNoay5jaGVja2VkID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdFx0XHRjaGsuc2V0QXR0cmlidXRlKCdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnKTtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0XHRldi50YXJnZXQuc2V0QXR0cmlidXRlKCdhcmlhLWNoZWNrZWQnLCAndHJ1ZScpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR2YXIgcGFuZWwyID0gcm93LmNsb3Nlc3QoJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZScpO1xyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5zeW5jX3N0YXRlX2Zyb21fcm93cyhwYW5lbDIpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdC8vIEluaXQgb24gbG9hZCBmb3IgZXhpc3RpbmcgcGFuZWxzXHJcblx0XHRcdHZhciBpbml0ID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRkLnF1ZXJ5U2VsZWN0b3JBbGwoJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZScpLmZvckVhY2goZnVuY3Rpb24ocGFuZWwpe1xyXG5cdFx0XHRcdFx0dXBkYXRlX2dlbl92aXNpYmlsaXR5KHBhbmVsKTtcclxuXHRcdFx0XHRcdHZhciBmbXQgPSBnZXRfY3VycmVudF9mb3JtYXQocGFuZWwpO1xyXG5cdFx0XHRcdFx0aWYgKGZtdCA9PT0gJzI0aCcpIFRpbWUuYXBwbHlfaW1hc2tfaW5fY29udGFpbmVyXzI0aChwYW5lbCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gcGxhY2Vob2xkZXIgZGlzYWJsZWQgc3RhdGUgbWlycm9yIChpZiBtdWx0aXBsZSBpcyBzaG93biBpbiBmdXR1cmUpXHJcblx0XHRcdFx0XHR2YXIgbXVsICAgID0gcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLW9wdC1tdWx0aXBsZScpO1xyXG5cdFx0XHRcdFx0dmFyIHBoICAgICA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1wbGFjZWhvbGRlcicpO1xyXG5cdFx0XHRcdFx0dmFyIHBoTm90ZSA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1wbGFjZWhvbGRlci1ub3RlJyk7XHJcblx0XHRcdFx0XHRpZiAobXVsICYmIHBoKSBwaC5kaXNhYmxlZCA9ICEhbXVsLmNoZWNrZWQ7XHJcblx0XHRcdFx0XHRpZiAobXVsICYmIHBoTm90ZSkgcGhOb3RlLnN0eWxlLmRpc3BsYXkgPSBtdWwuY2hlY2tlZCA/ICdub25lJyA6ICcnO1xyXG5cclxuXHRcdFx0XHRcdGVuZm9yY2VfbG9ja2VkX25hbWUocGFuZWwpO1xyXG5cdFx0XHRcdFx0dmFyIHBoX2luaXQgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuanMtcGxhY2Vob2xkZXInKTtcclxuXHRcdFx0XHRcdGlmIChwaF9pbml0KSBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UocGhfaW5pdCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH07XHJcblx0XHRcdChkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykgPyBkLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0KSA6IGluaXQoKTtcclxuXHJcblx0XHRcdC8vIFJlLWFwcGx5IHdoZW4gSW5zcGVjdG9yIHJlLXJlbmRlcnMgYSBwYW5lbFxyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZWFkeScsIGZ1bmN0aW9uKGV2KXtcclxuXHRcdFx0XHR2YXIgcGFuZWwgPSBldiAmJiBldi5kZXRhaWwgJiYgZXYuZGV0YWlsLnBhbmVsO1xyXG5cdFx0XHRcdGlmICghcGFuZWwpIHJldHVybjtcclxuXHRcdFx0XHR2YXIgcnRQYW5lbCA9IHBhbmVsLmNsb3Nlc3RcclxuXHRcdFx0XHRcdD8gKHBhbmVsLm1hdGNoZXMoJy53cGJjX2JmYl9faW5zcGVjdG9yX3JhbmdldGltZScpID8gcGFuZWwgOiBwYW5lbC5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9yYW5nZXRpbWUnKSlcclxuXHRcdFx0XHRcdDogbnVsbDtcclxuXHRcdFx0XHRpZiAoIXJ0UGFuZWwpIHJldHVybjtcclxuXHJcblx0XHRcdFx0dXBkYXRlX2dlbl92aXNpYmlsaXR5KHJ0UGFuZWwpO1xyXG5cdFx0XHRcdHZhciBmbXQgPSBnZXRfY3VycmVudF9mb3JtYXQocnRQYW5lbCk7XHJcblx0XHRcdFx0aWYgKGZtdCA9PT0gJzI0aCcpIFRpbWUuYXBwbHlfaW1hc2tfaW5fY29udGFpbmVyXzI0aChydFBhbmVsKTtcclxuXHJcblx0XHRcdFx0ZW5mb3JjZV9sb2NrZWRfbmFtZShydFBhbmVsKTtcclxuXHRcdFx0XHR2YXIgcGhfaW5pdCA9IHJ0UGFuZWwucXVlcnlTZWxlY3RvcignLmpzLXBsYWNlaG9sZGVyJyk7XHJcblx0XHRcdFx0aWYgKHBoX2luaXQpIGVtaXRfaW5zcGVjdG9yX2NoYW5nZShwaF9pbml0KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLSBSb3dzICYgc3RhdGUgLS0tLS0tLS1cclxuXHRcdHN0YXRpYyBidWlsZF9yb3dfaHRtbChkYXRhLCBmbXQsIHBhbmVsKXtcclxuXHRcdFx0dmFyIGxhYmVsID0gKGRhdGEgJiYgZGF0YS5sYWJlbCkgfHwgJyc7XHJcblx0XHRcdHZhciB2YWx1ZSA9IChkYXRhICYmIGRhdGEudmFsdWUpIHx8ICcnO1xyXG5cdFx0XHR2YXIgcGFydHMgPSBTdHJpbmcodmFsdWUpLnNwbGl0KC9cXHMqLVxccyovKTtcclxuXHRcdFx0dmFyIHN0YXJ0ID0gcGFydHNbMF0gfHwgJyc7XHJcblx0XHRcdHZhciBlbmQgICA9IHBhcnRzWzFdIHx8ICcnO1xyXG5cdFx0XHR2YXIgdWlkICAgPSAnd3BiY19pbnNfcnRfJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsMTApO1xyXG5cdFx0XHR2YXIgc2VsICAgPSAhIShkYXRhICYmICh0cnVlID09PSBkYXRhLnNlbGVjdGVkIHx8ICd0cnVlJyA9PT0gZGF0YS5zZWxlY3RlZCB8fCAxID09PSBkYXRhLnNlbGVjdGVkIHx8ICcxJyA9PT0gZGF0YS5zZWxlY3RlZCkpO1xyXG5cdFx0XHR2YXIgaTE4biAgPSB7XHJcblx0XHRcdFx0YWRkICAgICAgOiAocGFuZWwgJiYgcGFuZWwuZGF0YXNldC5pMThuQWRkKSB8fCAnQWRkIE5ldycsXHJcblx0XHRcdFx0ZHVwbGljYXRlOiAocGFuZWwgJiYgcGFuZWwuZGF0YXNldC5pMThuRHVwbGljYXRlKSB8fCAnRHVwbGljYXRlJyxcclxuXHRcdFx0XHRyZW1vdmUgICA6IChwYW5lbCAmJiBwYW5lbC5kYXRhc2V0LmkxOG5SZW1vdmUpIHx8ICdSZW1vdmUnLFxyXG5cdFx0XHRcdGRlZiAgICAgIDogKHBhbmVsICYmIHBhbmVsLmRhdGFzZXQuaTE4bkRlZmF1bHQpIHx8ICh3LndwYmNfaTE4bl9kZWZhdWx0IHx8ICdEZWZhdWx0JyksXHJcblx0XHRcdFx0cmVvcmRlciAgOiAocGFuZWwgJiYgcGFuZWwuZGF0YXNldC5pMThuUmVvcmRlcikgfHwgJ0RyYWcgdG8gcmVvcmRlcicsXHJcblx0XHRcdFx0cm93bGFiZWwgOiAocGFuZWwgJiYgcGFuZWwuZGF0YXNldC5pMThuUm93bGFiZWwpIHx8ICdMYWJlbCAoZS5nLiAxMDowMCBBTSAtIDEwOjMwIEFNKSdcclxuXHRcdFx0fTtcclxuXHRcdFx0dmFyIHRpbWVfaW5wdXRzX2h0bWw7XHJcblx0XHRcdGlmIChmbXQgPT09ICcyNGgnKSB7XHJcblx0XHRcdFx0dGltZV9pbnB1dHNfaHRtbCA9XHJcblx0XHRcdFx0XHQnPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LXN0YXJ0IGpzLXJ0LW1hc2tcIiBkYXRhLW1hc2sta2luZD1cIjI0aFwiIHBsYWNlaG9sZGVyPVwiSEg6TU1cIiB2YWx1ZT1cIicgKyBUaW1lLmVzY19hdHRyKHN0YXJ0KSArICdcIj4nICtcclxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19vcHQtc2VwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+LTwvc3Bhbj4nICtcclxuXHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtZW5kIGpzLXJ0LW1hc2tcIiBkYXRhLW1hc2sta2luZD1cIjI0aFwiIHBsYWNlaG9sZGVyPVwiSEg6TU1cIiB2YWx1ZT1cIicgKyBUaW1lLmVzY19hdHRyKGVuZCkgKyAnXCI+JztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aW1lX2lucHV0c19odG1sID1cclxuXHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cInRpbWVcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtc3RhcnQganMtcnQtc3RhcnQtdGltZVwiIHN0ZXA9XCIzMDBcIiB2YWx1ZT1cIicgKyBUaW1lLmVzY19hdHRyKHN0YXJ0KSArICdcIj4nICtcclxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19vcHQtc2VwXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+LTwvc3Bhbj4nICtcclxuXHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cInRpbWVcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtZW5kIGpzLXJ0LWVuZC10aW1lXCIgc3RlcD1cIjMwMFwiIHZhbHVlPVwiJyArIFRpbWUuZXNjX2F0dHIoZW5kKSArICdcIj4nO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gJycgK1xyXG5cdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiY19iZmJfX29wdGlvbnNfcm93XCIgZGF0YS1pbmRleD1cIjBcIj4nICtcclxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19kcmFnLWhhbmRsZVwiIHRpdGxlPVwiJyArIGkxOG4ucmVvcmRlciArICdcIj48c3BhbiBjbGFzcz1cIndwYmNfaWNuX2RyYWdfaW5kaWNhdG9yXCI+PC9zcGFuPjwvc3Bhbj4nICtcclxuXHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtbGFiZWxcIiBwbGFjZWhvbGRlcj1cIicgKyBpMThuLnJvd2xhYmVsICsgJ1wiIHZhbHVlPVwiJyArIFRpbWUuZXNjX2F0dHIobGFiZWwpICsgJ1wiPicgK1xyXG5cdFx0XHRcdFx0dGltZV9pbnB1dHNfaHRtbCArXHJcblx0XHRcdFx0XHQnPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LXZhbHVlXCIgdmFsdWU9XCInICsgVGltZS5lc2NfYXR0cih2YWx1ZSB8fCAoc3RhcnQgJiYgZW5kID8gKHN0YXJ0ICsgJyAtICcgKyBlbmQpIDogJycpKSArICdcIiBoaWRkZW4+JyArXHJcblx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19vcHQtc2VsZWN0ZWRcIj4nICtcclxuXHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJpbnNwZWN0b3JfX2NvbnRyb2wgd3BiY191aV9fdG9nZ2xlXCI+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtc2VsZWN0ZWQtY2hrIGluc3BlY3Rvcl9faW5wdXRcIiBpZD1cIicgKyB1aWQgKyAnXCIgcm9sZT1cInN3aXRjaFwiICcgKyAoc2VsID8gJ2NoZWNrZWQgYXJpYS1jaGVja2VkPVwidHJ1ZVwiJyA6ICdhcmlhLWNoZWNrZWQ9XCJmYWxzZVwiJykgKyAnPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8bGFiZWwgY2xhc3M9XCJ3cGJjX3VpX190b2dnbGVfaWNvbl9yYWRpb1wiIGZvcj1cIicgKyB1aWQgKyAnXCI+PC9sYWJlbD4nICtcclxuXHRcdFx0XHRcdFx0XHQnPGxhYmVsIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlX2xhYmVsXCIgZm9yPVwiJyArIHVpZCArICdcIj4nICsgaTE4bi5kZWYgKyAnPC9sYWJlbD4nICtcclxuXHRcdFx0XHRcdFx0JzwvZGl2PicgK1xyXG5cdFx0XHRcdFx0JzwvZGl2PicgK1xyXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX3VpX2VsIHdwYmNfdWlfZWxfY29udGFpbmVyIHdwYmNfdWlfZWxfX2Ryb3Bkb3duXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgZGF0YS10b2dnbGU9XCJ3cGJjX2Ryb3Bkb3duXCIgYXJpYS1leHBhbmRlZD1cImZhbHNlXCIgY2xhc3M9XCJ1bF9kcm9wZG93bl9tZW51X3RvZ2dsZVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX21vcmVfdmVydFwiPjwvaT4nICtcclxuXHRcdFx0XHRcdFx0JzwvYT4nICtcclxuXHRcdFx0XHRcdFx0Jzx1bCBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVcIiByb2xlPVwibWVudVwiIHN0eWxlPVwicmlnaHQ6MHB4OyBsZWZ0OmF1dG87XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaT48YSBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uIHJ0X2Ryb3Bkb3duX2FjdGlvblwiIGRhdGEtcnQtYWN0aW9uPVwiYWRkX2FmdGVyXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgKyBpMThuLmFkZCArICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2FkZF9jaXJjbGVcIj48L2k+PC9hPjwvbGk+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaT48YSBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uIHJ0X2Ryb3Bkb3duX2FjdGlvblwiIGRhdGEtcnQtYWN0aW9uPVwiZHVwbGljYXRlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgKyBpMThuLmR1cGxpY2F0ZSArICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2NvbnRlbnRfY29weVwiPjwvaT48L2E+PC9saT4nICtcclxuXHRcdFx0XHRcdFx0XHQnPGxpIGNsYXNzPVwiZGl2aWRlclwiPjwvbGk+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaT48YSBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uIHJ0X2Ryb3Bkb3duX2FjdGlvblwiIGRhdGEtcnQtYWN0aW9uPVwicmVtb3ZlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgKyBpMThuLnJlbW92ZSArICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RlbGV0ZV9vdXRsaW5lXCI+PC9pPjwvYT48L2xpPicgK1xyXG5cdFx0XHRcdFx0XHQnPC91bD4nICtcclxuXHRcdFx0XHRcdCc8L2Rpdj4nICtcclxuXHRcdFx0XHQnPC9kaXY+JztcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgYWRkX29wdGlvbl9yb3cocGFuZWwpe1xyXG5cdFx0XHR2YXIgbGlzdCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0aW9uc19saXN0Jyk7XHJcblx0XHRcdGlmICghbGlzdCkgcmV0dXJuO1xyXG5cdFx0XHR2YXIgZm10ID0gZ2V0X2N1cnJlbnRfZm9ybWF0KHBhbmVsKTtcclxuXHRcdFx0dmFyIHMgPSA5ICogNjAsIGUgPSBzICsgMzA7XHJcblx0XHRcdHZhciBzdGFydCA9IFRpbWUuZm9ybWF0X21pbnV0ZXNfMjRoKHMpO1xyXG5cdFx0XHR2YXIgZW5kICAgPSBUaW1lLmZvcm1hdF9taW51dGVzXzI0aChlKTtcclxuXHRcdFx0dmFyIGxhYmVsID0gKGZtdCA9PT0gJzI0aCcpID8gKHN0YXJ0ICsgJyAtICcgKyBlbmQpIDogKFRpbWUuZm9ybWF0X21pbnV0ZXNfYW1wbShzKSArICcgLSAnICsgVGltZS5mb3JtYXRfbWludXRlc19hbXBtKGUpKTtcclxuXHRcdFx0dmFyIGh0bWwgPSB3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUuYnVpbGRfcm93X2h0bWwoeyBsYWJlbDogbGFiZWwsIHZhbHVlOiBzdGFydCArICcgLSAnICsgZW5kLCBzZWxlY3RlZDpmYWxzZSB9LCBmbXQsIHBhbmVsKTtcclxuXHJcblx0XHRcdHZhciB0bXAgPSBkLmNyZWF0ZUVsZW1lbnQoJ2RpdicpOyB0bXAuaW5uZXJIVE1MID0gaHRtbDtcclxuXHRcdFx0dmFyIHJvdyA9IHRtcC5maXJzdEVsZW1lbnRDaGlsZDtcclxuXHRcdFx0bGlzdC5hcHBlbmRDaGlsZChyb3cpO1xyXG5cdFx0XHR3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUucmVpbmRleF9yb3dzKGxpc3QpO1xyXG5cdFx0XHRpZiAoZm10ID09PSAnMjRoJykge1xyXG5cdFx0XHRcdFRpbWUuYXBwbHlfaW1hc2tfdG9faW5wdXQocm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0LXN0YXJ0JykpO1xyXG5cdFx0XHRcdFRpbWUuYXBwbHlfaW1hc2tfdG9faW5wdXQocm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0LWVuZCcpKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBpbnNlcnRfcm93X2FmdGVyKHBhbmVsLCBhZnRlcl9yb3csIGRhdGEpe1xyXG5cdFx0XHR2YXIgbGlzdCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0aW9uc19saXN0Jyk7XHJcblx0XHRcdGlmICghbGlzdCkgcmV0dXJuO1xyXG5cdFx0XHR2YXIgZm10ID0gZ2V0X2N1cnJlbnRfZm9ybWF0KHBhbmVsKTtcclxuXHRcdFx0aWYgKCFkYXRhKXtcclxuXHRcdFx0XHR2YXIgcyA9IDkgKiA2MCwgZSA9IHMgKyAzMDtcclxuXHRcdFx0XHR2YXIgc3RhcnQgPSBUaW1lLmZvcm1hdF9taW51dGVzXzI0aChzKSwgZW5kID0gVGltZS5mb3JtYXRfbWludXRlc18yNGgoZSk7XHJcblx0XHRcdFx0ZGF0YSA9IHtcclxuXHRcdFx0XHRcdGxhYmVsICAgOiAoZm10ID09PSAnMjRoJykgPyAoc3RhcnQgKyAnIC0gJyArIGVuZCkgOiAoVGltZS5mb3JtYXRfbWludXRlc19hbXBtKHMpICsgJyAtICcgKyBUaW1lLmZvcm1hdF9taW51dGVzX2FtcG0oZSkpLFxyXG5cdFx0XHRcdFx0dmFsdWUgICA6IHN0YXJ0ICsgJyAtICcgKyBlbmQsXHJcblx0XHRcdFx0XHRzZWxlY3RlZDogZmFsc2VcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHR9XHJcblx0XHRcdHZhciBodG1sID0gd3BiY19iZmJfZmllbGRfcmFuZ2V0aW1lLmJ1aWxkX3Jvd19odG1sKGRhdGEsIGZtdCwgcGFuZWwpO1xyXG5cdFx0XHR2YXIgdG1wID0gZC5jcmVhdGVFbGVtZW50KCdkaXYnKTsgdG1wLmlubmVySFRNTCA9IGh0bWw7XHJcblx0XHRcdHZhciByb3cgPSB0bXAuZmlyc3RFbGVtZW50Q2hpbGQ7XHJcblx0XHRcdGFmdGVyX3Jvdy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyb3csIGFmdGVyX3Jvdy5uZXh0U2libGluZyk7XHJcblx0XHRcdHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5yZWluZGV4X3Jvd3MobGlzdCk7XHJcblx0XHRcdGlmIChmbXQgPT09ICcyNGgnKSB7XHJcblx0XHRcdFx0VGltZS5hcHBseV9pbWFza190b19pbnB1dChyb3cucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19vcHQtc3RhcnQnKSk7XHJcblx0XHRcdFx0VGltZS5hcHBseV9pbWFza190b19pbnB1dChyb3cucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19vcHQtZW5kJykpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHJlYWRfcm93KHJvdywgZm10KXtcclxuXHRcdFx0dmFyIGxhYmVsID0gKHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdC1sYWJlbCcpfHx7fSkudmFsdWUgfHwgJyc7XHJcblx0XHRcdHZhciBzX2VsICA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdC1zdGFydCcpO1xyXG5cdFx0XHR2YXIgZV9lbCAgPSByb3cucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19vcHQtZW5kJyk7XHJcblx0XHRcdHZhciBzX20gICA9IFRpbWUucGFyc2VfaGhtbV8yNGgoc19lbCA/IHNfZWwudmFsdWUgOiAnJyk7XHJcblx0XHRcdHZhciBlX20gICA9IFRpbWUucGFyc2VfaGhtbV8yNGgoZV9lbCA/IGVfZWwudmFsdWUgOiAnJyk7XHJcblx0XHRcdGlmIChpc05hTihzX20pKSBzX20gPSBUaW1lLnBhcnNlX21pbnV0ZXMoc19lbCA/IHNfZWwudmFsdWUgOiAnJyk7XHJcblx0XHRcdGlmIChpc05hTihlX20pKSBlX20gPSBUaW1lLnBhcnNlX21pbnV0ZXMoZV9lbCA/IGVfZWwudmFsdWUgOiAnJyk7XHJcblxyXG5cdFx0XHQvLyBBbGxvdyBleHBvcnQgZXZlbiB3aGVuIGVuZCA8PSBzdGFydCAob3Zlcm5pZ2h0IHJhbmdlcylcclxuXHRcdFx0dmFyIHZhbHVlID0gKCFpc05hTihzX20pICYmICFpc05hTihlX20pKSA/IChUaW1lLmZvcm1hdF9taW51dGVzXzI0aChzX20pICsgJyAtICcgKyBUaW1lLmZvcm1hdF9taW51dGVzXzI0aChlX20pKSA6ICcnO1xyXG5cdFx0XHR2YXIgc2VsICAgPSAhISgocm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoaycpfHx7fSkuY2hlY2tlZCk7XHJcblx0XHRcdHJldHVybiB7IGxhYmVsOiBsYWJlbCwgdmFsdWU6IHZhbHVlLCBzZWxlY3RlZDogc2VsIH07XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHN5bmNfc3RhdGVfZnJvbV9yb3dzKHBhbmVsKXtcclxuXHRcdFx0aWYgKCFwYW5lbCkgcmV0dXJuO1xyXG5cdFx0XHR2YXIgbGlzdCAgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdGlvbnNfbGlzdCcpO1xyXG5cdFx0XHR2YXIgc3RhdGUgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdGlvbnNfc3RhdGUnKTtcclxuXHRcdFx0aWYgKCFsaXN0IHx8ICFzdGF0ZSkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIGlzTXVsdGlwbGUgICA9ICEhcGFuZWwucXVlcnlTZWxlY3RvcignLmpzLW9wdC1tdWx0aXBsZTpjaGVja2VkJyk7XHJcblx0XHRcdHZhciBzZWVuU2VsZWN0ZWQgPSBmYWxzZTtcclxuXHRcdFx0dmFyIGZtdCA9IGdldF9jdXJyZW50X2Zvcm1hdChwYW5lbCk7XHJcblx0XHRcdHZhciBvdXQgPSBbXTtcclxuXHJcblx0XHRcdGxpc3QucXVlcnlTZWxlY3RvckFsbCgnLndwYmNfYmZiX19vcHRpb25zX3JvdycpLmZvckVhY2goZnVuY3Rpb24gKHJvdykge1xyXG5cdFx0XHRcdHZhciBvYmogPSB3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUucmVhZF9yb3cocm93LCBmbXQpO1xyXG5cdFx0XHRcdGlmICghaXNNdWx0aXBsZSAmJiBvYmouc2VsZWN0ZWQpIHtcclxuXHRcdFx0XHRcdGlmICghc2VlblNlbGVjdGVkKSB7XHJcblx0XHRcdFx0XHRcdHNlZW5TZWxlY3RlZCA9IHRydWU7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRvYmouc2VsZWN0ZWQgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0dmFyIGNoayA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX29wdC1zZWxlY3RlZC1jaGsnKTtcclxuXHRcdFx0XHRcdFx0aWYgKGNoayl7IGNoay5jaGVja2VkID0gZmFsc2U7IGNoay5zZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScpOyB9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdG91dC5wdXNoKG9iaik7XHJcblx0XHRcdFx0dmFyIGh2ID0gcm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fb3B0LXZhbHVlJyk7XHJcblx0XHRcdFx0aWYgKGh2KSBodi52YWx1ZSA9IG9iai52YWx1ZSB8fCAnJztcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHR0cnkgeyBzdGF0ZS52YWx1ZSA9IEpTT04uc3RyaW5naWZ5KG91dCk7IH0gY2F0Y2goZSl7IHN0YXRlLnZhbHVlID0gJ1tdJzsgfVxyXG5cdFx0XHRlbWl0X2luc3BlY3Rvcl9jaGFuZ2Uoc3RhdGUpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyByZXBsYWNlX29wdGlvbnNfaW5fcGFuZWwocGFuZWwsIHNsb3RzKXtcclxuXHRcdFx0dmFyIGxpc3QgID0gcGFuZWwucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19vcHRpb25zX2xpc3QnKTtcclxuXHRcdFx0dmFyIHN0YXRlID0gcGFuZWwucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19vcHRpb25zX3N0YXRlJyk7XHJcblx0XHRcdGlmICghbGlzdCB8fCAhc3RhdGUpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBmbXQgPSBnZXRfY3VycmVudF9mb3JtYXQocGFuZWwpO1xyXG5cdFx0XHRsaXN0LmlubmVySFRNTCA9ICcnO1xyXG5cdFx0XHQoc2xvdHMgfHwgW10pLmZvckVhY2goZnVuY3Rpb24ob3B0KXtcclxuXHRcdFx0XHR2YXIgaHRtbCA9IHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5idWlsZF9yb3dfaHRtbChvcHQsIGZtdCwgcGFuZWwpO1xyXG5cdFx0XHRcdHZhciB0bXAgPSBkLmNyZWF0ZUVsZW1lbnQoJ2RpdicpOyB0bXAuaW5uZXJIVE1MID0gaHRtbDtcclxuXHRcdFx0XHRsaXN0LmFwcGVuZENoaWxkKHRtcC5maXJzdEVsZW1lbnRDaGlsZCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0XHR3cGJjX2JmYl9maWVsZF9yYW5nZXRpbWUucmVpbmRleF9yb3dzKGxpc3QpO1xyXG5cdFx0XHRpZiAoZm10ID09PSAnMjRoJykgVGltZS5hcHBseV9pbWFza19pbl9jb250YWluZXJfMjRoKHBhbmVsKTtcclxuXHJcblx0XHRcdHRyeSB7IHN0YXRlLnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoc2xvdHMgfHwgW10pOyB9IGNhdGNoKGUpeyBzdGF0ZS52YWx1ZSA9ICdbXSc7IH1cclxuXHRcdFx0ZW1pdF9pbnNwZWN0b3JfY2hhbmdlKHN0YXRlKTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgcmVpbmRleF9yb3dzKGxpc3Qpe1xyXG5cdFx0XHRpZiAoIWxpc3QpIHJldHVybjtcclxuXHRcdFx0dmFyIGkgPSAwO1xyXG5cdFx0XHRsaXN0LnF1ZXJ5U2VsZWN0b3JBbGwoJy53cGJjX2JmYl9fb3B0aW9uc19yb3cnKS5mb3JFYWNoKGZ1bmN0aW9uKHJvdyl7XHJcblx0XHRcdFx0cm93LnNldEF0dHJpYnV0ZSgnZGF0YS1pbmRleCcsIFN0cmluZyhpKyspKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0dHJ5IHsgUmVnaXN0cnkucmVnaXN0ZXIoJ3JhbmdldGltZScsIHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZSk7IH1cclxuXHRjYXRjaCAoZSkgeyBpZiAody5fd3BiYyAmJiB3Ll93cGJjLmRldiAmJiB3Ll93cGJjLmRldi5lcnJvcikgdy5fd3BiYy5kZXYuZXJyb3IoJ3dwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5yZWdpc3RlcicsIGUpOyB9XHJcblxyXG5cdHdwYmNfYmZiX2ZpZWxkX3JhbmdldGltZS5iaW5kX2luc3BlY3Rvcl9ldmVudHNfb25jZSgpO1xyXG5cdHcuV1BCQ19CRkJfRmllbGRfUmFuZ2VUaW1lID0gd3BiY19iZmJfZmllbGRfcmFuZ2V0aW1lO1xyXG5cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRm9ybVwiIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIEJvb2tpbmcgRm9ybSBleHBvcnRlciBjYWxsYmFjayBmb3IgXCJyYW5nZXRpbWVcIi5cclxuXHQgKlxyXG5cdCAqIE1pcnJvcnMgdGhlIGxlZ2FjeSBiZWhhdmlvcjpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLmVtaXRfdGltZV9zZWxlY3QoIG5hbWUsIGZpZWxkLCByZXFfbWFyaywgaWRfb3B0LCBjbHNfb3B0cywgZW1pdF9sYWJlbF90aGVuICk7XHJcblx0ICpcclxuXHQgKiBTbyB0aGUgZmluYWwgc2hvcnRjb2RlIGJvZHkgYW5kIGxhYmVsIGhhbmRsaW5nIGFyZSBpZGVudGljYWwgdG8gdGhlIG9sZFxyXG5cdCAqIHN3aXRjaC9jYXNlIHBhdGggaW4gYnVpbGRlci1leHBvcnRlci5qcywganVzdCBtb3ZlZCBpbnRvIHRoaXMgcGFjay5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9yYW5nZXRpbWVfYm9va2luZ19mb3JtX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ3JhbmdldGltZScgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIFMgICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdHZhciBlc2NfaHRtbCA9IFMuZXNjYXBlX2h0bWwgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApOyB9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHR5cGUge1dQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2t9XHJcblx0XHQgKi9cclxuXHRcdHZhciBleHBvcnRlcl9jYWxsYmFjayA9IGZ1bmN0aW9uKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cdFx0XHRleHRyYXMgPSBleHRyYXMgfHwge307XHJcblxyXG5cdFx0XHR2YXIgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHRcdFx0dmFyIGN0eCA9IGV4dHJhcy5jdHg7XHJcblxyXG5cdFx0XHQvLyBTaGFyZWQgbGFiZWwgd3JhcHBlcjogcHJlZmVyIGdsb2JhbCBoZWxwZXI7IGZhbGwgYmFjayB0byBsb2NhbCBiZWhhdmlvci5cclxuXHRcdFx0dmFyIGVtaXRfbGFiZWxfdGhlbiA9IGZ1bmN0aW9uKCBib2R5ICkge1xyXG5cdFx0XHRcdC8vIFByZWZlcnJlZCBwYXRoOiBjZW50cmFsaXplZCBoZWxwZXIgaW4gYnVpbGRlci1leHBvcnRlci5qc1xyXG5cdFx0XHRcdGlmICggRXhwICYmIHR5cGVvZiBFeHAuZW1pdF9sYWJlbF90aGVuID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0RXhwLmVtaXRfbGFiZWxfdGhlbiggZmllbGQsIGVtaXQsIGJvZHksIGNmZyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdC8vIFJlcXVpcmVkIG1hcmtlciAoc2FtZSBzZW1hbnRpY3MgYXMgb3RoZXIgdGV4dC1saWtlIGZpZWxkcykuXHJcblx0XHRcdHZhciBpc19yZXEgICA9IEV4cC5pc19yZXF1aXJlZCggZmllbGQgKTtcclxuXHRcdFx0dmFyIHJlcV9tYXJrID0gaXNfcmVxID8gJyonIDogJyc7XHJcblxyXG5cdFx0XHQvLyBOYW1lIC8gaWQgLyBjbGFzc2VzIGZyb20gc2hhcmVkIGhlbHBlcnMgc28gdGhleSBzdGF5IGluIHN5bmMuXHJcblx0XHRcdHZhciBuYW1lICAgICA9IEV4cC5jb21wdXRlX25hbWUoICdyYW5nZXRpbWUnLCBmaWVsZCApO1xyXG5cdFx0XHR2YXIgaWRfb3B0ICAgPSBFeHAuaWRfb3B0aW9uKCBmaWVsZCwgY3R4ICk7XHJcblx0XHRcdHZhciBjbHNfb3B0cyA9IEV4cC5jbGFzc19vcHRpb25zKCBmaWVsZCApO1xyXG5cclxuXHRcdFx0Ly8gUHJlZmVyIHRoZSBkZWRpY2F0ZWQgdGltZSBoZWxwZXIgdG8ga2VlcCBleGFjdCBsZWdhY3kgc2hvcnRjb2RlIHNoYXBlLlxyXG5cdFx0XHRpZiAoIHR5cGVvZiBFeHAuZW1pdF90aW1lX3NlbGVjdCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRFeHAuZW1pdF90aW1lX3NlbGVjdCggbmFtZSwgZmllbGQsIHJlcV9tYXJrLCBpZF9vcHQsIGNsc19vcHRzLCBlbWl0X2xhYmVsX3RoZW4gKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblxyXG5cdFx0RXhwLnJlZ2lzdGVyKCAncmFuZ2V0aW1lJywgZXhwb3J0ZXJfY2FsbGJhY2sgKTtcclxuXHR9XHJcblxyXG5cdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHJlZ2lzdGVyX3JhbmdldGltZV9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2UgaWYgKCB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICkge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfcmFuZ2V0aW1lX2Jvb2tpbmdfZm9ybV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIERhdGFcIiAoQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyoqXHJcblx0ICogQm9va2luZyBEYXRhIGV4cG9ydGVyIGNhbGxiYWNrIGZvciBcInJhbmdldGltZVwiLlxyXG5cdCAqXHJcblx0ICogRGVmYXVsdCBiZWhhdmlvcjpcclxuXHQgKiAgIDxiPkxhYmVsPC9iPjogPGY+W3JhbmdldGltZV08L2Y+PGJyPlxyXG5cdCAqXHJcblx0ICogVGhlIGV4cG9ydGVkIHRva2VuIG5hbWUgaXMga2VwdCBmdWxseSBpbiBzeW5jIHdpdGggdGhlIEJvb2tpbmcgRm9ybSBleHBvcnRlclxyXG5cdCAqIHZpYSBFeHAuY29tcHV0ZV9uYW1lKCdyYW5nZXRpbWUnLCBmaWVsZCkuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfcmFuZ2V0aW1lX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcclxuXHJcblx0XHR2YXIgQyA9IHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEMgfHwgdHlwZW9mIEMucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0aWYgKCB0eXBlb2YgQy5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgQy5oYXNfZXhwb3J0ZXIoICdyYW5nZXRpbWUnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdEMucmVnaXN0ZXIoICdyYW5nZXRpbWUnLCBmdW5jdGlvbiggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cdFx0XHR2YXIgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHJcblx0XHRcdHZhciBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAuY29tcHV0ZV9uYW1lICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdC8vIEtlZXAgZXhwb3J0ZWQgbmFtZSBpZGVudGljYWwgdG8gdGhlIEJvb2tpbmcgRm9ybSBleHBvcnRlci5cclxuXHRcdFx0dmFyIG5hbWUgPSBFeHAuY29tcHV0ZV9uYW1lKCAncmFuZ2V0aW1lJywgZmllbGQgKTtcclxuXHRcdFx0aWYgKCAhIG5hbWUgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0dmFyIHJhd19sYWJlbCA9ICggdHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyApID8gZmllbGQubGFiZWwgOiAnJztcclxuXHRcdFx0dmFyIGxhYmVsICAgICA9IHJhd19sYWJlbC50cmltKCkgfHwgbmFtZTtcclxuXHJcblx0XHRcdC8vIFNoYXJlZCBoZWxwZXI6IDxiPkxhYmVsPC9iPjogPGY+W25hbWVdPC9mPjxicj5cclxuXHRcdFx0Qy5lbWl0X2xpbmVfYm9sZF9maWVsZCggZW1pdCwgbGFiZWwsIG5hbWUsIGNmZyApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRyZWdpc3Rlcl9yYW5nZXRpbWVfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIGlmICggdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfcmFuZ2V0aW1lX2Jvb2tpbmdfZGF0YV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9XHJcblxyXG59KSh3aW5kb3csIGRvY3VtZW50KTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaLElBQUlDLElBQUksR0FBT0YsQ0FBQyxDQUFDRyxhQUFhLElBQUksQ0FBQyxDQUFDO0VBQ3BDLElBQUlDLFFBQVEsR0FBR0YsSUFBSSxDQUFDRyxnQ0FBZ0M7RUFDcEQsSUFBSUMsSUFBSSxHQUFPSixJQUFJLENBQUNLLG1CQUFtQixJQUFJLElBQUk7RUFDL0MsSUFBSUMsSUFBSSxHQUFRTixJQUFJLElBQUlBLElBQUksQ0FBQ00sSUFBSSxHQUFJTixJQUFJLENBQUNNLElBQUksR0FBRyxJQUFJO0VBRXJELElBQUssQ0FBQ0osUUFBUSxJQUFJLE9BQU9BLFFBQVEsQ0FBQ0ssUUFBUSxLQUFLLFVBQVUsSUFBSSxDQUFDSCxJQUFJLElBQUksQ0FBQ0UsSUFBSSxFQUFHO0lBQzdFLElBQUlSLENBQUMsQ0FBQ1UsS0FBSyxJQUFJVixDQUFDLENBQUNVLEtBQUssQ0FBQ0MsR0FBRyxJQUFJWCxDQUFDLENBQUNVLEtBQUssQ0FBQ0MsR0FBRyxDQUFDQyxLQUFLLEVBQUU7TUFDaERaLENBQUMsQ0FBQ1UsS0FBSyxDQUFDQyxHQUFHLENBQUNDLEtBQUssQ0FBQywwQkFBMEIsRUFBRSx1Q0FBdUMsQ0FBQztJQUN2RjtJQUNBO0VBQ0Q7O0VBRUE7RUFDQTtFQUNBO0VBQ0EsU0FBU0MscUJBQXFCQSxDQUFDQyxFQUFFLEVBQUM7SUFDakMsSUFBSSxDQUFDQSxFQUFFLEVBQUU7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
