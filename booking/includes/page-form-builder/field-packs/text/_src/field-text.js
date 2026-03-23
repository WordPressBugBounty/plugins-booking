/**
 * WPBC BFB: Field Renderer for "text" (Schema-driven Reference, template-literal render)
 * ==============================================================================================
 * Purpose:
 * - Uses template literals (no wp.template)
 * - Inspector is rendered by Factory (PHP schema)
 * - Uses WPBC_BFB_Sanitize (from core) with method names as in bfb-core.js
 *
 * Contracts:
 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register( 'text', Class )
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
 *
 * Notes:
 * - Keep defaults aligned with PHP schema->props->default.
 * - Use Overlay.ensure(...) so field controls (handle, settings, etc.) appear.
 *
 * File:  ../includes/page-form-builder/field-packs/text/_out/field-text.js
 *
 * @since    11.0.0
 * @modified  2025-09-06 14:08
 * @version  1.0.1
 *
 */
(function (w) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		_wpbc?.dev?.error?.( 'WPBC_BFB_Field_Text', 'Core registry/base missing' );
		return;
	}

	class WPBC_BFB_Field_Text extends Base {

		/**
		 * Return default props for "text" field.
		 * Must stay in sync with PHP schema defaults.
		 *
		 * @returns {Object}
		 */
		static get_defaults() {
			return {
				type         : 'text',
				label        : 'Text',
				name         : '',
				html_id      : '',
				placeholder  : '',
				required     : false,
				minlength    : null,
				maxlength    : null,
				pattern      : '',
				cssclass     : '',
				help         : '',
				default_value: ''
			};
		}

		/**
		 * Render the preview markup into the field element.
		 *
		 * @param {HTMLElement} el   Field root element inside the canvas.
		 * @param {Object}      d    Field props (already normalized by schema).
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
			const cssNext  = sclass( String( d.cssclass || '' ) );

			// Keep wrapper classes in sync with dataset.cssclass ONLY (don’t touch core classes).
			// if ( 'cssclass' in d ) {
			// 	const prev = el.dataset.cssclass || '';
			// 	if ( prev !== cssNext ) {
			// 		prev.split( /\s+/ ).filter( Boolean ).forEach( (c) => el.classList.remove( c ) );
			// 		cssNext.split( /\s+/ ).filter( Boolean ).forEach( (c) => el.classList.add( c ) );
			// 		el.dataset.cssclass = cssNext;
			// 	}
			// }
			// NEW: store only; do NOT modify wrapper classes.
			if ( 'cssclass' in d ) {
				if ( el.dataset.cssclass !== cssNext ) {
					el.dataset.cssclass = cssNext;
				}
			}
			// Keep wrapper's stored html_id (dataset) updated.
			if ( 'html_id' in d ) {
				if ( el.dataset.html_id !== html_id ) {
					el.dataset.html_id = html_id;
				}
			}

			// Flags / numeric constraints.
			const is_required   = truthy( d.required );
			const has_minlength = (d.minlength != null && d.minlength !== '' && Number.isFinite( +d.minlength ));
			const has_maxlength = (d.maxlength != null && d.maxlength !== '' && Number.isFinite( +d.maxlength ));
			const has_pattern   = !!d.pattern;

			const minlength_num = has_minlength ? Number( d.minlength ) : null;
			const maxlength_num = has_maxlength ? Number( d.maxlength ) : null;

			// Attribute fragments (using escape_html for safe innerHTML attribute context).
			const id_attr        = html_id ? ` id="${eh( html_id )}"` : '';
			const name_attr      = ` name="${eh( name_val )}"`;
			// const cls_attr       = ` class="wpbc_bfb__preview-input ${eh( cssNext )}"`;
			const cls_attr = ` class="wpbc_bfb__preview-input ${cssNext ? ' ' + eh(cssNext) : ''}"`;
			const ph_attr        = d.placeholder ? ` placeholder="${eh( d.placeholder )}"` : '';
			const req_attr       = is_required ? ' required aria-required="true"' : '';
			const minlength_attr = has_minlength ? ` minlength="${minlength_num}"` : '';
			const maxlength_attr = has_maxlength ? ` maxlength="${maxlength_num}"` : '';
			const pattern_attr   = has_pattern ? ` pattern="${eh( d.pattern )}"` : '';
			const value_attr = (d.default_value != null && d.default_value !== '')
				? ` value="${eh( String( d.default_value ) )}"`
				: '';
			// Optional fragments.
			const label_html = (d.label != null && d.label !== '')
				? `<label class="wpbc_bfb__field-label"${html_id ? ` for="${eh( html_id )}"` : ''}>${eh( d.label )}${is_required ? '<span aria-hidden="true">*</span>' : ''}</label>`
				: '';

			const help_html = d.help ? `<div class="wpbc_bfb__help">${eh( d.help )}</div>` : '';

			// Render preview HTML.
			el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					${label_html}
					<span class="wpbc_wrap_text wpdev-form-control-wrap">
						<input type="text"${cls_attr}${ph_attr}${name_attr} autocomplete="off" tabindex="-1" aria-disabled="true"${id_attr}${value_attr}${req_attr}${minlength_attr}${maxlength_attr}${pattern_attr} />

					</span>
					${help_html}
				</span>
			`;

			// Overlay (handles/toolbars).
			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}

		/**
		 * Optional hook executed after field is dropped from the palette.
		 * Example recipe placeholder for future:   try { if ( !data.name ) { data.name = core.WPBC_BFB_IdService?.next_name?.( 'text' ) || 'text'; }  } catch ( e ) { }
		 *
		 * @param {Object}      data  Palette/field data.
		 * @param {HTMLElement} el    Newly created field element.
		 * @param {Object}      ctx   Context { builder, sanit, context: 'drop' | 'load' | 'preview' }
		 * @returns {void}
		 */
		static on_field_drop(data, el, ctx) {
			super.on_field_drop?.( data, el, ctx );  // Required for correctly auto-names from  Labels !
			// (your extra pack-specific logic if ever needed)
		}
	}

	try {
		registry.register( 'text', WPBC_BFB_Field_Text );
	} catch ( e ) {
		_wpbc?.dev?.error?.( 'WPBC_BFB_Field_Text.register', e );
	}

	// Optional global alias (debugging / dev tools).
	w.WPBC_BFB_Field_Text = w.WPBC_BFB_Field_Text || WPBC_BFB_Field_Text;


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback (Advanced Form shortcode).
	 *
	 * This callback is registered per field type via:
	 *   WPBC_BFB_Exporter.register( 'text', callback )
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
	 *     -> callback( field, emit, { io, cfg, once, ctx, core } );
	 *
	 * @callback WPBC_BFB_ExporterCallback
	 * @param {Object}  field
	 *   Normalized field data coming from the Builder structure.
	 *   - field.type          {string}   Field type, e.g. "text".
	 *   - field.name          {string}   Name as stored on the canvas (already validated).
	 *   - field.id / html_id  {string}   Optional HTML id / user-visible id.
	 *   - field.label         {string}   Visible label in the form (may be empty).
	 *   - field.placeholder   {string}   Placeholder text (may be empty).
	 *   - field.required      {boolean|number|string} "truthy" if required.
	 *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
	 *   - field.default_value {string}   Default text value.
	 *   - field.options       {Array}    Only for option-based fields (select, checkbox, etc.).
	 *   - ...                 (Any other pack-specific props are also present.)
	 *
	 * @param {function(string):void} emit
	 *   Emits one line/fragment into the export buffer.
	 *   - Each call corresponds to one `push()` in the core exporter.
	 *   - For multi-line output (e.g. label + shortcode), call `emit()` multiple times:
	 *       emit('<l>Label</l>');
	 *       emit('<br>[text* name ...]');
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
	 *   Counters are incremented by some field types (captcha, coupon, etc.).
	 *   Typical shape:
	 *   - extras.once.captcha          {number}
	 *   - extras.once.country          {number}
	 *   - extras.once.coupon           {number}
	 *   - extras.once.cost_corrections {number}
	 *   - extras.once.submit           {number}
	 *
	 *   Text field usually does not touch this object, but other packs can use it
	 *   to skip duplicates (e.g. only the first [coupon] per form is exported).
	 *
	 * @param {Object} [extras.ctx]
	 *   Shared export context for the entire form.
	 *   Currently:
	 *   - extras.ctx.usedIds {Set<string>}
	 *       Set of HTML/shortcode IDs already used in this export.
	 *       Helpers like Exp.id_option(field, ctx) use it to ensure uniqueness.
	 *
	 *   Packs normally just pass `ctx` into helpers (id_option, etc.) without
	 *   mutating it directly.
	 *
	 * @param {Object} [extras.core]
	 *   Reference to WPBC_BFB_Core passed from builder-exporter.js.
	 *   Primarily used to access sanitizers:
	 *   - extras.core.WPBC_BFB_Sanitize.escape_html(...)
	 *   - extras.core.WPBC_BFB_Sanitize.escape_for_shortcode(...)
	 *   - extras.core.WPBC_BFB_Sanitize.sanitize_html_name(...)
	 *   - etc.
	 */
	function register_text_booking_form_exporter() {

		const Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'text' ) ) { return; }

		const S = Core.WPBC_BFB_Sanitize;

		Exp.register( 'text', (field, emit, extras = {}) => {

			const cfg       = extras.cfg || {};
			const ctx       = extras.ctx;          // no local fallback needed.
			const addLabels = cfg.addLabels !== false;

			// Required marker logic (same as before).
			const is_req   = Exp.is_required( field );
			const req_mark = is_req ? '*' : '';

			// Reuse helpers from WPBC_BFB_Exporter.
			const name      = Exp.compute_name( 'text', field );
			const id_opt    = Exp.id_option( field, ctx );
			const cls_opts  = Exp.class_options( field );
			const ph_attr   = Exp.ph_attr( field.placeholder );
			const size_max  = Exp.size_max_token( field );
			const def_value = Exp.default_text_suffix( field );

			// Build body shortcode.
			const body = `[text${req_mark} ${name}${size_max}${id_opt}${cls_opts}${ph_attr}${def_value}]`;

			// Label behavior identical to legacy emit_label_then().
			const label = (field.label ?? '').toString().trim();
			if ( label && addLabels ) {
				emit( `<l>${S.escape_html( label )}${req_mark}</l>` );
				emit( `<br>${body}` );
			} else {
				emit( body );
			}
			// Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
		} );
	}

	// Try immediate registration; if core isn’t ready, wait for the event.
	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_text_booking_form_exporter();
	} else {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_text_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter callback ("Content of booking fields data").  Default output: <b>Label</b>: <f>[field_name]</f><br>
	 *
	 * Registered per field type via:
	 *   WPBC_BFB_ContentExporter.register( 'text', callback )
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } );
	 *
	 * @callback WPBC_BFB_ContentExporterCallback
	 * @param {Object}  field
	 *   Normalized field data (same shape as in the main exporter).
	 *   Important properties for content templates:
	 *   - field.type      {string}  Field type, e.g. "text".
	 *   - field.name      {string}  Field name used as placeholder token.
	 *   - field.label     {string}  Human-readable label (may be empty).
	 *   - field.options   {Array}   For option-based fields (select, checkbox, radio, etc.).
	 *   - Other pack-specific props if needed.
	 *
	 * @param {function(string):void} emit
	 *   Emits a raw HTML fragment into the "Content of booking fields data" template.
	 *   Core will wrap everything once into:
	 *     <div class="standard-content-form">
	 *       ... emitted fragments ...
	 *     </div>
	 *
	 *   Typical usage pattern:
	 *     emit('<b>Label</b>: <f>[field_name]</f><br>');
	 *
	 *   In most cases, packs call the shared helper:
	 *     WPBC_BFB_ContentExporter.emit_line_bold_field(emit, label, token, cfg);
	 *
	 * @param {Object} [extras]
	 *   Additional context passed from run_registered_exporter().
	 *
	 * @param {Object} [extras.cfg]
	 *   Content exporter configuration:
	 *   - extras.cfg.addLabels {boolean} Default: true.
	 *       If false, helper may omit the bold label part.
	 *   - extras.cfg.sep       {string}  Label separator, default ": ".
	 *       Example: "<b>Label</b>: " vs "<b>Label</b> – ".
	 *   - extras.cfg.newline   {string}  Newline separator when joining lines (usually "\n").
	 *
	 * @param {Object} [extras.core]
	 *   Reference to WPBC_BFB_Core (same as in main exporter).
	 *   Usually not needed here, because:
	 *   - Sanitization and consistent rendering are already done via
	 *     WPBC_BFB_ContentExporter.emit_line_bold_field( ... ).
	 */
	function register_text_booking_data_exporter() {

		const C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'text' ) ) { return; }

		C.register( 'text', function (field, emit, extras) {

			extras = extras || {};
			const cfg = extras.cfg || {};

			const Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

			const name = Exp.compute_name( 'text', field );
			if ( ! name ) { return; }

			const label = (typeof field.label === 'string' && field.label.trim()) ? field.label.trim() : name;

			// Shared formatter keeps all packs consistent:.
			C.emit_line_bold_field( emit, label, name, cfg );
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_text_booking_data_exporter();
	} else {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_text_booking_data_exporter, { once: true } );
	}

})( window );
