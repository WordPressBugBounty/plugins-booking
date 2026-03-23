/**
 * == How to add a new CSS style ? ==
 *
 * TL;DR: add a key in COL_PROPS (JS) -> reference its CSS var (CSS) → add a control in the inspector template (HTML).
 * Keep the JS default (def) and the CSS var() fallback identical.
 *
 * -- 1) Register the style in this JS (COL_PROPS)
 *
 *    // Length-like example:
 *    pad: { var: '--wpbc-bfb-col-pad', def: '0px', normalize: 'len' }
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
 *    File with defaults: ../includes/__css/client/form_fields/bfb_section__columns.css
 *    The fallback in var(--name, <fallback>) MUST MATCH COL_PROPS[key].def.
 *
 *    /* Mini preview (template “ghost” columns; always on) *\/
 *    .wpbc_bfb__section__cols > .wpbc_bfb__section__col {
 *      padding: var(--wpbc-bfb-col-pad, 0px);
 *      /* add other properties here using their vars *\/
 *    }
 *
 *    /* Real columns (only when styles are activated) *\/
 *    .wpbc_bfb_form .wpbc_bfb__section[data-colstyles-active="1"] > .wpbc_bfb__row > .wpbc_bfb__column {
 *      padding: var(--wpbc-bfb-col-pad, 0px);
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
 *        <input type="text" class="inspector__input" data-style-key="pad" data-col-idx="{{ i }}" placeholder="e.g., 8px or 0.5rem">
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
 * -- 4) (Optional) Split value styles (like GAP number+unit)
 *
 *    If your new style is a pair (value + unit), mirror the 'gap' pattern:
 *      - two inputs with data-style-part="value" and data-style-part="unit"
 *      - add a small branch in on_change (like the existing one for key === 'gap') that combines value+unit
 *        before normalizing and saving.
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
 * [ ] (If split-value) on_change branch added, like for 'gap'
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
 * @modified  2025-09-16 11:25
 * @version   1.0.0
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
	 * normalize — Normalizer id ('id' passthrough, 'len' for length units).
	 */
	var COL_PROPS = {
		dir  : { var: '--wpbc-bfb-col-dir',   def: 'column',        normalize: 'id'  },
		wrap : { var: '--wpbc-bfb-col-wrap',  def: 'nowrap',       normalize: 'id'  },
		jc   : { var: '--wpbc-bfb-col-jc',    def: 'flex-start', normalize: 'id'  },
		ai   : { var: '--wpbc-bfb-col-ai',    def: 'stretch',    normalize: 'id'  },
		gap  : { var: '--wpbc-bfb-col-gap',   def: '0px',        normalize: 'len' },
		aself: { var: '--wpbc-bfb-col-aself', def: 'flex-start',
			normalize: { type: 'enum', values: [ 'flex-start', 'center', 'flex-end', 'stretch' ] }
		}
		// Example additions:
		// pad : { var: '--wpbc-bfb-col-pad', def: '0px',        normalize: 'len' }
	};

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
		id  : v => String( v || '' ),
		len : norm_len,
		enum: (v, values) => norm_enum( v, values )
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
			node.style.setProperty( cssVar, String( v ) );
		}}
	}

	function set_vars_sparse(node, style_obj) {
		if ( !node ) return;
		for ( var k in COL_PROPS ) { if ( is_supported_key(k) ) {
			var cssVar = COL_PROPS[k].var;
			if ( style_obj && Object.prototype.hasOwnProperty.call(style_obj, k) && String(style_obj[k]).trim() !== '' ) {
				node.style.setProperty(cssVar, String(style_obj[k]));
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
		 * @returns {Array<{dir:string,wrap:string,jc:string,ai:string,gap:string}>}
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
                full.__has = {
                    dir   : Object.prototype.hasOwnProperty.call( src, 'dir' ),
                    wrap  : Object.prototype.hasOwnProperty.call( src, 'wrap' ),
                    jc    : Object.prototype.hasOwnProperty.call( src, 'jc' ),
                    ai    : Object.prototype.hasOwnProperty.call( src, 'ai' ),
                    gap   : Object.prototype.hasOwnProperty.call( src, 'gap' ),
                    aself : Object.prototype.hasOwnProperty.call( src, 'aself' )
                };
                styles_arr[i] = full;
			}
			styles_arr.length = col_count;   // clamp.

			host.innerHTML = tpl( {
				cols  : col_count,
				styles: styles_arr,
				active: UI.WPBC_BFB_Column_Styles.is_active( section_el )
			} );

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
							if ( v && v !== String( def[k] ) ) {
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

				// Existing: GAP pair branch.
				if ( key === 'gap' ) {
					var numEl           = host.querySelector( '[data-style-key="gap"][data-style-part="value"][data-col-idx="' + idx + '"]' );
					var unitEl          = host.querySelector( '[data-style-key="gap"][data-style-part="unit"][data-col-idx="' + idx + '"]' );
					var num             = numEl ? String( numEl.value || '' ).trim() : '';
					var unit            = unitEl ? String( unitEl.value || 'px' ).trim() : 'px';
					var raw             = num ? ( num + unit ) : '';
					styles_arr[idx].gap = normalize_value( 'gap', raw );
					commit( builder, section_el, styles_arr );
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
				commit( builder, section_el, styles_arr );
			}


			function on_click( e ) {
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

			host.addEventListener( 'input', on_change, true );
			host.addEventListener( 'change', on_change, true );
			host.addEventListener( 'click', on_click, true );

			// Initial apply (does NOT auto-activate).
			UI.WPBC_BFB_Column_Styles.apply( section_el, styles_arr );

			// Provide cleanup to avoid leaks.
			host.__wpbc_cleanup = function () {
				try {
					host.removeEventListener( 'input', on_change, true );
					host.removeEventListener( 'change', on_change, true );
					host.removeEventListener( 'click', on_click, true );
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
