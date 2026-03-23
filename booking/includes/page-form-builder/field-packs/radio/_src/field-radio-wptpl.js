/**
 * WPBC BFB: Field Renderer for "radio" (WP-template–driven Reference, no fallback)
 * =========================================================================
 * - Uses wp.template('...') for preview
 * - If template is unavailable or fails, shows an inline error message
 * - Inspector UI is produced by wp.template('...')
 * - Assumes wpbc-bfb_core provides WPBC_BFB_Sanitize
 *
 * Contracts:
 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register('radio', Class)
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
 *
  * File:  ../includes/page-form-builder/field-packs/radio/_out/field-radio-wptpl.js
 *
 * @since   11.0.0
 * @modified  2025-09-12 11:39
 * @version 1.0.1
 */
(function (w) {
	'use strict';

	var Core        = w.WPBC_BFB_Core || {};
	var Registry    = Core.WPBC_BFB_Field_Renderer_Registry;
	var Select_Base = Core.WPBC_BFB_Select_Base;

	if ( ! Registry?.register || ! Select_Base ) {
		w._wpbc?.dev?.error?.( 'WPBC_BFB_Field_Radio', 'Registry or Select_Base missing' );
		return;
	}

	class WPBC_BFB_Field_Radio extends Select_Base {

		static template_id            = 'wpbc-bfb-field-radio';
		static option_row_template_id = 'wpbc-bfb-inspector-radio-option-row';
		static kind                   = 'radio';

		static ui = Object.assign( {}, Select_Base.ui, {
			cssclass_input: '.inspector__input[data-inspector-key="cssclass"]',
			inline_toggle : '.inspector__checkbox.inspector__input[data-inspector-key="layout_inline"]'
		} );

		// … keep get_defaults(), render(), on_field_drop() unchanged …

		// =========================
		// Inline layout (row/column)
		// =========================
		static wire_once_radio() {
			if ( this.__radio_wired ) { return; }
			this.__radio_wired = true;

			const on_ready_or_render = ( ev ) => {
				const panel = ev?.detail?.panel;
				if ( ! panel ) { return; }
				this.bootstrap_panel( panel );                 // DnD etc. from Select_Base
				this.sync_inline_toggle_from_css( panel );     // reflect cssclass -> toggle
			};

			document.addEventListener( 'wpbc_bfb_inspector_ready', on_ready_or_render );
			document.addEventListener( 'wpbc_bfb_inspector_render', on_ready_or_render );

			const root = document.getElementById( 'wpbc_bfb__inspector' );
			if ( ! root ) { return; }

			const get_panel = ( t ) => t?.closest?.( '.wpbc_bfb__inspector__body' ) || root.querySelector( '.wpbc_bfb__inspector__body' ) || null;

			// Toggle changed by user
			root.addEventListener( 'change', ( e ) => {
				const panel = get_panel( e.target );
				if ( ! panel ) { return; }
				if ( e.target.matches?.( this.ui.inline_toggle ) ) {
					e.target.setAttribute( 'aria-checked', e.target.checked ? 'true' : 'false' );
					this.apply_inline_toggle_to_css( panel, !! e.target.checked );
				}
			}, true );

			// Manual edit of CSS class
			root.addEventListener( 'input', ( e ) => {
				const panel = get_panel( e.target );
				if ( ! panel ) { return; }
				if ( e.target.matches?.( this.ui.cssclass_input ) ) {
					this.sync_inline_toggle_from_css( panel );
				}
			}, true );
		}

		static get_cssclass_input( panel ) {
			return panel ? panel.querySelector( this.ui.cssclass_input ) : null;
		}
		static get_inline_toggle( panel ) {
			return panel ? panel.querySelector( this.ui.inline_toggle ) : null;
		}
		static has_inline_class( classes_str ) {
			const s = String( classes_str || '' ).trim();
			if ( ! s ) { return false; }
			return ( ' ' + s.replace( /\s+/g, ' ' ) + ' ' ).indexOf( ' group_inline ' ) !== -1;
		}
		static add_inline_class( classes_str ) {
			var tokens = String( classes_str || '' ).trim().split( /\s+/ ).filter( Boolean );
			if ( tokens.indexOf( 'group_inline' ) === -1 ) {
				tokens.push( 'group_inline' );
			}
			return tokens.join( ' ' ).trim();
		}
		static remove_inline_class( classes_str ) {
			var tokens = String( classes_str || '' ).trim().split( /\s+/ ).filter( Boolean );
			tokens = tokens.filter( function ( t ) { return t !== 'group_inline'; } );
			return tokens.join( ' ' ).trim();
		}

		/**
		 * Mirror CSS class -> toggle checked state.
		 * @param {HTMLElement} panel
		 */
		static sync_inline_toggle_from_css( panel ) {
			const input  = this.get_cssclass_input( panel );
			const toggle = this.get_inline_toggle( panel );
			if ( ! input || ! toggle ) { return; }

			const has = this.has_inline_class( input.value );
			if ( has ) {
				if ( ! toggle.checked ) { toggle.checked = true; }
				toggle.setAttribute( 'aria-checked', 'true' );
			} else {
				if ( toggle.checked ) { toggle.checked = false; }
				toggle.setAttribute( 'aria-checked', 'false' );
			}
		}

		/**
		 * Apply toggle -> add/remove "group_inline" in CSS class field; persist and mirror to canvas node.
		 * @param {HTMLElement} panel
		 * @param {boolean} on
		 */
		static apply_inline_toggle_to_css( panel, on ) {
			const input  = this.get_cssclass_input( panel );
			const toggle = this.get_inline_toggle( panel );
			if ( ! input || ! toggle ) { return; }

			const prev = String( input.value || '' );
			const next = on ? this.add_inline_class( prev ) : this.remove_inline_class( prev );

			if ( next !== prev ) {
				input.value = next;

				// Persist to model
				try {
					input.dispatchEvent( new Event( 'input',  { bubbles: true } ) );
					input.dispatchEvent( new Event( 'change', { bubbles: true } ) );
				} catch ( _ ) {}

				// Mirror to selected field node
				const field = panel.__selectbase_field
					|| document.querySelector( '.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected' );
				if ( field ) {
					field.dataset.cssclass = next;
					field.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', {
						bubbles: true, detail: { key: 'cssclass', value: next }
					} ) );
					Core.Structure?.update_field_prop?.( field, 'cssclass', next );
				}
			}

			// Keep ARIA in sync (also set above on change)
			toggle.setAttribute( 'aria-checked', on ? 'true' : 'false' );
		}
	}

	// Register & wire
	try { Registry.register( 'radio', WPBC_BFB_Field_Radio ); } catch ( e ) { w._wpbc?.dev?.error?.( 'WPBC_BFB_Field_Radio.register', e ); }
	w.WPBC_BFB_Field_Radio = WPBC_BFB_Field_Radio;
	try { WPBC_BFB_Field_Radio.wire_once_radio(); } catch ( _ ) {}

		// -----------------------------------------------------------------------------------------------------------------
		// Export for "Booking Form" (Advanced Form shortcode)
		// -----------------------------------------------------------------------------------------------------------------
		/**
		 * Booking Form exporter callback (Advanced Form shortcode) for "radio".
		 *
		 * This callback is registered per field type via:
		 *   WPBC_BFB_Exporter.register( 'radio', callback )
		 *
		 * Core call site (builder-exporter.js):
		 *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
		 *     -> callback( field, emit, { io, cfg, once, ctx, core } );
		 *
		 * @callback WPBC_BFB_ExporterCallback
		 * @param {Object}  field
		 *   Normalized field data coming from the Builder structure.
		 *   - field.type          {string}   Field type, here "radio".
		 *   - field.label         {string}   Visible label in the form (may be empty).
		 *   - field.name          {string}   Name as stored on the canvas (already validated).
		 *   - field.html_id       {string}   Optional HTML id / user-visible id.
		 *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
		 *   - field.options       {Array}    Options for radio group (label/value/selected).
		 *   - field.label_first   {boolean}  Optional flag to render label before options.
		 *   - field.placeholder   {string}   Optional placeholder (rarely used for radio).
		 *   - ...                 (Any other pack-specific props are also present.)
		 *
		 * @param {function(string):void} emit
		 *   Emits one line/fragment into the export buffer.
		 *
		 * @param {Object} [extras]
		 *   Extra context passed by the core exporter:
		 *   - extras.io   {Object} low-level writer (open/close/push/blank)
		 *   - extras.cfg  {Object} export configuration (addLabels, newline, gapPercent, ...)
		 *   - extras.once {Object} once-per-form guards
		 *   - extras.ctx  {Object} shared export context (ctx.usedIds etc.)
		 *   - extras.core {Object} reference to WPBC_BFB_Core
		 */
		function register_radio_booking_form_exporter() {

			var Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
			if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'radio' ) ) { return; }

			var S        = Core.WPBC_BFB_Sanitize || ( w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize ) || {};
			var esc_html = S.escape_html || function (v) { return String( v ); };

			/**
			 * @type {WPBC_BFB_ExporterCallback}
			 */
			Exp.register( 'radio', function (field, emit, extras) {

				extras = extras || {};

				var cfg       = extras.cfg || {};
				var ctx       = extras.ctx;
				var addLabels = cfg.addLabels !== false;

				// Required marker (same semantics as other text-like fields).
				var is_req   = Exp.is_required( field );
				var req_mark = is_req ? '*' : '';

				// Name / id / classes come from shared helpers so they stay in sync with other packs.
				var name     = Exp.compute_name( 'radio', field );
				var id_opt   = Exp.id_option( field, ctx );
				var cls_opts = Exp.class_options( field );

				// Core helper builds the final radio shortcode with:
				// - ALWAYS a bare `use_label_element` token.
				// - Optional label_first:"1" when requested.
				// - Proper order: name id cls  use_label_element  default tokens label_first.
				var body = Exp.choice_tag( 'radio', req_mark, name, field, id_opt, cls_opts );

				// Label behavior mirrors the text/checkbox exporters.
				var raw_label = ( field && typeof field.label === 'string' ) ? field.label : '';
				var label     = raw_label.trim();

				if ( label && addLabels ) {
					emit( '<l>' + esc_html( label ) + req_mark + '</l>' );
					emit( '<br>' + body );
				} else {
					emit( body );
				}
				// Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
			} );
		}

		// Try immediate registration; if core isn’t ready, wait for the event.
		if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
			register_radio_booking_form_exporter();
		} else {
			document.addEventListener( 'wpbc:bfb:exporter-ready', register_radio_booking_form_exporter, { once: true } );
		}


		// -----------------------------------------------------------------------------------------------------------------
		// Export for "Booking Data" (Content of booking fields data)
		// -----------------------------------------------------------------------------------------------------------------
		/**
		 * Booking Data exporter callback ("Content of booking fields data") for "radio".
		 *
		 * Default behavior:
		 *   <b>Label</b>: <f>[field_name]</f><br>
		 *
		 * Registered per field type via:
		 *   WPBC_BFB_ContentExporter.register( 'radio', callback )
		 *
		 * Packs can customize output if needed, but for radio we keep the same
		 * pattern as text/checkbox:
		 *   - Use the actual canvas name as token.
		 *   - Use label as visible title (fallback to name if empty).
		 */
		function register_radio_booking_data_exporter() {

			var C = w.WPBC_BFB_ContentExporter;
			if ( ! C || typeof C.register !== 'function' ) { return; }
			if ( typeof C.has_exporter === 'function' && C.has_exporter( 'radio' ) ) { return; }

			C.register( 'radio', function (field, emit, extras) {

				extras = extras || {};
				var cfg = extras.cfg || {};

				var Exp = w.WPBC_BFB_Exporter;
				if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

				// Keep the exact exported name in sync with the Booking Form exporter.
				var name = Exp.compute_name( 'radio', field );
				if ( ! name ) { return; }

				var raw_label = ( typeof field.label === 'string' ) ? field.label : '';
				var label     = raw_label.trim() || name;

				// Shared formatter keeps all packs consistent.
				C.emit_line_bold_field( emit, label, name, cfg );
			} );
		}

		if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
			register_radio_booking_data_exporter();
		} else {
			document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_radio_booking_data_exporter, { once: true } );
		}

})( window );
