"use strict";

/**
 * WPBC BFB: Field Renderer for "checkbox" (WP-template–driven Reference, no fallback)
 * =========================================================================
 * - Uses wp.template('...') for preview
 * - Inspector UI is produced by wp.template('...')
 * - Extends Select_Base for shared options editor wiring
 *
 * Contracts:
 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register('checkbox', Class)
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
 *
 * File:  ../includes/page-form-builder/field-packs/checkbox/_out/field-checkbox-wptpl.js
 *
 * @since    11.0.0
 * @modified 2025-09-13 11:40
 * @version  1.0.0
 */
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Select_Base = Core.WPBC_BFB_Select_Base;
  // Polyfill inline helpers on the base (static) so other packs can call them safely
  if (!Select_Base.apply_inline_toggle_to_css) {
    Select_Base.apply_inline_toggle_to_css = function () {/* no-op; Checkbox overrides */
    };
  }
  if (!Select_Base.sync_inline_toggle_from_css) {
    Select_Base.sync_inline_toggle_from_css = function () {/* no-op; Checkbox overrides */
    };
  }
  if (!Registry?.register || !Select_Base) {
    w._wpbc?.dev?.error?.('WPBC_BFB_Field_Checkbox', 'Registry or Select_Base missing');
    return;
  }
  class WPBC_BFB_Field_Checkbox extends Select_Base {
    static template_id = 'wpbc-bfb-field-checkbox';
    static option_row_template_id = 'wpbc-bfb-inspector-checkbox-option-row';
    static kind = 'checkbox';
    static ui = Object.assign({}, Select_Base.ui, {
      cssclass_input: '.inspector__input[data-inspector-key="cssclass"]',
      inline_toggle: '.inspector__checkbox.inspector__input[data-inspector-key="layout_inline"]'
    });

    // ---- Inline layout helpers used by wire_once_checkbox ----
    static get_cssclass_input(panel) {
      return panel ? panel.querySelector(this.ui.cssclass_input) : null;
    }
    static get_inline_toggle(panel) {
      return panel ? panel.querySelector(this.ui.inline_toggle) : null;
    }
    static has_inline_class(s) {
      s = String(s || '').trim();
      return s ? (' ' + s.replace(/\s+/g, ' ') + ' ').indexOf(' group_inline ') !== -1 : false;
    }
    static add_inline_class(s) {
      const t = String(s || '').trim().split(/\s+/).filter(Boolean);
      if (!t.includes('group_inline')) t.push('group_inline');
      return t.join(' ').trim();
    }
    static remove_inline_class(s) {
      const t = String(s || '').trim().split(/\s+/).filter(Boolean);
      return t.filter(x => x !== 'group_inline').join(' ').trim();
    }
    static sync_inline_toggle_from_css(panel) {
      const inp = this.get_cssclass_input(panel),
        tog = this.get_inline_toggle(panel);
      if (!inp || !tog) return;
      const has = this.has_inline_class(inp.value);
      tog.checked = !!has;
      tog.setAttribute('aria-checked', has ? 'true' : 'false');
    }
    static apply_inline_toggle_to_css(panel, on) {
      const inp = this.get_cssclass_input(panel),
        tog = this.get_inline_toggle(panel);
      if (!inp || !tog) return;
      const prev = String(inp.value || '');
      const next = on ? this.add_inline_class(prev) : this.remove_inline_class(prev);
      if (next !== prev) {
        inp.value = next;
        try {
          inp.dispatchEvent(new Event('input', {
            bubbles: true
          }));
          inp.dispatchEvent(new Event('change', {
            bubbles: true
          }));
        } catch (_) {}
        try {
          const Core = window.WPBC_BFB_Core || {};
          const field = panel.__selectbase_field || document.querySelector('.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected');
          if (field) {
            field.dataset.cssclass = next;
            field.dispatchEvent(new CustomEvent('wpbc_bfb_field_data_changed', {
              bubbles: true,
              detail: {
                key: 'cssclass',
                value: next
              }
            }));
            Core.Structure?.update_field_prop?.(field, 'cssclass', next);
          }
        } catch (_) {}
      }
      tog.setAttribute('aria-checked', on ? 'true' : 'false');
    }

    /* --------------------------------------------------------------------------------------------------------- */

    static get_defaults() {
      return {
        type: 'checkbox',
        label: 'Checkbox',
        name: '',
        html_id: '',
        required: false,
        cssclass: '',
        help: '',
        default_value: '',
        value_differs: true,
        multiple: true,
        options: [{
          label: 'Option 1',
          value: 'Option 1',
          selected: false
        }, {
          label: 'Option 2',
          value: 'Option 2',
          selected: false
        }, {
          label: 'Option 3',
          value: 'Option 3',
          selected: false
        }],
        min_width: '240px'
      };
    }

    /**
     * Ensure "multiple" is set and persisted at the moment of drop.
     * This prevents the first Inspector hydration from unchecking the hidden toggle.
     */
    static on_field_drop(data, el, meta) {
      try {
        super.on_field_drop?.(data, el, meta);
      } catch (_) {}
      if (meta?.context !== 'drop') {
        return;
      }

      // If not explicitly set, force it ON and persist to builder state.
      if (!Object.prototype.hasOwnProperty.call(data, 'multiple')) {
        data.multiple = true;
      }
      try {
        // Mirror to the canvas element & model so future hydrations read TRUE.
        el.dataset.multiple = '1';
        el.dispatchEvent(new CustomEvent('wpbc_bfb_field_data_changed', {
          bubbles: true,
          detail: {
            key: 'multiple',
            value: true
          }
        }));
        WPBC_BFB_Core.Structure?.update_field_prop?.(el, 'multiple', true);
      } catch (_) {}
    }

    /* =========================
     * NEW: checkbox-only helpers
     * ========================= */

    /** Ensure we act only for a Checkbox inspector panel. */
    static is_checkbox_panel(panel) {
      const f = panel?.__selectbase_field || document.querySelector('.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected');
      const t = (f?.dataset?.type || f?.getAttribute?.('data-type') || '').toLowerCase();
      return t === 'checkbox';
    }

    /** Convert any fallback radio icons → checkbox icons inside the options list. */
    static fix_option_toggle_icons(panel) {
      if (!panel || !this.is_checkbox_panel(panel)) {
        return;
      }
      const list = panel.querySelector(this.ui.list);
      if (!list) {
        return;
      }
      const wrong = list.querySelectorAll('.wpbc_ui__toggle_icon_radio');
      for (var i = 0; i < wrong.length; i++) {
        wrong[i].classList.remove('wpbc_ui__toggle_icon_radio');
        wrong[i].classList.add('wpbc_ui__toggle_icon_checkbox');
      }
    }

    /**
     * Force “multiple mode” for the Select_Base logic (so defaults are NOT exclusive).
     * We add a hidden, checked control that Select_Base checks via .js-opt-multiple[data-inspector-key="multiple"].
     */
    static ensure_multiple_mode_marker(panel) {
      if (!panel || !this.is_checkbox_panel(panel)) {
        return;
      }
      let mult = panel.querySelector('.js-opt-multiple[data-inspector-key="multiple"]');
      if (!mult) {
        mult = document.createElement('input');
        mult.type = 'checkbox';
        mult.className = 'js-opt-multiple inspector__input';
        mult.setAttribute('data-inspector-key', 'multiple');
        mult.checked = true;
        mult.hidden = true;
        // hide from layout & a11y tree, but keep it discoverable by querySelector
        mult.style.display = 'none';
        mult.setAttribute('aria-hidden', 'true');
        mult.setAttribute('tabindex', '-1');
        const group = panel.querySelector('.wpbc_bfb__inspector__group[data-group="options"] .group__fields') || panel.querySelector('.wpbc_bfb__inspector__body') || panel;
        group.appendChild(mult);
      } else if (!mult.checked) {
        mult.checked = true;
      }
    }

    /**
     * Observe the options list so any rows appended by the parent (fallback path)
     * are auto-corrected to use checkbox icons.
     */
    static observe_options_list(panel) {
      if (!panel || panel.__wpbc_cb_obs) {
        return;
      }
      const list = panel.querySelector(this.ui.list);
      if (!list) {
        return;
      }
      const obs = new MutationObserver(mutations => {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].type !== 'childList' || !mutations[i].addedNodes?.length) {
            continue;
          }
          // Any new rows → fix icons immediately.
          this.fix_option_toggle_icons(panel);
        }
      });
      try {
        obs.observe(list, {
          childList: true
        });
        panel.__wpbc_cb_obs = obs;
      } catch (_) {}
    }
    static wire_once_checkbox() {
      if (this.__checkbox_wired) {
        return;
      }
      this.__checkbox_wired = true;
      const on_ready_or_render = ev => {
        const panel = ev?.detail?.panel;
        if (!panel) {
          return;
        }

        // Let Select_Base wire itself.
        this.bootstrap_panel(panel);

        // 1) Multiple defaults ON for Checkbox (prevents exclusivity).
        this.ensure_multiple_mode_marker(panel);

        // 2) Correct any existing fallback icons (initial render).
        this.fix_option_toggle_icons(panel);

        // 3) Keep fixing icons for any newly added/duplicated rows.
        this.observe_options_list(panel);

        // Reflect cssclass → inline toggle (existing behavior).
        this.sync_inline_toggle_from_css(panel);
      };
      document.addEventListener('wpbc_bfb_inspector_ready', on_ready_or_render);
      document.addEventListener('wpbc_bfb_inspector_render', on_ready_or_render);
      const root = document.getElementById('wpbc_bfb__inspector');
      if (!root) {
        return;
      }
      const get_panel = t => t?.closest?.('.wpbc_bfb__inspector__body') || root.querySelector('.wpbc_bfb__inspector__body') || null;

      // Keep multiple-mode and icons correct AFTER parent handles clicks (add/duplicate)
      // NOTE: parent stops propagation in its click handler; we schedule our fix in CAPTURE,
      // then run it async (setTimeout 0) so DOM is already updated.
      root.addEventListener('click', e => {
        const panel = get_panel(e.target);
        if (!panel || !this.is_checkbox_panel(panel)) {
          return;
        }
        const is_add_btn = e.target.closest?.(this.ui.add_btn);
        const is_menu_action = e.target.closest?.(this.ui.menu_action);
        if (is_add_btn || is_menu_action) {
          setTimeout(() => {
            this.ensure_multiple_mode_marker(panel); // ensures non-exclusive
            this.fix_option_toggle_icons(panel); // fixes icon class
          }, 0);
        }
      }, true); // CAPTURE phase

      // Inline layout toggle & manual cssclass edits (unchanged)
      root.addEventListener('change', e => {
        const panel = get_panel(e.target);
        if (!panel || !this.is_checkbox_panel(panel)) {
          return;
        }
        if (e.target.matches?.(this.ui.inline_toggle)) {
          e.target.setAttribute('aria-checked', e.target.checked ? 'true' : 'false');
          this.apply_inline_toggle_to_css(panel, !!e.target.checked);
        }
      }, true);
      root.addEventListener('input', e => {
        const panel = get_panel(e.target);
        if (!panel || !this.is_checkbox_panel(panel)) {
          return;
        }
        if (e.target.matches?.(this.ui.cssclass_input)) {
          this.sync_inline_toggle_from_css(panel);
        }
      }, true);

      // Optional: bootstrap immediately if inspector is already on screen
      setTimeout(() => {
        const panel = document.querySelector('#wpbc_bfb__inspector .wpbc_bfb__inspector__body');
        if (panel && this.is_checkbox_panel(panel)) {
          this.bootstrap_panel(panel);
          this.ensure_multiple_mode_marker(panel);
          this.fix_option_toggle_icons(panel);
          this.observe_options_list(panel);
          this.sync_inline_toggle_from_css(panel);
        }
      }, 0);
    }
  }
  try {
    Registry.register('checkbox', WPBC_BFB_Field_Checkbox);
  } catch (e) {
    w._wpbc?.dev?.error?.('WPBC_BFB_Field_Checkbox.register', e);
  }
  w.WPBC_BFB_Field_Checkbox = WPBC_BFB_Field_Checkbox;
  try {
    WPBC_BFB_Field_Checkbox.wire_once_checkbox();
  } catch (_) {}

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback (Advanced Form shortcode) for "checkbox".
   *
   * This callback is registered per field type via:
   *   WPBC_BFB_Exporter.register( 'checkbox', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
   *     → callback( field, emit, { io, cfg, once, ctx, core } );
   *
   * @callback WPBC_BFB_ExporterCallback
   * @param {Object}  field
   *   Normalized field data coming from the Builder structure.
   *   - field.type          {string}   Field type, here "checkbox".
   *   - field.label         {string}   Visible label in the form (may be empty).
   *   - field.name          {string}   Name as stored on the canvas (already validated).
   *   - field.html_id       {string}   Optional HTML id / user-visible id.
   *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
   *   - field.options       {Array}    Options for checkbox group (label/value/selected).
   *   - field.option_label  {string}   Optional single-checkbox label (used when no options[]).
   *   - field.placeholder   {string}   Optional placeholder (used as fallback label).
   *   - ...                 (Any other pack-specific props are also present.)
   *
   * @param {function(string):void} emit
   *   Emits one line/fragment into the export buffer.
   *
   * @param {Object} [extras]
   *   Extra context passed by the core exporter.
   */
  function register_checkbox_booking_form_exporter() {
    const Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('checkbox')) {
      return;
    }
    const S = Core.WPBC_BFB_Sanitize || w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize || {};
    const esc_html = S.escape_html || (v => String(v));
    const esc_sc = S.escape_for_shortcode || (v => String(v));

    /**
     * @type {WPBC_BFB_ExporterCallback}
     */
    Exp.register('checkbox', (field, emit, extras = {}) => {
      const cfg = extras.cfg || {};
      const ctx = extras.ctx;
      const addLabels = cfg.addLabels !== false;

      // Required marker (same semantics as other text-like fields).
      const is_req = Exp.is_required(field);
      const req_mark = is_req ? '*' : '';

      // Name / id / classes come from shared helpers so they stay in sync with other packs.
      const name = Exp.compute_name('checkbox', field);
      const id_opt = Exp.id_option(field, ctx);
      const cls_opts = Exp.class_options(field);

      // Options + default (same helpers as legacy path).
      const tokens = Exp.option_tokens(field);
      const def = Exp.default_option_suffix(field, tokens);

      // Always add bare `use_label_element` (no value/quotes) for checkbox shortcodes.
      const use_label_element_token = ' use_label_element';
      const raw_label = field && typeof field.label === 'string' ? field.label : '';
      const label = raw_label.trim();
      let body;
      if (!tokens.trim()) {
        // Single checkbox (no options array) — keep label in quotes at the end.
        const single_label = field.option_label || field.placeholder || label || 'I agree';

        // ORDER: name id cls  use_label_element  "label".
        body = `[checkbox${req_mark} ${name}${id_opt}${cls_opts}${use_label_element_token} "${esc_sc(single_label)}"]`;
      } else {
        // Multiple checkboxes (options array) — keep default BEFORE tokens.
        // ORDER: name id cls  use_label_element  default  tokens
        body = `[checkbox${req_mark} ${name}${id_opt}${cls_opts}${use_label_element_token}${def}${tokens}]`;
      }

      // Label behavior mirrors legacy emit_checkbox_singles().
      if (label && addLabels) {
        emit(`<l>${esc_html(label)}${req_mark}</l>`);
        emit(`<br>${body}`);
      } else {
        emit(body);
      }
      // Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
    });
  }

  // Try immediate registration; if core isn’t ready, wait for the event.
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_checkbox_booking_form_exporter();
  } else {
    document.addEventListener('wpbc:bfb:exporter-ready', register_checkbox_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter callback ("Content of booking fields data") for "checkbox".
   *
   * Default behavior:
   *   <b>Label</b>: <f>[field_name]</f><br>
   *
   * Registered per field type via:
   *   WPBC_BFB_ContentExporter.register( 'checkbox', callback )
   */
  function register_checkbox_booking_data_exporter() {
    const C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('checkbox')) {
      return;
    }
    C.register('checkbox', function (field, emit, extras) {
      extras = extras || {};
      const cfg = extras.cfg || {};
      const Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }
      const name = Exp.compute_name('checkbox', field);
      if (!name) {
        return;
      }
      const label = typeof field.label === 'string' && field.label.trim() ? field.label.trim() : name;

      // Shared formatter keeps all packs consistent.
      C.emit_line_bold_field(emit, label, name, cfg);
    });
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_checkbox_booking_data_exporter();
  } else {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_checkbox_booking_data_exporter, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvY2hlY2tib3gvX291dC9maWVsZC1jaGVja2JveC13cHRwbC5qcyIsIm5hbWVzIjpbInciLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIlJlZ2lzdHJ5IiwiV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkiLCJTZWxlY3RfQmFzZSIsIldQQkNfQkZCX1NlbGVjdF9CYXNlIiwiYXBwbHlfaW5saW5lX3RvZ2dsZV90b19jc3MiLCJzeW5jX2lubGluZV90b2dnbGVfZnJvbV9jc3MiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJXUEJDX0JGQl9GaWVsZF9DaGVja2JveCIsInRlbXBsYXRlX2lkIiwib3B0aW9uX3Jvd190ZW1wbGF0ZV9pZCIsImtpbmQiLCJ1aSIsIk9iamVjdCIsImFzc2lnbiIsImNzc2NsYXNzX2lucHV0IiwiaW5saW5lX3RvZ2dsZSIsImdldF9jc3NjbGFzc19pbnB1dCIsInBhbmVsIiwicXVlcnlTZWxlY3RvciIsImdldF9pbmxpbmVfdG9nZ2xlIiwiaGFzX2lubGluZV9jbGFzcyIsInMiLCJTdHJpbmciLCJ0cmltIiwicmVwbGFjZSIsImluZGV4T2YiLCJhZGRfaW5saW5lX2NsYXNzIiwidCIsInNwbGl0IiwiZmlsdGVyIiwiQm9vbGVhbiIsImluY2x1ZGVzIiwicHVzaCIsImpvaW4iLCJyZW1vdmVfaW5saW5lX2NsYXNzIiwieCIsImlucCIsInRvZyIsImhhcyIsInZhbHVlIiwiY2hlY2tlZCIsInNldEF0dHJpYnV0ZSIsIm9uIiwicHJldiIsIm5leHQiLCJkaXNwYXRjaEV2ZW50IiwiRXZlbnQiLCJidWJibGVzIiwiXyIsIndpbmRvdyIsImZpZWxkIiwiX19zZWxlY3RiYXNlX2ZpZWxkIiwiZG9jdW1lbnQiLCJkYXRhc2V0IiwiY3NzY2xhc3MiLCJDdXN0b21FdmVudCIsImRldGFpbCIsImtleSIsIlN0cnVjdHVyZSIsInVwZGF0ZV9maWVsZF9wcm9wIiwiZ2V0X2RlZmF1bHRzIiwidHlwZSIsImxhYmVsIiwibmFtZSIsImh0bWxfaWQiLCJyZXF1aXJlZCIsImhlbHAiLCJkZWZhdWx0X3ZhbHVlIiwidmFsdWVfZGlmZmVycyIsIm11bHRpcGxlIiwib3B0aW9ucyIsInNlbGVjdGVkIiwibWluX3dpZHRoIiwib25fZmllbGRfZHJvcCIsImRhdGEiLCJlbCIsIm1ldGEiLCJjb250ZXh0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiaXNfY2hlY2tib3hfcGFuZWwiLCJmIiwiZ2V0QXR0cmlidXRlIiwidG9Mb3dlckNhc2UiLCJmaXhfb3B0aW9uX3RvZ2dsZV9pY29ucyIsImxpc3QiLCJ3cm9uZyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwibGVuZ3RoIiwiY2xhc3NMaXN0IiwicmVtb3ZlIiwiYWRkIiwiZW5zdXJlX211bHRpcGxlX21vZGVfbWFya2VyIiwibXVsdCIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJoaWRkZW4iLCJzdHlsZSIsImRpc3BsYXkiLCJncm91cCIsImFwcGVuZENoaWxkIiwib2JzZXJ2ZV9vcHRpb25zX2xpc3QiLCJfX3dwYmNfY2Jfb2JzIiwib2JzIiwiTXV0YXRpb25PYnNlcnZlciIsIm11dGF0aW9ucyIsImFkZGVkTm9kZXMiLCJvYnNlcnZlIiwiY2hpbGRMaXN0Iiwid2lyZV9vbmNlX2NoZWNrYm94IiwiX19jaGVja2JveF93aXJlZCIsIm9uX3JlYWR5X29yX3JlbmRlciIsImV2IiwiYm9vdHN0cmFwX3BhbmVsIiwiYWRkRXZlbnRMaXN0ZW5lciIsInJvb3QiLCJnZXRFbGVtZW50QnlJZCIsImdldF9wYW5lbCIsImNsb3Nlc3QiLCJlIiwidGFyZ2V0IiwiaXNfYWRkX2J0biIsImFkZF9idG4iLCJpc19tZW51X2FjdGlvbiIsIm1lbnVfYWN0aW9uIiwic2V0VGltZW91dCIsIm1hdGNoZXMiLCJyZWdpc3Rlcl9jaGVja2JveF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIiLCJFeHAiLCJXUEJDX0JGQl9FeHBvcnRlciIsImhhc19leHBvcnRlciIsIlMiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY19odG1sIiwiZXNjYXBlX2h0bWwiLCJ2IiwiZXNjX3NjIiwiZXNjYXBlX2Zvcl9zaG9ydGNvZGUiLCJlbWl0IiwiZXh0cmFzIiwiY2ZnIiwiY3R4IiwiYWRkTGFiZWxzIiwiaXNfcmVxIiwiaXNfcmVxdWlyZWQiLCJyZXFfbWFyayIsImNvbXB1dGVfbmFtZSIsImlkX29wdCIsImlkX29wdGlvbiIsImNsc19vcHRzIiwiY2xhc3Nfb3B0aW9ucyIsInRva2VucyIsIm9wdGlvbl90b2tlbnMiLCJkZWYiLCJkZWZhdWx0X29wdGlvbl9zdWZmaXgiLCJ1c2VfbGFiZWxfZWxlbWVudF90b2tlbiIsInJhd19sYWJlbCIsImJvZHkiLCJzaW5nbGVfbGFiZWwiLCJvcHRpb25fbGFiZWwiLCJwbGFjZWhvbGRlciIsIm9uY2UiLCJyZWdpc3Rlcl9jaGVja2JveF9ib29raW5nX2RhdGFfZXhwb3J0ZXIiLCJDIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwiZW1pdF9saW5lX2JvbGRfZmllbGQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9jaGVja2JveC9fc3JjL2ZpZWxkLWNoZWNrYm94LXdwdHBsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBXUEJDIEJGQjogRmllbGQgUmVuZGVyZXIgZm9yIFwiY2hlY2tib3hcIiAoV1AtdGVtcGxhdGXigJNkcml2ZW4gUmVmZXJlbmNlLCBubyBmYWxsYmFjaylcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiAtIFVzZXMgd3AudGVtcGxhdGUoJy4uLicpIGZvciBwcmV2aWV3XHJcbiAqIC0gSW5zcGVjdG9yIFVJIGlzIHByb2R1Y2VkIGJ5IHdwLnRlbXBsYXRlKCcuLi4nKVxyXG4gKiAtIEV4dGVuZHMgU2VsZWN0X0Jhc2UgZm9yIHNoYXJlZCBvcHRpb25zIGVkaXRvciB3aXJpbmdcclxuICpcclxuICogQ29udHJhY3RzOlxyXG4gKiAtIFJlZ2lzdHJ5OiAgV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkucmVnaXN0ZXIoJ2NoZWNrYm94JywgQ2xhc3MpXHJcbiAqIC0gQ2xhc3MgQVBJOiBzdGF0aWMgZ2V0X2RlZmF1bHRzKCksIHN0YXRpYyByZW5kZXIoZWwsIGRhdGEsIGN0eCksIHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBjdHg/KSBbb3B0aW9uYWxdXHJcbiAqXHJcbiAqIEZpbGU6ICAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9jaGVja2JveC9fb3V0L2ZpZWxkLWNoZWNrYm94LXdwdHBsLmpzXHJcbiAqXHJcbiAqIEBzaW5jZSAgICAxMS4wLjBcclxuICogQG1vZGlmaWVkIDIwMjUtMDktMTMgMTE6NDBcclxuICogQHZlcnNpb24gIDEuMC4wXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBDb3JlICAgICAgICA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fTtcclxuXHR2YXIgUmVnaXN0cnkgICAgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBTZWxlY3RfQmFzZSA9IENvcmUuV1BCQ19CRkJfU2VsZWN0X0Jhc2U7XHJcblx0Ly8gUG9seWZpbGwgaW5saW5lIGhlbHBlcnMgb24gdGhlIGJhc2UgKHN0YXRpYykgc28gb3RoZXIgcGFja3MgY2FuIGNhbGwgdGhlbSBzYWZlbHlcclxuXHRpZiAoICFTZWxlY3RfQmFzZS5hcHBseV9pbmxpbmVfdG9nZ2xlX3RvX2NzcyApIHtcclxuXHRcdFNlbGVjdF9CYXNlLmFwcGx5X2lubGluZV90b2dnbGVfdG9fY3NzID0gZnVuY3Rpb24gKCkgeyAvKiBuby1vcDsgQ2hlY2tib3ggb3ZlcnJpZGVzICovXHJcblx0XHR9O1xyXG5cdH1cclxuXHRpZiAoICFTZWxlY3RfQmFzZS5zeW5jX2lubGluZV90b2dnbGVfZnJvbV9jc3MgKSB7XHJcblx0XHRTZWxlY3RfQmFzZS5zeW5jX2lubGluZV90b2dnbGVfZnJvbV9jc3MgPSBmdW5jdGlvbiAoKSB7IC8qIG5vLW9wOyBDaGVja2JveCBvdmVycmlkZXMgKi9cclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRpZiAoICEgUmVnaXN0cnk/LnJlZ2lzdGVyIHx8ICEgU2VsZWN0X0Jhc2UgKSB7XHJcblx0XHR3Ll93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9GaWVsZF9DaGVja2JveCcsICdSZWdpc3RyeSBvciBTZWxlY3RfQmFzZSBtaXNzaW5nJyApO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0Y2xhc3MgV1BCQ19CRkJfRmllbGRfQ2hlY2tib3ggZXh0ZW5kcyBTZWxlY3RfQmFzZSB7XHJcblxyXG5cdFx0c3RhdGljIHRlbXBsYXRlX2lkICAgICAgICAgICAgPSAnd3BiYy1iZmItZmllbGQtY2hlY2tib3gnO1xyXG5cdFx0c3RhdGljIG9wdGlvbl9yb3dfdGVtcGxhdGVfaWQgPSAnd3BiYy1iZmItaW5zcGVjdG9yLWNoZWNrYm94LW9wdGlvbi1yb3cnO1xyXG5cdFx0c3RhdGljIGtpbmQgICAgICAgICAgICAgICAgICAgPSAnY2hlY2tib3gnO1xyXG5cclxuXHRcdHN0YXRpYyB1aSA9IE9iamVjdC5hc3NpZ24oIHt9LCBTZWxlY3RfQmFzZS51aSwge1xyXG5cdFx0XHRjc3NjbGFzc19pbnB1dDogJy5pbnNwZWN0b3JfX2lucHV0W2RhdGEtaW5zcGVjdG9yLWtleT1cImNzc2NsYXNzXCJdJyxcclxuXHRcdFx0aW5saW5lX3RvZ2dsZSA6ICcuaW5zcGVjdG9yX19jaGVja2JveC5pbnNwZWN0b3JfX2lucHV0W2RhdGEtaW5zcGVjdG9yLWtleT1cImxheW91dF9pbmxpbmVcIl0nXHJcblx0XHR9ICk7XHJcblxyXG5cdFx0Ly8gLS0tLSBJbmxpbmUgbGF5b3V0IGhlbHBlcnMgdXNlZCBieSB3aXJlX29uY2VfY2hlY2tib3ggLS0tLVxyXG5cdFx0c3RhdGljIGdldF9jc3NjbGFzc19pbnB1dChwYW5lbCkge1xyXG5cdFx0XHRyZXR1cm4gcGFuZWwgPyBwYW5lbC5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLmNzc2NsYXNzX2lucHV0ICkgOiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBnZXRfaW5saW5lX3RvZ2dsZShwYW5lbCkge1xyXG5cdFx0XHRyZXR1cm4gcGFuZWwgPyBwYW5lbC5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLmlubGluZV90b2dnbGUgKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGhhc19pbmxpbmVfY2xhc3Mocykge1xyXG5cdFx0XHRzID0gU3RyaW5nKCBzIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0XHRyZXR1cm4gcyA/ICgnICcgKyBzLnJlcGxhY2UoIC9cXHMrL2csICcgJyApICsgJyAnKS5pbmRleE9mKCAnIGdyb3VwX2lubGluZSAnICkgIT09IC0xIDogZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGFkZF9pbmxpbmVfY2xhc3Mocykge1xyXG5cdFx0XHRjb25zdCB0ID0gU3RyaW5nKCBzIHx8ICcnICkudHJpbSgpLnNwbGl0KCAvXFxzKy8gKS5maWx0ZXIoIEJvb2xlYW4gKTtcclxuXHRcdFx0aWYgKCAhdC5pbmNsdWRlcyggJ2dyb3VwX2lubGluZScgKSApIHQucHVzaCggJ2dyb3VwX2lubGluZScgKTtcclxuXHRcdFx0cmV0dXJuIHQuam9pbiggJyAnICkudHJpbSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyByZW1vdmVfaW5saW5lX2NsYXNzKHMpIHtcclxuXHRcdFx0Y29uc3QgdCA9IFN0cmluZyggcyB8fCAnJyApLnRyaW0oKS5zcGxpdCggL1xccysvICkuZmlsdGVyKCBCb29sZWFuICk7XHJcblx0XHRcdHJldHVybiB0LmZpbHRlciggeCA9PiB4ICE9PSAnZ3JvdXBfaW5saW5lJyApLmpvaW4oICcgJyApLnRyaW0oKTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgc3luY19pbmxpbmVfdG9nZ2xlX2Zyb21fY3NzKHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGlucCA9IHRoaXMuZ2V0X2Nzc2NsYXNzX2lucHV0KCBwYW5lbCApLCB0b2cgPSB0aGlzLmdldF9pbmxpbmVfdG9nZ2xlKCBwYW5lbCApO1xyXG5cdFx0XHRpZiAoICFpbnAgfHwgIXRvZyApIHJldHVybjtcclxuXHRcdFx0Y29uc3QgaGFzICAgPSB0aGlzLmhhc19pbmxpbmVfY2xhc3MoIGlucC52YWx1ZSApO1xyXG5cdFx0XHR0b2cuY2hlY2tlZCA9ICEhaGFzO1xyXG5cdFx0XHR0b2cuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgaGFzID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBhcHBseV9pbmxpbmVfdG9nZ2xlX3RvX2NzcyhwYW5lbCwgb24pIHtcclxuXHRcdFx0Y29uc3QgaW5wID0gdGhpcy5nZXRfY3NzY2xhc3NfaW5wdXQoIHBhbmVsICksIHRvZyA9IHRoaXMuZ2V0X2lubGluZV90b2dnbGUoIHBhbmVsICk7XHJcblx0XHRcdGlmICggIWlucCB8fCAhdG9nICkgcmV0dXJuO1xyXG5cdFx0XHRjb25zdCBwcmV2ID0gU3RyaW5nKCBpbnAudmFsdWUgfHwgJycgKTtcclxuXHRcdFx0Y29uc3QgbmV4dCA9IG9uID8gdGhpcy5hZGRfaW5saW5lX2NsYXNzKCBwcmV2ICkgOiB0aGlzLnJlbW92ZV9pbmxpbmVfY2xhc3MoIHByZXYgKTtcclxuXHRcdFx0aWYgKCBuZXh0ICE9PSBwcmV2ICkge1xyXG5cdFx0XHRcdGlucC52YWx1ZSA9IG5leHQ7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlucC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHRcdGlucC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRjb25zdCBDb3JlICA9IHdpbmRvdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdFx0XHRcdFx0Y29uc3QgZmllbGQgPSBwYW5lbC5fX3NlbGVjdGJhc2VfZmllbGRcclxuXHRcdFx0XHRcdFx0fHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZmllbGQuaXMtc2VsZWN0ZWQsIC53cGJjX2JmYl9fZmllbGQtLXNlbGVjdGVkJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBmaWVsZCApIHtcclxuXHRcdFx0XHRcdFx0ZmllbGQuZGF0YXNldC5jc3NjbGFzcyA9IG5leHQ7XHJcblx0XHRcdFx0XHRcdGZpZWxkLmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggJ3dwYmNfYmZiX2ZpZWxkX2RhdGFfY2hhbmdlZCcsIHtcclxuXHRcdFx0XHRcdFx0XHRidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsga2V5OiAnY3NzY2xhc3MnLCB2YWx1ZTogbmV4dCB9XHJcblx0XHRcdFx0XHRcdH0gKSApO1xyXG5cdFx0XHRcdFx0XHRDb3JlLlN0cnVjdHVyZT8udXBkYXRlX2ZpZWxkX3Byb3A/LiggZmllbGQsICdjc3NjbGFzcycsIG5leHQgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0dG9nLnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsIG9uID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0dHlwZSAgICAgICAgIDogJ2NoZWNrYm94JyxcclxuXHRcdFx0XHRsYWJlbCAgICAgICAgOiAnQ2hlY2tib3gnLFxyXG5cdFx0XHRcdG5hbWUgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGh0bWxfaWQgICAgICA6ICcnLFxyXG5cdFx0XHRcdHJlcXVpcmVkICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGRlZmF1bHRfdmFsdWU6ICcnLFxyXG5cdFx0XHRcdHZhbHVlX2RpZmZlcnM6IHRydWUsXHJcblx0XHRcdFx0bXVsdGlwbGUgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRvcHRpb25zICAgICAgOiBbXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnT3B0aW9uIDEnLCB2YWx1ZTogJ09wdGlvbiAxJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnT3B0aW9uIDInLCB2YWx1ZTogJ09wdGlvbiAyJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnT3B0aW9uIDMnLCB2YWx1ZTogJ09wdGlvbiAzJywgc2VsZWN0ZWQ6IGZhbHNlIH1cclxuXHRcdFx0XHRdLFxyXG5cdFx0XHRcdG1pbl93aWR0aCAgICA6ICcyNDBweCdcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVuc3VyZSBcIm11bHRpcGxlXCIgaXMgc2V0IGFuZCBwZXJzaXN0ZWQgYXQgdGhlIG1vbWVudCBvZiBkcm9wLlxyXG5cdFx0ICogVGhpcyBwcmV2ZW50cyB0aGUgZmlyc3QgSW5zcGVjdG9yIGh5ZHJhdGlvbiBmcm9tIHVuY2hlY2tpbmcgdGhlIGhpZGRlbiB0b2dnbGUuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBtZXRhKSB7XHJcblx0XHRcdHRyeSB7IHN1cGVyLm9uX2ZpZWxkX2Ryb3A/LiggZGF0YSwgZWwsIG1ldGEgKTsgfSBjYXRjaCAoIF8gKSB7fVxyXG5cdFx0XHRpZiAoIG1ldGE/LmNvbnRleHQgIT09ICdkcm9wJyApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHQvLyBJZiBub3QgZXhwbGljaXRseSBzZXQsIGZvcmNlIGl0IE9OIGFuZCBwZXJzaXN0IHRvIGJ1aWxkZXIgc3RhdGUuXHJcblx0XHRcdGlmICggISBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGRhdGEsICdtdWx0aXBsZScgKSApIHtcclxuXHRcdFx0XHRkYXRhLm11bHRpcGxlID0gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdC8vIE1pcnJvciB0byB0aGUgY2FudmFzIGVsZW1lbnQgJiBtb2RlbCBzbyBmdXR1cmUgaHlkcmF0aW9ucyByZWFkIFRSVUUuXHJcblx0XHRcdFx0ZWwuZGF0YXNldC5tdWx0aXBsZSA9ICcxJztcclxuXHRcdFx0XHRlbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7XHJcblx0XHRcdFx0XHRidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsga2V5OiAnbXVsdGlwbGUnLCB2YWx1ZTogdHJ1ZSB9XHJcblx0XHRcdFx0fSApICk7XHJcblx0XHRcdFx0V1BCQ19CRkJfQ29yZS5TdHJ1Y3R1cmU/LnVwZGF0ZV9maWVsZF9wcm9wPy4oIGVsLCAnbXVsdGlwbGUnLCB0cnVlICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge31cclxuXHRcdH1cclxuXHJcblx0XHQvKiA9PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHQgKiBORVc6IGNoZWNrYm94LW9ubHkgaGVscGVyc1xyXG5cdFx0ICogPT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuXHRcdC8qKiBFbnN1cmUgd2UgYWN0IG9ubHkgZm9yIGEgQ2hlY2tib3ggaW5zcGVjdG9yIHBhbmVsLiAqL1xyXG5cdFx0c3RhdGljIGlzX2NoZWNrYm94X3BhbmVsKCBwYW5lbCApIHtcclxuXHRcdFx0Y29uc3QgZiA9IHBhbmVsPy5fX3NlbGVjdGJhc2VfZmllbGRcclxuXHRcdFx0XHR8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19maWVsZC5pcy1zZWxlY3RlZCwgLndwYmNfYmZiX19maWVsZC0tc2VsZWN0ZWQnICk7XHJcblx0XHRcdGNvbnN0IHQgPSAoZj8uZGF0YXNldD8udHlwZSB8fCBmPy5nZXRBdHRyaWJ1dGU/LignZGF0YS10eXBlJykgfHwgJycpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdHJldHVybiB0ID09PSAnY2hlY2tib3gnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBDb252ZXJ0IGFueSBmYWxsYmFjayByYWRpbyBpY29ucyDihpIgY2hlY2tib3ggaWNvbnMgaW5zaWRlIHRoZSBvcHRpb25zIGxpc3QuICovXHJcblx0XHRzdGF0aWMgZml4X29wdGlvbl90b2dnbGVfaWNvbnMoIHBhbmVsICkge1xyXG5cdFx0XHRpZiAoICEgcGFuZWwgfHwgISB0aGlzLmlzX2NoZWNrYm94X3BhbmVsKCBwYW5lbCApICkgeyByZXR1cm47IH1cclxuXHRcdFx0Y29uc3QgbGlzdCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkubGlzdCApO1xyXG5cdFx0XHRpZiAoICEgbGlzdCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdGNvbnN0IHdyb25nID0gbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdWlfX3RvZ2dsZV9pY29uX3JhZGlvJyApO1xyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCB3cm9uZy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHR3cm9uZ1tpXS5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY191aV9fdG9nZ2xlX2ljb25fcmFkaW8nICk7XHJcblx0XHRcdFx0d3JvbmdbaV0uY2xhc3NMaXN0LmFkZCggJ3dwYmNfdWlfX3RvZ2dsZV9pY29uX2NoZWNrYm94JyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBGb3JjZSDigJxtdWx0aXBsZSBtb2Rl4oCdIGZvciB0aGUgU2VsZWN0X0Jhc2UgbG9naWMgKHNvIGRlZmF1bHRzIGFyZSBOT1QgZXhjbHVzaXZlKS5cclxuXHRcdCAqIFdlIGFkZCBhIGhpZGRlbiwgY2hlY2tlZCBjb250cm9sIHRoYXQgU2VsZWN0X0Jhc2UgY2hlY2tzIHZpYSAuanMtb3B0LW11bHRpcGxlW2RhdGEtaW5zcGVjdG9yLWtleT1cIm11bHRpcGxlXCJdLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZW5zdXJlX211bHRpcGxlX21vZGVfbWFya2VyKCBwYW5lbCApIHtcclxuXHRcdFx0aWYgKCAhIHBhbmVsIHx8ICEgdGhpcy5pc19jaGVja2JveF9wYW5lbCggcGFuZWwgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRsZXQgbXVsdCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuanMtb3B0LW11bHRpcGxlW2RhdGEtaW5zcGVjdG9yLWtleT1cIm11bHRpcGxlXCJdJyApO1xyXG5cdFx0XHRpZiAoICEgbXVsdCApIHtcclxuXHRcdFx0XHRtdWx0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2lucHV0JyApO1xyXG5cdFx0XHRcdG11bHQudHlwZSA9ICdjaGVja2JveCc7XHJcblx0XHRcdFx0bXVsdC5jbGFzc05hbWUgPSAnanMtb3B0LW11bHRpcGxlIGluc3BlY3Rvcl9faW5wdXQnO1xyXG5cdFx0XHRcdG11bHQuc2V0QXR0cmlidXRlKCAnZGF0YS1pbnNwZWN0b3Ita2V5JywgJ211bHRpcGxlJyApO1xyXG5cdFx0XHRcdG11bHQuY2hlY2tlZCA9IHRydWU7XHJcblx0XHRcdFx0bXVsdC5oaWRkZW4gPSB0cnVlO1xyXG5cdFx0XHRcdC8vIGhpZGUgZnJvbSBsYXlvdXQgJiBhMTF5IHRyZWUsIGJ1dCBrZWVwIGl0IGRpc2NvdmVyYWJsZSBieSBxdWVyeVNlbGVjdG9yXHJcblx0XHRcdFx0bXVsdC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG5cdFx0XHRcdG11bHQuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRtdWx0LnNldEF0dHJpYnV0ZSggJ3RhYmluZGV4JywgJy0xJyApO1xyXG5cclxuXHRcdFx0XHRjb25zdCBncm91cCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2luc3BlY3Rvcl9fZ3JvdXBbZGF0YS1ncm91cD1cIm9wdGlvbnNcIl0gLmdyb3VwX19maWVsZHMnIClcclxuXHRcdFx0XHRcdHx8IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2luc3BlY3Rvcl9fYm9keScgKSB8fCBwYW5lbDtcclxuXHJcblx0XHRcdFx0Z3JvdXAuYXBwZW5kQ2hpbGQoIG11bHQgKTtcclxuXHRcdFx0fSBlbHNlIGlmICggISBtdWx0LmNoZWNrZWQgKSB7XHJcblx0XHRcdFx0bXVsdC5jaGVja2VkID0gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT2JzZXJ2ZSB0aGUgb3B0aW9ucyBsaXN0IHNvIGFueSByb3dzIGFwcGVuZGVkIGJ5IHRoZSBwYXJlbnQgKGZhbGxiYWNrIHBhdGgpXHJcblx0XHQgKiBhcmUgYXV0by1jb3JyZWN0ZWQgdG8gdXNlIGNoZWNrYm94IGljb25zLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgb2JzZXJ2ZV9vcHRpb25zX2xpc3QoIHBhbmVsICkge1xyXG5cdFx0XHRpZiAoICEgcGFuZWwgfHwgcGFuZWwuX193cGJjX2NiX29icyApIHsgcmV0dXJuOyB9XHJcblx0XHRcdGNvbnN0IGxpc3QgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLmxpc3QgKTtcclxuXHRcdFx0aWYgKCAhIGxpc3QgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Y29uc3Qgb2JzID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoIChtdXRhdGlvbnMpID0+IHtcclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBtdXRhdGlvbnMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0XHRpZiAoIG11dGF0aW9uc1tpXS50eXBlICE9PSAnY2hpbGRMaXN0JyB8fCAhbXV0YXRpb25zW2ldLmFkZGVkTm9kZXM/Lmxlbmd0aCApIHsgY29udGludWU7IH1cclxuXHRcdFx0XHRcdC8vIEFueSBuZXcgcm93cyDihpIgZml4IGljb25zIGltbWVkaWF0ZWx5LlxyXG5cdFx0XHRcdFx0dGhpcy5maXhfb3B0aW9uX3RvZ2dsZV9pY29ucyggcGFuZWwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0b2JzLm9ic2VydmUoIGxpc3QsIHsgY2hpbGRMaXN0OiB0cnVlIH0gKTtcclxuXHRcdFx0XHRwYW5lbC5fX3dwYmNfY2Jfb2JzID0gb2JzO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHdpcmVfb25jZV9jaGVja2JveCgpIHtcclxuXHRcdFx0aWYgKCB0aGlzLl9fY2hlY2tib3hfd2lyZWQgKSB7IHJldHVybjsgfVxyXG5cdFx0XHR0aGlzLl9fY2hlY2tib3hfd2lyZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0Y29uc3Qgb25fcmVhZHlfb3JfcmVuZGVyID0gKCBldiApID0+IHtcclxuXHRcdFx0XHRjb25zdCBwYW5lbCA9IGV2Py5kZXRhaWw/LnBhbmVsO1xyXG5cdFx0XHRcdGlmICggISBwYW5lbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdC8vIExldCBTZWxlY3RfQmFzZSB3aXJlIGl0c2VsZi5cclxuXHRcdFx0XHR0aGlzLmJvb3RzdHJhcF9wYW5lbCggcGFuZWwgKTtcclxuXHJcblx0XHRcdFx0Ly8gMSkgTXVsdGlwbGUgZGVmYXVsdHMgT04gZm9yIENoZWNrYm94IChwcmV2ZW50cyBleGNsdXNpdml0eSkuXHJcblx0XHRcdFx0dGhpcy5lbnN1cmVfbXVsdGlwbGVfbW9kZV9tYXJrZXIoIHBhbmVsICk7XHJcblxyXG5cdFx0XHRcdC8vIDIpIENvcnJlY3QgYW55IGV4aXN0aW5nIGZhbGxiYWNrIGljb25zIChpbml0aWFsIHJlbmRlcikuXHJcblx0XHRcdFx0dGhpcy5maXhfb3B0aW9uX3RvZ2dsZV9pY29ucyggcGFuZWwgKTtcclxuXHJcblx0XHRcdFx0Ly8gMykgS2VlcCBmaXhpbmcgaWNvbnMgZm9yIGFueSBuZXdseSBhZGRlZC9kdXBsaWNhdGVkIHJvd3MuXHJcblx0XHRcdFx0dGhpcy5vYnNlcnZlX29wdGlvbnNfbGlzdCggcGFuZWwgKTtcclxuXHJcblx0XHRcdFx0Ly8gUmVmbGVjdCBjc3NjbGFzcyDihpIgaW5saW5lIHRvZ2dsZSAoZXhpc3RpbmcgYmVoYXZpb3IpLlxyXG5cdFx0XHRcdHRoaXMuc3luY19pbmxpbmVfdG9nZ2xlX2Zyb21fY3NzKCBwYW5lbCApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZWFkeScsICBvbl9yZWFkeV9vcl9yZW5kZXIgKTtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZW5kZXInLCBvbl9yZWFkeV9vcl9yZW5kZXIgKTtcclxuXHJcblx0XHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdGlmICggISByb290ICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdGNvbnN0IGdldF9wYW5lbCA9ICggdCApID0+IHQ/LmNsb3Nlc3Q/LiggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApIHx8IHJvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApIHx8IG51bGw7XHJcblxyXG5cdFx0XHQvLyBLZWVwIG11bHRpcGxlLW1vZGUgYW5kIGljb25zIGNvcnJlY3QgQUZURVIgcGFyZW50IGhhbmRsZXMgY2xpY2tzIChhZGQvZHVwbGljYXRlKVxyXG5cdFx0XHQvLyBOT1RFOiBwYXJlbnQgc3RvcHMgcHJvcGFnYXRpb24gaW4gaXRzIGNsaWNrIGhhbmRsZXI7IHdlIHNjaGVkdWxlIG91ciBmaXggaW4gQ0FQVFVSRSxcclxuXHRcdFx0Ly8gdGhlbiBydW4gaXQgYXN5bmMgKHNldFRpbWVvdXQgMCkgc28gRE9NIGlzIGFscmVhZHkgdXBkYXRlZC5cclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCAoIGUgKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBnZXRfcGFuZWwoIGUudGFyZ2V0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHBhbmVsIHx8ICEgdGhpcy5pc19jaGVja2JveF9wYW5lbCggcGFuZWwgKSApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0Y29uc3QgaXNfYWRkX2J0biAgICAgPSBlLnRhcmdldC5jbG9zZXN0Py4oIHRoaXMudWkuYWRkX2J0biApO1xyXG5cdFx0XHRcdGNvbnN0IGlzX21lbnVfYWN0aW9uID0gZS50YXJnZXQuY2xvc2VzdD8uKCB0aGlzLnVpLm1lbnVfYWN0aW9uICk7XHJcblx0XHRcdFx0aWYgKCBpc19hZGRfYnRuIHx8IGlzX21lbnVfYWN0aW9uICkge1xyXG5cdFx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmVuc3VyZV9tdWx0aXBsZV9tb2RlX21hcmtlciggcGFuZWwgKTsgIC8vIGVuc3VyZXMgbm9uLWV4Y2x1c2l2ZVxyXG5cdFx0XHRcdFx0XHR0aGlzLmZpeF9vcHRpb25fdG9nZ2xlX2ljb25zKCBwYW5lbCApOyAgICAgIC8vIGZpeGVzIGljb24gY2xhc3NcclxuXHRcdFx0XHRcdH0sIDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRydWUgKTsgLy8gQ0FQVFVSRSBwaGFzZVxyXG5cclxuXHRcdFx0Ly8gSW5saW5lIGxheW91dCB0b2dnbGUgJiBtYW51YWwgY3NzY2xhc3MgZWRpdHMgKHVuY2hhbmdlZClcclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgKCBlICkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHBhbmVsID0gZ2V0X3BhbmVsKCBlLnRhcmdldCApO1xyXG5cdFx0XHRcdGlmICggISBwYW5lbCB8fCAhIHRoaXMuaXNfY2hlY2tib3hfcGFuZWwoIHBhbmVsICkgKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdGlmICggZS50YXJnZXQubWF0Y2hlcz8uKCB0aGlzLnVpLmlubGluZV90b2dnbGUgKSApIHtcclxuXHRcdFx0XHRcdGUudGFyZ2V0LnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsIGUudGFyZ2V0LmNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0XHR0aGlzLmFwcGx5X2lubGluZV90b2dnbGVfdG9fY3NzKCBwYW5lbCwgISEgZS50YXJnZXQuY2hlY2tlZCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdHJ1ZSApO1xyXG5cclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCAoIGUgKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBnZXRfcGFuZWwoIGUudGFyZ2V0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHBhbmVsIHx8ICEgdGhpcy5pc19jaGVja2JveF9wYW5lbCggcGFuZWwgKSApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0aWYgKCBlLnRhcmdldC5tYXRjaGVzPy4oIHRoaXMudWkuY3NzY2xhc3NfaW5wdXQgKSApIHtcclxuXHRcdFx0XHRcdHRoaXMuc3luY19pbmxpbmVfdG9nZ2xlX2Zyb21fY3NzKCBwYW5lbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdHJ1ZSApO1xyXG5cclxuXHRcdFx0Ly8gT3B0aW9uYWw6IGJvb3RzdHJhcCBpbW1lZGlhdGVseSBpZiBpbnNwZWN0b3IgaXMgYWxyZWFkeSBvbiBzY3JlZW5cclxuXHRcdFx0c2V0VGltZW91dCggKCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHBhbmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJyN3cGJjX2JmYl9faW5zcGVjdG9yIC53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApO1xyXG5cdFx0XHRcdGlmICggcGFuZWwgJiYgdGhpcy5pc19jaGVja2JveF9wYW5lbCggcGFuZWwgKSApIHtcclxuXHRcdFx0XHRcdHRoaXMuYm9vdHN0cmFwX3BhbmVsKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0dGhpcy5lbnN1cmVfbXVsdGlwbGVfbW9kZV9tYXJrZXIoIHBhbmVsICk7XHJcblx0XHRcdFx0XHR0aGlzLmZpeF9vcHRpb25fdG9nZ2xlX2ljb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0dGhpcy5vYnNlcnZlX29wdGlvbnNfbGlzdCggcGFuZWwgKTtcclxuXHRcdFx0XHRcdHRoaXMuc3luY19pbmxpbmVfdG9nZ2xlX2Zyb21fY3NzKCBwYW5lbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgMCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dHJ5IHsgUmVnaXN0cnkucmVnaXN0ZXIoICdjaGVja2JveCcsIFdQQkNfQkZCX0ZpZWxkX0NoZWNrYm94ICk7IH0gY2F0Y2ggKCBlICkgeyB3Ll93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9GaWVsZF9DaGVja2JveC5yZWdpc3RlcicsIGUgKTsgfVxyXG5cdHcuV1BCQ19CRkJfRmllbGRfQ2hlY2tib3ggPSBXUEJDX0JGQl9GaWVsZF9DaGVja2JveDtcclxuXHR0cnkgeyBXUEJDX0JGQl9GaWVsZF9DaGVja2JveC53aXJlX29uY2VfY2hlY2tib3goKTsgfSBjYXRjaCAoIF8gKSB7fVxyXG5cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRm9ybVwiIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSlcclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvKipcclxuXHRcdCAqIEJvb2tpbmcgRm9ybSBleHBvcnRlciBjYWxsYmFjayAoQWR2YW5jZWQgRm9ybSBzaG9ydGNvZGUpIGZvciBcImNoZWNrYm94XCIuXHJcblx0XHQgKlxyXG5cdFx0ICogVGhpcyBjYWxsYmFjayBpcyByZWdpc3RlcmVkIHBlciBmaWVsZCB0eXBlIHZpYTpcclxuXHRcdCAqICAgV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIoICdjaGVja2JveCcsIGNhbGxiYWNrIClcclxuXHRcdCAqXHJcblx0XHQgKiBDb3JlIGNhbGwgc2l0ZSAoYnVpbGRlci1leHBvcnRlci5qcyk6XHJcblx0XHQgKiAgIFdQQkNfQkZCX0V4cG9ydGVyLnJ1bl9yZWdpc3RlcmVkX2V4cG9ydGVyKCBmaWVsZCwgaW8sIGNmZywgb25jZSwgY3R4IClcclxuXHRcdCAqICAgICDihpIgY2FsbGJhY2soIGZpZWxkLCBlbWl0LCB7IGlvLCBjZmcsIG9uY2UsIGN0eCwgY29yZSB9ICk7XHJcblx0XHQgKlxyXG5cdFx0ICogQGNhbGxiYWNrIFdQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2tcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgZmllbGRcclxuXHRcdCAqICAgTm9ybWFsaXplZCBmaWVsZCBkYXRhIGNvbWluZyBmcm9tIHRoZSBCdWlsZGVyIHN0cnVjdHVyZS5cclxuXHRcdCAqICAgLSBmaWVsZC50eXBlICAgICAgICAgIHtzdHJpbmd9ICAgRmllbGQgdHlwZSwgaGVyZSBcImNoZWNrYm94XCIuXHJcblx0XHQgKiAgIC0gZmllbGQubGFiZWwgICAgICAgICB7c3RyaW5nfSAgIFZpc2libGUgbGFiZWwgaW4gdGhlIGZvcm0gKG1heSBiZSBlbXB0eSkuXHJcblx0XHQgKiAgIC0gZmllbGQubmFtZSAgICAgICAgICB7c3RyaW5nfSAgIE5hbWUgYXMgc3RvcmVkIG9uIHRoZSBjYW52YXMgKGFscmVhZHkgdmFsaWRhdGVkKS5cclxuXHRcdCAqICAgLSBmaWVsZC5odG1sX2lkICAgICAgIHtzdHJpbmd9ICAgT3B0aW9uYWwgSFRNTCBpZCAvIHVzZXItdmlzaWJsZSBpZC5cclxuXHRcdCAqICAgLSBmaWVsZC5jc3NjbGFzcyAgICAgIHtzdHJpbmd9ICAgRXh0cmEgQ1NTIGNsYXNzZXMgZW50ZXJlZCBpbiBJbnNwZWN0b3IuXHJcblx0XHQgKiAgIC0gZmllbGQub3B0aW9ucyAgICAgICB7QXJyYXl9ICAgIE9wdGlvbnMgZm9yIGNoZWNrYm94IGdyb3VwIChsYWJlbC92YWx1ZS9zZWxlY3RlZCkuXHJcblx0XHQgKiAgIC0gZmllbGQub3B0aW9uX2xhYmVsICB7c3RyaW5nfSAgIE9wdGlvbmFsIHNpbmdsZS1jaGVja2JveCBsYWJlbCAodXNlZCB3aGVuIG5vIG9wdGlvbnNbXSkuXHJcblx0XHQgKiAgIC0gZmllbGQucGxhY2Vob2xkZXIgICB7c3RyaW5nfSAgIE9wdGlvbmFsIHBsYWNlaG9sZGVyICh1c2VkIGFzIGZhbGxiYWNrIGxhYmVsKS5cclxuXHRcdCAqICAgLSAuLi4gICAgICAgICAgICAgICAgIChBbnkgb3RoZXIgcGFjay1zcGVjaWZpYyBwcm9wcyBhcmUgYWxzbyBwcmVzZW50LilcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9uKHN0cmluZyk6dm9pZH0gZW1pdFxyXG5cdFx0ICogICBFbWl0cyBvbmUgbGluZS9mcmFnbWVudCBpbnRvIHRoZSBleHBvcnQgYnVmZmVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFzXVxyXG5cdFx0ICogICBFeHRyYSBjb250ZXh0IHBhc3NlZCBieSB0aGUgY29yZSBleHBvcnRlci5cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gcmVnaXN0ZXJfY2hlY2tib3hfYm9va2luZ19mb3JtX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdFx0Y29uc3QgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcclxuXHRcdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdFx0aWYgKCB0eXBlb2YgRXhwLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBFeHAuaGFzX2V4cG9ydGVyKCAnY2hlY2tib3gnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Y29uc3QgUyAgICAgICAgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplIHx8ICh3LldQQkNfQkZCX0NvcmUgJiYgdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX1Nhbml0aXplKSB8fCB7fTtcclxuXHRcdFx0Y29uc3QgZXNjX2h0bWwgPSBTLmVzY2FwZV9odG1sIHx8ICh2ID0+IFN0cmluZyggdiApKTtcclxuXHRcdFx0Y29uc3QgZXNjX3NjICAgPSBTLmVzY2FwZV9mb3Jfc2hvcnRjb2RlIHx8ICh2ID0+IFN0cmluZyggdiApKTtcclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBAdHlwZSB7V1BCQ19CRkJfRXhwb3J0ZXJDYWxsYmFja31cclxuXHRcdFx0ICovXHJcblx0XHRcdEV4cC5yZWdpc3RlciggJ2NoZWNrYm94JywgKGZpZWxkLCBlbWl0LCBleHRyYXMgPSB7fSkgPT4ge1xyXG5cclxuXHRcdFx0XHRjb25zdCBjZmcgICAgICAgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cdFx0XHRcdGNvbnN0IGN0eCAgICAgICA9IGV4dHJhcy5jdHg7XHJcblx0XHRcdFx0Y29uc3QgYWRkTGFiZWxzID0gY2ZnLmFkZExhYmVscyAhPT0gZmFsc2U7XHJcblxyXG5cdFx0XHRcdC8vIFJlcXVpcmVkIG1hcmtlciAoc2FtZSBzZW1hbnRpY3MgYXMgb3RoZXIgdGV4dC1saWtlIGZpZWxkcykuXHJcblx0XHRcdFx0Y29uc3QgaXNfcmVxICAgPSBFeHAuaXNfcmVxdWlyZWQoIGZpZWxkICk7XHJcblx0XHRcdFx0Y29uc3QgcmVxX21hcmsgPSBpc19yZXEgPyAnKicgOiAnJztcclxuXHJcblx0XHRcdFx0Ly8gTmFtZSAvIGlkIC8gY2xhc3NlcyBjb21lIGZyb20gc2hhcmVkIGhlbHBlcnMgc28gdGhleSBzdGF5IGluIHN5bmMgd2l0aCBvdGhlciBwYWNrcy5cclxuXHRcdFx0XHRjb25zdCBuYW1lICAgICA9IEV4cC5jb21wdXRlX25hbWUoICdjaGVja2JveCcsIGZpZWxkICk7XHJcblx0XHRcdFx0Y29uc3QgaWRfb3B0ICAgPSBFeHAuaWRfb3B0aW9uKCBmaWVsZCwgY3R4ICk7XHJcblx0XHRcdFx0Y29uc3QgY2xzX29wdHMgPSBFeHAuY2xhc3Nfb3B0aW9ucyggZmllbGQgKTtcclxuXHJcblx0XHRcdFx0Ly8gT3B0aW9ucyArIGRlZmF1bHQgKHNhbWUgaGVscGVycyBhcyBsZWdhY3kgcGF0aCkuXHJcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gRXhwLm9wdGlvbl90b2tlbnMoIGZpZWxkICk7XHJcblx0XHRcdFx0Y29uc3QgZGVmICAgID0gRXhwLmRlZmF1bHRfb3B0aW9uX3N1ZmZpeCggZmllbGQsIHRva2VucyApO1xyXG5cclxuXHRcdFx0XHQvLyBBbHdheXMgYWRkIGJhcmUgYHVzZV9sYWJlbF9lbGVtZW50YCAobm8gdmFsdWUvcXVvdGVzKSBmb3IgY2hlY2tib3ggc2hvcnRjb2Rlcy5cclxuXHRcdFx0XHRjb25zdCB1c2VfbGFiZWxfZWxlbWVudF90b2tlbiA9ICcgdXNlX2xhYmVsX2VsZW1lbnQnO1xyXG5cclxuXHRcdFx0XHRjb25zdCByYXdfbGFiZWwgPSAoZmllbGQgJiYgdHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJykgPyBmaWVsZC5sYWJlbCA6ICcnO1xyXG5cdFx0XHRcdGNvbnN0IGxhYmVsICAgICA9IHJhd19sYWJlbC50cmltKCk7XHJcblxyXG5cdFx0XHRcdGxldCBib2R5O1xyXG5cclxuXHRcdFx0XHRpZiAoICEgdG9rZW5zLnRyaW0oKSApIHtcclxuXHRcdFx0XHRcdC8vIFNpbmdsZSBjaGVja2JveCAobm8gb3B0aW9ucyBhcnJheSkg4oCUIGtlZXAgbGFiZWwgaW4gcXVvdGVzIGF0IHRoZSBlbmQuXHJcblx0XHRcdFx0XHRjb25zdCBzaW5nbGVfbGFiZWwgPSBmaWVsZC5vcHRpb25fbGFiZWwgfHwgZmllbGQucGxhY2Vob2xkZXIgfHwgbGFiZWwgfHwgJ0kgYWdyZWUnO1xyXG5cclxuXHRcdFx0XHRcdC8vIE9SREVSOiBuYW1lIGlkIGNscyAgdXNlX2xhYmVsX2VsZW1lbnQgIFwibGFiZWxcIi5cclxuXHRcdFx0XHRcdGJvZHkgPSBgW2NoZWNrYm94JHtyZXFfbWFya30gJHtuYW1lfSR7aWRfb3B0fSR7Y2xzX29wdHN9JHt1c2VfbGFiZWxfZWxlbWVudF90b2tlbn0gXCIke2VzY19zYyggc2luZ2xlX2xhYmVsICl9XCJdYDtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Ly8gTXVsdGlwbGUgY2hlY2tib3hlcyAob3B0aW9ucyBhcnJheSkg4oCUIGtlZXAgZGVmYXVsdCBCRUZPUkUgdG9rZW5zLlxyXG5cdFx0XHRcdFx0Ly8gT1JERVI6IG5hbWUgaWQgY2xzICB1c2VfbGFiZWxfZWxlbWVudCAgZGVmYXVsdCAgdG9rZW5zXHJcblx0XHRcdFx0XHRib2R5ID0gYFtjaGVja2JveCR7cmVxX21hcmt9ICR7bmFtZX0ke2lkX29wdH0ke2Nsc19vcHRzfSR7dXNlX2xhYmVsX2VsZW1lbnRfdG9rZW59JHtkZWZ9JHt0b2tlbnN9XWA7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBMYWJlbCBiZWhhdmlvciBtaXJyb3JzIGxlZ2FjeSBlbWl0X2NoZWNrYm94X3NpbmdsZXMoKS5cclxuXHRcdFx0XHRpZiAoIGxhYmVsICYmIGFkZExhYmVscyApIHtcclxuXHRcdFx0XHRcdGVtaXQoIGA8bD4ke2VzY19odG1sKCBsYWJlbCApfSR7cmVxX21hcmt9PC9sPmAgKTtcclxuXHRcdFx0XHRcdGVtaXQoIGA8YnI+JHtib2R5fWAgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0ZW1pdCggYm9keSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBIZWxwIHRleHQgaXMgYXBwZW5kZWQgY2VudHJhbGx5IGJ5IFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9maWVsZF9ub2RlKCkuXHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUcnkgaW1tZWRpYXRlIHJlZ2lzdHJhdGlvbjsgaWYgY29yZSBpc27igJl0IHJlYWR5LCB3YWl0IGZvciB0aGUgZXZlbnQuXHJcblx0XHRpZiAoIHcuV1BCQ19CRkJfRXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHJlZ2lzdGVyX2NoZWNrYm94X2Jvb2tpbmdfZm9ybV9leHBvcnRlcigpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfY2hlY2tib3hfYm9va2luZ19mb3JtX2V4cG9ydGVyLCB7IG9uY2U6IHRydWUgfSApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRXhwb3J0IGZvciBcIkJvb2tpbmcgRGF0YVwiIChDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGEpXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0LyoqXHJcblx0XHQgKiBCb29raW5nIERhdGEgZXhwb3J0ZXIgY2FsbGJhY2sgKFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIpIGZvciBcImNoZWNrYm94XCIuXHJcblx0XHQgKlxyXG5cdFx0ICogRGVmYXVsdCBiZWhhdmlvcjpcclxuXHRcdCAqICAgPGI+TGFiZWw8L2I+OiA8Zj5bZmllbGRfbmFtZV08L2Y+PGJyPlxyXG5cdFx0ICpcclxuXHRcdCAqIFJlZ2lzdGVyZWQgcGVyIGZpZWxkIHR5cGUgdmlhOlxyXG5cdFx0ICogICBXUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIoICdjaGVja2JveCcsIGNhbGxiYWNrIClcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gcmVnaXN0ZXJfY2hlY2tib3hfYm9va2luZ19kYXRhX2V4cG9ydGVyKCkge1xyXG5cclxuXHRcdFx0Y29uc3QgQyA9IHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyO1xyXG5cdFx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRcdGlmICggdHlwZW9mIEMuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEMuaGFzX2V4cG9ydGVyKCAnY2hlY2tib3gnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Qy5yZWdpc3RlciggJ2NoZWNrYm94JywgZnVuY3Rpb24gKGZpZWxkLCBlbWl0LCBleHRyYXMpIHtcclxuXHJcblx0XHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cdFx0XHRcdGNvbnN0IGNmZyA9IGV4dHJhcy5jZmcgfHwge307XHJcblxyXG5cdFx0XHRcdGNvbnN0IEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRcdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLmNvbXB1dGVfbmFtZSAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdGNvbnN0IG5hbWUgPSBFeHAuY29tcHV0ZV9uYW1lKCAnY2hlY2tib3gnLCBmaWVsZCApO1xyXG5cdFx0XHRcdGlmICggISBuYW1lICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0Y29uc3QgbGFiZWwgPSAodHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyAmJiBmaWVsZC5sYWJlbC50cmltKCkpID8gZmllbGQubGFiZWwudHJpbSgpIDogbmFtZTtcclxuXHJcblx0XHRcdFx0Ly8gU2hhcmVkIGZvcm1hdHRlciBrZWVwcyBhbGwgcGFja3MgY29uc2lzdGVudC5cclxuXHRcdFx0XHRDLmVtaXRfbGluZV9ib2xkX2ZpZWxkKCBlbWl0LCBsYWJlbCwgbmFtZSwgY2ZnICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyICYmIHR5cGVvZiB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0cmVnaXN0ZXJfY2hlY2tib3hfYm9va2luZ19kYXRhX2V4cG9ydGVyKCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Y29udGVudC1leHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX2NoZWNrYm94X2Jvb2tpbmdfZGF0YV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHRcdH1cclxuXHJcbn0pKCB3aW5kb3cgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRTtFQUNi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
