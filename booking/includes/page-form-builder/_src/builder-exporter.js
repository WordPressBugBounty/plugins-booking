// =================================================================================================
// == File  /_out/builder-exporter.js ==  Time point: 2025-08-21 17:39
// =================================================================================================

async function wpbc_copy_to_clipboard(text) {
	// Try the modern API first (requires HTTPS/localhost and a user gesture).
	try {
		if ( window.isSecureContext && navigator.clipboard?.writeText ) {
			await navigator.clipboard.writeText( text );
			return true;
		}
	} catch ( _ ) {
		/* fall through to legacy */
	}

	// Legacy fallback: temporary textarea + execCommand('copy').
	try {
		const ta = document.createElement( 'textarea' );
		ta.value = text;
		ta.setAttribute( 'readonly', '' );
		ta.style.position = 'fixed';
		ta.style.top      = '-9999px';
		ta.style.opacity  = '0';
		document.body.appendChild( ta );
		ta.focus();
		ta.select();
		const ok = document.execCommand( 'copy' ); // returns true/false.
		document.body.removeChild( ta );
		return !!ok;
	} catch ( _ ) {
		return false;
	}
}

(function () {
	"use strict";

	const core = window.WPBC_BFB_Core || {};

	// =================================================================================================
	// adapter: builder (array-of-pages) > exporter shape { pages: [ { items:[ {kind,data} ] } ] }
	// =================================================================================================
	function adapt_builder_structure_to_exporter(structure) {

		if ( !Array.isArray( structure ) ) return { pages: [] };

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

		const walk_section = (sec) => ({
			id     : sec?.id,
			columns: (sec?.columns || []).map( (col) => {
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
					width: col?.width || '100%',
					style: col?.style || null,
					fields,
					sections
				};
			} )
		});

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

	// =================================================================================================
	// helper: compute effective flex-basis values that respect inter-column gap
	// =================================================================================================
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

	// =================================================================================================
	// exporter – booking form builder > advanced form (shortcode) exporter with wizard wrapper
	// =================================================================================================
	class WPBC_BFB_Exporter {

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
			const cfg = { newline: '\n', addLabels: true, gapPercent: 3, ...options };

			const IND   = '  ';
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

			const ctx = { usedIds: new Set() };

			open( `<div class="wpbc_wizard__border_container">` );

			// one-per-form guards (calendar is not gated here)
			const once = { captcha: 0, country: 0, coupon: 0, cost_corrections: 0, submit: 0 };

			adapted.pages.forEach( (page, page_index) => {
				const is_first = page_index === 0;
				const is_last  = page_index === adapted.pages.length - 1;
				const step_num = page_index + 1;

				const hidden_class = is_first ? '' : ' wpbc_wizard_step_hidden';
				const hidden_style = is_first ? '' : ' style="display:none;clear:both;"';
				open( `<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step${step_num}${hidden_class}"${hidden_style}>` );

				(page.items || []).forEach( (item) => {
					if ( item.kind === 'section' ) {
						WPBC_BFB_Exporter.render_section( item.data, { open, close, push, blank }, cfg );
						blank();
					} else if ( item.kind === 'field' ) {
						open( `<r>` );
						open( `<c>` );
						WPBC_BFB_Exporter.render_field_node( item.data, { open, close, push, blank }, cfg, once, ctx );
						close( `</c>` );
						close( `</r>` );
						blank();
					}
				} );

				push( `<hr>` );
				open( `<r>` );
				open( `<c style="justify-content: flex-end;">` );
				if ( !is_first ) push( `<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_${step_num - 1}">Back</a>&nbsp;&nbsp;&nbsp;` );
				if ( !is_last ) push( `<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_${step_num + 1}">Next</a>` );
				else if ( once.submit === 0 ) {
					push( `[submit "Send"]` );
					once.submit++;
				}
				close( `</c>` );
				close( `</r>` );
				close( `</div>` );
			} );

			close( `</div>` );
			return lines.join( cfg.newline );
		}

		// -------------------------------- layout --------------------------------
		static render_section(section, io, cfg) {
			const { open, close } = io;

			open( `<r>` );
			const cols = Array.isArray( section.columns ) && section.columns.length ? section.columns : [ {
				width   : '100%',
				fields  : [],
				sections: []
			} ];

			const bases    = compute_effective_bases( cols, cfg.gapPercent );
			const esc_attr = core.WPBC_BFB_Sanitize.escape_html;

			cols.forEach( (col, idx) => {
				let style_attr = '';
				if ( col.style && typeof col.style === 'string' && col.style.trim() ) {
					style_attr = ` style="${esc_attr( col.style.trim() )}"`;
				} else {
					const eff  = bases[idx];
					style_attr = ` style="flex-basis: ${Number.isFinite( eff ) ? eff.toFixed( 4 ) : 100}%;"`;
				}

				open( `<c${style_attr}>` );

				(col.fields || []).forEach( (node) => WPBC_BFB_Exporter.render_field_node( node, io, cfg, {
					captcha         : 1,
					country         : 1,
					coupon          : 1,
					cost_corrections: 1,
					submit          : 1
				}, { usedIds: new Set() } ) );
				(col.sections || []).forEach( (nested) => WPBC_BFB_Exporter.render_section( nested, io, cfg ) );

				close( `</c>` );
			} );

			close( `</r>` );
		}

		// -------------------------------- fields --------------------------------
		static render_field_node(field, io, cfg, once, ctx) {
			const { push } = io;
			if ( !field || !field.type ) return;

			const type = String( field.type ).toLowerCase();
			const name = WPBC_BFB_Exporter.compute_name( type, field );

			const is_req   = (
				field.required === true ||
				field.required === 'true' ||
				field.required === 1 ||
				field.required === '1' ||
				field.required === 'required'
			);
			const req_mark = is_req ? '*' : '';

			const id_opt   = WPBC_BFB_Exporter.id_option( field, ctx );
			const cls_opts = WPBC_BFB_Exporter.class_options( field );
			const ph_attr  = WPBC_BFB_Exporter.ph_attr( field.placeholder );

			const emit_label_then = (body) => {
				const lbl = (field.label ?? '').toString().trim();
				if ( !lbl || !cfg.addLabels ) {
					push( body );
				} else {
					push( `<l>${core.WPBC_BFB_Sanitize.escape_html( lbl )}</l>` );
					push( `<br>${body}` );
				}
				if ( field.help ) {
					push( `<div class="wpbc_field_description">${core.WPBC_BFB_Sanitize.escape_html( String( field.help ) )}</div>` );
				}
			};

			// special blocks
			if ( type === 'calendar' ) {
				push( `[calendar]` );
				return;
			}

			if ( type === 'captcha' ) {
				if ( once.captcha++ ) {
					push( `<!-- Skipped extra [captcha] (allowed once) -->` );
				} else {
					push( `[captcha]` );
				}
				return;
			}

			if ( type === 'country' ) {
				if ( once.country++ ) {
					push( `<!-- Skipped extra [country] (allowed once) -->` );
					return;
				}
				const cc = (field.defaultValue || '').toString().trim();
				push( cc ? `[country "${core.WPBC_BFB_Sanitize.escape_for_shortcode( cc )}"]` : `[country]` );
				return;
			}

			if ( type === 'coupon' ) {
				if ( once.coupon++ ) {
					push( `<!-- Skipped extra [coupon discount] (allowed once) -->` );
				} else {
					// name is required for coupon by the PHP engine; "discount" is a sensible default
					push( `[coupon discount]` );
				}
				return;
			}

			if ( type === 'cost_corrections' ) {
				if ( once.cost_corrections++ ) {
					push( `<!-- Skipped extra [cost_corrections] (allowed once) -->` );
				} else {
					push( `[cost_corrections]` );
				}
				return;
			}

			if ( type === 'submit' ) {
				const label = field.label ? `"${core.WPBC_BFB_Sanitize.escape_for_shortcode( field.label )}"` : `"Send"`;
				push( `[submit ${label}]` );
				once.submit++;
				return;
			}

			// reserved names
			const reserved_name = (field.name || field.id || '').toLowerCase();

			if ( reserved_name === 'rangetime' ) {
				const tokens = WPBC_BFB_Exporter.option_tokens( field );
				const def    = WPBC_BFB_Exporter.default_option_suffix( field, tokens );
				emit_label_then( `[selectbox rangetime${id_opt}${cls_opts}${tokens}${def}]` );
				return;
			}

			if ( reserved_name === 'durationtime' ) {
				// explicit support
				const tokens = WPBC_BFB_Exporter.option_tokens( field );
				const def    = WPBC_BFB_Exporter.default_option_suffix( field, tokens );
				emit_label_then( `[selectbox durationtime${id_opt}${cls_opts}${tokens}${def}]` );
				return;
			}

			if ( reserved_name === 'starttime' || reserved_name === 'endtime' ) {
				emit_label_then( `[selectbox${req_mark} ${reserved_name}${WPBC_BFB_Exporter.size_max_token( field )}${id_opt}${cls_opts}${ph_attr}]` );
				return;
			}

			// standard inputs
			switch ( type ) {
				case 'text':
					emit_label_then( `[text${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token( field )}${id_opt}${cls_opts}${ph_attr}]` );
					return;

				case 'email':
					emit_label_then( `[email${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token( field )}${id_opt}${cls_opts}${ph_attr}]` );
					return;

				case 'time':
					emit_label_then( `[time${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token( field )}${id_opt}${cls_opts}${ph_attr}]` );
					return;

				case 'tel':
				case 'phone': {
					const extra = ` class:wpdev-validates-as-phone`;
					emit_label_then( `[text${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token( field )}${id_opt}${cls_opts}${extra}${ph_attr}]` );
					return;
				}

				case 'number': {
					const extra = ` class:wpdev-validates-as-number`;
					emit_label_then( `[text${req_mark} ${name}${WPBC_BFB_Exporter.size_max_token( field )}${id_opt}${cls_opts}${extra}${ph_attr}]` );
					return;
				}

				case 'textarea':
					emit_label_then( `[textarea${req_mark} ${name}${WPBC_BFB_Exporter.cols_rows_token( field )}${id_opt}${cls_opts}${ph_attr}]` );
					return;

				case 'radio':
					emit_label_then( WPBC_BFB_Exporter.choice_tag( 'radio', req_mark, name, field, id_opt, cls_opts ) );
					return;

				case 'checkbox':
				case 'checkboxes':
					WPBC_BFB_Exporter.emit_checkbox_singles( field, name, req_mark, id_opt, cls_opts, io, cfg );
					return;

				case 'select':
				case 'selectbox':
					emit_label_then( WPBC_BFB_Exporter.choice_tag( 'selectbox', req_mark, name, field, id_opt, cls_opts ) );
					return;

				default:
					push( `<!-- TODO map field type "${type}" name="${name}" -->` );
			}
		}

		// -------------------------------- checkbox helper --------------------------------
		static emit_checkbox_singles(field, base_name, req_mark, id_opt, cls_opts, io, cfg) {
			const { push } = io;
			const lbl      = (field.label ?? '').toString().trim();

			if ( lbl && cfg.addLabels ) {
				push( `<l>${core.WPBC_BFB_Sanitize.escape_html( lbl )}</l>` );
			}

			const tokens = WPBC_BFB_Exporter.option_tokens( field );
			if ( !tokens.trim() ) {
				const single_label = field.option_label || field.placeholder || lbl || 'I agree';
				push( `[checkbox${req_mark} ${base_name}${id_opt}${cls_opts} "${core.WPBC_BFB_Sanitize.escape_for_shortcode( single_label )}"]` );
			} else {
				const def = WPBC_BFB_Exporter.default_option_suffix( field, tokens );
				push( `[checkbox${req_mark} ${base_name}${id_opt}${cls_opts}${tokens}${def}]` );
			}

			if ( field.help ) {
				push( `<div class="wpbc_field_description">${core.WPBC_BFB_Sanitize.escape_html( String( field.help ) )}</div>` );
			}
		}

		// -------------------------------- helpers --------------------------------

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
			const def_val  = selected ? selected.value ?? selected.label : field.defaultValue ?? '';
			if ( !def_val ) return '';
			return ` default:${core.WPBC_BFB_Sanitize.to_token( def_val )}`;
		}

		static choice_tag(kind, req_mark, name, field, id_opt, cls_opts) {
			const tokens = WPBC_BFB_Exporter.option_tokens( field );
			const def    = WPBC_BFB_Exporter.default_option_suffix( field, tokens );
			const ule    = field.use_label_element ? ` use_label_element:"1"` : '';
			const lf     = field.label_first ? ` label_first:"1"` : '';
			return `[${kind}${req_mark} ${name}${id_opt}${cls_opts}${tokens}${def}${ule}${lf}]`;
		}

		static compute_name(type, field) {
			const raw  = field.name || field.id || '';
			let name   = core.WPBC_BFB_Sanitize.sanitize_html_name( raw );
			const kind = (type === 'select' || type === 'selectbox') ? 'selectbox'
				: (type === 'phone' || type === 'tel') ? 'tel' : type;
			if ( name.toLowerCase() === kind.toLowerCase() ) {
				name = `f_${name}`;
			}
			return name;
		}
	}

	// =================================================================================================
	// live export integration helpers (no page reload on copy)
	// =================================================================================================
	function wpbc_bfb__get_current_structure() {
		if ( window.wpbc_bfb && typeof window.wpbc_bfb.get_structure === 'function' ) {
			return window.wpbc_bfb.get_structure(); // LIVE UI > JSON
		}
		console.error( 'WPBC_BFB: builder instance not found.' );
		return [];
	}

	function acquire_parser() {
		if ( window.wpbc_shortcode_parser ) {
			return window.wpbc_shortcode_parser;
		}
		if ( ! window.WPBC_Form_Shortcode_Parser ) {
			return null;
		}

		window.WPBC_COUNTRIES = window.WPBC_COUNTRIES || {
			US: 'United States',
			GB: 'United Kingdom',
			FR: 'France',
			ES: 'Spain'
		};

		const booking_type =
				  window._wpbc_builder?.current_booking_type ??
				  window.wpbc_bfb?.current_booking_type ??
				  1;

		try {
			window.wpbc_shortcode_parser = new WPBC_Form_Shortcode_Parser( {
				current_booking_type: String( booking_type ),
				countries_list      : window.WPBC_COUNTRIES,
				current_edit_booking: window._wpbc_builder?.current_edit_booking || null,
				posted_data         : {}
			} );
			return window.wpbc_shortcode_parser;
		} catch ( _e ) {
			return null;
		}
	}

	function wpbc_bfb__export_to_advanced_form(structure) {

		if ( ! structure ) {
			structure = wpbc_bfb__get_current_structure();
		}

		const adapted = adapt_builder_structure_to_exporter( structure );
		const output  = WPBC_BFB_Exporter.export_form( adapted, { addLabels: true, gapPercent: 3 } );

		let box = document.getElementById( 'wpbc_bfb__advanced_form_output' );
		let pv  = document.getElementById( 'wpbc_bfb__advanced_form_preview' );

		if ( ! box ) {
			const save_btn       = document.getElementById( 'wpbc_bfb__save_btn' );
			const wrap           = document.createElement( 'div' );
			wrap.style.marginTop = '14px';

			const h        = document.createElement( 'h4' );
			h.textContent  = 'Advanced Form (export)';
			h.style.margin = '0 0 6px';

			box                  = document.createElement( 'textarea' );
			box.id               = 'wpbc_bfb__advanced_form_output';
			box.style.width      = '100%';
			box.style.minHeight  = '240px';
			box.style.fontFamily = 'monospace';
			box.style.fontSize   = '12px';
			box.readOnly         = false;

			const copy_btn           = document.createElement( 'button' );
			copy_btn.type            = 'button';
			copy_btn.className       = 'button';
			copy_btn.textContent     = 'Copy to Clipboard';
			copy_btn.style.marginTop = '8px';
			copy_btn.addEventListener( 'click', async (e) => {

				e.preventDefault();
				const ok = await wpbc_copy_to_clipboard( box.value );

				if ( ok ) {
					copy_btn.textContent = 'Copied!';
				} else {
					try {
						box.focus();
						box.select();
					} catch ( _ ) {
					}
					copy_btn.textContent = 'Press Ctrl/Cmd+C to copy';
				}

				setTimeout( () => (copy_btn.textContent = 'Copy to Clipboard'), 1500 );
			} );

			const pv_label        = document.createElement( 'div' );
			pv_label.textContent  = 'Live preview:';
			pv_label.style.margin = '12px 0 4px';

			pv                  = document.createElement( 'div' );
			pv.id               = 'wpbc_bfb__advanced_form_preview';
			pv.className        = 'wpbc_bfb__advanced_form_preview';
			pv.style.minHeight  = '60px';
			pv.style.border     = '1px solid #e5e7eb';
			pv.style.padding    = '8px';
			pv.style.background = '#fff';

			wrap.appendChild( h );
			wrap.appendChild( box );
			wrap.appendChild( copy_btn );
			wrap.appendChild( pv_label );
			wrap.appendChild( pv );

			if ( save_btn && save_btn.parentNode ) {
				save_btn.parentNode.appendChild( wrap );
			} else {
				document.body.appendChild( wrap );
			}
		} else if ( ! pv ) {
			pv                  = document.createElement( 'div' );
			pv.id               = 'wpbc_bfb__advanced_form_preview';
			pv.className        = 'wpbc_bfb__advanced_form_preview';
			pv.style.minHeight  = '60px';
			pv.style.border     = '1px solid #e5e7eb';
			pv.style.padding    = '8px';
			pv.style.background = '#fff';
			box.insertAdjacentElement( 'afterend', pv );
		}

		box.value = output;

		try {
			box.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		} catch ( _ ) {
		}

		try {
			const parser = acquire_parser();
			if ( pv && parser?.form_elements ) {
				pv.innerHTML = parser.form_elements( box.value, true ) || '<em>Nothing to preview.</em>';
			}
		} catch ( _e ) {
		}
	}

	( function add_export_button() {
		const save_btn = document.getElementById( 'wpbc_bfb__save_btn' );
		if ( ! save_btn || document.getElementById( 'wpbc_bfb__export_btn' ) ) {
			return;
		}

		const btn            = document.createElement( 'button' );
		btn.type             = 'button'; // never submit.
		btn.id               = 'wpbc_bfb__export_btn';
		btn.className        = 'button';
		btn.style.marginLeft = '8px';
		btn.textContent      = 'Export to Advanced Form';

		btn.addEventListener( 'click', (e) => {
			e.preventDefault();

			const b = window.wpbc_bfb;
			let structure;

			if ( b && typeof b.get_structure === 'function' ) {
				structure = b.get_structure();

				try {
					console.log( JSON.stringify( structure, null, 2 ) );
				} catch ( _ ) {
				}

				try {
					if ( window.WPBC_BFB_Events ) {
						b.bus?.emit?.( window.WPBC_BFB_Events.STRUCTURE_CHANGE, { structure } );
					}
					document.dispatchEvent( new CustomEvent( 'wpbc:bfb:structure:change', { detail: { structure }, bubbles: true } ) );
				} catch ( _ ) {
				}

				try {
					b.load_saved_structure( structure, { deferIfTyping: false } );
				} catch ( _ ) {
				}
			}

			wpbc_bfb__export_to_advanced_form( structure );
		} );

		save_btn.parentNode?.insertBefore( btn, save_btn.nextSibling );
	})();

	document.addEventListener( 'wpbc:bfb:structure:change', () => {
		const box = document.getElementById( 'wpbc_bfb__advanced_form_output' );
		if ( box ) {
			wpbc_bfb__export_to_advanced_form( wpbc_bfb__get_current_structure() );
		}
	} );

})();
