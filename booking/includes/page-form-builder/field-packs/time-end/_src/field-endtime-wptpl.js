// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/time-end/_out/field-endtime-wptpl.js
// == Pack  End Time (WP-template–driven) — thin wrapper reusing Start Time runtime
// == Depends on Core: WPBC_BFB_Field_Base, Field_Renderer_Registry, Core.Time utils, and StartTime pack runtime
// == Version 1.0.0  (01.11.2025)
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base || null;
	var Time     = (Core && Core.Time) ? Core.Time : null;

	if ( !Registry || typeof Registry.register !== 'function' || !Base || !Time ) {
		if ( w._wpbc && w._wpbc.dev && w._wpbc.dev.error ) {
			w._wpbc.dev.error( 'wpbc_bfb_field_endtime', 'Missing Core registry/base/time-utils' );
		}
		return;
	}

	// Ensure Start Time handlers are bound once (we piggyback their delegated events).
	try {
		if ( w.WPBC_BFB_Field_StartTime && typeof w.WPBC_BFB_Field_StartTime.bind_inspector_events_once === 'function' ) {
			w.WPBC_BFB_Field_StartTime.bind_inspector_events_once();
		}
	} catch(e){}

	const wpbc_bfb_field_endtime = class extends Base {
		static template_id = 'wpbc-bfb-field-endtime';
		static kind        = 'endtime';

		static get_defaults(){
			return {
				kind           : 'field',
				type           : 'endtime',
				label          : 'End time',
				name           : 'endtime',
				html_id        : '',
				required       : true,
				multiple       : false,
				size           : null,
				cssclass       : '',
				help           : '',
				default_value  : '',
				placeholder    : '--- Select time ---',
				value_differs  : true,
				min_width      : '180px',

				// AM/PM labels; 24h values.
				options        : [
					{ label: '08:00 AM', value: '08:00', selected: false },
					{ label: '09:00 AM', value: '09:00', selected: false },
					{ label: '10:00 AM', value: '10:00', selected: false },
					{ label: '11:00 AM', value: '11:00', selected: false },
					{ label: '12:00 PM', value: '12:00', selected: false },
					{ label: '01:00 PM', value: '13:00', selected: false },
					{ label: '02:00 PM', value: '14:00', selected: false },
					{ label: '03:00 PM', value: '15:00', selected: false },
					{ label: '04:00 PM', value: '16:00', selected: false },
					{ label: '05:00 PM', value: '17:00', selected: false },
					{ label: '06:00 PM', value: '18:00', selected: false },
					{ label: '07:00 PM', value: '19:00', selected: false },
					{ label: '08:00 PM', value: '20:00', selected: false },
					{ label: '09:00 PM', value: '21:00', selected: false },
					{ label: '10:00 PM', value: '22:00', selected: false }
				],

				// AM/PM generator by default.
				gen_label_fmt   : 'ampm',
				gen_start_24h   : '08:00',
				gen_end_24h     : '22:00',
				gen_start_ampm_t: '08:00',
				gen_end_ampm_t  : '22:00',
				gen_step_h      : 1,
				gen_step_m      : 0
			};
		}

		/**
		 * After the field is dropped from the palette.
		 *
		 * @param {Object}      data
		 * @param {HTMLElement} el
		 * @param {Object}      ctx
		 */
		static on_field_drop( data, el, ctx ){
			if ( super.on_field_drop ) { super.on_field_drop( data, el, ctx ); }
			try {
				if ( data && typeof data === 'object' ) {
					data.name     = 'endtime';
					data.required = true;
				}
				if ( el && el.dataset ) {
					el.dataset.name              = 'endtime';
					el.dataset.autoname          = '0';
					el.dataset.fresh             = '0';
					el.dataset.name_user_touched = '1';
					el.setAttribute( 'data-required', 'true' );
				}
				var sel = el && el.querySelector( 'select.wpbc_bfb__preview-endtime' );
				if ( sel ) { sel.setAttribute( 'name', 'endtime' ); }

			} catch(e){}
		}
	};

	try { Registry.register( 'endtime', wpbc_bfb_field_endtime ); }
	catch ( e ) { if ( w._wpbc && w._wpbc.dev && w._wpbc.dev.error ) { w._wpbc.dev.error( 'wpbc_bfb_field_endtime.register', e ); } }

	w.WPBC_BFB_Field_EndTime = wpbc_bfb_field_endtime;

	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback for "endtime".
	 *
	 * Mirrors the legacy behavior:
	 *   WPBC_BFB_Exporter.emit_time_select( name, field, req_mark, id_opt, cls_opts, emit_label_then );
	 *
	 * So the final shortcode body and label handling are identical to the old
	 * switch/case path in builder-exporter.js, just moved into this pack.
	 */
	function register_endtime_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'endtime' ) ) { return; }

		var S        = Core.WPBC_BFB_Sanitize || {};
		var esc_html = S.escape_html || function( v ){ return String( v ); }; // kept for parity with Start Time

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 */
		var exporter_callback = function( field, emit, extras ) {
			extras = extras || {};

			var cfg = extras.cfg || {};
			var ctx = extras.ctx;

			// Shared label wrapper: same pattern as Start Time.
			var emit_label_then = function( body ) {
				// Preferred path: centralized helper in builder-exporter.js
				if ( Exp && typeof Exp.emit_label_then === 'function' ) {
					Exp.emit_label_then( field, emit, body, cfg );
					return;
				}
				// No fallback (same as Start Time pack configuration).
			};

			// Required marker (same semantics as other text-like fields).
			var is_req   = Exp.is_required( field );
			var req_mark = is_req ? '*' : '';

			// Name / id / classes from shared helpers so they stay in sync.
			var name     = Exp.compute_name( 'endtime', field );
			var id_opt   = Exp.id_option( field, ctx );
			var cls_opts = Exp.class_options( field );

			// Dedicated time helper to keep exact legacy shortcode shape.
			if ( typeof Exp.emit_time_select === 'function' ) {
				Exp.emit_time_select( name, field, req_mark, id_opt, cls_opts, emit_label_then );
				return;
			}
		};

		Exp.register( 'endtime', exporter_callback );
	}

	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_endtime_booking_form_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_endtime_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter callback for "endtime".
	 *
	 * Default behavior:
	 *   <b>Label</b>: <f>[endtime]</f><br>
	 *
	 * The exported token name is kept fully in sync with the Booking Form exporter
	 * via Exp.compute_name('endtime', field).
	 */
	function register_endtime_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'endtime' ) ) { return; }

		C.register( 'endtime', function( field, emit, extras ) {
			extras = extras || {};
			var cfg = extras.cfg || {};

			var Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

			// Keep exported name identical to the Booking Form exporter.
			var name = Exp.compute_name( 'endtime', field );
			if ( ! name ) { return; }

			var raw_label = ( typeof field.label === 'string' ) ? field.label : '';
			var label     = raw_label.trim() || name;

			// Shared helper: <b>Label</b>: <f>[name]</f><br>
			C.emit_line_bold_field( emit, label, name, cfg );
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_endtime_booking_data_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_endtime_booking_data_exporter, { once: true } );
	}

})( window, document );
