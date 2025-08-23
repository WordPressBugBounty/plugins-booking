"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/bfb-core.iife.js == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
  'use strict';

  // Define core on a single namespace.
  const Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};

  /**
   * WPBC ID / Name service. Generates, sanitizes, and ensures uniqueness for field ids/names/html_ids within the canvas.
   */
  Core.WPBC_BFB_IdService = class {
    /**
     * Constructor. Set root container of the form pages.
     *
     * @param {HTMLElement} pages_container - Root container of the form pages.
     */
    constructor(pages_container) {
      this.pages_container = pages_container;
    }

    /**
     * Ensure a unique **internal** field id (stored in data-id) within the canvas.
     * Starts from a desired id (already sanitized or not) and appends suffixes if needed.
     *
     * @param {string} baseId - Desired id.
     * @returns {string} Unique id.
     */
    ensure_unique_field_id(baseId, currentEl = null) {
      const base = Core.WPBC_BFB_Sanitize.sanitize_html_id(baseId);
      let id = base || 'field';
      const esc = v => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector(v);
      const escUid = v => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector(v);
      const notSelf = currentEl?.dataset?.uid ? `:not([data-uid="${escUid(currentEl.dataset.uid)}"])` : '';
      while (this.pages_container?.querySelector(`.wpbc_bfb__panel--preview .wpbc_bfb__field${notSelf}[data-id="${esc(id)}"]`)) {
        // Excludes self by data-uid .
        const found = this.pages_container.querySelector(`.wpbc_bfb__panel--preview .wpbc_bfb__field[data-id="${esc(id)}"]`);
        if (found && currentEl && found === currentEl) {
          break;
        }
        id = `${base || 'field'}-${Math.random().toString(36).slice(2, 5)}`;
      }
      return id;
    }

    /**
     * Ensure a unique HTML name across the form.
     *
     * @param {string} base - Desired base name (un/sanitized).
     * @param {HTMLElement|null} currentEl - If provided, ignore conflicts with this element.
     * @returns {string} Unique name.
     */
    ensure_unique_field_name(base, currentEl = null) {
      let name = base || 'field';
      const esc = v => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector(v);
      while (true) {
        const clashes = this.pages_container?.querySelectorAll(`.wpbc_bfb__panel--preview .wpbc_bfb__field[data-name="${esc(name)}"]`) || [];
        const other = Array.from(clashes).find(el => el !== currentEl);
        if (!other) break;
        const m = name.match(/-(\d+)$/);
        name = m ? name.replace(/-\d+$/, '-' + (Number(m[1]) + 1)) : `${base}-2`;
      }
      return name;
    }

    /**
     * Set field's INTERNAL id (data-id) on an element. Ensures uniqueness and optionally asks caller to refresh preview.
     *
     * @param {HTMLElement} field_el - Field element in the canvas.
     * @param {string} newIdRaw - Desired id (un/sanitized).
     * @param {boolean} [renderPreview=false] - Caller can decide to re-render preview.
     * @returns {string} Applied unique id.
     */
    set_field_id(field_el, newIdRaw, renderPreview = false) {
      const desired = Core.WPBC_BFB_Sanitize.sanitize_html_id(newIdRaw);
      const unique = this.ensure_unique_field_id(desired, field_el);
      field_el.setAttribute('data-id', unique);
      if (renderPreview) {
        // Caller decides if / when to render.
      }
      return unique;
    }

    /**
     * Set field's REQUIRED HTML name (data-name). Ensures sanitized + unique per form.
     * Falls back to sanitized internal id if user provides empty value.
     *
     * @param {HTMLElement} field_el - Field element in the canvas.
     * @param {string} newNameRaw - Desired name (un/sanitized).
     * @param {boolean} [renderPreview=false] - Caller can decide to re-render preview.
     * @returns {string} Applied unique name.
     */
    set_field_name(field_el, newNameRaw, renderPreview = false) {
      const raw = (newNameRaw == null ? '' : String(newNameRaw)).trim();
      const base = raw ? Core.WPBC_BFB_Sanitize.sanitize_html_name(raw) : Core.WPBC_BFB_Sanitize.sanitize_html_name(field_el.getAttribute('data-id') || 'field');
      const unique = this.ensure_unique_field_name(base, field_el);
      field_el.setAttribute('data-name', unique);
      if (renderPreview) {
        // Caller decides if / when to render.
      }
      return unique;
    }

    /**
     * Set field's OPTIONAL public HTML id (data-html_id). Empty value removes the attribute.
     * Ensures sanitization + uniqueness among other declared HTML ids.
     *
     * @param {HTMLElement} field_el - Field element in the canvas.
     * @param {string} newHtmlIdRaw - Desired html_id (optional).
     * @param {boolean} [renderPreview=false] - Caller can decide to re-render preview.
     * @returns {string} The applied html_id or empty string if removed.
     */
    set_field_html_id(field_el, newHtmlIdRaw, renderPreview = false) {
      const raw = (newHtmlIdRaw == null ? '' : String(newHtmlIdRaw)).trim();
      if (raw === '') {
        field_el.removeAttribute('data-html_id');
        if (renderPreview) {
          // Caller decides if / when to render.
        }
        return '';
      }
      const desired = Core.WPBC_BFB_Sanitize.sanitize_html_id(raw);
      let htmlId = desired;
      const esc = v => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector(v);
      while (true) {
        const clash = this.pages_container?.querySelector(`.wpbc_bfb__panel--preview .wpbc_bfb__field[data-html_id="${esc(htmlId)}"]`);
        if (!clash || clash === field_el) {
          break;
        }
        const m = htmlId.match(/-(\d+)$/);
        htmlId = m ? htmlId.replace(/-\d+$/, '-' + (Number(m[1]) + 1)) : `${desired}-2`;
      }
      field_el.setAttribute('data-html_id', htmlId);
      if (renderPreview) {
        // Caller decides if / when to render.
      }
      return htmlId;
    }
  };

  /**
   * WPBC Layout service. Encapsulates column width math with gap handling, presets, and utilities.
   */
  Core.WPBC_BFB_LayoutService = class {
    /**
     * Constructor. Set options with gap between columns (%).
     *
     * @param {{ col_gap_percent?: number }} [opts] - Options with gap between columns (%).
     */
    constructor(opts = {}) {
      this.col_gap_percent = Number.isFinite(+opts.col_gap_percent) ? +opts.col_gap_percent : 3;
    }

    /**
     * Compute normalized flex-basis values for a row, respecting column gaps.
     * Returns bases that sum to available = 100 - (n-1)*gap.
     *
     * @param {HTMLElement} row_el - Row element containing .wpbc_bfb__column children.
     * @param {number} [gap_percent=this.col_gap_percent] - Gap percent between columns.
     * @returns {{available:number,bases:number[]}} Available space and basis values.
     */
    compute_effective_bases_from_row(row_el, gap_percent = this.col_gap_percent) {
      const cols = Array.from(row_el?.querySelectorAll(':scope > .wpbc_bfb__column') || []);
      const n = cols.length || 1;
      const raw = cols.map(col => {
        const w = col.style.flexBasis || '';
        const p = Core.WPBC_BFB_Sanitize.parse_percent(w, NaN);
        return Number.isFinite(p) ? p : 100 / n;
      });
      const sum_raw = raw.reduce((a, b) => a + b, 0) || 100;
      const gp = Number.isFinite(+gap_percent) ? +gap_percent : 3;
      const total_gaps = Math.max(0, n - 1) * gp;
      const available = Math.max(0, 100 - total_gaps);
      const scale = available / sum_raw;
      return {
        available,
        bases: raw.map(p => Math.max(0, p * scale))
      };
    }

    /**
     * Apply computed bases to the row's columns (sets flex-basis %).
     *
     * @param {HTMLElement} row_el - Row element.
     * @param {number[]} bases - Array of basis values (percent of full 100).
     * @returns {void}
     */
    apply_bases_to_row(row_el, bases) {
      const cols = Array.from(row_el?.querySelectorAll(':scope > .wpbc_bfb__column') || []);
      cols.forEach((col, i) => {
        const p = bases[i] ?? 0;
        col.style.flexBasis = `${p}%`;
      });
    }

    /**
     * Distribute columns evenly, respecting gap.
     *
     * @param {HTMLElement} row_el - Row element.
     * @param {number} [gap_percent=this.col_gap_percent] - Gap percent.
     * @returns {void}
     */
    set_equal_bases(row_el, gap_percent = this.col_gap_percent) {
      const cols = Array.from(row_el?.querySelectorAll(':scope > .wpbc_bfb__column') || []);
      const n = cols.length || 1;
      const gp = Number.isFinite(+gap_percent) ? +gap_percent : 3;
      const total_gaps = Math.max(0, n - 1) * gp;
      const available = Math.max(0, 100 - total_gaps);
      const each = available / n;
      this.apply_bases_to_row(row_el, Array(n).fill(each));
    }

    /**
     * Apply a preset of relative weights to a row/section.
     *
     * @param {HTMLElement} sectionOrRow - .wpbc_bfb__section or its child .wpbc_bfb__row.
     * @param {number[]} weights - Relative weights (e.g., [1,3,1]).
     * @param {number} [gap_percent=this.col_gap_percent] - Gap percent.
     * @returns {void}
     */
    apply_layout_preset(sectionOrRow, weights, gap_percent = this.col_gap_percent) {
      const row = sectionOrRow?.classList?.contains('wpbc_bfb__row') ? sectionOrRow : sectionOrRow?.querySelector(':scope > .wpbc_bfb__row');
      if (!row) {
        return;
      }
      const cols = Array.from(row.querySelectorAll(':scope > .wpbc_bfb__column') || []);
      const n = cols.length || 1;
      if (!Array.isArray(weights) || weights.length !== n) {
        this.set_equal_bases(row, gap_percent);
        return;
      }
      const sum = weights.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0) || 1;
      const gp = Number.isFinite(+gap_percent) ? +gap_percent : 3;
      const available = Math.max(0, 100 - Math.max(0, n - 1) * gp);
      const bases = weights.map(w => Math.max(0, (Number(w) || 0) / sum * available));
      this.apply_bases_to_row(row, bases);
    }

    /**
     * Build preset weight lists for a given column count.
     *
     * @param {number} n - Column count.
     * @returns {number[][]} List of weight arrays.
     */
    build_presets_for_columns(n) {
      switch (n) {
        case 1:
          return [[1]];
        case 2:
          return [[1, 2], [2, 1], [1, 3], [3, 1]];
        case 3:
          return [[1, 3, 1], [1, 2, 1], [2, 1, 1], [1, 1, 2]];
        case 4:
          return [[1, 2, 2, 1], [2, 1, 1, 1], [1, 1, 1, 2]];
        default:
          return [Array(n).fill(1)];
      }
    }

    /**
     * Format a human-readable label like "50%/25%/25%" from weights.
     *
     * @param {number[]} weights - Weight list.
     * @returns {string} Label string.
     */
    format_preset_label(weights) {
      const sum = weights.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
      return weights.map(w => Math.round((Number(w) || 0) / sum * 100)).join('%/') + '%';
    }

    /**
     * Parse comma/space separated weights into numbers.
     *
     * @param {string} input - User input like "20,60,20".
     * @returns {number[]} Parsed weights.
     */
    parse_weights(input) {
      if (!input) {
        return [];
      }
      return String(input).replace(/[^\d,.\s]/g, '').split(/[\s,]+/).map(s => parseFloat(s)).filter(n => Number.isFinite(n) && n >= 0);
    }
  };

  /**
   * WPBC Usage Limit service.
   * Counts field usage by key, compares to palette limits, and updates palette UI.
   */
  Core.WPBC_BFB_UsageLimitService = class {
    /**
     * Constructor. Set pages_container and palette_ul.
     *
     * @param {HTMLElement} pages_container - Canvas root that holds placed fields.
     * @param {HTMLElement[]|null} palette_uls?:   Palettes UL with .wpbc_bfb__field items (may be null).
     */
    constructor(pages_container, palette_uls) {
      this.pages_container = pages_container;
      // Normalize to an array; we’ll still be robust if none provided.
      this.palette_uls = Array.isArray(palette_uls) ? palette_uls : palette_uls ? [palette_uls] : [];
    }

    /**
     * Parse usage limit from raw dataset value. Missing/invalid -> Infinity.
     *
     * @param {string|number|null|undefined} raw - Raw attribute value.
     * @returns {number} Limit number or Infinity.
     */
    static parse_usage_limit(raw) {
      if (raw == null) {
        return Infinity;
      }
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : Infinity;
    }

    /**
     * Count how many instances exist per usage_key in the canvas.
     *
     * @returns {Record<string, number>} Map of usage_key -> count.
     */
    count_usage_by_key() {
      const used = {};
      const all = this.pages_container?.querySelectorAll('.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)') || [];
      all.forEach(el => {
        const key = el.dataset.usage_key || el.dataset.id;
        if (!key) {
          return;
        }
        used[key] = (used[key] || 0) + 1;
      });
      return used;
    }

    /**
     * Return palette limit for a given usage key (id of the palette item).
     *
     * @param {string} key - Usage key.
     * @returns {number} Limit value or Infinity.
     */
    get_limit_for_key(key) {
      if (!key) {
        return Infinity;
      }
      // Query across all palettes present now (stored + any newly added in DOM).
      const allPaletteFields = document.querySelectorAll('.wpbc_bfb__panel_field_types__ul .wpbc_bfb__field');
      let limit = Infinity;
      allPaletteFields.forEach(el => {
        if (el.dataset.id === key) {
          const n = Core.WPBC_BFB_UsageLimitService.parse_usage_limit(el.dataset.usagenumber);
          // Choose the smallest finite limit (safest if palettes disagree).
          if (n < limit) {
            limit = n;
          }
        }
      });
      return limit;
    }

    /**
     * Disable/enable palette items based on current usage counts and limits.
     *
     * @returns {void}
     */
    update_palette_ui() {
      // Always compute usage from the canvas:
      const usage = this.count_usage_by_key();

      // Update all palettes currently in DOM (not just the initially captured ones)
      const palettes = document.querySelectorAll('.wpbc_bfb__panel_field_types__ul');
      palettes.forEach(pal => {
        pal.querySelectorAll('.wpbc_bfb__field').forEach(panel_field => {
          const paletteId = panel_field.dataset.id;
          const raw_limit = panel_field.dataset.usagenumber;
          const perElLimit = Core.WPBC_BFB_UsageLimitService.parse_usage_limit(raw_limit);
          // Effective limit across all palettes is the global limit for this key.
          const globalLimit = this.get_limit_for_key(paletteId);
          const limit = Number.isFinite(globalLimit) ? globalLimit : perElLimit; // prefer global min

          const current = usage[paletteId] || 0;
          const disable = Number.isFinite(limit) && current >= limit;
          panel_field.style.pointerEvents = disable ? 'none' : '';
          panel_field.style.opacity = disable ? '0.4' : '';
          panel_field.setAttribute('aria-disabled', disable ? 'true' : 'false');
          if (disable) {
            panel_field.setAttribute('tabindex', '-1');
          } else {
            panel_field.removeAttribute('tabindex');
          }
        });
      });
    }

    /**
     * Return how many valid instances with this usage key exist in the canvas.
     *
     * @param {string} key - Usage key of a palette item.
     * @returns {number} Count of existing non-invalid instances.
     */
    count_for_key(key) {
      if (!key) {
        return 0;
      }
      return (this.pages_container?.querySelectorAll(`.wpbc_bfb__panel--preview .wpbc_bfb__field[data-usage_key="${Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector(key)}"]:not(.is-invalid)`) || []).length;
    }

    /**
     * Alias for limit lookup (readability).
     *
     * @param {string} key - Usage key of a palette item.
     * @returns {number} Limit value or Infinity.
     */
    limit_for_key(key) {
      return this.get_limit_for_key(key);
    }

    /**
     * Remaining slots for this key (Infinity if unlimited).
     *
     * @param {string} key - Usage key of a palette item.
     * @returns {number} Remaining count (>= 0) or Infinity.
     */
    remaining_for_key(key) {
      const limit = this.limit_for_key(key);
      if (limit === Infinity) {
        return Infinity;
      }
      const used = this.count_for_key(key);
      return Math.max(0, limit - used);
    }

    /**
     * True if you can add `delta` more items for this key.
     *
     * @param {string} key - Usage key of a palette item.
     * @param {number} [delta=1] - How many items you intend to add.
     * @returns {boolean} Whether adding is allowed.
     */
    can_add(key, delta = 1) {
      const rem = this.remaining_for_key(key);
      return rem === Infinity ? true : rem >= delta;
    }

    /**
     * UI-facing gate: alert when exceeded. Returns boolean allowed/blocked.
     *
     * @param {string} key - Usage key of a palette item.
     * @param {{label?: string, delta?: number}} [opts={}] - Optional UI info.
     * @returns {boolean} True if allowed, false if blocked.
     */
    gate_or_alert(key, {
      label = key,
      delta = 1
    } = {}) {
      if (this.can_add(key, delta)) {
        return true;
      }
      const limit = this.limit_for_key(key);
      alert(`Only ${limit} instance${limit > 1 ? 's' : ''} of "${label}" allowed.`);
      return false;
    }

    /**
     * Backward-compatible alias used elsewhere in the codebase.  - Check whether another instance with the given usage key can be added.
     *
     * @param {string} key - Usage key of a palette item.
     * @returns {boolean} Whether adding one more is allowed.
     */
    is_usage_ok(key) {
      return this.can_add(key, 1);
    }
  };

  /**
   * Constant event names for the builder.
   */
  Core.WPBC_BFB_Events = Object.freeze({
    SELECT: 'wpbc:bfb:select',
    CLEAR_SELECTION: 'wpbc:bfb:clear-selection',
    FIELD_ADD: 'wpbc:bfb:field:add',
    FIELD_REMOVE: 'wpbc:bfb:field:remove',
    STRUCTURE_CHANGE: 'wpbc:bfb:structure:change',
    STRUCTURE_LOADED: 'wpbc:bfb:structure:loaded'
  });

  /**
   * Lightweight event bus that emits to both the pages container and document.
   */
  Core.WPBC_BFB_EventBus = class {
    /**
     * @param {HTMLElement} scope_el - Element to dispatch bubbled events from.
     */
    constructor(scope_el) {
      this.scope_el = scope_el;
    }

    /**
     * Emit a DOM CustomEvent with payload.
     *
     * @param {string} type - Event type (use Core.WPBC_BFB_Events. when possible).
     * @param {Object} [detail={}] - Arbitrary serializable payload.
     * @returns {void}
     */
    emit(type, detail = {}) {
      if (!this.scope_el) {
        return;
      }
      this.scope_el.dispatchEvent(new CustomEvent(type, {
        detail: {
          ...detail
        },
        bubbles: true
      }));
    }

    /**
     * Subscribe to an event on document.
     *
     * @param {string} type - Event type.
     * @param {(ev:CustomEvent)=>void} handler - Handler function.
     * @returns {void}
     */
    on(type, handler) {
      document.addEventListener(type, handler);
    }

    /**
     * Unsubscribe from an event on document.
     *
     * @param {string} type - Event type.
     * @param {(ev:CustomEvent)=>void} handler - Handler function.
     * @returns {void}
     */
    off(type, handler) {
      document.removeEventListener(type, handler);
    }
  };

  /**
   * SortableJS manager: single point for consistent DnD config.
   */
  Core.WPBC_BFB_SortableManager = class {
    /**
     * @param {WPBC_Form_Builder} builder - The active builder instance.
     * @param {{ groupName?: string, animation?: number, ghostClass?: string, chosenClass?: string, dragClass?: string }} [opts={}] - Visual/behavior options.
     */
    constructor(builder, opts = {}) {
      this.builder = builder;
      this.opts = {
        groupName: 'form',
        animation: 150,
        ghostClass: 'wpbc_bfb__drag-ghost',
        chosenClass: 'wpbc_bfb__highlight',
        dragClass: 'wpbc_bfb__drag-active',
        ...opts
      };
      /** @type {Set<HTMLElement>} */
      this._containers = new Set();
    }

    /**
     * Tag the drag mirror (element under cursor) with role: 'palette' | 'canvas'.
     * Works with Sortable's fallback mirror (.sortable-fallback / .sortable-drag) and with your dragClass (.wpbc_bfb__drag-active).
     */
    _tag_drag_mirror(evt) {
      const fromPalette = this.builder?.palette_uls?.includes?.(evt.from);
      const role = fromPalette ? 'palette' : 'canvas';
      // Wait a tick so the mirror exists.  - The window.requestAnimationFrame() method tells the browser you wish to perform an animation.
      requestAnimationFrame(() => {
        const mirror = document.querySelector('.sortable-fallback, .sortable-drag, .' + this.opts.dragClass);
        if (mirror) {
          mirror.setAttribute('data-drag-role', role);
        }
      });
    }
    _toggle_dnd_root_flags(active, from_palette = false) {
      // set to root element of an HTML document, which is the <html>.
      const root = document.documentElement;
      if (active) {
        root.classList.add('wpbc_bfb__dnd-active');
        if (from_palette) {
          root.classList.add('wpbc_bfb__drag-from-palette');
        }
      } else {
        root.classList.remove('wpbc_bfb__dnd-active', 'wpbc_bfb__drag-from-palette');
      }
    }

    /**
     * Ensure Sortable is attached to a container with role 'palette' or 'canvas'.
     *
     *  -- Handle selectors: handle:  '.section-drag-handle, .wpbc_bfb__drag-handle, .wpbc_bfb__drag-anywhere, [data-draggable="true"]'
     *  -- Draggable gate: draggable: '.wpbc_bfb__field:not([data-draggable="false"]), .wpbc_bfb__section'
     *  -- Filter (overlay-safe):     ignore everything in overlay except the handle -  '.wpbc_bfb__overlay-controls *:not(.wpbc_bfb__drag-handle):not(.section-drag-handle):not(.wpbc_icn_drag_indicator)'
     *  -- No-drag wrapper:           use .wpbc_bfb__no-drag-zone inside renderers for inputs/widgets.
     *  -- Focus guard (optional):    flip [data-draggable] on focusin/focusout to prevent accidental drags while typing.
     *
     * @param {HTMLElement} container - The element to enhance with Sortable.
     * @param {'palette'|'canvas'} role - Behavior profile to apply.
     * @param {{ onAdd?: Function }} [handlers={}] - Optional handlers.
     * @returns {void}
     */
    ensure(container, role, handlers = {}) {
      if (!container || typeof Sortable === 'undefined') {
        return;
      }
      if (Sortable.get?.(container)) {
        return;
      }
      const common = {
        animation: this.opts.animation,
        ghostClass: this.opts.ghostClass,
        chosenClass: this.opts.chosenClass,
        dragClass: this.opts.dragClass,
        // == Element under the cursor  == Ensure we drag a real DOM mirror you can style via CSS (cross-browser).
        forceFallback: true,
        fallbackOnBody: true,
        fallbackTolerance: 6,
        // Add body/html flags so you can style differently when dragging from palette.
        onStart: evt => {
          this.builder._add_dragging_class();
          const fromPalette = this.builder?.palette_uls?.includes?.(evt.from);
          this._toggle_dnd_root_flags(true, fromPalette); // set to root HTML document: html.wpbc_bfb__dnd-active.wpbc_bfb__drag-from-palette .

          this._tag_drag_mirror(evt); // Add 'data-drag-role' attribute to  element under cursor.
        },
        onEnd: () => {
          setTimeout(() => {
            this.builder._remove_dragging_class();
          }, 50);
          this._toggle_dnd_root_flags(false);
        }
      };
      if (role === 'palette') {
        Sortable.create(container, {
          ...common,
          group: {
            name: this.opts.groupName,
            pull: 'clone',
            put: false
          },
          sort: false
        });
        this._containers.add(container);
        return;
      }

      // role === 'canvas'.
      Sortable.create(container, {
        ...common,
        group: {
          name: this.opts.groupName,
          pull: true,
          put: (to, from, draggedEl) => {
            return draggedEl.classList.contains('wpbc_bfb__field') || draggedEl.classList.contains('wpbc_bfb__section');
          }
        },
        // ---------- DnD Handlers --------------                // Grab anywhere on fields that opt-in with the class or attribute.  - Sections still require their dedicated handle.
        handle: '.section-drag-handle, .wpbc_bfb__drag-handle, .wpbc_bfb__drag-anywhere, [data-draggable="true"]',
        draggable: '.wpbc_bfb__field:not([data-draggable="false"]), .wpbc_bfb__section',
        // Per-field opt-out with [data-draggable="false"] (e.g., while editing).
        // ---------- Filters - No DnD ----------                // Declarative “no-drag zones”: anything inside these wrappers won’t start a drag.
        filter: ['.wpbc_bfb__no-drag-zone', '.wpbc_bfb__no-drag-zone *', '.wpbc_bfb__column-resizer',
        // Ignore the resizer rails during DnD (prevents edge “snap”).
        // In the overlay toolbar, block everything EXCEPT the drag handle (and its icon).
        '.wpbc_bfb__overlay-controls *:not(.wpbc_bfb__drag-handle):not(.section-drag-handle):not(.wpbc_icn_drag_indicator)'].join(','),
        preventOnFilter: false,
        // ---------- anti-jitter tuning ----------
        direction: 'vertical',
        // columns are vertical lists.
        invertSwap: true,
        // use swap on inverted overlap.
        swapThreshold: 0.65,
        // be less eager to swap.
        invertedSwapThreshold: 0.85,
        // require deeper overlap when inverted.
        emptyInsertThreshold: 24,
        // don’t jump into empty containers too early.
        dragoverBubble: false,
        // keep dragover local.
        fallbackOnBody: true,
        // more stable positioning.
        fallbackTolerance: 6,
        // Reduce micro-moves when the mouse shakes a bit (esp. on touchpads).
        scroll: true,
        scrollSensitivity: 40,
        scrollSpeed: 10,
        /**
         * Enter/leave hysteresis for cross-column moves.    Only allow dropping into `to` when the pointer is well inside it.
         */
        onMove: (evt, originalEvent) => {
          const {
            to,
            from
          } = evt;
          if (!to || !from) return true;

          // Only gate columns (not page containers), and only for cross-column moves in the same row
          const isColumn = to.classList?.contains('wpbc_bfb__column');
          if (!isColumn) return true;
          const fromRow = from.closest('.wpbc_bfb__row');
          const toRow = to.closest('.wpbc_bfb__row');
          if (fromRow && toRow && fromRow !== toRow) return true;
          const rect = to.getBoundingClientRect();
          const evtX = originalEvent.touches?.[0]?.clientX ?? originalEvent.clientX;
          const evtY = originalEvent.touches?.[0]?.clientY ?? originalEvent.clientY;

          // --- Edge fence (like you had), but clamped for tiny columns
          const paddingX = Core.WPBC_BFB_Sanitize.clamp(rect.width * 0.20, 12, 36);
          const paddingY = Core.WPBC_BFB_Sanitize.clamp(rect.height * 0.10, 6, 16);

          // Looser Y if the column is visually tiny/empty
          const isVisuallyEmpty = to.childElementCount === 0 || rect.height < 64;
          const innerTop = rect.top + (isVisuallyEmpty ? 4 : paddingY);
          const innerBottom = rect.bottom - (isVisuallyEmpty ? 4 : paddingY);
          const innerLeft = rect.left + paddingX;
          const innerRight = rect.right - paddingX;
          const insideX = evtX > innerLeft && evtX < innerRight;
          const insideY = evtY > innerTop && evtY < innerBottom;
          if (!(insideX && insideY)) return false; // stay in current column until well inside new one

          // --- Sticky target commit distance: only switch if we’re clearly inside the new column
          const ds = this._dragState;
          if (ds) {
            if (ds.stickyTo && ds.stickyTo !== to) {
              // require a deeper penetration to switch columns
              const commitX = Core.WPBC_BFB_Sanitize.clamp(rect.width * 0.25, 18, 40); // 25% or 18–40px
              const commitY = Core.WPBC_BFB_Sanitize.clamp(rect.height * 0.15, 10, 28); // 15% or 10–28px

              const deepInside = evtX > rect.left + commitX && evtX < rect.right - commitX && evtY > rect.top + commitY && evtY < rect.bottom - commitY;
              if (!deepInside) return false;
            }
            // We accept the new target now.
            ds.stickyTo = to;
            ds.lastSwitchTs = performance.now();
          }
          return true;
        },
        onStart: evt => {
          this.builder._add_dragging_class();
          // Match the flags we set in common so CSS stays consistent on canvas drags too.
          const fromPalette = this.builder?.palette_uls?.includes?.(evt.from);
          this._toggle_dnd_root_flags(true, fromPalette); // set to root HTML document: html.wpbc_bfb__dnd-active.wpbc_bfb__drag-from-palette .
          this._tag_drag_mirror(evt); // Tag the mirror under cursor.
          this._dragState = {
            stickyTo: null,
            lastSwitchTs: 0
          }; // per-drag state.
        },
        onEnd: () => {
          setTimeout(() => {
            this.builder._remove_dragging_class();
          }, 50);
          this._toggle_dnd_root_flags(false); // set to root HTML document without these classes: html.wpbc_bfb__dnd-active.wpbc_bfb__drag-from-palette .
          this._dragState = null;
        },
        // ----------------------------------------
        onAdd: handlers.onAdd || this.builder.handle_on_add.bind(this.builder)
      });
      this._containers.add(container);
    }

    /**
     * Destroy all Sortable instances created by this manager.
     *
     * @returns {void}
     */
    destroyAll() {
      this._containers.forEach(el => {
        const inst = Sortable.get?.(el);
        if (inst) {
          inst.destroy();
        }
      });
      this._containers.clear();
    }
  };

  /**
   * Small DOM contract and renderer helper
   *
   * @type {Readonly<{
   *                  SELECTORS: {pagePanel: string, field: string, validField: string, section: string, column: string, row: string, overlay: string},
   *                  CLASSES: {selected: string},
   *        	        ATTR: {id: string, name: string, htmlId: string, usageKey: string, uid: string}}
   *        >}
   */
  Core.WPBC_BFB_DOM = Object.freeze({
    SELECTORS: {
      pagePanel: '.wpbc_bfb__panel--preview',
      field: '.wpbc_bfb__field',
      validField: '.wpbc_bfb__field:not(.is-invalid)',
      section: '.wpbc_bfb__section',
      column: '.wpbc_bfb__column',
      row: '.wpbc_bfb__row',
      overlay: '.wpbc_bfb__overlay-controls'
    },
    CLASSES: {
      selected: 'is-selected'
    },
    ATTR: {
      id: 'data-id',
      name: 'data-name',
      htmlId: 'data-html_id',
      usageKey: 'data-usage_key',
      uid: 'data-uid'
    }
  });
  Core.WPBC_Form_Builder_Helper = class {
    /**
     * Create an HTML element.
     *
     * @param {string} tag - HTML tag name.
     * @param {string} [class_name=''] - Optional CSS class name.
     * @param {string} [inner_html=''] - Optional innerHTML.
     * @returns {HTMLElement} Created element.
     */
    static create_element(tag, class_name = '', inner_html = '') {
      const el = document.createElement(tag);
      if (class_name) {
        el.className = class_name;
      }
      if (inner_html) {
        el.innerHTML = inner_html;
      }
      return el;
    }

    /**
     * Set multiple `data-*` attributes on a given element.
     *
     * @param {HTMLElement} el - Target element.
     * @param {Object} data_obj - Key-value pairs for data attributes.
     * @returns {void}
     */
    static set_data_attributes(el, data_obj) {
      Object.entries(data_obj).forEach(([key, val]) => {
        const value = typeof val === 'object' ? JSON.stringify(val) : val;
        el.setAttribute('data-' + key, value);
      });
    }

    /**
     * Get all `data-*` attributes from an element and parse JSON where possible.
     *
     * @param {HTMLElement} el - Element to extract data from.
     * @returns {Object} Parsed key-value map of data attributes.
     */
    static get_all_data_attributes(el) {
      const data = {};
      if (!el || !el.attributes) {
        return data;
      }
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          const key = attr.name.replace(/^data-/, '');
          try {
            data[key] = JSON.parse(attr.value);
          } catch (e) {
            data[key] = attr.value;
          }
        }
      });

      // Only default the label if it's truly absent (undefined/null), not when it's an empty string.
      const hasExplicitLabel = Object.prototype.hasOwnProperty.call(data, 'label');
      if (!hasExplicitLabel && data.id) {
        data.label = data.id.charAt(0).toUpperCase() + data.id.slice(1);
      }
      return data;
    }

    /**
     * Render a simple label + type preview (used for unknown or fallback fields).
     *
     * @param {Object} field_data - Field data object.
     * @returns {string} HTML content.
     */
    static render_field_inner_html(field_data) {
      // Make the fallback preview respect an empty label.
      const hasLabel = Object.prototype.hasOwnProperty.call(field_data, 'label');
      const label = hasLabel ? String(field_data.label) : String(field_data.id || '(no label)');
      const type = String(field_data.type || 'unknown');
      const is_required = field_data.required === true || field_data.required === 'true' || field_data.required === 1 || field_data.required === '1';
      const wrapper = document.createElement('div');
      const spanLabel = document.createElement('span');
      spanLabel.className = 'wpbc_bfb__field-label';
      spanLabel.textContent = label + (is_required ? ' *' : '');
      wrapper.appendChild(spanLabel);
      const spanType = document.createElement('span');
      spanType.className = 'wpbc_bfb__field-type';
      spanType.textContent = type;
      wrapper.appendChild(spanType);
      return wrapper.innerHTML;
    }

    /**
     * Debounce a function.
     *
     * @param {Function} fn - Function to debounce.
     * @param {number} wait - Delay in ms.
     * @returns {Function} Debounced function.
     */
    static debounce(fn, wait = 120) {
      let t = null;
      return function debounced(...args) {
        if (t) {
          clearTimeout(t);
        }
        t = setTimeout(() => fn.apply(this, args), wait);
      };
    }
  };

  // Renderer registry. Allows late registration and avoids tight coupling to a global map.
  Core.WPBC_BFB_Field_Renderer_Registry = function () {
    const map = new Map();
    return {
      register(type, ClassRef) {
        map.set(String(type), ClassRef);
      },
      get(type) {
        return map.get(String(type));
      }
    };
  }();
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItY29yZS5paWZlLmpzIiwibmFtZXMiOlsidyIsIkNvcmUiLCJXUEJDX0JGQl9Db3JlIiwiV1BCQ19CRkJfSWRTZXJ2aWNlIiwiY29uc3RydWN0b3IiLCJwYWdlc19jb250YWluZXIiLCJlbnN1cmVfdW5pcXVlX2ZpZWxkX2lkIiwiYmFzZUlkIiwiY3VycmVudEVsIiwiYmFzZSIsIldQQkNfQkZCX1Nhbml0aXplIiwic2FuaXRpemVfaHRtbF9pZCIsImlkIiwiZXNjIiwidiIsImVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciIsImVzY1VpZCIsIm5vdFNlbGYiLCJkYXRhc2V0IiwidWlkIiwicXVlcnlTZWxlY3RvciIsImZvdW5kIiwiTWF0aCIsInJhbmRvbSIsInRvU3RyaW5nIiwic2xpY2UiLCJlbnN1cmVfdW5pcXVlX2ZpZWxkX25hbWUiLCJuYW1lIiwiY2xhc2hlcyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJvdGhlciIsIkFycmF5IiwiZnJvbSIsImZpbmQiLCJlbCIsIm0iLCJtYXRjaCIsInJlcGxhY2UiLCJOdW1iZXIiLCJzZXRfZmllbGRfaWQiLCJmaWVsZF9lbCIsIm5ld0lkUmF3IiwicmVuZGVyUHJldmlldyIsImRlc2lyZWQiLCJ1bmlxdWUiLCJzZXRBdHRyaWJ1dGUiLCJzZXRfZmllbGRfbmFtZSIsIm5ld05hbWVSYXciLCJyYXciLCJTdHJpbmciLCJ0cmltIiwic2FuaXRpemVfaHRtbF9uYW1lIiwiZ2V0QXR0cmlidXRlIiwic2V0X2ZpZWxkX2h0bWxfaWQiLCJuZXdIdG1sSWRSYXciLCJyZW1vdmVBdHRyaWJ1dGUiLCJodG1sSWQiLCJjbGFzaCIsIldQQkNfQkZCX0xheW91dFNlcnZpY2UiLCJvcHRzIiwiY29sX2dhcF9wZXJjZW50IiwiaXNGaW5pdGUiLCJjb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3JvdyIsInJvd19lbCIsImdhcF9wZXJjZW50IiwiY29scyIsIm4iLCJsZW5ndGgiLCJtYXAiLCJjb2wiLCJzdHlsZSIsImZsZXhCYXNpcyIsInAiLCJwYXJzZV9wZXJjZW50IiwiTmFOIiwic3VtX3JhdyIsInJlZHVjZSIsImEiLCJiIiwiZ3AiLCJ0b3RhbF9nYXBzIiwibWF4IiwiYXZhaWxhYmxlIiwic2NhbGUiLCJiYXNlcyIsImFwcGx5X2Jhc2VzX3RvX3JvdyIsImZvckVhY2giLCJpIiwic2V0X2VxdWFsX2Jhc2VzIiwiZWFjaCIsImZpbGwiLCJhcHBseV9sYXlvdXRfcHJlc2V0Iiwic2VjdGlvbk9yUm93Iiwid2VpZ2h0cyIsInJvdyIsImNsYXNzTGlzdCIsImNvbnRhaW5zIiwiaXNBcnJheSIsInN1bSIsImJ1aWxkX3ByZXNldHNfZm9yX2NvbHVtbnMiLCJmb3JtYXRfcHJlc2V0X2xhYmVsIiwicm91bmQiLCJqb2luIiwicGFyc2Vfd2VpZ2h0cyIsImlucHV0Iiwic3BsaXQiLCJzIiwicGFyc2VGbG9hdCIsImZpbHRlciIsIldQQkNfQkZCX1VzYWdlTGltaXRTZXJ2aWNlIiwicGFsZXR0ZV91bHMiLCJwYXJzZV91c2FnZV9saW1pdCIsIkluZmluaXR5IiwicGFyc2VJbnQiLCJjb3VudF91c2FnZV9ieV9rZXkiLCJ1c2VkIiwiYWxsIiwia2V5IiwidXNhZ2Vfa2V5IiwiZ2V0X2xpbWl0X2Zvcl9rZXkiLCJhbGxQYWxldHRlRmllbGRzIiwiZG9jdW1lbnQiLCJsaW1pdCIsInVzYWdlbnVtYmVyIiwidXBkYXRlX3BhbGV0dGVfdWkiLCJ1c2FnZSIsInBhbGV0dGVzIiwicGFsIiwicGFuZWxfZmllbGQiLCJwYWxldHRlSWQiLCJyYXdfbGltaXQiLCJwZXJFbExpbWl0IiwiZ2xvYmFsTGltaXQiLCJjdXJyZW50IiwiZGlzYWJsZSIsInBvaW50ZXJFdmVudHMiLCJvcGFjaXR5IiwiY291bnRfZm9yX2tleSIsImxpbWl0X2Zvcl9rZXkiLCJyZW1haW5pbmdfZm9yX2tleSIsImNhbl9hZGQiLCJkZWx0YSIsInJlbSIsImdhdGVfb3JfYWxlcnQiLCJsYWJlbCIsImFsZXJ0IiwiaXNfdXNhZ2Vfb2siLCJXUEJDX0JGQl9FdmVudHMiLCJPYmplY3QiLCJmcmVlemUiLCJTRUxFQ1QiLCJDTEVBUl9TRUxFQ1RJT04iLCJGSUVMRF9BREQiLCJGSUVMRF9SRU1PVkUiLCJTVFJVQ1RVUkVfQ0hBTkdFIiwiU1RSVUNUVVJFX0xPQURFRCIsIldQQkNfQkZCX0V2ZW50QnVzIiwic2NvcGVfZWwiLCJlbWl0IiwidHlwZSIsImRldGFpbCIsImRpc3BhdGNoRXZlbnQiLCJDdXN0b21FdmVudCIsImJ1YmJsZXMiLCJvbiIsImhhbmRsZXIiLCJhZGRFdmVudExpc3RlbmVyIiwib2ZmIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIldQQkNfQkZCX1NvcnRhYmxlTWFuYWdlciIsImJ1aWxkZXIiLCJncm91cE5hbWUiLCJhbmltYXRpb24iLCJnaG9zdENsYXNzIiwiY2hvc2VuQ2xhc3MiLCJkcmFnQ2xhc3MiLCJfY29udGFpbmVycyIsIlNldCIsIl90YWdfZHJhZ19taXJyb3IiLCJldnQiLCJmcm9tUGFsZXR0ZSIsImluY2x1ZGVzIiwicm9sZSIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm1pcnJvciIsIl90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MiLCJhY3RpdmUiLCJmcm9tX3BhbGV0dGUiLCJyb290IiwiZG9jdW1lbnRFbGVtZW50IiwiYWRkIiwicmVtb3ZlIiwiZW5zdXJlIiwiY29udGFpbmVyIiwiaGFuZGxlcnMiLCJTb3J0YWJsZSIsImdldCIsImNvbW1vbiIsImZvcmNlRmFsbGJhY2siLCJmYWxsYmFja09uQm9keSIsImZhbGxiYWNrVG9sZXJhbmNlIiwib25TdGFydCIsIl9hZGRfZHJhZ2dpbmdfY2xhc3MiLCJvbkVuZCIsInNldFRpbWVvdXQiLCJfcmVtb3ZlX2RyYWdnaW5nX2NsYXNzIiwiY3JlYXRlIiwiZ3JvdXAiLCJwdWxsIiwicHV0Iiwic29ydCIsInRvIiwiZHJhZ2dlZEVsIiwiaGFuZGxlIiwiZHJhZ2dhYmxlIiwicHJldmVudE9uRmlsdGVyIiwiZGlyZWN0aW9uIiwiaW52ZXJ0U3dhcCIsInN3YXBUaHJlc2hvbGQiLCJpbnZlcnRlZFN3YXBUaHJlc2hvbGQiLCJlbXB0eUluc2VydFRocmVzaG9sZCIsImRyYWdvdmVyQnViYmxlIiwic2Nyb2xsIiwic2Nyb2xsU2Vuc2l0aXZpdHkiLCJzY3JvbGxTcGVlZCIsIm9uTW92ZSIsIm9yaWdpbmFsRXZlbnQiLCJpc0NvbHVtbiIsImZyb21Sb3ciLCJjbG9zZXN0IiwidG9Sb3ciLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiZXZ0WCIsInRvdWNoZXMiLCJjbGllbnRYIiwiZXZ0WSIsImNsaWVudFkiLCJwYWRkaW5nWCIsImNsYW1wIiwid2lkdGgiLCJwYWRkaW5nWSIsImhlaWdodCIsImlzVmlzdWFsbHlFbXB0eSIsImNoaWxkRWxlbWVudENvdW50IiwiaW5uZXJUb3AiLCJ0b3AiLCJpbm5lckJvdHRvbSIsImJvdHRvbSIsImlubmVyTGVmdCIsImxlZnQiLCJpbm5lclJpZ2h0IiwicmlnaHQiLCJpbnNpZGVYIiwiaW5zaWRlWSIsImRzIiwiX2RyYWdTdGF0ZSIsInN0aWNreVRvIiwiY29tbWl0WCIsImNvbW1pdFkiLCJkZWVwSW5zaWRlIiwibGFzdFN3aXRjaFRzIiwicGVyZm9ybWFuY2UiLCJub3ciLCJvbkFkZCIsImhhbmRsZV9vbl9hZGQiLCJiaW5kIiwiZGVzdHJveUFsbCIsImluc3QiLCJkZXN0cm95IiwiY2xlYXIiLCJXUEJDX0JGQl9ET00iLCJTRUxFQ1RPUlMiLCJwYWdlUGFuZWwiLCJmaWVsZCIsInZhbGlkRmllbGQiLCJzZWN0aW9uIiwiY29sdW1uIiwib3ZlcmxheSIsIkNMQVNTRVMiLCJzZWxlY3RlZCIsIkFUVFIiLCJ1c2FnZUtleSIsIldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlciIsImNyZWF0ZV9lbGVtZW50IiwidGFnIiwiY2xhc3NfbmFtZSIsImlubmVyX2h0bWwiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwiaW5uZXJIVE1MIiwic2V0X2RhdGFfYXR0cmlidXRlcyIsImRhdGFfb2JqIiwiZW50cmllcyIsInZhbCIsInZhbHVlIiwiSlNPTiIsInN0cmluZ2lmeSIsImdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzIiwiZGF0YSIsImF0dHJpYnV0ZXMiLCJhdHRyIiwic3RhcnRzV2l0aCIsInBhcnNlIiwiZSIsImhhc0V4cGxpY2l0TGFiZWwiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJjaGFyQXQiLCJ0b1VwcGVyQ2FzZSIsInJlbmRlcl9maWVsZF9pbm5lcl9odG1sIiwiZmllbGRfZGF0YSIsImhhc0xhYmVsIiwiaXNfcmVxdWlyZWQiLCJyZXF1aXJlZCIsIndyYXBwZXIiLCJzcGFuTGFiZWwiLCJ0ZXh0Q29udGVudCIsImFwcGVuZENoaWxkIiwic3BhblR5cGUiLCJkZWJvdW5jZSIsImZuIiwid2FpdCIsInQiLCJkZWJvdW5jZWQiLCJhcmdzIiwiY2xlYXJUaW1lb3V0IiwiYXBwbHkiLCJXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSIsIk1hcCIsInJlZ2lzdGVyIiwiQ2xhc3NSZWYiLCJzZXQiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2JmYi1jb3JlLmlpZmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9fb3V0L2JmYi1jb3JlLmlpZmUuanMgPT0gVGltZSBwb2ludDogMjAyNS0wOC0yMSAxNzozOVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKCBmdW5jdGlvbiAoIHcgKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvLyBEZWZpbmUgY29yZSBvbiBhIHNpbmdsZSBuYW1lc3BhY2UuXHJcblx0Y29uc3QgQ29yZSA9ICh3LldQQkNfQkZCX0NvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwge30pO1xyXG5cclxuXHQvKipcclxuXHQgKiBXUEJDIElEIC8gTmFtZSBzZXJ2aWNlLiBHZW5lcmF0ZXMsIHNhbml0aXplcywgYW5kIGVuc3VyZXMgdW5pcXVlbmVzcyBmb3IgZmllbGQgaWRzL25hbWVzL2h0bWxfaWRzIHdpdGhpbiB0aGUgY2FudmFzLlxyXG5cdCAqL1xyXG5cdENvcmUuV1BCQ19CRkJfSWRTZXJ2aWNlID0gY2xhc3MgIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbnN0cnVjdG9yLiBTZXQgcm9vdCBjb250YWluZXIgb2YgdGhlIGZvcm0gcGFnZXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFnZXNfY29udGFpbmVyIC0gUm9vdCBjb250YWluZXIgb2YgdGhlIGZvcm0gcGFnZXMuXHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKCBwYWdlc19jb250YWluZXIgKSB7XHJcblx0XHRcdHRoaXMucGFnZXNfY29udGFpbmVyID0gcGFnZXNfY29udGFpbmVyO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW5zdXJlIGEgdW5pcXVlICoqaW50ZXJuYWwqKiBmaWVsZCBpZCAoc3RvcmVkIGluIGRhdGEtaWQpIHdpdGhpbiB0aGUgY2FudmFzLlxyXG5cdFx0ICogU3RhcnRzIGZyb20gYSBkZXNpcmVkIGlkIChhbHJlYWR5IHNhbml0aXplZCBvciBub3QpIGFuZCBhcHBlbmRzIHN1ZmZpeGVzIGlmIG5lZWRlZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYmFzZUlkIC0gRGVzaXJlZCBpZC5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IFVuaXF1ZSBpZC5cclxuXHRcdCAqL1xyXG5cdFx0ZW5zdXJlX3VuaXF1ZV9maWVsZF9pZChiYXNlSWQsIGN1cnJlbnRFbCA9IG51bGwpIHtcclxuXHRcdFx0Y29uc3QgYmFzZSAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9pZCggYmFzZUlkICk7XHJcblx0XHRcdGxldCBpZCAgICAgICAgPSBiYXNlIHx8ICdmaWVsZCc7XHJcblx0XHRcdGNvbnN0IGVzYyAgICAgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IoIHYgKTtcclxuXHRcdFx0Y29uc3QgZXNjVWlkICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdiApO1xyXG5cdFx0XHRjb25zdCBub3RTZWxmID0gY3VycmVudEVsPy5kYXRhc2V0Py51aWQgPyBgOm5vdChbZGF0YS11aWQ9XCIke2VzY1VpZCggY3VycmVudEVsLmRhdGFzZXQudWlkICl9XCJdKWAgOiAnJztcclxuXHRcdFx0d2hpbGUgKCB0aGlzLnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcihcclxuXHRcdFx0XHRgLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkJHtub3RTZWxmfVtkYXRhLWlkPVwiJHtlc2MoIGlkICl9XCJdYFxyXG5cdFx0XHQpICkge1xyXG5cdFx0XHRcdC8vIEV4Y2x1ZGVzIHNlbGYgYnkgZGF0YS11aWQgLlxyXG5cdFx0XHRcdGNvbnN0IGZvdW5kID0gdGhpcy5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvciggYC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZFtkYXRhLWlkPVwiJHtlc2MoIGlkICl9XCJdYCApO1xyXG5cdFx0XHRcdGlmICggZm91bmQgJiYgY3VycmVudEVsICYmIGZvdW5kID09PSBjdXJyZW50RWwgKSB7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWQgPSBgJHtiYXNlIHx8ICdmaWVsZCd9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZyggMzYgKS5zbGljZSggMiwgNSApfWA7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGlkO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW5zdXJlIGEgdW5pcXVlIEhUTUwgbmFtZSBhY3Jvc3MgdGhlIGZvcm0uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJhc2UgLSBEZXNpcmVkIGJhc2UgbmFtZSAodW4vc2FuaXRpemVkKS5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gY3VycmVudEVsIC0gSWYgcHJvdmlkZWQsIGlnbm9yZSBjb25mbGljdHMgd2l0aCB0aGlzIGVsZW1lbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBVbmlxdWUgbmFtZS5cclxuXHRcdCAqL1xyXG5cdFx0ZW5zdXJlX3VuaXF1ZV9maWVsZF9uYW1lKGJhc2UsIGN1cnJlbnRFbCA9IG51bGwpIHtcclxuXHRcdFx0bGV0IG5hbWUgID0gYmFzZSB8fCAnZmllbGQnO1xyXG5cdFx0XHRjb25zdCBlc2MgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IoIHYgKTtcclxuXHRcdFx0d2hpbGUgKCB0cnVlICkge1xyXG5cdFx0XHRcdGNvbnN0IGNsYXNoZXMgPSB0aGlzLnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3RvckFsbChcclxuXHRcdFx0XHRcdGAud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGRbZGF0YS1uYW1lPVwiJHtlc2MoIG5hbWUgKX1cIl1gXHJcblx0XHRcdFx0KSB8fCBbXTtcclxuXHRcdFx0XHRjb25zdCBvdGhlciAgID0gQXJyYXkuZnJvbSggY2xhc2hlcyApLmZpbmQoIGVsID0+IGVsICE9PSBjdXJyZW50RWwgKTtcclxuXHRcdFx0XHRpZiAoICEgb3RoZXIgKSBicmVhaztcclxuXHRcdFx0XHRjb25zdCBtID0gbmFtZS5tYXRjaCggLy0oXFxkKykkLyApO1xyXG5cdFx0XHRcdG5hbWUgICAgPSBtID8gbmFtZS5yZXBsYWNlKCAvLVxcZCskLywgJy0nICsgKE51bWJlciggbVsxXSApICsgMSkgKSA6IGAke2Jhc2V9LTJgO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBuYW1lO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2V0IGZpZWxkJ3MgSU5URVJOQUwgaWQgKGRhdGEtaWQpIG9uIGFuIGVsZW1lbnQuIEVuc3VyZXMgdW5pcXVlbmVzcyBhbmQgb3B0aW9uYWxseSBhc2tzIGNhbGxlciB0byByZWZyZXNoIHByZXZpZXcuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZmllbGRfZWwgLSBGaWVsZCBlbGVtZW50IGluIHRoZSBjYW52YXMuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbmV3SWRSYXcgLSBEZXNpcmVkIGlkICh1bi9zYW5pdGl6ZWQpLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbcmVuZGVyUHJldmlldz1mYWxzZV0gLSBDYWxsZXIgY2FuIGRlY2lkZSB0byByZS1yZW5kZXIgcHJldmlldy5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEFwcGxpZWQgdW5pcXVlIGlkLlxyXG5cdFx0ICovXHJcblx0XHRzZXRfZmllbGRfaWQoIGZpZWxkX2VsLCBuZXdJZFJhdywgcmVuZGVyUHJldmlldyA9IGZhbHNlICkge1xyXG5cdFx0XHRjb25zdCBkZXNpcmVkID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCBuZXdJZFJhdyApO1xyXG5cdFx0XHRjb25zdCB1bmlxdWUgID0gdGhpcy5lbnN1cmVfdW5pcXVlX2ZpZWxkX2lkKCBkZXNpcmVkLCBmaWVsZF9lbCApO1xyXG5cdFx0XHRmaWVsZF9lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWlkJywgdW5pcXVlICk7XHJcblx0XHRcdGlmICggcmVuZGVyUHJldmlldyApIHtcclxuXHRcdFx0XHQvLyBDYWxsZXIgZGVjaWRlcyBpZiAvIHdoZW4gdG8gcmVuZGVyLlxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB1bmlxdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZmllbGQncyBSRVFVSVJFRCBIVE1MIG5hbWUgKGRhdGEtbmFtZSkuIEVuc3VyZXMgc2FuaXRpemVkICsgdW5pcXVlIHBlciBmb3JtLlxyXG5cdFx0ICogRmFsbHMgYmFjayB0byBzYW5pdGl6ZWQgaW50ZXJuYWwgaWQgaWYgdXNlciBwcm92aWRlcyBlbXB0eSB2YWx1ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIEZpZWxkIGVsZW1lbnQgaW4gdGhlIGNhbnZhcy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBuZXdOYW1lUmF3IC0gRGVzaXJlZCBuYW1lICh1bi9zYW5pdGl6ZWQpLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbcmVuZGVyUHJldmlldz1mYWxzZV0gLSBDYWxsZXIgY2FuIGRlY2lkZSB0byByZS1yZW5kZXIgcHJldmlldy5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEFwcGxpZWQgdW5pcXVlIG5hbWUuXHJcblx0XHQgKi9cclxuXHRcdHNldF9maWVsZF9uYW1lKCBmaWVsZF9lbCwgbmV3TmFtZVJhdywgcmVuZGVyUHJldmlldyA9IGZhbHNlICkge1xyXG5cdFx0XHRjb25zdCByYXcgID0gKG5ld05hbWVSYXcgPT0gbnVsbCA/ICcnIDogU3RyaW5nKCBuZXdOYW1lUmF3ICkpLnRyaW0oKTtcclxuXHRcdFx0Y29uc3QgYmFzZSA9IHJhd1xyXG5cdFx0XHRcdD8gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX25hbWUoIHJhdyApXHJcblx0XHRcdFx0OiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggZmllbGRfZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1pZCcgKSB8fCAnZmllbGQnICk7XHJcblxyXG5cdFx0XHRjb25zdCB1bmlxdWUgPSB0aGlzLmVuc3VyZV91bmlxdWVfZmllbGRfbmFtZSggYmFzZSwgZmllbGRfZWwgKTtcclxuXHRcdFx0ZmllbGRfZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJywgdW5pcXVlICk7XHJcblx0XHRcdGlmICggcmVuZGVyUHJldmlldyApIHtcclxuXHRcdFx0XHQvLyBDYWxsZXIgZGVjaWRlcyBpZiAvIHdoZW4gdG8gcmVuZGVyLlxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB1bmlxdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZmllbGQncyBPUFRJT05BTCBwdWJsaWMgSFRNTCBpZCAoZGF0YS1odG1sX2lkKS4gRW1wdHkgdmFsdWUgcmVtb3ZlcyB0aGUgYXR0cmlidXRlLlxyXG5cdFx0ICogRW5zdXJlcyBzYW5pdGl6YXRpb24gKyB1bmlxdWVuZXNzIGFtb25nIG90aGVyIGRlY2xhcmVkIEhUTUwgaWRzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkX2VsIC0gRmllbGQgZWxlbWVudCBpbiB0aGUgY2FudmFzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5ld0h0bWxJZFJhdyAtIERlc2lyZWQgaHRtbF9pZCAob3B0aW9uYWwpLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbcmVuZGVyUHJldmlldz1mYWxzZV0gLSBDYWxsZXIgY2FuIGRlY2lkZSB0byByZS1yZW5kZXIgcHJldmlldy5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBhcHBsaWVkIGh0bWxfaWQgb3IgZW1wdHkgc3RyaW5nIGlmIHJlbW92ZWQuXHJcblx0XHQgKi9cclxuXHRcdHNldF9maWVsZF9odG1sX2lkKCBmaWVsZF9lbCwgbmV3SHRtbElkUmF3LCByZW5kZXJQcmV2aWV3ID0gZmFsc2UgKSB7XHJcblx0XHRcdGNvbnN0IHJhdyA9IChuZXdIdG1sSWRSYXcgPT0gbnVsbCA/ICcnIDogU3RyaW5nKCBuZXdIdG1sSWRSYXcgKSkudHJpbSgpO1xyXG5cclxuXHRcdFx0aWYgKCByYXcgPT09ICcnICkge1xyXG5cdFx0XHRcdGZpZWxkX2VsLnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtaHRtbF9pZCcgKTtcclxuXHRcdFx0XHRpZiAoIHJlbmRlclByZXZpZXcgKSB7XHJcblx0XHRcdFx0XHQvLyBDYWxsZXIgZGVjaWRlcyBpZiAvIHdoZW4gdG8gcmVuZGVyLlxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gJyc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGRlc2lyZWQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfaWQoIHJhdyApO1xyXG5cdFx0XHRsZXQgaHRtbElkICAgID0gZGVzaXJlZDtcclxuXHRcdFx0Y29uc3QgZXNjICAgICA9ICggdiApID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCB2ICk7XHJcblxyXG5cdFx0XHR3aGlsZSAoIHRydWUgKSB7XHJcblx0XHRcdFx0Y29uc3QgY2xhc2ggPSB0aGlzLnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3RvciggYC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZFtkYXRhLWh0bWxfaWQ9XCIke2VzYyggaHRtbElkICl9XCJdYCApO1xyXG5cdFx0XHRcdGlmICggISBjbGFzaCB8fCBjbGFzaCA9PT0gZmllbGRfZWwgKSB7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y29uc3QgbSA9IGh0bWxJZC5tYXRjaCggLy0oXFxkKykkLyApO1xyXG5cdFx0XHRcdGh0bWxJZCAgPSBtID8gaHRtbElkLnJlcGxhY2UoIC8tXFxkKyQvLCAnLScgKyAoTnVtYmVyKCBtWzFdICkgKyAxKSApIDogYCR7ZGVzaXJlZH0tMmA7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZpZWxkX2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtaHRtbF9pZCcsIGh0bWxJZCApO1xyXG5cdFx0XHRpZiAoIHJlbmRlclByZXZpZXcgKSB7XHJcblx0XHRcdFx0Ly8gQ2FsbGVyIGRlY2lkZXMgaWYgLyB3aGVuIHRvIHJlbmRlci5cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gaHRtbElkO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkMgTGF5b3V0IHNlcnZpY2UuIEVuY2Fwc3VsYXRlcyBjb2x1bW4gd2lkdGggbWF0aCB3aXRoIGdhcCBoYW5kbGluZywgcHJlc2V0cywgYW5kIHV0aWxpdGllcy5cclxuXHQgKi9cclxuXHRDb3JlLldQQkNfQkZCX0xheW91dFNlcnZpY2UgPSBjbGFzcyAge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29uc3RydWN0b3IuIFNldCBvcHRpb25zIHdpdGggZ2FwIGJldHdlZW4gY29sdW1ucyAoJSkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHt7IGNvbF9nYXBfcGVyY2VudD86IG51bWJlciB9fSBbb3B0c10gLSBPcHRpb25zIHdpdGggZ2FwIGJldHdlZW4gY29sdW1ucyAoJSkuXHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKCBvcHRzID0ge30gKSB7XHJcblx0XHRcdHRoaXMuY29sX2dhcF9wZXJjZW50ID0gTnVtYmVyLmlzRmluaXRlKCArb3B0cy5jb2xfZ2FwX3BlcmNlbnQgKSA/ICtvcHRzLmNvbF9nYXBfcGVyY2VudCA6IDM7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb21wdXRlIG5vcm1hbGl6ZWQgZmxleC1iYXNpcyB2YWx1ZXMgZm9yIGEgcm93LCByZXNwZWN0aW5nIGNvbHVtbiBnYXBzLlxyXG5cdFx0ICogUmV0dXJucyBiYXNlcyB0aGF0IHN1bSB0byBhdmFpbGFibGUgPSAxMDAgLSAobi0xKSpnYXAuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93X2VsIC0gUm93IGVsZW1lbnQgY29udGFpbmluZyAud3BiY19iZmJfX2NvbHVtbiBjaGlsZHJlbi5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbZ2FwX3BlcmNlbnQ9dGhpcy5jb2xfZ2FwX3BlcmNlbnRdIC0gR2FwIHBlcmNlbnQgYmV0d2VlbiBjb2x1bW5zLlxyXG5cdFx0ICogQHJldHVybnMge3thdmFpbGFibGU6bnVtYmVyLGJhc2VzOm51bWJlcltdfX0gQXZhaWxhYmxlIHNwYWNlIGFuZCBiYXNpcyB2YWx1ZXMuXHJcblx0XHQgKi9cclxuXHRcdGNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzX2Zyb21fcm93KCByb3dfZWwsIGdhcF9wZXJjZW50ID0gdGhpcy5jb2xfZ2FwX3BlcmNlbnQgKSB7XHJcblx0XHRcdGNvbnN0IGNvbHMgPSBBcnJheS5mcm9tKCByb3dfZWw/LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSB8fCBbXSApO1xyXG5cdFx0XHRjb25zdCBuICAgID0gY29scy5sZW5ndGggfHwgMTtcclxuXHJcblx0XHRcdGNvbnN0IHJhdyA9IGNvbHMubWFwKCAoIGNvbCApID0+IHtcclxuXHRcdFx0XHRjb25zdCB3ID0gY29sLnN0eWxlLmZsZXhCYXNpcyB8fCAnJztcclxuXHRcdFx0XHRjb25zdCBwID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5wYXJzZV9wZXJjZW50KCB3LCBOYU4gKTtcclxuXHRcdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBwICkgPyBwIDogKDEwMCAvIG4pO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRjb25zdCBzdW1fcmF3ICAgID0gcmF3LnJlZHVjZSggKCBhLCBiICkgPT4gYSArIGIsIDAgKSB8fCAxMDA7XHJcblx0XHRcdGNvbnN0IGdwICAgICAgICAgPSBOdW1iZXIuaXNGaW5pdGUoICtnYXBfcGVyY2VudCApID8gK2dhcF9wZXJjZW50IDogMztcclxuXHRcdFx0Y29uc3QgdG90YWxfZ2FwcyA9IE1hdGgubWF4KCAwLCBuIC0gMSApICogZ3A7XHJcblx0XHRcdGNvbnN0IGF2YWlsYWJsZSAgPSBNYXRoLm1heCggMCwgMTAwIC0gdG90YWxfZ2FwcyApO1xyXG5cdFx0XHRjb25zdCBzY2FsZSAgICAgID0gYXZhaWxhYmxlIC8gc3VtX3JhdztcclxuXHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0YXZhaWxhYmxlLFxyXG5cdFx0XHRcdGJhc2VzOiByYXcubWFwKCAoIHAgKSA9PiBNYXRoLm1heCggMCwgcCAqIHNjYWxlICkgKVxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwbHkgY29tcHV0ZWQgYmFzZXMgdG8gdGhlIHJvdydzIGNvbHVtbnMgKHNldHMgZmxleC1iYXNpcyAlKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb3dfZWwgLSBSb3cgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyW119IGJhc2VzIC0gQXJyYXkgb2YgYmFzaXMgdmFsdWVzIChwZXJjZW50IG9mIGZ1bGwgMTAwKS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRhcHBseV9iYXNlc190b19yb3coIHJvd19lbCwgYmFzZXMgKSB7XHJcblx0XHRcdGNvbnN0IGNvbHMgPSBBcnJheS5mcm9tKCByb3dfZWw/LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSB8fCBbXSApO1xyXG5cdFx0XHRjb2xzLmZvckVhY2goICggY29sLCBpICkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHAgICAgICAgICAgICAgPSBiYXNlc1tpXSA/PyAwO1xyXG5cdFx0XHRcdGNvbC5zdHlsZS5mbGV4QmFzaXMgPSBgJHtwfSVgO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXN0cmlidXRlIGNvbHVtbnMgZXZlbmx5LCByZXNwZWN0aW5nIGdhcC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb3dfZWwgLSBSb3cgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbZ2FwX3BlcmNlbnQ9dGhpcy5jb2xfZ2FwX3BlcmNlbnRdIC0gR2FwIHBlcmNlbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c2V0X2VxdWFsX2Jhc2VzKCByb3dfZWwsIGdhcF9wZXJjZW50ID0gdGhpcy5jb2xfZ2FwX3BlcmNlbnQgKSB7XHJcblx0XHRcdGNvbnN0IGNvbHMgICAgICAgPSBBcnJheS5mcm9tKCByb3dfZWw/LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSB8fCBbXSApO1xyXG5cdFx0XHRjb25zdCBuICAgICAgICAgID0gY29scy5sZW5ndGggfHwgMTtcclxuXHRcdFx0Y29uc3QgZ3AgICAgICAgICA9IE51bWJlci5pc0Zpbml0ZSggK2dhcF9wZXJjZW50ICkgPyArZ2FwX3BlcmNlbnQgOiAzO1xyXG5cdFx0XHRjb25zdCB0b3RhbF9nYXBzID0gTWF0aC5tYXgoIDAsIG4gLSAxICkgKiBncDtcclxuXHRcdFx0Y29uc3QgYXZhaWxhYmxlICA9IE1hdGgubWF4KCAwLCAxMDAgLSB0b3RhbF9nYXBzICk7XHJcblx0XHRcdGNvbnN0IGVhY2ggICAgICAgPSBhdmFpbGFibGUgLyBuO1xyXG5cdFx0XHR0aGlzLmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93X2VsLCBBcnJheSggbiApLmZpbGwoIGVhY2ggKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwbHkgYSBwcmVzZXQgb2YgcmVsYXRpdmUgd2VpZ2h0cyB0byBhIHJvdy9zZWN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25PclJvdyAtIC53cGJjX2JmYl9fc2VjdGlvbiBvciBpdHMgY2hpbGQgLndwYmNfYmZiX19yb3cuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcltdfSB3ZWlnaHRzIC0gUmVsYXRpdmUgd2VpZ2h0cyAoZS5nLiwgWzEsMywxXSkuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gW2dhcF9wZXJjZW50PXRoaXMuY29sX2dhcF9wZXJjZW50XSAtIEdhcCBwZXJjZW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGFwcGx5X2xheW91dF9wcmVzZXQoIHNlY3Rpb25PclJvdywgd2VpZ2h0cywgZ2FwX3BlcmNlbnQgPSB0aGlzLmNvbF9nYXBfcGVyY2VudCApIHtcclxuXHRcdFx0Y29uc3Qgcm93ID0gc2VjdGlvbk9yUm93Py5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX3JvdycgKVxyXG5cdFx0XHRcdD8gc2VjdGlvbk9yUm93XHJcblx0XHRcdFx0OiBzZWN0aW9uT3JSb3c/LnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAud3BiY19iZmJfX3JvdycgKTtcclxuXHJcblx0XHRcdGlmICggISByb3cgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjb2xzID0gQXJyYXkuZnJvbSggcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSB8fCBbXSApO1xyXG5cdFx0XHRjb25zdCBuICAgID0gY29scy5sZW5ndGggfHwgMTtcclxuXHJcblx0XHRcdGlmICggISBBcnJheS5pc0FycmF5KCB3ZWlnaHRzICkgfHwgd2VpZ2h0cy5sZW5ndGggIT09IG4gKSB7XHJcblx0XHRcdFx0dGhpcy5zZXRfZXF1YWxfYmFzZXMoIHJvdywgZ2FwX3BlcmNlbnQgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHN1bSAgICAgICA9IHdlaWdodHMucmVkdWNlKCAoIGEsIGIgKSA9PiBhICsgTWF0aC5tYXgoIDAsIE51bWJlciggYiApIHx8IDAgKSwgMCApIHx8IDE7XHJcblx0XHRcdGNvbnN0IGdwICAgICAgICA9IE51bWJlci5pc0Zpbml0ZSggK2dhcF9wZXJjZW50ICkgPyArZ2FwX3BlcmNlbnQgOiAzO1xyXG5cdFx0XHRjb25zdCBhdmFpbGFibGUgPSBNYXRoLm1heCggMCwgMTAwIC0gTWF0aC5tYXgoIDAsIG4gLSAxICkgKiBncCApO1xyXG5cdFx0XHRjb25zdCBiYXNlcyAgICAgPSB3ZWlnaHRzLm1hcCggKCB3ICkgPT4gTWF0aC5tYXgoIDAsIChOdW1iZXIoIHcgKSB8fCAwKSAvIHN1bSAqIGF2YWlsYWJsZSApICk7XHJcblxyXG5cdFx0XHR0aGlzLmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93LCBiYXNlcyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQnVpbGQgcHJlc2V0IHdlaWdodCBsaXN0cyBmb3IgYSBnaXZlbiBjb2x1bW4gY291bnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IG4gLSBDb2x1bW4gY291bnQuXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyW11bXX0gTGlzdCBvZiB3ZWlnaHQgYXJyYXlzLlxyXG5cdFx0ICovXHJcblx0XHRidWlsZF9wcmVzZXRzX2Zvcl9jb2x1bW5zKCBuICkge1xyXG5cdFx0XHRzd2l0Y2ggKCBuICkge1xyXG5cdFx0XHRcdGNhc2UgMTpcclxuXHRcdFx0XHRcdHJldHVybiBbIFsgMSBdIF07XHJcblx0XHRcdFx0Y2FzZSAyOlxyXG5cdFx0XHRcdFx0cmV0dXJuIFsgWyAxLCAyIF0sIFsgMiwgMSBdLCBbIDEsIDMgXSwgWyAzLCAxIF0gXTtcclxuXHRcdFx0XHRjYXNlIDM6XHJcblx0XHRcdFx0XHRyZXR1cm4gWyBbIDEsIDMsIDEgXSwgWyAxLCAyLCAxIF0sIFsgMiwgMSwgMSBdLCBbIDEsIDEsIDIgXSBdO1xyXG5cdFx0XHRcdGNhc2UgNDpcclxuXHRcdFx0XHRcdHJldHVybiBbIFsgMSwgMiwgMiwgMSBdLCBbIDIsIDEsIDEsIDEgXSwgWyAxLCAxLCAxLCAyIF0gXTtcclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdFx0cmV0dXJuIFsgQXJyYXkoIG4gKS5maWxsKCAxICkgXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRm9ybWF0IGEgaHVtYW4tcmVhZGFibGUgbGFiZWwgbGlrZSBcIjUwJS8yNSUvMjUlXCIgZnJvbSB3ZWlnaHRzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyW119IHdlaWdodHMgLSBXZWlnaHQgbGlzdC5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IExhYmVsIHN0cmluZy5cclxuXHRcdCAqL1xyXG5cdFx0Zm9ybWF0X3ByZXNldF9sYWJlbCggd2VpZ2h0cyApIHtcclxuXHRcdFx0Y29uc3Qgc3VtID0gd2VpZ2h0cy5yZWR1Y2UoICggYSwgYiApID0+IGEgKyAoTnVtYmVyKCBiICkgfHwgMCksIDAgKSB8fCAxO1xyXG5cdFx0XHRyZXR1cm4gd2VpZ2h0cy5tYXAoICggdyApID0+IE1hdGgucm91bmQoICgoTnVtYmVyKCB3ICkgfHwgMCkgLyBzdW0pICogMTAwICkgKS5qb2luKCAnJS8nICkgKyAnJSc7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBjb21tYS9zcGFjZSBzZXBhcmF0ZWQgd2VpZ2h0cyBpbnRvIG51bWJlcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGlucHV0IC0gVXNlciBpbnB1dCBsaWtlIFwiMjAsNjAsMjBcIi5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJbXX0gUGFyc2VkIHdlaWdodHMuXHJcblx0XHQgKi9cclxuXHRcdHBhcnNlX3dlaWdodHMoIGlucHV0ICkge1xyXG5cdFx0XHRpZiAoICEgaW5wdXQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIGlucHV0IClcclxuXHRcdFx0XHQucmVwbGFjZSggL1teXFxkLC5cXHNdL2csICcnIClcclxuXHRcdFx0XHQuc3BsaXQoIC9bXFxzLF0rLyApXHJcblx0XHRcdFx0Lm1hcCggKCBzICkgPT4gcGFyc2VGbG9hdCggcyApIClcclxuXHRcdFx0XHQuZmlsdGVyKCAoIG4gKSA9PiBOdW1iZXIuaXNGaW5pdGUoIG4gKSAmJiBuID49IDAgKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBXUEJDIFVzYWdlIExpbWl0IHNlcnZpY2UuXHJcblx0ICogQ291bnRzIGZpZWxkIHVzYWdlIGJ5IGtleSwgY29tcGFyZXMgdG8gcGFsZXR0ZSBsaW1pdHMsIGFuZCB1cGRhdGVzIHBhbGV0dGUgVUkuXHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9Vc2FnZUxpbWl0U2VydmljZSA9IGNsYXNzICB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb25zdHJ1Y3Rvci4gU2V0IHBhZ2VzX2NvbnRhaW5lciBhbmQgcGFsZXR0ZV91bC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYWdlc19jb250YWluZXIgLSBDYW52YXMgcm9vdCB0aGF0IGhvbGRzIHBsYWNlZCBmaWVsZHMuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50W118bnVsbH0gcGFsZXR0ZV91bHM/OiAgIFBhbGV0dGVzIFVMIHdpdGggLndwYmNfYmZiX19maWVsZCBpdGVtcyAobWF5IGJlIG51bGwpLlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3RvcihwYWdlc19jb250YWluZXIsIHBhbGV0dGVfdWxzKSB7XHJcblx0XHRcdHRoaXMucGFnZXNfY29udGFpbmVyID0gcGFnZXNfY29udGFpbmVyO1xyXG5cdFx0XHQvLyBOb3JtYWxpemUgdG8gYW4gYXJyYXk7IHdl4oCZbGwgc3RpbGwgYmUgcm9idXN0IGlmIG5vbmUgcHJvdmlkZWQuXHJcblx0XHRcdHRoaXMucGFsZXR0ZV91bHMgICAgID0gQXJyYXkuaXNBcnJheSggcGFsZXR0ZV91bHMgKSA/IHBhbGV0dGVfdWxzIDogKHBhbGV0dGVfdWxzID8gWyBwYWxldHRlX3VscyBdIDogW10pO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBhcnNlIHVzYWdlIGxpbWl0IGZyb20gcmF3IGRhdGFzZXQgdmFsdWUuIE1pc3NpbmcvaW52YWxpZCAtPiBJbmZpbml0eS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ8bnVsbHx1bmRlZmluZWR9IHJhdyAtIFJhdyBhdHRyaWJ1dGUgdmFsdWUuXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfSBMaW1pdCBudW1iZXIgb3IgSW5maW5pdHkuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBwYXJzZV91c2FnZV9saW1pdCggcmF3ICkge1xyXG5cdFx0XHRpZiAoIHJhdyA9PSBudWxsICkge1xyXG5cdFx0XHRcdHJldHVybiBJbmZpbml0eTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBuID0gcGFyc2VJbnQoIHJhdywgMTAgKTtcclxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gbiA6IEluZmluaXR5O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ291bnQgaG93IG1hbnkgaW5zdGFuY2VzIGV4aXN0IHBlciB1c2FnZV9rZXkgaW4gdGhlIGNhbnZhcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7UmVjb3JkPHN0cmluZywgbnVtYmVyPn0gTWFwIG9mIHVzYWdlX2tleSAtPiBjb3VudC5cclxuXHRcdCAqL1xyXG5cdFx0Y291bnRfdXNhZ2VfYnlfa2V5KCkge1xyXG5cdFx0XHRjb25zdCB1c2VkID0ge307XHJcblx0XHRcdGNvbnN0IGFsbCAgPSB0aGlzLnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZDpub3QoLmlzLWludmFsaWQpJyApIHx8IFtdO1xyXG5cdFx0XHRhbGwuZm9yRWFjaCggKCBlbCApID0+IHtcclxuXHRcdFx0XHRjb25zdCBrZXkgPSBlbC5kYXRhc2V0LnVzYWdlX2tleSB8fCBlbC5kYXRhc2V0LmlkO1xyXG5cdFx0XHRcdGlmICggISBrZXkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHVzZWRba2V5XSA9ICh1c2VkW2tleV0gfHwgMCkgKyAxO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHJldHVybiB1c2VkO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIHBhbGV0dGUgbGltaXQgZm9yIGEgZ2l2ZW4gdXNhZ2Uga2V5IChpZCBvZiB0aGUgcGFsZXR0ZSBpdGVtKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVXNhZ2Uga2V5LlxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn0gTGltaXQgdmFsdWUgb3IgSW5maW5pdHkuXHJcblx0XHQgKi9cclxuXHRcdGdldF9saW1pdF9mb3Jfa2V5KGtleSkge1xyXG5cdFx0XHRpZiAoICEga2V5ICkge1xyXG5cdFx0XHRcdHJldHVybiBJbmZpbml0eTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBRdWVyeSBhY3Jvc3MgYWxsIHBhbGV0dGVzIHByZXNlbnQgbm93IChzdG9yZWQgKyBhbnkgbmV3bHkgYWRkZWQgaW4gRE9NKS5cclxuXHRcdFx0Y29uc3QgYWxsUGFsZXR0ZUZpZWxkcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsX2ZpZWxkX3R5cGVzX191bCAud3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHRsZXQgbGltaXQgICAgICAgICAgICAgID0gSW5maW5pdHk7XHJcblxyXG5cdFx0XHRhbGxQYWxldHRlRmllbGRzLmZvckVhY2goIChlbCkgPT4ge1xyXG5cdFx0XHRcdGlmICggZWwuZGF0YXNldC5pZCA9PT0ga2V5ICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgbiA9IENvcmUuV1BCQ19CRkJfVXNhZ2VMaW1pdFNlcnZpY2UucGFyc2VfdXNhZ2VfbGltaXQoIGVsLmRhdGFzZXQudXNhZ2VudW1iZXIgKTtcclxuXHRcdFx0XHRcdC8vIENob29zZSB0aGUgc21hbGxlc3QgZmluaXRlIGxpbWl0IChzYWZlc3QgaWYgcGFsZXR0ZXMgZGlzYWdyZWUpLlxyXG5cdFx0XHRcdFx0aWYgKCBuIDwgbGltaXQgKSB7XHJcblx0XHRcdFx0XHRcdGxpbWl0ID0gbjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHJldHVybiBsaW1pdDtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXNhYmxlL2VuYWJsZSBwYWxldHRlIGl0ZW1zIGJhc2VkIG9uIGN1cnJlbnQgdXNhZ2UgY291bnRzIGFuZCBsaW1pdHMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHVwZGF0ZV9wYWxldHRlX3VpKCkge1xyXG5cdFx0XHQvLyBBbHdheXMgY29tcHV0ZSB1c2FnZSBmcm9tIHRoZSBjYW52YXM6XHJcblx0XHRcdGNvbnN0IHVzYWdlID0gdGhpcy5jb3VudF91c2FnZV9ieV9rZXkoKTtcclxuXHJcblx0XHRcdC8vIFVwZGF0ZSBhbGwgcGFsZXR0ZXMgY3VycmVudGx5IGluIERPTSAobm90IGp1c3QgdGhlIGluaXRpYWxseSBjYXB0dXJlZCBvbmVzKVxyXG5cdFx0XHRjb25zdCBwYWxldHRlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsX2ZpZWxkX3R5cGVzX191bCcgKTtcclxuXHJcblx0XHRcdHBhbGV0dGVzLmZvckVhY2goIChwYWwpID0+IHtcclxuXHRcdFx0XHRwYWwucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZmllbGQnICkuZm9yRWFjaCggKHBhbmVsX2ZpZWxkKSA9PiB7XHJcblx0XHRcdFx0XHRjb25zdCBwYWxldHRlSWQgICA9IHBhbmVsX2ZpZWxkLmRhdGFzZXQuaWQ7XHJcblx0XHRcdFx0XHRjb25zdCByYXdfbGltaXQgICA9IHBhbmVsX2ZpZWxkLmRhdGFzZXQudXNhZ2VudW1iZXI7XHJcblx0XHRcdFx0XHRjb25zdCBwZXJFbExpbWl0ICA9IENvcmUuV1BCQ19CRkJfVXNhZ2VMaW1pdFNlcnZpY2UucGFyc2VfdXNhZ2VfbGltaXQoIHJhd19saW1pdCApO1xyXG5cdFx0XHRcdFx0Ly8gRWZmZWN0aXZlIGxpbWl0IGFjcm9zcyBhbGwgcGFsZXR0ZXMgaXMgdGhlIGdsb2JhbCBsaW1pdCBmb3IgdGhpcyBrZXkuXHJcblx0XHRcdFx0XHRjb25zdCBnbG9iYWxMaW1pdCA9IHRoaXMuZ2V0X2xpbWl0X2Zvcl9rZXkoIHBhbGV0dGVJZCApO1xyXG5cdFx0XHRcdFx0Y29uc3QgbGltaXQgICAgICAgPSBOdW1iZXIuaXNGaW5pdGUoIGdsb2JhbExpbWl0ICkgPyBnbG9iYWxMaW1pdCA6IHBlckVsTGltaXQ7IC8vIHByZWZlciBnbG9iYWwgbWluXHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgY3VycmVudCA9IHVzYWdlW3BhbGV0dGVJZF0gfHwgMDtcclxuXHRcdFx0XHRcdGNvbnN0IGRpc2FibGUgPSBOdW1iZXIuaXNGaW5pdGUoIGxpbWl0ICkgJiYgY3VycmVudCA+PSBsaW1pdDtcclxuXHJcblx0XHRcdFx0XHRwYW5lbF9maWVsZC5zdHlsZS5wb2ludGVyRXZlbnRzID0gZGlzYWJsZSA/ICdub25lJyA6ICcnO1xyXG5cdFx0XHRcdFx0cGFuZWxfZmllbGQuc3R5bGUub3BhY2l0eSAgICAgICA9IGRpc2FibGUgPyAnMC40JyA6ICcnO1xyXG5cdFx0XHRcdFx0cGFuZWxfZmllbGQuc2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcsIGRpc2FibGUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0XHRpZiAoIGRpc2FibGUgKSB7XHJcblx0XHRcdFx0XHRcdHBhbmVsX2ZpZWxkLnNldEF0dHJpYnV0ZSggJ3RhYmluZGV4JywgJy0xJyApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0cGFuZWxfZmllbGQucmVtb3ZlQXR0cmlidXRlKCAndGFiaW5kZXgnICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIGhvdyBtYW55IHZhbGlkIGluc3RhbmNlcyB3aXRoIHRoaXMgdXNhZ2Uga2V5IGV4aXN0IGluIHRoZSBjYW52YXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJ9IENvdW50IG9mIGV4aXN0aW5nIG5vbi1pbnZhbGlkIGluc3RhbmNlcy5cclxuXHRcdCAqL1xyXG5cdFx0Y291bnRfZm9yX2tleSgga2V5ICkge1xyXG5cdFx0XHRpZiAoICEga2V5ICkge1xyXG5cdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiAoIHRoaXMucGFnZXNfY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yQWxsKFxyXG5cdFx0XHRcdGAud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGRbZGF0YS11c2FnZV9rZXk9XCIke0NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCBrZXkgKX1cIl06bm90KC5pcy1pbnZhbGlkKWBcclxuXHRcdFx0KSB8fCBbXSApLmxlbmd0aDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsaWFzIGZvciBsaW1pdCBsb29rdXAgKHJlYWRhYmlsaXR5KS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVXNhZ2Uga2V5IG9mIGEgcGFsZXR0ZSBpdGVtLlxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn0gTGltaXQgdmFsdWUgb3IgSW5maW5pdHkuXHJcblx0XHQgKi9cclxuXHRcdGxpbWl0X2Zvcl9rZXkoIGtleSApIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0X2xpbWl0X2Zvcl9rZXkoIGtleSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtYWluaW5nIHNsb3RzIGZvciB0aGlzIGtleSAoSW5maW5pdHkgaWYgdW5saW1pdGVkKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVXNhZ2Uga2V5IG9mIGEgcGFsZXR0ZSBpdGVtLlxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn0gUmVtYWluaW5nIGNvdW50ICg+PSAwKSBvciBJbmZpbml0eS5cclxuXHRcdCAqL1xyXG5cdFx0cmVtYWluaW5nX2Zvcl9rZXkoIGtleSApIHtcclxuXHRcdFx0Y29uc3QgbGltaXQgPSB0aGlzLmxpbWl0X2Zvcl9rZXkoIGtleSApO1xyXG5cdFx0XHRpZiAoIGxpbWl0ID09PSBJbmZpbml0eSApIHtcclxuXHRcdFx0XHRyZXR1cm4gSW5maW5pdHk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgdXNlZCA9IHRoaXMuY291bnRfZm9yX2tleSgga2V5ICk7XHJcblx0XHRcdHJldHVybiBNYXRoLm1heCggMCwgbGltaXQgLSB1c2VkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUcnVlIGlmIHlvdSBjYW4gYWRkIGBkZWx0YWAgbW9yZSBpdGVtcyBmb3IgdGhpcyBrZXkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbZGVsdGE9MV0gLSBIb3cgbWFueSBpdGVtcyB5b3UgaW50ZW5kIHRvIGFkZC5cclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufSBXaGV0aGVyIGFkZGluZyBpcyBhbGxvd2VkLlxyXG5cdFx0ICovXHJcblx0XHRjYW5fYWRkKCBrZXksIGRlbHRhID0gMSApIHtcclxuXHRcdFx0Y29uc3QgcmVtID0gdGhpcy5yZW1haW5pbmdfZm9yX2tleSgga2V5ICk7XHJcblx0XHRcdHJldHVybiAoIHJlbSA9PT0gSW5maW5pdHkgKSA/IHRydWUgOiAoIHJlbSA+PSBkZWx0YSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVUktZmFjaW5nIGdhdGU6IGFsZXJ0IHdoZW4gZXhjZWVkZWQuIFJldHVybnMgYm9vbGVhbiBhbGxvd2VkL2Jsb2NrZWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEBwYXJhbSB7e2xhYmVsPzogc3RyaW5nLCBkZWx0YT86IG51bWJlcn19IFtvcHRzPXt9XSAtIE9wdGlvbmFsIFVJIGluZm8uXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBhbGxvd2VkLCBmYWxzZSBpZiBibG9ja2VkLlxyXG5cdFx0ICovXHJcblx0XHRnYXRlX29yX2FsZXJ0KCBrZXksIHsgbGFiZWwgPSBrZXksIGRlbHRhID0gMSB9ID0ge30gKSB7XHJcblx0XHRcdGlmICggdGhpcy5jYW5fYWRkKCBrZXksIGRlbHRhICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgbGltaXQgPSB0aGlzLmxpbWl0X2Zvcl9rZXkoIGtleSApO1xyXG5cdFx0XHRhbGVydCggYE9ubHkgJHtsaW1pdH0gaW5zdGFuY2Uke2xpbWl0ID4gMSA/ICdzJyA6ICcnfSBvZiBcIiR7bGFiZWx9XCIgYWxsb3dlZC5gICk7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJhY2t3YXJkLWNvbXBhdGlibGUgYWxpYXMgdXNlZCBlbHNld2hlcmUgaW4gdGhlIGNvZGViYXNlLiAgLSBDaGVjayB3aGV0aGVyIGFub3RoZXIgaW5zdGFuY2Ugd2l0aCB0aGUgZ2l2ZW4gdXNhZ2Uga2V5IGNhbiBiZSBhZGRlZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVXNhZ2Uga2V5IG9mIGEgcGFsZXR0ZSBpdGVtLlxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IFdoZXRoZXIgYWRkaW5nIG9uZSBtb3JlIGlzIGFsbG93ZWQuXHJcblx0XHQgKi9cclxuXHRcdGlzX3VzYWdlX29rKCBrZXkgKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLmNhbl9hZGQoIGtleSwgMSApO1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDb25zdGFudCBldmVudCBuYW1lcyBmb3IgdGhlIGJ1aWxkZXIuXHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9FdmVudHMgPSBPYmplY3QuZnJlZXplKHtcclxuXHRcdFNFTEVDVCAgICAgICAgICAgIDogJ3dwYmM6YmZiOnNlbGVjdCcsXHJcblx0XHRDTEVBUl9TRUxFQ1RJT04gICA6ICd3cGJjOmJmYjpjbGVhci1zZWxlY3Rpb24nLFxyXG5cdFx0RklFTERfQUREICAgICAgICAgOiAnd3BiYzpiZmI6ZmllbGQ6YWRkJyxcclxuXHRcdEZJRUxEX1JFTU9WRSAgICAgIDogJ3dwYmM6YmZiOmZpZWxkOnJlbW92ZScsXHJcblx0XHRTVFJVQ1RVUkVfQ0hBTkdFICA6ICd3cGJjOmJmYjpzdHJ1Y3R1cmU6Y2hhbmdlJyxcclxuXHRcdFNUUlVDVFVSRV9MT0FERUQgIDogJ3dwYmM6YmZiOnN0cnVjdHVyZTpsb2FkZWQnXHJcblx0fSk7XHJcblxyXG5cdC8qKlxyXG5cdCAqIExpZ2h0d2VpZ2h0IGV2ZW50IGJ1cyB0aGF0IGVtaXRzIHRvIGJvdGggdGhlIHBhZ2VzIGNvbnRhaW5lciBhbmQgZG9jdW1lbnQuXHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9FdmVudEJ1cyA9ICBjbGFzcyB7XHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNjb3BlX2VsIC0gRWxlbWVudCB0byBkaXNwYXRjaCBidWJibGVkIGV2ZW50cyBmcm9tLlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3Rvciggc2NvcGVfZWwgKSB7XHJcblx0XHRcdHRoaXMuc2NvcGVfZWwgPSBzY29wZV9lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVtaXQgYSBET00gQ3VzdG9tRXZlbnQgd2l0aCBwYXlsb2FkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gRXZlbnQgdHlwZSAodXNlIENvcmUuV1BCQ19CRkJfRXZlbnRzLiB3aGVuIHBvc3NpYmxlKS5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbZGV0YWlsPXt9XSAtIEFyYml0cmFyeSBzZXJpYWxpemFibGUgcGF5bG9hZC5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRlbWl0KCB0eXBlLCBkZXRhaWwgPSB7fSApIHtcclxuXHRcdFx0aWYgKCAhIHRoaXMuc2NvcGVfZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuc2NvcGVfZWwuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCB0eXBlLCB7IGRldGFpbDogeyAuLi5kZXRhaWwgfSwgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN1YnNjcmliZSB0byBhbiBldmVudCBvbiBkb2N1bWVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIEV2ZW50IHR5cGUuXHJcblx0XHQgKiBAcGFyYW0geyhldjpDdXN0b21FdmVudCk9PnZvaWR9IGhhbmRsZXIgLSBIYW5kbGVyIGZ1bmN0aW9uLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdG9uKCB0eXBlLCBoYW5kbGVyICkge1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCB0eXBlLCBoYW5kbGVyICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBVbnN1YnNjcmliZSBmcm9tIGFuIGV2ZW50IG9uIGRvY3VtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gRXZlbnQgdHlwZS5cclxuXHRcdCAqIEBwYXJhbSB7KGV2OkN1c3RvbUV2ZW50KT0+dm9pZH0gaGFuZGxlciAtIEhhbmRsZXIgZnVuY3Rpb24uXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0b2ZmKCB0eXBlLCBoYW5kbGVyICkge1xyXG5cdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCB0eXBlLCBoYW5kbGVyICk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU29ydGFibGVKUyBtYW5hZ2VyOiBzaW5nbGUgcG9pbnQgZm9yIGNvbnNpc3RlbnQgRG5EIGNvbmZpZy5cclxuXHQgKi9cclxuXHRDb3JlLldQQkNfQkZCX1NvcnRhYmxlTWFuYWdlciA9IGNsYXNzICB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge1dQQkNfRm9ybV9CdWlsZGVyfSBidWlsZGVyIC0gVGhlIGFjdGl2ZSBidWlsZGVyIGluc3RhbmNlLlxyXG5cdFx0ICogQHBhcmFtIHt7IGdyb3VwTmFtZT86IHN0cmluZywgYW5pbWF0aW9uPzogbnVtYmVyLCBnaG9zdENsYXNzPzogc3RyaW5nLCBjaG9zZW5DbGFzcz86IHN0cmluZywgZHJhZ0NsYXNzPzogc3RyaW5nIH19IFtvcHRzPXt9XSAtIFZpc3VhbC9iZWhhdmlvciBvcHRpb25zLlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3RvciggYnVpbGRlciwgb3B0cyA9IHt9ICkge1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIgPSBidWlsZGVyO1xyXG5cdFx0XHR0aGlzLm9wdHMgPSB7XHJcblx0XHRcdFx0Z3JvdXBOYW1lICA6ICdmb3JtJyxcclxuXHRcdFx0XHRhbmltYXRpb24gIDogMTUwLFxyXG5cdFx0XHRcdGdob3N0Q2xhc3MgOiAnd3BiY19iZmJfX2RyYWctZ2hvc3QnLFxyXG5cdFx0XHRcdGNob3NlbkNsYXNzOiAnd3BiY19iZmJfX2hpZ2hsaWdodCcsXHJcblx0XHRcdFx0ZHJhZ0NsYXNzICA6ICd3cGJjX2JmYl9fZHJhZy1hY3RpdmUnLFxyXG5cdFx0XHRcdC4uLm9wdHNcclxuXHRcdFx0fTtcclxuXHRcdFx0LyoqIEB0eXBlIHtTZXQ8SFRNTEVsZW1lbnQ+fSAqL1xyXG5cdFx0XHR0aGlzLl9jb250YWluZXJzID0gbmV3IFNldCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGFnIHRoZSBkcmFnIG1pcnJvciAoZWxlbWVudCB1bmRlciBjdXJzb3IpIHdpdGggcm9sZTogJ3BhbGV0dGUnIHwgJ2NhbnZhcycuXHJcblx0XHQgKiBXb3JrcyB3aXRoIFNvcnRhYmxlJ3MgZmFsbGJhY2sgbWlycm9yICguc29ydGFibGUtZmFsbGJhY2sgLyAuc29ydGFibGUtZHJhZykgYW5kIHdpdGggeW91ciBkcmFnQ2xhc3MgKC53cGJjX2JmYl9fZHJhZy1hY3RpdmUpLlxyXG5cdFx0ICovXHJcblx0XHRfdGFnX2RyYWdfbWlycm9yKCBldnQgKSB7XHJcblx0XHRcdGNvbnN0IGZyb21QYWxldHRlID0gdGhpcy5idWlsZGVyPy5wYWxldHRlX3Vscz8uaW5jbHVkZXM/LiggZXZ0LmZyb20gKTtcclxuXHRcdFx0Y29uc3Qgcm9sZSAgICAgICAgPSBmcm9tUGFsZXR0ZSA/ICdwYWxldHRlJyA6ICdjYW52YXMnO1xyXG5cdFx0XHQvLyBXYWl0IGEgdGljayBzbyB0aGUgbWlycm9yIGV4aXN0cy4gIC0gVGhlIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKSBtZXRob2QgdGVsbHMgdGhlIGJyb3dzZXIgeW91IHdpc2ggdG8gcGVyZm9ybSBhbiBhbmltYXRpb24uXHJcblx0XHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSggKCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IG1pcnJvciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcuc29ydGFibGUtZmFsbGJhY2ssIC5zb3J0YWJsZS1kcmFnLCAuJyArIHRoaXMub3B0cy5kcmFnQ2xhc3MgKTtcclxuXHRcdFx0XHRpZiAoIG1pcnJvciApIHtcclxuXHRcdFx0XHRcdG1pcnJvci5zZXRBdHRyaWJ1dGUoICdkYXRhLWRyYWctcm9sZScsIHJvbGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRfdG9nZ2xlX2RuZF9yb290X2ZsYWdzKCBhY3RpdmUsIGZyb21fcGFsZXR0ZSA9IGZhbHNlICkge1xyXG5cclxuXHRcdFx0Ly8gc2V0IHRvIHJvb3QgZWxlbWVudCBvZiBhbiBIVE1MIGRvY3VtZW50LCB3aGljaCBpcyB0aGUgPGh0bWw+LlxyXG5cdFx0XHRjb25zdCByb290ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xyXG5cdFx0XHRpZiAoIGFjdGl2ZSApIHtcclxuXHRcdFx0XHRyb290LmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fZG5kLWFjdGl2ZScgKTtcclxuXHRcdFx0XHRpZiAoIGZyb21fcGFsZXR0ZSApIHtcclxuXHRcdFx0XHRcdHJvb3QuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19kcmFnLWZyb20tcGFsZXR0ZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cm9vdC5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY19iZmJfX2RuZC1hY3RpdmUnLCAnd3BiY19iZmJfX2RyYWctZnJvbS1wYWxldHRlJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW5zdXJlIFNvcnRhYmxlIGlzIGF0dGFjaGVkIHRvIGEgY29udGFpbmVyIHdpdGggcm9sZSAncGFsZXR0ZScgb3IgJ2NhbnZhcycuXHJcblx0XHQgKlxyXG5cdFx0ICogIC0tIEhhbmRsZSBzZWxlY3RvcnM6IGhhbmRsZTogICcuc2VjdGlvbi1kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWFueXdoZXJlLCBbZGF0YS1kcmFnZ2FibGU9XCJ0cnVlXCJdJ1xyXG5cdFx0ICogIC0tIERyYWdnYWJsZSBnYXRlOiBkcmFnZ2FibGU6ICcud3BiY19iZmJfX2ZpZWxkOm5vdChbZGF0YS1kcmFnZ2FibGU9XCJmYWxzZVwiXSksIC53cGJjX2JmYl9fc2VjdGlvbidcclxuXHRcdCAqICAtLSBGaWx0ZXIgKG92ZXJsYXktc2FmZSk6ICAgICBpZ25vcmUgZXZlcnl0aGluZyBpbiBvdmVybGF5IGV4Y2VwdCB0aGUgaGFuZGxlIC0gICcud3BiY19iZmJfX292ZXJsYXktY29udHJvbHMgKjpub3QoLndwYmNfYmZiX19kcmFnLWhhbmRsZSk6bm90KC5zZWN0aW9uLWRyYWctaGFuZGxlKTpub3QoLndwYmNfaWNuX2RyYWdfaW5kaWNhdG9yKSdcclxuXHRcdCAqICAtLSBOby1kcmFnIHdyYXBwZXI6ICAgICAgICAgICB1c2UgLndwYmNfYmZiX19uby1kcmFnLXpvbmUgaW5zaWRlIHJlbmRlcmVycyBmb3IgaW5wdXRzL3dpZGdldHMuXHJcblx0XHQgKiAgLS0gRm9jdXMgZ3VhcmQgKG9wdGlvbmFsKTogICAgZmxpcCBbZGF0YS1kcmFnZ2FibGVdIG9uIGZvY3VzaW4vZm9jdXNvdXQgdG8gcHJldmVudCBhY2NpZGVudGFsIGRyYWdzIHdoaWxlIHR5cGluZy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXIgLSBUaGUgZWxlbWVudCB0byBlbmhhbmNlIHdpdGggU29ydGFibGUuXHJcblx0XHQgKiBAcGFyYW0geydwYWxldHRlJ3wnY2FudmFzJ30gcm9sZSAtIEJlaGF2aW9yIHByb2ZpbGUgdG8gYXBwbHkuXHJcblx0XHQgKiBAcGFyYW0ge3sgb25BZGQ/OiBGdW5jdGlvbiB9fSBbaGFuZGxlcnM9e31dIC0gT3B0aW9uYWwgaGFuZGxlcnMuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZW5zdXJlKCBjb250YWluZXIsIHJvbGUsIGhhbmRsZXJzID0ge30gKSB7XHJcblx0XHRcdGlmICggISBjb250YWluZXIgfHwgdHlwZW9mIFNvcnRhYmxlID09PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBTb3J0YWJsZS5nZXQ/LiggY29udGFpbmVyICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjb21tb24gPSB7XHJcblx0XHRcdFx0YW5pbWF0aW9uICA6IHRoaXMub3B0cy5hbmltYXRpb24sXHJcblx0XHRcdFx0Z2hvc3RDbGFzcyA6IHRoaXMub3B0cy5naG9zdENsYXNzLFxyXG5cdFx0XHRcdGNob3NlbkNsYXNzOiB0aGlzLm9wdHMuY2hvc2VuQ2xhc3MsXHJcblx0XHRcdFx0ZHJhZ0NsYXNzICA6IHRoaXMub3B0cy5kcmFnQ2xhc3MsXHJcblx0XHRcdFx0Ly8gPT0gRWxlbWVudCB1bmRlciB0aGUgY3Vyc29yICA9PSBFbnN1cmUgd2UgZHJhZyBhIHJlYWwgRE9NIG1pcnJvciB5b3UgY2FuIHN0eWxlIHZpYSBDU1MgKGNyb3NzLWJyb3dzZXIpLlxyXG5cdFx0XHRcdGZvcmNlRmFsbGJhY2sgICAgOiB0cnVlLFxyXG5cdFx0XHRcdGZhbGxiYWNrT25Cb2R5ICAgOiB0cnVlLFxyXG5cdFx0XHRcdGZhbGxiYWNrVG9sZXJhbmNlOiA2LFxyXG5cdFx0XHRcdC8vIEFkZCBib2R5L2h0bWwgZmxhZ3Mgc28geW91IGNhbiBzdHlsZSBkaWZmZXJlbnRseSB3aGVuIGRyYWdnaW5nIGZyb20gcGFsZXR0ZS5cclxuXHRcdFx0XHRvblN0YXJ0OiAoZXZ0KSA9PiB7XHJcblx0XHRcdFx0XHR0aGlzLmJ1aWxkZXIuX2FkZF9kcmFnZ2luZ19jbGFzcygpO1xyXG5cclxuXHRcdFx0XHRcdGNvbnN0IGZyb21QYWxldHRlID0gdGhpcy5idWlsZGVyPy5wYWxldHRlX3Vscz8uaW5jbHVkZXM/LiggZXZ0LmZyb20gKTtcclxuXHRcdFx0XHRcdHRoaXMuX3RvZ2dsZV9kbmRfcm9vdF9mbGFncyggdHJ1ZSwgZnJvbVBhbGV0dGUgKTsgIC8vIHNldCB0byByb290IEhUTUwgZG9jdW1lbnQ6IGh0bWwud3BiY19iZmJfX2RuZC1hY3RpdmUud3BiY19iZmJfX2RyYWctZnJvbS1wYWxldHRlIC5cclxuXHJcblx0XHRcdFx0XHR0aGlzLl90YWdfZHJhZ19taXJyb3IoIGV2dCApOyAgICAgICAgICAgICAgICAgICAgICAvLyBBZGQgJ2RhdGEtZHJhZy1yb2xlJyBhdHRyaWJ1dGUgdG8gIGVsZW1lbnQgdW5kZXIgY3Vyc29yLlxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0b25FbmQgIDogKCkgPT4ge1xyXG5cdFx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4geyB0aGlzLmJ1aWxkZXIuX3JlbW92ZV9kcmFnZ2luZ19jbGFzcygpOyB9LCA1MCApO1xyXG5cdFx0XHRcdFx0dGhpcy5fdG9nZ2xlX2RuZF9yb290X2ZsYWdzKCBmYWxzZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGlmICggcm9sZSA9PT0gJ3BhbGV0dGUnICkge1xyXG5cdFx0XHRcdFNvcnRhYmxlLmNyZWF0ZSggY29udGFpbmVyLCB7XHJcblx0XHRcdFx0XHQuLi5jb21tb24sXHJcblx0XHRcdFx0XHRncm91cCAgIDogeyBuYW1lOiB0aGlzLm9wdHMuZ3JvdXBOYW1lLCBwdWxsOiAnY2xvbmUnLCBwdXQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHRzb3J0ICAgIDogZmFsc2VcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0dGhpcy5fY29udGFpbmVycy5hZGQoIGNvbnRhaW5lciApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gcm9sZSA9PT0gJ2NhbnZhcycuXHJcblx0XHRcdFNvcnRhYmxlLmNyZWF0ZSggY29udGFpbmVyLCB7XHJcblx0XHRcdFx0Li4uY29tbW9uLFxyXG5cdFx0XHRcdGdyb3VwICAgIDoge1xyXG5cdFx0XHRcdFx0bmFtZTogdGhpcy5vcHRzLmdyb3VwTmFtZSxcclxuXHRcdFx0XHRcdHB1bGw6IHRydWUsXHJcblx0XHRcdFx0XHRwdXQgOiAodG8sIGZyb20sIGRyYWdnZWRFbCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gZHJhZ2dlZEVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSB8fFxyXG5cdFx0XHRcdFx0XHRcdCAgIGRyYWdnZWRFbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0gRG5EIEhhbmRsZXJzIC0tLS0tLS0tLS0tLS0tICAgICAgICAgICAgICAgIC8vIEdyYWIgYW55d2hlcmUgb24gZmllbGRzIHRoYXQgb3B0LWluIHdpdGggdGhlIGNsYXNzIG9yIGF0dHJpYnV0ZS4gIC0gU2VjdGlvbnMgc3RpbGwgcmVxdWlyZSB0aGVpciBkZWRpY2F0ZWQgaGFuZGxlLlxyXG5cdFx0XHRcdGhhbmRsZSAgIDogJy5zZWN0aW9uLWRyYWctaGFuZGxlLCAud3BiY19iZmJfX2RyYWctaGFuZGxlLCAud3BiY19iZmJfX2RyYWctYW55d2hlcmUsIFtkYXRhLWRyYWdnYWJsZT1cInRydWVcIl0nLFxyXG5cdFx0XHRcdGRyYWdnYWJsZTogJy53cGJjX2JmYl9fZmllbGQ6bm90KFtkYXRhLWRyYWdnYWJsZT1cImZhbHNlXCJdKSwgLndwYmNfYmZiX19zZWN0aW9uJywgICAgICAgICAgICAgICAgICAgICAgICAvLyBQZXItZmllbGQgb3B0LW91dCB3aXRoIFtkYXRhLWRyYWdnYWJsZT1cImZhbHNlXCJdIChlLmcuLCB3aGlsZSBlZGl0aW5nKS5cclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tIEZpbHRlcnMgLSBObyBEbkQgLS0tLS0tLS0tLSAgICAgICAgICAgICAgICAvLyBEZWNsYXJhdGl2ZSDigJxuby1kcmFnIHpvbmVz4oCdOiBhbnl0aGluZyBpbnNpZGUgdGhlc2Ugd3JhcHBlcnMgd29u4oCZdCBzdGFydCBhIGRyYWcuXHJcblx0XHRcdFx0ZmlsdGVyOiBbXHJcblx0XHRcdFx0XHQnLndwYmNfYmZiX19uby1kcmFnLXpvbmUnLFxyXG5cdFx0XHRcdFx0Jy53cGJjX2JmYl9fbm8tZHJhZy16b25lIConLFxyXG5cdFx0XHRcdFx0Jy53cGJjX2JmYl9fY29sdW1uLXJlc2l6ZXInLCAgLy8gSWdub3JlIHRoZSByZXNpemVyIHJhaWxzIGR1cmluZyBEbkQgKHByZXZlbnRzIGVkZ2Ug4oCcc25hcOKAnSkuXHJcblx0XHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJbiB0aGUgb3ZlcmxheSB0b29sYmFyLCBibG9jayBldmVyeXRoaW5nIEVYQ0VQVCB0aGUgZHJhZyBoYW5kbGUgKGFuZCBpdHMgaWNvbikuXHJcblx0XHRcdFx0XHQnLndwYmNfYmZiX19vdmVybGF5LWNvbnRyb2xzICo6bm90KC53cGJjX2JmYl9fZHJhZy1oYW5kbGUpOm5vdCguc2VjdGlvbi1kcmFnLWhhbmRsZSk6bm90KC53cGJjX2ljbl9kcmFnX2luZGljYXRvciknXHJcblx0XHRcdFx0XS5qb2luKCAnLCcgKSxcclxuXHRcdFx0XHRwcmV2ZW50T25GaWx0ZXIgIDogZmFsc2UsXHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tIGFudGktaml0dGVyIHR1bmluZyAtLS0tLS0tLS0tXHJcblx0XHRcdFx0ZGlyZWN0aW9uICAgICAgICAgICAgOiAndmVydGljYWwnLCAgICAgICAgICAgLy8gY29sdW1ucyBhcmUgdmVydGljYWwgbGlzdHMuXHJcblx0XHRcdFx0aW52ZXJ0U3dhcCAgICAgICAgICAgOiB0cnVlLCAgICAgICAgICAgICAgICAgLy8gdXNlIHN3YXAgb24gaW52ZXJ0ZWQgb3ZlcmxhcC5cclxuXHRcdFx0XHRzd2FwVGhyZXNob2xkICAgICAgICA6IDAuNjUsICAgICAgICAgICAgICAgICAvLyBiZSBsZXNzIGVhZ2VyIHRvIHN3YXAuXHJcblx0XHRcdFx0aW52ZXJ0ZWRTd2FwVGhyZXNob2xkOiAwLjg1LCAgICAgICAgICAgICAgICAgLy8gcmVxdWlyZSBkZWVwZXIgb3ZlcmxhcCB3aGVuIGludmVydGVkLlxyXG5cdFx0XHRcdGVtcHR5SW5zZXJ0VGhyZXNob2xkIDogMjQsICAgICAgICAgICAgICAgICAgIC8vIGRvbuKAmXQganVtcCBpbnRvIGVtcHR5IGNvbnRhaW5lcnMgdG9vIGVhcmx5LlxyXG5cdFx0XHRcdGRyYWdvdmVyQnViYmxlICAgICAgIDogZmFsc2UsICAgICAgICAgICAgICAgIC8vIGtlZXAgZHJhZ292ZXIgbG9jYWwuXHJcblx0XHRcdFx0ZmFsbGJhY2tPbkJvZHkgICAgICAgOiB0cnVlLCAgICAgICAgICAgICAgICAgLy8gbW9yZSBzdGFibGUgcG9zaXRpb25pbmcuXHJcblx0XHRcdFx0ZmFsbGJhY2tUb2xlcmFuY2UgICAgOiA2LCAgICAgICAgICAgICAgICAgICAgLy8gUmVkdWNlIG1pY3JvLW1vdmVzIHdoZW4gdGhlIG1vdXNlIHNoYWtlcyBhIGJpdCAoZXNwLiBvbiB0b3VjaHBhZHMpLlxyXG5cdFx0XHRcdHNjcm9sbCAgICAgICAgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRzY3JvbGxTZW5zaXRpdml0eSAgICA6IDQwLFxyXG5cdFx0XHRcdHNjcm9sbFNwZWVkICAgICAgICAgIDogMTAsXHJcblx0XHRcdFx0LyoqXHJcblx0XHRcdFx0ICogRW50ZXIvbGVhdmUgaHlzdGVyZXNpcyBmb3IgY3Jvc3MtY29sdW1uIG1vdmVzLiAgICBPbmx5IGFsbG93IGRyb3BwaW5nIGludG8gYHRvYCB3aGVuIHRoZSBwb2ludGVyIGlzIHdlbGwgaW5zaWRlIGl0LlxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdG9uTW92ZTogKGV2dCwgb3JpZ2luYWxFdmVudCkgPT4ge1xyXG5cdFx0XHRcdFx0Y29uc3QgeyB0bywgZnJvbSB9ID0gZXZ0O1xyXG5cdFx0XHRcdFx0aWYgKCAhdG8gfHwgIWZyb20gKSByZXR1cm4gdHJ1ZTtcclxuXHJcblx0XHRcdFx0XHQvLyBPbmx5IGdhdGUgY29sdW1ucyAobm90IHBhZ2UgY29udGFpbmVycyksIGFuZCBvbmx5IGZvciBjcm9zcy1jb2x1bW4gbW92ZXMgaW4gdGhlIHNhbWUgcm93XHJcblx0XHRcdFx0XHRjb25zdCBpc0NvbHVtbiA9IHRvLmNsYXNzTGlzdD8uY29udGFpbnMoICd3cGJjX2JmYl9fY29sdW1uJyApO1xyXG5cdFx0XHRcdFx0aWYgKCAhaXNDb2x1bW4gKSByZXR1cm4gdHJ1ZTtcclxuXHJcblx0XHRcdFx0XHRjb25zdCBmcm9tUm93ID0gZnJvbS5jbG9zZXN0KCAnLndwYmNfYmZiX19yb3cnICk7XHJcblx0XHRcdFx0XHRjb25zdCB0b1JvdyAgID0gdG8uY2xvc2VzdCggJy53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRcdFx0aWYgKCBmcm9tUm93ICYmIHRvUm93ICYmIGZyb21Sb3cgIT09IHRvUm93ICkgcmV0dXJuIHRydWU7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgcmVjdCA9IHRvLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0XHRcdFx0Y29uc3QgZXZ0WCA9IChvcmlnaW5hbEV2ZW50LnRvdWNoZXM/LlswXT8uY2xpZW50WCkgPz8gb3JpZ2luYWxFdmVudC5jbGllbnRYO1xyXG5cdFx0XHRcdFx0Y29uc3QgZXZ0WSA9IChvcmlnaW5hbEV2ZW50LnRvdWNoZXM/LlswXT8uY2xpZW50WSkgPz8gb3JpZ2luYWxFdmVudC5jbGllbnRZO1xyXG5cclxuXHRcdFx0XHRcdC8vIC0tLSBFZGdlIGZlbmNlIChsaWtlIHlvdSBoYWQpLCBidXQgY2xhbXBlZCBmb3IgdGlueSBjb2x1bW5zXHJcblx0XHRcdFx0XHRjb25zdCBwYWRkaW5nWCA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuY2xhbXAoIHJlY3Qud2lkdGggKiAwLjIwLCAxMiwgMzYgKTtcclxuXHRcdFx0XHRcdGNvbnN0IHBhZGRpbmdZID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5jbGFtcCggcmVjdC5oZWlnaHQgKiAwLjEwLCA2LCAxNiApO1xyXG5cclxuXHRcdFx0XHRcdC8vIExvb3NlciBZIGlmIHRoZSBjb2x1bW4gaXMgdmlzdWFsbHkgdGlueS9lbXB0eVxyXG5cdFx0XHRcdFx0Y29uc3QgaXNWaXN1YWxseUVtcHR5ID0gdG8uY2hpbGRFbGVtZW50Q291bnQgPT09IDAgfHwgcmVjdC5oZWlnaHQgPCA2NDtcclxuXHRcdFx0XHRcdGNvbnN0IGlubmVyVG9wICAgICAgICA9IHJlY3QudG9wICsgKGlzVmlzdWFsbHlFbXB0eSA/IDQgOiBwYWRkaW5nWSk7XHJcblx0XHRcdFx0XHRjb25zdCBpbm5lckJvdHRvbSAgICAgPSByZWN0LmJvdHRvbSAtIChpc1Zpc3VhbGx5RW1wdHkgPyA0IDogcGFkZGluZ1kpO1xyXG5cdFx0XHRcdFx0Y29uc3QgaW5uZXJMZWZ0ICAgICAgID0gcmVjdC5sZWZ0ICsgcGFkZGluZ1g7XHJcblx0XHRcdFx0XHRjb25zdCBpbm5lclJpZ2h0ICAgICAgPSByZWN0LnJpZ2h0IC0gcGFkZGluZ1g7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgaW5zaWRlWCA9IGV2dFggPiBpbm5lckxlZnQgJiYgZXZ0WCA8IGlubmVyUmlnaHQ7XHJcblx0XHRcdFx0XHRjb25zdCBpbnNpZGVZID0gZXZ0WSA+IGlubmVyVG9wICYmIGV2dFkgPCBpbm5lckJvdHRvbTtcclxuXHRcdFx0XHRcdGlmICggIShpbnNpZGVYICYmIGluc2lkZVkpICkgcmV0dXJuIGZhbHNlOyAgIC8vIHN0YXkgaW4gY3VycmVudCBjb2x1bW4gdW50aWwgd2VsbCBpbnNpZGUgbmV3IG9uZVxyXG5cclxuXHRcdFx0XHRcdC8vIC0tLSBTdGlja3kgdGFyZ2V0IGNvbW1pdCBkaXN0YW5jZTogb25seSBzd2l0Y2ggaWYgd2XigJlyZSBjbGVhcmx5IGluc2lkZSB0aGUgbmV3IGNvbHVtblxyXG5cdFx0XHRcdFx0Y29uc3QgZHMgPSB0aGlzLl9kcmFnU3RhdGU7XHJcblx0XHRcdFx0XHRpZiAoIGRzICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIGRzLnN0aWNreVRvICYmIGRzLnN0aWNreVRvICE9PSB0byApIHtcclxuXHRcdFx0XHRcdFx0XHQvLyByZXF1aXJlIGEgZGVlcGVyIHBlbmV0cmF0aW9uIHRvIHN3aXRjaCBjb2x1bW5zXHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29tbWl0WCA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuY2xhbXAoIHJlY3Qud2lkdGggKiAwLjI1LCAxOCwgNDAgKTsgICAvLyAyNSUgb3IgMTjigJM0MHB4XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29tbWl0WSA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuY2xhbXAoIHJlY3QuaGVpZ2h0ICogMC4xNSwgMTAsIDI4ICk7ICAvLyAxNSUgb3IgMTDigJMyOHB4XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGRlZXBJbnNpZGUgPVxyXG5cdFx0XHRcdFx0XHRcdFx0XHQgIChldnRYID4gcmVjdC5sZWZ0ICsgY29tbWl0WCAmJiBldnRYIDwgcmVjdC5yaWdodCAtIGNvbW1pdFgpICYmXHJcblx0XHRcdFx0XHRcdFx0XHRcdCAgKGV2dFkgPiByZWN0LnRvcCArIGNvbW1pdFkgJiYgZXZ0WSA8IHJlY3QuYm90dG9tIC0gY29tbWl0WSk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGlmICggIWRlZXBJbnNpZGUgKSByZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0Ly8gV2UgYWNjZXB0IHRoZSBuZXcgdGFyZ2V0IG5vdy5cclxuXHRcdFx0XHRcdFx0ZHMuc3RpY2t5VG8gICAgID0gdG87XHJcblx0XHRcdFx0XHRcdGRzLmxhc3RTd2l0Y2hUcyA9IHBlcmZvcm1hbmNlLm5vdygpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0b25TdGFydDogKGV2dCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5idWlsZGVyLl9hZGRfZHJhZ2dpbmdfY2xhc3MoKTtcclxuXHRcdFx0XHRcdC8vIE1hdGNoIHRoZSBmbGFncyB3ZSBzZXQgaW4gY29tbW9uIHNvIENTUyBzdGF5cyBjb25zaXN0ZW50IG9uIGNhbnZhcyBkcmFncyB0b28uXHJcblx0XHRcdFx0XHRjb25zdCBmcm9tUGFsZXR0ZSA9IHRoaXMuYnVpbGRlcj8ucGFsZXR0ZV91bHM/LmluY2x1ZGVzPy4oIGV2dC5mcm9tICk7XHJcblx0XHRcdFx0XHR0aGlzLl90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MoIHRydWUsIGZyb21QYWxldHRlICk7ICAgICAgICAgIC8vIHNldCB0byByb290IEhUTUwgZG9jdW1lbnQ6IGh0bWwud3BiY19iZmJfX2RuZC1hY3RpdmUud3BiY19iZmJfX2RyYWctZnJvbS1wYWxldHRlIC5cclxuXHRcdFx0XHRcdHRoaXMuX3RhZ19kcmFnX21pcnJvciggZXZ0ICk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUYWcgdGhlIG1pcnJvciB1bmRlciBjdXJzb3IuXHJcblx0XHRcdFx0XHR0aGlzLl9kcmFnU3RhdGUgPSB7IHN0aWNreVRvOiBudWxsLCBsYXN0U3dpdGNoVHM6IDAgfTsgICAgLy8gcGVyLWRyYWcgc3RhdGUuXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHRvbkVuZCAgOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7IHRoaXMuYnVpbGRlci5fcmVtb3ZlX2RyYWdnaW5nX2NsYXNzKCk7IH0sIDUwICk7XHJcblx0XHRcdFx0XHR0aGlzLl90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MoIGZhbHNlICk7ICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdG8gcm9vdCBIVE1MIGRvY3VtZW50IHdpdGhvdXQgdGhlc2UgY2xhc3NlczogaHRtbC53cGJjX2JmYl9fZG5kLWFjdGl2ZS53cGJjX2JmYl9fZHJhZy1mcm9tLXBhbGV0dGUgLlxyXG5cdFx0XHRcdFx0dGhpcy5fZHJhZ1N0YXRlID0gbnVsbDtcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRvbkFkZDogaGFuZGxlcnMub25BZGQgfHwgdGhpcy5idWlsZGVyLmhhbmRsZV9vbl9hZGQuYmluZCggdGhpcy5idWlsZGVyIClcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dGhpcy5fY29udGFpbmVycy5hZGQoIGNvbnRhaW5lciApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGVzdHJveSBhbGwgU29ydGFibGUgaW5zdGFuY2VzIGNyZWF0ZWQgYnkgdGhpcyBtYW5hZ2VyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRkZXN0cm95QWxsKCkge1xyXG5cdFx0XHR0aGlzLl9jb250YWluZXJzLmZvckVhY2goICggZWwgKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgaW5zdCA9IFNvcnRhYmxlLmdldD8uKCBlbCApO1xyXG5cdFx0XHRcdGlmICggaW5zdCApIHtcclxuXHRcdFx0XHRcdGluc3QuZGVzdHJveSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0XHR0aGlzLl9jb250YWluZXJzLmNsZWFyKCk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU21hbGwgRE9NIGNvbnRyYWN0IGFuZCByZW5kZXJlciBoZWxwZXJcclxuXHQgKlxyXG5cdCAqIEB0eXBlIHtSZWFkb25seTx7XHJcblx0ICogICAgICAgICAgICAgICAgICBTRUxFQ1RPUlM6IHtwYWdlUGFuZWw6IHN0cmluZywgZmllbGQ6IHN0cmluZywgdmFsaWRGaWVsZDogc3RyaW5nLCBzZWN0aW9uOiBzdHJpbmcsIGNvbHVtbjogc3RyaW5nLCByb3c6IHN0cmluZywgb3ZlcmxheTogc3RyaW5nfSxcclxuXHQgKiAgICAgICAgICAgICAgICAgIENMQVNTRVM6IHtzZWxlY3RlZDogc3RyaW5nfSxcclxuXHQgKiAgICAgICAgXHQgICAgICAgIEFUVFI6IHtpZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGh0bWxJZDogc3RyaW5nLCB1c2FnZUtleTogc3RyaW5nLCB1aWQ6IHN0cmluZ319XHJcblx0ICogICAgICAgID59XHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9ET00gPSBPYmplY3QuZnJlZXplKCB7XHJcblx0XHRTRUxFQ1RPUlM6IHtcclxuXHRcdFx0cGFnZVBhbmVsIDogJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnLFxyXG5cdFx0XHRmaWVsZCAgICAgOiAnLndwYmNfYmZiX19maWVsZCcsXHJcblx0XHRcdHZhbGlkRmllbGQ6ICcud3BiY19iZmJfX2ZpZWxkOm5vdCguaXMtaW52YWxpZCknLFxyXG5cdFx0XHRzZWN0aW9uICAgOiAnLndwYmNfYmZiX19zZWN0aW9uJyxcclxuXHRcdFx0Y29sdW1uICAgIDogJy53cGJjX2JmYl9fY29sdW1uJyxcclxuXHRcdFx0cm93ICAgICAgIDogJy53cGJjX2JmYl9fcm93JyxcclxuXHRcdFx0b3ZlcmxheSAgIDogJy53cGJjX2JmYl9fb3ZlcmxheS1jb250cm9scydcclxuXHRcdH0sXHJcblx0XHRDTEFTU0VTICA6IHtcclxuXHRcdFx0c2VsZWN0ZWQ6ICdpcy1zZWxlY3RlZCdcclxuXHRcdH0sXHJcblx0XHRBVFRSICAgICA6IHtcclxuXHRcdFx0aWQgICAgICA6ICdkYXRhLWlkJyxcclxuXHRcdFx0bmFtZSAgICA6ICdkYXRhLW5hbWUnLFxyXG5cdFx0XHRodG1sSWQgIDogJ2RhdGEtaHRtbF9pZCcsXHJcblx0XHRcdHVzYWdlS2V5OiAnZGF0YS11c2FnZV9rZXknLFxyXG5cdFx0XHR1aWQgICAgIDogJ2RhdGEtdWlkJ1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0Q29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIgPSBjbGFzcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYW4gSFRNTCBlbGVtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0YWcgLSBIVE1MIHRhZyBuYW1lLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtjbGFzc19uYW1lPScnXSAtIE9wdGlvbmFsIENTUyBjbGFzcyBuYW1lLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtpbm5lcl9odG1sPScnXSAtIE9wdGlvbmFsIGlubmVySFRNTC5cclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gQ3JlYXRlZCBlbGVtZW50LlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgY3JlYXRlX2VsZW1lbnQoIHRhZywgY2xhc3NfbmFtZSA9ICcnLCBpbm5lcl9odG1sID0gJycgKSB7XHJcblx0XHRcdGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggdGFnICk7XHJcblx0XHRcdGlmICggY2xhc3NfbmFtZSApIHtcclxuXHRcdFx0XHRlbC5jbGFzc05hbWUgPSBjbGFzc19uYW1lO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaW5uZXJfaHRtbCApIHtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSBpbm5lcl9odG1sO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBlbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNldCBtdWx0aXBsZSBgZGF0YS0qYCBhdHRyaWJ1dGVzIG9uIGEgZ2l2ZW4gZWxlbWVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCAtIFRhcmdldCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGFfb2JqIC0gS2V5LXZhbHVlIHBhaXJzIGZvciBkYXRhIGF0dHJpYnV0ZXMuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNldF9kYXRhX2F0dHJpYnV0ZXMoIGVsLCBkYXRhX29iaiApIHtcclxuXHRcdFx0T2JqZWN0LmVudHJpZXMoIGRhdGFfb2JqICkuZm9yRWFjaCggKCBbIGtleSwgdmFsIF0gKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSAodHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpID8gSlNPTi5zdHJpbmdpZnkoIHZhbCApIDogdmFsO1xyXG5cdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtJyArIGtleSwgdmFsdWUgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGFsbCBgZGF0YS0qYCBhdHRyaWJ1dGVzIGZyb20gYW4gZWxlbWVudCBhbmQgcGFyc2UgSlNPTiB3aGVyZSBwb3NzaWJsZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCAtIEVsZW1lbnQgdG8gZXh0cmFjdCBkYXRhIGZyb20uXHJcblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fSBQYXJzZWQga2V5LXZhbHVlIG1hcCBvZiBkYXRhIGF0dHJpYnV0ZXMuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBnZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggZWwgKSB7XHJcblx0XHRcdGNvbnN0IGRhdGEgPSB7fTtcclxuXHJcblx0XHRcdGlmICggISBlbCB8fCAhIGVsLmF0dHJpYnV0ZXMgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGRhdGE7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdEFycmF5LmZyb20oIGVsLmF0dHJpYnV0ZXMgKS5mb3JFYWNoKFxyXG5cdFx0XHRcdCggYXR0ciApID0+IHtcclxuXHRcdFx0XHRcdGlmICggYXR0ci5uYW1lLnN0YXJ0c1dpdGgoICdkYXRhLScgKSApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3Qga2V5ID0gYXR0ci5uYW1lLnJlcGxhY2UoIC9eZGF0YS0vLCAnJyApO1xyXG5cdFx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRcdGRhdGFba2V5XSA9IEpTT04ucGFyc2UoIGF0dHIudmFsdWUgKTtcclxuXHRcdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHRcdFx0ZGF0YVtrZXldID0gYXR0ci52YWx1ZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdC8vIE9ubHkgZGVmYXVsdCB0aGUgbGFiZWwgaWYgaXQncyB0cnVseSBhYnNlbnQgKHVuZGVmaW5lZC9udWxsKSwgbm90IHdoZW4gaXQncyBhbiBlbXB0eSBzdHJpbmcuXHJcblx0XHRcdGNvbnN0IGhhc0V4cGxpY2l0TGFiZWwgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGRhdGEsICdsYWJlbCcgKTtcclxuXHRcdFx0aWYgKCAhIGhhc0V4cGxpY2l0TGFiZWwgJiYgZGF0YS5pZCApIHtcclxuXHRcdFx0XHRkYXRhLmxhYmVsID0gZGF0YS5pZC5jaGFyQXQoIDAgKS50b1VwcGVyQ2FzZSgpICsgZGF0YS5pZC5zbGljZSggMSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gZGF0YTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciBhIHNpbXBsZSBsYWJlbCArIHR5cGUgcHJldmlldyAodXNlZCBmb3IgdW5rbm93biBvciBmYWxsYmFjayBmaWVsZHMpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZF9kYXRhIC0gRmllbGQgZGF0YSBvYmplY3QuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBIVE1MIGNvbnRlbnQuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXJfZmllbGRfaW5uZXJfaHRtbCggZmllbGRfZGF0YSApIHtcclxuXHRcdFx0Ly8gTWFrZSB0aGUgZmFsbGJhY2sgcHJldmlldyByZXNwZWN0IGFuIGVtcHR5IGxhYmVsLlxyXG5cdFx0XHRjb25zdCBoYXNMYWJlbCA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZmllbGRfZGF0YSwgJ2xhYmVsJyApO1xyXG5cdFx0XHRjb25zdCBsYWJlbCAgICA9IGhhc0xhYmVsID8gU3RyaW5nKCBmaWVsZF9kYXRhLmxhYmVsICkgOiBTdHJpbmcoIGZpZWxkX2RhdGEuaWQgfHwgJyhubyBsYWJlbCknICk7XHJcblxyXG5cdFx0XHRjb25zdCB0eXBlICAgICAgICA9IFN0cmluZyggZmllbGRfZGF0YS50eXBlIHx8ICd1bmtub3duJyApO1xyXG5cdFx0XHRjb25zdCBpc19yZXF1aXJlZCA9IGZpZWxkX2RhdGEucmVxdWlyZWQgPT09IHRydWUgfHwgZmllbGRfZGF0YS5yZXF1aXJlZCA9PT0gJ3RydWUnIHx8IGZpZWxkX2RhdGEucmVxdWlyZWQgPT09IDEgfHwgZmllbGRfZGF0YS5yZXF1aXJlZCA9PT0gJzEnO1xyXG5cclxuXHRcdFx0Y29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblxyXG5cdFx0XHRjb25zdCBzcGFuTGFiZWwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcclxuXHRcdFx0c3BhbkxhYmVsLmNsYXNzTmFtZSAgID0gJ3dwYmNfYmZiX19maWVsZC1sYWJlbCc7XHJcblx0XHRcdHNwYW5MYWJlbC50ZXh0Q29udGVudCA9IGxhYmVsICsgKGlzX3JlcXVpcmVkID8gJyAqJyA6ICcnKTtcclxuXHRcdFx0d3JhcHBlci5hcHBlbmRDaGlsZCggc3BhbkxhYmVsICk7XHJcblxyXG5cdFx0XHRjb25zdCBzcGFuVHlwZSAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xyXG5cdFx0XHRzcGFuVHlwZS5jbGFzc05hbWUgICA9ICd3cGJjX2JmYl9fZmllbGQtdHlwZSc7XHJcblx0XHRcdHNwYW5UeXBlLnRleHRDb250ZW50ID0gdHlwZTtcclxuXHRcdFx0d3JhcHBlci5hcHBlbmRDaGlsZCggc3BhblR5cGUgKTtcclxuXHJcblx0XHRcdHJldHVybiB3cmFwcGVyLmlubmVySFRNTDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERlYm91bmNlIGEgZnVuY3Rpb24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gLSBGdW5jdGlvbiB0byBkZWJvdW5jZS5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSB3YWl0IC0gRGVsYXkgaW4gbXMuXHJcblx0XHQgKiBAcmV0dXJucyB7RnVuY3Rpb259IERlYm91bmNlZCBmdW5jdGlvbi5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGRlYm91bmNlKCBmbiwgd2FpdCA9IDEyMCApIHtcclxuXHRcdFx0bGV0IHQgPSBudWxsO1xyXG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24gZGVib3VuY2VkKCAuLi5hcmdzICkge1xyXG5cdFx0XHRcdGlmICggdCApIHtcclxuXHRcdFx0XHRcdGNsZWFyVGltZW91dCggdCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0ID0gc2V0VGltZW91dCggKCkgPT4gZm4uYXBwbHkoIHRoaXMsIGFyZ3MgKSwgd2FpdCApO1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHQvLyBSZW5kZXJlciByZWdpc3RyeS4gQWxsb3dzIGxhdGUgcmVnaXN0cmF0aW9uIGFuZCBhdm9pZHMgdGlnaHQgY291cGxpbmcgdG8gYSBnbG9iYWwgbWFwLlxyXG5cdENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkgPSAoZnVuY3Rpb24gKCkge1xyXG5cdFx0Y29uc3QgbWFwID0gbmV3IE1hcCgpO1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0cmVnaXN0ZXIoIHR5cGUsIENsYXNzUmVmICkge1xyXG5cdFx0XHRcdG1hcC5zZXQoIFN0cmluZyggdHlwZSApLCBDbGFzc1JlZiApO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRnZXQoIHR5cGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG1hcC5nZXQoIFN0cmluZyggdHlwZSApICk7XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblx0fSkoKTtcclxuXHJcbn0gKSgg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
