/**
 * General Availability UI.
 */
( function ( $, w ) {
	'use strict';

	var cfg = w.wpbc_availability_general_page || {};
	var preview_timer = 0;
	var preview_frame = 0;
	var preview_ajax = null;
	var observer = null;
	var preview_unavailable_classes = 'wpbc_ag_preview_unavailable wpbc_ag_preview_weekday_unavailable wpbc_ag_preview_from_today_unavailable wpbc_ag_preview_limit_available_from_today wpbc_ag_preview_buffer_unavailable weekday_unavailable from_today_unavailable limit_available_from_today buffer_unavailable';

	function trim_text( value ) {
		return String( value || '' ).trim();
	}

	function switch_panel( $tab ) {
		var panel_id = $tab.attr( 'aria-controls' );
		var $tabs = $tab.closest( '.wpbc_ag_rightbar_tabs' ).find( '[role="tab"]' );
		var $panels = $( '.wpbc_ag_rightbar_panels [role="tabpanel"]' );

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

	function refresh_buffer_fields() {
		var value = $( 'input[name="booking_unavailable_extra_in_out"]:checked' ).val() || '';

		$( '.wpbc_ag_buffer_fields' ).each( function () {
			var $panel = $( this );
			$panel.toggleClass( 'is-visible', $panel.data( 'buffer-panel' ) === value );
		} );
	}

	function is_buffer_available() {
		return ! ( cfg.is_buffer_available === false || cfg.is_buffer_available === 'false' || cfg.is_buffer_available === 0 || cfg.is_buffer_available === '0' );
	}

	function is_available_limit_available() {
		return ! ( cfg.is_available_limit_available === false || cfg.is_available_limit_available === 'false' || cfg.is_available_limit_available === 0 || cfg.is_available_limit_available === '0' );
	}

	function sync_range_from_select( select ) {
		var $select = $( select );
		var name = $select.attr( 'name' );
		var selected_index = $select.prop( 'selectedIndex' );
		var selected_text = trim_text( $select.find( 'option:selected' ).text() );
		var $range = $( '[data-wpbc-ag-range-for="' + name + '"]' );
		var $value = $( '[data-wpbc-ag-range-value-for="' + name + '"]' );

		if ( ! $range.length ) {
			return;
		}

		$range.val( selected_index < 0 ? 0 : selected_index );
		$value.text( selected_text );
	}

	function sync_select_from_range( range ) {
		var $range = $( range );
		var name = $range.attr( 'data-wpbc-ag-range-for' );
		var $select = $( '[name="' + name + '"]' );
		var index = parseInt( $range.val(), 10 ) || 0;

		if ( ! $select.length ) {
			return;
		}

		$select.prop( 'selectedIndex', index );
		sync_range_from_select( $select );
	}

	function sync_all_ranges() {
		$( '[data-wpbc-ag-range-for]' ).each( function () {
			var name = $( this ).attr( 'data-wpbc-ag-range-for' );
			sync_range_from_select( $( '[name="' + name + '"]' ).first() );
		} );
	}

	function step_select_value( button ) {
		var $button = $( button );
		var name = $button.attr( 'data-wpbc-ag-stepper' );
		var step = parseInt( $button.attr( 'data-step' ), 10 ) || 0;
		var $select = $( '[name="' + name + '"]' ).first();
		var current_index;
		var next_index;

		if ( ! $select.length || $select.prop( 'disabled' ) ) {
			return;
		}

		current_index = $select.prop( 'selectedIndex' );
		next_index = Math.max( 0, Math.min( $select.find( 'option' ).length - 1, current_index + step ) );

		if ( next_index === current_index ) {
			return;
		}

		$select.prop( 'selectedIndex', next_index ).trigger( 'change' );
	}

	function get_form() {
		return $( '[data-wpbc-ag-settings-form="1"]' ).first();
	}

	function collect_settings() {
		var $form = get_form();
		var weekdays = [];

		$form.find( 'input[name="booking_unavailable_days[]"]:checked' ).each( function () {
			weekdays.push( parseInt( this.value, 10 ) );
		} );

		return {
			weekdays: weekdays,
			booking_unavailable_days_num_from_today: $form.find( '[name="booking_unavailable_days_num_from_today"]' ).val() || '0',
			booking_available_days_num_from_today: $form.find( '[name="booking_available_days_num_from_today"]' ).val() || '',
			booking_unavailable_extra_in_out: $form.find( '[name="booking_unavailable_extra_in_out"]:checked' ).val() || '',
			booking_unavailable_extra_minutes_in: $form.find( '[name="booking_unavailable_extra_minutes_in"]' ).val() || '',
			booking_unavailable_extra_minutes_out: $form.find( '[name="booking_unavailable_extra_minutes_out"]' ).val() || '',
			booking_unavailable_extra_days_in: $form.find( '[name="booking_unavailable_extra_days_in"]' ).val() || '',
			booking_unavailable_extra_days_out: $form.find( '[name="booking_unavailable_extra_days_out"]' ).val() || ''
		};
	}

	function set_select_value( name, value ) {
		var $field = get_form().find( '[name="' + name + '"]' ).first();

		if ( ! $field.length ) {
			return;
		}

		$field.val( value );
		if ( String( $field.val() ) !== String( value ) ) {
			$field.prop( 'selectedIndex', 0 );
		}
	}

	function apply_settings_to_form( settings ) {
		var $form = get_form();
		var weekdays = settings && settings.weekdays ? settings.weekdays : [];

		if ( ! $form.length || ! settings ) {
			return;
		}

		$form.find( 'input[name="booking_unavailable_days[]"]' ).prop( 'checked', false );
		$.each( weekdays, function ( index, day_num ) {
			$form.find( 'input[name="booking_unavailable_days[]"][value="' + parseInt( day_num, 10 ) + '"]' ).prop( 'checked', true );
		} );

		set_select_value( 'booking_unavailable_days_num_from_today', settings.booking_unavailable_days_num_from_today || '0' );
		set_select_value( 'booking_available_days_num_from_today', settings.booking_available_days_num_from_today || '' );
		set_select_value( 'booking_unavailable_extra_minutes_in', settings.booking_unavailable_extra_minutes_in || '' );
		set_select_value( 'booking_unavailable_extra_minutes_out', settings.booking_unavailable_extra_minutes_out || '' );
		set_select_value( 'booking_unavailable_extra_days_in', settings.booking_unavailable_extra_days_in || '' );
		set_select_value( 'booking_unavailable_extra_days_out', settings.booking_unavailable_extra_days_out || '' );

		$form.find( 'input[name="booking_unavailable_extra_in_out"]' ).prop( 'checked', false );
		$form.find( 'input[name="booking_unavailable_extra_in_out"][value="' + ( settings.booking_unavailable_extra_in_out || '' ) + '"]' ).prop( 'checked', true );

		refresh_buffer_fields();
		sync_all_ranges();
		schedule_preview_refresh();
	}

	function date_from_sql( sql_date ) {
		var parts = String( sql_date || '' ).split( '-' );
		if ( parts.length !== 3 ) {
			return null;
		}
		return new Date( parseInt( parts[0], 10 ), parseInt( parts[1], 10 ) - 1, parseInt( parts[2], 10 ), 0, 0, 0 );
	}

	function get_today_date() {
		var arr = w._wpbc && typeof w._wpbc.get_other_param === 'function' ? w._wpbc.get_other_param( 'today_arr' ) : null;
		if ( arr && arr.length >= 3 ) {
			return new Date( parseInt( arr[0], 10 ), parseInt( arr[1], 10 ) - 1, parseInt( arr[2], 10 ), 0, 0, 0 );
		}
		var now = new Date();
		return new Date( now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0 );
	}

	function get_real_today_date() {
		var arr = w._wpbc && typeof w._wpbc.get_other_param === 'function' ? w._wpbc.get_other_param( 'time_local_arr' ) : null;
		if ( arr && arr.length >= 3 ) {
			return new Date( parseInt( arr[0], 10 ), parseInt( arr[1], 10 ) - 1, parseInt( arr[2], 10 ), 0, 0, 0 );
		}
		return get_today_date();
	}

	function days_between( date_a, date_b ) {
		return Math.floor( ( date_a.getTime() - date_b.getTime() ) / 86400000 );
	}

	function add_days( date, days ) {
		var shifted_date = new Date( date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0 );
		shifted_date.setDate( shifted_date.getDate() + days );
		return shifted_date;
	}

	function date_to_sql( date ) {
		var month = String( date.getMonth() + 1 );
		var day = String( date.getDate() );

		if ( month.length < 2 ) {
			month = '0' + month;
		}
		if ( day.length < 2 ) {
			day = '0' + day;
		}

		return date.getFullYear() + '-' + month + '-' + day;
	}

	function get_sql_date_from_cell( cell ) {
		var classes = String( cell.className || '' ).split( /\s+/ );
		var i;
		for ( i = 0; i < classes.length; i++ ) {
			if ( classes[i].indexOf( 'sql_date_' ) === 0 ) {
				return classes[i].replace( 'sql_date_', '' );
			}
		}
		return '';
	}

	function unavailable_from_today_applies( cell_date, today_date, value ) {
		var minutes;
		var now;
		var unavailable_until;

		if ( ! value || value === '0' ) {
			return false;
		}

		if ( /m$/.test( value ) ) {
			minutes = parseInt( value, 10 );
			if ( ! minutes ) {
				return false;
			}
			now = new Date();
			unavailable_until = new Date( now.getTime() + ( ( minutes - 1 ) * 60000 ) );
			unavailable_until = new Date( unavailable_until.getFullYear(), unavailable_until.getMonth(), unavailable_until.getDate(), 0, 0, 0 );
			return cell_date.getTime() <= unavailable_until.getTime();
		}

		return days_between( cell_date, today_date ) < parseInt( value, 10 );
	}

	function get_option_text( selector ) {
		var text = $( selector ).find( 'option:selected' ).text();
		return trim_text( text );
	}

	function get_days_value( value ) {
		if ( ! value || ! /d$/.test( value ) ) {
			return 0;
		}
		return parseInt( value, 10 ) || 0;
	}

	function update_wpbc_preview_params( settings ) {
		if ( ! w._wpbc || typeof w._wpbc.set_other_param !== 'function' ) {
			return;
		}

		w._wpbc.set_other_param( 'availability__week_days_unavailable', settings.weekdays.concat( [ 999 ] ) );
		w._wpbc.set_other_param( 'availability__available_from_today', is_available_limit_available() ? ( settings.booking_available_days_num_from_today || '' ) : '' );
		w._wpbc.set_other_param( 'availability__unavailable_from_today', settings.booking_unavailable_days_num_from_today || '0' );
	}

	function update_buffer_preview_note( settings ) {
		var $notes = $( '[data-wpbc-ag-calendar-notes="1"]' ).first();
		var $calendar = $( '[data-wpbc-ag-calendar-panel="1"]' ).first();
		var $note = $notes.find( '.wpbc_ag_buffer_preview_note' );
		var type = settings.booking_unavailable_extra_in_out || '';
		var before_text = '';
		var after_text = '';
		var message = '';

		if ( ! $notes.length || ! $calendar.length ) {
			return;
		}

		if ( ! $note.length ) {
			$note = $( '<div class="wpbc_ag_buffer_preview_note" aria-live="polite"></div>' );
			$notes.append( $note );
		}

		if ( ! is_buffer_available() ) {
			$calendar.removeClass( 'wpbc_ag_preview_buffer_active' );
			$note.attr( 'hidden', 'hidden' );
			return;
		}

		$calendar.toggleClass( 'wpbc_ag_preview_buffer_active', !! type );

		if ( type === 'm' ) {
			before_text = get_option_text( '[name="booking_unavailable_extra_minutes_in"]' ) || '-';
			after_text = get_option_text( '[name="booking_unavailable_extra_minutes_out"]' ) || '-';
		} else if ( type === 'd' ) {
			before_text = get_option_text( '[name="booking_unavailable_extra_days_in"]' ) || '-';
			after_text = get_option_text( '[name="booking_unavailable_extra_days_out"]' ) || '-';
		}

		if ( type ) {
			message = '<strong>' + ( cfg.i18n && cfg.i18n.buffer_preview ? cfg.i18n.buffer_preview : 'Buffer preview' ) + ':</strong> ' +
				( cfg.i18n && cfg.i18n.before_booking ? cfg.i18n.before_booking : 'Before booking' ) + ' ' + before_text +
				' / ' + ( cfg.i18n && cfg.i18n.after_booking ? cfg.i18n.after_booking : 'After booking' ) + ' ' + after_text;
			if ( $note.html() !== message ) {
				$note.html( message );
			}
			if ( $note.attr( 'hidden' ) ) {
				$note.removeAttr( 'hidden' );
			}
		} else {
			message = cfg.i18n && cfg.i18n.no_buffer ? cfg.i18n.no_buffer : 'No booking buffer is selected.';
			if ( $note.text() !== message ) {
				$note.text( message );
			}
			if ( ! $note.attr( 'hidden' ) ) {
				$note.attr( 'hidden', 'hidden' );
			}
		}
	}

	function apply_buffer_days_preview( settings ) {
		var $calendar = $( '[data-wpbc-ag-calendar-panel="1"]' );
		var before_days = get_days_value( settings.booking_unavailable_extra_days_in );
		var after_days = get_days_value( settings.booking_unavailable_extra_days_out );
		var date_cells = {};
		var booked_dates = [];

		if ( ! is_buffer_available() ) {
			return;
		}

		if ( settings.booking_unavailable_extra_in_out !== 'd' || ( ! before_days && ! after_days ) ) {
			return;
		}

		$calendar.find( '.datepick-days-cell' ).each( function () {
			var $cell = $( this );
			var sql_date = get_sql_date_from_cell( this );
			var cell_date;

			if ( ! sql_date ) {
				return;
			}

			date_cells[ sql_date ] = $cell;

			if ( $cell.hasClass( 'date_approved' ) || $cell.hasClass( 'date2approve' ) ) {
				cell_date = date_from_sql( sql_date );
				if ( cell_date ) {
					booked_dates.push( cell_date );
				}
			}
		} );

		$.each( booked_dates, function ( index, booked_date ) {
			var offset;
			var target_sql_date;
			var $target_cell;

			for ( offset = before_days * -1; offset < 0; offset++ ) {
				target_sql_date = date_to_sql( add_days( booked_date, offset ) );
				$target_cell = date_cells[ target_sql_date ];
				if ( $target_cell && ! $target_cell.hasClass( 'date_approved' ) && ! $target_cell.hasClass( 'date2approve' ) ) {
					remember_preview_origin( $target_cell );
					$target_cell.addClass( 'date_user_unavailable wpbc_ag_preview_unavailable wpbc_ag_preview_buffer_unavailable buffer_unavailable' );
					$target_cell.attr( 'data-wpbc-ag-preview-reason', 'wpbc_ag_preview_buffer_unavailable' );
				}
			}

			for ( offset = 1; offset <= after_days; offset++ ) {
				target_sql_date = date_to_sql( add_days( booked_date, offset ) );
				$target_cell = date_cells[ target_sql_date ];
				if ( $target_cell && ! $target_cell.hasClass( 'date_approved' ) && ! $target_cell.hasClass( 'date2approve' ) ) {
					remember_preview_origin( $target_cell );
					$target_cell.addClass( 'date_user_unavailable wpbc_ag_preview_unavailable wpbc_ag_preview_buffer_unavailable buffer_unavailable' );
					$target_cell.attr( 'data-wpbc-ag-preview-reason', 'wpbc_ag_preview_buffer_unavailable' );
				}
			}
		} );
	}

	function remember_preview_origin( $cell ) {
		if ( typeof $cell.attr( 'data-wpbc-ag-original-date-user-unavailable' ) === 'undefined' ) {
			$cell.attr( 'data-wpbc-ag-original-date-user-unavailable', $cell.hasClass( 'date_user_unavailable' ) ? '1' : '0' );
		}
	}

	function clear_preview_cell( $cell ) {
		var had_date_user_unavailable = $cell.attr( 'data-wpbc-ag-original-date-user-unavailable' ) === '1';

		$cell.removeClass( preview_unavailable_classes );
		$cell.removeAttr( 'data-wpbc-ag-preview-reason' );
		$cell.removeAttr( 'data-wpbc-ag-original-date-user-unavailable' );

		if ( ! had_date_user_unavailable ) {
			$cell.removeClass( 'date_user_unavailable' );
		}
	}

	function apply_calendar_preview() {
		var settings = collect_settings();
		var today_date = get_real_today_date();
		var available_limit = is_available_limit_available() ? parseInt( settings.booking_available_days_num_from_today || '0', 10 ) : 0;
		var $calendar = $( '[data-wpbc-ag-calendar-panel="1"]' );

		update_wpbc_preview_params( settings );
		update_buffer_preview_note( settings );

		$calendar.find( '.datepick-days-cell' ).each( function () {
			var cell = this;
			var $cell = $( cell );
			var sql_date = get_sql_date_from_cell( cell );
			var cell_date = date_from_sql( sql_date );
			var make_unavailable = false;
			var reason_class = '';
			var previous_reason = $cell.attr( 'data-wpbc-ag-preview-reason' ) || '';
			var had_general_preview = !! previous_reason || $cell.hasClass( 'wpbc_ag_preview_unavailable' ) || $cell.hasClass( 'weekday_unavailable' ) || $cell.hasClass( 'from_today_unavailable' ) || $cell.hasClass( 'limit_available_from_today' ) || $cell.hasClass( 'buffer_unavailable' );

			if ( ! cell_date ) {
				return;
			}

			if ( settings.weekdays.indexOf( cell_date.getDay() ) > -1 ) {
				make_unavailable = true;
				reason_class = 'wpbc_ag_preview_weekday_unavailable';
			}

			if ( unavailable_from_today_applies( cell_date, today_date, settings.booking_unavailable_days_num_from_today ) ) {
				make_unavailable = true;
				reason_class = 'wpbc_ag_preview_from_today_unavailable';
			}

			if ( available_limit > 0 && days_between( cell_date, today_date ) >= available_limit ) {
				make_unavailable = true;
				reason_class = 'wpbc_ag_preview_limit_available_from_today';
			}

			if ( make_unavailable ) {
				if ( previous_reason !== reason_class ) {
					if ( had_general_preview ) {
						clear_preview_cell( $cell );
					}
					remember_preview_origin( $cell );
					$cell.addClass( 'date_user_unavailable wpbc_ag_preview_unavailable ' + reason_class );
					$cell.attr( 'data-wpbc-ag-preview-reason', reason_class );
				}
			} else if ( had_general_preview ) {
				clear_preview_cell( $cell );
			}
		} );

		apply_buffer_days_preview( settings );
	}

	function queue_preview_refresh() {
		if ( preview_frame ) {
			return;
		}

		if ( w.requestAnimationFrame ) {
			preview_frame = w.requestAnimationFrame( function () {
				preview_frame = 0;
				apply_calendar_preview();
			} );
		} else {
			preview_frame = w.setTimeout( function () {
				preview_frame = 0;
				apply_calendar_preview();
			}, 0 );
		}
	}

	function schedule_preview_refresh( delay ) {
		clearTimeout( preview_timer );
		delay = parseInt( delay, 10 ) || 0;

		if ( delay > 0 ) {
			preview_timer = setTimeout( queue_preview_refresh, delay );
			return;
		}

		queue_preview_refresh();
	}

	function update_hints( hints ) {
		if ( ! hints ) {
			return;
		}

		if ( typeof hints.booking_unavailable_days_num_from_today__hint !== 'undefined' ) {
			$( '[data-wpbc-ag-hint="booking_unavailable_days_num_from_today"]' ).html(
				'<span class="wpbc_ag_hint_unavailable">' + $( '[data-wpbc-ag-hint="booking_unavailable_days_num_from_today"] .wpbc_ag_hint_unavailable' ).first().text() + '</span>' +
				hints.booking_unavailable_days_num_from_today__hint
			);
		}

		if ( typeof hints.booking_available_days_num_from_today__hint !== 'undefined' ) {
			$( '[data-wpbc-ag-hint="booking_available_days_num_from_today"]' ).html(
				'<span class="wpbc_ag_hint_available">' + $( '[data-wpbc-ag-hint="booking_available_days_num_from_today"] .wpbc_ag_hint_available' ).first().text() + '</span>' +
				hints.booking_available_days_num_from_today__hint
			);
		}
	}

	function show_message( message, type, duration ) {
		if ( typeof w.wpbc_admin_show_message === 'function' ) {
			w.wpbc_admin_show_message( message, type || 'info', duration || 2000, false );
		} else {
			w.alert( message );
		}
	}

	function set_busy( $button, busy ) {
		var busy_text;

		if ( ! $button || ! $button.length ) {
			return;
		}

		if ( busy ) {
			if ( ! $button.data( 'wpbc-ag-original-html' ) ) {
				$button.data( 'wpbc-ag-original-html', $button.html() );
			}
			busy_text = $button.data( 'wpbc-u-busy-text' ) || ( cfg.i18n && cfg.i18n.saving ) || 'Saving...';
			$button.addClass( 'wpbc_ag_is_saving' ).attr( 'aria-busy', 'true' ).html( '<i class="menu_icon icon-1x wpbc_icn_rotate_right wpbc_spin"></i><span class="in-button-text">&nbsp;&nbsp;' + busy_text + '</span>' );
		} else {
			$button.removeClass( 'wpbc_ag_is_saving' ).removeAttr( 'aria-busy' );
			if ( $button.data( 'wpbc-ag-original-html' ) ) {
				$button.html( $button.data( 'wpbc-ag-original-html' ) );
			}
		}
	}

	function replace_calendar_panel( html ) {
		var $holder = $( '<div />' ).append( $.parseHTML( html, document, true ) );
		var $new_panel = $holder.find( '[data-wpbc-ag-calendar-panel="1"]' ).first();
		var $old_panel = $( '[data-wpbc-ag-calendar-panel="1"]' ).first();
		var $scripts;

		if ( ! $new_panel.length || ! $old_panel.length ) {
			return;
		}

		$scripts = $new_panel.find( 'script' ).remove();
		$old_panel.replaceWith( $new_panel );

		$scripts.each( function () {
			var code = this.text || this.textContent || this.innerHTML || '';
			var src = this.src || '';

			if ( src ) {
				$.ajax( {
					url: src,
					dataType: 'script',
					cache: true
				} );
			} else if ( code ) {
				$.globalEval( code );
			}
		} );
	}

	function set_calendar_loading( is_loading ) {
		var $calendar = $( '[data-wpbc-ag-calendar-panel="1"]' ).first();
		var loading_text = cfg.i18n && cfg.i18n.loading ? cfg.i18n.loading : 'Loading';
		var $loading;

		if ( ! $calendar.length ) {
			return;
		}

		if ( is_loading ) {
			$loading = $calendar.find( '.wpbc_calendar_loading' ).first();
			if ( ! $loading.length ) {
				$loading = $(
					'<div class="wpbc_calendar_loading wpbc_ag_calendar_loading">' +
						'<span class="wpbc_icn_autorenew wpbc_spin"></span>&nbsp;&nbsp;' +
						'<span></span>' +
					'</div>'
				);
				$loading.find( 'span' ).last().text( loading_text + '...' );
				$calendar.append( $loading );
			}
			$calendar.addClass( 'is-loading' ).attr( 'aria-busy', 'true' );
		} else {
			$calendar.removeClass( 'is-loading' ).removeAttr( 'aria-busy' );
			$calendar.find( '.wpbc_calendar_loading' ).remove();
		}
	}

	function get_preview_payload() {
		return {
			action: cfg.preview_action || 'WPBC_AJX_AVAILABILITY_GENERAL_PREVIEW',
			nonce: cfg.nonce || '',
			resource_id: $( '#wpbc_ag_resource_id' ).val() || '',
			months_count: $( '#wpbc_ag_months_count' ).val() || ''
		};
	}

	function load_calendar_preview() {
		var $calendar = $( '[data-wpbc-ag-calendar-panel="1"]' ).first();
		var current_preview_ajax;

		if ( ! cfg.ajax_url ) {
			show_message( ( cfg.i18n && cfg.i18n.preview_failed ) || 'Unable to refresh calendar preview.', 'error', 10000 );
			return;
		}

		if ( preview_ajax && preview_ajax.readyState !== 4 ) {
			preview_ajax.abort();
		}

		set_calendar_loading( true );

		current_preview_ajax = $.ajax( {
			url: cfg.ajax_url,
			method: 'POST',
			dataType: 'json',
			data: get_preview_payload()
		} );
		preview_ajax = current_preview_ajax;

		current_preview_ajax.done( function ( response ) {
			if ( ! response || ! response.success || ! response.data || ! response.data.html ) {
				show_message( ( response && response.data && response.data.message ) || ( cfg.i18n && cfg.i18n.preview_failed ) || 'Unable to refresh calendar preview.', 'error', 10000 );
				return;
			}

			replace_calendar_panel( response.data.html );
			$( '[data-wpbc-ag-page="1"]' ).attr( 'data-wpbc-ag-resource-id', response.data.resource_id || '' );
			observe_calendar_changes();
			schedule_preview_refresh();
			setTimeout( schedule_preview_refresh, 600 );
		} ).fail( function ( jq_xhr, text_status ) {
			if ( text_status !== 'abort' ) {
				show_message( ( cfg.i18n && cfg.i18n.preview_failed ) || 'Unable to refresh calendar preview.', 'error', 10000 );
			}
		} ).always( function () {
			if ( preview_ajax === current_preview_ajax ) {
				set_calendar_loading( false );
			}
		} );
	}

	function save_settings( button ) {
		var $button = $( button );
		var settings = collect_settings();
		var payload = $.extend( {}, settings, {
			action: cfg.action || 'WPBC_AJX_AVAILABILITY_GENERAL_SAVE',
			nonce: cfg.nonce || '',
			booking_unavailable_days: settings.weekdays
		} );

		if ( ! cfg.ajax_url ) {
			show_message( ( cfg.i18n && cfg.i18n.save_failed ) || 'Unable to save general availability settings.', 'error', 10000 );
			return;
		}

		set_busy( $button, true );

		$.ajax( {
			url: cfg.ajax_url,
			method: 'POST',
			dataType: 'json',
			data: payload
		} ).done( function ( response ) {
			if ( ! response || ! response.success ) {
				show_message( ( response && response.data && response.data.message ) || ( cfg.i18n && cfg.i18n.save_failed ) || 'Unable to save general availability settings.', 'error', 10000 );
				return;
			}

			if ( response.data && response.data.settings && response.data.settings.hints ) {
				update_hints( response.data.settings.hints );
			}

			load_calendar_preview();
			show_message( ( response.data && response.data.message ) || ( cfg.i18n && cfg.i18n.saved ) || 'General availability settings updated.', 'success', 2000 );
		} ).fail( function () {
			show_message( ( cfg.i18n && cfg.i18n.save_failed ) || 'Unable to save general availability settings.', 'error', 10000 );
		} ).always( function () {
			set_busy( $button, false );
		} );
	}

	function reset_settings( button ) {
		var confirm_message = ( cfg.i18n && cfg.i18n.reset_confirm ) || 'Reset general availability settings to default values?';
		var default_settings = cfg.default_settings || {
			weekdays: [],
			booking_unavailable_days_num_from_today: '0',
			booking_available_days_num_from_today: '',
			booking_unavailable_extra_in_out: '',
			booking_unavailable_extra_minutes_in: '',
			booking_unavailable_extra_minutes_out: '',
			booking_unavailable_extra_days_in: '',
			booking_unavailable_extra_days_out: ''
		};

		if ( ! w.confirm( confirm_message ) ) {
			return;
		}

		apply_settings_to_form( default_settings );
		load_calendar_preview();
		show_message( ( cfg.i18n && cfg.i18n.reset_applied ) || 'Default availability settings are ready for preview. Click Save Changes to apply them.', 'success', 4000 );
	}

	function observe_calendar_changes() {
		var target = document.querySelector( '[data-wpbc-ag-calendar-panel="1"]' );

		if ( ! target || ! w.MutationObserver ) {
			return;
		}

		if ( observer ) {
			observer.disconnect();
		}

		observer = new MutationObserver( schedule_preview_refresh );
		observer.observe( target, {
			childList: true,
			subtree: true
		} );
	}

	$( document ).on( 'click', '.wpbc_ag_rightbar_tabs [role="tab"]', function () {
		switch_panel( $( this ) );
	} );

	$( document ).on( 'click', '.wpbc_ag_rightbar_panels .group__header', function () {
		toggle_group( $( this ) );
	} );

	$( document ).on( 'submit', '[data-wpbc-ag-preview-toolbar="1"]', function ( event ) {
		event.preventDefault();
		load_calendar_preview();
	} );

	$( document ).on( 'change', '#wpbc_ag_resource_id, #wpbc_ag_months_count', load_calendar_preview );

	$( document ).on( 'input change', '[data-wpbc-ag-range-for]', function () {
		sync_select_from_range( this );
		schedule_preview_refresh();
	} );

	$( document ).on( 'change', '[data-wpbc-ag-settings-form="1"] select', function () {
		sync_range_from_select( this );
	} );

	$( document ).on( 'click', '[data-wpbc-ag-stepper]', function () {
		step_select_value( this );
	} );

	$( document ).on( 'change', 'input[name="booking_unavailable_extra_in_out"]', function () {
		refresh_buffer_fields();
		schedule_preview_refresh();
	} );

	$( document ).on( 'change', '[data-wpbc-ag-settings-form="1"] input, [data-wpbc-ag-settings-form="1"] select', schedule_preview_refresh );

	$( document ).on( 'submit', '[data-wpbc-ag-settings-form="1"]', function ( event ) {
		event.preventDefault();
		save_settings( $( '[data-wpbc-ag-save="1"]' ).first() );
	} );

	$( document ).on( 'click', '[data-wpbc-ag-save="1"]', function () {
		save_settings( this );
	} );

	$( document ).on( 'click', '[data-wpbc-ag-reset="1"]', function () {
		reset_settings( this );
	} );

	$( document ).ready( function () {
		refresh_buffer_fields();
		sync_all_ranges();
		observe_calendar_changes();
		schedule_preview_refresh();
		setTimeout( schedule_preview_refresh, 600 );
	} );
}( jQuery, window ) );
