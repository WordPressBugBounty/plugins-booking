"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/builder_inspector.js == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// Generic, schema-driven Inspector
// ---------------------------------------------------------------------------------------------------------------------
class WPBC_BFB_Inspector {
  /**
   * Create an Inspector instance.
   *
   * @param {HTMLElement|null} panelEl - Inspector container; if null, a fallback panel is created and appended to <body>.
   * @param {WPBC_Form_Builder} builder - Reference to the form builder instance.
   */
  constructor(panelEl, builder) {
    this.panel = panelEl || this._create_fallback_panel();
    this.builder = builder;
    this.selected_el = null;
    this._initial_render = false;
    this.open_groups = new Set(); // simple keep-open state.
    this._renderTimer = null;
  }

  /**
   * Bind the inspector UI to a specific field element and render its controls.
   *
   * @param {HTMLElement} fieldEl - The `.wpbc_bfb__field` element to inspect.
   * @returns {void}
   */
  bind_to_field(fieldEl) {
    this.selected_el = fieldEl;
    this._initial_render = true;
    this.render();
  }

  /**
   * Clear the inspector panel and show the empty state message.
   *
   * @returns {void}
   */
  clear() {
    this.selected_el = null;
    if (this._renderTimer) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }
    this.panel.innerHTML = '<div class="wpbc_bfb__inspector__empty">Select a field to edit its options.</div>';
  }

  /**
   * Debounced re-render of the inspector while preserving focus and caret position.
   *
   * @private
   * @param {number} [delay=200] - Debounce delay in milliseconds.
   * @returns {void}
   */
  _schedule_render_preserving_focus(delay = 200) {
    // record focus + caret
    const active = document.activeElement;
    const activeKey = active?.dataset?.inspectorKey || null;
    let selStart = null,
      selEnd = null;
    if (active && 'selectionStart' in active && 'selectionEnd' in active) {
      selStart = active.selectionStart;
      selEnd = active.selectionEnd;
    }
    clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => {
      this.render();

      // restore focus
      if (activeKey) {
        const next = this.panel.querySelector(`[data-inspector-key="${activeKey}"]`);
        if (next) {
          next.focus();
          // try restore caret
          try {
            if (selStart != null && selEnd != null && 'setSelectionRange' in next) {
              next.setSelectionRange(selStart, selEnd);
            }
          } catch (_) {}
        }
      }
    }, delay);
  }

  /**
   * Render the inspector UI for the currently selected field based on its schema.
   * Applies default values, groups options, and wires change handlers.
   *
   * @returns {void}
   */
  render() {
    const el = this.selected_el;

    // Hard guard: if there is no selection OR the node is no longer in the document — clear.
    if (!el || !document.body.contains(el)) {
      return this.clear();
    }

    // === Section branch ===
    if (el.classList.contains('wpbc_bfb__section')) {
      return this._render_section_panel(el);
    }

    // === Field branch (existing flow) ===
    if (!el.classList.contains('wpbc_bfb__field')) {
      return this.clear();
    }
    const data = window.WPBC_BFB_Core.WPBC_Form_Builder_Helper.get_all_data_attributes(el);
    const type = data.type || 'text';
    const schema = (window.WPBC_BFB_Field_Option_Schemas || {})[type];
    if (!schema) {
      this.panel.innerHTML = `<div class="wpbc_bfb__inspector__empty">No schema for type "<code>${type}</code>".</div>`;
      return;
    }

    // Apply defaults without overwriting existing values
    const normalized = this._with_defaults(data, schema);

    // Header
    const head = document.createElement('div');
    head.className = 'wpbc_bfb__inspector__head';
    head.innerHTML = `
							<div>
								<h3 class="title">${schema.title || type}</h3>
								${schema.description ? `<div class="desc">${schema.description}</div>` : ''}
							</div>
							<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
								<div class="ui_container ui_container_small">
									<div class="ui_group ">
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="deselect" aria-label="Deselect"><i class="menu_icon icon-1x wpbc_icn_remove_done"></i></button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="scrollto" aria-label="Scroll to field in canvas">
												<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
											</button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="move-up" aria-label="Move field up">
												<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
											</button>
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="move-down" aria-label="Move field down">
												<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
											</button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger tooltip_top button-link-delete" data-action="delete" aria-label="Delete"><span class="in-button-text">Delete&nbsp;&nbsp;</span><i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></button>
										</div>
									</div>
								</div>
							</div>
						`;
    // ---------------------------------------------------------------------------------
    // Deselect (field).
    head.querySelector('[data-action="deselect"]').onclick = () => {
      this.builder?.select_field?.(null);
    };

    // ---------------------------------------------------------------------------------
    // Scroll to selected field in canvas.
    const scrollBtnF = head.querySelector('[data-action="scrollto"]');
    if (scrollBtnF) {
      scrollBtnF.onclick = e => {
        e.preventDefault();
        const el = this.selected_el;
        if (!el || !document.body.contains(el)) {
          return;
        }
        // Reuse builder’s scroll option to keep selection/state consistent.
        this.builder?.select_field?.(el, {
          scrollIntoView: true
        });
        // Optional: brief highlight pulse (class added below in CSS note).
        el.classList.add('wpbc_bfb__scroll-pulse');
        setTimeout(() => el.classList.remove('wpbc_bfb__scroll-pulse'), 700);
      };
    }

    // ---------------------------------------------------------------------------------
    // Move up/down (field).
    const selected_field = el; // current field element.
    const f_up = head.querySelector('[data-action="move-up"]');
    const f_down = head.querySelector('[data-action="move-down"]');
    if (f_up) {
      f_up.onclick = e => {
        e.preventDefault();
        this.builder?.move_item?.(selected_field, 'up');
        this.builder?.select_field?.(selected_field, {
          scrollIntoView: false
        });
      };
    }
    if (f_down) {
      f_down.onclick = e => {
        e.preventDefault();
        this.builder?.move_item?.(selected_field, 'down');
        this.builder?.select_field?.(selected_field, {
          scrollIntoView: false
        });
      };
    }

    // ---------------------------------------------------------------------------------
    // Delete (field).
    const delBtn = head.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.onclick = () => {
        const target = this.selected_el;
        if (!target) {
          return;
        }
        // Optional: confirmation. Remove this block if you want immediate delete.
        const isField = target.classList.contains('wpbc_bfb__field');
        const label = isField ? target.querySelector('.wpbc_bfb__field-label')?.textContent || target.dataset?.id || 'field' : target.dataset?.id || 'section';
        if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
          return;
        }
        this.builder?.delete_item?.(target);
      };
    }

    // Body (groups)
    const body = document.createElement('div');
    body.className = 'wpbc_bfb__inspector__body';
    (schema.groups || []).forEach((group, idx) => {
      const gid = `grp-${idx}-${(schema.title || type).toLowerCase()}`;
      const open = this.open_groups.has(gid) || this._initial_render && idx === 0;

      // Persist the initial-open state so it stays open on subsequent re-renders.
      if (this._initial_render && idx === 0) {
        this.open_groups.add(gid);
      }
      const wrap = document.createElement('section');
      wrap.className = `wpbc_bfb__inspector__group ${open ? 'is-open' : ''}`;
      const h = document.createElement('button');
      h.type = 'button';
      h.className = 'group__header';
      h.innerHTML = `<span>${group.label || 'Options'}</span><i class="dashicons dashicons-arrow-${open ? 'up' : 'down'}"></i>`;
      h.onclick = () => {
        if (wrap.classList.toggle('is-open')) this.open_groups.add(gid);else this.open_groups.delete(gid);
        const i = h.querySelector('i');
        if (i) i.className = `dashicons dashicons-arrow-${wrap.classList.contains('is-open') ? 'up' : 'down'}`;
      };
      wrap.appendChild(h);
      const fieldsWrap = document.createElement('div');
      fieldsWrap.className = 'group__fields';
      (group.fields || []).forEach(def => {
        const row = this._render_field_row(def, normalized, schema);
        if (row) fieldsWrap.appendChild(row);
      });
      wrap.appendChild(fieldsWrap);
      body.appendChild(wrap);
    });
    this.panel.innerHTML = '';
    this.panel.appendChild(head);
    this.panel.appendChild(body);
    this._initial_render = false;
  }

  /**
   * Render a single schema-defined control row (label + control).
   *
   * @private
   * @param {Object} def - Schema control definition (`key`, `label`, `type`, etc.).
   * @param {Object} data - Current data-* attributes mapped for the selected element.
   * @param {Object} schema - Active option schema for the field type.
   * @returns {HTMLElement|null} The row element, or null if the definition is invalid.
   */
  _render_field_row(def, data, schema) {
    const key = def.key;
    if (!key) {
      return null;
    }
    const mapKey = (schema.dataMap || {})[key] || key;
    const value = data[mapKey];
    const row = document.createElement('div');
    row.className = 'inspector__row';
    const label = document.createElement('label');
    label.className = 'inspector__label';
    label.textContent = def.label || key;
    if (def.required) label.innerHTML += ' <span class="req">*</span>';
    if (def.tooltip) label.title = def.tooltip;
    const inputWrap = document.createElement('div');
    inputWrap.className = 'inspector__control';
    const ctrl = this._make_control(def, value);
    ctrl.dataset.inspectorKey = (schema.dataMap || {})[def.key] || def.key;
    inputWrap.appendChild(ctrl);

    // Change binding.
    const applyValue = () => {
      let v = this._read_control_value(def, ctrl);
      if (def.type === 'checkbox') {
        v = !!v;
      }
      const target = this.selected_el;
      if (!target) {
        return;
      }

      // Special handling for id/name so we sanitize + ensure uniqueness & reflect back.
      if (mapKey === 'id') {
        const unique = this.builder?.id?.set_field_id?.(target, v);
        if (unique != null && ctrl.value !== unique) ctrl.value = unique;
        return;
      }
      if (mapKey === 'name') {
        const unique = this.builder?.id?.set_field_name?.(target, v);
        if (unique != null && ctrl.value !== unique) ctrl.value = unique;
        return;
      }
      if (mapKey === 'html_id') {
        const applied = this.builder?.id?.set_field_html_id?.(target, v);
        if (applied != null && ctrl.value !== applied) ctrl.value = applied;
        return;
      }

      // For checkboxes: always store explicit true/false so defaults never override.
      if (def.type === 'checkbox') {
        target.setAttribute('data-' + mapKey, String(v)); // "true" | "false"
      } else {
        // For text/number/etc: keep empty string as an explicit value.
        // Only remove when the value is truly null/undefined (rare in UI).
        if (v == null) {
          target.removeAttribute('data-' + mapKey);
        } else {
          const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
          target.setAttribute('data-' + mapKey, val);
        }
      }

      // Update preview/overlay only (does NOT rebuild inspector).
      if (this.builder?.preview_mode) {
        this.builder.render_preview(target);
      } else {
        this.builder.add_overlay_toolbar(target);
      }
    };

    // While typing: apply + debounce an inspector refresh that preserves focus.
    const onInput = () => {
      applyValue();
      this._schedule_render_preserving_focus(200); // debounce while typing.
    };

    // On commit (change/blur): apply + quick refresh.
    const onChange = () => {
      applyValue();
      this._schedule_render_preserving_focus(0); // immediate (still focus-safe).
    };
    ctrl.addEventListener('input', onInput);
    ctrl.addEventListener('change', onChange);
    row.appendChild(label);
    row.appendChild(inputWrap);
    return row;
  }

  /**
   * Create a form control element for a given schema definition and value.
   *
   * @private
   * @param {Object} def - Schema control definition (`type`, `options`, placeholders, etc.).
   * @param {*} value - Current value to populate into the control.
   * @returns {HTMLElement} The created input/select/textarea element.
   */
  _make_control(def, value) {
    const commonAttr = el => {
      if (def.placeholder) el.placeholder = def.placeholder;
      if (def.min != null) el.min = def.min;
      if (def.max != null) el.max = def.max;
      if (def.step != null) el.step = def.step;
      el.autocomplete = 'off';
      el.className = 'inspector__input';
      return el;
    };
    switch (def.type) {
      case 'text':
        {
          const i = commonAttr(document.createElement('input'));
          i.type = 'text';
          i.value = value ?? '';
          return i;
        }
      case 'number':
        {
          const i = commonAttr(document.createElement('input'));
          i.type = 'number';
          i.value = (value ?? '') === '' ? '' : String(value);
          return i;
        }
      case 'checkbox':
        {
          const i = document.createElement('input');
          i.type = 'checkbox';
          i.className = 'inspector__checkbox';
          i.checked = value === true || value === 'true' || value === 1 || value === '1';
          return i;
        }
      case 'textarea':
        {
          const t = document.createElement('textarea');
          t.className = 'inspector__textarea';
          t.rows = 3;
          t.value = value ?? '';
          return t;
        }
      case 'select':
        {
          const s = document.createElement('select');
          s.className = 'inspector__select';
          (def.options || []).forEach(opt => {
            const o = document.createElement('option');
            if (typeof opt === 'string') {
              o.value = opt;
              o.textContent = opt;
            } else {
              o.value = opt.value;
              o.textContent = opt.label ?? opt.value;
            }
            if (String(o.value) === String(value ?? '')) o.selected = true;
            s.appendChild(o);
          });
          return s;
        }
      default:
        {
          const i = commonAttr(document.createElement('input'));
          i.type = 'text';
          i.value = value ?? '';
          return i;
        }
    }
  }

  /**
   * Read and normalize the current value from a rendered control.
   *
   * @private
   * @param {Object} def - Schema control definition.
   * @param {HTMLElement} ctrl - The input/select/textarea element.
   * @returns {*} Normalized value (boolean for checkbox, number for numeric inputs, string otherwise).
   */
  _read_control_value(def, ctrl) {
    switch (def.type) {
      case 'checkbox':
        return !!ctrl.checked;
      case 'number':
        return ctrl.value === '' ? '' : Number(ctrl.value);
      default:
        return ctrl.value;
    }
  }

  /**
   * Apply schema defaults to a data object without overwriting existing values.
   *
   * @private
   * @param {Object} data - Parsed data-* attributes for the field.
   * @param {Object} schema - Option schema for the field type.
   * @returns {Object} A new object with defaults applied.
   */
  _with_defaults(data, schema) {
    const out = {
      ...data
    };
    (schema.groups || []).forEach(g => (g.fields || []).forEach(f => {
      const mapKey = (schema.dataMap || {})[f.key] || f.key;
      if (out[mapKey] == null && f.default !== undefined) out[mapKey] = f.default;
    }));
    // Ensure type is present
    if (!out.type) out.type = 'text';
    return out;
  }

  /**
   * Create a fallback inspector panel when none exists in the DOM.
   *
   * @private
   * @returns {HTMLElement} The created panel element appended to <body>.
   */
  _create_fallback_panel() {
    const p = document.createElement('div');
    p.id = 'wpbc_bfb__inspector';
    p.className = 'wpbc_bfb__inspector';
    document.body.appendChild(p);
    return p;
  }

  /**
   * Render the Inspector panel for a section: columns control (+ deselect).
   *
   * @param {HTMLElement} section_el - The selected .wpbc_bfb__section element.
   * @returns {void}
   */
  _render_section_panel(section_el) {
    // Current column count.
    const row = section_el.querySelector(':scope > .wpbc_bfb__row');
    const col_count = row ? row.querySelectorAll(':scope > .wpbc_bfb__column').length : 1;

    // -----------------------------------------------------------------------------
    // Header
    const head = document.createElement('div');
    head.className = 'wpbc_bfb__inspector__head';
    head.innerHTML = `
							<div>
								<h3 class="title">Section</h3>
								<div class="desc">Configure layout for this section.</div>
							</div>
							<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
								<div class="ui_container ui_container_small">
									<div class="ui_group ">
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="deselect" aria-label="Deselect"><i class="menu_icon icon-1x wpbc_icn_remove_done"></i></button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="scrollto" aria-label="Scroll to section in canvas">
												<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
											</button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="move-up" aria-label="Move section up">
												<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
											</button>
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="move-down" aria-label="Move section down">
												<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
											</button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger tooltip_top button-link-delete" data-action="delete" aria-label="Delete"><span class="in-button-text">Delete&nbsp;&nbsp;</span><i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></button>
										</div>
									</div>
								</div>
							</div>							
						`;
    // -----------------------------------------------------------------------------
    // Deselect action.
    head.querySelector('[data-action="deselect"]').onclick = () => {
      this.builder?.select_field?.(null);
    };

    // -----------------------------------------------------------------------------
    // Scroll to selected section in canvas.
    const scrollBtnS = head.querySelector('[data-action="scrollto"]');
    if (scrollBtnS) {
      scrollBtnS.onclick = e => {
        e.preventDefault();
        const el = this.selected_el;
        if (!el || !document.body.contains(el)) {
          return;
        }
        this.builder?.select_field?.(el, {
          scrollIntoView: true
        });
        el.classList.add('wpbc_bfb__scroll-pulse');
        setTimeout(() => el.classList.remove('wpbc_bfb__scroll-pulse'), 700);
      };
    }

    // -----------------------------------------------------------------------------
    // Move up / down (section).
    const upBtn = head.querySelector('[data-action="move-up"]');
    if (upBtn) {
      upBtn.onclick = e => {
        e.preventDefault();
        this.builder?.move_item?.(section_el, 'up');
        // keep focus on inspector; reselect to ensure binding remains.
        this.builder?.select_field?.(section_el, {
          scrollIntoView: false
        });
      };
    }
    const downBtn = head.querySelector('[data-action="move-down"]');
    if (downBtn) {
      downBtn.onclick = e => {
        e.preventDefault();
        this.builder?.move_item?.(section_el, 'down');
        // keep focus on inspector; reselect to ensure binding remains.
        this.builder?.select_field?.(section_el, {
          scrollIntoView: false
        });
      };
    }

    // -----------------------------------------------------------------------------
    // Delete (section).
    const delBtn = head.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.onclick = () => {
        const target = this.selected_el;
        if (!target) {
          return;
        }
        // Optional: confirmation (clarify it removes nested content too).
        const label = target.dataset?.id || 'section';
        if (!window.confirm(`Delete ${label} and all its contents? This cannot be undone.`)) {
          return;
        }
        this.builder?.delete_item?.(target);
      };
    }

    // -----------------------------------------------------------------------------
    // Body.
    const body = document.createElement('div');
    body.className = 'wpbc_bfb__inspector__body';

    // -----------------------------------------------------------------------------
    // A single group: Layout.
    const wrap = document.createElement('section');
    wrap.className = 'wpbc_bfb__inspector__group is-open';
    const h = document.createElement('button');
    h.type = 'button';
    h.className = 'group__header';
    h.innerHTML = `<span>Layout</span><i class="dashicons dashicons-arrow-up"></i>`;
    h.onclick = () => {
      wrap.classList.toggle('is-open');
      const i = h.querySelector('i');
      if (i) i.className = `dashicons dashicons-arrow-${wrap.classList.contains('is-open') ? 'up' : 'down'}`;
    };
    wrap.appendChild(h);
    const fieldsWrap = document.createElement('div');
    fieldsWrap.className = 'group__fields';

    // Columns control (number input)
    const rowEl = document.createElement('div');
    rowEl.className = 'inspector__row';
    const label = document.createElement('label');
    label.className = 'inspector__label';
    label.textContent = 'Columns';
    const ctrlWrap = document.createElement('div');
    ctrlWrap.className = 'inspector__control';

    // Columns control (number input) — apply on each valid keystroke and keep UI in sync.
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'inspector__input';
    input.min = '1';
    input.max = '4';
    input.step = '1';
    input.value = String(Math.max(1, Math.min(4, col_count)));
    input.dataset.inspectorKey = 'columns';
    let last_applied = parseInt(input.value, 10);

    // Commit helper: apply immediately if value is valid; coerce to bounds.
    const commit = raw => {
      const v = parseInt(raw, 10);
      if (!Number.isFinite(v)) {
        return false;
      }
      const clamped = window.WPBC_BFB_Core.WPBC_BFB_Sanitize.clamp(v, 1, 4);
      if (clamped !== last_applied) {
        this.builder?.set_section_columns?.(section_el, clamped);
        last_applied = clamped;
        if (String(clamped) !== input.value) {
          input.value = String(clamped);
        }
        // Re-render immediately so layout chips reflect the new count,
        // while preserving focus/caret.
        this._schedule_render_preserving_focus(0);
      }
      return true;
    };

    // Apply as you type if current text parses to a number (no pre-apply debounce).
    input.addEventListener('input', () => {
      commit(input.value);
    });
    // On commit/blur, always coerce to a valid value.
    input.addEventListener('change', () => {
      if (!commit(input.value)) {
        input.value = String(last_applied);
        this._schedule_render_preserving_focus(0);
      }
    });
    input.addEventListener('blur', () => {
      if (!commit(input.value)) {
        input.value = String(last_applied);
      }
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit(input.value);
      }
    });
    ctrlWrap.appendChild(input);
    rowEl.appendChild(label);
    rowEl.appendChild(ctrlWrap);
    fieldsWrap.appendChild(rowEl);

    // -----------------------------------------------------------------------------

    // LAYOUT CHIPS ROW.
    const layout_row = document.createElement('div');
    layout_row.className = 'inspector__row inspector__row--layout-chips';
    const layout_label = document.createElement('label');
    layout_label.className = 'inspector__label';
    layout_label.textContent = 'Layout';
    const layout_ctrl = document.createElement('div');
    layout_ctrl.className = 'inspector__control wpbc_bfb__layout_chips';

    // REUSE the shared helper:.
    window.WPBC_BFB_UI.WPBC_BFB_Layout_Chips.render_for_section(this.builder, section_el, layout_ctrl);
    layout_row.appendChild(layout_label);
    layout_row.appendChild(layout_ctrl);
    fieldsWrap.appendChild(layout_row);

    // -----------------------------------------------------------------------------
    wrap.appendChild(fieldsWrap);
    body.appendChild(wrap);

    // Commit.
    this.panel.innerHTML = '';
    this.panel.appendChild(head);
    this.panel.appendChild(body);
    this._initial_render = false;
  }
}
// Expose the constructor for the builder bridge.
window.WPBC_BFB_Inspector = WPBC_BFB_Inspector;

