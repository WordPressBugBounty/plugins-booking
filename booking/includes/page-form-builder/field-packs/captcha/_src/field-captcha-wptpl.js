// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/captcha/_out/field-captcha-wptpl.js
// == Pack  Text Captcha (WP-template–driven) — Builder-focused renderer
// == Exports to shortcode: [captcha]
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! Registry || typeof Registry.register !== 'function' || ! Base ) {
		w._wpbc?.dev?.error?.( 'wpbc_bfb_field_captcha', 'Core registry/base missing' );
		return;
	}

	/**
	 * Renderer for "captcha" field (template-driven).
	 * Methods/names are in snake_case to follow project conventions.
	 */
	class wpbc_bfb_field_captcha extends Base {

		/** Template id without "tmpl-" prefix. */
		static template_id = 'wpbc-bfb-field-captcha';

		/**
		 * Defaults must stay in sync with the PHP schema.
		 * @returns {Object}
		 */
		static get_defaults() {
			return {
				type     : 'captcha',
				label    : 'CAPTCHA',
				html_id  : '',
				cssclass : '',
				help     : ''
			};
		}

		/**
		 * Render via wp.template into the Builder canvas.
		 *
		 * @param {HTMLElement} el
		 * @param {Object}      data
		 * @param {Object}      ctx
		 * @return {void}
		 */
		static render( el, data, ctx ) {
			if ( ! el ) {
				return;
			}

			// Normalize first (mirrors Base.render).
			var d = this.normalize_data( data );

			// Sanitize helpers available in core.
			var S         = Core.WPBC_BFB_Sanitize || {};
			var html_id   = d.html_id ? ( S.sanitize_html_id ? S.sanitize_html_id( String( d.html_id ) ) : String( d.html_id ) ) : '';
			var css_next  = S.sanitize_css_classlist ? S.sanitize_css_classlist( String( d.cssclass || '' ) ) : String( d.cssclass || '' );

			// Keep wrapper dataset in sync.
			if ( el.dataset.html_id !== html_id ) { el.dataset.html_id = html_id; }

			// Compile template via Base (handles "tmpl-" + caching).
			var tpl = this.get_template( this.template_id );
			if ( typeof tpl !== 'function' ) {
				w._wpbc?.dev?.error?.( 'captcha_wptpl.tpl.missing', 'Template not found: ' + this.template_id );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: wpbc-bfb-field-captcha.</div>';
				return;
			}

			// Stable id suffix (prefer normalized id if present).
			var id_suffix = ( d.id != null ) ? String( d.id ) : ( Math.random().toString( 36 ).slice( 2 ) );

			// Lightweight inline placeholder (SVG) to avoid generating real captcha in Builder.
			var placeholder_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="100%" height="100%" fill="#f2f2f2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="16">CAPTCHA CODE</text></svg>';
			var placeholder_src = 'data:image/svg+xml;utf8,' + encodeURIComponent( placeholder_svg );
			var alt_text = 'TEXT CAPTCHA';

			// Render via template.
			try {
				var tpl_data = Object.assign( {}, d, {
					html_id        : html_id,
					cssclass       : css_next,
					id             : id_suffix,
					placeholder_src: placeholder_src,
					alt_text       : alt_text
				} );
				el.innerHTML = tpl( tpl_data );
			} catch ( e ) {
				w._wpbc?.dev?.error?.( 'captcha_wptpl.tpl.render', e );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering CAPTCHA preview.</div>';
				return;
			}

			// Keep wrapper meta consistent.
			el.dataset.type = d.type || 'captcha';
			el.setAttribute( 'data-label', ( d.label != null ? String( d.label ) : '' ) );

			// Overlay (handles/toolbars).
			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}

		/**
		 * Optional hook after field drop. Keep Base logic for auto-names/ids.
		 *
		 * @param {Object}      data
		 * @param {HTMLElement} el
		 * @param {Object}      ctx
		 * @return {void}
		 */
		static on_field_drop( data, el, ctx ) {
			super.on_field_drop?.( data, el, ctx );
		}
	}

	try {
		Registry.register( 'captcha', wpbc_bfb_field_captcha );
	} catch ( e ) {
		w._wpbc?.dev?.error?.( 'wpbc_bfb_field_captcha.register', e );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback (Advanced Form shortcode) for "captcha".
	 *
	 * This callback is registered per field type via:
	 *   WPBC_BFB_Exporter.register( 'captcha', callback )
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
	 *     -> callback( field, emit, { io, cfg, once, ctx, core } );
	 *
	 * @callback WPBC_BFB_ExporterCallback
	 * @param {Object}  field
	 *   Normalized field data coming from the Builder structure.
	 *   - field.type          {string}   Field type, here always "captcha".
	 *   - field.label         {string}   Visible label in the form (may be empty).
	 *   - field.html_id       {string}   Optional HTML id / user-visible id (ignored here).
	 *   - field.cssclass      {string}   Extra CSS classes entered in Inspector (ignored here).
	 *   - ...                 (Any other pack-specific props are also present.)
	 *
	 * @param {function(string):void} emit
	 *   Emits one line/fragment into the export buffer.
	 *   - Each call corresponds to one `push()` in the core exporter.
	 *   - For multi-line output (e.g. label + shortcode), call `emit()` multiple times:
	 *       emit('<l>Label</l>');
	 *       emit('<br>[captcha]');
	 *
	 * @param {Object} [extras]
	 *   Extra context passed by the core exporter.
	 *
	 * @param {Object} [extras.io]
	 *   Low-level writer used internally by the core.
	 *   Normally you do NOT need it in packs — prefer `emit()`.
	 *   - extras.io.open(str)   -> open a nested block (increments indentation).
	 *   - extras.io.close(str)  -> close a block (decrements indentation).
	 *   - extras.io.push(str)   -> push raw line (used by `emit()`).
	 *   - extras.io.blank()     -> push an empty line.
	 *
	 * @param {Object} [extras.cfg]
	 *   Export configuration (same object passed to WPBC_BFB_Exporter.export_form()).
	 *   Useful flags for field packs:
	 *   - extras.cfg.addLabels {boolean}  Default: true.
	 *       If false, packs should NOT emit <l>Label</l> lines.
	 *   - extras.cfg.newline   {string}   Newline separator (usually "\n").
	 *   - extras.cfg.gapPercent{number}   Layout gap (used only by section/column logic).
	 *
	 * @param {Object} [extras.once]
	 *   Shared "once-per-form" guards across all fields.
	 *   Captcha is a typical once-per-form field:
	 *   - extras.once.captcha {number}   Counter of exported captchas.
	 *
	 * @param {Object} [extras.ctx]
	 *   Shared export context for the entire form (not used here).
	 *
	 * @param {Object} [extras.core]
	 *   Reference to WPBC_BFB_Core passed from builder-exporter.js.
	 *   Primarily used to access sanitizers:
	 *   - extras.core.WPBC_BFB_Sanitize.escape_html(...)
	 *   - etc.
	 */
	function register_captcha_booking_form_exporter() {

		const Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'captcha' ) ) { return; }

		const S   = Core.WPBC_BFB_Sanitize || (w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize) || {};
		const esc = S.escape_html || (v => String( v ));

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 */
		Exp.register( 'captcha', (field, emit, extras = {}) => {

			const cfg       = extras.cfg || {};
			const addLabels = cfg.addLabels !== false;
			const once      = (extras.once && typeof extras.once === 'object') ? extras.once : null;

			// Once-per-form guard: only the first [captcha] is exported.
			if ( once ) {
				once.captcha = (once.captcha || 0) + 1;
				if ( once.captcha > 1 ) {
					return;
				}
			}

			// Body is fixed for this pack.
			const body = '[captcha]';

			// Label behavior identical to legacy emit_label_then('[captcha]').
			const raw_label = (field && typeof field.label === 'string') ? field.label : '';
			const label     = raw_label.trim();

			if ( label && addLabels ) {
				emit( `<l>${esc( label )}</l>` );
				emit( `<br>${body}` );
			} else {
				emit( body );
			}
			// Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
		} );
	}

	// Try immediate registration; if core isn’t ready, wait for the event.
	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_captcha_booking_form_exporter();
	} else {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_captcha_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter callback ("Content of booking fields data") for "captcha".
	 *
	 * This field does NOT contribute any content to the "Content of booking fields data"
	 * template, but we still register an explicit exporter that emits an empty string
	 * for consistency and introspection.
	 *
	 * Registered per field type via:
	 *   WPBC_BFB_ContentExporter.register( 'captcha', callback )
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } );
	 *
	 * @callback WPBC_BFB_ContentExporterCallback
	 * @param {Object}  field   Normalized field data (not used here).
	 * @param {function(string):void} emit
	 *   Emits a raw HTML fragment into the "Content of booking fields data" template.
	 *   Here we explicitly emit an empty string.
	 * @param {Object}  [extras]  Additional context (unused).
	 */
	function register_captcha_booking_data_exporter() {

		const C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'captcha' ) ) { return; }

		C.register( 'captcha', function (field, emit, extras) { // eslint-disable-line no-unused-vars
			// Explicitly export an empty string for captcha in "Content of booking fields data".
			//emit( '' );
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_captcha_booking_data_exporter();
	} else {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_captcha_booking_data_exporter, { once: true } );
	}

})( window );
