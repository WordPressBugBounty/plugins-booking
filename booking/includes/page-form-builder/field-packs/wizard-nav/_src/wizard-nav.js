// File: /includes/page-form-builder/field-packs/wizard-nav/_out/wizard-nav.js
(function ( w ) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		_wpbc?.dev?.error?.( 'WPBC_BFB_Field_Wizard_Nav', 'Core registry/base missing' );
		return;
	}

	/**
	 * WPBC BFB: Field Renderer for "wizard_nav" (Schema-driven)
	 * - Inspector is rendered by Factory (from PHP schema).
	 * - No wp.template usage for preview.
	 * - Must output:
	 *     <a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_{N} [cssclass_extra]">Label</a>
	 */
	class WPBC_BFB_Field_Wizard_Nav extends Base {

		/**
		 * Return default props for "wizard_nav" field.
		 * Must stay in sync with PHP schema defaults.
		 *
		 * @returns {Object}
		 */
		static get_defaults() {
			return {
				type           : 'wizard_nav',
				direction      : 'next',    // 'next' | 'back'
				label          : 'Next',
				target_step    : 2,         // >= 1
				cssclass_extra : '',
				name           : '',
				html_id        : '',
				help           : '',
				usage_key      : 'wizard_nav'
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
			const to_int  = ( v, def ) => {
				const n = parseInt( v, 10 );
				return ( isNaN( n ) || n < 1 ) ? def : n;
			};

			// Direction & label coherence.
			const dir       = ( d.direction === 'back' ) ? 'back' : 'next';
			const step_def  = ( dir === 'next' ) ? 2 : 1;
			const step_num  = to_int( d.target_step, step_def );
			const label_txt = ( typeof d.label === 'string' && d.label.length ) ? d.label : ( dir === 'next' ? 'Next' : 'Back' );

			// Public attributes.
			const html_id    = d.html_id ? sid( String( d.html_id ) ) : '';
			const name_val   = d.name ? sname( String( d.name ) ) : '';
			const cls_extra  = sclass( String( d.cssclass_extra || '' ) );

			// Persist useful props on dataset (do not mutate wrapper classes directly).
			if ( 'cssclass_extra' in d && el.dataset.cssclass_extra !== cls_extra ) {
				el.dataset.cssclass_extra = cls_extra;
			}
			if ( 'html_id' in d && el.dataset.html_id !== html_id ) {
				el.dataset.html_id = html_id;
			}
			if ( 'name' in d && el.dataset.name !== name_val ) {
				el.dataset.name = name_val;
			}
			if ( 'target_step' in d && String( el.dataset.target_step ) !== String( step_num ) ) {
				el.dataset.target_step = String( step_num );
			}
			if ( 'direction' in d && el.dataset.direction !== dir ) {
				el.dataset.direction = dir;
			}

			// Attribute fragments.
			const id_attr    = html_id ? ` id="${eh( html_id )}"` : '';
			const name_attr  = name_val ? ` name="${eh( name_val )}"` : '';
			const req_cls    = `wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_${String( step_num )}`;
			const cls_attr   = ` class="${req_cls}${cls_extra ? ' ' + eh( cls_extra ) : ''}"`;
			const href_attr  = ` href="javascript:void(0);"`;

			// Optional help text below the button.
			const help_html  = d.help ? `<div class="wpbc_bfb__help">${eh( d.help )}</div>` : '';

			// Render preview HTML.
			el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					<div class="wpbc_bfb__field-preview">
						<a${href_attr}${cls_attr}${id_attr}${name_attr}>${eh( label_txt )}</a>
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
		registry.register( 'wizard_nav', WPBC_BFB_Field_Wizard_Nav );
	} catch ( e ) { _wpbc?.dev?.error?.( 'WPBC_BFB_Field_Wizard_Nav.register', e ); }


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback for "wizard_nav".
	 *
	 * Produces anchors equivalent to the legacy exporter:
	 *   <a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_2 extra">Next</a>
	 *
	 * Notes:
	 * - No shortcode; this is pure HTML (navigation control, not a data field).
	 * - Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
	 */
	function register_wizard_nav_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'wizard_nav' ) ) { return; }

		var S        = Core.WPBC_BFB_Sanitize || {};
		var esc_html = S.escape_html              || function( v ){ return String( v ); };
		var sid      = S.sanitize_html_id         || function( v ){ return String( v ).trim(); };
		var scls     = S.sanitize_css_classlist   || function( v ){ return String( v ).trim(); };

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 */
		Exp.register( 'wizard_nav', function( field, emit, extras ) {
			extras = extras || {};

			var ctx     = extras.ctx || {};
			var usedIds = ( ctx.usedIds instanceof Set ) ? ctx.usedIds : null;

			// Merge with defaults to keep behavior stable even if some props are missing.
			var defs = ( typeof WPBC_BFB_Field_Wizard_Nav.get_defaults === 'function' )
				? WPBC_BFB_Field_Wizard_Nav.get_defaults()
				: {};
			var d = Object.assign( {}, defs, field || {} );

			// Direction & label logic (same as preview).
			var dir      = ( d.direction === 'back' ) ? 'back' : 'next';
			var step_raw = parseInt( d.target_step, 10 );
			var step_num = ( Number.isFinite( step_raw ) && step_raw > 0 )
				? step_raw
				: ( dir === 'back' ? 1 : 2 );

			var label_txt = ( typeof d.label === 'string' && d.label.trim().length )
				? d.label.trim()
				: ( dir === 'back' ? 'Back' : 'Next' );

			// HTML ID: sanitize + ensure uniqueness across the export.
			var html_id = d.html_id ? sid( String( d.html_id ) ) : '';
			if ( html_id && usedIds ) {
				var base      = html_id;
				var candidate = base;
				var i         = 2;
				while ( usedIds.has( candidate ) ) {
					candidate = base + '_' + ( i++ );
				}
				usedIds.add( candidate );
				html_id = candidate;
			}

			// Extra classes (in addition to required base wizard nav classes).
			var extra_raw = String( d.cssclass_extra || d.cssclass || d.class || '' );
			var extra_cls = scls( extra_raw );

			var req_cls   = 'wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_' + String( step_num );
			var full_cls  = req_cls + ( extra_cls ? ( ' ' + esc_html( extra_cls ) ) : '' );

			var id_attr   = html_id ? ( ' id="' + esc_html( html_id ) + '"' ) : '';

			// Final anchor — no href (click is handled externally).
			emit(
				'<a class="' + full_cls + '"' + id_attr + '>' +
					esc_html( label_txt ) +
				'</a>'
			);

			// NOTE:
			//  - Help text (field.help) is output by WPBC_BFB_Exporter.render_field_node()
			//    beneath this block, same as for other packs.
		} );
	}

	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_wizard_nav_booking_form_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener(
			'wpbc:bfb:exporter-ready',
			register_wizard_nav_booking_form_exporter,
			{ once: true }
		);
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter callback for "wizard_nav".
	 *
	 * Wizard navigation buttons do not carry user-entered values,
	 * so they are intentionally omitted from the "Content of booking fields data".
	 */
	function register_wizard_nav_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'wizard_nav' ) ) { return; }

		C.register( 'wizard_nav', function( field, emit, extras ) {
			// Intentionally no output: nav buttons are not part of data template.
			return;
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_wizard_nav_booking_data_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener(
			'wpbc:bfb:content-exporter-ready',
			register_wizard_nav_booking_data_exporter,
			{ once: true }
		);
	}

})( window );
