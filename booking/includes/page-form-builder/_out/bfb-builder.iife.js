"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/bfb-builder.iife.js == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
  'use strict';

  const {
    WPBC_BFB_Sanitize,
    WPBC_BFB_IdService,
    WPBC_BFB_LayoutService,
    WPBC_BFB_UsageLimitService,
    WPBC_BFB_Events,
    WPBC_BFB_EventBus,
    WPBC_BFB_SortableManager,
    WPBC_BFB_DOM,
    WPBC_Form_Builder_Helper,
    WPBC_BFB_Field_Renderer_Registry
  } = w.WPBC_BFB_Core;
  const {
    WPBC_BFB_Module,
    WPBC_BFB_Overlay,
    WPBC_BFB_Layout_Chips,
    WPBC_BFB_Selection_Controller,
    WPBC_BFB_Inspector_Bridge,
    WPBC_BFB_Keyboard_Controller,
    WPBC_BFB_Resize_Controller,
    WPBC_BFB_Pages_Sections,
    WPBC_BFB_Structure_IO,
    WPBC_BFB_Min_Width_Guard
  } = w.WPBC_BFB_UI;
  class WPBC_Form_Builder {
    /**
     * Constructor for Booking Form Builder class.
     * Initializes UI elements, SortableJS, and event listeners.
     */
    constructor(opts = {}) {
      // Allow DI/overrides via opts while keeping defaults.
      // Back-compat: accept either a single UL via opts.palette_ul or an array via opts.palette_uls.
      const providedPalettes = Array.isArray(opts.palette_uls) ? opts.palette_uls : opts.palette_ul ? [opts.palette_ul] : [];
      this.palette_uls = providedPalettes.length ? providedPalettes : Array.from(document.querySelectorAll('.wpbc_bfb__panel_field_types__ul'));
      this.pages_container = opts.pages_container || document.getElementById('wpbc_bfb__pages_container');
      if (!this.pages_container) {
        throw new Error('WPBC: pages container not found.');
      }
      this.page_counter = 0;
      this.section_counter = 0;
      this.max_nested_value = Number.isFinite(+opts.max_nested_value) ? +opts.max_nested_value : 5;
      this.preview_mode = opts.preview_mode !== undefined ? !!opts.preview_mode : true;
      this.col_gap_percent = Number.isFinite(+opts.col_gap_percent) ? +opts.col_gap_percent : 3; // % gap between columns for layout math.
      this._uid_counter = 0;

      // Service instances.
      this.id = new WPBC_BFB_IdService(this.pages_container);
      this.layout = new WPBC_BFB_LayoutService({
        col_gap_percent: this.col_gap_percent
      });
      this.usage = new WPBC_BFB_UsageLimitService(this.pages_container, this.palette_uls);
      this.bus = new WPBC_BFB_EventBus(this.pages_container);
      this._handlers = [];
      this.sortable = new WPBC_BFB_SortableManager(this);
      this._modules = []; /** @type {Array<WPBC_BFB_Module>} */

      // Register modules.
      this.use_module(WPBC_BFB_Selection_Controller);
      this.use_module(WPBC_BFB_Inspector_Bridge);
      this.use_module(WPBC_BFB_Resize_Controller);
      this.use_module(WPBC_BFB_Pages_Sections);
      this.use_module(WPBC_BFB_Structure_IO);
      this.use_module(WPBC_BFB_Keyboard_Controller);
      this.use_module(WPBC_BFB_Min_Width_Guard);
      this._init();
      this._bind_events();
    }

    /**
     * Emit a namespaced builder event via the EventBus.
     *
     * @param {string} type - Event type (use WPBC_BFB_Events when possible).
     * @param {Object} [detail={}] - Payload object.
     * @returns {void}
     */
    _emit_const(type, detail = {}) {
      this.bus.emit(type, detail);
    }

    /**
     * Find a neighbor element that can be selected after removing a node.
     *
     * @param {HTMLElement} el - The element that is being removed.
     * @returns {HTMLElement|null} Neighbor or null.
     */
    _find_neighbor_selectable(el) {
      if (!el || !el.parentElement) {
        return null;
      }
      const all = Array.from(el.parentElement.children).filter(n => n.classList?.contains('wpbc_bfb__field') || n.classList?.contains('wpbc_bfb__section'));
      const i = all.indexOf(el);
      if (i > 0) {
        return all[i - 1];
      }
      if (i >= 0 && i + 1 < all.length) {
        return all[i + 1];
      }

      // Fallback: any other selectable on the current page, but NEVER inside `el` itself.
      const page = el.closest('.wpbc_bfb__panel--preview');
      if (page) {
        // Prefer sections/fields that are siblings elsewhere on the page.
        const candidate = page.querySelector('.wpbc_bfb__section, .wpbc_bfb__field');
        if (candidate && !el.contains(candidate)) {
          return candidate;
        }
      }
      return null;
    }

    /**
     * Initialize SortableJS on the field palette and load initial form structure.
     *
     * @returns {void}
     */
    _init() {
      const sortableReady = typeof Sortable !== 'undefined';
      if (!sortableReady) {
        console.error('SortableJS is not loaded (drag & drop disabled).');
      }

      // === Init Sortable on the Field Palette. ===
      if (!this.palette_uls.length) {
        console.warn('WPBC: No field palettes found (.wpbc_bfb__panel_field_types__ul).');
      } else if (typeof Sortable === 'undefined') {
        console.warn('WPBC: SortableJS not loaded (palette drag disabled).');
      } else {
        this.palette_uls.forEach(ul => this.sortable.ensure(ul, 'palette'));
      }

      // Load saved structure or create default page.
      const saved_structure = wpbc_bfb__form_structure__get_example(); // External fallback.

      const waitForRenderers = () => new Promise(resolve => {
        const hasRegistry = !!(w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Field_Renderer_Registry && typeof w.WPBC_BFB_Core.WPBC_BFB_Field_Renderer_Registry.get === 'function');
        if (hasRegistry) {
          return resolve();
        }
        const started = Date.now();
        const i = setInterval(() => {
          const ok = !!(w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Field_Renderer_Registry && typeof w.WPBC_BFB_Core.WPBC_BFB_Field_Renderer_Registry.get === 'function');
          const timedOut = Date.now() - started > 3000;
          if (ok || timedOut) {
            clearInterval(i);
            if (!ok) {
              console.warn('WPBC: Field renderers not found, using fallback preview.');
            }
            resolve();
          }
        }, 50);
      });
      const startLoad = () => waitForRenderers().then(() => setTimeout(() => this.load_saved_structure(saved_structure), 0));
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startLoad);
      } else {
        startLoad();
      }
      this._start_usage_observer();

      // this.add_page(); return;  // Standard initializing one page.
    }
    _getRenderer(type) {
      return w.WPBC_BFB_Core?.WPBC_BFB_Field_Renderer_Registry?.get?.(type);
    }

    /**
     * Observe DOM mutations that may change usage counts and refresh palette state.
     *
     * @returns {void}
     */
    _start_usage_observer() {
      if (this._usage_observer) {
        return;
      }
      const refresh = WPBC_Form_Builder_Helper.debounce(() => {
        try {
          this.usage.update_palette_ui();
          document.querySelectorAll('.wpbc_bfb__panel_field_types__ul').forEach(ul => {
            try {
              this._usage_observer.observe(ul, {
                childList: true,
                subtree: true
              });
            } catch (_) {}
          });
        } catch (e) {
          console.warn('Usage UI update failed.', e);
        }
      }, 100);
      const config = {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-usage_key']
      };
      this._usage_observer = new MutationObserver(refresh);
      this._usage_observer.observe(this.pages_container, config);

      // Observe all known palettes; also do a broad query on each refresh so late-added palettes are handled.
      (this.palette_uls || []).forEach(ul => {
        try {
          this._usage_observer.observe(ul, {
            childList: true,
            subtree: true
          });
        } catch (e) {}
      });

      // Initial sync.
      refresh();
    }

    /**
     * Add dragging visual feedback on all columns.
     *
     * @returns {void}
     */
    _add_dragging_class() {
      this.pages_container.querySelectorAll('.wpbc_bfb__column').forEach(col => col.classList.add('wpbc_bfb__dragging'));
    }

    /**
     * Remove dragging visual feedback on all columns.
     *
     * @returns {void}
     */
    _remove_dragging_class() {
      this.pages_container.querySelectorAll('.wpbc_bfb__column').forEach(col => col.classList.remove('wpbc_bfb__dragging'));
    }

    /**
     * Bind event handlers for save, add-page, and preview toggle buttons.
     *
     * @returns {void}
     */
    _bind_events() {
      // Save button click.
      const save_btn = document.getElementById('wpbc_bfb__save_btn');
      if (save_btn) {
        if (!save_btn.hasAttribute('type')) {
          save_btn.setAttribute('type', 'button');
        }
        this._on(save_btn, 'click', e => {
          e.preventDefault();
          const structure = this.get_structure();
          console.log(JSON.stringify(structure, null, 2)); // Developer aid.
          this._emit_const(WPBC_BFB_Events.STRUCTURE_CHANGE, {
            structure
          });
          this.load_saved_structure(structure, {
            deferIfTyping: false
          });
        });
      }

      // Toggle Preview click.
      const preview_toggle = document.getElementById('wpbc_bfb__toggle_preview');
      if (preview_toggle) {
        // initialize from current control state if it is a checkbox/switch.
        if ('checked' in preview_toggle) {
          this.preview_mode = 'checked' in preview_toggle ? !!preview_toggle.checked : this.preview_mode;
        }
        this._on(preview_toggle, 'change', () => {
          this.preview_mode = 'checked' in preview_toggle ? !!preview_toggle.checked : !this.preview_mode;
          // Rebuild DOM so fields/sections render according to the new mode.
          this.load_saved_structure(this.get_structure(), {
            deferIfTyping: true
          });
          // Some renderers rely on on_field_drop hooks to (re)wire themselves.
          this._reinit_all_fields('preview');
        });
      }

      // Keyboard handling moved to WPBC_BFB_Keyboard_Controller.

      // Add page button click.
      const add_page_btn = document.getElementById('wpbc_bfb__add_page_btn');
      if (add_page_btn) {
        this._on(add_page_btn, 'click', e => {
          e.preventDefault();
          this.add_page();
          this._announce?.('Page added.');
        });
      }

      // Prevent accidental drag while editing inputs.
      this._on(this.pages_container, 'focusin', e => {
        const f = e.target.closest('.wpbc_bfb__field');
        if (f) {
          f.setAttribute('data-draggable', 'false');
        }
      });
      this._on(this.pages_container, 'focusout', e => {
        const f = e.target.closest('.wpbc_bfb__field');
        if (f) {
          f.removeAttribute('data-draggable');
        }
      });
    }

    /**
     * Re-run field initializers for every field in the canvas.
     * Many renderers (e.g., Calendar) wire themselves inside on_field_drop().
     *
     * @param {"drop"|"load"|"preview"|"save"} context
     */
    _reinit_all_fields(context = 'preview') {
      this.pages_container.querySelectorAll('.wpbc_bfb__panel--preview .wpbc_bfb__field').forEach(field_el => this.trigger_field_drop_callback(field_el, context));
    }

    /**
     * Return only the column elements (skip resizers).
     *
     * @param {HTMLElement} row_el - Row element.
     * @returns {HTMLElement[]} Column elements.
     */
    _get_row_cols(row_el) {
      return Array.from(row_el.querySelectorAll(':scope > .wpbc_bfb__column'));
    }

    /**
     * Set field's INTERNAL id (data-id). Does not rebind inspector.
     *
     * @param {HTMLElement} field_el - Target field element.
     * @param {string} newIdRaw - New desired internal id.
     * @returns {string} Applied id.
     */
    _set_field_id(field_el, newIdRaw) {
      const unique = this.id.set_field_id(field_el, newIdRaw, /*renderPreview*/false);
      if (this.preview_mode) {
        this.render_preview(field_el);
      }
      return unique;
    }

    /**
     * Set field's REQUIRED HTML name (data-name).
     *
     * @param {HTMLElement} field_el - Target field element.
     * @param {string} newNameRaw - Desired HTML name.
     * @returns {string} Applied unique name.
     */
    _set_field_name(field_el, newNameRaw) {
      const unique = this.id.set_field_name(field_el, newNameRaw, /*renderPreview*/false);
      if (this.preview_mode) {
        this.render_preview(field_el);
      }
      return unique;
    }

    /**
     * Set field's OPTIONAL HTML id (data-html_id). Empty removes it. Ensures sanitization and uniqueness among other fields that declared HTML ids.
     *
     * @param {HTMLElement} field_el - Target field element.
     * @param {string} newHtmlIdRaw - Desired HTML id (optional).
     * @returns {string} Applied html_id or empty string.
     */
    _set_field_html_id(field_el, newHtmlIdRaw) {
      const applied = this.id.set_field_html_id(field_el, newHtmlIdRaw, /*renderPreview*/false);
      if (this.preview_mode) {
        this.render_preview(field_el);
      }
      return applied;
    }

    // == Accessibility ==

    /**
     * Lightweight ARIA-live announcer for accessibility/status messages.
     * Kept local to the builder so callers can safely use it.
     * @param {string} msg
     */
    _announce(msg) {
      try {
        let live = document.getElementById('wpbc_bfb__aria_live');
        if (!live) {
          live = document.createElement('div');
          live.id = 'wpbc_bfb__aria_live';
          live.setAttribute('aria-live', 'polite');
          live.setAttribute('aria-atomic', 'true');
          live.style.position = 'absolute';
          live.style.left = '-9999px';
          live.style.top = 'auto';
          document.body.appendChild(live);
        }
        live.textContent = '';
        setTimeout(() => {
          live.textContent = String(msg || '');
        }, 10);
      } catch (e) {
        // no-op: non-fatal UX helper.
      }
    }

    /**
     * Central place to register DOM listeners for later teardown.
     *
     * @private
     * @param {EventTarget} target - Target to bind on.
     * @param {string} type - Event type.
     * @param {EventListener} handler - Handler function.
     * @param {boolean|AddEventListenerOptions} [opts=false] - Listener options.
     * @returns {void}
     */
    _on(target, type, handler, opts = false) {
      if (!this._handlers) {
        this._handlers = [];
      }
      target.addEventListener(type, handler, opts);
      this._handlers.push({
        target,
        type,
        handler,
        opts
      });
    }

    // =============================================================================================================

    /**
     * Load a module and initialize it.
     *
     * @param {Function} Module_Class - Module class reference.
     * @param {Object} [options = {}] - Optional module options.
     * @returns {WPBC_BFB_Module}
     */
    use_module(Module_Class, options = {}) {
      const mod = new Module_Class(this, options);
      if (typeof mod.init === 'function') {
        mod.init();
      }
      this._modules.push(mod);
      return mod;
    }

    /**
     * Dispose all listeners, observers, and Sortable instances created by the builder.
     *
     * @returns {void}
     */
    destroy() {
      // Mutation observer.
      if (this._usage_observer) {
        try {
          this._usage_observer.disconnect();
        } catch (e) {
          // No-op.
        }
        this._usage_observer = null;
      }

      // Registered DOM listeners.
      if (Array.isArray(this._handlers)) {
        this._handlers.forEach(({
          target,
          type,
          handler,
          opts
        }) => {
          try {
            target.removeEventListener(type, handler, opts);
          } catch (e) {
            // No-op.
          }
        });
        this._handlers = [];
      }

      // Sortable instances.
      if (this.sortable && typeof this.sortable.destroyAll === 'function') {
        this.sortable.destroyAll();
      }

      // Destroy registered modules.
      if (Array.isArray(this._modules)) {
        for (const mod of this._modules) {
          try {
            if (typeof mod.destroy === 'function') {
              mod.destroy();
            }
          } catch (e) {}
        }
        this._modules = [];
      }

      // Live region can stay for the page lifetime; remove if you want full cleanup.
      // if ( this._aria_live && this._aria_live.parentNode ) {
      // 	this._aria_live.parentNode.removeChild( this._aria_live );
      // 	this._aria_live = null;
      // }

      // Clear globals to help GC.
      this.inspector = null;
      this.pages_container = null;
    }

    /**
     * Initialize SortableJS on a container for fields or sections.
     *
     * @param {HTMLElement} container - Target DOM element.
     * @param {Function} [on_add_callback] - Optional custom handler for onAdd.
     * @returns {void}
     */
    init_sortable(container, on_add_callback = this.handle_on_add.bind(this)) {
      if (!container) return;
      if (typeof Sortable === 'undefined') return;
      this.sortable.ensure(container, 'canvas', {
        onAdd: on_add_callback
      });
    }

    /**
     * Handler when an item is added via drag-and-drop.
     * Applies usage limits, nesting checks, and builds new field if needed.
     *
     * @param {Object} evt - SortableJS event object.
     * @returns {void}
     */
    handle_on_add(evt) {
      if (!evt || !evt.item || !evt.to) {
        return;
      }
      let el = evt.item;

      // --- Section path. ------------------------------------------------------
      if (el.classList.contains('wpbc_bfb__section')) {
        const nesting_level = this.get_nesting_level(el);
        if (nesting_level >= this.max_nested_value) {
          alert('Too many nested sections.');
          el.remove();
          return;
        }
        this.init_all_nested_sortables(el);
        this.usage.update_palette_ui();
        return;
      }

      // --- Field path. --------------------------------------------------------
      const is_from_palette = this.palette_uls?.includes?.(evt.from);
      const paletteId = el?.dataset?.id;
      if (!paletteId) {
        console.warn('Dropped element missing data-id.', el);
        return;
      }
      if (is_from_palette) {
        // Read data before removing the temporary clone.
        const field_data = WPBC_Form_Builder_Helper.get_all_data_attributes(el);
        const usage_key = paletteId;
        field_data.usage_key = usage_key;

        // Remove Sortable's temporary clone so counts are accurate.
        el.remove();

        // Centralized usage gate.
        if (!this.usage.gate_or_alert(usage_key, {
          label: field_data.label || usage_key
        })) {
          return;
        }

        // Build and insert the real field node at the intended index.
        const rebuilt = this.build_field(field_data);
        if (!rebuilt) {
          return;
        }
        const selector = Sortable.get(evt.to)?.options?.draggable || '.wpbc_bfb__field, .wpbc_bfb__section';
        const scopedSelector = selector.split(',').map(s => `:scope > ${s.trim()}`).join(', ');
        const draggables = Array.from(evt.to.querySelectorAll(scopedSelector));
        const before = Number.isInteger(evt.newIndex) ? draggables[evt.newIndex] ?? null : null;
        evt.to.insertBefore(rebuilt, before);
        el = rebuilt; // Continue with the unified path below.
      } else {
        // Moving an existing field within the canvas. No usage delta here.
      }

      // Finalize: decorate, emit, hook, and select.
      this.decorate_field(el);
      this._emit_const(WPBC_BFB_Events.FIELD_ADD, {
        el,
        data: WPBC_Form_Builder_Helper.get_all_data_attributes(el)
      });
      this.usage.update_palette_ui();
      this.trigger_field_drop_callback(el, 'drop');
      this.select_field(el, {
        scrollIntoView: true
      });
    }

    /**
     * Call static on_field_drop method for supported field types.
     *
     * @param {HTMLElement} field_el - Field element to handle.
     * @param {string} context - Context of the event: 'drop' | 'load' | 'preview'.
     * @returns {void}
     */
    trigger_field_drop_callback(field_el, context = 'drop') {
      if (!field_el || !field_el.classList.contains('wpbc_bfb__field')) {
        return;
      }
      const field_data = WPBC_Form_Builder_Helper.get_all_data_attributes(field_el);
      const type = field_data.type;
      try {
        const FieldClass = this._getRenderer(type);
        if (FieldClass && typeof FieldClass.on_field_drop === 'function') {
          FieldClass.on_field_drop(field_data, field_el, {
            context
          });
        }
      } catch (err) {
        console.warn(`on_field_drop failed for type "${type}".`, err);
      }
    }

    /**
     * Calculate nesting depth of a section based on parent hierarchy.
     *
     * @param {HTMLElement} section_el - Target section element.
     * @returns {number} Nesting depth (0 = top-level).
     */
    get_nesting_level(section_el) {
      let level = 0;
      let parent = section_el.closest('.wpbc_bfb__column');
      while (parent) {
        const outer = parent.closest('.wpbc_bfb__section');
        if (!outer) {
          break;
        }
        level++;
        parent = outer.closest('.wpbc_bfb__column');
      }
      return level;
    }

    /**
     * Create a field DOM element from structured data.
     * Applies label, type, drag handle, and visual mode.
     *
     * @param {Object} field_data - Field properties (id, type, label, etc.).
     * @returns {HTMLElement|null} Built field element, or null on error/limit.
     */
    build_field(field_data) {
      if (!field_data || typeof field_data !== 'object') {
        console.warn('Invalid field data:', field_data);
        return WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__field is-invalid', 'Invalid field');
      }

      // Decide a desired id first (may come from user/palette).
      let desiredIdRaw;
      if (!field_data.id || '' === String(field_data.id).trim()) {
        const base = (field_data.label ? String(field_data.label) : field_data.type || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        desiredIdRaw = `${base || 'field'}-${Math.random().toString(36).slice(2, 7)}`;
      } else {
        desiredIdRaw = String(field_data.id);
      }

      // Sanitize the id the user provided.
      const desiredId = WPBC_BFB_Sanitize.sanitize_html_id(desiredIdRaw);

      // Usage key remains stable (palette sets usage_key; otherwise use *raw* user intent).
      let usageKey = field_data.usage_key || field_data.type || desiredIdRaw;
      // Normalize common aliases to palette ids (extend as needed).
      if (usageKey === 'input-text') {
        usageKey = 'text';
      }

      // Ensure the DOM/data-id we actually use is unique (post-sanitization).
      field_data.id = this.id.ensure_unique_field_id(desiredId);

      // Ensure name exists, sanitized, and unique.
      let desiredName = field_data.name != null ? field_data.name : field_data.id;
      desiredName = WPBC_BFB_Sanitize.sanitize_html_name(desiredName);
      field_data.name = this.id.ensure_unique_field_name(desiredName);

      // Check usage count.
      if (!this.usage.is_usage_ok(usageKey)) {
        console.warn(`Field "${usageKey}" skipped – exceeds usage limit.`);
        return null;
      }
      const el = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__field');
      // Only this builder UID.
      const uid = `f-${++this._uid_counter}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      el.setAttribute('data-uid', uid);
      WPBC_Form_Builder_Helper.set_data_attributes(el, {
        ...field_data,
        usage_key: usageKey
      });

      // reflect min width (purely visual; resizing enforcement happens in the resizer).
      const min_raw = String(field_data.min_width || '').trim();
      if (min_raw) {
        // let CSS do the parsing: supports px, %, rem, etc.
        el.style.minWidth = min_raw;
      }
      el.innerHTML = WPBC_Form_Builder_Helper.render_field_inner_html(field_data);
      this.decorate_field(el);
      return el;
    }

    /**
     * Enhance a field element with drag handle, delete, move buttons, or preview.
     *
     * @param {HTMLElement} field_el - Target field element.
     * @returns {void}
     */
    decorate_field(field_el) {
      if (!field_el || field_el.classList.contains('wpbc_bfb__section')) {
        return;
      }
      field_el.classList.add('wpbc_bfb__field');
      field_el.classList.add('wpbc_bfb__drag-anywhere'); // Lets grab the field card itself to drag (outside of overlay / inputs).

      // Render.
      if (this.preview_mode) {
        this.render_preview(field_el);
      } else {
        this.add_overlay_toolbar(field_el);
      }
    }

    /**
     * Add overlay toolbar to a field/section.
     *
     * @param {HTMLElement} field_el - Field or section element.
     * @returns {void}
     */
    add_overlay_toolbar(field_el) {
      WPBC_BFB_Overlay.ensure(this, field_el);
    }

    /**
     * Render a simplified visual representation of a field (Preview Mode).
     *
     * @param {HTMLElement} field_el - Target field element.
     * @returns {void}
     */
    render_preview(field_el) {
      if (!field_el || !this.preview_mode) {
        return;
      }
      const data = WPBC_Form_Builder_Helper.get_all_data_attributes(field_el);
      const type = data.type;
      const id = data.id || '';
      const hasExplicitLabel = Object.prototype.hasOwnProperty.call(data, 'label');
      const label = hasExplicitLabel ? data.label : id;
      let input_html = '';
      try {
        const FieldClass = this._getRenderer(type);
        if (typeof FieldClass === 'function') {
          const fieldInstance = new FieldClass(data, label, id);
          if (typeof fieldInstance.render === 'function') {
            input_html = fieldInstance.render();
          } else {
            console.warn(`Renderer for "${type}" has no render() method.`);
            input_html = WPBC_Form_Builder_Helper.render_field_inner_html(data);
          }
        } else {
          if (type) {
            console.warn(`No renderer found for field type: ${type}.`);
          }
          input_html = WPBC_Form_Builder_Helper.render_field_inner_html(data);
        }
      } catch (err) {
        console.error('Renderer error.', err);
        input_html = WPBC_Form_Builder_Helper.render_field_inner_html(data);
      }
      field_el.innerHTML = input_html;
      field_el.classList.add('wpbc_bfb__preview-rendered');
      this.add_overlay_toolbar(field_el);

      // Optional hook after DOM is in place.
      try {
        const FieldClass = this._getRenderer(type);
        if (FieldClass && typeof FieldClass.after_render === 'function') {
          FieldClass.after_render(data, field_el);
        }
      } catch (err2) {
        console.warn('after_render hook failed.', err2);
      }
    }

    /**
     * Move an element (field/section) up or down in its parent container.
     *
     * @param {HTMLElement} el - Target element to move.
     * @param {string} direction - 'up' or 'down'.
     * @returns {void}
     */
    move_item(el, direction) {
      const container = el?.parentElement;
      if (!container) {
        return;
      }
      const siblings = Array.from(container.children).filter(child => child.classList.contains('wpbc_bfb__field') || child.classList.contains('wpbc_bfb__section'));
      const current_index = siblings.indexOf(el);
      if (current_index === -1) {
        return;
      }
      const new_index = direction === 'up' ? current_index - 1 : current_index + 1;
      if (new_index < 0 || new_index >= siblings.length) {
        return;
      }
      const reference_node = siblings[new_index];
      if (direction === 'up') {
        container.insertBefore(el, reference_node);
      }
      if (direction === 'down') {
        container.insertBefore(el, reference_node.nextSibling);
      }
    }

    /**
     * Set the number of columns for a given section element.
     *
     * - Increasing: appends new empty columns and resizers, (re)inits Sortable, and equalizes widths.
     * - Decreasing: moves children of removed columns into the previous column, removes columns/resizers, refreshes Sortable, and equalizes widths.
     *
     * @param {HTMLElement} section_el - The .wpbc_bfb__section element to mutate.
     * @param {number} new_count_raw - Desired column count.
     * @returns {void}
     */
    set_section_columns(section_el, new_count_raw) {
      if (!section_el || !section_el.classList.contains('wpbc_bfb__section')) {
        return;
      }
      const row = section_el.querySelector(':scope > .wpbc_bfb__row');
      if (!row) {
        return;
      }

      // Normalize and clamp count (supports 1..4; extend if needed).
      const old_cols = this._get_row_cols(row);
      const current = old_cols.length || 1;
      const min_c = 1;
      const max_c = 4;
      const target = Math.max(min_c, Math.min(max_c, parseInt(new_count_raw, 10) || current));
      if (target === current) {
        return;
      }

      // Helper to (re)insert resizers between columns.
      const rebuild_resizers = () => {
        // Remove all existing resizers.
        Array.from(row.querySelectorAll(':scope > .wpbc_bfb__column-resizer')).forEach(r => r.remove());
        // Reinsert between columns.
        const cols = this._get_row_cols(row);
        for (let i = 0; i < cols.length - 1; i++) {
          const resizer = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__column-resizer');
          resizer.addEventListener('mousedown', this.init_resize_handler);
          cols[i].insertAdjacentElement('afterend', resizer);
        }
      };

      // Increasing columns -> append new columns at the end.
      if (target > current) {
        for (let i = current; i < target; i++) {
          const col = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__column wpbc__field');
          // Give it some initial basis; will be normalized after.
          col.style.flexBasis = 100 / target + '%';
          // Make this column a drop target.
          this.init_sortable?.(col);
          row.appendChild(col);
        }
        rebuild_resizers();
        // Equalize widths considering gap.
        this.layout.set_equal_bases(row, this.col_gap_percent);

        // Overlay: ensure the layout preset chips are present for >1 columns.
        this.add_overlay_toolbar(section_el);
        return;
      }

      // Decreasing columns -> merge contents of trailing columns into the previous one, then remove.
      if (target < current) {
        // We’ll always remove from the end down to the target count,
        // moving all children of the last column into the previous column.
        for (let i = current; i > target; i--) {
          // Recompute current list each iteration.
          const cols_now = this._get_row_cols(row);
          const last = cols_now[cols_now.length - 1];
          const prev = cols_now[cols_now.length - 2] || null;
          if (last && prev) {
            // Move children (sections or fields) to previous column.
            while (last.firstChild) {
              prev.appendChild(last.firstChild);
            }
            // Remove last column.
            last.remove();
          }
        }

        // Rebuild resizers and refresh Sortable on the surviving columns.
        rebuild_resizers();
        this._get_row_cols(row).forEach(col => {
          // If Sortable missing, init; if present, do nothing (Sortable.get returns instance).
          if (typeof Sortable !== 'undefined' && !Sortable.get?.(col)) {
            this.init_sortable?.(col);
          }
        });

        // Normalize widths.
        const computed = this.layout.compute_effective_bases_from_row(row, this.col_gap_percent);
        this.layout.apply_bases_to_row(row, computed.bases);

        // Overlay: hide layout presets if single-column now; ensure toolbar re-checks.
        this.add_overlay_toolbar(section_el);
      }
    }

    /**
     * Delete a field or section, update usage UI, emit events, and select a neighbor.
     *
     * @param {HTMLElement} el - .wpbc_bfb__field or .wpbc_bfb__section
     * @returns {void}
     */
    delete_item(el) {
      if (!el || !(el.classList?.contains('wpbc_bfb__field') || el.classList?.contains('wpbc_bfb__section'))) {
        return;
      }
      const neighbor = this._find_neighbor_selectable?.(el) || null;
      const id = el?.dataset?.id;
      const uid = el?.dataset?.uid;
      el.remove();

      // Keep palette in sync and notify listeners.
      this.usage.update_palette_ui();
      this.bus.emit(WPBC_BFB_Events.FIELD_REMOVE, {
        id,
        uid,
        el_type: el.classList.contains('wpbc_bfb__section') ? 'section' : 'field'
      });

      // Pick a sensible next selection.
      this.select_field(neighbor || null);
    }
  }

  // Bootstrap facility + auto-init on DOM ready.
  w.WPBC_BFB = w.WPBC_BFB || {};
  w.WPBC_BFB.bootstrap = function bootstrap(options = {}) {
    let b = null;
    try {
      b = new WPBC_Form_Builder(options);
    } catch (e) {
      console.error('WPBC_BFB bootstrap failed:', e);
      return null;
    }
    window.wpbc_bfb = b;
    // Resolve API 'ready' if it exists already; otherwise the API will resolve itself when created.
    if (window.wpbc_bfb_api && typeof window.wpbc_bfb_api._resolveReady === 'function') {
      window.wpbc_bfb_api._resolveReady(b);
    }
    return b;
  };

  /**
   * == Public, stable API of Booking Form Builder (BFB).
   *
   * Consumers should prefer: wpbc_bfb_api.on(WPBC_BFB_Events.FIELD_ADD, handler)
   */
  w.wpbc_bfb_api = function () {
    // 'ready' promise. Resolves once the builder instance exists.
    let _resolveReady;
    const ready = new Promise(r => {
      _resolveReady = r;
    });
    // Eject/resolve after a timeout so callers aren’t stuck forever:.
    setTimeout(() => {
      if (window.wpbc_bfb) {
        _resolveReady(window.wpbc_bfb);
      }
    }, 3000);

    // If builder already exists (e.g., bootstrap ran earlier), resolve immediately.
    if (window.wpbc_bfb) {
      _resolveReady(window.wpbc_bfb);
    }
    return {
      ready,
      // internal hook used by bootstrap to resolve if API was created first.
      _resolveReady,
      /** @returns {HTMLElement|null} */
      get_selection_el() {
        const b = window.wpbc_bfb;
        return b?.get_selected_field?.() ?? null;
      },
      /** @returns {string|null} */
      get_selection_uid() {
        const b = window.wpbc_bfb;
        const el = b?.get_selected_field?.();
        return el?.dataset?.uid ?? null;
      },
      clear() {
        window.wpbc_bfb?.select_field?.(null);
      },
      /**
       * @param {string} uid
       * @param {Object} [opts={}]
       * @returns {boolean}
       */
      select_by_uid(uid, opts = {}) {
        const b = window.wpbc_bfb;
        const el = b?.pages_container?.querySelector?.(`.wpbc_bfb__field[data-uid="${WPBC_BFB_Sanitize.esc_attr_value_for_selector(uid)}"]`);
        if (el) {
          b.select_field(el, opts);
        }
        return !!el;
      },
      /** @returns {Array} */
      get_structure() {
        return window.wpbc_bfb?.get_structure?.() ?? [];
      },
      /** @param {Array} s */
      load_structure(s) {
        window.wpbc_bfb?.load_saved_structure?.(s);
      },
      /** @returns {HTMLElement|undefined} */
      add_page() {
        return window.wpbc_bfb?.add_page?.();
      },
      on(event_name, handler) {
        window.wpbc_bfb?.bus?.on?.(event_name, handler);
      },
      off(event_name, handler) {
        window.wpbc_bfb?.bus?.off?.(event_name, handler);
      },
      /**
       * Dispose the active builder instance.
       *
       * @returns {void}
       */
      destroy() {
        window.wpbc_bfb?.destroy?.();
      }
    };
  }();

  // Auto‑bootstrap on DOM ready.
  (function initBuilderWhenReady() {
    const start = () => window.WPBC_BFB.bootstrap();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, {
        once: true
      });
    } else {
      start();
    }
  })();

  // One-time cleanup: ensure sections don’t have the field class. (old markup hygiene).
  document.querySelectorAll('.wpbc_bfb__section.wpbc_bfb__field').forEach(el => el.classList.remove('wpbc_bfb__field'));

  /**
   * Empty-space clicks -> dispatch a single event; central listener does the clearing.
   * One central listener reacts to that event and does the clearing + inspector reset.
   */
  if (window.jQuery) {
    jQuery(function ($) {
      // Elements where clicks should NOT clear selection.
      const KEEP_CLICK_SEL = ['.wpbc_bfb__field', '.wpbc_bfb__section', '.wpbc_bfb__overlay-controls', '.wpbc_bfb__layout_picker', '.wpbc_bfb__drag-handle',
      // Inspector / palette surfaces.
      '#wpbc_bfb__inspector', '.wpbc_bfb__inspector', '.wpbc_bfb__panel_field_types__ul', '.wpbc_bfb__palette',
      // Generic interactive.
      'input', 'textarea', 'select', 'button', 'label', 'a,[role=button],[contenteditable]',
      // Common popups/widgets.
      '.tippy-box', '.datepick', '.simplebar-scrollbar'].join(',');

      /**
       * Reset the inspector/palette empty state UI.
       *
       * @returns {void}
       */
      function resetInspectorUI() {
        const $pal = $('#wpbc_bfb__inspector, .wpbc_bfb__palette, .wpbc_bfb__options_panel').first();
        if (!$pal.length) {
          return;
        }
        $pal.removeClass('has-selection is-active').addClass('is-empty');
        $pal.find('[data-for-uid],[data-for-field],[data-panel="field"],[role="tabpanel"]').attr('hidden', true).addClass('is-hidden');
        $pal.find('[role="tab"]').attr({
          'aria-selected': 'false',
          'tabindex': '-1'
        }).removeClass('is-active');
        $pal.find('.wpbc_bfb__inspector-empty, .wpbc_bfb__empty_state, [data-empty-state="true"]').removeAttr('hidden').removeClass('is-hidden');
      }
      const root = document.querySelector('.wpbc_settings_page_content');
      if (!root) {
        return;
      }

      /**
       * Handle clear-selection requests from ESC/empty-space and sync with builder.
       *
       * @param {CustomEvent} evt - The event carrying optional `detail.source`.
       * @returns {void}
       */
      function handleClearSelection(evt) {
        const src = evt?.detail?.source;

        // If this is the builder telling us it already cleared selection,
        // just sync the surrounding UI and exit.
        if (src === 'builder') {
          resetInspectorUI();
          return;
        }

        // Otherwise it's a request to clear (ESC, empty space, etc.).
        if (window.wpbc_bfb_api && typeof window.wpbc_bfb_api.clear === 'function') {
          window.wpbc_bfb_api.clear(); // This will emit the 'builder' notification next.
        } else {
          // Fallback if the API isn't available.
          jQuery('.is-selected, .wpbc_bfb__field--active, .wpbc_bfb__section--active').removeClass('is-selected wpbc_bfb__field--active wpbc_bfb__section--active');
          resetInspectorUI();
        }
      }

      // Listen globally for clear-selection notifications.
      const EV = window.WPBC_BFB_Events || {};
      document.addEventListener(EV.CLEAR_SELECTION || 'wpbc:bfb:clear-selection', handleClearSelection);

      // Capture clicks; only dispatch the event (no direct clearing here).
      root.addEventListener('click', function (e) {
        const $t = $(e.target);

        // Ignore clicks inside interactive / builder controls.
        if ($t.closest(KEEP_CLICK_SEL).length) {
          return;
        }

        // Ignore mouseup after selecting text.
        if (window.getSelection && String(window.getSelection()).trim() !== '') {
          return;
        }

        // Dispatch the single event; let the listener do the work.
        const evt = new CustomEvent('wpbc:bfb:clear-selection', {
          detail: {
            source: 'empty-space-click',
            originalEvent: e
          }
        });
        document.dispatchEvent(evt);
      }, true);
    });
  } // end jQuery guard
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItYnVpbGRlci5paWZlLmpzIiwibmFtZXMiOlsidyIsIldQQkNfQkZCX1Nhbml0aXplIiwiV1BCQ19CRkJfSWRTZXJ2aWNlIiwiV1BCQ19CRkJfTGF5b3V0U2VydmljZSIsIldQQkNfQkZCX1VzYWdlTGltaXRTZXJ2aWNlIiwiV1BCQ19CRkJfRXZlbnRzIiwiV1BCQ19CRkJfRXZlbnRCdXMiLCJXUEJDX0JGQl9Tb3J0YWJsZU1hbmFnZXIiLCJXUEJDX0JGQl9ET00iLCJXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIiLCJXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSIsIldQQkNfQkZCX0NvcmUiLCJXUEJDX0JGQl9Nb2R1bGUiLCJXUEJDX0JGQl9PdmVybGF5IiwiV1BCQ19CRkJfTGF5b3V0X0NoaXBzIiwiV1BCQ19CRkJfU2VsZWN0aW9uX0NvbnRyb2xsZXIiLCJXUEJDX0JGQl9JbnNwZWN0b3JfQnJpZGdlIiwiV1BCQ19CRkJfS2V5Ym9hcmRfQ29udHJvbGxlciIsIldQQkNfQkZCX1Jlc2l6ZV9Db250cm9sbGVyIiwiV1BCQ19CRkJfUGFnZXNfU2VjdGlvbnMiLCJXUEJDX0JGQl9TdHJ1Y3R1cmVfSU8iLCJXUEJDX0JGQl9NaW5fV2lkdGhfR3VhcmQiLCJXUEJDX0JGQl9VSSIsIldQQkNfRm9ybV9CdWlsZGVyIiwiY29uc3RydWN0b3IiLCJvcHRzIiwicHJvdmlkZWRQYWxldHRlcyIsIkFycmF5IiwiaXNBcnJheSIsInBhbGV0dGVfdWxzIiwicGFsZXR0ZV91bCIsImxlbmd0aCIsImZyb20iLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJwYWdlc19jb250YWluZXIiLCJnZXRFbGVtZW50QnlJZCIsIkVycm9yIiwicGFnZV9jb3VudGVyIiwic2VjdGlvbl9jb3VudGVyIiwibWF4X25lc3RlZF92YWx1ZSIsIk51bWJlciIsImlzRmluaXRlIiwicHJldmlld19tb2RlIiwidW5kZWZpbmVkIiwiY29sX2dhcF9wZXJjZW50IiwiX3VpZF9jb3VudGVyIiwiaWQiLCJsYXlvdXQiLCJ1c2FnZSIsImJ1cyIsIl9oYW5kbGVycyIsInNvcnRhYmxlIiwiX21vZHVsZXMiLCJ1c2VfbW9kdWxlIiwiX2luaXQiLCJfYmluZF9ldmVudHMiLCJfZW1pdF9jb25zdCIsInR5cGUiLCJkZXRhaWwiLCJlbWl0IiwiX2ZpbmRfbmVpZ2hib3Jfc2VsZWN0YWJsZSIsImVsIiwicGFyZW50RWxlbWVudCIsImFsbCIsImNoaWxkcmVuIiwiZmlsdGVyIiwibiIsImNsYXNzTGlzdCIsImNvbnRhaW5zIiwiaSIsImluZGV4T2YiLCJwYWdlIiwiY2xvc2VzdCIsImNhbmRpZGF0ZSIsInF1ZXJ5U2VsZWN0b3IiLCJzb3J0YWJsZVJlYWR5IiwiU29ydGFibGUiLCJjb25zb2xlIiwiZXJyb3IiLCJ3YXJuIiwiZm9yRWFjaCIsInVsIiwiZW5zdXJlIiwic2F2ZWRfc3RydWN0dXJlIiwid3BiY19iZmJfX2Zvcm1fc3RydWN0dXJlX19nZXRfZXhhbXBsZSIsIndhaXRGb3JSZW5kZXJlcnMiLCJQcm9taXNlIiwicmVzb2x2ZSIsImhhc1JlZ2lzdHJ5IiwiZ2V0Iiwic3RhcnRlZCIsIkRhdGUiLCJub3ciLCJzZXRJbnRlcnZhbCIsIm9rIiwidGltZWRPdXQiLCJjbGVhckludGVydmFsIiwic3RhcnRMb2FkIiwidGhlbiIsInNldFRpbWVvdXQiLCJsb2FkX3NhdmVkX3N0cnVjdHVyZSIsInJlYWR5U3RhdGUiLCJhZGRFdmVudExpc3RlbmVyIiwiX3N0YXJ0X3VzYWdlX29ic2VydmVyIiwiX2dldFJlbmRlcmVyIiwiX3VzYWdlX29ic2VydmVyIiwicmVmcmVzaCIsImRlYm91bmNlIiwidXBkYXRlX3BhbGV0dGVfdWkiLCJvYnNlcnZlIiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsIl8iLCJlIiwiY29uZmlnIiwiYXR0cmlidXRlcyIsImF0dHJpYnV0ZUZpbHRlciIsIk11dGF0aW9uT2JzZXJ2ZXIiLCJfYWRkX2RyYWdnaW5nX2NsYXNzIiwiY29sIiwiYWRkIiwiX3JlbW92ZV9kcmFnZ2luZ19jbGFzcyIsInJlbW92ZSIsInNhdmVfYnRuIiwiaGFzQXR0cmlidXRlIiwic2V0QXR0cmlidXRlIiwiX29uIiwicHJldmVudERlZmF1bHQiLCJzdHJ1Y3R1cmUiLCJnZXRfc3RydWN0dXJlIiwibG9nIiwiSlNPTiIsInN0cmluZ2lmeSIsIlNUUlVDVFVSRV9DSEFOR0UiLCJkZWZlcklmVHlwaW5nIiwicHJldmlld190b2dnbGUiLCJjaGVja2VkIiwiX3JlaW5pdF9hbGxfZmllbGRzIiwiYWRkX3BhZ2VfYnRuIiwiYWRkX3BhZ2UiLCJfYW5ub3VuY2UiLCJmIiwidGFyZ2V0IiwicmVtb3ZlQXR0cmlidXRlIiwiY29udGV4dCIsImZpZWxkX2VsIiwidHJpZ2dlcl9maWVsZF9kcm9wX2NhbGxiYWNrIiwiX2dldF9yb3dfY29scyIsInJvd19lbCIsIl9zZXRfZmllbGRfaWQiLCJuZXdJZFJhdyIsInVuaXF1ZSIsInNldF9maWVsZF9pZCIsInJlbmRlcl9wcmV2aWV3IiwiX3NldF9maWVsZF9uYW1lIiwibmV3TmFtZVJhdyIsInNldF9maWVsZF9uYW1lIiwiX3NldF9maWVsZF9odG1sX2lkIiwibmV3SHRtbElkUmF3IiwiYXBwbGllZCIsInNldF9maWVsZF9odG1sX2lkIiwibXNnIiwibGl2ZSIsImNyZWF0ZUVsZW1lbnQiLCJzdHlsZSIsInBvc2l0aW9uIiwibGVmdCIsInRvcCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsInRleHRDb250ZW50IiwiU3RyaW5nIiwiaGFuZGxlciIsInB1c2giLCJNb2R1bGVfQ2xhc3MiLCJvcHRpb25zIiwibW9kIiwiaW5pdCIsImRlc3Ryb3kiLCJkaXNjb25uZWN0IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImRlc3Ryb3lBbGwiLCJpbnNwZWN0b3IiLCJpbml0X3NvcnRhYmxlIiwiY29udGFpbmVyIiwib25fYWRkX2NhbGxiYWNrIiwiaGFuZGxlX29uX2FkZCIsImJpbmQiLCJvbkFkZCIsImV2dCIsIml0ZW0iLCJ0byIsIm5lc3RpbmdfbGV2ZWwiLCJnZXRfbmVzdGluZ19sZXZlbCIsImFsZXJ0IiwiaW5pdF9hbGxfbmVzdGVkX3NvcnRhYmxlcyIsImlzX2Zyb21fcGFsZXR0ZSIsImluY2x1ZGVzIiwicGFsZXR0ZUlkIiwiZGF0YXNldCIsImZpZWxkX2RhdGEiLCJnZXRfYWxsX2RhdGFfYXR0cmlidXRlcyIsInVzYWdlX2tleSIsImdhdGVfb3JfYWxlcnQiLCJsYWJlbCIsInJlYnVpbHQiLCJidWlsZF9maWVsZCIsInNlbGVjdG9yIiwiZHJhZ2dhYmxlIiwic2NvcGVkU2VsZWN0b3IiLCJzcGxpdCIsIm1hcCIsInMiLCJ0cmltIiwiam9pbiIsImRyYWdnYWJsZXMiLCJiZWZvcmUiLCJpc0ludGVnZXIiLCJuZXdJbmRleCIsImluc2VydEJlZm9yZSIsImRlY29yYXRlX2ZpZWxkIiwiRklFTERfQUREIiwiZGF0YSIsInNlbGVjdF9maWVsZCIsInNjcm9sbEludG9WaWV3IiwiRmllbGRDbGFzcyIsIm9uX2ZpZWxkX2Ryb3AiLCJlcnIiLCJzZWN0aW9uX2VsIiwibGV2ZWwiLCJwYXJlbnQiLCJvdXRlciIsImNyZWF0ZV9lbGVtZW50IiwiZGVzaXJlZElkUmF3IiwiYmFzZSIsInRvTG93ZXJDYXNlIiwicmVwbGFjZSIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInNsaWNlIiwiZGVzaXJlZElkIiwic2FuaXRpemVfaHRtbF9pZCIsInVzYWdlS2V5IiwiZW5zdXJlX3VuaXF1ZV9maWVsZF9pZCIsImRlc2lyZWROYW1lIiwibmFtZSIsInNhbml0aXplX2h0bWxfbmFtZSIsImVuc3VyZV91bmlxdWVfZmllbGRfbmFtZSIsImlzX3VzYWdlX29rIiwidWlkIiwic2V0X2RhdGFfYXR0cmlidXRlcyIsIm1pbl9yYXciLCJtaW5fd2lkdGgiLCJtaW5XaWR0aCIsImlubmVySFRNTCIsInJlbmRlcl9maWVsZF9pbm5lcl9odG1sIiwiYWRkX292ZXJsYXlfdG9vbGJhciIsImhhc0V4cGxpY2l0TGFiZWwiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJpbnB1dF9odG1sIiwiZmllbGRJbnN0YW5jZSIsInJlbmRlciIsImFmdGVyX3JlbmRlciIsImVycjIiLCJtb3ZlX2l0ZW0iLCJkaXJlY3Rpb24iLCJzaWJsaW5ncyIsImNoaWxkIiwiY3VycmVudF9pbmRleCIsIm5ld19pbmRleCIsInJlZmVyZW5jZV9ub2RlIiwibmV4dFNpYmxpbmciLCJzZXRfc2VjdGlvbl9jb2x1bW5zIiwibmV3X2NvdW50X3JhdyIsInJvdyIsIm9sZF9jb2xzIiwiY3VycmVudCIsIm1pbl9jIiwibWF4X2MiLCJtYXgiLCJtaW4iLCJwYXJzZUludCIsInJlYnVpbGRfcmVzaXplcnMiLCJyIiwiY29scyIsInJlc2l6ZXIiLCJpbml0X3Jlc2l6ZV9oYW5kbGVyIiwiaW5zZXJ0QWRqYWNlbnRFbGVtZW50IiwiZmxleEJhc2lzIiwic2V0X2VxdWFsX2Jhc2VzIiwiY29sc19ub3ciLCJsYXN0IiwicHJldiIsImZpcnN0Q2hpbGQiLCJjb21wdXRlZCIsImNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzX2Zyb21fcm93IiwiYXBwbHlfYmFzZXNfdG9fcm93IiwiYmFzZXMiLCJkZWxldGVfaXRlbSIsIm5laWdoYm9yIiwiRklFTERfUkVNT1ZFIiwiZWxfdHlwZSIsIldQQkNfQkZCIiwiYm9vdHN0cmFwIiwiYiIsIndpbmRvdyIsIndwYmNfYmZiIiwid3BiY19iZmJfYXBpIiwiX3Jlc29sdmVSZWFkeSIsInJlYWR5IiwiZ2V0X3NlbGVjdGlvbl9lbCIsImdldF9zZWxlY3RlZF9maWVsZCIsImdldF9zZWxlY3Rpb25fdWlkIiwiY2xlYXIiLCJzZWxlY3RfYnlfdWlkIiwiZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yIiwibG9hZF9zdHJ1Y3R1cmUiLCJvbiIsImV2ZW50X25hbWUiLCJvZmYiLCJpbml0QnVpbGRlcldoZW5SZWFkeSIsInN0YXJ0Iiwib25jZSIsImpRdWVyeSIsIiQiLCJLRUVQX0NMSUNLX1NFTCIsInJlc2V0SW5zcGVjdG9yVUkiLCIkcGFsIiwiZmlyc3QiLCJyZW1vdmVDbGFzcyIsImFkZENsYXNzIiwiZmluZCIsImF0dHIiLCJyZW1vdmVBdHRyIiwicm9vdCIsImhhbmRsZUNsZWFyU2VsZWN0aW9uIiwic3JjIiwic291cmNlIiwiRVYiLCJDTEVBUl9TRUxFQ1RJT04iLCIkdCIsImdldFNlbGVjdGlvbiIsIkN1c3RvbUV2ZW50Iiwib3JpZ2luYWxFdmVudCIsImRpc3BhdGNoRXZlbnQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2JmYi1idWlsZGVyLmlpZmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9fb3V0L2JmYi1idWlsZGVyLmlpZmUuanMgPT0gVGltZSBwb2ludDogMjAyNS0wOC0yMSAxNzozOVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICh3KSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRjb25zdCB7XHJcblx0XHRcdFdQQkNfQkZCX1Nhbml0aXplLFxyXG5cdFx0XHRXUEJDX0JGQl9JZFNlcnZpY2UsXHJcblx0XHRcdFdQQkNfQkZCX0xheW91dFNlcnZpY2UsXHJcblx0XHRcdFdQQkNfQkZCX1VzYWdlTGltaXRTZXJ2aWNlLFxyXG5cdFx0XHRXUEJDX0JGQl9FdmVudHMsXHJcblx0XHRcdFdQQkNfQkZCX0V2ZW50QnVzLFxyXG5cdFx0XHRXUEJDX0JGQl9Tb3J0YWJsZU1hbmFnZXIsXHJcblx0XHRcdFdQQkNfQkZCX0RPTSxcclxuXHRcdFx0V1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLFxyXG5cdFx0XHRXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeVxyXG5cdFx0ICB9ID0gdy5XUEJDX0JGQl9Db3JlO1xyXG5cclxuXHRjb25zdCB7XHJcblx0XHRcdFdQQkNfQkZCX01vZHVsZSxcclxuXHRcdFx0V1BCQ19CRkJfT3ZlcmxheSxcclxuXHRcdFx0V1BCQ19CRkJfTGF5b3V0X0NoaXBzLFxyXG5cdFx0XHRXUEJDX0JGQl9TZWxlY3Rpb25fQ29udHJvbGxlcixcclxuXHRcdFx0V1BCQ19CRkJfSW5zcGVjdG9yX0JyaWRnZSxcclxuXHRcdFx0V1BCQ19CRkJfS2V5Ym9hcmRfQ29udHJvbGxlcixcclxuXHRcdFx0V1BCQ19CRkJfUmVzaXplX0NvbnRyb2xsZXIsXHJcblx0XHRcdFdQQkNfQkZCX1BhZ2VzX1NlY3Rpb25zLFxyXG5cdFx0XHRXUEJDX0JGQl9TdHJ1Y3R1cmVfSU8sXHJcblx0XHRcdFdQQkNfQkZCX01pbl9XaWR0aF9HdWFyZFxyXG5cdFx0ICB9ID0gdy5XUEJDX0JGQl9VSTtcclxuXHJcblxyXG4gXHRjbGFzcyBXUEJDX0Zvcm1fQnVpbGRlciB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb25zdHJ1Y3RvciBmb3IgQm9va2luZyBGb3JtIEJ1aWxkZXIgY2xhc3MuXHJcblx0XHQgKiBJbml0aWFsaXplcyBVSSBlbGVtZW50cywgU29ydGFibGVKUywgYW5kIGV2ZW50IGxpc3RlbmVycy5cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3IoIG9wdHMgPSB7fSApIHtcclxuXHRcdFx0Ly8gQWxsb3cgREkvb3ZlcnJpZGVzIHZpYSBvcHRzIHdoaWxlIGtlZXBpbmcgZGVmYXVsdHMuXHJcblx0XHRcdC8vIEJhY2stY29tcGF0OiBhY2NlcHQgZWl0aGVyIGEgc2luZ2xlIFVMIHZpYSBvcHRzLnBhbGV0dGVfdWwgb3IgYW4gYXJyYXkgdmlhIG9wdHMucGFsZXR0ZV91bHMuXHJcblx0XHRcdGNvbnN0IHByb3ZpZGVkUGFsZXR0ZXMgPSBBcnJheS5pc0FycmF5KCBvcHRzLnBhbGV0dGVfdWxzICkgPyBvcHRzLnBhbGV0dGVfdWxzIDogKG9wdHMucGFsZXR0ZV91bCA/IFsgb3B0cy5wYWxldHRlX3VsIF0gOiBbXSk7XHJcblx0XHRcdHRoaXMucGFsZXR0ZV91bHMgPSBwcm92aWRlZFBhbGV0dGVzLmxlbmd0aCA/IHByb3ZpZGVkUGFsZXR0ZXMgOiBBcnJheS5mcm9tKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19wYW5lbF9maWVsZF90eXBlc19fdWwnICkgKTtcclxuXHJcblx0XHRcdHRoaXMucGFnZXNfY29udGFpbmVyICAgICA9IG9wdHMucGFnZXNfY29udGFpbmVyIHx8IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3BhZ2VzX2NvbnRhaW5lcicgKTtcclxuXHRcdFx0aWYgKCAhIHRoaXMucGFnZXNfY29udGFpbmVyICkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvciggJ1dQQkM6IHBhZ2VzIGNvbnRhaW5lciBub3QgZm91bmQuJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMucGFnZV9jb3VudGVyICAgICA9IDA7XHJcblx0XHRcdHRoaXMuc2VjdGlvbl9jb3VudGVyICA9IDA7XHJcblx0XHRcdHRoaXMubWF4X25lc3RlZF92YWx1ZSA9IE51bWJlci5pc0Zpbml0ZSggK29wdHMubWF4X25lc3RlZF92YWx1ZSApID8gK29wdHMubWF4X25lc3RlZF92YWx1ZSA6IDU7XHJcblx0XHRcdHRoaXMucHJldmlld19tb2RlICAgICA9ICggb3B0cy5wcmV2aWV3X21vZGUgIT09IHVuZGVmaW5lZCApID8gISFvcHRzLnByZXZpZXdfbW9kZSA6IHRydWU7XHJcblx0XHRcdHRoaXMuY29sX2dhcF9wZXJjZW50ICA9IE51bWJlci5pc0Zpbml0ZSggK29wdHMuY29sX2dhcF9wZXJjZW50ICkgPyArb3B0cy5jb2xfZ2FwX3BlcmNlbnQgOiAzOyAvLyAlIGdhcCBiZXR3ZWVuIGNvbHVtbnMgZm9yIGxheW91dCBtYXRoLlxyXG5cdFx0XHR0aGlzLl91aWRfY291bnRlciAgICAgPSAwO1xyXG5cclxuXHRcdFx0Ly8gU2VydmljZSBpbnN0YW5jZXMuXHJcblx0XHRcdHRoaXMuaWQgICAgICAgID0gbmV3IFdQQkNfQkZCX0lkU2VydmljZSggdGhpcy5wYWdlc19jb250YWluZXIgKTtcclxuXHRcdFx0dGhpcy5sYXlvdXQgICAgPSBuZXcgV1BCQ19CRkJfTGF5b3V0U2VydmljZSggeyBjb2xfZ2FwX3BlcmNlbnQ6IHRoaXMuY29sX2dhcF9wZXJjZW50IH0gKTtcclxuXHRcdFx0dGhpcy51c2FnZSAgICAgPSBuZXcgV1BCQ19CRkJfVXNhZ2VMaW1pdFNlcnZpY2UoIHRoaXMucGFnZXNfY29udGFpbmVyLCB0aGlzLnBhbGV0dGVfdWxzICk7XHJcblx0XHRcdHRoaXMuYnVzICAgICAgID0gbmV3IFdQQkNfQkZCX0V2ZW50QnVzKCB0aGlzLnBhZ2VzX2NvbnRhaW5lciApO1xyXG5cdFx0XHR0aGlzLl9oYW5kbGVycyA9IFtdO1xyXG5cdFx0XHR0aGlzLnNvcnRhYmxlICA9IG5ldyBXUEJDX0JGQl9Tb3J0YWJsZU1hbmFnZXIoIHRoaXMgKTtcclxuXHJcblx0XHRcdHRoaXMuX21vZHVsZXMgPSBbXTsgICAvKiogQHR5cGUge0FycmF5PFdQQkNfQkZCX01vZHVsZT59ICovXHJcblxyXG5cdFx0XHQvLyBSZWdpc3RlciBtb2R1bGVzLlxyXG5cdFx0XHR0aGlzLnVzZV9tb2R1bGUoIFdQQkNfQkZCX1NlbGVjdGlvbl9Db250cm9sbGVyICk7XHJcblx0XHRcdHRoaXMudXNlX21vZHVsZSggV1BCQ19CRkJfSW5zcGVjdG9yX0JyaWRnZSApO1xyXG5cdFx0XHR0aGlzLnVzZV9tb2R1bGUoIFdQQkNfQkZCX1Jlc2l6ZV9Db250cm9sbGVyICk7XHJcblx0XHRcdHRoaXMudXNlX21vZHVsZSggV1BCQ19CRkJfUGFnZXNfU2VjdGlvbnMgKTtcclxuXHRcdFx0dGhpcy51c2VfbW9kdWxlKCBXUEJDX0JGQl9TdHJ1Y3R1cmVfSU8gKTtcclxuXHRcdFx0dGhpcy51c2VfbW9kdWxlKCBXUEJDX0JGQl9LZXlib2FyZF9Db250cm9sbGVyICk7XHJcblx0XHRcdHRoaXMudXNlX21vZHVsZSggV1BCQ19CRkJfTWluX1dpZHRoX0d1YXJkICk7XHJcblxyXG5cdFx0XHR0aGlzLl9pbml0KCk7XHJcblx0XHRcdHRoaXMuX2JpbmRfZXZlbnRzKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbWl0IGEgbmFtZXNwYWNlZCBidWlsZGVyIGV2ZW50IHZpYSB0aGUgRXZlbnRCdXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBFdmVudCB0eXBlICh1c2UgV1BCQ19CRkJfRXZlbnRzIHdoZW4gcG9zc2libGUpLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtkZXRhaWw9e31dIC0gUGF5bG9hZCBvYmplY3QuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X2VtaXRfY29uc3QodHlwZSwgZGV0YWlsID0ge30pIHtcclxuXHRcdFx0dGhpcy5idXMuZW1pdCggdHlwZSwgZGV0YWlsICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBGaW5kIGEgbmVpZ2hib3IgZWxlbWVudCB0aGF0IGNhbiBiZSBzZWxlY3RlZCBhZnRlciByZW1vdmluZyBhIG5vZGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgLSBUaGUgZWxlbWVudCB0aGF0IGlzIGJlaW5nIHJlbW92ZWQuXHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR8bnVsbH0gTmVpZ2hib3Igb3IgbnVsbC5cclxuXHRcdCAqL1xyXG5cdFx0X2ZpbmRfbmVpZ2hib3Jfc2VsZWN0YWJsZShlbCkge1xyXG5cclxuXHRcdFx0aWYgKCAhIGVsIHx8ICEgZWwucGFyZW50RWxlbWVudCApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgYWxsID0gQXJyYXkuZnJvbSggZWwucGFyZW50RWxlbWVudC5jaGlsZHJlbiApLmZpbHRlciggbiA9PiAobi5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApIHx8IG4uY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApKSApO1xyXG5cclxuXHRcdFx0Y29uc3QgaSA9IGFsbC5pbmRleE9mKCBlbCApO1xyXG5cdFx0XHRpZiAoIGkgPiAwICkge1xyXG5cdFx0XHRcdHJldHVybiBhbGxbaSAtIDFdO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaSA+PSAwICYmIGkgKyAxIDwgYWxsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYWxsW2kgKyAxXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRmFsbGJhY2s6IGFueSBvdGhlciBzZWxlY3RhYmxlIG9uIHRoZSBjdXJyZW50IHBhZ2UsIGJ1dCBORVZFUiBpbnNpZGUgYGVsYCBpdHNlbGYuXHJcblx0XHRcdGNvbnN0IHBhZ2UgPSBlbC5jbG9zZXN0KCAnLndwYmNfYmZiX19wYW5lbC0tcHJldmlldycgKTtcclxuXHRcdFx0aWYgKCBwYWdlICkge1xyXG5cdFx0XHRcdC8vIFByZWZlciBzZWN0aW9ucy9maWVsZHMgdGhhdCBhcmUgc2libGluZ3MgZWxzZXdoZXJlIG9uIHRoZSBwYWdlLlxyXG5cdFx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IHBhZ2UucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fc2VjdGlvbiwgLndwYmNfYmZiX19maWVsZCcgKTtcclxuXHRcdFx0XHRpZiAoIGNhbmRpZGF0ZSAmJiAhIGVsLmNvbnRhaW5zKCBjYW5kaWRhdGUgKSApIHtcclxuXHRcdFx0XHRcdHJldHVybiBjYW5kaWRhdGU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEluaXRpYWxpemUgU29ydGFibGVKUyBvbiB0aGUgZmllbGQgcGFsZXR0ZSBhbmQgbG9hZCBpbml0aWFsIGZvcm0gc3RydWN0dXJlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfaW5pdCgpIHtcclxuXHRcdFx0Y29uc3Qgc29ydGFibGVSZWFkeSA9IHR5cGVvZiBTb3J0YWJsZSAhPT0gJ3VuZGVmaW5lZCc7XHJcblx0XHRcdGlmICggISBzb3J0YWJsZVJlYWR5ICkge1xyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdTb3J0YWJsZUpTIGlzIG5vdCBsb2FkZWQgKGRyYWcgJiBkcm9wIGRpc2FibGVkKS4nICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vID09PSBJbml0IFNvcnRhYmxlIG9uIHRoZSBGaWVsZCBQYWxldHRlLiA9PT1cclxuXHRcdFx0aWYgKCAhIHRoaXMucGFsZXR0ZV91bHMubGVuZ3RoICkge1xyXG5cdFx0XHRcdGNvbnNvbGUud2FybiggJ1dQQkM6IE5vIGZpZWxkIHBhbGV0dGVzIGZvdW5kICgud3BiY19iZmJfX3BhbmVsX2ZpZWxkX3R5cGVzX191bCkuJyApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2YgU29ydGFibGUgPT09ICd1bmRlZmluZWQnICkge1xyXG5cdFx0XHRcdGNvbnNvbGUud2FybiggJ1dQQkM6IFNvcnRhYmxlSlMgbm90IGxvYWRlZCAocGFsZXR0ZSBkcmFnIGRpc2FibGVkKS4nICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5wYWxldHRlX3Vscy5mb3JFYWNoKCAodWwpID0+IHRoaXMuc29ydGFibGUuZW5zdXJlKCB1bCwgJ3BhbGV0dGUnICkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gTG9hZCBzYXZlZCBzdHJ1Y3R1cmUgb3IgY3JlYXRlIGRlZmF1bHQgcGFnZS5cclxuXHRcdFx0Y29uc3Qgc2F2ZWRfc3RydWN0dXJlID0gd3BiY19iZmJfX2Zvcm1fc3RydWN0dXJlX19nZXRfZXhhbXBsZSgpOyAvLyBFeHRlcm5hbCBmYWxsYmFjay5cclxuXHJcblx0XHRcdGNvbnN0IHdhaXRGb3JSZW5kZXJlcnMgPSAoKSA9PiBuZXcgUHJvbWlzZSggKHJlc29sdmUpID0+IHtcclxuXHRcdFx0XHRjb25zdCBoYXNSZWdpc3RyeSA9ICEhKHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeS5nZXQgPT09ICdmdW5jdGlvbicpO1xyXG5cclxuXHRcdFx0XHRpZiAoIGhhc1JlZ2lzdHJ5ICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlc29sdmUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y29uc3Qgc3RhcnRlZCA9IERhdGUubm93KCk7XHJcblx0XHRcdFx0Y29uc3QgaSAgICAgICA9IHNldEludGVydmFsKCAoKSA9PiB7XHJcblx0XHRcdFx0XHRjb25zdCBvayAgICAgICA9ICEhKHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeS5nZXQgPT09ICdmdW5jdGlvbicpO1xyXG5cdFx0XHRcdFx0Y29uc3QgdGltZWRPdXQgPSAoRGF0ZS5ub3coKSAtIHN0YXJ0ZWQpID4gMzAwMDtcclxuXHRcdFx0XHRcdGlmICggb2sgfHwgdGltZWRPdXQgKSB7XHJcblx0XHRcdFx0XHRcdGNsZWFySW50ZXJ2YWwoIGkgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCAhIG9rICkge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUud2FybiggJ1dQQkM6IEZpZWxkIHJlbmRlcmVycyBub3QgZm91bmQsIHVzaW5nIGZhbGxiYWNrIHByZXZpZXcuJyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJlc29sdmUoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LCA1MCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRjb25zdCBzdGFydExvYWQgPSAoKSA9PiB3YWl0Rm9yUmVuZGVyZXJzKCkudGhlbiggKCkgPT4gc2V0VGltZW91dCggKCkgPT4gdGhpcy5sb2FkX3NhdmVkX3N0cnVjdHVyZSggc2F2ZWRfc3RydWN0dXJlICksIDAgKSApO1xyXG5cclxuXHRcdFx0aWYgKCBkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycgKSB7XHJcblx0XHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBzdGFydExvYWQgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRzdGFydExvYWQoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fc3RhcnRfdXNhZ2Vfb2JzZXJ2ZXIoKTtcclxuXHJcblx0XHRcdC8vIHRoaXMuYWRkX3BhZ2UoKTsgcmV0dXJuOyAgLy8gU3RhbmRhcmQgaW5pdGlhbGl6aW5nIG9uZSBwYWdlLlxyXG5cdFx0fVxyXG5cclxuXHRcdF9nZXRSZW5kZXJlcih0eXBlKSB7XHJcblx0XHRcdHJldHVybiB3LldQQkNfQkZCX0NvcmU/LldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5Py5nZXQ/LiggdHlwZSApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9ic2VydmUgRE9NIG11dGF0aW9ucyB0aGF0IG1heSBjaGFuZ2UgdXNhZ2UgY291bnRzIGFuZCByZWZyZXNoIHBhbGV0dGUgc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9zdGFydF91c2FnZV9vYnNlcnZlcigpIHtcclxuXHRcdFx0aWYgKCB0aGlzLl91c2FnZV9vYnNlcnZlciApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHJlZnJlc2ggPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZGVib3VuY2UoICgpID0+IHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0dGhpcy51c2FnZS51cGRhdGVfcGFsZXR0ZV91aSgpO1xyXG5cdFx0XHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsJyApLmZvckVhY2goICh1bCkgPT4ge1xyXG5cdFx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuX3VzYWdlX29ic2VydmVyLm9ic2VydmUoIHVsLCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9ICk7XHJcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKCAnVXNhZ2UgVUkgdXBkYXRlIGZhaWxlZC4nLCBlICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCAxMDAgKTtcclxuXHJcblx0XHRcdGNvbnN0IGNvbmZpZyA9IHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlLCBhdHRyaWJ1dGVzOiB0cnVlLCBhdHRyaWJ1dGVGaWx0ZXI6IFsgJ2NsYXNzJywgJ2RhdGEtdXNhZ2Vfa2V5JyBdIH07XHJcblxyXG5cdFx0XHR0aGlzLl91c2FnZV9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCByZWZyZXNoICk7XHJcblx0XHRcdHRoaXMuX3VzYWdlX29ic2VydmVyLm9ic2VydmUoIHRoaXMucGFnZXNfY29udGFpbmVyLCBjb25maWcgKTtcclxuXHJcblx0XHRcdC8vIE9ic2VydmUgYWxsIGtub3duIHBhbGV0dGVzOyBhbHNvIGRvIGEgYnJvYWQgcXVlcnkgb24gZWFjaCByZWZyZXNoIHNvIGxhdGUtYWRkZWQgcGFsZXR0ZXMgYXJlIGhhbmRsZWQuXHJcblx0XHRcdCh0aGlzLnBhbGV0dGVfdWxzIHx8IFtdKS5mb3JFYWNoKCAodWwpID0+IHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0dGhpcy5fdXNhZ2Vfb2JzZXJ2ZXIub2JzZXJ2ZSggdWwsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0gKTtcclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblxyXG5cdFx0XHQvLyBJbml0aWFsIHN5bmMuXHJcblx0XHRcdHJlZnJlc2goKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFkZCBkcmFnZ2luZyB2aXN1YWwgZmVlZGJhY2sgb24gYWxsIGNvbHVtbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9hZGRfZHJhZ2dpbmdfY2xhc3MoKSB7XHJcblx0XHRcdHRoaXMucGFnZXNfY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2NvbHVtbicgKS5mb3JFYWNoKCAoIGNvbCApID0+IGNvbC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2RyYWdnaW5nJyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgZHJhZ2dpbmcgdmlzdWFsIGZlZWRiYWNrIG9uIGFsbCBjb2x1bW5zLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfcmVtb3ZlX2RyYWdnaW5nX2NsYXNzKCkge1xyXG5cdFx0XHR0aGlzLnBhZ2VzX2NvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19jb2x1bW4nICkuZm9yRWFjaCggKCBjb2wgKSA9PiBjb2wuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYmZiX19kcmFnZ2luZycgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQmluZCBldmVudCBoYW5kbGVycyBmb3Igc2F2ZSwgYWRkLXBhZ2UsIGFuZCBwcmV2aWV3IHRvZ2dsZSBidXR0b25zLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfYmluZF9ldmVudHMoKSB7XHJcblx0XHRcdC8vIFNhdmUgYnV0dG9uIGNsaWNrLlxyXG5cdFx0XHRjb25zdCBzYXZlX2J0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3NhdmVfYnRuJyApO1xyXG5cdFx0XHRpZiAoIHNhdmVfYnRuICkge1xyXG5cdFx0XHRcdGlmICggISBzYXZlX2J0bi5oYXNBdHRyaWJ1dGUoICd0eXBlJyApICkge1xyXG5cdFx0XHRcdFx0c2F2ZV9idG4uc2V0QXR0cmlidXRlKCAndHlwZScsICdidXR0b24nICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMuX29uKCBzYXZlX2J0biwgJ2NsaWNrJywgKCBlICkgPT4ge1xyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0Y29uc3Qgc3RydWN0dXJlID0gdGhpcy5nZXRfc3RydWN0dXJlKCk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmxvZyggSlNPTi5zdHJpbmdpZnkoIHN0cnVjdHVyZSwgbnVsbCwgMiApICk7IC8vIERldmVsb3BlciBhaWQuXHJcblx0XHRcdFx0XHR0aGlzLl9lbWl0X2NvbnN0KCBXUEJDX0JGQl9FdmVudHMuU1RSVUNUVVJFX0NIQU5HRSwgeyBzdHJ1Y3R1cmUgfSApO1xyXG5cdFx0XHRcdFx0dGhpcy5sb2FkX3NhdmVkX3N0cnVjdHVyZSggc3RydWN0dXJlLCB7IGRlZmVySWZUeXBpbmc6IGZhbHNlIH0gKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFRvZ2dsZSBQcmV2aWV3IGNsaWNrLlxyXG5cdFx0XHRjb25zdCBwcmV2aWV3X3RvZ2dsZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3RvZ2dsZV9wcmV2aWV3JyApO1xyXG5cdFx0XHRpZiAoIHByZXZpZXdfdG9nZ2xlICkge1xyXG5cdFx0XHRcdC8vIGluaXRpYWxpemUgZnJvbSBjdXJyZW50IGNvbnRyb2wgc3RhdGUgaWYgaXQgaXMgYSBjaGVja2JveC9zd2l0Y2guXHJcblx0XHRcdFx0aWYgKCAnY2hlY2tlZCcgaW4gcHJldmlld190b2dnbGUgKSB7XHJcblx0XHRcdFx0XHR0aGlzLnByZXZpZXdfbW9kZSA9ICggJ2NoZWNrZWQnIGluIHByZXZpZXdfdG9nZ2xlICkgPyAhIXByZXZpZXdfdG9nZ2xlLmNoZWNrZWQgOiB0aGlzLnByZXZpZXdfbW9kZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGhpcy5fb24oIHByZXZpZXdfdG9nZ2xlLCAnY2hhbmdlJywgKCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5wcmV2aWV3X21vZGUgPSAoICdjaGVja2VkJyBpbiBwcmV2aWV3X3RvZ2dsZSApID8gISFwcmV2aWV3X3RvZ2dsZS5jaGVja2VkIDogIXRoaXMucHJldmlld19tb2RlO1xyXG5cdFx0XHRcdFx0Ly8gUmVidWlsZCBET00gc28gZmllbGRzL3NlY3Rpb25zIHJlbmRlciBhY2NvcmRpbmcgdG8gdGhlIG5ldyBtb2RlLlxyXG5cdFx0XHRcdFx0dGhpcy5sb2FkX3NhdmVkX3N0cnVjdHVyZSggdGhpcy5nZXRfc3RydWN0dXJlKCksIHsgZGVmZXJJZlR5cGluZzogdHJ1ZSB9ICk7XHJcblx0XHRcdFx0XHQvLyBTb21lIHJlbmRlcmVycyByZWx5IG9uIG9uX2ZpZWxkX2Ryb3AgaG9va3MgdG8gKHJlKXdpcmUgdGhlbXNlbHZlcy5cclxuXHRcdFx0XHRcdHRoaXMuX3JlaW5pdF9hbGxfZmllbGRzKCAncHJldmlldycgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEtleWJvYXJkIGhhbmRsaW5nIG1vdmVkIHRvIFdQQkNfQkZCX0tleWJvYXJkX0NvbnRyb2xsZXIuXHJcblxyXG5cdFx0XHQvLyBBZGQgcGFnZSBidXR0b24gY2xpY2suXHJcblx0XHRcdGNvbnN0IGFkZF9wYWdlX2J0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2FkZF9wYWdlX2J0bicgKTtcclxuXHRcdFx0aWYgKCBhZGRfcGFnZV9idG4gKSB7XHJcblx0XHRcdFx0dGhpcy5fb24oIGFkZF9wYWdlX2J0biwgJ2NsaWNrJywgKCBlICkgPT4ge1xyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0dGhpcy5hZGRfcGFnZSgpO1xyXG5cdFx0XHRcdFx0dGhpcy5fYW5ub3VuY2U/LiggJ1BhZ2UgYWRkZWQuJyApO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gUHJldmVudCBhY2NpZGVudGFsIGRyYWcgd2hpbGUgZWRpdGluZyBpbnB1dHMuXHJcblx0XHRcdHRoaXMuX29uKCB0aGlzLnBhZ2VzX2NvbnRhaW5lciwgJ2ZvY3VzaW4nLCAoZSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGYgPSBlLnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19maWVsZCcgKTtcclxuXHRcdFx0XHRpZiAoIGYgKSB7XHJcblx0XHRcdFx0XHRmLnNldEF0dHJpYnV0ZSggJ2RhdGEtZHJhZ2dhYmxlJywgJ2ZhbHNlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0XHR0aGlzLl9vbiggdGhpcy5wYWdlc19jb250YWluZXIsICdmb2N1c291dCcsIChlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgZiA9IGUudGFyZ2V0LmNsb3Nlc3QoICcud3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHRcdGlmICggZiApIHtcclxuXHRcdFx0XHRcdGYucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1kcmFnZ2FibGUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmUtcnVuIGZpZWxkIGluaXRpYWxpemVycyBmb3IgZXZlcnkgZmllbGQgaW4gdGhlIGNhbnZhcy5cclxuXHRcdCAqIE1hbnkgcmVuZGVyZXJzIChlLmcuLCBDYWxlbmRhcikgd2lyZSB0aGVtc2VsdmVzIGluc2lkZSBvbl9maWVsZF9kcm9wKCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtcImRyb3BcInxcImxvYWRcInxcInByZXZpZXdcInxcInNhdmVcIn0gY29udGV4dFxyXG5cdFx0ICovXHJcblx0XHRfcmVpbml0X2FsbF9maWVsZHMoY29udGV4dCA9ICdwcmV2aWV3Jykge1xyXG5cdFx0XHR0aGlzLnBhZ2VzX2NvbnRhaW5lclxyXG5cdFx0XHRcdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkJyApXHJcblx0XHRcdFx0LmZvckVhY2goIChmaWVsZF9lbCkgPT4gdGhpcy50cmlnZ2VyX2ZpZWxkX2Ryb3BfY2FsbGJhY2soIGZpZWxkX2VsLCBjb250ZXh0ICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiBvbmx5IHRoZSBjb2x1bW4gZWxlbWVudHMgKHNraXAgcmVzaXplcnMpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd19lbCAtIFJvdyBlbGVtZW50LlxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50W119IENvbHVtbiBlbGVtZW50cy5cclxuXHRcdCAqL1xyXG5cdFx0X2dldF9yb3dfY29scyggcm93X2VsICkge1xyXG5cdFx0XHRyZXR1cm4gQXJyYXkuZnJvbSggcm93X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2V0IGZpZWxkJ3MgSU5URVJOQUwgaWQgKGRhdGEtaWQpLiBEb2VzIG5vdCByZWJpbmQgaW5zcGVjdG9yLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkX2VsIC0gVGFyZ2V0IGZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbmV3SWRSYXcgLSBOZXcgZGVzaXJlZCBpbnRlcm5hbCBpZC5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEFwcGxpZWQgaWQuXHJcblx0XHQgKi9cclxuXHRcdF9zZXRfZmllbGRfaWQoIGZpZWxkX2VsLCBuZXdJZFJhdyApIHtcclxuXHRcdFx0Y29uc3QgdW5pcXVlID0gdGhpcy5pZC5zZXRfZmllbGRfaWQoIGZpZWxkX2VsLCBuZXdJZFJhdywgLypyZW5kZXJQcmV2aWV3Ki8gZmFsc2UgKTtcclxuXHRcdFx0aWYgKCB0aGlzLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9wcmV2aWV3KCBmaWVsZF9lbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB1bmlxdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZmllbGQncyBSRVFVSVJFRCBIVE1MIG5hbWUgKGRhdGEtbmFtZSkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZmllbGRfZWwgLSBUYXJnZXQgZmllbGQgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBuZXdOYW1lUmF3IC0gRGVzaXJlZCBIVE1MIG5hbWUuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBBcHBsaWVkIHVuaXF1ZSBuYW1lLlxyXG5cdFx0ICovXHJcblx0XHRfc2V0X2ZpZWxkX25hbWUoIGZpZWxkX2VsLCBuZXdOYW1lUmF3ICkge1xyXG5cdFx0XHRjb25zdCB1bmlxdWUgPSB0aGlzLmlkLnNldF9maWVsZF9uYW1lKCBmaWVsZF9lbCwgbmV3TmFtZVJhdywgLypyZW5kZXJQcmV2aWV3Ki8gZmFsc2UgKTtcclxuXHRcdFx0aWYgKCB0aGlzLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9wcmV2aWV3KCBmaWVsZF9lbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB1bmlxdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZmllbGQncyBPUFRJT05BTCBIVE1MIGlkIChkYXRhLWh0bWxfaWQpLiBFbXB0eSByZW1vdmVzIGl0LiBFbnN1cmVzIHNhbml0aXphdGlvbiBhbmQgdW5pcXVlbmVzcyBhbW9uZyBvdGhlciBmaWVsZHMgdGhhdCBkZWNsYXJlZCBIVE1MIGlkcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIFRhcmdldCBmaWVsZCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5ld0h0bWxJZFJhdyAtIERlc2lyZWQgSFRNTCBpZCAob3B0aW9uYWwpLlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gQXBwbGllZCBodG1sX2lkIG9yIGVtcHR5IHN0cmluZy5cclxuXHRcdCAqL1xyXG5cdFx0X3NldF9maWVsZF9odG1sX2lkKCBmaWVsZF9lbCwgbmV3SHRtbElkUmF3ICkge1xyXG5cdFx0XHRjb25zdCBhcHBsaWVkID0gdGhpcy5pZC5zZXRfZmllbGRfaHRtbF9pZCggZmllbGRfZWwsIG5ld0h0bWxJZFJhdywgLypyZW5kZXJQcmV2aWV3Ki8gZmFsc2UgKTtcclxuXHRcdFx0aWYgKCB0aGlzLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9wcmV2aWV3KCBmaWVsZF9lbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBhcHBsaWVkO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vID09IEFjY2Vzc2liaWxpdHkgPT1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIExpZ2h0d2VpZ2h0IEFSSUEtbGl2ZSBhbm5vdW5jZXIgZm9yIGFjY2Vzc2liaWxpdHkvc3RhdHVzIG1lc3NhZ2VzLlxyXG5cdFx0ICogS2VwdCBsb2NhbCB0byB0aGUgYnVpbGRlciBzbyBjYWxsZXJzIGNhbiBzYWZlbHkgdXNlIGl0LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1zZ1xyXG5cdFx0ICovXHJcblx0XHRfYW5ub3VuY2UobXNnKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0bGV0IGxpdmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hcmlhX2xpdmUnICk7XHJcblx0XHRcdFx0aWYgKCAhbGl2ZSApIHtcclxuXHRcdFx0XHRcdGxpdmUgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0XHRcdFx0bGl2ZS5pZCA9ICd3cGJjX2JmYl9fYXJpYV9saXZlJztcclxuXHRcdFx0XHRcdGxpdmUuc2V0QXR0cmlidXRlKCAnYXJpYS1saXZlJywgJ3BvbGl0ZScgKTtcclxuXHRcdFx0XHRcdGxpdmUuc2V0QXR0cmlidXRlKCAnYXJpYS1hdG9taWMnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRcdGxpdmUuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG5cdFx0XHRcdFx0bGl2ZS5zdHlsZS5sZWZ0ICAgICA9ICctOTk5OXB4JztcclxuXHRcdFx0XHRcdGxpdmUuc3R5bGUudG9wICAgICAgPSAnYXV0byc7XHJcblx0XHRcdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBsaXZlICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGxpdmUudGV4dENvbnRlbnQgPSAnJztcclxuXHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdFx0XHRsaXZlLnRleHRDb250ZW50ID0gU3RyaW5nKCBtc2cgfHwgJycgKTtcclxuXHRcdFx0XHR9LCAxMCApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHQvLyBuby1vcDogbm9uLWZhdGFsIFVYIGhlbHBlci5cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2VudHJhbCBwbGFjZSB0byByZWdpc3RlciBET00gbGlzdGVuZXJzIGZvciBsYXRlciB0ZWFyZG93bi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtFdmVudFRhcmdldH0gdGFyZ2V0IC0gVGFyZ2V0IHRvIGJpbmQgb24uXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIEV2ZW50IHR5cGUuXHJcblx0XHQgKiBAcGFyYW0ge0V2ZW50TGlzdGVuZXJ9IGhhbmRsZXIgLSBIYW5kbGVyIGZ1bmN0aW9uLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufEFkZEV2ZW50TGlzdGVuZXJPcHRpb25zfSBbb3B0cz1mYWxzZV0gLSBMaXN0ZW5lciBvcHRpb25zLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9vbiggdGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRzID0gZmFsc2UgKSB7XHJcblx0XHRcdGlmICggISB0aGlzLl9oYW5kbGVycyApIHtcclxuXHRcdFx0XHR0aGlzLl9oYW5kbGVycyA9IFtdO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCB0eXBlLCBoYW5kbGVyLCBvcHRzICk7XHJcblx0XHRcdHRoaXMuX2hhbmRsZXJzLnB1c2goIHsgdGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRzIH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBMb2FkIGEgbW9kdWxlIGFuZCBpbml0aWFsaXplIGl0LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259IE1vZHVsZV9DbGFzcyAtIE1vZHVsZSBjbGFzcyByZWZlcmVuY2UuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnMgPSB7fV0gLSBPcHRpb25hbCBtb2R1bGUgb3B0aW9ucy5cclxuXHRcdCAqIEByZXR1cm5zIHtXUEJDX0JGQl9Nb2R1bGV9XHJcblx0XHQgKi9cclxuXHRcdHVzZV9tb2R1bGUoTW9kdWxlX0NsYXNzLCBvcHRpb25zID0ge30pIHtcclxuXHRcdFx0Y29uc3QgbW9kID0gbmV3IE1vZHVsZV9DbGFzcyggdGhpcywgb3B0aW9ucyApO1xyXG5cdFx0XHRpZiAoIHR5cGVvZiBtb2QuaW5pdCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRtb2QuaW5pdCgpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX21vZHVsZXMucHVzaCggbW9kICk7XHJcblx0XHRcdHJldHVybiBtb2Q7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXNwb3NlIGFsbCBsaXN0ZW5lcnMsIG9ic2VydmVycywgYW5kIFNvcnRhYmxlIGluc3RhbmNlcyBjcmVhdGVkIGJ5IHRoZSBidWlsZGVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHQvLyBNdXRhdGlvbiBvYnNlcnZlci5cclxuXHRcdFx0aWYgKCB0aGlzLl91c2FnZV9vYnNlcnZlciApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0dGhpcy5fdXNhZ2Vfb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRcdC8vIE5vLW9wLlxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0aGlzLl91c2FnZV9vYnNlcnZlciA9IG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFJlZ2lzdGVyZWQgRE9NIGxpc3RlbmVycy5cclxuXHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCB0aGlzLl9oYW5kbGVycyApICkge1xyXG5cdFx0XHRcdHRoaXMuX2hhbmRsZXJzLmZvckVhY2goICh7IHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0cyB9KSA9PiB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHR0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lciggdHlwZSwgaGFuZGxlciwgb3B0cyApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdFx0XHQvLyBOby1vcC5cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0dGhpcy5faGFuZGxlcnMgPSBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gU29ydGFibGUgaW5zdGFuY2VzLlxyXG5cdFx0XHRpZiAoIHRoaXMuc29ydGFibGUgJiYgdHlwZW9mIHRoaXMuc29ydGFibGUuZGVzdHJveUFsbCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR0aGlzLnNvcnRhYmxlLmRlc3Ryb3lBbGwoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGVzdHJveSByZWdpc3RlcmVkIG1vZHVsZXMuXHJcblx0XHRcdGlmICggQXJyYXkuaXNBcnJheSggdGhpcy5fbW9kdWxlcyApICkge1xyXG5cdFx0XHRcdGZvciAoIGNvbnN0IG1vZCBvZiB0aGlzLl9tb2R1bGVzICkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0aWYgKCB0eXBlb2YgbW9kLmRlc3Ryb3kgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFx0bW9kLmRlc3Ryb3koKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMuX21vZHVsZXMgPSBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gTGl2ZSByZWdpb24gY2FuIHN0YXkgZm9yIHRoZSBwYWdlIGxpZmV0aW1lOyByZW1vdmUgaWYgeW91IHdhbnQgZnVsbCBjbGVhbnVwLlxyXG5cdFx0XHQvLyBpZiAoIHRoaXMuX2FyaWFfbGl2ZSAmJiB0aGlzLl9hcmlhX2xpdmUucGFyZW50Tm9kZSApIHtcclxuXHRcdFx0Ly8gXHR0aGlzLl9hcmlhX2xpdmUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggdGhpcy5fYXJpYV9saXZlICk7XHJcblx0XHRcdC8vIFx0dGhpcy5fYXJpYV9saXZlID0gbnVsbDtcclxuXHRcdFx0Ly8gfVxyXG5cclxuXHRcdFx0Ly8gQ2xlYXIgZ2xvYmFscyB0byBoZWxwIEdDLlxyXG5cdFx0XHR0aGlzLmluc3BlY3RvciA9IG51bGw7XHJcblx0XHRcdHRoaXMucGFnZXNfY29udGFpbmVyID0gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEluaXRpYWxpemUgU29ydGFibGVKUyBvbiBhIGNvbnRhaW5lciBmb3IgZmllbGRzIG9yIHNlY3Rpb25zLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lciAtIFRhcmdldCBET00gZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259IFtvbl9hZGRfY2FsbGJhY2tdIC0gT3B0aW9uYWwgY3VzdG9tIGhhbmRsZXIgZm9yIG9uQWRkLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGluaXRfc29ydGFibGUoIGNvbnRhaW5lciwgb25fYWRkX2NhbGxiYWNrID0gdGhpcy5oYW5kbGVfb25fYWRkLmJpbmQoIHRoaXMgKSApIHtcclxuXHRcdFx0aWYgKCAhIGNvbnRhaW5lciApIHJldHVybjtcclxuXHRcdFx0aWYgKCB0eXBlb2YgU29ydGFibGUgPT09ICd1bmRlZmluZWQnICkgcmV0dXJuO1xyXG5cdFx0XHR0aGlzLnNvcnRhYmxlLmVuc3VyZSggY29udGFpbmVyLCAnY2FudmFzJywgeyBvbkFkZDogb25fYWRkX2NhbGxiYWNrIH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhhbmRsZXIgd2hlbiBhbiBpdGVtIGlzIGFkZGVkIHZpYSBkcmFnLWFuZC1kcm9wLlxyXG5cdFx0ICogQXBwbGllcyB1c2FnZSBsaW1pdHMsIG5lc3RpbmcgY2hlY2tzLCBhbmQgYnVpbGRzIG5ldyBmaWVsZCBpZiBuZWVkZWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGV2dCAtIFNvcnRhYmxlSlMgZXZlbnQgb2JqZWN0LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGhhbmRsZV9vbl9hZGQoIGV2dCApIHtcclxuXHRcdFx0aWYgKCAhIGV2dCB8fCAhIGV2dC5pdGVtIHx8ICEgZXZ0LnRvICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IGVsID0gZXZ0Lml0ZW07XHJcblxyXG5cdFx0XHQvLyAtLS0gU2VjdGlvbiBwYXRoLiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0aWYgKCBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRjb25zdCBuZXN0aW5nX2xldmVsID0gdGhpcy5nZXRfbmVzdGluZ19sZXZlbCggZWwgKTtcclxuXHRcdFx0XHRpZiAoIG5lc3RpbmdfbGV2ZWwgPj0gdGhpcy5tYXhfbmVzdGVkX3ZhbHVlICkge1xyXG5cdFx0XHRcdFx0YWxlcnQoICdUb28gbWFueSBuZXN0ZWQgc2VjdGlvbnMuJyApO1xyXG5cdFx0XHRcdFx0ZWwucmVtb3ZlKCk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMuaW5pdF9hbGxfbmVzdGVkX3NvcnRhYmxlcyggZWwgKTtcclxuXHRcdFx0XHR0aGlzLnVzYWdlLnVwZGF0ZV9wYWxldHRlX3VpKCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAtLS0gRmllbGQgcGF0aC4gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0Y29uc3QgaXNfZnJvbV9wYWxldHRlID0gdGhpcy5wYWxldHRlX3Vscz8uaW5jbHVkZXM/LihldnQuZnJvbSk7XHJcblx0XHRcdGNvbnN0IHBhbGV0dGVJZCAgICAgICA9IGVsPy5kYXRhc2V0Py5pZDtcclxuXHJcblx0XHRcdGlmICggISBwYWxldHRlSWQgKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnRHJvcHBlZCBlbGVtZW50IG1pc3NpbmcgZGF0YS1pZC4nLCBlbCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBpc19mcm9tX3BhbGV0dGUgKSB7XHJcblx0XHRcdFx0Ly8gUmVhZCBkYXRhIGJlZm9yZSByZW1vdmluZyB0aGUgdGVtcG9yYXJ5IGNsb25lLlxyXG5cdFx0XHRcdGNvbnN0IGZpZWxkX2RhdGEgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGVsICk7XHJcblx0XHRcdFx0Y29uc3QgdXNhZ2Vfa2V5ICA9IHBhbGV0dGVJZDtcclxuXHRcdFx0XHRmaWVsZF9kYXRhLnVzYWdlX2tleSA9IHVzYWdlX2tleTtcclxuXHJcblx0XHRcdFx0Ly8gUmVtb3ZlIFNvcnRhYmxlJ3MgdGVtcG9yYXJ5IGNsb25lIHNvIGNvdW50cyBhcmUgYWNjdXJhdGUuXHJcblx0XHRcdFx0ZWwucmVtb3ZlKCk7XHJcblxyXG5cdFx0XHRcdC8vIENlbnRyYWxpemVkIHVzYWdlIGdhdGUuXHJcblx0XHRcdFx0aWYgKCAhIHRoaXMudXNhZ2UuZ2F0ZV9vcl9hbGVydCggdXNhZ2Vfa2V5LCB7IGxhYmVsOiBmaWVsZF9kYXRhLmxhYmVsIHx8IHVzYWdlX2tleSB9ICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBCdWlsZCBhbmQgaW5zZXJ0IHRoZSByZWFsIGZpZWxkIG5vZGUgYXQgdGhlIGludGVuZGVkIGluZGV4LlxyXG5cdFx0XHRcdGNvbnN0IHJlYnVpbHQgPSB0aGlzLmJ1aWxkX2ZpZWxkKCBmaWVsZF9kYXRhICk7XHJcblx0XHRcdFx0aWYgKCAhIHJlYnVpbHQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCBzZWxlY3RvciAgICAgICA9IFNvcnRhYmxlLmdldCggZXZ0LnRvICk/Lm9wdGlvbnM/LmRyYWdnYWJsZSB8fCAnLndwYmNfYmZiX19maWVsZCwgLndwYmNfYmZiX19zZWN0aW9uJztcclxuXHRcdFx0XHRjb25zdCBzY29wZWRTZWxlY3RvciA9IHNlbGVjdG9yLnNwbGl0KCAnLCcgKS5tYXAoIHMgPT4gYDpzY29wZSA+ICR7cy50cmltKCl9YCApLmpvaW4oICcsICcgKTtcclxuXHRcdFx0XHRjb25zdCBkcmFnZ2FibGVzICAgICA9IEFycmF5LmZyb20oIGV2dC50by5xdWVyeVNlbGVjdG9yQWxsKCBzY29wZWRTZWxlY3RvciApICk7XHJcblx0XHRcdFx0Y29uc3QgYmVmb3JlICAgICAgICAgPSBOdW1iZXIuaXNJbnRlZ2VyKCBldnQubmV3SW5kZXggKSA/IChkcmFnZ2FibGVzW2V2dC5uZXdJbmRleF0gPz8gbnVsbCkgOiBudWxsO1xyXG5cclxuXHRcdFx0XHRldnQudG8uaW5zZXJ0QmVmb3JlKCByZWJ1aWx0LCBiZWZvcmUgKTtcclxuXHRcdFx0XHRlbCA9IHJlYnVpbHQ7IC8vIENvbnRpbnVlIHdpdGggdGhlIHVuaWZpZWQgcGF0aCBiZWxvdy5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvLyBNb3ZpbmcgYW4gZXhpc3RpbmcgZmllbGQgd2l0aGluIHRoZSBjYW52YXMuIE5vIHVzYWdlIGRlbHRhIGhlcmUuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZpbmFsaXplOiBkZWNvcmF0ZSwgZW1pdCwgaG9vaywgYW5kIHNlbGVjdC5cclxuXHRcdFx0dGhpcy5kZWNvcmF0ZV9maWVsZCggZWwgKTtcclxuXHRcdFx0dGhpcy5fZW1pdF9jb25zdCggV1BCQ19CRkJfRXZlbnRzLkZJRUxEX0FERCwgeyBlbCwgZGF0YTogV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBlbCApIH0gKTtcclxuXHRcdFx0dGhpcy51c2FnZS51cGRhdGVfcGFsZXR0ZV91aSgpO1xyXG5cdFx0XHR0aGlzLnRyaWdnZXJfZmllbGRfZHJvcF9jYWxsYmFjayggZWwsICdkcm9wJyApO1xyXG5cdFx0XHR0aGlzLnNlbGVjdF9maWVsZCggZWwsIHsgc2Nyb2xsSW50b1ZpZXc6IHRydWUgfSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2FsbCBzdGF0aWMgb25fZmllbGRfZHJvcCBtZXRob2QgZm9yIHN1cHBvcnRlZCBmaWVsZCB0eXBlcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIEZpZWxkIGVsZW1lbnQgdG8gaGFuZGxlLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGNvbnRleHQgLSBDb250ZXh0IG9mIHRoZSBldmVudDogJ2Ryb3AnIHwgJ2xvYWQnIHwgJ3ByZXZpZXcnLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHRyaWdnZXJfZmllbGRfZHJvcF9jYWxsYmFjayggZmllbGRfZWwsIGNvbnRleHQgPSAnZHJvcCcgKSB7XHJcblx0XHRcdGlmICggISBmaWVsZF9lbCB8fCAhIGZpZWxkX2VsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGZpZWxkX2RhdGEgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGZpZWxkX2VsICk7XHJcblxyXG5cdFx0XHRjb25zdCB0eXBlID0gZmllbGRfZGF0YS50eXBlO1xyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBGaWVsZENsYXNzID0gdGhpcy5fZ2V0UmVuZGVyZXIodHlwZSk7XHJcblx0XHRcdFx0aWYgKCBGaWVsZENsYXNzICYmIHR5cGVvZiBGaWVsZENsYXNzLm9uX2ZpZWxkX2Ryb3AgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRGaWVsZENsYXNzLm9uX2ZpZWxkX2Ryb3AoIGZpZWxkX2RhdGEsIGZpZWxkX2VsLCB7IGNvbnRleHQgfSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIGVyciApIHtcclxuXHRcdFx0XHRjb25zb2xlLndhcm4oIGBvbl9maWVsZF9kcm9wIGZhaWxlZCBmb3IgdHlwZSBcIiR7dHlwZX1cIi5gLCBlcnIgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2FsY3VsYXRlIG5lc3RpbmcgZGVwdGggb2YgYSBzZWN0aW9uIGJhc2VkIG9uIHBhcmVudCBoaWVyYXJjaHkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbCAtIFRhcmdldCBzZWN0aW9uIGVsZW1lbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfSBOZXN0aW5nIGRlcHRoICgwID0gdG9wLWxldmVsKS5cclxuXHRcdCAqL1xyXG5cdFx0Z2V0X25lc3RpbmdfbGV2ZWwoIHNlY3Rpb25fZWwgKSB7XHJcblx0XHRcdGxldCBsZXZlbCAgPSAwO1xyXG5cdFx0XHRsZXQgcGFyZW50ID0gc2VjdGlvbl9lbC5jbG9zZXN0KCAnLndwYmNfYmZiX19jb2x1bW4nICk7XHJcblxyXG5cdFx0XHR3aGlsZSAoIHBhcmVudCApIHtcclxuXHRcdFx0XHRjb25zdCBvdXRlciA9IHBhcmVudC5jbG9zZXN0KCAnLndwYmNfYmZiX19zZWN0aW9uJyApO1xyXG5cdFx0XHRcdGlmICggISBvdXRlciApIHtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRsZXZlbCsrO1xyXG5cdFx0XHRcdHBhcmVudCA9IG91dGVyLmNsb3Nlc3QoICcud3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gbGV2ZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYSBmaWVsZCBET00gZWxlbWVudCBmcm9tIHN0cnVjdHVyZWQgZGF0YS5cclxuXHRcdCAqIEFwcGxpZXMgbGFiZWwsIHR5cGUsIGRyYWcgaGFuZGxlLCBhbmQgdmlzdWFsIG1vZGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGZpZWxkX2RhdGEgLSBGaWVsZCBwcm9wZXJ0aWVzIChpZCwgdHlwZSwgbGFiZWwsIGV0Yy4pLlxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fG51bGx9IEJ1aWx0IGZpZWxkIGVsZW1lbnQsIG9yIG51bGwgb24gZXJyb3IvbGltaXQuXHJcblx0XHQgKi9cclxuXHRcdGJ1aWxkX2ZpZWxkKCBmaWVsZF9kYXRhICkge1xyXG5cdFx0XHRpZiAoICEgZmllbGRfZGF0YSB8fCB0eXBlb2YgZmllbGRfZGF0YSAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnSW52YWxpZCBmaWVsZCBkYXRhOicsIGZpZWxkX2RhdGEgKTtcclxuXHRcdFx0XHRyZXR1cm4gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19maWVsZCBpcy1pbnZhbGlkJywgJ0ludmFsaWQgZmllbGQnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIERlY2lkZSBhIGRlc2lyZWQgaWQgZmlyc3QgKG1heSBjb21lIGZyb20gdXNlci9wYWxldHRlKS5cclxuXHRcdFx0bGV0IGRlc2lyZWRJZFJhdztcclxuXHRcdFx0aWYgKCAhIGZpZWxkX2RhdGEuaWQgfHwgJycgPT09IFN0cmluZyggZmllbGRfZGF0YS5pZCApLnRyaW0oKSApIHtcclxuXHRcdFx0XHRjb25zdCBiYXNlICAgPSAoZmllbGRfZGF0YS5sYWJlbCA/IFN0cmluZyggZmllbGRfZGF0YS5sYWJlbCApIDogKGZpZWxkX2RhdGEudHlwZSB8fCAnZmllbGQnKSlcclxuXHRcdFx0XHRcdC50b0xvd2VyQ2FzZSgpXHJcblx0XHRcdFx0XHQucmVwbGFjZSggL1teYS16MC05XSsvZywgJy0nIClcclxuXHRcdFx0XHRcdC5yZXBsYWNlKCAvXi0rfC0rJC9nLCAnJyApO1xyXG5cdFx0XHRcdGRlc2lyZWRJZFJhdyA9IGAke2Jhc2UgfHwgJ2ZpZWxkJ30tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCA3ICl9YDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRkZXNpcmVkSWRSYXcgPSBTdHJpbmcoIGZpZWxkX2RhdGEuaWQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gU2FuaXRpemUgdGhlIGlkIHRoZSB1c2VyIHByb3ZpZGVkLlxyXG5cdFx0XHRjb25zdCBkZXNpcmVkSWQgPSBXUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCBkZXNpcmVkSWRSYXcgKTtcclxuXHJcblx0XHRcdC8vIFVzYWdlIGtleSByZW1haW5zIHN0YWJsZSAocGFsZXR0ZSBzZXRzIHVzYWdlX2tleTsgb3RoZXJ3aXNlIHVzZSAqcmF3KiB1c2VyIGludGVudCkuXHJcblx0XHRcdGxldCB1c2FnZUtleSA9IGZpZWxkX2RhdGEudXNhZ2Vfa2V5IHx8IGZpZWxkX2RhdGEudHlwZSB8fCBkZXNpcmVkSWRSYXc7XHJcblx0XHRcdC8vIE5vcm1hbGl6ZSBjb21tb24gYWxpYXNlcyB0byBwYWxldHRlIGlkcyAoZXh0ZW5kIGFzIG5lZWRlZCkuXHJcblx0XHRcdGlmICggdXNhZ2VLZXkgPT09ICdpbnB1dC10ZXh0JyApIHtcclxuXHRcdFx0XHR1c2FnZUtleSA9ICd0ZXh0JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRW5zdXJlIHRoZSBET00vZGF0YS1pZCB3ZSBhY3R1YWxseSB1c2UgaXMgdW5pcXVlIChwb3N0LXNhbml0aXphdGlvbikuXHJcblx0XHRcdGZpZWxkX2RhdGEuaWQgPSB0aGlzLmlkLmVuc3VyZV91bmlxdWVfZmllbGRfaWQoIGRlc2lyZWRJZCApO1xyXG5cclxuXHRcdFx0Ly8gRW5zdXJlIG5hbWUgZXhpc3RzLCBzYW5pdGl6ZWQsIGFuZCB1bmlxdWUuXHJcblx0XHRcdGxldCBkZXNpcmVkTmFtZSA9IChmaWVsZF9kYXRhLm5hbWUgIT0gbnVsbCkgPyBmaWVsZF9kYXRhLm5hbWUgOiBmaWVsZF9kYXRhLmlkO1xyXG5cdFx0XHRkZXNpcmVkTmFtZSAgICAgPSBXUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX25hbWUoIGRlc2lyZWROYW1lICk7XHJcblx0XHRcdGZpZWxkX2RhdGEubmFtZSA9IHRoaXMuaWQuZW5zdXJlX3VuaXF1ZV9maWVsZF9uYW1lKCBkZXNpcmVkTmFtZSApO1xyXG5cclxuXHRcdFx0Ly8gQ2hlY2sgdXNhZ2UgY291bnQuXHJcblx0XHRcdGlmICggISB0aGlzLnVzYWdlLmlzX3VzYWdlX29rKCB1c2FnZUtleSApICkge1xyXG5cdFx0XHRcdGNvbnNvbGUud2FybiggYEZpZWxkIFwiJHt1c2FnZUtleX1cIiBza2lwcGVkIOKAkyBleGNlZWRzIHVzYWdlIGxpbWl0LmAgKTtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgZWwgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHQvLyBPbmx5IHRoaXMgYnVpbGRlciBVSUQuXHJcblx0XHRcdGNvbnN0IHVpZCA9IGBmLSR7Kyt0aGlzLl91aWRfY291bnRlcn0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDcgKX1gO1xyXG5cdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLXVpZCcsIHVpZCApO1xyXG5cdFx0XHRXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuc2V0X2RhdGFfYXR0cmlidXRlcyggZWwsIHsgLi4uZmllbGRfZGF0YSwgdXNhZ2Vfa2V5OiB1c2FnZUtleSB9ICk7XHJcblxyXG5cdFx0XHQvLyByZWZsZWN0IG1pbiB3aWR0aCAocHVyZWx5IHZpc3VhbDsgcmVzaXppbmcgZW5mb3JjZW1lbnQgaGFwcGVucyBpbiB0aGUgcmVzaXplcikuXHJcblx0XHRcdGNvbnN0IG1pbl9yYXcgPSBTdHJpbmcoIGZpZWxkX2RhdGEubWluX3dpZHRoIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0XHRpZiAoIG1pbl9yYXcgKSB7XHJcblx0XHRcdFx0Ly8gbGV0IENTUyBkbyB0aGUgcGFyc2luZzogc3VwcG9ydHMgcHgsICUsIHJlbSwgZXRjLlxyXG5cdFx0XHRcdGVsLnN0eWxlLm1pbldpZHRoID0gbWluX3JhdztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZWwuaW5uZXJIVE1MID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLnJlbmRlcl9maWVsZF9pbm5lcl9odG1sKCBmaWVsZF9kYXRhICk7XHJcblx0XHRcdHRoaXMuZGVjb3JhdGVfZmllbGQoIGVsICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbmhhbmNlIGEgZmllbGQgZWxlbWVudCB3aXRoIGRyYWcgaGFuZGxlLCBkZWxldGUsIG1vdmUgYnV0dG9ucywgb3IgcHJldmlldy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIFRhcmdldCBmaWVsZCBlbGVtZW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGRlY29yYXRlX2ZpZWxkKCBmaWVsZF9lbCApIHtcclxuXHRcdFx0aWYgKCAhIGZpZWxkX2VsIHx8IGZpZWxkX2VsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZmllbGRfZWwuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19maWVsZCcgKTtcclxuXHRcdFx0ZmllbGRfZWwuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19kcmFnLWFueXdoZXJlJyApOyAvLyBMZXRzIGdyYWIgdGhlIGZpZWxkIGNhcmQgaXRzZWxmIHRvIGRyYWcgKG91dHNpZGUgb2Ygb3ZlcmxheSAvIGlucHV0cykuXHJcblxyXG5cdFx0XHQvLyBSZW5kZXIuXHJcblx0XHRcdGlmICggdGhpcy5wcmV2aWV3X21vZGUgKSB7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXJfcHJldmlldyggZmllbGRfZWwgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLmFkZF9vdmVybGF5X3Rvb2xiYXIoIGZpZWxkX2VsICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFkZCBvdmVybGF5IHRvb2xiYXIgdG8gYSBmaWVsZC9zZWN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkX2VsIC0gRmllbGQgb3Igc2VjdGlvbiBlbGVtZW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGFkZF9vdmVybGF5X3Rvb2xiYXIoZmllbGRfZWwpIHtcclxuXHRcdFx0V1BCQ19CRkJfT3ZlcmxheS5lbnN1cmUoIHRoaXMsIGZpZWxkX2VsICk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVuZGVyIGEgc2ltcGxpZmllZCB2aXN1YWwgcmVwcmVzZW50YXRpb24gb2YgYSBmaWVsZCAoUHJldmlldyBNb2RlKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIFRhcmdldCBmaWVsZCBlbGVtZW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHJlbmRlcl9wcmV2aWV3KCBmaWVsZF9lbCApIHtcclxuXHRcdFx0aWYgKCAhIGZpZWxkX2VsIHx8ICEgdGhpcy5wcmV2aWV3X21vZGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBkYXRhICAgICAgICAgICAgID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBmaWVsZF9lbCApO1xyXG5cdFx0XHRjb25zdCB0eXBlICAgICAgICAgICAgID0gZGF0YS50eXBlO1xyXG5cdFx0XHRjb25zdCBpZCAgICAgICAgICAgICAgID0gZGF0YS5pZCB8fCAnJztcclxuXHRcdFx0Y29uc3QgaGFzRXhwbGljaXRMYWJlbCA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZGF0YSwgJ2xhYmVsJyApO1xyXG5cdFx0XHRjb25zdCBsYWJlbCAgICAgICAgICAgID0gaGFzRXhwbGljaXRMYWJlbCA/IGRhdGEubGFiZWwgOiBpZDtcclxuXHJcblx0XHRcdGxldCBpbnB1dF9odG1sID0gJyc7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IEZpZWxkQ2xhc3MgPSB0aGlzLl9nZXRSZW5kZXJlcih0eXBlKTtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBGaWVsZENsYXNzID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgZmllbGRJbnN0YW5jZSA9IG5ldyBGaWVsZENsYXNzKCBkYXRhLCBsYWJlbCwgaWQgKTtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGZpZWxkSW5zdGFuY2UucmVuZGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRpbnB1dF9odG1sID0gZmllbGRJbnN0YW5jZS5yZW5kZXIoKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybiggYFJlbmRlcmVyIGZvciBcIiR7dHlwZX1cIiBoYXMgbm8gcmVuZGVyKCkgbWV0aG9kLmAgKTtcclxuXHRcdFx0XHRcdFx0aW5wdXRfaHRtbCA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5yZW5kZXJfZmllbGRfaW5uZXJfaHRtbCggZGF0YSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGUgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybiggYE5vIHJlbmRlcmVyIGZvdW5kIGZvciBmaWVsZCB0eXBlOiAke3R5cGV9LmAgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlucHV0X2h0bWwgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIucmVuZGVyX2ZpZWxkX2lubmVyX2h0bWwoIGRhdGEgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1JlbmRlcmVyIGVycm9yLicsIGVyciApO1xyXG5cdFx0XHRcdGlucHV0X2h0bWwgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIucmVuZGVyX2ZpZWxkX2lubmVyX2h0bWwoIGRhdGEgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZmllbGRfZWwuaW5uZXJIVE1MID0gaW5wdXRfaHRtbDtcclxuXHRcdFx0ZmllbGRfZWwuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19wcmV2aWV3LXJlbmRlcmVkJyApO1xyXG5cdFx0XHR0aGlzLmFkZF9vdmVybGF5X3Rvb2xiYXIoIGZpZWxkX2VsICk7XHJcblxyXG5cdFx0XHQvLyBPcHRpb25hbCBob29rIGFmdGVyIERPTSBpcyBpbiBwbGFjZS5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBGaWVsZENsYXNzID0gdGhpcy5fZ2V0UmVuZGVyZXIodHlwZSk7XHJcblx0XHRcdFx0aWYgKCBGaWVsZENsYXNzICYmIHR5cGVvZiBGaWVsZENsYXNzLmFmdGVyX3JlbmRlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdEZpZWxkQ2xhc3MuYWZ0ZXJfcmVuZGVyKCBkYXRhLCBmaWVsZF9lbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIGVycjIgKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnYWZ0ZXJfcmVuZGVyIGhvb2sgZmFpbGVkLicsIGVycjIgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTW92ZSBhbiBlbGVtZW50IChmaWVsZC9zZWN0aW9uKSB1cCBvciBkb3duIGluIGl0cyBwYXJlbnQgY29udGFpbmVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIC0gVGFyZ2V0IGVsZW1lbnQgdG8gbW92ZS5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gLSAndXAnIG9yICdkb3duJy5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRtb3ZlX2l0ZW0oIGVsLCBkaXJlY3Rpb24gKSB7XHJcblx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IGVsPy5wYXJlbnRFbGVtZW50O1xyXG5cdFx0XHRpZiAoICEgY29udGFpbmVyICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qgc2libGluZ3MgPSBBcnJheS5mcm9tKCBjb250YWluZXIuY2hpbGRyZW4gKS5maWx0ZXIoICggY2hpbGQgKSA9PlxyXG5cdFx0XHRcdGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSB8fCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0Y29uc3QgY3VycmVudF9pbmRleCA9IHNpYmxpbmdzLmluZGV4T2YoIGVsICk7XHJcblx0XHRcdGlmICggY3VycmVudF9pbmRleCA9PT0gLTEgKSB7XHJcblx0XHRcdCByZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IG5ld19pbmRleCA9IGRpcmVjdGlvbiA9PT0gJ3VwJyA/IGN1cnJlbnRfaW5kZXggLSAxIDogY3VycmVudF9pbmRleCArIDE7XHJcblx0XHRcdGlmICggbmV3X2luZGV4IDwgMCB8fCBuZXdfaW5kZXggPj0gc2libGluZ3MubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgcmVmZXJlbmNlX25vZGUgPSBzaWJsaW5nc1tuZXdfaW5kZXhdO1xyXG5cdFx0XHRpZiAoIGRpcmVjdGlvbiA9PT0gJ3VwJyApIHtcclxuXHRcdFx0XHRjb250YWluZXIuaW5zZXJ0QmVmb3JlKCBlbCwgcmVmZXJlbmNlX25vZGUgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGRpcmVjdGlvbiA9PT0gJ2Rvd24nICkge1xyXG5cdFx0XHRcdGNvbnRhaW5lci5pbnNlcnRCZWZvcmUoIGVsLCByZWZlcmVuY2Vfbm9kZS5uZXh0U2libGluZyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgdGhlIG51bWJlciBvZiBjb2x1bW5zIGZvciBhIGdpdmVuIHNlY3Rpb24gZWxlbWVudC5cclxuXHRcdCAqXHJcblx0XHQgKiAtIEluY3JlYXNpbmc6IGFwcGVuZHMgbmV3IGVtcHR5IGNvbHVtbnMgYW5kIHJlc2l6ZXJzLCAocmUpaW5pdHMgU29ydGFibGUsIGFuZCBlcXVhbGl6ZXMgd2lkdGhzLlxyXG5cdFx0ICogLSBEZWNyZWFzaW5nOiBtb3ZlcyBjaGlsZHJlbiBvZiByZW1vdmVkIGNvbHVtbnMgaW50byB0aGUgcHJldmlvdXMgY29sdW1uLCByZW1vdmVzIGNvbHVtbnMvcmVzaXplcnMsIHJlZnJlc2hlcyBTb3J0YWJsZSwgYW5kIGVxdWFsaXplcyB3aWR0aHMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbCAtIFRoZSAud3BiY19iZmJfX3NlY3Rpb24gZWxlbWVudCB0byBtdXRhdGUuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbmV3X2NvdW50X3JhdyAtIERlc2lyZWQgY29sdW1uIGNvdW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHNldF9zZWN0aW9uX2NvbHVtbnMoIHNlY3Rpb25fZWwsIG5ld19jb3VudF9yYXcgKSB7XHJcblx0XHRcdGlmICggISBzZWN0aW9uX2VsIHx8ICEgc2VjdGlvbl9lbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRpZiAoICEgcm93ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gTm9ybWFsaXplIGFuZCBjbGFtcCBjb3VudCAoc3VwcG9ydHMgMS4uNDsgZXh0ZW5kIGlmIG5lZWRlZCkuXHJcblx0XHRcdGNvbnN0IG9sZF9jb2xzID0gdGhpcy5fZ2V0X3Jvd19jb2xzKCByb3cgKTtcclxuXHRcdFx0Y29uc3QgY3VycmVudCAgPSBvbGRfY29scy5sZW5ndGggfHwgMTtcclxuXHRcdFx0Y29uc3QgbWluX2MgICAgPSAxO1xyXG5cdFx0XHRjb25zdCBtYXhfYyAgICA9IDQ7XHJcblx0XHRcdGNvbnN0IHRhcmdldCAgID0gTWF0aC5tYXgoIG1pbl9jLCBNYXRoLm1pbiggbWF4X2MsIHBhcnNlSW50KCBuZXdfY291bnRfcmF3LCAxMCApIHx8IGN1cnJlbnQgKSApO1xyXG5cclxuXHRcdFx0aWYgKCB0YXJnZXQgPT09IGN1cnJlbnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBIZWxwZXIgdG8gKHJlKWluc2VydCByZXNpemVycyBiZXR3ZWVuIGNvbHVtbnMuXHJcblx0XHRcdGNvbnN0IHJlYnVpbGRfcmVzaXplcnMgPSAoKSA9PiB7XHJcblx0XHRcdFx0Ly8gUmVtb3ZlIGFsbCBleGlzdGluZyByZXNpemVycy5cclxuXHRcdFx0XHRBcnJheS5mcm9tKCByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uLXJlc2l6ZXInICkgKS5mb3JFYWNoKCByID0+IHIucmVtb3ZlKCkgKTtcclxuXHRcdFx0XHQvLyBSZWluc2VydCBiZXR3ZWVuIGNvbHVtbnMuXHJcblx0XHRcdFx0Y29uc3QgY29scyA9IHRoaXMuX2dldF9yb3dfY29scyggcm93ICk7XHJcblx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgY29scy5sZW5ndGggLSAxOyBpKysgKSB7XHJcblx0XHRcdFx0XHRjb25zdCByZXNpemVyID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19jb2x1bW4tcmVzaXplcicgKTtcclxuXHRcdFx0XHRcdHJlc2l6ZXIuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIHRoaXMuaW5pdF9yZXNpemVfaGFuZGxlciApO1xyXG5cdFx0XHRcdFx0Y29sc1tpXS5pbnNlcnRBZGphY2VudEVsZW1lbnQoICdhZnRlcmVuZCcsIHJlc2l6ZXIgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvLyBJbmNyZWFzaW5nIGNvbHVtbnMgLT4gYXBwZW5kIG5ldyBjb2x1bW5zIGF0IHRoZSBlbmQuXHJcblx0XHRcdGlmICggdGFyZ2V0ID4gY3VycmVudCApIHtcclxuXHRcdFx0XHRmb3IgKCBsZXQgaSA9IGN1cnJlbnQ7IGkgPCB0YXJnZXQ7IGkrKyApIHtcclxuXHRcdFx0XHRcdGNvbnN0IGNvbCA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ2RpdicsICd3cGJjX2JmYl9fY29sdW1uIHdwYmNfX2ZpZWxkJyApO1xyXG5cdFx0XHRcdFx0Ly8gR2l2ZSBpdCBzb21lIGluaXRpYWwgYmFzaXM7IHdpbGwgYmUgbm9ybWFsaXplZCBhZnRlci5cclxuXHRcdFx0XHRcdGNvbC5zdHlsZS5mbGV4QmFzaXMgPSAoIDEwMCAvIHRhcmdldCApICsgJyUnO1xyXG5cdFx0XHRcdFx0Ly8gTWFrZSB0aGlzIGNvbHVtbiBhIGRyb3AgdGFyZ2V0LlxyXG5cdFx0XHRcdFx0dGhpcy5pbml0X3NvcnRhYmxlPy4oIGNvbCApO1xyXG5cdFx0XHRcdFx0cm93LmFwcGVuZENoaWxkKCBjb2wgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmVidWlsZF9yZXNpemVycygpO1xyXG5cdFx0XHRcdC8vIEVxdWFsaXplIHdpZHRocyBjb25zaWRlcmluZyBnYXAuXHJcblx0XHRcdFx0dGhpcy5sYXlvdXQuc2V0X2VxdWFsX2Jhc2VzKCByb3csIHRoaXMuY29sX2dhcF9wZXJjZW50ICk7XHJcblxyXG5cdFx0XHRcdC8vIE92ZXJsYXk6IGVuc3VyZSB0aGUgbGF5b3V0IHByZXNldCBjaGlwcyBhcmUgcHJlc2VudCBmb3IgPjEgY29sdW1ucy5cclxuXHRcdFx0XHR0aGlzLmFkZF9vdmVybGF5X3Rvb2xiYXIoIHNlY3Rpb25fZWwgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIERlY3JlYXNpbmcgY29sdW1ucyAtPiBtZXJnZSBjb250ZW50cyBvZiB0cmFpbGluZyBjb2x1bW5zIGludG8gdGhlIHByZXZpb3VzIG9uZSwgdGhlbiByZW1vdmUuXHJcblx0XHRcdGlmICggdGFyZ2V0IDwgY3VycmVudCApIHtcclxuXHRcdFx0XHQvLyBXZeKAmWxsIGFsd2F5cyByZW1vdmUgZnJvbSB0aGUgZW5kIGRvd24gdG8gdGhlIHRhcmdldCBjb3VudCxcclxuXHRcdFx0XHQvLyBtb3ZpbmcgYWxsIGNoaWxkcmVuIG9mIHRoZSBsYXN0IGNvbHVtbiBpbnRvIHRoZSBwcmV2aW91cyBjb2x1bW4uXHJcblx0XHRcdFx0Zm9yICggbGV0IGkgPSBjdXJyZW50OyBpID4gdGFyZ2V0OyBpLS0gKSB7XHJcblx0XHRcdFx0XHQvLyBSZWNvbXB1dGUgY3VycmVudCBsaXN0IGVhY2ggaXRlcmF0aW9uLlxyXG5cdFx0XHRcdFx0Y29uc3QgY29sc19ub3cgPSB0aGlzLl9nZXRfcm93X2NvbHMoIHJvdyApO1xyXG5cdFx0XHRcdFx0Y29uc3QgbGFzdCAgICAgPSBjb2xzX25vd1sgY29sc19ub3cubGVuZ3RoIC0gMSBdO1xyXG5cdFx0XHRcdFx0Y29uc3QgcHJldiAgICAgPSBjb2xzX25vd1sgY29sc19ub3cubGVuZ3RoIC0gMiBdIHx8IG51bGw7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBsYXN0ICYmIHByZXYgKSB7XHJcblx0XHRcdFx0XHRcdC8vIE1vdmUgY2hpbGRyZW4gKHNlY3Rpb25zIG9yIGZpZWxkcykgdG8gcHJldmlvdXMgY29sdW1uLlxyXG5cdFx0XHRcdFx0XHR3aGlsZSAoIGxhc3QuZmlyc3RDaGlsZCApIHtcclxuXHRcdFx0XHRcdFx0XHRwcmV2LmFwcGVuZENoaWxkKCBsYXN0LmZpcnN0Q2hpbGQgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHQvLyBSZW1vdmUgbGFzdCBjb2x1bW4uXHJcblx0XHRcdFx0XHRcdGxhc3QucmVtb3ZlKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBSZWJ1aWxkIHJlc2l6ZXJzIGFuZCByZWZyZXNoIFNvcnRhYmxlIG9uIHRoZSBzdXJ2aXZpbmcgY29sdW1ucy5cclxuXHRcdFx0XHRyZWJ1aWxkX3Jlc2l6ZXJzKCk7XHJcblxyXG5cdFx0XHRcdHRoaXMuX2dldF9yb3dfY29scyggcm93ICkuZm9yRWFjaCggY29sID0+IHtcclxuXHRcdFx0XHRcdC8vIElmIFNvcnRhYmxlIG1pc3NpbmcsIGluaXQ7IGlmIHByZXNlbnQsIGRvIG5vdGhpbmcgKFNvcnRhYmxlLmdldCByZXR1cm5zIGluc3RhbmNlKS5cclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIFNvcnRhYmxlICE9PSAndW5kZWZpbmVkJyAmJiAhU29ydGFibGUuZ2V0Py4oIGNvbCApICkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmluaXRfc29ydGFibGU/LiggY29sICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHQvLyBOb3JtYWxpemUgd2lkdGhzLlxyXG5cdFx0XHRcdGNvbnN0IGNvbXB1dGVkID0gdGhpcy5sYXlvdXQuY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3coIHJvdywgdGhpcy5jb2xfZ2FwX3BlcmNlbnQgKTtcclxuXHRcdFx0XHR0aGlzLmxheW91dC5hcHBseV9iYXNlc190b19yb3coIHJvdywgY29tcHV0ZWQuYmFzZXMgKTtcclxuXHJcblx0XHRcdFx0Ly8gT3ZlcmxheTogaGlkZSBsYXlvdXQgcHJlc2V0cyBpZiBzaW5nbGUtY29sdW1uIG5vdzsgZW5zdXJlIHRvb2xiYXIgcmUtY2hlY2tzLlxyXG5cdFx0XHRcdHRoaXMuYWRkX292ZXJsYXlfdG9vbGJhciggc2VjdGlvbl9lbCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWxldGUgYSBmaWVsZCBvciBzZWN0aW9uLCB1cGRhdGUgdXNhZ2UgVUksIGVtaXQgZXZlbnRzLCBhbmQgc2VsZWN0IGEgbmVpZ2hib3IuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgLSAud3BiY19iZmJfX2ZpZWxkIG9yIC53cGJjX2JmYl9fc2VjdGlvblxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGRlbGV0ZV9pdGVtKGVsKSB7XHJcblx0XHRcdGlmICggISBlbCB8fCAhIChlbC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApIHx8IGVsLmNsYXNzTGlzdD8uY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IG5laWdoYm9yID0gdGhpcy5fZmluZF9uZWlnaGJvcl9zZWxlY3RhYmxlPy4oIGVsICkgfHwgbnVsbDtcclxuXHJcblx0XHRcdGNvbnN0IGlkID0gZWw/LmRhdGFzZXQ/LmlkO1xyXG5cdFx0XHRjb25zdCB1aWQgPSBlbD8uZGF0YXNldD8udWlkO1xyXG5cclxuXHRcdFx0ZWwucmVtb3ZlKCk7XHJcblxyXG5cdFx0XHQvLyBLZWVwIHBhbGV0dGUgaW4gc3luYyBhbmQgbm90aWZ5IGxpc3RlbmVycy5cclxuXHRcdFx0dGhpcy51c2FnZS51cGRhdGVfcGFsZXR0ZV91aSgpO1xyXG5cdFx0XHR0aGlzLmJ1cy5lbWl0KCBXUEJDX0JGQl9FdmVudHMuRklFTERfUkVNT1ZFLCB7XHJcblx0XHRcdFx0aWQsXHJcblx0XHRcdFx0dWlkLFxyXG5cdFx0XHRcdGVsX3R5cGU6IGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApID8gJ3NlY3Rpb24nIDogJ2ZpZWxkJ1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBQaWNrIGEgc2Vuc2libGUgbmV4dCBzZWxlY3Rpb24uXHJcblx0XHRcdHRoaXMuc2VsZWN0X2ZpZWxkKCBuZWlnaGJvciB8fCBudWxsICk7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblxyXG5cdC8vIEJvb3RzdHJhcCBmYWNpbGl0eSArIGF1dG8taW5pdCBvbiBET00gcmVhZHkuXHJcblx0dy5XUEJDX0JGQiA9IHcuV1BCQ19CRkIgfHwge307XHJcblxyXG5cdHcuV1BCQ19CRkIuYm9vdHN0cmFwID0gZnVuY3Rpb24gYm9vdHN0cmFwKG9wdGlvbnMgPSB7fSkge1xyXG5cdFx0bGV0IGIgPSBudWxsO1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0YiA9IG5ldyBXUEJDX0Zvcm1fQnVpbGRlciggb3B0aW9ucyApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDX0JGQiBib290c3RyYXAgZmFpbGVkOicsIGUgKTtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0XHR3aW5kb3cud3BiY19iZmIgPSBiO1xyXG5cdFx0Ly8gUmVzb2x2ZSBBUEkgJ3JlYWR5JyBpZiBpdCBleGlzdHMgYWxyZWFkeTsgb3RoZXJ3aXNlIHRoZSBBUEkgd2lsbCByZXNvbHZlIGl0c2VsZiB3aGVuIGNyZWF0ZWQuXHJcblx0XHRpZiAoIHdpbmRvdy53cGJjX2JmYl9hcGkgJiYgdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9hcGkuX3Jlc29sdmVSZWFkeSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0d2luZG93LndwYmNfYmZiX2FwaS5fcmVzb2x2ZVJlYWR5KCBiICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gYjtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiA9PSBQdWJsaWMsIHN0YWJsZSBBUEkgb2YgQm9va2luZyBGb3JtIEJ1aWxkZXIgKEJGQikuXHJcblx0ICpcclxuXHQgKiBDb25zdW1lcnMgc2hvdWxkIHByZWZlcjogd3BiY19iZmJfYXBpLm9uKFdQQkNfQkZCX0V2ZW50cy5GSUVMRF9BREQsIGhhbmRsZXIpXHJcblx0ICovXHJcblx0dy53cGJjX2JmYl9hcGkgPSAoZnVuY3Rpb24gKCkge1xyXG5cdFx0Ly8gJ3JlYWR5JyBwcm9taXNlLiBSZXNvbHZlcyBvbmNlIHRoZSBidWlsZGVyIGluc3RhbmNlIGV4aXN0cy5cclxuXHRcdGxldCBfcmVzb2x2ZVJlYWR5O1xyXG5cdFx0Y29uc3QgcmVhZHkgPSBuZXcgUHJvbWlzZSggciA9PiB7XHJcblx0XHRcdF9yZXNvbHZlUmVhZHkgPSByO1xyXG5cdFx0fSApO1xyXG5cdFx0Ly8gRWplY3QvcmVzb2x2ZSBhZnRlciBhIHRpbWVvdXQgc28gY2FsbGVycyBhcmVu4oCZdCBzdHVjayBmb3JldmVyOi5cclxuXHRcdHNldFRpbWVvdXQoICgpID0+IHtcclxuXHRcdFx0aWYgKCB3aW5kb3cud3BiY19iZmIgKSB7XHJcblx0XHRcdFx0X3Jlc29sdmVSZWFkeSggd2luZG93LndwYmNfYmZiICk7XHJcblx0XHRcdH1cclxuXHRcdH0sIDMwMDAgKTtcclxuXHJcblx0XHQvLyBJZiBidWlsZGVyIGFscmVhZHkgZXhpc3RzIChlLmcuLCBib290c3RyYXAgcmFuIGVhcmxpZXIpLCByZXNvbHZlIGltbWVkaWF0ZWx5LlxyXG5cdFx0aWYgKCB3aW5kb3cud3BiY19iZmIgKSB7XHJcblx0XHRcdF9yZXNvbHZlUmVhZHkoIHdpbmRvdy53cGJjX2JmYiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHJlYWR5LFxyXG5cdFx0XHQvLyBpbnRlcm5hbCBob29rIHVzZWQgYnkgYm9vdHN0cmFwIHRvIHJlc29sdmUgaWYgQVBJIHdhcyBjcmVhdGVkIGZpcnN0LlxyXG5cdFx0XHRfcmVzb2x2ZVJlYWR5LFxyXG5cclxuXHRcdFx0LyoqIEByZXR1cm5zIHtIVE1MRWxlbWVudHxudWxsfSAqL1xyXG5cdFx0XHRnZXRfc2VsZWN0aW9uX2VsKCkge1xyXG5cdFx0XHRcdGNvbnN0IGIgPSB3aW5kb3cud3BiY19iZmI7XHJcblx0XHRcdFx0cmV0dXJuIGI/LmdldF9zZWxlY3RlZF9maWVsZD8uKCkgPz8gbnVsbDtcclxuXHRcdFx0fSxcclxuXHRcdFx0LyoqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gKi9cclxuXHRcdFx0Z2V0X3NlbGVjdGlvbl91aWQoKSB7XHJcblx0XHRcdFx0Y29uc3QgYiAgPSB3aW5kb3cud3BiY19iZmI7XHJcblx0XHRcdFx0Y29uc3QgZWwgPSBiPy5nZXRfc2VsZWN0ZWRfZmllbGQ/LigpO1xyXG5cdFx0XHRcdHJldHVybiBlbD8uZGF0YXNldD8udWlkID8/IG51bGw7XHJcblx0XHRcdH0sXHJcblx0XHRcdGNsZWFyKCkge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2JmYj8uc2VsZWN0X2ZpZWxkPy4oIG51bGwgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB1aWRcclxuXHRcdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzPXt9XVxyXG5cdFx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdFx0ICovXHJcblx0XHRcdHNlbGVjdF9ieV91aWQodWlkLCBvcHRzID0ge30pIHtcclxuXHRcdFx0XHRjb25zdCBiICA9IHdpbmRvdy53cGJjX2JmYjtcclxuXHRcdFx0XHRjb25zdCBlbCA9IGI/LnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3Rvcj8uKFxyXG5cdFx0XHRcdFx0YC53cGJjX2JmYl9fZmllbGRbZGF0YS11aWQ9XCIke1dQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdWlkICl9XCJdYFxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdFx0aWYgKCBlbCApIHtcclxuXHRcdFx0XHRcdGIuc2VsZWN0X2ZpZWxkKCBlbCwgb3B0cyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gISFlbDtcclxuXHRcdFx0fSxcclxuXHRcdFx0LyoqIEByZXR1cm5zIHtBcnJheX0gKi9cclxuXHRcdFx0Z2V0X3N0cnVjdHVyZSgpIHtcclxuXHRcdFx0XHRyZXR1cm4gd2luZG93LndwYmNfYmZiPy5nZXRfc3RydWN0dXJlPy4oKSA/PyBbXTtcclxuXHRcdFx0fSxcclxuXHRcdFx0LyoqIEBwYXJhbSB7QXJyYXl9IHMgKi9cclxuXHRcdFx0bG9hZF9zdHJ1Y3R1cmUocykge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2JmYj8ubG9hZF9zYXZlZF9zdHJ1Y3R1cmU/LiggcyApO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHQvKiogQHJldHVybnMge0hUTUxFbGVtZW50fHVuZGVmaW5lZH0gKi9cclxuXHRcdFx0YWRkX3BhZ2UoKSB7XHJcblx0XHRcdFx0cmV0dXJuIHdpbmRvdy53cGJjX2JmYj8uYWRkX3BhZ2U/LigpO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRvbihldmVudF9uYW1lLCBoYW5kbGVyKSB7XHJcblx0XHRcdFx0d2luZG93LndwYmNfYmZiPy5idXM/Lm9uPy4oIGV2ZW50X25hbWUsIGhhbmRsZXIgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0b2ZmKGV2ZW50X25hbWUsIGhhbmRsZXIpIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19iZmI/LmJ1cz8ub2ZmPy4oIGV2ZW50X25hbWUsIGhhbmRsZXIgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIERpc3Bvc2UgdGhlIGFjdGl2ZSBidWlsZGVyIGluc3RhbmNlLlxyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdFx0ICovXHJcblx0XHRcdGRlc3Ryb3koKSB7XHJcblx0XHRcdFx0d2luZG93LndwYmNfYmZiPy5kZXN0cm95Py4oKTtcclxuXHRcdFx0fSxcclxuXHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cdC8vIEF1dG/igJFib290c3RyYXAgb24gRE9NIHJlYWR5LlxyXG5cdChmdW5jdGlvbiBpbml0QnVpbGRlcldoZW5SZWFkeSgpIHtcclxuXHRcdGNvbnN0IHN0YXJ0ID0gKCkgPT4gd2luZG93LldQQkNfQkZCLmJvb3RzdHJhcCgpO1xyXG5cdFx0aWYgKCBkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycgKSB7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgc3RhcnQsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRzdGFydCgpO1xyXG5cdFx0fVxyXG5cdH0pKCk7XHJcblxyXG5cdC8vIE9uZS10aW1lIGNsZWFudXA6IGVuc3VyZSBzZWN0aW9ucyBkb27igJl0IGhhdmUgdGhlIGZpZWxkIGNsYXNzLiAob2xkIG1hcmt1cCBoeWdpZW5lKS5cclxuXHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19zZWN0aW9uLndwYmNfYmZiX19maWVsZCcgKS5mb3JFYWNoKCAoZWwpID0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fZmllbGQnICkgKTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEVtcHR5LXNwYWNlIGNsaWNrcyAtPiBkaXNwYXRjaCBhIHNpbmdsZSBldmVudDsgY2VudHJhbCBsaXN0ZW5lciBkb2VzIHRoZSBjbGVhcmluZy5cclxuXHQgKiBPbmUgY2VudHJhbCBsaXN0ZW5lciByZWFjdHMgdG8gdGhhdCBldmVudCBhbmQgZG9lcyB0aGUgY2xlYXJpbmcgKyBpbnNwZWN0b3IgcmVzZXQuXHJcblx0ICovXHJcblx0aWYgKCB3aW5kb3cualF1ZXJ5ICkgeyBqUXVlcnkoIGZ1bmN0aW9uICggJCApIHtcclxuXHRcdC8vIEVsZW1lbnRzIHdoZXJlIGNsaWNrcyBzaG91bGQgTk9UIGNsZWFyIHNlbGVjdGlvbi5cclxuXHRcdGNvbnN0IEtFRVBfQ0xJQ0tfU0VMID0gW1xyXG5cdFx0XHQnLndwYmNfYmZiX19maWVsZCcsXHJcblx0XHRcdCcud3BiY19iZmJfX3NlY3Rpb24nLFxyXG5cdFx0XHQnLndwYmNfYmZiX19vdmVybGF5LWNvbnRyb2xzJyxcclxuXHRcdFx0Jy53cGJjX2JmYl9fbGF5b3V0X3BpY2tlcicsXHJcblx0XHRcdCcud3BiY19iZmJfX2RyYWctaGFuZGxlJyxcclxuXHRcdFx0Ly8gSW5zcGVjdG9yIC8gcGFsZXR0ZSBzdXJmYWNlcy5cclxuXHRcdFx0JyN3cGJjX2JmYl9faW5zcGVjdG9yJywgJy53cGJjX2JmYl9faW5zcGVjdG9yJyxcclxuXHRcdFx0Jy53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsJywgJy53cGJjX2JmYl9fcGFsZXR0ZScsXHJcblx0XHRcdC8vIEdlbmVyaWMgaW50ZXJhY3RpdmUuXHJcblx0XHRcdCdpbnB1dCcsICd0ZXh0YXJlYScsICdzZWxlY3QnLCAnYnV0dG9uJywgJ2xhYmVsJywgJ2EsW3JvbGU9YnV0dG9uXSxbY29udGVudGVkaXRhYmxlXScsXHJcblx0XHRcdC8vIENvbW1vbiBwb3B1cHMvd2lkZ2V0cy5cclxuXHRcdFx0Jy50aXBweS1ib3gnLCAnLmRhdGVwaWNrJywgJy5zaW1wbGViYXItc2Nyb2xsYmFyJ1xyXG5cdFx0XS5qb2luKCAnLCcgKTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlc2V0IHRoZSBpbnNwZWN0b3IvcGFsZXR0ZSBlbXB0eSBzdGF0ZSBVSS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gcmVzZXRJbnNwZWN0b3JVSSgpIHtcclxuXHRcdFx0Y29uc3QgJHBhbCA9ICQoICcjd3BiY19iZmJfX2luc3BlY3RvciwgLndwYmNfYmZiX19wYWxldHRlLCAud3BiY19iZmJfX29wdGlvbnNfcGFuZWwnICkuZmlyc3QoKTtcclxuXHRcdFx0aWYgKCAhICRwYWwubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JHBhbC5yZW1vdmVDbGFzcyggJ2hhcy1zZWxlY3Rpb24gaXMtYWN0aXZlJyApLmFkZENsYXNzKCAnaXMtZW1wdHknICk7XHJcblxyXG5cdFx0XHQkcGFsLmZpbmQoICdbZGF0YS1mb3ItdWlkXSxbZGF0YS1mb3ItZmllbGRdLFtkYXRhLXBhbmVsPVwiZmllbGRcIl0sW3JvbGU9XCJ0YWJwYW5lbFwiXScgKVxyXG5cdFx0XHRcdC5hdHRyKCAnaGlkZGVuJywgdHJ1ZSApLmFkZENsYXNzKCAnaXMtaGlkZGVuJyApO1xyXG5cclxuXHRcdFx0JHBhbC5maW5kKCAnW3JvbGU9XCJ0YWJcIl0nIClcclxuXHRcdFx0XHQuYXR0ciggeyAnYXJpYS1zZWxlY3RlZCc6ICdmYWxzZScsICd0YWJpbmRleCc6ICctMScgfSApXHJcblx0XHRcdFx0LnJlbW92ZUNsYXNzKCAnaXMtYWN0aXZlJyApO1xyXG5cclxuXHRcdFx0JHBhbC5maW5kKCAnLndwYmNfYmZiX19pbnNwZWN0b3ItZW1wdHksIC53cGJjX2JmYl9fZW1wdHlfc3RhdGUsIFtkYXRhLWVtcHR5LXN0YXRlPVwidHJ1ZVwiXScgKVxyXG5cdFx0XHRcdC5yZW1vdmVBdHRyKCAnaGlkZGVuJyApLnJlbW92ZUNsYXNzKCAnaXMtaGlkZGVuJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfc2V0dGluZ3NfcGFnZV9jb250ZW50JyApO1xyXG5cdFx0aWYgKCAhIHJvb3QgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhhbmRsZSBjbGVhci1zZWxlY3Rpb24gcmVxdWVzdHMgZnJvbSBFU0MvZW1wdHktc3BhY2UgYW5kIHN5bmMgd2l0aCBidWlsZGVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2dCAtIFRoZSBldmVudCBjYXJyeWluZyBvcHRpb25hbCBgZGV0YWlsLnNvdXJjZWAuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gaGFuZGxlQ2xlYXJTZWxlY3Rpb24oIGV2dCApIHtcclxuXHRcdFx0Y29uc3Qgc3JjID0gZXZ0Py5kZXRhaWw/LnNvdXJjZTtcclxuXHJcblx0XHRcdC8vIElmIHRoaXMgaXMgdGhlIGJ1aWxkZXIgdGVsbGluZyB1cyBpdCBhbHJlYWR5IGNsZWFyZWQgc2VsZWN0aW9uLFxyXG5cdFx0XHQvLyBqdXN0IHN5bmMgdGhlIHN1cnJvdW5kaW5nIFVJIGFuZCBleGl0LlxyXG5cdFx0XHRpZiAoIHNyYyA9PT0gJ2J1aWxkZXInICkge1xyXG5cdFx0XHRcdHJlc2V0SW5zcGVjdG9yVUkoKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE90aGVyd2lzZSBpdCdzIGEgcmVxdWVzdCB0byBjbGVhciAoRVNDLCBlbXB0eSBzcGFjZSwgZXRjLikuXHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYmZiX2FwaSAmJiB0eXBlb2Ygd2luZG93LndwYmNfYmZiX2FwaS5jbGVhciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19iZmJfYXBpLmNsZWFyKCk7IC8vIFRoaXMgd2lsbCBlbWl0IHRoZSAnYnVpbGRlcicgbm90aWZpY2F0aW9uIG5leHQuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Ly8gRmFsbGJhY2sgaWYgdGhlIEFQSSBpc24ndCBhdmFpbGFibGUuXHJcblx0XHRcdFx0alF1ZXJ5KCAnLmlzLXNlbGVjdGVkLCAud3BiY19iZmJfX2ZpZWxkLS1hY3RpdmUsIC53cGJjX2JmYl9fc2VjdGlvbi0tYWN0aXZlJyApXHJcblx0XHRcdFx0XHQucmVtb3ZlQ2xhc3MoICdpcy1zZWxlY3RlZCB3cGJjX2JmYl9fZmllbGQtLWFjdGl2ZSB3cGJjX2JmYl9fc2VjdGlvbi0tYWN0aXZlJyApO1xyXG5cdFx0XHRcdHJlc2V0SW5zcGVjdG9yVUkoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIExpc3RlbiBnbG9iYWxseSBmb3IgY2xlYXItc2VsZWN0aW9uIG5vdGlmaWNhdGlvbnMuXHJcblx0XHRjb25zdCBFViA9IHdpbmRvdy5XUEJDX0JGQl9FdmVudHMgfHwge307XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCBFVi5DTEVBUl9TRUxFQ1RJT04gfHwgJ3dwYmM6YmZiOmNsZWFyLXNlbGVjdGlvbicsIGhhbmRsZUNsZWFyU2VsZWN0aW9uICk7XHJcblxyXG5cdFx0Ly8gQ2FwdHVyZSBjbGlja3M7IG9ubHkgZGlzcGF0Y2ggdGhlIGV2ZW50IChubyBkaXJlY3QgY2xlYXJpbmcgaGVyZSkuXHJcblx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZSApIHtcclxuXHRcdFx0Y29uc3QgJHQgPSAkKCBlLnRhcmdldCApO1xyXG5cclxuXHRcdFx0Ly8gSWdub3JlIGNsaWNrcyBpbnNpZGUgaW50ZXJhY3RpdmUgLyBidWlsZGVyIGNvbnRyb2xzLlxyXG5cdFx0XHRpZiAoICR0LmNsb3Nlc3QoIEtFRVBfQ0xJQ0tfU0VMICkubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gSWdub3JlIG1vdXNldXAgYWZ0ZXIgc2VsZWN0aW5nIHRleHQuXHJcblx0XHRcdGlmICggd2luZG93LmdldFNlbGVjdGlvbiAmJiBTdHJpbmcoIHdpbmRvdy5nZXRTZWxlY3Rpb24oKSApLnRyaW0oKSAhPT0gJycgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBEaXNwYXRjaCB0aGUgc2luZ2xlIGV2ZW50OyBsZXQgdGhlIGxpc3RlbmVyIGRvIHRoZSB3b3JrLlxyXG5cdFx0XHRjb25zdCBldnQgPSBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjOmJmYjpjbGVhci1zZWxlY3Rpb24nLCB7XHJcblx0XHRcdFx0ZGV0YWlsOiB7IHNvdXJjZTogJ2VtcHR5LXNwYWNlLWNsaWNrJywgb3JpZ2luYWxFdmVudDogZSB9XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggZXZ0ICk7XHJcblx0XHR9LCB0cnVlICk7XHJcblx0fSApOyB9IC8vIGVuZCBqUXVlcnkgZ3VhcmRcclxuXHJcbn0pKCB3aW5kb3cgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFO0VBQ2IsWUFBWTs7RUFFWixNQUFNO0lBQ0pDLGlCQUFpQjtJQUNqQkMsa0JBQWtCO0lBQ2xCQyxzQkFBc0I7SUFDdEJDLDBCQUEwQjtJQUMxQkMsZUFBZTtJQUNmQyxpQkFBaUI7SUFDakJDLHdCQUF3QjtJQUN4QkMsWUFBWTtJQUNaQyx3QkFBd0I7SUFDeEJDO0VBQ0MsQ0FBQyxHQUFHVixDQUFDLENBQUNXLGFBQWE7RUFFdEIsTUFBTTtJQUNKQyxlQUFlO0lBQ2ZDLGdCQUFnQjtJQUNoQkMscUJBQXFCO0lBQ3JCQyw2QkFBNkI7SUFDN0JDLHlCQUF5QjtJQUN6QkMsNEJBQTRCO0lBQzVCQywwQkFBMEI7SUFD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