// Tell the builder that the Inspector class is ready.
document.dispatchEvent(new Event('wpbc_bfb_inspector_ready'));
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9idWlsZGVyX2luc3BlY3Rvci5qcyIsIm5hbWVzIjpbIldQQkNfQkZCX0luc3BlY3RvciIsImNvbnN0cnVjdG9yIiwicGFuZWxFbCIsImJ1aWxkZXIiLCJwYW5lbCIsIl9jcmVhdGVfZmFsbGJhY2tfcGFuZWwiLCJzZWxlY3RlZF9lbCIsIl9pbml0aWFsX3JlbmRlciIsIm9wZW5fZ3JvdXBzIiwiU2V0IiwiX3JlbmRlclRpbWVyIiwiYmluZF90b19maWVsZCIsImZpZWxkRWwiLCJyZW5kZXIiLCJjbGVhciIsImNsZWFyVGltZW91dCIsImlubmVySFRNTCIsIl9zY2hlZHVsZV9yZW5kZXJfcHJlc2VydmluZ19mb2N1cyIsImRlbGF5IiwiYWN0aXZlIiwiZG9jdW1lbnQiLCJhY3RpdmVFbGVtZW50IiwiYWN0aXZlS2V5IiwiZGF0YXNldCIsImluc3BlY3RvcktleSIsInNlbFN0YXJ0Iiwic2VsRW5kIiwic2VsZWN0aW9uU3RhcnQiLCJzZWxlY3Rpb25FbmQiLCJzZXRUaW1lb3V0IiwibmV4dCIsInF1ZXJ5U2VsZWN0b3IiLCJmb2N1cyIsInNldFNlbGVjdGlvblJhbmdlIiwiXyIsImVsIiwiYm9keSIsImNvbnRhaW5zIiwiY2xhc3NMaXN0IiwiX3JlbmRlcl9zZWN0aW9uX3BhbmVsIiwiZGF0YSIsIndpbmRvdyIsIldQQkNfQkZCX0NvcmUiLCJXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIiLCJnZXRfYWxsX2RhdGFfYXR0cmlidXRlcyIsInR5cGUiLCJzY2hlbWEiLCJXUEJDX0JGQl9GaWVsZF9PcHRpb25fU2NoZW1hcyIsIm5vcm1hbGl6ZWQiLCJfd2l0aF9kZWZhdWx0cyIsImhlYWQiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwidGl0bGUiLCJkZXNjcmlwdGlvbiIsIm9uY2xpY2siLCJzZWxlY3RfZmllbGQiLCJzY3JvbGxCdG5GIiwiZSIsInByZXZlbnREZWZhdWx0Iiwic2Nyb2xsSW50b1ZpZXciLCJhZGQiLCJyZW1vdmUiLCJzZWxlY3RlZF9maWVsZCIsImZfdXAiLCJmX2Rvd24iLCJtb3ZlX2l0ZW0iLCJkZWxCdG4iLCJ0YXJnZXQiLCJpc0ZpZWxkIiwibGFiZWwiLCJ0ZXh0Q29udGVudCIsImlkIiwiY29uZmlybSIsImRlbGV0ZV9pdGVtIiwiZ3JvdXBzIiwiZm9yRWFjaCIsImdyb3VwIiwiaWR4IiwiZ2lkIiwidG9Mb3dlckNhc2UiLCJvcGVuIiwiaGFzIiwid3JhcCIsImgiLCJ0b2dnbGUiLCJkZWxldGUiLCJpIiwiYXBwZW5kQ2hpbGQiLCJmaWVsZHNXcmFwIiwiZmllbGRzIiwiZGVmIiwicm93IiwiX3JlbmRlcl9maWVsZF9yb3ciLCJrZXkiLCJtYXBLZXkiLCJkYXRhTWFwIiwidmFsdWUiLCJyZXF1aXJlZCIsInRvb2x0aXAiLCJpbnB1dFdyYXAiLCJjdHJsIiwiX21ha2VfY29udHJvbCIsImFwcGx5VmFsdWUiLCJ2IiwiX3JlYWRfY29udHJvbF92YWx1ZSIsInVuaXF1ZSIsInNldF9maWVsZF9pZCIsInNldF9maWVsZF9uYW1lIiwiYXBwbGllZCIsInNldF9maWVsZF9odG1sX2lkIiwic2V0QXR0cmlidXRlIiwiU3RyaW5nIiwicmVtb3ZlQXR0cmlidXRlIiwidmFsIiwiSlNPTiIsInN0cmluZ2lmeSIsInByZXZpZXdfbW9kZSIsInJlbmRlcl9wcmV2aWV3IiwiYWRkX292ZXJsYXlfdG9vbGJhciIsIm9uSW5wdXQiLCJvbkNoYW5nZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJjb21tb25BdHRyIiwicGxhY2Vob2xkZXIiLCJtaW4iLCJtYXgiLCJzdGVwIiwiYXV0b2NvbXBsZXRlIiwiY2hlY2tlZCIsInQiLCJyb3dzIiwicyIsIm9wdGlvbnMiLCJvcHQiLCJvIiwic2VsZWN0ZWQiLCJOdW1iZXIiLCJvdXQiLCJnIiwiZiIsImRlZmF1bHQiLCJ1bmRlZmluZWQiLCJwIiwic2VjdGlvbl9lbCIsImNvbF9jb3VudCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJsZW5ndGgiLCJzY3JvbGxCdG5TIiwidXBCdG4iLCJkb3duQnRuIiwicm93RWwiLCJjdHJsV3JhcCIsImlucHV0IiwiTWF0aCIsImxhc3RfYXBwbGllZCIsInBhcnNlSW50IiwiY29tbWl0IiwicmF3IiwiaXNGaW5pdGUiLCJjbGFtcGVkIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJjbGFtcCIsInNldF9zZWN0aW9uX2NvbHVtbnMiLCJsYXlvdXRfcm93IiwibGF5b3V0X2xhYmVsIiwibGF5b3V0X2N0cmwiLCJXUEJDX0JGQl9VSSIsIldQQkNfQkZCX0xheW91dF9DaGlwcyIsInJlbmRlcl9mb3Jfc2VjdGlvbiIsImRpc3BhdGNoRXZlbnQiLCJFdmVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYnVpbGRlcl9pbnNwZWN0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9fb3V0L2J1aWxkZXJfaW5zcGVjdG9yLmpzID09IFRpbWUgcG9pbnQ6IDIwMjUtMDgtMjEgMTc6MzlcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyBHZW5lcmljLCBzY2hlbWEtZHJpdmVuIEluc3BlY3RvclxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuY2xhc3MgV1BCQ19CRkJfSW5zcGVjdG9yIHtcclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlIGFuIEluc3BlY3RvciBpbnN0YW5jZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gcGFuZWxFbCAtIEluc3BlY3RvciBjb250YWluZXI7IGlmIG51bGwsIGEgZmFsbGJhY2sgcGFuZWwgaXMgY3JlYXRlZCBhbmQgYXBwZW5kZWQgdG8gPGJvZHk+LlxyXG5cdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXIgLSBSZWZlcmVuY2UgdG8gdGhlIGZvcm0gYnVpbGRlciBpbnN0YW5jZS5cclxuXHQgKi9cclxuXHRjb25zdHJ1Y3RvcihwYW5lbEVsLCBidWlsZGVyKSB7XHJcblx0XHR0aGlzLnBhbmVsICAgICAgICAgICA9IHBhbmVsRWwgfHwgdGhpcy5fY3JlYXRlX2ZhbGxiYWNrX3BhbmVsKCk7XHJcblx0XHR0aGlzLmJ1aWxkZXIgICAgICAgICA9IGJ1aWxkZXI7XHJcblx0XHR0aGlzLnNlbGVjdGVkX2VsICAgICA9IG51bGw7XHJcblx0XHR0aGlzLl9pbml0aWFsX3JlbmRlciA9IGZhbHNlO1xyXG5cdFx0dGhpcy5vcGVuX2dyb3VwcyAgICAgPSBuZXcgU2V0KCk7Ly8gc2ltcGxlIGtlZXAtb3BlbiBzdGF0ZS5cclxuXHRcdHRoaXMuX3JlbmRlclRpbWVyICAgID0gbnVsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJpbmQgdGhlIGluc3BlY3RvciBVSSB0byBhIHNwZWNpZmljIGZpZWxkIGVsZW1lbnQgYW5kIHJlbmRlciBpdHMgY29udHJvbHMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZEVsIC0gVGhlIGAud3BiY19iZmJfX2ZpZWxkYCBlbGVtZW50IHRvIGluc3BlY3QuXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0YmluZF90b19maWVsZChmaWVsZEVsKSB7XHJcblx0XHR0aGlzLnNlbGVjdGVkX2VsICAgICA9IGZpZWxkRWw7XHJcblx0XHR0aGlzLl9pbml0aWFsX3JlbmRlciA9IHRydWU7XHJcblx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQ2xlYXIgdGhlIGluc3BlY3RvciBwYW5lbCBhbmQgc2hvdyB0aGUgZW1wdHkgc3RhdGUgbWVzc2FnZS5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdCAqL1xyXG5cdGNsZWFyKCkge1xyXG5cdFx0dGhpcy5zZWxlY3RlZF9lbCA9IG51bGw7XHJcblx0XHRpZiAoIHRoaXMuX3JlbmRlclRpbWVyICkge1xyXG5cdFx0XHRjbGVhclRpbWVvdXQoIHRoaXMuX3JlbmRlclRpbWVyICk7XHJcblx0XHRcdHRoaXMuX3JlbmRlclRpbWVyID0gbnVsbDtcclxuXHRcdH1cclxuXHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9faW5zcGVjdG9yX19lbXB0eVwiPlNlbGVjdCBhIGZpZWxkIHRvIGVkaXQgaXRzIG9wdGlvbnMuPC9kaXY+JztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIERlYm91bmNlZCByZS1yZW5kZXIgb2YgdGhlIGluc3BlY3RvciB3aGlsZSBwcmVzZXJ2aW5nIGZvY3VzIGFuZCBjYXJldCBwb3NpdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwcml2YXRlXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IFtkZWxheT0yMDBdIC0gRGVib3VuY2UgZGVsYXkgaW4gbWlsbGlzZWNvbmRzLlxyXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdCAqL1xyXG5cdF9zY2hlZHVsZV9yZW5kZXJfcHJlc2VydmluZ19mb2N1cyhkZWxheSA9IDIwMCkge1xyXG5cdFx0Ly8gcmVjb3JkIGZvY3VzICsgY2FyZXRcclxuXHRcdGNvbnN0IGFjdGl2ZSAgICA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XHJcblx0XHRjb25zdCBhY3RpdmVLZXkgPSBhY3RpdmU/LmRhdGFzZXQ/Lmluc3BlY3RvcktleSB8fCBudWxsO1xyXG5cdFx0bGV0IHNlbFN0YXJ0ICAgID0gbnVsbCwgc2VsRW5kID0gbnVsbDtcclxuXHRcdGlmICggYWN0aXZlICYmICdzZWxlY3Rpb25TdGFydCcgaW4gYWN0aXZlICYmICdzZWxlY3Rpb25FbmQnIGluIGFjdGl2ZSApIHtcclxuXHRcdFx0c2VsU3RhcnQgPSBhY3RpdmUuc2VsZWN0aW9uU3RhcnQ7XHJcblx0XHRcdHNlbEVuZCAgID0gYWN0aXZlLnNlbGVjdGlvbkVuZDtcclxuXHRcdH1cclxuXHJcblx0XHRjbGVhclRpbWVvdXQoIHRoaXMuX3JlbmRlclRpbWVyICk7XHJcblx0XHR0aGlzLl9yZW5kZXJUaW1lciA9IHNldFRpbWVvdXQoICgpID0+IHtcclxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHJcblx0XHRcdC8vIHJlc3RvcmUgZm9jdXNcclxuXHRcdFx0aWYgKCBhY3RpdmVLZXkgKSB7XHJcblx0XHRcdFx0Y29uc3QgbmV4dCA9IHRoaXMucGFuZWwucXVlcnlTZWxlY3RvciggYFtkYXRhLWluc3BlY3Rvci1rZXk9XCIke2FjdGl2ZUtleX1cIl1gICk7XHJcblx0XHRcdFx0aWYgKCBuZXh0ICkge1xyXG5cdFx0XHRcdFx0bmV4dC5mb2N1cygpO1xyXG5cdFx0XHRcdFx0Ly8gdHJ5IHJlc3RvcmUgY2FyZXRcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdGlmICggc2VsU3RhcnQgIT0gbnVsbCAmJiBzZWxFbmQgIT0gbnVsbCAmJiAnc2V0U2VsZWN0aW9uUmFuZ2UnIGluIG5leHQgKSB7XHJcblx0XHRcdFx0XHRcdFx0bmV4dC5zZXRTZWxlY3Rpb25SYW5nZSggc2VsU3RhcnQsIHNlbEVuZCApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sIGRlbGF5ICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZW5kZXIgdGhlIGluc3BlY3RvciBVSSBmb3IgdGhlIGN1cnJlbnRseSBzZWxlY3RlZCBmaWVsZCBiYXNlZCBvbiBpdHMgc2NoZW1hLlxyXG5cdCAqIEFwcGxpZXMgZGVmYXVsdCB2YWx1ZXMsIGdyb3VwcyBvcHRpb25zLCBhbmQgd2lyZXMgY2hhbmdlIGhhbmRsZXJzLlxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0cmVuZGVyKCkge1xyXG5cclxuXHRcdGNvbnN0IGVsID0gdGhpcy5zZWxlY3RlZF9lbDtcclxuXHJcblx0XHQvLyBIYXJkIGd1YXJkOiBpZiB0aGVyZSBpcyBubyBzZWxlY3Rpb24gT1IgdGhlIG5vZGUgaXMgbm8gbG9uZ2VyIGluIHRoZSBkb2N1bWVudCDigJQgY2xlYXIuXHJcblx0XHRpZiAoICEgZWwgfHwgISBkb2N1bWVudC5ib2R5LmNvbnRhaW5zKCBlbCApICkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5jbGVhcigpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vID09PSBTZWN0aW9uIGJyYW5jaCA9PT1cclxuXHRcdGlmICggZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9yZW5kZXJfc2VjdGlvbl9wYW5lbCggZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyA9PT0gRmllbGQgYnJhbmNoIChleGlzdGluZyBmbG93KSA9PT1cclxuXHRcdGlmICggISBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLmNsZWFyKCk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdGNvbnN0IGRhdGEgPSB3aW5kb3cuV1BCQ19CRkJfQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGVsICk7XHJcblxyXG5cdFx0Y29uc3QgdHlwZSAgID0gZGF0YS50eXBlIHx8ICd0ZXh0JztcclxuXHRcdGNvbnN0IHNjaGVtYSA9ICh3aW5kb3cuV1BCQ19CRkJfRmllbGRfT3B0aW9uX1NjaGVtYXMgfHwge30pW3R5cGVdO1xyXG5cclxuXHRcdGlmICggISBzY2hlbWEgKSB7XHJcblx0XHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gYDxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9faW5zcGVjdG9yX19lbXB0eVwiPk5vIHNjaGVtYSBmb3IgdHlwZSBcIjxjb2RlPiR7dHlwZX08L2NvZGU+XCIuPC9kaXY+YDtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyBBcHBseSBkZWZhdWx0cyB3aXRob3V0IG92ZXJ3cml0aW5nIGV4aXN0aW5nIHZhbHVlc1xyXG5cdFx0Y29uc3Qgbm9ybWFsaXplZCA9IHRoaXMuX3dpdGhfZGVmYXVsdHMoIGRhdGEsIHNjaGVtYSApO1xyXG5cclxuXHRcdC8vIEhlYWRlclxyXG5cdFx0Y29uc3QgaGVhZCAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0aGVhZC5jbGFzc05hbWUgPSAnd3BiY19iZmJfX2luc3BlY3Rvcl9faGVhZCc7XHJcblx0XHRoZWFkLmlubmVySFRNTCA9IGBcclxuXHRcdFx0XHRcdFx0XHQ8ZGl2PlxyXG5cdFx0XHRcdFx0XHRcdFx0PGgzIGNsYXNzPVwidGl0bGVcIj4ke3NjaGVtYS50aXRsZSB8fCB0eXBlfTwvaDM+XHJcblx0XHRcdFx0XHRcdFx0XHQke3NjaGVtYS5kZXNjcmlwdGlvbiA/IGA8ZGl2IGNsYXNzPVwiZGVzY1wiPiR7c2NoZW1hLmRlc2NyaXB0aW9ufTwvZGl2PmAgOiAnJ31cclxuXHRcdFx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwiYWN0aW9ucyB3cGJjX2FqeF90b29sYmFyIHdwYmNfbm9fYm9yZGVyc1wiPlxyXG5cdFx0XHRcdFx0XHRcdFx0PGRpdiBjbGFzcz1cInVpX2NvbnRhaW5lciB1aV9jb250YWluZXJfc21hbGxcIj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0PGRpdiBjbGFzcz1cInVpX2dyb3VwIFwiPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJ1aV9lbGVtZW50XCI+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ1dHRvbiBidXR0b24tc2Vjb25kYXJ5IHdwYmNfdWlfY29udHJvbCB3cGJjX3VpX2J1dHRvbiB0b29sdGlwX3RvcFwiIGRhdGEtYWN0aW9uPVwiZGVzZWxlY3RcIiBhcmlhLWxhYmVsPVwiRGVzZWxlY3RcIj48aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JlbW92ZV9kb25lXCI+PC9pPjwvYnV0dG9uPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJ1aV9lbGVtZW50XCI+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ1dHRvbiBidXR0b24tc2Vjb25kYXJ5IHdwYmNfdWlfY29udHJvbCB3cGJjX3VpX2J1dHRvbiB0b29sdGlwX3RvcFwiIGRhdGEtYWN0aW9uPVwic2Nyb2xsdG9cIiBhcmlhLWxhYmVsPVwiU2Nyb2xsIHRvIGZpZWxkIGluIGNhbnZhc1wiPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2Fkc19jbGljayBmaWx0ZXJfY2VudGVyX2ZvY3VzXCI+PC9pPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0PC9idXR0b24+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0PGRpdiBjbGFzcz1cInVpX2VsZW1lbnRcIj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYnV0dG9uIGJ1dHRvbi1zZWNvbmRhcnkgd3BiY191aV9jb250cm9sIHdwYmNfdWlfYnV0dG9uIHRvb2x0aXBfdG9wXCIgZGF0YS1hY3Rpb249XCJtb3ZlLXVwXCIgYXJpYS1sYWJlbD1cIk1vdmUgZmllbGQgdXBcIj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9hcnJvd191cHdhcmRcIj48L2k+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ8L2J1dHRvbj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYnV0dG9uIGJ1dHRvbi1zZWNvbmRhcnkgd3BiY191aV9jb250cm9sIHdwYmNfdWlfYnV0dG9uIHRvb2x0aXBfdG9wXCIgZGF0YS1hY3Rpb249XCJtb3ZlLWRvd25cIiBhcmlhLWxhYmVsPVwiTW92ZSBmaWVsZCBkb3duXCI+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fYXJyb3dfZG93bndhcmRcIj48L2k+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ8L2J1dHRvbj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwidWlfZWxlbWVudFwiPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0PGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidXR0b24gYnV0dG9uLXNlY29uZGFyeSB3cGJjX3VpX2NvbnRyb2wgd3BiY191aV9idXR0b24gd3BiY191aV9idXR0b25fZGFuZ2VyIHRvb2x0aXBfdG9wIGJ1dHRvbi1saW5rLWRlbGV0ZVwiIGRhdGEtYWN0aW9uPVwiZGVsZXRlXCIgYXJpYS1sYWJlbD1cIkRlbGV0ZVwiPjxzcGFuIGNsYXNzPVwiaW4tYnV0dG9uLXRleHRcIj5EZWxldGUmbmJzcDsmbmJzcDs8L3NwYW4+PGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9kZWxldGVfb3V0bGluZVwiPjwvaT48L2J1dHRvbj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdFx0YDtcclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRGVzZWxlY3QgKGZpZWxkKS5cclxuXHRcdGhlYWQucXVlcnlTZWxlY3RvciggJ1tkYXRhLWFjdGlvbj1cImRlc2VsZWN0XCJdJyApLm9uY2xpY2sgPSAoKSA9PiB7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uc2VsZWN0X2ZpZWxkPy4oIG51bGwgKTtcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBTY3JvbGwgdG8gc2VsZWN0ZWQgZmllbGQgaW4gY2FudmFzLlxyXG5cdFx0Y29uc3Qgc2Nyb2xsQnRuRiA9IGhlYWQucXVlcnlTZWxlY3RvciggJ1tkYXRhLWFjdGlvbj1cInNjcm9sbHRvXCJdJyApO1xyXG5cdFx0aWYgKCBzY3JvbGxCdG5GICkge1xyXG5cdFx0XHRzY3JvbGxCdG5GLm9uY2xpY2sgPSAoZSkgPT4ge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRjb25zdCBlbCA9IHRoaXMuc2VsZWN0ZWRfZWw7XHJcblx0XHRcdFx0aWYgKCAhIGVsIHx8ICEgZG9jdW1lbnQuYm9keS5jb250YWlucyggZWwgKSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gUmV1c2UgYnVpbGRlcuKAmXMgc2Nyb2xsIG9wdGlvbiB0byBrZWVwIHNlbGVjdGlvbi9zdGF0ZSBjb25zaXN0ZW50LlxyXG5cdFx0XHRcdHRoaXMuYnVpbGRlcj8uc2VsZWN0X2ZpZWxkPy4oIGVsLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHRcdFx0XHQvLyBPcHRpb25hbDogYnJpZWYgaGlnaGxpZ2h0IHB1bHNlIChjbGFzcyBhZGRlZCBiZWxvdyBpbiBDU1Mgbm90ZSkuXHJcblx0XHRcdFx0ZWwuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19zY3JvbGwtcHVsc2UnICk7XHJcblx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4gZWwuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYmZiX19zY3JvbGwtcHVsc2UnICksIDcwMCApO1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gTW92ZSB1cC9kb3duIChmaWVsZCkuXHJcblx0XHRjb25zdCBzZWxlY3RlZF9maWVsZCA9IGVsOyAvLyBjdXJyZW50IGZpZWxkIGVsZW1lbnQuXHJcblx0XHRjb25zdCBmX3VwICAgICAgICAgICA9IGhlYWQucXVlcnlTZWxlY3RvciggJ1tkYXRhLWFjdGlvbj1cIm1vdmUtdXBcIl0nICk7XHJcblx0XHRjb25zdCBmX2Rvd24gICAgICAgICA9IGhlYWQucXVlcnlTZWxlY3RvciggJ1tkYXRhLWFjdGlvbj1cIm1vdmUtZG93blwiXScgKTtcclxuXHJcblx0XHRpZiAoIGZfdXAgKSB7XHJcblx0XHRcdGZfdXAub25jbGljayA9IChlKSA9PiB7XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdHRoaXMuYnVpbGRlcj8ubW92ZV9pdGVtPy4oIHNlbGVjdGVkX2ZpZWxkLCAndXAnICk7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyPy5zZWxlY3RfZmllbGQ/Liggc2VsZWN0ZWRfZmllbGQsIHsgc2Nyb2xsSW50b1ZpZXc6IGZhbHNlIH0gKTtcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHRcdGlmICggZl9kb3duICkge1xyXG5cdFx0XHRmX2Rvd24ub25jbGljayA9IChlKSA9PiB7XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdHRoaXMuYnVpbGRlcj8ubW92ZV9pdGVtPy4oIHNlbGVjdGVkX2ZpZWxkLCAnZG93bicgKTtcclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXI/LnNlbGVjdF9maWVsZD8uKCBzZWxlY3RlZF9maWVsZCwgeyBzY3JvbGxJbnRvVmlldzogZmFsc2UgfSApO1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRGVsZXRlIChmaWVsZCkuXHJcblx0XHRjb25zdCBkZWxCdG4gPSBoZWFkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1hY3Rpb249XCJkZWxldGVcIl0nICk7XHJcblx0XHRpZiAoIGRlbEJ0biApIHtcclxuXHRcdFx0ZGVsQnRuLm9uY2xpY2sgPSAoKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgdGFyZ2V0ID0gdGhpcy5zZWxlY3RlZF9lbDtcclxuXHRcdFx0XHRpZiAoICEgdGFyZ2V0ICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBPcHRpb25hbDogY29uZmlybWF0aW9uLiBSZW1vdmUgdGhpcyBibG9jayBpZiB5b3Ugd2FudCBpbW1lZGlhdGUgZGVsZXRlLlxyXG5cdFx0XHRcdGNvbnN0IGlzRmllbGQgPSB0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHRcdGNvbnN0IGxhYmVsICAgPSBpc0ZpZWxkXHJcblx0XHRcdFx0XHQ/ICh0YXJnZXQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZmllbGQtbGFiZWwnICk/LnRleHRDb250ZW50IHx8IHRhcmdldC5kYXRhc2V0Py5pZCB8fCAnZmllbGQnKVxyXG5cdFx0XHRcdFx0OiAodGFyZ2V0LmRhdGFzZXQ/LmlkIHx8ICdzZWN0aW9uJyk7XHJcblxyXG5cdFx0XHRcdGlmICggISB3aW5kb3cuY29uZmlybSggYERlbGV0ZSAke2xhYmVsfT8gVGhpcyBjYW5ub3QgYmUgdW5kb25lLmAgKSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyPy5kZWxldGVfaXRlbT8uKCB0YXJnZXQgKTtcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBCb2R5IChncm91cHMpXHJcblx0XHRjb25zdCBib2R5ICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRib2R5LmNsYXNzTmFtZSA9ICd3cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JztcclxuXHJcblx0XHQoc2NoZW1hLmdyb3VwcyB8fCBbXSkuZm9yRWFjaCggKGdyb3VwLCBpZHgpID0+IHtcclxuXHRcdFx0Y29uc3QgZ2lkICA9IGBncnAtJHtpZHh9LSR7KHNjaGVtYS50aXRsZSB8fCB0eXBlKS50b0xvd2VyQ2FzZSgpfWA7XHJcblx0XHRcdGNvbnN0IG9wZW4gPSB0aGlzLm9wZW5fZ3JvdXBzLmhhcyggZ2lkICkgfHwgKHRoaXMuX2luaXRpYWxfcmVuZGVyICYmIGlkeCA9PT0gMCk7XHJcblxyXG5cdFx0XHQvLyBQZXJzaXN0IHRoZSBpbml0aWFsLW9wZW4gc3RhdGUgc28gaXQgc3RheXMgb3BlbiBvbiBzdWJzZXF1ZW50IHJlLXJlbmRlcnMuXHJcblx0XHRcdGlmICggdGhpcy5faW5pdGlhbF9yZW5kZXIgJiYgaWR4ID09PSAwICkge1xyXG5cdFx0XHRcdHRoaXMub3Blbl9ncm91cHMuYWRkKCBnaWQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qgd3JhcCAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc2VjdGlvbicgKTtcclxuXHRcdFx0d3JhcC5jbGFzc05hbWUgPSBgd3BiY19iZmJfX2luc3BlY3Rvcl9fZ3JvdXAgJHtvcGVuID8gJ2lzLW9wZW4nIDogJyd9YDtcclxuXHJcblx0XHRcdGNvbnN0IGggICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2J1dHRvbicgKTtcclxuXHRcdFx0aC50eXBlICAgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0aC5jbGFzc05hbWUgPSAnZ3JvdXBfX2hlYWRlcic7XHJcblx0XHRcdGguaW5uZXJIVE1MID0gYDxzcGFuPiR7Z3JvdXAubGFiZWwgfHwgJ09wdGlvbnMnfTwvc3Bhbj48aSBjbGFzcz1cImRhc2hpY29ucyBkYXNoaWNvbnMtYXJyb3ctJHtvcGVuID8gJ3VwJyA6ICdkb3duJ31cIj48L2k+YDtcclxuXHRcdFx0aC5vbmNsaWNrICAgPSAoKSA9PiB7XHJcblx0XHRcdFx0aWYgKCB3cmFwLmNsYXNzTGlzdC50b2dnbGUoICdpcy1vcGVuJyApICkgdGhpcy5vcGVuX2dyb3Vwcy5hZGQoIGdpZCApO1xyXG5cdFx0XHRcdGVsc2UgdGhpcy5vcGVuX2dyb3Vwcy5kZWxldGUoIGdpZCApO1xyXG5cdFx0XHRcdGNvbnN0IGkgPSBoLnF1ZXJ5U2VsZWN0b3IoICdpJyApO1xyXG5cdFx0XHRcdGlmICggaSApIGkuY2xhc3NOYW1lID0gYGRhc2hpY29ucyBkYXNoaWNvbnMtYXJyb3ctJHt3cmFwLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nICkgPyAndXAnIDogJ2Rvd24nfWA7XHJcblx0XHRcdH07XHJcblx0XHRcdHdyYXAuYXBwZW5kQ2hpbGQoIGggKTtcclxuXHJcblx0XHRcdGNvbnN0IGZpZWxkc1dyYXAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdFx0ZmllbGRzV3JhcC5jbGFzc05hbWUgPSAnZ3JvdXBfX2ZpZWxkcyc7XHJcblxyXG5cdFx0XHQoZ3JvdXAuZmllbGRzIHx8IFtdKS5mb3JFYWNoKCBkZWYgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHJvdyA9IHRoaXMuX3JlbmRlcl9maWVsZF9yb3coIGRlZiwgbm9ybWFsaXplZCwgc2NoZW1hICk7XHJcblx0XHRcdFx0aWYgKCByb3cgKSBmaWVsZHNXcmFwLmFwcGVuZENoaWxkKCByb3cgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0d3JhcC5hcHBlbmRDaGlsZCggZmllbGRzV3JhcCApO1xyXG5cdFx0XHRib2R5LmFwcGVuZENoaWxkKCB3cmFwICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0dGhpcy5wYW5lbC5pbm5lckhUTUwgPSAnJztcclxuXHRcdHRoaXMucGFuZWwuYXBwZW5kQ2hpbGQoIGhlYWQgKTtcclxuXHRcdHRoaXMucGFuZWwuYXBwZW5kQ2hpbGQoIGJvZHkgKTtcclxuXHRcdHRoaXMuX2luaXRpYWxfcmVuZGVyID0gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZW5kZXIgYSBzaW5nbGUgc2NoZW1hLWRlZmluZWQgY29udHJvbCByb3cgKGxhYmVsICsgY29udHJvbCkuXHJcblx0ICpcclxuXHQgKiBAcHJpdmF0ZVxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkZWYgLSBTY2hlbWEgY29udHJvbCBkZWZpbml0aW9uIChga2V5YCwgYGxhYmVsYCwgYHR5cGVgLCBldGMuKS5cclxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGF0YSAtIEN1cnJlbnQgZGF0YS0qIGF0dHJpYnV0ZXMgbWFwcGVkIGZvciB0aGUgc2VsZWN0ZWQgZWxlbWVudC5cclxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2NoZW1hIC0gQWN0aXZlIG9wdGlvbiBzY2hlbWEgZm9yIHRoZSBmaWVsZCB0eXBlLlxyXG5cdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudHxudWxsfSBUaGUgcm93IGVsZW1lbnQsIG9yIG51bGwgaWYgdGhlIGRlZmluaXRpb24gaXMgaW52YWxpZC5cclxuXHQgKi9cclxuXHRfcmVuZGVyX2ZpZWxkX3JvdyhkZWYsIGRhdGEsIHNjaGVtYSkge1xyXG5cclxuXHRcdGNvbnN0IGtleSA9IGRlZi5rZXk7XHJcblx0XHRpZiAoICEga2V5ICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBtYXBLZXkgPSAoc2NoZW1hLmRhdGFNYXAgfHwge30pW2tleV0gfHwga2V5O1xyXG5cdFx0Y29uc3QgdmFsdWUgID0gZGF0YVttYXBLZXldO1xyXG5cclxuXHRcdGNvbnN0IHJvdyAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0cm93LmNsYXNzTmFtZSA9ICdpbnNwZWN0b3JfX3Jvdyc7XHJcblxyXG5cdFx0Y29uc3QgbGFiZWwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRsYWJlbC5jbGFzc05hbWUgICA9ICdpbnNwZWN0b3JfX2xhYmVsJztcclxuXHRcdGxhYmVsLnRleHRDb250ZW50ID0gZGVmLmxhYmVsIHx8IGtleTtcclxuXHRcdGlmICggZGVmLnJlcXVpcmVkICkgbGFiZWwuaW5uZXJIVE1MICs9ICcgPHNwYW4gY2xhc3M9XCJyZXFcIj4qPC9zcGFuPic7XHJcblx0XHRpZiAoIGRlZi50b29sdGlwICkgbGFiZWwudGl0bGUgPSBkZWYudG9vbHRpcDtcclxuXHJcblx0XHRjb25zdCBpbnB1dFdyYXAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdGlucHV0V3JhcC5jbGFzc05hbWUgPSAnaW5zcGVjdG9yX19jb250cm9sJztcclxuXHJcblx0XHRjb25zdCBjdHJsID0gdGhpcy5fbWFrZV9jb250cm9sKCBkZWYsIHZhbHVlICk7XHJcblx0XHRjdHJsLmRhdGFzZXQuaW5zcGVjdG9yS2V5ID0gKHNjaGVtYS5kYXRhTWFwIHx8IHt9KVtkZWYua2V5XSB8fCBkZWYua2V5O1xyXG5cdFx0aW5wdXRXcmFwLmFwcGVuZENoaWxkKCBjdHJsICk7XHJcblxyXG5cdFx0Ly8gQ2hhbmdlIGJpbmRpbmcuXHJcblx0XHRjb25zdCBhcHBseVZhbHVlID0gKCkgPT4ge1xyXG5cclxuXHRcdFx0bGV0IHYgPSB0aGlzLl9yZWFkX2NvbnRyb2xfdmFsdWUoIGRlZiwgY3RybCApO1xyXG5cdFx0XHRpZiAoIGRlZi50eXBlID09PSAnY2hlY2tib3gnICkge1xyXG5cdFx0XHRcdHYgPSAhIXY7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHRhcmdldCA9IHRoaXMuc2VsZWN0ZWRfZWw7XHJcblx0XHRcdGlmICggIXRhcmdldCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNwZWNpYWwgaGFuZGxpbmcgZm9yIGlkL25hbWUgc28gd2Ugc2FuaXRpemUgKyBlbnN1cmUgdW5pcXVlbmVzcyAmIHJlZmxlY3QgYmFjay5cclxuXHRcdFx0aWYgKCBtYXBLZXkgPT09ICdpZCcgKSB7XHJcblx0XHRcdFx0Y29uc3QgdW5pcXVlID0gdGhpcy5idWlsZGVyPy5pZD8uc2V0X2ZpZWxkX2lkPy4oIHRhcmdldCwgdiApO1xyXG5cdFx0XHRcdGlmICggdW5pcXVlICE9IG51bGwgJiYgY3RybC52YWx1ZSAhPT0gdW5pcXVlICkgY3RybC52YWx1ZSA9IHVuaXF1ZTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBtYXBLZXkgPT09ICduYW1lJyApIHtcclxuXHRcdFx0XHRjb25zdCB1bmlxdWUgPSB0aGlzLmJ1aWxkZXI/LmlkPy5zZXRfZmllbGRfbmFtZT8uKCB0YXJnZXQsIHYgKTtcclxuXHRcdFx0XHRpZiAoIHVuaXF1ZSAhPSBudWxsICYmIGN0cmwudmFsdWUgIT09IHVuaXF1ZSApIGN0cmwudmFsdWUgPSB1bmlxdWU7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggbWFwS2V5ID09PSAnaHRtbF9pZCcgKSB7XHJcblx0XHRcdFx0Y29uc3QgYXBwbGllZCA9IHRoaXMuYnVpbGRlcj8uaWQ/LnNldF9maWVsZF9odG1sX2lkPy4oIHRhcmdldCwgdiApO1xyXG5cdFx0XHRcdGlmICggYXBwbGllZCAhPSBudWxsICYmIGN0cmwudmFsdWUgIT09IGFwcGxpZWQgKSBjdHJsLnZhbHVlID0gYXBwbGllZDtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZvciBjaGVja2JveGVzOiBhbHdheXMgc3RvcmUgZXhwbGljaXQgdHJ1ZS9mYWxzZSBzbyBkZWZhdWx0cyBuZXZlciBvdmVycmlkZS5cclxuXHRcdFx0aWYgKCBkZWYudHlwZSA9PT0gJ2NoZWNrYm94JyApIHtcclxuXHRcdFx0XHR0YXJnZXQuc2V0QXR0cmlidXRlKCAnZGF0YS0nICsgbWFwS2V5LCBTdHJpbmcoIHYgKSApOyAvLyBcInRydWVcIiB8IFwiZmFsc2VcIlxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIEZvciB0ZXh0L251bWJlci9ldGM6IGtlZXAgZW1wdHkgc3RyaW5nIGFzIGFuIGV4cGxpY2l0IHZhbHVlLlxyXG5cdFx0XHRcdC8vIE9ubHkgcmVtb3ZlIHdoZW4gdGhlIHZhbHVlIGlzIHRydWx5IG51bGwvdW5kZWZpbmVkIChyYXJlIGluIFVJKS5cclxuXHRcdFx0XHRpZiAoIHYgPT0gbnVsbCApIHtcclxuXHRcdFx0XHRcdHRhcmdldC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLScgKyBtYXBLZXkgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29uc3QgdmFsID0gKHR5cGVvZiB2ID09PSAnb2JqZWN0JykgPyBKU09OLnN0cmluZ2lmeSggdiApIDogU3RyaW5nKCB2ICk7XHJcblx0XHRcdFx0XHR0YXJnZXQuc2V0QXR0cmlidXRlKCAnZGF0YS0nICsgbWFwS2V5LCB2YWwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFVwZGF0ZSBwcmV2aWV3L292ZXJsYXkgb25seSAoZG9lcyBOT1QgcmVidWlsZCBpbnNwZWN0b3IpLlxyXG5cdFx0XHRpZiAoIHRoaXMuYnVpbGRlcj8ucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdHRoaXMuYnVpbGRlci5yZW5kZXJfcHJldmlldyggdGFyZ2V0ICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmFkZF9vdmVybGF5X3Rvb2xiYXIoIHRhcmdldCApO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIFdoaWxlIHR5cGluZzogYXBwbHkgKyBkZWJvdW5jZSBhbiBpbnNwZWN0b3IgcmVmcmVzaCB0aGF0IHByZXNlcnZlcyBmb2N1cy5cclxuXHRcdGNvbnN0IG9uSW5wdXQgPSAoKSA9PiB7XHJcblx0XHRcdGFwcGx5VmFsdWUoKTtcclxuXHRcdFx0dGhpcy5fc2NoZWR1bGVfcmVuZGVyX3ByZXNlcnZpbmdfZm9jdXMoIDIwMCApOyAvLyBkZWJvdW5jZSB3aGlsZSB0eXBpbmcuXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIE9uIGNvbW1pdCAoY2hhbmdlL2JsdXIpOiBhcHBseSArIHF1aWNrIHJlZnJlc2guXHJcblx0XHRjb25zdCBvbkNoYW5nZSA9ICgpID0+IHtcclxuXHRcdFx0YXBwbHlWYWx1ZSgpO1xyXG5cdFx0XHR0aGlzLl9zY2hlZHVsZV9yZW5kZXJfcHJlc2VydmluZ19mb2N1cyggMCApOyAgIC8vIGltbWVkaWF0ZSAoc3RpbGwgZm9jdXMtc2FmZSkuXHJcblx0XHR9O1xyXG5cclxuXHRcdGN0cmwuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0Jywgb25JbnB1dCApO1xyXG5cdFx0Y3RybC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgb25DaGFuZ2UgKTtcclxuXHJcblx0XHRyb3cuYXBwZW5kQ2hpbGQoIGxhYmVsICk7XHJcblx0XHRyb3cuYXBwZW5kQ2hpbGQoIGlucHV0V3JhcCApO1xyXG5cdFx0cmV0dXJuIHJvdztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBhIGZvcm0gY29udHJvbCBlbGVtZW50IGZvciBhIGdpdmVuIHNjaGVtYSBkZWZpbml0aW9uIGFuZCB2YWx1ZS5cclxuXHQgKlxyXG5cdCAqIEBwcml2YXRlXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGRlZiAtIFNjaGVtYSBjb250cm9sIGRlZmluaXRpb24gKGB0eXBlYCwgYG9wdGlvbnNgLCBwbGFjZWhvbGRlcnMsIGV0Yy4pLlxyXG5cdCAqIEBwYXJhbSB7Kn0gdmFsdWUgLSBDdXJyZW50IHZhbHVlIHRvIHBvcHVsYXRlIGludG8gdGhlIGNvbnRyb2wuXHJcblx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fSBUaGUgY3JlYXRlZCBpbnB1dC9zZWxlY3QvdGV4dGFyZWEgZWxlbWVudC5cclxuXHQgKi9cclxuXHRfbWFrZV9jb250cm9sKGRlZiwgdmFsdWUpIHtcclxuXHRcdGNvbnN0IGNvbW1vbkF0dHIgPSAoZWwpID0+IHtcclxuXHRcdFx0aWYgKCBkZWYucGxhY2Vob2xkZXIgKSBlbC5wbGFjZWhvbGRlciA9IGRlZi5wbGFjZWhvbGRlcjtcclxuXHRcdFx0aWYgKCBkZWYubWluICE9IG51bGwgKSBlbC5taW4gPSBkZWYubWluO1xyXG5cdFx0XHRpZiAoIGRlZi5tYXggIT0gbnVsbCApIGVsLm1heCA9IGRlZi5tYXg7XHJcblx0XHRcdGlmICggZGVmLnN0ZXAgIT0gbnVsbCApIGVsLnN0ZXAgPSBkZWYuc3RlcDtcclxuXHRcdFx0ZWwuYXV0b2NvbXBsZXRlID0gJ29mZic7XHJcblx0XHRcdGVsLmNsYXNzTmFtZSAgICA9ICdpbnNwZWN0b3JfX2lucHV0JztcclxuXHRcdFx0cmV0dXJuIGVsO1xyXG5cdFx0fTtcclxuXHJcblx0XHRzd2l0Y2ggKCBkZWYudHlwZSApIHtcclxuXHRcdFx0Y2FzZSAndGV4dCc6IHtcclxuXHRcdFx0XHRjb25zdCBpID0gY29tbW9uQXR0ciggZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2lucHV0JyApICk7XHJcblx0XHRcdFx0aS50eXBlICA9ICd0ZXh0JztcclxuXHRcdFx0XHRpLnZhbHVlID0gdmFsdWUgPz8gJyc7XHJcblx0XHRcdFx0cmV0dXJuIGk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAnbnVtYmVyJzoge1xyXG5cdFx0XHRcdGNvbnN0IGkgPSBjb21tb25BdHRyKCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnaW5wdXQnICkgKTtcclxuXHRcdFx0XHRpLnR5cGUgID0gJ251bWJlcic7XHJcblx0XHRcdFx0aS52YWx1ZSA9ICh2YWx1ZSA/PyAnJykgPT09ICcnID8gJycgOiBTdHJpbmcoIHZhbHVlICk7XHJcblx0XHRcdFx0cmV0dXJuIGk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAnY2hlY2tib3gnOiB7XHJcblx0XHRcdFx0Y29uc3QgaSAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnaW5wdXQnICk7XHJcblx0XHRcdFx0aS50eXBlICAgICAgPSAnY2hlY2tib3gnO1xyXG5cdFx0XHRcdGkuY2xhc3NOYW1lID0gJ2luc3BlY3Rvcl9fY2hlY2tib3gnO1xyXG5cdFx0XHRcdGkuY2hlY2tlZCAgID0gKHZhbHVlID09PSB0cnVlIHx8IHZhbHVlID09PSAndHJ1ZScgfHwgdmFsdWUgPT09IDEgfHwgdmFsdWUgPT09ICcxJyk7XHJcblx0XHRcdFx0cmV0dXJuIGk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAndGV4dGFyZWEnOiB7XHJcblx0XHRcdFx0Y29uc3QgdCAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAndGV4dGFyZWEnICk7XHJcblx0XHRcdFx0dC5jbGFzc05hbWUgPSAnaW5zcGVjdG9yX190ZXh0YXJlYSc7XHJcblx0XHRcdFx0dC5yb3dzICAgICAgPSAzO1xyXG5cdFx0XHRcdHQudmFsdWUgICAgID0gdmFsdWUgPz8gJyc7XHJcblx0XHRcdFx0cmV0dXJuIHQ7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAnc2VsZWN0Jzoge1xyXG5cdFx0XHRcdGNvbnN0IHMgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NlbGVjdCcgKTtcclxuXHRcdFx0XHRzLmNsYXNzTmFtZSA9ICdpbnNwZWN0b3JfX3NlbGVjdCc7XHJcblx0XHRcdFx0KGRlZi5vcHRpb25zIHx8IFtdKS5mb3JFYWNoKCBvcHQgPT4ge1xyXG5cdFx0XHRcdFx0Y29uc3QgbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdvcHRpb24nICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBvcHQgPT09ICdzdHJpbmcnICkge1xyXG5cdFx0XHRcdFx0XHRvLnZhbHVlICAgICAgID0gb3B0O1xyXG5cdFx0XHRcdFx0XHRvLnRleHRDb250ZW50ID0gb3B0O1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0by52YWx1ZSAgICAgICA9IG9wdC52YWx1ZTtcclxuXHRcdFx0XHRcdFx0by50ZXh0Q29udGVudCA9IG9wdC5sYWJlbCA/PyBvcHQudmFsdWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIFN0cmluZyggby52YWx1ZSApID09PSBTdHJpbmcoIHZhbHVlID8/ICcnICkgKSBvLnNlbGVjdGVkID0gdHJ1ZTtcclxuXHRcdFx0XHRcdHMuYXBwZW5kQ2hpbGQoIG8gKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0cmV0dXJuIHM7XHJcblx0XHRcdH1cclxuXHRcdFx0ZGVmYXVsdDoge1xyXG5cdFx0XHRcdGNvbnN0IGkgPSBjb21tb25BdHRyKCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnaW5wdXQnICkgKTtcclxuXHRcdFx0XHRpLnR5cGUgID0gJ3RleHQnO1xyXG5cdFx0XHRcdGkudmFsdWUgPSB2YWx1ZSA/PyAnJztcclxuXHRcdFx0XHRyZXR1cm4gaTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVhZCBhbmQgbm9ybWFsaXplIHRoZSBjdXJyZW50IHZhbHVlIGZyb20gYSByZW5kZXJlZCBjb250cm9sLlxyXG5cdCAqXHJcblx0ICogQHByaXZhdGVcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGVmIC0gU2NoZW1hIGNvbnRyb2wgZGVmaW5pdGlvbi5cclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjdHJsIC0gVGhlIGlucHV0L3NlbGVjdC90ZXh0YXJlYSBlbGVtZW50LlxyXG5cdCAqIEByZXR1cm5zIHsqfSBOb3JtYWxpemVkIHZhbHVlIChib29sZWFuIGZvciBjaGVja2JveCwgbnVtYmVyIGZvciBudW1lcmljIGlucHV0cywgc3RyaW5nIG90aGVyd2lzZSkuXHJcblx0ICovXHJcblx0X3JlYWRfY29udHJvbF92YWx1ZShkZWYsIGN0cmwpIHtcclxuXHRcdHN3aXRjaCAoIGRlZi50eXBlICkge1xyXG5cdFx0XHRjYXNlICdjaGVja2JveCc6XHJcblx0XHRcdFx0cmV0dXJuICEhY3RybC5jaGVja2VkO1xyXG5cdFx0XHRjYXNlICdudW1iZXInOlxyXG5cdFx0XHRcdHJldHVybiBjdHJsLnZhbHVlID09PSAnJyA/ICcnIDogTnVtYmVyKCBjdHJsLnZhbHVlICk7XHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0cmV0dXJuIGN0cmwudmFsdWU7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBzY2hlbWEgZGVmYXVsdHMgdG8gYSBkYXRhIG9iamVjdCB3aXRob3V0IG92ZXJ3cml0aW5nIGV4aXN0aW5nIHZhbHVlcy5cclxuXHQgKlxyXG5cdCAqIEBwcml2YXRlXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGEgLSBQYXJzZWQgZGF0YS0qIGF0dHJpYnV0ZXMgZm9yIHRoZSBmaWVsZC5cclxuXHQgKiBAcGFyYW0ge09iamVjdH0gc2NoZW1hIC0gT3B0aW9uIHNjaGVtYSBmb3IgdGhlIGZpZWxkIHR5cGUuXHJcblx0ICogQHJldHVybnMge09iamVjdH0gQSBuZXcgb2JqZWN0IHdpdGggZGVmYXVsdHMgYXBwbGllZC5cclxuXHQgKi9cclxuXHRfd2l0aF9kZWZhdWx0cyhkYXRhLCBzY2hlbWEpIHtcclxuXHRcdGNvbnN0IG91dCA9IHsgLi4uZGF0YSB9O1xyXG5cdFx0KHNjaGVtYS5ncm91cHMgfHwgW10pLmZvckVhY2goIGcgPT4gKGcuZmllbGRzIHx8IFtdKS5mb3JFYWNoKCBmID0+IHtcclxuXHRcdFx0Y29uc3QgbWFwS2V5ID0gKHNjaGVtYS5kYXRhTWFwIHx8IHt9KVtmLmtleV0gfHwgZi5rZXk7XHJcblx0XHRcdGlmICggb3V0W21hcEtleV0gPT0gbnVsbCAmJiBmLmRlZmF1bHQgIT09IHVuZGVmaW5lZCApIG91dFttYXBLZXldID0gZi5kZWZhdWx0O1xyXG5cdFx0fSApICk7XHJcblx0XHQvLyBFbnN1cmUgdHlwZSBpcyBwcmVzZW50XHJcblx0XHRpZiAoICFvdXQudHlwZSApIG91dC50eXBlID0gJ3RleHQnO1xyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENyZWF0ZSBhIGZhbGxiYWNrIGluc3BlY3RvciBwYW5lbCB3aGVuIG5vbmUgZXhpc3RzIGluIHRoZSBET00uXHJcblx0ICpcclxuXHQgKiBAcHJpdmF0ZVxyXG5cdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gVGhlIGNyZWF0ZWQgcGFuZWwgZWxlbWVudCBhcHBlbmRlZCB0byA8Ym9keT4uXHJcblx0ICovXHJcblx0X2NyZWF0ZV9mYWxsYmFja19wYW5lbCgpIHtcclxuXHRcdGNvbnN0IHAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdHAuaWQgICAgICAgID0gJ3dwYmNfYmZiX19pbnNwZWN0b3InO1xyXG5cdFx0cC5jbGFzc05hbWUgPSAnd3BiY19iZmJfX2luc3BlY3Rvcic7XHJcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBwICk7XHJcblx0XHRyZXR1cm4gcDtcclxuXHR9XHJcblxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogUmVuZGVyIHRoZSBJbnNwZWN0b3IgcGFuZWwgZm9yIGEgc2VjdGlvbjogY29sdW1ucyBjb250cm9sICgrIGRlc2VsZWN0KS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWwgLSBUaGUgc2VsZWN0ZWQgLndwYmNfYmZiX19zZWN0aW9uIGVsZW1lbnQuXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0X3JlbmRlcl9zZWN0aW9uX3BhbmVsKHNlY3Rpb25fZWwpIHtcclxuXHRcdC8vIEN1cnJlbnQgY29sdW1uIGNvdW50LlxyXG5cdFx0Y29uc3Qgcm93ICAgICAgID0gc2VjdGlvbl9lbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gLndwYmNfYmZiX19yb3cnICk7XHJcblx0XHRjb25zdCBjb2xfY291bnQgPSByb3cgPyByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uJyApLmxlbmd0aCA6IDE7XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEhlYWRlclxyXG5cdFx0Y29uc3QgaGVhZCAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0aGVhZC5jbGFzc05hbWUgPSAnd3BiY19iZmJfX2luc3BlY3Rvcl9faGVhZCc7XHJcblx0XHRoZWFkLmlubmVySFRNTCA9IGBcclxuXHRcdFx0XHRcdFx0XHQ8ZGl2PlxyXG5cdFx0XHRcdFx0XHRcdFx0PGgzIGNsYXNzPVwidGl0bGVcIj5TZWN0aW9uPC9oMz5cclxuXHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJkZXNjXCI+Q29uZmlndXJlIGxheW91dCBmb3IgdGhpcyBzZWN0aW9uLjwvZGl2PlxyXG5cdFx0XHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJhY3Rpb25zIHdwYmNfYWp4X3Rvb2xiYXIgd3BiY19ub19ib3JkZXJzXCI+XHJcblx0XHRcdFx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwidWlfY29udGFpbmVyIHVpX2NvbnRhaW5lcl9zbWFsbFwiPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHQ8ZGl2IGNsYXNzPVwidWlfZ3JvdXAgXCI+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0PGRpdiBjbGFzcz1cInVpX2VsZW1lbnRcIj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYnV0dG9uIGJ1dHRvbi1zZWNvbmRhcnkgd3BiY191aV9jb250cm9sIHdwYmNfdWlfYnV0dG9uIHRvb2x0aXBfdG9wXCIgZGF0YS1hY3Rpb249XCJkZXNlbGVjdFwiIGFyaWEtbGFiZWw9XCJEZXNlbGVjdFwiPjxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fcmVtb3ZlX2RvbmVcIj48L2k+PC9idXR0b24+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0PC9kaXY+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0PGRpdiBjbGFzcz1cInVpX2VsZW1lbnRcIj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYnV0dG9uIGJ1dHRvbi1zZWNvbmRhcnkgd3BiY191aV9jb250cm9sIHdwYmNfdWlfYnV0dG9uIHRvb2x0aXBfdG9wXCIgZGF0YS1hY3Rpb249XCJzY3JvbGx0b1wiIGFyaWEtbGFiZWw9XCJTY3JvbGwgdG8gc2VjdGlvbiBpbiBjYW52YXNcIj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9hZHNfY2xpY2sgZmlsdGVyX2NlbnRlcl9mb2N1c1wiPjwvaT5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDwvYnV0dG9uPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJ1aV9lbGVtZW50XCI+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ1dHRvbiBidXR0b24tc2Vjb25kYXJ5IHdwYmNfdWlfY29udHJvbCB3cGJjX3VpX2J1dHRvbiB0b29sdGlwX3RvcFwiIGRhdGEtYWN0aW9uPVwibW92ZS11cFwiIGFyaWEtbGFiZWw9XCJNb3ZlIHNlY3Rpb24gdXBcIj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9hcnJvd191cHdhcmRcIj48L2k+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ8L2J1dHRvbj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYnV0dG9uIGJ1dHRvbi1zZWNvbmRhcnkgd3BiY191aV9jb250cm9sIHdwYmNfdWlfYnV0dG9uIHRvb2x0aXBfdG9wXCIgZGF0YS1hY3Rpb249XCJtb3ZlLWRvd25cIiBhcmlhLWxhYmVsPVwiTW92ZSBzZWN0aW9uIGRvd25cIj5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9hcnJvd19kb3dud2FyZFwiPjwvaT5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdDwvYnV0dG9uPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDxkaXYgY2xhc3M9XCJ1aV9lbGVtZW50XCI+XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ1dHRvbiBidXR0b24tc2Vjb25kYXJ5IHdwYmNfdWlfY29udHJvbCB3cGJjX3VpX2J1dHRvbiB3cGJjX3VpX2J1dHRvbl9kYW5nZXIgdG9vbHRpcF90b3AgYnV0dG9uLWxpbmstZGVsZXRlXCIgZGF0YS1hY3Rpb249XCJkZWxldGVcIiBhcmlhLWxhYmVsPVwiRGVsZXRlXCI+PHNwYW4gY2xhc3M9XCJpbi1idXR0b24tdGV4dFwiPkRlbGV0ZSZuYnNwOyZuYnNwOzwvc3Bhbj48aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RlbGV0ZV9vdXRsaW5lXCI+PC9pPjwvYnV0dG9uPlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0XHRcdFx0XHQ8L2Rpdj5cclxuXHRcdFx0XHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0XHRcdDwvZGl2Plx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdGA7XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRGVzZWxlY3QgYWN0aW9uLlxyXG5cdFx0aGVhZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtYWN0aW9uPVwiZGVzZWxlY3RcIl0nICkub25jbGljayA9ICgpID0+IHsgdGhpcy5idWlsZGVyPy5zZWxlY3RfZmllbGQ/LiggbnVsbCApOyB9O1xyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBTY3JvbGwgdG8gc2VsZWN0ZWQgc2VjdGlvbiBpbiBjYW52YXMuXHJcblx0XHRjb25zdCBzY3JvbGxCdG5TID0gaGVhZC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtYWN0aW9uPVwic2Nyb2xsdG9cIl0nICk7XHJcblx0XHRpZiAoIHNjcm9sbEJ0blMgKSB7XHJcblx0XHRcdHNjcm9sbEJ0blMub25jbGljayA9IChlKSA9PiB7XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGNvbnN0IGVsID0gdGhpcy5zZWxlY3RlZF9lbDtcclxuXHRcdFx0XHRpZiAoICEgZWwgfHwgISBkb2N1bWVudC5ib2R5LmNvbnRhaW5zKCBlbCApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXI/LnNlbGVjdF9maWVsZD8uKCBlbCwgeyBzY3JvbGxJbnRvVmlldzogdHJ1ZSB9ICk7XHJcblx0XHRcdFx0ZWwuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19zY3JvbGwtcHVsc2UnICk7XHJcblx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4gZWwuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYmZiX19zY3JvbGwtcHVsc2UnICksIDcwMCApO1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBNb3ZlIHVwIC8gZG93biAoc2VjdGlvbikuXHJcblx0XHRjb25zdCB1cEJ0biA9IGhlYWQucXVlcnlTZWxlY3RvciggJ1tkYXRhLWFjdGlvbj1cIm1vdmUtdXBcIl0nICk7XHJcblx0XHRpZiAoIHVwQnRuICkge1xyXG5cdFx0XHR1cEJ0bi5vbmNsaWNrID0gKGUpID0+IHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyPy5tb3ZlX2l0ZW0/Liggc2VjdGlvbl9lbCwgJ3VwJyApO1xyXG5cdFx0XHRcdC8vIGtlZXAgZm9jdXMgb24gaW5zcGVjdG9yOyByZXNlbGVjdCB0byBlbnN1cmUgYmluZGluZyByZW1haW5zLlxyXG5cdFx0XHRcdHRoaXMuYnVpbGRlcj8uc2VsZWN0X2ZpZWxkPy4oIHNlY3Rpb25fZWwsIHsgc2Nyb2xsSW50b1ZpZXc6IGZhbHNlIH0gKTtcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHRcdGNvbnN0IGRvd25CdG4gPSBoZWFkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1hY3Rpb249XCJtb3ZlLWRvd25cIl0nICk7XHJcblx0XHRpZiAoIGRvd25CdG4gKSB7XHJcblx0XHRcdGRvd25CdG4ub25jbGljayA9IChlKSA9PiB7XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdHRoaXMuYnVpbGRlcj8ubW92ZV9pdGVtPy4oIHNlY3Rpb25fZWwsICdkb3duJyApO1xyXG5cdFx0XHRcdC8vIGtlZXAgZm9jdXMgb24gaW5zcGVjdG9yOyByZXNlbGVjdCB0byBlbnN1cmUgYmluZGluZyByZW1haW5zLlxyXG5cdFx0XHRcdHRoaXMuYnVpbGRlcj8uc2VsZWN0X2ZpZWxkPy4oIHNlY3Rpb25fZWwsIHsgc2Nyb2xsSW50b1ZpZXc6IGZhbHNlIH0gKTtcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRGVsZXRlIChzZWN0aW9uKS5cclxuXHRcdGNvbnN0IGRlbEJ0biA9IGhlYWQucXVlcnlTZWxlY3RvciggJ1tkYXRhLWFjdGlvbj1cImRlbGV0ZVwiXScgKTtcclxuXHRcdGlmICggZGVsQnRuICkge1xyXG5cdFx0XHRkZWxCdG4ub25jbGljayA9ICgpID0+IHtcclxuXHRcdFx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLnNlbGVjdGVkX2VsO1xyXG5cdFx0XHRcdGlmICggISB0YXJnZXQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIE9wdGlvbmFsOiBjb25maXJtYXRpb24gKGNsYXJpZnkgaXQgcmVtb3ZlcyBuZXN0ZWQgY29udGVudCB0b28pLlxyXG5cdFx0XHRcdGNvbnN0IGxhYmVsID0gdGFyZ2V0LmRhdGFzZXQ/LmlkIHx8ICdzZWN0aW9uJztcclxuXHRcdFx0XHRpZiAoICEgd2luZG93LmNvbmZpcm0oIGBEZWxldGUgJHtsYWJlbH0gYW5kIGFsbCBpdHMgY29udGVudHM/IFRoaXMgY2Fubm90IGJlIHVuZG9uZS5gICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMuYnVpbGRlcj8uZGVsZXRlX2l0ZW0/LiggdGFyZ2V0ICk7XHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEJvZHkuXHJcblx0XHRjb25zdCBib2R5ICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRib2R5LmNsYXNzTmFtZSA9ICd3cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JztcclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gQSBzaW5nbGUgZ3JvdXA6IExheW91dC5cclxuXHRcdGNvbnN0IHdyYXAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NlY3Rpb24nICk7XHJcblx0XHR3cmFwLmNsYXNzTmFtZSA9ICd3cGJjX2JmYl9faW5zcGVjdG9yX19ncm91cCBpcy1vcGVuJztcclxuXHJcblx0XHRjb25zdCBoICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdidXR0b24nICk7XHJcblx0XHRoLnR5cGUgICAgICA9ICdidXR0b24nO1xyXG5cdFx0aC5jbGFzc05hbWUgPSAnZ3JvdXBfX2hlYWRlcic7XHJcblx0XHRoLmlubmVySFRNTCA9IGA8c3Bhbj5MYXlvdXQ8L3NwYW4+PGkgY2xhc3M9XCJkYXNoaWNvbnMgZGFzaGljb25zLWFycm93LXVwXCI+PC9pPmA7XHJcblx0XHRoLm9uY2xpY2sgICA9ICgpID0+IHtcclxuXHRcdFx0d3JhcC5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtb3BlbicgKTtcclxuXHRcdFx0Y29uc3QgaSA9IGgucXVlcnlTZWxlY3RvciggJ2knICk7XHJcblx0XHRcdGlmICggaSApIGkuY2xhc3NOYW1lID0gYGRhc2hpY29ucyBkYXNoaWNvbnMtYXJyb3ctJHt3cmFwLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nICkgPyAndXAnIDogJ2Rvd24nfWA7XHJcblx0XHR9O1xyXG5cdFx0d3JhcC5hcHBlbmRDaGlsZCggaCApO1xyXG5cclxuXHRcdGNvbnN0IGZpZWxkc1dyYXAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdGZpZWxkc1dyYXAuY2xhc3NOYW1lID0gJ2dyb3VwX19maWVsZHMnO1xyXG5cclxuXHRcdC8vIENvbHVtbnMgY29udHJvbCAobnVtYmVyIGlucHV0KVxyXG5cdFx0Y29uc3Qgcm93RWwgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdHJvd0VsLmNsYXNzTmFtZSA9ICdpbnNwZWN0b3JfX3Jvdyc7XHJcblxyXG5cdFx0Y29uc3QgbGFiZWwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRsYWJlbC5jbGFzc05hbWUgICA9ICdpbnNwZWN0b3JfX2xhYmVsJztcclxuXHRcdGxhYmVsLnRleHRDb250ZW50ID0gJ0NvbHVtbnMnO1xyXG5cclxuXHRcdGNvbnN0IGN0cmxXcmFwICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRjdHJsV3JhcC5jbGFzc05hbWUgPSAnaW5zcGVjdG9yX19jb250cm9sJztcclxuXHJcblx0XHQvLyBDb2x1bW5zIGNvbnRyb2wgKG51bWJlciBpbnB1dCkg4oCUIGFwcGx5IG9uIGVhY2ggdmFsaWQga2V5c3Ryb2tlIGFuZCBrZWVwIFVJIGluIHN5bmMuXHJcblx0XHRjb25zdCBpbnB1dCAgICAgICAgICAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdpbnB1dCcgKTtcclxuXHRcdGlucHV0LnR5cGUgICAgICAgICAgICAgICAgID0gJ251bWJlcic7XHJcblx0XHRpbnB1dC5jbGFzc05hbWUgICAgICAgICAgICA9ICdpbnNwZWN0b3JfX2lucHV0JztcclxuXHRcdGlucHV0Lm1pbiAgICAgICAgICAgICAgICAgID0gJzEnO1xyXG5cdFx0aW5wdXQubWF4ICAgICAgICAgICAgICAgICAgPSAnNCc7XHJcblx0XHRpbnB1dC5zdGVwICAgICAgICAgICAgICAgICA9ICcxJztcclxuXHRcdGlucHV0LnZhbHVlICAgICAgICAgICAgICAgID0gU3RyaW5nKCBNYXRoLm1heCggMSwgTWF0aC5taW4oIDQsIGNvbF9jb3VudCApICkgKTtcclxuXHRcdGlucHV0LmRhdGFzZXQuaW5zcGVjdG9yS2V5ID0gJ2NvbHVtbnMnO1xyXG5cclxuXHRcdGxldCBsYXN0X2FwcGxpZWQgPSBwYXJzZUludCggaW5wdXQudmFsdWUsIDEwICk7XHJcblxyXG5cdFx0Ly8gQ29tbWl0IGhlbHBlcjogYXBwbHkgaW1tZWRpYXRlbHkgaWYgdmFsdWUgaXMgdmFsaWQ7IGNvZXJjZSB0byBib3VuZHMuXHJcblx0XHRjb25zdCBjb21taXQgPSAocmF3KSA9PiB7XHJcblx0XHRcdGNvbnN0IHYgPSBwYXJzZUludCggcmF3LCAxMCApO1xyXG5cdFx0XHRpZiAoICEgTnVtYmVyLmlzRmluaXRlKCB2ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGNsYW1wZWQgPSB3aW5kb3cuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5jbGFtcCggdiwgMSwgNCApO1xyXG5cdFx0XHRpZiAoIGNsYW1wZWQgIT09IGxhc3RfYXBwbGllZCApIHtcclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXI/LnNldF9zZWN0aW9uX2NvbHVtbnM/Liggc2VjdGlvbl9lbCwgY2xhbXBlZCApO1xyXG5cdFx0XHRcdGxhc3RfYXBwbGllZCA9IGNsYW1wZWQ7XHJcblx0XHRcdFx0aWYgKCBTdHJpbmcoIGNsYW1wZWQgKSAhPT0gaW5wdXQudmFsdWUgKSB7XHJcblx0XHRcdFx0XHRpbnB1dC52YWx1ZSA9IFN0cmluZyggY2xhbXBlZCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBSZS1yZW5kZXIgaW1tZWRpYXRlbHkgc28gbGF5b3V0IGNoaXBzIHJlZmxlY3QgdGhlIG5ldyBjb3VudCxcclxuXHRcdFx0XHQvLyB3aGlsZSBwcmVzZXJ2aW5nIGZvY3VzL2NhcmV0LlxyXG5cdFx0XHRcdHRoaXMuX3NjaGVkdWxlX3JlbmRlcl9wcmVzZXJ2aW5nX2ZvY3VzKCAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIEFwcGx5IGFzIHlvdSB0eXBlIGlmIGN1cnJlbnQgdGV4dCBwYXJzZXMgdG8gYSBudW1iZXIgKG5vIHByZS1hcHBseSBkZWJvdW5jZSkuXHJcblx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCAoKSA9PiB7IGNvbW1pdCggaW5wdXQudmFsdWUgKTsgfSApO1xyXG5cdFx0Ly8gT24gY29tbWl0L2JsdXIsIGFsd2F5cyBjb2VyY2UgdG8gYSB2YWxpZCB2YWx1ZS5cclxuXHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCAoKSA9PiB7XHJcblx0XHRcdGlmICggISBjb21taXQoIGlucHV0LnZhbHVlICkgKSB7XHJcblx0XHRcdFx0aW5wdXQudmFsdWUgPSBTdHJpbmcoIGxhc3RfYXBwbGllZCApO1xyXG5cdFx0XHRcdHRoaXMuX3NjaGVkdWxlX3JlbmRlcl9wcmVzZXJ2aW5nX2ZvY3VzKCAwICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoICdibHVyJywgKCkgPT4ge1xyXG5cdFx0XHRpZiAoICEgY29tbWl0KCBpbnB1dC52YWx1ZSApICkge1xyXG5cdFx0XHRcdGlucHV0LnZhbHVlID0gU3RyaW5nKCBsYXN0X2FwcGxpZWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdFx0aW5wdXQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCAoZSkgPT4ge1xyXG5cdFx0XHRpZiAoIGUua2V5ID09PSAnRW50ZXInICkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRjb21taXQoIGlucHV0LnZhbHVlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRjdHJsV3JhcC5hcHBlbmRDaGlsZCggaW5wdXQgKTtcclxuXHRcdHJvd0VsLmFwcGVuZENoaWxkKCBsYWJlbCApO1xyXG5cdFx0cm93RWwuYXBwZW5kQ2hpbGQoIGN0cmxXcmFwICk7XHJcblx0XHRmaWVsZHNXcmFwLmFwcGVuZENoaWxkKCByb3dFbCApO1xyXG5cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdC8vIExBWU9VVCBDSElQUyBST1cuXHJcblx0XHRjb25zdCBsYXlvdXRfcm93ICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRsYXlvdXRfcm93LmNsYXNzTmFtZSA9ICdpbnNwZWN0b3JfX3JvdyBpbnNwZWN0b3JfX3Jvdy0tbGF5b3V0LWNoaXBzJztcclxuXHJcblx0XHRjb25zdCBsYXlvdXRfbGFiZWwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRsYXlvdXRfbGFiZWwuY2xhc3NOYW1lICAgPSAnaW5zcGVjdG9yX19sYWJlbCc7XHJcblx0XHRsYXlvdXRfbGFiZWwudGV4dENvbnRlbnQgPSAnTGF5b3V0JztcclxuXHJcblx0XHRjb25zdCBsYXlvdXRfY3RybCAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0bGF5b3V0X2N0cmwuY2xhc3NOYW1lID0gJ2luc3BlY3Rvcl9fY29udHJvbCB3cGJjX2JmYl9fbGF5b3V0X2NoaXBzJztcclxuXHJcblx0XHQvLyBSRVVTRSB0aGUgc2hhcmVkIGhlbHBlcjouXHJcblx0XHR3aW5kb3cuV1BCQ19CRkJfVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLnJlbmRlcl9mb3Jfc2VjdGlvbiggdGhpcy5idWlsZGVyLCBzZWN0aW9uX2VsLCBsYXlvdXRfY3RybCApO1xyXG5cclxuXHRcdGxheW91dF9yb3cuYXBwZW5kQ2hpbGQoIGxheW91dF9sYWJlbCApO1xyXG5cdFx0bGF5b3V0X3Jvdy5hcHBlbmRDaGlsZCggbGF5b3V0X2N0cmwgKTtcclxuXHRcdGZpZWxkc1dyYXAuYXBwZW5kQ2hpbGQoIGxheW91dF9yb3cgKTtcclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0d3JhcC5hcHBlbmRDaGlsZCggZmllbGRzV3JhcCApO1xyXG5cdFx0Ym9keS5hcHBlbmRDaGlsZCggd3JhcCApO1xyXG5cclxuXHRcdC8vIENvbW1pdC5cclxuXHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gJyc7XHJcblx0XHR0aGlzLnBhbmVsLmFwcGVuZENoaWxkKCBoZWFkICk7XHJcblx0XHR0aGlzLnBhbmVsLmFwcGVuZENoaWxkKCBib2R5ICk7XHJcblx0XHR0aGlzLl9pbml0aWFsX3JlbmRlciA9IGZhbHNlO1xyXG5cdH1cclxuXHJcbn1cclxuLy8gRXhwb3NlIHRoZSBjb25zdHJ1Y3RvciBmb3IgdGhlIGJ1aWxkZXIgYnJpZGdlLlxyXG53aW5kb3cuV1BCQ19CRkJfSW5zcGVjdG9yID0gV1BCQ19CRkJfSW5zcGVjdG9yO1xyXG5cclxuLy8gVGVsbCB0aGUgYnVpbGRlciB0aGF0IHRoZSBJbnNwZWN0b3IgY2xhc3MgaXMgcmVhZHkuXHJcbmRvY3VtZW50LmRpc3BhdGNoRXZl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
