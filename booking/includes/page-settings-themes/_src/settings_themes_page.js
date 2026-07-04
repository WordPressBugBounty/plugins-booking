/**
 * Appearance / Theme settings page UI.
 */
( function ( $, w ) {
	'use strict';

	var cfg = w.wpbc_settings_themes_page || {};
	var preview_ajax = null;
	var preview_timer = 0;
	var preview_notice_timer = 0;
	var preview_notice_message_timer = 0;

	function trim_text( value ) {
		return String( value || '' ).trim();
	}

	function make_asset_url( path ) {
		path = String( path || '' );
		if ( /^https?:\/\//i.test( path ) || /^\/\//.test( path ) ) {
			return path;
		}
		return String( cfg.plugin_url || '' ).replace( /\/$/, '' ) + path;
	}

	function show_message( message, type, delay ) {
		if ( typeof w.wpbc_admin_show_message === 'function' ) {
			w.wpbc_admin_show_message( message, type || 'info', delay || 4000, false );
		}
	}

	function pulse_element( $element, duration ) {
		if ( ! $element || ! $element.length ) {
			return;
		}

		$element
			.removeClass( 'wpbc_theme_attention_pulse' )
			.each( function () {
				void this.offsetWidth;
			} )
			.addClass( 'wpbc_theme_attention_pulse' );

		setTimeout( function () {
			$element.removeClass( 'wpbc_theme_attention_pulse' );
		}, duration || 2100 );
	}

	function pulse_latest_warning_notice() {
		clearTimeout( preview_notice_message_timer );
		preview_notice_message_timer = setTimeout( function () {
			pulse_element( $( '#ajax_working .wpbc_inner_message.notice-warning' ).last() );
		}, 50 );
	}

	function show_highlighted_notice( message, type, delay, $control ) {
		if ( $control && $control.length ) {
			pulse_element( $control );
		}

		show_message( message, type || 'warning', delay || 9000 );
		pulse_latest_warning_notice();
	}

	function switch_panel( $tab ) {
		var panel_id = $tab.attr( 'aria-controls' );
		var $tabs = $tab.closest( '.wpbc_theme_rightbar_tabs' ).find( '[role="tab"]' );
		var $panels = $( '.wpbc_theme_rightbar_panels [role="tabpanel"]' );

		$tabs.attr( 'aria-selected', 'false' );
		$tab.attr( 'aria-selected', 'true' );

		$panels.attr( 'hidden', 'hidden' ).attr( 'aria-hidden', 'true' );
		$( '#' + panel_id ).removeAttr( 'hidden' ).attr( 'aria-hidden', 'false' );
	}

	function toggle_group( $button ) {
		var $group = $button.closest( '.wpbc_ui__collapsible_group' );
		var $fields = $group.find( '> .group__fields' );
		var is_open = $group.hasClass( 'is-open' );

		$group.toggleClass( 'is-open', ! is_open );
		$button.attr( 'aria-expanded', is_open ? 'false' : 'true' );
		$fields.prop( 'hidden', is_open ).attr( 'aria-hidden', is_open ? 'true' : 'false' );
	}

	function get_form() {
		return $( '[data-wpbc-theme-settings-form="1"]' ).first();
	}

	function collect_payload() {
		var $form = get_form();
		var data = {};

		$.each( $form.serializeArray(), function ( index, item ) {
			data[ item.name ] = item.value;
		} );

		data.booking_timeslot_picker = $form.find( '[name="booking_timeslot_picker"]' ).prop( 'checked' ) ? 'On' : 'Off';
		data.resource_id = $( '#wpbc_theme_resource_id' ).val() || '';
		data.months_count = $( '#wpbc_theme_months_count' ).val() || '';
		data.preview_mode = $( '#wpbc_theme_preview_mode' ).val() || 'calendar';
		data.custom_booking_form = $( '#wpbc_theme_custom_form' ).val() || 'standard';

		return data;
	}

	function apply_form_theme() {
		var theme = get_form().find( '[name="booking_form_theme"]:checked' ).val() || '';
		var $preview = $( '[data-wpbc-theme-preview="1"]' );

		$preview.removeClass( 'wpbc_theme_dark_1' );
		if ( theme ) {
			$preview.addClass( theme );
		}

		$( '.wpbc_theme_choice' ).removeClass( 'is-selected' );
		get_form().find( '[name="booking_form_theme"]:checked' ).closest( '.wpbc_theme_choice' ).addClass( 'is-selected' );
	}

	function apply_calendar_skin() {
		var $select = $( '[data-wpbc-theme-calendar-skin="1"]' );
		var value = $select.find( 'option:selected' ).attr( 'data-wpbc-calendar-skin-url' ) || $select.val() || '';
		var skin_url = value ? make_asset_url( value ) : '';

		if ( skin_url && typeof w.wpbc__calendar__change_skin === 'function' && $( '#wpbc-calendar-skin-css' ).length ) {
			w.wpbc__calendar__change_skin( skin_url );
		}
	}

	function apply_time_skin() {
		var value = $( '[data-wpbc-theme-time-skin="1"]' ).val() || '';
		var skin_url = value ? make_asset_url( value ) : '';

		if ( skin_url && typeof w.wpbc__css__change_skin === 'function' && $( '#wpbc-time_picker-skin-css' ).length ) {
			w.wpbc__css__change_skin( skin_url, 'wpbc-time_picker-skin-css' );
		}
	}

	function select_if_option_exists( $select, value ) {
		var $option;

		if ( ! $select.length || ! value ) {
			return false;
		}

		$option = $select.find( 'option[value="' + value + '"]' );
		if ( ! $option.length ) {
			return false;
		}

		if ( $select.val() === value ) {
			return false;
		}

		$select.val( value ).trigger( 'change' );
		return true;
	}

	function parse_number_list( value ) {
		if ( Array.isArray( value ) ) {
			return $.map( value, function ( item ) {
				var parsed = parseInt( item, 10 );
				return isNaN( parsed ) ? null : parsed;
			} );
		}

		return $.map( String( value || '' ).split( /\s*,\s*/ ), function ( item ) {
			var parsed = parseInt( item, 10 );
			return ( '' === item || isNaN( parsed ) ) ? null : parsed;
		} );
	}

	function set_calendar_param( resource_id, key, value ) {
		if ( w._wpbc && typeof w._wpbc.calendar__set_param_value === 'function' ) {
			w._wpbc.calendar__set_param_value( resource_id, key, value );
		}
	}

	function apply_days_selection_to_calendar( resource_id, days_selection, should_reinit ) {
		var ds = days_selection || {};
		var fixed_week_days;
		var dynamic_specific;
		var dynamic_week_days;

		if ( ! resource_id || ! w._wpbc || typeof w._wpbc.calendar__set_param_value !== 'function' ) {
			return;
		}

		fixed_week_days = parse_number_list( ds.fixed__week_days__start );
		dynamic_specific = parse_number_list( ds.dynamic__days_specific );
		dynamic_week_days = parse_number_list( ds.dynamic__week_days__start );

		set_calendar_param( resource_id, 'days_select_mode', String( ds.days_select_mode || 'multiple' ) );
		set_calendar_param( resource_id, 'fixed__days_num', parseInt( ds.fixed__days_num || 0, 10 ) );
		set_calendar_param( resource_id, 'fixed__week_days__start', fixed_week_days.length ? fixed_week_days : [ -1 ] );
		set_calendar_param( resource_id, 'dynamic__days_min', parseInt( ds.dynamic__days_min || 0, 10 ) );
		set_calendar_param( resource_id, 'dynamic__days_max', parseInt( ds.dynamic__days_max || 0, 10 ) );
		set_calendar_param( resource_id, 'dynamic__days_specific', dynamic_specific );
		set_calendar_param( resource_id, 'dynamic__week_days__start', dynamic_week_days.length ? dynamic_week_days : [ -1 ] );

		if ( typeof w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm === 'function' ) {
			w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm( resource_id );
		}

		if ( should_reinit && typeof w.wpbc_cal__re_init === 'function' ) {
			w.wpbc_cal__re_init( resource_id );
		}
	}

	function ensure_calendar_only_days_selection() {
		var $preview = $( '[data-wpbc-theme-preview="1"]' ).first();
		var preview_mode = $preview.attr( 'data-preview-mode' ) || $( '#wpbc_theme_preview_mode' ).val() || 'calendar';
		var resource_id = parseInt( $preview.attr( 'data-resource-id' ) || 0, 10 );
		var expected = cfg.days_selection || {};
		var expected_mode = String( expected.days_select_mode || 'multiple' );
		var current_mode = null;
		var $calendar;
		var should_reinit = false;

		if ( 'calendar' !== preview_mode || ! resource_id || ! expected_mode ) {
			return;
		}

		if ( ! w._wpbc || typeof w._wpbc.calendar__get_param_value !== 'function' ) {
			return;
		}

		current_mode = w._wpbc.calendar__get_param_value( resource_id, 'days_select_mode' );
		if ( String( current_mode || '' ) === expected_mode ) {
			return;
		}

		$calendar = $( '#calendar_booking' + resource_id );
		should_reinit = $calendar.length && $calendar.hasClass( 'hasDatepick' );

		apply_days_selection_to_calendar( resource_id, expected, should_reinit );
	}

	function apply_related_skins_for_theme( theme ) {
		var calendar_skin = theme ? '/css/skins/24_9__dark_1.css' : '/css/skins/25_5__square_1.css';
		var time_skin = theme ? '/css/time_picker_skins/black.css' : '/css/time_picker_skins/light__24_8.css';

		select_if_option_exists( $( '[data-wpbc-theme-calendar-skin="1"]' ), calendar_skin );
		select_if_option_exists( $( '[data-wpbc-theme-time-skin="1"]' ), time_skin );
	}

	function pulse_preview_mode_control() {
		var $control = $( '.wpbc_theme_control_preview_mode' ).first();

		pulse_element( $control );

		clearTimeout( preview_notice_timer );
		preview_notice_timer = setTimeout( function () {
			$control.removeClass( 'wpbc_theme_attention_pulse' );
		}, 2100 );
	}

	function get_preview_notice_message( notice_type ) {
		var i18n = cfg.i18n || {};

		if ( 'form' === notice_type ) {
			return i18n.form_preview_option_notice || 'This option is visible in the Booking form preview. Switch Preview to Booking form to inspect it.';
		}

		return '';
	}

	function maybe_show_preview_notice( $source ) {
		var notice_type = $source.attr( 'data-wpbc-theme-preview-notice' ) || '';
		var preview_mode = $( '#wpbc_theme_preview_mode' ).val() || 'calendar';
		var message = get_preview_notice_message( notice_type );
		var $control = $( '.wpbc_theme_control_preview_mode' ).first();

		if ( ! message ) {
			return;
		}

		if ( 'form' === notice_type && 'calendar' !== preview_mode ) {
			return;
		}

		if ( 'form' === notice_type ) {
			pulse_preview_mode_control();
			show_highlighted_notice( message, 'warning', 9000 );
			return;
		}

		show_highlighted_notice( message, 'warning', 9000, $control );
	}

	function show_calendar_only_theme_notice() {
		var preview_mode = $( '#wpbc_theme_preview_mode' ).val() || 'calendar';

		if ( 'calendar' !== preview_mode ) {
			return;
		}

		pulse_preview_mode_control();
		show_highlighted_notice(
			cfg.i18n && cfg.i18n.calendar_only_theme_notice ? cfg.i18n.calendar_only_theme_notice : 'Preview is set to Calendar only. Switch Preview to Booking form to inspect the form theme.',
			'warning',
			9000
		);
	}

	function sync_time_picker_preview() {
		var is_enabled = get_form().find( '[name="booking_timeslot_picker"]' ).prop( 'checked' );
		var $preview = $( '[data-wpbc-theme-preview="1"]' );
		var time_selectors = 'select[name^="rangetime"], select[name^="starttime"], select[name^="endtime"], select[name^="durationtime"]';

		if ( w._wpbc && typeof w._wpbc.set_other_param === 'function' ) {
			w._wpbc.set_other_param( 'is_enabled_booking_timeslot_picker', !! is_enabled );
		}

		if ( is_enabled ) {
			if ( w._wpbc && typeof w.wpbc_hook__init_timeselector === 'function' ) {
				w.wpbc_hook__init_timeselector();
			}
			return;
		}

		$preview.find( '.wpbc_times_selector' ).remove();
		$preview.find( time_selectors ).show();
	}

	function refresh_preview_mode_controls() {
		var preview_mode = $( '#wpbc_theme_preview_mode' ).val() || 'calendar';
		$( '[data-wpbc-theme-form-control="1"]' ).toggleClass( 'is-visible', 'form' === preview_mode );
	}

	function set_calendar_loading( is_loading ) {
		var $panel = $( '[data-wpbc-theme-calendar-panel="1"]' );

		$panel.toggleClass( 'is-loading', !! is_loading );
		$panel.find( '.wpbc_theme_calendar_loading' ).remove();

		if ( is_loading ) {
			$panel.append(
				'<div class="wpbc_calendar_loading wpbc_theme_calendar_loading">' +
					'<span class="wpbc_icn_autorenew wpbc_animation_spin"></span>&nbsp;' +
					trim_text( cfg.i18n && cfg.i18n.loading ? cfg.i18n.loading : 'Loading' ) +
				'</div>'
			);
		}
	}

	function refresh_preview() {
		var data = collect_payload();

		if ( preview_ajax && preview_ajax.readyState !== 4 ) {
			preview_ajax.abort();
		}

		data.action = cfg.preview_action;
		data.nonce = cfg.nonce;

		set_calendar_loading( true );
		preview_ajax = $.post( cfg.ajax_url, data )
			.done( function ( response ) {
				if ( response && response.success && response.data && response.data.html ) {
					$( '[data-wpbc-theme-preview="1"]' ).replaceWith( response.data.html );
					if ( response.data.days_selection ) {
						cfg.days_selection = response.data.days_selection;
					}
					apply_form_theme();
					apply_calendar_skin();
					apply_time_skin();
					ensure_calendar_only_days_selection();
					sync_time_picker_preview();
					return;
				}

				show_message(
					response && response.data && response.data.message ? response.data.message : ( cfg.i18n && cfg.i18n.preview_failed ? cfg.i18n.preview_failed : 'Unable to refresh calendar preview.' ),
					'error',
					10000
				);
			} )
			.fail( function ( xhr, text_status ) {
				if ( 'abort' === text_status ) {
					return;
				}
				show_message( cfg.i18n && cfg.i18n.preview_failed ? cfg.i18n.preview_failed : 'Unable to refresh calendar preview.', 'error', 10000 );
			} )
			.always( function () {
				set_calendar_loading( false );
			} );
	}

	function schedule_preview_refresh() {
		clearTimeout( preview_timer );
		preview_timer = setTimeout( refresh_preview, 180 );
	}

	function save_settings() {
		var $button = $( '[data-wpbc-theme-save="1"]' );
		var original_text = $button.data( 'wpbc-original-text' );
		var data = collect_payload();

		if ( ! original_text ) {
			original_text = $button.html();
			$button.data( 'wpbc-original-text', original_text );
		}

		data.action = cfg.action;
		data.nonce = cfg.nonce;

		$button.addClass( 'disabled' ).attr( 'aria-disabled', 'true' );
		$button.find( '.in-button-text' ).html( '&nbsp;&nbsp;' + trim_text( cfg.i18n && cfg.i18n.saving ? cfg.i18n.saving : 'Saving' ) + '...' );

		$.post( cfg.ajax_url, data )
			.done( function ( response ) {
				if ( response && response.success ) {
					show_message( response.data && response.data.message ? response.data.message : ( cfg.i18n && cfg.i18n.saved ? cfg.i18n.saved : 'Saved' ), 'success', 3000 );
					cfg.settings = response.data && response.data.settings ? response.data.settings : cfg.settings;
					return;
				}

				show_message(
					response && response.data && response.data.message ? response.data.message : ( cfg.i18n && cfg.i18n.save_failed ? cfg.i18n.save_failed : 'Unable to save appearance settings.' ),
					'error',
					10000
				);
			} )
			.fail( function () {
				show_message( cfg.i18n && cfg.i18n.save_failed ? cfg.i18n.save_failed : 'Unable to save appearance settings.', 'error', 10000 );
			} )
			.always( function () {
				$button.removeClass( 'disabled' ).removeAttr( 'aria-disabled' ).html( original_text );
			} );
	}

	function bind_events() {
		$( document ).on( 'click', '.wpbc_theme_rightbar_tabs [role="tab"]', function ( event ) {
			event.preventDefault();
			switch_panel( $( this ) );
		} );

		$( document ).on( 'click', '.wpbc_theme_premium_dismiss a', function ( event ) {
			event.stopPropagation();
		} );

		$( document ).on( 'click', '.wpbc_theme_rightbar_panels .wpbc_ui__collapsible_group > .group__header', function ( event ) {
			event.preventDefault();
			toggle_group( $( this ) );
		} );

		$( document ).on( 'click', '[data-wpbc-theme-save="1"]', function ( event ) {
			event.preventDefault();
			if ( ! $( this ).hasClass( 'disabled' ) ) {
				save_settings();
			}
		} );

		$( document ).on( 'submit', '[data-wpbc-theme-settings-form="1"]', function () {
			return true;
		} );

		$( document ).on( 'change', '[name="booking_form_theme"]', function () {
			apply_form_theme();
			apply_related_skins_for_theme( $( this ).val() || '' );
			show_calendar_only_theme_notice();
		} );

		$( document ).on( 'change', '[data-wpbc-theme-calendar-skin="1"]', function () {
			apply_calendar_skin();
		} );

		$( document ).on( 'change', '[data-wpbc-theme-time-skin="1"]', function () {
			apply_time_skin();
		} );

		$( document ).on( 'change', '[name="booking_timeslot_picker"]', function () {
			sync_time_picker_preview();
			schedule_preview_refresh();
		} );

		$( document ).on( 'change', '[data-wpbc-theme-preview-notice]', function () {
			maybe_show_preview_notice( $( this ) );
		} );

		$( document ).on( 'change', '#wpbc_theme_resource_id, #wpbc_theme_months_count, #wpbc_theme_custom_form', function () {
			schedule_preview_refresh();
		} );

		$( document ).on( 'change', '#wpbc_theme_preview_mode', function () {
			refresh_preview_mode_controls();
			schedule_preview_refresh();
		} );
	}

	$( function () {
		if ( ! $( '[data-wpbc-theme-page="1"]' ).length ) {
			return;
		}

		bind_events();
		refresh_preview_mode_controls();
		apply_form_theme();
		ensure_calendar_only_days_selection();
		sync_time_picker_preview();
	} );
}( jQuery, window ) );
