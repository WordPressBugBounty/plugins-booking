/**
 * == How to add a new CSS style ? ==
 *
 * TL;DR: add a key in COL_PROPS (JS) -> reference its CSS var (CSS) → add a control in the inspector template (HTML).
 * Keep the JS default (def) and the CSS var() fallback identical.
 *
 * -- 1) Register the style in this JS (COL_PROPS)
 *
 *    // Length-like example:
 *    padding: { var: '--wpbc-bfb-col-padding', def: '0px', normalize: 'len' }
 *
 *    // Enum example:
 *    ac:  { var: '--wpbc-bfb-col-ac',  def: 'normal', normalize: { type: 'enum', values: ['normal','stretch','center','start','end','space-between','space-around','space-evenly'] } }
 *
 *    Notes:
 *    - Allowed normalizers: 'id' (passthrough), 'len' (px/rem/em/%), or {type:'enum',values:[...] }.
 *    - If you need a new normalizer, add it to NORMALIZE and reference its name here.
 *
 * -- 2) Wire the CSS variable (defaults + activation)
 *
 *    Authoritative CSS: ../includes/page-form-builder/__css/bfb_fields.css
 *    The fallback in var(--name, <fallback>) MUST MATCH COL_PROPS[key].def.
 *
 *    /* Mini preview (template “ghost” columns; always on) *\/
 *    .wpbc_bfb__section__cols > .wpbc_bfb__section__col {
 *      padding: var(--wpbc-bfb-col-padding, 0px);
 *      /* add other properties here using their vars *\/
 *    }
 *
 *    /* Real columns (only when styles are activated) *\/
 *    .wpbc_bfb_form .wpbc_bfb__section[data-colstyles-active="1"] > .wpbc_bfb__row > .wpbc_bfb__column {
 *      padding: var(--wpbc-bfb-col-padding, 0px);
 *    }
 *
 *    Where “default CSS settings” live:
 *    - The JS default: COL_PROPS[key].def (in this file) — used for parsing, preview, and activation checks.
 *    - The CSS fallback: var(--wpbc-bfb-col-<key>, <fallback>) — in bfb_section__columns.css, must equal the JS default.
 *
 * -- 3) Add an inspector control in the template (tmpl-wpbc-bfb-column-styles)
 *    File: ../includes/page-form-builder/field-packs/section/section-wptpl.php
 *
 *    <!-- Simple input (works for 'len', 'id', and many enums with text inputs) -->
 *    <div class="inspector__row">
 *      <label class="inspector__label inspector__w_40">Padding</label>
 *      <div class="inspector__control inspector__w_50">
 *        <input type="text" class="inspector__input" data-style-key="padding" data-col-idx="{{ i }}" placeholder="e.g., 8px or 0.5rem">
 *      </div>
 *    </div>
 *
 *    The generic change handler will:
 *    - read data-style-key,
 *    - normalize via COL_PROPS,
 *    - persist to data-col_styles (sparse JSON; defaults stripped),
 *    - toggle data-colstyles-active automatically,
 *    - and update preview + real columns.
 *
 * -- 4) (Optional) Split length controls (number + unit)
 *
 *    If your new length style is a pair (value + unit), mirror the 'gap' pattern:
 *      - two inputs with data-style-part="value" and data-style-part="unit"
 *      - use normalize: 'len' in COL_PROPS
 *    The shared on_change path combines and normalizes every registered split length control.
 *
 * -- 5) Activation & persistence (what happens under the hood)
 *
 *    - The service compares saved values vs COL_PROPS defaults. If any non-default exists, it sets
 *      data-colstyles-active="1" on the section and writes CSS vars to real columns.
 *    - When inactive, the service removes inline vars so CSS falls back to your default in var(..., fallback).
 *    - data-col_styles attribute stores a compact (sparse) JSON: only keys that differ from defaults are saved.
 *
 * Checklist before you ship:
 * [ ] COL_PROPS entry added with correct var name and def value
 * [ ] CSS var() fallback matches the JS default exactly
 * [ ] Inspector control present and uses data-style-key="<your key>"
 * [ ] (If split-value) both controls use data-style-part and the registry uses normalize: 'len'
 */


/**
 * UI: Column Styles (service + inspector component)
 * ---------------------------------------------------------------------------------
 * Splits column-style logic out of Section renderer:
 * - Service: UI.WPBC_BFB_Column_Styles (parse/stringify/apply/is_active/baseline)
 * - Inspector slot: UI.wpbc_bfb_column_styles (render_for_section / refresh_for_section)
 *
 * == File: /includes/page-form-builder/field-packs/section/_out/ui-column-styles.js
 *
 * @since     11.0.0
 * @modified  2026-09-19 16:30
 * @version   1.1.1
 */
