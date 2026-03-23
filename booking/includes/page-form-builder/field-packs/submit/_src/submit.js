// File: /includes/page-form-builder/field-packs/submit/_out/submit.js
(function ( w ) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		_wpbc?.dev?.error?.( 'WPBC_BFB_Field_Submit', 'Core registry/base missing' );
		return;
	}

	/**
	 * WPBC BFB: Field Renderer for "submit" (Schema-driven, template-literal render)
	 * - Inspector is rendered by Factory (from PHP schema).
	 * - No wp.template usage for preview.
	 */
	class WPBC_BFB_Field_Submit extends Base {

		/**
		 * Return default props for "submit" field.
		 * Must stay in sync with PHP schema defaults.
		 *
		 * @returns {Object}
		 */
		static get_defaults() {
			return {
				type      : 'submit',
				label     : 'Send',
				name      : '',
				html_id   : '',
				cssclass  : 'wpbc_bfb__btn wpbc_bfb__btn--primary',
				help      : '',
				usage_key : 'submit'
			};
		}

		/**
		 * Render the preview markup into the field element.
		 *
		 * @param {HTMLElement} el   Field root element inside the canvas.
		 * @param {Object}      data Field props (already normalized by schema).
		 * @param {Object}      ctx  Context: { builder, sanit, ... }
		 * @returns {void}
		 */
		static render( el, data, ctx ) {

			if ( ! el ) {
				return;
			}

			// Normalize against defaults first.
			const d = this.normalize_data( data );

			// ----- Core sanitize helpers (static) -----
			const eh      = ( v ) => Core.WPBC_BFB_Sanitize.escape_html( v );
			const sid     = ( v ) => Core.WPBC_BFB_Sanitize.sanitize_html_id( v );
			const sname   = ( v ) => Core.WPBC_BFB_Sanitize.sanitize_html_name( v );
			const sclass  = ( v ) => Core.WPBC_BFB_Sanitize.sanitize_css_classlist( v );
			const truthy  = ( v ) => Core.WPBC_BFB_Sanitize.is_truthy( v );
			const one_of  = ( v, list, def ) => ( list.indexOf( v ) !== -1 ? v : def );

			// Public attributes.
			const html_id    = d.html_id ? sid( String( d.html_id ) ) : '';
			const name_val   = d.name ? sname( String( d.name ) ) : '';
			const css_next   = sclass( String( d.cssclass || '' ) );


			// Persist core-related props on dataset (do not mutate wrapper classes directly).
			if ( 'cssclass' in d && el.dataset.cssclass !== css_next ) {
				el.dataset.cssclass = css_next;
			}
			if ( 'html_id' in d && el.dataset.html_id !== html_id ) {
				el.dataset.html_id = html_id;
			}


			// Attribute fragments.
			const id_attr   = html_id ? ` id="${eh( html_id )}"` : '';
			const name_attr = name_val ? ` name="${eh( name_val )}"` : '';
			const cls_attr  = ` class="wpbc_button_light ${css_next ? eh( css_next ) : ''}"`;

			// Optional help text below the button.
			const help_html = d.help ? `<div class="wpbc_bfb__help">${eh( d.help )}</div>` : '';

			// Render preview HTML (no actions; prevent real submit via type="button").
			el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					<div class="wpbc_bfb__field-preview">
						<button type="button"${cls_attr}${id_attr}${name_attr}>
							${eh( d.label || 'Send' )}
						</button>
					</div>
					${help_html}
				</span>
			`;

			// Overlay (handles/toolbars).
			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}


		/**
		 * Optional hook executed after field is dropped from the palette.
		 *
		 * @param {Object}      data
		 * @param {HTMLElement} el
		 * @param {Object}      ctx
		 * @returns {void}
		 */
		static on_field_drop( data, el, ctx ) {
			// Keep base behavior (auto-name from label, etc.).
			super.on_field_drop?.( data, el, ctx );
		}
	}

	try {
		registry.register( 'submit', WPBC_BFB_Field_Submit );
	} catch ( e ) { _wpbc?.dev?.error?.( 'WPBC_BFB_Field_Submit.register', e ); }


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Register Booking Form exporter callback (Advanced Form) for "submit".
	 *
	 * This exporter:
	 *  - Emits the shortcode:
	 *        [submit "Label"]
	 *    where "Label" defaults to "Send" when empty.
	 *  - Behavior is compatible with the previous centralized exporter:
	 *      • uses Core.WPBC_BFB_Sanitize.escape_for_shortcode() when available,
	 *      • does not wrap the shortcode in extra HTML,
	 *      • leaves help text handling to WPBC_BFB_Exporter.render_field_node().
	 */
	function register_submit_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'submit' ) ) { return; }

		var S        = Core.WPBC_BFB_Sanitize || {};
		var esc_html = S.escape_html            || function( v ){ return String( v ); };
		var sid      = S.sanitize_html_id       || function( v ){ return String( v ).trim(); };
		var scls     = S.sanitize_css_classlist || function( v ){ return String( v ).trim(); };
		var esc_sc   = S.escape_for_shortcode   || function( v ){ return String( v ); };

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 * @param {Object}                field
		 * @param {function(string):void} emit
		 * @param {Object}                [extras]
		 */
		var exporter_callback = function( field, emit, extras ) {
			extras = extras || {};

			// Merge with defaults to ensure all props (label, html_id, cssclass, …) are present.
			var defs = WPBC_BFB_Field_Submit.get_defaults();
			var d    = Object.assign( {}, defs, field || {} );

			// Label (shortcode argument).
			var raw_label = ( d && typeof d.label === 'string' && d.label.length ) ? d.label : 'Send';
			var label = '"' + esc_sc( String( raw_label ) ) + '"';

			// ID / class wrapper around the shortcode (layout-only, no behavior).
			var html_id = d.html_id ? sid( String( d.html_id ) ) : '';
			var cls_raw = String( d.cssclass_extra || d.cssclass || d.class || '' );
			var cls_val = scls( cls_raw );

			// Ensure unique id across the export tree (shared Set from the export context).
			var used_ids = extras && extras.ctx && extras.ctx.usedIds;
			if ( html_id && used_ids instanceof Set ) {
				var unique = html_id, i = 2;
				while ( used_ids.has( unique ) ) {
					unique = html_id + '_' + ( i++ );
				}
				used_ids.add( unique );
				html_id = unique;
			}

			var id_attr  = html_id ? ' id="' + esc_html( html_id ) + '"' : '';
			var cls_attr = cls_val ? ' class="' + esc_html( cls_val ) + '"' : '';

			// Only wrap in <span ... style="flex:1;"> if id or class exists (matches other packs).
			var has_wrapper = !! ( id_attr || cls_attr );
			var open        = has_wrapper ? ( '<span' + id_attr + cls_attr + ' style="flex:1;">' ) : '';
			var close       = has_wrapper ? '</span>' : '';

			// Shortcode itself remains legacy-compatible: -    [submit "Send"] //.
			emit( open + '[submit ' + label + ']' + close );
		};

		Exp.register( 'submit', exporter_callback );
	}

	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_submit_booking_form_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_submit_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Register Booking Data exporter callback ("Content of booking fields data") for "submit".
	 *
	 * Submit is a control element and does not carry user-entered values,
	 * so it is intentionally omitted from the "Content of booking fields data" output.
	 */
	function register_submit_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'submit' ) ) { return; }

		/**
		 * @param {Object}                field
		 * @param {function(string):void} emit
		 * @param {Object}                [extras]
		 * @returns {void}
		 */
		var exporter_callback = function( field, emit, extras ) {
			// Intentionally empty: submit has no data token/value.
			return;
		};

		C.register( 'submit', exporter_callback );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_submit_booking_data_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_submit_booking_data_exporter, { once: true } );
	}

})( window );
