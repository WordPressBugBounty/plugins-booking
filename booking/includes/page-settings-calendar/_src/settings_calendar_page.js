/**
 * Calendar settings page UI.
 */
( function ( $, w ) {
	'use strict';

	var cfg = w.wpbc_settings_calendar_page || {};
	var preview_ajax = null;
	var preview_timer = 0;
	var is_saving = false;
	var notice_timer = 0;
	var calendar_load_patch_timer = 0;
	var last_preview_signature = '';

	function trim_text( value ) {
		return String( value || '' ).trim();
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
			.removeClass( 'wpbc_calendar_attention_pulse' )
			.each( function () {
				void this.offsetWidth;
			} )
			.addClass( 'wpbc_calendar_attention_pulse' );

		setTimeout( function () {
			$element.removeClass( 'wpbc_calendar_attention_pulse' );
		}, duration || 2100 );
	}

	function pulse_latest_warning_notice() {
		clearTimeout( notice_timer );
		notice_timer = setTimeout( function () {
			pulse_element( $( '#ajax_working .wpbc_inner_message.notice-warning' ).last() );
		}, 50 );
	}

	function show_premium_notice( $control ) {
		var is_range_info = $control && $control.is( '[data-wpbc-calendar-premium-range-info="1"]' );
		var is_changeover_info = $control && $control.is( '[data-wpbc-calendar-premium-changeover-info="1"]' );
		var message = cfg.i18n && cfg.i18n.premium_option_notice ? cfg.i18n.premium_option_notice : 'This option is available in Booking Calendar Business Small or higher.';
		var $note;

		if ( is_range_info ) {
			message = cfg.i18n && cfg.i18n.premium_notice ? cfg.i18n.premium_notice : 'Advanced range rules are available in Booking Calendar Business Small or higher. Open the live demo to test the real behavior.';
		} else if ( is_changeover_info ) {
			message = cfg.i18n && cfg.i18n.premium_changeover_notice ? cfg.i18n.premium_changeover_notice : 'Changeover days are available in Booking Calendar Business Small or higher. Open the live demo to test the real behavior.';
		}

		pulse_element( $control.closest( '.wpbc_calendar_field_row, label, .wpbc_calendar_radio_stack' ) );
		if ( is_range_info ) {
			$note = $control.closest( '.wpbc_ui__collapsible_group' ).find( '[data-wpbc-calendar-range-upgrade-note="1"]' ).first();
			$note.addClass( 'is-visible' );
			pulse_element( $note );
		} else if ( is_changeover_info ) {
			$note = $control.closest( '.wpbc_ui__collapsible_group' ).find( '[data-wpbc-calendar-changeover-upgrade-note="1"]' ).first();
			$note.addClass( 'is-visible' );
			pulse_element( $note );
		}
		show_message( message, 'warning', 9000 );
		pulse_latest_warning_notice();
	}

	function is_range_supported() {
		return cfg.is_range_supported === 1 || cfg.is_range_supported === '1' || cfg.is_range_supported === true;
	}

	function is_locked_changeover_control( field ) {
		return ! is_range_supported() && $( field ).is( '[name="booking_range_selection_time_is_active"]' );
	}

	function switch_panel( $tab ) {
		var panel_id = $tab.attr( 'aria-controls' );
		var $tabs = $tab.closest( '.wpbc_calendar_rightbar_tabs' ).find( '[role="tab"]' );
		var $panels = $( '.wpbc_calendar_rightbar_panels [role="tabpanel"]' );

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

	function close_group( $group ) {
		var $button = $group.find( '> .group__header' );
		var $fields = $group.find( '> .group__fields' );

		$group.removeClass( 'is-open' );
		$button.attr( 'aria-expanded', 'false' );
		$fields.prop( 'hidden', true ).attr( 'aria-hidden', 'true' );
	}

	function open_group( group_name, is_exclusive ) {
		var $group = $( '.wpbc_calendar_rightbar_panels .wpbc_ui__collapsible_group[data-group="' + group_name + '"]' );
		var $button = $group.find( '> .group__header' );
		var $fields = $group.find( '> .group__fields' );

		if ( ! $group.length ) {
			return $();
		}

		if ( is_exclusive ) {
			$group.siblings( '.wpbc_ui__collapsible_group' ).each( function () {
				close_group( $( this ) );
			} );
		}

		$group.addClass( 'is-open' );
		$button.attr( 'aria-expanded', 'true' );
		$fields.prop( 'hidden', false ).attr( 'aria-hidden', 'false' );

		return $group;
	}

	function scroll_to_group( group_name ) {
		var $group = $( '.wpbc_calendar_rightbar_panels .wpbc_ui__collapsible_group[data-group="' + group_name + '"]' );
		var $scroll_parent = $();
		var scroll_parent_el;
		var group_el;
		var scroll_top;
		var parent_rect;
		var group_rect;

		if ( ! $group.length ) {
			return;
		}

		$group.parents().each( function () {
			var $candidate = $( this );
			var overflow_y = $candidate.css( 'overflow-y' );

			if (
				$candidate.hasClass( 'simplebar-content-wrapper' )
				|| (
					/(auto|scroll)/.test( overflow_y )
					&& this.scrollHeight > this.clientHeight
				)
			) {
				$scroll_parent = $candidate;
				return false;
			}
		} );

		if ( ! $scroll_parent.length ) {
			$scroll_parent = $group.closest( '.wpbc_ui_el__vert_right_bar__content' ).find( '.simplebar-content-wrapper' ).first();
		}

		if ( ! $scroll_parent.length ) {
			$group.get( 0 ).scrollIntoView( { block: 'nearest' } );
			return;
		}

		scroll_parent_el = $scroll_parent.get( 0 );
		group_el         = $group.get( 0 );
		parent_rect      = scroll_parent_el.getBoundingClientRect();
		group_rect       = group_el.getBoundingClientRect();
		scroll_top       = $scroll_parent.scrollTop() + group_rect.top - parent_rect.top - 10;

		$scroll_parent.stop().animate( { scrollTop: Math.max( 0, scroll_top ) }, 180 );
	}

	function apply_open_section_from_url() {
		var section_groups = cfg.section_groups || {};
		var group_name = section_groups[ cfg.open_section ] || '';
		var $group;

		if ( '' === group_name ) {
			return;
		}

		$group = open_group( group_name, true );
		$.each( [ 120, 650 ], function ( index, delay ) {
			setTimeout( function () {
				scroll_to_group( group_name );
				pulse_element( $group );
			}, delay );
		} );
	}

	function sync_left_navigation_active_section() {
		var section_menus = cfg.section_menus || {};
		var menu_slug = section_menus[ cfg.open_section ] || '';
		var $menu_item;

		if ( '' === menu_slug ) {
			return;
		}

		$menu_item = $( '.wpbc_ui_el__vert_nav_item__' + menu_slug );
		if ( ! $menu_item.length ) {
			return;
		}

		$menu_item
			.closest( '.wpbc_ui_el__level__folder' )
			.find( '.wpbc_ui_el__vert_nav_item_sub' )
			.removeClass( 'active' );
		$menu_item.addClass( 'active' );
	}

	function get_form() {
		return $( '[data-wpbc-calendar-settings-form="1"]' ).first();
	}

	function collect_payload() {
		var $form = get_form();
		var data = {};
		var name;
		var checkboxes = [
			'booking_calendar_allow_several_months_on_mobile',
			'booking_recurrent_time',
			'booking_last_checkout_day_available',
			'booking_range_selection_time_is_active',
			'booking_change_over_days_triangles',
			'booking_change_over__is_excerpt_on_pages',
			'booking_is_show_legend',
			'booking_legend_is_show_numbers',
			'booking_legend_is_vertical',
			'booking_show_timeslots_in_tooltip',
			'booking_is_show_availability_in_tooltips',
			'booking_is_show_availability_in_date_cell',
			'booking_is_show_cost_in_tooltips',
			'booking_is_show_cost_in_date_cell',
			'booking_is_show_booked_data_in_tooltips'
		];

		$.each( $form.serializeArray(), function ( index, item ) {
			name = String( item.name || '' ).replace( /\[\]$/, '' );
			if ( 0 === name.indexOf( 'wpbc_setup' ) ) {
				return;
			}
			if ( data[ name ] ) {
				if ( ! Array.isArray( data[ name ] ) ) {
					data[ name ] = [ data[ name ] ];
				}
				data[ name ].push( item.value );
			} else {
				data[ name ] = item.value;
			}
		} );

		$.each( checkboxes, function ( index, name ) {
			data[ name ] = $form.find( '[name="' + name + '"]' ).prop( 'checked' ) ? 'On' : 'Off';
		} );

		$form.find( 'input[type="checkbox"][name]' ).each( function () {
			var raw_name = String( this.name || '' );
			var is_array_name = /\[\]$/.test( raw_name );

			name = raw_name.replace( /\[\]$/, '' );
			if ( is_array_name ) {
				if ( 'undefined' === typeof data[ name ] ) {
					data[ name ] = [];
				}
				return;
			}
			if ( $.inArray( name, checkboxes ) !== -1 ) {
				return;
			}
			data[ name ] = $( this ).prop( 'checked' ) ? ( $( this ).val() || 'On' ) : 'Off';
		} );

		data.booking_disable_timeslots_in_tooltip = data.booking_show_timeslots_in_tooltip === 'On' ? 'Off' : 'On';

		data.resource_id = $( '#wpbc_calendar_resource_id' ).val() || '';
		data.months_count = $( '#wpbc_calendar_months_count' ).val() || '';

		return data;
	}

	function get_resource_id() {
		var $preview = $( '[data-wpbc-calendar-preview="1"]' ).first();

		return parseInt( $preview.attr( 'data-resource-id' ) || $( '#wpbc_calendar_resource_id' ).val() || 0, 10 );
	}

	function get_months_count() {
		return parseInt( $( '#wpbc_calendar_months_count' ).val() || 3, 10 );
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

	function normalize_fixed_range_days_count( value ) {
		var days_count = parseInt( value, 10 );

		if ( isNaN( days_count ) || days_count < 1 ) {
			return 3;
		}

		return Math.min( 180, days_count );
	}

	function set_calendar_param( resource_id, key, value ) {
		if ( w._wpbc && typeof w._wpbc.calendar__set_param_value === 'function' ) {
			w._wpbc.calendar__set_param_value( resource_id, key, value );
		}
	}

	function patch_calendar_data_loader() {
		if ( typeof w.wpbc_calendar__load_data__ajx !== 'function' ) {
			clearTimeout( calendar_load_patch_timer );
			calendar_load_patch_timer = setTimeout( patch_calendar_data_loader, 120 );
			return;
		}

		if ( w.wpbc_calendar__load_data__ajx.wpbc_settings_calendar_preview_patched ) {
			return;
		}

		var original_loader = w.wpbc_calendar__load_data__ajx;

		w.wpbc_calendar__load_data__ajx = function ( params ) {
			var payload;

			if ( $( '[data-wpbc-calendar-page="1"]' ).length && params && typeof params === 'object' ) {
				payload = collect_payload();
				params.wpbc_settings_calendar_preview = 1;
				params.wpbc_settings_calendar_preview_changeover = payload.booking_range_selection_time_is_active === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_triangles = payload.booking_change_over_days_triangles === 'Off' ? 'Off' : 'On';
				params.wpbc_settings_calendar_preview_recurrent_time = payload.booking_recurrent_time === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_last_checkout = payload.booking_last_checkout_day_available === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_excerpt_on_pages = payload.booking_change_over__is_excerpt_on_pages === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_excerpt_pages = payload.booking_change_over__excerpt_on_pages || '';
				params.wpbc_settings_calendar_preview_excerpt_resources = payload.booking_change_over__excerpt_bk_resources || '';
				params.wpbc_settings_calendar_preview_show_legend = payload.booking_is_show_legend === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_legend_show_numbers = payload.booking_legend_is_show_numbers === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_legend_vertical = payload.booking_legend_is_vertical === 'On' ? 'On' : 'Off';
				$.each( [ 'available', 'pending', 'approved', 'partially', 'unavailable' ], function ( index, legend_item ) {
					params[ 'wpbc_settings_calendar_preview_legend_show_' + legend_item ] = payload[ 'booking_legend_is_show_item_' + legend_item ] === 'On' ? 'On' : 'Off';
					params[ 'wpbc_settings_calendar_preview_legend_text_' + legend_item ] = payload[ 'booking_legend_text_for_item_' + legend_item ] || '';
				} );
				params.wpbc_settings_calendar_preview_disable_timeslots_tooltip = payload.booking_disable_timeslots_in_tooltip === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_timeslot_word = payload.booking_highlight_timeslot_word || '';
				params.wpbc_settings_calendar_preview_show_availability_tooltip = payload.booking_is_show_availability_in_tooltips === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_availability_word = payload.booking_highlight_availability_word || '';
				params.wpbc_settings_calendar_preview_show_availability_cell = payload.booking_is_show_availability_in_date_cell === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_availability_cell_word = payload.booking_highlight_availability_word_in_date_cell || '';
				params.wpbc_settings_calendar_preview_show_cost_tooltip = payload.booking_is_show_cost_in_tooltips === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_cost_word = payload.booking_highlight_cost_word || '';
				params.wpbc_settings_calendar_preview_show_cost_cell = payload.booking_is_show_cost_in_date_cell === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_cost_currency = payload.booking_cost_in_date_cell_currency || '';
				params.wpbc_settings_calendar_preview_show_booked_details = payload.booking_is_show_booked_data_in_tooltips === 'On' ? 'On' : 'Off';
				params.wpbc_settings_calendar_preview_booked_details = payload.booking_booked_data_in_tooltips || '';
			}

			return original_loader.apply( this, arguments );
		};
		w.wpbc_calendar__load_data__ajx.wpbc_settings_calendar_preview_patched = true;
	}

	function sync_changeover_preview_class( payload ) {
		var data = payload || collect_payload();
		var is_enabled = data.booking_range_selection_time_is_active === 'On' && data.booking_change_over_days_triangles !== 'Off';

		$( '[data-wpbc-calendar-preview="1"], [data-wpbc-calendar-preview="1"] .wpbc_calendar_wraper' )
			.toggleClass( 'wpbc_change_over_triangle', is_enabled );
		$( '[data-wpbc-calendar-preview="1"] .wpbc_calendar_legend_table_width_height' ).parent( 'span' )
			.toggleClass( 'wpbc_change_over_triangle', is_enabled );
	}

	function sync_mobile_months_preview( resource_id, payload ) {
		var data = payload || collect_payload();
		var allow_mobile_months = data.booking_calendar_allow_several_months_on_mobile === 'On';
		var months_count = get_months_count() || 3;

		if ( ! resource_id ) {
			return;
		}

		if ( w._wpbc && typeof w._wpbc.set_other_param === 'function' ) {
			w._wpbc.set_other_param( 'is_allow_several_months_on_mobile', allow_mobile_months );
		}

		if ( allow_mobile_months && typeof w.wpbc_calendar__update_months_number === 'function' ) {
			w.wpbc_calendar__update_months_number( resource_id, months_count );
			return;
		}

		if ( typeof w.wpbc_calendar__auto_update_months_number__on_resize === 'function' ) {
			w.wpbc_calendar__auto_update_months_number__on_resize( resource_id );
		} else if ( typeof w.wpbc_calendar__update_months_number === 'function' ) {
			w.wpbc_calendar__update_months_number( resource_id, $( w ).width() <= 782 ? 1 : months_count );
		}
	}

	function apply_standard_days_selection( resource_id, days_selection ) {
		var ds = days_selection || {};
		var mode = String( ds.days_select_mode || 'multiple' );
		var fixed_week_days = parse_number_list( ds.fixed__week_days__start );
		var dynamic_specific = parse_number_list( ds.dynamic__days_specific );
		var dynamic_week_days = parse_number_list( ds.dynamic__week_days__start );

		fixed_week_days = fixed_week_days.length ? fixed_week_days : [ -1 ];
		dynamic_week_days = dynamic_week_days.length ? dynamic_week_days : [ -1 ];

		if ( 'single' === mode && typeof w.wpbc_cal_days_select__single === 'function' ) {
			w.wpbc_cal_days_select__single( resource_id );
			return true;
		}

		if ( 'multiple' === mode && typeof w.wpbc_cal_days_select__multiple === 'function' ) {
			w.wpbc_cal_days_select__multiple( resource_id );
			return true;
		}

		if ( 'fixed' === mode && typeof w.wpbc_cal_days_select__fixed === 'function' ) {
			w.wpbc_cal_days_select__fixed(
				resource_id,
				normalize_fixed_range_days_count( ds.fixed__days_num ),
				fixed_week_days
			);
			return true;
		}

		if ( 'dynamic' === mode && typeof w.wpbc_cal_days_select__range === 'function' ) {
			w.wpbc_cal_days_select__range(
				resource_id,
				parseInt( ds.dynamic__days_min || 1, 10 ),
				parseInt( ds.dynamic__days_max || 1, 10 ),
				dynamic_specific,
				dynamic_week_days
			);
			return true;
		}

		return false;
	}

	function apply_calendar_settings_to_calendar( days_selection, should_reinit ) {
		var resource_id = get_resource_id();
		var ds = days_selection || {};
		var payload = collect_payload();
		var fixed_week_days;
		var dynamic_specific;
		var dynamic_week_days;
		var $calendar;

		if ( ! resource_id || ! w._wpbc || typeof w._wpbc.calendar__set_param_value !== 'function' ) {
			return;
		}

		fixed_week_days = parse_number_list( ds.fixed__week_days__start );
		dynamic_specific = parse_number_list( ds.dynamic__days_specific );
		dynamic_week_days = parse_number_list( ds.dynamic__week_days__start );

		set_calendar_param( resource_id, 'booking_max_monthes_in_calendar', String( payload.booking_max_monthes_in_calendar || '1y' ) );
		set_calendar_param( resource_id, 'booking_start_day_weeek', String( payload.booking_start_day_weeek || '0' ) );
		set_calendar_param( resource_id, 'calendar_number_of_months', String( get_months_count() || 3 ) );
		set_calendar_param( resource_id, 'calendar_scroll_to', false );
		set_calendar_param( resource_id, 'is_enabled_change_over', payload.booking_range_selection_time_is_active === 'On' );
		set_calendar_param( resource_id, 'days_select_mode', String( ds.days_select_mode || 'multiple' ) );
		set_calendar_param( resource_id, 'fixed__days_num', normalize_fixed_range_days_count( ds.fixed__days_num ) );
		set_calendar_param( resource_id, 'fixed__week_days__start', fixed_week_days.length ? fixed_week_days : [ -1 ] );
		set_calendar_param( resource_id, 'dynamic__days_min', parseInt( ds.dynamic__days_min || 1, 10 ) );
		set_calendar_param( resource_id, 'dynamic__days_max', parseInt( ds.dynamic__days_max || 1, 10 ) );
		set_calendar_param( resource_id, 'dynamic__days_specific', dynamic_specific );
		set_calendar_param( resource_id, 'dynamic__week_days__start', dynamic_week_days.length ? dynamic_week_days : [ -1 ] );
		set_calendar_param( resource_id, 'booking_recurrent_time', get_form().find( '[name="booking_recurrent_time"]' ).prop( 'checked' ) ? 'On' : 'Off' );

		if ( w._wpbc && typeof w._wpbc.set_other_param === 'function' ) {
			w._wpbc.set_other_param( 'is_enabled_change_over', payload.booking_range_selection_time_is_active === 'On' );
			w._wpbc.set_other_param( 'is_allow_several_months_on_mobile', payload.booking_calendar_allow_several_months_on_mobile === 'On' );
		}

		sync_changeover_preview_class( payload );
		sync_mobile_months_preview( resource_id, payload );

		if ( typeof w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm === 'function' ) {
			w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm( resource_id );
		}

		$calendar = $( '#calendar_booking' + resource_id );
		if ( should_reinit && $calendar.length && apply_standard_days_selection( resource_id, ds ) ) {
			return;
		}

		if ( should_reinit && $calendar.length && typeof w.wpbc_cal__re_init === 'function' ) {
			w.wpbc_cal__re_init( resource_id );
		}
	}

	function schedule_calendar_settings_apply( days_selection ) {
		$.each( [ 0, 120, 420, 900, 1400 ], function ( index, delay ) {
			setTimeout( function () {
				apply_calendar_settings_to_calendar( days_selection || get_days_selection_from_form(), true );
			}, delay );
		} );
	}

	function get_days_selection_from_form() {
		var data = collect_payload();
		var mode = data.booking_type_of_day_selections === 'range'
			? ( is_range_supported() ? data.booking_range_selection_type : 'dynamic' )
			: data.booking_type_of_day_selections;
		var fixed_days = data.booking_range_start_day_mode === '-1' ? '-1' : ( data.booking_range_start_day_weekdays || '-1' );
		var dynamic_days = data.booking_range_start_day_dynamic_mode === '-1' ? '-1' : ( data.booking_range_start_day_dynamic_weekdays || '-1' );

		if ( Array.isArray( fixed_days ) ) {
			fixed_days = fixed_days.join( ',' );
		}
		if ( Array.isArray( dynamic_days ) ) {
			dynamic_days = dynamic_days.join( ',' );
		}

		return {
			days_select_mode: mode || 'multiple',
			fixed__days_num: normalize_fixed_range_days_count( data.booking_range_selection_days_count ),
			fixed__week_days__start: fixed_days || '-1',
			dynamic__days_min: parseInt( data.booking_range_selection_days_count_dynamic || 1, 10 ),
			dynamic__days_max: parseInt( data.booking_range_selection_days_max_count_dynamic || 1, 10 ),
			dynamic__days_specific: data.booking_range_selection_days_specific_num_dynamic || '',
			dynamic__week_days__start: dynamic_days || '-1'
		};
	}

	function refresh_conditional_controls() {
		var $form = get_form();
		var day_mode = $form.find( '[name="booking_type_of_day_selections"]:checked' ).val() || 'multiple';
		var range_type = $form.find( '[name="booking_range_selection_type"]:checked' ).val() || 'dynamic';
		var fixed_start = $form.find( '[name="booking_range_start_day_mode"]:checked' ).val() || '-1';
		var dynamic_start = $form.find( '[name="booking_range_start_day_dynamic_mode"]:checked' ).val() || '-1';
		var is_changeover = $form.find( '[name="booking_range_selection_time_is_active"]' ).prop( 'checked' );
		var is_legend = $form.find( '[name="booking_is_show_legend"]' ).prop( 'checked' );
		var is_timeslot_tooltip = $form.find( '[name="booking_show_timeslots_in_tooltip"]' ).prop( 'checked' );
		var is_availability_tooltip = $form.find( '[name="booking_is_show_availability_in_tooltips"]' ).prop( 'checked' );
		var is_availability_cell = $form.find( '[name="booking_is_show_availability_in_date_cell"]' ).prop( 'checked' );
		var is_cost_tooltip = $form.find( '[name="booking_is_show_cost_in_tooltips"]' ).prop( 'checked' );
		var is_cost_cell = $form.find( '[name="booking_is_show_cost_in_date_cell"]' ).prop( 'checked' );
		var is_booked_tooltip = $form.find( '[name="booking_is_show_booked_data_in_tooltips"]' ).prop( 'checked' );

		$( '[data-wpbc-calendar-range-settings="1"]' ).toggleClass( 'is-visible', day_mode === 'range' );
		$( '[data-wpbc-calendar-range-upgrade-note="1"]' ).toggleClass( 'is-visible', day_mode === 'range' && ! is_range_supported() );
		$( '[data-wpbc-calendar-range-type]' ).removeClass( 'is-visible' );
		$( '[data-wpbc-calendar-range-type="' + range_type + '"]' ).addClass( 'is-visible' );
		$( '[data-wpbc-calendar-weekday-checks="booking_range_start_day_weekdays"]' ).toggleClass( 'is-visible', fixed_start !== '-1' );
		$( '[data-wpbc-calendar-weekday-checks="booking_range_start_day_dynamic_weekdays"]' ).toggleClass( 'is-visible', dynamic_start !== '-1' );
		$( '[data-wpbc-calendar-changeover-settings="1"]' ).toggleClass( 'is-visible', !! is_changeover );
		$( '[data-wpbc-calendar-legend-settings="1"]' ).toggleClass( 'is-visible', !! is_legend );
		$( '[data-wpbc-calendar-timeslot-tooltip-settings="1"]' ).toggleClass( 'is-visible', !! is_timeslot_tooltip );
		$( '[data-wpbc-calendar-availability-tooltip-settings="1"]' ).toggleClass( 'is-visible', !! is_availability_tooltip );
		$( '[data-wpbc-calendar-availability-cell-settings="1"]' ).toggleClass( 'is-visible', !! is_availability_cell );
		$( '[data-wpbc-calendar-cost-tooltip-settings="1"]' ).toggleClass( 'is-visible', !! is_cost_tooltip );
		$( '[data-wpbc-calendar-cost-cell-settings="1"]' ).toggleClass( 'is-visible', !! is_cost_cell );
		$( '[data-wpbc-calendar-booked-tooltip-settings="1"]' ).toggleClass( 'is-visible', !! is_booked_tooltip );

		if ( is_changeover ) {
			$form.find( '[name="booking_recurrent_time"], [name="booking_last_checkout_day_available"]' ).prop( 'checked', false );
		}
		if ( $form.find( '[name="booking_recurrent_time"]' ).prop( 'checked' ) ) {
			$form.find( '[name="booking_range_selection_time_is_active"]' ).prop( 'checked', false );
			$( '[data-wpbc-calendar-changeover-settings="1"]' ).removeClass( 'is-visible' );
		}
	}

	function set_calendar_loading( is_loading ) {
		var $panel = $( '[data-wpbc-calendar-panel="1"]' );

		$panel.toggleClass( 'is-loading', !! is_loading );
		$panel.find( '.wpbc_calendar_settings_loading' ).remove();

		if ( is_loading ) {
			$panel.append(
				'<div class="wpbc_calendar_loading wpbc_calendar_settings_loading">' +
					'<span class="wpbc_icn_autorenew wpbc_animation_spin"></span>&nbsp;' +
					trim_text( cfg.i18n && cfg.i18n.loading ? cfg.i18n.loading : 'Loading' ) +
				'</div>'
			);
		}
	}

	function refresh_preview() {
		var data = collect_payload();
		var signature;

		if ( is_saving ) {
			return;
		}

		data.action = cfg.preview_action;
		data.nonce = cfg.nonce;
		signature = JSON.stringify( data );
		if ( signature === last_preview_signature ) {
			return;
		}

		if ( preview_ajax && preview_ajax.readyState !== 4 ) {
			preview_ajax.abort();
		}
		last_preview_signature = signature;

		set_calendar_loading( true );
		preview_ajax = $.post( cfg.ajax_url, data )
			.done( function ( response ) {
				if ( response && response.success && response.data && response.data.html ) {
					$( '[data-wpbc-calendar-preview="1"]' ).replaceWith( response.data.html );
					cfg.days_selection = response.data.days_selection || get_days_selection_from_form();
					schedule_calendar_settings_apply( cfg.days_selection );
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
				last_preview_signature = '';
				show_message( cfg.i18n && cfg.i18n.preview_failed ? cfg.i18n.preview_failed : 'Unable to refresh calendar preview.', 'error', 10000 );
			} )
			.always( function () {
				set_calendar_loading( false );
			} );
	}

	function schedule_preview_refresh( delay ) {
		clearTimeout( preview_timer );
		if ( is_saving ) {
			return;
		}
		preview_timer = setTimeout( refresh_preview, typeof delay === 'number' ? delay : 180 );
	}

	function is_text_typing_field( field ) {
		var tag_name = String( field && field.tagName ? field.tagName : '' ).toLowerCase();
		var input_type = String( field && field.type ? field.type : '' ).toLowerCase();

		return (
			'textarea' === tag_name ||
			( 'input' === tag_name && -1 !== $.inArray( input_type, [ 'text', 'number', 'search', 'email', 'url', 'tel' ] ) )
		);
	}

	function is_full_preview_only_field( field_name ) {
		field_name = String( field_name || '' ).replace( /\[\]$/, '' );

		return (
			'booking_is_show_legend' === field_name ||
			0 === field_name.indexOf( 'booking_legend_' ) ||
			'booking_show_timeslots_in_tooltip' === field_name ||
			'booking_disable_timeslots_in_tooltip' === field_name ||
			0 === field_name.indexOf( 'booking_highlight_' ) ||
			'booking_is_show_availability_in_tooltips' === field_name ||
			'booking_is_show_availability_in_date_cell' === field_name ||
			'booking_is_show_cost_in_tooltips' === field_name ||
			'booking_is_show_cost_in_date_cell' === field_name ||
			'booking_cost_in_date_cell_currency' === field_name ||
			'booking_is_show_booked_data_in_tooltips' === field_name ||
			'booking_booked_data_in_tooltips' === field_name
		);
	}

	function apply_calendar_settings_safely( days_selection ) {
		try {
			apply_calendar_settings_to_calendar( days_selection, true );
		} catch ( error ) {
			if ( w.console && typeof w.console.warn === 'function' ) {
				w.console.warn( '[WPBC] Calendar Settings preview apply failed; full preview refresh will continue.', error );
			}
		}
	}

	function save_settings() {
		var $button = $( '[data-wpbc-calendar-save="1"]' );
		var original_text = $button.data( 'wpbc-original-text' );
		var data = collect_payload();

		if ( ! original_text ) {
			original_text = $button.html();
			$button.data( 'wpbc-original-text', original_text );
		}

		data.action = cfg.action;
		data.nonce = cfg.nonce;

		is_saving = true;
		clearTimeout( preview_timer );
		if ( preview_ajax && preview_ajax.readyState !== 4 ) {
			preview_ajax.abort();
		}
		preview_ajax = null;
		last_preview_signature = '';
		set_calendar_loading( false );

		$button.addClass( 'disabled' ).attr( 'aria-disabled', 'true' );
		$button.find( '.in-button-text' ).html( '&nbsp;&nbsp;' + trim_text( cfg.i18n && cfg.i18n.saving ? cfg.i18n.saving : 'Saving' ) + '...' );

		$.post( cfg.ajax_url, data )
			.done( function ( response ) {
				if ( response && response.success ) {
					show_message( response.data && response.data.message ? response.data.message : ( cfg.i18n && cfg.i18n.saved ? cfg.i18n.saved : 'Saved' ), 'success', 3000 );
					cfg.settings = response.data && response.data.settings ? response.data.settings : cfg.settings;
					cfg.days_selection = response.data && response.data.days_selection ? response.data.days_selection : get_days_selection_from_form();
					schedule_calendar_settings_apply( cfg.days_selection );
					$( document ).trigger( 'wpbc:setup-wizard:step-saved', [ 'date_selection' ] );
					return;
				}

				show_message(
					response && response.data && response.data.message ? response.data.message : ( cfg.i18n && cfg.i18n.save_failed ? cfg.i18n.save_failed : 'Unable to save calendar settings.' ),
					'error',
					10000
				);
			} )
			.fail( function ( xhr, text_status ) {
				var message;

				if ( 'abort' === text_status ) {
					return;
				}

				message = xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message
					? xhr.responseJSON.data.message
					: ( cfg.i18n && cfg.i18n.save_failed ? cfg.i18n.save_failed : 'Unable to save calendar settings.' );

				show_message( message, 'error', 10000 );
			} )
			.always( function () {
				is_saving = false;
				$button.removeClass( 'disabled' ).removeAttr( 'aria-disabled' ).html( original_text );
			} );
	}

	function bind_events() {
		$( document ).on( 'click', '.wpbc_calendar_rightbar_tabs [role="tab"]', function ( event ) {
			event.preventDefault();
			switch_panel( $( this ) );
		} );

		$( document ).on( 'click', '.wpbc_calendar_premium_dismiss a', function ( event ) {
			event.stopPropagation();
		} );

		$( document ).on( 'click', '.wpbc_calendar_rightbar_panels .wpbc_ui__collapsible_group > .group__header', function ( event ) {
			event.preventDefault();
			toggle_group( $( this ) );
		} );

		$( document ).on( 'click', '[data-wpbc-calendar-save="1"]', function ( event ) {
			event.preventDefault();
			if ( ! $( this ).hasClass( 'disabled' ) ) {
				save_settings();
			}
		} );

		$( document ).on( 'click', '[data-wpbc-calendar-premium-range-info="1"], [data-wpbc-calendar-premium-changeover-info="1"]', function ( event ) {
			event.preventDefault();
			event.stopImmediatePropagation();
			if ( $( this ).is( '[data-wpbc-calendar-premium-changeover-info="1"]' ) ) {
				$( this ).prop( 'checked', false );
			}
			refresh_conditional_controls();
			show_premium_notice( $( this ) );
		} );

		$( document ).on( 'change input', '[data-wpbc-calendar-settings-form="1"] input, [data-wpbc-calendar-settings-form="1"] select, [data-wpbc-calendar-settings-form="1"] textarea', function ( event ) {
			var field_name = this.name || '';
			var preview_delay = ( 'input' === event.type && is_text_typing_field( this ) ) ? 850 : 180;

			if ( is_locked_changeover_control( this ) ) {
				$( this ).prop( 'checked', false );
				refresh_conditional_controls();
				show_premium_notice( $( this ) );
				return;
			}

			refresh_conditional_controls();
			schedule_preview_refresh( preview_delay );

			if ( is_full_preview_only_field( field_name ) ) {
				return;
			}

			apply_calendar_settings_safely( get_days_selection_from_form() );
		} );

		$( document ).on( 'change', '[data-wpbc-calendar-premium="1"]', function () {
			show_premium_notice( $( this ) );
		} );

		$( document ).on( 'change', '#wpbc_calendar_resource_id, #wpbc_calendar_months_count', function () {
			schedule_preview_refresh();
		} );
	}

	patch_calendar_data_loader();

	$( function () {
		if ( ! $( '[data-wpbc-calendar-page="1"]' ).length ) {
			return;
		}

		bind_events();
		patch_calendar_data_loader();
		refresh_conditional_controls();
		sync_left_navigation_active_section();
		apply_open_section_from_url();
		schedule_calendar_settings_apply( cfg.days_selection || get_days_selection_from_form() );
	} );
}( jQuery, window ) );
