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

		sync_form_style_choice();

		$.each( $form.serializeArray(), function ( index, item ) {
			if ( 0 === String( item.name || '' ).indexOf( 'wpbc_setup' ) ) {
				return;
			}
			data[ item.name ] = item.value;
		} );

		data.booking_timeslot_picker = $form.find( '[name="booking_timeslot_picker"]' ).prop( 'checked' ) ? 'On' : 'Off';
		data.resource_id = $( '#wpbc_theme_resource_id' ).val() || '';
		data.months_count = $( '#wpbc_theme_months_count' ).val() || '';
		data.preview_mode = $( '#wpbc_theme_preview_mode' ).val() || 'calendar';
		data.custom_booking_form = $( '#wpbc_theme_custom_form' ).val() || 'standard';

		return data;
	}

	function map_form_style_choice( value ) {
		var choice = String( value || 'light_bordered' );
		var current_theme = $( '#booking_form_theme' ).val() || '';
		var parts;
		var preset;

		if ( 'custom' === choice ) {
			return {
				theme : current_theme,
				preset: 'custom'
			};
		}

		parts = choice.split( '_' );
		preset = parts[1] || 'bordered';
		if ( [ 'bordered', 'none', 'soft' ].indexOf( preset ) === -1 ) {
			preset = 'bordered';
		}

		return {
			theme : ( 'dark' === parts[0] ) ? 'wpbc_theme_dark_1' : '',
			preset: preset
		};
	}

	function get_form_style_choice_from_values() {
		var theme = $( '#booking_form_theme' ).val() || '';
		var preset = $( '#booking_form_appearance_preset' ).val() || 'bordered';
		var prefix = theme ? 'dark' : 'light';

		if ( 'custom' === preset ) {
			return 'custom';
		}
		if ( [ 'bordered', 'none', 'soft' ].indexOf( preset ) === -1 ) {
			preset = 'bordered';
		}

		return prefix + '_' + preset;
	}

	function sync_form_style_choice() {
		var $checked = get_form().find( '[name="booking_form_style"]:checked' );
		var mapped;

		if ( ! $checked.length ) {
			return;
		}

		mapped = map_form_style_choice( $checked.val() );
		$( '#booking_form_theme' ).val( mapped.theme );
		$( '#booking_form_appearance_preset' ).val( mapped.preset );
	}

	function sync_form_style_choice_selection() {
		var choice = get_form_style_choice_from_values();
		var $choices = get_form().find( '[name="booking_form_style"]' );

		$choices.prop( 'checked', false );
		$choices.filter( '[value="' + choice + '"]' ).prop( 'checked', true );

		$( '.wpbc_theme_choice' ).removeClass( 'is-selected' );
		$choices.filter( ':checked' ).closest( '.wpbc_theme_choice' ).addClass( 'is-selected' );
	}

	function apply_form_theme() {
		var theme = $( '#booking_form_theme' ).val() || '';
		var $preview = $( '[data-wpbc-theme-preview="1"]' );
		var $theme_targets = $preview.add( $preview.find( '.wpbc_container.wpbc_form, .wpbc_container_booking_form' ) );

		$theme_targets.each( function () {
			var $target = $( this );
			var classes = String( this.className || '' ).split( /\s+/ );

			$.each( classes, function ( index, class_name ) {
				if ( /^wpbc_theme_/.test( class_name ) && ! /^wpbc_theme_preview/.test( class_name ) ) {
					$target.removeClass( class_name );
				}
			} );
		} );
		if ( theme ) {
			$theme_targets.addClass( theme );
		}

		sync_form_style_choice_selection();
	}

	function get_form_appearance_presets() {
		return {
			bordered: {
				background : '#ffffff',
				borderColor: '#cccccc',
				borderWidth: '1px',
				radius     : '2px',
				padding    : '10px 30px',
				shadow     : 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px'
			},
			none    : {
				background : 'transparent',
				borderColor: 'transparent',
				borderWidth: '0px',
				radius     : '0px',
				padding    : '0px',
				shadow     : 'none'
			},
			soft    : {
				background : '#f9f9fa',
				borderColor: '#fff',
				borderWidth: '3px',
				radius     : '8px',
				padding    : '20px',
				shadow     : 'rgba(15, 23, 42, 0.06) 0px 4px 16px 0px'
			}
		};
	}

	function is_dark_form_theme() {
		return 'wpbc_theme_dark_1' === String( $( '#booking_form_theme' ).val() || '' );
	}

	function get_form_appearance_preset_for_theme( preset ) {
		var presets = get_form_appearance_presets();

		if ( ! is_dark_form_theme() ) {
			return presets[preset] || presets.bordered;
		}

		if ( 'soft' === preset ) {
			return {
				background : '#1f2937',
				borderColor: '#334155',
				borderWidth: '3px',
				radius     : '8px',
				padding    : '20px',
				shadow     : 'rgba(0, 0, 0, 0.24) 0px 4px 16px 0px'
			};
		}

		return presets[preset] || presets.bordered;
	}

	function sanitize_theme_color( value, fallback ) {
		var v = String( value || '' ).trim();
		return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test( v ) || 'transparent' === v ? v : fallback;
	}

	function sanitize_theme_length( value, fallback ) {
		var v = String( value || '' ).trim();
		return /^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test( v ) ? v : fallback;
	}

	function sanitize_theme_spacing( value, fallback ) {
		var v = String( value || '' ).trim().replace( /\s+/g, ' ' );
		var parts = v ? v.split( ' ' ) : [];
		var i;

		if ( parts.length < 1 || parts.length > 4 ) {
			return fallback;
		}
		for ( i = 0; i < parts.length; i++ ) {
			if ( ! /^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test( parts[i] ) ) {
				return fallback;
			}
		}
		return parts.join( ' ' );
	}

	function get_form_style_presets() {
		return cfg.form_style_presets && 'object' === typeof cfg.form_style_presets ? cfg.form_style_presets : {};
	}

	function get_current_form_style() {
		var $checked = get_form().find( '[name="booking_form_style"]:checked' );
		return $checked.length ? String( $checked.val() || 'light_bordered' ) : 'light_bordered';
	}

	function get_custom_form_style_defaults() {
		return $.extend( {
			booking_form_custom_background_color       : '#ffffff',
			booking_form_custom_border_color           : '#cccccc',
			booking_form_custom_border_width           : '1px',
			booking_form_custom_border_radius          : '2px',
			booking_form_custom_padding_vertical       : '10px',
			booking_form_custom_padding_horizontal     : '30px',
			booking_form_custom_text_color             : '#1d2327',
			booking_form_custom_field_background_color : '#ffffff',
			booking_form_custom_field_text_color       : '#3c434a',
			booking_form_custom_field_border_color     : '#cccccc',
			booking_form_custom_button_background_color: '#066aab',
			booking_form_custom_button_text_color      : '#ffffff',
			booking_form_custom_button_border_color    : '#066aab',
			booking_form_custom_button_hover_background_color: '#055589',
			booking_form_custom_button_hover_text_color: '#ffffff',
			booking_form_custom_button_hover_border_color: '#055589',
			booking_form_custom_secondary_button_background_color: '#fdfdfd',
			booking_form_custom_secondary_button_text_color: '#444444',
			booking_form_custom_secondary_button_border_color: '#eeeeee',
			booking_form_custom_secondary_button_hover_background_color: '#fdfdfd',
			booking_form_custom_secondary_button_hover_text_color: '#444444',
			booking_form_custom_secondary_button_hover_border_color: '#4d91cd'
		}, cfg.custom_form_style_defaults && 'object' === typeof cfg.custom_form_style_defaults ? cfg.custom_form_style_defaults : {} );
	}

	function get_custom_form_style_css_vars() {
		var defaults = get_custom_form_style_defaults();
		var values = $.extend( {}, defaults, cfg.settings && 'object' === typeof cfg.settings ? cfg.settings : {} );

		return {
			'--wpbc-bfb-form-background'          : sanitize_theme_color( values.booking_form_custom_background_color, defaults.booking_form_custom_background_color ),
			'--wpbc-bfb-form-border-color'        : sanitize_theme_color( values.booking_form_custom_border_color, defaults.booking_form_custom_border_color ),
			'--wpbc-bfb-form-border-width'        : sanitize_theme_length( values.booking_form_custom_border_width, defaults.booking_form_custom_border_width ),
			'--wpbc-bfb-form-border-radius'       : sanitize_theme_length( values.booking_form_custom_border_radius, defaults.booking_form_custom_border_radius ),
			'--wpbc-bfb-form-padding'             : sanitize_theme_length( values.booking_form_custom_padding_vertical, defaults.booking_form_custom_padding_vertical ) + ' ' + sanitize_theme_length( values.booking_form_custom_padding_horizontal, defaults.booking_form_custom_padding_horizontal ),
			'--wpbc-bfb-form-box-shadow'          : 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
			'--wpbc_form-label-color'             : sanitize_theme_color( values.booking_form_custom_text_color, defaults.booking_form_custom_text_color ),
			'--wpbc_form-label-sublabel-color'    : sanitize_theme_color( values.booking_form_custom_text_color, defaults.booking_form_custom_text_color ),
			'--wpbc_form-label-error-color'       : '#d63637',
			'--wpbc_form-field-background-color'  : sanitize_theme_color( values.booking_form_custom_field_background_color, defaults.booking_form_custom_field_background_color ),
			'--wpbc_form-field-menu-color'        : sanitize_theme_color( values.booking_form_custom_field_background_color, defaults.booking_form_custom_field_background_color ),
			'--wpbc_form-field-text-color'        : sanitize_theme_color( values.booking_form_custom_field_text_color, defaults.booking_form_custom_field_text_color ),
			'--wpbc_form-field-border-color'      : sanitize_theme_color( values.booking_form_custom_field_border_color, defaults.booking_form_custom_field_border_color ),
			'--wpbc_form-field-border-color-spare': sanitize_theme_color( values.booking_form_custom_field_border_color, defaults.booking_form_custom_field_border_color ),
			'--wpbc_form-field-focus-border-color': '#066aab',
			'--wpbc_form-field-focus-shadow-color': '#066aab',
			'--wpbc_form-field-disabled-color'    : 'rgba(0, 0, 0, 0.2)',
			'--wpbc_form-button-background-color' : sanitize_theme_color( values.booking_form_custom_button_background_color, defaults.booking_form_custom_button_background_color ),
			'--wpbc_form-button-background-color-alt': sanitize_theme_color( values.booking_form_custom_button_background_color, defaults.booking_form_custom_button_background_color ),
			'--wpbc_form-button-border-color'     : sanitize_theme_color( values.booking_form_custom_button_border_color, defaults.booking_form_custom_button_border_color ),
			'--wpbc_form-button-text-color'       : sanitize_theme_color( values.booking_form_custom_button_text_color, defaults.booking_form_custom_button_text_color ),
			'--wpbc_form-button-text-color-alt'   : sanitize_theme_color( values.booking_form_custom_button_text_color, defaults.booking_form_custom_button_text_color ),
			'--wpbc_form-button-hover-background-color': sanitize_theme_color( values.booking_form_custom_button_hover_background_color, defaults.booking_form_custom_button_hover_background_color ),
			'--wpbc_form-button-hover-border-color': sanitize_theme_color( values.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color ),
			'--wpbc_form-button-hover-text-color' : sanitize_theme_color( values.booking_form_custom_button_hover_text_color, defaults.booking_form_custom_button_hover_text_color ),
			'--wpbc_form-choice-checked-border-color': '#066aab',
			'--wpbc_form-choice-checked-color'    : '#066aab',
			'--wpbc_form-choice-focus-color'      : '#066aab',
			'--wpbc_form-button-light-background-color': sanitize_theme_color( values.booking_form_custom_secondary_button_background_color, defaults.booking_form_custom_secondary_button_background_color ),
			'--wpbc_form-button-light-border-color': sanitize_theme_color( values.booking_form_custom_secondary_button_border_color, defaults.booking_form_custom_secondary_button_border_color ),
			'--wpbc_form-button-light-text-color' : sanitize_theme_color( values.booking_form_custom_secondary_button_text_color, defaults.booking_form_custom_secondary_button_text_color ),
			'--wpbc_form-button-light-box-shadow' : '0 2px 10px 2px #ffffff54',
			'--wpbc_form-button-light-hover-background-color': sanitize_theme_color( values.booking_form_custom_secondary_button_hover_background_color, defaults.booking_form_custom_secondary_button_hover_background_color ),
			'--wpbc_form-button-light-hover-border-color': sanitize_theme_color( values.booking_form_custom_secondary_button_hover_border_color, defaults.booking_form_custom_secondary_button_hover_border_color ),
			'--wpbc_form-button-light-hover-text-color': sanitize_theme_color( values.booking_form_custom_secondary_button_hover_text_color, defaults.booking_form_custom_secondary_button_hover_text_color ),
			'--wpbc_form-button-light-hover-box-shadow': '0 2px 10px 2px #ffffff54',
			'--wpbc_form-button-primary-hover-border-color': sanitize_theme_color( values.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color ),
			'--wpbc_form-page-break-color'        : '#066aab'
		};
	}

	function get_form_style_css_var_names() {
		var keys = [];
		var presets;

		if ( Array.isArray( cfg.form_style_css_var_names ) && cfg.form_style_css_var_names.length ) {
			return cfg.form_style_css_var_names;
		}

		presets = get_form_style_presets();
		$.each( presets, function ( preset_key, preset ) {
			if ( preset && preset.css_vars && 'object' === typeof preset.css_vars ) {
				$.each( preset.css_vars, function ( var_name ) {
					if ( -1 === keys.indexOf( var_name ) ) {
						keys.push( var_name );
					}
				} );
			}
		} );

		$.each( get_custom_form_style_css_vars(), function ( var_name ) {
			if ( -1 === keys.indexOf( var_name ) ) {
				keys.push( var_name );
			}
		} );

		return keys;
	}

	function resolve_form_style_css_vars( style ) {
		var presets = get_form_style_presets();
		var preset = presets[ style ] || presets.light_bordered || {};

		if ( 'custom' === style || preset.custom ) {
			return get_custom_form_style_css_vars();
		}

		return preset.css_vars && 'object' === typeof preset.css_vars ? preset.css_vars : {};
	}

	function apply_form_style_to_preview() {
		var style = get_current_form_style();
		var presets = get_form_style_presets();
		var preset = presets[ style ] || presets.light_bordered || {};
		var css_vars = resolve_form_style_css_vars( style );
		var css_var_names = get_form_style_css_var_names();
		var is_custom = ( 'custom' === style || preset.custom );
		var $preview = $( '[data-wpbc-theme-preview="1"]' );
		var $targets = $preview.find( '.wpbc_container.wpbc_form, .wpbc_bfb_form, .wpbc_bfb__form_preview_section_container' );

		$( '[data-wpbc-theme-custom-appearance-notice="1"]' ).toggle( is_custom );

		if ( ! $targets.length ) {
			return;
		}

		$targets
			.removeClass( 'wpbc_bfb_form_appearance_custom' )
			.each( function () {
				var style_obj = this.style;

				$.each( css_var_names, function ( index, var_name ) {
					style_obj.removeProperty( var_name );
				} );

				$.each( css_vars, function ( var_name, value ) {
					if ( '' !== String( value || '' ) ) {
						style_obj.setProperty( var_name, value );
					}
				} );
			} );

		if ( is_custom ) {
			$targets.filter( '.wpbc_container.wpbc_form, .wpbc_bfb_form' ).addClass( 'wpbc_bfb_form_appearance_custom' );
		}
	}

	function resolve_form_appearance() {
		var preset = $( '#booking_form_appearance_preset' ).val() || 'bordered';

		if ( 'custom' === preset ) {
			return get_form_appearance_presets().bordered;
		}

		return get_form_appearance_preset_for_theme( preset );
	}

	function apply_form_appearance() {
		apply_form_style_to_preview();
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
					apply_form_appearance();
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

		$( document ).on( 'change', '[name="booking_form_style"]', function () {
			sync_form_style_choice();
			apply_form_theme();
			apply_form_appearance();
			apply_related_skins_for_theme( $( '#booking_form_theme' ).val() || '' );
			show_calendar_only_theme_notice();
			schedule_preview_refresh();
		} );

		$( document ).on( 'input change', '[data-wpbc-theme-appearance-control]', function () {
			apply_form_appearance();
			schedule_preview_refresh();
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
		apply_form_appearance();
		ensure_calendar_only_days_selection();
		sync_time_picker_preview();
	} );
}( jQuery, window ) );
