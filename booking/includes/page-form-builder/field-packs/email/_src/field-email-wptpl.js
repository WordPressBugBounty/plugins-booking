// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/email/_out/field-email-wptpl.js
// == Pack  Email (WP-template–driven) — Builder-focused renderer + optional exporter hook
// == Compatible with PHP pack: ../field-email-wptpl.php (version 1.0.0)
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( !Registry || typeof Registry.register !== 'function' || !Base ) {
		(w._wpbc && w._wpbc.dev && w._wpbc.dev.error) && w._wpbc.dev.error( 'wpbc_bfb_field_email', 'Core registry/base missing' );
		return;
	}

	/**
	 * WPBC_BFB: Email field renderer (template-driven).
	 * Uses wp.template('wpbc-bfb-field-email') for preview and 'wpbc-bfb-inspector-email' for Inspector.
	 */
	const wpbc_bfb_field_email = class extends Base {

		/** Template id without the "tmpl-" prefix (Base normalizes/caches it). */
		static template_id = 'wpbc-bfb-field-email';

		/** Defaults must mirror the PHP schema. */
		static get_defaults() {
			return {
				type       : 'email',
				label      : 'Email',
				name       : 'email',
				help       : 'Enter your email address.',
				html_id    : '',
				placeholder: '',
				required   : true,
				// minlength    : null,
				// maxlength    : null,
				cssclass     : '',
				default_value: '',
				readonly     : true,
			};
		}

		/**
		 * Render field preview via wp.template.
		 *
		 * @param {HTMLElement} el
		 * @param {Object}      data
		 * @param {Object}      ctx
		 */
		static render(el, data, ctx) {
			if ( !el ) {
				return;
			}

			const d = this.normalize_data( data );
			const S = Core.WPBC_BFB_Sanitize;

			// Sanitize ids/names/classes.
			const html_id  = d.html_id ? S.sanitize_html_id( String( d.html_id ) ) : '';
			const name_raw = String( d.name || d.id || 'email' );
			const name     = S.sanitize_html_name( name_raw );
			const cls_next = S.sanitize_css_classlist( String( d.cssclass || '' ) );

			// Keep wrapper dataset consistent.
			if ( el.dataset.html_id !== html_id ) {
				el.dataset.html_id = html_id;
			}
			if ( el.dataset.cssclass !== cls_next ) {
				el.dataset.cssclass = cls_next;
			}
			el.dataset.required = 'true';   // persist the forced value for saving/serialization

			// Compile template.
			const tpl = this.get_template( this.template_id );
			if ( typeof tpl !== 'function' ) {
				(w._wpbc && w._wpbc.dev && w._wpbc.dev.error) && w._wpbc.dev.error( 'email_wptpl.tpl.missing', 'Template not found: ' + this.template_id );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: wpbc-bfb-field-email.</div>';
				return;
			}

			try {
				const tpl_data = {
					...d,
					name,
					html_id,
					cssclass     : cls_next,
					default_value: (d.default_value ?? ''),
				};
				el.innerHTML   = tpl( tpl_data );
			} catch ( e ) {
				(w._wpbc && w._wpbc.dev && w._wpbc.dev.error) && w._wpbc.dev.error( 'email_wptpl.tpl.render', e );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering Email field preview.</div>';
				return;
			}

			// Wrapper meta.
			el.dataset.type = d.type || 'email';
			el.setAttribute( 'data-label', (d.label != null ? String( d.label ) : '') );

			// Normalize attributes on the input (quotes/newlines).
			const input = el.querySelector( 'input[type="email"]' );
			if ( input ) {
				if ( d.placeholder != null ) input.setAttribute( 'placeholder', String( d.placeholder ) );
			}

			// Overlay (handles/toolbars, selection).
			Core.UI && Core.UI.WPBC_BFB_Overlay && Core.UI.WPBC_BFB_Overlay.ensure && Core.UI.WPBC_BFB_Overlay.ensure( ctx?.builder, el );
		}

		/**
		 * Optional hook executed after field is dropped from the palette.
		 * Ensures base behavior (auto-name from label etc.).
		 *
		 * @param {Object}      data
		 * @param {HTMLElement} el
		 * @param {Object}      ctx
		 */
		static on_field_drop(data, el, ctx) {

			super.on_field_drop && super.on_field_drop( data, el, ctx );

			// Lock the "email" field name and disable future auto-naming from label.
			try {
				if ( ! el ) {
					return;
				}
				el.dataset.type              = 'email';
				el.dataset.name              = 'email';
				el.dataset.autoname          = '0';          // ← stop label->name syncing
				el.dataset.fresh             = '0';             // ← kill “fresh” auto-name path
				el.dataset.name_user_touched = '1'; // ← treat as user-set

				// Keep the inner input in sync immediately.
				const input = el.querySelector( 'input[type="email"]' );
				if ( input ) {
					input.setAttribute( 'name', 'email' );
				}
				// If Inspector is open, reflect & visually lock the Name control.
				const ins      = document.getElementById( 'wpbc_bfb__inspector' );
				const nameCtrl = ins && ins.querySelector( '[data-inspector-key="name"]' );
				if ( nameCtrl ) {
					nameCtrl.value    = 'email';
					nameCtrl.readOnly = true;
					nameCtrl.setAttribute( 'aria-readonly', 'true' );
					nameCtrl.classList.add( 'inspector__input--readonly' );
				}
			} catch ( _ ) {}

			// Ensure the dropped element starts in the required state.
			if ( el ) {
				el.setAttribute( 'data-required', 'true' );
			}
		}

	};

	// Register in the Field Renderer Registry.
	try {
		Registry.register( 'email', wpbc_bfb_field_email );
	} catch ( e ) {
		(w._wpbc && w._wpbc.dev && w._wpbc.dev.error) && w._wpbc.dev.error( 'wpbc_bfb_field_email.register', e );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback (Advanced Form shortcode) for "email".
	 *
	 * Registered per field type via:
	 *   WPBC_BFB_Exporter.register( 'email', callback )
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx ) -> callback( field, emit, { io, cfg, once, ctx, core } );
	 *
	 * The callback:
	 *   - Computes the final name via Exp.compute_name('email', field)
	 *   - Uses shared helpers for id/class/placeholder/size/default
	 *   - Emits a shortcode like:
	 *       [email* email 40/255 id:someID class:someCSSclass placeholder:"..." "default@domain.com"]
	 *
	 * Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
	 */
	function register_email_booking_form_exporter() {

		const Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return false; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'email' ) ) { return true; }

		const S   = Core.WPBC_BFB_Sanitize || (w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize) || {};
		const esc = S.escape_html || (v => String( v ));

		/**
		 * @type {(field:Object, emit:(code:string)=>void, extras?:{io?:any,cfg?:any,once?:any,ctx?:any,core?:any})=>void}
		 */
		Exp.register( 'email', (field, emit, extras = {}) => {

			const cfg       = extras.cfg || {};
			const ctx       = extras.ctx;
			const addLabels = cfg.addLabels !== false;

			const is_req   = Exp.is_required( field );
			const req_mark = is_req ? '*' : '';

			const name      = Exp.compute_name( 'email', field );
			const id_opt    = Exp.id_option( field, ctx );
			const cls_opts  = Exp.class_options( field );
			const ph_attr   = Exp.ph_attr( field.placeholder );
			const size_max  = Exp.size_max_token( field );
			const def_value = Exp.default_text_suffix( field );

			// Final shortcode body:
			// [email${req_mark} ${name}${size_max}${id_opt}${cls_opts}${ph_attr}${def_value}]
			const body = `[email${req_mark} ${name}${size_max}${id_opt}${cls_opts}${ph_attr}${def_value}]`;

			const raw_label = (field && typeof field.label === 'string') ? field.label : '';
			const label     = raw_label.trim();

			if ( label && addLabels ) {
				emit( `<l>${esc( label )}${req_mark}</l>` );
				emit( `<br>${body}` );
			} else {
				emit( body );
			}
		} );

		return true;
	}

	// Try immediate registration; if exporter isn't ready yet, wait for the one-shot event.
	if ( ! register_email_booking_form_exporter() ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_email_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter callback for "email" ("Content of booking fields data").
	 * Default output: <b>Label</b>: <f>[field_name]</f><br>
	 *
	 * Registered via:
	 *   WPBC_BFB_ContentExporter.register( 'email', callback )
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } );
	 */
	function register_email_booking_data_exporter() {

		const C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return false; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'email' ) ) { return true; }

		C.register( 'email', function ( field, emit, extras ) {

			extras = extras || {};
			const cfg = extras.cfg || {};

			const Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

			const name = Exp.compute_name( 'email', field );
			if ( ! name ) { return; }

			let label;
			if ( typeof field.label === 'string' && field.label.trim() ) {
				label = field.label.trim();
			} else {
				label = 'Email';
			}

			// Shared formatter keeps all packs consistent.
			C.emit_line_bold_field( emit, label, name, cfg );

			// Fallback - is the reference for other field packs.
			if (0){
				// Defensive fallback: simple, backward-compatible output.
				const core_local = Core || {};
				const S_local    = core_local.WPBC_BFB_Sanitize || {};
				const esc_local  = S_local.escape_html || (s => String( s ) );

				const sep   = (cfg && typeof cfg.sep === 'string') ? cfg.sep : ': ';
				const title = label ? `<b>${esc_local( label )}</b>${sep}` : '';
				emit( `${title}<f>[${name}]</f><br>` );
			}
		} );

		return true;
	}

	if ( ! register_email_booking_data_exporter() ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_email_booking_data_exporter, { once: true } );
	}

})( window );
