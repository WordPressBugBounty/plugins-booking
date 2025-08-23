"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/bfb-ui-modules.iife.js == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
  'use strict';

  const {
    WPBC_BFB_DOM,
    WPBC_Form_Builder_Helper,
    WPBC_BFB_Events,
    WPBC_BFB_Sanitize
  } = w.WPBC_BFB_Core;
  const UI = {};

  /**
   * Base class for BFB modules.
   */
  UI.WPBC_BFB_Module = class {
    /** @param {WPBC_Form_Builder} builder */
    constructor(builder) {
      this.builder = builder;
    }

    /** Initialize the module. */
    init() {}

    /** Cleanup the module. */
    destroy() {}
  };

  /**
   * Central overlay/controls manager for fields/sections.
   * Pure UI composition; all actions route back into the builder instance.
   */
  UI.WPBC_BFB_Overlay = class {
    /**
     * Ensure an overlay exists and is wired up on the element.
     * @param {WPBC_Form_Builder} builder
     * @param {HTMLElement} el - field or section element
     */
    static ensure(builder, el) {
      if (!el) {
        return;
      }
      const isSection = el.classList.contains('wpbc_bfb__section');
      let overlay = el.querySelector(WPBC_BFB_DOM.SELECTORS.overlay);
      if (!overlay) {
        overlay = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__overlay-controls');
        el.prepend(overlay);
      }

      // Drag handle.
      if (!overlay.querySelector('.wpbc_bfb__drag-handle')) {
        const dragClass = isSection ? 'wpbc_bfb__drag-handle section-drag-handle' : 'wpbc_bfb__drag-handle';
        overlay.appendChild(WPBC_Form_Builder_Helper.create_element('span', dragClass, '<span class="wpbc_icn_drag_indicator"></span>'));
      }

      // SETTINGS button (shown for both fields & sections).
      if (!overlay.querySelector('.wpbc_bfb__settings-btn')) {
        const settings_btn = WPBC_Form_Builder_Helper.create_element('button', 'wpbc_bfb__settings-btn', '<i class="menu_icon icon-1x wpbc_icn_settings"></i>');
        settings_btn.type = 'button';
        settings_btn.title = 'Open settings';
        settings_btn.onclick = e => {
          e.preventDefault();
          // Select THIS element and scroll it into view.
          builder.select_field(el, {
            scrollIntoView: true
          });

          // Try to bring the inspector into view / focus first input.
          const ins = document.getElementById('wpbc_bfb__inspector');
          if (ins) {
            ins.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest'
            });
            // Focus first interactive control (best-effort).
            setTimeout(() => {
              const focusable = ins.querySelector('input,select,textarea,button,[contenteditable],[tabindex]:not([tabindex="-1"])');
              focusable?.focus?.();
            }, 260);
          }
        };
        overlay.appendChild(settings_btn);
      }
      overlay.setAttribute('role', 'toolbar');
      overlay.setAttribute('aria-label', el.classList.contains('wpbc_bfb__section') ? 'Section tools' : 'Field tools');
      return overlay;
    }
  };

  /**
   * WPBC Layout Chips helper - visual layout picker (chips), e.g., "50%/50%", to a section overlay.
   *
   * Renders Equal/Presets/Custom chips into a host container and wires them to apply the layout.
   */
  UI.WPBC_BFB_Layout_Chips = class {
    /** Read per-column min (px) from CSS var set by the guard. */
    static _get_col_min_px(col) {
      const v = getComputedStyle(col).getPropertyValue('--wpbc-col-min') || '0';
      const n = parseFloat(v);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /**
     * Turn raw weights (e.g. [1,1], [2,1,1]) into effective "available-%" bases that
     * (a) sum to the row's available %, and (b) meet every column's min px.
     * Returns an array of bases (numbers) or null if impossible to satisfy mins.
     */
    static _fit_weights_respecting_min(builder, row, weights) {
      const cols = Array.from(row.querySelectorAll(':scope > .wpbc_bfb__column'));
      const n = cols.length;
      if (!n) return null;
      if (!Array.isArray(weights) || weights.length !== n) return null;

      // available % after gaps (from LayoutService)
      const gp = builder.col_gap_percent;
      const eff = builder.layout.compute_effective_bases_from_row(row, gp);
      const availPct = eff.available; // e.g. 94 if 2 cols and 3% gap
      const rowPx = row.getBoundingClientRect().width;
      const availPx = rowPx * (availPct / 100);

      // collect minima in % of "available"
      const minPct = cols.map(c => {
        const minPx = UI.WPBC_BFB_Layout_Chips._get_col_min_px(c);
        if (availPx <= 0) return 0;
        return minPx / availPx * availPct;
      });

      // If mins alone don't fit, bail.
      const sumMin = minPct.reduce((a, b) => a + b, 0);
      if (sumMin > availPct - 1e-6) {
        return null; // impossible to respect mins; don't apply preset
      }

      // Target percentages from weights, normalized to availPct.
      const wSum = weights.reduce((a, w) => a + (Number(w) || 0), 0) || n;
      const targetPct = weights.map(w => (Number(w) || 0) / wSum * availPct);

      // Lock columns that would be below min, then distribute the remainder
      // across the remaining columns proportionally to their targetPct.
      const locked = new Array(n).fill(false);
      let lockedSum = 0;
      for (let i = 0; i < n; i++) {
        if (targetPct[i] < minPct[i]) {
          locked[i] = true;
          lockedSum += minPct[i];
        }
      }
      let remaining = availPct - lockedSum;
      const freeIdx = [];
      let freeTargetSum = 0;
      for (let i = 0; i < n; i++) {
        if (!locked[i]) {
          freeIdx.push(i);
          freeTargetSum += targetPct[i];
        }
      }
      const result = new Array(n).fill(0);
      // Seed locked with their minima.
      for (let i = 0; i < n; i++) {
        if (locked[i]) result[i] = minPct[i];
      }
      if (freeIdx.length === 0) {
        // everything locked exactly at min; any leftover (shouldn't happen)
        // would be ignored to keep simplicity and stability.
        return result;
      }
      if (remaining <= 0) {
        // nothing left to distribute; keep exactly mins on locked,
        // nothing for free (degenerate but consistent)
        return result;
      }
      if (freeTargetSum <= 0) {
        // distribute equally among free columns
        const each = remaining / freeIdx.length;
        freeIdx.forEach(i => result[i] = each);
        return result;
      }

      // Distribute remaining proportionally to free columns' targetPct
      freeIdx.forEach(i => {
        result[i] = remaining * (targetPct[i] / freeTargetSum);
      });
      return result;
    }

    /** Apply a preset but guard it by minima; returns true if applied, false if skipped. */
    static _apply_preset_with_min_guard(builder, section_el, weights) {
      const row = section_el.querySelector(':scope > .wpbc_bfb__row');
      if (!row) return false;
      const fitted = UI.WPBC_BFB_Layout_Chips._fit_weights_respecting_min(builder, row, weights);
      if (!fitted) {
        builder?._announce?.('Not enough space for this layout because of fields’ minimum widths.');
        return false;
      }

      // `fitted` already sums to the row’s available %, so we can apply bases directly.
      builder.layout.apply_bases_to_row(row, fitted);
      return true;
    }

    /**
     * Build and append layout chips for a section.
     *
     * @param {WPBC_Form_Builder} builder - The form builder instance.
     * @param {HTMLElement} section_el - The .wpbc_bfb__section element.
     * @param {HTMLElement} host_el - Container where chips should be rendered.
     * @returns {void}
     */
    static render_for_section(builder, section_el, host_el) {
      if (!builder || !section_el || !host_el) {
        return;
      }
      const row = section_el.querySelector(':scope > .wpbc_bfb__row');
      if (!row) {
        return;
      }
      const cols = row.querySelectorAll(':scope > .wpbc_bfb__column').length || 1;

      // Clear host.
      host_el.innerHTML = '';

      // Equal chip.
      host_el.appendChild(UI.WPBC_BFB_Layout_Chips._make_chip(builder, section_el, Array(cols).fill(1), 'Equal'));

      // Presets based on column count.
      const presets = builder.layout.build_presets_for_columns(cols);
      presets.forEach(weights => {
        host_el.appendChild(UI.WPBC_BFB_Layout_Chips._make_chip(builder, section_el, weights, null));
      });

      // Custom chip.
      const customBtn = document.createElement('button');
      customBtn.type = 'button';
      customBtn.className = 'wpbc_bfb__layout_chip';
      customBtn.textContent = 'Custom…';
      customBtn.title = `Enter ${cols} percentages`;
      customBtn.addEventListener('click', () => {
        const example = cols === 2 ? '50,50' : cols === 3 ? '20,60,20' : '25,25,25,25';
        const text = prompt(`Enter ${cols} percentages (comma or space separated):`, example);
        if (text == null) return;
        const weights = builder.layout.parse_weights(text);
        if (weights.length !== cols) {
          alert(`Please enter exactly ${cols} numbers.`);
          return;
        }
        // OLD:
        // builder.layout.apply_layout_preset( section_el, weights, builder.col_gap_percent );
        // Guarded apply:.
        if (!UI.WPBC_BFB_Layout_Chips._apply_preset_with_min_guard(builder, section_el, weights)) {
          return;
        }
        host_el.querySelectorAll('.wpbc_bfb__layout_chip').forEach(c => c.classList.remove('is-active'));
        customBtn.classList.add('is-active');
      });
      host_el.appendChild(customBtn);
    }

    /**
     * Create a single layout chip button.
     *
     * @private
     * @param {WPBC_Form_Builder} builder
     * @param {HTMLElement} section_el
     * @param {number[]} weights
     * @param {string|null} label
     * @returns {HTMLButtonElement}
     */
    static _make_chip(builder, section_el, weights, label = null) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wpbc_bfb__layout_chip';
      const title = label || builder.layout.format_preset_label(weights);
      btn.title = title;

      // Visual miniature.
      const vis = document.createElement('div');
      vis.className = 'wpbc_bfb__layout_chip-vis';
      const sum = weights.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
      weights.forEach(w => {
        const bar = document.createElement('span');
        bar.style.flex = `0 0 calc( ${((Number(w) || 0) / sum * 100).toFixed(3)}% - 1.5px )`;
        vis.appendChild(bar);
      });
      btn.appendChild(vis);
      const txt = document.createElement('span');
      txt.className = 'wpbc_bfb__layout_chip-label';
      txt.textContent = label || builder.layout.format_preset_label(weights);
      btn.appendChild(txt);
      btn.addEventListener('click', () => {
        // OLD:
        // builder.layout.apply_layout_preset( section_el, weights, builder.col_gap_percent );

        // NEW:
        if (!UI.WPBC_BFB_Layout_Chips._apply_preset_with_min_guard(builder, section_el, weights)) {
          return; // do not toggle active if we didn't change layout
        }
        btn.parentElement?.querySelectorAll('.wpbc_bfb__layout_chip').forEach(c => c.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
      return btn;
    }
  };

  /**
   * Selection controller for fields and announcements.
   */
  UI.WPBC_BFB_Selection_Controller = class extends UI.WPBC_BFB_Module {
    init() {
      this._selected_uid = null;
      this.builder.select_field = this.select_field.bind(this);
      this.builder.get_selected_field = this.get_selected_field.bind(this);
      this._on_clear = this.on_clear.bind(this);
      this.builder.bus.on(WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear);
      // delegated click selection (capture ensures we win before bubbling to containers).
      this._on_canvas_click = this._handle_canvas_click.bind(this);
      this.builder.pages_container.addEventListener('click', this._on_canvas_click, true);
    }
    destroy() {
      this.builder.bus.off(WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear);
      if (this._on_canvas_click) {
        this.builder.pages_container.removeEventListener('click', this._on_canvas_click, true);
        this._on_canvas_click = null;
      }
    }

    /**
     * Delegated canvas click -> select closest field/section (inner beats outer).
     * @private
     * @param {MouseEvent} e
     */
    _handle_canvas_click(e) {
      const root = this.builder.pages_container;
      if (!root) return;

      // Ignore clicks on controls/handles/resizers, etc.
      const IGNORE = ['.wpbc_bfb__overlay-controls', '.wpbc_bfb__layout_picker', '.wpbc_bfb__drag-handle', '.wpbc_bfb__field-remove-btn', '.wpbc_bfb__field-move-up', '.wpbc_bfb__field-move-down', '.wpbc_bfb__column-resizer'].join(',');
      if (e.target.closest(IGNORE)) {
        return; // let those controls do their own thing.
      }

      // Find the closest selectable (field OR section) from the click target.
      const hit = e.target.closest?.(`${WPBC_BFB_DOM.SELECTORS.validField}, ${WPBC_BFB_DOM.SELECTORS.section}`);
      if (!hit || !root.contains(hit)) {
        return; // empty space is handled elsewhere.
      }

      // Select and stop bubbling so outer containers don’t reselect a parent.
      this.select_field(hit);
      e.stopPropagation();
    }

    /**
     * Select a field element or clear selection.
     *
     * @param {HTMLElement|null} field_el
     * @param {{scrollIntoView?: boolean}} [opts = {}]
     */
    select_field(field_el, {
      scrollIntoView = false
    } = {}) {
      const root = this.builder.pages_container;
      // Ignore elements not in the canvas.
      if (field_el && !root.contains(field_el)) {
        field_el = null; // treat as "no selection".
      }
      root.querySelectorAll('.is-selected').forEach(n => {
        n.classList.remove('is-selected');
      });
      if (!field_el) {
        const prev = this._selected_uid || null;
        this._selected_uid = null;
        this.builder.inspector?.clear?.();
        root.classList.remove('has-selection');
        this.builder.bus.emit(WPBC_BFB_Events.CLEAR_SELECTION, {
          prev_uid: prev,
          source: 'builder'
        });
        return;
      }
      field_el.classList.add('is-selected');
      this._selected_uid = field_el.getAttribute('data-uid') || null;
      if (scrollIntoView) {
        field_el.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
      this.builder.inspector?.bind_to_field?.(field_el);
      root.classList.add('has-selection');
      this.builder.bus.emit(WPBC_BFB_Events.SELECT, {
        uid: this._selected_uid,
        el: field_el
      });
      const label = field_el?.querySelector('.wpbc_bfb__field-label')?.textContent || (field_el.classList.contains('wpbc_bfb__section') ? 'section' : '') || field_el?.dataset?.id || 'item';
      this.builder._announce('Selected ' + label + '.');
    }
    /** @returns {HTMLElement|null} */
    get_selected_field() {
      if (!this._selected_uid) {
        return null;
      }
      const esc_attr = WPBC_BFB_Sanitize.esc_attr_value_for_selector(this._selected_uid);
      return this.builder.pages_container.querySelector(`.wpbc_bfb__field[data-uid="${esc_attr}"], .wpbc_bfb__section[data-uid="${esc_attr}"]`);
    }

    /** @param {CustomEvent} ev */
    on_clear(ev) {
      const src = ev?.detail?.source;
      if (src !== 'builder') {
        this.select_field(null);
      }
    }
  };

  /**
   * Bridges the builder with the Inspector and sanitizes id/name edits.
   */
  UI.WPBC_BFB_Inspector_Bridge = class extends UI.WPBC_BFB_Module {
    init() {
      this._attach_inspector();
      this._bind_id_sanitizer();
    }
    _attach_inspector() {
      const b = this.builder;
      const attach = () => {
        if (typeof window.WPBC_BFB_Inspector === 'function') {
          b.inspector = new WPBC_BFB_Inspector(document.getElementById('wpbc_bfb__inspector'), b);
          this._bind_id_sanitizer();
          document.removeEventListener('wpbc_bfb_inspector_ready', attach);
        }
      };
      // Ensure we bind after late ready as well.
      if (typeof window.WPBC_BFB_Inspector === 'function') {
        attach();
      } else {
        b.inspector = {
          bind_to_field() {},
          clear() {}
        };
        document.addEventListener('wpbc_bfb_inspector_ready', attach);
        setTimeout(attach, 0);
      }
    }
    _bind_id_sanitizer() {
      const b = this.builder;
      const ins = document.getElementById('wpbc_bfb__inspector');
      if (!ins) {
        return;
      }
      /** @param {Event} e */
      const handler = e => {
        const t = e.target;
        if (!t || !('value' in t)) {
          return;
        }
        const key = (t.dataset?.inspectorKey || '').toLowerCase();
        if (key !== 'name' && key !== 'html_id' && key !== 'id') {
          return;
        }
        const sel = b.get_selected_field?.();
        if (!sel) {
          return;
        }
        if (key === 'name') {
          const unique = b.id.set_field_name(sel, t.value);
          if (b.preview_mode) {
            b.render_preview(sel);
          }
          if (t.value !== unique) {
            t.value = unique;
          }
          return;
        }
        if (key === 'id') {
          const unique = b.id.set_field_id(sel, t.value);
          if (b.preview_mode) {
            b.render_preview(sel);
          }
          if (t.value !== unique) {
            t.value = unique;
          }
          return;
        }
        if (key === 'html_id') {
          const applied = b.id.set_field_html_id(sel, t.value);
          if (b.preview_mode) {
            b.render_preview(sel);
          }
          if (t.value !== applied) {
            t.value = applied;
          }
          return;
        }
      };
      ins.addEventListener('change', handler, true);
    }
  };

  /**
   * Keyboard shortcuts for selection, deletion, and movement.
   */
  UI.WPBC_BFB_Keyboard_Controller = class extends UI.WPBC_BFB_Module {
    init() {
      this._on_key = this.on_key.bind(this);
      document.addEventListener('keydown', this._on_key, true);
    }
    destroy() {
      document.removeEventListener('keydown', this._on_key, true);
    }
    /** @param {KeyboardEvent} e */
    on_key(e) {
      const b = this.builder;
      const is_typing = this._is_typing_anywhere();
      if (e.key === 'Escape') {
        if (is_typing) {
          return;
        }
        document.dispatchEvent(new CustomEvent(WPBC_BFB_Events.CLEAR_SELECTION, {
          detail: {
            source: 'esc'
          },
          bubbles: true
        }));
        return;
      }
      const selected = b.get_selected_field?.();
      if (!selected || is_typing) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const neighbor = b._find_neighbor_selectable?.(selected);
        selected.remove();
        b.bus.emit(WPBC_BFB_Events.FIELD_REMOVE, {
          id: selected?.dataset?.id,
          uid: selected?.dataset?.uid
        });
        b.usage.update_palette_ui();
        b.select_field(neighbor || null);
        return;
      }
      if ((e.altKey || e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
        e.preventDefault();
        const dir = e.key === 'ArrowUp' ? 'up' : 'down';
        b.move_item?.(selected, dir);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        b.select_field(selected, {
          scrollIntoView: true
        });
      }
    }
    /** @returns {boolean} */
    _is_typing_anywhere() {
      const a = document.activeElement;
      const tag = a?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a?.isContentEditable === true) {
        return true;
      }
      const ins = document.getElementById('wpbc_bfb__inspector');
      return !!(ins && a && ins.contains(a));
    }
  };

  /**
   * Column resize logic for section rows.
   */
  UI.WPBC_BFB_Resize_Controller = class extends UI.WPBC_BFB_Module {
    init() {
      this.builder.init_resize_handler = this.handle_resize.bind(this);
    }

    /**
     * read the CSS var (kept local so it doesn’t depend on the Min-Width module)
     *
     * @param col
     * @returns {number|number}
     * @private
     */
    _get_col_min_px(col) {
      const v = getComputedStyle(col).getPropertyValue('--wpbc-col-min') || '0';
      const n = parseFloat(v);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    /** @param {MouseEvent} e */
    handle_resize(e) {
      const b = this.builder;
      e.preventDefault();
      if (e.button !== 0) return;
      const resizer = e.currentTarget;
      const row_el = resizer.parentElement;
      const cols = Array.from(row_el.querySelectorAll(':scope > .wpbc_bfb__column'));
      const left_col = resizer?.previousElementSibling;
      const right_col = resizer?.nextElementSibling;
      if (!left_col || !right_col || !left_col.classList.contains('wpbc_bfb__column') || !right_col.classList.contains('wpbc_bfb__column')) return;
      const left_index = cols.indexOf(left_col);
      const right_index = cols.indexOf(right_col);
      if (left_index === -1 || right_index !== left_index + 1) return;
      const start_x = e.clientX;
      const left_start_px = left_col.getBoundingClientRect().width;
      const right_start_px = right_col.getBoundingClientRect().width;
      const pair_px = Math.max(0, left_start_px + right_start_px);
      const gp = b.col_gap_percent;
      const computed = b.layout.compute_effective_bases_from_row(row_el, gp);
      const available = computed.available; // % of the “full 100” after gaps
      const bases = computed.bases.slice(0); // current effective %
      const pair_avail = bases[left_index] + bases[right_index];

      // --- MIN CLAMPS (pixels) -------------------------------------------------
      const pctToPx = pct => pair_px * (pct / pair_avail); // pair-local percent → px
      const genericMinPct = Math.min(5, available); // original 5% floor (in “available %” space)
      const genericMinPx = pctToPx(genericMinPct);
      const leftMinPx = Math.max(this._get_col_min_px(left_col), genericMinPx);
      const rightMinPx = Math.max(this._get_col_min_px(right_col), genericMinPx);

      // freeze text selection + cursor
      const prev_user_select = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      row_el.style.cursor = 'col-resize';
      const on_mouse_move = ev => {
        if (!pair_px) return;

        // work in pixels, clamp by each side’s min
        const delta_px = ev.clientX - start_x;
        let newLeftPx = left_start_px + delta_px;
        newLeftPx = Math.max(leftMinPx, Math.min(pair_px - rightMinPx, newLeftPx));
        const newRightPx = pair_px - newLeftPx;

        // translate back to pair-local percentages
        const newLeftPct = newLeftPx / pair_px * pair_avail;
        const newBases = bases.slice(0);
        newBases[left_index] = newLeftPct;
        newBases[right_index] = pair_avail - newLeftPct;
        b.layout.apply_bases_to_row(row_el, newBases);
      };
      const on_mouse_up = () => {
        document.removeEventListener('mousemove', on_mouse_move);
        document.removeEventListener('mouseup', on_mouse_up);
        window.removeEventListener('mouseup', on_mouse_up);
        document.removeEventListener('mouseleave', on_mouse_up);
        document.body.style.userSelect = prev_user_select || '';
        row_el.style.cursor = '';

        // normalize to the row’s available % again
        const normalized = b.layout.compute_effective_bases_from_row(row_el, gp);
        b.layout.apply_bases_to_row(row_el, normalized.bases);
      };
      document.addEventListener('mousemove', on_mouse_move);
      document.addEventListener('mouseup', on_mouse_up);
      window.addEventListener('mouseup', on_mouse_up);
      document.addEventListener('mouseleave', on_mouse_up);
    }
  };

  /**
   * Page and section creation, rebuilding, and nested Sortable setup.
   */
  UI.WPBC_BFB_Pages_Sections = class extends UI.WPBC_BFB_Module {
    init() {
      this.builder.add_page = opts => this.add_page(opts);
      this.builder.add_section = (container, cols) => this.add_section(container, cols);
      this.builder.rebuild_section = (section_data, container) => this.rebuild_section(section_data, container);
      this.builder.init_all_nested_sortables = el => this.init_all_nested_sortables(el);
      this.builder.init_section_sortable = el => this.init_section_sortable(el);
      this.builder.pages_sections = this;
    }
    _make_add_columns_control(page_el, section_container) {
      const tpl = document.getElementById('wpbc_bfb__add_columns_template');
      if (!tpl) {
        return null;
      }

      // Clone *contents* (not the id), unhide, and add a page-scoped class.
      const src = tpl.content && tpl.content.firstElementChild ? tpl.content.firstElementChild : tpl.firstElementChild;
      if (!src) {
        return null;
      }
      const clone = src.cloneNode(true);
      clone.removeAttribute('hidden');

      // If any inline onclick snuck in, strip it (defensive).
      clone.querySelectorAll('[onclick]').forEach(n => n.removeAttribute('onclick'));

      // Click on options - add section with N columns.
      clone.addEventListener('click', e => {
        const a = e.target.closest('.ul_dropdown_menu_li_action_add_sections');
        if (!a) {
          return;
        }
        e.preventDefault();

        // Read N either from data-cols or fallback to parsing text like "3 Columns".
        let cols = parseInt(a.dataset.cols || (a.textContent.match(/\b(\d+)\s*Column/i)?.[1] ?? '1'), 10);
        cols = Math.max(1, Math.min(4, cols));
        this.add_section(section_container, cols);

        // Optional: reflect last choice.
        const val = clone.querySelector('.selected_value');
        if (val) {
          val.textContent = `(${cols})`;
        }
      });
      return clone;
    }

    /**
     * @param {{scroll?: boolean}} [opts = {}]
     * @returns {HTMLElement}
     */
    add_page({
      scroll = true
    } = {}) {
      const b = this.builder;
      const page_el = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__panel wpbc_bfb__panel--preview  wpbc_container wpbc_form wpbc_container_booking_form');
      page_el.setAttribute('data-page', ++b.page_counter);

      // Keep only the title and the section container placeholders here.
      page_el.innerHTML = `
				<div class="wpbc_bfb__controls"><h3>Page ${b.page_counter}</h3></div>
				<div class="wpbc_bfb__form_preview_section_container wpbc_wizard__border_container"></div>
			  `;
      const delete_btn = WPBC_Form_Builder_Helper.create_element('button', 'wpbc_bfb__field-remove-btn', '<i class="menu_icon icon-1x wpbc_icn_close"></i>');
      delete_btn.type = 'button';
      delete_btn.title = 'Remove page';
      delete_btn.setAttribute('aria-label', 'Remove page');
      delete_btn.onclick = () => {
        const selected = b.get_selected_field?.();
        let neighbor = null;
        if (selected && page_el.contains(selected)) {
          neighbor = b.pages_container.querySelector('.wpbc_bfb__panel--preview:not([data-page="' + page_el.getAttribute('data-page') + '"]) .wpbc_bfb__field:not(.is-invalid)');
        }
        page_el.remove();
        b.usage.update_palette_ui();
        b.select_field(neighbor || null);
      };
      page_el.querySelector('h3').appendChild(delete_btn);
      b.pages_container.appendChild(page_el);
      if (scroll) {
        page_el.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
      const section_container = page_el.querySelector('.wpbc_bfb__form_preview_section_container');
      const section_coount_on_add_page = 2;
      this.init_section_sortable(section_container);
      this.add_section(section_container, section_coount_on_add_page);

      // dropdown control cloned from the hidden template.
      const controlsHost = page_el.querySelector('.wpbc_bfb__controls');
      const customControl = this._make_add_columns_control(page_el, section_container);
      if (customControl) {
        controlsHost.appendChild(customControl);
      }
      return page_el;
    }
    /**
     * @param {HTMLElement} container
     * @param {number} cols
     */
    add_section(container, cols) {
      const b = this.builder;
      cols = Math.max(1, parseInt(cols, 10) || 1);
      const section = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__section');
      section.setAttribute('data-id', `section-${++b.section_counter}-${Date.now()}`);
      section.setAttribute('data-uid', `s-${++b._uid_counter}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const row = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__row wpbc__row');
      for (let i = 0; i < cols; i++) {
        const col = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__column wpbc__field');
        col.style.flexBasis = 100 / cols + '%';
        b.init_sortable?.(col);
        row.appendChild(col);
        if (i < cols - 1) {
          const resizer = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__column-resizer');
          resizer.addEventListener('mousedown', b.init_resize_handler);
          row.appendChild(resizer);
        }
      }
      section.appendChild(row);
      b.layout.set_equal_bases(row, b.col_gap_percent);
      b.add_overlay_toolbar(section);
      container.appendChild(section);
      section.setAttribute('tabindex', '0'); // optional: keyboard focusability.
      this.init_all_nested_sortables(section);
    }
    /**
     * @param {Object} section_data
     * @param {HTMLElement} container
     */
    rebuild_section(section_data, container) {
      const b = this.builder;
      const cols_data = Array.isArray(section_data?.columns) ? section_data.columns : [];
      this.add_section(container, cols_data.length || 1);
      const section = container.lastElementChild;
      if (!section.dataset.uid) {
        section.setAttribute('data-uid', `s-${++b._uid_counter}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      }
      section.setAttribute('data-id', section_data?.id || `section-${++b.section_counter}-${Date.now()}`);
      const row = section.querySelector('.wpbc_bfb__row');
      cols_data.forEach((col_data, index) => {
        const columns_only = row.querySelectorAll(':scope > .wpbc_bfb__column');
        const col = columns_only[index];
        col.style.flexBasis = col_data.width || '100%';
        (col_data.items || []).forEach(item => {
          if (!item || !item.type) {
            return;
          }
          if (item.type === 'field') {
            const el = b.build_field(item.data);
            if (el) {
              col.appendChild(el);
              b.trigger_field_drop_callback(el, 'load');
            }
            return;
          }
          if (item.type === 'section') {
            this.rebuild_section(item.data, col);
          }
        });
      });
      const computed = b.layout.compute_effective_bases_from_row(row, b.col_gap_percent);
      b.layout.apply_bases_to_row(row, computed.bases);
      this.init_all_nested_sortables(section);
    }
    /** @param {HTMLElement} container */
    init_all_nested_sortables(container) {
      const b = this.builder;
      if (container.classList.contains('wpbc_bfb__form_preview_section_container')) {
        this.init_section_sortable(container);
      }
      container.querySelectorAll('.wpbc_bfb__section').forEach(section => {
        section.querySelectorAll('.wpbc_bfb__column').forEach(col => {
          this.init_section_sortable(col);
        });
      });
    }
    /** @param {HTMLElement} container */
    init_section_sortable(container) {
      const b = this.builder;
      if (!container) {
        return;
      }
      const is_column = container.classList.contains('wpbc_bfb__column');
      const is_top_level = container.classList.contains('wpbc_bfb__form_preview_section_container');
      if (!is_column && !is_top_level) {
        return;
      }
      b.init_sortable?.(container);
    }
  };

  /**
   * Serialization and deserialization of pages/sections/fields.
   */
  UI.WPBC_BFB_Structure_IO = class extends UI.WPBC_BFB_Module {
    init() {
      this.builder.get_structure = () => this.serialize();
      this.builder.load_saved_structure = (s, opts) => this.deserialize(s, opts);
    }
    /** @returns {Array} */
    serialize() {
      const b = this.builder;
      this._normalize_ids();
      this._normalize_names();
      const pages = [];
      b.pages_container.querySelectorAll('.wpbc_bfb__panel--preview').forEach((page_el, page_index) => {
        const container = page_el.querySelector('.wpbc_bfb__form_preview_section_container');
        const content = [];
        if (!container) {
          pages.push({
            page: page_index + 1,
            content
          });
          return;
        }
        container.querySelectorAll(':scope > *').forEach(child => {
          if (child.classList.contains('wpbc_bfb__section')) {
            content.push({
              type: 'section',
              data: this.serialize_section(child)
            });
            return;
          }
          if (child.classList.contains('wpbc_bfb__field')) {
            if (child.classList.contains('is-invalid')) {
              return;
            }
            const f_data = WPBC_Form_Builder_Helper.get_all_data_attributes(child);
            delete f_data.uid;
            content.push({
              type: 'field',
              data: f_data
            });
          }
        });
        pages.push({
          page: page_index + 1,
          content
        });
      });
      return pages;
    }
    /**
     * @param {HTMLElement} section_el
     * @returns {{id:string, columns:Array}}
     */
    serialize_section(section_el) {
      const row = section_el.querySelector(':scope > .wpbc_bfb__row');
      if (!row) {
        return {
          id: section_el.dataset.id,
          columns: []
        };
      }
      const columns = [];
      row.querySelectorAll(':scope > .wpbc_bfb__column').forEach(col => {
        const width = col.style.flexBasis || '100%';
        const items = [];
        Array.from(col.children).forEach(child => {
          if (child.classList.contains('wpbc_bfb__section')) {
            items.push({
              type: 'section',
              data: this.serialize_section(child)
            });
            return;
          }
          if (child.classList.contains('wpbc_bfb__field')) {
            if (child.classList.contains('is-invalid')) {
              return;
            }
            const f_data = WPBC_Form_Builder_Helper.get_all_data_attributes(child);
            delete f_data.uid;
            items.push({
              type: 'field',
              data: f_data
            });
          }
        });
        columns.push({
          width,
          items
        });
      });
      return {
        id: section_el.dataset.id,
        columns
      };
    }
    /**
     * @param {Array} structure
     * @param {{deferIfTyping?: boolean}} [opts = {}]
     */
    deserialize(structure, {
      deferIfTyping = true
    } = {}) {
      const b = this.builder;
      if (deferIfTyping && this._is_typing_in_inspector()) {
        clearTimeout(this._defer_timer);
        this._defer_timer = setTimeout(() => {
          this.deserialize(structure, {
            deferIfTyping: false
          });
        }, 150);
        return;
      }
      b.pages_container.innerHTML = '';
      b.page_counter = 0;
      (structure || []).forEach(page_data => {
        const page_el = b.pages_sections.add_page({
          scroll: false
        });
        const section_container = page_el.querySelector('.wpbc_bfb__form_preview_section_container');
        section_container.innerHTML = '';
        b.init_section_sortable?.(section_container);
        (page_data.content || []).forEach(item => {
          if (item.type === 'section') {
            b.pages_sections.rebuild_section(item.data, section_container);
            return;
          }
          if (item.type === 'field') {
            const el = b.build_field(item.data);
            if (el) {
              section_container.appendChild(el);
              b.trigger_field_drop_callback(el, 'load');
            }
          }
        });
      });
      b.usage.update_palette_ui();
      b.bus.emit(WPBC_BFB_Events.STRUCTURE_LOADED, {
        structure
      });
    }
    _normalize_ids() {
      const b = this.builder;
      b.pages_container.querySelectorAll('.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)').forEach(el => {
        const data = WPBC_Form_Builder_Helper.get_all_data_attributes(el);
        const want = WPBC_BFB_Sanitize.sanitize_html_id(data.id || '') || 'field';
        const uniq = b.id.ensure_unique_field_id(want, el);
        if (data.id !== uniq) {
          el.setAttribute('data-id', uniq);
          if (b.preview_mode) {
            b.render_preview(el);
          }
        }
      });
    }
    _normalize_names() {
      const b = this.builder;
      b.pages_container.querySelectorAll('.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)').forEach(el => {
        const data = WPBC_Form_Builder_Helper.get_all_data_attributes(el);
        const base = WPBC_BFB_Sanitize.sanitize_html_name(data.name != null ? data.name : data.id) || 'field';
        const uniq = b.id.ensure_unique_field_name(base, el);
        if (data.name !== uniq) {
          el.setAttribute('data-name', uniq);
          if (b.preview_mode) {
            b.render_preview(el);
          }
        }
      });
    }
    /** @returns {boolean} */
    _is_typing_in_inspector() {
      const ins = document.getElementById('wpbc_bfb__inspector');
      return !!(ins && document.activeElement && ins.contains(document.activeElement));
    }
  };

  /**
   * Minimal, standalone guard that enforces per-column min widths based on fields' data-min_width.
   *
   * @type {UI.WPBC_BFB_Min_Width_Guard}
   */
  UI.WPBC_BFB_Min_Width_Guard = class extends UI.WPBC_BFB_Module {
    constructor(builder) {
      super(builder);
      this._on_field_add = this._on_field_add.bind(this);
      this._on_field_remove = this._on_field_remove.bind(this);
      this._on_structure_loaded = this._on_structure_loaded.bind(this);
      this._on_window_resize = this._on_window_resize.bind(this);
    }
    init() {
      const EV = WPBC_BFB_Events;
      this.builder?.bus?.on?.(EV.FIELD_ADD, this._on_field_add);
      this.builder?.bus?.on?.(EV.FIELD_REMOVE, this._on_field_remove);
      this.builder?.bus?.on?.(EV.STRUCTURE_LOADED, this._on_structure_loaded);
      window.addEventListener('resize', this._on_window_resize, {
        passive: true
      });
      this.refresh_all();
    }
    destroy() {
      const EV = WPBC_BFB_Events;
      this.builder?.bus?.off?.(EV.FIELD_ADD, this._on_field_add);
      this.builder?.bus?.off?.(EV.FIELD_REMOVE, this._on_field_remove);
      this.builder?.bus?.off?.(EV.STRUCTURE_LOADED, this._on_structure_loaded);
      window.removeEventListener('resize', this._on_window_resize);
    }
    _on_field_add(e) {
      // safe + simple: moving between columns updates both rows
      this.refresh_all();
      // if you really want to be minimal work here, keep your row-only version.
    }
    _on_field_remove(e) {
      const src_el = e?.detail?.el || null;
      const row = src_el && src_el.closest ? src_el.closest('.wpbc_bfb__row') : null;
      if (row) this.refresh_row(row);else this.refresh_all();
    }
    _on_structure_loaded() {
      this.refresh_all();
    }
    _on_window_resize() {
      this.refresh_all();
    }
    refresh_all() {
      this.builder?.pages_container?.querySelectorAll?.('.wpbc_bfb__row')?.forEach?.(row => this.refresh_row(row));
    }
    refresh_row(row_el) {
      if (!row_el) return;
      const cols = row_el.querySelectorAll(':scope > .wpbc_bfb__column');

      // 1) Recalculate each column’s required min px and write it to the CSS var.
      cols.forEach(col => this.apply_col_min(col));

      // 2) Enforce it at the CSS level right away so layout can’t render narrower.
      cols.forEach(col => {
        const px = parseFloat(getComputedStyle(col).getPropertyValue('--wpbc-col-min') || '0') || 0;
        col.style.minWidth = px > 0 ? Math.round(px) + 'px' : '';
      });

      // 3) Normalize current bases so the row respects all mins without overflow.
      try {
        const b = this.builder;
        const gp = b.col_gap_percent;
        const eff = b.layout.compute_effective_bases_from_row(row_el, gp); // { bases, available }
        // Re-fit *current* bases against mins (same algorithm layout chips use).
        const fitted = UI.WPBC_BFB_Layout_Chips._fit_weights_respecting_min(b, row_el, eff.bases);
        if (Array.isArray(fitted)) {
          const changed = fitted.some((v, i) => Math.abs(v - eff.bases[i]) > 0.01);
          if (changed) {
            b.layout.apply_bases_to_row(row_el, fitted);
          }
        }
      } catch (_) {/* non-fatal */}
    }
    apply_col_min(col_el) {
      if (!col_el) return;
      let max_px = 0;
      col_el.querySelectorAll(':scope > .wpbc_bfb__field').forEach(field => {
        const raw = field.getAttribute('data-min_width');
        let px = 0;
        if (raw) {
          px = this.parse_len_px(raw);
        } else {
          const cs = getComputedStyle(field);
          px = parseFloat(cs.minWidth || '0') || 0;
        }
        if (px > max_px) max_px = px;
      });
      col_el.style.setProperty('--wpbc-col-min', max_px > 0 ? Math.round(max_px) + 'px' : '0px');
    }
    parse_len_px(value) {
      if (value == null) return 0;
      const s = String(value).trim().toLowerCase();
      if (s === '') return 0;
      if (s.endsWith('px')) {
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
      }
      if (s.endsWith('rem') || s.endsWith('em')) {
        const n = parseFloat(s);
        const base = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        return Number.isFinite(n) ? n * base : 0;
      }
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }
  };
  w.WPBC_BFB_UI = UI;
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItdWktbW9kdWxlcy5paWZlLmpzIiwibmFtZXMiOlsidyIsIldQQkNfQkZCX0RPTSIsIldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlciIsIldQQkNfQkZCX0V2ZW50cyIsIldQQkNfQkZCX1Nhbml0aXplIiwiV1BCQ19CRkJfQ29yZSIsIlVJIiwiV1BCQ19CRkJfTW9kdWxlIiwiY29uc3RydWN0b3IiLCJidWlsZGVyIiwiaW5pdCIsImRlc3Ryb3kiLCJXUEJDX0JGQl9PdmVybGF5IiwiZW5zdXJlIiwiZWwiLCJpc1NlY3Rpb24iLCJjbGFzc0xpc3QiLCJjb250YWlucyIsIm92ZXJsYXkiLCJxdWVyeVNlbGVjdG9yIiwiU0VMRUNUT1JTIiwiY3JlYXRlX2VsZW1lbnQiLCJwcmVwZW5kIiwiZHJhZ0NsYXNzIiwiYXBwZW5kQ2hpbGQiLCJzZXR0aW5nc19idG4iLCJ0eXBlIiwidGl0bGUiLCJvbmNsaWNrIiwiZSIsInByZXZlbnREZWZhdWx0Iiwic2VsZWN0X2ZpZWxkIiwic2Nyb2xsSW50b1ZpZXciLCJpbnMiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwiYmVoYXZpb3IiLCJibG9jayIsInNldFRpbWVvdXQiLCJmb2N1c2FibGUiLCJmb2N1cyIsInNldEF0dHJpYnV0ZSIsIldQQkNfQkZCX0xheW91dF9DaGlwcyIsIl9nZXRfY29sX21pbl9weCIsImNvbCIsInYiLCJnZXRDb21wdXRlZFN0eWxlIiwiZ2V0UHJvcGVydHlWYWx1ZSIsIm4iLCJwYXJzZUZsb2F0IiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJNYXRoIiwibWF4IiwiX2ZpdF93ZWlnaHRzX3Jlc3BlY3RpbmdfbWluIiwicm93Iiwid2VpZ2h0cyIsImNvbHMiLCJBcnJheSIsImZyb20iLCJxdWVyeVNlbGVjdG9yQWxsIiwibGVuZ3RoIiwiaXNBcnJheSIsImdwIiwiY29sX2dhcF9wZXJjZW50IiwiZWZmIiwibGF5b3V0IiwiY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3ciLCJhdmFpbFBjdCIsImF2YWlsYWJsZSIsInJvd1B4IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0Iiwid2lkdGgiLCJhdmFpbFB4IiwibWluUGN0IiwibWFwIiwiYyIsIm1pblB4Iiwic3VtTWluIiwicmVkdWNlIiwiYSIsImIiLCJ3U3VtIiwidGFyZ2V0UGN0IiwibG9ja2VkIiwiZmlsbCIsImxvY2tlZFN1bSIsImkiLCJyZW1haW5pbmciLCJmcmVlSWR4IiwiZnJlZVRhcmdldFN1bSIsInB1c2giLCJyZXN1bHQiLCJlYWNoIiwiZm9yRWFjaCIsIl9hcHBseV9wcmVzZXRfd2l0aF9taW5fZ3VhcmQiLCJzZWN0aW9uX2VsIiwiZml0dGVkIiwiX2Fubm91bmNlIiwiYXBwbHlfYmFzZXNfdG9fcm93IiwicmVuZGVyX2Zvcl9zZWN0aW9uIiwiaG9zdF9lbCIsImlubmVySFRNTCIsIl9tYWtlX2NoaXAiLCJwcmVzZXRzIiwiYnVpbGRfcHJlc2V0c19mb3JfY29sdW1ucyIsImN1c3RvbUJ0biIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJ0ZXh0Q29udGVudCIsImFkZEV2ZW50TGlzdGVuZXIiLCJleGFtcGxlIiwidGV4dCIsInByb21wdCIsInBhcnNlX3dlaWdodHMiLCJhbGVydCIsInJlbW92ZSIsImFkZCIsImxhYmVsIiwiYnRuIiwiZm9ybWF0X3ByZXNldF9sYWJlbCIsInZpcyIsInN1bSIsImJhciIsInN0eWxlIiwiZmxleCIsInRvRml4ZWQiLCJ0eHQiLCJwYXJlbnRFbGVtZW50IiwiV1BCQ19CRkJfU2VsZWN0aW9uX0NvbnRyb2xsZXIiLCJfc2VsZWN0ZWRfdWlkIiwiYmluZCIsImdldF9zZWxlY3RlZF9maWVsZCIsIl9vbl9jbGVhciIsIm9uX2NsZWFyIiwiYnVzIiwib24iLCJDTEVBUl9TRUxFQ1RJT04iLCJfb25fY2FudmFzX2NsaWNrIiwiX2hhbmRsZV9jYW52YXNfY2xpY2siLCJwYWdlc19jb250YWluZXIiLCJvZmYiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwicm9vdCIsIklHTk9SRSIsImpvaW4iLCJ0YXJnZXQiLCJjbG9zZXN0IiwiaGl0IiwidmFsaWRGaWVsZCIsInNlY3Rpb24iLCJzdG9wUHJvcGFnYXRpb24iLCJmaWVsZF9lbCIsInByZXYiLCJpbnNwZWN0b3IiLCJjbGVhciIsImVtaXQiLCJwcmV2X3VpZCIsInNvdXJjZSIsImdldEF0dHJpYnV0ZSIsImJpbmRfdG9fZmllbGQiLCJTRUxFQ1QiLCJ1aWQiLCJkYXRhc2V0IiwiaWQiLCJlc2NfYXR0ciIsImVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciIsImV2Iiwic3JjIiwiZGV0YWlsIiwiV1BCQ19CRkJfSW5zcGVjdG9yX0JyaWRnZSIsIl9hdHRhY2hfaW5zcGVjdG9yIiwiX2JpbmRfaWRfc2FuaXRpemVyIiwiYXR0YWNoIiwid2luZG93IiwiV1BCQ19CRkJfSW5zcGVjdG9yIiwiaGFuZGxlciIsInQiLCJrZXkiLCJpbnNwZWN0b3JLZXkiLCJ0b0xvd2VyQ2FzZSIsInNlbCIsInVuaXF1ZSIsInNldF9maWVsZF9uYW1lIiwidmFsdWUiLCJwcmV2aWV3X21vZGUiLCJyZW5kZXJfcHJldmlldyIsInNldF9maWVsZF9pZCIsImFwcGxpZWQiLCJzZXRfZmllbGRfaHRtbF9pZCIsIldQQkNfQkZCX0tleWJvYXJkX0NvbnRyb2xsZXIiLCJfb25fa2V5Iiwib25fa2V5IiwiaXNfdHlwaW5nIiwiX2lzX3R5cGluZ19hbnl3aGVyZSIsImRpc3BhdGNoRXZlbnQiLCJDdXN0b21FdmVudCIsImJ1YmJsZXMiLCJzZWxlY3RlZCIsIm5laWdoYm9yIiwiX2ZpbmRfbmVpZ2hib3Jfc2VsZWN0YWJsZSIsIkZJRUxEX1JFTU9WRSIsInVzYWdlIiwidXBkYXRlX3BhbGV0dGVfdWkiLCJhbHRLZXkiLCJjdHJsS2V5IiwibWV0YUtleSIsInNoaWZ0S2V5IiwiZGlyIiwibW92ZV9pdGVtIiwiYWN0aXZlRWxlbWVudCIsInRhZyIsInRhZ05hbWUiLCJpc0NvbnRlbnRFZGl0YWJsZSIsIldQQkNfQkZCX1Jlc2l6ZV9Db250cm9sbGVyIiwiaW5pdF9yZXNpemVfaGFuZGxlciIsImhhbmRsZV9yZXNpemUiLCJidXR0b24iLCJyZXNpemVyIiwiY3VycmVudFRhcmdldCIsInJvd19lbCIsImxlZnRfY29sIiwicHJldmlvdXNFbGVtZW50U2libGluZyIsInJpZ2h0X2NvbCIsIm5leHRFbGVtZW50U2libGluZyIsImxlZnRfaW5kZXgiLCJpbmRleE9mIiwicmlnaHRfaW5kZXgiLCJzdGFydF94IiwiY2xpZW50WCIsImxlZnRfc3RhcnRfcHgiLCJyaWdodF9zdGFydF9weCIsInBhaXJfcHgiLCJjb21wdXRlZCIsImJhc2VzIiwic2xpY2UiLCJwYWlyX2F2YWlsIiwicGN0VG9QeCIsInBjdCIsImdlbmVyaWNNaW5QY3QiLCJtaW4iLCJnZW5lcmljTWluUHgiLCJsZWZ0TWluUHgiLCJyaWdodE1pblB4IiwicHJldl91c2VyX3NlbGVjdCIsImJvZHkiLCJ1c2VyU2VsZWN0IiwiY3Vyc29yIiwib25fbW91c2VfbW92ZSIsImRlbHRhX3B4IiwibmV3TGVmdFB4IiwibmV3UmlnaHRQeCIsIm5ld0xlZnRQY3QiLCJuZXdCYXNlcyIsIm9uX21vdXNlX3VwIiwibm9ybWFsaXplZCIsIldQQkNfQkZCX1BhZ2VzX1NlY3Rpb25zIiwiYWRkX3BhZ2UiLCJvcHRzIiwiYWRkX3NlY3Rpb24iLCJjb250YWluZXIiLCJyZWJ1aWxkX3NlY3Rpb24iLCJzZWN0aW9uX2RhdGEiLCJpbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzIiwiaW5pdF9zZWN0aW9uX3NvcnRhYmxlIiwicGFnZXNfc2VjdGlvbnMiLCJfbWFrZV9hZGRfY29sdW1uc19jb250cm9sIiwicGFnZV9lbCIsInNlY3Rpb25fY29udGFpbmVyIiwidHBsIiwiY29udGVudCIsImZpcnN0RWxlbWVudENoaWxkIiwiY2xvbmUiLCJjbG9uZU5vZGUiLCJyZW1vdmVBdHRyaWJ1dGUiLCJwYXJzZUludCIsIm1hdGNoIiwidmFsIiwic2Nyb2xsIiwicGFnZV9jb3VudGVyIiwiZGVsZXRlX2J0biIsInNlY3Rpb25fY29vdW50X29uX2FkZF9wYWdlIiwiY29udHJvbHNIb3N0IiwiY3VzdG9tQ29udHJvbCIsInNlY3Rpb25fY291bnRlciIsIkRhdGUiLCJub3ciLCJfdWlkX2NvdW50ZXIiLCJyYW5kb20iLCJ0b1N0cmluZyIsImZsZXhCYXNpcyIsImluaXRfc29ydGFibGUiLCJzZXRfZXF1YWxfYmFzZXMiLCJhZGRfb3ZlcmxheV90b29sYmFyIiwiY29sc19kYXRhIiwiY29sdW1ucyIsImxhc3RFbGVtZW50Q2hpbGQiLCJjb2xfZGF0YSIsImluZGV4IiwiY29sdW1uc19vbmx5IiwiaXRlbXMiLCJpdGVtIiwiYnVpbGRfZmllbGQiLCJkYXRhIiwidHJpZ2dlcl9maWVsZF9kcm9wX2NhbGxiYWNrIiwiaXNfY29sdW1uIiwiaXNfdG9wX2xldmVsIiwiV1BCQ19CRkJfU3RydWN0dXJlX0lPIiwiZ2V0X3N0cnVjdHVyZSIsInNlcmlhbGl6ZSIsImxvYWRfc2F2ZWRfc3RydWN0dXJlIiwicyIsImRlc2VyaWFsaXplIiwiX25vcm1hbGl6ZV9pZHMiLCJfbm9ybWFsaXplX25hbWVzIiwicGFnZXMiLCJwYWdlX2luZGV4IiwicGFnZSIsImNoaWxkIiwic2VyaWFsaXplX3NlY3Rpb24iLCJmX2RhdGEiLCJnZXRfYWxsX2RhdGFfYXR0cmlidXRlcyIsImNoaWxkcmVuIiwic3RydWN0dXJlIiwiZGVmZXJJZlR5cGluZyIsIl9pc190eXBpbmdfaW5faW5zcGVjdG9yIiwiY2xlYXJUaW1lb3V0IiwiX2RlZmVyX3RpbWVyIiwicGFnZV9kYXRhIiwiU1RSVUNUVVJFX0xPQURFRCIsIndhbnQiLCJzYW5pdGl6ZV9odG1sX2lkIiwidW5pcSIsImVuc3VyZV91bmlxdWVfZmllbGRfaWQiLCJiYXNlIiwic2FuaXRpemVfaHRtbF9uYW1lIiwibmFtZSIsImVuc3VyZV91bmlxdWVfZmllbGRfbmFtZSIsIldQQkNfQkZCX01pbl9XaWR0aF9HdWFyZCIsIl9vbl9maWVsZF9hZGQiLCJfb25fZmllbGRfcmVtb3ZlIiwiX29uX3N0cnVjdHVyZV9sb2FkZWQiLCJfb25fd2luZG93X3Jlc2l6ZSIsIkVWIiwiRklFTERfQUREIiwicGFzc2l2ZSIsInJlZnJlc2hfYWxsIiwic3JjX2VsIiwicmVmcmVzaF9yb3ciLCJhcHBseV9jb2xfbWluIiwicHgiLCJtaW5XaWR0aCIsInJvdW5kIiwiY2hhbmdlZCIsInNvbWUiLCJhYnMiLCJfIiwiY29sX2VsIiwibWF4X3B4IiwiZmllbGQiLCJyYXciLCJwYXJzZV9sZW5fcHgiLCJjcyIsInNldFByb3BlcnR5IiwiU3RyaW5nIiwidHJpbSIsImVuZHNXaXRoIiwiZG9jdW1lbnRFbGVtZW50IiwiZm9udFNpemUiLCJXUEJDX0JGQl9VSSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYmZiLXVpLW1vZHVsZXMuaWlmZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgL19vdXQvYmZiLXVpLW1vZHVsZXMuaWlmZS5qcyA9PSBUaW1lIHBvaW50OiAyMDI1LTA4LTIxIDE3OjM5XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4oIGZ1bmN0aW9uICggdyApIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdGNvbnN0IHsgV1BCQ19CRkJfRE9NLCBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIsIFdQQkNfQkZCX0V2ZW50cywgV1BCQ19CRkJfU2FuaXRpemUgfSA9IHcuV1BCQ19CRkJfQ29yZTtcclxuXHJcblx0Y29uc3QgVUkgPSB7fTtcclxuXHJcblx0LyoqXHJcblx0ICogQmFzZSBjbGFzcyBmb3IgQkZCIG1vZHVsZXMuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfTW9kdWxlID0gY2xhc3Mge1xyXG5cdFx0LyoqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXIgKi9cclxuXHRcdGNvbnN0cnVjdG9yKGJ1aWxkZXIpIHtcclxuXHRcdFx0dGhpcy5idWlsZGVyID0gYnVpbGRlcjtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogSW5pdGlhbGl6ZSB0aGUgbW9kdWxlLiAqL1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQ2xlYW51cCB0aGUgbW9kdWxlLiAqL1xyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDZW50cmFsIG92ZXJsYXkvY29udHJvbHMgbWFuYWdlciBmb3IgZmllbGRzL3NlY3Rpb25zLlxyXG5cdCAqIFB1cmUgVUkgY29tcG9zaXRpb247IGFsbCBhY3Rpb25zIHJvdXRlIGJhY2sgaW50byB0aGUgYnVpbGRlciBpbnN0YW5jZS5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9PdmVybGF5ID0gY2xhc3Mge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW5zdXJlIGFuIG92ZXJsYXkgZXhpc3RzIGFuZCBpcyB3aXJlZCB1cCBvbiB0aGUgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXJcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIC0gZmllbGQgb3Igc2VjdGlvbiBlbGVtZW50XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlbnN1cmUoIGJ1aWxkZXIsIGVsICkge1xyXG5cclxuXHRcdFx0aWYgKCAhIGVsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBpc1NlY3Rpb24gPSBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKTtcclxuXHJcblx0XHRcdGxldCBvdmVybGF5ID0gZWwucXVlcnlTZWxlY3RvciggV1BCQ19CRkJfRE9NLlNFTEVDVE9SUy5vdmVybGF5ICk7XHJcblx0XHRcdGlmICggISBvdmVybGF5ICkge1xyXG5cdFx0XHRcdG92ZXJsYXkgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX292ZXJsYXktY29udHJvbHMnICk7XHJcblx0XHRcdFx0ZWwucHJlcGVuZCggb3ZlcmxheSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBEcmFnIGhhbmRsZS5cclxuXHRcdFx0aWYgKCAhIG92ZXJsYXkucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZHJhZy1oYW5kbGUnICkgKSB7XHJcblx0XHRcdFx0Y29uc3QgZHJhZ0NsYXNzID0gaXNTZWN0aW9uID8gJ3dwYmNfYmZiX19kcmFnLWhhbmRsZSBzZWN0aW9uLWRyYWctaGFuZGxlJyA6ICd3cGJjX2JmYl9fZHJhZy1oYW5kbGUnO1xyXG5cdFx0XHRcdG92ZXJsYXkuYXBwZW5kQ2hpbGQoXHJcblx0XHRcdFx0XHRXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdzcGFuJywgZHJhZ0NsYXNzLCAnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9kcmFnX2luZGljYXRvclwiPjwvc3Bhbj4nIClcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTRVRUSU5HUyBidXR0b24gKHNob3duIGZvciBib3RoIGZpZWxkcyAmIHNlY3Rpb25zKS5cclxuXHRcdFx0aWYgKCAhIG92ZXJsYXkucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fc2V0dGluZ3MtYnRuJyApICkge1xyXG5cdFx0XHRcdGNvbnN0IHNldHRpbmdzX2J0biAgID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnYnV0dG9uJywgJ3dwYmNfYmZiX19zZXR0aW5ncy1idG4nLCAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9zZXR0aW5nc1wiPjwvaT4nICk7XHJcblx0XHRcdFx0c2V0dGluZ3NfYnRuLnR5cGUgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0XHRzZXR0aW5nc19idG4udGl0bGUgICA9ICdPcGVuIHNldHRpbmdzJztcclxuXHRcdFx0XHRzZXR0aW5nc19idG4ub25jbGljayA9IChlKSA9PiB7XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHQvLyBTZWxlY3QgVEhJUyBlbGVtZW50IGFuZCBzY3JvbGwgaXQgaW50byB2aWV3LlxyXG5cdFx0XHRcdFx0YnVpbGRlci5zZWxlY3RfZmllbGQoIGVsLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBUcnkgdG8gYnJpbmcgdGhlIGluc3BlY3RvciBpbnRvIHZpZXcgLyBmb2N1cyBmaXJzdCBpbnB1dC5cclxuXHRcdFx0XHRcdGNvbnN0IGlucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0XHRcdGlmICggaW5zICkge1xyXG5cdFx0XHRcdFx0XHRpbnMuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ25lYXJlc3QnIH0gKTtcclxuXHRcdFx0XHRcdFx0Ly8gRm9jdXMgZmlyc3QgaW50ZXJhY3RpdmUgY29udHJvbCAoYmVzdC1lZmZvcnQpLlxyXG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgZm9jdXNhYmxlID0gaW5zLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dCxzZWxlY3QsdGV4dGFyZWEsYnV0dG9uLFtjb250ZW50ZWRpdGFibGVdLFt0YWJpbmRleF06bm90KFt0YWJpbmRleD1cIi0xXCJdKScgKTtcclxuXHRcdFx0XHRcdFx0XHRmb2N1c2FibGU/LmZvY3VzPy4oKTtcclxuXHRcdFx0XHRcdFx0fSwgMjYwICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0b3ZlcmxheS5hcHBlbmRDaGlsZCggc2V0dGluZ3NfYnRuICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG92ZXJsYXkuc2V0QXR0cmlidXRlKCAncm9sZScsICd0b29sYmFyJyApO1xyXG5cdFx0XHRvdmVybGF5LnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSA/ICdTZWN0aW9uIHRvb2xzJyA6ICdGaWVsZCB0b29scycgKTtcclxuXHJcblx0XHRcdHJldHVybiBvdmVybGF5O1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkMgTGF5b3V0IENoaXBzIGhlbHBlciAtIHZpc3VhbCBsYXlvdXQgcGlja2VyIChjaGlwcyksIGUuZy4sIFwiNTAlLzUwJVwiLCB0byBhIHNlY3Rpb24gb3ZlcmxheS5cclxuXHQgKlxyXG5cdCAqIFJlbmRlcnMgRXF1YWwvUHJlc2V0cy9DdXN0b20gY2hpcHMgaW50byBhIGhvc3QgY29udGFpbmVyIGFuZCB3aXJlcyB0aGVtIHRvIGFwcGx5IHRoZSBsYXlvdXQuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzID0gY2xhc3Mge1xyXG5cclxuXHRcdC8qKiBSZWFkIHBlci1jb2x1bW4gbWluIChweCkgZnJvbSBDU1MgdmFyIHNldCBieSB0aGUgZ3VhcmQuICovXHJcblx0XHRzdGF0aWMgX2dldF9jb2xfbWluX3B4KGNvbCkge1xyXG5cdFx0XHRjb25zdCB2ID0gZ2V0Q29tcHV0ZWRTdHlsZSggY29sICkuZ2V0UHJvcGVydHlWYWx1ZSggJy0td3BiYy1jb2wtbWluJyApIHx8ICcwJztcclxuXHRcdFx0Y29uc3QgbiA9IHBhcnNlRmxvYXQoIHYgKTtcclxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gTWF0aC5tYXgoIDAsIG4gKSA6IDA7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUdXJuIHJhdyB3ZWlnaHRzIChlLmcuIFsxLDFdLCBbMiwxLDFdKSBpbnRvIGVmZmVjdGl2ZSBcImF2YWlsYWJsZS0lXCIgYmFzZXMgdGhhdFxyXG5cdFx0ICogKGEpIHN1bSB0byB0aGUgcm93J3MgYXZhaWxhYmxlICUsIGFuZCAoYikgbWVldCBldmVyeSBjb2x1bW4ncyBtaW4gcHguXHJcblx0XHQgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGJhc2VzIChudW1iZXJzKSBvciBudWxsIGlmIGltcG9zc2libGUgdG8gc2F0aXNmeSBtaW5zLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgX2ZpdF93ZWlnaHRzX3Jlc3BlY3RpbmdfbWluKGJ1aWxkZXIsIHJvdywgd2VpZ2h0cykge1xyXG5cdFx0XHRjb25zdCBjb2xzID0gQXJyYXkuZnJvbSggcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSApO1xyXG5cdFx0XHRjb25zdCBuICAgID0gY29scy5sZW5ndGg7XHJcblx0XHRcdGlmICggIW4gKSByZXR1cm4gbnVsbDtcclxuXHRcdFx0aWYgKCAhQXJyYXkuaXNBcnJheSggd2VpZ2h0cyApIHx8IHdlaWdodHMubGVuZ3RoICE9PSBuICkgcmV0dXJuIG51bGw7XHJcblxyXG5cdFx0XHQvLyBhdmFpbGFibGUgJSBhZnRlciBnYXBzIChmcm9tIExheW91dFNlcnZpY2UpXHJcblx0XHRcdGNvbnN0IGdwICAgICAgID0gYnVpbGRlci5jb2xfZ2FwX3BlcmNlbnQ7XHJcblx0XHRcdGNvbnN0IGVmZiAgICAgID0gYnVpbGRlci5sYXlvdXQuY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3coIHJvdywgZ3AgKTtcclxuXHRcdFx0Y29uc3QgYXZhaWxQY3QgPSBlZmYuYXZhaWxhYmxlOyAgICAgICAgICAgICAgIC8vIGUuZy4gOTQgaWYgMiBjb2xzIGFuZCAzJSBnYXBcclxuXHRcdFx0Y29uc3Qgcm93UHggICAgPSByb3cuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XHJcblx0XHRcdGNvbnN0IGF2YWlsUHggID0gcm93UHggKiAoYXZhaWxQY3QgLyAxMDApO1xyXG5cclxuXHRcdFx0Ly8gY29sbGVjdCBtaW5pbWEgaW4gJSBvZiBcImF2YWlsYWJsZVwiXHJcblx0XHRcdGNvbnN0IG1pblBjdCA9IGNvbHMubWFwKCAoYykgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IG1pblB4ID0gVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLl9nZXRfY29sX21pbl9weCggYyApO1xyXG5cdFx0XHRcdGlmICggYXZhaWxQeCA8PSAwICkgcmV0dXJuIDA7XHJcblx0XHRcdFx0cmV0dXJuIChtaW5QeCAvIGF2YWlsUHgpICogYXZhaWxQY3Q7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIElmIG1pbnMgYWxvbmUgZG9uJ3QgZml0LCBiYWlsLlxyXG5cdFx0XHRjb25zdCBzdW1NaW4gPSBtaW5QY3QucmVkdWNlKCAoYSwgYikgPT4gYSArIGIsIDAgKTtcclxuXHRcdFx0aWYgKCBzdW1NaW4gPiBhdmFpbFBjdCAtIDFlLTYgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7IC8vIGltcG9zc2libGUgdG8gcmVzcGVjdCBtaW5zOyBkb24ndCBhcHBseSBwcmVzZXRcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gVGFyZ2V0IHBlcmNlbnRhZ2VzIGZyb20gd2VpZ2h0cywgbm9ybWFsaXplZCB0byBhdmFpbFBjdC5cclxuXHRcdFx0Y29uc3Qgd1N1bSAgICAgID0gd2VpZ2h0cy5yZWR1Y2UoIChhLCB3KSA9PiBhICsgKE51bWJlciggdyApIHx8IDApLCAwICkgfHwgbjtcclxuXHRcdFx0Y29uc3QgdGFyZ2V0UGN0ID0gd2VpZ2h0cy5tYXAoICh3KSA9PiAoKE51bWJlciggdyApIHx8IDApIC8gd1N1bSkgKiBhdmFpbFBjdCApO1xyXG5cclxuXHRcdFx0Ly8gTG9jayBjb2x1bW5zIHRoYXQgd291bGQgYmUgYmVsb3cgbWluLCB0aGVuIGRpc3RyaWJ1dGUgdGhlIHJlbWFpbmRlclxyXG5cdFx0XHQvLyBhY3Jvc3MgdGhlIHJlbWFpbmluZyBjb2x1bW5zIHByb3BvcnRpb25hbGx5IHRvIHRoZWlyIHRhcmdldFBjdC5cclxuXHRcdFx0Y29uc3QgbG9ja2VkICA9IG5ldyBBcnJheSggbiApLmZpbGwoIGZhbHNlICk7XHJcblx0XHRcdGxldCBsb2NrZWRTdW0gPSAwO1xyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBuOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCB0YXJnZXRQY3RbaV0gPCBtaW5QY3RbaV0gKSB7XHJcblx0XHRcdFx0XHRsb2NrZWRbaV0gPSB0cnVlO1xyXG5cdFx0XHRcdFx0bG9ja2VkU3VtICs9IG1pblBjdFtpXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCByZW1haW5pbmcgICAgID0gYXZhaWxQY3QgLSBsb2NrZWRTdW07XHJcblx0XHRcdGNvbnN0IGZyZWVJZHggICAgID0gW107XHJcblx0XHRcdGxldCBmcmVlVGFyZ2V0U3VtID0gMDtcclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgbjsgaSsrICkge1xyXG5cdFx0XHRcdGlmICggIWxvY2tlZFtpXSApIHtcclxuXHRcdFx0XHRcdGZyZWVJZHgucHVzaCggaSApO1xyXG5cdFx0XHRcdFx0ZnJlZVRhcmdldFN1bSArPSB0YXJnZXRQY3RbaV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSBuZXcgQXJyYXkoIG4gKS5maWxsKCAwICk7XHJcblx0XHRcdC8vIFNlZWQgbG9ja2VkIHdpdGggdGhlaXIgbWluaW1hLlxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBuOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCBsb2NrZWRbaV0gKSByZXN1bHRbaV0gPSBtaW5QY3RbaV07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZnJlZUlkeC5sZW5ndGggPT09IDAgKSB7XHJcblx0XHRcdFx0Ly8gZXZlcnl0aGluZyBsb2NrZWQgZXhhY3RseSBhdCBtaW47IGFueSBsZWZ0b3ZlciAoc2hvdWxkbid0IGhhcHBlbilcclxuXHRcdFx0XHQvLyB3b3VsZCBiZSBpZ25vcmVkIHRvIGtlZXAgc2ltcGxpY2l0eSBhbmQgc3RhYmlsaXR5LlxyXG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggcmVtYWluaW5nIDw9IDAgKSB7XHJcblx0XHRcdFx0Ly8gbm90aGluZyBsZWZ0IHRvIGRpc3RyaWJ1dGU7IGtlZXAgZXhhY3RseSBtaW5zIG9uIGxvY2tlZCxcclxuXHRcdFx0XHQvLyBub3RoaW5nIGZvciBmcmVlIChkZWdlbmVyYXRlIGJ1dCBjb25zaXN0ZW50KVxyXG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZnJlZVRhcmdldFN1bSA8PSAwICkge1xyXG5cdFx0XHRcdC8vIGRpc3RyaWJ1dGUgZXF1YWxseSBhbW9uZyBmcmVlIGNvbHVtbnNcclxuXHRcdFx0XHRjb25zdCBlYWNoID0gcmVtYWluaW5nIC8gZnJlZUlkeC5sZW5ndGg7XHJcblx0XHRcdFx0ZnJlZUlkeC5mb3JFYWNoKCAoaSkgPT4gKHJlc3VsdFtpXSA9IGVhY2gpICk7XHJcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGlzdHJpYnV0ZSByZW1haW5pbmcgcHJvcG9ydGlvbmFsbHkgdG8gZnJlZSBjb2x1bW5zJyB0YXJnZXRQY3RcclxuXHRcdFx0ZnJlZUlkeC5mb3JFYWNoKCAoaSkgPT4ge1xyXG5cdFx0XHRcdHJlc3VsdFtpXSA9IHJlbWFpbmluZyAqICh0YXJnZXRQY3RbaV0gLyBmcmVlVGFyZ2V0U3VtKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBBcHBseSBhIHByZXNldCBidXQgZ3VhcmQgaXQgYnkgbWluaW1hOyByZXR1cm5zIHRydWUgaWYgYXBwbGllZCwgZmFsc2UgaWYgc2tpcHBlZC4gKi9cclxuXHRcdHN0YXRpYyBfYXBwbHlfcHJlc2V0X3dpdGhfbWluX2d1YXJkKGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHdlaWdodHMpIHtcclxuXHRcdFx0Y29uc3Qgcm93ID0gc2VjdGlvbl9lbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gLndwYmNfYmZiX19yb3cnICk7XHJcblx0XHRcdGlmICggIXJvdyApIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHRcdGNvbnN0IGZpdHRlZCA9IFVJLldQQkNfQkZCX0xheW91dF9DaGlwcy5fZml0X3dlaWdodHNfcmVzcGVjdGluZ19taW4oIGJ1aWxkZXIsIHJvdywgd2VpZ2h0cyApO1xyXG5cdFx0XHRpZiAoICFmaXR0ZWQgKSB7XHJcblx0XHRcdFx0YnVpbGRlcj8uX2Fubm91bmNlPy4oICdOb3QgZW5vdWdoIHNwYWNlIGZvciB0aGlzIGxheW91dCBiZWNhdXNlIG9mIGZpZWxkc+KAmSBtaW5pbXVtIHdpZHRocy4nICk7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBgZml0dGVkYCBhbHJlYWR5IHN1bXMgdG8gdGhlIHJvd+KAmXMgYXZhaWxhYmxlICUsIHNvIHdlIGNhbiBhcHBseSBiYXNlcyBkaXJlY3RseS5cclxuXHRcdFx0YnVpbGRlci5sYXlvdXQuYXBwbHlfYmFzZXNfdG9fcm93KCByb3csIGZpdHRlZCApO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBhbmQgYXBwZW5kIGxheW91dCBjaGlwcyBmb3IgYSBzZWN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXIgLSBUaGUgZm9ybSBidWlsZGVyIGluc3RhbmNlLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbCAtIFRoZSAud3BiY19iZmJfX3NlY3Rpb24gZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGhvc3RfZWwgLSBDb250YWluZXIgd2hlcmUgY2hpcHMgc2hvdWxkIGJlIHJlbmRlcmVkLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXJfZm9yX3NlY3Rpb24oYnVpbGRlciwgc2VjdGlvbl9lbCwgaG9zdF9lbCkge1xyXG5cclxuXHRcdFx0aWYgKCAhIGJ1aWxkZXIgfHwgISBzZWN0aW9uX2VsIHx8ICEgaG9zdF9lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRpZiAoICEgcm93ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgY29scyA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkubGVuZ3RoIHx8IDE7XHJcblxyXG5cdFx0XHQvLyBDbGVhciBob3N0LlxyXG5cdFx0XHRob3N0X2VsLmlubmVySFRNTCA9ICcnO1xyXG5cclxuXHRcdFx0Ly8gRXF1YWwgY2hpcC5cclxuXHRcdFx0aG9zdF9lbC5hcHBlbmRDaGlsZChcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9MYXlvdXRfQ2hpcHMuX21ha2VfY2hpcCggYnVpbGRlciwgc2VjdGlvbl9lbCwgQXJyYXkoIGNvbHMgKS5maWxsKCAxICksICdFcXVhbCcgKVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0Ly8gUHJlc2V0cyBiYXNlZCBvbiBjb2x1bW4gY291bnQuXHJcblx0XHRcdGNvbnN0IHByZXNldHMgPSBidWlsZGVyLmxheW91dC5idWlsZF9wcmVzZXRzX2Zvcl9jb2x1bW5zKCBjb2xzICk7XHJcblx0XHRcdHByZXNldHMuZm9yRWFjaCggKHdlaWdodHMpID0+IHtcclxuXHRcdFx0XHRob3N0X2VsLmFwcGVuZENoaWxkKFxyXG5cdFx0XHRcdFx0VUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLl9tYWtlX2NoaXAoIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHdlaWdodHMsIG51bGwgKVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIEN1c3RvbSBjaGlwLlxyXG5cdFx0XHRjb25zdCBjdXN0b21CdG4gICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnYnV0dG9uJyApO1xyXG5cdFx0XHRjdXN0b21CdG4udHlwZSAgICAgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0Y3VzdG9tQnRuLmNsYXNzTmFtZSAgID0gJ3dwYmNfYmZiX19sYXlvdXRfY2hpcCc7XHJcblx0XHRcdGN1c3RvbUJ0bi50ZXh0Q29udGVudCA9ICdDdXN0b23igKYnO1xyXG5cdFx0XHRjdXN0b21CdG4udGl0bGUgICAgICAgPSBgRW50ZXIgJHtjb2xzfSBwZXJjZW50YWdlc2A7XHJcblx0XHRcdGN1c3RvbUJ0bi5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCAoKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgZXhhbXBsZSA9IChjb2xzID09PSAyKSA/ICc1MCw1MCcgOiAoY29scyA9PT0gMyA/ICcyMCw2MCwyMCcgOiAnMjUsMjUsMjUsMjUnKTtcclxuXHRcdFx0XHRjb25zdCB0ZXh0ICAgID0gcHJvbXB0KCBgRW50ZXIgJHtjb2xzfSBwZXJjZW50YWdlcyAoY29tbWEgb3Igc3BhY2Ugc2VwYXJhdGVkKTpgLCBleGFtcGxlICk7XHJcblx0XHRcdFx0aWYgKCB0ZXh0ID09IG51bGwgKSByZXR1cm47XHJcblx0XHRcdFx0Y29uc3Qgd2VpZ2h0cyA9IGJ1aWxkZXIubGF5b3V0LnBhcnNlX3dlaWdodHMoIHRleHQgKTtcclxuXHRcdFx0XHRpZiAoIHdlaWdodHMubGVuZ3RoICE9PSBjb2xzICkge1xyXG5cdFx0XHRcdFx0YWxlcnQoIGBQbGVhc2UgZW50ZXIgZXhhY3RseSAke2NvbHN9IG51bWJlcnMuYCApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBPTEQ6XHJcblx0XHRcdFx0Ly8gYnVpbGRlci5sYXlvdXQuYXBwbHlfbGF5b3V0X3ByZXNldCggc2VjdGlvbl9lbCwgd2VpZ2h0cywgYnVpbGRlci5jb2xfZ2FwX3BlcmNlbnQgKTtcclxuXHRcdFx0XHQvLyBHdWFyZGVkIGFwcGx5Oi5cclxuXHRcdFx0XHRpZiAoICEgVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLl9hcHBseV9wcmVzZXRfd2l0aF9taW5fZ3VhcmQoIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHdlaWdodHMgKSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aG9zdF9lbC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19sYXlvdXRfY2hpcCcgKS5mb3JFYWNoKCBjID0+IGMuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWFjdGl2ZScgKSApO1xyXG5cdFx0XHRcdGN1c3RvbUJ0bi5jbGFzc0xpc3QuYWRkKCAnaXMtYWN0aXZlJyApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGhvc3RfZWwuYXBwZW5kQ2hpbGQoIGN1c3RvbUJ0biApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3JlYXRlIGEgc2luZ2xlIGxheW91dCBjaGlwIGJ1dHRvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtXUEJDX0Zvcm1fQnVpbGRlcn0gYnVpbGRlclxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbFxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJbXX0gd2VpZ2h0c1xyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gbGFiZWxcclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIF9tYWtlX2NoaXAoYnVpbGRlciwgc2VjdGlvbl9lbCwgd2VpZ2h0cywgbGFiZWwgPSBudWxsKSB7XHJcblxyXG5cdFx0XHRjb25zdCBidG4gICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2J1dHRvbicgKTtcclxuXHRcdFx0YnRuLnR5cGUgICAgICA9ICdidXR0b24nO1xyXG5cdFx0XHRidG4uY2xhc3NOYW1lID0gJ3dwYmNfYmZiX19sYXlvdXRfY2hpcCc7XHJcblxyXG5cdFx0XHRjb25zdCB0aXRsZSA9IGxhYmVsIHx8IGJ1aWxkZXIubGF5b3V0LmZvcm1hdF9wcmVzZXRfbGFiZWwoIHdlaWdodHMgKTtcclxuXHRcdFx0YnRuLnRpdGxlICAgPSB0aXRsZTtcclxuXHJcblx0XHRcdC8vIFZpc3VhbCBtaW5pYXR1cmUuXHJcblx0XHRcdGNvbnN0IHZpcyAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0XHR2aXMuY2xhc3NOYW1lID0gJ3dwYmNfYmZiX19sYXlvdXRfY2hpcC12aXMnO1xyXG5cdFx0XHRjb25zdCBzdW0gICAgID0gd2VpZ2h0cy5yZWR1Y2UoIChhLCBiKSA9PiBhICsgKE51bWJlciggYiApIHx8IDApLCAwICkgfHwgMTtcclxuXHRcdFx0d2VpZ2h0cy5mb3JFYWNoKCAodykgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGJhciAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XHJcblx0XHRcdFx0YmFyLnN0eWxlLmZsZXggPSBgMCAwIGNhbGMoICR7KChOdW1iZXIoIHcgKSB8fCAwKSAvIHN1bSAqIDEwMCkudG9GaXhlZCggMyApfSUgLSAxLjVweCApYDtcclxuXHRcdFx0XHR2aXMuYXBwZW5kQ2hpbGQoIGJhciApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGJ0bi5hcHBlbmRDaGlsZCggdmlzICk7XHJcblxyXG5cdFx0XHRjb25zdCB0eHQgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcclxuXHRcdFx0dHh0LmNsYXNzTmFtZSAgID0gJ3dwYmNfYmZiX19sYXlvdXRfY2hpcC1sYWJlbCc7XHJcblx0XHRcdHR4dC50ZXh0Q29udGVudCA9IGxhYmVsIHx8IGJ1aWxkZXIubGF5b3V0LmZvcm1hdF9wcmVzZXRfbGFiZWwoIHdlaWdodHMgKTtcclxuXHRcdFx0YnRuLmFwcGVuZENoaWxkKCB0eHQgKTtcclxuXHJcblx0XHRcdGJ0bi5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCAoKSA9PiB7XHJcblx0XHRcdFx0Ly8gT0xEOlxyXG5cdFx0XHRcdC8vIGJ1aWxkZXIubGF5b3V0LmFwcGx5X2xheW91dF9wcmVzZXQoIHNlY3Rpb25fZWwsIHdlaWdodHMsIGJ1aWxkZXIuY29sX2dhcF9wZXJjZW50ICk7XHJcblxyXG5cdFx0XHRcdC8vIE5FVzpcclxuXHRcdFx0XHRpZiAoICFVSS5XUEJDX0JGQl9MYXlvdXRfQ2hpcHMuX2FwcGx5X3ByZXNldF93aXRoX21pbl9ndWFyZCggYnVpbGRlciwgc2VjdGlvbl9lbCwgd2VpZ2h0cyApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBkbyBub3QgdG9nZ2xlIGFjdGl2ZSBpZiB3ZSBkaWRuJ3QgY2hhbmdlIGxheW91dFxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0YnRuLnBhcmVudEVsZW1lbnQ/LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2xheW91dF9jaGlwJyApLmZvckVhY2goIGMgPT4gYy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYWN0aXZlJyApICk7XHJcblx0XHRcdFx0YnRuLmNsYXNzTGlzdC5hZGQoICdpcy1hY3RpdmUnICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHJldHVybiBidG47XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2VsZWN0aW9uIGNvbnRyb2xsZXIgZm9yIGZpZWxkcyBhbmQgYW5ub3VuY2VtZW50cy5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9TZWxlY3Rpb25fQ29udHJvbGxlciA9IGNsYXNzIGV4dGVuZHMgVUkuV1BCQ19CRkJfTW9kdWxlIHtcclxuXHJcblx0XHRpbml0KCkge1xyXG5cclxuXHRcdFx0dGhpcy5fc2VsZWN0ZWRfdWlkICAgICAgICAgICAgICA9IG51bGw7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5zZWxlY3RfZmllbGQgICAgICAgPSB0aGlzLnNlbGVjdF9maWVsZC5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5nZXRfc2VsZWN0ZWRfZmllbGQgPSB0aGlzLmdldF9zZWxlY3RlZF9maWVsZC5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX29uX2NsZWFyICAgICAgICAgICAgICAgICAgPSB0aGlzLm9uX2NsZWFyLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLmJ1cy5vbiggV1BCQ19CRkJfRXZlbnRzLkNMRUFSX1NFTEVDVElPTiwgdGhpcy5fb25fY2xlYXIgKTtcclxuXHRcdFx0Ly8gZGVsZWdhdGVkIGNsaWNrIHNlbGVjdGlvbiAoY2FwdHVyZSBlbnN1cmVzIHdlIHdpbiBiZWZvcmUgYnViYmxpbmcgdG8gY29udGFpbmVycykuXHJcblx0XHRcdHRoaXMuX29uX2NhbnZhc19jbGljayA9IHRoaXMuX2hhbmRsZV9jYW52YXNfY2xpY2suYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIucGFnZXNfY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHRoaXMuX29uX2NhbnZhc19jbGljaywgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRlc3Ryb3koKSB7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5idXMub2ZmKCBXUEJDX0JGQl9FdmVudHMuQ0xFQVJfU0VMRUNUSU9OLCB0aGlzLl9vbl9jbGVhciApO1xyXG5cclxuXHRcdFx0aWYgKCB0aGlzLl9vbl9jYW52YXNfY2xpY2sgKSB7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLnBhZ2VzX2NvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9jYW52YXNfY2xpY2ssIHRydWUgKTtcclxuXHRcdFx0XHR0aGlzLl9vbl9jYW52YXNfY2xpY2sgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWxlZ2F0ZWQgY2FudmFzIGNsaWNrIC0+IHNlbGVjdCBjbG9zZXN0IGZpZWxkL3NlY3Rpb24gKGlubmVyIGJlYXRzIG91dGVyKS5cclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGVcclxuXHRcdCAqL1xyXG5cdFx0X2hhbmRsZV9jYW52YXNfY2xpY2soZSkge1xyXG5cdFx0XHRjb25zdCByb290ID0gdGhpcy5idWlsZGVyLnBhZ2VzX2NvbnRhaW5lcjtcclxuXHRcdFx0aWYgKCAhcm9vdCApIHJldHVybjtcclxuXHJcblx0XHRcdC8vIElnbm9yZSBjbGlja3Mgb24gY29udHJvbHMvaGFuZGxlcy9yZXNpemVycywgZXRjLlxyXG5cdFx0XHRjb25zdCBJR05PUkUgPSBbXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fb3ZlcmxheS1jb250cm9scycsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fbGF5b3V0X3BpY2tlcicsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fZHJhZy1oYW5kbGUnLFxyXG5cdFx0XHRcdCcud3BiY19iZmJfX2ZpZWxkLXJlbW92ZS1idG4nLFxyXG5cdFx0XHRcdCcud3BiY19iZmJfX2ZpZWxkLW1vdmUtdXAnLFxyXG5cdFx0XHRcdCcud3BiY19iZmJfX2ZpZWxkLW1vdmUtZG93bicsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fY29sdW1uLXJlc2l6ZXInXHJcblx0XHRcdF0uam9pbiggJywnICk7XHJcblxyXG5cdFx0XHRpZiAoIGUudGFyZ2V0LmNsb3Nlc3QoIElHTk9SRSApICkge1xyXG5cdFx0XHRcdHJldHVybjsgLy8gbGV0IHRob3NlIGNvbnRyb2xzIGRvIHRoZWlyIG93biB0aGluZy5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRmluZCB0aGUgY2xvc2VzdCBzZWxlY3RhYmxlIChmaWVsZCBPUiBzZWN0aW9uKSBmcm9tIHRoZSBjbGljayB0YXJnZXQuXHJcblx0XHRcdGNvbnN0IGhpdCA9IGUudGFyZ2V0LmNsb3Nlc3Q/LihcclxuXHRcdFx0XHRgJHtXUEJDX0JGQl9ET00uU0VMRUNUT1JTLnZhbGlkRmllbGR9LCAke1dQQkNfQkZCX0RPTS5TRUxFQ1RPUlMuc2VjdGlvbn1gXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHRpZiAoICEgaGl0IHx8ICEgcm9vdC5jb250YWlucyggaGl0ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuOyAvLyBlbXB0eSBzcGFjZSBpcyBoYW5kbGVkIGVsc2V3aGVyZS5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gU2VsZWN0IGFuZCBzdG9wIGJ1YmJsaW5nIHNvIG91dGVyIGNvbnRhaW5lcnMgZG9u4oCZdCByZXNlbGVjdCBhIHBhcmVudC5cclxuXHRcdFx0dGhpcy5zZWxlY3RfZmllbGQoIGhpdCApO1xyXG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNlbGVjdCBhIGZpZWxkIGVsZW1lbnQgb3IgY2xlYXIgc2VsZWN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gZmllbGRfZWxcclxuXHRcdCAqIEBwYXJhbSB7e3Njcm9sbEludG9WaWV3PzogYm9vbGVhbn19IFtvcHRzID0ge31dXHJcblx0XHQgKi9cclxuXHRcdHNlbGVjdF9maWVsZCggZmllbGRfZWwsIHsgc2Nyb2xsSW50b1ZpZXcgPSBmYWxzZSB9ID0ge30gKSB7XHJcblx0XHRcdGNvbnN0IHJvb3QgPSB0aGlzLmJ1aWxkZXIucGFnZXNfY29udGFpbmVyO1xyXG5cdFx0XHQvLyBJZ25vcmUgZWxlbWVudHMgbm90IGluIHRoZSBjYW52YXMuXHJcblx0XHRcdGlmICggZmllbGRfZWwgJiYgISByb290LmNvbnRhaW5zKCBmaWVsZF9lbCApICkge1xyXG5cdFx0XHRcdGZpZWxkX2VsID0gbnVsbDsgLy8gdHJlYXQgYXMgXCJubyBzZWxlY3Rpb25cIi5cclxuXHRcdFx0fVxyXG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcuaXMtc2VsZWN0ZWQnICkuZm9yRWFjaCggKCBuICkgPT4ge1xyXG5cdFx0XHRcdG4uY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXNlbGVjdGVkJyApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGlmICggISBmaWVsZF9lbCApIHtcclxuXHRcdFx0XHRjb25zdCBwcmV2ID0gdGhpcy5fc2VsZWN0ZWRfdWlkIHx8IG51bGw7XHJcblx0XHRcdFx0dGhpcy5fc2VsZWN0ZWRfdWlkID0gbnVsbDtcclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXIuaW5zcGVjdG9yPy5jbGVhcj8uKCk7XHJcblx0XHRcdFx0cm9vdC5jbGFzc0xpc3QucmVtb3ZlKCAnaGFzLXNlbGVjdGlvbicgKTtcclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXIuYnVzLmVtaXQoIFdQQkNfQkZCX0V2ZW50cy5DTEVBUl9TRUxFQ1RJT04sIHsgcHJldl91aWQ6IHByZXYsIHNvdXJjZTogJ2J1aWxkZXInIH0gKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0ZmllbGRfZWwuY2xhc3NMaXN0LmFkZCggJ2lzLXNlbGVjdGVkJyApO1xyXG5cdFx0XHR0aGlzLl9zZWxlY3RlZF91aWQgPSBmaWVsZF9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXVpZCcgKSB8fCBudWxsO1xyXG5cdFx0XHRpZiAoIHNjcm9sbEludG9WaWV3ICkge1xyXG5cdFx0XHRcdGZpZWxkX2VsLnNjcm9sbEludG9WaWV3KCB7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICdjZW50ZXInIH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuaW5zcGVjdG9yPy5iaW5kX3RvX2ZpZWxkPy4oIGZpZWxkX2VsICk7XHJcblx0XHRcdHJvb3QuY2xhc3NMaXN0LmFkZCggJ2hhcy1zZWxlY3Rpb24nICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5idXMuZW1pdCggV1BCQ19CRkJfRXZlbnRzLlNFTEVDVCwgeyB1aWQ6IHRoaXMuX3NlbGVjdGVkX3VpZCwgZWw6IGZpZWxkX2VsIH0gKTtcclxuXHRcdFx0Y29uc3QgbGFiZWwgPSBmaWVsZF9lbD8ucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZmllbGQtbGFiZWwnICk/LnRleHRDb250ZW50IHx8IChmaWVsZF9lbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSA/ICdzZWN0aW9uJyA6ICcnKSB8fCBmaWVsZF9lbD8uZGF0YXNldD8uaWQgfHwgJ2l0ZW0nO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuX2Fubm91bmNlKCAnU2VsZWN0ZWQgJyArIGxhYmVsICsgJy4nICk7XHJcblx0XHR9XHJcblx0XHQvKiogQHJldHVybnMge0hUTUxFbGVtZW50fG51bGx9ICovXHJcblx0XHRnZXRfc2VsZWN0ZWRfZmllbGQoKSB7XHJcblx0XHRcdGlmICggIXRoaXMuX3NlbGVjdGVkX3VpZCApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBlc2NfYXR0ciA9IFdQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdGhpcy5fc2VsZWN0ZWRfdWlkICk7XHJcblx0XHRcdHJldHVybiB0aGlzLmJ1aWxkZXIucGFnZXNfY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoIGAud3BiY19iZmJfX2ZpZWxkW2RhdGEtdWlkPVwiJHtlc2NfYXR0cn1cIl0sIC53cGJjX2JmYl9fc2VjdGlvbltkYXRhLXVpZD1cIiR7ZXNjX2F0dHJ9XCJdYCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldiAqL1xyXG5cdFx0b25fY2xlYXIoIGV2ICkge1xyXG5cdFx0XHRjb25zdCBzcmMgPSBldj8uZGV0YWlsPy5zb3VyY2U7XHJcblx0XHRcdGlmICggc3JjICE9PSAnYnVpbGRlcicgKSB7XHJcblx0XHRcdFx0dGhpcy5zZWxlY3RfZmllbGQoIG51bGwgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJyaWRnZXMgdGhlIGJ1aWxkZXIgd2l0aCB0aGUgSW5zcGVjdG9yIGFuZCBzYW5pdGl6ZXMgaWQvbmFtZSBlZGl0cy5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9JbnNwZWN0b3JfQnJpZGdlID0gY2xhc3MgZXh0ZW5kcyBVSS5XUEJDX0JGQl9Nb2R1bGUge1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0dGhpcy5fYXR0YWNoX2luc3BlY3RvcigpO1xyXG5cdFx0XHR0aGlzLl9iaW5kX2lkX3Nhbml0aXplcigpO1xyXG5cdFx0fVxyXG5cdFx0X2F0dGFjaF9pbnNwZWN0b3IoKSB7XHJcblx0XHRcdGNvbnN0IGIgICAgICA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Y29uc3QgYXR0YWNoID0gKCkgPT4ge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIHdpbmRvdy5XUEJDX0JGQl9JbnNwZWN0b3IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRiLmluc3BlY3RvciA9IG5ldyBXUEJDX0JGQl9JbnNwZWN0b3IoIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKSwgYiApO1xyXG5cdFx0XHRcdFx0dGhpcy5fYmluZF9pZF9zYW5pdGl6ZXIoKTtcclxuXHRcdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLCBhdHRhY2ggKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblx0XHRcdC8vIEVuc3VyZSB3ZSBiaW5kIGFmdGVyIGxhdGUgcmVhZHkgYXMgd2VsbC5cclxuXHRcdFx0aWYgKCB0eXBlb2Ygd2luZG93LldQQkNfQkZCX0luc3BlY3RvciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRhdHRhY2goKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRiLmluc3BlY3RvciA9IHsgYmluZF90b19maWVsZCgpIHt9LCBjbGVhcigpIHt9IH07XHJcblx0XHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZWFkeScsIGF0dGFjaCApO1xyXG5cdFx0XHRcdHNldFRpbWVvdXQoIGF0dGFjaCwgMCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRfYmluZF9pZF9zYW5pdGl6ZXIoKSB7XHJcblx0XHRcdGNvbnN0IGIgICA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRpZiAoICEgaW5zICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHQvKiogQHBhcmFtIHtFdmVudH0gZSAqL1xyXG5cdFx0XHRjb25zdCBoYW5kbGVyID0gKCBlICkgPT4ge1xyXG5cclxuXHRcdFx0XHRjb25zdCB0ID0gZS50YXJnZXQ7XHJcblx0XHRcdFx0aWYgKCAhIHQgfHwgISAoICd2YWx1ZScgaW4gdCApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zdCBrZXkgPSAoIHQuZGF0YXNldD8uaW5zcGVjdG9yS2V5IHx8ICcnICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0XHRpZiAoIGtleSAhPT0gJ25hbWUnICYmIGtleSAhPT0gJ2h0bWxfaWQnICYmIGtleSAhPT0gJ2lkJyApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y29uc3Qgc2VsID0gYi5nZXRfc2VsZWN0ZWRfZmllbGQ/LigpO1xyXG5cdFx0XHRcdGlmICggISBzZWwgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICgga2V5ID09PSAnbmFtZScgKSB7XHJcblx0XHRcdFx0XHRjb25zdCB1bmlxdWUgPSBiLmlkLnNldF9maWVsZF9uYW1lKCBzZWwsIHQudmFsdWUgKTtcclxuXHRcdFx0XHRcdGlmICggYi5wcmV2aWV3X21vZGUgKSB7XHJcblx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCB0LnZhbHVlICE9PSB1bmlxdWUgKSB7XHJcblx0XHRcdFx0XHRcdHQudmFsdWUgPSB1bmlxdWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICgga2V5ID09PSAnaWQnICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgdW5pcXVlID0gYi5pZC5zZXRfZmllbGRfaWQoIHNlbCwgdC52YWx1ZSApO1xyXG5cdFx0XHRcdFx0aWYgKCBiLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHRcdFx0Yi5yZW5kZXJfcHJldmlldyggc2VsICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHQudmFsdWUgIT09IHVuaXF1ZSApIHtcclxuXHRcdFx0XHRcdFx0dC52YWx1ZSA9IHVuaXF1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBrZXkgPT09ICdodG1sX2lkJyApIHtcclxuXHRcdFx0XHRcdGNvbnN0IGFwcGxpZWQgPSBiLmlkLnNldF9maWVsZF9odG1sX2lkKCBzZWwsIHQudmFsdWUgKTtcclxuXHRcdFx0XHRcdGlmICggYi5wcmV2aWV3X21vZGUgKSB7XHJcblx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCB0LnZhbHVlICE9PSBhcHBsaWVkICkge1xyXG5cdFx0XHRcdFx0XHR0LnZhbHVlID0gYXBwbGllZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblx0XHRcdGlucy5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlciwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEtleWJvYXJkIHNob3J0Y3V0cyBmb3Igc2VsZWN0aW9uLCBkZWxldGlvbiwgYW5kIG1vdmVtZW50LlxyXG5cdCAqL1xyXG5cdFVJLldQQkNfQkZCX0tleWJvYXJkX0NvbnRyb2xsZXIgPSBjbGFzcyBleHRlbmRzIFVJLldQQkNfQkZCX01vZHVsZSB7XHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLl9vbl9rZXkgPSB0aGlzLm9uX2tleS5iaW5kKCB0aGlzICk7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgdGhpcy5fb25fa2V5LCB0cnVlICk7XHJcblx0XHR9XHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIHRoaXMuX29uX2tleSwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cdFx0LyoqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZSAqL1xyXG5cdFx0b25fa2V5KCBlICkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRjb25zdCBpc190eXBpbmcgPSB0aGlzLl9pc190eXBpbmdfYW55d2hlcmUoKTtcclxuXHRcdFx0aWYgKCBlLmtleSA9PT0gJ0VzY2FwZScgKSB7XHJcblx0XHRcdFx0aWYgKCBpc190eXBpbmcgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoXHJcblx0XHRcdFx0XHRuZXcgQ3VzdG9tRXZlbnQoIFdQQkNfQkZCX0V2ZW50cy5DTEVBUl9TRUxFQ1RJT04sIHsgZGV0YWlsOiB7IHNvdXJjZTogJ2VzYycgfSwgYnViYmxlczogdHJ1ZSB9IClcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBzZWxlY3RlZCA9IGIuZ2V0X3NlbGVjdGVkX2ZpZWxkPy4oKTtcclxuXHRcdFx0aWYgKCAhIHNlbGVjdGVkIHx8IGlzX3R5cGluZyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBlLmtleSA9PT0gJ0RlbGV0ZScgfHwgZS5rZXkgPT09ICdCYWNrc3BhY2UnICkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRjb25zdCBuZWlnaGJvciA9IGIuX2ZpbmRfbmVpZ2hib3Jfc2VsZWN0YWJsZT8uKCBzZWxlY3RlZCApO1xyXG5cdFx0XHRcdHNlbGVjdGVkLnJlbW92ZSgpO1xyXG5cdFx0XHRcdGIuYnVzLmVtaXQoIFdQQkNfQkZCX0V2ZW50cy5GSUVMRF9SRU1PVkUsIHsgaWQ6IHNlbGVjdGVkPy5kYXRhc2V0Py5pZCwgdWlkOiBzZWxlY3RlZD8uZGF0YXNldD8udWlkIH0gKTtcclxuXHRcdFx0XHRiLnVzYWdlLnVwZGF0ZV9wYWxldHRlX3VpKCk7XHJcblx0XHRcdFx0Yi5zZWxlY3RfZmllbGQoIG5laWdoYm9yIHx8IG51bGwgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAoIGUuYWx0S2V5IHx8IGUuY3RybEtleSB8fCBlLm1ldGFLZXkgKSAmJiAoIGUua2V5ID09PSAnQXJyb3dVcCcgfHwgZS5rZXkgPT09ICdBcnJvd0Rvd24nICkgJiYgISBlLnNoaWZ0S2V5ICkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRjb25zdCBkaXIgPSAoIGUua2V5ID09PSAnQXJyb3dVcCcgKSA/ICd1cCcgOiAnZG93bic7XHJcblx0XHRcdFx0Yi5tb3ZlX2l0ZW0/Liggc2VsZWN0ZWQsIGRpciApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGUua2V5ID09PSAnRW50ZXInICkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRiLnNlbGVjdF9maWVsZCggc2VsZWN0ZWQsIHsgc2Nyb2xsSW50b1ZpZXc6IHRydWUgfSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHQvKiogQHJldHVybnMge2Jvb2xlYW59ICovXHJcblx0XHRfaXNfdHlwaW5nX2FueXdoZXJlKCkge1xyXG5cdFx0XHRjb25zdCBhID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcclxuXHRcdFx0Y29uc3QgdGFnID0gYT8udGFnTmFtZTtcclxuXHRcdFx0aWYgKCB0YWcgPT09ICdJTlBVVCcgfHwgdGFnID09PSAnVEVYVEFSRUEnIHx8IHRhZyA9PT0gJ1NFTEVDVCcgfHwgKCBhPy5pc0NvbnRlbnRFZGl0YWJsZSA9PT0gdHJ1ZSApICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGlucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0cmV0dXJuICEhKCBpbnMgJiYgYSAmJiBpbnMuY29udGFpbnMoIGEgKSApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbHVtbiByZXNpemUgbG9naWMgZm9yIHNlY3Rpb24gcm93cy5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9SZXNpemVfQ29udHJvbGxlciA9IGNsYXNzIGV4dGVuZHMgVUkuV1BCQ19CRkJfTW9kdWxlIHtcclxuXHRcdGluaXQoKSB7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5pbml0X3Jlc2l6ZV9oYW5kbGVyID0gdGhpcy5oYW5kbGVfcmVzaXplLmJpbmQoIHRoaXMgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIHJlYWQgdGhlIENTUyB2YXIgKGtlcHQgbG9jYWwgc28gaXQgZG9lc27igJl0IGRlcGVuZCBvbiB0aGUgTWluLVdpZHRoIG1vZHVsZSlcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gY29sXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfG51bWJlcn1cclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKi9cclxuXHRcdF9nZXRfY29sX21pbl9weChjb2wpIHtcclxuXHRcdFx0Y29uc3QgdiA9IGdldENvbXB1dGVkU3R5bGUoIGNvbCApLmdldFByb3BlcnR5VmFsdWUoICctLXdwYmMtY29sLW1pbicgKSB8fCAnMCc7XHJcblx0XHRcdGNvbnN0IG4gPSBwYXJzZUZsb2F0KCB2ICk7XHJcblx0XHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIG4gKSA/IE1hdGgubWF4KCAwLCBuICkgOiAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBAcGFyYW0ge01vdXNlRXZlbnR9IGUgKi9cclxuXHRcdGhhbmRsZV9yZXNpemUoZSkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGlmICggZS5idXR0b24gIT09IDAgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCByZXNpemVyICAgPSBlLmN1cnJlbnRUYXJnZXQ7XHJcblx0XHRcdGNvbnN0IHJvd19lbCAgICA9IHJlc2l6ZXIucGFyZW50RWxlbWVudDtcclxuXHRcdFx0Y29uc3QgY29scyAgICAgID0gQXJyYXkuZnJvbSggcm93X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSApO1xyXG5cdFx0XHRjb25zdCBsZWZ0X2NvbCAgPSByZXNpemVyPy5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xyXG5cdFx0XHRjb25zdCByaWdodF9jb2wgPSByZXNpemVyPy5uZXh0RWxlbWVudFNpYmxpbmc7XHJcblx0XHRcdGlmICggIWxlZnRfY29sIHx8ICFyaWdodF9jb2wgfHwgIWxlZnRfY29sLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19jb2x1bW4nICkgfHwgIXJpZ2h0X2NvbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fY29sdW1uJyApICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgbGVmdF9pbmRleCAgPSBjb2xzLmluZGV4T2YoIGxlZnRfY29sICk7XHJcblx0XHRcdGNvbnN0IHJpZ2h0X2luZGV4ID0gY29scy5pbmRleE9mKCByaWdodF9jb2wgKTtcclxuXHRcdFx0aWYgKCBsZWZ0X2luZGV4ID09PSAtMSB8fCByaWdodF9pbmRleCAhPT0gbGVmdF9pbmRleCArIDEgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBzdGFydF94ICAgICAgICA9IGUuY2xpZW50WDtcclxuXHRcdFx0Y29uc3QgbGVmdF9zdGFydF9weCAgPSBsZWZ0X2NvbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aDtcclxuXHRcdFx0Y29uc3QgcmlnaHRfc3RhcnRfcHggPSByaWdodF9jb2wuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XHJcblx0XHRcdGNvbnN0IHBhaXJfcHggICAgICAgID0gTWF0aC5tYXgoIDAsIGxlZnRfc3RhcnRfcHggKyByaWdodF9zdGFydF9weCApO1xyXG5cclxuXHRcdFx0Y29uc3QgZ3AgICAgICAgICA9IGIuY29sX2dhcF9wZXJjZW50O1xyXG5cdFx0XHRjb25zdCBjb21wdXRlZCAgID0gYi5sYXlvdXQuY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3coIHJvd19lbCwgZ3AgKTtcclxuXHRcdFx0Y29uc3QgYXZhaWxhYmxlICA9IGNvbXB1dGVkLmF2YWlsYWJsZTsgICAgICAgICAgICAgICAgIC8vICUgb2YgdGhlIOKAnGZ1bGwgMTAw4oCdIGFmdGVyIGdhcHNcclxuXHRcdFx0Y29uc3QgYmFzZXMgICAgICA9IGNvbXB1dGVkLmJhc2VzLnNsaWNlKCAwICk7ICAgICAgICAgICAgLy8gY3VycmVudCBlZmZlY3RpdmUgJVxyXG5cdFx0XHRjb25zdCBwYWlyX2F2YWlsID0gYmFzZXNbbGVmdF9pbmRleF0gKyBiYXNlc1tyaWdodF9pbmRleF07XHJcblxyXG5cdFx0XHQvLyAtLS0gTUlOIENMQU1QUyAocGl4ZWxzKSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGNvbnN0IHBjdFRvUHggICAgICAgPSAocGN0KSA9PiAocGFpcl9weCAqIChwY3QgLyBwYWlyX2F2YWlsKSk7IC8vIHBhaXItbG9jYWwgcGVyY2VudCDihpIgcHhcclxuXHRcdFx0Y29uc3QgZ2VuZXJpY01pblBjdCA9IE1hdGgubWluKCA1LCBhdmFpbGFibGUgKTsgICAgICAgICAgICAgICAgICAvLyBvcmlnaW5hbCA1JSBmbG9vciAoaW4g4oCcYXZhaWxhYmxlICXigJ0gc3BhY2UpXHJcblx0XHRcdGNvbnN0IGdlbmVyaWNNaW5QeCAgPSBwY3RUb1B4KCBnZW5lcmljTWluUGN0ICk7XHJcblxyXG5cdFx0XHRjb25zdCBsZWZ0TWluUHggID0gTWF0aC5tYXgoIHRoaXMuX2dldF9jb2xfbWluX3B4KCBsZWZ0X2NvbCApLCBnZW5lcmljTWluUHggKTtcclxuXHRcdFx0Y29uc3QgcmlnaHRNaW5QeCA9IE1hdGgubWF4KCB0aGlzLl9nZXRfY29sX21pbl9weCggcmlnaHRfY29sICksIGdlbmVyaWNNaW5QeCApO1xyXG5cclxuXHRcdFx0Ly8gZnJlZXplIHRleHQgc2VsZWN0aW9uICsgY3Vyc29yXHJcblx0XHRcdGNvbnN0IHByZXZfdXNlcl9zZWxlY3QgICAgICAgICA9IGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdDtcclxuXHRcdFx0ZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xyXG5cdFx0XHRyb3dfZWwuc3R5bGUuY3Vyc29yICAgICAgICAgICAgPSAnY29sLXJlc2l6ZSc7XHJcblxyXG5cdFx0XHRjb25zdCBvbl9tb3VzZV9tb3ZlID0gKGV2KSA9PiB7XHJcblx0XHRcdFx0aWYgKCAhcGFpcl9weCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Ly8gd29yayBpbiBwaXhlbHMsIGNsYW1wIGJ5IGVhY2ggc2lkZeKAmXMgbWluXHJcblx0XHRcdFx0Y29uc3QgZGVsdGFfcHggICA9IGV2LmNsaWVudFggLSBzdGFydF94O1xyXG5cdFx0XHRcdGxldCBuZXdMZWZ0UHggICAgPSBsZWZ0X3N0YXJ0X3B4ICsgZGVsdGFfcHg7XHJcblx0XHRcdFx0bmV3TGVmdFB4ICAgICAgICA9IE1hdGgubWF4KCBsZWZ0TWluUHgsIE1hdGgubWluKCBwYWlyX3B4IC0gcmlnaHRNaW5QeCwgbmV3TGVmdFB4ICkgKTtcclxuXHRcdFx0XHRjb25zdCBuZXdSaWdodFB4ID0gcGFpcl9weCAtIG5ld0xlZnRQeDtcclxuXHJcblx0XHRcdFx0Ly8gdHJhbnNsYXRlIGJhY2sgdG8gcGFpci1sb2NhbCBwZXJjZW50YWdlc1xyXG5cdFx0XHRcdGNvbnN0IG5ld0xlZnRQY3QgICAgICA9IChuZXdMZWZ0UHggLyBwYWlyX3B4KSAqIHBhaXJfYXZhaWw7XHJcblx0XHRcdFx0Y29uc3QgbmV3QmFzZXMgICAgICAgID0gYmFzZXMuc2xpY2UoIDAgKTtcclxuXHRcdFx0XHRuZXdCYXNlc1tsZWZ0X2luZGV4XSAgPSBuZXdMZWZ0UGN0O1xyXG5cdFx0XHRcdG5ld0Jhc2VzW3JpZ2h0X2luZGV4XSA9IHBhaXJfYXZhaWwgLSBuZXdMZWZ0UGN0O1xyXG5cclxuXHRcdFx0XHRiLmxheW91dC5hcHBseV9iYXNlc190b19yb3coIHJvd19lbCwgbmV3QmFzZXMgKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGNvbnN0IG9uX21vdXNlX3VwID0gKCkgPT4ge1xyXG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdtb3VzZW1vdmUnLCBvbl9tb3VzZV9tb3ZlICk7XHJcblx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ21vdXNldXAnLCBvbl9tb3VzZV91cCApO1xyXG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIG9uX21vdXNlX3VwICk7XHJcblx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ21vdXNlbGVhdmUnLCBvbl9tb3VzZV91cCApO1xyXG5cdFx0XHRcdGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9IHByZXZfdXNlcl9zZWxlY3QgfHwgJyc7XHJcblx0XHRcdFx0cm93X2VsLnN0eWxlLmN1cnNvciAgICAgICAgICAgID0gJyc7XHJcblxyXG5cdFx0XHRcdC8vIG5vcm1hbGl6ZSB0byB0aGUgcm934oCZcyBhdmFpbGFibGUgJSBhZ2FpblxyXG5cdFx0XHRcdGNvbnN0IG5vcm1hbGl6ZWQgPSBiLmxheW91dC5jb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3Jvdyggcm93X2VsLCBncCApO1xyXG5cdFx0XHRcdGIubGF5b3V0LmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93X2VsLCBub3JtYWxpemVkLmJhc2VzICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vtb3ZlJywgb25fbW91c2VfbW92ZSApO1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIG9uX21vdXNlX3VwICk7XHJcblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIG9uX21vdXNlX3VwICk7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWxlYXZlJywgb25fbW91c2VfdXAgKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUGFnZSBhbmQgc2VjdGlvbiBjcmVhdGlvbiwgcmVidWlsZGluZywgYW5kIG5lc3RlZCBTb3J0YWJsZSBzZXR1cC5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9QYWdlc19TZWN0aW9ucyA9IGNsYXNzIGV4dGVuZHMgVUkuV1BCQ19CRkJfTW9kdWxlIHtcclxuXHRcdGluaXQoKSB7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5hZGRfcGFnZSA9ICggb3B0cyApID0+IHRoaXMuYWRkX3BhZ2UoIG9wdHMgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLmFkZF9zZWN0aW9uID0gKCBjb250YWluZXIsIGNvbHMgKSA9PiB0aGlzLmFkZF9zZWN0aW9uKCBjb250YWluZXIsIGNvbHMgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLnJlYnVpbGRfc2VjdGlvbiA9ICggc2VjdGlvbl9kYXRhLCBjb250YWluZXIgKSA9PiB0aGlzLnJlYnVpbGRfc2VjdGlvbiggc2VjdGlvbl9kYXRhLCBjb250YWluZXIgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLmluaXRfYWxsX25lc3RlZF9zb3J0YWJsZXMgPSAoIGVsICkgPT4gdGhpcy5pbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzKCBlbCApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuaW5pdF9zZWN0aW9uX3NvcnRhYmxlID0gKCBlbCApID0+IHRoaXMuaW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBlbCApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIucGFnZXNfc2VjdGlvbnMgPSB0aGlzO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9tYWtlX2FkZF9jb2x1bW5zX2NvbnRyb2wocGFnZV9lbCwgc2VjdGlvbl9jb250YWluZXIpIHtcclxuXHJcblx0XHRcdGNvbnN0IHRwbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2FkZF9jb2x1bW5zX3RlbXBsYXRlJyApO1xyXG5cdFx0XHRpZiAoICEgdHBsICkgeyByZXR1cm4gbnVsbDsgfVxyXG5cclxuXHRcdFx0Ly8gQ2xvbmUgKmNvbnRlbnRzKiAobm90IHRoZSBpZCksIHVuaGlkZSwgYW5kIGFkZCBhIHBhZ2Utc2NvcGVkIGNsYXNzLlxyXG5cdFx0XHRjb25zdCBzcmMgID0gKHRwbC5jb250ZW50ICYmIHRwbC5jb250ZW50LmZpcnN0RWxlbWVudENoaWxkKSA/IHRwbC5jb250ZW50LmZpcnN0RWxlbWVudENoaWxkIDogdHBsLmZpcnN0RWxlbWVudENoaWxkO1xyXG5cdFx0XHRpZiAoICEgc3JjICkgeyByZXR1cm4gbnVsbDsgfVxyXG5cdFx0XHRjb25zdCBjbG9uZSA9IHNyYy5jbG9uZU5vZGUoIHRydWUgKTtcclxuXHRcdFx0Y2xvbmUucmVtb3ZlQXR0cmlidXRlKCAnaGlkZGVuJyApO1xyXG5cclxuXHRcdFx0Ly8gSWYgYW55IGlubGluZSBvbmNsaWNrIHNudWNrIGluLCBzdHJpcCBpdCAoZGVmZW5zaXZlKS5cclxuXHRcdFx0Y2xvbmUucXVlcnlTZWxlY3RvckFsbCggJ1tvbmNsaWNrXScgKS5mb3JFYWNoKCBuID0+IG4ucmVtb3ZlQXR0cmlidXRlKCAnb25jbGljaycgKSApO1xyXG5cclxuXHRcdFx0Ly8gQ2xpY2sgb24gb3B0aW9ucyAtIGFkZCBzZWN0aW9uIHdpdGggTiBjb2x1bW5zLlxyXG5cdFx0XHRjbG9uZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCAoZSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGEgPSBlLnRhcmdldC5jbG9zZXN0KCAnLnVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uX2FkZF9zZWN0aW9ucycgKTtcclxuXHRcdFx0XHRpZiAoICEgYSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0XHQvLyBSZWFkIE4gZWl0aGVyIGZyb20gZGF0YS1jb2xzIG9yIGZhbGxiYWNrIHRvIHBhcnNpbmcgdGV4dCBsaWtlIFwiMyBDb2x1bW5zXCIuXHJcblx0XHRcdFx0bGV0IGNvbHMgPSBwYXJzZUludCggYS5kYXRhc2V0LmNvbHMgfHwgKGEudGV4dENvbnRlbnQubWF0Y2goIC9cXGIoXFxkKylcXHMqQ29sdW1uL2kgKT8uWzFdID8/ICcxJyksIDEwICk7XHJcblx0XHRcdFx0Y29scyAgICAgPSBNYXRoLm1heCggMSwgTWF0aC5taW4oIDQsIGNvbHMgKSApO1xyXG5cclxuXHRcdFx0XHR0aGlzLmFkZF9zZWN0aW9uKCBzZWN0aW9uX2NvbnRhaW5lciwgY29scyApO1xyXG5cclxuXHRcdFx0XHQvLyBPcHRpb25hbDogcmVmbGVjdCBsYXN0IGNob2ljZS5cclxuXHRcdFx0XHRjb25zdCB2YWwgPSBjbG9uZS5xdWVyeVNlbGVjdG9yKCAnLnNlbGVjdGVkX3ZhbHVlJyApO1xyXG5cdFx0XHRcdGlmICggdmFsICkge1xyXG5cdFx0XHRcdFx0dmFsLnRleHRDb250ZW50ID0gYCgke2NvbHN9KWA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gY2xvbmU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge3tzY3JvbGw/OiBib29sZWFufX0gW29wdHMgPSB7fV1cclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH1cclxuXHRcdCAqL1xyXG5cdFx0YWRkX3BhZ2UoIHsgc2Nyb2xsID0gdHJ1ZSB9ID0ge30gKSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGNvbnN0IHBhZ2VfZWwgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX3BhbmVsIHdwYmNfYmZiX19wYW5lbC0tcHJldmlldyAgd3BiY19jb250YWluZXIgd3BiY19mb3JtIHdwYmNfY29udGFpbmVyX2Jvb2tpbmdfZm9ybScgKTtcclxuXHRcdFx0cGFnZV9lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLXBhZ2UnLCArK2IucGFnZV9jb3VudGVyICk7XHJcblxyXG5cdFx0XHQvLyBLZWVwIG9ubHkgdGhlIHRpdGxlIGFuZCB0aGUgc2VjdGlvbiBjb250YWluZXIgcGxhY2Vob2xkZXJzIGhlcmUuXHJcblx0XHRcdHBhZ2VfZWwuaW5uZXJIVE1MID0gYFxyXG5cdFx0XHRcdDxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fY29udHJvbHNcIj48aDM+UGFnZSAke2IucGFnZV9jb3VudGVyfTwvaDM+PC9kaXY+XHJcblx0XHRcdFx0PGRpdiBjbGFzcz1cIndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXIgd3BiY193aXphcmRfX2JvcmRlcl9jb250YWluZXJcIj48L2Rpdj5cclxuXHRcdFx0ICBgO1xyXG5cclxuXHRcdFx0Y29uc3QgZGVsZXRlX2J0biA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ2J1dHRvbicsICd3cGJjX2JmYl9fZmllbGQtcmVtb3ZlLWJ0bicsICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2Nsb3NlXCI+PC9pPicgKTtcclxuXHRcdFx0ZGVsZXRlX2J0bi50eXBlID0gJ2J1dHRvbic7XHJcblx0XHRcdGRlbGV0ZV9idG4udGl0bGUgPSAnUmVtb3ZlIHBhZ2UnO1xyXG5cdFx0XHRkZWxldGVfYnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCAnUmVtb3ZlIHBhZ2UnICk7XHJcblx0XHRcdGRlbGV0ZV9idG4ub25jbGljayA9ICgpID0+IHtcclxuXHRcdFx0XHRjb25zdCBzZWxlY3RlZCA9IGIuZ2V0X3NlbGVjdGVkX2ZpZWxkPy4oKTtcclxuXHRcdFx0XHRsZXQgbmVpZ2hib3IgPSBudWxsO1xyXG5cdFx0XHRcdGlmICggc2VsZWN0ZWQgJiYgcGFnZV9lbC5jb250YWlucyggc2VsZWN0ZWQgKSApIHtcclxuXHRcdFx0XHRcdG5laWdoYm9yID0gYi5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXc6bm90KFtkYXRhLXBhZ2U9XCInICsgcGFnZV9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXBhZ2UnICkgKyAnXCJdKSAud3BiY19iZmJfX2ZpZWxkOm5vdCguaXMtaW52YWxpZCknICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHBhZ2VfZWwucmVtb3ZlKCk7XHJcblx0XHRcdFx0Yi51c2FnZS51cGRhdGVfcGFsZXR0ZV91aSgpO1xyXG5cdFx0XHRcdGIuc2VsZWN0X2ZpZWxkKCBuZWlnaGJvciB8fCBudWxsICk7XHJcblx0XHRcdH07XHJcblx0XHRcdHBhZ2VfZWwucXVlcnlTZWxlY3RvciggJ2gzJyApLmFwcGVuZENoaWxkKCBkZWxldGVfYnRuICk7XHJcblxyXG5cdFx0XHRiLnBhZ2VzX2NvbnRhaW5lci5hcHBlbmRDaGlsZCggcGFnZV9lbCApO1xyXG5cdFx0XHRpZiAoIHNjcm9sbCApIHtcclxuXHRcdFx0XHRwYWdlX2VsLnNjcm9sbEludG9WaWV3KCB7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICdzdGFydCcgfSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBzZWN0aW9uX2NvbnRhaW5lciAgICAgICAgICA9IHBhZ2VfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cdFx0XHRjb25zdCBzZWN0aW9uX2Nvb3VudF9vbl9hZGRfcGFnZSA9IDI7XHJcblx0XHRcdHRoaXMuaW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBzZWN0aW9uX2NvbnRhaW5lciApO1xyXG5cdFx0XHR0aGlzLmFkZF9zZWN0aW9uKCBzZWN0aW9uX2NvbnRhaW5lciwgc2VjdGlvbl9jb291bnRfb25fYWRkX3BhZ2UgKTtcclxuXHJcblx0XHRcdC8vIGRyb3Bkb3duIGNvbnRyb2wgY2xvbmVkIGZyb20gdGhlIGhpZGRlbiB0ZW1wbGF0ZS5cclxuXHRcdFx0Y29uc3QgY29udHJvbHNIb3N0ICA9IHBhZ2VfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fY29udHJvbHMnICk7XHJcblx0XHRcdGNvbnN0IGN1c3RvbUNvbnRyb2wgPSB0aGlzLl9tYWtlX2FkZF9jb2x1bW5zX2NvbnRyb2woIHBhZ2VfZWwsIHNlY3Rpb25fY29udGFpbmVyICk7XHJcblx0XHRcdGlmICggY3VzdG9tQ29udHJvbCApIHtcclxuXHRcdFx0XHRjb250cm9sc0hvc3QuYXBwZW5kQ2hpbGQoIGN1c3RvbUNvbnRyb2wgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gcGFnZV9lbDtcclxuXHRcdH1cclxuXHRcdC8qKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gY29sc1xyXG5cdFx0ICovXHJcblx0XHRhZGRfc2VjdGlvbiggY29udGFpbmVyLCBjb2xzICkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRjb2xzID0gTWF0aC5tYXgoIDEsIHBhcnNlSW50KCBjb2xzLCAxMCApIHx8IDEgKTtcclxuXHRcdFx0Y29uc3Qgc2VjdGlvbiA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ2RpdicsICd3cGJjX2JmYl9fc2VjdGlvbicgKTtcclxuXHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLWlkJywgYHNlY3Rpb24tJHsgKytiLnNlY3Rpb25fY291bnRlciB9LSR7IERhdGUubm93KCkgfWAgKTtcclxuXHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLXVpZCcsIGBzLSR7KytiLl91aWRfY291bnRlcn0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDcgKX1gICk7XHJcblx0XHRcdGNvbnN0IHJvdyA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ2RpdicsICd3cGJjX2JmYl9fcm93IHdwYmNfX3JvdycgKTtcclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgY29sczsgaSsrICkge1xyXG5cdFx0XHRcdGNvbnN0IGNvbCA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ2RpdicsICd3cGJjX2JmYl9fY29sdW1uIHdwYmNfX2ZpZWxkJyApO1xyXG5cdFx0XHRcdGNvbC5zdHlsZS5mbGV4QmFzaXMgPSAoIDEwMCAvIGNvbHMgKSArICclJztcclxuXHRcdFx0XHRiLmluaXRfc29ydGFibGU/LiggY29sICk7XHJcblx0XHRcdFx0cm93LmFwcGVuZENoaWxkKCBjb2wgKTtcclxuXHRcdFx0XHRpZiAoIGkgPCBjb2xzIC0gMSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHJlc2l6ZXIgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX2NvbHVtbi1yZXNpemVyJyApO1xyXG5cdFx0XHRcdFx0cmVzaXplci5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vkb3duJywgYi5pbml0X3Jlc2l6ZV9oYW5kbGVyICk7XHJcblx0XHRcdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIHJlc2l6ZXIgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0c2VjdGlvbi5hcHBlbmRDaGlsZCggcm93ICk7XHJcblx0XHRcdGIubGF5b3V0LnNldF9lcXVhbF9iYXNlcyggcm93LCBiLmNvbF9nYXBfcGVyY2VudCApO1xyXG5cdFx0XHRiLmFkZF9vdmVybGF5X3Rvb2xiYXIoIHNlY3Rpb24gKTtcclxuXHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKCBzZWN0aW9uICk7XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAndGFiaW5kZXgnLCAnMCcgKTsgLy8gb3B0aW9uYWw6IGtleWJvYXJkIGZvY3VzYWJpbGl0eS5cclxuXHRcdFx0dGhpcy5pbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzKCBzZWN0aW9uICk7XHJcblx0XHR9XHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzZWN0aW9uX2RhdGFcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lclxyXG5cdFx0ICovXHJcblx0XHRyZWJ1aWxkX3NlY3Rpb24oIHNlY3Rpb25fZGF0YSwgY29udGFpbmVyICkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRjb25zdCBjb2xzX2RhdGEgPSBBcnJheS5pc0FycmF5KCBzZWN0aW9uX2RhdGE/LmNvbHVtbnMgKSA/IHNlY3Rpb25fZGF0YS5jb2x1bW5zIDogW107XHJcblx0XHRcdHRoaXMuYWRkX3NlY3Rpb24oIGNvbnRhaW5lciwgY29sc19kYXRhLmxlbmd0aCB8fCAxICk7XHJcblx0XHRcdGNvbnN0IHNlY3Rpb24gPSBjb250YWluZXIubGFzdEVsZW1lbnRDaGlsZDtcclxuXHRcdFx0aWYgKCAhIHNlY3Rpb24uZGF0YXNldC51aWQgKSB7XHJcblx0XHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLXVpZCcsIGBzLSR7KytiLl91aWRfY291bnRlcn0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDcgKX1gICk7XHJcblx0XHRcdH1cclxuXHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLWlkJywgc2VjdGlvbl9kYXRhPy5pZCB8fCBgc2VjdGlvbi0keyArK2Iuc2VjdGlvbl9jb3VudGVyIH0tJHsgRGF0ZS5ub3coKSB9YCApO1xyXG5cdFx0XHRjb25zdCByb3cgPSBzZWN0aW9uLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3JvdycgKTtcclxuXHRcdFx0Y29sc19kYXRhLmZvckVhY2goICggY29sX2RhdGEsIGluZGV4ICkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGNvbHVtbnNfb25seSA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICk7XHJcblx0XHRcdFx0Y29uc3QgY29sID0gY29sdW1uc19vbmx5WyBpbmRleCBdO1xyXG5cdFx0XHRcdGNvbC5zdHlsZS5mbGV4QmFzaXMgPSBjb2xfZGF0YS53aWR0aCB8fCAnMTAwJSc7XHJcblx0XHRcdFx0KCBjb2xfZGF0YS5pdGVtcyB8fCBbXSApLmZvckVhY2goICggaXRlbSApID0+IHtcclxuXHRcdFx0XHRcdGlmICggISBpdGVtIHx8ICEgaXRlbS50eXBlICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIGl0ZW0udHlwZSA9PT0gJ2ZpZWxkJyApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgZWwgPSBiLmJ1aWxkX2ZpZWxkKCBpdGVtLmRhdGEgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCBlbCApIHtcclxuXHRcdFx0XHRcdFx0XHRjb2wuYXBwZW5kQ2hpbGQoIGVsICk7XHJcblx0XHRcdFx0XHRcdFx0Yi50cmlnZ2VyX2ZpZWxkX2Ryb3BfY2FsbGJhY2soIGVsLCAnbG9hZCcgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIGl0ZW0udHlwZSA9PT0gJ3NlY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnJlYnVpbGRfc2VjdGlvbiggaXRlbS5kYXRhLCBjb2wgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0Y29uc3QgY29tcHV0ZWQgPSBiLmxheW91dC5jb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3Jvdyggcm93LCBiLmNvbF9nYXBfcGVyY2VudCApO1xyXG5cdFx0XHRiLmxheW91dC5hcHBseV9iYXNlc190b19yb3coIHJvdywgY29tcHV0ZWQuYmFzZXMgKTtcclxuXHRcdFx0dGhpcy5pbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzKCBzZWN0aW9uICk7XHJcblx0XHR9XHJcblx0XHQvKiogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyICovXHJcblx0XHRpbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzKCBjb250YWluZXIgKSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGlmICggY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICkgKSB7XHJcblx0XHRcdFx0dGhpcy5pbml0X3NlY3Rpb25fc29ydGFibGUoIGNvbnRhaW5lciApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19zZWN0aW9uJyApLmZvckVhY2goICggc2VjdGlvbiApID0+IHtcclxuXHRcdFx0XHRzZWN0aW9uLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2NvbHVtbicgKS5mb3JFYWNoKCAoIGNvbCApID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuaW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBjb2wgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHRcdC8qKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXIgKi9cclxuXHRcdGluaXRfc2VjdGlvbl9zb3J0YWJsZSggY29udGFpbmVyICkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRpZiAoICEgY29udGFpbmVyICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBpc19jb2x1bW4gPSBjb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHRcdFx0Y29uc3QgaXNfdG9wX2xldmVsID0gY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICk7XHJcblx0XHRcdGlmICggISBpc19jb2x1bW4gJiYgISBpc190b3BfbGV2ZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGIuaW5pdF9zb3J0YWJsZT8uKCBjb250YWluZXIgKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXJpYWxpemF0aW9uIGFuZCBkZXNlcmlhbGl6YXRpb24gb2YgcGFnZXMvc2VjdGlvbnMvZmllbGRzLlxyXG5cdCAqL1xyXG5cdFVJLldQQkNfQkZCX1N0cnVjdHVyZV9JTyA9IGNsYXNzIGV4dGVuZHMgVUkuV1BCQ19CRkJfTW9kdWxlIHtcclxuXHRcdGluaXQoKSB7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5nZXRfc3RydWN0dXJlID0gKCkgPT4gdGhpcy5zZXJpYWxpemUoKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLmxvYWRfc2F2ZWRfc3RydWN0dXJlID0gKCBzLCBvcHRzICkgPT4gdGhpcy5kZXNlcmlhbGl6ZSggcywgb3B0cyApO1xyXG5cdFx0fVxyXG5cdFx0LyoqIEByZXR1cm5zIHtBcnJheX0gKi9cclxuXHRcdHNlcmlhbGl6ZSgpIHtcclxuXHRcdFx0Y29uc3QgYiA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0dGhpcy5fbm9ybWFsaXplX2lkcygpO1xyXG5cdFx0XHR0aGlzLl9ub3JtYWxpemVfbmFtZXMoKTtcclxuXHRcdFx0Y29uc3QgcGFnZXMgPSBbXTtcclxuXHRcdFx0Yi5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnICkuZm9yRWFjaCggKCBwYWdlX2VsLCBwYWdlX2luZGV4ICkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IHBhZ2VfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBbXTtcclxuXHRcdFx0XHRpZiAoICEgY29udGFpbmVyICkge1xyXG5cdFx0XHRcdFx0cGFnZXMucHVzaCggeyBwYWdlOiBwYWdlX2luZGV4ICsgMSwgY29udGVudCB9ICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gKicgKS5mb3JFYWNoKCAoIGNoaWxkICkgPT4ge1xyXG5cdFx0XHRcdFx0aWYgKCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRcdFx0Y29udGVudC5wdXNoKCB7IHR5cGU6ICdzZWN0aW9uJywgZGF0YTogdGhpcy5zZXJpYWxpemVfc2VjdGlvbiggY2hpbGQgKSB9ICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggY2hpbGQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLWludmFsaWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGNvbnN0IGZfZGF0YSA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggY2hpbGQgKTtcclxuXHRcdFx0XHRcdFx0ZGVsZXRlIGZfZGF0YS51aWQ7XHJcblx0XHRcdFx0XHRcdGNvbnRlbnQucHVzaCggeyB0eXBlOiAnZmllbGQnLCBkYXRhOiBmX2RhdGEgfSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRwYWdlcy5wdXNoKCB7IHBhZ2U6IHBhZ2VfaW5kZXggKyAxLCBjb250ZW50IH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gcGFnZXM7XHJcblx0XHR9XHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWxcclxuXHRcdCAqIEByZXR1cm5zIHt7aWQ6c3RyaW5nLCBjb2x1bW5zOkFycmF5fX1cclxuXHRcdCAqL1xyXG5cdFx0c2VyaWFsaXplX3NlY3Rpb24oIHNlY3Rpb25fZWwgKSB7XHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRpZiAoICEgcm93ICkge1xyXG5cdFx0XHRcdHJldHVybiB7IGlkOiBzZWN0aW9uX2VsLmRhdGFzZXQuaWQsIGNvbHVtbnM6IFtdIH07XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgY29sdW1ucyA9IFtdO1xyXG5cdFx0XHRyb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uJyApLmZvckVhY2goICggY29sICkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHdpZHRoID0gY29sLnN0eWxlLmZsZXhCYXNpcyB8fCAnMTAwJSc7XHJcblx0XHRcdFx0Y29uc3QgaXRlbXMgPSBbXTtcclxuXHRcdFx0XHRBcnJheS5mcm9tKCBjb2wuY2hpbGRyZW4gKS5mb3JFYWNoKCAoIGNoaWxkICkgPT4ge1xyXG5cdFx0XHRcdFx0aWYgKCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRcdFx0aXRlbXMucHVzaCggeyB0eXBlOiAnc2VjdGlvbicsIGRhdGE6IHRoaXMuc2VyaWFsaXplX3NlY3Rpb24oIGNoaWxkICkgfSApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1pbnZhbGlkJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRjb25zdCBmX2RhdGEgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGNoaWxkICk7XHJcblx0XHRcdFx0XHRcdGRlbGV0ZSBmX2RhdGEudWlkO1xyXG5cdFx0XHRcdFx0XHRpdGVtcy5wdXNoKCB7IHR5cGU6ICdmaWVsZCcsIGRhdGE6IGZfZGF0YSB9ICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdGNvbHVtbnMucHVzaCggeyB3aWR0aCwgaXRlbXMgfSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHJldHVybiB7IGlkOiBzZWN0aW9uX2VsLmRhdGFzZXQuaWQsIGNvbHVtbnMgfTtcclxuXHRcdH1cclxuXHRcdC8qKlxyXG5cdFx0ICogQHBhcmFtIHtBcnJheX0gc3RydWN0dXJlXHJcblx0XHQgKiBAcGFyYW0ge3tkZWZlcklmVHlwaW5nPzogYm9vbGVhbn19IFtvcHRzID0ge31dXHJcblx0XHQgKi9cclxuXHRcdGRlc2VyaWFsaXplKCBzdHJ1Y3R1cmUsIHsgZGVmZXJJZlR5cGluZyA9IHRydWUgfSA9IHt9ICkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRpZiAoIGRlZmVySWZUeXBpbmcgJiYgdGhpcy5faXNfdHlwaW5nX2luX2luc3BlY3RvcigpICkge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCggdGhpcy5fZGVmZXJfdGltZXIgKTtcclxuXHRcdFx0XHR0aGlzLl9kZWZlcl90aW1lciA9IHNldFRpbWVvdXQoICgpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuZGVzZXJpYWxpemUoIHN0cnVjdHVyZSwgeyBkZWZlcklmVHlwaW5nOiBmYWxzZSB9ICk7XHJcblx0XHRcdFx0fSwgMTUwICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGIucGFnZXNfY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xyXG5cdFx0XHRiLnBhZ2VfY291bnRlciA9IDA7XHJcblx0XHRcdCggc3RydWN0dXJlIHx8IFtdICkuZm9yRWFjaCggKCBwYWdlX2RhdGEgKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFnZV9lbCA9IGIucGFnZXNfc2VjdGlvbnMuYWRkX3BhZ2UoIHsgc2Nyb2xsOiBmYWxzZSB9ICk7XHJcblx0XHRcdFx0Y29uc3Qgc2VjdGlvbl9jb250YWluZXIgPSBwYWdlX2VsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcicgKTtcclxuXHRcdFx0XHRzZWN0aW9uX2NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuXHRcdFx0XHRiLmluaXRfc2VjdGlvbl9zb3J0YWJsZT8uKCBzZWN0aW9uX2NvbnRhaW5lciApO1xyXG5cdFx0XHRcdCggcGFnZV9kYXRhLmNvbnRlbnQgfHwgW10gKS5mb3JFYWNoKCAoIGl0ZW0gKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGl0ZW0udHlwZSA9PT0gJ3NlY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRiLnBhZ2VzX3NlY3Rpb25zLnJlYnVpbGRfc2VjdGlvbiggaXRlbS5kYXRhLCBzZWN0aW9uX2NvbnRhaW5lciApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIGl0ZW0udHlwZSA9PT0gJ2ZpZWxkJyApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgZWwgPSBiLmJ1aWxkX2ZpZWxkKCBpdGVtLmRhdGEgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCBlbCApIHtcclxuXHRcdFx0XHRcdFx0XHRzZWN0aW9uX2NvbnRhaW5lci5hcHBlbmRDaGlsZCggZWwgKTtcclxuXHRcdFx0XHRcdFx0XHRiLnRyaWdnZXJfZmllbGRfZHJvcF9jYWxsYmFjayggZWwsICdsb2FkJyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGIudXNhZ2UudXBkYXRlX3BhbGV0dGVfdWkoKTtcclxuXHRcdFx0Yi5idXMuZW1pdCggV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9MT0FERUQsIHsgc3RydWN0dXJlIH0gKTtcclxuXHRcdH1cclxuXHRcdF9ub3JtYWxpemVfaWRzKCkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRiLnBhZ2VzX2NvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkOm5vdCguaXMtaW52YWxpZCknICkuZm9yRWFjaCggKCBlbCApID0+IHtcclxuXHRcdFx0XHRjb25zdCBkYXRhID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBlbCApO1xyXG5cdFx0XHRcdGNvbnN0IHdhbnQgPSBXUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCBkYXRhLmlkIHx8ICcnICkgfHwgJ2ZpZWxkJztcclxuXHRcdFx0XHRjb25zdCB1bmlxID0gYi5pZC5lbnN1cmVfdW5pcXVlX2ZpZWxkX2lkKCB3YW50LCBlbCApO1xyXG5cdFx0XHRcdGlmICggZGF0YS5pZCAhPT0gdW5pcSApIHtcclxuXHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtaWQnLCB1bmlxICk7XHJcblx0XHRcdFx0XHRpZiAoIGIucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdFx0XHRiLnJlbmRlcl9wcmV2aWV3KCBlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdFx0X25vcm1hbGl6ZV9uYW1lcygpIHtcclxuXHRcdFx0Y29uc3QgYiA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Yi5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZDpub3QoLmlzLWludmFsaWQpJyApLmZvckVhY2goICggZWwgKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgZGF0YSA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggZWwgKTtcclxuXHRcdFx0XHRjb25zdCBiYXNlID0gV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCAoIGRhdGEubmFtZSAhPSBudWxsICkgPyBkYXRhLm5hbWUgOiBkYXRhLmlkICkgfHwgJ2ZpZWxkJztcclxuXHRcdFx0XHRjb25zdCB1bmlxID0gYi5pZC5lbnN1cmVfdW5pcXVlX2ZpZWxkX25hbWUoIGJhc2UsIGVsICk7XHJcblx0XHRcdFx0aWYgKCBkYXRhLm5hbWUgIT09IHVuaXEgKSB7XHJcblx0XHRcdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLW5hbWUnLCB1bmlxICk7XHJcblx0XHRcdFx0XHRpZiAoIGIucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdFx0XHRiLnJlbmRlcl9wcmV2aWV3KCBlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdFx0LyoqIEByZXR1cm5zIHtib29sZWFufSAqL1xyXG5cdFx0X2lzX3R5cGluZ19pbl9pbnNwZWN0b3IoKSB7XHJcblx0XHRcdGNvbnN0IGlucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0cmV0dXJuICEhKCBpbnMgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJiBpbnMuY29udGFpbnMoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKSApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBNaW5pbWFsLCBzdGFuZGFsb25lIGd1YXJkIHRoYXQgZW5mb3JjZXMgcGVyLWNvbHVtbiBtaW4gd2lkdGhzIGJhc2VkIG9uIGZpZWxkcycgZGF0YS1taW5fd2lkdGguXHJcblx0ICpcclxuXHQgKiBAdHlwZSB7VUkuV1BCQ19CRkJfTWluX1dpZHRoX0d1YXJkfVxyXG5cdCAqL1xyXG5cdFVJLldQQkNfQkZCX01pbl9XaWR0aF9HdWFyZCA9IGNsYXNzIGV4dGVuZHMgVUkuV1BCQ19CRkJfTW9kdWxlIHtcclxuXHJcblx0XHRjb25zdHJ1Y3RvcihidWlsZGVyKSB7XHJcblx0XHRcdHN1cGVyKCBidWlsZGVyICk7XHJcblx0XHRcdHRoaXMuX29uX2ZpZWxkX2FkZCAgICAgICAgPSB0aGlzLl9vbl9maWVsZF9hZGQuYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLl9vbl9maWVsZF9yZW1vdmUgICAgID0gdGhpcy5fb25fZmllbGRfcmVtb3ZlLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5fb25fc3RydWN0dXJlX2xvYWRlZCA9IHRoaXMuX29uX3N0cnVjdHVyZV9sb2FkZWQuYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLl9vbl93aW5kb3dfcmVzaXplICAgID0gdGhpcy5fb25fd2luZG93X3Jlc2l6ZS5iaW5kKCB0aGlzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0Y29uc3QgRVYgPSBXUEJDX0JGQl9FdmVudHM7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uYnVzPy5vbj8uKCBFVi5GSUVMRF9BREQsIHRoaXMuX29uX2ZpZWxkX2FkZCApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub24/LiggRVYuRklFTERfUkVNT1ZFLCB0aGlzLl9vbl9maWVsZF9yZW1vdmUgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5idXM/Lm9uPy4oIEVWLlNUUlVDVFVSRV9MT0FERUQsIHRoaXMuX29uX3N0cnVjdHVyZV9sb2FkZWQgKTtcclxuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCB0aGlzLl9vbl93aW5kb3dfcmVzaXplLCB7IHBhc3NpdmU6IHRydWUgfSApO1xyXG5cdFx0XHR0aGlzLnJlZnJlc2hfYWxsKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdFx0Y29uc3QgRVYgPSBXUEJDX0JGQl9FdmVudHM7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uYnVzPy5vZmY/LiggRVYuRklFTERfQURELCB0aGlzLl9vbl9maWVsZF9hZGQgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5idXM/Lm9mZj8uKCBFVi5GSUVMRF9SRU1PVkUsIHRoaXMuX29uX2ZpZWxkX3JlbW92ZSApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub2ZmPy4oIEVWLlNUUlVDVFVSRV9MT0FERUQsIHRoaXMuX29uX3N0cnVjdHVyZV9sb2FkZWQgKTtcclxuXHRcdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCB0aGlzLl9vbl93aW5kb3dfcmVzaXplICk7XHJcblx0XHR9XHJcblxyXG5cdFx0X29uX2ZpZWxkX2FkZChlKSB7XHJcblx0XHRcdC8vIHNhZmUgKyBzaW1wbGU6IG1vdmluZyBiZXR3ZWVuIGNvbHVtbnMgdXBkYXRlcyBib3RoIHJvd3NcclxuXHRcdFx0dGhpcy5yZWZyZXNoX2FsbCgpO1xyXG5cdFx0XHQvLyBpZiB5b3UgcmVhbGx5IHdhbnQgdG8gYmUgbWluaW1hbCB3b3JrIGhlcmUsIGtlZXAgeW91ciByb3ctb25seSB2ZXJzaW9uLlxyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9maWVsZF9yZW1vdmUoZSkge1xyXG5cdFx0XHRjb25zdCBzcmNfZWwgPSBlPy5kZXRhaWw/LmVsIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHJvdyAgICA9IChzcmNfZWwgJiYgc3JjX2VsLmNsb3Nlc3QpID8gc3JjX2VsLmNsb3Nlc3QoICcud3BiY19iZmJfX3JvdycgKSA6IG51bGw7XHJcblx0XHRcdGlmICggcm93ICkgdGhpcy5yZWZyZXNoX3Jvdyggcm93ICk7IGVsc2UgdGhpcy5yZWZyZXNoX2FsbCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9zdHJ1Y3R1cmVfbG9hZGVkKCkge1xyXG5cdFx0XHR0aGlzLnJlZnJlc2hfYWxsKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0X29uX3dpbmRvd19yZXNpemUoKSB7XHJcblx0XHRcdHRoaXMucmVmcmVzaF9hbGwoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZWZyZXNoX2FsbCgpIHtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5wYWdlc19jb250YWluZXJcclxuXHRcdFx0XHQ/LnF1ZXJ5U2VsZWN0b3JBbGw/LiggJy53cGJjX2JmYl9fcm93JyApXHJcblx0XHRcdFx0Py5mb3JFYWNoPy4oIChyb3cpID0+IHRoaXMucmVmcmVzaF9yb3coIHJvdyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmVmcmVzaF9yb3cocm93X2VsKSB7XHJcblx0XHRcdGlmICggIXJvd19lbCApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGNvbHMgPSByb3dfZWwucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uJyApO1xyXG5cclxuXHRcdFx0Ly8gMSkgUmVjYWxjdWxhdGUgZWFjaCBjb2x1bW7igJlzIHJlcXVpcmVkIG1pbiBweCBhbmQgd3JpdGUgaXQgdG8gdGhlIENTUyB2YXIuXHJcblx0XHRcdGNvbHMuZm9yRWFjaCggKGNvbCkgPT4gdGhpcy5hcHBseV9jb2xfbWluKCBjb2wgKSApO1xyXG5cclxuXHRcdFx0Ly8gMikgRW5mb3JjZSBpdCBhdCB0aGUgQ1NTIGxldmVsIHJpZ2h0IGF3YXkgc28gbGF5b3V0IGNhbuKAmXQgcmVuZGVyIG5hcnJvd2VyLlxyXG5cdFx0XHRjb2xzLmZvckVhY2goIChjb2wpID0+IHtcclxuXHRcdFx0XHRjb25zdCBweCA9IHBhcnNlRmxvYXQoIGdldENvbXB1dGVkU3R5bGUoIGNvbCApLmdldFByb3BlcnR5VmFsdWUoICctLXdwYmMtY29sLW1pbicgKSB8fCAnMCcgKSB8fCAwO1xyXG5cdFx0XHRcdGNvbC5zdHlsZS5taW5XaWR0aCA9IHB4ID4gMCA/IE1hdGgucm91bmQoIHB4ICkgKyAncHgnIDogJyc7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIDMpIE5vcm1hbGl6ZSBjdXJyZW50IGJhc2VzIHNvIHRoZSByb3cgcmVzcGVjdHMgYWxsIG1pbnMgd2l0aG91dCBvdmVyZmxvdy5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBiICAgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdFx0Y29uc3QgZ3AgID0gYi5jb2xfZ2FwX3BlcmNlbnQ7XHJcblx0XHRcdFx0Y29uc3QgZWZmID0gYi5sYXlvdXQuY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3coIHJvd19lbCwgZ3AgKTsgIC8vIHsgYmFzZXMsIGF2YWlsYWJsZSB9XHJcblx0XHRcdFx0Ly8gUmUtZml0ICpjdXJyZW50KiBiYXNlcyBhZ2FpbnN0IG1pbnMgKHNhbWUgYWxnb3JpdGhtIGxheW91dCBjaGlwcyB1c2UpLlxyXG5cdFx0XHRcdGNvbnN0IGZpdHRlZCA9IFVJLldQQkNfQkZCX0xheW91dF9DaGlwcy5fZml0X3dlaWdodHNfcmVzcGVjdGluZ19taW4oIGIsIHJvd19lbCwgZWZmLmJhc2VzICk7XHJcblx0XHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCBmaXR0ZWQgKSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IGNoYW5nZWQgPSBmaXR0ZWQuc29tZSggKHYsIGkpID0+IE1hdGguYWJzKCB2IC0gZWZmLmJhc2VzW2ldICkgPiAwLjAxICk7XHJcblx0XHRcdFx0XHRpZiAoIGNoYW5nZWQgKSB7XHJcblx0XHRcdFx0XHRcdGIubGF5b3V0LmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93X2VsLCBmaXR0ZWQgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKF8pIHsgLyogbm9uLWZhdGFsICovIH1cclxuXHRcdH1cclxuXHJcblx0XHRhcHBseV9jb2xfbWluKGNvbF9lbCkge1xyXG5cdFx0XHRpZiAoICFjb2xfZWwgKSByZXR1cm47XHJcblx0XHRcdGxldCBtYXhfcHggPSAwO1xyXG5cdFx0XHRjb2xfZWwucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fZmllbGQnICkuZm9yRWFjaCggKGZpZWxkKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcmF3ID0gZmllbGQuZ2V0QXR0cmlidXRlKCAnZGF0YS1taW5fd2lkdGgnICk7XHJcblx0XHRcdFx0bGV0IHB4ICAgID0gMDtcclxuXHRcdFx0XHRpZiAoIHJhdyApIHtcclxuXHRcdFx0XHRcdHB4ID0gdGhpcy5wYXJzZV9sZW5fcHgoIHJhdyApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb25zdCBjcyA9IGdldENvbXB1dGVkU3R5bGUoIGZpZWxkICk7XHJcblx0XHRcdFx0XHRweCAgICAgICA9IHBhcnNlRmxvYXQoIGNzLm1pbldpZHRoIHx8ICcwJyApIHx8IDA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggcHggPiBtYXhfcHggKSBtYXhfcHggPSBweDtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRjb2xfZWwuc3R5bGUuc2V0UHJvcGVydHkoICctLXdwYmMtY29sLW1pbicsIG1heF9weCA+IDAgPyBNYXRoLnJvdW5kKCBtYXhfcHggKSArICdweCcgOiAnMHB4JyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBhcnNlX2xlbl9weCh2YWx1ZSkge1xyXG5cdFx0XHRpZiAoIHZhbHVlID09IG51bGwgKSByZXR1cm4gMDtcclxuXHRcdFx0Y29uc3QgcyA9IFN0cmluZyggdmFsdWUgKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0aWYgKCBzID09PSAnJyApIHJldHVybiAwO1xyXG5cdFx0XHRpZiAoIHMuZW5kc1dpdGgoICdweCcgKSApIHtcclxuXHRcdFx0XHRjb25zdCBuID0gcGFyc2VGbG9hdCggcyApO1xyXG5cdFx0XHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIG4gKSA/IG4gOiAwO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggcy5lbmRzV2l0aCggJ3JlbScgKSB8fCBzLmVuZHNXaXRoKCAnZW0nICkgKSB7XHJcblx0XHRcdFx0Y29uc3QgbiAgICA9IHBhcnNlRmxvYXQoIHMgKTtcclxuXHRcdFx0XHRjb25zdCBiYXNlID0gcGFyc2VGbG9hdCggZ2V0Q29tcHV0ZWRTdHlsZSggZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICkuZm9udFNpemUgKSB8fCAxNjtcclxuXHRcdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBuICkgPyBuICogYmFzZSA6IDA7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgbiA9IHBhcnNlRmxvYXQoIHMgKTtcclxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gbiA6IDA7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblxyXG5cdHcuV1BCQ19CRkJfVUkgPSBVSTtcclxuXHJcbn0gKSggd2luZG93ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQSxDQUFFLFVBQVdBLENBQUMsRUFBRztFQUNoQixZQUFZOztFQUVaLE1BQU07SUFBRUMsWUFBWTtJQUFFQyx3QkFBd0I7SUFBRUMsZUFBZTtJQUFFQztFQUFrQixDQUFDLEdBQUdKLENBQUMsQ0FBQ0ssYUFBYTtFQUV0RyxNQUFNQyxFQUFFLEdBQUcsQ0FBQyxDQUFDOztFQUViO0FBQ0Q7QUFDQTtFQUNDQSxFQUFFLENBQUNDLGVBQWUsR0FBRyxNQUFNO0lBQzFCO0lBQ0FDLFdBQVdBLENBQUNDLE9BQU8sRUFBRTtNQUNwQixJQUFJLENBQUNBLE9BQU8sR0FBR0EsT0FBTztJQUN2Qjs7SUFFQTtJQUNBQyxJQUFJQSxDQUFBLEVBQUcsQ0FDUDs7SUFFQTtJQUNBQyxPQUFPQSxDQUFBLEVBQUcsQ0FDVjtFQUNELENBQUM7O0VBRUQ7QUFDRDtBQUNBO0FBQ0E7RUFDQ0wsRUFBRSxDQUFDTSxnQkFBZ0IsR0FBRyxNQUFNO0lBRTNCO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7SUFDRSxPQUFPQyxNQUFNQSxDQUFFSixPQUFPLEVBQUVLLEVBQUUsRUFBRztNQUU1QixJQUFLLENBQUVBLEVBQUUsRUFBRztRQUNYO01BQ0Q7TUFDQSxNQUFNQyxTQUFTLEdBQUdELEVBQUUsQ0FBQ0UsU0FBUyxDQUFDQyxRQUFRLENBQUUsbUJBQW9CLENBQUM7TUFFOUQsSUFBSUMsT0FBTyxHQUFHSixFQUFF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
