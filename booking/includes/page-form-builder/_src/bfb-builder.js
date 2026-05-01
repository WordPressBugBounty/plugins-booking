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
		if ( typeof window.CustomEvent === 'function' ) {
			document.dispatchEvent( new CustomEvent( name, { detail: detail || {} } ) );
			return;
		}
	} catch ( _e ) {}

	try {
		const ev = document.createEvent( 'CustomEvent' );
		ev.initCustomEvent( name, true, true, detail || {} );
		document.dispatchEvent( ev );
	} catch ( _e2 ) {}
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
		return new Promise( function (resolve) {
			const xhr = new XMLHttpRequest();
			xhr.open( 'POST', url, true );
			xhr.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8' );

			xhr.onreadystatechange = function () {
				if ( xhr.readyState !== 4 ) {
					return;
				}
				resolve( {
							 status: xhr.status,
							 text  : xhr.responseText
						 } );
			};

			const pairs = [];
			for ( const k in data ) {
				if ( ! Object.prototype.hasOwnProperty.call( data, k ) ) {
					continue;
				}
				pairs.push( encodeURIComponent( k ) + '=' + encodeURIComponent( data[k] ) );
			}
			xhr.send( pairs.join( '&' ) );
		} );
	}

 	class WPBC_Form_Builder {

		/**
		 * Constructor for Booking Form Builder class.
		 * Initializes UI elements, SortableJS, and event listeners.
		 */
		constructor( opts = {} ) {
			// Allow DI/overrides via opts while keeping defaults.
			// Back-compat: accept either a single UL via opts.palette_ul or an array via opts.palette_uls.
			const providedPalettes = Array.isArray( opts.palette_uls ) ? opts.palette_uls : (opts.palette_ul ? [ opts.palette_ul ] : []);
			this.palette_uls = providedPalettes.length ? providedPalettes : Array.from( document.querySelectorAll( '.wpbc_bfb__panel_field_types__ul' ) );

			this.pages_container     = opts.pages_container || document.getElementById( 'wpbc_bfb__pages_container' );
			if ( ! this.pages_container ) {
				throw new Error( 'WPBC: pages container not found.' );
			}
			this.page_counter     = 0;
			this.section_counter  = 0;
			this.max_nested_value = Number.isFinite( +opts.max_nested_value ) ? +opts.max_nested_value : 5;
			this.preview_mode     = ( opts.preview_mode !== undefined ) ? !!opts.preview_mode : true;
			this.col_gap_percent  = Number.isFinite( +opts.col_gap_percent ) ? +opts.col_gap_percent : 3; // % gap between columns for layout math.
			this._uid_counter     = 0;

			// Service instances.
			this.id        = new WPBC_BFB_IdService( this.pages_container );
			this.layout    = new WPBC_BFB_LayoutService( { col_gap_percent: this.col_gap_percent } );
			this.usage     = new WPBC_BFB_UsageLimitService( this.pages_container, this.palette_uls );
			this.bus       = new WPBC_BFB_EventBus( this.pages_container );
			this._handlers = [];
			this.sortable  = new WPBC_BFB_SortableManager( this );

			this._modules = [];   /** @type {Array<WPBC_BFB_Module>} */

			// Register modules.
			this.use_module( WPBC_BFB_Selection_Controller );
			this.use_module( WPBC_BFB_Inspector_Bridge );
			this.use_module( WPBC_BFB_Resize_Controller );
			this.use_module( WPBC_BFB_Pages_Sections );
			this.use_module( WPBC_BFB_Structure_IO );
			this.use_module( WPBC_BFB_Keyboard_Controller );
			this.use_module( WPBC_BFB_Min_Width_Guard );

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
			this.bus.emit( type, detail );
		}

		/**
		 * Find a neighbor element that can be selected after removing a node.
		 *
		 * @param {HTMLElement} el - The element that is being removed.
		 * @returns {HTMLElement|null} Neighbor or null.
		 */
		_find_neighbor_selectable(el) {

			if ( ! el || ! el.parentElement ) {
				return null;
			}

			const all = Array.from( el.parentElement.children ).filter( n => (n.classList?.contains( 'wpbc_bfb__field' ) || n.classList?.contains( 'wpbc_bfb__section' )) );

			const i = all.indexOf( el );
			if ( i > 0 ) {
				return all[i - 1];
			}
			if ( i >= 0 && i + 1 < all.length ) {
				return all[i + 1];
			}

			// Fallback: any other selectable on the current page, but NEVER inside `el` itself.
			const page = el.closest( '.wpbc_bfb__panel--preview' );
			if ( page ) {
				// Prefer sections/fields that are siblings elsewhere on the page.
				const candidate = page.querySelector( '.wpbc_bfb__section, .wpbc_bfb__field' );
				if ( candidate && ! el.contains( candidate ) ) {
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

			if ( typeof Sortable === 'undefined' ) {
				console.error( 'SortableJS is not loaded (drag & drop disabled).' );
			}

			// === Init Sortable on the Field Palette. ===
			if ( ! this.palette_uls.length ) {
				console.warn( 'WPBC: No field palettes found (.wpbc_bfb__panel_field_types__ul).' );
			} else if ( typeof Sortable === 'undefined' ) {
				console.warn( 'WPBC: SortableJS not loaded (palette drag disabled).' );
			} else {
				this.palette_uls.forEach( (ul) => this.sortable.ensure( ul, 'palette' ) );
			}

			const waitForRenderers = () => new Promise( (resolve) => {
				const hasRegistry = !!(w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Field_Renderer_Registry && typeof w.WPBC_BFB_Core.WPBC_BFB_Field_Renderer_Registry.get === 'function');

				if ( hasRegistry ) {
					return resolve();
				}
				const started = Date.now();
				const i       = setInterval( () => {
					const ok       = !!(w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Field_Renderer_Registry && typeof w.WPBC_BFB_Core.WPBC_BFB_Field_Renderer_Registry.get === 'function');
					const timedOut = (Date.now() - started) > 3000;
					if ( ok || timedOut ) {
						clearInterval( i );
						if ( ! ok ) {
							console.warn( 'WPBC: Field renderers not found, using fallback preview.' );
						}
						resolve();
					}
				}, 50 );
			} );

			// 1. Auto  Load form  defined in wpbc_bfb_output_ajax_boot_config() -> 2. Load example  wpbc_bfb__form_structure__get_example() -> 3. Blank  page.
			const startLoad = async () => {
				await waitForRenderers();
				await new Promise( (r) => setTimeout( r, 0 ) ); // next macrotask.

				// 1) Try to auto-load "standard" from DB (published) via AJAX.
				const loaded = await this._auto_load_initial_form_from_ajax();

				// Auto-open Apply Template modal from URL (if requested).
				await this._auto_open_apply_template_modal_from_url();

				if ( loaded ) {
					return;
				}

				// 2) Fallback behavior if AJAX did not load anything.
				const cfg           = window.WPBC_BFB_Ajax || {};
				const fallback_mode = String( cfg.initial_load_fallback || 'example' ).toLowerCase();

				if ( fallback_mode === 'blank' ) {
					this.add_page();

					// Auto-open Apply Template modal from URL (if requested).
					await this._auto_open_apply_template_modal_from_url();

					return;
				}

				// default fallback: example structure.
				const example_structure = (typeof window.wpbc_bfb__form_structure__get_example === 'function')
					? window.wpbc_bfb__form_structure__get_example()
					: null;

				if ( Array.isArray( example_structure ) ) {
					this.load_saved_structure( example_structure );
				} else {
					this.add_page();
				}

				// Auto-open Apply Template modal from URL (if requested).
				await this._auto_open_apply_template_modal_from_url();
			};



			if ( document.readyState === 'loading' ) {
				document.addEventListener( 'DOMContentLoaded', startLoad );
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
			if ( this._usage_observer ) {
				return;
			}

			const refresh = WPBC_Form_Builder_Helper.debounce( () => {
				try {
					this.usage.update_palette_ui();
					document.querySelectorAll( '.wpbc_bfb__panel_field_types__ul' ).forEach( (ul) => {
						try {
							this._usage_observer.observe( ul, { childList: true, subtree: true } );
						} catch( e ){ _wpbc?.dev?.error( '_start_usage_observer', e ); }
					} );
				} catch (e) {
					console.warn( 'Usage UI update failed.', e );
				}
			}, 100 );

			const config = { childList: true, subtree: true, attributes: true, attributeFilter: [ 'class', 'data-usage_key' ] };

			this._usage_observer = new MutationObserver( refresh );
			this._usage_observer.observe( this.pages_container, config );

			// Observe all known palettes; also do a broad query on each refresh so late-added palettes are handled.
			(this.palette_uls || []).forEach( (ul) => {
				try {
					this._usage_observer.observe( ul, { childList: true, subtree: true } );
				} catch( e ){ _wpbc?.dev?.error( '_start_usage_observer', e ); }
			} );


			// Initial sync.
			refresh();
		}

		/**
		 * Add dragging visual feedback on all columns.
		 *
		 * @returns {void}
		 */
		_add_dragging_class() {
			this.pages_container.querySelectorAll( '.wpbc_bfb__column' ).forEach( ( col ) => col.classList.add( 'wpbc_bfb__dragging' ) );
		}

		/**
		 * Remove dragging visual feedback on all columns.
		 *
		 * @returns {void}
		 */
		_remove_dragging_class() {
			this.pages_container.querySelectorAll( '.wpbc_bfb__column' ).forEach( ( col ) => col.classList.remove( 'wpbc_bfb__dragging' ) );
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
			const add_page_btn = document.getElementById( 'wpbc_bfb__add_page_btn' );
			if ( add_page_btn ) {
				this._on( add_page_btn, 'click', ( e ) => {
					e.preventDefault();
					this.add_page();
					this._announce?.( 'Page added.' );
				} );
			}

			// Prevent accidental drag while editing inputs.
			this._on( this.pages_container, 'focusin', (e) => {
				const f = e.target.closest( '.wpbc_bfb__field' );
				if ( f ) {
					f.setAttribute( 'data-draggable', 'false' );
				}
			} );
			this._on( this.pages_container, 'focusout', (e) => {
				const f = e.target.closest( '.wpbc_bfb__field' );
				if ( f ) {
					f.removeAttribute( 'data-draggable' );
				}
			} );

		}

		/**
		 * Re-run field initializers for every field in the canvas.
		 * Many renderers (e.g., Calendar) wire themselves inside on_field_drop().
		 *
		 * @param {"drop"|"load"|"preview"|"save"} context
		 */
		_reinit_all_fields(context = 'preview') {
			this.pages_container
				.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field' )
				.forEach( (field_el) => this.trigger_field_drop_callback( field_el, context ) );
		}

		/**
		 * Return only the column elements (skip resizers).
		 *
		 * @param {HTMLElement} row_el - Row element.
		 * @returns {HTMLElement[]} Column elements.
		 */
		_get_row_cols( row_el ) {
			return Array.from( row_el.querySelectorAll( ':scope > .wpbc_bfb__column' ) );
		}

		// -- Page Numbers Care --

		/**
		 * Get page panels in DOM order (direct children of pages_container).
		 *
		 * @returns {HTMLElement[]}
		 */
		_get_pages_in_dom_order() {
			if ( ! this.pages_container ) {
				return [];
			}
			return Array.from(
				this.pages_container.querySelectorAll( ':scope > .wpbc_bfb__panel--preview' )
			);
		}

		/**
		 * Get the page number heading element inside a page panel.
		 *
		 * @param {HTMLElement} page_el
		 * @returns {HTMLElement|null}
		 */
		_get_page_number_heading_el(page_el) {
			if ( ! page_el || ! page_el.querySelector ) {
				return null;
			}
			// In markup this is: <h3 class="wpbc_bfb__page_number">Page 1 <button>...</button></h3>
			return page_el.querySelector( '.wpbc_bfb__page_number' );
		}

		/**
		 * Update only TEXT inside <h3 class="wpbc_bfb__page_number">, preserving the delete button.
		 *
		 * @param {HTMLElement} heading_el
		 * @param {number} page_number
		 * @returns {void}
		 */
		_set_page_number_heading_text(heading_el, page_number) {

			if ( ! heading_el ) {
				return;
			}

			// Collect current visible text from TEXT nodes only (ignore button text).
			const text_nodes = Array.from( heading_el.childNodes || [] ).filter( (n) => n && n.nodeType === 3 );

			let raw = '';
			for ( let i = 0; i < text_nodes.length; i++ ) {
				raw += String( text_nodes[i].nodeValue || '' );
			}
			raw = raw.replace( /\s+/g, ' ' ).trim(); // "Page 1"

			const n = String( page_number );

			// Preserve prefix/translation, just replace the last number group.
			let next = '';
			if ( raw && /\d+/.test( raw ) ) {
				next = raw.replace( /(\d+)(?!.*\d)/, n );
			} else if ( raw ) {
				next = raw + ' ' + n;
			} else {
				next = 'Page ' + n;
			}

			// Apply into the first text node; clear any extra text nodes.
			if ( text_nodes.length > 0 ) {
				text_nodes[0].nodeValue = next + ' ';
				for ( let k = 1; k < text_nodes.length; k++ ) {
					text_nodes[k].nodeValue = '';
				}
			} else {
				// No text node exists (rare) -> insert before first child (keeps button).
				heading_el.insertBefore( document.createTextNode( next + ' ' ), heading_el.firstChild );
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

			const source = String( opts.source || 'system' );
			const pages  = this._get_pages_in_dom_order();

			for ( let i = 0; i < pages.length; i++ ) {

				const page_el     = pages[i];
				const page_number = i + 1;

				// Keep BOTH attributes consistent (some code may still read data-page).
				page_el.setAttribute( 'data-page_number', String( page_number ) );
				page_el.setAttribute( 'data-page', String( page_number ) );

				const heading_el = this._get_page_number_heading_el( page_el );
				if ( heading_el ) {
					this._set_page_number_heading_text( heading_el, page_number );
				}
			}

			// IMPORTANT:
			// Keep the counter aligned with the current amount of pages,
			// so add_page() creates the next correct number.
			this.page_counter = pages.length;

			// Optional: notify other UI (tabs, etc.).
			try {
				const ev = (window.WPBC_BFB_Core?.WPBC_BFB_Events?.PAGES_RENUMBERED) || 'wpbc:bfb:pages-renumbered';
				this.bus?.emit?.( ev, { source: source, pages: pages.length } );
			} catch ( _e ) {}
		}

		/**
		 * Start observer that renumbers pages after add/delete/reorder/load.
		 * Observes only direct children changes to avoid firing on every field change.
		 *
		 * @returns {void}
		 */
		_start_pages_numbering_observer() {

			if ( this._pages_numbering_observer || ! this.pages_container ) {
				return;
			}

			const do_renumber = WPBC_Form_Builder_Helper.debounce( () => {
				this.renumber_pages_in_canvas( { source: 'observer' } );
			}, 50 );

			this._pages_numbering_observer = new MutationObserver( (mutations) => {

				let touched_pages = false;

				for ( let i = 0; i < mutations.length; i++ ) {
					const m = mutations[i];
					if ( ! m || m.type !== 'childList' ) {
						continue;
					}

					const nodes = []
						.concat( Array.from( m.addedNodes || [] ) )
						.concat( Array.from( m.removedNodes || [] ) );

					for ( let k = 0; k < nodes.length; k++ ) {
						const n = nodes[k];
						if ( n && n.nodeType === 1 && n.classList && n.classList.contains( 'wpbc_bfb__panel--preview' ) ) {
							touched_pages = true;
							break;
						}
					}

					if ( touched_pages ) {
						break;
					}
				}

				if ( touched_pages ) {
					do_renumber();
				}
			} );

			// IMPORTANT: childList only (no subtree), so fields dragging won’t trigger this.
			this._pages_numbering_observer.observe( this.pages_container, { childList: true } );

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
			if ( typeof handler === 'function' ) {
				resizer.addEventListener( 'mousedown', handler );
				return true;
			}

			const msg = 'WPBC: init_resize_handler missing. Check that WPBC_BFB_Resize_Controller is loaded/initialized before the builder.';

			// Loud but non-fatal by default.
			console.error( msg );

			// Optional strict dev mode: throw to surface load-order problems early
			if ( window.WPBC_DEV_STRICT === true ) {
				setTimeout( () => {
					throw new Error( msg );
				}, 0 );
			}

			// One deferred retry in case the resize controller attaches slightly later
			setTimeout( () => {
				const late = this.init_resize_handler;
				if ( typeof late === 'function' && resizer.isConnected ) {
					resizer.addEventListener( 'mousedown', late );
				}
			}, 0 );

			return false;
		}

		/**
		 * Factory for a column resizer element with binding handled.
		 *
		 * @private
		 * @returns {HTMLDivElement}
		 */
		_create_resizer() {
			const resizer = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column-resizer' );
			this._bind_resizer( resizer );
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
			if ( !row_el ) return;

			// Remove all existing resizers
			row_el.querySelectorAll( ':scope > .wpbc_bfb__column-resizer' ).forEach( r => r.remove() );

			// Reinsert resizers between current columns
			const cols = this._get_row_cols( row_el );
			for ( let i = 0; i < cols.length - 1; i++ ) {
				const resizer = this._create_resizer();
				cols[i].insertAdjacentElement( 'afterend', resizer );
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
		_set_field_id( field_el, newIdRaw ) {
			const unique = this.id.set_field_id( field_el, newIdRaw, /*renderPreview*/ false );
			if ( this.preview_mode ) {
				this.render_preview( field_el );
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
		_set_field_name( field_el, newNameRaw ) {
			const unique = this.id.set_field_name( field_el, newNameRaw, /*renderPreview*/ false );
			if ( this.preview_mode ) {
				this.render_preview( field_el );
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
		_set_field_html_id( field_el, newHtmlIdRaw ) {
			const applied = this.id.set_field_html_id( field_el, newHtmlIdRaw, /*renderPreview*/ false );
			if ( this.preview_mode ) {
				this.render_preview( field_el );
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
				let live = document.getElementById( 'wpbc_bfb__aria_live' );
				if ( !live ) {
					live    = document.createElement( 'div' );
					live.id = 'wpbc_bfb__aria_live';
					live.setAttribute( 'aria-live', 'polite' );
					live.setAttribute( 'aria-atomic', 'true' );
					live.style.position = 'absolute';
					live.style.left     = '-9999px';
					live.style.top      = 'auto';
					document.body.appendChild( live );
				}
				live.textContent = '';
				setTimeout( () => {
					live.textContent = String( msg || '' );
				}, 10 );
			} catch ( e ) {
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
		_on( target, type, handler, opts = false ) {
			if ( ! this._handlers ) {
				this._handlers = [];
			}
			target.addEventListener( type, handler, opts );
			this._handlers.push( { target, type, handler, opts } );
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
			if ( ! this.pages_container ) {
				return 0;
			}
			const esc = window.WPBC_BFB_Core?.WPBC_BFB_Sanitize?.esc_attr_value_for_selector?.( key ) || key.replace( /"/g, '\\"' );
			// match by usage_key first, then by type as a fallback (older fields).
			return this.pages_container.querySelectorAll( `.wpbc_bfb__field[data-usage_key="${esc}"], .wpbc_bfb__field[data-type="${esc}"]` ).length;
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
			const candidates = (this.palette_uls || [])
				.map( ul => ul.querySelector( `[data-id="${key}"], [data-usage_key="${key}"]` ) )
				.filter( Boolean );

			const pel = candidates[0] || document.querySelector( `.wpbc_bfb__panel_field_types__ul [data-id="${key}"], .wpbc_bfb__panel_field_types__ul [data-usage_key="${key}"]` );

			const n = Number( pel?.dataset?.usagenumber );
			return Number.isFinite( n ) ? n : Infinity;
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
			if ( ! root_el ) {
				return tally;
			}
			root_el.querySelectorAll( '.wpbc_bfb__field' ).forEach( f => {
				const k  = this._get_usage_key( f );
				tally[k] = (tally[k] || 0) + 1;
			} );
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
			const tally     = this._tally_usage_in_subtree( clone );

			Object.entries( tally ).forEach( ([ key, addCount ]) => {
				const limit = this._get_palette_limit_for_key( key );
				if ( !Number.isFinite( limit ) ) return;  // no limit declared -> ignore

				const used      = this._count_used_in_canvas( key );
				const remaining = limit - used;

				if ( remaining >= addCount ) return;    // safe

				if ( strategy === 'strip' ) {
					// Keep only the remaining capacity; remove extras from the clone
					const nodes    = Array.from( clone.querySelectorAll(
						`.wpbc_bfb__field[data-usage_key="${key}"], .wpbc_bfb__field[data-type="${key}"]`
					) );
					const toRemove = nodes.slice( Math.max( 0, remaining ) );
					toRemove.forEach( n => n.remove() );
				} else {
					offenders.push( { key, limit, used, add: addCount } );
				}
			} );

			if ( strategy === 'strip' ) {
				// After stripping, re-check; if still over (e.g. remaining < 0 for multiple keys), treat as offenders.
				const re       = this._tally_usage_in_subtree( clone );
				const stillBad = Object.entries( re ).some( ([ key, add ]) => {
					const limit = this._get_palette_limit_for_key( key );
					return Number.isFinite( limit ) && (this._count_used_in_canvas( key ) + add) > limit;
				} );
				return stillBad ? { ok: false, offenders } : { ok: true };
			}

			return offenders.length ? { ok: false, offenders } : { ok: true };
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

			if ( ! cfg.url || ! cfg.nonce_load ) {
				return false;
			}

			const payload = {
				action   : cfg.load_action || 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
				nonce    : cfg.nonce_load || '',
				form_name: cfg.form_name || 'standard'
			};

			const r = await wpbc_bfb__post_ajax_promise( cfg.url, payload );

			if ( r.status !== 200 ) {
				return false;
			}

			let resp = null;
			try {
				resp = JSON.parse( r.text );
			} catch ( _e ) {
				return false;
			}

			if ( ! resp || ! resp.success || ! resp.data ) {
				return false;
			}

			const data   = resp.data || {};
			const engine = String( data.engine || '' ).toLowerCase();

			// Apply Advanced Mode texts (always useful for legacy).
			if ( typeof data.advanced_form !== 'undefined' || typeof data.content_form !== 'undefined' ) {

				const af = String( data.advanced_form || '' );
				const cf = String( data.content_form || '' );

				const ta_form    = document.getElementById( 'wpbc_bfb__advanced_form_editor' );
				const ta_content = document.getElementById( 'wpbc_bfb__content_form_editor' );

				if ( ta_form ) {
					ta_form.value = af;
				}
				if ( ta_content ) {
					ta_content.value = cf;
				}

				// ONLY supported: settings.bfb_options.advanced_mode_source (fallback to cfg.save_source or 'builder').
				let adv_mode_src = '';
				if ( typeof data.settings !== 'undefined' ) {
					try {
						const s = (typeof data.settings === 'string') ? JSON.parse( data.settings ) : data.settings;
						adv_mode_src = (s && s.bfb_options && s.bfb_options.advanced_mode_source) ? String( s.bfb_options.advanced_mode_source ) : '';
					} catch ( _e ) {}
				}
				if ( ! adv_mode_src ) {
					adv_mode_src = (window.WPBC_BFB_Ajax && window.WPBC_BFB_Ajax.save_source) ? String( window.WPBC_BFB_Ajax.save_source ) : 'builder';
				}

				wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:advanced_text:apply', {
					advanced_form       : af,
					content_form        : cf,
					advanced_mode_source: adv_mode_src
				} );
			}

			// Apply local form settings to UI (if provided).
			if ( data.settings ) {
				wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form_settings:apply', {
					settings : data.settings,
					form_name: cfg.form_name || 'standard'
				} );
			}

			wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form:ajax_loaded', {
				loaded_data: data,
				form_name  : cfg.form_name || 'standard'
			} );

			// Structure may be [] for legacy engines.
			const structure = Array.isArray( data.structure ) ? data.structure : [];

			if ( structure.length > 0 ) {
				this.load_saved_structure( structure );

				// Re-apply effects AFTER structure rebuild created the final DOM.
				try {
					if ( w.WPBC_BFB_Settings_Effects && typeof w.WPBC_BFB_Settings_Effects.reapply_after_canvas === 'function' ) {
						w.WPBC_BFB_Settings_Effects.reapply_after_canvas( data.settings, {
							source   : 'ajax_load',
							form_name: cfg.form_name || 'standard'
						} );
					}
				} catch ( _e_fx ) {}

				return true;
			}

			// IMPORTANT: Legacy load is still a valid "loaded" state.
			// Create a blank page (so the canvas isn't empty), and DO NOT fallback to example.
			this.add_page();

			try {
				if ( w.WPBC_BFB_Settings_Effects && typeof w.WPBC_BFB_Settings_Effects.reapply_after_canvas === 'function' ) {
					w.WPBC_BFB_Settings_Effects.reapply_after_canvas( data.settings, {
						source   : 'ajax_load_legacy',
						form_name: cfg.form_name || 'standard'
					} );
				}
			} catch ( _e_fx2 ) {}

			jQuery( '.wpbc_bfb__top_tab_section__builder_tab .wpbc_spins_loading_container' ).parents( '.wpbc_bfb__panel--preview' ).remove();
			// Optional: one-time notice for legacy.
			try {
				if ( engine && engine.indexOf( 'legacy_' ) === 0 && typeof window.wpbc_admin_show_message === 'function' ) {
					window.wpbc_admin_show_message( 'Loaded legacy form. Use “Import from Simple Form” to convert to Builder.', 'warning', 6000 );
				}
			} catch ( _e2 ) {}

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
				if ( window.__wpbc_bfb_auto_open_template_done ) {
					return false;
				}

				// Read raw query param.
				const href = String( window.location && window.location.href ? window.location.href : '' );
				if ( ! href ) {
					return false;
				}

				let raw_value = '';

				try {
					const u   = new URL( href );
					raw_value = u.searchParams.get( 'auto_open_template' ) || '';
				} catch ( _e0 ) {
					// Fallback minimal parser (should rarely happen).
					const m   = href.match( /[?&]auto_open_template=([^&#]*)/i );
					raw_value = m && m[1] ? m[1] : '';
				}

				raw_value = String( raw_value || '' );

				// URLSearchParams usually decodes, but we also normalize "+" -> " " for safety.
				// If already decoded, this is harmless.
				raw_value = raw_value.replace( /\+/g, ' ' );

				// Try decodeURIComponent (in case fallback parser captured encoded string).
				try {
					raw_value = decodeURIComponent( raw_value );
				} catch ( _e1 ) {}

				// Sanitize: remove control chars, trim, collapse spaces.
				let search_key = raw_value
					.replace( /[\u0000-\u001F\u007F]/g, ' ' )
					.replace( /\s+/g, ' ' )
					.trim();

				// Normalize OR separator so URL separator "^" becomes UI separator "|".
				try {
					const sep    = (cfg && cfg.template_search_or_sep) ? String( cfg.template_search_or_sep ) : '|';
					const urlSep = (cfg && cfg.template_search_or_sep_url) ? String( cfg.template_search_or_sep_url ) : '^';

					const escSep    = String( sep ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
					const escUrlSep = String( urlSep ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );

					// Convert URL separator into UI separator.
					if ( urlSep && urlSep !== sep ) {
						search_key = search_key.replace( new RegExp( '\\s*' + escUrlSep + '\\s*', 'g' ), sep );
					}

					// Normalize UI separator.
					search_key = search_key.replace( new RegExp( '\\s*' + escSep + '\\s*', 'g' ), sep );
					search_key = search_key.replace( new RegExp( escSep + '{2,}', 'g' ), sep );
					search_key = search_key.replace( new RegExp( '^' + escSep + '+|' + escSep + '+$', 'g' ), '' ).trim();
				} catch ( _e_sep ) {}

				// Clamp length (avoid silly URLs).
				if ( search_key.length > 80 ) {
					search_key = search_key.slice( 0, 80 ).trim();
				}

				if ( ! search_key ) {
					return false;
				}

				// Mark as handled (we have a real value).
				window.__wpbc_bfb_auto_open_template_done = true;

				// Wait for the modal helper to exist (script load-order safe).
				const ready = await this._wait_for_apply_template_search_fn( 3500 );
				if ( ! ready ) {
					// Silent fail (or log in dev).
					try {
						console.warn( 'WPBC BFB: apply template modal helper not ready (auto_open_template skipped).' );
					} catch ( _e2 ) {}
					return false;
				}

				// Open modal with prefilled search.
				window.wpbc_bfb__menu_forms__apply_template_search( search_key, null );

				return true;

			} catch ( _e3 ) {
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

			timeout_ms = parseInt( timeout_ms || 0, 10 );
			if ( ! timeout_ms || timeout_ms < 200 ) {
				timeout_ms = 200;
			}

			return new Promise( (resolve) => {

				const started = Date.now();

				const is_ready = () => {
					return (typeof window.wpbc_bfb__menu_forms__apply_template_search === 'function');
				};

				if ( is_ready() ) {
					return resolve( true );
				}

				const t = setInterval( () => {

					if ( is_ready() ) {
						clearInterval( t );
						return resolve( true );
					}

					if ( (Date.now() - started) > timeout_ms ) {
						clearInterval( t );
						return resolve( false );
					}

				}, 50 );
			} );
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
			const mod = new Module_Class( this, options );
			if ( typeof mod.init === 'function' ) {
				mod.init();
			}
			this._modules.push( mod );
			return mod;
		}

		/**
		 * Dispose all listeners, observers, and Sortable instances created by the builder.
		 *
		 * @returns {void}
		 */
		destroy() {
			// Mutation observer.
			if ( this._usage_observer ) {
				try {
					this._usage_observer.disconnect();
				} catch (e) {}
				this._usage_observer = null;
			}

			// Pages numbering observer.
			if ( this._pages_numbering_observer ) {
				try {
					this._pages_numbering_observer.disconnect();
				} catch ( e ) {}
				this._pages_numbering_observer = null;
			}

			// Registered DOM listeners.
			if ( Array.isArray( this._handlers ) ) {
				this._handlers.forEach( ({ target, type, handler, opts }) => {
					try {
						target.removeEventListener( type, handler, opts );
					} catch (e) {
						// No-op.
					}
				} );
				this._handlers = [];
			}

			// Sortable instances.
			if ( this.sortable && typeof this.sortable.destroyAll === 'function' ) {
				this.sortable.destroyAll();
			}

			// Destroy registered modules.
			if ( Array.isArray( this._modules ) ) {
				for ( const mod of this._modules ) {
					try {
						if ( typeof mod.destroy === 'function' ) {
							mod.destroy();
						}
					} catch( e ){ _wpbc?.dev?.error( 'WPBC_Form_Builder - Destroy registered modules', e ); }
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
		init_sortable( container, on_add_callback = this.handle_on_add.bind( this ) ) {
			if ( ! container ) return;
			if ( typeof Sortable === 'undefined' ) return;
			// If container is not attached yet (e.g., freshly cloned), defer to next tick.
			if ( ! container.isConnected ) {
				setTimeout( () => {
					if ( container.isConnected ) {
						this.sortable.ensure( container, 'canvas', { onAdd: on_add_callback } );
					}
				}, 0 );
				return;
			}
			this.sortable.ensure( container, 'canvas', { onAdd: on_add_callback } );
		}

		/**
		 * Handler when an item is added via drag-and-drop.
		 * Applies usage limits, nesting checks, and builds new field if needed.
		 *
		 * @param {Object} evt - SortableJS event object.
		 * @returns {void}
		 */
		handle_on_add( evt ) {
			if ( ! evt || ! evt.item || ! evt.to ) {
				return;
			}

			let el = evt.item;

			// --- Section path. ------------------------------------------------------
			if ( el.classList.contains( 'wpbc_bfb__section' ) ) {
				const nesting_level = this.get_nesting_level( el );
				if ( nesting_level >= this.max_nested_value ) {
					alert( 'Too many nested sections.' );
					el.remove();
					return;
				}
				this.init_all_nested_sortables( el );

				// Ensure UI is fully initialized for newly placed/moved sections.
				this.add_overlay_toolbar( el );
				const row = el.querySelector( ':scope > .wpbc_bfb__row' );
				if ( row ) {
					this._rebuild_resizers_for_row( row );
					this.layout.set_equal_bases( row, this.col_gap_percent );
				}

				this.usage.update_palette_ui();

				this.select_field( el, { scrollIntoView: true } );

				return;
			}

			// --- Field path. --------------------------------------------------------
			const is_from_palette = this.palette_uls?.includes?.(evt.from);
			const paletteId       = el?.dataset?.id;

			if ( ! paletteId ) {
				console.warn( 'Dropped element missing data-id.', el );
				return;
			}

			if ( is_from_palette ) {
				// Read data before removing the temporary clone.
				const field_data = WPBC_Form_Builder_Helper.get_all_data_attributes( el );
				const usage_key  = field_data.usage_key || paletteId;
				field_data.usage_key = usage_key;
				if ( 'uid' in field_data ) {
					delete field_data.uid;  // Guard: never carry a UID from palette/DOM clones.
				}

				// Remove Sortable's temporary clone so counts are accurate.
				el.remove();

				// Centralized usage gate.
				if ( ! this.usage.gate_or_alert( usage_key, { label: field_data.label || usage_key } ) ) {
					return;
				}

				// Build and insert the real field node at the intended index.
				const rebuilt = this.build_field( field_data );
				if ( ! rebuilt ) {
					return;
				}

				const selector       = Sortable.get( evt.to )?.options?.draggable || '.wpbc_bfb__field, .wpbc_bfb__section';
				const scopedSelector = selector.split( ',' ).map( s => `:scope > ${s.trim()}` ).join( ', ' );
				const draggables     = Array.from( evt.to.querySelectorAll( scopedSelector ) );
				const before         = Number.isInteger( evt.newIndex ) ? (draggables[evt.newIndex] ?? null) : null;

				evt.to.insertBefore( rebuilt, before );
				el = rebuilt; // Continue with the unified path below.
			} else {
				// Moving an existing field within the canvas. No usage delta here.
			}

			// Finalize: decorate, emit, hook, and select.
			this.decorate_field( el );
			this._emit_const( WPBC_BFB_Events.FIELD_ADD, { el, data: WPBC_Form_Builder_Helper.get_all_data_attributes( el ) } );
			this.usage.update_palette_ui();
			this.trigger_field_drop_callback( el, 'drop' );
			this.select_field( el, { scrollIntoView: true } );
		}

		/**
		 * Call static on_field_drop method for supported field types.
		 *
		 * @param {HTMLElement} field_el - Field element to handle.
		 * @param {string} context - Context of the event: 'drop' | 'load' | 'preview'.
		 * @returns {void}
		 */
		trigger_field_drop_callback( field_el, context = 'drop' ) {
			if ( ! field_el || ! field_el.classList.contains( 'wpbc_bfb__field' ) ) {
				return;
			}

			const field_data = WPBC_Form_Builder_Helper.get_all_data_attributes( field_el );

			const type = field_data.type;

			try {
				const FieldClass = this._getRenderer(type);
				if ( FieldClass && typeof FieldClass.on_field_drop === 'function' ) {
					FieldClass.on_field_drop( field_data, field_el, { context } );
				}
			} catch ( err ) {
				console.warn( `on_field_drop failed for type "${type}".`, err );
			}
		}

		/**
		 * Calculate nesting depth of a section based on parent hierarchy.
		 *
		 * @param {HTMLElement} section_el - Target section element.
		 * @returns {number} Nesting depth (0 = top-level).
		 */
		get_nesting_level( section_el ) {
			let level  = 0;
			let parent = section_el.closest( '.wpbc_bfb__column' );

			while ( parent ) {
				const outer = parent.closest( '.wpbc_bfb__section' );
				if ( ! outer ) {
					break;
				}
				level++;
				parent = outer.closest( '.wpbc_bfb__column' );
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
		build_field( field_data ) {
			if ( ! field_data || typeof field_data !== 'object' ) {
				console.warn( 'Invalid field data:', field_data );
				return WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__field is-invalid', 'Invalid field' );
			}

			// Decide a desired id first (may come from user/palette).
			let desiredIdRaw;
			if ( ! field_data.id || '' === String( field_data.id ).trim() ) {
				const base   = (field_data.label ? String( field_data.label ) : (field_data.type || 'field'))
					.toLowerCase()
					.replace( /[^a-z0-9]+/g, '-' )
					.replace( /^-+|-+$/g, '' );
				desiredIdRaw = `${base || 'field'}-${Math.random().toString( 36 ).slice( 2, 7 )}`;
			} else {
				desiredIdRaw = String( field_data.id );
			}

			// Sanitize the id the user provided.
			const desiredId = WPBC_BFB_Sanitize.sanitize_html_id( desiredIdRaw );

			// Usage key remains stable (palette sets usage_key; otherwise use *raw* user intent).
			let usageKey = field_data.usage_key || field_data.type || desiredIdRaw;
			// Normalize common aliases to palette ids (extend as needed).
			if ( usageKey === 'input-text' ) {
				usageKey = 'text';
			}

			// Ensure the DOM/data-id we actually use is unique (post-sanitization).
			field_data.id = this.id.ensure_unique_field_id( desiredId );

			// Ensure name exists, sanitized, and unique.
			let desiredName = (field_data.name != null) ? field_data.name : field_data.id;
			desiredName     = WPBC_BFB_Sanitize.sanitize_html_name( desiredName );
			field_data.name = this.id.ensure_unique_field_name( desiredName );

			// Check usage count.
			if ( ! this.usage.is_usage_ok( usageKey ) ) {
				console.warn( `Field "${usageKey}" skipped – exceeds usage limit.` );
				return null;
			}

			const el  = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__field' );
			// Only this builder UID (do NOT allow overrides from incoming data).
			const uid = this._generate_uid( 'f' );
			el.setAttribute( 'data-uid', uid );
			// Drop any upstream uid so set_data_attributes can’t clobber ours.
			const { uid: _discardUid, ...safeData } = (field_data || {});
			WPBC_Form_Builder_Helper.set_data_attributes( el, { ...safeData, usage_key: usageKey } );

			// reflect min width (purely visual; resizing enforcement happens in the resizer).
			const min_raw = String( field_data.min_width || '' ).trim();
			if ( min_raw ) {
				// let CSS do the parsing: supports px, %, rem, etc.
				el.style.minWidth = min_raw;
			}

			el.innerHTML = WPBC_Form_Builder_Helper.render_field_inner_html( field_data );
			this.decorate_field( el );

			return el;
		}

		/**
		 * Enhance a field element with drag handle, delete, move buttons, or preview.
		 *
		 * @param {HTMLElement} field_el - Target field element.
		 * @returns {void}
		 */
		decorate_field( field_el ) {
			if ( ! field_el || field_el.classList.contains( 'wpbc_bfb__section' ) ) {
				return;
			}

			field_el.classList.add( 'wpbc_bfb__field' );
			field_el.classList.add( 'wpbc_bfb__drag-anywhere' ); // Lets grab the field card itself to drag (outside of overlay / inputs).

			// Render.
			if ( this.preview_mode ) {
				this.render_preview( field_el );
			} else {
				this.add_overlay_toolbar( field_el );
			}
		}

		/**
		 * Add overlay toolbar to a field/section.
		 *
		 * @param {HTMLElement} field_el - Field or section element.
		 * @returns {void}
		 */
		add_overlay_toolbar(field_el) {
			WPBC_BFB_Overlay.ensure( this, field_el );

		}

		/**
		 * Render a simplified visual representation of a field (Preview Mode).
		 *
		 * @param {HTMLElement} field_el - Target field element.
		 * @returns {void}
		 */
		render_preview( field_el ) {
			if ( ! field_el || ! this.preview_mode ) {
				return;
			}

			const data             = WPBC_Form_Builder_Helper.get_all_data_attributes( field_el );
			const type             = data.type;
			const id               = data.id || '';
			const hasExplicitLabel = Object.prototype.hasOwnProperty.call( data, 'label' );
			// const label            = hasExplicitLabel ? data.label : id; //.

			try {
				const R = this._getRenderer( type );
				if ( R && typeof R.render === 'function' ) {
					const ctx = {
						mode   : 'preview',
						builder: this,
						tpl    : (id) => (window.wp && wp.template ? wp.template( id ) : null),
						sanit  : WPBC_BFB_Sanitize
					};
					// Renderer is responsible for writing to field_el.innerHTML.
					R.render( field_el, data, ctx );

					field_el.classList.add( 'wpbc_bfb__preview-rendered' );
				} else {
					if ( type ) {
						// console.warn( `No renderer found for field type: ${type}.` );
						w._wpbc?.dev?.once( 'render_preview', `No renderer found for field type: ${type}.`, R );
					}
					field_el.innerHTML = WPBC_Form_Builder_Helper.render_field_inner_html( data );
				}
			} catch ( err ) {
				console.error( 'Renderer error.', err );

				field_el.innerHTML = WPBC_Form_Builder_Helper.render_field_inner_html( data );
			}

			this.add_overlay_toolbar( field_el );


			// Optional hook after DOM is in place.
			try {
				const R = this._getRenderer( type );
				// New contract: prefer hydrate(); fall back to legacy after_render if present.
				if ( R && typeof R.hydrate === 'function' ) {
					R.hydrate( field_el, data, {
						mode   : 'preview',
						builder: this,
						tpl    : (id) => (window.wp && wp.template ? wp.template( id ) : null),
						sanit  : WPBC_BFB_Sanitize
					} );
				} else if ( R && typeof R.after_render === 'function' ) {
					R.after_render( data, field_el ); // legacy compatibility.
				}
			} catch ( err2 ) {
				console.warn( 'after_render hook failed.', err2 );
			}
		}

		/**
		 * Move an element (field/section) up or down in its parent container.
		 *
		 * @param {HTMLElement} el - Target element to move.
		 * @param {string} direction - 'up' or 'down'.
		 * @returns {void}
		 */
		move_item( el, direction ) {
			const container = el?.parentElement;
			if ( ! container ) {
				return;
			}

			const siblings = Array.from( container.children ).filter( ( child ) =>
				child.classList.contains( 'wpbc_bfb__field' ) || child.classList.contains( 'wpbc_bfb__section' )
			);

			const current_index = siblings.indexOf( el );
			if ( current_index === -1 ) {
			 return;
			}

			const new_index = direction === 'up' ? current_index - 1 : current_index + 1;
			if ( new_index < 0 || new_index >= siblings.length ) {
				return;
			}

			const reference_node = siblings[new_index];
			if ( direction === 'up' ) {
				container.insertBefore( el, reference_node );
			}
			if ( direction === 'down' ) {
				container.insertBefore( el, reference_node.nextSibling );
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
		set_section_columns( section_el, new_count_raw ) {
			if ( ! section_el || ! section_el.classList.contains( 'wpbc_bfb__section' ) ) {
				return;
			}

			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );
			if ( ! row ) {
				return;
			}

			// Normalize and clamp count (supports 1..4; extend if needed).
			const old_cols = this._get_row_cols( row );
			const current  = old_cols.length || 1;
			const min_c    = 1;
			const max_c    = 4;
			const target   = Math.max( min_c, Math.min( max_c, parseInt( new_count_raw, 10 ) || current ) );

			if ( target === current ) {
				return;
			}



			// Increasing columns -> append new columns at the end.
			if ( target > current ) {
				for ( let i = current; i < target; i++ ) {

					// TODO FIX: remove stray "wpbc__field" class; keep canonical column class only. For now it is required.
					const col = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column wpbc__field' );
					// Give it some initial basis; will be normalized after.
					col.style.flexBasis = ( 100 / target ) + '%';
					// Make this column a drop target.
					this.init_sortable?.( col );
					row.appendChild( col );
				}
				this._rebuild_resizers_for_row(row);
				// Equalize widths considering gap.
				this.layout.set_equal_bases( row, this.col_gap_percent );

				// Overlay: ensure the layout preset chips are present for >1 columns.
				this.add_overlay_toolbar( section_el );

				// Notify listeners (e.g., Min-Width Guard) that structure changed.
				this.bus.emit( WPBC_BFB_Events.STRUCTURE_CHANGE, { source : 'columns-change', section: section_el, count  : target } );

				return;
			}

			// Decreasing columns -> merge contents of trailing columns into the previous one, then remove.
			if ( target < current ) {
				// We’ll always remove from the end down to the target count,
				// moving all children of the last column into the previous column.
				for ( let i = current; i > target; i-- ) {
					// Recompute current list each iteration.
					const cols_now = this._get_row_cols( row );
					const last     = cols_now[ cols_now.length - 1 ];
					const prev     = cols_now[ cols_now.length - 2 ] || null;

					if ( last && prev ) {
						// Move children (sections or fields) to previous column.
						while ( last.firstChild ) {
							prev.appendChild( last.firstChild );
						}
						// Remove last column.
						last.remove();
					}
				}

				// Rebuild resizers and refresh Sortable on the surviving columns.
				this._rebuild_resizers_for_row(row);

				this._get_row_cols( row ).forEach( col => {
					// If Sortable missing, init; if present, do nothing (Sortable.get returns instance).
					if ( typeof Sortable !== 'undefined' && !Sortable.get?.( col ) ) {
						this.init_sortable?.( col );
					}
				} );

				// Normalize widths.
				const computed = this.layout.compute_effective_bases_from_row( row, this.col_gap_percent );
				this.layout.apply_bases_to_row( row, computed.bases );

				// Overlay: hide layout presets if single-column now; ensure toolbar re-checks.
				this.add_overlay_toolbar( section_el );

				// Notify listeners (e.g., Min-Width Guard) that structure changed.
				this.bus.emit( WPBC_BFB_Events.STRUCTURE_CHANGE, { source : 'columns-change', section: section_el, count  : target } );
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

			const next    = !!enabled;
			const rebuild = (opts.rebuild !== false);
			const reinit  = (opts.reinit !== false);

			if ( next === this.preview_mode ) {
				return;
			}

			this.preview_mode = next;

			// Rebuild DOM so fields/sections render according to the new mode.
			if ( rebuild ) {
				this.load_saved_structure( this.get_structure(), { deferIfTyping: true } );

				// Some renderers rely on on_field_drop hooks to (re)wire themselves.
				if ( reinit ) {
					this._reinit_all_fields( 'preview' );
				}
			}

			// Optional event (safe fallback string if constant doesn't exist).
			try {
				const ev = (window.WPBC_BFB_Core?.WPBC_BFB_Events?.PREVIEW_MODE_CHANGE) || 'wpbc:bfb:preview-mode-change';
				this.bus?.emit?.( ev, { enabled: next, source: opts.source || 'builder' } );
			} catch ( _ ) {}
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

			if ( this.__refreshing_canvas ) {
				return;
			}
			this.__refreshing_canvas = true;

			const hard              = (opts.hard !== false);
			const rebuild           = (opts.rebuild !== false);
			const reinit            = (opts.reinit !== false);
			const restore_selection = (opts.restore_selection !== false);
			const restore_scroll    = (opts.restore_scroll !== false);
			const source            = opts.source || 'builder';
			const silent_inspector  = (opts.silent_inspector === true);

			const evs       = (window.WPBC_BFB_Core && window.WPBC_BFB_Core.WPBC_BFB_Events) || {};
			const EV_BEFORE = evs.CANVAS_REFRESH || 'wpbc:bfb:canvas-refresh';
			const EV_AFTER  = evs.CANVAS_REFRESHED || 'wpbc:bfb:canvas-refreshed';

			try {
				// Snapshot UI state.
				const in_preview = !!this.preview_mode;
				const canvas     = this._canvas_root || document.querySelector( '.wpbc_bfb__canvas' ) || document.body;
				const sc_top     = restore_scroll ? (canvas ? canvas.scrollTop : 0) : 0;

				let sel_el = null, sel_id = null;
				if ( restore_selection && typeof this.get_selected_field === 'function' ) {
					sel_el = this.get_selected_field();
					if ( sel_el && sel_el.getAttribute ) {
						sel_id = sel_el.getAttribute( 'data-id' );
					}
				}

				// Signal "before" for packs that want to teardown overlays.
				try {
					this.bus && this.bus.emit && this.bus.emit( EV_BEFORE, {
						mode   : hard ? 'hard' : 'soft',
						source : source,
						preview: in_preview
					} );
				} catch ( _ ) {}

				// Do the work.
				if ( !in_preview ) {
					// Not in preview: nothing to render, but still emit AFTER later.
				} else if ( hard ) {
					if ( rebuild ) {
						this.load_saved_structure( this.get_structure(), { deferIfTyping: true } );
						if ( reinit ) {
							this._reinit_all_fields( 'preview' );
						}
					} else if ( typeof this.render_preview_all === 'function' ) {
						this.render_preview_all();
						// Some packs initialize in on_field_drop(); hydrate them for soft hard-refresh.
						this._reinit_all_fields( 'preview' );
					} else {
						const nodes = document.querySelectorAll( '.wpbc_bfb__field' );
						for ( let i = 0; i < nodes.length; i++ ) {
							this.render_preview( nodes[i], { force: true } );
						}
					}
				} else {
					// soft ????
					if ( sel_el ) {
						this.render_preview( sel_el, { force: true } );
					}
				}

				// Restore selection + scroll.
				if ( restore_selection && sel_id && typeof this.select_by_data_id === 'function' ) {
					this.select_by_data_id( sel_id, { silent: true } );
				}
				if ( restore_scroll && canvas ) {
					canvas.scrollTop = sc_top;
				}

				// Optional bridge: ask Inspector to sync to the selected element (unless silenced).
				if ( !silent_inspector ) {
					try {
						this._inspector_bridge && this._inspector_bridge.sync_from_selected && this._inspector_bridge.sync_from_selected();
					} catch ( _ ) {}
				}

				// Signal "after" so packs can re-init widgets (time selector, masks, etc.).
				try {
					this.bus && this.bus.emit && this.bus.emit( EV_AFTER, {
						mode   : hard ? 'hard' : 'soft',
						source : source,
						preview: in_preview
					} );
				} catch ( _ ) {
				}

			} finally {
				this.__refreshing_canvas = false;
			}
		}

		/**
		 * Optional convenience: render all previews (no rebuild).
		 * Useful if you want a fast "hard" refresh without structure reload.
		 */
		render_preview_all() {
			const root  = this.pages_container || document;
			const nodes = root.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field' );
			for ( let i = 0; i < nodes.length; i++ ) {
				this.render_preview( nodes[i], { force: true } );
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
			if ( !el || !(el.classList?.contains( 'wpbc_bfb__field' ) || el.classList?.contains( 'wpbc_bfb__section' )) ) {
				return null;
			}
			if ( el.classList.contains( 'wpbc_bfb__field' ) ) {
				return this._duplicate_field( el );
			}
			if ( el.classList.contains( 'wpbc_bfb__section' ) ) {
				return this._duplicate_section( el );
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
			const data     = WPBC_Form_Builder_Helper.get_all_data_attributes( field_el );
			const usageKey = field_el.dataset.usage_key || data.usage_key || data.type || 'field';

			// Respect usage limits.
			if ( !this.usage.gate_or_alert( usageKey, { label: data.label || usageKey } ) ) {
				return null;
			}

			// Build a fresh field; let the builder assign unique id/name/html_id and uid.
			const toBuild = { ...data };
			// Clear identifiers to force uniqueness on the duplicate.
			delete toBuild.id;
			delete toBuild.name;
			if ( 'html_id' in toBuild ) delete toBuild.html_id;
			// VERY IMPORTANT!: drop the original UID so build_field creates a new one.
			if ( 'uid' in toBuild ) {
				delete toBuild.uid;
			}

			const copy = this.build_field( toBuild );
			if ( !copy ) return null;

			if ( copy.hasAttribute( 'data-draggable' ) ) {
				copy.removeAttribute( 'data-draggable' );
			}
			copy.classList.add( 'wpbc_bfb__drag-anywhere' );

			// Insert right after original.
			field_el.parentNode.insertBefore( copy, field_el.nextSibling );

			// Announce & hooks.
			this._emit_const( WPBC_BFB_Events.FIELD_ADD, {
				el  : copy,
				data: WPBC_Form_Builder_Helper.get_all_data_attributes( copy )
			} );
			this.usage.update_palette_ui();
			this.trigger_field_drop_callback( copy, 'drop' );
			this.select_field( copy, { scrollIntoView: true } );

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
			if ( !section_el || !section_el.classList?.contains( 'wpbc_bfb__section' ) ) return null;

			// 1) Deep clone + scrub UI artifacts
			const clone = section_el.cloneNode( true );
			clone.querySelectorAll( '.wpbc_bfb__overlay-controls,.sortable-ghost,.sortable-chosen,.sortable-fallback' )
				.forEach( n => n.remove() );

			// Clear flags copied while typing/dragging that can disable DnD.
			const clearDragFlags = (n) => {
				n.removeAttribute( 'data-draggable' );
				n.removeAttribute( 'draggable' );
			};
			clearDragFlags( clone );
			clone.querySelectorAll( '.wpbc_bfb__section, .wpbc_bfb__field' ).forEach( n => {
				clearDragFlags( n );
				if ( n.classList.contains( 'wpbc_bfb__field' ) ) {
					n.classList.add( 'wpbc_bfb__drag-anywhere' );
				}
			} );

			// 1.5) USAGE-LIMIT PREFLIGHT (BLOCK if limits would be exceeded)
			const pre = this._preflight_usage_for_clone( clone, /* strategy */ 'block' ); // Strateg 'block' - show warning and do  not allow to make duplication!
			// const pre = this._preflight_usage_for_clone( clone, /* strategy */ 'strip' ); // Strateg 'strip' - auto-trim elements, from section,  ifthey  out of limits.
			if ( ! pre.ok ) {
				const msg = pre.offenders.map( o => `- “${o.key}” — limit ${o.limit}; have ${o.used}, would add ${o.add}` ).join( '\n' );
				alert( `Cannot duplicate section; usage limits would be exceeded:\n${msg}` );
				this._announce?.( 'Section duplication blocked by limits.' );
				return null;
			}

			// 2) Insert after source
			section_el.insertAdjacentElement( 'afterend', clone );

			// 3) Make ids/names/uids unique via existing helpers
			this.pages_sections._retag_uids_in_subtree?.( clone );
			this.pages_sections._dedupe_subtree_strict?.( clone );

			// 4) Overlays (outer + ALL nested sections/fields)
			this.add_overlay_toolbar?.( clone );
			clone.querySelectorAll( '.wpbc_bfb__section, .wpbc_bfb__field' ).forEach( el => this.add_overlay_toolbar?.( el ) );

			// 5) Sortable wiring using helpers
			//    - Sections sortable among siblings (outer + nested)
			this.pages_sections.init_section_sortable?.( clone );
			clone.querySelectorAll( '.wpbc_bfb__section' ).forEach( s => this.pages_sections.init_section_sortable?.( s ) );

			//    - Field drop zones inside columns/containers.
			this.pages_sections.init_all_nested_sortables?.( clone );

			//    - Defensive pass: ensure every column actually has a Sortable instance
			clone.querySelectorAll( '.wpbc_bfb__column' ).forEach( col => {
				if ( typeof Sortable !== 'undefined' && !Sortable.get?.( col ) ) {
					this.init_sortable?.( col );
				}
			} );

			// 6) Resizers (outer + nested) and normalize bases.
			this._init_resizers_for_section?.( clone );
			clone.querySelectorAll( '.wpbc_bfb__section' ).forEach( s => this._init_resizers_for_section?.( s ) );
			clone.querySelectorAll( '.wpbc_bfb__row' ).forEach( row => {
				const eff = this.layout.compute_effective_bases_from_row( row, this.col_gap_percent );
				this.layout.apply_bases_to_row( row, eff.bases );
			} );

			// 7) Rehydrate field renderers (so widgets bind).
			clone.querySelectorAll( '.wpbc_bfb__field' ).forEach( f => this.trigger_field_drop_callback?.( f, 'load' ) );

			// 8) Housekeeping/UI.
			this.usage?.update_palette_ui?.();
			this.select_field?.( clone, { scrollIntoView: true } );
			this.bus?.emit?.( WPBC_BFB_Events.FIELD_ADD, {
				el : clone,
				id : clone.dataset.id,
				uid: clone.dataset.uid
			} );

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
			return `${prefix}-${++this._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}`;
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
			const row = section_el?.querySelector( ':scope > .wpbc_bfb__row' );
			if ( !row ) return;
			this._rebuild_resizers_for_row( row );
		}

	}


	// Bootstrap facility + auto-init on DOM ready.
	w.WPBC_BFB = w.WPBC_BFB || {};

	w.WPBC_BFB.bootstrap = function bootstrap(options = {}) {
		let b = null;
		try {
			b = new WPBC_Form_Builder( options );
		} catch ( e ) {
			console.error( 'WPBC_BFB bootstrap failed:', e );
			return null;
		}
		window.wpbc_bfb = b;
		// Resolve API 'ready' if it exists already; otherwise the API will resolve itself when created.
		if ( window.wpbc_bfb_api && typeof window.wpbc_bfb_api._resolveReady === 'function' ) {
			window.wpbc_bfb_api._resolveReady( b );
		}
		return b;
	};

	/**
	 * == Public, stable API of Booking Form Builder (BFB).
	 *
	 * Consumers should prefer: wpbc_bfb_api.on(WPBC_BFB_Events.FIELD_ADD, handler)
	 */
	w.wpbc_bfb_api = (function () {
		// 'ready' promise. Resolves once the builder instance exists.
		let _resolveReady;
		const ready = new Promise( r => {
			_resolveReady = r;
		} );
		// Eject/resolve after a timeout so callers aren’t stuck forever:.
		setTimeout( () => {
			_resolveReady( window.wpbc_bfb || null );
		}, 3000 );

		// If builder already exists (e.g., bootstrap ran earlier), resolve immediately.
		if ( window.wpbc_bfb ) {
			_resolveReady( window.wpbc_bfb );
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
				const b  = window.wpbc_bfb;
				const el = b?.get_selected_field?.();
				return el?.dataset?.uid ?? null;
			},
			clear() {
				window.wpbc_bfb?.select_field?.( null );
			},
			/**
			 * @param {string} uid
			 * @param {Object} [opts={}]
			 * @returns {boolean}
			 */
			select_by_uid(uid, opts = {}) {
				const b  = window.wpbc_bfb;

				const esc = WPBC_BFB_Sanitize.esc_attr_value_for_selector( uid );
				const el  = b?.pages_container?.querySelector?.(
					`.wpbc_bfb__field[data-uid="${esc}"], .wpbc_bfb__section[data-uid="${esc}"]`
				);

				if ( el ) {
					b.select_field( el, opts );
				}
				return !!el;
			},
			/** @returns {Array} */
			get_structure() {
				return window.wpbc_bfb?.get_structure?.() ?? [];
			},
			/** @param {Array} s */
			load_structure(s) {
				window.wpbc_bfb?.load_saved_structure?.( s );
			},
			/** @returns {HTMLElement|undefined} */
			add_page() {
				return window.wpbc_bfb?.add_page?.();
			},
			on(event_name, handler) {
				window.wpbc_bfb?.bus?.on?.( event_name, handler );
			},
			off(event_name, handler) {
				window.wpbc_bfb?.bus?.off?.( event_name, handler );
			},
			/**
			 * Dispose the active builder instance.
			 *
			 * @returns {void}
			 */
			destroy() {
				window.wpbc_bfb?.destroy?.();
			},

		};
	})();

	// Convenience helpers (idempotent)
	if ( window.wpbc_bfb_api ) {

		// Sync: returns instance immediately or null
		window.wpbc_bfb_api.get_builder = window.wpbc_bfb_api.get_builder || function () {
			return window.wpbc_bfb || null;
		};

		// Async: always waits for readiness
		window.wpbc_bfb_api.get_builder_async = window.wpbc_bfb_api.get_builder_async || function () {
			return window.wpbc_bfb_api.ready.then( function (b) { return b || null; } );
		};

		// Optional: run callback when ready (no repeated .then everywhere)
		window.wpbc_bfb_api.with_builder = window.wpbc_bfb_api.with_builder || function (fn) {
			return window.wpbc_bfb_api.ready.then( function (b) {
				if ( b && typeof fn === 'function' ) { fn( b ); }
				return b || null;
			} );
		};
	}


	// Auto‑bootstrap on DOM ready.
	(function initBuilderWhenReady() {
		const start = () => {
			// Allow PHP to pass initial options to avoid settings flicker.
			// Example: window.wpbc_bfb_bootstrap_opts = { preview_mode: true, col_gap_percent: 3 };.
			const boot_opts = (window.wpbc_bfb_bootstrap_opts && typeof window.wpbc_bfb_bootstrap_opts === 'object') ? window.wpbc_bfb_bootstrap_opts : {};
			window.WPBC_BFB.bootstrap( boot_opts );
		};
		if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', start, { once: true } );
		} else {
			start();
		}
	})();

	// One-time cleanup: ensure sections don’t have the field class. (old markup hygiene).
	document.querySelectorAll( '.wpbc_bfb__section.wpbc_bfb__field' ).forEach( (el) => el.classList.remove( 'wpbc_bfb__field' ) );


	/**
	 * Empty-space clicks -> dispatch a single event; central listener does the clearing.
	 * One central listener reacts to that event and does the clearing + inspector reset.
	 */
	if ( window.jQuery ) { jQuery( function ( $ ) {
		// Elements where clicks should NOT clear selection.
		const KEEP_CLICK_SEL = [
			'.wpbc_bfb__field',
			'.wpbc_bfb__section',
			'.wpbc_bfb__overlay-controls',
			'.wpbc_bfb__layout_picker',
			'.wpbc_bfb__drag-handle',
			// Inspector / palette surfaces.
			'#wpbc_bfb__inspector', '.wpbc_bfb__inspector',
			'.wpbc_bfb__panel_field_types__ul', '.wpbc_bfb__palette',
			// Generic interactive.
			'input', 'textarea', 'select', 'button', 'label', 'a,[role=button],[contenteditable]',
			// Common popups/widgets.
			'.tippy-box', '.datepick', '.simplebar-scrollbar'
		].join( ',' );

		/**
		 * Reset the inspector/palette empty state UI.
		 *
		 * @returns {void}
		 */
		function resetInspectorUI() {
			const $all = $( '#wpbc_bfb__inspector, .wpbc_bfb__inspector, .wpbc_bfb__palette, .wpbc_bfb__options_panel' );
			if ( ! $all.length ) return;
			$all.removeClass( 'has-selection is-active' );
			$all.each( function () {
				const $pal = jQuery( this );
				$pal.find( '[data-for-uid],[data-for-field],[data-panel="field"],[role="tabpanel"]' ).attr( 'hidden', true ).addClass( 'is-hidden' );
				$pal.find( '[role="tab"]' ).attr( { 'aria-selected': 'false', 'tabindex': '-1' } ).removeClass( 'is-active' );
				$pal.find( '.wpbc_bfb__inspector-empty, .wpbc_bfb__empty_state, [data-empty-state="true"]' ).removeAttr( 'hidden' ).removeClass( 'is-hidden' );
			} );
		}

		const root = document.querySelector( '.wpbc_settings_page_content' );
		if ( ! root ) {
			return;
		}

		/**
		 * Handle clear-selection requests from ESC/empty-space and sync with builder.
		 *
		 * @param {CustomEvent} evt - The event carrying optional `detail.source`.
		 * @returns {void}
		 */
		function handleClearSelection( evt ) {
			const src = evt?.detail?.source;

			// If this is the builder telling us it already cleared selection,
			// just sync the surrounding UI and exit.
			if ( src === 'builder' ) {
				resetInspectorUI();
				return;
			}

			// Otherwise it's a request to clear (ESC, empty space, etc.).
			if ( window.wpbc_bfb_api && typeof window.wpbc_bfb_api.clear === 'function' ) {
				window.wpbc_bfb_api.clear(); // This will emit the 'builder' notification next.
			} else {
				// Fallback if the API isn't available.
				jQuery( '.is-selected, .wpbc_bfb__field--active, .wpbc_bfb__section--active' )
					.removeClass( 'is-selected wpbc_bfb__field--active wpbc_bfb__section--active' );
				resetInspectorUI();
			}
		}

		// Listen globally for clear-selection notifications.
		const EV = WPBC_BFB_Events || {};
		document.addEventListener( EV.CLEAR_SELECTION || 'wpbc:bfb:clear-selection', handleClearSelection );

		// Capture clicks; only dispatch the event (no direct clearing here).
		root.addEventListener( 'click', function ( e ) {
			const $t = $( e.target );

			// Ignore clicks inside interactive / builder controls.
			if ( $t.closest( KEEP_CLICK_SEL ).length ) {
				return;
			}

			// Ignore mouseup after selecting text.
			if ( window.getSelection && String( window.getSelection() ).trim() !== '' ) {
				return;
			}

			// Dispatch the single event; let the listener do the work.
			const evt = new CustomEvent( 'wpbc:bfb:clear-selection', {
				detail: { source: 'empty-space-click', originalEvent: e }
			} );
			document.dispatchEvent( evt );
		}, true );
	} ); } // end jQuery guard

})( window );

/**
 * Usage examples:
 *
window.wpbc_bfb_api.with_builder(function (B) {
	B.set_preview_mode(enabled, { rebuild: true, reinit: true, source: 'settings-effects' });
});

 */
