// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/time-durationtime/_out/field-durationtime-wptpl.js
// == Pack  Duration Time (WP-template–driven) — reuses Start Time inspector logic via shared selectors
// == Depends on Core: WPBC_BFB_Field_Base, Field_Renderer_Registry, Core.Time utils, StartTime pack (events)
// == Version 1.0.3  (04.11.2025 13:22)
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base || null;
	var Time     = (Core && Core.Time) ? Core.Time : null;

	if ( !Registry || typeof Registry.register !== 'function' || !Base || !Time ) {
		if ( w._wpbc && w._wpbc.dev && w._wpbc.dev.error ) {
			w._wpbc.dev.error( 'wpbc_bfb_field_durationtime', 'Missing Core registry/base/time-utils' );
		}
		return;
	}

	// ---------------------------------------------------------------------
	// Helpers (label humanizer + row relabel)
	// ---------------------------------------------------------------------
	function humanize_minutes_label( totalMins ){
		if ( isNaN(totalMins) || totalMins < 0 ) { return ''; }
		var h = Math.floor( totalMins / 60 );
		var m = totalMins % 60;

		// i18n fallbacks
		var i18n_minutes = w.wpbc_i18n_minutes || 'minutes';
		var i18n_min     = w.wpbc_i18n_min || 'min';
		var i18n_h       = w.wpbc_i18n_h   || 'h';

		if ( h === 0 ) {
			// "15 minutes"
			return String( m ) + ' ' + i18n_minutes;
		}
		// "1h" or "1h 15m"
		return ( h + i18n_h ) + ( m > 0 ? ( ' ' + m + (w.wpbc_i18n_m || 'm') ) : '' );
	}

	function relabel_rows_in_duration_panel( panel ){
		if ( ! panel ) { return; }
		// Only touch our pack
		var dtype = panel.getAttribute('data-type') || '';
		if ( dtype !== 'durationtime' ) { return; }

		var list = panel.querySelector('.wpbc_bfb__options_list');
		if ( ! list ) { return; }

		list.querySelectorAll('.wpbc_bfb__options_row').forEach(function(row){
			var valEl  = row.querySelector('.wpbc_bfb__opt-value'); // authoritative 24h value holder
			var timeEl = row.querySelector('.wpbc_bfb__opt-time');  // visible editor
			var raw    = (valEl && valEl.value) || (timeEl && timeEl.value) || '';
			var mins   = Time.parse_hhmm_24h( String(raw) );
			if ( isNaN(mins) ) { return; }

			var labelEl = row.querySelector('.wpbc_bfb__opt-label');
			if ( ! labelEl ) { return; }

			// Set default humanized label (user can edit later; we do this only on generation)
			labelEl.value = humanize_minutes_label( mins );
		});

		// Re-sync the hidden JSON state after relabel
		try {
			var ST = w.WPBC_BFB_Field_StartTime;
			if ( ST && typeof ST.sync_state_from_rows === 'function' ) {
				ST.sync_state_from_rows( panel );
			}
		} catch(e){}
	}

	// ---------------------------------------------------------------------
	// Event wiring (react to StartTime generator completion)
	// ---------------------------------------------------------------------
	(function bind_generation_listeners_once(){
		if ( w.__wpbc_dt_bound ) { return; }
		w.__wpbc_dt_bound = true;

		// DOM CustomEvent path
		d.addEventListener('wpbc_bfb_time_options_generated', function(ev){
			try {
				var panel = ev && ev.target;
				var detail= ev && ev.detail || {};
				// Only for Duration Time panels
				var dtype = (detail && detail.type) || (panel && panel.getAttribute('data-type')) || '';
				if ( dtype !== 'durationtime' ) { return; }
				relabel_rows_in_duration_panel( panel );
			} catch(e){}
		}, true);

		// Core bus path (if available)
		try {
			var EVNAME = (Core && Core.WPBC_BFB_Events && Core.WPBC_BFB_Events.TIME_OPTIONS_GENERATED) || 'wpbc_bfb:time_options_generated';
			if ( Core && Core.bus && typeof Core.bus.on === 'function' ) {
				Core.bus.on( EVNAME, function(payload){
					try {
						if ( !payload || payload.type !== 'durationtime' ) { return; }
						relabel_rows_in_duration_panel( payload.panel );
					} catch(e){}
				});
			}
		} catch(e){}
	})();

	/**
	 * WPBC_BFB: Duration Time field renderer (template-driven).
	 * Inspector is structurally identical to Start Time, so we intentionally reuse:
	 *  - root class: .wpbc_bfb__inspector_starttime  (Start Time JS binds here)
	 *  - option rows markup / state syncing (delegated to Start Time JS)
	 */
	const wpbc_bfb_field_durationtime = class extends Base {

		static template_id = 'wpbc-bfb-field-durationtime';
		static kind        = 'durationtime';

		static get_defaults(){
			return {
				kind           : 'field',
				type           : 'durationtime',
				label          : 'Duration time',
				name           : 'durationtime',
				html_id        : '',
				required       : true,
				multiple       : false,
				size           : null,
				cssclass       : '',
				help           : '',
				default_value  : '',
				placeholder    : '--- Select duration time ---',
				value_differs  : true,
				min_width      : '180px',

				// 24h labels by default make sense for durations (values are 24h, labels will be humanized on generation).
				options        : [
					{ label: '00:15', value: '00:15', selected: false },
					{ label: '00:30', value: '00:30', selected: false },
					{ label: '00:45', value: '00:45', selected: false },
					{ label: '01:00', value: '01:00', selected: false },
					{ label: '01:30', value: '01:30', selected: false },
					{ label: '02:00', value: '02:00', selected: false }
				],

				// Generator defaults (min/max duration).
				// NOTE: We keep '24h' internally but hide the UI in the template (no AM/PM vs 24h for durations).
				gen_label_fmt   : '24h',
				gen_start_24h   : '00:15',
				gen_end_24h     : '06:00',
				gen_start_ampm_t: '00:15',
				gen_end_ampm_t  : '06:00',
				gen_step_h      : 0,
				gen_step_m      : 15
			};
		}

		/**
		 * After the field is dropped from the palette.
		 * Locks "name" to 'durationtime' and ensures required=true for consistency.
		 *
		 * @param {Object}      data
		 * @param {HTMLElement} el
		 * @param {Object}      ctx
		 */
		static on_field_drop( data, el, ctx ){
			if ( super.on_field_drop ) { super.on_field_drop( data, el, ctx ); }
			try {
				if ( data && typeof data === 'object' ) {
					data.name     = 'durationtime';
					data.required = true;
					if ( ! data.placeholder ) {
						data.placeholder = '--- ' + ( (w.wpbc_i18n_select_durationtime) || 'Select duration time' ) + ' ---';
					}
					// Keep 24h format internally; the UI radios are hidden in the template.
					data.gen_label_fmt = data.gen_label_fmt || '24h';
				}
				if ( el && el.dataset ) {
					el.dataset.name              = 'durationtime';
					el.dataset.autoname          = '0';
					el.dataset.fresh             = '0';
					el.dataset.name_user_touched = '1';
					el.setAttribute( 'data-required', 'true' );
				}
				var sel = el && el.querySelector( 'select.wpbc_bfb__preview-timepicker' );
				if ( sel ) { sel.setAttribute( 'name', 'durationtime' ); }
			} catch(e){}
		}
	};

	try { Registry.register( 'durationtime', wpbc_bfb_field_durationtime ); }
	catch ( e ) { if ( w._wpbc && w._wpbc.dev && w._wpbc.dev.error ) { w._wpbc.dev.error( 'wpbc_bfb_field_durationtime.register', e ); } }

	// No extra bindings; Start Time pack listeners handle the inspector via shared classes.
	// This file only post-processes generated options via events.
	w.WPBC_BFB_Field_DurationTime = wpbc_bfb_field_durationtime;

	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Form exporter callback for "durationtime".
	 *
	 * Mirrors the legacy behavior:
	 *   WPBC_BFB_Exporter.emit_time_select( name, field, req_mark, id_opt, cls_opts, emit_label_then );
	 *
	 * So the final shortcode body and label handling are identical to the old
	 * switch/case path in builder-exporter.js, just moved into this pack.
	 */
	function register_durationtime_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'durationtime' ) ) { return; }

		var S        = Core.WPBC_BFB_Sanitize || {};
		var esc_html = S.escape_html || function( v ){ return String( v ); }; // kept for parity with Start/End Time

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 */
		var exporter_callback = function( field, emit, extras ) {
			extras = extras || {};

			var cfg = extras.cfg || {};
			var ctx = extras.ctx;

			// Shared label wrapper: same pattern as Start/End Time.
			var emit_label_then = function( body ) {
				// Preferred path: centralized helper in builder-exporter.js
				if ( Exp && typeof Exp.emit_label_then === 'function' ) {
					Exp.emit_label_then( field, emit, body, cfg );
					return;
				}
				// No fallback (aligned with Start/End Time packs).
			};

			// Required marker.
			var is_req   = Exp.is_required( field );
			var req_mark = is_req ? '*' : '';

			// Name / id / classes from shared helpers so they stay in sync.
			var name     = Exp.compute_name( 'durationtime', field );
			var id_opt   = Exp.id_option( field, ctx );
			var cls_opts = Exp.class_options( field );

			// Dedicated time helper to keep exact legacy shortcode shape.
			if ( typeof Exp.emit_time_select === 'function' ) {
				Exp.emit_time_select( name, field, req_mark, id_opt, cls_opts, emit_label_then );
				return;
			}
		};

		Exp.register( 'durationtime', exporter_callback );
	}

	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_durationtime_booking_form_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_durationtime_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Booking Data exporter callback for "durationtime".
	 *
	 * Default behavior:
	 *   <b>Label</b>: <f>[durationtime]</f><br>
	 *
	 * The exported token name is kept fully in sync with the Booking Form exporter
	 * via Exp.compute_name('durationtime', field).
	 */
	function register_durationtime_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'durationtime' ) ) { return; }

		C.register( 'durationtime', function( field, emit, extras ) {
			extras = extras || {};
			var cfg = extras.cfg || {};

			var Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

			// Base name, identical to Booking Form exporter.
			var name = Exp.compute_name( 'durationtime', field );
			if ( ! name ) { return; }

			var raw_label = ( typeof field.label === 'string' ) ? field.label : '';
			var label     = raw_label.trim() || name;

			// Build a combined token: [name] / [name_val]
			// emit_line_bold_field will wrap it as: <f>[{token}]</f>
			var token = name + '_val] / [' + name;

			// Result: <b>Label</b>: <f>[durationtime_val] / [durationtime]</f><br>
			C.emit_line_bold_field( emit, label, token, cfg );
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_durationtime_booking_data_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_durationtime_booking_data_exporter, { once: true } );
	}

})( window, document );