(function ( w ) {
	'use strict';

	var Core = ( w.WPBC_BFB_Core = w.WPBC_BFB_Core || {} );
	var UI   = ( Core.UI = Core.UI || {} );

	var S   = Core.WPBC_BFB_Sanitize || {};
	var DOM = ( Core.WPBC_BFB_DOM && Core.WPBC_BFB_DOM.SELECTORS ) || {
		row    : '.wpbc_bfb__row',
		column : '.wpbc_bfb__column'
	};

	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Central registry of supported per-column CSS properties.
	 *
	 * Each entry describes how a logical style key maps to a CSS custom property
	 * written on the column element, its default value, and how to normalize user
	 * input before persisting/applying.
	 *
	 * key       — Short style key used in UI and persisted JSON.
	 * var       — CSS variable name written onto the DOM node style.
	 * def       — Default value if the style is unset/empty.
	 * normalize — Normalizer id or enum definition (`id`, `len`, `max_len`, or allowlisted values).
	 */
	var COL_PROPS = {
		dir  : { var: '--wpbc-bfb-col-dir',   def: 'column',        normalize: 'id'  },
		wrap : { var: '--wpbc-bfb-col-wrap',  def: 'nowrap',       normalize: 'id'  },
		jc   : { var: '--wpbc-bfb-col-jc',    def: 'flex-start', normalize: 'id'  },
		ai   : { var: '--wpbc-bfb-col-ai',    def: 'stretch',    normalize: 'id'  },
		gap  : { var: '--wpbc-bfb-col-gap',   def: '0px',        normalize: 'len' },
		padding: { var: '--wpbc-bfb-col-padding', def: '0px', normalize: 'len' },
		margin : { var: '--wpbc-bfb-col-margin',  def: '0px', normalize: 'len' },
		padding_top   : { var: '--wpbc-bfb-col-padding-top',    def: '0px', normalize: 'len' },
		padding_right : { var: '--wpbc-bfb-col-padding-right',  def: '0px', normalize: 'len' },
		padding_bottom: { var: '--wpbc-bfb-col-padding-bottom', def: '0px', normalize: 'len' },
		padding_left  : { var: '--wpbc-bfb-col-padding-left',   def: '0px', normalize: 'len' },
		margin_top    : { var: '--wpbc-bfb-col-margin-top',     def: '0.7em', normalize: 'len' },
		margin_right  : { var: '--wpbc-bfb-col-margin-right',   def: '0px', normalize: 'len' },
		margin_bottom : { var: '--wpbc-bfb-col-margin-bottom',  def: '0.7em', normalize: 'len' },
		margin_left   : { var: '--wpbc-bfb-col-margin-left',    def: '0px', normalize: 'len' },
		max_width     : { var: '--wpbc-bfb-col-max-width',      def: 'none', normalize: 'max_len' },
		max_height    : { var: '--wpbc-bfb-col-max-height',     def: 'none', normalize: 'max_len' },
		overflow      : {
			var: '--wpbc-bfb-col-overflow',
			def: 'visible',
			normalize: { type: 'enum', values: [ 'visible', 'auto', 'hidden' ] }
		},
		overflow_x    : {
			var: '--wpbc-bfb-col-overflow-x',
			def: 'visible',
			normalize: { type: 'enum', values: [ 'visible', 'auto', 'hidden' ] }
		},
		overflow_y    : {
			var: '--wpbc-bfb-col-overflow-y',
			def: 'visible',
			normalize: { type: 'enum', values: [ 'visible', 'auto', 'hidden' ] }
		},
		aself: { var: '--wpbc-bfb-col-aself', def: 'flex-start',
			normalize: { type: 'enum', values: [ 'flex-start', 'center', 'flex-end', 'stretch' ] }
		}
		// Example additions:
		// pad : { var: '--wpbc-bfb-col-pad', def: '0px',        normalize: 'len' }
	};

	var BOX_SIDE_GROUPS = {
		padding: [ 'padding_top', 'padding_right', 'padding_bottom', 'padding_left' ],
		margin : [ 'margin_top', 'margin_right', 'margin_bottom', 'margin_left' ]
	};

	var BOX_SIDE_KEYS = BOX_SIDE_GROUPS.padding.concat( BOX_SIDE_GROUPS.margin );
	var OVERFLOW_AXIS_KEYS = [ 'overflow_x', 'overflow_y' ];

	/**
	 * Normalize a "length-like" value (e.g., "8" → "8px").
	 * Accepts px/rem/em/%; expand the regex if you allow more units.
	 *
	 * @param {string|number} v
	 * @returns {string} normalized value (always non-empty)
	 */
	function norm_len( v ) {
		var sv = String( v || '' ).trim();
		if ( ! sv ) { return '0px'; }
		if ( /^\d+(\.\d+)?$/.test( sv ) ) { return sv + 'px'; }               // number -> px.
		if ( /^\d+(\.\d+)?(px|rem|em|%)$/.test( sv ) ) { return sv; }         // allowed units.
		return '0px';
	}

	/**
	 * Normalize an optional maximum dimension.
	 *
	 * Empty values and `none` remove the limit. Numeric values accept the units
	 * exposed by the Inspector and reject arbitrary CSS declarations.
	 *
	 * @param {string|number} candidate_value Candidate maximum dimension.
	 * @returns {string} Valid CSS maximum dimension or `none`.
	 */
	function norm_max_len( candidate_value ) {
		var normalized_value = String( candidate_value == null ? '' : candidate_value ).trim();
		if ( ! normalized_value || 'none' === normalized_value ) {
			return 'none';
		}
		if ( /^\d+(\.\d+)?$/.test( normalized_value ) ) {
			return normalized_value + 'px';
		}
		if ( /^\d+(\.\d+)?(px|rem|em|%|vh|vw)$/.test( normalized_value ) ) {
			return normalized_value;
		}
		return 'none';
	}

	/**
	 * Example:  ac: { var: '--wpbc-bfb-col-ac', def: 'normal', normalize: { type: 'enum', values: ['normal','stretch','center','start','end','space-between','space-around','space-evenly'] } }
	 *
	 * @param v
	 * @param vals
	 * @returns {string|*}
	 */
	function norm_enum(v, vals) {
		v = String( v || '' );
		return vals.indexOf( v ) !== -1 ? v : vals[0];
	}

	/**
	 * Normalizer registry. Extend to add custom validators/transforms
	 * (e.g., enums, numbers with ranges, etc.).
	 */
	var NORMALIZE = {
		id     : v => String( v || '' ),
		len    : norm_len,
		max_len: norm_max_len,
		enum   : (v, values) => norm_enum( v, values )
	};

	/**
	 * Check whether a style key is supported by COL_PROPS.
	 *
	 * @param {string} k
	 * @returns {boolean}
	 */
	function is_supported_key( k ) {
		return Object.prototype.hasOwnProperty.call( COL_PROPS, k );
	}

	/**
	 * Normalize a value for a given style key using its configured normalizer.
	 *
	 * @param {string} key
	 * @param {any} val
	 * @returns {string}
	 */
	function normalize_value(key, val) {
		var cfg = COL_PROPS[key];
		if ( ! cfg ) {
			return String( val || '' );
		}
		if ( cfg.normalize && typeof cfg.normalize === 'object' && cfg.normalize.type === 'enum' ) {
			return NORMALIZE.enum( val, cfg.normalize.values || [] );
		}
		var fn = NORMALIZE[cfg.normalize] || NORMALIZE.id;
		return fn( val );
	}

	/**
	 * Build a plain object containing defaults for all supported style keys.
	 *
	 * @returns {Record<string, string>}
	 */
	function get_defaults_obj() {
		var o = {}; for ( var k in COL_PROPS ) { if ( is_supported_key( k ) ) { o[k] = COL_PROPS[k].def; } }
		return o;
	}

	/**
	 * Resolve one padding or margin side from explicit or legacy shorthand data.
	 *
	 * @param {Record<string, string>} source_style Saved sparse column styles.
	 * @param {string}                 side_key     Explicit side key.
	 * @param {string}                 legacy_key   Legacy shorthand key.
	 * @param {Record<string, string>} defaults     Defaults for supported styles.
	 * @returns {string} Effective normalized side length.
	 */
	function get_effective_box_side( source_style, side_key, legacy_key, defaults ) {
		if ( Object.prototype.hasOwnProperty.call( source_style, side_key ) ) {
			return normalize_value( side_key, source_style[ side_key ] );
		}
		if ( Object.prototype.hasOwnProperty.call( source_style, legacy_key ) ) {
			return normalize_value( legacy_key, source_style[ legacy_key ] );
		}
		return defaults[ side_key ];
	}

	/**
	 * Return the padding or margin group that owns an explicit side key.
	 *
	 * @param {string} side_key Candidate side key.
	 * @returns {{legacy_key:string, side_keys:Array<string>}|null} Owning group.
	 */
	function get_box_side_group( side_key ) {
		for ( var legacy_key in BOX_SIDE_GROUPS ) {
			if ( Object.prototype.hasOwnProperty.call( BOX_SIDE_GROUPS, legacy_key ) && BOX_SIDE_GROUPS[ legacy_key ].indexOf( side_key ) !== -1 ) {
				return { legacy_key: legacy_key, side_keys: BOX_SIDE_GROUPS[ legacy_key ] };
			}
		}
		return null;
	}

	/**
	 * Convert one legacy shorthand group to explicit side values before saving.
	 *
	 * @param {Record<string, string>} style_object Effective column styles.
	 * @param {string}                 edited_key   Side key changed by the user.
	 * @returns {void}
	 */
	function promote_box_sides_to_explicit( style_object, edited_key ) {
		var box_group = get_box_side_group( edited_key );
		if ( ! box_group ) {
			return;
		}

		style_object.__has = style_object.__has || {};
		for ( var side_index = 0; side_index < box_group.side_keys.length; side_index++ ) {
			var side_key = box_group.side_keys[ side_index ];
			style_object[ side_key ] = normalize_value( side_key, style_object[ side_key ] );
			style_object.__has[ side_key ] = true;
		}

		delete style_object[ box_group.legacy_key ];
		style_object.__has[ box_group.legacy_key ] = false;
	}

	/**
	 * Resolve one axis from axis-specific data or the legacy shared overflow.
	 *
	 * @param {Record<string, string>} source_style Saved sparse column styles.
	 * @param {string}                 axis_key     `overflow_x` or `overflow_y`.
	 * @param {Record<string, string>} defaults     Registered style defaults.
	 * @returns {string} Effective allowlisted overflow value.
	 */
	function get_effective_overflow_axis( source_style, axis_key, defaults ) {
		if ( Object.prototype.hasOwnProperty.call( source_style, axis_key ) ) {
			return normalize_value( axis_key, source_style[ axis_key ] );
		}
		if ( Object.prototype.hasOwnProperty.call( source_style, 'overflow' ) ) {
			return normalize_value( axis_key, source_style.overflow );
		}
		return defaults[ axis_key ];
	}

	/**
	 * Promote a legacy shared overflow to explicit X and Y values on first edit.
	 *
	 * @param {Record<string, *>} style_object Mutable full style object.
	 * @returns {void}
	 */
	function promote_overflow_axes_to_explicit( style_object ) {
		if ( ! style_object || ! style_object.__has || true !== style_object.__has.overflow ) {
			return;
		}

		for ( var axis_index = 0; axis_index < OVERFLOW_AXIS_KEYS.length; axis_index++ ) {
			var axis_key = OVERFLOW_AXIS_KEYS[ axis_index ];
			style_object[ axis_key ] = normalize_value( axis_key, style_object[ axis_key ] );
			style_object.__has[ axis_key ] = true;
		}

		delete style_object.overflow;
		style_object.__has.overflow = false;
	}

	/**
	 * Check whether an explicit default must remain in sparse saved JSON.
	 *
	 * @param {string}                 style_key   Registered style key.
	 * @param {Record<string, boolean>} presence_map Saved-key presence map.
	 * @returns {boolean} Whether to preserve the explicit default value.
	 */
	function should_keep_explicit_default( style_key, presence_map ) {
		if ( ! presence_map || true !== presence_map[ style_key ] ) {
			return false;
		}
		return BOX_SIDE_KEYS.indexOf( style_key ) !== -1;
	}

	/**
	 * Reset allowlisted keys on one effective Inspector style object.
	 *
	 * The object is mutated intentionally. Legacy shorthand data is promoted
	 * first so resetting one side or axis preserves every unrelated effective
	 * value. Reset keys are marked absent for sparse persistence.
	 *
	 * @param {Record<string, *>} style_object Effective mutable column styles.
	 * @param {Array<string>}     requested_keys Candidate registered style keys.
	 * @returns {Array<string>} Supported keys reset to their registered defaults.
	 */
	function reset_style_keys_to_defaults( style_object, requested_keys ) {
		var style_keys = [];
		if ( ! style_object || ! Array.isArray( requested_keys ) ) {
			return style_keys;
		}

		for ( var requested_index = 0; requested_index < requested_keys.length; requested_index++ ) {
			if ( is_supported_key( requested_keys[ requested_index ] ) ) {
				style_keys.push( requested_keys[ requested_index ] );
			}
		}
		if ( ! style_keys.length ) {
			return style_keys;
		}

		style_object.__has = style_object.__has || {};
		for ( var promotion_index = 0; promotion_index < style_keys.length; promotion_index++ ) {
			var promotion_key = style_keys[ promotion_index ];
			if ( BOX_SIDE_KEYS.indexOf( promotion_key ) !== -1 ) {
				promote_box_sides_to_explicit( style_object, promotion_key );
			}
			if ( OVERFLOW_AXIS_KEYS.indexOf( promotion_key ) !== -1 ) {
				promote_overflow_axes_to_explicit( style_object );
			}
		}

		for ( var reset_index = 0; reset_index < style_keys.length; reset_index++ ) {
			var style_key = style_keys[ reset_index ];
			style_object[ style_key ] = COL_PROPS[ style_key ].def;
			style_object.__has[ style_key ] = false;
		}

		return style_keys;
	}

	/**
	 * Apply all CSS variables (from COL_PROPS) onto a node based on a style object.
	 * Missing/empty values fall back to defaults.
	 *
	 * @param {HTMLElement} node
	 * @param {Record<string, string>} style_obj
	 */
	function set_vars( node, style_obj ) {
		if ( ! node ) { return; }
		for ( var k in COL_PROPS ) { if ( is_supported_key( k ) ) {
			var cssVar = COL_PROPS[k].var;
			var v = ( style_obj && style_obj[k] != null && String( style_obj[k] ).trim() !== '' ) ? style_obj[k] : COL_PROPS[k].def;
			node.style.setProperty( cssVar, normalize_value( k, v ) );
		}}
	}

	function set_vars_sparse(node, style_obj) {
		if ( !node ) return;
		for ( var k in COL_PROPS ) { if ( is_supported_key(k) ) {
			var cssVar = COL_PROPS[k].var;
			if ( style_obj && Object.prototype.hasOwnProperty.call(style_obj, k) && String(style_obj[k]).trim() !== '' ) {
				node.style.setProperty(cssVar, normalize_value( k, style_obj[k] ));
			} else {
				// important: remove var instead of writing a default
				node.style.removeProperty(cssVar);
			}
		}}
	}

	/**
	 * Remove all CSS variables (from COL_PROPS) from a node.
	 *
	 * @param {HTMLElement} node
	 */
	function clear_vars( node ) {
		if ( ! node ) { return; }
		for ( var k in COL_PROPS ) { if ( is_supported_key( k ) ) {
			node.style.removeProperty( COL_PROPS[k].var );
		}}
	}

	/**
	 * Clamp helper for columns number.
	 *
	 * @param {number|string} n
	 * @returns {number}
	 */
	function clamp_cols( n ) {
		return ( S.clamp ? S.clamp( Number( n ) || 1, 1, 4 ) : Math.max( 1, Math.min( 4, Number( n ) || 1 ) ) );
	}

	/**
	 * Read actual number of columns from DOM.
	 *
	 * @param {HTMLElement} el
	 * @returns {number}
	 */
	function dom_cols( el ) {
		try {
			var row = el ? el.querySelector( ':scope > ' + DOM.row ) : null;
			var cnt = row ? row.querySelectorAll( ':scope > ' + DOM.column ).length : 1;
			return clamp_cols( cnt );
		} catch ( _e ) {
			return 1;
		}
	}

	// ------------------------------------------------------------------------------------------------
	// Service: Column Styles
	// ------------------------------------------------------------------------------------------------
	UI.WPBC_BFB_Column_Styles = {

		/**
		 * Reset a supported subset of one effective Inspector style object.
		 *
		 * @param {Record<string, *>} style_object Effective mutable column styles.
		 * @param {Array<string>}     style_keys Registered keys to reset.
		 * @returns {Array<string>} Supported keys that were reset.
		 */
		reset_style_keys : function ( style_object, style_keys ) {
			return reset_style_keys_to_defaults( style_object, style_keys );
		},

		/**
		 * Highlight a specific column in both the live canvas and the mini preview,
		 * and store the active index on the section.
		 *
		 * @param {HTMLElement} section_el
		 * @param {number|string} key_1based  1-based column index (clamped)
		 */
		set_selected_col_flag : function ( section_el, key_1based ) {
			if ( ! section_el ) { return; }
			var cols_cnt = dom_cols( section_el );
			var idx      = Math.min( Math.max( parseInt( key_1based, 10 ) || 1, 1 ), cols_cnt || 1 );
			var idx0     = idx - 1;

			section_el.setAttribute( 'data-selected-col', String( idx ) );

			// Real canvas columns.
			var row  = section_el.querySelector( ':scope > ' + DOM.row );
			var cols = row ? row.querySelectorAll( ':scope > ' + DOM.column ) : [];
			for ( var i = 0; i < cols.length; i++ ) {
				if ( cols[i].classList ) {
					cols[i].classList.toggle( 'is-selected-column', i === idx0 );
				}
			}

			// Mini preview columns.
			var pcols = section_el.querySelectorAll( ':scope .wpbc_bfb__section__cols > .wpbc_bfb__section__col' );
			for ( var j = 0; j < pcols.length; j++ ) {
				if ( pcols[j].classList ) {
					pcols[j].classList.toggle( 'is-selected-column', j === idx0 );
				}
			}
		},

		/**
		 * Remove column selection highlight from both canvas and mini preview.
		 *
		 * @param {HTMLElement} section_el
		 */
		clear_selected_col_flag : function ( section_el ) {
			if ( ! section_el ) { return; }
			section_el.removeAttribute( 'data-selected-col' );

			var row  = section_el.querySelector( ':scope > ' + DOM.row );
			var cols = row ? row.querySelectorAll( ':scope > ' + DOM.column ) : [];
			for ( var i = 0; i < cols.length; i++ ) {
				cols[i].classList && cols[i].classList.remove( 'is-selected-column' );
			}

			var pcols = section_el.querySelectorAll( ':scope .wpbc_bfb__section__cols > .wpbc_bfb__section__col' );
			for ( var j = 0; j < pcols.length; j++ ) {
				pcols[j].classList && pcols[j].classList.remove( 'is-selected-column' );
			}
		},



		/**
		 * Parse JSON string to array of per-column style objects.
		 *
		 * @param {string} s
		 * @returns {Array<{dir:string,wrap:string,jc:string,ai:string,gap:string,padding:string,margin:string,padding_top:string,padding_right:string,padding_bottom:string,padding_left:string,margin_top:string,margin_right:string,margin_bottom:string,margin_left:string,max_width:string,max_height:string,overflow:string,overflow_x:string,overflow_y:string,aself:string}>}
		 */
		parse_col_styles : function ( s ) {
			if ( ! s ) { return []; }
			var obj = ( S.safe_json_parse ? S.safe_json_parse( String( s ), null ) : ( function(){ try { return JSON.parse( String( s ) ); } catch( _e ){ return null; } } )() );
			if ( Array.isArray( obj ) ) { return obj; }
			if ( obj && typeof obj === 'object' && Array.isArray( obj.columns ) ) { return obj.columns; }
			return [];
		},

		/**
		 * Stringify styles array to canonical JSON.
		 *
		 * @param {Array} arr
		 * @returns {string}
		 */
		stringify_col_styles : function ( arr ) {
			var data = Array.isArray( arr ) ? arr : [];
			return ( S.stringify_data_value ? S.stringify_data_value( data ) : JSON.stringify( data ) );
		},

		/**
		 * Check if per-column styles are active for a section.
		 * - Active if element flag data-colstyles-active="1" OR non-empty serialized styles.
		 *
		 * @param {HTMLElement} section_el
		 * @returns {boolean}
		 */
		is_active : function ( section_el ) {
			if ( ! section_el ) { return false; }
			if ( section_el.getAttribute( 'data-colstyles-active' ) === '1' ) { return true; }
            var raw = section_el.getAttribute( 'data-col_styles' ) || ( section_el.dataset ? ( section_el.dataset.col_styles || '' ) : '' );
            var arr = this.parse_col_styles( raw );
            var DEF = get_defaults_obj();
            // Active only if any column has a non-default, non-empty override.
            for ( var i = 0; i < arr.length; i++ ) {
                var s = arr[i] || {};
                for ( var k in DEF ) {
                    if ( Object.prototype.hasOwnProperty.call( s, k ) ) {
                        var v = String( s[k] );
                        if ( v && v !== String( DEF[k] ) ) { return true; }
                    }
                }
            }
            return false;
		},

		/**
		 * Apply per-column styles to preview and, when active, to real columns.
		 *
		 * @param {HTMLElement} section_el
		 * @param {Array}       styles
		 */
		apply : function ( section_el, styles ) {
			if ( ! section_el ) { return; }

			// Mini preview inside the section template (always on).
			var preview = section_el.querySelector( ':scope .wpbc_bfb__section__cols' );
			if ( preview ) {
				var pcols = preview.querySelectorAll( ':scope > .wpbc_bfb__section__col' );
				for ( var i = 0; i < pcols.length; i++ ) {
					set_vars(pcols[i], styles[i] || {});   // OK to use defaults in preview
				}
			}

			// Determine activation from current element state (not from styles arg alone).
			var active = this.is_active( section_el );

			// If not active, clean up inline vars and remove the flag.
			if ( ! active ) {
				section_el.removeAttribute( 'data-colstyles-active' );
				var row_off = section_el.querySelector( ':scope > ' + DOM.row );
				if ( row_off ) {
					var nodes = row_off.querySelectorAll( ':scope > ' + DOM.column );
					for ( var j = 0; j < nodes.length; j++ ) {
						clear_vars( nodes[j] );
					}
				}
				return;
			}

			// Active: add flag if missing and write CSS vars to REAL canvas columns.
			section_el.setAttribute( 'data-colstyles-active', '1' );

			// NEW: always use the sparse, saved JSON for REAL columns.
			var use_styles = this.parse_col_styles(
				section_el.getAttribute( 'data-col_styles' ) ||
				(section_el.dataset ? (section_el.dataset.col_styles || '') : '')
			);

			var row = section_el.querySelector( ':scope > ' + DOM.row );
			if ( row ) {
				var rcols = row.querySelectorAll( ':scope > ' + DOM.column );
				for ( var k = 0; k < rcols.length; k++ ) {
					set_vars_sparse(rcols[k], use_styles[k] || {}); // only write what exists
				}
			}
		}
	};

	// ------------------------------------------------------------------------------------------------
	// Inspector component (slot: "column_styles")
	// ------------------------------------------------------------------------------------------------
	UI.wpbc_bfb_column_styles = {

		/**
		 * Render the per-column style editor (wp.template: 'wpbc-bfb-column-styles').
		 *
		 * @param {object}      builder
		 * @param {HTMLElement} section_el
		 * @param {HTMLElement} host
		 */
		render_for_section : function ( builder, section_el, host ) {
			if ( ! host || ! section_el ) { return; }

			// Capture current active tab BEFORE we clear host.
			var __prev_root = host.querySelector( '[data-wpbc-tabs]' );
			var ds          = section_el.dataset || {};
			var __prev_key  = (__prev_root && __prev_root.getAttribute( 'data-wpbc-tab-active' )) || host.__wpbc_active_key || ds.col_styles_active_tab || null;
			var column_control_tab_state = host.__wpbc_column_control_tab_state || {};
			var previous_control_tabs = host.querySelectorAll( '[data-column-control-tabs]' );
			for ( var previous_control_index = 0; previous_control_index < previous_control_tabs.length; previous_control_index++ ) {
				var previous_control_root = previous_control_tabs[ previous_control_index ];
				var previous_control_column = ( parseInt( previous_control_root.getAttribute( 'data-col-idx' ), 10 ) || 0 ) + 1;
				var previous_control_group = previous_control_root.getAttribute( 'data-column-control-tabs' ) || '';
				var previous_control_tab = previous_control_root.getAttribute( 'data-column-control-tab-active' ) || '';
				if ( previous_control_group && previous_control_tab ) {
					column_control_tab_state[ previous_control_column + '_' + previous_control_group ] = previous_control_tab;
				}
			}
			host.__wpbc_column_control_tab_state = column_control_tab_state;

			// Cleanup previous mount and clear.
			if ( host.__wpbc_cleanup ) {
				try { host.__wpbc_cleanup(); } catch ( _e ) {}
				host.__wpbc_cleanup = null;
			}
			host.innerHTML = '';

			var tpl = ( w.wp && w.wp.template ) ? w.wp.template( 'wpbc-bfb-column-styles' ) : null;
			if ( ! tpl ) { return; }

			var col_count  = dom_cols( section_el );
			var raw_json   = section_el.getAttribute( 'data-col_styles' ) || ( section_el.dataset ? ( section_el.dataset.col_styles || '' ) : '' );

			var saved_arr  = UI.WPBC_BFB_Column_Styles.parse_col_styles( raw_json );
			var styles_arr = [];

			// Normalize length to current columns (UI-only defaults do NOT auto-activate).
			var def = get_defaults_obj();
			for ( var i = 0; i < col_count; i++ ) {
				var src = saved_arr[i] || {};
                // Merge for display, but track which keys were actually present in saved JSON.
				var full = Object.assign( {}, def, src );
				full.max_width = normalize_value( 'max_width', full.max_width );
				full.max_height = normalize_value( 'max_height', full.max_height );
				full.overflow = normalize_value( 'overflow', full.overflow );
				full.overflow_x = get_effective_overflow_axis( src, 'overflow_x', def );
				full.overflow_y = get_effective_overflow_axis( src, 'overflow_y', def );
				for ( var legacy_box_key in BOX_SIDE_GROUPS ) {
					if ( ! Object.prototype.hasOwnProperty.call( BOX_SIDE_GROUPS, legacy_box_key ) ) {
						continue;
					}
					for ( var side_index = 0; side_index < BOX_SIDE_GROUPS[ legacy_box_key ].length; side_index++ ) {
						var side_key = BOX_SIDE_GROUPS[ legacy_box_key ][ side_index ];
						full[ side_key ] = get_effective_box_side( src, side_key, legacy_box_key, def );
					}
				}
				full.__has = {};
				for ( var style_key in def ) {
					if ( Object.prototype.hasOwnProperty.call( def, style_key ) ) {
						full.__has[ style_key ] = Object.prototype.hasOwnProperty.call( src, style_key );
					}
				}
                styles_arr[i] = full;
			}
			styles_arr.length = col_count;   // clamp.

			host.innerHTML = tpl( {
				cols        : col_count,
				styles      : styles_arr,
				active      : UI.WPBC_BFB_Column_Styles.is_active( section_el ),
				control_tabs: column_control_tab_state
			} );

			var column_control_tab_roots = host.querySelectorAll( '[data-column-control-tabs]' );
			for ( var control_root_index = 0; control_root_index < column_control_tab_roots.length; control_root_index++ ) {
				var control_root = column_control_tab_roots[ control_root_index ];
				activate_column_control_tab( control_root, control_root.getAttribute( 'data-column-control-tab-active' ) || '', false );
			}

			if ( window.wpbc_ui_tabs && host ) {
				window.wpbc_ui_tabs.init_on( host );


				// Persist the active tab so we can restore it after re-renders.
				var tabsRoot = host.querySelector( '[data-wpbc-tabs]' );
				if ( tabsRoot && !tabsRoot.__wpbc_persist_listener ) {
					tabsRoot.__wpbc_persist_listener = true;
					tabsRoot.addEventListener( 'wpbc:tabs:change', function (e) {
						var k = e && e.detail && e.detail.active_key;
						if ( k ) {
							host.__wpbc_active_key = String( k );
							if ( section_el && section_el.dataset ) {
								section_el.dataset.col_styles_active_tab = String( k );
							}
							// NEW: reflect selection on the section + columns.
							UI.WPBC_BFB_Column_Styles.set_selected_col_flag( section_el, k );
						}
					}, true );

				}

				// Restore previous tab if it still exists (clamp to new count).
				var __key
				if ( __prev_key ) {
					var __new_root = host.querySelector( '[data-wpbc-tabs]' );
					__key          = String( Math.min( Math.max( parseInt( __prev_key, 10 ) || 1, 1 ), col_count ) );
					if ( __new_root && window.wpbc_ui_tabs.set_active ) {
						window.wpbc_ui_tabs.set_active( __new_root, __key );
					}
				}

				// After restoring the tab, ensure highlight matches the active tab.
				var __active_key_now = __key || (ds.col_styles_active_tab ? String( Math.min( Math.max( parseInt( ds.col_styles_active_tab, 10 ) || 1, 1 ), col_count ) ) : '1');
				UI.WPBC_BFB_Column_Styles.set_selected_col_flag( section_el, __active_key_now );
			}

			// Re-wire number - range pairing (ValueSlider) for freshly rendered controls.
			try {
				UI.InspectorEnhancers && UI.InspectorEnhancers.scan && UI.InspectorEnhancers.scan( host );
				// Alternatively (direct wiring):
				// UI.WPBC_BFB_ValueSlider && UI.WPBC_BFB_ValueSlider.init_on && UI.WPBC_BFB_ValueSlider.init_on( host );
			} catch ( _e ) {}

			// Inspector markup is replaced on every render, so initialize tooltips for the fresh help controls.
			if ( 'function' === typeof w.wpbc_define_tippy_tooltips ) {
				w.wpbc_define_tippy_tooltips( '[data-bfb-slot="column_styles"] ' );
			}

			// Set initial state of ICONS (including defaults) is correct.
			sync_axis_rotation_all();

			function styles_has_any_non_default(styles_arr, get_defaults_obj_fn) {
				var def = get_defaults_obj_fn();
				for ( var i = 0; i < styles_arr.length; i++ ) {
					var s = styles_arr[i] || {};
					for ( var k in def ) {
						if ( Object.prototype.hasOwnProperty.call( def, k ) ) {
							var v = (s[k] == null) ? '' : String( s[k] );
							// treat empty as "not selected" (not active).
							if ( v && v !== String( def[k] ) ) {
								return true;
							}
						}
					}
				}
				return false;
			}

			function strip_defaults_for_save(styles_arr, get_defaults_obj_fn) {
				var def = get_defaults_obj_fn();
				var out = [];
				for ( var i = 0; i < styles_arr.length; i++ ) {
					var s   = styles_arr[i] || {};
					var row = {};
					for ( var k in def ) {
						if ( Object.prototype.hasOwnProperty.call( def, k ) ) {
							var v = (s[k] == null) ? '' : String( s[k] );
							var keep_explicit_default = should_keep_explicit_default( k, s.__has );
							if ( v && ( v !== String( def[k] ) || keep_explicit_default ) ) {
								row[k] = v; // only keep meaningful overrides.
							}
						}
					}
					out.push( row );
				}
				return out;
			}

			/**
			 * Toggle rotation class for the chip labels of a specific column and group set.
			 *
			 * @param {number} idx      Column index (0-based)
			 * @param {boolean} enable  Whether to add (true) or remove (false) the rotation class
			 */
			function toggle_axis_rotation_for_col( idx, enable ) {
				var keys = [ 'ai', 'jc' ];
				for ( var g = 0; g < keys.length; g++ ) {
					var q = 'input.inspector__input.wpbc_sr_only[data-style-key="' + keys[g] + '"][data-col-idx="' + idx + '"]';
					var inputs = host.querySelectorAll( q );
					for ( var n = 0; n < inputs.length; n++ ) {
						var lbl = inputs[n] && inputs[n].nextElementSibling;
						if ( lbl && lbl.classList && lbl.classList.contains( 'wpbc_bfb__chip' ) ) {
							if ( enable ) {
								lbl.classList.add( 'wpbc_do_rotate_90' );
							} else {
								lbl.classList.remove( 'wpbc_do_rotate_90' );
							}
						}
					}
				}
			}

			/**
			 * Apply rotation class to *all* columns, using the effective `dir` value
			 * (saved value or default from COL_PROPS).
			 */
			function sync_axis_rotation_all() {
				var def = get_defaults_obj();  // includes def.dir (which is 'column' in your code).
				for ( var i = 0; i < styles_arr.length; i++ ) {
					var dir_val = ( styles_arr[i] && styles_arr[i].dir ) ? String( styles_arr[i].dir ) : String( def.dir );
					var enable  = ( dir_val === 'column' );
					toggle_axis_rotation_for_col( i, enable );
				}
			}

			/**
			 * Activate one nested column-control tab without affecting Column tabs.
			 *
			 * @param {HTMLElement} control_root Column-control tab group root.
			 * @param {string}      tab_key      Tab key to activate.
			 * @param {boolean}     move_focus   Whether focus follows activation.
			 * @returns {void}
			 */
			function activate_column_control_tab( control_root, tab_key, move_focus ) {
				if ( ! control_root ) { return; }

				var control_tabs = control_root.querySelectorAll( '[data-column-control-tab-key]' );
				var control_panels = control_root.querySelectorAll( '[data-column-control-tab-panel]' );
				var active_tab = null;

				for ( var tab_index = 0; tab_index < control_tabs.length; tab_index++ ) {
					var control_tab = control_tabs[ tab_index ];
					var tab_is_active = control_tab.getAttribute( 'data-column-control-tab-key' ) === tab_key;
					control_tab.setAttribute( 'aria-selected', tab_is_active ? 'true' : 'false' );
					control_tab.setAttribute( 'tabindex', tab_is_active ? '0' : '-1' );
					if ( tab_is_active ) {
						active_tab = control_tab;
					}
				}

				for ( var panel_index = 0; panel_index < control_panels.length; panel_index++ ) {
					var control_panel = control_panels[ panel_index ];
					if ( control_panel.getAttribute( 'data-column-control-tab-panel' ) === tab_key ) {
						control_panel.removeAttribute( 'hidden' );
					} else {
						control_panel.setAttribute( 'hidden', '' );
					}
				}

				control_root.setAttribute( 'data-column-control-tab-active', tab_key );
				if ( move_focus && active_tab && active_tab.focus ) {
					active_tab.focus();
				}
			}

			/**
			 * Remember one nested tab selection for the current Inspector mount.
			 *
			 * @param {HTMLElement} control_root Column-control tab group root.
			 * @param {string}      tab_key      Selected tab key.
			 * @returns {void}
			 */
			function remember_column_control_tab( control_root, tab_key ) {
				var control_column = ( parseInt( control_root.getAttribute( 'data-col-idx' ), 10 ) || 0 ) + 1;
				var control_group = control_root.getAttribute( 'data-column-control-tabs' ) || '';
				if ( control_group ) {
					column_control_tab_state[ control_column + '_' + control_group ] = tab_key;
					host.__wpbc_column_control_tab_state = column_control_tab_state;
				}
			}

			/**
			 * Reflect whether a nested tab owns any non-default style value.
			 *
			 * @param {number}                 column_index Zero-based column index.
			 * @param {string}                 style_key   Changed style key.
			 * @param {Record<string, string>} style_object Current full column styles.
			 * @returns {void}
			 */
			function sync_column_control_tab_marker( column_index, style_key, style_object ) {
				if ( ! is_supported_key( style_key ) ) { return; }

				var control_tabs = host.querySelectorAll( '[data-column-control-tab-style-keys~="' + style_key + '"][data-col-idx="' + column_index + '"]' );
				for ( var control_tab_index = 0; control_tab_index < control_tabs.length; control_tab_index++ ) {
					var control_tab = control_tabs[ control_tab_index ];
					var owned_style_keys = String( control_tab.getAttribute( 'data-column-control-tab-style-keys' ) || '' ).split( /\s+/ );
					var control_is_changed = false;

					for ( var owned_key_index = 0; owned_key_index < owned_style_keys.length; owned_key_index++ ) {
						var owned_style_key = owned_style_keys[ owned_key_index ];
						if ( is_supported_key( owned_style_key ) && normalize_value( owned_style_key, style_object[ owned_style_key ] ) !== COL_PROPS[ owned_style_key ].def ) {
							control_is_changed = true;
							break;
						}
					}

					var control_marker = control_tab.querySelector( '[data-column-control-tab-marker]' );
					var control_changed_text = control_tab.querySelector( '[data-column-control-tab-changed-text]' );
					control_tab.classList.toggle( 'is-changed', control_is_changed );
					if ( control_marker ) { control_marker.hidden = ! control_is_changed; }
					if ( control_changed_text ) { control_changed_text.hidden = ! control_is_changed; }
				}
			}

			// Delay (ms) for deferred UI updates after changing layout combo.
			var rerender_delay_ms = 420;

			/**
			 * Schedule icon rotation + re-render with optional immediate rotation.
			 *
			 * @param {number} col_idx            0-based column index
			 * @param {string} new_dir            "row" | "column"
			 * @param {{delay?:number, rotate_now?:boolean}} [opts]
			 */
			function schedule_rerender(col_idx, new_dir, opts) {
				opts      = opts || {};
				var delay = (typeof opts.delay === 'number') ? opts.delay : rerender_delay_ms;

				// Avoid stacked timers if the user clicks quickly.
				if ( host.__rerender_timer ) {
					clearTimeout( host.__rerender_timer );
				}

				// Optional immediate feedback (used by plain "dir" radios).
				if ( opts.rotate_now ) {
					toggle_axis_rotation_for_col( col_idx, String( new_dir ) === 'column' );
				}

				host.__rerender_timer = setTimeout( function () {
					// If we didn't rotate immediately, do it now (used by combo).
					if ( ! opts.rotate_now ) {
						toggle_axis_rotation_for_col( col_idx, String( new_dir ) === 'column' );
					}
					UI.wpbc_bfb_column_styles.render_for_section( builder, section_el, host );
					host.__rerender_timer = null;
				}, delay );
			}


			function commit(builder, section_el, styles_arr) {
				// Decide activation.
				var should_activate = styles_has_any_non_default( styles_arr, get_defaults_obj );
				if ( should_activate ) {
					section_el.setAttribute( 'data-colstyles-active', '1' );
				} else {
					section_el.removeAttribute( 'data-colstyles-active' );
				}

				// Normalize length to current number of columns (keeps attribute tidy).
				styles_arr.length = dom_cols( section_el );

				// Persist minimal JSON (omit defaults/empties).
				var save_arr = strip_defaults_for_save( styles_arr, get_defaults_obj );
				var json     = UI.WPBC_BFB_Column_Styles.stringify_col_styles( save_arr );
				section_el.setAttribute( 'data-col_styles', json );
				if ( section_el.dataset ) {
					section_el.dataset.col_styles = json;
				}

				// Live preview (mini + gated real columns).
				UI.WPBC_BFB_Column_Styles.apply( section_el, styles_arr );

				// Notify listeners.
				if ( builder && builder.bus && Core.WPBC_BFB_Events ) {
					builder.bus.emit && builder.bus.emit( Core.WPBC_BFB_Events.STRUCTURE_CHANGE, {
						source: 'column_styles',
						field : section_el
					} );
				}
			}


			function on_change( e ) {
				var t   = e.target;
				// Radios fire both 'input' and 'change' in most browsers.
  				if (t && t.type === 'radio' && e.type === 'input') return;

				var key = t && t.getAttribute( 'data-style-key' );
				if ( ! key || ( ! is_supported_key( key ) && key !== 'layout_combo' ) ) { return; }

				var idx = parseInt( t.getAttribute( 'data-col-idx' ), 10 ) || 0;

				// layout_combo: commit now, rotate + re-render later (no immediate icon change).
				if ( key === 'layout_combo' ) {
					var parts = String( t.value || '' ).split( '|' );
					var dir   = parts[0] || 'row';
					var wrap  = parts[1] || 'nowrap';

					styles_arr[idx].dir  = normalize_value( 'dir', dir );
					styles_arr[idx].wrap = normalize_value( 'wrap', wrap );
					commit( builder, section_el, styles_arr );

					schedule_rerender( idx, styles_arr[idx].dir, { rotate_now: true, delay: rerender_delay_ms } );
					return;
				}

				// Combine every registered split length control before normalizing it.
				var split_normalizer = COL_PROPS[ key ] && COL_PROPS[ key ].normalize;
				if ( t.hasAttribute( 'data-style-part' ) && ( 'len' === split_normalizer || 'max_len' === split_normalizer ) ) {
					var numEl           = host.querySelector( '[data-style-key="' + key + '"][data-style-part="value"][data-col-idx="' + idx + '"]' );
					var unitEl          = host.querySelector( '[data-style-key="' + key + '"][data-style-part="unit"][data-col-idx="' + idx + '"]' );
					var num             = numEl ? String( numEl.value || '' ).trim() : '';
					var unit            = unitEl ? String( unitEl.value || 'px' ).trim() : 'px';
					var raw             = num ? ( num + unit ) : '';
					styles_arr[idx][key] = normalize_value( key, raw );
					if ( styles_arr[idx].__has ) {
						styles_arr[idx].__has[key] = true;
					}
					promote_box_sides_to_explicit( styles_arr[idx], key );
					commit( builder, section_el, styles_arr );
					sync_column_control_tab_marker( idx, key, styles_arr[idx] );
					return;
				}

				// dir: commit now, rotate immediately for snappy feedback, still re-render after delay.
				if ( key === 'dir' ) {
					styles_arr[idx].dir = normalize_value( 'dir', t.value );
					commit( builder, section_el, styles_arr );

					schedule_rerender( idx, styles_arr[idx].dir, { rotate_now: true, delay: rerender_delay_ms } );
					return;
				}

				// Default branch (unchanged).
				styles_arr[idx][key] = normalize_value( key, t.value );
				if ( styles_arr[idx].__has ) {
					styles_arr[idx].__has[key] = true;
				}
				if ( OVERFLOW_AXIS_KEYS.indexOf( key ) !== -1 ) {
					promote_overflow_axes_to_explicit( styles_arr[idx] );
				}
				commit( builder, section_el, styles_arr );
				sync_column_control_tab_marker( idx, key, styles_arr[idx] );
			}

			/**
			 * Reset an allowlisted subset of one column style object to registered defaults.
			 *
			 * Legacy shorthand values are promoted before the reset so clearing one side
			 * or overflow axis cannot silently change its siblings. The reset keys are
			 * marked absent so sparse persistence falls back to the canonical defaults.
			 *
			 * @param {HTMLElement} reset_control Reset link carrying column and key metadata.
			 * @returns {boolean} Whether a supported style subset was reset.
			 */
			function reset_column_style_keys( reset_control ) {
				var column_index = parseInt( reset_control.getAttribute( 'data-col-idx' ), 10 );
				var requested_keys = String( reset_control.getAttribute( 'data-style-keys' ) || '' ).split( /\s+/ );

				if ( isNaN( column_index ) || column_index < 0 || column_index >= styles_arr.length ) {
					return false;
				}

				var style_object = styles_arr[ column_index ];
				var style_keys = UI.WPBC_BFB_Column_Styles.reset_style_keys( style_object, requested_keys );
				if ( ! style_keys.length ) {
					return false;
				}

				var focus_selector = '[data-action="colstyles-reset-keys"][data-col-idx="' + column_index + '"][data-style-keys="' + style_keys.join( ' ' ) + '"]';
				commit( builder, section_el, styles_arr );
				UI.wpbc_bfb_column_styles.render_for_section( builder, section_el, host );

				var restored_control = host.querySelector( focus_selector );
				if ( restored_control && restored_control.focus ) {
					restored_control.focus();
				}
				return true;
			}


			function on_click( e ) {
				var control_tab = e.target.closest( '[data-column-control-tab-key]' );
				if ( control_tab && host.contains( control_tab ) ) {
					var control_root = control_tab.closest( '[data-column-control-tabs]' );
					var control_tab_key = control_tab.getAttribute( 'data-column-control-tab-key' ) || '';
					e.preventDefault();
					activate_column_control_tab( control_root, control_tab_key, false );
					remember_column_control_tab( control_root, control_tab_key );
					return;
				}

				var property_reset = e.target.closest( '[data-action="colstyles-reset-keys"]' );
				if ( property_reset && host.contains( property_reset ) ) {
					e.preventDefault();
					reset_column_style_keys( property_reset );
					return;
				}

				var btn = e.target.closest( '[data-action="colstyles-reset"]' );
				if ( ! btn ) { return; }

				// Clear dataset + activation flag and remove inline vars
				section_el.removeAttribute( 'data-colstyles-active' );
				section_el.removeAttribute( 'data-col_styles' );
				if ( section_el.dataset ) { delete section_el.dataset.col_styles; }

				UI.WPBC_BFB_Column_Styles.apply( section_el, [] );

				// Re-render fresh, not persisted
				UI.wpbc_bfb_column_styles.render_for_section( builder, section_el, host );

				if ( builder && builder.bus && Core.WPBC_BFB_Events ) {
					builder.bus.emit && builder.bus.emit( Core.WPBC_BFB_Events.STRUCTURE_CHANGE, { source : 'column_styles_reset', field : section_el } );
				}
			}

			/**
			 * Navigate one nested column-control tab list with the keyboard.
			 *
			 * @param {KeyboardEvent} e Inspector keydown event.
			 * @returns {void}
			 */
			function on_keydown( e ) {
				var control_tab = e.target.closest( '[data-column-control-tab-key]' );
				if ( ! control_tab || ! host.contains( control_tab ) ) { return; }
				if ( [ 'ArrowLeft', 'ArrowRight', 'Home', 'End' ].indexOf( e.key ) === -1 ) { return; }

				var control_root = control_tab.closest( '[data-column-control-tabs]' );
				var control_tabs = Array.prototype.slice.call( control_root.querySelectorAll( '[data-column-control-tab-key]' ) );
				var active_index = control_tabs.indexOf( control_tab );
				if ( active_index < 0 ) { return; }

				var next_index = active_index;
				if ( 'Home' === e.key ) {
					next_index = 0;
				} else if ( 'End' === e.key ) {
					next_index = control_tabs.length - 1;
				} else if ( 'ArrowRight' === e.key ) {
					next_index = ( active_index + 1 ) % control_tabs.length;
				} else {
					next_index = ( active_index - 1 + control_tabs.length ) % control_tabs.length;
				}

				e.preventDefault();
				var next_tab_key = control_tabs[ next_index ].getAttribute( 'data-column-control-tab-key' ) || '';
				activate_column_control_tab( control_root, next_tab_key, true );
				remember_column_control_tab( control_root, next_tab_key );
			}

			host.addEventListener( 'input', on_change, true );
			host.addEventListener( 'change', on_change, true );
			host.addEventListener( 'click', on_click, true );
			host.addEventListener( 'keydown', on_keydown, true );

			// Initial apply (does NOT auto-activate).
			UI.WPBC_BFB_Column_Styles.apply( section_el, styles_arr );

			// Provide cleanup to avoid leaks.
			host.__wpbc_cleanup = function () {
				try {
					host.removeEventListener( 'input', on_change, true );
					host.removeEventListener( 'change', on_change, true );
					host.removeEventListener( 'click', on_click, true );
					host.removeEventListener( 'keydown', on_keydown, true );
				} catch ( _e ) {}
			};
		},

		/**
		 * Refresh the mounted editor after columns count changes.
		 *
		 * @param {object}      builder
		 * @param {HTMLElement} section_el
		 * @param {HTMLElement} inspector_root
		 */
		refresh_for_section : function ( builder, section_el, inspector_root ) {
			var host = inspector_root && inspector_root.querySelector( '[data-bfb-slot="column_styles"]' );
			if ( ! host ) { return; }
			this.render_for_section( builder, section_el, host );
		}
	};

	// Optional: register a factory slot for environments that use inspector factory.
	w.wpbc_bfb_inspector_factory_slots = w.wpbc_bfb_inspector_factory_slots || {};
	w.wpbc_bfb_inspector_factory_slots.column_styles = function ( host, opts ) {
		try {
			var builder    = ( opts && opts.builder ) || w.wpbc_bfb || null;
			var section_el = ( opts && opts.el ) || ( builder && builder.get_selected_field && builder.get_selected_field() ) || null;
			UI.wpbc_bfb_column_styles.render_for_section( builder, section_el, host );
		} catch ( e ) {
			w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error( 'wpbc_bfb_inspector_factory_slots.column_styles', e );
		}
	};

})( window );
