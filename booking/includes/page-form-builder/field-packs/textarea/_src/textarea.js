/**
 * WPBC BFB: Textarea Renderer (Schema-driven)
 * =====================================================================================================================
 * File: /includes/page-form-builder/field-packs/textarea/_out/textarea.js
 * =====================================================================================================================
 */
(function (w) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		_wpbc?.dev?.error?.( 'WPBC_BFB_Field_Textarea', 'Core registry/base missing' );
		return;
	}

	/**
	 * WPBC BFB: Field Renderer for "textarea" (Schema-driven, template-literal render)
	 *
	 * Contracts:
	 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register( 'textarea', Class )
	 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
	 *
	 * Notes:
	 * - Keep defaults aligned with PHP schema->props->default.
	 * - Uses WPBC_BFB_Sanitize helpers from Core.
	 * - Uses Overlay.ensure(...) so field controls (handle, settings, etc.) appear.
	 */
	class WPBC_BFB_Field_Textarea extends Base {

		/**
		 * Return default props for "textarea" field.
		 * Must stay in sync with PHP schema defaults.
		 *
		 * @returns {Object}
		 */
		static get_defaults() {
			return {
				type         : 'textarea',
				label        : 'Textarea',
				name         : '',
				html_id      : '',
				placeholder  : '',
				required     : false,
				minlength    : null,
				maxlength    : null,
				rows         : 4,
				cssclass     : '',
				help         : '',
				default_value: '',
				min_width    : '260px'
			};
		}

		/**
		 * Render the preview markup into the field element.
		 *
		 * @param {HTMLElement} el   Field root element inside the canvas.
		 * @param {Object}      data Field props (already normalized by schema).
		 * @param {Object}      ctx  Context: { builder, sanit, ... }
		 */
		static render(el, data, ctx) {
			if ( ! el ) {
				return;
			}

			// Normalize against defaults first.
			const d = this.normalize_data( data );

			// ----- Core sanitize helpers (static) -----
			const eh     = (v) => Core.WPBC_BFB_Sanitize.escape_html( v );
			const sid    = (v) => Core.WPBC_BFB_Sanitize.sanitize_html_id( v );
			const sname  = (v) => Core.WPBC_BFB_Sanitize.sanitize_html_name( v );
			const sclass = (v) => Core.WPBC_BFB_Sanitize.sanitize_css_classlist( v );
			const truthy = (v) => Core.WPBC_BFB_Sanitize.is_truthy( v );

			// Sanitize public id/name for the control itself.
			const html_id  = d.html_id ? sid( String( d.html_id ) ) : '';
			const name_val = sname( String( d.name || d.id || 'field' ) );
			const css_next = sclass( String( d.cssclass || '' ) );

			// Keep dataset in sync (do not mutate wrapper classes).
			if ( 'cssclass' in d && el.dataset.cssclass !== css_next ) {
				el.dataset.cssclass = css_next;
			}
			if ( 'html_id' in d && el.dataset.html_id !== html_id ) {
				el.dataset.html_id = html_id;
			}
			// NEW: persist min_width for the Min-Width guard / layout controller.
			if ( d.min_width ) {
				el.dataset.min_width = String( d.min_width );
				el.style.setProperty( '--wpbc-col-min', String( d.min_width ) );
			}

			// Flags / numeric constraints.
			const is_required   = truthy( d.required );
			const has_minlength = (d.minlength != null && d.minlength !== '' && Number.isFinite( +d.minlength ));
			const has_maxlength = (d.maxlength != null && d.maxlength !== '' && Number.isFinite( +d.maxlength ));
			const rows_num      = (d.rows != null && Number.isFinite( +d.rows ) && +d.rows > 0)
				? Math.max( 1, Math.min( 50, +d.rows ) )
				: 4;

			const minlength_num = has_minlength ? Number( d.minlength ) : null;
			const maxlength_num = has_maxlength ? Number( d.maxlength ) : null;

			// Attribute fragments.
			const id_attr        = html_id ? ` id="${eh( html_id )}"` : '';
			const name_attr      = ` name="${eh( name_val )}"`;
			// Include the base preview class so the canvas styles apply.
			const cls_attr       = ` class="wpbc_bfb__preview-input wpbc_bfb__preview-textarea${css_next ? ' ' + eh( css_next ) : ''}"`;
			const ph_attr        = d.placeholder ? ` placeholder="${eh( d.placeholder )}"` : '';
			const req_attr       = is_required ? ' required aria-required="true"' : '';
			const minlength_attr = has_minlength ? ` minlength="${minlength_num}"` : '';
			const maxlength_attr = has_maxlength ? ` maxlength="${maxlength_num}"` : '';
			const rows_attr      = ` rows="${rows_num}"`;

			const label_html = (d.label != null && d.label !== '')
				? `<label class="wpbc_bfb__field-label"${html_id ? ` for="${eh( html_id )}"` : ''}>${eh( d.label )}${is_required ? '<span aria-hidden="true">*</span>' : ''}</label>`
				: '';

			const help_html    = d.help ? `<div class="wpbc_bfb__help">${eh( d.help )}</div>` : '';
			const default_text = (d.default_value != null && d.default_value !== '') ? eh( String( d.default_value ) ) : '';

			el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					${label_html}
					<span class="wpbc_wrap_text wpdev-form-control-wrap">
						<textarea${cls_attr}${ph_attr}${name_attr} tabindex="-1" aria-disabled="true"${id_attr}${rows_attr}${req_attr}${minlength_attr}${maxlength_attr}>${default_text}</textarea>
					</span>
					${help_html}
				</span>
			`;

			// Overlay (handles/toolbars).
			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}

		/**
		 * Optional hook executed after field is dropped from the palette.
		 *
		 * @param {Object}      data  Palette/field data.
		 * @param {HTMLElement} el    Newly created field element.
		 * @param {Object}      ctx   Context { builder, sanit, context: 'drop' | 'load' | 'preview' }
		 * @returns {void}
		 */
		static on_field_drop(data, el, ctx) {
			super.on_field_drop?.( data, el, ctx );
		}
	}

	try {
		registry.register( 'textarea', WPBC_BFB_Field_Textarea );
	} catch ( e ) {
		_wpbc?.dev?.error?.( 'WPBC_BFB_Field_Textarea.register', e );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback for "textarea".
	 *
	 * Produces shortcodes equivalent to the legacy exporter:
	 *   [textarea* your-name 40x4 id:your-name class:your-class "Default text"]
	 *
	 * Labels and help text are handled in the same centralized way as other packs.
	 */
	function register_textarea_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'textarea' ) ) { return; }

		var S = Core.WPBC_BFB_Sanitize || {};

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 */
		Exp.register( 'textarea', function( field, emit, extras ) {
			extras = extras || {};

			var cfg       = extras.cfg || {};
			var ctx       = extras.ctx;
			var addLabels = cfg.addLabels !== false;

			// Required marker (same semantics as text field).
			var is_req   = Exp.is_required( field );
			var req_mark = is_req ? '*' : '';

			// Shared helpers keep naming / id / classes consistent across packs.
			var name     = Exp.compute_name( 'textarea', field );
			var id_opt   = Exp.id_option( field, ctx );
			var cls_opts = Exp.class_options( field );
			var ph_attr  = Exp.ph_attr( field && field.placeholder );
			var def_text = Exp.default_text_suffix( field );

			// Rows token: [textarea name x5] — rows come from schema/Inspector (`field.rows`).
			// Clamp into [1,50] to mirror Inspector constraints.
			var rows_token = '';
			if ( field && field.rows != null && field.rows !== '' ) {
				var r = Number( field.rows );
				if ( ! Number.isFinite( r ) ) {
					r = 4;
				}
				if ( r < 1 )  { r = 1; }
				if ( r > 50 ) { r = 50; }
				rows_token = ' x' + String( r );
			}

			// Final shortcode body (rows-only sizing; no columns), e.g.:
			//   [textarea* your-message x5 id:your-message class:... "Default text"]
			var body = '[textarea' + req_mark + ' ' + name + rows_token + id_opt + cls_opts + ph_attr + def_text + ']';

			// Label behavior mirrors legacy emit_label_then().
			var raw_label = ( field && typeof field.label === 'string' ) ? field.label : '';
			var label     = raw_label.trim();

			if ( label && addLabels ) {
				emit( '<l>' + (S.escape_html ? S.escape_html( label ) : label) + req_mark +  '</l>' );
				emit( '<br>' + body );
			} else {
				emit( body );
			}
			// Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
		} );
	}

	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_textarea_booking_form_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_textarea_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter ("Content of booking fields data") for "textarea".
	 *
	 * Default line format:
	 *   <b>Label</b>: <f>[field_name]</f><br>
	 */
	function register_textarea_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'textarea' ) ) { return; }

		C.register( 'textarea', function( field, emit, extras ) {
			extras = extras || {};
			var cfg = extras.cfg || {};

			var Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

			var name = Exp.compute_name( 'textarea', field );
			if ( ! name ) { return; }

			var label = ( field && typeof field.label === 'string' && field.label.trim() ) ? field.label.trim() : name;

			// Shared helper keeps formatting consistent across all packs.
			C.emit_line_bold_field( emit, label, name, cfg );
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_textarea_booking_data_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_textarea_booking_data_exporter, { once: true } );
	}

})( window );
