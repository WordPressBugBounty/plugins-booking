// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/_out/core/bfb-core.js == | 2025-09-10 15:47
// ---------------------------------------------------------------------------------------------------------------------
(function ( w ) {
	'use strict';

	// Single global namespace (idempotent & load-order safe).
	const Core = ( w.WPBC_BFB_Core = w.WPBC_BFB_Core || {} );
	const UI   = ( Core.UI = Core.UI || {} );

	/**
	 * Core sanitize/escape/normalize helpers.
	 * All methods use snake_case; camelCase aliases are provided for backwards compatibility.
	 */
	Core.WPBC_BFB_Sanitize = class {

		/**
		 * Escape text for safe use in CSS selectors.
		 * @param {string} s - raw selector fragment
		 * @returns {string}
		 */
		static esc_css(s) {
			return (w.CSS && w.CSS.escape) ? w.CSS.escape( String( s ) ) : String( s ).replace( /([^\w-])/g, '\\$1' );
		}

		/**
		 * Escape a value for attribute selectors, e.g. [data-id="<value>"].
		 * @param {string} v
		 * @returns {string}
		 */
		static esc_attr_value_for_selector(v) {
			return String( v )
				.replace( /\\/g, '\\\\' )
				.replace( /"/g, '\\"' )
				.replace( /\n/g, '\\A ' )
				.replace( /\]/g, '\\]' );
		}

		/**
		 * Sanitize into a broadly compatible HTML id: letters, digits, - _ : . ; must start with a letter.
		 * @param {string} v
		 * @returns {string}
		 */
		static sanitize_html_id(v) {
			let s = (v == null ? '' : String( v )).trim();
			s     = s
				.replace( /\s+/g, '-' )
				.replace( /[^A-Za-z0-9\-_\:.]/g, '-' )
				.replace( /-+/g, '-' )
				.replace( /^[-_.:]+|[-_.:]+$/g, '' );
			if ( !s ) return 'field';
			if ( !/^[A-Za-z]/.test( s ) ) s = 'f-' + s;
			return s;
		}

		/**
		 * Sanitize into a safe HTML name token: letters, digits, _ -
		 * Must start with a letter; no dots/brackets/spaces.
		 * @param {string} v
		 * @returns {string}
		 */
		static sanitize_html_name(v) {

			let s = (v == null ? '' : String( v )).trim();

			s = s.replace( /\s+/g, '_' ).replace( /[^A-Za-z0-9_-]/g, '_' ).replace( /_+/g, '_' );

			if ( ! s ) {
				s = 'field';
			}
			if ( ! /^[A-Za-z]/.test( s ) ) {
				s = 'f_' + s;
			}
			return s;
		}

		/**
		 * Escape for HTML text/attributes (not URLs).
		 * @param {any} v
		 * @returns {string}
		 */
		static escape_html(v) {
			if ( v == null ) {
				return '';
			}
			return String( v )
				.replace( /&/g, '&amp;' )
				.replace( /"/g, '&quot;' )
				.replace( /'/g, '&#039;' )
				.replace( /</g, '&lt;' )
				.replace( />/g, '&gt;' );
		}

		/**
		 * Escape minimal set for attribute-safety without slugging.
		 * Keeps original human text; escapes &, <, >, " and ' only.
		 * @param {string} s
		 * @returns {string}
		 */
		static escape_value_for_attr(s) {
			return String( s == null ? '' : s )
				.replace( /&/g, '&amp;' )
				.replace( /</g, '&lt;' )
				.replace( />/g, '&gt;' )
				.replace( /"/g, '&quot;' )
				.replace( /'/g, '&#39;' );
		}

		/**
		 * Sanitize a space-separated CSS class list.
		 * @param {any} v
		 * @returns {string}
		 */
		static sanitize_css_classlist(v) {
			if ( v == null ) return '';
			return String( v ).replace( /[^\w\- ]+/g, ' ' ).replace( /\s+/g, ' ' ).trim();
		}
// == NEW ==
		/**
		 * Turn an arbitrary value into a conservative "token" (underscores, hyphens allowed).
		 * Useful for shortcode tokens, ids in plain text, etc.
		 * @param {any} v
		 * @returns {string}
		 */
		static to_token(v) {
			return String( v ?? '' )
				.trim()
				.replace( /\s+/g, '_' )
				.replace( /[^A-Za-z0-9_\-]/g, '' );
		}

		/**
		 * Convert to kebab-case (letters, digits, hyphens).
		 * @param {any} v
		 * @returns {string}
		 */
		static to_kebab(v) {
			return String( v ?? '' )
				.trim()
				.replace( /[_\s]+/g, '-' )
				.replace( /[^A-Za-z0-9-]/g, '' )
				.replace( /-+/g, '-' )
				.toLowerCase();
		}

		/**
		 * Truthy normalization for form-like inputs: true, 'true', 1, '1', 'yes', 'on'.
		 * @param {any} v
		 * @returns {boolean}
		 */
		static is_truthy(v) {
			if ( typeof v === 'boolean' ) return v;
			const s = String( v ?? '' ).trim().toLowerCase();
			return s === 'true' || s === '1' || s === 'yes' || s === 'on';
		}

		/**
		 * Coerce to boolean with an optional default for empty values.
		 * @param {any} v
		 * @param {boolean} [def=false]
		 * @returns {boolean}
		 */
		static coerce_boolean(v, def = false) {
			if ( v == null || v === '' ) return def;
			return this.is_truthy( v );
		}

		/**
		 * Parse a "percent-like" value ('33'|'33%'|33) with fallback.
		 * @param {string|number|null|undefined} v
		 * @param {number} fallback_value
		 * @returns {number}
		 */
		static parse_percent(v, fallback_value) {
			if ( v == null ) {
				return fallback_value;
			}
			const s = String( v ).trim();
			const n = parseFloat( s.replace( /%/g, '' ) );
			return Number.isFinite( n ) ? n : fallback_value;
		}

		/**
		 * Clamp a number to the [min, max] range.
		 * @param {number} n
		 * @param {number} min
		 * @param {number} max
		 * @returns {number}
		 */
		static clamp(n, min, max) {
			return Math.max( min, Math.min( max, n ) );
		}

		/**
		 * Escape a value for inclusion inside a quoted HTML attribute (double quotes).
		 * Replaces newlines with spaces and double quotes with single quotes.
		 * @param {any} v
		 * @returns {string}
		 */
		static escape_for_attr_quoted(v) {
			if ( v == null ) return '';
			return String( v ).replace( /\r?\n/g, ' ' ).replace( /"/g, '\'' );
		}

		/**
		 * Escape for shortcode-like tokens where double quotes and newlines should be neutralized.
		 * @param {any} v
		 * @returns {string}
		 */
		static escape_for_shortcode(v) {
			return String( v ?? '' ).replace( /"/g, '\\"' ).replace( /\r?\n/g, ' ' );
		}

		/**
		 * JSON.parse with fallback (no throw).
		 * @param {string} s
		 * @param {any} [fallback=null]
		 * @returns {any}
		 */
		static safe_json_parse(s, fallback = null) {
			try {
				return JSON.parse( s );
			} catch ( _ ) {
				return fallback;
			}
		}

		/**
		 * Stringify data-* attribute value safely (objects -> JSON, others -> String).
		 * @param {any} v
		 * @returns {string}
		 */
		static stringify_data_value(v) {
			if ( typeof v === 'object' && v !== null ) {
				try {
					return JSON.stringify( v );
				} catch {
					console.error( 'WPBC: stringify_data_value' );
					return '';
				}
			}
			return String( v );
		}

		// -------------------------------------------------------------------------------------------------------------
		// Strict value guards for CSS lengths and hex colors (defense-in-depth).
		// -------------------------------------------------------------------------------------------------------------
		/**
		 * Sanitize a CSS length. Allows: px, %, rem, em (lower/upper).
		 * Returns fallback if invalid.
		 * @param {any} v
		 * @param {string} [fallback='100%']
		 * @returns {string}
		 */
		static sanitize_css_len(v, fallback = '100%') {
			const s = String( v ?? '' ).trim();
			const m = s.match( /^(-?\d+(?:\.\d+)?)(px|%|rem|em)$/i );
			return m ? m[0] : String( fallback );
		}

		/**
		 * Sanitize a hex color. Allows #rgb or #rrggbb (case-insensitive).
		 * Returns fallback if invalid.
		 * @param {any} v
		 * @param {string} [fallback='#e0e0e0']
		 * @returns {string}
		 */
		static sanitize_hex_color(v, fallback = '#e0e0e0') {
			const s = String( v ?? '' ).trim();
			return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test( s ) ? s : String( fallback );
		}

	}

	/**
	 * WPBC ID / Name service. Generates, sanitizes, and ensures uniqueness for field ids/names/html_ids within the
	 * canvas.
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
				`.wpbc_bfb__panel--preview .wpbc_bfb__field${notSelf}[data-id="${esc(id)}"], .wpbc_bfb__panel--preview .wpbc_bfb__section${notSelf}[data-id="${esc(id)}"]`
			) ) {
				// Excludes self by data-uid .
				const found = this.pages_container.querySelector( `.wpbc_bfb__panel--preview .wpbc_bfb__field[data-id="${esc( id )}"], .wpbc_bfb__panel--preview .wpbc_bfb__section[data-id="${esc( id )}"]` );
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
			let name      = base || 'field';
			const esc     = (v) => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( v );
			const escUid  = (v) => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( v );
			// Exclude the current field *and any DOM mirrors of it* (same data-uid)
			const uid     = currentEl?.dataset?.uid;
			const notSelf = uid ? `:not([data-uid="${escUid( uid )}"])` : '';
			while ( true ) {
				const selector = `.wpbc_bfb__panel--preview .wpbc_bfb__field${notSelf}[data-name="${esc( name )}"]`;
				const clashes  = this.pages_container?.querySelectorAll( selector ) || [];
				if ( clashes.length === 0 ) break;           // nobody else uses this name
				const m = name.match( /-(\d+)$/ );
				name    = m ? name.replace( /-\d+$/, '-' + (Number( m[1] ) + 1) ) : `${base}-2`;
			}
			return name;
		}

		/**
		 * Set field's INTERNAL id (data-id) on an element. Ensures uniqueness and optionally asks caller to refresh
		 * preview.
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
			const esc     = (v) => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( v );
			const escUid  = (v) => Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( v );

			while ( true ) {

				const uid     = field_el?.dataset?.uid;
				const notSelf = uid ? `:not([data-uid="${escUid( uid )}"])` : '';

				const clashInCanvas = this.pages_container?.querySelector(
					`.wpbc_bfb__panel--preview .wpbc_bfb__field${notSelf}[data-html_id="${esc( htmlId )}"],` +
					`.wpbc_bfb__panel--preview .wpbc_bfb__section${notSelf}[data-html_id="${esc( htmlId )}"]`
				);
				const domClash = document.getElementById( htmlId );

				// Allow when the only "clash" is inside this same field (e.g., the input you just rendered)
				const domClashIsSelf = domClash === field_el || (domClash && field_el.contains( domClash ));

				if ( !clashInCanvas && (!domClash || domClashIsSelf) ) {
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
				const key = el.dataset.usage_key || el.dataset.type || el.dataset.id;
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
			const roots            = this.palette_uls?.length ? this.palette_uls : document.querySelectorAll( '.wpbc_bfb__panel_field_types__ul' );
			const allPaletteFields = Array.from( roots ).flatMap( r => Array.from( r.querySelectorAll( '.wpbc_bfb__field' ) ) );
			let limit              = Infinity;

			allPaletteFields.forEach( (el) => {
				const usage_key = el.dataset.usage_key || el.dataset.id;
				if ( el.dataset.id === key || usage_key === key ) {
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
					const usageKey    = panel_field.dataset.usage_key || paletteId;
					const raw_limit   = panel_field.dataset.usagenumber;
					const perElLimit  = Core.WPBC_BFB_UsageLimitService.parse_usage_limit( raw_limit );
					// Effective limit across all palettes is the global limit for this key.
					const globalLimit = this.get_limit_for_key( usageKey );
					const limit       = Number.isFinite( globalLimit ) ? globalLimit : perElLimit; // prefer global min

					const current = usage[usageKey] || 0;
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
                `.wpbc_bfb__panel--preview .wpbc_bfb__field[data-usage_key="${Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( key )}"]:not(.is-invalid), 
                 .wpbc_bfb__panel--preview .wpbc_bfb__field[data-type="${Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( key )}"]:not(.is-invalid)`
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
		 * Backward-compatible alias used elsewhere in the codebase.  - Check whether another instance with the given
		 * usage key can be added.
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
		 * @param {{ groupName?: string, animation?: number, ghostClass?: string, chosenClass?: string, dragClass?:
		 *     string, candidate_dwell_ms?: number, candidate_commit_distance?: number,
		 *     candidate_dwell_distance?: number }} [opts={}] - Visual and drag-stability options.
		 */
		constructor( builder, opts = {} ) {
			this.builder = builder;
			const gid = this.builder?.instance_id || Math.random().toString( 36 ).slice( 2, 8 );
			this.opts = {
				// groupName  : 'form',
				groupName: `form-${gid}`,
				animation  : 150,
				ghostClass : 'wpbc_bfb__drag-ghost',
				chosenClass: 'wpbc_bfb__highlight',
				dragClass  : 'wpbc_bfb__drag-active',
				candidate_dwell_ms        : 90,
				candidate_commit_distance : 10,
				candidate_dwell_distance  : 2,
				...opts
			};
			/** @type {Set<HTMLElement>} */
			this._containers = new Set();

			/**
			 * Guard against lost mouseup / pointerup events.
			 *
			 * @type {boolean}
			 */
			this._drag_fail_safe_bound = false;

			/**
			 * State for the current Form Builder canvas drag.
			 *
			 * @type {?Object}
			 */
			this._drag_state = null;

			this._bind_drag_fail_safe();
		}

		/**
		 * Cleanup drag UI state.
		 *
		 * This is a defensive cleanup for cases when Chrome or a browser extension
		 * loses the final mouseup / pointerup event during fallback dragging.
		 *
		 * @returns {void}
		 */
		_cleanup_drag_ui() {
			const drag_state = this._drag_state;

			if ( drag_state?.item ) {
				drag_state.item.classList.remove( 'wpbc_bfb__drop-indicator' );
			}
			if ( drag_state?.source_spacer?.parentNode ) {
				drag_state.source_spacer.parentNode.removeChild( drag_state.source_spacer );
			}
			this._release_canvas_geometry_locks( drag_state );

			this._drag_state = null;
			this._toggle_dnd_root_flags( false );
			this.builder?._remove_dragging_class?.();

			// Remove only fallback mirrors. Do not touch real dragged elements.
			document.querySelectorAll( '.sortable-fallback[data-drag-role], .wpbc_bfb__simple_list_fallback' )
					.forEach( (el) => {
						if ( el.parentNode ) {
							el.parentNode.removeChild( el );
						}
					} );
		}

		/**
		 * Capture the block size of every canvas layout container before drag reflow starts.
		 *
		 * SortableJS temporarily moves the real node between containers. That changes CSS
		 * `:empty` matching and can otherwise shrink an empty destination row or grow a
		 * populated destination by the insertion-line height. The captured values are
		 * applied only for the active drag session and never become saved form data.
		 *
		 * @returns {Array<Object>} Restorable geometry-lock records for visible canvas containers.
		 */
		_capture_canvas_geometry_locks() {
			const pages_container = this.builder?.pages_container;
			if ( ! pages_container?.querySelectorAll ) {
				return [];
			}

			const lock_selector = [
				'.wpbc_bfb__form_preview_section_container',
				'.wpbc_bfb__row',
				'.wpbc_bfb__column'
			].join( ', ' );
			const block_size_property = '--wpbc-bfb-drag-locked-block-size';

			return Array.from( pages_container.querySelectorAll( lock_selector ) )
				.map( ( element ) => {
					const block_size = element.getBoundingClientRect?.().height;
					if ( ! Number.isFinite( block_size ) || block_size <= 0 ) {
						return null;
					}

					return {
						element                     : element,
						block_size                  : Math.round( block_size * 1000 ) / 1000,
						had_lock_class              : element.classList?.contains( 'wpbc_bfb__drag-geometry-lock' ),
						previous_block_size         : element.style?.getPropertyValue?.( block_size_property ) || '',
						previous_block_size_priority: element.style?.getPropertyPriority?.( block_size_property ) || ''
					};
				} )
				.filter( Boolean );
		}

		/**
		 * Freeze captured canvas container heights for the active SortableJS session.
		 *
		 * The lock is applied before global drag classes or the compact insertion marker
		 * can change flex alignment and empty-container selectors.
		 *
		 * @returns {void}
		 */
		_apply_canvas_geometry_locks() {
			const geometry_locks = this._drag_state?.geometry_locks || [];

			geometry_locks.forEach( ( geometry_lock ) => {
				geometry_lock.element.style?.setProperty(
					'--wpbc-bfb-drag-locked-block-size',
					`${geometry_lock.block_size}px`
				);
				geometry_lock.element.classList?.add( 'wpbc_bfb__drag-geometry-lock' );
			} );
		}

		/**
		 * Restore all inline state used by the drag-session geometry lock.
		 *
		 * @param {?Object} drag_state - Drag state whose geometry records must be restored.
		 * @returns {void}
		 */
		_release_canvas_geometry_locks( drag_state ) {
			const block_size_property = '--wpbc-bfb-drag-locked-block-size';
			const geometry_locks      = drag_state?.geometry_locks || [];

			geometry_locks.forEach( ( geometry_lock ) => {
				if ( geometry_lock.previous_block_size ) {
					geometry_lock.element.style?.setProperty(
						block_size_property,
						geometry_lock.previous_block_size,
						geometry_lock.previous_block_size_priority
					);
				} else {
					geometry_lock.element.style?.removeProperty?.( block_size_property );
				}

				if ( ! geometry_lock.had_lock_class ) {
					geometry_lock.element.classList?.remove( 'wpbc_bfb__drag-geometry-lock' );
				}
			} );
		}

		/**
		 * Capture the original canvas geometry before SortableJS applies its ghost class.
		 *
		 * The saved rectangle is later represented by a non-data spacer. This keeps the
		 * source layout stable while the real dragged node becomes a compact insertion
		 * indicator in another container.
		 *
		 * @param {Sortable.SortableEvent} evt - Sortable choose event.
		 * @returns {void}
		 */
		_prepare_drag_state( evt ) {
			if ( ! evt?.item || ! evt?.from ) {
				this._drag_state = null;
				return;
			}

			const source_rect  = evt.item.getBoundingClientRect();
			const from_palette = !! this.builder?.palette_uls?.includes?.( evt.from );

			this._drag_state = {
				item                : evt.item,
				from_palette        : from_palette,
				source_parent       : evt.from,
				source_next_sibling : evt.item.nextSibling,
				source_rect         : {
					width : source_rect.width,
					height: source_rect.height
				},
				geometry_locks      : this._capture_canvas_geometry_locks(),
				source_spacer       : null,
				accepted_candidate  : null,
				pending_candidate   : null,
				pending_since       : 0,
				pending_pointer     : null
			};
		}

		/**
		 * Create a measured, non-data footprint at the dragged item's source position.
		 *
		 * The spacer intentionally does not use field or section classes, so Form Builder
		 * serialization and usage accounting cannot treat it as saved form content.
		 *
		 * @returns {void}
		 */
		_create_drag_source_spacer() {
			const drag_state = this._drag_state;

			if (
				! drag_state ||
				drag_state.from_palette ||
				! drag_state.item ||
				! drag_state.source_parent ||
				drag_state.source_spacer
			) {
				return;
			}

			const spacer = document.createElement( 'div' );
			const width  = Math.max( 1, drag_state.source_rect?.width || 1 );
			const height = Math.max( 1, drag_state.source_rect?.height || 1 );

			spacer.className = 'wpbc_bfb__drag-source-spacer';
			spacer.setAttribute( 'aria-hidden', 'true' );
			spacer.setAttribute( 'data-wpbc-bfb-drag-source-spacer', 'true' );
			spacer.style.setProperty( '--wpbc-bfb-drag-source-inline-size', `${width}px` );
			spacer.style.setProperty( '--wpbc-bfb-drag-source-block-size', `${height}px` );

			const reference_node = drag_state.source_next_sibling?.parentNode === drag_state.source_parent
				? drag_state.source_next_sibling
				: null;

			drag_state.source_parent.insertBefore( spacer, reference_node );
			drag_state.source_spacer = spacer;
		}

		/**
		 * Start the stable drag representation after SortableJS creates its off-flow mirror.
		 *
		 * @param {Sortable.SortableEvent} evt - Sortable start event.
		 * @returns {void}
		 */
		_start_drag( evt ) {
			if ( ! this._drag_state ) {
				this._prepare_drag_state( evt );
			}

			this._apply_canvas_geometry_locks();
			this.builder?._add_dragging_class?.();

			const from_palette = !! this._drag_state?.from_palette;
			this._toggle_dnd_root_flags( true, from_palette );
			this._tag_drag_mirror( evt );

			if ( ! from_palette && evt?.item ) {
				this._create_drag_source_spacer();
				evt.item.classList.add( 'wpbc_bfb__drop-indicator' );
			}
		}

		/**
		 * Finish a Form Builder drag and remove transient layout helpers.
		 *
		 * @returns {void}
		 */
		_finish_drag() {
			this._cleanup_drag_ui();
		}

		/**
		 * Check whether a SortableJS canvas candidate is stable enough to accept.
		 *
		 * The candidate includes the destination container, related sibling, and insertion
		 * side. A new candidate must receive real pointer movement before it can replace
		 * the accepted position, preventing layout movement alone from causing flip-flops.
		 *
		 * @param {Object} evt - Sortable move event.
		 * @param {MouseEvent|PointerEvent|TouchEvent} original_event - Original pointer event.
		 * @returns {boolean} Whether SortableJS may move the in-flow insertion indicator.
		 */
		_allow_canvas_move( evt, original_event ) {
			const { to, from } = evt || {};
			if ( ! to || ! from ) {
				return true;
			}

			if ( ! to.closest( '.wpbc_bfb__panel--preview' ) ) {
				return true;
			}

			const touch_event  = original_event?.touches?.[0] || original_event?.changedTouches?.[0];
			const event_x      = touch_event?.clientX ?? original_event?.clientX;
			const event_y      = touch_event?.clientY ?? original_event?.clientY;
			const dragged_rect = evt.draggedRect || evt.dragged?.getBoundingClientRect?.();
			const pointer_x    = Number.isFinite( event_x )
				? event_x
				: (dragged_rect ? dragged_rect.left + (dragged_rect.width / 2) : 0);
			const pointer_y    = Number.isFinite( event_y )
				? event_y
				: (dragged_rect ? dragged_rect.top + (dragged_rect.height / 2) : 0);

			// Cross-container column changes require a deliberate move inside the new column.
			if ( to !== from && to.classList?.contains( 'wpbc_bfb__column' ) ) {
				const container_rect = to.getBoundingClientRect();
				const padding_x       = Core.WPBC_BFB_Sanitize.clamp( container_rect.width * 0.20, 12, 36 );
				const padding_y       = Core.WPBC_BFB_Sanitize.clamp( container_rect.height * 0.10, 6, 16 );
				const visually_empty  = ! to.querySelector(
					':scope > .wpbc_bfb__field:not(.wpbc_bfb__drop-indicator), ' +
					':scope > .wpbc_bfb__section:not(.wpbc_bfb__drop-indicator)'
				) || container_rect.height < 64;
				const inner_top       = container_rect.top + (visually_empty ? 4 : padding_y);
				const inner_bottom    = container_rect.bottom - (visually_empty ? 4 : padding_y);
				const inner_left      = container_rect.left + padding_x;
				const inner_right     = container_rect.right - padding_x;

				if ( pointer_x <= inner_left || pointer_x >= inner_right || pointer_y <= inner_top || pointer_y >= inner_bottom ) {
					return false;
				}
			}

			const drag_state = this._drag_state;
			if ( ! drag_state ) {
				return true;
			}

			const candidate = {
				to                : to,
				related           : evt.related || null,
				will_insert_after : !! evt.willInsertAfter
			};
			const candidate_matches = ( first, second ) => !! first && !! second &&
				first.to === second.to &&
				first.related === second.related &&
				first.will_insert_after === second.will_insert_after;

			if ( candidate_matches( candidate, drag_state.accepted_candidate ) ) {
				evt.dragged?.classList.add( 'wpbc_bfb__drop-indicator' );
				return true;
			}

			const now = window.performance?.now?.() ?? Date.now();
			if ( ! candidate_matches( candidate, drag_state.pending_candidate ) ) {
				drag_state.pending_candidate = candidate;
				drag_state.pending_since     = now;
				drag_state.pending_pointer   = { x: pointer_x, y: pointer_y };
				return false;
			}

			const pointer_distance = Math.hypot(
				pointer_x - drag_state.pending_pointer.x,
				pointer_y - drag_state.pending_pointer.y
			);
			const candidate_age            = now - drag_state.pending_since;
			const crossed_commit_distance = pointer_distance >= this.opts.candidate_commit_distance;
			const completed_dwell_move    = candidate_age >= this.opts.candidate_dwell_ms &&
				pointer_distance >= this.opts.candidate_dwell_distance;

			if ( ! crossed_commit_distance && ! completed_dwell_move ) {
				return false;
			}

			drag_state.accepted_candidate = candidate;
			drag_state.pending_candidate  = null;
			drag_state.pending_since      = 0;
			drag_state.pending_pointer    = null;
			evt.dragged?.classList.add( 'wpbc_bfb__drop-indicator' );

			return true;
		}

		/**
		 * Bind global fail-safe listeners for drag cleanup.
		 *
		 * @returns {void}
		 */
		_bind_drag_fail_safe() {
			if ( this._drag_fail_safe_bound ) {
				return;
			}

			this._drag_fail_safe_bound = true;

			const finish_drag = () => {
				window.requestAnimationFrame( () => {
					this._cleanup_drag_ui();
				} );
			};

			[ 'mouseup', 'pointerup', 'touchend', 'dragend' ].forEach( (evt_name) => {
				document.addEventListener( evt_name, finish_drag, true );
			} );

			window.addEventListener( 'blur', finish_drag, true );

			document.addEventListener(
				'visibilitychange',
				() => {
					if ( document.hidden ) {
						finish_drag();
					}
				},
				true
			);
		}

		/**
		 * Tag the drag mirror (element under cursor) with role: 'palette' | 'canvas'.
		 * Works with Sortable's fallback mirror (.sortable-fallback / .sortable-drag) and with your dragClass
		 * (.wpbc_bfb__drag-active).
		 */
		_tag_drag_mirror( evt ) {
			const fromPalette = this.builder?.palette_uls?.includes?.( evt.from );
			const role        = fromPalette ? 'palette' : 'canvas';
			// Wait a tick so the mirror exists.  - The window.requestAnimationFrame() method tells the browser you wish to perform an animation.
			requestAnimationFrame( () => {
				const mirror = document.querySelector( '.sortable-fallback, .sortable-drag, .' + this.opts.dragClass );
				if ( mirror ) {
					mirror.setAttribute( 'data-drag-role', role );
					mirror.setAttribute( 'aria-hidden', 'true' );
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
		 * Ensure a simple vertical sortable list.
		 *
		 * This configuration is intended for inspector/sidebar lists such as:
		 * - dropdown choices
		 * - radio options
		 * - checkbox options
		 *
		 * It is intentionally much simpler than the canvas DnD config and does not
		 * use the column edge-fence / sticky-target logic.
		 *
		 * @param {HTMLElement} container - Sortable list container.
		 * @param {{ handle_selector?: string, draggable_selector?: string, onUpdate?: Function }} [handlers={}] -
		 *     Optional handlers/selectors.
		 * @returns {void}
		 */
		ensure_simple_list( container, handlers = {} ) {
			if ( ! container || typeof Sortable === 'undefined' ) {
				return;
			}
			if ( Sortable.get?.( container ) ) {
				return;
			}

			const common = {
				animation        : this.opts.animation,
				ghostClass       : this.opts.ghostClass,
				chosenClass      : this.opts.chosenClass,
				dragClass        : this.opts.dragClass,
				forceFallback    : true,
				// For a single scrollable sidebar list this is usually more stable.
				fallbackOnBody   : false,
				fallbackTolerance: 8,
				removeCloneOnHide: true,
				onStart          : () => {
					this.builder?._add_dragging_class?.();
					this._toggle_dnd_root_flags( true, false );
				},
				onEnd            : () => {
					setTimeout( () => {
						this.builder?._remove_dragging_class?.();
					}, 50 );
					this._toggle_dnd_root_flags( false );
					this._cleanup_drag_ui();
				}
			};

			Sortable.create(
				container,
				{
					...common,
					group                  : { name: this.opts.groupName, pull: false, put: false },
					sort                   : true,
					direction              : 'vertical',
					handle                 : handlers.handle_selector || '.wpbc_bfb__drag-handle',
					draggable              : handlers.draggable_selector || '.wpbc_bfb__sortable-row',
					fallbackClass          : 'wpbc_bfb__simple_list_fallback',
					filter                 : [
						'input',
						'textarea',
						'select',
						'button',
						'a',
						'.wpbc_bfb__no-drag-zone',
						'.wpbc_bfb__no-drag-zone *'
					].join( ',' ),
					preventOnFilter        : false,
					invertSwap             : false,
					swapThreshold          : 0.30,
					invertedSwapThreshold  : 0.60,
					emptyInsertThreshold   : 8,
					dragoverBubble         : false,
					scroll                 : true,
					scrollSensitivity      : 60,
					scrollSpeed            : 14,
					onUpdate               : handlers.onUpdate || function () {}
				}
			);

			this._containers.add( container );
		}


		/**
		 * Ensure Sortable is attached to a container with role 'palette' or 'canvas'.
		 *
		 *  -- Handle selectors: handle:  '.section-drag-handle, .wpbc_bfb__drag-handle, .wpbc_bfb__drag-anywhere,
		 * [data-draggable="true"]'
		 *  -- Draggable gate: draggable fields, sections, and the transient measured source spacer.
		 *  -- Filter (overlay-safe):     ignore everything in overlay except the handle -
		 * '.wpbc_bfb__overlay-controls
		 * *:not(.wpbc_bfb__drag-handle):not(.section-drag-handle):not(.wpbc_icn_drag_indicator)'
		 *  -- No-drag wrapper:           use .wpbc_bfb__no-drag-zone inside renderers for inputs/widgets.
		 *  -- Focus guard (optional):    flip [data-draggable] on focusin/focusout to prevent accidental drags while
		 * typing.
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

			const sortable_kind = handlers.sortable_kind || '';

			if ( sortable_kind === 'simple_list' ) {
				this.ensure_simple_list( container, handlers );
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
				fallbackTolerance: 8,
				removeCloneOnHide: true,
				onChoose: (evt) => this._prepare_drag_state( evt ),
				onStart : (evt) => this._start_drag( evt ),
				onEnd   : () => this._finish_drag(),
				onMove  : (evt, original_event) => this._allow_canvas_move( evt, original_event )
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
				// Stable insertion geometry is preferable to animating hit-test targets.
				animation: 0,
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
				// The transient spacer participates in hit testing but never serialization.
				draggable: [
					'.wpbc_bfb__field:not([data-draggable="false"])',
					'.wpbc_bfb__section',
					'.wpbc_bfb__drag-source-spacer'
				].join( ', ' ),
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
				scroll               : true,
				scrollSensitivity    : 40,
				scrollSpeed          : 10,
				// ----------------------------------------
				// onAdd: handlers.onAdd || this.builder.handle_on_add.bind( this.builder )
				onAdd: (evt) => {
					if ( this._on_add_section( evt ) ) {
						return;
					}
					// Fallback: original handler for normal fields.
					(handlers.onAdd || this.builder.handle_on_add.bind( this.builder ))( evt );
				},
				onUpdate: () => {
					this.builder.bus?.emit?.( Core.WPBC_BFB_Events.STRUCTURE_CHANGE, { reason: 'sort-update' } );
				}
			} );

			this._containers.add( container );
		}

		/**
		 * Handle adding/moving sections via Sortable onAdd.
		 * Returns true if handled (i.e., it was a section), false to let the default field handler run.
		 *
		 * - Palette -> canvas: remove the placeholder clone and build a fresh section via add_section()
		 * - Canvas -> canvas: keep the moved DOM (and its children), just re-wire overlays/sortables/metadata
		 *
		 * @param {Sortable.SortableEvent} evt
		 * @returns {boolean}
		 */
		_on_add_section(evt) {

			const item = evt.item;
			if ( ! item ) {
				return false;
			}

			// Identify sections both from palette items (li clones) and real canvas nodes.
			const data      = Core.WPBC_Form_Builder_Helper.get_all_data_attributes( item );
			const isSection = item.classList.contains( 'wpbc_bfb__section' ) || (data?.type || item.dataset?.type) === 'section';

			if ( ! isSection ) {
				return false;
			}

			const fromPalette = this.builder?.palette_uls?.includes?.( evt.from ) === true;

			if ( ! fromPalette ) {
				// Canvas -> canvas move: DO NOT rebuild/remove; preserve children.
				this.builder.add_overlay_toolbar?.( item );                       // ensure overlay exists
				this.builder.pages_sections?.init_all_nested_sortables?.( item ); // ensure inner sortables

				// Ensure metadata present/updated
				item.dataset.type    = 'section';
				const cols           = item.querySelectorAll( ':scope > .wpbc_bfb__row > .wpbc_bfb__column' ).length || 1;
				item.dataset.columns = String( cols );

				// Select & notify subscribers (layout/min guards, etc.)
				this.builder.select_field?.( item );
				this.builder.bus?.emit?.( Core.WPBC_BFB_Events.STRUCTURE_CHANGE, { el: item, reason: 'section-move' } );
				this.builder.usage?.update_palette_ui?.();
				return true; // handled.
			}

			// Palette -> canvas: build a brand-new section using the same path as the dropdown/menu
			const to   = evt.to?.closest?.( '.wpbc_bfb__column, .wpbc_bfb__form_preview_section_container' ) || evt.to;
			const cols = parseInt( data?.columns || item.dataset.columns || 1, 10 ) || 1;

			// Remove the palette clone placeholder.
			item.parentNode && item.parentNode.removeChild( item );

			// Create the real section.
			this.builder.pages_sections.add_section( to, cols );

			// Insert at the precise drop index.
			const section = to.lastElementChild; // add_section appends to end.
			if ( evt.newIndex != null && evt.newIndex < to.children.length - 1 ) {
				const ref = to.children[evt.newIndex] || null;
				to.insertBefore( section, ref );
			}

			// Finalize: overlay, selection, events, usage refresh.
			this.builder.add_overlay_toolbar?.( section );
			this.builder.select_field?.( section );
			this.builder.bus?.emit?.( Core.WPBC_BFB_Events.FIELD_ADD, {
				el : section,
				id : section.dataset.id,
				uid: section.dataset.uid
			} );
			this.builder.usage?.update_palette_ui?.();

			return true;
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
	 *                  SELECTORS: {pagePanel: string, field: string, validField: string, section: string, column:
	 *     string, row: string, overlay: string}, CLASSES: {selected: string}, ATTR: {id: string, name: string, htmlId:
	 *     string, usageKey: string, uid: string}}
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
				// Previously: 2025-09-01 17:09:
				// const value = (typeof val === 'object') ? JSON.stringify( val ) : val;
				//New:
				let value;
				if ( typeof val === 'object' && val !== null ) {
					try {
						value = JSON.stringify( val );
					} catch {
						value = '';
					}
				} else {
					value = val;
				}

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

}( window ));

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/_out/core/bfb-fields.js == | 2025-09-10 15:47
// ---------------------------------------------------------------------------------------------------------------------
(function ( w ) {
	'use strict';

	// Single global namespace (idempotent & load-order safe).
	const Core = ( w.WPBC_BFB_Core = w.WPBC_BFB_Core || {} );
	const UI   = ( Core.UI = Core.UI || {} );

	/**
	 * Base class for field renderers (static-only contract).
	 * ================================================================================================================
	 * Contract exposed to the builder (static methods on the CLASS itself):
	 *   - render(el, data, ctx)              // REQUIRED
	 *   - on_field_drop(data, el, meta)      // OPTIONAL (default provided)
	 *
	 * Helpers for subclasses:
	 *   - get_defaults()     -> per-field defaults (MUST override in subclass to set type/label)
	 *   - normalize_data(d)  -> shallow merge with defaults
	 *   - get_template(id)   -> per-id cached wp.template compiler
	 *
	 * Subclass usage:
	 *   class WPBC_BFB_Field_Text extends Core.WPBC_BFB_Field_Base { static get_defaults(){ ... } }
	 *   WPBC_BFB_Field_Text.template_id = 'wpbc-bfb-field-text';
	 * ================================================================================================================
	 */
	Core.WPBC_BFB_Field_Base = class {

		/**
		 * Default field data (generic baseline).
		 * Subclasses MUST override to provide { type, label } appropriate for the field.
		 * @returns {Object}
		 */
		static get_defaults() {
			return {
				type        : 'field',
				label       : 'Field',
				name        : 'field',
				html_id     : '',
				placeholder : '',
				required    : false,
				minlength   : '',
				maxlength   : '',
				pattern     : '',
				cssclass    : '',
				help        : ''
			};
		}

		/**
		 * Shallow-merge incoming data with defaults.
		 * @param {Object} data
		 * @returns {Object}
		 */
		static normalize_data( data ) {
			var d        = data || {};
			var defaults = this.get_defaults();
			var out      = {};
			var k;

			for ( k in defaults ) {
				if ( Object.prototype.hasOwnProperty.call( defaults, k ) ) {
					out[k] = defaults[k];
				}
			}
			for ( k in d ) {
				if ( Object.prototype.hasOwnProperty.call( d, k ) ) {
					out[k] = d[k];
				}
			}
			return out;
		}

		/**
		 * Compile and cache a wp.template by id (per-id cache).
		 * @param {string} template_id
		 * @returns {Function|null}
		 */
		static get_template(template_id) {

			// Accept either "wpbc-bfb-field-text" or "tmpl-wpbc-bfb-field-text".
			if ( ! template_id || ! window.wp || ! wp.template ) {
				return null;
			}
			const domId = template_id.startsWith( 'tmpl-' ) ? template_id : ('tmpl-' + template_id);
			if ( ! document.getElementById( domId ) ) {
				return null;
			}

			if ( ! Core.__bfb_tpl_cache_map ) {
				Core.__bfb_tpl_cache_map = {};
			}

			// Normalize id for the compiler & cache. // wp.template expects id WITHOUT the "tmpl-" prefix !
			const key = template_id.replace( /^tmpl-/, '' );
			if ( Core.__bfb_tpl_cache_map[key] ) {
				return Core.__bfb_tpl_cache_map[key];
			}

			const compiler = wp.template( key );     // <-- normalized id here
			if ( compiler ) {
				Core.__bfb_tpl_cache_map[key] = compiler;
			}

			return compiler;
		}

		/**
		 * REQUIRED: render preview into host element (full redraw; idempotent).
		 * Subclasses should set static `template_id` to a valid wp.template id.
		 * @param {HTMLElement} el
		 * @param {Object}      data
		 * @param {{mode?:string,builder?:any,tpl?:Function,sanit?:any}} ctx
		 * @returns {void}
		 */
		static render( el, data, ctx ) {
			if ( ! el ) {
				return;
			}

			var compile = this.get_template( this.template_id );
			var d       = this.normalize_data( data );

			var s = (ctx && ctx.sanit) ? ctx.sanit : Core.WPBC_BFB_Sanitize;

			// Sanitize critical attributes before templating.
			if ( s ) {
				d.html_id = d.html_id ? s.sanitize_html_id( String( d.html_id ) ) : '';
				d.name    = s.sanitize_html_name( String( d.name || d.id || 'field' ) );
			} else {
				d.html_id = d.html_id ? String( d.html_id ) : '';
				d.name    = String( d.name || d.id || 'field' );
			}

			// Fall back to generic preview if template not available.
			if ( compile ) {
				el.innerHTML = compile( d );

				// After render, set attribute values via DOM so quotes/newlines are handled correctly.
				const input = el.querySelector( 'input, textarea, select' );
				if ( input ) {
					if ( d.placeholder != null ) input.setAttribute( 'placeholder', String( d.placeholder ) );
					if ( d.title != null ) input.setAttribute( 'title', String( d.title ) );
				}

			} else {
				el.innerHTML = Core.WPBC_Form_Builder_Helper.render_field_inner_html( d );
			}

			el.dataset.type = d.type || 'field';
			el.setAttribute( 'data-label', (d.label != null ? String( d.label ) : '') ); // allow "".
		}


		/**
		 * OPTIONAL hook executed after field is dropped/loaded/preview.
		 * Default extended:
		 * - On first drop: stamp default label (existing behavior) and mark field as "fresh" for auto-name.
		 * - On load: mark as loaded so later label edits do not rename the saved name.
		 */
		static on_field_drop(data, el, meta) {

			const context = (meta && meta.context) ? String( meta.context ) : '';

			// -----------------------------------------------------------------------------------------
			// NEW: Seed default "help" (and keep it in Structure) for all field packs that define it.
			// This fixes the mismatch where:
			//   - UI shows default help via normalize_data() / templates
			//   - but get_structure() / exporters see `help` as undefined/empty.
			//
			// Behavior:
			//   - Runs ONLY on initial drop (context === 'drop').
			//   - If get_defaults() exposes a non-empty "help", and data.help is
			//     missing / null / empty string -> we persist the default into `data`
			//     and notify Structure so exports see it.
			//   - On "load" we do nothing, so existing forms where user *cleared*
			//     help will not be overridden.
			// -----------------------------------------------------------------------------------------
			if ( context === 'drop' && data ) {
				try {
					const defs = (typeof this.get_defaults === 'function') ? this.get_defaults() : null;
					if ( defs && Object.prototype.hasOwnProperty.call( defs, 'help' ) ) {
						const current    = Object.prototype.hasOwnProperty.call( data, 'help' ) ? data.help : undefined;
						const hasValue   = (current !== undefined && current !== null && String( current ) !== '');
						const defaultVal = defs.help;

						if ( ! hasValue && defaultVal != null && String( defaultVal ) !== '' ) {
							// 1) persist into data object (used by Structure).
							data.help = defaultVal;

							// 2) mirror into dataset (for any DOM-based consumers).
							if ( el ) {
								el.dataset.help = String( defaultVal );

								// 3) notify Structure / listeners (if available).
								try {
									Core.Structure?.update_field_prop?.( el, 'help', defaultVal );
									el.dispatchEvent(
										new CustomEvent( 'wpbc_bfb_field_data_changed', { bubbles: true, detail : { key: 'help', value: defaultVal } } )
									);
								} catch ( _inner ) {}
							}
						}
					}
				} catch ( _e ) {}
			}
			// -----------------------------------------------------------------------------------------

			if ( context === 'drop' && !Object.prototype.hasOwnProperty.call( data, 'label' ) ) {
				const defs = this.get_defaults();
				data.label = defs.label || 'Field';
				el.setAttribute( 'data-label', data.label );
			}
			// Mark provenance flags.
			if ( context === 'drop' ) {
				el.dataset.fresh      = '1';   // can auto-name on first label edit.
				el.dataset.autoname   = '1';
				el.dataset.was_loaded = '0';
				// Seed a provisional unique name immediately.
				try {
					const b = meta?.builder;
					if ( b?.id && (!el.hasAttribute( 'data-name' ) || !el.getAttribute( 'data-name' )) ) {
						const S    = Core.WPBC_BFB_Sanitize;
						const base = S.sanitize_html_name( el.getAttribute( 'data-id' ) || data?.id || data?.type || 'field' );
						const uniq = b.id.ensure_unique_field_name( base, el );
						el.setAttribute( 'data-name', uniq );
						el.dataset.name_user_touched = '0';
					}
				} catch ( _ ) {}

			} else if ( context === 'load' ) {
				el.dataset.fresh      = '0';
				el.dataset.autoname   = '0';
				el.dataset.was_loaded = '1';   // never rename names for loaded fields.
			}
		}

		// --- Auto Rename "Fresh" field,  on entering the new Label ---

		/**
		 * Create a conservative field "name" from a human label.
		 * Uses the same constraints as sanitize_html_name (letters/digits/_- and leading letter).
		 */
		static name_from_label(label) {
			const s = Core.WPBC_BFB_Sanitize.sanitize_html_name( String( label ?? '' ) );
			return s.toLowerCase() || 'field';
		}

		/**
		 * Auto-fill data-name from label ONLY for freshly dropped fields that were not edited yet.
		 * - Never runs for sections.
		 * - Never runs for loaded/existing fields.
		 * - Stops as soon as user edits the Name manually.
		 *
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} el  - .wpbc_bfb__field element
		 * @param {string} labelVal
		 */
		static maybe_autoname_from_label(builder, el, labelVal) {
			if ( !builder || !el ) return;
			if ( el.classList.contains( 'wpbc_bfb__section' ) ) return;

			const allowAuto = el.dataset.autoname === '1';

			const userTouched = el.dataset.name_user_touched === '1';
			const isLoaded    = el.dataset.was_loaded === '1';

			if ( !allowAuto || userTouched || isLoaded ) return;

			// Only override placeholder-y names
			const S = Core.WPBC_BFB_Sanitize;

			const base   = this.name_from_label( labelVal );
			const unique = builder.id.ensure_unique_field_name( base, el );
			el.setAttribute( 'data-name', unique );

			const ins      = document.getElementById( 'wpbc_bfb__inspector' );
			const nameCtrl = ins?.querySelector( '[data-inspector-key="name"]' );
			if ( nameCtrl && 'value' in nameCtrl && nameCtrl.value !== unique ) nameCtrl.value = unique;
		}


	};

	/**
	 * Select_Base (shared base for select-like packs)
	 *
	 * @type {Core.WPBC_BFB_Select_Base}
	 */
	Core.WPBC_BFB_Select_Base = class extends Core.WPBC_BFB_Field_Base {

		static template_id            = null;                 // main preview template id
		static option_row_template_id = 'wpbc-bfb-inspector-select-option-row'; // row tpl id
		static kind                   = 'select';
		static __root_wired           = false;
		static __root_node            = null;

		// Single source of selectors used by the inspector UI.
		static ui = {
			list   : '.wpbc_bfb__options_list',
			holder : '.wpbc_bfb__options_state[data-inspector-key="options"]',
			row    : '.wpbc_bfb__options_row',
			label  : '.wpbc_bfb__opt-label',
			value  : '.wpbc_bfb__opt-value',
			toggle : '.wpbc_bfb__opt-selected-chk',
			add_btn: '.js-add-option',

			drag_handle      : '.wpbc_bfb__drag-handle',
			multiple_chk     : '.js-opt-multiple[data-inspector-key="multiple"]',
			default_text     : '.js-default-value[data-inspector-key="default_value"]',
			placeholder_input: '.js-placeholder[data-inspector-key="placeholder"]',
			placeholder_note : '.js-placeholder-note',
			size_input       : '.inspector__input[data-inspector-key="size"]',

			// Dropdown menu integration.
			menu_root  : '.wpbc_ui_el__dropdown',
			menu_toggle: '[data-toggle="wpbc_dropdown"]',
			menu_action: '.ul_dropdown_menu_li_action[data-action]',
			// Value-differs toggle.
			value_differs_chk: '.js-value-differs[data-inspector-key="value_differs"]',
		};

		/**
		 * Build option value from label.
		 * - If `differs === true` -> generate token (slug-like machine value).
		 * - If `differs === false` -> keep human text; escape only dangerous chars.
		 * @param {string} label
		 * @param {boolean} differs
		 * @returns {string}
		 */
		static build_value_from_label(label, differs) {
			const S = Core.WPBC_BFB_Sanitize;
			if ( differs ) {
				return (S && typeof S.to_token === 'function')
					? S.to_token( String( label || '' ) )
					: String( label || '' ).trim().toLowerCase().replace( /\s+/g, '_' ).replace( /[^\w-]/g, '' );
			}
			// single-input mode: keep human text; template will escape safely.
			return String( label == null ? '' : label );
		}

		/**
		 * Is the “value differs from label” toggle enabled?
		 * @param {HTMLElement} panel
		 * @returns {boolean}
		 */
		static is_value_differs_enabled(panel) {
			const chk = panel?.querySelector( this.ui.value_differs_chk );
			return !!(chk && chk.checked);
		}

		/**
		 * Ensure visibility/enabled state of Value inputs based on the toggle.
		 * When disabled -> hide Value inputs and keep them mirrored from Label.
		 * @param {HTMLElement} panel
		 * @returns {void}
		 */
		static sync_value_inputs_visibility(panel) {
			const differs = this.is_value_differs_enabled( panel );
			const rows    = panel?.querySelectorAll( this.ui.row ) || [];

			for ( let i = 0; i < rows.length; i++ ) {
				const r      = rows[i];
				const lbl_in = r.querySelector( this.ui.label );
				const val_in = r.querySelector( this.ui.value );
				if ( !val_in ) continue;

				if ( differs ) {
					// Re-enable & show value input
					val_in.removeAttribute( 'disabled' );
					val_in.style.display = '';

					// If we have a cached custom value and the row wasn't edited while OFF, restore it
					const hasCache   = !!val_in.dataset.cached_value;
					const userEdited = r.dataset.value_user_touched === '1';

					if ( hasCache && !userEdited ) {
						val_in.value = val_in.dataset.cached_value;
					} else if ( !hasCache ) {
						// No cache: if value is just a mirrored label, offer a tokenized default
						const lbl      = lbl_in ? lbl_in.value : '';
						const mirrored = this.build_value_from_label( lbl, /*differs=*/false );
						if ( val_in.value === mirrored ) {
							val_in.value = this.build_value_from_label( lbl, /*differs=*/true );
						}
					}
				} else {
					// ON -> OFF: cache once, then mirror
					if ( !val_in.dataset.cached_value ) {
						val_in.dataset.cached_value = val_in.value || '';
					}
					const lbl    = lbl_in ? lbl_in.value : '';
					val_in.value = this.build_value_from_label( lbl, /*differs=*/false );

					val_in.setAttribute( 'disabled', 'disabled' );
					val_in.style.display = 'none';
					// NOTE: do NOT mark as user_touched here
				}
			}
		}


		/**
		 * Return whether this row’s value has been edited by user.
		 * @param {HTMLElement} row
		 * @returns {boolean}
		 */
		static is_row_value_user_touched(row) {
			return row?.dataset?.value_user_touched === '1';
		}

		/**
		 * Mark this row’s value as edited by user.
		 * @param {HTMLElement} row
		 */
		static mark_row_value_user_touched(row) {
			if ( row ) row.dataset.value_user_touched = '1';
		}

		/**
		 * Initialize “freshness” flags on a row (value untouched).
		 * Call on creation/append of rows.
		 * @param {HTMLElement} row
		 */
		static init_row_fresh_flags(row) {
			if ( row ) {
				if ( !row.dataset.value_user_touched ) {
					row.dataset.value_user_touched = '0';
				}
			}
		}

		// ---- defaults (packs can override) ----
		static get_defaults() {
			return {
				type         : this.kind,
				label        : 'Select',
				name         : '',
				html_id      : '',
				placeholder  : '--- Select ---',
				required     : false,
				multiple     : false,
				size         : null,
				cssclass     : '',
				help         : '',
				default_value: '',
				options      : [
					{ label: 'Option 1', value: 'Option 1', selected: false },
					{ label: 'Option 2', value: 'Option 2', selected: false },
					{ label: 'Option 3', value: 'Option 3', selected: false },
					{ label: 'Option 4', value: 'Option 4', selected: false }
				],
				min_width    : '240px'
			};
		}

		// ---- preview render (idempotent) ----
		static render(el, data, ctx) {
			if ( !el ) return;

			const d = this.normalize_data( data );

			if ( d.min_width != null ) {
				el.dataset.min_width = String( d.min_width );
				try {
					el.style.setProperty( '--wpbc-col-min', String( d.min_width ) );
				} catch ( _ ) {
				}
			}
			if ( d.html_id != null ) el.dataset.html_id = String( d.html_id || '' );
			if ( d.cssclass != null ) el.dataset.cssclass = String( d.cssclass || '' );
			if ( d.placeholder != null ) el.dataset.placeholder = String( d.placeholder || '' );

			const tpl = this.get_template( this.template_id );
			if ( typeof tpl !== 'function' ) {
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: ' + this.template_id + '.</div>';
				return;
			}

			try {
				el.innerHTML = tpl( d );
			} catch ( e ) {
				window._wpbc?.dev?.error?.( 'Select_Base.render', e );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering field preview.</div>';
				return;
			}

			el.dataset.type = d.type || this.kind;
			el.setAttribute( 'data-label', (d.label != null ? String( d.label ) : '') );

			try {
				Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
			} catch ( _ ) {
			}

			if ( !el.dataset.options && Array.isArray( d.options ) && d.options.length ) {
				try {
					el.dataset.options = JSON.stringify( d.options );
				} catch ( _ ) {
				}
			}
		}

		// ---- drop seeding (options + placeholder) ----
		static on_field_drop(data, el, meta) {
			try {
				super.on_field_drop?.( data, el, meta );
			} catch ( _ ) {
			}

			const is_drop = (meta && meta.context === 'drop');

			if ( is_drop ) {
				if ( !Array.isArray( data.options ) || !data.options.length ) {
					const opts   = (this.get_defaults().options || []).map( (o) => ({
						label   : o.label,
						value   : o.value,
						selected: !!o.selected
					}) );
					data.options = opts;
					try {
						el.dataset.options = JSON.stringify( opts );
						el.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', { bubbles: true,
							detail                                                                 : {
								key  : 'options',
								value: opts
							}
						} ) );
						Core.Structure?.update_field_prop?.( el, 'options', opts );
					} catch ( _ ) {
					}
				}

				const ph = (data.placeholder ?? '').toString().trim();
				if ( !ph ) {
					const dflt       = this.get_defaults().placeholder || '--- Select ---';
					data.placeholder = dflt;
					try {
						el.dataset.placeholder = String( dflt );
						el.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', { bubbles: true,
							detail                                                                 : {
								key  : 'placeholder',
								value: dflt
							}
						} ) );
						Core.Structure?.update_field_prop?.( el, 'placeholder', dflt );
					} catch ( _ ) {
					}
				}
			}
		}

		// ==============================
		// Inspector helpers (snake_case)
		// ==============================
		static get_panel_root(el) {
			return el?.closest?.( '.wpbc_bfb__inspector__body' ) || el?.closest?.( '.wpbc_bfb__inspector' ) || null;
		}

		static get_list(panel) {
			return panel ? panel.querySelector( this.ui.list ) : null;
		}

		static get_holder(panel) {
			return panel ? panel.querySelector( this.ui.holder ) : null;
		}

		static make_uid() {
			return 'wpbc_ins_auto_opt_' + Math.random().toString( 36 ).slice( 2, 10 );
		}

		static append_row(panel, data) {
			const list = this.get_list( panel );
			if ( !list ) return;

			const idx  = list.children.length;
			const rowd = Object.assign( { label: '', value: '', selected: false, index: idx }, (data || {}) );
			if ( !rowd.uid ) rowd.uid = this.make_uid();

			const tpl_id = this.option_row_template_id;
			const tpl    = (window.wp && wp.template) ? wp.template( tpl_id ) : null;
			const html   = tpl ? tpl( rowd ) : null;

			// In append_row() -> fallback HTML.
			const wrap     = document.createElement( 'div' );
			wrap.innerHTML = html || (
				'<div class="wpbc_bfb__options_row" data-index="' + (rowd.index || 0) + '">' +
					'<span class="wpbc_bfb__drag-handle"><span class="wpbc_icn_drag_indicator"></span></span>' +
					'<input type="text" class="wpbc_bfb__opt-label" placeholder="Label" value="' + (rowd.label || '') + '">' +
					'<input type="text" class="wpbc_bfb__opt-value" placeholder="Value" value="' + (rowd.value || '') + '">' +
					'<div class="wpbc_bfb__opt-selected">' +
						'<div class="inspector__control wpbc_ui__toggle">' +
							'<input type="checkbox" class="wpbc_bfb__opt-selected-chk inspector__input" id="' + rowd.uid + '" role="switch" ' + (rowd.selected ? 'checked aria-checked="true"' : 'aria-checked="false"') + '>' +
							'<label class="wpbc_ui__toggle_icon_radio" for="' + rowd.uid + '"></label>' +
							'<label class="wpbc_ui__toggle_label" for="' + rowd.uid + '">Default</label>' +
						'</div>' +
					'</div>' +
					// 3-dot dropdown (uses existing plugin dropdown JS).
					'<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown">' +
						'<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false" class="ul_dropdown_menu_toggle">' +
							'<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>' +
						'</a>' +
						'<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">' +
							'<li>' +
								'<a class="ul_dropdown_menu_li_action" data-action="add_after" href="javascript:void(0)">' +
									'Add New' +
									'<i class="menu_icon icon-1x wpbc_icn_add_circle"></i>' +
								'</a>' +
							'</li>' +
							'<li>' +
								'<a class="ul_dropdown_menu_li_action" data-action="duplicate" href="javascript:void(0)">' +
									'Duplicate' +
									'<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>' +
								'</a>' +
							'</li>' +
							'<li class="divider"></li>' +
							'<li>' +
								'<a class="ul_dropdown_menu_li_action" data-action="remove" href="javascript:void(0)">' +
									'Remove' +
									'<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>' +
								'</a>' +
							'</li>' +
						'</ul>' +
					'</div>' +
				'</div>'
			);

			const node = wrap.firstElementChild;
			 if (! node) {
				 return;
			 }
			// pre-hide Value input if toggle is OFF **before** appending.
			const differs = this.is_value_differs_enabled( panel );
			const valIn   = node.querySelector( this.ui.value );
			const lblIn   = node.querySelector( this.ui.label );

			if ( !differs && valIn ) {
				if ( !valIn.dataset.cached_value ) {
					valIn.dataset.cached_value = valIn.value || '';
				}
				if ( lblIn ) valIn.value = this.build_value_from_label( lblIn.value, false );
				valIn.setAttribute( 'disabled', 'disabled' );
				valIn.style.display = 'none';
			}


			this.init_row_fresh_flags( node );
			list.appendChild( node );

			// Keep your existing post-append sync as a safety net
			this.sync_value_inputs_visibility( panel );
		}

		static close_dropdown(anchor_el) {
			try {
				var root = anchor_el?.closest?.( this.ui.menu_root );
				if ( root ) {
					// If your dropdown toggler toggles a class like 'open', close it.
					root.classList.remove( 'open' );
					// Or if it relies on aria-expanded on the toggle.
					var t = root.querySelector( this.ui.menu_toggle );
					if ( t ) {
						t.setAttribute( 'aria-expanded', 'false' );
					}
				}
			} catch ( _ ) { }
		}

		static insert_after(new_node, ref_node) {
			if ( ref_node?.parentNode ) {
				if ( ref_node.nextSibling ) {
					ref_node.parentNode.insertBefore( new_node, ref_node.nextSibling );
				} else {
					ref_node.parentNode.appendChild( new_node );
				}
			}
		}

		static commit_options(panel) {
			const list   = this.get_list( panel );
			const holder = this.get_holder( panel );
			if ( !list || !holder ) return;

			const differs = this.is_value_differs_enabled( panel );

			const rows    = list.querySelectorAll( this.ui.row );
			const options = [];
			for ( let i = 0; i < rows.length; i++ ) {
				const r      = rows[i];
				const lbl_in = r.querySelector( this.ui.label );
				const val_in = r.querySelector( this.ui.value );
				const chk    = r.querySelector( this.ui.toggle );

				const lbl = (lbl_in && lbl_in.value) || '';
				let val   = (val_in && val_in.value) || '';

				// If single-input mode -> hard mirror to label.
				if ( ! differs ) {
					// single-input mode: mirror Label, minimal escaping (no slug).
					val = this.build_value_from_label( lbl, /*differs=*/false );
					if ( val_in ) {
						val_in.value = val;   // keep hidden input in sync for any previews/debug.
					}
				}

				const sel = !!(chk && chk.checked);
				options.push( { label: lbl, value: val, selected: sel } );
			}

			try {
				holder.value = JSON.stringify( options );
				holder.dispatchEvent( new Event( 'input', { bubbles: true } ) );
				holder.dispatchEvent( new Event( 'change', { bubbles: true } ) );
				panel.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', {
					bubbles: true, detail: {
						key: 'options', value: options
					}
				} ) );
			} catch ( _ ) {
			}

			this.sync_default_value_lock( panel );
			this.sync_placeholder_lock( panel );

			// Mirror to the selected field element so canvas/export sees current options immediately.
			const field = panel.__selectbase_field
				|| document.querySelector( '.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected' );
			if ( field ) {
				try {
					field.dataset.options = JSON.stringify( options );
				} catch ( _ ) {
				}
				Core.Structure?.update_field_prop?.( field, 'options', options );
				field.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', {
					bubbles: true, detail: { key: 'options', value: options }
				} ) );
			}
		}


		static ensure_sortable(panel) {

			const list = this.get_list( panel );
			if ( ! list ) {
				return;
			}

			try {
				const existing = window.Sortable?.get?.( list );
				if ( existing ) {
					return;
				}

				const builder = window.wpbc_bfb_api?.get_builder?.() || window.wpbc_bfb || null;

				// Prefer the shared Sortable manager so the sidebar list uses
				// the dedicated "simple_list" config instead of the canvas config.
				if ( builder && builder.sortable && typeof builder.sortable.ensure === 'function' ) {

					builder.sortable.ensure(
						list,
						'canvas',
						{
							sortable_kind     : 'simple_list',
							handle_selector   : this.ui.drag_handle,
							draggable_selector: this.ui.row,
							onUpdate          : () => {
								this.commit_options( panel );
							}
						}
					);

				} else if ( window.Sortable?.create ) {
					// Fallback if builder is not ready for some reason.
					window.Sortable.create(
						list,
						{
							handle           : this.ui.drag_handle,
							draggable        : this.ui.row,
							animation        : 120,
							forceFallback    : true,
							fallbackOnBody   : false,
							fallbackTolerance: 8,
							removeCloneOnHide: true,
							onUpdate         : () => {
								this.commit_options( panel );
							}
						}
					);
				}

				list.dataset.sortable_init = '1';

			} catch ( e ) {
				window._wpbc?.dev?.error?.( 'Select_Base.ensure_sortable', e );
			}
		}

		static rebuild_if_empty(panel) {
			const list   = this.get_list( panel );
			const holder = this.get_holder( panel );
			if ( !list || !holder || list.children.length ) return;

			let data = [];
			try {
				data = JSON.parse( holder.value || '[]' );
			} catch ( _ ) {
				data = [];
			}

			if ( !Array.isArray( data ) || !data.length ) {
				data = (this.get_defaults().options || []).slice( 0 );
				try {
					holder.value = JSON.stringify( data );
					holder.dispatchEvent( new Event( 'input', { bubbles: true } ) );
					holder.dispatchEvent( new Event( 'change', { bubbles: true } ) );
				} catch ( _ ) {
				}
			}

			for ( let i = 0; i < data.length; i++ ) {
				this.append_row( panel, {
					label   : data[i]?.label || '',
					value   : data[i]?.value || '',
					selected: !!data[i]?.selected,
					index   : i,
					uid     : this.make_uid()
				} );
			}

			this.sync_default_value_lock( panel );
			this.sync_placeholder_lock( panel );
			this.sync_value_inputs_visibility( panel );
		}

		static has_row_defaults(panel) {
			const checks = panel?.querySelectorAll( this.ui.toggle );
			if ( !checks?.length ) return false;
			for ( let i = 0; i < checks.length; i++ ) if ( checks[i].checked ) return true;
			return false;
		}

		static is_multiple_enabled(panel) {
			const chk = panel?.querySelector( this.ui.multiple_chk );
			return !!(chk && chk.checked);
		}

		static has_text_default_value(panel) {
			const dv = panel?.querySelector( this.ui.default_text );
			return !!(dv && String( dv.value || '' ).trim().length);
		}

		static sync_default_value_lock(panel) {
			const input = panel?.querySelector( this.ui.default_text );
			const note  = panel?.querySelector( '.js-default-value-note' );
			if ( !input ) return;

			const lock     = this.has_row_defaults( panel );
			input.disabled = !!lock;
			if ( lock ) {
				input.setAttribute( 'aria-disabled', 'true' );
				if ( note ) note.style.display = '';
			} else {
				input.removeAttribute( 'aria-disabled' );
				if ( note ) note.style.display = 'none';
			}
		}

		static sync_placeholder_lock(panel) {
			const input = panel?.querySelector( this.ui.placeholder_input );
			const note  = panel?.querySelector( this.ui.placeholder_note );

			// NEW: compute multiple and toggle row visibility
			const isMultiple     = this.is_multiple_enabled( panel );
			const placeholderRow = input?.closest( '.inspector__row' ) || null;
			const sizeInput      = panel?.querySelector( this.ui.size_input ) || null;
			const sizeRow        = sizeInput?.closest( '.inspector__row' ) || null;

			// Show placeholder only for single-select; show size only for multiple
			if ( placeholderRow ) placeholderRow.style.display = isMultiple ? 'none' : '';
			if ( sizeRow ) sizeRow.style.display = isMultiple ? '' : 'none';

			// Existing behavior (keep as-is)
			if ( !input ) return;

			const lock = isMultiple || this.has_row_defaults( panel ) || this.has_text_default_value( panel );
			if ( note && !note.id ) note.id = 'wpbc_placeholder_note_' + Math.random().toString( 36 ).slice( 2, 10 );

			input.disabled = !!lock;
			if ( lock ) {
				input.setAttribute( 'aria-disabled', 'true' );
				if ( note ) {
					note.style.display = '';
					input.setAttribute( 'aria-describedby', note.id );
				}
			} else {
				input.removeAttribute( 'aria-disabled' );
				input.removeAttribute( 'aria-describedby' );
				if ( note ) note.style.display = 'none';
			}
		}

		static enforce_single_default(panel, clicked) {
			if ( this.is_multiple_enabled( panel ) ) return;

			const checks = panel?.querySelectorAll( this.ui.toggle );
			if ( !checks?.length ) return;

			if ( clicked && clicked.checked ) {
				for ( let i = 0; i < checks.length; i++ ) if ( checks[i] !== clicked ) {
					checks[i].checked = false;
					checks[i].setAttribute( 'aria-checked', 'false' );
				}
				clicked.setAttribute( 'aria-checked', 'true' );
				return;
			}

			let kept = false;
			for ( let j = 0; j < checks.length; j++ ) if ( checks[j].checked ) {
				if ( !kept ) {
					kept = true;
				} else {
					checks[j].checked = false;
					checks[j].setAttribute( 'aria-checked', 'false' );
				}
			}

			this.sync_default_value_lock( panel );
			this.sync_placeholder_lock( panel );
		}

		// ---- one-time bootstrap of a panel ----
		static bootstrap_panel(panel) {
			if ( !panel ) return;
			if ( !panel.querySelector( '.wpbc_bfb__options_editor' ) ) return; // only select-like UIs
			if ( panel.dataset.selectbase_bootstrapped === '1' ) {
				this.ensure_sortable( panel );
				return;
			}

			this.rebuild_if_empty( panel );
			this.ensure_sortable( panel );
			panel.dataset.selectbase_bootstrapped = '1';

			this.sync_default_value_lock( panel );
			this.sync_placeholder_lock( panel );
			this.sync_value_inputs_visibility( panel );
		}

		// ---- hook into inspector lifecycle (fires ONCE) ----
		static wire_once() {
			if ( Core.__selectbase_wired ) return;
			Core.__selectbase_wired = true;

			const on_ready_or_render = (ev) => {
				const panel = ev?.detail?.panel;
				const field = ev?.detail?.el || ev?.detail?.field || null;
				if ( !panel ) return;
				if ( field ) panel.__selectbase_field = field;
				this.bootstrap_panel( panel );
				// If the inspector root was remounted, ensure root listeners are (re)bound.
				this.wire_root_listeners();
			};

			document.addEventListener( 'wpbc_bfb_inspector_ready', on_ready_or_render );
			document.addEventListener( 'wpbc_bfb_inspector_render', on_ready_or_render );

			this.wire_root_listeners();
		}

		static wire_root_listeners() {

			// If already wired AND the stored root is still in the DOM, bail out.
			if ( this.__root_wired && this.__root_node?.isConnected ) return;

			const root = document.getElementById( 'wpbc_bfb__inspector' );
			if ( !root ) {
				// Root missing (e.g., SPA re-render) — clear flags so we can wire later.
				this.__root_wired = false;
				this.__root_node  = null;
				return;
			}

			this.__root_node                   = root;
			this.__root_wired                  = true;
			root.dataset.selectbase_root_wired = '1';

			const get_panel = (target) =>
				target?.closest?.( '.wpbc_bfb__inspector__body' ) ||
				root.querySelector( '.wpbc_bfb__inspector__body' ) || null;

			// Click handlers: add / delete / duplicate
			root.addEventListener( 'click', (e) => {
				const panel = get_panel( e.target );
				if ( !panel ) return;

				this.bootstrap_panel( panel );

				const ui = this.ui;

				// Existing "Add option" button (top toolbar)
				const add = e.target.closest?.( ui.add_btn );
				if ( add ) {
					this.append_row( panel, { label: '', value: '', selected: false } );
					this.commit_options( panel );
					this.sync_value_inputs_visibility( panel );
					return;
				}

				// Dropdown menu actions.
				const menu_action = e.target.closest?.( ui.menu_action );
				if ( menu_action ) {
					e.preventDefault();
					e.stopPropagation();

					const action = (menu_action.getAttribute( 'data-action' ) || '').toLowerCase();
					const row    = menu_action.closest?.( ui.row );

					if ( !row ) {
						this.close_dropdown( menu_action );
						return;
					}

					if ( 'add_after' === action ) {
						// Add empty row after current
						const prev_count = this.get_list( panel )?.children.length || 0;
						this.append_row( panel, { label: '', value: '', selected: false } );
						// Move the newly added last row just after current row to preserve "add after"
						const list = this.get_list( panel );
						if ( list && list.lastElementChild && list.lastElementChild !== row ) {
							this.insert_after( list.lastElementChild, row );
						}
						this.commit_options( panel );
						this.sync_value_inputs_visibility( panel );
					} else if ( 'duplicate' === action ) {
						const lbl = (row.querySelector( ui.label ) || {}).value || '';
						const val = (row.querySelector( ui.value ) || {}).value || '';
						const sel = !!((row.querySelector( ui.toggle ) || {}).checked);
						this.append_row( panel, { label: lbl, value: val, selected: sel, uid: this.make_uid() } );
						// Place the new row right after the current.
						const list = this.get_list( panel );

						if ( list && list.lastElementChild && list.lastElementChild !== row ) {
							this.insert_after( list.lastElementChild, row );
						}
						this.enforce_single_default( panel, null );
						this.commit_options( panel );
						this.sync_value_inputs_visibility( panel );
					} else if ( 'remove' === action ) {
						if ( row && row.parentNode ) row.parentNode.removeChild( row );
						this.commit_options( panel );
						this.sync_value_inputs_visibility( panel );
					}

					this.close_dropdown( menu_action );
					return;
				}

			}, true );


			// Input delegation.
			root.addEventListener( 'input', (e) => {
				const panel = get_panel( e.target );
				if ( ! panel ) {
					return;
				}
				const ui                = this.ui;
				const is_label_or_value = e.target.classList?.contains( 'wpbc_bfb__opt-label' ) || e.target.classList?.contains( 'wpbc_bfb__opt-value' );
				const is_toggle         = e.target.classList?.contains( 'wpbc_bfb__opt-selected-chk' );
				const is_multiple       = e.target.matches?.( ui.multiple_chk );
				const is_default_text   = e.target.matches?.( ui.default_text );
				const is_value_differs  = e.target.matches?.( ui.value_differs_chk );

				// Handle "value differs" toggle live
				if ( is_value_differs ) {
					this.sync_value_inputs_visibility( panel );
					this.commit_options( panel );
					return;
				}

				// Track when the user edits VALUE explicitly
				if ( e.target.classList?.contains( 'wpbc_bfb__opt-value' ) ) {
					const row = e.target.closest( this.ui.row );
					this.mark_row_value_user_touched( row );
					// Keep the cache updated so toggling OFF/ON later restores the latest custom value
					e.target.dataset.cached_value = e.target.value || '';
				}

				// Auto-fill VALUE from LABEL if value is fresh (and differs is ON); if differs is OFF, we mirror anyway in commit
				if ( e.target.classList?.contains( 'wpbc_bfb__opt-label' ) ) {
					const row     = e.target.closest( ui.row );
					const val_in  = row?.querySelector( ui.value );
					const differs = this.is_value_differs_enabled( panel );

					if ( val_in ) {
						if ( !differs ) {
							// single-input mode: mirror human label with minimal escaping
							val_in.value = this.build_value_from_label( e.target.value, false );
						} else if ( !this.is_row_value_user_touched( row ) ) {
							// separate-value mode, only while fresh
							val_in.value = this.build_value_from_label( e.target.value, true );
						}
					}
				}


				if ( is_label_or_value || is_toggle || is_multiple ) {
					if ( is_toggle ) e.target.setAttribute( 'aria-checked', e.target.checked ? 'true' : 'false' );
					if ( is_toggle || is_multiple ) this.enforce_single_default( panel, is_toggle ? e.target : null );
					this.commit_options( panel );
				}

				if ( is_default_text ) {
					this.sync_default_value_lock( panel );
					this.sync_placeholder_lock( panel );
					const holder = this.get_holder( panel );
					if ( holder ) {
						holder.dispatchEvent( new Event( 'input', { bubbles: true } ) );
						holder.dispatchEvent( new Event( 'change', { bubbles: true } ) );
					}
				}
			}, true );


			// Change delegation
			root.addEventListener( 'change', (e) => {
				const panel = get_panel( e.target );
				if ( !panel ) return;

				const ui        = this.ui;
				const is_toggle = e.target.classList?.contains( 'wpbc_bfb__opt-selected-chk' );
				const is_multi  = e.target.matches?.( ui.multiple_chk );
				if ( !is_toggle && !is_multi ) return;

				if ( is_toggle ) e.target.setAttribute( 'aria-checked', e.target.checked ? 'true' : 'false' );
				this.enforce_single_default( panel, is_toggle ? e.target : null );
				this.commit_options( panel );
			}, true );

			// Lazy bootstrap
			root.addEventListener( 'mouseenter', (e) => {
				const panel = get_panel( e.target );
				if ( panel && e.target?.closest?.( this.ui.list ) ) this.bootstrap_panel( panel );
			}, true );

			root.addEventListener( 'mousedown', (e) => {
				const panel = get_panel( e.target );
				if ( panel && e.target?.closest?.( this.ui.drag_handle ) ) this.bootstrap_panel( panel );
			}, true );
		}

	};

	try { Core.WPBC_BFB_Select_Base.wire_once(); } catch (_) {}
	// Try immediately (if root is already in DOM), then again on DOMContentLoaded.
	Core.WPBC_BFB_Select_Base.wire_root_listeners();

	document.addEventListener('DOMContentLoaded', () => { Core.WPBC_BFB_Select_Base.wire_root_listeners();  });

}( window ));
// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/_out/core/bfb-ui.js == | 2025-09-10 15:47
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
	'use strict';

	// Single global namespace (idempotent & load-order safe).
	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});

	// --- Highlight Element,  like Generator brn  -  Tiny UI helpers ------------------------------------
	UI._pulse_timers = UI._pulse_timers || new Map(); // el -> timer_id
	UI._pulse_meta   = UI._pulse_meta   || new Map(); // el -> { token, last_ts, debounce_id, color_set }
	// Pulse tuning (milliseconds).
	UI.PULSE_THROTTLE_MS  = Number.isFinite( UI.PULSE_THROTTLE_MS ) ? UI.PULSE_THROTTLE_MS : 500;
	UI.PULSE_DEBOUNCE_MS  = Number.isFinite( UI.PULSE_DEBOUNCE_MS ) ? UI.PULSE_DEBOUNCE_MS : 750;

	// Debounce STRUCTURE_CHANGE for continuous inspector controls (sliders / scrubbing).
	// Tune: 180..350 is usually a sweet spot.
	UI.STRUCTURE_CHANGE_DEBOUNCE_MS = Number.isFinite( UI.STRUCTURE_CHANGE_DEBOUNCE_MS ) ? UI.STRUCTURE_CHANGE_DEBOUNCE_MS : 180;
	// Change this to tune speed: 50..120 ms is a good range. Can be configured in <div data-len-group data-len-throttle="180">...</div>.
	UI.VALUE_SLIDER_THROTTLE_MS = Number.isFinite( UI.VALUE_SLIDER_THROTTLE_MS ) ? UI.VALUE_SLIDER_THROTTLE_MS : 120;

	/**
	 * Cancel any running pulse sequence for an element.
	 * Uses token invalidation so already-scheduled callbacks become no-ops.
	 *
	 * @param {HTMLElement} el
	 */
	UI.cancel_pulse = function (el) {
		if ( !el ) { return; }
		try {
			clearTimeout( UI._pulse_timers.get( el ) );
		} catch ( _ ) {}
		UI._pulse_timers.delete( el );

		var meta = UI._pulse_meta.get( el ) || {};
		meta.token = (Number.isFinite( meta.token ) ? meta.token : 0) + 1;
		meta.color_set = false;
		try { el.classList.remove( 'wpbc_bfb__scroll-pulse', 'wpbc_bfb__highlight-pulse' ); } catch ( _ ) {}
		try { el.style.removeProperty( '--wpbc-bfb-pulse-color' ); } catch ( _ ) {}
		UI._pulse_meta.set( el, meta );
		try { clearTimeout( meta.debounce_id ); } catch ( _ ) {}
		meta.debounce_id = 0;
	};

	/**
	 * Force-restart a CSS animation on a class.
	 * @param {HTMLElement} el
	 * @param {string} cls
	 */
	UI._restart_css_animation = function (el, cls) {
		if ( ! el ) { return; }
		try {
			el.classList.remove( cls );
		} catch ( _ ) {}
		// Force reflow so the next add() retriggers the keyframes.
		void el.offsetWidth;
		try {
			el.classList.add( cls );
		} catch ( _ ) {}
	};

	/**
		Single pulse (back-compat).
		@param {HTMLElement} el
		@param {number} dur_ms
	 */
	UI.pulse_once = function (el, dur_ms) {
		if ( ! el ) { return; }
		var cls = 'wpbc_bfb__scroll-pulse';
		var ms  = Number.isFinite( dur_ms ) ? dur_ms : 700;

		UI.cancel_pulse( el );

		var meta  = UI._pulse_meta.get( el ) || {};
		var token = (Number.isFinite( meta.token ) ? meta.token : 0) + 1;
		meta.token = token;
		UI._pulse_meta.set( el, meta );

		UI._restart_css_animation( el, cls );
		var t = setTimeout( function () {
			// ignore if a newer pulse started.
			var m = UI._pulse_meta.get( el ) || {};
			if ( m.token !== token ) { return; }
			try {
				el.classList.remove( cls );
			} catch ( _ ) {}
			UI._pulse_timers.delete( el );
		}, ms );
		UI._pulse_timers.set( el, t );
	};

	/**
		Multi-blink sequence with optional per-call color override.
		@param {HTMLElement} el
		@param {number} [times=3]
		@param {number} [on_ms=280]
		@param {number} [off_ms=180]
		@param {string} [hex_color] Optional CSS color (e.g. '#ff4d4f' or 'rgb(...)').
	 */
	UI.pulse_sequence = function (el, times, on_ms, off_ms, hex_color) {
		if ( !el || !d.body.contains( el ) ) {
			return;
		}
		var cls   = 'wpbc_bfb__highlight-pulse';
		var count = Number.isFinite( times ) ? times : 2;
		var on    = Number.isFinite( on_ms ) ? on_ms : 280;
		var off   = Number.isFinite( off_ms ) ? off_ms : 180;

		// Throttle: avoid reflow spam if called repeatedly while typing/dragging.
		var meta = UI._pulse_meta.get( el ) || {};
		var now  = Date.now();
		var throttle_ms = Number.isFinite( UI.PULSE_THROTTLE_MS ) ? UI.PULSE_THROTTLE_MS : 120;
		if ( Number.isFinite( meta.last_ts ) && (now - meta.last_ts) < throttle_ms ) {
			return;
		}
		meta.last_ts = now;

		// cancel any running pulse and reset class (token invalidation).
		UI.cancel_pulse( el );

		// new token for this run
		var token = (Number.isFinite( meta.token ) ? meta.token : 0) + 1;
		meta.token = token;

		var have_color = !!hex_color && typeof hex_color === 'string';
		if ( have_color ) {
			try {
				el.style.setProperty( '--wpbc-bfb-pulse-color', hex_color );
			} catch ( _ ) {}
			meta.color_set = true;
		}
		UI._pulse_meta.set( el, meta );

		var i = 0;
		(function tick() {
			var m = UI._pulse_meta.get( el ) || {};
			if ( m.token !== token ) {
				// canceled/replaced
				return;
			}
			if ( i >= count ) {
				UI._pulse_timers.delete( el );
				if ( have_color ) {
					try {
						el.style.removeProperty( '--wpbc-bfb-pulse-color' );
					} catch ( _ ) {}
				}
				return;
			}
			UI._restart_css_animation( el, cls );
			UI._pulse_timers.set( el, setTimeout( function () {     // ON -> OFF
				var m2 = UI._pulse_meta.get( el ) || {};
				if ( m2.token !== token ) { return; }
				try {
					el.classList.remove( cls );
				} catch ( _ ) {
				}
				UI._pulse_timers.set( el, setTimeout( function () { // OFF gap -> next
					var m3 = UI._pulse_meta.get( el ) || {};
					if ( m3.token !== token ) { return; }
					i++;
					tick();
				}, off ) );
			}, on ) );
		})();
	};


	/**
	 * Debounced query + pulse.
	 * Useful for `input` events (sliders / typing) to avoid forced reflow spam.
	 *
	 * @param {HTMLElement|string} root_or_selector
	 * @param {string} selector
	 * @param {number} wait_ms
	 * @param {number} [a]
	 * @param {number} [b]
	 * @param {number} [c]
	 * @param {string} [color]
	 */
	UI.pulse_query_debounced = function (root_or_selector, selector, wait_ms, a, b, c, color) {
		var root = (typeof root_or_selector === 'string') ? d : (root_or_selector || d);
		var sel  = (typeof root_or_selector === 'string') ? root_or_selector : selector;
		if ( !sel ) { return; }
		var el = root.querySelector( sel );
		if ( !el ) { return; }

		var def_ms = Number.isFinite( UI.PULSE_DEBOUNCE_MS ) ? UI.PULSE_DEBOUNCE_MS : 120;
		var ms     = Number.isFinite( wait_ms ) ? wait_ms : def_ms;
		var meta = UI._pulse_meta.get( el ) || {};
		try { clearTimeout( meta.debounce_id ); } catch ( _ ) {}
		meta.debounce_id = setTimeout( function () {
			UI.pulse_sequence( el, a, b, c, color );
		}, ms );
		UI._pulse_meta.set( el, meta );
	};

	/**
		Query + pulse:
		(BC) If only 3rd arg is a number and no 4th/5th -> single long pulse.
		Otherwise -> strong sequence (defaults 3×280/180).
		Optional 6th arg: color.
		@param {HTMLElement|string} root_or_selector
		@param {string} [selector]
		@param {number} [a]
		@param {number} [b]

		@param {number} [c]

		@param {string} [color]
	 */
	UI.pulse_query = function (root_or_selector, selector, a, b, c, color) {
		var root = (typeof root_or_selector === 'string') ? d : (root_or_selector || d);
		var sel  = (typeof root_or_selector === 'string') ? root_or_selector : selector;
		if ( !sel ) {
			return;
		}

		var el = root.querySelector( sel );
		if ( !el ) {
			return;
		}

// Back-compat: UI.pulseQuery(root, sel, dur_ms)
		if ( Number.isFinite( a ) && b === undefined && c === undefined ) {
			return UI.pulse_once( el, a );
		}
// New: sequence; params optional; supports optional color.
		UI.pulse_sequence( el, a, b, c, color );
	};

	/**
	Convenience helper (snake_case) to call a strong pulse with options.

	@param {HTMLElement} el

	@param {Object} [opts]

	@param {number} [opts.times=3]

	@param {number} [opts.on_ms=280]

	@param {number} [opts.off_ms=180]

	@param {string} [opts.color]
	 */
	UI.pulse_sequence_strong = function (el, opts) {
		opts = opts || {};
		UI.pulse_sequence(
			el,
			Number.isFinite( opts.times ) ? opts.times : 3,
			Number.isFinite( opts.on_ms ) ? opts.on_ms : 280,
			Number.isFinite( opts.off_ms ) ? opts.off_ms : 180,
			opts.color
		);
	};


	/**
	 * Base class for BFB modules.
	 */
	UI.WPBC_BFB_Module = class {
		/** @param {WPBC_Form_Builder} builder */
		constructor(builder) {
			this.builder = builder;
		}

		/** Initialize the module. */
		init() {
		}

		/** Cleanup the module. */
		destroy() {
		}
	};

	/**
	 * Central overlay/controls manager for fields/sections.
	 * Pure UI composition; all actions route back into the builder instance.
	 */
	UI.WPBC_BFB_Overlay = class {

		/**
		 * Synchronize every overlay settings button with the real Inspector state.
		 *
		 * A selected canvas item can remain selected while another right-bar panel is
		 * visible. Combining both states prevents a stale pressed button after the
		 * administrator switches away from the Inspector.
		 *
		 * @param {WPBC_Form_Builder} builder - Active Form Builder instance.
		 * @param {HTMLButtonElement[]|NodeListOf<HTMLButtonElement>|null} [settings_buttons=null]
		 *     Optional bounded controls to reconcile during incremental rendering.
		 * @returns {void}
		 */
		static sync_settings_button_states(builder, settings_buttons = null) {

			const pages_container = builder?.pages_container;
			if ( !pages_container?.querySelectorAll ) {
				return;
			}

			const inspector         = document.getElementById( 'wpbc_bfb__inspector' );
			const inspector_is_open = !!inspector
				&& !inspector.hasAttribute( 'hidden' )
				&& inspector.getAttribute( 'aria-hidden' ) !== 'true';
			const selectable_query  = `${Core.WPBC_BFB_DOM.SELECTORS.field}, ${Core.WPBC_BFB_DOM.SELECTORS.section}`;

			const buttons = settings_buttons || pages_container.querySelectorAll( '.wpbc_bfb__settings-btn' );

			Array.from( buttons ).forEach( (settings_button) => {
				const owner      = settings_button.closest( selectable_query );
				const is_pressed = inspector_is_open
					&& !!owner?.classList?.contains( Core.WPBC_BFB_DOM.CLASSES.selected );

				settings_button.setAttribute( 'aria-pressed', is_pressed ? 'true' : 'false' );
			} );
		}

		/**
		 * Ensure an overlay exists and is wired up on the element.
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} el - field or section element
		 */
		static ensure(builder, el) {

			if ( !el ) {
				return;
			}
			const isSection = el.classList.contains( 'wpbc_bfb__section' );

			// let overlay = el.querySelector( Core.WPBC_BFB_DOM.SELECTORS.overlay );
			let overlay = el.querySelector( `:scope > ${Core.WPBC_BFB_DOM.SELECTORS.overlay}` );
			if ( !overlay ) {
				overlay = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__overlay-controls' );
				el.prepend( overlay );
			}

			// Drag handle.
			if ( !overlay.querySelector( '.wpbc_bfb__drag-handle' ) ) {
				const dragClass = isSection ? 'wpbc_bfb__drag-handle section-drag-handle' : 'wpbc_bfb__drag-handle';
				overlay.appendChild(
					Core.WPBC_Form_Builder_Helper.create_element( 'span', dragClass, '<span class="wpbc_icn_drag_indicator"></span>' )
				);
			}

			// SETTINGS button (shown for both fields & sections).
			let settings_btn = overlay.querySelector( '.wpbc_bfb__settings-btn' );
			if ( !settings_btn ) {
				settings_btn         = Core.WPBC_Form_Builder_Helper.create_element( 'button', 'wpbc_bfb__settings-btn', '<i class="menu_icon icon-1x wpbc_icn_near_me wpbc_icn_rotate_270"></i>' );
				settings_btn.type    = 'button';
				settings_btn.title   = 'Open settings';
				settings_btn.setAttribute( 'aria-label', settings_btn.title );
				settings_btn.setAttribute( 'aria-controls', 'wpbc_bfb__inspector' );
				settings_btn.setAttribute( 'aria-pressed', 'false' );
				settings_btn.onclick = (e) => {
					e.preventDefault();
					// Select THIS element and scroll it into view.
					builder.select_field( el, { scrollIntoView: true } );

					// Auto-open Inspector from the overlay “Settings” button.
					wpbc_bfb__dispatch_event_safe(
						'wpbc_bfb:show_panel',
						{
							panel_id: 'wpbc_bfb__inspector',
							tab_id  : 'wpbc_tab_inspector'
						}
					);

					// Try to bring the inspector into view / focus first input.
					const ins = document.getElementById( 'wpbc_bfb__inspector' );
					if ( ins ) {
						ins.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
						// Focus first interactive control (best-effort).
						setTimeout( () => {
							const focusable = ins.querySelector( 'input,select,textarea,button,[contenteditable],[tabindex]:not([tabindex="-1"])' );
							focusable?.focus?.();
						}, 260 );
					}
				};

				overlay.appendChild( settings_btn );
			}

			overlay.setAttribute( 'role', 'toolbar' );
			overlay.setAttribute( 'aria-label', el.classList.contains( 'wpbc_bfb__section' ) ? 'Section tools' : 'Field tools' );
			UI.WPBC_BFB_Overlay.sync_settings_button_states( builder, [ settings_btn ] );

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
			const v = getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0';
			const n = parseFloat( v );
			return Number.isFinite( n ) ? Math.max( 0, n ) : 0;
		}

		/**
		 * Turn raw weights (e.g. [1,1], [2,1,1]) into effective "available-%" bases that
		 * (a) sum to the row's available %, and (b) meet every column's min px.
		 * Returns an array of bases (numbers) or null if impossible to satisfy mins.
		 */
		static _fit_weights_respecting_min(builder, row, weights) {
			const cols = Array.from( row.querySelectorAll( ':scope > .wpbc_bfb__column' ) );
			const n    = cols.length;
			if ( !n ) return null;
			if ( !Array.isArray( weights ) || weights.length !== n ) return null;

			// available % after gaps (from LayoutService)
			const gp       = builder.col_gap_percent;
			const eff      = builder.layout.compute_effective_bases_from_row( row, gp );
			const availPct = eff.available;               // e.g. 94 if 2 cols and 3% gap
			const rowPx    = row.getBoundingClientRect().width;
			const availPx  = rowPx * (availPct / 100);

			// collect minima in % of "available"
			const minPct = cols.map( (c) => {
				const minPx = UI.WPBC_BFB_Layout_Chips._get_col_min_px( c );
				if ( availPx <= 0 ) return 0;
				return (minPx / availPx) * availPct;
			} );

			// If mins alone don't fit, bail.
			const sumMin = minPct.reduce( (a, b) => a + b, 0 );
			if ( sumMin > availPct - 1e-6 ) {
				return null; // impossible to respect mins; don't apply preset
			}

			// Target percentages from weights, normalized to availPct.
			const wSum      = weights.reduce( (a, w) => a + (Number( w ) || 0), 0 ) || n;
			const targetPct = weights.map( (w) => ((Number( w ) || 0) / wSum) * availPct );

			// Lock columns that would be below min, then distribute the remainder
			// across the remaining columns proportionally to their targetPct.
			const locked  = new Array( n ).fill( false );
			let lockedSum = 0;
			for ( let i = 0; i < n; i++ ) {
				if ( targetPct[i] < minPct[i] ) {
					locked[i] = true;
					lockedSum += minPct[i];
				}
			}

			let remaining     = availPct - lockedSum;
			const freeIdx     = [];
			let freeTargetSum = 0;
			for ( let i = 0; i < n; i++ ) {
				if ( !locked[i] ) {
					freeIdx.push( i );
					freeTargetSum += targetPct[i];
				}
			}

			const result = new Array( n ).fill( 0 );
			// Seed locked with their minima.
			for ( let i = 0; i < n; i++ ) {
				if ( locked[i] ) result[i] = minPct[i];
			}

			if ( freeIdx.length === 0 ) {
				// everything locked exactly at min; any leftover (shouldn't happen)
				// would be ignored to keep simplicity and stability.
				return result;
			}

			if ( remaining <= 0 ) {
				// nothing left to distribute; keep exactly mins on locked,
				// nothing for free (degenerate but consistent)
				return result;
			}

			if ( freeTargetSum <= 0 ) {
				// distribute equally among free columns
				const each = remaining / freeIdx.length;
				freeIdx.forEach( (i) => (result[i] = each) );
				return result;
			}

			// Distribute remaining proportionally to free columns' targetPct
			freeIdx.forEach( (i) => {
				result[i] = remaining * (targetPct[i] / freeTargetSum);
			} );
			return result;
		}

		/** Apply a preset but guard it by minima; returns true if applied, false if skipped. */
		static _apply_preset_with_min_guard(builder, section_el, weights) {
			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );
			if ( !row ) return false;

			const fitted = UI.WPBC_BFB_Layout_Chips._fit_weights_respecting_min( builder, row, weights );
			if ( !fitted ) {
				builder?._announce?.( 'Not enough space for this layout because of fields’ minimum widths.' );
				return false;
			}

			// `fitted` already sums to the row’s available %, so we can apply bases directly.
			builder.layout.apply_bases_to_row( row, fitted );
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

			if ( !builder || !section_el || !host_el ) {
				return;
			}

			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );
			if ( !row ) {
				return;
			}

			const cols = row.querySelectorAll( ':scope > .wpbc_bfb__column' ).length || 1;

			// Clear host.
			host_el.innerHTML = '';

			// Equal chip.
			host_el.appendChild(
				UI.WPBC_BFB_Layout_Chips._make_chip( builder, section_el, Array( cols ).fill( 1 ), 'Equal' )
			);

			// Presets based on column count.
			const presets = builder.layout.build_presets_for_columns( cols );
			presets.forEach( (weights) => {
				host_el.appendChild(
					UI.WPBC_BFB_Layout_Chips._make_chip( builder, section_el, weights, null )
				);
			} );

			// Custom chip.
			const customBtn       = document.createElement( 'button' );
			customBtn.type        = 'button';
			customBtn.className   = 'wpbc_bfb__layout_chip';
			customBtn.textContent = 'Custom…';
			customBtn.title       = `Enter ${cols} percentages`;
			customBtn.addEventListener( 'click', () => {
				const example = (cols === 2) ? '50,50' : (cols === 3 ? '20,60,20' : '25,25,25,25');
				const text    = prompt( `Enter ${cols} percentages (comma or space separated):`, example );
				if ( text == null ) return;
				const weights = builder.layout.parse_weights( text );
				if ( weights.length !== cols ) {
					alert( `Please enter exactly ${cols} numbers.` );
					return;
				}
				// OLD:
				// builder.layout.apply_layout_preset( section_el, weights, builder.col_gap_percent );
				// Guarded apply:.
				if ( !UI.WPBC_BFB_Layout_Chips._apply_preset_with_min_guard( builder, section_el, weights ) ) {
					return;
				}
				host_el.querySelectorAll( '.wpbc_bfb__layout_chip' ).forEach( c => c.classList.remove( 'is-active' ) );
				customBtn.classList.add( 'is-active' );
			} );
			host_el.appendChild( customBtn );
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

			const btn     = document.createElement( 'button' );
			btn.type      = 'button';
			btn.className = 'wpbc_bfb__layout_chip';

			const title = label || builder.layout.format_preset_label( weights );
			btn.title   = title;

			// Visual miniature.
			const vis     = document.createElement( 'div' );
			vis.className = 'wpbc_bfb__layout_chip-vis';
			const sum     = weights.reduce( (a, b) => a + (Number( b ) || 0), 0 ) || 1;
			weights.forEach( (w) => {
				const bar      = document.createElement( 'span' );
				bar.style.flex = `0 0 calc( ${((Number( w ) || 0) / sum * 100).toFixed( 3 )}% - 1.5px )`;
				vis.appendChild( bar );
			} );
			btn.appendChild( vis );

			const txt       = document.createElement( 'span' );
			txt.className   = 'wpbc_bfb__layout_chip-label';
			txt.textContent = label || builder.layout.format_preset_label( weights );
			btn.appendChild( txt );

			btn.addEventListener( 'click', () => {
				// OLD:
				// builder.layout.apply_layout_preset( section_el, weights, builder.col_gap_percent );

				// NEW:
				if ( !UI.WPBC_BFB_Layout_Chips._apply_preset_with_min_guard( builder, section_el, weights ) ) {
					return; // do not toggle active if we didn't change layout
				}

				btn.parentElement?.querySelectorAll( '.wpbc_bfb__layout_chip' ).forEach( c => c.classList.remove( 'is-active' ) );
				btn.classList.add( 'is-active' );
			} );

			return btn;
		}
	};

	/**
	 * Selection controller for fields and announcements.
	 */
	UI.WPBC_BFB_Selection_Controller = class extends UI.WPBC_BFB_Module {

		init() {

			this._selected_uid              = null;
			this.builder.select_field       = this.select_field.bind( this );
			this.builder.get_selected_field = this.get_selected_field.bind( this );
			this._on_clear                  = this.on_clear.bind( this );
			this._on_panel_shown            = this._sync_settings_button_states.bind( this );

			// Centralized delete command used by keyboard + inspector + overlay.
			this.builder.delete_item = (el) => {
				if ( !el ) {
					return null;
				}
				const b        = this.builder;
				const neighbor = b._find_neighbor_selectable?.( el ) || null;
				el.remove();
				// Use local Core constants (not a global) to avoid ReferenceErrors.
				b.bus?.emit?.( Core.WPBC_BFB_Events.FIELD_REMOVE, { el, id: el?.dataset?.id, uid: el?.dataset?.uid } );
				b.usage?.update_palette_ui?.();
				// Notify generic structure listeners, too:
				b.bus?.emit?.( Core.WPBC_BFB_Events.STRUCTURE_CHANGE, { reason: 'delete', el } );
				// Defer selection a tick so the DOM is fully settled before Inspector hydrates.
				requestAnimationFrame( () => {
					// This calls inspector.bind_to_field() and opens the Inspector panel.
					b.select_field?.( neighbor || null, { scrollIntoView: !!neighbor } );
				} );
				return neighbor;
			};
			this.builder.bus.on( Core.WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear );
			this.builder.bus.on( Core.WPBC_BFB_Events.STRUCTURE_LOADED, this._on_clear );
			// delegated click selection (capture ensures we win before bubbling to containers).
			this._on_canvas_click = this._handle_canvas_click.bind( this );
			this.builder.pages_container.addEventListener( 'click', this._on_canvas_click, true );
			document.addEventListener( 'wpbc_bfb:panel_shown', this._on_panel_shown );
			this._sync_settings_button_states();
		}

		destroy() {
			this.builder.bus.off( Core.WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear );

			if ( this._on_canvas_click ) {
				this.builder.pages_container.removeEventListener( 'click', this._on_canvas_click, true );
				this._on_canvas_click = null;
			}

			if ( this._on_panel_shown ) {
				document.removeEventListener( 'wpbc_bfb:panel_shown', this._on_panel_shown );
				this._on_panel_shown = null;
			}
		}

		/**
		 * Refresh overlay button state after selection or right-bar panel changes.
		 *
		 * @returns {void}
		 */
		_sync_settings_button_states() {
			UI.WPBC_BFB_Overlay.sync_settings_button_states( this.builder );
		}

		/**
		 * Delegated canvas click -> select closest field/section (inner beats outer).
		 * @private
		 * @param {MouseEvent} e
		 */
		_handle_canvas_click(e) {
			const root = this.builder.pages_container;
			if ( !root ) return;

			// Ignore clicks on controls/handles/resizers, etc.
			const IGNORE = [
				'.wpbc_bfb__overlay-controls',
				'.wpbc_bfb__layout_picker',
				'.wpbc_bfb__drag-handle',
				'.wpbc_bfb__field-remove-btn',
				'.wpbc_bfb__field-move-up',
				'.wpbc_bfb__field-move-down',
				'.wpbc_bfb__column-resizer'
			].join( ',' );

			if ( e.target.closest( IGNORE ) ) {
				return; // let those controls do their own thing.
			}

			// Find the closest selectable (field OR section) from the click target.
			let hit = e.target.closest?.(
				`${Core.WPBC_BFB_DOM.SELECTORS.validField}, ${Core.WPBC_BFB_DOM.SELECTORS.section}, .wpbc_bfb__column`
			);

			if ( !hit || !root.contains( hit ) ) {
				this.select_field( null );           // Clear selection on blank click.
				return;                              // Empty space is handled elsewhere.
			}

			// NEW: if user clicked a COLUMN -> remember tab key on its SECTION, but still select the section.
			let preselect_tab_key = null;
			if ( hit.classList.contains( 'wpbc_bfb__column' ) ) {
				const row  = hit.closest( '.wpbc_bfb__row' );
				const cols = row ? Array.from( row.querySelectorAll( ':scope > .wpbc_bfb__column' ) ) : [];
				const idx  = Math.max( 0, cols.indexOf( hit ) );
				const sec  = hit.closest( '.wpbc_bfb__section' );
				if ( sec ) {
					preselect_tab_key = String( idx + 1 );              // tabs are 1-based in ui-column-styles.js
					// Hint for the renderer (it reads this BEFORE rendering and restores the tab).
					sec.dataset.col_styles_active_tab = preselect_tab_key;
					// promote selection to the section (same UX as before).
					hit                               = sec;
					// NEW: visually mark which column is being edited
					if ( UI && UI.WPBC_BFB_Column_Styles && UI.WPBC_BFB_Column_Styles.set_selected_col_flag ) {
						UI.WPBC_BFB_Column_Styles.set_selected_col_flag( sec, preselect_tab_key );
					}
				}
			}

			// Select and stop bubbling so outer containers don’t reselect a parent.
			this.select_field( hit );
			e.stopPropagation();

			// Also set the tab after the inspector renders (works even if it was already open).
			if ( preselect_tab_key ) {
				(window.requestAnimationFrame || setTimeout)( function () {
					try {
						const ins  = document.getElementById( 'wpbc_bfb__inspector' );
						const tabs = ins && ins.querySelector( '[data-bfb-slot="column_styles"] [data-wpbc-tabs]' );
						if ( tabs && window.wpbc_ui_tabs && typeof window.wpbc_ui_tabs.set_active === 'function' ) {
							window.wpbc_ui_tabs.set_active( tabs, preselect_tab_key );
						}
					} catch ( _e ) {
					}
				}, 0 );

				// Politely ask the Inspector to focus/open the "Column Styles" group and tab.
				wpbc_bfb__dispatch_event_safe(
					'wpbc_bfb:inspector_focus',
					{
						group  : 'column_styles',
						tab_key: preselect_tab_key
					}
				);
			}
		}


		/**
		 * Select a field element or clear selection.
		 *
		 * @param {HTMLElement|null} field_el
		 * @param {{scrollIntoView?: boolean}} [opts = {}]
		 */
		select_field(field_el, { scrollIntoView = false } = {}) {
			const root   = this.builder.pages_container;
			const prevEl = this.get_selected_field?.() || null;   // the one we’re leaving.

			// Ignore elements not in the canvas.
			if ( field_el && !root.contains( field_el ) ) {
				field_el = null; // treat as "no selection".
			}

			// NEW: if we are leaving a section, clear its column highlight
			if (
				prevEl && prevEl !== field_el &&
				prevEl.classList?.contains( 'wpbc_bfb__section' ) &&
				UI?.WPBC_BFB_Column_Styles?.clear_selected_col_flag
			) {
				UI.WPBC_BFB_Column_Styles.clear_selected_col_flag( prevEl );
			}

			// If we're leaving a field, permanently stop auto-name for it.
			if ( prevEl && prevEl !== field_el && prevEl.classList?.contains( 'wpbc_bfb__field' ) ) {
				prevEl.dataset.autoname = '0';
				prevEl.dataset.fresh    = '0';
			}

			root.querySelectorAll( '.is-selected' ).forEach( (n) => {
				n.classList.remove( 'is-selected' );
			} );
			if ( !field_el ) {
				const prev         = this._selected_uid || null;
				this._selected_uid = null;
				this.builder.inspector?.clear?.();
				root.classList.remove( 'has-selection' );
				this.builder.bus.emit( Core.WPBC_BFB_Events.CLEAR_SELECTION, { prev_uid: prev, source: 'builder' } );

				// Auto-open "Add Fields" when nothing is selected.
				wpbc_bfb__dispatch_event_safe(
					'wpbc_bfb:show_panel',
					{
						panel_id: 'wpbc_bfb__palette_add_new',
						tab_id  : 'wpbc_tab_library'
					}
				);
				this._sync_settings_button_states();

				return;
			}
			field_el.classList.add( 'is-selected' );
			this._selected_uid = field_el.getAttribute( 'data-uid' ) || null;

			// Fallback: ensure sections announce themselves as type="section".
			if ( field_el.classList.contains( 'wpbc_bfb__section' ) && !field_el.dataset.type ) {
				field_el.dataset.type = 'section';
			}

			if ( scrollIntoView ) {
				field_el.scrollIntoView( { behavior: 'smooth', block: 'center' } );
			}
			this.builder.inspector?.bind_to_field?.( field_el );

			// Fallback: ensure inspector enhancers (incl. ValueSlider) run every bind.
			try {
				const ins = document.getElementById( 'wpbc_bfb__inspector' )
					|| document.querySelector( '.wpbc_bfb__inspector' );
				if ( ins ) {
					UI.InspectorEnhancers?.scan?.( ins );              // runs all enhancers
					UI.WPBC_BFB_ValueSlider?.init_on?.( ins );         // extra belt-and-suspenders
				}
			} catch ( _ ) {
			}

			// NEW: when selecting a section, reflect its active tab as the highlighted column.
			if ( field_el.classList.contains( 'wpbc_bfb__section' ) &&
				UI?.WPBC_BFB_Column_Styles?.set_selected_col_flag ) {
				var k = (field_el.dataset && field_el.dataset.col_styles_active_tab)
					? field_el.dataset.col_styles_active_tab : '1';
				UI.WPBC_BFB_Column_Styles.set_selected_col_flag( field_el, k );
			}

			// Keep sections & fields in the same flow:
			// 1) Generic hydrator for simple dataset-backed controls.
			if ( field_el ) {
				UI.WPBC_BFB_Inspector_Bridge._generic_hydrate_controls?.( this.builder, field_el );
				UI.WPBC_BFB_Inspector_Bridge._hydrate_special_controls?.( this.builder, field_el );
			}

			// Auto-open Inspector when a user selects a field/section .
			wpbc_bfb__dispatch_event_safe(
				'wpbc_bfb:show_panel',
				{
					panel_id: 'wpbc_bfb__inspector',
					tab_id  : 'wpbc_tab_inspector'
				}
			);
			this._sync_settings_button_states();

			root.classList.add( 'has-selection' );
			this.builder.bus.emit( Core.WPBC_BFB_Events.SELECT, { uid: this._selected_uid, el: field_el } );
			const label = field_el?.querySelector( '.wpbc_bfb__field-label' )?.textContent || (field_el.classList.contains( 'wpbc_bfb__section' ) ? 'section' : '') || field_el?.dataset?.id || 'item';
			this.builder._announce( 'Selected ' + label + '.' );
		}

		/** @returns {HTMLElement|null} */
		get_selected_field() {
			if ( !this._selected_uid ) {
				return null;
			}
			const esc_attr = Core.WPBC_BFB_Sanitize.esc_attr_value_for_selector( this._selected_uid );
			return this.builder.pages_container.querySelector( `.wpbc_bfb__field[data-uid="${esc_attr}"], .wpbc_bfb__section[data-uid="${esc_attr}"]` );
		}

		/** @param {CustomEvent} ev */
		on_clear(ev) {
			const src = ev?.detail?.source ?? ev?.source;
			if ( src !== 'builder' ) {
				this.select_field( null );
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
			this._open_inspector_after_field_added();
			this._bind_focus_shortcuts();
		}

		_attach_inspector() {
			const b      = this.builder;
			const attach = () => {
				if ( typeof window.WPBC_BFB_Inspector === 'function' ) {
					b.inspector = new WPBC_BFB_Inspector( document.getElementById( 'wpbc_bfb__inspector' ), b );
					this._bind_id_sanitizer();
					document.removeEventListener( 'wpbc_bfb_inspector_ready', attach );
				}
			};
			// Ensure we bind after late ready as well.
			if ( typeof window.WPBC_BFB_Inspector === 'function' ) {
				attach();
			} else {
				b.inspector = {
					bind_to_field() {
					}, clear() {
					}
				};
				document.addEventListener( 'wpbc_bfb_inspector_ready', attach );
				setTimeout( attach, 0 );
			}
		}

		/**
		 * Listen for "focus" hints from the canvas and open the right group/tab.
		 * - Supports: group === 'column_styles'
		 * - Also scrolls the group into view.
		 */
		_bind_focus_shortcuts() {
			/** @param {CustomEvent} e */
			const on_focus = (e) => {
				try {
					const grp_key = e && e.detail && e.detail.group;
					const tab_key = e && e.detail && e.detail.tab_key;
					if ( !grp_key ) {
						return;
					}

					const ins = document.getElementById( 'wpbc_bfb__inspector' ) || document.querySelector( '.wpbc_bfb__inspector' );
					if ( !ins ) {
						return;
					}

					if ( grp_key === 'column_styles' ) {
						// Find the Column Styles slot/group.
						const slot = ins.querySelector( '[data-bfb-slot="column_styles"]' ) || ins.querySelector( '[data-inspector-group-key="column_styles"]' );
						if ( slot ) {
							// Open collapsible container if present.
							const group_wrap = slot.closest( '.inspector__group' ) || slot.closest( '[data-inspector-group]' );
							if ( group_wrap && !group_wrap.classList.contains( 'is-open' ) ) {
								group_wrap.classList.add( 'is-open' );
								// Mirror ARIA state if your header uses aria-expanded.
								const header_btn = group_wrap.querySelector( '[aria-expanded]' );
								if ( header_btn ) {
									header_btn.setAttribute( 'aria-expanded', 'true' );
								}
							}

							// Optional: set the requested tab key if tabs exist in this group.
							if ( tab_key ) {
								const tabs = slot.querySelector( '[data-wpbc-tabs]' );
								if ( tabs && window.wpbc_ui_tabs && typeof window.wpbc_ui_tabs.set_active === 'function' ) {
									window.wpbc_ui_tabs.set_active( tabs, String( tab_key ) );
								}
							}

							// Bring into view for convenience.
							try {
								// Uncomment (Only  if needed) this to AUTO SCROLL to  specific COLUMN in the section:.
								// slot.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
							} catch ( _e ) {}
						}
					}
				} catch ( _e ) {}
			};

			this._on_inspector_focus = on_focus;
			document.addEventListener( 'wpbc_bfb:inspector_focus', on_focus, true );
		}

		destroy() {
			try {
				if ( this._on_inspector_focus ) {
					document.removeEventListener( 'wpbc_bfb:inspector_focus', this._on_inspector_focus, true );
					this._on_inspector_focus = null;
				}
			} catch ( _e ) {
			}
		}


		/**
		 * Hydrate inspector inputs for "special" keys that we handle explicitly.
		 * Works for both fields and sections.
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} sel
		 */
		static _hydrate_special_controls(builder, sel) {
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			if ( !ins || !sel ) return;

			const setVal = (key, val) => {
				const ctrl = ins.querySelector( `[data-inspector-key="${key}"]` );
				if ( ctrl && 'value' in ctrl ) ctrl.value = String( val ?? '' );
			};

			// Internal id / name / public html_id.
			setVal( 'id', sel.getAttribute( 'data-id' ) || '' );
			setVal( 'name', sel.getAttribute( 'data-name' ) || '' );
			setVal( 'html_id', sel.getAttribute( 'data-html_id' ) || '' );

			// Section-only extras are harmless to set for fields (controls may not exist).
			setVal( 'cssclass', sel.getAttribute( 'data-cssclass' ) || '' );
			setVal( 'label', sel.getAttribute( 'data-label' ) || '' );
		}


		/**
		 * Hydrate inspector inputs that declare a generic dataset mapping via
		 * [data-inspector-key] but do NOT declare a custom value_from adapter.
		 * This makes sections follow the same data flow as fields with almost no glue.
		 *
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} sel - currently selected field/section
		 */
		static _generic_hydrate_controls(builder, sel) {
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			if ( !ins || !sel ) return;

			const SKIP = /^(id|name|html_id|cssclass|label)$/; // handled by _hydrate_special_controls

			// NEW: read schema for the selected element’s type.
			const schemas     = window.WPBC_BFB_Schemas || {};
			const typeKey     = (sel.dataset && sel.dataset.type) || '';
			const schemaEntry = schemas[typeKey] || null;
			const propsSchema = (schemaEntry && schemaEntry.schema && schemaEntry.schema.props) ? schemaEntry.schema.props : {};
			const hasOwn      = Function.prototype.call.bind( Object.prototype.hasOwnProperty );
			const getDefault  = (key) => {
				const meta = propsSchema[key];
				return (meta && hasOwn( meta, 'default' )) ? meta.default : undefined;
			};

			ins.querySelectorAll( '[data-inspector-key]' ).forEach( (ctrl) => {
				const key = String( ctrl.dataset?.inspectorKey || '' ).toLowerCase();
				if ( !key || SKIP.test( key ) ) return;

				// Element-level lock.
				const dl = (ctrl.dataset?.locked || '').trim().toLowerCase();
				if ( dl === '1' || dl === 'true' || dl === 'yes' ) return;

				// Respect explicit adapters.
				if ( ctrl.dataset?.value_from || ctrl.dataset?.valueFrom ) return;

				const raw      = sel.dataset ? sel.dataset[key] : undefined;
				const hasRaw   = sel.dataset ? hasOwn( sel.dataset, key ) : false;
				const defValue = getDefault( key );

				// Best-effort control typing with schema default fallback when value is absent.

				if ( ctrl instanceof HTMLInputElement && (ctrl.type === 'checkbox' || ctrl.type === 'radio') ) {
					// If dataset is missing the key entirely -> use schema default (boolean).
					if ( !hasRaw ) {
						ctrl.checked = !!defValue;
					} else {
						// An explicit empty value is the legacy persisted representation of false.
						ctrl.checked = Core.WPBC_BFB_Sanitize.coerce_boolean( raw, false );
					}
				} else if ( 'value' in ctrl ) {
					if ( hasRaw ) {
						ctrl.value = (raw != null) ? String( raw ) : '';
					} else {
						ctrl.value = (defValue == null) ? '' : String( defValue );
					}
				}
			} );
		}

		_bind_id_sanitizer() {
			const b   = this.builder;
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			if ( ! ins ) {
				return;
			}
			if ( ins.__wpbc_bfb_id_sanitizer_bound ) {
				return;
			}
			ins.__wpbc_bfb_id_sanitizer_bound = true;

			const handler = (e) => {

				const t = e.target;
				if ( !t || !('value' in t) ) {
					return;
				}
				const key       = (t.dataset?.inspectorKey || '').toLowerCase();
				const sel       = b.get_selected_field?.();
				const isSection = sel?.classList?.contains( 'wpbc_bfb__section' );
				if ( !sel ) return;

				// Unified emitter that always includes the element reference.
				const EV              = Core.WPBC_BFB_Events;
				// STRUCTURE_CHANGE can be "expensive" because other listeners may trigger full canvas refresh.
				// Debounce only continuous controls (e.g. value slider scrubbing) on the INPUT phase.
				const ensure_sc_debounce_state = () => {
					if ( b.__wpbc_bfb_sc_debounce_state ) {
						return b.__wpbc_bfb_sc_debounce_state;
					}
					b.__wpbc_bfb_sc_debounce_state = { timer_id: 0, pending_payload: null };
					return b.__wpbc_bfb_sc_debounce_state;
				};

				const cancel_sc_debounced_emit = () => {
					const st = b.__wpbc_bfb_sc_debounce_state;
					if ( !st ) return;
					try { clearTimeout( st.timer_id ); } catch ( _ ) {}
					st.timer_id        = 0;
					st.pending_payload = null;
				};

				const bus_emit_change = (reason, extra = {}) => {
					// If we’re committing something (change/blur/etc), drop any pending "input" emit.
					cancel_sc_debounced_emit();
					b.bus?.emit?.( EV.STRUCTURE_CHANGE, { reason, el: sel, ...extra } );
				};

				const bus_emit_change_debounced = (reason, extra = {}, wait_ms) => {
					const st = ensure_sc_debounce_state();
					const ms = Number.isFinite( wait_ms )
						? wait_ms
						: (Number.isFinite( UI.STRUCTURE_CHANGE_DEBOUNCE_MS ) ? UI.STRUCTURE_CHANGE_DEBOUNCE_MS : 240);

					// Capture the CURRENT selected element into the payload now (stable ref).
					st.pending_payload = { reason, el: sel, ...extra, debounced: true };

					try { clearTimeout( st.timer_id ); } catch ( _ ) {}
					st.timer_id = setTimeout( function () {
						st.timer_id = 0;
						const payload = st.pending_payload;
						st.pending_payload = null;
						if ( payload ) {
							b.bus?.emit?.( EV.STRUCTURE_CHANGE, payload );
						}
					}, ms );
				};

				// ---- FIELD/SECTION: internal id ----
				if ( key === 'id' ) {
					const unique = b.id.set_field_id( sel, t.value );
					if ( b.preview_mode && !isSection ) {
						b.render_preview( sel );
					}
					if ( t.value !== unique ) {
						t.value = unique;
					}
					bus_emit_change( 'id-change' );
					return;
				}

				// ---- FIELD/SECTION: public HTML id ----
				if ( key === 'html_id' ) {
					const applied = b.id.set_field_html_id( sel, t.value );
					// For sections, also set the real DOM id so anchors/CSS can target it.
					if ( isSection ) {
						sel.id = applied || '';
					} else if ( b.preview_mode ) {
						b.render_preview( sel );
					}
					if ( t.value !== applied ) {
						t.value = applied;
					}
					bus_emit_change( 'html-id-change' );
					return;
				}

				// ---- FIELDS ONLY: name ----
				if ( key === 'name' && !isSection ) {

					// Live typing: sanitize only (NO uniqueness yet) to avoid "-2" spam
					if ( e.type === 'input' ) {
						const before    = t.value;
						const sanitized = Core.WPBC_BFB_Sanitize.sanitize_html_name( before );
						if ( before !== sanitized ) {
							// optional: preserve caret to avoid jump
							const selStart = t.selectionStart, selEnd = t.selectionEnd;
							t.value        = sanitized;
							try {
								t.setSelectionRange( selStart, selEnd );
							} catch ( _ ) {
							}
						}
						return; // uniqueness on change/blur
					}

					// Commit (change/blur)
					const raw = String( t.value ?? '' ).trim();

					if ( !raw ) {
						// RESEED: keep name non-empty and provisional (autoname stays ON)
						const S    = Core.WPBC_BFB_Sanitize;
						const base = S.sanitize_html_name( sel.getAttribute( 'data-id' ) || sel.dataset.id || sel.dataset.type || 'field' );
						const uniq = b.id.ensure_unique_field_name( base, sel );

						sel.setAttribute( 'data-name', uniq );
						sel.dataset.autoname          = '1';
						sel.dataset.name_user_touched = '0';

						// Keep DOM in sync if we’re not re-rendering
						if ( !b.preview_mode ) {
							const ctrl = sel.querySelector( 'input,textarea,select' );
							if ( ctrl ) ctrl.setAttribute( 'name', uniq );
						} else {
							b.render_preview( sel );
						}

						if ( t.value !== uniq ) t.value = uniq;
						bus_emit_change( 'name-reseed' );
						return;
					}

					// Non-empty commit: user takes control; disable autoname going forward
					sel.dataset.name_user_touched = '1';
					sel.dataset.autoname          = '0';

					const sanitized = Core.WPBC_BFB_Sanitize.sanitize_html_name( raw );
					const unique    = b.id.set_field_name( sel, sanitized );

					if ( !b.preview_mode ) {
						const ctrl = sel.querySelector( 'input,textarea,select' );
						if ( ctrl ) ctrl.setAttribute( 'name', unique );
					} else {
						b.render_preview( sel );
					}

					if ( t.value !== unique ) t.value = unique;
					bus_emit_change( 'name-change' );
					return;
				}

				// ---- SECTIONS & FIELDS: cssclass (live apply; no re-render) ----
				if ( key === 'cssclass' ) {
					const next       = Core.WPBC_BFB_Sanitize.sanitize_css_classlist( t.value || '' );
					const desiredArr = next.split( /\s+/ ).filter( Boolean );
					const desiredSet = new Set( desiredArr );

					// Core classes are never touched.
					const isCore = (cls) => cls === 'is-selected' || cls.startsWith( 'wpbc_' );

					// Snapshot before mutating (DOMTokenList is live).
					const beforeClasses = Array.from( sel.classList );
					const customBefore  = beforeClasses.filter( (c) => !isCore( c ) );

					// Remove stray non-core classes not in desired.
					customBefore.forEach( (c) => {
						if ( !desiredSet.has( c ) ) sel.classList.remove( c );
					} );

					// Add missing desired classes in one go.
					const missing = desiredArr.filter( (c) => !customBefore.includes( c ) );
					if ( missing.length ) sel.classList.add( ...missing );

					// Keep dataset in sync (avoid useless attribute writes).
					if ( sel.getAttribute( 'data-cssclass' ) !== next ) {
						sel.setAttribute( 'data-cssclass', next );
					}

					// Emit only if something actually changed.
					const afterClasses = Array.from( sel.classList );
					const changed      = afterClasses.length !== beforeClasses.length || beforeClasses.some( (c, i) => c !== afterClasses[i] );

					const detail = { key: 'cssclass', phase: e.type };
					if ( isSection ) {
						bus_emit_change( 'cssclass-change', detail );
					} else {
						bus_emit_change( 'prop-change', detail );
					}
					return;
				}


				// ---- SECTIONS: label ----
				if ( isSection && key === 'label' ) {
					const val = String( t.value ?? '' );
					sel.setAttribute( 'data-label', val );
					bus_emit_change( 'label-change' );
					return;
				}

				// ---- FIELDS: label (auto-name while typing; freeze on commit) ----
				if ( !isSection && key === 'label' ) {
					const val         = String( t.value ?? '' );
					sel.dataset.label = val;

					// while typing, allow auto-name (if flags permit)
					try {
						Core.WPBC_BFB_Field_Base.maybe_autoname_from_label( b, sel, val );
					} catch ( _ ) {
					}

					// if user committed the label (blur/change), freeze future auto-name
					if ( e.type !== 'input' ) {
						sel.dataset.autoname = '0';   // stop future label->name sync
						sel.dataset.fresh    = '0';   // also kill the "fresh" escape hatch
					}

					// Optional UI nicety: disable Name when auto is ON, enable when OFF
					const ins      = document.getElementById( 'wpbc_bfb__inspector' );
					const nameCtrl = ins?.querySelector( '[data-inspector-key="name"]' );
					if ( nameCtrl ) {
						const autoActive =
								  (sel.dataset.autoname ?? '1') !== '0' &&
								  sel.dataset.name_user_touched !== '1' &&
								  sel.dataset.was_loaded !== '1';
						nameCtrl.toggleAttribute( 'disabled', autoActive );
						if ( autoActive && !nameCtrl.placeholder ) {
							nameCtrl.placeholder = b?.i18n?.auto_from_label ?? 'auto — from label';
						}
						if ( !autoActive && nameCtrl.placeholder === (b?.i18n?.auto_from_label ?? 'auto — from label') ) {
							nameCtrl.placeholder = '';
						}
					}

					// Always re-render the preview so label changes are visible immediately.
					b.render_preview( sel );
					bus_emit_change( 'label-change' );
					return;
				}


				// ---- DEFAULT (GENERIC): dataset writer for both fields & sections ----
				// Any inspector control with [data-inspector-key] that doesn't have a custom
				// adapter/value_from will simply read/write sel.dataset[key].
				if ( key ) {

					const selfLocked = /^(1|true|yes)$/i.test( (t.dataset?.locked || '').trim() );
					if ( selfLocked ) {
						return;
					}

					// Skip keys we handled above to avoid double work.
					if ( key === 'id' || key === 'name' || key === 'html_id' || key === 'cssclass' || key === 'label' ) {
						return;
					}
					let nextVal = '';
					if ( t instanceof HTMLInputElement && (t.type === 'checkbox' || t.type === 'radio') ) {
						// Persist both boolean states explicitly so schema defaults cannot replace false.
						nextVal = t.checked ? 'true' : 'false';
					} else if ( 'value' in t ) {
						nextVal = String( t.value ?? '' );
					}
					// Persist to dataset.
					if ( sel?.dataset ) sel.dataset[key] = nextVal;

					// Generator controls are "UI inputs" — avoid STRUCTURE_CHANGE spam while dragging/typing.
					const is_gen_key = (key.indexOf( 'gen_' ) === 0);

					// Re-render on visual keys so preview stays in sync (calendar label/help, etc.).
					const visualKeys = new Set( [ 'help', 'placeholder', 'min_width', 'cssclass' ] );
					if ( !isSection && (visualKeys.has( key ) || key.startsWith( 'ui_' )) ) {
						// Light heuristic: only re-render on commit for heavy inputs; live for short ones is fine.
						if ( e.type === 'change' || key === 'help' || key === 'placeholder' ) {
							b.render_preview( sel );
						}
					}

					if ( !(is_gen_key && e.type === 'input') ) {
						// Debounce continuous value slider input events to avoid full-canvas refresh spam.
						// We detect the slider group via [data-len-group] wrapper.
						const is_len_group_ctrl = !!(t && t.closest && t.closest( '[data-len-group]' ));

						if ( is_len_group_ctrl && e.type === 'input' ) {
							bus_emit_change_debounced( 'prop-change', { key, phase: e.type } );
						} else {
							bus_emit_change( 'prop-change', { key, phase: e.type } );
						}
					}
					return;
				}
			};

			ins.addEventListener( 'change', handler, true );
			// reflect instantly while typing as well.
			ins.addEventListener( 'input', handler, true );
		}

		/**
		 * Open Inspector after a field is added.
		 * @private
		 */
		_open_inspector_after_field_added() {
			const EV = Core.WPBC_BFB_Events;
			this.builder?.bus?.on?.( EV.FIELD_ADD, (e) => {
				const el = e?.detail?.el || null;
				if ( el && this.builder?.select_field ) {
					this.builder.select_field( el, { scrollIntoView: true } );
				}
				// Show Inspector Palette.
				wpbc_bfb__dispatch_event_safe(
					'wpbc_bfb:show_panel',
					{
						panel_id: 'wpbc_bfb__inspector',
						tab_id  : 'wpbc_tab_inspector'
					}
				);
			} );
		}
	};

	/**
	 * Keyboard shortcuts for selection, deletion, and movement.
	 */
	UI.WPBC_BFB_Keyboard_Controller = class extends UI.WPBC_BFB_Module {
		init() {
			this._on_key = this.on_key.bind( this );
			document.addEventListener( 'keydown', this._on_key, true );
		}

		destroy() {
			document.removeEventListener( 'keydown', this._on_key, true );
		}

		/** @param {KeyboardEvent} e */
		on_key(e) {
			const b         = this.builder;
			const is_typing = this._is_typing_anywhere();
			if ( e.key === 'Escape' ) {
				if ( is_typing ) {
					return;
				}
				this.builder.bus.emit( Core.WPBC_BFB_Events.CLEAR_SELECTION, { source: 'esc' } );
				return;
			}
			const selected = b.get_selected_field?.();
			if ( !selected || is_typing ) {
				return;
			}
			if ( e.key === 'Delete' || e.key === 'Backspace' ) {
				e.preventDefault();
				b.delete_item?.( selected );
				return;
			}
			if ( (e.altKey || e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey ) {
				e.preventDefault();
				const dir = (e.key === 'ArrowUp') ? 'up' : 'down';
				b.move_item?.( selected, dir );
				return;
			}
			if ( e.key === 'Enter' ) {
				e.preventDefault();
				b.select_field( selected, { scrollIntoView: true } );
			}
		}

		/** @returns {boolean} */
		_is_typing_anywhere() {
			const a   = document.activeElement;
			const tag = a?.tagName;
			if ( tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (a?.isContentEditable === true) ) {
				return true;
			}
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			return !!(ins && a && ins.contains( a ));
		}
	};

	/**
	 * Column resize logic for section rows.
	 */
	UI.WPBC_BFB_Resize_Controller = class extends UI.WPBC_BFB_Module {
		init() {
			this.builder.init_resize_handler = this.handle_resize.bind( this );
		}

		/**
		 * read the CSS var (kept local so it doesn’t depend on the Min-Width module)
		 *
		 * @param col
		 * @returns {number|number}
		 * @private
		 */
		_get_col_min_px(col) {
			const v = getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0';
			const n = parseFloat( v );
			return Number.isFinite( n ) ? Math.max( 0, n ) : 0;
		}

		/** @param {MouseEvent} e */
		handle_resize(e) {
			const b = this.builder;
			e.preventDefault();
			if ( e.button !== 0 ) return;

			const resizer   = e.currentTarget;
			const row_el    = resizer.parentElement;
			const cols      = Array.from( row_el.querySelectorAll( ':scope > .wpbc_bfb__column' ) );
			const left_col  = resizer?.previousElementSibling;
			const right_col = resizer?.nextElementSibling;
			if ( !left_col || !right_col || !left_col.classList.contains( 'wpbc_bfb__column' ) || !right_col.classList.contains( 'wpbc_bfb__column' ) ) return;

			const left_index  = cols.indexOf( left_col );
			const right_index = cols.indexOf( right_col );
			if ( left_index === -1 || right_index !== left_index + 1 ) return;

			const start_x        = e.clientX;
			const left_start_px  = left_col.getBoundingClientRect().width;
			const right_start_px = right_col.getBoundingClientRect().width;
			const pair_px        = Math.max( 0, left_start_px + right_start_px );

			const gp         = b.col_gap_percent;
			const computed   = b.layout.compute_effective_bases_from_row( row_el, gp );
			const available  = computed.available;                 // % of the “full 100” after gaps
			const bases      = computed.bases.slice( 0 );            // current effective %
			const pair_avail = bases[left_index] + bases[right_index];

			// Bail if we can’t compute sane deltas.
			if (!pair_px || !Number.isFinite(pair_avail) || pair_avail <= 0) return;

			// --- MIN CLAMPS (pixels) -------------------------------------------------
			const pctToPx       = (pct) => (pair_px * (pct / pair_avail)); // pair-local percent -> px
			const genericMinPct = Math.min( 0.1, available );                  // original 0.1% floor (in “available %” space)
			const genericMinPx  = pctToPx( genericMinPct );

			const leftMinPx  = Math.max( this._get_col_min_px( left_col ), genericMinPx );
			const rightMinPx = Math.max( this._get_col_min_px( right_col ), genericMinPx );

			// freeze text selection + cursor
			const prev_user_select         = document.body.style.userSelect;
			document.body.style.userSelect = 'none';
			row_el.style.cursor            = 'col-resize';

			const on_mouse_move = (ev) => {
				if ( !pair_px ) return;

				// work in pixels, clamp by each side’s min
				const delta_px   = ev.clientX - start_x;
				let newLeftPx    = left_start_px + delta_px;
				newLeftPx        = Math.max( leftMinPx, Math.min( pair_px - rightMinPx, newLeftPx ) );
				const newRightPx = pair_px - newLeftPx;

				// translate back to pair-local percentages
				const newLeftPct      = (newLeftPx / pair_px) * pair_avail;
				const newBases        = bases.slice( 0 );
				newBases[left_index]  = newLeftPct;
				newBases[right_index] = pair_avail - newLeftPct;

				b.layout.apply_bases_to_row( row_el, newBases );
			};

			const on_mouse_up = () => {
				document.removeEventListener( 'mousemove', on_mouse_move );
				document.removeEventListener( 'mouseup', on_mouse_up );
				window.removeEventListener( 'mouseup', on_mouse_up );
				document.removeEventListener( 'mouseleave', on_mouse_up );
				document.body.style.userSelect = prev_user_select || '';
				row_el.style.cursor            = '';

				// normalize to the row’s available % again
				const normalized = b.layout.compute_effective_bases_from_row( row_el, gp );
				b.layout.apply_bases_to_row( row_el, normalized.bases );
			};

			document.addEventListener( 'mousemove', on_mouse_move );
			document.addEventListener( 'mouseup', on_mouse_up );
			window.addEventListener( 'mouseup', on_mouse_up );
			document.addEventListener( 'mouseleave', on_mouse_up );
		}

	};

	/**
	 * Page and section creation, rebuilding, and nested Sortable setup.
	 */
	UI.WPBC_BFB_Pages_Sections = class extends UI.WPBC_BFB_Module {

		init() {
			this.builder.add_page                  = (opts) => this.add_page( opts );
			this.builder.add_section               = (container, cols) => this.add_section( container, cols );
			this.builder.rebuild_section           = (section_data, container) => this.rebuild_section( section_data, container );
			this.builder.init_all_nested_sortables = (el) => this.init_all_nested_sortables( el );
			this.builder.init_section_sortable     = (el) => this.init_section_sortable( el );
			this.builder.pages_sections            = this;
		}

		/**
		 * Give every field/section in a cloned subtree a fresh data-uid so
		 * uniqueness checks don't exclude their originals.
		 */
		_retag_uids_in_subtree(root) {
			const b = this.builder;
			if ( !root ) return;
			const nodes = [];
			if ( root.classList?.contains( 'wpbc_bfb__section' ) || root.classList?.contains( 'wpbc_bfb__field' ) ) {
				nodes.push( root );
			}
			nodes.push( ...root.querySelectorAll( '.wpbc_bfb__section, .wpbc_bfb__field' ) );
			nodes.forEach( (el) => {
				const prefix   = el.classList.contains( 'wpbc_bfb__section' ) ? 's' : 'f';
				el.dataset.uid = `${prefix}-${++b._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}`;
			} );
		}

		/**
		 * Bump "foo", "foo-2", "foo-3", ...
		 */
		_make_unique(base, taken) {
			const s = Core.WPBC_BFB_Sanitize;
			let v   = String( base || '' );
			if ( !v ) v = 'field';
			const m  = v.match( /-(\d+)$/ );
			let n    = m ? (parseInt( m[1], 10 ) || 1) : 1;
			let stem = m ? v.replace( /-\d+$/, '' ) : v;
			while ( taken.has( v ) ) {
				n = Math.max( 2, n + 1 );
				v = `${stem}-${n}`;
			}
			taken.add( v );
			return v;
		}

		/**
		 * Strict, one-pass de-duplication for a newly-inserted subtree.
		 * - Ensures unique data-id (internal), data-name (fields), data-html_id (public)
		 * - Also updates DOM: <section id>, <input id>, <label for>, and input[name].
		 */
		_dedupe_subtree_strict(root) {
			const b = this.builder;
			const s = Core.WPBC_BFB_Sanitize;
			if ( !root || !b?.pages_container ) return;

			// 1) Build "taken" sets from outside the subtree.
			const takenDataId   = new Set();
			const takenDataName = new Set();
			const takenHtmlId   = new Set();
			const takenDomId    = new Set();

			// All fields/sections outside root
			b.pages_container.querySelectorAll( '.wpbc_bfb__field, .wpbc_bfb__section' ).forEach( el => {
				if ( root.contains( el ) ) return;
				const did  = el.getAttribute( 'data-id' );
				const dnam = el.getAttribute( 'data-name' );
				const hid  = el.getAttribute( 'data-html_id' );
				if ( did ) takenDataId.add( did );
				if ( dnam ) takenDataName.add( dnam );
				if ( hid ) takenHtmlId.add( hid );
			} );

			// All DOM ids outside root (labels, inputs, anything)
			document.querySelectorAll( '[id]' ).forEach( el => {
				if ( root.contains( el ) ) return;
				if ( el.id ) takenDomId.add( el.id );
			} );

			const nodes = [];
			if ( root.classList?.contains( 'wpbc_bfb__section' ) || root.classList?.contains( 'wpbc_bfb__field' ) ) {
				nodes.push( root );
			}
			nodes.push( ...root.querySelectorAll( '.wpbc_bfb__section, .wpbc_bfb__field' ) );

			// 2) Walk the subtree and fix collisions deterministically.
			nodes.forEach( el => {
				const isField   = el.classList.contains( 'wpbc_bfb__field' );
				const isSection = el.classList.contains( 'wpbc_bfb__section' );

				// INTERNAL data-id
				{
					const raw  = el.getAttribute( 'data-id' ) || '';
					const base = s.sanitize_html_id( raw ) || (isSection ? 'section' : 'field');
					const uniq = this._make_unique( base, takenDataId );
					if ( uniq !== raw ) el.setAttribute( 'data-id', uniq );
				}

				// HTML name (fields only)
				if ( isField ) {
					const raw = el.getAttribute( 'data-name' ) || '';
					if ( raw ) {
						const base = s.sanitize_html_name( raw );
						const uniq = this._make_unique( base, takenDataName );
						if ( uniq !== raw ) {
							el.setAttribute( 'data-name', uniq );
							// Update inner control immediately
							const input = el.querySelector( 'input, textarea, select' );
							if ( input ) input.setAttribute( 'name', uniq );
						}
					}
				}

				// Public HTML id (fields + sections)
				{
					const raw = el.getAttribute( 'data-html_id' ) || '';
					if ( raw ) {
						const base          = s.sanitize_html_id( raw );
						// Reserve against BOTH known data-html_id and real DOM ids.
						const combinedTaken = new Set( [ ...takenHtmlId, ...takenDomId ] );
						let candidate       = this._make_unique( base, combinedTaken );
						// Record into the real sets so future checks see the reservation.
						takenHtmlId.add( candidate );
						takenDomId.add( candidate );

						if ( candidate !== raw ) el.setAttribute( 'data-html_id', candidate );

						// Reflect to DOM immediately
						if ( isSection ) {
							el.id = candidate || '';
						} else {
							const input = el.querySelector( 'input, textarea, select' );
							const label = el.querySelector( 'label.wpbc_bfb__field-label' );
							if ( input ) input.id = candidate || '';
							if ( label ) label.htmlFor = candidate || '';
						}
					} else if ( isSection ) {
						// Ensure no stale DOM id if data-html_id was cleared
						el.removeAttribute( 'id' );
					}
				}
			} );
		}

		_make_add_columns_control(page_el, section_container, insert_pos = 'bottom') {

			// Accept insert_pos ('top'|'bottom'), default 'bottom'.

			const tpl = document.getElementById( 'wpbc_bfb__add_columns_template' );
			if ( !tpl ) {
				return null;
			}

			// Clone *contents* (not the id), unhide, and add a page-scoped class.
			const src = (tpl.content && tpl.content.firstElementChild) ? tpl.content.firstElementChild : tpl.firstElementChild;
			if ( !src ) {
				return null;
			}

			const clone = src.cloneNode( true );
			clone.removeAttribute( 'hidden' );
			if ( clone.id ) {
				clone.removeAttribute( 'id' );
			}
			clone.querySelectorAll( '[id]' ).forEach( n => n.removeAttribute( 'id' ) );

			// Mark where this control inserts sections.
			clone.dataset.insert = insert_pos; // 'top' | 'bottom'

			// // Optional UI hint for users (keeps existing markup intact).
			// const hint = clone.querySelector( '.nav-tab-text .selected_value' );
			// if ( hint ) {
			// 	hint.textContent = (insert_pos === 'top') ? ' (add at top)' : ' (add at bottom)';
			// }

			// Click on options - add section with N columns.
			clone.addEventListener( 'click', (e) => {
				const a = e.target.closest( '.ul_dropdown_menu_li_action_add_sections' );
				if ( !a ) {
					return;
				}
				e.preventDefault();

				// Read N either from data-cols or fallback to parsing text like "3 Columns".
				let cols = parseInt( a.dataset.cols || (a.textContent.match( /\b(\d+)\s*Column/i )?.[1] ?? '1'), 10 );
				cols     = Math.max( 1, Math.min( 4, cols ) );

				// NEW: honor the control's insertion position
				this.add_section( section_container, cols, insert_pos );

				// Reflect last choice (unchanged)
				const val = clone.querySelector( '.selected_value' );
				if ( val ) {
					val.textContent = ` (${cols})`;
				}
			} );

			return clone;
		}

		/**
		 * @param {{scroll?: boolean}} [opts = {}]
		 * @returns {HTMLElement}
		 */
		add_page({ scroll = true } = {}) {
			const b       = this.builder;
			const page_el = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__panel wpbc_bfb__panel--preview  wpbc_bfb_form wpbc_container wpbc_form wpbc_container_booking_form' );
			page_el.setAttribute( 'data-page', ++b.page_counter );

			// "Page 1 | X" - Render page Title with Remove X button.
			const controls_html = UI.render_wp_template( 'wpbc-bfb-tpl-page-remove', { page_number: b.page_counter } );
			page_el.innerHTML   = controls_html + '<div class="wpbc_bfb__form_preview_section_container wpbc_wizard__border_container"></div>';

			b.pages_container.appendChild( page_el );
			if ( scroll ) {
				page_el.scrollIntoView( { behavior: 'smooth', block: 'start' } );
			}

			const section_container         = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
			const section_count_on_add_page = 2;
			this.init_section_sortable( section_container );
			this.add_section( section_container, section_count_on_add_page );

			// Dropdown control cloned from the hidden template.
			const controls_host_top = page_el.querySelector( '.wpbc_bfb__controls' );
			const ctrl_top          = this._make_add_columns_control( page_el, section_container, 'top' );
			if ( ctrl_top ) {
				controls_host_top.appendChild( ctrl_top );
			}
			// Bottom control bar after the section container.
			const controls_host_bottom = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__controls wpbc_bfb__controls--bottom' );
			section_container.after( controls_host_bottom );
			const ctrl_bottom = this._make_add_columns_control( page_el, section_container, 'bottom' );
			if ( ctrl_bottom ) {
				controls_host_bottom.appendChild( ctrl_bottom );
			}

			return page_el;
		}

		/**
		 * @param {HTMLElement} container
		 * @param {number}      cols
		 * @param {'top'|'bottom'} [insert_pos='bottom']  // NEW
		 */
		add_section(container, cols, insert_pos = 'bottom') {
			const b = this.builder;
			cols    = Math.max( 1, parseInt( cols, 10 ) || 1 );

			const section = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__section' );
			section.setAttribute( 'data-id', `section-${++b.section_counter}-${Date.now()}` );
			section.setAttribute( 'data-uid', `s-${++b._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}` );
			section.setAttribute( 'data-type', 'section' );
			section.setAttribute( 'data-label', 'Section' );
			section.setAttribute( 'data-columns', String( cols ) );
			// Do not persist or seed per-column styles by default (opt-in via inspector).

			const row = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__row wpbc__row' );
			for ( let i = 0; i < cols; i++ ) {
				const col           = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column wpbc__field' );
				col.style.flexBasis = (100 / cols) + '%';
				// No default CSS vars here; real columns remain unaffected until user activates styles.
				b.init_sortable?.( col );
				row.appendChild( col );
				if ( i < cols - 1 ) {
					const resizer = Core.WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column-resizer' );
					resizer.addEventListener( 'mousedown', b.init_resize_handler );
					row.appendChild( resizer );
				}
			}
			section.appendChild( row );
			b.layout.set_equal_bases( row, b.col_gap_percent );
			b.add_overlay_toolbar( section );
			section.setAttribute( 'tabindex', '0' );
			this.init_all_nested_sortables( section );

			// Insertion policy: top | bottom.
			if ( insert_pos === 'top' && container.firstElementChild ) {
				container.insertBefore( section, container.firstElementChild );
			} else {
				container.appendChild( section );
			}
		}

		/**
		 * @param {Object} section_data
		 * @param {HTMLElement} container
		 * @returns {HTMLElement} The rebuilt section element.
		 */
		rebuild_section(section_data, container) {
			const b         = this.builder;
			const cols_data = Array.isArray( section_data?.columns ) ? section_data.columns : [];
			this.add_section( container, cols_data.length || 1 );
			const section = container.lastElementChild;
			if ( !section.dataset.uid ) {
				section.setAttribute( 'data-uid', `s-${++b._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}` );
			}
			section.setAttribute( 'data-id', section_data?.id || `section-${++b.section_counter}-${Date.now()}` );
			section.setAttribute( 'data-type', 'section' );
			section.setAttribute( 'data-label', section_data?.label || 'Section' );
			section.setAttribute( 'data-columns', String( (section_data?.columns || []).length || 1 ) );
			// Persisted attributes
			if ( section_data?.html_id ) {
				section.setAttribute( 'data-html_id', String( section_data.html_id ) );
				// give the container a real id so anchors/CSS can target it
				section.id = String( section_data.html_id );
			}

			// NEW: restore persisted per-column styles (raw JSON string).
			if ( section_data?.col_styles != null ) {
				const json = String( section_data.col_styles );
				section.setAttribute( 'data-col_styles', json );
				try {
					section.dataset.col_styles = json;
				} catch ( _e ) {
				}
			}
			// (No render_preview() call here on purpose: sections’ builder DOM uses .wpbc_bfb__row/.wpbc_bfb__column.)


			if ( section_data?.cssclass ) {
				section.setAttribute( 'data-cssclass', String( section_data.cssclass ) );
				// keep core classes, then add custom class(es)
				String( section_data.cssclass ).split( /\s+/ ).filter( Boolean ).forEach( cls => section.classList.add( cls ) );
			}

			const row = section.querySelector( '.wpbc_bfb__row' );
			// Delegate parsing + activation + application to the Column Styles service.
			try {
				const json = section.getAttribute( 'data-col_styles' )
					|| (section.dataset ? (section.dataset.col_styles || '') : '');
				const arr  = UI.WPBC_BFB_Column_Styles.parse_col_styles( json );
				UI.WPBC_BFB_Column_Styles.apply( section, arr );
			} catch ( _e ) {
			}

			cols_data.forEach( (col_data, index) => {
				const columns_only  = row.querySelectorAll( ':scope > .wpbc_bfb__column' );
				const col           = columns_only[index];
				col.style.flexBasis = col_data.width || '100%';
				(col_data.items || []).forEach( (item) => {
					if ( !item || !item.type ) {
						return;
					}
					if ( item.type === 'field' ) {
						const el = b.build_field( item.data );
						if ( el ) {
							col.appendChild( el );
							b.trigger_field_drop_callback( el, 'load' );
						}
						return;
					}
					if ( item.type === 'section' ) {
						this.rebuild_section( item.data, col );
					}
				} );
			} );
			const computed = b.layout.compute_effective_bases_from_row( row, b.col_gap_percent );
			b.layout.apply_bases_to_row( row, computed.bases );
			this.init_all_nested_sortables( section );

			// NEW: retag UIDs first (so uniqueness checks don't exclude originals), then dedupe all keys.
			this._retag_uids_in_subtree( section );
			this._dedupe_subtree_strict( section );
			return section;
		}

		/** @param {HTMLElement} container */
		init_all_nested_sortables(container) {
			const b = this.builder;
			if ( container.classList.contains( 'wpbc_bfb__form_preview_section_container' ) ) {
				this.init_section_sortable( container );
			}
			container.querySelectorAll( '.wpbc_bfb__section' ).forEach( (section) => {
				section.querySelectorAll( '.wpbc_bfb__column' ).forEach( (col) => {
					this.init_section_sortable( col );
				} );
			} );
		}

		/** @param {HTMLElement} container */
		init_section_sortable(container) {
			const b = this.builder;
			if ( !container ) {
				return;
			}
			const is_column    = container.classList.contains( 'wpbc_bfb__column' );
			const is_top_level = container.classList.contains( 'wpbc_bfb__form_preview_section_container' );
			if ( !is_column && !is_top_level ) {
				return;
			}
			b.init_sortable?.( container );
		}
	};

	/**
	 * Serialization and deserialization of pages/sections/fields.
	 */
	UI.WPBC_BFB_Structure_IO = class extends UI.WPBC_BFB_Module {
		init() {
			this.builder.get_structure        = () => this.serialize();
			this.builder.load_saved_structure = (s, opts) => this.deserialize( s, opts );
		}

		/**
		 * Normalize option values when a field explicitly disables separate values.
		 *
		 * Older Builder versions persisted an unchecked value_differs toggle as an
		 * empty string. Treat that explicit legacy value as false, while retaining
		 * the schema default when the property is genuinely absent.
		 *
		 * @param {Object} field_data Serialized field data.
		 * @returns {Object} Normalized serialized field data.
		 */
		_normalize_field_option_values(field_data) {
			const has_value_differs = Object.prototype.hasOwnProperty.call( field_data, 'value_differs' );
			if ( !has_value_differs ) {
				return field_data;
			}

			const value_differs   = Core.WPBC_BFB_Sanitize.coerce_boolean( field_data.value_differs, false );
			field_data.value_differs = value_differs;

			if ( !value_differs && Array.isArray( field_data.options ) ) {
				field_data.options = field_data.options.map( ( option_record ) => {
					if ( !option_record || typeof option_record !== 'object' ) {
						return option_record;
					}

					return Object.assign(
						{},
						option_record,
						{ value: String( option_record.label == null ? '' : option_record.label ) }
					);
				} );
			}

			return field_data;
		}

		/** @returns {Array} */
		serialize() {
			const b = this.builder;
			this._normalize_ids();
			this._normalize_names();
			const pages = [];
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview' ).forEach( (page_el, page_index) => {
				const container = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
				const content   = [];
				if ( !container ) {
					pages.push( { page: page_index + 1, content } );
					return;
				}
				container.querySelectorAll( ':scope > *' ).forEach( (child) => {
					if ( child.classList.contains( 'wpbc_bfb__section' ) ) {
						content.push( { type: 'section', data: this.serialize_section( child ) } );
						return;
					}
					if ( child.classList.contains( 'wpbc_bfb__field' ) ) {
						if ( child.classList.contains( 'is-invalid' ) ) {
							return;
						}
						const f_data = this._normalize_field_option_values(
							Core.WPBC_Form_Builder_Helper.get_all_data_attributes( child )
						);
						// Drop ephemeral/editor-only flags
						[ 'uid', 'fresh', 'autoname', 'was_loaded', 'name_user_touched' ]
							.forEach( k => {
								if ( k in f_data ) delete f_data[k];
							} );
						content.push( { type: 'field', data: f_data } );
					}
				} );
				pages.push( { page: page_index + 1, content } );
			} );
			return pages;
		}

		/**
		 * @param {HTMLElement} section_el
		 * @returns {{id:string,label:string,html_id:string,cssclass:string,col_styles:string,columns:Array}}
		 */
		serialize_section(section_el) {
			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );

			// NEW: read per-column styles from dataset/attributes (underscore & hyphen)
			var col_styles_raw =
					section_el.getAttribute( 'data-col_styles' ) ||
					(section_el.dataset ? (section_el.dataset.col_styles) : '') ||
					'';

			const base = {
				id        : section_el.dataset.id,
				label     : section_el.dataset.label || '',
				html_id   : section_el.dataset.html_id || '',
				cssclass  : section_el.dataset.cssclass || '',
				col_styles: String( col_styles_raw )        // <-- NEW: keep as raw JSON string
			};

			if ( !row ) {
				return Object.assign( {}, base, { columns: [] } );
			}

			const columns = [];
			row.querySelectorAll( ':scope > .wpbc_bfb__column' ).forEach( function (col) {
				const width = col.style.flexBasis || '100%';
				const items = [];
				Array.prototype.forEach.call( col.children, function (child) {
					if ( child.classList.contains( 'wpbc_bfb__section' ) ) {
						items.push( { type: 'section', data: this.serialize_section( child ) } );
						return;
					}
					if ( child.classList.contains( 'wpbc_bfb__field' ) ) {
						if ( child.classList.contains( 'is-invalid' ) ) {
							return;
						}
						const f_data = this._normalize_field_option_values(
							Core.WPBC_Form_Builder_Helper.get_all_data_attributes( child )
						);
						[ 'uid', 'fresh', 'autoname', 'was_loaded', 'name_user_touched' ].forEach( function (k) {
							if ( k in f_data ) {
								delete f_data[k];
							}
						} );
						items.push( { type: 'field', data: f_data } );
					}
				}.bind( this ) );
				columns.push( { width: width, items: items } );
			}.bind( this ) );

			// Clamp persisted col_styles to the actual number of columns on Save.
			try {
				const colCount = columns.length;
				const raw      = String( col_styles_raw || '' ).trim();

				if ( raw ) {
					let arr = [];
					try {
						const parsed = JSON.parse( raw );
						arr          = Array.isArray( parsed ) ? parsed : (parsed && Array.isArray( parsed.columns ) ? parsed.columns : []);
					} catch ( _e ) {
						arr = [];
					}

					if ( colCount <= 0 ) {
						base.col_styles = '[]';
					} else {
						if ( arr.length > colCount ) arr.length = colCount;
						while ( arr.length < colCount ) arr.push( {} );
						base.col_styles = JSON.stringify( arr );
					}
				} else {
					base.col_styles = '';
				}
			} catch ( _e ) {
			}

			return Object.assign( {}, base, { columns: columns } );
		}

		/**
		 * @param {Array} structure
		 * @param {{deferIfTyping?: boolean}} [opts = {}]
		 */
		deserialize(structure, { deferIfTyping = true } = {}) {
			const b = this.builder;
			if ( deferIfTyping && this._is_typing_in_inspector() ) {
				clearTimeout( this._defer_timer );
				this._defer_timer = setTimeout( () => {
					this.deserialize( structure, { deferIfTyping: false } );
				}, 150 );
				return;
			}
			b.pages_container.innerHTML = '';
			b.page_counter              = 0;
			(structure || []).forEach( (page_data) => {
				const page_el               = b.pages_sections.add_page( { scroll: false } );
				const section_container     = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
				section_container.innerHTML = '';
				b.init_section_sortable?.( section_container );
				(page_data.content || []).forEach( (item) => {
					if ( item.type === 'section' ) {
						// Now returns the element; attributes (incl. col_styles) are applied inside rebuild.
						b.pages_sections.rebuild_section( item.data, section_container );
						return;
					}
					if ( item.type === 'field' ) {
						const el = b.build_field( item.data );
						if ( el ) {
							section_container.appendChild( el );
							b.trigger_field_drop_callback( el, 'load' );
						}
					}
				} );
			} );
			b.usage?.update_palette_ui?.();
			b.bus.emit( Core.WPBC_BFB_Events.STRUCTURE_LOADED, { structure } );
		}

		_normalize_ids() {
			const b = this.builder;
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)' ).forEach( (el) => {
				const data = Core.WPBC_Form_Builder_Helper.get_all_data_attributes( el );
				const want = Core.WPBC_BFB_Sanitize.sanitize_html_id( data.id || '' ) || 'field';
				const uniq = b.id.ensure_unique_field_id( want, el );
				if ( data.id !== uniq ) {
					el.setAttribute( 'data-id', uniq );
					if ( b.preview_mode ) {
						b.render_preview( el );
					}
				}
			} );
		}

		_normalize_names() {
			const b = this.builder;
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)' ).forEach( (el) => {
				const data = Core.WPBC_Form_Builder_Helper.get_all_data_attributes( el );
				const base = Core.WPBC_BFB_Sanitize.sanitize_html_name( (data.name != null) ? data.name : data.id ) || 'field';
				const uniq = b.id.ensure_unique_field_name( base, el );
				if ( data.name !== uniq ) {
					el.setAttribute( 'data-name', uniq );
					if ( b.preview_mode ) {
						b.render_preview( el );
					}
				}
			} );
		}

		/** @returns {boolean} */
		_is_typing_in_inspector() {
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			return !!(ins && document.activeElement && ins.contains( document.activeElement ));
		}
	};

	/**
	 * Minimal, standalone guard that enforces per-column min widths based on fields' data-min_width.
	 *
	 * @type {UI.WPBC_BFB_Min_Width_Guard}
	 */
	UI.WPBC_BFB_Min_Width_Guard = class extends UI.WPBC_BFB_Module {

		constructor(builder) {
			super( builder );
			this._on_field_add        = this._on_field_add.bind( this );
			this._on_field_remove     = this._on_field_remove.bind( this );
			this._on_structure_loaded = this._on_structure_loaded.bind( this );
			this._on_structure_change = this._on_structure_change.bind( this );
			this._on_window_resize    = this._on_window_resize.bind( this );

			this._pending_rows = new Set();
			this._pending_all  = false;
			this._raf_id       = 0;
		}

		init() {
			const EV = Core.WPBC_BFB_Events;
			this.builder?.bus?.on?.( EV.FIELD_ADD, this._on_field_add );
			this.builder?.bus?.on?.( EV.FIELD_REMOVE, this._on_field_remove );
			this.builder?.bus?.on?.( EV.STRUCTURE_LOADED, this._on_structure_loaded );
			// Refresh selectively on structure change (NOT on every prop input).
			this.builder?.bus?.on?.( EV.STRUCTURE_CHANGE, this._on_structure_change );

			window.addEventListener( 'resize', this._on_window_resize, { passive: true } );
			this._schedule_refresh_all();
		}

		destroy() {
			const EV = Core.WPBC_BFB_Events;
			this.builder?.bus?.off?.( EV.FIELD_ADD, this._on_field_add );
			this.builder?.bus?.off?.( EV.FIELD_REMOVE, this._on_field_remove );
			this.builder?.bus?.off?.( EV.STRUCTURE_LOADED, this._on_structure_loaded );
			this.builder?.bus?.off?.( EV.STRUCTURE_CHANGE, this._on_structure_change );
			window.removeEventListener( 'resize', this._on_window_resize );
		}

		_on_field_add(e) {
			this._schedule_refresh_all();
			// if you really want to be minimal work here, keep your row-only version.
		}

		_on_field_remove(e) {
			const src_el = e?.detail?.el || null;
			const row    = (src_el && src_el.closest) ? src_el.closest( '.wpbc_bfb__row' ) : null;
			if ( row ) {
				this._schedule_refresh_row( row );
			} else {
				this._schedule_refresh_all();
			}
		}

		_on_structure_loaded() {
			this._schedule_refresh_all();
		}

		_on_structure_change(e) {
			const reason = e?.detail?.reason || '';
			const key    = e?.detail?.key || '';

			// Ignore noisy prop changes that don't affect min widths.
			if ( reason === 'prop-change' && key !== 'min_width' ) {
				return;
			}

			const el  = e?.detail?.el || null;
			const row = el?.closest?.( '.wpbc_bfb__row' ) || null;
			if ( row ) {
				this._schedule_refresh_row( row );
			} else {
				this._schedule_refresh_all();
			}
		}

		_on_window_resize() {
			this._schedule_refresh_all();
		}

		_schedule_refresh_row(row_el) {
			if ( !row_el ) return;
			this._pending_rows.add( row_el );
			this._kick_raf();
		}

		_schedule_refresh_all() {
			this._pending_all = true;
			this._pending_rows.clear();
			this._kick_raf();
		}

		_kick_raf() {
			if ( this._raf_id ) return;
			this._raf_id = (window.requestAnimationFrame || setTimeout)( () => {
				this._raf_id = 0;
				if ( this._pending_all ) {
					this._pending_all = false;
					this.refresh_all();
					return;
				}
				const rows = Array.from( this._pending_rows );
				this._pending_rows.clear();
				rows.forEach( (r) => this.refresh_row( r ) );
			}, 0 );
		}


		refresh_all() {
			this.builder?.pages_container
				?.querySelectorAll?.( '.wpbc_bfb__row' )
				?.forEach?.( (row) => this.refresh_row( row ) );
		}

		refresh_row(row_el) {
			if ( !row_el ) return;

			const cols = row_el.querySelectorAll( ':scope > .wpbc_bfb__column' );

			// 1) Recalculate each column’s required min px and write it to the CSS var.
			cols.forEach( (col) => this.apply_col_min( col ) );

			// 2) Enforce it at the CSS level right away so layout can’t render narrower.
			cols.forEach( (col) => {
				const px           = parseFloat( getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0' ) || 0;
				col.style.minWidth = px > 0 ? Math.round( px ) + 'px' : '';
			} );

			// 3) Normalize current bases so the row respects all mins without overflow.
			try {
				const b   = this.builder;
				const gp  = b.col_gap_percent;
				const eff = b.layout.compute_effective_bases_from_row( row_el, gp );  // { bases, available }
				// Re-fit *current* bases against mins (same algorithm layout chips use).
				const fitted = UI.WPBC_BFB_Layout_Chips._fit_weights_respecting_min( b, row_el, eff.bases );
				if ( Array.isArray( fitted ) ) {
					const changed = fitted.some( (v, i) => Math.abs( v - eff.bases[i] ) > 0.01 );
					if ( changed ) {
						b.layout.apply_bases_to_row( row_el, fitted );
					}
				}
			} catch ( e ) {
				w._wpbc?.dev?.error?.( 'WPBC_BFB_Min_Width_Guard - refresh_row', e );
			}
		}

		apply_col_min(col_el) {
			if ( !col_el ) return;
			let max_px    = 0;
			const colRect = col_el.getBoundingClientRect();
			col_el.querySelectorAll( ':scope > .wpbc_bfb__field' ).forEach( (field) => {
				const raw = field.getAttribute( 'data-min_width' );
				let px    = 0;
				if ( raw ) {
					const s = String( raw ).trim().toLowerCase();
					if ( s.endsWith( '%' ) ) {
						const n = parseFloat( s );
						if ( Number.isFinite( n ) && colRect.width > 0 ) {
							px = (n / 100) * colRect.width;
						} else {
							px = 0;
						}
					} else {
						px = this.parse_len_px( s );
					}
				} else {
					const cs = getComputedStyle( field );
					px       = parseFloat( cs.minWidth || '0' ) || 0;
				}
				if ( px > max_px ) max_px = px;
			} );
			col_el.style.setProperty( '--wpbc-col-min', max_px > 0 ? Math.round( max_px ) + 'px' : '0px' );
		}

		parse_len_px(value) {
			if ( value == null ) return 0;
			const s = String( value ).trim().toLowerCase();
			if ( s === '' ) return 0;
			if ( s.endsWith( 'px' ) ) {
				const n = parseFloat( s );
				return Number.isFinite( n ) ? n : 0;
			}
			if ( s.endsWith( 'rem' ) || s.endsWith( 'em' ) ) {
				const n    = parseFloat( s );
				const base = parseFloat( getComputedStyle( document.documentElement ).fontSize ) || 16;
				return Number.isFinite( n ) ? n * base : 0;
			}
			const n = parseFloat( s );
			return Number.isFinite( n ) ? n : 0;
		}
	};

	/**
	 * WPBC_BFB_Toggle_Normalizer
	 *
	 * Converts plain checkboxes into toggle UI:
	 * <div class="inspector__control wpbc_ui__toggle">
	 *   <input type="checkbox" id="{unique}" data-inspector-key="..." class="inspector__input" role="switch"
	 * aria-checked="true|false">
	 *   <label class="wpbc_ui__toggle_icon"  for="{unique}"></label>
	 *   <label class="wpbc_ui__toggle_label" for="{unique}">Label</label>
	 * </div>
	 *
	 * - Skips inputs already inside `.wpbc_ui__toggle`.
	 * - Reuses an existing <label for="..."> text if present; otherwise falls back to nearby labels or attributes.
	 * - Auto-generates a unique id when absent.
	 */
	UI.WPBC_BFB_Toggle_Normalizer = class {

		/**
		 * Upgrade all raw checkboxes in a container to toggles.
		 * @param {HTMLElement} root_el
		 */
		static upgrade_checkboxes_in(root_el) {

			if ( !root_el || !root_el.querySelectorAll ) {
				return;
			}

			var inputs = root_el.querySelectorAll( 'input[type="checkbox"]' );
			if ( !inputs.length ) {
				return;
			}

			Array.prototype.forEach.call( inputs, function (input) {

				// 1) Skip if already inside toggle wrapper.
				if ( input.closest( '.wpbc_ui__toggle' ) ) {
					return;
				}
				// Skip rows / where input checkbox explicitly marked with  attribute 'data-wpbc-ui-no-toggle'.
				if ( input.hasAttribute( 'data-wpbc-ui-no-toggle' ) ) {
					return;
				}

				// 2) Ensure unique id; prefer existing.
				var input_id = input.getAttribute( 'id' );
				if ( !input_id ) {
					var key  = (input.dataset && input.dataset.inspectorKey) ? String( input.dataset.inspectorKey ) : 'opt';
					input_id = UI.WPBC_BFB_Toggle_Normalizer.generate_unique_id( 'wpbc_ins_auto_' + key + '_' );
					input.setAttribute( 'id', input_id );
				}

				// 3) Find best label text.
				var label_text = UI.WPBC_BFB_Toggle_Normalizer.resolve_label_text( root_el, input, input_id );

				// 4) Build the toggle wrapper.
				var wrapper       = document.createElement( 'div' );
				wrapper.className = 'inspector__control wpbc_ui__toggle';

				// Keep original input; just move it into wrapper.
				input.classList.add( 'inspector__input' );
				input.setAttribute( 'role', 'switch' );
				input.setAttribute( 'aria-checked', input.checked ? 'true' : 'false' );

				var icon_label       = document.createElement( 'label' );
				icon_label.className = 'wpbc_ui__toggle_icon';
				icon_label.setAttribute( 'for', input_id );

				var text_label       = document.createElement( 'label' );
				text_label.className = 'wpbc_ui__toggle_label';
				text_label.setAttribute( 'for', input_id );
				text_label.appendChild( document.createTextNode( label_text ) );

				// 5) Insert wrapper into DOM near the input.
				//    Preferred: replace the original labeled row if it matches typical inspector layout.
				var replaced = UI.WPBC_BFB_Toggle_Normalizer.try_replace_known_row( input, wrapper, label_text );

				if ( !replaced ) {
					if ( !input.parentNode ) return; // NEW guard
					// Fallback: just wrap the input in place and append labels.
					input.parentNode.insertBefore( wrapper, input );
					wrapper.appendChild( input );
					wrapper.appendChild( icon_label );
					wrapper.appendChild( text_label );
				}

				// 6) ARIA sync on change.
				input.addEventListener( 'change', function () {
					input.setAttribute( 'aria-checked', input.checked ? 'true' : 'false' );
				} );
			} );
		}

		/**
		 * Generate a unique id with a given prefix.
		 * @param {string} prefix
		 * @returns {string}
		 */
		static generate_unique_id(prefix) {
			var base = String( prefix || 'wpbc_ins_auto_' );
			var uid  = Math.random().toString( 36 ).slice( 2, 8 );
			var id   = base + uid;
			// Minimal collision guard in the current document scope.
			while ( document.getElementById( id ) ) {
				uid = Math.random().toString( 36 ).slice( 2, 8 );
				id  = base + uid;
			}
			return id;
		}

		/**
		 * Resolve the best human label for an input.
		 * Priority:
		 *  1) <label for="{id}">text</label>
		 *  2) nearest sibling/parent .inspector__label text
		 *  3) input.getAttribute('aria-label') || data-label || data-inspector-key || name || 'Option'
		 * @param {HTMLElement} root_el
		 * @param {HTMLInputElement} input
		 * @param {string} input_id
		 * @returns {string}
		 */
		static resolve_label_text(root_el, input, input_id) {
			// for= association
			if ( input_id ) {
				var assoc = root_el.querySelector( 'label[for="' + UI.WPBC_BFB_Toggle_Normalizer.css_escape( input_id ) + '"]' );
				if ( assoc && assoc.textContent ) {
					var txt = assoc.textContent.trim();
					// Remove the old label from DOM; its text will be used by toggle.
					assoc.parentNode && assoc.parentNode.removeChild( assoc );
					if ( txt ) {
						return txt;
					}
				}
			}

			// nearby inspector label
			var near_label = input.closest( '.inspector__row' );
			if ( near_label ) {
				var il = near_label.querySelector( '.inspector__label' );
				if ( il && il.textContent ) {
					var t2 = il.textContent.trim();
					// If this row had the standard label+control, drop the old text label to avoid duplicates.
					il.parentNode && il.parentNode.removeChild( il );
					if ( t2 ) {
						return t2;
					}
				}
			}

			// fallbacks
			var aria = input.getAttribute( 'aria-label' );
			if ( aria ) {
				return aria;
			}
			if ( input.dataset && input.dataset.label ) {
				return String( input.dataset.label );
			}
			if ( input.dataset && input.dataset.inspectorKey ) {
				return String( input.dataset.inspectorKey );
			}
			if ( input.name ) {
				return String( input.name );
			}
			return 'Option';
		}

		/**
		 * Try to replace a known inspector row pattern with a toggle wrapper.
		 * Patterns:
		 *  <div.inspector__row>
		 *    <label.inspector__label>Text</label>
		 *    <div.inspector__control> [input[type=checkbox]] </div>
		 *  </div>
		 *
		 * @param {HTMLInputElement} input
		 * @param {HTMLElement} wrapper
		 * @returns {boolean} replaced
		 */
		static try_replace_known_row(input, wrapper, label_text) {
			var row       = input.closest( '.inspector__row' );
			var ctrl_wrap = input.parentElement;

			if ( row && ctrl_wrap && ctrl_wrap.classList.contains( 'inspector__control' ) ) {
				// Clear control wrap and reinsert toggle structure.
				while ( ctrl_wrap.firstChild ) {
					ctrl_wrap.removeChild( ctrl_wrap.firstChild );
				}
				row.classList.add( 'inspector__row--toggle' );

				ctrl_wrap.classList.add( 'wpbc_ui__toggle' );
				ctrl_wrap.appendChild( input );

				var input_id       = input.getAttribute( 'id' );
				var icon_lbl       = document.createElement( 'label' );
				icon_lbl.className = 'wpbc_ui__toggle_icon';
				icon_lbl.setAttribute( 'for', input_id );

				var text_lbl       = document.createElement( 'label' );
				text_lbl.className = 'wpbc_ui__toggle_label';
				text_lbl.setAttribute( 'for', input_id );
				if ( label_text ) {
					text_lbl.appendChild( document.createTextNode( label_text ) );
				}
				// If the row previously had a .inspector__label (we removed it in resolve_label_text),
				// we intentionally do NOT recreate it; the toggle text label becomes the visible one.
				// The text content is already resolved in resolve_label_text() and set below by caller.

				ctrl_wrap.appendChild( icon_lbl );
				ctrl_wrap.appendChild( text_lbl );
				return true;
			}

			// Not a known pattern; caller will wrap in place.
			return false;
		}

		/**
		 * CSS.escape polyfill for selectors.
		 * @param {string} s
		 * @returns {string}
		 */
		static css_escape(s) {
			s = String( s );
			if ( window.CSS && typeof window.CSS.escape === 'function' ) {
				return window.CSS.escape( s );
			}
			return s.replace( /([^\w-])/g, '\\$1' );
		}
	};

	/**
	 * Apply all UI normalizers/enhancers to a container (post-render).
	 * Keep this file small and add more normalizers later in one place.
	 *
	 * @param {HTMLElement} root
	 */
	UI.apply_post_render = function (root) {
		if ( !root ) {
			return;
		}
		try {
			UI.WPBC_BFB_ValueSlider?.init_on?.( root );
		} catch ( e ) { /* noop */
		}
		try {
			var T = UI.WPBC_BFB_Toggle_Normalizer;
			if ( T && typeof T.upgrade_checkboxes_in === 'function' ) {
				T.upgrade_checkboxes_in( root );
			}
		} catch ( e ) {
			w._wpbc?.dev?.error?.( 'apply_post_render.toggle', e );
		}

		// Accessibility: keep aria-checked in sync for all toggles inside root.
		try {
			root.querySelectorAll( '.wpbc_ui__toggle input[type="checkbox"]' ).forEach( function (cb) {
				if ( cb.__wpbc_aria_hooked ) {
					return;
				}
				cb.__wpbc_aria_hooked = true;
				cb.setAttribute( 'aria-checked', cb.checked ? 'true' : 'false' );
				// Delegate ‘change’ just once per render – native delegation still works fine for your logic.
				cb.addEventListener( 'change', () => {
					cb.setAttribute( 'aria-checked', cb.checked ? 'true' : 'false' );
				}, { passive: true } );
			} );
		} catch ( e ) {
			w._wpbc?.dev?.error?.( 'apply_post_render.aria', e );
		}
	};

	UI.InspectorEnhancers = UI.InspectorEnhancers || (function () {
		var regs = [];

		function register(name, selector, init, destroy) {
			regs.push( { name, selector, init, destroy } );
		}

		function scan(root) {
			if ( !root ) return;
			regs.forEach( function (r) {
				root.querySelectorAll( r.selector ).forEach( function (node) {
					node.__wpbc_eh = node.__wpbc_eh || {};
					if ( node.__wpbc_eh[r.name] ) return;
					try {
						r.init && r.init( node, root );
						node.__wpbc_eh[r.name] = true;
					} catch ( _e ) {
					}
				} );
			} );
		}

		function destroy(root) {
			if ( !root ) return;
			regs.forEach( function (r) {
				root.querySelectorAll( r.selector ).forEach( function (node) {
					try {
						r.destroy && r.destroy( node, root );
					} catch ( _e ) {
					}
					if ( node.__wpbc_eh ) delete node.__wpbc_eh[r.name];
				} );
			} );
		}

		return { register, scan, destroy };
	})();

	UI.WPBC_BFB_ValueSlider = {
		init_on(root) {
			var groups = (root.nodeType === 1 ? [ root ] : []).concat( [].slice.call( root.querySelectorAll?.( '[data-len-group]' ) || [] ) );
			groups.forEach( function (g) {
				if ( !g.matches || !g.matches( '[data-len-group]' ) ) return;
				if ( g.__wpbc_len_wired ) return;

				var number = g.querySelector( '[data-len-value]' );
				var range  = g.querySelector( '[data-len-range]' );
				var unit   = g.querySelector( '[data-len-unit]' );

				if ( !number || !range ) return;

				// Mirror constraints if missing on the range.
				[ 'min', 'max', 'step' ].forEach( function (a) {
					if ( !range.hasAttribute( a ) && number.hasAttribute( a ) ) {
						range.setAttribute( a, number.getAttribute( a ) );
					}
				} );


				function sync_range_from_number() {
					if ( g.hasAttribute( 'data-len-allow-empty' ) && '' === number.value ) {
						var empty_range_value = range.min || '0';
						if ( range.value !== empty_range_value ) {
							range.value = empty_range_value;
						}
						return;
					}
					if ( range.value !== number.value ) {
						range.value = number.value;
					}
				}

				function dispatch_input(el) {
					try { el.dispatchEvent( new Event( 'input', { bubbles: true } ) ); } catch ( _e ) {}
				}
				function dispatch_change(el) {
					try { el.dispatchEvent( new Event( 'change', { bubbles: true } ) ); } catch ( _e ) {}
				}

				// Throttle range->number syncing (time-based).
				var timer_id       = 0;
				var pending_val    = null;
				var pending_change = false;
				var last_flush_ts  = 0;

				// Change this to tune speed: 50..120 ms is a good range.
				var min_interval_ms = parseInt( g.dataset.lenThrottle || UI.VALUE_SLIDER_THROTTLE_MS, 10 );
				min_interval_ms = Number.isFinite( min_interval_ms ) ? Math.max( 0, min_interval_ms ) : 120;

				function flush_range_to_number() {
					timer_id = 0;

					if ( pending_val == null ) {
						return;
					}

					var next    = String( pending_val );
					pending_val = null;

					if ( number.value !== next ) {
						number.value = next;
						// IMPORTANT: only 'input' while dragging.
						dispatch_input( number );
					}

					if ( pending_change ) {
						pending_change = false;
						dispatch_change( number );
					}

					last_flush_ts = Date.now();
				}

				function schedule_range_to_number(val, emit_change) {
					pending_val = val;
					if ( emit_change ) {
						pending_change = true;
					}

					// If commit requested, flush immediately.
					if ( pending_change ) {
						if ( timer_id ) {
							clearTimeout( timer_id );
							timer_id = 0;
						}
						flush_range_to_number();
						return;
					}

					var now   = Date.now();
					var delta = now - last_flush_ts;

					// If enough time passed, flush immediately; else schedule.
					if ( delta >= min_interval_ms ) {
						flush_range_to_number();
						return;
					}

					if ( timer_id ) {
						return;
					}

					timer_id = setTimeout( flush_range_to_number, Math.max( 0, min_interval_ms - delta ) );
				}

				function on_number_input() {
					sync_range_from_number();
				}

				function on_number_change() {
					sync_range_from_number();
				}

				function on_range_input() {
					schedule_range_to_number( range.value, false );
				}

				function on_range_change() {
					schedule_range_to_number( range.value, true );
				}

				number.addEventListener( 'input',  on_number_input );
				number.addEventListener( 'change', on_number_change );
				range.addEventListener( 'input',  on_range_input );
				range.addEventListener( 'change', on_range_change );

				if ( unit ) {
					unit.addEventListener( 'change', function () {
						// We just nudge the number so upstream handlers re-run.
						try {
							number.dispatchEvent( new Event( 'input', { bubbles: true } ) );
						} catch ( _e ) {
						}
					} );
				}

				// Initial sync
				sync_range_from_number();

				g.__wpbc_len_wired = {
					destroy() {
						number.removeEventListener( 'input',  on_number_input );
						number.removeEventListener( 'change', on_number_change );
						range.removeEventListener( 'input',  on_range_input );
						range.removeEventListener( 'change', on_range_change );
					}
				};
			} );
		},
		destroy_on(root) {
			var groups = (root && root.nodeType === 1 ? [ root ] : []).concat(
				[].slice.call( root.querySelectorAll?.( '[data-len-group]' ) || [] )
			);
			groups.forEach( function (g) {
				if ( !g.matches || !g.matches( '[data-len-group]' ) ) return;
				try {
					g.__wpbc_len_wired && g.__wpbc_len_wired.destroy && g.__wpbc_len_wired.destroy();
				} catch ( _e ) {
				}
				delete g.__wpbc_len_wired;
			} );
		}
	};

	// Register with the global enhancers hub.
	UI.InspectorEnhancers && UI.InspectorEnhancers.register(
		'value-slider',
		'[data-len-group]',
		function (el, _root) {
			UI.WPBC_BFB_ValueSlider.init_on( el );
		},
		function (el, _root) {
			UI.WPBC_BFB_ValueSlider.destroy_on( el );
		}
	);

	// Single, load-order-safe patch so enhancers auto-run on every bind.
	(function patchInspectorEnhancers() {
		function applyPatch() {
			var Inspector = w.WPBC_BFB_Inspector;
			if ( !Inspector || Inspector.__wpbc_enhancers_patched ) return false;
			Inspector.__wpbc_enhancers_patched = true;
			var orig                           = Inspector.prototype.bind_to_field;
			Inspector.prototype.bind_to_field  = function (el) {
				orig.call( this, el );
				try {
					var ins = this.panel
						|| document.getElementById( 'wpbc_bfb__inspector' )
						|| document.querySelector( '.wpbc_bfb__inspector' );
					UI.InspectorEnhancers && UI.InspectorEnhancers.scan( ins );
				} catch ( _e ) {
				}
			};
			// Initial scan if the DOM is already present.
			try {
				var insEl = document.getElementById( 'wpbc_bfb__inspector' )
					|| document.querySelector( '.wpbc_bfb__inspector' );
				UI.InspectorEnhancers && UI.InspectorEnhancers.scan( insEl );
			} catch ( _e ) {
			}
			return true;
		}

		// Try now; if Inspector isn’t defined yet, patch when it becomes ready.
		if ( !applyPatch() ) {
			document.addEventListener(
				'wpbc_bfb_inspector_ready',
				function () {
					applyPatch();
				},
				{ once: true }
			);
		}
	})();

}( window, document ));

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/__js/core/bfb-sync-code-tools-tab.js   | 2026-04-06 | 16:38
// ---------------------------------------------------------------------------------------------------------------------
(function ( w, d ) {
	'use strict';

	/**
	 * Dispatch request to show a right sidebar panel.
	 *
	 * @param {string} panel_id
	 * @param {string} tab_id
	 *
	 * @return {void}
	 */
	function wpbc_bfb__dispatch_show_panel( panel_id, tab_id ) {

		var event_detail;

		if ( ! panel_id || ! tab_id ) {
			return;
		}

		event_detail = {
			panel_id: panel_id,
			tab_id  : tab_id
		};

		if ( typeof w.wpbc_bfb__dispatch_event_safe === 'function' ) {
			w.wpbc_bfb__dispatch_event_safe( 'wpbc_bfb:show_panel', event_detail );
			return;
		}

		d.dispatchEvent(
			new CustomEvent(
				'wpbc_bfb:show_panel',
				{
					detail: event_detail
				}
			)
		);
	}

	/**
	 * Sync right sidebar with top mode tabs.
	 *
	 * Uses top tabs nav attribute `data-active-tab` as the source of truth.
	 * This avoids false detection on initial page load, because top panels are
	 * hidden by inline style `display:none`, not by the `hidden` attribute.
	 */
	class WPBC_BFB_Mode_Rightbar_Sync {

		constructor() {
			this.top_tabs_nav      = null;
			this.advanced_tab_wrap = null;
			this.advanced_panel    = null;
			this.mutation_observer = null;
			this.last_mode         = '';
			this.sync_rightbar_mode = this.sync_rightbar_mode.bind( this );
			this.handle_click      = this.handle_click.bind( this );
		}

		/**
		 * Init controller.
		 *
		 * @return {void}
		 */
		init() {
			this.top_tabs_nav      = d.getElementById( 'wpbc_bfb__top_horisontal_nav' );
			this.advanced_tab_wrap = d.querySelector( '.wpbc_bfb__rightbar_tab_wrap--advanced_tools' );
			this.advanced_panel    = d.getElementById( 'wpbc_bfb__inspector_advanced_tools' );

			if ( ! this.advanced_tab_wrap || ! this.advanced_panel ) {
				return;
			}

			// Observe active tab changes in the top tabs nav.
			if ( this.top_tabs_nav ) {
				this.mutation_observer = new MutationObserver( this.sync_rightbar_mode );
				this.mutation_observer.observe(
					this.top_tabs_nav,
					{
						attributes     : true,
						attributeFilter: [ 'data-active-tab' ]
					}
				);
			}

			// Fallback for click-driven switching.
			d.addEventListener( 'click', this.handle_click, true );

			// Initial sync.
			this.sync_rightbar_mode();
		}

		/**
		 * Get active top tab id.
		 *
		 * Priority:
		 * 1. data-active-tab from top tabs nav
		 * 2. active CSS class in nav
		 * 3. visible top panel fallback
		 *
		 * @return {string}
		 */
		get_active_top_tab_id() {
			var active_tab_id = '';
			var active_link   = null;
			var advanced_panel = null;
			var builder_panel  = null;

			if ( this.top_tabs_nav ) {
				active_tab_id = String( this.top_tabs_nav.getAttribute( 'data-active-tab' ) || '' ).trim();
				if ( '' !== active_tab_id ) {
					return active_tab_id;
				}

				active_link = this.top_tabs_nav.querySelector( '.wpbc_ui_el__horis_nav_item.active [data-wpbc-bfb-tab]' );
				if ( active_link ) {
					active_tab_id = String( active_link.getAttribute( 'data-wpbc-bfb-tab' ) || '' ).trim();
					if ( '' !== active_tab_id ) {
						return active_tab_id;
					}
				}
			}

			// Final fallback: detect visible panel.
			advanced_panel = d.querySelector( '.wpbc_bfb__top_tab_section__advanced_tab' );
			builder_panel  = d.querySelector( '.wpbc_bfb__top_tab_section__builder_tab' );

			if ( this.is_element_visible( advanced_panel ) ) {
				return 'advanced_tab';
			}
			if ( this.is_element_visible( builder_panel ) ) {
				return 'builder_tab';
			}

			return '';
		}

		/**
		 * Check element visibility.
		 *
		 * @param {HTMLElement|null} el
		 *
		 * @return {boolean}
		 */
		is_element_visible( el ) {
			var style;

			if ( ! el ) {
				return false;
			}

			style = w.getComputedStyle( el );

			if ( ! style ) {
				return false;
			}

			if ( 'none' === style.display ) {
				return false;
			}

			if ( 'hidden' === style.visibility ) {
				return false;
			}

			return true;
		}

		/**
		 * Check if Advanced Mode is active.
		 *
		 * @return {boolean}
		 */
		is_advanced_mode_active() {
			return ( 'advanced_tab' === this.get_active_top_tab_id() );
		}

		/**
		 * Show Code Tools tab button.
		 *
		 * @return {void}
		 */
		show_advanced_tools_tab() {
			this.advanced_tab_wrap.removeAttribute( 'hidden' );
			this.advanced_tab_wrap.setAttribute( 'aria-hidden', 'false' );
		}

		/**
		 * Hide Code Tools tab button.
		 *
		 * @return {void}
		 */
		hide_advanced_tools_tab() {
			this.advanced_tab_wrap.setAttribute( 'hidden', 'true' );
			this.advanced_tab_wrap.setAttribute( 'aria-hidden', 'true' );
		}

		/**
		 * Check if Code Tools panel is currently active.
		 *
		 * @return {boolean}
		 */
		is_advanced_tools_panel_active() {
			return !! ( this.advanced_panel && ! this.advanced_panel.hasAttribute( 'hidden' ) );
		}

		/**
		 * Open Code Tools panel.
		 *
		 * @return {void}
		 */
		open_advanced_tools_panel() {
			wpbc_bfb__dispatch_show_panel( 'wpbc_bfb__inspector_advanced_tools', 'wpbc_tab_advanced_tools' );
		}

		/**
		 * Open default builder rightbar panel.
		 *
		 * @return {void}
		 */
		open_default_visual_panel() {
			wpbc_bfb__dispatch_show_panel( 'wpbc_bfb__palette_add_new', 'wpbc_tab_library' );
		}

		/**
		 * Sync rightbar mode with top tabs mode.
		 *
		 * @return {void}
		 */
		sync_rightbar_mode() {
			var is_advanced_mode = this.is_advanced_mode_active();

			if ( is_advanced_mode ) {
				this.show_advanced_tools_tab();

				if ( 'advanced' !== this.last_mode ) {
					this.open_advanced_tools_panel();
				}

				this.last_mode = 'advanced';
				return;
			}

			if ( this.is_advanced_tools_panel_active() ) {
				this.open_default_visual_panel();
			}

			this.hide_advanced_tools_tab();
			this.last_mode = 'builder';
		}

		/**
		 * Fallback click handler for top tabs.
		 *
		 * @param {Event} event
		 *
		 * @return {void}
		 */
		handle_click( event ) {
			var target = event.target.closest( '[data-wpbc-bfb-tab]' );
			var this_obj = this;

			if ( ! target ) {
				return;
			}

			setTimeout(
				function () {
					this_obj.sync_rightbar_mode();
				},
				0
			);
		}
	}

	if ( d.readyState === 'loading' ) {
		d.addEventListener(
			'DOMContentLoaded',
			function () {
				( new WPBC_BFB_Mode_Rightbar_Sync() ).init();
			}
		);
	} else {
		( new WPBC_BFB_Mode_Rightbar_Sync() ).init();
	}

})( window, document );
// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/_out/core/bfb-inspector.js == Time point: 2025-09-06 14:08
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
	'use strict';

	// 1) Actions registry.

	/** @type {Record<string, (ctx: InspectorActionContext) => void>} */
	const __INSPECTOR_ACTIONS_MAP__ = Object.create( null );

	// Built-ins.
	__INSPECTOR_ACTIONS_MAP__['deselect'] = ({ builder }) => {
		builder?.select_field?.( null );
	};

	__INSPECTOR_ACTIONS_MAP__['scrollto'] = ({ builder, el }) => {
		if ( !el || !document.body.contains( el ) ) return;
		builder?.select_field?.( el, { scrollIntoView: true } );
		el.classList.add( 'wpbc_bfb__scroll-pulse' );
		setTimeout( () => el.classList.remove( 'wpbc_bfb__scroll-pulse' ), 700 );
	};

	__INSPECTOR_ACTIONS_MAP__['move-up'] = ({ builder, el }) => {
		if ( !el ) return;
		builder?.move_item?.( el, 'up' );
		// Scroll after the DOM has settled.
		requestAnimationFrame(() => __INSPECTOR_ACTIONS_MAP__['scrollto']({ builder, el }));
	};

	__INSPECTOR_ACTIONS_MAP__['move-down'] = ({ builder, el }) => {
		if ( !el ) return;
		builder?.move_item?.( el, 'down' );
		// Scroll after the DOM has settled.
		requestAnimationFrame(() => __INSPECTOR_ACTIONS_MAP__['scrollto']({ builder, el }));
	};

	__INSPECTOR_ACTIONS_MAP__['delete'] = ({ builder, el, confirm = w.confirm }) => {
		if ( !el ) return;
		const is_field = el.classList.contains( 'wpbc_bfb__field' );
		const label    = is_field
			? (el.querySelector( '.wpbc_bfb__field-label' )?.textContent || el.dataset?.id || 'field')
			: (el.dataset?.id || 'section');

		UI.Modal_Confirm_Delete.open( label, () => {
			// Central command will remove, emit events, and reselect neighbor (which re-binds Inspector).
			builder?.delete_item?.( el );
		} );

	};

	__INSPECTOR_ACTIONS_MAP__['duplicate'] = ({ builder, el }) => {
		if ( !el ) return;
		const clone = builder?.duplicate_item?.( el );
		if ( clone ) builder?.select_field?.( clone, { scrollIntoView: true } );
	};

	// Public API.
	w.WPBC_BFB_Inspector_Actions = {
		run(name, ctx) {
			const fn = __INSPECTOR_ACTIONS_MAP__[name];
			if ( typeof fn === 'function' ) fn( ctx );
			else console.warn( 'WPBC. Inspector action not found:', name );
		},
		register(name, handler) {
			if ( !name || typeof handler !== 'function' ) {
				throw new Error( 'register(name, handler): invalid arguments' );
			}
			__INSPECTOR_ACTIONS_MAP__[name] = handler;
		},
		has(name) {
			return typeof __INSPECTOR_ACTIONS_MAP__[name] === 'function';
		}
	};

	// 2) Inspector Factory.

	var UI = (w.WPBC_BFB_Core.UI = w.WPBC_BFB_Core.UI || {});

	// Global Hybrid++ registries (keep public).
	w.wpbc_bfb_inspector_factory_slots      = w.wpbc_bfb_inspector_factory_slots || {};
	w.wpbc_bfb_inspector_factory_value_from = w.wpbc_bfb_inspector_factory_value_from || {};

	// Define Factory only if missing (no early return for the whole bundle).
	// always define/replace Factory
	{

		/**
		 * Utility: create element with attributes and children.
		 *
		 * @param {string} tag
		 * @param {Object=} attrs
		 * @param {(Node|string|Array<Node|string>)=} children
		 * @returns {HTMLElement}
		 */
		function el(tag, attrs, children) {
			var node = document.createElement( tag );
			if ( attrs ) {
				Object.keys( attrs ).forEach( function (k) {
					var v = attrs[k];
					if ( v == null ) return;
					if ( k === 'class' ) {
						node.className = v;
						return;
					}
					if ( k === 'dataset' ) {
						Object.keys( v ).forEach( function (dk) {
							node.dataset[dk] = String( v[dk] );
						} );
						return;
					}
					if ( k === 'checked' && typeof v === 'boolean' ) {
						if ( v ) node.setAttribute( 'checked', 'checked' );
						return;
					}
					if ( k === 'disabled' && typeof v === 'boolean' ) {
						if ( v ) node.setAttribute( 'disabled', 'disabled' );
						return;
					}
					// normalize boolean attributes to strings.
					if ( typeof v === 'boolean' ) {
						node.setAttribute( k, v ? 'true' : 'false' );
						return;
					}
					node.setAttribute( k, String( v ) );
				} );
			}
			if ( children ) {
				(Array.isArray( children ) ? children : [ children ]).forEach( function (c) {
					if ( c == null ) return;
					node.appendChild( (typeof c === 'string') ? document.createTextNode( c ) : c );
				} );
			}
			return node;
		}

		/**
		 * Build a toggle control row (checkbox rendered as toggle).
		 *
		 * Structure:
		 * <div class="inspector__row inspector__row--toggle">
		 *   <div class="inspector__control wpbc_ui__toggle">
		 *     <input type="checkbox" id="ID" data-inspector-key="KEY" class="inspector__input" checked>
		 *     <label class="wpbc_ui__toggle_icon"  for="ID"></label>
		 *     <label class="wpbc_ui__toggle_label" for="ID">Label text</label>
		 *   </div>
		 * </div>
		 *
		 * @param {string} input_id
		 * @param {string} key
		 * @param {boolean} checked
		 * @param {string} label_text
		 * @returns {HTMLElement}
		 */
		function build_toggle_row( input_id, key, checked, label_text ) {

			var row_el    = el( 'div', { 'class': 'inspector__row inspector__row--toggle' } );
			var ctrl_wrap = el( 'div', { 'class': 'inspector__control wpbc_ui__toggle' } );

			var input_el = el( 'input', {
				id                  : input_id,
				type                : 'checkbox',
				'data-inspector-key': key,
				'class'             : 'inspector__input',
				checked             : !!checked,
				role                : 'switch',
				'aria-checked'      : !!checked
			} );
			var icon_lbl = el( 'label', { 'class': 'wpbc_ui__toggle_icon', 'for': input_id } );
			var text_lbl = el( 'label', { 'class': 'wpbc_ui__toggle_label', 'for': input_id }, label_text || '' );

			ctrl_wrap.appendChild( input_el );
			ctrl_wrap.appendChild( icon_lbl );
			ctrl_wrap.appendChild( text_lbl );

			row_el.appendChild( ctrl_wrap );
			return row_el;
		}

		/**
	 * Utility: choose initial value from data or schema default.
	 */
		function get_initial_value(key, data, props_schema) {
			if ( data && Object.prototype.hasOwnProperty.call( data, key ) ) return data[key];
			var meta = props_schema && props_schema[key];
			return (meta && Object.prototype.hasOwnProperty.call( meta, 'default' )) ? meta.default : '';
		}

		/**
	 * Utility: coerce value by schema type.
	 */


		function coerce_by_type(value, type) {
			switch ( type ) {
				case 'number':
				case 'int':
				case 'float':
					if ( value === '' || value == null ) {
						return '';
					}
					var n = Number( value );
					return isNaN( n ) ? '' : n;
				case 'boolean':
					return !!value;
				case 'array':
					return Array.isArray( value ) ? value : [];
				default:
					return (value == null) ? '' : String( value );
			}
		}

		/**
	 * Normalize <select> options (array of {value,label} or map {value:label}).
	 */
		function normalize_select_options(options) {
			if ( Array.isArray( options ) ) {
				return options.map( function (o) {
					if ( typeof o === 'object' && o && 'value' in o ) {
						return { value: String( o.value ), label: String( o.label || o.value ) };
					}
					return { value: String( o ), label: String( o ) };
				} );
			}
			if ( options && typeof options === 'object' ) {
				return Object.keys( options ).map( function (k) {
					return { value: String( k ), label: String( options[k] ) };
				} );
			}
			return [];
		}

		/** Parse a CSS length like "120px" or "80%" into { value:number, unit:string }. */
		function parse_len(value, fallback_unit) {
			value = (value == null) ? '' : String( value ).trim();
			var m = value.match( /^(-?\d+(?:\.\d+)?)(px|%|rem|em)$/i );
			if ( m ) {
				return { value: parseFloat( m[1] ), unit: m[2].toLowerCase() };
			}
			// plain number -> assume fallback unit
			if ( value !== '' && !isNaN( Number( value ) ) ) {
				return { value: Number( value ), unit: (fallback_unit || 'px') };
			}
			return { value: 0, unit: (fallback_unit || 'px') };
		}

		/** Clamp helper. */
		function clamp_num(v, min, max) {
			if ( typeof v !== 'number' || isNaN( v ) ) return (min != null ? min : 0);
			if ( min != null && v < min ) v = min;
			if ( max != null && v > max ) v = max;
			return v;
		}

		// Initialize Coloris pickers in a given root.
		// Relies on Coloris being enqueued (see bfb-bootstrap.php).
		function init_coloris_pickers(root) {
			if ( !root || !w.Coloris ) return;
			// Mark inputs we want Coloris to handle.
			var inputs = root.querySelectorAll( 'input[data-inspector-type="color"]' );
			if ( !inputs.length ) return;

			// Add a stable class for Coloris targeting; avoid double-initializing.
			inputs.forEach( function (input) {
				if ( input.classList.contains( 'wpbc_bfb_coloris' ) ) return;
				input.classList.add( 'wpbc_bfb_coloris' );
			} );

			// Create/refresh a Coloris instance bound to these inputs.
			// Keep HEX output to match schema defaults (e.g., "#e0e0e0").
			try {
				w.Coloris( {
					el       : '.wpbc_bfb_coloris',
					alpha    : false,
					format   : 'hex',
					themeMode: 'auto'
				} );
				// Coloris already dispatches 'input' events on value changes.
			} catch ( e ) {
				// Non-fatal: if Coloris throws (rare), the text input still works.
				console.warn( 'WPBC Inspector: Coloris init failed:', e );
			}
		}

		/**
		 * Build: slider + number in one row (writes to a single data key).
		 * Control meta: { type:'range_number', key, label, min, max, step }
		 */
		function build_range_number_row(input_id, key, label_text, value, meta) {
			var row_el   = el('div', { 'class': 'inspector__row' });
			var label_el = el('label', { 'for': input_id, 'class': 'inspector__label' }, label_text || key || '');
			var ctrl     = el('div', { 'class': 'inspector__control' });

			var min  = (meta && meta.min != null)  ? meta.min  : 0;
			var max  = (meta && meta.max != null)  ? meta.max  : 100;
			var step = (meta && meta.step != null) ? meta.step : 1;

			var group = el('div', { 'class': 'wpbc_len_group wpbc_inline_inputs', 'data-len-group': key });

			var range = el('input', {
				type : 'range',
				'class': 'inspector__input',
				'data-len-range': '',
				min  : String(min),
				max  : String(max),
				step : String(step),
				value: String(value == null || value === '' ? min : value)
			});

			var num = el('input', {
				id   : input_id,
				type : 'number',
				'class': 'inspector__input inspector__w_30',
				'data-len-value': '',
				'data-inspector-key': key,
				min  : String(min),
				max  : String(max),
				step : String(step),
				value: (value == null || value === '') ? String(min) : String(value)
			});

			group.appendChild(range);
			group.appendChild(num);
			ctrl.appendChild(group);
			row_el.appendChild(label_el);
			row_el.appendChild(ctrl);
			return row_el;
		}

		/**
		 * Build: (number + unit) + slider, writing a *single* combined string to `key`.
		 * Control meta:
		 * {
		 *   type:'len', key, label, units:['px','%','rem','em'],
		 *   slider: { px:{min:0,max:512,step:1}, '%':{min:0,max:100,step:1}, rem:{min:0,max:10,step:0.1}, em:{...} },
		 *   fallback_unit:'px'
		 * }
		 */
		function build_len_compound_row(control, props_schema, data, uid) {
			var key        = control.key;
			var label_text = control.label || key || '';
			var def_str    = get_initial_value( key, data, props_schema );
			var fallback_u = control.fallback_unit || 'px';
			var parsed     = parse_len( def_str, fallback_u );

			var row   = el( 'div', { 'class': 'inspector__row' } );
			var label = el( 'label', { 'class': 'inspector__label' }, label_text );
			var ctrl  = el( 'div', { 'class': 'inspector__control' } );

			var units      = Array.isArray( control.units ) && control.units.length ? control.units : [ 'px', '%', 'rem', 'em' ];
			var slider_map = control.slider || {
				'px' : { min: 0, max: 512, step: 1 },
				'%'  : { min: 0, max: 100, step: 1 },
				'rem': { min: 0, max: 10, step: 0.1 },
				'em' : { min: 0, max: 10, step: 0.1 }
			};

			// Host with a hidden input that carries data-inspector-key to reuse the standard handler.
			var group = el( 'div', { 'class': 'wpbc_len_group', 'data-len-group': key } );

			var inline = el( 'div', { 'class': 'wpbc_inline_inputs' } );

			var num = el( 'input', {
				type            : 'number',
				'class'         : 'inspector__input',
				'data-len-value': '',
				min             : '0',
				step            : 'any',
				value           : String( parsed.value )
			} );

			var sel = el( 'select', { 'class': 'inspector__input', 'data-len-unit': '' } );
			units.forEach( function (u) {
				var opt = el( 'option', { value: u }, u );
				if ( u === parsed.unit ) opt.setAttribute( 'selected', 'selected' );
				sel.appendChild( opt );
			} );

			inline.appendChild( num );
			inline.appendChild( sel );

			// Slider (unit-aware)
			var current = slider_map[parsed.unit] || slider_map[units[0]];
			var range   = el( 'input', {
				type            : 'range',
				'class'         : 'inspector__input',
				'data-len-range': '',
				min             : String( current.min ),
				max             : String( current.max ),
				step            : String( current.step ),
				value           : String( clamp_num( parsed.value, current.min, current.max ) )
			} );

			// Hidden writer input that the default Inspector handler will catch.
			var hidden = el( 'input', {
				type                : 'text',
				'class'             : 'inspector__input',
				style               : 'display:none',
				'aria-hidden'       : 'true',
				tabindex            : '-1',
				id                  : 'wpbc_ins_' + key + '_' + uid + '_len_hidden',
				'data-inspector-key': key,
				value               : (String( parsed.value ) + parsed.unit)
			} );

			group.appendChild( inline );
			group.appendChild( range );
			group.appendChild( hidden );

			ctrl.appendChild( group );
			row.appendChild( label );
			row.appendChild( ctrl );
			return row;
		}

		/**
		 * Wire syncing for any .wpbc_len_group inside a given root (panel).
		 * - range ⇄ number sync
		 * - unit switches update slider bounds
		 * - hidden writer (if present) gets updated and emits 'input'
		 */
		function wire_len_group(root) {
			if ( !root ) return;

			function find_group(el) {
				return el && el.closest && el.closest( '.wpbc_len_group' );
			}

			root.addEventListener( 'input', function (e) {
				var t = e.target;
				// Slider moved -> update number (and writer/hidden)
				if ( t && t.hasAttribute( 'data-len-range' ) ) {
					var g = find_group( t );
					if ( !g ) return;
					var num = g.querySelector( '[data-len-value]' );
					if ( num ) {
						num.value = t.value;
					}
					var writer = g.querySelector( '[data-inspector-key]' );
					if ( writer && writer.type === 'text' ) {
						var unit     = g.querySelector( '[data-len-unit]' );
						unit         = unit ? unit.value : 'px';
						writer.value = String( t.value ) + String( unit );
						// trigger standard inspector handler:
						writer.dispatchEvent( new Event( 'input', { bubbles: true } ) );
					} else {
						// Plain range_number case (number has data-inspector-key) -> fire input on number
						if ( num && num.hasAttribute( 'data-inspector-key' ) ) {
							num.dispatchEvent( new Event( 'input', { bubbles: true } ) );
						}
					}
				}

				// Number typed -> update slider and writer/hidden
				if ( t && t.hasAttribute( 'data-len-value' ) ) {
					var g = find_group( t );
					if ( !g ) return;
					var r = g.querySelector( '[data-len-range]' );
					if ( r ) {
						// clamp within slider bounds if present
						var min = Number( r.min );
						var max = Number( r.max );
						var v   = Number( t.value );
						if ( !isNaN( v ) ) {
							v       = clamp_num( v, isNaN( min ) ? undefined : min, isNaN( max ) ? undefined : max );
							r.value = String( v );
							if ( String( v ) !== t.value ) t.value = String( v );
						}
					}
					var writer = g.querySelector( '[data-inspector-key]' );
					if ( writer && writer.type === 'text' ) {
						var unit     = g.querySelector( '[data-len-unit]' );
						unit         = unit ? unit.value : 'px';
						writer.value = String( t.value || 0 ) + String( unit );
						writer.dispatchEvent( new Event( 'input', { bubbles: true } ) );
					}
					// else: number itself likely carries data-inspector-key (range_number); default handler will run.
				}
			}, true );

			root.addEventListener( 'change', function (e) {
				var t = e.target;
				// Unit changed -> update slider limits and writer/hidden
				if ( t && t.hasAttribute( 'data-len-unit' ) ) {
					var g = find_group( t );
					if ( !g ) return;

					// Find the control meta via a data attribute on group if provided
					// (Factory path sets nothing here; we re-derive from current slider bounds.)
					var r      = g.querySelector( '[data-len-range]' );
					var num    = g.querySelector( '[data-len-value]' );
					var writer = g.querySelector( '[data-inspector-key]' );
					var unit   = t.value || 'px';

					// Adjust slider bounds heuristically (match Factory defaults)
					var bounds_by_unit = {
						'px' : { min: 0, max: 512, step: 1 },
						'%'  : { min: 0, max: 100, step: 1 },
						'rem': { min: 0, max: 10, step: 0.1 },
						'em' : { min: 0, max: 10, step: 0.1 }
					};
					if ( r ) {
						var b  = bounds_by_unit[unit] || bounds_by_unit['px'];
						r.min  = String( b.min );
						r.max  = String( b.max );
						r.step = String( b.step );
						// clamp to new bounds
						var v  = Number( num && num.value ? num.value : r.value );
						if ( !isNaN( v ) ) {
							v       = clamp_num( v, b.min, b.max );
							r.value = String( v );
							if ( num ) num.value = String( v );
						}
					}
					if ( writer && writer.type === 'text' ) {
						var v        = num && num.value ? num.value : (r ? r.value : '0');
						writer.value = String( v ) + String( unit );
						writer.dispatchEvent( new Event( 'input', { bubbles: true } ) );
					}
				}
			}, true );
		}

		// =============================================================================================================
		// ==  C O N T R O L  ==
		// =============================================================================================================

		/**
	 * Schema > Inspector > Control Element, e.g. Input!  Build a single control row:
	 * <div class="inspector__row">
	 *   <label class="inspector__label" for="...">Label</label>
	 *   <div class="inspector__control"><input|textarea|select class="inspector__input" ...></div>
	 * </div>
	 *
	 * @param {Object} control           - schema control meta ({type,key,label,...})
	 * @param {Object} props_schema      - schema.props
	 * @param {Object} data              - current element data-* map
	 * @param {string} uid               - unique suffix for input ids
	 * @param {Object} ctx               - { el, builder, type, data }
	 * @returns {HTMLElement}
	 */
		function build_control(control, props_schema, data, uid, ctx) {
			var type = control.type;
			var key  = control.key;

			var label_text = control.label || key || '';
			var prop_meta  = (key ? (props_schema[key] || { type: 'string' }) : { type: 'string' });
			var value      = coerce_by_type( get_initial_value( key, data, props_schema ), prop_meta.type );
		// Allow value_from override (computed at render-time).
		if ( control && control.value_from && w.wpbc_bfb_inspector_factory_value_from[control.value_from] ) {
				try {
					var computed = w.wpbc_bfb_inspector_factory_value_from[control.value_from]( ctx || {} );
					value        = coerce_by_type( computed, prop_meta.type );
				} catch ( e ) {
					console.warn( 'value_from failed for', control.value_from, e );
				}
			}

			var input_id = 'wpbc_ins_' + key + '_' + uid;

			var row_el    = el( 'div', { 'class': 'inspector__row' } );
			var label_el  = el( 'label', { 'for': input_id, 'class': 'inspector__label' }, label_text );
			var ctrl_wrap = el( 'div', { 'class': 'inspector__control' } );

			var field_el;

		// --- slot host (named UI injection) -----------------------------------
		if ( type === 'slot' && control.slot ) {
			// add a marker class for the layout chips row
			var classes = 'inspector__row inspector__row--slot';
			if ( control.slot === 'layout_chips' ) classes += ' inspector__row--layout-chips';

			var slot_row = el( 'div', { 'class': classes } );

			if ( label_text ) slot_row.appendChild( el( 'label', { 'class': 'inspector__label' }, label_text ) );

			// add a data attribute on the host so both CSS and the safety-net can target it
			var host_attrs = { 'class': 'inspector__control' };
			if ( control.slot === 'layout_chips' ) host_attrs['data-bfb-slot'] = 'layout_chips';

			var slot_host = el( 'div', host_attrs );
			slot_row.appendChild( slot_host );

			var slot_fn = w.wpbc_bfb_inspector_factory_slots[control.slot];
			if ( typeof slot_fn === 'function' ) {
				setTimeout( function () {
					try {
						slot_fn( slot_host, ctx || {} );
					} catch ( e ) {
						console.warn( 'slot "' + control.slot + '" failed:', e );
					}
				}, 0 );
			} else {
				slot_host.appendChild( el( 'div', { 'class': 'wpbc_bfb__slot__missing' }, '[slot: ' + control.slot + ']' ) );
			}
			return slot_row;
		}


			if ( type === 'textarea' ) {
				field_el = el( 'textarea', {
					id                  : input_id,
					'data-inspector-key': key,
					rows                : control.rows || 3,
					'class'             : 'inspector__input'
				}, (value == null ? '' : String( value )) );
			} else if ( type === 'select' ) {
				field_el = el( 'select', {
					id                  : input_id,
					'data-inspector-key': key,
					'class'             : 'inspector__input'
				} );
				normalize_select_options( control.options || [] ).forEach( function (opt) {
					var opt_el = el( 'option', { value: opt.value }, opt.label );
					if ( String( value ) === opt.value ) opt_el.setAttribute( 'selected', 'selected' );
					field_el.appendChild( opt_el );
				} );
			} else if ( type === 'checkbox' ) {
				// field_el = el( 'input', { id: input_id, type: 'checkbox', 'data-inspector-key': key, checked: !!value, 'class': 'inspector__input' } ); //.

				// Render as toggle UI instead of label-left + checkbox.  Note: we return the full toggle row here and skip the default row/label flow below.
				return build_toggle_row( input_id, key, !!value, label_text );

			} else if ( type === 'range_number' ) {
				// --- new: slider + number (single key).
				var rn_id  = 'wpbc_ins_' + key + '_' + uid;
				var rn_val = value; // from get_initial_value/prop_meta already.
				return build_range_number_row( rn_id, key, label_text, rn_val, control );

			} else if ( type === 'len' ) {
				// --- new: length compound (value+unit+slider -> writes a single string key).
				return build_len_compound_row( control, props_schema, data, uid );

			} else if ( type === 'color' ) {
				// Color picker (Coloris). Store as string (e.g., "#e0e0e0").
				field_el = el( 'input', {
					id                   : input_id,
					type                 : 'text',
					'data-inspector-key' : key,
					'data-inspector-type': 'color',
					'data-coloris'       : '',
					'class'              : 'inspector__input',
					'data-default-color' : ( value != null && value !== '' ? String(value) : (control.placeholder || '') )
				} );
				if ( value !== '' ) {
					field_el.value = String( value );
				}
			} else {
				// text/number default.
				var attrs = {
					id                  : input_id,
					type                : (type === 'number') ? 'number' : 'text',
					'data-inspector-key': key,
					'class'             : 'inspector__input'
				};
			// number constraints (schema or control)
				if ( type === 'number' ) {
					if ( Object.prototype.hasOwnProperty.call( prop_meta, 'min' ) ) attrs.min = prop_meta.min;
					if ( Object.prototype.hasOwnProperty.call( prop_meta, 'max' ) ) attrs.max = prop_meta.max;
					if ( Object.prototype.hasOwnProperty.call( prop_meta, 'step' ) ) attrs.step = prop_meta.step;
					if ( Object.prototype.hasOwnProperty.call( control, 'min' ) ) attrs.min = control.min;
					if ( Object.prototype.hasOwnProperty.call( control, 'max' ) ) attrs.max = control.max;
					if ( Object.prototype.hasOwnProperty.call( control, 'step' ) ) attrs.step = control.step;
				}
				field_el = el( 'input', attrs );
				if ( value !== '' ) field_el.value = String( value );
			}

			ctrl_wrap.appendChild( field_el );
			row_el.appendChild( label_el );
			row_el.appendChild( ctrl_wrap );
			return row_el;
		}

		/**
		 * Schema > Inspector > Groups! Build an inspector group (collapsible).
		 * Structure:
		 * <section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="...">
		 *   <button type="button" class="group__header" role="button" aria-expanded="true" aria-controls="wpbc_collapsible_panel_X">
		 *     <h3>Group Title</h3>
		 *     <i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
		 *   </button>
		 *   <div class="group__fields" id="wpbc_collapsible_panel_X" aria-hidden="false"> …rows… </div>
		 * </section>
		 *
		 * @param {Object} group
		 * @param {Object} props_schema
		 * @param {Object} data
		 * @param {string} uid
		 * @param {Object} ctx
		 * @returns {HTMLElement}
		 */
		function build_group(group, props_schema, data, uid, ctx) {
			var is_open  = !!group.open;
			var panel_id = 'wpbc_collapsible_panel_' + uid + '_' + (group.key || 'g');

			var section = el( 'section', {
				'class'     : 'wpbc_bfb__inspector__group wpbc_ui__collapsible_group' + (is_open ? ' is-open' : ''),
				'data-group': group.key || ''
			} );

			var header_btn = el( 'button', {
				type           : 'button',
				'class'        : 'group__header',
				role           : 'button',
				'aria-expanded': is_open ? 'true' : 'false',
				'aria-controls': panel_id
			}, [
				el( 'h3', null, group.title || group.label || group.key || '' ),
				el( 'i', { 'class': 'wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right' } )
			] );

			var fields = el( 'div', {
				'class'      : 'group__fields',
				id           : panel_id,
				'aria-hidden': is_open ? 'false' : 'true'
			} );

			function asArray(x) {
				if ( Array.isArray( x ) ) return x;
				if ( x && typeof x === 'object' ) return Object.values( x );
				return x != null ? [ x ] : [];
			}

			asArray( group.controls ).forEach( function (control) {
				fields.appendChild( build_control( control, props_schema, data, uid, ctx ) );
			} );

			section.appendChild( header_btn );
			section.appendChild( fields );
			return section;
		}

		/**
		 * Schema > Inspector > Header! Build inspector header with action buttons wired to existing data-action handlers.
		 *
		 * @param {Array<string>} header_actions
		 * @param {string}        title_text
		 * @returns {HTMLElement}
		 */
		function build_header(inspector_ui, title_fallback, schema_for_type) {

			inspector_ui      = inspector_ui || {};
			schema_for_type   = schema_for_type || {};
			var variant       = inspector_ui.header_variant || 'minimal';
			var headerActions = inspector_ui.header_actions
				|| schema_for_type.header_actions
				|| [ 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ];

			var title       = inspector_ui.title || title_fallback || '';
			var description = inspector_ui.description || '';

			// helper to create a button for either header style
			function actionBtn(act, minimal) {
				if ( minimal ) {
					return el( 'button', { type: 'button', 'class': 'button-link', 'data-action': act }, '' );
				}
				// toolbar variant (rich)
				var iconMap = {
					'deselect' : 'wpbc_icn_near_me_disabled',
					'scrollto' : 'wpbc_icn_ads_click filter_center_focus',
					'move-up'  : 'wpbc_icn_arrow_upward',
					'move-down': 'wpbc_icn_arrow_downward',
					'duplicate': 'wpbc_icn_content_copy',
					'delete'   : 'wpbc_icn_delete_outline'
				};
				var classes = 'button button-secondary wpbc_ui_control wpbc_ui_button';
				if ( act === 'delete' ) classes += ' wpbc_ui_button_danger button-link-delete';

				var btn = el( 'button', {
					type         : 'button',
					'class'      : classes,
					'data-action': act,
					'aria-label' : act.replace( /-/g, ' ' )
				} );

				if ( act === 'delete' ) {
					btn.appendChild( el( 'span', { 'class': 'in-button-text' }, 'Delete' ) );
					btn.appendChild( document.createTextNode( ' ' ) ); // minor spacing before icon
				}
				btn.appendChild( el( 'i', { 'class': 'menu_icon icon-1x ' + (iconMap[act] || '') } ) );
				return btn;
			}

			// === minimal header (existing look; default) ===
			if ( variant !== 'toolbar' ) {
				var header = el( 'header', { 'class': 'wpbc_bfb__inspector__header' } );
				header.appendChild( el( 'h3', null, title || '' ) );

				var actions = el( 'div', { 'class': 'wpbc_bfb__inspector__header_actions' } );
				headerActions.forEach( function (act) {
					actions.appendChild( actionBtn( act, /*minimal*/true ) );
				} );
				header.appendChild( actions );
				return header;
			}

			// === toolbar header (rich title/desc + grouped buttons) ===
			var root = el( 'div', { 'class': 'wpbc_bfb__inspector__head' } );
			var wrap = el( 'div', { 'class': 'header_container' } );
			var left = el( 'div', { 'class': 'header_title_content' } );
			var h3   = el( 'h3', { 'class': 'title' }, title || '' );
			left.appendChild( h3 );
			if ( description ) {
				left.appendChild( el( 'div', { 'class': 'desc' }, description ) );
			}

			var right = el( 'div', { 'class': 'actions wpbc_ajx_toolbar wpbc_no_borders' } );
			var uiC   = el( 'div', { 'class': 'ui_container ui_container_small' } );
			var uiG   = el( 'div', { 'class': 'ui_group' } );

			// Split into visual groups: first 2, next 2, then the rest.
			var g1 = el( 'div', { 'class': 'ui_element' } );
			var g2 = el( 'div', { 'class': 'ui_element' } );
			var g3 = el( 'div', { 'class': 'ui_element' } );

			headerActions.slice( 0, 2 ).forEach( function (act) {
				g1.appendChild( actionBtn( act, false ) );
			} );
			headerActions.slice( 2, 4 ).forEach( function (act) {
				g2.appendChild( actionBtn( act, false ) );
			} );
			headerActions.slice( 4 ).forEach( function (act) {
				g3.appendChild( actionBtn( act, false ) );
			} );

			uiG.appendChild( g1 );
			uiG.appendChild( g2 );
			uiG.appendChild( g3 );
			uiC.appendChild( uiG );
			right.appendChild( uiC );

			wrap.appendChild( left );
			wrap.appendChild( right );
			root.appendChild( wrap );

			return root;
		}


		function factory_render(panel_el, schema_for_type, data, opts) {
			if ( !panel_el ) return panel_el;

			schema_for_type  = schema_for_type || {};
			var props_schema = (schema_for_type.schema && schema_for_type.schema.props) ? schema_for_type.schema.props : {};
			var inspector_ui = (schema_for_type.inspector_ui || {});
			var groups       = inspector_ui.groups || [];

			var header_actions = inspector_ui.header_actions || schema_for_type.header_actions || [];
			var title_text     = (opts && opts.title) || inspector_ui.title || schema_for_type.label || (data && data.label) || '';

		// Prepare rendering context for slots/value_from, etc.
			var ctx = {
				el     : opts && opts.el || null,
				builder: opts && opts.builder || null,
				type   : opts && opts.type || null,
				data   : data || {}
			};

			// clear panel.
			while ( panel_el.firstChild ) panel_el.removeChild( panel_el.firstChild );

			var uid = Math.random().toString( 36 ).slice( 2, 8 );

			// header.
			panel_el.appendChild( build_header( inspector_ui, title_text, schema_for_type ) );


			// groups.
			groups.forEach( function (g) {
				panel_el.appendChild( build_group( g, props_schema, data || {}, uid, ctx ) );
			} );

			// ARIA sync for toggles created here (ensure aria-checked matches state).
			try {
				// Centralized UI normalizers (toggles + A11y): handled in Core.
				UI.apply_post_render( panel_el );
				try {
					wire_len_group( panel_el );
					// Initialize Coloris on color inputs rendered in this panel.
					init_coloris_pickers( panel_el );
				} catch ( _ ) { }
			} catch ( _ ) { }

			return panel_el;
		}

		UI.WPBC_BFB_Inspector_Factory = { render: factory_render };   // overwrite/refresh

		// ---- Built-in slot + value_from for Sections ----

		function slot_layout_chips(host, ctx) {
			try {
				var L = w.WPBC_BFB_Core &&  w.WPBC_BFB_Core.UI && w.WPBC_BFB_Core.UI.WPBC_BFB_Layout_Chips;
				if ( L && typeof L.render_for_section === 'function' ) {
					L.render_for_section( ctx.builder, ctx.el, host );
				} else {
					host.appendChild( document.createTextNode( '[layout_chips not available]' ) );
				}
			} catch ( e ) {
				console.warn( 'wpbc_bfb_slot_layout_chips failed:', e );
			}
		}

		w.wpbc_bfb_inspector_factory_slots.layout_chips = slot_layout_chips;

		function value_from_compute_section_columns(ctx) {
			try {
				var row = ctx && ctx.el && ctx.el.querySelector && ctx.el.querySelector( ':scope > .wpbc_bfb__row' );
				if ( !row ) return 1;
				var n = row.querySelectorAll( ':scope > .wpbc_bfb__column' ).length || 1;
				if ( n < 1 ) n = 1;
				if ( n > 4 ) n = 4;
				return n;
			} catch ( _ ) {
				return 1;
			}
		}

		w.wpbc_bfb_inspector_factory_value_from.compute_section_columns = value_from_compute_section_columns;
	}

	// 3) Inspector class.

	class WPBC_BFB_Inspector {

		constructor(panel_el, builder) {
			this.panel         = panel_el || this._create_fallback_panel();
			this.builder       = builder;
			this.selected_el   = null;
			this._render_timer = null;

			this._on_delegated_input  = (e) => this._apply_control_from_event( e );
			this._on_delegated_change = (e) => this._apply_control_from_event( e );
			this.panel.addEventListener( 'input', this._on_delegated_input, true );
			this.panel.addEventListener( 'change', this._on_delegated_change, true );

			this._on_delegated_click = (e) => {
				const btn = e.target.closest( '[data-action]' );
				if ( !btn || !this.panel.contains( btn ) ) return;
				e.preventDefault();
				e.stopPropagation();

				const action = btn.getAttribute( 'data-action' );
				const el     = this.selected_el;
				if ( !el ) return;

				w.WPBC_BFB_Inspector_Actions?.run( action, {
					builder: this.builder,
					el,
					panel  : this.panel,
					event  : e
				} );

				if ( action === 'delete' ) this.clear();
			};
			this.panel.addEventListener( 'click', this._on_delegated_click );
		}

		_post_render_ui() {
			try {
				var UI = w.WPBC_BFB_Core && w.WPBC_BFB_Core.UI;
				if ( UI && typeof UI.apply_post_render === 'function' ) {
					UI.apply_post_render( this.panel );
				}
				// NEW: wire slider/number/unit syncing for length & range_number groups.
				try {
					wire_len_group( this.panel );
					init_coloris_pickers( this.panel );
				} catch ( _ ) {
				}
			} catch ( e ) {
				_wpbc?.dev?.error?.( 'inspector._post_render_ui', e );
			}
		}


		_apply_control_from_event(e) {
			if ( !this.panel.contains( e.target ) ) return;

			const t   = /** @type {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} */ (e.target);
			const key = t?.dataset?.inspectorKey;
			if ( !key ) return;

			const el = this.selected_el;
			if ( !el || !document.body.contains( el ) ) return;

			let v;
			if ( t instanceof HTMLInputElement && t.type === 'checkbox' ) {
				v = !!t.checked;
				t.setAttribute( 'aria-checked', v ? 'true' : 'false' );         // Keep ARIA state in sync for toggles (schema and template paths).
			} else if ( t instanceof HTMLInputElement && t.type === 'number' ) {
				v = (t.value === '' ? '' : Number( t.value ));
			} else {
				v = t.value;
			}

			if ( key === 'id' ) {
				const unique = this.builder?.id?.set_field_id?.( el, v );
				if ( unique != null && t.value !== unique ) t.value = unique;

			} else if ( key === 'name' ) {
				const unique = this.builder?.id?.set_field_name?.( el, v );
				if ( unique != null && t.value !== unique ) t.value = unique;

			} else if ( key === 'html_id' ) {
				const applied = this.builder?.id?.set_field_html_id?.( el, v );
				if ( applied != null && t.value !== applied ) t.value = applied;

			} else if ( key === 'columns' && el.classList.contains( 'wpbc_bfb__section' ) ) {
				const v_int = parseInt( String( v ), 10 );
				if ( Number.isFinite( v_int ) ) {
					const clamped = w.WPBC_BFB_Core.WPBC_BFB_Sanitize.clamp( v_int, 1, 4 );
					this.builder?.set_section_columns?.( el, clamped );
					if ( String( clamped ) !== t.value ) t.value = String( clamped );
				}

			} else {
				if ( t instanceof HTMLInputElement && t.type === 'checkbox' ) {
					el.setAttribute( 'data-' + key, String( !!v ) );
				} else if ( t instanceof HTMLInputElement && t.type === 'number' ) {
					if ( t.value === '' || !Number.isFinite( v ) ) {
						el.removeAttribute( 'data-' + key );
					} else {
						el.setAttribute( 'data-' + key, String( v ) );
					}
				} else if ( v == null ) {
					el.removeAttribute( 'data-' + key );
				} else {
					el.setAttribute( 'data-' + key, (typeof v === 'object') ? JSON.stringify( v ) : String( v ) );
				}
			}

			// Update preview/overlay
			if ( el.classList.contains( 'wpbc_bfb__field' ) ) {
				if ( this.builder?.preview_mode ) this.builder.render_preview( el );
				else this.builder.add_overlay_toolbar( el );
			} else {
				this.builder.add_overlay_toolbar( el );
			}

			if ( this._needs_rerender( el, key, e ) ) {
				this._schedule_render_preserving_focus( 0 );
			}
		}

		_needs_rerender(el, key, _e) {
			if ( el.classList.contains( 'wpbc_bfb__section' ) && key === 'columns' ) return true;
			return false;
		}

		bind_to_field(field_el) {
			this.selected_el = field_el;
			this.render();
		}

		clear() {
			this.selected_el = null;
			if ( this._render_timer ) {
				clearTimeout( this._render_timer );
				this._render_timer = null;
			}
			// Also clear the section-cols hint on empty state.
			this.panel.removeAttribute('data-bfb-section-cols');
			this.panel.innerHTML = '<div class="wpbc_bfb__inspector__empty">Select a field to edit its options.</div>';
		}

		_schedule_render_preserving_focus(delay = 200) {
			const active    = /** @type {HTMLInputElement|HTMLTextAreaElement|HTMLElement|null} */ (document.activeElement);
			const activeKey = active?.dataset?.inspectorKey || null;
			let selStart    = null, selEnd = null;

			if ( active && 'selectionStart' in active && 'selectionEnd' in active ) {
				// @ts-ignore
				selStart = active.selectionStart;
				// @ts-ignore
				selEnd   = active.selectionEnd;
			}

			if ( this._render_timer ) clearTimeout( this._render_timer );
			this._render_timer = /** @type {unknown} */ (setTimeout( () => {
				this.render();
				if ( activeKey ) {
					const next = /** @type {HTMLInputElement|HTMLTextAreaElement|HTMLElement|null} */ (
						this.panel.querySelector( `[data-inspector-key="${activeKey}"]` )
					);
					if ( next ) {
						next.focus();
						try {
							if ( selStart != null && selEnd != null && typeof next.setSelectionRange === 'function' ) {
								// @ts-ignore
								next.setSelectionRange( selStart, selEnd );
							}
						} catch( e ){ _wpbc?.dev?.error( '_render_timer', e ); }
					}
				}
			}, delay ));
		}

		render() {

			const el = this.selected_el;
			if ( !el || !document.body.contains( el ) ) return this.clear();

			// Reset section-cols hint unless we set it later for a section.
			this.panel.removeAttribute( 'data-bfb-section-cols' );

			const prev_scroll = this.panel.scrollTop;

			// Section
			if ( el.classList.contains( 'wpbc_bfb__section' ) ) {
				let tpl = null;
				try {
					tpl = (w.wp && wp.template && document.getElementById( 'tmpl-wpbc-bfb-inspector-section' )) ? wp.template( 'wpbc-bfb-inspector-section' ) : null;
				} catch ( _ ) {
					tpl = null;
				}

				if ( tpl ) {
					this.panel.innerHTML = tpl( {} );
					this._enforce_default_group_open();
					this._set_panel_section_cols( el );
					this._post_render_ui();
					this.panel.scrollTop = prev_scroll;
					return;
				}

				const Factory = w.WPBC_BFB_Core.UI && w.WPBC_BFB_Core.UI.WPBC_BFB_Inspector_Factory;
				const schemas = w.WPBC_BFB_Schemas || {};
				const entry   = schemas['section'] || null;
				if ( entry && Factory ) {
					this.panel.innerHTML = '';
					Factory.render(
						this.panel,
						entry,
						{},
						{ el, builder: this.builder, type: 'section', title: entry.label || 'Section' }
					);
					this._enforce_default_group_open();

					// --- Safety net: if for any reason the slot didn’t render chips, inject them now.
					try {
						const hasSlotHost =
								  this.panel.querySelector( '[data-bfb-slot="layout_chips"]' ) ||
								  this.panel.querySelector( '.inspector__row--layout-chips .wpbc_bfb__layout_chips' ) ||
								  this.panel.querySelector( '#wpbc_bfb__layout_chips_host' );

						const hasChips =
								  !!this.panel.querySelector( '.wpbc_bfb__layout_chip' );

						if ( !hasChips ) {
							// Create a host if missing and render chips into it.
							const host = (function ensureHost(root) {
								let h =
										root.querySelector( '[data-bfb-slot="layout_chips"]' ) ||
										root.querySelector( '.inspector__row--layout-chips .wpbc_bfb__layout_chips' ) ||
										root.querySelector( '#wpbc_bfb__layout_chips_host' );
								if ( h ) return h;
								// Fallback host inside (or after) the “layout” group
								const fields    =
										  root.querySelector( '.wpbc_bfb__inspector__group[data-group="layout"] .group__fields' ) ||
										  root.querySelector( '.group__fields' ) || root;
								const row       = document.createElement( 'div' );
								row.className   = 'inspector__row inspector__row--layout-chips';
								const lab       = document.createElement( 'label' );
								lab.className   = 'inspector__label';
								lab.textContent = 'Layout';
								const ctl       = document.createElement( 'div' );
								ctl.className   = 'inspector__control';
								h               = document.createElement( 'div' );
								h.className     = 'wpbc_bfb__layout_chips';
								h.setAttribute( 'data-bfb-slot', 'layout_chips' );
								ctl.appendChild( h );
								row.appendChild( lab );
								row.appendChild( ctl );
								fields.appendChild( row );
								return h;
							})( this.panel );

							const L = (w.WPBC_BFB_Core && w.WPBC_BFB_Core.UI && w.WPBC_BFB_Core.UI.WPBC_BFB_Layout_Chips) ;
							if ( L && typeof L.render_for_section === 'function' ) {
								host.innerHTML = '';
								L.render_for_section( this.builder, el, host );
							}
						}
					} catch( e ){ _wpbc?.dev?.error( 'WPBC_BFB_Inspector - render', e ); }

					this._set_panel_section_cols( el );
					this.panel.scrollTop = prev_scroll;
					return;
				}

				this.panel.innerHTML = '<div class="wpbc_bfb__inspector__empty">Select a field to edit its options.</div>';
				return;
			}

			// Field
			if ( !el.classList.contains( 'wpbc_bfb__field' ) ) return this.clear();

			const data = w.WPBC_BFB_Core.WPBC_Form_Builder_Helper.get_all_data_attributes( el );
			const type = data.type || 'text';

			function _get_tpl(id) {
				if ( !w.wp || !wp.template ) return null;
				if ( !document.getElementById( 'tmpl-' + id ) ) return null;
				try {
					return wp.template( id );
				} catch ( e ) {
					return null;
				}
			}

			const tpl_id      = `wpbc-bfb-inspector-${type}`;
			const tpl         = _get_tpl( tpl_id );
			const generic_tpl = _get_tpl( 'wpbc-bfb-inspector-generic' );

			const schemas         = w.WPBC_BFB_Schemas || {};
			const schema_for_type = schemas[type] || null;
			const Factory         = w.WPBC_BFB_Core.UI && w.WPBC_BFB_Core.UI.WPBC_BFB_Inspector_Factory;

			if ( tpl ) {
				// NEW: merge schema defaults so missing keys (esp. booleans) honor defaults on first paint
				const hasOwn = Function.call.bind( Object.prototype.hasOwnProperty );
				const props  = (schema_for_type && schema_for_type.schema && schema_for_type.schema.props) ? schema_for_type.schema.props : {};
				const merged = { ...data };
				if ( props ) {
					Object.keys( props ).forEach( (k) => {
						const meta = props[k] || {};
						if ( !hasOwn( data, k ) ) {
							if ( hasOwn( meta, 'default' ) ) {
								// Coerce booleans to a real boolean; leave others as-is
								merged[k] = (meta.type === 'boolean') ? !!meta.default : meta.default;
							}
						} else if ( meta.type === 'boolean' ) {
							// Explicit empty values are legacy unchecked booleans, not missing defaults.
							merged[k] = w.WPBC_BFB_Core.WPBC_BFB_Sanitize.coerce_boolean( data[k], false );
						} else if ( data[k] === '' && hasOwn( meta, 'default' ) ) {
							merged[k] = meta.default;
						}
					} );
				}
				this.panel.innerHTML = tpl( merged );

				this._post_render_ui();
			} else if ( schema_for_type && Factory ) {
				this.panel.innerHTML = '';
				Factory.render(
					this.panel,
					schema_for_type,
					{ ...data },
					{ el, builder: this.builder, type, title: data.label || '' }
				);
				// Ensure toggle normalizers and slider/number/unit wiring are attached.
				this._post_render_ui();
			} else if ( generic_tpl ) {
				this.panel.innerHTML = generic_tpl( { ...data } );
				this._post_render_ui();
			} else {

				const msg            = `There are no Inspector wp.template "${tpl_id}" or Schema for this "${String( type || '' )}" element.`;
				this.panel.innerHTML = '';
				const div            = document.createElement( 'div' );
				div.className        = 'wpbc_bfb__inspector__empty';
				div.textContent      = msg; // safe.
				this.panel.appendChild( div );
			}

			this._enforce_default_group_open();
			this.panel.scrollTop = prev_scroll;
		}

		_enforce_default_group_open() {
			const groups = Array.from( this.panel.querySelectorAll( '.wpbc_bfb__inspector__group' ) );
			if ( !groups.length ) return;

			let found = false;
			groups.forEach( (g) => {
				if ( !found && g.classList.contains( 'is-open' ) ) {
					found = true;
				} else {
					if ( g.classList.contains( 'is-open' ) ) {
						g.classList.remove( 'is-open' );
						g.dispatchEvent( new Event( 'wpbc:collapsible:close', { bubbles: true } ) );
					} else {
						g.classList.remove( 'is-open' );
					}
				}
			} );

			if ( !found ) {
				groups[0].classList.add( 'is-open' );
				groups[0].dispatchEvent( new Event( 'wpbc:collapsible:open', { bubbles: true } ) );
			}
		}

		/**
		 * Set data-bfb-section-cols on the inspector panel based on the current section.
		 * Uses the registered compute fn if available; falls back to direct DOM.
		 * @param {HTMLElement} sectionEl
		 */
		_set_panel_section_cols(sectionEl) {
			try {
				// Prefer the already-registered value_from helper if present.
				var compute = w.wpbc_bfb_inspector_factory_value_from && w.wpbc_bfb_inspector_factory_value_from.compute_section_columns;

				var cols = 1;
				if ( typeof compute === 'function' ) {
					cols = compute( { el: sectionEl } ) || 1;
				} else {
					// Fallback: compute directly from the DOM.
					var row = sectionEl && sectionEl.querySelector( ':scope > .wpbc_bfb__row' );
					cols    = row ? (row.querySelectorAll( ':scope > .wpbc_bfb__column' ).length || 1) : 1;
					if ( cols < 1 ) cols = 1;
					if ( cols > 4 ) cols = 4;
				}
				this.panel.setAttribute( 'data-bfb-section-cols', String( cols ) );
			} catch ( _ ) {
			}
		}


		_create_fallback_panel() {
			const p     = document.createElement( 'div' );
			p.id        = 'wpbc_bfb__inspector';
			p.className = 'wpbc_bfb__inspector';
			document.body.appendChild( p );
			return /** @type {HTMLDivElement} */ (p);
		}
	}

	// Export class + ready signal.
	w.WPBC_BFB_Inspector = WPBC_BFB_Inspector;
	document.dispatchEvent( new Event( 'wpbc_bfb_inspector_ready' ) );

})( window );

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImJmYi1jb3JlLmpzIiwiYmZiLWZpZWxkcy5qcyIsImJmYi11aS5qcyIsImJmYi1zeW5jLWNvZGUtdG9vbHMtdGFiLmpzIiwiYmZiLWluc3BlY3Rvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcnVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOTNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJ3cGJjX2JmYi5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9jb3JlL2JmYi1jb3JlLmpzID09IHwgMjAyNS0wOS0xMCAxNTo0N1xyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICggdyApIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8vIFNpbmdsZSBnbG9iYWwgbmFtZXNwYWNlIChpZGVtcG90ZW50ICYgbG9hZC1vcmRlciBzYWZlKS5cclxuXHRjb25zdCBDb3JlID0gKCB3LldQQkNfQkZCX0NvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwge30gKTtcclxuXHRjb25zdCBVSSAgID0gKCBDb3JlLlVJID0gQ29yZS5VSSB8fCB7fSApO1xyXG5cclxuXHQvKipcclxuXHQgKiBDb3JlIHNhbml0aXplL2VzY2FwZS9ub3JtYWxpemUgaGVscGVycy5cclxuXHQgKiBBbGwgbWV0aG9kcyB1c2Ugc25ha2VfY2FzZTsgY2FtZWxDYXNlIGFsaWFzZXMgYXJlIHByb3ZpZGVkIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5cclxuXHQgKi9cclxuXHRDb3JlLldQQkNfQkZCX1Nhbml0aXplID0gY2xhc3Mge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXNjYXBlIHRleHQgZm9yIHNhZmUgdXNlIGluIENTUyBzZWxlY3RvcnMuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcyAtIHJhdyBzZWxlY3RvciBmcmFnbWVudFxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGVzY19jc3Mocykge1xyXG5cdFx0XHRyZXR1cm4gKHcuQ1NTICYmIHcuQ1NTLmVzY2FwZSkgPyB3LkNTUy5lc2NhcGUoIFN0cmluZyggcyApICkgOiBTdHJpbmcoIHMgKS5yZXBsYWNlKCAvKFteXFx3LV0pL2csICdcXFxcJDEnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFc2NhcGUgYSB2YWx1ZSBmb3IgYXR0cmlidXRlIHNlbGVjdG9ycywgZS5nLiBbZGF0YS1pZD1cIjx2YWx1ZT5cIl0uXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3Rvcih2KSB7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIHYgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvXFxcXC9nLCAnXFxcXFxcXFwnIClcclxuXHRcdFx0XHQucmVwbGFjZSggL1wiL2csICdcXFxcXCInIClcclxuXHRcdFx0XHQucmVwbGFjZSggL1xcbi9nLCAnXFxcXEEgJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cXF0vZywgJ1xcXFxdJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2FuaXRpemUgaW50byBhIGJyb2FkbHkgY29tcGF0aWJsZSBIVE1MIGlkOiBsZXR0ZXJzLCBkaWdpdHMsIC0gXyA6IC4gOyBtdXN0IHN0YXJ0IHdpdGggYSBsZXR0ZXIuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNhbml0aXplX2h0bWxfaWQodikge1xyXG5cdFx0XHRsZXQgcyA9ICh2ID09IG51bGwgPyAnJyA6IFN0cmluZyggdiApKS50cmltKCk7XHJcblx0XHRcdHMgICAgID0gc1xyXG5cdFx0XHRcdC5yZXBsYWNlKCAvXFxzKy9nLCAnLScgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvW15BLVphLXowLTlcXC1fXFw6Ll0vZywgJy0nIClcclxuXHRcdFx0XHQucmVwbGFjZSggLy0rL2csICctJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9eWy1fLjpdK3xbLV8uOl0rJC9nLCAnJyApO1xyXG5cdFx0XHRpZiAoICFzICkgcmV0dXJuICdmaWVsZCc7XHJcblx0XHRcdGlmICggIS9eW0EtWmEtel0vLnRlc3QoIHMgKSApIHMgPSAnZi0nICsgcztcclxuXHRcdFx0cmV0dXJuIHM7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTYW5pdGl6ZSBpbnRvIGEgc2FmZSBIVE1MIG5hbWUgdG9rZW46IGxldHRlcnMsIGRpZ2l0cywgXyAtXHJcblx0XHQgKiBNdXN0IHN0YXJ0IHdpdGggYSBsZXR0ZXI7IG5vIGRvdHMvYnJhY2tldHMvc3BhY2VzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzYW5pdGl6ZV9odG1sX25hbWUodikge1xyXG5cclxuXHRcdFx0bGV0IHMgPSAodiA9PSBudWxsID8gJycgOiBTdHJpbmcoIHYgKSkudHJpbSgpO1xyXG5cclxuXHRcdFx0cyA9IHMucmVwbGFjZSggL1xccysvZywgJ18nICkucmVwbGFjZSggL1teQS1aYS16MC05Xy1dL2csICdfJyApLnJlcGxhY2UoIC9fKy9nLCAnXycgKTtcclxuXHJcblx0XHRcdGlmICggISBzICkge1xyXG5cdFx0XHRcdHMgPSAnZmllbGQnO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggISAvXltBLVphLXpdLy50ZXN0KCBzICkgKSB7XHJcblx0XHRcdFx0cyA9ICdmXycgKyBzO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBzO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXNjYXBlIGZvciBIVE1MIHRleHQvYXR0cmlidXRlcyAobm90IFVSTHMpLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlc2NhcGVfaHRtbCh2KSB7XHJcblx0XHRcdGlmICggdiA9PSBudWxsICkge1xyXG5cdFx0XHRcdHJldHVybiAnJztcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2IClcclxuXHRcdFx0XHQucmVwbGFjZSggLyYvZywgJyZhbXA7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cIi9nLCAnJnF1b3Q7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8nL2csICcmIzAzOTsnIClcclxuXHRcdFx0XHQucmVwbGFjZSggLzwvZywgJyZsdDsnIClcclxuXHRcdFx0XHQucmVwbGFjZSggLz4vZywgJyZndDsnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFc2NhcGUgbWluaW1hbCBzZXQgZm9yIGF0dHJpYnV0ZS1zYWZldHkgd2l0aG91dCBzbHVnZ2luZy5cclxuXHRcdCAqIEtlZXBzIG9yaWdpbmFsIGh1bWFuIHRleHQ7IGVzY2FwZXMgJiwgPCwgPiwgXCIgYW5kICcgb25seS5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZXNjYXBlX3ZhbHVlX2Zvcl9hdHRyKHMpIHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggcyA9PSBudWxsID8gJycgOiBzIClcclxuXHRcdFx0XHQucmVwbGFjZSggLyYvZywgJyZhbXA7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC88L2csICcmbHQ7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8+L2csICcmZ3Q7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cIi9nLCAnJnF1b3Q7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8nL2csICcmIzM5OycgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNhbml0aXplIGEgc3BhY2Utc2VwYXJhdGVkIENTUyBjbGFzcyBsaXN0LlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzYW5pdGl6ZV9jc3NfY2xhc3NsaXN0KHYpIHtcclxuXHRcdFx0aWYgKCB2ID09IG51bGwgKSByZXR1cm4gJyc7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIHYgKS5yZXBsYWNlKCAvW15cXHdcXC0gXSsvZywgJyAnICkucmVwbGFjZSggL1xccysvZywgJyAnICkudHJpbSgpO1xyXG5cdFx0fVxyXG4vLyA9PSBORVcgPT1cclxuXHRcdC8qKlxyXG5cdFx0ICogVHVybiBhbiBhcmJpdHJhcnkgdmFsdWUgaW50byBhIGNvbnNlcnZhdGl2ZSBcInRva2VuXCIgKHVuZGVyc2NvcmVzLCBoeXBoZW5zIGFsbG93ZWQpLlxyXG5cdFx0ICogVXNlZnVsIGZvciBzaG9ydGNvZGUgdG9rZW5zLCBpZHMgaW4gcGxhaW4gdGV4dCwgZXRjLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyB0b190b2tlbih2KSB7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIHYgPz8gJycgKVxyXG5cdFx0XHRcdC50cmltKClcclxuXHRcdFx0XHQucmVwbGFjZSggL1xccysvZywgJ18nIClcclxuXHRcdFx0XHQucmVwbGFjZSggL1teQS1aYS16MC05X1xcLV0vZywgJycgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbnZlcnQgdG8ga2ViYWItY2FzZSAobGV0dGVycywgZGlnaXRzLCBoeXBoZW5zKS5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgdG9fa2ViYWIodikge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ID8/ICcnIClcclxuXHRcdFx0XHQudHJpbSgpXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9bX1xcc10rL2csICctJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9bXkEtWmEtejAtOS1dL2csICcnIClcclxuXHRcdFx0XHQucmVwbGFjZSggLy0rL2csICctJyApXHJcblx0XHRcdFx0LnRvTG93ZXJDYXNlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUcnV0aHkgbm9ybWFsaXphdGlvbiBmb3IgZm9ybS1saWtlIGlucHV0czogdHJ1ZSwgJ3RydWUnLCAxLCAnMScsICd5ZXMnLCAnb24nLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgaXNfdHJ1dGh5KHYpIHtcclxuXHRcdFx0aWYgKCB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nICkgcmV0dXJuIHY7XHJcblx0XHRcdGNvbnN0IHMgPSBTdHJpbmcoIHYgPz8gJycgKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0cmV0dXJuIHMgPT09ICd0cnVlJyB8fCBzID09PSAnMScgfHwgcyA9PT0gJ3llcycgfHwgcyA9PT0gJ29uJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvZXJjZSB0byBib29sZWFuIHdpdGggYW4gb3B0aW9uYWwgZGVmYXVsdCBmb3IgZW1wdHkgdmFsdWVzLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlZj1mYWxzZV1cclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgY29lcmNlX2Jvb2xlYW4odiwgZGVmID0gZmFsc2UpIHtcclxuXHRcdFx0aWYgKCB2ID09IG51bGwgfHwgdiA9PT0gJycgKSByZXR1cm4gZGVmO1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5pc190cnV0aHkoIHYgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBhcnNlIGEgXCJwZXJjZW50LWxpa2VcIiB2YWx1ZSAoJzMzJ3wnMzMlJ3wzMykgd2l0aCBmYWxsYmFjay5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcnxudWxsfHVuZGVmaW5lZH0gdlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGZhbGxiYWNrX3ZhbHVlXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcGFyc2VfcGVyY2VudCh2LCBmYWxsYmFja192YWx1ZSkge1xyXG5cdFx0XHRpZiAoIHYgPT0gbnVsbCApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsbGJhY2tfdmFsdWU7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgcyA9IFN0cmluZyggdiApLnRyaW0oKTtcclxuXHRcdFx0Y29uc3QgbiA9IHBhcnNlRmxvYXQoIHMucmVwbGFjZSggLyUvZywgJycgKSApO1xyXG5cdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBuICkgPyBuIDogZmFsbGJhY2tfdmFsdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDbGFtcCBhIG51bWJlciB0byB0aGUgW21pbiwgbWF4XSByYW5nZS5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWluXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gbWF4XHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgY2xhbXAobiwgbWluLCBtYXgpIHtcclxuXHRcdFx0cmV0dXJuIE1hdGgubWF4KCBtaW4sIE1hdGgubWluKCBtYXgsIG4gKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXNjYXBlIGEgdmFsdWUgZm9yIGluY2x1c2lvbiBpbnNpZGUgYSBxdW90ZWQgSFRNTCBhdHRyaWJ1dGUgKGRvdWJsZSBxdW90ZXMpLlxyXG5cdFx0ICogUmVwbGFjZXMgbmV3bGluZXMgd2l0aCBzcGFjZXMgYW5kIGRvdWJsZSBxdW90ZXMgd2l0aCBzaW5nbGUgcXVvdGVzLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlc2NhcGVfZm9yX2F0dHJfcXVvdGVkKHYpIHtcclxuXHRcdFx0aWYgKCB2ID09IG51bGwgKSByZXR1cm4gJyc7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIHYgKS5yZXBsYWNlKCAvXFxyP1xcbi9nLCAnICcgKS5yZXBsYWNlKCAvXCIvZywgJ1xcJycgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVzY2FwZSBmb3Igc2hvcnRjb2RlLWxpa2UgdG9rZW5zIHdoZXJlIGRvdWJsZSBxdW90ZXMgYW5kIG5ld2xpbmVzIHNob3VsZCBiZSBuZXV0cmFsaXplZC5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZXNjYXBlX2Zvcl9zaG9ydGNvZGUodikge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ID8/ICcnICkucmVwbGFjZSggL1wiL2csICdcXFxcXCInICkucmVwbGFjZSggL1xccj9cXG4vZywgJyAnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBKU09OLnBhcnNlIHdpdGggZmFsbGJhY2sgKG5vIHRocm93KS5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBzXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gW2ZhbGxiYWNrPW51bGxdXHJcblx0XHQgKiBAcmV0dXJucyB7YW55fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2FmZV9qc29uX3BhcnNlKHMsIGZhbGxiYWNrID0gbnVsbCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHJldHVybiBKU09OLnBhcnNlKCBzICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxsYmFjaztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3RyaW5naWZ5IGRhdGEtKiBhdHRyaWJ1dGUgdmFsdWUgc2FmZWx5IChvYmplY3RzIC0+IEpTT04sIG90aGVycyAtPiBTdHJpbmcpLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzdHJpbmdpZnlfZGF0YV92YWx1ZSh2KSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHYgPT09ICdvYmplY3QnICYmIHYgIT09IG51bGwgKSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSggdiApO1xyXG5cdFx0XHRcdH0gY2F0Y2gge1xyXG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkM6IHN0cmluZ2lmeV9kYXRhX3ZhbHVlJyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gU3RyaWN0IHZhbHVlIGd1YXJkcyBmb3IgQ1NTIGxlbmd0aHMgYW5kIGhleCBjb2xvcnMgKGRlZmVuc2UtaW4tZGVwdGgpLlxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0LyoqXHJcblx0XHQgKiBTYW5pdGl6ZSBhIENTUyBsZW5ndGguIEFsbG93czogcHgsICUsIHJlbSwgZW0gKGxvd2VyL3VwcGVyKS5cclxuXHRcdCAqIFJldHVybnMgZmFsbGJhY2sgaWYgaW52YWxpZC5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gW2ZhbGxiYWNrPScxMDAlJ11cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzYW5pdGl6ZV9jc3NfbGVuKHYsIGZhbGxiYWNrID0gJzEwMCUnKSB7XHJcblx0XHRcdGNvbnN0IHMgPSBTdHJpbmcoIHYgPz8gJycgKS50cmltKCk7XHJcblx0XHRcdGNvbnN0IG0gPSBzLm1hdGNoKCAvXigtP1xcZCsoPzpcXC5cXGQrKT8pKHB4fCV8cmVtfGVtKSQvaSApO1xyXG5cdFx0XHRyZXR1cm4gbSA/IG1bMF0gOiBTdHJpbmcoIGZhbGxiYWNrICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTYW5pdGl6ZSBhIGhleCBjb2xvci4gQWxsb3dzICNyZ2Igb3IgI3JyZ2diYiAoY2FzZS1pbnNlbnNpdGl2ZSkuXHJcblx0XHQgKiBSZXR1cm5zIGZhbGxiYWNrIGlmIGludmFsaWQuXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gdlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtmYWxsYmFjaz0nI2UwZTBlMCddXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2FuaXRpemVfaGV4X2NvbG9yKHYsIGZhbGxiYWNrID0gJyNlMGUwZTAnKSB7XHJcblx0XHRcdGNvbnN0IHMgPSBTdHJpbmcoIHYgPz8gJycgKS50cmltKCk7XHJcblx0XHRcdHJldHVybiAvXiMoPzpbMC05YS1mXXszfXxbMC05YS1mXXs2fSkkL2kudGVzdCggcyApID8gcyA6IFN0cmluZyggZmFsbGJhY2sgKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBXUEJDIElEIC8gTmFtZSBzZXJ2aWNlLiBHZW5lcmF0ZXMsIHNhbml0aXplcywgYW5kIGVuc3VyZXMgdW5pcXVlbmVzcyBmb3IgZmllbGQgaWRzL25hbWVzL2h0bWxfaWRzIHdpdGhpbiB0aGVcclxuXHQgKiBjYW52YXMuXHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9JZFNlcnZpY2UgPSBjbGFzcyAge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29uc3RydWN0b3IuIFNldCByb290IGNvbnRhaW5lciBvZiB0aGUgZm9ybSBwYWdlcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYWdlc19jb250YWluZXIgLSBSb290IGNvbnRhaW5lciBvZiB0aGUgZm9ybSBwYWdlcy5cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3IoIHBhZ2VzX2NvbnRhaW5lciApIHtcclxuXHRcdFx0dGhpcy5wYWdlc19jb250YWluZXIgPSBwYWdlc19jb250YWluZXI7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbnN1cmUgYSB1bmlxdWUgKippbnRlcm5hbCoqIGZpZWxkIGlkIChzdG9yZWQgaW4gZGF0YS1pZCkgd2l0aGluIHRoZSBjYW52YXMuXHJcblx0XHQgKiBTdGFydHMgZnJvbSBhIGRlc2lyZWQgaWQgKGFscmVhZHkgc2FuaXRpemVkIG9yIG5vdCkgYW5kIGFwcGVuZHMgc3VmZml4ZXMgaWYgbmVlZGVkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBiYXNlSWQgLSBEZXNpcmVkIGlkLlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gVW5pcXVlIGlkLlxyXG5cdFx0ICovXHJcblx0XHRlbnN1cmVfdW5pcXVlX2ZpZWxkX2lkKGJhc2VJZCwgY3VycmVudEVsID0gbnVsbCkge1xyXG5cdFx0XHRjb25zdCBiYXNlICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCBiYXNlSWQgKTtcclxuXHRcdFx0bGV0IGlkICAgICAgICA9IGJhc2UgfHwgJ2ZpZWxkJztcclxuXHRcdFx0Y29uc3QgZXNjICAgICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdiApO1xyXG5cdFx0XHRjb25zdCBlc2NVaWQgID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCB2ICk7XHJcblx0XHRcdGNvbnN0IG5vdFNlbGYgPSBjdXJyZW50RWw/LmRhdGFzZXQ/LnVpZCA/IGA6bm90KFtkYXRhLXVpZD1cIiR7ZXNjVWlkKCBjdXJyZW50RWwuZGF0YXNldC51aWQgKX1cIl0pYCA6ICcnO1xyXG5cdFx0XHR3aGlsZSAoIHRoaXMucGFnZXNfY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yKFxyXG5cdFx0XHRcdGAud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGQke25vdFNlbGZ9W2RhdGEtaWQ9XCIke2VzYyhpZCl9XCJdLCAud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fc2VjdGlvbiR7bm90U2VsZn1bZGF0YS1pZD1cIiR7ZXNjKGlkKX1cIl1gXHJcblx0XHRcdCkgKSB7XHJcblx0XHRcdFx0Ly8gRXhjbHVkZXMgc2VsZiBieSBkYXRhLXVpZCAuXHJcblx0XHRcdFx0Y29uc3QgZm91bmQgPSB0aGlzLnBhZ2VzX2NvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCBgLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkW2RhdGEtaWQ9XCIke2VzYyggaWQgKX1cIl0sIC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19zZWN0aW9uW2RhdGEtaWQ9XCIke2VzYyggaWQgKX1cIl1gICk7XHJcblx0XHRcdFx0aWYgKCBmb3VuZCAmJiBjdXJyZW50RWwgJiYgZm91bmQgPT09IGN1cnJlbnRFbCApIHtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZCA9IGAke2Jhc2UgfHwgJ2ZpZWxkJ30tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCA1ICl9YDtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbnN1cmUgYSB1bmlxdWUgSFRNTCBuYW1lIGFjcm9zcyB0aGUgZm9ybS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYmFzZSAtIERlc2lyZWQgYmFzZSBuYW1lICh1bi9zYW5pdGl6ZWQpLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBjdXJyZW50RWwgLSBJZiBwcm92aWRlZCwgaWdub3JlIGNvbmZsaWN0cyB3aXRoIHRoaXMgZWxlbWVudC5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IFVuaXF1ZSBuYW1lLlxyXG5cdFx0ICovXHJcblx0XHRlbnN1cmVfdW5pcXVlX2ZpZWxkX25hbWUoYmFzZSwgY3VycmVudEVsID0gbnVsbCkge1xyXG5cdFx0XHRsZXQgbmFtZSAgICAgID0gYmFzZSB8fCAnZmllbGQnO1xyXG5cdFx0XHRjb25zdCBlc2MgICAgID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCB2ICk7XHJcblx0XHRcdGNvbnN0IGVzY1VpZCAgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IoIHYgKTtcclxuXHRcdFx0Ly8gRXhjbHVkZSB0aGUgY3VycmVudCBmaWVsZCAqYW5kIGFueSBET00gbWlycm9ycyBvZiBpdCogKHNhbWUgZGF0YS11aWQpXHJcblx0XHRcdGNvbnN0IHVpZCAgICAgPSBjdXJyZW50RWw/LmRhdGFzZXQ/LnVpZDtcclxuXHRcdFx0Y29uc3Qgbm90U2VsZiA9IHVpZCA/IGA6bm90KFtkYXRhLXVpZD1cIiR7ZXNjVWlkKCB1aWQgKX1cIl0pYCA6ICcnO1xyXG5cdFx0XHR3aGlsZSAoIHRydWUgKSB7XHJcblx0XHRcdFx0Y29uc3Qgc2VsZWN0b3IgPSBgLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkJHtub3RTZWxmfVtkYXRhLW5hbWU9XCIke2VzYyggbmFtZSApfVwiXWA7XHJcblx0XHRcdFx0Y29uc3QgY2xhc2hlcyAgPSB0aGlzLnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IgKSB8fCBbXTtcclxuXHRcdFx0XHRpZiAoIGNsYXNoZXMubGVuZ3RoID09PSAwICkgYnJlYWs7ICAgICAgICAgICAvLyBub2JvZHkgZWxzZSB1c2VzIHRoaXMgbmFtZVxyXG5cdFx0XHRcdGNvbnN0IG0gPSBuYW1lLm1hdGNoKCAvLShcXGQrKSQvICk7XHJcblx0XHRcdFx0bmFtZSAgICA9IG0gPyBuYW1lLnJlcGxhY2UoIC8tXFxkKyQvLCAnLScgKyAoTnVtYmVyKCBtWzFdICkgKyAxKSApIDogYCR7YmFzZX0tMmA7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIG5hbWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZmllbGQncyBJTlRFUk5BTCBpZCAoZGF0YS1pZCkgb24gYW4gZWxlbWVudC4gRW5zdXJlcyB1bmlxdWVuZXNzIGFuZCBvcHRpb25hbGx5IGFza3MgY2FsbGVyIHRvIHJlZnJlc2hcclxuXHRcdCAqIHByZXZpZXcuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZmllbGRfZWwgLSBGaWVsZCBlbGVtZW50IGluIHRoZSBjYW52YXMuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbmV3SWRSYXcgLSBEZXNpcmVkIGlkICh1bi9zYW5pdGl6ZWQpLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbcmVuZGVyUHJldmlldz1mYWxzZV0gLSBDYWxsZXIgY2FuIGRlY2lkZSB0byByZS1yZW5kZXIgcHJldmlldy5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEFwcGxpZWQgdW5pcXVlIGlkLlxyXG5cdFx0ICovXHJcblx0XHRzZXRfZmllbGRfaWQoIGZpZWxkX2VsLCBuZXdJZFJhdywgcmVuZGVyUHJldmlldyA9IGZhbHNlICkge1xyXG5cdFx0XHRjb25zdCBkZXNpcmVkID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCBuZXdJZFJhdyApO1xyXG5cdFx0XHRjb25zdCB1bmlxdWUgID0gdGhpcy5lbnN1cmVfdW5pcXVlX2ZpZWxkX2lkKCBkZXNpcmVkLCBmaWVsZF9lbCApO1xyXG5cdFx0XHRmaWVsZF9lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWlkJywgdW5pcXVlICk7XHJcblx0XHRcdGlmICggcmVuZGVyUHJldmlldyApIHtcclxuXHRcdFx0XHQvLyBDYWxsZXIgZGVjaWRlcyBpZiAvIHdoZW4gdG8gcmVuZGVyLlxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB1bmlxdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZmllbGQncyBSRVFVSVJFRCBIVE1MIG5hbWUgKGRhdGEtbmFtZSkuIEVuc3VyZXMgc2FuaXRpemVkICsgdW5pcXVlIHBlciBmb3JtLlxyXG5cdFx0ICogRmFsbHMgYmFjayB0byBzYW5pdGl6ZWQgaW50ZXJuYWwgaWQgaWYgdXNlciBwcm92aWRlcyBlbXB0eSB2YWx1ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIEZpZWxkIGVsZW1lbnQgaW4gdGhlIGNhbnZhcy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBuZXdOYW1lUmF3IC0gRGVzaXJlZCBuYW1lICh1bi9zYW5pdGl6ZWQpLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbcmVuZGVyUHJldmlldz1mYWxzZV0gLSBDYWxsZXIgY2FuIGRlY2lkZSB0byByZS1yZW5kZXIgcHJldmlldy5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEFwcGxpZWQgdW5pcXVlIG5hbWUuXHJcblx0XHQgKi9cclxuXHRcdHNldF9maWVsZF9uYW1lKCBmaWVsZF9lbCwgbmV3TmFtZVJhdywgcmVuZGVyUHJldmlldyA9IGZhbHNlICkge1xyXG5cdFx0XHRjb25zdCByYXcgID0gKG5ld05hbWVSYXcgPT0gbnVsbCA/ICcnIDogU3RyaW5nKCBuZXdOYW1lUmF3ICkpLnRyaW0oKTtcclxuXHRcdFx0Y29uc3QgYmFzZSA9IHJhd1xyXG5cdFx0XHRcdD8gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX25hbWUoIHJhdyApXHJcblx0XHRcdFx0OiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggZmllbGRfZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1pZCcgKSB8fCAnZmllbGQnICk7XHJcblxyXG5cdFx0XHRjb25zdCB1bmlxdWUgPSB0aGlzLmVuc3VyZV91bmlxdWVfZmllbGRfbmFtZSggYmFzZSwgZmllbGRfZWwgKTtcclxuXHRcdFx0ZmllbGRfZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJywgdW5pcXVlICk7XHJcblx0XHRcdGlmICggcmVuZGVyUHJldmlldyApIHtcclxuXHRcdFx0XHQvLyBDYWxsZXIgZGVjaWRlcyBpZiAvIHdoZW4gdG8gcmVuZGVyLlxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB1bmlxdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZmllbGQncyBPUFRJT05BTCBwdWJsaWMgSFRNTCBpZCAoZGF0YS1odG1sX2lkKS4gRW1wdHkgdmFsdWUgcmVtb3ZlcyB0aGUgYXR0cmlidXRlLlxyXG5cdFx0ICogRW5zdXJlcyBzYW5pdGl6YXRpb24gKyB1bmlxdWVuZXNzIGFtb25nIG90aGVyIGRlY2xhcmVkIEhUTUwgaWRzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkX2VsIC0gRmllbGQgZWxlbWVudCBpbiB0aGUgY2FudmFzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5ld0h0bWxJZFJhdyAtIERlc2lyZWQgaHRtbF9pZCAob3B0aW9uYWwpLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbcmVuZGVyUHJldmlldz1mYWxzZV0gLSBDYWxsZXIgY2FuIGRlY2lkZSB0byByZS1yZW5kZXIgcHJldmlldy5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBhcHBsaWVkIGh0bWxfaWQgb3IgZW1wdHkgc3RyaW5nIGlmIHJlbW92ZWQuXHJcblx0XHQgKi9cclxuXHRcdHNldF9maWVsZF9odG1sX2lkKCBmaWVsZF9lbCwgbmV3SHRtbElkUmF3LCByZW5kZXJQcmV2aWV3ID0gZmFsc2UgKSB7XHJcblx0XHRcdGNvbnN0IHJhdyA9IChuZXdIdG1sSWRSYXcgPT0gbnVsbCA/ICcnIDogU3RyaW5nKCBuZXdIdG1sSWRSYXcgKSkudHJpbSgpO1xyXG5cclxuXHRcdFx0aWYgKCByYXcgPT09ICcnICkge1xyXG5cdFx0XHRcdGZpZWxkX2VsLnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtaHRtbF9pZCcgKTtcclxuXHRcdFx0XHRpZiAoIHJlbmRlclByZXZpZXcgKSB7XHJcblx0XHRcdFx0XHQvLyBDYWxsZXIgZGVjaWRlcyBpZiAvIHdoZW4gdG8gcmVuZGVyLlxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gJyc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGRlc2lyZWQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfaWQoIHJhdyApO1xyXG5cdFx0XHRsZXQgaHRtbElkICAgID0gZGVzaXJlZDtcclxuXHRcdFx0Y29uc3QgZXNjICAgICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdiApO1xyXG5cdFx0XHRjb25zdCBlc2NVaWQgID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCB2ICk7XHJcblxyXG5cdFx0XHR3aGlsZSAoIHRydWUgKSB7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHVpZCAgICAgPSBmaWVsZF9lbD8uZGF0YXNldD8udWlkO1xyXG5cdFx0XHRcdGNvbnN0IG5vdFNlbGYgPSB1aWQgPyBgOm5vdChbZGF0YS11aWQ9XCIke2VzY1VpZCggdWlkICl9XCJdKWAgOiAnJztcclxuXHJcblx0XHRcdFx0Y29uc3QgY2xhc2hJbkNhbnZhcyA9IHRoaXMucGFnZXNfY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yKFxyXG5cdFx0XHRcdFx0YC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZCR7bm90U2VsZn1bZGF0YS1odG1sX2lkPVwiJHtlc2MoIGh0bWxJZCApfVwiXSxgICtcclxuXHRcdFx0XHRcdGAud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fc2VjdGlvbiR7bm90U2VsZn1bZGF0YS1odG1sX2lkPVwiJHtlc2MoIGh0bWxJZCApfVwiXWBcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHRcdGNvbnN0IGRvbUNsYXNoID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGh0bWxJZCApO1xyXG5cclxuXHRcdFx0XHQvLyBBbGxvdyB3aGVuIHRoZSBvbmx5IFwiY2xhc2hcIiBpcyBpbnNpZGUgdGhpcyBzYW1lIGZpZWxkIChlLmcuLCB0aGUgaW5wdXQgeW91IGp1c3QgcmVuZGVyZWQpXHJcblx0XHRcdFx0Y29uc3QgZG9tQ2xhc2hJc1NlbGYgPSBkb21DbGFzaCA9PT0gZmllbGRfZWwgfHwgKGRvbUNsYXNoICYmIGZpZWxkX2VsLmNvbnRhaW5zKCBkb21DbGFzaCApKTtcclxuXHJcblx0XHRcdFx0aWYgKCAhY2xhc2hJbkNhbnZhcyAmJiAoIWRvbUNsYXNoIHx8IGRvbUNsYXNoSXNTZWxmKSApIHtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3QgbSA9IGh0bWxJZC5tYXRjaCggLy0oXFxkKykkLyApO1xyXG5cdFx0XHRcdGh0bWxJZCAgPSBtID8gaHRtbElkLnJlcGxhY2UoIC8tXFxkKyQvLCAnLScgKyAoTnVtYmVyKCBtWzFdICkgKyAxKSApIDogYCR7ZGVzaXJlZH0tMmA7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGZpZWxkX2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtaHRtbF9pZCcsIGh0bWxJZCApO1xyXG5cdFx0XHRpZiAoIHJlbmRlclByZXZpZXcgKSB7XHJcblx0XHRcdFx0Ly8gQ2FsbGVyIGRlY2lkZXMgaWYgLyB3aGVuIHRvIHJlbmRlci5cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gaHRtbElkO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkMgTGF5b3V0IHNlcnZpY2UuIEVuY2Fwc3VsYXRlcyBjb2x1bW4gd2lkdGggbWF0aCB3aXRoIGdhcCBoYW5kbGluZywgcHJlc2V0cywgYW5kIHV0aWxpdGllcy5cclxuXHQgKi9cclxuXHRDb3JlLldQQkNfQkZCX0xheW91dFNlcnZpY2UgPSBjbGFzcyAge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29uc3RydWN0b3IuIFNldCBvcHRpb25zIHdpdGggZ2FwIGJldHdlZW4gY29sdW1ucyAoJSkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHt7IGNvbF9nYXBfcGVyY2VudD86IG51bWJlciB9fSBbb3B0c10gLSBPcHRpb25zIHdpdGggZ2FwIGJldHdlZW4gY29sdW1ucyAoJSkuXHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKCBvcHRzID0ge30gKSB7XHJcblx0XHRcdHRoaXMuY29sX2dhcF9wZXJjZW50ID0gTnVtYmVyLmlzRmluaXRlKCArb3B0cy5jb2xfZ2FwX3BlcmNlbnQgKSA/ICtvcHRzLmNvbF9nYXBfcGVyY2VudCA6IDM7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb21wdXRlIG5vcm1hbGl6ZWQgZmxleC1iYXNpcyB2YWx1ZXMgZm9yIGEgcm93LCByZXNwZWN0aW5nIGNvbHVtbiBnYXBzLlxyXG5cdFx0ICogUmV0dXJucyBiYXNlcyB0aGF0IHN1bSB0byBhdmFpbGFibGUgPSAxMDAgLSAobi0xKSpnYXAuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93X2VsIC0gUm93IGVsZW1lbnQgY29udGFpbmluZyAud3BiY19iZmJfX2NvbHVtbiBjaGlsZHJlbi5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbZ2FwX3BlcmNlbnQ9dGhpcy5jb2xfZ2FwX3BlcmNlbnRdIC0gR2FwIHBlcmNlbnQgYmV0d2VlbiBjb2x1bW5zLlxyXG5cdFx0ICogQHJldHVybnMge3thdmFpbGFibGU6bnVtYmVyLGJhc2VzOm51bWJlcltdfX0gQXZhaWxhYmxlIHNwYWNlIGFuZCBiYXNpcyB2YWx1ZXMuXHJcblx0XHQgKi9cclxuXHRcdGNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzX2Zyb21fcm93KCByb3dfZWwsIGdhcF9wZXJjZW50ID0gdGhpcy5jb2xfZ2FwX3BlcmNlbnQgKSB7XHJcblx0XHRcdGNvbnN0IGNvbHMgPSBBcnJheS5mcm9tKCByb3dfZWw/LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSB8fCBbXSApO1xyXG5cdFx0XHRjb25zdCBuICAgID0gY29scy5sZW5ndGggfHwgMTtcclxuXHJcblx0XHRcdGNvbnN0IHJhdyA9IGNvbHMubWFwKCAoIGNvbCApID0+IHtcclxuXHRcdFx0XHRjb25zdCB3ID0gY29sLnN0eWxlLmZsZXhCYXNpcyB8fCAnJztcclxuXHRcdFx0XHRjb25zdCBwID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5wYXJzZV9wZXJjZW50KCB3LCBOYU4gKTtcclxuXHRcdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBwICkgPyBwIDogKDEwMCAvIG4pO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRjb25zdCBzdW1fcmF3ICAgID0gcmF3LnJlZHVjZSggKCBhLCBiICkgPT4gYSArIGIsIDAgKSB8fCAxMDA7XHJcblx0XHRcdGNvbnN0IGdwICAgICAgICAgPSBOdW1iZXIuaXNGaW5pdGUoICtnYXBfcGVyY2VudCApID8gK2dhcF9wZXJjZW50IDogMztcclxuXHRcdFx0Y29uc3QgdG90YWxfZ2FwcyA9IE1hdGgubWF4KCAwLCBuIC0gMSApICogZ3A7XHJcblx0XHRcdGNvbnN0IGF2YWlsYWJsZSAgPSBNYXRoLm1heCggMCwgMTAwIC0gdG90YWxfZ2FwcyApO1xyXG5cdFx0XHRjb25zdCBzY2FsZSAgICAgID0gYXZhaWxhYmxlIC8gc3VtX3JhdztcclxuXHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0YXZhaWxhYmxlLFxyXG5cdFx0XHRcdGJhc2VzOiByYXcubWFwKCAoIHAgKSA9PiBNYXRoLm1heCggMCwgcCAqIHNjYWxlICkgKVxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwbHkgY29tcHV0ZWQgYmFzZXMgdG8gdGhlIHJvdydzIGNvbHVtbnMgKHNldHMgZmxleC1iYXNpcyAlKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb3dfZWwgLSBSb3cgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyW119IGJhc2VzIC0gQXJyYXkgb2YgYmFzaXMgdmFsdWVzIChwZXJjZW50IG9mIGZ1bGwgMTAwKS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRhcHBseV9iYXNlc190b19yb3coIHJvd19lbCwgYmFzZXMgKSB7XHJcblx0XHRcdGNvbnN0IGNvbHMgPSBBcnJheS5mcm9tKCByb3dfZWw/LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSB8fCBbXSApO1xyXG5cdFx0XHRjb2xzLmZvckVhY2goICggY29sLCBpICkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHAgICAgICAgICAgICAgPSBiYXNlc1tpXSA/PyAwO1xyXG5cdFx0XHRcdGNvbC5zdHlsZS5mbGV4QmFzaXMgPSBgJHtwfSVgO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXN0cmlidXRlIGNvbHVtbnMgZXZlbmx5LCByZXNwZWN0aW5nIGdhcC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb3dfZWwgLSBSb3cgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbZ2FwX3BlcmNlbnQ9dGhpcy5jb2xfZ2FwX3BlcmNlbnRdIC0gR2FwIHBlcmNlbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c2V0X2VxdWFsX2Jhc2VzKCByb3dfZWwsIGdhcF9wZXJjZW50ID0gdGhpcy5jb2xfZ2FwX3BlcmNlbnQgKSB7XHJcblx0XHRcdGNvbnN0IGNvbHMgICAgICAgPSBBcnJheS5mcm9tKCByb3dfZWw/LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSB8fCBbXSApO1xyXG5cdFx0XHRjb25zdCBuICAgICAgICAgID0gY29scy5sZW5ndGggfHwgMTtcclxuXHRcdFx0Y29uc3QgZ3AgICAgICAgICA9IE51bWJlci5pc0Zpbml0ZSggK2dhcF9wZXJjZW50ICkgPyArZ2FwX3BlcmNlbnQgOiAzO1xyXG5cdFx0XHRjb25zdCB0b3RhbF9nYXBzID0gTWF0aC5tYXgoIDAsIG4gLSAxICkgKiBncDtcclxuXHRcdFx0Y29uc3QgYXZhaWxhYmxlICA9IE1hdGgubWF4KCAwLCAxMDAgLSB0b3RhbF9nYXBzICk7XHJcblx0XHRcdGNvbnN0IGVhY2ggICAgICAgPSBhdmFpbGFibGUgLyBuO1xyXG5cdFx0XHR0aGlzLmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93X2VsLCBBcnJheSggbiApLmZpbGwoIGVhY2ggKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwbHkgYSBwcmVzZXQgb2YgcmVsYXRpdmUgd2VpZ2h0cyB0byBhIHJvdy9zZWN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25PclJvdyAtIC53cGJjX2JmYl9fc2VjdGlvbiBvciBpdHMgY2hpbGQgLndwYmNfYmZiX19yb3cuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcltdfSB3ZWlnaHRzIC0gUmVsYXRpdmUgd2VpZ2h0cyAoZS5nLiwgWzEsMywxXSkuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gW2dhcF9wZXJjZW50PXRoaXMuY29sX2dhcF9wZXJjZW50XSAtIEdhcCBwZXJjZW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGFwcGx5X2xheW91dF9wcmVzZXQoIHNlY3Rpb25PclJvdywgd2VpZ2h0cywgZ2FwX3BlcmNlbnQgPSB0aGlzLmNvbF9nYXBfcGVyY2VudCApIHtcclxuXHRcdFx0Y29uc3Qgcm93ID0gc2VjdGlvbk9yUm93Py5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX3JvdycgKVxyXG5cdFx0XHRcdD8gc2VjdGlvbk9yUm93XHJcblx0XHRcdFx0OiBzZWN0aW9uT3JSb3c/LnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAud3BiY19iZmJfX3JvdycgKTtcclxuXHJcblx0XHRcdGlmICggISByb3cgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjb2xzID0gQXJyYXkuZnJvbSggcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSB8fCBbXSApO1xyXG5cdFx0XHRjb25zdCBuICAgID0gY29scy5sZW5ndGggfHwgMTtcclxuXHJcblx0XHRcdGlmICggISBBcnJheS5pc0FycmF5KCB3ZWlnaHRzICkgfHwgd2VpZ2h0cy5sZW5ndGggIT09IG4gKSB7XHJcblx0XHRcdFx0dGhpcy5zZXRfZXF1YWxfYmFzZXMoIHJvdywgZ2FwX3BlcmNlbnQgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHN1bSAgICAgICA9IHdlaWdodHMucmVkdWNlKCAoIGEsIGIgKSA9PiBhICsgTWF0aC5tYXgoIDAsIE51bWJlciggYiApIHx8IDAgKSwgMCApIHx8IDE7XHJcblx0XHRcdGNvbnN0IGdwICAgICAgICA9IE51bWJlci5pc0Zpbml0ZSggK2dhcF9wZXJjZW50ICkgPyArZ2FwX3BlcmNlbnQgOiAzO1xyXG5cdFx0XHRjb25zdCBhdmFpbGFibGUgPSBNYXRoLm1heCggMCwgMTAwIC0gTWF0aC5tYXgoIDAsIG4gLSAxICkgKiBncCApO1xyXG5cdFx0XHRjb25zdCBiYXNlcyAgICAgPSB3ZWlnaHRzLm1hcCggKCB3ICkgPT4gTWF0aC5tYXgoIDAsIChOdW1iZXIoIHcgKSB8fCAwKSAvIHN1bSAqIGF2YWlsYWJsZSApICk7XHJcblxyXG5cdFx0XHR0aGlzLmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93LCBiYXNlcyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQnVpbGQgcHJlc2V0IHdlaWdodCBsaXN0cyBmb3IgYSBnaXZlbiBjb2x1bW4gY291bnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IG4gLSBDb2x1bW4gY291bnQuXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyW11bXX0gTGlzdCBvZiB3ZWlnaHQgYXJyYXlzLlxyXG5cdFx0ICovXHJcblx0XHRidWlsZF9wcmVzZXRzX2Zvcl9jb2x1bW5zKCBuICkge1xyXG5cdFx0XHRzd2l0Y2ggKCBuICkge1xyXG5cdFx0XHRcdGNhc2UgMTpcclxuXHRcdFx0XHRcdHJldHVybiBbIFsgMSBdIF07XHJcblx0XHRcdFx0Y2FzZSAyOlxyXG5cdFx0XHRcdFx0cmV0dXJuIFsgWyAxLCAyIF0sIFsgMiwgMSBdLCBbIDEsIDMgXSwgWyAzLCAxIF0gXTtcclxuXHRcdFx0XHRjYXNlIDM6XHJcblx0XHRcdFx0XHRyZXR1cm4gWyBbIDEsIDMsIDEgXSwgWyAxLCAyLCAxIF0sIFsgMiwgMSwgMSBdLCBbIDEsIDEsIDIgXSBdO1xyXG5cdFx0XHRcdGNhc2UgNDpcclxuXHRcdFx0XHRcdHJldHVybiBbIFsgMSwgMiwgMiwgMSBdLCBbIDIsIDEsIDEsIDEgXSwgWyAxLCAxLCAxLCAyIF0gXTtcclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdFx0cmV0dXJuIFsgQXJyYXkoIG4gKS5maWxsKCAxICkgXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRm9ybWF0IGEgaHVtYW4tcmVhZGFibGUgbGFiZWwgbGlrZSBcIjUwJS8yNSUvMjUlXCIgZnJvbSB3ZWlnaHRzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyW119IHdlaWdodHMgLSBXZWlnaHQgbGlzdC5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IExhYmVsIHN0cmluZy5cclxuXHRcdCAqL1xyXG5cdFx0Zm9ybWF0X3ByZXNldF9sYWJlbCggd2VpZ2h0cyApIHtcclxuXHRcdFx0Y29uc3Qgc3VtID0gd2VpZ2h0cy5yZWR1Y2UoICggYSwgYiApID0+IGEgKyAoTnVtYmVyKCBiICkgfHwgMCksIDAgKSB8fCAxO1xyXG5cdFx0XHRyZXR1cm4gd2VpZ2h0cy5tYXAoICggdyApID0+IE1hdGgucm91bmQoICgoTnVtYmVyKCB3ICkgfHwgMCkgLyBzdW0pICogMTAwICkgKS5qb2luKCAnJS8nICkgKyAnJSc7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBjb21tYS9zcGFjZSBzZXBhcmF0ZWQgd2VpZ2h0cyBpbnRvIG51bWJlcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGlucHV0IC0gVXNlciBpbnB1dCBsaWtlIFwiMjAsNjAsMjBcIi5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJbXX0gUGFyc2VkIHdlaWdodHMuXHJcblx0XHQgKi9cclxuXHRcdHBhcnNlX3dlaWdodHMoIGlucHV0ICkge1xyXG5cdFx0XHRpZiAoICEgaW5wdXQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIGlucHV0IClcclxuXHRcdFx0XHQucmVwbGFjZSggL1teXFxkLC5cXHNdL2csICcnIClcclxuXHRcdFx0XHQuc3BsaXQoIC9bXFxzLF0rLyApXHJcblx0XHRcdFx0Lm1hcCggKCBzICkgPT4gcGFyc2VGbG9hdCggcyApIClcclxuXHRcdFx0XHQuZmlsdGVyKCAoIG4gKSA9PiBOdW1iZXIuaXNGaW5pdGUoIG4gKSAmJiBuID49IDAgKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBXUEJDIFVzYWdlIExpbWl0IHNlcnZpY2UuXHJcblx0ICogQ291bnRzIGZpZWxkIHVzYWdlIGJ5IGtleSwgY29tcGFyZXMgdG8gcGFsZXR0ZSBsaW1pdHMsIGFuZCB1cGRhdGVzIHBhbGV0dGUgVUkuXHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9Vc2FnZUxpbWl0U2VydmljZSA9IGNsYXNzICB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb25zdHJ1Y3Rvci4gU2V0IHBhZ2VzX2NvbnRhaW5lciBhbmQgcGFsZXR0ZV91bC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYWdlc19jb250YWluZXIgLSBDYW52YXMgcm9vdCB0aGF0IGhvbGRzIHBsYWNlZCBmaWVsZHMuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50W118bnVsbH0gcGFsZXR0ZV91bHM/OiAgIFBhbGV0dGVzIFVMIHdpdGggLndwYmNfYmZiX19maWVsZCBpdGVtcyAobWF5IGJlIG51bGwpLlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3RvcihwYWdlc19jb250YWluZXIsIHBhbGV0dGVfdWxzKSB7XHJcblx0XHRcdHRoaXMucGFnZXNfY29udGFpbmVyID0gcGFnZXNfY29udGFpbmVyO1xyXG5cdFx0XHQvLyBOb3JtYWxpemUgdG8gYW4gYXJyYXk7IHdl4oCZbGwgc3RpbGwgYmUgcm9idXN0IGlmIG5vbmUgcHJvdmlkZWQuXHJcblx0XHRcdHRoaXMucGFsZXR0ZV91bHMgICAgID0gQXJyYXkuaXNBcnJheSggcGFsZXR0ZV91bHMgKSA/IHBhbGV0dGVfdWxzIDogKHBhbGV0dGVfdWxzID8gWyBwYWxldHRlX3VscyBdIDogW10pO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBhcnNlIHVzYWdlIGxpbWl0IGZyb20gcmF3IGRhdGFzZXQgdmFsdWUuIE1pc3NpbmcvaW52YWxpZCAtPiBJbmZpbml0eS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ8bnVsbHx1bmRlZmluZWR9IHJhdyAtIFJhdyBhdHRyaWJ1dGUgdmFsdWUuXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfSBMaW1pdCBudW1iZXIgb3IgSW5maW5pdHkuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBwYXJzZV91c2FnZV9saW1pdCggcmF3ICkge1xyXG5cdFx0XHRpZiAoIHJhdyA9PSBudWxsICkge1xyXG5cdFx0XHRcdHJldHVybiBJbmZpbml0eTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBuID0gcGFyc2VJbnQoIHJhdywgMTAgKTtcclxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gbiA6IEluZmluaXR5O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ291bnQgaG93IG1hbnkgaW5zdGFuY2VzIGV4aXN0IHBlciB1c2FnZV9rZXkgaW4gdGhlIGNhbnZhcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7UmVjb3JkPHN0cmluZywgbnVtYmVyPn0gTWFwIG9mIHVzYWdlX2tleSAtPiBjb3VudC5cclxuXHRcdCAqL1xyXG5cdFx0Y291bnRfdXNhZ2VfYnlfa2V5KCkge1xyXG5cdFx0XHRjb25zdCB1c2VkID0ge307XHJcblx0XHRcdGNvbnN0IGFsbCAgPSB0aGlzLnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZDpub3QoLmlzLWludmFsaWQpJyApIHx8IFtdO1xyXG5cdFx0XHRhbGwuZm9yRWFjaCggKCBlbCApID0+IHtcclxuXHRcdFx0XHRjb25zdCBrZXkgPSBlbC5kYXRhc2V0LnVzYWdlX2tleSB8fCBlbC5kYXRhc2V0LnR5cGUgfHwgZWwuZGF0YXNldC5pZDtcclxuXHRcdFx0XHRpZiAoICEga2V5ICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR1c2VkW2tleV0gPSAodXNlZFtrZXldIHx8IDApICsgMTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gdXNlZDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiBwYWxldHRlIGxpbWl0IGZvciBhIGdpdmVuIHVzYWdlIGtleSAoaWQgb2YgdGhlIHBhbGV0dGUgaXRlbSkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleS5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJ9IExpbWl0IHZhbHVlIG9yIEluZmluaXR5LlxyXG5cdFx0ICovXHJcblx0XHRnZXRfbGltaXRfZm9yX2tleShrZXkpIHtcclxuXHRcdFx0aWYgKCAhIGtleSApIHtcclxuXHRcdFx0XHRyZXR1cm4gSW5maW5pdHk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gUXVlcnkgYWNyb3NzIGFsbCBwYWxldHRlcyBwcmVzZW50IG5vdyAoc3RvcmVkICsgYW55IG5ld2x5IGFkZGVkIGluIERPTSkuXHJcblx0XHRcdGNvbnN0IHJvb3RzICAgICAgICAgICAgPSB0aGlzLnBhbGV0dGVfdWxzPy5sZW5ndGggPyB0aGlzLnBhbGV0dGVfdWxzIDogZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsJyApO1xyXG5cdFx0XHRjb25zdCBhbGxQYWxldHRlRmllbGRzID0gQXJyYXkuZnJvbSggcm9vdHMgKS5mbGF0TWFwKCByID0+IEFycmF5LmZyb20oIHIucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZmllbGQnICkgKSApO1xyXG5cdFx0XHRsZXQgbGltaXQgICAgICAgICAgICAgID0gSW5maW5pdHk7XHJcblxyXG5cdFx0XHRhbGxQYWxldHRlRmllbGRzLmZvckVhY2goIChlbCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHVzYWdlX2tleSA9IGVsLmRhdGFzZXQudXNhZ2Vfa2V5IHx8IGVsLmRhdGFzZXQuaWQ7XHJcblx0XHRcdFx0aWYgKCBlbC5kYXRhc2V0LmlkID09PSBrZXkgfHwgdXNhZ2Vfa2V5ID09PSBrZXkgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBuID0gQ29yZS5XUEJDX0JGQl9Vc2FnZUxpbWl0U2VydmljZS5wYXJzZV91c2FnZV9saW1pdCggZWwuZGF0YXNldC51c2FnZW51bWJlciApO1xyXG5cdFx0XHRcdFx0Ly8gQ2hvb3NlIHRoZSBzbWFsbGVzdCBmaW5pdGUgbGltaXQgKHNhZmVzdCBpZiBwYWxldHRlcyBkaXNhZ3JlZSkuXHJcblx0XHRcdFx0XHRpZiAoIG4gPCBsaW1pdCApIHtcclxuXHRcdFx0XHRcdFx0bGltaXQgPSBuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0cmV0dXJuIGxpbWl0O1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERpc2FibGUvZW5hYmxlIHBhbGV0dGUgaXRlbXMgYmFzZWQgb24gY3VycmVudCB1c2FnZSBjb3VudHMgYW5kIGxpbWl0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0dXBkYXRlX3BhbGV0dGVfdWkoKSB7XHJcblx0XHRcdC8vIEFsd2F5cyBjb21wdXRlIHVzYWdlIGZyb20gdGhlIGNhbnZhczpcclxuXHRcdFx0Y29uc3QgdXNhZ2UgPSB0aGlzLmNvdW50X3VzYWdlX2J5X2tleSgpO1xyXG5cclxuXHRcdFx0Ly8gVXBkYXRlIGFsbCBwYWxldHRlcyBjdXJyZW50bHkgaW4gRE9NIChub3QganVzdCB0aGUgaW5pdGlhbGx5IGNhcHR1cmVkIG9uZXMpXHJcblx0XHRcdGNvbnN0IHBhbGV0dGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWxfZmllbGRfdHlwZXNfX3VsJyApO1xyXG5cclxuXHRcdFx0cGFsZXR0ZXMuZm9yRWFjaCggKHBhbCkgPT4ge1xyXG5cdFx0XHRcdHBhbC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19maWVsZCcgKS5mb3JFYWNoKCAocGFuZWxfZmllbGQpID0+IHtcclxuXHRcdFx0XHRcdGNvbnN0IHBhbGV0dGVJZCAgID0gcGFuZWxfZmllbGQuZGF0YXNldC5pZDtcclxuXHRcdFx0XHRcdGNvbnN0IHVzYWdlS2V5ICAgID0gcGFuZWxfZmllbGQuZGF0YXNldC51c2FnZV9rZXkgfHwgcGFsZXR0ZUlkO1xyXG5cdFx0XHRcdFx0Y29uc3QgcmF3X2xpbWl0ICAgPSBwYW5lbF9maWVsZC5kYXRhc2V0LnVzYWdlbnVtYmVyO1xyXG5cdFx0XHRcdFx0Y29uc3QgcGVyRWxMaW1pdCAgPSBDb3JlLldQQkNfQkZCX1VzYWdlTGltaXRTZXJ2aWNlLnBhcnNlX3VzYWdlX2xpbWl0KCByYXdfbGltaXQgKTtcclxuXHRcdFx0XHRcdC8vIEVmZmVjdGl2ZSBsaW1pdCBhY3Jvc3MgYWxsIHBhbGV0dGVzIGlzIHRoZSBnbG9iYWwgbGltaXQgZm9yIHRoaXMga2V5LlxyXG5cdFx0XHRcdFx0Y29uc3QgZ2xvYmFsTGltaXQgPSB0aGlzLmdldF9saW1pdF9mb3Jfa2V5KCB1c2FnZUtleSApO1xyXG5cdFx0XHRcdFx0Y29uc3QgbGltaXQgICAgICAgPSBOdW1iZXIuaXNGaW5pdGUoIGdsb2JhbExpbWl0ICkgPyBnbG9iYWxMaW1pdCA6IHBlckVsTGltaXQ7IC8vIHByZWZlciBnbG9iYWwgbWluXHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgY3VycmVudCA9IHVzYWdlW3VzYWdlS2V5XSB8fCAwO1xyXG5cdFx0XHRcdFx0Y29uc3QgZGlzYWJsZSA9IE51bWJlci5pc0Zpbml0ZSggbGltaXQgKSAmJiBjdXJyZW50ID49IGxpbWl0O1xyXG5cclxuXHRcdFx0XHRcdHBhbmVsX2ZpZWxkLnN0eWxlLnBvaW50ZXJFdmVudHMgPSBkaXNhYmxlID8gJ25vbmUnIDogJyc7XHJcblx0XHRcdFx0XHRwYW5lbF9maWVsZC5zdHlsZS5vcGFjaXR5ICAgICAgID0gZGlzYWJsZSA/ICcwLjQnIDogJyc7XHJcblx0XHRcdFx0XHRwYW5lbF9maWVsZC5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgZGlzYWJsZSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHRcdFx0XHRcdGlmICggZGlzYWJsZSApIHtcclxuXHRcdFx0XHRcdFx0cGFuZWxfZmllbGQuc2V0QXR0cmlidXRlKCAndGFiaW5kZXgnLCAnLTEnICk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRwYW5lbF9maWVsZC5yZW1vdmVBdHRyaWJ1dGUoICd0YWJpbmRleCcgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZXR1cm4gaG93IG1hbnkgdmFsaWQgaW5zdGFuY2VzIHdpdGggdGhpcyB1c2FnZSBrZXkgZXhpc3QgaW4gdGhlIGNhbnZhcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVXNhZ2Uga2V5IG9mIGEgcGFsZXR0ZSBpdGVtLlxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn0gQ291bnQgb2YgZXhpc3Rpbmcgbm9uLWludmFsaWQgaW5zdGFuY2VzLlxyXG5cdFx0ICovXHJcblx0XHRjb3VudF9mb3Jfa2V5KCBrZXkgKSB7XHJcblx0XHRcdGlmICggISBrZXkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIDA7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuICggdGhpcy5wYWdlc19jb250YWluZXI/LnF1ZXJ5U2VsZWN0b3JBbGwoXHJcbiAgICAgICAgICAgICAgICBgLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkW2RhdGEtdXNhZ2Vfa2V5PVwiJHtDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3Rvcigga2V5ICl9XCJdOm5vdCguaXMtaW52YWxpZCksIFxyXG4gICAgICAgICAgICAgICAgIC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZFtkYXRhLXR5cGU9XCIke0NvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCBrZXkgKX1cIl06bm90KC5pcy1pbnZhbGlkKWBcclxuXHRcdFx0KSB8fCBbXSApLmxlbmd0aDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFsaWFzIGZvciBsaW1pdCBsb29rdXAgKHJlYWRhYmlsaXR5KS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVXNhZ2Uga2V5IG9mIGEgcGFsZXR0ZSBpdGVtLlxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn0gTGltaXQgdmFsdWUgb3IgSW5maW5pdHkuXHJcblx0XHQgKi9cclxuXHRcdGxpbWl0X2Zvcl9rZXkoIGtleSApIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0X2xpbWl0X2Zvcl9rZXkoIGtleSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtYWluaW5nIHNsb3RzIGZvciB0aGlzIGtleSAoSW5maW5pdHkgaWYgdW5saW1pdGVkKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVXNhZ2Uga2V5IG9mIGEgcGFsZXR0ZSBpdGVtLlxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn0gUmVtYWluaW5nIGNvdW50ICg+PSAwKSBvciBJbmZpbml0eS5cclxuXHRcdCAqL1xyXG5cdFx0cmVtYWluaW5nX2Zvcl9rZXkoIGtleSApIHtcclxuXHRcdFx0Y29uc3QgbGltaXQgPSB0aGlzLmxpbWl0X2Zvcl9rZXkoIGtleSApO1xyXG5cdFx0XHRpZiAoIGxpbWl0ID09PSBJbmZpbml0eSApIHtcclxuXHRcdFx0XHRyZXR1cm4gSW5maW5pdHk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgdXNlZCA9IHRoaXMuY291bnRfZm9yX2tleSgga2V5ICk7XHJcblx0XHRcdHJldHVybiBNYXRoLm1heCggMCwgbGltaXQgLSB1c2VkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUcnVlIGlmIHlvdSBjYW4gYWRkIGBkZWx0YWAgbW9yZSBpdGVtcyBmb3IgdGhpcyBrZXkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbZGVsdGE9MV0gLSBIb3cgbWFueSBpdGVtcyB5b3UgaW50ZW5kIHRvIGFkZC5cclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufSBXaGV0aGVyIGFkZGluZyBpcyBhbGxvd2VkLlxyXG5cdFx0ICovXHJcblx0XHRjYW5fYWRkKCBrZXksIGRlbHRhID0gMSApIHtcclxuXHRcdFx0Y29uc3QgcmVtID0gdGhpcy5yZW1haW5pbmdfZm9yX2tleSgga2V5ICk7XHJcblx0XHRcdHJldHVybiAoIHJlbSA9PT0gSW5maW5pdHkgKSA/IHRydWUgOiAoIHJlbSA+PSBkZWx0YSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVUktZmFjaW5nIGdhdGU6IGFsZXJ0IHdoZW4gZXhjZWVkZWQuIFJldHVybnMgYm9vbGVhbiBhbGxvd2VkL2Jsb2NrZWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEBwYXJhbSB7e2xhYmVsPzogc3RyaW5nLCBkZWx0YT86IG51bWJlcn19IFtvcHRzPXt9XSAtIE9wdGlvbmFsIFVJIGluZm8uXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBhbGxvd2VkLCBmYWxzZSBpZiBibG9ja2VkLlxyXG5cdFx0ICovXHJcblx0XHRnYXRlX29yX2FsZXJ0KCBrZXksIHsgbGFiZWwgPSBrZXksIGRlbHRhID0gMSB9ID0ge30gKSB7XHJcblx0XHRcdGlmICggdGhpcy5jYW5fYWRkKCBrZXksIGRlbHRhICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgbGltaXQgPSB0aGlzLmxpbWl0X2Zvcl9rZXkoIGtleSApO1xyXG5cdFx0XHRhbGVydCggYE9ubHkgJHtsaW1pdH0gaW5zdGFuY2Uke2xpbWl0ID4gMSA/ICdzJyA6ICcnfSBvZiBcIiR7bGFiZWx9XCIgYWxsb3dlZC5gICk7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJhY2t3YXJkLWNvbXBhdGlibGUgYWxpYXMgdXNlZCBlbHNld2hlcmUgaW4gdGhlIGNvZGViYXNlLiAgLSBDaGVjayB3aGV0aGVyIGFub3RoZXIgaW5zdGFuY2Ugd2l0aCB0aGUgZ2l2ZW5cclxuXHRcdCAqIHVzYWdlIGtleSBjYW4gYmUgYWRkZWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufSBXaGV0aGVyIGFkZGluZyBvbmUgbW9yZSBpcyBhbGxvd2VkLlxyXG5cdFx0ICovXHJcblx0XHRpc191c2FnZV9vaygga2V5ICkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5jYW5fYWRkKCBrZXksIDEgKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ29uc3RhbnQgZXZlbnQgbmFtZXMgZm9yIHRoZSBidWlsZGVyLlxyXG5cdCAqL1xyXG5cdENvcmUuV1BCQ19CRkJfRXZlbnRzID0gT2JqZWN0LmZyZWV6ZSh7XHJcblx0XHRTRUxFQ1QgICAgICAgICAgICA6ICd3cGJjOmJmYjpzZWxlY3QnLFxyXG5cdFx0Q0xFQVJfU0VMRUNUSU9OICAgOiAnd3BiYzpiZmI6Y2xlYXItc2VsZWN0aW9uJyxcclxuXHRcdEZJRUxEX0FERCAgICAgICAgIDogJ3dwYmM6YmZiOmZpZWxkOmFkZCcsXHJcblx0XHRGSUVMRF9SRU1PVkUgICAgICA6ICd3cGJjOmJmYjpmaWVsZDpyZW1vdmUnLFxyXG5cdFx0U1RSVUNUVVJFX0NIQU5HRSAgOiAnd3BiYzpiZmI6c3RydWN0dXJlOmNoYW5nZScsXHJcblx0XHRTVFJVQ1RVUkVfTE9BREVEICA6ICd3cGJjOmJmYjpzdHJ1Y3R1cmU6bG9hZGVkJ1xyXG5cdH0pO1xyXG5cclxuXHQvKipcclxuXHQgKiBMaWdodHdlaWdodCBldmVudCBidXMgdGhhdCBlbWl0cyB0byBib3RoIHRoZSBwYWdlcyBjb250YWluZXIgYW5kIGRvY3VtZW50LlxyXG5cdCAqL1xyXG5cdENvcmUuV1BCQ19CRkJfRXZlbnRCdXMgPSAgY2xhc3Mge1xyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzY29wZV9lbCAtIEVsZW1lbnQgdG8gZGlzcGF0Y2ggYnViYmxlZCBldmVudHMgZnJvbS5cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3IoIHNjb3BlX2VsICkge1xyXG5cdFx0XHR0aGlzLnNjb3BlX2VsID0gc2NvcGVfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbWl0IGEgRE9NIEN1c3RvbUV2ZW50IHdpdGggcGF5bG9hZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIEV2ZW50IHR5cGUgKHVzZSBDb3JlLldQQkNfQkZCX0V2ZW50cy4gd2hlbiBwb3NzaWJsZSkuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW2RldGFpbD17fV0gLSBBcmJpdHJhcnkgc2VyaWFsaXphYmxlIHBheWxvYWQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZW1pdCggdHlwZSwgZGV0YWlsID0ge30gKSB7XHJcblx0XHRcdGlmICggISB0aGlzLnNjb3BlX2VsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnNjb3BlX2VsLmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggdHlwZSwgeyBkZXRhaWw6IHsgLi4uZGV0YWlsIH0sIGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdWJzY3JpYmUgdG8gYW4gZXZlbnQgb24gZG9jdW1lbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBFdmVudCB0eXBlLlxyXG5cdFx0ICogQHBhcmFtIHsoZXY6Q3VzdG9tRXZlbnQpPT52b2lkfSBoYW5kbGVyIC0gSGFuZGxlciBmdW5jdGlvbi5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRvbiggdHlwZSwgaGFuZGxlciApIHtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggdHlwZSwgaGFuZGxlciApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVW5zdWJzY3JpYmUgZnJvbSBhbiBldmVudCBvbiBkb2N1bWVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIEV2ZW50IHR5cGUuXHJcblx0XHQgKiBAcGFyYW0geyhldjpDdXN0b21FdmVudCk9PnZvaWR9IGhhbmRsZXIgLSBIYW5kbGVyIGZ1bmN0aW9uLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdG9mZiggdHlwZSwgaGFuZGxlciApIHtcclxuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggdHlwZSwgaGFuZGxlciApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNvcnRhYmxlSlMgbWFuYWdlcjogc2luZ2xlIHBvaW50IGZvciBjb25zaXN0ZW50IERuRCBjb25maWcuXHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9Tb3J0YWJsZU1hbmFnZXIgPSBjbGFzcyAge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHBhcmFtIHtXUEJDX0Zvcm1fQnVpbGRlcn0gYnVpbGRlciAtIFRoZSBhY3RpdmUgYnVpbGRlciBpbnN0YW5jZS5cclxuXHRcdCAqIEBwYXJhbSB7eyBncm91cE5hbWU/OiBzdHJpbmcsIGFuaW1hdGlvbj86IG51bWJlciwgZ2hvc3RDbGFzcz86IHN0cmluZywgY2hvc2VuQ2xhc3M/OiBzdHJpbmcsIGRyYWdDbGFzcz86XG5cdFx0ICogICAgIHN0cmluZywgY2FuZGlkYXRlX2R3ZWxsX21zPzogbnVtYmVyLCBjYW5kaWRhdGVfY29tbWl0X2Rpc3RhbmNlPzogbnVtYmVyLFxuXHRcdCAqICAgICBjYW5kaWRhdGVfZHdlbGxfZGlzdGFuY2U/OiBudW1iZXIgfX0gW29wdHM9e31dIC0gVmlzdWFsIGFuZCBkcmFnLXN0YWJpbGl0eSBvcHRpb25zLlxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3IoIGJ1aWxkZXIsIG9wdHMgPSB7fSApIHtcclxuXHRcdFx0dGhpcy5idWlsZGVyID0gYnVpbGRlcjtcclxuXHRcdFx0Y29uc3QgZ2lkID0gdGhpcy5idWlsZGVyPy5pbnN0YW5jZV9pZCB8fCBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCA4ICk7XHJcblx0XHRcdHRoaXMub3B0cyA9IHtcclxuXHRcdFx0XHQvLyBncm91cE5hbWUgIDogJ2Zvcm0nLFxyXG5cdFx0XHRcdGdyb3VwTmFtZTogYGZvcm0tJHtnaWR9YCxcclxuXHRcdFx0XHRhbmltYXRpb24gIDogMTUwLFxyXG5cdFx0XHRcdGdob3N0Q2xhc3MgOiAnd3BiY19iZmJfX2RyYWctZ2hvc3QnLFxuXHRcdFx0XHRjaG9zZW5DbGFzczogJ3dwYmNfYmZiX19oaWdobGlnaHQnLFxuXHRcdFx0XHRkcmFnQ2xhc3MgIDogJ3dwYmNfYmZiX19kcmFnLWFjdGl2ZScsXG5cdFx0XHRcdGNhbmRpZGF0ZV9kd2VsbF9tcyAgICAgICAgOiA5MCxcblx0XHRcdFx0Y2FuZGlkYXRlX2NvbW1pdF9kaXN0YW5jZSA6IDEwLFxuXHRcdFx0XHRjYW5kaWRhdGVfZHdlbGxfZGlzdGFuY2UgIDogMixcblx0XHRcdFx0Li4ub3B0c1xuXHRcdFx0fTtcblx0XHRcdC8qKiBAdHlwZSB7U2V0PEhUTUxFbGVtZW50Pn0gKi9cclxuXHRcdFx0dGhpcy5fY29udGFpbmVycyA9IG5ldyBTZXQoKTtcclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBHdWFyZCBhZ2FpbnN0IGxvc3QgbW91c2V1cCAvIHBvaW50ZXJ1cCBldmVudHMuXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEB0eXBlIHtib29sZWFufVxyXG5cdFx0XHQgKi9cclxuXHRcdFx0dGhpcy5fZHJhZ19mYWlsX3NhZmVfYm91bmQgPSBmYWxzZTtcblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBTdGF0ZSBmb3IgdGhlIGN1cnJlbnQgRm9ybSBCdWlsZGVyIGNhbnZhcyBkcmFnLlxuXHRcdFx0ICpcblx0XHRcdCAqIEB0eXBlIHs/T2JqZWN0fVxuXHRcdFx0ICovXG5cdFx0XHR0aGlzLl9kcmFnX3N0YXRlID0gbnVsbDtcblxyXG5cdFx0XHR0aGlzLl9iaW5kX2RyYWdfZmFpbF9zYWZlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDbGVhbnVwIGRyYWcgVUkgc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogVGhpcyBpcyBhIGRlZmVuc2l2ZSBjbGVhbnVwIGZvciBjYXNlcyB3aGVuIENocm9tZSBvciBhIGJyb3dzZXIgZXh0ZW5zaW9uXHJcblx0XHQgKiBsb3NlcyB0aGUgZmluYWwgbW91c2V1cCAvIHBvaW50ZXJ1cCBldmVudCBkdXJpbmcgZmFsbGJhY2sgZHJhZ2dpbmcuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9jbGVhbnVwX2RyYWdfdWkoKSB7XG5cdFx0XHRjb25zdCBkcmFnX3N0YXRlID0gdGhpcy5fZHJhZ19zdGF0ZTtcblxuXHRcdFx0aWYgKCBkcmFnX3N0YXRlPy5pdGVtICkge1xuXHRcdFx0XHRkcmFnX3N0YXRlLml0ZW0uY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYmZiX19kcm9wLWluZGljYXRvcicgKTtcblx0XHRcdH1cblx0XHRcdGlmICggZHJhZ19zdGF0ZT8uc291cmNlX3NwYWNlcj8ucGFyZW50Tm9kZSApIHtcblx0XHRcdFx0ZHJhZ19zdGF0ZS5zb3VyY2Vfc3BhY2VyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIGRyYWdfc3RhdGUuc291cmNlX3NwYWNlciApO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fcmVsZWFzZV9jYW52YXNfZ2VvbWV0cnlfbG9ja3MoIGRyYWdfc3RhdGUgKTtcblxuXHRcdFx0dGhpcy5fZHJhZ19zdGF0ZSA9IG51bGw7XG5cdFx0XHR0aGlzLl90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MoIGZhbHNlICk7XG5cdFx0XHR0aGlzLmJ1aWxkZXI/Ll9yZW1vdmVfZHJhZ2dpbmdfY2xhc3M/LigpO1xuXHJcblx0XHRcdC8vIFJlbW92ZSBvbmx5IGZhbGxiYWNrIG1pcnJvcnMuIERvIG5vdCB0b3VjaCByZWFsIGRyYWdnZWQgZWxlbWVudHMuXHJcblx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcuc29ydGFibGUtZmFsbGJhY2tbZGF0YS1kcmFnLXJvbGVdLCAud3BiY19iZmJfX3NpbXBsZV9saXN0X2ZhbGxiYWNrJyApXHJcblx0XHRcdFx0XHQuZm9yRWFjaCggKGVsKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmICggZWwucGFyZW50Tm9kZSApIHtcclxuXHRcdFx0XHRcdFx0XHRlbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBlbCApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FwdHVyZSB0aGUgYmxvY2sgc2l6ZSBvZiBldmVyeSBjYW52YXMgbGF5b3V0IGNvbnRhaW5lciBiZWZvcmUgZHJhZyByZWZsb3cgc3RhcnRzLlxuXHRcdCAqXG5cdFx0ICogU29ydGFibGVKUyB0ZW1wb3JhcmlseSBtb3ZlcyB0aGUgcmVhbCBub2RlIGJldHdlZW4gY29udGFpbmVycy4gVGhhdCBjaGFuZ2VzIENTU1xuXHRcdCAqIGA6ZW1wdHlgIG1hdGNoaW5nIGFuZCBjYW4gb3RoZXJ3aXNlIHNocmluayBhbiBlbXB0eSBkZXN0aW5hdGlvbiByb3cgb3IgZ3JvdyBhXG5cdFx0ICogcG9wdWxhdGVkIGRlc3RpbmF0aW9uIGJ5IHRoZSBpbnNlcnRpb24tbGluZSBoZWlnaHQuIFRoZSBjYXB0dXJlZCB2YWx1ZXMgYXJlXG5cdFx0ICogYXBwbGllZCBvbmx5IGZvciB0aGUgYWN0aXZlIGRyYWcgc2Vzc2lvbiBhbmQgbmV2ZXIgYmVjb21lIHNhdmVkIGZvcm0gZGF0YS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm5zIHtBcnJheTxPYmplY3Q+fSBSZXN0b3JhYmxlIGdlb21ldHJ5LWxvY2sgcmVjb3JkcyBmb3IgdmlzaWJsZSBjYW52YXMgY29udGFpbmVycy5cblx0XHQgKi9cblx0XHRfY2FwdHVyZV9jYW52YXNfZ2VvbWV0cnlfbG9ja3MoKSB7XG5cdFx0XHRjb25zdCBwYWdlc19jb250YWluZXIgPSB0aGlzLmJ1aWxkZXI/LnBhZ2VzX2NvbnRhaW5lcjtcblx0XHRcdGlmICggISBwYWdlc19jb250YWluZXI/LnF1ZXJ5U2VsZWN0b3JBbGwgKSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbG9ja19zZWxlY3RvciA9IFtcblx0XHRcdFx0Jy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyxcblx0XHRcdFx0Jy53cGJjX2JmYl9fcm93Jyxcblx0XHRcdFx0Jy53cGJjX2JmYl9fY29sdW1uJ1xuXHRcdFx0XS5qb2luKCAnLCAnICk7XG5cdFx0XHRjb25zdCBibG9ja19zaXplX3Byb3BlcnR5ID0gJy0td3BiYy1iZmItZHJhZy1sb2NrZWQtYmxvY2stc2l6ZSc7XG5cblx0XHRcdHJldHVybiBBcnJheS5mcm9tKCBwYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggbG9ja19zZWxlY3RvciApIClcblx0XHRcdFx0Lm1hcCggKCBlbGVtZW50ICkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGJsb2NrX3NpemUgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdD8uKCkuaGVpZ2h0O1xuXHRcdFx0XHRcdGlmICggISBOdW1iZXIuaXNGaW5pdGUoIGJsb2NrX3NpemUgKSB8fCBibG9ja19zaXplIDw9IDAgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZWxlbWVudCAgICAgICAgICAgICAgICAgICAgIDogZWxlbWVudCxcblx0XHRcdFx0XHRcdGJsb2NrX3NpemUgICAgICAgICAgICAgICAgICA6IE1hdGgucm91bmQoIGJsb2NrX3NpemUgKiAxMDAwICkgLyAxMDAwLFxuXHRcdFx0XHRcdFx0aGFkX2xvY2tfY2xhc3MgICAgICAgICAgICAgIDogZWxlbWVudC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX2RyYWctZ2VvbWV0cnktbG9jaycgKSxcblx0XHRcdFx0XHRcdHByZXZpb3VzX2Jsb2NrX3NpemUgICAgICAgICA6IGVsZW1lbnQuc3R5bGU/LmdldFByb3BlcnR5VmFsdWU/LiggYmxvY2tfc2l6ZV9wcm9wZXJ0eSApIHx8ICcnLFxuXHRcdFx0XHRcdFx0cHJldmlvdXNfYmxvY2tfc2l6ZV9wcmlvcml0eTogZWxlbWVudC5zdHlsZT8uZ2V0UHJvcGVydHlQcmlvcml0eT8uKCBibG9ja19zaXplX3Byb3BlcnR5ICkgfHwgJydcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IClcblx0XHRcdFx0LmZpbHRlciggQm9vbGVhbiApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZyZWV6ZSBjYXB0dXJlZCBjYW52YXMgY29udGFpbmVyIGhlaWdodHMgZm9yIHRoZSBhY3RpdmUgU29ydGFibGVKUyBzZXNzaW9uLlxuXHRcdCAqXG5cdFx0ICogVGhlIGxvY2sgaXMgYXBwbGllZCBiZWZvcmUgZ2xvYmFsIGRyYWcgY2xhc3NlcyBvciB0aGUgY29tcGFjdCBpbnNlcnRpb24gbWFya2VyXG5cdFx0ICogY2FuIGNoYW5nZSBmbGV4IGFsaWdubWVudCBhbmQgZW1wdHktY29udGFpbmVyIHNlbGVjdG9ycy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdCAqL1xuXHRcdF9hcHBseV9jYW52YXNfZ2VvbWV0cnlfbG9ja3MoKSB7XG5cdFx0XHRjb25zdCBnZW9tZXRyeV9sb2NrcyA9IHRoaXMuX2RyYWdfc3RhdGU/Lmdlb21ldHJ5X2xvY2tzIHx8IFtdO1xuXG5cdFx0XHRnZW9tZXRyeV9sb2Nrcy5mb3JFYWNoKCAoIGdlb21ldHJ5X2xvY2sgKSA9PiB7XG5cdFx0XHRcdGdlb21ldHJ5X2xvY2suZWxlbWVudC5zdHlsZT8uc2V0UHJvcGVydHkoXG5cdFx0XHRcdFx0Jy0td3BiYy1iZmItZHJhZy1sb2NrZWQtYmxvY2stc2l6ZScsXG5cdFx0XHRcdFx0YCR7Z2VvbWV0cnlfbG9jay5ibG9ja19zaXplfXB4YFxuXHRcdFx0XHQpO1xuXHRcdFx0XHRnZW9tZXRyeV9sb2NrLmVsZW1lbnQuY2xhc3NMaXN0Py5hZGQoICd3cGJjX2JmYl9fZHJhZy1nZW9tZXRyeS1sb2NrJyApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlc3RvcmUgYWxsIGlubGluZSBzdGF0ZSB1c2VkIGJ5IHRoZSBkcmFnLXNlc3Npb24gZ2VvbWV0cnkgbG9jay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7P09iamVjdH0gZHJhZ19zdGF0ZSAtIERyYWcgc3RhdGUgd2hvc2UgZ2VvbWV0cnkgcmVjb3JkcyBtdXN0IGJlIHJlc3RvcmVkLlxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdCAqL1xuXHRcdF9yZWxlYXNlX2NhbnZhc19nZW9tZXRyeV9sb2NrcyggZHJhZ19zdGF0ZSApIHtcblx0XHRcdGNvbnN0IGJsb2NrX3NpemVfcHJvcGVydHkgPSAnLS13cGJjLWJmYi1kcmFnLWxvY2tlZC1ibG9jay1zaXplJztcblx0XHRcdGNvbnN0IGdlb21ldHJ5X2xvY2tzICAgICAgPSBkcmFnX3N0YXRlPy5nZW9tZXRyeV9sb2NrcyB8fCBbXTtcblxuXHRcdFx0Z2VvbWV0cnlfbG9ja3MuZm9yRWFjaCggKCBnZW9tZXRyeV9sb2NrICkgPT4ge1xuXHRcdFx0XHRpZiAoIGdlb21ldHJ5X2xvY2sucHJldmlvdXNfYmxvY2tfc2l6ZSApIHtcblx0XHRcdFx0XHRnZW9tZXRyeV9sb2NrLmVsZW1lbnQuc3R5bGU/LnNldFByb3BlcnR5KFxuXHRcdFx0XHRcdFx0YmxvY2tfc2l6ZV9wcm9wZXJ0eSxcblx0XHRcdFx0XHRcdGdlb21ldHJ5X2xvY2sucHJldmlvdXNfYmxvY2tfc2l6ZSxcblx0XHRcdFx0XHRcdGdlb21ldHJ5X2xvY2sucHJldmlvdXNfYmxvY2tfc2l6ZV9wcmlvcml0eVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Z2VvbWV0cnlfbG9jay5lbGVtZW50LnN0eWxlPy5yZW1vdmVQcm9wZXJ0eT8uKCBibG9ja19zaXplX3Byb3BlcnR5ICk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoICEgZ2VvbWV0cnlfbG9jay5oYWRfbG9ja19jbGFzcyApIHtcblx0XHRcdFx0XHRnZW9tZXRyeV9sb2NrLmVsZW1lbnQuY2xhc3NMaXN0Py5yZW1vdmUoICd3cGJjX2JmYl9fZHJhZy1nZW9tZXRyeS1sb2NrJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FwdHVyZSB0aGUgb3JpZ2luYWwgY2FudmFzIGdlb21ldHJ5IGJlZm9yZSBTb3J0YWJsZUpTIGFwcGxpZXMgaXRzIGdob3N0IGNsYXNzLlxuXHRcdCAqXG5cdFx0ICogVGhlIHNhdmVkIHJlY3RhbmdsZSBpcyBsYXRlciByZXByZXNlbnRlZCBieSBhIG5vbi1kYXRhIHNwYWNlci4gVGhpcyBrZWVwcyB0aGVcblx0XHQgKiBzb3VyY2UgbGF5b3V0IHN0YWJsZSB3aGlsZSB0aGUgcmVhbCBkcmFnZ2VkIG5vZGUgYmVjb21lcyBhIGNvbXBhY3QgaW5zZXJ0aW9uXG5cdFx0ICogaW5kaWNhdG9yIGluIGFub3RoZXIgY29udGFpbmVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtTb3J0YWJsZS5Tb3J0YWJsZUV2ZW50fSBldnQgLSBTb3J0YWJsZSBjaG9vc2UgZXZlbnQuXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XG5cdFx0ICovXG5cdFx0X3ByZXBhcmVfZHJhZ19zdGF0ZSggZXZ0ICkge1xuXHRcdFx0aWYgKCAhIGV2dD8uaXRlbSB8fCAhIGV2dD8uZnJvbSApIHtcblx0XHRcdFx0dGhpcy5fZHJhZ19zdGF0ZSA9IG51bGw7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc291cmNlX3JlY3QgID0gZXZ0Lml0ZW0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRjb25zdCBmcm9tX3BhbGV0dGUgPSAhISB0aGlzLmJ1aWxkZXI/LnBhbGV0dGVfdWxzPy5pbmNsdWRlcz8uKCBldnQuZnJvbSApO1xuXG5cdFx0XHR0aGlzLl9kcmFnX3N0YXRlID0ge1xuXHRcdFx0XHRpdGVtICAgICAgICAgICAgICAgIDogZXZ0Lml0ZW0sXG5cdFx0XHRcdGZyb21fcGFsZXR0ZSAgICAgICAgOiBmcm9tX3BhbGV0dGUsXG5cdFx0XHRcdHNvdXJjZV9wYXJlbnQgICAgICAgOiBldnQuZnJvbSxcblx0XHRcdFx0c291cmNlX25leHRfc2libGluZyA6IGV2dC5pdGVtLm5leHRTaWJsaW5nLFxuXHRcdFx0XHRzb3VyY2VfcmVjdCAgICAgICAgIDoge1xuXHRcdFx0XHRcdHdpZHRoIDogc291cmNlX3JlY3Qud2lkdGgsXG5cdFx0XHRcdFx0aGVpZ2h0OiBzb3VyY2VfcmVjdC5oZWlnaHRcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2VvbWV0cnlfbG9ja3MgICAgICA6IHRoaXMuX2NhcHR1cmVfY2FudmFzX2dlb21ldHJ5X2xvY2tzKCksXG5cdFx0XHRcdHNvdXJjZV9zcGFjZXIgICAgICAgOiBudWxsLFxuXHRcdFx0XHRhY2NlcHRlZF9jYW5kaWRhdGUgIDogbnVsbCxcblx0XHRcdFx0cGVuZGluZ19jYW5kaWRhdGUgICA6IG51bGwsXG5cdFx0XHRcdHBlbmRpbmdfc2luY2UgICAgICAgOiAwLFxuXHRcdFx0XHRwZW5kaW5nX3BvaW50ZXIgICAgIDogbnVsbFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDcmVhdGUgYSBtZWFzdXJlZCwgbm9uLWRhdGEgZm9vdHByaW50IGF0IHRoZSBkcmFnZ2VkIGl0ZW0ncyBzb3VyY2UgcG9zaXRpb24uXG5cdFx0ICpcblx0XHQgKiBUaGUgc3BhY2VyIGludGVudGlvbmFsbHkgZG9lcyBub3QgdXNlIGZpZWxkIG9yIHNlY3Rpb24gY2xhc3Nlcywgc28gRm9ybSBCdWlsZGVyXG5cdFx0ICogc2VyaWFsaXphdGlvbiBhbmQgdXNhZ2UgYWNjb3VudGluZyBjYW5ub3QgdHJlYXQgaXQgYXMgc2F2ZWQgZm9ybSBjb250ZW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XG5cdFx0ICovXG5cdFx0X2NyZWF0ZV9kcmFnX3NvdXJjZV9zcGFjZXIoKSB7XG5cdFx0XHRjb25zdCBkcmFnX3N0YXRlID0gdGhpcy5fZHJhZ19zdGF0ZTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhIGRyYWdfc3RhdGUgfHxcblx0XHRcdFx0ZHJhZ19zdGF0ZS5mcm9tX3BhbGV0dGUgfHxcblx0XHRcdFx0ISBkcmFnX3N0YXRlLml0ZW0gfHxcblx0XHRcdFx0ISBkcmFnX3N0YXRlLnNvdXJjZV9wYXJlbnQgfHxcblx0XHRcdFx0ZHJhZ19zdGF0ZS5zb3VyY2Vfc3BhY2VyXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzcGFjZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdFx0Y29uc3Qgd2lkdGggID0gTWF0aC5tYXgoIDEsIGRyYWdfc3RhdGUuc291cmNlX3JlY3Q/LndpZHRoIHx8IDEgKTtcblx0XHRcdGNvbnN0IGhlaWdodCA9IE1hdGgubWF4KCAxLCBkcmFnX3N0YXRlLnNvdXJjZV9yZWN0Py5oZWlnaHQgfHwgMSApO1xuXG5cdFx0XHRzcGFjZXIuY2xhc3NOYW1lID0gJ3dwYmNfYmZiX19kcmFnLXNvdXJjZS1zcGFjZXInO1xuXHRcdFx0c3BhY2VyLnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XG5cdFx0XHRzcGFjZXIuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1kcmFnLXNvdXJjZS1zcGFjZXInLCAndHJ1ZScgKTtcblx0XHRcdHNwYWNlci5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItZHJhZy1zb3VyY2UtaW5saW5lLXNpemUnLCBgJHt3aWR0aH1weGAgKTtcblx0XHRcdHNwYWNlci5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1iZmItZHJhZy1zb3VyY2UtYmxvY2stc2l6ZScsIGAke2hlaWdodH1weGAgKTtcblxuXHRcdFx0Y29uc3QgcmVmZXJlbmNlX25vZGUgPSBkcmFnX3N0YXRlLnNvdXJjZV9uZXh0X3NpYmxpbmc/LnBhcmVudE5vZGUgPT09IGRyYWdfc3RhdGUuc291cmNlX3BhcmVudFxuXHRcdFx0XHQ/IGRyYWdfc3RhdGUuc291cmNlX25leHRfc2libGluZ1xuXHRcdFx0XHQ6IG51bGw7XG5cblx0XHRcdGRyYWdfc3RhdGUuc291cmNlX3BhcmVudC5pbnNlcnRCZWZvcmUoIHNwYWNlciwgcmVmZXJlbmNlX25vZGUgKTtcblx0XHRcdGRyYWdfc3RhdGUuc291cmNlX3NwYWNlciA9IHNwYWNlcjtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdGFydCB0aGUgc3RhYmxlIGRyYWcgcmVwcmVzZW50YXRpb24gYWZ0ZXIgU29ydGFibGVKUyBjcmVhdGVzIGl0cyBvZmYtZmxvdyBtaXJyb3IuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge1NvcnRhYmxlLlNvcnRhYmxlRXZlbnR9IGV2dCAtIFNvcnRhYmxlIHN0YXJ0IGV2ZW50LlxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdCAqL1xuXHRcdF9zdGFydF9kcmFnKCBldnQgKSB7XG5cdFx0XHRpZiAoICEgdGhpcy5fZHJhZ19zdGF0ZSApIHtcblx0XHRcdFx0dGhpcy5fcHJlcGFyZV9kcmFnX3N0YXRlKCBldnQgKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fYXBwbHlfY2FudmFzX2dlb21ldHJ5X2xvY2tzKCk7XG5cdFx0XHR0aGlzLmJ1aWxkZXI/Ll9hZGRfZHJhZ2dpbmdfY2xhc3M/LigpO1xuXG5cdFx0XHRjb25zdCBmcm9tX3BhbGV0dGUgPSAhISB0aGlzLl9kcmFnX3N0YXRlPy5mcm9tX3BhbGV0dGU7XG5cdFx0XHR0aGlzLl90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MoIHRydWUsIGZyb21fcGFsZXR0ZSApO1xuXHRcdFx0dGhpcy5fdGFnX2RyYWdfbWlycm9yKCBldnQgKTtcblxuXHRcdFx0aWYgKCAhIGZyb21fcGFsZXR0ZSAmJiBldnQ/Lml0ZW0gKSB7XG5cdFx0XHRcdHRoaXMuX2NyZWF0ZV9kcmFnX3NvdXJjZV9zcGFjZXIoKTtcblx0XHRcdFx0ZXZ0Lml0ZW0uY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19kcm9wLWluZGljYXRvcicgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5pc2ggYSBGb3JtIEJ1aWxkZXIgZHJhZyBhbmQgcmVtb3ZlIHRyYW5zaWVudCBsYXlvdXQgaGVscGVycy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdCAqL1xuXHRcdF9maW5pc2hfZHJhZygpIHtcblx0XHRcdHRoaXMuX2NsZWFudXBfZHJhZ191aSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENoZWNrIHdoZXRoZXIgYSBTb3J0YWJsZUpTIGNhbnZhcyBjYW5kaWRhdGUgaXMgc3RhYmxlIGVub3VnaCB0byBhY2NlcHQuXG5cdFx0ICpcblx0XHQgKiBUaGUgY2FuZGlkYXRlIGluY2x1ZGVzIHRoZSBkZXN0aW5hdGlvbiBjb250YWluZXIsIHJlbGF0ZWQgc2libGluZywgYW5kIGluc2VydGlvblxuXHRcdCAqIHNpZGUuIEEgbmV3IGNhbmRpZGF0ZSBtdXN0IHJlY2VpdmUgcmVhbCBwb2ludGVyIG1vdmVtZW50IGJlZm9yZSBpdCBjYW4gcmVwbGFjZVxuXHRcdCAqIHRoZSBhY2NlcHRlZCBwb3NpdGlvbiwgcHJldmVudGluZyBsYXlvdXQgbW92ZW1lbnQgYWxvbmUgZnJvbSBjYXVzaW5nIGZsaXAtZmxvcHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZXZ0IC0gU29ydGFibGUgbW92ZSBldmVudC5cblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR8UG9pbnRlckV2ZW50fFRvdWNoRXZlbnR9IG9yaWdpbmFsX2V2ZW50IC0gT3JpZ2luYWwgcG9pbnRlciBldmVudC5cblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gV2hldGhlciBTb3J0YWJsZUpTIG1heSBtb3ZlIHRoZSBpbi1mbG93IGluc2VydGlvbiBpbmRpY2F0b3IuXG5cdFx0ICovXG5cdFx0X2FsbG93X2NhbnZhc19tb3ZlKCBldnQsIG9yaWdpbmFsX2V2ZW50ICkge1xuXHRcdFx0Y29uc3QgeyB0bywgZnJvbSB9ID0gZXZ0IHx8IHt9O1xuXHRcdFx0aWYgKCAhIHRvIHx8ICEgZnJvbSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggISB0by5jbG9zZXN0KCAnLndwYmNfYmZiX19wYW5lbC0tcHJldmlldycgKSApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRvdWNoX2V2ZW50ICA9IG9yaWdpbmFsX2V2ZW50Py50b3VjaGVzPy5bMF0gfHwgb3JpZ2luYWxfZXZlbnQ/LmNoYW5nZWRUb3VjaGVzPy5bMF07XG5cdFx0XHRjb25zdCBldmVudF94ICAgICAgPSB0b3VjaF9ldmVudD8uY2xpZW50WCA/PyBvcmlnaW5hbF9ldmVudD8uY2xpZW50WDtcblx0XHRcdGNvbnN0IGV2ZW50X3kgICAgICA9IHRvdWNoX2V2ZW50Py5jbGllbnRZID8/IG9yaWdpbmFsX2V2ZW50Py5jbGllbnRZO1xuXHRcdFx0Y29uc3QgZHJhZ2dlZF9yZWN0ID0gZXZ0LmRyYWdnZWRSZWN0IHx8IGV2dC5kcmFnZ2VkPy5nZXRCb3VuZGluZ0NsaWVudFJlY3Q/LigpO1xuXHRcdFx0Y29uc3QgcG9pbnRlcl94ICAgID0gTnVtYmVyLmlzRmluaXRlKCBldmVudF94IClcblx0XHRcdFx0PyBldmVudF94XG5cdFx0XHRcdDogKGRyYWdnZWRfcmVjdCA/IGRyYWdnZWRfcmVjdC5sZWZ0ICsgKGRyYWdnZWRfcmVjdC53aWR0aCAvIDIpIDogMCk7XG5cdFx0XHRjb25zdCBwb2ludGVyX3kgICAgPSBOdW1iZXIuaXNGaW5pdGUoIGV2ZW50X3kgKVxuXHRcdFx0XHQ/IGV2ZW50X3lcblx0XHRcdFx0OiAoZHJhZ2dlZF9yZWN0ID8gZHJhZ2dlZF9yZWN0LnRvcCArIChkcmFnZ2VkX3JlY3QuaGVpZ2h0IC8gMikgOiAwKTtcblxuXHRcdFx0Ly8gQ3Jvc3MtY29udGFpbmVyIGNvbHVtbiBjaGFuZ2VzIHJlcXVpcmUgYSBkZWxpYmVyYXRlIG1vdmUgaW5zaWRlIHRoZSBuZXcgY29sdW1uLlxuXHRcdFx0aWYgKCB0byAhPT0gZnJvbSAmJiB0by5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX2NvbHVtbicgKSApIHtcblx0XHRcdFx0Y29uc3QgY29udGFpbmVyX3JlY3QgPSB0by5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0Y29uc3QgcGFkZGluZ194ICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5jbGFtcCggY29udGFpbmVyX3JlY3Qud2lkdGggKiAwLjIwLCAxMiwgMzYgKTtcblx0XHRcdFx0Y29uc3QgcGFkZGluZ195ICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5jbGFtcCggY29udGFpbmVyX3JlY3QuaGVpZ2h0ICogMC4xMCwgNiwgMTYgKTtcblx0XHRcdFx0Y29uc3QgdmlzdWFsbHlfZW1wdHkgID0gISB0by5xdWVyeVNlbGVjdG9yKFxuXHRcdFx0XHRcdCc6c2NvcGUgPiAud3BiY19iZmJfX2ZpZWxkOm5vdCgud3BiY19iZmJfX2Ryb3AtaW5kaWNhdG9yKSwgJyArXG5cdFx0XHRcdFx0JzpzY29wZSA+IC53cGJjX2JmYl9fc2VjdGlvbjpub3QoLndwYmNfYmZiX19kcm9wLWluZGljYXRvciknXG5cdFx0XHRcdCkgfHwgY29udGFpbmVyX3JlY3QuaGVpZ2h0IDwgNjQ7XG5cdFx0XHRcdGNvbnN0IGlubmVyX3RvcCAgICAgICA9IGNvbnRhaW5lcl9yZWN0LnRvcCArICh2aXN1YWxseV9lbXB0eSA/IDQgOiBwYWRkaW5nX3kpO1xuXHRcdFx0XHRjb25zdCBpbm5lcl9ib3R0b20gICAgPSBjb250YWluZXJfcmVjdC5ib3R0b20gLSAodmlzdWFsbHlfZW1wdHkgPyA0IDogcGFkZGluZ195KTtcblx0XHRcdFx0Y29uc3QgaW5uZXJfbGVmdCAgICAgID0gY29udGFpbmVyX3JlY3QubGVmdCArIHBhZGRpbmdfeDtcblx0XHRcdFx0Y29uc3QgaW5uZXJfcmlnaHQgICAgID0gY29udGFpbmVyX3JlY3QucmlnaHQgLSBwYWRkaW5nX3g7XG5cblx0XHRcdFx0aWYgKCBwb2ludGVyX3ggPD0gaW5uZXJfbGVmdCB8fCBwb2ludGVyX3ggPj0gaW5uZXJfcmlnaHQgfHwgcG9pbnRlcl95IDw9IGlubmVyX3RvcCB8fCBwb2ludGVyX3kgPj0gaW5uZXJfYm90dG9tICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkcmFnX3N0YXRlID0gdGhpcy5fZHJhZ19zdGF0ZTtcblx0XHRcdGlmICggISBkcmFnX3N0YXRlICkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY2FuZGlkYXRlID0ge1xuXHRcdFx0XHR0byAgICAgICAgICAgICAgICA6IHRvLFxuXHRcdFx0XHRyZWxhdGVkICAgICAgICAgICA6IGV2dC5yZWxhdGVkIHx8IG51bGwsXG5cdFx0XHRcdHdpbGxfaW5zZXJ0X2FmdGVyIDogISEgZXZ0LndpbGxJbnNlcnRBZnRlclxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZV9tYXRjaGVzID0gKCBmaXJzdCwgc2Vjb25kICkgPT4gISEgZmlyc3QgJiYgISEgc2Vjb25kICYmXG5cdFx0XHRcdGZpcnN0LnRvID09PSBzZWNvbmQudG8gJiZcblx0XHRcdFx0Zmlyc3QucmVsYXRlZCA9PT0gc2Vjb25kLnJlbGF0ZWQgJiZcblx0XHRcdFx0Zmlyc3Qud2lsbF9pbnNlcnRfYWZ0ZXIgPT09IHNlY29uZC53aWxsX2luc2VydF9hZnRlcjtcblxuXHRcdFx0aWYgKCBjYW5kaWRhdGVfbWF0Y2hlcyggY2FuZGlkYXRlLCBkcmFnX3N0YXRlLmFjY2VwdGVkX2NhbmRpZGF0ZSApICkge1xuXHRcdFx0XHRldnQuZHJhZ2dlZD8uY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19kcm9wLWluZGljYXRvcicgKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5vdyA9IHdpbmRvdy5wZXJmb3JtYW5jZT8ubm93Py4oKSA/PyBEYXRlLm5vdygpO1xuXHRcdFx0aWYgKCAhIGNhbmRpZGF0ZV9tYXRjaGVzKCBjYW5kaWRhdGUsIGRyYWdfc3RhdGUucGVuZGluZ19jYW5kaWRhdGUgKSApIHtcblx0XHRcdFx0ZHJhZ19zdGF0ZS5wZW5kaW5nX2NhbmRpZGF0ZSA9IGNhbmRpZGF0ZTtcblx0XHRcdFx0ZHJhZ19zdGF0ZS5wZW5kaW5nX3NpbmNlICAgICA9IG5vdztcblx0XHRcdFx0ZHJhZ19zdGF0ZS5wZW5kaW5nX3BvaW50ZXIgICA9IHsgeDogcG9pbnRlcl94LCB5OiBwb2ludGVyX3kgfTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwb2ludGVyX2Rpc3RhbmNlID0gTWF0aC5oeXBvdChcblx0XHRcdFx0cG9pbnRlcl94IC0gZHJhZ19zdGF0ZS5wZW5kaW5nX3BvaW50ZXIueCxcblx0XHRcdFx0cG9pbnRlcl95IC0gZHJhZ19zdGF0ZS5wZW5kaW5nX3BvaW50ZXIueVxuXHRcdFx0KTtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZV9hZ2UgICAgICAgICAgICA9IG5vdyAtIGRyYWdfc3RhdGUucGVuZGluZ19zaW5jZTtcblx0XHRcdGNvbnN0IGNyb3NzZWRfY29tbWl0X2Rpc3RhbmNlID0gcG9pbnRlcl9kaXN0YW5jZSA+PSB0aGlzLm9wdHMuY2FuZGlkYXRlX2NvbW1pdF9kaXN0YW5jZTtcblx0XHRcdGNvbnN0IGNvbXBsZXRlZF9kd2VsbF9tb3ZlICAgID0gY2FuZGlkYXRlX2FnZSA+PSB0aGlzLm9wdHMuY2FuZGlkYXRlX2R3ZWxsX21zICYmXG5cdFx0XHRcdHBvaW50ZXJfZGlzdGFuY2UgPj0gdGhpcy5vcHRzLmNhbmRpZGF0ZV9kd2VsbF9kaXN0YW5jZTtcblxuXHRcdFx0aWYgKCAhIGNyb3NzZWRfY29tbWl0X2Rpc3RhbmNlICYmICEgY29tcGxldGVkX2R3ZWxsX21vdmUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0ZHJhZ19zdGF0ZS5hY2NlcHRlZF9jYW5kaWRhdGUgPSBjYW5kaWRhdGU7XG5cdFx0XHRkcmFnX3N0YXRlLnBlbmRpbmdfY2FuZGlkYXRlICA9IG51bGw7XG5cdFx0XHRkcmFnX3N0YXRlLnBlbmRpbmdfc2luY2UgICAgICA9IDA7XG5cdFx0XHRkcmFnX3N0YXRlLnBlbmRpbmdfcG9pbnRlciAgICA9IG51bGw7XG5cdFx0XHRldnQuZHJhZ2dlZD8uY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19kcm9wLWluZGljYXRvcicgKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJpbmQgZ2xvYmFsIGZhaWwtc2FmZSBsaXN0ZW5lcnMgZm9yIGRyYWcgY2xlYW51cC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X2JpbmRfZHJhZ19mYWlsX3NhZmUoKSB7XHJcblx0XHRcdGlmICggdGhpcy5fZHJhZ19mYWlsX3NhZmVfYm91bmQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9kcmFnX2ZhaWxfc2FmZV9ib3VuZCA9IHRydWU7XHJcblxyXG5cdFx0XHRjb25zdCBmaW5pc2hfZHJhZyA9ICgpID0+IHtcclxuXHRcdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCAoKSA9PiB7XHJcblx0XHRcdFx0XHR0aGlzLl9jbGVhbnVwX2RyYWdfdWkoKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRbICdtb3VzZXVwJywgJ3BvaW50ZXJ1cCcsICd0b3VjaGVuZCcsICdkcmFnZW5kJyBdLmZvckVhY2goIChldnRfbmFtZSkgPT4ge1xyXG5cdFx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIGV2dF9uYW1lLCBmaW5pc2hfZHJhZywgdHJ1ZSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ2JsdXInLCBmaW5pc2hfZHJhZywgdHJ1ZSApO1xyXG5cclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcclxuXHRcdFx0XHQndmlzaWJpbGl0eWNoYW5nZScsXHJcblx0XHRcdFx0KCkgPT4ge1xyXG5cdFx0XHRcdFx0aWYgKCBkb2N1bWVudC5oaWRkZW4gKSB7XHJcblx0XHRcdFx0XHRcdGZpbmlzaF9kcmFnKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR0cnVlXHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUYWcgdGhlIGRyYWcgbWlycm9yIChlbGVtZW50IHVuZGVyIGN1cnNvcikgd2l0aCByb2xlOiAncGFsZXR0ZScgfCAnY2FudmFzJy5cclxuXHRcdCAqIFdvcmtzIHdpdGggU29ydGFibGUncyBmYWxsYmFjayBtaXJyb3IgKC5zb3J0YWJsZS1mYWxsYmFjayAvIC5zb3J0YWJsZS1kcmFnKSBhbmQgd2l0aCB5b3VyIGRyYWdDbGFzc1xyXG5cdFx0ICogKC53cGJjX2JmYl9fZHJhZy1hY3RpdmUpLlxyXG5cdFx0ICovXHJcblx0XHRfdGFnX2RyYWdfbWlycm9yKCBldnQgKSB7XHJcblx0XHRcdGNvbnN0IGZyb21QYWxldHRlID0gdGhpcy5idWlsZGVyPy5wYWxldHRlX3Vscz8uaW5jbHVkZXM/LiggZXZ0LmZyb20gKTtcclxuXHRcdFx0Y29uc3Qgcm9sZSAgICAgICAgPSBmcm9tUGFsZXR0ZSA/ICdwYWxldHRlJyA6ICdjYW52YXMnO1xyXG5cdFx0XHQvLyBXYWl0IGEgdGljayBzbyB0aGUgbWlycm9yIGV4aXN0cy4gIC0gVGhlIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKSBtZXRob2QgdGVsbHMgdGhlIGJyb3dzZXIgeW91IHdpc2ggdG8gcGVyZm9ybSBhbiBhbmltYXRpb24uXHJcblx0XHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSggKCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IG1pcnJvciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcuc29ydGFibGUtZmFsbGJhY2ssIC5zb3J0YWJsZS1kcmFnLCAuJyArIHRoaXMub3B0cy5kcmFnQ2xhc3MgKTtcblx0XHRcdFx0aWYgKCBtaXJyb3IgKSB7XG5cdFx0XHRcdFx0bWlycm9yLnNldEF0dHJpYnV0ZSggJ2RhdGEtZHJhZy1yb2xlJywgcm9sZSApO1xuXHRcdFx0XHRcdG1pcnJvci5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0X3RvZ2dsZV9kbmRfcm9vdF9mbGFncyggYWN0aXZlLCBmcm9tX3BhbGV0dGUgPSBmYWxzZSApIHtcclxuXHJcblx0XHRcdC8vIHNldCB0byByb290IGVsZW1lbnQgb2YgYW4gSFRNTCBkb2N1bWVudCwgd2hpY2ggaXMgdGhlIDxodG1sPi5cclxuXHRcdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcclxuXHRcdFx0aWYgKCBhY3RpdmUgKSB7XHJcblx0XHRcdFx0cm9vdC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2RuZC1hY3RpdmUnICk7XHJcblx0XHRcdFx0aWYgKCBmcm9tX3BhbGV0dGUgKSB7XHJcblx0XHRcdFx0XHRyb290LmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fZHJhZy1mcm9tLXBhbGV0dGUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJvb3QuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYmZiX19kbmQtYWN0aXZlJywgJ3dwYmNfYmZiX19kcmFnLWZyb20tcGFsZXR0ZScgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVuc3VyZSBhIHNpbXBsZSB2ZXJ0aWNhbCBzb3J0YWJsZSBsaXN0LlxyXG5cdFx0ICpcclxuXHRcdCAqIFRoaXMgY29uZmlndXJhdGlvbiBpcyBpbnRlbmRlZCBmb3IgaW5zcGVjdG9yL3NpZGViYXIgbGlzdHMgc3VjaCBhczpcclxuXHRcdCAqIC0gZHJvcGRvd24gY2hvaWNlc1xyXG5cdFx0ICogLSByYWRpbyBvcHRpb25zXHJcblx0XHQgKiAtIGNoZWNrYm94IG9wdGlvbnNcclxuXHRcdCAqXHJcblx0XHQgKiBJdCBpcyBpbnRlbnRpb25hbGx5IG11Y2ggc2ltcGxlciB0aGFuIHRoZSBjYW52YXMgRG5EIGNvbmZpZyBhbmQgZG9lcyBub3RcclxuXHRcdCAqIHVzZSB0aGUgY29sdW1uIGVkZ2UtZmVuY2UgLyBzdGlja3ktdGFyZ2V0IGxvZ2ljLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lciAtIFNvcnRhYmxlIGxpc3QgY29udGFpbmVyLlxyXG5cdFx0ICogQHBhcmFtIHt7IGhhbmRsZV9zZWxlY3Rvcj86IHN0cmluZywgZHJhZ2dhYmxlX3NlbGVjdG9yPzogc3RyaW5nLCBvblVwZGF0ZT86IEZ1bmN0aW9uIH19IFtoYW5kbGVycz17fV0gLVxyXG5cdFx0ICogICAgIE9wdGlvbmFsIGhhbmRsZXJzL3NlbGVjdG9ycy5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRlbnN1cmVfc2ltcGxlX2xpc3QoIGNvbnRhaW5lciwgaGFuZGxlcnMgPSB7fSApIHtcclxuXHRcdFx0aWYgKCAhIGNvbnRhaW5lciB8fCB0eXBlb2YgU29ydGFibGUgPT09ICd1bmRlZmluZWQnICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIFNvcnRhYmxlLmdldD8uKCBjb250YWluZXIgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGNvbW1vbiA9IHtcclxuXHRcdFx0XHRhbmltYXRpb24gICAgICAgIDogdGhpcy5vcHRzLmFuaW1hdGlvbixcclxuXHRcdFx0XHRnaG9zdENsYXNzICAgICAgIDogdGhpcy5vcHRzLmdob3N0Q2xhc3MsXHJcblx0XHRcdFx0Y2hvc2VuQ2xhc3MgICAgICA6IHRoaXMub3B0cy5jaG9zZW5DbGFzcyxcclxuXHRcdFx0XHRkcmFnQ2xhc3MgICAgICAgIDogdGhpcy5vcHRzLmRyYWdDbGFzcyxcclxuXHRcdFx0XHRmb3JjZUZhbGxiYWNrICAgIDogdHJ1ZSxcclxuXHRcdFx0XHQvLyBGb3IgYSBzaW5nbGUgc2Nyb2xsYWJsZSBzaWRlYmFyIGxpc3QgdGhpcyBpcyB1c3VhbGx5IG1vcmUgc3RhYmxlLlxyXG5cdFx0XHRcdGZhbGxiYWNrT25Cb2R5ICAgOiBmYWxzZSxcclxuXHRcdFx0XHRmYWxsYmFja1RvbGVyYW5jZTogOCxcclxuXHRcdFx0XHRyZW1vdmVDbG9uZU9uSGlkZTogdHJ1ZSxcclxuXHRcdFx0XHRvblN0YXJ0ICAgICAgICAgIDogKCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5idWlsZGVyPy5fYWRkX2RyYWdnaW5nX2NsYXNzPy4oKTtcclxuXHRcdFx0XHRcdHRoaXMuX3RvZ2dsZV9kbmRfcm9vdF9mbGFncyggdHJ1ZSwgZmFsc2UgKTtcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdG9uRW5kICAgICAgICAgICAgOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdHRoaXMuYnVpbGRlcj8uX3JlbW92ZV9kcmFnZ2luZ19jbGFzcz8uKCk7XHJcblx0XHRcdFx0XHR9LCA1MCApO1xyXG5cdFx0XHRcdFx0dGhpcy5fdG9nZ2xlX2RuZF9yb290X2ZsYWdzKCBmYWxzZSApO1xyXG5cdFx0XHRcdFx0dGhpcy5fY2xlYW51cF9kcmFnX3VpKCk7XG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdFNvcnRhYmxlLmNyZWF0ZShcclxuXHRcdFx0XHRjb250YWluZXIsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0Li4uY29tbW9uLFxyXG5cdFx0XHRcdFx0Z3JvdXAgICAgICAgICAgICAgICAgICA6IHsgbmFtZTogdGhpcy5vcHRzLmdyb3VwTmFtZSwgcHVsbDogZmFsc2UsIHB1dDogZmFsc2UgfSxcclxuXHRcdFx0XHRcdHNvcnQgICAgICAgICAgICAgICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0ZGlyZWN0aW9uICAgICAgICAgICAgICA6ICd2ZXJ0aWNhbCcsXHJcblx0XHRcdFx0XHRoYW5kbGUgICAgICAgICAgICAgICAgIDogaGFuZGxlcnMuaGFuZGxlX3NlbGVjdG9yIHx8ICcud3BiY19iZmJfX2RyYWctaGFuZGxlJyxcclxuXHRcdFx0XHRcdGRyYWdnYWJsZSAgICAgICAgICAgICAgOiBoYW5kbGVycy5kcmFnZ2FibGVfc2VsZWN0b3IgfHwgJy53cGJjX2JmYl9fc29ydGFibGUtcm93JyxcclxuXHRcdFx0XHRcdGZhbGxiYWNrQ2xhc3MgICAgICAgICAgOiAnd3BiY19iZmJfX3NpbXBsZV9saXN0X2ZhbGxiYWNrJyxcclxuXHRcdFx0XHRcdGZpbHRlciAgICAgICAgICAgICAgICAgOiBbXHJcblx0XHRcdFx0XHRcdCdpbnB1dCcsXHJcblx0XHRcdFx0XHRcdCd0ZXh0YXJlYScsXHJcblx0XHRcdFx0XHRcdCdzZWxlY3QnLFxyXG5cdFx0XHRcdFx0XHQnYnV0dG9uJyxcclxuXHRcdFx0XHRcdFx0J2EnLFxyXG5cdFx0XHRcdFx0XHQnLndwYmNfYmZiX19uby1kcmFnLXpvbmUnLFxyXG5cdFx0XHRcdFx0XHQnLndwYmNfYmZiX19uby1kcmFnLXpvbmUgKidcclxuXHRcdFx0XHRcdF0uam9pbiggJywnICksXHJcblx0XHRcdFx0XHRwcmV2ZW50T25GaWx0ZXIgICAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0XHRpbnZlcnRTd2FwICAgICAgICAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0XHRzd2FwVGhyZXNob2xkICAgICAgICAgIDogMC4zMCxcclxuXHRcdFx0XHRcdGludmVydGVkU3dhcFRocmVzaG9sZCAgOiAwLjYwLFxyXG5cdFx0XHRcdFx0ZW1wdHlJbnNlcnRUaHJlc2hvbGQgICA6IDgsXHJcblx0XHRcdFx0XHRkcmFnb3ZlckJ1YmJsZSAgICAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0XHRzY3JvbGwgICAgICAgICAgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHNjcm9sbFNlbnNpdGl2aXR5ICAgICAgOiA2MCxcclxuXHRcdFx0XHRcdHNjcm9sbFNwZWVkICAgICAgICAgICAgOiAxNCxcclxuXHRcdFx0XHRcdG9uVXBkYXRlICAgICAgICAgICAgICAgOiBoYW5kbGVycy5vblVwZGF0ZSB8fCBmdW5jdGlvbiAoKSB7fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdHRoaXMuX2NvbnRhaW5lcnMuYWRkKCBjb250YWluZXIgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbnN1cmUgU29ydGFibGUgaXMgYXR0YWNoZWQgdG8gYSBjb250YWluZXIgd2l0aCByb2xlICdwYWxldHRlJyBvciAnY2FudmFzJy5cclxuXHRcdCAqXHJcblx0XHQgKiAgLS0gSGFuZGxlIHNlbGVjdG9yczogaGFuZGxlOiAgJy5zZWN0aW9uLWRyYWctaGFuZGxlLCAud3BiY19iZmJfX2RyYWctaGFuZGxlLCAud3BiY19iZmJfX2RyYWctYW55d2hlcmUsXHJcblx0XHQgKiBbZGF0YS1kcmFnZ2FibGU9XCJ0cnVlXCJdJ1xyXG5cdFx0ICogIC0tIERyYWdnYWJsZSBnYXRlOiBkcmFnZ2FibGUgZmllbGRzLCBzZWN0aW9ucywgYW5kIHRoZSB0cmFuc2llbnQgbWVhc3VyZWQgc291cmNlIHNwYWNlci5cblx0XHQgKiAgLS0gRmlsdGVyIChvdmVybGF5LXNhZmUpOiAgICAgaWdub3JlIGV2ZXJ5dGhpbmcgaW4gb3ZlcmxheSBleGNlcHQgdGhlIGhhbmRsZSAtXHJcblx0XHQgKiAnLndwYmNfYmZiX19vdmVybGF5LWNvbnRyb2xzXHJcblx0XHQgKiAqOm5vdCgud3BiY19iZmJfX2RyYWctaGFuZGxlKTpub3QoLnNlY3Rpb24tZHJhZy1oYW5kbGUpOm5vdCgud3BiY19pY25fZHJhZ19pbmRpY2F0b3IpJ1xyXG5cdFx0ICogIC0tIE5vLWRyYWcgd3JhcHBlcjogICAgICAgICAgIHVzZSAud3BiY19iZmJfX25vLWRyYWctem9uZSBpbnNpZGUgcmVuZGVyZXJzIGZvciBpbnB1dHMvd2lkZ2V0cy5cclxuXHRcdCAqICAtLSBGb2N1cyBndWFyZCAob3B0aW9uYWwpOiAgICBmbGlwIFtkYXRhLWRyYWdnYWJsZV0gb24gZm9jdXNpbi9mb2N1c291dCB0byBwcmV2ZW50IGFjY2lkZW50YWwgZHJhZ3Mgd2hpbGVcclxuXHRcdCAqIHR5cGluZy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXIgLSBUaGUgZWxlbWVudCB0byBlbmhhbmNlIHdpdGggU29ydGFibGUuXHJcblx0XHQgKiBAcGFyYW0geydwYWxldHRlJ3wnY2FudmFzJ30gcm9sZSAtIEJlaGF2aW9yIHByb2ZpbGUgdG8gYXBwbHkuXHJcblx0XHQgKiBAcGFyYW0ge3sgb25BZGQ/OiBGdW5jdGlvbiB9fSBbaGFuZGxlcnM9e31dIC0gT3B0aW9uYWwgaGFuZGxlcnMuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZW5zdXJlKCBjb250YWluZXIsIHJvbGUsIGhhbmRsZXJzID0ge30gKSB7XHJcblx0XHRcdGlmICggISBjb250YWluZXIgfHwgdHlwZW9mIFNvcnRhYmxlID09PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBTb3J0YWJsZS5nZXQ/LiggY29udGFpbmVyICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBzb3J0YWJsZV9raW5kID0gaGFuZGxlcnMuc29ydGFibGVfa2luZCB8fCAnJztcclxuXHJcblx0XHRcdGlmICggc29ydGFibGVfa2luZCA9PT0gJ3NpbXBsZV9saXN0JyApIHtcclxuXHRcdFx0XHR0aGlzLmVuc3VyZV9zaW1wbGVfbGlzdCggY29udGFpbmVyLCBoYW5kbGVycyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgY29tbW9uID0ge1xyXG5cdFx0XHRcdGFuaW1hdGlvbiAgOiB0aGlzLm9wdHMuYW5pbWF0aW9uLFxyXG5cdFx0XHRcdGdob3N0Q2xhc3MgOiB0aGlzLm9wdHMuZ2hvc3RDbGFzcyxcclxuXHRcdFx0XHRjaG9zZW5DbGFzczogdGhpcy5vcHRzLmNob3NlbkNsYXNzLFxyXG5cdFx0XHRcdGRyYWdDbGFzcyAgOiB0aGlzLm9wdHMuZHJhZ0NsYXNzLFxyXG5cdFx0XHRcdC8vID09IEVsZW1lbnQgdW5kZXIgdGhlIGN1cnNvciAgPT0gRW5zdXJlIHdlIGRyYWcgYSByZWFsIERPTSBtaXJyb3IgeW91IGNhbiBzdHlsZSB2aWEgQ1NTIChjcm9zcy1icm93c2VyKS5cclxuXHRcdFx0XHRmb3JjZUZhbGxiYWNrICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRmYWxsYmFja09uQm9keSAgIDogdHJ1ZSxcclxuXHRcdFx0XHRmYWxsYmFja1RvbGVyYW5jZTogOCxcclxuXHRcdFx0XHRyZW1vdmVDbG9uZU9uSGlkZTogdHJ1ZSxcblx0XHRcdFx0b25DaG9vc2U6IChldnQpID0+IHRoaXMuX3ByZXBhcmVfZHJhZ19zdGF0ZSggZXZ0ICksXG5cdFx0XHRcdG9uU3RhcnQgOiAoZXZ0KSA9PiB0aGlzLl9zdGFydF9kcmFnKCBldnQgKSxcblx0XHRcdFx0b25FbmQgICA6ICgpID0+IHRoaXMuX2ZpbmlzaF9kcmFnKCksXG5cdFx0XHRcdG9uTW92ZSAgOiAoZXZ0LCBvcmlnaW5hbF9ldmVudCkgPT4gdGhpcy5fYWxsb3dfY2FudmFzX21vdmUoIGV2dCwgb3JpZ2luYWxfZXZlbnQgKVxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGlmICggcm9sZSA9PT0gJ3BhbGV0dGUnICkge1xyXG5cdFx0XHRcdFNvcnRhYmxlLmNyZWF0ZSggY29udGFpbmVyLCB7XHJcblx0XHRcdFx0XHQuLi5jb21tb24sXHJcblx0XHRcdFx0XHRncm91cCAgIDogeyBuYW1lOiB0aGlzLm9wdHMuZ3JvdXBOYW1lLCBwdWxsOiAnY2xvbmUnLCBwdXQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHRzb3J0ICAgIDogZmFsc2VcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0dGhpcy5fY29udGFpbmVycy5hZGQoIGNvbnRhaW5lciApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gcm9sZSA9PT0gJ2NhbnZhcycuXHJcblx0XHRcdFNvcnRhYmxlLmNyZWF0ZSggY29udGFpbmVyLCB7XG5cdFx0XHRcdC4uLmNvbW1vbixcblx0XHRcdFx0Ly8gU3RhYmxlIGluc2VydGlvbiBnZW9tZXRyeSBpcyBwcmVmZXJhYmxlIHRvIGFuaW1hdGluZyBoaXQtdGVzdCB0YXJnZXRzLlxuXHRcdFx0XHRhbmltYXRpb246IDAsXG5cdFx0XHRcdGdyb3VwICAgIDoge1xuXHRcdFx0XHRcdG5hbWU6IHRoaXMub3B0cy5ncm91cE5hbWUsXHJcblx0XHRcdFx0XHRwdWxsOiB0cnVlLFxyXG5cdFx0XHRcdFx0cHV0IDogKHRvLCBmcm9tLCBkcmFnZ2VkRWwpID0+IHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGRyYWdnZWRFbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgfHxcclxuXHRcdFx0XHRcdFx0XHQgICBkcmFnZ2VkRWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tIERuRCBIYW5kbGVycyAtLS0tLS0tLS0tLS0tLSAgICAgICAgICAgICAgICAvLyBHcmFiIGFueXdoZXJlIG9uIGZpZWxkcyB0aGF0IG9wdC1pbiB3aXRoIHRoZSBjbGFzcyBvciBhdHRyaWJ1dGUuICAtIFNlY3Rpb25zIHN0aWxsIHJlcXVpcmUgdGhlaXIgZGVkaWNhdGVkIGhhbmRsZS5cclxuXHRcdFx0XHRoYW5kbGUgICA6ICcuc2VjdGlvbi1kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWFueXdoZXJlLCBbZGF0YS1kcmFnZ2FibGU9XCJ0cnVlXCJdJyxcclxuXHRcdFx0XHQvLyBUaGUgdHJhbnNpZW50IHNwYWNlciBwYXJ0aWNpcGF0ZXMgaW4gaGl0IHRlc3RpbmcgYnV0IG5ldmVyIHNlcmlhbGl6YXRpb24uXG5cdFx0XHRcdGRyYWdnYWJsZTogW1xuXHRcdFx0XHRcdCcud3BiY19iZmJfX2ZpZWxkOm5vdChbZGF0YS1kcmFnZ2FibGU9XCJmYWxzZVwiXSknLFxuXHRcdFx0XHRcdCcud3BiY19iZmJfX3NlY3Rpb24nLFxuXHRcdFx0XHRcdCcud3BiY19iZmJfX2RyYWctc291cmNlLXNwYWNlcidcblx0XHRcdFx0XS5qb2luKCAnLCAnICksXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0gRmlsdGVycyAtIE5vIERuRCAtLS0tLS0tLS0tICAgICAgICAgICAgICAgIC8vIERlY2xhcmF0aXZlIOKAnG5vLWRyYWcgem9uZXPigJ06IGFueXRoaW5nIGluc2lkZSB0aGVzZSB3cmFwcGVycyB3b27igJl0IHN0YXJ0IGEgZHJhZy5cclxuXHRcdFx0XHRmaWx0ZXI6IFtcclxuXHRcdFx0XHRcdCcud3BiY19iZmJfX25vLWRyYWctem9uZScsXHJcblx0XHRcdFx0XHQnLndwYmNfYmZiX19uby1kcmFnLXpvbmUgKicsXHJcblx0XHRcdFx0XHQnLndwYmNfYmZiX19jb2x1bW4tcmVzaXplcicsICAvLyBJZ25vcmUgdGhlIHJlc2l6ZXIgcmFpbHMgZHVyaW5nIERuRCAocHJldmVudHMgZWRnZSDigJxzbmFw4oCdKS5cclxuXHRcdFx0XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEluIHRoZSBvdmVybGF5IHRvb2xiYXIsIGJsb2NrIGV2ZXJ5dGhpbmcgRVhDRVBUIHRoZSBkcmFnIGhhbmRsZSAoYW5kIGl0cyBpY29uKS5cclxuXHRcdFx0XHRcdCcud3BiY19iZmJfX292ZXJsYXktY29udHJvbHMgKjpub3QoLndwYmNfYmZiX19kcmFnLWhhbmRsZSk6bm90KC5zZWN0aW9uLWRyYWctaGFuZGxlKTpub3QoLndwYmNfaWNuX2RyYWdfaW5kaWNhdG9yKSdcclxuXHRcdFx0XHRdLmpvaW4oICcsJyApLFxyXG5cdFx0XHRcdHByZXZlbnRPbkZpbHRlciAgOiBmYWxzZSxcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0gYW50aS1qaXR0ZXIgdHVuaW5nIC0tLS0tLS0tLS1cclxuXHRcdFx0XHRkaXJlY3Rpb24gICAgICAgICAgICA6ICd2ZXJ0aWNhbCcsICAgICAgICAgICAvLyBjb2x1bW5zIGFyZSB2ZXJ0aWNhbCBsaXN0cy5cclxuXHRcdFx0XHRpbnZlcnRTd2FwICAgICAgICAgICA6IHRydWUsICAgICAgICAgICAgICAgICAvLyB1c2Ugc3dhcCBvbiBpbnZlcnRlZCBvdmVybGFwLlxyXG5cdFx0XHRcdHN3YXBUaHJlc2hvbGQgICAgICAgIDogMC42NSwgICAgICAgICAgICAgICAgIC8vIGJlIGxlc3MgZWFnZXIgdG8gc3dhcC5cclxuXHRcdFx0XHRpbnZlcnRlZFN3YXBUaHJlc2hvbGQ6IDAuODUsICAgICAgICAgICAgICAgICAvLyByZXF1aXJlIGRlZXBlciBvdmVybGFwIHdoZW4gaW52ZXJ0ZWQuXHJcblx0XHRcdFx0ZW1wdHlJbnNlcnRUaHJlc2hvbGQgOiAyNCwgICAgICAgICAgICAgICAgICAgLy8gZG9u4oCZdCBqdW1wIGludG8gZW1wdHkgY29udGFpbmVycyB0b28gZWFybHkuXHJcblx0XHRcdFx0ZHJhZ292ZXJCdWJibGUgICAgICAgOiBmYWxzZSwgICAgICAgICAgICAgICAgLy8ga2VlcCBkcmFnb3ZlciBsb2NhbC5cclxuXHRcdFx0XHRzY3JvbGwgICAgICAgICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0c2Nyb2xsU2Vuc2l0aXZpdHkgICAgOiA0MCxcclxuXHRcdFx0XHRzY3JvbGxTcGVlZCAgICAgICAgICA6IDEwLFxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0Ly8gb25BZGQ6IGhhbmRsZXJzLm9uQWRkIHx8IHRoaXMuYnVpbGRlci5oYW5kbGVfb25fYWRkLmJpbmQoIHRoaXMuYnVpbGRlciApXHJcblx0XHRcdFx0b25BZGQ6IChldnQpID0+IHtcclxuXHRcdFx0XHRcdGlmICggdGhpcy5fb25fYWRkX3NlY3Rpb24oIGV2dCApICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvLyBGYWxsYmFjazogb3JpZ2luYWwgaGFuZGxlciBmb3Igbm9ybWFsIGZpZWxkcy5cclxuXHRcdFx0XHRcdChoYW5kbGVycy5vbkFkZCB8fCB0aGlzLmJ1aWxkZXIuaGFuZGxlX29uX2FkZC5iaW5kKCB0aGlzLmJ1aWxkZXIgKSkoIGV2dCApO1xyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0b25VcGRhdGU6ICgpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuYnVpbGRlci5idXM/LmVtaXQ/LiggQ29yZS5XUEJDX0JGQl9FdmVudHMuU1RSVUNUVVJFX0NIQU5HRSwgeyByZWFzb246ICdzb3J0LXVwZGF0ZScgfSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dGhpcy5fY29udGFpbmVycy5hZGQoIGNvbnRhaW5lciApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSGFuZGxlIGFkZGluZy9tb3Zpbmcgc2VjdGlvbnMgdmlhIFNvcnRhYmxlIG9uQWRkLlxyXG5cdFx0ICogUmV0dXJucyB0cnVlIGlmIGhhbmRsZWQgKGkuZS4sIGl0IHdhcyBhIHNlY3Rpb24pLCBmYWxzZSB0byBsZXQgdGhlIGRlZmF1bHQgZmllbGQgaGFuZGxlciBydW4uXHJcblx0XHQgKlxyXG5cdFx0ICogLSBQYWxldHRlIC0+IGNhbnZhczogcmVtb3ZlIHRoZSBwbGFjZWhvbGRlciBjbG9uZSBhbmQgYnVpbGQgYSBmcmVzaCBzZWN0aW9uIHZpYSBhZGRfc2VjdGlvbigpXHJcblx0XHQgKiAtIENhbnZhcyAtPiBjYW52YXM6IGtlZXAgdGhlIG1vdmVkIERPTSAoYW5kIGl0cyBjaGlsZHJlbiksIGp1c3QgcmUtd2lyZSBvdmVybGF5cy9zb3J0YWJsZXMvbWV0YWRhdGFcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge1NvcnRhYmxlLlNvcnRhYmxlRXZlbnR9IGV2dFxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdF9vbl9hZGRfc2VjdGlvbihldnQpIHtcclxuXHJcblx0XHRcdGNvbnN0IGl0ZW0gPSBldnQuaXRlbTtcclxuXHRcdFx0aWYgKCAhIGl0ZW0gKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJZGVudGlmeSBzZWN0aW9ucyBib3RoIGZyb20gcGFsZXR0ZSBpdGVtcyAobGkgY2xvbmVzKSBhbmQgcmVhbCBjYW52YXMgbm9kZXMuXHJcblx0XHRcdGNvbnN0IGRhdGEgICAgICA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBpdGVtICk7XHJcblx0XHRcdGNvbnN0IGlzU2VjdGlvbiA9IGl0ZW0uY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgfHwgKGRhdGE/LnR5cGUgfHwgaXRlbS5kYXRhc2V0Py50eXBlKSA9PT0gJ3NlY3Rpb24nO1xyXG5cclxuXHRcdFx0aWYgKCAhIGlzU2VjdGlvbiApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGZyb21QYWxldHRlID0gdGhpcy5idWlsZGVyPy5wYWxldHRlX3Vscz8uaW5jbHVkZXM/LiggZXZ0LmZyb20gKSA9PT0gdHJ1ZTtcclxuXHJcblx0XHRcdGlmICggISBmcm9tUGFsZXR0ZSApIHtcclxuXHRcdFx0XHQvLyBDYW52YXMgLT4gY2FudmFzIG1vdmU6IERPIE5PVCByZWJ1aWxkL3JlbW92ZTsgcHJlc2VydmUgY2hpbGRyZW4uXHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmFkZF9vdmVybGF5X3Rvb2xiYXI/LiggaXRlbSApOyAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIG92ZXJsYXkgZXhpc3RzXHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLnBhZ2VzX3NlY3Rpb25zPy5pbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzPy4oIGl0ZW0gKTsgLy8gZW5zdXJlIGlubmVyIHNvcnRhYmxlc1xyXG5cclxuXHRcdFx0XHQvLyBFbnN1cmUgbWV0YWRhdGEgcHJlc2VudC91cGRhdGVkXHJcblx0XHRcdFx0aXRlbS5kYXRhc2V0LnR5cGUgICAgPSAnc2VjdGlvbic7XHJcblx0XHRcdFx0Y29uc3QgY29scyAgICAgICAgICAgPSBpdGVtLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX3JvdyA+IC53cGJjX2JmYl9fY29sdW1uJyApLmxlbmd0aCB8fCAxO1xyXG5cdFx0XHRcdGl0ZW0uZGF0YXNldC5jb2x1bW5zID0gU3RyaW5nKCBjb2xzICk7XHJcblxyXG5cdFx0XHRcdC8vIFNlbGVjdCAmIG5vdGlmeSBzdWJzY3JpYmVycyAobGF5b3V0L21pbiBndWFyZHMsIGV0Yy4pXHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLnNlbGVjdF9maWVsZD8uKCBpdGVtICk7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmJ1cz8uZW1pdD8uKCBDb3JlLldQQkNfQkZCX0V2ZW50cy5TVFJVQ1RVUkVfQ0hBTkdFLCB7IGVsOiBpdGVtLCByZWFzb246ICdzZWN0aW9uLW1vdmUnIH0gKTtcclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXIudXNhZ2U/LnVwZGF0ZV9wYWxldHRlX3VpPy4oKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gaGFuZGxlZC5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gUGFsZXR0ZSAtPiBjYW52YXM6IGJ1aWxkIGEgYnJhbmQtbmV3IHNlY3Rpb24gdXNpbmcgdGhlIHNhbWUgcGF0aCBhcyB0aGUgZHJvcGRvd24vbWVudVxyXG5cdFx0XHRjb25zdCB0byAgID0gZXZ0LnRvPy5jbG9zZXN0Py4oICcud3BiY19iZmJfX2NvbHVtbiwgLndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICkgfHwgZXZ0LnRvO1xyXG5cdFx0XHRjb25zdCBjb2xzID0gcGFyc2VJbnQoIGRhdGE/LmNvbHVtbnMgfHwgaXRlbS5kYXRhc2V0LmNvbHVtbnMgfHwgMSwgMTAgKSB8fCAxO1xyXG5cclxuXHRcdFx0Ly8gUmVtb3ZlIHRoZSBwYWxldHRlIGNsb25lIHBsYWNlaG9sZGVyLlxyXG5cdFx0XHRpdGVtLnBhcmVudE5vZGUgJiYgaXRlbS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBpdGVtICk7XHJcblxyXG5cdFx0XHQvLyBDcmVhdGUgdGhlIHJlYWwgc2VjdGlvbi5cclxuXHRcdFx0dGhpcy5idWlsZGVyLnBhZ2VzX3NlY3Rpb25zLmFkZF9zZWN0aW9uKCB0bywgY29scyApO1xyXG5cclxuXHRcdFx0Ly8gSW5zZXJ0IGF0IHRoZSBwcmVjaXNlIGRyb3AgaW5kZXguXHJcblx0XHRcdGNvbnN0IHNlY3Rpb24gPSB0by5sYXN0RWxlbWVudENoaWxkOyAvLyBhZGRfc2VjdGlvbiBhcHBlbmRzIHRvIGVuZC5cclxuXHRcdFx0aWYgKCBldnQubmV3SW5kZXggIT0gbnVsbCAmJiBldnQubmV3SW5kZXggPCB0by5jaGlsZHJlbi5sZW5ndGggLSAxICkge1xyXG5cdFx0XHRcdGNvbnN0IHJlZiA9IHRvLmNoaWxkcmVuW2V2dC5uZXdJbmRleF0gfHwgbnVsbDtcclxuXHRcdFx0XHR0by5pbnNlcnRCZWZvcmUoIHNlY3Rpb24sIHJlZiApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGaW5hbGl6ZTogb3ZlcmxheSwgc2VsZWN0aW9uLCBldmVudHMsIHVzYWdlIHJlZnJlc2guXHJcblx0XHRcdHRoaXMuYnVpbGRlci5hZGRfb3ZlcmxheV90b29sYmFyPy4oIHNlY3Rpb24gKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLnNlbGVjdF9maWVsZD8uKCBzZWN0aW9uICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5idXM/LmVtaXQ/LiggQ29yZS5XUEJDX0JGQl9FdmVudHMuRklFTERfQURELCB7XHJcblx0XHRcdFx0ZWwgOiBzZWN0aW9uLFxyXG5cdFx0XHRcdGlkIDogc2VjdGlvbi5kYXRhc2V0LmlkLFxyXG5cdFx0XHRcdHVpZDogc2VjdGlvbi5kYXRhc2V0LnVpZFxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci51c2FnZT8udXBkYXRlX3BhbGV0dGVfdWk/LigpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZXN0cm95IGFsbCBTb3J0YWJsZSBpbnN0YW5jZXMgY3JlYXRlZCBieSB0aGlzIG1hbmFnZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGRlc3Ryb3lBbGwoKSB7XHJcblx0XHRcdHRoaXMuX2NvbnRhaW5lcnMuZm9yRWFjaCggKCBlbCApID0+IHtcclxuXHRcdFx0XHRjb25zdCBpbnN0ID0gU29ydGFibGUuZ2V0Py4oIGVsICk7XHJcblx0XHRcdFx0aWYgKCBpbnN0ICkge1xyXG5cdFx0XHRcdFx0aW5zdC5kZXN0cm95KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHRoaXMuX2NvbnRhaW5lcnMuY2xlYXIoKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTbWFsbCBET00gY29udHJhY3QgYW5kIHJlbmRlcmVyIGhlbHBlclxyXG5cdCAqXHJcblx0ICogQHR5cGUge1JlYWRvbmx5PHtcclxuXHQgKiAgICAgICAgICAgICAgICAgIFNFTEVDVE9SUzoge3BhZ2VQYW5lbDogc3RyaW5nLCBmaWVsZDogc3RyaW5nLCB2YWxpZEZpZWxkOiBzdHJpbmcsIHNlY3Rpb246IHN0cmluZywgY29sdW1uOlxyXG5cdCAqICAgICBzdHJpbmcsIHJvdzogc3RyaW5nLCBvdmVybGF5OiBzdHJpbmd9LCBDTEFTU0VTOiB7c2VsZWN0ZWQ6IHN0cmluZ30sIEFUVFI6IHtpZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGh0bWxJZDpcclxuXHQgKiAgICAgc3RyaW5nLCB1c2FnZUtleTogc3RyaW5nLCB1aWQ6IHN0cmluZ319XHJcblx0ICogICAgICAgID59XHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9ET00gPSBPYmplY3QuZnJlZXplKCB7XHJcblx0XHRTRUxFQ1RPUlM6IHtcclxuXHRcdFx0cGFnZVBhbmVsIDogJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnLFxyXG5cdFx0XHRmaWVsZCAgICAgOiAnLndwYmNfYmZiX19maWVsZCcsXHJcblx0XHRcdHZhbGlkRmllbGQ6ICcud3BiY19iZmJfX2ZpZWxkOm5vdCguaXMtaW52YWxpZCknLFxyXG5cdFx0XHRzZWN0aW9uICAgOiAnLndwYmNfYmZiX19zZWN0aW9uJyxcclxuXHRcdFx0Y29sdW1uICAgIDogJy53cGJjX2JmYl9fY29sdW1uJyxcclxuXHRcdFx0cm93ICAgICAgIDogJy53cGJjX2JmYl9fcm93JyxcclxuXHRcdFx0b3ZlcmxheSAgIDogJy53cGJjX2JmYl9fb3ZlcmxheS1jb250cm9scydcclxuXHRcdH0sXHJcblx0XHRDTEFTU0VTICA6IHtcclxuXHRcdFx0c2VsZWN0ZWQ6ICdpcy1zZWxlY3RlZCdcclxuXHRcdH0sXHJcblx0XHRBVFRSICAgICA6IHtcclxuXHRcdFx0aWQgICAgICA6ICdkYXRhLWlkJyxcclxuXHRcdFx0bmFtZSAgICA6ICdkYXRhLW5hbWUnLFxyXG5cdFx0XHRodG1sSWQgIDogJ2RhdGEtaHRtbF9pZCcsXHJcblx0XHRcdHVzYWdlS2V5OiAnZGF0YS11c2FnZV9rZXknLFxyXG5cdFx0XHR1aWQgICAgIDogJ2RhdGEtdWlkJ1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0Q29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIgPSBjbGFzcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYW4gSFRNTCBlbGVtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0YWcgLSBIVE1MIHRhZyBuYW1lLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtjbGFzc19uYW1lPScnXSAtIE9wdGlvbmFsIENTUyBjbGFzcyBuYW1lLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtpbm5lcl9odG1sPScnXSAtIE9wdGlvbmFsIGlubmVySFRNTC5cclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gQ3JlYXRlZCBlbGVtZW50LlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgY3JlYXRlX2VsZW1lbnQoIHRhZywgY2xhc3NfbmFtZSA9ICcnLCBpbm5lcl9odG1sID0gJycgKSB7XHJcblx0XHRcdGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggdGFnICk7XHJcblx0XHRcdGlmICggY2xhc3NfbmFtZSApIHtcclxuXHRcdFx0XHRlbC5jbGFzc05hbWUgPSBjbGFzc19uYW1lO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaW5uZXJfaHRtbCApIHtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSBpbm5lcl9odG1sO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBlbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNldCBtdWx0aXBsZSBgZGF0YS0qYCBhdHRyaWJ1dGVzIG9uIGEgZ2l2ZW4gZWxlbWVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCAtIFRhcmdldCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGFfb2JqIC0gS2V5LXZhbHVlIHBhaXJzIGZvciBkYXRhIGF0dHJpYnV0ZXMuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNldF9kYXRhX2F0dHJpYnV0ZXMoIGVsLCBkYXRhX29iaiApIHtcclxuXHRcdFx0T2JqZWN0LmVudHJpZXMoIGRhdGFfb2JqICkuZm9yRWFjaCggKCBbIGtleSwgdmFsIF0gKSA9PiB7XHJcblx0XHRcdFx0Ly8gUHJldmlvdXNseTogMjAyNS0wOS0wMSAxNzowOTpcclxuXHRcdFx0XHQvLyBjb25zdCB2YWx1ZSA9ICh0eXBlb2YgdmFsID09PSAnb2JqZWN0JykgPyBKU09OLnN0cmluZ2lmeSggdmFsICkgOiB2YWw7XHJcblx0XHRcdFx0Ly9OZXc6XHJcblx0XHRcdFx0bGV0IHZhbHVlO1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcgJiYgdmFsICE9PSBudWxsICkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0dmFsdWUgPSBKU09OLnN0cmluZ2lmeSggdmFsICk7XHJcblx0XHRcdFx0XHR9IGNhdGNoIHtcclxuXHRcdFx0XHRcdFx0dmFsdWUgPSAnJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dmFsdWUgPSB2YWw7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLScgKyBrZXksIHZhbHVlICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBhbGwgYGRhdGEtKmAgYXR0cmlidXRlcyBmcm9tIGFuIGVsZW1lbnQgYW5kIHBhcnNlIEpTT04gd2hlcmUgcG9zc2libGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgLSBFbGVtZW50IHRvIGV4dHJhY3QgZGF0YSBmcm9tLlxyXG5cdFx0ICogQHJldHVybnMge09iamVjdH0gUGFyc2VkIGtleS12YWx1ZSBtYXAgb2YgZGF0YSBhdHRyaWJ1dGVzLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGVsICkge1xyXG5cdFx0XHRjb25zdCBkYXRhID0ge307XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgfHwgISBlbC5hdHRyaWJ1dGVzICkge1xyXG5cdFx0XHRcdHJldHVybiBkYXRhO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRBcnJheS5mcm9tKCBlbC5hdHRyaWJ1dGVzICkuZm9yRWFjaChcclxuXHRcdFx0XHQoIGF0dHIgKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGF0dHIubmFtZS5zdGFydHNXaXRoKCAnZGF0YS0nICkgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGtleSA9IGF0dHIubmFtZS5yZXBsYWNlKCAvXmRhdGEtLywgJycgKTtcclxuXHRcdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0XHRkYXRhW2tleV0gPSBKU09OLnBhcnNlKCBhdHRyLnZhbHVlICk7XHJcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdFx0XHRcdGRhdGFba2V5XSA9IGF0dHIudmFsdWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHQvLyBPbmx5IGRlZmF1bHQgdGhlIGxhYmVsIGlmIGl0J3MgdHJ1bHkgYWJzZW50ICh1bmRlZmluZWQvbnVsbCksIG5vdCB3aGVuIGl0J3MgYW4gZW1wdHkgc3RyaW5nLlxyXG5cdFx0XHRjb25zdCBoYXNFeHBsaWNpdExhYmVsID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkYXRhLCAnbGFiZWwnICk7XHJcblx0XHRcdGlmICggISBoYXNFeHBsaWNpdExhYmVsICYmIGRhdGEuaWQgKSB7XHJcblx0XHRcdFx0ZGF0YS5sYWJlbCA9IGRhdGEuaWQuY2hhckF0KCAwICkudG9VcHBlckNhc2UoKSArIGRhdGEuaWQuc2xpY2UoIDEgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGRhdGE7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgYSBzaW1wbGUgbGFiZWwgKyB0eXBlIHByZXZpZXcgKHVzZWQgZm9yIHVua25vd24gb3IgZmFsbGJhY2sgZmllbGRzKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmllbGRfZGF0YSAtIEZpZWxkIGRhdGEgb2JqZWN0LlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gSFRNTCBjb250ZW50LlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVuZGVyX2ZpZWxkX2lubmVyX2h0bWwoIGZpZWxkX2RhdGEgKSB7XHJcblx0XHRcdC8vIE1ha2UgdGhlIGZhbGxiYWNrIHByZXZpZXcgcmVzcGVjdCBhbiBlbXB0eSBsYWJlbC5cclxuXHRcdFx0Y29uc3QgaGFzTGFiZWwgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGZpZWxkX2RhdGEsICdsYWJlbCcgKTtcclxuXHRcdFx0Y29uc3QgbGFiZWwgICAgPSBoYXNMYWJlbCA/IFN0cmluZyggZmllbGRfZGF0YS5sYWJlbCApIDogU3RyaW5nKCBmaWVsZF9kYXRhLmlkIHx8ICcobm8gbGFiZWwpJyApO1xyXG5cclxuXHRcdFx0Y29uc3QgdHlwZSAgICAgICAgPSBTdHJpbmcoIGZpZWxkX2RhdGEudHlwZSB8fCAndW5rbm93bicgKTtcclxuXHRcdFx0Y29uc3QgaXNfcmVxdWlyZWQgPSBmaWVsZF9kYXRhLnJlcXVpcmVkID09PSB0cnVlIHx8IGZpZWxkX2RhdGEucmVxdWlyZWQgPT09ICd0cnVlJyB8fCBmaWVsZF9kYXRhLnJlcXVpcmVkID09PSAxIHx8IGZpZWxkX2RhdGEucmVxdWlyZWQgPT09ICcxJztcclxuXHJcblx0XHRcdGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cclxuXHRcdFx0Y29uc3Qgc3BhbkxhYmVsICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XHJcblx0XHRcdHNwYW5MYWJlbC5jbGFzc05hbWUgICA9ICd3cGJjX2JmYl9fZmllbGQtbGFiZWwnO1xyXG5cdFx0XHRzcGFuTGFiZWwudGV4dENvbnRlbnQgPSBsYWJlbCArIChpc19yZXF1aXJlZCA/ICcgKicgOiAnJyk7XHJcblx0XHRcdHdyYXBwZXIuYXBwZW5kQ2hpbGQoIHNwYW5MYWJlbCApO1xyXG5cclxuXHRcdFx0Y29uc3Qgc3BhblR5cGUgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcclxuXHRcdFx0c3BhblR5cGUuY2xhc3NOYW1lICAgPSAnd3BiY19iZmJfX2ZpZWxkLXR5cGUnO1xyXG5cdFx0XHRzcGFuVHlwZS50ZXh0Q29udGVudCA9IHR5cGU7XHJcblx0XHRcdHdyYXBwZXIuYXBwZW5kQ2hpbGQoIHNwYW5UeXBlICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gd3JhcHBlci5pbm5lckhUTUw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWJvdW5jZSBhIGZ1bmN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIC0gRnVuY3Rpb24gdG8gZGVib3VuY2UuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gd2FpdCAtIERlbGF5IGluIG1zLlxyXG5cdFx0ICogQHJldHVybnMge0Z1bmN0aW9ufSBEZWJvdW5jZWQgZnVuY3Rpb24uXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBkZWJvdW5jZSggZm4sIHdhaXQgPSAxMjAgKSB7XHJcblx0XHRcdGxldCB0ID0gbnVsbDtcclxuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uIGRlYm91bmNlZCggLi4uYXJncyApIHtcclxuXHRcdFx0XHRpZiAoIHQgKSB7XHJcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQoIHQgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dCA9IHNldFRpbWVvdXQoICgpID0+IGZuLmFwcGx5KCB0aGlzLCBhcmdzICksIHdhaXQgKTtcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0Ly8gUmVuZGVyZXIgcmVnaXN0cnkuIEFsbG93cyBsYXRlIHJlZ2lzdHJhdGlvbiBhbmQgYXZvaWRzIHRpZ2h0IGNvdXBsaW5nIHRvIGEgZ2xvYmFsIG1hcC5cclxuXHRDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5ID0gKGZ1bmN0aW9uICgpIHtcclxuXHRcdGNvbnN0IG1hcCA9IG5ldyBNYXAoKTtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHJlZ2lzdGVyKCB0eXBlLCBDbGFzc1JlZiApIHtcclxuXHRcdFx0XHRtYXAuc2V0KCBTdHJpbmcoIHR5cGUgKSwgQ2xhc3NSZWYgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0Z2V0KCB0eXBlICkge1xyXG5cdFx0XHRcdHJldHVybiBtYXAuZ2V0KCBTdHJpbmcoIHR5cGUgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG59KCB3aW5kb3cgKSk7XHJcbiIsIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9jb3JlL2JmYi1maWVsZHMuanMgPT0gfCAyMDI1LTA5LTEwIDE1OjQ3XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4oZnVuY3Rpb24gKCB3ICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Ly8gU2luZ2xlIGdsb2JhbCBuYW1lc3BhY2UgKGlkZW1wb3RlbnQgJiBsb2FkLW9yZGVyIHNhZmUpLlxyXG5cdGNvbnN0IENvcmUgPSAoIHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSApO1xyXG5cdGNvbnN0IFVJICAgPSAoIENvcmUuVUkgPSBDb3JlLlVJIHx8IHt9ICk7XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJhc2UgY2xhc3MgZm9yIGZpZWxkIHJlbmRlcmVycyAoc3RhdGljLW9ubHkgY29udHJhY3QpLlxyXG5cdCAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQgKiBDb250cmFjdCBleHBvc2VkIHRvIHRoZSBidWlsZGVyIChzdGF0aWMgbWV0aG9kcyBvbiB0aGUgQ0xBU1MgaXRzZWxmKTpcclxuXHQgKiAgIC0gcmVuZGVyKGVsLCBkYXRhLCBjdHgpICAgICAgICAgICAgICAvLyBSRVFVSVJFRFxyXG5cdCAqICAgLSBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBtZXRhKSAgICAgIC8vIE9QVElPTkFMIChkZWZhdWx0IHByb3ZpZGVkKVxyXG5cdCAqXHJcblx0ICogSGVscGVycyBmb3Igc3ViY2xhc3NlczpcclxuXHQgKiAgIC0gZ2V0X2RlZmF1bHRzKCkgICAgIC0+IHBlci1maWVsZCBkZWZhdWx0cyAoTVVTVCBvdmVycmlkZSBpbiBzdWJjbGFzcyB0byBzZXQgdHlwZS9sYWJlbClcclxuXHQgKiAgIC0gbm9ybWFsaXplX2RhdGEoZCkgIC0+IHNoYWxsb3cgbWVyZ2Ugd2l0aCBkZWZhdWx0c1xyXG5cdCAqICAgLSBnZXRfdGVtcGxhdGUoaWQpICAgLT4gcGVyLWlkIGNhY2hlZCB3cC50ZW1wbGF0ZSBjb21waWxlclxyXG5cdCAqXHJcblx0ICogU3ViY2xhc3MgdXNhZ2U6XHJcblx0ICogICBjbGFzcyBXUEJDX0JGQl9GaWVsZF9UZXh0IGV4dGVuZHMgQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlIHsgc3RhdGljIGdldF9kZWZhdWx0cygpeyAuLi4gfSB9XHJcblx0ICogICBXUEJDX0JGQl9GaWVsZF9UZXh0LnRlbXBsYXRlX2lkID0gJ3dwYmMtYmZiLWZpZWxkLXRleHQnO1xyXG5cdCAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQgKi9cclxuXHRDb3JlLldQQkNfQkZCX0ZpZWxkX0Jhc2UgPSBjbGFzcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWZhdWx0IGZpZWxkIGRhdGEgKGdlbmVyaWMgYmFzZWxpbmUpLlxyXG5cdFx0ICogU3ViY2xhc3NlcyBNVVNUIG92ZXJyaWRlIHRvIHByb3ZpZGUgeyB0eXBlLCBsYWJlbCB9IGFwcHJvcHJpYXRlIGZvciB0aGUgZmllbGQuXHJcblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgIDogJ2ZpZWxkJyxcclxuXHRcdFx0XHRsYWJlbCAgICAgICA6ICdGaWVsZCcsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgOiAnZmllbGQnLFxyXG5cdFx0XHRcdGh0bWxfaWQgICAgIDogJycsXHJcblx0XHRcdFx0cGxhY2Vob2xkZXIgOiAnJyxcclxuXHRcdFx0XHRyZXF1aXJlZCAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdG1pbmxlbmd0aCAgIDogJycsXHJcblx0XHRcdFx0bWF4bGVuZ3RoICAgOiAnJyxcclxuXHRcdFx0XHRwYXR0ZXJuICAgICA6ICcnLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgIDogJycsXHJcblx0XHRcdFx0aGVscCAgICAgICAgOiAnJ1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2hhbGxvdy1tZXJnZSBpbmNvbWluZyBkYXRhIHdpdGggZGVmYXVsdHMuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxyXG5cdFx0ICogQHJldHVybnMge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG5vcm1hbGl6ZV9kYXRhKCBkYXRhICkge1xyXG5cdFx0XHR2YXIgZCAgICAgICAgPSBkYXRhIHx8IHt9O1xyXG5cdFx0XHR2YXIgZGVmYXVsdHMgPSB0aGlzLmdldF9kZWZhdWx0cygpO1xyXG5cdFx0XHR2YXIgb3V0ICAgICAgPSB7fTtcclxuXHRcdFx0dmFyIGs7XHJcblxyXG5cdFx0XHRmb3IgKCBrIGluIGRlZmF1bHRzICkge1xyXG5cdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkZWZhdWx0cywgayApICkge1xyXG5cdFx0XHRcdFx0b3V0W2tdID0gZGVmYXVsdHNba107XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdGZvciAoIGsgaW4gZCApIHtcclxuXHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZCwgayApICkge1xyXG5cdFx0XHRcdFx0b3V0W2tdID0gZFtrXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIG91dDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbXBpbGUgYW5kIGNhY2hlIGEgd3AudGVtcGxhdGUgYnkgaWQgKHBlci1pZCBjYWNoZSkuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfaWRcclxuXHRcdCAqIEByZXR1cm5zIHtGdW5jdGlvbnxudWxsfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X3RlbXBsYXRlKHRlbXBsYXRlX2lkKSB7XHJcblxyXG5cdFx0XHQvLyBBY2NlcHQgZWl0aGVyIFwid3BiYy1iZmItZmllbGQtdGV4dFwiIG9yIFwidG1wbC13cGJjLWJmYi1maWVsZC10ZXh0XCIuXHJcblx0XHRcdGlmICggISB0ZW1wbGF0ZV9pZCB8fCAhIHdpbmRvdy53cCB8fCAhIHdwLnRlbXBsYXRlICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGRvbUlkID0gdGVtcGxhdGVfaWQuc3RhcnRzV2l0aCggJ3RtcGwtJyApID8gdGVtcGxhdGVfaWQgOiAoJ3RtcGwtJyArIHRlbXBsYXRlX2lkKTtcclxuXHRcdFx0aWYgKCAhIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBkb21JZCApICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICEgQ29yZS5fX2JmYl90cGxfY2FjaGVfbWFwICkge1xyXG5cdFx0XHRcdENvcmUuX19iZmJfdHBsX2NhY2hlX21hcCA9IHt9O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBOb3JtYWxpemUgaWQgZm9yIHRoZSBjb21waWxlciAmIGNhY2hlLiAvLyB3cC50ZW1wbGF0ZSBleHBlY3RzIGlkIFdJVEhPVVQgdGhlIFwidG1wbC1cIiBwcmVmaXggIVxyXG5cdFx0XHRjb25zdCBrZXkgPSB0ZW1wbGF0ZV9pZC5yZXBsYWNlKCAvXnRtcGwtLywgJycgKTtcclxuXHRcdFx0aWYgKCBDb3JlLl9fYmZiX3RwbF9jYWNoZV9tYXBba2V5XSApIHtcclxuXHRcdFx0XHRyZXR1cm4gQ29yZS5fX2JmYl90cGxfY2FjaGVfbWFwW2tleV07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGNvbXBpbGVyID0gd3AudGVtcGxhdGUoIGtleSApOyAgICAgLy8gPC0tIG5vcm1hbGl6ZWQgaWQgaGVyZVxyXG5cdFx0XHRpZiAoIGNvbXBpbGVyICkge1xyXG5cdFx0XHRcdENvcmUuX19iZmJfdHBsX2NhY2hlX21hcFtrZXldID0gY29tcGlsZXI7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBjb21waWxlcjtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJFUVVJUkVEOiByZW5kZXIgcHJldmlldyBpbnRvIGhvc3QgZWxlbWVudCAoZnVsbCByZWRyYXc7IGlkZW1wb3RlbnQpLlxyXG5cdFx0ICogU3ViY2xhc3NlcyBzaG91bGQgc2V0IHN0YXRpYyBgdGVtcGxhdGVfaWRgIHRvIGEgdmFsaWQgd3AudGVtcGxhdGUgaWQuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbFxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgZGF0YVxyXG5cdFx0ICogQHBhcmFtIHt7bW9kZT86c3RyaW5nLGJ1aWxkZXI/OmFueSx0cGw/OkZ1bmN0aW9uLHNhbml0Pzphbnl9fSBjdHhcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVuZGVyKCBlbCwgZGF0YSwgY3R4ICkge1xyXG5cdFx0XHRpZiAoICEgZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgY29tcGlsZSA9IHRoaXMuZ2V0X3RlbXBsYXRlKCB0aGlzLnRlbXBsYXRlX2lkICk7XHJcblx0XHRcdHZhciBkICAgICAgID0gdGhpcy5ub3JtYWxpemVfZGF0YSggZGF0YSApO1xyXG5cclxuXHRcdFx0dmFyIHMgPSAoY3R4ICYmIGN0eC5zYW5pdCkgPyBjdHguc2FuaXQgOiBDb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cclxuXHRcdFx0Ly8gU2FuaXRpemUgY3JpdGljYWwgYXR0cmlidXRlcyBiZWZvcmUgdGVtcGxhdGluZy5cclxuXHRcdFx0aWYgKCBzICkge1xyXG5cdFx0XHRcdGQuaHRtbF9pZCA9IGQuaHRtbF9pZCA/IHMuc2FuaXRpemVfaHRtbF9pZCggU3RyaW5nKCBkLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdFx0ZC5uYW1lICAgID0gcy5zYW5pdGl6ZV9odG1sX25hbWUoIFN0cmluZyggZC5uYW1lIHx8IGQuaWQgfHwgJ2ZpZWxkJyApICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZC5odG1sX2lkID0gZC5odG1sX2lkID8gU3RyaW5nKCBkLmh0bWxfaWQgKSA6ICcnO1xyXG5cdFx0XHRcdGQubmFtZSAgICA9IFN0cmluZyggZC5uYW1lIHx8IGQuaWQgfHwgJ2ZpZWxkJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGYWxsIGJhY2sgdG8gZ2VuZXJpYyBwcmV2aWV3IGlmIHRlbXBsYXRlIG5vdCBhdmFpbGFibGUuXHJcblx0XHRcdGlmICggY29tcGlsZSApIHtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSBjb21waWxlKCBkICk7XHJcblxyXG5cdFx0XHRcdC8vIEFmdGVyIHJlbmRlciwgc2V0IGF0dHJpYnV0ZSB2YWx1ZXMgdmlhIERPTSBzbyBxdW90ZXMvbmV3bGluZXMgYXJlIGhhbmRsZWQgY29ycmVjdGx5LlxyXG5cdFx0XHRcdGNvbnN0IGlucHV0ID0gZWwucXVlcnlTZWxlY3RvciggJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0JyApO1xyXG5cdFx0XHRcdGlmICggaW5wdXQgKSB7XHJcblx0XHRcdFx0XHRpZiAoIGQucGxhY2Vob2xkZXIgIT0gbnVsbCApIGlucHV0LnNldEF0dHJpYnV0ZSggJ3BsYWNlaG9sZGVyJywgU3RyaW5nKCBkLnBsYWNlaG9sZGVyICkgKTtcclxuXHRcdFx0XHRcdGlmICggZC50aXRsZSAhPSBudWxsICkgaW5wdXQuc2V0QXR0cmlidXRlKCAndGl0bGUnLCBTdHJpbmcoIGQudGl0bGUgKSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZWwuaW5uZXJIVE1MID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIucmVuZGVyX2ZpZWxkX2lubmVyX2h0bWwoIGQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZWwuZGF0YXNldC50eXBlID0gZC50eXBlIHx8ICdmaWVsZCc7XHJcblx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbGFiZWwnLCAoZC5sYWJlbCAhPSBudWxsID8gU3RyaW5nKCBkLmxhYmVsICkgOiAnJykgKTsgLy8gYWxsb3cgXCJcIi5cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPUFRJT05BTCBob29rIGV4ZWN1dGVkIGFmdGVyIGZpZWxkIGlzIGRyb3BwZWQvbG9hZGVkL3ByZXZpZXcuXHJcblx0XHQgKiBEZWZhdWx0IGV4dGVuZGVkOlxyXG5cdFx0ICogLSBPbiBmaXJzdCBkcm9wOiBzdGFtcCBkZWZhdWx0IGxhYmVsIChleGlzdGluZyBiZWhhdmlvcikgYW5kIG1hcmsgZmllbGQgYXMgXCJmcmVzaFwiIGZvciBhdXRvLW5hbWUuXHJcblx0XHQgKiAtIE9uIGxvYWQ6IG1hcmsgYXMgbG9hZGVkIHNvIGxhdGVyIGxhYmVsIGVkaXRzIGRvIG5vdCByZW5hbWUgdGhlIHNhdmVkIG5hbWUuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBtZXRhKSB7XHJcblxyXG5cdFx0XHRjb25zdCBjb250ZXh0ID0gKG1ldGEgJiYgbWV0YS5jb250ZXh0KSA/IFN0cmluZyggbWV0YS5jb250ZXh0ICkgOiAnJztcclxuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdC8vIE5FVzogU2VlZCBkZWZhdWx0IFwiaGVscFwiIChhbmQga2VlcCBpdCBpbiBTdHJ1Y3R1cmUpIGZvciBhbGwgZmllbGQgcGFja3MgdGhhdCBkZWZpbmUgaXQuXHJcblx0XHRcdC8vIFRoaXMgZml4ZXMgdGhlIG1pc21hdGNoIHdoZXJlOlxyXG5cdFx0XHQvLyAgIC0gVUkgc2hvd3MgZGVmYXVsdCBoZWxwIHZpYSBub3JtYWxpemVfZGF0YSgpIC8gdGVtcGxhdGVzXHJcblx0XHRcdC8vICAgLSBidXQgZ2V0X3N0cnVjdHVyZSgpIC8gZXhwb3J0ZXJzIHNlZSBgaGVscGAgYXMgdW5kZWZpbmVkL2VtcHR5LlxyXG5cdFx0XHQvL1xyXG5cdFx0XHQvLyBCZWhhdmlvcjpcclxuXHRcdFx0Ly8gICAtIFJ1bnMgT05MWSBvbiBpbml0aWFsIGRyb3AgKGNvbnRleHQgPT09ICdkcm9wJykuXHJcblx0XHRcdC8vICAgLSBJZiBnZXRfZGVmYXVsdHMoKSBleHBvc2VzIGEgbm9uLWVtcHR5IFwiaGVscFwiLCBhbmQgZGF0YS5oZWxwIGlzXHJcblx0XHRcdC8vICAgICBtaXNzaW5nIC8gbnVsbCAvIGVtcHR5IHN0cmluZyAtPiB3ZSBwZXJzaXN0IHRoZSBkZWZhdWx0IGludG8gYGRhdGFgXHJcblx0XHRcdC8vICAgICBhbmQgbm90aWZ5IFN0cnVjdHVyZSBzbyBleHBvcnRzIHNlZSBpdC5cclxuXHRcdFx0Ly8gICAtIE9uIFwibG9hZFwiIHdlIGRvIG5vdGhpbmcsIHNvIGV4aXN0aW5nIGZvcm1zIHdoZXJlIHVzZXIgKmNsZWFyZWQqXHJcblx0XHRcdC8vICAgICBoZWxwIHdpbGwgbm90IGJlIG92ZXJyaWRkZW4uXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGlmICggY29udGV4dCA9PT0gJ2Ryb3AnICYmIGRhdGEgKSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGNvbnN0IGRlZnMgPSAodHlwZW9mIHRoaXMuZ2V0X2RlZmF1bHRzID09PSAnZnVuY3Rpb24nKSA/IHRoaXMuZ2V0X2RlZmF1bHRzKCkgOiBudWxsO1xyXG5cdFx0XHRcdFx0aWYgKCBkZWZzICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZGVmcywgJ2hlbHAnICkgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGN1cnJlbnQgICAgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGRhdGEsICdoZWxwJyApID8gZGF0YS5oZWxwIDogdW5kZWZpbmVkO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBoYXNWYWx1ZSAgID0gKGN1cnJlbnQgIT09IHVuZGVmaW5lZCAmJiBjdXJyZW50ICE9PSBudWxsICYmIFN0cmluZyggY3VycmVudCApICE9PSAnJyk7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGRlZmF1bHRWYWwgPSBkZWZzLmhlbHA7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICEgaGFzVmFsdWUgJiYgZGVmYXVsdFZhbCAhPSBudWxsICYmIFN0cmluZyggZGVmYXVsdFZhbCApICE9PSAnJyApIHtcclxuXHRcdFx0XHRcdFx0XHQvLyAxKSBwZXJzaXN0IGludG8gZGF0YSBvYmplY3QgKHVzZWQgYnkgU3RydWN0dXJlKS5cclxuXHRcdFx0XHRcdFx0XHRkYXRhLmhlbHAgPSBkZWZhdWx0VmFsO1xyXG5cclxuXHRcdFx0XHRcdFx0XHQvLyAyKSBtaXJyb3IgaW50byBkYXRhc2V0IChmb3IgYW55IERPTS1iYXNlZCBjb25zdW1lcnMpLlxyXG5cdFx0XHRcdFx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRlbC5kYXRhc2V0LmhlbHAgPSBTdHJpbmcoIGRlZmF1bHRWYWwgKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHQvLyAzKSBub3RpZnkgU3RydWN0dXJlIC8gbGlzdGVuZXJzIChpZiBhdmFpbGFibGUpLlxyXG5cdFx0XHRcdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0Q29yZS5TdHJ1Y3R1cmU/LnVwZGF0ZV9maWVsZF9wcm9wPy4oIGVsLCAnaGVscCcsIGRlZmF1bHRWYWwgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0ZWwuZGlzcGF0Y2hFdmVudChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7IGJ1YmJsZXM6IHRydWUsIGRldGFpbCA6IHsga2V5OiAnaGVscCcsIHZhbHVlOiBkZWZhdWx0VmFsIH0gfSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdFx0XHR9IGNhdGNoICggX2lubmVyICkge31cclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0XHRpZiAoIGNvbnRleHQgPT09ICdkcm9wJyAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkYXRhLCAnbGFiZWwnICkgKSB7XHJcblx0XHRcdFx0Y29uc3QgZGVmcyA9IHRoaXMuZ2V0X2RlZmF1bHRzKCk7XHJcblx0XHRcdFx0ZGF0YS5sYWJlbCA9IGRlZnMubGFiZWwgfHwgJ0ZpZWxkJztcclxuXHRcdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWxhYmVsJywgZGF0YS5sYWJlbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIE1hcmsgcHJvdmVuYW5jZSBmbGFncy5cclxuXHRcdFx0aWYgKCBjb250ZXh0ID09PSAnZHJvcCcgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5mcmVzaCAgICAgID0gJzEnOyAgIC8vIGNhbiBhdXRvLW5hbWUgb24gZmlyc3QgbGFiZWwgZWRpdC5cclxuXHRcdFx0XHRlbC5kYXRhc2V0LmF1dG9uYW1lICAgPSAnMSc7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC53YXNfbG9hZGVkID0gJzAnO1xyXG5cdFx0XHRcdC8vIFNlZWQgYSBwcm92aXNpb25hbCB1bmlxdWUgbmFtZSBpbW1lZGlhdGVseS5cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0Y29uc3QgYiA9IG1ldGE/LmJ1aWxkZXI7XHJcblx0XHRcdFx0XHRpZiAoIGI/LmlkICYmICghZWwuaGFzQXR0cmlidXRlKCAnZGF0YS1uYW1lJyApIHx8ICFlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLW5hbWUnICkpICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBTICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgYmFzZSA9IFMuc2FuaXRpemVfaHRtbF9uYW1lKCBlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWlkJyApIHx8IGRhdGE/LmlkIHx8IGRhdGE/LnR5cGUgfHwgJ2ZpZWxkJyApO1xyXG5cdFx0XHRcdFx0XHRjb25zdCB1bmlxID0gYi5pZC5lbnN1cmVfdW5pcXVlX2ZpZWxkX25hbWUoIGJhc2UsIGVsICk7XHJcblx0XHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbmFtZScsIHVuaXEgKTtcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lX3VzZXJfdG91Y2hlZCA9ICcwJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBjb250ZXh0ID09PSAnbG9hZCcgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5mcmVzaCAgICAgID0gJzAnO1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQuYXV0b25hbWUgICA9ICcwJztcclxuXHRcdFx0XHRlbC5kYXRhc2V0Lndhc19sb2FkZWQgPSAnMSc7ICAgLy8gbmV2ZXIgcmVuYW1lIG5hbWVzIGZvciBsb2FkZWQgZmllbGRzLlxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tIEF1dG8gUmVuYW1lIFwiRnJlc2hcIiBmaWVsZCwgIG9uIGVudGVyaW5nIHRoZSBuZXcgTGFiZWwgLS0tXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYSBjb25zZXJ2YXRpdmUgZmllbGQgXCJuYW1lXCIgZnJvbSBhIGh1bWFuIGxhYmVsLlxyXG5cdFx0ICogVXNlcyB0aGUgc2FtZSBjb25zdHJhaW50cyBhcyBzYW5pdGl6ZV9odG1sX25hbWUgKGxldHRlcnMvZGlnaXRzL18tIGFuZCBsZWFkaW5nIGxldHRlcikuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBuYW1lX2Zyb21fbGFiZWwobGFiZWwpIHtcclxuXHRcdFx0Y29uc3QgcyA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCBTdHJpbmcoIGxhYmVsID8/ICcnICkgKTtcclxuXHRcdFx0cmV0dXJuIHMudG9Mb3dlckNhc2UoKSB8fCAnZmllbGQnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXV0by1maWxsIGRhdGEtbmFtZSBmcm9tIGxhYmVsIE9OTFkgZm9yIGZyZXNobHkgZHJvcHBlZCBmaWVsZHMgdGhhdCB3ZXJlIG5vdCBlZGl0ZWQgeWV0LlxyXG5cdFx0ICogLSBOZXZlciBydW5zIGZvciBzZWN0aW9ucy5cclxuXHRcdCAqIC0gTmV2ZXIgcnVucyBmb3IgbG9hZGVkL2V4aXN0aW5nIGZpZWxkcy5cclxuXHRcdCAqIC0gU3RvcHMgYXMgc29vbiBhcyB1c2VyIGVkaXRzIHRoZSBOYW1lIG1hbnVhbGx5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXJcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsICAtIC53cGJjX2JmYl9fZmllbGQgZWxlbWVudFxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGxhYmVsVmFsXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBtYXliZV9hdXRvbmFtZV9mcm9tX2xhYmVsKGJ1aWxkZXIsIGVsLCBsYWJlbFZhbCkge1xyXG5cdFx0XHRpZiAoICFidWlsZGVyIHx8ICFlbCApIHJldHVybjtcclxuXHRcdFx0aWYgKCBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGFsbG93QXV0byA9IGVsLmRhdGFzZXQuYXV0b25hbWUgPT09ICcxJztcclxuXHJcblx0XHRcdGNvbnN0IHVzZXJUb3VjaGVkID0gZWwuZGF0YXNldC5uYW1lX3VzZXJfdG91Y2hlZCA9PT0gJzEnO1xyXG5cdFx0XHRjb25zdCBpc0xvYWRlZCAgICA9IGVsLmRhdGFzZXQud2FzX2xvYWRlZCA9PT0gJzEnO1xyXG5cclxuXHRcdFx0aWYgKCAhYWxsb3dBdXRvIHx8IHVzZXJUb3VjaGVkIHx8IGlzTG9hZGVkICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gT25seSBvdmVycmlkZSBwbGFjZWhvbGRlci15IG5hbWVzXHJcblx0XHRcdGNvbnN0IFMgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cclxuXHRcdFx0Y29uc3QgYmFzZSAgID0gdGhpcy5uYW1lX2Zyb21fbGFiZWwoIGxhYmVsVmFsICk7XHJcblx0XHRcdGNvbnN0IHVuaXF1ZSA9IGJ1aWxkZXIuaWQuZW5zdXJlX3VuaXF1ZV9maWVsZF9uYW1lKCBiYXNlLCBlbCApO1xyXG5cdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLW5hbWUnLCB1bmlxdWUgKTtcclxuXHJcblx0XHRcdGNvbnN0IGlucyAgICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRjb25zdCBuYW1lQ3RybCA9IGlucz8ucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJuYW1lXCJdJyApO1xyXG5cdFx0XHRpZiAoIG5hbWVDdHJsICYmICd2YWx1ZScgaW4gbmFtZUN0cmwgJiYgbmFtZUN0cmwudmFsdWUgIT09IHVuaXF1ZSApIG5hbWVDdHJsLnZhbHVlID0gdW5pcXVlO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2VsZWN0X0Jhc2UgKHNoYXJlZCBiYXNlIGZvciBzZWxlY3QtbGlrZSBwYWNrcylcclxuXHQgKlxyXG5cdCAqIEB0eXBlIHtDb3JlLldQQkNfQkZCX1NlbGVjdF9CYXNlfVxyXG5cdCAqL1xyXG5cdENvcmUuV1BCQ19CRkJfU2VsZWN0X0Jhc2UgPSBjbGFzcyBleHRlbmRzIENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZSB7XHJcblxyXG5cdFx0c3RhdGljIHRlbXBsYXRlX2lkICAgICAgICAgICAgPSBudWxsOyAgICAgICAgICAgICAgICAgLy8gbWFpbiBwcmV2aWV3IHRlbXBsYXRlIGlkXHJcblx0XHRzdGF0aWMgb3B0aW9uX3Jvd190ZW1wbGF0ZV9pZCA9ICd3cGJjLWJmYi1pbnNwZWN0b3Itc2VsZWN0LW9wdGlvbi1yb3cnOyAvLyByb3cgdHBsIGlkXHJcblx0XHRzdGF0aWMga2luZCAgICAgICAgICAgICAgICAgICA9ICdzZWxlY3QnO1xyXG5cdFx0c3RhdGljIF9fcm9vdF93aXJlZCAgICAgICAgICAgPSBmYWxzZTtcclxuXHRcdHN0YXRpYyBfX3Jvb3Rfbm9kZSAgICAgICAgICAgID0gbnVsbDtcclxuXHJcblx0XHQvLyBTaW5nbGUgc291cmNlIG9mIHNlbGVjdG9ycyB1c2VkIGJ5IHRoZSBpbnNwZWN0b3IgVUkuXHJcblx0XHRzdGF0aWMgdWkgPSB7XHJcblx0XHRcdGxpc3QgICA6ICcud3BiY19iZmJfX29wdGlvbnNfbGlzdCcsXHJcblx0XHRcdGhvbGRlciA6ICcud3BiY19iZmJfX29wdGlvbnNfc3RhdGVbZGF0YS1pbnNwZWN0b3Ita2V5PVwib3B0aW9uc1wiXScsXHJcblx0XHRcdHJvdyAgICA6ICcud3BiY19iZmJfX29wdGlvbnNfcm93JyxcclxuXHRcdFx0bGFiZWwgIDogJy53cGJjX2JmYl9fb3B0LWxhYmVsJyxcclxuXHRcdFx0dmFsdWUgIDogJy53cGJjX2JmYl9fb3B0LXZhbHVlJyxcclxuXHRcdFx0dG9nZ2xlIDogJy53cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoaycsXHJcblx0XHRcdGFkZF9idG46ICcuanMtYWRkLW9wdGlvbicsXHJcblxyXG5cdFx0XHRkcmFnX2hhbmRsZSAgICAgIDogJy53cGJjX2JmYl9fZHJhZy1oYW5kbGUnLFxyXG5cdFx0XHRtdWx0aXBsZV9jaGsgICAgIDogJy5qcy1vcHQtbXVsdGlwbGVbZGF0YS1pbnNwZWN0b3Ita2V5PVwibXVsdGlwbGVcIl0nLFxyXG5cdFx0XHRkZWZhdWx0X3RleHQgICAgIDogJy5qcy1kZWZhdWx0LXZhbHVlW2RhdGEtaW5zcGVjdG9yLWtleT1cImRlZmF1bHRfdmFsdWVcIl0nLFxyXG5cdFx0XHRwbGFjZWhvbGRlcl9pbnB1dDogJy5qcy1wbGFjZWhvbGRlcltkYXRhLWluc3BlY3Rvci1rZXk9XCJwbGFjZWhvbGRlclwiXScsXHJcblx0XHRcdHBsYWNlaG9sZGVyX25vdGUgOiAnLmpzLXBsYWNlaG9sZGVyLW5vdGUnLFxyXG5cdFx0XHRzaXplX2lucHV0ICAgICAgIDogJy5pbnNwZWN0b3JfX2lucHV0W2RhdGEtaW5zcGVjdG9yLWtleT1cInNpemVcIl0nLFxyXG5cclxuXHRcdFx0Ly8gRHJvcGRvd24gbWVudSBpbnRlZ3JhdGlvbi5cclxuXHRcdFx0bWVudV9yb290ICA6ICcud3BiY191aV9lbF9fZHJvcGRvd24nLFxyXG5cdFx0XHRtZW51X3RvZ2dsZTogJ1tkYXRhLXRvZ2dsZT1cIndwYmNfZHJvcGRvd25cIl0nLFxyXG5cdFx0XHRtZW51X2FjdGlvbjogJy51bF9kcm9wZG93bl9tZW51X2xpX2FjdGlvbltkYXRhLWFjdGlvbl0nLFxyXG5cdFx0XHQvLyBWYWx1ZS1kaWZmZXJzIHRvZ2dsZS5cclxuXHRcdFx0dmFsdWVfZGlmZmVyc19jaGs6ICcuanMtdmFsdWUtZGlmZmVyc1tkYXRhLWluc3BlY3Rvci1rZXk9XCJ2YWx1ZV9kaWZmZXJzXCJdJyxcclxuXHRcdH07XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBvcHRpb24gdmFsdWUgZnJvbSBsYWJlbC5cclxuXHRcdCAqIC0gSWYgYGRpZmZlcnMgPT09IHRydWVgIC0+IGdlbmVyYXRlIHRva2VuIChzbHVnLWxpa2UgbWFjaGluZSB2YWx1ZSkuXHJcblx0XHQgKiAtIElmIGBkaWZmZXJzID09PSBmYWxzZWAgLT4ga2VlcCBodW1hbiB0ZXh0OyBlc2NhcGUgb25seSBkYW5nZXJvdXMgY2hhcnMuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGFiZWxcclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZGlmZmVyc1xyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGJ1aWxkX3ZhbHVlX2Zyb21fbGFiZWwobGFiZWwsIGRpZmZlcnMpIHtcclxuXHRcdFx0Y29uc3QgUyA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdGlmICggZGlmZmVycyApIHtcclxuXHRcdFx0XHRyZXR1cm4gKFMgJiYgdHlwZW9mIFMudG9fdG9rZW4gPT09ICdmdW5jdGlvbicpXHJcblx0XHRcdFx0XHQ/IFMudG9fdG9rZW4oIFN0cmluZyggbGFiZWwgfHwgJycgKSApXHJcblx0XHRcdFx0XHQ6IFN0cmluZyggbGFiZWwgfHwgJycgKS50cmltKCkudG9Mb3dlckNhc2UoKS5yZXBsYWNlKCAvXFxzKy9nLCAnXycgKS5yZXBsYWNlKCAvW15cXHctXS9nLCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIHNpbmdsZS1pbnB1dCBtb2RlOiBrZWVwIGh1bWFuIHRleHQ7IHRlbXBsYXRlIHdpbGwgZXNjYXBlIHNhZmVseS5cclxuXHRcdFx0cmV0dXJuIFN0cmluZyggbGFiZWwgPT0gbnVsbCA/ICcnIDogbGFiZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIHRoZSDigJx2YWx1ZSBkaWZmZXJzIGZyb20gbGFiZWzigJ0gdG9nZ2xlIGVuYWJsZWQ/XHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbFxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBpc192YWx1ZV9kaWZmZXJzX2VuYWJsZWQocGFuZWwpIHtcclxuXHRcdFx0Y29uc3QgY2hrID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkudmFsdWVfZGlmZmVyc19jaGsgKTtcclxuXHRcdFx0cmV0dXJuICEhKGNoayAmJiBjaGsuY2hlY2tlZCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbnN1cmUgdmlzaWJpbGl0eS9lbmFibGVkIHN0YXRlIG9mIFZhbHVlIGlucHV0cyBiYXNlZCBvbiB0aGUgdG9nZ2xlLlxyXG5cdFx0ICogV2hlbiBkaXNhYmxlZCAtPiBoaWRlIFZhbHVlIGlucHV0cyBhbmQga2VlcCB0aGVtIG1pcnJvcmVkIGZyb20gTGFiZWwuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbFxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGRpZmZlcnMgPSB0aGlzLmlzX3ZhbHVlX2RpZmZlcnNfZW5hYmxlZCggcGFuZWwgKTtcclxuXHRcdFx0Y29uc3Qgcm93cyAgICA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLnVpLnJvdyApIHx8IFtdO1xyXG5cclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgcm93cy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRjb25zdCByICAgICAgPSByb3dzW2ldO1xyXG5cdFx0XHRcdGNvbnN0IGxibF9pbiA9IHIucXVlcnlTZWxlY3RvciggdGhpcy51aS5sYWJlbCApO1xyXG5cdFx0XHRcdGNvbnN0IHZhbF9pbiA9IHIucXVlcnlTZWxlY3RvciggdGhpcy51aS52YWx1ZSApO1xyXG5cdFx0XHRcdGlmICggIXZhbF9pbiApIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0XHRpZiAoIGRpZmZlcnMgKSB7XHJcblx0XHRcdFx0XHQvLyBSZS1lbmFibGUgJiBzaG93IHZhbHVlIGlucHV0XHJcblx0XHRcdFx0XHR2YWxfaW4ucmVtb3ZlQXR0cmlidXRlKCAnZGlzYWJsZWQnICk7XHJcblx0XHRcdFx0XHR2YWxfaW4uc3R5bGUuZGlzcGxheSA9ICcnO1xyXG5cclxuXHRcdFx0XHRcdC8vIElmIHdlIGhhdmUgYSBjYWNoZWQgY3VzdG9tIHZhbHVlIGFuZCB0aGUgcm93IHdhc24ndCBlZGl0ZWQgd2hpbGUgT0ZGLCByZXN0b3JlIGl0XHJcblx0XHRcdFx0XHRjb25zdCBoYXNDYWNoZSAgID0gISF2YWxfaW4uZGF0YXNldC5jYWNoZWRfdmFsdWU7XHJcblx0XHRcdFx0XHRjb25zdCB1c2VyRWRpdGVkID0gci5kYXRhc2V0LnZhbHVlX3VzZXJfdG91Y2hlZCA9PT0gJzEnO1xyXG5cclxuXHRcdFx0XHRcdGlmICggaGFzQ2FjaGUgJiYgIXVzZXJFZGl0ZWQgKSB7XHJcblx0XHRcdFx0XHRcdHZhbF9pbi52YWx1ZSA9IHZhbF9pbi5kYXRhc2V0LmNhY2hlZF92YWx1ZTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoICFoYXNDYWNoZSApIHtcclxuXHRcdFx0XHRcdFx0Ly8gTm8gY2FjaGU6IGlmIHZhbHVlIGlzIGp1c3QgYSBtaXJyb3JlZCBsYWJlbCwgb2ZmZXIgYSB0b2tlbml6ZWQgZGVmYXVsdFxyXG5cdFx0XHRcdFx0XHRjb25zdCBsYmwgICAgICA9IGxibF9pbiA/IGxibF9pbi52YWx1ZSA6ICcnO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBtaXJyb3JlZCA9IHRoaXMuYnVpbGRfdmFsdWVfZnJvbV9sYWJlbCggbGJsLCAvKmRpZmZlcnM9Ki9mYWxzZSApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIHZhbF9pbi52YWx1ZSA9PT0gbWlycm9yZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0dmFsX2luLnZhbHVlID0gdGhpcy5idWlsZF92YWx1ZV9mcm9tX2xhYmVsKCBsYmwsIC8qZGlmZmVycz0qL3RydWUgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHQvLyBPTiAtPiBPRkY6IGNhY2hlIG9uY2UsIHRoZW4gbWlycm9yXHJcblx0XHRcdFx0XHRpZiAoICF2YWxfaW4uZGF0YXNldC5jYWNoZWRfdmFsdWUgKSB7XHJcblx0XHRcdFx0XHRcdHZhbF9pbi5kYXRhc2V0LmNhY2hlZF92YWx1ZSA9IHZhbF9pbi52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGNvbnN0IGxibCAgICA9IGxibF9pbiA/IGxibF9pbi52YWx1ZSA6ICcnO1xyXG5cdFx0XHRcdFx0dmFsX2luLnZhbHVlID0gdGhpcy5idWlsZF92YWx1ZV9mcm9tX2xhYmVsKCBsYmwsIC8qZGlmZmVycz0qL2ZhbHNlICk7XHJcblxyXG5cdFx0XHRcdFx0dmFsX2luLnNldEF0dHJpYnV0ZSggJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRcdFx0dmFsX2luLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcblx0XHRcdFx0XHQvLyBOT1RFOiBkbyBOT1QgbWFyayBhcyB1c2VyX3RvdWNoZWQgaGVyZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiB3aGV0aGVyIHRoaXMgcm934oCZcyB2YWx1ZSBoYXMgYmVlbiBlZGl0ZWQgYnkgdXNlci5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd1xyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBpc19yb3dfdmFsdWVfdXNlcl90b3VjaGVkKHJvdykge1xyXG5cdFx0XHRyZXR1cm4gcm93Py5kYXRhc2V0Py52YWx1ZV91c2VyX3RvdWNoZWQgPT09ICcxJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1hcmsgdGhpcyByb3figJlzIHZhbHVlIGFzIGVkaXRlZCBieSB1c2VyLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBtYXJrX3Jvd192YWx1ZV91c2VyX3RvdWNoZWQocm93KSB7XHJcblx0XHRcdGlmICggcm93ICkgcm93LmRhdGFzZXQudmFsdWVfdXNlcl90b3VjaGVkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5pdGlhbGl6ZSDigJxmcmVzaG5lc3PigJ0gZmxhZ3Mgb24gYSByb3cgKHZhbHVlIHVudG91Y2hlZCkuXHJcblx0XHQgKiBDYWxsIG9uIGNyZWF0aW9uL2FwcGVuZCBvZiByb3dzLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBpbml0X3Jvd19mcmVzaF9mbGFncyhyb3cpIHtcclxuXHRcdFx0aWYgKCByb3cgKSB7XHJcblx0XHRcdFx0aWYgKCAhcm93LmRhdGFzZXQudmFsdWVfdXNlcl90b3VjaGVkICkge1xyXG5cdFx0XHRcdFx0cm93LmRhdGFzZXQudmFsdWVfdXNlcl90b3VjaGVkID0gJzAnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gZGVmYXVsdHMgKHBhY2tzIGNhbiBvdmVycmlkZSkgLS0tLVxyXG5cdFx0c3RhdGljIGdldF9kZWZhdWx0cygpIHtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHR0eXBlICAgICAgICAgOiB0aGlzLmtpbmQsXHJcblx0XHRcdFx0bGFiZWwgICAgICAgIDogJ1NlbGVjdCcsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgIDogJycsXHJcblx0XHRcdFx0aHRtbF9pZCAgICAgIDogJycsXHJcblx0XHRcdFx0cGxhY2Vob2xkZXIgIDogJy0tLSBTZWxlY3QgLS0tJyxcclxuXHRcdFx0XHRyZXF1aXJlZCAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtdWx0aXBsZSAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRzaXplICAgICAgICAgOiBudWxsLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGRlZmF1bHRfdmFsdWU6ICcnLFxyXG5cdFx0XHRcdG9wdGlvbnMgICAgICA6IFtcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICdPcHRpb24gMScsIHZhbHVlOiAnT3B0aW9uIDEnLCBzZWxlY3RlZDogZmFsc2UgfSxcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICdPcHRpb24gMicsIHZhbHVlOiAnT3B0aW9uIDInLCBzZWxlY3RlZDogZmFsc2UgfSxcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICdPcHRpb24gMycsIHZhbHVlOiAnT3B0aW9uIDMnLCBzZWxlY3RlZDogZmFsc2UgfSxcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICdPcHRpb24gNCcsIHZhbHVlOiAnT3B0aW9uIDQnLCBzZWxlY3RlZDogZmFsc2UgfVxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdFx0bWluX3dpZHRoICAgIDogJzI0MHB4J1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gcHJldmlldyByZW5kZXIgKGlkZW1wb3RlbnQpIC0tLS1cclxuXHRcdHN0YXRpYyByZW5kZXIoZWwsIGRhdGEsIGN0eCkge1xyXG5cdFx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGQgPSB0aGlzLm5vcm1hbGl6ZV9kYXRhKCBkYXRhICk7XHJcblxyXG5cdFx0XHRpZiAoIGQubWluX3dpZHRoICE9IG51bGwgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5taW5fd2lkdGggPSBTdHJpbmcoIGQubWluX3dpZHRoICk7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWNvbC1taW4nLCBTdHJpbmcoIGQubWluX3dpZHRoICkgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBkLmh0bWxfaWQgIT0gbnVsbCApIGVsLmRhdGFzZXQuaHRtbF9pZCA9IFN0cmluZyggZC5odG1sX2lkIHx8ICcnICk7XHJcblx0XHRcdGlmICggZC5jc3NjbGFzcyAhPSBudWxsICkgZWwuZGF0YXNldC5jc3NjbGFzcyA9IFN0cmluZyggZC5jc3NjbGFzcyB8fCAnJyApO1xyXG5cdFx0XHRpZiAoIGQucGxhY2Vob2xkZXIgIT0gbnVsbCApIGVsLmRhdGFzZXQucGxhY2Vob2xkZXIgPSBTdHJpbmcoIGQucGxhY2Vob2xkZXIgfHwgJycgKTtcclxuXHJcblx0XHRcdGNvbnN0IHRwbCA9IHRoaXMuZ2V0X3RlbXBsYXRlKCB0aGlzLnRlbXBsYXRlX2lkICk7XHJcblx0XHRcdGlmICggdHlwZW9mIHRwbCAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19lcnJvclwiIHJvbGU9XCJhbGVydFwiPlRlbXBsYXRlIG5vdCBmb3VuZDogJyArIHRoaXMudGVtcGxhdGVfaWQgKyAnLjwvZGl2Pic7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGVsLmlubmVySFRNTCA9IHRwbCggZCApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR3aW5kb3cuX3dwYmM/LmRldj8uZXJyb3I/LiggJ1NlbGVjdF9CYXNlLnJlbmRlcicsIGUgKTtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19lcnJvclwiIHJvbGU9XCJhbGVydFwiPkVycm9yIHJlbmRlcmluZyBmaWVsZCBwcmV2aWV3LjwvZGl2Pic7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRlbC5kYXRhc2V0LnR5cGUgPSBkLnR5cGUgfHwgdGhpcy5raW5kO1xyXG5cdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWxhYmVsJywgKGQubGFiZWwgIT0gbnVsbCA/IFN0cmluZyggZC5sYWJlbCApIDogJycpICk7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdENvcmUuVUk/LldQQkNfQkZCX092ZXJsYXk/LmVuc3VyZT8uKCBjdHg/LmJ1aWxkZXIsIGVsICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICFlbC5kYXRhc2V0Lm9wdGlvbnMgJiYgQXJyYXkuaXNBcnJheSggZC5vcHRpb25zICkgJiYgZC5vcHRpb25zLmxlbmd0aCApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0ZWwuZGF0YXNldC5vcHRpb25zID0gSlNPTi5zdHJpbmdpZnkoIGQub3B0aW9ucyApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gZHJvcCBzZWVkaW5nIChvcHRpb25zICsgcGxhY2Vob2xkZXIpIC0tLS1cclxuXHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBtZXRhKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0c3VwZXIub25fZmllbGRfZHJvcD8uKCBkYXRhLCBlbCwgbWV0YSApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgaXNfZHJvcCA9IChtZXRhICYmIG1ldGEuY29udGV4dCA9PT0gJ2Ryb3AnKTtcclxuXHJcblx0XHRcdGlmICggaXNfZHJvcCApIHtcclxuXHRcdFx0XHRpZiAoICFBcnJheS5pc0FycmF5KCBkYXRhLm9wdGlvbnMgKSB8fCAhZGF0YS5vcHRpb25zLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdGNvbnN0IG9wdHMgICA9ICh0aGlzLmdldF9kZWZhdWx0cygpLm9wdGlvbnMgfHwgW10pLm1hcCggKG8pID0+ICh7XHJcblx0XHRcdFx0XHRcdGxhYmVsICAgOiBvLmxhYmVsLFxyXG5cdFx0XHRcdFx0XHR2YWx1ZSAgIDogby52YWx1ZSxcclxuXHRcdFx0XHRcdFx0c2VsZWN0ZWQ6ICEhby5zZWxlY3RlZFxyXG5cdFx0XHRcdFx0fSkgKTtcclxuXHRcdFx0XHRcdGRhdGEub3B0aW9ucyA9IG9wdHM7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRlbC5kYXRhc2V0Lm9wdGlvbnMgPSBKU09OLnN0cmluZ2lmeSggb3B0cyApO1xyXG5cdFx0XHRcdFx0XHRlbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7IGJ1YmJsZXM6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0ZGV0YWlsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdGtleSAgOiAnb3B0aW9ucycsXHJcblx0XHRcdFx0XHRcdFx0XHR2YWx1ZTogb3B0c1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fSApICk7XHJcblx0XHRcdFx0XHRcdENvcmUuU3RydWN0dXJlPy51cGRhdGVfZmllbGRfcHJvcD8uKCBlbCwgJ29wdGlvbnMnLCBvcHRzICk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IHBoID0gKGRhdGEucGxhY2Vob2xkZXIgPz8gJycpLnRvU3RyaW5nKCkudHJpbSgpO1xyXG5cdFx0XHRcdGlmICggIXBoICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgZGZsdCAgICAgICA9IHRoaXMuZ2V0X2RlZmF1bHRzKCkucGxhY2Vob2xkZXIgfHwgJy0tLSBTZWxlY3QgLS0tJztcclxuXHRcdFx0XHRcdGRhdGEucGxhY2Vob2xkZXIgPSBkZmx0O1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5wbGFjZWhvbGRlciA9IFN0cmluZyggZGZsdCApO1xyXG5cdFx0XHRcdFx0XHRlbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7IGJ1YmJsZXM6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0ZGV0YWlsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdGtleSAgOiAncGxhY2Vob2xkZXInLFxyXG5cdFx0XHRcdFx0XHRcdFx0dmFsdWU6IGRmbHRcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0gKSApO1xyXG5cdFx0XHRcdFx0XHRDb3JlLlN0cnVjdHVyZT8udXBkYXRlX2ZpZWxkX3Byb3A/LiggZWwsICdwbGFjZWhvbGRlcicsIGRmbHQgKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0Ly8gSW5zcGVjdG9yIGhlbHBlcnMgKHNuYWtlX2Nhc2UpXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRcdHN0YXRpYyBnZXRfcGFuZWxfcm9vdChlbCkge1xyXG5cdFx0XHRyZXR1cm4gZWw/LmNsb3Nlc3Q/LiggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApIHx8IGVsPy5jbG9zZXN0Py4oICcud3BiY19iZmJfX2luc3BlY3RvcicgKSB8fCBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBnZXRfbGlzdChwYW5lbCkge1xyXG5cdFx0XHRyZXR1cm4gcGFuZWwgPyBwYW5lbC5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLmxpc3QgKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGdldF9ob2xkZXIocGFuZWwpIHtcclxuXHRcdFx0cmV0dXJuIHBhbmVsID8gcGFuZWwucXVlcnlTZWxlY3RvciggdGhpcy51aS5ob2xkZXIgKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIG1ha2VfdWlkKCkge1xyXG5cdFx0XHRyZXR1cm4gJ3dwYmNfaW5zX2F1dG9fb3B0XycgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCAxMCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBhcHBlbmRfcm93KHBhbmVsLCBkYXRhKSB7XHJcblx0XHRcdGNvbnN0IGxpc3QgPSB0aGlzLmdldF9saXN0KCBwYW5lbCApO1xyXG5cdFx0XHRpZiAoICFsaXN0ICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgaWR4ICA9IGxpc3QuY2hpbGRyZW4ubGVuZ3RoO1xyXG5cdFx0XHRjb25zdCByb3dkID0gT2JqZWN0LmFzc2lnbiggeyBsYWJlbDogJycsIHZhbHVlOiAnJywgc2VsZWN0ZWQ6IGZhbHNlLCBpbmRleDogaWR4IH0sIChkYXRhIHx8IHt9KSApO1xyXG5cdFx0XHRpZiAoICFyb3dkLnVpZCApIHJvd2QudWlkID0gdGhpcy5tYWtlX3VpZCgpO1xyXG5cclxuXHRcdFx0Y29uc3QgdHBsX2lkID0gdGhpcy5vcHRpb25fcm93X3RlbXBsYXRlX2lkO1xyXG5cdFx0XHRjb25zdCB0cGwgICAgPSAod2luZG93LndwICYmIHdwLnRlbXBsYXRlKSA/IHdwLnRlbXBsYXRlKCB0cGxfaWQgKSA6IG51bGw7XHJcblx0XHRcdGNvbnN0IGh0bWwgICA9IHRwbCA/IHRwbCggcm93ZCApIDogbnVsbDtcclxuXHJcblx0XHRcdC8vIEluIGFwcGVuZF9yb3coKSAtPiBmYWxsYmFjayBIVE1MLlxyXG5cdFx0XHRjb25zdCB3cmFwICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdHdyYXAuaW5uZXJIVE1MID0gaHRtbCB8fCAoXHJcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0aW9uc19yb3dcIiBkYXRhLWluZGV4PVwiJyArIChyb3dkLmluZGV4IHx8IDApICsgJ1wiPicgK1xyXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwid3BiY19iZmJfX2RyYWctaGFuZGxlXCI+PHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9kcmFnX2luZGljYXRvclwiPjwvc3Bhbj48L3NwYW4+JyArXHJcblx0XHRcdFx0XHQnPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LWxhYmVsXCIgcGxhY2Vob2xkZXI9XCJMYWJlbFwiIHZhbHVlPVwiJyArIChyb3dkLmxhYmVsIHx8ICcnKSArICdcIj4nICtcclxuXHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtdmFsdWVcIiBwbGFjZWhvbGRlcj1cIlZhbHVlXCIgdmFsdWU9XCInICsgKHJvd2QudmFsdWUgfHwgJycpICsgJ1wiPicgK1xyXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LXNlbGVjdGVkXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwiaW5zcGVjdG9yX19jb250cm9sIHdwYmNfdWlfX3RvZ2dsZVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoayBpbnNwZWN0b3JfX2lucHV0XCIgaWQ9XCInICsgcm93ZC51aWQgKyAnXCIgcm9sZT1cInN3aXRjaFwiICcgKyAocm93ZC5zZWxlY3RlZCA/ICdjaGVja2VkIGFyaWEtY2hlY2tlZD1cInRydWVcIicgOiAnYXJpYS1jaGVja2VkPVwiZmFsc2VcIicpICsgJz4nICtcclxuXHRcdFx0XHRcdFx0XHQnPGxhYmVsIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlX2ljb25fcmFkaW9cIiBmb3I9XCInICsgcm93ZC51aWQgKyAnXCI+PC9sYWJlbD4nICtcclxuXHRcdFx0XHRcdFx0XHQnPGxhYmVsIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlX2xhYmVsXCIgZm9yPVwiJyArIHJvd2QudWlkICsgJ1wiPkRlZmF1bHQ8L2xhYmVsPicgK1xyXG5cdFx0XHRcdFx0XHQnPC9kaXY+JyArXHJcblx0XHRcdFx0XHQnPC9kaXY+JyArXHJcblx0XHRcdFx0XHQvLyAzLWRvdCBkcm9wZG93biAodXNlcyBleGlzdGluZyBwbHVnaW4gZHJvcGRvd24gSlMpLlxyXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX3VpX2VsIHdwYmNfdWlfZWxfY29udGFpbmVyIHdwYmNfdWlfZWxfX2Ryb3Bkb3duXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgZGF0YS10b2dnbGU9XCJ3cGJjX2Ryb3Bkb3duXCIgYXJpYS1leHBhbmRlZD1cImZhbHNlXCIgY2xhc3M9XCJ1bF9kcm9wZG93bl9tZW51X3RvZ2dsZVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX21vcmVfdmVydFwiPjwvaT4nICtcclxuXHRcdFx0XHRcdFx0JzwvYT4nICtcclxuXHRcdFx0XHRcdFx0Jzx1bCBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVcIiByb2xlPVwibWVudVwiIHN0eWxlPVwicmlnaHQ6MHB4OyBsZWZ0OmF1dG87XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaT4nICtcclxuXHRcdFx0XHRcdFx0XHRcdCc8YSBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uXCIgZGF0YS1hY3Rpb249XCJhZGRfYWZ0ZXJcIiBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCI+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdBZGQgTmV3JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2FkZF9jaXJjbGVcIj48L2k+JyArXHJcblx0XHRcdFx0XHRcdFx0XHQnPC9hPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8L2xpPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8bGk+JyArXHJcblx0XHRcdFx0XHRcdFx0XHQnPGEgY2xhc3M9XCJ1bF9kcm9wZG93bl9tZW51X2xpX2FjdGlvblwiIGRhdGEtYWN0aW9uPVwiZHVwbGljYXRlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnRHVwbGljYXRlJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2NvbnRlbnRfY29weVwiPjwvaT4nICtcclxuXHRcdFx0XHRcdFx0XHRcdCc8L2E+JyArXHJcblx0XHRcdFx0XHRcdFx0JzwvbGk+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaSBjbGFzcz1cImRpdmlkZXJcIj48L2xpPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8bGk+JyArXHJcblx0XHRcdFx0XHRcdFx0XHQnPGEgY2xhc3M9XCJ1bF9kcm9wZG93bl9tZW51X2xpX2FjdGlvblwiIGRhdGEtYWN0aW9uPVwicmVtb3ZlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnUmVtb3ZlJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RlbGV0ZV9vdXRsaW5lXCI+PC9pPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0JzwvYT4nICtcclxuXHRcdFx0XHRcdFx0XHQnPC9saT4nICtcclxuXHRcdFx0XHRcdFx0JzwvdWw+JyArXHJcblx0XHRcdFx0XHQnPC9kaXY+JyArXHJcblx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdGNvbnN0IG5vZGUgPSB3cmFwLmZpcnN0RWxlbWVudENoaWxkO1xyXG5cdFx0XHQgaWYgKCEgbm9kZSkge1xyXG5cdFx0XHRcdCByZXR1cm47XHJcblx0XHRcdCB9XHJcblx0XHRcdC8vIHByZS1oaWRlIFZhbHVlIGlucHV0IGlmIHRvZ2dsZSBpcyBPRkYgKipiZWZvcmUqKiBhcHBlbmRpbmcuXHJcblx0XHRcdGNvbnN0IGRpZmZlcnMgPSB0aGlzLmlzX3ZhbHVlX2RpZmZlcnNfZW5hYmxlZCggcGFuZWwgKTtcclxuXHRcdFx0Y29uc3QgdmFsSW4gICA9IG5vZGUucXVlcnlTZWxlY3RvciggdGhpcy51aS52YWx1ZSApO1xyXG5cdFx0XHRjb25zdCBsYmxJbiAgID0gbm9kZS5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLmxhYmVsICk7XHJcblxyXG5cdFx0XHRpZiAoICFkaWZmZXJzICYmIHZhbEluICkge1xyXG5cdFx0XHRcdGlmICggIXZhbEluLmRhdGFzZXQuY2FjaGVkX3ZhbHVlICkge1xyXG5cdFx0XHRcdFx0dmFsSW4uZGF0YXNldC5jYWNoZWRfdmFsdWUgPSB2YWxJbi52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBsYmxJbiApIHZhbEluLnZhbHVlID0gdGhpcy5idWlsZF92YWx1ZV9mcm9tX2xhYmVsKCBsYmxJbi52YWx1ZSwgZmFsc2UgKTtcclxuXHRcdFx0XHR2YWxJbi5zZXRBdHRyaWJ1dGUoICdkaXNhYmxlZCcsICdkaXNhYmxlZCcgKTtcclxuXHRcdFx0XHR2YWxJbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG5cdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0dGhpcy5pbml0X3Jvd19mcmVzaF9mbGFncyggbm9kZSApO1xyXG5cdFx0XHRsaXN0LmFwcGVuZENoaWxkKCBub2RlICk7XHJcblxyXG5cdFx0XHQvLyBLZWVwIHlvdXIgZXhpc3RpbmcgcG9zdC1hcHBlbmQgc3luYyBhcyBhIHNhZmV0eSBuZXRcclxuXHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBjbG9zZV9kcm9wZG93bihhbmNob3JfZWwpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgcm9vdCA9IGFuY2hvcl9lbD8uY2xvc2VzdD8uKCB0aGlzLnVpLm1lbnVfcm9vdCApO1xyXG5cdFx0XHRcdGlmICggcm9vdCApIHtcclxuXHRcdFx0XHRcdC8vIElmIHlvdXIgZHJvcGRvd24gdG9nZ2xlciB0b2dnbGVzIGEgY2xhc3MgbGlrZSAnb3BlbicsIGNsb3NlIGl0LlxyXG5cdFx0XHRcdFx0cm9vdC5jbGFzc0xpc3QucmVtb3ZlKCAnb3BlbicgKTtcclxuXHRcdFx0XHRcdC8vIE9yIGlmIGl0IHJlbGllcyBvbiBhcmlhLWV4cGFuZGVkIG9uIHRoZSB0b2dnbGUuXHJcblx0XHRcdFx0XHR2YXIgdCA9IHJvb3QucXVlcnlTZWxlY3RvciggdGhpcy51aS5tZW51X3RvZ2dsZSApO1xyXG5cdFx0XHRcdFx0aWYgKCB0ICkge1xyXG5cdFx0XHRcdFx0XHR0LnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggXyApIHsgfVxyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBpbnNlcnRfYWZ0ZXIobmV3X25vZGUsIHJlZl9ub2RlKSB7XHJcblx0XHRcdGlmICggcmVmX25vZGU/LnBhcmVudE5vZGUgKSB7XHJcblx0XHRcdFx0aWYgKCByZWZfbm9kZS5uZXh0U2libGluZyApIHtcclxuXHRcdFx0XHRcdHJlZl9ub2RlLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKCBuZXdfbm9kZSwgcmVmX25vZGUubmV4dFNpYmxpbmcgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmVmX25vZGUucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCggbmV3X25vZGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgY29tbWl0X29wdGlvbnMocGFuZWwpIHtcclxuXHRcdFx0Y29uc3QgbGlzdCAgID0gdGhpcy5nZXRfbGlzdCggcGFuZWwgKTtcclxuXHRcdFx0Y29uc3QgaG9sZGVyID0gdGhpcy5nZXRfaG9sZGVyKCBwYW5lbCApO1xyXG5cdFx0XHRpZiAoICFsaXN0IHx8ICFob2xkZXIgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBkaWZmZXJzID0gdGhpcy5pc192YWx1ZV9kaWZmZXJzX2VuYWJsZWQoIHBhbmVsICk7XHJcblxyXG5cdFx0XHRjb25zdCByb3dzICAgID0gbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLnVpLnJvdyApO1xyXG5cdFx0XHRjb25zdCBvcHRpb25zID0gW107XHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHJvd3MubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0Y29uc3QgciAgICAgID0gcm93c1tpXTtcclxuXHRcdFx0XHRjb25zdCBsYmxfaW4gPSByLnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkubGFiZWwgKTtcclxuXHRcdFx0XHRjb25zdCB2YWxfaW4gPSByLnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkudmFsdWUgKTtcclxuXHRcdFx0XHRjb25zdCBjaGsgICAgPSByLnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkudG9nZ2xlICk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGxibCA9IChsYmxfaW4gJiYgbGJsX2luLnZhbHVlKSB8fCAnJztcclxuXHRcdFx0XHRsZXQgdmFsICAgPSAodmFsX2luICYmIHZhbF9pbi52YWx1ZSkgfHwgJyc7XHJcblxyXG5cdFx0XHRcdC8vIElmIHNpbmdsZS1pbnB1dCBtb2RlIC0+IGhhcmQgbWlycm9yIHRvIGxhYmVsLlxyXG5cdFx0XHRcdGlmICggISBkaWZmZXJzICkge1xyXG5cdFx0XHRcdFx0Ly8gc2luZ2xlLWlucHV0IG1vZGU6IG1pcnJvciBMYWJlbCwgbWluaW1hbCBlc2NhcGluZyAobm8gc2x1ZykuXHJcblx0XHRcdFx0XHR2YWwgPSB0aGlzLmJ1aWxkX3ZhbHVlX2Zyb21fbGFiZWwoIGxibCwgLypkaWZmZXJzPSovZmFsc2UgKTtcclxuXHRcdFx0XHRcdGlmICggdmFsX2luICkge1xyXG5cdFx0XHRcdFx0XHR2YWxfaW4udmFsdWUgPSB2YWw7ICAgLy8ga2VlcCBoaWRkZW4gaW5wdXQgaW4gc3luYyBmb3IgYW55IHByZXZpZXdzL2RlYnVnLlxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3Qgc2VsID0gISEoY2hrICYmIGNoay5jaGVja2VkKTtcclxuXHRcdFx0XHRvcHRpb25zLnB1c2goIHsgbGFiZWw6IGxibCwgdmFsdWU6IHZhbCwgc2VsZWN0ZWQ6IHNlbCB9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0aG9sZGVyLnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoIG9wdGlvbnMgKTtcclxuXHRcdFx0XHRob2xkZXIuZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KCAnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0aG9sZGVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHRwYW5lbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7XHJcblx0XHRcdFx0XHRidWJibGVzOiB0cnVlLCBkZXRhaWw6IHtcclxuXHRcdFx0XHRcdFx0a2V5OiAnb3B0aW9ucycsIHZhbHVlOiBvcHRpb25zXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnN5bmNfZGVmYXVsdF92YWx1ZV9sb2NrKCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLnN5bmNfcGxhY2Vob2xkZXJfbG9jayggcGFuZWwgKTtcclxuXHJcblx0XHRcdC8vIE1pcnJvciB0byB0aGUgc2VsZWN0ZWQgZmllbGQgZWxlbWVudCBzbyBjYW52YXMvZXhwb3J0IHNlZXMgY3VycmVudCBvcHRpb25zIGltbWVkaWF0ZWx5LlxyXG5cdFx0XHRjb25zdCBmaWVsZCA9IHBhbmVsLl9fc2VsZWN0YmFzZV9maWVsZFxyXG5cdFx0XHRcdHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2ZpZWxkLmlzLXNlbGVjdGVkLCAud3BiY19iZmJfX2ZpZWxkLS1zZWxlY3RlZCcgKTtcclxuXHRcdFx0aWYgKCBmaWVsZCApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0ZmllbGQuZGF0YXNldC5vcHRpb25zID0gSlNPTi5zdHJpbmdpZnkoIG9wdGlvbnMgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Q29yZS5TdHJ1Y3R1cmU/LnVwZGF0ZV9maWVsZF9wcm9wPy4oIGZpZWxkLCAnb3B0aW9ucycsIG9wdGlvbnMgKTtcclxuXHRcdFx0XHRmaWVsZC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7XHJcblx0XHRcdFx0XHRidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsga2V5OiAnb3B0aW9ucycsIHZhbHVlOiBvcHRpb25zIH1cclxuXHRcdFx0XHR9ICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRzdGF0aWMgZW5zdXJlX3NvcnRhYmxlKHBhbmVsKSB7XHJcblxyXG5cdFx0XHRjb25zdCBsaXN0ID0gdGhpcy5nZXRfbGlzdCggcGFuZWwgKTtcclxuXHRcdFx0aWYgKCAhIGxpc3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nID0gd2luZG93LlNvcnRhYmxlPy5nZXQ/LiggbGlzdCApO1xyXG5cdFx0XHRcdGlmICggZXhpc3RpbmcgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCBidWlsZGVyID0gd2luZG93LndwYmNfYmZiX2FwaT8uZ2V0X2J1aWxkZXI/LigpIHx8IHdpbmRvdy53cGJjX2JmYiB8fCBudWxsO1xyXG5cclxuXHRcdFx0XHQvLyBQcmVmZXIgdGhlIHNoYXJlZCBTb3J0YWJsZSBtYW5hZ2VyIHNvIHRoZSBzaWRlYmFyIGxpc3QgdXNlc1xyXG5cdFx0XHRcdC8vIHRoZSBkZWRpY2F0ZWQgXCJzaW1wbGVfbGlzdFwiIGNvbmZpZyBpbnN0ZWFkIG9mIHRoZSBjYW52YXMgY29uZmlnLlxyXG5cdFx0XHRcdGlmICggYnVpbGRlciAmJiBidWlsZGVyLnNvcnRhYmxlICYmIHR5cGVvZiBidWlsZGVyLnNvcnRhYmxlLmVuc3VyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHJcblx0XHRcdFx0XHRidWlsZGVyLnNvcnRhYmxlLmVuc3VyZShcclxuXHRcdFx0XHRcdFx0bGlzdCxcclxuXHRcdFx0XHRcdFx0J2NhbnZhcycsXHJcblx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRzb3J0YWJsZV9raW5kICAgICA6ICdzaW1wbGVfbGlzdCcsXHJcblx0XHRcdFx0XHRcdFx0aGFuZGxlX3NlbGVjdG9yICAgOiB0aGlzLnVpLmRyYWdfaGFuZGxlLFxyXG5cdFx0XHRcdFx0XHRcdGRyYWdnYWJsZV9zZWxlY3RvcjogdGhpcy51aS5yb3csXHJcblx0XHRcdFx0XHRcdFx0b25VcGRhdGUgICAgICAgICAgOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmNvbW1pdF9vcHRpb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0fSBlbHNlIGlmICggd2luZG93LlNvcnRhYmxlPy5jcmVhdGUgKSB7XHJcblx0XHRcdFx0XHQvLyBGYWxsYmFjayBpZiBidWlsZGVyIGlzIG5vdCByZWFkeSBmb3Igc29tZSByZWFzb24uXHJcblx0XHRcdFx0XHR3aW5kb3cuU29ydGFibGUuY3JlYXRlKFxyXG5cdFx0XHRcdFx0XHRsaXN0LFxyXG5cdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0aGFuZGxlICAgICAgICAgICA6IHRoaXMudWkuZHJhZ19oYW5kbGUsXHJcblx0XHRcdFx0XHRcdFx0ZHJhZ2dhYmxlICAgICAgICA6IHRoaXMudWkucm93LFxyXG5cdFx0XHRcdFx0XHRcdGFuaW1hdGlvbiAgICAgICAgOiAxMjAsXHJcblx0XHRcdFx0XHRcdFx0Zm9yY2VGYWxsYmFjayAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0ZmFsbGJhY2tPbkJvZHkgICA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0XHRcdGZhbGxiYWNrVG9sZXJhbmNlOiA4LFxyXG5cdFx0XHRcdFx0XHRcdHJlbW92ZUNsb25lT25IaWRlOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdG9uVXBkYXRlICAgICAgICAgOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmNvbW1pdF9vcHRpb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxpc3QuZGF0YXNldC5zb3J0YWJsZV9pbml0ID0gJzEnO1xyXG5cclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0d2luZG93Ll93cGJjPy5kZXY/LmVycm9yPy4oICdTZWxlY3RfQmFzZS5lbnN1cmVfc29ydGFibGUnLCBlICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgcmVidWlsZF9pZl9lbXB0eShwYW5lbCkge1xyXG5cdFx0XHRjb25zdCBsaXN0ICAgPSB0aGlzLmdldF9saXN0KCBwYW5lbCApO1xyXG5cdFx0XHRjb25zdCBob2xkZXIgPSB0aGlzLmdldF9ob2xkZXIoIHBhbmVsICk7XHJcblx0XHRcdGlmICggIWxpc3QgfHwgIWhvbGRlciB8fCBsaXN0LmNoaWxkcmVuLmxlbmd0aCApIHJldHVybjtcclxuXHJcblx0XHRcdGxldCBkYXRhID0gW107XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0ZGF0YSA9IEpTT04ucGFyc2UoIGhvbGRlci52YWx1ZSB8fCAnW10nICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdGRhdGEgPSBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAhQXJyYXkuaXNBcnJheSggZGF0YSApIHx8ICFkYXRhLmxlbmd0aCApIHtcclxuXHRcdFx0XHRkYXRhID0gKHRoaXMuZ2V0X2RlZmF1bHRzKCkub3B0aW9ucyB8fCBbXSkuc2xpY2UoIDAgKTtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aG9sZGVyLnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoIGRhdGEgKTtcclxuXHRcdFx0XHRcdGhvbGRlci5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHRcdGhvbGRlci5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdHRoaXMuYXBwZW5kX3JvdyggcGFuZWwsIHtcclxuXHRcdFx0XHRcdGxhYmVsICAgOiBkYXRhW2ldPy5sYWJlbCB8fCAnJyxcclxuXHRcdFx0XHRcdHZhbHVlICAgOiBkYXRhW2ldPy52YWx1ZSB8fCAnJyxcclxuXHRcdFx0XHRcdHNlbGVjdGVkOiAhIWRhdGFbaV0/LnNlbGVjdGVkLFxyXG5cdFx0XHRcdFx0aW5kZXggICA6IGksXHJcblx0XHRcdFx0XHR1aWQgICAgIDogdGhpcy5tYWtlX3VpZCgpXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnN5bmNfZGVmYXVsdF92YWx1ZV9sb2NrKCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLnN5bmNfcGxhY2Vob2xkZXJfbG9jayggcGFuZWwgKTtcclxuXHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBoYXNfcm93X2RlZmF1bHRzKHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGNoZWNrcyA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLnVpLnRvZ2dsZSApO1xyXG5cdFx0XHRpZiAoICFjaGVja3M/Lmxlbmd0aCApIHJldHVybiBmYWxzZTtcclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgY2hlY2tzLmxlbmd0aDsgaSsrICkgaWYgKCBjaGVja3NbaV0uY2hlY2tlZCApIHJldHVybiB0cnVlO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGlzX211bHRpcGxlX2VuYWJsZWQocGFuZWwpIHtcclxuXHRcdFx0Y29uc3QgY2hrID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkubXVsdGlwbGVfY2hrICk7XHJcblx0XHRcdHJldHVybiAhIShjaGsgJiYgY2hrLmNoZWNrZWQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBoYXNfdGV4dF9kZWZhdWx0X3ZhbHVlKHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGR2ID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkuZGVmYXVsdF90ZXh0ICk7XHJcblx0XHRcdHJldHVybiAhIShkdiAmJiBTdHJpbmcoIGR2LnZhbHVlIHx8ICcnICkudHJpbSgpLmxlbmd0aCk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHN5bmNfZGVmYXVsdF92YWx1ZV9sb2NrKHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGlucHV0ID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkuZGVmYXVsdF90ZXh0ICk7XHJcblx0XHRcdGNvbnN0IG5vdGUgID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoICcuanMtZGVmYXVsdC12YWx1ZS1ub3RlJyApO1xyXG5cdFx0XHRpZiAoICFpbnB1dCApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGxvY2sgICAgID0gdGhpcy5oYXNfcm93X2RlZmF1bHRzKCBwYW5lbCApO1xyXG5cdFx0XHRpbnB1dC5kaXNhYmxlZCA9ICEhbG9jaztcclxuXHRcdFx0aWYgKCBsb2NrICkge1xyXG5cdFx0XHRcdGlucHV0LnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRpZiAoIG5vdGUgKSBub3RlLnN0eWxlLmRpc3BsYXkgPSAnJztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRpbnB1dC5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJyApO1xyXG5cdFx0XHRcdGlmICggbm90ZSApIG5vdGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBzeW5jX3BsYWNlaG9sZGVyX2xvY2socGFuZWwpIHtcclxuXHRcdFx0Y29uc3QgaW5wdXQgPSBwYW5lbD8ucXVlcnlTZWxlY3RvciggdGhpcy51aS5wbGFjZWhvbGRlcl9pbnB1dCApO1xyXG5cdFx0XHRjb25zdCBub3RlICA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLnBsYWNlaG9sZGVyX25vdGUgKTtcclxuXHJcblx0XHRcdC8vIE5FVzogY29tcHV0ZSBtdWx0aXBsZSBhbmQgdG9nZ2xlIHJvdyB2aXNpYmlsaXR5XHJcblx0XHRcdGNvbnN0IGlzTXVsdGlwbGUgICAgID0gdGhpcy5pc19tdWx0aXBsZV9lbmFibGVkKCBwYW5lbCApO1xyXG5cdFx0XHRjb25zdCBwbGFjZWhvbGRlclJvdyA9IGlucHV0Py5jbG9zZXN0KCAnLmluc3BlY3Rvcl9fcm93JyApIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHNpemVJbnB1dCAgICAgID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkuc2l6ZV9pbnB1dCApIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHNpemVSb3cgICAgICAgID0gc2l6ZUlucHV0Py5jbG9zZXN0KCAnLmluc3BlY3Rvcl9fcm93JyApIHx8IG51bGw7XHJcblxyXG5cdFx0XHQvLyBTaG93IHBsYWNlaG9sZGVyIG9ubHkgZm9yIHNpbmdsZS1zZWxlY3Q7IHNob3cgc2l6ZSBvbmx5IGZvciBtdWx0aXBsZVxyXG5cdFx0XHRpZiAoIHBsYWNlaG9sZGVyUm93ICkgcGxhY2Vob2xkZXJSb3cuc3R5bGUuZGlzcGxheSA9IGlzTXVsdGlwbGUgPyAnbm9uZScgOiAnJztcclxuXHRcdFx0aWYgKCBzaXplUm93ICkgc2l6ZVJvdy5zdHlsZS5kaXNwbGF5ID0gaXNNdWx0aXBsZSA/ICcnIDogJ25vbmUnO1xyXG5cclxuXHRcdFx0Ly8gRXhpc3RpbmcgYmVoYXZpb3IgKGtlZXAgYXMtaXMpXHJcblx0XHRcdGlmICggIWlucHV0ICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgbG9jayA9IGlzTXVsdGlwbGUgfHwgdGhpcy5oYXNfcm93X2RlZmF1bHRzKCBwYW5lbCApIHx8IHRoaXMuaGFzX3RleHRfZGVmYXVsdF92YWx1ZSggcGFuZWwgKTtcclxuXHRcdFx0aWYgKCBub3RlICYmICFub3RlLmlkICkgbm90ZS5pZCA9ICd3cGJjX3BsYWNlaG9sZGVyX25vdGVfJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDEwICk7XHJcblxyXG5cdFx0XHRpbnB1dC5kaXNhYmxlZCA9ICEhbG9jaztcclxuXHRcdFx0aWYgKCBsb2NrICkge1xyXG5cdFx0XHRcdGlucHV0LnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRpZiAoIG5vdGUgKSB7XHJcblx0XHRcdFx0XHRub3RlLnN0eWxlLmRpc3BsYXkgPSAnJztcclxuXHRcdFx0XHRcdGlucHV0LnNldEF0dHJpYnV0ZSggJ2FyaWEtZGVzY3JpYmVkYnknLCBub3RlLmlkICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGlucHV0LnJlbW92ZUF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnICk7XHJcblx0XHRcdFx0aW5wdXQucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1kZXNjcmliZWRieScgKTtcclxuXHRcdFx0XHRpZiAoIG5vdGUgKSBub3RlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgZW5mb3JjZV9zaW5nbGVfZGVmYXVsdChwYW5lbCwgY2xpY2tlZCkge1xyXG5cdFx0XHRpZiAoIHRoaXMuaXNfbXVsdGlwbGVfZW5hYmxlZCggcGFuZWwgKSApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGNoZWNrcyA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLnVpLnRvZ2dsZSApO1xyXG5cdFx0XHRpZiAoICFjaGVja3M/Lmxlbmd0aCApIHJldHVybjtcclxuXHJcblx0XHRcdGlmICggY2xpY2tlZCAmJiBjbGlja2VkLmNoZWNrZWQgKSB7XHJcblx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgY2hlY2tzLmxlbmd0aDsgaSsrICkgaWYgKCBjaGVja3NbaV0gIT09IGNsaWNrZWQgKSB7XHJcblx0XHRcdFx0XHRjaGVja3NbaV0uY2hlY2tlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0Y2hlY2tzW2ldLnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2xpY2tlZC5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBrZXB0ID0gZmFsc2U7XHJcblx0XHRcdGZvciAoIGxldCBqID0gMDsgaiA8IGNoZWNrcy5sZW5ndGg7IGorKyApIGlmICggY2hlY2tzW2pdLmNoZWNrZWQgKSB7XHJcblx0XHRcdFx0aWYgKCAha2VwdCApIHtcclxuXHRcdFx0XHRcdGtlcHQgPSB0cnVlO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjaGVja3Nbal0uY2hlY2tlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0Y2hlY2tzW2pdLnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuc3luY19kZWZhdWx0X3ZhbHVlX2xvY2soIHBhbmVsICk7XHJcblx0XHRcdHRoaXMuc3luY19wbGFjZWhvbGRlcl9sb2NrKCBwYW5lbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gb25lLXRpbWUgYm9vdHN0cmFwIG9mIGEgcGFuZWwgLS0tLVxyXG5cdFx0c3RhdGljIGJvb3RzdHJhcF9wYW5lbChwYW5lbCkge1xyXG5cdFx0XHRpZiAoICFwYW5lbCApIHJldHVybjtcclxuXHRcdFx0aWYgKCAhcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fb3B0aW9uc19lZGl0b3InICkgKSByZXR1cm47IC8vIG9ubHkgc2VsZWN0LWxpa2UgVUlzXHJcblx0XHRcdGlmICggcGFuZWwuZGF0YXNldC5zZWxlY3RiYXNlX2Jvb3RzdHJhcHBlZCA9PT0gJzEnICkge1xyXG5cdFx0XHRcdHRoaXMuZW5zdXJlX3NvcnRhYmxlKCBwYW5lbCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5yZWJ1aWxkX2lmX2VtcHR5KCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLmVuc3VyZV9zb3J0YWJsZSggcGFuZWwgKTtcclxuXHRcdFx0cGFuZWwuZGF0YXNldC5zZWxlY3RiYXNlX2Jvb3RzdHJhcHBlZCA9ICcxJztcclxuXHJcblx0XHRcdHRoaXMuc3luY19kZWZhdWx0X3ZhbHVlX2xvY2soIHBhbmVsICk7XHJcblx0XHRcdHRoaXMuc3luY19wbGFjZWhvbGRlcl9sb2NrKCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLnN5bmNfdmFsdWVfaW5wdXRzX3Zpc2liaWxpdHkoIHBhbmVsICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLSBob29rIGludG8gaW5zcGVjdG9yIGxpZmVjeWNsZSAoZmlyZXMgT05DRSkgLS0tLVxyXG5cdFx0c3RhdGljIHdpcmVfb25jZSgpIHtcclxuXHRcdFx0aWYgKCBDb3JlLl9fc2VsZWN0YmFzZV93aXJlZCApIHJldHVybjtcclxuXHRcdFx0Q29yZS5fX3NlbGVjdGJhc2Vfd2lyZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0Y29uc3Qgb25fcmVhZHlfb3JfcmVuZGVyID0gKGV2KSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBldj8uZGV0YWlsPy5wYW5lbDtcclxuXHRcdFx0XHRjb25zdCBmaWVsZCA9IGV2Py5kZXRhaWw/LmVsIHx8IGV2Py5kZXRhaWw/LmZpZWxkIHx8IG51bGw7XHJcblx0XHRcdFx0aWYgKCAhcGFuZWwgKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCBmaWVsZCApIHBhbmVsLl9fc2VsZWN0YmFzZV9maWVsZCA9IGZpZWxkO1xyXG5cdFx0XHRcdHRoaXMuYm9vdHN0cmFwX3BhbmVsKCBwYW5lbCApO1xyXG5cdFx0XHRcdC8vIElmIHRoZSBpbnNwZWN0b3Igcm9vdCB3YXMgcmVtb3VudGVkLCBlbnN1cmUgcm9vdCBsaXN0ZW5lcnMgYXJlIChyZSlib3VuZC5cclxuXHRcdFx0XHR0aGlzLndpcmVfcm9vdF9saXN0ZW5lcnMoKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLCBvbl9yZWFkeV9vcl9yZW5kZXIgKTtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZW5kZXInLCBvbl9yZWFkeV9vcl9yZW5kZXIgKTtcclxuXHJcblx0XHRcdHRoaXMud2lyZV9yb290X2xpc3RlbmVycygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyB3aXJlX3Jvb3RfbGlzdGVuZXJzKCkge1xyXG5cclxuXHRcdFx0Ly8gSWYgYWxyZWFkeSB3aXJlZCBBTkQgdGhlIHN0b3JlZCByb290IGlzIHN0aWxsIGluIHRoZSBET00sIGJhaWwgb3V0LlxyXG5cdFx0XHRpZiAoIHRoaXMuX19yb290X3dpcmVkICYmIHRoaXMuX19yb290X25vZGU/LmlzQ29ubmVjdGVkICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0aWYgKCAhcm9vdCApIHtcclxuXHRcdFx0XHQvLyBSb290IG1pc3NpbmcgKGUuZy4sIFNQQSByZS1yZW5kZXIpIOKAlCBjbGVhciBmbGFncyBzbyB3ZSBjYW4gd2lyZSBsYXRlci5cclxuXHRcdFx0XHR0aGlzLl9fcm9vdF93aXJlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdHRoaXMuX19yb290X25vZGUgID0gbnVsbDtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX19yb290X25vZGUgICAgICAgICAgICAgICAgICAgPSByb290O1xyXG5cdFx0XHR0aGlzLl9fcm9vdF93aXJlZCAgICAgICAgICAgICAgICAgID0gdHJ1ZTtcclxuXHRcdFx0cm9vdC5kYXRhc2V0LnNlbGVjdGJhc2Vfcm9vdF93aXJlZCA9ICcxJztcclxuXHJcblx0XHRcdGNvbnN0IGdldF9wYW5lbCA9ICh0YXJnZXQpID0+XHJcblx0XHRcdFx0dGFyZ2V0Py5jbG9zZXN0Py4oICcud3BiY19iZmJfX2luc3BlY3Rvcl9fYm9keScgKSB8fFxyXG5cdFx0XHRcdHJvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApIHx8IG51bGw7XHJcblxyXG5cdFx0XHQvLyBDbGljayBoYW5kbGVyczogYWRkIC8gZGVsZXRlIC8gZHVwbGljYXRlXHJcblx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgKGUpID0+IHtcclxuXHRcdFx0XHRjb25zdCBwYW5lbCA9IGdldF9wYW5lbCggZS50YXJnZXQgKTtcclxuXHRcdFx0XHRpZiAoICFwYW5lbCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0dGhpcy5ib290c3RyYXBfcGFuZWwoIHBhbmVsICk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHVpID0gdGhpcy51aTtcclxuXHJcblx0XHRcdFx0Ly8gRXhpc3RpbmcgXCJBZGQgb3B0aW9uXCIgYnV0dG9uICh0b3AgdG9vbGJhcilcclxuXHRcdFx0XHRjb25zdCBhZGQgPSBlLnRhcmdldC5jbG9zZXN0Py4oIHVpLmFkZF9idG4gKTtcclxuXHRcdFx0XHRpZiAoIGFkZCApIHtcclxuXHRcdFx0XHRcdHRoaXMuYXBwZW5kX3JvdyggcGFuZWwsIHsgbGFiZWw6ICcnLCB2YWx1ZTogJycsIHNlbGVjdGVkOiBmYWxzZSB9ICk7XHJcblx0XHRcdFx0XHR0aGlzLmNvbW1pdF9vcHRpb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRHJvcGRvd24gbWVudSBhY3Rpb25zLlxyXG5cdFx0XHRcdGNvbnN0IG1lbnVfYWN0aW9uID0gZS50YXJnZXQuY2xvc2VzdD8uKCB1aS5tZW51X2FjdGlvbiApO1xyXG5cdFx0XHRcdGlmICggbWVudV9hY3Rpb24gKSB7XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cclxuXHRcdFx0XHRcdGNvbnN0IGFjdGlvbiA9IChtZW51X2FjdGlvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLWFjdGlvbicgKSB8fCAnJykudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0XHRcdGNvbnN0IHJvdyAgICA9IG1lbnVfYWN0aW9uLmNsb3Nlc3Q/LiggdWkucm93ICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhcm93ICkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmNsb3NlX2Ryb3Bkb3duKCBtZW51X2FjdGlvbiApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAnYWRkX2FmdGVyJyA9PT0gYWN0aW9uICkge1xyXG5cdFx0XHRcdFx0XHQvLyBBZGQgZW1wdHkgcm93IGFmdGVyIGN1cnJlbnRcclxuXHRcdFx0XHRcdFx0Y29uc3QgcHJldl9jb3VudCA9IHRoaXMuZ2V0X2xpc3QoIHBhbmVsICk/LmNoaWxkcmVuLmxlbmd0aCB8fCAwO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmFwcGVuZF9yb3coIHBhbmVsLCB7IGxhYmVsOiAnJywgdmFsdWU6ICcnLCBzZWxlY3RlZDogZmFsc2UgfSApO1xyXG5cdFx0XHRcdFx0XHQvLyBNb3ZlIHRoZSBuZXdseSBhZGRlZCBsYXN0IHJvdyBqdXN0IGFmdGVyIGN1cnJlbnQgcm93IHRvIHByZXNlcnZlIFwiYWRkIGFmdGVyXCJcclxuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdCA9IHRoaXMuZ2V0X2xpc3QoIHBhbmVsICk7XHJcblx0XHRcdFx0XHRcdGlmICggbGlzdCAmJiBsaXN0Lmxhc3RFbGVtZW50Q2hpbGQgJiYgbGlzdC5sYXN0RWxlbWVudENoaWxkICE9PSByb3cgKSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5pbnNlcnRfYWZ0ZXIoIGxpc3QubGFzdEVsZW1lbnRDaGlsZCwgcm93ICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0dGhpcy5jb21taXRfb3B0aW9ucyggcGFuZWwgKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggJ2R1cGxpY2F0ZScgPT09IGFjdGlvbiApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgbGJsID0gKHJvdy5xdWVyeVNlbGVjdG9yKCB1aS5sYWJlbCApIHx8IHt9KS52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdFx0Y29uc3QgdmFsID0gKHJvdy5xdWVyeVNlbGVjdG9yKCB1aS52YWx1ZSApIHx8IHt9KS52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdFx0Y29uc3Qgc2VsID0gISEoKHJvdy5xdWVyeVNlbGVjdG9yKCB1aS50b2dnbGUgKSB8fCB7fSkuY2hlY2tlZCk7XHJcblx0XHRcdFx0XHRcdHRoaXMuYXBwZW5kX3JvdyggcGFuZWwsIHsgbGFiZWw6IGxibCwgdmFsdWU6IHZhbCwgc2VsZWN0ZWQ6IHNlbCwgdWlkOiB0aGlzLm1ha2VfdWlkKCkgfSApO1xyXG5cdFx0XHRcdFx0XHQvLyBQbGFjZSB0aGUgbmV3IHJvdyByaWdodCBhZnRlciB0aGUgY3VycmVudC5cclxuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdCA9IHRoaXMuZ2V0X2xpc3QoIHBhbmVsICk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIGxpc3QgJiYgbGlzdC5sYXN0RWxlbWVudENoaWxkICYmIGxpc3QubGFzdEVsZW1lbnRDaGlsZCAhPT0gcm93ICkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuaW5zZXJ0X2FmdGVyKCBsaXN0Lmxhc3RFbGVtZW50Q2hpbGQsIHJvdyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHRoaXMuZW5mb3JjZV9zaW5nbGVfZGVmYXVsdCggcGFuZWwsIG51bGwgKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5jb21taXRfb3B0aW9ucyggcGFuZWwgKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggJ3JlbW92ZScgPT09IGFjdGlvbiApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCByb3cgJiYgcm93LnBhcmVudE5vZGUgKSByb3cucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggcm93ICk7XHJcblx0XHRcdFx0XHRcdHRoaXMuY29tbWl0X29wdGlvbnMoIHBhbmVsICk7XHJcblx0XHRcdFx0XHRcdHRoaXMuc3luY192YWx1ZV9pbnB1dHNfdmlzaWJpbGl0eSggcGFuZWwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR0aGlzLmNsb3NlX2Ryb3Bkb3duKCBtZW51X2FjdGlvbiApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHJcblxyXG5cdFx0XHQvLyBJbnB1dCBkZWxlZ2F0aW9uLlxyXG5cdFx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIChlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBnZXRfcGFuZWwoIGUudGFyZ2V0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHBhbmVsICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zdCB1aSAgICAgICAgICAgICAgICA9IHRoaXMudWk7XHJcblx0XHRcdFx0Y29uc3QgaXNfbGFiZWxfb3JfdmFsdWUgPSBlLnRhcmdldC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX29wdC1sYWJlbCcgKSB8fCBlLnRhcmdldC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX29wdC12YWx1ZScgKTtcclxuXHRcdFx0XHRjb25zdCBpc190b2dnbGUgICAgICAgICA9IGUudGFyZ2V0LmNsYXNzTGlzdD8uY29udGFpbnMoICd3cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoaycgKTtcclxuXHRcdFx0XHRjb25zdCBpc19tdWx0aXBsZSAgICAgICA9IGUudGFyZ2V0Lm1hdGNoZXM/LiggdWkubXVsdGlwbGVfY2hrICk7XHJcblx0XHRcdFx0Y29uc3QgaXNfZGVmYXVsdF90ZXh0ICAgPSBlLnRhcmdldC5tYXRjaGVzPy4oIHVpLmRlZmF1bHRfdGV4dCApO1xyXG5cdFx0XHRcdGNvbnN0IGlzX3ZhbHVlX2RpZmZlcnMgID0gZS50YXJnZXQubWF0Y2hlcz8uKCB1aS52YWx1ZV9kaWZmZXJzX2NoayApO1xyXG5cclxuXHRcdFx0XHQvLyBIYW5kbGUgXCJ2YWx1ZSBkaWZmZXJzXCIgdG9nZ2xlIGxpdmVcclxuXHRcdFx0XHRpZiAoIGlzX3ZhbHVlX2RpZmZlcnMgKSB7XHJcblx0XHRcdFx0XHR0aGlzLnN5bmNfdmFsdWVfaW5wdXRzX3Zpc2liaWxpdHkoIHBhbmVsICk7XHJcblx0XHRcdFx0XHR0aGlzLmNvbW1pdF9vcHRpb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gVHJhY2sgd2hlbiB0aGUgdXNlciBlZGl0cyBWQUxVRSBleHBsaWNpdGx5XHJcblx0XHRcdFx0aWYgKCBlLnRhcmdldC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX29wdC12YWx1ZScgKSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHJvdyA9IGUudGFyZ2V0LmNsb3Nlc3QoIHRoaXMudWkucm93ICk7XHJcblx0XHRcdFx0XHR0aGlzLm1hcmtfcm93X3ZhbHVlX3VzZXJfdG91Y2hlZCggcm93ICk7XHJcblx0XHRcdFx0XHQvLyBLZWVwIHRoZSBjYWNoZSB1cGRhdGVkIHNvIHRvZ2dsaW5nIE9GRi9PTiBsYXRlciByZXN0b3JlcyB0aGUgbGF0ZXN0IGN1c3RvbSB2YWx1ZVxyXG5cdFx0XHRcdFx0ZS50YXJnZXQuZGF0YXNldC5jYWNoZWRfdmFsdWUgPSBlLnRhcmdldC52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEF1dG8tZmlsbCBWQUxVRSBmcm9tIExBQkVMIGlmIHZhbHVlIGlzIGZyZXNoIChhbmQgZGlmZmVycyBpcyBPTik7IGlmIGRpZmZlcnMgaXMgT0ZGLCB3ZSBtaXJyb3IgYW55d2F5IGluIGNvbW1pdFxyXG5cdFx0XHRcdGlmICggZS50YXJnZXQuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19vcHQtbGFiZWwnICkgKSB7XHJcblx0XHRcdFx0XHRjb25zdCByb3cgICAgID0gZS50YXJnZXQuY2xvc2VzdCggdWkucm93ICk7XHJcblx0XHRcdFx0XHRjb25zdCB2YWxfaW4gID0gcm93Py5xdWVyeVNlbGVjdG9yKCB1aS52YWx1ZSApO1xyXG5cdFx0XHRcdFx0Y29uc3QgZGlmZmVycyA9IHRoaXMuaXNfdmFsdWVfZGlmZmVyc19lbmFibGVkKCBwYW5lbCApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggdmFsX2luICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoICFkaWZmZXJzICkge1xyXG5cdFx0XHRcdFx0XHRcdC8vIHNpbmdsZS1pbnB1dCBtb2RlOiBtaXJyb3IgaHVtYW4gbGFiZWwgd2l0aCBtaW5pbWFsIGVzY2FwaW5nXHJcblx0XHRcdFx0XHRcdFx0dmFsX2luLnZhbHVlID0gdGhpcy5idWlsZF92YWx1ZV9mcm9tX2xhYmVsKCBlLnRhcmdldC52YWx1ZSwgZmFsc2UgKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggIXRoaXMuaXNfcm93X3ZhbHVlX3VzZXJfdG91Y2hlZCggcm93ICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gc2VwYXJhdGUtdmFsdWUgbW9kZSwgb25seSB3aGlsZSBmcmVzaFxyXG5cdFx0XHRcdFx0XHRcdHZhbF9pbi52YWx1ZSA9IHRoaXMuYnVpbGRfdmFsdWVfZnJvbV9sYWJlbCggZS50YXJnZXQudmFsdWUsIHRydWUgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHRcdGlmICggaXNfbGFiZWxfb3JfdmFsdWUgfHwgaXNfdG9nZ2xlIHx8IGlzX211bHRpcGxlICkge1xyXG5cdFx0XHRcdFx0aWYgKCBpc190b2dnbGUgKSBlLnRhcmdldC5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCBlLnRhcmdldC5jaGVja2VkID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBpc190b2dnbGUgfHwgaXNfbXVsdGlwbGUgKSB0aGlzLmVuZm9yY2Vfc2luZ2xlX2RlZmF1bHQoIHBhbmVsLCBpc190b2dnbGUgPyBlLnRhcmdldCA6IG51bGwgKTtcclxuXHRcdFx0XHRcdHRoaXMuY29tbWl0X29wdGlvbnMoIHBhbmVsICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIGlzX2RlZmF1bHRfdGV4dCApIHtcclxuXHRcdFx0XHRcdHRoaXMuc3luY19kZWZhdWx0X3ZhbHVlX2xvY2soIHBhbmVsICk7XHJcblx0XHRcdFx0XHR0aGlzLnN5bmNfcGxhY2Vob2xkZXJfbG9jayggcGFuZWwgKTtcclxuXHRcdFx0XHRcdGNvbnN0IGhvbGRlciA9IHRoaXMuZ2V0X2hvbGRlciggcGFuZWwgKTtcclxuXHRcdFx0XHRcdGlmICggaG9sZGVyICkge1xyXG5cdFx0XHRcdFx0XHRob2xkZXIuZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KCAnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0XHRcdGhvbGRlci5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0cnVlICk7XHJcblxyXG5cclxuXHRcdFx0Ly8gQ2hhbmdlIGRlbGVnYXRpb25cclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgKGUpID0+IHtcclxuXHRcdFx0XHRjb25zdCBwYW5lbCA9IGdldF9wYW5lbCggZS50YXJnZXQgKTtcclxuXHRcdFx0XHRpZiAoICFwYW5lbCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Y29uc3QgdWkgICAgICAgID0gdGhpcy51aTtcclxuXHRcdFx0XHRjb25zdCBpc190b2dnbGUgPSBlLnRhcmdldC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX29wdC1zZWxlY3RlZC1jaGsnICk7XHJcblx0XHRcdFx0Y29uc3QgaXNfbXVsdGkgID0gZS50YXJnZXQubWF0Y2hlcz8uKCB1aS5tdWx0aXBsZV9jaGsgKTtcclxuXHRcdFx0XHRpZiAoICFpc190b2dnbGUgJiYgIWlzX211bHRpICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0XHRpZiAoIGlzX3RvZ2dsZSApIGUudGFyZ2V0LnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsIGUudGFyZ2V0LmNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0dGhpcy5lbmZvcmNlX3NpbmdsZV9kZWZhdWx0KCBwYW5lbCwgaXNfdG9nZ2xlID8gZS50YXJnZXQgOiBudWxsICk7XHJcblx0XHRcdFx0dGhpcy5jb21taXRfb3B0aW9ucyggcGFuZWwgKTtcclxuXHRcdFx0fSwgdHJ1ZSApO1xyXG5cclxuXHRcdFx0Ly8gTGF6eSBib290c3RyYXBcclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2VlbnRlcicsIChlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBnZXRfcGFuZWwoIGUudGFyZ2V0ICk7XHJcblx0XHRcdFx0aWYgKCBwYW5lbCAmJiBlLnRhcmdldD8uY2xvc2VzdD8uKCB0aGlzLnVpLmxpc3QgKSApIHRoaXMuYm9vdHN0cmFwX3BhbmVsKCBwYW5lbCApO1xyXG5cdFx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCAoZSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHBhbmVsID0gZ2V0X3BhbmVsKCBlLnRhcmdldCApO1xyXG5cdFx0XHRcdGlmICggcGFuZWwgJiYgZS50YXJnZXQ/LmNsb3Nlc3Q/LiggdGhpcy51aS5kcmFnX2hhbmRsZSApICkgdGhpcy5ib290c3RyYXBfcGFuZWwoIHBhbmVsICk7XHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0dHJ5IHsgQ29yZS5XUEJDX0JGQl9TZWxlY3RfQmFzZS53aXJlX29uY2UoKTsgfSBjYXRjaCAoXykge31cclxuXHQvLyBUcnkgaW1tZWRpYXRlbHkgKGlmIHJvb3QgaXMgYWxyZWFkeSBpbiBET00pLCB0aGVuIGFnYWluIG9uIERPTUNvbnRlbnRMb2FkZWQuXHJcblx0Q29yZS5XUEJDX0JGQl9TZWxlY3RfQmFzZS53aXJlX3Jvb3RfbGlzdGVuZXJzKCk7XHJcblxyXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiB7IENvcmUuV1BCQ19CRkJfU2VsZWN0X0Jhc2Uud2lyZV9yb290X2xpc3RlbmVycygpOyAgfSk7XHJcblxyXG59KCB3aW5kb3cgKSk7IiwiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fb3V0L2NvcmUvYmZiLXVpLmpzID09IHwgMjAyNS0wOS0xMCAxNTo0N1xyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvLyBTaW5nbGUgZ2xvYmFsIG5hbWVzcGFjZSAoaWRlbXBvdGVudCAmIGxvYWQtb3JkZXIgc2FmZSkuXHJcblx0Y29uc3QgQ29yZSA9ICh3LldQQkNfQkZCX0NvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwge30pO1xyXG5cdGNvbnN0IFVJICAgPSAoQ29yZS5VSSA9IENvcmUuVUkgfHwge30pO1xyXG5cclxuXHQvLyAtLS0gSGlnaGxpZ2h0IEVsZW1lbnQsICBsaWtlIEdlbmVyYXRvciBicm4gIC0gIFRpbnkgVUkgaGVscGVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRVSS5fcHVsc2VfdGltZXJzID0gVUkuX3B1bHNlX3RpbWVycyB8fCBuZXcgTWFwKCk7IC8vIGVsIC0+IHRpbWVyX2lkXHJcblx0VUkuX3B1bHNlX21ldGEgICA9IFVJLl9wdWxzZV9tZXRhICAgfHwgbmV3IE1hcCgpOyAvLyBlbCAtPiB7IHRva2VuLCBsYXN0X3RzLCBkZWJvdW5jZV9pZCwgY29sb3Jfc2V0IH1cclxuXHQvLyBQdWxzZSB0dW5pbmcgKG1pbGxpc2Vjb25kcykuXHJcblx0VUkuUFVMU0VfVEhST1RUTEVfTVMgID0gTnVtYmVyLmlzRmluaXRlKCBVSS5QVUxTRV9USFJPVFRMRV9NUyApID8gVUkuUFVMU0VfVEhST1RUTEVfTVMgOiA1MDA7XHJcblx0VUkuUFVMU0VfREVCT1VOQ0VfTVMgID0gTnVtYmVyLmlzRmluaXRlKCBVSS5QVUxTRV9ERUJPVU5DRV9NUyApID8gVUkuUFVMU0VfREVCT1VOQ0VfTVMgOiA3NTA7XHJcblxyXG5cdC8vIERlYm91bmNlIFNUUlVDVFVSRV9DSEFOR0UgZm9yIGNvbnRpbnVvdXMgaW5zcGVjdG9yIGNvbnRyb2xzIChzbGlkZXJzIC8gc2NydWJiaW5nKS5cclxuXHQvLyBUdW5lOiAxODAuLjM1MCBpcyB1c3VhbGx5IGEgc3dlZXQgc3BvdC5cclxuXHRVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TID0gTnVtYmVyLmlzRmluaXRlKCBVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TICkgPyBVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TIDogMTgwO1xyXG5cdC8vIENoYW5nZSB0aGlzIHRvIHR1bmUgc3BlZWQ6IDUwLi4xMjAgbXMgaXMgYSBnb29kIHJhbmdlLiBDYW4gYmUgY29uZmlndXJlZCBpbiA8ZGl2IGRhdGEtbGVuLWdyb3VwIGRhdGEtbGVuLXRocm90dGxlPVwiMTgwXCI+Li4uPC9kaXY+LlxyXG5cdFVJLlZBTFVFX1NMSURFUl9USFJPVFRMRV9NUyA9IE51bWJlci5pc0Zpbml0ZSggVUkuVkFMVUVfU0xJREVSX1RIUk9UVExFX01TICkgPyBVSS5WQUxVRV9TTElERVJfVEhST1RUTEVfTVMgOiAxMjA7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENhbmNlbCBhbnkgcnVubmluZyBwdWxzZSBzZXF1ZW5jZSBmb3IgYW4gZWxlbWVudC5cclxuXHQgKiBVc2VzIHRva2VuIGludmFsaWRhdGlvbiBzbyBhbHJlYWR5LXNjaGVkdWxlZCBjYWxsYmFja3MgYmVjb21lIG5vLW9wcy5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0ICovXHJcblx0VUkuY2FuY2VsX3B1bHNlID0gZnVuY3Rpb24gKGVsKSB7XHJcblx0XHRpZiAoICFlbCApIHsgcmV0dXJuOyB9XHJcblx0XHR0cnkge1xyXG5cdFx0XHRjbGVhclRpbWVvdXQoIFVJLl9wdWxzZV90aW1lcnMuZ2V0KCBlbCApICk7XHJcblx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHRVSS5fcHVsc2VfdGltZXJzLmRlbGV0ZSggZWwgKTtcclxuXHJcblx0XHR2YXIgbWV0YSA9IFVJLl9wdWxzZV9tZXRhLmdldCggZWwgKSB8fCB7fTtcclxuXHRcdG1ldGEudG9rZW4gPSAoTnVtYmVyLmlzRmluaXRlKCBtZXRhLnRva2VuICkgPyBtZXRhLnRva2VuIDogMCkgKyAxO1xyXG5cdFx0bWV0YS5jb2xvcl9zZXQgPSBmYWxzZTtcclxuXHRcdHRyeSB7IGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fc2Nyb2xsLXB1bHNlJywgJ3dwYmNfYmZiX19oaWdobGlnaHQtcHVsc2UnICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdHRyeSB7IGVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1wdWxzZS1jb2xvcicgKTsgfSBjYXRjaCAoIF8gKSB7fVxyXG5cdFx0VUkuX3B1bHNlX21ldGEuc2V0KCBlbCwgbWV0YSApO1xyXG5cdFx0dHJ5IHsgY2xlYXJUaW1lb3V0KCBtZXRhLmRlYm91bmNlX2lkICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdG1ldGEuZGVib3VuY2VfaWQgPSAwO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEZvcmNlLXJlc3RhcnQgYSBDU1MgYW5pbWF0aW9uIG9uIGEgY2xhc3MuXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gY2xzXHJcblx0ICovXHJcblx0VUkuX3Jlc3RhcnRfY3NzX2FuaW1hdGlvbiA9IGZ1bmN0aW9uIChlbCwgY2xzKSB7XHJcblx0XHRpZiAoICEgZWwgKSB7IHJldHVybjsgfVxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0ZWwuY2xhc3NMaXN0LnJlbW92ZSggY2xzICk7XHJcblx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHQvLyBGb3JjZSByZWZsb3cgc28gdGhlIG5leHQgYWRkKCkgcmV0cmlnZ2VycyB0aGUga2V5ZnJhbWVzLlxyXG5cdFx0dm9pZCBlbC5vZmZzZXRXaWR0aDtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGVsLmNsYXNzTGlzdC5hZGQoIGNscyApO1xyXG5cdFx0fSBjYXRjaCAoIF8gKSB7fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdFx0U2luZ2xlIHB1bHNlIChiYWNrLWNvbXBhdCkuXHJcblx0XHRAcGFyYW0ge0hUTUxFbGVtZW50fSBlbFxyXG5cdFx0QHBhcmFtIHtudW1iZXJ9IGR1cl9tc1xyXG5cdCAqL1xyXG5cdFVJLnB1bHNlX29uY2UgPSBmdW5jdGlvbiAoZWwsIGR1cl9tcykge1xyXG5cdFx0aWYgKCAhIGVsICkgeyByZXR1cm47IH1cclxuXHRcdHZhciBjbHMgPSAnd3BiY19iZmJfX3Njcm9sbC1wdWxzZSc7XHJcblx0XHR2YXIgbXMgID0gTnVtYmVyLmlzRmluaXRlKCBkdXJfbXMgKSA/IGR1cl9tcyA6IDcwMDtcclxuXHJcblx0XHRVSS5jYW5jZWxfcHVsc2UoIGVsICk7XHJcblxyXG5cdFx0dmFyIG1ldGEgID0gVUkuX3B1bHNlX21ldGEuZ2V0KCBlbCApIHx8IHt9O1xyXG5cdFx0dmFyIHRva2VuID0gKE51bWJlci5pc0Zpbml0ZSggbWV0YS50b2tlbiApID8gbWV0YS50b2tlbiA6IDApICsgMTtcclxuXHRcdG1ldGEudG9rZW4gPSB0b2tlbjtcclxuXHRcdFVJLl9wdWxzZV9tZXRhLnNldCggZWwsIG1ldGEgKTtcclxuXHJcblx0XHRVSS5fcmVzdGFydF9jc3NfYW5pbWF0aW9uKCBlbCwgY2xzICk7XHJcblx0XHR2YXIgdCA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gaWdub3JlIGlmIGEgbmV3ZXIgcHVsc2Ugc3RhcnRlZC5cclxuXHRcdFx0dmFyIG0gPSBVSS5fcHVsc2VfbWV0YS5nZXQoIGVsICkgfHwge307XHJcblx0XHRcdGlmICggbS50b2tlbiAhPT0gdG9rZW4gKSB7IHJldHVybjsgfVxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUoIGNscyApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHRcdFVJLl9wdWxzZV90aW1lcnMuZGVsZXRlKCBlbCApO1xyXG5cdFx0fSwgbXMgKTtcclxuXHRcdFVJLl9wdWxzZV90aW1lcnMuc2V0KCBlbCwgdCApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdFx0TXVsdGktYmxpbmsgc2VxdWVuY2Ugd2l0aCBvcHRpb25hbCBwZXItY2FsbCBjb2xvciBvdmVycmlkZS5cclxuXHRcdEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHRAcGFyYW0ge251bWJlcn0gW3RpbWVzPTNdXHJcblx0XHRAcGFyYW0ge251bWJlcn0gW29uX21zPTI4MF1cclxuXHRcdEBwYXJhbSB7bnVtYmVyfSBbb2ZmX21zPTE4MF1cclxuXHRcdEBwYXJhbSB7c3RyaW5nfSBbaGV4X2NvbG9yXSBPcHRpb25hbCBDU1MgY29sb3IgKGUuZy4gJyNmZjRkNGYnIG9yICdyZ2IoLi4uKScpLlxyXG5cdCAqL1xyXG5cdFVJLnB1bHNlX3NlcXVlbmNlID0gZnVuY3Rpb24gKGVsLCB0aW1lcywgb25fbXMsIG9mZl9tcywgaGV4X2NvbG9yKSB7XHJcblx0XHRpZiAoICFlbCB8fCAhZC5ib2R5LmNvbnRhaW5zKCBlbCApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgY2xzICAgPSAnd3BiY19iZmJfX2hpZ2hsaWdodC1wdWxzZSc7XHJcblx0XHR2YXIgY291bnQgPSBOdW1iZXIuaXNGaW5pdGUoIHRpbWVzICkgPyB0aW1lcyA6IDI7XHJcblx0XHR2YXIgb24gICAgPSBOdW1iZXIuaXNGaW5pdGUoIG9uX21zICkgPyBvbl9tcyA6IDI4MDtcclxuXHRcdHZhciBvZmYgICA9IE51bWJlci5pc0Zpbml0ZSggb2ZmX21zICkgPyBvZmZfbXMgOiAxODA7XHJcblxyXG5cdFx0Ly8gVGhyb3R0bGU6IGF2b2lkIHJlZmxvdyBzcGFtIGlmIGNhbGxlZCByZXBlYXRlZGx5IHdoaWxlIHR5cGluZy9kcmFnZ2luZy5cclxuXHRcdHZhciBtZXRhID0gVUkuX3B1bHNlX21ldGEuZ2V0KCBlbCApIHx8IHt9O1xyXG5cdFx0dmFyIG5vdyAgPSBEYXRlLm5vdygpO1xyXG5cdFx0dmFyIHRocm90dGxlX21zID0gTnVtYmVyLmlzRmluaXRlKCBVSS5QVUxTRV9USFJPVFRMRV9NUyApID8gVUkuUFVMU0VfVEhST1RUTEVfTVMgOiAxMjA7XHJcblx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggbWV0YS5sYXN0X3RzICkgJiYgKG5vdyAtIG1ldGEubGFzdF90cykgPCB0aHJvdHRsZV9tcyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0bWV0YS5sYXN0X3RzID0gbm93O1xyXG5cclxuXHRcdC8vIGNhbmNlbCBhbnkgcnVubmluZyBwdWxzZSBhbmQgcmVzZXQgY2xhc3MgKHRva2VuIGludmFsaWRhdGlvbikuXHJcblx0XHRVSS5jYW5jZWxfcHVsc2UoIGVsICk7XHJcblxyXG5cdFx0Ly8gbmV3IHRva2VuIGZvciB0aGlzIHJ1blxyXG5cdFx0dmFyIHRva2VuID0gKE51bWJlci5pc0Zpbml0ZSggbWV0YS50b2tlbiApID8gbWV0YS50b2tlbiA6IDApICsgMTtcclxuXHRcdG1ldGEudG9rZW4gPSB0b2tlbjtcclxuXHJcblx0XHR2YXIgaGF2ZV9jb2xvciA9ICEhaGV4X2NvbG9yICYmIHR5cGVvZiBoZXhfY29sb3IgPT09ICdzdHJpbmcnO1xyXG5cdFx0aWYgKCBoYXZlX2NvbG9yICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWJmYi1wdWxzZS1jb2xvcicsIGhleF9jb2xvciApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHRcdG1ldGEuY29sb3Jfc2V0ID0gdHJ1ZTtcclxuXHRcdH1cclxuXHRcdFVJLl9wdWxzZV9tZXRhLnNldCggZWwsIG1ldGEgKTtcclxuXHJcblx0XHR2YXIgaSA9IDA7XHJcblx0XHQoZnVuY3Rpb24gdGljaygpIHtcclxuXHRcdFx0dmFyIG0gPSBVSS5fcHVsc2VfbWV0YS5nZXQoIGVsICkgfHwge307XHJcblx0XHRcdGlmICggbS50b2tlbiAhPT0gdG9rZW4gKSB7XHJcblx0XHRcdFx0Ly8gY2FuY2VsZWQvcmVwbGFjZWRcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBpID49IGNvdW50ICkge1xyXG5cdFx0XHRcdFVJLl9wdWxzZV90aW1lcnMuZGVsZXRlKCBlbCApO1xyXG5cdFx0XHRcdGlmICggaGF2ZV9jb2xvciApIHtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdGVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1wdWxzZS1jb2xvcicgKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfICkge31cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdFVJLl9yZXN0YXJ0X2Nzc19hbmltYXRpb24oIGVsLCBjbHMgKTtcclxuXHRcdFx0VUkuX3B1bHNlX3RpbWVycy5zZXQoIGVsLCBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7ICAgICAvLyBPTiAtPiBPRkZcclxuXHRcdFx0XHR2YXIgbTIgPSBVSS5fcHVsc2VfbWV0YS5nZXQoIGVsICkgfHwge307XHJcblx0XHRcdFx0aWYgKCBtMi50b2tlbiAhPT0gdG9rZW4gKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRlbC5jbGFzc0xpc3QucmVtb3ZlKCBjbHMgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0VUkuX3B1bHNlX3RpbWVycy5zZXQoIGVsLCBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7IC8vIE9GRiBnYXAgLT4gbmV4dFxyXG5cdFx0XHRcdFx0dmFyIG0zID0gVUkuX3B1bHNlX21ldGEuZ2V0KCBlbCApIHx8IHt9O1xyXG5cdFx0XHRcdFx0aWYgKCBtMy50b2tlbiAhPT0gdG9rZW4gKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdFx0aSsrO1xyXG5cdFx0XHRcdFx0dGljaygpO1xyXG5cdFx0XHRcdH0sIG9mZiApICk7XHJcblx0XHRcdH0sIG9uICkgKTtcclxuXHRcdH0pKCk7XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlYm91bmNlZCBxdWVyeSArIHB1bHNlLlxyXG5cdCAqIFVzZWZ1bCBmb3IgYGlucHV0YCBldmVudHMgKHNsaWRlcnMgLyB0eXBpbmcpIHRvIGF2b2lkIGZvcmNlZCByZWZsb3cgc3BhbS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8c3RyaW5nfSByb290X29yX3NlbGVjdG9yXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IHdhaXRfbXNcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gW2FdXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IFtiXVxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBbY11cclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gW2NvbG9yXVxyXG5cdCAqL1xyXG5cdFVJLnB1bHNlX3F1ZXJ5X2RlYm91bmNlZCA9IGZ1bmN0aW9uIChyb290X29yX3NlbGVjdG9yLCBzZWxlY3Rvciwgd2FpdF9tcywgYSwgYiwgYywgY29sb3IpIHtcclxuXHRcdHZhciByb290ID0gKHR5cGVvZiByb290X29yX3NlbGVjdG9yID09PSAnc3RyaW5nJykgPyBkIDogKHJvb3Rfb3Jfc2VsZWN0b3IgfHwgZCk7XHJcblx0XHR2YXIgc2VsICA9ICh0eXBlb2Ygcm9vdF9vcl9zZWxlY3RvciA9PT0gJ3N0cmluZycpID8gcm9vdF9vcl9zZWxlY3RvciA6IHNlbGVjdG9yO1xyXG5cdFx0aWYgKCAhc2VsICkgeyByZXR1cm47IH1cclxuXHRcdHZhciBlbCA9IHJvb3QucXVlcnlTZWxlY3Rvciggc2VsICk7XHJcblx0XHRpZiAoICFlbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIGRlZl9tcyA9IE51bWJlci5pc0Zpbml0ZSggVUkuUFVMU0VfREVCT1VOQ0VfTVMgKSA/IFVJLlBVTFNFX0RFQk9VTkNFX01TIDogMTIwO1xyXG5cdFx0dmFyIG1zICAgICA9IE51bWJlci5pc0Zpbml0ZSggd2FpdF9tcyApID8gd2FpdF9tcyA6IGRlZl9tcztcclxuXHRcdHZhciBtZXRhID0gVUkuX3B1bHNlX21ldGEuZ2V0KCBlbCApIHx8IHt9O1xyXG5cdFx0dHJ5IHsgY2xlYXJUaW1lb3V0KCBtZXRhLmRlYm91bmNlX2lkICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdG1ldGEuZGVib3VuY2VfaWQgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFVJLnB1bHNlX3NlcXVlbmNlKCBlbCwgYSwgYiwgYywgY29sb3IgKTtcclxuXHRcdH0sIG1zICk7XHJcblx0XHRVSS5fcHVsc2VfbWV0YS5zZXQoIGVsLCBtZXRhICk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0XHRRdWVyeSArIHB1bHNlOlxyXG5cdFx0KEJDKSBJZiBvbmx5IDNyZCBhcmcgaXMgYSBudW1iZXIgYW5kIG5vIDR0aC81dGggLT4gc2luZ2xlIGxvbmcgcHVsc2UuXHJcblx0XHRPdGhlcndpc2UgLT4gc3Ryb25nIHNlcXVlbmNlIChkZWZhdWx0cyAzw5cyODAvMTgwKS5cclxuXHRcdE9wdGlvbmFsIDZ0aCBhcmc6IGNvbG9yLlxyXG5cdFx0QHBhcmFtIHtIVE1MRWxlbWVudHxzdHJpbmd9IHJvb3Rfb3Jfc2VsZWN0b3JcclxuXHRcdEBwYXJhbSB7c3RyaW5nfSBbc2VsZWN0b3JdXHJcblx0XHRAcGFyYW0ge251bWJlcn0gW2FdXHJcblx0XHRAcGFyYW0ge251bWJlcn0gW2JdXHJcblxyXG5cdFx0QHBhcmFtIHtudW1iZXJ9IFtjXVxyXG5cclxuXHRcdEBwYXJhbSB7c3RyaW5nfSBbY29sb3JdXHJcblx0ICovXHJcblx0VUkucHVsc2VfcXVlcnkgPSBmdW5jdGlvbiAocm9vdF9vcl9zZWxlY3Rvciwgc2VsZWN0b3IsIGEsIGIsIGMsIGNvbG9yKSB7XHJcblx0XHR2YXIgcm9vdCA9ICh0eXBlb2Ygcm9vdF9vcl9zZWxlY3RvciA9PT0gJ3N0cmluZycpID8gZCA6IChyb290X29yX3NlbGVjdG9yIHx8IGQpO1xyXG5cdFx0dmFyIHNlbCAgPSAodHlwZW9mIHJvb3Rfb3Jfc2VsZWN0b3IgPT09ICdzdHJpbmcnKSA/IHJvb3Rfb3Jfc2VsZWN0b3IgOiBzZWxlY3RvcjtcclxuXHRcdGlmICggIXNlbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBlbCA9IHJvb3QucXVlcnlTZWxlY3Rvciggc2VsICk7XHJcblx0XHRpZiAoICFlbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuLy8gQmFjay1jb21wYXQ6IFVJLnB1bHNlUXVlcnkocm9vdCwgc2VsLCBkdXJfbXMpXHJcblx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggYSApICYmIGIgPT09IHVuZGVmaW5lZCAmJiBjID09PSB1bmRlZmluZWQgKSB7XHJcblx0XHRcdHJldHVybiBVSS5wdWxzZV9vbmNlKCBlbCwgYSApO1xyXG5cdFx0fVxyXG4vLyBOZXc6IHNlcXVlbmNlOyBwYXJhbXMgb3B0aW9uYWw7IHN1cHBvcnRzIG9wdGlvbmFsIGNvbG9yLlxyXG5cdFx0VUkucHVsc2Vfc2VxdWVuY2UoIGVsLCBhLCBiLCBjLCBjb2xvciApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdENvbnZlbmllbmNlIGhlbHBlciAoc25ha2VfY2FzZSkgdG8gY2FsbCBhIHN0cm9uZyBwdWxzZSB3aXRoIG9wdGlvbnMuXHJcblxyXG5cdEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblxyXG5cdEBwYXJhbSB7T2JqZWN0fSBbb3B0c11cclxuXHJcblx0QHBhcmFtIHtudW1iZXJ9IFtvcHRzLnRpbWVzPTNdXHJcblxyXG5cdEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5vbl9tcz0yODBdXHJcblxyXG5cdEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5vZmZfbXM9MTgwXVxyXG5cclxuXHRAcGFyYW0ge3N0cmluZ30gW29wdHMuY29sb3JdXHJcblx0ICovXHJcblx0VUkucHVsc2Vfc2VxdWVuY2Vfc3Ryb25nID0gZnVuY3Rpb24gKGVsLCBvcHRzKSB7XHJcblx0XHRvcHRzID0gb3B0cyB8fCB7fTtcclxuXHRcdFVJLnB1bHNlX3NlcXVlbmNlKFxyXG5cdFx0XHRlbCxcclxuXHRcdFx0TnVtYmVyLmlzRmluaXRlKCBvcHRzLnRpbWVzICkgPyBvcHRzLnRpbWVzIDogMyxcclxuXHRcdFx0TnVtYmVyLmlzRmluaXRlKCBvcHRzLm9uX21zICkgPyBvcHRzLm9uX21zIDogMjgwLFxyXG5cdFx0XHROdW1iZXIuaXNGaW5pdGUoIG9wdHMub2ZmX21zICkgPyBvcHRzLm9mZl9tcyA6IDE4MCxcclxuXHRcdFx0b3B0cy5jb2xvclxyXG5cdFx0KTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQmFzZSBjbGFzcyBmb3IgQkZCIG1vZHVsZXMuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfTW9kdWxlID0gY2xhc3Mge1xyXG5cdFx0LyoqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXIgKi9cclxuXHRcdGNvbnN0cnVjdG9yKGJ1aWxkZXIpIHtcclxuXHRcdFx0dGhpcy5idWlsZGVyID0gYnVpbGRlcjtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogSW5pdGlhbGl6ZSB0aGUgbW9kdWxlLiAqL1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQ2xlYW51cCB0aGUgbW9kdWxlLiAqL1xyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDZW50cmFsIG92ZXJsYXkvY29udHJvbHMgbWFuYWdlciBmb3IgZmllbGRzL3NlY3Rpb25zLlxyXG5cdCAqIFB1cmUgVUkgY29tcG9zaXRpb247IGFsbCBhY3Rpb25zIHJvdXRlIGJhY2sgaW50byB0aGUgYnVpbGRlciBpbnN0YW5jZS5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9PdmVybGF5ID0gY2xhc3Mge1xuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgZXZlcnkgb3ZlcmxheSBzZXR0aW5ncyBidXR0b24gd2l0aCB0aGUgcmVhbCBJbnNwZWN0b3Igc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBBIHNlbGVjdGVkIGNhbnZhcyBpdGVtIGNhbiByZW1haW4gc2VsZWN0ZWQgd2hpbGUgYW5vdGhlciByaWdodC1iYXIgcGFuZWwgaXNcblx0XHQgKiB2aXNpYmxlLiBDb21iaW5pbmcgYm90aCBzdGF0ZXMgcHJldmVudHMgYSBzdGFsZSBwcmVzc2VkIGJ1dHRvbiBhZnRlciB0aGVcblx0XHQgKiBhZG1pbmlzdHJhdG9yIHN3aXRjaGVzIGF3YXkgZnJvbSB0aGUgSW5zcGVjdG9yLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtXUEJDX0Zvcm1fQnVpbGRlcn0gYnVpbGRlciAtIEFjdGl2ZSBGb3JtIEJ1aWxkZXIgaW5zdGFuY2UuXG5cdFx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudFtdfE5vZGVMaXN0T2Y8SFRNTEJ1dHRvbkVsZW1lbnQ+fG51bGx9IFtzZXR0aW5nc19idXR0b25zPW51bGxdXG5cdFx0ICogICAgIE9wdGlvbmFsIGJvdW5kZWQgY29udHJvbHMgdG8gcmVjb25jaWxlIGR1cmluZyBpbmNyZW1lbnRhbCByZW5kZXJpbmcuXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XG5cdFx0ICovXG5cdFx0c3RhdGljIHN5bmNfc2V0dGluZ3NfYnV0dG9uX3N0YXRlcyhidWlsZGVyLCBzZXR0aW5nc19idXR0b25zID0gbnVsbCkge1xuXG5cdFx0XHRjb25zdCBwYWdlc19jb250YWluZXIgPSBidWlsZGVyPy5wYWdlc19jb250YWluZXI7XG5cdFx0XHRpZiAoICFwYWdlc19jb250YWluZXI/LnF1ZXJ5U2VsZWN0b3JBbGwgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaW5zcGVjdG9yICAgICAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICk7XG5cdFx0XHRjb25zdCBpbnNwZWN0b3JfaXNfb3BlbiA9ICEhaW5zcGVjdG9yXG5cdFx0XHRcdCYmICFpbnNwZWN0b3IuaGFzQXR0cmlidXRlKCAnaGlkZGVuJyApXG5cdFx0XHRcdCYmIGluc3BlY3Rvci5nZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicgKSAhPT0gJ3RydWUnO1xuXHRcdFx0Y29uc3Qgc2VsZWN0YWJsZV9xdWVyeSAgPSBgJHtDb3JlLldQQkNfQkZCX0RPTS5TRUxFQ1RPUlMuZmllbGR9LCAke0NvcmUuV1BCQ19CRkJfRE9NLlNFTEVDVE9SUy5zZWN0aW9ufWA7XG5cblx0XHRcdGNvbnN0IGJ1dHRvbnMgPSBzZXR0aW5nc19idXR0b25zIHx8IHBhZ2VzX2NvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19zZXR0aW5ncy1idG4nICk7XG5cblx0XHRcdEFycmF5LmZyb20oIGJ1dHRvbnMgKS5mb3JFYWNoKCAoc2V0dGluZ3NfYnV0dG9uKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG93bmVyICAgICAgPSBzZXR0aW5nc19idXR0b24uY2xvc2VzdCggc2VsZWN0YWJsZV9xdWVyeSApO1xuXHRcdFx0XHRjb25zdCBpc19wcmVzc2VkID0gaW5zcGVjdG9yX2lzX29wZW5cblx0XHRcdFx0XHQmJiAhIW93bmVyPy5jbGFzc0xpc3Q/LmNvbnRhaW5zKCBDb3JlLldQQkNfQkZCX0RPTS5DTEFTU0VTLnNlbGVjdGVkICk7XG5cblx0XHRcdFx0c2V0dGluZ3NfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtcHJlc3NlZCcsIGlzX3ByZXNzZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRW5zdXJlIGFuIG92ZXJsYXkgZXhpc3RzIGFuZCBpcyB3aXJlZCB1cCBvbiB0aGUgZWxlbWVudC5cblx0XHQgKiBAcGFyYW0ge1dQQkNfRm9ybV9CdWlsZGVyfSBidWlsZGVyXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCAtIGZpZWxkIG9yIHNlY3Rpb24gZWxlbWVudFxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZW5zdXJlKGJ1aWxkZXIsIGVsKSB7XHJcblxyXG5cdFx0XHRpZiAoICFlbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgaXNTZWN0aW9uID0gZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICk7XHJcblxyXG5cdFx0XHQvLyBsZXQgb3ZlcmxheSA9IGVsLnF1ZXJ5U2VsZWN0b3IoIENvcmUuV1BCQ19CRkJfRE9NLlNFTEVDVE9SUy5vdmVybGF5ICk7XHJcblx0XHRcdGxldCBvdmVybGF5ID0gZWwucXVlcnlTZWxlY3RvciggYDpzY29wZSA+ICR7Q29yZS5XUEJDX0JGQl9ET00uU0VMRUNUT1JTLm92ZXJsYXl9YCApO1xyXG5cdFx0XHRpZiAoICFvdmVybGF5ICkge1xyXG5cdFx0XHRcdG92ZXJsYXkgPSBDb3JlLldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ2RpdicsICd3cGJjX2JmYl9fb3ZlcmxheS1jb250cm9scycgKTtcclxuXHRcdFx0XHRlbC5wcmVwZW5kKCBvdmVybGF5ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIERyYWcgaGFuZGxlLlxyXG5cdFx0XHRpZiAoICFvdmVybGF5LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2RyYWctaGFuZGxlJyApICkge1xyXG5cdFx0XHRcdGNvbnN0IGRyYWdDbGFzcyA9IGlzU2VjdGlvbiA/ICd3cGJjX2JmYl9fZHJhZy1oYW5kbGUgc2VjdGlvbi1kcmFnLWhhbmRsZScgOiAnd3BiY19iZmJfX2RyYWctaGFuZGxlJztcclxuXHRcdFx0XHRvdmVybGF5LmFwcGVuZENoaWxkKFxyXG5cdFx0XHRcdFx0Q29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdzcGFuJywgZHJhZ0NsYXNzLCAnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9kcmFnX2luZGljYXRvclwiPjwvc3Bhbj4nIClcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XG5cblx0XHRcdC8vIFNFVFRJTkdTIGJ1dHRvbiAoc2hvd24gZm9yIGJvdGggZmllbGRzICYgc2VjdGlvbnMpLlxuXHRcdFx0bGV0IHNldHRpbmdzX2J0biA9IG92ZXJsYXkucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fc2V0dGluZ3MtYnRuJyApO1xuXHRcdFx0aWYgKCAhc2V0dGluZ3NfYnRuICkge1xuXHRcdFx0XHRzZXR0aW5nc19idG4gICAgICAgICA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnYnV0dG9uJywgJ3dwYmNfYmZiX19zZXR0aW5ncy1idG4nLCAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9uZWFyX21lIHdwYmNfaWNuX3JvdGF0ZV8yNzBcIj48L2k+JyApO1xuXHRcdFx0XHRzZXR0aW5nc19idG4udHlwZSAgICA9ICdidXR0b24nO1xuXHRcdFx0XHRzZXR0aW5nc19idG4udGl0bGUgICA9ICdPcGVuIHNldHRpbmdzJztcblx0XHRcdFx0c2V0dGluZ3NfYnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBzZXR0aW5nc19idG4udGl0bGUgKTtcblx0XHRcdFx0c2V0dGluZ3NfYnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtY29udHJvbHMnLCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcblx0XHRcdFx0c2V0dGluZ3NfYnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtcHJlc3NlZCcsICdmYWxzZScgKTtcblx0XHRcdFx0c2V0dGluZ3NfYnRuLm9uY2xpY2sgPSAoZSkgPT4ge1xuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdC8vIFNlbGVjdCBUSElTIGVsZW1lbnQgYW5kIHNjcm9sbCBpdCBpbnRvIHZpZXcuXHJcblx0XHRcdFx0XHRidWlsZGVyLnNlbGVjdF9maWVsZCggZWwsIHsgc2Nyb2xsSW50b1ZpZXc6IHRydWUgfSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEF1dG8tb3BlbiBJbnNwZWN0b3IgZnJvbSB0aGUgb3ZlcmxheSDigJxTZXR0aW5nc+KAnSBidXR0b24uXHJcblx0XHRcdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZShcclxuXHRcdFx0XHRcdFx0J3dwYmNfYmZiOnNob3dfcGFuZWwnLFxyXG5cdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0cGFuZWxfaWQ6ICd3cGJjX2JmYl9faW5zcGVjdG9yJyxcclxuXHRcdFx0XHRcdFx0XHR0YWJfaWQgIDogJ3dwYmNfdGFiX2luc3BlY3RvcidcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0XHQvLyBUcnkgdG8gYnJpbmcgdGhlIGluc3BlY3RvciBpbnRvIHZpZXcgLyBmb2N1cyBmaXJzdCBpbnB1dC5cclxuXHRcdFx0XHRcdGNvbnN0IGlucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0XHRcdGlmICggaW5zICkge1xyXG5cdFx0XHRcdFx0XHRpbnMuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ25lYXJlc3QnIH0gKTtcclxuXHRcdFx0XHRcdFx0Ly8gRm9jdXMgZmlyc3QgaW50ZXJhY3RpdmUgY29udHJvbCAoYmVzdC1lZmZvcnQpLlxyXG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgZm9jdXNhYmxlID0gaW5zLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dCxzZWxlY3QsdGV4dGFyZWEsYnV0dG9uLFtjb250ZW50ZWRpdGFibGVdLFt0YWJpbmRleF06bm90KFt0YWJpbmRleD1cIi0xXCJdKScgKTtcclxuXHRcdFx0XHRcdFx0XHRmb2N1c2FibGU/LmZvY3VzPy4oKTtcclxuXHRcdFx0XHRcdFx0fSwgMjYwICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0b3ZlcmxheS5hcHBlbmRDaGlsZCggc2V0dGluZ3NfYnRuICk7XHJcblx0XHRcdH1cclxuXG5cdFx0XHRvdmVybGF5LnNldEF0dHJpYnV0ZSggJ3JvbGUnLCAndG9vbGJhcicgKTtcblx0XHRcdG92ZXJsYXkuc2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbCcsIGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApID8gJ1NlY3Rpb24gdG9vbHMnIDogJ0ZpZWxkIHRvb2xzJyApO1xuXHRcdFx0VUkuV1BCQ19CRkJfT3ZlcmxheS5zeW5jX3NldHRpbmdzX2J1dHRvbl9zdGF0ZXMoIGJ1aWxkZXIsIFsgc2V0dGluZ3NfYnRuIF0gKTtcblxuXHRcdFx0cmV0dXJuIG92ZXJsYXk7XG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkMgTGF5b3V0IENoaXBzIGhlbHBlciAtIHZpc3VhbCBsYXlvdXQgcGlja2VyIChjaGlwcyksIGUuZy4sIFwiNTAlLzUwJVwiLCB0byBhIHNlY3Rpb24gb3ZlcmxheS5cclxuXHQgKlxyXG5cdCAqIFJlbmRlcnMgRXF1YWwvUHJlc2V0cy9DdXN0b20gY2hpcHMgaW50byBhIGhvc3QgY29udGFpbmVyIGFuZCB3aXJlcyB0aGVtIHRvIGFwcGx5IHRoZSBsYXlvdXQuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzID0gY2xhc3Mge1xyXG5cclxuXHRcdC8qKiBSZWFkIHBlci1jb2x1bW4gbWluIChweCkgZnJvbSBDU1MgdmFyIHNldCBieSB0aGUgZ3VhcmQuICovXHJcblx0XHRzdGF0aWMgX2dldF9jb2xfbWluX3B4KGNvbCkge1xyXG5cdFx0XHRjb25zdCB2ID0gZ2V0Q29tcHV0ZWRTdHlsZSggY29sICkuZ2V0UHJvcGVydHlWYWx1ZSggJy0td3BiYy1jb2wtbWluJyApIHx8ICcwJztcclxuXHRcdFx0Y29uc3QgbiA9IHBhcnNlRmxvYXQoIHYgKTtcclxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gTWF0aC5tYXgoIDAsIG4gKSA6IDA7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUdXJuIHJhdyB3ZWlnaHRzIChlLmcuIFsxLDFdLCBbMiwxLDFdKSBpbnRvIGVmZmVjdGl2ZSBcImF2YWlsYWJsZS0lXCIgYmFzZXMgdGhhdFxyXG5cdFx0ICogKGEpIHN1bSB0byB0aGUgcm93J3MgYXZhaWxhYmxlICUsIGFuZCAoYikgbWVldCBldmVyeSBjb2x1bW4ncyBtaW4gcHguXHJcblx0XHQgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGJhc2VzIChudW1iZXJzKSBvciBudWxsIGlmIGltcG9zc2libGUgdG8gc2F0aXNmeSBtaW5zLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgX2ZpdF93ZWlnaHRzX3Jlc3BlY3RpbmdfbWluKGJ1aWxkZXIsIHJvdywgd2VpZ2h0cykge1xyXG5cdFx0XHRjb25zdCBjb2xzID0gQXJyYXkuZnJvbSggcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSApO1xyXG5cdFx0XHRjb25zdCBuICAgID0gY29scy5sZW5ndGg7XHJcblx0XHRcdGlmICggIW4gKSByZXR1cm4gbnVsbDtcclxuXHRcdFx0aWYgKCAhQXJyYXkuaXNBcnJheSggd2VpZ2h0cyApIHx8IHdlaWdodHMubGVuZ3RoICE9PSBuICkgcmV0dXJuIG51bGw7XHJcblxyXG5cdFx0XHQvLyBhdmFpbGFibGUgJSBhZnRlciBnYXBzIChmcm9tIExheW91dFNlcnZpY2UpXHJcblx0XHRcdGNvbnN0IGdwICAgICAgID0gYnVpbGRlci5jb2xfZ2FwX3BlcmNlbnQ7XHJcblx0XHRcdGNvbnN0IGVmZiAgICAgID0gYnVpbGRlci5sYXlvdXQuY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3coIHJvdywgZ3AgKTtcclxuXHRcdFx0Y29uc3QgYXZhaWxQY3QgPSBlZmYuYXZhaWxhYmxlOyAgICAgICAgICAgICAgIC8vIGUuZy4gOTQgaWYgMiBjb2xzIGFuZCAzJSBnYXBcclxuXHRcdFx0Y29uc3Qgcm93UHggICAgPSByb3cuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XHJcblx0XHRcdGNvbnN0IGF2YWlsUHggID0gcm93UHggKiAoYXZhaWxQY3QgLyAxMDApO1xyXG5cclxuXHRcdFx0Ly8gY29sbGVjdCBtaW5pbWEgaW4gJSBvZiBcImF2YWlsYWJsZVwiXHJcblx0XHRcdGNvbnN0IG1pblBjdCA9IGNvbHMubWFwKCAoYykgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IG1pblB4ID0gVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLl9nZXRfY29sX21pbl9weCggYyApO1xyXG5cdFx0XHRcdGlmICggYXZhaWxQeCA8PSAwICkgcmV0dXJuIDA7XHJcblx0XHRcdFx0cmV0dXJuIChtaW5QeCAvIGF2YWlsUHgpICogYXZhaWxQY3Q7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIElmIG1pbnMgYWxvbmUgZG9uJ3QgZml0LCBiYWlsLlxyXG5cdFx0XHRjb25zdCBzdW1NaW4gPSBtaW5QY3QucmVkdWNlKCAoYSwgYikgPT4gYSArIGIsIDAgKTtcclxuXHRcdFx0aWYgKCBzdW1NaW4gPiBhdmFpbFBjdCAtIDFlLTYgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7IC8vIGltcG9zc2libGUgdG8gcmVzcGVjdCBtaW5zOyBkb24ndCBhcHBseSBwcmVzZXRcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gVGFyZ2V0IHBlcmNlbnRhZ2VzIGZyb20gd2VpZ2h0cywgbm9ybWFsaXplZCB0byBhdmFpbFBjdC5cclxuXHRcdFx0Y29uc3Qgd1N1bSAgICAgID0gd2VpZ2h0cy5yZWR1Y2UoIChhLCB3KSA9PiBhICsgKE51bWJlciggdyApIHx8IDApLCAwICkgfHwgbjtcclxuXHRcdFx0Y29uc3QgdGFyZ2V0UGN0ID0gd2VpZ2h0cy5tYXAoICh3KSA9PiAoKE51bWJlciggdyApIHx8IDApIC8gd1N1bSkgKiBhdmFpbFBjdCApO1xyXG5cclxuXHRcdFx0Ly8gTG9jayBjb2x1bW5zIHRoYXQgd291bGQgYmUgYmVsb3cgbWluLCB0aGVuIGRpc3RyaWJ1dGUgdGhlIHJlbWFpbmRlclxyXG5cdFx0XHQvLyBhY3Jvc3MgdGhlIHJlbWFpbmluZyBjb2x1bW5zIHByb3BvcnRpb25hbGx5IHRvIHRoZWlyIHRhcmdldFBjdC5cclxuXHRcdFx0Y29uc3QgbG9ja2VkICA9IG5ldyBBcnJheSggbiApLmZpbGwoIGZhbHNlICk7XHJcblx0XHRcdGxldCBsb2NrZWRTdW0gPSAwO1xyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBuOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCB0YXJnZXRQY3RbaV0gPCBtaW5QY3RbaV0gKSB7XHJcblx0XHRcdFx0XHRsb2NrZWRbaV0gPSB0cnVlO1xyXG5cdFx0XHRcdFx0bG9ja2VkU3VtICs9IG1pblBjdFtpXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCByZW1haW5pbmcgICAgID0gYXZhaWxQY3QgLSBsb2NrZWRTdW07XHJcblx0XHRcdGNvbnN0IGZyZWVJZHggICAgID0gW107XHJcblx0XHRcdGxldCBmcmVlVGFyZ2V0U3VtID0gMDtcclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgbjsgaSsrICkge1xyXG5cdFx0XHRcdGlmICggIWxvY2tlZFtpXSApIHtcclxuXHRcdFx0XHRcdGZyZWVJZHgucHVzaCggaSApO1xyXG5cdFx0XHRcdFx0ZnJlZVRhcmdldFN1bSArPSB0YXJnZXRQY3RbaV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSBuZXcgQXJyYXkoIG4gKS5maWxsKCAwICk7XHJcblx0XHRcdC8vIFNlZWQgbG9ja2VkIHdpdGggdGhlaXIgbWluaW1hLlxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBuOyBpKysgKSB7XHJcblx0XHRcdFx0aWYgKCBsb2NrZWRbaV0gKSByZXN1bHRbaV0gPSBtaW5QY3RbaV07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZnJlZUlkeC5sZW5ndGggPT09IDAgKSB7XHJcblx0XHRcdFx0Ly8gZXZlcnl0aGluZyBsb2NrZWQgZXhhY3RseSBhdCBtaW47IGFueSBsZWZ0b3ZlciAoc2hvdWxkbid0IGhhcHBlbilcclxuXHRcdFx0XHQvLyB3b3VsZCBiZSBpZ25vcmVkIHRvIGtlZXAgc2ltcGxpY2l0eSBhbmQgc3RhYmlsaXR5LlxyXG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggcmVtYWluaW5nIDw9IDAgKSB7XHJcblx0XHRcdFx0Ly8gbm90aGluZyBsZWZ0IHRvIGRpc3RyaWJ1dGU7IGtlZXAgZXhhY3RseSBtaW5zIG9uIGxvY2tlZCxcclxuXHRcdFx0XHQvLyBub3RoaW5nIGZvciBmcmVlIChkZWdlbmVyYXRlIGJ1dCBjb25zaXN0ZW50KVxyXG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZnJlZVRhcmdldFN1bSA8PSAwICkge1xyXG5cdFx0XHRcdC8vIGRpc3RyaWJ1dGUgZXF1YWxseSBhbW9uZyBmcmVlIGNvbHVtbnNcclxuXHRcdFx0XHRjb25zdCBlYWNoID0gcmVtYWluaW5nIC8gZnJlZUlkeC5sZW5ndGg7XHJcblx0XHRcdFx0ZnJlZUlkeC5mb3JFYWNoKCAoaSkgPT4gKHJlc3VsdFtpXSA9IGVhY2gpICk7XHJcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGlzdHJpYnV0ZSByZW1haW5pbmcgcHJvcG9ydGlvbmFsbHkgdG8gZnJlZSBjb2x1bW5zJyB0YXJnZXRQY3RcclxuXHRcdFx0ZnJlZUlkeC5mb3JFYWNoKCAoaSkgPT4ge1xyXG5cdFx0XHRcdHJlc3VsdFtpXSA9IHJlbWFpbmluZyAqICh0YXJnZXRQY3RbaV0gLyBmcmVlVGFyZ2V0U3VtKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBBcHBseSBhIHByZXNldCBidXQgZ3VhcmQgaXQgYnkgbWluaW1hOyByZXR1cm5zIHRydWUgaWYgYXBwbGllZCwgZmFsc2UgaWYgc2tpcHBlZC4gKi9cclxuXHRcdHN0YXRpYyBfYXBwbHlfcHJlc2V0X3dpdGhfbWluX2d1YXJkKGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHdlaWdodHMpIHtcclxuXHRcdFx0Y29uc3Qgcm93ID0gc2VjdGlvbl9lbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gLndwYmNfYmZiX19yb3cnICk7XHJcblx0XHRcdGlmICggIXJvdyApIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHRcdGNvbnN0IGZpdHRlZCA9IFVJLldQQkNfQkZCX0xheW91dF9DaGlwcy5fZml0X3dlaWdodHNfcmVzcGVjdGluZ19taW4oIGJ1aWxkZXIsIHJvdywgd2VpZ2h0cyApO1xyXG5cdFx0XHRpZiAoICFmaXR0ZWQgKSB7XHJcblx0XHRcdFx0YnVpbGRlcj8uX2Fubm91bmNlPy4oICdOb3QgZW5vdWdoIHNwYWNlIGZvciB0aGlzIGxheW91dCBiZWNhdXNlIG9mIGZpZWxkc+KAmSBtaW5pbXVtIHdpZHRocy4nICk7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBgZml0dGVkYCBhbHJlYWR5IHN1bXMgdG8gdGhlIHJvd+KAmXMgYXZhaWxhYmxlICUsIHNvIHdlIGNhbiBhcHBseSBiYXNlcyBkaXJlY3RseS5cclxuXHRcdFx0YnVpbGRlci5sYXlvdXQuYXBwbHlfYmFzZXNfdG9fcm93KCByb3csIGZpdHRlZCApO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBhbmQgYXBwZW5kIGxheW91dCBjaGlwcyBmb3IgYSBzZWN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXIgLSBUaGUgZm9ybSBidWlsZGVyIGluc3RhbmNlLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VjdGlvbl9lbCAtIFRoZSAud3BiY19iZmJfX3NlY3Rpb24gZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGhvc3RfZWwgLSBDb250YWluZXIgd2hlcmUgY2hpcHMgc2hvdWxkIGJlIHJlbmRlcmVkLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXJfZm9yX3NlY3Rpb24oYnVpbGRlciwgc2VjdGlvbl9lbCwgaG9zdF9lbCkge1xyXG5cclxuXHRcdFx0aWYgKCAhYnVpbGRlciB8fCAhc2VjdGlvbl9lbCB8fCAhaG9zdF9lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRpZiAoICFyb3cgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjb2xzID0gcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKS5sZW5ndGggfHwgMTtcclxuXHJcblx0XHRcdC8vIENsZWFyIGhvc3QuXHJcblx0XHRcdGhvc3RfZWwuaW5uZXJIVE1MID0gJyc7XHJcblxyXG5cdFx0XHQvLyBFcXVhbCBjaGlwLlxyXG5cdFx0XHRob3N0X2VsLmFwcGVuZENoaWxkKFxyXG5cdFx0XHRcdFVJLldQQkNfQkZCX0xheW91dF9DaGlwcy5fbWFrZV9jaGlwKCBidWlsZGVyLCBzZWN0aW9uX2VsLCBBcnJheSggY29scyApLmZpbGwoIDEgKSwgJ0VxdWFsJyApXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHQvLyBQcmVzZXRzIGJhc2VkIG9uIGNvbHVtbiBjb3VudC5cclxuXHRcdFx0Y29uc3QgcHJlc2V0cyA9IGJ1aWxkZXIubGF5b3V0LmJ1aWxkX3ByZXNldHNfZm9yX2NvbHVtbnMoIGNvbHMgKTtcclxuXHRcdFx0cHJlc2V0cy5mb3JFYWNoKCAod2VpZ2h0cykgPT4ge1xyXG5cdFx0XHRcdGhvc3RfZWwuYXBwZW5kQ2hpbGQoXHJcblx0XHRcdFx0XHRVSS5XUEJDX0JGQl9MYXlvdXRfQ2hpcHMuX21ha2VfY2hpcCggYnVpbGRlciwgc2VjdGlvbl9lbCwgd2VpZ2h0cywgbnVsbCApXHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQ3VzdG9tIGNoaXAuXHJcblx0XHRcdGNvbnN0IGN1c3RvbUJ0biAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdidXR0b24nICk7XHJcblx0XHRcdGN1c3RvbUJ0bi50eXBlICAgICAgICA9ICdidXR0b24nO1xyXG5cdFx0XHRjdXN0b21CdG4uY2xhc3NOYW1lICAgPSAnd3BiY19iZmJfX2xheW91dF9jaGlwJztcclxuXHRcdFx0Y3VzdG9tQnRuLnRleHRDb250ZW50ID0gJ0N1c3RvbeKApic7XHJcblx0XHRcdGN1c3RvbUJ0bi50aXRsZSAgICAgICA9IGBFbnRlciAke2NvbHN9IHBlcmNlbnRhZ2VzYDtcclxuXHRcdFx0Y3VzdG9tQnRuLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsICgpID0+IHtcclxuXHRcdFx0XHRjb25zdCBleGFtcGxlID0gKGNvbHMgPT09IDIpID8gJzUwLDUwJyA6IChjb2xzID09PSAzID8gJzIwLDYwLDIwJyA6ICcyNSwyNSwyNSwyNScpO1xyXG5cdFx0XHRcdGNvbnN0IHRleHQgICAgPSBwcm9tcHQoIGBFbnRlciAke2NvbHN9IHBlcmNlbnRhZ2VzIChjb21tYSBvciBzcGFjZSBzZXBhcmF0ZWQpOmAsIGV4YW1wbGUgKTtcclxuXHRcdFx0XHRpZiAoIHRleHQgPT0gbnVsbCApIHJldHVybjtcclxuXHRcdFx0XHRjb25zdCB3ZWlnaHRzID0gYnVpbGRlci5sYXlvdXQucGFyc2Vfd2VpZ2h0cyggdGV4dCApO1xyXG5cdFx0XHRcdGlmICggd2VpZ2h0cy5sZW5ndGggIT09IGNvbHMgKSB7XHJcblx0XHRcdFx0XHRhbGVydCggYFBsZWFzZSBlbnRlciBleGFjdGx5ICR7Y29sc30gbnVtYmVycy5gICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIE9MRDpcclxuXHRcdFx0XHQvLyBidWlsZGVyLmxheW91dC5hcHBseV9sYXlvdXRfcHJlc2V0KCBzZWN0aW9uX2VsLCB3ZWlnaHRzLCBidWlsZGVyLmNvbF9nYXBfcGVyY2VudCApO1xyXG5cdFx0XHRcdC8vIEd1YXJkZWQgYXBwbHk6LlxyXG5cdFx0XHRcdGlmICggIVVJLldQQkNfQkZCX0xheW91dF9DaGlwcy5fYXBwbHlfcHJlc2V0X3dpdGhfbWluX2d1YXJkKCBidWlsZGVyLCBzZWN0aW9uX2VsLCB3ZWlnaHRzICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGhvc3RfZWwucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fbGF5b3V0X2NoaXAnICkuZm9yRWFjaCggYyA9PiBjLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1hY3RpdmUnICkgKTtcclxuXHRcdFx0XHRjdXN0b21CdG4uY2xhc3NMaXN0LmFkZCggJ2lzLWFjdGl2ZScgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRob3N0X2VsLmFwcGVuZENoaWxkKCBjdXN0b21CdG4gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENyZWF0ZSBhIHNpbmdsZSBsYXlvdXQgY2hpcCBidXR0b24uXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXJcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWxcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyW119IHdlaWdodHNcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGxhYmVsXHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBfbWFrZV9jaGlwKGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHdlaWdodHMsIGxhYmVsID0gbnVsbCkge1xyXG5cclxuXHRcdFx0Y29uc3QgYnRuICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdidXR0b24nICk7XHJcblx0XHRcdGJ0bi50eXBlICAgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0YnRuLmNsYXNzTmFtZSA9ICd3cGJjX2JmYl9fbGF5b3V0X2NoaXAnO1xyXG5cclxuXHRcdFx0Y29uc3QgdGl0bGUgPSBsYWJlbCB8fCBidWlsZGVyLmxheW91dC5mb3JtYXRfcHJlc2V0X2xhYmVsKCB3ZWlnaHRzICk7XHJcblx0XHRcdGJ0bi50aXRsZSAgID0gdGl0bGU7XHJcblxyXG5cdFx0XHQvLyBWaXN1YWwgbWluaWF0dXJlLlxyXG5cdFx0XHRjb25zdCB2aXMgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdFx0dmlzLmNsYXNzTmFtZSA9ICd3cGJjX2JmYl9fbGF5b3V0X2NoaXAtdmlzJztcclxuXHRcdFx0Y29uc3Qgc3VtICAgICA9IHdlaWdodHMucmVkdWNlKCAoYSwgYikgPT4gYSArIChOdW1iZXIoIGIgKSB8fCAwKSwgMCApIHx8IDE7XHJcblx0XHRcdHdlaWdodHMuZm9yRWFjaCggKHcpID0+IHtcclxuXHRcdFx0XHRjb25zdCBiYXIgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xyXG5cdFx0XHRcdGJhci5zdHlsZS5mbGV4ID0gYDAgMCBjYWxjKCAkeygoTnVtYmVyKCB3ICkgfHwgMCkgLyBzdW0gKiAxMDApLnRvRml4ZWQoIDMgKX0lIC0gMS41cHggKWA7XHJcblx0XHRcdFx0dmlzLmFwcGVuZENoaWxkKCBiYXIgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRidG4uYXBwZW5kQ2hpbGQoIHZpcyApO1xyXG5cclxuXHRcdFx0Y29uc3QgdHh0ICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XHJcblx0XHRcdHR4dC5jbGFzc05hbWUgICA9ICd3cGJjX2JmYl9fbGF5b3V0X2NoaXAtbGFiZWwnO1xyXG5cdFx0XHR0eHQudGV4dENvbnRlbnQgPSBsYWJlbCB8fCBidWlsZGVyLmxheW91dC5mb3JtYXRfcHJlc2V0X2xhYmVsKCB3ZWlnaHRzICk7XHJcblx0XHRcdGJ0bi5hcHBlbmRDaGlsZCggdHh0ICk7XHJcblxyXG5cdFx0XHRidG4uYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgKCkgPT4ge1xyXG5cdFx0XHRcdC8vIE9MRDpcclxuXHRcdFx0XHQvLyBidWlsZGVyLmxheW91dC5hcHBseV9sYXlvdXRfcHJlc2V0KCBzZWN0aW9uX2VsLCB3ZWlnaHRzLCBidWlsZGVyLmNvbF9nYXBfcGVyY2VudCApO1xyXG5cclxuXHRcdFx0XHQvLyBORVc6XHJcblx0XHRcdFx0aWYgKCAhVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLl9hcHBseV9wcmVzZXRfd2l0aF9taW5fZ3VhcmQoIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHdlaWdodHMgKSApIHtcclxuXHRcdFx0XHRcdHJldHVybjsgLy8gZG8gbm90IHRvZ2dsZSBhY3RpdmUgaWYgd2UgZGlkbid0IGNoYW5nZSBsYXlvdXRcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGJ0bi5wYXJlbnRFbGVtZW50Py5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19sYXlvdXRfY2hpcCcgKS5mb3JFYWNoKCBjID0+IGMuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLWFjdGl2ZScgKSApO1xyXG5cdFx0XHRcdGJ0bi5jbGFzc0xpc3QuYWRkKCAnaXMtYWN0aXZlJyApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gYnRuO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNlbGVjdGlvbiBjb250cm9sbGVyIGZvciBmaWVsZHMgYW5kIGFubm91bmNlbWVudHMuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfU2VsZWN0aW9uX0NvbnRyb2xsZXIgPSBjbGFzcyBleHRlbmRzIFVJLldQQkNfQkZCX01vZHVsZSB7XHJcblxyXG5cdFx0aW5pdCgpIHtcclxuXHJcblx0XHRcdHRoaXMuX3NlbGVjdGVkX3VpZCAgICAgICAgICAgICAgPSBudWxsO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuc2VsZWN0X2ZpZWxkICAgICAgID0gdGhpcy5zZWxlY3RfZmllbGQuYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuZ2V0X3NlbGVjdGVkX2ZpZWxkID0gdGhpcy5nZXRfc2VsZWN0ZWRfZmllbGQuYmluZCggdGhpcyApO1xuXHRcdFx0dGhpcy5fb25fY2xlYXIgICAgICAgICAgICAgICAgICA9IHRoaXMub25fY2xlYXIuYmluZCggdGhpcyApO1xuXHRcdFx0dGhpcy5fb25fcGFuZWxfc2hvd24gICAgICAgICAgICA9IHRoaXMuX3N5bmNfc2V0dGluZ3NfYnV0dG9uX3N0YXRlcy5iaW5kKCB0aGlzICk7XG5cclxuXHRcdFx0Ly8gQ2VudHJhbGl6ZWQgZGVsZXRlIGNvbW1hbmQgdXNlZCBieSBrZXlib2FyZCArIGluc3BlY3RvciArIG92ZXJsYXkuXHJcblx0XHRcdHRoaXMuYnVpbGRlci5kZWxldGVfaXRlbSA9IChlbCkgPT4ge1xyXG5cdFx0XHRcdGlmICggIWVsICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNvbnN0IGIgICAgICAgID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRcdGNvbnN0IG5laWdoYm9yID0gYi5fZmluZF9uZWlnaGJvcl9zZWxlY3RhYmxlPy4oIGVsICkgfHwgbnVsbDtcclxuXHRcdFx0XHRlbC5yZW1vdmUoKTtcclxuXHRcdFx0XHQvLyBVc2UgbG9jYWwgQ29yZSBjb25zdGFudHMgKG5vdCBhIGdsb2JhbCkgdG8gYXZvaWQgUmVmZXJlbmNlRXJyb3JzLlxyXG5cdFx0XHRcdGIuYnVzPy5lbWl0Py4oIENvcmUuV1BCQ19CRkJfRXZlbnRzLkZJRUxEX1JFTU9WRSwgeyBlbCwgaWQ6IGVsPy5kYXRhc2V0Py5pZCwgdWlkOiBlbD8uZGF0YXNldD8udWlkIH0gKTtcclxuXHRcdFx0XHRiLnVzYWdlPy51cGRhdGVfcGFsZXR0ZV91aT8uKCk7XHJcblx0XHRcdFx0Ly8gTm90aWZ5IGdlbmVyaWMgc3RydWN0dXJlIGxpc3RlbmVycywgdG9vOlxyXG5cdFx0XHRcdGIuYnVzPy5lbWl0Py4oIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9DSEFOR0UsIHsgcmVhc29uOiAnZGVsZXRlJywgZWwgfSApO1xyXG5cdFx0XHRcdC8vIERlZmVyIHNlbGVjdGlvbiBhIHRpY2sgc28gdGhlIERPTSBpcyBmdWxseSBzZXR0bGVkIGJlZm9yZSBJbnNwZWN0b3IgaHlkcmF0ZXMuXHJcblx0XHRcdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKCAoKSA9PiB7XHJcblx0XHRcdFx0XHQvLyBUaGlzIGNhbGxzIGluc3BlY3Rvci5iaW5kX3RvX2ZpZWxkKCkgYW5kIG9wZW5zIHRoZSBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHRcdFx0XHRiLnNlbGVjdF9maWVsZD8uKCBuZWlnaGJvciB8fCBudWxsLCB7IHNjcm9sbEludG9WaWV3OiAhIW5laWdoYm9yIH0gKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0cmV0dXJuIG5laWdoYm9yO1xyXG5cdFx0XHR9O1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuYnVzLm9uKCBDb3JlLldQQkNfQkZCX0V2ZW50cy5DTEVBUl9TRUxFQ1RJT04sIHRoaXMuX29uX2NsZWFyICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5idXMub24oIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9MT0FERUQsIHRoaXMuX29uX2NsZWFyICk7XHJcblx0XHRcdC8vIGRlbGVnYXRlZCBjbGljayBzZWxlY3Rpb24gKGNhcHR1cmUgZW5zdXJlcyB3ZSB3aW4gYmVmb3JlIGJ1YmJsaW5nIHRvIGNvbnRhaW5lcnMpLlxyXG5cdFx0XHR0aGlzLl9vbl9jYW52YXNfY2xpY2sgPSB0aGlzLl9oYW5kbGVfY2FudmFzX2NsaWNrLmJpbmQoIHRoaXMgKTtcblx0XHRcdHRoaXMuYnVpbGRlci5wYWdlc19jb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5fb25fY2FudmFzX2NsaWNrLCB0cnVlICk7XG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19iZmI6cGFuZWxfc2hvd24nLCB0aGlzLl9vbl9wYW5lbF9zaG93biApO1xuXHRcdFx0dGhpcy5fc3luY19zZXR0aW5nc19idXR0b25fc3RhdGVzKCk7XG5cdFx0fVxuXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuYnVzLm9mZiggQ29yZS5XUEJDX0JGQl9FdmVudHMuQ0xFQVJfU0VMRUNUSU9OLCB0aGlzLl9vbl9jbGVhciApO1xyXG5cclxuXHRcdFx0aWYgKCB0aGlzLl9vbl9jYW52YXNfY2xpY2sgKSB7XG5cdFx0XHRcdHRoaXMuYnVpbGRlci5wYWdlc19jb250YWluZXIucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5fb25fY2FudmFzX2NsaWNrLCB0cnVlICk7XG5cdFx0XHRcdHRoaXMuX29uX2NhbnZhc19jbGljayA9IG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggdGhpcy5fb25fcGFuZWxfc2hvd24gKSB7XG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYjpwYW5lbF9zaG93bicsIHRoaXMuX29uX3BhbmVsX3Nob3duICk7XG5cdFx0XHRcdHRoaXMuX29uX3BhbmVsX3Nob3duID0gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWZyZXNoIG92ZXJsYXkgYnV0dG9uIHN0YXRlIGFmdGVyIHNlbGVjdGlvbiBvciByaWdodC1iYXIgcGFuZWwgY2hhbmdlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxuXHRcdCAqL1xuXHRcdF9zeW5jX3NldHRpbmdzX2J1dHRvbl9zdGF0ZXMoKSB7XG5cdFx0XHRVSS5XUEJDX0JGQl9PdmVybGF5LnN5bmNfc2V0dGluZ3NfYnV0dG9uX3N0YXRlcyggdGhpcy5idWlsZGVyICk7XG5cdFx0fVxuXHJcblx0XHQvKipcclxuXHRcdCAqIERlbGVnYXRlZCBjYW52YXMgY2xpY2sgLT4gc2VsZWN0IGNsb3Nlc3QgZmllbGQvc2VjdGlvbiAoaW5uZXIgYmVhdHMgb3V0ZXIpLlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZVxyXG5cdFx0ICovXHJcblx0XHRfaGFuZGxlX2NhbnZhc19jbGljayhlKSB7XHJcblx0XHRcdGNvbnN0IHJvb3QgPSB0aGlzLmJ1aWxkZXIucGFnZXNfY29udGFpbmVyO1xyXG5cdFx0XHRpZiAoICFyb290ICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gSWdub3JlIGNsaWNrcyBvbiBjb250cm9scy9oYW5kbGVzL3Jlc2l6ZXJzLCBldGMuXHJcblx0XHRcdGNvbnN0IElHTk9SRSA9IFtcclxuXHRcdFx0XHQnLndwYmNfYmZiX19vdmVybGF5LWNvbnRyb2xzJyxcclxuXHRcdFx0XHQnLndwYmNfYmZiX19sYXlvdXRfcGlja2VyJyxcclxuXHRcdFx0XHQnLndwYmNfYmZiX19kcmFnLWhhbmRsZScsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fZmllbGQtcmVtb3ZlLWJ0bicsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fZmllbGQtbW92ZS11cCcsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fZmllbGQtbW92ZS1kb3duJyxcclxuXHRcdFx0XHQnLndwYmNfYmZiX19jb2x1bW4tcmVzaXplcidcclxuXHRcdFx0XS5qb2luKCAnLCcgKTtcclxuXHJcblx0XHRcdGlmICggZS50YXJnZXQuY2xvc2VzdCggSUdOT1JFICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuOyAvLyBsZXQgdGhvc2UgY29udHJvbHMgZG8gdGhlaXIgb3duIHRoaW5nLlxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGaW5kIHRoZSBjbG9zZXN0IHNlbGVjdGFibGUgKGZpZWxkIE9SIHNlY3Rpb24pIGZyb20gdGhlIGNsaWNrIHRhcmdldC5cclxuXHRcdFx0bGV0IGhpdCA9IGUudGFyZ2V0LmNsb3Nlc3Q/LihcclxuXHRcdFx0XHRgJHtDb3JlLldQQkNfQkZCX0RPTS5TRUxFQ1RPUlMudmFsaWRGaWVsZH0sICR7Q29yZS5XUEJDX0JGQl9ET00uU0VMRUNUT1JTLnNlY3Rpb259LCAud3BiY19iZmJfX2NvbHVtbmBcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdGlmICggIWhpdCB8fCAhcm9vdC5jb250YWlucyggaGl0ICkgKSB7XHJcblx0XHRcdFx0dGhpcy5zZWxlY3RfZmllbGQoIG51bGwgKTsgICAgICAgICAgIC8vIENsZWFyIHNlbGVjdGlvbiBvbiBibGFuayBjbGljay5cclxuXHRcdFx0XHRyZXR1cm47ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRW1wdHkgc3BhY2UgaXMgaGFuZGxlZCBlbHNld2hlcmUuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE5FVzogaWYgdXNlciBjbGlja2VkIGEgQ09MVU1OIC0+IHJlbWVtYmVyIHRhYiBrZXkgb24gaXRzIFNFQ1RJT04sIGJ1dCBzdGlsbCBzZWxlY3QgdGhlIHNlY3Rpb24uXHJcblx0XHRcdGxldCBwcmVzZWxlY3RfdGFiX2tleSA9IG51bGw7XHJcblx0XHRcdGlmICggaGl0LmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19jb2x1bW4nICkgKSB7XHJcblx0XHRcdFx0Y29uc3Qgcm93ICA9IGhpdC5jbG9zZXN0KCAnLndwYmNfYmZiX19yb3cnICk7XHJcblx0XHRcdFx0Y29uc3QgY29scyA9IHJvdyA/IEFycmF5LmZyb20oIHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkgKSA6IFtdO1xyXG5cdFx0XHRcdGNvbnN0IGlkeCAgPSBNYXRoLm1heCggMCwgY29scy5pbmRleE9mKCBoaXQgKSApO1xyXG5cdFx0XHRcdGNvbnN0IHNlYyAgPSBoaXQuY2xvc2VzdCggJy53cGJjX2JmYl9fc2VjdGlvbicgKTtcclxuXHRcdFx0XHRpZiAoIHNlYyApIHtcclxuXHRcdFx0XHRcdHByZXNlbGVjdF90YWJfa2V5ID0gU3RyaW5nKCBpZHggKyAxICk7ICAgICAgICAgICAgICAvLyB0YWJzIGFyZSAxLWJhc2VkIGluIHVpLWNvbHVtbi1zdHlsZXMuanNcclxuXHRcdFx0XHRcdC8vIEhpbnQgZm9yIHRoZSByZW5kZXJlciAoaXQgcmVhZHMgdGhpcyBCRUZPUkUgcmVuZGVyaW5nIGFuZCByZXN0b3JlcyB0aGUgdGFiKS5cclxuXHRcdFx0XHRcdHNlYy5kYXRhc2V0LmNvbF9zdHlsZXNfYWN0aXZlX3RhYiA9IHByZXNlbGVjdF90YWJfa2V5O1xyXG5cdFx0XHRcdFx0Ly8gcHJvbW90ZSBzZWxlY3Rpb24gdG8gdGhlIHNlY3Rpb24gKHNhbWUgVVggYXMgYmVmb3JlKS5cclxuXHRcdFx0XHRcdGhpdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IHNlYztcclxuXHRcdFx0XHRcdC8vIE5FVzogdmlzdWFsbHkgbWFyayB3aGljaCBjb2x1bW4gaXMgYmVpbmcgZWRpdGVkXHJcblx0XHRcdFx0XHRpZiAoIFVJICYmIFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMgJiYgVUkuV1BCQ19CRkJfQ29sdW1uX1N0eWxlcy5zZXRfc2VsZWN0ZWRfY29sX2ZsYWcgKSB7XHJcblx0XHRcdFx0XHRcdFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMuc2V0X3NlbGVjdGVkX2NvbF9mbGFnKCBzZWMsIHByZXNlbGVjdF90YWJfa2V5ICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTZWxlY3QgYW5kIHN0b3AgYnViYmxpbmcgc28gb3V0ZXIgY29udGFpbmVycyBkb27igJl0IHJlc2VsZWN0IGEgcGFyZW50LlxyXG5cdFx0XHR0aGlzLnNlbGVjdF9maWVsZCggaGl0ICk7XHJcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblxyXG5cdFx0XHQvLyBBbHNvIHNldCB0aGUgdGFiIGFmdGVyIHRoZSBpbnNwZWN0b3IgcmVuZGVycyAod29ya3MgZXZlbiBpZiBpdCB3YXMgYWxyZWFkeSBvcGVuKS5cclxuXHRcdFx0aWYgKCBwcmVzZWxlY3RfdGFiX2tleSApIHtcclxuXHRcdFx0XHQod2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCBzZXRUaW1lb3V0KSggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgaW5zICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgdGFicyA9IGlucyAmJiBpbnMucXVlcnlTZWxlY3RvciggJ1tkYXRhLWJmYi1zbG90PVwiY29sdW1uX3N0eWxlc1wiXSBbZGF0YS13cGJjLXRhYnNdJyApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIHRhYnMgJiYgd2luZG93LndwYmNfdWlfdGFicyAmJiB0eXBlb2Ygd2luZG93LndwYmNfdWlfdGFicy5zZXRfYWN0aXZlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRcdHdpbmRvdy53cGJjX3VpX3RhYnMuc2V0X2FjdGl2ZSggdGFicywgcHJlc2VsZWN0X3RhYl9rZXkgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0sIDAgKTtcclxuXHJcblx0XHRcdFx0Ly8gUG9saXRlbHkgYXNrIHRoZSBJbnNwZWN0b3IgdG8gZm9jdXMvb3BlbiB0aGUgXCJDb2x1bW4gU3R5bGVzXCIgZ3JvdXAgYW5kIHRhYi5cclxuXHRcdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZShcclxuXHRcdFx0XHRcdCd3cGJjX2JmYjppbnNwZWN0b3JfZm9jdXMnLFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRncm91cCAgOiAnY29sdW1uX3N0eWxlcycsXHJcblx0XHRcdFx0XHRcdHRhYl9rZXk6IHByZXNlbGVjdF90YWJfa2V5XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNlbGVjdCBhIGZpZWxkIGVsZW1lbnQgb3IgY2xlYXIgc2VsZWN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gZmllbGRfZWxcclxuXHRcdCAqIEBwYXJhbSB7e3Njcm9sbEludG9WaWV3PzogYm9vbGVhbn19IFtvcHRzID0ge31dXHJcblx0XHQgKi9cclxuXHRcdHNlbGVjdF9maWVsZChmaWVsZF9lbCwgeyBzY3JvbGxJbnRvVmlldyA9IGZhbHNlIH0gPSB7fSkge1xyXG5cdFx0XHRjb25zdCByb290ICAgPSB0aGlzLmJ1aWxkZXIucGFnZXNfY29udGFpbmVyO1xyXG5cdFx0XHRjb25zdCBwcmV2RWwgPSB0aGlzLmdldF9zZWxlY3RlZF9maWVsZD8uKCkgfHwgbnVsbDsgICAvLyB0aGUgb25lIHdl4oCZcmUgbGVhdmluZy5cclxuXHJcblx0XHRcdC8vIElnbm9yZSBlbGVtZW50cyBub3QgaW4gdGhlIGNhbnZhcy5cclxuXHRcdFx0aWYgKCBmaWVsZF9lbCAmJiAhcm9vdC5jb250YWlucyggZmllbGRfZWwgKSApIHtcclxuXHRcdFx0XHRmaWVsZF9lbCA9IG51bGw7IC8vIHRyZWF0IGFzIFwibm8gc2VsZWN0aW9uXCIuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE5FVzogaWYgd2UgYXJlIGxlYXZpbmcgYSBzZWN0aW9uLCBjbGVhciBpdHMgY29sdW1uIGhpZ2hsaWdodFxyXG5cdFx0XHRpZiAoXHJcblx0XHRcdFx0cHJldkVsICYmIHByZXZFbCAhPT0gZmllbGRfZWwgJiZcclxuXHRcdFx0XHRwcmV2RWwuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICYmXHJcblx0XHRcdFx0VUk/LldQQkNfQkZCX0NvbHVtbl9TdHlsZXM/LmNsZWFyX3NlbGVjdGVkX2NvbF9mbGFnXHJcblx0XHRcdCkge1xyXG5cdFx0XHRcdFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMuY2xlYXJfc2VsZWN0ZWRfY29sX2ZsYWcoIHByZXZFbCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJZiB3ZSdyZSBsZWF2aW5nIGEgZmllbGQsIHBlcm1hbmVudGx5IHN0b3AgYXV0by1uYW1lIGZvciBpdC5cclxuXHRcdFx0aWYgKCBwcmV2RWwgJiYgcHJldkVsICE9PSBmaWVsZF9lbCAmJiBwcmV2RWwuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSApIHtcclxuXHRcdFx0XHRwcmV2RWwuZGF0YXNldC5hdXRvbmFtZSA9ICcwJztcclxuXHRcdFx0XHRwcmV2RWwuZGF0YXNldC5mcmVzaCAgICA9ICcwJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLmlzLXNlbGVjdGVkJyApLmZvckVhY2goIChuKSA9PiB7XHJcblx0XHRcdFx0bi5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtc2VsZWN0ZWQnICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0aWYgKCAhZmllbGRfZWwgKSB7XHJcblx0XHRcdFx0Y29uc3QgcHJldiAgICAgICAgID0gdGhpcy5fc2VsZWN0ZWRfdWlkIHx8IG51bGw7XHJcblx0XHRcdFx0dGhpcy5fc2VsZWN0ZWRfdWlkID0gbnVsbDtcclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXIuaW5zcGVjdG9yPy5jbGVhcj8uKCk7XHJcblx0XHRcdFx0cm9vdC5jbGFzc0xpc3QucmVtb3ZlKCAnaGFzLXNlbGVjdGlvbicgKTtcclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXIuYnVzLmVtaXQoIENvcmUuV1BCQ19CRkJfRXZlbnRzLkNMRUFSX1NFTEVDVElPTiwgeyBwcmV2X3VpZDogcHJldiwgc291cmNlOiAnYnVpbGRlcicgfSApO1xyXG5cclxuXHRcdFx0XHQvLyBBdXRvLW9wZW4gXCJBZGQgRmllbGRzXCIgd2hlbiBub3RoaW5nIGlzIHNlbGVjdGVkLlxyXG5cdFx0XHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKFxuXHRcdFx0XHRcdCd3cGJjX2JmYjpzaG93X3BhbmVsJyxcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHBhbmVsX2lkOiAnd3BiY19iZmJfX3BhbGV0dGVfYWRkX25ldycsXHJcblx0XHRcdFx0XHRcdHRhYl9pZCAgOiAnd3BiY190YWJfbGlicmFyeSdcclxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KTtcblx0XHRcdFx0dGhpcy5fc3luY19zZXR0aW5nc19idXR0b25fc3RhdGVzKCk7XG5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxyXG5cdFx0XHRmaWVsZF9lbC5jbGFzc0xpc3QuYWRkKCAnaXMtc2VsZWN0ZWQnICk7XHJcblx0XHRcdHRoaXMuX3NlbGVjdGVkX3VpZCA9IGZpZWxkX2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtdWlkJyApIHx8IG51bGw7XHJcblxyXG5cdFx0XHQvLyBGYWxsYmFjazogZW5zdXJlIHNlY3Rpb25zIGFubm91bmNlIHRoZW1zZWx2ZXMgYXMgdHlwZT1cInNlY3Rpb25cIi5cclxuXHRcdFx0aWYgKCBmaWVsZF9lbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSAmJiAhZmllbGRfZWwuZGF0YXNldC50eXBlICkge1xyXG5cdFx0XHRcdGZpZWxkX2VsLmRhdGFzZXQudHlwZSA9ICdzZWN0aW9uJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBzY3JvbGxJbnRvVmlldyApIHtcclxuXHRcdFx0XHRmaWVsZF9lbC5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnY2VudGVyJyB9ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5idWlsZGVyLmluc3BlY3Rvcj8uYmluZF90b19maWVsZD8uKCBmaWVsZF9lbCApO1xyXG5cclxuXHRcdFx0Ly8gRmFsbGJhY2s6IGVuc3VyZSBpbnNwZWN0b3IgZW5oYW5jZXJzIChpbmNsLiBWYWx1ZVNsaWRlcikgcnVuIGV2ZXJ5IGJpbmQuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApXHJcblx0XHRcdFx0XHR8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0aWYgKCBpbnMgKSB7XHJcblx0XHRcdFx0XHRVSS5JbnNwZWN0b3JFbmhhbmNlcnM/LnNjYW4/LiggaW5zICk7ICAgICAgICAgICAgICAvLyBydW5zIGFsbCBlbmhhbmNlcnNcclxuXHRcdFx0XHRcdFVJLldQQkNfQkZCX1ZhbHVlU2xpZGVyPy5pbml0X29uPy4oIGlucyApOyAgICAgICAgIC8vIGV4dHJhIGJlbHQtYW5kLXN1c3BlbmRlcnNcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBORVc6IHdoZW4gc2VsZWN0aW5nIGEgc2VjdGlvbiwgcmVmbGVjdCBpdHMgYWN0aXZlIHRhYiBhcyB0aGUgaGlnaGxpZ2h0ZWQgY29sdW1uLlxyXG5cdFx0XHRpZiAoIGZpZWxkX2VsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICYmXHJcblx0XHRcdFx0VUk/LldQQkNfQkZCX0NvbHVtbl9TdHlsZXM/LnNldF9zZWxlY3RlZF9jb2xfZmxhZyApIHtcclxuXHRcdFx0XHR2YXIgayA9IChmaWVsZF9lbC5kYXRhc2V0ICYmIGZpZWxkX2VsLmRhdGFzZXQuY29sX3N0eWxlc19hY3RpdmVfdGFiKVxyXG5cdFx0XHRcdFx0PyBmaWVsZF9lbC5kYXRhc2V0LmNvbF9zdHlsZXNfYWN0aXZlX3RhYiA6ICcxJztcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnNldF9zZWxlY3RlZF9jb2xfZmxhZyggZmllbGRfZWwsIGsgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gS2VlcCBzZWN0aW9ucyAmIGZpZWxkcyBpbiB0aGUgc2FtZSBmbG93OlxyXG5cdFx0XHQvLyAxKSBHZW5lcmljIGh5ZHJhdG9yIGZvciBzaW1wbGUgZGF0YXNldC1iYWNrZWQgY29udHJvbHMuXHJcblx0XHRcdGlmICggZmllbGRfZWwgKSB7XHJcblx0XHRcdFx0VUkuV1BCQ19CRkJfSW5zcGVjdG9yX0JyaWRnZS5fZ2VuZXJpY19oeWRyYXRlX2NvbnRyb2xzPy4oIHRoaXMuYnVpbGRlciwgZmllbGRfZWwgKTtcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9JbnNwZWN0b3JfQnJpZGdlLl9oeWRyYXRlX3NwZWNpYWxfY29udHJvbHM/LiggdGhpcy5idWlsZGVyLCBmaWVsZF9lbCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBBdXRvLW9wZW4gSW5zcGVjdG9yIHdoZW4gYSB1c2VyIHNlbGVjdHMgYSBmaWVsZC9zZWN0aW9uIC5cclxuXHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoXG5cdFx0XHRcdCd3cGJjX2JmYjpzaG93X3BhbmVsJyxcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0cGFuZWxfaWQ6ICd3cGJjX2JmYl9faW5zcGVjdG9yJyxcclxuXHRcdFx0XHRcdHRhYl9pZCAgOiAnd3BiY190YWJfaW5zcGVjdG9yJ1xyXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XHR0aGlzLl9zeW5jX3NldHRpbmdzX2J1dHRvbl9zdGF0ZXMoKTtcblxuXHRcdFx0cm9vdC5jbGFzc0xpc3QuYWRkKCAnaGFzLXNlbGVjdGlvbicgKTtcblx0XHRcdHRoaXMuYnVpbGRlci5idXMuZW1pdCggQ29yZS5XUEJDX0JGQl9FdmVudHMuU0VMRUNULCB7IHVpZDogdGhpcy5fc2VsZWN0ZWRfdWlkLCBlbDogZmllbGRfZWwgfSApO1xyXG5cdFx0XHRjb25zdCBsYWJlbCA9IGZpZWxkX2VsPy5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19maWVsZC1sYWJlbCcgKT8udGV4dENvbnRlbnQgfHwgKGZpZWxkX2VsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApID8gJ3NlY3Rpb24nIDogJycpIHx8IGZpZWxkX2VsPy5kYXRhc2V0Py5pZCB8fCAnaXRlbSc7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5fYW5ub3VuY2UoICdTZWxlY3RlZCAnICsgbGFiZWwgKyAnLicgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHJldHVybnMge0hUTUxFbGVtZW50fG51bGx9ICovXHJcblx0XHRnZXRfc2VsZWN0ZWRfZmllbGQoKSB7XHJcblx0XHRcdGlmICggIXRoaXMuX3NlbGVjdGVkX3VpZCApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBlc2NfYXR0ciA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCB0aGlzLl9zZWxlY3RlZF91aWQgKTtcclxuXHRcdFx0cmV0dXJuIHRoaXMuYnVpbGRlci5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvciggYC53cGJjX2JmYl9fZmllbGRbZGF0YS11aWQ9XCIke2VzY19hdHRyfVwiXSwgLndwYmNfYmZiX19zZWN0aW9uW2RhdGEtdWlkPVwiJHtlc2NfYXR0cn1cIl1gICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ICovXHJcblx0XHRvbl9jbGVhcihldikge1xyXG5cdFx0XHRjb25zdCBzcmMgPSBldj8uZGV0YWlsPy5zb3VyY2UgPz8gZXY/LnNvdXJjZTtcclxuXHRcdFx0aWYgKCBzcmMgIT09ICdidWlsZGVyJyApIHtcclxuXHRcdFx0XHR0aGlzLnNlbGVjdF9maWVsZCggbnVsbCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJyaWRnZXMgdGhlIGJ1aWxkZXIgd2l0aCB0aGUgSW5zcGVjdG9yIGFuZCBzYW5pdGl6ZXMgaWQvbmFtZSBlZGl0cy5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9JbnNwZWN0b3JfQnJpZGdlID0gY2xhc3MgZXh0ZW5kcyBVSS5XUEJDX0JGQl9Nb2R1bGUge1xyXG5cclxuXHRcdGluaXQoKSB7XHJcblx0XHRcdHRoaXMuX2F0dGFjaF9pbnNwZWN0b3IoKTtcclxuXHRcdFx0dGhpcy5fYmluZF9pZF9zYW5pdGl6ZXIoKTtcclxuXHRcdFx0dGhpcy5fb3Blbl9pbnNwZWN0b3JfYWZ0ZXJfZmllbGRfYWRkZWQoKTtcclxuXHRcdFx0dGhpcy5fYmluZF9mb2N1c19zaG9ydGN1dHMoKTtcclxuXHRcdH1cclxuXHJcblx0XHRfYXR0YWNoX2luc3BlY3RvcigpIHtcclxuXHRcdFx0Y29uc3QgYiAgICAgID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRjb25zdCBhdHRhY2ggPSAoKSA9PiB7XHJcblx0XHRcdFx0aWYgKCB0eXBlb2Ygd2luZG93LldQQkNfQkZCX0luc3BlY3RvciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGIuaW5zcGVjdG9yID0gbmV3IFdQQkNfQkZCX0luc3BlY3RvciggZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApLCBiICk7XHJcblx0XHRcdFx0XHR0aGlzLl9iaW5kX2lkX3Nhbml0aXplcigpO1xyXG5cdFx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZWFkeScsIGF0dGFjaCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHRcdFx0Ly8gRW5zdXJlIHdlIGJpbmQgYWZ0ZXIgbGF0ZSByZWFkeSBhcyB3ZWxsLlxyXG5cdFx0XHRpZiAoIHR5cGVvZiB3aW5kb3cuV1BCQ19CRkJfSW5zcGVjdG9yID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdGF0dGFjaCgpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGIuaW5zcGVjdG9yID0ge1xyXG5cdFx0XHRcdFx0YmluZF90b19maWVsZCgpIHtcclxuXHRcdFx0XHRcdH0sIGNsZWFyKCkge1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH07XHJcblx0XHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZWFkeScsIGF0dGFjaCApO1xyXG5cdFx0XHRcdHNldFRpbWVvdXQoIGF0dGFjaCwgMCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBMaXN0ZW4gZm9yIFwiZm9jdXNcIiBoaW50cyBmcm9tIHRoZSBjYW52YXMgYW5kIG9wZW4gdGhlIHJpZ2h0IGdyb3VwL3RhYi5cclxuXHRcdCAqIC0gU3VwcG9ydHM6IGdyb3VwID09PSAnY29sdW1uX3N0eWxlcydcclxuXHRcdCAqIC0gQWxzbyBzY3JvbGxzIHRoZSBncm91cCBpbnRvIHZpZXcuXHJcblx0XHQgKi9cclxuXHRcdF9iaW5kX2ZvY3VzX3Nob3J0Y3V0cygpIHtcclxuXHRcdFx0LyoqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGUgKi9cclxuXHRcdFx0Y29uc3Qgb25fZm9jdXMgPSAoZSkgPT4ge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRjb25zdCBncnBfa2V5ID0gZSAmJiBlLmRldGFpbCAmJiBlLmRldGFpbC5ncm91cDtcclxuXHRcdFx0XHRcdGNvbnN0IHRhYl9rZXkgPSBlICYmIGUuZGV0YWlsICYmIGUuZGV0YWlsLnRhYl9rZXk7XHJcblx0XHRcdFx0XHRpZiAoICFncnBfa2V5ICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0XHRcdGlmICggIWlucyApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggZ3JwX2tleSA9PT0gJ2NvbHVtbl9zdHlsZXMnICkge1xyXG5cdFx0XHRcdFx0XHQvLyBGaW5kIHRoZSBDb2x1bW4gU3R5bGVzIHNsb3QvZ3JvdXAuXHJcblx0XHRcdFx0XHRcdGNvbnN0IHNsb3QgPSBpbnMucXVlcnlTZWxlY3RvciggJ1tkYXRhLWJmYi1zbG90PVwiY29sdW1uX3N0eWxlc1wiXScgKSB8fCBpbnMucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1ncm91cC1rZXk9XCJjb2x1bW5fc3R5bGVzXCJdJyApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIHNsb3QgKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gT3BlbiBjb2xsYXBzaWJsZSBjb250YWluZXIgaWYgcHJlc2VudC5cclxuXHRcdFx0XHRcdFx0XHRjb25zdCBncm91cF93cmFwID0gc2xvdC5jbG9zZXN0KCAnLmluc3BlY3Rvcl9fZ3JvdXAnICkgfHwgc2xvdC5jbG9zZXN0KCAnW2RhdGEtaW5zcGVjdG9yLWdyb3VwXScgKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIGdyb3VwX3dyYXAgJiYgIWdyb3VwX3dyYXAuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtb3BlbicgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdGdyb3VwX3dyYXAuY2xhc3NMaXN0LmFkZCggJ2lzLW9wZW4nICk7XHJcblx0XHRcdFx0XHRcdFx0XHQvLyBNaXJyb3IgQVJJQSBzdGF0ZSBpZiB5b3VyIGhlYWRlciB1c2VzIGFyaWEtZXhwYW5kZWQuXHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBoZWFkZXJfYnRuID0gZ3JvdXBfd3JhcC5xdWVyeVNlbGVjdG9yKCAnW2FyaWEtZXhwYW5kZWRdJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKCBoZWFkZXJfYnRuICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRoZWFkZXJfYnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRcdC8vIE9wdGlvbmFsOiBzZXQgdGhlIHJlcXVlc3RlZCB0YWIga2V5IGlmIHRhYnMgZXhpc3QgaW4gdGhpcyBncm91cC5cclxuXHRcdFx0XHRcdFx0XHRpZiAoIHRhYl9rZXkgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCB0YWJzID0gc2xvdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10YWJzXScgKTtcclxuXHRcdFx0XHRcdFx0XHRcdGlmICggdGFicyAmJiB3aW5kb3cud3BiY191aV90YWJzICYmIHR5cGVvZiB3aW5kb3cud3BiY191aV90YWJzLnNldF9hY3RpdmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdHdpbmRvdy53cGJjX3VpX3RhYnMuc2V0X2FjdGl2ZSggdGFicywgU3RyaW5nKCB0YWJfa2V5ICkgKTtcclxuXHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRcdC8vIEJyaW5nIGludG8gdmlldyBmb3IgY29udmVuaWVuY2UuXHJcblx0XHRcdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0XHRcdC8vIFVuY29tbWVudCAoT25seSAgaWYgbmVlZGVkKSB0aGlzIHRvIEFVVE8gU0NST0xMIHRvICBzcGVjaWZpYyBDT0xVTU4gaW4gdGhlIHNlY3Rpb246LlxyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gc2xvdC5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnbmVhcmVzdCcgfSApO1xyXG5cdFx0XHRcdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0dGhpcy5fb25faW5zcGVjdG9yX2ZvY3VzID0gb25fZm9jdXM7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYjppbnNwZWN0b3JfZm9jdXMnLCBvbl9mb2N1cywgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRlc3Ryb3koKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0aWYgKCB0aGlzLl9vbl9pbnNwZWN0b3JfZm9jdXMgKSB7XHJcblx0XHRcdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiY19iZmI6aW5zcGVjdG9yX2ZvY3VzJywgdGhpcy5fb25faW5zcGVjdG9yX2ZvY3VzLCB0cnVlICk7XHJcblx0XHRcdFx0XHR0aGlzLl9vbl9pbnNwZWN0b3JfZm9jdXMgPSBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSHlkcmF0ZSBpbnNwZWN0b3IgaW5wdXRzIGZvciBcInNwZWNpYWxcIiBrZXlzIHRoYXQgd2UgaGFuZGxlIGV4cGxpY2l0bHkuXHJcblx0XHQgKiBXb3JrcyBmb3IgYm90aCBmaWVsZHMgYW5kIHNlY3Rpb25zLlxyXG5cdFx0ICogQHBhcmFtIHtXUEJDX0Zvcm1fQnVpbGRlcn0gYnVpbGRlclxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2VsXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBfaHlkcmF0ZV9zcGVjaWFsX2NvbnRyb2xzKGJ1aWxkZXIsIHNlbCkge1xyXG5cdFx0XHRjb25zdCBpbnMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdGlmICggIWlucyB8fCAhc2VsICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3Qgc2V0VmFsID0gKGtleSwgdmFsKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgY3RybCA9IGlucy5xdWVyeVNlbGVjdG9yKCBgW2RhdGEtaW5zcGVjdG9yLWtleT1cIiR7a2V5fVwiXWAgKTtcclxuXHRcdFx0XHRpZiAoIGN0cmwgJiYgJ3ZhbHVlJyBpbiBjdHJsICkgY3RybC52YWx1ZSA9IFN0cmluZyggdmFsID8/ICcnICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvLyBJbnRlcm5hbCBpZCAvIG5hbWUgLyBwdWJsaWMgaHRtbF9pZC5cclxuXHRcdFx0c2V0VmFsKCAnaWQnLCBzZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1pZCcgKSB8fCAnJyApO1xyXG5cdFx0XHRzZXRWYWwoICduYW1lJywgc2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtbmFtZScgKSB8fCAnJyApO1xyXG5cdFx0XHRzZXRWYWwoICdodG1sX2lkJywgc2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaHRtbF9pZCcgKSB8fCAnJyApO1xyXG5cclxuXHRcdFx0Ly8gU2VjdGlvbi1vbmx5IGV4dHJhcyBhcmUgaGFybWxlc3MgdG8gc2V0IGZvciBmaWVsZHMgKGNvbnRyb2xzIG1heSBub3QgZXhpc3QpLlxyXG5cdFx0XHRzZXRWYWwoICdjc3NjbGFzcycsIHNlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNzc2NsYXNzJyApIHx8ICcnICk7XHJcblx0XHRcdHNldFZhbCggJ2xhYmVsJywgc2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtbGFiZWwnICkgfHwgJycgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIeWRyYXRlIGluc3BlY3RvciBpbnB1dHMgdGhhdCBkZWNsYXJlIGEgZ2VuZXJpYyBkYXRhc2V0IG1hcHBpbmcgdmlhXHJcblx0XHQgKiBbZGF0YS1pbnNwZWN0b3Ita2V5XSBidXQgZG8gTk9UIGRlY2xhcmUgYSBjdXN0b20gdmFsdWVfZnJvbSBhZGFwdGVyLlxyXG5cdFx0ICogVGhpcyBtYWtlcyBzZWN0aW9ucyBmb2xsb3cgdGhlIHNhbWUgZGF0YSBmbG93IGFzIGZpZWxkcyB3aXRoIGFsbW9zdCBubyBnbHVlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXJcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlbCAtIGN1cnJlbnRseSBzZWxlY3RlZCBmaWVsZC9zZWN0aW9uXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBfZ2VuZXJpY19oeWRyYXRlX2NvbnRyb2xzKGJ1aWxkZXIsIHNlbCkge1xyXG5cdFx0XHRjb25zdCBpbnMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdGlmICggIWlucyB8fCAhc2VsICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgU0tJUCA9IC9eKGlkfG5hbWV8aHRtbF9pZHxjc3NjbGFzc3xsYWJlbCkkLzsgLy8gaGFuZGxlZCBieSBfaHlkcmF0ZV9zcGVjaWFsX2NvbnRyb2xzXHJcblxyXG5cdFx0XHQvLyBORVc6IHJlYWQgc2NoZW1hIGZvciB0aGUgc2VsZWN0ZWQgZWxlbWVudOKAmXMgdHlwZS5cclxuXHRcdFx0Y29uc3Qgc2NoZW1hcyAgICAgPSB3aW5kb3cuV1BCQ19CRkJfU2NoZW1hcyB8fCB7fTtcclxuXHRcdFx0Y29uc3QgdHlwZUtleSAgICAgPSAoc2VsLmRhdGFzZXQgJiYgc2VsLmRhdGFzZXQudHlwZSkgfHwgJyc7XHJcblx0XHRcdGNvbnN0IHNjaGVtYUVudHJ5ID0gc2NoZW1hc1t0eXBlS2V5XSB8fCBudWxsO1xyXG5cdFx0XHRjb25zdCBwcm9wc1NjaGVtYSA9IChzY2hlbWFFbnRyeSAmJiBzY2hlbWFFbnRyeS5zY2hlbWEgJiYgc2NoZW1hRW50cnkuc2NoZW1hLnByb3BzKSA/IHNjaGVtYUVudHJ5LnNjaGVtYS5wcm9wcyA6IHt9O1xyXG5cdFx0XHRjb25zdCBoYXNPd24gICAgICA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsLmJpbmQoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkgKTtcclxuXHRcdFx0Y29uc3QgZ2V0RGVmYXVsdCAgPSAoa2V5KSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgbWV0YSA9IHByb3BzU2NoZW1hW2tleV07XHJcblx0XHRcdFx0cmV0dXJuIChtZXRhICYmIGhhc093biggbWV0YSwgJ2RlZmF1bHQnICkpID8gbWV0YS5kZWZhdWx0IDogdW5kZWZpbmVkO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0aW5zLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS1pbnNwZWN0b3Ita2V5XScgKS5mb3JFYWNoKCAoY3RybCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGtleSA9IFN0cmluZyggY3RybC5kYXRhc2V0Py5pbnNwZWN0b3JLZXkgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRcdGlmICggIWtleSB8fCBTS0lQLnRlc3QoIGtleSApICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0XHQvLyBFbGVtZW50LWxldmVsIGxvY2suXHJcblx0XHRcdFx0Y29uc3QgZGwgPSAoY3RybC5kYXRhc2V0Py5sb2NrZWQgfHwgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRcdGlmICggZGwgPT09ICcxJyB8fCBkbCA9PT0gJ3RydWUnIHx8IGRsID09PSAneWVzJyApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Ly8gUmVzcGVjdCBleHBsaWNpdCBhZGFwdGVycy5cclxuXHRcdFx0XHRpZiAoIGN0cmwuZGF0YXNldD8udmFsdWVfZnJvbSB8fCBjdHJsLmRhdGFzZXQ/LnZhbHVlRnJvbSApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Y29uc3QgcmF3ICAgICAgPSBzZWwuZGF0YXNldCA/IHNlbC5kYXRhc2V0W2tleV0gOiB1bmRlZmluZWQ7XHJcblx0XHRcdFx0Y29uc3QgaGFzUmF3ICAgPSBzZWwuZGF0YXNldCA/IGhhc093biggc2VsLmRhdGFzZXQsIGtleSApIDogZmFsc2U7XHJcblx0XHRcdFx0Y29uc3QgZGVmVmFsdWUgPSBnZXREZWZhdWx0KCBrZXkgKTtcclxuXHJcblx0XHRcdFx0Ly8gQmVzdC1lZmZvcnQgY29udHJvbCB0eXBpbmcgd2l0aCBzY2hlbWEgZGVmYXVsdCBmYWxsYmFjayB3aGVuIHZhbHVlIGlzIGFic2VudC5cclxuXHJcblx0XHRcdFx0aWYgKCBjdHJsIGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiAoY3RybC50eXBlID09PSAnY2hlY2tib3gnIHx8IGN0cmwudHlwZSA9PT0gJ3JhZGlvJykgKSB7XHJcblx0XHRcdFx0XHQvLyBJZiBkYXRhc2V0IGlzIG1pc3NpbmcgdGhlIGtleSBlbnRpcmVseSAtPiB1c2Ugc2NoZW1hIGRlZmF1bHQgKGJvb2xlYW4pLlxyXG5cdFx0XHRcdFx0aWYgKCAhaGFzUmF3ICkge1xyXG5cdFx0XHRcdFx0XHRjdHJsLmNoZWNrZWQgPSAhIWRlZlZhbHVlO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Ly8gQW4gZXhwbGljaXQgZW1wdHkgdmFsdWUgaXMgdGhlIGxlZ2FjeSBwZXJzaXN0ZWQgcmVwcmVzZW50YXRpb24gb2YgZmFsc2UuXHJcblx0XHRcdFx0XHRcdGN0cmwuY2hlY2tlZCA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuY29lcmNlX2Jvb2xlYW4oIHJhdywgZmFsc2UgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2UgaWYgKCAndmFsdWUnIGluIGN0cmwgKSB7XHJcblx0XHRcdFx0XHRpZiAoIGhhc1JhdyApIHtcclxuXHRcdFx0XHRcdFx0Y3RybC52YWx1ZSA9IChyYXcgIT0gbnVsbCkgPyBTdHJpbmcoIHJhdyApIDogJyc7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRjdHJsLnZhbHVlID0gKGRlZlZhbHVlID09IG51bGwpID8gJycgOiBTdHJpbmcoIGRlZlZhbHVlICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0X2JpbmRfaWRfc2FuaXRpemVyKCkge1xyXG5cdFx0XHRjb25zdCBiICAgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGNvbnN0IGlucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0aWYgKCAhIGlucyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBpbnMuX193cGJjX2JmYl9pZF9zYW5pdGl6ZXJfYm91bmQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlucy5fX3dwYmNfYmZiX2lkX3Nhbml0aXplcl9ib3VuZCA9IHRydWU7XHJcblxyXG5cdFx0XHRjb25zdCBoYW5kbGVyID0gKGUpID0+IHtcclxuXHJcblx0XHRcdFx0Y29uc3QgdCA9IGUudGFyZ2V0O1xyXG5cdFx0XHRcdGlmICggIXQgfHwgISgndmFsdWUnIGluIHQpICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zdCBrZXkgICAgICAgPSAodC5kYXRhc2V0Py5pbnNwZWN0b3JLZXkgfHwgJycpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdFx0Y29uc3Qgc2VsICAgICAgID0gYi5nZXRfc2VsZWN0ZWRfZmllbGQ/LigpO1xyXG5cdFx0XHRcdGNvbnN0IGlzU2VjdGlvbiA9IHNlbD8uY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApO1xyXG5cdFx0XHRcdGlmICggIXNlbCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Ly8gVW5pZmllZCBlbWl0dGVyIHRoYXQgYWx3YXlzIGluY2x1ZGVzIHRoZSBlbGVtZW50IHJlZmVyZW5jZS5cclxuXHRcdFx0XHRjb25zdCBFViAgICAgICAgICAgICAgPSBDb3JlLldQQkNfQkZCX0V2ZW50cztcclxuXHRcdFx0XHQvLyBTVFJVQ1RVUkVfQ0hBTkdFIGNhbiBiZSBcImV4cGVuc2l2ZVwiIGJlY2F1c2Ugb3RoZXIgbGlzdGVuZXJzIG1heSB0cmlnZ2VyIGZ1bGwgY2FudmFzIHJlZnJlc2guXHJcblx0XHRcdFx0Ly8gRGVib3VuY2Ugb25seSBjb250aW51b3VzIGNvbnRyb2xzIChlLmcuIHZhbHVlIHNsaWRlciBzY3J1YmJpbmcpIG9uIHRoZSBJTlBVVCBwaGFzZS5cclxuXHRcdFx0XHRjb25zdCBlbnN1cmVfc2NfZGVib3VuY2Vfc3RhdGUgPSAoKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZSA9IHsgdGltZXJfaWQ6IDAsIHBlbmRpbmdfcGF5bG9hZDogbnVsbCB9O1xyXG5cdFx0XHRcdFx0cmV0dXJuIGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZTtcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRjb25zdCBjYW5jZWxfc2NfZGVib3VuY2VkX2VtaXQgPSAoKSA9PiB7XHJcblx0XHRcdFx0XHRjb25zdCBzdCA9IGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZTtcclxuXHRcdFx0XHRcdGlmICggIXN0ICkgcmV0dXJuO1xyXG5cdFx0XHRcdFx0dHJ5IHsgY2xlYXJUaW1lb3V0KCBzdC50aW1lcl9pZCApOyB9IGNhdGNoICggXyApIHt9XHJcblx0XHRcdFx0XHRzdC50aW1lcl9pZCAgICAgICAgPSAwO1xyXG5cdFx0XHRcdFx0c3QucGVuZGluZ19wYXlsb2FkID0gbnVsbDtcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRjb25zdCBidXNfZW1pdF9jaGFuZ2UgPSAocmVhc29uLCBleHRyYSA9IHt9KSA9PiB7XHJcblx0XHRcdFx0XHQvLyBJZiB3ZeKAmXJlIGNvbW1pdHRpbmcgc29tZXRoaW5nIChjaGFuZ2UvYmx1ci9ldGMpLCBkcm9wIGFueSBwZW5kaW5nIFwiaW5wdXRcIiBlbWl0LlxyXG5cdFx0XHRcdFx0Y2FuY2VsX3NjX2RlYm91bmNlZF9lbWl0KCk7XHJcblx0XHRcdFx0XHRiLmJ1cz8uZW1pdD8uKCBFVi5TVFJVQ1RVUkVfQ0hBTkdFLCB7IHJlYXNvbiwgZWw6IHNlbCwgLi4uZXh0cmEgfSApO1xyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdGNvbnN0IGJ1c19lbWl0X2NoYW5nZV9kZWJvdW5jZWQgPSAocmVhc29uLCBleHRyYSA9IHt9LCB3YWl0X21zKSA9PiB7XHJcblx0XHRcdFx0XHRjb25zdCBzdCA9IGVuc3VyZV9zY19kZWJvdW5jZV9zdGF0ZSgpO1xyXG5cdFx0XHRcdFx0Y29uc3QgbXMgPSBOdW1iZXIuaXNGaW5pdGUoIHdhaXRfbXMgKVxyXG5cdFx0XHRcdFx0XHQ/IHdhaXRfbXNcclxuXHRcdFx0XHRcdFx0OiAoTnVtYmVyLmlzRmluaXRlKCBVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TICkgPyBVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TIDogMjQwKTtcclxuXHJcblx0XHRcdFx0XHQvLyBDYXB0dXJlIHRoZSBDVVJSRU5UIHNlbGVjdGVkIGVsZW1lbnQgaW50byB0aGUgcGF5bG9hZCBub3cgKHN0YWJsZSByZWYpLlxyXG5cdFx0XHRcdFx0c3QucGVuZGluZ19wYXlsb2FkID0geyByZWFzb24sIGVsOiBzZWwsIC4uLmV4dHJhLCBkZWJvdW5jZWQ6IHRydWUgfTtcclxuXHJcblx0XHRcdFx0XHR0cnkgeyBjbGVhclRpbWVvdXQoIHN0LnRpbWVyX2lkICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdFx0XHRcdHN0LnRpbWVyX2lkID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRzdC50aW1lcl9pZCA9IDA7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHBheWxvYWQgPSBzdC5wZW5kaW5nX3BheWxvYWQ7XHJcblx0XHRcdFx0XHRcdHN0LnBlbmRpbmdfcGF5bG9hZCA9IG51bGw7XHJcblx0XHRcdFx0XHRcdGlmICggcGF5bG9hZCApIHtcclxuXHRcdFx0XHRcdFx0XHRiLmJ1cz8uZW1pdD8uKCBFVi5TVFJVQ1RVUkVfQ0hBTkdFLCBwYXlsb2FkICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0sIG1zICk7XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0Ly8gLS0tLSBGSUVMRC9TRUNUSU9OOiBpbnRlcm5hbCBpZCAtLS0tXHJcblx0XHRcdFx0aWYgKCBrZXkgPT09ICdpZCcgKSB7XHJcblx0XHRcdFx0XHRjb25zdCB1bmlxdWUgPSBiLmlkLnNldF9maWVsZF9pZCggc2VsLCB0LnZhbHVlICk7XHJcblx0XHRcdFx0XHRpZiAoIGIucHJldmlld19tb2RlICYmICFpc1NlY3Rpb24gKSB7XHJcblx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCB0LnZhbHVlICE9PSB1bmlxdWUgKSB7XHJcblx0XHRcdFx0XHRcdHQudmFsdWUgPSB1bmlxdWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRidXNfZW1pdF9jaGFuZ2UoICdpZC1jaGFuZ2UnICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAtLS0tIEZJRUxEL1NFQ1RJT046IHB1YmxpYyBIVE1MIGlkIC0tLS1cclxuXHRcdFx0XHRpZiAoIGtleSA9PT0gJ2h0bWxfaWQnICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgYXBwbGllZCA9IGIuaWQuc2V0X2ZpZWxkX2h0bWxfaWQoIHNlbCwgdC52YWx1ZSApO1xyXG5cdFx0XHRcdFx0Ly8gRm9yIHNlY3Rpb25zLCBhbHNvIHNldCB0aGUgcmVhbCBET00gaWQgc28gYW5jaG9ycy9DU1MgY2FuIHRhcmdldCBpdC5cclxuXHRcdFx0XHRcdGlmICggaXNTZWN0aW9uICkge1xyXG5cdFx0XHRcdFx0XHRzZWwuaWQgPSBhcHBsaWVkIHx8ICcnO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggYi5wcmV2aWV3X21vZGUgKSB7XHJcblx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCB0LnZhbHVlICE9PSBhcHBsaWVkICkge1xyXG5cdFx0XHRcdFx0XHR0LnZhbHVlID0gYXBwbGllZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGJ1c19lbWl0X2NoYW5nZSggJ2h0bWwtaWQtY2hhbmdlJyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gLS0tLSBGSUVMRFMgT05MWTogbmFtZSAtLS0tXHJcblx0XHRcdFx0aWYgKCBrZXkgPT09ICduYW1lJyAmJiAhaXNTZWN0aW9uICkge1xyXG5cclxuXHRcdFx0XHRcdC8vIExpdmUgdHlwaW5nOiBzYW5pdGl6ZSBvbmx5IChOTyB1bmlxdWVuZXNzIHlldCkgdG8gYXZvaWQgXCItMlwiIHNwYW1cclxuXHRcdFx0XHRcdGlmICggZS50eXBlID09PSAnaW5wdXQnICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBiZWZvcmUgICAgPSB0LnZhbHVlO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBzYW5pdGl6ZWQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggYmVmb3JlICk7XHJcblx0XHRcdFx0XHRcdGlmICggYmVmb3JlICE9PSBzYW5pdGl6ZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gb3B0aW9uYWw6IHByZXNlcnZlIGNhcmV0IHRvIGF2b2lkIGp1bXBcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBzZWxTdGFydCA9IHQuc2VsZWN0aW9uU3RhcnQsIHNlbEVuZCA9IHQuc2VsZWN0aW9uRW5kO1xyXG5cdFx0XHRcdFx0XHRcdHQudmFsdWUgICAgICAgID0gc2FuaXRpemVkO1xyXG5cdFx0XHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdFx0XHR0LnNldFNlbGVjdGlvblJhbmdlKCBzZWxTdGFydCwgc2VsRW5kICk7XHJcblx0XHRcdFx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gdW5pcXVlbmVzcyBvbiBjaGFuZ2UvYmx1clxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIENvbW1pdCAoY2hhbmdlL2JsdXIpXHJcblx0XHRcdFx0XHRjb25zdCByYXcgPSBTdHJpbmcoIHQudmFsdWUgPz8gJycgKS50cmltKCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhcmF3ICkge1xyXG5cdFx0XHRcdFx0XHQvLyBSRVNFRUQ6IGtlZXAgbmFtZSBub24tZW1wdHkgYW5kIHByb3Zpc2lvbmFsIChhdXRvbmFtZSBzdGF5cyBPTilcclxuXHRcdFx0XHRcdFx0Y29uc3QgUyAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGJhc2UgPSBTLnNhbml0aXplX2h0bWxfbmFtZSggc2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaWQnICkgfHwgc2VsLmRhdGFzZXQuaWQgfHwgc2VsLmRhdGFzZXQudHlwZSB8fCAnZmllbGQnICk7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHVuaXEgPSBiLmlkLmVuc3VyZV91bmlxdWVfZmllbGRfbmFtZSggYmFzZSwgc2VsICk7XHJcblxyXG5cdFx0XHRcdFx0XHRzZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJywgdW5pcSApO1xyXG5cdFx0XHRcdFx0XHRzZWwuZGF0YXNldC5hdXRvbmFtZSAgICAgICAgICA9ICcxJztcclxuXHRcdFx0XHRcdFx0c2VsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgPSAnMCc7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBLZWVwIERPTSBpbiBzeW5jIGlmIHdl4oCZcmUgbm90IHJlLXJlbmRlcmluZ1xyXG5cdFx0XHRcdFx0XHRpZiAoICFiLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBjdHJsID0gc2VsLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dCx0ZXh0YXJlYSxzZWxlY3QnICk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBjdHJsICkgY3RybC5zZXRBdHRyaWJ1dGUoICduYW1lJywgdW5pcSApO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIHQudmFsdWUgIT09IHVuaXEgKSB0LnZhbHVlID0gdW5pcTtcclxuXHRcdFx0XHRcdFx0YnVzX2VtaXRfY2hhbmdlKCAnbmFtZS1yZXNlZWQnICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBOb24tZW1wdHkgY29tbWl0OiB1c2VyIHRha2VzIGNvbnRyb2w7IGRpc2FibGUgYXV0b25hbWUgZ29pbmcgZm9yd2FyZFxyXG5cdFx0XHRcdFx0c2VsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgPSAnMSc7XHJcblx0XHRcdFx0XHRzZWwuZGF0YXNldC5hdXRvbmFtZSAgICAgICAgICA9ICcwJztcclxuXHJcblx0XHRcdFx0XHRjb25zdCBzYW5pdGl6ZWQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggcmF3ICk7XHJcblx0XHRcdFx0XHRjb25zdCB1bmlxdWUgICAgPSBiLmlkLnNldF9maWVsZF9uYW1lKCBzZWwsIHNhbml0aXplZCApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggIWIucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBjdHJsID0gc2VsLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dCx0ZXh0YXJlYSxzZWxlY3QnICk7XHJcblx0XHRcdFx0XHRcdGlmICggY3RybCApIGN0cmwuc2V0QXR0cmlidXRlKCAnbmFtZScsIHVuaXF1ZSApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Yi5yZW5kZXJfcHJldmlldyggc2VsICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCB0LnZhbHVlICE9PSB1bmlxdWUgKSB0LnZhbHVlID0gdW5pcXVlO1xyXG5cdFx0XHRcdFx0YnVzX2VtaXRfY2hhbmdlKCAnbmFtZS1jaGFuZ2UnICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAtLS0tIFNFQ1RJT05TICYgRklFTERTOiBjc3NjbGFzcyAobGl2ZSBhcHBseTsgbm8gcmUtcmVuZGVyKSAtLS0tXHJcblx0XHRcdFx0aWYgKCBrZXkgPT09ICdjc3NjbGFzcycgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBuZXh0ICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0KCB0LnZhbHVlIHx8ICcnICk7XHJcblx0XHRcdFx0XHRjb25zdCBkZXNpcmVkQXJyID0gbmV4dC5zcGxpdCggL1xccysvICkuZmlsdGVyKCBCb29sZWFuICk7XHJcblx0XHRcdFx0XHRjb25zdCBkZXNpcmVkU2V0ID0gbmV3IFNldCggZGVzaXJlZEFyciApO1xyXG5cclxuXHRcdFx0XHRcdC8vIENvcmUgY2xhc3NlcyBhcmUgbmV2ZXIgdG91Y2hlZC5cclxuXHRcdFx0XHRcdGNvbnN0IGlzQ29yZSA9IChjbHMpID0+IGNscyA9PT0gJ2lzLXNlbGVjdGVkJyB8fCBjbHMuc3RhcnRzV2l0aCggJ3dwYmNfJyApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFNuYXBzaG90IGJlZm9yZSBtdXRhdGluZyAoRE9NVG9rZW5MaXN0IGlzIGxpdmUpLlxyXG5cdFx0XHRcdFx0Y29uc3QgYmVmb3JlQ2xhc3NlcyA9IEFycmF5LmZyb20oIHNlbC5jbGFzc0xpc3QgKTtcclxuXHRcdFx0XHRcdGNvbnN0IGN1c3RvbUJlZm9yZSAgPSBiZWZvcmVDbGFzc2VzLmZpbHRlciggKGMpID0+ICFpc0NvcmUoIGMgKSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFJlbW92ZSBzdHJheSBub24tY29yZSBjbGFzc2VzIG5vdCBpbiBkZXNpcmVkLlxyXG5cdFx0XHRcdFx0Y3VzdG9tQmVmb3JlLmZvckVhY2goIChjKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmICggIWRlc2lyZWRTZXQuaGFzKCBjICkgKSBzZWwuY2xhc3NMaXN0LnJlbW92ZSggYyApO1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFkZCBtaXNzaW5nIGRlc2lyZWQgY2xhc3NlcyBpbiBvbmUgZ28uXHJcblx0XHRcdFx0XHRjb25zdCBtaXNzaW5nID0gZGVzaXJlZEFyci5maWx0ZXIoIChjKSA9PiAhY3VzdG9tQmVmb3JlLmluY2x1ZGVzKCBjICkgKTtcclxuXHRcdFx0XHRcdGlmICggbWlzc2luZy5sZW5ndGggKSBzZWwuY2xhc3NMaXN0LmFkZCggLi4ubWlzc2luZyApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEtlZXAgZGF0YXNldCBpbiBzeW5jIChhdm9pZCB1c2VsZXNzIGF0dHJpYnV0ZSB3cml0ZXMpLlxyXG5cdFx0XHRcdFx0aWYgKCBzZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1jc3NjbGFzcycgKSAhPT0gbmV4dCApIHtcclxuXHRcdFx0XHRcdFx0c2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtY3NzY2xhc3MnLCBuZXh0ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gRW1pdCBvbmx5IGlmIHNvbWV0aGluZyBhY3R1YWxseSBjaGFuZ2VkLlxyXG5cdFx0XHRcdFx0Y29uc3QgYWZ0ZXJDbGFzc2VzID0gQXJyYXkuZnJvbSggc2VsLmNsYXNzTGlzdCApO1xyXG5cdFx0XHRcdFx0Y29uc3QgY2hhbmdlZCAgICAgID0gYWZ0ZXJDbGFzc2VzLmxlbmd0aCAhPT0gYmVmb3JlQ2xhc3Nlcy5sZW5ndGggfHwgYmVmb3JlQ2xhc3Nlcy5zb21lKCAoYywgaSkgPT4gYyAhPT0gYWZ0ZXJDbGFzc2VzW2ldICk7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgZGV0YWlsID0geyBrZXk6ICdjc3NjbGFzcycsIHBoYXNlOiBlLnR5cGUgfTtcclxuXHRcdFx0XHRcdGlmICggaXNTZWN0aW9uICkge1xyXG5cdFx0XHRcdFx0XHRidXNfZW1pdF9jaGFuZ2UoICdjc3NjbGFzcy1jaGFuZ2UnLCBkZXRhaWwgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGJ1c19lbWl0X2NoYW5nZSggJ3Byb3AtY2hhbmdlJywgZGV0YWlsICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdFx0Ly8gLS0tLSBTRUNUSU9OUzogbGFiZWwgLS0tLVxyXG5cdFx0XHRcdGlmICggaXNTZWN0aW9uICYmIGtleSA9PT0gJ2xhYmVsJyApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHZhbCA9IFN0cmluZyggdC52YWx1ZSA/PyAnJyApO1xyXG5cdFx0XHRcdFx0c2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbGFiZWwnLCB2YWwgKTtcclxuXHRcdFx0XHRcdGJ1c19lbWl0X2NoYW5nZSggJ2xhYmVsLWNoYW5nZScgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIC0tLS0gRklFTERTOiBsYWJlbCAoYXV0by1uYW1lIHdoaWxlIHR5cGluZzsgZnJlZXplIG9uIGNvbW1pdCkgLS0tLVxyXG5cdFx0XHRcdGlmICggIWlzU2VjdGlvbiAmJiBrZXkgPT09ICdsYWJlbCcgKSB7XHJcblx0XHRcdFx0XHRjb25zdCB2YWwgICAgICAgICA9IFN0cmluZyggdC52YWx1ZSA/PyAnJyApO1xyXG5cdFx0XHRcdFx0c2VsLmRhdGFzZXQubGFiZWwgPSB2YWw7XHJcblxyXG5cdFx0XHRcdFx0Ly8gd2hpbGUgdHlwaW5nLCBhbGxvdyBhdXRvLW5hbWUgKGlmIGZsYWdzIHBlcm1pdClcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZS5tYXliZV9hdXRvbmFtZV9mcm9tX2xhYmVsKCBiLCBzZWwsIHZhbCApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gaWYgdXNlciBjb21taXR0ZWQgdGhlIGxhYmVsIChibHVyL2NoYW5nZSksIGZyZWV6ZSBmdXR1cmUgYXV0by1uYW1lXHJcblx0XHRcdFx0XHRpZiAoIGUudHlwZSAhPT0gJ2lucHV0JyApIHtcclxuXHRcdFx0XHRcdFx0c2VsLmRhdGFzZXQuYXV0b25hbWUgPSAnMCc7ICAgLy8gc3RvcCBmdXR1cmUgbGFiZWwtPm5hbWUgc3luY1xyXG5cdFx0XHRcdFx0XHRzZWwuZGF0YXNldC5mcmVzaCAgICA9ICcwJzsgICAvLyBhbHNvIGtpbGwgdGhlIFwiZnJlc2hcIiBlc2NhcGUgaGF0Y2hcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBPcHRpb25hbCBVSSBuaWNldHk6IGRpc2FibGUgTmFtZSB3aGVuIGF1dG8gaXMgT04sIGVuYWJsZSB3aGVuIE9GRlxyXG5cdFx0XHRcdFx0Y29uc3QgaW5zICAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0XHRjb25zdCBuYW1lQ3RybCA9IGlucz8ucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJuYW1lXCJdJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBuYW1lQ3RybCApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgYXV0b0FjdGl2ZSA9XHJcblx0XHRcdFx0XHRcdFx0XHQgIChzZWwuZGF0YXNldC5hdXRvbmFtZSA/PyAnMScpICE9PSAnMCcgJiZcclxuXHRcdFx0XHRcdFx0XHRcdCAgc2VsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgIT09ICcxJyAmJlxyXG5cdFx0XHRcdFx0XHRcdFx0ICBzZWwuZGF0YXNldC53YXNfbG9hZGVkICE9PSAnMSc7XHJcblx0XHRcdFx0XHRcdG5hbWVDdHJsLnRvZ2dsZUF0dHJpYnV0ZSggJ2Rpc2FibGVkJywgYXV0b0FjdGl2ZSApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIGF1dG9BY3RpdmUgJiYgIW5hbWVDdHJsLnBsYWNlaG9sZGVyICkge1xyXG5cdFx0XHRcdFx0XHRcdG5hbWVDdHJsLnBsYWNlaG9sZGVyID0gYj8uaTE4bj8uYXV0b19mcm9tX2xhYmVsID8/ICdhdXRvIOKAlCBmcm9tIGxhYmVsJztcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRpZiAoICFhdXRvQWN0aXZlICYmIG5hbWVDdHJsLnBsYWNlaG9sZGVyID09PSAoYj8uaTE4bj8uYXV0b19mcm9tX2xhYmVsID8/ICdhdXRvIOKAlCBmcm9tIGxhYmVsJykgKSB7XHJcblx0XHRcdFx0XHRcdFx0bmFtZUN0cmwucGxhY2Vob2xkZXIgPSAnJztcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIEFsd2F5cyByZS1yZW5kZXIgdGhlIHByZXZpZXcgc28gbGFiZWwgY2hhbmdlcyBhcmUgdmlzaWJsZSBpbW1lZGlhdGVseS5cclxuXHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0YnVzX2VtaXRfY2hhbmdlKCAnbGFiZWwtY2hhbmdlJyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHRcdC8vIC0tLS0gREVGQVVMVCAoR0VORVJJQyk6IGRhdGFzZXQgd3JpdGVyIGZvciBib3RoIGZpZWxkcyAmIHNlY3Rpb25zIC0tLS1cclxuXHRcdFx0XHQvLyBBbnkgaW5zcGVjdG9yIGNvbnRyb2wgd2l0aCBbZGF0YS1pbnNwZWN0b3Ita2V5XSB0aGF0IGRvZXNuJ3QgaGF2ZSBhIGN1c3RvbVxyXG5cdFx0XHRcdC8vIGFkYXB0ZXIvdmFsdWVfZnJvbSB3aWxsIHNpbXBseSByZWFkL3dyaXRlIHNlbC5kYXRhc2V0W2tleV0uXHJcblx0XHRcdFx0aWYgKCBrZXkgKSB7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3Qgc2VsZkxvY2tlZCA9IC9eKDF8dHJ1ZXx5ZXMpJC9pLnRlc3QoICh0LmRhdGFzZXQ/LmxvY2tlZCB8fCAnJykudHJpbSgpICk7XHJcblx0XHRcdFx0XHRpZiAoIHNlbGZMb2NrZWQgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBTa2lwIGtleXMgd2UgaGFuZGxlZCBhYm92ZSB0byBhdm9pZCBkb3VibGUgd29yay5cclxuXHRcdFx0XHRcdGlmICgga2V5ID09PSAnaWQnIHx8IGtleSA9PT0gJ25hbWUnIHx8IGtleSA9PT0gJ2h0bWxfaWQnIHx8IGtleSA9PT0gJ2Nzc2NsYXNzJyB8fCBrZXkgPT09ICdsYWJlbCcgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGxldCBuZXh0VmFsID0gJyc7XHJcblx0XHRcdFx0XHRpZiAoIHQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmICh0LnR5cGUgPT09ICdjaGVja2JveCcgfHwgdC50eXBlID09PSAncmFkaW8nKSApIHtcclxuXHRcdFx0XHRcdFx0Ly8gUGVyc2lzdCBib3RoIGJvb2xlYW4gc3RhdGVzIGV4cGxpY2l0bHkgc28gc2NoZW1hIGRlZmF1bHRzIGNhbm5vdCByZXBsYWNlIGZhbHNlLlxyXG5cdFx0XHRcdFx0XHRuZXh0VmFsID0gdC5jaGVja2VkID8gJ3RydWUnIDogJ2ZhbHNlJztcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoICd2YWx1ZScgaW4gdCApIHtcclxuXHRcdFx0XHRcdFx0bmV4dFZhbCA9IFN0cmluZyggdC52YWx1ZSA/PyAnJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly8gUGVyc2lzdCB0byBkYXRhc2V0LlxyXG5cdFx0XHRcdFx0aWYgKCBzZWw/LmRhdGFzZXQgKSBzZWwuZGF0YXNldFtrZXldID0gbmV4dFZhbDtcclxuXHJcblx0XHRcdFx0XHQvLyBHZW5lcmF0b3IgY29udHJvbHMgYXJlIFwiVUkgaW5wdXRzXCIg4oCUIGF2b2lkIFNUUlVDVFVSRV9DSEFOR0Ugc3BhbSB3aGlsZSBkcmFnZ2luZy90eXBpbmcuXHJcblx0XHRcdFx0XHRjb25zdCBpc19nZW5fa2V5ID0gKGtleS5pbmRleE9mKCAnZ2VuXycgKSA9PT0gMCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmUtcmVuZGVyIG9uIHZpc3VhbCBrZXlzIHNvIHByZXZpZXcgc3RheXMgaW4gc3luYyAoY2FsZW5kYXIgbGFiZWwvaGVscCwgZXRjLikuXHJcblx0XHRcdFx0XHRjb25zdCB2aXN1YWxLZXlzID0gbmV3IFNldCggWyAnaGVscCcsICdwbGFjZWhvbGRlcicsICdtaW5fd2lkdGgnLCAnY3NzY2xhc3MnIF0gKTtcclxuXHRcdFx0XHRcdGlmICggIWlzU2VjdGlvbiAmJiAodmlzdWFsS2V5cy5oYXMoIGtleSApIHx8IGtleS5zdGFydHNXaXRoKCAndWlfJyApKSApIHtcclxuXHRcdFx0XHRcdFx0Ly8gTGlnaHQgaGV1cmlzdGljOiBvbmx5IHJlLXJlbmRlciBvbiBjb21taXQgZm9yIGhlYXZ5IGlucHV0czsgbGl2ZSBmb3Igc2hvcnQgb25lcyBpcyBmaW5lLlxyXG5cdFx0XHRcdFx0XHRpZiAoIGUudHlwZSA9PT0gJ2NoYW5nZScgfHwga2V5ID09PSAnaGVscCcgfHwga2V5ID09PSAncGxhY2Vob2xkZXInICkge1xyXG5cdFx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhKGlzX2dlbl9rZXkgJiYgZS50eXBlID09PSAnaW5wdXQnKSApIHtcclxuXHRcdFx0XHRcdFx0Ly8gRGVib3VuY2UgY29udGludW91cyB2YWx1ZSBzbGlkZXIgaW5wdXQgZXZlbnRzIHRvIGF2b2lkIGZ1bGwtY2FudmFzIHJlZnJlc2ggc3BhbS5cclxuXHRcdFx0XHRcdFx0Ly8gV2UgZGV0ZWN0IHRoZSBzbGlkZXIgZ3JvdXAgdmlhIFtkYXRhLWxlbi1ncm91cF0gd3JhcHBlci5cclxuXHRcdFx0XHRcdFx0Y29uc3QgaXNfbGVuX2dyb3VwX2N0cmwgPSAhISh0ICYmIHQuY2xvc2VzdCAmJiB0LmNsb3Nlc3QoICdbZGF0YS1sZW4tZ3JvdXBdJyApKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggaXNfbGVuX2dyb3VwX2N0cmwgJiYgZS50eXBlID09PSAnaW5wdXQnICkge1xyXG5cdFx0XHRcdFx0XHRcdGJ1c19lbWl0X2NoYW5nZV9kZWJvdW5jZWQoICdwcm9wLWNoYW5nZScsIHsga2V5LCBwaGFzZTogZS50eXBlIH0gKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRidXNfZW1pdF9jaGFuZ2UoICdwcm9wLWNoYW5nZScsIHsga2V5LCBwaGFzZTogZS50eXBlIH0gKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGlucy5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgaGFuZGxlciwgdHJ1ZSApO1xyXG5cdFx0XHQvLyByZWZsZWN0IGluc3RhbnRseSB3aGlsZSB0eXBpbmcgYXMgd2VsbC5cclxuXHRcdFx0aW5zLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGhhbmRsZXIsIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gSW5zcGVjdG9yIGFmdGVyIGEgZmllbGQgaXMgYWRkZWQuXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICovXHJcblx0XHRfb3Blbl9pbnNwZWN0b3JfYWZ0ZXJfZmllbGRfYWRkZWQoKSB7XHJcblx0XHRcdGNvbnN0IEVWID0gQ29yZS5XUEJDX0JGQl9FdmVudHM7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uYnVzPy5vbj8uKCBFVi5GSUVMRF9BREQsIChlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgZWwgPSBlPy5kZXRhaWw/LmVsIHx8IG51bGw7XHJcblx0XHRcdFx0aWYgKCBlbCAmJiB0aGlzLmJ1aWxkZXI/LnNlbGVjdF9maWVsZCApIHtcclxuXHRcdFx0XHRcdHRoaXMuYnVpbGRlci5zZWxlY3RfZmllbGQoIGVsLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gU2hvdyBJbnNwZWN0b3IgUGFsZXR0ZS5cclxuXHRcdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZShcclxuXHRcdFx0XHRcdCd3cGJjX2JmYjpzaG93X3BhbmVsJyxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0cGFuZWxfaWQ6ICd3cGJjX2JmYl9faW5zcGVjdG9yJyxcclxuXHRcdFx0XHRcdFx0dGFiX2lkICA6ICd3cGJjX3RhYl9pbnNwZWN0b3InXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEtleWJvYXJkIHNob3J0Y3V0cyBmb3Igc2VsZWN0aW9uLCBkZWxldGlvbiwgYW5kIG1vdmVtZW50LlxyXG5cdCAqL1xyXG5cdFVJLldQQkNfQkZCX0tleWJvYXJkX0NvbnRyb2xsZXIgPSBjbGFzcyBleHRlbmRzIFVJLldQQkNfQkZCX01vZHVsZSB7XHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLl9vbl9rZXkgPSB0aGlzLm9uX2tleS5iaW5kKCB0aGlzICk7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgdGhpcy5fb25fa2V5LCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCB0aGlzLl9vbl9rZXksIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBlICovXHJcblx0XHRvbl9rZXkoZSkge1xyXG5cdFx0XHRjb25zdCBiICAgICAgICAgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGNvbnN0IGlzX3R5cGluZyA9IHRoaXMuX2lzX3R5cGluZ19hbnl3aGVyZSgpO1xyXG5cdFx0XHRpZiAoIGUua2V5ID09PSAnRXNjYXBlJyApIHtcclxuXHRcdFx0XHRpZiAoIGlzX3R5cGluZyApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmJ1cy5lbWl0KCBDb3JlLldQQkNfQkZCX0V2ZW50cy5DTEVBUl9TRUxFQ1RJT04sIHsgc291cmNlOiAnZXNjJyB9ICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHNlbGVjdGVkID0gYi5nZXRfc2VsZWN0ZWRfZmllbGQ/LigpO1xyXG5cdFx0XHRpZiAoICFzZWxlY3RlZCB8fCBpc190eXBpbmcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZS5rZXkgPT09ICdEZWxldGUnIHx8IGUua2V5ID09PSAnQmFja3NwYWNlJyApIHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0Yi5kZWxldGVfaXRlbT8uKCBzZWxlY3RlZCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIChlLmFsdEtleSB8fCBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5KSAmJiAoZS5rZXkgPT09ICdBcnJvd1VwJyB8fCBlLmtleSA9PT0gJ0Fycm93RG93bicpICYmICFlLnNoaWZ0S2V5ICkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRjb25zdCBkaXIgPSAoZS5rZXkgPT09ICdBcnJvd1VwJykgPyAndXAnIDogJ2Rvd24nO1xyXG5cdFx0XHRcdGIubW92ZV9pdGVtPy4oIHNlbGVjdGVkLCBkaXIgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBlLmtleSA9PT0gJ0VudGVyJyApIHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0Yi5zZWxlY3RfZmllbGQoIHNlbGVjdGVkLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBAcmV0dXJucyB7Ym9vbGVhbn0gKi9cclxuXHRcdF9pc190eXBpbmdfYW55d2hlcmUoKSB7XHJcblx0XHRcdGNvbnN0IGEgICA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XHJcblx0XHRcdGNvbnN0IHRhZyA9IGE/LnRhZ05hbWU7XHJcblx0XHRcdGlmICggdGFnID09PSAnSU5QVVQnIHx8IHRhZyA9PT0gJ1RFWFRBUkVBJyB8fCB0YWcgPT09ICdTRUxFQ1QnIHx8IChhPy5pc0NvbnRlbnRFZGl0YWJsZSA9PT0gdHJ1ZSkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRyZXR1cm4gISEoaW5zICYmIGEgJiYgaW5zLmNvbnRhaW5zKCBhICkpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbHVtbiByZXNpemUgbG9naWMgZm9yIHNlY3Rpb24gcm93cy5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9SZXNpemVfQ29udHJvbGxlciA9IGNsYXNzIGV4dGVuZHMgVUkuV1BCQ19CRkJfTW9kdWxlIHtcclxuXHRcdGluaXQoKSB7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5pbml0X3Jlc2l6ZV9oYW5kbGVyID0gdGhpcy5oYW5kbGVfcmVzaXplLmJpbmQoIHRoaXMgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIHJlYWQgdGhlIENTUyB2YXIgKGtlcHQgbG9jYWwgc28gaXQgZG9lc27igJl0IGRlcGVuZCBvbiB0aGUgTWluLVdpZHRoIG1vZHVsZSlcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gY29sXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfG51bWJlcn1cclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKi9cclxuXHRcdF9nZXRfY29sX21pbl9weChjb2wpIHtcclxuXHRcdFx0Y29uc3QgdiA9IGdldENvbXB1dGVkU3R5bGUoIGNvbCApLmdldFByb3BlcnR5VmFsdWUoICctLXdwYmMtY29sLW1pbicgKSB8fCAnMCc7XHJcblx0XHRcdGNvbnN0IG4gPSBwYXJzZUZsb2F0KCB2ICk7XHJcblx0XHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIG4gKSA/IE1hdGgubWF4KCAwLCBuICkgOiAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBAcGFyYW0ge01vdXNlRXZlbnR9IGUgKi9cclxuXHRcdGhhbmRsZV9yZXNpemUoZSkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGlmICggZS5idXR0b24gIT09IDAgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCByZXNpemVyICAgPSBlLmN1cnJlbnRUYXJnZXQ7XHJcblx0XHRcdGNvbnN0IHJvd19lbCAgICA9IHJlc2l6ZXIucGFyZW50RWxlbWVudDtcclxuXHRcdFx0Y29uc3QgY29scyAgICAgID0gQXJyYXkuZnJvbSggcm93X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKSApO1xyXG5cdFx0XHRjb25zdCBsZWZ0X2NvbCAgPSByZXNpemVyPy5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xyXG5cdFx0XHRjb25zdCByaWdodF9jb2wgPSByZXNpemVyPy5uZXh0RWxlbWVudFNpYmxpbmc7XHJcblx0XHRcdGlmICggIWxlZnRfY29sIHx8ICFyaWdodF9jb2wgfHwgIWxlZnRfY29sLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19jb2x1bW4nICkgfHwgIXJpZ2h0X2NvbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fY29sdW1uJyApICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgbGVmdF9pbmRleCAgPSBjb2xzLmluZGV4T2YoIGxlZnRfY29sICk7XHJcblx0XHRcdGNvbnN0IHJpZ2h0X2luZGV4ID0gY29scy5pbmRleE9mKCByaWdodF9jb2wgKTtcclxuXHRcdFx0aWYgKCBsZWZ0X2luZGV4ID09PSAtMSB8fCByaWdodF9pbmRleCAhPT0gbGVmdF9pbmRleCArIDEgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBzdGFydF94ICAgICAgICA9IGUuY2xpZW50WDtcclxuXHRcdFx0Y29uc3QgbGVmdF9zdGFydF9weCAgPSBsZWZ0X2NvbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aDtcclxuXHRcdFx0Y29uc3QgcmlnaHRfc3RhcnRfcHggPSByaWdodF9jb2wuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XHJcblx0XHRcdGNvbnN0IHBhaXJfcHggICAgICAgID0gTWF0aC5tYXgoIDAsIGxlZnRfc3RhcnRfcHggKyByaWdodF9zdGFydF9weCApO1xyXG5cclxuXHRcdFx0Y29uc3QgZ3AgICAgICAgICA9IGIuY29sX2dhcF9wZXJjZW50O1xyXG5cdFx0XHRjb25zdCBjb21wdXRlZCAgID0gYi5sYXlvdXQuY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3coIHJvd19lbCwgZ3AgKTtcclxuXHRcdFx0Y29uc3QgYXZhaWxhYmxlICA9IGNvbXB1dGVkLmF2YWlsYWJsZTsgICAgICAgICAgICAgICAgIC8vICUgb2YgdGhlIOKAnGZ1bGwgMTAw4oCdIGFmdGVyIGdhcHNcclxuXHRcdFx0Y29uc3QgYmFzZXMgICAgICA9IGNvbXB1dGVkLmJhc2VzLnNsaWNlKCAwICk7ICAgICAgICAgICAgLy8gY3VycmVudCBlZmZlY3RpdmUgJVxyXG5cdFx0XHRjb25zdCBwYWlyX2F2YWlsID0gYmFzZXNbbGVmdF9pbmRleF0gKyBiYXNlc1tyaWdodF9pbmRleF07XHJcblxyXG5cdFx0XHQvLyBCYWlsIGlmIHdlIGNhbuKAmXQgY29tcHV0ZSBzYW5lIGRlbHRhcy5cclxuXHRcdFx0aWYgKCFwYWlyX3B4IHx8ICFOdW1iZXIuaXNGaW5pdGUocGFpcl9hdmFpbCkgfHwgcGFpcl9hdmFpbCA8PSAwKSByZXR1cm47XHJcblxyXG5cdFx0XHQvLyAtLS0gTUlOIENMQU1QUyAocGl4ZWxzKSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGNvbnN0IHBjdFRvUHggICAgICAgPSAocGN0KSA9PiAocGFpcl9weCAqIChwY3QgLyBwYWlyX2F2YWlsKSk7IC8vIHBhaXItbG9jYWwgcGVyY2VudCAtPiBweFxyXG5cdFx0XHRjb25zdCBnZW5lcmljTWluUGN0ID0gTWF0aC5taW4oIDAuMSwgYXZhaWxhYmxlICk7ICAgICAgICAgICAgICAgICAgLy8gb3JpZ2luYWwgMC4xJSBmbG9vciAoaW4g4oCcYXZhaWxhYmxlICXigJ0gc3BhY2UpXHJcblx0XHRcdGNvbnN0IGdlbmVyaWNNaW5QeCAgPSBwY3RUb1B4KCBnZW5lcmljTWluUGN0ICk7XHJcblxyXG5cdFx0XHRjb25zdCBsZWZ0TWluUHggID0gTWF0aC5tYXgoIHRoaXMuX2dldF9jb2xfbWluX3B4KCBsZWZ0X2NvbCApLCBnZW5lcmljTWluUHggKTtcclxuXHRcdFx0Y29uc3QgcmlnaHRNaW5QeCA9IE1hdGgubWF4KCB0aGlzLl9nZXRfY29sX21pbl9weCggcmlnaHRfY29sICksIGdlbmVyaWNNaW5QeCApO1xyXG5cclxuXHRcdFx0Ly8gZnJlZXplIHRleHQgc2VsZWN0aW9uICsgY3Vyc29yXHJcblx0XHRcdGNvbnN0IHByZXZfdXNlcl9zZWxlY3QgICAgICAgICA9IGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdDtcclxuXHRcdFx0ZG9jdW1lbnQuYm9keS5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xyXG5cdFx0XHRyb3dfZWwuc3R5bGUuY3Vyc29yICAgICAgICAgICAgPSAnY29sLXJlc2l6ZSc7XHJcblxyXG5cdFx0XHRjb25zdCBvbl9tb3VzZV9tb3ZlID0gKGV2KSA9PiB7XHJcblx0XHRcdFx0aWYgKCAhcGFpcl9weCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Ly8gd29yayBpbiBwaXhlbHMsIGNsYW1wIGJ5IGVhY2ggc2lkZeKAmXMgbWluXHJcblx0XHRcdFx0Y29uc3QgZGVsdGFfcHggICA9IGV2LmNsaWVudFggLSBzdGFydF94O1xyXG5cdFx0XHRcdGxldCBuZXdMZWZ0UHggICAgPSBsZWZ0X3N0YXJ0X3B4ICsgZGVsdGFfcHg7XHJcblx0XHRcdFx0bmV3TGVmdFB4ICAgICAgICA9IE1hdGgubWF4KCBsZWZ0TWluUHgsIE1hdGgubWluKCBwYWlyX3B4IC0gcmlnaHRNaW5QeCwgbmV3TGVmdFB4ICkgKTtcclxuXHRcdFx0XHRjb25zdCBuZXdSaWdodFB4ID0gcGFpcl9weCAtIG5ld0xlZnRQeDtcclxuXHJcblx0XHRcdFx0Ly8gdHJhbnNsYXRlIGJhY2sgdG8gcGFpci1sb2NhbCBwZXJjZW50YWdlc1xyXG5cdFx0XHRcdGNvbnN0IG5ld0xlZnRQY3QgICAgICA9IChuZXdMZWZ0UHggLyBwYWlyX3B4KSAqIHBhaXJfYXZhaWw7XHJcblx0XHRcdFx0Y29uc3QgbmV3QmFzZXMgICAgICAgID0gYmFzZXMuc2xpY2UoIDAgKTtcclxuXHRcdFx0XHRuZXdCYXNlc1tsZWZ0X2luZGV4XSAgPSBuZXdMZWZ0UGN0O1xyXG5cdFx0XHRcdG5ld0Jhc2VzW3JpZ2h0X2luZGV4XSA9IHBhaXJfYXZhaWwgLSBuZXdMZWZ0UGN0O1xyXG5cclxuXHRcdFx0XHRiLmxheW91dC5hcHBseV9iYXNlc190b19yb3coIHJvd19lbCwgbmV3QmFzZXMgKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGNvbnN0IG9uX21vdXNlX3VwID0gKCkgPT4ge1xyXG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdtb3VzZW1vdmUnLCBvbl9tb3VzZV9tb3ZlICk7XHJcblx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ21vdXNldXAnLCBvbl9tb3VzZV91cCApO1xyXG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIG9uX21vdXNlX3VwICk7XHJcblx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ21vdXNlbGVhdmUnLCBvbl9tb3VzZV91cCApO1xyXG5cdFx0XHRcdGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9IHByZXZfdXNlcl9zZWxlY3QgfHwgJyc7XHJcblx0XHRcdFx0cm93X2VsLnN0eWxlLmN1cnNvciAgICAgICAgICAgID0gJyc7XHJcblxyXG5cdFx0XHRcdC8vIG5vcm1hbGl6ZSB0byB0aGUgcm934oCZcyBhdmFpbGFibGUgJSBhZ2FpblxyXG5cdFx0XHRcdGNvbnN0IG5vcm1hbGl6ZWQgPSBiLmxheW91dC5jb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3Jvdyggcm93X2VsLCBncCApO1xyXG5cdFx0XHRcdGIubGF5b3V0LmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93X2VsLCBub3JtYWxpemVkLmJhc2VzICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vtb3ZlJywgb25fbW91c2VfbW92ZSApO1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIG9uX21vdXNlX3VwICk7XHJcblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIG9uX21vdXNlX3VwICk7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWxlYXZlJywgb25fbW91c2VfdXAgKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogUGFnZSBhbmQgc2VjdGlvbiBjcmVhdGlvbiwgcmVidWlsZGluZywgYW5kIG5lc3RlZCBTb3J0YWJsZSBzZXR1cC5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9QYWdlc19TZWN0aW9ucyA9IGNsYXNzIGV4dGVuZHMgVUkuV1BCQ19CRkJfTW9kdWxlIHtcclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuYWRkX3BhZ2UgICAgICAgICAgICAgICAgICA9IChvcHRzKSA9PiB0aGlzLmFkZF9wYWdlKCBvcHRzICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5hZGRfc2VjdGlvbiAgICAgICAgICAgICAgID0gKGNvbnRhaW5lciwgY29scykgPT4gdGhpcy5hZGRfc2VjdGlvbiggY29udGFpbmVyLCBjb2xzICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5yZWJ1aWxkX3NlY3Rpb24gICAgICAgICAgID0gKHNlY3Rpb25fZGF0YSwgY29udGFpbmVyKSA9PiB0aGlzLnJlYnVpbGRfc2VjdGlvbiggc2VjdGlvbl9kYXRhLCBjb250YWluZXIgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLmluaXRfYWxsX25lc3RlZF9zb3J0YWJsZXMgPSAoZWwpID0+IHRoaXMuaW5pdF9hbGxfbmVzdGVkX3NvcnRhYmxlcyggZWwgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLmluaXRfc2VjdGlvbl9zb3J0YWJsZSAgICAgPSAoZWwpID0+IHRoaXMuaW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBlbCApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIucGFnZXNfc2VjdGlvbnMgICAgICAgICAgICA9IHRoaXM7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHaXZlIGV2ZXJ5IGZpZWxkL3NlY3Rpb24gaW4gYSBjbG9uZWQgc3VidHJlZSBhIGZyZXNoIGRhdGEtdWlkIHNvXHJcblx0XHQgKiB1bmlxdWVuZXNzIGNoZWNrcyBkb24ndCBleGNsdWRlIHRoZWlyIG9yaWdpbmFscy5cclxuXHRcdCAqL1xyXG5cdFx0X3JldGFnX3VpZHNfaW5fc3VidHJlZShyb290KSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGlmICggIXJvb3QgKSByZXR1cm47XHJcblx0XHRcdGNvbnN0IG5vZGVzID0gW107XHJcblx0XHRcdGlmICggcm9vdC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgfHwgcm9vdC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkge1xyXG5cdFx0XHRcdG5vZGVzLnB1c2goIHJvb3QgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRub2Rlcy5wdXNoKCAuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3NlY3Rpb24sIC53cGJjX2JmYl9fZmllbGQnICkgKTtcclxuXHRcdFx0bm9kZXMuZm9yRWFjaCggKGVsKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcHJlZml4ICAgPSBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSA/ICdzJyA6ICdmJztcclxuXHRcdFx0XHRlbC5kYXRhc2V0LnVpZCA9IGAke3ByZWZpeH0tJHsrK2IuX3VpZF9jb3VudGVyfS0ke0RhdGUubm93KCl9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZyggMzYgKS5zbGljZSggMiwgNyApfWA7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJ1bXAgXCJmb29cIiwgXCJmb28tMlwiLCBcImZvby0zXCIsIC4uLlxyXG5cdFx0ICovXHJcblx0XHRfbWFrZV91bmlxdWUoYmFzZSwgdGFrZW4pIHtcclxuXHRcdFx0Y29uc3QgcyA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdGxldCB2ICAgPSBTdHJpbmcoIGJhc2UgfHwgJycgKTtcclxuXHRcdFx0aWYgKCAhdiApIHYgPSAnZmllbGQnO1xyXG5cdFx0XHRjb25zdCBtICA9IHYubWF0Y2goIC8tKFxcZCspJC8gKTtcclxuXHRcdFx0bGV0IG4gICAgPSBtID8gKHBhcnNlSW50KCBtWzFdLCAxMCApIHx8IDEpIDogMTtcclxuXHRcdFx0bGV0IHN0ZW0gPSBtID8gdi5yZXBsYWNlKCAvLVxcZCskLywgJycgKSA6IHY7XHJcblx0XHRcdHdoaWxlICggdGFrZW4uaGFzKCB2ICkgKSB7XHJcblx0XHRcdFx0biA9IE1hdGgubWF4KCAyLCBuICsgMSApO1xyXG5cdFx0XHRcdHYgPSBgJHtzdGVtfS0ke259YDtcclxuXHRcdFx0fVxyXG5cdFx0XHR0YWtlbi5hZGQoIHYgKTtcclxuXHRcdFx0cmV0dXJuIHY7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdHJpY3QsIG9uZS1wYXNzIGRlLWR1cGxpY2F0aW9uIGZvciBhIG5ld2x5LWluc2VydGVkIHN1YnRyZWUuXHJcblx0XHQgKiAtIEVuc3VyZXMgdW5pcXVlIGRhdGEtaWQgKGludGVybmFsKSwgZGF0YS1uYW1lIChmaWVsZHMpLCBkYXRhLWh0bWxfaWQgKHB1YmxpYylcclxuXHRcdCAqIC0gQWxzbyB1cGRhdGVzIERPTTogPHNlY3Rpb24gaWQ+LCA8aW5wdXQgaWQ+LCA8bGFiZWwgZm9yPiwgYW5kIGlucHV0W25hbWVdLlxyXG5cdFx0ICovXHJcblx0XHRfZGVkdXBlX3N1YnRyZWVfc3RyaWN0KHJvb3QpIHtcclxuXHRcdFx0Y29uc3QgYiA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Y29uc3QgcyA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdGlmICggIXJvb3QgfHwgIWI/LnBhZ2VzX2NvbnRhaW5lciApIHJldHVybjtcclxuXHJcblx0XHRcdC8vIDEpIEJ1aWxkIFwidGFrZW5cIiBzZXRzIGZyb20gb3V0c2lkZSB0aGUgc3VidHJlZS5cclxuXHRcdFx0Y29uc3QgdGFrZW5EYXRhSWQgICA9IG5ldyBTZXQoKTtcclxuXHRcdFx0Y29uc3QgdGFrZW5EYXRhTmFtZSA9IG5ldyBTZXQoKTtcclxuXHRcdFx0Y29uc3QgdGFrZW5IdG1sSWQgICA9IG5ldyBTZXQoKTtcclxuXHRcdFx0Y29uc3QgdGFrZW5Eb21JZCAgICA9IG5ldyBTZXQoKTtcclxuXHJcblx0XHRcdC8vIEFsbCBmaWVsZHMvc2VjdGlvbnMgb3V0c2lkZSByb290XHJcblx0XHRcdGIucGFnZXNfY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2ZpZWxkLCAud3BiY19iZmJfX3NlY3Rpb24nICkuZm9yRWFjaCggZWwgPT4ge1xyXG5cdFx0XHRcdGlmICggcm9vdC5jb250YWlucyggZWwgKSApIHJldHVybjtcclxuXHRcdFx0XHRjb25zdCBkaWQgID0gZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1pZCcgKTtcclxuXHRcdFx0XHRjb25zdCBkbmFtID0gZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJyApO1xyXG5cdFx0XHRcdGNvbnN0IGhpZCAgPSBlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWh0bWxfaWQnICk7XHJcblx0XHRcdFx0aWYgKCBkaWQgKSB0YWtlbkRhdGFJZC5hZGQoIGRpZCApO1xyXG5cdFx0XHRcdGlmICggZG5hbSApIHRha2VuRGF0YU5hbWUuYWRkKCBkbmFtICk7XHJcblx0XHRcdFx0aWYgKCBoaWQgKSB0YWtlbkh0bWxJZC5hZGQoIGhpZCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBBbGwgRE9NIGlkcyBvdXRzaWRlIHJvb3QgKGxhYmVscywgaW5wdXRzLCBhbnl0aGluZylcclxuXHRcdFx0ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tpZF0nICkuZm9yRWFjaCggZWwgPT4ge1xyXG5cdFx0XHRcdGlmICggcm9vdC5jb250YWlucyggZWwgKSApIHJldHVybjtcclxuXHRcdFx0XHRpZiAoIGVsLmlkICkgdGFrZW5Eb21JZC5hZGQoIGVsLmlkICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGNvbnN0IG5vZGVzID0gW107XHJcblx0XHRcdGlmICggcm9vdC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgfHwgcm9vdC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkge1xyXG5cdFx0XHRcdG5vZGVzLnB1c2goIHJvb3QgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRub2Rlcy5wdXNoKCAuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3NlY3Rpb24sIC53cGJjX2JmYl9fZmllbGQnICkgKTtcclxuXHJcblx0XHRcdC8vIDIpIFdhbGsgdGhlIHN1YnRyZWUgYW5kIGZpeCBjb2xsaXNpb25zIGRldGVybWluaXN0aWNhbGx5LlxyXG5cdFx0XHRub2Rlcy5mb3JFYWNoKCBlbCA9PiB7XHJcblx0XHRcdFx0Y29uc3QgaXNGaWVsZCAgID0gZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHRcdGNvbnN0IGlzU2VjdGlvbiA9IGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApO1xyXG5cclxuXHRcdFx0XHQvLyBJTlRFUk5BTCBkYXRhLWlkXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0Y29uc3QgcmF3ICA9IGVsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaWQnICkgfHwgJyc7XHJcblx0XHRcdFx0XHRjb25zdCBiYXNlID0gcy5zYW5pdGl6ZV9odG1sX2lkKCByYXcgKSB8fCAoaXNTZWN0aW9uID8gJ3NlY3Rpb24nIDogJ2ZpZWxkJyk7XHJcblx0XHRcdFx0XHRjb25zdCB1bmlxID0gdGhpcy5fbWFrZV91bmlxdWUoIGJhc2UsIHRha2VuRGF0YUlkICk7XHJcblx0XHRcdFx0XHRpZiAoIHVuaXEgIT09IHJhdyApIGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtaWQnLCB1bmlxICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBIVE1MIG5hbWUgKGZpZWxkcyBvbmx5KVxyXG5cdFx0XHRcdGlmICggaXNGaWVsZCApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHJhdyA9IGVsLmdldEF0dHJpYnV0ZSggJ2RhdGEtbmFtZScgKSB8fCAnJztcclxuXHRcdFx0XHRcdGlmICggcmF3ICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBiYXNlID0gcy5zYW5pdGl6ZV9odG1sX25hbWUoIHJhdyApO1xyXG5cdFx0XHRcdFx0XHRjb25zdCB1bmlxID0gdGhpcy5fbWFrZV91bmlxdWUoIGJhc2UsIHRha2VuRGF0YU5hbWUgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCB1bmlxICE9PSByYXcgKSB7XHJcblx0XHRcdFx0XHRcdFx0ZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJywgdW5pcSApO1xyXG5cdFx0XHRcdFx0XHRcdC8vIFVwZGF0ZSBpbm5lciBjb250cm9sIGltbWVkaWF0ZWx5XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgaW5wdXQgPSBlbC5xdWVyeVNlbGVjdG9yKCAnaW5wdXQsIHRleHRhcmVhLCBzZWxlY3QnICk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBpbnB1dCApIGlucHV0LnNldEF0dHJpYnV0ZSggJ25hbWUnLCB1bmlxICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFB1YmxpYyBIVE1MIGlkIChmaWVsZHMgKyBzZWN0aW9ucylcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRjb25zdCByYXcgPSBlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWh0bWxfaWQnICkgfHwgJyc7XHJcblx0XHRcdFx0XHRpZiAoIHJhdyApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgYmFzZSAgICAgICAgICA9IHMuc2FuaXRpemVfaHRtbF9pZCggcmF3ICk7XHJcblx0XHRcdFx0XHRcdC8vIFJlc2VydmUgYWdhaW5zdCBCT1RIIGtub3duIGRhdGEtaHRtbF9pZCBhbmQgcmVhbCBET00gaWRzLlxyXG5cdFx0XHRcdFx0XHRjb25zdCBjb21iaW5lZFRha2VuID0gbmV3IFNldCggWyAuLi50YWtlbkh0bWxJZCwgLi4udGFrZW5Eb21JZCBdICk7XHJcblx0XHRcdFx0XHRcdGxldCBjYW5kaWRhdGUgICAgICAgPSB0aGlzLl9tYWtlX3VuaXF1ZSggYmFzZSwgY29tYmluZWRUYWtlbiApO1xyXG5cdFx0XHRcdFx0XHQvLyBSZWNvcmQgaW50byB0aGUgcmVhbCBzZXRzIHNvIGZ1dHVyZSBjaGVja3Mgc2VlIHRoZSByZXNlcnZhdGlvbi5cclxuXHRcdFx0XHRcdFx0dGFrZW5IdG1sSWQuYWRkKCBjYW5kaWRhdGUgKTtcclxuXHRcdFx0XHRcdFx0dGFrZW5Eb21JZC5hZGQoIGNhbmRpZGF0ZSApO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCBjYW5kaWRhdGUgIT09IHJhdyApIGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtaHRtbF9pZCcsIGNhbmRpZGF0ZSApO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gUmVmbGVjdCB0byBET00gaW1tZWRpYXRlbHlcclxuXHRcdFx0XHRcdFx0aWYgKCBpc1NlY3Rpb24gKSB7XHJcblx0XHRcdFx0XHRcdFx0ZWwuaWQgPSBjYW5kaWRhdGUgfHwgJyc7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgaW5wdXQgPSBlbC5xdWVyeVNlbGVjdG9yKCAnaW5wdXQsIHRleHRhcmVhLCBzZWxlY3QnICk7XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSBlbC5xdWVyeVNlbGVjdG9yKCAnbGFiZWwud3BiY19iZmJfX2ZpZWxkLWxhYmVsJyApO1xyXG5cdFx0XHRcdFx0XHRcdGlmICggaW5wdXQgKSBpbnB1dC5pZCA9IGNhbmRpZGF0ZSB8fCAnJztcclxuXHRcdFx0XHRcdFx0XHRpZiAoIGxhYmVsICkgbGFiZWwuaHRtbEZvciA9IGNhbmRpZGF0ZSB8fCAnJztcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggaXNTZWN0aW9uICkge1xyXG5cdFx0XHRcdFx0XHQvLyBFbnN1cmUgbm8gc3RhbGUgRE9NIGlkIGlmIGRhdGEtaHRtbF9pZCB3YXMgY2xlYXJlZFxyXG5cdFx0XHRcdFx0XHRlbC5yZW1vdmVBdHRyaWJ1dGUoICdpZCcgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRfbWFrZV9hZGRfY29sdW1uc19jb250cm9sKHBhZ2VfZWwsIHNlY3Rpb25fY29udGFpbmVyLCBpbnNlcnRfcG9zID0gJ2JvdHRvbScpIHtcclxuXHJcblx0XHRcdC8vIEFjY2VwdCBpbnNlcnRfcG9zICgndG9wJ3wnYm90dG9tJyksIGRlZmF1bHQgJ2JvdHRvbScuXHJcblxyXG5cdFx0XHRjb25zdCB0cGwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hZGRfY29sdW1uc190ZW1wbGF0ZScgKTtcclxuXHRcdFx0aWYgKCAhdHBsICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBDbG9uZSAqY29udGVudHMqIChub3QgdGhlIGlkKSwgdW5oaWRlLCBhbmQgYWRkIGEgcGFnZS1zY29wZWQgY2xhc3MuXHJcblx0XHRcdGNvbnN0IHNyYyA9ICh0cGwuY29udGVudCAmJiB0cGwuY29udGVudC5maXJzdEVsZW1lbnRDaGlsZCkgPyB0cGwuY29udGVudC5maXJzdEVsZW1lbnRDaGlsZCA6IHRwbC5maXJzdEVsZW1lbnRDaGlsZDtcclxuXHRcdFx0aWYgKCAhc3JjICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjbG9uZSA9IHNyYy5jbG9uZU5vZGUoIHRydWUgKTtcclxuXHRcdFx0Y2xvbmUucmVtb3ZlQXR0cmlidXRlKCAnaGlkZGVuJyApO1xyXG5cdFx0XHRpZiAoIGNsb25lLmlkICkge1xyXG5cdFx0XHRcdGNsb25lLnJlbW92ZUF0dHJpYnV0ZSggJ2lkJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoICdbaWRdJyApLmZvckVhY2goIG4gPT4gbi5yZW1vdmVBdHRyaWJ1dGUoICdpZCcgKSApO1xyXG5cclxuXHRcdFx0Ly8gTWFyayB3aGVyZSB0aGlzIGNvbnRyb2wgaW5zZXJ0cyBzZWN0aW9ucy5cclxuXHRcdFx0Y2xvbmUuZGF0YXNldC5pbnNlcnQgPSBpbnNlcnRfcG9zOyAvLyAndG9wJyB8ICdib3R0b20nXHJcblxyXG5cdFx0XHQvLyAvLyBPcHRpb25hbCBVSSBoaW50IGZvciB1c2VycyAoa2VlcHMgZXhpc3RpbmcgbWFya3VwIGludGFjdCkuXHJcblx0XHRcdC8vIGNvbnN0IGhpbnQgPSBjbG9uZS5xdWVyeVNlbGVjdG9yKCAnLm5hdi10YWItdGV4dCAuc2VsZWN0ZWRfdmFsdWUnICk7XHJcblx0XHRcdC8vIGlmICggaGludCApIHtcclxuXHRcdFx0Ly8gXHRoaW50LnRleHRDb250ZW50ID0gKGluc2VydF9wb3MgPT09ICd0b3AnKSA/ICcgKGFkZCBhdCB0b3ApJyA6ICcgKGFkZCBhdCBib3R0b20pJztcclxuXHRcdFx0Ly8gfVxyXG5cclxuXHRcdFx0Ly8gQ2xpY2sgb24gb3B0aW9ucyAtIGFkZCBzZWN0aW9uIHdpdGggTiBjb2x1bW5zLlxyXG5cdFx0XHRjbG9uZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCAoZSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGEgPSBlLnRhcmdldC5jbG9zZXN0KCAnLnVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uX2FkZF9zZWN0aW9ucycgKTtcclxuXHRcdFx0XHRpZiAoICFhICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRcdC8vIFJlYWQgTiBlaXRoZXIgZnJvbSBkYXRhLWNvbHMgb3IgZmFsbGJhY2sgdG8gcGFyc2luZyB0ZXh0IGxpa2UgXCIzIENvbHVtbnNcIi5cclxuXHRcdFx0XHRsZXQgY29scyA9IHBhcnNlSW50KCBhLmRhdGFzZXQuY29scyB8fCAoYS50ZXh0Q29udGVudC5tYXRjaCggL1xcYihcXGQrKVxccypDb2x1bW4vaSApPy5bMV0gPz8gJzEnKSwgMTAgKTtcclxuXHRcdFx0XHRjb2xzICAgICA9IE1hdGgubWF4KCAxLCBNYXRoLm1pbiggNCwgY29scyApICk7XHJcblxyXG5cdFx0XHRcdC8vIE5FVzogaG9ub3IgdGhlIGNvbnRyb2wncyBpbnNlcnRpb24gcG9zaXRpb25cclxuXHRcdFx0XHR0aGlzLmFkZF9zZWN0aW9uKCBzZWN0aW9uX2NvbnRhaW5lciwgY29scywgaW5zZXJ0X3BvcyApO1xyXG5cclxuXHRcdFx0XHQvLyBSZWZsZWN0IGxhc3QgY2hvaWNlICh1bmNoYW5nZWQpXHJcblx0XHRcdFx0Y29uc3QgdmFsID0gY2xvbmUucXVlcnlTZWxlY3RvciggJy5zZWxlY3RlZF92YWx1ZScgKTtcclxuXHRcdFx0XHRpZiAoIHZhbCApIHtcclxuXHRcdFx0XHRcdHZhbC50ZXh0Q29udGVudCA9IGAgKCR7Y29sc30pYDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHJldHVybiBjbG9uZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7e3Njcm9sbD86IGJvb2xlYW59fSBbb3B0cyA9IHt9XVxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fVxyXG5cdFx0ICovXHJcblx0XHRhZGRfcGFnZSh7IHNjcm9sbCA9IHRydWUgfSA9IHt9KSB7XHJcblx0XHRcdGNvbnN0IGIgICAgICAgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGNvbnN0IHBhZ2VfZWwgPSBDb3JlLldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ2RpdicsICd3cGJjX2JmYl9fcGFuZWwgd3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3ICB3cGJjX2JmYl9mb3JtIHdwYmNfY29udGFpbmVyIHdwYmNfZm9ybSB3cGJjX2NvbnRhaW5lcl9ib29raW5nX2Zvcm0nICk7XHJcblx0XHRcdHBhZ2VfZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1wYWdlJywgKytiLnBhZ2VfY291bnRlciApO1xyXG5cclxuXHRcdFx0Ly8gXCJQYWdlIDEgfCBYXCIgLSBSZW5kZXIgcGFnZSBUaXRsZSB3aXRoIFJlbW92ZSBYIGJ1dHRvbi5cclxuXHRcdFx0Y29uc3QgY29udHJvbHNfaHRtbCA9IFVJLnJlbmRlcl93cF90ZW1wbGF0ZSggJ3dwYmMtYmZiLXRwbC1wYWdlLXJlbW92ZScsIHsgcGFnZV9udW1iZXI6IGIucGFnZV9jb3VudGVyIH0gKTtcclxuXHRcdFx0cGFnZV9lbC5pbm5lckhUTUwgICA9IGNvbnRyb2xzX2h0bWwgKyAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXIgd3BiY193aXphcmRfX2JvcmRlcl9jb250YWluZXJcIj48L2Rpdj4nO1xyXG5cclxuXHRcdFx0Yi5wYWdlc19jb250YWluZXIuYXBwZW5kQ2hpbGQoIHBhZ2VfZWwgKTtcclxuXHRcdFx0aWYgKCBzY3JvbGwgKSB7XHJcblx0XHRcdFx0cGFnZV9lbC5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnc3RhcnQnIH0gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qgc2VjdGlvbl9jb250YWluZXIgICAgICAgICA9IHBhZ2VfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cdFx0XHRjb25zdCBzZWN0aW9uX2NvdW50X29uX2FkZF9wYWdlID0gMjtcclxuXHRcdFx0dGhpcy5pbml0X3NlY3Rpb25fc29ydGFibGUoIHNlY3Rpb25fY29udGFpbmVyICk7XHJcblx0XHRcdHRoaXMuYWRkX3NlY3Rpb24oIHNlY3Rpb25fY29udGFpbmVyLCBzZWN0aW9uX2NvdW50X29uX2FkZF9wYWdlICk7XHJcblxyXG5cdFx0XHQvLyBEcm9wZG93biBjb250cm9sIGNsb25lZCBmcm9tIHRoZSBoaWRkZW4gdGVtcGxhdGUuXHJcblx0XHRcdGNvbnN0IGNvbnRyb2xzX2hvc3RfdG9wID0gcGFnZV9lbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19jb250cm9scycgKTtcclxuXHRcdFx0Y29uc3QgY3RybF90b3AgICAgICAgICAgPSB0aGlzLl9tYWtlX2FkZF9jb2x1bW5zX2NvbnRyb2woIHBhZ2VfZWwsIHNlY3Rpb25fY29udGFpbmVyLCAndG9wJyApO1xyXG5cdFx0XHRpZiAoIGN0cmxfdG9wICkge1xyXG5cdFx0XHRcdGNvbnRyb2xzX2hvc3RfdG9wLmFwcGVuZENoaWxkKCBjdHJsX3RvcCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIEJvdHRvbSBjb250cm9sIGJhciBhZnRlciB0aGUgc2VjdGlvbiBjb250YWluZXIuXHJcblx0XHRcdGNvbnN0IGNvbnRyb2xzX2hvc3RfYm90dG9tID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX2NvbnRyb2xzIHdwYmNfYmZiX19jb250cm9scy0tYm90dG9tJyApO1xyXG5cdFx0XHRzZWN0aW9uX2NvbnRhaW5lci5hZnRlciggY29udHJvbHNfaG9zdF9ib3R0b20gKTtcclxuXHRcdFx0Y29uc3QgY3RybF9ib3R0b20gPSB0aGlzLl9tYWtlX2FkZF9jb2x1bW5zX2NvbnRyb2woIHBhZ2VfZWwsIHNlY3Rpb25fY29udGFpbmVyLCAnYm90dG9tJyApO1xyXG5cdFx0XHRpZiAoIGN0cmxfYm90dG9tICkge1xyXG5cdFx0XHRcdGNvbnRyb2xzX2hvc3RfYm90dG9tLmFwcGVuZENoaWxkKCBjdHJsX2JvdHRvbSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gcGFnZV9lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lclxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgY29sc1xyXG5cdFx0ICogQHBhcmFtIHsndG9wJ3wnYm90dG9tJ30gW2luc2VydF9wb3M9J2JvdHRvbSddICAvLyBORVdcclxuXHRcdCAqL1xyXG5cdFx0YWRkX3NlY3Rpb24oY29udGFpbmVyLCBjb2xzLCBpbnNlcnRfcG9zID0gJ2JvdHRvbScpIHtcclxuXHRcdFx0Y29uc3QgYiA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Y29scyAgICA9IE1hdGgubWF4KCAxLCBwYXJzZUludCggY29scywgMTAgKSB8fCAxICk7XHJcblxyXG5cdFx0XHRjb25zdCBzZWN0aW9uID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX3NlY3Rpb24nICk7XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1pZCcsIGBzZWN0aW9uLSR7KytiLnNlY3Rpb25fY291bnRlcn0tJHtEYXRlLm5vdygpfWAgKTtcclxuXHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLXVpZCcsIGBzLSR7KytiLl91aWRfY291bnRlcn0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDcgKX1gICk7XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS10eXBlJywgJ3NlY3Rpb24nICk7XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1sYWJlbCcsICdTZWN0aW9uJyApO1xyXG5cdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1ucycsIFN0cmluZyggY29scyApICk7XHJcblx0XHRcdC8vIERvIG5vdCBwZXJzaXN0IG9yIHNlZWQgcGVyLWNvbHVtbiBzdHlsZXMgYnkgZGVmYXVsdCAob3B0LWluIHZpYSBpbnNwZWN0b3IpLlxyXG5cclxuXHRcdFx0Y29uc3Qgcm93ID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX3JvdyB3cGJjX19yb3cnICk7XHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IGNvbHM7IGkrKyApIHtcclxuXHRcdFx0XHRjb25zdCBjb2wgICAgICAgICAgID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX2NvbHVtbiB3cGJjX19maWVsZCcgKTtcclxuXHRcdFx0XHRjb2wuc3R5bGUuZmxleEJhc2lzID0gKDEwMCAvIGNvbHMpICsgJyUnO1xyXG5cdFx0XHRcdC8vIE5vIGRlZmF1bHQgQ1NTIHZhcnMgaGVyZTsgcmVhbCBjb2x1bW5zIHJlbWFpbiB1bmFmZmVjdGVkIHVudGlsIHVzZXIgYWN0aXZhdGVzIHN0eWxlcy5cclxuXHRcdFx0XHRiLmluaXRfc29ydGFibGU/LiggY29sICk7XHJcblx0XHRcdFx0cm93LmFwcGVuZENoaWxkKCBjb2wgKTtcclxuXHRcdFx0XHRpZiAoIGkgPCBjb2xzIC0gMSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHJlc2l6ZXIgPSBDb3JlLldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ2RpdicsICd3cGJjX2JmYl9fY29sdW1uLXJlc2l6ZXInICk7XHJcblx0XHRcdFx0XHRyZXNpemVyLmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBiLmluaXRfcmVzaXplX2hhbmRsZXIgKTtcclxuXHRcdFx0XHRcdHJvdy5hcHBlbmRDaGlsZCggcmVzaXplciApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRzZWN0aW9uLmFwcGVuZENoaWxkKCByb3cgKTtcclxuXHRcdFx0Yi5sYXlvdXQuc2V0X2VxdWFsX2Jhc2VzKCByb3csIGIuY29sX2dhcF9wZXJjZW50ICk7XHJcblx0XHRcdGIuYWRkX292ZXJsYXlfdG9vbGJhciggc2VjdGlvbiApO1xyXG5cdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ3RhYmluZGV4JywgJzAnICk7XHJcblx0XHRcdHRoaXMuaW5pdF9hbGxfbmVzdGVkX3NvcnRhYmxlcyggc2VjdGlvbiApO1xyXG5cclxuXHRcdFx0Ly8gSW5zZXJ0aW9uIHBvbGljeTogdG9wIHwgYm90dG9tLlxyXG5cdFx0XHRpZiAoIGluc2VydF9wb3MgPT09ICd0b3AnICYmIGNvbnRhaW5lci5maXJzdEVsZW1lbnRDaGlsZCApIHtcclxuXHRcdFx0XHRjb250YWluZXIuaW5zZXJ0QmVmb3JlKCBzZWN0aW9uLCBjb250YWluZXIuZmlyc3RFbGVtZW50Q2hpbGQgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoIHNlY3Rpb24gKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHNlY3Rpb25fZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyXHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR9IFRoZSByZWJ1aWx0IHNlY3Rpb24gZWxlbWVudC5cclxuXHRcdCAqL1xyXG5cdFx0cmVidWlsZF9zZWN0aW9uKHNlY3Rpb25fZGF0YSwgY29udGFpbmVyKSB7XHJcblx0XHRcdGNvbnN0IGIgICAgICAgICA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Y29uc3QgY29sc19kYXRhID0gQXJyYXkuaXNBcnJheSggc2VjdGlvbl9kYXRhPy5jb2x1bW5zICkgPyBzZWN0aW9uX2RhdGEuY29sdW1ucyA6IFtdO1xyXG5cdFx0XHR0aGlzLmFkZF9zZWN0aW9uKCBjb250YWluZXIsIGNvbHNfZGF0YS5sZW5ndGggfHwgMSApO1xyXG5cdFx0XHRjb25zdCBzZWN0aW9uID0gY29udGFpbmVyLmxhc3RFbGVtZW50Q2hpbGQ7XHJcblx0XHRcdGlmICggIXNlY3Rpb24uZGF0YXNldC51aWQgKSB7XHJcblx0XHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLXVpZCcsIGBzLSR7KytiLl91aWRfY291bnRlcn0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDcgKX1gICk7XHJcblx0XHRcdH1cclxuXHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLWlkJywgc2VjdGlvbl9kYXRhPy5pZCB8fCBgc2VjdGlvbi0keysrYi5zZWN0aW9uX2NvdW50ZXJ9LSR7RGF0ZS5ub3coKX1gICk7XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS10eXBlJywgJ3NlY3Rpb24nICk7XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1sYWJlbCcsIHNlY3Rpb25fZGF0YT8ubGFiZWwgfHwgJ1NlY3Rpb24nICk7XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1jb2x1bW5zJywgU3RyaW5nKCAoc2VjdGlvbl9kYXRhPy5jb2x1bW5zIHx8IFtdKS5sZW5ndGggfHwgMSApICk7XHJcblx0XHRcdC8vIFBlcnNpc3RlZCBhdHRyaWJ1dGVzXHJcblx0XHRcdGlmICggc2VjdGlvbl9kYXRhPy5odG1sX2lkICkge1xyXG5cdFx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1odG1sX2lkJywgU3RyaW5nKCBzZWN0aW9uX2RhdGEuaHRtbF9pZCApICk7XHJcblx0XHRcdFx0Ly8gZ2l2ZSB0aGUgY29udGFpbmVyIGEgcmVhbCBpZCBzbyBhbmNob3JzL0NTUyBjYW4gdGFyZ2V0IGl0XHJcblx0XHRcdFx0c2VjdGlvbi5pZCA9IFN0cmluZyggc2VjdGlvbl9kYXRhLmh0bWxfaWQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gTkVXOiByZXN0b3JlIHBlcnNpc3RlZCBwZXItY29sdW1uIHN0eWxlcyAocmF3IEpTT04gc3RyaW5nKS5cclxuXHRcdFx0aWYgKCBzZWN0aW9uX2RhdGE/LmNvbF9zdHlsZXMgIT0gbnVsbCApIHtcclxuXHRcdFx0XHRjb25zdCBqc29uID0gU3RyaW5nKCBzZWN0aW9uX2RhdGEuY29sX3N0eWxlcyApO1xyXG5cdFx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1jb2xfc3R5bGVzJywganNvbiApO1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRzZWN0aW9uLmRhdGFzZXQuY29sX3N0eWxlcyA9IGpzb247XHJcblx0XHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHQvLyAoTm8gcmVuZGVyX3ByZXZpZXcoKSBjYWxsIGhlcmUgb24gcHVycG9zZTogc2VjdGlvbnPigJkgYnVpbGRlciBET00gdXNlcyAud3BiY19iZmJfX3Jvdy8ud3BiY19iZmJfX2NvbHVtbi4pXHJcblxyXG5cclxuXHRcdFx0aWYgKCBzZWN0aW9uX2RhdGE/LmNzc2NsYXNzICkge1xyXG5cdFx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1jc3NjbGFzcycsIFN0cmluZyggc2VjdGlvbl9kYXRhLmNzc2NsYXNzICkgKTtcclxuXHRcdFx0XHQvLyBrZWVwIGNvcmUgY2xhc3NlcywgdGhlbiBhZGQgY3VzdG9tIGNsYXNzKGVzKVxyXG5cdFx0XHRcdFN0cmluZyggc2VjdGlvbl9kYXRhLmNzc2NsYXNzICkuc3BsaXQoIC9cXHMrLyApLmZpbHRlciggQm9vbGVhbiApLmZvckVhY2goIGNscyA9PiBzZWN0aW9uLmNsYXNzTGlzdC5hZGQoIGNscyApICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb24ucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHQvLyBEZWxlZ2F0ZSBwYXJzaW5nICsgYWN0aXZhdGlvbiArIGFwcGxpY2F0aW9uIHRvIHRoZSBDb2x1bW4gU3R5bGVzIHNlcnZpY2UuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc3QganNvbiA9IHNlY3Rpb24uZ2V0QXR0cmlidXRlKCAnZGF0YS1jb2xfc3R5bGVzJyApXHJcblx0XHRcdFx0XHR8fCAoc2VjdGlvbi5kYXRhc2V0ID8gKHNlY3Rpb24uZGF0YXNldC5jb2xfc3R5bGVzIHx8ICcnKSA6ICcnKTtcclxuXHRcdFx0XHRjb25zdCBhcnIgID0gVUkuV1BCQ19CRkJfQ29sdW1uX1N0eWxlcy5wYXJzZV9jb2xfc3R5bGVzKCBqc29uICk7XHJcblx0XHRcdFx0VUkuV1BCQ19CRkJfQ29sdW1uX1N0eWxlcy5hcHBseSggc2VjdGlvbiwgYXJyICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29sc19kYXRhLmZvckVhY2goIChjb2xfZGF0YSwgaW5kZXgpID0+IHtcclxuXHRcdFx0XHRjb25zdCBjb2x1bW5zX29ubHkgID0gcm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHRcdFx0XHRjb25zdCBjb2wgICAgICAgICAgID0gY29sdW1uc19vbmx5W2luZGV4XTtcclxuXHRcdFx0XHRjb2wuc3R5bGUuZmxleEJhc2lzID0gY29sX2RhdGEud2lkdGggfHwgJzEwMCUnO1xyXG5cdFx0XHRcdChjb2xfZGF0YS5pdGVtcyB8fCBbXSkuZm9yRWFjaCggKGl0ZW0pID0+IHtcclxuXHRcdFx0XHRcdGlmICggIWl0ZW0gfHwgIWl0ZW0udHlwZSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBpdGVtLnR5cGUgPT09ICdmaWVsZCcgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGVsID0gYi5idWlsZF9maWVsZCggaXRlbS5kYXRhICk7XHJcblx0XHRcdFx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0XHRcdFx0Y29sLmFwcGVuZENoaWxkKCBlbCApO1xyXG5cdFx0XHRcdFx0XHRcdGIudHJpZ2dlcl9maWVsZF9kcm9wX2NhbGxiYWNrKCBlbCwgJ2xvYWQnICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBpdGVtLnR5cGUgPT09ICdzZWN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5yZWJ1aWxkX3NlY3Rpb24oIGl0ZW0uZGF0YSwgY29sICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGNvbnN0IGNvbXB1dGVkID0gYi5sYXlvdXQuY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3coIHJvdywgYi5jb2xfZ2FwX3BlcmNlbnQgKTtcclxuXHRcdFx0Yi5sYXlvdXQuYXBwbHlfYmFzZXNfdG9fcm93KCByb3csIGNvbXB1dGVkLmJhc2VzICk7XHJcblx0XHRcdHRoaXMuaW5pdF9hbGxfbmVzdGVkX3NvcnRhYmxlcyggc2VjdGlvbiApO1xyXG5cclxuXHRcdFx0Ly8gTkVXOiByZXRhZyBVSURzIGZpcnN0IChzbyB1bmlxdWVuZXNzIGNoZWNrcyBkb24ndCBleGNsdWRlIG9yaWdpbmFscyksIHRoZW4gZGVkdXBlIGFsbCBrZXlzLlxyXG5cdFx0XHR0aGlzLl9yZXRhZ191aWRzX2luX3N1YnRyZWUoIHNlY3Rpb24gKTtcclxuXHRcdFx0dGhpcy5fZGVkdXBlX3N1YnRyZWVfc3RyaWN0KCBzZWN0aW9uICk7XHJcblx0XHRcdHJldHVybiBzZWN0aW9uO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXIgKi9cclxuXHRcdGluaXRfYWxsX25lc3RlZF9zb3J0YWJsZXMoY29udGFpbmVyKSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGlmICggY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICkgKSB7XHJcblx0XHRcdFx0dGhpcy5pbml0X3NlY3Rpb25fc29ydGFibGUoIGNvbnRhaW5lciApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19zZWN0aW9uJyApLmZvckVhY2goIChzZWN0aW9uKSA9PiB7XHJcblx0XHRcdFx0c2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19jb2x1bW4nICkuZm9yRWFjaCggKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5pbml0X3NlY3Rpb25fc29ydGFibGUoIGNvbCApO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXIgKi9cclxuXHRcdGluaXRfc2VjdGlvbl9zb3J0YWJsZShjb250YWluZXIpIHtcclxuXHRcdFx0Y29uc3QgYiA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0aWYgKCAhY29udGFpbmVyICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBpc19jb2x1bW4gICAgPSBjb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHRcdFx0Y29uc3QgaXNfdG9wX2xldmVsID0gY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICk7XHJcblx0XHRcdGlmICggIWlzX2NvbHVtbiAmJiAhaXNfdG9wX2xldmVsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRiLmluaXRfc29ydGFibGU/LiggY29udGFpbmVyICk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2VyaWFsaXphdGlvbiBhbmQgZGVzZXJpYWxpemF0aW9uIG9mIHBhZ2VzL3NlY3Rpb25zL2ZpZWxkcy5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9TdHJ1Y3R1cmVfSU8gPSBjbGFzcyBleHRlbmRzIFVJLldQQkNfQkZCX01vZHVsZSB7XHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuZ2V0X3N0cnVjdHVyZSAgICAgICAgPSAoKSA9PiB0aGlzLnNlcmlhbGl6ZSgpO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIubG9hZF9zYXZlZF9zdHJ1Y3R1cmUgPSAocywgb3B0cykgPT4gdGhpcy5kZXNlcmlhbGl6ZSggcywgb3B0cyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTm9ybWFsaXplIG9wdGlvbiB2YWx1ZXMgd2hlbiBhIGZpZWxkIGV4cGxpY2l0bHkgZGlzYWJsZXMgc2VwYXJhdGUgdmFsdWVzLlxyXG5cdFx0ICpcclxuXHRcdCAqIE9sZGVyIEJ1aWxkZXIgdmVyc2lvbnMgcGVyc2lzdGVkIGFuIHVuY2hlY2tlZCB2YWx1ZV9kaWZmZXJzIHRvZ2dsZSBhcyBhblxyXG5cdFx0ICogZW1wdHkgc3RyaW5nLiBUcmVhdCB0aGF0IGV4cGxpY2l0IGxlZ2FjeSB2YWx1ZSBhcyBmYWxzZSwgd2hpbGUgcmV0YWluaW5nXHJcblx0XHQgKiB0aGUgc2NoZW1hIGRlZmF1bHQgd2hlbiB0aGUgcHJvcGVydHkgaXMgZ2VudWluZWx5IGFic2VudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmllbGRfZGF0YSBTZXJpYWxpemVkIGZpZWxkIGRhdGEuXHJcblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fSBOb3JtYWxpemVkIHNlcmlhbGl6ZWQgZmllbGQgZGF0YS5cclxuXHRcdCAqL1xyXG5cdFx0X25vcm1hbGl6ZV9maWVsZF9vcHRpb25fdmFsdWVzKGZpZWxkX2RhdGEpIHtcclxuXHRcdFx0Y29uc3QgaGFzX3ZhbHVlX2RpZmZlcnMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGZpZWxkX2RhdGEsICd2YWx1ZV9kaWZmZXJzJyApO1xyXG5cdFx0XHRpZiAoICFoYXNfdmFsdWVfZGlmZmVycyApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmllbGRfZGF0YTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgdmFsdWVfZGlmZmVycyAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5jb2VyY2VfYm9vbGVhbiggZmllbGRfZGF0YS52YWx1ZV9kaWZmZXJzLCBmYWxzZSApO1xyXG5cdFx0XHRmaWVsZF9kYXRhLnZhbHVlX2RpZmZlcnMgPSB2YWx1ZV9kaWZmZXJzO1xyXG5cclxuXHRcdFx0aWYgKCAhdmFsdWVfZGlmZmVycyAmJiBBcnJheS5pc0FycmF5KCBmaWVsZF9kYXRhLm9wdGlvbnMgKSApIHtcclxuXHRcdFx0XHRmaWVsZF9kYXRhLm9wdGlvbnMgPSBmaWVsZF9kYXRhLm9wdGlvbnMubWFwKCAoIG9wdGlvbl9yZWNvcmQgKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoICFvcHRpb25fcmVjb3JkIHx8IHR5cGVvZiBvcHRpb25fcmVjb3JkICE9PSAnb2JqZWN0JyApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIG9wdGlvbl9yZWNvcmQ7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oXHJcblx0XHRcdFx0XHRcdHt9LFxyXG5cdFx0XHRcdFx0XHRvcHRpb25fcmVjb3JkLFxyXG5cdFx0XHRcdFx0XHR7IHZhbHVlOiBTdHJpbmcoIG9wdGlvbl9yZWNvcmQubGFiZWwgPT0gbnVsbCA/ICcnIDogb3B0aW9uX3JlY29yZC5sYWJlbCApIH1cclxuXHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gZmllbGRfZGF0YTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHJldHVybnMge0FycmF5fSAqL1xyXG5cdFx0c2VyaWFsaXplKCkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHR0aGlzLl9ub3JtYWxpemVfaWRzKCk7XHJcblx0XHRcdHRoaXMuX25vcm1hbGl6ZV9uYW1lcygpO1xyXG5cdFx0XHRjb25zdCBwYWdlcyA9IFtdO1xyXG5cdFx0XHRiLnBhZ2VzX2NvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19wYW5lbC0tcHJldmlldycgKS5mb3JFYWNoKCAocGFnZV9lbCwgcGFnZV9pbmRleCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IHBhZ2VfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgICA9IFtdO1xyXG5cdFx0XHRcdGlmICggIWNvbnRhaW5lciApIHtcclxuXHRcdFx0XHRcdHBhZ2VzLnB1c2goIHsgcGFnZTogcGFnZV9pbmRleCArIDEsIGNvbnRlbnQgfSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IConICkuZm9yRWFjaCggKGNoaWxkKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdFx0XHRjb250ZW50LnB1c2goIHsgdHlwZTogJ3NlY3Rpb24nLCBkYXRhOiB0aGlzLnNlcmlhbGl6ZV9zZWN0aW9uKCBjaGlsZCApIH0gKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggY2hpbGQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtaW52YWxpZCcgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0Y29uc3QgZl9kYXRhID0gdGhpcy5fbm9ybWFsaXplX2ZpZWxkX29wdGlvbl92YWx1ZXMoXHJcblx0XHRcdFx0XHRcdFx0Q29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGNoaWxkIClcclxuXHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdFx0Ly8gRHJvcCBlcGhlbWVyYWwvZWRpdG9yLW9ubHkgZmxhZ3NcclxuXHRcdFx0XHRcdFx0WyAndWlkJywgJ2ZyZXNoJywgJ2F1dG9uYW1lJywgJ3dhc19sb2FkZWQnLCAnbmFtZV91c2VyX3RvdWNoZWQnIF1cclxuXHRcdFx0XHRcdFx0XHQuZm9yRWFjaCggayA9PiB7XHJcblx0XHRcdFx0XHRcdFx0XHRpZiAoIGsgaW4gZl9kYXRhICkgZGVsZXRlIGZfZGF0YVtrXTtcclxuXHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdGNvbnRlbnQucHVzaCggeyB0eXBlOiAnZmllbGQnLCBkYXRhOiBmX2RhdGEgfSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRwYWdlcy5wdXNoKCB7IHBhZ2U6IHBhZ2VfaW5kZXggKyAxLCBjb250ZW50IH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gcGFnZXM7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0XHQgKiBAcmV0dXJucyB7e2lkOnN0cmluZyxsYWJlbDpzdHJpbmcsaHRtbF9pZDpzdHJpbmcsY3NzY2xhc3M6c3RyaW5nLGNvbF9zdHlsZXM6c3RyaW5nLGNvbHVtbnM6QXJyYXl9fVxyXG5cdFx0ICovXHJcblx0XHRzZXJpYWxpemVfc2VjdGlvbihzZWN0aW9uX2VsKSB7XHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cclxuXHRcdFx0Ly8gTkVXOiByZWFkIHBlci1jb2x1bW4gc3R5bGVzIGZyb20gZGF0YXNldC9hdHRyaWJ1dGVzICh1bmRlcnNjb3JlICYgaHlwaGVuKVxyXG5cdFx0XHR2YXIgY29sX3N0eWxlc19yYXcgPVxyXG5cdFx0XHRcdFx0c2VjdGlvbl9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbF9zdHlsZXMnICkgfHxcclxuXHRcdFx0XHRcdChzZWN0aW9uX2VsLmRhdGFzZXQgPyAoc2VjdGlvbl9lbC5kYXRhc2V0LmNvbF9zdHlsZXMpIDogJycpIHx8XHJcblx0XHRcdFx0XHQnJztcclxuXHJcblx0XHRcdGNvbnN0IGJhc2UgPSB7XHJcblx0XHRcdFx0aWQgICAgICAgIDogc2VjdGlvbl9lbC5kYXRhc2V0LmlkLFxyXG5cdFx0XHRcdGxhYmVsICAgICA6IHNlY3Rpb25fZWwuZGF0YXNldC5sYWJlbCB8fCAnJyxcclxuXHRcdFx0XHRodG1sX2lkICAgOiBzZWN0aW9uX2VsLmRhdGFzZXQuaHRtbF9pZCB8fCAnJyxcclxuXHRcdFx0XHRjc3NjbGFzcyAgOiBzZWN0aW9uX2VsLmRhdGFzZXQuY3NzY2xhc3MgfHwgJycsXHJcblx0XHRcdFx0Y29sX3N0eWxlczogU3RyaW5nKCBjb2xfc3R5bGVzX3JhdyApICAgICAgICAvLyA8LS0gTkVXOiBrZWVwIGFzIHJhdyBKU09OIHN0cmluZ1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0aWYgKCAhcm93ICkge1xyXG5cdFx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgYmFzZSwgeyBjb2x1bW5zOiBbXSB9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGNvbHVtbnMgPSBbXTtcclxuXHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKS5mb3JFYWNoKCBmdW5jdGlvbiAoY29sKSB7XHJcblx0XHRcdFx0Y29uc3Qgd2lkdGggPSBjb2wuc3R5bGUuZmxleEJhc2lzIHx8ICcxMDAlJztcclxuXHRcdFx0XHRjb25zdCBpdGVtcyA9IFtdO1xyXG5cdFx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGNvbC5jaGlsZHJlbiwgZnVuY3Rpb24gKGNoaWxkKSB7XHJcblx0XHRcdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdFx0XHRpdGVtcy5wdXNoKCB7IHR5cGU6ICdzZWN0aW9uJywgZGF0YTogdGhpcy5zZXJpYWxpemVfc2VjdGlvbiggY2hpbGQgKSB9ICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggY2hpbGQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLWludmFsaWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGNvbnN0IGZfZGF0YSA9IHRoaXMuX25vcm1hbGl6ZV9maWVsZF9vcHRpb25fdmFsdWVzKFxyXG5cdFx0XHRcdFx0XHRcdENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBjaGlsZCApXHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdFsgJ3VpZCcsICdmcmVzaCcsICdhdXRvbmFtZScsICd3YXNfbG9hZGVkJywgJ25hbWVfdXNlcl90b3VjaGVkJyBdLmZvckVhY2goIGZ1bmN0aW9uIChrKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBrIGluIGZfZGF0YSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdGRlbGV0ZSBmX2RhdGFba107XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goIHsgdHlwZTogJ2ZpZWxkJywgZGF0YTogZl9kYXRhIH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LmJpbmQoIHRoaXMgKSApO1xyXG5cdFx0XHRcdGNvbHVtbnMucHVzaCggeyB3aWR0aDogd2lkdGgsIGl0ZW1zOiBpdGVtcyB9ICk7XHJcblx0XHRcdH0uYmluZCggdGhpcyApICk7XHJcblxyXG5cdFx0XHQvLyBDbGFtcCBwZXJzaXN0ZWQgY29sX3N0eWxlcyB0byB0aGUgYWN0dWFsIG51bWJlciBvZiBjb2x1bW5zIG9uIFNhdmUuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc3QgY29sQ291bnQgPSBjb2x1bW5zLmxlbmd0aDtcclxuXHRcdFx0XHRjb25zdCByYXcgICAgICA9IFN0cmluZyggY29sX3N0eWxlc19yYXcgfHwgJycgKS50cmltKCk7XHJcblxyXG5cdFx0XHRcdGlmICggcmF3ICkge1xyXG5cdFx0XHRcdFx0bGV0IGFyciA9IFtdO1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSggcmF3ICk7XHJcblx0XHRcdFx0XHRcdGFyciAgICAgICAgICA9IEFycmF5LmlzQXJyYXkoIHBhcnNlZCApID8gcGFyc2VkIDogKHBhcnNlZCAmJiBBcnJheS5pc0FycmF5KCBwYXJzZWQuY29sdW1ucyApID8gcGFyc2VkLmNvbHVtbnMgOiBbXSk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0XHRcdGFyciA9IFtdO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggY29sQ291bnQgPD0gMCApIHtcclxuXHRcdFx0XHRcdFx0YmFzZS5jb2xfc3R5bGVzID0gJ1tdJztcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGlmICggYXJyLmxlbmd0aCA+IGNvbENvdW50ICkgYXJyLmxlbmd0aCA9IGNvbENvdW50O1xyXG5cdFx0XHRcdFx0XHR3aGlsZSAoIGFyci5sZW5ndGggPCBjb2xDb3VudCApIGFyci5wdXNoKCB7fSApO1xyXG5cdFx0XHRcdFx0XHRiYXNlLmNvbF9zdHlsZXMgPSBKU09OLnN0cmluZ2lmeSggYXJyICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGJhc2UuY29sX3N0eWxlcyA9ICcnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbigge30sIGJhc2UsIHsgY29sdW1uczogY29sdW1ucyB9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBzdHJ1Y3R1cmVcclxuXHRcdCAqIEBwYXJhbSB7e2RlZmVySWZUeXBpbmc/OiBib29sZWFufX0gW29wdHMgPSB7fV1cclxuXHRcdCAqL1xyXG5cdFx0ZGVzZXJpYWxpemUoc3RydWN0dXJlLCB7IGRlZmVySWZUeXBpbmcgPSB0cnVlIH0gPSB7fSkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRpZiAoIGRlZmVySWZUeXBpbmcgJiYgdGhpcy5faXNfdHlwaW5nX2luX2luc3BlY3RvcigpICkge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCggdGhpcy5fZGVmZXJfdGltZXIgKTtcclxuXHRcdFx0XHR0aGlzLl9kZWZlcl90aW1lciA9IHNldFRpbWVvdXQoICgpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuZGVzZXJpYWxpemUoIHN0cnVjdHVyZSwgeyBkZWZlcklmVHlwaW5nOiBmYWxzZSB9ICk7XHJcblx0XHRcdFx0fSwgMTUwICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGIucGFnZXNfY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xyXG5cdFx0XHRiLnBhZ2VfY291bnRlciAgICAgICAgICAgICAgPSAwO1xyXG5cdFx0XHQoc3RydWN0dXJlIHx8IFtdKS5mb3JFYWNoKCAocGFnZV9kYXRhKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFnZV9lbCAgICAgICAgICAgICAgID0gYi5wYWdlc19zZWN0aW9ucy5hZGRfcGFnZSggeyBzY3JvbGw6IGZhbHNlIH0gKTtcclxuXHRcdFx0XHRjb25zdCBzZWN0aW9uX2NvbnRhaW5lciAgICAgPSBwYWdlX2VsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcicgKTtcclxuXHRcdFx0XHRzZWN0aW9uX2NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuXHRcdFx0XHRiLmluaXRfc2VjdGlvbl9zb3J0YWJsZT8uKCBzZWN0aW9uX2NvbnRhaW5lciApO1xyXG5cdFx0XHRcdChwYWdlX2RhdGEuY29udGVudCB8fCBbXSkuZm9yRWFjaCggKGl0ZW0pID0+IHtcclxuXHRcdFx0XHRcdGlmICggaXRlbS50eXBlID09PSAnc2VjdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdC8vIE5vdyByZXR1cm5zIHRoZSBlbGVtZW50OyBhdHRyaWJ1dGVzIChpbmNsLiBjb2xfc3R5bGVzKSBhcmUgYXBwbGllZCBpbnNpZGUgcmVidWlsZC5cclxuXHRcdFx0XHRcdFx0Yi5wYWdlc19zZWN0aW9ucy5yZWJ1aWxkX3NlY3Rpb24oIGl0ZW0uZGF0YSwgc2VjdGlvbl9jb250YWluZXIgKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBpdGVtLnR5cGUgPT09ICdmaWVsZCcgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGVsID0gYi5idWlsZF9maWVsZCggaXRlbS5kYXRhICk7XHJcblx0XHRcdFx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0XHRcdFx0c2VjdGlvbl9jb250YWluZXIuYXBwZW5kQ2hpbGQoIGVsICk7XHJcblx0XHRcdFx0XHRcdFx0Yi50cmlnZ2VyX2ZpZWxkX2Ryb3BfY2FsbGJhY2soIGVsLCAnbG9hZCcgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRiLnVzYWdlPy51cGRhdGVfcGFsZXR0ZV91aT8uKCk7XHJcblx0XHRcdGIuYnVzLmVtaXQoIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9MT0FERUQsIHsgc3RydWN0dXJlIH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRfbm9ybWFsaXplX2lkcygpIHtcclxuXHRcdFx0Y29uc3QgYiA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Yi5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZDpub3QoLmlzLWludmFsaWQpJyApLmZvckVhY2goIChlbCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBDb3JlLldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggZWwgKTtcclxuXHRcdFx0XHRjb25zdCB3YW50ID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCBkYXRhLmlkIHx8ICcnICkgfHwgJ2ZpZWxkJztcclxuXHRcdFx0XHRjb25zdCB1bmlxID0gYi5pZC5lbnN1cmVfdW5pcXVlX2ZpZWxkX2lkKCB3YW50LCBlbCApO1xyXG5cdFx0XHRcdGlmICggZGF0YS5pZCAhPT0gdW5pcSApIHtcclxuXHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtaWQnLCB1bmlxICk7XHJcblx0XHRcdFx0XHRpZiAoIGIucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdFx0XHRiLnJlbmRlcl9wcmV2aWV3KCBlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9ub3JtYWxpemVfbmFtZXMoKSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGIucGFnZXNfY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGQ6bm90KC5pcy1pbnZhbGlkKScgKS5mb3JFYWNoKCAoZWwpID0+IHtcclxuXHRcdFx0XHRjb25zdCBkYXRhID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGVsICk7XHJcblx0XHRcdFx0Y29uc3QgYmFzZSA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCAoZGF0YS5uYW1lICE9IG51bGwpID8gZGF0YS5uYW1lIDogZGF0YS5pZCApIHx8ICdmaWVsZCc7XHJcblx0XHRcdFx0Y29uc3QgdW5pcSA9IGIuaWQuZW5zdXJlX3VuaXF1ZV9maWVsZF9uYW1lKCBiYXNlLCBlbCApO1xyXG5cdFx0XHRcdGlmICggZGF0YS5uYW1lICE9PSB1bmlxICkge1xyXG5cdFx0XHRcdFx0ZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJywgdW5pcSApO1xyXG5cdFx0XHRcdFx0aWYgKCBiLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHRcdFx0Yi5yZW5kZXJfcHJldmlldyggZWwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHJldHVybnMge2Jvb2xlYW59ICovXHJcblx0XHRfaXNfdHlwaW5nX2luX2luc3BlY3RvcigpIHtcclxuXHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRyZXR1cm4gISEoaW5zICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgJiYgaW5zLmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1pbmltYWwsIHN0YW5kYWxvbmUgZ3VhcmQgdGhhdCBlbmZvcmNlcyBwZXItY29sdW1uIG1pbiB3aWR0aHMgYmFzZWQgb24gZmllbGRzJyBkYXRhLW1pbl93aWR0aC5cclxuXHQgKlxyXG5cdCAqIEB0eXBlIHtVSS5XUEJDX0JGQl9NaW5fV2lkdGhfR3VhcmR9XHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfTWluX1dpZHRoX0d1YXJkID0gY2xhc3MgZXh0ZW5kcyBVSS5XUEJDX0JGQl9Nb2R1bGUge1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKGJ1aWxkZXIpIHtcclxuXHRcdFx0c3VwZXIoIGJ1aWxkZXIgKTtcclxuXHRcdFx0dGhpcy5fb25fZmllbGRfYWRkICAgICAgICA9IHRoaXMuX29uX2ZpZWxkX2FkZC5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX29uX2ZpZWxkX3JlbW92ZSAgICAgPSB0aGlzLl9vbl9maWVsZF9yZW1vdmUuYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLl9vbl9zdHJ1Y3R1cmVfbG9hZGVkID0gdGhpcy5fb25fc3RydWN0dXJlX2xvYWRlZC5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX29uX3N0cnVjdHVyZV9jaGFuZ2UgPSB0aGlzLl9vbl9zdHJ1Y3R1cmVfY2hhbmdlLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5fb25fd2luZG93X3Jlc2l6ZSAgICA9IHRoaXMuX29uX3dpbmRvd19yZXNpemUuYmluZCggdGhpcyApO1xyXG5cclxuXHRcdFx0dGhpcy5fcGVuZGluZ19yb3dzID0gbmV3IFNldCgpO1xyXG5cdFx0XHR0aGlzLl9wZW5kaW5nX2FsbCAgPSBmYWxzZTtcclxuXHRcdFx0dGhpcy5fcmFmX2lkICAgICAgID0gMDtcclxuXHRcdH1cclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHRjb25zdCBFViA9IENvcmUuV1BCQ19CRkJfRXZlbnRzO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub24/LiggRVYuRklFTERfQURELCB0aGlzLl9vbl9maWVsZF9hZGQgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5idXM/Lm9uPy4oIEVWLkZJRUxEX1JFTU9WRSwgdGhpcy5fb25fZmllbGRfcmVtb3ZlICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uYnVzPy5vbj8uKCBFVi5TVFJVQ1RVUkVfTE9BREVELCB0aGlzLl9vbl9zdHJ1Y3R1cmVfbG9hZGVkICk7XHJcblx0XHRcdC8vIFJlZnJlc2ggc2VsZWN0aXZlbHkgb24gc3RydWN0dXJlIGNoYW5nZSAoTk9UIG9uIGV2ZXJ5IHByb3AgaW5wdXQpLlxyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub24/LiggRVYuU1RSVUNUVVJFX0NIQU5HRSwgdGhpcy5fb25fc3RydWN0dXJlX2NoYW5nZSApO1xyXG5cclxuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCB0aGlzLl9vbl93aW5kb3dfcmVzaXplLCB7IHBhc3NpdmU6IHRydWUgfSApO1xyXG5cdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX2FsbCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRlc3Ryb3koKSB7XHJcblx0XHRcdGNvbnN0IEVWID0gQ29yZS5XUEJDX0JGQl9FdmVudHM7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uYnVzPy5vZmY/LiggRVYuRklFTERfQURELCB0aGlzLl9vbl9maWVsZF9hZGQgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5idXM/Lm9mZj8uKCBFVi5GSUVMRF9SRU1PVkUsIHRoaXMuX29uX2ZpZWxkX3JlbW92ZSApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub2ZmPy4oIEVWLlNUUlVDVFVSRV9MT0FERUQsIHRoaXMuX29uX3N0cnVjdHVyZV9sb2FkZWQgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5idXM/Lm9mZj8uKCBFVi5TVFJVQ1RVUkVfQ0hBTkdFLCB0aGlzLl9vbl9zdHJ1Y3R1cmVfY2hhbmdlICk7XHJcblx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAncmVzaXplJywgdGhpcy5fb25fd2luZG93X3Jlc2l6ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9maWVsZF9hZGQoZSkge1xyXG5cdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX2FsbCgpO1xyXG5cdFx0XHQvLyBpZiB5b3UgcmVhbGx5IHdhbnQgdG8gYmUgbWluaW1hbCB3b3JrIGhlcmUsIGtlZXAgeW91ciByb3ctb25seSB2ZXJzaW9uLlxyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9maWVsZF9yZW1vdmUoZSkge1xyXG5cdFx0XHRjb25zdCBzcmNfZWwgPSBlPy5kZXRhaWw/LmVsIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHJvdyAgICA9IChzcmNfZWwgJiYgc3JjX2VsLmNsb3Nlc3QpID8gc3JjX2VsLmNsb3Nlc3QoICcud3BiY19iZmJfX3JvdycgKSA6IG51bGw7XHJcblx0XHRcdGlmICggcm93ICkge1xyXG5cdFx0XHRcdHRoaXMuX3NjaGVkdWxlX3JlZnJlc2hfcm93KCByb3cgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX2FsbCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X29uX3N0cnVjdHVyZV9sb2FkZWQoKSB7XHJcblx0XHRcdHRoaXMuX3NjaGVkdWxlX3JlZnJlc2hfYWxsKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0X29uX3N0cnVjdHVyZV9jaGFuZ2UoZSkge1xyXG5cdFx0XHRjb25zdCByZWFzb24gPSBlPy5kZXRhaWw/LnJlYXNvbiB8fCAnJztcclxuXHRcdFx0Y29uc3Qga2V5ICAgID0gZT8uZGV0YWlsPy5rZXkgfHwgJyc7XHJcblxyXG5cdFx0XHQvLyBJZ25vcmUgbm9pc3kgcHJvcCBjaGFuZ2VzIHRoYXQgZG9uJ3QgYWZmZWN0IG1pbiB3aWR0aHMuXHJcblx0XHRcdGlmICggcmVhc29uID09PSAncHJvcC1jaGFuZ2UnICYmIGtleSAhPT0gJ21pbl93aWR0aCcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBlbCAgPSBlPy5kZXRhaWw/LmVsIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHJvdyA9IGVsPy5jbG9zZXN0Py4oICcud3BiY19iZmJfX3JvdycgKSB8fCBudWxsO1xyXG5cdFx0XHRpZiAoIHJvdyApIHtcclxuXHRcdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX3Jvdyggcm93ICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5fc2NoZWR1bGVfcmVmcmVzaF9hbGwoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl93aW5kb3dfcmVzaXplKCkge1xyXG5cdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX2FsbCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9zY2hlZHVsZV9yZWZyZXNoX3Jvdyhyb3dfZWwpIHtcclxuXHRcdFx0aWYgKCAhcm93X2VsICkgcmV0dXJuO1xyXG5cdFx0XHR0aGlzLl9wZW5kaW5nX3Jvd3MuYWRkKCByb3dfZWwgKTtcclxuXHRcdFx0dGhpcy5fa2lja19yYWYoKTtcclxuXHRcdH1cclxuXHJcblx0XHRfc2NoZWR1bGVfcmVmcmVzaF9hbGwoKSB7XHJcblx0XHRcdHRoaXMuX3BlbmRpbmdfYWxsID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5fcGVuZGluZ19yb3dzLmNsZWFyKCk7XHJcblx0XHRcdHRoaXMuX2tpY2tfcmFmKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0X2tpY2tfcmFmKCkge1xyXG5cdFx0XHRpZiAoIHRoaXMuX3JhZl9pZCApIHJldHVybjtcclxuXHRcdFx0dGhpcy5fcmFmX2lkID0gKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgc2V0VGltZW91dCkoICgpID0+IHtcclxuXHRcdFx0XHR0aGlzLl9yYWZfaWQgPSAwO1xyXG5cdFx0XHRcdGlmICggdGhpcy5fcGVuZGluZ19hbGwgKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nX2FsbCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0dGhpcy5yZWZyZXNoX2FsbCgpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zdCByb3dzID0gQXJyYXkuZnJvbSggdGhpcy5fcGVuZGluZ19yb3dzICk7XHJcblx0XHRcdFx0dGhpcy5fcGVuZGluZ19yb3dzLmNsZWFyKCk7XHJcblx0XHRcdFx0cm93cy5mb3JFYWNoKCAocikgPT4gdGhpcy5yZWZyZXNoX3JvdyggciApICk7XHJcblx0XHRcdH0sIDAgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0cmVmcmVzaF9hbGwoKSB7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8ucGFnZXNfY29udGFpbmVyXHJcblx0XHRcdFx0Py5xdWVyeVNlbGVjdG9yQWxsPy4oICcud3BiY19iZmJfX3JvdycgKVxyXG5cdFx0XHRcdD8uZm9yRWFjaD8uKCAocm93KSA9PiB0aGlzLnJlZnJlc2hfcm93KCByb3cgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJlZnJlc2hfcm93KHJvd19lbCkge1xyXG5cdFx0XHRpZiAoICFyb3dfZWwgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBjb2xzID0gcm93X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHJcblx0XHRcdC8vIDEpIFJlY2FsY3VsYXRlIGVhY2ggY29sdW1u4oCZcyByZXF1aXJlZCBtaW4gcHggYW5kIHdyaXRlIGl0IHRvIHRoZSBDU1MgdmFyLlxyXG5cdFx0XHRjb2xzLmZvckVhY2goIChjb2wpID0+IHRoaXMuYXBwbHlfY29sX21pbiggY29sICkgKTtcclxuXHJcblx0XHRcdC8vIDIpIEVuZm9yY2UgaXQgYXQgdGhlIENTUyBsZXZlbCByaWdodCBhd2F5IHNvIGxheW91dCBjYW7igJl0IHJlbmRlciBuYXJyb3dlci5cclxuXHRcdFx0Y29scy5mb3JFYWNoKCAoY29sKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcHggICAgICAgICAgID0gcGFyc2VGbG9hdCggZ2V0Q29tcHV0ZWRTdHlsZSggY29sICkuZ2V0UHJvcGVydHlWYWx1ZSggJy0td3BiYy1jb2wtbWluJyApIHx8ICcwJyApIHx8IDA7XHJcblx0XHRcdFx0Y29sLnN0eWxlLm1pbldpZHRoID0gcHggPiAwID8gTWF0aC5yb3VuZCggcHggKSArICdweCcgOiAnJztcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gMykgTm9ybWFsaXplIGN1cnJlbnQgYmFzZXMgc28gdGhlIHJvdyByZXNwZWN0cyBhbGwgbWlucyB3aXRob3V0IG92ZXJmbG93LlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IGIgICA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0XHRjb25zdCBncCAgPSBiLmNvbF9nYXBfcGVyY2VudDtcclxuXHRcdFx0XHRjb25zdCBlZmYgPSBiLmxheW91dC5jb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3Jvdyggcm93X2VsLCBncCApOyAgLy8geyBiYXNlcywgYXZhaWxhYmxlIH1cclxuXHRcdFx0XHQvLyBSZS1maXQgKmN1cnJlbnQqIGJhc2VzIGFnYWluc3QgbWlucyAoc2FtZSBhbGdvcml0aG0gbGF5b3V0IGNoaXBzIHVzZSkuXHJcblx0XHRcdFx0Y29uc3QgZml0dGVkID0gVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLl9maXRfd2VpZ2h0c19yZXNwZWN0aW5nX21pbiggYiwgcm93X2VsLCBlZmYuYmFzZXMgKTtcclxuXHRcdFx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIGZpdHRlZCApICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgY2hhbmdlZCA9IGZpdHRlZC5zb21lKCAodiwgaSkgPT4gTWF0aC5hYnMoIHYgLSBlZmYuYmFzZXNbaV0gKSA+IDAuMDEgKTtcclxuXHRcdFx0XHRcdGlmICggY2hhbmdlZCApIHtcclxuXHRcdFx0XHRcdFx0Yi5sYXlvdXQuYXBwbHlfYmFzZXNfdG9fcm93KCByb3dfZWwsIGZpdHRlZCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0dy5fd3BiYz8uZGV2Py5lcnJvcj8uKCAnV1BCQ19CRkJfTWluX1dpZHRoX0d1YXJkIC0gcmVmcmVzaF9yb3cnLCBlICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRhcHBseV9jb2xfbWluKGNvbF9lbCkge1xyXG5cdFx0XHRpZiAoICFjb2xfZWwgKSByZXR1cm47XHJcblx0XHRcdGxldCBtYXhfcHggICAgPSAwO1xyXG5cdFx0XHRjb25zdCBjb2xSZWN0ID0gY29sX2VsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0XHRjb2xfZWwucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fZmllbGQnICkuZm9yRWFjaCggKGZpZWxkKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcmF3ID0gZmllbGQuZ2V0QXR0cmlidXRlKCAnZGF0YS1taW5fd2lkdGgnICk7XHJcblx0XHRcdFx0bGV0IHB4ICAgID0gMDtcclxuXHRcdFx0XHRpZiAoIHJhdyApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHMgPSBTdHJpbmcoIHJhdyApLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRcdFx0aWYgKCBzLmVuZHNXaXRoKCAnJScgKSApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgbiA9IHBhcnNlRmxvYXQoIHMgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCBOdW1iZXIuaXNGaW5pdGUoIG4gKSAmJiBjb2xSZWN0LndpZHRoID4gMCApIHtcclxuXHRcdFx0XHRcdFx0XHRweCA9IChuIC8gMTAwKSAqIGNvbFJlY3Qud2lkdGg7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0cHggPSAwO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRweCA9IHRoaXMucGFyc2VfbGVuX3B4KCBzICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbnN0IGNzID0gZ2V0Q29tcHV0ZWRTdHlsZSggZmllbGQgKTtcclxuXHRcdFx0XHRcdHB4ICAgICAgID0gcGFyc2VGbG9hdCggY3MubWluV2lkdGggfHwgJzAnICkgfHwgMDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBweCA+IG1heF9weCApIG1heF9weCA9IHB4O1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGNvbF9lbC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1jb2wtbWluJywgbWF4X3B4ID4gMCA/IE1hdGgucm91bmQoIG1heF9weCApICsgJ3B4JyA6ICcwcHgnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cGFyc2VfbGVuX3B4KHZhbHVlKSB7XHJcblx0XHRcdGlmICggdmFsdWUgPT0gbnVsbCApIHJldHVybiAwO1xyXG5cdFx0XHRjb25zdCBzID0gU3RyaW5nKCB2YWx1ZSApLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRpZiAoIHMgPT09ICcnICkgcmV0dXJuIDA7XHJcblx0XHRcdGlmICggcy5lbmRzV2l0aCggJ3B4JyApICkge1xyXG5cdFx0XHRcdGNvbnN0IG4gPSBwYXJzZUZsb2F0KCBzICk7XHJcblx0XHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gbiA6IDA7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBzLmVuZHNXaXRoKCAncmVtJyApIHx8IHMuZW5kc1dpdGgoICdlbScgKSApIHtcclxuXHRcdFx0XHRjb25zdCBuICAgID0gcGFyc2VGbG9hdCggcyApO1xyXG5cdFx0XHRcdGNvbnN0IGJhc2UgPSBwYXJzZUZsb2F0KCBnZXRDb21wdXRlZFN0eWxlKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgKS5mb250U2l6ZSApIHx8IDE2O1xyXG5cdFx0XHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIG4gKSA/IG4gKiBiYXNlIDogMDtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBuID0gcGFyc2VGbG9hdCggcyApO1xyXG5cdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBuICkgPyBuIDogMDtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBXUEJDX0JGQl9Ub2dnbGVfTm9ybWFsaXplclxyXG5cdCAqXHJcblx0ICogQ29udmVydHMgcGxhaW4gY2hlY2tib3hlcyBpbnRvIHRvZ2dsZSBVSTpcclxuXHQgKiA8ZGl2IGNsYXNzPVwiaW5zcGVjdG9yX19jb250cm9sIHdwYmNfdWlfX3RvZ2dsZVwiPlxyXG5cdCAqICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGlkPVwie3VuaXF1ZX1cIiBkYXRhLWluc3BlY3Rvci1rZXk9XCIuLi5cIiBjbGFzcz1cImluc3BlY3Rvcl9faW5wdXRcIiByb2xlPVwic3dpdGNoXCJcclxuXHQgKiBhcmlhLWNoZWNrZWQ9XCJ0cnVlfGZhbHNlXCI+XHJcblx0ICogICA8bGFiZWwgY2xhc3M9XCJ3cGJjX3VpX190b2dnbGVfaWNvblwiICBmb3I9XCJ7dW5pcXVlfVwiPjwvbGFiZWw+XHJcblx0ICogICA8bGFiZWwgY2xhc3M9XCJ3cGJjX3VpX190b2dnbGVfbGFiZWxcIiBmb3I9XCJ7dW5pcXVlfVwiPkxhYmVsPC9sYWJlbD5cclxuXHQgKiA8L2Rpdj5cclxuXHQgKlxyXG5cdCAqIC0gU2tpcHMgaW5wdXRzIGFscmVhZHkgaW5zaWRlIGAud3BiY191aV9fdG9nZ2xlYC5cclxuXHQgKiAtIFJldXNlcyBhbiBleGlzdGluZyA8bGFiZWwgZm9yPVwiLi4uXCI+IHRleHQgaWYgcHJlc2VudDsgb3RoZXJ3aXNlIGZhbGxzIGJhY2sgdG8gbmVhcmJ5IGxhYmVscyBvciBhdHRyaWJ1dGVzLlxyXG5cdCAqIC0gQXV0by1nZW5lcmF0ZXMgYSB1bmlxdWUgaWQgd2hlbiBhYnNlbnQuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfVG9nZ2xlX05vcm1hbGl6ZXIgPSBjbGFzcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBVcGdyYWRlIGFsbCByYXcgY2hlY2tib3hlcyBpbiBhIGNvbnRhaW5lciB0byB0b2dnbGVzLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdF9lbFxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgdXBncmFkZV9jaGVja2JveGVzX2luKHJvb3RfZWwpIHtcclxuXHJcblx0XHRcdGlmICggIXJvb3RfZWwgfHwgIXJvb3RfZWwucXVlcnlTZWxlY3RvckFsbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBpbnB1dHMgPSByb290X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICk7XHJcblx0XHRcdGlmICggIWlucHV0cy5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBpbnB1dHMsIGZ1bmN0aW9uIChpbnB1dCkge1xyXG5cclxuXHRcdFx0XHQvLyAxKSBTa2lwIGlmIGFscmVhZHkgaW5zaWRlIHRvZ2dsZSB3cmFwcGVyLlxyXG5cdFx0XHRcdGlmICggaW5wdXQuY2xvc2VzdCggJy53cGJjX3VpX190b2dnbGUnICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIFNraXAgcm93cyAvIHdoZXJlIGlucHV0IGNoZWNrYm94IGV4cGxpY2l0bHkgbWFya2VkIHdpdGggIGF0dHJpYnV0ZSAnZGF0YS13cGJjLXVpLW5vLXRvZ2dsZScuXHJcblx0XHRcdFx0aWYgKCBpbnB1dC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktbm8tdG9nZ2xlJyApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gMikgRW5zdXJlIHVuaXF1ZSBpZDsgcHJlZmVyIGV4aXN0aW5nLlxyXG5cdFx0XHRcdHZhciBpbnB1dF9pZCA9IGlucHV0LmdldEF0dHJpYnV0ZSggJ2lkJyApO1xyXG5cdFx0XHRcdGlmICggIWlucHV0X2lkICkge1xyXG5cdFx0XHRcdFx0dmFyIGtleSAgPSAoaW5wdXQuZGF0YXNldCAmJiBpbnB1dC5kYXRhc2V0Lmluc3BlY3RvcktleSkgPyBTdHJpbmcoIGlucHV0LmRhdGFzZXQuaW5zcGVjdG9yS2V5ICkgOiAnb3B0JztcclxuXHRcdFx0XHRcdGlucHV0X2lkID0gVUkuV1BCQ19CRkJfVG9nZ2xlX05vcm1hbGl6ZXIuZ2VuZXJhdGVfdW5pcXVlX2lkKCAnd3BiY19pbnNfYXV0b18nICsga2V5ICsgJ18nICk7XHJcblx0XHRcdFx0XHRpbnB1dC5zZXRBdHRyaWJ1dGUoICdpZCcsIGlucHV0X2lkICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAzKSBGaW5kIGJlc3QgbGFiZWwgdGV4dC5cclxuXHRcdFx0XHR2YXIgbGFiZWxfdGV4dCA9IFVJLldQQkNfQkZCX1RvZ2dsZV9Ob3JtYWxpemVyLnJlc29sdmVfbGFiZWxfdGV4dCggcm9vdF9lbCwgaW5wdXQsIGlucHV0X2lkICk7XHJcblxyXG5cdFx0XHRcdC8vIDQpIEJ1aWxkIHRoZSB0b2dnbGUgd3JhcHBlci5cclxuXHRcdFx0XHR2YXIgd3JhcHBlciAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdFx0d3JhcHBlci5jbGFzc05hbWUgPSAnaW5zcGVjdG9yX19jb250cm9sIHdwYmNfdWlfX3RvZ2dsZSc7XHJcblxyXG5cdFx0XHRcdC8vIEtlZXAgb3JpZ2luYWwgaW5wdXQ7IGp1c3QgbW92ZSBpdCBpbnRvIHdyYXBwZXIuXHJcblx0XHRcdFx0aW5wdXQuY2xhc3NMaXN0LmFkZCggJ2luc3BlY3Rvcl9faW5wdXQnICk7XHJcblx0XHRcdFx0aW5wdXQuc2V0QXR0cmlidXRlKCAncm9sZScsICdzd2l0Y2gnICk7XHJcblx0XHRcdFx0aW5wdXQuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgaW5wdXQuY2hlY2tlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHJcblx0XHRcdFx0dmFyIGljb25fbGFiZWwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0aWNvbl9sYWJlbC5jbGFzc05hbWUgPSAnd3BiY191aV9fdG9nZ2xlX2ljb24nO1xyXG5cdFx0XHRcdGljb25fbGFiZWwuc2V0QXR0cmlidXRlKCAnZm9yJywgaW5wdXRfaWQgKTtcclxuXHJcblx0XHRcdFx0dmFyIHRleHRfbGFiZWwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0dGV4dF9sYWJlbC5jbGFzc05hbWUgPSAnd3BiY191aV9fdG9nZ2xlX2xhYmVsJztcclxuXHRcdFx0XHR0ZXh0X2xhYmVsLnNldEF0dHJpYnV0ZSggJ2ZvcicsIGlucHV0X2lkICk7XHJcblx0XHRcdFx0dGV4dF9sYWJlbC5hcHBlbmRDaGlsZCggZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoIGxhYmVsX3RleHQgKSApO1xyXG5cclxuXHRcdFx0XHQvLyA1KSBJbnNlcnQgd3JhcHBlciBpbnRvIERPTSBuZWFyIHRoZSBpbnB1dC5cclxuXHRcdFx0XHQvLyAgICBQcmVmZXJyZWQ6IHJlcGxhY2UgdGhlIG9yaWdpbmFsIGxhYmVsZWQgcm93IGlmIGl0IG1hdGNoZXMgdHlwaWNhbCBpbnNwZWN0b3IgbGF5b3V0LlxyXG5cdFx0XHRcdHZhciByZXBsYWNlZCA9IFVJLldQQkNfQkZCX1RvZ2dsZV9Ob3JtYWxpemVyLnRyeV9yZXBsYWNlX2tub3duX3JvdyggaW5wdXQsIHdyYXBwZXIsIGxhYmVsX3RleHQgKTtcclxuXHJcblx0XHRcdFx0aWYgKCAhcmVwbGFjZWQgKSB7XHJcblx0XHRcdFx0XHRpZiAoICFpbnB1dC5wYXJlbnROb2RlICkgcmV0dXJuOyAvLyBORVcgZ3VhcmRcclxuXHRcdFx0XHRcdC8vIEZhbGxiYWNrOiBqdXN0IHdyYXAgdGhlIGlucHV0IGluIHBsYWNlIGFuZCBhcHBlbmQgbGFiZWxzLlxyXG5cdFx0XHRcdFx0aW5wdXQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoIHdyYXBwZXIsIGlucHV0ICk7XHJcblx0XHRcdFx0XHR3cmFwcGVyLmFwcGVuZENoaWxkKCBpbnB1dCApO1xyXG5cdFx0XHRcdFx0d3JhcHBlci5hcHBlbmRDaGlsZCggaWNvbl9sYWJlbCApO1xyXG5cdFx0XHRcdFx0d3JhcHBlci5hcHBlbmRDaGlsZCggdGV4dF9sYWJlbCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gNikgQVJJQSBzeW5jIG9uIGNoYW5nZS5cclxuXHRcdFx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aW5wdXQuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgaW5wdXQuY2hlY2tlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdlbmVyYXRlIGEgdW5pcXVlIGlkIHdpdGggYSBnaXZlbiBwcmVmaXguXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJlZml4XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2VuZXJhdGVfdW5pcXVlX2lkKHByZWZpeCkge1xyXG5cdFx0XHR2YXIgYmFzZSA9IFN0cmluZyggcHJlZml4IHx8ICd3cGJjX2luc19hdXRvXycgKTtcclxuXHRcdFx0dmFyIHVpZCAgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCA4ICk7XHJcblx0XHRcdHZhciBpZCAgID0gYmFzZSArIHVpZDtcclxuXHRcdFx0Ly8gTWluaW1hbCBjb2xsaXNpb24gZ3VhcmQgaW4gdGhlIGN1cnJlbnQgZG9jdW1lbnQgc2NvcGUuXHJcblx0XHRcdHdoaWxlICggZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGlkICkgKSB7XHJcblx0XHRcdFx0dWlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZyggMzYgKS5zbGljZSggMiwgOCApO1xyXG5cdFx0XHRcdGlkICA9IGJhc2UgKyB1aWQ7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGlkO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVzb2x2ZSB0aGUgYmVzdCBodW1hbiBsYWJlbCBmb3IgYW4gaW5wdXQuXHJcblx0XHQgKiBQcmlvcml0eTpcclxuXHRcdCAqICAxKSA8bGFiZWwgZm9yPVwie2lkfVwiPnRleHQ8L2xhYmVsPlxyXG5cdFx0ICogIDIpIG5lYXJlc3Qgc2libGluZy9wYXJlbnQgLmluc3BlY3Rvcl9fbGFiZWwgdGV4dFxyXG5cdFx0ICogIDMpIGlucHV0LmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpIHx8IGRhdGEtbGFiZWwgfHwgZGF0YS1pbnNwZWN0b3Ita2V5IHx8IG5hbWUgfHwgJ09wdGlvbidcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3RfZWxcclxuXHRcdCAqIEBwYXJhbSB7SFRNTElucHV0RWxlbWVudH0gaW5wdXRcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBpbnB1dF9pZFxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlc29sdmVfbGFiZWxfdGV4dChyb290X2VsLCBpbnB1dCwgaW5wdXRfaWQpIHtcclxuXHRcdFx0Ly8gZm9yPSBhc3NvY2lhdGlvblxyXG5cdFx0XHRpZiAoIGlucHV0X2lkICkge1xyXG5cdFx0XHRcdHZhciBhc3NvYyA9IHJvb3RfZWwucXVlcnlTZWxlY3RvciggJ2xhYmVsW2Zvcj1cIicgKyBVSS5XUEJDX0JGQl9Ub2dnbGVfTm9ybWFsaXplci5jc3NfZXNjYXBlKCBpbnB1dF9pZCApICsgJ1wiXScgKTtcclxuXHRcdFx0XHRpZiAoIGFzc29jICYmIGFzc29jLnRleHRDb250ZW50ICkge1xyXG5cdFx0XHRcdFx0dmFyIHR4dCA9IGFzc29jLnRleHRDb250ZW50LnRyaW0oKTtcclxuXHRcdFx0XHRcdC8vIFJlbW92ZSB0aGUgb2xkIGxhYmVsIGZyb20gRE9NOyBpdHMgdGV4dCB3aWxsIGJlIHVzZWQgYnkgdG9nZ2xlLlxyXG5cdFx0XHRcdFx0YXNzb2MucGFyZW50Tm9kZSAmJiBhc3NvYy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBhc3NvYyApO1xyXG5cdFx0XHRcdFx0aWYgKCB0eHQgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0eHQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBuZWFyYnkgaW5zcGVjdG9yIGxhYmVsXHJcblx0XHRcdHZhciBuZWFyX2xhYmVsID0gaW5wdXQuY2xvc2VzdCggJy5pbnNwZWN0b3JfX3JvdycgKTtcclxuXHRcdFx0aWYgKCBuZWFyX2xhYmVsICkge1xyXG5cdFx0XHRcdHZhciBpbCA9IG5lYXJfbGFiZWwucXVlcnlTZWxlY3RvciggJy5pbnNwZWN0b3JfX2xhYmVsJyApO1xyXG5cdFx0XHRcdGlmICggaWwgJiYgaWwudGV4dENvbnRlbnQgKSB7XHJcblx0XHRcdFx0XHR2YXIgdDIgPSBpbC50ZXh0Q29udGVudC50cmltKCk7XHJcblx0XHRcdFx0XHQvLyBJZiB0aGlzIHJvdyBoYWQgdGhlIHN0YW5kYXJkIGxhYmVsK2NvbnRyb2wsIGRyb3AgdGhlIG9sZCB0ZXh0IGxhYmVsIHRvIGF2b2lkIGR1cGxpY2F0ZXMuXHJcblx0XHRcdFx0XHRpbC5wYXJlbnROb2RlICYmIGlsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIGlsICk7XHJcblx0XHRcdFx0XHRpZiAoIHQyICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdDI7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBmYWxsYmFja3NcclxuXHRcdFx0dmFyIGFyaWEgPSBpbnB1dC5nZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJyApO1xyXG5cdFx0XHRpZiAoIGFyaWEgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGFyaWE7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBpbnB1dC5kYXRhc2V0ICYmIGlucHV0LmRhdGFzZXQubGFiZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuIFN0cmluZyggaW5wdXQuZGF0YXNldC5sYWJlbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaW5wdXQuZGF0YXNldCAmJiBpbnB1dC5kYXRhc2V0Lmluc3BlY3RvcktleSApIHtcclxuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBpbnB1dC5kYXRhc2V0Lmluc3BlY3RvcktleSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaW5wdXQubmFtZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBpbnB1dC5uYW1lICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuICdPcHRpb24nO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVHJ5IHRvIHJlcGxhY2UgYSBrbm93biBpbnNwZWN0b3Igcm93IHBhdHRlcm4gd2l0aCBhIHRvZ2dsZSB3cmFwcGVyLlxyXG5cdFx0ICogUGF0dGVybnM6XHJcblx0XHQgKiAgPGRpdi5pbnNwZWN0b3JfX3Jvdz5cclxuXHRcdCAqICAgIDxsYWJlbC5pbnNwZWN0b3JfX2xhYmVsPlRleHQ8L2xhYmVsPlxyXG5cdFx0ICogICAgPGRpdi5pbnNwZWN0b3JfX2NvbnRyb2w+IFtpbnB1dFt0eXBlPWNoZWNrYm94XV0gPC9kaXY+XHJcblx0XHQgKiAgPC9kaXY+XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MSW5wdXRFbGVtZW50fSBpbnB1dFxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gd3JhcHBlclxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IHJlcGxhY2VkXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyB0cnlfcmVwbGFjZV9rbm93bl9yb3coaW5wdXQsIHdyYXBwZXIsIGxhYmVsX3RleHQpIHtcclxuXHRcdFx0dmFyIHJvdyAgICAgICA9IGlucHV0LmNsb3Nlc3QoICcuaW5zcGVjdG9yX19yb3cnICk7XHJcblx0XHRcdHZhciBjdHJsX3dyYXAgPSBpbnB1dC5wYXJlbnRFbGVtZW50O1xyXG5cclxuXHRcdFx0aWYgKCByb3cgJiYgY3RybF93cmFwICYmIGN0cmxfd3JhcC5jbGFzc0xpc3QuY29udGFpbnMoICdpbnNwZWN0b3JfX2NvbnRyb2wnICkgKSB7XHJcblx0XHRcdFx0Ly8gQ2xlYXIgY29udHJvbCB3cmFwIGFuZCByZWluc2VydCB0b2dnbGUgc3RydWN0dXJlLlxyXG5cdFx0XHRcdHdoaWxlICggY3RybF93cmFwLmZpcnN0Q2hpbGQgKSB7XHJcblx0XHRcdFx0XHRjdHJsX3dyYXAucmVtb3ZlQ2hpbGQoIGN0cmxfd3JhcC5maXJzdENoaWxkICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJvdy5jbGFzc0xpc3QuYWRkKCAnaW5zcGVjdG9yX19yb3ctLXRvZ2dsZScgKTtcclxuXHJcblx0XHRcdFx0Y3RybF93cmFwLmNsYXNzTGlzdC5hZGQoICd3cGJjX3VpX190b2dnbGUnICk7XHJcblx0XHRcdFx0Y3RybF93cmFwLmFwcGVuZENoaWxkKCBpbnB1dCApO1xyXG5cclxuXHRcdFx0XHR2YXIgaW5wdXRfaWQgICAgICAgPSBpbnB1dC5nZXRBdHRyaWJ1dGUoICdpZCcgKTtcclxuXHRcdFx0XHR2YXIgaWNvbl9sYmwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0aWNvbl9sYmwuY2xhc3NOYW1lID0gJ3dwYmNfdWlfX3RvZ2dsZV9pY29uJztcclxuXHRcdFx0XHRpY29uX2xibC5zZXRBdHRyaWJ1dGUoICdmb3InLCBpbnB1dF9pZCApO1xyXG5cclxuXHRcdFx0XHR2YXIgdGV4dF9sYmwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0dGV4dF9sYmwuY2xhc3NOYW1lID0gJ3dwYmNfdWlfX3RvZ2dsZV9sYWJlbCc7XHJcblx0XHRcdFx0dGV4dF9sYmwuc2V0QXR0cmlidXRlKCAnZm9yJywgaW5wdXRfaWQgKTtcclxuXHRcdFx0XHRpZiAoIGxhYmVsX3RleHQgKSB7XHJcblx0XHRcdFx0XHR0ZXh0X2xibC5hcHBlbmRDaGlsZCggZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoIGxhYmVsX3RleHQgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBJZiB0aGUgcm93IHByZXZpb3VzbHkgaGFkIGEgLmluc3BlY3Rvcl9fbGFiZWwgKHdlIHJlbW92ZWQgaXQgaW4gcmVzb2x2ZV9sYWJlbF90ZXh0KSxcclxuXHRcdFx0XHQvLyB3ZSBpbnRlbnRpb25hbGx5IGRvIE5PVCByZWNyZWF0ZSBpdDsgdGhlIHRvZ2dsZSB0ZXh0IGxhYmVsIGJlY29tZXMgdGhlIHZpc2libGUgb25lLlxyXG5cdFx0XHRcdC8vIFRoZSB0ZXh0IGNvbnRlbnQgaXMgYWxyZWFkeSByZXNvbHZlZCBpbiByZXNvbHZlX2xhYmVsX3RleHQoKSBhbmQgc2V0IGJlbG93IGJ5IGNhbGxlci5cclxuXHJcblx0XHRcdFx0Y3RybF93cmFwLmFwcGVuZENoaWxkKCBpY29uX2xibCApO1xyXG5cdFx0XHRcdGN0cmxfd3JhcC5hcHBlbmRDaGlsZCggdGV4dF9sYmwgKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gTm90IGEga25vd24gcGF0dGVybjsgY2FsbGVyIHdpbGwgd3JhcCBpbiBwbGFjZS5cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ1NTLmVzY2FwZSBwb2x5ZmlsbCBmb3Igc2VsZWN0b3JzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBjc3NfZXNjYXBlKHMpIHtcclxuXHRcdFx0cyA9IFN0cmluZyggcyApO1xyXG5cdFx0XHRpZiAoIHdpbmRvdy5DU1MgJiYgdHlwZW9mIHdpbmRvdy5DU1MuZXNjYXBlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHJldHVybiB3aW5kb3cuQ1NTLmVzY2FwZSggcyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBzLnJlcGxhY2UoIC8oW15cXHctXSkvZywgJ1xcXFwkMScgKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBhbGwgVUkgbm9ybWFsaXplcnMvZW5oYW5jZXJzIHRvIGEgY29udGFpbmVyIChwb3N0LXJlbmRlcikuXHJcblx0ICogS2VlcCB0aGlzIGZpbGUgc21hbGwgYW5kIGFkZCBtb3JlIG5vcm1hbGl6ZXJzIGxhdGVyIGluIG9uZSBwbGFjZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3RcclxuXHQgKi9cclxuXHRVSS5hcHBseV9wb3N0X3JlbmRlciA9IGZ1bmN0aW9uIChyb290KSB7XHJcblx0XHRpZiAoICFyb290ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR0cnkge1xyXG5cdFx0XHRVSS5XUEJDX0JGQl9WYWx1ZVNsaWRlcj8uaW5pdF9vbj8uKCByb290ICk7XHJcblx0XHR9IGNhdGNoICggZSApIHsgLyogbm9vcCAqL1xyXG5cdFx0fVxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0dmFyIFQgPSBVSS5XUEJDX0JGQl9Ub2dnbGVfTm9ybWFsaXplcjtcclxuXHRcdFx0aWYgKCBUICYmIHR5cGVvZiBULnVwZ3JhZGVfY2hlY2tib3hlc19pbiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRULnVwZ3JhZGVfY2hlY2tib3hlc19pbiggcm9vdCApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0dy5fd3BiYz8uZGV2Py5lcnJvcj8uKCAnYXBwbHlfcG9zdF9yZW5kZXIudG9nZ2xlJywgZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEFjY2Vzc2liaWxpdHk6IGtlZXAgYXJpYS1jaGVja2VkIGluIHN5bmMgZm9yIGFsbCB0b2dnbGVzIGluc2lkZSByb290LlxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdWlfX3RvZ2dsZSBpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkuZm9yRWFjaCggZnVuY3Rpb24gKGNiKSB7XHJcblx0XHRcdFx0aWYgKCBjYi5fX3dwYmNfYXJpYV9ob29rZWQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNiLl9fd3BiY19hcmlhX2hvb2tlZCA9IHRydWU7XHJcblx0XHRcdFx0Y2Iuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgY2IuY2hlY2tlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHRcdFx0XHQvLyBEZWxlZ2F0ZSDigJhjaGFuZ2XigJkganVzdCBvbmNlIHBlciByZW5kZXIg4oCTIG5hdGl2ZSBkZWxlZ2F0aW9uIHN0aWxsIHdvcmtzIGZpbmUgZm9yIHlvdXIgbG9naWMuXHJcblx0XHRcdFx0Y2IuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsICgpID0+IHtcclxuXHRcdFx0XHRcdGNiLnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsIGNiLmNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0fSwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdHcuX3dwYmM/LmRldj8uZXJyb3I/LiggJ2FwcGx5X3Bvc3RfcmVuZGVyLmFyaWEnLCBlICk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0VUkuSW5zcGVjdG9yRW5oYW5jZXJzID0gVUkuSW5zcGVjdG9yRW5oYW5jZXJzIHx8IChmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgcmVncyA9IFtdO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHJlZ2lzdGVyKG5hbWUsIHNlbGVjdG9yLCBpbml0LCBkZXN0cm95KSB7XHJcblx0XHRcdHJlZ3MucHVzaCggeyBuYW1lLCBzZWxlY3RvciwgaW5pdCwgZGVzdHJveSB9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gc2Nhbihyb290KSB7XHJcblx0XHRcdGlmICggIXJvb3QgKSByZXR1cm47XHJcblx0XHRcdHJlZ3MuZm9yRWFjaCggZnVuY3Rpb24gKHIpIHtcclxuXHRcdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHIuc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRcdFx0bm9kZS5fX3dwYmNfZWggPSBub2RlLl9fd3BiY19laCB8fCB7fTtcclxuXHRcdFx0XHRcdGlmICggbm9kZS5fX3dwYmNfZWhbci5uYW1lXSApIHJldHVybjtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdHIuaW5pdCAmJiByLmluaXQoIG5vZGUsIHJvb3QgKTtcclxuXHRcdFx0XHRcdFx0bm9kZS5fX3dwYmNfZWhbci5uYW1lXSA9IHRydWU7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gZGVzdHJveShyb290KSB7XHJcblx0XHRcdGlmICggIXJvb3QgKSByZXR1cm47XHJcblx0XHRcdHJlZ3MuZm9yRWFjaCggZnVuY3Rpb24gKHIpIHtcclxuXHRcdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHIuc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0ci5kZXN0cm95ICYmIHIuZGVzdHJveSggbm9kZSwgcm9vdCApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBub2RlLl9fd3BiY19laCApIGRlbGV0ZSBub2RlLl9fd3BiY19laFtyLm5hbWVdO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7IHJlZ2lzdGVyLCBzY2FuLCBkZXN0cm95IH07XHJcblx0fSkoKTtcclxuXHJcblx0VUkuV1BCQ19CRkJfVmFsdWVTbGlkZXIgPSB7XHJcblx0XHRpbml0X29uKHJvb3QpIHtcclxuXHRcdFx0dmFyIGdyb3VwcyA9IChyb290Lm5vZGVUeXBlID09PSAxID8gWyByb290IF0gOiBbXSkuY29uY2F0KCBbXS5zbGljZS5jYWxsKCByb290LnF1ZXJ5U2VsZWN0b3JBbGw/LiggJ1tkYXRhLWxlbi1ncm91cF0nICkgfHwgW10gKSApO1xyXG5cdFx0XHRncm91cHMuZm9yRWFjaCggZnVuY3Rpb24gKGcpIHtcclxuXHRcdFx0XHRpZiAoICFnLm1hdGNoZXMgfHwgIWcubWF0Y2hlcyggJ1tkYXRhLWxlbi1ncm91cF0nICkgKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCBnLl9fd3BiY19sZW5fd2lyZWQgKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdHZhciBudW1iZXIgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tdmFsdWVdJyApO1xyXG5cdFx0XHRcdHZhciByYW5nZSAgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tcmFuZ2VdJyApO1xyXG5cdFx0XHRcdHZhciB1bml0ICAgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tdW5pdF0nICk7XHJcblxyXG5cdFx0XHRcdGlmICggIW51bWJlciB8fCAhcmFuZ2UgKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdC8vIE1pcnJvciBjb25zdHJhaW50cyBpZiBtaXNzaW5nIG9uIHRoZSByYW5nZS5cclxuXHRcdFx0XHRbICdtaW4nLCAnbWF4JywgJ3N0ZXAnIF0uZm9yRWFjaCggZnVuY3Rpb24gKGEpIHtcclxuXHRcdFx0XHRcdGlmICggIXJhbmdlLmhhc0F0dHJpYnV0ZSggYSApICYmIG51bWJlci5oYXNBdHRyaWJ1dGUoIGEgKSApIHtcclxuXHRcdFx0XHRcdFx0cmFuZ2Uuc2V0QXR0cmlidXRlKCBhLCBudW1iZXIuZ2V0QXR0cmlidXRlKCBhICkgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblxyXG5cclxuXHRcdFx0XHRmdW5jdGlvbiBzeW5jX3JhbmdlX2Zyb21fbnVtYmVyKCkge1xuXHRcdFx0XHRcdGlmICggZy5oYXNBdHRyaWJ1dGUoICdkYXRhLWxlbi1hbGxvdy1lbXB0eScgKSAmJiAnJyA9PT0gbnVtYmVyLnZhbHVlICkge1xuXHRcdFx0XHRcdFx0dmFyIGVtcHR5X3JhbmdlX3ZhbHVlID0gcmFuZ2UubWluIHx8ICcwJztcblx0XHRcdFx0XHRcdGlmICggcmFuZ2UudmFsdWUgIT09IGVtcHR5X3JhbmdlX3ZhbHVlICkge1xuXHRcdFx0XHRcdFx0XHRyYW5nZS52YWx1ZSA9IGVtcHR5X3JhbmdlX3ZhbHVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIHJhbmdlLnZhbHVlICE9PSBudW1iZXIudmFsdWUgKSB7XG5cdFx0XHRcdFx0XHRyYW5nZS52YWx1ZSA9IG51bWJlci52YWx1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZ1bmN0aW9uIGRpc3BhdGNoX2lucHV0KGVsKSB7XHJcblx0XHRcdFx0XHR0cnkgeyBlbC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTsgfSBjYXRjaCAoIF9lICkge31cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZnVuY3Rpb24gZGlzcGF0Y2hfY2hhbmdlKGVsKSB7XHJcblx0XHRcdFx0XHR0cnkgeyBlbC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7IH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBUaHJvdHRsZSByYW5nZS0+bnVtYmVyIHN5bmNpbmcgKHRpbWUtYmFzZWQpLlxyXG5cdFx0XHRcdHZhciB0aW1lcl9pZCAgICAgICA9IDA7XHJcblx0XHRcdFx0dmFyIHBlbmRpbmdfdmFsICAgID0gbnVsbDtcclxuXHRcdFx0XHR2YXIgcGVuZGluZ19jaGFuZ2UgPSBmYWxzZTtcclxuXHRcdFx0XHR2YXIgbGFzdF9mbHVzaF90cyAgPSAwO1xyXG5cclxuXHRcdFx0XHQvLyBDaGFuZ2UgdGhpcyB0byB0dW5lIHNwZWVkOiA1MC4uMTIwIG1zIGlzIGEgZ29vZCByYW5nZS5cclxuXHRcdFx0XHR2YXIgbWluX2ludGVydmFsX21zID0gcGFyc2VJbnQoIGcuZGF0YXNldC5sZW5UaHJvdHRsZSB8fCBVSS5WQUxVRV9TTElERVJfVEhST1RUTEVfTVMsIDEwICk7XHJcblx0XHRcdFx0bWluX2ludGVydmFsX21zID0gTnVtYmVyLmlzRmluaXRlKCBtaW5faW50ZXJ2YWxfbXMgKSA/IE1hdGgubWF4KCAwLCBtaW5faW50ZXJ2YWxfbXMgKSA6IDEyMDtcclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gZmx1c2hfcmFuZ2VfdG9fbnVtYmVyKCkge1xyXG5cdFx0XHRcdFx0dGltZXJfaWQgPSAwO1xyXG5cclxuXHRcdFx0XHRcdGlmICggcGVuZGluZ192YWwgPT0gbnVsbCApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHZhciBuZXh0ICAgID0gU3RyaW5nKCBwZW5kaW5nX3ZhbCApO1xyXG5cdFx0XHRcdFx0cGVuZGluZ192YWwgPSBudWxsO1xyXG5cclxuXHRcdFx0XHRcdGlmICggbnVtYmVyLnZhbHVlICE9PSBuZXh0ICkge1xyXG5cdFx0XHRcdFx0XHRudW1iZXIudmFsdWUgPSBuZXh0O1xyXG5cdFx0XHRcdFx0XHQvLyBJTVBPUlRBTlQ6IG9ubHkgJ2lucHV0JyB3aGlsZSBkcmFnZ2luZy5cclxuXHRcdFx0XHRcdFx0ZGlzcGF0Y2hfaW5wdXQoIG51bWJlciApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggcGVuZGluZ19jaGFuZ2UgKSB7XHJcblx0XHRcdFx0XHRcdHBlbmRpbmdfY2hhbmdlID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdGRpc3BhdGNoX2NoYW5nZSggbnVtYmVyICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0bGFzdF9mbHVzaF90cyA9IERhdGUubm93KCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmdW5jdGlvbiBzY2hlZHVsZV9yYW5nZV90b19udW1iZXIodmFsLCBlbWl0X2NoYW5nZSkge1xyXG5cdFx0XHRcdFx0cGVuZGluZ192YWwgPSB2YWw7XHJcblx0XHRcdFx0XHRpZiAoIGVtaXRfY2hhbmdlICkge1xyXG5cdFx0XHRcdFx0XHRwZW5kaW5nX2NoYW5nZSA9IHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gSWYgY29tbWl0IHJlcXVlc3RlZCwgZmx1c2ggaW1tZWRpYXRlbHkuXHJcblx0XHRcdFx0XHRpZiAoIHBlbmRpbmdfY2hhbmdlICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHRpbWVyX2lkICkge1xyXG5cdFx0XHRcdFx0XHRcdGNsZWFyVGltZW91dCggdGltZXJfaWQgKTtcclxuXHRcdFx0XHRcdFx0XHR0aW1lcl9pZCA9IDA7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0Zmx1c2hfcmFuZ2VfdG9fbnVtYmVyKCk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR2YXIgbm93ICAgPSBEYXRlLm5vdygpO1xyXG5cdFx0XHRcdFx0dmFyIGRlbHRhID0gbm93IC0gbGFzdF9mbHVzaF90cztcclxuXHJcblx0XHRcdFx0XHQvLyBJZiBlbm91Z2ggdGltZSBwYXNzZWQsIGZsdXNoIGltbWVkaWF0ZWx5OyBlbHNlIHNjaGVkdWxlLlxyXG5cdFx0XHRcdFx0aWYgKCBkZWx0YSA+PSBtaW5faW50ZXJ2YWxfbXMgKSB7XHJcblx0XHRcdFx0XHRcdGZsdXNoX3JhbmdlX3RvX251bWJlcigpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCB0aW1lcl9pZCApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHRpbWVyX2lkID0gc2V0VGltZW91dCggZmx1c2hfcmFuZ2VfdG9fbnVtYmVyLCBNYXRoLm1heCggMCwgbWluX2ludGVydmFsX21zIC0gZGVsdGEgKSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gb25fbnVtYmVyX2lucHV0KCkge1xyXG5cdFx0XHRcdFx0c3luY19yYW5nZV9mcm9tX251bWJlcigpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gb25fbnVtYmVyX2NoYW5nZSgpIHtcclxuXHRcdFx0XHRcdHN5bmNfcmFuZ2VfZnJvbV9udW1iZXIoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZ1bmN0aW9uIG9uX3JhbmdlX2lucHV0KCkge1xyXG5cdFx0XHRcdFx0c2NoZWR1bGVfcmFuZ2VfdG9fbnVtYmVyKCByYW5nZS52YWx1ZSwgZmFsc2UgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZ1bmN0aW9uIG9uX3JhbmdlX2NoYW5nZSgpIHtcclxuXHRcdFx0XHRcdHNjaGVkdWxlX3JhbmdlX3RvX251bWJlciggcmFuZ2UudmFsdWUsIHRydWUgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdG51bWJlci5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCAgb25fbnVtYmVyX2lucHV0ICk7XHJcblx0XHRcdFx0bnVtYmVyLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBvbl9udW1iZXJfY2hhbmdlICk7XHJcblx0XHRcdFx0cmFuZ2UuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgIG9uX3JhbmdlX2lucHV0ICk7XHJcblx0XHRcdFx0cmFuZ2UuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIG9uX3JhbmdlX2NoYW5nZSApO1xyXG5cclxuXHRcdFx0XHRpZiAoIHVuaXQgKSB7XHJcblx0XHRcdFx0XHR1bml0LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdC8vIFdlIGp1c3QgbnVkZ2UgdGhlIG51bWJlciBzbyB1cHN0cmVhbSBoYW5kbGVycyByZS1ydW4uXHJcblx0XHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdFx0bnVtYmVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEluaXRpYWwgc3luY1xyXG5cdFx0XHRcdHN5bmNfcmFuZ2VfZnJvbV9udW1iZXIoKTtcclxuXHJcblx0XHRcdFx0Zy5fX3dwYmNfbGVuX3dpcmVkID0ge1xyXG5cdFx0XHRcdFx0ZGVzdHJveSgpIHtcclxuXHRcdFx0XHRcdFx0bnVtYmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsICBvbl9udW1iZXJfaW5wdXQgKTtcclxuXHRcdFx0XHRcdFx0bnVtYmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBvbl9udW1iZXJfY2hhbmdlICk7XHJcblx0XHRcdFx0XHRcdHJhbmdlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsICBvbl9yYW5nZV9pbnB1dCApO1xyXG5cdFx0XHRcdFx0XHRyYW5nZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgb25fcmFuZ2VfY2hhbmdlICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSxcclxuXHRcdGRlc3Ryb3lfb24ocm9vdCkge1xyXG5cdFx0XHR2YXIgZ3JvdXBzID0gKHJvb3QgJiYgcm9vdC5ub2RlVHlwZSA9PT0gMSA/IFsgcm9vdCBdIDogW10pLmNvbmNhdChcclxuXHRcdFx0XHRbXS5zbGljZS5jYWxsKCByb290LnF1ZXJ5U2VsZWN0b3JBbGw/LiggJ1tkYXRhLWxlbi1ncm91cF0nICkgfHwgW10gKVxyXG5cdFx0XHQpO1xyXG5cdFx0XHRncm91cHMuZm9yRWFjaCggZnVuY3Rpb24gKGcpIHtcclxuXHRcdFx0XHRpZiAoICFnLm1hdGNoZXMgfHwgIWcubWF0Y2hlcyggJ1tkYXRhLWxlbi1ncm91cF0nICkgKSByZXR1cm47XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGcuX193cGJjX2xlbl93aXJlZCAmJiBnLl9fd3BiY19sZW5fd2lyZWQuZGVzdHJveSAmJiBnLl9fd3BiY19sZW5fd2lyZWQuZGVzdHJveSgpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZGVsZXRlIGcuX193cGJjX2xlbl93aXJlZDtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIFJlZ2lzdGVyIHdpdGggdGhlIGdsb2JhbCBlbmhhbmNlcnMgaHViLlxyXG5cdFVJLkluc3BlY3RvckVuaGFuY2VycyAmJiBVSS5JbnNwZWN0b3JFbmhhbmNlcnMucmVnaXN0ZXIoXHJcblx0XHQndmFsdWUtc2xpZGVyJyxcclxuXHRcdCdbZGF0YS1sZW4tZ3JvdXBdJyxcclxuXHRcdGZ1bmN0aW9uIChlbCwgX3Jvb3QpIHtcclxuXHRcdFx0VUkuV1BCQ19CRkJfVmFsdWVTbGlkZXIuaW5pdF9vbiggZWwgKTtcclxuXHRcdH0sXHJcblx0XHRmdW5jdGlvbiAoZWwsIF9yb290KSB7XHJcblx0XHRcdFVJLldQQkNfQkZCX1ZhbHVlU2xpZGVyLmRlc3Ryb3lfb24oIGVsICk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0Ly8gU2luZ2xlLCBsb2FkLW9yZGVyLXNhZmUgcGF0Y2ggc28gZW5oYW5jZXJzIGF1dG8tcnVuIG9uIGV2ZXJ5IGJpbmQuXHJcblx0KGZ1bmN0aW9uIHBhdGNoSW5zcGVjdG9yRW5oYW5jZXJzKCkge1xyXG5cdFx0ZnVuY3Rpb24gYXBwbHlQYXRjaCgpIHtcclxuXHRcdFx0dmFyIEluc3BlY3RvciA9IHcuV1BCQ19CRkJfSW5zcGVjdG9yO1xyXG5cdFx0XHRpZiAoICFJbnNwZWN0b3IgfHwgSW5zcGVjdG9yLl9fd3BiY19lbmhhbmNlcnNfcGF0Y2hlZCApIHJldHVybiBmYWxzZTtcclxuXHRcdFx0SW5zcGVjdG9yLl9fd3BiY19lbmhhbmNlcnNfcGF0Y2hlZCA9IHRydWU7XHJcblx0XHRcdHZhciBvcmlnICAgICAgICAgICAgICAgICAgICAgICAgICAgPSBJbnNwZWN0b3IucHJvdG90eXBlLmJpbmRfdG9fZmllbGQ7XHJcblx0XHRcdEluc3BlY3Rvci5wcm90b3R5cGUuYmluZF90b19maWVsZCAgPSBmdW5jdGlvbiAoZWwpIHtcclxuXHRcdFx0XHRvcmlnLmNhbGwoIHRoaXMsIGVsICk7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHZhciBpbnMgPSB0aGlzLnBhbmVsXHJcblx0XHRcdFx0XHRcdHx8IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKVxyXG5cdFx0XHRcdFx0XHR8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0XHRVSS5JbnNwZWN0b3JFbmhhbmNlcnMgJiYgVUkuSW5zcGVjdG9yRW5oYW5jZXJzLnNjYW4oIGlucyApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblx0XHRcdC8vIEluaXRpYWwgc2NhbiBpZiB0aGUgRE9NIGlzIGFscmVhZHkgcHJlc2VudC5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgaW5zRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InIClcclxuXHRcdFx0XHRcdHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0XHRVSS5JbnNwZWN0b3JFbmhhbmNlcnMgJiYgVUkuSW5zcGVjdG9yRW5oYW5jZXJzLnNjYW4oIGluc0VsICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUcnkgbm93OyBpZiBJbnNwZWN0b3IgaXNu4oCZdCBkZWZpbmVkIHlldCwgcGF0Y2ggd2hlbiBpdCBiZWNvbWVzIHJlYWR5LlxyXG5cdFx0aWYgKCAhYXBwbHlQYXRjaCgpICkge1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFxyXG5cdFx0XHRcdCd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLFxyXG5cdFx0XHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdGFwcGx5UGF0Y2goKTtcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHsgb25jZTogdHJ1ZSB9XHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblx0fSkoKTtcclxuXHJcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSk7XHJcbiIsIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX19qcy9jb3JlL2JmYi1zeW5jLWNvZGUtdG9vbHMtdGFiLmpzICAgfCAyMDI2LTA0LTA2IHwgMTY6MzhcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAoIHcsIGQgKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvKipcclxuXHQgKiBEaXNwYXRjaCByZXF1ZXN0IHRvIHNob3cgYSByaWdodCBzaWRlYmFyIHBhbmVsLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHBhbmVsX2lkXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHRhYl9pZFxyXG5cdCAqXHJcblx0ICogQHJldHVybiB7dm9pZH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fZGlzcGF0Y2hfc2hvd19wYW5lbCggcGFuZWxfaWQsIHRhYl9pZCApIHtcclxuXHJcblx0XHR2YXIgZXZlbnRfZGV0YWlsO1xyXG5cclxuXHRcdGlmICggISBwYW5lbF9pZCB8fCAhIHRhYl9pZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGV2ZW50X2RldGFpbCA9IHtcclxuXHRcdFx0cGFuZWxfaWQ6IHBhbmVsX2lkLFxyXG5cdFx0XHR0YWJfaWQgIDogdGFiX2lkXHJcblx0XHR9O1xyXG5cclxuXHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHcud3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjX2JmYjpzaG93X3BhbmVsJywgZXZlbnRfZGV0YWlsICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRkLmRpc3BhdGNoRXZlbnQoXHJcblx0XHRcdG5ldyBDdXN0b21FdmVudChcclxuXHRcdFx0XHQnd3BiY19iZmI6c2hvd19wYW5lbCcsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0ZGV0YWlsOiBldmVudF9kZXRhaWxcclxuXHRcdFx0XHR9XHJcblx0XHRcdClcclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTeW5jIHJpZ2h0IHNpZGViYXIgd2l0aCB0b3AgbW9kZSB0YWJzLlxyXG5cdCAqXHJcblx0ICogVXNlcyB0b3AgdGFicyBuYXYgYXR0cmlidXRlIGBkYXRhLWFjdGl2ZS10YWJgIGFzIHRoZSBzb3VyY2Ugb2YgdHJ1dGguXHJcblx0ICogVGhpcyBhdm9pZHMgZmFsc2UgZGV0ZWN0aW9uIG9uIGluaXRpYWwgcGFnZSBsb2FkLCBiZWNhdXNlIHRvcCBwYW5lbHMgYXJlXHJcblx0ICogaGlkZGVuIGJ5IGlubGluZSBzdHlsZSBgZGlzcGxheTpub25lYCwgbm90IGJ5IHRoZSBgaGlkZGVuYCBhdHRyaWJ1dGUuXHJcblx0ICovXHJcblx0Y2xhc3MgV1BCQ19CRkJfTW9kZV9SaWdodGJhcl9TeW5jIHtcclxuXHJcblx0XHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdFx0dGhpcy50b3BfdGFic19uYXYgICAgICA9IG51bGw7XHJcblx0XHRcdHRoaXMuYWR2YW5jZWRfdGFiX3dyYXAgPSBudWxsO1xyXG5cdFx0XHR0aGlzLmFkdmFuY2VkX3BhbmVsICAgID0gbnVsbDtcclxuXHRcdFx0dGhpcy5tdXRhdGlvbl9vYnNlcnZlciA9IG51bGw7XHJcblx0XHRcdHRoaXMubGFzdF9tb2RlICAgICAgICAgPSAnJztcclxuXHRcdFx0dGhpcy5zeW5jX3JpZ2h0YmFyX21vZGUgPSB0aGlzLnN5bmNfcmlnaHRiYXJfbW9kZS5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuaGFuZGxlX2NsaWNrICAgICAgPSB0aGlzLmhhbmRsZV9jbGljay5iaW5kKCB0aGlzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbml0IGNvbnRyb2xsZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0dGhpcy50b3BfdGFic19uYXYgICAgICA9IGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fdG9wX2hvcmlzb250YWxfbmF2JyApO1xyXG5cdFx0XHR0aGlzLmFkdmFuY2VkX3RhYl93cmFwID0gZC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19yaWdodGJhcl90YWJfd3JhcC0tYWR2YW5jZWRfdG9vbHMnICk7XHJcblx0XHRcdHRoaXMuYWR2YW5jZWRfcGFuZWwgICAgPSBkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3Rvcl9hZHZhbmNlZF90b29scycgKTtcclxuXHJcblx0XHRcdGlmICggISB0aGlzLmFkdmFuY2VkX3RhYl93cmFwIHx8ICEgdGhpcy5hZHZhbmNlZF9wYW5lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE9ic2VydmUgYWN0aXZlIHRhYiBjaGFuZ2VzIGluIHRoZSB0b3AgdGFicyBuYXYuXHJcblx0XHRcdGlmICggdGhpcy50b3BfdGFic19uYXYgKSB7XHJcblx0XHRcdFx0dGhpcy5tdXRhdGlvbl9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCB0aGlzLnN5bmNfcmlnaHRiYXJfbW9kZSApO1xyXG5cdFx0XHRcdHRoaXMubXV0YXRpb25fb2JzZXJ2ZXIub2JzZXJ2ZShcclxuXHRcdFx0XHRcdHRoaXMudG9wX3RhYnNfbmF2LFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRhdHRyaWJ1dGVzICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRcdGF0dHJpYnV0ZUZpbHRlcjogWyAnZGF0YS1hY3RpdmUtdGFiJyBdXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRmFsbGJhY2sgZm9yIGNsaWNrLWRyaXZlbiBzd2l0Y2hpbmcuXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5oYW5kbGVfY2xpY2ssIHRydWUgKTtcclxuXHJcblx0XHRcdC8vIEluaXRpYWwgc3luYy5cclxuXHRcdFx0dGhpcy5zeW5jX3JpZ2h0YmFyX21vZGUoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBhY3RpdmUgdG9wIHRhYiBpZC5cclxuXHRcdCAqXHJcblx0XHQgKiBQcmlvcml0eTpcclxuXHRcdCAqIDEuIGRhdGEtYWN0aXZlLXRhYiBmcm9tIHRvcCB0YWJzIG5hdlxyXG5cdFx0ICogMi4gYWN0aXZlIENTUyBjbGFzcyBpbiBuYXZcclxuXHRcdCAqIDMuIHZpc2libGUgdG9wIHBhbmVsIGZhbGxiYWNrXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRnZXRfYWN0aXZlX3RvcF90YWJfaWQoKSB7XHJcblx0XHRcdHZhciBhY3RpdmVfdGFiX2lkID0gJyc7XHJcblx0XHRcdHZhciBhY3RpdmVfbGluayAgID0gbnVsbDtcclxuXHRcdFx0dmFyIGFkdmFuY2VkX3BhbmVsID0gbnVsbDtcclxuXHRcdFx0dmFyIGJ1aWxkZXJfcGFuZWwgID0gbnVsbDtcclxuXHJcblx0XHRcdGlmICggdGhpcy50b3BfdGFic19uYXYgKSB7XHJcblx0XHRcdFx0YWN0aXZlX3RhYl9pZCA9IFN0cmluZyggdGhpcy50b3BfdGFic19uYXYuZ2V0QXR0cmlidXRlKCAnZGF0YS1hY3RpdmUtdGFiJyApIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0XHRcdGlmICggJycgIT09IGFjdGl2ZV90YWJfaWQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gYWN0aXZlX3RhYl9pZDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGFjdGl2ZV9saW5rID0gdGhpcy50b3BfdGFic19uYXYucXVlcnlTZWxlY3RvciggJy53cGJjX3VpX2VsX19ob3Jpc19uYXZfaXRlbS5hY3RpdmUgW2RhdGEtd3BiYy1iZmItdGFiXScgKTtcclxuXHRcdFx0XHRpZiAoIGFjdGl2ZV9saW5rICkge1xyXG5cdFx0XHRcdFx0YWN0aXZlX3RhYl9pZCA9IFN0cmluZyggYWN0aXZlX2xpbmsuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi10YWInICkgfHwgJycgKS50cmltKCk7XHJcblx0XHRcdFx0XHRpZiAoICcnICE9PSBhY3RpdmVfdGFiX2lkICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gYWN0aXZlX3RhYl9pZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZpbmFsIGZhbGxiYWNrOiBkZXRlY3QgdmlzaWJsZSBwYW5lbC5cclxuXHRcdFx0YWR2YW5jZWRfcGFuZWwgPSBkLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3RvcF90YWJfc2VjdGlvbl9fYWR2YW5jZWRfdGFiJyApO1xyXG5cdFx0XHRidWlsZGVyX3BhbmVsICA9IGQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fdG9wX3RhYl9zZWN0aW9uX19idWlsZGVyX3RhYicgKTtcclxuXHJcblx0XHRcdGlmICggdGhpcy5pc19lbGVtZW50X3Zpc2libGUoIGFkdmFuY2VkX3BhbmVsICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuICdhZHZhbmNlZF90YWInO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggdGhpcy5pc19lbGVtZW50X3Zpc2libGUoIGJ1aWxkZXJfcGFuZWwgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gJ2J1aWxkZXJfdGFiJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgZWxlbWVudCB2aXNpYmlsaXR5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gZWxcclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRpc19lbGVtZW50X3Zpc2libGUoIGVsICkge1xyXG5cdFx0XHR2YXIgc3R5bGU7XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRzdHlsZSA9IHcuZ2V0Q29tcHV0ZWRTdHlsZSggZWwgKTtcclxuXHJcblx0XHRcdGlmICggISBzdHlsZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ25vbmUnID09PSBzdHlsZS5kaXNwbGF5ICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAnaGlkZGVuJyA9PT0gc3R5bGUudmlzaWJpbGl0eSApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgaWYgQWR2YW5jZWQgTW9kZSBpcyBhY3RpdmUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0aXNfYWR2YW5jZWRfbW9kZV9hY3RpdmUoKSB7XHJcblx0XHRcdHJldHVybiAoICdhZHZhbmNlZF90YWInID09PSB0aGlzLmdldF9hY3RpdmVfdG9wX3RhYl9pZCgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IENvZGUgVG9vbHMgdGFiIGJ1dHRvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzaG93X2FkdmFuY2VkX3Rvb2xzX3RhYigpIHtcclxuXHRcdFx0dGhpcy5hZHZhbmNlZF90YWJfd3JhcC5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XHJcblx0XHRcdHRoaXMuYWR2YW5jZWRfdGFiX3dyYXAuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIaWRlIENvZGUgVG9vbHMgdGFiIGJ1dHRvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRoaWRlX2FkdmFuY2VkX3Rvb2xzX3RhYigpIHtcclxuXHRcdFx0dGhpcy5hZHZhbmNlZF90YWJfd3JhcC5zZXRBdHRyaWJ1dGUoICdoaWRkZW4nLCAndHJ1ZScgKTtcclxuXHRcdFx0dGhpcy5hZHZhbmNlZF90YWJfd3JhcC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgaWYgQ29kZSBUb29scyBwYW5lbCBpcyBjdXJyZW50bHkgYWN0aXZlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGlzX2FkdmFuY2VkX3Rvb2xzX3BhbmVsX2FjdGl2ZSgpIHtcclxuXHRcdFx0cmV0dXJuICEhICggdGhpcy5hZHZhbmNlZF9wYW5lbCAmJiAhIHRoaXMuYWR2YW5jZWRfcGFuZWwuaGFzQXR0cmlidXRlKCAnaGlkZGVuJyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIENvZGUgVG9vbHMgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9hZHZhbmNlZF90b29sc19wYW5lbCgpIHtcclxuXHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX3Nob3dfcGFuZWwoICd3cGJjX2JmYl9faW5zcGVjdG9yX2FkdmFuY2VkX3Rvb2xzJywgJ3dwYmNfdGFiX2FkdmFuY2VkX3Rvb2xzJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3BlbiBkZWZhdWx0IGJ1aWxkZXIgcmlnaHRiYXIgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9kZWZhdWx0X3Zpc3VhbF9wYW5lbCgpIHtcclxuXHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX3Nob3dfcGFuZWwoICd3cGJjX2JmYl9fcGFsZXR0ZV9hZGRfbmV3JywgJ3dwYmNfdGFiX2xpYnJhcnknICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTeW5jIHJpZ2h0YmFyIG1vZGUgd2l0aCB0b3AgdGFicyBtb2RlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN5bmNfcmlnaHRiYXJfbW9kZSgpIHtcclxuXHRcdFx0dmFyIGlzX2FkdmFuY2VkX21vZGUgPSB0aGlzLmlzX2FkdmFuY2VkX21vZGVfYWN0aXZlKCk7XHJcblxyXG5cdFx0XHRpZiAoIGlzX2FkdmFuY2VkX21vZGUgKSB7XHJcblx0XHRcdFx0dGhpcy5zaG93X2FkdmFuY2VkX3Rvb2xzX3RhYigpO1xyXG5cclxuXHRcdFx0XHRpZiAoICdhZHZhbmNlZCcgIT09IHRoaXMubGFzdF9tb2RlICkge1xyXG5cdFx0XHRcdFx0dGhpcy5vcGVuX2FkdmFuY2VkX3Rvb2xzX3BhbmVsKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR0aGlzLmxhc3RfbW9kZSA9ICdhZHZhbmNlZCc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHRoaXMuaXNfYWR2YW5jZWRfdG9vbHNfcGFuZWxfYWN0aXZlKCkgKSB7XHJcblx0XHRcdFx0dGhpcy5vcGVuX2RlZmF1bHRfdmlzdWFsX3BhbmVsKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuaGlkZV9hZHZhbmNlZF90b29sc190YWIoKTtcclxuXHRcdFx0dGhpcy5sYXN0X21vZGUgPSAnYnVpbGRlcic7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBGYWxsYmFjayBjbGljayBoYW5kbGVyIGZvciB0b3AgdGFicy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGhhbmRsZV9jbGljayggZXZlbnQgKSB7XHJcblx0XHRcdHZhciB0YXJnZXQgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYmZiLXRhYl0nICk7XHJcblx0XHRcdHZhciB0aGlzX29iaiA9IHRoaXM7XHJcblxyXG5cdFx0XHRpZiAoICEgdGFyZ2V0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0c2V0VGltZW91dChcclxuXHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHR0aGlzX29iai5zeW5jX3JpZ2h0YmFyX21vZGUoKTtcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdDBcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycgKSB7XHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoXHJcblx0XHRcdCdET01Db250ZW50TG9hZGVkJyxcclxuXHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdCggbmV3IFdQQkNfQkZCX01vZGVfUmlnaHRiYXJfU3luYygpICkuaW5pdCgpO1xyXG5cdFx0XHR9XHJcblx0XHQpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQoIG5ldyBXUEJDX0JGQl9Nb2RlX1JpZ2h0YmFyX1N5bmMoKSApLmluaXQoKTtcclxuXHR9XHJcblxyXG59KSggd2luZG93LCBkb2N1bWVudCApOyIsIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9jb3JlL2JmYi1pbnNwZWN0b3IuanMgPT0gVGltZSBwb2ludDogMjAyNS0wOS0wNiAxNDowOFxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICh3KSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvLyAxKSBBY3Rpb25zIHJlZ2lzdHJ5LlxyXG5cclxuXHQvKiogQHR5cGUge1JlY29yZDxzdHJpbmcsIChjdHg6IEluc3BlY3RvckFjdGlvbkNvbnRleHQpID0+IHZvaWQ+fSAqL1xyXG5cdGNvbnN0IF9fSU5TUEVDVE9SX0FDVElPTlNfTUFQX18gPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XHJcblxyXG5cdC8vIEJ1aWx0LWlucy5cclxuXHRfX0lOU1BFQ1RPUl9BQ1RJT05TX01BUF9fWydkZXNlbGVjdCddID0gKHsgYnVpbGRlciB9KSA9PiB7XHJcblx0XHRidWlsZGVyPy5zZWxlY3RfZmllbGQ/LiggbnVsbCApO1xyXG5cdH07XHJcblxyXG5cdF9fSU5TUEVDVE9SX0FDVElPTlNfTUFQX19bJ3Njcm9sbHRvJ10gPSAoeyBidWlsZGVyLCBlbCB9KSA9PiB7XHJcblx0XHRpZiAoICFlbCB8fCAhZG9jdW1lbnQuYm9keS5jb250YWlucyggZWwgKSApIHJldHVybjtcclxuXHRcdGJ1aWxkZXI/LnNlbGVjdF9maWVsZD8uKCBlbCwgeyBzY3JvbGxJbnRvVmlldzogdHJ1ZSB9ICk7XHJcblx0XHRlbC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX3Njcm9sbC1wdWxzZScgKTtcclxuXHRcdHNldFRpbWVvdXQoICgpID0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fc2Nyb2xsLXB1bHNlJyApLCA3MDAgKTtcclxuXHR9O1xyXG5cclxuXHRfX0lOU1BFQ1RPUl9BQ1RJT05TX01BUF9fWydtb3ZlLXVwJ10gPSAoeyBidWlsZGVyLCBlbCB9KSA9PiB7XHJcblx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHRcdGJ1aWxkZXI/Lm1vdmVfaXRlbT8uKCBlbCwgJ3VwJyApO1xyXG5cdFx0Ly8gU2Nyb2xsIGFmdGVyIHRoZSBET00gaGFzIHNldHRsZWQuXHJcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4gX19JTlNQRUNUT1JfQUNUSU9OU19NQVBfX1snc2Nyb2xsdG8nXSh7IGJ1aWxkZXIsIGVsIH0pKTtcclxuXHR9O1xyXG5cclxuXHRfX0lOU1BFQ1RPUl9BQ1RJT05TX01BUF9fWydtb3ZlLWRvd24nXSA9ICh7IGJ1aWxkZXIsIGVsIH0pID0+IHtcclxuXHRcdGlmICggIWVsICkgcmV0dXJuO1xyXG5cdFx0YnVpbGRlcj8ubW92ZV9pdGVtPy4oIGVsLCAnZG93bicgKTtcclxuXHRcdC8vIFNjcm9sbCBhZnRlciB0aGUgRE9NIGhhcyBzZXR0bGVkLlxyXG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IF9fSU5TUEVDVE9SX0FDVElPTlNfTUFQX19bJ3Njcm9sbHRvJ10oeyBidWlsZGVyLCBlbCB9KSk7XHJcblx0fTtcclxuXHJcblx0X19JTlNQRUNUT1JfQUNUSU9OU19NQVBfX1snZGVsZXRlJ10gPSAoeyBidWlsZGVyLCBlbCwgY29uZmlybSA9IHcuY29uZmlybSB9KSA9PiB7XHJcblx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHRcdGNvbnN0IGlzX2ZpZWxkID0gZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0Y29uc3QgbGFiZWwgICAgPSBpc19maWVsZFxyXG5cdFx0XHQ/IChlbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19maWVsZC1sYWJlbCcgKT8udGV4dENvbnRlbnQgfHwgZWwuZGF0YXNldD8uaWQgfHwgJ2ZpZWxkJylcclxuXHRcdFx0OiAoZWwuZGF0YXNldD8uaWQgfHwgJ3NlY3Rpb24nKTtcclxuXHJcblx0XHRVSS5Nb2RhbF9Db25maXJtX0RlbGV0ZS5vcGVuKCBsYWJlbCwgKCkgPT4ge1xyXG5cdFx0XHQvLyBDZW50cmFsIGNvbW1hbmQgd2lsbCByZW1vdmUsIGVtaXQgZXZlbnRzLCBhbmQgcmVzZWxlY3QgbmVpZ2hib3IgKHdoaWNoIHJlLWJpbmRzIEluc3BlY3RvcikuXHJcblx0XHRcdGJ1aWxkZXI/LmRlbGV0ZV9pdGVtPy4oIGVsICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdH07XHJcblxyXG5cdF9fSU5TUEVDVE9SX0FDVElPTlNfTUFQX19bJ2R1cGxpY2F0ZSddID0gKHsgYnVpbGRlciwgZWwgfSkgPT4ge1xyXG5cdFx0aWYgKCAhZWwgKSByZXR1cm47XHJcblx0XHRjb25zdCBjbG9uZSA9IGJ1aWxkZXI/LmR1cGxpY2F0ZV9pdGVtPy4oIGVsICk7XHJcblx0XHRpZiAoIGNsb25lICkgYnVpbGRlcj8uc2VsZWN0X2ZpZWxkPy4oIGNsb25lLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHR9O1xyXG5cclxuXHQvLyBQdWJsaWMgQVBJLlxyXG5cdHcuV1BCQ19CRkJfSW5zcGVjdG9yX0FjdGlvbnMgPSB7XHJcblx0XHRydW4obmFtZSwgY3R4KSB7XHJcblx0XHRcdGNvbnN0IGZuID0gX19JTlNQRUNUT1JfQUNUSU9OU19NQVBfX1tuYW1lXTtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgKSBmbiggY3R4ICk7XHJcblx0XHRcdGVsc2UgY29uc29sZS53YXJuKCAnV1BCQy4gSW5zcGVjdG9yIGFjdGlvbiBub3QgZm91bmQ6JywgbmFtZSApO1xyXG5cdFx0fSxcclxuXHRcdHJlZ2lzdGVyKG5hbWUsIGhhbmRsZXIpIHtcclxuXHRcdFx0aWYgKCAhbmFtZSB8fCB0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdyZWdpc3RlcihuYW1lLCBoYW5kbGVyKTogaW52YWxpZCBhcmd1bWVudHMnICk7XHJcblx0XHRcdH1cclxuXHRcdFx0X19JTlNQRUNUT1JfQUNUSU9OU19NQVBfX1tuYW1lXSA9IGhhbmRsZXI7XHJcblx0XHR9LFxyXG5cdFx0aGFzKG5hbWUpIHtcclxuXHRcdFx0cmV0dXJuIHR5cGVvZiBfX0lOU1BFQ1RPUl9BQ1RJT05TX01BUF9fW25hbWVdID09PSAnZnVuY3Rpb24nO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIDIpIEluc3BlY3RvciBGYWN0b3J5LlxyXG5cclxuXHR2YXIgVUkgPSAody5XUEJDX0JGQl9Db3JlLlVJID0gdy5XUEJDX0JGQl9Db3JlLlVJIHx8IHt9KTtcclxuXHJcblx0Ly8gR2xvYmFsIEh5YnJpZCsrIHJlZ2lzdHJpZXMgKGtlZXAgcHVibGljKS5cclxuXHR3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3Nsb3RzICAgICAgPSB3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3Nsb3RzIHx8IHt9O1xyXG5cdHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3RvcnlfdmFsdWVfZnJvbSA9IHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3RvcnlfdmFsdWVfZnJvbSB8fCB7fTtcclxuXHJcblx0Ly8gRGVmaW5lIEZhY3Rvcnkgb25seSBpZiBtaXNzaW5nIChubyBlYXJseSByZXR1cm4gZm9yIHRoZSB3aG9sZSBidW5kbGUpLlxyXG5cdC8vIGFsd2F5cyBkZWZpbmUvcmVwbGFjZSBGYWN0b3J5XHJcblx0e1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVXRpbGl0eTogY3JlYXRlIGVsZW1lbnQgd2l0aCBhdHRyaWJ1dGVzIGFuZCBjaGlsZHJlbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGFnXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdD19IGF0dHJzXHJcblx0XHQgKiBAcGFyYW0geyhOb2RlfHN0cmluZ3xBcnJheTxOb2RlfHN0cmluZz4pPX0gY2hpbGRyZW5cclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gZWwodGFnLCBhdHRycywgY2hpbGRyZW4pIHtcclxuXHRcdFx0dmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCB0YWcgKTtcclxuXHRcdFx0aWYgKCBhdHRycyApIHtcclxuXHRcdFx0XHRPYmplY3Qua2V5cyggYXR0cnMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoaykge1xyXG5cdFx0XHRcdFx0dmFyIHYgPSBhdHRyc1trXTtcclxuXHRcdFx0XHRcdGlmICggdiA9PSBudWxsICkgcmV0dXJuO1xyXG5cdFx0XHRcdFx0aWYgKCBrID09PSAnY2xhc3MnICkge1xyXG5cdFx0XHRcdFx0XHRub2RlLmNsYXNzTmFtZSA9IHY7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggayA9PT0gJ2RhdGFzZXQnICkge1xyXG5cdFx0XHRcdFx0XHRPYmplY3Qua2V5cyggdiApLmZvckVhY2goIGZ1bmN0aW9uIChkaykge1xyXG5cdFx0XHRcdFx0XHRcdG5vZGUuZGF0YXNldFtka10gPSBTdHJpbmcoIHZbZGtdICk7XHJcblx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBrID09PSAnY2hlY2tlZCcgJiYgdHlwZW9mIHYgPT09ICdib29sZWFuJyApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCB2ICkgbm9kZS5zZXRBdHRyaWJ1dGUoICdjaGVja2VkJywgJ2NoZWNrZWQnICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggayA9PT0gJ2Rpc2FibGVkJyAmJiB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHYgKSBub2RlLnNldEF0dHJpYnV0ZSggJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvLyBub3JtYWxpemUgYm9vbGVhbiBhdHRyaWJ1dGVzIHRvIHN0cmluZ3MuXHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB2ID09PSAnYm9vbGVhbicgKSB7XHJcblx0XHRcdFx0XHRcdG5vZGUuc2V0QXR0cmlidXRlKCBrLCB2ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZSggaywgU3RyaW5nKCB2ICkgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBjaGlsZHJlbiApIHtcclxuXHRcdFx0XHQoQXJyYXkuaXNBcnJheSggY2hpbGRyZW4gKSA/IGNoaWxkcmVuIDogWyBjaGlsZHJlbiBdKS5mb3JFYWNoKCBmdW5jdGlvbiAoYykge1xyXG5cdFx0XHRcdFx0aWYgKCBjID09IG51bGwgKSByZXR1cm47XHJcblx0XHRcdFx0XHRub2RlLmFwcGVuZENoaWxkKCAodHlwZW9mIGMgPT09ICdzdHJpbmcnKSA/IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCBjICkgOiBjICk7XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBub2RlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQnVpbGQgYSB0b2dnbGUgY29udHJvbCByb3cgKGNoZWNrYm94IHJlbmRlcmVkIGFzIHRvZ2dsZSkuXHJcblx0XHQgKlxyXG5cdFx0ICogU3RydWN0dXJlOlxyXG5cdFx0ICogPGRpdiBjbGFzcz1cImluc3BlY3Rvcl9fcm93IGluc3BlY3Rvcl9fcm93LS10b2dnbGVcIj5cclxuXHRcdCAqICAgPGRpdiBjbGFzcz1cImluc3BlY3Rvcl9fY29udHJvbCB3cGJjX3VpX190b2dnbGVcIj5cclxuXHRcdCAqICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJJRFwiIGRhdGEtaW5zcGVjdG9yLWtleT1cIktFWVwiIGNsYXNzPVwiaW5zcGVjdG9yX19pbnB1dFwiIGNoZWNrZWQ+XHJcblx0XHQgKiAgICAgPGxhYmVsIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlX2ljb25cIiAgZm9yPVwiSURcIj48L2xhYmVsPlxyXG5cdFx0ICogICAgIDxsYWJlbCBjbGFzcz1cIndwYmNfdWlfX3RvZ2dsZV9sYWJlbFwiIGZvcj1cIklEXCI+TGFiZWwgdGV4dDwvbGFiZWw+XHJcblx0XHQgKiAgIDwvZGl2PlxyXG5cdFx0ICogPC9kaXY+XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGlucHV0X2lkXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5XHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGNoZWNrZWRcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbF90ZXh0XHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGJ1aWxkX3RvZ2dsZV9yb3coIGlucHV0X2lkLCBrZXksIGNoZWNrZWQsIGxhYmVsX3RleHQgKSB7XHJcblxyXG5cdFx0XHR2YXIgcm93X2VsICAgID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX3JvdyBpbnNwZWN0b3JfX3Jvdy0tdG9nZ2xlJyB9ICk7XHJcblx0XHRcdHZhciBjdHJsX3dyYXAgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ2luc3BlY3Rvcl9fY29udHJvbCB3cGJjX3VpX190b2dnbGUnIH0gKTtcclxuXHJcblx0XHRcdHZhciBpbnB1dF9lbCA9IGVsKCAnaW5wdXQnLCB7XHJcblx0XHRcdFx0aWQgICAgICAgICAgICAgICAgICA6IGlucHV0X2lkLFxyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgICAgICAgOiAnY2hlY2tib3gnLFxyXG5cdFx0XHRcdCdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksXHJcblx0XHRcdFx0J2NsYXNzJyAgICAgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0JyxcclxuXHRcdFx0XHRjaGVja2VkICAgICAgICAgICAgIDogISFjaGVja2VkLFxyXG5cdFx0XHRcdHJvbGUgICAgICAgICAgICAgICAgOiAnc3dpdGNoJyxcclxuXHRcdFx0XHQnYXJpYS1jaGVja2VkJyAgICAgIDogISFjaGVja2VkXHJcblx0XHRcdH0gKTtcclxuXHRcdFx0dmFyIGljb25fbGJsID0gZWwoICdsYWJlbCcsIHsgJ2NsYXNzJzogJ3dwYmNfdWlfX3RvZ2dsZV9pY29uJywgJ2Zvcic6IGlucHV0X2lkIH0gKTtcclxuXHRcdFx0dmFyIHRleHRfbGJsID0gZWwoICdsYWJlbCcsIHsgJ2NsYXNzJzogJ3dwYmNfdWlfX3RvZ2dsZV9sYWJlbCcsICdmb3InOiBpbnB1dF9pZCB9LCBsYWJlbF90ZXh0IHx8ICcnICk7XHJcblxyXG5cdFx0XHRjdHJsX3dyYXAuYXBwZW5kQ2hpbGQoIGlucHV0X2VsICk7XHJcblx0XHRcdGN0cmxfd3JhcC5hcHBlbmRDaGlsZCggaWNvbl9sYmwgKTtcclxuXHRcdFx0Y3RybF93cmFwLmFwcGVuZENoaWxkKCB0ZXh0X2xibCApO1xyXG5cclxuXHRcdFx0cm93X2VsLmFwcGVuZENoaWxkKCBjdHJsX3dyYXAgKTtcclxuXHRcdFx0cmV0dXJuIHJvd19lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHQgKiBVdGlsaXR5OiBjaG9vc2UgaW5pdGlhbCB2YWx1ZSBmcm9tIGRhdGEgb3Igc2NoZW1hIGRlZmF1bHQuXHJcblx0ICovXHJcblx0XHRmdW5jdGlvbiBnZXRfaW5pdGlhbF92YWx1ZShrZXksIGRhdGEsIHByb3BzX3NjaGVtYSkge1xyXG5cdFx0XHRpZiAoIGRhdGEgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkYXRhLCBrZXkgKSApIHJldHVybiBkYXRhW2tleV07XHJcblx0XHRcdHZhciBtZXRhID0gcHJvcHNfc2NoZW1hICYmIHByb3BzX3NjaGVtYVtrZXldO1xyXG5cdFx0XHRyZXR1cm4gKG1ldGEgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBtZXRhLCAnZGVmYXVsdCcgKSkgPyBtZXRhLmRlZmF1bHQgOiAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHQgKiBVdGlsaXR5OiBjb2VyY2UgdmFsdWUgYnkgc2NoZW1hIHR5cGUuXHJcblx0ICovXHJcblxyXG5cclxuXHRcdGZ1bmN0aW9uIGNvZXJjZV9ieV90eXBlKHZhbHVlLCB0eXBlKSB7XHJcblx0XHRcdHN3aXRjaCAoIHR5cGUgKSB7XHJcblx0XHRcdFx0Y2FzZSAnbnVtYmVyJzpcclxuXHRcdFx0XHRjYXNlICdpbnQnOlxyXG5cdFx0XHRcdGNhc2UgJ2Zsb2F0JzpcclxuXHRcdFx0XHRcdGlmICggdmFsdWUgPT09ICcnIHx8IHZhbHVlID09IG51bGwgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiAnJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHZhciBuID0gTnVtYmVyKCB2YWx1ZSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuIGlzTmFOKCBuICkgPyAnJyA6IG47XHJcblx0XHRcdFx0Y2FzZSAnYm9vbGVhbic6XHJcblx0XHRcdFx0XHRyZXR1cm4gISF2YWx1ZTtcclxuXHRcdFx0XHRjYXNlICdhcnJheSc6XHJcblx0XHRcdFx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheSggdmFsdWUgKSA/IHZhbHVlIDogW107XHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRcdHJldHVybiAodmFsdWUgPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggdmFsdWUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdCAqIE5vcm1hbGl6ZSA8c2VsZWN0PiBvcHRpb25zIChhcnJheSBvZiB7dmFsdWUsbGFiZWx9IG9yIG1hcCB7dmFsdWU6bGFiZWx9KS5cclxuXHQgKi9cclxuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zZWxlY3Rfb3B0aW9ucyhvcHRpb25zKSB7XHJcblx0XHRcdGlmICggQXJyYXkuaXNBcnJheSggb3B0aW9ucyApICkge1xyXG5cdFx0XHRcdHJldHVybiBvcHRpb25zLm1hcCggZnVuY3Rpb24gKG8pIHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIG8gJiYgJ3ZhbHVlJyBpbiBvICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogU3RyaW5nKCBvLnZhbHVlICksIGxhYmVsOiBTdHJpbmcoIG8ubGFiZWwgfHwgby52YWx1ZSApIH07XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogU3RyaW5nKCBvICksIGxhYmVsOiBTdHJpbmcoIG8gKSB9O1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRcdHJldHVybiBPYmplY3Qua2V5cyggb3B0aW9ucyApLm1hcCggZnVuY3Rpb24gKGspIHtcclxuXHRcdFx0XHRcdHJldHVybiB7IHZhbHVlOiBTdHJpbmcoIGsgKSwgbGFiZWw6IFN0cmluZyggb3B0aW9uc1trXSApIH07XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBbXTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogUGFyc2UgYSBDU1MgbGVuZ3RoIGxpa2UgXCIxMjBweFwiIG9yIFwiODAlXCIgaW50byB7IHZhbHVlOm51bWJlciwgdW5pdDpzdHJpbmcgfS4gKi9cclxuXHRcdGZ1bmN0aW9uIHBhcnNlX2xlbih2YWx1ZSwgZmFsbGJhY2tfdW5pdCkge1xyXG5cdFx0XHR2YWx1ZSA9ICh2YWx1ZSA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCB2YWx1ZSApLnRyaW0oKTtcclxuXHRcdFx0dmFyIG0gPSB2YWx1ZS5tYXRjaCggL14oLT9cXGQrKD86XFwuXFxkKyk/KShweHwlfHJlbXxlbSkkL2kgKTtcclxuXHRcdFx0aWYgKCBtICkge1xyXG5cdFx0XHRcdHJldHVybiB7IHZhbHVlOiBwYXJzZUZsb2F0KCBtWzFdICksIHVuaXQ6IG1bMl0udG9Mb3dlckNhc2UoKSB9O1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIHBsYWluIG51bWJlciAtPiBhc3N1bWUgZmFsbGJhY2sgdW5pdFxyXG5cdFx0XHRpZiAoIHZhbHVlICE9PSAnJyAmJiAhaXNOYU4oIE51bWJlciggdmFsdWUgKSApICkge1xyXG5cdFx0XHRcdHJldHVybiB7IHZhbHVlOiBOdW1iZXIoIHZhbHVlICksIHVuaXQ6IChmYWxsYmFja191bml0IHx8ICdweCcpIH07XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHsgdmFsdWU6IDAsIHVuaXQ6IChmYWxsYmFja191bml0IHx8ICdweCcpIH07XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqIENsYW1wIGhlbHBlci4gKi9cclxuXHRcdGZ1bmN0aW9uIGNsYW1wX251bSh2LCBtaW4sIG1heCkge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB2ICE9PSAnbnVtYmVyJyB8fCBpc05hTiggdiApICkgcmV0dXJuIChtaW4gIT0gbnVsbCA/IG1pbiA6IDApO1xyXG5cdFx0XHRpZiAoIG1pbiAhPSBudWxsICYmIHYgPCBtaW4gKSB2ID0gbWluO1xyXG5cdFx0XHRpZiAoIG1heCAhPSBudWxsICYmIHYgPiBtYXggKSB2ID0gbWF4O1xyXG5cdFx0XHRyZXR1cm4gdjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBJbml0aWFsaXplIENvbG9yaXMgcGlja2VycyBpbiBhIGdpdmVuIHJvb3QuXHJcblx0XHQvLyBSZWxpZXMgb24gQ29sb3JpcyBiZWluZyBlbnF1ZXVlZCAoc2VlIGJmYi1ib290c3RyYXAucGhwKS5cclxuXHRcdGZ1bmN0aW9uIGluaXRfY29sb3Jpc19waWNrZXJzKHJvb3QpIHtcclxuXHRcdFx0aWYgKCAhcm9vdCB8fCAhdy5Db2xvcmlzICkgcmV0dXJuO1xyXG5cdFx0XHQvLyBNYXJrIGlucHV0cyB3ZSB3YW50IENvbG9yaXMgdG8gaGFuZGxlLlxyXG5cdFx0XHR2YXIgaW5wdXRzID0gcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnaW5wdXRbZGF0YS1pbnNwZWN0b3ItdHlwZT1cImNvbG9yXCJdJyApO1xyXG5cdFx0XHRpZiAoICFpbnB1dHMubGVuZ3RoICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gQWRkIGEgc3RhYmxlIGNsYXNzIGZvciBDb2xvcmlzIHRhcmdldGluZzsgYXZvaWQgZG91YmxlLWluaXRpYWxpemluZy5cclxuXHRcdFx0aW5wdXRzLmZvckVhY2goIGZ1bmN0aW9uIChpbnB1dCkge1xyXG5cdFx0XHRcdGlmICggaW5wdXQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfY29sb3JpcycgKSApIHJldHVybjtcclxuXHRcdFx0XHRpbnB1dC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfY29sb3JpcycgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQ3JlYXRlL3JlZnJlc2ggYSBDb2xvcmlzIGluc3RhbmNlIGJvdW5kIHRvIHRoZXNlIGlucHV0cy5cclxuXHRcdFx0Ly8gS2VlcCBIRVggb3V0cHV0IHRvIG1hdGNoIHNjaGVtYSBkZWZhdWx0cyAoZS5nLiwgXCIjZTBlMGUwXCIpLlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHcuQ29sb3Jpcygge1xyXG5cdFx0XHRcdFx0ZWwgICAgICAgOiAnLndwYmNfYmZiX2NvbG9yaXMnLFxyXG5cdFx0XHRcdFx0YWxwaGEgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRcdGZvcm1hdCAgIDogJ2hleCcsXHJcblx0XHRcdFx0XHR0aGVtZU1vZGU6ICdhdXRvJ1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHQvLyBDb2xvcmlzIGFscmVhZHkgZGlzcGF0Y2hlcyAnaW5wdXQnIGV2ZW50cyBvbiB2YWx1ZSBjaGFuZ2VzLlxyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHQvLyBOb24tZmF0YWw6IGlmIENvbG9yaXMgdGhyb3dzIChyYXJlKSwgdGhlIHRleHQgaW5wdXQgc3RpbGwgd29ya3MuXHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnV1BCQyBJbnNwZWN0b3I6IENvbG9yaXMgaW5pdCBmYWlsZWQ6JywgZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZDogc2xpZGVyICsgbnVtYmVyIGluIG9uZSByb3cgKHdyaXRlcyB0byBhIHNpbmdsZSBkYXRhIGtleSkuXHJcblx0XHQgKiBDb250cm9sIG1ldGE6IHsgdHlwZToncmFuZ2VfbnVtYmVyJywga2V5LCBsYWJlbCwgbWluLCBtYXgsIHN0ZXAgfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBidWlsZF9yYW5nZV9udW1iZXJfcm93KGlucHV0X2lkLCBrZXksIGxhYmVsX3RleHQsIHZhbHVlLCBtZXRhKSB7XHJcblx0XHRcdHZhciByb3dfZWwgICA9IGVsKCdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX3JvdycgfSk7XHJcblx0XHRcdHZhciBsYWJlbF9lbCA9IGVsKCdsYWJlbCcsIHsgJ2Zvcic6IGlucHV0X2lkLCAnY2xhc3MnOiAnaW5zcGVjdG9yX19sYWJlbCcgfSwgbGFiZWxfdGV4dCB8fCBrZXkgfHwgJycpO1xyXG5cdFx0XHR2YXIgY3RybCAgICAgPSBlbCgnZGl2JywgeyAnY2xhc3MnOiAnaW5zcGVjdG9yX19jb250cm9sJyB9KTtcclxuXHJcblx0XHRcdHZhciBtaW4gID0gKG1ldGEgJiYgbWV0YS5taW4gIT0gbnVsbCkgID8gbWV0YS5taW4gIDogMDtcclxuXHRcdFx0dmFyIG1heCAgPSAobWV0YSAmJiBtZXRhLm1heCAhPSBudWxsKSAgPyBtZXRhLm1heCAgOiAxMDA7XHJcblx0XHRcdHZhciBzdGVwID0gKG1ldGEgJiYgbWV0YS5zdGVwICE9IG51bGwpID8gbWV0YS5zdGVwIDogMTtcclxuXHJcblx0XHRcdHZhciBncm91cCA9IGVsKCdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2xlbl9ncm91cCB3cGJjX2lubGluZV9pbnB1dHMnLCAnZGF0YS1sZW4tZ3JvdXAnOiBrZXkgfSk7XHJcblxyXG5cdFx0XHR2YXIgcmFuZ2UgPSBlbCgnaW5wdXQnLCB7XHJcblx0XHRcdFx0dHlwZSA6ICdyYW5nZScsXHJcblx0XHRcdFx0J2NsYXNzJzogJ2luc3BlY3Rvcl9faW5wdXQnLFxyXG5cdFx0XHRcdCdkYXRhLWxlbi1yYW5nZSc6ICcnLFxyXG5cdFx0XHRcdG1pbiAgOiBTdHJpbmcobWluKSxcclxuXHRcdFx0XHRtYXggIDogU3RyaW5nKG1heCksXHJcblx0XHRcdFx0c3RlcCA6IFN0cmluZyhzdGVwKSxcclxuXHRcdFx0XHR2YWx1ZTogU3RyaW5nKHZhbHVlID09IG51bGwgfHwgdmFsdWUgPT09ICcnID8gbWluIDogdmFsdWUpXHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0dmFyIG51bSA9IGVsKCdpbnB1dCcsIHtcclxuXHRcdFx0XHRpZCAgIDogaW5wdXRfaWQsXHJcblx0XHRcdFx0dHlwZSA6ICdudW1iZXInLFxyXG5cdFx0XHRcdCdjbGFzcyc6ICdpbnNwZWN0b3JfX2lucHV0IGluc3BlY3Rvcl9fd18zMCcsXHJcblx0XHRcdFx0J2RhdGEtbGVuLXZhbHVlJzogJycsXHJcblx0XHRcdFx0J2RhdGEtaW5zcGVjdG9yLWtleSc6IGtleSxcclxuXHRcdFx0XHRtaW4gIDogU3RyaW5nKG1pbiksXHJcblx0XHRcdFx0bWF4ICA6IFN0cmluZyhtYXgpLFxyXG5cdFx0XHRcdHN0ZXAgOiBTdHJpbmcoc3RlcCksXHJcblx0XHRcdFx0dmFsdWU6ICh2YWx1ZSA9PSBudWxsIHx8IHZhbHVlID09PSAnJykgPyBTdHJpbmcobWluKSA6IFN0cmluZyh2YWx1ZSlcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRncm91cC5hcHBlbmRDaGlsZChyYW5nZSk7XHJcblx0XHRcdGdyb3VwLmFwcGVuZENoaWxkKG51bSk7XHJcblx0XHRcdGN0cmwuYXBwZW5kQ2hpbGQoZ3JvdXApO1xyXG5cdFx0XHRyb3dfZWwuYXBwZW5kQ2hpbGQobGFiZWxfZWwpO1xyXG5cdFx0XHRyb3dfZWwuYXBwZW5kQ2hpbGQoY3RybCk7XHJcblx0XHRcdHJldHVybiByb3dfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZDogKG51bWJlciArIHVuaXQpICsgc2xpZGVyLCB3cml0aW5nIGEgKnNpbmdsZSogY29tYmluZWQgc3RyaW5nIHRvIGBrZXlgLlxyXG5cdFx0ICogQ29udHJvbCBtZXRhOlxyXG5cdFx0ICoge1xyXG5cdFx0ICogICB0eXBlOidsZW4nLCBrZXksIGxhYmVsLCB1bml0czpbJ3B4JywnJScsJ3JlbScsJ2VtJ10sXHJcblx0XHQgKiAgIHNsaWRlcjogeyBweDp7bWluOjAsbWF4OjUxMixzdGVwOjF9LCAnJSc6e21pbjowLG1heDoxMDAsc3RlcDoxfSwgcmVtOnttaW46MCxtYXg6MTAsc3RlcDowLjF9LCBlbTp7Li4ufSB9LFxyXG5cdFx0ICogICBmYWxsYmFja191bml0OidweCdcclxuXHRcdCAqIH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gYnVpbGRfbGVuX2NvbXBvdW5kX3Jvdyhjb250cm9sLCBwcm9wc19zY2hlbWEsIGRhdGEsIHVpZCkge1xyXG5cdFx0XHR2YXIga2V5ICAgICAgICA9IGNvbnRyb2wua2V5O1xyXG5cdFx0XHR2YXIgbGFiZWxfdGV4dCA9IGNvbnRyb2wubGFiZWwgfHwga2V5IHx8ICcnO1xyXG5cdFx0XHR2YXIgZGVmX3N0ciAgICA9IGdldF9pbml0aWFsX3ZhbHVlKCBrZXksIGRhdGEsIHByb3BzX3NjaGVtYSApO1xyXG5cdFx0XHR2YXIgZmFsbGJhY2tfdSA9IGNvbnRyb2wuZmFsbGJhY2tfdW5pdCB8fCAncHgnO1xyXG5cdFx0XHR2YXIgcGFyc2VkICAgICA9IHBhcnNlX2xlbiggZGVmX3N0ciwgZmFsbGJhY2tfdSApO1xyXG5cclxuXHRcdFx0dmFyIHJvdyAgID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX3JvdycgfSApO1xyXG5cdFx0XHR2YXIgbGFiZWwgPSBlbCggJ2xhYmVsJywgeyAnY2xhc3MnOiAnaW5zcGVjdG9yX19sYWJlbCcgfSwgbGFiZWxfdGV4dCApO1xyXG5cdFx0XHR2YXIgY3RybCAgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ2luc3BlY3Rvcl9fY29udHJvbCcgfSApO1xyXG5cclxuXHRcdFx0dmFyIHVuaXRzICAgICAgPSBBcnJheS5pc0FycmF5KCBjb250cm9sLnVuaXRzICkgJiYgY29udHJvbC51bml0cy5sZW5ndGggPyBjb250cm9sLnVuaXRzIDogWyAncHgnLCAnJScsICdyZW0nLCAnZW0nIF07XHJcblx0XHRcdHZhciBzbGlkZXJfbWFwID0gY29udHJvbC5zbGlkZXIgfHwge1xyXG5cdFx0XHRcdCdweCcgOiB7IG1pbjogMCwgbWF4OiA1MTIsIHN0ZXA6IDEgfSxcclxuXHRcdFx0XHQnJScgIDogeyBtaW46IDAsIG1heDogMTAwLCBzdGVwOiAxIH0sXHJcblx0XHRcdFx0J3JlbSc6IHsgbWluOiAwLCBtYXg6IDEwLCBzdGVwOiAwLjEgfSxcclxuXHRcdFx0XHQnZW0nIDogeyBtaW46IDAsIG1heDogMTAsIHN0ZXA6IDAuMSB9XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvLyBIb3N0IHdpdGggYSBoaWRkZW4gaW5wdXQgdGhhdCBjYXJyaWVzIGRhdGEtaW5zcGVjdG9yLWtleSB0byByZXVzZSB0aGUgc3RhbmRhcmQgaGFuZGxlci5cclxuXHRcdFx0dmFyIGdyb3VwID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2xlbl9ncm91cCcsICdkYXRhLWxlbi1ncm91cCc6IGtleSB9ICk7XHJcblxyXG5cdFx0XHR2YXIgaW5saW5lID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2lubGluZV9pbnB1dHMnIH0gKTtcclxuXHJcblx0XHRcdHZhciBudW0gPSBlbCggJ2lucHV0Jywge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgICA6ICdudW1iZXInLFxyXG5cdFx0XHRcdCdjbGFzcycgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0JyxcclxuXHRcdFx0XHQnZGF0YS1sZW4tdmFsdWUnOiAnJyxcclxuXHRcdFx0XHRtaW4gICAgICAgICAgICAgOiAnMCcsXHJcblx0XHRcdFx0c3RlcCAgICAgICAgICAgIDogJ2FueScsXHJcblx0XHRcdFx0dmFsdWUgICAgICAgICAgIDogU3RyaW5nKCBwYXJzZWQudmFsdWUgKVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHR2YXIgc2VsID0gZWwoICdzZWxlY3QnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX2lucHV0JywgJ2RhdGEtbGVuLXVuaXQnOiAnJyB9ICk7XHJcblx0XHRcdHVuaXRzLmZvckVhY2goIGZ1bmN0aW9uICh1KSB7XHJcblx0XHRcdFx0dmFyIG9wdCA9IGVsKCAnb3B0aW9uJywgeyB2YWx1ZTogdSB9LCB1ICk7XHJcblx0XHRcdFx0aWYgKCB1ID09PSBwYXJzZWQudW5pdCApIG9wdC5zZXRBdHRyaWJ1dGUoICdzZWxlY3RlZCcsICdzZWxlY3RlZCcgKTtcclxuXHRcdFx0XHRzZWwuYXBwZW5kQ2hpbGQoIG9wdCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRpbmxpbmUuYXBwZW5kQ2hpbGQoIG51bSApO1xyXG5cdFx0XHRpbmxpbmUuYXBwZW5kQ2hpbGQoIHNlbCApO1xyXG5cclxuXHRcdFx0Ly8gU2xpZGVyICh1bml0LWF3YXJlKVxyXG5cdFx0XHR2YXIgY3VycmVudCA9IHNsaWRlcl9tYXBbcGFyc2VkLnVuaXRdIHx8IHNsaWRlcl9tYXBbdW5pdHNbMF1dO1xyXG5cdFx0XHR2YXIgcmFuZ2UgICA9IGVsKCAnaW5wdXQnLCB7XHJcblx0XHRcdFx0dHlwZSAgICAgICAgICAgIDogJ3JhbmdlJyxcclxuXHRcdFx0XHQnY2xhc3MnICAgICAgICAgOiAnaW5zcGVjdG9yX19pbnB1dCcsXHJcblx0XHRcdFx0J2RhdGEtbGVuLXJhbmdlJzogJycsXHJcblx0XHRcdFx0bWluICAgICAgICAgICAgIDogU3RyaW5nKCBjdXJyZW50Lm1pbiApLFxyXG5cdFx0XHRcdG1heCAgICAgICAgICAgICA6IFN0cmluZyggY3VycmVudC5tYXggKSxcclxuXHRcdFx0XHRzdGVwICAgICAgICAgICAgOiBTdHJpbmcoIGN1cnJlbnQuc3RlcCApLFxyXG5cdFx0XHRcdHZhbHVlICAgICAgICAgICA6IFN0cmluZyggY2xhbXBfbnVtKCBwYXJzZWQudmFsdWUsIGN1cnJlbnQubWluLCBjdXJyZW50Lm1heCApIClcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gSGlkZGVuIHdyaXRlciBpbnB1dCB0aGF0IHRoZSBkZWZhdWx0IEluc3BlY3RvciBoYW5kbGVyIHdpbGwgY2F0Y2guXHJcblx0XHRcdHZhciBoaWRkZW4gPSBlbCggJ2lucHV0Jywge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgICAgICAgOiAndGV4dCcsXHJcblx0XHRcdFx0J2NsYXNzJyAgICAgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0JyxcclxuXHRcdFx0XHRzdHlsZSAgICAgICAgICAgICAgIDogJ2Rpc3BsYXk6bm9uZScsXHJcblx0XHRcdFx0J2FyaWEtaGlkZGVuJyAgICAgICA6ICd0cnVlJyxcclxuXHRcdFx0XHR0YWJpbmRleCAgICAgICAgICAgIDogJy0xJyxcclxuXHRcdFx0XHRpZCAgICAgICAgICAgICAgICAgIDogJ3dwYmNfaW5zXycgKyBrZXkgKyAnXycgKyB1aWQgKyAnX2xlbl9oaWRkZW4nLFxyXG5cdFx0XHRcdCdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksXHJcblx0XHRcdFx0dmFsdWUgICAgICAgICAgICAgICA6IChTdHJpbmcoIHBhcnNlZC52YWx1ZSApICsgcGFyc2VkLnVuaXQpXHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGdyb3VwLmFwcGVuZENoaWxkKCBpbmxpbmUgKTtcclxuXHRcdFx0Z3JvdXAuYXBwZW5kQ2hpbGQoIHJhbmdlICk7XHJcblx0XHRcdGdyb3VwLmFwcGVuZENoaWxkKCBoaWRkZW4gKTtcclxuXHJcblx0XHRcdGN0cmwuYXBwZW5kQ2hpbGQoIGdyb3VwICk7XHJcblx0XHRcdHJvdy5hcHBlbmRDaGlsZCggbGFiZWwgKTtcclxuXHRcdFx0cm93LmFwcGVuZENoaWxkKCBjdHJsICk7XHJcblx0XHRcdHJldHVybiByb3c7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBXaXJlIHN5bmNpbmcgZm9yIGFueSAud3BiY19sZW5fZ3JvdXAgaW5zaWRlIGEgZ2l2ZW4gcm9vdCAocGFuZWwpLlxyXG5cdFx0ICogLSByYW5nZSDih4QgbnVtYmVyIHN5bmNcclxuXHRcdCAqIC0gdW5pdCBzd2l0Y2hlcyB1cGRhdGUgc2xpZGVyIGJvdW5kc1xyXG5cdFx0ICogLSBoaWRkZW4gd3JpdGVyIChpZiBwcmVzZW50KSBnZXRzIHVwZGF0ZWQgYW5kIGVtaXRzICdpbnB1dCdcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd2lyZV9sZW5fZ3JvdXAocm9vdCkge1xyXG5cdFx0XHRpZiAoICFyb290ICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0ZnVuY3Rpb24gZmluZF9ncm91cChlbCkge1xyXG5cdFx0XHRcdHJldHVybiBlbCAmJiBlbC5jbG9zZXN0ICYmIGVsLmNsb3Nlc3QoICcud3BiY19sZW5fZ3JvdXAnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0XHR2YXIgdCA9IGUudGFyZ2V0O1xyXG5cdFx0XHRcdC8vIFNsaWRlciBtb3ZlZCAtPiB1cGRhdGUgbnVtYmVyIChhbmQgd3JpdGVyL2hpZGRlbilcclxuXHRcdFx0XHRpZiAoIHQgJiYgdC5oYXNBdHRyaWJ1dGUoICdkYXRhLWxlbi1yYW5nZScgKSApIHtcclxuXHRcdFx0XHRcdHZhciBnID0gZmluZF9ncm91cCggdCApO1xyXG5cdFx0XHRcdFx0aWYgKCAhZyApIHJldHVybjtcclxuXHRcdFx0XHRcdHZhciBudW0gPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tdmFsdWVdJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBudW0gKSB7XHJcblx0XHRcdFx0XHRcdG51bS52YWx1ZSA9IHQudmFsdWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR2YXIgd3JpdGVyID0gZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtaW5zcGVjdG9yLWtleV0nICk7XHJcblx0XHRcdFx0XHRpZiAoIHdyaXRlciAmJiB3cml0ZXIudHlwZSA9PT0gJ3RleHQnICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgdW5pdCAgICAgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tdW5pdF0nICk7XHJcblx0XHRcdFx0XHRcdHVuaXQgICAgICAgICA9IHVuaXQgPyB1bml0LnZhbHVlIDogJ3B4JztcclxuXHRcdFx0XHRcdFx0d3JpdGVyLnZhbHVlID0gU3RyaW5nKCB0LnZhbHVlICkgKyBTdHJpbmcoIHVuaXQgKTtcclxuXHRcdFx0XHRcdFx0Ly8gdHJpZ2dlciBzdGFuZGFyZCBpbnNwZWN0b3IgaGFuZGxlcjpcclxuXHRcdFx0XHRcdFx0d3JpdGVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Ly8gUGxhaW4gcmFuZ2VfbnVtYmVyIGNhc2UgKG51bWJlciBoYXMgZGF0YS1pbnNwZWN0b3Ita2V5KSAtPiBmaXJlIGlucHV0IG9uIG51bWJlclxyXG5cdFx0XHRcdFx0XHRpZiAoIG51bSAmJiBudW0uaGFzQXR0cmlidXRlKCAnZGF0YS1pbnNwZWN0b3Ita2V5JyApICkge1xyXG5cdFx0XHRcdFx0XHRcdG51bS5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gTnVtYmVyIHR5cGVkIC0+IHVwZGF0ZSBzbGlkZXIgYW5kIHdyaXRlci9oaWRkZW5cclxuXHRcdFx0XHRpZiAoIHQgJiYgdC5oYXNBdHRyaWJ1dGUoICdkYXRhLWxlbi12YWx1ZScgKSApIHtcclxuXHRcdFx0XHRcdHZhciBnID0gZmluZF9ncm91cCggdCApO1xyXG5cdFx0XHRcdFx0aWYgKCAhZyApIHJldHVybjtcclxuXHRcdFx0XHRcdHZhciByID0gZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtbGVuLXJhbmdlXScgKTtcclxuXHRcdFx0XHRcdGlmICggciApIHtcclxuXHRcdFx0XHRcdFx0Ly8gY2xhbXAgd2l0aGluIHNsaWRlciBib3VuZHMgaWYgcHJlc2VudFxyXG5cdFx0XHRcdFx0XHR2YXIgbWluID0gTnVtYmVyKCByLm1pbiApO1xyXG5cdFx0XHRcdFx0XHR2YXIgbWF4ID0gTnVtYmVyKCByLm1heCApO1xyXG5cdFx0XHRcdFx0XHR2YXIgdiAgID0gTnVtYmVyKCB0LnZhbHVlICk7XHJcblx0XHRcdFx0XHRcdGlmICggIWlzTmFOKCB2ICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0diAgICAgICA9IGNsYW1wX251bSggdiwgaXNOYU4oIG1pbiApID8gdW5kZWZpbmVkIDogbWluLCBpc05hTiggbWF4ICkgPyB1bmRlZmluZWQgOiBtYXggKTtcclxuXHRcdFx0XHRcdFx0XHRyLnZhbHVlID0gU3RyaW5nKCB2ICk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBTdHJpbmcoIHYgKSAhPT0gdC52YWx1ZSApIHQudmFsdWUgPSBTdHJpbmcoIHYgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dmFyIHdyaXRlciA9IGcucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXldJyApO1xyXG5cdFx0XHRcdFx0aWYgKCB3cml0ZXIgJiYgd3JpdGVyLnR5cGUgPT09ICd0ZXh0JyApIHtcclxuXHRcdFx0XHRcdFx0dmFyIHVuaXQgICAgID0gZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtbGVuLXVuaXRdJyApO1xyXG5cdFx0XHRcdFx0XHR1bml0ICAgICAgICAgPSB1bml0ID8gdW5pdC52YWx1ZSA6ICdweCc7XHJcblx0XHRcdFx0XHRcdHdyaXRlci52YWx1ZSA9IFN0cmluZyggdC52YWx1ZSB8fCAwICkgKyBTdHJpbmcoIHVuaXQgKTtcclxuXHRcdFx0XHRcdFx0d3JpdGVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly8gZWxzZTogbnVtYmVyIGl0c2VsZiBsaWtlbHkgY2FycmllcyBkYXRhLWluc3BlY3Rvci1rZXkgKHJhbmdlX251bWJlcik7IGRlZmF1bHQgaGFuZGxlciB3aWxsIHJ1bi5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHJcblx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdFx0dmFyIHQgPSBlLnRhcmdldDtcclxuXHRcdFx0XHQvLyBVbml0IGNoYW5nZWQgLT4gdXBkYXRlIHNsaWRlciBsaW1pdHMgYW5kIHdyaXRlci9oaWRkZW5cclxuXHRcdFx0XHRpZiAoIHQgJiYgdC5oYXNBdHRyaWJ1dGUoICdkYXRhLWxlbi11bml0JyApICkge1xyXG5cdFx0XHRcdFx0dmFyIGcgPSBmaW5kX2dyb3VwKCB0ICk7XHJcblx0XHRcdFx0XHRpZiAoICFnICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0XHRcdC8vIEZpbmQgdGhlIGNvbnRyb2wgbWV0YSB2aWEgYSBkYXRhIGF0dHJpYnV0ZSBvbiBncm91cCBpZiBwcm92aWRlZFxyXG5cdFx0XHRcdFx0Ly8gKEZhY3RvcnkgcGF0aCBzZXRzIG5vdGhpbmcgaGVyZTsgd2UgcmUtZGVyaXZlIGZyb20gY3VycmVudCBzbGlkZXIgYm91bmRzLilcclxuXHRcdFx0XHRcdHZhciByICAgICAgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tcmFuZ2VdJyApO1xyXG5cdFx0XHRcdFx0dmFyIG51bSAgICA9IGcucXVlcnlTZWxlY3RvciggJ1tkYXRhLWxlbi12YWx1ZV0nICk7XHJcblx0XHRcdFx0XHR2YXIgd3JpdGVyID0gZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtaW5zcGVjdG9yLWtleV0nICk7XHJcblx0XHRcdFx0XHR2YXIgdW5pdCAgID0gdC52YWx1ZSB8fCAncHgnO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFkanVzdCBzbGlkZXIgYm91bmRzIGhldXJpc3RpY2FsbHkgKG1hdGNoIEZhY3RvcnkgZGVmYXVsdHMpXHJcblx0XHRcdFx0XHR2YXIgYm91bmRzX2J5X3VuaXQgPSB7XHJcblx0XHRcdFx0XHRcdCdweCcgOiB7IG1pbjogMCwgbWF4OiA1MTIsIHN0ZXA6IDEgfSxcclxuXHRcdFx0XHRcdFx0JyUnICA6IHsgbWluOiAwLCBtYXg6IDEwMCwgc3RlcDogMSB9LFxyXG5cdFx0XHRcdFx0XHQncmVtJzogeyBtaW46IDAsIG1heDogMTAsIHN0ZXA6IDAuMSB9LFxyXG5cdFx0XHRcdFx0XHQnZW0nIDogeyBtaW46IDAsIG1heDogMTAsIHN0ZXA6IDAuMSB9XHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0aWYgKCByICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgYiAgPSBib3VuZHNfYnlfdW5pdFt1bml0XSB8fCBib3VuZHNfYnlfdW5pdFsncHgnXTtcclxuXHRcdFx0XHRcdFx0ci5taW4gID0gU3RyaW5nKCBiLm1pbiApO1xyXG5cdFx0XHRcdFx0XHRyLm1heCAgPSBTdHJpbmcoIGIubWF4ICk7XHJcblx0XHRcdFx0XHRcdHIuc3RlcCA9IFN0cmluZyggYi5zdGVwICk7XHJcblx0XHRcdFx0XHRcdC8vIGNsYW1wIHRvIG5ldyBib3VuZHNcclxuXHRcdFx0XHRcdFx0dmFyIHYgID0gTnVtYmVyKCBudW0gJiYgbnVtLnZhbHVlID8gbnVtLnZhbHVlIDogci52YWx1ZSApO1xyXG5cdFx0XHRcdFx0XHRpZiAoICFpc05hTiggdiApICkge1xyXG5cdFx0XHRcdFx0XHRcdHYgICAgICAgPSBjbGFtcF9udW0oIHYsIGIubWluLCBiLm1heCApO1xyXG5cdFx0XHRcdFx0XHRcdHIudmFsdWUgPSBTdHJpbmcoIHYgKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIG51bSApIG51bS52YWx1ZSA9IFN0cmluZyggdiApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHdyaXRlciAmJiB3cml0ZXIudHlwZSA9PT0gJ3RleHQnICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgdiAgICAgICAgPSBudW0gJiYgbnVtLnZhbHVlID8gbnVtLnZhbHVlIDogKHIgPyByLnZhbHVlIDogJzAnKTtcclxuXHRcdFx0XHRcdFx0d3JpdGVyLnZhbHVlID0gU3RyaW5nKCB2ICkgKyBTdHJpbmcoIHVuaXQgKTtcclxuXHRcdFx0XHRcdFx0d3JpdGVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRcdC8vID09ICBDIE8gTiBUIFIgTyBMICA9PVxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHRcdC8qKlxyXG5cdCAqIFNjaGVtYSA+IEluc3BlY3RvciA+IENvbnRyb2wgRWxlbWVudCwgZS5nLiBJbnB1dCEgIEJ1aWxkIGEgc2luZ2xlIGNvbnRyb2wgcm93OlxyXG5cdCAqIDxkaXYgY2xhc3M9XCJpbnNwZWN0b3JfX3Jvd1wiPlxyXG5cdCAqICAgPGxhYmVsIGNsYXNzPVwiaW5zcGVjdG9yX19sYWJlbFwiIGZvcj1cIi4uLlwiPkxhYmVsPC9sYWJlbD5cclxuXHQgKiAgIDxkaXYgY2xhc3M9XCJpbnNwZWN0b3JfX2NvbnRyb2xcIj48aW5wdXR8dGV4dGFyZWF8c2VsZWN0IGNsYXNzPVwiaW5zcGVjdG9yX19pbnB1dFwiIC4uLj48L2Rpdj5cclxuXHQgKiA8L2Rpdj5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sICAgICAgICAgICAtIHNjaGVtYSBjb250cm9sIG1ldGEgKHt0eXBlLGtleSxsYWJlbCwuLi59KVxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wc19zY2hlbWEgICAgICAtIHNjaGVtYS5wcm9wc1xyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhICAgICAgICAgICAgICAtIGN1cnJlbnQgZWxlbWVudCBkYXRhLSogbWFwXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHVpZCAgICAgICAgICAgICAgIC0gdW5pcXVlIHN1ZmZpeCBmb3IgaW5wdXQgaWRzXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGN0eCAgICAgICAgICAgICAgIC0geyBlbCwgYnVpbGRlciwgdHlwZSwgZGF0YSB9XHJcblx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fVxyXG5cdCAqL1xyXG5cdFx0ZnVuY3Rpb24gYnVpbGRfY29udHJvbChjb250cm9sLCBwcm9wc19zY2hlbWEsIGRhdGEsIHVpZCwgY3R4KSB7XHJcblx0XHRcdHZhciB0eXBlID0gY29udHJvbC50eXBlO1xyXG5cdFx0XHR2YXIga2V5ICA9IGNvbnRyb2wua2V5O1xyXG5cclxuXHRcdFx0dmFyIGxhYmVsX3RleHQgPSBjb250cm9sLmxhYmVsIHx8IGtleSB8fCAnJztcclxuXHRcdFx0dmFyIHByb3BfbWV0YSAgPSAoa2V5ID8gKHByb3BzX3NjaGVtYVtrZXldIHx8IHsgdHlwZTogJ3N0cmluZycgfSkgOiB7IHR5cGU6ICdzdHJpbmcnIH0pO1xyXG5cdFx0XHR2YXIgdmFsdWUgICAgICA9IGNvZXJjZV9ieV90eXBlKCBnZXRfaW5pdGlhbF92YWx1ZSgga2V5LCBkYXRhLCBwcm9wc19zY2hlbWEgKSwgcHJvcF9tZXRhLnR5cGUgKTtcclxuXHRcdC8vIEFsbG93IHZhbHVlX2Zyb20gb3ZlcnJpZGUgKGNvbXB1dGVkIGF0IHJlbmRlci10aW1lKS5cclxuXHRcdGlmICggY29udHJvbCAmJiBjb250cm9sLnZhbHVlX2Zyb20gJiYgdy53cGJjX2JmYl9pbnNwZWN0b3JfZmFjdG9yeV92YWx1ZV9mcm9tW2NvbnRyb2wudmFsdWVfZnJvbV0gKSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHZhciBjb21wdXRlZCA9IHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3RvcnlfdmFsdWVfZnJvbVtjb250cm9sLnZhbHVlX2Zyb21dKCBjdHggfHwge30gKTtcclxuXHRcdFx0XHRcdHZhbHVlICAgICAgICA9IGNvZXJjZV9ieV90eXBlKCBjb21wdXRlZCwgcHJvcF9tZXRhLnR5cGUgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdGNvbnNvbGUud2FybiggJ3ZhbHVlX2Zyb20gZmFpbGVkIGZvcicsIGNvbnRyb2wudmFsdWVfZnJvbSwgZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIGlucHV0X2lkID0gJ3dwYmNfaW5zXycgKyBrZXkgKyAnXycgKyB1aWQ7XHJcblxyXG5cdFx0XHR2YXIgcm93X2VsICAgID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX3JvdycgfSApO1xyXG5cdFx0XHR2YXIgbGFiZWxfZWwgID0gZWwoICdsYWJlbCcsIHsgJ2Zvcic6IGlucHV0X2lkLCAnY2xhc3MnOiAnaW5zcGVjdG9yX19sYWJlbCcgfSwgbGFiZWxfdGV4dCApO1xyXG5cdFx0XHR2YXIgY3RybF93cmFwID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX2NvbnRyb2wnIH0gKTtcclxuXHJcblx0XHRcdHZhciBmaWVsZF9lbDtcclxuXHJcblx0XHQvLyAtLS0gc2xvdCBob3N0IChuYW1lZCBVSSBpbmplY3Rpb24pIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoIHR5cGUgPT09ICdzbG90JyAmJiBjb250cm9sLnNsb3QgKSB7XHJcblx0XHRcdC8vIGFkZCBhIG1hcmtlciBjbGFzcyBmb3IgdGhlIGxheW91dCBjaGlwcyByb3dcclxuXHRcdFx0dmFyIGNsYXNzZXMgPSAnaW5zcGVjdG9yX19yb3cgaW5zcGVjdG9yX19yb3ctLXNsb3QnO1xyXG5cdFx0XHRpZiAoIGNvbnRyb2wuc2xvdCA9PT0gJ2xheW91dF9jaGlwcycgKSBjbGFzc2VzICs9ICcgaW5zcGVjdG9yX19yb3ctLWxheW91dC1jaGlwcyc7XHJcblxyXG5cdFx0XHR2YXIgc2xvdF9yb3cgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogY2xhc3NlcyB9ICk7XHJcblxyXG5cdFx0XHRpZiAoIGxhYmVsX3RleHQgKSBzbG90X3Jvdy5hcHBlbmRDaGlsZCggZWwoICdsYWJlbCcsIHsgJ2NsYXNzJzogJ2luc3BlY3Rvcl9fbGFiZWwnIH0sIGxhYmVsX3RleHQgKSApO1xyXG5cclxuXHRcdFx0Ly8gYWRkIGEgZGF0YSBhdHRyaWJ1dGUgb24gdGhlIGhvc3Qgc28gYm90aCBDU1MgYW5kIHRoZSBzYWZldHktbmV0IGNhbiB0YXJnZXQgaXRcclxuXHRcdFx0dmFyIGhvc3RfYXR0cnMgPSB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX2NvbnRyb2wnIH07XHJcblx0XHRcdGlmICggY29udHJvbC5zbG90ID09PSAnbGF5b3V0X2NoaXBzJyApIGhvc3RfYXR0cnNbJ2RhdGEtYmZiLXNsb3QnXSA9ICdsYXlvdXRfY2hpcHMnO1xyXG5cclxuXHRcdFx0dmFyIHNsb3RfaG9zdCA9IGVsKCAnZGl2JywgaG9zdF9hdHRycyApO1xyXG5cdFx0XHRzbG90X3Jvdy5hcHBlbmRDaGlsZCggc2xvdF9ob3N0ICk7XHJcblxyXG5cdFx0XHR2YXIgc2xvdF9mbiA9IHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHNbY29udHJvbC5zbG90XTtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygc2xvdF9mbiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRzbG90X2ZuKCBzbG90X2hvc3QsIGN0eCB8fCB7fSApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybiggJ3Nsb3QgXCInICsgY29udHJvbC5zbG90ICsgJ1wiIGZhaWxlZDonLCBlICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSwgMCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHNsb3RfaG9zdC5hcHBlbmRDaGlsZCggZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9fc2xvdF9fbWlzc2luZycgfSwgJ1tzbG90OiAnICsgY29udHJvbC5zbG90ICsgJ10nICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gc2xvdF9yb3c7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdFx0aWYgKCB0eXBlID09PSAndGV4dGFyZWEnICkge1xyXG5cdFx0XHRcdGZpZWxkX2VsID0gZWwoICd0ZXh0YXJlYScsIHtcclxuXHRcdFx0XHRcdGlkICAgICAgICAgICAgICAgICAgOiBpbnB1dF9pZCxcclxuXHRcdFx0XHRcdCdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksXHJcblx0XHRcdFx0XHRyb3dzICAgICAgICAgICAgICAgIDogY29udHJvbC5yb3dzIHx8IDMsXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgICAgICAgICAgIDogJ2luc3BlY3Rvcl9faW5wdXQnXHJcblx0XHRcdFx0fSwgKHZhbHVlID09IG51bGwgPyAnJyA6IFN0cmluZyggdmFsdWUgKSkgKTtcclxuXHRcdFx0fSBlbHNlIGlmICggdHlwZSA9PT0gJ3NlbGVjdCcgKSB7XHJcblx0XHRcdFx0ZmllbGRfZWwgPSBlbCggJ3NlbGVjdCcsIHtcclxuXHRcdFx0XHRcdGlkICAgICAgICAgICAgICAgICAgOiBpbnB1dF9pZCxcclxuXHRcdFx0XHRcdCdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgICAgICAgICAgIDogJ2luc3BlY3Rvcl9faW5wdXQnXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdG5vcm1hbGl6ZV9zZWxlY3Rfb3B0aW9ucyggY29udHJvbC5vcHRpb25zIHx8IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKG9wdCkge1xyXG5cdFx0XHRcdFx0dmFyIG9wdF9lbCA9IGVsKCAnb3B0aW9uJywgeyB2YWx1ZTogb3B0LnZhbHVlIH0sIG9wdC5sYWJlbCApO1xyXG5cdFx0XHRcdFx0aWYgKCBTdHJpbmcoIHZhbHVlICkgPT09IG9wdC52YWx1ZSApIG9wdF9lbC5zZXRBdHRyaWJ1dGUoICdzZWxlY3RlZCcsICdzZWxlY3RlZCcgKTtcclxuXHRcdFx0XHRcdGZpZWxkX2VsLmFwcGVuZENoaWxkKCBvcHRfZWwgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIHR5cGUgPT09ICdjaGVja2JveCcgKSB7XHJcblx0XHRcdFx0Ly8gZmllbGRfZWwgPSBlbCggJ2lucHV0JywgeyBpZDogaW5wdXRfaWQsIHR5cGU6ICdjaGVja2JveCcsICdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksIGNoZWNrZWQ6ICEhdmFsdWUsICdjbGFzcyc6ICdpbnNwZWN0b3JfX2lucHV0JyB9ICk7IC8vLlxyXG5cclxuXHRcdFx0XHQvLyBSZW5kZXIgYXMgdG9nZ2xlIFVJIGluc3RlYWQgb2YgbGFiZWwtbGVmdCArIGNoZWNrYm94LiAgTm90ZTogd2UgcmV0dXJuIHRoZSBmdWxsIHRvZ2dsZSByb3cgaGVyZSBhbmQgc2tpcCB0aGUgZGVmYXVsdCByb3cvbGFiZWwgZmxvdyBiZWxvdy5cclxuXHRcdFx0XHRyZXR1cm4gYnVpbGRfdG9nZ2xlX3JvdyggaW5wdXRfaWQsIGtleSwgISF2YWx1ZSwgbGFiZWxfdGV4dCApO1xyXG5cclxuXHRcdFx0fSBlbHNlIGlmICggdHlwZSA9PT0gJ3JhbmdlX251bWJlcicgKSB7XHJcblx0XHRcdFx0Ly8gLS0tIG5ldzogc2xpZGVyICsgbnVtYmVyIChzaW5nbGUga2V5KS5cclxuXHRcdFx0XHR2YXIgcm5faWQgID0gJ3dwYmNfaW5zXycgKyBrZXkgKyAnXycgKyB1aWQ7XHJcblx0XHRcdFx0dmFyIHJuX3ZhbCA9IHZhbHVlOyAvLyBmcm9tIGdldF9pbml0aWFsX3ZhbHVlL3Byb3BfbWV0YSBhbHJlYWR5LlxyXG5cdFx0XHRcdHJldHVybiBidWlsZF9yYW5nZV9udW1iZXJfcm93KCBybl9pZCwga2V5LCBsYWJlbF90ZXh0LCBybl92YWwsIGNvbnRyb2wgKTtcclxuXHJcblx0XHRcdH0gZWxzZSBpZiAoIHR5cGUgPT09ICdsZW4nICkge1xyXG5cdFx0XHRcdC8vIC0tLSBuZXc6IGxlbmd0aCBjb21wb3VuZCAodmFsdWUrdW5pdCtzbGlkZXIgLT4gd3JpdGVzIGEgc2luZ2xlIHN0cmluZyBrZXkpLlxyXG5cdFx0XHRcdHJldHVybiBidWlsZF9sZW5fY29tcG91bmRfcm93KCBjb250cm9sLCBwcm9wc19zY2hlbWEsIGRhdGEsIHVpZCApO1xyXG5cclxuXHRcdFx0fSBlbHNlIGlmICggdHlwZSA9PT0gJ2NvbG9yJyApIHtcclxuXHRcdFx0XHQvLyBDb2xvciBwaWNrZXIgKENvbG9yaXMpLiBTdG9yZSBhcyBzdHJpbmcgKGUuZy4sIFwiI2UwZTBlMFwiKS5cclxuXHRcdFx0XHRmaWVsZF9lbCA9IGVsKCAnaW5wdXQnLCB7XHJcblx0XHRcdFx0XHRpZCAgICAgICAgICAgICAgICAgICA6IGlucHV0X2lkLFxyXG5cdFx0XHRcdFx0dHlwZSAgICAgICAgICAgICAgICAgOiAndGV4dCcsXHJcblx0XHRcdFx0XHQnZGF0YS1pbnNwZWN0b3Ita2V5JyA6IGtleSxcclxuXHRcdFx0XHRcdCdkYXRhLWluc3BlY3Rvci10eXBlJzogJ2NvbG9yJyxcclxuXHRcdFx0XHRcdCdkYXRhLWNvbG9yaXMnICAgICAgIDogJycsXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgICAgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0JyxcclxuXHRcdFx0XHRcdCdkYXRhLWRlZmF1bHQtY29sb3InIDogKCB2YWx1ZSAhPSBudWxsICYmIHZhbHVlICE9PSAnJyA/IFN0cmluZyh2YWx1ZSkgOiAoY29udHJvbC5wbGFjZWhvbGRlciB8fCAnJykgKVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRpZiAoIHZhbHVlICE9PSAnJyApIHtcclxuXHRcdFx0XHRcdGZpZWxkX2VsLnZhbHVlID0gU3RyaW5nKCB2YWx1ZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvLyB0ZXh0L251bWJlciBkZWZhdWx0LlxyXG5cdFx0XHRcdHZhciBhdHRycyA9IHtcclxuXHRcdFx0XHRcdGlkICAgICAgICAgICAgICAgICAgOiBpbnB1dF9pZCxcclxuXHRcdFx0XHRcdHR5cGUgICAgICAgICAgICAgICAgOiAodHlwZSA9PT0gJ251bWJlcicpID8gJ251bWJlcicgOiAndGV4dCcsXHJcblx0XHRcdFx0XHQnZGF0YS1pbnNwZWN0b3Ita2V5Jzoga2V5LFxyXG5cdFx0XHRcdFx0J2NsYXNzJyAgICAgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0J1xyXG5cdFx0XHRcdH07XHJcblx0XHRcdC8vIG51bWJlciBjb25zdHJhaW50cyAoc2NoZW1hIG9yIGNvbnRyb2wpXHJcblx0XHRcdFx0aWYgKCB0eXBlID09PSAnbnVtYmVyJyApIHtcclxuXHRcdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBwcm9wX21ldGEsICdtaW4nICkgKSBhdHRycy5taW4gPSBwcm9wX21ldGEubWluO1xyXG5cdFx0XHRcdFx0aWYgKCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHByb3BfbWV0YSwgJ21heCcgKSApIGF0dHJzLm1heCA9IHByb3BfbWV0YS5tYXg7XHJcblx0XHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcHJvcF9tZXRhLCAnc3RlcCcgKSApIGF0dHJzLnN0ZXAgPSBwcm9wX21ldGEuc3RlcDtcclxuXHRcdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBjb250cm9sLCAnbWluJyApICkgYXR0cnMubWluID0gY29udHJvbC5taW47XHJcblx0XHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggY29udHJvbCwgJ21heCcgKSApIGF0dHJzLm1heCA9IGNvbnRyb2wubWF4O1xyXG5cdFx0XHRcdFx0aWYgKCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGNvbnRyb2wsICdzdGVwJyApICkgYXR0cnMuc3RlcCA9IGNvbnRyb2wuc3RlcDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZmllbGRfZWwgPSBlbCggJ2lucHV0JywgYXR0cnMgKTtcclxuXHRcdFx0XHRpZiAoIHZhbHVlICE9PSAnJyApIGZpZWxkX2VsLnZhbHVlID0gU3RyaW5nKCB2YWx1ZSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjdHJsX3dyYXAuYXBwZW5kQ2hpbGQoIGZpZWxkX2VsICk7XHJcblx0XHRcdHJvd19lbC5hcHBlbmRDaGlsZCggbGFiZWxfZWwgKTtcclxuXHRcdFx0cm93X2VsLmFwcGVuZENoaWxkKCBjdHJsX3dyYXAgKTtcclxuXHRcdFx0cmV0dXJuIHJvd19lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNjaGVtYSA+IEluc3BlY3RvciA+IEdyb3VwcyEgQnVpbGQgYW4gaW5zcGVjdG9yIGdyb3VwIChjb2xsYXBzaWJsZSkuXHJcblx0XHQgKiBTdHJ1Y3R1cmU6XHJcblx0XHQgKiA8c2VjdGlvbiBjbGFzcz1cIndwYmNfYmZiX19pbnNwZWN0b3JfX2dyb3VwIHdwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwIGlzLW9wZW5cIiBkYXRhLWdyb3VwPVwiLi4uXCI+XHJcblx0XHQgKiAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiZ3JvdXBfX2hlYWRlclwiIHJvbGU9XCJidXR0b25cIiBhcmlhLWV4cGFuZGVkPVwidHJ1ZVwiIGFyaWEtY29udHJvbHM9XCJ3cGJjX2NvbGxhcHNpYmxlX3BhbmVsX1hcIj5cclxuXHRcdCAqICAgICA8aDM+R3JvdXAgVGl0bGU8L2gzPlxyXG5cdFx0ICogICAgIDxpIGNsYXNzPVwid3BiY191aV9lbF9fdmVydF9tZW51X3Jvb3Rfc2VjdGlvbl9pY29uIG1lbnVfaWNvbiBpY29uLTF4IHdwYmMtYmktY2hldnJvbi1yaWdodFwiPjwvaT5cclxuXHRcdCAqICAgPC9idXR0b24+XHJcblx0XHQgKiAgIDxkaXYgY2xhc3M9XCJncm91cF9fZmllbGRzXCIgaWQ9XCJ3cGJjX2NvbGxhcHNpYmxlX3BhbmVsX1hcIiBhcmlhLWhpZGRlbj1cImZhbHNlXCI+IOKApnJvd3PigKYgPC9kaXY+XHJcblx0XHQgKiA8L3NlY3Rpb24+XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGdyb3VwXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcHJvcHNfc2NoZW1hXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHVpZFxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGN0eFxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBidWlsZF9ncm91cChncm91cCwgcHJvcHNfc2NoZW1hLCBkYXRhLCB1aWQsIGN0eCkge1xyXG5cdFx0XHR2YXIgaXNfb3BlbiAgPSAhIWdyb3VwLm9wZW47XHJcblx0XHRcdHZhciBwYW5lbF9pZCA9ICd3cGJjX2NvbGxhcHNpYmxlX3BhbmVsXycgKyB1aWQgKyAnXycgKyAoZ3JvdXAua2V5IHx8ICdnJyk7XHJcblxyXG5cdFx0XHR2YXIgc2VjdGlvbiA9IGVsKCAnc2VjdGlvbicsIHtcclxuXHRcdFx0XHQnY2xhc3MnICAgICA6ICd3cGJjX2JmYl9faW5zcGVjdG9yX19ncm91cCB3cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcgKyAoaXNfb3BlbiA/ICcgaXMtb3BlbicgOiAnJyksXHJcblx0XHRcdFx0J2RhdGEtZ3JvdXAnOiBncm91cC5rZXkgfHwgJydcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dmFyIGhlYWRlcl9idG4gPSBlbCggJ2J1dHRvbicsIHtcclxuXHRcdFx0XHR0eXBlICAgICAgICAgICA6ICdidXR0b24nLFxyXG5cdFx0XHRcdCdjbGFzcycgICAgICAgIDogJ2dyb3VwX19oZWFkZXInLFxyXG5cdFx0XHRcdHJvbGUgICAgICAgICAgIDogJ2J1dHRvbicsXHJcblx0XHRcdFx0J2FyaWEtZXhwYW5kZWQnOiBpc19vcGVuID8gJ3RydWUnIDogJ2ZhbHNlJyxcclxuXHRcdFx0XHQnYXJpYS1jb250cm9scyc6IHBhbmVsX2lkXHJcblx0XHRcdH0sIFtcclxuXHRcdFx0XHRlbCggJ2gzJywgbnVsbCwgZ3JvdXAudGl0bGUgfHwgZ3JvdXAubGFiZWwgfHwgZ3JvdXAua2V5IHx8ICcnICksXHJcblx0XHRcdFx0ZWwoICdpJywgeyAnY2xhc3MnOiAnd3BiY191aV9lbF9fdmVydF9tZW51X3Jvb3Rfc2VjdGlvbl9pY29uIG1lbnVfaWNvbiBpY29uLTF4IHdwYmMtYmktY2hldnJvbi1yaWdodCcgfSApXHJcblx0XHRcdF0gKTtcclxuXHJcblx0XHRcdHZhciBmaWVsZHMgPSBlbCggJ2RpdicsIHtcclxuXHRcdFx0XHQnY2xhc3MnICAgICAgOiAnZ3JvdXBfX2ZpZWxkcycsXHJcblx0XHRcdFx0aWQgICAgICAgICAgIDogcGFuZWxfaWQsXHJcblx0XHRcdFx0J2FyaWEtaGlkZGVuJzogaXNfb3BlbiA/ICdmYWxzZScgOiAndHJ1ZSdcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0ZnVuY3Rpb24gYXNBcnJheSh4KSB7XHJcblx0XHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCB4ICkgKSByZXR1cm4geDtcclxuXHRcdFx0XHRpZiAoIHggJiYgdHlwZW9mIHggPT09ICdvYmplY3QnICkgcmV0dXJuIE9iamVjdC52YWx1ZXMoIHggKTtcclxuXHRcdFx0XHRyZXR1cm4geCAhPSBudWxsID8gWyB4IF0gOiBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YXNBcnJheSggZ3JvdXAuY29udHJvbHMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoY29udHJvbCkge1xyXG5cdFx0XHRcdGZpZWxkcy5hcHBlbmRDaGlsZCggYnVpbGRfY29udHJvbCggY29udHJvbCwgcHJvcHNfc2NoZW1hLCBkYXRhLCB1aWQsIGN0eCApICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHNlY3Rpb24uYXBwZW5kQ2hpbGQoIGhlYWRlcl9idG4gKTtcclxuXHRcdFx0c2VjdGlvbi5hcHBlbmRDaGlsZCggZmllbGRzICk7XHJcblx0XHRcdHJldHVybiBzZWN0aW9uO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2NoZW1hID4gSW5zcGVjdG9yID4gSGVhZGVyISBCdWlsZCBpbnNwZWN0b3IgaGVhZGVyIHdpdGggYWN0aW9uIGJ1dHRvbnMgd2lyZWQgdG8gZXhpc3RpbmcgZGF0YS1hY3Rpb24gaGFuZGxlcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtBcnJheTxzdHJpbmc+fSBoZWFkZXJfYWN0aW9uc1xyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICB0aXRsZV90ZXh0XHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGJ1aWxkX2hlYWRlcihpbnNwZWN0b3JfdWksIHRpdGxlX2ZhbGxiYWNrLCBzY2hlbWFfZm9yX3R5cGUpIHtcclxuXHJcblx0XHRcdGluc3BlY3Rvcl91aSAgICAgID0gaW5zcGVjdG9yX3VpIHx8IHt9O1xyXG5cdFx0XHRzY2hlbWFfZm9yX3R5cGUgICA9IHNjaGVtYV9mb3JfdHlwZSB8fCB7fTtcclxuXHRcdFx0dmFyIHZhcmlhbnQgICAgICAgPSBpbnNwZWN0b3JfdWkuaGVhZGVyX3ZhcmlhbnQgfHwgJ21pbmltYWwnO1xyXG5cdFx0XHR2YXIgaGVhZGVyQWN0aW9ucyA9IGluc3BlY3Rvcl91aS5oZWFkZXJfYWN0aW9uc1xyXG5cdFx0XHRcdHx8IHNjaGVtYV9mb3JfdHlwZS5oZWFkZXJfYWN0aW9uc1xyXG5cdFx0XHRcdHx8IFsgJ2Rlc2VsZWN0JywgJ3Njcm9sbHRvJywgJ21vdmUtdXAnLCAnbW92ZS1kb3duJywgJ2R1cGxpY2F0ZScsICdkZWxldGUnIF07XHJcblxyXG5cdFx0XHR2YXIgdGl0bGUgICAgICAgPSBpbnNwZWN0b3JfdWkudGl0bGUgfHwgdGl0bGVfZmFsbGJhY2sgfHwgJyc7XHJcblx0XHRcdHZhciBkZXNjcmlwdGlvbiA9IGluc3BlY3Rvcl91aS5kZXNjcmlwdGlvbiB8fCAnJztcclxuXHJcblx0XHRcdC8vIGhlbHBlciB0byBjcmVhdGUgYSBidXR0b24gZm9yIGVpdGhlciBoZWFkZXIgc3R5bGVcclxuXHRcdFx0ZnVuY3Rpb24gYWN0aW9uQnRuKGFjdCwgbWluaW1hbCkge1xyXG5cdFx0XHRcdGlmICggbWluaW1hbCApIHtcclxuXHRcdFx0XHRcdHJldHVybiBlbCggJ2J1dHRvbicsIHsgdHlwZTogJ2J1dHRvbicsICdjbGFzcyc6ICdidXR0b24tbGluaycsICdkYXRhLWFjdGlvbic6IGFjdCB9LCAnJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyB0b29sYmFyIHZhcmlhbnQgKHJpY2gpXHJcblx0XHRcdFx0dmFyIGljb25NYXAgPSB7XHJcblx0XHRcdFx0XHQnZGVzZWxlY3QnIDogJ3dwYmNfaWNuX25lYXJfbWVfZGlzYWJsZWQnLFxyXG5cdFx0XHRcdFx0J3Njcm9sbHRvJyA6ICd3cGJjX2ljbl9hZHNfY2xpY2sgZmlsdGVyX2NlbnRlcl9mb2N1cycsXHJcblx0XHRcdFx0XHQnbW92ZS11cCcgIDogJ3dwYmNfaWNuX2Fycm93X3Vwd2FyZCcsXHJcblx0XHRcdFx0XHQnbW92ZS1kb3duJzogJ3dwYmNfaWNuX2Fycm93X2Rvd253YXJkJyxcclxuXHRcdFx0XHRcdCdkdXBsaWNhdGUnOiAnd3BiY19pY25fY29udGVudF9jb3B5JyxcclxuXHRcdFx0XHRcdCdkZWxldGUnICAgOiAnd3BiY19pY25fZGVsZXRlX291dGxpbmUnXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0XHR2YXIgY2xhc3NlcyA9ICdidXR0b24gYnV0dG9uLXNlY29uZGFyeSB3cGJjX3VpX2NvbnRyb2wgd3BiY191aV9idXR0b24nO1xyXG5cdFx0XHRcdGlmICggYWN0ID09PSAnZGVsZXRlJyApIGNsYXNzZXMgKz0gJyB3cGJjX3VpX2J1dHRvbl9kYW5nZXIgYnV0dG9uLWxpbmstZGVsZXRlJztcclxuXHJcblx0XHRcdFx0dmFyIGJ0biA9IGVsKCAnYnV0dG9uJywge1xyXG5cdFx0XHRcdFx0dHlwZSAgICAgICAgIDogJ2J1dHRvbicsXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgICAgOiBjbGFzc2VzLFxyXG5cdFx0XHRcdFx0J2RhdGEtYWN0aW9uJzogYWN0LFxyXG5cdFx0XHRcdFx0J2FyaWEtbGFiZWwnIDogYWN0LnJlcGxhY2UoIC8tL2csICcgJyApXHJcblx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRpZiAoIGFjdCA9PT0gJ2RlbGV0ZScgKSB7XHJcblx0XHRcdFx0XHRidG4uYXBwZW5kQ2hpbGQoIGVsKCAnc3BhbicsIHsgJ2NsYXNzJzogJ2luLWJ1dHRvbi10ZXh0JyB9LCAnRGVsZXRlJyApICk7XHJcblx0XHRcdFx0XHRidG4uYXBwZW5kQ2hpbGQoIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCAnICcgKSApOyAvLyBtaW5vciBzcGFjaW5nIGJlZm9yZSBpY29uXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJ0bi5hcHBlbmRDaGlsZCggZWwoICdpJywgeyAnY2xhc3MnOiAnbWVudV9pY29uIGljb24tMXggJyArIChpY29uTWFwW2FjdF0gfHwgJycpIH0gKSApO1xyXG5cdFx0XHRcdHJldHVybiBidG47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vID09PSBtaW5pbWFsIGhlYWRlciAoZXhpc3RpbmcgbG9vazsgZGVmYXVsdCkgPT09XHJcblx0XHRcdGlmICggdmFyaWFudCAhPT0gJ3Rvb2xiYXInICkge1xyXG5cdFx0XHRcdHZhciBoZWFkZXIgPSBlbCggJ2hlYWRlcicsIHsgJ2NsYXNzJzogJ3dwYmNfYmZiX19pbnNwZWN0b3JfX2hlYWRlcicgfSApO1xyXG5cdFx0XHRcdGhlYWRlci5hcHBlbmRDaGlsZCggZWwoICdoMycsIG51bGwsIHRpdGxlIHx8ICcnICkgKTtcclxuXHJcblx0XHRcdFx0dmFyIGFjdGlvbnMgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ3dwYmNfYmZiX19pbnNwZWN0b3JfX2hlYWRlcl9hY3Rpb25zJyB9ICk7XHJcblx0XHRcdFx0aGVhZGVyQWN0aW9ucy5mb3JFYWNoKCBmdW5jdGlvbiAoYWN0KSB7XHJcblx0XHRcdFx0XHRhY3Rpb25zLmFwcGVuZENoaWxkKCBhY3Rpb25CdG4oIGFjdCwgLyptaW5pbWFsKi90cnVlICkgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0aGVhZGVyLmFwcGVuZENoaWxkKCBhY3Rpb25zICk7XHJcblx0XHRcdFx0cmV0dXJuIGhlYWRlcjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gPT09IHRvb2xiYXIgaGVhZGVyIChyaWNoIHRpdGxlL2Rlc2MgKyBncm91cGVkIGJ1dHRvbnMpID09PVxyXG5cdFx0XHR2YXIgcm9vdCA9IGVsKCAnZGl2JywgeyAnY2xhc3MnOiAnd3BiY19iZmJfX2luc3BlY3Rvcl9faGVhZCcgfSApO1xyXG5cdFx0XHR2YXIgd3JhcCA9IGVsKCAnZGl2JywgeyAnY2xhc3MnOiAnaGVhZGVyX2NvbnRhaW5lcicgfSApO1xyXG5cdFx0XHR2YXIgbGVmdCA9IGVsKCAnZGl2JywgeyAnY2xhc3MnOiAnaGVhZGVyX3RpdGxlX2NvbnRlbnQnIH0gKTtcclxuXHRcdFx0dmFyIGgzICAgPSBlbCggJ2gzJywgeyAnY2xhc3MnOiAndGl0bGUnIH0sIHRpdGxlIHx8ICcnICk7XHJcblx0XHRcdGxlZnQuYXBwZW5kQ2hpbGQoIGgzICk7XHJcblx0XHRcdGlmICggZGVzY3JpcHRpb24gKSB7XHJcblx0XHRcdFx0bGVmdC5hcHBlbmRDaGlsZCggZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdkZXNjJyB9LCBkZXNjcmlwdGlvbiApICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciByaWdodCA9IGVsKCAnZGl2JywgeyAnY2xhc3MnOiAnYWN0aW9ucyB3cGJjX2FqeF90b29sYmFyIHdwYmNfbm9fYm9yZGVycycgfSApO1xyXG5cdFx0XHR2YXIgdWlDICAgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ3VpX2NvbnRhaW5lciB1aV9jb250YWluZXJfc21hbGwnIH0gKTtcclxuXHRcdFx0dmFyIHVpRyAgID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd1aV9ncm91cCcgfSApO1xyXG5cclxuXHRcdFx0Ly8gU3BsaXQgaW50byB2aXN1YWwgZ3JvdXBzOiBmaXJzdCAyLCBuZXh0IDIsIHRoZW4gdGhlIHJlc3QuXHJcblx0XHRcdHZhciBnMSA9IGVsKCAnZGl2JywgeyAnY2xhc3MnOiAndWlfZWxlbWVudCcgfSApO1xyXG5cdFx0XHR2YXIgZzIgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ3VpX2VsZW1lbnQnIH0gKTtcclxuXHRcdFx0dmFyIGczID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd1aV9lbGVtZW50JyB9ICk7XHJcblxyXG5cdFx0XHRoZWFkZXJBY3Rpb25zLnNsaWNlKCAwLCAyICkuZm9yRWFjaCggZnVuY3Rpb24gKGFjdCkge1xyXG5cdFx0XHRcdGcxLmFwcGVuZENoaWxkKCBhY3Rpb25CdG4oIGFjdCwgZmFsc2UgKSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGhlYWRlckFjdGlvbnMuc2xpY2UoIDIsIDQgKS5mb3JFYWNoKCBmdW5jdGlvbiAoYWN0KSB7XHJcblx0XHRcdFx0ZzIuYXBwZW5kQ2hpbGQoIGFjdGlvbkJ0biggYWN0LCBmYWxzZSApICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0aGVhZGVyQWN0aW9ucy5zbGljZSggNCApLmZvckVhY2goIGZ1bmN0aW9uIChhY3QpIHtcclxuXHRcdFx0XHRnMy5hcHBlbmRDaGlsZCggYWN0aW9uQnRuKCBhY3QsIGZhbHNlICkgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dWlHLmFwcGVuZENoaWxkKCBnMSApO1xyXG5cdFx0XHR1aUcuYXBwZW5kQ2hpbGQoIGcyICk7XHJcblx0XHRcdHVpRy5hcHBlbmRDaGlsZCggZzMgKTtcclxuXHRcdFx0dWlDLmFwcGVuZENoaWxkKCB1aUcgKTtcclxuXHRcdFx0cmlnaHQuYXBwZW5kQ2hpbGQoIHVpQyApO1xyXG5cclxuXHRcdFx0d3JhcC5hcHBlbmRDaGlsZCggbGVmdCApO1xyXG5cdFx0XHR3cmFwLmFwcGVuZENoaWxkKCByaWdodCApO1xyXG5cdFx0XHRyb290LmFwcGVuZENoaWxkKCB3cmFwICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gcm9vdDtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0ZnVuY3Rpb24gZmFjdG9yeV9yZW5kZXIocGFuZWxfZWwsIHNjaGVtYV9mb3JfdHlwZSwgZGF0YSwgb3B0cykge1xyXG5cdFx0XHRpZiAoICFwYW5lbF9lbCApIHJldHVybiBwYW5lbF9lbDtcclxuXHJcblx0XHRcdHNjaGVtYV9mb3JfdHlwZSAgPSBzY2hlbWFfZm9yX3R5cGUgfHwge307XHJcblx0XHRcdHZhciBwcm9wc19zY2hlbWEgPSAoc2NoZW1hX2Zvcl90eXBlLnNjaGVtYSAmJiBzY2hlbWFfZm9yX3R5cGUuc2NoZW1hLnByb3BzKSA/IHNjaGVtYV9mb3JfdHlwZS5zY2hlbWEucHJvcHMgOiB7fTtcclxuXHRcdFx0dmFyIGluc3BlY3Rvcl91aSA9IChzY2hlbWFfZm9yX3R5cGUuaW5zcGVjdG9yX3VpIHx8IHt9KTtcclxuXHRcdFx0dmFyIGdyb3VwcyAgICAgICA9IGluc3BlY3Rvcl91aS5ncm91cHMgfHwgW107XHJcblxyXG5cdFx0XHR2YXIgaGVhZGVyX2FjdGlvbnMgPSBpbnNwZWN0b3JfdWkuaGVhZGVyX2FjdGlvbnMgfHwgc2NoZW1hX2Zvcl90eXBlLmhlYWRlcl9hY3Rpb25zIHx8IFtdO1xyXG5cdFx0XHR2YXIgdGl0bGVfdGV4dCAgICAgPSAob3B0cyAmJiBvcHRzLnRpdGxlKSB8fCBpbnNwZWN0b3JfdWkudGl0bGUgfHwgc2NoZW1hX2Zvcl90eXBlLmxhYmVsIHx8IChkYXRhICYmIGRhdGEubGFiZWwpIHx8ICcnO1xyXG5cclxuXHRcdC8vIFByZXBhcmUgcmVuZGVyaW5nIGNvbnRleHQgZm9yIHNsb3RzL3ZhbHVlX2Zyb20sIGV0Yy5cclxuXHRcdFx0dmFyIGN0eCA9IHtcclxuXHRcdFx0XHRlbCAgICAgOiBvcHRzICYmIG9wdHMuZWwgfHwgbnVsbCxcclxuXHRcdFx0XHRidWlsZGVyOiBvcHRzICYmIG9wdHMuYnVpbGRlciB8fCBudWxsLFxyXG5cdFx0XHRcdHR5cGUgICA6IG9wdHMgJiYgb3B0cy50eXBlIHx8IG51bGwsXHJcblx0XHRcdFx0ZGF0YSAgIDogZGF0YSB8fCB7fVxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Ly8gY2xlYXIgcGFuZWwuXHJcblx0XHRcdHdoaWxlICggcGFuZWxfZWwuZmlyc3RDaGlsZCApIHBhbmVsX2VsLnJlbW92ZUNoaWxkKCBwYW5lbF9lbC5maXJzdENoaWxkICk7XHJcblxyXG5cdFx0XHR2YXIgdWlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZyggMzYgKS5zbGljZSggMiwgOCApO1xyXG5cclxuXHRcdFx0Ly8gaGVhZGVyLlxyXG5cdFx0XHRwYW5lbF9lbC5hcHBlbmRDaGlsZCggYnVpbGRfaGVhZGVyKCBpbnNwZWN0b3JfdWksIHRpdGxlX3RleHQsIHNjaGVtYV9mb3JfdHlwZSApICk7XHJcblxyXG5cclxuXHRcdFx0Ly8gZ3JvdXBzLlxyXG5cdFx0XHRncm91cHMuZm9yRWFjaCggZnVuY3Rpb24gKGcpIHtcclxuXHRcdFx0XHRwYW5lbF9lbC5hcHBlbmRDaGlsZCggYnVpbGRfZ3JvdXAoIGcsIHByb3BzX3NjaGVtYSwgZGF0YSB8fCB7fSwgdWlkLCBjdHggKSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBBUklBIHN5bmMgZm9yIHRvZ2dsZXMgY3JlYXRlZCBoZXJlIChlbnN1cmUgYXJpYS1jaGVja2VkIG1hdGNoZXMgc3RhdGUpLlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdC8vIENlbnRyYWxpemVkIFVJIG5vcm1hbGl6ZXJzICh0b2dnbGVzICsgQTExeSk6IGhhbmRsZWQgaW4gQ29yZS5cclxuXHRcdFx0XHRVSS5hcHBseV9wb3N0X3JlbmRlciggcGFuZWxfZWwgKTtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0d2lyZV9sZW5fZ3JvdXAoIHBhbmVsX2VsICk7XHJcblx0XHRcdFx0XHQvLyBJbml0aWFsaXplIENvbG9yaXMgb24gY29sb3IgaW5wdXRzIHJlbmRlcmVkIGluIHRoaXMgcGFuZWwuXHJcblx0XHRcdFx0XHRpbml0X2NvbG9yaXNfcGlja2VycyggcGFuZWxfZWwgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHsgfVxyXG5cdFx0XHR9IGNhdGNoICggXyApIHsgfVxyXG5cclxuXHRcdFx0cmV0dXJuIHBhbmVsX2VsO1xyXG5cdFx0fVxyXG5cclxuXHRcdFVJLldQQkNfQkZCX0luc3BlY3Rvcl9GYWN0b3J5ID0geyByZW5kZXI6IGZhY3RvcnlfcmVuZGVyIH07ICAgLy8gb3ZlcndyaXRlL3JlZnJlc2hcclxuXHJcblx0XHQvLyAtLS0tIEJ1aWx0LWluIHNsb3QgKyB2YWx1ZV9mcm9tIGZvciBTZWN0aW9ucyAtLS0tXHJcblxyXG5cdFx0ZnVuY3Rpb24gc2xvdF9sYXlvdXRfY2hpcHMoaG9zdCwgY3R4KSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dmFyIEwgPSB3LldQQkNfQkZCX0NvcmUgJiYgIHcuV1BCQ19CRkJfQ29yZS5VSSAmJiB3LldQQkNfQkZCX0NvcmUuVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzO1xyXG5cdFx0XHRcdGlmICggTCAmJiB0eXBlb2YgTC5yZW5kZXJfZm9yX3NlY3Rpb24gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRMLnJlbmRlcl9mb3Jfc2VjdGlvbiggY3R4LmJ1aWxkZXIsIGN0eC5lbCwgaG9zdCApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRob3N0LmFwcGVuZENoaWxkKCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSggJ1tsYXlvdXRfY2hpcHMgbm90IGF2YWlsYWJsZV0nICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdGNvbnNvbGUud2FybiggJ3dwYmNfYmZiX3Nsb3RfbGF5b3V0X2NoaXBzIGZhaWxlZDonLCBlICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3Nsb3RzLmxheW91dF9jaGlwcyA9IHNsb3RfbGF5b3V0X2NoaXBzO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHZhbHVlX2Zyb21fY29tcHV0ZV9zZWN0aW9uX2NvbHVtbnMoY3R4KSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dmFyIHJvdyA9IGN0eCAmJiBjdHguZWwgJiYgY3R4LmVsLnF1ZXJ5U2VsZWN0b3IgJiYgY3R4LmVsLnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAud3BiY19iZmJfX3JvdycgKTtcclxuXHRcdFx0XHRpZiAoICFyb3cgKSByZXR1cm4gMTtcclxuXHRcdFx0XHR2YXIgbiA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkubGVuZ3RoIHx8IDE7XHJcblx0XHRcdFx0aWYgKCBuIDwgMSApIG4gPSAxO1xyXG5cdFx0XHRcdGlmICggbiA+IDQgKSBuID0gNDtcclxuXHRcdFx0XHRyZXR1cm4gbjtcclxuXHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0cmV0dXJuIDE7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3ZhbHVlX2Zyb20uY29tcHV0ZV9zZWN0aW9uX2NvbHVtbnMgPSB2YWx1ZV9mcm9tX2NvbXB1dGVfc2VjdGlvbl9jb2x1bW5zO1xyXG5cdH1cclxuXHJcblx0Ly8gMykgSW5zcGVjdG9yIGNsYXNzLlxyXG5cclxuXHRjbGFzcyBXUEJDX0JGQl9JbnNwZWN0b3Ige1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKHBhbmVsX2VsLCBidWlsZGVyKSB7XHJcblx0XHRcdHRoaXMucGFuZWwgICAgICAgICA9IHBhbmVsX2VsIHx8IHRoaXMuX2NyZWF0ZV9mYWxsYmFja19wYW5lbCgpO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIgICAgICAgPSBidWlsZGVyO1xyXG5cdFx0XHR0aGlzLnNlbGVjdGVkX2VsICAgPSBudWxsO1xyXG5cdFx0XHR0aGlzLl9yZW5kZXJfdGltZXIgPSBudWxsO1xyXG5cclxuXHRcdFx0dGhpcy5fb25fZGVsZWdhdGVkX2lucHV0ICA9IChlKSA9PiB0aGlzLl9hcHBseV9jb250cm9sX2Zyb21fZXZlbnQoIGUgKTtcclxuXHRcdFx0dGhpcy5fb25fZGVsZWdhdGVkX2NoYW5nZSA9IChlKSA9PiB0aGlzLl9hcHBseV9jb250cm9sX2Zyb21fZXZlbnQoIGUgKTtcclxuXHRcdFx0dGhpcy5wYW5lbC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCB0aGlzLl9vbl9kZWxlZ2F0ZWRfaW5wdXQsIHRydWUgKTtcclxuXHRcdFx0dGhpcy5wYW5lbC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdGhpcy5fb25fZGVsZWdhdGVkX2NoYW5nZSwgdHJ1ZSApO1xyXG5cclxuXHRcdFx0dGhpcy5fb25fZGVsZWdhdGVkX2NsaWNrID0gKGUpID0+IHtcclxuXHRcdFx0XHRjb25zdCBidG4gPSBlLnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtYWN0aW9uXScgKTtcclxuXHRcdFx0XHRpZiAoICFidG4gfHwgIXRoaXMucGFuZWwuY29udGFpbnMoIGJ0biApICkgcmV0dXJuO1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cclxuXHRcdFx0XHRjb25zdCBhY3Rpb24gPSBidG4uZ2V0QXR0cmlidXRlKCAnZGF0YS1hY3Rpb24nICk7XHJcblx0XHRcdFx0Y29uc3QgZWwgICAgID0gdGhpcy5zZWxlY3RlZF9lbDtcclxuXHRcdFx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0dy5XUEJDX0JGQl9JbnNwZWN0b3JfQWN0aW9ucz8ucnVuKCBhY3Rpb24sIHtcclxuXHRcdFx0XHRcdGJ1aWxkZXI6IHRoaXMuYnVpbGRlcixcclxuXHRcdFx0XHRcdGVsLFxyXG5cdFx0XHRcdFx0cGFuZWwgIDogdGhpcy5wYW5lbCxcclxuXHRcdFx0XHRcdGV2ZW50ICA6IGVcclxuXHRcdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRcdGlmICggYWN0aW9uID09PSAnZGVsZXRlJyApIHRoaXMuY2xlYXIoKTtcclxuXHRcdFx0fTtcclxuXHRcdFx0dGhpcy5wYW5lbC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9kZWxlZ2F0ZWRfY2xpY2sgKTtcclxuXHRcdH1cclxuXHJcblx0XHRfcG9zdF9yZW5kZXJfdWkoKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dmFyIFVJID0gdy5XUEJDX0JGQl9Db3JlICYmIHcuV1BCQ19CRkJfQ29yZS5VSTtcclxuXHRcdFx0XHRpZiAoIFVJICYmIHR5cGVvZiBVSS5hcHBseV9wb3N0X3JlbmRlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFVJLmFwcGx5X3Bvc3RfcmVuZGVyKCB0aGlzLnBhbmVsICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIE5FVzogd2lyZSBzbGlkZXIvbnVtYmVyL3VuaXQgc3luY2luZyBmb3IgbGVuZ3RoICYgcmFuZ2VfbnVtYmVyIGdyb3Vwcy5cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0d2lyZV9sZW5fZ3JvdXAoIHRoaXMucGFuZWwgKTtcclxuXHRcdFx0XHRcdGluaXRfY29sb3Jpc19waWNrZXJzKCB0aGlzLnBhbmVsICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRfd3BiYz8uZGV2Py5lcnJvcj8uKCAnaW5zcGVjdG9yLl9wb3N0X3JlbmRlcl91aScsIGUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRfYXBwbHlfY29udHJvbF9mcm9tX2V2ZW50KGUpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5wYW5lbC5jb250YWlucyggZS50YXJnZXQgKSApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IHQgICA9IC8qKiBAdHlwZSB7SFRNTElucHV0RWxlbWVudHxIVE1MVGV4dEFyZWFFbGVtZW50fEhUTUxTZWxlY3RFbGVtZW50fSAqLyAoZS50YXJnZXQpO1xyXG5cdFx0XHRjb25zdCBrZXkgPSB0Py5kYXRhc2V0Py5pbnNwZWN0b3JLZXk7XHJcblx0XHRcdGlmICggIWtleSApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGVsID0gdGhpcy5zZWxlY3RlZF9lbDtcclxuXHRcdFx0aWYgKCAhZWwgfHwgIWRvY3VtZW50LmJvZHkuY29udGFpbnMoIGVsICkgKSByZXR1cm47XHJcblxyXG5cdFx0XHRsZXQgdjtcclxuXHRcdFx0aWYgKCB0IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiB0LnR5cGUgPT09ICdjaGVja2JveCcgKSB7XHJcblx0XHRcdFx0diA9ICEhdC5jaGVja2VkO1xyXG5cdFx0XHRcdHQuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgdiA/ICd0cnVlJyA6ICdmYWxzZScgKTsgICAgICAgICAvLyBLZWVwIEFSSUEgc3RhdGUgaW4gc3luYyBmb3IgdG9nZ2xlcyAoc2NoZW1hIGFuZCB0ZW1wbGF0ZSBwYXRocykuXHJcblx0XHRcdH0gZWxzZSBpZiAoIHQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIHQudHlwZSA9PT0gJ251bWJlcicgKSB7XHJcblx0XHRcdFx0diA9ICh0LnZhbHVlID09PSAnJyA/ICcnIDogTnVtYmVyKCB0LnZhbHVlICkpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHYgPSB0LnZhbHVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGtleSA9PT0gJ2lkJyApIHtcclxuXHRcdFx0XHRjb25zdCB1bmlxdWUgPSB0aGlzLmJ1aWxkZXI/LmlkPy5zZXRfZmllbGRfaWQ/LiggZWwsIHYgKTtcclxuXHRcdFx0XHRpZiAoIHVuaXF1ZSAhPSBudWxsICYmIHQudmFsdWUgIT09IHVuaXF1ZSApIHQudmFsdWUgPSB1bmlxdWU7XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBrZXkgPT09ICduYW1lJyApIHtcclxuXHRcdFx0XHRjb25zdCB1bmlxdWUgPSB0aGlzLmJ1aWxkZXI/LmlkPy5zZXRfZmllbGRfbmFtZT8uKCBlbCwgdiApO1xyXG5cdFx0XHRcdGlmICggdW5pcXVlICE9IG51bGwgJiYgdC52YWx1ZSAhPT0gdW5pcXVlICkgdC52YWx1ZSA9IHVuaXF1ZTtcclxuXHJcblx0XHRcdH0gZWxzZSBpZiAoIGtleSA9PT0gJ2h0bWxfaWQnICkge1xyXG5cdFx0XHRcdGNvbnN0IGFwcGxpZWQgPSB0aGlzLmJ1aWxkZXI/LmlkPy5zZXRfZmllbGRfaHRtbF9pZD8uKCBlbCwgdiApO1xyXG5cdFx0XHRcdGlmICggYXBwbGllZCAhPSBudWxsICYmIHQudmFsdWUgIT09IGFwcGxpZWQgKSB0LnZhbHVlID0gYXBwbGllZDtcclxuXHJcblx0XHRcdH0gZWxzZSBpZiAoIGtleSA9PT0gJ2NvbHVtbnMnICYmIGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdGNvbnN0IHZfaW50ID0gcGFyc2VJbnQoIFN0cmluZyggdiApLCAxMCApO1xyXG5cdFx0XHRcdGlmICggTnVtYmVyLmlzRmluaXRlKCB2X2ludCApICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgY2xhbXBlZCA9IHcuV1BCQ19CRkJfQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5jbGFtcCggdl9pbnQsIDEsIDQgKTtcclxuXHRcdFx0XHRcdHRoaXMuYnVpbGRlcj8uc2V0X3NlY3Rpb25fY29sdW1ucz8uKCBlbCwgY2xhbXBlZCApO1xyXG5cdFx0XHRcdFx0aWYgKCBTdHJpbmcoIGNsYW1wZWQgKSAhPT0gdC52YWx1ZSApIHQudmFsdWUgPSBTdHJpbmcoIGNsYW1wZWQgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGlmICggdCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgdC50eXBlID09PSAnY2hlY2tib3gnICkge1xyXG5cdFx0XHRcdFx0ZWwuc2V0QXR0cmlidXRlKCAnZGF0YS0nICsga2V5LCBTdHJpbmcoICEhdiApICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggdCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgdC50eXBlID09PSAnbnVtYmVyJyApIHtcclxuXHRcdFx0XHRcdGlmICggdC52YWx1ZSA9PT0gJycgfHwgIU51bWJlci5pc0Zpbml0ZSggdiApICkge1xyXG5cdFx0XHRcdFx0XHRlbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLScgKyBrZXkgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtJyArIGtleSwgU3RyaW5nKCB2ICkgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2UgaWYgKCB2ID09IG51bGwgKSB7XHJcblx0XHRcdFx0XHRlbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLScgKyBrZXkgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0ZWwuc2V0QXR0cmlidXRlKCAnZGF0YS0nICsga2V5LCAodHlwZW9mIHYgPT09ICdvYmplY3QnKSA/IEpTT04uc3RyaW5naWZ5KCB2ICkgOiBTdHJpbmcoIHYgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gVXBkYXRlIHByZXZpZXcvb3ZlcmxheVxyXG5cdFx0XHRpZiAoIGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSApIHtcclxuXHRcdFx0XHRpZiAoIHRoaXMuYnVpbGRlcj8ucHJldmlld19tb2RlICkgdGhpcy5idWlsZGVyLnJlbmRlcl9wcmV2aWV3KCBlbCApO1xyXG5cdFx0XHRcdGVsc2UgdGhpcy5idWlsZGVyLmFkZF9vdmVybGF5X3Rvb2xiYXIoIGVsICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmFkZF9vdmVybGF5X3Rvb2xiYXIoIGVsICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdGhpcy5fbmVlZHNfcmVyZW5kZXIoIGVsLCBrZXksIGUgKSApIHtcclxuXHRcdFx0XHR0aGlzLl9zY2hlZHVsZV9yZW5kZXJfcHJlc2VydmluZ19mb2N1cyggMCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X25lZWRzX3JlcmVuZGVyKGVsLCBrZXksIF9lKSB7XHJcblx0XHRcdGlmICggZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgJiYga2V5ID09PSAnY29sdW1ucycgKSByZXR1cm4gdHJ1ZTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGJpbmRfdG9fZmllbGQoZmllbGRfZWwpIHtcclxuXHRcdFx0dGhpcy5zZWxlY3RlZF9lbCA9IGZpZWxkX2VsO1xyXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNsZWFyKCkge1xyXG5cdFx0XHR0aGlzLnNlbGVjdGVkX2VsID0gbnVsbDtcclxuXHRcdFx0aWYgKCB0aGlzLl9yZW5kZXJfdGltZXIgKSB7XHJcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KCB0aGlzLl9yZW5kZXJfdGltZXIgKTtcclxuXHRcdFx0XHR0aGlzLl9yZW5kZXJfdGltZXIgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIEFsc28gY2xlYXIgdGhlIHNlY3Rpb24tY29scyBoaW50IG9uIGVtcHR5IHN0YXRlLlxyXG5cdFx0XHR0aGlzLnBhbmVsLnJlbW92ZUF0dHJpYnV0ZSgnZGF0YS1iZmItc2VjdGlvbi1jb2xzJyk7XHJcblx0XHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9faW5zcGVjdG9yX19lbXB0eVwiPlNlbGVjdCBhIGZpZWxkIHRvIGVkaXQgaXRzIG9wdGlvbnMuPC9kaXY+JztcclxuXHRcdH1cclxuXHJcblx0XHRfc2NoZWR1bGVfcmVuZGVyX3ByZXNlcnZpbmdfZm9jdXMoZGVsYXkgPSAyMDApIHtcclxuXHRcdFx0Y29uc3QgYWN0aXZlICAgID0gLyoqIEB0eXBlIHtIVE1MSW5wdXRFbGVtZW50fEhUTUxUZXh0QXJlYUVsZW1lbnR8SFRNTEVsZW1lbnR8bnVsbH0gKi8gKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpO1xyXG5cdFx0XHRjb25zdCBhY3RpdmVLZXkgPSBhY3RpdmU/LmRhdGFzZXQ/Lmluc3BlY3RvcktleSB8fCBudWxsO1xyXG5cdFx0XHRsZXQgc2VsU3RhcnQgICAgPSBudWxsLCBzZWxFbmQgPSBudWxsO1xyXG5cclxuXHRcdFx0aWYgKCBhY3RpdmUgJiYgJ3NlbGVjdGlvblN0YXJ0JyBpbiBhY3RpdmUgJiYgJ3NlbGVjdGlvbkVuZCcgaW4gYWN0aXZlICkge1xyXG5cdFx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0XHRzZWxTdGFydCA9IGFjdGl2ZS5zZWxlY3Rpb25TdGFydDtcclxuXHRcdFx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRcdFx0c2VsRW5kICAgPSBhY3RpdmUuc2VsZWN0aW9uRW5kO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHRoaXMuX3JlbmRlcl90aW1lciApIGNsZWFyVGltZW91dCggdGhpcy5fcmVuZGVyX3RpbWVyICk7XHJcblx0XHRcdHRoaXMuX3JlbmRlcl90aW1lciA9IC8qKiBAdHlwZSB7dW5rbm93bn0gKi8gKHNldFRpbWVvdXQoICgpID0+IHtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0XHRcdGlmICggYWN0aXZlS2V5ICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgbmV4dCA9IC8qKiBAdHlwZSB7SFRNTElucHV0RWxlbWVudHxIVE1MVGV4dEFyZWFFbGVtZW50fEhUTUxFbGVtZW50fG51bGx9ICovIChcclxuXHRcdFx0XHRcdFx0dGhpcy5wYW5lbC5xdWVyeVNlbGVjdG9yKCBgW2RhdGEtaW5zcGVjdG9yLWtleT1cIiR7YWN0aXZlS2V5fVwiXWAgKVxyXG5cdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdGlmICggbmV4dCApIHtcclxuXHRcdFx0XHRcdFx0bmV4dC5mb2N1cygpO1xyXG5cdFx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRcdGlmICggc2VsU3RhcnQgIT0gbnVsbCAmJiBzZWxFbmQgIT0gbnVsbCAmJiB0eXBlb2YgbmV4dC5zZXRTZWxlY3Rpb25SYW5nZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0XHRcdC8vIEB0cy1pZ25vcmVcclxuXHRcdFx0XHRcdFx0XHRcdG5leHQuc2V0U2VsZWN0aW9uUmFuZ2UoIHNlbFN0YXJ0LCBzZWxFbmQgKTtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0gY2F0Y2goIGUgKXsgX3dwYmM/LmRldj8uZXJyb3IoICdfcmVuZGVyX3RpbWVyJywgZSApOyB9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCBkZWxheSApKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZW5kZXIoKSB7XHJcblxyXG5cdFx0XHRjb25zdCBlbCA9IHRoaXMuc2VsZWN0ZWRfZWw7XHJcblx0XHRcdGlmICggIWVsIHx8ICFkb2N1bWVudC5ib2R5LmNvbnRhaW5zKCBlbCApICkgcmV0dXJuIHRoaXMuY2xlYXIoKTtcclxuXHJcblx0XHRcdC8vIFJlc2V0IHNlY3Rpb24tY29scyBoaW50IHVubGVzcyB3ZSBzZXQgaXQgbGF0ZXIgZm9yIGEgc2VjdGlvbi5cclxuXHRcdFx0dGhpcy5wYW5lbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLWJmYi1zZWN0aW9uLWNvbHMnICk7XHJcblxyXG5cdFx0XHRjb25zdCBwcmV2X3Njcm9sbCA9IHRoaXMucGFuZWwuc2Nyb2xsVG9wO1xyXG5cclxuXHRcdFx0Ly8gU2VjdGlvblxyXG5cdFx0XHRpZiAoIGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdGxldCB0cGwgPSBudWxsO1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHR0cGwgPSAody53cCAmJiB3cC50ZW1wbGF0ZSAmJiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3RtcGwtd3BiYy1iZmItaW5zcGVjdG9yLXNlY3Rpb24nICkpID8gd3AudGVtcGxhdGUoICd3cGJjLWJmYi1pbnNwZWN0b3Itc2VjdGlvbicgKSA6IG51bGw7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0XHR0cGwgPSBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCB0cGwgKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhbmVsLmlubmVySFRNTCA9IHRwbCgge30gKTtcclxuXHRcdFx0XHRcdHRoaXMuX2VuZm9yY2VfZGVmYXVsdF9ncm91cF9vcGVuKCk7XHJcblx0XHRcdFx0XHR0aGlzLl9zZXRfcGFuZWxfc2VjdGlvbl9jb2xzKCBlbCApO1xyXG5cdFx0XHRcdFx0dGhpcy5fcG9zdF9yZW5kZXJfdWkoKTtcclxuXHRcdFx0XHRcdHRoaXMucGFuZWwuc2Nyb2xsVG9wID0gcHJldl9zY3JvbGw7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCBGYWN0b3J5ID0gdy5XUEJDX0JGQl9Db3JlLlVJICYmIHcuV1BCQ19CRkJfQ29yZS5VSS5XUEJDX0JGQl9JbnNwZWN0b3JfRmFjdG9yeTtcclxuXHRcdFx0XHRjb25zdCBzY2hlbWFzID0gdy5XUEJDX0JGQl9TY2hlbWFzIHx8IHt9O1xyXG5cdFx0XHRcdGNvbnN0IGVudHJ5ICAgPSBzY2hlbWFzWydzZWN0aW9uJ10gfHwgbnVsbDtcclxuXHRcdFx0XHRpZiAoIGVudHJ5ICYmIEZhY3RvcnkgKSB7XHJcblx0XHRcdFx0XHR0aGlzLnBhbmVsLmlubmVySFRNTCA9ICcnO1xyXG5cdFx0XHRcdFx0RmFjdG9yeS5yZW5kZXIoXHJcblx0XHRcdFx0XHRcdHRoaXMucGFuZWwsXHJcblx0XHRcdFx0XHRcdGVudHJ5LFxyXG5cdFx0XHRcdFx0XHR7fSxcclxuXHRcdFx0XHRcdFx0eyBlbCwgYnVpbGRlcjogdGhpcy5idWlsZGVyLCB0eXBlOiAnc2VjdGlvbicsIHRpdGxlOiBlbnRyeS5sYWJlbCB8fCAnU2VjdGlvbicgfVxyXG5cdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdHRoaXMuX2VuZm9yY2VfZGVmYXVsdF9ncm91cF9vcGVuKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gLS0tIFNhZmV0eSBuZXQ6IGlmIGZvciBhbnkgcmVhc29uIHRoZSBzbG90IGRpZG7igJl0IHJlbmRlciBjaGlwcywgaW5qZWN0IHRoZW0gbm93LlxyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgaGFzU2xvdEhvc3QgPVxyXG5cdFx0XHRcdFx0XHRcdFx0ICB0aGlzLnBhbmVsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1iZmItc2xvdD1cImxheW91dF9jaGlwc1wiXScgKSB8fFxyXG5cdFx0XHRcdFx0XHRcdFx0ICB0aGlzLnBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcuaW5zcGVjdG9yX19yb3ctLWxheW91dC1jaGlwcyAud3BiY19iZmJfX2xheW91dF9jaGlwcycgKSB8fFxyXG5cdFx0XHRcdFx0XHRcdFx0ICB0aGlzLnBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcjd3BiY19iZmJfX2xheW91dF9jaGlwc19ob3N0JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgaGFzQ2hpcHMgPVxyXG5cdFx0XHRcdFx0XHRcdFx0ICAhIXRoaXMucGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fbGF5b3V0X2NoaXAnICk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICFoYXNDaGlwcyApIHtcclxuXHRcdFx0XHRcdFx0XHQvLyBDcmVhdGUgYSBob3N0IGlmIG1pc3NpbmcgYW5kIHJlbmRlciBjaGlwcyBpbnRvIGl0LlxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGhvc3QgPSAoZnVuY3Rpb24gZW5zdXJlSG9zdChyb290KSB7XHJcblx0XHRcdFx0XHRcdFx0XHRsZXQgaCA9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtYmZiLXNsb3Q9XCJsYXlvdXRfY2hpcHNcIl0nICkgfHxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3IoICcuaW5zcGVjdG9yX19yb3ctLWxheW91dC1jaGlwcyAud3BiY19iZmJfX2xheW91dF9jaGlwcycgKSB8fFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJvb3QucXVlcnlTZWxlY3RvciggJyN3cGJjX2JmYl9fbGF5b3V0X2NoaXBzX2hvc3QnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRpZiAoIGggKSByZXR1cm4gaDtcclxuXHRcdFx0XHRcdFx0XHRcdC8vIEZhbGxiYWNrIGhvc3QgaW5zaWRlIChvciBhZnRlcikgdGhlIOKAnGxheW91dOKAnSBncm91cFxyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZmllbGRzICAgID1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQgIHJvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ncm91cFtkYXRhLWdyb3VwPVwibGF5b3V0XCJdIC5ncm91cF9fZmllbGRzJyApIHx8XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0ICByb290LnF1ZXJ5U2VsZWN0b3IoICcuZ3JvdXBfX2ZpZWxkcycgKSB8fCByb290O1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3Qgcm93ICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdFx0XHRcdFx0XHRcdHJvdy5jbGFzc05hbWUgICA9ICdpbnNwZWN0b3JfX3JvdyBpbnNwZWN0b3JfX3Jvdy0tbGF5b3V0LWNoaXBzJztcclxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGxhYiAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsYWJlbCcgKTtcclxuXHRcdFx0XHRcdFx0XHRcdGxhYi5jbGFzc05hbWUgICA9ICdpbnNwZWN0b3JfX2xhYmVsJztcclxuXHRcdFx0XHRcdFx0XHRcdGxhYi50ZXh0Q29udGVudCA9ICdMYXlvdXQnO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgY3RsICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdFx0XHRcdFx0XHRcdGN0bC5jbGFzc05hbWUgICA9ICdpbnNwZWN0b3JfX2NvbnRyb2wnO1xyXG5cdFx0XHRcdFx0XHRcdFx0aCAgICAgICAgICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRcdFx0XHRcdFx0XHRcdGguY2xhc3NOYW1lICAgICA9ICd3cGJjX2JmYl9fbGF5b3V0X2NoaXBzJztcclxuXHRcdFx0XHRcdFx0XHRcdGguc2V0QXR0cmlidXRlKCAnZGF0YS1iZmItc2xvdCcsICdsYXlvdXRfY2hpcHMnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdGwuYXBwZW5kQ2hpbGQoIGggKTtcclxuXHRcdFx0XHRcdFx0XHRcdHJvdy5hcHBlbmRDaGlsZCggbGFiICk7XHJcblx0XHRcdFx0XHRcdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIGN0bCApO1xyXG5cdFx0XHRcdFx0XHRcdFx0ZmllbGRzLmFwcGVuZENoaWxkKCByb3cgKTtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBoO1xyXG5cdFx0XHRcdFx0XHRcdH0pKCB0aGlzLnBhbmVsICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IEwgPSAody5XUEJDX0JGQl9Db3JlICYmIHcuV1BCQ19CRkJfQ29yZS5VSSAmJiB3LldQQkNfQkZCX0NvcmUuVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzKSA7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBMICYmIHR5cGVvZiBMLnJlbmRlcl9mb3Jfc2VjdGlvbiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0XHRcdGhvc3QuaW5uZXJIVE1MID0gJyc7XHJcblx0XHRcdFx0XHRcdFx0XHRMLnJlbmRlcl9mb3Jfc2VjdGlvbiggdGhpcy5idWlsZGVyLCBlbCwgaG9zdCApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBjYXRjaCggZSApeyBfd3BiYz8uZGV2Py5lcnJvciggJ1dQQkNfQkZCX0luc3BlY3RvciAtIHJlbmRlcicsIGUgKTsgfVxyXG5cclxuXHRcdFx0XHRcdHRoaXMuX3NldF9wYW5lbF9zZWN0aW9uX2NvbHMoIGVsICk7XHJcblx0XHRcdFx0XHR0aGlzLnBhbmVsLnNjcm9sbFRvcCA9IHByZXZfc2Nyb2xsO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dGhpcy5wYW5lbC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19pbnNwZWN0b3JfX2VtcHR5XCI+U2VsZWN0IGEgZmllbGQgdG8gZWRpdCBpdHMgb3B0aW9ucy48L2Rpdj4nO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRmllbGRcclxuXHRcdFx0aWYgKCAhZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkgcmV0dXJuIHRoaXMuY2xlYXIoKTtcclxuXHJcblx0XHRcdGNvbnN0IGRhdGEgPSB3LldQQkNfQkZCX0NvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBlbCApO1xyXG5cdFx0XHRjb25zdCB0eXBlID0gZGF0YS50eXBlIHx8ICd0ZXh0JztcclxuXHJcblx0XHRcdGZ1bmN0aW9uIF9nZXRfdHBsKGlkKSB7XHJcblx0XHRcdFx0aWYgKCAhdy53cCB8fCAhd3AudGVtcGxhdGUgKSByZXR1cm4gbnVsbDtcclxuXHRcdFx0XHRpZiAoICFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3RtcGwtJyArIGlkICkgKSByZXR1cm4gbnVsbDtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHdwLnRlbXBsYXRlKCBpZCApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCB0cGxfaWQgICAgICA9IGB3cGJjLWJmYi1pbnNwZWN0b3ItJHt0eXBlfWA7XHJcblx0XHRcdGNvbnN0IHRwbCAgICAgICAgID0gX2dldF90cGwoIHRwbF9pZCApO1xyXG5cdFx0XHRjb25zdCBnZW5lcmljX3RwbCA9IF9nZXRfdHBsKCAnd3BiYy1iZmItaW5zcGVjdG9yLWdlbmVyaWMnICk7XHJcblxyXG5cdFx0XHRjb25zdCBzY2hlbWFzICAgICAgICAgPSB3LldQQkNfQkZCX1NjaGVtYXMgfHwge307XHJcblx0XHRcdGNvbnN0IHNjaGVtYV9mb3JfdHlwZSA9IHNjaGVtYXNbdHlwZV0gfHwgbnVsbDtcclxuXHRcdFx0Y29uc3QgRmFjdG9yeSAgICAgICAgID0gdy5XUEJDX0JGQl9Db3JlLlVJICYmIHcuV1BCQ19CRkJfQ29yZS5VSS5XUEJDX0JGQl9JbnNwZWN0b3JfRmFjdG9yeTtcclxuXHJcblx0XHRcdGlmICggdHBsICkge1xyXG5cdFx0XHRcdC8vIE5FVzogbWVyZ2Ugc2NoZW1hIGRlZmF1bHRzIHNvIG1pc3Npbmcga2V5cyAoZXNwLiBib29sZWFucykgaG9ub3IgZGVmYXVsdHMgb24gZmlyc3QgcGFpbnRcclxuXHRcdFx0XHRjb25zdCBoYXNPd24gPSBGdW5jdGlvbi5jYWxsLmJpbmQoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkgKTtcclxuXHRcdFx0XHRjb25zdCBwcm9wcyAgPSAoc2NoZW1hX2Zvcl90eXBlICYmIHNjaGVtYV9mb3JfdHlwZS5zY2hlbWEgJiYgc2NoZW1hX2Zvcl90eXBlLnNjaGVtYS5wcm9wcykgPyBzY2hlbWFfZm9yX3R5cGUuc2NoZW1hLnByb3BzIDoge307XHJcblx0XHRcdFx0Y29uc3QgbWVyZ2VkID0geyAuLi5kYXRhIH07XHJcblx0XHRcdFx0aWYgKCBwcm9wcyApIHtcclxuXHRcdFx0XHRcdE9iamVjdC5rZXlzKCBwcm9wcyApLmZvckVhY2goIChrKSA9PiB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IG1ldGEgPSBwcm9wc1trXSB8fCB7fTtcclxuXHRcdFx0XHRcdFx0aWYgKCAhaGFzT3duKCBkYXRhLCBrICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBoYXNPd24oIG1ldGEsICdkZWZhdWx0JyApICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gQ29lcmNlIGJvb2xlYW5zIHRvIGEgcmVhbCBib29sZWFuOyBsZWF2ZSBvdGhlcnMgYXMtaXNcclxuXHRcdFx0XHRcdFx0XHRcdG1lcmdlZFtrXSA9IChtZXRhLnR5cGUgPT09ICdib29sZWFuJykgPyAhIW1ldGEuZGVmYXVsdCA6IG1ldGEuZGVmYXVsdDtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIG1ldGEudHlwZSA9PT0gJ2Jvb2xlYW4nICkge1xyXG5cdFx0XHRcdFx0XHRcdC8vIEV4cGxpY2l0IGVtcHR5IHZhbHVlcyBhcmUgbGVnYWN5IHVuY2hlY2tlZCBib29sZWFucywgbm90IG1pc3NpbmcgZGVmYXVsdHMuXHJcblx0XHRcdFx0XHRcdFx0bWVyZ2VkW2tdID0gdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX1Nhbml0aXplLmNvZXJjZV9ib29sZWFuKCBkYXRhW2tdLCBmYWxzZSApO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCBkYXRhW2tdID09PSAnJyAmJiBoYXNPd24oIG1ldGEsICdkZWZhdWx0JyApICkge1xyXG5cdFx0XHRcdFx0XHRcdG1lcmdlZFtrXSA9IG1ldGEuZGVmYXVsdDtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0aGlzLnBhbmVsLmlubmVySFRNTCA9IHRwbCggbWVyZ2VkICk7XHJcblxyXG5cdFx0XHRcdHRoaXMuX3Bvc3RfcmVuZGVyX3VpKCk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIHNjaGVtYV9mb3JfdHlwZSAmJiBGYWN0b3J5ICkge1xyXG5cdFx0XHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gJyc7XHJcblx0XHRcdFx0RmFjdG9yeS5yZW5kZXIoXHJcblx0XHRcdFx0XHR0aGlzLnBhbmVsLFxyXG5cdFx0XHRcdFx0c2NoZW1hX2Zvcl90eXBlLFxyXG5cdFx0XHRcdFx0eyAuLi5kYXRhIH0sXHJcblx0XHRcdFx0XHR7IGVsLCBidWlsZGVyOiB0aGlzLmJ1aWxkZXIsIHR5cGUsIHRpdGxlOiBkYXRhLmxhYmVsIHx8ICcnIH1cclxuXHRcdFx0XHQpO1xyXG5cdFx0XHRcdC8vIEVuc3VyZSB0b2dnbGUgbm9ybWFsaXplcnMgYW5kIHNsaWRlci9udW1iZXIvdW5pdCB3aXJpbmcgYXJlIGF0dGFjaGVkLlxyXG5cdFx0XHRcdHRoaXMuX3Bvc3RfcmVuZGVyX3VpKCk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIGdlbmVyaWNfdHBsICkge1xyXG5cdFx0XHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gZ2VuZXJpY190cGwoIHsgLi4uZGF0YSB9ICk7XHJcblx0XHRcdFx0dGhpcy5fcG9zdF9yZW5kZXJfdWkoKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0Y29uc3QgbXNnICAgICAgICAgICAgPSBgVGhlcmUgYXJlIG5vIEluc3BlY3RvciB3cC50ZW1wbGF0ZSBcIiR7dHBsX2lkfVwiIG9yIFNjaGVtYSBmb3IgdGhpcyBcIiR7U3RyaW5nKCB0eXBlIHx8ICcnICl9XCIgZWxlbWVudC5gO1xyXG5cdFx0XHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gJyc7XHJcblx0XHRcdFx0Y29uc3QgZGl2ICAgICAgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0XHRcdGRpdi5jbGFzc05hbWUgICAgICAgID0gJ3dwYmNfYmZiX19pbnNwZWN0b3JfX2VtcHR5JztcclxuXHRcdFx0XHRkaXYudGV4dENvbnRlbnQgICAgICA9IG1zZzsgLy8gc2FmZS5cclxuXHRcdFx0XHR0aGlzLnBhbmVsLmFwcGVuZENoaWxkKCBkaXYgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5fZW5mb3JjZV9kZWZhdWx0X2dyb3VwX29wZW4oKTtcclxuXHRcdFx0dGhpcy5wYW5lbC5zY3JvbGxUb3AgPSBwcmV2X3Njcm9sbDtcclxuXHRcdH1cclxuXHJcblx0XHRfZW5mb3JjZV9kZWZhdWx0X2dyb3VwX29wZW4oKSB7XHJcblx0XHRcdGNvbnN0IGdyb3VwcyA9IEFycmF5LmZyb20oIHRoaXMucGFuZWwucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ncm91cCcgKSApO1xyXG5cdFx0XHRpZiAoICFncm91cHMubGVuZ3RoICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0bGV0IGZvdW5kID0gZmFsc2U7XHJcblx0XHRcdGdyb3Vwcy5mb3JFYWNoKCAoZykgPT4ge1xyXG5cdFx0XHRcdGlmICggIWZvdW5kICYmIGcuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtb3BlbicgKSApIHtcclxuXHRcdFx0XHRcdGZvdW5kID0gdHJ1ZTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aWYgKCBnLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nICkgKSB7XHJcblx0XHRcdFx0XHRcdGcuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLW9wZW4nICk7XHJcblx0XHRcdFx0XHRcdGcuZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KCAnd3BiYzpjb2xsYXBzaWJsZTpjbG9zZScsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGcuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLW9wZW4nICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRpZiAoICFmb3VuZCApIHtcclxuXHRcdFx0XHRncm91cHNbMF0uY2xhc3NMaXN0LmFkZCggJ2lzLW9wZW4nICk7XHJcblx0XHRcdFx0Z3JvdXBzWzBdLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ3dwYmM6Y29sbGFwc2libGU6b3BlbicsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2V0IGRhdGEtYmZiLXNlY3Rpb24tY29scyBvbiB0aGUgaW5zcGVjdG9yIHBhbmVsIGJhc2VkIG9uIHRoZSBjdXJyZW50IHNlY3Rpb24uXHJcblx0XHQgKiBVc2VzIHRoZSByZWdpc3RlcmVkIGNvbXB1dGUgZm4gaWYgYXZhaWxhYmxlOyBmYWxscyBiYWNrIHRvIGRpcmVjdCBET00uXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uRWxcclxuXHRcdCAqL1xyXG5cdFx0X3NldF9wYW5lbF9zZWN0aW9uX2NvbHMoc2VjdGlvbkVsKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Ly8gUHJlZmVyIHRoZSBhbHJlYWR5LXJlZ2lzdGVyZWQgdmFsdWVfZnJvbSBoZWxwZXIgaWYgcHJlc2VudC5cclxuXHRcdFx0XHR2YXIgY29tcHV0ZSA9IHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3RvcnlfdmFsdWVfZnJvbSAmJiB3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3ZhbHVlX2Zyb20uY29tcHV0ZV9zZWN0aW9uX2NvbHVtbnM7XHJcblxyXG5cdFx0XHRcdHZhciBjb2xzID0gMTtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBjb21wdXRlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0Y29scyA9IGNvbXB1dGUoIHsgZWw6IHNlY3Rpb25FbCB9ICkgfHwgMTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Ly8gRmFsbGJhY2s6IGNvbXB1dGUgZGlyZWN0bHkgZnJvbSB0aGUgRE9NLlxyXG5cdFx0XHRcdFx0dmFyIHJvdyA9IHNlY3Rpb25FbCAmJiBzZWN0aW9uRWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRcdFx0Y29scyAgICA9IHJvdyA/IChyb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uJyApLmxlbmd0aCB8fCAxKSA6IDE7XHJcblx0XHRcdFx0XHRpZiAoIGNvbHMgPCAxICkgY29scyA9IDE7XHJcblx0XHRcdFx0XHRpZiAoIGNvbHMgPiA0ICkgY29scyA9IDQ7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMucGFuZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1iZmItc2VjdGlvbi1jb2xzJywgU3RyaW5nKCBjb2xzICkgKTtcclxuXHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0X2NyZWF0ZV9mYWxsYmFja19wYW5lbCgpIHtcclxuXHRcdFx0Y29uc3QgcCAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdFx0XHRwLmlkICAgICAgICA9ICd3cGJjX2JmYl9faW5zcGVjdG9yJztcclxuXHRcdFx0cC5jbGFzc05hbWUgPSAnd3BiY19iZmJfX2luc3BlY3Rvcic7XHJcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHAgKTtcclxuXHRcdFx0cmV0dXJuIC8qKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9ICovIChwKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIEV4cG9ydCBjbGFzcyArIHJlYWR5IHNpZ25hbC5cclxuXHR3LldQQkNfQkZCX0luc3BlY3RvciA9IFdQQkNfQkZCX0luc3BlY3RvcjtcclxuXHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknICkgKTtcclxuXHJcbn0pKCB3aW5kb3cgKTtcclxuIl19
