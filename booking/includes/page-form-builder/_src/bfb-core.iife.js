// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/bfb-core.iife.js == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
( function ( w ) {
	'use strict';

	// Define core on a single namespace.
	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});

	/**
	 * WPBC ID / Name service. Generates, sanitizes, and ensures uniqueness for field ids/names/html_ids within the canvas.
	 */
	Core.WPBC_BFB_IdService = class  {

		/**
		 * Constructor. Set root container of the form pages.
		 *
		 * @param {HTMLElement} pages_container - Root container of the form pages.
		 */
		constructor( pages_container ) {
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
			const base    = Core.WPBC_BFB_Sanitize.sanitize_html_id( baseId );
			let id        = base || 'field';
			const esc     = (v) => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( v );
			const escUid  = (v) => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( v );
			const notSelf = currentEl?.dataset?.uid ? `:not([data-uid="${escUid( currentEl.dataset.uid )}"])` : '';
			while ( this.pages_container?.querySelector(
				`.wpbc_bfb__panel--preview .wpbc_bfb__field${notSelf}[data-id="${esc( id )}"]`
			) ) {
				// Excludes self by data-uid .
				const found = this.pages_container.querySelector( `.wpbc_bfb__panel--preview .wpbc_bfb__field[data-id="${esc( id )}"]` );
				if ( found && currentEl && found === currentEl ) {
					break;
				}
				id = `${base || 'field'}-${Math.random().toString( 36 ).slice( 2, 5 )}`;
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
			let name  = base || 'field';
			const esc = (v) => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( v );
			while ( true ) {
				const clashes = this.pages_container?.querySelectorAll(
					`.wpbc_bfb__panel--preview .wpbc_bfb__field[data-name="${esc( name )}"]`
				) || [];
				const other   = Array.from( clashes ).find( el => el !== currentEl );
				if ( ! other ) break;
				const m = name.match( /-(\d+)$/ );
				name    = m ? name.replace( /-\d+$/, '-' + (Number( m[1] ) + 1) ) : `${base}-2`;
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
		set_field_id( field_el, newIdRaw, renderPreview = false ) {
			const desired = Core.WPBC_BFB_Sanitize.sanitize_html_id( newIdRaw );
			const unique  = this.ensure_unique_field_id( desired, field_el );
			field_el.setAttribute( 'data-id', unique );
			if ( renderPreview ) {
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
		set_field_name( field_el, newNameRaw, renderPreview = false ) {
			const raw  = (newNameRaw == null ? '' : String( newNameRaw )).trim();
			const base = raw
				? Core.WPBC_BFB_Sanitize.sanitize_html_name( raw )
				: Core.WPBC_BFB_Sanitize.sanitize_html_name( field_el.getAttribute( 'data-id' ) || 'field' );

			const unique = this.ensure_unique_field_name( base, field_el );
			field_el.setAttribute( 'data-name', unique );
			if ( renderPreview ) {
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
		set_field_html_id( field_el, newHtmlIdRaw, renderPreview = false ) {
			const raw = (newHtmlIdRaw == null ? '' : String( newHtmlIdRaw )).trim();

			if ( raw === '' ) {
				field_el.removeAttribute( 'data-html_id' );
				if ( renderPreview ) {
					// Caller decides if / when to render.
				}
				return '';
			}

			const desired = Core.WPBC_BFB_Sanitize.sanitize_html_id( raw );
			let htmlId    = desired;
			const esc     = ( v ) => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( v );

			while ( true ) {
				const clash = this.pages_container?.querySelector( `.wpbc_bfb__panel--preview .wpbc_bfb__field[data-html_id="${esc( htmlId )}"]` );
				if ( ! clash || clash === field_el ) {
					break;
				}
				const m = htmlId.match( /-(\d+)$/ );
				htmlId  = m ? htmlId.replace( /-\d+$/, '-' + (Number( m[1] ) + 1) ) : `${desired}-2`;
			}

			field_el.setAttribute( 'data-html_id', htmlId );
			if ( renderPreview ) {
				// Caller decides if / when to render.
			}
			return htmlId;
		}
	};

	/**
	 * WPBC Layout service. Encapsulates column width math with gap handling, presets, and utilities.
	 */
	Core.WPBC_BFB_LayoutService = class  {

		/**
		 * Constructor. Set options with gap between columns (%).
		 *
		 * @param {{ col_gap_percent?: number }} [opts] - Options with gap between columns (%).
		 */
		constructor( opts = {} ) {
			this.col_gap_percent = Number.isFinite( +opts.col_gap_percent ) ? +opts.col_gap_percent : 3;
		}

		/**
		 * Compute normalized flex-basis values for a row, respecting column gaps.
		 * Returns bases that sum to available = 100 - (n-1)*gap.
		 *
		 * @param {HTMLElement} row_el - Row element containing .wpbc_bfb__column children.
		 * @param {number} [gap_percent=this.col_gap_percent] - Gap percent between columns.
		 * @returns {{available:number,bases:number[]}} Available space and basis values.
		 */
		compute_effective_bases_from_row( row_el, gap_percent = this.col_gap_percent ) {
			const cols = Array.from( row_el?.querySelectorAll( ':scope > .wpbc_bfb__column' ) || [] );
			const n    = cols.length || 1;

			const raw = cols.map( ( col ) => {
				const w = col.style.flexBasis || '';
				const p = Core.WPBC_BFB_Sanitize.parse_percent( w, NaN );
				return Number.isFinite( p ) ? p : (100 / n);
			} );

			const sum_raw    = raw.reduce( ( a, b ) => a + b, 0 ) || 100;
			const gp         = Number.isFinite( +gap_percent ) ? +gap_percent : 3;
			const total_gaps = Math.max( 0, n - 1 ) * gp;
			const available  = Math.max( 0, 100 - total_gaps );
			const scale      = available / sum_raw;

			return {
				available,
				bases: raw.map( ( p ) => Math.max( 0, p * scale ) )
			};
		}

		/**
		 * Apply computed bases to the row's columns (sets flex-basis %).
		 *
		 * @param {HTMLElement} row_el - Row element.
		 * @param {number[]} bases - Array of basis values (percent of full 100).
		 * @returns {void}
		 */
		apply_bases_to_row( row_el, bases ) {
			const cols = Array.from( row_el?.querySelectorAll( ':scope > .wpbc_bfb__column' ) || [] );
			cols.forEach( ( col, i ) => {
				const p             = bases[i] ?? 0;
				col.style.flexBasis = `${p}%`;
			} );
		}

		/**
		 * Distribute columns evenly, respecting gap.
		 *
		 * @param {HTMLElement} row_el - Row element.
		 * @param {number} [gap_percent=this.col_gap_percent] - Gap percent.
		 * @returns {void}
		 */
		set_equal_bases( row_el, gap_percent = this.col_gap_percent ) {
			const cols       = Array.from( row_el?.querySelectorAll( ':scope > .wpbc_bfb__column' ) || [] );
			const n          = cols.length || 1;
			const gp         = Number.isFinite( +gap_percent ) ? +gap_percent : 3;
			const total_gaps = Math.max( 0, n - 1 ) * gp;
			const available  = Math.max( 0, 100 - total_gaps );
			const each       = available / n;
			this.apply_bases_to_row( row_el, Array( n ).fill( each ) );
		}

		/**
		 * Apply a preset of relative weights to a row/section.
		 *
		 * @param {HTMLElement} sectionOrRow - .wpbc_bfb__section or its child .wpbc_bfb__row.
		 * @param {number[]} weights - Relative weights (e.g., [1,3,1]).
		 * @param {number} [gap_percent=this.col_gap_percent] - Gap percent.
		 * @returns {void}
		 */
		apply_layout_preset( sectionOrRow, weights, gap_percent = this.col_gap_percent ) {
			const row = sectionOrRow?.classList?.contains( 'wpbc_bfb__row' )
				? sectionOrRow
				: sectionOrRow?.querySelector( ':scope > .wpbc_bfb__row' );

			if ( ! row ) {
				return;
			}

			const cols = Array.from( row.querySelectorAll( ':scope > .wpbc_bfb__column' ) || [] );
			const n    = cols.length || 1;

			if ( ! Array.isArray( weights ) || weights.length !== n ) {
				this.set_equal_bases( row, gap_percent );
				return;
			}

			const sum       = weights.reduce( ( a, b ) => a + Math.max( 0, Number( b ) || 0 ), 0 ) || 1;
			const gp        = Number.isFinite( +gap_percent ) ? +gap_percent : 3;
			const available = Math.max( 0, 100 - Math.max( 0, n - 1 ) * gp );
			const bases     = weights.map( ( w ) => Math.max( 0, (Number( w ) || 0) / sum * available ) );

			this.apply_bases_to_row( row, bases );
		}

		/**
		 * Build preset weight lists for a given column count.
		 *
		 * @param {number} n - Column count.
		 * @returns {number[][]} List of weight arrays.
		 */
		build_presets_for_columns( n ) {
			switch ( n ) {
				case 1:
					return [ [ 1 ] ];
				case 2:
					return [ [ 1, 2 ], [ 2, 1 ], [ 1, 3 ], [ 3, 1 ] ];
				case 3:
					return [ [ 1, 3, 1 ], [ 1, 2, 1 ], [ 2, 1, 1 ], [ 1, 1, 2 ] ];
				case 4:
					return [ [ 1, 2, 2, 1 ], [ 2, 1, 1, 1 ], [ 1, 1, 1, 2 ] ];
				default:
					return [ Array( n ).fill( 1 ) ];
			}
		}

		/**
		 * Format a human-readable label like "50%/25%/25%" from weights.
		 *
		 * @param {number[]} weights - Weight list.
		 * @returns {string} Label string.
		 */
		format_preset_label( weights ) {
			const sum = weights.reduce( ( a, b ) => a + (Number( b ) || 0), 0 ) || 1;
			return weights.map( ( w ) => Math.round( ((Number( w ) || 0) / sum) * 100 ) ).join( '%/' ) + '%';
		}

		/**
		 * Parse comma/space separated weights into numbers.
		 *
		 * @param {string} input - User input like "20,60,20".
		 * @returns {number[]} Parsed weights.
		 */
		parse_weights( input ) {
			if ( ! input ) {
				return [];
			}
			return String( input )
				.replace( /[^\d,.\s]/g, '' )
				.split( /[\s,]+/ )
				.map( ( s ) => parseFloat( s ) )
				.filter( ( n ) => Number.isFinite( n ) && n >= 0 );
		}
	};

	/**
	 * WPBC Usage Limit service.
	 * Counts field usage by key, compares to palette limits, and updates palette UI.
	 */
	Core.WPBC_BFB_UsageLimitService = class  {

		/**
		 * Constructor. Set pages_container and palette_ul.
		 *
		 * @param {HTMLElement} pages_container - Canvas root that holds placed fields.
		 * @param {HTMLElement[]|null} palette_uls?:   Palettes UL with .wpbc_bfb__field items (may be null).
		 */
		constructor(pages_container, palette_uls) {
			this.pages_container = pages_container;
			// Normalize to an array; we’ll still be robust if none provided.
			this.palette_uls     = Array.isArray( palette_uls ) ? palette_uls : (palette_uls ? [ palette_uls ] : []);
		}


		/**
		 * Parse usage limit from raw dataset value. Missing/invalid -> Infinity.
		 *
		 * @param {string|number|null|undefined} raw - Raw attribute value.
		 * @returns {number} Limit number or Infinity.
		 */
		static parse_usage_limit( raw ) {
			if ( raw == null ) {
				return Infinity;
			}
			const n = parseInt( raw, 10 );
			return Number.isFinite( n ) ? n : Infinity;
		}

		/**
		 * Count how many instances exist per usage_key in the canvas.
		 *
		 * @returns {Record<string, number>} Map of usage_key -> count.
		 */
		count_usage_by_key() {
			const used = {};
			const all  = this.pages_container?.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)' ) || [];
			all.forEach( ( el ) => {
				const key = el.dataset.usage_key || el.dataset.id;
				if ( ! key ) {
					return;
				}
				used[key] = (used[key] || 0) + 1;
			} );
			return used;
		}

		/**
		 * Return palette limit for a given usage key (id of the palette item).
		 *
		 * @param {string} key - Usage key.
		 * @returns {number} Limit value or Infinity.
		 */
		get_limit_for_key(key) {
			if ( ! key ) {
				return Infinity;
			}
			// Query across all palettes present now (stored + any newly added in DOM).
			const allPaletteFields = document.querySelectorAll( '.wpbc_bfb__panel_field_types__ul .wpbc_bfb__field' );
			let limit              = Infinity;

			allPaletteFields.forEach( (el) => {
				if ( el.dataset.id === key ) {
					const n = Core.WPBC_BFB_UsageLimitService.parse_usage_limit( el.dataset.usagenumber );
					// Choose the smallest finite limit (safest if palettes disagree).
					if ( n < limit ) {
						limit = n;
					}
				}
			} );

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
			const palettes = document.querySelectorAll( '.wpbc_bfb__panel_field_types__ul' );

			palettes.forEach( (pal) => {
				pal.querySelectorAll( '.wpbc_bfb__field' ).forEach( (panel_field) => {
					const paletteId   = panel_field.dataset.id;
					const raw_limit   = panel_field.dataset.usagenumber;
					const perElLimit  = Core.WPBC_BFB_UsageLimitService.parse_usage_limit( raw_limit );
					// Effective limit across all palettes is the global limit for this key.
					const globalLimit = this.get_limit_for_key( paletteId );
					const limit       = Number.isFinite( globalLimit ) ? globalLimit : perElLimit; // prefer global min

					const current = usage[paletteId] || 0;
					const disable = Number.isFinite( limit ) && current >= limit;

					panel_field.style.pointerEvents = disable ? 'none' : '';
					panel_field.style.opacity       = disable ? '0.4' : '';
					panel_field.setAttribute( 'aria-disabled', disable ? 'true' : 'false' );
					if ( disable ) {
						panel_field.setAttribute( 'tabindex', '-1' );
					} else {
						panel_field.removeAttribute( 'tabindex' );
					}
				} );
			} );
		}


		/**
		 * Return how many valid instances with this usage key exist in the canvas.
		 *
		 * @param {string} key - Usage key of a palette item.
		 * @returns {number} Count of existing non-invalid instances.
		 */
		count_for_key( key ) {
			if ( ! key ) {
				return 0;
			}
			return ( this.pages_container?.querySelectorAll(
				`.wpbc_bfb__panel--preview .wpbc_bfb__field[data-usage_key="${Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( key )}"]:not(.is-invalid)`
			) || [] ).length;
		}

		/**
		 * Alias for limit lookup (readability).
		 *
		 * @param {string} key - Usage key of a palette item.
		 * @returns {number} Limit value or Infinity.
		 */
		limit_for_key( key ) {
			return this.get_limit_for_key( key );
		}

		/**
		 * Remaining slots for this key (Infinity if unlimited).
		 *
		 * @param {string} key - Usage key of a palette item.
		 * @returns {number} Remaining count (>= 0) or Infinity.
		 */
		remaining_for_key( key ) {
			const limit = this.limit_for_key( key );
			if ( limit === Infinity ) {
				return Infinity;
			}
			const used = this.count_for_key( key );
			return Math.max( 0, limit - used );
		}

		/**
		 * True if you can add `delta` more items for this key.
		 *
		 * @param {string} key - Usage key of a palette item.
		 * @param {number} [delta=1] - How many items you intend to add.
		 * @returns {boolean} Whether adding is allowed.
		 */
		can_add( key, delta = 1 ) {
			const rem = this.remaining_for_key( key );
			return ( rem === Infinity ) ? true : ( rem >= delta );
		}

		/**
		 * UI-facing gate: alert when exceeded. Returns boolean allowed/blocked.
		 *
		 * @param {string} key - Usage key of a palette item.
		 * @param {{label?: string, delta?: number}} [opts={}] - Optional UI info.
		 * @returns {boolean} True if allowed, false if blocked.
		 */
		gate_or_alert( key, { label = key, delta = 1 } = {} ) {
			if ( this.can_add( key, delta ) ) {
				return true;
			}
			const limit = this.limit_for_key( key );
			alert( `Only ${limit} instance${limit > 1 ? 's' : ''} of "${label}" allowed.` );
			return false;
		}

		/**
		 * Backward-compatible alias used elsewhere in the codebase.  - Check whether another instance with the given usage key can be added.
		 *
		 * @param {string} key - Usage key of a palette item.
		 * @returns {boolean} Whether adding one more is allowed.
		 */
		is_usage_ok( key ) {
			return this.can_add( key, 1 );
		}

	};

	/**
	 * Constant event names for the builder.
	 */
	Core.WPBC_BFB_Events = Object.freeze({
		SELECT            : 'wpbc:bfb:select',
		CLEAR_SELECTION   : 'wpbc:bfb:clear-selection',
		FIELD_ADD         : 'wpbc:bfb:field:add',
		FIELD_REMOVE      : 'wpbc:bfb:field:remove',
		STRUCTURE_CHANGE  : 'wpbc:bfb:structure:change',
		STRUCTURE_LOADED  : 'wpbc:bfb:structure:loaded'
	});

	/**
	 * Lightweight event bus that emits to both the pages container and document.
	 */
	Core.WPBC_BFB_EventBus =  class {
		/**
		 * @param {HTMLElement} scope_el - Element to dispatch bubbled events from.
		 */
		constructor( scope_el ) {
			this.scope_el = scope_el;
		}

		/**
		 * Emit a DOM CustomEvent with payload.
		 *
		 * @param {string} type - Event type (use Core.WPBC_BFB_Events. when possible).
		 * @param {Object} [detail={}] - Arbitrary serializable payload.
		 * @returns {void}
		 */
		emit( type, detail = {} ) {
			if ( ! this.scope_el ) {
				return;
			}
			this.scope_el.dispatchEvent( new CustomEvent( type, { detail: { ...detail }, bubbles: true } ) );
		}

		/**
		 * Subscribe to an event on document.
		 *
		 * @param {string} type - Event type.
		 * @param {(ev:CustomEvent)=>void} handler - Handler function.
		 * @returns {void}
		 */
		on( type, handler ) {
			document.addEventListener( type, handler );
		}

		/**
		 * Unsubscribe from an event on document.
		 *
		 * @param {string} type - Event type.
		 * @param {(ev:CustomEvent)=>void} handler - Handler function.
		 * @returns {void}
		 */
		off( type, handler ) {
			document.removeEventListener( type, handler );
		}
	};

	/**
	 * SortableJS manager: single point for consistent DnD config.
	 */
	Core.WPBC_BFB_SortableManager = class  {

		/**
		 * @param {WPBC_Form_Builder} builder - The active builder instance.
		 * @param {{ groupName?: string, animation?: number, ghostClass?: string, chosenClass?: string, dragClass?: string }} [opts={}] - Visual/behavior options.
		 */
		constructor( builder, opts = {} ) {
			this.builder = builder;
			this.opts = {
				groupName  : 'form',
				animation  : 150,
				ghostClass : 'wpbc_bfb__drag-ghost',
				chosenClass: 'wpbc_bfb__highlight',
				dragClass  : 'wpbc_bfb__drag-active',
				...opts
			};
			/** @type {Set<HTMLElement>} */
			this._containers = new Set();
		}

		/**
		 * Tag the drag mirror (element under cursor) with role: 'palette' | 'canvas'.
		 * Works with Sortable's fallback mirror (.sortable-fallback / .sortable-drag) and with your dragClass (.wpbc_bfb__drag-active).
		 */
		_tag_drag_mirror( evt ) {
			const fromPalette = this.builder?.palette_uls?.includes?.( evt.from );
			const role        = fromPalette ? 'palette' : 'canvas';
			// Wait a tick so the mirror exists.  - The window.requestAnimationFrame() method tells the browser you wish to perform an animation.
			requestAnimationFrame( () => {
				const mirror = document.querySelector( '.sortable-fallback, .sortable-drag, .' + this.opts.dragClass );
				if ( mirror ) {
					mirror.setAttribute( 'data-drag-role', role );
				}
			} );
		}

		_toggle_dnd_root_flags( active, from_palette = false ) {

			// set to root element of an HTML document, which is the <html>.
			const root = document.documentElement;
			if ( active ) {
				root.classList.add( 'wpbc_bfb__dnd-active' );
				if ( from_palette ) {
					root.classList.add( 'wpbc_bfb__drag-from-palette' );
				}
			} else {
				root.classList.remove( 'wpbc_bfb__dnd-active', 'wpbc_bfb__drag-from-palette' );
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
		ensure( container, role, handlers = {} ) {
			if ( ! container || typeof Sortable === 'undefined' ) {
				return;
			}
			if ( Sortable.get?.( container ) ) {
				return;
			}

			const common = {
				animation  : this.opts.animation,
				ghostClass : this.opts.ghostClass,
				chosenClass: this.opts.chosenClass,
				dragClass  : this.opts.dragClass,
				// == Element under the cursor  == Ensure we drag a real DOM mirror you can style via CSS (cross-browser).
				forceFallback    : true,
				fallbackOnBody   : true,
				fallbackTolerance: 6,
				// Add body/html flags so you can style differently when dragging from palette.
				onStart: (evt) => {
					this.builder._add_dragging_class();

					const fromPalette = this.builder?.palette_uls?.includes?.( evt.from );
					this._toggle_dnd_root_flags( true, fromPalette );  // set to root HTML document: html.wpbc_bfb__dnd-active.wpbc_bfb__drag-from-palette .

					this._tag_drag_mirror( evt );                      // Add 'data-drag-role' attribute to  element under cursor.
				},
				onEnd  : () => {
					setTimeout( () => { this.builder._remove_dragging_class(); }, 50 );
					this._toggle_dnd_root_flags( false );
				}
			};

			if ( role === 'palette' ) {
				Sortable.create( container, {
					...common,
					group   : { name: this.opts.groupName, pull: 'clone', put: false },
					sort    : false
				} );
				this._containers.add( container );
				return;
			}

			// role === 'canvas'.
			Sortable.create( container, {
				...common,
				group    : {
					name: this.opts.groupName,
					pull: true,
					put : (to, from, draggedEl) => {
						return draggedEl.classList.contains( 'wpbc_bfb__field' ) ||
							   draggedEl.classList.contains( 'wpbc_bfb__section' );
					}
				},
				// ---------- DnD Handlers --------------                // Grab anywhere on fields that opt-in with the class or attribute.  - Sections still require their dedicated handle.
				handle   : '.section-drag-handle, .wpbc_bfb__drag-handle, .wpbc_bfb__drag-anywhere, [data-draggable="true"]',
				draggable: '.wpbc_bfb__field:not([data-draggable="false"]), .wpbc_bfb__section',                        // Per-field opt-out with [data-draggable="false"] (e.g., while editing).
				// ---------- Filters - No DnD ----------                // Declarative “no-drag zones”: anything inside these wrappers won’t start a drag.
				filter: [
					'.wpbc_bfb__no-drag-zone',
					'.wpbc_bfb__no-drag-zone *',
					'.wpbc_bfb__column-resizer',  // Ignore the resizer rails during DnD (prevents edge “snap”).
					                              // In the overlay toolbar, block everything EXCEPT the drag handle (and its icon).
					'.wpbc_bfb__overlay-controls *:not(.wpbc_bfb__drag-handle):not(.section-drag-handle):not(.wpbc_icn_drag_indicator)'
				].join( ',' ),
				preventOnFilter  : false,
					// ---------- anti-jitter tuning ----------
				direction            : 'vertical',           // columns are vertical lists.
				invertSwap           : true,                 // use swap on inverted overlap.
				swapThreshold        : 0.65,                 // be less eager to swap.
				invertedSwapThreshold: 0.85,                 // require deeper overlap when inverted.
				emptyInsertThreshold : 24,                   // don’t jump into empty containers too early.
				dragoverBubble       : false,                // keep dragover local.
				fallbackOnBody       : true,                 // more stable positioning.
				fallbackTolerance    : 6,                    // Reduce micro-moves when the mouse shakes a bit (esp. on touchpads).
				scroll               : true,
				scrollSensitivity    : 40,
				scrollSpeed          : 10,
				/**
				 * Enter/leave hysteresis for cross-column moves.    Only allow dropping into `to` when the pointer is well inside it.
				 */
				onMove: (evt, originalEvent) => {
					const { to, from } = evt;
					if ( !to || !from ) return true;

					// Only gate columns (not page containers), and only for cross-column moves in the same row
					const isColumn = to.classList?.contains( 'wpbc_bfb__column' );
					if ( !isColumn ) return true;

					const fromRow = from.closest( '.wpbc_bfb__row' );
					const toRow   = to.closest( '.wpbc_bfb__row' );
					if ( fromRow && toRow && fromRow !== toRow ) return true;

					const rect = to.getBoundingClientRect();
					const evtX = (originalEvent.touches?.[0]?.clientX) ?? originalEvent.clientX;
					const evtY = (originalEvent.touches?.[0]?.clientY) ?? originalEvent.clientY;

					// --- Edge fence (like you had), but clamped for tiny columns
					const paddingX = Core.WPBC_BFB_Sanitize.clamp( rect.width * 0.20, 12, 36 );
					const paddingY = Core.WPBC_BFB_Sanitize.clamp( rect.height * 0.10, 6, 16 );

					// Looser Y if the column is visually tiny/empty
					const isVisuallyEmpty = to.childElementCount === 0 || rect.height < 64;
					const innerTop        = rect.top + (isVisuallyEmpty ? 4 : paddingY);
					const innerBottom     = rect.bottom - (isVisuallyEmpty ? 4 : paddingY);
					const innerLeft       = rect.left + paddingX;
					const innerRight      = rect.right - paddingX;

					const insideX = evtX > innerLeft && evtX < innerRight;
					const insideY = evtY > innerTop && evtY < innerBottom;
					if ( !(insideX && insideY) ) return false;   // stay in current column until well inside new one

					// --- Sticky target commit distance: only switch if we’re clearly inside the new column
					const ds = this._dragState;
					if ( ds ) {
						if ( ds.stickyTo && ds.stickyTo !== to ) {
							// require a deeper penetration to switch columns
							const commitX = Core.WPBC_BFB_Sanitize.clamp( rect.width * 0.25, 18, 40 );   // 25% or 18–40px
							const commitY = Core.WPBC_BFB_Sanitize.clamp( rect.height * 0.15, 10, 28 );  // 15% or 10–28px

							const deepInside =
									  (evtX > rect.left + commitX && evtX < rect.right - commitX) &&
									  (evtY > rect.top + commitY && evtY < rect.bottom - commitY);

							if ( !deepInside ) return false;
						}
						// We accept the new target now.
						ds.stickyTo     = to;
						ds.lastSwitchTs = performance.now();
					}

					return true;
				},
				onStart: (evt) => {
					this.builder._add_dragging_class();
					// Match the flags we set in common so CSS stays consistent on canvas drags too.
					const fromPalette = this.builder?.palette_uls?.includes?.( evt.from );
					this._toggle_dnd_root_flags( true, fromPalette );          // set to root HTML document: html.wpbc_bfb__dnd-active.wpbc_bfb__drag-from-palette .
					this._tag_drag_mirror( evt );                             // Tag the mirror under cursor.
					this._dragState = { stickyTo: null, lastSwitchTs: 0 };    // per-drag state.
				},
				onEnd  : () => {
					setTimeout( () => { this.builder._remove_dragging_class(); }, 50 );
					this._toggle_dnd_root_flags( false );                    // set to root HTML document without these classes: html.wpbc_bfb__dnd-active.wpbc_bfb__drag-from-palette .
					this._dragState = null;
				},
				// ----------------------------------------
				onAdd: handlers.onAdd || this.builder.handle_on_add.bind( this.builder )
			} );

			this._containers.add( container );
		}

		/**
		 * Destroy all Sortable instances created by this manager.
		 *
		 * @returns {void}
		 */
		destroyAll() {
			this._containers.forEach( ( el ) => {
				const inst = Sortable.get?.( el );
				if ( inst ) {
					inst.destroy();
				}
			} );
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
	Core.WPBC_BFB_DOM = Object.freeze( {
		SELECTORS: {
			pagePanel : '.wpbc_bfb__panel--preview',
			field     : '.wpbc_bfb__field',
			validField: '.wpbc_bfb__field:not(.is-invalid)',
			section   : '.wpbc_bfb__section',
			column    : '.wpbc_bfb__column',
			row       : '.wpbc_bfb__row',
			overlay   : '.wpbc_bfb__overlay-controls'
		},
		CLASSES  : {
			selected: 'is-selected'
		},
		ATTR     : {
			id      : 'data-id',
			name    : 'data-name',
			htmlId  : 'data-html_id',
			usageKey: 'data-usage_key',
			uid     : 'data-uid'
		}
	} );

	Core.WPBC_Form_Builder_Helper = class {

		/**
		 * Create an HTML element.
		 *
		 * @param {string} tag - HTML tag name.
		 * @param {string} [class_name=''] - Optional CSS class name.
		 * @param {string} [inner_html=''] - Optional innerHTML.
		 * @returns {HTMLElement} Created element.
		 */
		static create_element( tag, class_name = '', inner_html = '' ) {
			const el = document.createElement( tag );
			if ( class_name ) {
				el.className = class_name;
			}
			if ( inner_html ) {
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
		static set_data_attributes( el, data_obj ) {
			Object.entries( data_obj ).forEach( ( [ key, val ] ) => {
				const value = (typeof val === 'object') ? JSON.stringify( val ) : val;
				el.setAttribute( 'data-' + key, value );
			} );
		}

		/**
		 * Get all `data-*` attributes from an element and parse JSON where possible.
		 *
		 * @param {HTMLElement} el - Element to extract data from.
		 * @returns {Object} Parsed key-value map of data attributes.
		 */
		static get_all_data_attributes( el ) {
			const data = {};

			if ( ! el || ! el.attributes ) {
				return data;
			}

			Array.from( el.attributes ).forEach(
				( attr ) => {
					if ( attr.name.startsWith( 'data-' ) ) {
						const key = attr.name.replace( /^data-/, '' );
						try {
							data[key] = JSON.parse( attr.value );
						} catch ( e ) {
							data[key] = attr.value;
						}
					}
				}
			);

			// Only default the label if it's truly absent (undefined/null), not when it's an empty string.
			const hasExplicitLabel = Object.prototype.hasOwnProperty.call( data, 'label' );
			if ( ! hasExplicitLabel && data.id ) {
				data.label = data.id.charAt( 0 ).toUpperCase() + data.id.slice( 1 );
			}

			return data;
		}

		/**
		 * Render a simple label + type preview (used for unknown or fallback fields).
		 *
		 * @param {Object} field_data - Field data object.
		 * @returns {string} HTML content.
		 */
		static render_field_inner_html( field_data ) {
			// Make the fallback preview respect an empty label.
			const hasLabel = Object.prototype.hasOwnProperty.call( field_data, 'label' );
			const label    = hasLabel ? String( field_data.label ) : String( field_data.id || '(no label)' );

			const type        = String( field_data.type || 'unknown' );
			const is_required = field_data.required === true || field_data.required === 'true' || field_data.required === 1 || field_data.required === '1';

			const wrapper = document.createElement( 'div' );

			const spanLabel       = document.createElement( 'span' );
			spanLabel.className   = 'wpbc_bfb__field-label';
			spanLabel.textContent = label + (is_required ? ' *' : '');
			wrapper.appendChild( spanLabel );

			const spanType       = document.createElement( 'span' );
			spanType.className   = 'wpbc_bfb__field-type';
			spanType.textContent = type;
			wrapper.appendChild( spanType );

			return wrapper.innerHTML;
		}

		/**
		 * Debounce a function.
		 *
		 * @param {Function} fn - Function to debounce.
		 * @param {number} wait - Delay in ms.
		 * @returns {Function} Debounced function.
		 */
		static debounce( fn, wait = 120 ) {
			let t = null;
			return function debounced( ...args ) {
				if ( t ) {
					clearTimeout( t );
				}
				t = setTimeout( () => fn.apply( this, args ), wait );
			};
		}

	};

	// Renderer registry. Allows late registration and avoids tight coupling to a global map.
	Core.WPBC_BFB_Field_Renderer_Registry = (function () {
		const map = new Map();
		return {
			register( type, ClassRef ) {
				map.set( String( type ), ClassRef );
			},
			get( type ) {
				return map.get( String( type ) );
			}
		};
	})();

} )( window );
