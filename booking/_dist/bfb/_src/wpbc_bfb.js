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
		 *     string }} [opts={}] - Visual/behavior options.
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
			this._dragState = null;
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
					this._dragState = null;
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
		 *  -- Draggable gate: draggable: '.wpbc_bfb__field:not([data-draggable="false"]), .wpbc_bfb__section'
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
				// Add body/html flags so you can style differently when dragging from palette.
				onStart: (evt) => {
					this.builder?._add_dragging_class?.();

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
				scroll               : true,
				scrollSensitivity    : 40,
				scrollSpeed          : 10,
				/**
				 * Enter/leave hysteresis for cross-column moves.    Only allow dropping into `to` when the pointer is
				 * well inside it.
				 */
				onMove: (evt, originalEvent) => {

					const { to, from } = evt;
					if ( ! to || ! from ) {
						return true;
					}

					const in_preview_canvas = !! to.closest( '.wpbc_bfb__panel--preview' );
					if ( ! in_preview_canvas ) {
						return true;
					}

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
					this.builder?._add_dragging_class?.();
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
			if ( !overlay.querySelector( '.wpbc_bfb__settings-btn' ) ) {
				const settings_btn   = Core.WPBC_Form_Builder_Helper.create_element( 'button', 'wpbc_bfb__settings-btn', '<i class="menu_icon icon-1x wpbc_icn_settings"></i>' );
				settings_btn.type    = 'button';
				settings_btn.title   = 'Open settings';
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
		}

		destroy() {
			this.builder.bus.off( Core.WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear );

			if ( this._on_canvas_click ) {
				this.builder.pages_container.removeEventListener( 'click', this._on_canvas_click, true );
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
					'deselect' : 'wpbc_icn_remove_done',
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImJmYi1jb3JlLmpzIiwiYmZiLWZpZWxkcy5qcyIsImJmYi11aS5qcyIsImJmYi1zeW5jLWNvZGUtdG9vbHMtdGFiLmpzIiwiYmZiLWluc3BlY3Rvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDci9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoid3BiY19iZmIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19vdXQvY29yZS9iZmItY29yZS5qcyA9PSB8IDIwMjUtMDktMTAgMTU6NDdcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAoIHcgKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvLyBTaW5nbGUgZ2xvYmFsIG5hbWVzcGFjZSAoaWRlbXBvdGVudCAmIGxvYWQtb3JkZXIgc2FmZSkuXHJcblx0Y29uc3QgQ29yZSA9ICggdy5XUEJDX0JGQl9Db3JlID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9ICk7XHJcblx0Y29uc3QgVUkgICA9ICggQ29yZS5VSSA9IENvcmUuVUkgfHwge30gKTtcclxuXHJcblx0LyoqXHJcblx0ICogQ29yZSBzYW5pdGl6ZS9lc2NhcGUvbm9ybWFsaXplIGhlbHBlcnMuXHJcblx0ICogQWxsIG1ldGhvZHMgdXNlIHNuYWtlX2Nhc2U7IGNhbWVsQ2FzZSBhbGlhc2VzIGFyZSBwcm92aWRlZCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9TYW5pdGl6ZSA9IGNsYXNzIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVzY2FwZSB0ZXh0IGZvciBzYWZlIHVzZSBpbiBDU1Mgc2VsZWN0b3JzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHMgLSByYXcgc2VsZWN0b3IgZnJhZ21lbnRcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlc2NfY3NzKHMpIHtcclxuXHRcdFx0cmV0dXJuICh3LkNTUyAmJiB3LkNTUy5lc2NhcGUpID8gdy5DU1MuZXNjYXBlKCBTdHJpbmcoIHMgKSApIDogU3RyaW5nKCBzICkucmVwbGFjZSggLyhbXlxcdy1dKS9nLCAnXFxcXCQxJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXNjYXBlIGEgdmFsdWUgZm9yIGF0dHJpYnV0ZSBzZWxlY3RvcnMsIGUuZy4gW2RhdGEtaWQ9XCI8dmFsdWU+XCJdLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3Iodikge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2IClcclxuXHRcdFx0XHQucmVwbGFjZSggL1xcXFwvZywgJ1xcXFxcXFxcJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cIi9nLCAnXFxcXFwiJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cXG4vZywgJ1xcXFxBICcgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvXFxdL2csICdcXFxcXScgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNhbml0aXplIGludG8gYSBicm9hZGx5IGNvbXBhdGlibGUgSFRNTCBpZDogbGV0dGVycywgZGlnaXRzLCAtIF8gOiAuIDsgbXVzdCBzdGFydCB3aXRoIGEgbGV0dGVyLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHZcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzYW5pdGl6ZV9odG1sX2lkKHYpIHtcclxuXHRcdFx0bGV0IHMgPSAodiA9PSBudWxsID8gJycgOiBTdHJpbmcoIHYgKSkudHJpbSgpO1xyXG5cdFx0XHRzICAgICA9IHNcclxuXHRcdFx0XHQucmVwbGFjZSggL1xccysvZywgJy0nIClcclxuXHRcdFx0XHQucmVwbGFjZSggL1teQS1aYS16MC05XFwtX1xcOi5dL2csICctJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8tKy9nLCAnLScgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvXlstXy46XSt8Wy1fLjpdKyQvZywgJycgKTtcclxuXHRcdFx0aWYgKCAhcyApIHJldHVybiAnZmllbGQnO1xyXG5cdFx0XHRpZiAoICEvXltBLVphLXpdLy50ZXN0KCBzICkgKSBzID0gJ2YtJyArIHM7XHJcblx0XHRcdHJldHVybiBzO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2FuaXRpemUgaW50byBhIHNhZmUgSFRNTCBuYW1lIHRva2VuOiBsZXR0ZXJzLCBkaWdpdHMsIF8gLVxyXG5cdFx0ICogTXVzdCBzdGFydCB3aXRoIGEgbGV0dGVyOyBubyBkb3RzL2JyYWNrZXRzL3NwYWNlcy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2FuaXRpemVfaHRtbF9uYW1lKHYpIHtcclxuXHJcblx0XHRcdGxldCBzID0gKHYgPT0gbnVsbCA/ICcnIDogU3RyaW5nKCB2ICkpLnRyaW0oKTtcclxuXHJcblx0XHRcdHMgPSBzLnJlcGxhY2UoIC9cXHMrL2csICdfJyApLnJlcGxhY2UoIC9bXkEtWmEtejAtOV8tXS9nLCAnXycgKS5yZXBsYWNlKCAvXysvZywgJ18nICk7XHJcblxyXG5cdFx0XHRpZiAoICEgcyApIHtcclxuXHRcdFx0XHRzID0gJ2ZpZWxkJztcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICEgL15bQS1aYS16XS8udGVzdCggcyApICkge1xyXG5cdFx0XHRcdHMgPSAnZl8nICsgcztcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gcztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVzY2FwZSBmb3IgSFRNTCB0ZXh0L2F0dHJpYnV0ZXMgKG5vdCBVUkxzKS5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZXNjYXBlX2h0bWwodikge1xyXG5cdFx0XHRpZiAoIHYgPT0gbnVsbCApIHtcclxuXHRcdFx0XHRyZXR1cm4gJyc7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIFN0cmluZyggdiApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8mL2csICcmYW1wOycgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvXCIvZywgJyZxdW90OycgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvJy9nLCAnJiMwMzk7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC88L2csICcmbHQ7JyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8+L2csICcmZ3Q7JyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRXNjYXBlIG1pbmltYWwgc2V0IGZvciBhdHRyaWJ1dGUtc2FmZXR5IHdpdGhvdXQgc2x1Z2dpbmcuXHJcblx0XHQgKiBLZWVwcyBvcmlnaW5hbCBodW1hbiB0ZXh0OyBlc2NhcGVzICYsIDwsID4sIFwiIGFuZCAnIG9ubHkuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc1xyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGVzY2FwZV92YWx1ZV9mb3JfYXR0cihzKSB7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoIHMgPT0gbnVsbCA/ICcnIDogcyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8mL2csICcmYW1wOycgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvPC9nLCAnJmx0OycgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvPi9nLCAnJmd0OycgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvXCIvZywgJyZxdW90OycgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvJy9nLCAnJiMzOTsnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTYW5pdGl6ZSBhIHNwYWNlLXNlcGFyYXRlZCBDU1MgY2xhc3MgbGlzdC5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2FuaXRpemVfY3NzX2NsYXNzbGlzdCh2KSB7XHJcblx0XHRcdGlmICggdiA9PSBudWxsICkgcmV0dXJuICcnO1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ICkucmVwbGFjZSggL1teXFx3XFwtIF0rL2csICcgJyApLnJlcGxhY2UoIC9cXHMrL2csICcgJyApLnRyaW0oKTtcclxuXHRcdH1cclxuLy8gPT0gTkVXID09XHJcblx0XHQvKipcclxuXHRcdCAqIFR1cm4gYW4gYXJiaXRyYXJ5IHZhbHVlIGludG8gYSBjb25zZXJ2YXRpdmUgXCJ0b2tlblwiICh1bmRlcnNjb3JlcywgaHlwaGVucyBhbGxvd2VkKS5cclxuXHRcdCAqIFVzZWZ1bCBmb3Igc2hvcnRjb2RlIHRva2VucywgaWRzIGluIHBsYWluIHRleHQsIGV0Yy5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgdG9fdG9rZW4odikge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ID8/ICcnIClcclxuXHRcdFx0XHQudHJpbSgpXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9cXHMrL2csICdfJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9bXkEtWmEtejAtOV9cXC1dL2csICcnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb252ZXJ0IHRvIGtlYmFiLWNhc2UgKGxldHRlcnMsIGRpZ2l0cywgaHlwaGVucykuXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHRvX2tlYmFiKHYpIHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggdiA/PyAnJyApXHJcblx0XHRcdFx0LnRyaW0oKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvW19cXHNdKy9nLCAnLScgKVxyXG5cdFx0XHRcdC5yZXBsYWNlKCAvW15BLVphLXowLTktXS9nLCAnJyApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC8tKy9nLCAnLScgKVxyXG5cdFx0XHRcdC50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVHJ1dGh5IG5vcm1hbGl6YXRpb24gZm9yIGZvcm0tbGlrZSBpbnB1dHM6IHRydWUsICd0cnVlJywgMSwgJzEnLCAneWVzJywgJ29uJy5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGlzX3RydXRoeSh2KSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHYgPT09ICdib29sZWFuJyApIHJldHVybiB2O1xyXG5cdFx0XHRjb25zdCBzID0gU3RyaW5nKCB2ID8/ICcnICkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdHJldHVybiBzID09PSAndHJ1ZScgfHwgcyA9PT0gJzEnIHx8IHMgPT09ICd5ZXMnIHx8IHMgPT09ICdvbic7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDb2VyY2UgdG8gYm9vbGVhbiB3aXRoIGFuIG9wdGlvbmFsIGRlZmF1bHQgZm9yIGVtcHR5IHZhbHVlcy5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZWY9ZmFsc2VdXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGNvZXJjZV9ib29sZWFuKHYsIGRlZiA9IGZhbHNlKSB7XHJcblx0XHRcdGlmICggdiA9PSBudWxsIHx8IHYgPT09ICcnICkgcmV0dXJuIGRlZjtcclxuXHRcdFx0cmV0dXJuIHRoaXMuaXNfdHJ1dGh5KCB2ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBhIFwicGVyY2VudC1saWtlXCIgdmFsdWUgKCczMyd8JzMzJSd8MzMpIHdpdGggZmFsbGJhY2suXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ8bnVsbHx1bmRlZmluZWR9IHZcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBmYWxsYmFja192YWx1ZVxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHBhcnNlX3BlcmNlbnQodiwgZmFsbGJhY2tfdmFsdWUpIHtcclxuXHRcdFx0aWYgKCB2ID09IG51bGwgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbGxiYWNrX3ZhbHVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHMgPSBTdHJpbmcoIHYgKS50cmltKCk7XHJcblx0XHRcdGNvbnN0IG4gPSBwYXJzZUZsb2F0KCBzLnJlcGxhY2UoIC8lL2csICcnICkgKTtcclxuXHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gbiA6IGZhbGxiYWNrX3ZhbHVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2xhbXAgYSBudW1iZXIgdG8gdGhlIFttaW4sIG1heF0gcmFuZ2UuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gblxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IG1pblxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IG1heFxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGNsYW1wKG4sIG1pbiwgbWF4KSB7XHJcblx0XHRcdHJldHVybiBNYXRoLm1heCggbWluLCBNYXRoLm1pbiggbWF4LCBuICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVzY2FwZSBhIHZhbHVlIGZvciBpbmNsdXNpb24gaW5zaWRlIGEgcXVvdGVkIEhUTUwgYXR0cmlidXRlIChkb3VibGUgcXVvdGVzKS5cclxuXHRcdCAqIFJlcGxhY2VzIG5ld2xpbmVzIHdpdGggc3BhY2VzIGFuZCBkb3VibGUgcXVvdGVzIHdpdGggc2luZ2xlIHF1b3Rlcy5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZXNjYXBlX2Zvcl9hdHRyX3F1b3RlZCh2KSB7XHJcblx0XHRcdGlmICggdiA9PSBudWxsICkgcmV0dXJuICcnO1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCB2ICkucmVwbGFjZSggL1xccj9cXG4vZywgJyAnICkucmVwbGFjZSggL1wiL2csICdcXCcnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFc2NhcGUgZm9yIHNob3J0Y29kZS1saWtlIHRva2VucyB3aGVyZSBkb3VibGUgcXVvdGVzIGFuZCBuZXdsaW5lcyBzaG91bGQgYmUgbmV1dHJhbGl6ZWQuXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gdlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGVzY2FwZV9mb3Jfc2hvcnRjb2RlKHYpIHtcclxuXHRcdFx0cmV0dXJuIFN0cmluZyggdiA/PyAnJyApLnJlcGxhY2UoIC9cIi9nLCAnXFxcXFwiJyApLnJlcGxhY2UoIC9cXHI/XFxuL2csICcgJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSlNPTi5wYXJzZSB3aXRoIGZhbGxiYWNrIChubyB0aHJvdykuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc1xyXG5cdFx0ICogQHBhcmFtIHthbnl9IFtmYWxsYmFjaz1udWxsXVxyXG5cdFx0ICogQHJldHVybnMge2FueX1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNhZmVfanNvbl9wYXJzZShzLCBmYWxsYmFjayA9IG51bGwpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRyZXR1cm4gSlNPTi5wYXJzZSggcyApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsbGJhY2s7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN0cmluZ2lmeSBkYXRhLSogYXR0cmlidXRlIHZhbHVlIHNhZmVseSAob2JqZWN0cyAtPiBKU09OLCBvdGhlcnMgLT4gU3RyaW5nKS5cclxuXHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc3RyaW5naWZ5X2RhdGFfdmFsdWUodikge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB2ID09PSAnb2JqZWN0JyAmJiB2ICE9PSBudWxsICkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoIHYgKTtcclxuXHRcdFx0XHR9IGNhdGNoIHtcclxuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDOiBzdHJpbmdpZnlfZGF0YV92YWx1ZScgKTtcclxuXHRcdFx0XHRcdHJldHVybiAnJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIFN0cmluZyggdiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIFN0cmljdCB2YWx1ZSBndWFyZHMgZm9yIENTUyBsZW5ndGhzIGFuZCBoZXggY29sb3JzIChkZWZlbnNlLWluLWRlcHRoKS5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8qKlxyXG5cdFx0ICogU2FuaXRpemUgYSBDU1MgbGVuZ3RoLiBBbGxvd3M6IHB4LCAlLCByZW0sIGVtIChsb3dlci91cHBlcikuXHJcblx0XHQgKiBSZXR1cm5zIGZhbGxiYWNrIGlmIGludmFsaWQuXHJcblx0XHQgKiBAcGFyYW0ge2FueX0gdlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtmYWxsYmFjaz0nMTAwJSddXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgc2FuaXRpemVfY3NzX2xlbih2LCBmYWxsYmFjayA9ICcxMDAlJykge1xyXG5cdFx0XHRjb25zdCBzID0gU3RyaW5nKCB2ID8/ICcnICkudHJpbSgpO1xyXG5cdFx0XHRjb25zdCBtID0gcy5tYXRjaCggL14oLT9cXGQrKD86XFwuXFxkKyk/KShweHwlfHJlbXxlbSkkL2kgKTtcclxuXHRcdFx0cmV0dXJuIG0gPyBtWzBdIDogU3RyaW5nKCBmYWxsYmFjayApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2FuaXRpemUgYSBoZXggY29sb3IuIEFsbG93cyAjcmdiIG9yICNycmdnYmIgKGNhc2UtaW5zZW5zaXRpdmUpLlxyXG5cdFx0ICogUmV0dXJucyBmYWxsYmFjayBpZiBpbnZhbGlkLlxyXG5cdFx0ICogQHBhcmFtIHthbnl9IHZcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBbZmFsbGJhY2s9JyNlMGUwZTAnXVxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNhbml0aXplX2hleF9jb2xvcih2LCBmYWxsYmFjayA9ICcjZTBlMGUwJykge1xyXG5cdFx0XHRjb25zdCBzID0gU3RyaW5nKCB2ID8/ICcnICkudHJpbSgpO1xyXG5cdFx0XHRyZXR1cm4gL14jKD86WzAtOWEtZl17M318WzAtOWEtZl17Nn0pJC9pLnRlc3QoIHMgKSA/IHMgOiBTdHJpbmcoIGZhbGxiYWNrICk7XHJcblx0XHR9XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogV1BCQyBJRCAvIE5hbWUgc2VydmljZS4gR2VuZXJhdGVzLCBzYW5pdGl6ZXMsIGFuZCBlbnN1cmVzIHVuaXF1ZW5lc3MgZm9yIGZpZWxkIGlkcy9uYW1lcy9odG1sX2lkcyB3aXRoaW4gdGhlXHJcblx0ICogY2FudmFzLlxyXG5cdCAqL1xyXG5cdENvcmUuV1BCQ19CRkJfSWRTZXJ2aWNlID0gY2xhc3MgIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbnN0cnVjdG9yLiBTZXQgcm9vdCBjb250YWluZXIgb2YgdGhlIGZvcm0gcGFnZXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFnZXNfY29udGFpbmVyIC0gUm9vdCBjb250YWluZXIgb2YgdGhlIGZvcm0gcGFnZXMuXHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKCBwYWdlc19jb250YWluZXIgKSB7XHJcblx0XHRcdHRoaXMucGFnZXNfY29udGFpbmVyID0gcGFnZXNfY29udGFpbmVyO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW5zdXJlIGEgdW5pcXVlICoqaW50ZXJuYWwqKiBmaWVsZCBpZCAoc3RvcmVkIGluIGRhdGEtaWQpIHdpdGhpbiB0aGUgY2FudmFzLlxyXG5cdFx0ICogU3RhcnRzIGZyb20gYSBkZXNpcmVkIGlkIChhbHJlYWR5IHNhbml0aXplZCBvciBub3QpIGFuZCBhcHBlbmRzIHN1ZmZpeGVzIGlmIG5lZWRlZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYmFzZUlkIC0gRGVzaXJlZCBpZC5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IFVuaXF1ZSBpZC5cclxuXHRcdCAqL1xyXG5cdFx0ZW5zdXJlX3VuaXF1ZV9maWVsZF9pZChiYXNlSWQsIGN1cnJlbnRFbCA9IG51bGwpIHtcclxuXHRcdFx0Y29uc3QgYmFzZSAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9pZCggYmFzZUlkICk7XHJcblx0XHRcdGxldCBpZCAgICAgICAgPSBiYXNlIHx8ICdmaWVsZCc7XHJcblx0XHRcdGNvbnN0IGVzYyAgICAgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IoIHYgKTtcclxuXHRcdFx0Y29uc3QgZXNjVWlkICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdiApO1xyXG5cdFx0XHRjb25zdCBub3RTZWxmID0gY3VycmVudEVsPy5kYXRhc2V0Py51aWQgPyBgOm5vdChbZGF0YS11aWQ9XCIke2VzY1VpZCggY3VycmVudEVsLmRhdGFzZXQudWlkICl9XCJdKWAgOiAnJztcclxuXHRcdFx0d2hpbGUgKCB0aGlzLnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcihcclxuXHRcdFx0XHRgLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkJHtub3RTZWxmfVtkYXRhLWlkPVwiJHtlc2MoaWQpfVwiXSwgLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX3NlY3Rpb24ke25vdFNlbGZ9W2RhdGEtaWQ9XCIke2VzYyhpZCl9XCJdYFxyXG5cdFx0XHQpICkge1xyXG5cdFx0XHRcdC8vIEV4Y2x1ZGVzIHNlbGYgYnkgZGF0YS11aWQgLlxyXG5cdFx0XHRcdGNvbnN0IGZvdW5kID0gdGhpcy5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvciggYC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZFtkYXRhLWlkPVwiJHtlc2MoIGlkICl9XCJdLCAud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fc2VjdGlvbltkYXRhLWlkPVwiJHtlc2MoIGlkICl9XCJdYCApO1xyXG5cdFx0XHRcdGlmICggZm91bmQgJiYgY3VycmVudEVsICYmIGZvdW5kID09PSBjdXJyZW50RWwgKSB7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWQgPSBgJHtiYXNlIHx8ICdmaWVsZCd9LSR7TWF0aC5yYW5kb20oKS50b1N0cmluZyggMzYgKS5zbGljZSggMiwgNSApfWA7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGlkO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW5zdXJlIGEgdW5pcXVlIEhUTUwgbmFtZSBhY3Jvc3MgdGhlIGZvcm0uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGJhc2UgLSBEZXNpcmVkIGJhc2UgbmFtZSAodW4vc2FuaXRpemVkKS5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gY3VycmVudEVsIC0gSWYgcHJvdmlkZWQsIGlnbm9yZSBjb25mbGljdHMgd2l0aCB0aGlzIGVsZW1lbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBVbmlxdWUgbmFtZS5cclxuXHRcdCAqL1xyXG5cdFx0ZW5zdXJlX3VuaXF1ZV9maWVsZF9uYW1lKGJhc2UsIGN1cnJlbnRFbCA9IG51bGwpIHtcclxuXHRcdFx0bGV0IG5hbWUgICAgICA9IGJhc2UgfHwgJ2ZpZWxkJztcclxuXHRcdFx0Y29uc3QgZXNjICAgICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdiApO1xyXG5cdFx0XHRjb25zdCBlc2NVaWQgID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCB2ICk7XHJcblx0XHRcdC8vIEV4Y2x1ZGUgdGhlIGN1cnJlbnQgZmllbGQgKmFuZCBhbnkgRE9NIG1pcnJvcnMgb2YgaXQqIChzYW1lIGRhdGEtdWlkKVxyXG5cdFx0XHRjb25zdCB1aWQgICAgID0gY3VycmVudEVsPy5kYXRhc2V0Py51aWQ7XHJcblx0XHRcdGNvbnN0IG5vdFNlbGYgPSB1aWQgPyBgOm5vdChbZGF0YS11aWQ9XCIke2VzY1VpZCggdWlkICl9XCJdKWAgOiAnJztcclxuXHRcdFx0d2hpbGUgKCB0cnVlICkge1xyXG5cdFx0XHRcdGNvbnN0IHNlbGVjdG9yID0gYC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZCR7bm90U2VsZn1bZGF0YS1uYW1lPVwiJHtlc2MoIG5hbWUgKX1cIl1gO1xyXG5cdFx0XHRcdGNvbnN0IGNsYXNoZXMgID0gdGhpcy5wYWdlc19jb250YWluZXI/LnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yICkgfHwgW107XHJcblx0XHRcdFx0aWYgKCBjbGFzaGVzLmxlbmd0aCA9PT0gMCApIGJyZWFrOyAgICAgICAgICAgLy8gbm9ib2R5IGVsc2UgdXNlcyB0aGlzIG5hbWVcclxuXHRcdFx0XHRjb25zdCBtID0gbmFtZS5tYXRjaCggLy0oXFxkKykkLyApO1xyXG5cdFx0XHRcdG5hbWUgICAgPSBtID8gbmFtZS5yZXBsYWNlKCAvLVxcZCskLywgJy0nICsgKE51bWJlciggbVsxXSApICsgMSkgKSA6IGAke2Jhc2V9LTJgO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBuYW1lO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2V0IGZpZWxkJ3MgSU5URVJOQUwgaWQgKGRhdGEtaWQpIG9uIGFuIGVsZW1lbnQuIEVuc3VyZXMgdW5pcXVlbmVzcyBhbmQgb3B0aW9uYWxseSBhc2tzIGNhbGxlciB0byByZWZyZXNoXHJcblx0XHQgKiBwcmV2aWV3LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGZpZWxkX2VsIC0gRmllbGQgZWxlbWVudCBpbiB0aGUgY2FudmFzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG5ld0lkUmF3IC0gRGVzaXJlZCBpZCAodW4vc2FuaXRpemVkKS5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW3JlbmRlclByZXZpZXc9ZmFsc2VdIC0gQ2FsbGVyIGNhbiBkZWNpZGUgdG8gcmUtcmVuZGVyIHByZXZpZXcuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBBcHBsaWVkIHVuaXF1ZSBpZC5cclxuXHRcdCAqL1xyXG5cdFx0c2V0X2ZpZWxkX2lkKCBmaWVsZF9lbCwgbmV3SWRSYXcsIHJlbmRlclByZXZpZXcgPSBmYWxzZSApIHtcclxuXHRcdFx0Y29uc3QgZGVzaXJlZCA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9pZCggbmV3SWRSYXcgKTtcclxuXHRcdFx0Y29uc3QgdW5pcXVlICA9IHRoaXMuZW5zdXJlX3VuaXF1ZV9maWVsZF9pZCggZGVzaXJlZCwgZmllbGRfZWwgKTtcclxuXHRcdFx0ZmllbGRfZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1pZCcsIHVuaXF1ZSApO1xyXG5cdFx0XHRpZiAoIHJlbmRlclByZXZpZXcgKSB7XHJcblx0XHRcdFx0Ly8gQ2FsbGVyIGRlY2lkZXMgaWYgLyB3aGVuIHRvIHJlbmRlci5cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdW5pcXVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2V0IGZpZWxkJ3MgUkVRVUlSRUQgSFRNTCBuYW1lIChkYXRhLW5hbWUpLiBFbnN1cmVzIHNhbml0aXplZCArIHVuaXF1ZSBwZXIgZm9ybS5cclxuXHRcdCAqIEZhbGxzIGJhY2sgdG8gc2FuaXRpemVkIGludGVybmFsIGlkIGlmIHVzZXIgcHJvdmlkZXMgZW1wdHkgdmFsdWUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZmllbGRfZWwgLSBGaWVsZCBlbGVtZW50IGluIHRoZSBjYW52YXMuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbmV3TmFtZVJhdyAtIERlc2lyZWQgbmFtZSAodW4vc2FuaXRpemVkKS5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW3JlbmRlclByZXZpZXc9ZmFsc2VdIC0gQ2FsbGVyIGNhbiBkZWNpZGUgdG8gcmUtcmVuZGVyIHByZXZpZXcuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBBcHBsaWVkIHVuaXF1ZSBuYW1lLlxyXG5cdFx0ICovXHJcblx0XHRzZXRfZmllbGRfbmFtZSggZmllbGRfZWwsIG5ld05hbWVSYXcsIHJlbmRlclByZXZpZXcgPSBmYWxzZSApIHtcclxuXHRcdFx0Y29uc3QgcmF3ICA9IChuZXdOYW1lUmF3ID09IG51bGwgPyAnJyA6IFN0cmluZyggbmV3TmFtZVJhdyApKS50cmltKCk7XHJcblx0XHRcdGNvbnN0IGJhc2UgPSByYXdcclxuXHRcdFx0XHQ/IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCByYXcgKVxyXG5cdFx0XHRcdDogQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX25hbWUoIGZpZWxkX2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaWQnICkgfHwgJ2ZpZWxkJyApO1xyXG5cclxuXHRcdFx0Y29uc3QgdW5pcXVlID0gdGhpcy5lbnN1cmVfdW5pcXVlX2ZpZWxkX25hbWUoIGJhc2UsIGZpZWxkX2VsICk7XHJcblx0XHRcdGZpZWxkX2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbmFtZScsIHVuaXF1ZSApO1xyXG5cdFx0XHRpZiAoIHJlbmRlclByZXZpZXcgKSB7XHJcblx0XHRcdFx0Ly8gQ2FsbGVyIGRlY2lkZXMgaWYgLyB3aGVuIHRvIHJlbmRlci5cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdW5pcXVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2V0IGZpZWxkJ3MgT1BUSU9OQUwgcHVibGljIEhUTUwgaWQgKGRhdGEtaHRtbF9pZCkuIEVtcHR5IHZhbHVlIHJlbW92ZXMgdGhlIGF0dHJpYnV0ZS5cclxuXHRcdCAqIEVuc3VyZXMgc2FuaXRpemF0aW9uICsgdW5pcXVlbmVzcyBhbW9uZyBvdGhlciBkZWNsYXJlZCBIVE1MIGlkcy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBmaWVsZF9lbCAtIEZpZWxkIGVsZW1lbnQgaW4gdGhlIGNhbnZhcy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBuZXdIdG1sSWRSYXcgLSBEZXNpcmVkIGh0bWxfaWQgKG9wdGlvbmFsKS5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW3JlbmRlclByZXZpZXc9ZmFsc2VdIC0gQ2FsbGVyIGNhbiBkZWNpZGUgdG8gcmUtcmVuZGVyIHByZXZpZXcuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgYXBwbGllZCBodG1sX2lkIG9yIGVtcHR5IHN0cmluZyBpZiByZW1vdmVkLlxyXG5cdFx0ICovXHJcblx0XHRzZXRfZmllbGRfaHRtbF9pZCggZmllbGRfZWwsIG5ld0h0bWxJZFJhdywgcmVuZGVyUHJldmlldyA9IGZhbHNlICkge1xyXG5cdFx0XHRjb25zdCByYXcgPSAobmV3SHRtbElkUmF3ID09IG51bGwgPyAnJyA6IFN0cmluZyggbmV3SHRtbElkUmF3ICkpLnRyaW0oKTtcclxuXHJcblx0XHRcdGlmICggcmF3ID09PSAnJyApIHtcclxuXHRcdFx0XHRmaWVsZF9lbC5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLWh0bWxfaWQnICk7XHJcblx0XHRcdFx0aWYgKCByZW5kZXJQcmV2aWV3ICkge1xyXG5cdFx0XHRcdFx0Ly8gQ2FsbGVyIGRlY2lkZXMgaWYgLyB3aGVuIHRvIHJlbmRlci5cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBkZXNpcmVkID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCByYXcgKTtcclxuXHRcdFx0bGV0IGh0bWxJZCAgICA9IGRlc2lyZWQ7XHJcblx0XHRcdGNvbnN0IGVzYyAgICAgPSAodikgPT4gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IoIHYgKTtcclxuXHRcdFx0Y29uc3QgZXNjVWlkICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdiApO1xyXG5cclxuXHRcdFx0d2hpbGUgKCB0cnVlICkge1xyXG5cclxuXHRcdFx0XHRjb25zdCB1aWQgICAgID0gZmllbGRfZWw/LmRhdGFzZXQ/LnVpZDtcclxuXHRcdFx0XHRjb25zdCBub3RTZWxmID0gdWlkID8gYDpub3QoW2RhdGEtdWlkPVwiJHtlc2NVaWQoIHVpZCApfVwiXSlgIDogJyc7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGNsYXNoSW5DYW52YXMgPSB0aGlzLnBhZ2VzX2NvbnRhaW5lcj8ucXVlcnlTZWxlY3RvcihcclxuXHRcdFx0XHRcdGAud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGQke25vdFNlbGZ9W2RhdGEtaHRtbF9pZD1cIiR7ZXNjKCBodG1sSWQgKX1cIl0sYCArXHJcblx0XHRcdFx0XHRgLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX3NlY3Rpb24ke25vdFNlbGZ9W2RhdGEtaHRtbF9pZD1cIiR7ZXNjKCBodG1sSWQgKX1cIl1gXHJcblx0XHRcdFx0KTtcclxuXHRcdFx0XHRjb25zdCBkb21DbGFzaCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBodG1sSWQgKTtcclxuXHJcblx0XHRcdFx0Ly8gQWxsb3cgd2hlbiB0aGUgb25seSBcImNsYXNoXCIgaXMgaW5zaWRlIHRoaXMgc2FtZSBmaWVsZCAoZS5nLiwgdGhlIGlucHV0IHlvdSBqdXN0IHJlbmRlcmVkKVxyXG5cdFx0XHRcdGNvbnN0IGRvbUNsYXNoSXNTZWxmID0gZG9tQ2xhc2ggPT09IGZpZWxkX2VsIHx8IChkb21DbGFzaCAmJiBmaWVsZF9lbC5jb250YWlucyggZG9tQ2xhc2ggKSk7XHJcblxyXG5cdFx0XHRcdGlmICggIWNsYXNoSW5DYW52YXMgJiYgKCFkb21DbGFzaCB8fCBkb21DbGFzaElzU2VsZikgKSB7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IG0gPSBodG1sSWQubWF0Y2goIC8tKFxcZCspJC8gKTtcclxuXHRcdFx0XHRodG1sSWQgID0gbSA/IGh0bWxJZC5yZXBsYWNlKCAvLVxcZCskLywgJy0nICsgKE51bWJlciggbVsxXSApICsgMSkgKSA6IGAke2Rlc2lyZWR9LTJgO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmaWVsZF9lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWh0bWxfaWQnLCBodG1sSWQgKTtcclxuXHRcdFx0aWYgKCByZW5kZXJQcmV2aWV3ICkge1xyXG5cdFx0XHRcdC8vIENhbGxlciBkZWNpZGVzIGlmIC8gd2hlbiB0byByZW5kZXIuXHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGh0bWxJZDtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBXUEJDIExheW91dCBzZXJ2aWNlLiBFbmNhcHN1bGF0ZXMgY29sdW1uIHdpZHRoIG1hdGggd2l0aCBnYXAgaGFuZGxpbmcsIHByZXNldHMsIGFuZCB1dGlsaXRpZXMuXHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9MYXlvdXRTZXJ2aWNlID0gY2xhc3MgIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbnN0cnVjdG9yLiBTZXQgb3B0aW9ucyB3aXRoIGdhcCBiZXR3ZWVuIGNvbHVtbnMgKCUpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7eyBjb2xfZ2FwX3BlcmNlbnQ/OiBudW1iZXIgfX0gW29wdHNdIC0gT3B0aW9ucyB3aXRoIGdhcCBiZXR3ZWVuIGNvbHVtbnMgKCUpLlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3Rvciggb3B0cyA9IHt9ICkge1xyXG5cdFx0XHR0aGlzLmNvbF9nYXBfcGVyY2VudCA9IE51bWJlci5pc0Zpbml0ZSggK29wdHMuY29sX2dhcF9wZXJjZW50ICkgPyArb3B0cy5jb2xfZ2FwX3BlcmNlbnQgOiAzO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29tcHV0ZSBub3JtYWxpemVkIGZsZXgtYmFzaXMgdmFsdWVzIGZvciBhIHJvdywgcmVzcGVjdGluZyBjb2x1bW4gZ2Fwcy5cclxuXHRcdCAqIFJldHVybnMgYmFzZXMgdGhhdCBzdW0gdG8gYXZhaWxhYmxlID0gMTAwIC0gKG4tMSkqZ2FwLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd19lbCAtIFJvdyBlbGVtZW50IGNvbnRhaW5pbmcgLndwYmNfYmZiX19jb2x1bW4gY2hpbGRyZW4uXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gW2dhcF9wZXJjZW50PXRoaXMuY29sX2dhcF9wZXJjZW50XSAtIEdhcCBwZXJjZW50IGJldHdlZW4gY29sdW1ucy5cclxuXHRcdCAqIEByZXR1cm5zIHt7YXZhaWxhYmxlOm51bWJlcixiYXNlczpudW1iZXJbXX19IEF2YWlsYWJsZSBzcGFjZSBhbmQgYmFzaXMgdmFsdWVzLlxyXG5cdFx0ICovXHJcblx0XHRjb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3Jvdyggcm93X2VsLCBnYXBfcGVyY2VudCA9IHRoaXMuY29sX2dhcF9wZXJjZW50ICkge1xyXG5cdFx0XHRjb25zdCBjb2xzID0gQXJyYXkuZnJvbSggcm93X2VsPy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkgfHwgW10gKTtcclxuXHRcdFx0Y29uc3QgbiAgICA9IGNvbHMubGVuZ3RoIHx8IDE7XHJcblxyXG5cdFx0XHRjb25zdCByYXcgPSBjb2xzLm1hcCggKCBjb2wgKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgdyA9IGNvbC5zdHlsZS5mbGV4QmFzaXMgfHwgJyc7XHJcblx0XHRcdFx0Y29uc3QgcCA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUucGFyc2VfcGVyY2VudCggdywgTmFOICk7XHJcblx0XHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggcCApID8gcCA6ICgxMDAgLyBuKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Y29uc3Qgc3VtX3JhdyAgICA9IHJhdy5yZWR1Y2UoICggYSwgYiApID0+IGEgKyBiLCAwICkgfHwgMTAwO1xyXG5cdFx0XHRjb25zdCBncCAgICAgICAgID0gTnVtYmVyLmlzRmluaXRlKCArZ2FwX3BlcmNlbnQgKSA/ICtnYXBfcGVyY2VudCA6IDM7XHJcblx0XHRcdGNvbnN0IHRvdGFsX2dhcHMgPSBNYXRoLm1heCggMCwgbiAtIDEgKSAqIGdwO1xyXG5cdFx0XHRjb25zdCBhdmFpbGFibGUgID0gTWF0aC5tYXgoIDAsIDEwMCAtIHRvdGFsX2dhcHMgKTtcclxuXHRcdFx0Y29uc3Qgc2NhbGUgICAgICA9IGF2YWlsYWJsZSAvIHN1bV9yYXc7XHJcblxyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdGF2YWlsYWJsZSxcclxuXHRcdFx0XHRiYXNlczogcmF3Lm1hcCggKCBwICkgPT4gTWF0aC5tYXgoIDAsIHAgKiBzY2FsZSApIClcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFwcGx5IGNvbXB1dGVkIGJhc2VzIHRvIHRoZSByb3cncyBjb2x1bW5zIChzZXRzIGZsZXgtYmFzaXMgJSkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93X2VsIC0gUm93IGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcltdfSBiYXNlcyAtIEFycmF5IG9mIGJhc2lzIHZhbHVlcyAocGVyY2VudCBvZiBmdWxsIDEwMCkuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0YXBwbHlfYmFzZXNfdG9fcm93KCByb3dfZWwsIGJhc2VzICkge1xyXG5cdFx0XHRjb25zdCBjb2xzID0gQXJyYXkuZnJvbSggcm93X2VsPy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkgfHwgW10gKTtcclxuXHRcdFx0Y29scy5mb3JFYWNoKCAoIGNvbCwgaSApID0+IHtcclxuXHRcdFx0XHRjb25zdCBwICAgICAgICAgICAgID0gYmFzZXNbaV0gPz8gMDtcclxuXHRcdFx0XHRjb2wuc3R5bGUuZmxleEJhc2lzID0gYCR7cH0lYDtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGlzdHJpYnV0ZSBjb2x1bW5zIGV2ZW5seSwgcmVzcGVjdGluZyBnYXAuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93X2VsIC0gUm93IGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gW2dhcF9wZXJjZW50PXRoaXMuY29sX2dhcF9wZXJjZW50XSAtIEdhcCBwZXJjZW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHNldF9lcXVhbF9iYXNlcyggcm93X2VsLCBnYXBfcGVyY2VudCA9IHRoaXMuY29sX2dhcF9wZXJjZW50ICkge1xyXG5cdFx0XHRjb25zdCBjb2xzICAgICAgID0gQXJyYXkuZnJvbSggcm93X2VsPy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkgfHwgW10gKTtcclxuXHRcdFx0Y29uc3QgbiAgICAgICAgICA9IGNvbHMubGVuZ3RoIHx8IDE7XHJcblx0XHRcdGNvbnN0IGdwICAgICAgICAgPSBOdW1iZXIuaXNGaW5pdGUoICtnYXBfcGVyY2VudCApID8gK2dhcF9wZXJjZW50IDogMztcclxuXHRcdFx0Y29uc3QgdG90YWxfZ2FwcyA9IE1hdGgubWF4KCAwLCBuIC0gMSApICogZ3A7XHJcblx0XHRcdGNvbnN0IGF2YWlsYWJsZSAgPSBNYXRoLm1heCggMCwgMTAwIC0gdG90YWxfZ2FwcyApO1xyXG5cdFx0XHRjb25zdCBlYWNoICAgICAgID0gYXZhaWxhYmxlIC8gbjtcclxuXHRcdFx0dGhpcy5hcHBseV9iYXNlc190b19yb3coIHJvd19lbCwgQXJyYXkoIG4gKS5maWxsKCBlYWNoICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFwcGx5IGEgcHJlc2V0IG9mIHJlbGF0aXZlIHdlaWdodHMgdG8gYSByb3cvc2VjdGlvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uT3JSb3cgLSAud3BiY19iZmJfX3NlY3Rpb24gb3IgaXRzIGNoaWxkIC53cGJjX2JmYl9fcm93LlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJbXX0gd2VpZ2h0cyAtIFJlbGF0aXZlIHdlaWdodHMgKGUuZy4sIFsxLDMsMV0pLlxyXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IFtnYXBfcGVyY2VudD10aGlzLmNvbF9nYXBfcGVyY2VudF0gLSBHYXAgcGVyY2VudC5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRhcHBseV9sYXlvdXRfcHJlc2V0KCBzZWN0aW9uT3JSb3csIHdlaWdodHMsIGdhcF9wZXJjZW50ID0gdGhpcy5jb2xfZ2FwX3BlcmNlbnQgKSB7XHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25PclJvdz8uY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19yb3cnIClcclxuXHRcdFx0XHQ/IHNlY3Rpb25PclJvd1xyXG5cdFx0XHRcdDogc2VjdGlvbk9yUm93Py5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gLndwYmNfYmZiX19yb3cnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgcm93ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgY29scyA9IEFycmF5LmZyb20oIHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkgfHwgW10gKTtcclxuXHRcdFx0Y29uc3QgbiAgICA9IGNvbHMubGVuZ3RoIHx8IDE7XHJcblxyXG5cdFx0XHRpZiAoICEgQXJyYXkuaXNBcnJheSggd2VpZ2h0cyApIHx8IHdlaWdodHMubGVuZ3RoICE9PSBuICkge1xyXG5cdFx0XHRcdHRoaXMuc2V0X2VxdWFsX2Jhc2VzKCByb3csIGdhcF9wZXJjZW50ICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBzdW0gICAgICAgPSB3ZWlnaHRzLnJlZHVjZSggKCBhLCBiICkgPT4gYSArIE1hdGgubWF4KCAwLCBOdW1iZXIoIGIgKSB8fCAwICksIDAgKSB8fCAxO1xyXG5cdFx0XHRjb25zdCBncCAgICAgICAgPSBOdW1iZXIuaXNGaW5pdGUoICtnYXBfcGVyY2VudCApID8gK2dhcF9wZXJjZW50IDogMztcclxuXHRcdFx0Y29uc3QgYXZhaWxhYmxlID0gTWF0aC5tYXgoIDAsIDEwMCAtIE1hdGgubWF4KCAwLCBuIC0gMSApICogZ3AgKTtcclxuXHRcdFx0Y29uc3QgYmFzZXMgICAgID0gd2VpZ2h0cy5tYXAoICggdyApID0+IE1hdGgubWF4KCAwLCAoTnVtYmVyKCB3ICkgfHwgMCkgLyBzdW0gKiBhdmFpbGFibGUgKSApO1xyXG5cclxuXHRcdFx0dGhpcy5hcHBseV9iYXNlc190b19yb3coIHJvdywgYmFzZXMgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEJ1aWxkIHByZXNldCB3ZWlnaHQgbGlzdHMgZm9yIGEgZ2l2ZW4gY29sdW1uIGNvdW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBuIC0gQ29sdW1uIGNvdW50LlxyXG5cdFx0ICogQHJldHVybnMge251bWJlcltdW119IExpc3Qgb2Ygd2VpZ2h0IGFycmF5cy5cclxuXHRcdCAqL1xyXG5cdFx0YnVpbGRfcHJlc2V0c19mb3JfY29sdW1ucyggbiApIHtcclxuXHRcdFx0c3dpdGNoICggbiApIHtcclxuXHRcdFx0XHRjYXNlIDE6XHJcblx0XHRcdFx0XHRyZXR1cm4gWyBbIDEgXSBdO1xyXG5cdFx0XHRcdGNhc2UgMjpcclxuXHRcdFx0XHRcdHJldHVybiBbIFsgMSwgMiBdLCBbIDIsIDEgXSwgWyAxLCAzIF0sIFsgMywgMSBdIF07XHJcblx0XHRcdFx0Y2FzZSAzOlxyXG5cdFx0XHRcdFx0cmV0dXJuIFsgWyAxLCAzLCAxIF0sIFsgMSwgMiwgMSBdLCBbIDIsIDEsIDEgXSwgWyAxLCAxLCAyIF0gXTtcclxuXHRcdFx0XHRjYXNlIDQ6XHJcblx0XHRcdFx0XHRyZXR1cm4gWyBbIDEsIDIsIDIsIDEgXSwgWyAyLCAxLCAxLCAxIF0sIFsgMSwgMSwgMSwgMiBdIF07XHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRcdHJldHVybiBbIEFycmF5KCBuICkuZmlsbCggMSApIF07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEZvcm1hdCBhIGh1bWFuLXJlYWRhYmxlIGxhYmVsIGxpa2UgXCI1MCUvMjUlLzI1JVwiIGZyb20gd2VpZ2h0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcltdfSB3ZWlnaHRzIC0gV2VpZ2h0IGxpc3QuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBMYWJlbCBzdHJpbmcuXHJcblx0XHQgKi9cclxuXHRcdGZvcm1hdF9wcmVzZXRfbGFiZWwoIHdlaWdodHMgKSB7XHJcblx0XHRcdGNvbnN0IHN1bSA9IHdlaWdodHMucmVkdWNlKCAoIGEsIGIgKSA9PiBhICsgKE51bWJlciggYiApIHx8IDApLCAwICkgfHwgMTtcclxuXHRcdFx0cmV0dXJuIHdlaWdodHMubWFwKCAoIHcgKSA9PiBNYXRoLnJvdW5kKCAoKE51bWJlciggdyApIHx8IDApIC8gc3VtKSAqIDEwMCApICkuam9pbiggJyUvJyApICsgJyUnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUGFyc2UgY29tbWEvc3BhY2Ugc2VwYXJhdGVkIHdlaWdodHMgaW50byBudW1iZXJzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBpbnB1dCAtIFVzZXIgaW5wdXQgbGlrZSBcIjIwLDYwLDIwXCIuXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyW119IFBhcnNlZCB3ZWlnaHRzLlxyXG5cdFx0ICovXHJcblx0XHRwYXJzZV93ZWlnaHRzKCBpbnB1dCApIHtcclxuXHRcdFx0aWYgKCAhIGlucHV0ICkge1xyXG5cdFx0XHRcdHJldHVybiBbXTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBpbnB1dCApXHJcblx0XHRcdFx0LnJlcGxhY2UoIC9bXlxcZCwuXFxzXS9nLCAnJyApXHJcblx0XHRcdFx0LnNwbGl0KCAvW1xccyxdKy8gKVxyXG5cdFx0XHRcdC5tYXAoICggcyApID0+IHBhcnNlRmxvYXQoIHMgKSApXHJcblx0XHRcdFx0LmZpbHRlciggKCBuICkgPT4gTnVtYmVyLmlzRmluaXRlKCBuICkgJiYgbiA+PSAwICk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogV1BCQyBVc2FnZSBMaW1pdCBzZXJ2aWNlLlxyXG5cdCAqIENvdW50cyBmaWVsZCB1c2FnZSBieSBrZXksIGNvbXBhcmVzIHRvIHBhbGV0dGUgbGltaXRzLCBhbmQgdXBkYXRlcyBwYWxldHRlIFVJLlxyXG5cdCAqL1xyXG5cdENvcmUuV1BCQ19CRkJfVXNhZ2VMaW1pdFNlcnZpY2UgPSBjbGFzcyAge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29uc3RydWN0b3IuIFNldCBwYWdlc19jb250YWluZXIgYW5kIHBhbGV0dGVfdWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFnZXNfY29udGFpbmVyIC0gQ2FudmFzIHJvb3QgdGhhdCBob2xkcyBwbGFjZWQgZmllbGRzLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudFtdfG51bGx9IHBhbGV0dGVfdWxzPzogICBQYWxldHRlcyBVTCB3aXRoIC53cGJjX2JmYl9fZmllbGQgaXRlbXMgKG1heSBiZSBudWxsKS5cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3IocGFnZXNfY29udGFpbmVyLCBwYWxldHRlX3Vscykge1xyXG5cdFx0XHR0aGlzLnBhZ2VzX2NvbnRhaW5lciA9IHBhZ2VzX2NvbnRhaW5lcjtcclxuXHRcdFx0Ly8gTm9ybWFsaXplIHRvIGFuIGFycmF5OyB3ZeKAmWxsIHN0aWxsIGJlIHJvYnVzdCBpZiBub25lIHByb3ZpZGVkLlxyXG5cdFx0XHR0aGlzLnBhbGV0dGVfdWxzICAgICA9IEFycmF5LmlzQXJyYXkoIHBhbGV0dGVfdWxzICkgPyBwYWxldHRlX3VscyA6IChwYWxldHRlX3VscyA/IFsgcGFsZXR0ZV91bHMgXSA6IFtdKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSB1c2FnZSBsaW1pdCBmcm9tIHJhdyBkYXRhc2V0IHZhbHVlLiBNaXNzaW5nL2ludmFsaWQgLT4gSW5maW5pdHkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfG51bGx8dW5kZWZpbmVkfSByYXcgLSBSYXcgYXR0cmlidXRlIHZhbHVlLlxyXG5cdFx0ICogQHJldHVybnMge251bWJlcn0gTGltaXQgbnVtYmVyIG9yIEluZmluaXR5LlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcGFyc2VfdXNhZ2VfbGltaXQoIHJhdyApIHtcclxuXHRcdFx0aWYgKCByYXcgPT0gbnVsbCApIHtcclxuXHRcdFx0XHRyZXR1cm4gSW5maW5pdHk7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgbiA9IHBhcnNlSW50KCByYXcsIDEwICk7XHJcblx0XHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIG4gKSA/IG4gOiBJbmZpbml0eTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvdW50IGhvdyBtYW55IGluc3RhbmNlcyBleGlzdCBwZXIgdXNhZ2Vfa2V5IGluIHRoZSBjYW52YXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge1JlY29yZDxzdHJpbmcsIG51bWJlcj59IE1hcCBvZiB1c2FnZV9rZXkgLT4gY291bnQuXHJcblx0XHQgKi9cclxuXHRcdGNvdW50X3VzYWdlX2J5X2tleSgpIHtcclxuXHRcdFx0Y29uc3QgdXNlZCA9IHt9O1xyXG5cdFx0XHRjb25zdCBhbGwgID0gdGhpcy5wYWdlc19jb250YWluZXI/LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGQ6bm90KC5pcy1pbnZhbGlkKScgKSB8fCBbXTtcclxuXHRcdFx0YWxsLmZvckVhY2goICggZWwgKSA9PiB7XHJcblx0XHRcdFx0Y29uc3Qga2V5ID0gZWwuZGF0YXNldC51c2FnZV9rZXkgfHwgZWwuZGF0YXNldC50eXBlIHx8IGVsLmRhdGFzZXQuaWQ7XHJcblx0XHRcdFx0aWYgKCAhIGtleSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dXNlZFtrZXldID0gKHVzZWRba2V5XSB8fCAwKSArIDE7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuIHVzZWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZXR1cm4gcGFsZXR0ZSBsaW1pdCBmb3IgYSBnaXZlbiB1c2FnZSBrZXkgKGlkIG9mIHRoZSBwYWxldHRlIGl0ZW0pLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBVc2FnZSBrZXkuXHJcblx0XHQgKiBAcmV0dXJucyB7bnVtYmVyfSBMaW1pdCB2YWx1ZSBvciBJbmZpbml0eS5cclxuXHRcdCAqL1xyXG5cdFx0Z2V0X2xpbWl0X2Zvcl9rZXkoa2V5KSB7XHJcblx0XHRcdGlmICggISBrZXkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIEluZmluaXR5O1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIFF1ZXJ5IGFjcm9zcyBhbGwgcGFsZXR0ZXMgcHJlc2VudCBub3cgKHN0b3JlZCArIGFueSBuZXdseSBhZGRlZCBpbiBET00pLlxyXG5cdFx0XHRjb25zdCByb290cyAgICAgICAgICAgID0gdGhpcy5wYWxldHRlX3Vscz8ubGVuZ3RoID8gdGhpcy5wYWxldHRlX3VscyA6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsX2ZpZWxkX3R5cGVzX191bCcgKTtcclxuXHRcdFx0Y29uc3QgYWxsUGFsZXR0ZUZpZWxkcyA9IEFycmF5LmZyb20oIHJvb3RzICkuZmxhdE1hcCggciA9PiBBcnJheS5mcm9tKCByLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2ZpZWxkJyApICkgKTtcclxuXHRcdFx0bGV0IGxpbWl0ICAgICAgICAgICAgICA9IEluZmluaXR5O1xyXG5cclxuXHRcdFx0YWxsUGFsZXR0ZUZpZWxkcy5mb3JFYWNoKCAoZWwpID0+IHtcclxuXHRcdFx0XHRjb25zdCB1c2FnZV9rZXkgPSBlbC5kYXRhc2V0LnVzYWdlX2tleSB8fCBlbC5kYXRhc2V0LmlkO1xyXG5cdFx0XHRcdGlmICggZWwuZGF0YXNldC5pZCA9PT0ga2V5IHx8IHVzYWdlX2tleSA9PT0ga2V5ICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgbiA9IENvcmUuV1BCQ19CRkJfVXNhZ2VMaW1pdFNlcnZpY2UucGFyc2VfdXNhZ2VfbGltaXQoIGVsLmRhdGFzZXQudXNhZ2VudW1iZXIgKTtcclxuXHRcdFx0XHRcdC8vIENob29zZSB0aGUgc21hbGxlc3QgZmluaXRlIGxpbWl0IChzYWZlc3QgaWYgcGFsZXR0ZXMgZGlzYWdyZWUpLlxyXG5cdFx0XHRcdFx0aWYgKCBuIDwgbGltaXQgKSB7XHJcblx0XHRcdFx0XHRcdGxpbWl0ID0gbjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHJldHVybiBsaW1pdDtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXNhYmxlL2VuYWJsZSBwYWxldHRlIGl0ZW1zIGJhc2VkIG9uIGN1cnJlbnQgdXNhZ2UgY291bnRzIGFuZCBsaW1pdHMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHVwZGF0ZV9wYWxldHRlX3VpKCkge1xyXG5cdFx0XHQvLyBBbHdheXMgY29tcHV0ZSB1c2FnZSBmcm9tIHRoZSBjYW52YXM6XHJcblx0XHRcdGNvbnN0IHVzYWdlID0gdGhpcy5jb3VudF91c2FnZV9ieV9rZXkoKTtcclxuXHJcblx0XHRcdC8vIFVwZGF0ZSBhbGwgcGFsZXR0ZXMgY3VycmVudGx5IGluIERPTSAobm90IGp1c3QgdGhlIGluaXRpYWxseSBjYXB0dXJlZCBvbmVzKVxyXG5cdFx0XHRjb25zdCBwYWxldHRlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsX2ZpZWxkX3R5cGVzX191bCcgKTtcclxuXHJcblx0XHRcdHBhbGV0dGVzLmZvckVhY2goIChwYWwpID0+IHtcclxuXHRcdFx0XHRwYWwucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fZmllbGQnICkuZm9yRWFjaCggKHBhbmVsX2ZpZWxkKSA9PiB7XHJcblx0XHRcdFx0XHRjb25zdCBwYWxldHRlSWQgICA9IHBhbmVsX2ZpZWxkLmRhdGFzZXQuaWQ7XHJcblx0XHRcdFx0XHRjb25zdCB1c2FnZUtleSAgICA9IHBhbmVsX2ZpZWxkLmRhdGFzZXQudXNhZ2Vfa2V5IHx8IHBhbGV0dGVJZDtcclxuXHRcdFx0XHRcdGNvbnN0IHJhd19saW1pdCAgID0gcGFuZWxfZmllbGQuZGF0YXNldC51c2FnZW51bWJlcjtcclxuXHRcdFx0XHRcdGNvbnN0IHBlckVsTGltaXQgID0gQ29yZS5XUEJDX0JGQl9Vc2FnZUxpbWl0U2VydmljZS5wYXJzZV91c2FnZV9saW1pdCggcmF3X2xpbWl0ICk7XHJcblx0XHRcdFx0XHQvLyBFZmZlY3RpdmUgbGltaXQgYWNyb3NzIGFsbCBwYWxldHRlcyBpcyB0aGUgZ2xvYmFsIGxpbWl0IGZvciB0aGlzIGtleS5cclxuXHRcdFx0XHRcdGNvbnN0IGdsb2JhbExpbWl0ID0gdGhpcy5nZXRfbGltaXRfZm9yX2tleSggdXNhZ2VLZXkgKTtcclxuXHRcdFx0XHRcdGNvbnN0IGxpbWl0ICAgICAgID0gTnVtYmVyLmlzRmluaXRlKCBnbG9iYWxMaW1pdCApID8gZ2xvYmFsTGltaXQgOiBwZXJFbExpbWl0OyAvLyBwcmVmZXIgZ2xvYmFsIG1pblxyXG5cclxuXHRcdFx0XHRcdGNvbnN0IGN1cnJlbnQgPSB1c2FnZVt1c2FnZUtleV0gfHwgMDtcclxuXHRcdFx0XHRcdGNvbnN0IGRpc2FibGUgPSBOdW1iZXIuaXNGaW5pdGUoIGxpbWl0ICkgJiYgY3VycmVudCA+PSBsaW1pdDtcclxuXHJcblx0XHRcdFx0XHRwYW5lbF9maWVsZC5zdHlsZS5wb2ludGVyRXZlbnRzID0gZGlzYWJsZSA/ICdub25lJyA6ICcnO1xyXG5cdFx0XHRcdFx0cGFuZWxfZmllbGQuc3R5bGUub3BhY2l0eSAgICAgICA9IGRpc2FibGUgPyAnMC40JyA6ICcnO1xyXG5cdFx0XHRcdFx0cGFuZWxfZmllbGQuc2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcsIGRpc2FibGUgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0XHRpZiAoIGRpc2FibGUgKSB7XHJcblx0XHRcdFx0XHRcdHBhbmVsX2ZpZWxkLnNldEF0dHJpYnV0ZSggJ3RhYmluZGV4JywgJy0xJyApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0cGFuZWxfZmllbGQucmVtb3ZlQXR0cmlidXRlKCAndGFiaW5kZXgnICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmV0dXJuIGhvdyBtYW55IHZhbGlkIGluc3RhbmNlcyB3aXRoIHRoaXMgdXNhZ2Uga2V5IGV4aXN0IGluIHRoZSBjYW52YXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJ9IENvdW50IG9mIGV4aXN0aW5nIG5vbi1pbnZhbGlkIGluc3RhbmNlcy5cclxuXHRcdCAqL1xyXG5cdFx0Y291bnRfZm9yX2tleSgga2V5ICkge1xyXG5cdFx0XHRpZiAoICEga2V5ICkge1xyXG5cdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiAoIHRoaXMucGFnZXNfY29udGFpbmVyPy5xdWVyeVNlbGVjdG9yQWxsKFxyXG4gICAgICAgICAgICAgICAgYC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZFtkYXRhLXVzYWdlX2tleT1cIiR7Q29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IoIGtleSApfVwiXTpub3QoLmlzLWludmFsaWQpLCBcclxuICAgICAgICAgICAgICAgICAud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGRbZGF0YS10eXBlPVwiJHtDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3Rvcigga2V5ICl9XCJdOm5vdCguaXMtaW52YWxpZClgXHJcblx0XHRcdCkgfHwgW10gKS5sZW5ndGg7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbGlhcyBmb3IgbGltaXQgbG9va3VwIChyZWFkYWJpbGl0eSkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJ9IExpbWl0IHZhbHVlIG9yIEluZmluaXR5LlxyXG5cdFx0ICovXHJcblx0XHRsaW1pdF9mb3Jfa2V5KCBrZXkgKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLmdldF9saW1pdF9mb3Jfa2V5KCBrZXkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbWFpbmluZyBzbG90cyBmb3IgdGhpcyBrZXkgKEluZmluaXR5IGlmIHVubGltaXRlZCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFVzYWdlIGtleSBvZiBhIHBhbGV0dGUgaXRlbS5cclxuXHRcdCAqIEByZXR1cm5zIHtudW1iZXJ9IFJlbWFpbmluZyBjb3VudCAoPj0gMCkgb3IgSW5maW5pdHkuXHJcblx0XHQgKi9cclxuXHRcdHJlbWFpbmluZ19mb3Jfa2V5KCBrZXkgKSB7XHJcblx0XHRcdGNvbnN0IGxpbWl0ID0gdGhpcy5saW1pdF9mb3Jfa2V5KCBrZXkgKTtcclxuXHRcdFx0aWYgKCBsaW1pdCA9PT0gSW5maW5pdHkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIEluZmluaXR5O1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHVzZWQgPSB0aGlzLmNvdW50X2Zvcl9rZXkoIGtleSApO1xyXG5cdFx0XHRyZXR1cm4gTWF0aC5tYXgoIDAsIGxpbWl0IC0gdXNlZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVHJ1ZSBpZiB5b3UgY2FuIGFkZCBgZGVsdGFgIG1vcmUgaXRlbXMgZm9yIHRoaXMga2V5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBVc2FnZSBrZXkgb2YgYSBwYWxldHRlIGl0ZW0uXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gW2RlbHRhPTFdIC0gSG93IG1hbnkgaXRlbXMgeW91IGludGVuZCB0byBhZGQuXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gV2hldGhlciBhZGRpbmcgaXMgYWxsb3dlZC5cclxuXHRcdCAqL1xyXG5cdFx0Y2FuX2FkZCgga2V5LCBkZWx0YSA9IDEgKSB7XHJcblx0XHRcdGNvbnN0IHJlbSA9IHRoaXMucmVtYWluaW5nX2Zvcl9rZXkoIGtleSApO1xyXG5cdFx0XHRyZXR1cm4gKCByZW0gPT09IEluZmluaXR5ICkgPyB0cnVlIDogKCByZW0gPj0gZGVsdGEgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFVJLWZhY2luZyBnYXRlOiBhbGVydCB3aGVuIGV4Y2VlZGVkLiBSZXR1cm5zIGJvb2xlYW4gYWxsb3dlZC9ibG9ja2VkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBVc2FnZSBrZXkgb2YgYSBwYWxldHRlIGl0ZW0uXHJcblx0XHQgKiBAcGFyYW0ge3tsYWJlbD86IHN0cmluZywgZGVsdGE/OiBudW1iZXJ9fSBbb3B0cz17fV0gLSBPcHRpb25hbCBVSSBpbmZvLlxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgYWxsb3dlZCwgZmFsc2UgaWYgYmxvY2tlZC5cclxuXHRcdCAqL1xyXG5cdFx0Z2F0ZV9vcl9hbGVydCgga2V5LCB7IGxhYmVsID0ga2V5LCBkZWx0YSA9IDEgfSA9IHt9ICkge1xyXG5cdFx0XHRpZiAoIHRoaXMuY2FuX2FkZCgga2V5LCBkZWx0YSApICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGxpbWl0ID0gdGhpcy5saW1pdF9mb3Jfa2V5KCBrZXkgKTtcclxuXHRcdFx0YWxlcnQoIGBPbmx5ICR7bGltaXR9IGluc3RhbmNlJHtsaW1pdCA+IDEgPyAncycgOiAnJ30gb2YgXCIke2xhYmVsfVwiIGFsbG93ZWQuYCApO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCYWNrd2FyZC1jb21wYXRpYmxlIGFsaWFzIHVzZWQgZWxzZXdoZXJlIGluIHRoZSBjb2RlYmFzZS4gIC0gQ2hlY2sgd2hldGhlciBhbm90aGVyIGluc3RhbmNlIHdpdGggdGhlIGdpdmVuXHJcblx0XHQgKiB1c2FnZSBrZXkgY2FuIGJlIGFkZGVkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBVc2FnZSBrZXkgb2YgYSBwYWxldHRlIGl0ZW0uXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gV2hldGhlciBhZGRpbmcgb25lIG1vcmUgaXMgYWxsb3dlZC5cclxuXHRcdCAqL1xyXG5cdFx0aXNfdXNhZ2Vfb2soIGtleSApIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuY2FuX2FkZCgga2V5LCAxICk7XHJcblx0XHR9XHJcblxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbnN0YW50IGV2ZW50IG5hbWVzIGZvciB0aGUgYnVpbGRlci5cclxuXHQgKi9cclxuXHRDb3JlLldQQkNfQkZCX0V2ZW50cyA9IE9iamVjdC5mcmVlemUoe1xyXG5cdFx0U0VMRUNUICAgICAgICAgICAgOiAnd3BiYzpiZmI6c2VsZWN0JyxcclxuXHRcdENMRUFSX1NFTEVDVElPTiAgIDogJ3dwYmM6YmZiOmNsZWFyLXNlbGVjdGlvbicsXHJcblx0XHRGSUVMRF9BREQgICAgICAgICA6ICd3cGJjOmJmYjpmaWVsZDphZGQnLFxyXG5cdFx0RklFTERfUkVNT1ZFICAgICAgOiAnd3BiYzpiZmI6ZmllbGQ6cmVtb3ZlJyxcclxuXHRcdFNUUlVDVFVSRV9DSEFOR0UgIDogJ3dwYmM6YmZiOnN0cnVjdHVyZTpjaGFuZ2UnLFxyXG5cdFx0U1RSVUNUVVJFX0xPQURFRCAgOiAnd3BiYzpiZmI6c3RydWN0dXJlOmxvYWRlZCdcclxuXHR9KTtcclxuXHJcblx0LyoqXHJcblx0ICogTGlnaHR3ZWlnaHQgZXZlbnQgYnVzIHRoYXQgZW1pdHMgdG8gYm90aCB0aGUgcGFnZXMgY29udGFpbmVyIGFuZCBkb2N1bWVudC5cclxuXHQgKi9cclxuXHRDb3JlLldQQkNfQkZCX0V2ZW50QnVzID0gIGNsYXNzIHtcclxuXHRcdC8qKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc2NvcGVfZWwgLSBFbGVtZW50IHRvIGRpc3BhdGNoIGJ1YmJsZWQgZXZlbnRzIGZyb20uXHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKCBzY29wZV9lbCApIHtcclxuXHRcdFx0dGhpcy5zY29wZV9lbCA9IHNjb3BlX2VsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW1pdCBhIERPTSBDdXN0b21FdmVudCB3aXRoIHBheWxvYWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBFdmVudCB0eXBlICh1c2UgQ29yZS5XUEJDX0JGQl9FdmVudHMuIHdoZW4gcG9zc2libGUpLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtkZXRhaWw9e31dIC0gQXJiaXRyYXJ5IHNlcmlhbGl6YWJsZSBwYXlsb2FkLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGVtaXQoIHR5cGUsIGRldGFpbCA9IHt9ICkge1xyXG5cdFx0XHRpZiAoICEgdGhpcy5zY29wZV9lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5zY29wZV9lbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoIHR5cGUsIHsgZGV0YWlsOiB7IC4uLmRldGFpbCB9LCBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3Vic2NyaWJlIHRvIGFuIGV2ZW50IG9uIGRvY3VtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gRXZlbnQgdHlwZS5cclxuXHRcdCAqIEBwYXJhbSB7KGV2OkN1c3RvbUV2ZW50KT0+dm9pZH0gaGFuZGxlciAtIEhhbmRsZXIgZnVuY3Rpb24uXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0b24oIHR5cGUsIGhhbmRsZXIgKSB7XHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIHR5cGUsIGhhbmRsZXIgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFVuc3Vic2NyaWJlIGZyb20gYW4gZXZlbnQgb24gZG9jdW1lbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBFdmVudCB0eXBlLlxyXG5cdFx0ICogQHBhcmFtIHsoZXY6Q3VzdG9tRXZlbnQpPT52b2lkfSBoYW5kbGVyIC0gSGFuZGxlciBmdW5jdGlvbi5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRvZmYoIHR5cGUsIGhhbmRsZXIgKSB7XHJcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoIHR5cGUsIGhhbmRsZXIgKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTb3J0YWJsZUpTIG1hbmFnZXI6IHNpbmdsZSBwb2ludCBmb3IgY29uc2lzdGVudCBEbkQgY29uZmlnLlxyXG5cdCAqL1xyXG5cdENvcmUuV1BCQ19CRkJfU29ydGFibGVNYW5hZ2VyID0gY2xhc3MgIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXIgLSBUaGUgYWN0aXZlIGJ1aWxkZXIgaW5zdGFuY2UuXHJcblx0XHQgKiBAcGFyYW0ge3sgZ3JvdXBOYW1lPzogc3RyaW5nLCBhbmltYXRpb24/OiBudW1iZXIsIGdob3N0Q2xhc3M/OiBzdHJpbmcsIGNob3NlbkNsYXNzPzogc3RyaW5nLCBkcmFnQ2xhc3M/OlxyXG5cdFx0ICogICAgIHN0cmluZyB9fSBbb3B0cz17fV0gLSBWaXN1YWwvYmVoYXZpb3Igb3B0aW9ucy5cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3IoIGJ1aWxkZXIsIG9wdHMgPSB7fSApIHtcclxuXHRcdFx0dGhpcy5idWlsZGVyID0gYnVpbGRlcjtcclxuXHRcdFx0Y29uc3QgZ2lkID0gdGhpcy5idWlsZGVyPy5pbnN0YW5jZV9pZCB8fCBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCA4ICk7XHJcblx0XHRcdHRoaXMub3B0cyA9IHtcclxuXHRcdFx0XHQvLyBncm91cE5hbWUgIDogJ2Zvcm0nLFxyXG5cdFx0XHRcdGdyb3VwTmFtZTogYGZvcm0tJHtnaWR9YCxcclxuXHRcdFx0XHRhbmltYXRpb24gIDogMTUwLFxyXG5cdFx0XHRcdGdob3N0Q2xhc3MgOiAnd3BiY19iZmJfX2RyYWctZ2hvc3QnLFxyXG5cdFx0XHRcdGNob3NlbkNsYXNzOiAnd3BiY19iZmJfX2hpZ2hsaWdodCcsXHJcblx0XHRcdFx0ZHJhZ0NsYXNzICA6ICd3cGJjX2JmYl9fZHJhZy1hY3RpdmUnLFxyXG5cdFx0XHRcdC4uLm9wdHNcclxuXHRcdFx0fTtcclxuXHRcdFx0LyoqIEB0eXBlIHtTZXQ8SFRNTEVsZW1lbnQ+fSAqL1xyXG5cdFx0XHR0aGlzLl9jb250YWluZXJzID0gbmV3IFNldCgpO1xyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIEd1YXJkIGFnYWluc3QgbG9zdCBtb3VzZXVwIC8gcG9pbnRlcnVwIGV2ZW50cy5cclxuXHRcdFx0ICpcclxuXHRcdFx0ICogQHR5cGUge2Jvb2xlYW59XHJcblx0XHRcdCAqL1xyXG5cdFx0XHR0aGlzLl9kcmFnX2ZhaWxfc2FmZV9ib3VuZCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0dGhpcy5fYmluZF9kcmFnX2ZhaWxfc2FmZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2xlYW51cCBkcmFnIFVJIHN0YXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIFRoaXMgaXMgYSBkZWZlbnNpdmUgY2xlYW51cCBmb3IgY2FzZXMgd2hlbiBDaHJvbWUgb3IgYSBicm93c2VyIGV4dGVuc2lvblxyXG5cdFx0ICogbG9zZXMgdGhlIGZpbmFsIG1vdXNldXAgLyBwb2ludGVydXAgZXZlbnQgZHVyaW5nIGZhbGxiYWNrIGRyYWdnaW5nLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfY2xlYW51cF9kcmFnX3VpKCkge1xyXG5cdFx0XHR0aGlzLl9kcmFnU3RhdGUgPSBudWxsO1xyXG5cdFx0XHR0aGlzLl90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MoIGZhbHNlICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uX3JlbW92ZV9kcmFnZ2luZ19jbGFzcz8uKCk7XHJcblxyXG5cdFx0XHQvLyBSZW1vdmUgb25seSBmYWxsYmFjayBtaXJyb3JzLiBEbyBub3QgdG91Y2ggcmVhbCBkcmFnZ2VkIGVsZW1lbnRzLlxyXG5cdFx0XHRkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLnNvcnRhYmxlLWZhbGxiYWNrW2RhdGEtZHJhZy1yb2xlXSwgLndwYmNfYmZiX19zaW1wbGVfbGlzdF9mYWxsYmFjaycgKVxyXG5cdFx0XHRcdFx0LmZvckVhY2goIChlbCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoIGVsLnBhcmVudE5vZGUgKSB7XHJcblx0XHRcdFx0XHRcdFx0ZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggZWwgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQmluZCBnbG9iYWwgZmFpbC1zYWZlIGxpc3RlbmVycyBmb3IgZHJhZyBjbGVhbnVwLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfYmluZF9kcmFnX2ZhaWxfc2FmZSgpIHtcclxuXHRcdFx0aWYgKCB0aGlzLl9kcmFnX2ZhaWxfc2FmZV9ib3VuZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX2RyYWdfZmFpbF9zYWZlX2JvdW5kID0gdHJ1ZTtcclxuXHJcblx0XHRcdGNvbnN0IGZpbmlzaF9kcmFnID0gKCkgPT4ge1xyXG5cdFx0XHRcdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoICgpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuX2NsZWFudXBfZHJhZ191aSgpO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdFsgJ21vdXNldXAnLCAncG9pbnRlcnVwJywgJ3RvdWNoZW5kJywgJ2RyYWdlbmQnIF0uZm9yRWFjaCggKGV2dF9uYW1lKSA9PiB7XHJcblx0XHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggZXZ0X25hbWUsIGZpbmlzaF9kcmFnLCB0cnVlICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnYmx1cicsIGZpbmlzaF9kcmFnLCB0cnVlICk7XHJcblxyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFxyXG5cdFx0XHRcdCd2aXNpYmlsaXR5Y2hhbmdlJyxcclxuXHRcdFx0XHQoKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGRvY3VtZW50LmhpZGRlbiApIHtcclxuXHRcdFx0XHRcdFx0ZmluaXNoX2RyYWcoKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHRydWVcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRhZyB0aGUgZHJhZyBtaXJyb3IgKGVsZW1lbnQgdW5kZXIgY3Vyc29yKSB3aXRoIHJvbGU6ICdwYWxldHRlJyB8ICdjYW52YXMnLlxyXG5cdFx0ICogV29ya3Mgd2l0aCBTb3J0YWJsZSdzIGZhbGxiYWNrIG1pcnJvciAoLnNvcnRhYmxlLWZhbGxiYWNrIC8gLnNvcnRhYmxlLWRyYWcpIGFuZCB3aXRoIHlvdXIgZHJhZ0NsYXNzXHJcblx0XHQgKiAoLndwYmNfYmZiX19kcmFnLWFjdGl2ZSkuXHJcblx0XHQgKi9cclxuXHRcdF90YWdfZHJhZ19taXJyb3IoIGV2dCApIHtcclxuXHRcdFx0Y29uc3QgZnJvbVBhbGV0dGUgPSB0aGlzLmJ1aWxkZXI/LnBhbGV0dGVfdWxzPy5pbmNsdWRlcz8uKCBldnQuZnJvbSApO1xyXG5cdFx0XHRjb25zdCByb2xlICAgICAgICA9IGZyb21QYWxldHRlID8gJ3BhbGV0dGUnIDogJ2NhbnZhcyc7XHJcblx0XHRcdC8vIFdhaXQgYSB0aWNrIHNvIHRoZSBtaXJyb3IgZXhpc3RzLiAgLSBUaGUgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSgpIG1ldGhvZCB0ZWxscyB0aGUgYnJvd3NlciB5b3Ugd2lzaCB0byBwZXJmb3JtIGFuIGFuaW1hdGlvbi5cclxuXHRcdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKCAoKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgbWlycm9yID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJy5zb3J0YWJsZS1mYWxsYmFjaywgLnNvcnRhYmxlLWRyYWcsIC4nICsgdGhpcy5vcHRzLmRyYWdDbGFzcyApO1xyXG5cdFx0XHRcdGlmICggbWlycm9yICkge1xyXG5cdFx0XHRcdFx0bWlycm9yLnNldEF0dHJpYnV0ZSggJ2RhdGEtZHJhZy1yb2xlJywgcm9sZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdF90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MoIGFjdGl2ZSwgZnJvbV9wYWxldHRlID0gZmFsc2UgKSB7XHJcblxyXG5cdFx0XHQvLyBzZXQgdG8gcm9vdCBlbGVtZW50IG9mIGFuIEhUTUwgZG9jdW1lbnQsIHdoaWNoIGlzIHRoZSA8aHRtbD4uXHJcblx0XHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XHJcblx0XHRcdGlmICggYWN0aXZlICkge1xyXG5cdFx0XHRcdHJvb3QuY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19kbmQtYWN0aXZlJyApO1xyXG5cdFx0XHRcdGlmICggZnJvbV9wYWxldHRlICkge1xyXG5cdFx0XHRcdFx0cm9vdC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2RyYWctZnJvbS1wYWxldHRlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyb290LmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fZG5kLWFjdGl2ZScsICd3cGJjX2JmYl9fZHJhZy1mcm9tLXBhbGV0dGUnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbnN1cmUgYSBzaW1wbGUgdmVydGljYWwgc29ydGFibGUgbGlzdC5cclxuXHRcdCAqXHJcblx0XHQgKiBUaGlzIGNvbmZpZ3VyYXRpb24gaXMgaW50ZW5kZWQgZm9yIGluc3BlY3Rvci9zaWRlYmFyIGxpc3RzIHN1Y2ggYXM6XHJcblx0XHQgKiAtIGRyb3Bkb3duIGNob2ljZXNcclxuXHRcdCAqIC0gcmFkaW8gb3B0aW9uc1xyXG5cdFx0ICogLSBjaGVja2JveCBvcHRpb25zXHJcblx0XHQgKlxyXG5cdFx0ICogSXQgaXMgaW50ZW50aW9uYWxseSBtdWNoIHNpbXBsZXIgdGhhbiB0aGUgY2FudmFzIERuRCBjb25maWcgYW5kIGRvZXMgbm90XHJcblx0XHQgKiB1c2UgdGhlIGNvbHVtbiBlZGdlLWZlbmNlIC8gc3RpY2t5LXRhcmdldCBsb2dpYy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXIgLSBTb3J0YWJsZSBsaXN0IGNvbnRhaW5lci5cclxuXHRcdCAqIEBwYXJhbSB7eyBoYW5kbGVfc2VsZWN0b3I/OiBzdHJpbmcsIGRyYWdnYWJsZV9zZWxlY3Rvcj86IHN0cmluZywgb25VcGRhdGU/OiBGdW5jdGlvbiB9fSBbaGFuZGxlcnM9e31dIC1cclxuXHRcdCAqICAgICBPcHRpb25hbCBoYW5kbGVycy9zZWxlY3RvcnMuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZW5zdXJlX3NpbXBsZV9saXN0KCBjb250YWluZXIsIGhhbmRsZXJzID0ge30gKSB7XHJcblx0XHRcdGlmICggISBjb250YWluZXIgfHwgdHlwZW9mIFNvcnRhYmxlID09PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBTb3J0YWJsZS5nZXQ/LiggY29udGFpbmVyICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjb21tb24gPSB7XHJcblx0XHRcdFx0YW5pbWF0aW9uICAgICAgICA6IHRoaXMub3B0cy5hbmltYXRpb24sXHJcblx0XHRcdFx0Z2hvc3RDbGFzcyAgICAgICA6IHRoaXMub3B0cy5naG9zdENsYXNzLFxyXG5cdFx0XHRcdGNob3NlbkNsYXNzICAgICAgOiB0aGlzLm9wdHMuY2hvc2VuQ2xhc3MsXHJcblx0XHRcdFx0ZHJhZ0NsYXNzICAgICAgICA6IHRoaXMub3B0cy5kcmFnQ2xhc3MsXHJcblx0XHRcdFx0Zm9yY2VGYWxsYmFjayAgICA6IHRydWUsXHJcblx0XHRcdFx0Ly8gRm9yIGEgc2luZ2xlIHNjcm9sbGFibGUgc2lkZWJhciBsaXN0IHRoaXMgaXMgdXN1YWxseSBtb3JlIHN0YWJsZS5cclxuXHRcdFx0XHRmYWxsYmFja09uQm9keSAgIDogZmFsc2UsXHJcblx0XHRcdFx0ZmFsbGJhY2tUb2xlcmFuY2U6IDgsXHJcblx0XHRcdFx0cmVtb3ZlQ2xvbmVPbkhpZGU6IHRydWUsXHJcblx0XHRcdFx0b25TdGFydCAgICAgICAgICA6ICgpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuYnVpbGRlcj8uX2FkZF9kcmFnZ2luZ19jbGFzcz8uKCk7XHJcblx0XHRcdFx0XHR0aGlzLl90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MoIHRydWUsIGZhbHNlICk7XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHRvbkVuZCAgICAgICAgICAgIDogKCkgPT4ge1xyXG5cdFx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmJ1aWxkZXI/Ll9yZW1vdmVfZHJhZ2dpbmdfY2xhc3M/LigpO1xyXG5cdFx0XHRcdFx0fSwgNTAgKTtcclxuXHRcdFx0XHRcdHRoaXMuX3RvZ2dsZV9kbmRfcm9vdF9mbGFncyggZmFsc2UgKTtcclxuXHRcdFx0XHRcdHRoaXMuX2RyYWdTdGF0ZSA9IG51bGw7XHJcblx0XHRcdFx0XHR0aGlzLl9jbGVhbnVwX2RyYWdfdWkoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRTb3J0YWJsZS5jcmVhdGUoXHJcblx0XHRcdFx0Y29udGFpbmVyLFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdC4uLmNvbW1vbixcclxuXHRcdFx0XHRcdGdyb3VwICAgICAgICAgICAgICAgICAgOiB7IG5hbWU6IHRoaXMub3B0cy5ncm91cE5hbWUsIHB1bGw6IGZhbHNlLCBwdXQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHRzb3J0ICAgICAgICAgICAgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdGRpcmVjdGlvbiAgICAgICAgICAgICAgOiAndmVydGljYWwnLFxyXG5cdFx0XHRcdFx0aGFuZGxlICAgICAgICAgICAgICAgICA6IGhhbmRsZXJzLmhhbmRsZV9zZWxlY3RvciB8fCAnLndwYmNfYmZiX19kcmFnLWhhbmRsZScsXHJcblx0XHRcdFx0XHRkcmFnZ2FibGUgICAgICAgICAgICAgIDogaGFuZGxlcnMuZHJhZ2dhYmxlX3NlbGVjdG9yIHx8ICcud3BiY19iZmJfX3NvcnRhYmxlLXJvdycsXHJcblx0XHRcdFx0XHRmYWxsYmFja0NsYXNzICAgICAgICAgIDogJ3dwYmNfYmZiX19zaW1wbGVfbGlzdF9mYWxsYmFjaycsXHJcblx0XHRcdFx0XHRmaWx0ZXIgICAgICAgICAgICAgICAgIDogW1xyXG5cdFx0XHRcdFx0XHQnaW5wdXQnLFxyXG5cdFx0XHRcdFx0XHQndGV4dGFyZWEnLFxyXG5cdFx0XHRcdFx0XHQnc2VsZWN0JyxcclxuXHRcdFx0XHRcdFx0J2J1dHRvbicsXHJcblx0XHRcdFx0XHRcdCdhJyxcclxuXHRcdFx0XHRcdFx0Jy53cGJjX2JmYl9fbm8tZHJhZy16b25lJyxcclxuXHRcdFx0XHRcdFx0Jy53cGJjX2JmYl9fbm8tZHJhZy16b25lIConXHJcblx0XHRcdFx0XHRdLmpvaW4oICcsJyApLFxyXG5cdFx0XHRcdFx0cHJldmVudE9uRmlsdGVyICAgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0aW52ZXJ0U3dhcCAgICAgICAgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0c3dhcFRocmVzaG9sZCAgICAgICAgICA6IDAuMzAsXHJcblx0XHRcdFx0XHRpbnZlcnRlZFN3YXBUaHJlc2hvbGQgIDogMC42MCxcclxuXHRcdFx0XHRcdGVtcHR5SW5zZXJ0VGhyZXNob2xkICAgOiA4LFxyXG5cdFx0XHRcdFx0ZHJhZ292ZXJCdWJibGUgICAgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0c2Nyb2xsICAgICAgICAgICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRzY3JvbGxTZW5zaXRpdml0eSAgICAgIDogNjAsXHJcblx0XHRcdFx0XHRzY3JvbGxTcGVlZCAgICAgICAgICAgIDogMTQsXHJcblx0XHRcdFx0XHRvblVwZGF0ZSAgICAgICAgICAgICAgIDogaGFuZGxlcnMub25VcGRhdGUgfHwgZnVuY3Rpb24gKCkge31cclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHR0aGlzLl9jb250YWluZXJzLmFkZCggY29udGFpbmVyICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW5zdXJlIFNvcnRhYmxlIGlzIGF0dGFjaGVkIHRvIGEgY29udGFpbmVyIHdpdGggcm9sZSAncGFsZXR0ZScgb3IgJ2NhbnZhcycuXHJcblx0XHQgKlxyXG5cdFx0ICogIC0tIEhhbmRsZSBzZWxlY3RvcnM6IGhhbmRsZTogICcuc2VjdGlvbi1kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWFueXdoZXJlLFxyXG5cdFx0ICogW2RhdGEtZHJhZ2dhYmxlPVwidHJ1ZVwiXSdcclxuXHRcdCAqICAtLSBEcmFnZ2FibGUgZ2F0ZTogZHJhZ2dhYmxlOiAnLndwYmNfYmZiX19maWVsZDpub3QoW2RhdGEtZHJhZ2dhYmxlPVwiZmFsc2VcIl0pLCAud3BiY19iZmJfX3NlY3Rpb24nXHJcblx0XHQgKiAgLS0gRmlsdGVyIChvdmVybGF5LXNhZmUpOiAgICAgaWdub3JlIGV2ZXJ5dGhpbmcgaW4gb3ZlcmxheSBleGNlcHQgdGhlIGhhbmRsZSAtXHJcblx0XHQgKiAnLndwYmNfYmZiX19vdmVybGF5LWNvbnRyb2xzXHJcblx0XHQgKiAqOm5vdCgud3BiY19iZmJfX2RyYWctaGFuZGxlKTpub3QoLnNlY3Rpb24tZHJhZy1oYW5kbGUpOm5vdCgud3BiY19pY25fZHJhZ19pbmRpY2F0b3IpJ1xyXG5cdFx0ICogIC0tIE5vLWRyYWcgd3JhcHBlcjogICAgICAgICAgIHVzZSAud3BiY19iZmJfX25vLWRyYWctem9uZSBpbnNpZGUgcmVuZGVyZXJzIGZvciBpbnB1dHMvd2lkZ2V0cy5cclxuXHRcdCAqICAtLSBGb2N1cyBndWFyZCAob3B0aW9uYWwpOiAgICBmbGlwIFtkYXRhLWRyYWdnYWJsZV0gb24gZm9jdXNpbi9mb2N1c291dCB0byBwcmV2ZW50IGFjY2lkZW50YWwgZHJhZ3Mgd2hpbGVcclxuXHRcdCAqIHR5cGluZy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXIgLSBUaGUgZWxlbWVudCB0byBlbmhhbmNlIHdpdGggU29ydGFibGUuXHJcblx0XHQgKiBAcGFyYW0geydwYWxldHRlJ3wnY2FudmFzJ30gcm9sZSAtIEJlaGF2aW9yIHByb2ZpbGUgdG8gYXBwbHkuXHJcblx0XHQgKiBAcGFyYW0ge3sgb25BZGQ/OiBGdW5jdGlvbiB9fSBbaGFuZGxlcnM9e31dIC0gT3B0aW9uYWwgaGFuZGxlcnMuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZW5zdXJlKCBjb250YWluZXIsIHJvbGUsIGhhbmRsZXJzID0ge30gKSB7XHJcblx0XHRcdGlmICggISBjb250YWluZXIgfHwgdHlwZW9mIFNvcnRhYmxlID09PSAndW5kZWZpbmVkJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBTb3J0YWJsZS5nZXQ/LiggY29udGFpbmVyICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBzb3J0YWJsZV9raW5kID0gaGFuZGxlcnMuc29ydGFibGVfa2luZCB8fCAnJztcclxuXHJcblx0XHRcdGlmICggc29ydGFibGVfa2luZCA9PT0gJ3NpbXBsZV9saXN0JyApIHtcclxuXHRcdFx0XHR0aGlzLmVuc3VyZV9zaW1wbGVfbGlzdCggY29udGFpbmVyLCBoYW5kbGVycyApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgY29tbW9uID0ge1xyXG5cdFx0XHRcdGFuaW1hdGlvbiAgOiB0aGlzLm9wdHMuYW5pbWF0aW9uLFxyXG5cdFx0XHRcdGdob3N0Q2xhc3MgOiB0aGlzLm9wdHMuZ2hvc3RDbGFzcyxcclxuXHRcdFx0XHRjaG9zZW5DbGFzczogdGhpcy5vcHRzLmNob3NlbkNsYXNzLFxyXG5cdFx0XHRcdGRyYWdDbGFzcyAgOiB0aGlzLm9wdHMuZHJhZ0NsYXNzLFxyXG5cdFx0XHRcdC8vID09IEVsZW1lbnQgdW5kZXIgdGhlIGN1cnNvciAgPT0gRW5zdXJlIHdlIGRyYWcgYSByZWFsIERPTSBtaXJyb3IgeW91IGNhbiBzdHlsZSB2aWEgQ1NTIChjcm9zcy1icm93c2VyKS5cclxuXHRcdFx0XHRmb3JjZUZhbGxiYWNrICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRmYWxsYmFja09uQm9keSAgIDogdHJ1ZSxcclxuXHRcdFx0XHRmYWxsYmFja1RvbGVyYW5jZTogOCxcclxuXHRcdFx0XHRyZW1vdmVDbG9uZU9uSGlkZTogdHJ1ZSxcclxuXHRcdFx0XHQvLyBBZGQgYm9keS9odG1sIGZsYWdzIHNvIHlvdSBjYW4gc3R5bGUgZGlmZmVyZW50bHkgd2hlbiBkcmFnZ2luZyBmcm9tIHBhbGV0dGUuXHJcblx0XHRcdFx0b25TdGFydDogKGV2dCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5idWlsZGVyPy5fYWRkX2RyYWdnaW5nX2NsYXNzPy4oKTtcclxuXHJcblx0XHRcdFx0XHRjb25zdCBmcm9tUGFsZXR0ZSA9IHRoaXMuYnVpbGRlcj8ucGFsZXR0ZV91bHM/LmluY2x1ZGVzPy4oIGV2dC5mcm9tICk7XHJcblx0XHRcdFx0XHR0aGlzLl90b2dnbGVfZG5kX3Jvb3RfZmxhZ3MoIHRydWUsIGZyb21QYWxldHRlICk7ICAvLyBzZXQgdG8gcm9vdCBIVE1MIGRvY3VtZW50OiBodG1sLndwYmNfYmZiX19kbmQtYWN0aXZlLndwYmNfYmZiX19kcmFnLWZyb20tcGFsZXR0ZSAuXHJcblxyXG5cdFx0XHRcdFx0dGhpcy5fdGFnX2RyYWdfbWlycm9yKCBldnQgKTsgICAgICAgICAgICAgICAgICAgICAgLy8gQWRkICdkYXRhLWRyYWctcm9sZScgYXR0cmlidXRlIHRvICBlbGVtZW50IHVuZGVyIGN1cnNvci5cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdG9uRW5kICA6ICgpID0+IHtcclxuXHRcdFx0XHRcdHNldFRpbWVvdXQoICgpID0+IHsgdGhpcy5idWlsZGVyLl9yZW1vdmVfZHJhZ2dpbmdfY2xhc3MoKTsgfSwgNTAgKTtcclxuXHRcdFx0XHRcdHRoaXMuX3RvZ2dsZV9kbmRfcm9vdF9mbGFncyggZmFsc2UgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRpZiAoIHJvbGUgPT09ICdwYWxldHRlJyApIHtcclxuXHRcdFx0XHRTb3J0YWJsZS5jcmVhdGUoIGNvbnRhaW5lciwge1xyXG5cdFx0XHRcdFx0Li4uY29tbW9uLFxyXG5cdFx0XHRcdFx0Z3JvdXAgICA6IHsgbmFtZTogdGhpcy5vcHRzLmdyb3VwTmFtZSwgcHVsbDogJ2Nsb25lJywgcHV0OiBmYWxzZSB9LFxyXG5cdFx0XHRcdFx0c29ydCAgICA6IGZhbHNlXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdHRoaXMuX2NvbnRhaW5lcnMuYWRkKCBjb250YWluZXIgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIHJvbGUgPT09ICdjYW52YXMnLlxyXG5cdFx0XHRTb3J0YWJsZS5jcmVhdGUoIGNvbnRhaW5lciwge1xyXG5cdFx0XHRcdC4uLmNvbW1vbixcclxuXHRcdFx0XHRncm91cCAgICA6IHtcclxuXHRcdFx0XHRcdG5hbWU6IHRoaXMub3B0cy5ncm91cE5hbWUsXHJcblx0XHRcdFx0XHRwdWxsOiB0cnVlLFxyXG5cdFx0XHRcdFx0cHV0IDogKHRvLCBmcm9tLCBkcmFnZ2VkRWwpID0+IHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGRyYWdnZWRFbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgfHxcclxuXHRcdFx0XHRcdFx0XHQgICBkcmFnZ2VkRWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tIERuRCBIYW5kbGVycyAtLS0tLS0tLS0tLS0tLSAgICAgICAgICAgICAgICAvLyBHcmFiIGFueXdoZXJlIG9uIGZpZWxkcyB0aGF0IG9wdC1pbiB3aXRoIHRoZSBjbGFzcyBvciBhdHRyaWJ1dGUuICAtIFNlY3Rpb25zIHN0aWxsIHJlcXVpcmUgdGhlaXIgZGVkaWNhdGVkIGhhbmRsZS5cclxuXHRcdFx0XHRoYW5kbGUgICA6ICcuc2VjdGlvbi1kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWFueXdoZXJlLCBbZGF0YS1kcmFnZ2FibGU9XCJ0cnVlXCJdJyxcclxuXHRcdFx0XHRkcmFnZ2FibGU6ICcud3BiY19iZmJfX2ZpZWxkOm5vdChbZGF0YS1kcmFnZ2FibGU9XCJmYWxzZVwiXSksIC53cGJjX2JmYl9fc2VjdGlvbicsICAgICAgICAgICAgICAgICAgICAgICAgLy8gUGVyLWZpZWxkIG9wdC1vdXQgd2l0aCBbZGF0YS1kcmFnZ2FibGU9XCJmYWxzZVwiXSAoZS5nLiwgd2hpbGUgZWRpdGluZykuXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLSBGaWx0ZXJzIC0gTm8gRG5EIC0tLS0tLS0tLS0gICAgICAgICAgICAgICAgLy8gRGVjbGFyYXRpdmUg4oCcbm8tZHJhZyB6b25lc+KAnTogYW55dGhpbmcgaW5zaWRlIHRoZXNlIHdyYXBwZXJzIHdvbuKAmXQgc3RhcnQgYSBkcmFnLlxyXG5cdFx0XHRcdGZpbHRlcjogW1xyXG5cdFx0XHRcdFx0Jy53cGJjX2JmYl9fbm8tZHJhZy16b25lJyxcclxuXHRcdFx0XHRcdCcud3BiY19iZmJfX25vLWRyYWctem9uZSAqJyxcclxuXHRcdFx0XHRcdCcud3BiY19iZmJfX2NvbHVtbi1yZXNpemVyJywgIC8vIElnbm9yZSB0aGUgcmVzaXplciByYWlscyBkdXJpbmcgRG5EIChwcmV2ZW50cyBlZGdlIOKAnHNuYXDigJ0pLlxyXG5cdFx0XHRcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSW4gdGhlIG92ZXJsYXkgdG9vbGJhciwgYmxvY2sgZXZlcnl0aGluZyBFWENFUFQgdGhlIGRyYWcgaGFuZGxlIChhbmQgaXRzIGljb24pLlxyXG5cdFx0XHRcdFx0Jy53cGJjX2JmYl9fb3ZlcmxheS1jb250cm9scyAqOm5vdCgud3BiY19iZmJfX2RyYWctaGFuZGxlKTpub3QoLnNlY3Rpb24tZHJhZy1oYW5kbGUpOm5vdCgud3BiY19pY25fZHJhZ19pbmRpY2F0b3IpJ1xyXG5cdFx0XHRcdF0uam9pbiggJywnICksXHJcblx0XHRcdFx0cHJldmVudE9uRmlsdGVyICA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLSBhbnRpLWppdHRlciB0dW5pbmcgLS0tLS0tLS0tLVxyXG5cdFx0XHRcdGRpcmVjdGlvbiAgICAgICAgICAgIDogJ3ZlcnRpY2FsJywgICAgICAgICAgIC8vIGNvbHVtbnMgYXJlIHZlcnRpY2FsIGxpc3RzLlxyXG5cdFx0XHRcdGludmVydFN3YXAgICAgICAgICAgIDogdHJ1ZSwgICAgICAgICAgICAgICAgIC8vIHVzZSBzd2FwIG9uIGludmVydGVkIG92ZXJsYXAuXHJcblx0XHRcdFx0c3dhcFRocmVzaG9sZCAgICAgICAgOiAwLjY1LCAgICAgICAgICAgICAgICAgLy8gYmUgbGVzcyBlYWdlciB0byBzd2FwLlxyXG5cdFx0XHRcdGludmVydGVkU3dhcFRocmVzaG9sZDogMC44NSwgICAgICAgICAgICAgICAgIC8vIHJlcXVpcmUgZGVlcGVyIG92ZXJsYXAgd2hlbiBpbnZlcnRlZC5cclxuXHRcdFx0XHRlbXB0eUluc2VydFRocmVzaG9sZCA6IDI0LCAgICAgICAgICAgICAgICAgICAvLyBkb27igJl0IGp1bXAgaW50byBlbXB0eSBjb250YWluZXJzIHRvbyBlYXJseS5cclxuXHRcdFx0XHRkcmFnb3ZlckJ1YmJsZSAgICAgICA6IGZhbHNlLCAgICAgICAgICAgICAgICAvLyBrZWVwIGRyYWdvdmVyIGxvY2FsLlxyXG5cdFx0XHRcdHNjcm9sbCAgICAgICAgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRzY3JvbGxTZW5zaXRpdml0eSAgICA6IDQwLFxyXG5cdFx0XHRcdHNjcm9sbFNwZWVkICAgICAgICAgIDogMTAsXHJcblx0XHRcdFx0LyoqXHJcblx0XHRcdFx0ICogRW50ZXIvbGVhdmUgaHlzdGVyZXNpcyBmb3IgY3Jvc3MtY29sdW1uIG1vdmVzLiAgICBPbmx5IGFsbG93IGRyb3BwaW5nIGludG8gYHRvYCB3aGVuIHRoZSBwb2ludGVyIGlzXHJcblx0XHRcdFx0ICogd2VsbCBpbnNpZGUgaXQuXHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0b25Nb3ZlOiAoZXZ0LCBvcmlnaW5hbEV2ZW50KSA9PiB7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgeyB0bywgZnJvbSB9ID0gZXZ0O1xyXG5cdFx0XHRcdFx0aWYgKCAhIHRvIHx8ICEgZnJvbSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgaW5fcHJldmlld19jYW52YXMgPSAhISB0by5jbG9zZXN0KCAnLndwYmNfYmZiX19wYW5lbC0tcHJldmlldycgKTtcclxuXHRcdFx0XHRcdGlmICggISBpbl9wcmV2aWV3X2NhbnZhcyApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gT25seSBnYXRlIGNvbHVtbnMgKG5vdCBwYWdlIGNvbnRhaW5lcnMpLCBhbmQgb25seSBmb3IgY3Jvc3MtY29sdW1uIG1vdmVzIGluIHRoZSBzYW1lIHJvd1xyXG5cdFx0XHRcdFx0Y29uc3QgaXNDb2x1bW4gPSB0by5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHRcdFx0XHRcdGlmICggIWlzQ29sdW1uICkgcmV0dXJuIHRydWU7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgZnJvbVJvdyA9IGZyb20uY2xvc2VzdCggJy53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRcdFx0Y29uc3QgdG9Sb3cgICA9IHRvLmNsb3Nlc3QoICcud3BiY19iZmJfX3JvdycgKTtcclxuXHRcdFx0XHRcdGlmICggZnJvbVJvdyAmJiB0b1JvdyAmJiBmcm9tUm93ICE9PSB0b1JvdyApIHJldHVybiB0cnVlO1xyXG5cclxuXHRcdFx0XHRcdGNvbnN0IHJlY3QgPSB0by5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdFx0XHRcdGNvbnN0IGV2dFggPSAob3JpZ2luYWxFdmVudC50b3VjaGVzPy5bMF0/LmNsaWVudFgpID8/IG9yaWdpbmFsRXZlbnQuY2xpZW50WDtcclxuXHRcdFx0XHRcdGNvbnN0IGV2dFkgPSAob3JpZ2luYWxFdmVudC50b3VjaGVzPy5bMF0/LmNsaWVudFkpID8/IG9yaWdpbmFsRXZlbnQuY2xpZW50WTtcclxuXHJcblx0XHRcdFx0XHQvLyAtLS0gRWRnZSBmZW5jZSAobGlrZSB5b3UgaGFkKSwgYnV0IGNsYW1wZWQgZm9yIHRpbnkgY29sdW1uc1xyXG5cdFx0XHRcdFx0Y29uc3QgcGFkZGluZ1ggPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmNsYW1wKCByZWN0LndpZHRoICogMC4yMCwgMTIsIDM2ICk7XHJcblx0XHRcdFx0XHRjb25zdCBwYWRkaW5nWSA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuY2xhbXAoIHJlY3QuaGVpZ2h0ICogMC4xMCwgNiwgMTYgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBMb29zZXIgWSBpZiB0aGUgY29sdW1uIGlzIHZpc3VhbGx5IHRpbnkvZW1wdHlcclxuXHRcdFx0XHRcdGNvbnN0IGlzVmlzdWFsbHlFbXB0eSA9IHRvLmNoaWxkRWxlbWVudENvdW50ID09PSAwIHx8IHJlY3QuaGVpZ2h0IDwgNjQ7XHJcblx0XHRcdFx0XHRjb25zdCBpbm5lclRvcCAgICAgICAgPSByZWN0LnRvcCArIChpc1Zpc3VhbGx5RW1wdHkgPyA0IDogcGFkZGluZ1kpO1xyXG5cdFx0XHRcdFx0Y29uc3QgaW5uZXJCb3R0b20gICAgID0gcmVjdC5ib3R0b20gLSAoaXNWaXN1YWxseUVtcHR5ID8gNCA6IHBhZGRpbmdZKTtcclxuXHRcdFx0XHRcdGNvbnN0IGlubmVyTGVmdCAgICAgICA9IHJlY3QubGVmdCArIHBhZGRpbmdYO1xyXG5cdFx0XHRcdFx0Y29uc3QgaW5uZXJSaWdodCAgICAgID0gcmVjdC5yaWdodCAtIHBhZGRpbmdYO1xyXG5cclxuXHRcdFx0XHRcdGNvbnN0IGluc2lkZVggPSBldnRYID4gaW5uZXJMZWZ0ICYmIGV2dFggPCBpbm5lclJpZ2h0O1xyXG5cdFx0XHRcdFx0Y29uc3QgaW5zaWRlWSA9IGV2dFkgPiBpbm5lclRvcCAmJiBldnRZIDwgaW5uZXJCb3R0b207XHJcblx0XHRcdFx0XHRpZiAoICEoaW5zaWRlWCAmJiBpbnNpZGVZKSApIHJldHVybiBmYWxzZTsgICAvLyBzdGF5IGluIGN1cnJlbnQgY29sdW1uIHVudGlsIHdlbGwgaW5zaWRlIG5ldyBvbmVcclxuXHJcblx0XHRcdFx0XHQvLyAtLS0gU3RpY2t5IHRhcmdldCBjb21taXQgZGlzdGFuY2U6IG9ubHkgc3dpdGNoIGlmIHdl4oCZcmUgY2xlYXJseSBpbnNpZGUgdGhlIG5ldyBjb2x1bW5cclxuXHRcdFx0XHRcdGNvbnN0IGRzID0gdGhpcy5fZHJhZ1N0YXRlO1xyXG5cdFx0XHRcdFx0aWYgKCBkcyApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCBkcy5zdGlja3lUbyAmJiBkcy5zdGlja3lUbyAhPT0gdG8gKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gcmVxdWlyZSBhIGRlZXBlciBwZW5ldHJhdGlvbiB0byBzd2l0Y2ggY29sdW1uc1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbW1pdFggPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmNsYW1wKCByZWN0LndpZHRoICogMC4yNSwgMTgsIDQwICk7ICAgLy8gMjUlIG9yIDE44oCTNDBweFxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbW1pdFkgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmNsYW1wKCByZWN0LmhlaWdodCAqIDAuMTUsIDEwLCAyOCApOyAgLy8gMTUlIG9yIDEw4oCTMjhweFxyXG5cclxuXHRcdFx0XHRcdFx0XHRjb25zdCBkZWVwSW5zaWRlID1cclxuXHRcdFx0XHRcdFx0XHRcdFx0ICAoZXZ0WCA+IHJlY3QubGVmdCArIGNvbW1pdFggJiYgZXZ0WCA8IHJlY3QucmlnaHQgLSBjb21taXRYKSAmJlxyXG5cdFx0XHRcdFx0XHRcdFx0XHQgIChldnRZID4gcmVjdC50b3AgKyBjb21taXRZICYmIGV2dFkgPCByZWN0LmJvdHRvbSAtIGNvbW1pdFkpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZiAoICFkZWVwSW5zaWRlICkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdC8vIFdlIGFjY2VwdCB0aGUgbmV3IHRhcmdldCBub3cuXHJcblx0XHRcdFx0XHRcdGRzLnN0aWNreVRvICAgICA9IHRvO1xyXG5cdFx0XHRcdFx0XHRkcy5sYXN0U3dpdGNoVHMgPSBwZXJmb3JtYW5jZS5ub3coKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdG9uU3RhcnQ6IChldnQpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuYnVpbGRlcj8uX2FkZF9kcmFnZ2luZ19jbGFzcz8uKCk7XHJcblx0XHRcdFx0XHQvLyBNYXRjaCB0aGUgZmxhZ3Mgd2Ugc2V0IGluIGNvbW1vbiBzbyBDU1Mgc3RheXMgY29uc2lzdGVudCBvbiBjYW52YXMgZHJhZ3MgdG9vLlxyXG5cdFx0XHRcdFx0Y29uc3QgZnJvbVBhbGV0dGUgPSB0aGlzLmJ1aWxkZXI/LnBhbGV0dGVfdWxzPy5pbmNsdWRlcz8uKCBldnQuZnJvbSApO1xyXG5cdFx0XHRcdFx0dGhpcy5fdG9nZ2xlX2RuZF9yb290X2ZsYWdzKCB0cnVlLCBmcm9tUGFsZXR0ZSApOyAgICAgICAgICAvLyBzZXQgdG8gcm9vdCBIVE1MIGRvY3VtZW50OiBodG1sLndwYmNfYmZiX19kbmQtYWN0aXZlLndwYmNfYmZiX19kcmFnLWZyb20tcGFsZXR0ZSAuXHJcblx0XHRcdFx0XHR0aGlzLl90YWdfZHJhZ19taXJyb3IoIGV2dCApOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGFnIHRoZSBtaXJyb3IgdW5kZXIgY3Vyc29yLlxyXG5cdFx0XHRcdFx0dGhpcy5fZHJhZ1N0YXRlID0geyBzdGlja3lUbzogbnVsbCwgbGFzdFN3aXRjaFRzOiAwIH07ICAgIC8vIHBlci1kcmFnIHN0YXRlLlxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0b25FbmQgIDogKCkgPT4ge1xyXG5cdFx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4geyB0aGlzLmJ1aWxkZXIuX3JlbW92ZV9kcmFnZ2luZ19jbGFzcygpOyB9LCA1MCApO1xyXG5cdFx0XHRcdFx0dGhpcy5fdG9nZ2xlX2RuZF9yb290X2ZsYWdzKCBmYWxzZSApOyAgICAgICAgICAgICAgICAgICAgLy8gc2V0IHRvIHJvb3QgSFRNTCBkb2N1bWVudCB3aXRob3V0IHRoZXNlIGNsYXNzZXM6IGh0bWwud3BiY19iZmJfX2RuZC1hY3RpdmUud3BiY19iZmJfX2RyYWctZnJvbS1wYWxldHRlIC5cclxuXHRcdFx0XHRcdHRoaXMuX2RyYWdTdGF0ZSA9IG51bGw7XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0Ly8gb25BZGQ6IGhhbmRsZXJzLm9uQWRkIHx8IHRoaXMuYnVpbGRlci5oYW5kbGVfb25fYWRkLmJpbmQoIHRoaXMuYnVpbGRlciApXHJcblx0XHRcdFx0b25BZGQ6IChldnQpID0+IHtcclxuXHRcdFx0XHRcdGlmICggdGhpcy5fb25fYWRkX3NlY3Rpb24oIGV2dCApICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvLyBGYWxsYmFjazogb3JpZ2luYWwgaGFuZGxlciBmb3Igbm9ybWFsIGZpZWxkcy5cclxuXHRcdFx0XHRcdChoYW5kbGVycy5vbkFkZCB8fCB0aGlzLmJ1aWxkZXIuaGFuZGxlX29uX2FkZC5iaW5kKCB0aGlzLmJ1aWxkZXIgKSkoIGV2dCApO1xyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0b25VcGRhdGU6ICgpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuYnVpbGRlci5idXM/LmVtaXQ/LiggQ29yZS5XUEJDX0JGQl9FdmVudHMuU1RSVUNUVVJFX0NIQU5HRSwgeyByZWFzb246ICdzb3J0LXVwZGF0ZScgfSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dGhpcy5fY29udGFpbmVycy5hZGQoIGNvbnRhaW5lciApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSGFuZGxlIGFkZGluZy9tb3Zpbmcgc2VjdGlvbnMgdmlhIFNvcnRhYmxlIG9uQWRkLlxyXG5cdFx0ICogUmV0dXJucyB0cnVlIGlmIGhhbmRsZWQgKGkuZS4sIGl0IHdhcyBhIHNlY3Rpb24pLCBmYWxzZSB0byBsZXQgdGhlIGRlZmF1bHQgZmllbGQgaGFuZGxlciBydW4uXHJcblx0XHQgKlxyXG5cdFx0ICogLSBQYWxldHRlIC0+IGNhbnZhczogcmVtb3ZlIHRoZSBwbGFjZWhvbGRlciBjbG9uZSBhbmQgYnVpbGQgYSBmcmVzaCBzZWN0aW9uIHZpYSBhZGRfc2VjdGlvbigpXHJcblx0XHQgKiAtIENhbnZhcyAtPiBjYW52YXM6IGtlZXAgdGhlIG1vdmVkIERPTSAoYW5kIGl0cyBjaGlsZHJlbiksIGp1c3QgcmUtd2lyZSBvdmVybGF5cy9zb3J0YWJsZXMvbWV0YWRhdGFcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge1NvcnRhYmxlLlNvcnRhYmxlRXZlbnR9IGV2dFxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdF9vbl9hZGRfc2VjdGlvbihldnQpIHtcclxuXHJcblx0XHRcdGNvbnN0IGl0ZW0gPSBldnQuaXRlbTtcclxuXHRcdFx0aWYgKCAhIGl0ZW0gKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJZGVudGlmeSBzZWN0aW9ucyBib3RoIGZyb20gcGFsZXR0ZSBpdGVtcyAobGkgY2xvbmVzKSBhbmQgcmVhbCBjYW52YXMgbm9kZXMuXHJcblx0XHRcdGNvbnN0IGRhdGEgICAgICA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBpdGVtICk7XHJcblx0XHRcdGNvbnN0IGlzU2VjdGlvbiA9IGl0ZW0uY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgfHwgKGRhdGE/LnR5cGUgfHwgaXRlbS5kYXRhc2V0Py50eXBlKSA9PT0gJ3NlY3Rpb24nO1xyXG5cclxuXHRcdFx0aWYgKCAhIGlzU2VjdGlvbiApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGZyb21QYWxldHRlID0gdGhpcy5idWlsZGVyPy5wYWxldHRlX3Vscz8uaW5jbHVkZXM/LiggZXZ0LmZyb20gKSA9PT0gdHJ1ZTtcclxuXHJcblx0XHRcdGlmICggISBmcm9tUGFsZXR0ZSApIHtcclxuXHRcdFx0XHQvLyBDYW52YXMgLT4gY2FudmFzIG1vdmU6IERPIE5PVCByZWJ1aWxkL3JlbW92ZTsgcHJlc2VydmUgY2hpbGRyZW4uXHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmFkZF9vdmVybGF5X3Rvb2xiYXI/LiggaXRlbSApOyAgICAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIG92ZXJsYXkgZXhpc3RzXHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLnBhZ2VzX3NlY3Rpb25zPy5pbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzPy4oIGl0ZW0gKTsgLy8gZW5zdXJlIGlubmVyIHNvcnRhYmxlc1xyXG5cclxuXHRcdFx0XHQvLyBFbnN1cmUgbWV0YWRhdGEgcHJlc2VudC91cGRhdGVkXHJcblx0XHRcdFx0aXRlbS5kYXRhc2V0LnR5cGUgICAgPSAnc2VjdGlvbic7XHJcblx0XHRcdFx0Y29uc3QgY29scyAgICAgICAgICAgPSBpdGVtLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX3JvdyA+IC53cGJjX2JmYl9fY29sdW1uJyApLmxlbmd0aCB8fCAxO1xyXG5cdFx0XHRcdGl0ZW0uZGF0YXNldC5jb2x1bW5zID0gU3RyaW5nKCBjb2xzICk7XHJcblxyXG5cdFx0XHRcdC8vIFNlbGVjdCAmIG5vdGlmeSBzdWJzY3JpYmVycyAobGF5b3V0L21pbiBndWFyZHMsIGV0Yy4pXHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLnNlbGVjdF9maWVsZD8uKCBpdGVtICk7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmJ1cz8uZW1pdD8uKCBDb3JlLldQQkNfQkZCX0V2ZW50cy5TVFJVQ1RVUkVfQ0hBTkdFLCB7IGVsOiBpdGVtLCByZWFzb246ICdzZWN0aW9uLW1vdmUnIH0gKTtcclxuXHRcdFx0XHR0aGlzLmJ1aWxkZXIudXNhZ2U/LnVwZGF0ZV9wYWxldHRlX3VpPy4oKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gaGFuZGxlZC5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gUGFsZXR0ZSAtPiBjYW52YXM6IGJ1aWxkIGEgYnJhbmQtbmV3IHNlY3Rpb24gdXNpbmcgdGhlIHNhbWUgcGF0aCBhcyB0aGUgZHJvcGRvd24vbWVudVxyXG5cdFx0XHRjb25zdCB0byAgID0gZXZ0LnRvPy5jbG9zZXN0Py4oICcud3BiY19iZmJfX2NvbHVtbiwgLndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICkgfHwgZXZ0LnRvO1xyXG5cdFx0XHRjb25zdCBjb2xzID0gcGFyc2VJbnQoIGRhdGE/LmNvbHVtbnMgfHwgaXRlbS5kYXRhc2V0LmNvbHVtbnMgfHwgMSwgMTAgKSB8fCAxO1xyXG5cclxuXHRcdFx0Ly8gUmVtb3ZlIHRoZSBwYWxldHRlIGNsb25lIHBsYWNlaG9sZGVyLlxyXG5cdFx0XHRpdGVtLnBhcmVudE5vZGUgJiYgaXRlbS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBpdGVtICk7XHJcblxyXG5cdFx0XHQvLyBDcmVhdGUgdGhlIHJlYWwgc2VjdGlvbi5cclxuXHRcdFx0dGhpcy5idWlsZGVyLnBhZ2VzX3NlY3Rpb25zLmFkZF9zZWN0aW9uKCB0bywgY29scyApO1xyXG5cclxuXHRcdFx0Ly8gSW5zZXJ0IGF0IHRoZSBwcmVjaXNlIGRyb3AgaW5kZXguXHJcblx0XHRcdGNvbnN0IHNlY3Rpb24gPSB0by5sYXN0RWxlbWVudENoaWxkOyAvLyBhZGRfc2VjdGlvbiBhcHBlbmRzIHRvIGVuZC5cclxuXHRcdFx0aWYgKCBldnQubmV3SW5kZXggIT0gbnVsbCAmJiBldnQubmV3SW5kZXggPCB0by5jaGlsZHJlbi5sZW5ndGggLSAxICkge1xyXG5cdFx0XHRcdGNvbnN0IHJlZiA9IHRvLmNoaWxkcmVuW2V2dC5uZXdJbmRleF0gfHwgbnVsbDtcclxuXHRcdFx0XHR0by5pbnNlcnRCZWZvcmUoIHNlY3Rpb24sIHJlZiApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGaW5hbGl6ZTogb3ZlcmxheSwgc2VsZWN0aW9uLCBldmVudHMsIHVzYWdlIHJlZnJlc2guXHJcblx0XHRcdHRoaXMuYnVpbGRlci5hZGRfb3ZlcmxheV90b29sYmFyPy4oIHNlY3Rpb24gKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLnNlbGVjdF9maWVsZD8uKCBzZWN0aW9uICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5idXM/LmVtaXQ/LiggQ29yZS5XUEJDX0JGQl9FdmVudHMuRklFTERfQURELCB7XHJcblx0XHRcdFx0ZWwgOiBzZWN0aW9uLFxyXG5cdFx0XHRcdGlkIDogc2VjdGlvbi5kYXRhc2V0LmlkLFxyXG5cdFx0XHRcdHVpZDogc2VjdGlvbi5kYXRhc2V0LnVpZFxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci51c2FnZT8udXBkYXRlX3BhbGV0dGVfdWk/LigpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZXN0cm95IGFsbCBTb3J0YWJsZSBpbnN0YW5jZXMgY3JlYXRlZCBieSB0aGlzIG1hbmFnZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGRlc3Ryb3lBbGwoKSB7XHJcblx0XHRcdHRoaXMuX2NvbnRhaW5lcnMuZm9yRWFjaCggKCBlbCApID0+IHtcclxuXHRcdFx0XHRjb25zdCBpbnN0ID0gU29ydGFibGUuZ2V0Py4oIGVsICk7XHJcblx0XHRcdFx0aWYgKCBpbnN0ICkge1xyXG5cdFx0XHRcdFx0aW5zdC5kZXN0cm95KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHRoaXMuX2NvbnRhaW5lcnMuY2xlYXIoKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTbWFsbCBET00gY29udHJhY3QgYW5kIHJlbmRlcmVyIGhlbHBlclxyXG5cdCAqXHJcblx0ICogQHR5cGUge1JlYWRvbmx5PHtcclxuXHQgKiAgICAgICAgICAgICAgICAgIFNFTEVDVE9SUzoge3BhZ2VQYW5lbDogc3RyaW5nLCBmaWVsZDogc3RyaW5nLCB2YWxpZEZpZWxkOiBzdHJpbmcsIHNlY3Rpb246IHN0cmluZywgY29sdW1uOlxyXG5cdCAqICAgICBzdHJpbmcsIHJvdzogc3RyaW5nLCBvdmVybGF5OiBzdHJpbmd9LCBDTEFTU0VTOiB7c2VsZWN0ZWQ6IHN0cmluZ30sIEFUVFI6IHtpZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGh0bWxJZDpcclxuXHQgKiAgICAgc3RyaW5nLCB1c2FnZUtleTogc3RyaW5nLCB1aWQ6IHN0cmluZ319XHJcblx0ICogICAgICAgID59XHJcblx0ICovXHJcblx0Q29yZS5XUEJDX0JGQl9ET00gPSBPYmplY3QuZnJlZXplKCB7XHJcblx0XHRTRUxFQ1RPUlM6IHtcclxuXHRcdFx0cGFnZVBhbmVsIDogJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcnLFxyXG5cdFx0XHRmaWVsZCAgICAgOiAnLndwYmNfYmZiX19maWVsZCcsXHJcblx0XHRcdHZhbGlkRmllbGQ6ICcud3BiY19iZmJfX2ZpZWxkOm5vdCguaXMtaW52YWxpZCknLFxyXG5cdFx0XHRzZWN0aW9uICAgOiAnLndwYmNfYmZiX19zZWN0aW9uJyxcclxuXHRcdFx0Y29sdW1uICAgIDogJy53cGJjX2JmYl9fY29sdW1uJyxcclxuXHRcdFx0cm93ICAgICAgIDogJy53cGJjX2JmYl9fcm93JyxcclxuXHRcdFx0b3ZlcmxheSAgIDogJy53cGJjX2JmYl9fb3ZlcmxheS1jb250cm9scydcclxuXHRcdH0sXHJcblx0XHRDTEFTU0VTICA6IHtcclxuXHRcdFx0c2VsZWN0ZWQ6ICdpcy1zZWxlY3RlZCdcclxuXHRcdH0sXHJcblx0XHRBVFRSICAgICA6IHtcclxuXHRcdFx0aWQgICAgICA6ICdkYXRhLWlkJyxcclxuXHRcdFx0bmFtZSAgICA6ICdkYXRhLW5hbWUnLFxyXG5cdFx0XHRodG1sSWQgIDogJ2RhdGEtaHRtbF9pZCcsXHJcblx0XHRcdHVzYWdlS2V5OiAnZGF0YS11c2FnZV9rZXknLFxyXG5cdFx0XHR1aWQgICAgIDogJ2RhdGEtdWlkJ1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0Q29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIgPSBjbGFzcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYW4gSFRNTCBlbGVtZW50LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0YWcgLSBIVE1MIHRhZyBuYW1lLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtjbGFzc19uYW1lPScnXSAtIE9wdGlvbmFsIENTUyBjbGFzcyBuYW1lLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IFtpbm5lcl9odG1sPScnXSAtIE9wdGlvbmFsIGlubmVySFRNTC5cclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gQ3JlYXRlZCBlbGVtZW50LlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgY3JlYXRlX2VsZW1lbnQoIHRhZywgY2xhc3NfbmFtZSA9ICcnLCBpbm5lcl9odG1sID0gJycgKSB7XHJcblx0XHRcdGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggdGFnICk7XHJcblx0XHRcdGlmICggY2xhc3NfbmFtZSApIHtcclxuXHRcdFx0XHRlbC5jbGFzc05hbWUgPSBjbGFzc19uYW1lO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaW5uZXJfaHRtbCApIHtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSBpbm5lcl9odG1sO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBlbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNldCBtdWx0aXBsZSBgZGF0YS0qYCBhdHRyaWJ1dGVzIG9uIGEgZ2l2ZW4gZWxlbWVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCAtIFRhcmdldCBlbGVtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGRhdGFfb2JqIC0gS2V5LXZhbHVlIHBhaXJzIGZvciBkYXRhIGF0dHJpYnV0ZXMuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHNldF9kYXRhX2F0dHJpYnV0ZXMoIGVsLCBkYXRhX29iaiApIHtcclxuXHRcdFx0T2JqZWN0LmVudHJpZXMoIGRhdGFfb2JqICkuZm9yRWFjaCggKCBbIGtleSwgdmFsIF0gKSA9PiB7XHJcblx0XHRcdFx0Ly8gUHJldmlvdXNseTogMjAyNS0wOS0wMSAxNzowOTpcclxuXHRcdFx0XHQvLyBjb25zdCB2YWx1ZSA9ICh0eXBlb2YgdmFsID09PSAnb2JqZWN0JykgPyBKU09OLnN0cmluZ2lmeSggdmFsICkgOiB2YWw7XHJcblx0XHRcdFx0Ly9OZXc6XHJcblx0XHRcdFx0bGV0IHZhbHVlO1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcgJiYgdmFsICE9PSBudWxsICkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0dmFsdWUgPSBKU09OLnN0cmluZ2lmeSggdmFsICk7XHJcblx0XHRcdFx0XHR9IGNhdGNoIHtcclxuXHRcdFx0XHRcdFx0dmFsdWUgPSAnJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dmFsdWUgPSB2YWw7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLScgKyBrZXksIHZhbHVlICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBhbGwgYGRhdGEtKmAgYXR0cmlidXRlcyBmcm9tIGFuIGVsZW1lbnQgYW5kIHBhcnNlIEpTT04gd2hlcmUgcG9zc2libGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWwgLSBFbGVtZW50IHRvIGV4dHJhY3QgZGF0YSBmcm9tLlxyXG5cdFx0ICogQHJldHVybnMge09iamVjdH0gUGFyc2VkIGtleS12YWx1ZSBtYXAgb2YgZGF0YSBhdHRyaWJ1dGVzLlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGVsICkge1xyXG5cdFx0XHRjb25zdCBkYXRhID0ge307XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgfHwgISBlbC5hdHRyaWJ1dGVzICkge1xyXG5cdFx0XHRcdHJldHVybiBkYXRhO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRBcnJheS5mcm9tKCBlbC5hdHRyaWJ1dGVzICkuZm9yRWFjaChcclxuXHRcdFx0XHQoIGF0dHIgKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGF0dHIubmFtZS5zdGFydHNXaXRoKCAnZGF0YS0nICkgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGtleSA9IGF0dHIubmFtZS5yZXBsYWNlKCAvXmRhdGEtLywgJycgKTtcclxuXHRcdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0XHRkYXRhW2tleV0gPSBKU09OLnBhcnNlKCBhdHRyLnZhbHVlICk7XHJcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdFx0XHRcdGRhdGFba2V5XSA9IGF0dHIudmFsdWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHQvLyBPbmx5IGRlZmF1bHQgdGhlIGxhYmVsIGlmIGl0J3MgdHJ1bHkgYWJzZW50ICh1bmRlZmluZWQvbnVsbCksIG5vdCB3aGVuIGl0J3MgYW4gZW1wdHkgc3RyaW5nLlxyXG5cdFx0XHRjb25zdCBoYXNFeHBsaWNpdExhYmVsID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkYXRhLCAnbGFiZWwnICk7XHJcblx0XHRcdGlmICggISBoYXNFeHBsaWNpdExhYmVsICYmIGRhdGEuaWQgKSB7XHJcblx0XHRcdFx0ZGF0YS5sYWJlbCA9IGRhdGEuaWQuY2hhckF0KCAwICkudG9VcHBlckNhc2UoKSArIGRhdGEuaWQuc2xpY2UoIDEgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGRhdGE7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW5kZXIgYSBzaW1wbGUgbGFiZWwgKyB0eXBlIHByZXZpZXcgKHVzZWQgZm9yIHVua25vd24gb3IgZmFsbGJhY2sgZmllbGRzKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZmllbGRfZGF0YSAtIEZpZWxkIGRhdGEgb2JqZWN0LlxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ30gSFRNTCBjb250ZW50LlxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVuZGVyX2ZpZWxkX2lubmVyX2h0bWwoIGZpZWxkX2RhdGEgKSB7XHJcblx0XHRcdC8vIE1ha2UgdGhlIGZhbGxiYWNrIHByZXZpZXcgcmVzcGVjdCBhbiBlbXB0eSBsYWJlbC5cclxuXHRcdFx0Y29uc3QgaGFzTGFiZWwgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGZpZWxkX2RhdGEsICdsYWJlbCcgKTtcclxuXHRcdFx0Y29uc3QgbGFiZWwgICAgPSBoYXNMYWJlbCA/IFN0cmluZyggZmllbGRfZGF0YS5sYWJlbCApIDogU3RyaW5nKCBmaWVsZF9kYXRhLmlkIHx8ICcobm8gbGFiZWwpJyApO1xyXG5cclxuXHRcdFx0Y29uc3QgdHlwZSAgICAgICAgPSBTdHJpbmcoIGZpZWxkX2RhdGEudHlwZSB8fCAndW5rbm93bicgKTtcclxuXHRcdFx0Y29uc3QgaXNfcmVxdWlyZWQgPSBmaWVsZF9kYXRhLnJlcXVpcmVkID09PSB0cnVlIHx8IGZpZWxkX2RhdGEucmVxdWlyZWQgPT09ICd0cnVlJyB8fCBmaWVsZF9kYXRhLnJlcXVpcmVkID09PSAxIHx8IGZpZWxkX2RhdGEucmVxdWlyZWQgPT09ICcxJztcclxuXHJcblx0XHRcdGNvbnN0IHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cclxuXHRcdFx0Y29uc3Qgc3BhbkxhYmVsICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XHJcblx0XHRcdHNwYW5MYWJlbC5jbGFzc05hbWUgICA9ICd3cGJjX2JmYl9fZmllbGQtbGFiZWwnO1xyXG5cdFx0XHRzcGFuTGFiZWwudGV4dENvbnRlbnQgPSBsYWJlbCArIChpc19yZXF1aXJlZCA/ICcgKicgOiAnJyk7XHJcblx0XHRcdHdyYXBwZXIuYXBwZW5kQ2hpbGQoIHNwYW5MYWJlbCApO1xyXG5cclxuXHRcdFx0Y29uc3Qgc3BhblR5cGUgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcclxuXHRcdFx0c3BhblR5cGUuY2xhc3NOYW1lICAgPSAnd3BiY19iZmJfX2ZpZWxkLXR5cGUnO1xyXG5cdFx0XHRzcGFuVHlwZS50ZXh0Q29udGVudCA9IHR5cGU7XHJcblx0XHRcdHdyYXBwZXIuYXBwZW5kQ2hpbGQoIHNwYW5UeXBlICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gd3JhcHBlci5pbm5lckhUTUw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWJvdW5jZSBhIGZ1bmN0aW9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIC0gRnVuY3Rpb24gdG8gZGVib3VuY2UuXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gd2FpdCAtIERlbGF5IGluIG1zLlxyXG5cdFx0ICogQHJldHVybnMge0Z1bmN0aW9ufSBEZWJvdW5jZWQgZnVuY3Rpb24uXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBkZWJvdW5jZSggZm4sIHdhaXQgPSAxMjAgKSB7XHJcblx0XHRcdGxldCB0ID0gbnVsbDtcclxuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uIGRlYm91bmNlZCggLi4uYXJncyApIHtcclxuXHRcdFx0XHRpZiAoIHQgKSB7XHJcblx0XHRcdFx0XHRjbGVhclRpbWVvdXQoIHQgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dCA9IHNldFRpbWVvdXQoICgpID0+IGZuLmFwcGx5KCB0aGlzLCBhcmdzICksIHdhaXQgKTtcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0Ly8gUmVuZGVyZXIgcmVnaXN0cnkuIEFsbG93cyBsYXRlIHJlZ2lzdHJhdGlvbiBhbmQgYXZvaWRzIHRpZ2h0IGNvdXBsaW5nIHRvIGEgZ2xvYmFsIG1hcC5cclxuXHRDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5ID0gKGZ1bmN0aW9uICgpIHtcclxuXHRcdGNvbnN0IG1hcCA9IG5ldyBNYXAoKTtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHJlZ2lzdGVyKCB0eXBlLCBDbGFzc1JlZiApIHtcclxuXHRcdFx0XHRtYXAuc2V0KCBTdHJpbmcoIHR5cGUgKSwgQ2xhc3NSZWYgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0Z2V0KCB0eXBlICkge1xyXG5cdFx0XHRcdHJldHVybiBtYXAuZ2V0KCBTdHJpbmcoIHR5cGUgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG59KCB3aW5kb3cgKSk7XHJcbiIsIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9jb3JlL2JmYi1maWVsZHMuanMgPT0gfCAyMDI1LTA5LTEwIDE1OjQ3XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4oZnVuY3Rpb24gKCB3ICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Ly8gU2luZ2xlIGdsb2JhbCBuYW1lc3BhY2UgKGlkZW1wb3RlbnQgJiBsb2FkLW9yZGVyIHNhZmUpLlxyXG5cdGNvbnN0IENvcmUgPSAoIHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSApO1xyXG5cdGNvbnN0IFVJICAgPSAoIENvcmUuVUkgPSBDb3JlLlVJIHx8IHt9ICk7XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJhc2UgY2xhc3MgZm9yIGZpZWxkIHJlbmRlcmVycyAoc3RhdGljLW9ubHkgY29udHJhY3QpLlxyXG5cdCAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQgKiBDb250cmFjdCBleHBvc2VkIHRvIHRoZSBidWlsZGVyIChzdGF0aWMgbWV0aG9kcyBvbiB0aGUgQ0xBU1MgaXRzZWxmKTpcclxuXHQgKiAgIC0gcmVuZGVyKGVsLCBkYXRhLCBjdHgpICAgICAgICAgICAgICAvLyBSRVFVSVJFRFxyXG5cdCAqICAgLSBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBtZXRhKSAgICAgIC8vIE9QVElPTkFMIChkZWZhdWx0IHByb3ZpZGVkKVxyXG5cdCAqXHJcblx0ICogSGVscGVycyBmb3Igc3ViY2xhc3NlczpcclxuXHQgKiAgIC0gZ2V0X2RlZmF1bHRzKCkgICAgIC0+IHBlci1maWVsZCBkZWZhdWx0cyAoTVVTVCBvdmVycmlkZSBpbiBzdWJjbGFzcyB0byBzZXQgdHlwZS9sYWJlbClcclxuXHQgKiAgIC0gbm9ybWFsaXplX2RhdGEoZCkgIC0+IHNoYWxsb3cgbWVyZ2Ugd2l0aCBkZWZhdWx0c1xyXG5cdCAqICAgLSBnZXRfdGVtcGxhdGUoaWQpICAgLT4gcGVyLWlkIGNhY2hlZCB3cC50ZW1wbGF0ZSBjb21waWxlclxyXG5cdCAqXHJcblx0ICogU3ViY2xhc3MgdXNhZ2U6XHJcblx0ICogICBjbGFzcyBXUEJDX0JGQl9GaWVsZF9UZXh0IGV4dGVuZHMgQ29yZS5XUEJDX0JGQl9GaWVsZF9CYXNlIHsgc3RhdGljIGdldF9kZWZhdWx0cygpeyAuLi4gfSB9XHJcblx0ICogICBXUEJDX0JGQl9GaWVsZF9UZXh0LnRlbXBsYXRlX2lkID0gJ3dwYmMtYmZiLWZpZWxkLXRleHQnO1xyXG5cdCAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHQgKi9cclxuXHRDb3JlLldQQkNfQkZCX0ZpZWxkX0Jhc2UgPSBjbGFzcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWZhdWx0IGZpZWxkIGRhdGEgKGdlbmVyaWMgYmFzZWxpbmUpLlxyXG5cdFx0ICogU3ViY2xhc3NlcyBNVVNUIG92ZXJyaWRlIHRvIHByb3ZpZGUgeyB0eXBlLCBsYWJlbCB9IGFwcHJvcHJpYXRlIGZvciB0aGUgZmllbGQuXHJcblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgIDogJ2ZpZWxkJyxcclxuXHRcdFx0XHRsYWJlbCAgICAgICA6ICdGaWVsZCcsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgOiAnZmllbGQnLFxyXG5cdFx0XHRcdGh0bWxfaWQgICAgIDogJycsXHJcblx0XHRcdFx0cGxhY2Vob2xkZXIgOiAnJyxcclxuXHRcdFx0XHRyZXF1aXJlZCAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdG1pbmxlbmd0aCAgIDogJycsXHJcblx0XHRcdFx0bWF4bGVuZ3RoICAgOiAnJyxcclxuXHRcdFx0XHRwYXR0ZXJuICAgICA6ICcnLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgIDogJycsXHJcblx0XHRcdFx0aGVscCAgICAgICAgOiAnJ1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2hhbGxvdy1tZXJnZSBpbmNvbWluZyBkYXRhIHdpdGggZGVmYXVsdHMuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxyXG5cdFx0ICogQHJldHVybnMge09iamVjdH1cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIG5vcm1hbGl6ZV9kYXRhKCBkYXRhICkge1xyXG5cdFx0XHR2YXIgZCAgICAgICAgPSBkYXRhIHx8IHt9O1xyXG5cdFx0XHR2YXIgZGVmYXVsdHMgPSB0aGlzLmdldF9kZWZhdWx0cygpO1xyXG5cdFx0XHR2YXIgb3V0ICAgICAgPSB7fTtcclxuXHRcdFx0dmFyIGs7XHJcblxyXG5cdFx0XHRmb3IgKCBrIGluIGRlZmF1bHRzICkge1xyXG5cdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkZWZhdWx0cywgayApICkge1xyXG5cdFx0XHRcdFx0b3V0W2tdID0gZGVmYXVsdHNba107XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdGZvciAoIGsgaW4gZCApIHtcclxuXHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZCwgayApICkge1xyXG5cdFx0XHRcdFx0b3V0W2tdID0gZFtrXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIG91dDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbXBpbGUgYW5kIGNhY2hlIGEgd3AudGVtcGxhdGUgYnkgaWQgKHBlci1pZCBjYWNoZSkuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfaWRcclxuXHRcdCAqIEByZXR1cm5zIHtGdW5jdGlvbnxudWxsfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2V0X3RlbXBsYXRlKHRlbXBsYXRlX2lkKSB7XHJcblxyXG5cdFx0XHQvLyBBY2NlcHQgZWl0aGVyIFwid3BiYy1iZmItZmllbGQtdGV4dFwiIG9yIFwidG1wbC13cGJjLWJmYi1maWVsZC10ZXh0XCIuXHJcblx0XHRcdGlmICggISB0ZW1wbGF0ZV9pZCB8fCAhIHdpbmRvdy53cCB8fCAhIHdwLnRlbXBsYXRlICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGRvbUlkID0gdGVtcGxhdGVfaWQuc3RhcnRzV2l0aCggJ3RtcGwtJyApID8gdGVtcGxhdGVfaWQgOiAoJ3RtcGwtJyArIHRlbXBsYXRlX2lkKTtcclxuXHRcdFx0aWYgKCAhIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBkb21JZCApICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICEgQ29yZS5fX2JmYl90cGxfY2FjaGVfbWFwICkge1xyXG5cdFx0XHRcdENvcmUuX19iZmJfdHBsX2NhY2hlX21hcCA9IHt9O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBOb3JtYWxpemUgaWQgZm9yIHRoZSBjb21waWxlciAmIGNhY2hlLiAvLyB3cC50ZW1wbGF0ZSBleHBlY3RzIGlkIFdJVEhPVVQgdGhlIFwidG1wbC1cIiBwcmVmaXggIVxyXG5cdFx0XHRjb25zdCBrZXkgPSB0ZW1wbGF0ZV9pZC5yZXBsYWNlKCAvXnRtcGwtLywgJycgKTtcclxuXHRcdFx0aWYgKCBDb3JlLl9fYmZiX3RwbF9jYWNoZV9tYXBba2V5XSApIHtcclxuXHRcdFx0XHRyZXR1cm4gQ29yZS5fX2JmYl90cGxfY2FjaGVfbWFwW2tleV07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGNvbXBpbGVyID0gd3AudGVtcGxhdGUoIGtleSApOyAgICAgLy8gPC0tIG5vcm1hbGl6ZWQgaWQgaGVyZVxyXG5cdFx0XHRpZiAoIGNvbXBpbGVyICkge1xyXG5cdFx0XHRcdENvcmUuX19iZmJfdHBsX2NhY2hlX21hcFtrZXldID0gY29tcGlsZXI7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBjb21waWxlcjtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJFUVVJUkVEOiByZW5kZXIgcHJldmlldyBpbnRvIGhvc3QgZWxlbWVudCAoZnVsbCByZWRyYXc7IGlkZW1wb3RlbnQpLlxyXG5cdFx0ICogU3ViY2xhc3NlcyBzaG91bGQgc2V0IHN0YXRpYyBgdGVtcGxhdGVfaWRgIHRvIGEgdmFsaWQgd3AudGVtcGxhdGUgaWQuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbFxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgZGF0YVxyXG5cdFx0ICogQHBhcmFtIHt7bW9kZT86c3RyaW5nLGJ1aWxkZXI/OmFueSx0cGw/OkZ1bmN0aW9uLHNhbml0Pzphbnl9fSBjdHhcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVuZGVyKCBlbCwgZGF0YSwgY3R4ICkge1xyXG5cdFx0XHRpZiAoICEgZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgY29tcGlsZSA9IHRoaXMuZ2V0X3RlbXBsYXRlKCB0aGlzLnRlbXBsYXRlX2lkICk7XHJcblx0XHRcdHZhciBkICAgICAgID0gdGhpcy5ub3JtYWxpemVfZGF0YSggZGF0YSApO1xyXG5cclxuXHRcdFx0dmFyIHMgPSAoY3R4ICYmIGN0eC5zYW5pdCkgPyBjdHguc2FuaXQgOiBDb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cclxuXHRcdFx0Ly8gU2FuaXRpemUgY3JpdGljYWwgYXR0cmlidXRlcyBiZWZvcmUgdGVtcGxhdGluZy5cclxuXHRcdFx0aWYgKCBzICkge1xyXG5cdFx0XHRcdGQuaHRtbF9pZCA9IGQuaHRtbF9pZCA/IHMuc2FuaXRpemVfaHRtbF9pZCggU3RyaW5nKCBkLmh0bWxfaWQgKSApIDogJyc7XHJcblx0XHRcdFx0ZC5uYW1lICAgID0gcy5zYW5pdGl6ZV9odG1sX25hbWUoIFN0cmluZyggZC5uYW1lIHx8IGQuaWQgfHwgJ2ZpZWxkJyApICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZC5odG1sX2lkID0gZC5odG1sX2lkID8gU3RyaW5nKCBkLmh0bWxfaWQgKSA6ICcnO1xyXG5cdFx0XHRcdGQubmFtZSAgICA9IFN0cmluZyggZC5uYW1lIHx8IGQuaWQgfHwgJ2ZpZWxkJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGYWxsIGJhY2sgdG8gZ2VuZXJpYyBwcmV2aWV3IGlmIHRlbXBsYXRlIG5vdCBhdmFpbGFibGUuXHJcblx0XHRcdGlmICggY29tcGlsZSApIHtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSBjb21waWxlKCBkICk7XHJcblxyXG5cdFx0XHRcdC8vIEFmdGVyIHJlbmRlciwgc2V0IGF0dHJpYnV0ZSB2YWx1ZXMgdmlhIERPTSBzbyBxdW90ZXMvbmV3bGluZXMgYXJlIGhhbmRsZWQgY29ycmVjdGx5LlxyXG5cdFx0XHRcdGNvbnN0IGlucHV0ID0gZWwucXVlcnlTZWxlY3RvciggJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0JyApO1xyXG5cdFx0XHRcdGlmICggaW5wdXQgKSB7XHJcblx0XHRcdFx0XHRpZiAoIGQucGxhY2Vob2xkZXIgIT0gbnVsbCApIGlucHV0LnNldEF0dHJpYnV0ZSggJ3BsYWNlaG9sZGVyJywgU3RyaW5nKCBkLnBsYWNlaG9sZGVyICkgKTtcclxuXHRcdFx0XHRcdGlmICggZC50aXRsZSAhPSBudWxsICkgaW5wdXQuc2V0QXR0cmlidXRlKCAndGl0bGUnLCBTdHJpbmcoIGQudGl0bGUgKSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZWwuaW5uZXJIVE1MID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIucmVuZGVyX2ZpZWxkX2lubmVyX2h0bWwoIGQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZWwuZGF0YXNldC50eXBlID0gZC50eXBlIHx8ICdmaWVsZCc7XHJcblx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbGFiZWwnLCAoZC5sYWJlbCAhPSBudWxsID8gU3RyaW5nKCBkLmxhYmVsICkgOiAnJykgKTsgLy8gYWxsb3cgXCJcIi5cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPUFRJT05BTCBob29rIGV4ZWN1dGVkIGFmdGVyIGZpZWxkIGlzIGRyb3BwZWQvbG9hZGVkL3ByZXZpZXcuXHJcblx0XHQgKiBEZWZhdWx0IGV4dGVuZGVkOlxyXG5cdFx0ICogLSBPbiBmaXJzdCBkcm9wOiBzdGFtcCBkZWZhdWx0IGxhYmVsIChleGlzdGluZyBiZWhhdmlvcikgYW5kIG1hcmsgZmllbGQgYXMgXCJmcmVzaFwiIGZvciBhdXRvLW5hbWUuXHJcblx0XHQgKiAtIE9uIGxvYWQ6IG1hcmsgYXMgbG9hZGVkIHNvIGxhdGVyIGxhYmVsIGVkaXRzIGRvIG5vdCByZW5hbWUgdGhlIHNhdmVkIG5hbWUuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBtZXRhKSB7XHJcblxyXG5cdFx0XHRjb25zdCBjb250ZXh0ID0gKG1ldGEgJiYgbWV0YS5jb250ZXh0KSA/IFN0cmluZyggbWV0YS5jb250ZXh0ICkgOiAnJztcclxuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdC8vIE5FVzogU2VlZCBkZWZhdWx0IFwiaGVscFwiIChhbmQga2VlcCBpdCBpbiBTdHJ1Y3R1cmUpIGZvciBhbGwgZmllbGQgcGFja3MgdGhhdCBkZWZpbmUgaXQuXHJcblx0XHRcdC8vIFRoaXMgZml4ZXMgdGhlIG1pc21hdGNoIHdoZXJlOlxyXG5cdFx0XHQvLyAgIC0gVUkgc2hvd3MgZGVmYXVsdCBoZWxwIHZpYSBub3JtYWxpemVfZGF0YSgpIC8gdGVtcGxhdGVzXHJcblx0XHRcdC8vICAgLSBidXQgZ2V0X3N0cnVjdHVyZSgpIC8gZXhwb3J0ZXJzIHNlZSBgaGVscGAgYXMgdW5kZWZpbmVkL2VtcHR5LlxyXG5cdFx0XHQvL1xyXG5cdFx0XHQvLyBCZWhhdmlvcjpcclxuXHRcdFx0Ly8gICAtIFJ1bnMgT05MWSBvbiBpbml0aWFsIGRyb3AgKGNvbnRleHQgPT09ICdkcm9wJykuXHJcblx0XHRcdC8vICAgLSBJZiBnZXRfZGVmYXVsdHMoKSBleHBvc2VzIGEgbm9uLWVtcHR5IFwiaGVscFwiLCBhbmQgZGF0YS5oZWxwIGlzXHJcblx0XHRcdC8vICAgICBtaXNzaW5nIC8gbnVsbCAvIGVtcHR5IHN0cmluZyAtPiB3ZSBwZXJzaXN0IHRoZSBkZWZhdWx0IGludG8gYGRhdGFgXHJcblx0XHRcdC8vICAgICBhbmQgbm90aWZ5IFN0cnVjdHVyZSBzbyBleHBvcnRzIHNlZSBpdC5cclxuXHRcdFx0Ly8gICAtIE9uIFwibG9hZFwiIHdlIGRvIG5vdGhpbmcsIHNvIGV4aXN0aW5nIGZvcm1zIHdoZXJlIHVzZXIgKmNsZWFyZWQqXHJcblx0XHRcdC8vICAgICBoZWxwIHdpbGwgbm90IGJlIG92ZXJyaWRkZW4uXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGlmICggY29udGV4dCA9PT0gJ2Ryb3AnICYmIGRhdGEgKSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGNvbnN0IGRlZnMgPSAodHlwZW9mIHRoaXMuZ2V0X2RlZmF1bHRzID09PSAnZnVuY3Rpb24nKSA/IHRoaXMuZ2V0X2RlZmF1bHRzKCkgOiBudWxsO1xyXG5cdFx0XHRcdFx0aWYgKCBkZWZzICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZGVmcywgJ2hlbHAnICkgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGN1cnJlbnQgICAgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGRhdGEsICdoZWxwJyApID8gZGF0YS5oZWxwIDogdW5kZWZpbmVkO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBoYXNWYWx1ZSAgID0gKGN1cnJlbnQgIT09IHVuZGVmaW5lZCAmJiBjdXJyZW50ICE9PSBudWxsICYmIFN0cmluZyggY3VycmVudCApICE9PSAnJyk7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGRlZmF1bHRWYWwgPSBkZWZzLmhlbHA7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICEgaGFzVmFsdWUgJiYgZGVmYXVsdFZhbCAhPSBudWxsICYmIFN0cmluZyggZGVmYXVsdFZhbCApICE9PSAnJyApIHtcclxuXHRcdFx0XHRcdFx0XHQvLyAxKSBwZXJzaXN0IGludG8gZGF0YSBvYmplY3QgKHVzZWQgYnkgU3RydWN0dXJlKS5cclxuXHRcdFx0XHRcdFx0XHRkYXRhLmhlbHAgPSBkZWZhdWx0VmFsO1xyXG5cclxuXHRcdFx0XHRcdFx0XHQvLyAyKSBtaXJyb3IgaW50byBkYXRhc2V0IChmb3IgYW55IERPTS1iYXNlZCBjb25zdW1lcnMpLlxyXG5cdFx0XHRcdFx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRlbC5kYXRhc2V0LmhlbHAgPSBTdHJpbmcoIGRlZmF1bHRWYWwgKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHQvLyAzKSBub3RpZnkgU3RydWN0dXJlIC8gbGlzdGVuZXJzIChpZiBhdmFpbGFibGUpLlxyXG5cdFx0XHRcdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0Q29yZS5TdHJ1Y3R1cmU/LnVwZGF0ZV9maWVsZF9wcm9wPy4oIGVsLCAnaGVscCcsIGRlZmF1bHRWYWwgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0ZWwuZGlzcGF0Y2hFdmVudChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7IGJ1YmJsZXM6IHRydWUsIGRldGFpbCA6IHsga2V5OiAnaGVscCcsIHZhbHVlOiBkZWZhdWx0VmFsIH0gfSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdFx0XHR9IGNhdGNoICggX2lubmVyICkge31cclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0XHRpZiAoIGNvbnRleHQgPT09ICdkcm9wJyAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkYXRhLCAnbGFiZWwnICkgKSB7XHJcblx0XHRcdFx0Y29uc3QgZGVmcyA9IHRoaXMuZ2V0X2RlZmF1bHRzKCk7XHJcblx0XHRcdFx0ZGF0YS5sYWJlbCA9IGRlZnMubGFiZWwgfHwgJ0ZpZWxkJztcclxuXHRcdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWxhYmVsJywgZGF0YS5sYWJlbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIE1hcmsgcHJvdmVuYW5jZSBmbGFncy5cclxuXHRcdFx0aWYgKCBjb250ZXh0ID09PSAnZHJvcCcgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5mcmVzaCAgICAgID0gJzEnOyAgIC8vIGNhbiBhdXRvLW5hbWUgb24gZmlyc3QgbGFiZWwgZWRpdC5cclxuXHRcdFx0XHRlbC5kYXRhc2V0LmF1dG9uYW1lICAgPSAnMSc7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC53YXNfbG9hZGVkID0gJzAnO1xyXG5cdFx0XHRcdC8vIFNlZWQgYSBwcm92aXNpb25hbCB1bmlxdWUgbmFtZSBpbW1lZGlhdGVseS5cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0Y29uc3QgYiA9IG1ldGE/LmJ1aWxkZXI7XHJcblx0XHRcdFx0XHRpZiAoIGI/LmlkICYmICghZWwuaGFzQXR0cmlidXRlKCAnZGF0YS1uYW1lJyApIHx8ICFlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLW5hbWUnICkpICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBTICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgYmFzZSA9IFMuc2FuaXRpemVfaHRtbF9uYW1lKCBlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWlkJyApIHx8IGRhdGE/LmlkIHx8IGRhdGE/LnR5cGUgfHwgJ2ZpZWxkJyApO1xyXG5cdFx0XHRcdFx0XHRjb25zdCB1bmlxID0gYi5pZC5lbnN1cmVfdW5pcXVlX2ZpZWxkX25hbWUoIGJhc2UsIGVsICk7XHJcblx0XHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbmFtZScsIHVuaXEgKTtcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5uYW1lX3VzZXJfdG91Y2hlZCA9ICcwJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBjb250ZXh0ID09PSAnbG9hZCcgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5mcmVzaCAgICAgID0gJzAnO1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQuYXV0b25hbWUgICA9ICcwJztcclxuXHRcdFx0XHRlbC5kYXRhc2V0Lndhc19sb2FkZWQgPSAnMSc7ICAgLy8gbmV2ZXIgcmVuYW1lIG5hbWVzIGZvciBsb2FkZWQgZmllbGRzLlxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tIEF1dG8gUmVuYW1lIFwiRnJlc2hcIiBmaWVsZCwgIG9uIGVudGVyaW5nIHRoZSBuZXcgTGFiZWwgLS0tXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYSBjb25zZXJ2YXRpdmUgZmllbGQgXCJuYW1lXCIgZnJvbSBhIGh1bWFuIGxhYmVsLlxyXG5cdFx0ICogVXNlcyB0aGUgc2FtZSBjb25zdHJhaW50cyBhcyBzYW5pdGl6ZV9odG1sX25hbWUgKGxldHRlcnMvZGlnaXRzL18tIGFuZCBsZWFkaW5nIGxldHRlcikuXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBuYW1lX2Zyb21fbGFiZWwobGFiZWwpIHtcclxuXHRcdFx0Y29uc3QgcyA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCBTdHJpbmcoIGxhYmVsID8/ICcnICkgKTtcclxuXHRcdFx0cmV0dXJuIHMudG9Mb3dlckNhc2UoKSB8fCAnZmllbGQnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXV0by1maWxsIGRhdGEtbmFtZSBmcm9tIGxhYmVsIE9OTFkgZm9yIGZyZXNobHkgZHJvcHBlZCBmaWVsZHMgdGhhdCB3ZXJlIG5vdCBlZGl0ZWQgeWV0LlxyXG5cdFx0ICogLSBOZXZlciBydW5zIGZvciBzZWN0aW9ucy5cclxuXHRcdCAqIC0gTmV2ZXIgcnVucyBmb3IgbG9hZGVkL2V4aXN0aW5nIGZpZWxkcy5cclxuXHRcdCAqIC0gU3RvcHMgYXMgc29vbiBhcyB1c2VyIGVkaXRzIHRoZSBOYW1lIG1hbnVhbGx5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXJcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsICAtIC53cGJjX2JmYl9fZmllbGQgZWxlbWVudFxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGxhYmVsVmFsXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBtYXliZV9hdXRvbmFtZV9mcm9tX2xhYmVsKGJ1aWxkZXIsIGVsLCBsYWJlbFZhbCkge1xyXG5cdFx0XHRpZiAoICFidWlsZGVyIHx8ICFlbCApIHJldHVybjtcclxuXHRcdFx0aWYgKCBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGFsbG93QXV0byA9IGVsLmRhdGFzZXQuYXV0b25hbWUgPT09ICcxJztcclxuXHJcblx0XHRcdGNvbnN0IHVzZXJUb3VjaGVkID0gZWwuZGF0YXNldC5uYW1lX3VzZXJfdG91Y2hlZCA9PT0gJzEnO1xyXG5cdFx0XHRjb25zdCBpc0xvYWRlZCAgICA9IGVsLmRhdGFzZXQud2FzX2xvYWRlZCA9PT0gJzEnO1xyXG5cclxuXHRcdFx0aWYgKCAhYWxsb3dBdXRvIHx8IHVzZXJUb3VjaGVkIHx8IGlzTG9hZGVkICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gT25seSBvdmVycmlkZSBwbGFjZWhvbGRlci15IG5hbWVzXHJcblx0XHRcdGNvbnN0IFMgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cclxuXHRcdFx0Y29uc3QgYmFzZSAgID0gdGhpcy5uYW1lX2Zyb21fbGFiZWwoIGxhYmVsVmFsICk7XHJcblx0XHRcdGNvbnN0IHVuaXF1ZSA9IGJ1aWxkZXIuaWQuZW5zdXJlX3VuaXF1ZV9maWVsZF9uYW1lKCBiYXNlLCBlbCApO1xyXG5cdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLW5hbWUnLCB1bmlxdWUgKTtcclxuXHJcblx0XHRcdGNvbnN0IGlucyAgICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRjb25zdCBuYW1lQ3RybCA9IGlucz8ucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJuYW1lXCJdJyApO1xyXG5cdFx0XHRpZiAoIG5hbWVDdHJsICYmICd2YWx1ZScgaW4gbmFtZUN0cmwgJiYgbmFtZUN0cmwudmFsdWUgIT09IHVuaXF1ZSApIG5hbWVDdHJsLnZhbHVlID0gdW5pcXVlO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2VsZWN0X0Jhc2UgKHNoYXJlZCBiYXNlIGZvciBzZWxlY3QtbGlrZSBwYWNrcylcclxuXHQgKlxyXG5cdCAqIEB0eXBlIHtDb3JlLldQQkNfQkZCX1NlbGVjdF9CYXNlfVxyXG5cdCAqL1xyXG5cdENvcmUuV1BCQ19CRkJfU2VsZWN0X0Jhc2UgPSBjbGFzcyBleHRlbmRzIENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZSB7XHJcblxyXG5cdFx0c3RhdGljIHRlbXBsYXRlX2lkICAgICAgICAgICAgPSBudWxsOyAgICAgICAgICAgICAgICAgLy8gbWFpbiBwcmV2aWV3IHRlbXBsYXRlIGlkXHJcblx0XHRzdGF0aWMgb3B0aW9uX3Jvd190ZW1wbGF0ZV9pZCA9ICd3cGJjLWJmYi1pbnNwZWN0b3Itc2VsZWN0LW9wdGlvbi1yb3cnOyAvLyByb3cgdHBsIGlkXHJcblx0XHRzdGF0aWMga2luZCAgICAgICAgICAgICAgICAgICA9ICdzZWxlY3QnO1xyXG5cdFx0c3RhdGljIF9fcm9vdF93aXJlZCAgICAgICAgICAgPSBmYWxzZTtcclxuXHRcdHN0YXRpYyBfX3Jvb3Rfbm9kZSAgICAgICAgICAgID0gbnVsbDtcclxuXHJcblx0XHQvLyBTaW5nbGUgc291cmNlIG9mIHNlbGVjdG9ycyB1c2VkIGJ5IHRoZSBpbnNwZWN0b3IgVUkuXHJcblx0XHRzdGF0aWMgdWkgPSB7XHJcblx0XHRcdGxpc3QgICA6ICcud3BiY19iZmJfX29wdGlvbnNfbGlzdCcsXHJcblx0XHRcdGhvbGRlciA6ICcud3BiY19iZmJfX29wdGlvbnNfc3RhdGVbZGF0YS1pbnNwZWN0b3Ita2V5PVwib3B0aW9uc1wiXScsXHJcblx0XHRcdHJvdyAgICA6ICcud3BiY19iZmJfX29wdGlvbnNfcm93JyxcclxuXHRcdFx0bGFiZWwgIDogJy53cGJjX2JmYl9fb3B0LWxhYmVsJyxcclxuXHRcdFx0dmFsdWUgIDogJy53cGJjX2JmYl9fb3B0LXZhbHVlJyxcclxuXHRcdFx0dG9nZ2xlIDogJy53cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoaycsXHJcblx0XHRcdGFkZF9idG46ICcuanMtYWRkLW9wdGlvbicsXHJcblxyXG5cdFx0XHRkcmFnX2hhbmRsZSAgICAgIDogJy53cGJjX2JmYl9fZHJhZy1oYW5kbGUnLFxyXG5cdFx0XHRtdWx0aXBsZV9jaGsgICAgIDogJy5qcy1vcHQtbXVsdGlwbGVbZGF0YS1pbnNwZWN0b3Ita2V5PVwibXVsdGlwbGVcIl0nLFxyXG5cdFx0XHRkZWZhdWx0X3RleHQgICAgIDogJy5qcy1kZWZhdWx0LXZhbHVlW2RhdGEtaW5zcGVjdG9yLWtleT1cImRlZmF1bHRfdmFsdWVcIl0nLFxyXG5cdFx0XHRwbGFjZWhvbGRlcl9pbnB1dDogJy5qcy1wbGFjZWhvbGRlcltkYXRhLWluc3BlY3Rvci1rZXk9XCJwbGFjZWhvbGRlclwiXScsXHJcblx0XHRcdHBsYWNlaG9sZGVyX25vdGUgOiAnLmpzLXBsYWNlaG9sZGVyLW5vdGUnLFxyXG5cdFx0XHRzaXplX2lucHV0ICAgICAgIDogJy5pbnNwZWN0b3JfX2lucHV0W2RhdGEtaW5zcGVjdG9yLWtleT1cInNpemVcIl0nLFxyXG5cclxuXHRcdFx0Ly8gRHJvcGRvd24gbWVudSBpbnRlZ3JhdGlvbi5cclxuXHRcdFx0bWVudV9yb290ICA6ICcud3BiY191aV9lbF9fZHJvcGRvd24nLFxyXG5cdFx0XHRtZW51X3RvZ2dsZTogJ1tkYXRhLXRvZ2dsZT1cIndwYmNfZHJvcGRvd25cIl0nLFxyXG5cdFx0XHRtZW51X2FjdGlvbjogJy51bF9kcm9wZG93bl9tZW51X2xpX2FjdGlvbltkYXRhLWFjdGlvbl0nLFxyXG5cdFx0XHQvLyBWYWx1ZS1kaWZmZXJzIHRvZ2dsZS5cclxuXHRcdFx0dmFsdWVfZGlmZmVyc19jaGs6ICcuanMtdmFsdWUtZGlmZmVyc1tkYXRhLWluc3BlY3Rvci1rZXk9XCJ2YWx1ZV9kaWZmZXJzXCJdJyxcclxuXHRcdH07XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBvcHRpb24gdmFsdWUgZnJvbSBsYWJlbC5cclxuXHRcdCAqIC0gSWYgYGRpZmZlcnMgPT09IHRydWVgIC0+IGdlbmVyYXRlIHRva2VuIChzbHVnLWxpa2UgbWFjaGluZSB2YWx1ZSkuXHJcblx0XHQgKiAtIElmIGBkaWZmZXJzID09PSBmYWxzZWAgLT4ga2VlcCBodW1hbiB0ZXh0OyBlc2NhcGUgb25seSBkYW5nZXJvdXMgY2hhcnMuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGFiZWxcclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gZGlmZmVyc1xyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIGJ1aWxkX3ZhbHVlX2Zyb21fbGFiZWwobGFiZWwsIGRpZmZlcnMpIHtcclxuXHRcdFx0Y29uc3QgUyA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdGlmICggZGlmZmVycyApIHtcclxuXHRcdFx0XHRyZXR1cm4gKFMgJiYgdHlwZW9mIFMudG9fdG9rZW4gPT09ICdmdW5jdGlvbicpXHJcblx0XHRcdFx0XHQ/IFMudG9fdG9rZW4oIFN0cmluZyggbGFiZWwgfHwgJycgKSApXHJcblx0XHRcdFx0XHQ6IFN0cmluZyggbGFiZWwgfHwgJycgKS50cmltKCkudG9Mb3dlckNhc2UoKS5yZXBsYWNlKCAvXFxzKy9nLCAnXycgKS5yZXBsYWNlKCAvW15cXHctXS9nLCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIHNpbmdsZS1pbnB1dCBtb2RlOiBrZWVwIGh1bWFuIHRleHQ7IHRlbXBsYXRlIHdpbGwgZXNjYXBlIHNhZmVseS5cclxuXHRcdFx0cmV0dXJuIFN0cmluZyggbGFiZWwgPT0gbnVsbCA/ICcnIDogbGFiZWwgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIHRoZSDigJx2YWx1ZSBkaWZmZXJzIGZyb20gbGFiZWzigJ0gdG9nZ2xlIGVuYWJsZWQ/XHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbFxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBpc192YWx1ZV9kaWZmZXJzX2VuYWJsZWQocGFuZWwpIHtcclxuXHRcdFx0Y29uc3QgY2hrID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkudmFsdWVfZGlmZmVyc19jaGsgKTtcclxuXHRcdFx0cmV0dXJuICEhKGNoayAmJiBjaGsuY2hlY2tlZCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbnN1cmUgdmlzaWJpbGl0eS9lbmFibGVkIHN0YXRlIG9mIFZhbHVlIGlucHV0cyBiYXNlZCBvbiB0aGUgdG9nZ2xlLlxyXG5cdFx0ICogV2hlbiBkaXNhYmxlZCAtPiBoaWRlIFZhbHVlIGlucHV0cyBhbmQga2VlcCB0aGVtIG1pcnJvcmVkIGZyb20gTGFiZWwuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbFxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGRpZmZlcnMgPSB0aGlzLmlzX3ZhbHVlX2RpZmZlcnNfZW5hYmxlZCggcGFuZWwgKTtcclxuXHRcdFx0Y29uc3Qgcm93cyAgICA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLnVpLnJvdyApIHx8IFtdO1xyXG5cclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgcm93cy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRjb25zdCByICAgICAgPSByb3dzW2ldO1xyXG5cdFx0XHRcdGNvbnN0IGxibF9pbiA9IHIucXVlcnlTZWxlY3RvciggdGhpcy51aS5sYWJlbCApO1xyXG5cdFx0XHRcdGNvbnN0IHZhbF9pbiA9IHIucXVlcnlTZWxlY3RvciggdGhpcy51aS52YWx1ZSApO1xyXG5cdFx0XHRcdGlmICggIXZhbF9pbiApIGNvbnRpbnVlO1xyXG5cclxuXHRcdFx0XHRpZiAoIGRpZmZlcnMgKSB7XHJcblx0XHRcdFx0XHQvLyBSZS1lbmFibGUgJiBzaG93IHZhbHVlIGlucHV0XHJcblx0XHRcdFx0XHR2YWxfaW4ucmVtb3ZlQXR0cmlidXRlKCAnZGlzYWJsZWQnICk7XHJcblx0XHRcdFx0XHR2YWxfaW4uc3R5bGUuZGlzcGxheSA9ICcnO1xyXG5cclxuXHRcdFx0XHRcdC8vIElmIHdlIGhhdmUgYSBjYWNoZWQgY3VzdG9tIHZhbHVlIGFuZCB0aGUgcm93IHdhc24ndCBlZGl0ZWQgd2hpbGUgT0ZGLCByZXN0b3JlIGl0XHJcblx0XHRcdFx0XHRjb25zdCBoYXNDYWNoZSAgID0gISF2YWxfaW4uZGF0YXNldC5jYWNoZWRfdmFsdWU7XHJcblx0XHRcdFx0XHRjb25zdCB1c2VyRWRpdGVkID0gci5kYXRhc2V0LnZhbHVlX3VzZXJfdG91Y2hlZCA9PT0gJzEnO1xyXG5cclxuXHRcdFx0XHRcdGlmICggaGFzQ2FjaGUgJiYgIXVzZXJFZGl0ZWQgKSB7XHJcblx0XHRcdFx0XHRcdHZhbF9pbi52YWx1ZSA9IHZhbF9pbi5kYXRhc2V0LmNhY2hlZF92YWx1ZTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoICFoYXNDYWNoZSApIHtcclxuXHRcdFx0XHRcdFx0Ly8gTm8gY2FjaGU6IGlmIHZhbHVlIGlzIGp1c3QgYSBtaXJyb3JlZCBsYWJlbCwgb2ZmZXIgYSB0b2tlbml6ZWQgZGVmYXVsdFxyXG5cdFx0XHRcdFx0XHRjb25zdCBsYmwgICAgICA9IGxibF9pbiA/IGxibF9pbi52YWx1ZSA6ICcnO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBtaXJyb3JlZCA9IHRoaXMuYnVpbGRfdmFsdWVfZnJvbV9sYWJlbCggbGJsLCAvKmRpZmZlcnM9Ki9mYWxzZSApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIHZhbF9pbi52YWx1ZSA9PT0gbWlycm9yZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0dmFsX2luLnZhbHVlID0gdGhpcy5idWlsZF92YWx1ZV9mcm9tX2xhYmVsKCBsYmwsIC8qZGlmZmVycz0qL3RydWUgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHQvLyBPTiAtPiBPRkY6IGNhY2hlIG9uY2UsIHRoZW4gbWlycm9yXHJcblx0XHRcdFx0XHRpZiAoICF2YWxfaW4uZGF0YXNldC5jYWNoZWRfdmFsdWUgKSB7XHJcblx0XHRcdFx0XHRcdHZhbF9pbi5kYXRhc2V0LmNhY2hlZF92YWx1ZSA9IHZhbF9pbi52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGNvbnN0IGxibCAgICA9IGxibF9pbiA/IGxibF9pbi52YWx1ZSA6ICcnO1xyXG5cdFx0XHRcdFx0dmFsX2luLnZhbHVlID0gdGhpcy5idWlsZF92YWx1ZV9mcm9tX2xhYmVsKCBsYmwsIC8qZGlmZmVycz0qL2ZhbHNlICk7XHJcblxyXG5cdFx0XHRcdFx0dmFsX2luLnNldEF0dHJpYnV0ZSggJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRcdFx0dmFsX2luLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcblx0XHRcdFx0XHQvLyBOT1RFOiBkbyBOT1QgbWFyayBhcyB1c2VyX3RvdWNoZWQgaGVyZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiB3aGV0aGVyIHRoaXMgcm934oCZcyB2YWx1ZSBoYXMgYmVlbiBlZGl0ZWQgYnkgdXNlci5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvd1xyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBpc19yb3dfdmFsdWVfdXNlcl90b3VjaGVkKHJvdykge1xyXG5cdFx0XHRyZXR1cm4gcm93Py5kYXRhc2V0Py52YWx1ZV91c2VyX3RvdWNoZWQgPT09ICcxJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1hcmsgdGhpcyByb3figJlzIHZhbHVlIGFzIGVkaXRlZCBieSB1c2VyLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBtYXJrX3Jvd192YWx1ZV91c2VyX3RvdWNoZWQocm93KSB7XHJcblx0XHRcdGlmICggcm93ICkgcm93LmRhdGFzZXQudmFsdWVfdXNlcl90b3VjaGVkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5pdGlhbGl6ZSDigJxmcmVzaG5lc3PigJ0gZmxhZ3Mgb24gYSByb3cgKHZhbHVlIHVudG91Y2hlZCkuXHJcblx0XHQgKiBDYWxsIG9uIGNyZWF0aW9uL2FwcGVuZCBvZiByb3dzLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm93XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBpbml0X3Jvd19mcmVzaF9mbGFncyhyb3cpIHtcclxuXHRcdFx0aWYgKCByb3cgKSB7XHJcblx0XHRcdFx0aWYgKCAhcm93LmRhdGFzZXQudmFsdWVfdXNlcl90b3VjaGVkICkge1xyXG5cdFx0XHRcdFx0cm93LmRhdGFzZXQudmFsdWVfdXNlcl90b3VjaGVkID0gJzAnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gZGVmYXVsdHMgKHBhY2tzIGNhbiBvdmVycmlkZSkgLS0tLVxyXG5cdFx0c3RhdGljIGdldF9kZWZhdWx0cygpIHtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHR0eXBlICAgICAgICAgOiB0aGlzLmtpbmQsXHJcblx0XHRcdFx0bGFiZWwgICAgICAgIDogJ1NlbGVjdCcsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgIDogJycsXHJcblx0XHRcdFx0aHRtbF9pZCAgICAgIDogJycsXHJcblx0XHRcdFx0cGxhY2Vob2xkZXIgIDogJy0tLSBTZWxlY3QgLS0tJyxcclxuXHRcdFx0XHRyZXF1aXJlZCAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtdWx0aXBsZSAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRzaXplICAgICAgICAgOiBudWxsLFxyXG5cdFx0XHRcdGNzc2NsYXNzICAgICA6ICcnLFxyXG5cdFx0XHRcdGhlbHAgICAgICAgICA6ICcnLFxyXG5cdFx0XHRcdGRlZmF1bHRfdmFsdWU6ICcnLFxyXG5cdFx0XHRcdG9wdGlvbnMgICAgICA6IFtcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICdPcHRpb24gMScsIHZhbHVlOiAnT3B0aW9uIDEnLCBzZWxlY3RlZDogZmFsc2UgfSxcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICdPcHRpb24gMicsIHZhbHVlOiAnT3B0aW9uIDInLCBzZWxlY3RlZDogZmFsc2UgfSxcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICdPcHRpb24gMycsIHZhbHVlOiAnT3B0aW9uIDMnLCBzZWxlY3RlZDogZmFsc2UgfSxcclxuXHRcdFx0XHRcdHsgbGFiZWw6ICdPcHRpb24gNCcsIHZhbHVlOiAnT3B0aW9uIDQnLCBzZWxlY3RlZDogZmFsc2UgfVxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdFx0bWluX3dpZHRoICAgIDogJzI0MHB4J1xyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gcHJldmlldyByZW5kZXIgKGlkZW1wb3RlbnQpIC0tLS1cclxuXHRcdHN0YXRpYyByZW5kZXIoZWwsIGRhdGEsIGN0eCkge1xyXG5cdFx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGQgPSB0aGlzLm5vcm1hbGl6ZV9kYXRhKCBkYXRhICk7XHJcblxyXG5cdFx0XHRpZiAoIGQubWluX3dpZHRoICE9IG51bGwgKSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC5taW5fd2lkdGggPSBTdHJpbmcoIGQubWluX3dpZHRoICk7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWNvbC1taW4nLCBTdHJpbmcoIGQubWluX3dpZHRoICkgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBkLmh0bWxfaWQgIT0gbnVsbCApIGVsLmRhdGFzZXQuaHRtbF9pZCA9IFN0cmluZyggZC5odG1sX2lkIHx8ICcnICk7XHJcblx0XHRcdGlmICggZC5jc3NjbGFzcyAhPSBudWxsICkgZWwuZGF0YXNldC5jc3NjbGFzcyA9IFN0cmluZyggZC5jc3NjbGFzcyB8fCAnJyApO1xyXG5cdFx0XHRpZiAoIGQucGxhY2Vob2xkZXIgIT0gbnVsbCApIGVsLmRhdGFzZXQucGxhY2Vob2xkZXIgPSBTdHJpbmcoIGQucGxhY2Vob2xkZXIgfHwgJycgKTtcclxuXHJcblx0XHRcdGNvbnN0IHRwbCA9IHRoaXMuZ2V0X3RlbXBsYXRlKCB0aGlzLnRlbXBsYXRlX2lkICk7XHJcblx0XHRcdGlmICggdHlwZW9mIHRwbCAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19lcnJvclwiIHJvbGU9XCJhbGVydFwiPlRlbXBsYXRlIG5vdCBmb3VuZDogJyArIHRoaXMudGVtcGxhdGVfaWQgKyAnLjwvZGl2Pic7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGVsLmlubmVySFRNTCA9IHRwbCggZCApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR3aW5kb3cuX3dwYmM/LmRldj8uZXJyb3I/LiggJ1NlbGVjdF9CYXNlLnJlbmRlcicsIGUgKTtcclxuXHRcdFx0XHRlbC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19lcnJvclwiIHJvbGU9XCJhbGVydFwiPkVycm9yIHJlbmRlcmluZyBmaWVsZCBwcmV2aWV3LjwvZGl2Pic7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRlbC5kYXRhc2V0LnR5cGUgPSBkLnR5cGUgfHwgdGhpcy5raW5kO1xyXG5cdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWxhYmVsJywgKGQubGFiZWwgIT0gbnVsbCA/IFN0cmluZyggZC5sYWJlbCApIDogJycpICk7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdENvcmUuVUk/LldQQkNfQkZCX092ZXJsYXk/LmVuc3VyZT8uKCBjdHg/LmJ1aWxkZXIsIGVsICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICFlbC5kYXRhc2V0Lm9wdGlvbnMgJiYgQXJyYXkuaXNBcnJheSggZC5vcHRpb25zICkgJiYgZC5vcHRpb25zLmxlbmd0aCApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0ZWwuZGF0YXNldC5vcHRpb25zID0gSlNPTi5zdHJpbmdpZnkoIGQub3B0aW9ucyApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gZHJvcCBzZWVkaW5nIChvcHRpb25zICsgcGxhY2Vob2xkZXIpIC0tLS1cclxuXHRcdHN0YXRpYyBvbl9maWVsZF9kcm9wKGRhdGEsIGVsLCBtZXRhKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0c3VwZXIub25fZmllbGRfZHJvcD8uKCBkYXRhLCBlbCwgbWV0YSApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgaXNfZHJvcCA9IChtZXRhICYmIG1ldGEuY29udGV4dCA9PT0gJ2Ryb3AnKTtcclxuXHJcblx0XHRcdGlmICggaXNfZHJvcCApIHtcclxuXHRcdFx0XHRpZiAoICFBcnJheS5pc0FycmF5KCBkYXRhLm9wdGlvbnMgKSB8fCAhZGF0YS5vcHRpb25zLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdGNvbnN0IG9wdHMgICA9ICh0aGlzLmdldF9kZWZhdWx0cygpLm9wdGlvbnMgfHwgW10pLm1hcCggKG8pID0+ICh7XHJcblx0XHRcdFx0XHRcdGxhYmVsICAgOiBvLmxhYmVsLFxyXG5cdFx0XHRcdFx0XHR2YWx1ZSAgIDogby52YWx1ZSxcclxuXHRcdFx0XHRcdFx0c2VsZWN0ZWQ6ICEhby5zZWxlY3RlZFxyXG5cdFx0XHRcdFx0fSkgKTtcclxuXHRcdFx0XHRcdGRhdGEub3B0aW9ucyA9IG9wdHM7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRlbC5kYXRhc2V0Lm9wdGlvbnMgPSBKU09OLnN0cmluZ2lmeSggb3B0cyApO1xyXG5cdFx0XHRcdFx0XHRlbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7IGJ1YmJsZXM6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0ZGV0YWlsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdGtleSAgOiAnb3B0aW9ucycsXHJcblx0XHRcdFx0XHRcdFx0XHR2YWx1ZTogb3B0c1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fSApICk7XHJcblx0XHRcdFx0XHRcdENvcmUuU3RydWN0dXJlPy51cGRhdGVfZmllbGRfcHJvcD8uKCBlbCwgJ29wdGlvbnMnLCBvcHRzICk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IHBoID0gKGRhdGEucGxhY2Vob2xkZXIgPz8gJycpLnRvU3RyaW5nKCkudHJpbSgpO1xyXG5cdFx0XHRcdGlmICggIXBoICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgZGZsdCAgICAgICA9IHRoaXMuZ2V0X2RlZmF1bHRzKCkucGxhY2Vob2xkZXIgfHwgJy0tLSBTZWxlY3QgLS0tJztcclxuXHRcdFx0XHRcdGRhdGEucGxhY2Vob2xkZXIgPSBkZmx0O1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0ZWwuZGF0YXNldC5wbGFjZWhvbGRlciA9IFN0cmluZyggZGZsdCApO1xyXG5cdFx0XHRcdFx0XHRlbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7IGJ1YmJsZXM6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0ZGV0YWlsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdGtleSAgOiAncGxhY2Vob2xkZXInLFxyXG5cdFx0XHRcdFx0XHRcdFx0dmFsdWU6IGRmbHRcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0gKSApO1xyXG5cdFx0XHRcdFx0XHRDb3JlLlN0cnVjdHVyZT8udXBkYXRlX2ZpZWxkX3Byb3A/LiggZWwsICdwbGFjZWhvbGRlcicsIGRmbHQgKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0Ly8gSW5zcGVjdG9yIGhlbHBlcnMgKHNuYWtlX2Nhc2UpXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRcdHN0YXRpYyBnZXRfcGFuZWxfcm9vdChlbCkge1xyXG5cdFx0XHRyZXR1cm4gZWw/LmNsb3Nlc3Q/LiggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApIHx8IGVsPy5jbG9zZXN0Py4oICcud3BiY19iZmJfX2luc3BlY3RvcicgKSB8fCBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBnZXRfbGlzdChwYW5lbCkge1xyXG5cdFx0XHRyZXR1cm4gcGFuZWwgPyBwYW5lbC5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLmxpc3QgKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGdldF9ob2xkZXIocGFuZWwpIHtcclxuXHRcdFx0cmV0dXJuIHBhbmVsID8gcGFuZWwucXVlcnlTZWxlY3RvciggdGhpcy51aS5ob2xkZXIgKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIG1ha2VfdWlkKCkge1xyXG5cdFx0XHRyZXR1cm4gJ3dwYmNfaW5zX2F1dG9fb3B0XycgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCAxMCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBhcHBlbmRfcm93KHBhbmVsLCBkYXRhKSB7XHJcblx0XHRcdGNvbnN0IGxpc3QgPSB0aGlzLmdldF9saXN0KCBwYW5lbCApO1xyXG5cdFx0XHRpZiAoICFsaXN0ICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgaWR4ICA9IGxpc3QuY2hpbGRyZW4ubGVuZ3RoO1xyXG5cdFx0XHRjb25zdCByb3dkID0gT2JqZWN0LmFzc2lnbiggeyBsYWJlbDogJycsIHZhbHVlOiAnJywgc2VsZWN0ZWQ6IGZhbHNlLCBpbmRleDogaWR4IH0sIChkYXRhIHx8IHt9KSApO1xyXG5cdFx0XHRpZiAoICFyb3dkLnVpZCApIHJvd2QudWlkID0gdGhpcy5tYWtlX3VpZCgpO1xyXG5cclxuXHRcdFx0Y29uc3QgdHBsX2lkID0gdGhpcy5vcHRpb25fcm93X3RlbXBsYXRlX2lkO1xyXG5cdFx0XHRjb25zdCB0cGwgICAgPSAod2luZG93LndwICYmIHdwLnRlbXBsYXRlKSA/IHdwLnRlbXBsYXRlKCB0cGxfaWQgKSA6IG51bGw7XHJcblx0XHRcdGNvbnN0IGh0bWwgICA9IHRwbCA/IHRwbCggcm93ZCApIDogbnVsbDtcclxuXHJcblx0XHRcdC8vIEluIGFwcGVuZF9yb3coKSAtPiBmYWxsYmFjayBIVE1MLlxyXG5cdFx0XHRjb25zdCB3cmFwICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdHdyYXAuaW5uZXJIVE1MID0gaHRtbCB8fCAoXHJcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0aW9uc19yb3dcIiBkYXRhLWluZGV4PVwiJyArIChyb3dkLmluZGV4IHx8IDApICsgJ1wiPicgK1xyXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwid3BiY19iZmJfX2RyYWctaGFuZGxlXCI+PHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9kcmFnX2luZGljYXRvclwiPjwvc3Bhbj48L3NwYW4+JyArXHJcblx0XHRcdFx0XHQnPGlucHV0IHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LWxhYmVsXCIgcGxhY2Vob2xkZXI9XCJMYWJlbFwiIHZhbHVlPVwiJyArIChyb3dkLmxhYmVsIHx8ICcnKSArICdcIj4nICtcclxuXHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cInRleHRcIiBjbGFzcz1cIndwYmNfYmZiX19vcHQtdmFsdWVcIiBwbGFjZWhvbGRlcj1cIlZhbHVlXCIgdmFsdWU9XCInICsgKHJvd2QudmFsdWUgfHwgJycpICsgJ1wiPicgK1xyXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LXNlbGVjdGVkXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwiaW5zcGVjdG9yX19jb250cm9sIHdwYmNfdWlfX3RvZ2dsZVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgY2xhc3M9XCJ3cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoayBpbnNwZWN0b3JfX2lucHV0XCIgaWQ9XCInICsgcm93ZC51aWQgKyAnXCIgcm9sZT1cInN3aXRjaFwiICcgKyAocm93ZC5zZWxlY3RlZCA/ICdjaGVja2VkIGFyaWEtY2hlY2tlZD1cInRydWVcIicgOiAnYXJpYS1jaGVja2VkPVwiZmFsc2VcIicpICsgJz4nICtcclxuXHRcdFx0XHRcdFx0XHQnPGxhYmVsIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlX2ljb25fcmFkaW9cIiBmb3I9XCInICsgcm93ZC51aWQgKyAnXCI+PC9sYWJlbD4nICtcclxuXHRcdFx0XHRcdFx0XHQnPGxhYmVsIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlX2xhYmVsXCIgZm9yPVwiJyArIHJvd2QudWlkICsgJ1wiPkRlZmF1bHQ8L2xhYmVsPicgK1xyXG5cdFx0XHRcdFx0XHQnPC9kaXY+JyArXHJcblx0XHRcdFx0XHQnPC9kaXY+JyArXHJcblx0XHRcdFx0XHQvLyAzLWRvdCBkcm9wZG93biAodXNlcyBleGlzdGluZyBwbHVnaW4gZHJvcGRvd24gSlMpLlxyXG5cdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX3VpX2VsIHdwYmNfdWlfZWxfY29udGFpbmVyIHdwYmNfdWlfZWxfX2Ryb3Bkb3duXCI+JyArXHJcblx0XHRcdFx0XHRcdCc8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgZGF0YS10b2dnbGU9XCJ3cGJjX2Ryb3Bkb3duXCIgYXJpYS1leHBhbmRlZD1cImZhbHNlXCIgY2xhc3M9XCJ1bF9kcm9wZG93bl9tZW51X3RvZ2dsZVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX21vcmVfdmVydFwiPjwvaT4nICtcclxuXHRcdFx0XHRcdFx0JzwvYT4nICtcclxuXHRcdFx0XHRcdFx0Jzx1bCBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVcIiByb2xlPVwibWVudVwiIHN0eWxlPVwicmlnaHQ6MHB4OyBsZWZ0OmF1dG87XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaT4nICtcclxuXHRcdFx0XHRcdFx0XHRcdCc8YSBjbGFzcz1cInVsX2Ryb3Bkb3duX21lbnVfbGlfYWN0aW9uXCIgZGF0YS1hY3Rpb249XCJhZGRfYWZ0ZXJcIiBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCI+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdBZGQgTmV3JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2FkZF9jaXJjbGVcIj48L2k+JyArXHJcblx0XHRcdFx0XHRcdFx0XHQnPC9hPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8L2xpPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8bGk+JyArXHJcblx0XHRcdFx0XHRcdFx0XHQnPGEgY2xhc3M9XCJ1bF9kcm9wZG93bl9tZW51X2xpX2FjdGlvblwiIGRhdGEtYWN0aW9uPVwiZHVwbGljYXRlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnRHVwbGljYXRlJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2NvbnRlbnRfY29weVwiPjwvaT4nICtcclxuXHRcdFx0XHRcdFx0XHRcdCc8L2E+JyArXHJcblx0XHRcdFx0XHRcdFx0JzwvbGk+JyArXHJcblx0XHRcdFx0XHRcdFx0JzxsaSBjbGFzcz1cImRpdmlkZXJcIj48L2xpPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8bGk+JyArXHJcblx0XHRcdFx0XHRcdFx0XHQnPGEgY2xhc3M9XCJ1bF9kcm9wZG93bl9tZW51X2xpX2FjdGlvblwiIGRhdGEtYWN0aW9uPVwicmVtb3ZlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnUmVtb3ZlJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RlbGV0ZV9vdXRsaW5lXCI+PC9pPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0JzwvYT4nICtcclxuXHRcdFx0XHRcdFx0XHQnPC9saT4nICtcclxuXHRcdFx0XHRcdFx0JzwvdWw+JyArXHJcblx0XHRcdFx0XHQnPC9kaXY+JyArXHJcblx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdGNvbnN0IG5vZGUgPSB3cmFwLmZpcnN0RWxlbWVudENoaWxkO1xyXG5cdFx0XHQgaWYgKCEgbm9kZSkge1xyXG5cdFx0XHRcdCByZXR1cm47XHJcblx0XHRcdCB9XHJcblx0XHRcdC8vIHByZS1oaWRlIFZhbHVlIGlucHV0IGlmIHRvZ2dsZSBpcyBPRkYgKipiZWZvcmUqKiBhcHBlbmRpbmcuXHJcblx0XHRcdGNvbnN0IGRpZmZlcnMgPSB0aGlzLmlzX3ZhbHVlX2RpZmZlcnNfZW5hYmxlZCggcGFuZWwgKTtcclxuXHRcdFx0Y29uc3QgdmFsSW4gICA9IG5vZGUucXVlcnlTZWxlY3RvciggdGhpcy51aS52YWx1ZSApO1xyXG5cdFx0XHRjb25zdCBsYmxJbiAgID0gbm9kZS5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLmxhYmVsICk7XHJcblxyXG5cdFx0XHRpZiAoICFkaWZmZXJzICYmIHZhbEluICkge1xyXG5cdFx0XHRcdGlmICggIXZhbEluLmRhdGFzZXQuY2FjaGVkX3ZhbHVlICkge1xyXG5cdFx0XHRcdFx0dmFsSW4uZGF0YXNldC5jYWNoZWRfdmFsdWUgPSB2YWxJbi52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBsYmxJbiApIHZhbEluLnZhbHVlID0gdGhpcy5idWlsZF92YWx1ZV9mcm9tX2xhYmVsKCBsYmxJbi52YWx1ZSwgZmFsc2UgKTtcclxuXHRcdFx0XHR2YWxJbi5zZXRBdHRyaWJ1dGUoICdkaXNhYmxlZCcsICdkaXNhYmxlZCcgKTtcclxuXHRcdFx0XHR2YWxJbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG5cdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0dGhpcy5pbml0X3Jvd19mcmVzaF9mbGFncyggbm9kZSApO1xyXG5cdFx0XHRsaXN0LmFwcGVuZENoaWxkKCBub2RlICk7XHJcblxyXG5cdFx0XHQvLyBLZWVwIHlvdXIgZXhpc3RpbmcgcG9zdC1hcHBlbmQgc3luYyBhcyBhIHNhZmV0eSBuZXRcclxuXHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBjbG9zZV9kcm9wZG93bihhbmNob3JfZWwpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgcm9vdCA9IGFuY2hvcl9lbD8uY2xvc2VzdD8uKCB0aGlzLnVpLm1lbnVfcm9vdCApO1xyXG5cdFx0XHRcdGlmICggcm9vdCApIHtcclxuXHRcdFx0XHRcdC8vIElmIHlvdXIgZHJvcGRvd24gdG9nZ2xlciB0b2dnbGVzIGEgY2xhc3MgbGlrZSAnb3BlbicsIGNsb3NlIGl0LlxyXG5cdFx0XHRcdFx0cm9vdC5jbGFzc0xpc3QucmVtb3ZlKCAnb3BlbicgKTtcclxuXHRcdFx0XHRcdC8vIE9yIGlmIGl0IHJlbGllcyBvbiBhcmlhLWV4cGFuZGVkIG9uIHRoZSB0b2dnbGUuXHJcblx0XHRcdFx0XHR2YXIgdCA9IHJvb3QucXVlcnlTZWxlY3RvciggdGhpcy51aS5tZW51X3RvZ2dsZSApO1xyXG5cdFx0XHRcdFx0aWYgKCB0ICkge1xyXG5cdFx0XHRcdFx0XHR0LnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggXyApIHsgfVxyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBpbnNlcnRfYWZ0ZXIobmV3X25vZGUsIHJlZl9ub2RlKSB7XHJcblx0XHRcdGlmICggcmVmX25vZGU/LnBhcmVudE5vZGUgKSB7XHJcblx0XHRcdFx0aWYgKCByZWZfbm9kZS5uZXh0U2libGluZyApIHtcclxuXHRcdFx0XHRcdHJlZl9ub2RlLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKCBuZXdfbm9kZSwgcmVmX25vZGUubmV4dFNpYmxpbmcgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmVmX25vZGUucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCggbmV3X25vZGUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgY29tbWl0X29wdGlvbnMocGFuZWwpIHtcclxuXHRcdFx0Y29uc3QgbGlzdCAgID0gdGhpcy5nZXRfbGlzdCggcGFuZWwgKTtcclxuXHRcdFx0Y29uc3QgaG9sZGVyID0gdGhpcy5nZXRfaG9sZGVyKCBwYW5lbCApO1xyXG5cdFx0XHRpZiAoICFsaXN0IHx8ICFob2xkZXIgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBkaWZmZXJzID0gdGhpcy5pc192YWx1ZV9kaWZmZXJzX2VuYWJsZWQoIHBhbmVsICk7XHJcblxyXG5cdFx0XHRjb25zdCByb3dzICAgID0gbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLnVpLnJvdyApO1xyXG5cdFx0XHRjb25zdCBvcHRpb25zID0gW107XHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHJvd3MubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0Y29uc3QgciAgICAgID0gcm93c1tpXTtcclxuXHRcdFx0XHRjb25zdCBsYmxfaW4gPSByLnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkubGFiZWwgKTtcclxuXHRcdFx0XHRjb25zdCB2YWxfaW4gPSByLnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkudmFsdWUgKTtcclxuXHRcdFx0XHRjb25zdCBjaGsgICAgPSByLnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkudG9nZ2xlICk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGxibCA9IChsYmxfaW4gJiYgbGJsX2luLnZhbHVlKSB8fCAnJztcclxuXHRcdFx0XHRsZXQgdmFsICAgPSAodmFsX2luICYmIHZhbF9pbi52YWx1ZSkgfHwgJyc7XHJcblxyXG5cdFx0XHRcdC8vIElmIHNpbmdsZS1pbnB1dCBtb2RlIC0+IGhhcmQgbWlycm9yIHRvIGxhYmVsLlxyXG5cdFx0XHRcdGlmICggISBkaWZmZXJzICkge1xyXG5cdFx0XHRcdFx0Ly8gc2luZ2xlLWlucHV0IG1vZGU6IG1pcnJvciBMYWJlbCwgbWluaW1hbCBlc2NhcGluZyAobm8gc2x1ZykuXHJcblx0XHRcdFx0XHR2YWwgPSB0aGlzLmJ1aWxkX3ZhbHVlX2Zyb21fbGFiZWwoIGxibCwgLypkaWZmZXJzPSovZmFsc2UgKTtcclxuXHRcdFx0XHRcdGlmICggdmFsX2luICkge1xyXG5cdFx0XHRcdFx0XHR2YWxfaW4udmFsdWUgPSB2YWw7ICAgLy8ga2VlcCBoaWRkZW4gaW5wdXQgaW4gc3luYyBmb3IgYW55IHByZXZpZXdzL2RlYnVnLlxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3Qgc2VsID0gISEoY2hrICYmIGNoay5jaGVja2VkKTtcclxuXHRcdFx0XHRvcHRpb25zLnB1c2goIHsgbGFiZWw6IGxibCwgdmFsdWU6IHZhbCwgc2VsZWN0ZWQ6IHNlbCB9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0aG9sZGVyLnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoIG9wdGlvbnMgKTtcclxuXHRcdFx0XHRob2xkZXIuZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KCAnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0aG9sZGVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHRwYW5lbC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7XHJcblx0XHRcdFx0XHRidWJibGVzOiB0cnVlLCBkZXRhaWw6IHtcclxuXHRcdFx0XHRcdFx0a2V5OiAnb3B0aW9ucycsIHZhbHVlOiBvcHRpb25zXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnN5bmNfZGVmYXVsdF92YWx1ZV9sb2NrKCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLnN5bmNfcGxhY2Vob2xkZXJfbG9jayggcGFuZWwgKTtcclxuXHJcblx0XHRcdC8vIE1pcnJvciB0byB0aGUgc2VsZWN0ZWQgZmllbGQgZWxlbWVudCBzbyBjYW52YXMvZXhwb3J0IHNlZXMgY3VycmVudCBvcHRpb25zIGltbWVkaWF0ZWx5LlxyXG5cdFx0XHRjb25zdCBmaWVsZCA9IHBhbmVsLl9fc2VsZWN0YmFzZV9maWVsZFxyXG5cdFx0XHRcdHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2ZpZWxkLmlzLXNlbGVjdGVkLCAud3BiY19iZmJfX2ZpZWxkLS1zZWxlY3RlZCcgKTtcclxuXHRcdFx0aWYgKCBmaWVsZCApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0ZmllbGQuZGF0YXNldC5vcHRpb25zID0gSlNPTi5zdHJpbmdpZnkoIG9wdGlvbnMgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Q29yZS5TdHJ1Y3R1cmU/LnVwZGF0ZV9maWVsZF9wcm9wPy4oIGZpZWxkLCAnb3B0aW9ucycsIG9wdGlvbnMgKTtcclxuXHRcdFx0XHRmaWVsZC5kaXNwYXRjaEV2ZW50KCBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjX2JmYl9maWVsZF9kYXRhX2NoYW5nZWQnLCB7XHJcblx0XHRcdFx0XHRidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsga2V5OiAnb3B0aW9ucycsIHZhbHVlOiBvcHRpb25zIH1cclxuXHRcdFx0XHR9ICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRzdGF0aWMgZW5zdXJlX3NvcnRhYmxlKHBhbmVsKSB7XHJcblxyXG5cdFx0XHRjb25zdCBsaXN0ID0gdGhpcy5nZXRfbGlzdCggcGFuZWwgKTtcclxuXHRcdFx0aWYgKCAhIGxpc3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nID0gd2luZG93LlNvcnRhYmxlPy5nZXQ/LiggbGlzdCApO1xyXG5cdFx0XHRcdGlmICggZXhpc3RpbmcgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCBidWlsZGVyID0gd2luZG93LndwYmNfYmZiX2FwaT8uZ2V0X2J1aWxkZXI/LigpIHx8IHdpbmRvdy53cGJjX2JmYiB8fCBudWxsO1xyXG5cclxuXHRcdFx0XHQvLyBQcmVmZXIgdGhlIHNoYXJlZCBTb3J0YWJsZSBtYW5hZ2VyIHNvIHRoZSBzaWRlYmFyIGxpc3QgdXNlc1xyXG5cdFx0XHRcdC8vIHRoZSBkZWRpY2F0ZWQgXCJzaW1wbGVfbGlzdFwiIGNvbmZpZyBpbnN0ZWFkIG9mIHRoZSBjYW52YXMgY29uZmlnLlxyXG5cdFx0XHRcdGlmICggYnVpbGRlciAmJiBidWlsZGVyLnNvcnRhYmxlICYmIHR5cGVvZiBidWlsZGVyLnNvcnRhYmxlLmVuc3VyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHJcblx0XHRcdFx0XHRidWlsZGVyLnNvcnRhYmxlLmVuc3VyZShcclxuXHRcdFx0XHRcdFx0bGlzdCxcclxuXHRcdFx0XHRcdFx0J2NhbnZhcycsXHJcblx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRzb3J0YWJsZV9raW5kICAgICA6ICdzaW1wbGVfbGlzdCcsXHJcblx0XHRcdFx0XHRcdFx0aGFuZGxlX3NlbGVjdG9yICAgOiB0aGlzLnVpLmRyYWdfaGFuZGxlLFxyXG5cdFx0XHRcdFx0XHRcdGRyYWdnYWJsZV9zZWxlY3RvcjogdGhpcy51aS5yb3csXHJcblx0XHRcdFx0XHRcdFx0b25VcGRhdGUgICAgICAgICAgOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmNvbW1pdF9vcHRpb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0fSBlbHNlIGlmICggd2luZG93LlNvcnRhYmxlPy5jcmVhdGUgKSB7XHJcblx0XHRcdFx0XHQvLyBGYWxsYmFjayBpZiBidWlsZGVyIGlzIG5vdCByZWFkeSBmb3Igc29tZSByZWFzb24uXHJcblx0XHRcdFx0XHR3aW5kb3cuU29ydGFibGUuY3JlYXRlKFxyXG5cdFx0XHRcdFx0XHRsaXN0LFxyXG5cdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0aGFuZGxlICAgICAgICAgICA6IHRoaXMudWkuZHJhZ19oYW5kbGUsXHJcblx0XHRcdFx0XHRcdFx0ZHJhZ2dhYmxlICAgICAgICA6IHRoaXMudWkucm93LFxyXG5cdFx0XHRcdFx0XHRcdGFuaW1hdGlvbiAgICAgICAgOiAxMjAsXHJcblx0XHRcdFx0XHRcdFx0Zm9yY2VGYWxsYmFjayAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0ZmFsbGJhY2tPbkJvZHkgICA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0XHRcdGZhbGxiYWNrVG9sZXJhbmNlOiA4LFxyXG5cdFx0XHRcdFx0XHRcdHJlbW92ZUNsb25lT25IaWRlOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdG9uVXBkYXRlICAgICAgICAgOiAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmNvbW1pdF9vcHRpb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxpc3QuZGF0YXNldC5zb3J0YWJsZV9pbml0ID0gJzEnO1xyXG5cclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0d2luZG93Ll93cGJjPy5kZXY/LmVycm9yPy4oICdTZWxlY3RfQmFzZS5lbnN1cmVfc29ydGFibGUnLCBlICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgcmVidWlsZF9pZl9lbXB0eShwYW5lbCkge1xyXG5cdFx0XHRjb25zdCBsaXN0ICAgPSB0aGlzLmdldF9saXN0KCBwYW5lbCApO1xyXG5cdFx0XHRjb25zdCBob2xkZXIgPSB0aGlzLmdldF9ob2xkZXIoIHBhbmVsICk7XHJcblx0XHRcdGlmICggIWxpc3QgfHwgIWhvbGRlciB8fCBsaXN0LmNoaWxkcmVuLmxlbmd0aCApIHJldHVybjtcclxuXHJcblx0XHRcdGxldCBkYXRhID0gW107XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0ZGF0YSA9IEpTT04ucGFyc2UoIGhvbGRlci52YWx1ZSB8fCAnW10nICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdGRhdGEgPSBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAhQXJyYXkuaXNBcnJheSggZGF0YSApIHx8ICFkYXRhLmxlbmd0aCApIHtcclxuXHRcdFx0XHRkYXRhID0gKHRoaXMuZ2V0X2RlZmF1bHRzKCkub3B0aW9ucyB8fCBbXSkuc2xpY2UoIDAgKTtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0aG9sZGVyLnZhbHVlID0gSlNPTi5zdHJpbmdpZnkoIGRhdGEgKTtcclxuXHRcdFx0XHRcdGhvbGRlci5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHRcdGhvbGRlci5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdHRoaXMuYXBwZW5kX3JvdyggcGFuZWwsIHtcclxuXHRcdFx0XHRcdGxhYmVsICAgOiBkYXRhW2ldPy5sYWJlbCB8fCAnJyxcclxuXHRcdFx0XHRcdHZhbHVlICAgOiBkYXRhW2ldPy52YWx1ZSB8fCAnJyxcclxuXHRcdFx0XHRcdHNlbGVjdGVkOiAhIWRhdGFbaV0/LnNlbGVjdGVkLFxyXG5cdFx0XHRcdFx0aW5kZXggICA6IGksXHJcblx0XHRcdFx0XHR1aWQgICAgIDogdGhpcy5tYWtlX3VpZCgpXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnN5bmNfZGVmYXVsdF92YWx1ZV9sb2NrKCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLnN5bmNfcGxhY2Vob2xkZXJfbG9jayggcGFuZWwgKTtcclxuXHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBoYXNfcm93X2RlZmF1bHRzKHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGNoZWNrcyA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLnVpLnRvZ2dsZSApO1xyXG5cdFx0XHRpZiAoICFjaGVja3M/Lmxlbmd0aCApIHJldHVybiBmYWxzZTtcclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgY2hlY2tzLmxlbmd0aDsgaSsrICkgaWYgKCBjaGVja3NbaV0uY2hlY2tlZCApIHJldHVybiB0cnVlO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGlzX211bHRpcGxlX2VuYWJsZWQocGFuZWwpIHtcclxuXHRcdFx0Y29uc3QgY2hrID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkubXVsdGlwbGVfY2hrICk7XHJcblx0XHRcdHJldHVybiAhIShjaGsgJiYgY2hrLmNoZWNrZWQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBoYXNfdGV4dF9kZWZhdWx0X3ZhbHVlKHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGR2ID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkuZGVmYXVsdF90ZXh0ICk7XHJcblx0XHRcdHJldHVybiAhIShkdiAmJiBTdHJpbmcoIGR2LnZhbHVlIHx8ICcnICkudHJpbSgpLmxlbmd0aCk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIHN5bmNfZGVmYXVsdF92YWx1ZV9sb2NrKHBhbmVsKSB7XHJcblx0XHRcdGNvbnN0IGlucHV0ID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkuZGVmYXVsdF90ZXh0ICk7XHJcblx0XHRcdGNvbnN0IG5vdGUgID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoICcuanMtZGVmYXVsdC12YWx1ZS1ub3RlJyApO1xyXG5cdFx0XHRpZiAoICFpbnB1dCApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGxvY2sgICAgID0gdGhpcy5oYXNfcm93X2RlZmF1bHRzKCBwYW5lbCApO1xyXG5cdFx0XHRpbnB1dC5kaXNhYmxlZCA9ICEhbG9jaztcclxuXHRcdFx0aWYgKCBsb2NrICkge1xyXG5cdFx0XHRcdGlucHV0LnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRpZiAoIG5vdGUgKSBub3RlLnN0eWxlLmRpc3BsYXkgPSAnJztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRpbnB1dC5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJyApO1xyXG5cdFx0XHRcdGlmICggbm90ZSApIG5vdGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBzeW5jX3BsYWNlaG9sZGVyX2xvY2socGFuZWwpIHtcclxuXHRcdFx0Y29uc3QgaW5wdXQgPSBwYW5lbD8ucXVlcnlTZWxlY3RvciggdGhpcy51aS5wbGFjZWhvbGRlcl9pbnB1dCApO1xyXG5cdFx0XHRjb25zdCBub3RlICA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLnBsYWNlaG9sZGVyX25vdGUgKTtcclxuXHJcblx0XHRcdC8vIE5FVzogY29tcHV0ZSBtdWx0aXBsZSBhbmQgdG9nZ2xlIHJvdyB2aXNpYmlsaXR5XHJcblx0XHRcdGNvbnN0IGlzTXVsdGlwbGUgICAgID0gdGhpcy5pc19tdWx0aXBsZV9lbmFibGVkKCBwYW5lbCApO1xyXG5cdFx0XHRjb25zdCBwbGFjZWhvbGRlclJvdyA9IGlucHV0Py5jbG9zZXN0KCAnLmluc3BlY3Rvcl9fcm93JyApIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHNpemVJbnB1dCAgICAgID0gcGFuZWw/LnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkuc2l6ZV9pbnB1dCApIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHNpemVSb3cgICAgICAgID0gc2l6ZUlucHV0Py5jbG9zZXN0KCAnLmluc3BlY3Rvcl9fcm93JyApIHx8IG51bGw7XHJcblxyXG5cdFx0XHQvLyBTaG93IHBsYWNlaG9sZGVyIG9ubHkgZm9yIHNpbmdsZS1zZWxlY3Q7IHNob3cgc2l6ZSBvbmx5IGZvciBtdWx0aXBsZVxyXG5cdFx0XHRpZiAoIHBsYWNlaG9sZGVyUm93ICkgcGxhY2Vob2xkZXJSb3cuc3R5bGUuZGlzcGxheSA9IGlzTXVsdGlwbGUgPyAnbm9uZScgOiAnJztcclxuXHRcdFx0aWYgKCBzaXplUm93ICkgc2l6ZVJvdy5zdHlsZS5kaXNwbGF5ID0gaXNNdWx0aXBsZSA/ICcnIDogJ25vbmUnO1xyXG5cclxuXHRcdFx0Ly8gRXhpc3RpbmcgYmVoYXZpb3IgKGtlZXAgYXMtaXMpXHJcblx0XHRcdGlmICggIWlucHV0ICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgbG9jayA9IGlzTXVsdGlwbGUgfHwgdGhpcy5oYXNfcm93X2RlZmF1bHRzKCBwYW5lbCApIHx8IHRoaXMuaGFzX3RleHRfZGVmYXVsdF92YWx1ZSggcGFuZWwgKTtcclxuXHRcdFx0aWYgKCBub3RlICYmICFub3RlLmlkICkgbm90ZS5pZCA9ICd3cGJjX3BsYWNlaG9sZGVyX25vdGVfJyArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDEwICk7XHJcblxyXG5cdFx0XHRpbnB1dC5kaXNhYmxlZCA9ICEhbG9jaztcclxuXHRcdFx0aWYgKCBsb2NrICkge1xyXG5cdFx0XHRcdGlucHV0LnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRpZiAoIG5vdGUgKSB7XHJcblx0XHRcdFx0XHRub3RlLnN0eWxlLmRpc3BsYXkgPSAnJztcclxuXHRcdFx0XHRcdGlucHV0LnNldEF0dHJpYnV0ZSggJ2FyaWEtZGVzY3JpYmVkYnknLCBub3RlLmlkICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGlucHV0LnJlbW92ZUF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnICk7XHJcblx0XHRcdFx0aW5wdXQucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1kZXNjcmliZWRieScgKTtcclxuXHRcdFx0XHRpZiAoIG5vdGUgKSBub3RlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRzdGF0aWMgZW5mb3JjZV9zaW5nbGVfZGVmYXVsdChwYW5lbCwgY2xpY2tlZCkge1xyXG5cdFx0XHRpZiAoIHRoaXMuaXNfbXVsdGlwbGVfZW5hYmxlZCggcGFuZWwgKSApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGNoZWNrcyA9IHBhbmVsPy5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLnVpLnRvZ2dsZSApO1xyXG5cdFx0XHRpZiAoICFjaGVja3M/Lmxlbmd0aCApIHJldHVybjtcclxuXHJcblx0XHRcdGlmICggY2xpY2tlZCAmJiBjbGlja2VkLmNoZWNrZWQgKSB7XHJcblx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgY2hlY2tzLmxlbmd0aDsgaSsrICkgaWYgKCBjaGVja3NbaV0gIT09IGNsaWNrZWQgKSB7XHJcblx0XHRcdFx0XHRjaGVja3NbaV0uY2hlY2tlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0Y2hlY2tzW2ldLnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2xpY2tlZC5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBrZXB0ID0gZmFsc2U7XHJcblx0XHRcdGZvciAoIGxldCBqID0gMDsgaiA8IGNoZWNrcy5sZW5ndGg7IGorKyApIGlmICggY2hlY2tzW2pdLmNoZWNrZWQgKSB7XHJcblx0XHRcdFx0aWYgKCAha2VwdCApIHtcclxuXHRcdFx0XHRcdGtlcHQgPSB0cnVlO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjaGVja3Nbal0uY2hlY2tlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0Y2hlY2tzW2pdLnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsICdmYWxzZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuc3luY19kZWZhdWx0X3ZhbHVlX2xvY2soIHBhbmVsICk7XHJcblx0XHRcdHRoaXMuc3luY19wbGFjZWhvbGRlcl9sb2NrKCBwYW5lbCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gb25lLXRpbWUgYm9vdHN0cmFwIG9mIGEgcGFuZWwgLS0tLVxyXG5cdFx0c3RhdGljIGJvb3RzdHJhcF9wYW5lbChwYW5lbCkge1xyXG5cdFx0XHRpZiAoICFwYW5lbCApIHJldHVybjtcclxuXHRcdFx0aWYgKCAhcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fb3B0aW9uc19lZGl0b3InICkgKSByZXR1cm47IC8vIG9ubHkgc2VsZWN0LWxpa2UgVUlzXHJcblx0XHRcdGlmICggcGFuZWwuZGF0YXNldC5zZWxlY3RiYXNlX2Jvb3RzdHJhcHBlZCA9PT0gJzEnICkge1xyXG5cdFx0XHRcdHRoaXMuZW5zdXJlX3NvcnRhYmxlKCBwYW5lbCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5yZWJ1aWxkX2lmX2VtcHR5KCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLmVuc3VyZV9zb3J0YWJsZSggcGFuZWwgKTtcclxuXHRcdFx0cGFuZWwuZGF0YXNldC5zZWxlY3RiYXNlX2Jvb3RzdHJhcHBlZCA9ICcxJztcclxuXHJcblx0XHRcdHRoaXMuc3luY19kZWZhdWx0X3ZhbHVlX2xvY2soIHBhbmVsICk7XHJcblx0XHRcdHRoaXMuc3luY19wbGFjZWhvbGRlcl9sb2NrKCBwYW5lbCApO1xyXG5cdFx0XHR0aGlzLnN5bmNfdmFsdWVfaW5wdXRzX3Zpc2liaWxpdHkoIHBhbmVsICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLSBob29rIGludG8gaW5zcGVjdG9yIGxpZmVjeWNsZSAoZmlyZXMgT05DRSkgLS0tLVxyXG5cdFx0c3RhdGljIHdpcmVfb25jZSgpIHtcclxuXHRcdFx0aWYgKCBDb3JlLl9fc2VsZWN0YmFzZV93aXJlZCApIHJldHVybjtcclxuXHRcdFx0Q29yZS5fX3NlbGVjdGJhc2Vfd2lyZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0Y29uc3Qgb25fcmVhZHlfb3JfcmVuZGVyID0gKGV2KSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBldj8uZGV0YWlsPy5wYW5lbDtcclxuXHRcdFx0XHRjb25zdCBmaWVsZCA9IGV2Py5kZXRhaWw/LmVsIHx8IGV2Py5kZXRhaWw/LmZpZWxkIHx8IG51bGw7XHJcblx0XHRcdFx0aWYgKCAhcGFuZWwgKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCBmaWVsZCApIHBhbmVsLl9fc2VsZWN0YmFzZV9maWVsZCA9IGZpZWxkO1xyXG5cdFx0XHRcdHRoaXMuYm9vdHN0cmFwX3BhbmVsKCBwYW5lbCApO1xyXG5cdFx0XHRcdC8vIElmIHRoZSBpbnNwZWN0b3Igcm9vdCB3YXMgcmVtb3VudGVkLCBlbnN1cmUgcm9vdCBsaXN0ZW5lcnMgYXJlIChyZSlib3VuZC5cclxuXHRcdFx0XHR0aGlzLndpcmVfcm9vdF9saXN0ZW5lcnMoKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLCBvbl9yZWFkeV9vcl9yZW5kZXIgKTtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZW5kZXInLCBvbl9yZWFkeV9vcl9yZW5kZXIgKTtcclxuXHJcblx0XHRcdHRoaXMud2lyZV9yb290X2xpc3RlbmVycygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyB3aXJlX3Jvb3RfbGlzdGVuZXJzKCkge1xyXG5cclxuXHRcdFx0Ly8gSWYgYWxyZWFkeSB3aXJlZCBBTkQgdGhlIHN0b3JlZCByb290IGlzIHN0aWxsIGluIHRoZSBET00sIGJhaWwgb3V0LlxyXG5cdFx0XHRpZiAoIHRoaXMuX19yb290X3dpcmVkICYmIHRoaXMuX19yb290X25vZGU/LmlzQ29ubmVjdGVkICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0aWYgKCAhcm9vdCApIHtcclxuXHRcdFx0XHQvLyBSb290IG1pc3NpbmcgKGUuZy4sIFNQQSByZS1yZW5kZXIpIOKAlCBjbGVhciBmbGFncyBzbyB3ZSBjYW4gd2lyZSBsYXRlci5cclxuXHRcdFx0XHR0aGlzLl9fcm9vdF93aXJlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdHRoaXMuX19yb290X25vZGUgID0gbnVsbDtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX19yb290X25vZGUgICAgICAgICAgICAgICAgICAgPSByb290O1xyXG5cdFx0XHR0aGlzLl9fcm9vdF93aXJlZCAgICAgICAgICAgICAgICAgID0gdHJ1ZTtcclxuXHRcdFx0cm9vdC5kYXRhc2V0LnNlbGVjdGJhc2Vfcm9vdF93aXJlZCA9ICcxJztcclxuXHJcblx0XHRcdGNvbnN0IGdldF9wYW5lbCA9ICh0YXJnZXQpID0+XHJcblx0XHRcdFx0dGFyZ2V0Py5jbG9zZXN0Py4oICcud3BiY19iZmJfX2luc3BlY3Rvcl9fYm9keScgKSB8fFxyXG5cdFx0XHRcdHJvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ib2R5JyApIHx8IG51bGw7XHJcblxyXG5cdFx0XHQvLyBDbGljayBoYW5kbGVyczogYWRkIC8gZGVsZXRlIC8gZHVwbGljYXRlXHJcblx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgKGUpID0+IHtcclxuXHRcdFx0XHRjb25zdCBwYW5lbCA9IGdldF9wYW5lbCggZS50YXJnZXQgKTtcclxuXHRcdFx0XHRpZiAoICFwYW5lbCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0dGhpcy5ib290c3RyYXBfcGFuZWwoIHBhbmVsICk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHVpID0gdGhpcy51aTtcclxuXHJcblx0XHRcdFx0Ly8gRXhpc3RpbmcgXCJBZGQgb3B0aW9uXCIgYnV0dG9uICh0b3AgdG9vbGJhcilcclxuXHRcdFx0XHRjb25zdCBhZGQgPSBlLnRhcmdldC5jbG9zZXN0Py4oIHVpLmFkZF9idG4gKTtcclxuXHRcdFx0XHRpZiAoIGFkZCApIHtcclxuXHRcdFx0XHRcdHRoaXMuYXBwZW5kX3JvdyggcGFuZWwsIHsgbGFiZWw6ICcnLCB2YWx1ZTogJycsIHNlbGVjdGVkOiBmYWxzZSB9ICk7XHJcblx0XHRcdFx0XHR0aGlzLmNvbW1pdF9vcHRpb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRHJvcGRvd24gbWVudSBhY3Rpb25zLlxyXG5cdFx0XHRcdGNvbnN0IG1lbnVfYWN0aW9uID0gZS50YXJnZXQuY2xvc2VzdD8uKCB1aS5tZW51X2FjdGlvbiApO1xyXG5cdFx0XHRcdGlmICggbWVudV9hY3Rpb24gKSB7XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cclxuXHRcdFx0XHRcdGNvbnN0IGFjdGlvbiA9IChtZW51X2FjdGlvbi5nZXRBdHRyaWJ1dGUoICdkYXRhLWFjdGlvbicgKSB8fCAnJykudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0XHRcdGNvbnN0IHJvdyAgICA9IG1lbnVfYWN0aW9uLmNsb3Nlc3Q/LiggdWkucm93ICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhcm93ICkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmNsb3NlX2Ryb3Bkb3duKCBtZW51X2FjdGlvbiApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAnYWRkX2FmdGVyJyA9PT0gYWN0aW9uICkge1xyXG5cdFx0XHRcdFx0XHQvLyBBZGQgZW1wdHkgcm93IGFmdGVyIGN1cnJlbnRcclxuXHRcdFx0XHRcdFx0Y29uc3QgcHJldl9jb3VudCA9IHRoaXMuZ2V0X2xpc3QoIHBhbmVsICk/LmNoaWxkcmVuLmxlbmd0aCB8fCAwO1xyXG5cdFx0XHRcdFx0XHR0aGlzLmFwcGVuZF9yb3coIHBhbmVsLCB7IGxhYmVsOiAnJywgdmFsdWU6ICcnLCBzZWxlY3RlZDogZmFsc2UgfSApO1xyXG5cdFx0XHRcdFx0XHQvLyBNb3ZlIHRoZSBuZXdseSBhZGRlZCBsYXN0IHJvdyBqdXN0IGFmdGVyIGN1cnJlbnQgcm93IHRvIHByZXNlcnZlIFwiYWRkIGFmdGVyXCJcclxuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdCA9IHRoaXMuZ2V0X2xpc3QoIHBhbmVsICk7XHJcblx0XHRcdFx0XHRcdGlmICggbGlzdCAmJiBsaXN0Lmxhc3RFbGVtZW50Q2hpbGQgJiYgbGlzdC5sYXN0RWxlbWVudENoaWxkICE9PSByb3cgKSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5pbnNlcnRfYWZ0ZXIoIGxpc3QubGFzdEVsZW1lbnRDaGlsZCwgcm93ICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0dGhpcy5jb21taXRfb3B0aW9ucyggcGFuZWwgKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggJ2R1cGxpY2F0ZScgPT09IGFjdGlvbiApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgbGJsID0gKHJvdy5xdWVyeVNlbGVjdG9yKCB1aS5sYWJlbCApIHx8IHt9KS52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdFx0Y29uc3QgdmFsID0gKHJvdy5xdWVyeVNlbGVjdG9yKCB1aS52YWx1ZSApIHx8IHt9KS52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHRcdFx0Y29uc3Qgc2VsID0gISEoKHJvdy5xdWVyeVNlbGVjdG9yKCB1aS50b2dnbGUgKSB8fCB7fSkuY2hlY2tlZCk7XHJcblx0XHRcdFx0XHRcdHRoaXMuYXBwZW5kX3JvdyggcGFuZWwsIHsgbGFiZWw6IGxibCwgdmFsdWU6IHZhbCwgc2VsZWN0ZWQ6IHNlbCwgdWlkOiB0aGlzLm1ha2VfdWlkKCkgfSApO1xyXG5cdFx0XHRcdFx0XHQvLyBQbGFjZSB0aGUgbmV3IHJvdyByaWdodCBhZnRlciB0aGUgY3VycmVudC5cclxuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdCA9IHRoaXMuZ2V0X2xpc3QoIHBhbmVsICk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIGxpc3QgJiYgbGlzdC5sYXN0RWxlbWVudENoaWxkICYmIGxpc3QubGFzdEVsZW1lbnRDaGlsZCAhPT0gcm93ICkge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuaW5zZXJ0X2FmdGVyKCBsaXN0Lmxhc3RFbGVtZW50Q2hpbGQsIHJvdyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHRoaXMuZW5mb3JjZV9zaW5nbGVfZGVmYXVsdCggcGFuZWwsIG51bGwgKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5jb21taXRfb3B0aW9ucyggcGFuZWwgKTtcclxuXHRcdFx0XHRcdFx0dGhpcy5zeW5jX3ZhbHVlX2lucHV0c192aXNpYmlsaXR5KCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggJ3JlbW92ZScgPT09IGFjdGlvbiApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCByb3cgJiYgcm93LnBhcmVudE5vZGUgKSByb3cucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggcm93ICk7XHJcblx0XHRcdFx0XHRcdHRoaXMuY29tbWl0X29wdGlvbnMoIHBhbmVsICk7XHJcblx0XHRcdFx0XHRcdHRoaXMuc3luY192YWx1ZV9pbnB1dHNfdmlzaWJpbGl0eSggcGFuZWwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR0aGlzLmNsb3NlX2Ryb3Bkb3duKCBtZW51X2FjdGlvbiApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHJcblxyXG5cdFx0XHQvLyBJbnB1dCBkZWxlZ2F0aW9uLlxyXG5cdFx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIChlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBnZXRfcGFuZWwoIGUudGFyZ2V0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHBhbmVsICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zdCB1aSAgICAgICAgICAgICAgICA9IHRoaXMudWk7XHJcblx0XHRcdFx0Y29uc3QgaXNfbGFiZWxfb3JfdmFsdWUgPSBlLnRhcmdldC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX29wdC1sYWJlbCcgKSB8fCBlLnRhcmdldC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX29wdC12YWx1ZScgKTtcclxuXHRcdFx0XHRjb25zdCBpc190b2dnbGUgICAgICAgICA9IGUudGFyZ2V0LmNsYXNzTGlzdD8uY29udGFpbnMoICd3cGJjX2JmYl9fb3B0LXNlbGVjdGVkLWNoaycgKTtcclxuXHRcdFx0XHRjb25zdCBpc19tdWx0aXBsZSAgICAgICA9IGUudGFyZ2V0Lm1hdGNoZXM/LiggdWkubXVsdGlwbGVfY2hrICk7XHJcblx0XHRcdFx0Y29uc3QgaXNfZGVmYXVsdF90ZXh0ICAgPSBlLnRhcmdldC5tYXRjaGVzPy4oIHVpLmRlZmF1bHRfdGV4dCApO1xyXG5cdFx0XHRcdGNvbnN0IGlzX3ZhbHVlX2RpZmZlcnMgID0gZS50YXJnZXQubWF0Y2hlcz8uKCB1aS52YWx1ZV9kaWZmZXJzX2NoayApO1xyXG5cclxuXHRcdFx0XHQvLyBIYW5kbGUgXCJ2YWx1ZSBkaWZmZXJzXCIgdG9nZ2xlIGxpdmVcclxuXHRcdFx0XHRpZiAoIGlzX3ZhbHVlX2RpZmZlcnMgKSB7XHJcblx0XHRcdFx0XHR0aGlzLnN5bmNfdmFsdWVfaW5wdXRzX3Zpc2liaWxpdHkoIHBhbmVsICk7XHJcblx0XHRcdFx0XHR0aGlzLmNvbW1pdF9vcHRpb25zKCBwYW5lbCApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gVHJhY2sgd2hlbiB0aGUgdXNlciBlZGl0cyBWQUxVRSBleHBsaWNpdGx5XHJcblx0XHRcdFx0aWYgKCBlLnRhcmdldC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX29wdC12YWx1ZScgKSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHJvdyA9IGUudGFyZ2V0LmNsb3Nlc3QoIHRoaXMudWkucm93ICk7XHJcblx0XHRcdFx0XHR0aGlzLm1hcmtfcm93X3ZhbHVlX3VzZXJfdG91Y2hlZCggcm93ICk7XHJcblx0XHRcdFx0XHQvLyBLZWVwIHRoZSBjYWNoZSB1cGRhdGVkIHNvIHRvZ2dsaW5nIE9GRi9PTiBsYXRlciByZXN0b3JlcyB0aGUgbGF0ZXN0IGN1c3RvbSB2YWx1ZVxyXG5cdFx0XHRcdFx0ZS50YXJnZXQuZGF0YXNldC5jYWNoZWRfdmFsdWUgPSBlLnRhcmdldC52YWx1ZSB8fCAnJztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEF1dG8tZmlsbCBWQUxVRSBmcm9tIExBQkVMIGlmIHZhbHVlIGlzIGZyZXNoIChhbmQgZGlmZmVycyBpcyBPTik7IGlmIGRpZmZlcnMgaXMgT0ZGLCB3ZSBtaXJyb3IgYW55d2F5IGluIGNvbW1pdFxyXG5cdFx0XHRcdGlmICggZS50YXJnZXQuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19vcHQtbGFiZWwnICkgKSB7XHJcblx0XHRcdFx0XHRjb25zdCByb3cgICAgID0gZS50YXJnZXQuY2xvc2VzdCggdWkucm93ICk7XHJcblx0XHRcdFx0XHRjb25zdCB2YWxfaW4gID0gcm93Py5xdWVyeVNlbGVjdG9yKCB1aS52YWx1ZSApO1xyXG5cdFx0XHRcdFx0Y29uc3QgZGlmZmVycyA9IHRoaXMuaXNfdmFsdWVfZGlmZmVyc19lbmFibGVkKCBwYW5lbCApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggdmFsX2luICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoICFkaWZmZXJzICkge1xyXG5cdFx0XHRcdFx0XHRcdC8vIHNpbmdsZS1pbnB1dCBtb2RlOiBtaXJyb3IgaHVtYW4gbGFiZWwgd2l0aCBtaW5pbWFsIGVzY2FwaW5nXHJcblx0XHRcdFx0XHRcdFx0dmFsX2luLnZhbHVlID0gdGhpcy5idWlsZF92YWx1ZV9mcm9tX2xhYmVsKCBlLnRhcmdldC52YWx1ZSwgZmFsc2UgKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggIXRoaXMuaXNfcm93X3ZhbHVlX3VzZXJfdG91Y2hlZCggcm93ICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gc2VwYXJhdGUtdmFsdWUgbW9kZSwgb25seSB3aGlsZSBmcmVzaFxyXG5cdFx0XHRcdFx0XHRcdHZhbF9pbi52YWx1ZSA9IHRoaXMuYnVpbGRfdmFsdWVfZnJvbV9sYWJlbCggZS50YXJnZXQudmFsdWUsIHRydWUgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHRcdGlmICggaXNfbGFiZWxfb3JfdmFsdWUgfHwgaXNfdG9nZ2xlIHx8IGlzX211bHRpcGxlICkge1xyXG5cdFx0XHRcdFx0aWYgKCBpc190b2dnbGUgKSBlLnRhcmdldC5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCBlLnRhcmdldC5jaGVja2VkID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBpc190b2dnbGUgfHwgaXNfbXVsdGlwbGUgKSB0aGlzLmVuZm9yY2Vfc2luZ2xlX2RlZmF1bHQoIHBhbmVsLCBpc190b2dnbGUgPyBlLnRhcmdldCA6IG51bGwgKTtcclxuXHRcdFx0XHRcdHRoaXMuY29tbWl0X29wdGlvbnMoIHBhbmVsICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIGlzX2RlZmF1bHRfdGV4dCApIHtcclxuXHRcdFx0XHRcdHRoaXMuc3luY19kZWZhdWx0X3ZhbHVlX2xvY2soIHBhbmVsICk7XHJcblx0XHRcdFx0XHR0aGlzLnN5bmNfcGxhY2Vob2xkZXJfbG9jayggcGFuZWwgKTtcclxuXHRcdFx0XHRcdGNvbnN0IGhvbGRlciA9IHRoaXMuZ2V0X2hvbGRlciggcGFuZWwgKTtcclxuXHRcdFx0XHRcdGlmICggaG9sZGVyICkge1xyXG5cdFx0XHRcdFx0XHRob2xkZXIuZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KCAnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0XHRcdGhvbGRlci5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0cnVlICk7XHJcblxyXG5cclxuXHRcdFx0Ly8gQ2hhbmdlIGRlbGVnYXRpb25cclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgKGUpID0+IHtcclxuXHRcdFx0XHRjb25zdCBwYW5lbCA9IGdldF9wYW5lbCggZS50YXJnZXQgKTtcclxuXHRcdFx0XHRpZiAoICFwYW5lbCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Y29uc3QgdWkgICAgICAgID0gdGhpcy51aTtcclxuXHRcdFx0XHRjb25zdCBpc190b2dnbGUgPSBlLnRhcmdldC5jbGFzc0xpc3Q/LmNvbnRhaW5zKCAnd3BiY19iZmJfX29wdC1zZWxlY3RlZC1jaGsnICk7XHJcblx0XHRcdFx0Y29uc3QgaXNfbXVsdGkgID0gZS50YXJnZXQubWF0Y2hlcz8uKCB1aS5tdWx0aXBsZV9jaGsgKTtcclxuXHRcdFx0XHRpZiAoICFpc190b2dnbGUgJiYgIWlzX211bHRpICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0XHRpZiAoIGlzX3RvZ2dsZSApIGUudGFyZ2V0LnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsIGUudGFyZ2V0LmNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0dGhpcy5lbmZvcmNlX3NpbmdsZV9kZWZhdWx0KCBwYW5lbCwgaXNfdG9nZ2xlID8gZS50YXJnZXQgOiBudWxsICk7XHJcblx0XHRcdFx0dGhpcy5jb21taXRfb3B0aW9ucyggcGFuZWwgKTtcclxuXHRcdFx0fSwgdHJ1ZSApO1xyXG5cclxuXHRcdFx0Ly8gTGF6eSBib290c3RyYXBcclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2VlbnRlcicsIChlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBnZXRfcGFuZWwoIGUudGFyZ2V0ICk7XHJcblx0XHRcdFx0aWYgKCBwYW5lbCAmJiBlLnRhcmdldD8uY2xvc2VzdD8uKCB0aGlzLnVpLmxpc3QgKSApIHRoaXMuYm9vdHN0cmFwX3BhbmVsKCBwYW5lbCApO1xyXG5cdFx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCAoZSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHBhbmVsID0gZ2V0X3BhbmVsKCBlLnRhcmdldCApO1xyXG5cdFx0XHRcdGlmICggcGFuZWwgJiYgZS50YXJnZXQ/LmNsb3Nlc3Q/LiggdGhpcy51aS5kcmFnX2hhbmRsZSApICkgdGhpcy5ib290c3RyYXBfcGFuZWwoIHBhbmVsICk7XHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxuXHJcblx0dHJ5IHsgQ29yZS5XUEJDX0JGQl9TZWxlY3RfQmFzZS53aXJlX29uY2UoKTsgfSBjYXRjaCAoXykge31cclxuXHQvLyBUcnkgaW1tZWRpYXRlbHkgKGlmIHJvb3QgaXMgYWxyZWFkeSBpbiBET00pLCB0aGVuIGFnYWluIG9uIERPTUNvbnRlbnRMb2FkZWQuXHJcblx0Q29yZS5XUEJDX0JGQl9TZWxlY3RfQmFzZS53aXJlX3Jvb3RfbGlzdGVuZXJzKCk7XHJcblxyXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCAoKSA9PiB7IENvcmUuV1BCQ19CRkJfU2VsZWN0X0Jhc2Uud2lyZV9yb290X2xpc3RlbmVycygpOyAgfSk7XHJcblxyXG59KCB3aW5kb3cgKSk7IiwiLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fb3V0L2NvcmUvYmZiLXVpLmpzID09IHwgMjAyNS0wOS0xMCAxNTo0N1xyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvLyBTaW5nbGUgZ2xvYmFsIG5hbWVzcGFjZSAoaWRlbXBvdGVudCAmIGxvYWQtb3JkZXIgc2FmZSkuXHJcblx0Y29uc3QgQ29yZSA9ICh3LldQQkNfQkZCX0NvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwge30pO1xyXG5cdGNvbnN0IFVJICAgPSAoQ29yZS5VSSA9IENvcmUuVUkgfHwge30pO1xyXG5cclxuXHQvLyAtLS0gSGlnaGxpZ2h0IEVsZW1lbnQsICBsaWtlIEdlbmVyYXRvciBicm4gIC0gIFRpbnkgVUkgaGVscGVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRVSS5fcHVsc2VfdGltZXJzID0gVUkuX3B1bHNlX3RpbWVycyB8fCBuZXcgTWFwKCk7IC8vIGVsIC0+IHRpbWVyX2lkXHJcblx0VUkuX3B1bHNlX21ldGEgICA9IFVJLl9wdWxzZV9tZXRhICAgfHwgbmV3IE1hcCgpOyAvLyBlbCAtPiB7IHRva2VuLCBsYXN0X3RzLCBkZWJvdW5jZV9pZCwgY29sb3Jfc2V0IH1cclxuXHQvLyBQdWxzZSB0dW5pbmcgKG1pbGxpc2Vjb25kcykuXHJcblx0VUkuUFVMU0VfVEhST1RUTEVfTVMgID0gTnVtYmVyLmlzRmluaXRlKCBVSS5QVUxTRV9USFJPVFRMRV9NUyApID8gVUkuUFVMU0VfVEhST1RUTEVfTVMgOiA1MDA7XHJcblx0VUkuUFVMU0VfREVCT1VOQ0VfTVMgID0gTnVtYmVyLmlzRmluaXRlKCBVSS5QVUxTRV9ERUJPVU5DRV9NUyApID8gVUkuUFVMU0VfREVCT1VOQ0VfTVMgOiA3NTA7XHJcblxyXG5cdC8vIERlYm91bmNlIFNUUlVDVFVSRV9DSEFOR0UgZm9yIGNvbnRpbnVvdXMgaW5zcGVjdG9yIGNvbnRyb2xzIChzbGlkZXJzIC8gc2NydWJiaW5nKS5cclxuXHQvLyBUdW5lOiAxODAuLjM1MCBpcyB1c3VhbGx5IGEgc3dlZXQgc3BvdC5cclxuXHRVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TID0gTnVtYmVyLmlzRmluaXRlKCBVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TICkgPyBVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TIDogMTgwO1xyXG5cdC8vIENoYW5nZSB0aGlzIHRvIHR1bmUgc3BlZWQ6IDUwLi4xMjAgbXMgaXMgYSBnb29kIHJhbmdlLiBDYW4gYmUgY29uZmlndXJlZCBpbiA8ZGl2IGRhdGEtbGVuLWdyb3VwIGRhdGEtbGVuLXRocm90dGxlPVwiMTgwXCI+Li4uPC9kaXY+LlxyXG5cdFVJLlZBTFVFX1NMSURFUl9USFJPVFRMRV9NUyA9IE51bWJlci5pc0Zpbml0ZSggVUkuVkFMVUVfU0xJREVSX1RIUk9UVExFX01TICkgPyBVSS5WQUxVRV9TTElERVJfVEhST1RUTEVfTVMgOiAxMjA7XHJcblxyXG5cdC8qKlxyXG5cdCAqIENhbmNlbCBhbnkgcnVubmluZyBwdWxzZSBzZXF1ZW5jZSBmb3IgYW4gZWxlbWVudC5cclxuXHQgKiBVc2VzIHRva2VuIGludmFsaWRhdGlvbiBzbyBhbHJlYWR5LXNjaGVkdWxlZCBjYWxsYmFja3MgYmVjb21lIG5vLW9wcy5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0ICovXHJcblx0VUkuY2FuY2VsX3B1bHNlID0gZnVuY3Rpb24gKGVsKSB7XHJcblx0XHRpZiAoICFlbCApIHsgcmV0dXJuOyB9XHJcblx0XHR0cnkge1xyXG5cdFx0XHRjbGVhclRpbWVvdXQoIFVJLl9wdWxzZV90aW1lcnMuZ2V0KCBlbCApICk7XHJcblx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHRVSS5fcHVsc2VfdGltZXJzLmRlbGV0ZSggZWwgKTtcclxuXHJcblx0XHR2YXIgbWV0YSA9IFVJLl9wdWxzZV9tZXRhLmdldCggZWwgKSB8fCB7fTtcclxuXHRcdG1ldGEudG9rZW4gPSAoTnVtYmVyLmlzRmluaXRlKCBtZXRhLnRva2VuICkgPyBtZXRhLnRva2VuIDogMCkgKyAxO1xyXG5cdFx0bWV0YS5jb2xvcl9zZXQgPSBmYWxzZTtcclxuXHRcdHRyeSB7IGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fc2Nyb2xsLXB1bHNlJywgJ3dwYmNfYmZiX19oaWdobGlnaHQtcHVsc2UnICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdHRyeSB7IGVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1wdWxzZS1jb2xvcicgKTsgfSBjYXRjaCAoIF8gKSB7fVxyXG5cdFx0VUkuX3B1bHNlX21ldGEuc2V0KCBlbCwgbWV0YSApO1xyXG5cdFx0dHJ5IHsgY2xlYXJUaW1lb3V0KCBtZXRhLmRlYm91bmNlX2lkICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdG1ldGEuZGVib3VuY2VfaWQgPSAwO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEZvcmNlLXJlc3RhcnQgYSBDU1MgYW5pbWF0aW9uIG9uIGEgY2xhc3MuXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gY2xzXHJcblx0ICovXHJcblx0VUkuX3Jlc3RhcnRfY3NzX2FuaW1hdGlvbiA9IGZ1bmN0aW9uIChlbCwgY2xzKSB7XHJcblx0XHRpZiAoICEgZWwgKSB7IHJldHVybjsgfVxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0ZWwuY2xhc3NMaXN0LnJlbW92ZSggY2xzICk7XHJcblx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHQvLyBGb3JjZSByZWZsb3cgc28gdGhlIG5leHQgYWRkKCkgcmV0cmlnZ2VycyB0aGUga2V5ZnJhbWVzLlxyXG5cdFx0dm9pZCBlbC5vZmZzZXRXaWR0aDtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGVsLmNsYXNzTGlzdC5hZGQoIGNscyApO1xyXG5cdFx0fSBjYXRjaCAoIF8gKSB7fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdFx0U2luZ2xlIHB1bHNlIChiYWNrLWNvbXBhdCkuXHJcblx0XHRAcGFyYW0ge0hUTUxFbGVtZW50fSBlbFxyXG5cdFx0QHBhcmFtIHtudW1iZXJ9IGR1cl9tc1xyXG5cdCAqL1xyXG5cdFVJLnB1bHNlX29uY2UgPSBmdW5jdGlvbiAoZWwsIGR1cl9tcykge1xyXG5cdFx0aWYgKCAhIGVsICkgeyByZXR1cm47IH1cclxuXHRcdHZhciBjbHMgPSAnd3BiY19iZmJfX3Njcm9sbC1wdWxzZSc7XHJcblx0XHR2YXIgbXMgID0gTnVtYmVyLmlzRmluaXRlKCBkdXJfbXMgKSA/IGR1cl9tcyA6IDcwMDtcclxuXHJcblx0XHRVSS5jYW5jZWxfcHVsc2UoIGVsICk7XHJcblxyXG5cdFx0dmFyIG1ldGEgID0gVUkuX3B1bHNlX21ldGEuZ2V0KCBlbCApIHx8IHt9O1xyXG5cdFx0dmFyIHRva2VuID0gKE51bWJlci5pc0Zpbml0ZSggbWV0YS50b2tlbiApID8gbWV0YS50b2tlbiA6IDApICsgMTtcclxuXHRcdG1ldGEudG9rZW4gPSB0b2tlbjtcclxuXHRcdFVJLl9wdWxzZV9tZXRhLnNldCggZWwsIG1ldGEgKTtcclxuXHJcblx0XHRVSS5fcmVzdGFydF9jc3NfYW5pbWF0aW9uKCBlbCwgY2xzICk7XHJcblx0XHR2YXIgdCA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gaWdub3JlIGlmIGEgbmV3ZXIgcHVsc2Ugc3RhcnRlZC5cclxuXHRcdFx0dmFyIG0gPSBVSS5fcHVsc2VfbWV0YS5nZXQoIGVsICkgfHwge307XHJcblx0XHRcdGlmICggbS50b2tlbiAhPT0gdG9rZW4gKSB7IHJldHVybjsgfVxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUoIGNscyApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHRcdFVJLl9wdWxzZV90aW1lcnMuZGVsZXRlKCBlbCApO1xyXG5cdFx0fSwgbXMgKTtcclxuXHRcdFVJLl9wdWxzZV90aW1lcnMuc2V0KCBlbCwgdCApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdFx0TXVsdGktYmxpbmsgc2VxdWVuY2Ugd2l0aCBvcHRpb25hbCBwZXItY2FsbCBjb2xvciBvdmVycmlkZS5cclxuXHRcdEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblx0XHRAcGFyYW0ge251bWJlcn0gW3RpbWVzPTNdXHJcblx0XHRAcGFyYW0ge251bWJlcn0gW29uX21zPTI4MF1cclxuXHRcdEBwYXJhbSB7bnVtYmVyfSBbb2ZmX21zPTE4MF1cclxuXHRcdEBwYXJhbSB7c3RyaW5nfSBbaGV4X2NvbG9yXSBPcHRpb25hbCBDU1MgY29sb3IgKGUuZy4gJyNmZjRkNGYnIG9yICdyZ2IoLi4uKScpLlxyXG5cdCAqL1xyXG5cdFVJLnB1bHNlX3NlcXVlbmNlID0gZnVuY3Rpb24gKGVsLCB0aW1lcywgb25fbXMsIG9mZl9tcywgaGV4X2NvbG9yKSB7XHJcblx0XHRpZiAoICFlbCB8fCAhZC5ib2R5LmNvbnRhaW5zKCBlbCApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgY2xzICAgPSAnd3BiY19iZmJfX2hpZ2hsaWdodC1wdWxzZSc7XHJcblx0XHR2YXIgY291bnQgPSBOdW1iZXIuaXNGaW5pdGUoIHRpbWVzICkgPyB0aW1lcyA6IDI7XHJcblx0XHR2YXIgb24gICAgPSBOdW1iZXIuaXNGaW5pdGUoIG9uX21zICkgPyBvbl9tcyA6IDI4MDtcclxuXHRcdHZhciBvZmYgICA9IE51bWJlci5pc0Zpbml0ZSggb2ZmX21zICkgPyBvZmZfbXMgOiAxODA7XHJcblxyXG5cdFx0Ly8gVGhyb3R0bGU6IGF2b2lkIHJlZmxvdyBzcGFtIGlmIGNhbGxlZCByZXBlYXRlZGx5IHdoaWxlIHR5cGluZy9kcmFnZ2luZy5cclxuXHRcdHZhciBtZXRhID0gVUkuX3B1bHNlX21ldGEuZ2V0KCBlbCApIHx8IHt9O1xyXG5cdFx0dmFyIG5vdyAgPSBEYXRlLm5vdygpO1xyXG5cdFx0dmFyIHRocm90dGxlX21zID0gTnVtYmVyLmlzRmluaXRlKCBVSS5QVUxTRV9USFJPVFRMRV9NUyApID8gVUkuUFVMU0VfVEhST1RUTEVfTVMgOiAxMjA7XHJcblx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggbWV0YS5sYXN0X3RzICkgJiYgKG5vdyAtIG1ldGEubGFzdF90cykgPCB0aHJvdHRsZV9tcyApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0bWV0YS5sYXN0X3RzID0gbm93O1xyXG5cclxuXHRcdC8vIGNhbmNlbCBhbnkgcnVubmluZyBwdWxzZSBhbmQgcmVzZXQgY2xhc3MgKHRva2VuIGludmFsaWRhdGlvbikuXHJcblx0XHRVSS5jYW5jZWxfcHVsc2UoIGVsICk7XHJcblxyXG5cdFx0Ly8gbmV3IHRva2VuIGZvciB0aGlzIHJ1blxyXG5cdFx0dmFyIHRva2VuID0gKE51bWJlci5pc0Zpbml0ZSggbWV0YS50b2tlbiApID8gbWV0YS50b2tlbiA6IDApICsgMTtcclxuXHRcdG1ldGEudG9rZW4gPSB0b2tlbjtcclxuXHJcblx0XHR2YXIgaGF2ZV9jb2xvciA9ICEhaGV4X2NvbG9yICYmIHR5cGVvZiBoZXhfY29sb3IgPT09ICdzdHJpbmcnO1xyXG5cdFx0aWYgKCBoYXZlX2NvbG9yICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjLWJmYi1wdWxzZS1jb2xvcicsIGhleF9jb2xvciApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHt9XHJcblx0XHRcdG1ldGEuY29sb3Jfc2V0ID0gdHJ1ZTtcclxuXHRcdH1cclxuXHRcdFVJLl9wdWxzZV9tZXRhLnNldCggZWwsIG1ldGEgKTtcclxuXHJcblx0XHR2YXIgaSA9IDA7XHJcblx0XHQoZnVuY3Rpb24gdGljaygpIHtcclxuXHRcdFx0dmFyIG0gPSBVSS5fcHVsc2VfbWV0YS5nZXQoIGVsICkgfHwge307XHJcblx0XHRcdGlmICggbS50b2tlbiAhPT0gdG9rZW4gKSB7XHJcblx0XHRcdFx0Ly8gY2FuY2VsZWQvcmVwbGFjZWRcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBpID49IGNvdW50ICkge1xyXG5cdFx0XHRcdFVJLl9wdWxzZV90aW1lcnMuZGVsZXRlKCBlbCApO1xyXG5cdFx0XHRcdGlmICggaGF2ZV9jb2xvciApIHtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdGVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnLS13cGJjLWJmYi1wdWxzZS1jb2xvcicgKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfICkge31cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdFVJLl9yZXN0YXJ0X2Nzc19hbmltYXRpb24oIGVsLCBjbHMgKTtcclxuXHRcdFx0VUkuX3B1bHNlX3RpbWVycy5zZXQoIGVsLCBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7ICAgICAvLyBPTiAtPiBPRkZcclxuXHRcdFx0XHR2YXIgbTIgPSBVSS5fcHVsc2VfbWV0YS5nZXQoIGVsICkgfHwge307XHJcblx0XHRcdFx0aWYgKCBtMi50b2tlbiAhPT0gdG9rZW4gKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRlbC5jbGFzc0xpc3QucmVtb3ZlKCBjbHMgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0VUkuX3B1bHNlX3RpbWVycy5zZXQoIGVsLCBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7IC8vIE9GRiBnYXAgLT4gbmV4dFxyXG5cdFx0XHRcdFx0dmFyIG0zID0gVUkuX3B1bHNlX21ldGEuZ2V0KCBlbCApIHx8IHt9O1xyXG5cdFx0XHRcdFx0aWYgKCBtMy50b2tlbiAhPT0gdG9rZW4gKSB7IHJldHVybjsgfVxyXG5cdFx0XHRcdFx0aSsrO1xyXG5cdFx0XHRcdFx0dGljaygpO1xyXG5cdFx0XHRcdH0sIG9mZiApICk7XHJcblx0XHRcdH0sIG9uICkgKTtcclxuXHRcdH0pKCk7XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlYm91bmNlZCBxdWVyeSArIHB1bHNlLlxyXG5cdCAqIFVzZWZ1bCBmb3IgYGlucHV0YCBldmVudHMgKHNsaWRlcnMgLyB0eXBpbmcpIHRvIGF2b2lkIGZvcmNlZCByZWZsb3cgc3BhbS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8c3RyaW5nfSByb290X29yX3NlbGVjdG9yXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IHdhaXRfbXNcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gW2FdXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9IFtiXVxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBbY11cclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gW2NvbG9yXVxyXG5cdCAqL1xyXG5cdFVJLnB1bHNlX3F1ZXJ5X2RlYm91bmNlZCA9IGZ1bmN0aW9uIChyb290X29yX3NlbGVjdG9yLCBzZWxlY3Rvciwgd2FpdF9tcywgYSwgYiwgYywgY29sb3IpIHtcclxuXHRcdHZhciByb290ID0gKHR5cGVvZiByb290X29yX3NlbGVjdG9yID09PSAnc3RyaW5nJykgPyBkIDogKHJvb3Rfb3Jfc2VsZWN0b3IgfHwgZCk7XHJcblx0XHR2YXIgc2VsICA9ICh0eXBlb2Ygcm9vdF9vcl9zZWxlY3RvciA9PT0gJ3N0cmluZycpID8gcm9vdF9vcl9zZWxlY3RvciA6IHNlbGVjdG9yO1xyXG5cdFx0aWYgKCAhc2VsICkgeyByZXR1cm47IH1cclxuXHRcdHZhciBlbCA9IHJvb3QucXVlcnlTZWxlY3Rvciggc2VsICk7XHJcblx0XHRpZiAoICFlbCApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIGRlZl9tcyA9IE51bWJlci5pc0Zpbml0ZSggVUkuUFVMU0VfREVCT1VOQ0VfTVMgKSA/IFVJLlBVTFNFX0RFQk9VTkNFX01TIDogMTIwO1xyXG5cdFx0dmFyIG1zICAgICA9IE51bWJlci5pc0Zpbml0ZSggd2FpdF9tcyApID8gd2FpdF9tcyA6IGRlZl9tcztcclxuXHRcdHZhciBtZXRhID0gVUkuX3B1bHNlX21ldGEuZ2V0KCBlbCApIHx8IHt9O1xyXG5cdFx0dHJ5IHsgY2xlYXJUaW1lb3V0KCBtZXRhLmRlYm91bmNlX2lkICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdG1ldGEuZGVib3VuY2VfaWQgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFVJLnB1bHNlX3NlcXVlbmNlKCBlbCwgYSwgYiwgYywgY29sb3IgKTtcclxuXHRcdH0sIG1zICk7XHJcblx0XHRVSS5fcHVsc2VfbWV0YS5zZXQoIGVsLCBtZXRhICk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0XHRRdWVyeSArIHB1bHNlOlxyXG5cdFx0KEJDKSBJZiBvbmx5IDNyZCBhcmcgaXMgYSBudW1iZXIgYW5kIG5vIDR0aC81dGggLT4gc2luZ2xlIGxvbmcgcHVsc2UuXHJcblx0XHRPdGhlcndpc2UgLT4gc3Ryb25nIHNlcXVlbmNlIChkZWZhdWx0cyAzw5cyODAvMTgwKS5cclxuXHRcdE9wdGlvbmFsIDZ0aCBhcmc6IGNvbG9yLlxyXG5cdFx0QHBhcmFtIHtIVE1MRWxlbWVudHxzdHJpbmd9IHJvb3Rfb3Jfc2VsZWN0b3JcclxuXHRcdEBwYXJhbSB7c3RyaW5nfSBbc2VsZWN0b3JdXHJcblx0XHRAcGFyYW0ge251bWJlcn0gW2FdXHJcblx0XHRAcGFyYW0ge251bWJlcn0gW2JdXHJcblxyXG5cdFx0QHBhcmFtIHtudW1iZXJ9IFtjXVxyXG5cclxuXHRcdEBwYXJhbSB7c3RyaW5nfSBbY29sb3JdXHJcblx0ICovXHJcblx0VUkucHVsc2VfcXVlcnkgPSBmdW5jdGlvbiAocm9vdF9vcl9zZWxlY3Rvciwgc2VsZWN0b3IsIGEsIGIsIGMsIGNvbG9yKSB7XHJcblx0XHR2YXIgcm9vdCA9ICh0eXBlb2Ygcm9vdF9vcl9zZWxlY3RvciA9PT0gJ3N0cmluZycpID8gZCA6IChyb290X29yX3NlbGVjdG9yIHx8IGQpO1xyXG5cdFx0dmFyIHNlbCAgPSAodHlwZW9mIHJvb3Rfb3Jfc2VsZWN0b3IgPT09ICdzdHJpbmcnKSA/IHJvb3Rfb3Jfc2VsZWN0b3IgOiBzZWxlY3RvcjtcclxuXHRcdGlmICggIXNlbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBlbCA9IHJvb3QucXVlcnlTZWxlY3Rvciggc2VsICk7XHJcblx0XHRpZiAoICFlbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuLy8gQmFjay1jb21wYXQ6IFVJLnB1bHNlUXVlcnkocm9vdCwgc2VsLCBkdXJfbXMpXHJcblx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggYSApICYmIGIgPT09IHVuZGVmaW5lZCAmJiBjID09PSB1bmRlZmluZWQgKSB7XHJcblx0XHRcdHJldHVybiBVSS5wdWxzZV9vbmNlKCBlbCwgYSApO1xyXG5cdFx0fVxyXG4vLyBOZXc6IHNlcXVlbmNlOyBwYXJhbXMgb3B0aW9uYWw7IHN1cHBvcnRzIG9wdGlvbmFsIGNvbG9yLlxyXG5cdFx0VUkucHVsc2Vfc2VxdWVuY2UoIGVsLCBhLCBiLCBjLCBjb2xvciApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdENvbnZlbmllbmNlIGhlbHBlciAoc25ha2VfY2FzZSkgdG8gY2FsbCBhIHN0cm9uZyBwdWxzZSB3aXRoIG9wdGlvbnMuXHJcblxyXG5cdEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXHJcblxyXG5cdEBwYXJhbSB7T2JqZWN0fSBbb3B0c11cclxuXHJcblx0QHBhcmFtIHtudW1iZXJ9IFtvcHRzLnRpbWVzPTNdXHJcblxyXG5cdEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5vbl9tcz0yODBdXHJcblxyXG5cdEBwYXJhbSB7bnVtYmVyfSBbb3B0cy5vZmZfbXM9MTgwXVxyXG5cclxuXHRAcGFyYW0ge3N0cmluZ30gW29wdHMuY29sb3JdXHJcblx0ICovXHJcblx0VUkucHVsc2Vfc2VxdWVuY2Vfc3Ryb25nID0gZnVuY3Rpb24gKGVsLCBvcHRzKSB7XHJcblx0XHRvcHRzID0gb3B0cyB8fCB7fTtcclxuXHRcdFVJLnB1bHNlX3NlcXVlbmNlKFxyXG5cdFx0XHRlbCxcclxuXHRcdFx0TnVtYmVyLmlzRmluaXRlKCBvcHRzLnRpbWVzICkgPyBvcHRzLnRpbWVzIDogMyxcclxuXHRcdFx0TnVtYmVyLmlzRmluaXRlKCBvcHRzLm9uX21zICkgPyBvcHRzLm9uX21zIDogMjgwLFxyXG5cdFx0XHROdW1iZXIuaXNGaW5pdGUoIG9wdHMub2ZmX21zICkgPyBvcHRzLm9mZl9tcyA6IDE4MCxcclxuXHRcdFx0b3B0cy5jb2xvclxyXG5cdFx0KTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQmFzZSBjbGFzcyBmb3IgQkZCIG1vZHVsZXMuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfTW9kdWxlID0gY2xhc3Mge1xyXG5cdFx0LyoqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXIgKi9cclxuXHRcdGNvbnN0cnVjdG9yKGJ1aWxkZXIpIHtcclxuXHRcdFx0dGhpcy5idWlsZGVyID0gYnVpbGRlcjtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogSW5pdGlhbGl6ZSB0aGUgbW9kdWxlLiAqL1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQ2xlYW51cCB0aGUgbW9kdWxlLiAqL1xyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDZW50cmFsIG92ZXJsYXkvY29udHJvbHMgbWFuYWdlciBmb3IgZmllbGRzL3NlY3Rpb25zLlxyXG5cdCAqIFB1cmUgVUkgY29tcG9zaXRpb247IGFsbCBhY3Rpb25zIHJvdXRlIGJhY2sgaW50byB0aGUgYnVpbGRlciBpbnN0YW5jZS5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9PdmVybGF5ID0gY2xhc3Mge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRW5zdXJlIGFuIG92ZXJsYXkgZXhpc3RzIGFuZCBpcyB3aXJlZCB1cCBvbiB0aGUgZWxlbWVudC5cclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXJcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIC0gZmllbGQgb3Igc2VjdGlvbiBlbGVtZW50XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBlbnN1cmUoYnVpbGRlciwgZWwpIHtcclxuXHJcblx0XHRcdGlmICggIWVsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBpc1NlY3Rpb24gPSBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKTtcclxuXHJcblx0XHRcdC8vIGxldCBvdmVybGF5ID0gZWwucXVlcnlTZWxlY3RvciggQ29yZS5XUEJDX0JGQl9ET00uU0VMRUNUT1JTLm92ZXJsYXkgKTtcclxuXHRcdFx0bGV0IG92ZXJsYXkgPSBlbC5xdWVyeVNlbGVjdG9yKCBgOnNjb3BlID4gJHtDb3JlLldQQkNfQkZCX0RPTS5TRUxFQ1RPUlMub3ZlcmxheX1gICk7XHJcblx0XHRcdGlmICggIW92ZXJsYXkgKSB7XHJcblx0XHRcdFx0b3ZlcmxheSA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19vdmVybGF5LWNvbnRyb2xzJyApO1xyXG5cdFx0XHRcdGVsLnByZXBlbmQoIG92ZXJsYXkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRHJhZyBoYW5kbGUuXHJcblx0XHRcdGlmICggIW92ZXJsYXkucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZHJhZy1oYW5kbGUnICkgKSB7XHJcblx0XHRcdFx0Y29uc3QgZHJhZ0NsYXNzID0gaXNTZWN0aW9uID8gJ3dwYmNfYmZiX19kcmFnLWhhbmRsZSBzZWN0aW9uLWRyYWctaGFuZGxlJyA6ICd3cGJjX2JmYl9fZHJhZy1oYW5kbGUnO1xyXG5cdFx0XHRcdG92ZXJsYXkuYXBwZW5kQ2hpbGQoXHJcblx0XHRcdFx0XHRDb3JlLldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5jcmVhdGVfZWxlbWVudCggJ3NwYW4nLCBkcmFnQ2xhc3MsICc8c3BhbiBjbGFzcz1cIndwYmNfaWNuX2RyYWdfaW5kaWNhdG9yXCI+PC9zcGFuPicgKVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNFVFRJTkdTIGJ1dHRvbiAoc2hvd24gZm9yIGJvdGggZmllbGRzICYgc2VjdGlvbnMpLlxyXG5cdFx0XHRpZiAoICFvdmVybGF5LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3NldHRpbmdzLWJ0bicgKSApIHtcclxuXHRcdFx0XHRjb25zdCBzZXR0aW5nc19idG4gICA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnYnV0dG9uJywgJ3dwYmNfYmZiX19zZXR0aW5ncy1idG4nLCAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9zZXR0aW5nc1wiPjwvaT4nICk7XHJcblx0XHRcdFx0c2V0dGluZ3NfYnRuLnR5cGUgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0XHRzZXR0aW5nc19idG4udGl0bGUgICA9ICdPcGVuIHNldHRpbmdzJztcclxuXHRcdFx0XHRzZXR0aW5nc19idG4ub25jbGljayA9IChlKSA9PiB7XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHQvLyBTZWxlY3QgVEhJUyBlbGVtZW50IGFuZCBzY3JvbGwgaXQgaW50byB2aWV3LlxyXG5cdFx0XHRcdFx0YnVpbGRlci5zZWxlY3RfZmllbGQoIGVsLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBBdXRvLW9wZW4gSW5zcGVjdG9yIGZyb20gdGhlIG92ZXJsYXkg4oCcU2V0dGluZ3PigJ0gYnV0dG9uLlxyXG5cdFx0XHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoXHJcblx0XHRcdFx0XHRcdCd3cGJjX2JmYjpzaG93X3BhbmVsJyxcclxuXHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdHBhbmVsX2lkOiAnd3BiY19iZmJfX2luc3BlY3RvcicsXHJcblx0XHRcdFx0XHRcdFx0dGFiX2lkICA6ICd3cGJjX3RhYl9pbnNwZWN0b3InXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gVHJ5IHRvIGJyaW5nIHRoZSBpbnNwZWN0b3IgaW50byB2aWV3IC8gZm9jdXMgZmlyc3QgaW5wdXQuXHJcblx0XHRcdFx0XHRjb25zdCBpbnMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0XHRpZiAoIGlucyApIHtcclxuXHRcdFx0XHRcdFx0aW5zLnNjcm9sbEludG9WaWV3KCB7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICduZWFyZXN0JyB9ICk7XHJcblx0XHRcdFx0XHRcdC8vIEZvY3VzIGZpcnN0IGludGVyYWN0aXZlIGNvbnRyb2wgKGJlc3QtZWZmb3J0KS5cclxuXHRcdFx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGZvY3VzYWJsZSA9IGlucy5xdWVyeVNlbGVjdG9yKCAnaW5wdXQsc2VsZWN0LHRleHRhcmVhLGJ1dHRvbixbY29udGVudGVkaXRhYmxlXSxbdGFiaW5kZXhdOm5vdChbdGFiaW5kZXg9XCItMVwiXSknICk7XHJcblx0XHRcdFx0XHRcdFx0Zm9jdXNhYmxlPy5mb2N1cz8uKCk7XHJcblx0XHRcdFx0XHRcdH0sIDI2MCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdG92ZXJsYXkuYXBwZW5kQ2hpbGQoIHNldHRpbmdzX2J0biApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRvdmVybGF5LnNldEF0dHJpYnV0ZSggJ3JvbGUnLCAndG9vbGJhcicgKTtcclxuXHRcdFx0b3ZlcmxheS5zZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJywgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgPyAnU2VjdGlvbiB0b29scycgOiAnRmllbGQgdG9vbHMnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gb3ZlcmxheTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBXUEJDIExheW91dCBDaGlwcyBoZWxwZXIgLSB2aXN1YWwgbGF5b3V0IHBpY2tlciAoY2hpcHMpLCBlLmcuLCBcIjUwJS81MCVcIiwgdG8gYSBzZWN0aW9uIG92ZXJsYXkuXHJcblx0ICpcclxuXHQgKiBSZW5kZXJzIEVxdWFsL1ByZXNldHMvQ3VzdG9tIGNoaXBzIGludG8gYSBob3N0IGNvbnRhaW5lciBhbmQgd2lyZXMgdGhlbSB0byBhcHBseSB0aGUgbGF5b3V0LlxyXG5cdCAqL1xyXG5cdFVJLldQQkNfQkZCX0xheW91dF9DaGlwcyA9IGNsYXNzIHtcclxuXHJcblx0XHQvKiogUmVhZCBwZXItY29sdW1uIG1pbiAocHgpIGZyb20gQ1NTIHZhciBzZXQgYnkgdGhlIGd1YXJkLiAqL1xyXG5cdFx0c3RhdGljIF9nZXRfY29sX21pbl9weChjb2wpIHtcclxuXHRcdFx0Y29uc3QgdiA9IGdldENvbXB1dGVkU3R5bGUoIGNvbCApLmdldFByb3BlcnR5VmFsdWUoICctLXdwYmMtY29sLW1pbicgKSB8fCAnMCc7XHJcblx0XHRcdGNvbnN0IG4gPSBwYXJzZUZsb2F0KCB2ICk7XHJcblx0XHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIG4gKSA/IE1hdGgubWF4KCAwLCBuICkgOiAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVHVybiByYXcgd2VpZ2h0cyAoZS5nLiBbMSwxXSwgWzIsMSwxXSkgaW50byBlZmZlY3RpdmUgXCJhdmFpbGFibGUtJVwiIGJhc2VzIHRoYXRcclxuXHRcdCAqIChhKSBzdW0gdG8gdGhlIHJvdydzIGF2YWlsYWJsZSAlLCBhbmQgKGIpIG1lZXQgZXZlcnkgY29sdW1uJ3MgbWluIHB4LlxyXG5cdFx0ICogUmV0dXJucyBhbiBhcnJheSBvZiBiYXNlcyAobnVtYmVycykgb3IgbnVsbCBpZiBpbXBvc3NpYmxlIHRvIHNhdGlzZnkgbWlucy5cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIF9maXRfd2VpZ2h0c19yZXNwZWN0aW5nX21pbihidWlsZGVyLCByb3csIHdlaWdodHMpIHtcclxuXHRcdFx0Y29uc3QgY29scyA9IEFycmF5LmZyb20oIHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkgKTtcclxuXHRcdFx0Y29uc3QgbiAgICA9IGNvbHMubGVuZ3RoO1xyXG5cdFx0XHRpZiAoICFuICkgcmV0dXJuIG51bGw7XHJcblx0XHRcdGlmICggIUFycmF5LmlzQXJyYXkoIHdlaWdodHMgKSB8fCB3ZWlnaHRzLmxlbmd0aCAhPT0gbiApIHJldHVybiBudWxsO1xyXG5cclxuXHRcdFx0Ly8gYXZhaWxhYmxlICUgYWZ0ZXIgZ2FwcyAoZnJvbSBMYXlvdXRTZXJ2aWNlKVxyXG5cdFx0XHRjb25zdCBncCAgICAgICA9IGJ1aWxkZXIuY29sX2dhcF9wZXJjZW50O1xyXG5cdFx0XHRjb25zdCBlZmYgICAgICA9IGJ1aWxkZXIubGF5b3V0LmNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzX2Zyb21fcm93KCByb3csIGdwICk7XHJcblx0XHRcdGNvbnN0IGF2YWlsUGN0ID0gZWZmLmF2YWlsYWJsZTsgICAgICAgICAgICAgICAvLyBlLmcuIDk0IGlmIDIgY29scyBhbmQgMyUgZ2FwXHJcblx0XHRcdGNvbnN0IHJvd1B4ICAgID0gcm93LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoO1xyXG5cdFx0XHRjb25zdCBhdmFpbFB4ICA9IHJvd1B4ICogKGF2YWlsUGN0IC8gMTAwKTtcclxuXHJcblx0XHRcdC8vIGNvbGxlY3QgbWluaW1hIGluICUgb2YgXCJhdmFpbGFibGVcIlxyXG5cdFx0XHRjb25zdCBtaW5QY3QgPSBjb2xzLm1hcCggKGMpID0+IHtcclxuXHRcdFx0XHRjb25zdCBtaW5QeCA9IFVJLldQQkNfQkZCX0xheW91dF9DaGlwcy5fZ2V0X2NvbF9taW5fcHgoIGMgKTtcclxuXHRcdFx0XHRpZiAoIGF2YWlsUHggPD0gMCApIHJldHVybiAwO1xyXG5cdFx0XHRcdHJldHVybiAobWluUHggLyBhdmFpbFB4KSAqIGF2YWlsUGN0O1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBJZiBtaW5zIGFsb25lIGRvbid0IGZpdCwgYmFpbC5cclxuXHRcdFx0Y29uc3Qgc3VtTWluID0gbWluUGN0LnJlZHVjZSggKGEsIGIpID0+IGEgKyBiLCAwICk7XHJcblx0XHRcdGlmICggc3VtTWluID4gYXZhaWxQY3QgLSAxZS02ICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsOyAvLyBpbXBvc3NpYmxlIHRvIHJlc3BlY3QgbWluczsgZG9uJ3QgYXBwbHkgcHJlc2V0XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFRhcmdldCBwZXJjZW50YWdlcyBmcm9tIHdlaWdodHMsIG5vcm1hbGl6ZWQgdG8gYXZhaWxQY3QuXHJcblx0XHRcdGNvbnN0IHdTdW0gICAgICA9IHdlaWdodHMucmVkdWNlKCAoYSwgdykgPT4gYSArIChOdW1iZXIoIHcgKSB8fCAwKSwgMCApIHx8IG47XHJcblx0XHRcdGNvbnN0IHRhcmdldFBjdCA9IHdlaWdodHMubWFwKCAodykgPT4gKChOdW1iZXIoIHcgKSB8fCAwKSAvIHdTdW0pICogYXZhaWxQY3QgKTtcclxuXHJcblx0XHRcdC8vIExvY2sgY29sdW1ucyB0aGF0IHdvdWxkIGJlIGJlbG93IG1pbiwgdGhlbiBkaXN0cmlidXRlIHRoZSByZW1haW5kZXJcclxuXHRcdFx0Ly8gYWNyb3NzIHRoZSByZW1haW5pbmcgY29sdW1ucyBwcm9wb3J0aW9uYWxseSB0byB0aGVpciB0YXJnZXRQY3QuXHJcblx0XHRcdGNvbnN0IGxvY2tlZCAgPSBuZXcgQXJyYXkoIG4gKS5maWxsKCBmYWxzZSApO1xyXG5cdFx0XHRsZXQgbG9ja2VkU3VtID0gMDtcclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgbjsgaSsrICkge1xyXG5cdFx0XHRcdGlmICggdGFyZ2V0UGN0W2ldIDwgbWluUGN0W2ldICkge1xyXG5cdFx0XHRcdFx0bG9ja2VkW2ldID0gdHJ1ZTtcclxuXHRcdFx0XHRcdGxvY2tlZFN1bSArPSBtaW5QY3RbaV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsZXQgcmVtYWluaW5nICAgICA9IGF2YWlsUGN0IC0gbG9ja2VkU3VtO1xyXG5cdFx0XHRjb25zdCBmcmVlSWR4ICAgICA9IFtdO1xyXG5cdFx0XHRsZXQgZnJlZVRhcmdldFN1bSA9IDA7XHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IG47IGkrKyApIHtcclxuXHRcdFx0XHRpZiAoICFsb2NrZWRbaV0gKSB7XHJcblx0XHRcdFx0XHRmcmVlSWR4LnB1c2goIGkgKTtcclxuXHRcdFx0XHRcdGZyZWVUYXJnZXRTdW0gKz0gdGFyZ2V0UGN0W2ldO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gbmV3IEFycmF5KCBuICkuZmlsbCggMCApO1xyXG5cdFx0XHQvLyBTZWVkIGxvY2tlZCB3aXRoIHRoZWlyIG1pbmltYS5cclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgbjsgaSsrICkge1xyXG5cdFx0XHRcdGlmICggbG9ja2VkW2ldICkgcmVzdWx0W2ldID0gbWluUGN0W2ldO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGZyZWVJZHgubGVuZ3RoID09PSAwICkge1xyXG5cdFx0XHRcdC8vIGV2ZXJ5dGhpbmcgbG9ja2VkIGV4YWN0bHkgYXQgbWluOyBhbnkgbGVmdG92ZXIgKHNob3VsZG4ndCBoYXBwZW4pXHJcblx0XHRcdFx0Ly8gd291bGQgYmUgaWdub3JlZCB0byBrZWVwIHNpbXBsaWNpdHkgYW5kIHN0YWJpbGl0eS5cclxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHJlbWFpbmluZyA8PSAwICkge1xyXG5cdFx0XHRcdC8vIG5vdGhpbmcgbGVmdCB0byBkaXN0cmlidXRlOyBrZWVwIGV4YWN0bHkgbWlucyBvbiBsb2NrZWQsXHJcblx0XHRcdFx0Ly8gbm90aGluZyBmb3IgZnJlZSAoZGVnZW5lcmF0ZSBidXQgY29uc2lzdGVudClcclxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGZyZWVUYXJnZXRTdW0gPD0gMCApIHtcclxuXHRcdFx0XHQvLyBkaXN0cmlidXRlIGVxdWFsbHkgYW1vbmcgZnJlZSBjb2x1bW5zXHJcblx0XHRcdFx0Y29uc3QgZWFjaCA9IHJlbWFpbmluZyAvIGZyZWVJZHgubGVuZ3RoO1xyXG5cdFx0XHRcdGZyZWVJZHguZm9yRWFjaCggKGkpID0+IChyZXN1bHRbaV0gPSBlYWNoKSApO1xyXG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIERpc3RyaWJ1dGUgcmVtYWluaW5nIHByb3BvcnRpb25hbGx5IHRvIGZyZWUgY29sdW1ucycgdGFyZ2V0UGN0XHJcblx0XHRcdGZyZWVJZHguZm9yRWFjaCggKGkpID0+IHtcclxuXHRcdFx0XHRyZXN1bHRbaV0gPSByZW1haW5pbmcgKiAodGFyZ2V0UGN0W2ldIC8gZnJlZVRhcmdldFN1bSk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQXBwbHkgYSBwcmVzZXQgYnV0IGd1YXJkIGl0IGJ5IG1pbmltYTsgcmV0dXJucyB0cnVlIGlmIGFwcGxpZWQsIGZhbHNlIGlmIHNraXBwZWQuICovXHJcblx0XHRzdGF0aWMgX2FwcGx5X3ByZXNldF93aXRoX21pbl9ndWFyZChidWlsZGVyLCBzZWN0aW9uX2VsLCB3ZWlnaHRzKSB7XHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRpZiAoICFyb3cgKSByZXR1cm4gZmFsc2U7XHJcblxyXG5cdFx0XHRjb25zdCBmaXR0ZWQgPSBVSS5XUEJDX0JGQl9MYXlvdXRfQ2hpcHMuX2ZpdF93ZWlnaHRzX3Jlc3BlY3RpbmdfbWluKCBidWlsZGVyLCByb3csIHdlaWdodHMgKTtcclxuXHRcdFx0aWYgKCAhZml0dGVkICkge1xyXG5cdFx0XHRcdGJ1aWxkZXI/Ll9hbm5vdW5jZT8uKCAnTm90IGVub3VnaCBzcGFjZSBmb3IgdGhpcyBsYXlvdXQgYmVjYXVzZSBvZiBmaWVsZHPigJkgbWluaW11bSB3aWR0aHMuJyApO1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gYGZpdHRlZGAgYWxyZWFkeSBzdW1zIHRvIHRoZSByb3figJlzIGF2YWlsYWJsZSAlLCBzbyB3ZSBjYW4gYXBwbHkgYmFzZXMgZGlyZWN0bHkuXHJcblx0XHRcdGJ1aWxkZXIubGF5b3V0LmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93LCBmaXR0ZWQgKTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQnVpbGQgYW5kIGFwcGVuZCBsYXlvdXQgY2hpcHMgZm9yIGEgc2VjdGlvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge1dQQkNfRm9ybV9CdWlsZGVyfSBidWlsZGVyIC0gVGhlIGZvcm0gYnVpbGRlciBpbnN0YW5jZS5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25fZWwgLSBUaGUgLndwYmNfYmZiX19zZWN0aW9uIGVsZW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBob3N0X2VsIC0gQ29udGFpbmVyIHdoZXJlIGNoaXBzIHNob3VsZCBiZSByZW5kZXJlZC5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgcmVuZGVyX2Zvcl9zZWN0aW9uKGJ1aWxkZXIsIHNlY3Rpb25fZWwsIGhvc3RfZWwpIHtcclxuXHJcblx0XHRcdGlmICggIWJ1aWxkZXIgfHwgIXNlY3Rpb25fZWwgfHwgIWhvc3RfZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCByb3cgPSBzZWN0aW9uX2VsLnF1ZXJ5U2VsZWN0b3IoICc6c2NvcGUgPiAud3BiY19iZmJfX3JvdycgKTtcclxuXHRcdFx0aWYgKCAhcm93ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgY29scyA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkubGVuZ3RoIHx8IDE7XHJcblxyXG5cdFx0XHQvLyBDbGVhciBob3N0LlxyXG5cdFx0XHRob3N0X2VsLmlubmVySFRNTCA9ICcnO1xyXG5cclxuXHRcdFx0Ly8gRXF1YWwgY2hpcC5cclxuXHRcdFx0aG9zdF9lbC5hcHBlbmRDaGlsZChcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9MYXlvdXRfQ2hpcHMuX21ha2VfY2hpcCggYnVpbGRlciwgc2VjdGlvbl9lbCwgQXJyYXkoIGNvbHMgKS5maWxsKCAxICksICdFcXVhbCcgKVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdFx0Ly8gUHJlc2V0cyBiYXNlZCBvbiBjb2x1bW4gY291bnQuXHJcblx0XHRcdGNvbnN0IHByZXNldHMgPSBidWlsZGVyLmxheW91dC5idWlsZF9wcmVzZXRzX2Zvcl9jb2x1bW5zKCBjb2xzICk7XHJcblx0XHRcdHByZXNldHMuZm9yRWFjaCggKHdlaWdodHMpID0+IHtcclxuXHRcdFx0XHRob3N0X2VsLmFwcGVuZENoaWxkKFxyXG5cdFx0XHRcdFx0VUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLl9tYWtlX2NoaXAoIGJ1aWxkZXIsIHNlY3Rpb25fZWwsIHdlaWdodHMsIG51bGwgKVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIEN1c3RvbSBjaGlwLlxyXG5cdFx0XHRjb25zdCBjdXN0b21CdG4gICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnYnV0dG9uJyApO1xyXG5cdFx0XHRjdXN0b21CdG4udHlwZSAgICAgICAgPSAnYnV0dG9uJztcclxuXHRcdFx0Y3VzdG9tQnRuLmNsYXNzTmFtZSAgID0gJ3dwYmNfYmZiX19sYXlvdXRfY2hpcCc7XHJcblx0XHRcdGN1c3RvbUJ0bi50ZXh0Q29udGVudCA9ICdDdXN0b23igKYnO1xyXG5cdFx0XHRjdXN0b21CdG4udGl0bGUgICAgICAgPSBgRW50ZXIgJHtjb2xzfSBwZXJjZW50YWdlc2A7XHJcblx0XHRcdGN1c3RvbUJ0bi5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCAoKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgZXhhbXBsZSA9IChjb2xzID09PSAyKSA/ICc1MCw1MCcgOiAoY29scyA9PT0gMyA/ICcyMCw2MCwyMCcgOiAnMjUsMjUsMjUsMjUnKTtcclxuXHRcdFx0XHRjb25zdCB0ZXh0ICAgID0gcHJvbXB0KCBgRW50ZXIgJHtjb2xzfSBwZXJjZW50YWdlcyAoY29tbWEgb3Igc3BhY2Ugc2VwYXJhdGVkKTpgLCBleGFtcGxlICk7XHJcblx0XHRcdFx0aWYgKCB0ZXh0ID09IG51bGwgKSByZXR1cm47XHJcblx0XHRcdFx0Y29uc3Qgd2VpZ2h0cyA9IGJ1aWxkZXIubGF5b3V0LnBhcnNlX3dlaWdodHMoIHRleHQgKTtcclxuXHRcdFx0XHRpZiAoIHdlaWdodHMubGVuZ3RoICE9PSBjb2xzICkge1xyXG5cdFx0XHRcdFx0YWxlcnQoIGBQbGVhc2UgZW50ZXIgZXhhY3RseSAke2NvbHN9IG51bWJlcnMuYCApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBPTEQ6XHJcblx0XHRcdFx0Ly8gYnVpbGRlci5sYXlvdXQuYXBwbHlfbGF5b3V0X3ByZXNldCggc2VjdGlvbl9lbCwgd2VpZ2h0cywgYnVpbGRlci5jb2xfZ2FwX3BlcmNlbnQgKTtcclxuXHRcdFx0XHQvLyBHdWFyZGVkIGFwcGx5Oi5cclxuXHRcdFx0XHRpZiAoICFVSS5XUEJDX0JGQl9MYXlvdXRfQ2hpcHMuX2FwcGx5X3ByZXNldF93aXRoX21pbl9ndWFyZCggYnVpbGRlciwgc2VjdGlvbl9lbCwgd2VpZ2h0cyApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRob3N0X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2xheW91dF9jaGlwJyApLmZvckVhY2goIGMgPT4gYy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtYWN0aXZlJyApICk7XHJcblx0XHRcdFx0Y3VzdG9tQnRuLmNsYXNzTGlzdC5hZGQoICdpcy1hY3RpdmUnICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0aG9zdF9lbC5hcHBlbmRDaGlsZCggY3VzdG9tQnRuICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYSBzaW5nbGUgbGF5b3V0IGNoaXAgYnV0dG9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge1dQQkNfRm9ybV9CdWlsZGVyfSBidWlsZGVyXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcltdfSB3ZWlnaHRzXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBsYWJlbFxyXG5cdFx0ICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgX21ha2VfY2hpcChidWlsZGVyLCBzZWN0aW9uX2VsLCB3ZWlnaHRzLCBsYWJlbCA9IG51bGwpIHtcclxuXHJcblx0XHRcdGNvbnN0IGJ0biAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnYnV0dG9uJyApO1xyXG5cdFx0XHRidG4udHlwZSAgICAgID0gJ2J1dHRvbic7XHJcblx0XHRcdGJ0bi5jbGFzc05hbWUgPSAnd3BiY19iZmJfX2xheW91dF9jaGlwJztcclxuXHJcblx0XHRcdGNvbnN0IHRpdGxlID0gbGFiZWwgfHwgYnVpbGRlci5sYXlvdXQuZm9ybWF0X3ByZXNldF9sYWJlbCggd2VpZ2h0cyApO1xyXG5cdFx0XHRidG4udGl0bGUgICA9IHRpdGxlO1xyXG5cclxuXHRcdFx0Ly8gVmlzdWFsIG1pbmlhdHVyZS5cclxuXHRcdFx0Y29uc3QgdmlzICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdHZpcy5jbGFzc05hbWUgPSAnd3BiY19iZmJfX2xheW91dF9jaGlwLXZpcyc7XHJcblx0XHRcdGNvbnN0IHN1bSAgICAgPSB3ZWlnaHRzLnJlZHVjZSggKGEsIGIpID0+IGEgKyAoTnVtYmVyKCBiICkgfHwgMCksIDAgKSB8fCAxO1xyXG5cdFx0XHR3ZWlnaHRzLmZvckVhY2goICh3KSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgYmFyICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcclxuXHRcdFx0XHRiYXIuc3R5bGUuZmxleCA9IGAwIDAgY2FsYyggJHsoKE51bWJlciggdyApIHx8IDApIC8gc3VtICogMTAwKS50b0ZpeGVkKCAzICl9JSAtIDEuNXB4IClgO1xyXG5cdFx0XHRcdHZpcy5hcHBlbmRDaGlsZCggYmFyICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0YnRuLmFwcGVuZENoaWxkKCB2aXMgKTtcclxuXHJcblx0XHRcdGNvbnN0IHR4dCAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xyXG5cdFx0XHR0eHQuY2xhc3NOYW1lICAgPSAnd3BiY19iZmJfX2xheW91dF9jaGlwLWxhYmVsJztcclxuXHRcdFx0dHh0LnRleHRDb250ZW50ID0gbGFiZWwgfHwgYnVpbGRlci5sYXlvdXQuZm9ybWF0X3ByZXNldF9sYWJlbCggd2VpZ2h0cyApO1xyXG5cdFx0XHRidG4uYXBwZW5kQ2hpbGQoIHR4dCApO1xyXG5cclxuXHRcdFx0YnRuLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsICgpID0+IHtcclxuXHRcdFx0XHQvLyBPTEQ6XHJcblx0XHRcdFx0Ly8gYnVpbGRlci5sYXlvdXQuYXBwbHlfbGF5b3V0X3ByZXNldCggc2VjdGlvbl9lbCwgd2VpZ2h0cywgYnVpbGRlci5jb2xfZ2FwX3BlcmNlbnQgKTtcclxuXHJcblx0XHRcdFx0Ly8gTkVXOlxyXG5cdFx0XHRcdGlmICggIVVJLldQQkNfQkZCX0xheW91dF9DaGlwcy5fYXBwbHlfcHJlc2V0X3dpdGhfbWluX2d1YXJkKCBidWlsZGVyLCBzZWN0aW9uX2VsLCB3ZWlnaHRzICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47IC8vIGRvIG5vdCB0b2dnbGUgYWN0aXZlIGlmIHdlIGRpZG4ndCBjaGFuZ2UgbGF5b3V0XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRidG4ucGFyZW50RWxlbWVudD8ucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fbGF5b3V0X2NoaXAnICkuZm9yRWFjaCggYyA9PiBjLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1hY3RpdmUnICkgKTtcclxuXHRcdFx0XHRidG4uY2xhc3NMaXN0LmFkZCggJ2lzLWFjdGl2ZScgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0cmV0dXJuIGJ0bjtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZWxlY3Rpb24gY29udHJvbGxlciBmb3IgZmllbGRzIGFuZCBhbm5vdW5jZW1lbnRzLlxyXG5cdCAqL1xyXG5cdFVJLldQQkNfQkZCX1NlbGVjdGlvbl9Db250cm9sbGVyID0gY2xhc3MgZXh0ZW5kcyBVSS5XUEJDX0JGQl9Nb2R1bGUge1xyXG5cclxuXHRcdGluaXQoKSB7XHJcblxyXG5cdFx0XHR0aGlzLl9zZWxlY3RlZF91aWQgICAgICAgICAgICAgID0gbnVsbDtcclxuXHRcdFx0dGhpcy5idWlsZGVyLnNlbGVjdF9maWVsZCAgICAgICA9IHRoaXMuc2VsZWN0X2ZpZWxkLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLmdldF9zZWxlY3RlZF9maWVsZCA9IHRoaXMuZ2V0X3NlbGVjdGVkX2ZpZWxkLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5fb25fY2xlYXIgICAgICAgICAgICAgICAgICA9IHRoaXMub25fY2xlYXIuYmluZCggdGhpcyApO1xyXG5cclxuXHRcdFx0Ly8gQ2VudHJhbGl6ZWQgZGVsZXRlIGNvbW1hbmQgdXNlZCBieSBrZXlib2FyZCArIGluc3BlY3RvciArIG92ZXJsYXkuXHJcblx0XHRcdHRoaXMuYnVpbGRlci5kZWxldGVfaXRlbSA9IChlbCkgPT4ge1xyXG5cdFx0XHRcdGlmICggIWVsICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNvbnN0IGIgICAgICAgID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRcdGNvbnN0IG5laWdoYm9yID0gYi5fZmluZF9uZWlnaGJvcl9zZWxlY3RhYmxlPy4oIGVsICkgfHwgbnVsbDtcclxuXHRcdFx0XHRlbC5yZW1vdmUoKTtcclxuXHRcdFx0XHQvLyBVc2UgbG9jYWwgQ29yZSBjb25zdGFudHMgKG5vdCBhIGdsb2JhbCkgdG8gYXZvaWQgUmVmZXJlbmNlRXJyb3JzLlxyXG5cdFx0XHRcdGIuYnVzPy5lbWl0Py4oIENvcmUuV1BCQ19CRkJfRXZlbnRzLkZJRUxEX1JFTU9WRSwgeyBlbCwgaWQ6IGVsPy5kYXRhc2V0Py5pZCwgdWlkOiBlbD8uZGF0YXNldD8udWlkIH0gKTtcclxuXHRcdFx0XHRiLnVzYWdlPy51cGRhdGVfcGFsZXR0ZV91aT8uKCk7XHJcblx0XHRcdFx0Ly8gTm90aWZ5IGdlbmVyaWMgc3RydWN0dXJlIGxpc3RlbmVycywgdG9vOlxyXG5cdFx0XHRcdGIuYnVzPy5lbWl0Py4oIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9DSEFOR0UsIHsgcmVhc29uOiAnZGVsZXRlJywgZWwgfSApO1xyXG5cdFx0XHRcdC8vIERlZmVyIHNlbGVjdGlvbiBhIHRpY2sgc28gdGhlIERPTSBpcyBmdWxseSBzZXR0bGVkIGJlZm9yZSBJbnNwZWN0b3IgaHlkcmF0ZXMuXHJcblx0XHRcdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKCAoKSA9PiB7XHJcblx0XHRcdFx0XHQvLyBUaGlzIGNhbGxzIGluc3BlY3Rvci5iaW5kX3RvX2ZpZWxkKCkgYW5kIG9wZW5zIHRoZSBJbnNwZWN0b3IgcGFuZWwuXHJcblx0XHRcdFx0XHRiLnNlbGVjdF9maWVsZD8uKCBuZWlnaGJvciB8fCBudWxsLCB7IHNjcm9sbEludG9WaWV3OiAhIW5laWdoYm9yIH0gKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0cmV0dXJuIG5laWdoYm9yO1xyXG5cdFx0XHR9O1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuYnVzLm9uKCBDb3JlLldQQkNfQkZCX0V2ZW50cy5DTEVBUl9TRUxFQ1RJT04sIHRoaXMuX29uX2NsZWFyICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5idXMub24oIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9MT0FERUQsIHRoaXMuX29uX2NsZWFyICk7XHJcblx0XHRcdC8vIGRlbGVnYXRlZCBjbGljayBzZWxlY3Rpb24gKGNhcHR1cmUgZW5zdXJlcyB3ZSB3aW4gYmVmb3JlIGJ1YmJsaW5nIHRvIGNvbnRhaW5lcnMpLlxyXG5cdFx0XHR0aGlzLl9vbl9jYW52YXNfY2xpY2sgPSB0aGlzLl9oYW5kbGVfY2FudmFzX2NsaWNrLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLnBhZ2VzX2NvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9jYW52YXNfY2xpY2ssIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuYnVzLm9mZiggQ29yZS5XUEJDX0JGQl9FdmVudHMuQ0xFQVJfU0VMRUNUSU9OLCB0aGlzLl9vbl9jbGVhciApO1xyXG5cclxuXHRcdFx0aWYgKCB0aGlzLl9vbl9jYW52YXNfY2xpY2sgKSB7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLnBhZ2VzX2NvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9jYW52YXNfY2xpY2ssIHRydWUgKTtcclxuXHRcdFx0XHR0aGlzLl9vbl9jYW52YXNfY2xpY2sgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWxlZ2F0ZWQgY2FudmFzIGNsaWNrIC0+IHNlbGVjdCBjbG9zZXN0IGZpZWxkL3NlY3Rpb24gKGlubmVyIGJlYXRzIG91dGVyKS5cclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGVcclxuXHRcdCAqL1xyXG5cdFx0X2hhbmRsZV9jYW52YXNfY2xpY2soZSkge1xyXG5cdFx0XHRjb25zdCByb290ID0gdGhpcy5idWlsZGVyLnBhZ2VzX2NvbnRhaW5lcjtcclxuXHRcdFx0aWYgKCAhcm9vdCApIHJldHVybjtcclxuXHJcblx0XHRcdC8vIElnbm9yZSBjbGlja3Mgb24gY29udHJvbHMvaGFuZGxlcy9yZXNpemVycywgZXRjLlxyXG5cdFx0XHRjb25zdCBJR05PUkUgPSBbXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fb3ZlcmxheS1jb250cm9scycsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fbGF5b3V0X3BpY2tlcicsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fZHJhZy1oYW5kbGUnLFxyXG5cdFx0XHRcdCcud3BiY19iZmJfX2ZpZWxkLXJlbW92ZS1idG4nLFxyXG5cdFx0XHRcdCcud3BiY19iZmJfX2ZpZWxkLW1vdmUtdXAnLFxyXG5cdFx0XHRcdCcud3BiY19iZmJfX2ZpZWxkLW1vdmUtZG93bicsXHJcblx0XHRcdFx0Jy53cGJjX2JmYl9fY29sdW1uLXJlc2l6ZXInXHJcblx0XHRcdF0uam9pbiggJywnICk7XHJcblxyXG5cdFx0XHRpZiAoIGUudGFyZ2V0LmNsb3Nlc3QoIElHTk9SRSApICkge1xyXG5cdFx0XHRcdHJldHVybjsgLy8gbGV0IHRob3NlIGNvbnRyb2xzIGRvIHRoZWlyIG93biB0aGluZy5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRmluZCB0aGUgY2xvc2VzdCBzZWxlY3RhYmxlIChmaWVsZCBPUiBzZWN0aW9uKSBmcm9tIHRoZSBjbGljayB0YXJnZXQuXHJcblx0XHRcdGxldCBoaXQgPSBlLnRhcmdldC5jbG9zZXN0Py4oXHJcblx0XHRcdFx0YCR7Q29yZS5XUEJDX0JGQl9ET00uU0VMRUNUT1JTLnZhbGlkRmllbGR9LCAke0NvcmUuV1BCQ19CRkJfRE9NLlNFTEVDVE9SUy5zZWN0aW9ufSwgLndwYmNfYmZiX19jb2x1bW5gXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHRpZiAoICFoaXQgfHwgIXJvb3QuY29udGFpbnMoIGhpdCApICkge1xyXG5cdFx0XHRcdHRoaXMuc2VsZWN0X2ZpZWxkKCBudWxsICk7ICAgICAgICAgICAvLyBDbGVhciBzZWxlY3Rpb24gb24gYmxhbmsgY2xpY2suXHJcblx0XHRcdFx0cmV0dXJuOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVtcHR5IHNwYWNlIGlzIGhhbmRsZWQgZWxzZXdoZXJlLlxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBORVc6IGlmIHVzZXIgY2xpY2tlZCBhIENPTFVNTiAtPiByZW1lbWJlciB0YWIga2V5IG9uIGl0cyBTRUNUSU9OLCBidXQgc3RpbGwgc2VsZWN0IHRoZSBzZWN0aW9uLlxyXG5cdFx0XHRsZXQgcHJlc2VsZWN0X3RhYl9rZXkgPSBudWxsO1xyXG5cdFx0XHRpZiAoIGhpdC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fY29sdW1uJyApICkge1xyXG5cdFx0XHRcdGNvbnN0IHJvdyAgPSBoaXQuY2xvc2VzdCggJy53cGJjX2JmYl9fcm93JyApO1xyXG5cdFx0XHRcdGNvbnN0IGNvbHMgPSByb3cgPyBBcnJheS5mcm9tKCByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uJyApICkgOiBbXTtcclxuXHRcdFx0XHRjb25zdCBpZHggID0gTWF0aC5tYXgoIDAsIGNvbHMuaW5kZXhPZiggaGl0ICkgKTtcclxuXHRcdFx0XHRjb25zdCBzZWMgID0gaGl0LmNsb3Nlc3QoICcud3BiY19iZmJfX3NlY3Rpb24nICk7XHJcblx0XHRcdFx0aWYgKCBzZWMgKSB7XHJcblx0XHRcdFx0XHRwcmVzZWxlY3RfdGFiX2tleSA9IFN0cmluZyggaWR4ICsgMSApOyAgICAgICAgICAgICAgLy8gdGFicyBhcmUgMS1iYXNlZCBpbiB1aS1jb2x1bW4tc3R5bGVzLmpzXHJcblx0XHRcdFx0XHQvLyBIaW50IGZvciB0aGUgcmVuZGVyZXIgKGl0IHJlYWRzIHRoaXMgQkVGT1JFIHJlbmRlcmluZyBhbmQgcmVzdG9yZXMgdGhlIHRhYikuXHJcblx0XHRcdFx0XHRzZWMuZGF0YXNldC5jb2xfc3R5bGVzX2FjdGl2ZV90YWIgPSBwcmVzZWxlY3RfdGFiX2tleTtcclxuXHRcdFx0XHRcdC8vIHByb21vdGUgc2VsZWN0aW9uIHRvIHRoZSBzZWN0aW9uIChzYW1lIFVYIGFzIGJlZm9yZSkuXHJcblx0XHRcdFx0XHRoaXQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPSBzZWM7XHJcblx0XHRcdFx0XHQvLyBORVc6IHZpc3VhbGx5IG1hcmsgd2hpY2ggY29sdW1uIGlzIGJlaW5nIGVkaXRlZFxyXG5cdFx0XHRcdFx0aWYgKCBVSSAmJiBVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzICYmIFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMuc2V0X3NlbGVjdGVkX2NvbF9mbGFnICkge1xyXG5cdFx0XHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnNldF9zZWxlY3RlZF9jb2xfZmxhZyggc2VjLCBwcmVzZWxlY3RfdGFiX2tleSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gU2VsZWN0IGFuZCBzdG9wIGJ1YmJsaW5nIHNvIG91dGVyIGNvbnRhaW5lcnMgZG9u4oCZdCByZXNlbGVjdCBhIHBhcmVudC5cclxuXHRcdFx0dGhpcy5zZWxlY3RfZmllbGQoIGhpdCApO1xyXG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cclxuXHRcdFx0Ly8gQWxzbyBzZXQgdGhlIHRhYiBhZnRlciB0aGUgaW5zcGVjdG9yIHJlbmRlcnMgKHdvcmtzIGV2ZW4gaWYgaXQgd2FzIGFscmVhZHkgb3BlbikuXHJcblx0XHRcdGlmICggcHJlc2VsZWN0X3RhYl9rZXkgKSB7XHJcblx0XHRcdFx0KHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgc2V0VGltZW91dCkoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGlucyAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHRhYnMgPSBpbnMgJiYgaW5zLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1iZmItc2xvdD1cImNvbHVtbl9zdHlsZXNcIl0gW2RhdGEtd3BiYy10YWJzXScgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCB0YWJzICYmIHdpbmRvdy53cGJjX3VpX3RhYnMgJiYgdHlwZW9mIHdpbmRvdy53cGJjX3VpX3RhYnMuc2V0X2FjdGl2ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0XHR3aW5kb3cud3BiY191aV90YWJzLnNldF9hY3RpdmUoIHRhYnMsIHByZXNlbGVjdF90YWJfa2V5ICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LCAwICk7XHJcblxyXG5cdFx0XHRcdC8vIFBvbGl0ZWx5IGFzayB0aGUgSW5zcGVjdG9yIHRvIGZvY3VzL29wZW4gdGhlIFwiQ29sdW1uIFN0eWxlc1wiIGdyb3VwIGFuZCB0YWIuXHJcblx0XHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoXHJcblx0XHRcdFx0XHQnd3BiY19iZmI6aW5zcGVjdG9yX2ZvY3VzJyxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0Z3JvdXAgIDogJ2NvbHVtbl9zdHlsZXMnLFxyXG5cdFx0XHRcdFx0XHR0YWJfa2V5OiBwcmVzZWxlY3RfdGFiX2tleVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZWxlY3QgYSBmaWVsZCBlbGVtZW50IG9yIGNsZWFyIHNlbGVjdGlvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGZpZWxkX2VsXHJcblx0XHQgKiBAcGFyYW0ge3tzY3JvbGxJbnRvVmlldz86IGJvb2xlYW59fSBbb3B0cyA9IHt9XVxyXG5cdFx0ICovXHJcblx0XHRzZWxlY3RfZmllbGQoZmllbGRfZWwsIHsgc2Nyb2xsSW50b1ZpZXcgPSBmYWxzZSB9ID0ge30pIHtcclxuXHRcdFx0Y29uc3Qgcm9vdCAgID0gdGhpcy5idWlsZGVyLnBhZ2VzX2NvbnRhaW5lcjtcclxuXHRcdFx0Y29uc3QgcHJldkVsID0gdGhpcy5nZXRfc2VsZWN0ZWRfZmllbGQ/LigpIHx8IG51bGw7ICAgLy8gdGhlIG9uZSB3ZeKAmXJlIGxlYXZpbmcuXHJcblxyXG5cdFx0XHQvLyBJZ25vcmUgZWxlbWVudHMgbm90IGluIHRoZSBjYW52YXMuXHJcblx0XHRcdGlmICggZmllbGRfZWwgJiYgIXJvb3QuY29udGFpbnMoIGZpZWxkX2VsICkgKSB7XHJcblx0XHRcdFx0ZmllbGRfZWwgPSBudWxsOyAvLyB0cmVhdCBhcyBcIm5vIHNlbGVjdGlvblwiLlxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBORVc6IGlmIHdlIGFyZSBsZWF2aW5nIGEgc2VjdGlvbiwgY2xlYXIgaXRzIGNvbHVtbiBoaWdobGlnaHRcclxuXHRcdFx0aWYgKFxyXG5cdFx0XHRcdHByZXZFbCAmJiBwcmV2RWwgIT09IGZpZWxkX2VsICYmXHJcblx0XHRcdFx0cHJldkVsLmNsYXNzTGlzdD8uY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSAmJlxyXG5cdFx0XHRcdFVJPy5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzPy5jbGVhcl9zZWxlY3RlZF9jb2xfZmxhZ1xyXG5cdFx0XHQpIHtcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLmNsZWFyX3NlbGVjdGVkX2NvbF9mbGFnKCBwcmV2RWwgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gSWYgd2UncmUgbGVhdmluZyBhIGZpZWxkLCBwZXJtYW5lbnRseSBzdG9wIGF1dG8tbmFtZSBmb3IgaXQuXHJcblx0XHRcdGlmICggcHJldkVsICYmIHByZXZFbCAhPT0gZmllbGRfZWwgJiYgcHJldkVsLmNsYXNzTGlzdD8uY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgKSB7XHJcblx0XHRcdFx0cHJldkVsLmRhdGFzZXQuYXV0b25hbWUgPSAnMCc7XHJcblx0XHRcdFx0cHJldkVsLmRhdGFzZXQuZnJlc2ggICAgPSAnMCc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJvb3QucXVlcnlTZWxlY3RvckFsbCggJy5pcy1zZWxlY3RlZCcgKS5mb3JFYWNoKCAobikgPT4ge1xyXG5cdFx0XHRcdG4uY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXNlbGVjdGVkJyApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGlmICggIWZpZWxkX2VsICkge1xyXG5cdFx0XHRcdGNvbnN0IHByZXYgICAgICAgICA9IHRoaXMuX3NlbGVjdGVkX3VpZCB8fCBudWxsO1xyXG5cdFx0XHRcdHRoaXMuX3NlbGVjdGVkX3VpZCA9IG51bGw7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmluc3BlY3Rvcj8uY2xlYXI/LigpO1xyXG5cdFx0XHRcdHJvb3QuY2xhc3NMaXN0LnJlbW92ZSggJ2hhcy1zZWxlY3Rpb24nICk7XHJcblx0XHRcdFx0dGhpcy5idWlsZGVyLmJ1cy5lbWl0KCBDb3JlLldQQkNfQkZCX0V2ZW50cy5DTEVBUl9TRUxFQ1RJT04sIHsgcHJldl91aWQ6IHByZXYsIHNvdXJjZTogJ2J1aWxkZXInIH0gKTtcclxuXHJcblx0XHRcdFx0Ly8gQXV0by1vcGVuIFwiQWRkIEZpZWxkc1wiIHdoZW4gbm90aGluZyBpcyBzZWxlY3RlZC5cclxuXHRcdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZShcclxuXHRcdFx0XHRcdCd3cGJjX2JmYjpzaG93X3BhbmVsJyxcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0cGFuZWxfaWQ6ICd3cGJjX2JmYl9fcGFsZXR0ZV9hZGRfbmV3JyxcclxuXHRcdFx0XHRcdFx0dGFiX2lkICA6ICd3cGJjX3RhYl9saWJyYXJ5J1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRmaWVsZF9lbC5jbGFzc0xpc3QuYWRkKCAnaXMtc2VsZWN0ZWQnICk7XHJcblx0XHRcdHRoaXMuX3NlbGVjdGVkX3VpZCA9IGZpZWxkX2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtdWlkJyApIHx8IG51bGw7XHJcblxyXG5cdFx0XHQvLyBGYWxsYmFjazogZW5zdXJlIHNlY3Rpb25zIGFubm91bmNlIHRoZW1zZWx2ZXMgYXMgdHlwZT1cInNlY3Rpb25cIi5cclxuXHRcdFx0aWYgKCBmaWVsZF9lbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSAmJiAhZmllbGRfZWwuZGF0YXNldC50eXBlICkge1xyXG5cdFx0XHRcdGZpZWxkX2VsLmRhdGFzZXQudHlwZSA9ICdzZWN0aW9uJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBzY3JvbGxJbnRvVmlldyApIHtcclxuXHRcdFx0XHRmaWVsZF9lbC5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnY2VudGVyJyB9ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5idWlsZGVyLmluc3BlY3Rvcj8uYmluZF90b19maWVsZD8uKCBmaWVsZF9lbCApO1xyXG5cclxuXHRcdFx0Ly8gRmFsbGJhY2s6IGVuc3VyZSBpbnNwZWN0b3IgZW5oYW5jZXJzIChpbmNsLiBWYWx1ZVNsaWRlcikgcnVuIGV2ZXJ5IGJpbmQuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApXHJcblx0XHRcdFx0XHR8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0aWYgKCBpbnMgKSB7XHJcblx0XHRcdFx0XHRVSS5JbnNwZWN0b3JFbmhhbmNlcnM/LnNjYW4/LiggaW5zICk7ICAgICAgICAgICAgICAvLyBydW5zIGFsbCBlbmhhbmNlcnNcclxuXHRcdFx0XHRcdFVJLldQQkNfQkZCX1ZhbHVlU2xpZGVyPy5pbml0X29uPy4oIGlucyApOyAgICAgICAgIC8vIGV4dHJhIGJlbHQtYW5kLXN1c3BlbmRlcnNcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBORVc6IHdoZW4gc2VsZWN0aW5nIGEgc2VjdGlvbiwgcmVmbGVjdCBpdHMgYWN0aXZlIHRhYiBhcyB0aGUgaGlnaGxpZ2h0ZWQgY29sdW1uLlxyXG5cdFx0XHRpZiAoIGZpZWxkX2VsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICYmXHJcblx0XHRcdFx0VUk/LldQQkNfQkZCX0NvbHVtbl9TdHlsZXM/LnNldF9zZWxlY3RlZF9jb2xfZmxhZyApIHtcclxuXHRcdFx0XHR2YXIgayA9IChmaWVsZF9lbC5kYXRhc2V0ICYmIGZpZWxkX2VsLmRhdGFzZXQuY29sX3N0eWxlc19hY3RpdmVfdGFiKVxyXG5cdFx0XHRcdFx0PyBmaWVsZF9lbC5kYXRhc2V0LmNvbF9zdHlsZXNfYWN0aXZlX3RhYiA6ICcxJztcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9Db2x1bW5fU3R5bGVzLnNldF9zZWxlY3RlZF9jb2xfZmxhZyggZmllbGRfZWwsIGsgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gS2VlcCBzZWN0aW9ucyAmIGZpZWxkcyBpbiB0aGUgc2FtZSBmbG93OlxyXG5cdFx0XHQvLyAxKSBHZW5lcmljIGh5ZHJhdG9yIGZvciBzaW1wbGUgZGF0YXNldC1iYWNrZWQgY29udHJvbHMuXHJcblx0XHRcdGlmICggZmllbGRfZWwgKSB7XHJcblx0XHRcdFx0VUkuV1BCQ19CRkJfSW5zcGVjdG9yX0JyaWRnZS5fZ2VuZXJpY19oeWRyYXRlX2NvbnRyb2xzPy4oIHRoaXMuYnVpbGRlciwgZmllbGRfZWwgKTtcclxuXHRcdFx0XHRVSS5XUEJDX0JGQl9JbnNwZWN0b3JfQnJpZGdlLl9oeWRyYXRlX3NwZWNpYWxfY29udHJvbHM/LiggdGhpcy5idWlsZGVyLCBmaWVsZF9lbCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBBdXRvLW9wZW4gSW5zcGVjdG9yIHdoZW4gYSB1c2VyIHNlbGVjdHMgYSBmaWVsZC9zZWN0aW9uIC5cclxuXHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoXHJcblx0XHRcdFx0J3dwYmNfYmZiOnNob3dfcGFuZWwnLFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdHBhbmVsX2lkOiAnd3BiY19iZmJfX2luc3BlY3RvcicsXHJcblx0XHRcdFx0XHR0YWJfaWQgIDogJ3dwYmNfdGFiX2luc3BlY3RvcidcclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblxyXG5cdFx0XHRyb290LmNsYXNzTGlzdC5hZGQoICdoYXMtc2VsZWN0aW9uJyApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuYnVzLmVtaXQoIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNFTEVDVCwgeyB1aWQ6IHRoaXMuX3NlbGVjdGVkX3VpZCwgZWw6IGZpZWxkX2VsIH0gKTtcclxuXHRcdFx0Y29uc3QgbGFiZWwgPSBmaWVsZF9lbD8ucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZmllbGQtbGFiZWwnICk/LnRleHRDb250ZW50IHx8IChmaWVsZF9lbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSA/ICdzZWN0aW9uJyA6ICcnKSB8fCBmaWVsZF9lbD8uZGF0YXNldD8uaWQgfHwgJ2l0ZW0nO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuX2Fubm91bmNlKCAnU2VsZWN0ZWQgJyArIGxhYmVsICsgJy4nICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqIEByZXR1cm5zIHtIVE1MRWxlbWVudHxudWxsfSAqL1xyXG5cdFx0Z2V0X3NlbGVjdGVkX2ZpZWxkKCkge1xyXG5cdFx0XHRpZiAoICF0aGlzLl9zZWxlY3RlZF91aWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgZXNjX2F0dHIgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdGhpcy5fc2VsZWN0ZWRfdWlkICk7XHJcblx0XHRcdHJldHVybiB0aGlzLmJ1aWxkZXIucGFnZXNfY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoIGAud3BiY19iZmJfX2ZpZWxkW2RhdGEtdWlkPVwiJHtlc2NfYXR0cn1cIl0sIC53cGJjX2JmYl9fc2VjdGlvbltkYXRhLXVpZD1cIiR7ZXNjX2F0dHJ9XCJdYCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldiAqL1xyXG5cdFx0b25fY2xlYXIoZXYpIHtcclxuXHRcdFx0Y29uc3Qgc3JjID0gZXY/LmRldGFpbD8uc291cmNlID8/IGV2Py5zb3VyY2U7XHJcblx0XHRcdGlmICggc3JjICE9PSAnYnVpbGRlcicgKSB7XHJcblx0XHRcdFx0dGhpcy5zZWxlY3RfZmllbGQoIG51bGwgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBCcmlkZ2VzIHRoZSBidWlsZGVyIHdpdGggdGhlIEluc3BlY3RvciBhbmQgc2FuaXRpemVzIGlkL25hbWUgZWRpdHMuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfSW5zcGVjdG9yX0JyaWRnZSA9IGNsYXNzIGV4dGVuZHMgVUkuV1BCQ19CRkJfTW9kdWxlIHtcclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLl9hdHRhY2hfaW5zcGVjdG9yKCk7XHJcblx0XHRcdHRoaXMuX2JpbmRfaWRfc2FuaXRpemVyKCk7XHJcblx0XHRcdHRoaXMuX29wZW5faW5zcGVjdG9yX2FmdGVyX2ZpZWxkX2FkZGVkKCk7XHJcblx0XHRcdHRoaXMuX2JpbmRfZm9jdXNfc2hvcnRjdXRzKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0X2F0dGFjaF9pbnNwZWN0b3IoKSB7XHJcblx0XHRcdGNvbnN0IGIgICAgICA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Y29uc3QgYXR0YWNoID0gKCkgPT4ge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIHdpbmRvdy5XUEJDX0JGQl9JbnNwZWN0b3IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRiLmluc3BlY3RvciA9IG5ldyBXUEJDX0JGQl9JbnNwZWN0b3IoIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKSwgYiApO1xyXG5cdFx0XHRcdFx0dGhpcy5fYmluZF9pZF9zYW5pdGl6ZXIoKTtcclxuXHRcdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLCBhdHRhY2ggKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblx0XHRcdC8vIEVuc3VyZSB3ZSBiaW5kIGFmdGVyIGxhdGUgcmVhZHkgYXMgd2VsbC5cclxuXHRcdFx0aWYgKCB0eXBlb2Ygd2luZG93LldQQkNfQkZCX0luc3BlY3RvciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRhdHRhY2goKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRiLmluc3BlY3RvciA9IHtcclxuXHRcdFx0XHRcdGJpbmRfdG9fZmllbGQoKSB7XHJcblx0XHRcdFx0XHR9LCBjbGVhcigpIHtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9O1xyXG5cdFx0XHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLCBhdHRhY2ggKTtcclxuXHRcdFx0XHRzZXRUaW1lb3V0KCBhdHRhY2gsIDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTGlzdGVuIGZvciBcImZvY3VzXCIgaGludHMgZnJvbSB0aGUgY2FudmFzIGFuZCBvcGVuIHRoZSByaWdodCBncm91cC90YWIuXHJcblx0XHQgKiAtIFN1cHBvcnRzOiBncm91cCA9PT0gJ2NvbHVtbl9zdHlsZXMnXHJcblx0XHQgKiAtIEFsc28gc2Nyb2xscyB0aGUgZ3JvdXAgaW50byB2aWV3LlxyXG5cdFx0ICovXHJcblx0XHRfYmluZF9mb2N1c19zaG9ydGN1dHMoKSB7XHJcblx0XHRcdC8qKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBlICovXHJcblx0XHRcdGNvbnN0IG9uX2ZvY3VzID0gKGUpID0+IHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0Y29uc3QgZ3JwX2tleSA9IGUgJiYgZS5kZXRhaWwgJiYgZS5kZXRhaWwuZ3JvdXA7XHJcblx0XHRcdFx0XHRjb25zdCB0YWJfa2V5ID0gZSAmJiBlLmRldGFpbCAmJiBlLmRldGFpbC50YWJfa2V5O1xyXG5cdFx0XHRcdFx0aWYgKCAhZ3JwX2tleSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGNvbnN0IGlucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKSB8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0XHRpZiAoICFpbnMgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIGdycF9rZXkgPT09ICdjb2x1bW5fc3R5bGVzJyApIHtcclxuXHRcdFx0XHRcdFx0Ly8gRmluZCB0aGUgQ29sdW1uIFN0eWxlcyBzbG90L2dyb3VwLlxyXG5cdFx0XHRcdFx0XHRjb25zdCBzbG90ID0gaW5zLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1iZmItc2xvdD1cImNvbHVtbl9zdHlsZXNcIl0nICkgfHwgaW5zLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1pbnNwZWN0b3ItZ3JvdXAta2V5PVwiY29sdW1uX3N0eWxlc1wiXScgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCBzbG90ICkge1xyXG5cdFx0XHRcdFx0XHRcdC8vIE9wZW4gY29sbGFwc2libGUgY29udGFpbmVyIGlmIHByZXNlbnQuXHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgZ3JvdXBfd3JhcCA9IHNsb3QuY2xvc2VzdCggJy5pbnNwZWN0b3JfX2dyb3VwJyApIHx8IHNsb3QuY2xvc2VzdCggJ1tkYXRhLWluc3BlY3Rvci1ncm91cF0nICk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBncm91cF93cmFwICYmICFncm91cF93cmFwLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRncm91cF93cmFwLmNsYXNzTGlzdC5hZGQoICdpcy1vcGVuJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gTWlycm9yIEFSSUEgc3RhdGUgaWYgeW91ciBoZWFkZXIgdXNlcyBhcmlhLWV4cGFuZGVkLlxyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgaGVhZGVyX2J0biA9IGdyb3VwX3dyYXAucXVlcnlTZWxlY3RvciggJ1thcmlhLWV4cGFuZGVkXScgKTtcclxuXHRcdFx0XHRcdFx0XHRcdGlmICggaGVhZGVyX2J0biApIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0aGVhZGVyX2J0bi5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHQvLyBPcHRpb25hbDogc2V0IHRoZSByZXF1ZXN0ZWQgdGFiIGtleSBpZiB0YWJzIGV4aXN0IGluIHRoaXMgZ3JvdXAuXHJcblx0XHRcdFx0XHRcdFx0aWYgKCB0YWJfa2V5ICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgdGFicyA9IHNsb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGFic10nICk7XHJcblx0XHRcdFx0XHRcdFx0XHRpZiAoIHRhYnMgJiYgd2luZG93LndwYmNfdWlfdGFicyAmJiB0eXBlb2Ygd2luZG93LndwYmNfdWlfdGFicy5zZXRfYWN0aXZlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR3aW5kb3cud3BiY191aV90YWJzLnNldF9hY3RpdmUoIHRhYnMsIFN0cmluZyggdGFiX2tleSApICk7XHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0XHQvLyBCcmluZyBpbnRvIHZpZXcgZm9yIGNvbnZlbmllbmNlLlxyXG5cdFx0XHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdFx0XHQvLyBVbmNvbW1lbnQgKE9ubHkgIGlmIG5lZWRlZCkgdGhpcyB0byBBVVRPIFNDUk9MTCB0byAgc3BlY2lmaWMgQ09MVU1OIGluIHRoZSBzZWN0aW9uOi5cclxuXHRcdFx0XHRcdFx0XHRcdC8vIHNsb3Quc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ25lYXJlc3QnIH0gKTtcclxuXHRcdFx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBjYXRjaCAoIF9lICkge31cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHRoaXMuX29uX2luc3BlY3Rvcl9mb2N1cyA9IG9uX2ZvY3VzO1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19iZmI6aW5zcGVjdG9yX2ZvY3VzJywgb25fZm9jdXMsIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGlmICggdGhpcy5fb25faW5zcGVjdG9yX2ZvY3VzICkge1xyXG5cdFx0XHRcdFx0ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiOmluc3BlY3Rvcl9mb2N1cycsIHRoaXMuX29uX2luc3BlY3Rvcl9mb2N1cywgdHJ1ZSApO1xyXG5cdFx0XHRcdFx0dGhpcy5fb25faW5zcGVjdG9yX2ZvY3VzID0gbnVsbDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEh5ZHJhdGUgaW5zcGVjdG9yIGlucHV0cyBmb3IgXCJzcGVjaWFsXCIga2V5cyB0aGF0IHdlIGhhbmRsZSBleHBsaWNpdGx5LlxyXG5cdFx0ICogV29ya3MgZm9yIGJvdGggZmllbGRzIGFuZCBzZWN0aW9ucy5cclxuXHRcdCAqIEBwYXJhbSB7V1BCQ19Gb3JtX0J1aWxkZXJ9IGJ1aWxkZXJcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlbFxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgX2h5ZHJhdGVfc3BlY2lhbF9jb250cm9scyhidWlsZGVyLCBzZWwpIHtcclxuXHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRpZiAoICFpbnMgfHwgIXNlbCApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IHNldFZhbCA9IChrZXksIHZhbCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGN0cmwgPSBpbnMucXVlcnlTZWxlY3RvciggYFtkYXRhLWluc3BlY3Rvci1rZXk9XCIke2tleX1cIl1gICk7XHJcblx0XHRcdFx0aWYgKCBjdHJsICYmICd2YWx1ZScgaW4gY3RybCApIGN0cmwudmFsdWUgPSBTdHJpbmcoIHZhbCA/PyAnJyApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Ly8gSW50ZXJuYWwgaWQgLyBuYW1lIC8gcHVibGljIGh0bWxfaWQuXHJcblx0XHRcdHNldFZhbCggJ2lkJywgc2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaWQnICkgfHwgJycgKTtcclxuXHRcdFx0c2V0VmFsKCAnbmFtZScsIHNlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLW5hbWUnICkgfHwgJycgKTtcclxuXHRcdFx0c2V0VmFsKCAnaHRtbF9pZCcsIHNlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWh0bWxfaWQnICkgfHwgJycgKTtcclxuXHJcblx0XHRcdC8vIFNlY3Rpb24tb25seSBleHRyYXMgYXJlIGhhcm1sZXNzIHRvIHNldCBmb3IgZmllbGRzIChjb250cm9scyBtYXkgbm90IGV4aXN0KS5cclxuXHRcdFx0c2V0VmFsKCAnY3NzY2xhc3MnLCBzZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1jc3NjbGFzcycgKSB8fCAnJyApO1xyXG5cdFx0XHRzZXRWYWwoICdsYWJlbCcsIHNlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWxhYmVsJyApIHx8ICcnICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSHlkcmF0ZSBpbnNwZWN0b3IgaW5wdXRzIHRoYXQgZGVjbGFyZSBhIGdlbmVyaWMgZGF0YXNldCBtYXBwaW5nIHZpYVxyXG5cdFx0ICogW2RhdGEtaW5zcGVjdG9yLWtleV0gYnV0IGRvIE5PVCBkZWNsYXJlIGEgY3VzdG9tIHZhbHVlX2Zyb20gYWRhcHRlci5cclxuXHRcdCAqIFRoaXMgbWFrZXMgc2VjdGlvbnMgZm9sbG93IHRoZSBzYW1lIGRhdGEgZmxvdyBhcyBmaWVsZHMgd2l0aCBhbG1vc3Qgbm8gZ2x1ZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge1dQQkNfRm9ybV9CdWlsZGVyfSBidWlsZGVyXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWwgLSBjdXJyZW50bHkgc2VsZWN0ZWQgZmllbGQvc2VjdGlvblxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgX2dlbmVyaWNfaHlkcmF0ZV9jb250cm9scyhidWlsZGVyLCBzZWwpIHtcclxuXHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRpZiAoICFpbnMgfHwgIXNlbCApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IFNLSVAgPSAvXihpZHxuYW1lfGh0bWxfaWR8Y3NzY2xhc3N8bGFiZWwpJC87IC8vIGhhbmRsZWQgYnkgX2h5ZHJhdGVfc3BlY2lhbF9jb250cm9sc1xyXG5cclxuXHRcdFx0Ly8gTkVXOiByZWFkIHNjaGVtYSBmb3IgdGhlIHNlbGVjdGVkIGVsZW1lbnTigJlzIHR5cGUuXHJcblx0XHRcdGNvbnN0IHNjaGVtYXMgICAgID0gd2luZG93LldQQkNfQkZCX1NjaGVtYXMgfHwge307XHJcblx0XHRcdGNvbnN0IHR5cGVLZXkgICAgID0gKHNlbC5kYXRhc2V0ICYmIHNlbC5kYXRhc2V0LnR5cGUpIHx8ICcnO1xyXG5cdFx0XHRjb25zdCBzY2hlbWFFbnRyeSA9IHNjaGVtYXNbdHlwZUtleV0gfHwgbnVsbDtcclxuXHRcdFx0Y29uc3QgcHJvcHNTY2hlbWEgPSAoc2NoZW1hRW50cnkgJiYgc2NoZW1hRW50cnkuc2NoZW1hICYmIHNjaGVtYUVudHJ5LnNjaGVtYS5wcm9wcykgPyBzY2hlbWFFbnRyeS5zY2hlbWEucHJvcHMgOiB7fTtcclxuXHRcdFx0Y29uc3QgaGFzT3duICAgICAgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5ICk7XHJcblx0XHRcdGNvbnN0IGdldERlZmF1bHQgID0gKGtleSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IG1ldGEgPSBwcm9wc1NjaGVtYVtrZXldO1xyXG5cdFx0XHRcdHJldHVybiAobWV0YSAmJiBoYXNPd24oIG1ldGEsICdkZWZhdWx0JyApKSA/IG1ldGEuZGVmYXVsdCA6IHVuZGVmaW5lZDtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGlucy5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtaW5zcGVjdG9yLWtleV0nICkuZm9yRWFjaCggKGN0cmwpID0+IHtcclxuXHRcdFx0XHRjb25zdCBrZXkgPSBTdHJpbmcoIGN0cmwuZGF0YXNldD8uaW5zcGVjdG9yS2V5IHx8ICcnICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0XHRpZiAoICFrZXkgfHwgU0tJUC50ZXN0KCBrZXkgKSApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Ly8gRWxlbWVudC1sZXZlbCBsb2NrLlxyXG5cdFx0XHRcdGNvbnN0IGRsID0gKGN0cmwuZGF0YXNldD8ubG9ja2VkIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuXHRcdFx0XHRpZiAoIGRsID09PSAnMScgfHwgZGwgPT09ICd0cnVlJyB8fCBkbCA9PT0gJ3llcycgKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdC8vIFJlc3BlY3QgZXhwbGljaXQgYWRhcHRlcnMuXHJcblx0XHRcdFx0aWYgKCBjdHJsLmRhdGFzZXQ/LnZhbHVlX2Zyb20gfHwgY3RybC5kYXRhc2V0Py52YWx1ZUZyb20gKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdGNvbnN0IHJhdyAgICAgID0gc2VsLmRhdGFzZXQgPyBzZWwuZGF0YXNldFtrZXldIDogdW5kZWZpbmVkO1xyXG5cdFx0XHRcdGNvbnN0IGhhc1JhdyAgID0gc2VsLmRhdGFzZXQgPyBoYXNPd24oIHNlbC5kYXRhc2V0LCBrZXkgKSA6IGZhbHNlO1xyXG5cdFx0XHRcdGNvbnN0IGRlZlZhbHVlID0gZ2V0RGVmYXVsdCgga2V5ICk7XHJcblxyXG5cdFx0XHRcdC8vIEJlc3QtZWZmb3J0IGNvbnRyb2wgdHlwaW5nIHdpdGggc2NoZW1hIGRlZmF1bHQgZmFsbGJhY2sgd2hlbiB2YWx1ZSBpcyBhYnNlbnQuXHJcblxyXG5cdFx0XHRcdGlmICggY3RybCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgKGN0cmwudHlwZSA9PT0gJ2NoZWNrYm94JyB8fCBjdHJsLnR5cGUgPT09ICdyYWRpbycpICkge1xuXHRcdFx0XHRcdC8vIElmIGRhdGFzZXQgaXMgbWlzc2luZyB0aGUga2V5IGVudGlyZWx5IC0+IHVzZSBzY2hlbWEgZGVmYXVsdCAoYm9vbGVhbikuXG5cdFx0XHRcdFx0aWYgKCAhaGFzUmF3ICkge1xuXHRcdFx0XHRcdFx0Y3RybC5jaGVja2VkID0gISFkZWZWYWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gQW4gZXhwbGljaXQgZW1wdHkgdmFsdWUgaXMgdGhlIGxlZ2FjeSBwZXJzaXN0ZWQgcmVwcmVzZW50YXRpb24gb2YgZmFsc2UuXG5cdFx0XHRcdFx0XHRjdHJsLmNoZWNrZWQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmNvZXJjZV9ib29sZWFuKCByYXcsIGZhbHNlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKCAndmFsdWUnIGluIGN0cmwgKSB7XHJcblx0XHRcdFx0XHRpZiAoIGhhc1JhdyApIHtcclxuXHRcdFx0XHRcdFx0Y3RybC52YWx1ZSA9IChyYXcgIT0gbnVsbCkgPyBTdHJpbmcoIHJhdyApIDogJyc7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRjdHJsLnZhbHVlID0gKGRlZlZhbHVlID09IG51bGwpID8gJycgOiBTdHJpbmcoIGRlZlZhbHVlICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0X2JpbmRfaWRfc2FuaXRpemVyKCkge1xyXG5cdFx0XHRjb25zdCBiICAgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGNvbnN0IGlucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0aWYgKCAhIGlucyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBpbnMuX193cGJjX2JmYl9pZF9zYW5pdGl6ZXJfYm91bmQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlucy5fX3dwYmNfYmZiX2lkX3Nhbml0aXplcl9ib3VuZCA9IHRydWU7XHJcblxyXG5cdFx0XHRjb25zdCBoYW5kbGVyID0gKGUpID0+IHtcclxuXHJcblx0XHRcdFx0Y29uc3QgdCA9IGUudGFyZ2V0O1xyXG5cdFx0XHRcdGlmICggIXQgfHwgISgndmFsdWUnIGluIHQpICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zdCBrZXkgICAgICAgPSAodC5kYXRhc2V0Py5pbnNwZWN0b3JLZXkgfHwgJycpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdFx0Y29uc3Qgc2VsICAgICAgID0gYi5nZXRfc2VsZWN0ZWRfZmllbGQ/LigpO1xyXG5cdFx0XHRcdGNvbnN0IGlzU2VjdGlvbiA9IHNlbD8uY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApO1xyXG5cdFx0XHRcdGlmICggIXNlbCApIHJldHVybjtcclxuXHJcblx0XHRcdFx0Ly8gVW5pZmllZCBlbWl0dGVyIHRoYXQgYWx3YXlzIGluY2x1ZGVzIHRoZSBlbGVtZW50IHJlZmVyZW5jZS5cclxuXHRcdFx0XHRjb25zdCBFViAgICAgICAgICAgICAgPSBDb3JlLldQQkNfQkZCX0V2ZW50cztcclxuXHRcdFx0XHQvLyBTVFJVQ1RVUkVfQ0hBTkdFIGNhbiBiZSBcImV4cGVuc2l2ZVwiIGJlY2F1c2Ugb3RoZXIgbGlzdGVuZXJzIG1heSB0cmlnZ2VyIGZ1bGwgY2FudmFzIHJlZnJlc2guXHJcblx0XHRcdFx0Ly8gRGVib3VuY2Ugb25seSBjb250aW51b3VzIGNvbnRyb2xzIChlLmcuIHZhbHVlIHNsaWRlciBzY3J1YmJpbmcpIG9uIHRoZSBJTlBVVCBwaGFzZS5cclxuXHRcdFx0XHRjb25zdCBlbnN1cmVfc2NfZGVib3VuY2Vfc3RhdGUgPSAoKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZSA9IHsgdGltZXJfaWQ6IDAsIHBlbmRpbmdfcGF5bG9hZDogbnVsbCB9O1xyXG5cdFx0XHRcdFx0cmV0dXJuIGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZTtcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRjb25zdCBjYW5jZWxfc2NfZGVib3VuY2VkX2VtaXQgPSAoKSA9PiB7XHJcblx0XHRcdFx0XHRjb25zdCBzdCA9IGIuX193cGJjX2JmYl9zY19kZWJvdW5jZV9zdGF0ZTtcclxuXHRcdFx0XHRcdGlmICggIXN0ICkgcmV0dXJuO1xyXG5cdFx0XHRcdFx0dHJ5IHsgY2xlYXJUaW1lb3V0KCBzdC50aW1lcl9pZCApOyB9IGNhdGNoICggXyApIHt9XHJcblx0XHRcdFx0XHRzdC50aW1lcl9pZCAgICAgICAgPSAwO1xyXG5cdFx0XHRcdFx0c3QucGVuZGluZ19wYXlsb2FkID0gbnVsbDtcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRjb25zdCBidXNfZW1pdF9jaGFuZ2UgPSAocmVhc29uLCBleHRyYSA9IHt9KSA9PiB7XHJcblx0XHRcdFx0XHQvLyBJZiB3ZeKAmXJlIGNvbW1pdHRpbmcgc29tZXRoaW5nIChjaGFuZ2UvYmx1ci9ldGMpLCBkcm9wIGFueSBwZW5kaW5nIFwiaW5wdXRcIiBlbWl0LlxyXG5cdFx0XHRcdFx0Y2FuY2VsX3NjX2RlYm91bmNlZF9lbWl0KCk7XHJcblx0XHRcdFx0XHRiLmJ1cz8uZW1pdD8uKCBFVi5TVFJVQ1RVUkVfQ0hBTkdFLCB7IHJlYXNvbiwgZWw6IHNlbCwgLi4uZXh0cmEgfSApO1xyXG5cdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdGNvbnN0IGJ1c19lbWl0X2NoYW5nZV9kZWJvdW5jZWQgPSAocmVhc29uLCBleHRyYSA9IHt9LCB3YWl0X21zKSA9PiB7XHJcblx0XHRcdFx0XHRjb25zdCBzdCA9IGVuc3VyZV9zY19kZWJvdW5jZV9zdGF0ZSgpO1xyXG5cdFx0XHRcdFx0Y29uc3QgbXMgPSBOdW1iZXIuaXNGaW5pdGUoIHdhaXRfbXMgKVxyXG5cdFx0XHRcdFx0XHQ/IHdhaXRfbXNcclxuXHRcdFx0XHRcdFx0OiAoTnVtYmVyLmlzRmluaXRlKCBVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TICkgPyBVSS5TVFJVQ1RVUkVfQ0hBTkdFX0RFQk9VTkNFX01TIDogMjQwKTtcclxuXHJcblx0XHRcdFx0XHQvLyBDYXB0dXJlIHRoZSBDVVJSRU5UIHNlbGVjdGVkIGVsZW1lbnQgaW50byB0aGUgcGF5bG9hZCBub3cgKHN0YWJsZSByZWYpLlxyXG5cdFx0XHRcdFx0c3QucGVuZGluZ19wYXlsb2FkID0geyByZWFzb24sIGVsOiBzZWwsIC4uLmV4dHJhLCBkZWJvdW5jZWQ6IHRydWUgfTtcclxuXHJcblx0XHRcdFx0XHR0cnkgeyBjbGVhclRpbWVvdXQoIHN0LnRpbWVyX2lkICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdFx0XHRcdHN0LnRpbWVyX2lkID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRzdC50aW1lcl9pZCA9IDA7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHBheWxvYWQgPSBzdC5wZW5kaW5nX3BheWxvYWQ7XHJcblx0XHRcdFx0XHRcdHN0LnBlbmRpbmdfcGF5bG9hZCA9IG51bGw7XHJcblx0XHRcdFx0XHRcdGlmICggcGF5bG9hZCApIHtcclxuXHRcdFx0XHRcdFx0XHRiLmJ1cz8uZW1pdD8uKCBFVi5TVFJVQ1RVUkVfQ0hBTkdFLCBwYXlsb2FkICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0sIG1zICk7XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0Ly8gLS0tLSBGSUVMRC9TRUNUSU9OOiBpbnRlcm5hbCBpZCAtLS0tXHJcblx0XHRcdFx0aWYgKCBrZXkgPT09ICdpZCcgKSB7XHJcblx0XHRcdFx0XHRjb25zdCB1bmlxdWUgPSBiLmlkLnNldF9maWVsZF9pZCggc2VsLCB0LnZhbHVlICk7XHJcblx0XHRcdFx0XHRpZiAoIGIucHJldmlld19tb2RlICYmICFpc1NlY3Rpb24gKSB7XHJcblx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCB0LnZhbHVlICE9PSB1bmlxdWUgKSB7XHJcblx0XHRcdFx0XHRcdHQudmFsdWUgPSB1bmlxdWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRidXNfZW1pdF9jaGFuZ2UoICdpZC1jaGFuZ2UnICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAtLS0tIEZJRUxEL1NFQ1RJT046IHB1YmxpYyBIVE1MIGlkIC0tLS1cclxuXHRcdFx0XHRpZiAoIGtleSA9PT0gJ2h0bWxfaWQnICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgYXBwbGllZCA9IGIuaWQuc2V0X2ZpZWxkX2h0bWxfaWQoIHNlbCwgdC52YWx1ZSApO1xyXG5cdFx0XHRcdFx0Ly8gRm9yIHNlY3Rpb25zLCBhbHNvIHNldCB0aGUgcmVhbCBET00gaWQgc28gYW5jaG9ycy9DU1MgY2FuIHRhcmdldCBpdC5cclxuXHRcdFx0XHRcdGlmICggaXNTZWN0aW9uICkge1xyXG5cdFx0XHRcdFx0XHRzZWwuaWQgPSBhcHBsaWVkIHx8ICcnO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggYi5wcmV2aWV3X21vZGUgKSB7XHJcblx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCB0LnZhbHVlICE9PSBhcHBsaWVkICkge1xyXG5cdFx0XHRcdFx0XHR0LnZhbHVlID0gYXBwbGllZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGJ1c19lbWl0X2NoYW5nZSggJ2h0bWwtaWQtY2hhbmdlJyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gLS0tLSBGSUVMRFMgT05MWTogbmFtZSAtLS0tXHJcblx0XHRcdFx0aWYgKCBrZXkgPT09ICduYW1lJyAmJiAhaXNTZWN0aW9uICkge1xyXG5cclxuXHRcdFx0XHRcdC8vIExpdmUgdHlwaW5nOiBzYW5pdGl6ZSBvbmx5IChOTyB1bmlxdWVuZXNzIHlldCkgdG8gYXZvaWQgXCItMlwiIHNwYW1cclxuXHRcdFx0XHRcdGlmICggZS50eXBlID09PSAnaW5wdXQnICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBiZWZvcmUgICAgPSB0LnZhbHVlO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBzYW5pdGl6ZWQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggYmVmb3JlICk7XHJcblx0XHRcdFx0XHRcdGlmICggYmVmb3JlICE9PSBzYW5pdGl6ZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gb3B0aW9uYWw6IHByZXNlcnZlIGNhcmV0IHRvIGF2b2lkIGp1bXBcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBzZWxTdGFydCA9IHQuc2VsZWN0aW9uU3RhcnQsIHNlbEVuZCA9IHQuc2VsZWN0aW9uRW5kO1xyXG5cdFx0XHRcdFx0XHRcdHQudmFsdWUgICAgICAgID0gc2FuaXRpemVkO1xyXG5cdFx0XHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdFx0XHR0LnNldFNlbGVjdGlvblJhbmdlKCBzZWxTdGFydCwgc2VsRW5kICk7XHJcblx0XHRcdFx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gdW5pcXVlbmVzcyBvbiBjaGFuZ2UvYmx1clxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIENvbW1pdCAoY2hhbmdlL2JsdXIpXHJcblx0XHRcdFx0XHRjb25zdCByYXcgPSBTdHJpbmcoIHQudmFsdWUgPz8gJycgKS50cmltKCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhcmF3ICkge1xyXG5cdFx0XHRcdFx0XHQvLyBSRVNFRUQ6IGtlZXAgbmFtZSBub24tZW1wdHkgYW5kIHByb3Zpc2lvbmFsIChhdXRvbmFtZSBzdGF5cyBPTilcclxuXHRcdFx0XHRcdFx0Y29uc3QgUyAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemU7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGJhc2UgPSBTLnNhbml0aXplX2h0bWxfbmFtZSggc2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaWQnICkgfHwgc2VsLmRhdGFzZXQuaWQgfHwgc2VsLmRhdGFzZXQudHlwZSB8fCAnZmllbGQnICk7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHVuaXEgPSBiLmlkLmVuc3VyZV91bmlxdWVfZmllbGRfbmFtZSggYmFzZSwgc2VsICk7XHJcblxyXG5cdFx0XHRcdFx0XHRzZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJywgdW5pcSApO1xyXG5cdFx0XHRcdFx0XHRzZWwuZGF0YXNldC5hdXRvbmFtZSAgICAgICAgICA9ICcxJztcclxuXHRcdFx0XHRcdFx0c2VsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgPSAnMCc7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBLZWVwIERPTSBpbiBzeW5jIGlmIHdl4oCZcmUgbm90IHJlLXJlbmRlcmluZ1xyXG5cdFx0XHRcdFx0XHRpZiAoICFiLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBjdHJsID0gc2VsLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dCx0ZXh0YXJlYSxzZWxlY3QnICk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBjdHJsICkgY3RybC5zZXRBdHRyaWJ1dGUoICduYW1lJywgdW5pcSApO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIHQudmFsdWUgIT09IHVuaXEgKSB0LnZhbHVlID0gdW5pcTtcclxuXHRcdFx0XHRcdFx0YnVzX2VtaXRfY2hhbmdlKCAnbmFtZS1yZXNlZWQnICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBOb24tZW1wdHkgY29tbWl0OiB1c2VyIHRha2VzIGNvbnRyb2w7IGRpc2FibGUgYXV0b25hbWUgZ29pbmcgZm9yd2FyZFxyXG5cdFx0XHRcdFx0c2VsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgPSAnMSc7XHJcblx0XHRcdFx0XHRzZWwuZGF0YXNldC5hdXRvbmFtZSAgICAgICAgICA9ICcwJztcclxuXHJcblx0XHRcdFx0XHRjb25zdCBzYW5pdGl6ZWQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSggcmF3ICk7XHJcblx0XHRcdFx0XHRjb25zdCB1bmlxdWUgICAgPSBiLmlkLnNldF9maWVsZF9uYW1lKCBzZWwsIHNhbml0aXplZCApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggIWIucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBjdHJsID0gc2VsLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dCx0ZXh0YXJlYSxzZWxlY3QnICk7XHJcblx0XHRcdFx0XHRcdGlmICggY3RybCApIGN0cmwuc2V0QXR0cmlidXRlKCAnbmFtZScsIHVuaXF1ZSApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Yi5yZW5kZXJfcHJldmlldyggc2VsICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCB0LnZhbHVlICE9PSB1bmlxdWUgKSB0LnZhbHVlID0gdW5pcXVlO1xyXG5cdFx0XHRcdFx0YnVzX2VtaXRfY2hhbmdlKCAnbmFtZS1jaGFuZ2UnICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAtLS0tIFNFQ1RJT05TICYgRklFTERTOiBjc3NjbGFzcyAobGl2ZSBhcHBseTsgbm8gcmUtcmVuZGVyKSAtLS0tXHJcblx0XHRcdFx0aWYgKCBrZXkgPT09ICdjc3NjbGFzcycgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBuZXh0ICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9jc3NfY2xhc3NsaXN0KCB0LnZhbHVlIHx8ICcnICk7XHJcblx0XHRcdFx0XHRjb25zdCBkZXNpcmVkQXJyID0gbmV4dC5zcGxpdCggL1xccysvICkuZmlsdGVyKCBCb29sZWFuICk7XHJcblx0XHRcdFx0XHRjb25zdCBkZXNpcmVkU2V0ID0gbmV3IFNldCggZGVzaXJlZEFyciApO1xyXG5cclxuXHRcdFx0XHRcdC8vIENvcmUgY2xhc3NlcyBhcmUgbmV2ZXIgdG91Y2hlZC5cclxuXHRcdFx0XHRcdGNvbnN0IGlzQ29yZSA9IChjbHMpID0+IGNscyA9PT0gJ2lzLXNlbGVjdGVkJyB8fCBjbHMuc3RhcnRzV2l0aCggJ3dwYmNfJyApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFNuYXBzaG90IGJlZm9yZSBtdXRhdGluZyAoRE9NVG9rZW5MaXN0IGlzIGxpdmUpLlxyXG5cdFx0XHRcdFx0Y29uc3QgYmVmb3JlQ2xhc3NlcyA9IEFycmF5LmZyb20oIHNlbC5jbGFzc0xpc3QgKTtcclxuXHRcdFx0XHRcdGNvbnN0IGN1c3RvbUJlZm9yZSAgPSBiZWZvcmVDbGFzc2VzLmZpbHRlciggKGMpID0+ICFpc0NvcmUoIGMgKSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFJlbW92ZSBzdHJheSBub24tY29yZSBjbGFzc2VzIG5vdCBpbiBkZXNpcmVkLlxyXG5cdFx0XHRcdFx0Y3VzdG9tQmVmb3JlLmZvckVhY2goIChjKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmICggIWRlc2lyZWRTZXQuaGFzKCBjICkgKSBzZWwuY2xhc3NMaXN0LnJlbW92ZSggYyApO1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFkZCBtaXNzaW5nIGRlc2lyZWQgY2xhc3NlcyBpbiBvbmUgZ28uXHJcblx0XHRcdFx0XHRjb25zdCBtaXNzaW5nID0gZGVzaXJlZEFyci5maWx0ZXIoIChjKSA9PiAhY3VzdG9tQmVmb3JlLmluY2x1ZGVzKCBjICkgKTtcclxuXHRcdFx0XHRcdGlmICggbWlzc2luZy5sZW5ndGggKSBzZWwuY2xhc3NMaXN0LmFkZCggLi4ubWlzc2luZyApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEtlZXAgZGF0YXNldCBpbiBzeW5jIChhdm9pZCB1c2VsZXNzIGF0dHJpYnV0ZSB3cml0ZXMpLlxyXG5cdFx0XHRcdFx0aWYgKCBzZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1jc3NjbGFzcycgKSAhPT0gbmV4dCApIHtcclxuXHRcdFx0XHRcdFx0c2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtY3NzY2xhc3MnLCBuZXh0ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gRW1pdCBvbmx5IGlmIHNvbWV0aGluZyBhY3R1YWxseSBjaGFuZ2VkLlxyXG5cdFx0XHRcdFx0Y29uc3QgYWZ0ZXJDbGFzc2VzID0gQXJyYXkuZnJvbSggc2VsLmNsYXNzTGlzdCApO1xyXG5cdFx0XHRcdFx0Y29uc3QgY2hhbmdlZCAgICAgID0gYWZ0ZXJDbGFzc2VzLmxlbmd0aCAhPT0gYmVmb3JlQ2xhc3Nlcy5sZW5ndGggfHwgYmVmb3JlQ2xhc3Nlcy5zb21lKCAoYywgaSkgPT4gYyAhPT0gYWZ0ZXJDbGFzc2VzW2ldICk7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgZGV0YWlsID0geyBrZXk6ICdjc3NjbGFzcycsIHBoYXNlOiBlLnR5cGUgfTtcclxuXHRcdFx0XHRcdGlmICggaXNTZWN0aW9uICkge1xyXG5cdFx0XHRcdFx0XHRidXNfZW1pdF9jaGFuZ2UoICdjc3NjbGFzcy1jaGFuZ2UnLCBkZXRhaWwgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGJ1c19lbWl0X2NoYW5nZSggJ3Byb3AtY2hhbmdlJywgZGV0YWlsICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdFx0Ly8gLS0tLSBTRUNUSU9OUzogbGFiZWwgLS0tLVxyXG5cdFx0XHRcdGlmICggaXNTZWN0aW9uICYmIGtleSA9PT0gJ2xhYmVsJyApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHZhbCA9IFN0cmluZyggdC52YWx1ZSA/PyAnJyApO1xyXG5cdFx0XHRcdFx0c2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbGFiZWwnLCB2YWwgKTtcclxuXHRcdFx0XHRcdGJ1c19lbWl0X2NoYW5nZSggJ2xhYmVsLWNoYW5nZScgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIC0tLS0gRklFTERTOiBsYWJlbCAoYXV0by1uYW1lIHdoaWxlIHR5cGluZzsgZnJlZXplIG9uIGNvbW1pdCkgLS0tLVxyXG5cdFx0XHRcdGlmICggIWlzU2VjdGlvbiAmJiBrZXkgPT09ICdsYWJlbCcgKSB7XHJcblx0XHRcdFx0XHRjb25zdCB2YWwgICAgICAgICA9IFN0cmluZyggdC52YWx1ZSA/PyAnJyApO1xyXG5cdFx0XHRcdFx0c2VsLmRhdGFzZXQubGFiZWwgPSB2YWw7XHJcblxyXG5cdFx0XHRcdFx0Ly8gd2hpbGUgdHlwaW5nLCBhbGxvdyBhdXRvLW5hbWUgKGlmIGZsYWdzIHBlcm1pdClcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZS5tYXliZV9hdXRvbmFtZV9mcm9tX2xhYmVsKCBiLCBzZWwsIHZhbCApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gaWYgdXNlciBjb21taXR0ZWQgdGhlIGxhYmVsIChibHVyL2NoYW5nZSksIGZyZWV6ZSBmdXR1cmUgYXV0by1uYW1lXHJcblx0XHRcdFx0XHRpZiAoIGUudHlwZSAhPT0gJ2lucHV0JyApIHtcclxuXHRcdFx0XHRcdFx0c2VsLmRhdGFzZXQuYXV0b25hbWUgPSAnMCc7ICAgLy8gc3RvcCBmdXR1cmUgbGFiZWwtPm5hbWUgc3luY1xyXG5cdFx0XHRcdFx0XHRzZWwuZGF0YXNldC5mcmVzaCAgICA9ICcwJzsgICAvLyBhbHNvIGtpbGwgdGhlIFwiZnJlc2hcIiBlc2NhcGUgaGF0Y2hcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBPcHRpb25hbCBVSSBuaWNldHk6IGRpc2FibGUgTmFtZSB3aGVuIGF1dG8gaXMgT04sIGVuYWJsZSB3aGVuIE9GRlxyXG5cdFx0XHRcdFx0Y29uc3QgaW5zICAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0XHRjb25zdCBuYW1lQ3RybCA9IGlucz8ucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXk9XCJuYW1lXCJdJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBuYW1lQ3RybCApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgYXV0b0FjdGl2ZSA9XHJcblx0XHRcdFx0XHRcdFx0XHQgIChzZWwuZGF0YXNldC5hdXRvbmFtZSA/PyAnMScpICE9PSAnMCcgJiZcclxuXHRcdFx0XHRcdFx0XHRcdCAgc2VsLmRhdGFzZXQubmFtZV91c2VyX3RvdWNoZWQgIT09ICcxJyAmJlxyXG5cdFx0XHRcdFx0XHRcdFx0ICBzZWwuZGF0YXNldC53YXNfbG9hZGVkICE9PSAnMSc7XHJcblx0XHRcdFx0XHRcdG5hbWVDdHJsLnRvZ2dsZUF0dHJpYnV0ZSggJ2Rpc2FibGVkJywgYXV0b0FjdGl2ZSApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIGF1dG9BY3RpdmUgJiYgIW5hbWVDdHJsLnBsYWNlaG9sZGVyICkge1xyXG5cdFx0XHRcdFx0XHRcdG5hbWVDdHJsLnBsYWNlaG9sZGVyID0gYj8uaTE4bj8uYXV0b19mcm9tX2xhYmVsID8/ICdhdXRvIOKAlCBmcm9tIGxhYmVsJztcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRpZiAoICFhdXRvQWN0aXZlICYmIG5hbWVDdHJsLnBsYWNlaG9sZGVyID09PSAoYj8uaTE4bj8uYXV0b19mcm9tX2xhYmVsID8/ICdhdXRvIOKAlCBmcm9tIGxhYmVsJykgKSB7XHJcblx0XHRcdFx0XHRcdFx0bmFtZUN0cmwucGxhY2Vob2xkZXIgPSAnJztcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIEFsd2F5cyByZS1yZW5kZXIgdGhlIHByZXZpZXcgc28gbGFiZWwgY2hhbmdlcyBhcmUgdmlzaWJsZSBpbW1lZGlhdGVseS5cclxuXHRcdFx0XHRcdGIucmVuZGVyX3ByZXZpZXcoIHNlbCApO1xyXG5cdFx0XHRcdFx0YnVzX2VtaXRfY2hhbmdlKCAnbGFiZWwtY2hhbmdlJyApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHRcdC8vIC0tLS0gREVGQVVMVCAoR0VORVJJQyk6IGRhdGFzZXQgd3JpdGVyIGZvciBib3RoIGZpZWxkcyAmIHNlY3Rpb25zIC0tLS1cclxuXHRcdFx0XHQvLyBBbnkgaW5zcGVjdG9yIGNvbnRyb2wgd2l0aCBbZGF0YS1pbnNwZWN0b3Ita2V5XSB0aGF0IGRvZXNuJ3QgaGF2ZSBhIGN1c3RvbVxyXG5cdFx0XHRcdC8vIGFkYXB0ZXIvdmFsdWVfZnJvbSB3aWxsIHNpbXBseSByZWFkL3dyaXRlIHNlbC5kYXRhc2V0W2tleV0uXHJcblx0XHRcdFx0aWYgKCBrZXkgKSB7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3Qgc2VsZkxvY2tlZCA9IC9eKDF8dHJ1ZXx5ZXMpJC9pLnRlc3QoICh0LmRhdGFzZXQ/LmxvY2tlZCB8fCAnJykudHJpbSgpICk7XHJcblx0XHRcdFx0XHRpZiAoIHNlbGZMb2NrZWQgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBTa2lwIGtleXMgd2UgaGFuZGxlZCBhYm92ZSB0byBhdm9pZCBkb3VibGUgd29yay5cclxuXHRcdFx0XHRcdGlmICgga2V5ID09PSAnaWQnIHx8IGtleSA9PT0gJ25hbWUnIHx8IGtleSA9PT0gJ2h0bWxfaWQnIHx8IGtleSA9PT0gJ2Nzc2NsYXNzJyB8fCBrZXkgPT09ICdsYWJlbCcgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGxldCBuZXh0VmFsID0gJyc7XG5cdFx0XHRcdFx0aWYgKCB0IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiAodC50eXBlID09PSAnY2hlY2tib3gnIHx8IHQudHlwZSA9PT0gJ3JhZGlvJykgKSB7XG5cdFx0XHRcdFx0XHQvLyBQZXJzaXN0IGJvdGggYm9vbGVhbiBzdGF0ZXMgZXhwbGljaXRseSBzbyBzY2hlbWEgZGVmYXVsdHMgY2Fubm90IHJlcGxhY2UgZmFsc2UuXG5cdFx0XHRcdFx0XHRuZXh0VmFsID0gdC5jaGVja2VkID8gJ3RydWUnIDogJ2ZhbHNlJztcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCAndmFsdWUnIGluIHQgKSB7XHJcblx0XHRcdFx0XHRcdG5leHRWYWwgPSBTdHJpbmcoIHQudmFsdWUgPz8gJycgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdC8vIFBlcnNpc3QgdG8gZGF0YXNldC5cclxuXHRcdFx0XHRcdGlmICggc2VsPy5kYXRhc2V0ICkgc2VsLmRhdGFzZXRba2V5XSA9IG5leHRWYWw7XHJcblxyXG5cdFx0XHRcdFx0Ly8gR2VuZXJhdG9yIGNvbnRyb2xzIGFyZSBcIlVJIGlucHV0c1wiIOKAlCBhdm9pZCBTVFJVQ1RVUkVfQ0hBTkdFIHNwYW0gd2hpbGUgZHJhZ2dpbmcvdHlwaW5nLlxyXG5cdFx0XHRcdFx0Y29uc3QgaXNfZ2VuX2tleSA9IChrZXkuaW5kZXhPZiggJ2dlbl8nICkgPT09IDApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFJlLXJlbmRlciBvbiB2aXN1YWwga2V5cyBzbyBwcmV2aWV3IHN0YXlzIGluIHN5bmMgKGNhbGVuZGFyIGxhYmVsL2hlbHAsIGV0Yy4pLlxyXG5cdFx0XHRcdFx0Y29uc3QgdmlzdWFsS2V5cyA9IG5ldyBTZXQoIFsgJ2hlbHAnLCAncGxhY2Vob2xkZXInLCAnbWluX3dpZHRoJywgJ2Nzc2NsYXNzJyBdICk7XHJcblx0XHRcdFx0XHRpZiAoICFpc1NlY3Rpb24gJiYgKHZpc3VhbEtleXMuaGFzKCBrZXkgKSB8fCBrZXkuc3RhcnRzV2l0aCggJ3VpXycgKSkgKSB7XHJcblx0XHRcdFx0XHRcdC8vIExpZ2h0IGhldXJpc3RpYzogb25seSByZS1yZW5kZXIgb24gY29tbWl0IGZvciBoZWF2eSBpbnB1dHM7IGxpdmUgZm9yIHNob3J0IG9uZXMgaXMgZmluZS5cclxuXHRcdFx0XHRcdFx0aWYgKCBlLnR5cGUgPT09ICdjaGFuZ2UnIHx8IGtleSA9PT0gJ2hlbHAnIHx8IGtleSA9PT0gJ3BsYWNlaG9sZGVyJyApIHtcclxuXHRcdFx0XHRcdFx0XHRiLnJlbmRlcl9wcmV2aWV3KCBzZWwgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggIShpc19nZW5fa2V5ICYmIGUudHlwZSA9PT0gJ2lucHV0JykgKSB7XHJcblx0XHRcdFx0XHRcdC8vIERlYm91bmNlIGNvbnRpbnVvdXMgdmFsdWUgc2xpZGVyIGlucHV0IGV2ZW50cyB0byBhdm9pZCBmdWxsLWNhbnZhcyByZWZyZXNoIHNwYW0uXHJcblx0XHRcdFx0XHRcdC8vIFdlIGRldGVjdCB0aGUgc2xpZGVyIGdyb3VwIHZpYSBbZGF0YS1sZW4tZ3JvdXBdIHdyYXBwZXIuXHJcblx0XHRcdFx0XHRcdGNvbnN0IGlzX2xlbl9ncm91cF9jdHJsID0gISEodCAmJiB0LmNsb3Nlc3QgJiYgdC5jbG9zZXN0KCAnW2RhdGEtbGVuLWdyb3VwXScgKSk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIGlzX2xlbl9ncm91cF9jdHJsICYmIGUudHlwZSA9PT0gJ2lucHV0JyApIHtcclxuXHRcdFx0XHRcdFx0XHRidXNfZW1pdF9jaGFuZ2VfZGVib3VuY2VkKCAncHJvcC1jaGFuZ2UnLCB7IGtleSwgcGhhc2U6IGUudHlwZSB9ICk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0YnVzX2VtaXRfY2hhbmdlKCAncHJvcC1jaGFuZ2UnLCB7IGtleSwgcGhhc2U6IGUudHlwZSB9ICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRpbnMuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGhhbmRsZXIsIHRydWUgKTtcclxuXHRcdFx0Ly8gcmVmbGVjdCBpbnN0YW50bHkgd2hpbGUgdHlwaW5nIGFzIHdlbGwuXHJcblx0XHRcdGlucy5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBoYW5kbGVyLCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIEluc3BlY3RvciBhZnRlciBhIGZpZWxkIGlzIGFkZGVkLlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqL1xyXG5cdFx0X29wZW5faW5zcGVjdG9yX2FmdGVyX2ZpZWxkX2FkZGVkKCkge1xyXG5cdFx0XHRjb25zdCBFViA9IENvcmUuV1BCQ19CRkJfRXZlbnRzO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub24/LiggRVYuRklFTERfQURELCAoZSkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGVsID0gZT8uZGV0YWlsPy5lbCB8fCBudWxsO1xyXG5cdFx0XHRcdGlmICggZWwgJiYgdGhpcy5idWlsZGVyPy5zZWxlY3RfZmllbGQgKSB7XHJcblx0XHRcdFx0XHR0aGlzLmJ1aWxkZXIuc2VsZWN0X2ZpZWxkKCBlbCwgeyBzY3JvbGxJbnRvVmlldzogdHJ1ZSB9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIFNob3cgSW5zcGVjdG9yIFBhbGV0dGUuXHJcblx0XHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoXHJcblx0XHRcdFx0XHQnd3BiY19iZmI6c2hvd19wYW5lbCcsXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHBhbmVsX2lkOiAnd3BiY19iZmJfX2luc3BlY3RvcicsXHJcblx0XHRcdFx0XHRcdHRhYl9pZCAgOiAnd3BiY190YWJfaW5zcGVjdG9yJ1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBLZXlib2FyZCBzaG9ydGN1dHMgZm9yIHNlbGVjdGlvbiwgZGVsZXRpb24sIGFuZCBtb3ZlbWVudC5cclxuXHQgKi9cclxuXHRVSS5XUEJDX0JGQl9LZXlib2FyZF9Db250cm9sbGVyID0gY2xhc3MgZXh0ZW5kcyBVSS5XUEJDX0JGQl9Nb2R1bGUge1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0dGhpcy5fb25fa2V5ID0gdGhpcy5vbl9rZXkuYmluZCggdGhpcyApO1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIHRoaXMuX29uX2tleSwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRlc3Ryb3koKSB7XHJcblx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgdGhpcy5fb25fa2V5LCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZSAqL1xyXG5cdFx0b25fa2V5KGUpIHtcclxuXHRcdFx0Y29uc3QgYiAgICAgICAgID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRjb25zdCBpc190eXBpbmcgPSB0aGlzLl9pc190eXBpbmdfYW55d2hlcmUoKTtcclxuXHRcdFx0aWYgKCBlLmtleSA9PT0gJ0VzY2FwZScgKSB7XHJcblx0XHRcdFx0aWYgKCBpc190eXBpbmcgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMuYnVpbGRlci5idXMuZW1pdCggQ29yZS5XUEJDX0JGQl9FdmVudHMuQ0xFQVJfU0VMRUNUSU9OLCB7IHNvdXJjZTogJ2VzYycgfSApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBzZWxlY3RlZCA9IGIuZ2V0X3NlbGVjdGVkX2ZpZWxkPy4oKTtcclxuXHRcdFx0aWYgKCAhc2VsZWN0ZWQgfHwgaXNfdHlwaW5nICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGUua2V5ID09PSAnRGVsZXRlJyB8fCBlLmtleSA9PT0gJ0JhY2tzcGFjZScgKSB7XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGIuZGVsZXRlX2l0ZW0/Liggc2VsZWN0ZWQgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAoZS5hbHRLZXkgfHwgZS5jdHJsS2V5IHx8IGUubWV0YUtleSkgJiYgKGUua2V5ID09PSAnQXJyb3dVcCcgfHwgZS5rZXkgPT09ICdBcnJvd0Rvd24nKSAmJiAhZS5zaGlmdEtleSApIHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0Y29uc3QgZGlyID0gKGUua2V5ID09PSAnQXJyb3dVcCcpID8gJ3VwJyA6ICdkb3duJztcclxuXHRcdFx0XHRiLm1vdmVfaXRlbT8uKCBzZWxlY3RlZCwgZGlyICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZS5rZXkgPT09ICdFbnRlcicgKSB7XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGIuc2VsZWN0X2ZpZWxkKCBzZWxlY3RlZCwgeyBzY3JvbGxJbnRvVmlldzogdHJ1ZSB9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHJldHVybnMge2Jvb2xlYW59ICovXHJcblx0XHRfaXNfdHlwaW5nX2FueXdoZXJlKCkge1xyXG5cdFx0XHRjb25zdCBhICAgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xyXG5cdFx0XHRjb25zdCB0YWcgPSBhPy50YWdOYW1lO1xyXG5cdFx0XHRpZiAoIHRhZyA9PT0gJ0lOUFVUJyB8fCB0YWcgPT09ICdURVhUQVJFQScgfHwgdGFnID09PSAnU0VMRUNUJyB8fCAoYT8uaXNDb250ZW50RWRpdGFibGUgPT09IHRydWUpICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGlucyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0cmV0dXJuICEhKGlucyAmJiBhICYmIGlucy5jb250YWlucyggYSApKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDb2x1bW4gcmVzaXplIGxvZ2ljIGZvciBzZWN0aW9uIHJvd3MuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfUmVzaXplX0NvbnRyb2xsZXIgPSBjbGFzcyBleHRlbmRzIFVJLldQQkNfQkZCX01vZHVsZSB7XHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuaW5pdF9yZXNpemVfaGFuZGxlciA9IHRoaXMuaGFuZGxlX3Jlc2l6ZS5iaW5kKCB0aGlzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiByZWFkIHRoZSBDU1MgdmFyIChrZXB0IGxvY2FsIHNvIGl0IGRvZXNu4oCZdCBkZXBlbmQgb24gdGhlIE1pbi1XaWR0aCBtb2R1bGUpXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIGNvbFxyXG5cdFx0ICogQHJldHVybnMge251bWJlcnxudW1iZXJ9XHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICovXHJcblx0XHRfZ2V0X2NvbF9taW5fcHgoY29sKSB7XHJcblx0XHRcdGNvbnN0IHYgPSBnZXRDb21wdXRlZFN0eWxlKCBjb2wgKS5nZXRQcm9wZXJ0eVZhbHVlKCAnLS13cGJjLWNvbC1taW4nICkgfHwgJzAnO1xyXG5cdFx0XHRjb25zdCBuID0gcGFyc2VGbG9hdCggdiApO1xyXG5cdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBuICkgPyBNYXRoLm1heCggMCwgbiApIDogMDtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHBhcmFtIHtNb3VzZUV2ZW50fSBlICovXHJcblx0XHRoYW5kbGVfcmVzaXplKGUpIHtcclxuXHRcdFx0Y29uc3QgYiA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRpZiAoIGUuYnV0dG9uICE9PSAwICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgcmVzaXplciAgID0gZS5jdXJyZW50VGFyZ2V0O1xyXG5cdFx0XHRjb25zdCByb3dfZWwgICAgPSByZXNpemVyLnBhcmVudEVsZW1lbnQ7XHJcblx0XHRcdGNvbnN0IGNvbHMgICAgICA9IEFycmF5LmZyb20oIHJvd19lbC5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkgKTtcclxuXHRcdFx0Y29uc3QgbGVmdF9jb2wgID0gcmVzaXplcj8ucHJldmlvdXNFbGVtZW50U2libGluZztcclxuXHRcdFx0Y29uc3QgcmlnaHRfY29sID0gcmVzaXplcj8ubmV4dEVsZW1lbnRTaWJsaW5nO1xyXG5cdFx0XHRpZiAoICFsZWZ0X2NvbCB8fCAhcmlnaHRfY29sIHx8ICFsZWZ0X2NvbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fY29sdW1uJyApIHx8ICFyaWdodF9jb2wuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2NvbHVtbicgKSApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGxlZnRfaW5kZXggID0gY29scy5pbmRleE9mKCBsZWZ0X2NvbCApO1xyXG5cdFx0XHRjb25zdCByaWdodF9pbmRleCA9IGNvbHMuaW5kZXhPZiggcmlnaHRfY29sICk7XHJcblx0XHRcdGlmICggbGVmdF9pbmRleCA9PT0gLTEgfHwgcmlnaHRfaW5kZXggIT09IGxlZnRfaW5kZXggKyAxICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3Qgc3RhcnRfeCAgICAgICAgPSBlLmNsaWVudFg7XHJcblx0XHRcdGNvbnN0IGxlZnRfc3RhcnRfcHggID0gbGVmdF9jb2wuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XHJcblx0XHRcdGNvbnN0IHJpZ2h0X3N0YXJ0X3B4ID0gcmlnaHRfY29sLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoO1xyXG5cdFx0XHRjb25zdCBwYWlyX3B4ICAgICAgICA9IE1hdGgubWF4KCAwLCBsZWZ0X3N0YXJ0X3B4ICsgcmlnaHRfc3RhcnRfcHggKTtcclxuXHJcblx0XHRcdGNvbnN0IGdwICAgICAgICAgPSBiLmNvbF9nYXBfcGVyY2VudDtcclxuXHRcdFx0Y29uc3QgY29tcHV0ZWQgICA9IGIubGF5b3V0LmNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzX2Zyb21fcm93KCByb3dfZWwsIGdwICk7XHJcblx0XHRcdGNvbnN0IGF2YWlsYWJsZSAgPSBjb21wdXRlZC5hdmFpbGFibGU7ICAgICAgICAgICAgICAgICAvLyAlIG9mIHRoZSDigJxmdWxsIDEwMOKAnSBhZnRlciBnYXBzXHJcblx0XHRcdGNvbnN0IGJhc2VzICAgICAgPSBjb21wdXRlZC5iYXNlcy5zbGljZSggMCApOyAgICAgICAgICAgIC8vIGN1cnJlbnQgZWZmZWN0aXZlICVcclxuXHRcdFx0Y29uc3QgcGFpcl9hdmFpbCA9IGJhc2VzW2xlZnRfaW5kZXhdICsgYmFzZXNbcmlnaHRfaW5kZXhdO1xyXG5cclxuXHRcdFx0Ly8gQmFpbCBpZiB3ZSBjYW7igJl0IGNvbXB1dGUgc2FuZSBkZWx0YXMuXHJcblx0XHRcdGlmICghcGFpcl9weCB8fCAhTnVtYmVyLmlzRmluaXRlKHBhaXJfYXZhaWwpIHx8IHBhaXJfYXZhaWwgPD0gMCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gLS0tIE1JTiBDTEFNUFMgKHBpeGVscykgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRjb25zdCBwY3RUb1B4ICAgICAgID0gKHBjdCkgPT4gKHBhaXJfcHggKiAocGN0IC8gcGFpcl9hdmFpbCkpOyAvLyBwYWlyLWxvY2FsIHBlcmNlbnQgLT4gcHhcclxuXHRcdFx0Y29uc3QgZ2VuZXJpY01pblBjdCA9IE1hdGgubWluKCAwLjEsIGF2YWlsYWJsZSApOyAgICAgICAgICAgICAgICAgIC8vIG9yaWdpbmFsIDAuMSUgZmxvb3IgKGluIOKAnGF2YWlsYWJsZSAl4oCdIHNwYWNlKVxyXG5cdFx0XHRjb25zdCBnZW5lcmljTWluUHggID0gcGN0VG9QeCggZ2VuZXJpY01pblBjdCApO1xyXG5cclxuXHRcdFx0Y29uc3QgbGVmdE1pblB4ICA9IE1hdGgubWF4KCB0aGlzLl9nZXRfY29sX21pbl9weCggbGVmdF9jb2wgKSwgZ2VuZXJpY01pblB4ICk7XHJcblx0XHRcdGNvbnN0IHJpZ2h0TWluUHggPSBNYXRoLm1heCggdGhpcy5fZ2V0X2NvbF9taW5fcHgoIHJpZ2h0X2NvbCApLCBnZW5lcmljTWluUHggKTtcclxuXHJcblx0XHRcdC8vIGZyZWV6ZSB0ZXh0IHNlbGVjdGlvbiArIGN1cnNvclxyXG5cdFx0XHRjb25zdCBwcmV2X3VzZXJfc2VsZWN0ICAgICAgICAgPSBkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3Q7XHJcblx0XHRcdGRvY3VtZW50LmJvZHkuc3R5bGUudXNlclNlbGVjdCA9ICdub25lJztcclxuXHRcdFx0cm93X2VsLnN0eWxlLmN1cnNvciAgICAgICAgICAgID0gJ2NvbC1yZXNpemUnO1xyXG5cclxuXHRcdFx0Y29uc3Qgb25fbW91c2VfbW92ZSA9IChldikgPT4ge1xyXG5cdFx0XHRcdGlmICggIXBhaXJfcHggKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdC8vIHdvcmsgaW4gcGl4ZWxzLCBjbGFtcCBieSBlYWNoIHNpZGXigJlzIG1pblxyXG5cdFx0XHRcdGNvbnN0IGRlbHRhX3B4ICAgPSBldi5jbGllbnRYIC0gc3RhcnRfeDtcclxuXHRcdFx0XHRsZXQgbmV3TGVmdFB4ICAgID0gbGVmdF9zdGFydF9weCArIGRlbHRhX3B4O1xyXG5cdFx0XHRcdG5ld0xlZnRQeCAgICAgICAgPSBNYXRoLm1heCggbGVmdE1pblB4LCBNYXRoLm1pbiggcGFpcl9weCAtIHJpZ2h0TWluUHgsIG5ld0xlZnRQeCApICk7XHJcblx0XHRcdFx0Y29uc3QgbmV3UmlnaHRQeCA9IHBhaXJfcHggLSBuZXdMZWZ0UHg7XHJcblxyXG5cdFx0XHRcdC8vIHRyYW5zbGF0ZSBiYWNrIHRvIHBhaXItbG9jYWwgcGVyY2VudGFnZXNcclxuXHRcdFx0XHRjb25zdCBuZXdMZWZ0UGN0ICAgICAgPSAobmV3TGVmdFB4IC8gcGFpcl9weCkgKiBwYWlyX2F2YWlsO1xyXG5cdFx0XHRcdGNvbnN0IG5ld0Jhc2VzICAgICAgICA9IGJhc2VzLnNsaWNlKCAwICk7XHJcblx0XHRcdFx0bmV3QmFzZXNbbGVmdF9pbmRleF0gID0gbmV3TGVmdFBjdDtcclxuXHRcdFx0XHRuZXdCYXNlc1tyaWdodF9pbmRleF0gPSBwYWlyX2F2YWlsIC0gbmV3TGVmdFBjdDtcclxuXHJcblx0XHRcdFx0Yi5sYXlvdXQuYXBwbHlfYmFzZXNfdG9fcm93KCByb3dfZWwsIG5ld0Jhc2VzICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCBvbl9tb3VzZV91cCA9ICgpID0+IHtcclxuXHRcdFx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnbW91c2Vtb3ZlJywgb25fbW91c2VfbW92ZSApO1xyXG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdtb3VzZXVwJywgb25fbW91c2VfdXAgKTtcclxuXHRcdFx0XHR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ21vdXNldXAnLCBvbl9tb3VzZV91cCApO1xyXG5cdFx0XHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdtb3VzZWxlYXZlJywgb25fbW91c2VfdXAgKTtcclxuXHRcdFx0XHRkb2N1bWVudC5ib2R5LnN0eWxlLnVzZXJTZWxlY3QgPSBwcmV2X3VzZXJfc2VsZWN0IHx8ICcnO1xyXG5cdFx0XHRcdHJvd19lbC5zdHlsZS5jdXJzb3IgICAgICAgICAgICA9ICcnO1xyXG5cclxuXHRcdFx0XHQvLyBub3JtYWxpemUgdG8gdGhlIHJvd+KAmXMgYXZhaWxhYmxlICUgYWdhaW5cclxuXHRcdFx0XHRjb25zdCBub3JtYWxpemVkID0gYi5sYXlvdXQuY29tcHV0ZV9lZmZlY3RpdmVfYmFzZXNfZnJvbV9yb3coIHJvd19lbCwgZ3AgKTtcclxuXHRcdFx0XHRiLmxheW91dC5hcHBseV9iYXNlc190b19yb3coIHJvd19lbCwgbm9ybWFsaXplZC5iYXNlcyApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlbW92ZScsIG9uX21vdXNlX21vdmUgKTtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNldXAnLCBvbl9tb3VzZV91cCApO1xyXG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNldXAnLCBvbl9tb3VzZV91cCApO1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2VsZWF2ZScsIG9uX21vdXNlX3VwICk7XHJcblx0XHR9XHJcblxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBhZ2UgYW5kIHNlY3Rpb24gY3JlYXRpb24sIHJlYnVpbGRpbmcsIGFuZCBuZXN0ZWQgU29ydGFibGUgc2V0dXAuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfUGFnZXNfU2VjdGlvbnMgPSBjbGFzcyBleHRlbmRzIFVJLldQQkNfQkZCX01vZHVsZSB7XHJcblxyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0dGhpcy5idWlsZGVyLmFkZF9wYWdlICAgICAgICAgICAgICAgICAgPSAob3B0cykgPT4gdGhpcy5hZGRfcGFnZSggb3B0cyApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIuYWRkX3NlY3Rpb24gICAgICAgICAgICAgICA9IChjb250YWluZXIsIGNvbHMpID0+IHRoaXMuYWRkX3NlY3Rpb24oIGNvbnRhaW5lciwgY29scyApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXIucmVidWlsZF9zZWN0aW9uICAgICAgICAgICA9IChzZWN0aW9uX2RhdGEsIGNvbnRhaW5lcikgPT4gdGhpcy5yZWJ1aWxkX3NlY3Rpb24oIHNlY3Rpb25fZGF0YSwgY29udGFpbmVyICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5pbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzID0gKGVsKSA9PiB0aGlzLmluaXRfYWxsX25lc3RlZF9zb3J0YWJsZXMoIGVsICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlci5pbml0X3NlY3Rpb25fc29ydGFibGUgICAgID0gKGVsKSA9PiB0aGlzLmluaXRfc2VjdGlvbl9zb3J0YWJsZSggZWwgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyLnBhZ2VzX3NlY3Rpb25zICAgICAgICAgICAgPSB0aGlzO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2l2ZSBldmVyeSBmaWVsZC9zZWN0aW9uIGluIGEgY2xvbmVkIHN1YnRyZWUgYSBmcmVzaCBkYXRhLXVpZCBzb1xyXG5cdFx0ICogdW5pcXVlbmVzcyBjaGVja3MgZG9uJ3QgZXhjbHVkZSB0aGVpciBvcmlnaW5hbHMuXHJcblx0XHQgKi9cclxuXHRcdF9yZXRhZ191aWRzX2luX3N1YnRyZWUocm9vdCkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRpZiAoICFyb290ICkgcmV0dXJuO1xyXG5cdFx0XHRjb25zdCBub2RlcyA9IFtdO1xyXG5cdFx0XHRpZiAoIHJvb3QuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApIHx8IHJvb3QuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSApIHtcclxuXHRcdFx0XHRub2Rlcy5wdXNoKCByb290ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0bm9kZXMucHVzaCggLi4ucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19zZWN0aW9uLCAud3BiY19iZmJfX2ZpZWxkJyApICk7XHJcblx0XHRcdG5vZGVzLmZvckVhY2goIChlbCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHByZWZpeCAgID0gZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgPyAncycgOiAnZic7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC51aWQgPSBgJHtwcmVmaXh9LSR7KytiLl91aWRfY291bnRlcn0tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDcgKX1gO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdW1wIFwiZm9vXCIsIFwiZm9vLTJcIiwgXCJmb28tM1wiLCAuLi5cclxuXHRcdCAqL1xyXG5cdFx0X21ha2VfdW5pcXVlKGJhc2UsIHRha2VuKSB7XHJcblx0XHRcdGNvbnN0IHMgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cdFx0XHRsZXQgdiAgID0gU3RyaW5nKCBiYXNlIHx8ICcnICk7XHJcblx0XHRcdGlmICggIXYgKSB2ID0gJ2ZpZWxkJztcclxuXHRcdFx0Y29uc3QgbSAgPSB2Lm1hdGNoKCAvLShcXGQrKSQvICk7XHJcblx0XHRcdGxldCBuICAgID0gbSA/IChwYXJzZUludCggbVsxXSwgMTAgKSB8fCAxKSA6IDE7XHJcblx0XHRcdGxldCBzdGVtID0gbSA/IHYucmVwbGFjZSggLy1cXGQrJC8sICcnICkgOiB2O1xyXG5cdFx0XHR3aGlsZSAoIHRha2VuLmhhcyggdiApICkge1xyXG5cdFx0XHRcdG4gPSBNYXRoLm1heCggMiwgbiArIDEgKTtcclxuXHRcdFx0XHR2ID0gYCR7c3RlbX0tJHtufWA7XHJcblx0XHRcdH1cclxuXHRcdFx0dGFrZW4uYWRkKCB2ICk7XHJcblx0XHRcdHJldHVybiB2O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3RyaWN0LCBvbmUtcGFzcyBkZS1kdXBsaWNhdGlvbiBmb3IgYSBuZXdseS1pbnNlcnRlZCBzdWJ0cmVlLlxyXG5cdFx0ICogLSBFbnN1cmVzIHVuaXF1ZSBkYXRhLWlkIChpbnRlcm5hbCksIGRhdGEtbmFtZSAoZmllbGRzKSwgZGF0YS1odG1sX2lkIChwdWJsaWMpXHJcblx0XHQgKiAtIEFsc28gdXBkYXRlcyBET006IDxzZWN0aW9uIGlkPiwgPGlucHV0IGlkPiwgPGxhYmVsIGZvcj4sIGFuZCBpbnB1dFtuYW1lXS5cclxuXHRcdCAqL1xyXG5cdFx0X2RlZHVwZV9zdWJ0cmVlX3N0cmljdChyb290KSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGNvbnN0IHMgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cdFx0XHRpZiAoICFyb290IHx8ICFiPy5wYWdlc19jb250YWluZXIgKSByZXR1cm47XHJcblxyXG5cdFx0XHQvLyAxKSBCdWlsZCBcInRha2VuXCIgc2V0cyBmcm9tIG91dHNpZGUgdGhlIHN1YnRyZWUuXHJcblx0XHRcdGNvbnN0IHRha2VuRGF0YUlkICAgPSBuZXcgU2V0KCk7XHJcblx0XHRcdGNvbnN0IHRha2VuRGF0YU5hbWUgPSBuZXcgU2V0KCk7XHJcblx0XHRcdGNvbnN0IHRha2VuSHRtbElkICAgPSBuZXcgU2V0KCk7XHJcblx0XHRcdGNvbnN0IHRha2VuRG9tSWQgICAgPSBuZXcgU2V0KCk7XHJcblxyXG5cdFx0XHQvLyBBbGwgZmllbGRzL3NlY3Rpb25zIG91dHNpZGUgcm9vdFxyXG5cdFx0XHRiLnBhZ2VzX2NvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19maWVsZCwgLndwYmNfYmZiX19zZWN0aW9uJyApLmZvckVhY2goIGVsID0+IHtcclxuXHRcdFx0XHRpZiAoIHJvb3QuY29udGFpbnMoIGVsICkgKSByZXR1cm47XHJcblx0XHRcdFx0Y29uc3QgZGlkICA9IGVsLmdldEF0dHJpYnV0ZSggJ2RhdGEtaWQnICk7XHJcblx0XHRcdFx0Y29uc3QgZG5hbSA9IGVsLmdldEF0dHJpYnV0ZSggJ2RhdGEtbmFtZScgKTtcclxuXHRcdFx0XHRjb25zdCBoaWQgID0gZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1odG1sX2lkJyApO1xyXG5cdFx0XHRcdGlmICggZGlkICkgdGFrZW5EYXRhSWQuYWRkKCBkaWQgKTtcclxuXHRcdFx0XHRpZiAoIGRuYW0gKSB0YWtlbkRhdGFOYW1lLmFkZCggZG5hbSApO1xyXG5cdFx0XHRcdGlmICggaGlkICkgdGFrZW5IdG1sSWQuYWRkKCBoaWQgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQWxsIERPTSBpZHMgb3V0c2lkZSByb290IChsYWJlbHMsIGlucHV0cywgYW55dGhpbmcpXHJcblx0XHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbaWRdJyApLmZvckVhY2goIGVsID0+IHtcclxuXHRcdFx0XHRpZiAoIHJvb3QuY29udGFpbnMoIGVsICkgKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCBlbC5pZCApIHRha2VuRG9tSWQuYWRkKCBlbC5pZCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRjb25zdCBub2RlcyA9IFtdO1xyXG5cdFx0XHRpZiAoIHJvb3QuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApIHx8IHJvb3QuY2xhc3NMaXN0Py5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSApIHtcclxuXHRcdFx0XHRub2Rlcy5wdXNoKCByb290ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0bm9kZXMucHVzaCggLi4ucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19zZWN0aW9uLCAud3BiY19iZmJfX2ZpZWxkJyApICk7XHJcblxyXG5cdFx0XHQvLyAyKSBXYWxrIHRoZSBzdWJ0cmVlIGFuZCBmaXggY29sbGlzaW9ucyBkZXRlcm1pbmlzdGljYWxseS5cclxuXHRcdFx0bm9kZXMuZm9yRWFjaCggZWwgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGlzRmllbGQgICA9IGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKTtcclxuXHRcdFx0XHRjb25zdCBpc1NlY3Rpb24gPSBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKTtcclxuXHJcblx0XHRcdFx0Ly8gSU5URVJOQUwgZGF0YS1pZFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGNvbnN0IHJhdyAgPSBlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWlkJyApIHx8ICcnO1xyXG5cdFx0XHRcdFx0Y29uc3QgYmFzZSA9IHMuc2FuaXRpemVfaHRtbF9pZCggcmF3ICkgfHwgKGlzU2VjdGlvbiA/ICdzZWN0aW9uJyA6ICdmaWVsZCcpO1xyXG5cdFx0XHRcdFx0Y29uc3QgdW5pcSA9IHRoaXMuX21ha2VfdW5pcXVlKCBiYXNlLCB0YWtlbkRhdGFJZCApO1xyXG5cdFx0XHRcdFx0aWYgKCB1bmlxICE9PSByYXcgKSBlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWlkJywgdW5pcSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gSFRNTCBuYW1lIChmaWVsZHMgb25seSlcclxuXHRcdFx0XHRpZiAoIGlzRmllbGQgKSB7XHJcblx0XHRcdFx0XHRjb25zdCByYXcgPSBlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLW5hbWUnICkgfHwgJyc7XHJcblx0XHRcdFx0XHRpZiAoIHJhdyApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgYmFzZSA9IHMuc2FuaXRpemVfaHRtbF9uYW1lKCByYXcgKTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgdW5pcSA9IHRoaXMuX21ha2VfdW5pcXVlKCBiYXNlLCB0YWtlbkRhdGFOYW1lICk7XHJcblx0XHRcdFx0XHRcdGlmICggdW5pcSAhPT0gcmF3ICkge1xyXG5cdFx0XHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtbmFtZScsIHVuaXEgKTtcclxuXHRcdFx0XHRcdFx0XHQvLyBVcGRhdGUgaW5uZXIgY29udHJvbCBpbW1lZGlhdGVseVxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGlucHV0ID0gZWwucXVlcnlTZWxlY3RvciggJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0JyApO1xyXG5cdFx0XHRcdFx0XHRcdGlmICggaW5wdXQgKSBpbnB1dC5zZXRBdHRyaWJ1dGUoICduYW1lJywgdW5pcSApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBQdWJsaWMgSFRNTCBpZCAoZmllbGRzICsgc2VjdGlvbnMpXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0Y29uc3QgcmF3ID0gZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS1odG1sX2lkJyApIHx8ICcnO1xyXG5cdFx0XHRcdFx0aWYgKCByYXcgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGJhc2UgICAgICAgICAgPSBzLnNhbml0aXplX2h0bWxfaWQoIHJhdyApO1xyXG5cdFx0XHRcdFx0XHQvLyBSZXNlcnZlIGFnYWluc3QgQk9USCBrbm93biBkYXRhLWh0bWxfaWQgYW5kIHJlYWwgRE9NIGlkcy5cclxuXHRcdFx0XHRcdFx0Y29uc3QgY29tYmluZWRUYWtlbiA9IG5ldyBTZXQoIFsgLi4udGFrZW5IdG1sSWQsIC4uLnRha2VuRG9tSWQgXSApO1xyXG5cdFx0XHRcdFx0XHRsZXQgY2FuZGlkYXRlICAgICAgID0gdGhpcy5fbWFrZV91bmlxdWUoIGJhc2UsIGNvbWJpbmVkVGFrZW4gKTtcclxuXHRcdFx0XHRcdFx0Ly8gUmVjb3JkIGludG8gdGhlIHJlYWwgc2V0cyBzbyBmdXR1cmUgY2hlY2tzIHNlZSB0aGUgcmVzZXJ2YXRpb24uXHJcblx0XHRcdFx0XHRcdHRha2VuSHRtbElkLmFkZCggY2FuZGlkYXRlICk7XHJcblx0XHRcdFx0XHRcdHRha2VuRG9tSWQuYWRkKCBjYW5kaWRhdGUgKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggY2FuZGlkYXRlICE9PSByYXcgKSBlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWh0bWxfaWQnLCBjYW5kaWRhdGUgKTtcclxuXHJcblx0XHRcdFx0XHRcdC8vIFJlZmxlY3QgdG8gRE9NIGltbWVkaWF0ZWx5XHJcblx0XHRcdFx0XHRcdGlmICggaXNTZWN0aW9uICkge1xyXG5cdFx0XHRcdFx0XHRcdGVsLmlkID0gY2FuZGlkYXRlIHx8ICcnO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGlucHV0ID0gZWwucXVlcnlTZWxlY3RvciggJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0JyApO1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gZWwucXVlcnlTZWxlY3RvciggJ2xhYmVsLndwYmNfYmZiX19maWVsZC1sYWJlbCcgKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIGlucHV0ICkgaW5wdXQuaWQgPSBjYW5kaWRhdGUgfHwgJyc7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBsYWJlbCApIGxhYmVsLmh0bWxGb3IgPSBjYW5kaWRhdGUgfHwgJyc7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIGlzU2VjdGlvbiApIHtcclxuXHRcdFx0XHRcdFx0Ly8gRW5zdXJlIG5vIHN0YWxlIERPTSBpZCBpZiBkYXRhLWh0bWxfaWQgd2FzIGNsZWFyZWRcclxuXHRcdFx0XHRcdFx0ZWwucmVtb3ZlQXR0cmlidXRlKCAnaWQnICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0X21ha2VfYWRkX2NvbHVtbnNfY29udHJvbChwYWdlX2VsLCBzZWN0aW9uX2NvbnRhaW5lciwgaW5zZXJ0X3BvcyA9ICdib3R0b20nKSB7XHJcblxyXG5cdFx0XHQvLyBBY2NlcHQgaW5zZXJ0X3BvcyAoJ3RvcCd8J2JvdHRvbScpLCBkZWZhdWx0ICdib3R0b20nLlxyXG5cclxuXHRcdFx0Y29uc3QgdHBsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fYWRkX2NvbHVtbnNfdGVtcGxhdGUnICk7XHJcblx0XHRcdGlmICggIXRwbCApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gQ2xvbmUgKmNvbnRlbnRzKiAobm90IHRoZSBpZCksIHVuaGlkZSwgYW5kIGFkZCBhIHBhZ2Utc2NvcGVkIGNsYXNzLlxyXG5cdFx0XHRjb25zdCBzcmMgPSAodHBsLmNvbnRlbnQgJiYgdHBsLmNvbnRlbnQuZmlyc3RFbGVtZW50Q2hpbGQpID8gdHBsLmNvbnRlbnQuZmlyc3RFbGVtZW50Q2hpbGQgOiB0cGwuZmlyc3RFbGVtZW50Q2hpbGQ7XHJcblx0XHRcdGlmICggIXNyYyApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgY2xvbmUgPSBzcmMuY2xvbmVOb2RlKCB0cnVlICk7XHJcblx0XHRcdGNsb25lLnJlbW92ZUF0dHJpYnV0ZSggJ2hpZGRlbicgKTtcclxuXHRcdFx0aWYgKCBjbG9uZS5pZCApIHtcclxuXHRcdFx0XHRjbG9uZS5yZW1vdmVBdHRyaWJ1dGUoICdpZCcgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjbG9uZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2lkXScgKS5mb3JFYWNoKCBuID0+IG4ucmVtb3ZlQXR0cmlidXRlKCAnaWQnICkgKTtcclxuXHJcblx0XHRcdC8vIE1hcmsgd2hlcmUgdGhpcyBjb250cm9sIGluc2VydHMgc2VjdGlvbnMuXHJcblx0XHRcdGNsb25lLmRhdGFzZXQuaW5zZXJ0ID0gaW5zZXJ0X3BvczsgLy8gJ3RvcCcgfCAnYm90dG9tJ1xyXG5cclxuXHRcdFx0Ly8gLy8gT3B0aW9uYWwgVUkgaGludCBmb3IgdXNlcnMgKGtlZXBzIGV4aXN0aW5nIG1hcmt1cCBpbnRhY3QpLlxyXG5cdFx0XHQvLyBjb25zdCBoaW50ID0gY2xvbmUucXVlcnlTZWxlY3RvciggJy5uYXYtdGFiLXRleHQgLnNlbGVjdGVkX3ZhbHVlJyApO1xyXG5cdFx0XHQvLyBpZiAoIGhpbnQgKSB7XHJcblx0XHRcdC8vIFx0aGludC50ZXh0Q29udGVudCA9IChpbnNlcnRfcG9zID09PSAndG9wJykgPyAnIChhZGQgYXQgdG9wKScgOiAnIChhZGQgYXQgYm90dG9tKSc7XHJcblx0XHRcdC8vIH1cclxuXHJcblx0XHRcdC8vIENsaWNrIG9uIG9wdGlvbnMgLSBhZGQgc2VjdGlvbiB3aXRoIE4gY29sdW1ucy5cclxuXHRcdFx0Y2xvbmUuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgKGUpID0+IHtcclxuXHRcdFx0XHRjb25zdCBhID0gZS50YXJnZXQuY2xvc2VzdCggJy51bF9kcm9wZG93bl9tZW51X2xpX2FjdGlvbl9hZGRfc2VjdGlvbnMnICk7XHJcblx0XHRcdFx0aWYgKCAhYSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0XHQvLyBSZWFkIE4gZWl0aGVyIGZyb20gZGF0YS1jb2xzIG9yIGZhbGxiYWNrIHRvIHBhcnNpbmcgdGV4dCBsaWtlIFwiMyBDb2x1bW5zXCIuXHJcblx0XHRcdFx0bGV0IGNvbHMgPSBwYXJzZUludCggYS5kYXRhc2V0LmNvbHMgfHwgKGEudGV4dENvbnRlbnQubWF0Y2goIC9cXGIoXFxkKylcXHMqQ29sdW1uL2kgKT8uWzFdID8/ICcxJyksIDEwICk7XHJcblx0XHRcdFx0Y29scyAgICAgPSBNYXRoLm1heCggMSwgTWF0aC5taW4oIDQsIGNvbHMgKSApO1xyXG5cclxuXHRcdFx0XHQvLyBORVc6IGhvbm9yIHRoZSBjb250cm9sJ3MgaW5zZXJ0aW9uIHBvc2l0aW9uXHJcblx0XHRcdFx0dGhpcy5hZGRfc2VjdGlvbiggc2VjdGlvbl9jb250YWluZXIsIGNvbHMsIGluc2VydF9wb3MgKTtcclxuXHJcblx0XHRcdFx0Ly8gUmVmbGVjdCBsYXN0IGNob2ljZSAodW5jaGFuZ2VkKVxyXG5cdFx0XHRcdGNvbnN0IHZhbCA9IGNsb25lLnF1ZXJ5U2VsZWN0b3IoICcuc2VsZWN0ZWRfdmFsdWUnICk7XHJcblx0XHRcdFx0aWYgKCB2YWwgKSB7XHJcblx0XHRcdFx0XHR2YWwudGV4dENvbnRlbnQgPSBgICgke2NvbHN9KWA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gY2xvbmU7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge3tzY3JvbGw/OiBib29sZWFufX0gW29wdHMgPSB7fV1cclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH1cclxuXHRcdCAqL1xyXG5cdFx0YWRkX3BhZ2UoeyBzY3JvbGwgPSB0cnVlIH0gPSB7fSkge1xyXG5cdFx0XHRjb25zdCBiICAgICAgID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRjb25zdCBwYWdlX2VsID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX3BhbmVsIHdwYmNfYmZiX19wYW5lbC0tcHJldmlldyAgd3BiY19iZmJfZm9ybSB3cGJjX2NvbnRhaW5lciB3cGJjX2Zvcm0gd3BiY19jb250YWluZXJfYm9va2luZ19mb3JtJyApO1xyXG5cdFx0XHRwYWdlX2VsLnNldEF0dHJpYnV0ZSggJ2RhdGEtcGFnZScsICsrYi5wYWdlX2NvdW50ZXIgKTtcclxuXHJcblx0XHRcdC8vIFwiUGFnZSAxIHwgWFwiIC0gUmVuZGVyIHBhZ2UgVGl0bGUgd2l0aCBSZW1vdmUgWCBidXR0b24uXHJcblx0XHRcdGNvbnN0IGNvbnRyb2xzX2h0bWwgPSBVSS5yZW5kZXJfd3BfdGVtcGxhdGUoICd3cGJjLWJmYi10cGwtcGFnZS1yZW1vdmUnLCB7IHBhZ2VfbnVtYmVyOiBiLnBhZ2VfY291bnRlciB9ICk7XHJcblx0XHRcdHBhZ2VfZWwuaW5uZXJIVE1MICAgPSBjb250cm9sc19odG1sICsgJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyIHdwYmNfd2l6YXJkX19ib3JkZXJfY29udGFpbmVyXCI+PC9kaXY+JztcclxuXHJcblx0XHRcdGIucGFnZXNfY29udGFpbmVyLmFwcGVuZENoaWxkKCBwYWdlX2VsICk7XHJcblx0XHRcdGlmICggc2Nyb2xsICkge1xyXG5cdFx0XHRcdHBhZ2VfZWwuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ3N0YXJ0JyB9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHNlY3Rpb25fY29udGFpbmVyICAgICAgICAgPSBwYWdlX2VsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcicgKTtcclxuXHRcdFx0Y29uc3Qgc2VjdGlvbl9jb3VudF9vbl9hZGRfcGFnZSA9IDI7XHJcblx0XHRcdHRoaXMuaW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBzZWN0aW9uX2NvbnRhaW5lciApO1xyXG5cdFx0XHR0aGlzLmFkZF9zZWN0aW9uKCBzZWN0aW9uX2NvbnRhaW5lciwgc2VjdGlvbl9jb3VudF9vbl9hZGRfcGFnZSApO1xyXG5cclxuXHRcdFx0Ly8gRHJvcGRvd24gY29udHJvbCBjbG9uZWQgZnJvbSB0aGUgaGlkZGVuIHRlbXBsYXRlLlxyXG5cdFx0XHRjb25zdCBjb250cm9sc19ob3N0X3RvcCA9IHBhZ2VfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fY29udHJvbHMnICk7XHJcblx0XHRcdGNvbnN0IGN0cmxfdG9wICAgICAgICAgID0gdGhpcy5fbWFrZV9hZGRfY29sdW1uc19jb250cm9sKCBwYWdlX2VsLCBzZWN0aW9uX2NvbnRhaW5lciwgJ3RvcCcgKTtcclxuXHRcdFx0aWYgKCBjdHJsX3RvcCApIHtcclxuXHRcdFx0XHRjb250cm9sc19ob3N0X3RvcC5hcHBlbmRDaGlsZCggY3RybF90b3AgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBCb3R0b20gY29udHJvbCBiYXIgYWZ0ZXIgdGhlIHNlY3Rpb24gY29udGFpbmVyLlxyXG5cdFx0XHRjb25zdCBjb250cm9sc19ob3N0X2JvdHRvbSA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19jb250cm9scyB3cGJjX2JmYl9fY29udHJvbHMtLWJvdHRvbScgKTtcclxuXHRcdFx0c2VjdGlvbl9jb250YWluZXIuYWZ0ZXIoIGNvbnRyb2xzX2hvc3RfYm90dG9tICk7XHJcblx0XHRcdGNvbnN0IGN0cmxfYm90dG9tID0gdGhpcy5fbWFrZV9hZGRfY29sdW1uc19jb250cm9sKCBwYWdlX2VsLCBzZWN0aW9uX2NvbnRhaW5lciwgJ2JvdHRvbScgKTtcclxuXHRcdFx0aWYgKCBjdHJsX2JvdHRvbSApIHtcclxuXHRcdFx0XHRjb250cm9sc19ob3N0X2JvdHRvbS5hcHBlbmRDaGlsZCggY3RybF9ib3R0b20gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHBhZ2VfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjb250YWluZXJcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSAgICAgIGNvbHNcclxuXHRcdCAqIEBwYXJhbSB7J3RvcCd8J2JvdHRvbSd9IFtpbnNlcnRfcG9zPSdib3R0b20nXSAgLy8gTkVXXHJcblx0XHQgKi9cclxuXHRcdGFkZF9zZWN0aW9uKGNvbnRhaW5lciwgY29scywgaW5zZXJ0X3BvcyA9ICdib3R0b20nKSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGNvbHMgICAgPSBNYXRoLm1heCggMSwgcGFyc2VJbnQoIGNvbHMsIDEwICkgfHwgMSApO1xyXG5cclxuXHRcdFx0Y29uc3Qgc2VjdGlvbiA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19zZWN0aW9uJyApO1xyXG5cdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtaWQnLCBgc2VjdGlvbi0keysrYi5zZWN0aW9uX2NvdW50ZXJ9LSR7RGF0ZS5ub3coKX1gICk7XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS11aWQnLCBgcy0keysrYi5fdWlkX2NvdW50ZXJ9LSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCA3ICl9YCApO1xyXG5cdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtdHlwZScsICdzZWN0aW9uJyApO1xyXG5cdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtbGFiZWwnLCAnU2VjdGlvbicgKTtcclxuXHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICdkYXRhLWNvbHVtbnMnLCBTdHJpbmcoIGNvbHMgKSApO1xyXG5cdFx0XHQvLyBEbyBub3QgcGVyc2lzdCBvciBzZWVkIHBlci1jb2x1bW4gc3R5bGVzIGJ5IGRlZmF1bHQgKG9wdC1pbiB2aWEgaW5zcGVjdG9yKS5cclxuXHJcblx0XHRcdGNvbnN0IHJvdyA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19yb3cgd3BiY19fcm93JyApO1xyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBjb2xzOyBpKysgKSB7XHJcblx0XHRcdFx0Y29uc3QgY29sICAgICAgICAgICA9IENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmNyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19jb2x1bW4gd3BiY19fZmllbGQnICk7XHJcblx0XHRcdFx0Y29sLnN0eWxlLmZsZXhCYXNpcyA9ICgxMDAgLyBjb2xzKSArICclJztcclxuXHRcdFx0XHQvLyBObyBkZWZhdWx0IENTUyB2YXJzIGhlcmU7IHJlYWwgY29sdW1ucyByZW1haW4gdW5hZmZlY3RlZCB1bnRpbCB1c2VyIGFjdGl2YXRlcyBzdHlsZXMuXHJcblx0XHRcdFx0Yi5pbml0X3NvcnRhYmxlPy4oIGNvbCApO1xyXG5cdFx0XHRcdHJvdy5hcHBlbmRDaGlsZCggY29sICk7XHJcblx0XHRcdFx0aWYgKCBpIDwgY29scyAtIDEgKSB7XHJcblx0XHRcdFx0XHRjb25zdCByZXNpemVyID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX2NvbHVtbi1yZXNpemVyJyApO1xyXG5cdFx0XHRcdFx0cmVzaXplci5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vkb3duJywgYi5pbml0X3Jlc2l6ZV9oYW5kbGVyICk7XHJcblx0XHRcdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIHJlc2l6ZXIgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0c2VjdGlvbi5hcHBlbmRDaGlsZCggcm93ICk7XHJcblx0XHRcdGIubGF5b3V0LnNldF9lcXVhbF9iYXNlcyggcm93LCBiLmNvbF9nYXBfcGVyY2VudCApO1xyXG5cdFx0XHRiLmFkZF9vdmVybGF5X3Rvb2xiYXIoIHNlY3Rpb24gKTtcclxuXHRcdFx0c2VjdGlvbi5zZXRBdHRyaWJ1dGUoICd0YWJpbmRleCcsICcwJyApO1xyXG5cdFx0XHR0aGlzLmluaXRfYWxsX25lc3RlZF9zb3J0YWJsZXMoIHNlY3Rpb24gKTtcclxuXHJcblx0XHRcdC8vIEluc2VydGlvbiBwb2xpY3k6IHRvcCB8IGJvdHRvbS5cclxuXHRcdFx0aWYgKCBpbnNlcnRfcG9zID09PSAndG9wJyAmJiBjb250YWluZXIuZmlyc3RFbGVtZW50Q2hpbGQgKSB7XHJcblx0XHRcdFx0Y29udGFpbmVyLmluc2VydEJlZm9yZSggc2VjdGlvbiwgY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKCBzZWN0aW9uICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzZWN0aW9uX2RhdGFcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGNvbnRhaW5lclxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fSBUaGUgcmVidWlsdCBzZWN0aW9uIGVsZW1lbnQuXHJcblx0XHQgKi9cclxuXHRcdHJlYnVpbGRfc2VjdGlvbihzZWN0aW9uX2RhdGEsIGNvbnRhaW5lcikge1xyXG5cdFx0XHRjb25zdCBiICAgICAgICAgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGNvbnN0IGNvbHNfZGF0YSA9IEFycmF5LmlzQXJyYXkoIHNlY3Rpb25fZGF0YT8uY29sdW1ucyApID8gc2VjdGlvbl9kYXRhLmNvbHVtbnMgOiBbXTtcclxuXHRcdFx0dGhpcy5hZGRfc2VjdGlvbiggY29udGFpbmVyLCBjb2xzX2RhdGEubGVuZ3RoIHx8IDEgKTtcclxuXHRcdFx0Y29uc3Qgc2VjdGlvbiA9IGNvbnRhaW5lci5sYXN0RWxlbWVudENoaWxkO1xyXG5cdFx0XHRpZiAoICFzZWN0aW9uLmRhdGFzZXQudWlkICkge1xyXG5cdFx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS11aWQnLCBgcy0keysrYi5fdWlkX2NvdW50ZXJ9LSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCA3ICl9YCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1pZCcsIHNlY3Rpb25fZGF0YT8uaWQgfHwgYHNlY3Rpb24tJHsrK2Iuc2VjdGlvbl9jb3VudGVyfS0ke0RhdGUubm93KCl9YCApO1xyXG5cdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtdHlwZScsICdzZWN0aW9uJyApO1xyXG5cdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtbGFiZWwnLCBzZWN0aW9uX2RhdGE/LmxhYmVsIHx8ICdTZWN0aW9uJyApO1xyXG5cdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtY29sdW1ucycsIFN0cmluZyggKHNlY3Rpb25fZGF0YT8uY29sdW1ucyB8fCBbXSkubGVuZ3RoIHx8IDEgKSApO1xyXG5cdFx0XHQvLyBQZXJzaXN0ZWQgYXR0cmlidXRlc1xyXG5cdFx0XHRpZiAoIHNlY3Rpb25fZGF0YT8uaHRtbF9pZCApIHtcclxuXHRcdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtaHRtbF9pZCcsIFN0cmluZyggc2VjdGlvbl9kYXRhLmh0bWxfaWQgKSApO1xyXG5cdFx0XHRcdC8vIGdpdmUgdGhlIGNvbnRhaW5lciBhIHJlYWwgaWQgc28gYW5jaG9ycy9DU1MgY2FuIHRhcmdldCBpdFxyXG5cdFx0XHRcdHNlY3Rpb24uaWQgPSBTdHJpbmcoIHNlY3Rpb25fZGF0YS5odG1sX2lkICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE5FVzogcmVzdG9yZSBwZXJzaXN0ZWQgcGVyLWNvbHVtbiBzdHlsZXMgKHJhdyBKU09OIHN0cmluZykuXHJcblx0XHRcdGlmICggc2VjdGlvbl9kYXRhPy5jb2xfc3R5bGVzICE9IG51bGwgKSB7XHJcblx0XHRcdFx0Y29uc3QganNvbiA9IFN0cmluZyggc2VjdGlvbl9kYXRhLmNvbF9zdHlsZXMgKTtcclxuXHRcdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtY29sX3N0eWxlcycsIGpzb24gKTtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0c2VjdGlvbi5kYXRhc2V0LmNvbF9zdHlsZXMgPSBqc29uO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gKE5vIHJlbmRlcl9wcmV2aWV3KCkgY2FsbCBoZXJlIG9uIHB1cnBvc2U6IHNlY3Rpb25z4oCZIGJ1aWxkZXIgRE9NIHVzZXMgLndwYmNfYmZiX19yb3cvLndwYmNfYmZiX19jb2x1bW4uKVxyXG5cclxuXHJcblx0XHRcdGlmICggc2VjdGlvbl9kYXRhPy5jc3NjbGFzcyApIHtcclxuXHRcdFx0XHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtY3NzY2xhc3MnLCBTdHJpbmcoIHNlY3Rpb25fZGF0YS5jc3NjbGFzcyApICk7XHJcblx0XHRcdFx0Ly8ga2VlcCBjb3JlIGNsYXNzZXMsIHRoZW4gYWRkIGN1c3RvbSBjbGFzcyhlcylcclxuXHRcdFx0XHRTdHJpbmcoIHNlY3Rpb25fZGF0YS5jc3NjbGFzcyApLnNwbGl0KCAvXFxzKy8gKS5maWx0ZXIoIEJvb2xlYW4gKS5mb3JFYWNoKCBjbHMgPT4gc2VjdGlvbi5jbGFzc0xpc3QuYWRkKCBjbHMgKSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCByb3cgPSBzZWN0aW9uLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3JvdycgKTtcclxuXHRcdFx0Ly8gRGVsZWdhdGUgcGFyc2luZyArIGFjdGl2YXRpb24gKyBhcHBsaWNhdGlvbiB0byB0aGUgQ29sdW1uIFN0eWxlcyBzZXJ2aWNlLlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IGpzb24gPSBzZWN0aW9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29sX3N0eWxlcycgKVxyXG5cdFx0XHRcdFx0fHwgKHNlY3Rpb24uZGF0YXNldCA/IChzZWN0aW9uLmRhdGFzZXQuY29sX3N0eWxlcyB8fCAnJykgOiAnJyk7XHJcblx0XHRcdFx0Y29uc3QgYXJyICA9IFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMucGFyc2VfY29sX3N0eWxlcygganNvbiApO1xyXG5cdFx0XHRcdFVJLldQQkNfQkZCX0NvbHVtbl9TdHlsZXMuYXBwbHkoIHNlY3Rpb24sIGFyciApO1xyXG5cdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbHNfZGF0YS5mb3JFYWNoKCAoY29sX2RhdGEsIGluZGV4KSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgY29sdW1uc19vbmx5ICA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICk7XHJcblx0XHRcdFx0Y29uc3QgY29sICAgICAgICAgICA9IGNvbHVtbnNfb25seVtpbmRleF07XHJcblx0XHRcdFx0Y29sLnN0eWxlLmZsZXhCYXNpcyA9IGNvbF9kYXRhLndpZHRoIHx8ICcxMDAlJztcclxuXHRcdFx0XHQoY29sX2RhdGEuaXRlbXMgfHwgW10pLmZvckVhY2goIChpdGVtKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoICFpdGVtIHx8ICFpdGVtLnR5cGUgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggaXRlbS50eXBlID09PSAnZmllbGQnICkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBlbCA9IGIuYnVpbGRfZmllbGQoIGl0ZW0uZGF0YSApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIGVsICkge1xyXG5cdFx0XHRcdFx0XHRcdGNvbC5hcHBlbmRDaGlsZCggZWwgKTtcclxuXHRcdFx0XHRcdFx0XHRiLnRyaWdnZXJfZmllbGRfZHJvcF9jYWxsYmFjayggZWwsICdsb2FkJyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggaXRlbS50eXBlID09PSAnc2VjdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVidWlsZF9zZWN0aW9uKCBpdGVtLmRhdGEsIGNvbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRjb25zdCBjb21wdXRlZCA9IGIubGF5b3V0LmNvbXB1dGVfZWZmZWN0aXZlX2Jhc2VzX2Zyb21fcm93KCByb3csIGIuY29sX2dhcF9wZXJjZW50ICk7XHJcblx0XHRcdGIubGF5b3V0LmFwcGx5X2Jhc2VzX3RvX3Jvdyggcm93LCBjb21wdXRlZC5iYXNlcyApO1xyXG5cdFx0XHR0aGlzLmluaXRfYWxsX25lc3RlZF9zb3J0YWJsZXMoIHNlY3Rpb24gKTtcclxuXHJcblx0XHRcdC8vIE5FVzogcmV0YWcgVUlEcyBmaXJzdCAoc28gdW5pcXVlbmVzcyBjaGVja3MgZG9uJ3QgZXhjbHVkZSBvcmlnaW5hbHMpLCB0aGVuIGRlZHVwZSBhbGwga2V5cy5cclxuXHRcdFx0dGhpcy5fcmV0YWdfdWlkc19pbl9zdWJ0cmVlKCBzZWN0aW9uICk7XHJcblx0XHRcdHRoaXMuX2RlZHVwZV9zdWJ0cmVlX3N0cmljdCggc2VjdGlvbiApO1xyXG5cdFx0XHRyZXR1cm4gc2VjdGlvbjtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyICovXHJcblx0XHRpbml0X2FsbF9uZXN0ZWRfc29ydGFibGVzKGNvbnRhaW5lcikge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRpZiAoIGNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApICkge1xyXG5cdFx0XHRcdHRoaXMuaW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBjb250YWluZXIgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fc2VjdGlvbicgKS5mb3JFYWNoKCAoc2VjdGlvbikgPT4ge1xyXG5cdFx0XHRcdHNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fY29sdW1uJyApLmZvckVhY2goIChjb2wpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuaW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBjb2wgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHBhcmFtIHtIVE1MRWxlbWVudH0gY29udGFpbmVyICovXHJcblx0XHRpbml0X3NlY3Rpb25fc29ydGFibGUoY29udGFpbmVyKSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGlmICggIWNvbnRhaW5lciApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgaXNfY29sdW1uICAgID0gY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19jb2x1bW4nICk7XHJcblx0XHRcdGNvbnN0IGlzX3RvcF9sZXZlbCA9IGNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cdFx0XHRpZiAoICFpc19jb2x1bW4gJiYgIWlzX3RvcF9sZXZlbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Yi5pbml0X3NvcnRhYmxlPy4oIGNvbnRhaW5lciApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNlcmlhbGl6YXRpb24gYW5kIGRlc2VyaWFsaXphdGlvbiBvZiBwYWdlcy9zZWN0aW9ucy9maWVsZHMuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfU3RydWN0dXJlX0lPID0gY2xhc3MgZXh0ZW5kcyBVSS5XUEJDX0JGQl9Nb2R1bGUge1xuXHRcdGluaXQoKSB7XG5cdFx0XHR0aGlzLmJ1aWxkZXIuZ2V0X3N0cnVjdHVyZSAgICAgICAgPSAoKSA9PiB0aGlzLnNlcmlhbGl6ZSgpO1xuXHRcdFx0dGhpcy5idWlsZGVyLmxvYWRfc2F2ZWRfc3RydWN0dXJlID0gKHMsIG9wdHMpID0+IHRoaXMuZGVzZXJpYWxpemUoIHMsIG9wdHMgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBOb3JtYWxpemUgb3B0aW9uIHZhbHVlcyB3aGVuIGEgZmllbGQgZXhwbGljaXRseSBkaXNhYmxlcyBzZXBhcmF0ZSB2YWx1ZXMuXG5cdFx0ICpcblx0XHQgKiBPbGRlciBCdWlsZGVyIHZlcnNpb25zIHBlcnNpc3RlZCBhbiB1bmNoZWNrZWQgdmFsdWVfZGlmZmVycyB0b2dnbGUgYXMgYW5cblx0XHQgKiBlbXB0eSBzdHJpbmcuIFRyZWF0IHRoYXQgZXhwbGljaXQgbGVnYWN5IHZhbHVlIGFzIGZhbHNlLCB3aGlsZSByZXRhaW5pbmdcblx0XHQgKiB0aGUgc2NoZW1hIGRlZmF1bHQgd2hlbiB0aGUgcHJvcGVydHkgaXMgZ2VudWluZWx5IGFic2VudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZF9kYXRhIFNlcmlhbGl6ZWQgZmllbGQgZGF0YS5cblx0XHQgKiBAcmV0dXJucyB7T2JqZWN0fSBOb3JtYWxpemVkIHNlcmlhbGl6ZWQgZmllbGQgZGF0YS5cblx0XHQgKi9cblx0XHRfbm9ybWFsaXplX2ZpZWxkX29wdGlvbl92YWx1ZXMoZmllbGRfZGF0YSkge1xuXHRcdFx0Y29uc3QgaGFzX3ZhbHVlX2RpZmZlcnMgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGZpZWxkX2RhdGEsICd2YWx1ZV9kaWZmZXJzJyApO1xuXHRcdFx0aWYgKCAhaGFzX3ZhbHVlX2RpZmZlcnMgKSB7XG5cdFx0XHRcdHJldHVybiBmaWVsZF9kYXRhO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB2YWx1ZV9kaWZmZXJzICAgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLmNvZXJjZV9ib29sZWFuKCBmaWVsZF9kYXRhLnZhbHVlX2RpZmZlcnMsIGZhbHNlICk7XG5cdFx0XHRmaWVsZF9kYXRhLnZhbHVlX2RpZmZlcnMgPSB2YWx1ZV9kaWZmZXJzO1xuXG5cdFx0XHRpZiAoICF2YWx1ZV9kaWZmZXJzICYmIEFycmF5LmlzQXJyYXkoIGZpZWxkX2RhdGEub3B0aW9ucyApICkge1xuXHRcdFx0XHRmaWVsZF9kYXRhLm9wdGlvbnMgPSBmaWVsZF9kYXRhLm9wdGlvbnMubWFwKCAoIG9wdGlvbl9yZWNvcmQgKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCAhb3B0aW9uX3JlY29yZCB8fCB0eXBlb2Ygb3B0aW9uX3JlY29yZCAhPT0gJ29iamVjdCcgKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gb3B0aW9uX3JlY29yZDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbihcblx0XHRcdFx0XHRcdHt9LFxuXHRcdFx0XHRcdFx0b3B0aW9uX3JlY29yZCxcblx0XHRcdFx0XHRcdHsgdmFsdWU6IFN0cmluZyggb3B0aW9uX3JlY29yZC5sYWJlbCA9PSBudWxsID8gJycgOiBvcHRpb25fcmVjb3JkLmxhYmVsICkgfVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZpZWxkX2RhdGE7XG5cdFx0fVxuXG5cdFx0LyoqIEByZXR1cm5zIHtBcnJheX0gKi9cblx0XHRzZXJpYWxpemUoKSB7XG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHR0aGlzLl9ub3JtYWxpemVfaWRzKCk7XHJcblx0XHRcdHRoaXMuX25vcm1hbGl6ZV9uYW1lcygpO1xyXG5cdFx0XHRjb25zdCBwYWdlcyA9IFtdO1xyXG5cdFx0XHRiLnBhZ2VzX2NvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19wYW5lbC0tcHJldmlldycgKS5mb3JFYWNoKCAocGFnZV9lbCwgcGFnZV9pbmRleCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IHBhZ2VfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgICA9IFtdO1xyXG5cdFx0XHRcdGlmICggIWNvbnRhaW5lciApIHtcclxuXHRcdFx0XHRcdHBhZ2VzLnB1c2goIHsgcGFnZTogcGFnZV9pbmRleCArIDEsIGNvbnRlbnQgfSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IConICkuZm9yRWFjaCggKGNoaWxkKSA9PiB7XHJcblx0XHRcdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdFx0XHRjb250ZW50LnB1c2goIHsgdHlwZTogJ3NlY3Rpb24nLCBkYXRhOiB0aGlzLnNlcmlhbGl6ZV9zZWN0aW9uKCBjaGlsZCApIH0gKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggY2hpbGQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtaW52YWxpZCcgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0Y29uc3QgZl9kYXRhID0gdGhpcy5fbm9ybWFsaXplX2ZpZWxkX29wdGlvbl92YWx1ZXMoXG5cdFx0XHRcdFx0XHRcdENvcmUuV1BCQ19Gb3JtX0J1aWxkZXJfSGVscGVyLmdldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBjaGlsZCApXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0Ly8gRHJvcCBlcGhlbWVyYWwvZWRpdG9yLW9ubHkgZmxhZ3NcclxuXHRcdFx0XHRcdFx0WyAndWlkJywgJ2ZyZXNoJywgJ2F1dG9uYW1lJywgJ3dhc19sb2FkZWQnLCAnbmFtZV91c2VyX3RvdWNoZWQnIF1cclxuXHRcdFx0XHRcdFx0XHQuZm9yRWFjaCggayA9PiB7XHJcblx0XHRcdFx0XHRcdFx0XHRpZiAoIGsgaW4gZl9kYXRhICkgZGVsZXRlIGZfZGF0YVtrXTtcclxuXHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdGNvbnRlbnQucHVzaCggeyB0eXBlOiAnZmllbGQnLCBkYXRhOiBmX2RhdGEgfSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRwYWdlcy5wdXNoKCB7IHBhZ2U6IHBhZ2VfaW5kZXggKyAxLCBjb250ZW50IH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRyZXR1cm4gcGFnZXM7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBzZWN0aW9uX2VsXHJcblx0XHQgKiBAcmV0dXJucyB7e2lkOnN0cmluZyxsYWJlbDpzdHJpbmcsaHRtbF9pZDpzdHJpbmcsY3NzY2xhc3M6c3RyaW5nLGNvbF9zdHlsZXM6c3RyaW5nLGNvbHVtbnM6QXJyYXl9fVxyXG5cdFx0ICovXHJcblx0XHRzZXJpYWxpemVfc2VjdGlvbihzZWN0aW9uX2VsKSB7XHJcblx0XHRcdGNvbnN0IHJvdyA9IHNlY3Rpb25fZWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cclxuXHRcdFx0Ly8gTkVXOiByZWFkIHBlci1jb2x1bW4gc3R5bGVzIGZyb20gZGF0YXNldC9hdHRyaWJ1dGVzICh1bmRlcnNjb3JlICYgaHlwaGVuKVxyXG5cdFx0XHR2YXIgY29sX3N0eWxlc19yYXcgPVxyXG5cdFx0XHRcdFx0c2VjdGlvbl9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbF9zdHlsZXMnICkgfHxcclxuXHRcdFx0XHRcdChzZWN0aW9uX2VsLmRhdGFzZXQgPyAoc2VjdGlvbl9lbC5kYXRhc2V0LmNvbF9zdHlsZXMpIDogJycpIHx8XHJcblx0XHRcdFx0XHQnJztcclxuXHJcblx0XHRcdGNvbnN0IGJhc2UgPSB7XHJcblx0XHRcdFx0aWQgICAgICAgIDogc2VjdGlvbl9lbC5kYXRhc2V0LmlkLFxyXG5cdFx0XHRcdGxhYmVsICAgICA6IHNlY3Rpb25fZWwuZGF0YXNldC5sYWJlbCB8fCAnJyxcclxuXHRcdFx0XHRodG1sX2lkICAgOiBzZWN0aW9uX2VsLmRhdGFzZXQuaHRtbF9pZCB8fCAnJyxcclxuXHRcdFx0XHRjc3NjbGFzcyAgOiBzZWN0aW9uX2VsLmRhdGFzZXQuY3NzY2xhc3MgfHwgJycsXHJcblx0XHRcdFx0Y29sX3N0eWxlczogU3RyaW5nKCBjb2xfc3R5bGVzX3JhdyApICAgICAgICAvLyA8LS0gTkVXOiBrZWVwIGFzIHJhdyBKU09OIHN0cmluZ1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0aWYgKCAhcm93ICkge1xyXG5cdFx0XHRcdHJldHVybiBPYmplY3QuYXNzaWduKCB7fSwgYmFzZSwgeyBjb2x1bW5zOiBbXSB9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGNvbHVtbnMgPSBbXTtcclxuXHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKS5mb3JFYWNoKCBmdW5jdGlvbiAoY29sKSB7XHJcblx0XHRcdFx0Y29uc3Qgd2lkdGggPSBjb2wuc3R5bGUuZmxleEJhc2lzIHx8ICcxMDAlJztcclxuXHRcdFx0XHRjb25zdCBpdGVtcyA9IFtdO1xyXG5cdFx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGNvbC5jaGlsZHJlbiwgZnVuY3Rpb24gKGNoaWxkKSB7XHJcblx0XHRcdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdFx0XHRpdGVtcy5wdXNoKCB7IHR5cGU6ICdzZWN0aW9uJywgZGF0YTogdGhpcy5zZXJpYWxpemVfc2VjdGlvbiggY2hpbGQgKSB9ICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggY2hpbGQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ2lzLWludmFsaWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGNvbnN0IGZfZGF0YSA9IHRoaXMuX25vcm1hbGl6ZV9maWVsZF9vcHRpb25fdmFsdWVzKFxuXHRcdFx0XHRcdFx0XHRDb3JlLldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggY2hpbGQgKVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdFsgJ3VpZCcsICdmcmVzaCcsICdhdXRvbmFtZScsICd3YXNfbG9hZGVkJywgJ25hbWVfdXNlcl90b3VjaGVkJyBdLmZvckVhY2goIGZ1bmN0aW9uIChrKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBrIGluIGZfZGF0YSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdGRlbGV0ZSBmX2RhdGFba107XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goIHsgdHlwZTogJ2ZpZWxkJywgZGF0YTogZl9kYXRhIH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9LmJpbmQoIHRoaXMgKSApO1xyXG5cdFx0XHRcdGNvbHVtbnMucHVzaCggeyB3aWR0aDogd2lkdGgsIGl0ZW1zOiBpdGVtcyB9ICk7XHJcblx0XHRcdH0uYmluZCggdGhpcyApICk7XHJcblxyXG5cdFx0XHQvLyBDbGFtcCBwZXJzaXN0ZWQgY29sX3N0eWxlcyB0byB0aGUgYWN0dWFsIG51bWJlciBvZiBjb2x1bW5zIG9uIFNhdmUuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Y29uc3QgY29sQ291bnQgPSBjb2x1bW5zLmxlbmd0aDtcclxuXHRcdFx0XHRjb25zdCByYXcgICAgICA9IFN0cmluZyggY29sX3N0eWxlc19yYXcgfHwgJycgKS50cmltKCk7XHJcblxyXG5cdFx0XHRcdGlmICggcmF3ICkge1xyXG5cdFx0XHRcdFx0bGV0IGFyciA9IFtdO1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSggcmF3ICk7XHJcblx0XHRcdFx0XHRcdGFyciAgICAgICAgICA9IEFycmF5LmlzQXJyYXkoIHBhcnNlZCApID8gcGFyc2VkIDogKHBhcnNlZCAmJiBBcnJheS5pc0FycmF5KCBwYXJzZWQuY29sdW1ucyApID8gcGFyc2VkLmNvbHVtbnMgOiBbXSk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0XHRcdGFyciA9IFtdO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggY29sQ291bnQgPD0gMCApIHtcclxuXHRcdFx0XHRcdFx0YmFzZS5jb2xfc3R5bGVzID0gJ1tdJztcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGlmICggYXJyLmxlbmd0aCA+IGNvbENvdW50ICkgYXJyLmxlbmd0aCA9IGNvbENvdW50O1xyXG5cdFx0XHRcdFx0XHR3aGlsZSAoIGFyci5sZW5ndGggPCBjb2xDb3VudCApIGFyci5wdXNoKCB7fSApO1xyXG5cdFx0XHRcdFx0XHRiYXNlLmNvbF9zdHlsZXMgPSBKU09OLnN0cmluZ2lmeSggYXJyICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGJhc2UuY29sX3N0eWxlcyA9ICcnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbigge30sIGJhc2UsIHsgY29sdW1uczogY29sdW1ucyB9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge0FycmF5fSBzdHJ1Y3R1cmVcclxuXHRcdCAqIEBwYXJhbSB7e2RlZmVySWZUeXBpbmc/OiBib29sZWFufX0gW29wdHMgPSB7fV1cclxuXHRcdCAqL1xyXG5cdFx0ZGVzZXJpYWxpemUoc3RydWN0dXJlLCB7IGRlZmVySWZUeXBpbmcgPSB0cnVlIH0gPSB7fSkge1xyXG5cdFx0XHRjb25zdCBiID0gdGhpcy5idWlsZGVyO1xyXG5cdFx0XHRpZiAoIGRlZmVySWZUeXBpbmcgJiYgdGhpcy5faXNfdHlwaW5nX2luX2luc3BlY3RvcigpICkge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCggdGhpcy5fZGVmZXJfdGltZXIgKTtcclxuXHRcdFx0XHR0aGlzLl9kZWZlcl90aW1lciA9IHNldFRpbWVvdXQoICgpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuZGVzZXJpYWxpemUoIHN0cnVjdHVyZSwgeyBkZWZlcklmVHlwaW5nOiBmYWxzZSB9ICk7XHJcblx0XHRcdFx0fSwgMTUwICk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGIucGFnZXNfY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xyXG5cdFx0XHRiLnBhZ2VfY291bnRlciAgICAgICAgICAgICAgPSAwO1xyXG5cdFx0XHQoc3RydWN0dXJlIHx8IFtdKS5mb3JFYWNoKCAocGFnZV9kYXRhKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFnZV9lbCAgICAgICAgICAgICAgID0gYi5wYWdlc19zZWN0aW9ucy5hZGRfcGFnZSggeyBzY3JvbGw6IGZhbHNlIH0gKTtcclxuXHRcdFx0XHRjb25zdCBzZWN0aW9uX2NvbnRhaW5lciAgICAgPSBwYWdlX2VsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcicgKTtcclxuXHRcdFx0XHRzZWN0aW9uX2NvbnRhaW5lci5pbm5lckhUTUwgPSAnJztcclxuXHRcdFx0XHRiLmluaXRfc2VjdGlvbl9zb3J0YWJsZT8uKCBzZWN0aW9uX2NvbnRhaW5lciApO1xyXG5cdFx0XHRcdChwYWdlX2RhdGEuY29udGVudCB8fCBbXSkuZm9yRWFjaCggKGl0ZW0pID0+IHtcclxuXHRcdFx0XHRcdGlmICggaXRlbS50eXBlID09PSAnc2VjdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdC8vIE5vdyByZXR1cm5zIHRoZSBlbGVtZW50OyBhdHRyaWJ1dGVzIChpbmNsLiBjb2xfc3R5bGVzKSBhcmUgYXBwbGllZCBpbnNpZGUgcmVidWlsZC5cclxuXHRcdFx0XHRcdFx0Yi5wYWdlc19zZWN0aW9ucy5yZWJ1aWxkX3NlY3Rpb24oIGl0ZW0uZGF0YSwgc2VjdGlvbl9jb250YWluZXIgKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBpdGVtLnR5cGUgPT09ICdmaWVsZCcgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGVsID0gYi5idWlsZF9maWVsZCggaXRlbS5kYXRhICk7XHJcblx0XHRcdFx0XHRcdGlmICggZWwgKSB7XHJcblx0XHRcdFx0XHRcdFx0c2VjdGlvbl9jb250YWluZXIuYXBwZW5kQ2hpbGQoIGVsICk7XHJcblx0XHRcdFx0XHRcdFx0Yi50cmlnZ2VyX2ZpZWxkX2Ryb3BfY2FsbGJhY2soIGVsLCAnbG9hZCcgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRiLnVzYWdlPy51cGRhdGVfcGFsZXR0ZV91aT8uKCk7XHJcblx0XHRcdGIuYnVzLmVtaXQoIENvcmUuV1BCQ19CRkJfRXZlbnRzLlNUUlVDVFVSRV9MT0FERUQsIHsgc3RydWN0dXJlIH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRfbm9ybWFsaXplX2lkcygpIHtcclxuXHRcdFx0Y29uc3QgYiA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0Yi5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXcgLndwYmNfYmZiX19maWVsZDpub3QoLmlzLWludmFsaWQpJyApLmZvckVhY2goIChlbCkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGRhdGEgPSBDb3JlLldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggZWwgKTtcclxuXHRcdFx0XHRjb25zdCB3YW50ID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZS5zYW5pdGl6ZV9odG1sX2lkKCBkYXRhLmlkIHx8ICcnICkgfHwgJ2ZpZWxkJztcclxuXHRcdFx0XHRjb25zdCB1bmlxID0gYi5pZC5lbnN1cmVfdW5pcXVlX2ZpZWxkX2lkKCB3YW50LCBlbCApO1xyXG5cdFx0XHRcdGlmICggZGF0YS5pZCAhPT0gdW5pcSApIHtcclxuXHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtaWQnLCB1bmlxICk7XHJcblx0XHRcdFx0XHRpZiAoIGIucHJldmlld19tb2RlICkge1xyXG5cdFx0XHRcdFx0XHRiLnJlbmRlcl9wcmV2aWV3KCBlbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9ub3JtYWxpemVfbmFtZXMoKSB7XHJcblx0XHRcdGNvbnN0IGIgPSB0aGlzLmJ1aWxkZXI7XHJcblx0XHRcdGIucGFnZXNfY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGQ6bm90KC5pcy1pbnZhbGlkKScgKS5mb3JFYWNoKCAoZWwpID0+IHtcclxuXHRcdFx0XHRjb25zdCBkYXRhID0gQ29yZS5XUEJDX0Zvcm1fQnVpbGRlcl9IZWxwZXIuZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGVsICk7XHJcblx0XHRcdFx0Y29uc3QgYmFzZSA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaHRtbF9uYW1lKCAoZGF0YS5uYW1lICE9IG51bGwpID8gZGF0YS5uYW1lIDogZGF0YS5pZCApIHx8ICdmaWVsZCc7XHJcblx0XHRcdFx0Y29uc3QgdW5pcSA9IGIuaWQuZW5zdXJlX3VuaXF1ZV9maWVsZF9uYW1lKCBiYXNlLCBlbCApO1xyXG5cdFx0XHRcdGlmICggZGF0YS5uYW1lICE9PSB1bmlxICkge1xyXG5cdFx0XHRcdFx0ZWwuc2V0QXR0cmlidXRlKCAnZGF0YS1uYW1lJywgdW5pcSApO1xyXG5cdFx0XHRcdFx0aWYgKCBiLnByZXZpZXdfbW9kZSApIHtcclxuXHRcdFx0XHRcdFx0Yi5yZW5kZXJfcHJldmlldyggZWwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogQHJldHVybnMge2Jvb2xlYW59ICovXHJcblx0XHRfaXNfdHlwaW5nX2luX2luc3BlY3RvcigpIHtcclxuXHRcdFx0Y29uc3QgaW5zID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yJyApO1xyXG5cdFx0XHRyZXR1cm4gISEoaW5zICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgJiYgaW5zLmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkpO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1pbmltYWwsIHN0YW5kYWxvbmUgZ3VhcmQgdGhhdCBlbmZvcmNlcyBwZXItY29sdW1uIG1pbiB3aWR0aHMgYmFzZWQgb24gZmllbGRzJyBkYXRhLW1pbl93aWR0aC5cclxuXHQgKlxyXG5cdCAqIEB0eXBlIHtVSS5XUEJDX0JGQl9NaW5fV2lkdGhfR3VhcmR9XHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfTWluX1dpZHRoX0d1YXJkID0gY2xhc3MgZXh0ZW5kcyBVSS5XUEJDX0JGQl9Nb2R1bGUge1xyXG5cclxuXHRcdGNvbnN0cnVjdG9yKGJ1aWxkZXIpIHtcclxuXHRcdFx0c3VwZXIoIGJ1aWxkZXIgKTtcclxuXHRcdFx0dGhpcy5fb25fZmllbGRfYWRkICAgICAgICA9IHRoaXMuX29uX2ZpZWxkX2FkZC5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX29uX2ZpZWxkX3JlbW92ZSAgICAgPSB0aGlzLl9vbl9maWVsZF9yZW1vdmUuYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLl9vbl9zdHJ1Y3R1cmVfbG9hZGVkID0gdGhpcy5fb25fc3RydWN0dXJlX2xvYWRlZC5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX29uX3N0cnVjdHVyZV9jaGFuZ2UgPSB0aGlzLl9vbl9zdHJ1Y3R1cmVfY2hhbmdlLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5fb25fd2luZG93X3Jlc2l6ZSAgICA9IHRoaXMuX29uX3dpbmRvd19yZXNpemUuYmluZCggdGhpcyApO1xyXG5cclxuXHRcdFx0dGhpcy5fcGVuZGluZ19yb3dzID0gbmV3IFNldCgpO1xyXG5cdFx0XHR0aGlzLl9wZW5kaW5nX2FsbCAgPSBmYWxzZTtcclxuXHRcdFx0dGhpcy5fcmFmX2lkICAgICAgID0gMDtcclxuXHRcdH1cclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHRjb25zdCBFViA9IENvcmUuV1BCQ19CRkJfRXZlbnRzO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub24/LiggRVYuRklFTERfQURELCB0aGlzLl9vbl9maWVsZF9hZGQgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5idXM/Lm9uPy4oIEVWLkZJRUxEX1JFTU9WRSwgdGhpcy5fb25fZmllbGRfcmVtb3ZlICk7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uYnVzPy5vbj8uKCBFVi5TVFJVQ1RVUkVfTE9BREVELCB0aGlzLl9vbl9zdHJ1Y3R1cmVfbG9hZGVkICk7XHJcblx0XHRcdC8vIFJlZnJlc2ggc2VsZWN0aXZlbHkgb24gc3RydWN0dXJlIGNoYW5nZSAoTk9UIG9uIGV2ZXJ5IHByb3AgaW5wdXQpLlxyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub24/LiggRVYuU1RSVUNUVVJFX0NIQU5HRSwgdGhpcy5fb25fc3RydWN0dXJlX2NoYW5nZSApO1xyXG5cclxuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCB0aGlzLl9vbl93aW5kb3dfcmVzaXplLCB7IHBhc3NpdmU6IHRydWUgfSApO1xyXG5cdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX2FsbCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRlc3Ryb3koKSB7XHJcblx0XHRcdGNvbnN0IEVWID0gQ29yZS5XUEJDX0JGQl9FdmVudHM7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8uYnVzPy5vZmY/LiggRVYuRklFTERfQURELCB0aGlzLl9vbl9maWVsZF9hZGQgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5idXM/Lm9mZj8uKCBFVi5GSUVMRF9SRU1PVkUsIHRoaXMuX29uX2ZpZWxkX3JlbW92ZSApO1xyXG5cdFx0XHR0aGlzLmJ1aWxkZXI/LmJ1cz8ub2ZmPy4oIEVWLlNUUlVDVFVSRV9MT0FERUQsIHRoaXMuX29uX3N0cnVjdHVyZV9sb2FkZWQgKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyPy5idXM/Lm9mZj8uKCBFVi5TVFJVQ1RVUkVfQ0hBTkdFLCB0aGlzLl9vbl9zdHJ1Y3R1cmVfY2hhbmdlICk7XHJcblx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAncmVzaXplJywgdGhpcy5fb25fd2luZG93X3Jlc2l6ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9maWVsZF9hZGQoZSkge1xyXG5cdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX2FsbCgpO1xyXG5cdFx0XHQvLyBpZiB5b3UgcmVhbGx5IHdhbnQgdG8gYmUgbWluaW1hbCB3b3JrIGhlcmUsIGtlZXAgeW91ciByb3ctb25seSB2ZXJzaW9uLlxyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9maWVsZF9yZW1vdmUoZSkge1xyXG5cdFx0XHRjb25zdCBzcmNfZWwgPSBlPy5kZXRhaWw/LmVsIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHJvdyAgICA9IChzcmNfZWwgJiYgc3JjX2VsLmNsb3Nlc3QpID8gc3JjX2VsLmNsb3Nlc3QoICcud3BiY19iZmJfX3JvdycgKSA6IG51bGw7XHJcblx0XHRcdGlmICggcm93ICkge1xyXG5cdFx0XHRcdHRoaXMuX3NjaGVkdWxlX3JlZnJlc2hfcm93KCByb3cgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX2FsbCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X29uX3N0cnVjdHVyZV9sb2FkZWQoKSB7XHJcblx0XHRcdHRoaXMuX3NjaGVkdWxlX3JlZnJlc2hfYWxsKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0X29uX3N0cnVjdHVyZV9jaGFuZ2UoZSkge1xyXG5cdFx0XHRjb25zdCByZWFzb24gPSBlPy5kZXRhaWw/LnJlYXNvbiB8fCAnJztcclxuXHRcdFx0Y29uc3Qga2V5ICAgID0gZT8uZGV0YWlsPy5rZXkgfHwgJyc7XHJcblxyXG5cdFx0XHQvLyBJZ25vcmUgbm9pc3kgcHJvcCBjaGFuZ2VzIHRoYXQgZG9uJ3QgYWZmZWN0IG1pbiB3aWR0aHMuXHJcblx0XHRcdGlmICggcmVhc29uID09PSAncHJvcC1jaGFuZ2UnICYmIGtleSAhPT0gJ21pbl93aWR0aCcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBlbCAgPSBlPy5kZXRhaWw/LmVsIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IHJvdyA9IGVsPy5jbG9zZXN0Py4oICcud3BiY19iZmJfX3JvdycgKSB8fCBudWxsO1xyXG5cdFx0XHRpZiAoIHJvdyApIHtcclxuXHRcdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX3Jvdyggcm93ICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5fc2NoZWR1bGVfcmVmcmVzaF9hbGwoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl93aW5kb3dfcmVzaXplKCkge1xyXG5cdFx0XHR0aGlzLl9zY2hlZHVsZV9yZWZyZXNoX2FsbCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9zY2hlZHVsZV9yZWZyZXNoX3Jvdyhyb3dfZWwpIHtcclxuXHRcdFx0aWYgKCAhcm93X2VsICkgcmV0dXJuO1xyXG5cdFx0XHR0aGlzLl9wZW5kaW5nX3Jvd3MuYWRkKCByb3dfZWwgKTtcclxuXHRcdFx0dGhpcy5fa2lja19yYWYoKTtcclxuXHRcdH1cclxuXHJcblx0XHRfc2NoZWR1bGVfcmVmcmVzaF9hbGwoKSB7XHJcblx0XHRcdHRoaXMuX3BlbmRpbmdfYWxsID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5fcGVuZGluZ19yb3dzLmNsZWFyKCk7XHJcblx0XHRcdHRoaXMuX2tpY2tfcmFmKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0X2tpY2tfcmFmKCkge1xyXG5cdFx0XHRpZiAoIHRoaXMuX3JhZl9pZCApIHJldHVybjtcclxuXHRcdFx0dGhpcy5fcmFmX2lkID0gKHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgc2V0VGltZW91dCkoICgpID0+IHtcclxuXHRcdFx0XHR0aGlzLl9yYWZfaWQgPSAwO1xyXG5cdFx0XHRcdGlmICggdGhpcy5fcGVuZGluZ19hbGwgKSB7XHJcblx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nX2FsbCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0dGhpcy5yZWZyZXNoX2FsbCgpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zdCByb3dzID0gQXJyYXkuZnJvbSggdGhpcy5fcGVuZGluZ19yb3dzICk7XHJcblx0XHRcdFx0dGhpcy5fcGVuZGluZ19yb3dzLmNsZWFyKCk7XHJcblx0XHRcdFx0cm93cy5mb3JFYWNoKCAocikgPT4gdGhpcy5yZWZyZXNoX3JvdyggciApICk7XHJcblx0XHRcdH0sIDAgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0cmVmcmVzaF9hbGwoKSB7XHJcblx0XHRcdHRoaXMuYnVpbGRlcj8ucGFnZXNfY29udGFpbmVyXHJcblx0XHRcdFx0Py5xdWVyeVNlbGVjdG9yQWxsPy4oICcud3BiY19iZmJfX3JvdycgKVxyXG5cdFx0XHRcdD8uZm9yRWFjaD8uKCAocm93KSA9PiB0aGlzLnJlZnJlc2hfcm93KCByb3cgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJlZnJlc2hfcm93KHJvd19lbCkge1xyXG5cdFx0XHRpZiAoICFyb3dfZWwgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBjb2xzID0gcm93X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAud3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHJcblx0XHRcdC8vIDEpIFJlY2FsY3VsYXRlIGVhY2ggY29sdW1u4oCZcyByZXF1aXJlZCBtaW4gcHggYW5kIHdyaXRlIGl0IHRvIHRoZSBDU1MgdmFyLlxyXG5cdFx0XHRjb2xzLmZvckVhY2goIChjb2wpID0+IHRoaXMuYXBwbHlfY29sX21pbiggY29sICkgKTtcclxuXHJcblx0XHRcdC8vIDIpIEVuZm9yY2UgaXQgYXQgdGhlIENTUyBsZXZlbCByaWdodCBhd2F5IHNvIGxheW91dCBjYW7igJl0IHJlbmRlciBuYXJyb3dlci5cclxuXHRcdFx0Y29scy5mb3JFYWNoKCAoY29sKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcHggICAgICAgICAgID0gcGFyc2VGbG9hdCggZ2V0Q29tcHV0ZWRTdHlsZSggY29sICkuZ2V0UHJvcGVydHlWYWx1ZSggJy0td3BiYy1jb2wtbWluJyApIHx8ICcwJyApIHx8IDA7XHJcblx0XHRcdFx0Y29sLnN0eWxlLm1pbldpZHRoID0gcHggPiAwID8gTWF0aC5yb3VuZCggcHggKSArICdweCcgOiAnJztcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gMykgTm9ybWFsaXplIGN1cnJlbnQgYmFzZXMgc28gdGhlIHJvdyByZXNwZWN0cyBhbGwgbWlucyB3aXRob3V0IG92ZXJmbG93LlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IGIgICA9IHRoaXMuYnVpbGRlcjtcclxuXHRcdFx0XHRjb25zdCBncCAgPSBiLmNvbF9nYXBfcGVyY2VudDtcclxuXHRcdFx0XHRjb25zdCBlZmYgPSBiLmxheW91dC5jb21wdXRlX2VmZmVjdGl2ZV9iYXNlc19mcm9tX3Jvdyggcm93X2VsLCBncCApOyAgLy8geyBiYXNlcywgYXZhaWxhYmxlIH1cclxuXHRcdFx0XHQvLyBSZS1maXQgKmN1cnJlbnQqIGJhc2VzIGFnYWluc3QgbWlucyAoc2FtZSBhbGdvcml0aG0gbGF5b3V0IGNoaXBzIHVzZSkuXHJcblx0XHRcdFx0Y29uc3QgZml0dGVkID0gVUkuV1BCQ19CRkJfTGF5b3V0X0NoaXBzLl9maXRfd2VpZ2h0c19yZXNwZWN0aW5nX21pbiggYiwgcm93X2VsLCBlZmYuYmFzZXMgKTtcclxuXHRcdFx0XHRpZiAoIEFycmF5LmlzQXJyYXkoIGZpdHRlZCApICkge1xyXG5cdFx0XHRcdFx0Y29uc3QgY2hhbmdlZCA9IGZpdHRlZC5zb21lKCAodiwgaSkgPT4gTWF0aC5hYnMoIHYgLSBlZmYuYmFzZXNbaV0gKSA+IDAuMDEgKTtcclxuXHRcdFx0XHRcdGlmICggY2hhbmdlZCApIHtcclxuXHRcdFx0XHRcdFx0Yi5sYXlvdXQuYXBwbHlfYmFzZXNfdG9fcm93KCByb3dfZWwsIGZpdHRlZCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0dy5fd3BiYz8uZGV2Py5lcnJvcj8uKCAnV1BCQ19CRkJfTWluX1dpZHRoX0d1YXJkIC0gcmVmcmVzaF9yb3cnLCBlICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRhcHBseV9jb2xfbWluKGNvbF9lbCkge1xyXG5cdFx0XHRpZiAoICFjb2xfZWwgKSByZXR1cm47XHJcblx0XHRcdGxldCBtYXhfcHggICAgPSAwO1xyXG5cdFx0XHRjb25zdCBjb2xSZWN0ID0gY29sX2VsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0XHRjb2xfZWwucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fZmllbGQnICkuZm9yRWFjaCggKGZpZWxkKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcmF3ID0gZmllbGQuZ2V0QXR0cmlidXRlKCAnZGF0YS1taW5fd2lkdGgnICk7XHJcblx0XHRcdFx0bGV0IHB4ICAgID0gMDtcclxuXHRcdFx0XHRpZiAoIHJhdyApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHMgPSBTdHJpbmcoIHJhdyApLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRcdFx0aWYgKCBzLmVuZHNXaXRoKCAnJScgKSApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgbiA9IHBhcnNlRmxvYXQoIHMgKTtcclxuXHRcdFx0XHRcdFx0aWYgKCBOdW1iZXIuaXNGaW5pdGUoIG4gKSAmJiBjb2xSZWN0LndpZHRoID4gMCApIHtcclxuXHRcdFx0XHRcdFx0XHRweCA9IChuIC8gMTAwKSAqIGNvbFJlY3Qud2lkdGg7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0cHggPSAwO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRweCA9IHRoaXMucGFyc2VfbGVuX3B4KCBzICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbnN0IGNzID0gZ2V0Q29tcHV0ZWRTdHlsZSggZmllbGQgKTtcclxuXHRcdFx0XHRcdHB4ICAgICAgID0gcGFyc2VGbG9hdCggY3MubWluV2lkdGggfHwgJzAnICkgfHwgMDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBweCA+IG1heF9weCApIG1heF9weCA9IHB4O1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGNvbF9lbC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiYy1jb2wtbWluJywgbWF4X3B4ID4gMCA/IE1hdGgucm91bmQoIG1heF9weCApICsgJ3B4JyA6ICcwcHgnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cGFyc2VfbGVuX3B4KHZhbHVlKSB7XHJcblx0XHRcdGlmICggdmFsdWUgPT0gbnVsbCApIHJldHVybiAwO1xyXG5cdFx0XHRjb25zdCBzID0gU3RyaW5nKCB2YWx1ZSApLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRpZiAoIHMgPT09ICcnICkgcmV0dXJuIDA7XHJcblx0XHRcdGlmICggcy5lbmRzV2l0aCggJ3B4JyApICkge1xyXG5cdFx0XHRcdGNvbnN0IG4gPSBwYXJzZUZsb2F0KCBzICk7XHJcblx0XHRcdFx0cmV0dXJuIE51bWJlci5pc0Zpbml0ZSggbiApID8gbiA6IDA7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBzLmVuZHNXaXRoKCAncmVtJyApIHx8IHMuZW5kc1dpdGgoICdlbScgKSApIHtcclxuXHRcdFx0XHRjb25zdCBuICAgID0gcGFyc2VGbG9hdCggcyApO1xyXG5cdFx0XHRcdGNvbnN0IGJhc2UgPSBwYXJzZUZsb2F0KCBnZXRDb21wdXRlZFN0eWxlKCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgKS5mb250U2l6ZSApIHx8IDE2O1xyXG5cdFx0XHRcdHJldHVybiBOdW1iZXIuaXNGaW5pdGUoIG4gKSA/IG4gKiBiYXNlIDogMDtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBuID0gcGFyc2VGbG9hdCggcyApO1xyXG5cdFx0XHRyZXR1cm4gTnVtYmVyLmlzRmluaXRlKCBuICkgPyBuIDogMDtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBXUEJDX0JGQl9Ub2dnbGVfTm9ybWFsaXplclxyXG5cdCAqXHJcblx0ICogQ29udmVydHMgcGxhaW4gY2hlY2tib3hlcyBpbnRvIHRvZ2dsZSBVSTpcclxuXHQgKiA8ZGl2IGNsYXNzPVwiaW5zcGVjdG9yX19jb250cm9sIHdwYmNfdWlfX3RvZ2dsZVwiPlxyXG5cdCAqICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGlkPVwie3VuaXF1ZX1cIiBkYXRhLWluc3BlY3Rvci1rZXk9XCIuLi5cIiBjbGFzcz1cImluc3BlY3Rvcl9faW5wdXRcIiByb2xlPVwic3dpdGNoXCJcclxuXHQgKiBhcmlhLWNoZWNrZWQ9XCJ0cnVlfGZhbHNlXCI+XHJcblx0ICogICA8bGFiZWwgY2xhc3M9XCJ3cGJjX3VpX190b2dnbGVfaWNvblwiICBmb3I9XCJ7dW5pcXVlfVwiPjwvbGFiZWw+XHJcblx0ICogICA8bGFiZWwgY2xhc3M9XCJ3cGJjX3VpX190b2dnbGVfbGFiZWxcIiBmb3I9XCJ7dW5pcXVlfVwiPkxhYmVsPC9sYWJlbD5cclxuXHQgKiA8L2Rpdj5cclxuXHQgKlxyXG5cdCAqIC0gU2tpcHMgaW5wdXRzIGFscmVhZHkgaW5zaWRlIGAud3BiY191aV9fdG9nZ2xlYC5cclxuXHQgKiAtIFJldXNlcyBhbiBleGlzdGluZyA8bGFiZWwgZm9yPVwiLi4uXCI+IHRleHQgaWYgcHJlc2VudDsgb3RoZXJ3aXNlIGZhbGxzIGJhY2sgdG8gbmVhcmJ5IGxhYmVscyBvciBhdHRyaWJ1dGVzLlxyXG5cdCAqIC0gQXV0by1nZW5lcmF0ZXMgYSB1bmlxdWUgaWQgd2hlbiBhYnNlbnQuXHJcblx0ICovXHJcblx0VUkuV1BCQ19CRkJfVG9nZ2xlX05vcm1hbGl6ZXIgPSBjbGFzcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBVcGdyYWRlIGFsbCByYXcgY2hlY2tib3hlcyBpbiBhIGNvbnRhaW5lciB0byB0b2dnbGVzLlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdF9lbFxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgdXBncmFkZV9jaGVja2JveGVzX2luKHJvb3RfZWwpIHtcclxuXHJcblx0XHRcdGlmICggIXJvb3RfZWwgfHwgIXJvb3RfZWwucXVlcnlTZWxlY3RvckFsbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBpbnB1dHMgPSByb290X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICk7XHJcblx0XHRcdGlmICggIWlucHV0cy5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBpbnB1dHMsIGZ1bmN0aW9uIChpbnB1dCkge1xyXG5cclxuXHRcdFx0XHQvLyAxKSBTa2lwIGlmIGFscmVhZHkgaW5zaWRlIHRvZ2dsZSB3cmFwcGVyLlxyXG5cdFx0XHRcdGlmICggaW5wdXQuY2xvc2VzdCggJy53cGJjX3VpX190b2dnbGUnICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIFNraXAgcm93cyAvIHdoZXJlIGlucHV0IGNoZWNrYm94IGV4cGxpY2l0bHkgbWFya2VkIHdpdGggIGF0dHJpYnV0ZSAnZGF0YS13cGJjLXVpLW5vLXRvZ2dsZScuXHJcblx0XHRcdFx0aWYgKCBpbnB1dC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktbm8tdG9nZ2xlJyApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gMikgRW5zdXJlIHVuaXF1ZSBpZDsgcHJlZmVyIGV4aXN0aW5nLlxyXG5cdFx0XHRcdHZhciBpbnB1dF9pZCA9IGlucHV0LmdldEF0dHJpYnV0ZSggJ2lkJyApO1xyXG5cdFx0XHRcdGlmICggIWlucHV0X2lkICkge1xyXG5cdFx0XHRcdFx0dmFyIGtleSAgPSAoaW5wdXQuZGF0YXNldCAmJiBpbnB1dC5kYXRhc2V0Lmluc3BlY3RvcktleSkgPyBTdHJpbmcoIGlucHV0LmRhdGFzZXQuaW5zcGVjdG9yS2V5ICkgOiAnb3B0JztcclxuXHRcdFx0XHRcdGlucHV0X2lkID0gVUkuV1BCQ19CRkJfVG9nZ2xlX05vcm1hbGl6ZXIuZ2VuZXJhdGVfdW5pcXVlX2lkKCAnd3BiY19pbnNfYXV0b18nICsga2V5ICsgJ18nICk7XHJcblx0XHRcdFx0XHRpbnB1dC5zZXRBdHRyaWJ1dGUoICdpZCcsIGlucHV0X2lkICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAzKSBGaW5kIGJlc3QgbGFiZWwgdGV4dC5cclxuXHRcdFx0XHR2YXIgbGFiZWxfdGV4dCA9IFVJLldQQkNfQkZCX1RvZ2dsZV9Ob3JtYWxpemVyLnJlc29sdmVfbGFiZWxfdGV4dCggcm9vdF9lbCwgaW5wdXQsIGlucHV0X2lkICk7XHJcblxyXG5cdFx0XHRcdC8vIDQpIEJ1aWxkIHRoZSB0b2dnbGUgd3JhcHBlci5cclxuXHRcdFx0XHR2YXIgd3JhcHBlciAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdFx0d3JhcHBlci5jbGFzc05hbWUgPSAnaW5zcGVjdG9yX19jb250cm9sIHdwYmNfdWlfX3RvZ2dsZSc7XHJcblxyXG5cdFx0XHRcdC8vIEtlZXAgb3JpZ2luYWwgaW5wdXQ7IGp1c3QgbW92ZSBpdCBpbnRvIHdyYXBwZXIuXHJcblx0XHRcdFx0aW5wdXQuY2xhc3NMaXN0LmFkZCggJ2luc3BlY3Rvcl9faW5wdXQnICk7XHJcblx0XHRcdFx0aW5wdXQuc2V0QXR0cmlidXRlKCAncm9sZScsICdzd2l0Y2gnICk7XHJcblx0XHRcdFx0aW5wdXQuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgaW5wdXQuY2hlY2tlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHJcblx0XHRcdFx0dmFyIGljb25fbGFiZWwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0aWNvbl9sYWJlbC5jbGFzc05hbWUgPSAnd3BiY191aV9fdG9nZ2xlX2ljb24nO1xyXG5cdFx0XHRcdGljb25fbGFiZWwuc2V0QXR0cmlidXRlKCAnZm9yJywgaW5wdXRfaWQgKTtcclxuXHJcblx0XHRcdFx0dmFyIHRleHRfbGFiZWwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0dGV4dF9sYWJlbC5jbGFzc05hbWUgPSAnd3BiY191aV9fdG9nZ2xlX2xhYmVsJztcclxuXHRcdFx0XHR0ZXh0X2xhYmVsLnNldEF0dHJpYnV0ZSggJ2ZvcicsIGlucHV0X2lkICk7XHJcblx0XHRcdFx0dGV4dF9sYWJlbC5hcHBlbmRDaGlsZCggZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoIGxhYmVsX3RleHQgKSApO1xyXG5cclxuXHRcdFx0XHQvLyA1KSBJbnNlcnQgd3JhcHBlciBpbnRvIERPTSBuZWFyIHRoZSBpbnB1dC5cclxuXHRcdFx0XHQvLyAgICBQcmVmZXJyZWQ6IHJlcGxhY2UgdGhlIG9yaWdpbmFsIGxhYmVsZWQgcm93IGlmIGl0IG1hdGNoZXMgdHlwaWNhbCBpbnNwZWN0b3IgbGF5b3V0LlxyXG5cdFx0XHRcdHZhciByZXBsYWNlZCA9IFVJLldQQkNfQkZCX1RvZ2dsZV9Ob3JtYWxpemVyLnRyeV9yZXBsYWNlX2tub3duX3JvdyggaW5wdXQsIHdyYXBwZXIsIGxhYmVsX3RleHQgKTtcclxuXHJcblx0XHRcdFx0aWYgKCAhcmVwbGFjZWQgKSB7XHJcblx0XHRcdFx0XHRpZiAoICFpbnB1dC5wYXJlbnROb2RlICkgcmV0dXJuOyAvLyBORVcgZ3VhcmRcclxuXHRcdFx0XHRcdC8vIEZhbGxiYWNrOiBqdXN0IHdyYXAgdGhlIGlucHV0IGluIHBsYWNlIGFuZCBhcHBlbmQgbGFiZWxzLlxyXG5cdFx0XHRcdFx0aW5wdXQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoIHdyYXBwZXIsIGlucHV0ICk7XHJcblx0XHRcdFx0XHR3cmFwcGVyLmFwcGVuZENoaWxkKCBpbnB1dCApO1xyXG5cdFx0XHRcdFx0d3JhcHBlci5hcHBlbmRDaGlsZCggaWNvbl9sYWJlbCApO1xyXG5cdFx0XHRcdFx0d3JhcHBlci5hcHBlbmRDaGlsZCggdGV4dF9sYWJlbCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gNikgQVJJQSBzeW5jIG9uIGNoYW5nZS5cclxuXHRcdFx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aW5wdXQuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgaW5wdXQuY2hlY2tlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdlbmVyYXRlIGEgdW5pcXVlIGlkIHdpdGggYSBnaXZlbiBwcmVmaXguXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJlZml4XHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgZ2VuZXJhdGVfdW5pcXVlX2lkKHByZWZpeCkge1xyXG5cdFx0XHR2YXIgYmFzZSA9IFN0cmluZyggcHJlZml4IHx8ICd3cGJjX2luc19hdXRvXycgKTtcclxuXHRcdFx0dmFyIHVpZCAgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAzNiApLnNsaWNlKCAyLCA4ICk7XHJcblx0XHRcdHZhciBpZCAgID0gYmFzZSArIHVpZDtcclxuXHRcdFx0Ly8gTWluaW1hbCBjb2xsaXNpb24gZ3VhcmQgaW4gdGhlIGN1cnJlbnQgZG9jdW1lbnQgc2NvcGUuXHJcblx0XHRcdHdoaWxlICggZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGlkICkgKSB7XHJcblx0XHRcdFx0dWlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZyggMzYgKS5zbGljZSggMiwgOCApO1xyXG5cdFx0XHRcdGlkICA9IGJhc2UgKyB1aWQ7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGlkO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVzb2x2ZSB0aGUgYmVzdCBodW1hbiBsYWJlbCBmb3IgYW4gaW5wdXQuXHJcblx0XHQgKiBQcmlvcml0eTpcclxuXHRcdCAqICAxKSA8bGFiZWwgZm9yPVwie2lkfVwiPnRleHQ8L2xhYmVsPlxyXG5cdFx0ICogIDIpIG5lYXJlc3Qgc2libGluZy9wYXJlbnQgLmluc3BlY3Rvcl9fbGFiZWwgdGV4dFxyXG5cdFx0ICogIDMpIGlucHV0LmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpIHx8IGRhdGEtbGFiZWwgfHwgZGF0YS1pbnNwZWN0b3Ita2V5IHx8IG5hbWUgfHwgJ09wdGlvbidcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3RfZWxcclxuXHRcdCAqIEBwYXJhbSB7SFRNTElucHV0RWxlbWVudH0gaW5wdXRcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBpbnB1dF9pZFxyXG5cdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdCAqL1xyXG5cdFx0c3RhdGljIHJlc29sdmVfbGFiZWxfdGV4dChyb290X2VsLCBpbnB1dCwgaW5wdXRfaWQpIHtcclxuXHRcdFx0Ly8gZm9yPSBhc3NvY2lhdGlvblxyXG5cdFx0XHRpZiAoIGlucHV0X2lkICkge1xyXG5cdFx0XHRcdHZhciBhc3NvYyA9IHJvb3RfZWwucXVlcnlTZWxlY3RvciggJ2xhYmVsW2Zvcj1cIicgKyBVSS5XUEJDX0JGQl9Ub2dnbGVfTm9ybWFsaXplci5jc3NfZXNjYXBlKCBpbnB1dF9pZCApICsgJ1wiXScgKTtcclxuXHRcdFx0XHRpZiAoIGFzc29jICYmIGFzc29jLnRleHRDb250ZW50ICkge1xyXG5cdFx0XHRcdFx0dmFyIHR4dCA9IGFzc29jLnRleHRDb250ZW50LnRyaW0oKTtcclxuXHRcdFx0XHRcdC8vIFJlbW92ZSB0aGUgb2xkIGxhYmVsIGZyb20gRE9NOyBpdHMgdGV4dCB3aWxsIGJlIHVzZWQgYnkgdG9nZ2xlLlxyXG5cdFx0XHRcdFx0YXNzb2MucGFyZW50Tm9kZSAmJiBhc3NvYy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBhc3NvYyApO1xyXG5cdFx0XHRcdFx0aWYgKCB0eHQgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0eHQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBuZWFyYnkgaW5zcGVjdG9yIGxhYmVsXHJcblx0XHRcdHZhciBuZWFyX2xhYmVsID0gaW5wdXQuY2xvc2VzdCggJy5pbnNwZWN0b3JfX3JvdycgKTtcclxuXHRcdFx0aWYgKCBuZWFyX2xhYmVsICkge1xyXG5cdFx0XHRcdHZhciBpbCA9IG5lYXJfbGFiZWwucXVlcnlTZWxlY3RvciggJy5pbnNwZWN0b3JfX2xhYmVsJyApO1xyXG5cdFx0XHRcdGlmICggaWwgJiYgaWwudGV4dENvbnRlbnQgKSB7XHJcblx0XHRcdFx0XHR2YXIgdDIgPSBpbC50ZXh0Q29udGVudC50cmltKCk7XHJcblx0XHRcdFx0XHQvLyBJZiB0aGlzIHJvdyBoYWQgdGhlIHN0YW5kYXJkIGxhYmVsK2NvbnRyb2wsIGRyb3AgdGhlIG9sZCB0ZXh0IGxhYmVsIHRvIGF2b2lkIGR1cGxpY2F0ZXMuXHJcblx0XHRcdFx0XHRpbC5wYXJlbnROb2RlICYmIGlsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIGlsICk7XHJcblx0XHRcdFx0XHRpZiAoIHQyICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdDI7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBmYWxsYmFja3NcclxuXHRcdFx0dmFyIGFyaWEgPSBpbnB1dC5nZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJyApO1xyXG5cdFx0XHRpZiAoIGFyaWEgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGFyaWE7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBpbnB1dC5kYXRhc2V0ICYmIGlucHV0LmRhdGFzZXQubGFiZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuIFN0cmluZyggaW5wdXQuZGF0YXNldC5sYWJlbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaW5wdXQuZGF0YXNldCAmJiBpbnB1dC5kYXRhc2V0Lmluc3BlY3RvcktleSApIHtcclxuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBpbnB1dC5kYXRhc2V0Lmluc3BlY3RvcktleSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaW5wdXQubmFtZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBpbnB1dC5uYW1lICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuICdPcHRpb24nO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVHJ5IHRvIHJlcGxhY2UgYSBrbm93biBpbnNwZWN0b3Igcm93IHBhdHRlcm4gd2l0aCBhIHRvZ2dsZSB3cmFwcGVyLlxyXG5cdFx0ICogUGF0dGVybnM6XHJcblx0XHQgKiAgPGRpdi5pbnNwZWN0b3JfX3Jvdz5cclxuXHRcdCAqICAgIDxsYWJlbC5pbnNwZWN0b3JfX2xhYmVsPlRleHQ8L2xhYmVsPlxyXG5cdFx0ICogICAgPGRpdi5pbnNwZWN0b3JfX2NvbnRyb2w+IFtpbnB1dFt0eXBlPWNoZWNrYm94XV0gPC9kaXY+XHJcblx0XHQgKiAgPC9kaXY+XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MSW5wdXRFbGVtZW50fSBpbnB1dFxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gd3JhcHBlclxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IHJlcGxhY2VkXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyB0cnlfcmVwbGFjZV9rbm93bl9yb3coaW5wdXQsIHdyYXBwZXIsIGxhYmVsX3RleHQpIHtcclxuXHRcdFx0dmFyIHJvdyAgICAgICA9IGlucHV0LmNsb3Nlc3QoICcuaW5zcGVjdG9yX19yb3cnICk7XHJcblx0XHRcdHZhciBjdHJsX3dyYXAgPSBpbnB1dC5wYXJlbnRFbGVtZW50O1xyXG5cclxuXHRcdFx0aWYgKCByb3cgJiYgY3RybF93cmFwICYmIGN0cmxfd3JhcC5jbGFzc0xpc3QuY29udGFpbnMoICdpbnNwZWN0b3JfX2NvbnRyb2wnICkgKSB7XHJcblx0XHRcdFx0Ly8gQ2xlYXIgY29udHJvbCB3cmFwIGFuZCByZWluc2VydCB0b2dnbGUgc3RydWN0dXJlLlxyXG5cdFx0XHRcdHdoaWxlICggY3RybF93cmFwLmZpcnN0Q2hpbGQgKSB7XHJcblx0XHRcdFx0XHRjdHJsX3dyYXAucmVtb3ZlQ2hpbGQoIGN0cmxfd3JhcC5maXJzdENoaWxkICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJvdy5jbGFzc0xpc3QuYWRkKCAnaW5zcGVjdG9yX19yb3ctLXRvZ2dsZScgKTtcclxuXHJcblx0XHRcdFx0Y3RybF93cmFwLmNsYXNzTGlzdC5hZGQoICd3cGJjX3VpX190b2dnbGUnICk7XHJcblx0XHRcdFx0Y3RybF93cmFwLmFwcGVuZENoaWxkKCBpbnB1dCApO1xyXG5cclxuXHRcdFx0XHR2YXIgaW5wdXRfaWQgICAgICAgPSBpbnB1dC5nZXRBdHRyaWJ1dGUoICdpZCcgKTtcclxuXHRcdFx0XHR2YXIgaWNvbl9sYmwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0aWNvbl9sYmwuY2xhc3NOYW1lID0gJ3dwYmNfdWlfX3RvZ2dsZV9pY29uJztcclxuXHRcdFx0XHRpY29uX2xibC5zZXRBdHRyaWJ1dGUoICdmb3InLCBpbnB1dF9pZCApO1xyXG5cclxuXHRcdFx0XHR2YXIgdGV4dF9sYmwgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0dGV4dF9sYmwuY2xhc3NOYW1lID0gJ3dwYmNfdWlfX3RvZ2dsZV9sYWJlbCc7XHJcblx0XHRcdFx0dGV4dF9sYmwuc2V0QXR0cmlidXRlKCAnZm9yJywgaW5wdXRfaWQgKTtcclxuXHRcdFx0XHRpZiAoIGxhYmVsX3RleHQgKSB7XHJcblx0XHRcdFx0XHR0ZXh0X2xibC5hcHBlbmRDaGlsZCggZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoIGxhYmVsX3RleHQgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBJZiB0aGUgcm93IHByZXZpb3VzbHkgaGFkIGEgLmluc3BlY3Rvcl9fbGFiZWwgKHdlIHJlbW92ZWQgaXQgaW4gcmVzb2x2ZV9sYWJlbF90ZXh0KSxcclxuXHRcdFx0XHQvLyB3ZSBpbnRlbnRpb25hbGx5IGRvIE5PVCByZWNyZWF0ZSBpdDsgdGhlIHRvZ2dsZSB0ZXh0IGxhYmVsIGJlY29tZXMgdGhlIHZpc2libGUgb25lLlxyXG5cdFx0XHRcdC8vIFRoZSB0ZXh0IGNvbnRlbnQgaXMgYWxyZWFkeSByZXNvbHZlZCBpbiByZXNvbHZlX2xhYmVsX3RleHQoKSBhbmQgc2V0IGJlbG93IGJ5IGNhbGxlci5cclxuXHJcblx0XHRcdFx0Y3RybF93cmFwLmFwcGVuZENoaWxkKCBpY29uX2xibCApO1xyXG5cdFx0XHRcdGN0cmxfd3JhcC5hcHBlbmRDaGlsZCggdGV4dF9sYmwgKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gTm90IGEga25vd24gcGF0dGVybjsgY2FsbGVyIHdpbGwgd3JhcCBpbiBwbGFjZS5cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ1NTLmVzY2FwZSBwb2x5ZmlsbCBmb3Igc2VsZWN0b3JzLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHNcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBjc3NfZXNjYXBlKHMpIHtcclxuXHRcdFx0cyA9IFN0cmluZyggcyApO1xyXG5cdFx0XHRpZiAoIHdpbmRvdy5DU1MgJiYgdHlwZW9mIHdpbmRvdy5DU1MuZXNjYXBlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHJldHVybiB3aW5kb3cuQ1NTLmVzY2FwZSggcyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBzLnJlcGxhY2UoIC8oW15cXHctXSkvZywgJ1xcXFwkMScgKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBhbGwgVUkgbm9ybWFsaXplcnMvZW5oYW5jZXJzIHRvIGEgY29udGFpbmVyIChwb3N0LXJlbmRlcikuXHJcblx0ICogS2VlcCB0aGlzIGZpbGUgc21hbGwgYW5kIGFkZCBtb3JlIG5vcm1hbGl6ZXJzIGxhdGVyIGluIG9uZSBwbGFjZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3RcclxuXHQgKi9cclxuXHRVSS5hcHBseV9wb3N0X3JlbmRlciA9IGZ1bmN0aW9uIChyb290KSB7XHJcblx0XHRpZiAoICFyb290ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR0cnkge1xyXG5cdFx0XHRVSS5XUEJDX0JGQl9WYWx1ZVNsaWRlcj8uaW5pdF9vbj8uKCByb290ICk7XHJcblx0XHR9IGNhdGNoICggZSApIHsgLyogbm9vcCAqL1xyXG5cdFx0fVxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0dmFyIFQgPSBVSS5XUEJDX0JGQl9Ub2dnbGVfTm9ybWFsaXplcjtcclxuXHRcdFx0aWYgKCBUICYmIHR5cGVvZiBULnVwZ3JhZGVfY2hlY2tib3hlc19pbiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRULnVwZ3JhZGVfY2hlY2tib3hlc19pbiggcm9vdCApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0dy5fd3BiYz8uZGV2Py5lcnJvcj8uKCAnYXBwbHlfcG9zdF9yZW5kZXIudG9nZ2xlJywgZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEFjY2Vzc2liaWxpdHk6IGtlZXAgYXJpYS1jaGVja2VkIGluIHN5bmMgZm9yIGFsbCB0b2dnbGVzIGluc2lkZSByb290LlxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdWlfX3RvZ2dsZSBpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkuZm9yRWFjaCggZnVuY3Rpb24gKGNiKSB7XHJcblx0XHRcdFx0aWYgKCBjYi5fX3dwYmNfYXJpYV9ob29rZWQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNiLl9fd3BiY19hcmlhX2hvb2tlZCA9IHRydWU7XHJcblx0XHRcdFx0Y2Iuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgY2IuY2hlY2tlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHRcdFx0XHQvLyBEZWxlZ2F0ZSDigJhjaGFuZ2XigJkganVzdCBvbmNlIHBlciByZW5kZXIg4oCTIG5hdGl2ZSBkZWxlZ2F0aW9uIHN0aWxsIHdvcmtzIGZpbmUgZm9yIHlvdXIgbG9naWMuXHJcblx0XHRcdFx0Y2IuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsICgpID0+IHtcclxuXHRcdFx0XHRcdGNiLnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsIGNiLmNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdFx0fSwgeyBwYXNzaXZlOiB0cnVlIH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdHcuX3dwYmM/LmRldj8uZXJyb3I/LiggJ2FwcGx5X3Bvc3RfcmVuZGVyLmFyaWEnLCBlICk7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0VUkuSW5zcGVjdG9yRW5oYW5jZXJzID0gVUkuSW5zcGVjdG9yRW5oYW5jZXJzIHx8IChmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgcmVncyA9IFtdO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHJlZ2lzdGVyKG5hbWUsIHNlbGVjdG9yLCBpbml0LCBkZXN0cm95KSB7XHJcblx0XHRcdHJlZ3MucHVzaCggeyBuYW1lLCBzZWxlY3RvciwgaW5pdCwgZGVzdHJveSB9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gc2Nhbihyb290KSB7XHJcblx0XHRcdGlmICggIXJvb3QgKSByZXR1cm47XHJcblx0XHRcdHJlZ3MuZm9yRWFjaCggZnVuY3Rpb24gKHIpIHtcclxuXHRcdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHIuc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRcdFx0bm9kZS5fX3dwYmNfZWggPSBub2RlLl9fd3BiY19laCB8fCB7fTtcclxuXHRcdFx0XHRcdGlmICggbm9kZS5fX3dwYmNfZWhbci5uYW1lXSApIHJldHVybjtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdHIuaW5pdCAmJiByLmluaXQoIG5vZGUsIHJvb3QgKTtcclxuXHRcdFx0XHRcdFx0bm9kZS5fX3dwYmNfZWhbci5uYW1lXSA9IHRydWU7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gZGVzdHJveShyb290KSB7XHJcblx0XHRcdGlmICggIXJvb3QgKSByZXR1cm47XHJcblx0XHRcdHJlZ3MuZm9yRWFjaCggZnVuY3Rpb24gKHIpIHtcclxuXHRcdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHIuc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0ci5kZXN0cm95ICYmIHIuZGVzdHJveSggbm9kZSwgcm9vdCApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBub2RlLl9fd3BiY19laCApIGRlbGV0ZSBub2RlLl9fd3BiY19laFtyLm5hbWVdO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7IHJlZ2lzdGVyLCBzY2FuLCBkZXN0cm95IH07XHJcblx0fSkoKTtcclxuXHJcblx0VUkuV1BCQ19CRkJfVmFsdWVTbGlkZXIgPSB7XHJcblx0XHRpbml0X29uKHJvb3QpIHtcclxuXHRcdFx0dmFyIGdyb3VwcyA9IChyb290Lm5vZGVUeXBlID09PSAxID8gWyByb290IF0gOiBbXSkuY29uY2F0KCBbXS5zbGljZS5jYWxsKCByb290LnF1ZXJ5U2VsZWN0b3JBbGw/LiggJ1tkYXRhLWxlbi1ncm91cF0nICkgfHwgW10gKSApO1xyXG5cdFx0XHRncm91cHMuZm9yRWFjaCggZnVuY3Rpb24gKGcpIHtcclxuXHRcdFx0XHRpZiAoICFnLm1hdGNoZXMgfHwgIWcubWF0Y2hlcyggJ1tkYXRhLWxlbi1ncm91cF0nICkgKSByZXR1cm47XHJcblx0XHRcdFx0aWYgKCBnLl9fd3BiY19sZW5fd2lyZWQgKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdHZhciBudW1iZXIgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tdmFsdWVdJyApO1xyXG5cdFx0XHRcdHZhciByYW5nZSAgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tcmFuZ2VdJyApO1xyXG5cdFx0XHRcdHZhciB1bml0ICAgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tdW5pdF0nICk7XHJcblxyXG5cdFx0XHRcdGlmICggIW51bWJlciB8fCAhcmFuZ2UgKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdC8vIE1pcnJvciBjb25zdHJhaW50cyBpZiBtaXNzaW5nIG9uIHRoZSByYW5nZS5cclxuXHRcdFx0XHRbICdtaW4nLCAnbWF4JywgJ3N0ZXAnIF0uZm9yRWFjaCggZnVuY3Rpb24gKGEpIHtcclxuXHRcdFx0XHRcdGlmICggIXJhbmdlLmhhc0F0dHJpYnV0ZSggYSApICYmIG51bWJlci5oYXNBdHRyaWJ1dGUoIGEgKSApIHtcclxuXHRcdFx0XHRcdFx0cmFuZ2Uuc2V0QXR0cmlidXRlKCBhLCBudW1iZXIuZ2V0QXR0cmlidXRlKCBhICkgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblxyXG5cclxuXHRcdFx0XHRmdW5jdGlvbiBzeW5jX3JhbmdlX2Zyb21fbnVtYmVyKCkge1xyXG5cdFx0XHRcdFx0aWYgKCByYW5nZS52YWx1ZSAhPT0gbnVtYmVyLnZhbHVlICkge1xyXG5cdFx0XHRcdFx0XHRyYW5nZS52YWx1ZSA9IG51bWJlci52YWx1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZ1bmN0aW9uIGRpc3BhdGNoX2lucHV0KGVsKSB7XHJcblx0XHRcdFx0XHR0cnkgeyBlbC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTsgfSBjYXRjaCAoIF9lICkge31cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZnVuY3Rpb24gZGlzcGF0Y2hfY2hhbmdlKGVsKSB7XHJcblx0XHRcdFx0XHR0cnkgeyBlbC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7IH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBUaHJvdHRsZSByYW5nZS0+bnVtYmVyIHN5bmNpbmcgKHRpbWUtYmFzZWQpLlxyXG5cdFx0XHRcdHZhciB0aW1lcl9pZCAgICAgICA9IDA7XHJcblx0XHRcdFx0dmFyIHBlbmRpbmdfdmFsICAgID0gbnVsbDtcclxuXHRcdFx0XHR2YXIgcGVuZGluZ19jaGFuZ2UgPSBmYWxzZTtcclxuXHRcdFx0XHR2YXIgbGFzdF9mbHVzaF90cyAgPSAwO1xyXG5cclxuXHRcdFx0XHQvLyBDaGFuZ2UgdGhpcyB0byB0dW5lIHNwZWVkOiA1MC4uMTIwIG1zIGlzIGEgZ29vZCByYW5nZS5cclxuXHRcdFx0XHR2YXIgbWluX2ludGVydmFsX21zID0gcGFyc2VJbnQoIGcuZGF0YXNldC5sZW5UaHJvdHRsZSB8fCBVSS5WQUxVRV9TTElERVJfVEhST1RUTEVfTVMsIDEwICk7XHJcblx0XHRcdFx0bWluX2ludGVydmFsX21zID0gTnVtYmVyLmlzRmluaXRlKCBtaW5faW50ZXJ2YWxfbXMgKSA/IE1hdGgubWF4KCAwLCBtaW5faW50ZXJ2YWxfbXMgKSA6IDEyMDtcclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gZmx1c2hfcmFuZ2VfdG9fbnVtYmVyKCkge1xyXG5cdFx0XHRcdFx0dGltZXJfaWQgPSAwO1xyXG5cclxuXHRcdFx0XHRcdGlmICggcGVuZGluZ192YWwgPT0gbnVsbCApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHZhciBuZXh0ICAgID0gU3RyaW5nKCBwZW5kaW5nX3ZhbCApO1xyXG5cdFx0XHRcdFx0cGVuZGluZ192YWwgPSBudWxsO1xyXG5cclxuXHRcdFx0XHRcdGlmICggbnVtYmVyLnZhbHVlICE9PSBuZXh0ICkge1xyXG5cdFx0XHRcdFx0XHRudW1iZXIudmFsdWUgPSBuZXh0O1xyXG5cdFx0XHRcdFx0XHQvLyBJTVBPUlRBTlQ6IG9ubHkgJ2lucHV0JyB3aGlsZSBkcmFnZ2luZy5cclxuXHRcdFx0XHRcdFx0ZGlzcGF0Y2hfaW5wdXQoIG51bWJlciApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggcGVuZGluZ19jaGFuZ2UgKSB7XHJcblx0XHRcdFx0XHRcdHBlbmRpbmdfY2hhbmdlID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdGRpc3BhdGNoX2NoYW5nZSggbnVtYmVyICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0bGFzdF9mbHVzaF90cyA9IERhdGUubm93KCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmdW5jdGlvbiBzY2hlZHVsZV9yYW5nZV90b19udW1iZXIodmFsLCBlbWl0X2NoYW5nZSkge1xyXG5cdFx0XHRcdFx0cGVuZGluZ192YWwgPSB2YWw7XHJcblx0XHRcdFx0XHRpZiAoIGVtaXRfY2hhbmdlICkge1xyXG5cdFx0XHRcdFx0XHRwZW5kaW5nX2NoYW5nZSA9IHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gSWYgY29tbWl0IHJlcXVlc3RlZCwgZmx1c2ggaW1tZWRpYXRlbHkuXHJcblx0XHRcdFx0XHRpZiAoIHBlbmRpbmdfY2hhbmdlICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHRpbWVyX2lkICkge1xyXG5cdFx0XHRcdFx0XHRcdGNsZWFyVGltZW91dCggdGltZXJfaWQgKTtcclxuXHRcdFx0XHRcdFx0XHR0aW1lcl9pZCA9IDA7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0Zmx1c2hfcmFuZ2VfdG9fbnVtYmVyKCk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR2YXIgbm93ICAgPSBEYXRlLm5vdygpO1xyXG5cdFx0XHRcdFx0dmFyIGRlbHRhID0gbm93IC0gbGFzdF9mbHVzaF90cztcclxuXHJcblx0XHRcdFx0XHQvLyBJZiBlbm91Z2ggdGltZSBwYXNzZWQsIGZsdXNoIGltbWVkaWF0ZWx5OyBlbHNlIHNjaGVkdWxlLlxyXG5cdFx0XHRcdFx0aWYgKCBkZWx0YSA+PSBtaW5faW50ZXJ2YWxfbXMgKSB7XHJcblx0XHRcdFx0XHRcdGZsdXNoX3JhbmdlX3RvX251bWJlcigpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCB0aW1lcl9pZCApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHRpbWVyX2lkID0gc2V0VGltZW91dCggZmx1c2hfcmFuZ2VfdG9fbnVtYmVyLCBNYXRoLm1heCggMCwgbWluX2ludGVydmFsX21zIC0gZGVsdGEgKSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gb25fbnVtYmVyX2lucHV0KCkge1xyXG5cdFx0XHRcdFx0c3luY19yYW5nZV9mcm9tX251bWJlcigpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZnVuY3Rpb24gb25fbnVtYmVyX2NoYW5nZSgpIHtcclxuXHRcdFx0XHRcdHN5bmNfcmFuZ2VfZnJvbV9udW1iZXIoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZ1bmN0aW9uIG9uX3JhbmdlX2lucHV0KCkge1xyXG5cdFx0XHRcdFx0c2NoZWR1bGVfcmFuZ2VfdG9fbnVtYmVyKCByYW5nZS52YWx1ZSwgZmFsc2UgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZ1bmN0aW9uIG9uX3JhbmdlX2NoYW5nZSgpIHtcclxuXHRcdFx0XHRcdHNjaGVkdWxlX3JhbmdlX3RvX251bWJlciggcmFuZ2UudmFsdWUsIHRydWUgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdG51bWJlci5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCAgb25fbnVtYmVyX2lucHV0ICk7XHJcblx0XHRcdFx0bnVtYmVyLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBvbl9udW1iZXJfY2hhbmdlICk7XHJcblx0XHRcdFx0cmFuZ2UuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgIG9uX3JhbmdlX2lucHV0ICk7XHJcblx0XHRcdFx0cmFuZ2UuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIG9uX3JhbmdlX2NoYW5nZSApO1xyXG5cclxuXHRcdFx0XHRpZiAoIHVuaXQgKSB7XHJcblx0XHRcdFx0XHR1bml0LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdC8vIFdlIGp1c3QgbnVkZ2UgdGhlIG51bWJlciBzbyB1cHN0cmVhbSBoYW5kbGVycyByZS1ydW4uXHJcblx0XHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdFx0bnVtYmVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEluaXRpYWwgc3luY1xyXG5cdFx0XHRcdHN5bmNfcmFuZ2VfZnJvbV9udW1iZXIoKTtcclxuXHJcblx0XHRcdFx0Zy5fX3dwYmNfbGVuX3dpcmVkID0ge1xyXG5cdFx0XHRcdFx0ZGVzdHJveSgpIHtcclxuXHRcdFx0XHRcdFx0bnVtYmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsICBvbl9udW1iZXJfaW5wdXQgKTtcclxuXHRcdFx0XHRcdFx0bnVtYmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBvbl9udW1iZXJfY2hhbmdlICk7XHJcblx0XHRcdFx0XHRcdHJhbmdlLnJlbW92ZUV2ZW50TGlzdGVuZXIoICdpbnB1dCcsICBvbl9yYW5nZV9pbnB1dCApO1xyXG5cdFx0XHRcdFx0XHRyYW5nZS5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgb25fcmFuZ2VfY2hhbmdlICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSxcclxuXHRcdGRlc3Ryb3lfb24ocm9vdCkge1xyXG5cdFx0XHR2YXIgZ3JvdXBzID0gKHJvb3QgJiYgcm9vdC5ub2RlVHlwZSA9PT0gMSA/IFsgcm9vdCBdIDogW10pLmNvbmNhdChcclxuXHRcdFx0XHRbXS5zbGljZS5jYWxsKCByb290LnF1ZXJ5U2VsZWN0b3JBbGw/LiggJ1tkYXRhLWxlbi1ncm91cF0nICkgfHwgW10gKVxyXG5cdFx0XHQpO1xyXG5cdFx0XHRncm91cHMuZm9yRWFjaCggZnVuY3Rpb24gKGcpIHtcclxuXHRcdFx0XHRpZiAoICFnLm1hdGNoZXMgfHwgIWcubWF0Y2hlcyggJ1tkYXRhLWxlbi1ncm91cF0nICkgKSByZXR1cm47XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGcuX193cGJjX2xlbl93aXJlZCAmJiBnLl9fd3BiY19sZW5fd2lyZWQuZGVzdHJveSAmJiBnLl9fd3BiY19sZW5fd2lyZWQuZGVzdHJveSgpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZGVsZXRlIGcuX193cGJjX2xlbl93aXJlZDtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIFJlZ2lzdGVyIHdpdGggdGhlIGdsb2JhbCBlbmhhbmNlcnMgaHViLlxyXG5cdFVJLkluc3BlY3RvckVuaGFuY2VycyAmJiBVSS5JbnNwZWN0b3JFbmhhbmNlcnMucmVnaXN0ZXIoXHJcblx0XHQndmFsdWUtc2xpZGVyJyxcclxuXHRcdCdbZGF0YS1sZW4tZ3JvdXBdJyxcclxuXHRcdGZ1bmN0aW9uIChlbCwgX3Jvb3QpIHtcclxuXHRcdFx0VUkuV1BCQ19CRkJfVmFsdWVTbGlkZXIuaW5pdF9vbiggZWwgKTtcclxuXHRcdH0sXHJcblx0XHRmdW5jdGlvbiAoZWwsIF9yb290KSB7XHJcblx0XHRcdFVJLldQQkNfQkZCX1ZhbHVlU2xpZGVyLmRlc3Ryb3lfb24oIGVsICk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0Ly8gU2luZ2xlLCBsb2FkLW9yZGVyLXNhZmUgcGF0Y2ggc28gZW5oYW5jZXJzIGF1dG8tcnVuIG9uIGV2ZXJ5IGJpbmQuXHJcblx0KGZ1bmN0aW9uIHBhdGNoSW5zcGVjdG9yRW5oYW5jZXJzKCkge1xyXG5cdFx0ZnVuY3Rpb24gYXBwbHlQYXRjaCgpIHtcclxuXHRcdFx0dmFyIEluc3BlY3RvciA9IHcuV1BCQ19CRkJfSW5zcGVjdG9yO1xyXG5cdFx0XHRpZiAoICFJbnNwZWN0b3IgfHwgSW5zcGVjdG9yLl9fd3BiY19lbmhhbmNlcnNfcGF0Y2hlZCApIHJldHVybiBmYWxzZTtcclxuXHRcdFx0SW5zcGVjdG9yLl9fd3BiY19lbmhhbmNlcnNfcGF0Y2hlZCA9IHRydWU7XHJcblx0XHRcdHZhciBvcmlnICAgICAgICAgICAgICAgICAgICAgICAgICAgPSBJbnNwZWN0b3IucHJvdG90eXBlLmJpbmRfdG9fZmllbGQ7XHJcblx0XHRcdEluc3BlY3Rvci5wcm90b3R5cGUuYmluZF90b19maWVsZCAgPSBmdW5jdGlvbiAoZWwpIHtcclxuXHRcdFx0XHRvcmlnLmNhbGwoIHRoaXMsIGVsICk7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHZhciBpbnMgPSB0aGlzLnBhbmVsXHJcblx0XHRcdFx0XHRcdHx8IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKVxyXG5cdFx0XHRcdFx0XHR8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19pbnNwZWN0b3InICk7XHJcblx0XHRcdFx0XHRVSS5JbnNwZWN0b3JFbmhhbmNlcnMgJiYgVUkuSW5zcGVjdG9yRW5oYW5jZXJzLnNjYW4oIGlucyApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH07XHJcblx0XHRcdC8vIEluaXRpYWwgc2NhbiBpZiB0aGUgRE9NIGlzIGFscmVhZHkgcHJlc2VudC5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgaW5zRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3InIClcclxuXHRcdFx0XHRcdHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0XHRVSS5JbnNwZWN0b3JFbmhhbmNlcnMgJiYgVUkuSW5zcGVjdG9yRW5oYW5jZXJzLnNjYW4oIGluc0VsICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUcnkgbm93OyBpZiBJbnNwZWN0b3IgaXNu4oCZdCBkZWZpbmVkIHlldCwgcGF0Y2ggd2hlbiBpdCBiZWNvbWVzIHJlYWR5LlxyXG5cdFx0aWYgKCAhYXBwbHlQYXRjaCgpICkge1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFxyXG5cdFx0XHRcdCd3cGJjX2JmYl9pbnNwZWN0b3JfcmVhZHknLFxyXG5cdFx0XHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdGFwcGx5UGF0Y2goKTtcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHsgb25jZTogdHJ1ZSB9XHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblx0fSkoKTtcclxuXHJcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSk7XHJcbiIsIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX19qcy9jb3JlL2JmYi1zeW5jLWNvZGUtdG9vbHMtdGFiLmpzICAgfCAyMDI2LTA0LTA2IHwgMTY6MzhcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAoIHcsIGQgKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvKipcclxuXHQgKiBEaXNwYXRjaCByZXF1ZXN0IHRvIHNob3cgYSByaWdodCBzaWRlYmFyIHBhbmVsLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHBhbmVsX2lkXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHRhYl9pZFxyXG5cdCAqXHJcblx0ICogQHJldHVybiB7dm9pZH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fZGlzcGF0Y2hfc2hvd19wYW5lbCggcGFuZWxfaWQsIHRhYl9pZCApIHtcclxuXHJcblx0XHR2YXIgZXZlbnRfZGV0YWlsO1xyXG5cclxuXHRcdGlmICggISBwYW5lbF9pZCB8fCAhIHRhYl9pZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGV2ZW50X2RldGFpbCA9IHtcclxuXHRcdFx0cGFuZWxfaWQ6IHBhbmVsX2lkLFxyXG5cdFx0XHR0YWJfaWQgIDogdGFiX2lkXHJcblx0XHR9O1xyXG5cclxuXHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHcud3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjX2JmYjpzaG93X3BhbmVsJywgZXZlbnRfZGV0YWlsICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRkLmRpc3BhdGNoRXZlbnQoXHJcblx0XHRcdG5ldyBDdXN0b21FdmVudChcclxuXHRcdFx0XHQnd3BiY19iZmI6c2hvd19wYW5lbCcsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0ZGV0YWlsOiBldmVudF9kZXRhaWxcclxuXHRcdFx0XHR9XHJcblx0XHRcdClcclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTeW5jIHJpZ2h0IHNpZGViYXIgd2l0aCB0b3AgbW9kZSB0YWJzLlxyXG5cdCAqXHJcblx0ICogVXNlcyB0b3AgdGFicyBuYXYgYXR0cmlidXRlIGBkYXRhLWFjdGl2ZS10YWJgIGFzIHRoZSBzb3VyY2Ugb2YgdHJ1dGguXHJcblx0ICogVGhpcyBhdm9pZHMgZmFsc2UgZGV0ZWN0aW9uIG9uIGluaXRpYWwgcGFnZSBsb2FkLCBiZWNhdXNlIHRvcCBwYW5lbHMgYXJlXHJcblx0ICogaGlkZGVuIGJ5IGlubGluZSBzdHlsZSBgZGlzcGxheTpub25lYCwgbm90IGJ5IHRoZSBgaGlkZGVuYCBhdHRyaWJ1dGUuXHJcblx0ICovXHJcblx0Y2xhc3MgV1BCQ19CRkJfTW9kZV9SaWdodGJhcl9TeW5jIHtcclxuXHJcblx0XHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdFx0dGhpcy50b3BfdGFic19uYXYgICAgICA9IG51bGw7XHJcblx0XHRcdHRoaXMuYWR2YW5jZWRfdGFiX3dyYXAgPSBudWxsO1xyXG5cdFx0XHR0aGlzLmFkdmFuY2VkX3BhbmVsICAgID0gbnVsbDtcclxuXHRcdFx0dGhpcy5tdXRhdGlvbl9vYnNlcnZlciA9IG51bGw7XHJcblx0XHRcdHRoaXMubGFzdF9tb2RlICAgICAgICAgPSAnJztcclxuXHRcdFx0dGhpcy5zeW5jX3JpZ2h0YmFyX21vZGUgPSB0aGlzLnN5bmNfcmlnaHRiYXJfbW9kZS5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuaGFuZGxlX2NsaWNrICAgICAgPSB0aGlzLmhhbmRsZV9jbGljay5iaW5kKCB0aGlzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbml0IGNvbnRyb2xsZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0dGhpcy50b3BfdGFic19uYXYgICAgICA9IGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fdG9wX2hvcmlzb250YWxfbmF2JyApO1xyXG5cdFx0XHR0aGlzLmFkdmFuY2VkX3RhYl93cmFwID0gZC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19yaWdodGJhcl90YWJfd3JhcC0tYWR2YW5jZWRfdG9vbHMnICk7XHJcblx0XHRcdHRoaXMuYWR2YW5jZWRfcGFuZWwgICAgPSBkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3Rvcl9hZHZhbmNlZF90b29scycgKTtcclxuXHJcblx0XHRcdGlmICggISB0aGlzLmFkdmFuY2VkX3RhYl93cmFwIHx8ICEgdGhpcy5hZHZhbmNlZF9wYW5lbCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE9ic2VydmUgYWN0aXZlIHRhYiBjaGFuZ2VzIGluIHRoZSB0b3AgdGFicyBuYXYuXHJcblx0XHRcdGlmICggdGhpcy50b3BfdGFic19uYXYgKSB7XHJcblx0XHRcdFx0dGhpcy5tdXRhdGlvbl9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCB0aGlzLnN5bmNfcmlnaHRiYXJfbW9kZSApO1xyXG5cdFx0XHRcdHRoaXMubXV0YXRpb25fb2JzZXJ2ZXIub2JzZXJ2ZShcclxuXHRcdFx0XHRcdHRoaXMudG9wX3RhYnNfbmF2LFxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRhdHRyaWJ1dGVzICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRcdGF0dHJpYnV0ZUZpbHRlcjogWyAnZGF0YS1hY3RpdmUtdGFiJyBdXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRmFsbGJhY2sgZm9yIGNsaWNrLWRyaXZlbiBzd2l0Y2hpbmcuXHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5oYW5kbGVfY2xpY2ssIHRydWUgKTtcclxuXHJcblx0XHRcdC8vIEluaXRpYWwgc3luYy5cclxuXHRcdFx0dGhpcy5zeW5jX3JpZ2h0YmFyX21vZGUoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBhY3RpdmUgdG9wIHRhYiBpZC5cclxuXHRcdCAqXHJcblx0XHQgKiBQcmlvcml0eTpcclxuXHRcdCAqIDEuIGRhdGEtYWN0aXZlLXRhYiBmcm9tIHRvcCB0YWJzIG5hdlxyXG5cdFx0ICogMi4gYWN0aXZlIENTUyBjbGFzcyBpbiBuYXZcclxuXHRcdCAqIDMuIHZpc2libGUgdG9wIHBhbmVsIGZhbGxiYWNrXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdFx0ICovXHJcblx0XHRnZXRfYWN0aXZlX3RvcF90YWJfaWQoKSB7XHJcblx0XHRcdHZhciBhY3RpdmVfdGFiX2lkID0gJyc7XHJcblx0XHRcdHZhciBhY3RpdmVfbGluayAgID0gbnVsbDtcclxuXHRcdFx0dmFyIGFkdmFuY2VkX3BhbmVsID0gbnVsbDtcclxuXHRcdFx0dmFyIGJ1aWxkZXJfcGFuZWwgID0gbnVsbDtcclxuXHJcblx0XHRcdGlmICggdGhpcy50b3BfdGFic19uYXYgKSB7XHJcblx0XHRcdFx0YWN0aXZlX3RhYl9pZCA9IFN0cmluZyggdGhpcy50b3BfdGFic19uYXYuZ2V0QXR0cmlidXRlKCAnZGF0YS1hY3RpdmUtdGFiJyApIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0XHRcdGlmICggJycgIT09IGFjdGl2ZV90YWJfaWQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gYWN0aXZlX3RhYl9pZDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGFjdGl2ZV9saW5rID0gdGhpcy50b3BfdGFic19uYXYucXVlcnlTZWxlY3RvciggJy53cGJjX3VpX2VsX19ob3Jpc19uYXZfaXRlbS5hY3RpdmUgW2RhdGEtd3BiYy1iZmItdGFiXScgKTtcclxuXHRcdFx0XHRpZiAoIGFjdGl2ZV9saW5rICkge1xyXG5cdFx0XHRcdFx0YWN0aXZlX3RhYl9pZCA9IFN0cmluZyggYWN0aXZlX2xpbmsuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi10YWInICkgfHwgJycgKS50cmltKCk7XHJcblx0XHRcdFx0XHRpZiAoICcnICE9PSBhY3RpdmVfdGFiX2lkICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gYWN0aXZlX3RhYl9pZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZpbmFsIGZhbGxiYWNrOiBkZXRlY3QgdmlzaWJsZSBwYW5lbC5cclxuXHRcdFx0YWR2YW5jZWRfcGFuZWwgPSBkLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX3RvcF90YWJfc2VjdGlvbl9fYWR2YW5jZWRfdGFiJyApO1xyXG5cdFx0XHRidWlsZGVyX3BhbmVsICA9IGQucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fdG9wX3RhYl9zZWN0aW9uX19idWlsZGVyX3RhYicgKTtcclxuXHJcblx0XHRcdGlmICggdGhpcy5pc19lbGVtZW50X3Zpc2libGUoIGFkdmFuY2VkX3BhbmVsICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuICdhZHZhbmNlZF90YWInO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggdGhpcy5pc19lbGVtZW50X3Zpc2libGUoIGJ1aWxkZXJfcGFuZWwgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gJ2J1aWxkZXJfdGFiJztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgZWxlbWVudCB2aXNpYmlsaXR5LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gZWxcclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRpc19lbGVtZW50X3Zpc2libGUoIGVsICkge1xyXG5cdFx0XHR2YXIgc3R5bGU7XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRzdHlsZSA9IHcuZ2V0Q29tcHV0ZWRTdHlsZSggZWwgKTtcclxuXHJcblx0XHRcdGlmICggISBzdHlsZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ25vbmUnID09PSBzdHlsZS5kaXNwbGF5ICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAnaGlkZGVuJyA9PT0gc3R5bGUudmlzaWJpbGl0eSApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgaWYgQWR2YW5jZWQgTW9kZSBpcyBhY3RpdmUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0aXNfYWR2YW5jZWRfbW9kZV9hY3RpdmUoKSB7XHJcblx0XHRcdHJldHVybiAoICdhZHZhbmNlZF90YWInID09PSB0aGlzLmdldF9hY3RpdmVfdG9wX3RhYl9pZCgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IENvZGUgVG9vbHMgdGFiIGJ1dHRvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzaG93X2FkdmFuY2VkX3Rvb2xzX3RhYigpIHtcclxuXHRcdFx0dGhpcy5hZHZhbmNlZF90YWJfd3JhcC5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XHJcblx0XHRcdHRoaXMuYWR2YW5jZWRfdGFiX3dyYXAuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIaWRlIENvZGUgVG9vbHMgdGFiIGJ1dHRvbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRoaWRlX2FkdmFuY2VkX3Rvb2xzX3RhYigpIHtcclxuXHRcdFx0dGhpcy5hZHZhbmNlZF90YWJfd3JhcC5zZXRBdHRyaWJ1dGUoICdoaWRkZW4nLCAndHJ1ZScgKTtcclxuXHRcdFx0dGhpcy5hZHZhbmNlZF90YWJfd3JhcC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgaWYgQ29kZSBUb29scyBwYW5lbCBpcyBjdXJyZW50bHkgYWN0aXZlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGlzX2FkdmFuY2VkX3Rvb2xzX3BhbmVsX2FjdGl2ZSgpIHtcclxuXHRcdFx0cmV0dXJuICEhICggdGhpcy5hZHZhbmNlZF9wYW5lbCAmJiAhIHRoaXMuYWR2YW5jZWRfcGFuZWwuaGFzQXR0cmlidXRlKCAnaGlkZGVuJyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIENvZGUgVG9vbHMgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9hZHZhbmNlZF90b29sc19wYW5lbCgpIHtcclxuXHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX3Nob3dfcGFuZWwoICd3cGJjX2JmYl9faW5zcGVjdG9yX2FkdmFuY2VkX3Rvb2xzJywgJ3dwYmNfdGFiX2FkdmFuY2VkX3Rvb2xzJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3BlbiBkZWZhdWx0IGJ1aWxkZXIgcmlnaHRiYXIgcGFuZWwuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9kZWZhdWx0X3Zpc3VhbF9wYW5lbCgpIHtcclxuXHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX3Nob3dfcGFuZWwoICd3cGJjX2JmYl9fcGFsZXR0ZV9hZGRfbmV3JywgJ3dwYmNfdGFiX2xpYnJhcnknICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTeW5jIHJpZ2h0YmFyIG1vZGUgd2l0aCB0b3AgdGFicyBtb2RlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN5bmNfcmlnaHRiYXJfbW9kZSgpIHtcclxuXHRcdFx0dmFyIGlzX2FkdmFuY2VkX21vZGUgPSB0aGlzLmlzX2FkdmFuY2VkX21vZGVfYWN0aXZlKCk7XHJcblxyXG5cdFx0XHRpZiAoIGlzX2FkdmFuY2VkX21vZGUgKSB7XHJcblx0XHRcdFx0dGhpcy5zaG93X2FkdmFuY2VkX3Rvb2xzX3RhYigpO1xyXG5cclxuXHRcdFx0XHRpZiAoICdhZHZhbmNlZCcgIT09IHRoaXMubGFzdF9tb2RlICkge1xyXG5cdFx0XHRcdFx0dGhpcy5vcGVuX2FkdmFuY2VkX3Rvb2xzX3BhbmVsKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR0aGlzLmxhc3RfbW9kZSA9ICdhZHZhbmNlZCc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHRoaXMuaXNfYWR2YW5jZWRfdG9vbHNfcGFuZWxfYWN0aXZlKCkgKSB7XHJcblx0XHRcdFx0dGhpcy5vcGVuX2RlZmF1bHRfdmlzdWFsX3BhbmVsKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuaGlkZV9hZHZhbmNlZF90b29sc190YWIoKTtcclxuXHRcdFx0dGhpcy5sYXN0X21vZGUgPSAnYnVpbGRlcic7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBGYWxsYmFjayBjbGljayBoYW5kbGVyIGZvciB0b3AgdGFicy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdGhhbmRsZV9jbGljayggZXZlbnQgKSB7XHJcblx0XHRcdHZhciB0YXJnZXQgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYmZiLXRhYl0nICk7XHJcblx0XHRcdHZhciB0aGlzX29iaiA9IHRoaXM7XHJcblxyXG5cdFx0XHRpZiAoICEgdGFyZ2V0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0c2V0VGltZW91dChcclxuXHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHR0aGlzX29iai5zeW5jX3JpZ2h0YmFyX21vZGUoKTtcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdDBcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycgKSB7XHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoXHJcblx0XHRcdCdET01Db250ZW50TG9hZGVkJyxcclxuXHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdCggbmV3IFdQQkNfQkZCX01vZGVfUmlnaHRiYXJfU3luYygpICkuaW5pdCgpO1xyXG5cdFx0XHR9XHJcblx0XHQpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQoIG5ldyBXUEJDX0JGQl9Nb2RlX1JpZ2h0YmFyX1N5bmMoKSApLmluaXQoKTtcclxuXHR9XHJcblxyXG59KSggd2luZG93LCBkb2N1bWVudCApOyIsIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9jb3JlL2JmYi1pbnNwZWN0b3IuanMgPT0gVGltZSBwb2ludDogMjAyNS0wOS0wNiAxNDowOFxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICh3KSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvLyAxKSBBY3Rpb25zIHJlZ2lzdHJ5LlxyXG5cclxuXHQvKiogQHR5cGUge1JlY29yZDxzdHJpbmcsIChjdHg6IEluc3BlY3RvckFjdGlvbkNvbnRleHQpID0+IHZvaWQ+fSAqL1xyXG5cdGNvbnN0IF9fSU5TUEVDVE9SX0FDVElPTlNfTUFQX18gPSBPYmplY3QuY3JlYXRlKCBudWxsICk7XHJcblxyXG5cdC8vIEJ1aWx0LWlucy5cclxuXHRfX0lOU1BFQ1RPUl9BQ1RJT05TX01BUF9fWydkZXNlbGVjdCddID0gKHsgYnVpbGRlciB9KSA9PiB7XHJcblx0XHRidWlsZGVyPy5zZWxlY3RfZmllbGQ/LiggbnVsbCApO1xyXG5cdH07XHJcblxyXG5cdF9fSU5TUEVDVE9SX0FDVElPTlNfTUFQX19bJ3Njcm9sbHRvJ10gPSAoeyBidWlsZGVyLCBlbCB9KSA9PiB7XHJcblx0XHRpZiAoICFlbCB8fCAhZG9jdW1lbnQuYm9keS5jb250YWlucyggZWwgKSApIHJldHVybjtcclxuXHRcdGJ1aWxkZXI/LnNlbGVjdF9maWVsZD8uKCBlbCwgeyBzY3JvbGxJbnRvVmlldzogdHJ1ZSB9ICk7XHJcblx0XHRlbC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX3Njcm9sbC1wdWxzZScgKTtcclxuXHRcdHNldFRpbWVvdXQoICgpID0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fc2Nyb2xsLXB1bHNlJyApLCA3MDAgKTtcclxuXHR9O1xyXG5cclxuXHRfX0lOU1BFQ1RPUl9BQ1RJT05TX01BUF9fWydtb3ZlLXVwJ10gPSAoeyBidWlsZGVyLCBlbCB9KSA9PiB7XHJcblx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHRcdGJ1aWxkZXI/Lm1vdmVfaXRlbT8uKCBlbCwgJ3VwJyApO1xyXG5cdFx0Ly8gU2Nyb2xsIGFmdGVyIHRoZSBET00gaGFzIHNldHRsZWQuXHJcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4gX19JTlNQRUNUT1JfQUNUSU9OU19NQVBfX1snc2Nyb2xsdG8nXSh7IGJ1aWxkZXIsIGVsIH0pKTtcclxuXHR9O1xyXG5cclxuXHRfX0lOU1BFQ1RPUl9BQ1RJT05TX01BUF9fWydtb3ZlLWRvd24nXSA9ICh7IGJ1aWxkZXIsIGVsIH0pID0+IHtcclxuXHRcdGlmICggIWVsICkgcmV0dXJuO1xyXG5cdFx0YnVpbGRlcj8ubW92ZV9pdGVtPy4oIGVsLCAnZG93bicgKTtcclxuXHRcdC8vIFNjcm9sbCBhZnRlciB0aGUgRE9NIGhhcyBzZXR0bGVkLlxyXG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IF9fSU5TUEVDVE9SX0FDVElPTlNfTUFQX19bJ3Njcm9sbHRvJ10oeyBidWlsZGVyLCBlbCB9KSk7XHJcblx0fTtcclxuXHJcblx0X19JTlNQRUNUT1JfQUNUSU9OU19NQVBfX1snZGVsZXRlJ10gPSAoeyBidWlsZGVyLCBlbCwgY29uZmlybSA9IHcuY29uZmlybSB9KSA9PiB7XHJcblx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHRcdGNvbnN0IGlzX2ZpZWxkID0gZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0Y29uc3QgbGFiZWwgICAgPSBpc19maWVsZFxyXG5cdFx0XHQ/IChlbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19maWVsZC1sYWJlbCcgKT8udGV4dENvbnRlbnQgfHwgZWwuZGF0YXNldD8uaWQgfHwgJ2ZpZWxkJylcclxuXHRcdFx0OiAoZWwuZGF0YXNldD8uaWQgfHwgJ3NlY3Rpb24nKTtcclxuXHJcblx0XHRVSS5Nb2RhbF9Db25maXJtX0RlbGV0ZS5vcGVuKCBsYWJlbCwgKCkgPT4ge1xyXG5cdFx0XHQvLyBDZW50cmFsIGNvbW1hbmQgd2lsbCByZW1vdmUsIGVtaXQgZXZlbnRzLCBhbmQgcmVzZWxlY3QgbmVpZ2hib3IgKHdoaWNoIHJlLWJpbmRzIEluc3BlY3RvcikuXHJcblx0XHRcdGJ1aWxkZXI/LmRlbGV0ZV9pdGVtPy4oIGVsICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdH07XHJcblxyXG5cdF9fSU5TUEVDVE9SX0FDVElPTlNfTUFQX19bJ2R1cGxpY2F0ZSddID0gKHsgYnVpbGRlciwgZWwgfSkgPT4ge1xyXG5cdFx0aWYgKCAhZWwgKSByZXR1cm47XHJcblx0XHRjb25zdCBjbG9uZSA9IGJ1aWxkZXI/LmR1cGxpY2F0ZV9pdGVtPy4oIGVsICk7XHJcblx0XHRpZiAoIGNsb25lICkgYnVpbGRlcj8uc2VsZWN0X2ZpZWxkPy4oIGNsb25lLCB7IHNjcm9sbEludG9WaWV3OiB0cnVlIH0gKTtcclxuXHR9O1xyXG5cclxuXHQvLyBQdWJsaWMgQVBJLlxyXG5cdHcuV1BCQ19CRkJfSW5zcGVjdG9yX0FjdGlvbnMgPSB7XHJcblx0XHRydW4obmFtZSwgY3R4KSB7XHJcblx0XHRcdGNvbnN0IGZuID0gX19JTlNQRUNUT1JfQUNUSU9OU19NQVBfX1tuYW1lXTtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgKSBmbiggY3R4ICk7XHJcblx0XHRcdGVsc2UgY29uc29sZS53YXJuKCAnV1BCQy4gSW5zcGVjdG9yIGFjdGlvbiBub3QgZm91bmQ6JywgbmFtZSApO1xyXG5cdFx0fSxcclxuXHRcdHJlZ2lzdGVyKG5hbWUsIGhhbmRsZXIpIHtcclxuXHRcdFx0aWYgKCAhbmFtZSB8fCB0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoICdyZWdpc3RlcihuYW1lLCBoYW5kbGVyKTogaW52YWxpZCBhcmd1bWVudHMnICk7XHJcblx0XHRcdH1cclxuXHRcdFx0X19JTlNQRUNUT1JfQUNUSU9OU19NQVBfX1tuYW1lXSA9IGhhbmRsZXI7XHJcblx0XHR9LFxyXG5cdFx0aGFzKG5hbWUpIHtcclxuXHRcdFx0cmV0dXJuIHR5cGVvZiBfX0lOU1BFQ1RPUl9BQ1RJT05TX01BUF9fW25hbWVdID09PSAnZnVuY3Rpb24nO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIDIpIEluc3BlY3RvciBGYWN0b3J5LlxyXG5cclxuXHR2YXIgVUkgPSAody5XUEJDX0JGQl9Db3JlLlVJID0gdy5XUEJDX0JGQl9Db3JlLlVJIHx8IHt9KTtcclxuXHJcblx0Ly8gR2xvYmFsIEh5YnJpZCsrIHJlZ2lzdHJpZXMgKGtlZXAgcHVibGljKS5cclxuXHR3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3Nsb3RzICAgICAgPSB3LndwYmNfYmZiX2luc3BlY3Rvcl9mYWN0b3J5X3Nsb3RzIHx8IHt9O1xyXG5cdHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3RvcnlfdmFsdWVfZnJvbSA9IHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3RvcnlfdmFsdWVfZnJvbSB8fCB7fTtcclxuXHJcblx0Ly8gRGVmaW5lIEZhY3Rvcnkgb25seSBpZiBtaXNzaW5nIChubyBlYXJseSByZXR1cm4gZm9yIHRoZSB3aG9sZSBidW5kbGUpLlxyXG5cdC8vIGFsd2F5cyBkZWZpbmUvcmVwbGFjZSBGYWN0b3J5XHJcblx0e1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVXRpbGl0eTogY3JlYXRlIGVsZW1lbnQgd2l0aCBhdHRyaWJ1dGVzIGFuZCBjaGlsZHJlbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGFnXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdD19IGF0dHJzXHJcblx0XHQgKiBAcGFyYW0geyhOb2RlfHN0cmluZ3xBcnJheTxOb2RlfHN0cmluZz4pPX0gY2hpbGRyZW5cclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gZWwodGFnLCBhdHRycywgY2hpbGRyZW4pIHtcclxuXHRcdFx0dmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCB0YWcgKTtcclxuXHRcdFx0aWYgKCBhdHRycyApIHtcclxuXHRcdFx0XHRPYmplY3Qua2V5cyggYXR0cnMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoaykge1xyXG5cdFx0XHRcdFx0dmFyIHYgPSBhdHRyc1trXTtcclxuXHRcdFx0XHRcdGlmICggdiA9PSBudWxsICkgcmV0dXJuO1xyXG5cdFx0XHRcdFx0aWYgKCBrID09PSAnY2xhc3MnICkge1xyXG5cdFx0XHRcdFx0XHRub2RlLmNsYXNzTmFtZSA9IHY7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggayA9PT0gJ2RhdGFzZXQnICkge1xyXG5cdFx0XHRcdFx0XHRPYmplY3Qua2V5cyggdiApLmZvckVhY2goIGZ1bmN0aW9uIChkaykge1xyXG5cdFx0XHRcdFx0XHRcdG5vZGUuZGF0YXNldFtka10gPSBTdHJpbmcoIHZbZGtdICk7XHJcblx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBrID09PSAnY2hlY2tlZCcgJiYgdHlwZW9mIHYgPT09ICdib29sZWFuJyApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCB2ICkgbm9kZS5zZXRBdHRyaWJ1dGUoICdjaGVja2VkJywgJ2NoZWNrZWQnICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggayA9PT0gJ2Rpc2FibGVkJyAmJiB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHYgKSBub2RlLnNldEF0dHJpYnV0ZSggJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQvLyBub3JtYWxpemUgYm9vbGVhbiBhdHRyaWJ1dGVzIHRvIHN0cmluZ3MuXHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB2ID09PSAnYm9vbGVhbicgKSB7XHJcblx0XHRcdFx0XHRcdG5vZGUuc2V0QXR0cmlidXRlKCBrLCB2ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZSggaywgU3RyaW5nKCB2ICkgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBjaGlsZHJlbiApIHtcclxuXHRcdFx0XHQoQXJyYXkuaXNBcnJheSggY2hpbGRyZW4gKSA/IGNoaWxkcmVuIDogWyBjaGlsZHJlbiBdKS5mb3JFYWNoKCBmdW5jdGlvbiAoYykge1xyXG5cdFx0XHRcdFx0aWYgKCBjID09IG51bGwgKSByZXR1cm47XHJcblx0XHRcdFx0XHRub2RlLmFwcGVuZENoaWxkKCAodHlwZW9mIGMgPT09ICdzdHJpbmcnKSA/IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCBjICkgOiBjICk7XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBub2RlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQnVpbGQgYSB0b2dnbGUgY29udHJvbCByb3cgKGNoZWNrYm94IHJlbmRlcmVkIGFzIHRvZ2dsZSkuXHJcblx0XHQgKlxyXG5cdFx0ICogU3RydWN0dXJlOlxyXG5cdFx0ICogPGRpdiBjbGFzcz1cImluc3BlY3Rvcl9fcm93IGluc3BlY3Rvcl9fcm93LS10b2dnbGVcIj5cclxuXHRcdCAqICAgPGRpdiBjbGFzcz1cImluc3BlY3Rvcl9fY29udHJvbCB3cGJjX3VpX190b2dnbGVcIj5cclxuXHRcdCAqICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJJRFwiIGRhdGEtaW5zcGVjdG9yLWtleT1cIktFWVwiIGNsYXNzPVwiaW5zcGVjdG9yX19pbnB1dFwiIGNoZWNrZWQ+XHJcblx0XHQgKiAgICAgPGxhYmVsIGNsYXNzPVwid3BiY191aV9fdG9nZ2xlX2ljb25cIiAgZm9yPVwiSURcIj48L2xhYmVsPlxyXG5cdFx0ICogICAgIDxsYWJlbCBjbGFzcz1cIndwYmNfdWlfX3RvZ2dsZV9sYWJlbFwiIGZvcj1cIklEXCI+TGFiZWwgdGV4dDwvbGFiZWw+XHJcblx0XHQgKiAgIDwvZGl2PlxyXG5cdFx0ICogPC9kaXY+XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGlucHV0X2lkXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5XHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGNoZWNrZWRcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBsYWJlbF90ZXh0XHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGJ1aWxkX3RvZ2dsZV9yb3coIGlucHV0X2lkLCBrZXksIGNoZWNrZWQsIGxhYmVsX3RleHQgKSB7XHJcblxyXG5cdFx0XHR2YXIgcm93X2VsICAgID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX3JvdyBpbnNwZWN0b3JfX3Jvdy0tdG9nZ2xlJyB9ICk7XHJcblx0XHRcdHZhciBjdHJsX3dyYXAgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ2luc3BlY3Rvcl9fY29udHJvbCB3cGJjX3VpX190b2dnbGUnIH0gKTtcclxuXHJcblx0XHRcdHZhciBpbnB1dF9lbCA9IGVsKCAnaW5wdXQnLCB7XHJcblx0XHRcdFx0aWQgICAgICAgICAgICAgICAgICA6IGlucHV0X2lkLFxyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgICAgICAgOiAnY2hlY2tib3gnLFxyXG5cdFx0XHRcdCdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksXHJcblx0XHRcdFx0J2NsYXNzJyAgICAgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0JyxcclxuXHRcdFx0XHRjaGVja2VkICAgICAgICAgICAgIDogISFjaGVja2VkLFxyXG5cdFx0XHRcdHJvbGUgICAgICAgICAgICAgICAgOiAnc3dpdGNoJyxcclxuXHRcdFx0XHQnYXJpYS1jaGVja2VkJyAgICAgIDogISFjaGVja2VkXHJcblx0XHRcdH0gKTtcclxuXHRcdFx0dmFyIGljb25fbGJsID0gZWwoICdsYWJlbCcsIHsgJ2NsYXNzJzogJ3dwYmNfdWlfX3RvZ2dsZV9pY29uJywgJ2Zvcic6IGlucHV0X2lkIH0gKTtcclxuXHRcdFx0dmFyIHRleHRfbGJsID0gZWwoICdsYWJlbCcsIHsgJ2NsYXNzJzogJ3dwYmNfdWlfX3RvZ2dsZV9sYWJlbCcsICdmb3InOiBpbnB1dF9pZCB9LCBsYWJlbF90ZXh0IHx8ICcnICk7XHJcblxyXG5cdFx0XHRjdHJsX3dyYXAuYXBwZW5kQ2hpbGQoIGlucHV0X2VsICk7XHJcblx0XHRcdGN0cmxfd3JhcC5hcHBlbmRDaGlsZCggaWNvbl9sYmwgKTtcclxuXHRcdFx0Y3RybF93cmFwLmFwcGVuZENoaWxkKCB0ZXh0X2xibCApO1xyXG5cclxuXHRcdFx0cm93X2VsLmFwcGVuZENoaWxkKCBjdHJsX3dyYXAgKTtcclxuXHRcdFx0cmV0dXJuIHJvd19lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHQgKiBVdGlsaXR5OiBjaG9vc2UgaW5pdGlhbCB2YWx1ZSBmcm9tIGRhdGEgb3Igc2NoZW1hIGRlZmF1bHQuXHJcblx0ICovXHJcblx0XHRmdW5jdGlvbiBnZXRfaW5pdGlhbF92YWx1ZShrZXksIGRhdGEsIHByb3BzX3NjaGVtYSkge1xyXG5cdFx0XHRpZiAoIGRhdGEgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBkYXRhLCBrZXkgKSApIHJldHVybiBkYXRhW2tleV07XHJcblx0XHRcdHZhciBtZXRhID0gcHJvcHNfc2NoZW1hICYmIHByb3BzX3NjaGVtYVtrZXldO1xyXG5cdFx0XHRyZXR1cm4gKG1ldGEgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBtZXRhLCAnZGVmYXVsdCcgKSkgPyBtZXRhLmRlZmF1bHQgOiAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHQgKiBVdGlsaXR5OiBjb2VyY2UgdmFsdWUgYnkgc2NoZW1hIHR5cGUuXHJcblx0ICovXHJcblxyXG5cclxuXHRcdGZ1bmN0aW9uIGNvZXJjZV9ieV90eXBlKHZhbHVlLCB0eXBlKSB7XHJcblx0XHRcdHN3aXRjaCAoIHR5cGUgKSB7XHJcblx0XHRcdFx0Y2FzZSAnbnVtYmVyJzpcclxuXHRcdFx0XHRjYXNlICdpbnQnOlxyXG5cdFx0XHRcdGNhc2UgJ2Zsb2F0JzpcclxuXHRcdFx0XHRcdGlmICggdmFsdWUgPT09ICcnIHx8IHZhbHVlID09IG51bGwgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiAnJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHZhciBuID0gTnVtYmVyKCB2YWx1ZSApO1xyXG5cdFx0XHRcdFx0cmV0dXJuIGlzTmFOKCBuICkgPyAnJyA6IG47XHJcblx0XHRcdFx0Y2FzZSAnYm9vbGVhbic6XHJcblx0XHRcdFx0XHRyZXR1cm4gISF2YWx1ZTtcclxuXHRcdFx0XHRjYXNlICdhcnJheSc6XHJcblx0XHRcdFx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheSggdmFsdWUgKSA/IHZhbHVlIDogW107XHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRcdHJldHVybiAodmFsdWUgPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggdmFsdWUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdCAqIE5vcm1hbGl6ZSA8c2VsZWN0PiBvcHRpb25zIChhcnJheSBvZiB7dmFsdWUsbGFiZWx9IG9yIG1hcCB7dmFsdWU6bGFiZWx9KS5cclxuXHQgKi9cclxuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zZWxlY3Rfb3B0aW9ucyhvcHRpb25zKSB7XHJcblx0XHRcdGlmICggQXJyYXkuaXNBcnJheSggb3B0aW9ucyApICkge1xyXG5cdFx0XHRcdHJldHVybiBvcHRpb25zLm1hcCggZnVuY3Rpb24gKG8pIHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIG8gJiYgJ3ZhbHVlJyBpbiBvICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogU3RyaW5nKCBvLnZhbHVlICksIGxhYmVsOiBTdHJpbmcoIG8ubGFiZWwgfHwgby52YWx1ZSApIH07XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogU3RyaW5nKCBvICksIGxhYmVsOiBTdHJpbmcoIG8gKSB9O1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnICkge1xyXG5cdFx0XHRcdHJldHVybiBPYmplY3Qua2V5cyggb3B0aW9ucyApLm1hcCggZnVuY3Rpb24gKGspIHtcclxuXHRcdFx0XHRcdHJldHVybiB7IHZhbHVlOiBTdHJpbmcoIGsgKSwgbGFiZWw6IFN0cmluZyggb3B0aW9uc1trXSApIH07XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBbXTtcclxuXHRcdH1cclxuXHJcblx0XHQvKiogUGFyc2UgYSBDU1MgbGVuZ3RoIGxpa2UgXCIxMjBweFwiIG9yIFwiODAlXCIgaW50byB7IHZhbHVlOm51bWJlciwgdW5pdDpzdHJpbmcgfS4gKi9cclxuXHRcdGZ1bmN0aW9uIHBhcnNlX2xlbih2YWx1ZSwgZmFsbGJhY2tfdW5pdCkge1xyXG5cdFx0XHR2YWx1ZSA9ICh2YWx1ZSA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCB2YWx1ZSApLnRyaW0oKTtcclxuXHRcdFx0dmFyIG0gPSB2YWx1ZS5tYXRjaCggL14oLT9cXGQrKD86XFwuXFxkKyk/KShweHwlfHJlbXxlbSkkL2kgKTtcclxuXHRcdFx0aWYgKCBtICkge1xyXG5cdFx0XHRcdHJldHVybiB7IHZhbHVlOiBwYXJzZUZsb2F0KCBtWzFdICksIHVuaXQ6IG1bMl0udG9Mb3dlckNhc2UoKSB9O1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIHBsYWluIG51bWJlciAtPiBhc3N1bWUgZmFsbGJhY2sgdW5pdFxyXG5cdFx0XHRpZiAoIHZhbHVlICE9PSAnJyAmJiAhaXNOYU4oIE51bWJlciggdmFsdWUgKSApICkge1xyXG5cdFx0XHRcdHJldHVybiB7IHZhbHVlOiBOdW1iZXIoIHZhbHVlICksIHVuaXQ6IChmYWxsYmFja191bml0IHx8ICdweCcpIH07XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHsgdmFsdWU6IDAsIHVuaXQ6IChmYWxsYmFja191bml0IHx8ICdweCcpIH07XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqIENsYW1wIGhlbHBlci4gKi9cclxuXHRcdGZ1bmN0aW9uIGNsYW1wX251bSh2LCBtaW4sIG1heCkge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB2ICE9PSAnbnVtYmVyJyB8fCBpc05hTiggdiApICkgcmV0dXJuIChtaW4gIT0gbnVsbCA/IG1pbiA6IDApO1xyXG5cdFx0XHRpZiAoIG1pbiAhPSBudWxsICYmIHYgPCBtaW4gKSB2ID0gbWluO1xyXG5cdFx0XHRpZiAoIG1heCAhPSBudWxsICYmIHYgPiBtYXggKSB2ID0gbWF4O1xyXG5cdFx0XHRyZXR1cm4gdjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBJbml0aWFsaXplIENvbG9yaXMgcGlja2VycyBpbiBhIGdpdmVuIHJvb3QuXHJcblx0XHQvLyBSZWxpZXMgb24gQ29sb3JpcyBiZWluZyBlbnF1ZXVlZCAoc2VlIGJmYi1ib290c3RyYXAucGhwKS5cclxuXHRcdGZ1bmN0aW9uIGluaXRfY29sb3Jpc19waWNrZXJzKHJvb3QpIHtcclxuXHRcdFx0aWYgKCAhcm9vdCB8fCAhdy5Db2xvcmlzICkgcmV0dXJuO1xyXG5cdFx0XHQvLyBNYXJrIGlucHV0cyB3ZSB3YW50IENvbG9yaXMgdG8gaGFuZGxlLlxyXG5cdFx0XHR2YXIgaW5wdXRzID0gcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnaW5wdXRbZGF0YS1pbnNwZWN0b3ItdHlwZT1cImNvbG9yXCJdJyApO1xyXG5cdFx0XHRpZiAoICFpbnB1dHMubGVuZ3RoICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gQWRkIGEgc3RhYmxlIGNsYXNzIGZvciBDb2xvcmlzIHRhcmdldGluZzsgYXZvaWQgZG91YmxlLWluaXRpYWxpemluZy5cclxuXHRcdFx0aW5wdXRzLmZvckVhY2goIGZ1bmN0aW9uIChpbnB1dCkge1xyXG5cdFx0XHRcdGlmICggaW5wdXQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfY29sb3JpcycgKSApIHJldHVybjtcclxuXHRcdFx0XHRpbnB1dC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfY29sb3JpcycgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQ3JlYXRlL3JlZnJlc2ggYSBDb2xvcmlzIGluc3RhbmNlIGJvdW5kIHRvIHRoZXNlIGlucHV0cy5cclxuXHRcdFx0Ly8gS2VlcCBIRVggb3V0cHV0IHRvIG1hdGNoIHNjaGVtYSBkZWZhdWx0cyAoZS5nLiwgXCIjZTBlMGUwXCIpLlxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHcuQ29sb3Jpcygge1xyXG5cdFx0XHRcdFx0ZWwgICAgICAgOiAnLndwYmNfYmZiX2NvbG9yaXMnLFxyXG5cdFx0XHRcdFx0YWxwaGEgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRcdGZvcm1hdCAgIDogJ2hleCcsXHJcblx0XHRcdFx0XHR0aGVtZU1vZGU6ICdhdXRvJ1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHQvLyBDb2xvcmlzIGFscmVhZHkgZGlzcGF0Y2hlcyAnaW5wdXQnIGV2ZW50cyBvbiB2YWx1ZSBjaGFuZ2VzLlxyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHQvLyBOb24tZmF0YWw6IGlmIENvbG9yaXMgdGhyb3dzIChyYXJlKSwgdGhlIHRleHQgaW5wdXQgc3RpbGwgd29ya3MuXHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnV1BCQyBJbnNwZWN0b3I6IENvbG9yaXMgaW5pdCBmYWlsZWQ6JywgZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZDogc2xpZGVyICsgbnVtYmVyIGluIG9uZSByb3cgKHdyaXRlcyB0byBhIHNpbmdsZSBkYXRhIGtleSkuXHJcblx0XHQgKiBDb250cm9sIG1ldGE6IHsgdHlwZToncmFuZ2VfbnVtYmVyJywga2V5LCBsYWJlbCwgbWluLCBtYXgsIHN0ZXAgfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBidWlsZF9yYW5nZV9udW1iZXJfcm93KGlucHV0X2lkLCBrZXksIGxhYmVsX3RleHQsIHZhbHVlLCBtZXRhKSB7XHJcblx0XHRcdHZhciByb3dfZWwgICA9IGVsKCdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX3JvdycgfSk7XHJcblx0XHRcdHZhciBsYWJlbF9lbCA9IGVsKCdsYWJlbCcsIHsgJ2Zvcic6IGlucHV0X2lkLCAnY2xhc3MnOiAnaW5zcGVjdG9yX19sYWJlbCcgfSwgbGFiZWxfdGV4dCB8fCBrZXkgfHwgJycpO1xyXG5cdFx0XHR2YXIgY3RybCAgICAgPSBlbCgnZGl2JywgeyAnY2xhc3MnOiAnaW5zcGVjdG9yX19jb250cm9sJyB9KTtcclxuXHJcblx0XHRcdHZhciBtaW4gID0gKG1ldGEgJiYgbWV0YS5taW4gIT0gbnVsbCkgID8gbWV0YS5taW4gIDogMDtcclxuXHRcdFx0dmFyIG1heCAgPSAobWV0YSAmJiBtZXRhLm1heCAhPSBudWxsKSAgPyBtZXRhLm1heCAgOiAxMDA7XHJcblx0XHRcdHZhciBzdGVwID0gKG1ldGEgJiYgbWV0YS5zdGVwICE9IG51bGwpID8gbWV0YS5zdGVwIDogMTtcclxuXHJcblx0XHRcdHZhciBncm91cCA9IGVsKCdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2xlbl9ncm91cCB3cGJjX2lubGluZV9pbnB1dHMnLCAnZGF0YS1sZW4tZ3JvdXAnOiBrZXkgfSk7XHJcblxyXG5cdFx0XHR2YXIgcmFuZ2UgPSBlbCgnaW5wdXQnLCB7XHJcblx0XHRcdFx0dHlwZSA6ICdyYW5nZScsXHJcblx0XHRcdFx0J2NsYXNzJzogJ2luc3BlY3Rvcl9faW5wdXQnLFxyXG5cdFx0XHRcdCdkYXRhLWxlbi1yYW5nZSc6ICcnLFxyXG5cdFx0XHRcdG1pbiAgOiBTdHJpbmcobWluKSxcclxuXHRcdFx0XHRtYXggIDogU3RyaW5nKG1heCksXHJcblx0XHRcdFx0c3RlcCA6IFN0cmluZyhzdGVwKSxcclxuXHRcdFx0XHR2YWx1ZTogU3RyaW5nKHZhbHVlID09IG51bGwgfHwgdmFsdWUgPT09ICcnID8gbWluIDogdmFsdWUpXHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0dmFyIG51bSA9IGVsKCdpbnB1dCcsIHtcclxuXHRcdFx0XHRpZCAgIDogaW5wdXRfaWQsXHJcblx0XHRcdFx0dHlwZSA6ICdudW1iZXInLFxyXG5cdFx0XHRcdCdjbGFzcyc6ICdpbnNwZWN0b3JfX2lucHV0IGluc3BlY3Rvcl9fd18zMCcsXHJcblx0XHRcdFx0J2RhdGEtbGVuLXZhbHVlJzogJycsXHJcblx0XHRcdFx0J2RhdGEtaW5zcGVjdG9yLWtleSc6IGtleSxcclxuXHRcdFx0XHRtaW4gIDogU3RyaW5nKG1pbiksXHJcblx0XHRcdFx0bWF4ICA6IFN0cmluZyhtYXgpLFxyXG5cdFx0XHRcdHN0ZXAgOiBTdHJpbmcoc3RlcCksXHJcblx0XHRcdFx0dmFsdWU6ICh2YWx1ZSA9PSBudWxsIHx8IHZhbHVlID09PSAnJykgPyBTdHJpbmcobWluKSA6IFN0cmluZyh2YWx1ZSlcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRncm91cC5hcHBlbmRDaGlsZChyYW5nZSk7XHJcblx0XHRcdGdyb3VwLmFwcGVuZENoaWxkKG51bSk7XHJcblx0XHRcdGN0cmwuYXBwZW5kQ2hpbGQoZ3JvdXApO1xyXG5cdFx0XHRyb3dfZWwuYXBwZW5kQ2hpbGQobGFiZWxfZWwpO1xyXG5cdFx0XHRyb3dfZWwuYXBwZW5kQ2hpbGQoY3RybCk7XHJcblx0XHRcdHJldHVybiByb3dfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZDogKG51bWJlciArIHVuaXQpICsgc2xpZGVyLCB3cml0aW5nIGEgKnNpbmdsZSogY29tYmluZWQgc3RyaW5nIHRvIGBrZXlgLlxyXG5cdFx0ICogQ29udHJvbCBtZXRhOlxyXG5cdFx0ICoge1xyXG5cdFx0ICogICB0eXBlOidsZW4nLCBrZXksIGxhYmVsLCB1bml0czpbJ3B4JywnJScsJ3JlbScsJ2VtJ10sXHJcblx0XHQgKiAgIHNsaWRlcjogeyBweDp7bWluOjAsbWF4OjUxMixzdGVwOjF9LCAnJSc6e21pbjowLG1heDoxMDAsc3RlcDoxfSwgcmVtOnttaW46MCxtYXg6MTAsc3RlcDowLjF9LCBlbTp7Li4ufSB9LFxyXG5cdFx0ICogICBmYWxsYmFja191bml0OidweCdcclxuXHRcdCAqIH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gYnVpbGRfbGVuX2NvbXBvdW5kX3Jvdyhjb250cm9sLCBwcm9wc19zY2hlbWEsIGRhdGEsIHVpZCkge1xyXG5cdFx0XHR2YXIga2V5ICAgICAgICA9IGNvbnRyb2wua2V5O1xyXG5cdFx0XHR2YXIgbGFiZWxfdGV4dCA9IGNvbnRyb2wubGFiZWwgfHwga2V5IHx8ICcnO1xyXG5cdFx0XHR2YXIgZGVmX3N0ciAgICA9IGdldF9pbml0aWFsX3ZhbHVlKCBrZXksIGRhdGEsIHByb3BzX3NjaGVtYSApO1xyXG5cdFx0XHR2YXIgZmFsbGJhY2tfdSA9IGNvbnRyb2wuZmFsbGJhY2tfdW5pdCB8fCAncHgnO1xyXG5cdFx0XHR2YXIgcGFyc2VkICAgICA9IHBhcnNlX2xlbiggZGVmX3N0ciwgZmFsbGJhY2tfdSApO1xyXG5cclxuXHRcdFx0dmFyIHJvdyAgID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX3JvdycgfSApO1xyXG5cdFx0XHR2YXIgbGFiZWwgPSBlbCggJ2xhYmVsJywgeyAnY2xhc3MnOiAnaW5zcGVjdG9yX19sYWJlbCcgfSwgbGFiZWxfdGV4dCApO1xyXG5cdFx0XHR2YXIgY3RybCAgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ2luc3BlY3Rvcl9fY29udHJvbCcgfSApO1xyXG5cclxuXHRcdFx0dmFyIHVuaXRzICAgICAgPSBBcnJheS5pc0FycmF5KCBjb250cm9sLnVuaXRzICkgJiYgY29udHJvbC51bml0cy5sZW5ndGggPyBjb250cm9sLnVuaXRzIDogWyAncHgnLCAnJScsICdyZW0nLCAnZW0nIF07XHJcblx0XHRcdHZhciBzbGlkZXJfbWFwID0gY29udHJvbC5zbGlkZXIgfHwge1xyXG5cdFx0XHRcdCdweCcgOiB7IG1pbjogMCwgbWF4OiA1MTIsIHN0ZXA6IDEgfSxcclxuXHRcdFx0XHQnJScgIDogeyBtaW46IDAsIG1heDogMTAwLCBzdGVwOiAxIH0sXHJcblx0XHRcdFx0J3JlbSc6IHsgbWluOiAwLCBtYXg6IDEwLCBzdGVwOiAwLjEgfSxcclxuXHRcdFx0XHQnZW0nIDogeyBtaW46IDAsIG1heDogMTAsIHN0ZXA6IDAuMSB9XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvLyBIb3N0IHdpdGggYSBoaWRkZW4gaW5wdXQgdGhhdCBjYXJyaWVzIGRhdGEtaW5zcGVjdG9yLWtleSB0byByZXVzZSB0aGUgc3RhbmRhcmQgaGFuZGxlci5cclxuXHRcdFx0dmFyIGdyb3VwID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2xlbl9ncm91cCcsICdkYXRhLWxlbi1ncm91cCc6IGtleSB9ICk7XHJcblxyXG5cdFx0XHR2YXIgaW5saW5lID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2lubGluZV9pbnB1dHMnIH0gKTtcclxuXHJcblx0XHRcdHZhciBudW0gPSBlbCggJ2lucHV0Jywge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgICA6ICdudW1iZXInLFxyXG5cdFx0XHRcdCdjbGFzcycgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0JyxcclxuXHRcdFx0XHQnZGF0YS1sZW4tdmFsdWUnOiAnJyxcclxuXHRcdFx0XHRtaW4gICAgICAgICAgICAgOiAnMCcsXHJcblx0XHRcdFx0c3RlcCAgICAgICAgICAgIDogJ2FueScsXHJcblx0XHRcdFx0dmFsdWUgICAgICAgICAgIDogU3RyaW5nKCBwYXJzZWQudmFsdWUgKVxyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHR2YXIgc2VsID0gZWwoICdzZWxlY3QnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX2lucHV0JywgJ2RhdGEtbGVuLXVuaXQnOiAnJyB9ICk7XHJcblx0XHRcdHVuaXRzLmZvckVhY2goIGZ1bmN0aW9uICh1KSB7XHJcblx0XHRcdFx0dmFyIG9wdCA9IGVsKCAnb3B0aW9uJywgeyB2YWx1ZTogdSB9LCB1ICk7XHJcblx0XHRcdFx0aWYgKCB1ID09PSBwYXJzZWQudW5pdCApIG9wdC5zZXRBdHRyaWJ1dGUoICdzZWxlY3RlZCcsICdzZWxlY3RlZCcgKTtcclxuXHRcdFx0XHRzZWwuYXBwZW5kQ2hpbGQoIG9wdCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRpbmxpbmUuYXBwZW5kQ2hpbGQoIG51bSApO1xyXG5cdFx0XHRpbmxpbmUuYXBwZW5kQ2hpbGQoIHNlbCApO1xyXG5cclxuXHRcdFx0Ly8gU2xpZGVyICh1bml0LWF3YXJlKVxyXG5cdFx0XHR2YXIgY3VycmVudCA9IHNsaWRlcl9tYXBbcGFyc2VkLnVuaXRdIHx8IHNsaWRlcl9tYXBbdW5pdHNbMF1dO1xyXG5cdFx0XHR2YXIgcmFuZ2UgICA9IGVsKCAnaW5wdXQnLCB7XHJcblx0XHRcdFx0dHlwZSAgICAgICAgICAgIDogJ3JhbmdlJyxcclxuXHRcdFx0XHQnY2xhc3MnICAgICAgICAgOiAnaW5zcGVjdG9yX19pbnB1dCcsXHJcblx0XHRcdFx0J2RhdGEtbGVuLXJhbmdlJzogJycsXHJcblx0XHRcdFx0bWluICAgICAgICAgICAgIDogU3RyaW5nKCBjdXJyZW50Lm1pbiApLFxyXG5cdFx0XHRcdG1heCAgICAgICAgICAgICA6IFN0cmluZyggY3VycmVudC5tYXggKSxcclxuXHRcdFx0XHRzdGVwICAgICAgICAgICAgOiBTdHJpbmcoIGN1cnJlbnQuc3RlcCApLFxyXG5cdFx0XHRcdHZhbHVlICAgICAgICAgICA6IFN0cmluZyggY2xhbXBfbnVtKCBwYXJzZWQudmFsdWUsIGN1cnJlbnQubWluLCBjdXJyZW50Lm1heCApIClcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gSGlkZGVuIHdyaXRlciBpbnB1dCB0aGF0IHRoZSBkZWZhdWx0IEluc3BlY3RvciBoYW5kbGVyIHdpbGwgY2F0Y2guXHJcblx0XHRcdHZhciBoaWRkZW4gPSBlbCggJ2lucHV0Jywge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgICAgICAgICAgOiAndGV4dCcsXHJcblx0XHRcdFx0J2NsYXNzJyAgICAgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0JyxcclxuXHRcdFx0XHRzdHlsZSAgICAgICAgICAgICAgIDogJ2Rpc3BsYXk6bm9uZScsXHJcblx0XHRcdFx0J2FyaWEtaGlkZGVuJyAgICAgICA6ICd0cnVlJyxcclxuXHRcdFx0XHR0YWJpbmRleCAgICAgICAgICAgIDogJy0xJyxcclxuXHRcdFx0XHRpZCAgICAgICAgICAgICAgICAgIDogJ3dwYmNfaW5zXycgKyBrZXkgKyAnXycgKyB1aWQgKyAnX2xlbl9oaWRkZW4nLFxyXG5cdFx0XHRcdCdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksXHJcblx0XHRcdFx0dmFsdWUgICAgICAgICAgICAgICA6IChTdHJpbmcoIHBhcnNlZC52YWx1ZSApICsgcGFyc2VkLnVuaXQpXHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGdyb3VwLmFwcGVuZENoaWxkKCBpbmxpbmUgKTtcclxuXHRcdFx0Z3JvdXAuYXBwZW5kQ2hpbGQoIHJhbmdlICk7XHJcblx0XHRcdGdyb3VwLmFwcGVuZENoaWxkKCBoaWRkZW4gKTtcclxuXHJcblx0XHRcdGN0cmwuYXBwZW5kQ2hpbGQoIGdyb3VwICk7XHJcblx0XHRcdHJvdy5hcHBlbmRDaGlsZCggbGFiZWwgKTtcclxuXHRcdFx0cm93LmFwcGVuZENoaWxkKCBjdHJsICk7XHJcblx0XHRcdHJldHVybiByb3c7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBXaXJlIHN5bmNpbmcgZm9yIGFueSAud3BiY19sZW5fZ3JvdXAgaW5zaWRlIGEgZ2l2ZW4gcm9vdCAocGFuZWwpLlxyXG5cdFx0ICogLSByYW5nZSDih4QgbnVtYmVyIHN5bmNcclxuXHRcdCAqIC0gdW5pdCBzd2l0Y2hlcyB1cGRhdGUgc2xpZGVyIGJvdW5kc1xyXG5cdFx0ICogLSBoaWRkZW4gd3JpdGVyIChpZiBwcmVzZW50KSBnZXRzIHVwZGF0ZWQgYW5kIGVtaXRzICdpbnB1dCdcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd2lyZV9sZW5fZ3JvdXAocm9vdCkge1xyXG5cdFx0XHRpZiAoICFyb290ICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0ZnVuY3Rpb24gZmluZF9ncm91cChlbCkge1xyXG5cdFx0XHRcdHJldHVybiBlbCAmJiBlbC5jbG9zZXN0ICYmIGVsLmNsb3Nlc3QoICcud3BiY19sZW5fZ3JvdXAnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0XHR2YXIgdCA9IGUudGFyZ2V0O1xyXG5cdFx0XHRcdC8vIFNsaWRlciBtb3ZlZCAtPiB1cGRhdGUgbnVtYmVyIChhbmQgd3JpdGVyL2hpZGRlbilcclxuXHRcdFx0XHRpZiAoIHQgJiYgdC5oYXNBdHRyaWJ1dGUoICdkYXRhLWxlbi1yYW5nZScgKSApIHtcclxuXHRcdFx0XHRcdHZhciBnID0gZmluZF9ncm91cCggdCApO1xyXG5cdFx0XHRcdFx0aWYgKCAhZyApIHJldHVybjtcclxuXHRcdFx0XHRcdHZhciBudW0gPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tdmFsdWVdJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBudW0gKSB7XHJcblx0XHRcdFx0XHRcdG51bS52YWx1ZSA9IHQudmFsdWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR2YXIgd3JpdGVyID0gZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtaW5zcGVjdG9yLWtleV0nICk7XHJcblx0XHRcdFx0XHRpZiAoIHdyaXRlciAmJiB3cml0ZXIudHlwZSA9PT0gJ3RleHQnICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgdW5pdCAgICAgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tdW5pdF0nICk7XHJcblx0XHRcdFx0XHRcdHVuaXQgICAgICAgICA9IHVuaXQgPyB1bml0LnZhbHVlIDogJ3B4JztcclxuXHRcdFx0XHRcdFx0d3JpdGVyLnZhbHVlID0gU3RyaW5nKCB0LnZhbHVlICkgKyBTdHJpbmcoIHVuaXQgKTtcclxuXHRcdFx0XHRcdFx0Ly8gdHJpZ2dlciBzdGFuZGFyZCBpbnNwZWN0b3IgaGFuZGxlcjpcclxuXHRcdFx0XHRcdFx0d3JpdGVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Ly8gUGxhaW4gcmFuZ2VfbnVtYmVyIGNhc2UgKG51bWJlciBoYXMgZGF0YS1pbnNwZWN0b3Ita2V5KSAtPiBmaXJlIGlucHV0IG9uIG51bWJlclxyXG5cdFx0XHRcdFx0XHRpZiAoIG51bSAmJiBudW0uaGFzQXR0cmlidXRlKCAnZGF0YS1pbnNwZWN0b3Ita2V5JyApICkge1xyXG5cdFx0XHRcdFx0XHRcdG51bS5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9ICkgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gTnVtYmVyIHR5cGVkIC0+IHVwZGF0ZSBzbGlkZXIgYW5kIHdyaXRlci9oaWRkZW5cclxuXHRcdFx0XHRpZiAoIHQgJiYgdC5oYXNBdHRyaWJ1dGUoICdkYXRhLWxlbi12YWx1ZScgKSApIHtcclxuXHRcdFx0XHRcdHZhciBnID0gZmluZF9ncm91cCggdCApO1xyXG5cdFx0XHRcdFx0aWYgKCAhZyApIHJldHVybjtcclxuXHRcdFx0XHRcdHZhciByID0gZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtbGVuLXJhbmdlXScgKTtcclxuXHRcdFx0XHRcdGlmICggciApIHtcclxuXHRcdFx0XHRcdFx0Ly8gY2xhbXAgd2l0aGluIHNsaWRlciBib3VuZHMgaWYgcHJlc2VudFxyXG5cdFx0XHRcdFx0XHR2YXIgbWluID0gTnVtYmVyKCByLm1pbiApO1xyXG5cdFx0XHRcdFx0XHR2YXIgbWF4ID0gTnVtYmVyKCByLm1heCApO1xyXG5cdFx0XHRcdFx0XHR2YXIgdiAgID0gTnVtYmVyKCB0LnZhbHVlICk7XHJcblx0XHRcdFx0XHRcdGlmICggIWlzTmFOKCB2ICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0diAgICAgICA9IGNsYW1wX251bSggdiwgaXNOYU4oIG1pbiApID8gdW5kZWZpbmVkIDogbWluLCBpc05hTiggbWF4ICkgPyB1bmRlZmluZWQgOiBtYXggKTtcclxuXHRcdFx0XHRcdFx0XHRyLnZhbHVlID0gU3RyaW5nKCB2ICk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBTdHJpbmcoIHYgKSAhPT0gdC52YWx1ZSApIHQudmFsdWUgPSBTdHJpbmcoIHYgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dmFyIHdyaXRlciA9IGcucXVlcnlTZWxlY3RvciggJ1tkYXRhLWluc3BlY3Rvci1rZXldJyApO1xyXG5cdFx0XHRcdFx0aWYgKCB3cml0ZXIgJiYgd3JpdGVyLnR5cGUgPT09ICd0ZXh0JyApIHtcclxuXHRcdFx0XHRcdFx0dmFyIHVuaXQgICAgID0gZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtbGVuLXVuaXRdJyApO1xyXG5cdFx0XHRcdFx0XHR1bml0ICAgICAgICAgPSB1bml0ID8gdW5pdC52YWx1ZSA6ICdweCc7XHJcblx0XHRcdFx0XHRcdHdyaXRlci52YWx1ZSA9IFN0cmluZyggdC52YWx1ZSB8fCAwICkgKyBTdHJpbmcoIHVuaXQgKTtcclxuXHRcdFx0XHRcdFx0d3JpdGVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly8gZWxzZTogbnVtYmVyIGl0c2VsZiBsaWtlbHkgY2FycmllcyBkYXRhLWluc3BlY3Rvci1rZXkgKHJhbmdlX251bWJlcik7IGRlZmF1bHQgaGFuZGxlciB3aWxsIHJ1bi5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHJcblx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdFx0dmFyIHQgPSBlLnRhcmdldDtcclxuXHRcdFx0XHQvLyBVbml0IGNoYW5nZWQgLT4gdXBkYXRlIHNsaWRlciBsaW1pdHMgYW5kIHdyaXRlci9oaWRkZW5cclxuXHRcdFx0XHRpZiAoIHQgJiYgdC5oYXNBdHRyaWJ1dGUoICdkYXRhLWxlbi11bml0JyApICkge1xyXG5cdFx0XHRcdFx0dmFyIGcgPSBmaW5kX2dyb3VwKCB0ICk7XHJcblx0XHRcdFx0XHRpZiAoICFnICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0XHRcdC8vIEZpbmQgdGhlIGNvbnRyb2wgbWV0YSB2aWEgYSBkYXRhIGF0dHJpYnV0ZSBvbiBncm91cCBpZiBwcm92aWRlZFxyXG5cdFx0XHRcdFx0Ly8gKEZhY3RvcnkgcGF0aCBzZXRzIG5vdGhpbmcgaGVyZTsgd2UgcmUtZGVyaXZlIGZyb20gY3VycmVudCBzbGlkZXIgYm91bmRzLilcclxuXHRcdFx0XHRcdHZhciByICAgICAgPSBnLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1sZW4tcmFuZ2VdJyApO1xyXG5cdFx0XHRcdFx0dmFyIG51bSAgICA9IGcucXVlcnlTZWxlY3RvciggJ1tkYXRhLWxlbi12YWx1ZV0nICk7XHJcblx0XHRcdFx0XHR2YXIgd3JpdGVyID0gZy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtaW5zcGVjdG9yLWtleV0nICk7XHJcblx0XHRcdFx0XHR2YXIgdW5pdCAgID0gdC52YWx1ZSB8fCAncHgnO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFkanVzdCBzbGlkZXIgYm91bmRzIGhldXJpc3RpY2FsbHkgKG1hdGNoIEZhY3RvcnkgZGVmYXVsdHMpXHJcblx0XHRcdFx0XHR2YXIgYm91bmRzX2J5X3VuaXQgPSB7XHJcblx0XHRcdFx0XHRcdCdweCcgOiB7IG1pbjogMCwgbWF4OiA1MTIsIHN0ZXA6IDEgfSxcclxuXHRcdFx0XHRcdFx0JyUnICA6IHsgbWluOiAwLCBtYXg6IDEwMCwgc3RlcDogMSB9LFxyXG5cdFx0XHRcdFx0XHQncmVtJzogeyBtaW46IDAsIG1heDogMTAsIHN0ZXA6IDAuMSB9LFxyXG5cdFx0XHRcdFx0XHQnZW0nIDogeyBtaW46IDAsIG1heDogMTAsIHN0ZXA6IDAuMSB9XHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0aWYgKCByICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgYiAgPSBib3VuZHNfYnlfdW5pdFt1bml0XSB8fCBib3VuZHNfYnlfdW5pdFsncHgnXTtcclxuXHRcdFx0XHRcdFx0ci5taW4gID0gU3RyaW5nKCBiLm1pbiApO1xyXG5cdFx0XHRcdFx0XHRyLm1heCAgPSBTdHJpbmcoIGIubWF4ICk7XHJcblx0XHRcdFx0XHRcdHIuc3RlcCA9IFN0cmluZyggYi5zdGVwICk7XHJcblx0XHRcdFx0XHRcdC8vIGNsYW1wIHRvIG5ldyBib3VuZHNcclxuXHRcdFx0XHRcdFx0dmFyIHYgID0gTnVtYmVyKCBudW0gJiYgbnVtLnZhbHVlID8gbnVtLnZhbHVlIDogci52YWx1ZSApO1xyXG5cdFx0XHRcdFx0XHRpZiAoICFpc05hTiggdiApICkge1xyXG5cdFx0XHRcdFx0XHRcdHYgICAgICAgPSBjbGFtcF9udW0oIHYsIGIubWluLCBiLm1heCApO1xyXG5cdFx0XHRcdFx0XHRcdHIudmFsdWUgPSBTdHJpbmcoIHYgKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIG51bSApIG51bS52YWx1ZSA9IFN0cmluZyggdiApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHdyaXRlciAmJiB3cml0ZXIudHlwZSA9PT0gJ3RleHQnICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgdiAgICAgICAgPSBudW0gJiYgbnVtLnZhbHVlID8gbnVtLnZhbHVlIDogKHIgPyByLnZhbHVlIDogJzAnKTtcclxuXHRcdFx0XHRcdFx0d3JpdGVyLnZhbHVlID0gU3RyaW5nKCB2ICkgKyBTdHJpbmcoIHVuaXQgKTtcclxuXHRcdFx0XHRcdFx0d3JpdGVyLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHRcdC8vID09ICBDIE8gTiBUIFIgTyBMICA9PVxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuXHRcdC8qKlxyXG5cdCAqIFNjaGVtYSA+IEluc3BlY3RvciA+IENvbnRyb2wgRWxlbWVudCwgZS5nLiBJbnB1dCEgIEJ1aWxkIGEgc2luZ2xlIGNvbnRyb2wgcm93OlxyXG5cdCAqIDxkaXYgY2xhc3M9XCJpbnNwZWN0b3JfX3Jvd1wiPlxyXG5cdCAqICAgPGxhYmVsIGNsYXNzPVwiaW5zcGVjdG9yX19sYWJlbFwiIGZvcj1cIi4uLlwiPkxhYmVsPC9sYWJlbD5cclxuXHQgKiAgIDxkaXYgY2xhc3M9XCJpbnNwZWN0b3JfX2NvbnRyb2xcIj48aW5wdXR8dGV4dGFyZWF8c2VsZWN0IGNsYXNzPVwiaW5zcGVjdG9yX19pbnB1dFwiIC4uLj48L2Rpdj5cclxuXHQgKiA8L2Rpdj5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sICAgICAgICAgICAtIHNjaGVtYSBjb250cm9sIG1ldGEgKHt0eXBlLGtleSxsYWJlbCwuLi59KVxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wc19zY2hlbWEgICAgICAtIHNjaGVtYS5wcm9wc1xyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhICAgICAgICAgICAgICAtIGN1cnJlbnQgZWxlbWVudCBkYXRhLSogbWFwXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHVpZCAgICAgICAgICAgICAgIC0gdW5pcXVlIHN1ZmZpeCBmb3IgaW5wdXQgaWRzXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGN0eCAgICAgICAgICAgICAgIC0geyBlbCwgYnVpbGRlciwgdHlwZSwgZGF0YSB9XHJcblx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fVxyXG5cdCAqL1xyXG5cdFx0ZnVuY3Rpb24gYnVpbGRfY29udHJvbChjb250cm9sLCBwcm9wc19zY2hlbWEsIGRhdGEsIHVpZCwgY3R4KSB7XHJcblx0XHRcdHZhciB0eXBlID0gY29udHJvbC50eXBlO1xyXG5cdFx0XHR2YXIga2V5ICA9IGNvbnRyb2wua2V5O1xyXG5cclxuXHRcdFx0dmFyIGxhYmVsX3RleHQgPSBjb250cm9sLmxhYmVsIHx8IGtleSB8fCAnJztcclxuXHRcdFx0dmFyIHByb3BfbWV0YSAgPSAoa2V5ID8gKHByb3BzX3NjaGVtYVtrZXldIHx8IHsgdHlwZTogJ3N0cmluZycgfSkgOiB7IHR5cGU6ICdzdHJpbmcnIH0pO1xyXG5cdFx0XHR2YXIgdmFsdWUgICAgICA9IGNvZXJjZV9ieV90eXBlKCBnZXRfaW5pdGlhbF92YWx1ZSgga2V5LCBkYXRhLCBwcm9wc19zY2hlbWEgKSwgcHJvcF9tZXRhLnR5cGUgKTtcclxuXHRcdC8vIEFsbG93IHZhbHVlX2Zyb20gb3ZlcnJpZGUgKGNvbXB1dGVkIGF0IHJlbmRlci10aW1lKS5cclxuXHRcdGlmICggY29udHJvbCAmJiBjb250cm9sLnZhbHVlX2Zyb20gJiYgdy53cGJjX2JmYl9pbnNwZWN0b3JfZmFjdG9yeV92YWx1ZV9mcm9tW2NvbnRyb2wudmFsdWVfZnJvbV0gKSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHZhciBjb21wdXRlZCA9IHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3RvcnlfdmFsdWVfZnJvbVtjb250cm9sLnZhbHVlX2Zyb21dKCBjdHggfHwge30gKTtcclxuXHRcdFx0XHRcdHZhbHVlICAgICAgICA9IGNvZXJjZV9ieV90eXBlKCBjb21wdXRlZCwgcHJvcF9tZXRhLnR5cGUgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdGNvbnNvbGUud2FybiggJ3ZhbHVlX2Zyb20gZmFpbGVkIGZvcicsIGNvbnRyb2wudmFsdWVfZnJvbSwgZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIGlucHV0X2lkID0gJ3dwYmNfaW5zXycgKyBrZXkgKyAnXycgKyB1aWQ7XHJcblxyXG5cdFx0XHR2YXIgcm93X2VsICAgID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX3JvdycgfSApO1xyXG5cdFx0XHR2YXIgbGFiZWxfZWwgID0gZWwoICdsYWJlbCcsIHsgJ2Zvcic6IGlucHV0X2lkLCAnY2xhc3MnOiAnaW5zcGVjdG9yX19sYWJlbCcgfSwgbGFiZWxfdGV4dCApO1xyXG5cdFx0XHR2YXIgY3RybF93cmFwID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX2NvbnRyb2wnIH0gKTtcclxuXHJcblx0XHRcdHZhciBmaWVsZF9lbDtcclxuXHJcblx0XHQvLyAtLS0gc2xvdCBob3N0IChuYW1lZCBVSSBpbmplY3Rpb24pIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoIHR5cGUgPT09ICdzbG90JyAmJiBjb250cm9sLnNsb3QgKSB7XHJcblx0XHRcdC8vIGFkZCBhIG1hcmtlciBjbGFzcyBmb3IgdGhlIGxheW91dCBjaGlwcyByb3dcclxuXHRcdFx0dmFyIGNsYXNzZXMgPSAnaW5zcGVjdG9yX19yb3cgaW5zcGVjdG9yX19yb3ctLXNsb3QnO1xyXG5cdFx0XHRpZiAoIGNvbnRyb2wuc2xvdCA9PT0gJ2xheW91dF9jaGlwcycgKSBjbGFzc2VzICs9ICcgaW5zcGVjdG9yX19yb3ctLWxheW91dC1jaGlwcyc7XHJcblxyXG5cdFx0XHR2YXIgc2xvdF9yb3cgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogY2xhc3NlcyB9ICk7XHJcblxyXG5cdFx0XHRpZiAoIGxhYmVsX3RleHQgKSBzbG90X3Jvdy5hcHBlbmRDaGlsZCggZWwoICdsYWJlbCcsIHsgJ2NsYXNzJzogJ2luc3BlY3Rvcl9fbGFiZWwnIH0sIGxhYmVsX3RleHQgKSApO1xyXG5cclxuXHRcdFx0Ly8gYWRkIGEgZGF0YSBhdHRyaWJ1dGUgb24gdGhlIGhvc3Qgc28gYm90aCBDU1MgYW5kIHRoZSBzYWZldHktbmV0IGNhbiB0YXJnZXQgaXRcclxuXHRcdFx0dmFyIGhvc3RfYXR0cnMgPSB7ICdjbGFzcyc6ICdpbnNwZWN0b3JfX2NvbnRyb2wnIH07XHJcblx0XHRcdGlmICggY29udHJvbC5zbG90ID09PSAnbGF5b3V0X2NoaXBzJyApIGhvc3RfYXR0cnNbJ2RhdGEtYmZiLXNsb3QnXSA9ICdsYXlvdXRfY2hpcHMnO1xyXG5cclxuXHRcdFx0dmFyIHNsb3RfaG9zdCA9IGVsKCAnZGl2JywgaG9zdF9hdHRycyApO1xyXG5cdFx0XHRzbG90X3Jvdy5hcHBlbmRDaGlsZCggc2xvdF9ob3N0ICk7XHJcblxyXG5cdFx0XHR2YXIgc2xvdF9mbiA9IHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3Rvcnlfc2xvdHNbY29udHJvbC5zbG90XTtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygc2xvdF9mbiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRzbG90X2ZuKCBzbG90X2hvc3QsIGN0eCB8fCB7fSApO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybiggJ3Nsb3QgXCInICsgY29udHJvbC5zbG90ICsgJ1wiIGZhaWxlZDonLCBlICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSwgMCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHNsb3RfaG9zdC5hcHBlbmRDaGlsZCggZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9fc2xvdF9fbWlzc2luZycgfSwgJ1tzbG90OiAnICsgY29udHJvbC5zbG90ICsgJ10nICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gc2xvdF9yb3c7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdFx0aWYgKCB0eXBlID09PSAndGV4dGFyZWEnICkge1xyXG5cdFx0XHRcdGZpZWxkX2VsID0gZWwoICd0ZXh0YXJlYScsIHtcclxuXHRcdFx0XHRcdGlkICAgICAgICAgICAgICAgICAgOiBpbnB1dF9pZCxcclxuXHRcdFx0XHRcdCdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksXHJcblx0XHRcdFx0XHRyb3dzICAgICAgICAgICAgICAgIDogY29udHJvbC5yb3dzIHx8IDMsXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgICAgICAgICAgIDogJ2luc3BlY3Rvcl9faW5wdXQnXHJcblx0XHRcdFx0fSwgKHZhbHVlID09IG51bGwgPyAnJyA6IFN0cmluZyggdmFsdWUgKSkgKTtcclxuXHRcdFx0fSBlbHNlIGlmICggdHlwZSA9PT0gJ3NlbGVjdCcgKSB7XHJcblx0XHRcdFx0ZmllbGRfZWwgPSBlbCggJ3NlbGVjdCcsIHtcclxuXHRcdFx0XHRcdGlkICAgICAgICAgICAgICAgICAgOiBpbnB1dF9pZCxcclxuXHRcdFx0XHRcdCdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgICAgICAgICAgIDogJ2luc3BlY3Rvcl9faW5wdXQnXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdG5vcm1hbGl6ZV9zZWxlY3Rfb3B0aW9ucyggY29udHJvbC5vcHRpb25zIHx8IFtdICkuZm9yRWFjaCggZnVuY3Rpb24gKG9wdCkge1xyXG5cdFx0XHRcdFx0dmFyIG9wdF9lbCA9IGVsKCAnb3B0aW9uJywgeyB2YWx1ZTogb3B0LnZhbHVlIH0sIG9wdC5sYWJlbCApO1xyXG5cdFx0XHRcdFx0aWYgKCBTdHJpbmcoIHZhbHVlICkgPT09IG9wdC52YWx1ZSApIG9wdF9lbC5zZXRBdHRyaWJ1dGUoICdzZWxlY3RlZCcsICdzZWxlY3RlZCcgKTtcclxuXHRcdFx0XHRcdGZpZWxkX2VsLmFwcGVuZENoaWxkKCBvcHRfZWwgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIHR5cGUgPT09ICdjaGVja2JveCcgKSB7XHJcblx0XHRcdFx0Ly8gZmllbGRfZWwgPSBlbCggJ2lucHV0JywgeyBpZDogaW5wdXRfaWQsIHR5cGU6ICdjaGVja2JveCcsICdkYXRhLWluc3BlY3Rvci1rZXknOiBrZXksIGNoZWNrZWQ6ICEhdmFsdWUsICdjbGFzcyc6ICdpbnNwZWN0b3JfX2lucHV0JyB9ICk7IC8vLlxyXG5cclxuXHRcdFx0XHQvLyBSZW5kZXIgYXMgdG9nZ2xlIFVJIGluc3RlYWQgb2YgbGFiZWwtbGVmdCArIGNoZWNrYm94LiAgTm90ZTogd2UgcmV0dXJuIHRoZSBmdWxsIHRvZ2dsZSByb3cgaGVyZSBhbmQgc2tpcCB0aGUgZGVmYXVsdCByb3cvbGFiZWwgZmxvdyBiZWxvdy5cclxuXHRcdFx0XHRyZXR1cm4gYnVpbGRfdG9nZ2xlX3JvdyggaW5wdXRfaWQsIGtleSwgISF2YWx1ZSwgbGFiZWxfdGV4dCApO1xyXG5cclxuXHRcdFx0fSBlbHNlIGlmICggdHlwZSA9PT0gJ3JhbmdlX251bWJlcicgKSB7XHJcblx0XHRcdFx0Ly8gLS0tIG5ldzogc2xpZGVyICsgbnVtYmVyIChzaW5nbGUga2V5KS5cclxuXHRcdFx0XHR2YXIgcm5faWQgID0gJ3dwYmNfaW5zXycgKyBrZXkgKyAnXycgKyB1aWQ7XHJcblx0XHRcdFx0dmFyIHJuX3ZhbCA9IHZhbHVlOyAvLyBmcm9tIGdldF9pbml0aWFsX3ZhbHVlL3Byb3BfbWV0YSBhbHJlYWR5LlxyXG5cdFx0XHRcdHJldHVybiBidWlsZF9yYW5nZV9udW1iZXJfcm93KCBybl9pZCwga2V5LCBsYWJlbF90ZXh0LCBybl92YWwsIGNvbnRyb2wgKTtcclxuXHJcblx0XHRcdH0gZWxzZSBpZiAoIHR5cGUgPT09ICdsZW4nICkge1xyXG5cdFx0XHRcdC8vIC0tLSBuZXc6IGxlbmd0aCBjb21wb3VuZCAodmFsdWUrdW5pdCtzbGlkZXIgLT4gd3JpdGVzIGEgc2luZ2xlIHN0cmluZyBrZXkpLlxyXG5cdFx0XHRcdHJldHVybiBidWlsZF9sZW5fY29tcG91bmRfcm93KCBjb250cm9sLCBwcm9wc19zY2hlbWEsIGRhdGEsIHVpZCApO1xyXG5cclxuXHRcdFx0fSBlbHNlIGlmICggdHlwZSA9PT0gJ2NvbG9yJyApIHtcclxuXHRcdFx0XHQvLyBDb2xvciBwaWNrZXIgKENvbG9yaXMpLiBTdG9yZSBhcyBzdHJpbmcgKGUuZy4sIFwiI2UwZTBlMFwiKS5cclxuXHRcdFx0XHRmaWVsZF9lbCA9IGVsKCAnaW5wdXQnLCB7XHJcblx0XHRcdFx0XHRpZCAgICAgICAgICAgICAgICAgICA6IGlucHV0X2lkLFxyXG5cdFx0XHRcdFx0dHlwZSAgICAgICAgICAgICAgICAgOiAndGV4dCcsXHJcblx0XHRcdFx0XHQnZGF0YS1pbnNwZWN0b3Ita2V5JyA6IGtleSxcclxuXHRcdFx0XHRcdCdkYXRhLWluc3BlY3Rvci10eXBlJzogJ2NvbG9yJyxcclxuXHRcdFx0XHRcdCdkYXRhLWNvbG9yaXMnICAgICAgIDogJycsXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgICAgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0JyxcclxuXHRcdFx0XHRcdCdkYXRhLWRlZmF1bHQtY29sb3InIDogKCB2YWx1ZSAhPSBudWxsICYmIHZhbHVlICE9PSAnJyA/IFN0cmluZyh2YWx1ZSkgOiAoY29udHJvbC5wbGFjZWhvbGRlciB8fCAnJykgKVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRpZiAoIHZhbHVlICE9PSAnJyApIHtcclxuXHRcdFx0XHRcdGZpZWxkX2VsLnZhbHVlID0gU3RyaW5nKCB2YWx1ZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvLyB0ZXh0L251bWJlciBkZWZhdWx0LlxyXG5cdFx0XHRcdHZhciBhdHRycyA9IHtcclxuXHRcdFx0XHRcdGlkICAgICAgICAgICAgICAgICAgOiBpbnB1dF9pZCxcclxuXHRcdFx0XHRcdHR5cGUgICAgICAgICAgICAgICAgOiAodHlwZSA9PT0gJ251bWJlcicpID8gJ251bWJlcicgOiAndGV4dCcsXHJcblx0XHRcdFx0XHQnZGF0YS1pbnNwZWN0b3Ita2V5Jzoga2V5LFxyXG5cdFx0XHRcdFx0J2NsYXNzJyAgICAgICAgICAgICA6ICdpbnNwZWN0b3JfX2lucHV0J1xyXG5cdFx0XHRcdH07XHJcblx0XHRcdC8vIG51bWJlciBjb25zdHJhaW50cyAoc2NoZW1hIG9yIGNvbnRyb2wpXHJcblx0XHRcdFx0aWYgKCB0eXBlID09PSAnbnVtYmVyJyApIHtcclxuXHRcdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBwcm9wX21ldGEsICdtaW4nICkgKSBhdHRycy5taW4gPSBwcm9wX21ldGEubWluO1xyXG5cdFx0XHRcdFx0aWYgKCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHByb3BfbWV0YSwgJ21heCcgKSApIGF0dHJzLm1heCA9IHByb3BfbWV0YS5tYXg7XHJcblx0XHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcHJvcF9tZXRhLCAnc3RlcCcgKSApIGF0dHJzLnN0ZXAgPSBwcm9wX21ldGEuc3RlcDtcclxuXHRcdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBjb250cm9sLCAnbWluJyApICkgYXR0cnMubWluID0gY29udHJvbC5taW47XHJcblx0XHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggY29udHJvbCwgJ21heCcgKSApIGF0dHJzLm1heCA9IGNvbnRyb2wubWF4O1xyXG5cdFx0XHRcdFx0aWYgKCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIGNvbnRyb2wsICdzdGVwJyApICkgYXR0cnMuc3RlcCA9IGNvbnRyb2wuc3RlcDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZmllbGRfZWwgPSBlbCggJ2lucHV0JywgYXR0cnMgKTtcclxuXHRcdFx0XHRpZiAoIHZhbHVlICE9PSAnJyApIGZpZWxkX2VsLnZhbHVlID0gU3RyaW5nKCB2YWx1ZSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjdHJsX3dyYXAuYXBwZW5kQ2hpbGQoIGZpZWxkX2VsICk7XHJcblx0XHRcdHJvd19lbC5hcHBlbmRDaGlsZCggbGFiZWxfZWwgKTtcclxuXHRcdFx0cm93X2VsLmFwcGVuZENoaWxkKCBjdHJsX3dyYXAgKTtcclxuXHRcdFx0cmV0dXJuIHJvd19lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNjaGVtYSA+IEluc3BlY3RvciA+IEdyb3VwcyEgQnVpbGQgYW4gaW5zcGVjdG9yIGdyb3VwIChjb2xsYXBzaWJsZSkuXHJcblx0XHQgKiBTdHJ1Y3R1cmU6XHJcblx0XHQgKiA8c2VjdGlvbiBjbGFzcz1cIndwYmNfYmZiX19pbnNwZWN0b3JfX2dyb3VwIHdwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwIGlzLW9wZW5cIiBkYXRhLWdyb3VwPVwiLi4uXCI+XHJcblx0XHQgKiAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiZ3JvdXBfX2hlYWRlclwiIHJvbGU9XCJidXR0b25cIiBhcmlhLWV4cGFuZGVkPVwidHJ1ZVwiIGFyaWEtY29udHJvbHM9XCJ3cGJjX2NvbGxhcHNpYmxlX3BhbmVsX1hcIj5cclxuXHRcdCAqICAgICA8aDM+R3JvdXAgVGl0bGU8L2gzPlxyXG5cdFx0ICogICAgIDxpIGNsYXNzPVwid3BiY191aV9lbF9fdmVydF9tZW51X3Jvb3Rfc2VjdGlvbl9pY29uIG1lbnVfaWNvbiBpY29uLTF4IHdwYmMtYmktY2hldnJvbi1yaWdodFwiPjwvaT5cclxuXHRcdCAqICAgPC9idXR0b24+XHJcblx0XHQgKiAgIDxkaXYgY2xhc3M9XCJncm91cF9fZmllbGRzXCIgaWQ9XCJ3cGJjX2NvbGxhcHNpYmxlX3BhbmVsX1hcIiBhcmlhLWhpZGRlbj1cImZhbHNlXCI+IOKApnJvd3PigKYgPC9kaXY+XHJcblx0XHQgKiA8L3NlY3Rpb24+XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGdyb3VwXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gcHJvcHNfc2NoZW1hXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHVpZFxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGN0eFxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50fVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBidWlsZF9ncm91cChncm91cCwgcHJvcHNfc2NoZW1hLCBkYXRhLCB1aWQsIGN0eCkge1xyXG5cdFx0XHR2YXIgaXNfb3BlbiAgPSAhIWdyb3VwLm9wZW47XHJcblx0XHRcdHZhciBwYW5lbF9pZCA9ICd3cGJjX2NvbGxhcHNpYmxlX3BhbmVsXycgKyB1aWQgKyAnXycgKyAoZ3JvdXAua2V5IHx8ICdnJyk7XHJcblxyXG5cdFx0XHR2YXIgc2VjdGlvbiA9IGVsKCAnc2VjdGlvbicsIHtcclxuXHRcdFx0XHQnY2xhc3MnICAgICA6ICd3cGJjX2JmYl9faW5zcGVjdG9yX19ncm91cCB3cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcgKyAoaXNfb3BlbiA/ICcgaXMtb3BlbicgOiAnJyksXHJcblx0XHRcdFx0J2RhdGEtZ3JvdXAnOiBncm91cC5rZXkgfHwgJydcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dmFyIGhlYWRlcl9idG4gPSBlbCggJ2J1dHRvbicsIHtcclxuXHRcdFx0XHR0eXBlICAgICAgICAgICA6ICdidXR0b24nLFxyXG5cdFx0XHRcdCdjbGFzcycgICAgICAgIDogJ2dyb3VwX19oZWFkZXInLFxyXG5cdFx0XHRcdHJvbGUgICAgICAgICAgIDogJ2J1dHRvbicsXHJcblx0XHRcdFx0J2FyaWEtZXhwYW5kZWQnOiBpc19vcGVuID8gJ3RydWUnIDogJ2ZhbHNlJyxcclxuXHRcdFx0XHQnYXJpYS1jb250cm9scyc6IHBhbmVsX2lkXHJcblx0XHRcdH0sIFtcclxuXHRcdFx0XHRlbCggJ2gzJywgbnVsbCwgZ3JvdXAudGl0bGUgfHwgZ3JvdXAubGFiZWwgfHwgZ3JvdXAua2V5IHx8ICcnICksXHJcblx0XHRcdFx0ZWwoICdpJywgeyAnY2xhc3MnOiAnd3BiY191aV9lbF9fdmVydF9tZW51X3Jvb3Rfc2VjdGlvbl9pY29uIG1lbnVfaWNvbiBpY29uLTF4IHdwYmMtYmktY2hldnJvbi1yaWdodCcgfSApXHJcblx0XHRcdF0gKTtcclxuXHJcblx0XHRcdHZhciBmaWVsZHMgPSBlbCggJ2RpdicsIHtcclxuXHRcdFx0XHQnY2xhc3MnICAgICAgOiAnZ3JvdXBfX2ZpZWxkcycsXHJcblx0XHRcdFx0aWQgICAgICAgICAgIDogcGFuZWxfaWQsXHJcblx0XHRcdFx0J2FyaWEtaGlkZGVuJzogaXNfb3BlbiA/ICdmYWxzZScgOiAndHJ1ZSdcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0ZnVuY3Rpb24gYXNBcnJheSh4KSB7XHJcblx0XHRcdFx0aWYgKCBBcnJheS5pc0FycmF5KCB4ICkgKSByZXR1cm4geDtcclxuXHRcdFx0XHRpZiAoIHggJiYgdHlwZW9mIHggPT09ICdvYmplY3QnICkgcmV0dXJuIE9iamVjdC52YWx1ZXMoIHggKTtcclxuXHRcdFx0XHRyZXR1cm4geCAhPSBudWxsID8gWyB4IF0gOiBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YXNBcnJheSggZ3JvdXAuY29udHJvbHMgKS5mb3JFYWNoKCBmdW5jdGlvbiAoY29udHJvbCkge1xyXG5cdFx0XHRcdGZpZWxkcy5hcHBlbmRDaGlsZCggYnVpbGRfY29udHJvbCggY29udHJvbCwgcHJvcHNfc2NoZW1hLCBkYXRhLCB1aWQsIGN0eCApICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHNlY3Rpb24uYXBwZW5kQ2hpbGQoIGhlYWRlcl9idG4gKTtcclxuXHRcdFx0c2VjdGlvbi5hcHBlbmRDaGlsZCggZmllbGRzICk7XHJcblx0XHRcdHJldHVybiBzZWN0aW9uO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2NoZW1hID4gSW5zcGVjdG9yID4gSGVhZGVyISBCdWlsZCBpbnNwZWN0b3IgaGVhZGVyIHdpdGggYWN0aW9uIGJ1dHRvbnMgd2lyZWQgdG8gZXhpc3RpbmcgZGF0YS1hY3Rpb24gaGFuZGxlcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtBcnJheTxzdHJpbmc+fSBoZWFkZXJfYWN0aW9uc1xyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICB0aXRsZV90ZXh0XHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIGJ1aWxkX2hlYWRlcihpbnNwZWN0b3JfdWksIHRpdGxlX2ZhbGxiYWNrLCBzY2hlbWFfZm9yX3R5cGUpIHtcclxuXHJcblx0XHRcdGluc3BlY3Rvcl91aSAgICAgID0gaW5zcGVjdG9yX3VpIHx8IHt9O1xyXG5cdFx0XHRzY2hlbWFfZm9yX3R5cGUgICA9IHNjaGVtYV9mb3JfdHlwZSB8fCB7fTtcclxuXHRcdFx0dmFyIHZhcmlhbnQgICAgICAgPSBpbnNwZWN0b3JfdWkuaGVhZGVyX3ZhcmlhbnQgfHwgJ21pbmltYWwnO1xyXG5cdFx0XHR2YXIgaGVhZGVyQWN0aW9ucyA9IGluc3BlY3Rvcl91aS5oZWFkZXJfYWN0aW9uc1xyXG5cdFx0XHRcdHx8IHNjaGVtYV9mb3JfdHlwZS5oZWFkZXJfYWN0aW9uc1xyXG5cdFx0XHRcdHx8IFsgJ2Rlc2VsZWN0JywgJ3Njcm9sbHRvJywgJ21vdmUtdXAnLCAnbW92ZS1kb3duJywgJ2R1cGxpY2F0ZScsICdkZWxldGUnIF07XHJcblxyXG5cdFx0XHR2YXIgdGl0bGUgICAgICAgPSBpbnNwZWN0b3JfdWkudGl0bGUgfHwgdGl0bGVfZmFsbGJhY2sgfHwgJyc7XHJcblx0XHRcdHZhciBkZXNjcmlwdGlvbiA9IGluc3BlY3Rvcl91aS5kZXNjcmlwdGlvbiB8fCAnJztcclxuXHJcblx0XHRcdC8vIGhlbHBlciB0byBjcmVhdGUgYSBidXR0b24gZm9yIGVpdGhlciBoZWFkZXIgc3R5bGVcclxuXHRcdFx0ZnVuY3Rpb24gYWN0aW9uQnRuKGFjdCwgbWluaW1hbCkge1xyXG5cdFx0XHRcdGlmICggbWluaW1hbCApIHtcclxuXHRcdFx0XHRcdHJldHVybiBlbCggJ2J1dHRvbicsIHsgdHlwZTogJ2J1dHRvbicsICdjbGFzcyc6ICdidXR0b24tbGluaycsICdkYXRhLWFjdGlvbic6IGFjdCB9LCAnJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyB0b29sYmFyIHZhcmlhbnQgKHJpY2gpXHJcblx0XHRcdFx0dmFyIGljb25NYXAgPSB7XHJcblx0XHRcdFx0XHQnZGVzZWxlY3QnIDogJ3dwYmNfaWNuX3JlbW92ZV9kb25lJyxcclxuXHRcdFx0XHRcdCdzY3JvbGx0bycgOiAnd3BiY19pY25fYWRzX2NsaWNrIGZpbHRlcl9jZW50ZXJfZm9jdXMnLFxyXG5cdFx0XHRcdFx0J21vdmUtdXAnICA6ICd3cGJjX2ljbl9hcnJvd191cHdhcmQnLFxyXG5cdFx0XHRcdFx0J21vdmUtZG93bic6ICd3cGJjX2ljbl9hcnJvd19kb3dud2FyZCcsXHJcblx0XHRcdFx0XHQnZHVwbGljYXRlJzogJ3dwYmNfaWNuX2NvbnRlbnRfY29weScsXHJcblx0XHRcdFx0XHQnZGVsZXRlJyAgIDogJ3dwYmNfaWNuX2RlbGV0ZV9vdXRsaW5lJ1xyXG5cdFx0XHRcdH07XHJcblx0XHRcdFx0dmFyIGNsYXNzZXMgPSAnYnV0dG9uIGJ1dHRvbi1zZWNvbmRhcnkgd3BiY191aV9jb250cm9sIHdwYmNfdWlfYnV0dG9uJztcclxuXHRcdFx0XHRpZiAoIGFjdCA9PT0gJ2RlbGV0ZScgKSBjbGFzc2VzICs9ICcgd3BiY191aV9idXR0b25fZGFuZ2VyIGJ1dHRvbi1saW5rLWRlbGV0ZSc7XHJcblxyXG5cdFx0XHRcdHZhciBidG4gPSBlbCggJ2J1dHRvbicsIHtcclxuXHRcdFx0XHRcdHR5cGUgICAgICAgICA6ICdidXR0b24nLFxyXG5cdFx0XHRcdFx0J2NsYXNzJyAgICAgIDogY2xhc3NlcyxcclxuXHRcdFx0XHRcdCdkYXRhLWFjdGlvbic6IGFjdCxcclxuXHRcdFx0XHRcdCdhcmlhLWxhYmVsJyA6IGFjdC5yZXBsYWNlKCAvLS9nLCAnICcgKVxyXG5cdFx0XHRcdH0gKTtcclxuXHJcblx0XHRcdFx0aWYgKCBhY3QgPT09ICdkZWxldGUnICkge1xyXG5cdFx0XHRcdFx0YnRuLmFwcGVuZENoaWxkKCBlbCggJ3NwYW4nLCB7ICdjbGFzcyc6ICdpbi1idXR0b24tdGV4dCcgfSwgJ0RlbGV0ZScgKSApO1xyXG5cdFx0XHRcdFx0YnRuLmFwcGVuZENoaWxkKCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSggJyAnICkgKTsgLy8gbWlub3Igc3BhY2luZyBiZWZvcmUgaWNvblxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRidG4uYXBwZW5kQ2hpbGQoIGVsKCAnaScsIHsgJ2NsYXNzJzogJ21lbnVfaWNvbiBpY29uLTF4ICcgKyAoaWNvbk1hcFthY3RdIHx8ICcnKSB9ICkgKTtcclxuXHRcdFx0XHRyZXR1cm4gYnRuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyA9PT0gbWluaW1hbCBoZWFkZXIgKGV4aXN0aW5nIGxvb2s7IGRlZmF1bHQpID09PVxyXG5cdFx0XHRpZiAoIHZhcmlhbnQgIT09ICd0b29sYmFyJyApIHtcclxuXHRcdFx0XHR2YXIgaGVhZGVyID0gZWwoICdoZWFkZXInLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9faW5zcGVjdG9yX19oZWFkZXInIH0gKTtcclxuXHRcdFx0XHRoZWFkZXIuYXBwZW5kQ2hpbGQoIGVsKCAnaDMnLCBudWxsLCB0aXRsZSB8fCAnJyApICk7XHJcblxyXG5cdFx0XHRcdHZhciBhY3Rpb25zID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd3cGJjX2JmYl9faW5zcGVjdG9yX19oZWFkZXJfYWN0aW9ucycgfSApO1xyXG5cdFx0XHRcdGhlYWRlckFjdGlvbnMuZm9yRWFjaCggZnVuY3Rpb24gKGFjdCkge1xyXG5cdFx0XHRcdFx0YWN0aW9ucy5hcHBlbmRDaGlsZCggYWN0aW9uQnRuKCBhY3QsIC8qbWluaW1hbCovdHJ1ZSApICk7XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdGhlYWRlci5hcHBlbmRDaGlsZCggYWN0aW9ucyApO1xyXG5cdFx0XHRcdHJldHVybiBoZWFkZXI7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vID09PSB0b29sYmFyIGhlYWRlciAocmljaCB0aXRsZS9kZXNjICsgZ3JvdXBlZCBidXR0b25zKSA9PT1cclxuXHRcdFx0dmFyIHJvb3QgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ3dwYmNfYmZiX19pbnNwZWN0b3JfX2hlYWQnIH0gKTtcclxuXHRcdFx0dmFyIHdyYXAgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ2hlYWRlcl9jb250YWluZXInIH0gKTtcclxuXHRcdFx0dmFyIGxlZnQgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ2hlYWRlcl90aXRsZV9jb250ZW50JyB9ICk7XHJcblx0XHRcdHZhciBoMyAgID0gZWwoICdoMycsIHsgJ2NsYXNzJzogJ3RpdGxlJyB9LCB0aXRsZSB8fCAnJyApO1xyXG5cdFx0XHRsZWZ0LmFwcGVuZENoaWxkKCBoMyApO1xyXG5cdFx0XHRpZiAoIGRlc2NyaXB0aW9uICkge1xyXG5cdFx0XHRcdGxlZnQuYXBwZW5kQ2hpbGQoIGVsKCAnZGl2JywgeyAnY2xhc3MnOiAnZGVzYycgfSwgZGVzY3JpcHRpb24gKSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgcmlnaHQgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ2FjdGlvbnMgd3BiY19hanhfdG9vbGJhciB3cGJjX25vX2JvcmRlcnMnIH0gKTtcclxuXHRcdFx0dmFyIHVpQyAgID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd1aV9jb250YWluZXIgdWlfY29udGFpbmVyX3NtYWxsJyB9ICk7XHJcblx0XHRcdHZhciB1aUcgICA9IGVsKCAnZGl2JywgeyAnY2xhc3MnOiAndWlfZ3JvdXAnIH0gKTtcclxuXHJcblx0XHRcdC8vIFNwbGl0IGludG8gdmlzdWFsIGdyb3VwczogZmlyc3QgMiwgbmV4dCAyLCB0aGVuIHRoZSByZXN0LlxyXG5cdFx0XHR2YXIgZzEgPSBlbCggJ2RpdicsIHsgJ2NsYXNzJzogJ3VpX2VsZW1lbnQnIH0gKTtcclxuXHRcdFx0dmFyIGcyID0gZWwoICdkaXYnLCB7ICdjbGFzcyc6ICd1aV9lbGVtZW50JyB9ICk7XHJcblx0XHRcdHZhciBnMyA9IGVsKCAnZGl2JywgeyAnY2xhc3MnOiAndWlfZWxlbWVudCcgfSApO1xyXG5cclxuXHRcdFx0aGVhZGVyQWN0aW9ucy5zbGljZSggMCwgMiApLmZvckVhY2goIGZ1bmN0aW9uIChhY3QpIHtcclxuXHRcdFx0XHRnMS5hcHBlbmRDaGlsZCggYWN0aW9uQnRuKCBhY3QsIGZhbHNlICkgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHRoZWFkZXJBY3Rpb25zLnNsaWNlKCAyLCA0ICkuZm9yRWFjaCggZnVuY3Rpb24gKGFjdCkge1xyXG5cdFx0XHRcdGcyLmFwcGVuZENoaWxkKCBhY3Rpb25CdG4oIGFjdCwgZmFsc2UgKSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGhlYWRlckFjdGlvbnMuc2xpY2UoIDQgKS5mb3JFYWNoKCBmdW5jdGlvbiAoYWN0KSB7XHJcblx0XHRcdFx0ZzMuYXBwZW5kQ2hpbGQoIGFjdGlvbkJ0biggYWN0LCBmYWxzZSApICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHVpRy5hcHBlbmRDaGlsZCggZzEgKTtcclxuXHRcdFx0dWlHLmFwcGVuZENoaWxkKCBnMiApO1xyXG5cdFx0XHR1aUcuYXBwZW5kQ2hpbGQoIGczICk7XHJcblx0XHRcdHVpQy5hcHBlbmRDaGlsZCggdWlHICk7XHJcblx0XHRcdHJpZ2h0LmFwcGVuZENoaWxkKCB1aUMgKTtcclxuXHJcblx0XHRcdHdyYXAuYXBwZW5kQ2hpbGQoIGxlZnQgKTtcclxuXHRcdFx0d3JhcC5hcHBlbmRDaGlsZCggcmlnaHQgKTtcclxuXHRcdFx0cm9vdC5hcHBlbmRDaGlsZCggd3JhcCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHJvb3Q7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdGZ1bmN0aW9uIGZhY3RvcnlfcmVuZGVyKHBhbmVsX2VsLCBzY2hlbWFfZm9yX3R5cGUsIGRhdGEsIG9wdHMpIHtcclxuXHRcdFx0aWYgKCAhcGFuZWxfZWwgKSByZXR1cm4gcGFuZWxfZWw7XHJcblxyXG5cdFx0XHRzY2hlbWFfZm9yX3R5cGUgID0gc2NoZW1hX2Zvcl90eXBlIHx8IHt9O1xyXG5cdFx0XHR2YXIgcHJvcHNfc2NoZW1hID0gKHNjaGVtYV9mb3JfdHlwZS5zY2hlbWEgJiYgc2NoZW1hX2Zvcl90eXBlLnNjaGVtYS5wcm9wcykgPyBzY2hlbWFfZm9yX3R5cGUuc2NoZW1hLnByb3BzIDoge307XHJcblx0XHRcdHZhciBpbnNwZWN0b3JfdWkgPSAoc2NoZW1hX2Zvcl90eXBlLmluc3BlY3Rvcl91aSB8fCB7fSk7XHJcblx0XHRcdHZhciBncm91cHMgICAgICAgPSBpbnNwZWN0b3JfdWkuZ3JvdXBzIHx8IFtdO1xyXG5cclxuXHRcdFx0dmFyIGhlYWRlcl9hY3Rpb25zID0gaW5zcGVjdG9yX3VpLmhlYWRlcl9hY3Rpb25zIHx8IHNjaGVtYV9mb3JfdHlwZS5oZWFkZXJfYWN0aW9ucyB8fCBbXTtcclxuXHRcdFx0dmFyIHRpdGxlX3RleHQgICAgID0gKG9wdHMgJiYgb3B0cy50aXRsZSkgfHwgaW5zcGVjdG9yX3VpLnRpdGxlIHx8IHNjaGVtYV9mb3JfdHlwZS5sYWJlbCB8fCAoZGF0YSAmJiBkYXRhLmxhYmVsKSB8fCAnJztcclxuXHJcblx0XHQvLyBQcmVwYXJlIHJlbmRlcmluZyBjb250ZXh0IGZvciBzbG90cy92YWx1ZV9mcm9tLCBldGMuXHJcblx0XHRcdHZhciBjdHggPSB7XHJcblx0XHRcdFx0ZWwgICAgIDogb3B0cyAmJiBvcHRzLmVsIHx8IG51bGwsXHJcblx0XHRcdFx0YnVpbGRlcjogb3B0cyAmJiBvcHRzLmJ1aWxkZXIgfHwgbnVsbCxcclxuXHRcdFx0XHR0eXBlICAgOiBvcHRzICYmIG9wdHMudHlwZSB8fCBudWxsLFxyXG5cdFx0XHRcdGRhdGEgICA6IGRhdGEgfHwge31cclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdC8vIGNsZWFyIHBhbmVsLlxyXG5cdFx0XHR3aGlsZSAoIHBhbmVsX2VsLmZpcnN0Q2hpbGQgKSBwYW5lbF9lbC5yZW1vdmVDaGlsZCggcGFuZWxfZWwuZmlyc3RDaGlsZCApO1xyXG5cclxuXHRcdFx0dmFyIHVpZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDggKTtcclxuXHJcblx0XHRcdC8vIGhlYWRlci5cclxuXHRcdFx0cGFuZWxfZWwuYXBwZW5kQ2hpbGQoIGJ1aWxkX2hlYWRlciggaW5zcGVjdG9yX3VpLCB0aXRsZV90ZXh0LCBzY2hlbWFfZm9yX3R5cGUgKSApO1xyXG5cclxuXHJcblx0XHRcdC8vIGdyb3Vwcy5cclxuXHRcdFx0Z3JvdXBzLmZvckVhY2goIGZ1bmN0aW9uIChnKSB7XHJcblx0XHRcdFx0cGFuZWxfZWwuYXBwZW5kQ2hpbGQoIGJ1aWxkX2dyb3VwKCBnLCBwcm9wc19zY2hlbWEsIGRhdGEgfHwge30sIHVpZCwgY3R4ICkgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0Ly8gQVJJQSBzeW5jIGZvciB0b2dnbGVzIGNyZWF0ZWQgaGVyZSAoZW5zdXJlIGFyaWEtY2hlY2tlZCBtYXRjaGVzIHN0YXRlKS5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQvLyBDZW50cmFsaXplZCBVSSBub3JtYWxpemVycyAodG9nZ2xlcyArIEExMXkpOiBoYW5kbGVkIGluIENvcmUuXHJcblx0XHRcdFx0VUkuYXBwbHlfcG9zdF9yZW5kZXIoIHBhbmVsX2VsICk7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHdpcmVfbGVuX2dyb3VwKCBwYW5lbF9lbCApO1xyXG5cdFx0XHRcdFx0Ly8gSW5pdGlhbGl6ZSBDb2xvcmlzIG9uIGNvbG9yIGlucHV0cyByZW5kZXJlZCBpbiB0aGlzIHBhbmVsLlxyXG5cdFx0XHRcdFx0aW5pdF9jb2xvcmlzX3BpY2tlcnMoIHBhbmVsX2VsICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7IH1cclxuXHRcdFx0fSBjYXRjaCAoIF8gKSB7IH1cclxuXHJcblx0XHRcdHJldHVybiBwYW5lbF9lbDtcclxuXHRcdH1cclxuXHJcblx0XHRVSS5XUEJDX0JGQl9JbnNwZWN0b3JfRmFjdG9yeSA9IHsgcmVuZGVyOiBmYWN0b3J5X3JlbmRlciB9OyAgIC8vIG92ZXJ3cml0ZS9yZWZyZXNoXHJcblxyXG5cdFx0Ly8gLS0tLSBCdWlsdC1pbiBzbG90ICsgdmFsdWVfZnJvbSBmb3IgU2VjdGlvbnMgLS0tLVxyXG5cclxuXHRcdGZ1bmN0aW9uIHNsb3RfbGF5b3V0X2NoaXBzKGhvc3QsIGN0eCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciBMID0gdy5XUEJDX0JGQl9Db3JlICYmICB3LldQQkNfQkZCX0NvcmUuVUkgJiYgdy5XUEJDX0JGQl9Db3JlLlVJLldQQkNfQkZCX0xheW91dF9DaGlwcztcclxuXHRcdFx0XHRpZiAoIEwgJiYgdHlwZW9mIEwucmVuZGVyX2Zvcl9zZWN0aW9uID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0TC5yZW5kZXJfZm9yX3NlY3Rpb24oIGN0eC5idWlsZGVyLCBjdHguZWwsIGhvc3QgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aG9zdC5hcHBlbmRDaGlsZCggZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoICdbbGF5b3V0X2NoaXBzIG5vdCBhdmFpbGFibGVdJyApICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRjb25zb2xlLndhcm4oICd3cGJjX2JmYl9zbG90X2xheW91dF9jaGlwcyBmYWlsZWQ6JywgZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dy53cGJjX2JmYl9pbnNwZWN0b3JfZmFjdG9yeV9zbG90cy5sYXlvdXRfY2hpcHMgPSBzbG90X2xheW91dF9jaGlwcztcclxuXHJcblx0XHRmdW5jdGlvbiB2YWx1ZV9mcm9tX2NvbXB1dGVfc2VjdGlvbl9jb2x1bW5zKGN0eCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciByb3cgPSBjdHggJiYgY3R4LmVsICYmIGN0eC5lbC5xdWVyeVNlbGVjdG9yICYmIGN0eC5lbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gLndwYmNfYmZiX19yb3cnICk7XHJcblx0XHRcdFx0aWYgKCAhcm93ICkgcmV0dXJuIDE7XHJcblx0XHRcdFx0dmFyIG4gPSByb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uJyApLmxlbmd0aCB8fCAxO1xyXG5cdFx0XHRcdGlmICggbiA8IDEgKSBuID0gMTtcclxuXHRcdFx0XHRpZiAoIG4gPiA0ICkgbiA9IDQ7XHJcblx0XHRcdFx0cmV0dXJuIG47XHJcblx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdHJldHVybiAxO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0dy53cGJjX2JmYl9pbnNwZWN0b3JfZmFjdG9yeV92YWx1ZV9mcm9tLmNvbXB1dGVfc2VjdGlvbl9jb2x1bW5zID0gdmFsdWVfZnJvbV9jb21wdXRlX3NlY3Rpb25fY29sdW1ucztcclxuXHR9XHJcblxyXG5cdC8vIDMpIEluc3BlY3RvciBjbGFzcy5cclxuXHJcblx0Y2xhc3MgV1BCQ19CRkJfSW5zcGVjdG9yIHtcclxuXHJcblx0XHRjb25zdHJ1Y3RvcihwYW5lbF9lbCwgYnVpbGRlcikge1xyXG5cdFx0XHR0aGlzLnBhbmVsICAgICAgICAgPSBwYW5lbF9lbCB8fCB0aGlzLl9jcmVhdGVfZmFsbGJhY2tfcGFuZWwoKTtcclxuXHRcdFx0dGhpcy5idWlsZGVyICAgICAgID0gYnVpbGRlcjtcclxuXHRcdFx0dGhpcy5zZWxlY3RlZF9lbCAgID0gbnVsbDtcclxuXHRcdFx0dGhpcy5fcmVuZGVyX3RpbWVyID0gbnVsbDtcclxuXHJcblx0XHRcdHRoaXMuX29uX2RlbGVnYXRlZF9pbnB1dCAgPSAoZSkgPT4gdGhpcy5fYXBwbHlfY29udHJvbF9mcm9tX2V2ZW50KCBlICk7XHJcblx0XHRcdHRoaXMuX29uX2RlbGVnYXRlZF9jaGFuZ2UgPSAoZSkgPT4gdGhpcy5fYXBwbHlfY29udHJvbF9mcm9tX2V2ZW50KCBlICk7XHJcblx0XHRcdHRoaXMucGFuZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgdGhpcy5fb25fZGVsZWdhdGVkX2lucHV0LCB0cnVlICk7XHJcblx0XHRcdHRoaXMucGFuZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHRoaXMuX29uX2RlbGVnYXRlZF9jaGFuZ2UsIHRydWUgKTtcclxuXHJcblx0XHRcdHRoaXMuX29uX2RlbGVnYXRlZF9jbGljayA9IChlKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgYnRuID0gZS50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLWFjdGlvbl0nICk7XHJcblx0XHRcdFx0aWYgKCAhYnRuIHx8ICF0aGlzLnBhbmVsLmNvbnRhaW5zKCBidG4gKSApIHJldHVybjtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHJcblx0XHRcdFx0Y29uc3QgYWN0aW9uID0gYnRuLmdldEF0dHJpYnV0ZSggJ2RhdGEtYWN0aW9uJyApO1xyXG5cdFx0XHRcdGNvbnN0IGVsICAgICA9IHRoaXMuc2VsZWN0ZWRfZWw7XHJcblx0XHRcdFx0aWYgKCAhZWwgKSByZXR1cm47XHJcblxyXG5cdFx0XHRcdHcuV1BCQ19CRkJfSW5zcGVjdG9yX0FjdGlvbnM/LnJ1biggYWN0aW9uLCB7XHJcblx0XHRcdFx0XHRidWlsZGVyOiB0aGlzLmJ1aWxkZXIsXHJcblx0XHRcdFx0XHRlbCxcclxuXHRcdFx0XHRcdHBhbmVsICA6IHRoaXMucGFuZWwsXHJcblx0XHRcdFx0XHRldmVudCAgOiBlXHJcblx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRpZiAoIGFjdGlvbiA9PT0gJ2RlbGV0ZScgKSB0aGlzLmNsZWFyKCk7XHJcblx0XHRcdH07XHJcblx0XHRcdHRoaXMucGFuZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5fb25fZGVsZWdhdGVkX2NsaWNrICk7XHJcblx0XHR9XHJcblxyXG5cdFx0X3Bvc3RfcmVuZGVyX3VpKCkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciBVSSA9IHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuVUk7XHJcblx0XHRcdFx0aWYgKCBVSSAmJiB0eXBlb2YgVUkuYXBwbHlfcG9zdF9yZW5kZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRVSS5hcHBseV9wb3N0X3JlbmRlciggdGhpcy5wYW5lbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBORVc6IHdpcmUgc2xpZGVyL251bWJlci91bml0IHN5bmNpbmcgZm9yIGxlbmd0aCAmIHJhbmdlX251bWJlciBncm91cHMuXHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHdpcmVfbGVuX2dyb3VwKCB0aGlzLnBhbmVsICk7XHJcblx0XHRcdFx0XHRpbml0X2NvbG9yaXNfcGlja2VycyggdGhpcy5wYW5lbCApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0X3dwYmM/LmRldj8uZXJyb3I/LiggJ2luc3BlY3Rvci5fcG9zdF9yZW5kZXJfdWknLCBlICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0X2FwcGx5X2NvbnRyb2xfZnJvbV9ldmVudChlKSB7XHJcblx0XHRcdGlmICggIXRoaXMucGFuZWwuY29udGFpbnMoIGUudGFyZ2V0ICkgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCB0ICAgPSAvKiogQHR5cGUge0hUTUxJbnB1dEVsZW1lbnR8SFRNTFRleHRBcmVhRWxlbWVudHxIVE1MU2VsZWN0RWxlbWVudH0gKi8gKGUudGFyZ2V0KTtcclxuXHRcdFx0Y29uc3Qga2V5ID0gdD8uZGF0YXNldD8uaW5zcGVjdG9yS2V5O1xyXG5cdFx0XHRpZiAoICFrZXkgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBlbCA9IHRoaXMuc2VsZWN0ZWRfZWw7XHJcblx0XHRcdGlmICggIWVsIHx8ICFkb2N1bWVudC5ib2R5LmNvbnRhaW5zKCBlbCApICkgcmV0dXJuO1xyXG5cclxuXHRcdFx0bGV0IHY7XHJcblx0XHRcdGlmICggdCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgdC50eXBlID09PSAnY2hlY2tib3gnICkge1xyXG5cdFx0XHRcdHYgPSAhIXQuY2hlY2tlZDtcclxuXHRcdFx0XHR0LnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsIHYgPyAndHJ1ZScgOiAnZmFsc2UnICk7ICAgICAgICAgLy8gS2VlcCBBUklBIHN0YXRlIGluIHN5bmMgZm9yIHRvZ2dsZXMgKHNjaGVtYSBhbmQgdGVtcGxhdGUgcGF0aHMpLlxyXG5cdFx0XHR9IGVsc2UgaWYgKCB0IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiB0LnR5cGUgPT09ICdudW1iZXInICkge1xyXG5cdFx0XHRcdHYgPSAodC52YWx1ZSA9PT0gJycgPyAnJyA6IE51bWJlciggdC52YWx1ZSApKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2ID0gdC52YWx1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBrZXkgPT09ICdpZCcgKSB7XHJcblx0XHRcdFx0Y29uc3QgdW5pcXVlID0gdGhpcy5idWlsZGVyPy5pZD8uc2V0X2ZpZWxkX2lkPy4oIGVsLCB2ICk7XHJcblx0XHRcdFx0aWYgKCB1bmlxdWUgIT0gbnVsbCAmJiB0LnZhbHVlICE9PSB1bmlxdWUgKSB0LnZhbHVlID0gdW5pcXVlO1xyXG5cclxuXHRcdFx0fSBlbHNlIGlmICgga2V5ID09PSAnbmFtZScgKSB7XHJcblx0XHRcdFx0Y29uc3QgdW5pcXVlID0gdGhpcy5idWlsZGVyPy5pZD8uc2V0X2ZpZWxkX25hbWU/LiggZWwsIHYgKTtcclxuXHRcdFx0XHRpZiAoIHVuaXF1ZSAhPSBudWxsICYmIHQudmFsdWUgIT09IHVuaXF1ZSApIHQudmFsdWUgPSB1bmlxdWU7XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBrZXkgPT09ICdodG1sX2lkJyApIHtcclxuXHRcdFx0XHRjb25zdCBhcHBsaWVkID0gdGhpcy5idWlsZGVyPy5pZD8uc2V0X2ZpZWxkX2h0bWxfaWQ/LiggZWwsIHYgKTtcclxuXHRcdFx0XHRpZiAoIGFwcGxpZWQgIT0gbnVsbCAmJiB0LnZhbHVlICE9PSBhcHBsaWVkICkgdC52YWx1ZSA9IGFwcGxpZWQ7XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBrZXkgPT09ICdjb2x1bW5zJyAmJiBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRjb25zdCB2X2ludCA9IHBhcnNlSW50KCBTdHJpbmcoIHYgKSwgMTAgKTtcclxuXHRcdFx0XHRpZiAoIE51bWJlci5pc0Zpbml0ZSggdl9pbnQgKSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IGNsYW1wZWQgPSB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfU2FuaXRpemUuY2xhbXAoIHZfaW50LCAxLCA0ICk7XHJcblx0XHRcdFx0XHR0aGlzLmJ1aWxkZXI/LnNldF9zZWN0aW9uX2NvbHVtbnM/LiggZWwsIGNsYW1wZWQgKTtcclxuXHRcdFx0XHRcdGlmICggU3RyaW5nKCBjbGFtcGVkICkgIT09IHQudmFsdWUgKSB0LnZhbHVlID0gU3RyaW5nKCBjbGFtcGVkICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRpZiAoIHQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIHQudHlwZSA9PT0gJ2NoZWNrYm94JyApIHtcclxuXHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtJyArIGtleSwgU3RyaW5nKCAhIXYgKSApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIHQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIHQudHlwZSA9PT0gJ251bWJlcicgKSB7XHJcblx0XHRcdFx0XHRpZiAoIHQudmFsdWUgPT09ICcnIHx8ICFOdW1iZXIuaXNGaW5pdGUoIHYgKSApIHtcclxuXHRcdFx0XHRcdFx0ZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS0nICsga2V5ICk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRlbC5zZXRBdHRyaWJ1dGUoICdkYXRhLScgKyBrZXksIFN0cmluZyggdiApICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIGlmICggdiA9PSBudWxsICkge1xyXG5cdFx0XHRcdFx0ZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS0nICsga2V5ICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGVsLnNldEF0dHJpYnV0ZSggJ2RhdGEtJyArIGtleSwgKHR5cGVvZiB2ID09PSAnb2JqZWN0JykgPyBKU09OLnN0cmluZ2lmeSggdiApIDogU3RyaW5nKCB2ICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFVwZGF0ZSBwcmV2aWV3L292ZXJsYXlcclxuXHRcdFx0aWYgKCBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgKSB7XHJcblx0XHRcdFx0aWYgKCB0aGlzLmJ1aWxkZXI/LnByZXZpZXdfbW9kZSApIHRoaXMuYnVpbGRlci5yZW5kZXJfcHJldmlldyggZWwgKTtcclxuXHRcdFx0XHRlbHNlIHRoaXMuYnVpbGRlci5hZGRfb3ZlcmxheV90b29sYmFyKCBlbCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRoaXMuYnVpbGRlci5hZGRfb3ZlcmxheV90b29sYmFyKCBlbCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHRoaXMuX25lZWRzX3JlcmVuZGVyKCBlbCwga2V5LCBlICkgKSB7XHJcblx0XHRcdFx0dGhpcy5fc2NoZWR1bGVfcmVuZGVyX3ByZXNlcnZpbmdfZm9jdXMoIDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9uZWVkc19yZXJlbmRlcihlbCwga2V5LCBfZSkge1xyXG5cdFx0XHRpZiAoIGVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICYmIGtleSA9PT0gJ2NvbHVtbnMnICkgcmV0dXJuIHRydWU7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRiaW5kX3RvX2ZpZWxkKGZpZWxkX2VsKSB7XHJcblx0XHRcdHRoaXMuc2VsZWN0ZWRfZWwgPSBmaWVsZF9lbDtcclxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdH1cclxuXHJcblx0XHRjbGVhcigpIHtcclxuXHRcdFx0dGhpcy5zZWxlY3RlZF9lbCA9IG51bGw7XHJcblx0XHRcdGlmICggdGhpcy5fcmVuZGVyX3RpbWVyICkge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCggdGhpcy5fcmVuZGVyX3RpbWVyICk7XHJcblx0XHRcdFx0dGhpcy5fcmVuZGVyX3RpbWVyID0gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBBbHNvIGNsZWFyIHRoZSBzZWN0aW9uLWNvbHMgaGludCBvbiBlbXB0eSBzdGF0ZS5cclxuXHRcdFx0dGhpcy5wYW5lbC5yZW1vdmVBdHRyaWJ1dGUoJ2RhdGEtYmZiLXNlY3Rpb24tY29scycpO1xyXG5cdFx0XHR0aGlzLnBhbmVsLmlubmVySFRNTCA9ICc8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2luc3BlY3Rvcl9fZW1wdHlcIj5TZWxlY3QgYSBmaWVsZCB0byBlZGl0IGl0cyBvcHRpb25zLjwvZGl2Pic7XHJcblx0XHR9XHJcblxyXG5cdFx0X3NjaGVkdWxlX3JlbmRlcl9wcmVzZXJ2aW5nX2ZvY3VzKGRlbGF5ID0gMjAwKSB7XHJcblx0XHRcdGNvbnN0IGFjdGl2ZSAgICA9IC8qKiBAdHlwZSB7SFRNTElucHV0RWxlbWVudHxIVE1MVGV4dEFyZWFFbGVtZW50fEhUTUxFbGVtZW50fG51bGx9ICovIChkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtcclxuXHRcdFx0Y29uc3QgYWN0aXZlS2V5ID0gYWN0aXZlPy5kYXRhc2V0Py5pbnNwZWN0b3JLZXkgfHwgbnVsbDtcclxuXHRcdFx0bGV0IHNlbFN0YXJ0ICAgID0gbnVsbCwgc2VsRW5kID0gbnVsbDtcclxuXHJcblx0XHRcdGlmICggYWN0aXZlICYmICdzZWxlY3Rpb25TdGFydCcgaW4gYWN0aXZlICYmICdzZWxlY3Rpb25FbmQnIGluIGFjdGl2ZSApIHtcclxuXHRcdFx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRcdFx0c2VsU3RhcnQgPSBhY3RpdmUuc2VsZWN0aW9uU3RhcnQ7XHJcblx0XHRcdFx0Ly8gQHRzLWlnbm9yZVxyXG5cdFx0XHRcdHNlbEVuZCAgID0gYWN0aXZlLnNlbGVjdGlvbkVuZDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCB0aGlzLl9yZW5kZXJfdGltZXIgKSBjbGVhclRpbWVvdXQoIHRoaXMuX3JlbmRlcl90aW1lciApO1xyXG5cdFx0XHR0aGlzLl9yZW5kZXJfdGltZXIgPSAvKiogQHR5cGUge3Vua25vd259ICovIChzZXRUaW1lb3V0KCAoKSA9PiB7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdFx0XHRpZiAoIGFjdGl2ZUtleSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IG5leHQgPSAvKiogQHR5cGUge0hUTUxJbnB1dEVsZW1lbnR8SFRNTFRleHRBcmVhRWxlbWVudHxIVE1MRWxlbWVudHxudWxsfSAqLyAoXHJcblx0XHRcdFx0XHRcdHRoaXMucGFuZWwucXVlcnlTZWxlY3RvciggYFtkYXRhLWluc3BlY3Rvci1rZXk9XCIke2FjdGl2ZUtleX1cIl1gIClcclxuXHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRpZiAoIG5leHQgKSB7XHJcblx0XHRcdFx0XHRcdG5leHQuZm9jdXMoKTtcclxuXHRcdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIHNlbFN0YXJ0ICE9IG51bGwgJiYgc2VsRW5kICE9IG51bGwgJiYgdHlwZW9mIG5leHQuc2V0U2VsZWN0aW9uUmFuZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHQvLyBAdHMtaWdub3JlXHJcblx0XHRcdFx0XHRcdFx0XHRuZXh0LnNldFNlbGVjdGlvblJhbmdlKCBzZWxTdGFydCwgc2VsRW5kICk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9IGNhdGNoKCBlICl7IF93cGJjPy5kZXY/LmVycm9yKCAnX3JlbmRlcl90aW1lcicsIGUgKTsgfVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSwgZGVsYXkgKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmVuZGVyKCkge1xyXG5cclxuXHRcdFx0Y29uc3QgZWwgPSB0aGlzLnNlbGVjdGVkX2VsO1xyXG5cdFx0XHRpZiAoICFlbCB8fCAhZG9jdW1lbnQuYm9keS5jb250YWlucyggZWwgKSApIHJldHVybiB0aGlzLmNsZWFyKCk7XHJcblxyXG5cdFx0XHQvLyBSZXNldCBzZWN0aW9uLWNvbHMgaGludCB1bmxlc3Mgd2Ugc2V0IGl0IGxhdGVyIGZvciBhIHNlY3Rpb24uXHJcblx0XHRcdHRoaXMucGFuZWwucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS1iZmItc2VjdGlvbi1jb2xzJyApO1xyXG5cclxuXHRcdFx0Y29uc3QgcHJldl9zY3JvbGwgPSB0aGlzLnBhbmVsLnNjcm9sbFRvcDtcclxuXHJcblx0XHRcdC8vIFNlY3Rpb25cclxuXHRcdFx0aWYgKCBlbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRsZXQgdHBsID0gbnVsbDtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0dHBsID0gKHcud3AgJiYgd3AudGVtcGxhdGUgJiYgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd0bXBsLXdwYmMtYmZiLWluc3BlY3Rvci1zZWN0aW9uJyApKSA/IHdwLnRlbXBsYXRlKCAnd3BiYy1iZmItaW5zcGVjdG9yLXNlY3Rpb24nICkgOiBudWxsO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfICkge1xyXG5cdFx0XHRcdFx0dHBsID0gbnVsbDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggdHBsICkge1xyXG5cdFx0XHRcdFx0dGhpcy5wYW5lbC5pbm5lckhUTUwgPSB0cGwoIHt9ICk7XHJcblx0XHRcdFx0XHR0aGlzLl9lbmZvcmNlX2RlZmF1bHRfZ3JvdXBfb3BlbigpO1xyXG5cdFx0XHRcdFx0dGhpcy5fc2V0X3BhbmVsX3NlY3Rpb25fY29scyggZWwgKTtcclxuXHRcdFx0XHRcdHRoaXMuX3Bvc3RfcmVuZGVyX3VpKCk7XHJcblx0XHRcdFx0XHR0aGlzLnBhbmVsLnNjcm9sbFRvcCA9IHByZXZfc2Nyb2xsO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3QgRmFjdG9yeSA9IHcuV1BCQ19CRkJfQ29yZS5VSSAmJiB3LldQQkNfQkZCX0NvcmUuVUkuV1BCQ19CRkJfSW5zcGVjdG9yX0ZhY3Rvcnk7XHJcblx0XHRcdFx0Y29uc3Qgc2NoZW1hcyA9IHcuV1BCQ19CRkJfU2NoZW1hcyB8fCB7fTtcclxuXHRcdFx0XHRjb25zdCBlbnRyeSAgID0gc2NoZW1hc1snc2VjdGlvbiddIHx8IG51bGw7XHJcblx0XHRcdFx0aWYgKCBlbnRyeSAmJiBGYWN0b3J5ICkge1xyXG5cdFx0XHRcdFx0dGhpcy5wYW5lbC5pbm5lckhUTUwgPSAnJztcclxuXHRcdFx0XHRcdEZhY3RvcnkucmVuZGVyKFxyXG5cdFx0XHRcdFx0XHR0aGlzLnBhbmVsLFxyXG5cdFx0XHRcdFx0XHRlbnRyeSxcclxuXHRcdFx0XHRcdFx0e30sXHJcblx0XHRcdFx0XHRcdHsgZWwsIGJ1aWxkZXI6IHRoaXMuYnVpbGRlciwgdHlwZTogJ3NlY3Rpb24nLCB0aXRsZTogZW50cnkubGFiZWwgfHwgJ1NlY3Rpb24nIH1cclxuXHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR0aGlzLl9lbmZvcmNlX2RlZmF1bHRfZ3JvdXBfb3BlbigpO1xyXG5cclxuXHRcdFx0XHRcdC8vIC0tLSBTYWZldHkgbmV0OiBpZiBmb3IgYW55IHJlYXNvbiB0aGUgc2xvdCBkaWRu4oCZdCByZW5kZXIgY2hpcHMsIGluamVjdCB0aGVtIG5vdy5cclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGhhc1Nsb3RIb3N0ID1cclxuXHRcdFx0XHRcdFx0XHRcdCAgdGhpcy5wYW5lbC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtYmZiLXNsb3Q9XCJsYXlvdXRfY2hpcHNcIl0nICkgfHxcclxuXHRcdFx0XHRcdFx0XHRcdCAgdGhpcy5wYW5lbC5xdWVyeVNlbGVjdG9yKCAnLmluc3BlY3Rvcl9fcm93LS1sYXlvdXQtY2hpcHMgLndwYmNfYmZiX19sYXlvdXRfY2hpcHMnICkgfHxcclxuXHRcdFx0XHRcdFx0XHRcdCAgdGhpcy5wYW5lbC5xdWVyeVNlbGVjdG9yKCAnI3dwYmNfYmZiX19sYXlvdXRfY2hpcHNfaG9zdCcgKTtcclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IGhhc0NoaXBzID1cclxuXHRcdFx0XHRcdFx0XHRcdCAgISF0aGlzLnBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2xheW91dF9jaGlwJyApO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAhaGFzQ2hpcHMgKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gQ3JlYXRlIGEgaG9zdCBpZiBtaXNzaW5nIGFuZCByZW5kZXIgY2hpcHMgaW50byBpdC5cclxuXHRcdFx0XHRcdFx0XHRjb25zdCBob3N0ID0gKGZ1bmN0aW9uIGVuc3VyZUhvc3Qocm9vdCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0bGV0IGggPVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLWJmYi1zbG90PVwibGF5b3V0X2NoaXBzXCJdJyApIHx8XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yKCAnLmluc3BlY3Rvcl9fcm93LS1sYXlvdXQtY2hpcHMgLndwYmNfYmZiX19sYXlvdXRfY2hpcHMnICkgfHxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3IoICcjd3BiY19iZmJfX2xheW91dF9jaGlwc19ob3N0JyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKCBoICkgcmV0dXJuIGg7XHJcblx0XHRcdFx0XHRcdFx0XHQvLyBGYWxsYmFjayBob3N0IGluc2lkZSAob3IgYWZ0ZXIpIHRoZSDigJxsYXlvdXTigJ0gZ3JvdXBcclxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGZpZWxkcyAgICA9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0ICByb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2luc3BlY3Rvcl9fZ3JvdXBbZGF0YS1ncm91cD1cImxheW91dFwiXSAuZ3JvdXBfX2ZpZWxkcycgKSB8fFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCAgcm9vdC5xdWVyeVNlbGVjdG9yKCAnLmdyb3VwX19maWVsZHMnICkgfHwgcm9vdDtcclxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJvdyAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRyb3cuY2xhc3NOYW1lICAgPSAnaW5zcGVjdG9yX19yb3cgaW5zcGVjdG9yX19yb3ctLWxheW91dC1jaGlwcyc7XHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBsYWIgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGFiZWwnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRsYWIuY2xhc3NOYW1lICAgPSAnaW5zcGVjdG9yX19sYWJlbCc7XHJcblx0XHRcdFx0XHRcdFx0XHRsYWIudGV4dENvbnRlbnQgPSAnTGF5b3V0JztcclxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGN0bCAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRjdGwuY2xhc3NOYW1lICAgPSAnaW5zcGVjdG9yX19jb250cm9sJztcclxuXHRcdFx0XHRcdFx0XHRcdGggICAgICAgICAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRoLmNsYXNzTmFtZSAgICAgPSAnd3BiY19iZmJfX2xheW91dF9jaGlwcyc7XHJcblx0XHRcdFx0XHRcdFx0XHRoLnNldEF0dHJpYnV0ZSggJ2RhdGEtYmZiLXNsb3QnLCAnbGF5b3V0X2NoaXBzJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y3RsLmFwcGVuZENoaWxkKCBoICk7XHJcblx0XHRcdFx0XHRcdFx0XHRyb3cuYXBwZW5kQ2hpbGQoIGxhYiApO1xyXG5cdFx0XHRcdFx0XHRcdFx0cm93LmFwcGVuZENoaWxkKCBjdGwgKTtcclxuXHRcdFx0XHRcdFx0XHRcdGZpZWxkcy5hcHBlbmRDaGlsZCggcm93ICk7XHJcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gaDtcclxuXHRcdFx0XHRcdFx0XHR9KSggdGhpcy5wYW5lbCApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjb25zdCBMID0gKHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuVUkgJiYgdy5XUEJDX0JGQl9Db3JlLlVJLldQQkNfQkZCX0xheW91dF9DaGlwcykgO1xyXG5cdFx0XHRcdFx0XHRcdGlmICggTCAmJiB0eXBlb2YgTC5yZW5kZXJfZm9yX3NlY3Rpb24gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRob3N0LmlubmVySFRNTCA9ICcnO1xyXG5cdFx0XHRcdFx0XHRcdFx0TC5yZW5kZXJfZm9yX3NlY3Rpb24oIHRoaXMuYnVpbGRlciwgZWwsIGhvc3QgKTtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gY2F0Y2goIGUgKXsgX3dwYmM/LmRldj8uZXJyb3IoICdXUEJDX0JGQl9JbnNwZWN0b3IgLSByZW5kZXInLCBlICk7IH1cclxuXHJcblx0XHRcdFx0XHR0aGlzLl9zZXRfcGFuZWxfc2VjdGlvbl9jb2xzKCBlbCApO1xyXG5cdFx0XHRcdFx0dGhpcy5wYW5lbC5zY3JvbGxUb3AgPSBwcmV2X3Njcm9sbDtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9faW5zcGVjdG9yX19lbXB0eVwiPlNlbGVjdCBhIGZpZWxkIHRvIGVkaXQgaXRzIG9wdGlvbnMuPC9kaXY+JztcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZpZWxkXHJcblx0XHRcdGlmICggIWVsLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSApIHJldHVybiB0aGlzLmNsZWFyKCk7XHJcblxyXG5cdFx0XHRjb25zdCBkYXRhID0gdy5XUEJDX0JGQl9Db3JlLldQQkNfRm9ybV9CdWlsZGVyX0hlbHBlci5nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggZWwgKTtcclxuXHRcdFx0Y29uc3QgdHlwZSA9IGRhdGEudHlwZSB8fCAndGV4dCc7XHJcblxyXG5cdFx0XHRmdW5jdGlvbiBfZ2V0X3RwbChpZCkge1xyXG5cdFx0XHRcdGlmICggIXcud3AgfHwgIXdwLnRlbXBsYXRlICkgcmV0dXJuIG51bGw7XHJcblx0XHRcdFx0aWYgKCAhZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd0bXBsLScgKyBpZCApICkgcmV0dXJuIG51bGw7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHJldHVybiB3cC50ZW1wbGF0ZSggaWQgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgdHBsX2lkICAgICAgPSBgd3BiYy1iZmItaW5zcGVjdG9yLSR7dHlwZX1gO1xyXG5cdFx0XHRjb25zdCB0cGwgICAgICAgICA9IF9nZXRfdHBsKCB0cGxfaWQgKTtcclxuXHRcdFx0Y29uc3QgZ2VuZXJpY190cGwgPSBfZ2V0X3RwbCggJ3dwYmMtYmZiLWluc3BlY3Rvci1nZW5lcmljJyApO1xyXG5cclxuXHRcdFx0Y29uc3Qgc2NoZW1hcyAgICAgICAgID0gdy5XUEJDX0JGQl9TY2hlbWFzIHx8IHt9O1xyXG5cdFx0XHRjb25zdCBzY2hlbWFfZm9yX3R5cGUgPSBzY2hlbWFzW3R5cGVdIHx8IG51bGw7XHJcblx0XHRcdGNvbnN0IEZhY3RvcnkgICAgICAgICA9IHcuV1BCQ19CRkJfQ29yZS5VSSAmJiB3LldQQkNfQkZCX0NvcmUuVUkuV1BCQ19CRkJfSW5zcGVjdG9yX0ZhY3Rvcnk7XHJcblxyXG5cdFx0XHRpZiAoIHRwbCApIHtcclxuXHRcdFx0XHQvLyBORVc6IG1lcmdlIHNjaGVtYSBkZWZhdWx0cyBzbyBtaXNzaW5nIGtleXMgKGVzcC4gYm9vbGVhbnMpIGhvbm9yIGRlZmF1bHRzIG9uIGZpcnN0IHBhaW50XHJcblx0XHRcdFx0Y29uc3QgaGFzT3duID0gRnVuY3Rpb24uY2FsbC5iaW5kKCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5ICk7XHJcblx0XHRcdFx0Y29uc3QgcHJvcHMgID0gKHNjaGVtYV9mb3JfdHlwZSAmJiBzY2hlbWFfZm9yX3R5cGUuc2NoZW1hICYmIHNjaGVtYV9mb3JfdHlwZS5zY2hlbWEucHJvcHMpID8gc2NoZW1hX2Zvcl90eXBlLnNjaGVtYS5wcm9wcyA6IHt9O1xyXG5cdFx0XHRcdGNvbnN0IG1lcmdlZCA9IHsgLi4uZGF0YSB9O1xuXHRcdFx0XHRpZiAoIHByb3BzICkge1xuXHRcdFx0XHRcdE9iamVjdC5rZXlzKCBwcm9wcyApLmZvckVhY2goIChrKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBtZXRhID0gcHJvcHNba10gfHwge307XG5cdFx0XHRcdFx0XHRpZiAoICFoYXNPd24oIGRhdGEsIGsgKSApIHtcblx0XHRcdFx0XHRcdFx0aWYgKCBoYXNPd24oIG1ldGEsICdkZWZhdWx0JyApICkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIENvZXJjZSBib29sZWFucyB0byBhIHJlYWwgYm9vbGVhbjsgbGVhdmUgb3RoZXJzIGFzLWlzXG5cdFx0XHRcdFx0XHRcdFx0bWVyZ2VkW2tdID0gKG1ldGEudHlwZSA9PT0gJ2Jvb2xlYW4nKSA/ICEhbWV0YS5kZWZhdWx0IDogbWV0YS5kZWZhdWx0O1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCBtZXRhLnR5cGUgPT09ICdib29sZWFuJyApIHtcblx0XHRcdFx0XHRcdFx0Ly8gRXhwbGljaXQgZW1wdHkgdmFsdWVzIGFyZSBsZWdhY3kgdW5jaGVja2VkIGJvb2xlYW5zLCBub3QgbWlzc2luZyBkZWZhdWx0cy5cblx0XHRcdFx0XHRcdFx0bWVyZ2VkW2tdID0gdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX1Nhbml0aXplLmNvZXJjZV9ib29sZWFuKCBkYXRhW2tdLCBmYWxzZSApO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggZGF0YVtrXSA9PT0gJycgJiYgaGFzT3duKCBtZXRhLCAnZGVmYXVsdCcgKSApIHtcblx0XHRcdFx0XHRcdFx0bWVyZ2VkW2tdID0gbWV0YS5kZWZhdWx0O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMucGFuZWwuaW5uZXJIVE1MID0gdHBsKCBtZXJnZWQgKTtcclxuXHJcblx0XHRcdFx0dGhpcy5fcG9zdF9yZW5kZXJfdWkoKTtcclxuXHRcdFx0fSBlbHNlIGlmICggc2NoZW1hX2Zvcl90eXBlICYmIEZhY3RvcnkgKSB7XHJcblx0XHRcdFx0dGhpcy5wYW5lbC5pbm5lckhUTUwgPSAnJztcclxuXHRcdFx0XHRGYWN0b3J5LnJlbmRlcihcclxuXHRcdFx0XHRcdHRoaXMucGFuZWwsXHJcblx0XHRcdFx0XHRzY2hlbWFfZm9yX3R5cGUsXHJcblx0XHRcdFx0XHR7IC4uLmRhdGEgfSxcclxuXHRcdFx0XHRcdHsgZWwsIGJ1aWxkZXI6IHRoaXMuYnVpbGRlciwgdHlwZSwgdGl0bGU6IGRhdGEubGFiZWwgfHwgJycgfVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdFx0Ly8gRW5zdXJlIHRvZ2dsZSBub3JtYWxpemVycyBhbmQgc2xpZGVyL251bWJlci91bml0IHdpcmluZyBhcmUgYXR0YWNoZWQuXHJcblx0XHRcdFx0dGhpcy5fcG9zdF9yZW5kZXJfdWkoKTtcclxuXHRcdFx0fSBlbHNlIGlmICggZ2VuZXJpY190cGwgKSB7XHJcblx0XHRcdFx0dGhpcy5wYW5lbC5pbm5lckhUTUwgPSBnZW5lcmljX3RwbCggeyAuLi5kYXRhIH0gKTtcclxuXHRcdFx0XHR0aGlzLl9wb3N0X3JlbmRlcl91aSgpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRjb25zdCBtc2cgICAgICAgICAgICA9IGBUaGVyZSBhcmUgbm8gSW5zcGVjdG9yIHdwLnRlbXBsYXRlIFwiJHt0cGxfaWR9XCIgb3IgU2NoZW1hIGZvciB0aGlzIFwiJHtTdHJpbmcoIHR5cGUgfHwgJycgKX1cIiBlbGVtZW50LmA7XHJcblx0XHRcdFx0dGhpcy5wYW5lbC5pbm5lckhUTUwgPSAnJztcclxuXHRcdFx0XHRjb25zdCBkaXYgICAgICAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdFx0ZGl2LmNsYXNzTmFtZSAgICAgICAgPSAnd3BiY19iZmJfX2luc3BlY3Rvcl9fZW1wdHknO1xyXG5cdFx0XHRcdGRpdi50ZXh0Q29udGVudCAgICAgID0gbXNnOyAvLyBzYWZlLlxyXG5cdFx0XHRcdHRoaXMucGFuZWwuYXBwZW5kQ2hpbGQoIGRpdiApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9lbmZvcmNlX2RlZmF1bHRfZ3JvdXBfb3BlbigpO1xyXG5cdFx0XHR0aGlzLnBhbmVsLnNjcm9sbFRvcCA9IHByZXZfc2Nyb2xsO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9lbmZvcmNlX2RlZmF1bHRfZ3JvdXBfb3BlbigpIHtcclxuXHRcdFx0Y29uc3QgZ3JvdXBzID0gQXJyYXkuZnJvbSggdGhpcy5wYW5lbC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19pbnNwZWN0b3JfX2dyb3VwJyApICk7XHJcblx0XHRcdGlmICggIWdyb3Vwcy5sZW5ndGggKSByZXR1cm47XHJcblxyXG5cdFx0XHRsZXQgZm91bmQgPSBmYWxzZTtcclxuXHRcdFx0Z3JvdXBzLmZvckVhY2goIChnKSA9PiB7XHJcblx0XHRcdFx0aWYgKCAhZm91bmQgJiYgZy5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1vcGVuJyApICkge1xyXG5cdFx0XHRcdFx0Zm91bmQgPSB0cnVlO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAoIGcuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtb3BlbicgKSApIHtcclxuXHRcdFx0XHRcdFx0Zy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtb3BlbicgKTtcclxuXHRcdFx0XHRcdFx0Zy5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICd3cGJjOmNvbGxhcHNpYmxlOmNsb3NlJywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Zy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtb3BlbicgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdGlmICggIWZvdW5kICkge1xyXG5cdFx0XHRcdGdyb3Vwc1swXS5jbGFzc0xpc3QuYWRkKCAnaXMtb3BlbicgKTtcclxuXHRcdFx0XHRncm91cHNbMF0uZGlzcGF0Y2hFdmVudCggbmV3IEV2ZW50KCAnd3BiYzpjb2xsYXBzaWJsZTpvcGVuJywgeyBidWJibGVzOiB0cnVlIH0gKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXQgZGF0YS1iZmItc2VjdGlvbi1jb2xzIG9uIHRoZSBpbnNwZWN0b3IgcGFuZWwgYmFzZWQgb24gdGhlIGN1cnJlbnQgc2VjdGlvbi5cclxuXHRcdCAqIFVzZXMgdGhlIHJlZ2lzdGVyZWQgY29tcHV0ZSBmbiBpZiBhdmFpbGFibGU7IGZhbGxzIGJhY2sgdG8gZGlyZWN0IERPTS5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHNlY3Rpb25FbFxyXG5cdFx0ICovXHJcblx0XHRfc2V0X3BhbmVsX3NlY3Rpb25fY29scyhzZWN0aW9uRWwpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQvLyBQcmVmZXIgdGhlIGFscmVhZHktcmVnaXN0ZXJlZCB2YWx1ZV9mcm9tIGhlbHBlciBpZiBwcmVzZW50LlxyXG5cdFx0XHRcdHZhciBjb21wdXRlID0gdy53cGJjX2JmYl9pbnNwZWN0b3JfZmFjdG9yeV92YWx1ZV9mcm9tICYmIHcud3BiY19iZmJfaW5zcGVjdG9yX2ZhY3RvcnlfdmFsdWVfZnJvbS5jb21wdXRlX3NlY3Rpb25fY29sdW1ucztcclxuXHJcblx0XHRcdFx0dmFyIGNvbHMgPSAxO1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIGNvbXB1dGUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRjb2xzID0gY29tcHV0ZSggeyBlbDogc2VjdGlvbkVsIH0gKSB8fCAxO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHQvLyBGYWxsYmFjazogY29tcHV0ZSBkaXJlY3RseSBmcm9tIHRoZSBET00uXHJcblx0XHRcdFx0XHR2YXIgcm93ID0gc2VjdGlvbkVsICYmIHNlY3Rpb25FbC5xdWVyeVNlbGVjdG9yKCAnOnNjb3BlID4gLndwYmNfYmZiX19yb3cnICk7XHJcblx0XHRcdFx0XHRjb2xzICAgID0gcm93ID8gKHJvdy5xdWVyeVNlbGVjdG9yQWxsKCAnOnNjb3BlID4gLndwYmNfYmZiX19jb2x1bW4nICkubGVuZ3RoIHx8IDEpIDogMTtcclxuXHRcdFx0XHRcdGlmICggY29scyA8IDEgKSBjb2xzID0gMTtcclxuXHRcdFx0XHRcdGlmICggY29scyA+IDQgKSBjb2xzID0gNDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGhpcy5wYW5lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLWJmYi1zZWN0aW9uLWNvbHMnLCBTdHJpbmcoIGNvbHMgKSApO1xyXG5cdFx0XHR9IGNhdGNoICggXyApIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRfY3JlYXRlX2ZhbGxiYWNrX3BhbmVsKCkge1xyXG5cdFx0XHRjb25zdCBwICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0XHRcdHAuaWQgICAgICAgID0gJ3dwYmNfYmZiX19pbnNwZWN0b3InO1xyXG5cdFx0XHRwLmNsYXNzTmFtZSA9ICd3cGJjX2JmYl9faW5zcGVjdG9yJztcclxuXHRcdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggcCApO1xyXG5cdFx0XHRyZXR1cm4gLyoqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH0gKi8gKHApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gRXhwb3J0IGNsYXNzICsgcmVhZHkgc2lnbmFsLlxyXG5cdHcuV1BCQ19CRkJfSW5zcGVjdG9yID0gV1BCQ19CRkJfSW5zcGVjdG9yO1xyXG5cdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZWFkeScgKSApO1xyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iXX0=
