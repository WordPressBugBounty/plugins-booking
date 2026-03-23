// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/time-duration-service/_out/field-durationtime-service-preset.js
// == Purpose  On “Generate durations”, relabel rows as "Service A (20 min)", "Service B (30 min)", etc.
// == Depends  Core bus events, Core.Time.parse_hhmm_24h, Duration/StartTime packs already enqueued
// == Version  1.0.0  (08.11.2025)
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
	'use strict';

	var Core = w.WPBC_BFB_Core || {};
	var Time = ( Core && Core.Time ) ? Core.Time : null;

	if ( ! Time ) {
		return;
	}

	/**
	 * Convert zero-based index to Excel-like letters: 0→A, 25→Z, 26→AA.
	 * @param {number} index
	 * @return {string}
	 */
	function to_alpha_seq( index ) {
		var n = parseInt( index, 10 );
		if ( isNaN( n ) || n < 0 ) { n = 0; }
		var s = '';
		n = n + 1;
		while ( n > 0 ) {
			var mod = ( n - 1 ) % 26;
			s = String.fromCharCode( 65 + mod ) + s;
			n = Math.floor( ( n - 1 ) / 26 );
		}
		return s;
	}

	/**
	 * Humanize minutes to "20 min" / "1 hour" / "1h 30m".
	 * @param {number} total_mins
	 * @return {string}
	 */
	function humanize_minutes_for_service( total_mins ) {
		if ( isNaN( total_mins ) || total_mins < 0 ) { return ''; }
		var h = Math.floor( total_mins / 60 );
		var m = total_mins % 60;

		var t_min   = w.wpbc_i18n_min   || 'min';
		var t_hour  = w.wpbc_i18n_hour  || 'hour';
		var t_hours = w.wpbc_i18n_hours || 'hours';

		if ( h === 0 ) {
			return String( m ) + ' ' + t_min;
		}
		if ( m === 0 ) {
			return h + ' ' + ( h === 1 ? t_hour : t_hours );
		}
		return h + 'h ' + m + 'm';
	}

	/**
	 * If the edited field carries the preset CSS class, relabel generated rows to "Service X (..)".
	 * @param {HTMLElement} panel
	 * @return {void}
	 */
	function relabel_rows_for_service( panel ) {
		if ( ! panel ) { return; }

		// Check the field CSS class via the inspector input (present in template's "Appearance" group).
		var css_input = panel.querySelector( 'input[data-inspector-key="cssclass"]' );
		var css_val   = ( css_input && css_input.value ) ? String( css_input.value ) : '';
		if ( css_val.indexOf( 'wpbc_service_duration' ) === -1 ) {
			return; // Not our preset — do nothing.
		}

		var rows = panel.querySelectorAll( '.wpbc_bfb__options_row' );
		if ( ! rows || ! rows.length ) { return; }

		rows.forEach( function ( row, idx ) {
			var val_el  = row.querySelector( '.wpbc_bfb__opt-value' );
			var time_el = row.querySelector( '.wpbc_bfb__opt-time' );
			var raw     = ( val_el && val_el.value ) || ( time_el && time_el.value ) || '';
			var mins    = Time.parse_hhmm_24h( String( raw ) );
			if ( isNaN( mins ) ) { return; }

			var label_el     = row.querySelector( '.wpbc_bfb__opt-label' );
			if ( ! label_el ) { return; }

			var service_name = 'Service ' + to_alpha_seq( idx );
			var pretty       = humanize_minutes_for_service( mins );
			label_el.value   = service_name + ' (' + pretty + ')';
		} );

		// Sync hidden JSON (<textarea data-inspector-key="options">) after relabel.
		try {
			var ST = w.WPBC_BFB_Field_StartTime;
			if ( ST && typeof ST.sync_state_from_rows === 'function' ) {
				ST.sync_state_from_rows( panel );
			}
		} catch ( e ) {}
	}

	/**
	 * Bind once to both DOM CustomEvent and Core bus.
	 * @return {void}
	 */
	function bind_generation_listeners_for_service_once() {
		if ( w.__wpbc_dt_service_bound ) { return; }
		w.__wpbc_dt_service_bound = true;

		// DOM CustomEvent path (dispatched by StartTime/Duration packs).
		d.addEventListener( 'wpbc_bfb_time_options_generated', function ( ev ) {
			try {
				var panel  = ev && ev.target;
				var detail = ev && ev.detail || {};
				var dtype  = ( detail && detail.type ) || ( panel && panel.getAttribute( 'data-type' ) ) || '';
				if ( dtype !== 'durationtime' ) { return; }
				relabel_rows_for_service( panel );
			} catch ( e ) {}
		}, true );

		// Core bus path (if available).
		try {
			var EVNAME = ( Core && Core.WPBC_BFB_Events && Core.WPBC_BFB_Events.TIME_OPTIONS_GENERATED ) || 'wpbc_bfb:time_options_generated';
			if ( Core && Core.bus && typeof Core.bus.on === 'function' ) {
				Core.bus.on( EVNAME, function ( payload ) {
					try {
						if ( ! payload || payload.type !== 'durationtime' ) { return; }
						relabel_rows_for_service( payload.panel );
					} catch ( e ) {}
				} );
			}
		} catch ( e ) {}
	}

	bind_generation_listeners_for_service_once();

})( window, document );
