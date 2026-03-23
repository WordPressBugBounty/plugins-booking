"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/_out/bfb-builder.js == Time point: 2025-09-06 14:08
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Dispatch a DOM event safely.
 *
 * @param {string} name
 * @param {Object} detail
 */
function wpbc_bfb__dispatch_event_safe(name, detail) {
  try {
    if (typeof window.CustomEvent === 'function') {
      document.dispatchEvent(new CustomEvent(name, {
        detail: detail || {}
      }));
      return;
    }
  } catch (_e) {}
  try {
    const ev = document.createEvent('CustomEvent');
    ev.initCustomEvent(name, true, true, detail || {});
    document.dispatchEvent(ev);
  } catch (_e2) {}
}

/**
 * Quick, copy-paste console snippets you can use on the Builder page to exercise every refresh path.

	Simple - Full rebuild + reinit (DEFAULTS). Use this when markup/renderers change.
	wpbc_bfb.refresh_canvas();


	Get the builder
	// Always do this first:
	wpbc_bfb_api.ready.then(b => { window.__B = b; console.log('BFB ready', b); });


	Now you can call __B.refresh_canvas(...) directly.

	Hard refresh (default)
	// Full rebuild + reinit (DEFAULTS). Use this when markup/renderers change.
	__B.refresh_canvas();
	// Same, but explicit:
	__B.refresh_canvas({ hard:true, rebuild:true, reinit:true, source:'console' });

	Hard refresh WITHOUT rebuild
	// Re-render all fields in place, then hydrate packs. Faster when structure didn’t change.
	__B.refresh_canvas({ hard:true, rebuild:false, source:'console' });

	Hard refresh but skip field reinit
	// If you know packs don’t need on_field_drop re-wiring:
	__B.refresh_canvas({ hard:true, rebuild:true, reinit:false, source:'console' });

	Soft refresh (only selected field)
	// 1) Select a field (first found) so soft refresh has a target:
	__B.select_field(document.querySelector('.wpbc_bfb__field'), { scrollIntoView:false });

	// 2) Re-render just that field:
	__B.refresh_canvas({ hard:false, source:'console' });

	Restore behavior toggles
	// Don’t restore selection/scroll after refresh:
	__B.refresh_canvas({ restore_selection:false, restore_scroll:false, source:'console' });

	Avoid inspector ↔ canvas “echo”
	// Use when calling from Inspector-like code to prevent ping-pong:
	__B.refresh_canvas({ hard:true, rebuild:true, reinit:true, silent_inspector:true, source:'console' });

	Preview mode guard (just to verify behavior)
	// Turn preview OFF and try a refresh (no re-rendering will happen):
	__B.set_preview_mode(false, { rebuild:false });
	__B.refresh_canvas({ hard:true, source:'console' });

	// Turn preview ON again and rebuild:
	__B.set_preview_mode(true, { rebuild:true, reinit:true, source:'console' });

	Watch events (before/after)
	wpbc_bfb_api.ready.then(b => {
	  const EV = (window.WPBC_BFB_Core && WPBC_BFB_Core.WPBC_BFB_Events) || {};
	  b.bus.on(EV.CANVAS_REFRESH || 'wpbc:bfb:canvas-refresh',   p => console.log('BEFORE', p));
	  b.bus.on(EV.CANVAS_REFRESHED || 'wpbc:bfb:canvas-refreshed', p => console.log('AFTER ', p));
	});

	Sanity checks while testing
	// Is a refresh already in progress? (reentrancy guard)
	__B.__refreshing_canvas

	// See what’s currently selected (for soft refresh):
	__B.get_selected_field?.()

	// Manually select by data-id (to test selection restore):
	const id = document.querySelector('.wpbc_bfb__field')?.dataset?.id;
	__B.select_by_data_id?.(id, { silent:true });
 *
 */
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
    // WPBC_BFB_DOM,
    WPBC_Form_Builder_Helper,
    WPBC_BFB_Field_Renderer_Registry
  } = w.WPBC_BFB_Core;

  // NOTE: UI is now under WPBC_BFB_Core.UI.
  const {
    WPBC_BFB_Module,
    WPBC_BFB_Overlay,
    // WPBC_BFB_Layout_Chips,
    WPBC_BFB_Selection_Controller,
    WPBC_BFB_Inspector_Bridge,
    WPBC_BFB_Keyboard_Controller,
    WPBC_BFB_Resize_Controller,
    WPBC_BFB_Pages_Sections,
    WPBC_BFB_Structure_IO,
    WPBC_BFB_Min_Width_Guard
  } = w.WPBC_BFB_Core.UI;
  function wpbc_bfb__post_ajax_promise(url, data) {
    return new Promise(function (resolve) {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
          return;
        }
        resolve({
          status: xhr.status,
          text: xhr.responseText
        });
      };
      const pairs = [];
      for (const k in data) {
        if (!Object.prototype.hasOwnProperty.call(data, k)) {
          continue;
        }
        pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
      }
      xhr.send(pairs.join('&'));
    });
  }
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
      if (typeof Sortable === 'undefined') {
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

      // 1. Auto  Load form  defined in wpbc_bfb_output_ajax_boot_config() -> 2. Load example  wpbc_bfb__form_structure__get_example() -> 3. Blank  page.
      const startLoad = async () => {
        await waitForRenderers();
        await new Promise(r => setTimeout(r, 0)); // next macrotask.

        // 1) Try to auto-load "standard" from DB (published) via AJAX.
        const loaded = await this._auto_load_initial_form_from_ajax();

        // Auto-open Apply Template modal from URL (if requested).
        await this._auto_open_apply_template_modal_from_url();
        if (loaded) {
          return;
        }

        // 2) Fallback behavior if AJAX did not load anything.
        const cfg = window.WPBC_BFB_Ajax || {};
        const fallback_mode = String(cfg.initial_load_fallback || 'example').toLowerCase();
        if (fallback_mode === 'blank') {
          this.add_page();

          // Auto-open Apply Template modal from URL (if requested).
          await this._auto_open_apply_template_modal_from_url();
          return;
        }

        // default fallback: example structure.
        const example_structure = typeof window.wpbc_bfb__form_structure__get_example === 'function' ? window.wpbc_bfb__form_structure__get_example() : null;
        if (Array.isArray(example_structure)) {
          this.load_saved_structure(example_structure);
        } else {
          this.add_page();
        }

        // Auto-open Apply Template modal from URL (if requested).
        await this._auto_open_apply_template_modal_from_url();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startLoad);
      } else {
        startLoad();
      }
      this._start_usage_observer();
      this._start_pages_numbering_observer();

      // this.add_page(); return;  // Standard initializing one page.
    }
    _getRenderer(type) {
      // return w.WPBC_BFB_Core?.WPBC_BFB_Field_Renderer_Registry?.get?.( type );
      return WPBC_BFB_Field_Renderer_Registry?.get?.(type);
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
            } catch (e) {
              _wpbc?.dev?.error('_start_usage_observer', e);
            }
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
        } catch (e) {
          _wpbc?.dev?.error('_start_usage_observer', e);
        }
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
      // const save_btn = document.getElementById( 'wpbc_bfb__save_btn' );
      // if ( save_btn ) {
      // 	if ( ! save_btn.hasAttribute( 'type' ) ) {
      // 		save_btn.setAttribute( 'type', 'button' );
      // 	}
      // 	this._on( save_btn, 'click', ( e ) => {
      // 		e.preventDefault();
      // 		const structure = this.get_structure();
      // 		console.log( JSON.stringify( structure, null, 2 ) ); // Developer aid.
      // 		this._emit_const( WPBC_BFB_Events.STRUCTURE_CHANGE, { structure } );
      // 		this.load_saved_structure( structure, { deferIfTyping: false } );
      // 	} );
      // }

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

    // -- Page Numbers Care --

    /**
     * Get page panels in DOM order (direct children of pages_container).
     *
     * @returns {HTMLElement[]}
     */
    _get_pages_in_dom_order() {
      if (!this.pages_container) {
        return [];
      }
      return Array.from(this.pages_container.querySelectorAll(':scope > .wpbc_bfb__panel--preview'));
    }

    /**
     * Get the page number heading element inside a page panel.
     *
     * @param {HTMLElement} page_el
     * @returns {HTMLElement|null}
     */
    _get_page_number_heading_el(page_el) {
      if (!page_el || !page_el.querySelector) {
        return null;
      }
      // In markup this is: <h3 class="wpbc_bfb__page_number">Page 1 <button>...</button></h3>
      return page_el.querySelector('.wpbc_bfb__page_number');
    }

    /**
     * Update only TEXT inside <h3 class="wpbc_bfb__page_number">, preserving the delete button.
     *
     * @param {HTMLElement} heading_el
     * @param {number} page_number
     * @returns {void}
     */
    _set_page_number_heading_text(heading_el, page_number) {
      if (!heading_el) {
        return;
      }

      // Collect current visible text from TEXT nodes only (ignore button text).
      const text_nodes = Array.from(heading_el.childNodes || []).filter(n => n && n.nodeType === 3);
      let raw = '';
      for (let i = 0; i < text_nodes.length; i++) {
        raw += String(text_nodes[i].nodeValue || '');
      }
      raw = raw.replace(/\s+/g, ' ').trim(); // "Page 1"

      const n = String(page_number);

      // Preserve prefix/translation, just replace the last number group.
      let next = '';
      if (raw && /\d+/.test(raw)) {
        next = raw.replace(/(\d+)(?!.*\d)/, n);
      } else if (raw) {
        next = raw + ' ' + n;
      } else {
        next = 'Page ' + n;
      }

      // Apply into the first text node; clear any extra text nodes.
      if (text_nodes.length > 0) {
        text_nodes[0].nodeValue = next + ' ';
        for (let k = 1; k < text_nodes.length; k++) {
          text_nodes[k].nodeValue = '';
        }
      } else {
        // No text node exists (rare) -> insert before first child (keeps button).
        heading_el.insertBefore(document.createTextNode(next + ' '), heading_el.firstChild);
      }
    }

    /**
     * Renumber all pages in the canvas by DOM order.
     * - Updates data-page_number (display order)
     * - Updates data-page        (legacy/page number for compatibility)
     * - Updates heading text "Page X" while keeping delete button
     * - Syncs this.page_counter so next added page is correct
     *
     * @param {Object} [opts={}]
     * @param {string} [opts.source='system']
     * @returns {void}
     */
    renumber_pages_in_canvas(opts = {}) {
      const source = String(opts.source || 'system');
      const pages = this._get_pages_in_dom_order();
      for (let i = 0; i < pages.length; i++) {
        const page_el = pages[i];
        const page_number = i + 1;

        // Keep BOTH attributes consistent (some code may still read data-page).
        page_el.setAttribute('data-page_number', String(page_number));
        page_el.setAttribute('data-page', String(page_number));
        const heading_el = this._get_page_number_heading_el(page_el);
        if (heading_el) {
          this._set_page_number_heading_text(heading_el, page_number);
        }
      }

      // IMPORTANT:
      // Keep the counter aligned with the current amount of pages,
      // so add_page() creates the next correct number.
      this.page_counter = pages.length;

      // Optional: notify other UI (tabs, etc.).
      try {
        const ev = window.WPBC_BFB_Core?.WPBC_BFB_Events?.PAGES_RENUMBERED || 'wpbc:bfb:pages-renumbered';
        this.bus?.emit?.(ev, {
          source: source,
          pages: pages.length
        });
      } catch (_e) {}
    }

    /**
     * Start observer that renumbers pages after add/delete/reorder/load.
     * Observes only direct children changes to avoid firing on every field change.
     *
     * @returns {void}
     */
    _start_pages_numbering_observer() {
      if (this._pages_numbering_observer || !this.pages_container) {
        return;
      }
      const do_renumber = WPBC_Form_Builder_Helper.debounce(() => {
        this.renumber_pages_in_canvas({
          source: 'observer'
        });
      }, 50);
      this._pages_numbering_observer = new MutationObserver(mutations => {
        let touched_pages = false;
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (!m || m.type !== 'childList') {
            continue;
          }
          const nodes = [].concat(Array.from(m.addedNodes || [])).concat(Array.from(m.removedNodes || []));
          for (let k = 0; k < nodes.length; k++) {
            const n = nodes[k];
            if (n && n.nodeType === 1 && n.classList && n.classList.contains('wpbc_bfb__panel--preview')) {
              touched_pages = true;
              break;
            }
          }
          if (touched_pages) {
            break;
          }
        }
        if (touched_pages) {
          do_renumber();
        }
      });

      // IMPORTANT: childList only (no subtree), so fields dragging won’t trigger this.
      this._pages_numbering_observer.observe(this.pages_container, {
        childList: true
      });

      // Initial pass.
      do_renumber();
    }

    // -- Resizer --

    /**
     * Bind the resize mousedown handler with a balanced assert.
     * - If handler is missing: log a clear error and gracefully skip,
     *   then attempt a one-tick retry (covers late module init).
     * - Optional hard-fail in dev if window.WPBC_DEV_STRICT === true.
     *
     * @private
     * @param {HTMLElement} resizer
     * @returns {boolean} true if bound immediately, false otherwise
     */
    _bind_resizer(resizer) {
      const handler = this.init_resize_handler;
      if (typeof handler === 'function') {
        resizer.addEventListener('mousedown', handler);
        return true;
      }
      const msg = 'WPBC: init_resize_handler missing. Check that WPBC_BFB_Resize_Controller is loaded/initialized before the builder.';

      // Loud but non-fatal by default.
      console.error(msg);

      // Optional strict dev mode: throw to surface load-order problems early
      if (window.WPBC_DEV_STRICT === true) {
        setTimeout(() => {
          throw new Error(msg);
        }, 0);
      }

      // One deferred retry in case the resize controller attaches slightly later
      setTimeout(() => {
        const late = this.init_resize_handler;
        if (typeof late === 'function' && resizer.isConnected) {
          resizer.addEventListener('mousedown', late);
        }
      }, 0);
      return false;
    }

    /**
     * Factory for a column resizer element with binding handled.
     *
     * @private
     * @returns {HTMLDivElement}
     */
    _create_resizer() {
      const resizer = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__column-resizer');
      this._bind_resizer(resizer);
      return resizer;
    }

    /**
     * Remove any existing resizers inside a row and rebuild them between columns.
     *
     * @private
     * @param {HTMLElement} row_el - The section row (.wpbc_bfb__row)
     * @returns {void}
     */
    _rebuild_resizers_for_row(row_el) {
      if (!row_el) return;

      // Remove all existing resizers
      row_el.querySelectorAll(':scope > .wpbc_bfb__column-resizer').forEach(r => r.remove());

      // Reinsert resizers between current columns
      const cols = this._get_row_cols(row_el);
      for (let i = 0; i < cols.length - 1; i++) {
        const resizer = this._create_resizer();
        cols[i].insertAdjacentElement('afterend', resizer);
      }
    }

    // -- End Resizer --

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
     * Set field's OPTIONAL HTML id (data-html_id). Empty removes it. Ensures sanitization and uniqueness among
     * other fields that declared HTML ids.
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

    // -- Check Usage Limits Helpers --

    /**
     * Return the usage key for a field node (palette uses data-usage_key; fallback to type).
     *
     * @param field_el
     * @returns {string|*}
     * @private
     */
    _get_usage_key(field_el) {
      return field_el?.dataset?.usage_key || field_el?.dataset?.type || 'field';
    }

    /**
     * Count how many of a given key are already present in the canvas.
     *
     * @param key
     * @returns {*|number}
     * @private
     */
    _count_used_in_canvas(key) {
      if (!this.pages_container) {
        return 0;
      }
      const esc = window.WPBC_BFB_Core?.WPBC_BFB_Sanitize?.esc_attr_value_for_selector?.(key) || key.replace(/"/g, '\\"');
      // match by usage_key first, then by type as a fallback (older fields).
      return this.pages_container.querySelectorAll(`.wpbc_bfb__field[data-usage_key="${esc}"], .wpbc_bfb__field[data-type="${esc}"]`).length;
    }

    /**
     * Read the numeric limit for a usage key from any palette item; Infinity if not specified.
     *
     * @param key
     * @returns {number}
     * @private
     */
    _get_palette_limit_for_key(key) {
      // prefer scanning builder-known palettes (supports multiple palettes).
      const candidates = (this.palette_uls || []).map(ul => ul.querySelector(`[data-id="${key}"], [data-usage_key="${key}"]`)).filter(Boolean);
      const pel = candidates[0] || document.querySelector(`.wpbc_bfb__panel_field_types__ul [data-id="${key}"], .wpbc_bfb__panel_field_types__ul [data-usage_key="${key}"]`);
      const n = Number(pel?.dataset?.usagenumber);
      return Number.isFinite(n) ? n : Infinity;
    }

    /**
     * Tally how many of each usage key exist inside a subtree (fields only).
     *
     * @param root_el
     * @returns {{}}
     * @private
     */
    _tally_usage_in_subtree(root_el) {
      const tally = {};
      if (!root_el) {
        return tally;
      }
      root_el.querySelectorAll('.wpbc_bfb__field').forEach(f => {
        const k = this._get_usage_key(f);
        tally[k] = (tally[k] || 0) + 1;
      });
      return tally;
    }

    /**
     * Preflight usage for a not-yet-inserted clone.
     * strategy:
     *   - 'block' (default) -> return offenders if any limit would be exceeded
     *   - 'strip'           -> mutate clone to remove over-limit fields and proceed
     *
     * @param clone
     * @param strategy
     * @returns {{ok:true}|{ok:false, offenders:Array<{key:string, limit:number, used:number, add:number}>}}
     * @private
     */
    _preflight_usage_for_clone(clone, strategy = 'block') {
      const offenders = [];
      const tally = this._tally_usage_in_subtree(clone);
      Object.entries(tally).forEach(([key, addCount]) => {
        const limit = this._get_palette_limit_for_key(key);
        if (!Number.isFinite(limit)) return; // no limit declared -> ignore

        const used = this._count_used_in_canvas(key);
        const remaining = limit - used;
        if (remaining >= addCount) return; // safe

        if (strategy === 'strip') {
          // Keep only the remaining capacity; remove extras from the clone
          const nodes = Array.from(clone.querySelectorAll(`.wpbc_bfb__field[data-usage_key="${key}"], .wpbc_bfb__field[data-type="${key}"]`));
          const toRemove = nodes.slice(Math.max(0, remaining));
          toRemove.forEach(n => n.remove());
        } else {
          offenders.push({
            key,
            limit,
            used,
            add: addCount
          });
        }
      });
      if (strategy === 'strip') {
        // After stripping, re-check; if still over (e.g. remaining < 0 for multiple keys), treat as offenders.
        const re = this._tally_usage_in_subtree(clone);
        const stillBad = Object.entries(re).some(([key, add]) => {
          const limit = this._get_palette_limit_for_key(key);
          return Number.isFinite(limit) && this._count_used_in_canvas(key) + add > limit;
        });
        return stillBad ? {
          ok: false,
          offenders
        } : {
          ok: true
        };
      }
      return offenders.length ? {
        ok: false,
        offenders
      } : {
        ok: true
      };
    }

    // == Ajax =====================================================================================================

    // == Auto Load Form on Start ==
    /**
     * Auto-load current form config from DB/legacy via admin-ajax.
     *
     * - If BFB structure exists -> loads it.
     * - If legacy engine returns empty structure -> treats as loaded and creates a blank page.
     * - Returns true if AJAX succeeded (even if structure is empty), false otherwise.
     *
     * @returns {Promise<boolean>}
     */
    async _auto_load_initial_form_from_ajax() {
      // Initial Parameters for form loading on page refresh / load.                                              // info: INIT_FORM_LOAD.
      const cfg = window.WPBC_BFB_Ajax || {};
      if (!cfg.url || !cfg.nonce_load) {
        return false;
      }
      const payload = {
        action: cfg.load_action || 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
        nonce: cfg.nonce_load || '',
        form_name: cfg.form_name || 'standard'
      };
      const r = await wpbc_bfb__post_ajax_promise(cfg.url, payload);
      if (r.status !== 200) {
        return false;
      }
      let resp = null;
      try {
        resp = JSON.parse(r.text);
      } catch (_e) {
        return false;
      }
      if (!resp || !resp.success || !resp.data) {
        return false;
      }
      const data = resp.data || {};
      const engine = String(data.engine || '').toLowerCase();

      // Apply Advanced Mode texts (always useful for legacy).
      if (typeof data.advanced_form !== 'undefined' || typeof data.content_form !== 'undefined') {
        const af = String(data.advanced_form || '');
        const cf = String(data.content_form || '');
        const ta_form = document.getElementById('wpbc_bfb__advanced_form_editor');
        const ta_content = document.getElementById('wpbc_bfb__content_form_editor');
        if (ta_form) {
          ta_form.value = af;
        }
        if (ta_content) {
          ta_content.value = cf;
        }

        // ONLY supported: settings.bfb_options.advanced_mode_source (fallback to cfg.save_source or 'builder').
        let adv_mode_src = '';
        if (typeof data.settings !== 'undefined') {
          try {
            const s = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
            adv_mode_src = s && s.bfb_options && s.bfb_options.advanced_mode_source ? String(s.bfb_options.advanced_mode_source) : '';
          } catch (_e) {}
        }
        if (!adv_mode_src) {
          adv_mode_src = window.WPBC_BFB_Ajax && window.WPBC_BFB_Ajax.save_source ? String(window.WPBC_BFB_Ajax.save_source) : 'builder';
        }
        wpbc_bfb__dispatch_event_safe('wpbc:bfb:advanced_text:apply', {
          advanced_form: af,
          content_form: cf,
          advanced_mode_source: adv_mode_src
        });
      }

      // Apply local form settings to UI (if provided).
      if (data.settings) {
        wpbc_bfb__dispatch_event_safe('wpbc:bfb:form_settings:apply', {
          settings: data.settings,
          form_name: cfg.form_name || 'standard'
        });
      }
      wpbc_bfb__dispatch_event_safe('wpbc:bfb:form:ajax_loaded', {
        loaded_data: data,
        form_name: cfg.form_name || 'standard'
      });

      // Structure may be [] for legacy engines.
      const structure = Array.isArray(data.structure) ? data.structure : [];
      if (structure.length > 0) {
        this.load_saved_structure(structure);

        // Re-apply effects AFTER structure rebuild created the final DOM.
        try {
          if (w.WPBC_BFB_Settings_Effects && typeof w.WPBC_BFB_Settings_Effects.reapply_after_canvas === 'function') {
            w.WPBC_BFB_Settings_Effects.reapply_after_canvas(data.settings, {
              source: 'ajax_load',
              form_name: cfg.form_name || 'standard'
            });
          }
        } catch (_e_fx) {}
        return true;
      }

      // IMPORTANT: Legacy load is still a valid "loaded" state.
      // Create a blank page (so the canvas isn't empty), and DO NOT fallback to example.
      this.add_page();
      try {
        if (w.WPBC_BFB_Settings_Effects && typeof w.WPBC_BFB_Settings_Effects.reapply_after_canvas === 'function') {
          w.WPBC_BFB_Settings_Effects.reapply_after_canvas(data.settings, {
            source: 'ajax_load_legacy',
            form_name: cfg.form_name || 'standard'
          });
        }
      } catch (_e_fx2) {}
      jQuery('.wpbc_bfb__top_tab_section__builder_tab .wpbc_spins_loading_container').parents('.wpbc_bfb__panel--preview').remove();
      // Optional: one-time notice for legacy.
      try {
        if (engine && engine.indexOf('legacy_') === 0 && typeof window.wpbc_admin_show_message === 'function') {
          window.wpbc_admin_show_message('Loaded legacy form. Use “Import from Simple Form” to convert to Builder.', 'warning', 6000);
        }
      } catch (_e2) {}
      return true;
    }

    // == Auto-open "Apply Template" modal ==
    /**
     * Auto-open "Apply Template" modal if URL has:
     *   &auto_open_template=Service+Duration
     *
     * This will prefill the modal search input and trigger server-side search
     * (title / slug / description) via your templates listing endpoint.
     *
     * Security:
     * - decodes safely
     * - strips control chars
     * - clamps length
     * - never injects HTML (only sets input.value)
     *
     * @returns {Promise<boolean>} True if auto-open was triggered.
     */
    async _auto_open_apply_template_modal_from_url() {
      try {
        // One-time per page load (avoid double open when called from multiple paths).
        if (window.__wpbc_bfb_auto_open_template_done) {
          return false;
        }

        // Read raw query param.
        const href = String(window.location && window.location.href ? window.location.href : '');
        if (!href) {
          return false;
        }
        let raw_value = '';
        try {
          const u = new URL(href);
          raw_value = u.searchParams.get('auto_open_template') || '';
        } catch (_e0) {
          // Fallback minimal parser (should rarely happen).
          const m = href.match(/[?&]auto_open_template=([^&#]*)/i);
          raw_value = m && m[1] ? m[1] : '';
        }
        raw_value = String(raw_value || '');

        // URLSearchParams usually decodes, but we also normalize "+" -> " " for safety.
        // If already decoded, this is harmless.
        raw_value = raw_value.replace(/\+/g, ' ');

        // Try decodeURIComponent (in case fallback parser captured encoded string).
        try {
          raw_value = decodeURIComponent(raw_value);
        } catch (_e1) {}

        // Sanitize: remove control chars, trim, collapse spaces.
        let search_key = raw_value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

        // Normalize OR separator so URL separator "^" becomes UI separator "|".
        try {
          const sep = cfg && cfg.template_search_or_sep ? String(cfg.template_search_or_sep) : '|';
          const urlSep = cfg && cfg.template_search_or_sep_url ? String(cfg.template_search_or_sep_url) : '^';
          const escSep = String(sep).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const escUrlSep = String(urlSep).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // Convert URL separator into UI separator.
          if (urlSep && urlSep !== sep) {
            search_key = search_key.replace(new RegExp('\\s*' + escUrlSep + '\\s*', 'g'), sep);
          }

          // Normalize UI separator.
          search_key = search_key.replace(new RegExp('\\s*' + escSep + '\\s*', 'g'), sep);
          search_key = search_key.replace(new RegExp(escSep + '{2,}', 'g'), sep);
          search_key = search_key.replace(new RegExp('^' + escSep + '+|' + escSep + '+$', 'g'), '').trim();
        } catch (_e_sep) {}

        // Clamp length (avoid silly URLs).
        if (search_key.length > 80) {
          search_key = search_key.slice(0, 80).trim();
        }
        if (!search_key) {
          return false;
        }

        // Mark as handled (we have a real value).
        window.__wpbc_bfb_auto_open_template_done = true;

        // Wait for the modal helper to exist (script load-order safe).
        const ready = await this._wait_for_apply_template_search_fn(3500);
        if (!ready) {
          // Silent fail (or log in dev).
          try {
            console.warn('WPBC BFB: apply template modal helper not ready (auto_open_template skipped).');
          } catch (_e2) {}
          return false;
        }

        // Open modal with prefilled search.
        window.wpbc_bfb__menu_forms__apply_template_search(search_key, null);
        return true;
      } catch (_e3) {
        return false;
      }
    }

    /**
     * Wait until wpbc_bfb__menu_forms__apply_template_search() exists.
     *
     * @param {number} timeout_ms
     * @returns {Promise<boolean>}
     */
    _wait_for_apply_template_search_fn(timeout_ms) {
      timeout_ms = parseInt(timeout_ms || 0, 10);
      if (!timeout_ms || timeout_ms < 200) {
        timeout_ms = 200;
      }
      return new Promise(resolve => {
        const started = Date.now();
        const is_ready = () => {
          return typeof window.wpbc_bfb__menu_forms__apply_template_search === 'function';
        };
        if (is_ready()) {
          return resolve(true);
        }
        const t = setInterval(() => {
          if (is_ready()) {
            clearInterval(t);
            return resolve(true);
          }
          if (Date.now() - started > timeout_ms) {
            clearInterval(t);
            return resolve(false);
          }
        }, 50);
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
        } catch (e) {}
        this._usage_observer = null;
      }

      // Pages numbering observer.
      if (this._pages_numbering_observer) {
        try {
          this._pages_numbering_observer.disconnect();
        } catch (e) {}
        this._pages_numbering_observer = null;
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
          } catch (e) {
            _wpbc?.dev?.error('WPBC_Form_Builder - Destroy registered modules', e);
          }
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
      // If container is not attached yet (e.g., freshly cloned), defer to next tick.
      if (!container.isConnected) {
        setTimeout(() => {
          if (container.isConnected) {
            this.sortable.ensure(container, 'canvas', {
              onAdd: on_add_callback
            });
          }
        }, 0);
        return;
      }
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

        // Ensure UI is fully initialized for newly placed/moved sections.
        this.add_overlay_toolbar(el);
        const row = el.querySelector(':scope > .wpbc_bfb__row');
        if (row) {
          this._rebuild_resizers_for_row(row);
          this.layout.set_equal_bases(row, this.col_gap_percent);
        }
        this.usage.update_palette_ui();
        this.select_field(el, {
          scrollIntoView: true
        });
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
        if ('uid' in field_data) {
          delete field_data.uid; // Guard: never carry a UID from palette/DOM clones.
        }

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
      // Only this builder UID (do NOT allow overrides from incoming data).
      const uid = this._generate_uid('f');
      el.setAttribute('data-uid', uid);
      // Drop any upstream uid so set_data_attributes can’t clobber ours.
      const {
        uid: _discardUid,
        ...safeData
      } = field_data || {};
      WPBC_Form_Builder_Helper.set_data_attributes(el, {
        ...safeData,
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
      // const label            = hasExplicitLabel ? data.label : id; //.

      try {
        const R = this._getRenderer(type);
        if (R && typeof R.render === 'function') {
          const ctx = {
            mode: 'preview',
            builder: this,
            tpl: id => window.wp && wp.template ? wp.template(id) : null,
            sanit: WPBC_BFB_Sanitize
          };
          // Renderer is responsible for writing to field_el.innerHTML.
          R.render(field_el, data, ctx);
          field_el.classList.add('wpbc_bfb__preview-rendered');
        } else {
          if (type) {
            // console.warn( `No renderer found for field type: ${type}.` );
            w._wpbc?.dev?.once('render_preview', `No renderer found for field type: ${type}.`, R);
          }
          field_el.innerHTML = WPBC_Form_Builder_Helper.render_field_inner_html(data);
        }
      } catch (err) {
        console.error('Renderer error.', err);
        field_el.innerHTML = WPBC_Form_Builder_Helper.render_field_inner_html(data);
      }
      this.add_overlay_toolbar(field_el);

      // Optional hook after DOM is in place.
      try {
        const R = this._getRenderer(type);
        // New contract: prefer hydrate(); fall back to legacy after_render if present.
        if (R && typeof R.hydrate === 'function') {
          R.hydrate(field_el, data, {
            mode: 'preview',
            builder: this,
            tpl: id => window.wp && wp.template ? wp.template(id) : null,
            sanit: WPBC_BFB_Sanitize
          });
        } else if (R && typeof R.after_render === 'function') {
          R.after_render(data, field_el); // legacy compatibility.
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
     * - Decreasing: moves children of removed columns into the previous column, removes columns/resizers,
     * refreshes Sortable, and equalizes widths.
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

      // Increasing columns -> append new columns at the end.
      if (target > current) {
        for (let i = current; i < target; i++) {
          // TODO FIX: remove stray "wpbc__field" class; keep canonical column class only. For now it is required.
          const col = WPBC_Form_Builder_Helper.create_element('div', 'wpbc_bfb__column wpbc__field');
          // Give it some initial basis; will be normalized after.
          col.style.flexBasis = 100 / target + '%';
          // Make this column a drop target.
          this.init_sortable?.(col);
          row.appendChild(col);
        }
        this._rebuild_resizers_for_row(row);
        // Equalize widths considering gap.
        this.layout.set_equal_bases(row, this.col_gap_percent);

        // Overlay: ensure the layout preset chips are present for >1 columns.
        this.add_overlay_toolbar(section_el);

        // Notify listeners (e.g., Min-Width Guard) that structure changed.
        this.bus.emit(WPBC_BFB_Events.STRUCTURE_CHANGE, {
          source: 'columns-change',
          section: section_el,
          count: target
        });
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
        this._rebuild_resizers_for_row(row);
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

        // Notify listeners (e.g., Min-Width Guard) that structure changed.
        this.bus.emit(WPBC_BFB_Events.STRUCTURE_CHANGE, {
          source: 'columns-change',
          section: section_el,
          count: target
        });
      }
    }

    /**
     * Public API: set preview mode and (optionally) rebuild the canvas.
     *
     * @param {boolean} enabled
     * @param {Object}  [opts]
     * @param {boolean} [opts.rebuild=true]
     * @param {boolean} [opts.reinit=true]
     * @param {string}  [opts.source='settings']
     */
    set_preview_mode(enabled, opts = {}) {
      const next = !!enabled;
      const rebuild = opts.rebuild !== false;
      const reinit = opts.reinit !== false;
      if (next === this.preview_mode) {
        return;
      }
      this.preview_mode = next;

      // Rebuild DOM so fields/sections render according to the new mode.
      if (rebuild) {
        this.load_saved_structure(this.get_structure(), {
          deferIfTyping: true
        });

        // Some renderers rely on on_field_drop hooks to (re)wire themselves.
        if (reinit) {
          this._reinit_all_fields('preview');
        }
      }

      // Optional event (safe fallback string if constant doesn't exist).
      try {
        const ev = window.WPBC_BFB_Core?.WPBC_BFB_Events?.PREVIEW_MODE_CHANGE || 'wpbc:bfb:preview-mode-change';
        this.bus?.emit?.(ev, {
          enabled: next,
          source: opts.source || 'builder'
        });
      } catch (_) {}
    }

    /**
     * Public API: refresh canvas previews without changing preview_mode.
     *
     * @param {Object}  [opts]
     * @param {boolean} [opts.hard=true]              Re-render all fields; false => only selected.
     * @param {boolean} [opts.rebuild=true]           If hard: rebuild via load_saved_structure().
     * @param {boolean} [opts.reinit=true]            If hard+rebuild: call _reinit_all_fields('preview').
     * @param {boolean} [opts.restore_selection=true] Restore previously selected field.
     * @param {boolean} [opts.restore_scroll=true]    Restore canvas scroll.
     * @param {boolean} [opts.silent_inspector=false] Skip Inspector sync to avoid loops.
     * @param {string}  [opts.source='settings']      Caller tag for logs/events.
     */
    refresh_canvas(opts = {}) {
      if (this.__refreshing_canvas) {
        return;
      }
      this.__refreshing_canvas = true;
      const hard = opts.hard !== false;
      const rebuild = opts.rebuild !== false;
      const reinit = opts.reinit !== false;
      const restore_selection = opts.restore_selection !== false;
      const restore_scroll = opts.restore_scroll !== false;
      const source = opts.source || 'builder';
      const silent_inspector = opts.silent_inspector === true;
      const evs = window.WPBC_BFB_Core && window.WPBC_BFB_Core.WPBC_BFB_Events || {};
      const EV_BEFORE = evs.CANVAS_REFRESH || 'wpbc:bfb:canvas-refresh';
      const EV_AFTER = evs.CANVAS_REFRESHED || 'wpbc:bfb:canvas-refreshed';
      try {
        // Snapshot UI state.
        const in_preview = !!this.preview_mode;
        const canvas = this._canvas_root || document.querySelector('.wpbc_bfb__canvas') || document.body;
        const sc_top = restore_scroll ? canvas ? canvas.scrollTop : 0 : 0;
        let sel_el = null,
          sel_id = null;
        if (restore_selection && typeof this.get_selected_field === 'function') {
          sel_el = this.get_selected_field();
          if (sel_el && sel_el.getAttribute) {
            sel_id = sel_el.getAttribute('data-id');
          }
        }

        // Signal "before" for packs that want to teardown overlays.
        try {
          this.bus && this.bus.emit && this.bus.emit(EV_BEFORE, {
            mode: hard ? 'hard' : 'soft',
            source: source,
            preview: in_preview
          });
        } catch (_) {}

        // Do the work.
        if (!in_preview) {
          // Not in preview: nothing to render, but still emit AFTER later.
        } else if (hard) {
          if (rebuild) {
            this.load_saved_structure(this.get_structure(), {
              deferIfTyping: true
            });
            if (reinit) {
              this._reinit_all_fields('preview');
            }
          } else if (typeof this.render_preview_all === 'function') {
            this.render_preview_all();
            // Some packs initialize in on_field_drop(); hydrate them for soft hard-refresh.
            this._reinit_all_fields('preview');
          } else {
            const nodes = document.querySelectorAll('.wpbc_bfb__field');
            for (let i = 0; i < nodes.length; i++) {
              this.render_preview(nodes[i], {
                force: true
              });
            }
          }
        } else {
          // soft ????
          if (sel_el) {
            this.render_preview(sel_el, {
              force: true
            });
          }
        }

        // Restore selection + scroll.
        if (restore_selection && sel_id && typeof this.select_by_data_id === 'function') {
          this.select_by_data_id(sel_id, {
            silent: true
          });
        }
        if (restore_scroll && canvas) {
          canvas.scrollTop = sc_top;
        }

        // Optional bridge: ask Inspector to sync to the selected element (unless silenced).
        if (!silent_inspector) {
          try {
            this._inspector_bridge && this._inspector_bridge.sync_from_selected && this._inspector_bridge.sync_from_selected();
          } catch (_) {}
        }

        // Signal "after" so packs can re-init widgets (time selector, masks, etc.).
        try {
          this.bus && this.bus.emit && this.bus.emit(EV_AFTER, {
            mode: hard ? 'hard' : 'soft',
            source: source,
            preview: in_preview
          });
        } catch (_) {}
      } finally {
        this.__refreshing_canvas = false;
      }
    }

    /**
     * Optional convenience: render all previews (no rebuild).
     * Useful if you want a fast "hard" refresh without structure reload.
     */
    render_preview_all() {
      const root = this.pages_container || document;
      const nodes = root.querySelectorAll('.wpbc_bfb__panel--preview .wpbc_bfb__field');
      for (let i = 0; i < nodes.length; i++) {
        this.render_preview(nodes[i], {
          force: true
        });
      }
    }

    /**
     * Duplicate a field or section and insert the copy right after the original.
     * - Fields: respects usage limits; generates new unique id/name/html_id + uid; re-renders preview/overlay.
     * - Sections: deep-clones; makes all contained fields unique; re-inits resizers/sortables; re-renders.
     *
     * @param {HTMLElement} el - The .wpbc_bfb__field or .wpbc_bfb__section to duplicate.
     * @returns {HTMLElement|null} The newly inserted copy, or null if blocked (e.g., usage limits).
     */
    duplicate_item(el) {
      if (!el || !(el.classList?.contains('wpbc_bfb__field') || el.classList?.contains('wpbc_bfb__section'))) {
        return null;
      }
      if (el.classList.contains('wpbc_bfb__field')) {
        return this._duplicate_field(el);
      }
      if (el.classList.contains('wpbc_bfb__section')) {
        return this._duplicate_section(el);
      }
      return null;
    }

    /**
     * Duplicate a single field node.
     * Gate by usage limit, rebuild via build_field() so all invariants stay consistent.
     *
     * @private
     * @param {HTMLElement} field_el
     * @returns {HTMLElement|null}
     */
    _duplicate_field(field_el) {
      const data = WPBC_Form_Builder_Helper.get_all_data_attributes(field_el);
      const usageKey = field_el.dataset.usage_key || data.usage_key || data.type || 'field';

      // Respect usage limits.
      if (!this.usage.gate_or_alert(usageKey, {
        label: data.label || usageKey
      })) {
        return null;
      }

      // Build a fresh field; let the builder assign unique id/name/html_id and uid.
      const toBuild = {
        ...data
      };
      // Clear identifiers to force uniqueness on the duplicate.
      delete toBuild.id;
      delete toBuild.name;
      if ('html_id' in toBuild) delete toBuild.html_id;
      // VERY IMPORTANT!: drop the original UID so build_field creates a new one.
      if ('uid' in toBuild) {
        delete toBuild.uid;
      }
      const copy = this.build_field(toBuild);
      if (!copy) return null;
      if (copy.hasAttribute('data-draggable')) {
        copy.removeAttribute('data-draggable');
      }
      copy.classList.add('wpbc_bfb__drag-anywhere');

      // Insert right after original.
      field_el.parentNode.insertBefore(copy, field_el.nextSibling);

      // Announce & hooks.
      this._emit_const(WPBC_BFB_Events.FIELD_ADD, {
        el: copy,
        data: WPBC_Form_Builder_Helper.get_all_data_attributes(copy)
      });
      this.usage.update_palette_ui();
      this.trigger_field_drop_callback(copy, 'drop');
      this.select_field(copy, {
        scrollIntoView: true
      });
      return copy;
    }

    /**
     * Duplicate a section (with all nested fields/sections).
     * Ensures every contained field has unique id/name/html_id and a new uid; re-inits resizers & sortables.
     *
     * @private
     * @param {HTMLElement} section_el - .wpbc_bfb__section
     * @returns {HTMLElement|null}
     */
    _duplicate_section(section_el) {
      if (!section_el || !section_el.classList?.contains('wpbc_bfb__section')) return null;

      // 1) Deep clone + scrub UI artifacts
      const clone = section_el.cloneNode(true);
      clone.querySelectorAll('.wpbc_bfb__overlay-controls,.sortable-ghost,.sortable-chosen,.sortable-fallback').forEach(n => n.remove());

      // Clear flags copied while typing/dragging that can disable DnD.
      const clearDragFlags = n => {
        n.removeAttribute('data-draggable');
        n.removeAttribute('draggable');
      };
      clearDragFlags(clone);
      clone.querySelectorAll('.wpbc_bfb__section, .wpbc_bfb__field').forEach(n => {
        clearDragFlags(n);
        if (n.classList.contains('wpbc_bfb__field')) {
          n.classList.add('wpbc_bfb__drag-anywhere');
        }
      });

      // 1.5) USAGE-LIMIT PREFLIGHT (BLOCK if limits would be exceeded)
      const pre = this._preflight_usage_for_clone(clone, /* strategy */'block'); // Strateg 'block' - show warning and do  not allow to make duplication!
      // const pre = this._preflight_usage_for_clone( clone, /* strategy */ 'strip' ); // Strateg 'strip' - auto-trim elements, from section,  ifthey  out of limits.
      if (!pre.ok) {
        const msg = pre.offenders.map(o => `- “${o.key}” — limit ${o.limit}; have ${o.used}, would add ${o.add}`).join('\n');
        alert(`Cannot duplicate section; usage limits would be exceeded:\n${msg}`);
        this._announce?.('Section duplication blocked by limits.');
        return null;
      }

      // 2) Insert after source
      section_el.insertAdjacentElement('afterend', clone);

      // 3) Make ids/names/uids unique via existing helpers
      this.pages_sections._retag_uids_in_subtree?.(clone);
      this.pages_sections._dedupe_subtree_strict?.(clone);

      // 4) Overlays (outer + ALL nested sections/fields)
      this.add_overlay_toolbar?.(clone);
      clone.querySelectorAll('.wpbc_bfb__section, .wpbc_bfb__field').forEach(el => this.add_overlay_toolbar?.(el));

      // 5) Sortable wiring using helpers
      //    - Sections sortable among siblings (outer + nested)
      this.pages_sections.init_section_sortable?.(clone);
      clone.querySelectorAll('.wpbc_bfb__section').forEach(s => this.pages_sections.init_section_sortable?.(s));

      //    - Field drop zones inside columns/containers.
      this.pages_sections.init_all_nested_sortables?.(clone);

      //    - Defensive pass: ensure every column actually has a Sortable instance
      clone.querySelectorAll('.wpbc_bfb__column').forEach(col => {
        if (typeof Sortable !== 'undefined' && !Sortable.get?.(col)) {
          this.init_sortable?.(col);
        }
      });

      // 6) Resizers (outer + nested) and normalize bases.
      this._init_resizers_for_section?.(clone);
      clone.querySelectorAll('.wpbc_bfb__section').forEach(s => this._init_resizers_for_section?.(s));
      clone.querySelectorAll('.wpbc_bfb__row').forEach(row => {
        const eff = this.layout.compute_effective_bases_from_row(row, this.col_gap_percent);
        this.layout.apply_bases_to_row(row, eff.bases);
      });

      // 7) Rehydrate field renderers (so widgets bind).
      clone.querySelectorAll('.wpbc_bfb__field').forEach(f => this.trigger_field_drop_callback?.(f, 'load'));

      // 8) Housekeeping/UI.
      this.usage?.update_palette_ui?.();
      this.select_field?.(clone, {
        scrollIntoView: true
      });
      this.bus?.emit?.(WPBC_BFB_Events.FIELD_ADD, {
        el: clone,
        id: clone.dataset.id,
        uid: clone.dataset.uid
      });
      return clone;
    }

    /**
     * Create & return a unique-ish uid similar to build_field() semantics.
     *
     * @private
     * @param {string} prefix
     * @returns {string}
     */
    _generate_uid(prefix = 'f') {
      return `${prefix}-${++this._uid_counter}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }

    /**
     * Remove all resizers in a section row and recreate them with working handlers.
     * (Needed because event listeners do not copy on cloneNode(true).)
     *
     * @private
     * @param {HTMLElement} section_el - The cloned .wpbc_bfb__section
     * @returns {void}
     */
    _init_resizers_for_section(section_el) {
      const row = section_el?.querySelector(':scope > .wpbc_bfb__row');
      if (!row) return;
      this._rebuild_resizers_for_row(row);
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
      _resolveReady(window.wpbc_bfb || null);
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
        const esc = WPBC_BFB_Sanitize.esc_attr_value_for_selector(uid);
        const el = b?.pages_container?.querySelector?.(`.wpbc_bfb__field[data-uid="${esc}"], .wpbc_bfb__section[data-uid="${esc}"]`);
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

  // Convenience helpers (idempotent)
  if (window.wpbc_bfb_api) {
    // Sync: returns instance immediately or null
    window.wpbc_bfb_api.get_builder = window.wpbc_bfb_api.get_builder || function () {
      return window.wpbc_bfb || null;
    };

    // Async: always waits for readiness
    window.wpbc_bfb_api.get_builder_async = window.wpbc_bfb_api.get_builder_async || function () {
      return window.wpbc_bfb_api.ready.then(function (b) {
        return b || null;
      });
    };

    // Optional: run callback when ready (no repeated .then everywhere)
    window.wpbc_bfb_api.with_builder = window.wpbc_bfb_api.with_builder || function (fn) {
      return window.wpbc_bfb_api.ready.then(function (b) {
        if (b && typeof fn === 'function') {
          fn(b);
        }
        return b || null;
      });
    };
  }

  // Auto‑bootstrap on DOM ready.
  (function initBuilderWhenReady() {
    const start = () => {
      // Allow PHP to pass initial options to avoid settings flicker.
      // Example: window.wpbc_bfb_bootstrap_opts = { preview_mode: true, col_gap_percent: 3 };.
      const boot_opts = window.wpbc_bfb_bootstrap_opts && typeof window.wpbc_bfb_bootstrap_opts === 'object' ? window.wpbc_bfb_bootstrap_opts : {};
      window.WPBC_BFB.bootstrap(boot_opts);
    };
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
        const $all = $('#wpbc_bfb__inspector, .wpbc_bfb__inspector, .wpbc_bfb__palette, .wpbc_bfb__options_panel');
        if (!$all.length) return;
        $all.removeClass('has-selection is-active');
        $all.each(function () {
          const $pal = jQuery(this);
          $pal.find('[data-for-uid],[data-for-field],[data-panel="field"],[role="tabpanel"]').attr('hidden', true).addClass('is-hidden');
          $pal.find('[role="tab"]').attr({
            'aria-selected': 'false',
            'tabindex': '-1'
          }).removeClass('is-active');
          $pal.find('.wpbc_bfb__inspector-empty, .wpbc_bfb__empty_state, [data-empty-state="true"]').removeAttr('hidden').removeClass('is-hidden');
        });
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
      const EV = WPBC_BFB_Events || {};
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

/**
 * Usage examples:
 *
window.wpbc_bfb_api.with_builder(function (B) {
	B.set_preview_mode(enabled, { rebuild: true, reinit: true, source: 'settings-effects' });
});

 */
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItYnVpbGRlci5qcyIsIm5hbWVzIjpbIndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlIiwibmFtZSIsImRldGFpbCIsIndpbmRvdyIsIkN1c3RvbUV2ZW50IiwiZG9jdW1lbnQiLCJkaXNwYXRjaEV2ZW50IiwiX2UiLCJldiIsImNyZWF0ZUV2ZW50IiwiaW5pdEN1c3RvbUV2ZW50IiwiX2UyIiwidyIsIldQQkNfQkZCX1Nhbml0aXplIiwiV1BCQ19CRkJfSWRTZXJ2aWNlIiwiV1BCQ19CRkJfTGF5b3V0U2VydmljZSIsIldQQkNfQkZCX1VzYWdlTGltaXRTZXJ2aWNlIiwiV1BCQ19CRkJfRXZlbnRzIiwiV1BCQ19CRkJfRXZlbnRCdXMiLCJXUEJDX0JGQl9Tb3J0YWJsZU1hbmFnZXIiLCJXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIiLCJXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSIsIldQQkNfQkZCX0NvcmUiLCJXUEJDX0JGQl9Nb2R1bGUiLCJXUEJDX0JGQl9PdmVybGF5IiwiV1BCQ19CRkJfU2VsZWN0aW9uX0NvbnRyb2xsZXIiLCJXUEJDX0JGQl9JbnNwZWN0b3JfQnJpZGdlIiwiV1BCQ19CRkJfS2V5Ym9hcmRfQ29udHJvbGxlciIsIldQQkNfQkZCX1Jlc2l6ZV9Db250cm9sbGVyIiwiV1BCQ19CRkJfUGFnZXNfU2VjdGlvbnMiLCJXUEJDX0JGQl9TdHJ1Y3R1cmVfSU8iLCJXUEJDX0JGQl9NaW5fV2lkdGhfR3VhcmQiLCJVSSIsIndwYmNfYmZiX19wb3N0X2FqYXhfcHJvbWlzZSIsInVybCIsImRhdGEiLCJQcm9taXNlIiwicmVzb2x2ZSIsInhociIsIlhNTEh0dHBSZXF1ZXN0Iiwib3BlbiIsInNldFJlcXVlc3RIZWFkZXIiLCJvbnJlYWR5c3RhdGVjaGFuZ2UiLCJyZWFkeVN0YXRlIiwic3RhdHVzIiwidGV4dCIsInJlc3BvbnNlVGV4dCIsInBhaXJzIiwiayIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsInB1c2giLCJlbmNvZGVVUklDb21wb25lbnQiLCJzZW5kIiwiam9pbiIsIldQQkNfRm9ybV9CdWlsZGVyIiwiY29uc3RydWN0b3IiLCJvcHRzIiwicHJvdmlkZWRQYWxldHRlcyIsIkFycmF5IiwiaXNBcnJheSIsInBhbGV0dGVfdWxzIiwicGFsZXR0ZV91bCIsImxlbmd0aCIsImZyb20iLCJxdWVyeVNlbGVjdG9yQWxsIiwicGFnZXNfY29udGFpbmVyIiwiZ2V0RWxlbWVudEJ5SWQiLCJFcnJvciIsInBhZ2VfY291bnRlciIsInNlY3Rpb25fY291bnRlciIsIm1heF9uZXN0ZWRfdmFsdWUiLCJOdW1iZXIiLCJpc0Zpbml0ZSIsInByZXZpZXdfbW9kZSIsInVuZGVmaW5lZCIsImNvbF9nYXBfcGVyY2VudCIsIl91aWRfY291bnRlciIsImlkIiwibGF5b3V0IiwidXNhZ2UiLCJidXMiLCJfaGFuZGxlcnMiLCJzb3J0YWJsZSIsIl9tb2R1bGVzIiwidXNlX21vZHVsZSIsIl9pbml0IiwiX2JpbmRfZXZlbnRzIiwiX2VtaXRfY29uc3QiLCJ0eXBlIiwiZW1pdCIsIl9maW5kX25laWdoYm9yX3NlbGVjdGFibGUiLCJlbCIsInBhcmVudEVsZW1lbnQiLCJhbGwiLCJjaGlsZHJlbiIsImZpbHRlciIsIm4iLCJjbGFzc0xpc3QiLCJjb250YWlucyIsImkiLCJpbmRleE9mIiwicGFnZSIsImNsb3Nlc3QiLCJjYW5kaWRhdGUiLCJxdWVyeVNlbGVjdG9yIiwiU29ydGFibGUiLCJjb25zb2xlIiwiZXJyb3IiLCJ3YXJuIiwiZm9yRWFjaCIsInVsIiwiZW5zdXJlIiwid2FpdEZvclJlbmRlcmVycyIsImhhc1JlZ2lzdHJ5IiwiZ2V0Iiwic3RhcnRlZCIsIkRhdGUiLCJub3ciLCJzZXRJbnRlcnZhbCIsIm9rIiwidGltZWRPdXQiLCJjbGVhckludGVydmFsIiwic3RhcnRMb2FkIiwiciIsInNldFRpbWVvdXQiLCJsb2FkZWQiLCJfYXV0b19sb2FkX2luaXRpYWxfZm9ybV9mcm9tX2FqYXgiLCJfYXV0b19vcGVuX2FwcGx5X3RlbXBsYXRlX21vZGFsX2Zyb21fdXJsIiwiY2ZnIiwiV1BCQ19CRkJfQWpheCIsImZhbGxiYWNrX21vZGUiLCJTdHJpbmciLCJpbml0aWFsX2xvYWRfZmFsbGJhY2siLCJ0b0xvd2VyQ2FzZSIsImFkZF9wYWdlIiwiZXhhbXBsZV9zdHJ1Y3R1cmUiLCJ3cGJjX2JmYl9fZm9ybV9zdHJ1Y3R1cmVfX2dldF9leGFtcGxlIiwibG9hZF9zYXZlZF9zdHJ1Y3R1cmUiLCJhZGRFdmVudExpc3RlbmVyIiwiX3N0YXJ0X3VzYWdlX29ic2VydmVyIiwiX3N0YXJ0X3BhZ2VzX251bWJlcmluZ19vYnNlcnZlciIsIl9nZXRSZW5kZXJlciIsIl91c2FnZV9vYnNlcnZlciIsInJlZnJlc2giLCJkZWJvdW5jZSIsInVwZGF0ZV9wYWxldHRlX3VpIiwib2JzZXJ2ZSIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJlIiwiX3dwYmMiLCJkZXYiLCJjb25maWciLCJhdHRyaWJ1dGVzIiwiYXR0cmlidXRlRmlsdGVyIiwiTXV0YXRpb25PYnNlcnZlciIsIl9hZGRfZHJhZ2dpbmdfY2xhc3MiLCJjb2wiLCJhZGQiLCJfcmVtb3ZlX2RyYWdnaW5nX2NsYXNzIiwicmVtb3ZlIiwiYWRkX3BhZ2VfYnRuIiwiX29uIiwicHJldmVudERlZmF1bHQiLCJfYW5ub3VuY2UiLCJmIiwidGFyZ2V0Iiwic2V0QXR0cmlidXRlIiwicmVtb3ZlQXR0cmlidXRlIiwiX3JlaW5pdF9hbGxfZmllbGRzIiwiY29udGV4dCIsImZpZWxkX2VsIiwidHJpZ2dlcl9maWVsZF9kcm9wX2NhbGxiYWNrIiwiX2dldF9yb3dfY29scyIsInJvd19lbCIsIl9nZXRfcGFnZXNfaW5fZG9tX29yZGVyIiwiX2dldF9wYWdlX251bWJlcl9oZWFkaW5nX2VsIiwicGFnZV9lbCIsIl9zZXRfcGFnZV9udW1iZXJfaGVhZGluZ190ZXh0IiwiaGVhZGluZ19lbCIsInBhZ2VfbnVtYmVyIiwidGV4dF9ub2RlcyIsImNoaWxkTm9kZXMiLCJub2RlVHlwZSIsInJhdyIsIm5vZGVWYWx1ZSIsInJlcGxhY2UiLCJ0cmltIiwibmV4dCIsInRlc3QiLCJpbnNlcnRCZWZvcmUiLCJjcmVhdGVUZXh0Tm9kZSIsImZpcnN0Q2hpbGQiLCJyZW51bWJlcl9wYWdlc19pbl9jYW52YXMiLCJzb3VyY2UiLCJwYWdlcyIsIlBBR0VTX1JFTlVNQkVSRUQiLCJfcGFnZXNfbnVtYmVyaW5nX29ic2VydmVyIiwiZG9fcmVudW1iZXIiLCJtdXRhdGlvbnMiLCJ0b3VjaGVkX3BhZ2VzIiwibSIsIm5vZGVzIiwiY29uY2F0IiwiYWRkZWROb2RlcyIsInJlbW92ZWROb2RlcyIsIl9iaW5kX3Jlc2l6ZXIiLCJyZXNpemVyIiwiaGFuZGxlciIsImluaXRfcmVzaXplX2hhbmRsZXIiLCJtc2ciLCJXUEJDX0RFVl9TVFJJQ1QiLCJsYXRlIiwiaXNDb25uZWN0ZWQiLCJfY3JlYXRlX3Jlc2l6ZXIiLCJjcmVhdGVfZWxlbWVudCIsIl9yZWJ1aWxkX3Jlc2l6ZXJzX2Zvcl9yb3ciLCJjb2xzIiwiaW5zZXJ0QWRqYWNlbnRFbGVtZW50IiwiX3NldF9maWVsZF9pZCIsIm5ld0lkUmF3IiwidW5pcXVlIiwic2V0X2ZpZWxkX2lkIiwicmVuZGVyX3ByZXZpZXciLCJfc2V0X2ZpZWxkX25hbWUiLCJuZXdOYW1lUmF3Iiwic2V0X2ZpZWxkX25hbWUiLCJfc2V0X2ZpZWxkX2h0bWxfaWQiLCJuZXdIdG1sSWRSYXciLCJhcHBsaWVkIiwic2V0X2ZpZWxkX2h0bWxfaWQiLCJsaXZlIiwiY3JlYXRlRWxlbWVudCIsInN0eWxlIiwicG9zaXRpb24iLCJsZWZ0IiwidG9wIiwiYm9keSIsImFwcGVuZENoaWxkIiwidGV4dENvbnRlbnQiLCJfZ2V0X3VzYWdlX2tleSIsImRhdGFzZXQiLCJ1c2FnZV9rZXkiLCJfY291bnRfdXNlZF9pbl9jYW52YXMiLCJrZXkiLCJlc2MiLCJlc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IiLCJfZ2V0X3BhbGV0dGVfbGltaXRfZm9yX2tleSIsImNhbmRpZGF0ZXMiLCJtYXAiLCJCb29sZWFuIiwicGVsIiwidXNhZ2VudW1iZXIiLCJJbmZpbml0eSIsIl90YWxseV91c2FnZV9pbl9zdWJ0cmVlIiwicm9vdF9lbCIsInRhbGx5IiwiX3ByZWZsaWdodF91c2FnZV9mb3JfY2xvbmUiLCJjbG9uZSIsInN0cmF0ZWd5Iiwib2ZmZW5kZXJzIiwiZW50cmllcyIsImFkZENvdW50IiwibGltaXQiLCJ1c2VkIiwicmVtYWluaW5nIiwidG9SZW1vdmUiLCJzbGljZSIsIk1hdGgiLCJtYXgiLCJyZSIsInN0aWxsQmFkIiwic29tZSIsIm5vbmNlX2xvYWQiLCJwYXlsb2FkIiwiYWN0aW9uIiwibG9hZF9hY3Rpb24iLCJub25jZSIsImZvcm1fbmFtZSIsInJlc3AiLCJKU09OIiwicGFyc2UiLCJzdWNjZXNzIiwiZW5naW5lIiwiYWR2YW5jZWRfZm9ybSIsImNvbnRlbnRfZm9ybSIsImFmIiwiY2YiLCJ0YV9mb3JtIiwidGFfY29udGVudCIsInZhbHVlIiwiYWR2X21vZGVfc3JjIiwic2V0dGluZ3MiLCJzIiwiYmZiX29wdGlvbnMiLCJhZHZhbmNlZF9tb2RlX3NvdXJjZSIsInNhdmVfc291cmNlIiwibG9hZGVkX2RhdGEiLCJzdHJ1Y3R1cmUiLCJXUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzIiwicmVhcHBseV9hZnRlcl9jYW52YXMiLCJfZV9meCIsIl9lX2Z4MiIsImpRdWVyeSIsInBhcmVudHMiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsIl9fd3BiY19iZmJfYXV0b19vcGVuX3RlbXBsYXRlX2RvbmUiLCJocmVmIiwibG9jYXRpb24iLCJyYXdfdmFsdWUiLCJ1IiwiVVJMIiwic2VhcmNoUGFyYW1zIiwiX2UwIiwibWF0Y2giLCJkZWNvZGVVUklDb21wb25lbnQiLCJfZTEiLCJzZWFyY2hfa2V5Iiwic2VwIiwidGVtcGxhdGVfc2VhcmNoX29yX3NlcCIsInVybFNlcCIsInRlbXBsYXRlX3NlYXJjaF9vcl9zZXBfdXJsIiwiZXNjU2VwIiwiZXNjVXJsU2VwIiwiUmVnRXhwIiwiX2Vfc2VwIiwicmVhZHkiLCJfd2FpdF9mb3JfYXBwbHlfdGVtcGxhdGVfc2VhcmNoX2ZuIiwid3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlX3NlYXJjaCIsIl9lMyIsInRpbWVvdXRfbXMiLCJwYXJzZUludCIsImlzX3JlYWR5IiwidCIsIk1vZHVsZV9DbGFzcyIsIm9wdGlvbnMiLCJtb2QiLCJpbml0IiwiZGVzdHJveSIsImRpc2Nvbm5lY3QiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZGVzdHJveUFsbCIsImluc3BlY3RvciIsImluaXRfc29ydGFibGUiLCJjb250YWluZXIiLCJvbl9hZGRfY2FsbGJhY2siLCJoYW5kbGVfb25fYWRkIiwiYmluZCIsIm9uQWRkIiwiZXZ0IiwiaXRlbSIsInRvIiwibmVzdGluZ19sZXZlbCIsImdldF9uZXN0aW5nX2xldmVsIiwiYWxlcnQiLCJpbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzIiwiYWRkX292ZXJsYXlfdG9vbGJhciIsInJvdyIsInNldF9lcXVhbF9iYXNlcyIsInNlbGVjdF9maWVsZCIsInNjcm9sbEludG9WaWV3IiwiaXNfZnJvbV9wYWxldHRlIiwiaW5jbHVkZXMiLCJwYWxldHRlSWQiLCJmaWVsZF9kYXRhIiwiZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMiLCJ1aWQiLCJnYXRlX29yX2FsZXJ0IiwibGFiZWwiLCJyZWJ1aWx0IiwiYnVpbGRfZmllbGQiLCJzZWxlY3RvciIsImRyYWdnYWJsZSIsInNjb3BlZFNlbGVjdG9yIiwic3BsaXQiLCJkcmFnZ2FibGVzIiwiYmVmb3JlIiwiaXNJbnRlZ2VyIiwibmV3SW5kZXgiLCJkZWNvcmF0ZV9maWVsZCIsIkZJRUxEX0FERCIsIkZpZWxkQ2xhc3MiLCJvbl9maWVsZF9kcm9wIiwiZXJyIiwic2VjdGlvbl9lbCIsImxldmVsIiwicGFyZW50Iiwib3V0ZXIiLCJkZXNpcmVkSWRSYXciLCJiYXNlIiwicmFuZG9tIiwidG9TdHJpbmciLCJkZXNpcmVkSWQiLCJzYW5pdGl6ZV9odG1sX2lkIiwidXNhZ2VLZXkiLCJlbnN1cmVfdW5pcXVlX2ZpZWxkX2lkIiwiZGVzaXJlZE5hbWUiLCJzYW5pdGl6ZV9odG1sX25hbWUiLCJlbnN1cmVfdW5pcXVlX2ZpZWxkX25hbWUiLCJpc191c2FnZV9vayIsIl9nZW5lcmF0ZV91aWQiLCJfZGlzY2FyZFVpZCIsInNhZmVEYXRhIiwic2V0X2RhdGFfYXR0cmlidXRlcyIsIm1pbl9yYXciLCJtaW5fd2lkdGgiLCJtaW5XaWR0aCIsImlubmVySFRNTCIsInJlbmRlcl9maWVsZF9pbm5lcl9odG1sIiwiaGFzRXhwbGljaXRMYWJlbCIsIlIiLCJyZW5kZXIiLCJjdHgiLCJtb2RlIiwiYnVpbGRlciIsInRwbCIsIndwIiwidGVtcGxhdGUiLCJzYW5pdCIsIm9uY2UiLCJoeWRyYXRlIiwiYWZ0ZXJfcmVuZGVyIiwiZXJyMiIsIm1vdmVfaXRlbSIsImRpcmVjdGlvbiIsInNpYmxpbmdzIiwiY2hpbGQiLCJjdXJyZW50X2luZGV4IiwibmV3X2luZGV4IiwicmVmZXJlbmNlX25vZGUiLCJuZXh0U2libGluZyIsInNldF9zZWN0aW9uX2NvbHVtbnMiLCJuZXdfY291bnRfcmF3Iiwib2xkX2NvbHMiLCJjdXJyZW50IiwibWluX2MiLCJtYXhfYyIsIm1pbiIsImZsZXhCYXNpcyIsIlNUUlVDVFVSRV9DSEFOR0UiLCJzZWN0aW9uIiwiY291bnQiLCJjb2xzX25vdyIsImxhc3QiLCJwcmV2IiwiY29tcHV0ZWQiLCJjb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3JvdyIsImFwcGx5X2Jhc2VzX3RvX3JvdyIsImJhc2VzIiwic2V0X3ByZXZpZXdfbW9kZSIsImVuYWJsZWQiLCJyZWJ1aWxkIiwicmVpbml0IiwiZ2V0X3N0cnVjdHVyZSIsImRlZmVySWZUeXBpbmciLCJQUkVWSUVXX01PREVfQ0hBTkdFIiwiXyIsInJlZnJlc2hfY2FudmFzIiwiX19yZWZyZXNoaW5nX2NhbnZhcyIsImhhcmQiLCJyZXN0b3JlX3NlbGVjdGlvbiIsInJlc3RvcmVfc2Nyb2xsIiwic2lsZW50X2luc3BlY3RvciIsImV2cyIsIkVWX0JFRk9SRSIsIkNBTlZBU19SRUZSRVNIIiwiRVZfQUZURVIiLCJDQU5WQVNfUkVGUkVTSEVEIiwiaW5fcHJldmlldyIsImNhbnZhcyIsIl9jYW52YXNfcm9vdCIsInNjX3RvcCIsInNjcm9sbFRvcCIsInNlbF9lbCIsInNlbF9pZCIsImdldF9zZWxlY3RlZF9maWVsZCIsImdldEF0dHJpYnV0ZSIsInByZXZpZXciLCJyZW5kZXJfcHJldmlld19hbGwiLCJmb3JjZSIsInNlbGVjdF9ieV9kYXRhX2lkIiwic2lsZW50IiwiX2luc3BlY3Rvcl9icmlkZ2UiLCJzeW5jX2Zyb21fc2VsZWN0ZWQiLCJyb290IiwiZHVwbGljYXRlX2l0ZW0iLCJfZHVwbGljYXRlX2ZpZWxkIiwiX2R1cGxpY2F0ZV9zZWN0aW9uIiwidG9CdWlsZCIsImh0bWxfaWQiLCJjb3B5IiwiaGFzQXR0cmlidXRlIiwicGFyZW50Tm9kZSIsImNsb25lTm9kZSIsImNsZWFyRHJhZ0ZsYWdzIiwicHJlIiwibyIsInBhZ2VzX3NlY3Rpb25zIiwiX3JldGFnX3VpZHNfaW5fc3VidHJlZSIsIl9kZWR1cGVfc3VidHJlZV9zdHJpY3QiLCJpbml0X3NlY3Rpb25fc29ydGFibGUiLCJfaW5pdF9yZXNpemVyc19mb3Jfc2VjdGlvbiIsImVmZiIsInByZWZpeCIsIldQQkNfQkZCIiwiYm9vdHN0cmFwIiwiYiIsIndwYmNfYmZiIiwid3BiY19iZmJfYXBpIiwiX3Jlc29sdmVSZWFkeSIsImdldF9zZWxlY3Rpb25fZWwiLCJnZXRfc2VsZWN0aW9uX3VpZCIsImNsZWFyIiwic2VsZWN0X2J5X3VpZCIsImxvYWRfc3RydWN0dXJlIiwib24iLCJldmVudF9uYW1lIiwib2ZmIiwiZ2V0X2J1aWxkZXIiLCJnZXRfYnVpbGRlcl9hc3luYyIsInRoZW4iLCJ3aXRoX2J1aWxkZXIiLCJmbiIsImluaXRCdWlsZGVyV2hlblJlYWR5Iiwic3RhcnQiLCJib290X29wdHMiLCJ3cGJjX2JmYl9ib290c3RyYXBfb3B0cyIsIiQiLCJLRUVQX0NMSUNLX1NFTCIsInJlc2V0SW5zcGVjdG9yVUkiLCIkYWxsIiwicmVtb3ZlQ2xhc3MiLCJlYWNoIiwiJHBhbCIsImZpbmQiLCJhdHRyIiwiYWRkQ2xhc3MiLCJyZW1vdmVBdHRyIiwiaGFuZGxlQ2xlYXJTZWxlY3Rpb24iLCJzcmMiLCJFViIsIkNMRUFSX1NFTEVDVElPTiIsIiR0IiwiZ2V0U2VsZWN0aW9uIiwib3JpZ2luYWxFdmVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYmZiLWJ1aWxkZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fb3V0L2JmYi1idWlsZGVyLmpzID09IFRpbWUgcG9pbnQ6IDIwMjUtMDktMDYgMTQ6MDhcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogRGlzcGF0Y2ggYSBET00gZXZlbnQgc2FmZWx5LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZVxyXG4gKiBAcGFyYW0ge09iamVjdH0gZGV0YWlsXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZShuYW1lLCBkZXRhaWwpIHtcclxuXHR0cnkge1xyXG5cdFx0aWYgKCB0eXBlb2Ygd2luZG93LkN1c3RvbUV2ZW50ID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoIG5hbWUsIHsgZGV0YWlsOiBkZXRhaWwgfHwge30gfSApICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHR9IGNhdGNoICggX2UgKSB7fVxyXG5cclxuXHR0cnkge1xyXG5cdFx0Y29uc3QgZXYgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xyXG5cdFx0ZXYuaW5pdEN1c3RvbUV2ZW50KCBuYW1lLCB0cnVlLCB0cnVlLCBkZXRhaWwgfHwge30gKTtcclxuXHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoIGV2ICk7XHJcblx0fSBjYXRjaCAoIF9lMiApIHt9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBRdWljaywgY29weS1wYXN0ZSBjb25zb2xlIHNuaXBwZXRzIHlvdSBjYW4gdXNlIG9uIHRoZSBCdWlsZGVyIHBhZ2UgdG8gZXhlcmNpc2UgZXZlcnkgcmVmcmVzaCBwYXRoLlxyXG5cclxuXHRTaW1wbGUgLSBGdWxsIHJlYnVpbGQgKyByZWluaXQgKERFRkFVTFRTKS4gVXNlIHRoaXMgd2hlbiBtYXJrdXAvcmVuZGVyZXJzIGNoYW5nZS5cclxuXHR3cGJjX2JmYi5yZWZyZXNoX2NhbnZhcygpO1xyXG5cclxuXHJcblx0R2V0IHRoZSBidWlsZGVyXHJcblx0Ly8gQWx3YXlzIGRvIHRoaXMgZmlyc3Q6XHJcblx0d3BiY19iZmJfYXBpLnJlYWR5LnRoZW4oYiA9PiB7IHdpbmRvdy5fX0IgPSBiOyBjb25zb2xlLmxvZygnQkZCIHJlYWR5JywgYik7IH0pO1xyXG5cclxuXHJcblx0Tm93IHlvdSBjYW4gY2FsbCBfX0IucmVmcmVzaF9jYW52YXMoLi4uKSBkaXJlY3RseS5cclxuXHJcblx0SGFyZCByZWZyZXNoIChkZWZhdWx0KVxyXG5cdC8vIEZ1bGwgcmVidWlsZCArIHJlaW5pdCAoREVGQVVMVFMpLiBVc2UgdGhpcyB3aGVuIG1hcmt1cC9yZW5kZXJlcnMgY2hhbmdlLlxyXG5cdF9fQi5yZWZyZXNoX2NhbnZhcygpO1xyXG5cdC8vIFNhbWUsIGJ1dCBleHBsaWNpdDpcclxuXHRfX0IucmVmcmVzaF9jYW52YXMoeyBoYXJkOnRydWUsIHJlYnVpbGQ6dHJ1ZSwgcmVpbml0OnRydWUsIHNvdXJjZTonY29uc29sZScgfSk7XHJcblxyXG5cdEhhcmQgcmVmcmVzaCBXSVRIT1VUIHJlYnVpbGRcclxuXHQvLyBSZS1yZW5kZXIgYWxsIGZpZWxkcyBpbiBwbGFjZSwgdGhlbiBoeWRyYXRlIHBhY2tzLiBGYXN0ZXIgd2hlbiBzdHJ1Y3R1cmUgZGlkbuKAmXQgY2hhbmdlLlxyXG5cdF9fQi5yZWZyZXNoX2NhbnZhcyh7IGhhcmQ6dHJ1ZSwgcmVidWlsZDpmYWxzZSwgc291cmNlOidjb25zb2xlJyB9KTtcclxuXHJcblx0SGFyZCByZWZyZXNoIGJ1dCBza2lwIGZpZWxkIHJlaW5pdFxyXG5cdC8vIElmIHlvdSBrbm93IHBhY2tzIGRvbuKAmXQgbmVlZCBvbl9maWVsZF9kcm9wIHJlLXdpcmluZzpcclxuXHRfX0IucmVmcmVzaF9jYW52YXMoeyBoYXJkOnRydWUsIHJlYnVpbGQ6dHJ1ZSwgcmVpbml0OmZhbHNlLCBzb3VyY2U6J2NvbnNvbGUnIH0pO1xyXG5cclxuXHRTb2Z0IHJlZnJlc2ggKG9ubHkgc2VsZWN0ZWQgZmllbGQpXHJcblx0Ly8gMSkgU2VsZWN0IGEgZmllbGQgKGZpcnN0IGZvdW5kKSBzbyBzb2Z0IHJlZnJlc2ggaGFzIGEgdGFyZ2V0OlxyXG5cdF9fQi5zZWxlY3RfZmllbGQoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLndwYmNfYmZiX19maWVsZCcpLCB7IHNjcm9sbEludG9WaWV3OmZhbHNlIH0pO1xyXG5cclxuXHQvLyAyKSBSZS1yZW5kZXIganVzdCB0aGF0IGZpZWxkOlxyXG5cdF9fQi5yZWZyZXNoX2NhbnZhcyh7IGhhcmQ6ZmFsc2UsIHNvdXJjZTonY29uc29sZScgfSk7XHJcblxyXG5cdFJlc3RvcmUgYmVoYXZpb3IgdG9nZ2xlc1xyXG5cdC8vIERvbuKAmXQgcmVzdG9yZSBzZWxlY3Rpb24vc2Nyb2xsIGFmdGVyIHJlZnJlc2g6XHJcblx0X19CLnJlZnJlc2hfY2FudmFzKHsgcmVzdG9yZV9zZWxlY3Rpb246ZmFsc2UsIHJlc3RvcmVfc2Nyb2xsOmZhbHNlLCBzb3VyY2U6J2NvbnNvbGUnIH0pO1xyXG5cclxuXHRBdm9pZCBpbnNwZWN0b3Ig4oaUIGNhbnZhcyDigJxlY2hv4oCdXHJcblx0Ly8gVXNlIHdoZW4gY2FsbGluZyBmcm9tIEluc3BlY3Rvci1saWtlIGNvZGUgdG8gcHJldmVudCBwaW5nLXBvbmc6XHJcblx0X19CLnJlZnJlc2hfY2FudmFzKHsgaGFyZDp0cnVlLCByZWJ1aWxkOnRydWUsIHJlaW5pdDp0cnVlLCBzaWxlbnRfaW5zcGVjdG9yOnRydWUsIHNvdXJjZTonY29uc29sZScgfSk7XHJcblxyXG5cdFByZXZpZXcgbW9kZSBndWFyZCAoanVzdCB0byB2ZXJpZnkgYmVoYXZpb3IpXHJcblx0Ly8gVHVybiBwcmV2aWV3IE9GRiBhbmQgdHJ5IGEgcmVmcmVzaCAobm8gcmUtcmVuZGVyaW5nIHdpbGwgaGFwcGVuKTpcclxuXHRfX0Iuc2V0X3ByZXZpZXdfbW9kZShmYWxzZSwgeyByZWJ1aWxkOmZhbHNlIH0pO1xyXG5cdF9fQi5yZWZyZXNoX2NhbnZhcyh7IGhhcmQ6dHJ1ZSwgc291cmNlOidjb25zb2xlJyB9KTtcclxuXHJcblx0Ly8gVHVybiBwcmV2aWV3IE9OIGFnYWluIGFuZCByZWJ1aWxkOlxyXG5cdF9fQi5zZXRfcHJldmlld19tb2RlKHRydWUsIHsgcmVidWlsZDp0cnVlLCByZWluaXQ6dHJ1ZSwgc291cmNlOidjb25zb2xlJyB9KTtcclxuXHJcblx0V2F0Y2ggZXZlbnRzIChiZWZvcmUvYWZ0ZXIpXHJcblx0d3BiY19iZmJfYXBpLnJlYWR5LnRoZW4oYiA9PiB7XHJcblx0ICBjb25zdCBFViA9ICh3aW5kb3cuV1BCQ19CRkJfQ29yZSAmJiBXUEJDX0JGQl9Db3JlLldQQkNfQkZCX0V2ZW50cykgfHwge307XHJcblx0ICBiLmJ1cy5vbihFVi5DQU5WQVNfUkVGUkVTSCB8fCAnd3BiYzpiZmI6Y2FudmFzLXJlZnJlc2gnLCAgIHAgPT4gY29uc29sZS5sb2coJ0JFRk9SRScsIHApKTtcclxuXHQgIGIuYnVzLm9uKEVWLkNBTlZBU19SRUZSRVNIRUQgfHwgJ3dwYmM6YmZiOmNhbnZhcy1yZWZyZXNoZWQnLCBwID0+IGNvbnNvbGUubG9nKCdBRlRFUiAnLCBwKSk7XHJcblx0fSk7XHJcblxyXG5cdFNhbml0eSBjaGVja3Mgd2hpbGUgdGVzdGluZ1xyXG5cdC8vIElzIGEgcmVmcmVzaCBhbHJlYWR5IGluIHByb2dyZXNzPyAocmVlbnRyYW5jeSBndWFyZClcclxuXHRfX0IuX19yZWZyZXNoaW5nX2NhbnZhc1xyXG5cclxuXHQvLyBTZWUgd2hhdOKAmXMgY3VycmVudGx5IHNlbGVjdGVkIChmb3Igc29mdCByZWZyZXNoKTpcclxuXHRfX0IuZ2V0X3NlbGVjdGVkX2ZpZWxkPy4oKVxyXG5cclxuXHQvLyBNYW51YWxseSBzZWxlY3QgYnkgZGF0YS1pZCAodG8gdGVzdCBzZWxlY3Rpb24gcmVzdG9yZSk6XHJcblx0Y29uc3QgaWQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX2ZpZWxkJyk/LmRhdGFzZXQ/LmlkO1xyXG5cdF9fQi5zZWxlY3RfYnlfZGF0YV9pZD8uKGlkLCB7IHNpbGVudDp0cnVlIH0pO1xyXG4gKlxyXG4gKi9cclxuKGZ1bmN0aW9uICh3KSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRjb25zdCB7XHJcblx0XHRcdCAgV1BCQ19CRkJfU2FuaXRpemUsXHJcblx0XHRcdCAgV1BCQ19CRkJfSWRTZXJ2aWNlLFxyXG5cdFx0XHQgIFdQQkNfQkZCX0xheW91dFNlcnZpY2UsXHJcblx0XHRcdCAgV1BCQ19CRkJfVXNhZ2VMaW1pdFNlcnZpY2UsXHJcblx0XHRcdCAgV1BCQ19CRkJfRXZlbnRzLFxyXG5cdFx0XHQgIFdQQkNfQkZCX0V2ZW50QnVzLFxyXG5cdFx0XHQgIFdQQkNfQkZCX1NvcnRhYmxlTWFuYWdlcixcclxuXHRcdFx0ICAvLyBXUEJDX0JGQl9ET00sXHJcblx0XHRcdCAgV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLFxyXG5cdFx0XHQgIFdQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5XHJcblx0XHQgIH0gPSB3LldQQkNfQkZCX0NvcmU7XHJcblxyXG5cdC8vIE5PVEU6IFVJIGlzIG5vdyB1bmRlciBXUEJDX0JGQl9Db3JlLlVJLlxyXG5cdGNvbnN0IHtcclxuXHRcdFx0ICBXUEJDX0JGQl9Nb2R1bGUsXHJcblx0XHRcdCAgV1BCQ19CRkJfT3ZlcmxheSxcclxuXHRcdFx0ICAvLyBXUEJDX0JGQl9MYXlvdXRfQ2hpcHMsXHJcblx0XHRcdCAgV1BCQ19CRkJfU2VsZWN0aW9uX0NvbnRyb2xsZXIsXHJcblx0XHRcdCAgV1BCQ19CRkJfSW5zcGVjdG9yX0JyaWRnZSxcclxuXHRcdFx0ICBXUEJDX0JGQl9LZXlib2FyZF9Db250cm9sbGVyLFxyXG5cdFx0XHQgIFdQQkNfQkZCX1Jlc2l6ZV9Db250cm9sbGVyLFxyXG5cdFx0XHQgIFdQQkNfQkZCX1BhZ2VzX1NlY3Rpb25zLFxyXG5cdFx0XHQgIFdQQkNfQkZCX1N0cnVjdHVyZV9JTyxcclxuXHRcdFx0ICBXUEJDX0JGQl9NaW5fV2lkdGhfR3VhcmRcclxuXHRcdCAgfSA9IHcuV1BCQ19CRkJfQ29yZS5VSTtcclxuXHJcblxyXG5cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3Bvc3RfYWpheF9wcm9taXNlKHVybCwgZGF0YSkge1xyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKCBmdW5jdGlvbiAocmVzb2x2ZSkge1xyXG5cdFx0XHRjb25zdCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuXHRcdFx0eGhyLm9wZW4oICdQT1NUJywgdXJsLCB0cnVlICk7XHJcblx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKCAnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOCcgKTtcclxuXHJcblx0XHRcdHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0aWYgKCB4aHIucmVhZHlTdGF0ZSAhPT0gNCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmVzb2x2ZSgge1xyXG5cdFx0XHRcdFx0XHRcdCBzdGF0dXM6IHhoci5zdGF0dXMsXHJcblx0XHRcdFx0XHRcdFx0IHRleHQgIDogeGhyLnJlc3BvbnNlVGV4dFxyXG5cdFx0XHRcdFx0XHQgfSApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgcGFpcnMgPSBbXTtcclxuXHRcdFx0Zm9yICggY29uc3QgayBpbiBkYXRhICkge1xyXG5cdFx0XHRcdGlmICggISBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGRhdGEsIGsgKSApIHtcclxuXHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRwYWlycy5wdXNoKCBlbmNvZGVVUklDb21wb25lbnQoIGsgKSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCggZGF0YVtrXSApICk7XHJcblx0XHRcdH1cclxuXHRcdFx0eGhyLnNlbmQoIHBhaXJzLmpvaW4oICcmJyApICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuIFx0Y2xhc3MgV1BCQ19Gb3JtX0J1aWxkZXIge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29uc3RydWN0b3IgZm9yIEJvb2tpbmcgRm9ybSBCdWlsZGVyIGNsYXNzLlxyXG5cdFx0ICogSW5pdGlhbGl6ZXMgVUkgZWxlbWVudHMsIFNvcnRhYmxlSlMsIGFuZCBldmVudCBsaXN0ZW5lcnMuXHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKCBvcHRzID0ge30gKSB7XHJcblx0XHRcdC8vIEFsbG93IERJL292ZXJyaWRlcyB2aWEgb3B0cyB3aGlsZSBrZWVwaW5nIGRlZmF1bHRzLlxyXG5cdFx0XHQvLyBCYWNrLWNvbXBhdDogYWNjZXB0IGVpdGhlciBhIHNpbmdsZSBVTCB2aWEgb3B0cy5wYWxldHRlX3VsIG9yIGFuIGFycmF5IHZpYSBvcHRzLnBhbGV0dGVfdWxzLlxyXG5cdFx0XHRjb25zdCBwcm92aWRlZFBhbGV0dGVzID0gQXJyYXkuaXNBcnJheSggb3B0cy5wYWxldHRlX3VscyApID8gb3B0cy5wYWxldHRlX3VscyA6IChvcHRzLnBhbGV0dGVfdWwgPyBbIG9wdHMucGFsZXR0ZV91bCBdIDogW10pO1xyXG5cdFx0XHR0aGlzLnBhbGV0dGVfdWxzID0gcHJvdmlkZWRQYWxldHRlcy5sZW5ndGggPyBwcm92aWRlZFBhbGV0dGVzIDogQXJyYXkuZnJvbSggZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsJyApICk7XHJcblxyXG5cdFx0XHR0aGlzLnBhZ2VzX2NvbnRhaW5lciAgICAgPSBvcHRzLnBhZ2VzX2NvbnRhaW5lciB8fCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19wYWdlc19jb250YWluZXInICk7XHJcblx0XHRcdGlmICggISB0aGlzLnBhZ2VzX2NvbnRhaW5lciApIHtcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdXUEJDOiBwYWdlcyBjb250YWluZXIgbm90IGZvdW5kLicgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnBhZ2VfY291bnRlciAgICAgPSAwO1xyXG5cdFx0XHR0aGlzLnNlY3Rpb25fY291bnRlciAgPSAwO1xyXG5cdFx0XHR0aGlzLm1heF9uZXN0ZWRfdmFsdWUgPSBOdW1iZXIuaXNGaW5pdGUoICtvcHRzLm1heF9uZXN0ZWRfdmFsdWUgKSA/ICtvcHRzLm1heF9uZXN0ZWRfdmFsdWUgOiA1O1xyXG5cdFx0XHR0aGlzLnByZXZpZXdfbW9kZSAgICAgPSAoIG9wdHMucHJldmlld19tb2RlICE9PSB1bmRlZmluZWQgKSA/ICEhb3B0cy5wcmV2aWV3X21vZGUgOiB0cnVlO1xyXG5cdFx0XHR0aGlzLmNvbF9nYXBfcGVyY2VudCAgPSBOdW1iZXIuaXNGaW5pdGUoICtvcHRzLmNvbF9nYXBfcGVyY2VudCApID8gK29wdHMuY29sX2dhcF9wZXJjZW50IDogMzsgLy8gJSBnYXAgYmV0d2VlbiBjb2x1bW5zIGZvciBsYXlvdXQgbWF0aC5cclxuXHRcdFx0dGhpcy5fdWlkX2NvdW50ZXIgICAgID0gMDtcclxuXHJcblx0XHRcdC8vIFNlcnZpY2UgaW5zdGFuY2VzLlxyXG5cdFx0XHR0aGlzLmlkICAgICAgICA9IG5ldyBXUEJDX0JGQl9JZFNlcnZpY2UoIHRoaXMucGFnZXNfY29udGFpbmVyICk7XHJcblx0XHRcdHRoaXMubGF5b3V0ICAgID0gbmV3IFdQQkNfQkZCX0xheW91dFNlcnZpY2UoIHsgY29sX2dhcF9wZXJjZW50OiB0aGlzLmNvbF9nYXBfcGVyY2VudCB9ICk7XHJcblx0XHRcdHRoaXMudXNhZ2UgICAgID0gbmV3IFdQQkNfQkZCX1VzYWdlTGltaXRTZXJ2aWNlKCB0aGlzLnBhZ2VzX2NvbnRhaW5lciwgdGhpcy5wYWxldHRlX3VscyApO1xyXG5cdFx0XHR0aGlzLmJ1cyAgICAgICA9IG5ldyBXUEJDX0JGQl9FdmVudEJ1cyggdGhpcy5wYWdlc19jb250YWluZXIgKTtcclxuXHRcdFx0dGhpcy5faGFuZGxlcnMgPSBbXTtcclxuXHRcdFx0dGhpcy5zb3J0YWJsZSAgPSBuZXcgV1BCQ19CRkJfU29ydGFibGVNYW5hZ2VyKCB0aGlzICk7XHJcblxyXG5cdFx0XHR0aGlzLl9tb2R1bGVzID0gW107ICAgLyoqIEB0eXBlIHtBcnJheTxXUEJDX0JGQl9Nb2R1bGU+fSAqL1xyXG5cclxuXHRcdFx0Ly8gUmVnaXN0ZXIgbW9kdWxlcy5cclxuXHRcdFx0dGhpcy51c2VfbW9kdWxlKCBXUEJDX0JGQl9TZWxlY3Rpb25fQ29udHJvbGxlciApO1xyXG5cdFx0XHR0aGlzLnVzZV9tb2R1bGUoIFdQQkNfQkZCX0luc3BlY3Rvcl9CcmlkZ2UgKTtcclxuXHRcdFx0dGhpcy51c2VfbW9kdWxlKCBXUEJDX0JGQl9SZXNpemVfQ29udHJvbGxlciApO1xyXG5cdFx0XHR0aGlzLnVzZV9tb2R1bGUoIFdQQkNfQkZCX1BhZ2VzX1NlY3Rpb25zICk7XHJcblx0XHRcdHRoaXMudXNlX21vZHVsZSggV1BCQ19CRkJfU3RydWN0dXJlX0lPICk7XHJcblx0XHRcdHRoaXMudXNlX21vZHVsZSggV1BCQ19CRkJfS2V5Ym9hcmRfQ29udHJvbGxlciApO1xyXG5cdFx0XHR0aGlzLnVzZV9tb2R1bGUoIFdQQkNfQkZCX01pbl9XaWR0aF9HdWFyZCApO1xyXG5cclxuXHRcdFx0dGhpcy5faW5pdCgpO1xyXG5cdFx0XHR0aGlzLl9iaW5kX2V2ZW50cygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW1pdCBhIG5hbWVzcGFjZWQgYnVpbGRlciBldmVudCB2aWEgdGhlIEV2ZW50QnVzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gRXZlbnQgdHlwZSAodXNlIFdQQkNfQkZCX0V2ZW50cyB3aGVuIHBvc3NpYmxlKS5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbZGV0YWlsPXt9XSAtIFBheWxvYWQgb2JqZWN0LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9lbWl0X2NvbnN0KHR5cGUsIGRldGFpbCA9IHt9KSB7XHJcblx0XHRcdHRoaXMuYnVzLmVtaXQoIHR5cGUsIGRldGFpbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRmluZCBhIG5laWdoYm9yIGVsZW1lbnQgdGhhdCBjYW4gYmUgc2VsZWN0ZWQgYWZ0ZXIgcmVtb3ZpbmcgYSBub2RlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIC0gVGhlIGVsZW1lbnQgdGhhdCBpcyBiZWluZyByZW1vdmVkLlxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fG51bGx9IE5laWdoYm9yIG9yIG51bGwuXHJcblx0XHQgKi9cclxuXHRcdF9maW5kX25laWdoYm9yX3NlbGVjdGFibGUoZWwpIHtcclxuXHJcblx0XHRcdGlmICggISBlbCB8fCAhIGVsLnBhcmVudEVsZW1lbnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGFsbCA9IEFycmF5LmZyb20oIGVsLnBhcmVudEVsZW1lbnQuY2hpbGRyZW4gKS5maWx0ZXIoIG4gPT4gKG4uY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSB8fCBuLmNsYXNzTGlzdD8uY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSkgKTtcclxuXHJcblx0XHRcdGNvbnN0IGkgPSBhbGwuaW5kZXhPZiggZWwgKTtcclxuXHRcdFx0aWYgKCBpID4gMCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYWxsW2kgLSAxXTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGkgPj0gMCAmJiBpICsgMSA8IGFsbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuIGFsbFtpICsgMV07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZhbGxiYWNrOiBhbnkgb3RoZXIgc2VsZWN0YWJsZSBvbiB0aGUgY3VycmVudCBwYWdlLCBidXQgTkVWRVIgaW5zaWRlIGBlbGAgaXRzZWxmLlxyXG5cdFx0XHRjb25zdCBwYWdlID0gZWwuY2xvc2VzdCggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnICk7XHJcblx0XHRcdGlmICggcGFnZSApIHtcclxuXHRcdFx0XHQvLyBQcmVmZXIgc2VjdGlvbnMvZmllbGRzIHRoYXQgYXJlIHNpYmxpbmdzIGVsc2V3aGVyZSBvbiB0aGUgcGFnZS5cclxuXHRcdFx0XHRjb25zdCBjYW5kaWRhdGUgPSBwYWdlLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3NlY3Rpb24sIC53cGJjX2JmYl9fZmllbGQnICk7XHJcblx0XHRcdFx0aWYgKCBjYW5kaWRhdGUgJiYgISBlbC5jb250YWlucyggY2FuZGlkYXRlICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gY2FuZGlkYXRlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbml0aWFsaXplIFNvcnRhYmxlSlMgb24gdGhlIGZpZWxkIHBhbGV0dGUgYW5kIGxvYWQgaW5pdGlhbCBmb3JtIHN0cnVjdHVyZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X2luaXQoKSB7XHJcblxyXG5cdFx0XHRpZiAoIHR5cGVvZiBTb3J0YWJsZSA9PT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1NvcnRhYmxlSlMgaXMgbm90IGxvYWRlZCAoZHJhZyAmIGRyb3AgZGlzYWJsZWQpLicgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gPT09IEluaXQgU29ydGFibGUgb24gdGhlIEZpZWxkIFBhbGV0dGUuID09PVxyXG5cdFx0XHRpZiAoICEgdGhpcy5wYWxldHRlX3Vscy5sZW5ndGggKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnV1BCQzogTm8gZmllbGQgcGFsZXR0ZXMgZm91bmQgKC53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsKS4nICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIHR5cGVvZiBTb3J0YWJsZSA9PT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnV1BCQzogU29ydGFibGVKUyBub3QgbG9hZGVkIChwYWxldHRlIGRyYWcgZGlzYWJsZWQpLicgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLnBhbGV0dGVfdWxzLmZvckVhY2goICh1bCkgPT4gdGhpcy5zb3J0YWJsZS5lbnN1cmUoIHVsLCAncGFsZXR0ZScgKSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCB3YWl0Rm9yUmVuZGVyZXJzID0gKCkgPT4gbmV3IFByb21pc2UoIChyZXNvbHZlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgaGFzUmVnaXN0cnkgPSAhISh3LldQQkNfQkZCX0NvcmUgJiYgdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5ICYmIHR5cGVvZiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkuZ2V0ID09PSAnZnVuY3Rpb24nKTtcclxuXHJcblx0XHRcdFx0aWYgKCBoYXNSZWdpc3RyeSApIHtcclxuXHRcdFx0XHRcdHJldHVybiByZXNvbHZlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNvbnN0IHN0YXJ0ZWQgPSBEYXRlLm5vdygpO1xyXG5cdFx0XHRcdGNvbnN0IGkgICAgICAgPSBzZXRJbnRlcnZhbCggKCkgPT4ge1xyXG5cdFx0XHRcdFx0Y29uc3Qgb2sgICAgICAgPSAhISh3LldQQkNfQkZCX0NvcmUgJiYgdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5ICYmIHR5cGVvZiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkuZ2V0ID09PSAnZnVuY3Rpb24nKTtcclxuXHRcdFx0XHRcdGNvbnN0IHRpbWVkT3V0ID0gKERhdGUubm93KCkgLSBzdGFydGVkKSA+IDMwMDA7XHJcblx0XHRcdFx0XHRpZiAoIG9rIHx8IHRpbWVkT3V0ICkge1xyXG5cdFx0XHRcdFx0XHRjbGVhckludGVydmFsKCBpICk7XHJcblx0XHRcdFx0XHRcdGlmICggISBvayApIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zb2xlLndhcm4oICdXUEJDOiBGaWVsZCByZW5kZXJlcnMgbm90IGZvdW5kLCB1c2luZyBmYWxsYmFjayBwcmV2aWV3LicgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRyZXNvbHZlKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSwgNTAgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gMS4gQXV0byAgTG9hZCBmb3JtICBkZWZpbmVkIGluIHdwYmNfYmZiX291dHB1dF9hamF4X2Jvb3RfY29uZmlnKCkgLT4gMi4gTG9hZCBleGFtcGxlICB3cGJjX2JmYl9fZm9ybV9zdHJ1Y3R1cmVfX2dldF9leGFtcGxlKCkgLT4gMy4gQmxhbmsgIHBhZ2UuXHJcblx0XHRcdGNvbnN0IHN0YXJ0TG9hZCA9IGFzeW5jICgpID0+IHtcclxuXHRcdFx0XHRhd2FpdCB3YWl0Rm9yUmVuZGVyZXJzKCk7XHJcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UoIChyKSA9PiBzZXRUaW1lb3V0KCByLCAwICkgKTsgLy8gbmV4dCBtYWNyb3Rhc2suXHJcblxyXG5cdFx0XHRcdC8vIDEpIFRyeSB0byBhdXRvLWxvYWQgXCJzdGFuZGFyZFwiIGZyb20gREIgKHB1Ymxpc2hlZCkgdmlhIEFKQVguXHJcblx0XHRcdFx0Y29uc3QgbG9hZGVkID0gYXdhaXQgdGhpcy5fYXV0b19sb2FkX2luaXRpYWxfZm9ybV9mcm9tX2FqYXgoKTtcclxuXHJcblx0XHRcdFx0Ly8gQXV0by1vcGVuIEFwcGx5IFRlbXBsYXRlIG1vZGFsIGZyb20gVVJMIChpZiByZXF1ZXN0ZWQpLlxyXG5cdFx0XHRcdGF3YWl0IHRoaXMuX2F1dG9fb3Blbl9hcHBseV90ZW1wbGF0ZV9tb2RhbF9mcm9tX3VybCgpO1xyXG5cclxuXHRcdFx0XHRpZiAoIGxvYWRlZCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIDIpIEZhbGxiYWNrIGJlaGF2aW9yIGlmIEFKQVggZGlkIG5vdCBsb2FkIGFueXRoaW5nLlxyXG5cdFx0XHRcdGNvbnN0IGNmZyAgICAgICAgICAgPSB3aW5kb3cuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdFx0XHRjb25zdCBmYWxsYmFja19tb2RlID0gU3RyaW5nKCBjZmcuaW5pdGlhbF9sb2FkX2ZhbGxiYWNrIHx8ICdleGFtcGxlJyApLnRvTG93ZXJDYXNlKCk7XHJcblxyXG5cdFx0XHRcdGlmICggZmFsbGJhY2tfbW9kZSA9PT0gJ2JsYW5rJyApIHtcclxuXHRcdFx0XHRcdHRoaXMuYWRkX3BhZ2UoKTtcclxuXHJcblx0XHRcdFx0XHQvLyBBdXRvLW9wZW4gQXBwbHkgVGVtcGxhdGUgbW9kYWwgZnJvbSBVUkwgKGlmIHJlcXVlc3RlZCkuXHJcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9hdXRvX29wZW5fYXBwbHlfdGVtcGxhdGVfbW9kYWxfZnJvbV91cmwoKTtcclxuXHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBkZWZhdWx0IGZhbGxiYWNrOiBleGFtcGxlIHN0cnVjdHVyZS5cclxuXHRcdFx0XHRjb25zdCBleGFtcGxlX3N0cnVjdHVyZSA9ICh0eXBlb2Ygd2luZG93LndwYmNfYmZiX19mb3JtX3N0cnVjdHVyZV9fZ2V0X2V4YW1wbGUgPT09ICdmdW5jdGlvbicpXHJcblx0XHRcdFx0XHQ/IHdpbmRvdy53cGJjX2JmYl9fZm9ybV9zdHJ1Y3R1cmVfX2dldF9leGFtcGxlKClcclxuXHRcdFx0XHRcdDogbnVsbDtcclxuXHJcblx0XHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCBleGFtcGxlX3N0cnVjdHVyZSApICkge1xyXG5cdFx0XHRcdFx0dGhpcy5sb2FkX3NhdmVkX3N0cnVjdHVyZSggZXhhbXBsZV9zdHJ1Y3R1cmUgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5hZGRfcGFnZSgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gQXV0by1vcGVuIEFwcGx5IFRlbXBsYXRlIG1vZGFsIGZyb20gVVJMIChpZiByZXF1ZXN0ZWQpLlxyXG5cdFx0XHRcdGF3YWl0IHRoaXMuX2F1dG9fb3Blbl9hcHBseV90ZW1wbGF0ZV9tb2RhbF9mcm9tX3VybCgpO1xyXG5cdFx0XHR9O1xyXG5cclxuXHJcblxyXG5cdFx0XHRpZiAoIGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIHN0YXJ0TG9hZCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHN0YXJ0TG9hZCgpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9zdGFydF91c2FnZV9vYnNlcnZlcigpO1xyXG5cdFx0XHR0aGlzLl9zdGFydF9wYWdlc19udW1iZXJpbmdfb2JzZXJ2ZXIoKTtcclxuXHJcblx0XHRcdC8vIHRoaXMuYWRkX3BhZ2UoKTsgcmV0dXJuOyAgLy8gU3RhbmRhcmQgaW5pdGlhbGl6aW5nIG9uZSBwYWdlLlxyXG5cdFx0fVxyXG5cclxuXHRcdF9nZXRSZW5kZXJlcih0eXBlKSB7XHJcblx0XHRcdC8vIHJldHVybiB3LldQQkNfQkZCX0NvcmU/LldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5Py5nZXQ/LiggdHlwZSApO1xyXG5cdFx0XHRyZXR1cm4gV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk/LmdldD8uKHR5cGUpO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9ic2VydmUgRE9NIG11dGF0aW9ucyB0aGF0IG1heSBjaGFuZ2UgdXNhZ2UgY291bnRzIGFuZCByZWZyZXNoIHBhbGV0dGUgc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9zdGFydF91c2FnZV9vYnNlcnZlcigpIHtcclxuXHRcdFx0aWYgKCB0aGlzLl91c2FnZV9vYnNlcnZlciApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHJlZnJlc2ggPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZGVib3VuY2UoICgpID0+IHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0dGhpcy51c2FnZS51cGRhdGVfcGFsZXR0ZV91aSgpO1xyXG5cdFx0XHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsJyApLmZvckVhY2goICh1bCkgPT4ge1xyXG5cdFx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuX3VzYWdlX29ic2VydmVyLm9ic2VydmUoIHVsLCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9ICk7XHJcblx0XHRcdFx0XHRcdH0gY2F0Y2goIGUgKXsgX3dwYmM/LmRldj8uZXJyb3IoICdfc3RhcnRfdXNhZ2Vfb2JzZXJ2ZXInLCBlICk7IH1cclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oICdVc2FnZSBVSSB1cGRhdGUgZmFpbGVkLicsIGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIDEwMCApO1xyXG5cclxuXHRcdFx0Y29uc3QgY29uZmlnID0geyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUsIGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogWyAnY2xhc3MnLCAnZGF0YS11c2FnZV9rZXknIF0gfTtcclxuXHJcblx0XHRcdHRoaXMuX3VzYWdlX29ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoIHJlZnJlc2ggKTtcclxuXHRcdFx0dGhpcy5fdXNhZ2Vfb2JzZXJ2ZXIub2JzZXJ2ZSggdGhpcy5wYWdlc19jb250YWluZXIsIGNvbmZpZyApO1xyXG5cclxuXHRcdFx0Ly8gT2JzZXJ2ZSBhbGwga25vd24gcGFsZXR0ZXM7IGFsc28gZG8gYSBicm9hZCBxdWVyeSBvbiBlYWNoIHJlZnJlc2ggc28gbGF0ZS1hZGRlZCBwYWxldHRlcyBhcmUgaGFuZGxlZC5cclxuXHRcdFx0KHRoaXMucGFsZXR0ZV91bHMgfHwgW10pLmZvckVhY2goICh1bCkgPT4ge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHR0aGlzLl91c2FnZV9vYnNlcnZlci5vYnNlcnZlKCB1bCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSApO1xyXG5cdFx0XHRcdH0gY2F0Y2goIGUgKXsgX3dwYmM/LmRldj8uZXJyb3IoICdfc3RhcnRfdXNhZ2Vfb2JzZXJ2ZXInLCBlICk7IH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHJcblx0XHRcdC8vIEluaXRpYWwgc3luYy5cclxuXHRcdFx0cmVmcmVzaCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWRkIGRyYWdnaW5nIHZpc3VhbCBmZWVkYmFjayBvbiBhbGwgY29sdW1ucy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X2FkZF9kcmFnZ2luZ19jbGFzcygpIHtcclxuXHRcdFx0dGhpcy5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fY29sdW1uJyApLmZvckVhY2goICggY29sICkgPT4gY29sLmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fZHJhZ2dpbmcnICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbW92ZSBkcmFnZ2luZyB2aXN1YWwgZmVlZGJhY2sgb24gYWxsIGNvbHVtbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9yZW1vdmVfZHJhZ2dpbmdfY2xhc3MoKSB7XHJcblx0XHRcdHRoaXMucGFnZXNfY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2NvbHVtbicgKS5mb3JFYWNoKCAoIGNvbCApID0+IGNvbC5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY19iZmJfX2RyYWdnaW5nJyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCaW5kIGV2ZW50IGhhbmRsZXJzIGZvciBzYXZlLCBhZGQtcGFnZSwgYW5kIHByZXZpZXcgdG9nZ2xlIGJ1dHRvbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9iaW5kX2V2ZW50cygpIHtcclxuXHRcdFx0Ly8gU2F2ZSBidXR0b24gY2xpY2suXHJcblx0XHRcdC8vIGNvbnN0IHNhdmVfYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fc2F2ZV9idG4nICk7XHJcblx0XHRcdC8vIGlmICggc2F2ZV9idG4gKSB7XHJcblx0XHRcdC8vIFx0aWYgKCAhIHNhdmVfYnRuLmhhc0F0dHJpYnV0ZSggJ3R5cGUnICkgKSB7XHJcblx0XHRcdC8vIFx0XHRzYXZlX2J0bi5zZXRBdHRyaWJ1dGUoICd0eXBlJywgJ2J1dHRvbicgKTtcclxuXHRcdFx0Ly8gXHR9XHJcblx0XHRcdC8vIFx0dGhpcy5fb24oIHNhdmVfYnRuLCAnY2xpY2snLCAoIGUgKSA9PiB7XHJcblx0XHRcdC8vIFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdC8vIFx0XHRjb25zdCBzdHJ1Y3R1cmUgPSB0aGlzLmdldF9zdHJ1Y3R1cmUoKTtcclxuXHRcdFx0Ly8gXHRcdGNvbnNvbGUubG9nKCBKU09OLnN0cmluZ2lmeSggc3RydWN0dXJlLCBudWxsLCAyICkgKTsgLy8gRGV2ZWxvcGVyIGFpZC5cclxuXHRcdFx0Ly8gXHRcdHRoaXMuX2VtaXRfY29uc3QoIFdQQkNfQkZCX0V2ZW50cy5TVFJVQ1RVUkVfQ0hBTkdFLCB7IHN0cnVjdHVyZSB9ICk7XHJcblx0XHRcdC8vIFx0XHR0aGlzLmxvYWRfc2F2ZWRfc3RydWN0dXJlKCBzdHJ1Y3R1cmUsIHsgZGVmZXJJZlR5cGluZzogZmFsc2UgfSApO1xyXG5cdFx0XHQvLyBcdH0gKTtcclxuXHRcdFx0Ly8gfVxyXG5cclxuXHJcblx0XHRcdC8vIEtleWJvYXJkIGhhbmRsaW5nIG1vdmVkIHRvIFdQQkNfQkZCX0tleWJvYXJkX0NvbnRyb2xsZXIuXHJcblxyXG5cdFx0XHQvLyBBZGQgcGFnZSBidXR0b24gY2xpY2suXHJcblx0XHRcdGNvbnN0IGFkZF9wYWdlX2J0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2FkZF9wYWdlX2J0bicgKTtcclxuXHRcdFx0aWYgKCBhZGRfcGFnZV9idG4gKSB7XHJcblx0XHRcdFx0dGhpcy5fb24oIGFkZF9wYWdlX2J0biwgJ2NsaWNrJywgKCBlICkgPT4ge1xyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0dGhpcy5hZGRfcGFnZSgpO1xyXG5cdFx0XHRcdFx0dGhpcy5fYW5ub3VuY2U/LiggJ1BhZ2UgYWRkZWQuJyApO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gUHJldmVudCBhY2NpZGVudGFsIGRyYWcgd2hpbGUgZWRpdGluZyBpbnB1dHMuXHJcblx0XHRcdHRoaXMuX29uKCB0aGlzLnBhZ2VzX2NvbnRhaW5lciwgJ2ZvY3VzaW4nLCAoZSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGYgPSBlLnRhcmdldC5jbG9zZXN0KCAnLndwYmNfYmZiX19maWVsZCcgKTtcclxuXHRcdFx0XHRpZiAoIGYgKSB7XHJcblx0XHRcdFx0XHRmLnNldEF0dHJpYnV0ZSggJ2RhdGEtZHJhZ2dhYmxlJywgJ2ZhbHNlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0XHR0aGlzLl9vbiggdGhpcy5wYWdlc19jb250YWluZXIsICdmb2N1c291dCcsIChlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgZiA9IGUudGFyZ2V0LmNsb3Nlc3QoICcud3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHRcdGlmICggZiApIHtcclxuXHRcdFx0XHRcdGYucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1kcmFnZ2FibGUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmUtcnVuIGZpZWxkIGluaXRpYWxpemVycyBmb3IgZXZlcnkgZmllbGQgaW4gdGhlIGNhbnZhcy5cclxuXHRcdCAqIE1hbnkgcmVuZGVyZXJzIChlLmcuLCBDYWxlbmRhcikgd2lyZSB0aGVtc2VsdmVzIGluc2lkZSBvbl9maWVsZF9kcm9wKCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtcImRyb3BcInxcImxvYWRcInxcInByZXZpZXdcInxcInNhdmVcIn0gY29udGV4dFxyXG5cdFx0ICovXHJcblx0XHRfcmVpbml0X2FsbF9maWVsZHMoY29udGV4dCA9ICdwcmV2aWV3Jykge1xyXG5cdFx0XHR0aGlzLnBhZ2VzX2NvbnRhaW5lclxyXG5cdFx0XHRcdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkJyApXHJcblx0XHRcdFx0LmZvckVhY2goIChmaWVsZF9lbCkgPT4gdGhpcy50cmlnZ2VyX2ZpZWxkX2Ryb3BfY2FsbGJhY2soIGZpZWxkX2VsLCBjb250ZXh0ICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiBvbmx5IHRoZSBjb2x1bW4gZWxlbWVudHMgKHNraXAgcmVzaXplcnMpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd19lbCAtIFJvdyBlbGVtZW50LlxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50W119IENvbHVtbiBlbGVtZW50cy5cclxuXHRcdCAqL1xyXG5cdFx0X2dldF9yb3dfY29scyggcm93X2VsICkge1xyXG5cdFx0XHRyZXR1cm4gQXJyYXkuZnJvbSggcm93X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tIFBhZ2UgTnVtYmVycyBDYXJlIC0tXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgcGFnZSBwYW5lbHMgaW4gRE9NIG9yZGVyIChkaXJlY3QgY2hpbGRyZW4gb2YgcGFnZXNfY29udGFpbmVyKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnRbXX1cclxuXHRcdCAqL1xyXG5cdFx0X2dldF9wYWdlc19pbl9kb21fb3JkZXIoKSB7XHJcblx0XHRcdGlmICggISB0aGlzLnBhZ2VzX2NvbnRhaW5lciApIHtcclxuXHRcdFx0XHRyZXR1cm4gW107XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIEFycmF5LmZyb20oXHJcblx0XHRcdFx0dGhpcy5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnIClcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCB0aGUgcGFnZSBudW1iZXIgaGVhZGluZyBlbGVtZW50IGluc2lkZSBhIHBhZ2UgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFnZV9lbFxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fG51bGx9XHJcblx0XHQgKi9cclxuXHRcdF9nZXRfcGFnZV9udW1iZXJfaGVhZGluZ19lbChwYWdlX2VsKSB7XHJcblx0XHRcdGlmICggISBwYWdlX2VsIHx8ICEgcGFnZV9lbC5xdWVyeVNlbGVjdG9yICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIEluIG1hcmt1cCB0aGlzIGlzOiA8aDMgY2xhc3M9XCJ3cGJjX2JmYl9fcGFnZV9udW1iZXJcIj5QYWdlIDEgPGJ1dHRvbj4uLi48L2J1dHRvbj48L2gzPlxyXG5cdFx0XHRyZXR1cm4gcGFnZV9lbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19wYWdlX251bWJlcicgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFVwZGF0ZSBvbmx5IFRFWFQgaW5zaWRlIDxoMyBjbGFzcz1cIndwYmNfYmZiX19wYWdlX251bWJlclwiPiwgcHJlc2VydmluZyB0aGUgZGVsZXRlIGJ1dHRvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBoZWFkaW5nX2VsXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gcGFnZV9udW1iZXJcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfc2V0X3BhZ2VfbnVtYmVyX2hlYWRpbmdfdGV4dChoZWFkaW5nX2VsLCBwYWdlX251bWJlcikge1xyXG5cclxuXHRcdFx0aWYgKCAhIGhlYWRpbmdfZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBDb2xsZWN0IGN1cnJlbnQgdmlzaWJsZSB0ZXh0IGZyb20gVEVYVCBub2RlcyBvbmx5IChpZ25vcmUgYnV0dG9uIHRleHQpLlxyXG5cdFx0XHRjb25zdCB0ZXh0X25vZGVzID0gQXJyYXkuZnJvbSggaGVhZGluZ19lbC5jaGlsZE5vZGVzIHx8IFtdICkuZmlsdGVyKCAobikgPT4gbiAmJiBuLm5vZGVUeXBlID09PSAzICk7XHJcblxyXG5cdFx0XHRsZXQgcmF3ID0gJyc7XHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHRleHRfbm9kZXMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0cmF3ICs9IFN0cmluZyggdGV4dF9ub2Rlc1tpXS5ub2RlVmFsdWUgfHwgJycgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyYXcgPSByYXcucmVwbGFjZSggL1xccysvZywgJyAnICkudHJpbSgpOyAvLyBcIlBhZ2UgMVwiXHJcblxyXG5cdFx0XHRjb25zdCBuID0gU3RyaW5nKCBwYWdlX251bWJlciApO1xyXG5cclxuXHRcdFx0Ly8gUHJlc2VydmUgcHJlZml4L3RyYW5zbGF0aW9uLCBqdXN0IHJlcGxhY2UgdGhlIGxhc3QgbnVtYmVyIGdyb3VwLlxyXG5cdFx0XHRsZXQgbmV4dCA9ICcnO1xyXG5cdFx0XHRpZiAoIHJhdyAmJiAvXFxkKy8udGVzdCggcmF3ICkgKSB7XHJcblx0XHRcdFx0bmV4dCA9IHJhdy5yZXBsYWNlKCAvKFxcZCspKD8hLipcXGQpLywgbiApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCByYXcgKSB7XHJcblx0XHRcdFx0bmV4dCA9IHJhdyArICcgJyArIG47XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0bmV4dCA9ICdQYWdlICcgKyBuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBBcHBseSBpbnRvIHRoZSBmaXJzdCB0ZXh0IG5vZGU7IGNsZWFyIGFueSBleHRyYSB0ZXh0IG5vZGVzLlxyXG5cdFx0XHRpZiAoIHRleHRfbm9kZXMubGVuZ3RoID4gMCApIHtcclxuXHRcdFx0XHR0ZXh0X25vZGVzWzBdLm5vZGVWYWx1ZSA9IG5leHQgKyAnICc7XHJcblx0XHRcdFx0Zm9yICggbGV0IGsgPSAxOyBrIDwgdGV4dF9ub2Rlcy5sZW5ndGg7IGsrKyApIHtcclxuXHRcdFx0XHRcdHRleHRfbm9kZXNba10ubm9kZVZhbHVlID0gJyc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIE5vIHRleHQgbm9kZSBleGlzdHMgKHJhcmUpIC0+IGluc2VydCBiZWZvcmUgZmlyc3QgY2hpbGQgKGtlZXBzIGJ1dHRvbikuXHJcblx0XHRcdFx0aGVhZGluZ19lbC5pbnNlcnRCZWZvcmUoIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCBuZXh0ICsgJyAnICksIGhlYWRpbmdfZWwuZmlyc3RDaGlsZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW51bWJlciBhbGwgcGFnZXMgaW4gdGhlIGNhbnZhcyBieSBET00gb3JkZXIuXHJcblx0XHQgKiAtIFVwZGF0ZXMgZGF0YS1wYWdlX251bWJlciAoZGlzcGxheSBvcmRlcilcclxuXHRcdCAqIC0gVXBkYXRlcyBkYXRhLXBhZ2UgICAgICAgIChsZWdhY3kvcGFnZSBudW1iZXIgZm9yIGNvbXBhdGliaWxpdHkpXHJcblx0XHQgKiAtIFVwZGF0ZXMgaGVhZGluZyB0ZXh0IFwiUGFnZSBYXCIgd2hpbGUga2VlcGluZyBkZWxldGUgYnV0dG9uXHJcblx0XHQgKiAtIFN5bmNzIHRoaXMucGFnZV9jb3VudGVyIHNvIG5leHQgYWRkZWQgcGFnZSBpcyBjb3JyZWN0XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzPXt9XVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtvcHRzLnNvdXJjZT0nc3lzdGVtJ11cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRyZW51bWJlcl9wYWdlc19pbl9jYW52YXMob3B0cyA9IHt9KSB7XHJcblxyXG5cdFx0XHRjb25zdCBzb3VyY2UgPSBTdHJpbmcoIG9wdHMuc291cmNlIHx8ICdzeXN0ZW0nICk7XHJcblx0XHRcdGNvbnN0IHBhZ2VzICA9IHRoaXMuX2dldF9wYWdlc19pbl9kb21fb3JkZXIoKTtcclxuXHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHBhZ2VzLmxlbmd0aDsgaSsrICkge1xyXG5cclxuXHRcdFx0XHRjb25zdCBwYWdlX2VsICAgICA9IHBhZ2VzW2ldO1xyXG5cdFx0XHRcdGNvbnN0IHBhZ2VfbnVtYmVyID0gaSArIDE7XHJcblxyXG5cdFx0XHRcdC8vIEtlZXAgQk9USCBhdHRyaWJ1dGVzIGNvbnNpc3RlbnQgKHNvbWUgY29kZSBtYXkgc3RpbGwgcmVhZCBkYXRhLXBhZ2UpLlxyXG5cdFx0XHRcdHBhZ2VfZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1wYWdlX251bWJlcicsIFN0cmluZyggcGFnZV9udW1iZXIgKSApO1xyXG5cdFx0XHRcdHBhZ2VfZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1wYWdlJywgU3RyaW5nKCBwYWdlX251bWJlciApICk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGhlYWRpbmdfZWwgPSB0aGlzLl9nZXRfcGFnZV9udW1iZXJfaGVhZGluZ19lbCggcGFnZV9lbCApO1xyXG5cdFx0XHRcdGlmICggaGVhZGluZ19lbCApIHtcclxuXHRcdFx0XHRcdHRoaXMuX3NldF9wYWdlX251bWJlcl9oZWFkaW5nX3RleHQoIGhlYWRpbmdfZWwsIHBhZ2VfbnVtYmVyICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJTVBPUlRBTlQ6XHJcblx0XHRcdC8vIEtlZXAgdGhlIGNvdW50ZXIgYWxpZ25lZCB3aXRoIHRoZSBjdXJyZW50IGFtb3VudCBvZiBwYWdlcyxcclxuXHRcdFx0Ly8gc28gYWRkX3BhZ2UoKSBjcmVhdGVzIHRoZSBuZXh0IGNvcnJlY3QgbnVtYmVyLlxyXG5cdFx0XHR0aGlzLnBhZ2VfY291bnRlciA9IHBhZ2VzLmxlbmd0aDtcclxuXHJcblx0XHRcdC8vIE9wdGlvbmFsOiBub3RpZnkgb3RoZXIgVUkgKHRhYnMsIGV0Yy4pLlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IGV2ID0gKHdpbmRvdy5XUEJDX0JGQl9Db3JlPy5XUEJDX0JGQl9FdmVudHM/LlBBR0VTX1JFTlVNQkVSRUQpIHx8ICd3cGJjOmJmYjpwYWdlcy1yZW51bWJlcmVkJztcclxuXHRcdFx0XHR0aGlzLmJ1cz8uZW1pdD8uKCBldiwgeyBzb3VyY2U6IHNvdXJjZSwgcGFnZXM6IHBhZ2VzLmxlbmd0aCB9ICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdGFydCBvYnNlcnZlciB0aGF0IHJlbnVtYmVycyBwYWdlcyBhZnRlciBhZGQvZGVsZXRlL3Jlb3JkZXIvbG9hZC5cclxuXHRcdCAqIE9ic2VydmVzIG9ubHkgZGlyZWN0IGNoaWxkcmVuIGNoYW5nZXMgdG8gYXZvaWQgZmlyaW5nIG9uIGV2ZXJ5IGZpZWxkIGNoYW5nZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X3N0YXJ0X3BhZ2VzX251bWJlcmluZ19vYnNlcnZlcigpIHtcclxuXHJcblx0XHRcdGlmICggdGhpcy5fcGFnZXNfbnVtYmVyaW5nX29ic2VydmVyIHx8ICEgdGhpcy5wYWdlc19jb250YWluZXIgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBkb19yZW51bWJlciA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5kZWJvdW5jZSggKCkgPT4ge1xyXG5cdFx0XHRcdHRoaXMucmVudW1iZXJfcGFnZXNfaW5fY2FudmFzKCB7IHNvdXJjZTogJ29ic2VydmVyJyB9ICk7XHJcblx0XHRcdH0sIDUwICk7XHJcblxyXG5cdFx0XHR0aGlzLl9wYWdlc19udW1iZXJpbmdfb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlciggKG11dGF0aW9ucykgPT4ge1xyXG5cclxuXHRcdFx0XHRsZXQgdG91Y2hlZF9wYWdlcyA9IGZhbHNlO1xyXG5cclxuXHRcdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBtdXRhdGlvbnMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBtID0gbXV0YXRpb25zW2ldO1xyXG5cdFx0XHRcdFx0aWYgKCAhIG0gfHwgbS50eXBlICE9PSAnY2hpbGRMaXN0JyApIHtcclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Y29uc3Qgbm9kZXMgPSBbXVxyXG5cdFx0XHRcdFx0XHQuY29uY2F0KCBBcnJheS5mcm9tKCBtLmFkZGVkTm9kZXMgfHwgW10gKSApXHJcblx0XHRcdFx0XHRcdC5jb25jYXQoIEFycmF5LmZyb20oIG0ucmVtb3ZlZE5vZGVzIHx8IFtdICkgKTtcclxuXHJcblx0XHRcdFx0XHRmb3IgKCBsZXQgayA9IDA7IGsgPCBub2Rlcy5sZW5ndGg7IGsrKyApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgbiA9IG5vZGVzW2tdO1xyXG5cdFx0XHRcdFx0XHRpZiAoIG4gJiYgbi5ub2RlVHlwZSA9PT0gMSAmJiBuLmNsYXNzTGlzdCAmJiBuLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19wYW5lbC0tcHJldmlldycgKSApIHtcclxuXHRcdFx0XHRcdFx0XHR0b3VjaGVkX3BhZ2VzID0gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggdG91Y2hlZF9wYWdlcyApIHtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIHRvdWNoZWRfcGFnZXMgKSB7XHJcblx0XHRcdFx0XHRkb19yZW51bWJlcigpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gSU1QT1JUQU5UOiBjaGlsZExpc3Qgb25seSAobm8gc3VidHJlZSksIHNvIGZpZWxkcyBkcmFnZ2luZyB3b27igJl0IHRyaWdnZXIgdGhpcy5cclxuXHRcdFx0dGhpcy5fcGFnZXNfbnVtYmVyaW5nX29ic2VydmVyLm9ic2VydmUoIHRoaXMucGFnZXNfY29udGFpbmVyLCB7IGNoaWxkTGlzdDogdHJ1ZSB9ICk7XHJcblxyXG5cdFx0XHQvLyBJbml0aWFsIHBhc3MuXHJcblx0XHRcdGRvX3JlbnVtYmVyKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0gUmVzaXplciAtLVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQmluZCB0aGUgcmVzaXplIG1vdXNlZG93biBoYW5kbGVyIHdpdGggYSBiYWxhbmNlZCBhc3NlcnQuXHJcblx0XHQgKiAtIElmIGhhbmRsZXIgaXMgbWlzc2luZzogbG9nIGEgY2xlYXIgZXJyb3IgYW5kIGdyYWNlZnVsbHkgc2tpcCxcclxuXHRcdCAqICAgdGhlbiBhdHRlbXB0IGEgb25lLXRpY2sgcmV0cnkgKGNvdmVycyBsYXRlIG1vZHVsZSBpbml0KS5cclxuXHRcdCAqIC0gT3B0aW9uYWwgaGFyZC1mYWlsIGluIGRldiBpZiB3aW5kb3cuV1BCQ19ERVZfU1RSSUNUID09PSB0cnVlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByZXNpemVyXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZiBib3VuZCBpbW1lZGlhdGVseSwgZmFsc2Ugb3RoZXJ3aXNlXHJcblx0XHQgKi9cclxuXHRcdF9iaW5kX3Jlc2l6ZXIocmVzaXplcikge1xyXG5cdFx0XHRjb25zdCBoYW5kbGVyID0gdGhpcy5pbml0X3Jlc2l6ZV9oYW5kbGVyO1xyXG5cdFx0XHRpZiAoIHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHJlc2l6ZXIuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIGhhbmRsZXIgKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgbXNnID0gJ1dQQkM6IGluaXRfcmVzaXplX2hhbmRsZXIgbWlzc2luZy4gQ2hlY2sgdGhhdCBXUEJDX0JGQl9SZXNpemVfQ29udHJvbGxlciBpcyBsb2FkZWQvaW5pdGlhbGl6ZWQgYmVmb3JlIHRoZSBidWlsZGVyLic7XHJcblxyXG5cdFx0XHQvLyBMb3VkIGJ1dCBub24tZmF0YWwgYnkgZGVmYXVsdC5cclxuXHRcdFx0Y29uc29sZS5lcnJvciggbXNnICk7XHJcblxyXG5cdFx0XHQvLyBPcHRpb25hbCBzdHJpY3QgZGV2IG1vZGU6IHRocm93IHRvIHN1cmZhY2UgbG9hZC1vcmRlciBwcm9ibGVtcyBlYXJseVxyXG5cdFx0XHRpZiAoIHdpbmRvdy5XUEJDX0RFVl9TVFJJQ1QgPT09IHRydWUgKSB7XHJcblx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCBtc2cgKTtcclxuXHRcdFx0XHR9LCAwICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE9uZSBkZWZlcnJlZCByZXRyeSBpbiBjYXNlIHRoZSByZXNpemUgY29udHJvbGxlciBhdHRhY2hlcyBzbGlnaHRseSBsYXRlclxyXG5cdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgbGF0ZSA9IHRoaXMuaW5pdF9yZXNpemVfaGFuZGxlcjtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBsYXRlID09PSAnZnVuY3Rpb24nICYmIHJlc2l6ZXIuaXNDb25uZWN0ZWQgKSB7XHJcblx0XHRcdFx0XHRyZXNpemVyLmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBsYXRlICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCAwICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBGYWN0b3J5IGZvciBhIGNvbHVtbiByZXNpemVyIGVsZW1lbnQgd2l0aCBiaW5kaW5nIGhhbmRsZWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cclxuXHRcdCAqL1xyXG5cdFx0X2NyZWF0ZV9yZXNpemVyKCkge1xyXG5cdFx0XHRjb25zdCByZXNpemVyID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19jb2x1bW4tcmVzaXplcicgKTtcclxuXHRcdFx0dGhpcy5fYmluZF9yZXNpemVyKCByZXNpemVyICk7XHJcblx0XHRcdHJldHVybiByZXNpemVyO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIGFueSBleGlzdGluZyByZXNpemVycyBpbnNpZGUgYSByb3cgYW5kIHJlYnVpbGQgdGhlbSBiZXR3ZWVuIGNvbHVtbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd19lbCAtIFRoZSBzZWN0aW9uIHJvdyAoLndwYmNfYmZiX19yb3cpXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X3JlYnVpbGRfcmVzaXplcnNfZm9yX3Jvdyhyb3dfZWwpIHtcclxuXHRcdFx0aWYgKCAhcm93X2VsICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gUmVtb3ZlIGFsbCBleGlzdGluZyByZXNpemVyc1xyXG5cdFx0XHRyb3dfZWwucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uLXJlc2l6ZXInICkuZm9yRWFjaCggciA9PiByLnJlbW92ZSgpICk7XHJcblxyXG5cdFx0XHQvLyBSZWluc2VydCByZXNpemVycyBiZXR3ZWVuIGN1cnJlbnQgY29sdW1uc1xyXG5cdFx0XHRjb25zdCBjb2xzID0gdGhpcy5fZ2V0X3Jvd19jb2xzKCByb3dfZWwgKTtcclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgY29scy5sZW5ndGggLSAxOyBpKysgKSB7XHJcblx0XHRcdFx0Y29uc3QgcmVzaXplciA9IHRoaXMuX2NyZWF0ZV9yZXNpemVyKCk7XHJcblx0XHRcdFx0Y29sc1tpXS5pbnNlcnRBZGphY2VudEVsZW1lbnQoICdhZnRlcmVuZCcsIHJlc2l6ZXIgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tIEVuZCBSZXNpemVyIC0tXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZmllbGQncyBJTlRFUk5BTCBpZCAoZGF0YS1pZCkuIERvZXMgbm90IHJlYmluZCBpbnNwZWN0b3IuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZmllbGRfZWwgLSBUYXJnZXQgZmllbGQgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBuZXdJZFJhdyAtIE5ldyBkZXNpcmVkIGludGVybmFsIGlkLlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gQXBwbGllZCBpZC5cclxuXHRcdCAqL1xyXG5cdFx0X3NldF9maWVsZF9pZCggZmllbGRfZWwsIG5ld0lkUmF3ICkge1xyXG5cdFx0XHRjb25zdCB1bmlxdWUgPSB0aGlzLmlkLnNldF9maWVsZF9pZCggZmllbGRfZWwsIG5ld0lkUmF3LCAvKnJlbmRlclByZXZpZXcqLyBmYWxzZSApO1xyXG5cdFx0XHRpZiAoIHRoaXMucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyX3ByZXZpZXcoIGZpZWxkX2VsICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHVuaXF1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNldCBmaWVsZCdzIFJFUVVJUkVEIEhUTUwgbmFtZSAoZGF0YS1uYW1lKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIFRhcmdldCBmaWVsZCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5ld05hbWVSYXcgLSBEZXNpcmVkIEhUTUwgbmFtZS5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEFwcGxpZWQgdW5pcXVlIG5hbWUuXHJcblx0XHQgKi9cclxuXHRcdF9zZXRfZmllbGRfbmFtZSggZmllbGRfZWwsIG5ld05hbWVSYXcgKSB7XHJcblx0XHRcdGNvbnN0IHVuaXF1ZSA9IHRoaXMuaWQuc2V0X2ZpZWxkX25hbWUoIGZpZWxkX2VsLCBuZXdOYW1lUmF3LCAvKnJlbmRlclByZXZpZXcqLyBmYWxzZSApO1xyXG5cdFx0XHRpZiAoIHRoaXMucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyX3ByZXZpZXcoIGZpZWxkX2VsICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHVuaXF1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNldCBmaWVsZCdzIE9QVElPTkFMIEhUTUwgaWQgKGRhdGEtaHRtbF9pZCkuIEVtcHR5IHJlbW92ZXMgaXQuIEVuc3VyZXMgc2FuaXRpemF0aW9uIGFuZCB1bmlxdWVuZXNzIGFtb25nXHJcblx0XHQgKiBvdGhlciBmaWVsZHMgdGhhdCBkZWNsYXJlZCBIVE1MIGlkcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIFRhcmdldCBmaWVsZCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5ld0h0bWxJZFJhdyAtIERlc2lyZWQgSFRNTCBpZCAob3B0aW9uYWwpLlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gQXBwbGllZCBodG1sX2lkIG9yIGVtcHR5IHN0cmluZy5cclxuXHRcdCAqL1xyXG5cdFx0X3NldF9maWVsZF9odG1sX2lkKCBmaWVsZF9lbCwgbmV3SHRtbElkUmF3ICkge1xyXG5cdFx0XHRjb25zdCBhcHBsaWVkID0gdGhpcy5pZC5zZXRfZmllbGRfaHRtbF9pZCggZmllbGRfZWwsIG5ld0h0bWxJZFJhdywgLypyZW5kZXJQcmV2aWV3Ki8gZmFsc2UgKTtcclxuXHRcdFx0aWYgKCB0aGlzLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9wcmV2aWV3KCBmaWVsZF9lbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBhcHBsaWVkO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vID09IEFjY2Vzc2liaWxpdHkgPT1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIExpZ2h0d2VpZ2h0IEFSSUEtbGl2ZSBhbm5vdW5jZXIgZm9yIGFjY2Vzc2liaWxpdHkvc3RhdHVzIG1lc3NhZ2VzLlxyXG5cdFx0ICogS2VwdCBsb2NhbCB0byB0aGUgYnVpbGRlciBzbyBjYWxsZXJzIGNhbiBzYWZlbHkgdXNlIGl0LlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1zZ1xyXG5cdFx0ICovXHJcblx0XHRfYW5ub3VuY2UobXNnKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0bGV0IGxpdmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hcmlhX2xpdmUnICk7XHJcblx0XHRcdFx0aWYgKCAhbGl2ZSApIHtcclxuXHRcdFx0XHRcdGxpdmUgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0XHRcdFx0bGl2ZS5pZCA9ICd3cGJjX2JmYl9fYXJpYV9saXZlJztcclxuXHRcdFx0XHRcdGxpdmUuc2V0QXR0cmlidXRlKCAnYXJpYS1saXZlJywgJ3BvbGl0ZScgKTtcclxuXHRcdFx0XHRcdGxpdmUuc2V0QXR0cmlidXRlKCAnYXJpYS1hdG9taWMnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRcdGxpdmUuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG5cdFx0XHRcdFx0bGl2ZS5zdHlsZS5sZWZ0ICAgICA9ICctOTk5OXB4JztcclxuXHRcdFx0XHRcdGxpdmUuc3R5bGUudG9wICAgICAgPSAnYXV0byc7XHJcblx0XHRcdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBsaXZlICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGxpdmUudGV4dENvbnRlbnQgPSAnJztcclxuXHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdFx0XHRsaXZlLnRleHRDb250ZW50ID0gU3RyaW5nKCBtc2cgfHwgJycgKTtcclxuXHRcdFx0XHR9LCAxMCApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHQvLyBuby1vcDogbm9uLWZhdGFsIFVYIGhlbHBlci5cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2VudHJhbCBwbGFjZSB0byByZWdpc3RlciBET00gbGlzdGVuZXJzIGZvciBsYXRlciB0ZWFyZG93bi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtFdmVudFRhcmdldH0gdGFyZ2V0IC0gVGFyZ2V0IHRvIGJpbmQgb24uXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIEV2ZW50IHR5cGUuXHJcblx0XHQgKiBAcGFyYW0ge0V2ZW50TGlzdGVuZXJ9IGhhbmRsZXIgLSBIYW5kbGVyIGZ1bmN0aW9uLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufEFkZEV2ZW50TGlzdGVuZXJPcHRpb25zfSBbb3B0cz1mYWxzZV0gLSBMaXN0ZW5lciBvcHRpb25zLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9vbiggdGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRzID0gZmFsc2UgKSB7XHJcblx0XHRcdGlmICggISB0aGlzLl9oYW5kbGVycyApIHtcclxuXHRcdFx0XHR0aGlzLl9oYW5kbGVycyA9IFtdO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRhcmdldC5hZGRFdmVudExpc3RlbmVyKCB0eXBlLCBoYW5kbGVyLCBvcHRzICk7XHJcblx0XHRcdHRoaXMuX2hhbmRsZXJzLnB1c2goIHsgdGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRzIH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLSBDaGVjayBVc2FnZSBMaW1pdHMgSGVscGVycyAtLVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIHRoZSB1c2FnZSBrZXkgZm9yIGEgZmllbGQgbm9kZSAocGFsZXR0ZSB1c2VzIGRhdGEtdXNhZ2Vfa2V5OyBmYWxsYmFjayB0byB0eXBlKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gZmllbGRfZWxcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd8Kn1cclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKi9cclxuXHRcdF9nZXRfdXNhZ2Vfa2V5KGZpZWxkX2VsKSB7XHJcblx0XHRcdHJldHVybiBmaWVsZF9lbD8uZGF0YXNldD8udXNhZ2Vfa2V5IHx8IGZpZWxkX2VsPy5kYXRhc2V0Py50eXBlIHx8ICdmaWVsZCc7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb3VudCBob3cgbWFueSBvZiBhIGdpdmVuIGtleSBhcmUgYWxyZWFkeSBwcmVzZW50IGluIHRoZSBjYW52YXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIGtleVxyXG5cdFx0ICogQHJldHVybnMgeyp8bnVtYmVyfVxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqL1xyXG5cdFx0X2NvdW50X3VzZWRfaW5fY2FudmFzKGtleSkge1xyXG5cdFx0XHRpZiAoICEgdGhpcy5wYWdlc19jb250YWluZXIgKSB7XHJcblx0XHRcdFx0cmV0dXJuIDA7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgZXNjID0gd2luZG93LldQQkNfQkZCX0NvcmU/LldQQkNfQkZCX1Nhbml0aXplPy5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3I/Ligga2V5ICkgfHwga2V5LnJlcGxhY2UoIC9cIi9nLCAnXFxcXFwiJyApO1xyXG5cdFx0XHQvLyBtYXRjaCBieSB1c2FnZV9rZXkgZmlyc3QsIHRoZW4gYnkgdHlwZSBhcyBhIGZhbGxiYWNrIChvbGRlciBmaWVsZHMpLlxyXG5cdFx0XHRyZXR1cm4gdGhpcy5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggYC53cGJjX2JmYl9fZmllbGRbZGF0YS11c2FnZV9rZXk9XCIke2VzY31cIl0sIC53cGJjX2JmYl9fZmllbGRbZGF0YS10eXBlPVwiJHtlc2N9XCJdYCApLmxlbmd0aDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlYWQgdGhlIG51bWVyaWMgbGltaXQgZm9yIGEgdXNhZ2Uga2V5IGZyb20gYW55IHBhbGV0dGUgaXRlbTsgSW5maW5pdHkgaWYgbm90IHNwZWNpZmllZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ga2V5XHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqL1xyXG5cdFx0X2dldF9wYWxldHRlX2xpbWl0X2Zvcl9rZXkoa2V5KSB7XHJcblx0XHRcdC8vIHByZWZlciBzY2FubmluZyBidWlsZGVyLWtub3duIHBhbGV0dGVzIChzdXBwb3J0cyBtdWx0aXBsZSBwYWxldHRlcykuXHJcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZXMgPSAodGhpcy5wYWxldHRlX3VscyB8fCBbXSlcclxuXHRcdFx0XHQubWFwKCB1bCA9PiB1bC5xdWVyeVNlbGVjdG9yKCBgW2RhdGEtaWQ9XCIke2tleX1cIl0sIFtkYXRhLXVzYWdlX2tleT1cIiR7a2V5fVwiXWAgKSApXHJcblx0XHRcdFx0LmZpbHRlciggQm9vbGVhbiApO1xyXG5cclxuXHRcdFx0Y29uc3QgcGVsID0gY2FuZGlkYXRlc1swXSB8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCBgLndwYmNfYmZiX19wYW5lbF9maWVsZF90eXBlc19fdWwgW2RhdGEtaWQ9XCIke2tleX1cIl0sIC53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsIFtkYXRhLXVzYWdlX2tleT1cIiR7a2V5fVwiXWAgKTtcclxuXHJcblx0XHRcdGNvbnN0IG4gPSBOdW1iZXIoIHBlbD8uZGF0YXNldD8udXNhZ2VudW1iZXIgKTtcclxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gbiA6IEluZmluaXR5O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGFsbHkgaG93IG1hbnkgb2YgZWFjaCB1c2FnZSBrZXkgZXhpc3QgaW5zaWRlIGEgc3VidHJlZSAoZmllbGRzIG9ubHkpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSByb290X2VsXHJcblx0XHQgKiBAcmV0dXJucyB7e319XHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICovXHJcblx0XHRfdGFsbHlfdXNhZ2VfaW5fc3VidHJlZShyb290X2VsKSB7XHJcblx0XHRcdGNvbnN0IHRhbGx5ID0ge307XHJcblx0XHRcdGlmICggISByb290X2VsICkge1xyXG5cdFx0XHRcdHJldHVybiB0YWxseTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyb290X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2ZpZWxkJyApLmZvckVhY2goIGYgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGsgID0gdGhpcy5fZ2V0X3VzYWdlX2tleSggZiApO1xyXG5cdFx0XHRcdHRhbGx5W2tdID0gKHRhbGx5W2tdIHx8IDApICsgMTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gdGFsbHk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQcmVmbGlnaHQgdXNhZ2UgZm9yIGEgbm90LXlldC1pbnNlcnRlZCBjbG9uZS5cclxuXHRcdCAqIHN0cmF0ZWd5OlxyXG5cdFx0ICogICAtICdibG9jaycgKGRlZmF1bHQpIC0+IHJldHVybiBvZmZlbmRlcnMgaWYgYW55IGxpbWl0IHdvdWxkIGJlIGV4Y2VlZGVkXHJcblx0XHQgKiAgIC0gJ3N0cmlwJyAgICAgICAgICAgLT4gbXV0YXRlIGNsb25lIHRvIHJlbW92ZSBvdmVyLWxpbWl0IGZpZWxkcyBhbmQgcHJvY2VlZFxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBjbG9uZVxyXG5cdFx0ICogQHBhcmFtIHN0cmF0ZWd5XHJcblx0XHQgKiBAcmV0dXJucyB7e29rOnRydWV9fHtvazpmYWxzZSwgb2ZmZW5kZXJzOkFycmF5PHtrZXk6c3RyaW5nLCBsaW1pdDpudW1iZXIsIHVzZWQ6bnVtYmVyLCBhZGQ6bnVtYmVyfT59fVxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqL1xyXG5cdFx0X3ByZWZsaWdodF91c2FnZV9mb3JfY2xvbmUoY2xvbmUsIHN0cmF0ZWd5ID0gJ2Jsb2NrJykge1xyXG5cdFx0XHRjb25zdCBvZmZlbmRlcnMgPSBbXTtcclxuXHRcdFx0Y29uc3QgdGFsbHkgICAgID0gdGhpcy5fdGFsbHlfdXNhZ2VfaW5fc3VidHJlZSggY2xvbmUgKTtcclxuXHJcblx0XHRcdE9iamVjdC5lbnRyaWVzKCB0YWxseSApLmZvckVhY2goIChbIGtleSwgYWRkQ291bnQgXSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGxpbWl0ID0gdGhpcy5fZ2V0X3BhbGV0dGVfbGltaXRfZm9yX2tleSgga2V5ICk7XHJcblx0XHRcdFx0aWYgKCAhTnVtYmVyLmlzRmluaXRlKCBsaW1pdCApICkgcmV0dXJuOyAgLy8gbm8gbGltaXQgZGVjbGFyZWQgLT4gaWdub3JlXHJcblxyXG5cdFx0XHRcdGNvbnN0IHVzZWQgICAgICA9IHRoaXMuX2NvdW50X3VzZWRfaW5fY2FudmFzKCBrZXkgKTtcclxuXHRcdFx0XHRjb25zdCByZW1haW5pbmcgPSBsaW1pdCAtIHVzZWQ7XHJcblxyXG5cdFx0XHRcdGlmICggcmVtYWluaW5nID49IGFkZENvdW50ICkgcmV0dXJuOyAgICAvLyBzYWZlXHJcblxyXG5cdFx0XHRcdGlmICggc3RyYXRlZ3kgPT09ICdzdHJpcCcgKSB7XHJcblx0XHRcdFx0XHQvLyBLZWVwIG9ubHkgdGhlIHJlbWFpbmluZyBjYXBhY2l0eTsgcmVtb3ZlIGV4dHJhcyBmcm9tIHRoZSBjbG9uZVxyXG5cdFx0XHRcdFx0Y29uc3Qgbm9kZXMgICAgPSBBcnJheS5mcm9tKCBjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKFxyXG5cdFx0XHRcdFx0XHRgLndwYmNfYmZiX19maWVsZFtkYXRhLXVzYWdlX2tleT1cIiR7a2V5fVwiXSwgLndwYmNfYmZiX19maWVsZFtkYXRhLXR5cGU9XCIke2tleX1cIl1gXHJcblx0XHRcdFx0XHQpICk7XHJcblx0XHRcdFx0XHRjb25zdCB0b1JlbW92ZSA9IG5vZGVzLnNsaWNlKCBNYXRoLm1heCggMCwgcmVtYWluaW5nICkgKTtcclxuXHRcdFx0XHRcdHRvUmVtb3ZlLmZvckVhY2goIG4gPT4gbi5yZW1vdmUoKSApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRvZmZlbmRlcnMucHVzaCggeyBrZXksIGxpbWl0LCB1c2VkLCBhZGQ6IGFkZENvdW50IH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGlmICggc3RyYXRlZ3kgPT09ICdzdHJpcCcgKSB7XHJcblx0XHRcdFx0Ly8gQWZ0ZXIgc3RyaXBwaW5nLCByZS1jaGVjazsgaWYgc3RpbGwgb3ZlciAoZS5nLiByZW1haW5pbmcgPCAwIGZvciBtdWx0aXBsZSBrZXlzKSwgdHJlYXQgYXMgb2ZmZW5kZXJzLlxyXG5cdFx0XHRcdGNvbnN0IHJlICAgICAgID0gdGhpcy5fdGFsbHlfdXNhZ2VfaW5fc3VidHJlZSggY2xvbmUgKTtcclxuXHRcdFx0XHRjb25zdCBzdGlsbEJhZCA9IE9iamVjdC5lbnRyaWVzKCByZSApLnNvbWUoIChbIGtleSwgYWRkIF0pID0+IHtcclxuXHRcdFx0XHRcdGNvbnN0IGxpbWl0ID0gdGhpcy5fZ2V0X3BhbGV0dGVfbGltaXRfZm9yX2tleSgga2V5ICk7XHJcblx0XHRcdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBsaW1pdCApICYmICh0aGlzLl9jb3VudF91c2VkX2luX2NhbnZhcygga2V5ICkgKyBhZGQpID4gbGltaXQ7XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdHJldHVybiBzdGlsbEJhZCA/IHsgb2s6IGZhbHNlLCBvZmZlbmRlcnMgfSA6IHsgb2s6IHRydWUgfTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIG9mZmVuZGVycy5sZW5ndGggPyB7IG9rOiBmYWxzZSwgb2ZmZW5kZXJzIH0gOiB7IG9rOiB0cnVlIH07XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gPT0gQWpheCA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHRcdC8vID09IEF1dG8gTG9hZCBGb3JtIG9uIFN0YXJ0ID09XHJcblx0XHQvKipcclxuXHRcdCAqIEF1dG8tbG9hZCBjdXJyZW50IGZvcm0gY29uZmlnIGZyb20gREIvbGVnYWN5IHZpYSBhZG1pbi1hamF4LlxyXG5cdFx0ICpcclxuXHRcdCAqIC0gSWYgQkZCIHN0cnVjdHVyZSBleGlzdHMgLT4gbG9hZHMgaXQuXHJcblx0XHQgKiAtIElmIGxlZ2FjeSBlbmdpbmUgcmV0dXJucyBlbXB0eSBzdHJ1Y3R1cmUgLT4gdHJlYXRzIGFzIGxvYWRlZCBhbmQgY3JlYXRlcyBhIGJsYW5rIHBhZ2UuXHJcblx0XHQgKiAtIFJldHVybnMgdHJ1ZSBpZiBBSkFYIHN1Y2NlZWRlZCAoZXZlbiBpZiBzdHJ1Y3R1cmUgaXMgZW1wdHkpLCBmYWxzZSBvdGhlcndpc2UuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XHJcblx0XHQgKi9cclxuXHRcdGFzeW5jIF9hdXRvX2xvYWRfaW5pdGlhbF9mb3JtX2Zyb21fYWpheCgpIHtcclxuXHJcblx0XHRcdC8vIEluaXRpYWwgUGFyYW1ldGVycyBmb3IgZm9ybSBsb2FkaW5nIG9uIHBhZ2UgcmVmcmVzaCAvIGxvYWQuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluZm86IElOSVRfRk9STV9MT0FELlxyXG5cdFx0XHRjb25zdCBjZmcgPSB3aW5kb3cuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHJcblx0XHRcdGlmICggISBjZmcudXJsIHx8ICEgY2ZnLm5vbmNlX2xvYWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBwYXlsb2FkID0ge1xyXG5cdFx0XHRcdGFjdGlvbiAgIDogY2ZnLmxvYWRfYWN0aW9uIHx8ICdXUEJDX0FKWF9CRkJfTE9BRF9GT1JNX0NPTkZJRycsXHJcblx0XHRcdFx0bm9uY2UgICAgOiBjZmcubm9uY2VfbG9hZCB8fCAnJyxcclxuXHRcdFx0XHRmb3JtX25hbWU6IGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgciA9IGF3YWl0IHdwYmNfYmZiX19wb3N0X2FqYXhfcHJvbWlzZSggY2ZnLnVybCwgcGF5bG9hZCApO1xyXG5cclxuXHRcdFx0aWYgKCByLnN0YXR1cyAhPT0gMjAwICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IHJlc3AgPSBudWxsO1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHJlc3AgPSBKU09OLnBhcnNlKCByLnRleHQgKTtcclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAhIHJlc3AgfHwgISByZXNwLnN1Y2Nlc3MgfHwgISByZXNwLmRhdGEgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBkYXRhICAgPSByZXNwLmRhdGEgfHwge307XHJcblx0XHRcdGNvbnN0IGVuZ2luZSA9IFN0cmluZyggZGF0YS5lbmdpbmUgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuXHRcdFx0Ly8gQXBwbHkgQWR2YW5jZWQgTW9kZSB0ZXh0cyAoYWx3YXlzIHVzZWZ1bCBmb3IgbGVnYWN5KS5cclxuXHRcdFx0aWYgKCB0eXBlb2YgZGF0YS5hZHZhbmNlZF9mb3JtICE9PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgZGF0YS5jb250ZW50X2Zvcm0gIT09ICd1bmRlZmluZWQnICkge1xyXG5cclxuXHRcdFx0XHRjb25zdCBhZiA9IFN0cmluZyggZGF0YS5hZHZhbmNlZF9mb3JtIHx8ICcnICk7XHJcblx0XHRcdFx0Y29uc3QgY2YgPSBTdHJpbmcoIGRhdGEuY29udGVudF9mb3JtIHx8ICcnICk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHRhX2Zvcm0gICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX2VkaXRvcicgKTtcclxuXHRcdFx0XHRjb25zdCB0YV9jb250ZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fY29udGVudF9mb3JtX2VkaXRvcicgKTtcclxuXHJcblx0XHRcdFx0aWYgKCB0YV9mb3JtICkge1xyXG5cdFx0XHRcdFx0dGFfZm9ybS52YWx1ZSA9IGFmO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIHRhX2NvbnRlbnQgKSB7XHJcblx0XHRcdFx0XHR0YV9jb250ZW50LnZhbHVlID0gY2Y7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBPTkxZIHN1cHBvcnRlZDogc2V0dGluZ3MuYmZiX29wdGlvbnMuYWR2YW5jZWRfbW9kZV9zb3VyY2UgKGZhbGxiYWNrIHRvIGNmZy5zYXZlX3NvdXJjZSBvciAnYnVpbGRlcicpLlxyXG5cdFx0XHRcdGxldCBhZHZfbW9kZV9zcmMgPSAnJztcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkYXRhLnNldHRpbmdzICE9PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHMgPSAodHlwZW9mIGRhdGEuc2V0dGluZ3MgPT09ICdzdHJpbmcnKSA/IEpTT04ucGFyc2UoIGRhdGEuc2V0dGluZ3MgKSA6IGRhdGEuc2V0dGluZ3M7XHJcblx0XHRcdFx0XHRcdGFkdl9tb2RlX3NyYyA9IChzICYmIHMuYmZiX29wdGlvbnMgJiYgcy5iZmJfb3B0aW9ucy5hZHZhbmNlZF9tb2RlX3NvdXJjZSkgPyBTdHJpbmcoIHMuYmZiX29wdGlvbnMuYWR2YW5jZWRfbW9kZV9zb3VyY2UgKSA6ICcnO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lICkge31cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCAhIGFkdl9tb2RlX3NyYyApIHtcclxuXHRcdFx0XHRcdGFkdl9tb2RlX3NyYyA9ICh3aW5kb3cuV1BCQ19CRkJfQWpheCAmJiB3aW5kb3cuV1BCQ19CRkJfQWpheC5zYXZlX3NvdXJjZSkgPyBTdHJpbmcoIHdpbmRvdy5XUEJDX0JGQl9BamF4LnNhdmVfc291cmNlICkgOiAnYnVpbGRlcic7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmFkdmFuY2VkX3RleHQ6YXBwbHknLCB7XHJcblx0XHRcdFx0XHRhZHZhbmNlZF9mb3JtICAgICAgIDogYWYsXHJcblx0XHRcdFx0XHRjb250ZW50X2Zvcm0gICAgICAgIDogY2YsXHJcblx0XHRcdFx0XHRhZHZhbmNlZF9tb2RlX3NvdXJjZTogYWR2X21vZGVfc3JjXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBBcHBseSBsb2NhbCBmb3JtIHNldHRpbmdzIHRvIFVJIChpZiBwcm92aWRlZCkuXHJcblx0XHRcdGlmICggZGF0YS5zZXR0aW5ncyApIHtcclxuXHRcdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmZvcm1fc2V0dGluZ3M6YXBwbHknLCB7XHJcblx0XHRcdFx0XHRzZXR0aW5ncyA6IGRhdGEuc2V0dGluZ3MsXHJcblx0XHRcdFx0XHRmb3JtX25hbWU6IGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtOmFqYXhfbG9hZGVkJywge1xyXG5cdFx0XHRcdGxvYWRlZF9kYXRhOiBkYXRhLFxyXG5cdFx0XHRcdGZvcm1fbmFtZSAgOiBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCdcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gU3RydWN0dXJlIG1heSBiZSBbXSBmb3IgbGVnYWN5IGVuZ2luZXMuXHJcblx0XHRcdGNvbnN0IHN0cnVjdHVyZSA9IEFycmF5LmlzQXJyYXkoIGRhdGEuc3RydWN0dXJlICkgPyBkYXRhLnN0cnVjdHVyZSA6IFtdO1xyXG5cclxuXHRcdFx0aWYgKCBzdHJ1Y3R1cmUubGVuZ3RoID4gMCApIHtcclxuXHRcdFx0XHR0aGlzLmxvYWRfc2F2ZWRfc3RydWN0dXJlKCBzdHJ1Y3R1cmUgKTtcclxuXHJcblx0XHRcdFx0Ly8gUmUtYXBwbHkgZWZmZWN0cyBBRlRFUiBzdHJ1Y3R1cmUgcmVidWlsZCBjcmVhdGVkIHRoZSBmaW5hbCBET00uXHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGlmICggdy5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzICYmIHR5cGVvZiB3LldQQkNfQkZCX1NldHRpbmdzX0VmZmVjdHMucmVhcHBseV9hZnRlcl9jYW52YXMgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHcuV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cy5yZWFwcGx5X2FmdGVyX2NhbnZhcyggZGF0YS5zZXR0aW5ncywge1xyXG5cdFx0XHRcdFx0XHRcdHNvdXJjZSAgIDogJ2FqYXhfbG9hZCcsXHJcblx0XHRcdFx0XHRcdFx0Zm9ybV9uYW1lOiBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCdcclxuXHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZV9meCApIHt9XHJcblxyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJTVBPUlRBTlQ6IExlZ2FjeSBsb2FkIGlzIHN0aWxsIGEgdmFsaWQgXCJsb2FkZWRcIiBzdGF0ZS5cclxuXHRcdFx0Ly8gQ3JlYXRlIGEgYmxhbmsgcGFnZSAoc28gdGhlIGNhbnZhcyBpc24ndCBlbXB0eSksIGFuZCBETyBOT1QgZmFsbGJhY2sgdG8gZXhhbXBsZS5cclxuXHRcdFx0dGhpcy5hZGRfcGFnZSgpO1xyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRpZiAoIHcuV1BCQ19CRkJfU2V0dGluZ3NfRWZmZWN0cyAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzLnJlYXBwbHlfYWZ0ZXJfY2FudmFzID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dy5XUEJDX0JGQl9TZXR0aW5nc19FZmZlY3RzLnJlYXBwbHlfYWZ0ZXJfY2FudmFzKCBkYXRhLnNldHRpbmdzLCB7XHJcblx0XHRcdFx0XHRcdHNvdXJjZSAgIDogJ2FqYXhfbG9hZF9sZWdhY3knLFxyXG5cdFx0XHRcdFx0XHRmb3JtX25hbWU6IGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIF9lX2Z4MiApIHt9XHJcblxyXG5cdFx0XHRqUXVlcnkoICcud3BiY19iZmJfX3RvcF90YWJfc2VjdGlvbl9fYnVpbGRlcl90YWIgLndwYmNfc3BpbnNfbG9hZGluZ19jb250YWluZXInICkucGFyZW50cyggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnICkucmVtb3ZlKCk7XHJcblx0XHRcdC8vIE9wdGlvbmFsOiBvbmUtdGltZSBub3RpY2UgZm9yIGxlZ2FjeS5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRpZiAoIGVuZ2luZSAmJiBlbmdpbmUuaW5kZXhPZiggJ2xlZ2FjeV8nICkgPT09IDAgJiYgdHlwZW9mIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0xvYWRlZCBsZWdhY3kgZm9ybS4gVXNlIOKAnEltcG9ydCBmcm9tIFNpbXBsZSBGb3Jt4oCdIHRvIGNvbnZlcnQgdG8gQnVpbGRlci4nLCAnd2FybmluZycsIDYwMDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBfZTIgKSB7fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vID09IEF1dG8tb3BlbiBcIkFwcGx5IFRlbXBsYXRlXCIgbW9kYWwgPT1cclxuXHRcdC8qKlxyXG5cdFx0ICogQXV0by1vcGVuIFwiQXBwbHkgVGVtcGxhdGVcIiBtb2RhbCBpZiBVUkwgaGFzOlxyXG5cdFx0ICogICAmYXV0b19vcGVuX3RlbXBsYXRlPVNlcnZpY2UrRHVyYXRpb25cclxuXHRcdCAqXHJcblx0XHQgKiBUaGlzIHdpbGwgcHJlZmlsbCB0aGUgbW9kYWwgc2VhcmNoIGlucHV0IGFuZCB0cmlnZ2VyIHNlcnZlci1zaWRlIHNlYXJjaFxyXG5cdFx0ICogKHRpdGxlIC8gc2x1ZyAvIGRlc2NyaXB0aW9uKSB2aWEgeW91ciB0ZW1wbGF0ZXMgbGlzdGluZyBlbmRwb2ludC5cclxuXHRcdCAqXHJcblx0XHQgKiBTZWN1cml0eTpcclxuXHRcdCAqIC0gZGVjb2RlcyBzYWZlbHlcclxuXHRcdCAqIC0gc3RyaXBzIGNvbnRyb2wgY2hhcnNcclxuXHRcdCAqIC0gY2xhbXBzIGxlbmd0aFxyXG5cdFx0ICogLSBuZXZlciBpbmplY3RzIEhUTUwgKG9ubHkgc2V0cyBpbnB1dC52YWx1ZSlcclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gVHJ1ZSBpZiBhdXRvLW9wZW4gd2FzIHRyaWdnZXJlZC5cclxuXHRcdCAqL1xyXG5cdFx0YXN5bmMgX2F1dG9fb3Blbl9hcHBseV90ZW1wbGF0ZV9tb2RhbF9mcm9tX3VybCgpIHtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Ly8gT25lLXRpbWUgcGVyIHBhZ2UgbG9hZCAoYXZvaWQgZG91YmxlIG9wZW4gd2hlbiBjYWxsZWQgZnJvbSBtdWx0aXBsZSBwYXRocykuXHJcblx0XHRcdFx0aWYgKCB3aW5kb3cuX193cGJjX2JmYl9hdXRvX29wZW5fdGVtcGxhdGVfZG9uZSApIHtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFJlYWQgcmF3IHF1ZXJ5IHBhcmFtLlxyXG5cdFx0XHRcdGNvbnN0IGhyZWYgPSBTdHJpbmcoIHdpbmRvdy5sb2NhdGlvbiAmJiB3aW5kb3cubG9jYXRpb24uaHJlZiA/IHdpbmRvdy5sb2NhdGlvbi5ocmVmIDogJycgKTtcclxuXHRcdFx0XHRpZiAoICEgaHJlZiApIHtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxldCByYXdfdmFsdWUgPSAnJztcclxuXHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGNvbnN0IHUgICA9IG5ldyBVUkwoIGhyZWYgKTtcclxuXHRcdFx0XHRcdHJhd192YWx1ZSA9IHUuc2VhcmNoUGFyYW1zLmdldCggJ2F1dG9fb3Blbl90ZW1wbGF0ZScgKSB8fCAnJztcclxuXHRcdFx0XHR9IGNhdGNoICggX2UwICkge1xyXG5cdFx0XHRcdFx0Ly8gRmFsbGJhY2sgbWluaW1hbCBwYXJzZXIgKHNob3VsZCByYXJlbHkgaGFwcGVuKS5cclxuXHRcdFx0XHRcdGNvbnN0IG0gICA9IGhyZWYubWF0Y2goIC9bPyZdYXV0b19vcGVuX3RlbXBsYXRlPShbXiYjXSopL2kgKTtcclxuXHRcdFx0XHRcdHJhd192YWx1ZSA9IG0gJiYgbVsxXSA/IG1bMV0gOiAnJztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJhd192YWx1ZSA9IFN0cmluZyggcmF3X3ZhbHVlIHx8ICcnICk7XHJcblxyXG5cdFx0XHRcdC8vIFVSTFNlYXJjaFBhcmFtcyB1c3VhbGx5IGRlY29kZXMsIGJ1dCB3ZSBhbHNvIG5vcm1hbGl6ZSBcIitcIiAtPiBcIiBcIiBmb3Igc2FmZXR5LlxyXG5cdFx0XHRcdC8vIElmIGFscmVhZHkgZGVjb2RlZCwgdGhpcyBpcyBoYXJtbGVzcy5cclxuXHRcdFx0XHRyYXdfdmFsdWUgPSByYXdfdmFsdWUucmVwbGFjZSggL1xcKy9nLCAnICcgKTtcclxuXHJcblx0XHRcdFx0Ly8gVHJ5IGRlY29kZVVSSUNvbXBvbmVudCAoaW4gY2FzZSBmYWxsYmFjayBwYXJzZXIgY2FwdHVyZWQgZW5jb2RlZCBzdHJpbmcpLlxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRyYXdfdmFsdWUgPSBkZWNvZGVVUklDb21wb25lbnQoIHJhd192YWx1ZSApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZTEgKSB7fVxyXG5cclxuXHRcdFx0XHQvLyBTYW5pdGl6ZTogcmVtb3ZlIGNvbnRyb2wgY2hhcnMsIHRyaW0sIGNvbGxhcHNlIHNwYWNlcy5cclxuXHRcdFx0XHRsZXQgc2VhcmNoX2tleSA9IHJhd192YWx1ZVxyXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9bXFx1MDAwMC1cXHUwMDFGXFx1MDA3Rl0vZywgJyAnIClcclxuXHRcdFx0XHRcdC5yZXBsYWNlKCAvXFxzKy9nLCAnICcgKVxyXG5cdFx0XHRcdFx0LnRyaW0oKTtcclxuXHJcblx0XHRcdFx0Ly8gTm9ybWFsaXplIE9SIHNlcGFyYXRvciBzbyBVUkwgc2VwYXJhdG9yIFwiXlwiIGJlY29tZXMgVUkgc2VwYXJhdG9yIFwifFwiLlxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRjb25zdCBzZXAgICAgPSAoY2ZnICYmIGNmZy50ZW1wbGF0ZV9zZWFyY2hfb3Jfc2VwKSA/IFN0cmluZyggY2ZnLnRlbXBsYXRlX3NlYXJjaF9vcl9zZXAgKSA6ICd8JztcclxuXHRcdFx0XHRcdGNvbnN0IHVybFNlcCA9IChjZmcgJiYgY2ZnLnRlbXBsYXRlX3NlYXJjaF9vcl9zZXBfdXJsKSA/IFN0cmluZyggY2ZnLnRlbXBsYXRlX3NlYXJjaF9vcl9zZXBfdXJsICkgOiAnXic7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgZXNjU2VwICAgID0gU3RyaW5nKCBzZXAgKS5yZXBsYWNlKCAvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnICk7XHJcblx0XHRcdFx0XHRjb25zdCBlc2NVcmxTZXAgPSBTdHJpbmcoIHVybFNlcCApLnJlcGxhY2UoIC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBDb252ZXJ0IFVSTCBzZXBhcmF0b3IgaW50byBVSSBzZXBhcmF0b3IuXHJcblx0XHRcdFx0XHRpZiAoIHVybFNlcCAmJiB1cmxTZXAgIT09IHNlcCApIHtcclxuXHRcdFx0XHRcdFx0c2VhcmNoX2tleSA9IHNlYXJjaF9rZXkucmVwbGFjZSggbmV3IFJlZ0V4cCggJ1xcXFxzKicgKyBlc2NVcmxTZXAgKyAnXFxcXHMqJywgJ2cnICksIHNlcCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIE5vcm1hbGl6ZSBVSSBzZXBhcmF0b3IuXHJcblx0XHRcdFx0XHRzZWFyY2hfa2V5ID0gc2VhcmNoX2tleS5yZXBsYWNlKCBuZXcgUmVnRXhwKCAnXFxcXHMqJyArIGVzY1NlcCArICdcXFxccyonLCAnZycgKSwgc2VwICk7XHJcblx0XHRcdFx0XHRzZWFyY2hfa2V5ID0gc2VhcmNoX2tleS5yZXBsYWNlKCBuZXcgUmVnRXhwKCBlc2NTZXAgKyAnezIsfScsICdnJyApLCBzZXAgKTtcclxuXHRcdFx0XHRcdHNlYXJjaF9rZXkgPSBzZWFyY2hfa2V5LnJlcGxhY2UoIG5ldyBSZWdFeHAoICdeJyArIGVzY1NlcCArICcrfCcgKyBlc2NTZXAgKyAnKyQnLCAnZycgKSwgJycgKS50cmltKCk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF9lX3NlcCApIHt9XHJcblxyXG5cdFx0XHRcdC8vIENsYW1wIGxlbmd0aCAoYXZvaWQgc2lsbHkgVVJMcykuXHJcblx0XHRcdFx0aWYgKCBzZWFyY2hfa2V5Lmxlbmd0aCA+IDgwICkge1xyXG5cdFx0XHRcdFx0c2VhcmNoX2tleSA9IHNlYXJjaF9rZXkuc2xpY2UoIDAsIDgwICkudHJpbSgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIHNlYXJjaF9rZXkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBNYXJrIGFzIGhhbmRsZWQgKHdlIGhhdmUgYSByZWFsIHZhbHVlKS5cclxuXHRcdFx0XHR3aW5kb3cuX193cGJjX2JmYl9hdXRvX29wZW5fdGVtcGxhdGVfZG9uZSA9IHRydWU7XHJcblxyXG5cdFx0XHRcdC8vIFdhaXQgZm9yIHRoZSBtb2RhbCBoZWxwZXIgdG8gZXhpc3QgKHNjcmlwdCBsb2FkLW9yZGVyIHNhZmUpLlxyXG5cdFx0XHRcdGNvbnN0IHJlYWR5ID0gYXdhaXQgdGhpcy5fd2FpdF9mb3JfYXBwbHlfdGVtcGxhdGVfc2VhcmNoX2ZuKCAzNTAwICk7XHJcblx0XHRcdFx0aWYgKCAhIHJlYWR5ICkge1xyXG5cdFx0XHRcdFx0Ly8gU2lsZW50IGZhaWwgKG9yIGxvZyBpbiBkZXYpLlxyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKCAnV1BCQyBCRkI6IGFwcGx5IHRlbXBsYXRlIG1vZGFsIGhlbHBlciBub3QgcmVhZHkgKGF1dG9fb3Blbl90ZW1wbGF0ZSBza2lwcGVkKS4nICk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UyICkge31cclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIE9wZW4gbW9kYWwgd2l0aCBwcmVmaWxsZWQgc2VhcmNoLlxyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2JmYl9fbWVudV9mb3Jtc19fYXBwbHlfdGVtcGxhdGVfc2VhcmNoKCBzZWFyY2hfa2V5LCBudWxsICk7XHJcblxyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cclxuXHRcdFx0fSBjYXRjaCAoIF9lMyApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFdhaXQgdW50aWwgd3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlX3NlYXJjaCgpIGV4aXN0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gdGltZW91dF9tc1xyXG5cdFx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XHJcblx0XHQgKi9cclxuXHRcdF93YWl0X2Zvcl9hcHBseV90ZW1wbGF0ZV9zZWFyY2hfZm4odGltZW91dF9tcykge1xyXG5cclxuXHRcdFx0dGltZW91dF9tcyA9IHBhcnNlSW50KCB0aW1lb3V0X21zIHx8IDAsIDEwICk7XHJcblx0XHRcdGlmICggISB0aW1lb3V0X21zIHx8IHRpbWVvdXRfbXMgPCAyMDAgKSB7XHJcblx0XHRcdFx0dGltZW91dF9tcyA9IDIwMDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKCAocmVzb2x2ZSkgPT4ge1xyXG5cclxuXHRcdFx0XHRjb25zdCBzdGFydGVkID0gRGF0ZS5ub3coKTtcclxuXHJcblx0XHRcdFx0Y29uc3QgaXNfcmVhZHkgPSAoKSA9PiB7XHJcblx0XHRcdFx0XHRyZXR1cm4gKHR5cGVvZiB3aW5kb3cud3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlX3NlYXJjaCA9PT0gJ2Z1bmN0aW9uJyk7XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0aWYgKCBpc19yZWFkeSgpICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHJlc29sdmUoIHRydWUgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IHQgPSBzZXRJbnRlcnZhbCggKCkgPT4ge1xyXG5cclxuXHRcdFx0XHRcdGlmICggaXNfcmVhZHkoKSApIHtcclxuXHRcdFx0XHRcdFx0Y2xlYXJJbnRlcnZhbCggdCApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVzb2x2ZSggdHJ1ZSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggKERhdGUubm93KCkgLSBzdGFydGVkKSA+IHRpbWVvdXRfbXMgKSB7XHJcblx0XHRcdFx0XHRcdGNsZWFySW50ZXJ2YWwoIHQgKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlc29sdmUoIGZhbHNlICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdH0sIDUwICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIExvYWQgYSBtb2R1bGUgYW5kIGluaXRpYWxpemUgaXQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtGdW5jdGlvbn0gTW9kdWxlX0NsYXNzIC0gTW9kdWxlIGNsYXNzIHJlZmVyZW5jZS5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucyA9IHt9XSAtIE9wdGlvbmFsIG1vZHVsZSBvcHRpb25zLlxyXG5cdFx0ICogQHJldHVybnMge1dQQkNfQkZCX01vZHVsZX1cclxuXHRcdCAqL1xyXG5cdFx0dXNlX21vZHVsZShNb2R1bGVfQ2xhc3MsIG9wdGlvbnMgPSB7fSkge1xyXG5cdFx0XHRjb25zdCBtb2QgPSBuZXcgTW9kdWxlX0NsYXNzKCB0aGlzLCBvcHRpb25zICk7XHJcblx0XHRcdGlmICggdHlwZW9mIG1vZC5pbml0ID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdG1vZC5pbml0KCk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5fbW9kdWxlcy5wdXNoKCBtb2QgKTtcclxuXHRcdFx0cmV0dXJuIG1vZDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERpc3Bvc2UgYWxsIGxpc3RlbmVycywgb2JzZXJ2ZXJzLCBhbmQgU29ydGFibGUgaW5zdGFuY2VzIGNyZWF0ZWQgYnkgdGhlIGJ1aWxkZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGRlc3Ryb3koKSB7XHJcblx0XHRcdC8vIE11dGF0aW9uIG9ic2VydmVyLlxyXG5cdFx0XHRpZiAoIHRoaXMuX3VzYWdlX29ic2VydmVyICkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHR0aGlzLl91c2FnZV9vYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHRcdFx0fSBjYXRjaCAoZSkge31cclxuXHRcdFx0XHR0aGlzLl91c2FnZV9vYnNlcnZlciA9IG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFBhZ2VzIG51bWJlcmluZyBvYnNlcnZlci5cclxuXHRcdFx0aWYgKCB0aGlzLl9wYWdlc19udW1iZXJpbmdfb2JzZXJ2ZXIgKSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHRoaXMuX3BhZ2VzX251bWJlcmluZ19vYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7fVxyXG5cdFx0XHRcdHRoaXMuX3BhZ2VzX251bWJlcmluZ19vYnNlcnZlciA9IG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFJlZ2lzdGVyZWQgRE9NIGxpc3RlbmVycy5cclxuXHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCB0aGlzLl9oYW5kbGVycyApICkge1xyXG5cdFx0XHRcdHRoaXMuX2hhbmRsZXJzLmZvckVhY2goICh7IHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0cyB9KSA9PiB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHR0YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lciggdHlwZSwgaGFuZGxlciwgb3B0cyApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdFx0XHQvLyBOby1vcC5cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0dGhpcy5faGFuZGxlcnMgPSBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gU29ydGFibGUgaW5zdGFuY2VzLlxyXG5cdFx0XHRpZiAoIHRoaXMuc29ydGFibGUgJiYgdHlwZW9mIHRoaXMuc29ydGFibGUuZGVzdHJveUFsbCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR0aGlzLnNvcnRhYmxlLmRlc3Ryb3lBbGwoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGVzdHJveSByZWdpc3RlcmVkIG1vZHVsZXMuXHJcblx0XHRcdGlmICggQXJyYXkuaXNBcnJheSggdGhpcy5fbW9kdWxlcyApICkge1xyXG5cdFx0XHRcdGZvciAoIGNvbnN0IG1vZCBvZiB0aGlzLl9tb2R1bGVzICkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0aWYgKCB0eXBlb2YgbW9kLmRlc3Ryb3kgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFx0bW9kLmRlc3Ryb3koKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBjYXRjaCggZSApeyBfd3BiYz8uZGV2Py5lcnJvciggJ1dQQkNfRm9ybV9CdWlsZGVyIC0gRGVzdHJveSByZWdpc3RlcmVkIG1vZHVsZXMnLCBlICk7IH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGhpcy5fbW9kdWxlcyA9IFtdO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBMaXZlIHJlZ2lvbiBjYW4gc3RheSBmb3IgdGhlIHBhZ2UgbGlmZXRpbWU7IHJlbW92ZSBpZiB5b3Ugd2FudCBmdWxsIGNsZWFudXAuXHJcblx0XHRcdC8vIGlmICggdGhpcy5fYXJpYV9saXZlICYmIHRoaXMuX2FyaWFfbGl2ZS5wYXJlbnROb2RlICkge1xyXG5cdFx0XHQvLyBcdHRoaXMuX2FyaWFfbGl2ZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCB0aGlzLl9hcmlhX2xpdmUgKTtcclxuXHRcdFx0Ly8gXHR0aGlzLl9hcmlhX2xpdmUgPSBudWxsO1xyXG5cdFx0XHQvLyB9XHJcblxyXG5cdFx0XHQvLyBDbGVhciBnbG9iYWxzIHRvIGhlbHAgR0MuXHJcblx0XHRcdHRoaXMuaW5zcGVjdG9yID0gbnVsbDtcclxuXHRcdFx0dGhpcy5wYWdlc19jb250YWluZXIgPSBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5pdGlhbGl6ZSBTb3J0YWJsZUpTIG9uIGEgY29udGFpbmVyIGZvciBmaWVsZHMgb3Igc2VjdGlvbnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyIC0gVGFyZ2V0IERPTSBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtGdW5jdGlvbn0gW29uX2FkZF9jYWxsYmFja10gLSBPcHRpb25hbCBjdXN0b20gaGFuZGxlciBmb3Igb25BZGQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0aW5pdF9zb3J0YWJsZSggY29udGFpbmVyLCBvbl9hZGRfY2FsbGJhY2sgPSB0aGlzLmhhbmRsZV9vbl9hZGQuYmluZCggdGhpcyApICkge1xyXG5cdFx0XHRpZiAoICEgY29udGFpbmVyICkgcmV0dXJuO1xyXG5cdFx0XHRpZiAoIHR5cGVvZiBTb3J0YWJsZSA9PT0gJ3VuZGVmaW5lZCcgKSByZXR1cm47XHJcblx0XHRcdC8vIElmIGNvbnRhaW5lciBpcyBub3QgYXR0YWNoZWQgeWV0IChlLmcuLCBmcmVzaGx5IGNsb25lZCksIGRlZmVyIHRvIG5leHQgdGljay5cclxuXHRcdFx0aWYgKCAhIGNvbnRhaW5lci5pc0Nvbm5lY3RlZCApIHtcclxuXHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGNvbnRhaW5lci5pc0Nvbm5lY3RlZCApIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5zb3J0YWJsZS5lbnN1cmUoIGNvbnRhaW5lciwgJ2NhbnZhcycsIHsgb25BZGQ6IG9uX2FkZF9jYWxsYmFjayB9ICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSwgMCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnNvcnRhYmxlLmVuc3VyZSggY29udGFpbmVyLCAnY2FudmFzJywgeyBvbkFkZDogb25fYWRkX2NhbGxiYWNrIH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhhbmRsZXIgd2hlbiBhbiBpdGVtIGlzIGFkZGVkIHZpYSBkcmFnLWFuZC1kcm9wLlxyXG5cdFx0ICogQXBwbGllcyB1c2FnZSBsaW1pdHMsIG5lc3RpbmcgY2hlY2tzLCBhbmQgYnVpbGRzIG5ldyBmaWVsZCBpZiBuZWVkZWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGV2dCAtIFNvcnRhYmxlSlMgZXZlbnQgb2JqZWN0LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGhhbmRsZV9vbl9hZGQoIGV2dCApIHtcclxuXHRcdFx0aWYgKCAhIGV2dCB8fCAhIGV2dC5pdGVtIHx8ICEgZXZ0LnRvICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IGVsID0gZXZ0Lml0ZW07XHJcblxyXG5cdFx0XHQvLyAtLS0gU2VjdGlvbiBwYXRoLiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0aWYgKCBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRjb25zdCBuZXN0aW5nX2xldmVsID0gdGhpcy5nZXRfbmVzdGluZ19sZXZlbCggZWwgKTtcclxuXHRcdFx0XHRpZiAoIG5lc3RpbmdfbGV2ZWwgPj0gdGhpcy5tYXhfbmVzdGVkX3ZhbHVlICkge1xyXG5cdFx0XHRcdFx0YWxlcnQoICdUb28gbWFueSBuZXN0ZWQgc2VjdGlvbnMuJyApO1xyXG5cdFx0XHRcdFx0ZWwucmVtb3ZlKCk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMuaW5pdF9hbGxfbmVzdGVkX3NvcnRhYmxlcyggZWwgKTtcclxuXHJcblx0XHRcdFx0Ly8gRW5zdXJlIFVJIGlzIGZ1bGx5IGluaXRpYWxpemVkIGZvciBuZXdseSBwbGFjZWQvbW92ZWQgc2VjdGlvbnMuXHJcblx0XHRcdFx0dGhpcy5hZGRfb3ZlcmxheV90b29sYmFyKCBlbCApO1xyXG5cdFx0XHRcdGNvbnN0IHJvdyA9IGVsLnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAud3BiY19iZmJfX3JvdycgKTtcclxuXHRcdFx0XHRpZiAoIHJvdyApIHtcclxuXHRcdFx0XHRcdHRoaXMuX3JlYnVpbGRfcmVzaXplcnNfZm9yX3Jvdyggcm93ICk7XHJcblx0XHRcdFx0XHR0aGlzLmxheW91dC5zZXRfZXF1YWxfYmFzZXMoIHJvdywgdGhpcy5jb2xfZ2FwX3BlcmNlbnQgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRoaXMudXNhZ2UudXBkYXRlX3BhbGV0dGVfdWkoKTtcclxuXHJcblx0XHRcdFx0dGhpcy5zZWxlY3RfZmllbGQoIGVsLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAtLS0gRmllbGQgcGF0aC4gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0Y29uc3QgaXNfZnJvbV9wYWxldHRlID0gdGhpcy5wYWxldHRlX3Vscz8uaW5jbHVkZXM/LihldnQuZnJvbSk7XHJcblx0XHRcdGNvbnN0IHBhbGV0dGVJZCAgICAgICA9IGVsPy5kYXRhc2V0Py5pZDtcclxuXHJcblx0XHRcdGlmICggISBwYWxldHRlSWQgKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnRHJvcHBlZCBlbGVtZW50IG1pc3NpbmcgZGF0YS1pZC4nLCBlbCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBpc19mcm9tX3BhbGV0dGUgKSB7XHJcblx0XHRcdFx0Ly8gUmVhZCBkYXRhIGJlZm9yZSByZW1vdmluZyB0aGUgdGVtcG9yYXJ5IGNsb25lLlxyXG5cdFx0XHRcdGNvbnN0IGZpZWxkX2RhdGEgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGVsICk7XHJcblx0XHRcdFx0Y29uc3QgdXNhZ2Vfa2V5ICA9IHBhbGV0dGVJZDtcclxuXHRcdFx0XHRmaWVsZF9kYXRhLnVzYWdlX2tleSA9IHVzYWdlX2tleTtcclxuXHRcdFx0XHRpZiAoICd1aWQnIGluIGZpZWxkX2RhdGEgKSB7XHJcblx0XHRcdFx0XHRkZWxldGUgZmllbGRfZGF0YS51aWQ7ICAvLyBHdWFyZDogbmV2ZXIgY2FycnkgYSBVSUQgZnJvbSBwYWxldHRlL0RPTSBjbG9uZXMuXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBSZW1vdmUgU29ydGFibGUncyB0ZW1wb3JhcnkgY2xvbmUgc28gY291bnRzIGFyZSBhY2N1cmF0ZS5cclxuXHRcdFx0XHRlbC5yZW1vdmUoKTtcclxuXHJcblx0XHRcdFx0Ly8gQ2VudHJhbGl6ZWQgdXNhZ2UgZ2F0ZS5cclxuXHRcdFx0XHRpZiAoICEgdGhpcy51c2FnZS5nYXRlX29yX2FsZXJ0KCB1c2FnZV9rZXksIHsgbGFiZWw6IGZpZWxkX2RhdGEubGFiZWwgfHwgdXNhZ2Vfa2V5IH0gKSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEJ1aWxkIGFuZCBpbnNlcnQgdGhlIHJlYWwgZmllbGQgbm9kZSBhdCB0aGUgaW50ZW5kZWQgaW5kZXguXHJcblx0XHRcdFx0Y29uc3QgcmVidWlsdCA9IHRoaXMuYnVpbGRfZmllbGQoIGZpZWxkX2RhdGEgKTtcclxuXHRcdFx0XHRpZiAoICEgcmVidWlsdCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IHNlbGVjdG9yICAgICAgID0gU29ydGFibGUuZ2V0KCBldnQudG8gKT8ub3B0aW9ucz8uZHJhZ2dhYmxlIHx8ICcud3BiY19iZmJfX2ZpZWxkLCAud3BiY19iZmJfX3NlY3Rpb24nO1xyXG5cdFx0XHRcdGNvbnN0IHNjb3BlZFNlbGVjdG9yID0gc2VsZWN0b3Iuc3BsaXQoICcsJyApLm1hcCggcyA9PiBgOnNjb3BlID4gJHtzLnRyaW0oKX1gICkuam9pbiggJywgJyApO1xyXG5cdFx0XHRcdGNvbnN0IGRyYWdnYWJsZXMgICAgID0gQXJyYXkuZnJvbSggZXZ0LnRvLnF1ZXJ5U2VsZWN0b3JBbGwoIHNjb3BlZFNlbGVjdG9yICkgKTtcclxuXHRcdFx0XHRjb25zdCBiZWZvcmUgICAgICAgICA9IE51bWJlci5pc0ludGVnZXIoIGV2dC5uZXdJbmRleCApID8gKGRyYWdnYWJsZXNbZXZ0Lm5ld0luZGV4XSA/PyBudWxsKSA6IG51bGw7XHJcblxyXG5cdFx0XHRcdGV2dC50by5pbnNlcnRCZWZvcmUoIHJlYnVpbHQsIGJlZm9yZSApO1xyXG5cdFx0XHRcdGVsID0gcmVidWlsdDsgLy8gQ29udGludWUgd2l0aCB0aGUgdW5pZmllZCBwYXRoIGJlbG93LlxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIE1vdmluZyBhbiBleGlzdGluZyBmaWVsZCB3aXRoaW4gdGhlIGNhbnZhcy4gTm8gdXNhZ2UgZGVsdGEgaGVyZS5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRmluYWxpemU6IGRlY29yYXRlLCBlbWl0LCBob29rLCBhbmQgc2VsZWN0LlxyXG5cdFx0XHR0aGlzLmRlY29yYXRlX2ZpZWxkKCBlbCApO1xyXG5cdFx0XHR0aGlzLl9lbWl0X2NvbnN0KCBXUEJDX0JGQl9FdmVudHMuRklFTERfQURELCB7IGVsLCBkYXRhOiBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGVsICkgfSApO1xyXG5cdFx0XHR0aGlzLnVzYWdlLnVwZGF0ZV9wYWxldHRlX3VpKCk7XHJcblx0XHRcdHRoaXMudHJpZ2dlcl9maWVsZF9kcm9wX2NhbGxiYWNrKCBlbCwgJ2Ryb3AnICk7XHJcblx0XHRcdHRoaXMuc2VsZWN0X2ZpZWxkKCBlbCwgeyBzY3JvbGxJbnRvVmlldzogdHJ1ZSB9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDYWxsIHN0YXRpYyBvbl9maWVsZF9kcm9wIG1ldGhvZCBmb3Igc3VwcG9ydGVkIGZpZWxkIHR5cGVzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkX2VsIC0gRmllbGQgZWxlbWVudCB0byBoYW5kbGUuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY29udGV4dCAtIENvbnRleHQgb2YgdGhlIGV2ZW50OiAnZHJvcCcgfCAnbG9hZCcgfCAncHJldmlldycuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0dHJpZ2dlcl9maWVsZF9kcm9wX2NhbGxiYWNrKCBmaWVsZF9lbCwgY29udGV4dCA9ICdkcm9wJyApIHtcclxuXHRcdFx0aWYgKCAhIGZpZWxkX2VsIHx8ICEgZmllbGRfZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgZmllbGRfZGF0YSA9IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggZmllbGRfZWwgKTtcclxuXHJcblx0XHRcdGNvbnN0IHR5cGUgPSBmaWVsZF9kYXRhLnR5cGU7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IEZpZWxkQ2xhc3MgPSB0aGlzLl9nZXRSZW5kZXJlcih0eXBlKTtcclxuXHRcdFx0XHRpZiAoIEZpZWxkQ2xhc3MgJiYgdHlwZW9mIEZpZWxkQ2xhc3Mub25fZmllbGRfZHJvcCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdEZpZWxkQ2xhc3Mub25fZmllbGRfZHJvcCggZmllbGRfZGF0YSwgZmllbGRfZWwsIHsgY29udGV4dCB9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggZXJyICkge1xyXG5cdFx0XHRcdGNvbnNvbGUud2FybiggYG9uX2ZpZWxkX2Ryb3AgZmFpbGVkIGZvciB0eXBlIFwiJHt0eXBlfVwiLmAsIGVyciApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDYWxjdWxhdGUgbmVzdGluZyBkZXB0aCBvZiBhIHNlY3Rpb24gYmFzZWQgb24gcGFyZW50IGhpZXJhcmNoeS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsIC0gVGFyZ2V0IHNlY3Rpb24gZWxlbWVudC5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJ9IE5lc3RpbmcgZGVwdGggKDAgPSB0b3AtbGV2ZWwpLlxyXG5cdFx0ICovXHJcblx0XHRnZXRfbmVzdGluZ19sZXZlbCggc2VjdGlvbl9lbCApIHtcclxuXHRcdFx0bGV0IGxldmVsICA9IDA7XHJcblx0XHRcdGxldCBwYXJlbnQgPSBzZWN0aW9uX2VsLmNsb3Nlc3QoICcud3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHJcblx0XHRcdHdoaWxlICggcGFyZW50ICkge1xyXG5cdFx0XHRcdGNvbnN0IG91dGVyID0gcGFyZW50LmNsb3Nlc3QoICcud3BiY19iZmJfX3NlY3Rpb24nICk7XHJcblx0XHRcdFx0aWYgKCAhIG91dGVyICkge1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGxldmVsKys7XHJcblx0XHRcdFx0cGFyZW50ID0gb3V0ZXIuY2xvc2VzdCggJy53cGJjX2JmYl9fY29sdW1uJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBsZXZlbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENyZWF0ZSBhIGZpZWxkIERPTSBlbGVtZW50IGZyb20gc3RydWN0dXJlZCBkYXRhLlxyXG5cdFx0ICogQXBwbGllcyBsYWJlbCwgdHlwZSwgZHJhZyBoYW5kbGUsIGFuZCB2aXN1YWwgbW9kZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmllbGRfZGF0YSAtIEZpZWxkIHByb3BlcnRpZXMgKGlkLCB0eXBlLCBsYWJlbCwgZXRjLikuXHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR8bnVsbH0gQnVpbHQgZmllbGQgZWxlbWVudCwgb3IgbnVsbCBvbiBlcnJvci9saW1pdC5cclxuXHRcdCAqL1xyXG5cdFx0YnVpbGRfZmllbGQoIGZpZWxkX2RhdGEgKSB7XHJcblx0XHRcdGlmICggISBmaWVsZF9kYXRhIHx8IHR5cGVvZiBmaWVsZF9kYXRhICE9PSAnb2JqZWN0JyApIHtcclxuXHRcdFx0XHRjb25zb2xlLndhcm4oICdJbnZhbGlkIGZpZWxkIGRhdGE6JywgZmllbGRfZGF0YSApO1xyXG5cdFx0XHRcdHJldHVybiBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX2ZpZWxkIGlzLWludmFsaWQnLCAnSW52YWxpZCBmaWVsZCcgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGVjaWRlIGEgZGVzaXJlZCBpZCBmaXJzdCAobWF5IGNvbWUgZnJvbSB1c2VyL3BhbGV0dGUpLlxyXG5cdFx0XHRsZXQgZGVzaXJlZElkUmF3O1xyXG5cdFx0XHRpZiAoICEgZmllbGRfZGF0YS5pZCB8fCAnJyA9PT0gU3RyaW5nKCBmaWVsZF9kYXRhLmlkICkudHJpbSgpICkge1xyXG5cdFx0XHRcdGNvbnN0IGJhc2UgICA9IChmaWVsZF9kYXRhLmxhYmVsID8gU3RyaW5nKCBmaWVsZF9kYXRhLmxhYmVsICkgOiAoZmllbGRfZGF0YS50eXBlIHx8ICdmaWVsZCcpKVxyXG5cdFx0XHRcdFx0LnRvTG93ZXJDYXNlKClcclxuXHRcdFx0XHRcdC5yZXBsYWNlKCAvW15hLXowLTldKy9nLCAnLScgKVxyXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9eLSt8LSskL2csICcnICk7XHJcblx0XHRcdFx0ZGVzaXJlZElkUmF3ID0gYCR7YmFzZSB8fCAnZmllbGQnfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDcgKX1gO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRlc2lyZWRJZFJhdyA9IFN0cmluZyggZmllbGRfZGF0YS5pZCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTYW5pdGl6ZSB0aGUgaWQgdGhlIHVzZXIgcHJvdmlkZWQuXHJcblx0XHRcdGNvbnN0IGRlc2lyZWRJZCA9IFdQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfaWQoIGRlc2lyZWRJZFJhdyApO1xyXG5cclxuXHRcdFx0Ly8gVXNhZ2Uga2V5IHJlbWFpbnMgc3RhYmxlIChwYWxldHRlIHNldHMgdXNhZ2Vfa2V5OyBvdGhlcndpc2UgdXNlICpyYXcqIHVzZXIgaW50ZW50KS5cclxuXHRcdFx0bGV0IHVzYWdlS2V5ID0gZmllbGRfZGF0YS51c2FnZV9rZXkgfHwgZmllbGRfZGF0YS50eXBlIHx8IGRlc2lyZWRJZFJhdztcclxuXHRcdFx0Ly8gTm9ybWFsaXplIGNvbW1vbiBhbGlhc2VzIHRvIHBhbGV0dGUgaWRzIChleHRlbmQgYXMgbmVlZGVkKS5cclxuXHRcdFx0aWYgKCB1c2FnZUtleSA9PT0gJ2lucHV0LXRleHQnICkge1xyXG5cdFx0XHRcdHVzYWdlS2V5ID0gJ3RleHQnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBFbnN1cmUgdGhlIERPTS9kYXRhLWlkIHdlIGFjdHVhbGx5IHVzZSBpcyB1bmlxdWUgKHBvc3Qtc2FuaXRpemF0aW9uKS5cclxuXHRcdFx0ZmllbGRfZGF0YS5pZCA9IHRoaXMuaWQuZW5zdXJlX3VuaXF1ZV9maWVsZF9pZCggZGVzaXJlZElkICk7XHJcblxyXG5cdFx0XHQvLyBFbnN1cmUgbmFtZSBleGlzdHMsIHNhbml0aXplZCwgYW5kIHVuaXF1ZS5cclxuXHRcdFx0bGV0IGRlc2lyZWROYW1lID0gKGZpZWxkX2RhdGEubmFtZSAhPSBudWxsKSA/IGZpZWxkX2RhdGEubmFtZSA6IGZpZWxkX2RhdGEuaWQ7XHJcblx0XHRcdGRlc2lyZWROYW1lICAgICA9IFdQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggZGVzaXJlZE5hbWUgKTtcclxuXHRcdFx0ZmllbGRfZGF0YS5uYW1lID0gdGhpcy5pZC5lbnN1cmVfdW5pcXVlX2ZpZWxkX25hbWUoIGRlc2lyZWROYW1lICk7XHJcblxyXG5cdFx0XHQvLyBDaGVjayB1c2FnZSBjb3VudC5cclxuXHRcdFx0aWYgKCAhIHRoaXMudXNhZ2UuaXNfdXNhZ2Vfb2soIHVzYWdlS2V5ICkgKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCBgRmllbGQgXCIke3VzYWdlS2V5fVwiIHNraXBwZWQg4oCTIGV4Y2VlZHMgdXNhZ2UgbGltaXQuYCApO1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBlbCAgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHQvLyBPbmx5IHRoaXMgYnVpbGRlciBVSUQgKGRvIE5PVCBhbGxvdyBvdmVycmlkZXMgZnJvbSBpbmNvbWluZyBkYXRhKS5cclxuXHRcdFx0Y29uc3QgdWlkID0gdGhpcy5fZ2VuZXJhdGVfdWlkKCAnZicgKTtcclxuXHRcdFx0ZWwuc2V0QXR0cmlidXRlKCAnZGF0YS11aWQnLCB1aWQgKTtcclxuXHRcdFx0Ly8gRHJvcCBhbnkgdXBzdHJlYW0gdWlkIHNvIHNldF9kYXRhX2F0dHJpYnV0ZXMgY2Fu4oCZdCBjbG9iYmVyIG91cnMuXHJcblx0XHRcdGNvbnN0IHsgdWlkOiBfZGlzY2FyZFVpZCwgLi4uc2FmZURhdGEgfSA9IChmaWVsZF9kYXRhIHx8IHt9KTtcclxuXHRcdFx0V1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLnNldF9kYXRhX2F0dHJpYnV0ZXMoIGVsLCB7IC4uLnNhZmVEYXRhLCB1c2FnZV9rZXk6IHVzYWdlS2V5IH0gKTtcclxuXHJcblx0XHRcdC8vIHJlZmxlY3QgbWluIHdpZHRoIChwdXJlbHkgdmlzdWFsOyByZXNpemluZyBlbmZvcmNlbWVudCBoYXBwZW5zIGluIHRoZSByZXNpemVyKS5cclxuXHRcdFx0Y29uc3QgbWluX3JhdyA9IFN0cmluZyggZmllbGRfZGF0YS5taW5fd2lkdGggfHwgJycgKS50cmltKCk7XHJcblx0XHRcdGlmICggbWluX3JhdyApIHtcclxuXHRcdFx0XHQvLyBsZXQgQ1NTIGRvIHRoZSBwYXJzaW5nOiBzdXBwb3J0cyBweCwgJSwgcmVtLCBldGMuXHJcblx0XHRcdFx0ZWwuc3R5bGUubWluV2lkdGggPSBtaW5fcmF3O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRlbC5pbm5lckhUTUwgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIucmVuZGVyX2ZpZWxkX2lubmVyX2h0bWwoIGZpZWxkX2RhdGEgKTtcclxuXHRcdFx0dGhpcy5kZWNvcmF0ZV9maWVsZCggZWwgKTtcclxuXHJcblx0XHRcdHJldHVybiBlbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVuaGFuY2UgYSBmaWVsZCBlbGVtZW50IHdpdGggZHJhZyBoYW5kbGUsIGRlbGV0ZSwgbW92ZSBidXR0b25zLCBvciBwcmV2aWV3LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkX2VsIC0gVGFyZ2V0IGZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZGVjb3JhdGVfZmllbGQoIGZpZWxkX2VsICkge1xyXG5cdFx0XHRpZiAoICEgZmllbGRfZWwgfHwgZmllbGRfZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmaWVsZF9lbC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHRmaWVsZF9lbC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2RyYWctYW55d2hlcmUnICk7IC8vIExldHMgZ3JhYiB0aGUgZmllbGQgY2FyZCBpdHNlbGYgdG8gZHJhZyAob3V0c2lkZSBvZiBvdmVybGF5IC8gaW5wdXRzKS5cclxuXHJcblx0XHRcdC8vIFJlbmRlci5cclxuXHRcdFx0aWYgKCB0aGlzLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcl9wcmV2aWV3KCBmaWVsZF9lbCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRoaXMuYWRkX292ZXJsYXlfdG9vbGJhciggZmllbGRfZWwgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQWRkIG92ZXJsYXkgdG9vbGJhciB0byBhIGZpZWxkL3NlY3Rpb24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZmllbGRfZWwgLSBGaWVsZCBvciBzZWN0aW9uIGVsZW1lbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0YWRkX292ZXJsYXlfdG9vbGJhcihmaWVsZF9lbCkge1xyXG5cdFx0XHRXUEJDX0JGQl9PdmVybGF5LmVuc3VyZSggdGhpcywgZmllbGRfZWwgKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgYSBzaW1wbGlmaWVkIHZpc3VhbCByZXByZXNlbnRhdGlvbiBvZiBhIGZpZWxkIChQcmV2aWV3IE1vZGUpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkX2VsIC0gVGFyZ2V0IGZpZWxkIGVsZW1lbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0cmVuZGVyX3ByZXZpZXcoIGZpZWxkX2VsICkge1xyXG5cdFx0XHRpZiAoICEgZmllbGRfZWwgfHwgISB0aGlzLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGRhdGEgICAgICAgICAgICAgPSBXUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGZpZWxkX2VsICk7XHJcblx0XHRcdGNvbnN0IHR5cGUgICAgICAgICAgICAgPSBkYXRhLnR5cGU7XHJcblx0XHRcdGNvbnN0IGlkICAgICAgICAgICAgICAgPSBkYXRhLmlkIHx8ICcnO1xyXG5cdFx0XHRjb25zdCBoYXNFeHBsaWNpdExhYmVsID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkYXRhLCAnbGFiZWwnICk7XHJcblx0XHRcdC8vIGNvbnN0IGxhYmVsICAgICAgICAgICAgPSBoYXNFeHBsaWNpdExhYmVsID8gZGF0YS5sYWJlbCA6IGlkOyAvLy5cclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc3QgUiA9IHRoaXMuX2dldFJlbmRlcmVyKCB0eXBlICk7XHJcblx0XHRcdFx0aWYgKCBSICYmIHR5cGVvZiBSLnJlbmRlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGNvbnN0IGN0eCA9IHtcclxuXHRcdFx0XHRcdFx0bW9kZSAgIDogJ3ByZXZpZXcnLFxyXG5cdFx0XHRcdFx0XHRidWlsZGVyOiB0aGlzLFxyXG5cdFx0XHRcdFx0XHR0cGwgICAgOiAoaWQpID0+ICh3aW5kb3cud3AgJiYgd3AudGVtcGxhdGUgPyB3cC50ZW1wbGF0ZSggaWQgKSA6IG51bGwpLFxyXG5cdFx0XHRcdFx0XHRzYW5pdCAgOiBXUEJDX0JGQl9TYW5pdGl6ZVxyXG5cdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdC8vIFJlbmRlcmVyIGlzIHJlc3BvbnNpYmxlIGZvciB3cml0aW5nIHRvIGZpZWxkX2VsLmlubmVySFRNTC5cclxuXHRcdFx0XHRcdFIucmVuZGVyKCBmaWVsZF9lbCwgZGF0YSwgY3R4ICk7XHJcblxyXG5cdFx0XHRcdFx0ZmllbGRfZWwuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19wcmV2aWV3LXJlbmRlcmVkJyApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGUgKSB7XHJcblx0XHRcdFx0XHRcdC8vIGNvbnNvbGUud2FybiggYE5vIHJlbmRlcmVyIGZvdW5kIGZvciBmaWVsZCB0eXBlOiAke3R5cGV9LmAgKTtcclxuXHRcdFx0XHRcdFx0dy5fd3BiYz8uZGV2Py5vbmNlKCAncmVuZGVyX3ByZXZpZXcnLCBgTm8gcmVuZGVyZXIgZm91bmQgZm9yIGZpZWxkIHR5cGU6ICR7dHlwZX0uYCwgUiApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZmllbGRfZWwuaW5uZXJIVE1MID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLnJlbmRlcl9maWVsZF9pbm5lcl9odG1sKCBkYXRhICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggZXJyICkge1xyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdSZW5kZXJlciBlcnJvci4nLCBlcnIgKTtcclxuXHJcblx0XHRcdFx0ZmllbGRfZWwuaW5uZXJIVE1MID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLnJlbmRlcl9maWVsZF9pbm5lcl9odG1sKCBkYXRhICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuYWRkX292ZXJsYXlfdG9vbGJhciggZmllbGRfZWwgKTtcclxuXHJcblxyXG5cdFx0XHQvLyBPcHRpb25hbCBob29rIGFmdGVyIERPTSBpcyBpbiBwbGFjZS5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBSID0gdGhpcy5fZ2V0UmVuZGVyZXIoIHR5cGUgKTtcclxuXHRcdFx0XHQvLyBOZXcgY29udHJhY3Q6IHByZWZlciBoeWRyYXRlKCk7IGZhbGwgYmFjayB0byBsZWdhY3kgYWZ0ZXJfcmVuZGVyIGlmIHByZXNlbnQuXHJcblx0XHRcdFx0aWYgKCBSICYmIHR5cGVvZiBSLmh5ZHJhdGUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRSLmh5ZHJhdGUoIGZpZWxkX2VsLCBkYXRhLCB7XHJcblx0XHRcdFx0XHRcdG1vZGUgICA6ICdwcmV2aWV3JyxcclxuXHRcdFx0XHRcdFx0YnVpbGRlcjogdGhpcyxcclxuXHRcdFx0XHRcdFx0dHBsICAgIDogKGlkKSA9PiAod2luZG93LndwICYmIHdwLnRlbXBsYXRlID8gd3AudGVtcGxhdGUoIGlkICkgOiBudWxsKSxcclxuXHRcdFx0XHRcdFx0c2FuaXQgIDogV1BCQ19CRkJfU2FuaXRpemVcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBSICYmIHR5cGVvZiBSLmFmdGVyX3JlbmRlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFIuYWZ0ZXJfcmVuZGVyKCBkYXRhLCBmaWVsZF9lbCApOyAvLyBsZWdhY3kgY29tcGF0aWJpbGl0eS5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnIyICkge1xyXG5cdFx0XHRcdGNvbnNvbGUud2FybiggJ2FmdGVyX3JlbmRlciBob29rIGZhaWxlZC4nLCBlcnIyICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1vdmUgYW4gZWxlbWVudCAoZmllbGQvc2VjdGlvbikgdXAgb3IgZG93biBpbiBpdHMgcGFyZW50IGNvbnRhaW5lci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCAtIFRhcmdldCBlbGVtZW50IHRvIG1vdmUuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZGlyZWN0aW9uIC0gJ3VwJyBvciAnZG93bicuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0bW92ZV9pdGVtKCBlbCwgZGlyZWN0aW9uICkge1xyXG5cdFx0XHRjb25zdCBjb250YWluZXIgPSBlbD8ucGFyZW50RWxlbWVudDtcclxuXHRcdFx0aWYgKCAhIGNvbnRhaW5lciApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHNpYmxpbmdzID0gQXJyYXkuZnJvbSggY29udGFpbmVyLmNoaWxkcmVuICkuZmlsdGVyKCAoIGNoaWxkICkgPT5cclxuXHRcdFx0XHRjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgfHwgY2hpbGQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nIClcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdGNvbnN0IGN1cnJlbnRfaW5kZXggPSBzaWJsaW5ncy5pbmRleE9mKCBlbCApO1xyXG5cdFx0XHRpZiAoIGN1cnJlbnRfaW5kZXggPT09IC0xICkge1xyXG5cdFx0XHQgcmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBuZXdfaW5kZXggPSBkaXJlY3Rpb24gPT09ICd1cCcgPyBjdXJyZW50X2luZGV4IC0gMSA6IGN1cnJlbnRfaW5kZXggKyAxO1xyXG5cdFx0XHRpZiAoIG5ld19pbmRleCA8IDAgfHwgbmV3X2luZGV4ID49IHNpYmxpbmdzLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHJlZmVyZW5jZV9ub2RlID0gc2libGluZ3NbbmV3X2luZGV4XTtcclxuXHRcdFx0aWYgKCBkaXJlY3Rpb24gPT09ICd1cCcgKSB7XHJcblx0XHRcdFx0Y29udGFpbmVyLmluc2VydEJlZm9yZSggZWwsIHJlZmVyZW5jZV9ub2RlICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBkaXJlY3Rpb24gPT09ICdkb3duJyApIHtcclxuXHRcdFx0XHRjb250YWluZXIuaW5zZXJ0QmVmb3JlKCBlbCwgcmVmZXJlbmNlX25vZGUubmV4dFNpYmxpbmcgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2V0IHRoZSBudW1iZXIgb2YgY29sdW1ucyBmb3IgYSBnaXZlbiBzZWN0aW9uIGVsZW1lbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogLSBJbmNyZWFzaW5nOiBhcHBlbmRzIG5ldyBlbXB0eSBjb2x1bW5zIGFuZCByZXNpemVycywgKHJlKWluaXRzIFNvcnRhYmxlLCBhbmQgZXF1YWxpemVzIHdpZHRocy5cclxuXHRcdCAqIC0gRGVjcmVhc2luZzogbW92ZXMgY2hpbGRyZW4gb2YgcmVtb3ZlZCBjb2x1bW5zIGludG8gdGhlIHByZXZpb3VzIGNvbHVtbiwgcmVtb3ZlcyBjb2x1bW5zL3Jlc2l6ZXJzLFxyXG5cdFx0ICogcmVmcmVzaGVzIFNvcnRhYmxlLCBhbmQgZXF1YWxpemVzIHdpZHRocy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsIC0gVGhlIC53cGJjX2JmYl9fc2VjdGlvbiBlbGVtZW50IHRvIG11dGF0ZS5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBuZXdfY291bnRfcmF3IC0gRGVzaXJlZCBjb2x1bW4gY291bnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c2V0X3NlY3Rpb25fY29sdW1ucyggc2VjdGlvbl9lbCwgbmV3X2NvdW50X3JhdyApIHtcclxuXHRcdFx0aWYgKCAhIHNlY3Rpb25fZWwgfHwgISBzZWN0aW9uX2VsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qgcm93ID0gc2VjdGlvbl9lbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gLndwYmNfYmZiX19yb3cnICk7XHJcblx0XHRcdGlmICggISByb3cgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBOb3JtYWxpemUgYW5kIGNsYW1wIGNvdW50IChzdXBwb3J0cyAxLi40OyBleHRlbmQgaWYgbmVlZGVkKS5cclxuXHRcdFx0Y29uc3Qgb2xkX2NvbHMgPSB0aGlzLl9nZXRfcm93X2NvbHMoIHJvdyApO1xyXG5cdFx0XHRjb25zdCBjdXJyZW50ICA9IG9sZF9jb2xzLmxlbmd0aCB8fCAxO1xyXG5cdFx0XHRjb25zdCBtaW5fYyAgICA9IDE7XHJcblx0XHRcdGNvbnN0IG1heF9jICAgID0gNDtcclxuXHRcdFx0Y29uc3QgdGFyZ2V0ICAgPSBNYXRoLm1heCggbWluX2MsIE1hdGgubWluKCBtYXhfYywgcGFyc2VJbnQoIG5ld19jb3VudF9yYXcsIDEwICkgfHwgY3VycmVudCApICk7XHJcblxyXG5cdFx0XHRpZiAoIHRhcmdldCA9PT0gY3VycmVudCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblxyXG5cclxuXHRcdFx0Ly8gSW5jcmVhc2luZyBjb2x1bW5zIC0+IGFwcGVuZCBuZXcgY29sdW1ucyBhdCB0aGUgZW5kLlxyXG5cdFx0XHRpZiAoIHRhcmdldCA+IGN1cnJlbnQgKSB7XHJcblx0XHRcdFx0Zm9yICggbGV0IGkgPSBjdXJyZW50OyBpIDwgdGFyZ2V0OyBpKysgKSB7XHJcblxyXG5cdFx0XHRcdFx0Ly8gVE9ETyBGSVg6IHJlbW92ZSBzdHJheSBcIndwYmNfX2ZpZWxkXCIgY2xhc3M7IGtlZXAgY2Fub25pY2FsIGNvbHVtbiBjbGFzcyBvbmx5LiBGb3Igbm93IGl0IGlzIHJlcXVpcmVkLlxyXG5cdFx0XHRcdFx0Y29uc3QgY29sID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19jb2x1bW4gd3BiY19fZmllbGQnICk7XHJcblx0XHRcdFx0XHQvLyBHaXZlIGl0IHNvbWUgaW5pdGlhbCBiYXNpczsgd2lsbCBiZSBub3JtYWxpemVkIGFmdGVyLlxyXG5cdFx0XHRcdFx0Y29sLnN0eWxlLmZsZXhCYXNpcyA9ICggMTAwIC8gdGFyZ2V0ICkgKyAnJSc7XHJcblx0XHRcdFx0XHQvLyBNYWtlIHRoaXMgY29sdW1uIGEgZHJvcCB0YXJnZXQuXHJcblx0XHRcdFx0XHR0aGlzLmluaXRfc29ydGFibGU/LiggY29sICk7XHJcblx0XHRcdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIGNvbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0aGlzLl9yZWJ1aWxkX3Jlc2l6ZXJzX2Zvcl9yb3cocm93KTtcclxuXHRcdFx0XHQvLyBFcXVhbGl6ZSB3aWR0aHMgY29uc2lkZXJpbmcgZ2FwLlxyXG5cdFx0XHRcdHRoaXMubGF5b3V0LnNldF9lcXVhbF9iYXNlcyggcm93LCB0aGlzLmNvbF9nYXBfcGVyY2VudCApO1xyXG5cclxuXHRcdFx0XHQvLyBPdmVybGF5OiBlbnN1cmUgdGhlIGxheW91dCBwcmVzZXQgY2hpcHMgYXJlIHByZXNlbnQgZm9yID4xIGNvbHVtbnMuXHJcblx0XHRcdFx0dGhpcy5hZGRfb3ZlcmxheV90b29sYmFyKCBzZWN0aW9uX2VsICk7XHJcblxyXG5cdFx0XHRcdC8vIE5vdGlmeSBsaXN0ZW5lcnMgKGUuZy4sIE1pbi1XaWR0aCBHdWFyZCkgdGhhdCBzdHJ1Y3R1cmUgY2hhbmdlZC5cclxuXHRcdFx0XHR0aGlzLmJ1cy5lbWl0KCBXUEJDX0JGQl9FdmVudHMuU1RSVUNUVVJFX0NIQU5HRSwgeyBzb3VyY2UgOiAnY29sdW1ucy1jaGFuZ2UnLCBzZWN0aW9uOiBzZWN0aW9uX2VsLCBjb3VudCAgOiB0YXJnZXQgfSApO1xyXG5cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIERlY3JlYXNpbmcgY29sdW1ucyAtPiBtZXJnZSBjb250ZW50cyBvZiB0cmFpbGluZyBjb2x1bW5zIGludG8gdGhlIHByZXZpb3VzIG9uZSwgdGhlbiByZW1vdmUuXHJcblx0XHRcdGlmICggdGFyZ2V0IDwgY3VycmVudCApIHtcclxuXHRcdFx0XHQvLyBXZeKAmWxsIGFsd2F5cyByZW1vdmUgZnJvbSB0aGUgZW5kIGRvd24gdG8gdGhlIHRhcmdldCBjb3VudCxcclxuXHRcdFx0XHQvLyBtb3ZpbmcgYWxsIGNoaWxkcmVuIG9mIHRoZSBsYXN0IGNvbHVtbiBpbnRvIHRoZSBwcmV2aW91cyBjb2x1bW4uXHJcblx0XHRcdFx0Zm9yICggbGV0IGkgPSBjdXJyZW50OyBpID4gdGFyZ2V0OyBpLS0gKSB7XHJcblx0XHRcdFx0XHQvLyBSZWNvbXB1dGUgY3VycmVudCBsaXN0IGVhY2ggaXRlcmF0aW9uLlxyXG5cdFx0XHRcdFx0Y29uc3QgY29sc19ub3cgPSB0aGlzLl9nZXRfcm93X2NvbHMoIHJvdyApO1xyXG5cdFx0XHRcdFx0Y29uc3QgbGFzdCAgICAgPSBjb2xzX25vd1sgY29sc19ub3cubGVuZ3RoIC0gMSBdO1xyXG5cdFx0XHRcdFx0Y29uc3QgcHJldiAgICAgPSBjb2xzX25vd1sgY29sc19ub3cubGVuZ3RoIC0gMiBdIHx8IG51bGw7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBsYXN0ICYmIHByZXYgKSB7XHJcblx0XHRcdFx0XHRcdC8vIE1vdmUgY2hpbGRyZW4gKHNlY3Rpb25zIG9yIGZpZWxkcykgdG8gcHJldmlvdXMgY29sdW1uLlxyXG5cdFx0XHRcdFx0XHR3aGlsZSAoIGxhc3QuZmlyc3RDaGlsZCApIHtcclxuXHRcdFx0XHRcdFx0XHRwcmV2LmFwcGVuZENoaWxkKCBsYXN0LmZpcnN0Q2hpbGQgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHQvLyBSZW1vdmUgbGFzdCBjb2x1bW4uXHJcblx0XHRcdFx0XHRcdGxhc3QucmVtb3ZlKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBSZWJ1aWxkIHJlc2l6ZXJzIGFuZCByZWZyZXNoIFNvcnRhYmxlIG9uIHRoZSBzdXJ2aXZpbmcgY29sdW1ucy5cclxuXHRcdFx0XHR0aGlzLl9yZWJ1aWxkX3Jlc2l6ZXJzX2Zvcl9yb3cocm93KTtcclxuXHJcblx0XHRcdFx0dGhpcy5fZ2V0X3Jvd19jb2xzKCByb3cgKS5mb3JFYWNoKCBjb2wgPT4ge1xyXG5cdFx0XHRcdFx0Ly8gSWYgU29ydGFibGUgbWlzc2luZywgaW5pdDsgaWYgcHJlc2VudCwgZG8gbm90aGluZyAoU29ydGFibGUuZ2V0IHJldHVybnMgaW5zdGFuY2UpLlxyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgU29ydGFibGUgIT09ICd1bmRlZmluZWQnICYmICFTb3J0YWJsZS5nZXQ/LiggY29sICkgKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMuaW5pdF9zb3J0YWJsZT8uKCBjb2wgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRcdC8vIE5vcm1hbGl6ZSB3aWR0aHMuXHJcblx0XHRcdFx0Y29uc3QgY29tcHV0ZWQgPSB0aGlzLmxheW91dC5jb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3Jvdyggcm93LCB0aGlzLmNvbF9nYXBfcGVyY2VudCApO1xyXG5cdFx0XHRcdHRoaXMubGF5b3V0LmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93LCBjb21wdXRlZC5iYXNlcyApO1xyXG5cclxuXHRcdFx0XHQvLyBPdmVybGF5OiBoaWRlIGxheW91dCBwcmVzZXRzIGlmIHNpbmdsZS1jb2x1bW4gbm93OyBlbnN1cmUgdG9vbGJhciByZS1jaGVja3MuXHJcblx0XHRcdFx0dGhpcy5hZGRfb3ZlcmxheV90b29sYmFyKCBzZWN0aW9uX2VsICk7XHJcblxyXG5cdFx0XHRcdC8vIE5vdGlmeSBsaXN0ZW5lcnMgKGUuZy4sIE1pbi1XaWR0aCBHdWFyZCkgdGhhdCBzdHJ1Y3R1cmUgY2hhbmdlZC5cclxuXHRcdFx0XHR0aGlzLmJ1cy5lbWl0KCBXUEJDX0JGQl9FdmVudHMuU1RSVUNUVVJFX0NIQU5HRSwgeyBzb3VyY2UgOiAnY29sdW1ucy1jaGFuZ2UnLCBzZWN0aW9uOiBzZWN0aW9uX2VsLCBjb3VudCAgOiB0YXJnZXQgfSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUHVibGljIEFQSTogc2V0IHByZXZpZXcgbW9kZSBhbmQgKG9wdGlvbmFsbHkpIHJlYnVpbGQgdGhlIGNhbnZhcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZWRcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgW29wdHNdXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLnJlYnVpbGQ9dHJ1ZV1cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMucmVpbml0PXRydWVdXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIFtvcHRzLnNvdXJjZT0nc2V0dGluZ3MnXVxyXG5cdFx0ICovXHJcblx0XHRzZXRfcHJldmlld19tb2RlKGVuYWJsZWQsIG9wdHMgPSB7fSkge1xyXG5cclxuXHRcdFx0Y29uc3QgbmV4dCAgICA9ICEhZW5hYmxlZDtcclxuXHRcdFx0Y29uc3QgcmVidWlsZCA9IChvcHRzLnJlYnVpbGQgIT09IGZhbHNlKTtcclxuXHRcdFx0Y29uc3QgcmVpbml0ICA9IChvcHRzLnJlaW5pdCAhPT0gZmFsc2UpO1xyXG5cclxuXHRcdFx0aWYgKCBuZXh0ID09PSB0aGlzLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMucHJldmlld19tb2RlID0gbmV4dDtcclxuXHJcblx0XHRcdC8vIFJlYnVpbGQgRE9NIHNvIGZpZWxkcy9zZWN0aW9ucyByZW5kZXIgYWNjb3JkaW5nIHRvIHRoZSBuZXcgbW9kZS5cclxuXHRcdFx0aWYgKCByZWJ1aWxkICkge1xyXG5cdFx0XHRcdHRoaXMubG9hZF9zYXZlZF9zdHJ1Y3R1cmUoIHRoaXMuZ2V0X3N0cnVjdHVyZSgpLCB7IGRlZmVySWZUeXBpbmc6IHRydWUgfSApO1xyXG5cclxuXHRcdFx0XHQvLyBTb21lIHJlbmRlcmVycyByZWx5IG9uIG9uX2ZpZWxkX2Ryb3AgaG9va3MgdG8gKHJlKXdpcmUgdGhlbXNlbHZlcy5cclxuXHRcdFx0XHRpZiAoIHJlaW5pdCApIHtcclxuXHRcdFx0XHRcdHRoaXMuX3JlaW5pdF9hbGxfZmllbGRzKCAncHJldmlldycgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE9wdGlvbmFsIGV2ZW50IChzYWZlIGZhbGxiYWNrIHN0cmluZyBpZiBjb25zdGFudCBkb2Vzbid0IGV4aXN0KS5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBldiA9ICh3aW5kb3cuV1BCQ19CRkJfQ29yZT8uV1BCQ19CRkJfRXZlbnRzPy5QUkVWSUVXX01PREVfQ0hBTkdFKSB8fCAnd3BiYzpiZmI6cHJldmlldy1tb2RlLWNoYW5nZSc7XHJcblx0XHRcdFx0dGhpcy5idXM/LmVtaXQ/LiggZXYsIHsgZW5hYmxlZDogbmV4dCwgc291cmNlOiBvcHRzLnNvdXJjZSB8fCAnYnVpbGRlcicgfSApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQdWJsaWMgQVBJOiByZWZyZXNoIGNhbnZhcyBwcmV2aWV3cyB3aXRob3V0IGNoYW5naW5nIHByZXZpZXdfbW9kZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gIFtvcHRzXVxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5oYXJkPXRydWVdICAgICAgICAgICAgICBSZS1yZW5kZXIgYWxsIGZpZWxkczsgZmFsc2UgPT4gb25seSBzZWxlY3RlZC5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMucmVidWlsZD10cnVlXSAgICAgICAgICAgSWYgaGFyZDogcmVidWlsZCB2aWEgbG9hZF9zYXZlZF9zdHJ1Y3R1cmUoKS5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMucmVpbml0PXRydWVdICAgICAgICAgICAgSWYgaGFyZCtyZWJ1aWxkOiBjYWxsIF9yZWluaXRfYWxsX2ZpZWxkcygncHJldmlldycpLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5yZXN0b3JlX3NlbGVjdGlvbj10cnVlXSBSZXN0b3JlIHByZXZpb3VzbHkgc2VsZWN0ZWQgZmllbGQuXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLnJlc3RvcmVfc2Nyb2xsPXRydWVdICAgIFJlc3RvcmUgY2FudmFzIHNjcm9sbC5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuc2lsZW50X2luc3BlY3Rvcj1mYWxzZV0gU2tpcCBJbnNwZWN0b3Igc3luYyB0byBhdm9pZCBsb29wcy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW29wdHMuc291cmNlPSdzZXR0aW5ncyddICAgICAgQ2FsbGVyIHRhZyBmb3IgbG9ncy9ldmVudHMuXHJcblx0XHQgKi9cclxuXHRcdHJlZnJlc2hfY2FudmFzKG9wdHMgPSB7fSkge1xyXG5cclxuXHRcdFx0aWYgKCB0aGlzLl9fcmVmcmVzaGluZ19jYW52YXMgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX19yZWZyZXNoaW5nX2NhbnZhcyA9IHRydWU7XHJcblxyXG5cdFx0XHRjb25zdCBoYXJkICAgICAgICAgICAgICA9IChvcHRzLmhhcmQgIT09IGZhbHNlKTtcclxuXHRcdFx0Y29uc3QgcmVidWlsZCAgICAgICAgICAgPSAob3B0cy5yZWJ1aWxkICE9PSBmYWxzZSk7XHJcblx0XHRcdGNvbnN0IHJlaW5pdCAgICAgICAgICAgID0gKG9wdHMucmVpbml0ICE9PSBmYWxzZSk7XHJcblx0XHRcdGNvbnN0IHJlc3RvcmVfc2VsZWN0aW9uID0gKG9wdHMucmVzdG9yZV9zZWxlY3Rpb24gIT09IGZhbHNlKTtcclxuXHRcdFx0Y29uc3QgcmVzdG9yZV9zY3JvbGwgICAgPSAob3B0cy5yZXN0b3JlX3Njcm9sbCAhPT0gZmFsc2UpO1xyXG5cdFx0XHRjb25zdCBzb3VyY2UgICAgICAgICAgICA9IG9wdHMuc291cmNlIHx8ICdidWlsZGVyJztcclxuXHRcdFx0Y29uc3Qgc2lsZW50X2luc3BlY3RvciAgPSAob3B0cy5zaWxlbnRfaW5zcGVjdG9yID09PSB0cnVlKTtcclxuXHJcblx0XHRcdGNvbnN0IGV2cyAgICAgICA9ICh3aW5kb3cuV1BCQ19CRkJfQ29yZSAmJiB3aW5kb3cuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9FdmVudHMpIHx8IHt9O1xyXG5cdFx0XHRjb25zdCBFVl9CRUZPUkUgPSBldnMuQ0FOVkFTX1JFRlJFU0ggfHwgJ3dwYmM6YmZiOmNhbnZhcy1yZWZyZXNoJztcclxuXHRcdFx0Y29uc3QgRVZfQUZURVIgID0gZXZzLkNBTlZBU19SRUZSRVNIRUQgfHwgJ3dwYmM6YmZiOmNhbnZhcy1yZWZyZXNoZWQnO1xyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQvLyBTbmFwc2hvdCBVSSBzdGF0ZS5cclxuXHRcdFx0XHRjb25zdCBpbl9wcmV2aWV3ID0gISF0aGlzLnByZXZpZXdfbW9kZTtcclxuXHRcdFx0XHRjb25zdCBjYW52YXMgICAgID0gdGhpcy5fY2FudmFzX3Jvb3QgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fY2FudmFzJyApIHx8IGRvY3VtZW50LmJvZHk7XHJcblx0XHRcdFx0Y29uc3Qgc2NfdG9wICAgICA9IHJlc3RvcmVfc2Nyb2xsID8gKGNhbnZhcyA/IGNhbnZhcy5zY3JvbGxUb3AgOiAwKSA6IDA7XHJcblxyXG5cdFx0XHRcdGxldCBzZWxfZWwgPSBudWxsLCBzZWxfaWQgPSBudWxsO1xyXG5cdFx0XHRcdGlmICggcmVzdG9yZV9zZWxlY3Rpb24gJiYgdHlwZW9mIHRoaXMuZ2V0X3NlbGVjdGVkX2ZpZWxkID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0c2VsX2VsID0gdGhpcy5nZXRfc2VsZWN0ZWRfZmllbGQoKTtcclxuXHRcdFx0XHRcdGlmICggc2VsX2VsICYmIHNlbF9lbC5nZXRBdHRyaWJ1dGUgKSB7XHJcblx0XHRcdFx0XHRcdHNlbF9pZCA9IHNlbF9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWlkJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gU2lnbmFsIFwiYmVmb3JlXCIgZm9yIHBhY2tzIHRoYXQgd2FudCB0byB0ZWFyZG93biBvdmVybGF5cy5cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0dGhpcy5idXMgJiYgdGhpcy5idXMuZW1pdCAmJiB0aGlzLmJ1cy5lbWl0KCBFVl9CRUZPUkUsIHtcclxuXHRcdFx0XHRcdFx0bW9kZSAgIDogaGFyZCA/ICdoYXJkJyA6ICdzb2Z0JyxcclxuXHRcdFx0XHRcdFx0c291cmNlIDogc291cmNlLFxyXG5cdFx0XHRcdFx0XHRwcmV2aWV3OiBpbl9wcmV2aWV3XHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7fVxyXG5cclxuXHRcdFx0XHQvLyBEbyB0aGUgd29yay5cclxuXHRcdFx0XHRpZiAoICFpbl9wcmV2aWV3ICkge1xyXG5cdFx0XHRcdFx0Ly8gTm90IGluIHByZXZpZXc6IG5vdGhpbmcgdG8gcmVuZGVyLCBidXQgc3RpbGwgZW1pdCBBRlRFUiBsYXRlci5cclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBoYXJkICkge1xyXG5cdFx0XHRcdFx0aWYgKCByZWJ1aWxkICkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmxvYWRfc2F2ZWRfc3RydWN0dXJlKCB0aGlzLmdldF9zdHJ1Y3R1cmUoKSwgeyBkZWZlcklmVHlwaW5nOiB0cnVlIH0gKTtcclxuXHRcdFx0XHRcdFx0aWYgKCByZWluaXQgKSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5fcmVpbml0X2FsbF9maWVsZHMoICdwcmV2aWV3JyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2YgdGhpcy5yZW5kZXJfcHJldmlld19hbGwgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVuZGVyX3ByZXZpZXdfYWxsKCk7XHJcblx0XHRcdFx0XHRcdC8vIFNvbWUgcGFja3MgaW5pdGlhbGl6ZSBpbiBvbl9maWVsZF9kcm9wKCk7IGh5ZHJhdGUgdGhlbSBmb3Igc29mdCBoYXJkLXJlZnJlc2guXHJcblx0XHRcdFx0XHRcdHRoaXMuX3JlaW5pdF9hbGxfZmllbGRzKCAncHJldmlldycgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IG5vZGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZmllbGQnICk7XHJcblx0XHRcdFx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMucmVuZGVyX3ByZXZpZXcoIG5vZGVzW2ldLCB7IGZvcmNlOiB0cnVlIH0gKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHQvLyBzb2Z0ID8/Pz9cclxuXHRcdFx0XHRcdGlmICggc2VsX2VsICkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnJlbmRlcl9wcmV2aWV3KCBzZWxfZWwsIHsgZm9yY2U6IHRydWUgfSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gUmVzdG9yZSBzZWxlY3Rpb24gKyBzY3JvbGwuXHJcblx0XHRcdFx0aWYgKCByZXN0b3JlX3NlbGVjdGlvbiAmJiBzZWxfaWQgJiYgdHlwZW9mIHRoaXMuc2VsZWN0X2J5X2RhdGFfaWQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR0aGlzLnNlbGVjdF9ieV9kYXRhX2lkKCBzZWxfaWQsIHsgc2lsZW50OiB0cnVlIH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCByZXN0b3JlX3Njcm9sbCAmJiBjYW52YXMgKSB7XHJcblx0XHRcdFx0XHRjYW52YXMuc2Nyb2xsVG9wID0gc2NfdG9wO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gT3B0aW9uYWwgYnJpZGdlOiBhc2sgSW5zcGVjdG9yIHRvIHN5bmMgdG8gdGhlIHNlbGVjdGVkIGVsZW1lbnQgKHVubGVzcyBzaWxlbmNlZCkuXHJcblx0XHRcdFx0aWYgKCAhc2lsZW50X2luc3BlY3RvciApIHtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdHRoaXMuX2luc3BlY3Rvcl9icmlkZ2UgJiYgdGhpcy5faW5zcGVjdG9yX2JyaWRnZS5zeW5jX2Zyb21fc2VsZWN0ZWQgJiYgdGhpcy5faW5zcGVjdG9yX2JyaWRnZS5zeW5jX2Zyb21fc2VsZWN0ZWQoKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfICkge31cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFNpZ25hbCBcImFmdGVyXCIgc28gcGFja3MgY2FuIHJlLWluaXQgd2lkZ2V0cyAodGltZSBzZWxlY3RvciwgbWFza3MsIGV0Yy4pLlxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHR0aGlzLmJ1cyAmJiB0aGlzLmJ1cy5lbWl0ICYmIHRoaXMuYnVzLmVtaXQoIEVWX0FGVEVSLCB7XHJcblx0XHRcdFx0XHRcdG1vZGUgICA6IGhhcmQgPyAnaGFyZCcgOiAnc29mdCcsXHJcblx0XHRcdFx0XHRcdHNvdXJjZSA6IHNvdXJjZSxcclxuXHRcdFx0XHRcdFx0cHJldmlldzogaW5fcHJldmlld1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZmluYWxseSB7XHJcblx0XHRcdFx0dGhpcy5fX3JlZnJlc2hpbmdfY2FudmFzID0gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wdGlvbmFsIGNvbnZlbmllbmNlOiByZW5kZXIgYWxsIHByZXZpZXdzIChubyByZWJ1aWxkKS5cclxuXHRcdCAqIFVzZWZ1bCBpZiB5b3Ugd2FudCBhIGZhc3QgXCJoYXJkXCIgcmVmcmVzaCB3aXRob3V0IHN0cnVjdHVyZSByZWxvYWQuXHJcblx0XHQgKi9cclxuXHRcdHJlbmRlcl9wcmV2aWV3X2FsbCgpIHtcclxuXHRcdFx0Y29uc3Qgcm9vdCAgPSB0aGlzLnBhZ2VzX2NvbnRhaW5lciB8fCBkb2N1bWVudDtcclxuXHRcdFx0Y29uc3Qgbm9kZXMgPSByb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGQnICk7XHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyX3ByZXZpZXcoIG5vZGVzW2ldLCB7IGZvcmNlOiB0cnVlIH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIER1cGxpY2F0ZSBhIGZpZWxkIG9yIHNlY3Rpb24gYW5kIGluc2VydCB0aGUgY29weSByaWdodCBhZnRlciB0aGUgb3JpZ2luYWwuXHJcblx0XHQgKiAtIEZpZWxkczogcmVzcGVjdHMgdXNhZ2UgbGltaXRzOyBnZW5lcmF0ZXMgbmV3IHVuaXF1ZSBpZC9uYW1lL2h0bWxfaWQgKyB1aWQ7IHJlLXJlbmRlcnMgcHJldmlldy9vdmVybGF5LlxyXG5cdFx0ICogLSBTZWN0aW9uczogZGVlcC1jbG9uZXM7IG1ha2VzIGFsbCBjb250YWluZWQgZmllbGRzIHVuaXF1ZTsgcmUtaW5pdHMgcmVzaXplcnMvc29ydGFibGVzOyByZS1yZW5kZXJzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIC0gVGhlIC53cGJjX2JmYl9fZmllbGQgb3IgLndwYmNfYmZiX19zZWN0aW9uIHRvIGR1cGxpY2F0ZS5cclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudHxudWxsfSBUaGUgbmV3bHkgaW5zZXJ0ZWQgY29weSwgb3IgbnVsbCBpZiBibG9ja2VkIChlLmcuLCB1c2FnZSBsaW1pdHMpLlxyXG5cdFx0ICovXHJcblx0XHRkdXBsaWNhdGVfaXRlbShlbCkge1xyXG5cdFx0XHRpZiAoICFlbCB8fCAhKGVsLmNsYXNzTGlzdD8uY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgfHwgZWwuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZHVwbGljYXRlX2ZpZWxkKCBlbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2R1cGxpY2F0ZV9zZWN0aW9uKCBlbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRHVwbGljYXRlIGEgc2luZ2xlIGZpZWxkIG5vZGUuXHJcblx0XHQgKiBHYXRlIGJ5IHVzYWdlIGxpbWl0LCByZWJ1aWxkIHZpYSBidWlsZF9maWVsZCgpIHNvIGFsbCBpbnZhcmlhbnRzIHN0YXkgY29uc2lzdGVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZmllbGRfZWxcclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudHxudWxsfVxyXG5cdFx0ICovXHJcblx0XHRfZHVwbGljYXRlX2ZpZWxkKGZpZWxkX2VsKSB7XHJcblx0XHRcdGNvbnN0IGRhdGEgICAgID0gV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBmaWVsZF9lbCApO1xyXG5cdFx0XHRjb25zdCB1c2FnZUtleSA9IGZpZWxkX2VsLmRhdGFzZXQudXNhZ2Vfa2V5IHx8IGRhdGEudXNhZ2Vfa2V5IHx8IGRhdGEudHlwZSB8fCAnZmllbGQnO1xyXG5cclxuXHRcdFx0Ly8gUmVzcGVjdCB1c2FnZSBsaW1pdHMuXHJcblx0XHRcdGlmICggIXRoaXMudXNhZ2UuZ2F0ZV9vcl9hbGVydCggdXNhZ2VLZXksIHsgbGFiZWw6IGRhdGEubGFiZWwgfHwgdXNhZ2VLZXkgfSApICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBCdWlsZCBhIGZyZXNoIGZpZWxkOyBsZXQgdGhlIGJ1aWxkZXIgYXNzaWduIHVuaXF1ZSBpZC9uYW1lL2h0bWxfaWQgYW5kIHVpZC5cclxuXHRcdFx0Y29uc3QgdG9CdWlsZCA9IHsgLi4uZGF0YSB9O1xyXG5cdFx0XHQvLyBDbGVhciBpZGVudGlmaWVycyB0byBmb3JjZSB1bmlxdWVuZXNzIG9uIHRoZSBkdXBsaWNhdGUuXHJcblx0XHRcdGRlbGV0ZSB0b0J1aWxkLmlkO1xyXG5cdFx0XHRkZWxldGUgdG9CdWlsZC5uYW1lO1xyXG5cdFx0XHRpZiAoICdodG1sX2lkJyBpbiB0b0J1aWxkICkgZGVsZXRlIHRvQnVpbGQuaHRtbF9pZDtcclxuXHRcdFx0Ly8gVkVSWSBJTVBPUlRBTlQhOiBkcm9wIHRoZSBvcmlnaW5hbCBVSUQgc28gYnVpbGRfZmllbGQgY3JlYXRlcyBhIG5ldyBvbmUuXHJcblx0XHRcdGlmICggJ3VpZCcgaW4gdG9CdWlsZCApIHtcclxuXHRcdFx0XHRkZWxldGUgdG9CdWlsZC51aWQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGNvcHkgPSB0aGlzLmJ1aWxkX2ZpZWxkKCB0b0J1aWxkICk7XHJcblx0XHRcdGlmICggIWNvcHkgKSByZXR1cm4gbnVsbDtcclxuXHJcblx0XHRcdGlmICggY29weS5oYXNBdHRyaWJ1dGUoICdkYXRhLWRyYWdnYWJsZScgKSApIHtcclxuXHRcdFx0XHRjb3B5LnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtZHJhZ2dhYmxlJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvcHkuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19kcmFnLWFueXdoZXJlJyApO1xyXG5cclxuXHRcdFx0Ly8gSW5zZXJ0IHJpZ2h0IGFmdGVyIG9yaWdpbmFsLlxyXG5cdFx0XHRmaWVsZF9lbC5wYXJlbnROb2RlLmluc2VydEJlZm9yZSggY29weSwgZmllbGRfZWwubmV4dFNpYmxpbmcgKTtcclxuXHJcblx0XHRcdC8vIEFubm91bmNlICYgaG9va3MuXHJcblx0XHRcdHRoaXMuX2VtaXRfY29uc3QoIFdQQkNfQkZCX0V2ZW50cy5GSUVMRF9BREQsIHtcclxuXHRcdFx0XHRlbCAgOiBjb3B5LFxyXG5cdFx0XHRcdGRhdGE6IFdQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggY29weSApXHJcblx0XHRcdH0gKTtcclxuXHRcdFx0dGhpcy51c2FnZS51cGRhdGVfcGFsZXR0ZV91aSgpO1xyXG5cdFx0XHR0aGlzLnRyaWdnZXJfZmllbGRfZHJvcF9jYWxsYmFjayggY29weSwgJ2Ryb3AnICk7XHJcblx0XHRcdHRoaXMuc2VsZWN0X2ZpZWxkKCBjb3B5LCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHJcblx0XHRcdHJldHVybiBjb3B5O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRHVwbGljYXRlIGEgc2VjdGlvbiAod2l0aCBhbGwgbmVzdGVkIGZpZWxkcy9zZWN0aW9ucykuXHJcblx0XHQgKiBFbnN1cmVzIGV2ZXJ5IGNvbnRhaW5lZCBmaWVsZCBoYXMgdW5pcXVlIGlkL25hbWUvaHRtbF9pZCBhbmQgYSBuZXcgdWlkOyByZS1pbml0cyByZXNpemVycyAmIHNvcnRhYmxlcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbCAtIC53cGJjX2JmYl9fc2VjdGlvblxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fG51bGx9XHJcblx0XHQgKi9cclxuXHRcdF9kdXBsaWNhdGVfc2VjdGlvbihzZWN0aW9uX2VsKSB7XHJcblx0XHRcdGlmICggIXNlY3Rpb25fZWwgfHwgIXNlY3Rpb25fZWwuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkgcmV0dXJuIG51bGw7XHJcblxyXG5cdFx0XHQvLyAxKSBEZWVwIGNsb25lICsgc2NydWIgVUkgYXJ0aWZhY3RzXHJcblx0XHRcdGNvbnN0IGNsb25lID0gc2VjdGlvbl9lbC5jbG9uZU5vZGUoIHRydWUgKTtcclxuXHRcdFx0Y2xvbmUucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fb3ZlcmxheS1jb250cm9scywuc29ydGFibGUtZ2hvc3QsLnNvcnRhYmxlLWNob3Nlbiwuc29ydGFibGUtZmFsbGJhY2snIClcclxuXHRcdFx0XHQuZm9yRWFjaCggbiA9PiBuLnJlbW92ZSgpICk7XHJcblxyXG5cdFx0XHQvLyBDbGVhciBmbGFncyBjb3BpZWQgd2hpbGUgdHlwaW5nL2RyYWdnaW5nIHRoYXQgY2FuIGRpc2FibGUgRG5ELlxyXG5cdFx0XHRjb25zdCBjbGVhckRyYWdGbGFncyA9IChuKSA9PiB7XHJcblx0XHRcdFx0bi5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLWRyYWdnYWJsZScgKTtcclxuXHRcdFx0XHRuLnJlbW92ZUF0dHJpYnV0ZSggJ2RyYWdnYWJsZScgKTtcclxuXHRcdFx0fTtcclxuXHRcdFx0Y2xlYXJEcmFnRmxhZ3MoIGNsb25lICk7XHJcblx0XHRcdGNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3NlY3Rpb24sIC53cGJjX2JmYl9fZmllbGQnICkuZm9yRWFjaCggbiA9PiB7XHJcblx0XHRcdFx0Y2xlYXJEcmFnRmxhZ3MoIG4gKTtcclxuXHRcdFx0XHRpZiAoIG4uY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkge1xyXG5cdFx0XHRcdFx0bi5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2RyYWctYW55d2hlcmUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyAxLjUpIFVTQUdFLUxJTUlUIFBSRUZMSUdIVCAoQkxPQ0sgaWYgbGltaXRzIHdvdWxkIGJlIGV4Y2VlZGVkKVxyXG5cdFx0XHRjb25zdCBwcmUgPSB0aGlzLl9wcmVmbGlnaHRfdXNhZ2VfZm9yX2Nsb25lKCBjbG9uZSwgLyogc3RyYXRlZ3kgKi8gJ2Jsb2NrJyApOyAvLyBTdHJhdGVnICdibG9jaycgLSBzaG93IHdhcm5pbmcgYW5kIGRvICBub3QgYWxsb3cgdG8gbWFrZSBkdXBsaWNhdGlvbiFcclxuXHRcdFx0Ly8gY29uc3QgcHJlID0gdGhpcy5fcHJlZmxpZ2h0X3VzYWdlX2Zvcl9jbG9uZSggY2xvbmUsIC8qIHN0cmF0ZWd5ICovICdzdHJpcCcgKTsgLy8gU3RyYXRlZyAnc3RyaXAnIC0gYXV0by10cmltIGVsZW1lbnRzLCBmcm9tIHNlY3Rpb24sICBpZnRoZXkgIG91dCBvZiBsaW1pdHMuXHJcblx0XHRcdGlmICggISBwcmUub2sgKSB7XHJcblx0XHRcdFx0Y29uc3QgbXNnID0gcHJlLm9mZmVuZGVycy5tYXAoIG8gPT4gYC0g4oCcJHtvLmtleX3igJ0g4oCUIGxpbWl0ICR7by5saW1pdH07IGhhdmUgJHtvLnVzZWR9LCB3b3VsZCBhZGQgJHtvLmFkZH1gICkuam9pbiggJ1xcbicgKTtcclxuXHRcdFx0XHRhbGVydCggYENhbm5vdCBkdXBsaWNhdGUgc2VjdGlvbjsgdXNhZ2UgbGltaXRzIHdvdWxkIGJlIGV4Y2VlZGVkOlxcbiR7bXNnfWAgKTtcclxuXHRcdFx0XHR0aGlzLl9hbm5vdW5jZT8uKCAnU2VjdGlvbiBkdXBsaWNhdGlvbiBibG9ja2VkIGJ5IGxpbWl0cy4nICk7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIDIpIEluc2VydCBhZnRlciBzb3VyY2VcclxuXHRcdFx0c2VjdGlvbl9lbC5pbnNlcnRBZGphY2VudEVsZW1lbnQoICdhZnRlcmVuZCcsIGNsb25lICk7XHJcblxyXG5cdFx0XHQvLyAzKSBNYWtlIGlkcy9uYW1lcy91aWRzIHVuaXF1ZSB2aWEgZXhpc3RpbmcgaGVscGVyc1xyXG5cdFx0XHR0aGlzLnBhZ2VzX3NlY3Rpb25zLl9yZXRhZ191aWRzX2luX3N1YnRyZWU/LiggY2xvbmUgKTtcclxuXHRcdFx0dGhpcy5wYWdlc19zZWN0aW9ucy5fZGVkdXBlX3N1YnRyZWVfc3RyaWN0Py4oIGNsb25lICk7XHJcblxyXG5cdFx0XHQvLyA0KSBPdmVybGF5cyAob3V0ZXIgKyBBTEwgbmVzdGVkIHNlY3Rpb25zL2ZpZWxkcylcclxuXHRcdFx0dGhpcy5hZGRfb3ZlcmxheV90b29sYmFyPy4oIGNsb25lICk7XHJcblx0XHRcdGNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3NlY3Rpb24sIC53cGJjX2JmYl9fZmllbGQnICkuZm9yRWFjaCggZWwgPT4gdGhpcy5hZGRfb3ZlcmxheV90b29sYmFyPy4oIGVsICkgKTtcclxuXHJcblx0XHRcdC8vIDUpIFNvcnRhYmxlIHdpcmluZyB1c2luZyBoZWxwZXJzXHJcblx0XHRcdC8vICAgIC0gU2VjdGlvbnMgc29ydGFibGUgYW1vbmcgc2libGluZ3MgKG91dGVyICsgbmVzdGVkKVxyXG5cdFx0XHR0aGlzLnBhZ2VzX3NlY3Rpb25zLmluaXRfc2VjdGlvbl9zb3J0YWJsZT8uKCBjbG9uZSApO1xyXG5cdFx0XHRjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19zZWN0aW9uJyApLmZvckVhY2goIHMgPT4gdGhpcy5wYWdlc19zZWN0aW9ucy5pbml0X3NlY3Rpb25fc29ydGFibGU/LiggcyApICk7XHJcblxyXG5cdFx0XHQvLyAgICAtIEZpZWxkIGRyb3Agem9uZXMgaW5zaWRlIGNvbHVtbnMvY29udGFpbmVycy5cclxuXHRcdFx0dGhpcy5wYWdlc19zZWN0aW9ucy5pbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzPy4oIGNsb25lICk7XHJcblxyXG5cdFx0XHQvLyAgICAtIERlZmVuc2l2ZSBwYXNzOiBlbnN1cmUgZXZlcnkgY29sdW1uIGFjdHVhbGx5IGhhcyBhIFNvcnRhYmxlIGluc3RhbmNlXHJcblx0XHRcdGNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2NvbHVtbicgKS5mb3JFYWNoKCBjb2wgPT4ge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIFNvcnRhYmxlICE9PSAndW5kZWZpbmVkJyAmJiAhU29ydGFibGUuZ2V0Py4oIGNvbCApICkge1xyXG5cdFx0XHRcdFx0dGhpcy5pbml0X3NvcnRhYmxlPy4oIGNvbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gNikgUmVzaXplcnMgKG91dGVyICsgbmVzdGVkKSBhbmQgbm9ybWFsaXplIGJhc2VzLlxyXG5cdFx0XHR0aGlzLl9pbml0X3Jlc2l6ZXJzX2Zvcl9zZWN0aW9uPy4oIGNsb25lICk7XHJcblx0XHRcdGNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3NlY3Rpb24nICkuZm9yRWFjaCggcyA9PiB0aGlzLl9pbml0X3Jlc2l6ZXJzX2Zvcl9zZWN0aW9uPy4oIHMgKSApO1xyXG5cdFx0XHRjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19yb3cnICkuZm9yRWFjaCggcm93ID0+IHtcclxuXHRcdFx0XHRjb25zdCBlZmYgPSB0aGlzLmxheW91dC5jb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3Jvdyggcm93LCB0aGlzLmNvbF9nYXBfcGVyY2VudCApO1xyXG5cdFx0XHRcdHRoaXMubGF5b3V0LmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93LCBlZmYuYmFzZXMgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gNykgUmVoeWRyYXRlIGZpZWxkIHJlbmRlcmVycyAoc28gd2lkZ2V0cyBiaW5kKS5cclxuXHRcdFx0Y2xvbmUucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZmllbGQnICkuZm9yRWFjaCggZiA9PiB0aGlzLnRyaWdnZXJfZmllbGRfZHJvcF9jYWxsYmFjaz8uKCBmLCAnbG9hZCcgKSApO1xyXG5cclxuXHRcdFx0Ly8gOCkgSG91c2VrZWVwaW5nL1VJLlxyXG5cdFx0XHR0aGlzLnVzYWdlPy51cGRhdGVfcGFsZXR0ZV91aT8uKCk7XHJcblx0XHRcdHRoaXMuc2VsZWN0X2ZpZWxkPy4oIGNsb25lLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHRcdFx0dGhpcy5idXM/LmVtaXQ/LiggV1BCQ19CRkJfRXZlbnRzLkZJRUxEX0FERCwge1xyXG5cdFx0XHRcdGVsIDogY2xvbmUsXHJcblx0XHRcdFx0aWQgOiBjbG9uZS5kYXRhc2V0LmlkLFxyXG5cdFx0XHRcdHVpZDogY2xvbmUuZGF0YXNldC51aWRcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0cmV0dXJuIGNsb25lO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3JlYXRlICYgcmV0dXJuIGEgdW5pcXVlLWlzaCB1aWQgc2ltaWxhciB0byBidWlsZF9maWVsZCgpIHNlbWFudGljcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHByZWZpeFxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0X2dlbmVyYXRlX3VpZChwcmVmaXggPSAnZicpIHtcclxuXHRcdFx0cmV0dXJuIGAke3ByZWZpeH0tJHsrK3RoaXMuX3VpZF9jb3VudGVyfS0ke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZyggMzYgKS5zbGljZSggMiwgNyApfWA7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgYWxsIHJlc2l6ZXJzIGluIGEgc2VjdGlvbiByb3cgYW5kIHJlY3JlYXRlIHRoZW0gd2l0aCB3b3JraW5nIGhhbmRsZXJzLlxyXG5cdFx0ICogKE5lZWRlZCBiZWNhdXNlIGV2ZW50IGxpc3RlbmVycyBkbyBub3QgY29weSBvbiBjbG9uZU5vZGUodHJ1ZSkuKVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsIC0gVGhlIGNsb25lZCAud3BiY19iZmJfX3NlY3Rpb25cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfaW5pdF9yZXNpemVyc19mb3Jfc2VjdGlvbihzZWN0aW9uX2VsKSB7XHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25fZWw/LnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAud3BiY19iZmJfX3JvdycgKTtcclxuXHRcdFx0aWYgKCAhcm93ICkgcmV0dXJuO1xyXG5cdFx0XHR0aGlzLl9yZWJ1aWxkX3Jlc2l6ZXJzX2Zvcl9yb3coIHJvdyApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cclxuXHQvLyBCb290c3RyYXAgZmFjaWxpdHkgKyBhdXRvLWluaXQgb24gRE9NIHJlYWR5LlxyXG5cdHcuV1BCQ19CRkIgPSB3LldQQkNfQkZCIHx8IHt9O1xyXG5cclxuXHR3LldQQkNfQkZCLmJvb3RzdHJhcCA9IGZ1bmN0aW9uIGJvb3RzdHJhcChvcHRpb25zID0ge30pIHtcclxuXHRcdGxldCBiID0gbnVsbDtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGIgPSBuZXcgV1BCQ19Gb3JtX0J1aWxkZXIoIG9wdGlvbnMgKTtcclxuXHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQ19CRkIgYm9vdHN0cmFwIGZhaWxlZDonLCBlICk7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cdFx0d2luZG93LndwYmNfYmZiID0gYjtcclxuXHRcdC8vIFJlc29sdmUgQVBJICdyZWFkeScgaWYgaXQgZXhpc3RzIGFscmVhZHk7IG90aGVyd2lzZSB0aGUgQVBJIHdpbGwgcmVzb2x2ZSBpdHNlbGYgd2hlbiBjcmVhdGVkLlxyXG5cdFx0aWYgKCB3aW5kb3cud3BiY19iZmJfYXBpICYmIHR5cGVvZiB3aW5kb3cud3BiY19iZmJfYXBpLl9yZXNvbHZlUmVhZHkgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHdpbmRvdy53cGJjX2JmYl9hcGkuX3Jlc29sdmVSZWFkeSggYiApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGI7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogPT0gUHVibGljLCBzdGFibGUgQVBJIG9mIEJvb2tpbmcgRm9ybSBCdWlsZGVyIChCRkIpLlxyXG5cdCAqXHJcblx0ICogQ29uc3VtZXJzIHNob3VsZCBwcmVmZXI6IHdwYmNfYmZiX2FwaS5vbihXUEJDX0JGQl9FdmVudHMuRklFTERfQURELCBoYW5kbGVyKVxyXG5cdCAqL1xyXG5cdHcud3BiY19iZmJfYXBpID0gKGZ1bmN0aW9uICgpIHtcclxuXHRcdC8vICdyZWFkeScgcHJvbWlzZS4gUmVzb2x2ZXMgb25jZSB0aGUgYnVpbGRlciBpbnN0YW5jZSBleGlzdHMuXHJcblx0XHRsZXQgX3Jlc29sdmVSZWFkeTtcclxuXHRcdGNvbnN0IHJlYWR5ID0gbmV3IFByb21pc2UoIHIgPT4ge1xyXG5cdFx0XHRfcmVzb2x2ZVJlYWR5ID0gcjtcclxuXHRcdH0gKTtcclxuXHRcdC8vIEVqZWN0L3Jlc29sdmUgYWZ0ZXIgYSB0aW1lb3V0IHNvIGNhbGxlcnMgYXJlbuKAmXQgc3R1Y2sgZm9yZXZlcjouXHJcblx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdF9yZXNvbHZlUmVhZHkoIHdpbmRvdy53cGJjX2JmYiB8fCBudWxsICk7XHJcblx0XHR9LCAzMDAwICk7XHJcblxyXG5cdFx0Ly8gSWYgYnVpbGRlciBhbHJlYWR5IGV4aXN0cyAoZS5nLiwgYm9vdHN0cmFwIHJhbiBlYXJsaWVyKSwgcmVzb2x2ZSBpbW1lZGlhdGVseS5cclxuXHRcdGlmICggd2luZG93LndwYmNfYmZiICkge1xyXG5cdFx0XHRfcmVzb2x2ZVJlYWR5KCB3aW5kb3cud3BiY19iZmIgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRyZWFkeSxcclxuXHRcdFx0Ly8gaW50ZXJuYWwgaG9vayB1c2VkIGJ5IGJvb3RzdHJhcCB0byByZXNvbHZlIGlmIEFQSSB3YXMgY3JlYXRlZCBmaXJzdC5cclxuXHRcdFx0X3Jlc29sdmVSZWFkeSxcclxuXHJcblx0XHRcdC8qKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR8bnVsbH0gKi9cclxuXHRcdFx0Z2V0X3NlbGVjdGlvbl9lbCgpIHtcclxuXHRcdFx0XHRjb25zdCBiID0gd2luZG93LndwYmNfYmZiO1xyXG5cdFx0XHRcdHJldHVybiBiPy5nZXRfc2VsZWN0ZWRfZmllbGQ/LigpID8/IG51bGw7XHJcblx0XHRcdH0sXHJcblx0XHRcdC8qKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9ICovXHJcblx0XHRcdGdldF9zZWxlY3Rpb25fdWlkKCkge1xyXG5cdFx0XHRcdGNvbnN0IGIgID0gd2luZG93LndwYmNfYmZiO1xyXG5cdFx0XHRcdGNvbnN0IGVsID0gYj8uZ2V0X3NlbGVjdGVkX2ZpZWxkPy4oKTtcclxuXHRcdFx0XHRyZXR1cm4gZWw/LmRhdGFzZXQ/LnVpZCA/PyBudWxsO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRjbGVhcigpIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19iZmI/LnNlbGVjdF9maWVsZD8uKCBudWxsICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdWlkXHJcblx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0cz17fV1cclxuXHRcdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHRcdCAqL1xyXG5cdFx0XHRzZWxlY3RfYnlfdWlkKHVpZCwgb3B0cyA9IHt9KSB7XHJcblx0XHRcdFx0Y29uc3QgYiAgPSB3aW5kb3cud3BiY19iZmI7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGVzYyA9IFdQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdWlkICk7XHJcblx0XHRcdFx0Y29uc3QgZWwgID0gYj8ucGFnZXNfY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yPy4oXHJcblx0XHRcdFx0XHRgLndwYmNfYmZiX19maWVsZFtkYXRhLXVpZD1cIiR7ZXNjfVwiXSwgLndwYmNfYmZiX19zZWN0aW9uW2RhdGEtdWlkPVwiJHtlc2N9XCJdYFxyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0XHRiLnNlbGVjdF9maWVsZCggZWwsIG9wdHMgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuICEhZWw7XHJcblx0XHRcdH0sXHJcblx0XHRcdC8qKiBAcmV0dXJucyB7QXJyYXl9ICovXHJcblx0XHRcdGdldF9zdHJ1Y3R1cmUoKSB7XHJcblx0XHRcdFx0cmV0dXJuIHdpbmRvdy53cGJjX2JmYj8uZ2V0X3N0cnVjdHVyZT8uKCkgPz8gW107XHJcblx0XHRcdH0sXHJcblx0XHRcdC8qKiBAcGFyYW0ge0FycmF5fSBzICovXHJcblx0XHRcdGxvYWRfc3RydWN0dXJlKHMpIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19iZmI/LmxvYWRfc2F2ZWRfc3RydWN0dXJlPy4oIHMgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0LyoqIEByZXR1cm5zIHtIVE1MRWxlbWVudHx1bmRlZmluZWR9ICovXHJcblx0XHRcdGFkZF9wYWdlKCkge1xyXG5cdFx0XHRcdHJldHVybiB3aW5kb3cud3BiY19iZmI/LmFkZF9wYWdlPy4oKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0b24oZXZlbnRfbmFtZSwgaGFuZGxlcikge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2JmYj8uYnVzPy5vbj8uKCBldmVudF9uYW1lLCBoYW5kbGVyICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdG9mZihldmVudF9uYW1lLCBoYW5kbGVyKSB7XHJcblx0XHRcdFx0d2luZG93LndwYmNfYmZiPy5idXM/Lm9mZj8uKCBldmVudF9uYW1lLCBoYW5kbGVyICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBEaXNwb3NlIHRoZSBhY3RpdmUgYnVpbGRlciBpbnN0YW5jZS5cclxuXHRcdFx0ICpcclxuXHRcdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHRcdCAqL1xyXG5cdFx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2JmYj8uZGVzdHJveT8uKCk7XHJcblx0XHRcdH0sXHJcblxyXG5cdFx0fTtcclxuXHR9KSgpO1xyXG5cclxuXHQvLyBDb252ZW5pZW5jZSBoZWxwZXJzIChpZGVtcG90ZW50KVxyXG5cdGlmICggd2luZG93LndwYmNfYmZiX2FwaSApIHtcclxuXHJcblx0XHQvLyBTeW5jOiByZXR1cm5zIGluc3RhbmNlIGltbWVkaWF0ZWx5IG9yIG51bGxcclxuXHRcdHdpbmRvdy53cGJjX2JmYl9hcGkuZ2V0X2J1aWxkZXIgPSB3aW5kb3cud3BiY19iZmJfYXBpLmdldF9idWlsZGVyIHx8IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0cmV0dXJuIHdpbmRvdy53cGJjX2JmYiB8fCBudWxsO1xyXG5cdFx0fTtcclxuXHJcblx0XHQvLyBBc3luYzogYWx3YXlzIHdhaXRzIGZvciByZWFkaW5lc3NcclxuXHRcdHdpbmRvdy53cGJjX2JmYl9hcGkuZ2V0X2J1aWxkZXJfYXN5bmMgPSB3aW5kb3cud3BiY19iZmJfYXBpLmdldF9idWlsZGVyX2FzeW5jIHx8IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0cmV0dXJuIHdpbmRvdy53cGJjX2JmYl9hcGkucmVhZHkudGhlbiggZnVuY3Rpb24gKGIpIHsgcmV0dXJuIGIgfHwgbnVsbDsgfSApO1xyXG5cdFx0fTtcclxuXHJcblx0XHQvLyBPcHRpb25hbDogcnVuIGNhbGxiYWNrIHdoZW4gcmVhZHkgKG5vIHJlcGVhdGVkIC50aGVuIGV2ZXJ5d2hlcmUpXHJcblx0XHR3aW5kb3cud3BiY19iZmJfYXBpLndpdGhfYnVpbGRlciA9IHdpbmRvdy53cGJjX2JmYl9hcGkud2l0aF9idWlsZGVyIHx8IGZ1bmN0aW9uIChmbikge1xyXG5cdFx0XHRyZXR1cm4gd2luZG93LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKCBmdW5jdGlvbiAoYikge1xyXG5cdFx0XHRcdGlmICggYiAmJiB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgKSB7IGZuKCBiICk7IH1cclxuXHRcdFx0XHRyZXR1cm4gYiB8fCBudWxsO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIEF1dG/igJFib290c3RyYXAgb24gRE9NIHJlYWR5LlxyXG5cdChmdW5jdGlvbiBpbml0QnVpbGRlcldoZW5SZWFkeSgpIHtcclxuXHRcdGNvbnN0IHN0YXJ0ID0gKCkgPT4ge1xyXG5cdFx0XHQvLyBBbGxvdyBQSFAgdG8gcGFzcyBpbml0aWFsIG9wdGlvbnMgdG8gYXZvaWQgc2V0dGluZ3MgZmxpY2tlci5cclxuXHRcdFx0Ly8gRXhhbXBsZTogd2luZG93LndwYmNfYmZiX2Jvb3RzdHJhcF9vcHRzID0geyBwcmV2aWV3X21vZGU6IHRydWUsIGNvbF9nYXBfcGVyY2VudDogMyB9Oy5cclxuXHRcdFx0Y29uc3QgYm9vdF9vcHRzID0gKHdpbmRvdy53cGJjX2JmYl9ib290c3RyYXBfb3B0cyAmJiB0eXBlb2Ygd2luZG93LndwYmNfYmZiX2Jvb3RzdHJhcF9vcHRzID09PSAnb2JqZWN0JykgPyB3aW5kb3cud3BiY19iZmJfYm9vdHN0cmFwX29wdHMgOiB7fTtcclxuXHRcdFx0d2luZG93LldQQkNfQkZCLmJvb3RzdHJhcCggYm9vdF9vcHRzICk7XHJcblx0XHR9O1xyXG5cdFx0aWYgKCBkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycgKSB7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgc3RhcnQsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRzdGFydCgpO1xyXG5cdFx0fVxyXG5cdH0pKCk7XHJcblxyXG5cdC8vIE9uZS10aW1lIGNsZWFudXA6IGVuc3VyZSBzZWN0aW9ucyBkb27igJl0IGhhdmUgdGhlIGZpZWxkIGNsYXNzLiAob2xkIG1hcmt1cCBoeWdpZW5lKS5cclxuXHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19zZWN0aW9uLndwYmNfYmZiX19maWVsZCcgKS5mb3JFYWNoKCAoZWwpID0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fZmllbGQnICkgKTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEVtcHR5LXNwYWNlIGNsaWNrcyAtPiBkaXNwYXRjaCBhIHNpbmdsZSBldmVudDsgY2VudHJhbCBsaXN0ZW5lciBkb2VzIHRoZSBjbGVhcmluZy5cclxuXHQgKiBPbmUgY2VudHJhbCBsaXN0ZW5lciByZWFjdHMgdG8gdGhhdCBldmVudCBhbmQgZG9lcyB0aGUgY2xlYXJpbmcgKyBpbnNwZWN0b3IgcmVzZXQuXHJcblx0ICovXHJcblx0aWYgKCB3aW5kb3cualF1ZXJ5ICkgeyBqUXVlcnkoIGZ1bmN0aW9uICggJCApIHtcclxuXHRcdC8vIEVsZW1lbnRzIHdoZXJlIGNsaWNrcyBzaG91bGQgTk9UIGNsZWFyIHNlbGVjdGlvbi5cclxuXHRcdGNvbnN0IEtFRVBfQ0xJQ0tfU0VMID0gW1xyXG5cdFx0XHQnLndwYmNfYmZiX19maWVsZCcsXHJcblx0XHRcdCcud3BiY19iZmJfX3NlY3Rpb24nLFxyXG5cdFx0XHQnLndwYmNfYmZiX19vdmVybGF5LWNvbnRyb2xzJyxcclxuXHRcdFx0Jy53cGJjX2JmYl9fbGF5b3V0X3BpY2tlcicsXHJcblx0XHRcdCcud3BiY19iZmJfX2RyYWctaGFuZGxlJyxcclxuXHRcdFx0Ly8gSW5zcGVjdG9yIC8gcGFsZXR0ZSBzdXJmYWNlcy5cclxuXHRcdFx0JyN3cGJjX2JmYl9faW5zcGVjdG9yJywgJy53cGJjX2JmYl9faW5zcGVjdG9yJyxcclxuXHRcdFx0Jy53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsJywgJy53cGJjX2JmYl9fcGFsZXR0ZScsXHJcblx0XHRcdC8vIEdlbmVyaWMgaW50ZXJhY3RpdmUuXHJcblx0XHRcdCdpbnB1dCcsICd0ZXh0YXJlYScsICdzZWxlY3QnLCAnYnV0dG9uJywgJ2xhYmVsJywgJ2EsW3JvbGU9YnV0dG9uXSxbY29udGVudGVkaXRhYmxlXScsXHJcblx0XHRcdC8vIENvbW1vbiBwb3B1cHMvd2lkZ2V0cy5cclxuXHRcdFx0Jy50aXBweS1ib3gnLCAnLmRhdGVwaWNrJywgJy5zaW1wbGViYXItc2Nyb2xsYmFyJ1xyXG5cdFx0XS5qb2luKCAnLCcgKTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlc2V0IHRoZSBpbnNwZWN0b3IvcGFsZXR0ZSBlbXB0eSBzdGF0ZSBVSS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gcmVzZXRJbnNwZWN0b3JVSSgpIHtcclxuXHRcdFx0Y29uc3QgJGFsbCA9ICQoICcjd3BiY19iZmJfX2luc3BlY3RvciwgLndwYmNfYmZiX19pbnNwZWN0b3IsIC53cGJjX2JmYl9fcGFsZXR0ZSwgLndwYmNfYmZiX19vcHRpb25zX3BhbmVsJyApO1xyXG5cdFx0XHRpZiAoICEgJGFsbC5sZW5ndGggKSByZXR1cm47XHJcblx0XHRcdCRhbGwucmVtb3ZlQ2xhc3MoICdoYXMtc2VsZWN0aW9uIGlzLWFjdGl2ZScgKTtcclxuXHRcdFx0JGFsbC5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0Y29uc3QgJHBhbCA9IGpRdWVyeSggdGhpcyApO1xyXG5cdFx0XHRcdCRwYWwuZmluZCggJ1tkYXRhLWZvci11aWRdLFtkYXRhLWZvci1maWVsZF0sW2RhdGEtcGFuZWw9XCJmaWVsZFwiXSxbcm9sZT1cInRhYnBhbmVsXCJdJyApLmF0dHIoICdoaWRkZW4nLCB0cnVlICkuYWRkQ2xhc3MoICdpcy1oaWRkZW4nICk7XHJcblx0XHRcdFx0JHBhbC5maW5kKCAnW3JvbGU9XCJ0YWJcIl0nICkuYXR0ciggeyAnYXJpYS1zZWxlY3RlZCc6ICdmYWxzZScsICd0YWJpbmRleCc6ICctMScgfSApLnJlbW92ZUNsYXNzKCAnaXMtYWN0aXZlJyApO1xyXG5cdFx0XHRcdCRwYWwuZmluZCggJy53cGJjX2JmYl9faW5zcGVjdG9yLWVtcHR5LCAud3BiY19iZmJfX2VtcHR5X3N0YXRlLCBbZGF0YS1lbXB0eS1zdGF0ZT1cInRydWVcIl0nICkucmVtb3ZlQXR0ciggJ2hpZGRlbicgKS5yZW1vdmVDbGFzcyggJ2lzLWhpZGRlbicgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfc2V0dGluZ3NfcGFnZV9jb250ZW50JyApO1xyXG5cdFx0aWYgKCAhIHJvb3QgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhhbmRsZSBjbGVhci1zZWxlY3Rpb24gcmVxdWVzdHMgZnJvbSBFU0MvZW1wdHktc3BhY2UgYW5kIHN5bmMgd2l0aCBidWlsZGVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2dCAtIFRoZSBldmVudCBjYXJyeWluZyBvcHRpb25hbCBgZGV0YWlsLnNvdXJjZWAuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gaGFuZGxlQ2xlYXJTZWxlY3Rpb24oIGV2dCApIHtcclxuXHRcdFx0Y29uc3Qgc3JjID0gZXZ0Py5kZXRhaWw/LnNvdXJjZTtcclxuXHJcblx0XHRcdC8vIElmIHRoaXMgaXMgdGhlIGJ1aWxkZXIgdGVsbGluZyB1cyBpdCBhbHJlYWR5IGNsZWFyZWQgc2VsZWN0aW9uLFxyXG5cdFx0XHQvLyBqdXN0IHN5bmMgdGhlIHN1cnJvdW5kaW5nIFVJIGFuZCBleGl0LlxyXG5cdFx0XHRpZiAoIHNyYyA9PT0gJ2J1aWxkZXInICkge1xyXG5cdFx0XHRcdHJlc2V0SW5zcGVjdG9yVUkoKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE90aGVyd2lzZSBpdCdzIGEgcmVxdWVzdCB0byBjbGVhciAoRVNDLCBlbXB0eSBzcGFjZSwgZXRjLikuXHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYmZiX2FwaSAmJiB0eXBlb2Ygd2luZG93LndwYmNfYmZiX2FwaS5jbGVhciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19iZmJfYXBpLmNsZWFyKCk7IC8vIFRoaXMgd2lsbCBlbWl0IHRoZSAnYnVpbGRlcicgbm90aWZpY2F0aW9uIG5leHQuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Ly8gRmFsbGJhY2sgaWYgdGhlIEFQSSBpc24ndCBhdmFpbGFibGUuXHJcblx0XHRcdFx0alF1ZXJ5KCAnLmlzLXNlbGVjdGVkLCAud3BiY19iZmJfX2ZpZWxkLS1hY3RpdmUsIC53cGJjX2JmYl9fc2VjdGlvbi0tYWN0aXZlJyApXHJcblx0XHRcdFx0XHQucmVtb3ZlQ2xhc3MoICdpcy1zZWxlY3RlZCB3cGJjX2JmYl9fZmllbGQtLWFjdGl2ZSB3cGJjX2JmYl9fc2VjdGlvbi0tYWN0aXZlJyApO1xyXG5cdFx0XHRcdHJlc2V0SW5zcGVjdG9yVUkoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIExpc3RlbiBnbG9iYWxseSBmb3IgY2xlYXItc2VsZWN0aW9uIG5vdGlmaWNhdGlvbnMuXHJcblx0XHRjb25zdCBFViA9IFdQQkNfQkZCX0V2ZW50cyB8fCB7fTtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIEVWLkNMRUFSX1NFTEVDVElPTiB8fCAnd3BiYzpiZmI6Y2xlYXItc2VsZWN0aW9uJywgaGFuZGxlQ2xlYXJTZWxlY3Rpb24gKTtcclxuXHJcblx0XHQvLyBDYXB0dXJlIGNsaWNrczsgb25seSBkaXNwYXRjaCB0aGUgZXZlbnQgKG5vIGRpcmVjdCBjbGVhcmluZyBoZXJlKS5cclxuXHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBlICkge1xyXG5cdFx0XHRjb25zdCAkdCA9ICQoIGUudGFyZ2V0ICk7XHJcblxyXG5cdFx0XHQvLyBJZ25vcmUgY2xpY2tzIGluc2lkZSBpbnRlcmFjdGl2ZSAvIGJ1aWxkZXIgY29udHJvbHMuXHJcblx0XHRcdGlmICggJHQuY2xvc2VzdCggS0VFUF9DTElDS19TRUwgKS5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJZ25vcmUgbW91c2V1cCBhZnRlciBzZWxlY3RpbmcgdGV4dC5cclxuXHRcdFx0aWYgKCB3aW5kb3cuZ2V0U2VsZWN0aW9uICYmIFN0cmluZyggd2luZG93LmdldFNlbGVjdGlvbigpICkudHJpbSgpICE9PSAnJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIERpc3BhdGNoIHRoZSBzaW5nbGUgZXZlbnQ7IGxldCB0aGUgbGlzdGVuZXIgZG8gdGhlIHdvcmsuXHJcblx0XHRcdGNvbnN0IGV2dCA9IG5ldyBDdXN0b21FdmVudCggJ3dwYmM6YmZiOmNsZWFyLXNlbGVjdGlvbicsIHtcclxuXHRcdFx0XHRkZXRhaWw6IHsgc291cmNlOiAnZW1wdHktc3BhY2UtY2xpY2snLCBvcmlnaW5hbEV2ZW50OiBlIH1cclxuXHRcdFx0fSApO1xyXG5cdFx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KCBldnQgKTtcclxuXHRcdH0sIHRydWUgKTtcclxuXHR9ICk7IH0gLy8gZW5kIGpRdWVyeSBndWFyZFxyXG5cclxufSkoIHdpbmRvdyApO1xyXG5cclxuLyoqXHJcbiAqIFVzYWdlIGV4YW1wbGVzOlxyXG4gKlxyXG53aW5kb3cud3BiY19iZmJfYXBpLndpdGhfYnVpbGRlcihmdW5jdGlvbiAoQikge1xyXG5cdEIuc2V0X3ByZXZpZXdfbW9kZShlbmFibGVkLCB7IHJlYnVpbGQ6IHRydWUsIHJlaW5pdDogdHJ1ZSwgc291cmNlOiAnc2V0dGluZ3MtZWZmZWN0cycgfSk7XHJcbn0pO1xyXG5cclxuICovIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSw2QkFBNkJBLENBQUNDLElBQUksRUFBRUMsTUFBTSxFQUFFO0VBQ3BELElBQUk7SUFDSCxJQUFLLE9BQU9DLE1BQU0sQ0FBQ0MsV0FBVyxLQUFLLFVBQVUsRUFBRztNQUMvQ0MsUUFBUSxDQUFDQyxhQUFhLENBQUUsSUFBSUYsV0FBVyxDQUFFSCxJQUFJLEVBQUU7UUFBRUMsTUFBTSxFQUFFQSxNQUFNLElBQUksQ0FBQztNQUFFLENBQUUsQ0FBRSxDQUFDO01BQzNFO0lBQ0Q7RUFDRCxDQUFDLENBQUMsT0FBUUssRUFBRSxFQUFHLENBQUM7RUFFaEIsSUFBSTtJQUNILE1BQU1DLEVBQUUsR0FBR0gsUUFBUSxDQUFDSSxXQUFXLENBQUUsYUFBYyxDQUFDO0lBQ2hERCxFQUFFLENBQUNFLGVBQWUsQ0FBRVQsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUVDLE1BQU0sSUFBSSxDQUFDLENBQUUsQ0FBQztJQUNwREcsUUFBUSxDQUFDQyxhQUFhLENBQUVFLEVBQUcsQ0FBQztFQUM3QixDQUFDLENBQUMsT0FBUUcsR0FBRyxFQUFHLENBQUM7QUFDbEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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
