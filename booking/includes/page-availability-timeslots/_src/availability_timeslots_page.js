/**
 * Time Slots Availability UI.
 */
( function ( $ ) {
	'use strict';

	var zoomSteps = [ 60, 30, 15, 10, 5 ];
	var currentMode = 'block';
	var selectionRanges = [];
	var activeSelectionId = '';
	var rowTemplates = [];
	var nextSelectionId = 1;
	var nextTooltipScopeId = 1;
	var activeLoadRequest = null;
	var activeLoadRequestId = 0;
	var activeSaveRequest = null;

	function pad_2( value ) {
		return ( value < 10 ? '0' : '' ) + value;
	}

	function minutes_to_time( minutes ) {
		var hours = Math.floor( minutes / 60 );
		var mins = minutes % 60;
		return pad_2( hours ) + ':' + pad_2( mins );
	}

	function clamp( value, min, max ) {
		return Math.max( min, Math.min( max, value ) );
	}

	function snap_minute( minute, step ) {
		return Math.round( minute / step ) * step;
	}

	function get_grid_config( $grid ) {
		return {
			start: parseInt( $grid.attr( 'data-wpbc-ts-start' ), 10 ) || 0,
			end: parseInt( $grid.attr( 'data-wpbc-ts-end' ), 10 ) || 1440,
			step: parseInt( $grid.attr( 'data-wpbc-ts-step' ), 10 ) || 15
		};
	}

	function get_control( $page, name ) {
		var $control = $page.find( '[data-wpbc-ts-control="' + name + '"]' ).first();

		if ( ! $control.length ) {
			$control = $page.find( '#wpbc_ts_' + name ).first();
		}

		return $control;
	}

	function percent_for_minute( minute, config ) {
		return ( ( minute - config.start ) / ( config.end - config.start ) ) * 100;
	}

	function normalize_selection_range( start, end, config ) {
		start = clamp( snap_minute( start, config.step ), config.start, config.end );
		end = clamp( snap_minute( end, config.step ), config.start, config.end );

		if ( start === end ) {
			end = clamp( start + config.step, config.start, config.end );
			if ( start === end ) {
				start = clamp( end - config.step, config.start, config.end );
			}
		}

		return {
			start: Math.min( start, end ),
			end: Math.max( start, end )
		};
	}

	function get_selection_by_id( selectionId ) {
		var found = null;
		$.each( selectionRanges, function ( index, item ) {
			if ( item.id === selectionId ) {
				found = item;
				return false;
			}
			return true;
		} );
		return found;
	}

	function render_axis( $grid ) {
		var config = get_grid_config( $grid );
		var $axis = $grid.find( '.wpbc_ts_time_axis' );
		var html = '';
		var minute;
		var slotCount = Math.max( 1, ( config.end - config.start ) / config.step );
		var visibleHours = Math.max( 1, ( config.end - config.start ) / 60 );
		var axisFontSize = clamp( Math.round( 16 - ( visibleHours * 0.25 ) ), 10, 13 );
		var axisFontWeight = visibleHours <= 10 ? 550 : 400;
		var firstHour = Math.ceil( config.start / 60 ) * 60;

		$grid.css( '--wpbc-ts-slot-count', slotCount );
		$grid.css( '--wpbc-ts-axis-label-size', axisFontSize + 'px' );
		$grid.css( '--wpbc-ts-axis-label-weight', axisFontWeight );

		for ( minute = firstHour; minute <= config.end; minute += 60 ) {
			html += '<span class="wpbc_ts_axis_label" style="left:' + percent_for_minute( minute, config ) + '%;">' + minutes_to_time( minute ) + '</span>';
			html += '<span class="wpbc_ts_axis_tick" style="left:' + percent_for_minute( minute, config ) + '%;"></span>';
			if ( minute + 30 < config.end ) {
				html += '<span class="wpbc_ts_axis_dot" style="left:' + percent_for_minute( minute + 30, config ) + '%;"></span>';
			}
		}

		for ( minute = config.start + config.step; minute < config.end; minute += config.step ) {
			if ( 0 === minute % 60 || 30 === minute % 60 ) {
				continue;
			}
			html += '<span class="wpbc_ts_axis_minor" style="left:' + percent_for_minute( minute, config ) + '%;"></span>';
		}

		$axis.html( html );
		refresh_floating_header( $grid.closest( '.wpbc_ts_page' ) );
	}

	function position_bars( $grid ) {
		var config = get_grid_config( $grid );

		$grid.find( '.wpbc_ts_bar' ).each( function () {
			var $bar = $( this );
			var start = parseInt( $bar.attr( 'data-wpbc-ts-start' ), 10 );
			var end = parseInt( $bar.attr( 'data-wpbc-ts-end' ), 10 );
			var visibleStart = clamp( start, config.start, config.end );
			var visibleEnd = clamp( end, config.start, config.end );
			var left;
			var width;

			if ( visibleEnd <= config.start || visibleStart >= config.end || visibleStart >= visibleEnd ) {
				$bar.hide();
				return;
			}

			left = percent_for_minute( visibleStart, config );
			width = percent_for_minute( visibleEnd, config ) - left;
			$bar.show().css( { left: left + '%', width: width + '%' } );
		} );
	}

	function render_timeline_bars( $page, bars ) {
		var settings = window.wpbc_availability_timeslots_page || {};
		var labels = settings.i18n || {};

		$page.find( '.wpbc_ts_bar[data-wpbc-ts-source="server"]' ).remove();

		$.each( bars || {}, function ( date, resources ) {
			var $row = $page.find( '.wpbc_ts_row[data-wpbc-ts-date="' + date + '"]' );

			if ( ! $row.length || ! resources ) {
				return;
			}

			$.each( resources, function ( resourceId, resourceBars ) {
				$.each( resourceBars || [], function ( index, interval ) {
					var type = 'blocked' === interval.type ? 'blocked' : ( 'unavailable_day' === interval.type ? 'unavailable_day' : ( 'working_time' === interval.type ? 'working_time' : 'booked' ) );
					var icon = 'booked' === type ? 'wpbc_icn_lock' : ( 'unavailable_day' === type ? 'wpbc_icn_event_busy' : ( 'working_time' === type ? 'wpbc-bi-clock-history' : 'wpbc_icn_do_not_disturb_on' ) );
					var tooltip = interval.tooltip || '';
					var $bar = $( '<div class="wpbc_ts_bar" data-wpbc-ts-source="server"></div>' );
					var $iconWrap;

					if ( 'booked' === type && interval.booking_url ) {
						$iconWrap = $( '<a class="wpbc_ts_booking_link tooltip_top" rel="noopener noreferrer"><span></span></a>' );
						$iconWrap
							.attr( 'href', interval.booking_url )
							.attr( 'data-wpbc-ts-booking-id', interval.booking_id || '' )
							.attr( 'aria-label', ( labels.open_booking || 'Open booking in Booking Listing' ) + ( interval.booking_id ? ': ' + interval.booking_id : '' ) )
							.attr( 'data-original-title', tooltip || '' );
					} else if ( ( 'unavailable_day' === type || 'working_time' === type ) && interval.rule_url ) {
						$iconWrap = $( '<a class="wpbc_ts_rule_link tooltip_top"><span></span></a>' );
						$iconWrap
							.attr( 'href', interval.rule_url )
							.attr( 'data-wpbc-ts-rule-source', interval.rule_source || interval.source_type || '' )
							.attr( 'aria-label', ( labels.open_availability_rule || 'Open availability settings' ) + ( interval.status_title ? ': ' + interval.status_title : '' ) )
							.attr( 'data-original-title', tooltip || '' );
					} else {
						$iconWrap = $( '<span class="wpbc_ts_bar_icon tooltip_top"><span></span></span>' )
							.attr( 'data-original-title', tooltip || '' );
					}

					$bar
						.addClass( 'wpbc_ts_bar_' + type )
						.attr( 'data-wpbc-ts-start', parseInt( interval.start_minute, 10 ) )
						.attr( 'data-wpbc-ts-end', parseInt( interval.end_minute, 10 ) )
						.attr( 'data-wpbc-ts-resource-id', resourceId )
						.attr( 'data-wpbc-ts-booking-id', interval.booking_id || '' )
						.attr( 'data-wpbc-ts-booking-url', interval.booking_url || '' )
						.attr( 'data-wpbc-ts-rule-url', interval.rule_url || '' )
						.attr( 'data-wpbc-ts-unavailable-id', interval.unavailable_timeslot_id || '' )
						.attr( 'data-wpbc-ts-source-type', interval.source_type || '' )
						.attr( 'data-wpbc-ts-editable', false === interval.editable ? '0' : '1' );
					if ( tooltip ) {
						$bar.attr( 'data-original-title', tooltip ).addClass( 'tooltip_top' );
					}
					$iconWrap.find( 'span' ).addClass( icon );
					$bar.append( $iconWrap );
					$row.find( '.wpbc_ts_lane' ).append( $bar );
				} );
			} );
		} );

		position_bars( $page.find( '.wpbc_ts_grid' ) );
		refresh_bar_tooltips( $page );
	}

	function load_blocked_intervals( $page ) {
		var settings = window.wpbc_availability_timeslots_page || {};
		var $dateRange = get_control( $page, 'date_range' );
		var labels = settings.i18n || {};
		var requestId;

		if ( ! settings.ajax_url ) {
			return;
		}

		if ( activeLoadRequest && activeLoadRequest.readyState !== 4 ) {
			activeLoadRequest.abort();
		}

		requestId = ++activeLoadRequestId;
		set_timeline_loading( $page, true, labels.loading || 'Loading' );

		activeLoadRequest = $.post( settings.ajax_url, {
			action: 'WPBC_AJX_AVAILABILITY_TIMESLOTS_READ',
			resource_id: get_control( $page, 'resource' ).val(),
			date_start: $dateRange.attr( 'data-wpbc-ts-start' ),
			date_end: $dateRange.attr( 'data-wpbc-ts-end' )
		} ).done( function ( response ) {
			if ( requestId !== activeLoadRequestId ) {
				return;
			}
			if ( response && response.success && response.data ) {
				render_timeline_bars( $page, response.data.bars );
			}
		} ).fail( function ( xhr, textStatus ) {
			if ( 'abort' !== textStatus && window.wpbc_admin_show_message ) {
				wpbc_admin_show_message( labels.save_error || 'Unable to save time-slot availability.', 'error', 5000 );
			}
		} ).always( function () {
			if ( requestId === activeLoadRequestId ) {
				set_timeline_loading( $page, false );
			}
		} );
	}

	function get_rows_between( $page, startRow, endRow ) {
		var startIndex = parseInt( startRow, 10 );
		var endIndex = parseInt( endRow, 10 );
		var min = Math.min( startIndex, endIndex );
		var max = Math.max( startIndex, endIndex );
		var rows = [];
		var i;

		for ( i = min; i <= max; i++ ) {
			if ( $page.find( '.wpbc_ts_row[data-wpbc-ts-row="' + i + '"]' ).length ) {
				rows.push( String( i ) );
			}
		}

		return rows;
	}

	function row_label( $page, rowId ) {
		return $.trim( $page.find( '.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"] .wpbc_ts_row_label_text' ).text() );
	}

	function escape_html( value ) {
		return $( '<div />' ).text( value ).html();
	}

	function position_loading_overlay( $page ) {
		var $card = $page.find( '.wpbc_ts_timeline_card' ).first();
		var card = $card.get( 0 );
		var $overlay = $card.find( '.wpbc_ts_loading_overlay' ).first();

		if ( ! card || ! $overlay.length ) {
			return;
		}

		$overlay.css( {
			width: card.clientWidth + 'px',
			height: card.clientHeight + 'px',
			transform: 'translate(' + card.scrollLeft + 'px,' + card.scrollTop + 'px)'
		} );
	}

	function set_timeline_loading( $page, isLoading, label ) {
		var $card = $page.find( '.wpbc_ts_timeline_card' );
		var $overlay;

		$card
			.toggleClass( 'is-loading', !! isLoading )
			.find( '.wpbc_ts_loading_overlay' )
			.attr( 'aria-hidden', isLoading ? 'false' : 'true' );

		if ( label ) {
			$overlay = $page.find( '.wpbc_ts_loading_overlay' ).first();
			$overlay.find( '.wpbc_spins_loading_container > span' ).text( label + '...' );
		}

		if ( isLoading ) {
			position_loading_overlay( $page );
			$card.off( 'scroll.wpbc_ts_loading_overlay' ).on( 'scroll.wpbc_ts_loading_overlay', function () {
				position_loading_overlay( $page );
			} );
		} else {
			$card.off( 'scroll.wpbc_ts_loading_overlay' );
			$page.find( '.wpbc_ts_loading_overlay' ).css( {
				width: '',
				height: '',
				transform: ''
			} );
		}
	}

	function set_action_buttons_busy( $page, isBusy ) {
		var $scope = $page.add( $page.closest( '.modal' ) ).add( $( '.wpbc_ts_rightbar_panels' ) );

		$scope
			.find( '[data-wpbc-ts-command], .wpbc_ts_clear_selection' )
			.toggleClass( 'disabled', !! isBusy )
			.attr( 'aria-disabled', isBusy ? 'true' : 'false' );
	}

	function is_full_page_component( $page ) {
		return (
			! $page.hasClass( 'wpbc_ts_popup' )
			&& $page.closest( '.wpbc_admin_page__tab__time_slots_availability' ).length > 0
		);
	}

	function get_floating_header_namespace( $page ) {
		return '.wpbc_ts_floating_' + String( $page.attr( 'data-wpbc-ts-id-prefix' ) || 'page' ).replace( /[^\w]/g, '_' );
	}

	function get_top_nav_bottom() {
		var $topNav = $( '.wpbc_ui_el__top_nav:visible' ).first();
		var rect;

		if ( ! $topNav.length ) {
			return 0;
		}

		rect = $topNav.get( 0 ).getBoundingClientRect();
		return Math.max( 0, Math.round( rect.bottom ) );
	}

	function ensure_floating_header( $page ) {
		var $floating = $page.children( '.wpbc_ts_floating_header' );
		var $header;

		if ( $floating.length ) {
			return $floating;
		}

		$header = $page.find( '.wpbc_ts_grid > .wpbc_ts_header' ).first();
		$floating = $( '<div class="wpbc_ts_floating_header" aria-hidden="true"></div>' ).appendTo( $page );

		if ( $header.length ) {
			$floating.append( $header.clone( false, false ) );
		}

		return $floating;
	}

	function sync_floating_header( $page ) {
		var $floating;
		var $card;
		var $grid;
		var $header;
		var card;
		var cardRect;
		var headerRect;
		var topOffset;
		var shouldShow;

		if ( ! is_full_page_component( $page ) ) {
			return;
		}

		$floating = ensure_floating_header( $page );
		$card = $page.find( '.wpbc_ts_timeline_card' ).first();
		$grid = $page.find( '.wpbc_ts_grid' ).first();
		$header = $grid.find( '> .wpbc_ts_header' ).first();
		card = $card.get( 0 );

		if ( ! card || ! $grid.length || ! $header.length ) {
			$floating.removeClass( 'is-visible' );
			return;
		}

		cardRect = card.getBoundingClientRect();
		headerRect = $header.get( 0 ).getBoundingClientRect();
		topOffset = get_top_nav_bottom();
		shouldShow = ( headerRect.top < topOffset ) && ( cardRect.bottom > ( topOffset + headerRect.height ) );

		if ( ! shouldShow ) {
			$floating.removeClass( 'is-visible' );
			return;
		}

		$floating
			.css( {
				top: topOffset + 'px',
				left: Math.round( cardRect.left ) + 'px',
				width: Math.round( card.clientWidth ) + 'px',
				'--wpbc-ts-floating-scroll-left': ( -1 * card.scrollLeft ) + 'px',
				'--wpbc-ts-floating-scroll-left-abs': card.scrollLeft + 'px'
			} )
			.addClass( 'is-visible' );

		$floating.children( '.wpbc_ts_header' ).css( 'width', Math.round( $grid.outerWidth() ) + 'px' );
	}

	function refresh_floating_header( $page ) {
		var $floating;
		var $header;

		if ( ! $page || ! $page.length || ! is_full_page_component( $page ) ) {
			return;
		}

		$floating = $page.children( '.wpbc_ts_floating_header' );

		if ( ! $floating.length ) {
			return;
		}

		$header = $page.find( '.wpbc_ts_grid > .wpbc_ts_header' ).first();
		$floating.empty();

		if ( $header.length ) {
			$floating.append( $header.clone( false, false ) );
		}

		sync_floating_header( $page );
	}

	function bind_floating_header( $page ) {
		var namespace;

		if ( ! is_full_page_component( $page ) ) {
			return;
		}

		namespace = get_floating_header_namespace( $page );
		ensure_floating_header( $page );

		$( window )
			.off( 'scroll' + namespace + ' resize' + namespace )
			.on( 'scroll' + namespace + ' resize' + namespace, function () {
				sync_floating_header( $page );
			} );

		$page.find( '.wpbc_ts_timeline_card' )
			.off( 'scroll' + namespace )
			.on( 'scroll' + namespace, function () {
				sync_floating_header( $page );
			} );

		$( document )
			.off( 'click' + namespace )
			.on( 'click' + namespace, '.wpbc_ui__top_nav__btn_show_left_vertical_nav, .wpbc_ui__top_nav__btn_show_right_vertical_nav, .wpbc_ui__top_nav__btn_full_screen, .wpbc_ui__top_nav__btn_normal_screen', function () {
				window.setTimeout( function () {
					sync_floating_header( $page );
				}, 80 );
			} );

		sync_floating_header( $page );
	}

	function refresh_bar_tooltips( $page ) {
		var $tooltipScope = $page.find( '.wpbc_ts_timeline_card' ).first();
		var tooltipScopeId;
		var didInitializeTooltips = false;

		$page.find( '.wpbc_ts_bar.tooltip_top, .wpbc_ts_bar_icon.tooltip_top, .wpbc_ts_booking_link.tooltip_top, .wpbc_ts_rule_link.tooltip_top' ).each( function () {
			if ( this._tippy ) {
				this._tippy.destroy();
			}
		} );

		if ( 'function' === typeof window.wpbc_define_tippy_tooltips ) {
			if ( $tooltipScope.length ) {
				tooltipScopeId = $tooltipScope.attr( 'id' );

				if ( ! tooltipScopeId ) {
					tooltipScopeId = 'wpbc_ts_timeline_tooltip_scope_' + nextTooltipScopeId;
					nextTooltipScopeId++;
					$tooltipScope.attr( 'id', tooltipScopeId );
				}

				didInitializeTooltips = window.wpbc_define_tippy_tooltips( '#' + tooltipScopeId + ' ' );
			}

			if ( didInitializeTooltips ) {
				return;
			}
		}

		$page.find( '[data-original-title]' ).each( function () {
			if ( ! $( this ).attr( 'title' ) ) {
				$( this ).attr( 'title', $( this ).attr( 'data-original-title' ) );
			}
		} );
	}

	function is_booking_listing_search_available() {
		return (
			'function' === typeof window.wpbc_ajx_booking_send_search_request_with_params
			&& 'undefined' !== typeof window.wpbc_ajx_booking_listing
			&& $( '#wpbc_search_field' ).length
		);
	}

	function close_time_slots_popup( $page ) {
		var $modal = $page.closest( '.wpbc_modal__availability_timeslots__section, .modal' );

		if ( ! $modal.length ) {
			return;
		}

		if ( 'function' === typeof $modal.wpbc_my_modal ) {
			$modal.wpbc_my_modal( 'hide' );
			return;
		}

		if ( 'function' === typeof $modal.modal ) {
			$modal.modal( 'hide' );
			return;
		}

		$modal.find( '[data-dismiss="modal"]' ).first().trigger( 'click' );
	}

	function search_booking_in_current_listing( $page, bookingId ) {
		var keyword = 'id:' + parseInt( bookingId, 10 );

		$( '#wpbc_search_field' ).val( keyword );
		close_time_slots_popup( $page );
		window.wpbc_ajx_booking_send_search_request_with_params( {
			'keyword': keyword,
			'page_num': 1
		} );
	}

	function handle_booked_bar_click( $page, event ) {
		var $bar = $( event.currentTarget );
		var $link = $( event.target ).closest( '.wpbc_ts_booking_link' );
		var bookingId = $bar.attr( 'data-wpbc-ts-booking-id' ) || $link.attr( 'data-wpbc-ts-booking-id' );
		var bookingUrl = $bar.attr( 'data-wpbc-ts-booking-url' ) || $link.attr( 'href' );

		if ( ! bookingId ) {
			return;
		}

		if ( is_booking_listing_search_available() ) {
			event.preventDefault();
			event.stopPropagation();
			search_booking_in_current_listing( $page, bookingId );
			return;
		}

		if ( ! $link.length && bookingUrl ) {
			event.preventDefault();
			window.location.href = bookingUrl;
		}
	}

	function unique_dates_from_selections( $page ) {
		var dates = {};
		$.each( selectionRanges, function ( index, item ) {
			$.each( item.rows, function ( rowIndex, rowId ) {
				var label = row_label( $page, rowId );
				if ( label ) {
					dates[ label ] = true;
				}
			} );
		} );
		return Object.keys( dates );
	}

	function get_selection_payload( $page ) {
		var payload = [];

		$.each( selectionRanges, function ( index, item ) {
			$.each( item.rows, function ( rowIndex, rowId ) {
				var $row = $page.find( '.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"]' );
				var date = $row.attr( 'data-wpbc-ts-date' );

				if ( ! date ) {
					return;
				}

				payload.push( {
					date: date,
					start_second: item.start * 60,
					end_second: item.end * 60
				} );
			} );
		} );

		payload.sort( function ( a, b ) {
			if ( a.date !== b.date ) {
				return a.date < b.date ? -1 : 1;
			}
			if ( a.start_second !== b.start_second ) {
				return a.start_second - b.start_second;
			}
			return a.end_second - b.end_second;
		} );

		return payload;
	}

	function get_active_booking_selection_context( $page ) {
		var item = activeSelectionId ? get_selection_by_id( activeSelectionId ) : null;
		var $row;
		var date;

		if ( ! item && 1 === selectionRanges.length ) {
			item = selectionRanges[0];
		}

		if ( ! item || ! item.rows || 1 !== item.rows.length ) {
			return null;
		}

		$row = $page.find( '.wpbc_ts_row[data-wpbc-ts-row="' + item.rows[0] + '"]' );
		date = $row.attr( 'data-wpbc-ts-date' );

		if ( ! date ) {
			return null;
		}

		return {
			resource_id: get_control( $page, 'resource' ).val() || '',
			selected_date: date,
			selected_time: minutes_to_time( item.start ) + ' - ' + minutes_to_time( item.end ),
			start_second: item.start * 60,
			end_second: item.end * 60
		};
	}

	function create_booking_from_active_selection( $page ) {
		var settings = window.wpbc_availability_timeslots_page || {};
		var labels = settings.i18n || {};
		var context = get_active_booking_selection_context( $page );
		var bookingForm;

		if ( ! context ) {
			if ( window.wpbc_admin_show_message ) {
				wpbc_admin_show_message( labels.select_one_slot_for_booking || 'Select one time range on one date first.', 'warning', 3500 );
			}
			return false;
		}

		if ( 'function' !== typeof window.wpbc_boo_listing__click__add_booking_modal ) {
			if ( window.wpbc_admin_show_message ) {
				wpbc_admin_show_message( labels.add_booking_modal_missing || 'Add Booking popup is not available on this page.', 'warning', 5000 );
			}
			return false;
		}

		bookingForm = $( '#wpbc_modal__add_booking__booking_form' ).val() || '';

		close_time_slots_popup( $page );
		window.setTimeout( function () {
			window.wpbc_boo_listing__click__add_booking_modal( {
				mode: 'add',
				resource_id: context.resource_id,
				booking_form: bookingForm,
				selected_date: context.selected_date,
				selected_time: context.selected_time,
				time_override_enabled: 1,
				time_override_source: 'times_availability',
				time_override_start: minutes_to_time( context.start_second / 60 ),
				time_override_end: minutes_to_time( context.end_second / 60 )
			} );
		}, 150 );

		return true;
	}

	function clone_date( date ) {
		return new Date( date.getFullYear(), date.getMonth(), date.getDate() );
	}

	function add_days( date, days ) {
		var next = clone_date( date );
		next.setDate( next.getDate() + days );
		return next;
	}

	function format_iso_date( date ) {
		return date.getFullYear() + '-' + pad_2( date.getMonth() + 1 ) + '-' + pad_2( date.getDate() );
	}

	function format_row_date( date ) {
		var days = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];
		var months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
		return days[ date.getDay() ] + ' ' + months[ date.getMonth() ] + ' ' + date.getDate();
	}

	function format_date_range_display( startDate, endDate ) {
		return $.datepick.formatDate( 'M d, yy', startDate ) + ' - ' + $.datepick.formatDate( 'M d, yy', endDate );
	}

	function cache_row_templates( $page ) {
		if ( rowTemplates.length ) {
			return;
		}
		rowTemplates = $page.find( '.wpbc_ts_row' ).clone( false ).toArray();
		$.each( rowTemplates, function ( index, row ) {
			$( row ).find( '.wpbc_ts_selection:not(.wpbc_ts_selection_template)' ).remove();
			$( row ).find( '.wpbc_ts_selection_template' ).removeClass( 'is-visible is-active' ).attr( 'hidden', 'hidden' );
		} );
	}

	function ensure_row_count( $page, count ) {
		var $rowsWrap = $page.find( '.wpbc_ts_rows' );
		var $rows = $rowsWrap.find( '.wpbc_ts_row' );
		var i;
		var $clone;

		count = Math.max( 1, count );
		cache_row_templates( $page );

		if ( $rows.length > count ) {
			$rows.slice( count ).remove();
		}

		for ( i = $rowsWrap.find( '.wpbc_ts_row' ).length; i < count; i++ ) {
			$clone = $( rowTemplates[ i % rowTemplates.length ] ).clone( false );
			$clone.find( '.wpbc_ts_selection:not(.wpbc_ts_selection_template)' ).remove();
			$clone.find( '.wpbc_ts_selection_template' ).removeClass( 'is-visible is-active' ).attr( 'hidden', 'hidden' );
			$rowsWrap.append( $clone );
		}

		$rowsWrap.find( '.wpbc_ts_row' ).each( function ( index ) {
			$( this ).attr( 'data-wpbc-ts-row', String( index ) );
		} );
	}

	function update_rows_for_date_range( $page, startDate, endDate ) {
		var dayMs = 24 * 60 * 60 * 1000;
		var daysCount = Math.round( ( clone_date( endDate ).getTime() - clone_date( startDate ).getTime() ) / dayMs ) + 1;

		daysCount = Math.max( 1, daysCount );
		ensure_row_count( $page, daysCount );

		$page.find( '.wpbc_ts_row' ).each( function ( index ) {
			var rowDate = add_days( startDate, index );
			$( this )
				.attr( 'data-wpbc-ts-date', format_iso_date( rowDate ) )
				.find( '.wpbc_ts_row_label_text' ).text( format_row_date( rowDate ) );
		} );

		selectionRanges = $.grep( selectionRanges, function ( item ) {
			item.rows = $.grep( item.rows, function ( rowId ) {
				return $page.find( '.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"]' ).length > 0;
			} );
			return item.rows.length > 0;
		} );
		canonicalize_selections( activeSelectionId );

		position_bars( $page.find( '.wpbc_ts_grid' ) );
		render_selections( $page );
		sync_floating_header( $page );
	}

	function parse_datepick_selection( stringDates, jsDatesArr ) {
		var dates = [];
		var parts;
		var start;
		var end;

		if ( jsDatesArr && $.isArray( jsDatesArr.range ) ) {
			dates = jsDatesArr.range;
		} else if ( jsDatesArr && $.isArray( jsDatesArr.multiple ) ) {
			dates = jsDatesArr.multiple;
		} else if ( $.isArray( jsDatesArr ) ) {
			dates = jsDatesArr;
		}

		dates = $.grep( dates, function ( date ) {
			return date instanceof Date && ! isNaN( date.getTime() );
		} );

		if ( dates.length ) {
			dates.sort( function ( a, b ) {
				return clone_date( a ).getTime() - clone_date( b ).getTime();
			} );

			return {
				start: clone_date( dates[0] ),
				end: clone_date( dates[ dates.length - 1 ] )
			};
		}

		parts = String( stringDates || '' ).split( ' - ' );
		start = parse_date_text( parts[0] );
		end = parse_date_text( parts[1] || parts[0] );

		if ( start && end ) {
			return {
				start: start,
				end: end
			};
		}

		return null;
	}

	function get_datepick_selected_range( $date ) {
		var inst;

		if ( ! $.datepick || 'function' !== typeof $.datepick._getInst || ! $date.length ) {
			return null;
		}

		inst = $.datepick._getInst( $date[0] );
		if ( ! inst ) {
			return null;
		}

		return parse_datepick_selection( $date.val(), $.datepick._getDate( inst ) );
	}

	function apply_date_range_selection( $page, range, options ) {
		var $date = get_control( $page, 'date_range' );
		var startDate;
		var endDate;
		var startIso;
		var endIso;
		var currentKey;
		var nextKey;

		options = options || {};

		if ( ! range || ! range.start || ! range.end ) {
			return false;
		}

		startDate = clone_date( range.start );
		endDate = clone_date( range.end );

		if ( startDate.getTime() > endDate.getTime() ) {
			range = startDate;
			startDate = endDate;
			endDate = range;
		}

		startIso = format_iso_date( startDate );
		endIso = format_iso_date( endDate );
		currentKey = $date.attr( 'data-wpbc-ts-start' ) + ':' + $date.attr( 'data-wpbc-ts-end' );
		nextKey = startIso + ':' + endIso;

		if ( currentKey === nextKey ) {
			$date.val( format_date_range_display( startDate, endDate ) );
			if ( options.force_reload ) {
				load_blocked_intervals( $page );
			}
			return false;
		}

		$date
			.attr( 'data-wpbc-ts-start', startIso )
			.attr( 'data-wpbc-ts-end', endIso )
			.val( format_date_range_display( startDate, endDate ) );

		update_rows_for_date_range( $page, startDate, endDate );
		load_blocked_intervals( $page );

		return true;
	}

	function sync_date_range_from_input( $page ) {
		var $date = get_control( $page, 'date_range' );
		var range = get_datepick_selected_range( $date ) || parse_datepick_selection( $date.val(), null );

		apply_date_range_selection( $page, range );
	}

	function get_date_range_from_data_attrs( $page ) {
		var $date = get_control( $page, 'date_range' );
		var startDate = parse_date_text( $date.attr( 'data-wpbc-ts-start' ) );
		var endDate = parse_date_text( $date.attr( 'data-wpbc-ts-end' ) );

		if ( startDate && endDate ) {
			return {
				start: startDate,
				end: endDate
			};
		}

		return null;
	}

	function get_current_date_range( $page ) {
		var $date = get_control( $page, 'date_range' );
		var range = get_date_range_from_data_attrs( $page ) || parse_datepick_selection( $date.val(), null );

		if ( range ) {
			return range;
		}

		return {
			start: parse_date_text( $date.attr( 'data-wpbc-ts-start' ) ),
			end: parse_date_text( $date.attr( 'data-wpbc-ts-end' ) )
		};
	}

	function shift_date_range( $page, direction ) {
		var range = get_current_date_range( $page );
		var dayMs = 24 * 60 * 60 * 1000;
		var daysCount;
		var shift;

		if ( ! range || ! range.start || ! range.end ) {
			return false;
		}

		daysCount = Math.round( ( clone_date( range.end ).getTime() - clone_date( range.start ).getTime() ) / dayMs ) + 1;
		shift = Math.max( 1, daysCount ) * ( 'prev' === direction ? -1 : 1 );

		clear_selection( $page );
		return apply_date_range_selection( $page, {
			start: add_days( range.start, shift ),
			end: add_days( range.end, shift )
		}, {
			force_reload: true
		} );
	}

	function parse_date_text( text ) {
		var parsed;
		var sqlMatch;

		text = $.trim( text || '' );
		if ( ! text ) {
			return null;
		}

		sqlMatch = text.match( /^(\d{4})-(\d{2})-(\d{2})/ );
		if ( sqlMatch ) {
			return new Date( parseInt( sqlMatch[1], 10 ), parseInt( sqlMatch[2], 10 ) - 1, parseInt( sqlMatch[3], 10 ) );
		}

		if ( $.datepick && 'function' === typeof $.datepick.parseDate ) {
			try {
				parsed = $.datepick.parseDate( 'M d, yy', text );
			} catch ( error ) {
				parsed = null;
			}
		}

		if ( ! parsed ) {
			parsed = new Date( text );
		}

		return parsed instanceof Date && ! isNaN( parsed.getTime() ) ? clone_date( parsed ) : null;
	}

	function set_time_slots_context( context, options ) {
		var $context = context ? $( context ) : $( document );
		var $page = $context.is( '.wpbc_ts_page' ) ? $context : $context.find( '.wpbc_ts_page' ).first();
		var startDate;
		var endDate;
		var resourceChanged = false;
		var rangeChanged = false;

		options = options || {};

		if ( ! $page.length ) {
			return false;
		}

		init_time_slots_page( $page, true );

		if ( options.resource_id ) {
			resourceChanged = String( get_control( $page, 'resource' ).val() ) !== String( options.resource_id );
			get_control( $page, 'resource' ).val( String( options.resource_id ) );
		}

		startDate = parse_date_text( options.date_start );
		endDate = parse_date_text( options.date_end ) || startDate;

		if ( startDate && endDate ) {
			clear_selection( $page );
			rangeChanged = apply_date_range_selection( $page, {
				start: startDate,
				end: endDate
			} );
		}

		if ( resourceChanged && rangeChanged ) {
			return true;
		}

		if ( resourceChanged || ! rangeChanged ) {
			load_blocked_intervals( $page );
		}

		return true;
	}

	function row_from_pointer( $page, event ) {
		var original = event.originalEvent || event;
		var point = original.touches && original.touches.length ? original.touches[0] : original;
		var el = document.elementFromPoint( point.clientX, point.clientY );
		var $row = $( el ).closest( '.wpbc_ts_row' );

		if ( ! $row.length || ! $.contains( $page[0], $row[0] ) ) {
			return null;
		}

		return $row.attr( 'data-wpbc-ts-row' );
	}

	function minute_from_pointer( event, $lane ) {
		var original = event.originalEvent || event;
		var point = original.touches && original.touches.length ? original.touches[0] : original;
		var $grid = $lane.closest( '.wpbc_ts_grid' );
		var config = get_grid_config( $grid );
		var rect = $lane[0].getBoundingClientRect();
		var ratio = ( point.clientX - rect.left ) / rect.width;
		var minute = config.start + ratio * ( config.end - config.start );

		return clamp( snap_minute( minute, config.step ), config.start, config.end );
	}

	function create_selection( $page, rows, start, end ) {
		var $grid = $page.find( '.wpbc_ts_grid' );
		var config = get_grid_config( $grid );
		var range = normalize_selection_range( start, end, config );
		var item = {
			id: 'selection_' + nextSelectionId++,
			start: range.start,
			end: range.end,
			rows: rows.slice( 0 )
		};

		selectionRanges.push( item );
		activeSelectionId = item.id;
		canonicalize_selections( item.id );
		render_selections( $page );
		return get_selection_by_id( activeSelectionId );
	}

	function update_selection( $page, selectionId, rows, start, end ) {
		var $grid = $page.find( '.wpbc_ts_grid' );
		var config = get_grid_config( $grid );
		var range = normalize_selection_range( start, end, config );
		var item = get_selection_by_id( selectionId );

		if ( ! item ) {
			return;
		}

		item.start = range.start;
		item.end = range.end;
		item.rows = rows.slice( 0 );
		canonicalize_selections( selectionId );
		render_selections( $page );
	}

	function canonicalize_selections( preferredActiveId ) {
		var intervals = [];
		var merged = [];
		var groups = [];
		var newActiveId = '';

		$.each( selectionRanges, function ( index, item ) {
			$.each( item.rows, function ( rowIndex, rowId ) {
				intervals.push( {
					row: parseInt( rowId, 10 ),
					start: item.start,
					end: item.end,
					active: item.id === preferredActiveId || item.id === activeSelectionId
				} );
			} );
		} );

		intervals.sort( function ( a, b ) {
			if ( a.row !== b.row ) {
				return a.row - b.row;
			}
			if ( a.start !== b.start ) {
				return a.start - b.start;
			}
			return a.end - b.end;
		} );

		$.each( intervals, function ( index, item ) {
			var last = merged[ merged.length - 1 ];

			if ( last && last.row === item.row && item.start <= last.end ) {
				last.end = Math.max( last.end, item.end );
				last.active = last.active || item.active;
				return;
			}

			merged.push( {
				row: item.row,
				start: item.start,
				end: item.end,
				active: item.active
			} );
		} );

		merged.sort( function ( a, b ) {
			if ( a.start !== b.start ) {
				return a.start - b.start;
			}
			if ( a.end !== b.end ) {
				return a.end - b.end;
			}
			return a.row - b.row;
		} );

		$.each( merged, function ( index, item ) {
			var last = groups[ groups.length - 1 ];

			if ( last && last.start === item.start && last.end === item.end && last.lastRow + 1 === item.row ) {
				last.rows.push( String( item.row ) );
				last.lastRow = item.row;
				last.active = last.active || item.active;
				return;
			}

			groups.push( {
				start: item.start,
				end: item.end,
				rows: [ String( item.row ) ],
				lastRow: item.row,
				active: item.active
			} );
		} );

		selectionRanges = $.map( groups, function ( item ) {
			var id = 'selection_' + nextSelectionId++;

			if ( item.active && ! newActiveId ) {
				newActiveId = id;
			}

			return {
				id: id,
				start: item.start,
				end: item.end,
				rows: item.rows
			};
		} );

		activeSelectionId = newActiveId || ( selectionRanges[0] ? selectionRanges[0].id : '' );
	}

	function render_selections( $page ) {
		var $grid = $page.find( '.wpbc_ts_grid' );
		var config = get_grid_config( $grid );

		$page.find( '.wpbc_ts_selection:not(.wpbc_ts_selection_template)' ).remove();

		$.each( selectionRanges, function ( index, item ) {
			var range = normalize_selection_range( item.start, item.end, config );
			var left = percent_for_minute( range.start, config );
			var width = percent_for_minute( range.end, config ) - left;

			item.start = range.start;
			item.end = range.end;

			$.each( item.rows, function ( rowIndex, rowId ) {
				var $row = $page.find( '.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"]' );
				var $lane = $row.find( '.wpbc_ts_lane' );
				var $template = $lane.find( '.wpbc_ts_selection_template' ).first();
				var $selection;

				if ( ! $lane.length || ! $template.length ) {
					return;
				}

				$selection = $template.clone( false )
					.removeClass( 'wpbc_ts_selection_template' )
					.removeAttr( 'hidden' )
					.addClass( 'is-visible' )
					.toggleClass( 'is-active', item.id === activeSelectionId )
					.attr( 'data-wpbc-ts-selection-id', item.id )
					.css( { left: left + '%', width: width + '%' } );

				$selection.find( '.wpbc_ts_time_chip_start' ).text( minutes_to_time( range.start ) );
				$selection.find( '.wpbc_ts_time_chip_end' ).text( minutes_to_time( range.end ) );
				$lane.append( $selection );
			} );
		} );

		update_summary( $page );
	}

	function clear_selection( $page ) {
		selectionRanges = [];
		activeSelectionId = '';
		render_selections( $page );
	}

	function update_summary( $page ) {
		var config = get_grid_config( $page.find( '.wpbc_ts_grid' ) );
		var slotCount = 0;
		var dates = {};
		var datesCount = 0;
		var dateText = '-';
		var timeText = '-';
		var details = [];
		var detailsHtml = '';

		$.each( selectionRanges, function ( index, item ) {
			slotCount += Math.max( 0, Math.round( ( item.end - item.start ) / config.step ) * item.rows.length );

			$.each( item.rows, function ( rowIndex, rowId ) {
				var label = row_label( $page, rowId );

				if ( ! label ) {
					return;
				}

				dates[ label ] = true;
				details.push( {
					row: parseInt( rowId, 10 ),
					start: item.start,
					end: item.end,
					label: label
				} );
			} );
		} );

		details.sort( function ( a, b ) {
			if ( a.row !== b.row ) {
				return a.row - b.row;
			}
			if ( a.start !== b.start ) {
				return a.start - b.start;
			}
			return a.end - b.end;
		} );

		$.each( details, function ( index, item ) {
			var timeLabel = minutes_to_time( item.start ) + ' - ' + minutes_to_time( item.end );

			detailsHtml += '<div class="wpbc_ts_selection_detail_item">'
				+ '<span class="wpbc_ts_selection_detail_date">' + escape_html( item.label ) + '</span>'
				+ '<span class="wpbc_ts_selection_detail_time">' + escape_html( timeLabel ) + '</span>'
				+ '</div>';
		} );

		datesCount = Object.keys( dates ).length;

		if ( selectionRanges.length ) {
			dateText = datesCount + ( 1 === datesCount ? ' date' : ' dates' );
			timeText = selectionRanges.length + ( 1 === selectionRanges.length ? ' interval' : ' intervals' );
		}

		if ( ! detailsHtml ) {
			detailsHtml = '<div class="wpbc_ts_selection_details_empty">No time slots selected.</div>';
		}

		$( document ).find( '[data-wpbc-ts-detail="slots"]' ).text( slotCount );
		$( document ).find( '[data-wpbc-ts-detail="dates"]' ).text( dateText );
		$( document ).find( '[data-wpbc-ts-detail="time"]' ).text( timeText );
		$( document ).find( '[data-wpbc-ts-detail="selection_list"]' ).html( detailsHtml );
	}

	function show_live_tip( $page, event ) {
		var original = event.originalEvent || event;
		var point = original.touches && original.touches.length ? original.touches[0] : original;
		var $tip = $page.find( '.wpbc_ts_live_tip' );
		var active = get_selection_by_id( activeSelectionId );

		if ( ! active ) {
			return;
		}

		if ( ! $tip.length ) {
			$tip = $( '<div class="wpbc_ts_live_tip"></div>' ).appendTo( $page );
		}

		$tip
			.text( minutes_to_time( active.start ) + ' - ' + minutes_to_time( active.end ) )
			.css( {
				left: point.pageX + 12 + 'px',
				top: point.pageY - 38 + 'px'
			} )
			.addClass( 'is-visible' );
	}

	function hide_live_tip( $page ) {
		$page.find( '.wpbc_ts_live_tip' ).removeClass( 'is-visible' );
	}

	function sync_slot_step_controls( $page, step ) {
		get_control( $page, 'slot_step' ).val( String( step ) );
		$( '#wpbc_ts_side_slot_step' ).val( String( step ) );
	}

	function sync_zoom_controls( $page, step ) {
		var index = zoomSteps.indexOf( step );
		if ( -1 === index ) {
			index = 2;
		}
		get_control( $page, 'zoom' ).val( String( index ) );
		$( '#wpbc_ts_side_zoom' ).val( String( index ) );
	}

	function set_step( $page, step ) {
		var $grid = $page.find( '.wpbc_ts_grid' );
		$grid.attr( 'data-wpbc-ts-step', step );
		sync_slot_step_controls( $page, step );
		sync_zoom_controls( $page, step );
		render_axis( $grid );
		position_bars( $grid );
		render_selections( $page );
	}

	function sync_visible_time_controls( $page, start, end ) {
		get_control( $page, 'day_start' ).val( String( start ) );
		get_control( $page, 'day_end' ).val( String( end ) );
		get_control( $page, 'day_start_slider' ).val( String( start ) );
		get_control( $page, 'day_end_slider' ).val( String( end ) );
		$( '#wpbc_ts_side_start' ).val( String( start ) );
		$( '#wpbc_ts_side_end' ).val( String( end ) );
		$( '#wpbc_ts_side_start_slider' ).val( String( start ) );
		$( '#wpbc_ts_side_end_slider' ).val( String( end ) );
	}

	function set_visible_time_range( $page, start, end ) {
		var $grid = $page.find( '.wpbc_ts_grid' );

		start = parseInt( start, 10 );
		end = parseInt( end, 10 );

		if ( end <= start ) {
			if ( $( document.activeElement ).is( '[data-wpbc-ts-control="day_start"], [data-wpbc-ts-control="day_start_slider"], #wpbc_ts_day_start, #wpbc_ts_side_start, #wpbc_ts_day_start_slider, #wpbc_ts_side_start_slider' ) ) {
				start = Math.max( 0, end - 60 );
			} else {
				end = Math.min( 1440, start + 60 );
			}
		}

		$grid.attr( 'data-wpbc-ts-start', start );
		$grid.attr( 'data-wpbc-ts-end', end );
		sync_visible_time_controls( $page, start, end );

		render_axis( $grid );
		position_bars( $grid );
		render_selections( $page );
	}

	function set_mode( mode ) {
		currentMode = mode;
	}

	function is_bar_selectable_for_time_action( $bar ) {
		if ( ! $bar.length ) {
			return true;
		}

		return (
			$bar.hasClass( 'wpbc_ts_bar_blocked' )
			&& '0' !== $bar.attr( 'data-wpbc-ts-editable' )
		);
	}

	function run_command( $page, mode ) {
		var settings = window.wpbc_availability_timeslots_page || {};
		var labels = settings.i18n || {};
		var payload;

		if ( activeSaveRequest && activeSaveRequest.readyState !== 4 ) {
			return;
		}

		set_mode( mode );
		if ( ! selectionRanges.length ) {
			if ( window.wpbc_admin_show_message ) {
				wpbc_admin_show_message( labels.select_slots_first || 'Select one or more time ranges first.', 'warning', 3500 );
			}
			return;
		}

		payload = get_selection_payload( $page );
		if ( ! settings.ajax_url || ! settings.nonce || ! payload.length ) {
			return;
		}

		set_timeline_loading( $page, true, labels.saving || 'Saving' );
		set_action_buttons_busy( $page, true );

		activeSaveRequest = $.post( settings.ajax_url, {
			action: 'WPBC_AJX_AVAILABILITY_TIMESLOTS_SAVE',
			nonce: settings.nonce,
			resource_id: get_control( $page, 'resource' ).val(),
			mode: mode,
			intervals: JSON.stringify( payload )
		} ).done( function ( response ) {
			if ( response && response.success ) {
				if ( window.wpbc_admin_show_message ) {
					wpbc_admin_show_message( 'block' === mode ? ( labels.block_success || 'Selected time ranges have been blocked.' ) : ( labels.unblock_success || 'Selected time ranges have been unblocked.' ), 'success', 5000 );
				}
				clear_selection( $page );
				load_blocked_intervals( $page );
			} else if ( window.wpbc_admin_show_message ) {
				wpbc_admin_show_message( labels.save_error || 'Unable to save time-slot availability.', 'error', 5000 );
			}
		} ).fail( function () {
			if ( window.wpbc_admin_show_message ) {
				wpbc_admin_show_message( labels.save_error || 'Unable to save time-slot availability.', 'error', 5000 );
			}
		} ).always( function () {
			activeSaveRequest = null;
			set_action_buttons_busy( $page, false );

			if ( ! activeLoadRequest || activeLoadRequest.readyState === 4 ) {
				set_timeline_loading( $page, false, labels.loading || 'Loading' );
			}
		} );
	}

	function init_date_range_picker( $page ) {
		var $date = get_control( $page, 'date_range' );
		var $dateWrap = $date.closest( '.wpbc_ts_input_icon' );
		var firstDay = 0;

		if ( ! $.fn.datepick ) {
			if ( window.console ) {
				console.log( 'WPBC Error. JavaScript library "datepick" was not defined.' );
			}
			return;
		}

		if ( window._wpbc && 'function' === typeof window._wpbc.get_other_param ) {
			firstDay = parseInt( window._wpbc.get_other_param( 'calendars__first_day' ), 10 ) || 0;
		}

		if ( $date.hasClass( $.datepick.markerClassName ) ) {
			try {
				$date.datepick( 'destroy' );
			} catch ( error ) {}
		}

		$date.datepick( {
			beforeShowDay: function () {
				return [ true, 'date_available' ];
			},
			onSelect: function ( stringDates, jsDatesArr ) {
				apply_date_range_selection( $page, parse_datepick_selection( stringDates, jsDatesArr ) );
			},
			onClose: function () {
				window.setTimeout( function () {
					sync_date_range_from_input( $page );
				}, 0 );
			},
			showOn: 'none',
			showAnim: 'show',
			duration: '',
			rangeSelect: true,
			multiSelect: 0,
			numberOfMonths: 1,
			stepMonths: 1,
			prevText: '&lsaquo;',
			nextText: '&rsaquo;',
			dateFormat: 'M d, yy',
			changeMonth: false,
			changeYear: false,
			minDate: null,
			maxDate: null,
			showStatus: false,
			multiSeparator: ', ',
			closeAtTop: null,
			firstDay: firstDay,
			gotoCurrent: false,
			hideIfNoPrevNext: true,
			useThemeRoller: false,
			mandatory: true
		} );

		function show_date_range_picker() {
			var input = $date.get( 0 );

			if ( ! input || ! $.datepick || ! $.datepick._showDatepick || ! $date.hasClass( $.datepick.markerClassName ) ) {
				return;
			}

			if ( ( $.datepick._lastInput === input ) && ! $.datepick._datepickerShowing ) {
				$.datepick._lastInput = null;
			}

			if ( ( $.datepick._lastInput === input ) && $.datepick._datepickerShowing ) {
				return;
			}

			$.datepick._showDatepick( input );
			$( '#datepick-div, .datepick-popup' ).css( 'z-index', 1000010 );
		}

		$date.off( 'click.wpbc_ts_date_range_open focus.wpbc_ts_date_range_open keydown.wpbc_ts_date_range_open' ).on( 'click.wpbc_ts_date_range_open focus.wpbc_ts_date_range_open keydown.wpbc_ts_date_range_open', function ( event ) {
			if ( 'keydown' === event.type && ( 13 !== event.which ) && ( 32 !== event.which ) ) {
				return;
			}

			if ( 'keydown' === event.type ) {
				event.preventDefault();
			}

			show_date_range_picker();
		} );

		$dateWrap.off( 'mousedown.wpbc_ts_date_range_open click.wpbc_ts_date_range_open' )
			.on( 'mousedown.wpbc_ts_date_range_open', function ( event ) {
				event.stopPropagation();
			} )
			.on( 'click.wpbc_ts_date_range_open', function ( event ) {
				if ( event.target !== $date.get( 0 ) ) {
					event.preventDefault();
				}

				$date.trigger( 'focus' );
				show_date_range_picker();
			} );

		$date.on( 'change input', function () {
			sync_date_range_from_input( $page );
		} );
	}

	function init_rightbar_tabs() {
		$( document ).on( 'click', '.wpbc_ts_rightbar_tabs [role="tab"]', function ( event ) {
			var $tab = $( this );
			var panelId = $tab.attr( 'aria-controls' );
			var $panel = $( '#' + panelId );
			var $tablist = $tab.closest( '[role="tablist"]' );

			if ( ! $panel.length ) {
				return;
			}

			event.preventDefault();
			$tablist.find( '[role="tab"]' ).attr( 'aria-selected', 'false' );
			$tab.attr( 'aria-selected', 'true' );
			$( '.wpbc_ts_rightbar_panels .wpbc_bfb__palette_panel' ).attr( 'hidden', 'hidden' ).attr( 'aria-hidden', 'true' );
			$panel.removeAttr( 'hidden' ).attr( 'aria-hidden', 'false' );
		} );
	}

	function init_time_slots_page( context, force ) {
		var $context = context ? $( context ) : $( document );
		var $pages = $context.is( '.wpbc_ts_page' ) ? $context : $context.find( '.wpbc_ts_page' );

		if ( ! $pages.length ) {
			return;
		}

		if ( ! force ) {
			$pages = $pages.filter( function () {
				return '0' !== $( this ).attr( 'data-wpbc-ts-auto-init' );
			} );
		}

		$pages.each( function () {
			init_time_slots_component( $( this ) );
		} );
	}

	function init_time_slots_component( $page ) {
		var $grid;
		var isDragging = false;
		var dragStartMinute = 0;
		var dragStartRow = null;
		var dragSelectionId = '';
		var resizeMode = '';

		if ( $page.attr( 'data-wpbc-ts-initialized' ) ) {
			return;
		}
		$page.attr( 'data-wpbc-ts-initialized', '1' );

		cache_row_templates( $page );
		$grid = $page.find( '.wpbc_ts_grid' );
		render_axis( $grid );
		position_bars( $grid );
		init_date_range_picker( $page );
		load_blocked_intervals( $page );
		set_mode( currentMode );
		sync_slot_step_controls( $page, get_grid_config( $grid ).step );
		sync_zoom_controls( $page, get_grid_config( $grid ).step );
		sync_visible_time_controls( $page, get_grid_config( $grid ).start, get_grid_config( $grid ).end );
		bind_floating_header( $page );

		$page.on( 'change', '[data-wpbc-ts-control="slot_step"], #wpbc_ts_slot_step', function () {
			set_step( $page, parseInt( $( this ).val(), 10 ) );
		} );

		$( document ).on( 'change', '#wpbc_ts_side_slot_step', function () {
			set_step( $page, parseInt( $( this ).val(), 10 ) );
		} );

		$page.on( 'change', '[data-wpbc-ts-control="resource"], #wpbc_ts_resource', function () {
			load_blocked_intervals( $page );
		} );

		$page.on( 'input change', '[data-wpbc-ts-control="zoom"], #wpbc_ts_zoom', function () {
			var index = parseInt( $( this ).val(), 10 );
			set_step( $page, zoomSteps[ index ] || 15 );
		} );

		$( document ).on( 'input change', '#wpbc_ts_side_zoom', function () {
			var index = parseInt( $( this ).val(), 10 );
			set_step( $page, zoomSteps[ index ] || 15 );
		} );

		$page.on( 'click', '[data-wpbc-ts-zoom]', function () {
			var $zoom = get_control( $page, 'zoom' );
			var value = parseInt( $zoom.val(), 10 );
			value += 'in' === $( this ).attr( 'data-wpbc-ts-zoom' ) ? 1 : -1;
			value = clamp( value, 0, zoomSteps.length - 1 );
			$zoom.val( String( value ) ).trigger( 'change' );
		} );

		$( document ).on( 'click', '.wpbc_ts_rightbar_panels [data-wpbc-ts-zoom]', function () {
			var $zoom = $( '#wpbc_ts_side_zoom' );
			var value = parseInt( $zoom.val(), 10 );
			value += 'in' === $( this ).attr( 'data-wpbc-ts-zoom' ) ? 1 : -1;
			value = clamp( value, 0, zoomSteps.length - 1 );
			$zoom.val( String( value ) ).trigger( 'change' );
		} );

		$page.on( 'change', '[data-wpbc-ts-control="day_start"], [data-wpbc-ts-control="day_end"], #wpbc_ts_day_start, #wpbc_ts_day_end', function () {
			set_visible_time_range( $page, get_control( $page, 'day_start' ).val(), get_control( $page, 'day_end' ).val() );
		} );

		$( document ).on( 'change', '#wpbc_ts_side_start, #wpbc_ts_side_end', function () {
			set_visible_time_range( $page, $( '#wpbc_ts_side_start' ).val(), $( '#wpbc_ts_side_end' ).val() );
		} );

		$page.on( 'input change', '[data-wpbc-ts-control="day_start_slider"], [data-wpbc-ts-control="day_end_slider"], #wpbc_ts_day_start_slider, #wpbc_ts_day_end_slider', function () {
			set_visible_time_range( $page, get_control( $page, 'day_start_slider' ).val(), get_control( $page, 'day_end_slider' ).val() );
		} );

		$( document ).on( 'input change', '#wpbc_ts_side_start_slider, #wpbc_ts_side_end_slider', function () {
			set_visible_time_range( $page, $( '#wpbc_ts_side_start_slider' ).val(), $( '#wpbc_ts_side_end_slider' ).val() );
		} );

		$page.on( 'click', '[data-wpbc-ts-command]', function ( event ) {
			event.preventDefault();
			run_command( $page, $( this ).attr( 'data-wpbc-ts-command' ) );
		} );

		$page.on( 'click', '[data-wpbc-ts-range-shift]', function ( event ) {
			event.preventDefault();
			shift_date_range( $page, $( this ).attr( 'data-wpbc-ts-range-shift' ) );
		} );

		$page.on( 'click', '[data-wpbc-ts-create-booking]', function ( event ) {
			event.preventDefault();
			create_booking_from_active_selection( $page );
		} );

		$page.closest( '.modal' ).off( 'click.wpbc_ts_create_booking' ).on( 'click.wpbc_ts_create_booking', '[data-wpbc-ts-create-booking]', function ( event ) {
			event.preventDefault();
			create_booking_from_active_selection( $page );
		} );

		$page.closest( '.modal' ).off( 'click.wpbc_ts_footer_command' ).on( 'click.wpbc_ts_footer_command', '[data-wpbc-ts-command]', function ( event ) {
			event.preventDefault();
			run_command( $page, $( this ).attr( 'data-wpbc-ts-command' ) );
		} );

		$page.closest( '.modal' ).off( 'click.wpbc_ts_footer_clear' ).on( 'click.wpbc_ts_footer_clear', '.wpbc_ts_clear_selection', function ( event ) {
			event.preventDefault();
			clear_selection( $page );
		} );

		$page.on( 'click', '.wpbc_ts_bar_booked', function ( event ) {
			handle_booked_bar_click( $page, event );
		} );

		$( document ).off( 'click.wpbc_ts_rightbar_command' ).on( 'click.wpbc_ts_rightbar_command', '.wpbc_ts_rightbar_panels [data-wpbc-ts-command]', function ( event ) {
			event.preventDefault();
			run_command( $page, $( this ).attr( 'data-wpbc-ts-command' ) );
		} );

		$( document ).off( 'click.wpbc_ts_rightbar_range_shift' ).on( 'click.wpbc_ts_rightbar_range_shift', '.wpbc_ts_rightbar_panels [data-wpbc-ts-range-shift]', function ( event ) {
			event.preventDefault();
			shift_date_range( $page, $( this ).attr( 'data-wpbc-ts-range-shift' ) );
		} );

		$page.on( 'mousedown touchstart', '.wpbc_ts_handle', function ( event ) {
			var $selection = $( this ).closest( '.wpbc_ts_selection' );
			var $lane = $selection.closest( '.wpbc_ts_lane' );
			isDragging = true;
			resizeMode = $( this ).hasClass( 'wpbc_ts_handle_start' ) ? 'start' : 'end';
			activeSelectionId = $selection.attr( 'data-wpbc-ts-selection-id' );
			dragSelectionId = activeSelectionId;
			dragStartRow = $lane.closest( '.wpbc_ts_row' ).attr( 'data-wpbc-ts-row' );
			dragStartMinute = minute_from_pointer( event, $lane );
			render_selections( $page );
			event.preventDefault();
			event.stopPropagation();
		} );

		$page.on( 'mousedown touchstart', '.wpbc_ts_selection:not(.wpbc_ts_selection_template)', function ( event ) {
			if ( $( event.target ).closest( '.wpbc_ts_handle' ).length ) {
				return;
			}
			activeSelectionId = $( this ).attr( 'data-wpbc-ts-selection-id' );
			render_selections( $page );
			event.stopPropagation();
		} );

		$page.on( 'mousedown touchstart', '.wpbc_ts_lane', function ( event ) {
			var $lane = $( this );
			var $barTarget = $( event.target ).closest( '.wpbc_ts_bar' );
			var step;

			if ( $( event.target ).closest( '.wpbc_ts_selection:not(.wpbc_ts_selection_template)' ).length ) {
				return;
			}
			if ( $barTarget.length && ! is_bar_selectable_for_time_action( $barTarget ) ) {
				return;
			}

			isDragging = true;
			resizeMode = '';
			dragStartRow = $lane.closest( '.wpbc_ts_row' ).attr( 'data-wpbc-ts-row' );
			dragStartMinute = minute_from_pointer( event, $lane );
			step = get_grid_config( $grid ).step;
			dragSelectionId = create_selection( $page, [ dragStartRow ], dragStartMinute, dragStartMinute + step ).id;
			show_live_tip( $page, event );
			event.preventDefault();
		} );

		$( document ).on( 'mousemove.wpbc_ts touchmove.wpbc_ts', function ( event ) {
			var currentRow;
			var rows;
			var $lane;
			var minute;
			var item;

			if ( ! isDragging ) {
				return;
			}

			item = get_selection_by_id( dragSelectionId );
			if ( ! item ) {
				return;
			}

			currentRow = row_from_pointer( $page, event ) || dragStartRow;
			rows = get_rows_between( $page, dragStartRow, currentRow );
			$lane = $page.find( '.wpbc_ts_row[data-wpbc-ts-row="' + dragStartRow + '"] .wpbc_ts_lane' );
			minute = minute_from_pointer( event, $lane );

			if ( 'start' === resizeMode ) {
				update_selection( $page, item.id, item.rows, minute, item.end );
			} else if ( 'end' === resizeMode ) {
				update_selection( $page, item.id, item.rows, item.start, minute );
			} else {
				update_selection( $page, item.id, rows, dragStartMinute, minute );
			}
			dragSelectionId = activeSelectionId;

			show_live_tip( $page, event );
			event.preventDefault();
		} );

		$( document ).on( 'mouseup.wpbc_ts touchend.wpbc_ts', function () {
			isDragging = false;
			resizeMode = '';
			dragSelectionId = '';
			hide_live_tip( $page );
		} );

		$page.on( 'click', '.wpbc_ts_clear_selection', function ( event ) {
			event.preventDefault();
			clear_selection( $page );
		} );

		$( document ).off( 'click.wpbc_ts_rightbar_clear' ).on( 'click.wpbc_ts_rightbar_clear', '.wpbc_ts_rightbar_panels .wpbc_ts_clear_selection', function ( event ) {
			event.preventDefault();
			clear_selection( $page );
		} );
	}

	window.wpbc_availability_timeslots_init = function ( context ) {
		init_time_slots_page( context || document, true );
	};
	window.wpbc_availability_timeslots_set_context = set_time_slots_context;

	$( function () {
		init_rightbar_tabs();
		init_time_slots_page( document, false );

		$( document ).on( 'wpbc_availability_timeslots_init', function ( event, context ) {
			init_time_slots_page( context || document, true );
		} );
	} );
}( jQuery ) );
