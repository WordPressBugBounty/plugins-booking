/**
 * @file: ../includes/page-form-builder/_out/export/builder-exporter.js
 */
(function () {
	"use strict";

	const core = window.WPBC_BFB_Core || {};

	// == Helpers — Shared helper API for field packs ==================================================================
	// =================================================================================================
	// == These are generic utilities that packs can call from their own exporters:
	// ==  - compute_name(), id_option(), class_options(), size_max_token(), emit_time_select(), etc.
	// == No field-type branching should live in the core exporter.
	// =================================================================================================

	/**
	 * Default skip list (can be extended/overridden at runtime).
	 * - Only attribute NAMES here (case-insensitive). Values are removed with them.
	 */
	const wpbc_export_skip_attrs_default = [ 'data-colstyles-active' ];

	/**
	 * Remove attributes by name from an HTML-like string.
	 * Matches:
	 *   - name
	 *   - name="..."/name='...'/name=value
	 * with any surrounding whitespace.
	 *
	 * @param {string} html
	 * @param {string[]} attrs_lowercase   attribute names (lowercase)
	 * @return {string}
	 */
	function strip_attributes_from_markup(html, attrs_lowercase) {
		if (!html || !attrs_lowercase?.length) return html;
		let out = String(html);
		for (const rawName of attrs_lowercase) {
			if (!rawName) continue;
			const name = String(rawName).toLowerCase().trim();
			// Escape for regex
			const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// Match full attribute name only (next char is NOT a valid name char)
			const re = new RegExp(
				`\\s${esc}(?![A-Za-z0-9_:\\-])(?:=(?:"[^"]*"|'[^']*'|[^\\s>]*))?`,
				'gi'
			);
			out = out.replace(re, '');
		}
		return out;
	}

	// == Helpers – column styles parsing & CSS vars builder ===========================================================

	// Known keys we treat as real per-column style overrides.
	function has_non_default_col_styles(obj) {
		if ( !obj || typeof obj !== 'object' ) {
			return false;
		}
		var keys = [ 'dir', 'wrap', 'jc', 'ai', 'gap', 'aself', 'ac' ];
		for ( var i = 0; i < keys.length; i++ ) {
			var k = keys[i];
			if ( obj[k] != null && String( obj[k] ).trim() !== '' ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Parse `col_styles` coming from a Section.
	 * Accepts: JSON string or array of objects.
	 *
	 * @param {string|Array|undefined|null} raw
	 * @returns {Array<Object>} array aligned to columns (may be empty)
	 */
	function parse_col_styles_json(raw) {
		if ( !raw ) return [];
		if ( Array.isArray( raw ) ) return raw.filter( function (x) {
			return x && typeof x === 'object';
		} );

		if ( typeof raw === 'string' ) {
			try {
				var arr = JSON.parse( raw );
				return Array.isArray( arr ) ? arr.filter( function (x) {
					return x && typeof x === 'object';
				} ) : [];
			} catch ( _e ) {
				return [];
			}
		}
		return [];
	}

	/**
	 * Build CSS variable declarations string for a column style object.
	 * Known keys -> CSS vars:
	 *  - dir  -> --wpbc-bfb-col-dir
	 *  - wrap -> --wpbc-bfb-col-wrap
	 *  - jc   -> --wpbc-bfb-col-jc
	 *  - ai   -> --wpbc-bfb-col-ai
	 *  - gap  -> --wpbc-bfb-col-gap
	 *  - ac   -> --wpbc-bfb-col-ac
	 *  - aself-> --wpbc-bfb-col-aself
	 *
	 * Unknown keys are exported as `--wpbc-bfb-col-${key}`.
	 *
	 * @param {Object|null|undefined} obj
	 * @returns {string} e.g. "--wpbc-bfb-col-dir: row; --wpbc-bfb-col-wrap: wrap;"
	 */
	function build_col_css_vars(obj) {
		if ( !obj || typeof obj !== 'object' ) return '';

		var map = {
			dir  : '--wpbc-bfb-col-dir',
			wrap : '--wpbc-bfb-col-wrap',
			jc   : '--wpbc-bfb-col-jc',
			ai   : '--wpbc-bfb-col-ai',
			gap  : '--wpbc-bfb-col-gap',
			ac   : '--wpbc-bfb-col-ac',
			aself: '--wpbc-bfb-col-aself'
		};

		var parts = [];

		for ( var k in obj ) {
			if ( !Object.prototype.hasOwnProperty.call( obj, k ) ) continue;
			var v = obj[k];
			if ( v == null || v === '' ) continue;

			var var_name = map[k] || ('--wpbc-bfb-col-' + String( k ).replace( /[^a-z0-9_-]/gi, '' ).toLowerCase());
			parts.push( var_name + ': ' + String( v ) );
		}

		// Always include explicit min guard (requested): --wpbc-col-min: 0px;
		parts.push( '--wpbc-col-min: 0px' );

		return parts.join( ';' ) + (parts.length ? ';' : '');
	}

	/**
	 * Resolve numeric percent from a width token like "48.5%".
	 * Falls back to `fallback_percent` if not in percent format.
	 *
	 * @param {string|number|undefined|null} width_token
	 * @param {number} fallback_percent
	 * @returns {number}
	 */
	function resolve_flex_basis_percent(width_token, fallback_percent) {
		if ( typeof width_token === 'string' ) {
			var s = width_token.trim();
			if ( s.endsWith( '%' ) ) {
				var p = parseFloat( s );
				if ( isFinite( p ) ) return p;
			}
		}
		if ( typeof width_token === 'number' && isFinite( width_token ) ) {
			return width_token;
		}
		return fallback_percent;
	}

	/**
	 * Compute effective flex-basis values that respect inter-column gap
	 *
	 * @param columns
	 * @param gap_percent
	 * @returns {*}
	 */
	function compute_effective_bases(columns, gap_percent = 3) {

		const n = columns && columns.length ? columns.length : 1;

		const raw = columns.map( (col) => {
			const w = col && col.width != null ? String( col.width ).trim() : '';
			const p = w.endsWith( '%' ) ? parseFloat( w ) : w ? parseFloat( w ) : NaN;
			return Number.isFinite( p ) ? p : 100 / n;
		} );

		const sum_raw     = raw.reduce( (a, b) => a + b, 0 ) || 100;
		const gp          = Number.isFinite( +gap_percent ) ? +gap_percent : 3;
		const total_gaps  = Math.max( 0, n - 1 ) * gp;
		const available   = Math.max( 0, 100 - total_gaps );
		const scale_ratio = available / sum_raw;

		return raw.map( (p) => Math.max( 0, p * scale_ratio ) );
	}

	// == adapter: builder (array-of-pages) > exporter shape { pages: [ { items:[ {kind,data} ] } ] } ==================
	function adapt_builder_structure_to_exporter(structure) {

//		if ( !Array.isArray( structure ) ) return { pages: [] };

		// Ensure at least one page exists, even when Builder structure is empty `[]`.
		// This keeps exported Advanced Form valid (wizard step #1 exists).
		if ( ! Array.isArray( structure ) || structure.length === 0 ) {
			return { pages: [ { items: [] } ] };
		}

		const normalize_options = (opts) => {
			if ( !Array.isArray( opts ) ) return [];
			return opts.map( (o) => {
				if ( typeof o === 'string' ) return { label: o, value: o, selected: false };
				if ( o && typeof o === 'object' ) {
					return {
						label   : String( o.label ?? o.value ?? '' ),
						value   : String( o.value ?? o.label ?? '' ),
						selected: !!o.selected
					};
				}
				return { label: String( o ), value: String( o ), selected: false };
			} );
		};

		// =================================================================================================
		// == Adapter – attach parsed per-column `col_styles` from Section into each column
		// =================================================================================================
		const walk_section = (sec) => {
			const section_col_styles = parse_col_styles_json( sec && sec.col_styles );

			return {
				id     : sec?.id,
				columns: (sec?.columns || []).map( (col, col_index) => {
					const items = Array.isArray( col?.items )
						? col.items
						: [
							...(col?.fields || []).map( (f) => ({ type: 'field', data: f }) ),
							...(col?.sections || []).map( (s) => ({ type: 'section', data: s }) )
						];

					const fields = items
						.filter( (it) => it && it.type === 'field' )
						.map( (it) => ({ ...it.data, options: normalize_options( it.data?.options ) }) );

					const sections = items
						.filter( (it) => it && it.type === 'section' )
						.map( (it) => walk_section( it.data ) );

					return {
						width      : col?.width || '100%',
						style      : col?.style || null,
						col_styles : section_col_styles[ col_index ] || null,   // <- attach style object per column
						fields,
						sections
					};
				} )
			};
		};


		const pages = structure.map( (page) => {
			const items = [];
			(page?.content || []).forEach( (item) => {
				if ( !item ) return;
				if ( item.type === 'section' && item.data ) {
					items.push( { kind: 'section', data: walk_section( item.data ) } );
				} else if ( item.type === 'field' && item.data ) {
					items.push( {
						kind: 'field',
						data: { ...item.data, options: normalize_options( item.data.options ) }
					} );
				}
			} );
			return { items };
		} );

		return { pages };
	}


	// == Booking From Exporter ========================================================================================
	class WPBC_BFB_Exporter {

		/**
		 * Mutable skip-list for attribute names (lowercase).
		 * You can override it via set_skip_attrs() or add with add_skip_attrs().
		 * @type {Set<string>}
		 */
		static skip_attrs = new Set();

		/**
		 * Replace the entire skip list.
		 * @param {string[]} arr
		 */
		static set_skip_attrs( arr ) {
			this.skip_attrs = new Set(
				(Array.isArray( arr ) ? arr : []).map( (n) => String( n ).toLowerCase().trim() ).filter( Boolean )
			);
		}

		/**
		 * Add one or many attributes to the skip list.
		 * @param {string|string[]} names
		 */
		static add_skip_attrs( names ) {
			( Array.isArray( names ) ? names : [ names ] )
				.map( (n) => String( n ).toLowerCase().trim() )
				.filter( Boolean )
				.forEach( (n) => this.skip_attrs.add( n ) );
		}

		/**
		 * Remove one attribute from the skip list.
		 * @param {string} name
		 */
		static remove_skip_attr( name ) {
			if ( ! name ) { return; }
			this.skip_attrs.delete( String( name ).toLowerCase().trim() );
		}

		/**
		 * Apply attribute skipping to a final HTML string.
		 * @param {string} html
		 * @return {string}
		 */
		static sanitize_export( html ) {
			return strip_attributes_from_markup( html, Array.from( this.skip_attrs ) );
		}


		/**
		 * Export adapted structure to advanced form text (with <r>/<c> layout and wizard wrapper).
		 *
		 * @param {Object} adapted
		 * @param {Object} [options]
		 * @param {string}  [options.newline="\n"]
		 * @param {boolean} [options.addLabels=true]
		 * @param {number}  [options.gapPercent=3]
		 * @returns {string}
		 */
		static export_form(adapted, options = {}) {
			// indent: use real TAB by default (can be overridden via options.indent)
			const cfg = { newline: '\n', addLabels: true, gapPercent: 3, indent: '\t', ...options };
			const IND = (typeof cfg.indent === 'string') ? cfg.indent : '\t';

			let depth   = 0;
			const lines = [];
			const push  = (s = '') => lines.push( IND.repeat( depth ) + String( s ) );
			const open  = (s = '') => {
				push( s );
				depth++;
			};
			const close = (s = '') => {
				depth = Math.max( 0, depth - 1 );
				push( s );
			};
			const blank = () => {
				lines.push( '' );
			};

			if ( !adapted || !Array.isArray( adapted.pages ) ) return '';

			// Always export at least one wizard step to keep Advanced Form structure valid.
			const pages = adapted.pages.length ? adapted.pages : [ { items: [] } ];

			const ctx = { usedIds: new Set() };

			open( `<div class="wpbc_bfb_form wpbc_wizard__border_container">` );

			// one-per-form guards (calendar is not gated here)
			const once = { captcha: 0, country: 0, coupon: 0, cost_corrections: 0, submit: 0 };

			pages.forEach( (page, page_index) => {
				const is_first = page_index === 0;
				const step_num = page_index + 1;

				const hidden_class = is_first ? '' : ' wpbc_wizard_step_hidden';
				const hidden_style = is_first ? '' : ' style="display:none;clear:both;"';
				open( `<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step${step_num}${hidden_class}"${hidden_style}>` );

				(page.items || []).forEach( (item) => {
					if ( item.kind === 'section' ) {
						WPBC_BFB_Exporter.render_section( item.data, { open, close, push, blank }, cfg, once, ctx );
						// blank();
					} else if ( item.kind === 'field' ) {
						open( `<r>` );
						open( `<c>` );
						WPBC_BFB_Exporter.render_field_node( item.data, { open, close, push, blank }, cfg, once, ctx );
						close( `</c>` );
						close( `</r>` );
						// blank();
					}
				} );

				close( `</div>` );
			} );

			close( `</div>` );
			return WPBC_BFB_Exporter.sanitize_export( lines.join( cfg.newline ) );
		}


		/**
		 * High-level helper: export full package from raw Builder structure.
		 *
		 * - Adapts raw Builder structure (pages/sections/columns/items) for exporters.
		 * - Builds:
		 *      • advanced_form  -> “Advanced Form (export)” text.
		 *      • fields_data    -> “Content of booking fields data (export)” text.
		 *
		 * @param {Array}  structure  Raw Builder structure from wpbc_bfb.get_structure().
		 * @param {Object} [options]
		 * @param {number} [options.gapPercent=3]  Column gap percent for layout math.
		 *
		 * @returns {{
		 *   advanced_form: string,
		 *   fields_data: string,
		 *   structure: Array,
		 *   adapted: Object
		 * }}
		 */
		static export_all( structure, options = {} ) {

			// 1) Adapt Builder JSON to exporter shape (pages[] -> items[]).
			const adapted = adapt_builder_structure_to_exporter( structure || [] );

			// 2) Advanced Form text (same logic as debug panel).
			const gap_percent   = ( options && typeof options.gapPercent === 'number' ) ? options.gapPercent : 3;
			const advanced_form = WPBC_BFB_Exporter.export_form(
				adapted,
				{
					addLabels : true,
					gapPercent: gap_percent
				}
			);

			// 3) Content of booking fields data (if content exporter is available).
			let fields_data = '';
			if (
				window.WPBC_BFB_ContentExporter &&
				typeof window.WPBC_BFB_ContentExporter.export_content === 'function'
			) {
				fields_data = window.WPBC_BFB_ContentExporter.export_content(
					adapted,
					{
						addLabels: true,
						sep      : ': '
					}
				);
			}

			return {
				advanced_form: advanced_form || '',
				fields_data  : fields_data || '',
				structure    : structure || [],
				adapted      : adapted
			};
		}

		// =================================================================================================
		// == Exporter – render_section() now injects per-column CSS vars from `col_styles`
		// =================================================================================================
		static render_section(section, io, cfg, once, ctx) {

			once = once || { captcha: 0, country: 0, coupon: 0, cost_corrections: 0, submit: 0 };
			ctx  = ctx || { usedIds: new Set() };

			const { open, close } = io;

			const cols = Array.isArray( section.columns ) && section.columns.length
				? section.columns
				: [ { width: '100%', fields: [], sections: [] } ];

			// Row is active if ANY column carries styles.
			var row_is_active = cols.some( function (col) { return has_non_default_col_styles( col && col.col_styles ); } );
			var row_attr_active = row_is_active ? ' data-colstyles-active="1"' : '';

			open( `<r${row_attr_active}>` );

			const bases    = compute_effective_bases( cols, cfg.gapPercent );
			const esc_attr = core.WPBC_BFB_Sanitize.escape_html;

			cols.forEach( (col, idx) => {
				// (1) Resolve flex-basis.
				var eff_basis = resolve_flex_basis_percent( col && col.width, Number.isFinite( bases[idx] ) ? +bases[idx] : 100 );

				// (2) Build inline style.
				var style_parts = [];

				if ( col && typeof col.style === 'string' && col.style.trim() ) {
					style_parts.push( col.style.trim().replace( /;+\s*$/, '' ) );
				}
				style_parts.push( 'flex-basis: ' + ( Number.isFinite( eff_basis ) ? eff_basis.toString() : '100' ) + '%' );

				var css_vars_str = build_col_css_vars( col && col.col_styles );
				if ( css_vars_str ) {
					style_parts.push( css_vars_str.replace( /^;|;$/g, '' ) );
				}

				var style_attr = ` style="${esc_attr( style_parts.join( '; ' ) )}"`;

				// (3) Column-level activation (more precise scoping)
				var col_is_active   = has_non_default_col_styles( col && col.col_styles );
				var col_attr_active = col_is_active ? ' data-colstyles-active="1"' : '';

				open( `<c${col_attr_active}${style_attr}>` );

				// Use the shared once/ctx objects so single-per-form guards work across the whole form.
				(col.fields || []).forEach( (node) =>
					WPBC_BFB_Exporter.render_field_node( node, io, cfg, once, ctx )
				);

				// Recurse with the same once/ctx as well.
				(col.sections || []).forEach( (nested) =>
					WPBC_BFB_Exporter.render_section( nested, io, cfg, once, ctx )
				);

				close( `</c>` );
			} );

			close( `</r>` );
		}


		/**
		 * Build attribute string for the <item> wrapper.
		 * Currently only used for CAPTCHA: pushes css classes and html_id to the wrapper.
		 * Also ensures uniqueness of the html_id across the export (uses ctx.usedIds).
		 *
		 * @param {Object} field
		 * @param {{usedIds:Set<string>}} ctx
		 * @returns {string} e.g. ' class="x y" id="myId"'
		 */
		static item_wrapper_attrs(field, ctx) {
			if ( ! field ) {
				return '';
			}
			const esc_html  = core.WPBC_BFB_Sanitize.escape_html;
			const cls_sanit = core.WPBC_BFB_Sanitize.sanitize_css_classlist;
			const sid       = core.WPBC_BFB_Sanitize.sanitize_html_id;

			let out = '';

			const cls_raw = String( field.cssclass_extra || field.cssclass || field.class || '' );
			const cls     = cls_sanit( cls_raw );
			let html_id   = field.html_id ? sid( String( field.html_id ) ) : '';
			if ( html_id && ctx?.usedIds ) {
				let unique = html_id, i = 2;
				while ( ctx.usedIds.has( unique ) ) {
					unique = `${html_id}_${i++}`;
				}
				ctx.usedIds.add( unique );
				html_id = unique;
			}
			if ( cls ) {
				out += ` class="${esc_html( cls )}"`;
			}
			if ( html_id ) {
				out += ` id="${esc_html( html_id )}"`;
			}

			return out;
		}

		// =================================================================================================
		// == Fields – pluggable, pack-driven export
		// == Wrap every exported field inside <item>…</item> and delegate actual shortcode export
		// == to per-pack callbacks registered via WPBC_BFB_Exporter.register(type, fn).
		// =================================================================================================
		static render_field_node(field, io, cfg, once, ctx) {

			const { open, close, push } = io;
			if ( ! field || ! field.type ) {
				return;
			}

			// Shared context (usedIds, “once-per-form” guards, etc.).
			once = once || {};
			ctx  = ctx  || { usedIds: new Set() };

			const type = String( field.type ).toLowerCase();

			// Optional wrapper attrs for special types (currently only used by captcha).
			let item_attrs = '';
			if ( type === 'captcha' ) {
				item_attrs = WPBC_BFB_Exporter.item_wrapper_attrs( field, ctx );
			}

			open( `<item${item_attrs}>` );

			try {
				// 1) Let the corresponding field pack handle export.
				let handled = false;
				if ( WPBC_BFB_Exporter.has_exporter( type ) ) {
					handled = WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx );
				}

				// 2) Fallback: show a clear TODO comment if no exporter is registered.
				if ( ! handled ) {
					const name = WPBC_BFB_Exporter.compute_name( type, field );
					push( `<!-- TODO: map field type "${type}" name="${name}" in a pack exporter -->` );
				}

				// 3) Append help text consistently (packs shouldn’t duplicate this).
				if ( field.help ) {
					push(
						`<div class="wpbc_field_description">${core.WPBC_BFB_Sanitize.escape_html(
							String( field.help )
						)}</div>`
					);
				}
			} finally {
				// Always close wrapper.
				close( `</item>` );
			}
		}

		// =================================================================================================
		// == Helpers ==
		// =================================================================================================
		static is_required(field) {
			const v = field && field.required;
			return (
				v === true ||
				v === 'true' ||
				v === 1 ||
				v === '1' ||
				v === 'required'
			);
		}


		/**
		 * Shared label emitter used by per-pack exporters.
		 *
		 * Emits optional <l>Label</l> + <br> before the provided body,
		 * respecting cfg.addLabels. Help text is emitted centrally in
		 * render_field_node(), so it is intentionally NOT handled here.
		 *
		 * @param {Object}                  field
		 * @param {function(string): void}  emit
		 * @param {string}                  body
		 * @param {{addLabels?: boolean}}  [cfg]
		 */
		static emit_label_then(field, emit, body, cfg) {
			if ( typeof emit !== 'function' ) { return; }

			cfg = cfg || {};
			const addLabels = cfg.addLabels !== false;

			const raw   = (field && typeof field.label === 'string') ? field.label : '';
			const label = raw.trim();

			var is_req   = this.is_required( field );
			var req_mark = is_req ? '*' : '';

			if ( label && addLabels ) {
				const esc_html = core.WPBC_BFB_Sanitize.escape_html;
				emit( '<l>' + esc_html( label ) + req_mark + '</l>' );
				emit( '<br>' + body );
			} else {
				emit( body );
			}
		}


		// =================================================================================================
		// == Helpers ==
		// =================================================================================================

		// -- Time Select Helpers --------------------------------------------------------------------------------------
		static is_timeslot_picker_enabled() {
			try {
				return !!(window._wpbc && typeof window._wpbc.get_other_param === 'function'
					&& window._wpbc.get_other_param('is_enabled_booking_timeslot_picker'));
			} catch (_) { return false; }
		}

		static time_placeholder_for(name, field) {
			// Prefer field-specific placeholder; else sensible default per field.
			if (typeof field.placeholder === 'string' && field.placeholder.trim()) {
				return field.placeholder.trim();
			}
			if (name === 'durationtime') return '--- Select duration ---';
			return '--- Select time ---';
		}

		/**
		 * Build tokens/default for a time-like select (start/end/range/duration).
		 * - Adds an empty-value placeholder as the first option only when:
		 *   • time picker is OFF, and
		 *   • no option is selected by default, and
		 *   • there isn't already an empty-value option.
		 */
		static build_time_select_tokens(field, name) {
			let tokens_str = this.option_tokens(field);
			let def_str    = this.default_option_suffix(field, tokens_str);

			if (!this.is_timeslot_picker_enabled()) {
				const opts = Array.isArray(field.options) ? field.options : [];

				const has_selected_default = opts.some(o =>
					o && (o.selected === true || o.selected === 'true' || o.selected === 1 || o.selected === '1')
				);

				if (!has_selected_default) {
					const has_empty_value_option = opts.some(o =>
						o && typeof o.value !== 'undefined' && String(o.value).trim() === ''
					);

					if (!has_empty_value_option) {
						const phText     = this.time_placeholder_for(name, field);
						const phTokenStr = '"' + core.WPBC_BFB_Sanitize.escape_for_shortcode(phText + '@@') + '"';

						const other = this.option_tokens(field).trim(); // recompute, trim leading space
						tokens_str  = ' ' + phTokenStr + (other ? (' ' + other) : '');

						// Ensure first option (our placeholder) becomes the default implicitly
						def_str = '';
					}
				}
			}
			return { tokens_str, def_str };
		}

		static emit_time_select(name, field, req_mark, id_opt, cls_opts, emit_label_then) {
			const { tokens_str, def_str } = this.build_time_select_tokens(field, name);
			// NOTE: No size/ph tokens here to mirror rangetime behavior exactly.
			emit_label_then(`[selectbox${req_mark} ${name}${id_opt}${cls_opts}${def_str}${tokens_str}]`);
		}

		// -- Other Helpers --------------------------------------------------------------------------------------------
		// Return a field's default value (supports both camelCase and snake_case).
		static get_default_value(field) {
			const v = field?.default_value ?? field?.defaultValue ?? '';
			return (v == null) ? '' : String( v );
		}

		// For text-like fields, the default is a final quoted token in the shortcode.
		static default_text_suffix(field) {
			const v = this.get_default_value( field );
			if ( !v ) return '';
			return ` "${core.WPBC_BFB_Sanitize.escape_for_shortcode( v )}"`;
		}

		static class_options(field) {
			const raw = field.class || field.className || field.cssclass || '';
			const cls = core.WPBC_BFB_Sanitize.sanitize_css_classlist( String( raw ) );
			if ( !cls ) return '';
			return cls
				.split( /\s+/ )
				.filter( Boolean )
				.map( (c) => ` class:${core.WPBC_BFB_Sanitize.to_token( c )}` )
				.join( '' );
		}

		static id_option(field, ctx) {
			const raw_id = field.html_id || field.id_attr;
			if ( !raw_id ) return '';
			const base = core.WPBC_BFB_Sanitize.to_token( raw_id );
			if ( !base ) return '';
			let unique = base, i = 2;
			while ( ctx.usedIds.has( unique ) ) unique = `${base}_${i++}`;
			ctx.usedIds.add( unique );
			return ` id:${unique}`;
		}

		static ph_attr(v) {
			if ( v == null || v === '' ) return '';
			return ` placeholder:"${core.WPBC_BFB_Sanitize.escape_for_attr_quoted( v )}"`;
		}

		// text-like size/maxlength token: "40/255" (or "40/" or "/255")
		static size_max_token(f) {
			const size = parseInt( f.size, 10 );
			const max  = parseInt( f.maxlength, 10 );
			if ( Number.isFinite( size ) && Number.isFinite( max ) ) return ` ${size}/${max}`;
			if ( Number.isFinite( size ) ) return ` ${size}/`;
			if ( Number.isFinite( max ) ) return ` /${max}`;
			return '';
		}

		// textarea cols/rows token: "60x4" (or "60x" or "x4")
		static cols_rows_token(f) {
			const cols = parseInt( f.cols, 10 );
			const rows = parseInt( f.rows, 10 );
			if ( Number.isFinite( cols ) && Number.isFinite( rows ) ) return ` ${cols}x${rows}`;
			if ( Number.isFinite( cols ) ) return ` ${cols}x`;
			if ( Number.isFinite( rows ) ) return ` x${rows}`;
			return '';
		}

		static option_tokens(field) {
			const options = Array.isArray( field.options ) ? field.options : [];
			if ( options.length === 0 ) return '';
			const parts = options.map( (o) => {
				const title = String( o.label ?? o.value ?? '' ).trim();
				const value = String( o.value ?? o.label ?? '' ).trim();
				return title && value && title !== value
					? `"${core.WPBC_BFB_Sanitize.escape_for_shortcode( `${title}@@${value}` )}"`
					: `"${core.WPBC_BFB_Sanitize.escape_for_shortcode( title || value )}"`;
			} );
			return ' ' + parts.join( ' ' );
		}

		static default_option_suffix(field, tokens) {
			const options  = Array.isArray( field.options ) ? field.options : [];
			const selected = options.find( (o) => o.selected );
			const def_val = selected ? (selected.value ?? selected.label) : (field.default_value ?? field.defaultValue ?? '');
			if ( !def_val ) return '';
			return ` default="${core.WPBC_BFB_Sanitize.escape_value_for_attr( def_val )}"`;
		}

		/**
		 * SELECTBOX / RADIO - Build the final shortcode for choice-based fields.
		 *
		 * Responsibilities:
		 *  - Delegates option/default encoding to:
		 *      - WPBC_BFB_Exporter.option_tokens( field )
		 *      - WPBC_BFB_Exporter.default_option_suffix( field, tokens )
		 *  - For `radio`:
		 *      - ALWAYS appends a bare `use_label_element` token.
		 *  - For `selectbox`:
		 *      - Adds a bare `multiple` token when `field.multiple` is truthy
		 *        (true, "true", 1, "1", "multiple") -> `[selectbox services multiple "1" "2"]`.
		 *      - When single-select AND there is no `default="..."` attribute AND
		 *        a non-empty `field.placeholder` is present, encodes the placeholder
		 *        as the FIRST option with empty value via the `@@` syntax:
		 *           placeholder "---- Select ----"  ->  `"---- Select ----@@"`
		 *        and clears any default attribute:
		 *           [selectbox* services "--- Select ---@@" "Option 1" "Option 2"]
		 *      - Respects `field.use_label_element` (adds bare `use_label_element` when true).
		 *  - For both kinds:
		 *      - Honors `field.label_first` by appending `label_first:"1"` when truthy.
		 *      - Keeps the required star, id and cssclass tokens in the canonical order.
		 *
		 * Final shortcode layout (order is important):
		 *   [kind req name id cls use_label_element multiple default tokens label_first]
		 *
		 * @jDoc
		 * @param {string} kind
		 *   Shortcode kind; typically "radio" or "selectbox".
		 *
		 * @param {string} req_mark
		 *   Required marker used by Contact Form 7 style shortcodes:
		 *   either "" (not required) or "*" (required).
		 *
		 * @param {string} name
		 *   Sanitized field name as exported into the shortcode, e.g. "services".
		 *   Must already be computed via WPBC_BFB_Exporter.compute_name().
		 *
		 * @param {Object} field
		 *   Normalized field data object as stored in the Builder structure. Common keys:
		 *     - type           {string}   Field type, e.g. "radio" | "select".
		 *     - options        {Array}    Option objects: { label, value, selected }.
		 *     - placeholder    {string}   Placeholder text (single-select only).
		 *     - multiple       {boolean|string|number}  Enables multi-select when truthy.
		 *     - use_label_element {boolean}  Request bare `use_label_element` token (non-radio).
		 *     - label_first    {boolean}  If true, appends `label_first:"1"` token.
		 *     - default_value  {string}   Optional default value (used by default_option_suffix()).
		 *     - html_id / cssclass / class / className  {string}  Used upstream in id_opt/cls_opts.
		 *
		 * @param {string} id_opt
		 *   Optional id token built by WPBC_BFB_Exporter.id_option(field, ctx),
		 *   e.g. " id:my_id" or empty string.
		 *
		 * @param {string} cls_opts
		 *   Class tokens built by WPBC_BFB_Exporter.class_options(field),
		 *   e.g. " class:my_class class:other".
		 *
		 * @returns {string}
		 *   Complete shortcode body for the choice field, for example:
		 *     "[radio* services use_label_element \"A\" \"B\"]"
		 *     "[selectbox services multiple \"1\" \"2\" \"3\"]"
		 *     "[selectbox* services \"--- Select ---@@\" \"Option 1\" \"Option 2\"]"
		 */
		static choice_tag(kind, req_mark, name, field, id_opt, cls_opts) {
			// Start from the raw options/default as before.
			let tokens = WPBC_BFB_Exporter.option_tokens( field );
			let def    = WPBC_BFB_Exporter.default_option_suffix( field, tokens );

			// For RADIO we must ALWAYS include a bare `use_label_element` token (no value/quotes).
			// For other kinds, keep backward compatibility: include only if explicitly set.
			let ule = '';
			if ( kind === 'radio' ) {
				ule = ' use_label_element';
			} else if ( field && field.use_label_element ) {
				ule = ' use_label_element';
			}

			// SELECTBOX-specific extras:
			//  - "multiple" flag
			//  - placeholder exported as FIRST OPTION when single-select and no default.
			let multiple_flag = '';

			if ( kind === 'selectbox' && field ) {
				const multiple =
					field.multiple === true   ||
					field.multiple === 'true' ||
					field.multiple === 1      ||
					field.multiple === '1'    ||
					field.multiple === 'multiple';

				if ( multiple ) {
					// Export bare "multiple" token as in: [selectbox services multiple "1" "2" "3"].
					multiple_flag = ' multiple';
				} else if ( !def ) {
					// Single-select + NO default selected:
					// export placeholder as the FIRST OPTION with empty value:
					//   [selectbox* services "--- Select ---@@" "Option 1" "Option 2"]
					const rawPh = field.placeholder;
					const ph    = (typeof rawPh === 'string') ? rawPh.trim() : '';

					if ( ph ) {
						const S      = core.WPBC_BFB_Sanitize;
						const esc_sc = (S && S.escape_for_shortcode) ? S.escape_for_shortcode : (v) => String( v );

						const phToken = `"${esc_sc( ph + '@@' )}"`;

						if ( tokens && tokens.length ) {
							// tokens already starts with a leading space.
							tokens = ' ' + phToken + tokens;
						} else {
							tokens = ' ' + phToken;
						}

						// Ensure there is still NO default attribute when using placeholder-as-option.
						def = '';
					}
				}
			}

			// Optional: label_first stays as quoted flag when explicitly requested.
			const lf = (field && field.label_first) ? ' label_first:"1"' : '';

			// IMPORTANT ORDER (per request):
			// [kind req name id cls use_label_element multiple default tokens label_first]
			// i.e. `use_label_element` (and select extras) come BEFORE default/tokens.
			return `[${kind}${req_mark} ${name}${id_opt}${cls_opts}${ule}${multiple_flag}${def}${tokens}${lf}]`;
		}

		static compute_name(type, field) {
			// Names are fully validated when the field is added to the canvas.
			// The exporter must therefore preserve them (apart from idempotent sanitization), otherwise existing forms can break.
			const Sanit = core.WPBC_BFB_Sanitize;

			const raw = (field && (field.name || field.id)) ? String(field.name || field.id) : String(type || 'field');

			// Idempotent sanitization only – no auto-prefixing or renaming.
			const name = Sanit.sanitize_html_name( raw );

			// In the unlikely case sanitization returns an empty string, fall back to a sanitized type-based token.
			return name || Sanit.sanitize_html_name( String(type || 'field') );
		}

		/**
		 * Register a per-field exporter.
		 *
		 * This is the ONLY place where field-specific shortcode markup should live.
		 * Core stays generic; packs provide tiny plugins, for example:
		 *
		 *   WPBC_BFB_Exporter.register( 'text', (field, emit, extras) => { ... } );
		 *
		 * @jDoc
		 * @param {string} type  Field type key, e.g. 'steps_timeline'
		 * @param {(field:any, emit:(code:string)=>void, extras?:{io?:any,cfg?:any,once?:any,ctx?:any,core?:any})=>void}
		 *     fn
		 * @returns {void}
		 */
		static register(type, fn) {
			if ( ! type || typeof fn !== 'function' ) { return; }
			if ( ! this.__registry ) { this.__registry = new Map(); }
			this.__registry.set( String( type ).toLowerCase(), fn );
		}

		/**
		 * Unregister a previously registered exporter.
		 *
		 * @jDoc
		 * @param {string} type
		 * @returns {void}
		 */
		static unregister(type) {
			if ( ! this.__registry || ! type ) { return; }
			this.__registry.delete( String( type ).toLowerCase() );
		}

		/**
		 * Check if an exporter exists for a given field type.
		 *
		 * @jDoc
		 * @param {string} type
		 * @returns {boolean}
		 */
		static has_exporter(type) {
			return !!( this.__registry && this.__registry.has( String( type ).toLowerCase() ) );
		}

		/**
		 * Run a registered exporter for a field, if present.
		 * Returns true if a registered exporter handled it.
		 *
		 * @jDoc
		 * @param {any} field
		 * @param {{open:Function,close:Function,push:Function,blank:Function}} io
		 * @param {any} cfg
		 * @param {any} once
		 * @param {any} ctx
		 * @returns {boolean}
		 */
		static run_registered_exporter(field, io, cfg, once, ctx) {
			if ( ! field || ! field.type || ! this.__registry ) { return false; }
			const key = String( field.type ).toLowerCase();
			const fn  = this.__registry.get( key );
			if ( typeof fn !== 'function' ) { return false; }

			try {
				// Minimal, consistent emit() bridge into our line buffer:
				const emit = (code) => { if ( typeof code === 'string' ) { io.push( code ); } };
				fn( field, emit, { io, cfg, once, ctx, core } );
				return true;
			} catch (e) {
				_wpbc?.dev?.error?.( 'WPBC_BFB_Exporter.run_registered_exporter', e );
				return false;
			}
		}

	}

	// expose globally for packs (if not already).
	window.WPBC_BFB_Exporter = window.WPBC_BFB_Exporter || WPBC_BFB_Exporter;
	wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:exporter-ready', {} );

	// Initialize default skip list; allow a global override array before export runs.
	WPBC_BFB_Exporter.set_skip_attrs( window.WPBC_BFB_EXPORT_SKIP_ATTRS || wpbc_export_skip_attrs_default );

	// == "Content of booking fields data" Exporter ====================================================================

	// – pack-extensible generator for "Content of booking fields data" ============================================
	// == Produces markup like:  "<div class=\"standard-content-form\"><b>Title</b>: <f>[shortcode]</f><br> ... </div>"
	// == Packs can override per type via: WPBC_BFB_ContentExporter.register('calendar', (field, emit, ctx)=>{...})
	// =================================================================================================
	class WPBC_BFB_ContentExporter {

		static register(type, fn) {
			if ( !type || typeof fn !== 'function' ) return;
			if ( !this.__registry ) this.__registry = new Map();
			this.__registry.set( String( type ).toLowerCase(), fn );
		}

		static unregister(type) {
			if ( !this.__registry || !type ) return;
			this.__registry.delete( String( type ).toLowerCase() );
		}

		static has_exporter(type) {
			return !!(this.__registry && this.__registry.has( String( type ).toLowerCase() ));
		}

		static run_registered_exporter(field, emit, ctx) {
			if ( !field || !field.type || !this.__registry ) return false;
			const key = String( field.type ).toLowerCase();
			const fn  = this.__registry.get( key );
			if ( typeof fn !== 'function' ) return false;
			try {
				fn( field, emit, ctx || {} );
				return true;
			} catch ( e ) {
				_wpbc?.dev?.error?.( 'WPBC_BFB_ContentExporter.run_registered_exporter', e );
				return false;
			}
		}

		// === NEW: shared line formatter for "Content of booking fields data" ===
		static emit_line_bold_field(emit, label, token, cfg) {
			const S         = core.WPBC_BFB_Sanitize;
			const sep       = (cfg && typeof cfg.sep === 'string') ? cfg.sep : ': ';
			const addLabels = (cfg && 'addLabels' in cfg) ? !!cfg.addLabels : true;

			const title = (addLabels && label) ? `<b>${S.escape_html(label)}</b>${sep}` : '';

			emit(`${title}<f>[${token}]</f><br>`);
		}

		/**
		 * Export adapted structure to “content of booking fields data”.
		 * @param {{pages:Array}} adapted  result of adapt_builder_structure_to_exporter()
		 * @param {{newline?:string, addLabels?:boolean, sep?:string}} options
		 * @returns {string}
		 */
		static export_content(adapted, options = {}) {

			const cfg   = { newline: '\n', addLabels: true, sep: ': ', indent: '\t', ...options };
			const IND   = (typeof cfg.indent === 'string') ? cfg.indent : '\t';
			let depth   = 0;
			const lines = [];

			const push  = (s = '') => lines.push( IND.repeat( depth ) + String( s ) );
			const open  = (s = '') => { push( s ); depth++; };
			const close = (s = '') => { depth = Math.max( 0, depth - 1 ); push( s ); };

			const emit = (s) => {
				if ( typeof s !== 'string' ) { return; }
				String( s ).split( /\r?\n/ ).forEach( (line) => push( line ) );
			};

			if ( !adapted || !Array.isArray( adapted.pages ) ) return '';

			const skipTypes = new Set( [ 'captcha', 'submit', 'divider', 'wizard_nav', 'cost_corrections' ] );

			const fallbackLine = (field) => {
				const type  = String( field.type || '' ).toLowerCase();
				const name  = WPBC_BFB_Exporter.compute_name( type, field );
				const label = (typeof field.label === 'string' && field.label.trim()) ? field.label.trim() : name;
				if ( !name ) return;
				WPBC_BFB_ContentExporter.emit_line_bold_field( emit, label, name, cfg );
			};

			// Per-type sensible defaults (can be overridden by packs via register())
			const defaultContentFor = (field) => {
				const type = String( field.type || '' ).toLowerCase();
				if ( skipTypes.has( type ) ) return;
				// Special cases out of the box:
				if ( type === 'calendar' ) {
					const label = (typeof field.label === 'string' && field.label.trim()) ? field.label.trim() : 'Dates';
					WPBC_BFB_ContentExporter.emit_line_bold_field( emit, label, 'dates', cfg );
					return;
				}
				// time-like reserved names -> keep placeholder token equal to name
				const reserved = String( field.name || field.id || '' ).toLowerCase();
				if ( [ 'rangetime', 'starttime', 'endtime', 'durationtime' ].includes( reserved ) ) {
					const label = (typeof field.label === 'string' && field.label.trim()) ? field.label.trim() : reserved;
					// Keep your special token for duration time in content: [durationtime_val]
					const token = (reserved === 'durationtime') ? 'durationtime_val' : reserved;
					WPBC_BFB_ContentExporter.emit_line_bold_field( emit, label, token, cfg );
					return;
				}
				// Fallback (text/email/tel/number/textarea/select/checkbox/radio etc.)
				fallbackLine( field );
			};

			// Walk pages/sections/columns/fields (same order as form)
			const walkSection  = (sec) => {
				(sec.columns || []).forEach( (col) => {
					(col.fields || []).forEach( (f) => processField( f ) );
					(col.sections || []).forEach( (s) => walkSection( s ) );
				} );
			};
			const processItem  = (item) => {
				if ( !item ) return;
				if ( item.kind === 'field' ) processField( item.data );
				if ( item.kind === 'section' ) walkSection( item.data );
			};
			const processField = (field) => {
				if ( !field ) return;
				// allow packs to override:
				if ( WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } ) ) return;
				defaultContentFor( field );
			};

			// Wrapper first -> inner lines will be TAB-indented
			open( `<div class="standard-content-form">` );
			adapted.pages.forEach( (page) => (page.items || []).forEach( processItem ) );
			close( `</div>` );

			return lines.join( cfg.newline );
		}

	}

	// expose + ready event for packs to register their content exporters.
	window.WPBC_BFB_ContentExporter = window.WPBC_BFB_ContentExporter || WPBC_BFB_ContentExporter;
	wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:content-exporter-ready', {} );
})();
