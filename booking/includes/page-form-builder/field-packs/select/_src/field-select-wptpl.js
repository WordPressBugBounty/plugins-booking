// File: /includes/page-form-builder/field-packs/select/_out/field-select-wptpl.js
(function (w) {
	'use strict';
	var Core        = w.WPBC_BFB_Core || {};
	var Registry    = Core.WPBC_BFB_Field_Renderer_Registry;
	var Select_Base = Core.WPBC_BFB_Select_Base;

	if ( ! Registry?.register || ! Select_Base ) {
		w._wpbc?.dev?.error?.( 'WPBC_BFB_Field_Select', 'Registry or Select_Base missing' );
		return;
	}

	class WPBC_BFB_Field_Select extends Select_Base {

		static template_id = 'wpbc-bfb-field-select';
		static kind        = 'select';

		static get_defaults() {
			const d = super.get_defaults();
			return {
				...d,
				type       : 'select',
				label      : 'Select',
				placeholder: '--- Select ---',
				options    : [
					{ label: 'Option 1', value: 'Option 1', selected: false },
					{ label: 'Option 2', value: 'Option 2', selected: false },
					{ label: 'Option 3', value: 'Option 3', selected: false },
					{ label: 'Option 4', value: 'Option 4', selected: false }
				]
			};
		}
	}

	try {
		Registry.register( 'select', WPBC_BFB_Field_Select );
	} catch ( e ) {
		w._wpbc?.dev?.error?.( 'WPBC_BFB_Field_Select.register', e );
	}

	// Optional: used by templates to fetch JS defaults if server data is empty.
	w.WPBC_BFB_Field_Select = WPBC_BFB_Field_Select;



	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback (Advanced Form shortcode) for "select".
	 *
	 * This callback is registered per field type via:
	 *   WPBC_BFB_Exporter.register( 'select', callback )
	 *   (and also as a legacy alias: 'selectbox')
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
	 *     -> callback( field, emit, { io, cfg, once, ctx, core } );
	 *
	 * @callback WPBC_BFB_ExporterCallback
	 * @param {Object}  field
	 *   Normalized field data coming from the Builder structure.
	 *   - field.type          {string}   Field type, usually "select".
	 *   - field.label         {string}   Visible label in the form (may be empty).
	 *   - field.name          {string}   Name as stored on the canvas (already validated).
	 *   - field.html_id       {string}   Optional HTML id / user-visible id.
	 *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
	 *   - field.options       {Array}    Options for select (label/value/selected).
	 *   - field.label_first   {boolean}  Optional flag to render label before current value.
	 *   - field.use_label_element {boolean} Optional flag to force `use_label_element`.
	 *   - ...                 (Any other pack-specific props are also present.)
	 *
	 * @param {function(string):void} emit
	 *   Emits one line/fragment into the export buffer.
	 *
	 * @param {Object} [extras]
	 *   Extra context passed by the core exporter.
	 */
	function register_select_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		// If some other script already registered a "select" exporter, do nothing.
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'select' ) ) { return; }

		var S        = Core.WPBC_BFB_Sanitize || ( w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize ) || {};
		var esc_html = S.escape_html || function ( v ) { return String( v ); };

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 */
		var exporter_callback = function ( field, emit, extras ) {

			extras = extras || {};

			var cfg       = extras.cfg || {};
			var ctx       = extras.ctx;
			var add_labels = cfg.addLabels !== false;

			// Required marker (same semantics as other text-like fields).
			var is_req   = Exp.is_required( field );
			var req_mark = is_req ? '*' : '';

			// Name / id / classes come from shared helpers so they stay in sync with other packs.
			var name     = Exp.compute_name( 'select', field );
			var id_opt   = Exp.id_option( field, ctx );
			var cls_opts = Exp.class_options( field );

			// Use shared choice_tag helper:
			// - Proper order of tokens
			// - Optional use_label_element / label_first support
			// - Options + default handling identical to legacy exporter.
			var body = Exp.choice_tag( 'selectbox', req_mark, name, field, id_opt, cls_opts );

			// Label behavior mirrors text/checkbox/radio exporters.
			var raw_label = ( field && typeof field.label === 'string' ) ? field.label : '';
			var label     = raw_label.trim();

			if ( label && add_labels ) {
				emit( '<l>' + esc_html( label ) + req_mark + '</l>' );
				emit( '<br>' + body );
			} else {
				emit( body );
			}
			// Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
		};

		// Main type used by the Builder.
		Exp.register( 'select', exporter_callback );

		// Legacy alias: some older structures may use "selectbox" as type.
		if ( typeof Exp.has_exporter !== 'function' || ! Exp.has_exporter( 'selectbox' ) ) {
			Exp.register( 'selectbox', exporter_callback );
		}
	}

	// Try immediate registration; if core isn’t ready, wait for the event.
	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_select_booking_form_exporter();
	} else {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_select_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter callback ("Content of booking fields data") for "select".
	 *
	 * Default behavior:
	 *   <b>Label</b>: <f>[field_name]</f><br>
	 *
	 * Registered per field type via:
	 *   WPBC_BFB_ContentExporter.register( 'select', callback )
	 *   (and also as a legacy alias: 'selectbox')
	 */
	function register_select_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'select' ) ) { return; }

		var exporter_callback = function ( field, emit, extras ) {

			extras = extras || {};
			var cfg = extras.cfg || {};

			var Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

			// Keep the exact exported name in sync with the Booking Form exporter.
			var name = Exp.compute_name( 'select', field );
			if ( ! name ) { return; }

			var raw_label = ( typeof field.label === 'string' ) ? field.label : '';
			var label     = raw_label.trim() || name;

			// Shared formatter keeps all packs consistent:
			// <b>Label</b>: <f>[name]</f><br>
			C.emit_line_bold_field( emit, label, name, cfg );
		};

		// Main type
		C.register( 'select', exporter_callback );

		// Legacy alias, if needed.
		if ( typeof C.has_exporter !== 'function' || ! C.has_exporter( 'selectbox' ) ) {
			C.register( 'selectbox', exporter_callback );
		}
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_select_booking_data_exporter();
	} else {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_select_booking_data_exporter, { once: true } );
	}

})( window );
