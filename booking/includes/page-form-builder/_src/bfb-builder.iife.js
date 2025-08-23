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
			const sortableReady = typeof Sortable !== 'undefined';
			if ( ! sortableReady ) {
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

			// Load saved structure or create default page.
			const saved_structure = wpbc_bfb__form_structure__get_example(); // External fallback.

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

			const startLoad = () => waitForRenderers().then( () => setTimeout( () => this.load_saved_structure( saved_structure ), 0 ) );

			if ( document.readyState === 'loading' ) {
				document.addEventListener( 'DOMContentLoaded', startLoad );
			} else {
				startLoad();
			}

			this._start_usage_observer();

			// this.add_page(); return;  // Standard initializing one page.
		}

		_getRenderer(type) {
			return w.WPBC_BFB_Core?.WPBC_BFB_Field_Renderer_Registry?.get?.( type );
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
						} catch ( _ ) {
						}
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
				} catch ( e ) {
				}
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
			const save_btn = document.getElementById( 'wpbc_bfb__save_btn' );
			if ( save_btn ) {
				if ( ! save_btn.hasAttribute( 'type' ) ) {
					save_btn.setAttribute( 'type', 'button' );
				}
				this._on( save_btn, 'click', ( e ) => {
					e.preventDefault();
					const structure = this.get_structure();
					console.log( JSON.stringify( structure, null, 2 ) ); // Developer aid.
					this._emit_const( WPBC_BFB_Events.STRUCTURE_CHANGE, { structure } );
					this.load_saved_structure( structure, { deferIfTyping: false } );
				} );
			}

			// Toggle Preview click.
			const preview_toggle = document.getElementById( 'wpbc_bfb__toggle_preview' );
			if ( preview_toggle ) {
				// initialize from current control state if it is a checkbox/switch.
				if ( 'checked' in preview_toggle ) {
					this.preview_mode = ( 'checked' in preview_toggle ) ? !!preview_toggle.checked : this.preview_mode;
				}
				this._on( preview_toggle, 'change', () => {
					this.preview_mode = ( 'checked' in preview_toggle ) ? !!preview_toggle.checked : !this.preview_mode;
					// Rebuild DOM so fields/sections render according to the new mode.
					this.load_saved_structure( this.get_structure(), { deferIfTyping: true } );
					// Some renderers rely on on_field_drop hooks to (re)wire themselves.
					this._reinit_all_fields( 'preview' );
				} );
			}

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
		 * Set field's OPTIONAL HTML id (data-html_id). Empty removes it. Ensures sanitization and uniqueness among other fields that declared HTML ids.
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
				} catch (e) {
					// No-op.
				}
				this._usage_observer = null;
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
					} catch ( e ) {
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
		init_sortable( container, on_add_callback = this.handle_on_add.bind( this ) ) {
			if ( ! container ) return;
			if ( typeof Sortable === 'undefined' ) return;
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
				this.usage.update_palette_ui();
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
				const usage_key  = paletteId;
				field_data.usage_key = usage_key;

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

			const el = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__field' );
			// Only this builder UID.
			const uid = `f-${++this._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}`;
			el.setAttribute( 'data-uid', uid );
			WPBC_Form_Builder_Helper.set_data_attributes( el, { ...field_data, usage_key: usageKey } );

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
			const label            = hasExplicitLabel ? data.label : id;

			let input_html = '';

			try {
				const FieldClass = this._getRenderer(type);
				if ( typeof FieldClass === 'function' ) {
					const fieldInstance = new FieldClass( data, label, id );
					if ( typeof fieldInstance.render === 'function' ) {
						input_html = fieldInstance.render();
					} else {
						console.warn( `Renderer for "${type}" has no render() method.` );
						input_html = WPBC_Form_Builder_Helper.render_field_inner_html( data );
					}
				} else {
					if ( type ) {
						console.warn( `No renderer found for field type: ${type}.` );
					}
					input_html = WPBC_Form_Builder_Helper.render_field_inner_html( data );
				}
			} catch ( err ) {
				console.error( 'Renderer error.', err );
				input_html = WPBC_Form_Builder_Helper.render_field_inner_html( data );
			}

			field_el.innerHTML = input_html;
			field_el.classList.add( 'wpbc_bfb__preview-rendered' );
			this.add_overlay_toolbar( field_el );

			// Optional hook after DOM is in place.
			try {
				const FieldClass = this._getRenderer(type);
				if ( FieldClass && typeof FieldClass.after_render === 'function' ) {
					FieldClass.after_render( data, field_el );
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
		 * - Decreasing: moves children of removed columns into the previous column, removes columns/resizers, refreshes Sortable, and equalizes widths.
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

			// Helper to (re)insert resizers between columns.
			const rebuild_resizers = () => {
				// Remove all existing resizers.
				Array.from( row.querySelectorAll( ':scope > .wpbc_bfb__column-resizer' ) ).forEach( r => r.remove() );
				// Reinsert between columns.
				const cols = this._get_row_cols( row );
				for ( let i = 0; i < cols.length - 1; i++ ) {
					const resizer = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column-resizer' );
					resizer.addEventListener( 'mousedown', this.init_resize_handler );
					cols[i].insertAdjacentElement( 'afterend', resizer );
				}
			};

			// Increasing columns -> append new columns at the end.
			if ( target > current ) {
				for ( let i = current; i < target; i++ ) {
					const col = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column wpbc__field' );
					// Give it some initial basis; will be normalized after.
					col.style.flexBasis = ( 100 / target ) + '%';
					// Make this column a drop target.
					this.init_sortable?.( col );
					row.appendChild( col );
				}
				rebuild_resizers();
				// Equalize widths considering gap.
				this.layout.set_equal_bases( row, this.col_gap_percent );

				// Overlay: ensure the layout preset chips are present for >1 columns.
				this.add_overlay_toolbar( section_el );
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
				rebuild_resizers();

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
			}
		}

		/**
		 * Delete a field or section, update usage UI, emit events, and select a neighbor.
		 *
		 * @param {HTMLElement} el - .wpbc_bfb__field or .wpbc_bfb__section
		 * @returns {void}
		 */
		delete_item(el) {
			if ( ! el || ! (el.classList?.contains( 'wpbc_bfb__field' ) || el.classList?.contains( 'wpbc_bfb__section' )) ) {
				return;
			}
			const neighbor = this._find_neighbor_selectable?.( el ) || null;

			const id = el?.dataset?.id;
			const uid = el?.dataset?.uid;

			el.remove();

			// Keep palette in sync and notify listeners.
			this.usage.update_palette_ui();
			this.bus.emit( WPBC_BFB_Events.FIELD_REMOVE, {
				id,
				uid,
				el_type: el.classList.contains( 'wpbc_bfb__section' ) ? 'section' : 'field'
			} );

			// Pick a sensible next selection.
			this.select_field( neighbor || null );
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
			if ( window.wpbc_bfb ) {
				_resolveReady( window.wpbc_bfb );
			}
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
				const el = b?.pages_container?.querySelector?.(
					`.wpbc_bfb__field[data-uid="${WPBC_BFB_Sanitize.esc_attr_value_for_selector( uid )}"]`
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

	// Auto‑bootstrap on DOM ready.
	(function initBuilderWhenReady() {
		const start = () => window.WPBC_BFB.bootstrap();
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
			const $pal = $( '#wpbc_bfb__inspector, .wpbc_bfb__palette, .wpbc_bfb__options_panel' ).first();
			if ( ! $pal.length ) {
				return;
			}

			$pal.removeClass( 'has-selection is-active' ).addClass( 'is-empty' );

			$pal.find( '[data-for-uid],[data-for-field],[data-panel="field"],[role="tabpanel"]' )
				.attr( 'hidden', true ).addClass( 'is-hidden' );

			$pal.find( '[role="tab"]' )
				.attr( { 'aria-selected': 'false', 'tabindex': '-1' } )
				.removeClass( 'is-active' );

			$pal.find( '.wpbc_bfb__inspector-empty, .wpbc_bfb__empty_state, [data-empty-state="true"]' )
				.removeAttr( 'hidden' ).removeClass( 'is-hidden' );
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
		const EV = window.WPBC_BFB_Events || {};
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
