"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/time-start/_out/field-starttime-wptpl.js
// == Pack  Start Time (WP-template–driven) — Builder-focused renderer + options generator
// == Depends on Core: WPBC_BFB_Field_Base, Field_Renderer_Registry, Core.Time utils (parse/format/imask)
// == Version 1.0.0  (31.10.2025 16:45)
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base || null;
  var Time = Core && Core.Time ? Core.Time : null;
  if (!Registry || typeof Registry.register !== 'function' || !Base || !Time) {
    if (w._wpbc && w._wpbc.dev && w._wpbc.dev.error) {
      w._wpbc.dev.error('wpbc_bfb_field_starttime', 'Missing Core registry/base/time-utils');
    }
    return;
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function emit_inspector_change(el) {
    if (!el) {
      return;
    }
    if (el.__wpbc_emitting) {
      return;
    }
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
    panel.querySelectorAll('.js-st-label-fmt').forEach(function (r) {
      if (r.checked) {
        fmt = r.value === 'ampm' ? 'ampm' : '24h';
      }
    });
    return fmt;
  }
  function update_gen_visibility(panel) {
    var fmt = get_current_format(panel);
    var g24 = panel.querySelector('.js-st-24h');
    var gam = panel.querySelector('.js-st-ampm');
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
    if (!hidden) {
      return;
    }
    hidden.value = hidden.value && hidden.value.trim() !== '' ? hidden.value : 'starttime';
    emit_inspector_change(hidden);
  }

  // ---------------------------------------------------------------------
  // Canvas observer (sync preview and inspector)
  // ---------------------------------------------------------------------
  (function attach_canvas_observer() {
    var root = d.body,
      mo;
    function run_sync() {
      try {
        w.__wpbc_st_mo_pause && w.__wpbc_st_mo_pause();
      } catch (e) {}
      d.querySelectorAll('.wpbc_bfb__inspector_starttime').forEach(function (panel) {
        try {
          wpbc_bfb_field_starttime.sync_state_from_rows(panel);
        } catch (e) {}
      });
      try {
        w.__wpbc_st_mo_resume && w.__wpbc_st_mo_resume();
      } catch (e) {}
    }
    function handle(muts) {
      var found = false;
      for (var i = 0; i < muts.length && !found; i++) {
        var m = muts[i];
        if (m.type === 'childList' && m.target && m.target.matches && m.target.matches('.wpbc_bfb__preview-starttime')) {
          found = true;
        }
        for (var j = 0; j < m.addedNodes.length && !found; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) {
            continue;
          }
          if (n.matches && (n.matches('.wpbc_bfb__preview-starttime') || n.matches('.wpbc_bfb__preview-timepicker'))) {
            found = true;
          } else if (n.querySelector && (n.querySelector('.wpbc_bfb__preview-starttime') || n.querySelector('.wpbc_bfb__preview-timepicker'))) {
            found = true;
          }
        }
        if (!found && m.type === 'attributes' && m.target && m.target.matches && m.target.matches('.wpbc_bfb__preview-starttime')) {
          found = true;
        }
      }
      if (found) {
        Time.schedule_init_timeselector();
      }
      if (found) {
        run_sync();
      }
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
    w.__wpbc_st_mo_pause = function () {
      try {
        mo && mo.disconnect();
      } catch (e) {}
    };
    w.__wpbc_st_mo_resume = function () {
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
  const wpbc_bfb_field_starttime = class extends Base {
    static template_id = 'wpbc-bfb-field-starttime';
    static kind = 'starttime';
    static get_defaults() {
      return {
        kind: 'field',
        type: 'starttime',
        label: 'Start time',
        name: 'starttime',
        html_id: '',
        required: true,
        multiple: false,
        size: null,
        cssclass: '',
        help: '',
        default_value: '',
        placeholder: '--- Select time ---',
        value_differs: true,
        min_width: '180px',
        // AM/PM labels; 24h values.
        options: [{
          label: '08:00 AM',
          value: '08:00',
          selected: false
        }, {
          label: '09:00 AM',
          value: '09:00',
          selected: false
        }, {
          label: '10:00 AM',
          value: '10:00',
          selected: false
        }, {
          label: '11:00 AM',
          value: '11:00',
          selected: false
        }, {
          label: '12:00 PM',
          value: '12:00',
          selected: false
        }, {
          label: '01:00 PM',
          value: '13:00',
          selected: false
        }, {
          label: '02:00 PM',
          value: '14:00',
          selected: false
        }, {
          label: '03:00 PM',
          value: '15:00',
          selected: false
        }, {
          label: '04:00 PM',
          value: '16:00',
          selected: false
        }, {
          label: '05:00 PM',
          value: '17:00',
          selected: false
        }, {
          label: '06:00 PM',
          value: '18:00',
          selected: false
        }, {
          label: '07:00 PM',
          value: '19:00',
          selected: false
        }, {
          label: '08:00 PM',
          value: '20:00',
          selected: false
        }, {
          label: '09:00 PM',
          value: '21:00',
          selected: false
        }, {
          label: '10:00 PM',
          value: '22:00',
          selected: false
        }],
        // AM/PM generator by default.
        gen_label_fmt: 'ampm',
        gen_start_24h: '08:00',
        gen_end_24h: '22:00',
        gen_start_ampm_t: '08:00',
        gen_end_ampm_t: '22:00',
        gen_step_h: 1,
        gen_step_m: 0
      };
    }

    /**
     * After the field is dropped from the palette.
     *
     * @param {Object}      data
     * @param {HTMLElement} el
     * @param {Object}      ctx
     */
    static on_field_drop(data, el, ctx) {
      if (super.on_field_drop) {
        super.on_field_drop(data, el, ctx);
      }
      try {
        if (data && typeof data === 'object') {
          data.name = 'starttime';
          data.required = true;
        }
        if (el && el.dataset) {
          el.dataset.name = 'starttime';
          el.dataset.autoname = '0';
          el.dataset.fresh = '0';
          el.dataset.name_user_touched = '1';
          el.setAttribute('data-required', 'true');
        }
        var sel = el && el.querySelector('select.wpbc_bfb__preview-starttime');
        if (sel) {
          sel.setAttribute('name', 'starttime');
        }
      } catch (e) {}
    }

    // Bind Inspector events once.
    static bind_inspector_events_once() {
      if (this._bound_once) {
        return;
      }
      this._bound_once = true;

      // Persist placeholder on global picker toggle
      d.addEventListener('change', function (ev) {
        var tgl = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .js-toggle-timeslot-picker');
        if (!tgl) {
          return;
        }
        var panel = tgl.closest('.wpbc_bfb__inspector_starttime');
        var ph = panel && panel.querySelector('.js-placeholder');
        if (ph) {
          emit_inspector_change(ph);
        }
      });

      // AM/PM <-> 24h switch
      d.addEventListener('change', function (ev) {
        var radio = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .js-st-label-fmt');
        if (!radio) {
          return;
        }
        var panel = radio.closest('.wpbc_bfb__inspector_starttime');
        if (!panel) {
          return;
        }
        var fmt = get_current_format(panel);
        var proxy = panel.querySelector('.js-st-label-fmt-value');
        if (proxy) {
          proxy.value = fmt;
          emit_inspector_change(proxy);
        }
        update_gen_visibility(panel);

        // Sync generator inputs across groups
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

        // Re-apply masks for 24h edit inputs in the options rows.
        if (fmt === '24h') {
          Time.apply_imask_in_container_24h(panel);
        }
        wpbc_bfb_field_starttime.sync_state_from_rows(panel);
        Core.UI.pulse_query_debounced(panel, '.js-st-generate'); // avoid reflow spam while typing
      });

      // Mask on focus (24h)
      d.addEventListener('focusin', function (ev) {
        var el = ev.target && ev.target.closest('.js-st-mask[data-mask-kind="24h"]');
        if (el && !el._imask) {
          Time.apply_imask_to_input(el);
        }
      });

      // Step range <-> number sync
      d.addEventListener('input', function (ev) {
        var range = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime [data-len-group] [data-len-range]');
        if (!range) {
          return;
        }
        var group = range.closest('[data-len-group]');
        var num = group && group.querySelector('[data-len-value]');
        if (num) {
          num.value = range.value;
          if (num.hasAttribute('data-inspector-key')) {
            emit_inspector_change(num);
          }
        }
        const stPanel = (range || num).closest('.wpbc_bfb__inspector_starttime');
        Core.UI.pulse_query_debounced(stPanel, '.js-st-generate'); // avoid reflow spam while typing
      });
      d.addEventListener('input', function (ev) {
        var num = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime [data-len-group] [data-len-value]');
        if (!num) {
          return;
        }
        var group = num.closest('[data-len-group]');
        var range = group && group.querySelector('[data-len-range]');
        if (range) {
          range.value = num.value;
        }
        const stPanel = (range || num).closest('.wpbc_bfb__inspector_starttime');
        Core.UI.pulse_query_debounced(stPanel, '.js-st-generate'); // avoid reflow spam while typing
      });
      d.addEventListener('input', function (ev) {
        const genInput = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .js-gen-start-24h,' + '.wpbc_bfb__inspector_starttime .js-gen-end-24h,' + '.wpbc_bfb__inspector_starttime .js-gen-start-ampm-time,' + '.wpbc_bfb__inspector_starttime .js-gen-end-ampm-time,' + '.wpbc_bfb__inspector_starttime .js-gen-step-h,' + '.wpbc_bfb__inspector_starttime .js-gen-step-m');
        if (!genInput) return;
        const panel = genInput.closest('.wpbc_bfb__inspector_starttime');
        Core.UI.pulse_query_debounced(panel, '.js-st-generate'); // avoid reflow spam while typing
      });

      // Generate times
      d.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .js-st-generate');
        if (!btn) {
          return;
        }
        ev.preventDefault();
        var panel = btn.closest('.wpbc_bfb__inspector_starttime');
        if (!panel) {
          return;
        }
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
        var list = wpbc_bfb_field_starttime.build_times_list(start_m, end_m, step, fmt);
        wpbc_bfb_field_starttime.replace_options_in_panel(panel, list);
        if (fmt === '24h') {
          Time.apply_imask_in_container_24h(panel);
        }
        wpbc_bfb_field_starttime.sync_state_from_rows(panel);

        // --- Emit "generation finished" event for dependent packs (e.g., Duration Time) ---
        try {
          var stateEl = panel.querySelector('.wpbc_bfb__options_state');
          var optsArr = [];
          try {
            optsArr = JSON.parse(stateEl && stateEl.value || '[]');
          } catch (e) {
            optsArr = [];
          }
          var payload = {
            kind: 'field',
            type: panel && panel.getAttribute('data-type') || 'starttime',
            panel: panel,
            fieldEl: panel && panel.__wpbc_field_el || null,
            options: optsArr
          };
          var EV = Core && Core.WPBC_BFB_Events || {};
          if (Core.bus && typeof Core.bus.emit === 'function') {
            Core.bus.emit(EV.TIME_OPTIONS_GENERATED || 'wpbc_bfb:time_options_generated', payload);
          }
          if (panel && typeof panel.dispatchEvent === 'function') {
            panel.dispatchEvent(new CustomEvent('wpbc_bfb_time_options_generated', {
              bubbles: true,
              detail: payload
            }));
          }
        } catch (e) {/* noop */}
      });

      // Clear all
      d.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .js-st-clear');
        if (!btn) {
          return;
        }
        ev.preventDefault();
        var panel = btn.closest('.wpbc_bfb__inspector_starttime');
        if (!panel) {
          return;
        }
        wpbc_bfb_field_starttime.replace_options_in_panel(panel, []);
        wpbc_bfb_field_starttime.sync_state_from_rows(panel);
        Core.UI.pulse_query_debounced(panel, '.js-st-generate'); // avoid reflow spam while typing
      });

      // Add option
      d.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .js-st-add-option');
        if (!btn) {
          return;
        }
        ev.preventDefault();
        var panel = btn.closest('.wpbc_bfb__inspector_starttime');
        if (!panel) {
          return;
        }
        wpbc_bfb_field_starttime.add_option_row(panel);
        var fmt = get_current_format(panel);
        if (fmt === '24h') {
          Time.apply_imask_in_container_24h(panel);
        }
        wpbc_bfb_field_starttime.sync_state_from_rows(panel);
      });

      // Row dropdown actions
      d.addEventListener('click', function (ev) {
        var a = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .st_dropdown_action');
        if (!a) {
          return;
        }
        ev.preventDefault();
        var action = a.getAttribute('data-st-action') || '';
        var row = a.closest('.wpbc_bfb__options_row');
        var panel = a.closest('.wpbc_bfb__inspector_starttime');
        if (!row || !panel) {
          return;
        }
        if (action === 'add_after') {
          wpbc_bfb_field_starttime.insert_row_after(panel, row, null);
        } else if (action === 'duplicate') {
          var fmt = get_current_format(panel);
          var data = wpbc_bfb_field_starttime.read_row(row, fmt);
          wpbc_bfb_field_starttime.insert_row_after(panel, row, data);
        } else if (action === 'remove') {
          var listEl = row.parentNode;
          listEl.removeChild(row);
          wpbc_bfb_field_starttime.reindex_rows(listEl);
        }
        var fmt2 = get_current_format(panel);
        if (fmt2 === '24h') {
          Time.apply_imask_in_container_24h(panel);
        }
        wpbc_bfb_field_starttime.sync_state_from_rows(panel);
      });

      // Row edits -> sync
      d.addEventListener('input', function (ev) {
        var row = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .wpbc_bfb__options_row');
        if (!row) {
          return;
        }
        var panel = row.closest('.wpbc_bfb__inspector_starttime');
        wpbc_bfb_field_starttime.sync_state_from_rows(panel);
      });
      d.addEventListener('change', function (ev) {
        var row = ev.target && ev.target.closest('.wpbc_bfb__inspector_starttime .wpbc_bfb__options_row');
        if (!row) {
          return;
        }
        if (ev.target.classList.contains('wpbc_bfb__opt-selected-chk')) {
          var panel = row.closest('.wpbc_bfb__inspector_starttime');
          // Single-select → only one default
          if (panel) {
            panel.querySelectorAll('.wpbc_bfb__opt-selected-chk').forEach(function (chk) {
              if (chk !== ev.target) {
                chk.checked = false;
                chk.setAttribute('aria-checked', 'false');
              }
            });
            ev.target.setAttribute('aria-checked', 'true');
          }
        }
        var panel2 = row.closest('.wpbc_bfb__inspector_starttime');
        wpbc_bfb_field_starttime.sync_state_from_rows(panel2);
      });

      // Init on load for existing panels
      var init = function () {
        d.querySelectorAll('.wpbc_bfb__inspector_starttime').forEach(function (panel) {
          update_gen_visibility(panel);
          var fmt = get_current_format(panel);
          if (fmt === '24h') {
            Time.apply_imask_in_container_24h(panel);
          }
          enforce_locked_name(panel);
          var ph_init = panel.querySelector('.js-placeholder');
          if (ph_init) {
            emit_inspector_change(ph_init);
          }
        });
      };
      d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', init) : init();

      // Re-apply when Inspector re-renders a panel
      d.addEventListener('wpbc_bfb_inspector_ready', function (ev) {
        var panel = ev && ev.detail && ev.detail.panel;
        if (!panel) {
          return;
        }
        var stPanel = panel.closest ? panel.matches('.wpbc_bfb__inspector_starttime') ? panel : panel.closest('.wpbc_bfb__inspector_starttime') : null;
        if (!stPanel) {
          return;
        }
        update_gen_visibility(stPanel);
        var fmt = get_current_format(stPanel);
        if (fmt === '24h') {
          Time.apply_imask_in_container_24h(stPanel);
        }
        enforce_locked_name(stPanel);
        var ph_init = stPanel.querySelector('.js-placeholder');
        if (ph_init) {
          emit_inspector_change(ph_init);
        }
      });
    }

    // ------- Rows & state --------
    static build_row_html(data, fmt, panel) {
      var label = data && data.label || '';
      var value = data && data.value || '';
      var uid = 'wpbc_ins_st_' + Math.random().toString(36).slice(2, 10);
      var sel = !!(data && (true === data.selected || 'true' === data.selected || 1 === data.selected || '1' === data.selected));
      var i18n = {
        add: panel && panel.dataset.i18nAdd || 'Add New',
        duplicate: panel && panel.dataset.i18nDuplicate || 'Duplicate',
        remove: panel && panel.dataset.i18nRemove || 'Remove',
        def: panel && panel.dataset.i18nDefault || w.wpbc_i18n_default || 'Default',
        reorder: panel && panel.dataset.i18nReorder || 'Drag to reorder',
        rowlabel: panel && panel.dataset.i18nRowlabel || 'Label (e.g. 10:00 AM)'
      };
      var time_input_html = fmt === '24h' ? '<input type="text" class="wpbc_bfb__opt-time js-st-mask" data-mask-kind="24h" placeholder="HH:MM" value="' + Time.esc_attr(value) + '">' : '<input type="time" class="wpbc_bfb__opt-time js-st-time" step="300" value="' + Time.esc_attr(value) + '">';
      return '' + '<div class="wpbc_bfb__options_row" data-index="0">' + '<span class="wpbc_bfb__drag-handle" title="' + i18n.reorder + '"><span class="wpbc_icn_drag_indicator"></span></span>' + '<input type="text" class="wpbc_bfb__opt-label" placeholder="' + i18n.rowlabel + '" value="' + Time.esc_attr(label) + '">' + time_input_html + '<input type="text" class="wpbc_bfb__opt-value" value="' + Time.esc_attr(value) + '" hidden>' + '<div class="wpbc_bfb__opt-selected">' + '<div class="inspector__control wpbc_ui__toggle">' + '<input type="checkbox" class="wpbc_bfb__opt-selected-chk inspector__input" id="' + uid + '" role="switch" ' + (sel ? 'checked aria-checked="true"' : 'aria-checked="false"') + '>' + '<label class="wpbc_ui__toggle_icon_radio" for="' + uid + '"></label>' + '<label class="wpbc_ui__toggle_label" for="' + uid + '">' + i18n.def + '</label>' + '</div>' + '</div>' + '<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown">' + '<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false" class="ul_dropdown_menu_toggle">' + '<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>' + '</a>' + '<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">' + '<li><a class="ul_dropdown_menu_li_action st_dropdown_action" data-st-action="add_after" href="javascript:void(0)">' + i18n.add + '<i class="menu_icon icon-1x wpbc_icn_add_circle"></i></a></li>' + '<li><a class="ul_dropdown_menu_li_action st_dropdown_action" data-st-action="duplicate" href="javascript:void(0)">' + i18n.duplicate + '<i class="menu_icon icon-1x wpbc_icn_content_copy"></i></a></li>' + '<li class="divider"></li>' + '<li><a class="ul_dropdown_menu_li_action st_dropdown_action" data-st-action="remove" href="javascript:void(0)">' + i18n.remove + '<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></a></li>' + '</ul>' + '</div>' + '</div>';
    }
    static add_option_row(panel) {
      var list = panel.querySelector('.wpbc_bfb__options_list');
      if (!list) {
        return;
      }
      var fmt = get_current_format(panel);
      var m = 9 * 60;
      var value = Time.format_minutes_24h(m);
      var label = fmt === '24h' ? value : Time.format_minutes_ampm(m);
      var html = wpbc_bfb_field_starttime.build_row_html({
        label: label,
        value: value,
        selected: false
      }, fmt, panel);
      var tmp = d.createElement('div');
      tmp.innerHTML = html;
      var row = tmp.firstElementChild;
      list.appendChild(row);
      wpbc_bfb_field_starttime.reindex_rows(list);
      if (fmt === '24h') {
        Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-time'));
      }
    }
    static insert_row_after(panel, after_row, data) {
      var list = panel.querySelector('.wpbc_bfb__options_list');
      if (!list) {
        return;
      }
      var fmt = get_current_format(panel);
      if (!data) {
        var m = 9 * 60;
        var value = Time.format_minutes_24h(m);
        data = {
          label: fmt === '24h' ? value : Time.format_minutes_ampm(m),
          value: value,
          selected: false
        };
      }
      var html = wpbc_bfb_field_starttime.build_row_html(data, fmt, panel);
      var tmp = d.createElement('div');
      tmp.innerHTML = html;
      var row = tmp.firstElementChild;
      after_row.parentNode.insertBefore(row, after_row.nextSibling);
      wpbc_bfb_field_starttime.reindex_rows(list);
      if (fmt === '24h') {
        Time.apply_imask_to_input(row.querySelector('.wpbc_bfb__opt-time'));
      }
    }
    static read_row(row, fmt) {
      var label_el = row.querySelector('.wpbc_bfb__opt-label');
      var time_el = row.querySelector('.wpbc_bfb__opt-time');
      var raw_val = time_el ? String(time_el.value || '') : '';
      var m = Time.parse_hhmm_24h(raw_val);
      var value = isNaN(m) ? '' : Time.format_minutes_24h(m);
      var label = label_el ? String(label_el.value || '') : '';
      if (!label) {
        label = isNaN(m) ? '' : fmt === '24h' ? value : Time.format_minutes_ampm(m);
      }
      var sel = !!(row.querySelector('.wpbc_bfb__opt-selected-chk') || {}).checked;
      return {
        label: label,
        value: value,
        selected: sel
      };
    }
    static sync_state_from_rows(panel) {
      if (!panel) {
        return;
      }
      var list = panel.querySelector('.wpbc_bfb__options_list');
      var state = panel.querySelector('.wpbc_bfb__options_state');
      if (!list || !state) {
        return;
      }
      var seenSelected = false;
      var fmt = get_current_format(panel);
      var out = [];
      list.querySelectorAll('.wpbc_bfb__options_row').forEach(function (row) {
        var obj = wpbc_bfb_field_starttime.read_row(row, fmt);
        // Enforce single default
        if (obj.selected) {
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
        if (hv) {
          hv.value = obj.value || '';
        }
      });
      try {
        state.value = JSON.stringify(out);
      } catch (e) {
        state.value = '[]';
      }
      emit_inspector_change(state);
    }
    static replace_options_in_panel(panel, items) {
      var list = panel.querySelector('.wpbc_bfb__options_list');
      var state = panel.querySelector('.wpbc_bfb__options_state');
      if (!list || !state) {
        return;
      }
      var fmt = get_current_format(panel);
      list.innerHTML = '';
      (items || []).forEach(function (opt) {
        var html = wpbc_bfb_field_starttime.build_row_html(opt, fmt, panel);
        var tmp = d.createElement('div');
        tmp.innerHTML = html;
        list.appendChild(tmp.firstElementChild);
      });
      wpbc_bfb_field_starttime.reindex_rows(list);
      if (fmt === '24h') {
        Time.apply_imask_in_container_24h(panel);
      }
      try {
        state.value = JSON.stringify(items || []);
      } catch (e) {
        state.value = '[]';
      }
      emit_inspector_change(state);
    }
    static reindex_rows(list) {
      if (!list) {
        return;
      }
      var i = 0;
      list.querySelectorAll('.wpbc_bfb__options_row').forEach(function (row) {
        row.setAttribute('data-index', String(i++));
      });
    }

    /**
     * Build a list of time points between start_m and end_m (inclusive), with step minutes.
     * Labels follow fmt; values always "HH:MM" (24h).
     *
     * @param {number} start_m   Minutes since 00:00.
     * @param {number} end_m     Minutes since 00:00.
     * @param {number} step_mins Step (minutes), min 1.
     * @param {'24h'|'ampm'} fmt Label format.
     * @returns {Array<{label:string,value:string,selected:boolean}>}
     */
    static build_times_list(start_m, end_m, step_mins, fmt) {
      var out = [];
      if (isNaN(start_m) || isNaN(end_m)) {
        return out;
      }
      var step = Math.max(1, step_mins | 0);
      var dir = end_m >= start_m ? 1 : -1; // allow reverse order
      if (dir === 1) {
        for (var m = start_m; m <= end_m; m += step) {
          var val = Time.format_minutes_24h(m);
          var lbl = fmt === '24h' ? val : Time.format_minutes_ampm(m);
          out.push({
            label: lbl,
            value: val,
            selected: false
          });
        }
      } else {
        for (var m2 = start_m; m2 >= end_m; m2 -= step) {
          var val2 = Time.format_minutes_24h(m2);
          var lbl2 = fmt === '24h' ? val2 : Time.format_minutes_ampm(m2);
          out.push({
            label: lbl2,
            value: val2,
            selected: false
          });
        }
      }
      return out;
    }
  };
  try {
    Registry.register('starttime', wpbc_bfb_field_starttime);
  } catch (e) {
    if (w._wpbc && w._wpbc.dev && w._wpbc.dev.error) {
      w._wpbc.dev.error('wpbc_bfb_field_starttime.register', e);
    }
  }
  wpbc_bfb_field_starttime.bind_inspector_events_once();
  w.WPBC_BFB_Field_StartTime = wpbc_bfb_field_starttime;

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback for "starttime".
   *
   * Mirrors the legacy behavior:
   *   WPBC_BFB_Exporter.emit_time_select( name, field, req_mark, id_opt, cls_opts, emit_label_then );
   *
   * So the final shortcode body and label handling are identical to the old
   * switch/case path in builder-exporter.js, just moved into this pack.
   */
  function register_starttime_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('starttime')) {
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
      var name = Exp.compute_name('starttime', field);
      var id_opt = Exp.id_option(field, ctx);
      var cls_opts = Exp.class_options(field);

      // Prefer the dedicated time helper to keep exact legacy shortcode shape.
      if (typeof Exp.emit_time_select === 'function') {
        Exp.emit_time_select(name, field, req_mark, id_opt, cls_opts, emit_label_then);
        return;
      }
    };
    Exp.register('starttime', exporter_callback);
  }
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_starttime_booking_form_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:exporter-ready', register_starttime_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter callback for "starttime".
   *
   * Default behavior:
   *   <b>Label</b>: <f>[starttime]</f><br>
   *
   * The exported token name is kept fully in sync with the Booking Form exporter
   * via Exp.compute_name('starttime', field).
   */
  function register_starttime_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('starttime')) {
      return;
    }
    C.register('starttime', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }

      // Keep exported name identical to the Booking Form exporter.
      var name = Exp.compute_name('starttime', field);
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
    register_starttime_booking_data_exporter();
  } else if (typeof document !== 'undefined') {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_starttime_booking_data_exporter, {
      once: true
    });
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGltZS1zdGFydC9fb3V0L2ZpZWxkLXN0YXJ0dGltZS13cHRwbC5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJSZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJUaW1lIiwicmVnaXN0ZXIiLCJfd3BiYyIsImRldiIsImVycm9yIiwiZW1pdF9pbnNwZWN0b3JfY2hhbmdlIiwiZWwiLCJfX3dwYmNfZW1pdHRpbmciLCJqUXVlcnkiLCJ0cmlnZ2VyIiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiYnViYmxlcyIsInNjaGVkdWxlX2luaXRfdGltZXNlbGVjdG9yIiwiZ2V0X2N1cnJlbnRfZm9ybWF0IiwicGFuZWwiLCJmbXQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsInIiLCJjaGVja2VkIiwidmFsdWUiLCJ1cGRhdGVfZ2VuX3Zpc2liaWxpdHkiLCJnMjQiLCJxdWVyeVNlbGVjdG9yIiwiZ2FtIiwic3R5bGUiLCJkaXNwbGF5IiwiaGlkZGVuIiwiZW5mb3JjZV9sb2NrZWRfbmFtZSIsInRyaW0iLCJhdHRhY2hfY2FudmFzX29ic2VydmVyIiwicm9vdCIsImJvZHkiLCJtbyIsInJ1bl9zeW5jIiwiX193cGJjX3N0X21vX3BhdXNlIiwiZSIsIndwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZSIsInN5bmNfc3RhdGVfZnJvbV9yb3dzIiwiX193cGJjX3N0X21vX3Jlc3VtZSIsImhhbmRsZSIsIm11dHMiLCJmb3VuZCIsImkiLCJsZW5ndGgiLCJtIiwidHlwZSIsInRhcmdldCIsIm1hdGNoZXMiLCJqIiwiYWRkZWROb2RlcyIsIm4iLCJub2RlVHlwZSIsIk11dGF0aW9uT2JzZXJ2ZXIiLCJvYnNlcnZlIiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsImF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVGaWx0ZXIiLCJkaXNjb25uZWN0IiwidGVtcGxhdGVfaWQiLCJraW5kIiwiZ2V0X2RlZmF1bHRzIiwibGFiZWwiLCJuYW1lIiwiaHRtbF9pZCIsInJlcXVpcmVkIiwibXVsdGlwbGUiLCJzaXplIiwiY3NzY2xhc3MiLCJoZWxwIiwiZGVmYXVsdF92YWx1ZSIsInBsYWNlaG9sZGVyIiwidmFsdWVfZGlmZmVycyIsIm1pbl93aWR0aCIsIm9wdGlvbnMiLCJzZWxlY3RlZCIsImdlbl9sYWJlbF9mbXQiLCJnZW5fc3RhcnRfMjRoIiwiZ2VuX2VuZF8yNGgiLCJnZW5fc3RhcnRfYW1wbV90IiwiZ2VuX2VuZF9hbXBtX3QiLCJnZW5fc3RlcF9oIiwiZ2VuX3N0ZXBfbSIsIm9uX2ZpZWxkX2Ryb3AiLCJkYXRhIiwiY3R4IiwiZGF0YXNldCIsImF1dG9uYW1lIiwiZnJlc2giLCJuYW1lX3VzZXJfdG91Y2hlZCIsInNldEF0dHJpYnV0ZSIsInNlbCIsImJpbmRfaW5zcGVjdG9yX2V2ZW50c19vbmNlIiwiX2JvdW5kX29uY2UiLCJhZGRFdmVudExpc3RlbmVyIiwiZXYiLCJ0Z2wiLCJjbG9zZXN0IiwicGgiLCJyYWRpbyIsInByb3h5Iiwic190IiwiZV90Iiwic19tIiwicGFyc2VfaGhtbV8yNGgiLCJlX20iLCJzMjQiLCJpc05hTiIsImZvcm1hdF9taW51dGVzXzI0aCIsImUyNCIsInMyNGVsIiwiZTI0ZWwiLCJzMjR0IiwiZTI0dCIsInNfbTIiLCJlX20yIiwic2FtIiwiZWFtIiwic3RfZWwiLCJldF9lbCIsImFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGgiLCJVSSIsInB1bHNlX3F1ZXJ5X2RlYm91bmNlZCIsIl9pbWFzayIsImFwcGx5X2ltYXNrX3RvX2lucHV0IiwicmFuZ2UiLCJncm91cCIsIm51bSIsImhhc0F0dHJpYnV0ZSIsInN0UGFuZWwiLCJnZW5JbnB1dCIsImJ0biIsInByZXZlbnREZWZhdWx0Iiwic3RhcnRfbSIsImVuZF9tIiwic19hbSIsImVfYW0iLCJzdGVwX2giLCJwYXJzZUludCIsInN0ZXBfbSIsInN0ZXAiLCJNYXRoIiwibWF4IiwibGlzdCIsImJ1aWxkX3RpbWVzX2xpc3QiLCJyZXBsYWNlX29wdGlvbnNfaW5fcGFuZWwiLCJzdGF0ZUVsIiwib3B0c0FyciIsIkpTT04iLCJwYXJzZSIsInBheWxvYWQiLCJnZXRBdHRyaWJ1dGUiLCJmaWVsZEVsIiwiX193cGJjX2ZpZWxkX2VsIiwiRVYiLCJXUEJDX0JGQl9FdmVudHMiLCJidXMiLCJlbWl0IiwiVElNRV9PUFRJT05TX0dFTkVSQVRFRCIsIkN1c3RvbUV2ZW50IiwiZGV0YWlsIiwiYWRkX29wdGlvbl9yb3ciLCJhIiwiYWN0aW9uIiwicm93IiwiaW5zZXJ0X3Jvd19hZnRlciIsInJlYWRfcm93IiwibGlzdEVsIiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwicmVpbmRleF9yb3dzIiwiZm10MiIsImNsYXNzTGlzdCIsImNvbnRhaW5zIiwiY2hrIiwicGFuZWwyIiwiaW5pdCIsInBoX2luaXQiLCJyZWFkeVN0YXRlIiwiYnVpbGRfcm93X2h0bWwiLCJ1aWQiLCJyYW5kb20iLCJ0b1N0cmluZyIsInNsaWNlIiwiaTE4biIsImFkZCIsImkxOG5BZGQiLCJkdXBsaWNhdGUiLCJpMThuRHVwbGljYXRlIiwicmVtb3ZlIiwiaTE4blJlbW92ZSIsImRlZiIsImkxOG5EZWZhdWx0Iiwid3BiY19pMThuX2RlZmF1bHQiLCJyZW9yZGVyIiwiaTE4blJlb3JkZXIiLCJyb3dsYWJlbCIsImkxOG5Sb3dsYWJlbCIsInRpbWVfaW5wdXRfaHRtbCIsImVzY19hdHRyIiwiZm9ybWF0X21pbnV0ZXNfYW1wbSIsImh0bWwiLCJ0bXAiLCJjcmVhdGVFbGVtZW50IiwiaW5uZXJIVE1MIiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJhcHBlbmRDaGlsZCIsImFmdGVyX3JvdyIsImluc2VydEJlZm9yZSIsIm5leHRTaWJsaW5nIiwibGFiZWxfZWwiLCJ0aW1lX2VsIiwicmF3X3ZhbCIsIlN0cmluZyIsInN0YXRlIiwic2VlblNlbGVjdGVkIiwib3V0Iiwib2JqIiwicHVzaCIsImh2Iiwic3RyaW5naWZ5IiwiaXRlbXMiLCJvcHQiLCJzdGVwX21pbnMiLCJkaXIiLCJ2YWwiLCJsYmwiLCJtMiIsInZhbDIiLCJsYmwyIiwiV1BCQ19CRkJfRmllbGRfU3RhcnRUaW1lIiwicmVnaXN0ZXJfc3RhcnR0aW1lX2Jvb2tpbmdfZm9ybV9leHBvcnRlciIsIkV4cCIsIldQQkNfQkZCX0V4cG9ydGVyIiwiaGFzX2V4cG9ydGVyIiwiUyIsIldQQkNfQkZCX1Nhbml0aXplIiwiZXNjX2h0bWwiLCJlc2NhcGVfaHRtbCIsInYiLCJleHBvcnRlcl9jYWxsYmFjayIsImZpZWxkIiwiZXh0cmFzIiwiY2ZnIiwiZW1pdF9sYWJlbF90aGVuIiwiaXNfcmVxIiwiaXNfcmVxdWlyZWQiLCJyZXFfbWFyayIsImNvbXB1dGVfbmFtZSIsImlkX29wdCIsImlkX29wdGlvbiIsImNsc19vcHRzIiwiY2xhc3Nfb3B0aW9ucyIsImVtaXRfdGltZV9zZWxlY3QiLCJkb2N1bWVudCIsIm9uY2UiLCJyZWdpc3Rlcl9zdGFydHRpbWVfYm9va2luZ19kYXRhX2V4cG9ydGVyIiwiQyIsIldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciIsInJhd19sYWJlbCIsImVtaXRfbGluZV9ib2xkX2ZpZWxkIiwid2luZG93Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvdGltZS1zdGFydC9fc3JjL2ZpZWxkLXN0YXJ0dGltZS13cHRwbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3RpbWUtc3RhcnQvX291dC9maWVsZC1zdGFydHRpbWUtd3B0cGwuanNcclxuLy8gPT0gUGFjayAgU3RhcnQgVGltZSAoV1AtdGVtcGxhdGXigJNkcml2ZW4pIOKAlCBCdWlsZGVyLWZvY3VzZWQgcmVuZGVyZXIgKyBvcHRpb25zIGdlbmVyYXRvclxyXG4vLyA9PSBEZXBlbmRzIG9uIENvcmU6IFdQQkNfQkZCX0ZpZWxkX0Jhc2UsIEZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5LCBDb3JlLlRpbWUgdXRpbHMgKHBhcnNlL2Zvcm1hdC9pbWFzaylcclxuLy8gPT0gVmVyc2lvbiAxLjAuMCAgKDMxLjEwLjIwMjUgMTY6NDUpXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlICAgICA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fTtcclxuXHR2YXIgUmVnaXN0cnkgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBCYXNlICAgICA9IENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZSB8fCBudWxsO1xyXG5cdHZhciBUaW1lICAgICA9IChDb3JlICYmIENvcmUuVGltZSkgPyBDb3JlLlRpbWUgOiBudWxsO1xyXG5cclxuXHRpZiAoICFSZWdpc3RyeSB8fCB0eXBlb2YgUmVnaXN0cnkucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgfHwgIUJhc2UgfHwgIVRpbWUgKSB7XHJcblx0XHRpZiAoIHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgdy5fd3BiYy5kZXYuZXJyb3IgKSB7XHJcblx0XHRcdHcuX3dwYmMuZGV2LmVycm9yKCAnd3BiY19iZmJfZmllbGRfc3RhcnR0aW1lJywgJ01pc3NpbmcgQ29yZSByZWdpc3RyeS9iYXNlL3RpbWUtdXRpbHMnICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBIZWxwZXJzXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ZnVuY3Rpb24gZW1pdF9pbnNwZWN0b3JfY2hhbmdlKCBlbCApIHtcclxuXHRcdGlmICggISBlbCApIHsgcmV0dXJuOyB9XHJcblx0XHRpZiAoIGVsLl9fd3BiY19lbWl0dGluZyApIHsgcmV0dXJuOyB9XHJcblx0XHRlbC5fX3dwYmNfZW1pdHRpbmcgPSB0cnVlO1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKCB3LmpRdWVyeSApIHsgdy5qUXVlcnkoIGVsICkudHJpZ2dlciggJ2lucHV0JyApLnRyaWdnZXIoICdjaGFuZ2UnICk7IH1cclxuXHRcdFx0ZWwuZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KCAnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdGVsLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdH0gZmluYWxseSB7XHJcblx0XHRcdGVsLl9fd3BiY19lbWl0dGluZyA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdFx0VGltZS5zY2hlZHVsZV9pbml0X3RpbWVzZWxlY3RvcigpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2N1cnJlbnRfZm9ybWF0KCBwYW5lbCApIHtcclxuXHRcdHZhciBmbXQgPSAnYW1wbSc7XHJcblx0XHRwYW5lbC5xdWVyeVNlbGVjdG9yQWxsKCAnLmpzLXN0LWxhYmVsLWZtdCcgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHIgKSB7XHJcblx0XHRcdGlmICggci5jaGVja2VkICkgeyBmbXQgPSAoIHIudmFsdWUgPT09ICdhbXBtJyApID8gJ2FtcG0nIDogJzI0aCc7IH1cclxuXHRcdH0gKTtcclxuXHRcdHJldHVybiBmbXQ7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfZ2VuX3Zpc2liaWxpdHkoIHBhbmVsICkge1xyXG5cdFx0dmFyIGZtdCA9IGdldF9jdXJyZW50X2Zvcm1hdCggcGFuZWwgKTtcclxuXHRcdHZhciBnMjQgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLXN0LTI0aCcgKTtcclxuXHRcdHZhciBnYW0gPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLXN0LWFtcG0nICk7XHJcblx0XHRpZiAoIGcyNCApIHsgZzI0LnN0eWxlLmRpc3BsYXkgPSAoIGZtdCA9PT0gJzI0aCcgKSA/ICcnIDogJ25vbmUnOyBnMjQuaGlkZGVuID0gKCBmbXQgIT09ICcyNGgnICk7IH1cclxuXHRcdGlmICggZ2FtICkgeyBnYW0uc3R5bGUuZGlzcGxheSA9ICggZm10ID09PSAnYW1wbScgKSA/ICcnIDogJ25vbmUnOyBnYW0uaGlkZGVuID0gKCBmbXQgIT09ICdhbXBtJyApOyB9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlbmZvcmNlX2xvY2tlZF9uYW1lKCBwYW5lbCApIHtcclxuXHRcdHZhciBoaWRkZW4gPSBwYW5lbCAmJiBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLWxvY2tlZC1uYW1lW2RhdGEtaW5zcGVjdG9yLWtleT1cIm5hbWVcIl0nICk7XHJcblx0XHRpZiAoICEgaGlkZGVuICkgeyByZXR1cm47IH1cclxuXHRcdGhpZGRlbi52YWx1ZSA9ICggaGlkZGVuLnZhbHVlICYmIGhpZGRlbi52YWx1ZS50cmltKCkgIT09ICcnICkgPyBoaWRkZW4udmFsdWUgOiAnc3RhcnR0aW1lJztcclxuXHRcdGVtaXRfaW5zcGVjdG9yX2NoYW5nZSggaGlkZGVuICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBDYW52YXMgb2JzZXJ2ZXIgKHN5bmMgcHJldmlldyBhbmQgaW5zcGVjdG9yKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdChmdW5jdGlvbiBhdHRhY2hfY2FudmFzX29ic2VydmVyKCl7XHJcblx0XHR2YXIgcm9vdCA9IGQuYm9keSwgbW87XHJcblxyXG5cdFx0ZnVuY3Rpb24gcnVuX3N5bmMoKXtcclxuXHRcdFx0dHJ5IHsgdy5fX3dwYmNfc3RfbW9fcGF1c2UgJiYgdy5fX3dwYmNfc3RfbW9fcGF1c2UoKTsgfSBjYXRjaChlKXt9XHJcblx0XHRcdGQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZScgKS5mb3JFYWNoKCBmdW5jdGlvbiggcGFuZWwgKSB7XHJcblx0XHRcdFx0dHJ5IHsgd3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLnN5bmNfc3RhdGVfZnJvbV9yb3dzKCBwYW5lbCApOyB9IGNhdGNoKGUpe31cclxuXHRcdFx0fSApO1xyXG5cdFx0XHR0cnkgeyB3Ll9fd3BiY19zdF9tb19yZXN1bWUgJiYgdy5fX3dwYmNfc3RfbW9fcmVzdW1lKCk7IH0gY2F0Y2goZSl7fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZ1bmN0aW9uIGhhbmRsZSggbXV0cyApe1xyXG5cdFx0XHR2YXIgZm91bmQgPSBmYWxzZTtcclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgbXV0cy5sZW5ndGggJiYgIWZvdW5kOyBpKysgKSB7XHJcblx0XHRcdFx0dmFyIG0gPSBtdXRzWyBpIF07XHJcblx0XHRcdFx0aWYgKCBtLnR5cGUgPT09ICdjaGlsZExpc3QnICYmIG0udGFyZ2V0ICYmIG0udGFyZ2V0Lm1hdGNoZXMgJiYgbS50YXJnZXQubWF0Y2hlcyggJy53cGJjX2JmYl9fcHJldmlldy1zdGFydHRpbWUnICkgKSB7IGZvdW5kID0gdHJ1ZTsgfVxyXG5cdFx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IG0uYWRkZWROb2Rlcy5sZW5ndGggJiYgIWZvdW5kOyBqKysgKSB7XHJcblx0XHRcdFx0XHR2YXIgbiA9IG0uYWRkZWROb2Rlc1sgaiBdO1xyXG5cdFx0XHRcdFx0aWYgKCBuLm5vZGVUeXBlICE9PSAxICkgeyBjb250aW51ZTsgfVxyXG5cdFx0XHRcdFx0aWYgKCBuLm1hdGNoZXMgJiYgKG4ubWF0Y2hlcyggJy53cGJjX2JmYl9fcHJldmlldy1zdGFydHRpbWUnICkgfHwgbi5tYXRjaGVzKCAnLndwYmNfYmZiX19wcmV2aWV3LXRpbWVwaWNrZXInICkpICkgeyBmb3VuZCA9IHRydWU7IH1cclxuXHRcdFx0XHRcdGVsc2UgaWYgKCBuLnF1ZXJ5U2VsZWN0b3IgJiYgKG4ucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fcHJldmlldy1zdGFydHRpbWUnICkgfHwgbi5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19wcmV2aWV3LXRpbWVwaWNrZXInICkpICkgeyBmb3VuZCA9IHRydWU7IH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCAhIGZvdW5kICYmIG0udHlwZSA9PT0gJ2F0dHJpYnV0ZXMnICYmIG0udGFyZ2V0ICYmIG0udGFyZ2V0Lm1hdGNoZXMgJiYgbS50YXJnZXQubWF0Y2hlcyggJy53cGJjX2JmYl9fcHJldmlldy1zdGFydHRpbWUnICkgKSB7IGZvdW5kID0gdHJ1ZTsgfVxyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZm91bmQgKSB7IFRpbWUuc2NoZWR1bGVfaW5pdF90aW1lc2VsZWN0b3IoKTsgfVxyXG5cdFx0XHRpZiAoIGZvdW5kICkgeyBydW5fc3luYygpOyB9XHJcblx0XHR9XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0bW8gPSBuZXcgTXV0YXRpb25PYnNlcnZlciggaGFuZGxlICk7XHJcblx0XHRcdG1vLm9ic2VydmUoIHJvb3QsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlLCBhdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsgJ3ZhbHVlJywgJ2NsYXNzJyBdIH0gKTtcclxuXHRcdH0gY2F0Y2goZSkge31cclxuXHJcblx0XHR3Ll9fd3BiY19zdF9tb19wYXVzZSAgPSBmdW5jdGlvbigpeyB0cnkgeyBtbyAmJiBtby5kaXNjb25uZWN0KCk7IH0gY2F0Y2goZSl7fSB9O1xyXG5cdFx0dy5fX3dwYmNfc3RfbW9fcmVzdW1lID0gZnVuY3Rpb24oKXsgdHJ5IHtcclxuXHRcdFx0bW8gJiYgbW8ub2JzZXJ2ZSggcm9vdCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUsIGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWyAndmFsdWUnLCAnY2xhc3MnIF0gfSApO1xyXG5cdFx0fSBjYXRjaChlKXt9IH07XHJcblx0fSkoKTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gUmVuZGVyZXJcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRjb25zdCB3cGJjX2JmYl9maWVsZF9zdGFydHRpbWUgPSBjbGFzcyBleHRlbmRzIEJhc2Uge1xyXG5cdFx0c3RhdGljIHRlbXBsYXRlX2lkID0gJ3dwYmMtYmZiLWZpZWxkLXN0YXJ0dGltZSc7XHJcblx0XHRzdGF0aWMga2luZCAgICAgICAgPSAnc3RhcnR0aW1lJztcclxuXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCl7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0a2luZCAgICAgICAgICAgOiAnZmllbGQnLFxyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgIDogJ3N0YXJ0dGltZScsXHJcblx0XHRcdFx0bGFiZWwgICAgICAgICAgOiAnU3RhcnQgdGltZScsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgICAgOiAnc3RhcnR0aW1lJyxcclxuXHRcdFx0XHRodG1sX2lkICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdHJlcXVpcmVkICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRtdWx0aXBsZSAgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdHNpemUgICAgICAgICAgIDogbnVsbCxcclxuXHRcdFx0XHRjc3NjbGFzcyAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0ZGVmYXVsdF92YWx1ZSAgOiAnJyxcclxuXHRcdFx0XHRwbGFjZWhvbGRlciAgICA6ICctLS0gU2VsZWN0IHRpbWUgLS0tJyxcclxuXHRcdFx0XHR2YWx1ZV9kaWZmZXJzICA6IHRydWUsXHJcblx0XHRcdFx0bWluX3dpZHRoICAgICAgOiAnMTgwcHgnLFxyXG5cclxuXHRcdFx0XHQvLyBBTS9QTSBsYWJlbHM7IDI0aCB2YWx1ZXMuXHJcblx0XHRcdFx0b3B0aW9ucyAgICAgICAgOiBbXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDg6MDAgQU0nLCB2YWx1ZTogJzA4OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDk6MDAgQU0nLCB2YWx1ZTogJzA5OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMTA6MDAgQU0nLCB2YWx1ZTogJzEwOjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMTE6MDAgQU0nLCB2YWx1ZTogJzExOjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMTI6MDAgUE0nLCB2YWx1ZTogJzEyOjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDE6MDAgUE0nLCB2YWx1ZTogJzEzOjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDI6MDAgUE0nLCB2YWx1ZTogJzE0OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDM6MDAgUE0nLCB2YWx1ZTogJzE1OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDQ6MDAgUE0nLCB2YWx1ZTogJzE2OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDU6MDAgUE0nLCB2YWx1ZTogJzE3OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDY6MDAgUE0nLCB2YWx1ZTogJzE4OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDc6MDAgUE0nLCB2YWx1ZTogJzE5OjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDg6MDAgUE0nLCB2YWx1ZTogJzIwOjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMDk6MDAgUE0nLCB2YWx1ZTogJzIxOjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnMTA6MDAgUE0nLCB2YWx1ZTogJzIyOjAwJywgc2VsZWN0ZWQ6IGZhbHNlIH1cclxuXHRcdFx0XHRdLFxyXG5cclxuXHRcdFx0XHQvLyBBTS9QTSBnZW5lcmF0b3IgYnkgZGVmYXVsdC5cclxuXHRcdFx0XHRnZW5fbGFiZWxfZm10ICAgOiAnYW1wbScsXHJcblx0XHRcdFx0Z2VuX3N0YXJ0XzI0aCAgIDogJzA4OjAwJyxcclxuXHRcdFx0XHRnZW5fZW5kXzI0aCAgICAgOiAnMjI6MDAnLFxyXG5cdFx0XHRcdGdlbl9zdGFydF9hbXBtX3Q6ICcwODowMCcsXHJcblx0XHRcdFx0Z2VuX2VuZF9hbXBtX3QgIDogJzIyOjAwJyxcclxuXHRcdFx0XHRnZW5fc3RlcF9oICAgICAgOiAxLFxyXG5cdFx0XHRcdGdlbl9zdGVwX20gICAgICA6IDBcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFmdGVyIHRoZSBmaWVsZCBpcyBkcm9wcGVkIGZyb20gdGhlIHBhbGV0dGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGN0eFxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgb25fZmllbGRfZHJvcCggZGF0YSwgZWwsIGN0eCApe1xyXG5cdFx0XHRpZiAoIHN1cGVyLm9uX2ZpZWxkX2Ryb3AgKSB7IHN1cGVyLm9uX2ZpZWxkX2Ryb3AoIGRhdGEsIGVsLCBjdHggKTsgfVxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGlmICggZGF0YSAmJiB0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdFx0XHRkYXRhLm5hbWUgICAgID0gJ3N0YXJ0dGltZSc7XHJcblx0XHRcdFx0XHRkYXRhLnJlcXVpcmVkID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBlbCAmJiBlbC5kYXRhc2V0ICkge1xyXG5cdFx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lICAgICAgICAgICAgICA9ICdzdGFydHRpbWUnO1xyXG5cdFx0XHRcdFx0ZWwuZGF0YXNldC5hdXRvbmFtZSAgICAgICAgICA9ICcwJztcclxuXHRcdFx0XHRcdGVsLmRhdGFzZXQuZnJlc2ggICAgICAgICAgICAgPSAnMCc7XHJcblx0XHRcdFx0XHRlbC5kYXRhc2V0Lm5hbWVfdXNlcl90b3VjaGVkID0gJzEnO1xyXG5cdFx0XHRcdFx0ZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1yZXF1aXJlZCcsICd0cnVlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR2YXIgc2VsID0gZWwgJiYgZWwucXVlcnlTZWxlY3RvciggJ3NlbGVjdC53cGJjX2JmYl9fcHJldmlldy1zdGFydHRpbWUnICk7XHJcblx0XHRcdFx0aWYgKCBzZWwgKSB7IHNlbC5zZXRBdHRyaWJ1dGUoICduYW1lJywgJ3N0YXJ0dGltZScgKTsgfVxyXG5cclxuXHRcdFx0fSBjYXRjaChlKXt9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQmluZCBJbnNwZWN0b3IgZXZlbnRzIG9uY2UuXHJcblx0XHRzdGF0aWMgYmluZF9pbnNwZWN0b3JfZXZlbnRzX29uY2UoKXtcclxuXHRcdFx0aWYgKCB0aGlzLl9ib3VuZF9vbmNlICkgeyByZXR1cm47IH1cclxuXHRcdFx0dGhpcy5fYm91bmRfb25jZSA9IHRydWU7XHJcblxyXG5cdFx0XHQvLyBQZXJzaXN0IHBsYWNlaG9sZGVyIG9uIGdsb2JhbCBwaWNrZXIgdG9nZ2xlXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGZ1bmN0aW9uKCBldiApe1xyXG5cdFx0XHRcdHZhciB0Z2wgPSBldi50YXJnZXQgJiYgZXYudGFyZ2V0LmNsb3Nlc3QoICcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUgLmpzLXRvZ2dsZS10aW1lc2xvdC1waWNrZXInICk7XHJcblx0XHRcdFx0aWYgKCAhIHRnbCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0dmFyIHBhbmVsID0gdGdsLmNsb3Nlc3QoICcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUnICk7XHJcblx0XHRcdFx0dmFyIHBoICAgID0gcGFuZWwgJiYgcGFuZWwucXVlcnlTZWxlY3RvciggJy5qcy1wbGFjZWhvbGRlcicgKTtcclxuXHRcdFx0XHRpZiAoIHBoICkgeyBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UoIHBoICk7IH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQU0vUE0gPC0+IDI0aCBzd2l0Y2hcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ICl7XHJcblx0XHRcdFx0dmFyIHJhZGlvID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lIC5qcy1zdC1sYWJlbC1mbXQnICk7XHJcblx0XHRcdFx0aWYgKCAhIHJhZGlvICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0dmFyIHBhbmVsID0gcmFkaW8uY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZScgKTtcclxuXHRcdFx0XHRpZiAoICEgcGFuZWwgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0XHR2YXIgZm10ICAgPSBnZXRfY3VycmVudF9mb3JtYXQoIHBhbmVsICk7XHJcblx0XHRcdFx0dmFyIHByb3h5ID0gcGFuZWwucXVlcnlTZWxlY3RvciggJy5qcy1zdC1sYWJlbC1mbXQtdmFsdWUnICk7XHJcblx0XHRcdFx0aWYgKCBwcm94eSApIHsgcHJveHkudmFsdWUgPSBmbXQ7IGVtaXRfaW5zcGVjdG9yX2NoYW5nZSggcHJveHkgKTsgfVxyXG5cclxuXHRcdFx0XHR1cGRhdGVfZ2VuX3Zpc2liaWxpdHkoIHBhbmVsICk7XHJcblxyXG5cdFx0XHRcdC8vIFN5bmMgZ2VuZXJhdG9yIGlucHV0cyBhY3Jvc3MgZ3JvdXBzXHJcblx0XHRcdFx0aWYgKCBmbXQgPT09ICcyNGgnICkge1xyXG5cdFx0XHRcdFx0dmFyIHNfdCA9ICggcGFuZWwucXVlcnlTZWxlY3RvciggJy5qcy1nZW4tc3RhcnQtYW1wbS10aW1lJyApIHx8IHt9ICkudmFsdWUgfHwgJyc7XHJcblx0XHRcdFx0XHR2YXIgZV90ID0gKCBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLWdlbi1lbmQtYW1wbS10aW1lJyApICAgfHwge30gKS52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdHZhciBzX20gPSBUaW1lLnBhcnNlX2hobW1fMjRoKCBzX3QgKSwgZV9tID0gVGltZS5wYXJzZV9oaG1tXzI0aCggZV90ICk7XHJcblx0XHRcdFx0XHR2YXIgczI0ID0gaXNOYU4oIHNfbSApID8gJycgOiBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCggc19tICk7XHJcblx0XHRcdFx0XHR2YXIgZTI0ID0gaXNOYU4oIGVfbSApID8gJycgOiBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCggZV9tICk7XHJcblx0XHRcdFx0XHR2YXIgczI0ZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLWdlbi1zdGFydC0yNGgnICk7XHJcblx0XHRcdFx0XHR2YXIgZTI0ZWwgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLWdlbi1lbmQtMjRoJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBzMjRlbCApIHsgczI0ZWwudmFsdWUgPSBzMjQ7IGVtaXRfaW5zcGVjdG9yX2NoYW5nZSggczI0ZWwgKTsgfVxyXG5cdFx0XHRcdFx0aWYgKCBlMjRlbCApIHsgZTI0ZWwudmFsdWUgPSBlMjQ7IGVtaXRfaW5zcGVjdG9yX2NoYW5nZSggZTI0ZWwgKTsgfVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR2YXIgczI0dCA9ICggcGFuZWwucXVlcnlTZWxlY3RvciggJy5qcy1nZW4tc3RhcnQtMjRoJyApIHx8IHt9ICkudmFsdWUgfHwgJyc7XHJcblx0XHRcdFx0XHR2YXIgZTI0dCA9ICggcGFuZWwucXVlcnlTZWxlY3RvciggJy5qcy1nZW4tZW5kLTI0aCcgKSAgIHx8IHt9ICkudmFsdWUgfHwgJyc7XHJcblx0XHRcdFx0XHR2YXIgc19tMiA9IFRpbWUucGFyc2VfaGhtbV8yNGgoIHMyNHQgKSwgZV9tMiA9IFRpbWUucGFyc2VfaGhtbV8yNGgoIGUyNHQgKTtcclxuXHRcdFx0XHRcdHZhciBzYW0gID0gaXNOYU4oIHNfbTIgKSA/ICcnIDogVGltZS5mb3JtYXRfbWludXRlc18yNGgoIHNfbTIgKTtcclxuXHRcdFx0XHRcdHZhciBlYW0gID0gaXNOYU4oIGVfbTIgKSA/ICcnIDogVGltZS5mb3JtYXRfbWludXRlc18yNGgoIGVfbTIgKTtcclxuXHRcdFx0XHRcdHZhciBzdF9lbCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtZ2VuLXN0YXJ0LWFtcG0tdGltZScgKTtcclxuXHRcdFx0XHRcdHZhciBldF9lbCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtZ2VuLWVuZC1hbXBtLXRpbWUnICk7XHJcblx0XHRcdFx0XHRpZiAoIHN0X2VsICkgeyBzdF9lbC52YWx1ZSA9IHNhbTsgZW1pdF9pbnNwZWN0b3JfY2hhbmdlKCBzdF9lbCApOyB9XHJcblx0XHRcdFx0XHRpZiAoIGV0X2VsICkgeyBldF9lbC52YWx1ZSA9IGVhbTsgZW1pdF9pbnNwZWN0b3JfY2hhbmdlKCBldF9lbCApOyB9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBSZS1hcHBseSBtYXNrcyBmb3IgMjRoIGVkaXQgaW5wdXRzIGluIHRoZSBvcHRpb25zIHJvd3MuXHJcblx0XHRcdFx0aWYgKCBmbXQgPT09ICcyNGgnICkgeyBUaW1lLmFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGgoIHBhbmVsICk7IH1cclxuXHRcdFx0XHR3cGJjX2JmYl9maWVsZF9zdGFydHRpbWUuc3luY19zdGF0ZV9mcm9tX3Jvd3MoIHBhbmVsICk7XHJcblx0XHRcdFx0Q29yZS5VSS5wdWxzZV9xdWVyeV9kZWJvdW5jZWQoIHBhbmVsLCAnLmpzLXN0LWdlbmVyYXRlJyApOyAvLyBhdm9pZCByZWZsb3cgc3BhbSB3aGlsZSB0eXBpbmdcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gTWFzayBvbiBmb2N1cyAoMjRoKVxyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c2luJywgZnVuY3Rpb24oIGV2ICl7XHJcblx0XHRcdFx0dmFyIGVsID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCAnLmpzLXN0LW1hc2tbZGF0YS1tYXNrLWtpbmQ9XCIyNGhcIl0nICk7XHJcblx0XHRcdFx0aWYgKCBlbCAmJiAhIGVsLl9pbWFzayApIHsgVGltZS5hcHBseV9pbWFza190b19pbnB1dCggZWwgKTsgfVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBTdGVwIHJhbmdlIDwtPiBudW1iZXIgc3luY1xyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGZ1bmN0aW9uKCBldiApe1xyXG5cdFx0XHRcdHZhciByYW5nZSA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZSBbZGF0YS1sZW4tZ3JvdXBdIFtkYXRhLWxlbi1yYW5nZV0nICk7XHJcblx0XHRcdFx0aWYgKCAhIHJhbmdlICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHR2YXIgZ3JvdXAgPSByYW5nZS5jbG9zZXN0KCAnW2RhdGEtbGVuLWdyb3VwXScgKTtcclxuXHRcdFx0XHR2YXIgbnVtICAgPSBncm91cCAmJiBncm91cC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtbGVuLXZhbHVlXScgKTtcclxuXHRcdFx0XHRpZiAoIG51bSApIHtcclxuXHRcdFx0XHRcdG51bS52YWx1ZSA9IHJhbmdlLnZhbHVlO1xyXG5cdFx0XHRcdFx0aWYgKCBudW0uaGFzQXR0cmlidXRlKCAnZGF0YS1pbnNwZWN0b3Ita2V5JyApICkgeyBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UoIG51bSApOyB9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNvbnN0IHN0UGFuZWwgPSAocmFuZ2UgfHwgbnVtKS5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUnKTtcclxuXHRcdFx0XHRDb3JlLlVJLnB1bHNlX3F1ZXJ5X2RlYm91bmNlZCggc3RQYW5lbCwgJy5qcy1zdC1nZW5lcmF0ZScgKTsgLy8gYXZvaWQgcmVmbG93IHNwYW0gd2hpbGUgdHlwaW5nXHJcblx0XHRcdH0gKTtcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBmdW5jdGlvbiggZXYgKXtcclxuXHRcdFx0XHR2YXIgbnVtID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lIFtkYXRhLWxlbi1ncm91cF0gW2RhdGEtbGVuLXZhbHVlXScgKTtcclxuXHRcdFx0XHRpZiAoICEgbnVtICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHR2YXIgZ3JvdXAgPSBudW0uY2xvc2VzdCggJ1tkYXRhLWxlbi1ncm91cF0nICk7XHJcblx0XHRcdFx0dmFyIHJhbmdlID0gZ3JvdXAgJiYgZ3JvdXAucXVlcnlTZWxlY3RvciggJ1tkYXRhLWxlbi1yYW5nZV0nICk7XHJcblx0XHRcdFx0aWYgKCByYW5nZSApIHsgcmFuZ2UudmFsdWUgPSBudW0udmFsdWU7IH1cclxuXHRcdFx0XHRjb25zdCBzdFBhbmVsID0gKHJhbmdlIHx8IG51bSkuY2xvc2VzdCgnLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lJyk7XHJcblx0XHRcdFx0Q29yZS5VSS5wdWxzZV9xdWVyeV9kZWJvdW5jZWQoIHN0UGFuZWwsICcuanMtc3QtZ2VuZXJhdGUnICk7IC8vIGF2b2lkIHJlZmxvdyBzcGFtIHdoaWxlIHR5cGluZ1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZnVuY3Rpb24oZXYpe1xyXG5cdFx0XHQgIGNvbnN0IGdlbklucHV0ID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KFxyXG5cdFx0XHRcdCcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUgLmpzLWdlbi1zdGFydC0yNGgsJyArXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZSAuanMtZ2VuLWVuZC0yNGgsJyArXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZSAuanMtZ2VuLXN0YXJ0LWFtcG0tdGltZSwnICtcclxuXHRcdFx0XHQnLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lIC5qcy1nZW4tZW5kLWFtcG0tdGltZSwnICtcclxuXHRcdFx0XHQnLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lIC5qcy1nZW4tc3RlcC1oLCcgK1xyXG5cdFx0XHRcdCcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUgLmpzLWdlbi1zdGVwLW0nXHJcblx0XHRcdCAgKTtcclxuXHRcdFx0ICBpZiAoIWdlbklucHV0KSByZXR1cm47XHJcblx0XHRcdCAgY29uc3QgcGFuZWwgPSBnZW5JbnB1dC5jbG9zZXN0KCcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUnKTtcclxuXHRcdFx0ICBDb3JlLlVJLnB1bHNlX3F1ZXJ5X2RlYm91bmNlZCggcGFuZWwsICcuanMtc3QtZ2VuZXJhdGUnICk7IC8vIGF2b2lkIHJlZmxvdyBzcGFtIHdoaWxlIHR5cGluZ1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdC8vIEdlbmVyYXRlIHRpbWVzXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24oIGV2ICl7XHJcblx0XHRcdFx0dmFyIGJ0biA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZSAuanMtc3QtZ2VuZXJhdGUnICk7XHJcblx0XHRcdFx0aWYgKCAhIGJ0biApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdFx0dmFyIHBhbmVsID0gYnRuLmNsb3Nlc3QoICcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUnICk7XHJcblx0XHRcdFx0aWYgKCAhIHBhbmVsICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0dmFyIGZtdCA9IGdldF9jdXJyZW50X2Zvcm1hdCggcGFuZWwgKTtcclxuXHRcdFx0XHR2YXIgc3RhcnRfbSwgZW5kX207XHJcblx0XHRcdFx0aWYgKCBmbXQgPT09ICcyNGgnICkge1xyXG5cdFx0XHRcdFx0dmFyIHMyNCA9ICggcGFuZWwucXVlcnlTZWxlY3RvciggJy5qcy1nZW4tc3RhcnQtMjRoJyApIHx8IHt9ICkudmFsdWUgfHwgJyc7XHJcblx0XHRcdFx0XHR2YXIgZTI0ID0gKCBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLWdlbi1lbmQtMjRoJyApICAgfHwge30gKS52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdHN0YXJ0X20gPSBUaW1lLnBhcnNlX2hobW1fMjRoKCBzMjQgKTtcclxuXHRcdFx0XHRcdGVuZF9tICAgPSBUaW1lLnBhcnNlX2hobW1fMjRoKCBlMjQgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dmFyIHNfYW0gPSAoIHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtZ2VuLXN0YXJ0LWFtcG0tdGltZScgKSB8fCB7fSApLnZhbHVlIHx8ICcnO1xyXG5cdFx0XHRcdFx0dmFyIGVfYW0gPSAoIHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtZ2VuLWVuZC1hbXBtLXRpbWUnICkgICB8fCB7fSApLnZhbHVlIHx8ICcnO1xyXG5cdFx0XHRcdFx0c3RhcnRfbSAgPSBUaW1lLnBhcnNlX2hobW1fMjRoKCBzX2FtICk7IC8vIGlucHV0W3R5cGU9dGltZV0gPT4gXCJISDpNTVwiXHJcblx0XHRcdFx0XHRlbmRfbSAgICA9IFRpbWUucGFyc2VfaGhtbV8yNGgoIGVfYW0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dmFyIHN0ZXBfaCA9IHBhcnNlSW50KCAoIHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtZ2VuLXN0ZXAtaCcgKSB8fCB7fSApLnZhbHVlLCAxMCApIHx8IDA7XHJcblx0XHRcdFx0dmFyIHN0ZXBfbSA9IHBhcnNlSW50KCAoIHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtZ2VuLXN0ZXAtbScgKSB8fCB7fSApLnZhbHVlLCAxMCApIHx8IDA7XHJcblx0XHRcdFx0dmFyIHN0ZXAgICA9IE1hdGgubWF4KCAxLCBzdGVwX2ggKiA2MCArIHN0ZXBfbSApO1xyXG5cclxuXHRcdFx0XHR2YXIgbGlzdCA9IHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5idWlsZF90aW1lc19saXN0KCBzdGFydF9tLCBlbmRfbSwgc3RlcCwgZm10ICk7XHJcblx0XHRcdFx0d3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLnJlcGxhY2Vfb3B0aW9uc19pbl9wYW5lbCggcGFuZWwsIGxpc3QgKTtcclxuXHRcdFx0XHRpZiAoIGZtdCA9PT0gJzI0aCcgKSB7IFRpbWUuYXBwbHlfaW1hc2tfaW5fY29udGFpbmVyXzI0aCggcGFuZWwgKTsgfVxyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5zeW5jX3N0YXRlX2Zyb21fcm93cyggcGFuZWwgKTtcclxuXHJcblx0XHRcdFx0Ly8gLS0tIEVtaXQgXCJnZW5lcmF0aW9uIGZpbmlzaGVkXCIgZXZlbnQgZm9yIGRlcGVuZGVudCBwYWNrcyAoZS5nLiwgRHVyYXRpb24gVGltZSkgLS0tXHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHZhciBzdGF0ZUVsID0gcGFuZWwucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19vcHRpb25zX3N0YXRlJyk7XHJcblx0XHRcdFx0XHR2YXIgb3B0c0FyciA9IFtdO1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0b3B0c0FyciA9IEpTT04ucGFyc2UoIChzdGF0ZUVsICYmIHN0YXRlRWwudmFsdWUpIHx8ICdbXScgKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2goZSkgeyBvcHRzQXJyID0gW107IH1cclxuXHJcblx0XHRcdFx0XHR2YXIgcGF5bG9hZCA9IHtcclxuXHRcdFx0XHRcdFx0a2luZCAgIDogJ2ZpZWxkJyxcclxuXHRcdFx0XHRcdFx0dHlwZSAgIDogKHBhbmVsICYmIHBhbmVsLmdldEF0dHJpYnV0ZSgnZGF0YS10eXBlJykpIHx8ICdzdGFydHRpbWUnLFxyXG5cdFx0XHRcdFx0XHRwYW5lbCAgOiBwYW5lbCxcclxuXHRcdFx0XHRcdFx0ZmllbGRFbDogKHBhbmVsICYmIHBhbmVsLl9fd3BiY19maWVsZF9lbCkgfHwgbnVsbCxcclxuXHRcdFx0XHRcdFx0b3B0aW9uczogb3B0c0FyclxyXG5cdFx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0XHR2YXIgRVYgPSAoQ29yZSAmJiBDb3JlLldQQkNfQkZCX0V2ZW50cykgfHwge307XHJcblx0XHRcdFx0XHRpZiAoQ29yZS5idXMgJiYgdHlwZW9mIENvcmUuYnVzLmVtaXQgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdFx0Q29yZS5idXMuZW1pdCggRVYuVElNRV9PUFRJT05TX0dFTkVSQVRFRCB8fCAnd3BiY19iZmI6dGltZV9vcHRpb25zX2dlbmVyYXRlZCcsIHBheWxvYWQgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmIChwYW5lbCAmJiB0eXBlb2YgcGFuZWwuZGlzcGF0Y2hFdmVudCA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdFx0XHRwYW5lbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoJ3dwYmNfYmZiX3RpbWVfb3B0aW9uc19nZW5lcmF0ZWQnLCB7IGJ1YmJsZXM6dHJ1ZSwgZGV0YWlsOiBwYXlsb2FkIH0pICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaChlKSB7IC8qIG5vb3AgKi8gfVxyXG5cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQ2xlYXIgYWxsXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24oIGV2ICl7XHJcblx0XHRcdFx0dmFyIGJ0biA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZSAuanMtc3QtY2xlYXInICk7XHJcblx0XHRcdFx0aWYgKCAhIGJ0biApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHR2YXIgcGFuZWwgPSBidG4uY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZScgKTtcclxuXHRcdFx0XHRpZiAoICEgcGFuZWwgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5yZXBsYWNlX29wdGlvbnNfaW5fcGFuZWwoIHBhbmVsLCBbXSApO1xyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5zeW5jX3N0YXRlX2Zyb21fcm93cyggcGFuZWwgKTtcclxuXHRcdFx0XHRDb3JlLlVJLnB1bHNlX3F1ZXJ5X2RlYm91bmNlZCggcGFuZWwsICcuanMtc3QtZ2VuZXJhdGUnICk7IC8vIGF2b2lkIHJlZmxvdyBzcGFtIHdoaWxlIHR5cGluZ1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBBZGQgb3B0aW9uXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24oIGV2ICl7XHJcblx0XHRcdFx0dmFyIGJ0biA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZSAuanMtc3QtYWRkLW9wdGlvbicgKTtcclxuXHRcdFx0XHRpZiAoICEgYnRuICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdHZhciBwYW5lbCA9IGJ0bi5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lJyApO1xyXG5cdFx0XHRcdGlmICggISBwYW5lbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5hZGRfb3B0aW9uX3JvdyggcGFuZWwgKTtcclxuXHRcdFx0XHR2YXIgZm10ID0gZ2V0X2N1cnJlbnRfZm9ybWF0KCBwYW5lbCApO1xyXG5cdFx0XHRcdGlmICggZm10ID09PSAnMjRoJyApIHsgVGltZS5hcHBseV9pbWFza19pbl9jb250YWluZXJfMjRoKCBwYW5lbCApOyB9XHJcblx0XHRcdFx0d3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLnN5bmNfc3RhdGVfZnJvbV9yb3dzKCBwYW5lbCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBSb3cgZHJvcGRvd24gYWN0aW9uc1xyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uKCBldiApe1xyXG5cdFx0XHRcdHZhciBhID0gZXYudGFyZ2V0ICYmIGV2LnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lIC5zdF9kcm9wZG93bl9hY3Rpb24nICk7XHJcblx0XHRcdFx0aWYgKCAhIGEgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRcdHZhciBhY3Rpb24gPSBhLmdldEF0dHJpYnV0ZSggJ2RhdGEtc3QtYWN0aW9uJyApIHx8ICcnO1xyXG5cdFx0XHRcdHZhciByb3cgICAgPSBhLmNsb3Nlc3QoICcud3BiY19iZmJfX29wdGlvbnNfcm93JyApO1xyXG5cdFx0XHRcdHZhciBwYW5lbCAgPSBhLmNsb3Nlc3QoICcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUnICk7XHJcblx0XHRcdFx0aWYgKCAhIHJvdyB8fCAhIHBhbmVsICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0aWYgKCBhY3Rpb24gPT09ICdhZGRfYWZ0ZXInICkge1xyXG5cdFx0XHRcdFx0d3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLmluc2VydF9yb3dfYWZ0ZXIoIHBhbmVsLCByb3csIG51bGwgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBhY3Rpb24gPT09ICdkdXBsaWNhdGUnICkge1xyXG5cdFx0XHRcdFx0dmFyIGZtdCAgPSBnZXRfY3VycmVudF9mb3JtYXQoIHBhbmVsICk7XHJcblx0XHRcdFx0XHR2YXIgZGF0YSA9IHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5yZWFkX3Jvdyggcm93LCBmbXQgKTtcclxuXHRcdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5pbnNlcnRfcm93X2FmdGVyKCBwYW5lbCwgcm93LCBkYXRhICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggYWN0aW9uID09PSAncmVtb3ZlJyApIHtcclxuXHRcdFx0XHRcdHZhciBsaXN0RWwgPSByb3cucGFyZW50Tm9kZTtcclxuXHRcdFx0XHRcdGxpc3RFbC5yZW1vdmVDaGlsZCggcm93ICk7XHJcblx0XHRcdFx0XHR3cGJjX2JmYl9maWVsZF9zdGFydHRpbWUucmVpbmRleF9yb3dzKCBsaXN0RWwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dmFyIGZtdDIgPSBnZXRfY3VycmVudF9mb3JtYXQoIHBhbmVsICk7XHJcblx0XHRcdFx0aWYgKCBmbXQyID09PSAnMjRoJyApIHsgVGltZS5hcHBseV9pbWFza19pbl9jb250YWluZXJfMjRoKCBwYW5lbCApOyB9XHJcblx0XHRcdFx0d3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLnN5bmNfc3RhdGVfZnJvbV9yb3dzKCBwYW5lbCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBSb3cgZWRpdHMgLT4gc3luY1xyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGZ1bmN0aW9uKCBldiApe1xyXG5cdFx0XHRcdHZhciByb3cgPSBldi50YXJnZXQgJiYgZXYudGFyZ2V0LmNsb3Nlc3QoICcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUgLndwYmNfYmZiX19vcHRpb25zX3JvdycgKTtcclxuXHRcdFx0XHRpZiAoICEgcm93ICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHR2YXIgcGFuZWwgPSByb3cuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZScgKTtcclxuXHRcdFx0XHR3cGJjX2JmYl9maWVsZF9zdGFydHRpbWUuc3luY19zdGF0ZV9mcm9tX3Jvd3MoIHBhbmVsICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ICl7XHJcblx0XHRcdFx0dmFyIHJvdyA9IGV2LnRhcmdldCAmJiBldi50YXJnZXQuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZSAud3BiY19iZmJfX29wdGlvbnNfcm93JyApO1xyXG5cdFx0XHRcdGlmICggISByb3cgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdGlmICggZXYudGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19vcHQtc2VsZWN0ZWQtY2hrJyApICkge1xyXG5cdFx0XHRcdFx0dmFyIHBhbmVsID0gcm93LmNsb3Nlc3QoICcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUnICk7XHJcblx0XHRcdFx0XHQvLyBTaW5nbGUtc2VsZWN0IOKGkiBvbmx5IG9uZSBkZWZhdWx0XHJcblx0XHRcdFx0XHRpZiAoIHBhbmVsICkge1xyXG5cdFx0XHRcdFx0XHRwYW5lbC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19vcHQtc2VsZWN0ZWQtY2hrJyApLmZvckVhY2goIGZ1bmN0aW9uKCBjaGsgKXtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIGNoayAhPT0gZXYudGFyZ2V0ICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y2hrLmNoZWNrZWQgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHRcdGNoay5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnICk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdGV2LnRhcmdldC5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dmFyIHBhbmVsMiA9IHJvdy5jbG9zZXN0KCAnLndwYmNfYmZiX19pbnNwZWN0b3Jfc3RhcnR0aW1lJyApO1xyXG5cdFx0XHRcdHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5zeW5jX3N0YXRlX2Zyb21fcm93cyggcGFuZWwyICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIEluaXQgb24gbG9hZCBmb3IgZXhpc3RpbmcgcGFuZWxzXHJcblx0XHRcdHZhciBpbml0ID0gZnVuY3Rpb24oKXtcclxuXHRcdFx0XHRkLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2luc3BlY3Rvcl9zdGFydHRpbWUnICkuZm9yRWFjaCggZnVuY3Rpb24oIHBhbmVsICl7XHJcblx0XHRcdFx0XHR1cGRhdGVfZ2VuX3Zpc2liaWxpdHkoIHBhbmVsICk7XHJcblx0XHRcdFx0XHR2YXIgZm10ID0gZ2V0X2N1cnJlbnRfZm9ybWF0KCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0aWYgKCBmbXQgPT09ICcyNGgnICkgeyBUaW1lLmFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGgoIHBhbmVsICk7IH1cclxuXHJcblx0XHRcdFx0XHRlbmZvcmNlX2xvY2tlZF9uYW1lKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0dmFyIHBoX2luaXQgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmpzLXBsYWNlaG9sZGVyJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBwaF9pbml0ICkgeyBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UoIHBoX2luaXQgKTsgfVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fTtcclxuXHRcdFx0KCBkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApID8gZC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIGluaXQgKSA6IGluaXQoKTtcclxuXHJcblx0XHRcdC8vIFJlLWFwcGx5IHdoZW4gSW5zcGVjdG9yIHJlLXJlbmRlcnMgYSBwYW5lbFxyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLCBmdW5jdGlvbiggZXYgKXtcclxuXHRcdFx0XHR2YXIgcGFuZWwgPSBldiAmJiBldi5kZXRhaWwgJiYgZXYuZGV0YWlsLnBhbmVsO1xyXG5cdFx0XHRcdGlmICggISBwYW5lbCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0dmFyIHN0UGFuZWwgPSBwYW5lbC5jbG9zZXN0XHJcblx0XHRcdFx0XHQ/ICggcGFuZWwubWF0Y2hlcyggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZScgKSA/IHBhbmVsIDogcGFuZWwuY2xvc2VzdCggJy53cGJjX2JmYl9faW5zcGVjdG9yX3N0YXJ0dGltZScgKSApXHJcblx0XHRcdFx0XHQ6IG51bGw7XHJcblx0XHRcdFx0aWYgKCAhIHN0UGFuZWwgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0XHR1cGRhdGVfZ2VuX3Zpc2liaWxpdHkoIHN0UGFuZWwgKTtcclxuXHRcdFx0XHR2YXIgZm10ID0gZ2V0X2N1cnJlbnRfZm9ybWF0KCBzdFBhbmVsICk7XHJcblx0XHRcdFx0aWYgKCBmbXQgPT09ICcyNGgnICkgeyBUaW1lLmFwcGx5X2ltYXNrX2luX2NvbnRhaW5lcl8yNGgoIHN0UGFuZWwgKTsgfVxyXG5cclxuXHRcdFx0XHRlbmZvcmNlX2xvY2tlZF9uYW1lKCBzdFBhbmVsICk7XHJcblx0XHRcdFx0dmFyIHBoX2luaXQgPSBzdFBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtcGxhY2Vob2xkZXInICk7XHJcblx0XHRcdFx0aWYgKCBwaF9pbml0ICkgeyBlbWl0X2luc3BlY3Rvcl9jaGFuZ2UoIHBoX2luaXQgKTsgfVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLSBSb3dzICYgc3RhdGUgLS0tLS0tLS1cclxuXHRcdHN0YXRpYyBidWlsZF9yb3dfaHRtbCggZGF0YSwgZm10LCBwYW5lbCApe1xyXG5cdFx0XHR2YXIgbGFiZWwgPSAoIGRhdGEgJiYgZGF0YS5sYWJlbCApIHx8ICcnO1xyXG5cdFx0XHR2YXIgdmFsdWUgPSAoIGRhdGEgJiYgZGF0YS52YWx1ZSApIHx8ICcnO1xyXG5cdFx0XHR2YXIgdWlkICAgPSAnd3BiY19pbnNfc3RfJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDEwICk7XHJcblx0XHRcdHZhciBzZWwgICA9ICEhKCBkYXRhICYmICggdHJ1ZSA9PT0gZGF0YS5zZWxlY3RlZCB8fCAndHJ1ZScgPT09IGRhdGEuc2VsZWN0ZWQgfHwgMSA9PT0gZGF0YS5zZWxlY3RlZCB8fCAnMScgPT09IGRhdGEuc2VsZWN0ZWQgKSApO1xyXG5cdFx0XHR2YXIgaTE4biAgPSB7XHJcblx0XHRcdFx0YWRkICAgICAgOiAoIHBhbmVsICYmIHBhbmVsLmRhdGFzZXQuaTE4bkFkZCApICAgICAgIHx8ICdBZGQgTmV3JyxcclxuXHRcdFx0XHRkdXBsaWNhdGU6ICggcGFuZWwgJiYgcGFuZWwuZGF0YXNldC5pMThuRHVwbGljYXRlICkgfHwgJ0R1cGxpY2F0ZScsXHJcblx0XHRcdFx0cmVtb3ZlICAgOiAoIHBhbmVsICYmIHBhbmVsLmRhdGFzZXQuaTE4blJlbW92ZSApICAgIHx8ICdSZW1vdmUnLFxyXG5cdFx0XHRcdGRlZiAgICAgIDogKCBwYW5lbCAmJiBwYW5lbC5kYXRhc2V0LmkxOG5EZWZhdWx0ICkgICB8fCAoIHcud3BiY19pMThuX2RlZmF1bHQgfHwgJ0RlZmF1bHQnICksXHJcblx0XHRcdFx0cmVvcmRlciAgOiAoIHBhbmVsICYmIHBhbmVsLmRhdGFzZXQuaTE4blJlb3JkZXIgKSAgIHx8ICdEcmFnIHRvIHJlb3JkZXInLFxyXG5cdFx0XHRcdHJvd2xhYmVsIDogKCBwYW5lbCAmJiBwYW5lbC5kYXRhc2V0LmkxOG5Sb3dsYWJlbCApICB8fCAnTGFiZWwgKGUuZy4gMTA6MDAgQU0pJ1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfaW5wdXRfaHRtbCA9ICggZm10ID09PSAnMjRoJyApXHJcblx0XHRcdFx0PyAoICc8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtdGltZSBqcy1zdC1tYXNrXCIgZGF0YS1tYXNrLWtpbmQ9XCIyNGhcIiBwbGFjZWhvbGRlcj1cIkhIOk1NXCIgdmFsdWU9XCInICsgVGltZS5lc2NfYXR0ciggdmFsdWUgKSArICdcIj4nIClcclxuXHRcdFx0XHQ6ICggJzxpbnB1dCB0eXBlPVwidGltZVwiIGNsYXNzPVwid3BiY19iZmJfX29wdC10aW1lIGpzLXN0LXRpbWVcIiBzdGVwPVwiMzAwXCIgdmFsdWU9XCInICsgVGltZS5lc2NfYXR0ciggdmFsdWUgKSArICdcIj4nICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gJycgK1xyXG5cdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiY19iZmJfX29wdGlvbnNfcm93XCIgZGF0YS1pbmRleD1cIjBcIj4nICtcclxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19kcmFnLWhhbmRsZVwiIHRpdGxlPVwiJyArIGkxOG4ucmVvcmRlciArICdcIj48c3BhbiBjbGFzcz1cIndwYmNfaWNuX2RyYWdfaW5kaWNhdG9yXCI+PC9zcGFuPjwvc3Bhbj4nICtcclxuXHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtbGFiZWxcIiBwbGFjZWhvbGRlcj1cIicgKyBpMThuLnJvd2xhYmVsICsgJ1wiIHZhbHVlPVwiJyArIFRpbWUuZXNjX2F0dHIoIGxhYmVsICkgKyAnXCI+JyArXHJcblx0XHRcdFx0XHR0aW1lX2lucHV0X2h0bWwgK1xyXG5cdFx0XHRcdFx0JzxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzPVwid3BiY19iZmJfX29wdC12YWx1ZVwiIHZhbHVlPVwiJyArIFRpbWUuZXNjX2F0dHIoIHZhbHVlICkgKyAnXCIgaGlkZGVuPicgK1xyXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LXNlbGVjdGVkXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwiaW5zcGVjdG9yX19jb250cm9sIHdwYmNfdWlfX3RvZ2dsZVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoayBpbnNwZWN0b3JfX2lucHV0XCIgaWQ9XCInICsgdWlkICsgJ1wiIHJvbGU9XCJzd2l0Y2hcIiAnICsgKCBzZWwgPyAnY2hlY2tlZCBhcmlhLWNoZWNrZWQ9XCJ0cnVlXCInIDogJ2FyaWEtY2hlY2tlZD1cImZhbHNlXCInICkgKyAnPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8bGFiZWwgY2xhc3M9XCJ3cGJjX3VpX190b2dnbGVfaWNvbl9yYWRpb1wiIGZvcj1cIicgKyB1aWQgKyAnXCI+PC9sYWJlbD4nICtcclxuXHRcdFx0XHRcdFx0XHQnPGxhYmVsIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlX2xhYmVsXCIgZm9yPVwiJyArIHVpZCArICdcIj4nICsgaTE4bi5kZWYgKyAnPC9sYWJlbD4nICtcclxuXHRcdFx0XHRcdFx0JzwvZGl2PicgK1xyXG5cdFx0XHRcdFx0JzwvZGl2PicgK1xyXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX3VpX2VsIHdwYmNfdWlfZWxfY29udGFpbmVyIHdwYmNfdWlfZWxfX2Ryb3Bkb3duXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgZGF0YS10b2dnbGU9XCJ3cGJjX2Ryb3Bkb3duXCIgYXJpYS1leHBhbmRlZD1cImZhbHNlXCIgY2xhc3M9XCJ1bF9kcm9wZG93bl9tZW51X3RvZ2dsZVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX21vcmVfdmVydFwiPjwvaT4nICtcclxuXHRcdFx0XHRcdFx0JzwvYT4nICtcclxuXHRcdFx0XHRcdFx0Jzx1bCBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVcIiByb2xlPVwibWVudVwiIHN0eWxlPVwicmlnaHQ6MHB4OyBsZWZ0OmF1dG87XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaT48YSBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uIHN0X2Ryb3Bkb3duX2FjdGlvblwiIGRhdGEtc3QtYWN0aW9uPVwiYWRkX2FmdGVyXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgKyBpMThuLmFkZCArICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2FkZF9jaXJjbGVcIj48L2k+PC9hPjwvbGk+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaT48YSBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uIHN0X2Ryb3Bkb3duX2FjdGlvblwiIGRhdGEtc3QtYWN0aW9uPVwiZHVwbGljYXRlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgKyBpMThuLmR1cGxpY2F0ZSArICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2NvbnRlbnRfY29weVwiPjwvaT48L2E+PC9saT4nICtcclxuXHRcdFx0XHRcdFx0XHQnPGxpIGNsYXNzPVwiZGl2aWRlclwiPjwvbGk+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaT48YSBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uIHN0X2Ryb3Bkb3duX2FjdGlvblwiIGRhdGEtc3QtYWN0aW9uPVwicmVtb3ZlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgKyBpMThuLnJlbW92ZSArICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RlbGV0ZV9vdXRsaW5lXCI+PC9pPjwvYT48L2xpPicgK1xyXG5cdFx0XHRcdFx0XHQnPC91bD4nICtcclxuXHRcdFx0XHRcdCc8L2Rpdj4nICtcclxuXHRcdFx0XHQnPC9kaXY+JztcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgYWRkX29wdGlvbl9yb3coIHBhbmVsICl7XHJcblx0XHRcdHZhciBsaXN0ID0gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fb3B0aW9uc19saXN0JyApO1xyXG5cdFx0XHRpZiAoICEgbGlzdCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdHZhciBmbXQgICA9IGdldF9jdXJyZW50X2Zvcm1hdCggcGFuZWwgKTtcclxuXHRcdFx0dmFyIG0gICAgID0gOSAqIDYwO1xyXG5cdFx0XHR2YXIgdmFsdWUgPSBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCggbSApO1xyXG5cdFx0XHR2YXIgbGFiZWwgPSAoIGZtdCA9PT0gJzI0aCcgKSA/IHZhbHVlIDogVGltZS5mb3JtYXRfbWludXRlc19hbXBtKCBtICk7XHJcblx0XHRcdHZhciBodG1sICA9IHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5idWlsZF9yb3dfaHRtbCggeyBsYWJlbDogbGFiZWwsIHZhbHVlOiB2YWx1ZSwgc2VsZWN0ZWQ6IGZhbHNlIH0sIGZtdCwgcGFuZWwgKTtcclxuXHJcblx0XHRcdHZhciB0bXAgPSBkLmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7IHRtcC5pbm5lckhUTUwgPSBodG1sO1xyXG5cdFx0XHR2YXIgcm93ID0gdG1wLmZpcnN0RWxlbWVudENoaWxkO1xyXG5cdFx0XHRsaXN0LmFwcGVuZENoaWxkKCByb3cgKTtcclxuXHRcdFx0d3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLnJlaW5kZXhfcm93cyggbGlzdCApO1xyXG5cdFx0XHRpZiAoIGZtdCA9PT0gJzI0aCcgKSB7XHJcblx0XHRcdFx0VGltZS5hcHBseV9pbWFza190b19pbnB1dCggcm93LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX29wdC10aW1lJyApICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgaW5zZXJ0X3Jvd19hZnRlciggcGFuZWwsIGFmdGVyX3JvdywgZGF0YSApe1xyXG5cdFx0XHR2YXIgbGlzdCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX29wdGlvbnNfbGlzdCcgKTtcclxuXHRcdFx0aWYgKCAhIGxpc3QgKSB7IHJldHVybjsgfVxyXG5cdFx0XHR2YXIgZm10ID0gZ2V0X2N1cnJlbnRfZm9ybWF0KCBwYW5lbCApO1xyXG5cdFx0XHRpZiAoICEgZGF0YSApIHtcclxuXHRcdFx0XHR2YXIgbSA9IDkgKiA2MDtcclxuXHRcdFx0XHR2YXIgdmFsdWUgPSBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCggbSApO1xyXG5cdFx0XHRcdGRhdGEgPSB7XHJcblx0XHRcdFx0XHRsYWJlbCAgIDogKCBmbXQgPT09ICcyNGgnICkgPyB2YWx1ZSA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfYW1wbSggbSApLFxyXG5cdFx0XHRcdFx0dmFsdWUgICA6IHZhbHVlLFxyXG5cdFx0XHRcdFx0c2VsZWN0ZWQ6IGZhbHNlXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0fVxyXG5cdFx0XHR2YXIgaHRtbCA9IHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5idWlsZF9yb3dfaHRtbCggZGF0YSwgZm10LCBwYW5lbCApO1xyXG5cdFx0XHR2YXIgdG1wICA9IGQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTsgdG1wLmlubmVySFRNTCA9IGh0bWw7XHJcblx0XHRcdHZhciByb3cgID0gdG1wLmZpcnN0RWxlbWVudENoaWxkO1xyXG5cdFx0XHRhZnRlcl9yb3cucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoIHJvdywgYWZ0ZXJfcm93Lm5leHRTaWJsaW5nICk7XHJcblx0XHRcdHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5yZWluZGV4X3Jvd3MoIGxpc3QgKTtcclxuXHRcdFx0aWYgKCBmbXQgPT09ICcyNGgnICkge1xyXG5cdFx0XHRcdFRpbWUuYXBwbHlfaW1hc2tfdG9faW5wdXQoIHJvdy5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19vcHQtdGltZScgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHJlYWRfcm93KCByb3csIGZtdCApe1xyXG5cdFx0XHR2YXIgbGFiZWxfZWwgPSByb3cucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fb3B0LWxhYmVsJyApO1xyXG5cdFx0XHR2YXIgdGltZV9lbCAgPSByb3cucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fb3B0LXRpbWUnICk7XHJcblxyXG5cdFx0XHR2YXIgcmF3X3ZhbCAgPSB0aW1lX2VsID8gU3RyaW5nKCB0aW1lX2VsLnZhbHVlIHx8ICcnICkgOiAnJztcclxuXHRcdFx0dmFyIG0gICAgICAgID0gVGltZS5wYXJzZV9oaG1tXzI0aCggcmF3X3ZhbCApO1xyXG5cdFx0XHR2YXIgdmFsdWUgICAgPSBpc05hTiggbSApID8gJycgOiBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCggbSApO1xyXG5cclxuXHRcdFx0dmFyIGxhYmVsICAgID0gbGFiZWxfZWwgPyBTdHJpbmcoIGxhYmVsX2VsLnZhbHVlIHx8ICcnICkgOiAnJztcclxuXHRcdFx0aWYgKCAhIGxhYmVsICkge1xyXG5cdFx0XHRcdGxhYmVsID0gKCBpc05hTiggbSApICkgPyAnJyA6ICggKCBmbXQgPT09ICcyNGgnICkgPyB2YWx1ZSA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfYW1wbSggbSApICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBzZWwgICA9ICEhKCAoIHJvdy5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19vcHQtc2VsZWN0ZWQtY2hrJyApIHx8IHt9ICkuY2hlY2tlZCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHsgbGFiZWw6IGxhYmVsLCB2YWx1ZTogdmFsdWUsIHNlbGVjdGVkOiBzZWwgfTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgc3luY19zdGF0ZV9mcm9tX3Jvd3MoIHBhbmVsICl7XHJcblx0XHRcdGlmICggISBwYW5lbCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdHZhciBsaXN0ICA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX29wdGlvbnNfbGlzdCcgKTtcclxuXHRcdFx0dmFyIHN0YXRlID0gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fb3B0aW9uc19zdGF0ZScgKTtcclxuXHRcdFx0aWYgKCAhIGxpc3QgfHwgISBzdGF0ZSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgc2VlblNlbGVjdGVkID0gZmFsc2U7XHJcblx0XHRcdHZhciBmbXQgPSBnZXRfY3VycmVudF9mb3JtYXQoIHBhbmVsICk7XHJcblx0XHRcdHZhciBvdXQgPSBbXTtcclxuXHJcblx0XHRcdGxpc3QucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fb3B0aW9uc19yb3cnICkuZm9yRWFjaCggZnVuY3Rpb24gKCByb3cgKSB7XHJcblx0XHRcdFx0dmFyIG9iaiA9IHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZS5yZWFkX3Jvdyggcm93LCBmbXQgKTtcclxuXHRcdFx0XHQvLyBFbmZvcmNlIHNpbmdsZSBkZWZhdWx0XHJcblx0XHRcdFx0aWYgKCBvYmouc2VsZWN0ZWQgKSB7XHJcblx0XHRcdFx0XHRpZiAoICEgc2VlblNlbGVjdGVkICkge1xyXG5cdFx0XHRcdFx0XHRzZWVuU2VsZWN0ZWQgPSB0cnVlO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0b2JqLnNlbGVjdGVkID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdHZhciBjaGsgPSByb3cucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoaycgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCBjaGsgKSB7IGNoay5jaGVja2VkID0gZmFsc2U7IGNoay5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnICk7IH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0b3V0LnB1c2goIG9iaiApO1xyXG5cdFx0XHRcdHZhciBodiA9IHJvdy5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19vcHQtdmFsdWUnICk7XHJcblx0XHRcdFx0aWYgKCBodiApIHsgaHYudmFsdWUgPSBvYmoudmFsdWUgfHwgJyc7IH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dHJ5IHsgc3RhdGUudmFsdWUgPSBKU09OLnN0cmluZ2lmeSggb3V0ICk7IH0gY2F0Y2goZSl7IHN0YXRlLnZhbHVlID0gJ1tdJzsgfVxyXG5cdFx0XHRlbWl0X2luc3BlY3Rvcl9jaGFuZ2UoIHN0YXRlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHJlcGxhY2Vfb3B0aW9uc19pbl9wYW5lbCggcGFuZWwsIGl0ZW1zICl7XHJcblx0XHRcdHZhciBsaXN0ICA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX29wdGlvbnNfbGlzdCcgKTtcclxuXHRcdFx0dmFyIHN0YXRlID0gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fb3B0aW9uc19zdGF0ZScgKTtcclxuXHRcdFx0aWYgKCAhIGxpc3QgfHwgISBzdGF0ZSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgZm10ID0gZ2V0X2N1cnJlbnRfZm9ybWF0KCBwYW5lbCApO1xyXG5cdFx0XHRsaXN0LmlubmVySFRNTCA9ICcnO1xyXG5cdFx0XHQoIGl0ZW1zIHx8IFtdICkuZm9yRWFjaCggZnVuY3Rpb24oIG9wdCApe1xyXG5cdFx0XHRcdHZhciBodG1sID0gd3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLmJ1aWxkX3Jvd19odG1sKCBvcHQsIGZtdCwgcGFuZWwgKTtcclxuXHRcdFx0XHR2YXIgdG1wICA9IGQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTsgdG1wLmlubmVySFRNTCA9IGh0bWw7XHJcblx0XHRcdFx0bGlzdC5hcHBlbmRDaGlsZCggdG1wLmZpcnN0RWxlbWVudENoaWxkICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0d3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLnJlaW5kZXhfcm93cyggbGlzdCApO1xyXG5cdFx0XHRpZiAoIGZtdCA9PT0gJzI0aCcgKSB7IFRpbWUuYXBwbHlfaW1hc2tfaW5fY29udGFpbmVyXzI0aCggcGFuZWwgKTsgfVxyXG5cclxuXHRcdFx0dHJ5IHsgc3RhdGUudmFsdWUgPSBKU09OLnN0cmluZ2lmeSggaXRlbXMgfHwgW10gKTsgfSBjYXRjaChlKXsgc3RhdGUudmFsdWUgPSAnW10nOyB9XHJcblx0XHRcdGVtaXRfaW5zcGVjdG9yX2NoYW5nZSggc3RhdGUgKTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgcmVpbmRleF9yb3dzKCBsaXN0ICl7XHJcblx0XHRcdGlmICggISBsaXN0ICkgeyByZXR1cm47IH1cclxuXHRcdFx0dmFyIGkgPSAwO1xyXG5cdFx0XHRsaXN0LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX29wdGlvbnNfcm93JyApLmZvckVhY2goIGZ1bmN0aW9uKCByb3cgKXtcclxuXHRcdFx0XHRyb3cuc2V0QXR0cmlidXRlKCAnZGF0YS1pbmRleCcsIFN0cmluZyggaSsrICkgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQnVpbGQgYSBsaXN0IG9mIHRpbWUgcG9pbnRzIGJldHdlZW4gc3RhcnRfbSBhbmQgZW5kX20gKGluY2x1c2l2ZSksIHdpdGggc3RlcCBtaW51dGVzLlxyXG5cdFx0ICogTGFiZWxzIGZvbGxvdyBmbXQ7IHZhbHVlcyBhbHdheXMgXCJISDpNTVwiICgyNGgpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydF9tICAgTWludXRlcyBzaW5jZSAwMDowMC5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBlbmRfbSAgICAgTWludXRlcyBzaW5jZSAwMDowMC5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBzdGVwX21pbnMgU3RlcCAobWludXRlcyksIG1pbiAxLlxyXG5cdFx0ICogQHBhcmFtIHsnMjRoJ3wnYW1wbSd9IGZtdCBMYWJlbCBmb3JtYXQuXHJcblx0XHQgKiBAcmV0dXJucyB7QXJyYXk8e2xhYmVsOnN0cmluZyx2YWx1ZTpzdHJpbmcsc2VsZWN0ZWQ6Ym9vbGVhbn0+fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYnVpbGRfdGltZXNfbGlzdCggc3RhcnRfbSwgZW5kX20sIHN0ZXBfbWlucywgZm10ICl7XHJcblx0XHRcdHZhciBvdXQgPSBbXTtcclxuXHRcdFx0aWYgKCBpc05hTiggc3RhcnRfbSApIHx8IGlzTmFOKCBlbmRfbSApICkgeyByZXR1cm4gb3V0OyB9XHJcblx0XHRcdHZhciBzdGVwID0gTWF0aC5tYXgoIDEsIHN0ZXBfbWlucyB8IDAgKTtcclxuXHRcdFx0dmFyIGRpciAgPSAoIGVuZF9tID49IHN0YXJ0X20gKSA/IDEgOiAtMTsgLy8gYWxsb3cgcmV2ZXJzZSBvcmRlclxyXG5cdFx0XHRpZiAoIGRpciA9PT0gMSApIHtcclxuXHRcdFx0XHRmb3IgKCB2YXIgbSA9IHN0YXJ0X207IG0gPD0gZW5kX207IG0gKz0gc3RlcCApIHtcclxuXHRcdFx0XHRcdHZhciB2YWwgPSBUaW1lLmZvcm1hdF9taW51dGVzXzI0aCggbSApO1xyXG5cdFx0XHRcdFx0dmFyIGxibCA9ICggZm10ID09PSAnMjRoJyApID8gdmFsIDogVGltZS5mb3JtYXRfbWludXRlc19hbXBtKCBtICk7XHJcblx0XHRcdFx0XHRvdXQucHVzaCggeyBsYWJlbDogbGJsLCB2YWx1ZTogdmFsLCBzZWxlY3RlZDogZmFsc2UgfSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRmb3IgKCB2YXIgbTIgPSBzdGFydF9tOyBtMiA+PSBlbmRfbTsgbTIgLT0gc3RlcCApIHtcclxuXHRcdFx0XHRcdHZhciB2YWwyID0gVGltZS5mb3JtYXRfbWludXRlc18yNGgoIG0yICk7XHJcblx0XHRcdFx0XHR2YXIgbGJsMiA9ICggZm10ID09PSAnMjRoJyApID8gdmFsMiA6IFRpbWUuZm9ybWF0X21pbnV0ZXNfYW1wbSggbTIgKTtcclxuXHRcdFx0XHRcdG91dC5wdXNoKCB7IGxhYmVsOiBsYmwyLCB2YWx1ZTogdmFsMiwgc2VsZWN0ZWQ6IGZhbHNlIH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIG91dDtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHR0cnkgeyBSZWdpc3RyeS5yZWdpc3RlciggJ3N0YXJ0dGltZScsIHdwYmNfYmZiX2ZpZWxkX3N0YXJ0dGltZSApOyB9XHJcblx0Y2F0Y2ggKCBlICkgeyBpZiAoIHcuX3dwYmMgJiYgdy5fd3BiYy5kZXYgJiYgdy5fd3BiYy5kZXYuZXJyb3IgKSB7IHcuX3dwYmMuZGV2LmVycm9yKCAnd3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLnJlZ2lzdGVyJywgZSApOyB9IH1cclxuXHJcblx0d3BiY19iZmJfZmllbGRfc3RhcnR0aW1lLmJpbmRfaW5zcGVjdG9yX2V2ZW50c19vbmNlKCk7XHJcblx0dy5XUEJDX0JGQl9GaWVsZF9TdGFydFRpbWUgPSB3cGJjX2JmYl9maWVsZF9zdGFydHRpbWU7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRm9ybVwiIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSlcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIEJvb2tpbmcgRm9ybSBleHBvcnRlciBjYWxsYmFjayBmb3IgXCJzdGFydHRpbWVcIi5cclxuXHQgKlxyXG5cdCAqIE1pcnJvcnMgdGhlIGxlZ2FjeSBiZWhhdmlvcjpcclxuXHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLmVtaXRfdGltZV9zZWxlY3QoIG5hbWUsIGZpZWxkLCByZXFfbWFyaywgaWRfb3B0LCBjbHNfb3B0cywgZW1pdF9sYWJlbF90aGVuICk7XHJcblx0ICpcclxuXHQgKiBTbyB0aGUgZmluYWwgc2hvcnRjb2RlIGJvZHkgYW5kIGxhYmVsIGhhbmRsaW5nIGFyZSBpZGVudGljYWwgdG8gdGhlIG9sZFxyXG5cdCAqIHN3aXRjaC9jYXNlIHBhdGggaW4gYnVpbGRlci1leHBvcnRlci5qcywganVzdCBtb3ZlZCBpbnRvIHRoaXMgcGFjay5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9zdGFydHRpbWVfYm9va2luZ19mb3JtX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdHZhciBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ3N0YXJ0dGltZScgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIFMgICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCB7fTtcclxuXHRcdHZhciBlc2NfaHRtbCA9IFMuZXNjYXBlX2h0bWwgfHwgZnVuY3Rpb24oIHYgKXsgcmV0dXJuIFN0cmluZyggdiApOyB9O1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHR5cGUge1dQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2t9XHJcblx0XHQgKi9cclxuXHRcdHZhciBleHBvcnRlcl9jYWxsYmFjayA9IGZ1bmN0aW9uKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cdFx0XHRleHRyYXMgPSBleHRyYXMgfHwge307XHJcblxyXG5cdFx0XHR2YXIgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHRcdFx0dmFyIGN0eCA9IGV4dHJhcy5jdHg7XHJcblxyXG5cdFx0XHQvLyBTaGFyZWQgbGFiZWwgd3JhcHBlcjogcHJlZmVyIGdsb2JhbCBoZWxwZXI7IGZhbGwgYmFjayB0byBsb2NhbCBiZWhhdmlvci5cclxuXHRcdFx0dmFyIGVtaXRfbGFiZWxfdGhlbiA9IGZ1bmN0aW9uKCBib2R5ICkge1xyXG5cdFx0XHRcdC8vIFByZWZlcnJlZCBwYXRoOiBjZW50cmFsaXplZCBoZWxwZXIgaW4gYnVpbGRlci1leHBvcnRlci5qc1xyXG5cdFx0XHRcdGlmICggRXhwICYmIHR5cGVvZiBFeHAuZW1pdF9sYWJlbF90aGVuID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0RXhwLmVtaXRfbGFiZWxfdGhlbiggZmllbGQsIGVtaXQsIGJvZHksIGNmZyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdC8vIFJlcXVpcmVkIG1hcmtlciAoc2FtZSBzZW1hbnRpY3MgYXMgb3RoZXIgdGV4dC1saWtlIGZpZWxkcykuXHJcblx0XHRcdHZhciBpc19yZXEgICA9IEV4cC5pc19yZXF1aXJlZCggZmllbGQgKTtcclxuXHRcdFx0dmFyIHJlcV9tYXJrID0gaXNfcmVxID8gJyonIDogJyc7XHJcblxyXG5cdFx0XHQvLyBOYW1lIC8gaWQgLyBjbGFzc2VzIGZyb20gc2hhcmVkIGhlbHBlcnMgc28gdGhleSBzdGF5IGluIHN5bmMuXHJcblx0XHRcdHZhciBuYW1lICAgICA9IEV4cC5jb21wdXRlX25hbWUoICdzdGFydHRpbWUnLCBmaWVsZCApO1xyXG5cdFx0XHR2YXIgaWRfb3B0ICAgPSBFeHAuaWRfb3B0aW9uKCBmaWVsZCwgY3R4ICk7XHJcblx0XHRcdHZhciBjbHNfb3B0cyA9IEV4cC5jbGFzc19vcHRpb25zKCBmaWVsZCApO1xyXG5cclxuXHRcdFx0Ly8gUHJlZmVyIHRoZSBkZWRpY2F0ZWQgdGltZSBoZWxwZXIgdG8ga2VlcCBleGFjdCBsZWdhY3kgc2hvcnRjb2RlIHNoYXBlLlxyXG5cdFx0XHRpZiAoIHR5cGVvZiBFeHAuZW1pdF90aW1lX3NlbGVjdCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRFeHAuZW1pdF90aW1lX3NlbGVjdCggbmFtZSwgZmllbGQsIHJlcV9tYXJrLCBpZF9vcHQsIGNsc19vcHRzLCBlbWl0X2xhYmVsX3RoZW4gKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblxyXG5cdFx0RXhwLnJlZ2lzdGVyKCAnc3RhcnR0aW1lJywgZXhwb3J0ZXJfY2FsbGJhY2sgKTtcclxuXHR9XHJcblxyXG5cdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHJlZ2lzdGVyX3N0YXJ0dGltZV9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2UgaWYgKCB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICkge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfc3RhcnR0aW1lX2Jvb2tpbmdfZm9ybV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIERhdGFcIiAoQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyoqXHJcblx0ICogQm9va2luZyBEYXRhIGV4cG9ydGVyIGNhbGxiYWNrIGZvciBcInN0YXJ0dGltZVwiLlxyXG5cdCAqXHJcblx0ICogRGVmYXVsdCBiZWhhdmlvcjpcclxuXHQgKiAgIDxiPkxhYmVsPC9iPjogPGY+W3N0YXJ0dGltZV08L2Y+PGJyPlxyXG5cdCAqXHJcblx0ICogVGhlIGV4cG9ydGVkIHRva2VuIG5hbWUgaXMga2VwdCBmdWxseSBpbiBzeW5jIHdpdGggdGhlIEJvb2tpbmcgRm9ybSBleHBvcnRlclxyXG5cdCAqIHZpYSBFeHAuY29tcHV0ZV9uYW1lKCdzdGFydHRpbWUnLCBmaWVsZCkuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfc3RhcnR0aW1lX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcclxuXHJcblx0XHR2YXIgQyA9IHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEMgfHwgdHlwZW9mIEMucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0aWYgKCB0eXBlb2YgQy5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgQy5oYXNfZXhwb3J0ZXIoICdzdGFydHRpbWUnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdEMucmVnaXN0ZXIoICdzdGFydHRpbWUnLCBmdW5jdGlvbiggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cdFx0XHR2YXIgY2ZnID0gZXh0cmFzLmNmZyB8fCB7fTtcclxuXHJcblx0XHRcdHZhciBFeHAgPSB3LldQQkNfQkZCX0V4cG9ydGVyO1xyXG5cdFx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAuY29tcHV0ZV9uYW1lICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdC8vIEtlZXAgZXhwb3J0ZWQgbmFtZSBpZGVudGljYWwgdG8gdGhlIEJvb2tpbmcgRm9ybSBleHBvcnRlci5cclxuXHRcdFx0dmFyIG5hbWUgPSBFeHAuY29tcHV0ZV9uYW1lKCAnc3RhcnR0aW1lJywgZmllbGQgKTtcclxuXHRcdFx0aWYgKCAhIG5hbWUgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0dmFyIHJhd19sYWJlbCA9ICggdHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyApID8gZmllbGQubGFiZWwgOiAnJztcclxuXHRcdFx0dmFyIGxhYmVsICAgICA9IHJhd19sYWJlbC50cmltKCkgfHwgbmFtZTtcclxuXHJcblx0XHRcdC8vIFNoYXJlZCBoZWxwZXI6IDxiPkxhYmVsPC9iPjogPGY+W25hbWVdPC9mPjxicj5cclxuXHRcdFx0Qy5lbWl0X2xpbmVfYm9sZF9maWVsZCggZW1pdCwgbGFiZWwsIG5hbWUsIGNmZyApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRyZWdpc3Rlcl9zdGFydHRpbWVfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XHJcblx0fSBlbHNlIGlmICggdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpjb250ZW50LWV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfc3RhcnR0aW1lX2Jvb2tpbmdfZGF0YV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9XHJcblxyXG59KSggd2luZG93LCBkb2N1bWVudCApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaLElBQUlDLElBQUksR0FBT0YsQ0FBQyxDQUFDRyxhQUFhLElBQUksQ0FBQyxDQUFDO0VBQ3BDLElBQUlDLFFBQVEsR0FBR0YsSUFBSSxDQUFDRyxnQ0FBZ0M7RUFDcEQsSUFBSUMsSUFBSSxHQUFPSixJQUFJLENBQUNLLG1CQUFtQixJQUFJLElBQUk7RUFDL0MsSUFBSUMsSUFBSSxHQUFRTixJQUFJLElBQUlBLElBQUksQ0FBQ00sSUFBSSxHQUFJTixJQUFJLENBQUNNLElBQUksR0FBRyxJQUFJO0VBRXJELElBQUssQ0FBQ0osUUFBUSxJQUFJLE9BQU9BLFFBQVEsQ0FBQ0ssUUFBUSxLQUFLLFVBQVUsSUFBSSxDQUFDSCxJQUFJLElBQUksQ0FBQ0UsSUFBSSxFQUFHO0lBQzdFLElBQUtSLENBQUMsQ0FBQ1UsS0FBSyxJQUFJVixDQUFDLENBQUNVLEtBQUssQ0FBQ0MsR0FBRyxJQUFJWCxDQUFDLENBQUNVLEtBQUssQ0FBQ0MsR0FBRyxDQUFDQyxLQUFLLEVBQUc7TUFDbERaLENBQUMsQ0FBQ1UsS0FB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
