// =================================================================================================
// == Pack: Static Text (WP-template-less; schema-driven)
// == File: /includes/page-form-builder/field-packs/static-text/_out/static-text.js
// == Depends: WPBC_BFB_Field_Base, Field_Renderer_Registry, Core.Sanitize, Exporter API
// == Version: 1.0.1  (09.11.2025)  — add base CSS class "wpbc_static_text" to preview & export
// =================================================================================================
(function (w, d) {
	'use strict';

	var Core      = w.WPBC_BFB_Core || {};
	var registry  = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base      = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		_wpbc?.dev?.error?.( 'wpbc_bfb_field_static_text', 'Core registry/base missing' );
		return;
	}

	/**
	 * Field Renderer: static_text
	 * - Renders a single text element with configurable tag, align, bold, italic.
	 * - Supports pass-through HTML (preview only) if html_allowed=1; otherwise escapes + optional nl2br.
	 *
	 * @class wpbc_bfb_field_static_text
	 * @extends Core.WPBC_BFB_Field_Base
	 */
	class wpbc_bfb_field_static_text extends Base {

		/**
		 * Defaults (must mirror PHP schema).
		 * @returns {{type:string,text:string,tag:string,align:string,bold:number,italic:number,html_allowed:number,nl2br:number,cssclass_extra:string,name:string,html_id:string,help:string,usage_key:string}}
		 */
		static get_defaults() {
			return {
				type            : 'static_text',
				text            : 'Add your message here…',
				tag             : 'p',
				align           : 'left',
				bold            : 0,
				italic          : 0,
				html_allowed    : 0,
				nl2br           : 1,
				cssclass_extra  : '',
				name            : '',
				html_id         : '',
				help            : '',
				usage_key       : 'static_text'
			};
		}

		/**
		 * Whitelist tag.
		 * @param {string} v
		 * @returns {string}
		 */
		static allow_tag( v ) {
			var t = String( v || 'p' ).toLowerCase();
			var ok = { p:1,label:1,span:1,small:1,div:1,h1:1,h2:1,h3:1,h4:1,h5:1,h6:1 };
			return ok[t] ? t : 'p';
		}

		/**
		 * Whitelist align.
		 * @param {string} v
		 * @returns {string}
		 */
		static allow_align( v ) {
			var a = String( v || 'left' ).toLowerCase();
			var ok = { left:1, center:1, right:1 };
			return ok[a] ? a : 'left';
		}

		/**
		 * Escape + optional nl2br for preview/export when HTML is not allowed.
		 * @param {string} raw
		 * @param {boolean} do_nl2br
		 * @returns {string}
		 */
		static escape_text( raw, do_nl2br ) {
			var esc = Core.WPBC_BFB_Sanitize.escape_html( String( raw || '' ) );
			if ( do_nl2br && ! /<br\s*\/?>/i.test( esc ) ) {
				esc = esc.replace(/\n/g, '<br>');
			}
			return esc;
		}

		/**
		 * Main render entry (called by Builder).
		 * Adds the base class "wpbc_static_text" to the text element for styling parity with export.
		 *
		 * @param {HTMLElement} el
		 * @param {Object} data
		 * @param {{builder?:any}} ctx
		 * @returns {void}
		 */
		static render( el, data, ctx ) {
			if ( ! el ) { return; }

			var sanit          = Core.WPBC_BFB_Sanitize || {};
			var esc_html       = sanit.escape_html || (v => String(v).replace(/[<>&"]/g, ''));
			var sanitize_id    = sanit.sanitize_html_id || (v => String(v).trim());
			var sanitize_name  = sanit.sanitize_html_name || (v => String(v).trim());
			var sanitize_cls   = sanit.sanitize_css_classlist || (v => String(v).trim());

			var d_norm         = Object.assign( {}, this.get_defaults(), data || {} );
			var tag            = this.allow_tag( d_norm.tag );
			var align          = this.allow_align( d_norm.align );

			var html_id        = d_norm.html_id ? sanitize_id( String( d_norm.html_id ) ) : '';
			var name_val       = d_norm.name    ? sanitize_name( String( d_norm.name ) )  : '';
			var cls_extra_raw  = String( d_norm.cssclass_extra || '' );
			var cls_extra      = sanitize_cls( cls_extra_raw );

			// Persist sanitized dataset (helps Inspector & snapshots)
			if ( el.dataset.html_id !== html_id ) { el.dataset.html_id = html_id; }
			if ( el.dataset.name    !== name_val ) { el.dataset.name = name_val; }
			if ( el.dataset.cssclass_extra !== cls_extra ) { el.dataset.cssclass_extra = cls_extra; }
			if ( el.dataset.tag     !== tag )   { el.dataset.tag = tag; }
			if ( el.dataset.align   !== align ) { el.dataset.align = align; }

			var id_attr      = html_id ? ' id="' + esc_html( html_id ) + '"' : '';
			var name_attr    = name_val ? ' name="' + esc_html( name_val ) + '"' : '';

			// --- NEW: base class on the TEXT element ---
			var base_cls     = 'wpbc_static_text';
			var tag_cls_full = base_cls + ( cls_extra ? ( ' ' + cls_extra ) : '' );
			var cls_attr     = ' class="' + esc_html( tag_cls_full ) + '"';

			var style_bits = [];
			if ( align )               { style_bits.push( 'text-align:' + align ); }
			if ( d_norm.bold )         { style_bits.push( 'font-weight:bold' ); }
			if ( d_norm.italic )       { style_bits.push( 'font-style:italic' ); }
			var style_attr = style_bits.length ? ( ' style="' + style_bits.join(';') + '"' ) : '';

			// Content
			var content = '';
			if ( d_norm.html_allowed ) {
				content = String( d_norm.text || '' );
			} else {
				content = this.escape_text( d_norm.text, !! d_norm.nl2br );
			}

			var help_html = d_norm.help ? '<div class="wpbc_bfb__help">' + esc_html( String( d_norm.help ) ) + '</div>' : '';

			el.innerHTML =
				'<span class="wpbc_bfb__no-drag-zone" inert="">' +
					'<' + tag + id_attr + name_attr + cls_attr + style_attr + '>' + content + '</' + tag + '>' +
					help_html +
				'</span>';

			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}

		/**
		 * Optional hook after drop (keep base behavior).
		 * @param {Object} data
		 * @param {HTMLElement} el
		 * @param {{palette_item?:HTMLElement}} ctx
		 * @returns {void}
		 */
		static on_field_drop( data, el, ctx ) {
			try { super.on_field_drop?.( data, el, ctx ); } catch (e) {}
		}
	}

	// Register renderer
	try {
		registry.register( 'static_text', wpbc_bfb_field_static_text );
	} catch (e) {
		_wpbc?.dev?.error?.( 'wpbc_bfb_field_static_text.register', e );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Register Booking Form exporter callback (Advanced Form) for "static_text".
	 *
	 * This exporter:
	 *  - Emits plain HTML using the same tag/align/bold/italic rules as the Builder preview.
	 *  - Adds the base class "wpbc_static_text" plus any extra CSS classes.
	 *  - Respects:
	 *      • html_allowed = 1 → pass-through HTML (no escaping).
	 *      • html_allowed = 0 → escape + optional nl2br (via wpbc_bfb_field_static_text.escape_text()).
	 *      • html_id / name   → rendered as id="…" / name="…".
	 *  - Help text is appended centrally by WPBC_BFB_Exporter.render_field_node(), same as other packs.
	 */
	function register_static_text_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'static_text' ) ) { return; }

		var S          = Core.WPBC_BFB_Sanitize || {};
		var esc_html   = S.escape_html           || function( v ){ return String( v ); };
		var sanitizeId = S.sanitize_html_id      || function( v ){ return String( v ).trim(); };
		var sanitizeNm = S.sanitize_html_name    || function( v ){ return String( v ).trim(); };
		var sanitizeCl = S.sanitize_css_classlist|| function( v ){ return String( v ).trim(); };

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 * @param {Object}  field
		 * @param {function(string):void} emit
		 * @param {Object}  [extras]
		 */
		var exporter_callback = function( field, emit, extras ) {
			extras = extras || {};

			// Merge with defaults so all props are present (mirrors preview).
			var defs = wpbc_bfb_field_static_text.get_defaults();
			var d    = Object.assign( {}, defs, field || {} );

			var tag   = wpbc_bfb_field_static_text.allow_tag( d.tag );
			var align = wpbc_bfb_field_static_text.allow_align( d.align );

			var html_id   = d.html_id ? sanitizeId( String( d.html_id ) ) : '';
			var name_val  = d.name    ? sanitizeNm( String( d.name ) )    : '';

			// Extra CSS classes from Inspector / schema.
			var cls_extra_raw = String( d.cssclass_extra || d.cssclass || d.class || '' );
			var cls_extra     = sanitizeCl( cls_extra_raw );

			// Base class for styling parity between Builder preview and exported form.
			var base_cls  = 'wpbc_static_text';
			var cls_full  = base_cls + ( cls_extra ? ( ' ' + cls_extra ) : '' );

			var id_attr   = html_id  ? ' id="'   + esc_html( html_id )  + '"' : '';
			var name_attr = name_val ? ' name="' + esc_html( name_val ) + '"' : '';
			var cls_attr  = ' class="' + esc_html( cls_full ) + '"';

			// Inline styles: text-align + bold/italic flags.
			var style_bits = [];
			if ( align )       { style_bits.push( 'text-align:' + align ); }
			if ( d.bold )      { style_bits.push( 'font-weight:bold' ); }
			if ( d.italic )    { style_bits.push( 'font-style:italic' ); }
			var style_attr = style_bits.length
				? ' style="' + esc_html( style_bits.join( ';' ) ) + '"'
				: '';

			// Content: escape + nl2br when HTML is NOT allowed; raw when allowed.
			var content;
			if ( d.html_allowed ) {
				content = String( d.text || '' );
			} else {
				content = wpbc_bfb_field_static_text.escape_text( d.text, !! d.nl2br );
			}

			emit(
				'<' + tag + id_attr + name_attr + cls_attr + style_attr + '>' +
					content +
				'</' + tag + '>'
			);
			// NOTE:
			//  - Help text (field.help) is output by WPBC_BFB_Exporter.render_field_node()
			//    beneath this block, keeping behavior consistent with other field packs.
		};

		Exp.register( 'static_text', exporter_callback );
	}

	// Try immediate registration; if core isn’t ready yet, wait for the event.
	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_static_text_booking_form_exporter();
	} else {
		d.addEventListener(
			'wpbc:bfb:exporter-ready',
			register_static_text_booking_form_exporter,
			{ once: true }
		);
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Register Booking Data exporter callback ("Content of booking fields data") for "static_text".
	 *
	 * Static Text is purely presentational and does not carry user-entered values,
	 * so it is intentionally omitted from the "Content of booking fields data" output.
	 * This exporter therefore does nothing (emits no line).
	 */
	function register_static_text_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'static_text' ) ) { return; }

		var exporter_callback = function( field, emit, extras ) {
			// Intentionally empty: static_text has no dynamic token/value to show in booking data.
			return;
		};

		C.register( 'static_text', exporter_callback );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_static_text_booking_data_exporter();
	} else {
		d.addEventListener(
			'wpbc:bfb:content-exporter-ready',
			register_static_text_booking_data_exporter,
			{ once: true }
		);
	}

})( window, document );
