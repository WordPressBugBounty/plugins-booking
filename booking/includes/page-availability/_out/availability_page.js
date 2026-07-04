"use strict";

/**
 * Request Object
 * Here we can  define Search parameters and Update it later,  when  some parameter was changed
 *
 */
var wpbc_ajx_availability = function (obj, $) {
  // Secure parameters for Ajax	------------------------------------------------------------------------------------
  var p_secure = obj.security_obj = obj.security_obj || {
    user_id: 0,
    nonce: '',
    locale: ''
  };
  obj.set_secure_param = function (param_key, param_val) {
    p_secure[param_key] = param_val;
  };
  obj.get_secure_param = function (param_key) {
    return p_secure[param_key];
  };

  // Listing Search parameters	------------------------------------------------------------------------------------
  var p_listing = obj.search_request_obj = obj.search_request_obj || {
    // sort            : "booking_id",
    // sort_type       : "DESC",
    // page_num        : 1,
    // page_items_count: 10,
    // create_date     : "",
    // keyword         : "",
    // source          : ""
  };
  obj.search_set_all_params = function (request_param_obj) {
    p_listing = request_param_obj;
  };
  obj.search_get_all_params = function () {
    return p_listing;
  };
  obj.search_get_param = function (param_key) {
    return p_listing[param_key];
  };
  obj.search_set_param = function (param_key, param_val) {
    // if ( Array.isArray( param_val ) ){
    // 	param_val = JSON.stringify( param_val );
    // }
    p_listing[param_key] = param_val;
  };
  obj.search_set_params_arr = function (params_arr) {
    _.each(params_arr, function (p_val, p_key, p_data) {
      // Define different Search  parameters for request
      this.search_set_param(p_key, p_val);
    });
  };

  // Other parameters 			------------------------------------------------------------------------------------
  var p_other = obj.other_obj = obj.other_obj || {};
  obj.set_other_param = function (param_key, param_val) {
    p_other[param_key] = param_val;
  };
  obj.get_other_param = function (param_key) {
    return p_other[param_key];
  };
  return obj;
}(wpbc_ajx_availability || {}, jQuery);
var wpbc_ajx_bookings = [];

/**
 *   Show Content  ---------------------------------------------------------------------------------------------- */

/**
 * Show Content - Calendar and UI elements
 *
 * @param ajx_data_arr
 * @param ajx_search_params
 * @param ajx_cleaned_params
 */
function wpbc_ajx_availability__page_content__show(ajx_data_arr, ajx_search_params, ajx_cleaned_params) {
  var template__availability_main_page_content = wp.template('wpbc_ajx_availability_main_page_content');

  // Content
  jQuery(wpbc_ajx_availability.get_other_param('listing_container')).html(template__availability_main_page_content({
    'ajx_data': ajx_data_arr,
    'ajx_search_params': ajx_search_params,
    // $_REQUEST[ 'search_params' ]
    'ajx_cleaned_params': ajx_cleaned_params
  }));
  jQuery('.wpbc_processing.wpbc_spin').parent().parent().parent().parent('[id^="wpbc_notice_"]').hide();
  // Load calendar
  wpbc_ajx_availability__calendar__show({
    'resource_id': ajx_cleaned_params.resource_id,
    'ajx_nonce_calendar': ajx_data_arr.ajx_nonce_calendar,
    'ajx_data_arr': ajx_data_arr,
    'ajx_cleaned_params': ajx_cleaned_params
  });

  /**
   * Trigger for dates selection in the booking form
   *
   * jQuery( wpbc_ajx_availability.get_other_param( 'listing_container' ) ).on('wpbc_page_content_loaded', function(event, ajx_data_arr, ajx_search_params , ajx_cleaned_params) { ... } );
   */
  jQuery(wpbc_ajx_availability.get_other_param('listing_container')).trigger('wpbc_page_content_loaded', [ajx_data_arr, ajx_search_params, ajx_cleaned_params]);
}

/**
 * Show inline month view calendar              with all predefined CSS (sizes and check in/out,  times containers)
 * @param {obj} calendar_params_arr
			{
				'resource_id'       	: ajx_cleaned_params.resource_id,
				'ajx_nonce_calendar'	: ajx_data_arr.ajx_nonce_calendar,
				'ajx_data_arr'          : ajx_data_arr = { ajx_booking_resources:[], booked_dates: {}, resource_unavailable_dates:[], season_availability:{},.... }
				'ajx_cleaned_params'    : {
											calendar__days_selection_mode: "dynamic"
											calendar__start_week_day: "0"
											calendar__view__cell_height: ""
											calendar__view__months_in_row: 4
											calendar__view__visible_months: 12
											calendar__view__width: "100%"

											dates_availability: "unavailable"
											dates_selection: "2023-03-14 ~ 2023-03-16"
											do_action: "set_availability"
											resource_id: 1
											ui_clicked_element_id: "wpbc_availability_apply_btn"
											ui_usr__availability_selected_toolbar: "info"
								  		 }
			}
*/
function wpbc_ajx_availability__calendar__show(calendar_params_arr) {
  // Update nonce
  jQuery('#ajx_nonce_calendar_section').html(calendar_params_arr.ajx_nonce_calendar);

  //------------------------------------------------------------------------------------------------------------------
  // Update bookings
  if ('undefined' == typeof wpbc_ajx_bookings[calendar_params_arr.resource_id]) {
    wpbc_ajx_bookings[calendar_params_arr.resource_id] = [];
  }
  wpbc_ajx_bookings[calendar_params_arr.resource_id] = calendar_params_arr['ajx_data_arr']['booked_dates'];

  //------------------------------------------------------------------------------------------------------------------
  /**
   * Define showing mouse over tooltip on unavailable dates
   * It's defined, when calendar REFRESHED (change months or days selection) loaded in jquery.datepick.wpbc.9.0.js :
   * 		$( 'body' ).trigger( 'wpbc_datepick_inline_calendar_refresh', ...		// FixIn: 9.4.4.13.
   */
  jQuery('body').on('wpbc_datepick_inline_calendar_refresh', function (event, resource_id, inst) {
    // inst.dpDiv  it's:  <div class="datepick-inline datepick-multi" style="width: 17712px;">....</div>
    inst.dpDiv.find('.season_unavailable,.before_after_unavailable,.weekdays_unavailable').on('mouseover', function (this_event) {
      // also available these vars: 	resource_id, jCalContainer, inst
      var jCell = jQuery(this_event.currentTarget);
      wpbc_avy__show_tooltip__for_element(jCell, calendar_params_arr['ajx_data_arr']['popover_hints']);
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  /**
   * Define height of the calendar  cells, 	and  mouse over tooltips at  some unavailable dates
   * It's defined, when calendar loaded in jquery.datepick.wpbc.9.0.js :
   * 		$( 'body' ).trigger( 'wpbc_datepick_inline_calendar_loaded', ...		// FixIn: 9.4.4.12.
   */
  jQuery('body').on('wpbc_datepick_inline_calendar_loaded', function (event, resource_id, jCalContainer, inst) {
    // Remove highlight day for today  date
    jQuery('.datepick-days-cell.datepick-today.datepick-days-cell-over').removeClass('datepick-days-cell-over');

    // Set height of calendar  cells if defined this option  // FixIn: 10.12.4.2.
    if ('' !== calendar_params_arr.ajx_cleaned_params.calendar__view__cell_height) {
      jQuery('head').append('<style type="text/css">' + '.hasDatepick .datepick-inline .datepick-title-row th, ' + '.hasDatepick .datepick-inline .datepick-days-cell {' + 'max-height: ' + calendar_params_arr.ajx_cleaned_params.calendar__view__cell_height + ' !important;' + '}' + '</style>');
    }

    // Define showing mouse over tooltip on unavailable dates
    jCalContainer.find('.season_unavailable,.before_after_unavailable,.weekdays_unavailable').on('mouseover', function (this_event) {
      // also available these vars: 	resource_id, jCalContainer, inst
      var jCell = jQuery(this_event.currentTarget);
      wpbc_avy__show_tooltip__for_element(jCell, calendar_params_arr['ajx_data_arr']['popover_hints']);
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // Define width of entire calendar
  var width = 'width:' + calendar_params_arr.ajx_cleaned_params.calendar__view__width + ';'; // var width = 'width:100%;max-width:100%;';

  if (undefined != calendar_params_arr.ajx_cleaned_params.calendar__view__max_width && '' != calendar_params_arr.ajx_cleaned_params.calendar__view__max_width) {
    width += 'max-width:' + calendar_params_arr.ajx_cleaned_params.calendar__view__max_width + ';';
  } else {
    width += 'max-width:' + calendar_params_arr.ajx_cleaned_params.calendar__view__months_in_row * 341 + 'px;';
  }

  //------------------------------------------------------------------------------------------------------------------
  // Add calendar container: "Calendar is loading..."  and textarea
  jQuery('.wpbc_ajx_avy__calendar').html('<div class="' + ' bk_calendar_frame' + ' months_num_in_row_' + calendar_params_arr.ajx_cleaned_params.calendar__view__months_in_row + ' cal_month_num_' + calendar_params_arr.ajx_cleaned_params.calendar__view__visible_months + '" ' + 'style="' + width + '">' + '<div id="calendar_booking' + calendar_params_arr.resource_id + '">' + 'Calendar is loading...' + '</div>' + '</div>' + '<textarea      id="date_booking' + calendar_params_arr.resource_id + '"' + ' name="date_booking' + calendar_params_arr.resource_id + '"' + ' autocomplete="off"' + ' style="display:none;width:100%;height:10em;margin:2em 0 0;"></textarea>');

  //------------------------------------------------------------------------------------------------------------------
  var cal_param_arr = {
    'html_id': 'calendar_booking' + calendar_params_arr.ajx_cleaned_params.resource_id,
    'text_id': 'date_booking' + calendar_params_arr.ajx_cleaned_params.resource_id,
    'calendar__start_week_day': calendar_params_arr.ajx_cleaned_params.calendar__start_week_day,
    'calendar__view__visible_months': calendar_params_arr.ajx_cleaned_params.calendar__view__visible_months,
    'calendar__days_selection_mode': calendar_params_arr.ajx_cleaned_params.calendar__days_selection_mode,
    'resource_id': calendar_params_arr.ajx_cleaned_params.resource_id,
    'ajx_nonce_calendar': calendar_params_arr.ajx_data_arr.ajx_nonce_calendar,
    'booked_dates': calendar_params_arr.ajx_data_arr.booked_dates,
    'season_availability': calendar_params_arr.ajx_data_arr.season_availability,
    'resource_unavailable_dates': calendar_params_arr.ajx_data_arr.resource_unavailable_dates,
    'popover_hints': calendar_params_arr['ajx_data_arr']['popover_hints'] // {'season_unavailable':'...','weekdays_unavailable':'...','before_after_unavailable':'...',}
  };
  wpbc_show_inline_booking_calendar(cal_param_arr);

  //------------------------------------------------------------------------------------------------------------------
  /**
   * On click AVAILABLE |  UNAVAILABLE button  in widget	-	need to  change help dates text
   */
  jQuery('.wpbc_radio__set_days_availability').on('change', function (event, resource_id, inst) {
    wpbc__inline_booking_calendar__on_days_select(jQuery('#' + cal_param_arr.text_id).val(), cal_param_arr);
  });

  // Show 	'Select days  in calendar then select Available  /  Unavailable status and click Apply availability button.'
  jQuery('#wpbc_toolbar_dates_hint').html('<div class="ui_element"><span class="wpbc_ui_control wpbc_ui_addon wpbc_help_text" >' + cal_param_arr.popover_hints.toolbar_text + '</span></div>');
}

/**
 * 	Load Datepick Inline calendar
 *
 * @param calendar_params_arr		example:{
											'html_id'           : 'calendar_booking' + calendar_params_arr.ajx_cleaned_params.resource_id,
											'text_id'           : 'date_booking' + calendar_params_arr.ajx_cleaned_params.resource_id,

											'calendar__start_week_day': 	  calendar_params_arr.ajx_cleaned_params.calendar__start_week_day,
											'calendar__view__visible_months': calendar_params_arr.ajx_cleaned_params.calendar__view__visible_months,
											'calendar__days_selection_mode':  calendar_params_arr.ajx_cleaned_params.calendar__days_selection_mode,

											'resource_id'        : calendar_params_arr.ajx_cleaned_params.resource_id,
											'ajx_nonce_calendar' : calendar_params_arr.ajx_data_arr.ajx_nonce_calendar,
											'booked_dates'       : calendar_params_arr.ajx_data_arr.booked_dates,
											'season_availability': calendar_params_arr.ajx_data_arr.season_availability,

											'resource_unavailable_dates' : calendar_params_arr.ajx_data_arr.resource_unavailable_dates
										}
 * @returns {boolean}
 */
function wpbc_show_inline_booking_calendar(calendar_params_arr) {
  if (0 === jQuery('#' + calendar_params_arr.html_id).length // If calendar DOM element not exist then exist
  || true === jQuery('#' + calendar_params_arr.html_id).hasClass('hasDatepick') // If the calendar with the same Booking resource already  has been activated, then exist.
  ) {
    return false;
  }

  //------------------------------------------------------------------------------------------------------------------
  // Configure and show calendar
  jQuery('#' + calendar_params_arr.html_id).text('');
  jQuery('#' + calendar_params_arr.html_id).datepick({
    beforeShowDay: function (date) {
      return wpbc__inline_booking_calendar__apply_css_to_days(date, calendar_params_arr, this);
    },
    onSelect: function (date) {
      jQuery('#' + calendar_params_arr.text_id).val(date);
      //wpbc_blink_element('.wpbc_widget_available_unavailable', 3, 220);
      return wpbc__inline_booking_calendar__on_days_select(date, calendar_params_arr, this);
    },
    onHover: function (value, date) {
      //wpbc_avy__prepare_tooltip__in_calendar( value, date, calendar_params_arr, this );

      return wpbc__inline_booking_calendar__on_days_hover(value, date, calendar_params_arr, this);
    },
    onChangeMonthYear: null,
    showOn: 'both',
    numberOfMonths: calendar_params_arr.calendar__view__visible_months,
    stepMonths: 1,
    // prevText: 			'&laquo;',
    // nextText: 			'&raquo;',
    prevText: '&lsaquo;',
    nextText: '&rsaquo;',
    dateFormat: 'yy-mm-dd',
    // 'dd.mm.yy',
    changeMonth: false,
    changeYear: false,
    minDate: 0,
    //null,  //Scroll as long as you need
    maxDate: '10y',
    // minDate: new Date(2020, 2, 1), maxDate: new Date(2020, 9, 31), 	// Ability to set any  start and end date in calendar
    showStatus: false,
    closeAtTop: false,
    firstDay: calendar_params_arr.calendar__start_week_day,
    gotoCurrent: false,
    hideIfNoPrevNext: true,
    multiSeparator: ', ',
    multiSelect: 'dynamic' == calendar_params_arr.calendar__days_selection_mode ? 0 : 365,
    // Maximum number of selectable dates:	 Single day = 0,  multi days = 365
    rangeSelect: 'dynamic' == calendar_params_arr.calendar__days_selection_mode,
    rangeSeparator: ' ~ ',
    //' - ',
    // showWeeks: true,
    useThemeRoller: false
  });
  return true;
}

/**
 * Apply CSS to calendar date cells
 *
 * @param date					-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00 GMT+0200 (Eastern European Standard Time)
 * @param calendar_params_arr	-  Calendar Settings Object:  	{
																  "html_id": "calendar_booking4",
																  "text_id": "date_booking4",
																  "calendar__start_week_day": 1,
																  "calendar__view__visible_months": 12,
																  "resource_id": 4,
																  "ajx_nonce_calendar": "<input type=\"hidden\" ... />",
																  "booked_dates": {
																	"12-28-2022": [
																	  {
																		"booking_date": "2022-12-28 00:00:00",
																		"approved": "1",
																		"booking_id": "26"
																	  }
																	], ...
																	}
																	'season_availability':{
																		"2023-01-09": true,
																		"2023-01-10": true,
																		"2023-01-11": true, ...
																	}
																  }
																}
 * @param datepick_this			- this of datepick Obj
 *
 * @returns [boolean,string]	- [ {true -available | false - unavailable}, 'CSS classes for calendar day cell' ]
 */
function wpbc__inline_booking_calendar__apply_css_to_days(date, calendar_params_arr, datepick_this) {
  var today_date = new Date(_wpbc.get_other_param('today_arr')[0], parseInt(_wpbc.get_other_param('today_arr')[1]) - 1, _wpbc.get_other_param('today_arr')[2], 0, 0, 0);
  var real_today_date = new Date(_wpbc.get_other_param('time_local_arr')[0], parseInt(_wpbc.get_other_param('time_local_arr')[1]) - 1, _wpbc.get_other_param('time_local_arr')[2], 0, 0, 0);
  var class_day = date.getMonth() + 1 + '-' + date.getDate() + '-' + date.getFullYear(); // '1-9-2023'
  var sql_class_day = wpbc__get__sql_class_date(date); // '2023-01-09'

  var css_date__standard = 'cal4date-' + class_day;
  var css_date__additional = ' wpbc_weekday_' + date.getDay() + ' ';

  //--------------------------------------------------------------------------------------------------------------

  // WEEKDAYS :: Set unavailable week days from - Settings General page in "Availability" section
  for (var i = 0; i < _wpbc.get_other_param('availability__week_days_unavailable').length; i++) {
    if (date.getDay() == _wpbc.get_other_param('availability__week_days_unavailable')[i]) {
      return [!!false, css_date__standard + ' date_user_unavailable' + ' weekdays_unavailable'];
    }
  }
  // 10.9.6.3.
  var date_midnight = new Date(parseInt(date.getFullYear()), parseInt(date.getMonth()) - 0, parseInt(date.getDate()), 0, 0, 0);
  // BEFORE_AFTER :: Set unavailable days Before / After the Today date.
  //if ( ((wpbc_dates__days_between( date, real_today_date )) < parseInt( _wpbc.get_other_param( 'availability__unavailable_from_today' ) ))
  if (today_date.getTime() - date_midnight.getTime() > 0 || parseInt('0' + parseInt(_wpbc.get_other_param('availability__available_from_today'))) > 0 && wpbc_dates__days_between(date_midnight, real_today_date) >= parseInt('0' + parseInt(_wpbc.get_other_param('availability__available_from_today')))) {
    return [false, css_date__standard + ' date_user_unavailable' + ' before_after_unavailable'];
  }

  // SEASONS ::  					Booking > Resources > Availability page
  var is_date_available = calendar_params_arr.season_availability[sql_class_day];
  if (false === is_date_available) {
    // FixIn: 9.5.4.4.
    return [!!false, css_date__standard + ' date_user_unavailable' + ' season_unavailable'];
  }

  // RESOURCE_UNAVAILABLE ::   	Booking > Availability page
  if (wpbc_in_array(calendar_params_arr.resource_unavailable_dates, sql_class_day)) {
    is_date_available = false;
  }
  if (false === is_date_available) {
    // FixIn: 9.5.4.4.
    return [!false, css_date__standard + ' date_user_unavailable' + ' resource_unavailable'];
  }

  //--------------------------------------------------------------------------------------------------------------

  //--------------------------------------------------------------------------------------------------------------

  // Is any bookings in this date ?
  if ('undefined' !== typeof calendar_params_arr.booked_dates[class_day]) {
    var bookings_in_date = calendar_params_arr.booked_dates[class_day];
    if ('undefined' !== typeof bookings_in_date['sec_0']) {
      // "Full day" booking  -> (seconds == 0)

      css_date__additional += '0' === bookings_in_date['sec_0'].approved ? ' date2approve ' : ' date_approved '; // Pending = '0' |  Approved = '1'
      css_date__additional += ' full_day_booking';
      return [!false, css_date__standard + css_date__additional];
    } else if (Object.keys(bookings_in_date).length > 0) {
      // "Time slots" Bookings

      var is_approved = true;
      _.each(bookings_in_date, function (p_val, p_key, p_data) {
        if (!parseInt(p_val.approved)) {
          is_approved = false;
        }
        var ts = p_val.booking_date.substring(p_val.booking_date.length - 1);
        if (true === _wpbc.get_other_param('is_enabled_change_over')) {
          if (ts == '1') {
            css_date__additional += ' check_in_time' + (parseInt(p_val.approved) ? ' check_in_time_date_approved' : ' check_in_time_date2approve');
          }
          if (ts == '2') {
            css_date__additional += ' check_out_time' + (parseInt(p_val.approved) ? ' check_out_time_date_approved' : ' check_out_time_date2approve');
          }
        }
      });
      if (!is_approved) {
        css_date__additional += ' date2approve timespartly';
      } else {
        css_date__additional += ' date_approved timespartly';
      }
      if (!_wpbc.get_other_param('is_enabled_change_over')) {
        css_date__additional += ' times_clock';
      }
    }
  }

  //--------------------------------------------------------------------------------------------------------------

  return [true, css_date__standard + css_date__additional + ' date_available'];
}

/**
 * Apply some CSS classes, when we mouse over specific dates in calendar
 * @param value
 * @param date					-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00 GMT+0200 (Eastern European Standard Time)
 * @param calendar_params_arr	-  Calendar Settings Object:  	{
																  "html_id": "calendar_booking4",
																  "text_id": "date_booking4",
																  "calendar__start_week_day": 1,
																  "calendar__view__visible_months": 12,
																  "resource_id": 4,
																  "ajx_nonce_calendar": "<input type=\"hidden\" ... />",
																  "booked_dates": {
																	"12-28-2022": [
																	  {
																		"booking_date": "2022-12-28 00:00:00",
																		"approved": "1",
																		"booking_id": "26"
																	  }
																	], ...
																	}
																	'season_availability':{
																		"2023-01-09": true,
																		"2023-01-10": true,
																		"2023-01-11": true, ...
																	}
																  }
																}
 * @param datepick_this			- this of datepick Obj
 *
 * @returns {boolean}
 */
function wpbc__inline_booking_calendar__on_days_hover(value, date, calendar_params_arr, datepick_this) {
  if (null === date) {
    jQuery('.datepick-days-cell-over').removeClass('datepick-days-cell-over'); // clear all highlight days selections
    return false;
  }
  var inst = jQuery.datepick._getInst(document.getElementById('calendar_booking' + calendar_params_arr.resource_id));
  if (1 == inst.dates.length // If we have one selected date
  && 'dynamic' === calendar_params_arr.calendar__days_selection_mode // while have range days selection mode
  ) {
    var td_class;
    var td_overs = [];
    var is_check = true;
    var selceted_first_day = new Date();
    selceted_first_day.setFullYear(inst.dates[0].getFullYear(), inst.dates[0].getMonth(), inst.dates[0].getDate()); //Get first Date

    while (is_check) {
      td_class = selceted_first_day.getMonth() + 1 + '-' + selceted_first_day.getDate() + '-' + selceted_first_day.getFullYear();
      td_overs[td_overs.length] = '#calendar_booking' + calendar_params_arr.resource_id + ' .cal4date-' + td_class; // add to array for later make selection by class

      if (date.getMonth() == selceted_first_day.getMonth() && date.getDate() == selceted_first_day.getDate() && date.getFullYear() == selceted_first_day.getFullYear() || selceted_first_day > date) {
        is_check = false;
      }
      selceted_first_day.setFullYear(selceted_first_day.getFullYear(), selceted_first_day.getMonth(), selceted_first_day.getDate() + 1);
    }

    // Highlight Days
    for (var i = 0; i < td_overs.length; i++) {
      // add class to all elements
      jQuery(td_overs[i]).addClass('datepick-days-cell-over');
    }
    return true;
  }
  return true;
}

/**
 * On DAYs selection in calendar
 *
 * @param dates_selection		-  string:			 '2023-03-07 ~ 2023-03-07' or '2023-04-10, 2023-04-12, 2023-04-02, 2023-04-04'
 * @param calendar_params_arr	-  Calendar Settings Object:  	{
																  "html_id": "calendar_booking4",
																  "text_id": "date_booking4",
																  "calendar__start_week_day": 1,
																  "calendar__view__visible_months": 12,
																  "resource_id": 4,
																  "ajx_nonce_calendar": "<input type=\"hidden\" ... />",
																  "booked_dates": {
																	"12-28-2022": [
																	  {
																		"booking_date": "2022-12-28 00:00:00",
																		"approved": "1",
																		"booking_id": "26"
																	  }
																	], ...
																	}
																	'season_availability':{
																		"2023-01-09": true,
																		"2023-01-10": true,
																		"2023-01-11": true, ...
																	}
																  }
																}
 * @param datepick_this			- this of datepick Obj
 *
 * @returns boolean
 */
function wpbc__inline_booking_calendar__on_days_select(dates_selection, calendar_params_arr, datepick_this = null) {
  var inst = jQuery.datepick._getInst(document.getElementById('calendar_booking' + calendar_params_arr.resource_id));
  var dates_arr = []; //  [ "2023-04-09", "2023-04-10", "2023-04-11" ]

  if (-1 !== dates_selection.indexOf('~')) {
    // Range Days

    dates_arr = wpbc_get_dates_arr__from_dates_range_js({
      'dates_separator': ' ~ ',
      //  ' ~ '
      'dates': dates_selection // '2023-04-04 ~ 2023-04-07'
    });
  } else {
    // Multiple Days
    dates_arr = wpbc_get_dates_arr__from_dates_comma_separated_js({
      'dates_separator': ', ',
      //  ', '
      'dates': dates_selection // '2023-04-10, 2023-04-12, 2023-04-02, 2023-04-04'
    });
  }
  wpbc_avy_after_days_selection__show_help_info({
    'calendar__days_selection_mode': calendar_params_arr.calendar__days_selection_mode,
    'dates_arr': dates_arr,
    'dates_click_num': inst.dates.length,
    'popover_hints': calendar_params_arr.popover_hints
  });
  return true;
}

/**
 * Show help info at the top  toolbar about selected dates and future actions
 *
 * @param params
 * 					Example 1:  {
									calendar__days_selection_mode: "dynamic",
									dates_arr:  [ "2023-04-03" ],
									dates_click_num: 1
									'popover_hints'					: calendar_params_arr.popover_hints
								}
 * 					Example 2:  {
									calendar__days_selection_mode: "dynamic"
									dates_arr: Array(10) [ "2023-04-03", "2023-04-04", "2023-04-05", … ]
									dates_click_num: 2
									'popover_hints'					: calendar_params_arr.popover_hints
								}
 */
function wpbc_avy_after_days_selection__show_help_info(params) {
  // console.log( params );	//		[ "2023-04-09", "2023-04-10", "2023-04-11" ]

  var message, color;
  if (jQuery('#ui_btn_avy__set_days_availability__available').is(':checked')) {
    message = params.popover_hints.toolbar_text_available; //'Set dates _DATES_ as _HTML_ available.';
    color = '#11be4c';
  } else {
    message = params.popover_hints.toolbar_text_unavailable; //'Set dates _DATES_ as _HTML_ unavailable.';
    color = '#e43939';
  }
  message = '<span>' + message + '</span>';
  var first_date = params['dates_arr'][0];
  var last_date = 'dynamic' == params.calendar__days_selection_mode ? params['dates_arr'][params['dates_arr'].length - 1] : params['dates_arr'].length > 1 ? params['dates_arr'][1] : '';
  first_date = jQuery.datepick.formatDate('dd M, yy', new Date(first_date + 'T00:00:00'));
  last_date = jQuery.datepick.formatDate('dd M, yy', new Date(last_date + 'T00:00:00'));
  if ('dynamic' == params.calendar__days_selection_mode) {
    if (1 == params.dates_click_num) {
      last_date = '___________';
    } else {
      if ('first_time' == jQuery('.wpbc_ajx_availability_container').attr('wpbc_loaded')) {
        jQuery('.wpbc_ajx_availability_container').attr('wpbc_loaded', 'done');
        wpbc_blink_element('.wpbc_widget_available_unavailable', 3, 220);
      }
    }
    message = message.replace('_DATES_', '</span>'
    //+ '<div>' + 'from' + '</div>'
    + '<span class="wpbc_big_date">' + first_date + '</span>' + '<span>' + '-' + '</span>' + '<span class="wpbc_big_date">' + last_date + '</span>' + '<span>');
  } else {
    // if ( params[ 'dates_arr' ].length > 1 ){
    // 	last_date = ', ' + last_date;
    // 	last_date += ( params[ 'dates_arr' ].length > 2 ) ? ', ...' : '';
    // } else {
    // 	last_date='';
    // }
    var dates_arr = [];
    for (var i = 0; i < params['dates_arr'].length; i++) {
      dates_arr.push(jQuery.datepick.formatDate('dd M yy', new Date(params['dates_arr'][i] + 'T00:00:00')));
    }
    first_date = dates_arr.join(', ');
    message = message.replace('_DATES_', '</span>' + '<span class="wpbc_big_date">' + first_date + '</span>' + '<span>');
  }
  message = message.replace('_HTML_', '</span><span class="wpbc_big_text" style="color:' + color + ';">') + '<span>';

  //message += ' <div style="margin-left: 1em;">' + ' Click on Apply button to apply availability.' + '</div>';

  message = '<div class="wpbc_toolbar_dates_hints">' + message + '</div>';
  jQuery('.wpbc_help_text').html(message);
}

/**
 *   Parse dates  ------------------------------------------------------------------------------------------- */

/**
 * Get dates array,  from comma separated dates
 *
 * @param params       = {
									* 'dates_separator' => ', ',                                        // Dates separator
									* 'dates'           => '2023-04-04, 2023-04-07, 2023-04-05'         // Dates in 'Y-m-d' format: '2023-01-31'
						 }
 *
 * @return array      = [
									* [0] => 2023-04-04
									* [1] => 2023-04-05
									* [2] => 2023-04-06
									* [3] => 2023-04-07
						]
 *
 * Example #1:  wpbc_get_dates_arr__from_dates_comma_separated_js(  {  'dates_separator' : ', ', 'dates' : '2023-04-04, 2023-04-07, 2023-04-05'  }  );
 */
function wpbc_get_dates_arr__from_dates_comma_separated_js(params) {
  var dates_arr = [];
  if ('' !== params['dates']) {
    dates_arr = params['dates'].split(params['dates_separator']);
    dates_arr.sort();
  }
  return dates_arr;
}

/**
 * Get dates array,  from range days selection
 *
 * @param params       =  {
									* 'dates_separator' => ' ~ ',                         // Dates separator
									* 'dates'           => '2023-04-04 ~ 2023-04-07'      // Dates in 'Y-m-d' format: '2023-01-31'
						  }
 *
 * @return array        = [
									* [0] => 2023-04-04
									* [1] => 2023-04-05
									* [2] => 2023-04-06
									* [3] => 2023-04-07
						  ]
 *
 * Example #1:  wpbc_get_dates_arr__from_dates_range_js(  {  'dates_separator' : ' ~ ', 'dates' : '2023-04-04 ~ 2023-04-07'  }  );
 * Example #2:  wpbc_get_dates_arr__from_dates_range_js(  {  'dates_separator' : ' - ', 'dates' : '2023-04-04 - 2023-04-07'  }  );
 */
function wpbc_get_dates_arr__from_dates_range_js(params) {
  var dates_arr = [];
  if ('' !== params['dates']) {
    dates_arr = params['dates'].split(params['dates_separator']);
    var check_in_date_ymd = dates_arr[0];
    var check_out_date_ymd = dates_arr[1];
    if ('' !== check_in_date_ymd && '' !== check_out_date_ymd) {
      dates_arr = wpbc_get_dates_array_from_start_end_days_js(check_in_date_ymd, check_out_date_ymd);
    }
  }
  return dates_arr;
}

/**
 * Get dates array based on start and end dates.
 *
 * @param string sStartDate - start date: 2023-04-09
 * @param string sEndDate   - end date:   2023-04-11
 * @return array             - [ "2023-04-09", "2023-04-10", "2023-04-11" ]
 */
function wpbc_get_dates_array_from_start_end_days_js(sStartDate, sEndDate) {
  sStartDate = new Date(sStartDate + 'T00:00:00');
  sEndDate = new Date(sEndDate + 'T00:00:00');
  var aDays = [];

  // Start the variable off with the start date
  aDays.push(sStartDate.getTime());

  // Set a 'temp' variable, sCurrentDate, with the start date - before beginning the loop
  var sCurrentDate = new Date(sStartDate.getTime());
  var one_day_duration = 24 * 60 * 60 * 1000;

  // While the current date is less than the end date
  while (sCurrentDate < sEndDate) {
    // Add a day to the current date "+1 day"
    sCurrentDate.setTime(sCurrentDate.getTime() + one_day_duration);

    // Add this new day to the aDays array
    aDays.push(sCurrentDate.getTime());
  }
  for (let i = 0; i < aDays.length; i++) {
    aDays[i] = new Date(aDays[i]);
    aDays[i] = aDays[i].getFullYear() + '-' + (aDays[i].getMonth() + 1 < 10 ? '0' : '') + (aDays[i].getMonth() + 1) + '-' + (aDays[i].getDate() < 10 ? '0' : '') + aDays[i].getDate();
  }
  // Once the loop has finished, return the array of days.
  return aDays;
}

/**
 *   Tooltips  ---------------------------------------------------------------------------------------------- */

/**
 * Define showing tooltip,  when  mouse over on  SELECTABLE (available, pending, approved, resource unavailable),  days
 * Can be called directly  from  datepick init function.
 *
 * @param value
 * @param date
 * @param calendar_params_arr
 * @param datepick_this
 * @returns {boolean}
 */
function wpbc_avy__prepare_tooltip__in_calendar(value, date, calendar_params_arr, datepick_this) {
  if (null == date) {
    return false;
  }
  var td_class = date.getMonth() + 1 + '-' + date.getDate() + '-' + date.getFullYear();
  var jCell = jQuery('#calendar_booking' + calendar_params_arr.resource_id + ' td.cal4date-' + td_class);
  wpbc_avy__show_tooltip__for_element(jCell, calendar_params_arr['popover_hints']);
  return true;
}

/**
 * Define tooltip  for showing on UNAVAILABLE days (season, weekday, today_depends unavailable)
 *
 * @param jCell					jQuery of specific day cell
 * @param popover_hints		    Array with tooltip hint texts	 : {'season_unavailable':'...','weekdays_unavailable':'...','before_after_unavailable':'...',}
 */
function wpbc_avy__show_tooltip__for_element(jCell, popover_hints) {
  var tooltip_time = '';
  if (jCell.hasClass('season_unavailable')) {
    tooltip_time = popover_hints['season_unavailable'];
  } else if (jCell.hasClass('weekdays_unavailable')) {
    tooltip_time = popover_hints['weekdays_unavailable'];
  } else if (jCell.hasClass('before_after_unavailable')) {
    tooltip_time = popover_hints['before_after_unavailable'];
  } else if (jCell.hasClass('date2approve')) {} else if (jCell.hasClass('date_approved')) {} else {}
  jCell.attr('data-content', tooltip_time);
  var td_el = jCell.get(0); //jQuery( '#calendar_booking' + calendar_params_arr.resource_id + ' td.cal4date-' + td_class ).get(0);

  if (undefined == td_el._tippy && '' != tooltip_time) {
    wpbc_tippy(td_el, {
      content(reference) {
        var popover_content = reference.getAttribute('data-content');
        return '<div class="popover popover_tippy">' + '<div class="popover-content">' + popover_content + '</div>' + '</div>';
      },
      allowHTML: true,
      trigger: 'mouseenter focus',
      interactive: !true,
      hideOnClick: true,
      interactiveBorder: 10,
      maxWidth: 550,
      theme: 'wpbc-tippy-times',
      placement: 'top',
      delay: [400, 0],
      // FixIn: 9.4.2.2.
      ignoreAttributes: true,
      touch: true,
      //['hold', 500], // 500ms delay			// FixIn: 9.2.1.5.
      appendTo: () => document.body
    });
  }
}

/**
 *   Ajax  ------------------------------------------------------------------------------------------------------ */

/**
 * Send Ajax show request
 */
function wpbc_ajx_availability__ajax_request() {
  console.groupCollapsed('WPBC_AJX_AVAILABILITY');
  console.log(' == Before Ajax Send - search_get_all_params() == ', wpbc_ajx_availability.search_get_all_params());
  wpbc_availability_reload_button__spin_start();

  // Start Ajax
  jQuery.post(wpbc_url_ajax, {
    action: 'WPBC_AJX_AVAILABILITY',
    wpbc_ajx_user_id: wpbc_ajx_availability.get_secure_param('user_id'),
    nonce: wpbc_ajx_availability.get_secure_param('nonce'),
    wpbc_ajx_locale: wpbc_ajx_availability.get_secure_param('locale'),
    search_params: wpbc_ajx_availability.search_get_all_params()
  },
  /**
   * S u c c e s s
   *
   * @param response_data		-	its object returned from  Ajax - class-live-searcg.php
   * @param textStatus		-	'success'
   * @param jqXHR				-	Object
   */
  function (response_data, textStatus, jqXHR) {
    console.log(' == Response WPBC_AJX_AVAILABILITY == ', response_data);
    console.groupEnd();

    // Probably Error
    if (typeof response_data !== 'object' || response_data === null) {
      wpbc_ajx_availability__show_message(response_data);
      return;
    }

    // Reload page, after filter toolbar has been reset
    if (undefined != response_data['ajx_cleaned_params'] && 'reset_done' === response_data['ajx_cleaned_params']['do_action']) {
      location.reload();
      return;
    }

    // Show listing
    wpbc_ajx_availability__page_content__show(response_data['ajx_data'], response_data['ajx_search_params'], response_data['ajx_cleaned_params']);

    //wpbc_ajx_availability__define_ui_hooks();						// Redefine Hooks, because we show new DOM elements
    if ('' != response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />")) {
      wpbc_admin_show_message(response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />"), '1' == response_data['ajx_data']['ajx_after_action_result'] ? 'success' : 'error', 10000);
    }
    wpbc_availability_reload_button__spin_pause();
    // Remove spin icon from  button and Enable this button.
    wpbc_button__remove_spin(response_data['ajx_cleaned_params']['ui_clicked_element_id']);
    jQuery('#ajax_respond').html(response_data); // For ability to show response, add such DIV element to page
  }).fail(function (jqXHR, textStatus, errorThrown) {
    if (window.console && window.console.log) {
      console.log('Ajax_Error', jqXHR, textStatus, errorThrown);
    }
    var error_message = '<strong>' + 'Error!' + '</strong> ' + errorThrown;
    if (jqXHR.status) {
      error_message += ' (<b>' + jqXHR.status + '</b>)';
      if (403 == jqXHR.status) {
        error_message += ' Probably nonce for this page has been expired. Please <a href="javascript:void(0)" onclick="javascript:location.reload();">reload the page</a>.';
      }
    }
    if (jqXHR.responseText) {
      error_message += ' ' + jqXHR.responseText;
    }
    error_message = error_message.replace(/\n/g, "<br />");
    wpbc_ajx_availability__show_message(error_message);
  })
  // .done(   function ( data, textStatus, jqXHR ) {   if ( window.console && window.console.log ){ console.log( 'second success', data, textStatus, jqXHR ); }    })
  // .always( function ( data_jqXHR, textStatus, jqXHR_errorThrown ) {   if ( window.console && window.console.log ){ console.log( 'always finished', data_jqXHR, textStatus, jqXHR_errorThrown ); }     })
  ; // End Ajax
}

/**
 *   H o o k s  -  its Action/Times when need to re-Render Views  ----------------------------------------------- */

/**
 * Send Ajax Search Request after Updating search request parameters
 *
 * @param params_arr
 */
function wpbc_ajx_availability__send_request_with_params(params_arr) {
  // Define different Search  parameters for request
  _.each(params_arr, function (p_val, p_key, p_data) {
    //console.log( 'Request for: ', p_key, p_val );
    wpbc_ajx_availability.search_set_param(p_key, p_val);
  });

  // Send Ajax Request
  wpbc_ajx_availability__ajax_request();
}

/**
 * Search request for "Page Number"
 * @param page_number	int
 */
function wpbc_ajx_availability__pagination_click(page_number) {
  wpbc_ajx_availability__send_request_with_params({
    'page_num': page_number
  });
}

/**
 *   Show / Hide Content  --------------------------------------------------------------------------------------- */

/**
 *  Show Listing Content 	- 	Sending Ajax Request	-	with parameters that  we early  defined
 */
function wpbc_ajx_availability__actual_content__show() {
  wpbc_ajx_availability__ajax_request(); // Send Ajax Request	-	with parameters that  we early  defined in "wpbc_ajx_booking_listing" Obj.
}

/**
 * Hide Listing Content
 */
function wpbc_ajx_availability__actual_content__hide() {
  jQuery(wpbc_ajx_availability.get_other_param('listing_container')).html('');
}

/**
 *   M e s s a g e  --------------------------------------------------------------------------------------------- */

/**
 * Show just message instead of content
 */
function wpbc_ajx_availability__show_message(message) {
  wpbc_ajx_availability__actual_content__hide();
  jQuery(wpbc_ajx_availability.get_other_param('listing_container')).html('<div class="wpbc-settings-notice notice-warning" style="text-align:left">' + message + '</div>');
}

/**
 *   Support Functions - Spin Icon in Buttons  ------------------------------------------------------------------ */

/**
 * Spin button in Filter toolbar  -  Start
 */
function wpbc_availability_reload_button__spin_start() {
  jQuery('#wpbc_availability_reload_button .menu_icon.wpbc_spin').removeClass('wpbc_animation_pause');
}

/**
 * Spin button in Filter toolbar  -  Pause
 */
function wpbc_availability_reload_button__spin_pause() {
  jQuery('#wpbc_availability_reload_button .menu_icon.wpbc_spin').addClass('wpbc_animation_pause');
}

/**
 * Spin button in Filter toolbar  -  is Spinning ?
 *
 * @returns {boolean}
 */
function wpbc_availability_reload_button__is_spin() {
  if (jQuery('#wpbc_availability_reload_button .menu_icon.wpbc_spin').hasClass('wpbc_animation_pause')) {
    return true;
  } else {
    return false;
  }
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHkvX291dC9hdmFpbGFiaWxpdHlfcGFnZS5qcyIsIm5hbWVzIjpbIndwYmNfYWp4X2F2YWlsYWJpbGl0eSIsIm9iaiIsIiQiLCJwX3NlY3VyZSIsInNlY3VyaXR5X29iaiIsInVzZXJfaWQiLCJub25jZSIsImxvY2FsZSIsInNldF9zZWN1cmVfcGFyYW0iLCJwYXJhbV9rZXkiLCJwYXJhbV92YWwiLCJnZXRfc2VjdXJlX3BhcmFtIiwicF9saXN0aW5nIiwic2VhcmNoX3JlcXVlc3Rfb2JqIiwic2VhcmNoX3NldF9hbGxfcGFyYW1zIiwicmVxdWVzdF9wYXJhbV9vYmoiLCJzZWFyY2hfZ2V0X2FsbF9wYXJhbXMiLCJzZWFyY2hfZ2V0X3BhcmFtIiwic2VhcmNoX3NldF9wYXJhbSIsInNlYXJjaF9zZXRfcGFyYW1zX2FyciIsInBhcmFtc19hcnIiLCJfIiwiZWFjaCIsInBfdmFsIiwicF9rZXkiLCJwX2RhdGEiLCJwX290aGVyIiwib3RoZXJfb2JqIiwic2V0X290aGVyX3BhcmFtIiwiZ2V0X290aGVyX3BhcmFtIiwialF1ZXJ5Iiwid3BiY19hanhfYm9va2luZ3MiLCJ3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3BhZ2VfY29udGVudF9fc2hvdyIsImFqeF9kYXRhX2FyciIsImFqeF9zZWFyY2hfcGFyYW1zIiwiYWp4X2NsZWFuZWRfcGFyYW1zIiwidGVtcGxhdGVfX2F2YWlsYWJpbGl0eV9tYWluX3BhZ2VfY29udGVudCIsIndwIiwidGVtcGxhdGUiLCJodG1sIiwicGFyZW50IiwiaGlkZSIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fY2FsZW5kYXJfX3Nob3ciLCJyZXNvdXJjZV9pZCIsImFqeF9ub25jZV9jYWxlbmRhciIsInRyaWdnZXIiLCJjYWxlbmRhcl9wYXJhbXNfYXJyIiwib24iLCJldmVudCIsImluc3QiLCJkcERpdiIsImZpbmQiLCJ0aGlzX2V2ZW50IiwiakNlbGwiLCJjdXJyZW50VGFyZ2V0Iiwid3BiY19hdnlfX3Nob3dfdG9vbHRpcF9fZm9yX2VsZW1lbnQiLCJqQ2FsQ29udGFpbmVyIiwicmVtb3ZlQ2xhc3MiLCJjYWxlbmRhcl9fdmlld19fY2VsbF9oZWlnaHQiLCJhcHBlbmQiLCJ3aWR0aCIsImNhbGVuZGFyX192aWV3X193aWR0aCIsInVuZGVmaW5lZCIsImNhbGVuZGFyX192aWV3X19tYXhfd2lkdGgiLCJjYWxlbmRhcl9fdmlld19fbW9udGhzX2luX3JvdyIsImNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRocyIsImNhbF9wYXJhbV9hcnIiLCJjYWxlbmRhcl9fc3RhcnRfd2Vla19kYXkiLCJjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSIsImJvb2tlZF9kYXRlcyIsInNlYXNvbl9hdmFpbGFiaWxpdHkiLCJyZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcyIsIndwYmNfc2hvd19pbmxpbmVfYm9va2luZ19jYWxlbmRhciIsIndwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19vbl9kYXlzX3NlbGVjdCIsInRleHRfaWQiLCJ2YWwiLCJwb3BvdmVyX2hpbnRzIiwidG9vbGJhcl90ZXh0IiwiaHRtbF9pZCIsImxlbmd0aCIsImhhc0NsYXNzIiwidGV4dCIsImRhdGVwaWNrIiwiYmVmb3JlU2hvd0RheSIsImRhdGUiLCJ3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fYXBwbHlfY3NzX3RvX2RheXMiLCJvblNlbGVjdCIsIm9uSG92ZXIiLCJ2YWx1ZSIsIndwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19vbl9kYXlzX2hvdmVyIiwib25DaGFuZ2VNb250aFllYXIiLCJzaG93T24iLCJudW1iZXJPZk1vbnRocyIsInN0ZXBNb250aHMiLCJwcmV2VGV4dCIsIm5leHRUZXh0IiwiZGF0ZUZvcm1hdCIsImNoYW5nZU1vbnRoIiwiY2hhbmdlWWVhciIsIm1pbkRhdGUiLCJtYXhEYXRlIiwic2hvd1N0YXR1cyIsImNsb3NlQXRUb3AiLCJmaXJzdERheSIsImdvdG9DdXJyZW50IiwiaGlkZUlmTm9QcmV2TmV4dCIsIm11bHRpU2VwYXJhdG9yIiwibXVsdGlTZWxlY3QiLCJyYW5nZVNlbGVjdCIsInJhbmdlU2VwYXJhdG9yIiwidXNlVGhlbWVSb2xsZXIiLCJkYXRlcGlja190aGlzIiwidG9kYXlfZGF0ZSIsIkRhdGUiLCJfd3BiYyIsInBhcnNlSW50IiwicmVhbF90b2RheV9kYXRlIiwiY2xhc3NfZGF5IiwiZ2V0TW9udGgiLCJnZXREYXRlIiwiZ2V0RnVsbFllYXIiLCJzcWxfY2xhc3NfZGF5Iiwid3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSIsImNzc19kYXRlX19zdGFuZGFyZCIsImNzc19kYXRlX19hZGRpdGlvbmFsIiwiZ2V0RGF5IiwiaSIsImRhdGVfbWlkbmlnaHQiLCJnZXRUaW1lIiwid3BiY19kYXRlc19fZGF5c19iZXR3ZWVuIiwiaXNfZGF0ZV9hdmFpbGFibGUiLCJ3cGJjX2luX2FycmF5IiwiYm9va2luZ3NfaW5fZGF0ZSIsImFwcHJvdmVkIiwiT2JqZWN0Iiwia2V5cyIsImlzX2FwcHJvdmVkIiwidHMiLCJib29raW5nX2RhdGUiLCJzdWJzdHJpbmciLCJfZ2V0SW5zdCIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJkYXRlcyIsInRkX2NsYXNzIiwidGRfb3ZlcnMiLCJpc19jaGVjayIsInNlbGNldGVkX2ZpcnN0X2RheSIsInNldEZ1bGxZZWFyIiwiYWRkQ2xhc3MiLCJkYXRlc19zZWxlY3Rpb24iLCJkYXRlc19hcnIiLCJpbmRleE9mIiwid3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX3JhbmdlX2pzIiwid3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX2NvbW1hX3NlcGFyYXRlZF9qcyIsIndwYmNfYXZ5X2FmdGVyX2RheXNfc2VsZWN0aW9uX19zaG93X2hlbHBfaW5mbyIsInBhcmFtcyIsIm1lc3NhZ2UiLCJjb2xvciIsImlzIiwidG9vbGJhcl90ZXh0X2F2YWlsYWJsZSIsInRvb2xiYXJfdGV4dF91bmF2YWlsYWJsZSIsImZpcnN0X2RhdGUiLCJsYXN0X2RhdGUiLCJmb3JtYXREYXRlIiwiZGF0ZXNfY2xpY2tfbnVtIiwiYXR0ciIsIndwYmNfYmxpbmtfZWxlbWVudCIsInJlcGxhY2UiLCJwdXNoIiwiam9pbiIsInNwbGl0Iiwic29ydCIsImNoZWNrX2luX2RhdGVfeW1kIiwiY2hlY2tfb3V0X2RhdGVfeW1kIiwid3BiY19nZXRfZGF0ZXNfYXJyYXlfZnJvbV9zdGFydF9lbmRfZGF5c19qcyIsInNTdGFydERhdGUiLCJzRW5kRGF0ZSIsImFEYXlzIiwic0N1cnJlbnREYXRlIiwib25lX2RheV9kdXJhdGlvbiIsInNldFRpbWUiLCJ3cGJjX2F2eV9fcHJlcGFyZV90b29sdGlwX19pbl9jYWxlbmRhciIsInRvb2x0aXBfdGltZSIsInRkX2VsIiwiZ2V0IiwiX3RpcHB5Iiwid3BiY190aXBweSIsImNvbnRlbnQiLCJyZWZlcmVuY2UiLCJwb3BvdmVyX2NvbnRlbnQiLCJnZXRBdHRyaWJ1dGUiLCJhbGxvd0hUTUwiLCJpbnRlcmFjdGl2ZSIsImhpZGVPbkNsaWNrIiwiaW50ZXJhY3RpdmVCb3JkZXIiLCJtYXhXaWR0aCIsInRoZW1lIiwicGxhY2VtZW50IiwiZGVsYXkiLCJpZ25vcmVBdHRyaWJ1dGVzIiwidG91Y2giLCJhcHBlbmRUbyIsImJvZHkiLCJ3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2FqYXhfcmVxdWVzdCIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsIndwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQiLCJwb3N0Iiwid3BiY191cmxfYWpheCIsImFjdGlvbiIsIndwYmNfYWp4X3VzZXJfaWQiLCJ3cGJjX2FqeF9sb2NhbGUiLCJzZWFyY2hfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwid3BiY19hanhfYXZhaWxhYmlsaXR5X19zaG93X21lc3NhZ2UiLCJsb2NhdGlvbiIsInJlbG9hZCIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwid3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiIsImZhaWwiLCJlcnJvclRocm93biIsIndpbmRvdyIsImVycm9yX21lc3NhZ2UiLCJzdGF0dXMiLCJyZXNwb25zZVRleHQiLCJ3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fcGFnaW5hdGlvbl9jbGljayIsInBhZ2VfbnVtYmVyIiwid3BiY19hanhfYXZhaWxhYmlsaXR5X19hY3R1YWxfY29udGVudF9fc2hvdyIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fYWN0dWFsX2NvbnRlbnRfX2hpZGUiLCJ3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uX19pc19zcGluIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHkvX3NyYy9hdmFpbGFiaWxpdHlfcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBSZXF1ZXN0IE9iamVjdFxyXG4gKiBIZXJlIHdlIGNhbiAgZGVmaW5lIFNlYXJjaCBwYXJhbWV0ZXJzIGFuZCBVcGRhdGUgaXQgbGF0ZXIsICB3aGVuICBzb21lIHBhcmFtZXRlciB3YXMgY2hhbmdlZFxyXG4gKlxyXG4gKi9cclxuXHJcbnZhciB3cGJjX2FqeF9hdmFpbGFiaWxpdHkgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gU2VjdXJlIHBhcmFtZXRlcnMgZm9yIEFqYXhcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlY3VyZSA9IG9iai5zZWN1cml0eV9vYmogPSBvYmouc2VjdXJpdHlfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcl9pZDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bm9uY2UgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsZSA6ICcnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH07XHJcblxyXG5cdG9iai5zZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfc2VjdXJlWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfc2VjdXJlWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gTGlzdGluZyBTZWFyY2ggcGFyYW1ldGVyc1x0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfbGlzdGluZyA9IG9iai5zZWFyY2hfcmVxdWVzdF9vYmogPSBvYmouc2VhcmNoX3JlcXVlc3Rfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc29ydCAgICAgICAgICAgIDogXCJib29raW5nX2lkXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvcnRfdHlwZSAgICAgICA6IFwiREVTQ1wiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBwYWdlX251bSAgICAgICAgOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBwYWdlX2l0ZW1zX2NvdW50OiAxMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY3JlYXRlX2RhdGUgICAgIDogXCJcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8ga2V5d29yZCAgICAgICAgIDogXCJcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc291cmNlICAgICAgICAgIDogXCJcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfYWxsX3BhcmFtcyA9IGZ1bmN0aW9uICggcmVxdWVzdF9wYXJhbV9vYmogKSB7XHJcblx0XHRwX2xpc3RpbmcgPSByZXF1ZXN0X3BhcmFtX29iajtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX2dldF9hbGxfcGFyYW1zID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfbGlzdGluZztcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX2dldF9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfbGlzdGluZ1sgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0Ly8gaWYgKCBBcnJheS5pc0FycmF5KCBwYXJhbV92YWwgKSApe1xyXG5cdFx0Ly8gXHRwYXJhbV92YWwgPSBKU09OLnN0cmluZ2lmeSggcGFyYW1fdmFsICk7XHJcblx0XHQvLyB9XHJcblx0XHRwX2xpc3RpbmdbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X3BhcmFtc19hcnIgPSBmdW5jdGlvbiggcGFyYW1zX2FyciApe1xyXG5cdFx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRGVmaW5lIGRpZmZlcmVudCBTZWFyY2ggIHBhcmFtZXRlcnMgZm9yIHJlcXVlc3RcclxuXHRcdFx0dGhpcy5zZWFyY2hfc2V0X3BhcmFtKCBwX2tleSwgcF92YWwgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyBPdGhlciBwYXJhbWV0ZXJzIFx0XHRcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX290aGVyID0gb2JqLm90aGVyX29iaiA9IG9iai5vdGhlcl9vYmogfHwgeyB9O1xyXG5cclxuXHRvYmouc2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfb3RoZXJbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX290aGVyWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0cmV0dXJuIG9iajtcclxufSggd3BiY19hanhfYXZhaWxhYmlsaXR5IHx8IHt9LCBqUXVlcnkgKSk7XHJcblxyXG52YXIgd3BiY19hanhfYm9va2luZ3MgPSBbXTtcclxuXHJcbi8qKlxyXG4gKiAgIFNob3cgQ29udGVudCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNob3cgQ29udGVudCAtIENhbGVuZGFyIGFuZCBVSSBlbGVtZW50c1xyXG4gKlxyXG4gKiBAcGFyYW0gYWp4X2RhdGFfYXJyXHJcbiAqIEBwYXJhbSBhanhfc2VhcmNoX3BhcmFtc1xyXG4gKiBAcGFyYW0gYWp4X2NsZWFuZWRfcGFyYW1zXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3BhZ2VfY29udGVudF9fc2hvdyggYWp4X2RhdGFfYXJyLCBhanhfc2VhcmNoX3BhcmFtcyAsIGFqeF9jbGVhbmVkX3BhcmFtcyApe1xyXG5cclxuXHR2YXIgdGVtcGxhdGVfX2F2YWlsYWJpbGl0eV9tYWluX3BhZ2VfY29udGVudCA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfYXZhaWxhYmlsaXR5X21haW5fcGFnZV9jb250ZW50JyApO1xyXG5cclxuXHQvLyBDb250ZW50XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKCB0ZW1wbGF0ZV9fYXZhaWxhYmlsaXR5X21haW5fcGFnZV9jb250ZW50KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9kYXRhJyAgICAgICAgICAgICAgOiBhanhfZGF0YV9hcnIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9zZWFyY2hfcGFyYW1zJyAgICAgOiBhanhfc2VhcmNoX3BhcmFtcyxcdFx0XHRcdFx0XHRcdFx0Ly8gJF9SRVFVRVNUWyAnc2VhcmNoX3BhcmFtcycgXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfY2xlYW5lZF9wYXJhbXMnICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0gKSApO1xyXG5cclxuXHRqUXVlcnkoICcud3BiY19wcm9jZXNzaW5nLndwYmNfc3BpbicpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICkuaGlkZSgpO1xyXG5cdC8vIExvYWQgY2FsZW5kYXJcclxuXHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2NhbGVuZGFyX19zaG93KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnICAgICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcic6IGFqeF9kYXRhX2Fyci5hanhfbm9uY2VfY2FsZW5kYXIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2RhdGFfYXJyJyAgICAgICAgICA6IGFqeF9kYXRhX2FycixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfY2xlYW5lZF9wYXJhbXMnICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogVHJpZ2dlciBmb3IgZGF0ZXMgc2VsZWN0aW9uIGluIHRoZSBib29raW5nIGZvcm1cclxuXHQgKlxyXG5cdCAqIGpRdWVyeSggd3BiY19hanhfYXZhaWxhYmlsaXR5LmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkub24oJ3dwYmNfcGFnZV9jb250ZW50X2xvYWRlZCcsIGZ1bmN0aW9uKGV2ZW50LCBhanhfZGF0YV9hcnIsIGFqeF9zZWFyY2hfcGFyYW1zICwgYWp4X2NsZWFuZWRfcGFyYW1zKSB7IC4uLiB9ICk7XHJcblx0ICovXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS50cmlnZ2VyKCAnd3BiY19wYWdlX2NvbnRlbnRfbG9hZGVkJywgWyBhanhfZGF0YV9hcnIsIGFqeF9zZWFyY2hfcGFyYW1zICwgYWp4X2NsZWFuZWRfcGFyYW1zIF0gKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaG93IGlubGluZSBtb250aCB2aWV3IGNhbGVuZGFyICAgICAgICAgICAgICB3aXRoIGFsbCBwcmVkZWZpbmVkIENTUyAoc2l6ZXMgYW5kIGNoZWNrIGluL291dCwgIHRpbWVzIGNvbnRhaW5lcnMpXHJcbiAqIEBwYXJhbSB7b2JqfSBjYWxlbmRhcl9wYXJhbXNfYXJyXHJcblx0XHRcdHtcclxuXHRcdFx0XHQncmVzb3VyY2VfaWQnICAgICAgIFx0OiBhanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcidcdDogYWp4X2RhdGFfYXJyLmFqeF9ub25jZV9jYWxlbmRhcixcclxuXHRcdFx0XHQnYWp4X2RhdGFfYXJyJyAgICAgICAgICA6IGFqeF9kYXRhX2FyciA9IHsgYWp4X2Jvb2tpbmdfcmVzb3VyY2VzOltdLCBib29rZWRfZGF0ZXM6IHt9LCByZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlczpbXSwgc2Vhc29uX2F2YWlsYWJpbGl0eTp7fSwuLi4uIH1cclxuXHRcdFx0XHQnYWp4X2NsZWFuZWRfcGFyYW1zJyAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlOiBcImR5bmFtaWNcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5OiBcIjBcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3ZpZXdfX2NlbGxfaGVpZ2h0OiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjYWxlbmRhcl9fdmlld19fbW9udGhzX2luX3JvdzogNFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzOiAxMlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3ZpZXdfX3dpZHRoOiBcIjEwMCVcIlxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRhdGVzX2F2YWlsYWJpbGl0eTogXCJ1bmF2YWlsYWJsZVwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19zZWxlY3Rpb246IFwiMjAyMy0wMy0xNCB+IDIwMjMtMDMtMTZcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZG9fYWN0aW9uOiBcInNldF9hdmFpbGFiaWxpdHlcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cmVzb3VyY2VfaWQ6IDFcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVpX2NsaWNrZWRfZWxlbWVudF9pZDogXCJ3cGJjX2F2YWlsYWJpbGl0eV9hcHBseV9idG5cIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dWlfdXNyX19hdmFpbGFiaWxpdHlfc2VsZWN0ZWRfdG9vbGJhcjogXCJpbmZvXCJcclxuXHRcdFx0XHRcdFx0XHRcdCAgXHRcdCB9XHJcblx0XHRcdH1cclxuKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19jYWxlbmRhcl9fc2hvdyggY2FsZW5kYXJfcGFyYW1zX2FyciApe1xyXG5cclxuXHQvLyBVcGRhdGUgbm9uY2VcclxuXHRqUXVlcnkoICcjYWp4X25vbmNlX2NhbGVuZGFyX3NlY3Rpb24nICkuaHRtbCggY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfbm9uY2VfY2FsZW5kYXIgKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBVcGRhdGUgYm9va2luZ3NcclxuXHRpZiAoICd1bmRlZmluZWQnID09IHR5cGVvZiAod3BiY19hanhfYm9va2luZ3NbIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgXSkgKXsgd3BiY19hanhfYm9va2luZ3NbIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgXSA9IFtdOyB9XHJcblx0d3BiY19hanhfYm9va2luZ3NbIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgXSA9IGNhbGVuZGFyX3BhcmFtc19hcnJbICdhanhfZGF0YV9hcnInIF1bICdib29rZWRfZGF0ZXMnIF07XHJcblxyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIERlZmluZSBzaG93aW5nIG1vdXNlIG92ZXIgdG9vbHRpcCBvbiB1bmF2YWlsYWJsZSBkYXRlc1xyXG5cdCAqIEl0J3MgZGVmaW5lZCwgd2hlbiBjYWxlbmRhciBSRUZSRVNIRUQgKGNoYW5nZSBtb250aHMgb3IgZGF5cyBzZWxlY3Rpb24pIGxvYWRlZCBpbiBqcXVlcnkuZGF0ZXBpY2sud3BiYy45LjAuanMgOlxyXG5cdCAqIFx0XHQkKCAnYm9keScgKS50cmlnZ2VyKCAnd3BiY19kYXRlcGlja19pbmxpbmVfY2FsZW5kYXJfcmVmcmVzaCcsIC4uLlx0XHQvLyBGaXhJbjogOS40LjQuMTMuXHJcblx0ICovXHJcblx0alF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfZGF0ZXBpY2tfaW5saW5lX2NhbGVuZGFyX3JlZnJlc2gnLCBmdW5jdGlvbiAoIGV2ZW50LCByZXNvdXJjZV9pZCwgaW5zdCApe1xyXG5cdFx0Ly8gaW5zdC5kcERpdiAgaXQnczogIDxkaXYgY2xhc3M9XCJkYXRlcGljay1pbmxpbmUgZGF0ZXBpY2stbXVsdGlcIiBzdHlsZT1cIndpZHRoOiAxNzcxMnB4O1wiPi4uLi48L2Rpdj5cclxuXHRcdGluc3QuZHBEaXYuZmluZCggJy5zZWFzb25fdW5hdmFpbGFibGUsLmJlZm9yZV9hZnRlcl91bmF2YWlsYWJsZSwud2Vla2RheXNfdW5hdmFpbGFibGUnICkub24oICdtb3VzZW92ZXInLCBmdW5jdGlvbiAoIHRoaXNfZXZlbnQgKXtcclxuXHRcdFx0Ly8gYWxzbyBhdmFpbGFibGUgdGhlc2UgdmFyczogXHRyZXNvdXJjZV9pZCwgakNhbENvbnRhaW5lciwgaW5zdFxyXG5cdFx0XHR2YXIgakNlbGwgPSBqUXVlcnkoIHRoaXNfZXZlbnQuY3VycmVudFRhcmdldCApO1xyXG5cdFx0XHR3cGJjX2F2eV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCggakNlbGwsIGNhbGVuZGFyX3BhcmFtc19hcnJbICdhanhfZGF0YV9hcnInIF1bJ3BvcG92ZXJfaGludHMnXSApO1xyXG5cdFx0fSk7XHJcblxyXG5cdH1cdCk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIGhlaWdodCBvZiB0aGUgY2FsZW5kYXIgIGNlbGxzLCBcdGFuZCAgbW91c2Ugb3ZlciB0b29sdGlwcyBhdCAgc29tZSB1bmF2YWlsYWJsZSBkYXRlc1xyXG5cdCAqIEl0J3MgZGVmaW5lZCwgd2hlbiBjYWxlbmRhciBsb2FkZWQgaW4ganF1ZXJ5LmRhdGVwaWNrLndwYmMuOS4wLmpzIDpcclxuXHQgKiBcdFx0JCggJ2JvZHknICkudHJpZ2dlciggJ3dwYmNfZGF0ZXBpY2tfaW5saW5lX2NhbGVuZGFyX2xvYWRlZCcsIC4uLlx0XHQvLyBGaXhJbjogOS40LjQuMTIuXHJcblx0ICovXHJcblx0alF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfZGF0ZXBpY2tfaW5saW5lX2NhbGVuZGFyX2xvYWRlZCcsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBqQ2FsQ29udGFpbmVyLCBpbnN0ICl7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIGhpZ2hsaWdodCBkYXkgZm9yIHRvZGF5ICBkYXRlXHJcblx0XHRqUXVlcnkoICcuZGF0ZXBpY2stZGF5cy1jZWxsLmRhdGVwaWNrLXRvZGF5LmRhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApLnJlbW92ZUNsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7XHJcblxyXG5cdFx0Ly8gU2V0IGhlaWdodCBvZiBjYWxlbmRhciAgY2VsbHMgaWYgZGVmaW5lZCB0aGlzIG9wdGlvbiAgLy8gRml4SW46IDEwLjEyLjQuMi5cclxuXHRcdGlmICggJycgIT09IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19jZWxsX2hlaWdodCApe1xyXG5cdFx0XHRqUXVlcnkoICdoZWFkJyApLmFwcGVuZCggJzxzdHlsZSB0eXBlPVwidGV4dC9jc3NcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnLmhhc0RhdGVwaWNrIC5kYXRlcGljay1pbmxpbmUgLmRhdGVwaWNrLXRpdGxlLXJvdyB0aCwgJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsgJy5oYXNEYXRlcGljayAuZGF0ZXBpY2staW5saW5lIC5kYXRlcGljay1kYXlzLWNlbGwgeydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJ21heC1oZWlnaHQ6ICcgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fY2VsbF9oZWlnaHQgKyAnICFpbXBvcnRhbnQ7J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsgJ30nXHJcblx0XHRcdFx0XHRcdFx0XHRcdCsnPC9zdHlsZT4nICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRGVmaW5lIHNob3dpbmcgbW91c2Ugb3ZlciB0b29sdGlwIG9uIHVuYXZhaWxhYmxlIGRhdGVzXHJcblx0XHRqQ2FsQ29udGFpbmVyLmZpbmQoICcuc2Vhc29uX3VuYXZhaWxhYmxlLC5iZWZvcmVfYWZ0ZXJfdW5hdmFpbGFibGUsLndlZWtkYXlzX3VuYXZhaWxhYmxlJyApLm9uKCAnbW91c2VvdmVyJywgZnVuY3Rpb24gKCB0aGlzX2V2ZW50ICl7XHJcblx0XHRcdC8vIGFsc28gYXZhaWxhYmxlIHRoZXNlIHZhcnM6IFx0cmVzb3VyY2VfaWQsIGpDYWxDb250YWluZXIsIGluc3RcclxuXHRcdFx0dmFyIGpDZWxsID0galF1ZXJ5KCB0aGlzX2V2ZW50LmN1cnJlbnRUYXJnZXQgKTtcclxuXHRcdFx0d3BiY19hdnlfX3Nob3dfdG9vbHRpcF9fZm9yX2VsZW1lbnQoIGpDZWxsLCBjYWxlbmRhcl9wYXJhbXNfYXJyWyAnYWp4X2RhdGFfYXJyJyBdWydwb3BvdmVyX2hpbnRzJ10gKTtcclxuXHRcdH0pO1xyXG5cdH0gKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBEZWZpbmUgd2lkdGggb2YgZW50aXJlIGNhbGVuZGFyXHJcblx0dmFyIHdpZHRoID0gICAnd2lkdGg6J1x0XHQrICAgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX3dpZHRoICsgJzsnO1x0XHRcdFx0XHQvLyB2YXIgd2lkdGggPSAnd2lkdGg6MTAwJTttYXgtd2lkdGg6MTAwJTsnO1xyXG5cclxuXHRpZiAoICAgKCB1bmRlZmluZWQgIT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX21heF93aWR0aCApXHJcblx0XHQmJiAoICcnICE9IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19tYXhfd2lkdGggKVxyXG5cdCl7XHJcblx0XHR3aWR0aCArPSAnbWF4LXdpZHRoOicgXHQrIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19tYXhfd2lkdGggKyAnOyc7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdpZHRoICs9ICdtYXgtd2lkdGg6JyBcdCsgKCBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fbW9udGhzX2luX3JvdyAqIDM0MSApICsgJ3B4Oyc7XHJcblx0fVxyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEFkZCBjYWxlbmRhciBjb250YWluZXI6IFwiQ2FsZW5kYXIgaXMgbG9hZGluZy4uLlwiICBhbmQgdGV4dGFyZWFcclxuXHRqUXVlcnkoICcud3BiY19hanhfYXZ5X19jYWxlbmRhcicgKS5odG1sKFxyXG5cclxuXHRcdCc8ZGl2IGNsYXNzPVwiJ1x0KyAnIGJrX2NhbGVuZGFyX2ZyYW1lJ1xyXG5cdFx0XHRcdFx0XHQrICcgbW9udGhzX251bV9pbl9yb3dfJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19tb250aHNfaW5fcm93XHJcblx0XHRcdFx0XHRcdCsgJyBjYWxfbW9udGhfbnVtXycgXHQrIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRoc1xyXG5cdFx0XHRcdCsgJ1wiICdcclxuXHRcdFx0KyAnc3R5bGU9XCInICsgd2lkdGggKyAnXCI+J1xyXG5cclxuXHRcdFx0XHQrICc8ZGl2IGlkPVwiY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJ1wiPicgKyAnQ2FsZW5kYXIgaXMgbG9hZGluZy4uLicgKyAnPC9kaXY+J1xyXG5cclxuXHRcdCsgJzwvZGl2PidcclxuXHJcblx0XHQrICc8dGV4dGFyZWEgICAgICBpZD1cImRhdGVfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJ1wiJ1xyXG5cdFx0XHRcdFx0KyAnIG5hbWU9XCJkYXRlX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCArICdcIidcclxuXHRcdFx0XHRcdCsgJyBhdXRvY29tcGxldGU9XCJvZmZcIidcclxuXHRcdFx0XHRcdCsgJyBzdHlsZT1cImRpc3BsYXk6bm9uZTt3aWR0aDoxMDAlO2hlaWdodDoxMGVtO21hcmdpbjoyZW0gMCAwO1wiPjwvdGV4dGFyZWE+J1xyXG5cdCk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGNhbF9wYXJhbV9hcnIgPSB7XHJcblx0XHRcdFx0XHRcdFx0J2h0bWxfaWQnICAgICAgICAgICA6ICdjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdCd0ZXh0X2lkJyAgICAgICAgICAgOiAnZGF0ZV9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cclxuXHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5JzogXHQgIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX19zdGFydF93ZWVrX2RheSxcclxuXHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzJzogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzLFxyXG5cdFx0XHRcdFx0XHRcdCdjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSc6ICBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSxcclxuXHJcblx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX2lkJyAgICAgICAgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRcdFx0XHQnYWp4X25vbmNlX2NhbGVuZGFyJyA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLmFqeF9ub25jZV9jYWxlbmRhcixcclxuXHRcdFx0XHRcdFx0XHQnYm9va2VkX2RhdGVzJyAgICAgICA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLmJvb2tlZF9kYXRlcyxcclxuXHRcdFx0XHRcdFx0XHQnc2Vhc29uX2F2YWlsYWJpbGl0eSc6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnNlYXNvbl9hdmFpbGFiaWxpdHksXHJcblxyXG5cdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcycgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5yZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcyxcclxuXHJcblx0XHRcdFx0XHRcdFx0J3BvcG92ZXJfaGludHMnOiBjYWxlbmRhcl9wYXJhbXNfYXJyWyAnYWp4X2RhdGFfYXJyJyBdWydwb3BvdmVyX2hpbnRzJ11cdFx0Ly8geydzZWFzb25fdW5hdmFpbGFibGUnOicuLi4nLCd3ZWVrZGF5c191bmF2YWlsYWJsZSc6Jy4uLicsJ2JlZm9yZV9hZnRlcl91bmF2YWlsYWJsZSc6Jy4uLicsfVxyXG5cdFx0XHRcdFx0XHR9O1xyXG5cdHdwYmNfc2hvd19pbmxpbmVfYm9va2luZ19jYWxlbmRhciggY2FsX3BhcmFtX2FyciApO1xyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIE9uIGNsaWNrIEFWQUlMQUJMRSB8ICBVTkFWQUlMQUJMRSBidXR0b24gIGluIHdpZGdldFx0LVx0bmVlZCB0byAgY2hhbmdlIGhlbHAgZGF0ZXMgdGV4dFxyXG5cdCAqL1xyXG5cdGpRdWVyeSggJy53cGJjX3JhZGlvX19zZXRfZGF5c19hdmFpbGFiaWxpdHknICkub24oJ2NoYW5nZScsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBpbnN0ICl7XHJcblx0XHR3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19zZWxlY3QoIGpRdWVyeSggJyMnICsgY2FsX3BhcmFtX2Fyci50ZXh0X2lkICkudmFsKCkgLCBjYWxfcGFyYW1fYXJyICk7XHJcblx0fSk7XHJcblxyXG5cdC8vIFNob3cgXHQnU2VsZWN0IGRheXMgIGluIGNhbGVuZGFyIHRoZW4gc2VsZWN0IEF2YWlsYWJsZSAgLyAgVW5hdmFpbGFibGUgc3RhdHVzIGFuZCBjbGljayBBcHBseSBhdmFpbGFiaWxpdHkgYnV0dG9uLidcclxuXHRqUXVlcnkoICcjd3BiY190b29sYmFyX2RhdGVzX2hpbnQnKS5odG1sKCAgICAgJzxkaXYgY2xhc3M9XCJ1aV9lbGVtZW50XCI+PHNwYW4gY2xhc3M9XCJ3cGJjX3VpX2NvbnRyb2wgd3BiY191aV9hZGRvbiB3cGJjX2hlbHBfdGV4dFwiID4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyBjYWxfcGFyYW1fYXJyLnBvcG92ZXJfaGludHMudG9vbGJhcl90ZXh0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzwvc3Bhbj48L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFx0TG9hZCBEYXRlcGljayBJbmxpbmUgY2FsZW5kYXJcclxuICpcclxuICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0ZXhhbXBsZTp7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaHRtbF9pZCcgICAgICAgICAgIDogJ2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGV4dF9pZCcgICAgICAgICAgIDogJ2RhdGVfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5JzogXHQgIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX19zdGFydF93ZWVrX2RheSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHMnOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUnOiAgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUsXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX2lkJyAgICAgICAgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfbm9uY2VfY2FsZW5kYXInIDogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfZGF0YV9hcnIuYWp4X25vbmNlX2NhbGVuZGFyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tlZF9kYXRlcycgICAgICAgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5ib29rZWRfZGF0ZXMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2Vhc29uX2F2YWlsYWJpbGl0eSc6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnNlYXNvbl9hdmFpbGFiaWxpdHksXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzJyA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnJlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2hvd19pbmxpbmVfYm9va2luZ19jYWxlbmRhciggY2FsZW5kYXJfcGFyYW1zX2FyciApe1xyXG5cclxuXHRpZiAoXHJcblx0XHQgICAoIDAgPT09IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkubGVuZ3RoIClcdFx0XHRcdFx0XHRcdC8vIElmIGNhbGVuZGFyIERPTSBlbGVtZW50IG5vdCBleGlzdCB0aGVuIGV4aXN0XHJcblx0XHR8fCAoIHRydWUgPT09IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkuaGFzQ2xhc3MoICdoYXNEYXRlcGljaycgKSApXHQvLyBJZiB0aGUgY2FsZW5kYXIgd2l0aCB0aGUgc2FtZSBCb29raW5nIHJlc291cmNlIGFscmVhZHkgIGhhcyBiZWVuIGFjdGl2YXRlZCwgdGhlbiBleGlzdC5cclxuXHQpe1xyXG5cdCAgIHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ29uZmlndXJlIGFuZCBzaG93IGNhbGVuZGFyXHJcblx0alF1ZXJ5KCAnIycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmh0bWxfaWQgKS50ZXh0KCAnJyApO1xyXG5cdGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkuZGF0ZXBpY2soe1xyXG5cdFx0XHRcdFx0YmVmb3JlU2hvd0RheTogXHRmdW5jdGlvbiAoIGRhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzKCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcbiAgICAgICAgICAgICAgICAgICAgb25TZWxlY3Q6IFx0ICBcdGZ1bmN0aW9uICggZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci50ZXh0X2lkICkudmFsKCBkYXRlICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly93cGJjX2JsaW5rX2VsZW1lbnQoJy53cGJjX3dpZGdldF9hdmFpbGFibGVfdW5hdmFpbGFibGUnLCAzLCAyMjApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19zZWxlY3QoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIHRoaXMgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuICAgICAgICAgICAgICAgICAgICBvbkhvdmVyOiBcdFx0ZnVuY3Rpb24gKCB2YWx1ZSwgZGF0ZSApe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL3dwYmNfYXZ5X19wcmVwYXJlX3Rvb2x0aXBfX2luX2NhbGVuZGFyKCB2YWx1ZSwgZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgdGhpcyApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfaG92ZXIoIHZhbHVlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2VNb250aFllYXI6XHRudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgIHNob3dPbjogXHRcdFx0J2JvdGgnLFxyXG4gICAgICAgICAgICAgICAgICAgIG51bWJlck9mTW9udGhzOiBcdGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzLFxyXG4gICAgICAgICAgICAgICAgICAgIHN0ZXBNb250aHM6XHRcdFx0MSxcclxuICAgICAgICAgICAgICAgICAgICAvLyBwcmV2VGV4dDogXHRcdFx0JyZsYXF1bzsnLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIG5leHRUZXh0OiBcdFx0XHQnJnJhcXVvOycsXHJcblx0XHRcdFx0XHRwcmV2VGV4dCAgICAgIDogJyZsc2FxdW87JyxcclxuXHRcdFx0XHRcdG5leHRUZXh0ICAgICAgOiAnJnJzYXF1bzsnLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGVGb3JtYXQ6IFx0XHQneXktbW0tZGQnLC8vICdkZC5tbS55eScsXHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlTW9udGg6IFx0XHRmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VZZWFyOiBcdFx0ZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgbWluRGF0ZTogXHRcdFx0XHRcdCAwLFx0XHQvL251bGwsICAvL1Njcm9sbCBhcyBsb25nIGFzIHlvdSBuZWVkXHJcblx0XHRcdFx0XHRtYXhEYXRlOiBcdFx0XHRcdFx0JzEweScsXHQvLyBtaW5EYXRlOiBuZXcgRGF0ZSgyMDIwLCAyLCAxKSwgbWF4RGF0ZTogbmV3IERhdGUoMjAyMCwgOSwgMzEpLCBcdC8vIEFiaWxpdHkgdG8gc2V0IGFueSAgc3RhcnQgYW5kIGVuZCBkYXRlIGluIGNhbGVuZGFyXHJcbiAgICAgICAgICAgICAgICAgICAgc2hvd1N0YXR1czogXHRcdGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGNsb3NlQXRUb3A6IFx0XHRmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBmaXJzdERheTpcdFx0XHRjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19zdGFydF93ZWVrX2RheSxcclxuICAgICAgICAgICAgICAgICAgICBnb3RvQ3VycmVudDogXHRcdGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGhpZGVJZk5vUHJldk5leHQ6XHR0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIG11bHRpU2VwYXJhdG9yOiBcdCcsICcsXHJcblx0XHRcdFx0XHRtdWx0aVNlbGVjdDogKCgnZHluYW1pYycgPT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSkgPyAwIDogMzY1KSxcdFx0XHQvLyBNYXhpbXVtIG51bWJlciBvZiBzZWxlY3RhYmxlIGRhdGVzOlx0IFNpbmdsZSBkYXkgPSAwLCAgbXVsdGkgZGF5cyA9IDM2NVxyXG5cdFx0XHRcdFx0cmFuZ2VTZWxlY3Q6ICAoJ2R5bmFtaWMnID09IGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUpLFxyXG5cdFx0XHRcdFx0cmFuZ2VTZXBhcmF0b3I6IFx0JyB+ICcsXHRcdFx0XHRcdC8vJyAtICcsXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gc2hvd1dlZWtzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHVzZVRoZW1lUm9sbGVyOlx0XHRmYWxzZVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG5cdHJldHVybiAgdHJ1ZTtcclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgQ1NTIHRvIGNhbGVuZGFyIGRhdGUgY2VsbHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImh0bWxfaWRcIjogXCJjYWxlbmRhcl9ib29raW5nNFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcInRleHRfaWRcIjogXCJkYXRlX2Jvb2tpbmc0XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5XCI6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzXCI6IDEyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcInJlc291cmNlX2lkXCI6IDQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiYWp4X25vbmNlX2NhbGVuZGFyXCI6IFwiPGlucHV0IHR5cGU9XFxcImhpZGRlblxcXCIgLi4uIC8+XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiYm9va2VkX2RhdGVzXCI6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIxMi0yOC0yMDIyXCI6IFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJib29raW5nX2RhdGVcIjogXCIyMDIyLTEyLTI4IDAwOjAwOjAwXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJhcHByb3ZlZFwiOiBcIjFcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImJvb2tpbmdfaWRcIjogXCIyNlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2Vhc29uX2F2YWlsYWJpbGl0eSc6e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0wOVwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMFwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMVwiOiB0cnVlLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyBbYm9vbGVhbixzdHJpbmddXHQtIFsge3RydWUgLWF2YWlsYWJsZSB8IGZhbHNlIC0gdW5hdmFpbGFibGV9LCAnQ1NTIGNsYXNzZXMgZm9yIGNhbGVuZGFyIGRheSBjZWxsJyBdXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzKCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0dmFyIHRvZGF5X2RhdGUgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAwIF0sIChwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAxIF0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDIgXSwgMCwgMCwgMCApO1xyXG5cdFx0dmFyIHJlYWxfdG9kYXlfZGF0ZSA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVsgMCBdLCAocGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWyAxIF0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVsgMiBdLCAwLCAwLCAwICk7XHJcblxyXG5cdFx0dmFyIGNsYXNzX2RheSAgPSAoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICctJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy0nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1x0XHRcdFx0XHRcdC8vICcxLTktMjAyMydcclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzIwMjMtMDEtMDknXHJcblxyXG5cdFx0dmFyIGNzc19kYXRlX19zdGFuZGFyZCAgID0gICdjYWw0ZGF0ZS0nICsgY2xhc3NfZGF5O1xyXG5cdFx0dmFyIGNzc19kYXRlX19hZGRpdGlvbmFsID0gJyB3cGJjX3dlZWtkYXlfJyArIGRhdGUuZ2V0RGF5KCkgKyAnICc7XHJcblxyXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdC8vIFdFRUtEQVlTIDo6IFNldCB1bmF2YWlsYWJsZSB3ZWVrIGRheXMgZnJvbSAtIFNldHRpbmdzIEdlbmVyYWwgcGFnZSBpbiBcIkF2YWlsYWJpbGl0eVwiIHNlY3Rpb25cclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fd2Vla19kYXlzX3VuYXZhaWxhYmxlJyApLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdGlmICggZGF0ZS5nZXREYXkoKSA9PSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX3dlZWtfZGF5c191bmF2YWlsYWJsZScgKVsgaSBdICkge1xyXG5cdFx0XHRcdHJldHVybiBbICEhZmFsc2UsIGNzc19kYXRlX19zdGFuZGFyZCArICcgZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyBcdCsgJyB3ZWVrZGF5c191bmF2YWlsYWJsZScgXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0Ly8gMTAuOS42LjMuXHJcblx0XHR2YXIgZGF0ZV9taWRuaWdodCA9IG5ldyBEYXRlKCBwYXJzZUludCggZGF0ZS5nZXRGdWxsWWVhcigpICksIChwYXJzZUludCggZGF0ZS5nZXRNb250aCgpICkgLSAwKSwgcGFyc2VJbnQoIGRhdGUuZ2V0RGF0ZSgpICksIDAsIDAsIDAgKTtcclxuXHRcdC8vIEJFRk9SRV9BRlRFUiA6OiBTZXQgdW5hdmFpbGFibGUgZGF5cyBCZWZvcmUgLyBBZnRlciB0aGUgVG9kYXkgZGF0ZS5cclxuXHRcdC8vaWYgKCAoKHdwYmNfZGF0ZXNfX2RheXNfYmV0d2VlbiggZGF0ZSwgcmVhbF90b2RheV9kYXRlICkpIDwgcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fdW5hdmFpbGFibGVfZnJvbV90b2RheScgKSApKVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQoICh0b2RheV9kYXRlLmdldFRpbWUoKSAtIGRhdGVfbWlkbmlnaHQuZ2V0VGltZSgpICkgPiAwIClcclxuXHRcdFx0fHwgKFxyXG5cdFx0XHRcdChwYXJzZUludCggJzAnICsgcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fYXZhaWxhYmxlX2Zyb21fdG9kYXknICkgKSApID4gMClcclxuXHRcdFx0XHQmJiAod3BiY19kYXRlc19fZGF5c19iZXR3ZWVuKCBkYXRlX21pZG5pZ2h0LCByZWFsX3RvZGF5X2RhdGUgKSA+PSBwYXJzZUludCggJzAnICsgcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fYXZhaWxhYmxlX2Zyb21fdG9kYXknICkgKSApKVxyXG5cdFx0XHQpXHJcblx0XHQpIHtcclxuXHRcdFx0cmV0dXJuIFsgZmFsc2UsIGNzc19kYXRlX19zdGFuZGFyZCArICcgZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyArICcgYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFNFQVNPTlMgOjogIFx0XHRcdFx0XHRCb29raW5nID4gUmVzb3VyY2VzID4gQXZhaWxhYmlsaXR5IHBhZ2VcclxuXHRcdHZhciAgICBpc19kYXRlX2F2YWlsYWJsZSA9IGNhbGVuZGFyX3BhcmFtc19hcnIuc2Vhc29uX2F2YWlsYWJpbGl0eVsgc3FsX2NsYXNzX2RheSBdO1xyXG5cdFx0aWYgKCBmYWxzZSA9PT0gaXNfZGF0ZV9hdmFpbGFibGUgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNS40LjQuXHJcblx0XHRcdHJldHVybiBbICEhZmFsc2UsIGNzc19kYXRlX19zdGFuZGFyZCArICcgZGF0ZV91c2VyX3VuYXZhaWxhYmxlJ1x0XHQrICcgc2Vhc29uX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFJFU09VUkNFX1VOQVZBSUxBQkxFIDo6ICAgXHRCb29raW5nID4gQXZhaWxhYmlsaXR5IHBhZ2VcclxuXHRcdGlmICggd3BiY19pbl9hcnJheShjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzLCBzcWxfY2xhc3NfZGF5ICkgKXtcclxuXHRcdFx0aXNfZGF0ZV9hdmFpbGFibGUgPSBmYWxzZTtcclxuXHRcdH1cclxuXHRcdGlmICggIGZhbHNlID09PSBpc19kYXRlX2F2YWlsYWJsZSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNS40LjQuXHJcblx0XHRcdHJldHVybiBbICFmYWxzZSwgY3NzX2RhdGVfX3N0YW5kYXJkICsgJyBkYXRlX3VzZXJfdW5hdmFpbGFibGUnXHRcdCsgJyByZXNvdXJjZV91bmF2YWlsYWJsZScgXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0XHQvLyBJcyBhbnkgYm9va2luZ3MgaW4gdGhpcyBkYXRlID9cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggY2FsZW5kYXJfcGFyYW1zX2Fyci5ib29rZWRfZGF0ZXNbIGNsYXNzX2RheSBdICkgKSB7XHJcblxyXG5cdFx0XHR2YXIgYm9va2luZ3NfaW5fZGF0ZSA9IGNhbGVuZGFyX3BhcmFtc19hcnIuYm9va2VkX2RhdGVzWyBjbGFzc19kYXkgXTtcclxuXHJcblxyXG5cdFx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIGJvb2tpbmdzX2luX2RhdGVbICdzZWNfMCcgXSApICkge1x0XHRcdC8vIFwiRnVsbCBkYXlcIiBib29raW5nICAtPiAoc2Vjb25kcyA9PSAwKVxyXG5cclxuXHRcdFx0XHRjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAoICcwJyA9PT0gYm9va2luZ3NfaW5fZGF0ZVsgJ3NlY18wJyBdLmFwcHJvdmVkICkgPyAnIGRhdGUyYXBwcm92ZSAnIDogJyBkYXRlX2FwcHJvdmVkICc7XHRcdFx0XHQvLyBQZW5kaW5nID0gJzAnIHwgIEFwcHJvdmVkID0gJzEnXHJcblx0XHRcdFx0Y3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gJyBmdWxsX2RheV9ib29raW5nJztcclxuXHJcblx0XHRcdFx0cmV0dXJuIFsgIWZhbHNlLCBjc3NfZGF0ZV9fc3RhbmRhcmQgKyBjc3NfZGF0ZV9fYWRkaXRpb25hbCBdO1xyXG5cclxuXHRcdFx0fSBlbHNlIGlmICggT2JqZWN0LmtleXMoIGJvb2tpbmdzX2luX2RhdGUgKS5sZW5ndGggPiAwICl7XHRcdFx0XHQvLyBcIlRpbWUgc2xvdHNcIiBCb29raW5nc1xyXG5cclxuXHRcdFx0XHR2YXIgaXNfYXBwcm92ZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRfLmVhY2goIGJvb2tpbmdzX2luX2RhdGUsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRcdFx0XHRpZiAoICFwYXJzZUludCggcF92YWwuYXBwcm92ZWQgKSApe1xyXG5cdFx0XHRcdFx0XHRpc19hcHByb3ZlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dmFyIHRzID0gcF92YWwuYm9va2luZ19kYXRlLnN1YnN0cmluZyggcF92YWwuYm9va2luZ19kYXRlLmxlbmd0aCAtIDEgKTtcclxuXHRcdFx0XHRcdGlmICggdHJ1ZSA9PT0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnaXNfZW5hYmxlZF9jaGFuZ2Vfb3ZlcicgKSApe1xyXG5cdFx0XHRcdFx0XHRpZiAoIHRzID09ICcxJyApIHsgY3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gJyBjaGVja19pbl90aW1lJyArICgocGFyc2VJbnQocF92YWwuYXBwcm92ZWQpKSA/ICcgY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyA6ICcgY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnKTsgfVxyXG5cdFx0XHRcdFx0XHRpZiAoIHRzID09ICcyJyApIHsgY3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gJyBjaGVja19vdXRfdGltZScgKyAoKHBhcnNlSW50KHBfdmFsLmFwcHJvdmVkKSkgPyAnIGNoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWQnIDogJyBjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnKTsgfVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGlzX2FwcHJvdmVkICl7XHJcblx0XHRcdFx0XHRjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIGRhdGUyYXBwcm92ZSB0aW1lc3BhcnRseSdcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gJyBkYXRlX2FwcHJvdmVkIHRpbWVzcGFydGx5J1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2lzX2VuYWJsZWRfY2hhbmdlX292ZXInICkgKXtcclxuXHRcdFx0XHRcdGNzc19kYXRlX19hZGRpdGlvbmFsICs9ICcgdGltZXNfY2xvY2snXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdH1cclxuXHJcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0cmV0dXJuIFsgdHJ1ZSwgY3NzX2RhdGVfX3N0YW5kYXJkICsgY3NzX2RhdGVfX2FkZGl0aW9uYWwgKyAnIGRhdGVfYXZhaWxhYmxlJyBdO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IHNvbWUgQ1NTIGNsYXNzZXMsIHdoZW4gd2UgbW91c2Ugb3ZlciBzcGVjaWZpYyBkYXRlcyBpbiBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSB2YWx1ZVxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImh0bWxfaWRcIjogXCJjYWxlbmRhcl9ib29raW5nNFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcInRleHRfaWRcIjogXCJkYXRlX2Jvb2tpbmc0XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5XCI6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzXCI6IDEyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcInJlc291cmNlX2lkXCI6IDQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiYWp4X25vbmNlX2NhbGVuZGFyXCI6IFwiPGlucHV0IHR5cGU9XFxcImhpZGRlblxcXCIgLi4uIC8+XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiYm9va2VkX2RhdGVzXCI6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIxMi0yOC0yMDIyXCI6IFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJib29raW5nX2RhdGVcIjogXCIyMDIyLTEyLTI4IDAwOjAwOjAwXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJhcHByb3ZlZFwiOiBcIjFcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImJvb2tpbmdfaWRcIjogXCIyNlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2Vhc29uX2F2YWlsYWJpbGl0eSc6e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0wOVwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMFwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMVwiOiB0cnVlLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19ob3ZlciggdmFsdWUsIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHRpZiAoIG51bGwgPT09IGRhdGUgKXtcclxuXHRcdFx0alF1ZXJ5KCAnLmRhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApLnJlbW92ZUNsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7ICAgXHQgICAgICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciBhbGwgaGlnaGxpZ2h0IGRheXMgc2VsZWN0aW9uc1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGluc3QgPSBqUXVlcnkuZGF0ZXBpY2suX2dldEluc3QoIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICkgKTtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggMSA9PSBpbnN0LmRhdGVzLmxlbmd0aClcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBJZiB3ZSBoYXZlIG9uZSBzZWxlY3RlZCBkYXRlXHJcblx0XHRcdCYmICgnZHluYW1pYycgPT09IGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUpIFx0XHRcdFx0XHQvLyB3aGlsZSBoYXZlIHJhbmdlIGRheXMgc2VsZWN0aW9uIG1vZGVcclxuXHRcdCl7XHJcblxyXG5cdFx0XHR2YXIgdGRfY2xhc3M7XHJcblx0XHRcdHZhciB0ZF9vdmVycyA9IFtdO1xyXG5cdFx0XHR2YXIgaXNfY2hlY2sgPSB0cnVlO1xyXG4gICAgICAgICAgICB2YXIgc2VsY2V0ZWRfZmlyc3RfZGF5ID0gbmV3IERhdGUoKTtcclxuICAgICAgICAgICAgc2VsY2V0ZWRfZmlyc3RfZGF5LnNldEZ1bGxZZWFyKGluc3QuZGF0ZXNbMF0uZ2V0RnVsbFllYXIoKSwoaW5zdC5kYXRlc1swXS5nZXRNb250aCgpKSwgKGluc3QuZGF0ZXNbMF0uZ2V0RGF0ZSgpICkgKTsgLy9HZXQgZmlyc3QgRGF0ZVxyXG5cclxuICAgICAgICAgICAgd2hpbGUoICBpc19jaGVjayApe1xyXG5cclxuXHRcdFx0XHR0ZF9jbGFzcyA9IChzZWxjZXRlZF9maXJzdF9kYXkuZ2V0TW9udGgoKSArIDEpICsgJy0nICsgc2VsY2V0ZWRfZmlyc3RfZGF5LmdldERhdGUoKSArICctJyArIHNlbGNldGVkX2ZpcnN0X2RheS5nZXRGdWxsWWVhcigpO1xyXG5cclxuXHRcdFx0XHR0ZF9vdmVyc1sgdGRfb3ZlcnMubGVuZ3RoIF0gPSAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCArICcgLmNhbDRkYXRlLScgKyB0ZF9jbGFzczsgICAgICAgICAgICAgIC8vIGFkZCB0byBhcnJheSBmb3IgbGF0ZXIgbWFrZSBzZWxlY3Rpb24gYnkgY2xhc3NcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoXHJcblx0XHRcdFx0XHQoICAoIGRhdGUuZ2V0TW9udGgoKSA9PSBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0TW9udGgoKSApICAmJlxyXG4gICAgICAgICAgICAgICAgICAgICAgICggZGF0ZS5nZXREYXRlKCkgPT0gc2VsY2V0ZWRfZmlyc3RfZGF5LmdldERhdGUoKSApICAmJlxyXG4gICAgICAgICAgICAgICAgICAgICAgICggZGF0ZS5nZXRGdWxsWWVhcigpID09IHNlbGNldGVkX2ZpcnN0X2RheS5nZXRGdWxsWWVhcigpIClcclxuXHRcdFx0XHRcdCkgfHwgKCBzZWxjZXRlZF9maXJzdF9kYXkgPiBkYXRlIClcclxuXHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0aXNfY2hlY2sgPSAgZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRzZWxjZXRlZF9maXJzdF9kYXkuc2V0RnVsbFllYXIoIHNlbGNldGVkX2ZpcnN0X2RheS5nZXRGdWxsWWVhcigpLCAoc2VsY2V0ZWRfZmlyc3RfZGF5LmdldE1vbnRoKCkpLCAoc2VsY2V0ZWRfZmlyc3RfZGF5LmdldERhdGUoKSArIDEpICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEhpZ2hsaWdodCBEYXlzXHJcblx0XHRcdGZvciAoIHZhciBpPTA7IGkgPCB0ZF9vdmVycy5sZW5ndGggOyBpKyspIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIGNsYXNzIHRvIGFsbCBlbGVtZW50c1xyXG5cdFx0XHRcdGpRdWVyeSggdGRfb3ZlcnNbaV0gKS5hZGRDbGFzcygnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHJcblx0XHR9XHJcblxyXG5cdCAgICByZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBPbiBEQVlzIHNlbGVjdGlvbiBpbiBjYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVzX3NlbGVjdGlvblx0XHQtICBzdHJpbmc6XHRcdFx0ICcyMDIzLTAzLTA3IH4gMjAyMy0wMy0wNycgb3IgJzIwMjMtMDQtMTAsIDIwMjMtMDQtMTIsIDIwMjMtMDQtMDIsIDIwMjMtMDQtMDQnXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImh0bWxfaWRcIjogXCJjYWxlbmRhcl9ib29raW5nNFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcInRleHRfaWRcIjogXCJkYXRlX2Jvb2tpbmc0XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5XCI6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzXCI6IDEyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcInJlc291cmNlX2lkXCI6IDQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiYWp4X25vbmNlX2NhbGVuZGFyXCI6IFwiPGlucHV0IHR5cGU9XFxcImhpZGRlblxcXCIgLi4uIC8+XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiYm9va2VkX2RhdGVzXCI6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIxMi0yOC0yMDIyXCI6IFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJib29raW5nX2RhdGVcIjogXCIyMDIyLTEyLTI4IDAwOjAwOjAwXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJhcHByb3ZlZFwiOiBcIjFcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImJvb2tpbmdfaWRcIjogXCIyNlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2Vhc29uX2F2YWlsYWJpbGl0eSc6e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0wOVwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMFwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMVwiOiB0cnVlLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyBib29sZWFuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfc2VsZWN0KCBkYXRlc19zZWxlY3Rpb24sIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgPSBudWxsICl7XHJcblxyXG5cdFx0dmFyIGluc3QgPSBqUXVlcnkuZGF0ZXBpY2suX2dldEluc3QoIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICkgKTtcclxuXHJcblx0XHR2YXIgZGF0ZXNfYXJyID0gW107XHQvLyAgWyBcIjIwMjMtMDQtMDlcIiwgXCIyMDIzLTA0LTEwXCIsIFwiMjAyMy0wNC0xMVwiIF1cclxuXHJcblx0XHRpZiAoIC0xICE9PSBkYXRlc19zZWxlY3Rpb24uaW5kZXhPZiggJ34nICkgKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJhbmdlIERheXNcclxuXHJcblx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X2RhdGVzX2Fycl9fZnJvbV9kYXRlc19yYW5nZV9qcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RhdGVzX3NlcGFyYXRvcicgOiAnIH4gJywgICAgICAgICAgICAgICAgICAgICAgICAgLy8gICcgfiAnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGF0ZXMnICAgICAgICAgICA6IGRhdGVzX3NlbGVjdGlvbiwgICAgXHRcdCAgIC8vICcyMDIzLTA0LTA0IH4gMjAyMy0wNC0wNydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblxyXG5cdFx0fSBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE11bHRpcGxlIERheXNcclxuXHRcdFx0ZGF0ZXNfYXJyID0gd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX2NvbW1hX3NlcGFyYXRlZF9qcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RhdGVzX3NlcGFyYXRvcicgOiAnLCAnLCAgICAgICAgICAgICAgICAgICAgICAgICBcdC8vICAnLCAnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGF0ZXMnICAgICAgICAgICA6IGRhdGVzX3NlbGVjdGlvbiwgICAgXHRcdFx0Ly8gJzIwMjMtMDQtMTAsIDIwMjMtMDQtMTIsIDIwMjMtMDQtMDIsIDIwMjMtMDQtMDQnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdwYmNfYXZ5X2FmdGVyX2RheXNfc2VsZWN0aW9uX19zaG93X2hlbHBfaW5mbyh7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUnOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RhdGVzX2FycicgICAgICAgICAgICAgICAgICAgIDogZGF0ZXNfYXJyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RhdGVzX2NsaWNrX251bScgICAgICAgICAgICAgIDogaW5zdC5kYXRlcy5sZW5ndGgsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncG9wb3Zlcl9oaW50cydcdFx0XHRcdFx0OiBjYWxlbmRhcl9wYXJhbXNfYXJyLnBvcG92ZXJfaGludHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IGhlbHAgaW5mbyBhdCB0aGUgdG9wICB0b29sYmFyIGFib3V0IHNlbGVjdGVkIGRhdGVzIGFuZCBmdXR1cmUgYWN0aW9uc1xyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBwYXJhbXNcclxuXHRcdCAqIFx0XHRcdFx0XHRFeGFtcGxlIDE6ICB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZTogXCJkeW5hbWljXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19hcnI6ICBbIFwiMjAyMy0wNC0wM1wiIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19jbGlja19udW06IDFcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwb3BvdmVyX2hpbnRzJ1x0XHRcdFx0XHQ6IGNhbGVuZGFyX3BhcmFtc19hcnIucG9wb3Zlcl9oaW50c1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdCAqIFx0XHRcdFx0XHRFeGFtcGxlIDI6ICB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZTogXCJkeW5hbWljXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRhdGVzX2FycjogQXJyYXkoMTApIFsgXCIyMDIzLTA0LTAzXCIsIFwiMjAyMy0wNC0wNFwiLCBcIjIwMjMtMDQtMDVcIiwg4oCmIF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRhdGVzX2NsaWNrX251bTogMlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BvcG92ZXJfaGludHMnXHRcdFx0XHRcdDogY2FsZW5kYXJfcGFyYW1zX2Fyci5wb3BvdmVyX2hpbnRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2F2eV9hZnRlcl9kYXlzX3NlbGVjdGlvbl9fc2hvd19oZWxwX2luZm8oIHBhcmFtcyApe1xyXG4vLyBjb25zb2xlLmxvZyggcGFyYW1zICk7XHQvL1x0XHRbIFwiMjAyMy0wNC0wOVwiLCBcIjIwMjMtMDQtMTBcIiwgXCIyMDIzLTA0LTExXCIgXVxyXG5cclxuXHRcdFx0dmFyIG1lc3NhZ2UsIGNvbG9yO1xyXG5cdFx0XHRpZiAoalF1ZXJ5KCAnI3VpX2J0bl9hdnlfX3NldF9kYXlzX2F2YWlsYWJpbGl0eV9fYXZhaWxhYmxlJykuaXMoJzpjaGVja2VkJykpe1xyXG5cdFx0XHRcdCBtZXNzYWdlID0gcGFyYW1zLnBvcG92ZXJfaGludHMudG9vbGJhcl90ZXh0X2F2YWlsYWJsZTsvLydTZXQgZGF0ZXMgX0RBVEVTXyBhcyBfSFRNTF8gYXZhaWxhYmxlLic7XHJcblx0XHRcdFx0IGNvbG9yID0gJyMxMWJlNGMnO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG1lc3NhZ2UgPSBwYXJhbXMucG9wb3Zlcl9oaW50cy50b29sYmFyX3RleHRfdW5hdmFpbGFibGU7Ly8nU2V0IGRhdGVzIF9EQVRFU18gYXMgX0hUTUxfIHVuYXZhaWxhYmxlLic7XHJcblx0XHRcdFx0Y29sb3IgPSAnI2U0MzkzOSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG1lc3NhZ2UgPSAnPHNwYW4+JyArIG1lc3NhZ2UgKyAnPC9zcGFuPic7XHJcblxyXG5cdFx0XHR2YXIgZmlyc3RfZGF0ZSA9IHBhcmFtc1sgJ2RhdGVzX2FycicgXVsgMCBdO1xyXG5cdFx0XHR2YXIgbGFzdF9kYXRlICA9ICggJ2R5bmFtaWMnID09IHBhcmFtcy5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSApXHJcblx0XHRcdFx0XHRcdFx0PyBwYXJhbXNbICdkYXRlc19hcnInIF1bIChwYXJhbXNbICdkYXRlc19hcnInIF0ubGVuZ3RoIC0gMSkgXVxyXG5cdFx0XHRcdFx0XHRcdDogKCBwYXJhbXNbICdkYXRlc19hcnInIF0ubGVuZ3RoID4gMSApID8gcGFyYW1zWyAnZGF0ZXNfYXJyJyBdWyAxIF0gOiAnJztcclxuXHJcblx0XHRcdGZpcnN0X2RhdGUgPSBqUXVlcnkuZGF0ZXBpY2suZm9ybWF0RGF0ZSggJ2RkIE0sIHl5JywgbmV3IERhdGUoIGZpcnN0X2RhdGUgKyAnVDAwOjAwOjAwJyApICk7XHJcblx0XHRcdGxhc3RfZGF0ZSA9IGpRdWVyeS5kYXRlcGljay5mb3JtYXREYXRlKCAnZGQgTSwgeXknLCAgbmV3IERhdGUoIGxhc3RfZGF0ZSArICdUMDA6MDA6MDAnICkgKTtcclxuXHJcblxyXG5cdFx0XHRpZiAoICdkeW5hbWljJyA9PSBwYXJhbXMuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUgKXtcclxuXHRcdFx0XHRpZiAoIDEgPT0gcGFyYW1zLmRhdGVzX2NsaWNrX251bSApe1xyXG5cdFx0XHRcdFx0bGFzdF9kYXRlID0gJ19fX19fX19fX19fJ1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAoICdmaXJzdF90aW1lJyA9PSBqUXVlcnkoICcud3BiY19hanhfYXZhaWxhYmlsaXR5X2NvbnRhaW5lcicgKS5hdHRyKCAnd3BiY19sb2FkZWQnICkgKXtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYWp4X2F2YWlsYWJpbGl0eV9jb250YWluZXInICkuYXR0ciggJ3dwYmNfbG9hZGVkJywgJ2RvbmUnIClcclxuXHRcdFx0XHRcdFx0d3BiY19ibGlua19lbGVtZW50KCAnLndwYmNfd2lkZ2V0X2F2YWlsYWJsZV91bmF2YWlsYWJsZScsIDMsIDIyMCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRtZXNzYWdlID0gbWVzc2FnZS5yZXBsYWNlKCAnX0RBVEVTXycsICAgICc8L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8rICc8ZGl2PicgKyAnZnJvbScgKyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnPHNwYW4gY2xhc3M9XCJ3cGJjX2JpZ19kYXRlXCI+JyArIGZpcnN0X2RhdGUgKyAnPC9zcGFuPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuPicgKyAnLScgKyAnPC9zcGFuPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuIGNsYXNzPVwid3BiY19iaWdfZGF0ZVwiPicgKyBsYXN0X2RhdGUgKyAnPC9zcGFuPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuPicgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvLyBpZiAoIHBhcmFtc1sgJ2RhdGVzX2FycicgXS5sZW5ndGggPiAxICl7XHJcblx0XHRcdFx0Ly8gXHRsYXN0X2RhdGUgPSAnLCAnICsgbGFzdF9kYXRlO1xyXG5cdFx0XHRcdC8vIFx0bGFzdF9kYXRlICs9ICggcGFyYW1zWyAnZGF0ZXNfYXJyJyBdLmxlbmd0aCA+IDIgKSA/ICcsIC4uLicgOiAnJztcclxuXHRcdFx0XHQvLyB9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIFx0bGFzdF9kYXRlPScnO1xyXG5cdFx0XHRcdC8vIH1cclxuXHRcdFx0XHR2YXIgZGF0ZXNfYXJyID0gW107XHJcblx0XHRcdFx0Zm9yKCB2YXIgaSA9IDA7IGkgPCBwYXJhbXNbICdkYXRlc19hcnInIF0ubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0XHRcdGRhdGVzX2Fyci5wdXNoKCAgalF1ZXJ5LmRhdGVwaWNrLmZvcm1hdERhdGUoICdkZCBNIHl5JywgIG5ldyBEYXRlKCBwYXJhbXNbICdkYXRlc19hcnInIF1bIGkgXSArICdUMDA6MDA6MDAnICkgKSAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Zmlyc3RfZGF0ZSA9IGRhdGVzX2Fyci5qb2luKCAnLCAnICk7XHJcblx0XHRcdFx0bWVzc2FnZSA9IG1lc3NhZ2UucmVwbGFjZSggJ19EQVRFU18nLCAgICAnPC9zcGFuPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuIGNsYXNzPVwid3BiY19iaWdfZGF0ZVwiPicgKyBmaXJzdF9kYXRlICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3Bhbj4nICk7XHJcblx0XHRcdH1cclxuXHRcdFx0bWVzc2FnZSA9IG1lc3NhZ2UucmVwbGFjZSggJ19IVE1MXycgLCAnPC9zcGFuPjxzcGFuIGNsYXNzPVwid3BiY19iaWdfdGV4dFwiIHN0eWxlPVwiY29sb3I6Jytjb2xvcisnO1wiPicpICsgJzxzcGFuPic7XHJcblxyXG5cdFx0XHQvL21lc3NhZ2UgKz0gJyA8ZGl2IHN0eWxlPVwibWFyZ2luLWxlZnQ6IDFlbTtcIj4nICsgJyBDbGljayBvbiBBcHBseSBidXR0b24gdG8gYXBwbHkgYXZhaWxhYmlsaXR5LicgKyAnPC9kaXY+JztcclxuXHJcblx0XHRcdG1lc3NhZ2UgPSAnPGRpdiBjbGFzcz1cIndwYmNfdG9vbGJhcl9kYXRlc19oaW50c1wiPicgKyBtZXNzYWdlICsgJzwvZGl2Pic7XHJcblxyXG5cdFx0XHRqUXVlcnkoICcud3BiY19oZWxwX3RleHQnICkuaHRtbChcdG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0LyoqXHJcblx0ICogICBQYXJzZSBkYXRlcyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGRhdGVzIGFycmF5LCAgZnJvbSBjb21tYSBzZXBhcmF0ZWQgZGF0ZXNcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcGFyYW1zICAgICAgID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiAnZGF0ZXNfc2VwYXJhdG9yJyA9PiAnLCAnLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEYXRlcyBzZXBhcmF0b3JcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogJ2RhdGVzJyAgICAgICAgICAgPT4gJzIwMjMtMDQtMDQsIDIwMjMtMDQtMDcsIDIwMjMtMDQtMDUnICAgICAgICAgLy8gRGF0ZXMgaW4gJ1ktbS1kJyBmb3JtYXQ6ICcyMDIzLTAxLTMxJ1xyXG5cdFx0XHRcdFx0XHRcdFx0IH1cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIGFycmF5ICAgICAgPSBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFswXSA9PiAyMDIzLTA0LTA0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFsxXSA9PiAyMDIzLTA0LTA1XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFsyXSA9PiAyMDIzLTA0LTA2XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFszXSA9PiAyMDIzLTA0LTA3XHJcblx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHQgKlxyXG5cdFx0ICogRXhhbXBsZSAjMTogIHdwYmNfZ2V0X2RhdGVzX2Fycl9fZnJvbV9kYXRlc19jb21tYV9zZXBhcmF0ZWRfanMoICB7ICAnZGF0ZXNfc2VwYXJhdG9yJyA6ICcsICcsICdkYXRlcycgOiAnMjAyMy0wNC0wNCwgMjAyMy0wNC0wNywgMjAyMy0wNC0wNScgIH0gICk7XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2RhdGVzX2Fycl9fZnJvbV9kYXRlc19jb21tYV9zZXBhcmF0ZWRfanMoIHBhcmFtcyApe1xyXG5cclxuXHRcdFx0dmFyIGRhdGVzX2FyciA9IFtdO1xyXG5cclxuXHRcdFx0aWYgKCAnJyAhPT0gcGFyYW1zWyAnZGF0ZXMnIF0gKXtcclxuXHJcblx0XHRcdFx0ZGF0ZXNfYXJyID0gcGFyYW1zWyAnZGF0ZXMnIF0uc3BsaXQoIHBhcmFtc1sgJ2RhdGVzX3NlcGFyYXRvcicgXSApO1xyXG5cclxuXHRcdFx0XHRkYXRlc19hcnIuc29ydCgpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBkYXRlc19hcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgZGF0ZXMgYXJyYXksICBmcm9tIHJhbmdlIGRheXMgc2VsZWN0aW9uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHBhcmFtcyAgICAgICA9ICB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqICdkYXRlc19zZXBhcmF0b3InID0+ICcgfiAnLCAgICAgICAgICAgICAgICAgICAgICAgICAvLyBEYXRlcyBzZXBhcmF0b3JcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogJ2RhdGVzJyAgICAgICAgICAgPT4gJzIwMjMtMDQtMDQgfiAyMDIzLTA0LTA3JyAgICAgIC8vIERhdGVzIGluICdZLW0tZCcgZm9ybWF0OiAnMjAyMy0wMS0zMSdcclxuXHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gYXJyYXkgICAgICAgID0gW1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiBbMF0gPT4gMjAyMy0wNC0wNFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiBbMV0gPT4gMjAyMy0wNC0wNVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiBbMl0gPT4gMjAyMy0wNC0wNlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiBbM10gPT4gMjAyMy0wNC0wN1xyXG5cdFx0XHRcdFx0XHRcdFx0ICBdXHJcblx0XHQgKlxyXG5cdFx0ICogRXhhbXBsZSAjMTogIHdwYmNfZ2V0X2RhdGVzX2Fycl9fZnJvbV9kYXRlc19yYW5nZV9qcyggIHsgICdkYXRlc19zZXBhcmF0b3InIDogJyB+ICcsICdkYXRlcycgOiAnMjAyMy0wNC0wNCB+IDIwMjMtMDQtMDcnICB9ICApO1xyXG5cdFx0ICogRXhhbXBsZSAjMjogIHdwYmNfZ2V0X2RhdGVzX2Fycl9fZnJvbV9kYXRlc19yYW5nZV9qcyggIHsgICdkYXRlc19zZXBhcmF0b3InIDogJyAtICcsICdkYXRlcycgOiAnMjAyMy0wNC0wNCAtIDIwMjMtMDQtMDcnICB9ICApO1xyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfcmFuZ2VfanMoIHBhcmFtcyApe1xyXG5cclxuXHRcdFx0dmFyIGRhdGVzX2FyciA9IFtdO1xyXG5cclxuXHRcdFx0aWYgKCAnJyAhPT0gcGFyYW1zWydkYXRlcyddICkge1xyXG5cclxuXHRcdFx0XHRkYXRlc19hcnIgPSBwYXJhbXNbICdkYXRlcycgXS5zcGxpdCggcGFyYW1zWyAnZGF0ZXNfc2VwYXJhdG9yJyBdICk7XHJcblx0XHRcdFx0dmFyIGNoZWNrX2luX2RhdGVfeW1kICA9IGRhdGVzX2FyclswXTtcclxuXHRcdFx0XHR2YXIgY2hlY2tfb3V0X2RhdGVfeW1kID0gZGF0ZXNfYXJyWzFdO1xyXG5cclxuXHRcdFx0XHRpZiAoICgnJyAhPT0gY2hlY2tfaW5fZGF0ZV95bWQpICYmICgnJyAhPT0gY2hlY2tfb3V0X2RhdGVfeW1kKSApe1xyXG5cclxuXHRcdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X2RhdGVzX2FycmF5X2Zyb21fc3RhcnRfZW5kX2RheXNfanMoIGNoZWNrX2luX2RhdGVfeW1kLCBjaGVja19vdXRfZGF0ZV95bWQgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGRhdGVzX2FycjtcclxuXHRcdH1cclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBHZXQgZGF0ZXMgYXJyYXkgYmFzZWQgb24gc3RhcnQgYW5kIGVuZCBkYXRlcy5cclxuXHRcdFx0ICpcclxuXHRcdFx0ICogQHBhcmFtIHN0cmluZyBzU3RhcnREYXRlIC0gc3RhcnQgZGF0ZTogMjAyMy0wNC0wOVxyXG5cdFx0XHQgKiBAcGFyYW0gc3RyaW5nIHNFbmREYXRlICAgLSBlbmQgZGF0ZTogICAyMDIzLTA0LTExXHJcblx0XHRcdCAqIEByZXR1cm4gYXJyYXkgICAgICAgICAgICAgLSBbIFwiMjAyMy0wNC0wOVwiLCBcIjIwMjMtMDQtMTBcIiwgXCIyMDIzLTA0LTExXCIgXVxyXG5cdFx0XHQgKi9cclxuXHRcdFx0ZnVuY3Rpb24gd3BiY19nZXRfZGF0ZXNfYXJyYXlfZnJvbV9zdGFydF9lbmRfZGF5c19qcyggc1N0YXJ0RGF0ZSwgc0VuZERhdGUgKXtcclxuXHJcblx0XHRcdFx0c1N0YXJ0RGF0ZSA9IG5ldyBEYXRlKCBzU3RhcnREYXRlICsgJ1QwMDowMDowMCcgKTtcclxuXHRcdFx0XHRzRW5kRGF0ZSA9IG5ldyBEYXRlKCBzRW5kRGF0ZSArICdUMDA6MDA6MDAnICk7XHJcblxyXG5cdFx0XHRcdHZhciBhRGF5cz1bXTtcclxuXHJcblx0XHRcdFx0Ly8gU3RhcnQgdGhlIHZhcmlhYmxlIG9mZiB3aXRoIHRoZSBzdGFydCBkYXRlXHJcblx0XHRcdFx0YURheXMucHVzaCggc1N0YXJ0RGF0ZS5nZXRUaW1lKCkgKTtcclxuXHJcblx0XHRcdFx0Ly8gU2V0IGEgJ3RlbXAnIHZhcmlhYmxlLCBzQ3VycmVudERhdGUsIHdpdGggdGhlIHN0YXJ0IGRhdGUgLSBiZWZvcmUgYmVnaW5uaW5nIHRoZSBsb29wXHJcblx0XHRcdFx0dmFyIHNDdXJyZW50RGF0ZSA9IG5ldyBEYXRlKCBzU3RhcnREYXRlLmdldFRpbWUoKSApO1xyXG5cdFx0XHRcdHZhciBvbmVfZGF5X2R1cmF0aW9uID0gMjQqNjAqNjAqMTAwMDtcclxuXHJcblx0XHRcdFx0Ly8gV2hpbGUgdGhlIGN1cnJlbnQgZGF0ZSBpcyBsZXNzIHRoYW4gdGhlIGVuZCBkYXRlXHJcblx0XHRcdFx0d2hpbGUoc0N1cnJlbnREYXRlIDwgc0VuZERhdGUpe1xyXG5cdFx0XHRcdFx0Ly8gQWRkIGEgZGF5IHRvIHRoZSBjdXJyZW50IGRhdGUgXCIrMSBkYXlcIlxyXG5cdFx0XHRcdFx0c0N1cnJlbnREYXRlLnNldFRpbWUoIHNDdXJyZW50RGF0ZS5nZXRUaW1lKCkgKyBvbmVfZGF5X2R1cmF0aW9uICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWRkIHRoaXMgbmV3IGRheSB0byB0aGUgYURheXMgYXJyYXlcclxuXHRcdFx0XHRcdGFEYXlzLnB1c2goIHNDdXJyZW50RGF0ZS5nZXRUaW1lKCkgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYURheXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdGFEYXlzWyBpIF0gPSBuZXcgRGF0ZSggYURheXNbaV0gKTtcclxuXHRcdFx0XHRcdGFEYXlzWyBpIF0gPSBhRGF5c1sgaSBdLmdldEZ1bGxZZWFyKClcclxuXHRcdFx0XHRcdFx0XHRcdCsgJy0nICsgKCggKGFEYXlzWyBpIF0uZ2V0TW9udGgoKSArIDEpIDwgMTApID8gJzAnIDogJycpICsgKGFEYXlzWyBpIF0uZ2V0TW9udGgoKSArIDEpXHJcblx0XHRcdFx0XHRcdFx0XHQrICctJyArICgoICAgICAgICBhRGF5c1sgaSBdLmdldERhdGUoKSA8IDEwKSA/ICcwJyA6ICcnKSArICBhRGF5c1sgaSBdLmdldERhdGUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gT25jZSB0aGUgbG9vcCBoYXMgZmluaXNoZWQsIHJldHVybiB0aGUgYXJyYXkgb2YgZGF5cy5cclxuXHRcdFx0XHRyZXR1cm4gYURheXM7XHJcblx0XHRcdH1cclxuXHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgIFRvb2x0aXBzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmluZSBzaG93aW5nIHRvb2x0aXAsICB3aGVuICBtb3VzZSBvdmVyIG9uICBTRUxFQ1RBQkxFIChhdmFpbGFibGUsIHBlbmRpbmcsIGFwcHJvdmVkLCByZXNvdXJjZSB1bmF2YWlsYWJsZSksICBkYXlzXHJcblx0ICogQ2FuIGJlIGNhbGxlZCBkaXJlY3RseSAgZnJvbSAgZGF0ZXBpY2sgaW5pdCBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB2YWx1ZVxyXG5cdCAqIEBwYXJhbSBkYXRlXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1xyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYXZ5X19wcmVwYXJlX3Rvb2x0aXBfX2luX2NhbGVuZGFyKCB2YWx1ZSwgZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyApe1xyXG5cclxuXHRcdGlmICggbnVsbCA9PSBkYXRlICl7ICByZXR1cm4gZmFsc2U7ICB9XHJcblxyXG5cdFx0dmFyIHRkX2NsYXNzID0gKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLScgKyBkYXRlLmdldERhdGUoKSArICctJyArIGRhdGUuZ2V0RnVsbFllYXIoKTtcclxuXHJcblx0XHR2YXIgakNlbGwgPSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJyB0ZC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3MgKTtcclxuXHJcblx0XHR3cGJjX2F2eV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCggakNlbGwsIGNhbGVuZGFyX3BhcmFtc19hcnJbICdwb3BvdmVyX2hpbnRzJyBdICk7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgdG9vbHRpcCAgZm9yIHNob3dpbmcgb24gVU5BVkFJTEFCTEUgZGF5cyAoc2Vhc29uLCB3ZWVrZGF5LCB0b2RheV9kZXBlbmRzIHVuYXZhaWxhYmxlKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGpDZWxsXHRcdFx0XHRcdGpRdWVyeSBvZiBzcGVjaWZpYyBkYXkgY2VsbFxyXG5cdCAqIEBwYXJhbSBwb3BvdmVyX2hpbnRzXHRcdCAgICBBcnJheSB3aXRoIHRvb2x0aXAgaGludCB0ZXh0c1x0IDogeydzZWFzb25fdW5hdmFpbGFibGUnOicuLi4nLCd3ZWVrZGF5c191bmF2YWlsYWJsZSc6Jy4uLicsJ2JlZm9yZV9hZnRlcl91bmF2YWlsYWJsZSc6Jy4uLicsfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYXZ5X19zaG93X3Rvb2x0aXBfX2Zvcl9lbGVtZW50KCBqQ2VsbCwgcG9wb3Zlcl9oaW50cyApe1xyXG5cclxuXHRcdHZhciB0b29sdGlwX3RpbWUgPSAnJztcclxuXHJcblx0XHRpZiAoIGpDZWxsLmhhc0NsYXNzKCAnc2Vhc29uX3VuYXZhaWxhYmxlJyApICl7XHJcblx0XHRcdHRvb2x0aXBfdGltZSA9IHBvcG92ZXJfaGludHNbICdzZWFzb25fdW5hdmFpbGFibGUnIF07XHJcblx0XHR9IGVsc2UgaWYgKCBqQ2VsbC5oYXNDbGFzcyggJ3dlZWtkYXlzX3VuYXZhaWxhYmxlJyApICl7XHJcblx0XHRcdHRvb2x0aXBfdGltZSA9IHBvcG92ZXJfaGludHNbICd3ZWVrZGF5c191bmF2YWlsYWJsZScgXTtcclxuXHRcdH0gZWxzZSBpZiAoIGpDZWxsLmhhc0NsYXNzKCAnYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlJyApICl7XHJcblx0XHRcdHRvb2x0aXBfdGltZSA9IHBvcG92ZXJfaGludHNbICdiZWZvcmVfYWZ0ZXJfdW5hdmFpbGFibGUnIF07XHJcblx0XHR9IGVsc2UgaWYgKCBqQ2VsbC5oYXNDbGFzcyggJ2RhdGUyYXBwcm92ZScgKSApe1xyXG5cclxuXHRcdH0gZWxzZSBpZiAoIGpDZWxsLmhhc0NsYXNzKCAnZGF0ZV9hcHByb3ZlZCcgKSApe1xyXG5cclxuXHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdGpDZWxsLmF0dHIoICdkYXRhLWNvbnRlbnQnLCB0b29sdGlwX3RpbWUgKTtcclxuXHJcblx0XHR2YXIgdGRfZWwgPSBqQ2VsbC5nZXQoMCk7XHQvL2pRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKyAnIHRkLmNhbDRkYXRlLScgKyB0ZF9jbGFzcyApLmdldCgwKTtcclxuXHJcblx0XHRpZiAoICggdW5kZWZpbmVkID09IHRkX2VsLl90aXBweSApICYmICggJycgIT0gdG9vbHRpcF90aW1lICkgKXtcclxuXHJcblx0XHRcdFx0d3BiY190aXBweSggdGRfZWwgLCB7XHJcblx0XHRcdFx0XHRjb250ZW50KCByZWZlcmVuY2UgKXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBwb3BvdmVyX2NvbnRlbnQgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb250ZW50JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuICc8ZGl2IGNsYXNzPVwicG9wb3ZlciBwb3BvdmVyX3RpcHB5XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1jb250ZW50XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsgcG9wb3Zlcl9jb250ZW50XHJcblx0XHRcdFx0XHRcdFx0XHRcdCsgJzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHQgKyAnPC9kaXY+JztcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRhbGxvd0hUTUwgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHRyaWdnZXJcdFx0XHQgOiAnbW91c2VlbnRlciBmb2N1cycsXHJcblx0XHRcdFx0XHRpbnRlcmFjdGl2ZSAgICAgIDogISB0cnVlLFxyXG5cdFx0XHRcdFx0aGlkZU9uQ2xpY2sgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRpbnRlcmFjdGl2ZUJvcmRlcjogMTAsXHJcblx0XHRcdFx0XHRtYXhXaWR0aCAgICAgICAgIDogNTUwLFxyXG5cdFx0XHRcdFx0dGhlbWUgICAgICAgICAgICA6ICd3cGJjLXRpcHB5LXRpbWVzJyxcclxuXHRcdFx0XHRcdHBsYWNlbWVudCAgICAgICAgOiAndG9wJyxcclxuXHRcdFx0XHRcdGRlbGF5XHRcdFx0IDogWzQwMCwgMF0sXHRcdFx0Ly8gRml4SW46IDkuNC4yLjIuXHJcblx0XHRcdFx0XHRpZ25vcmVBdHRyaWJ1dGVzIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHRvdWNoXHRcdFx0IDogdHJ1ZSxcdFx0XHRcdC8vWydob2xkJywgNTAwXSwgLy8gNTAwbXMgZGVsYXlcdFx0XHQvLyBGaXhJbjogOS4yLjEuNS5cclxuXHRcdFx0XHRcdGFwcGVuZFRvOiAoKSA9PiBkb2N1bWVudC5ib2R5LFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cclxuXHJcblxyXG4vKipcclxuICogICBBamF4ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggc2hvdyByZXF1ZXN0XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2FqYXhfcmVxdWVzdCgpe1xyXG5cclxuY29uc29sZS5ncm91cENvbGxhcHNlZCggJ1dQQkNfQUpYX0FWQUlMQUJJTElUWScgKTsgY29uc29sZS5sb2coICcgPT0gQmVmb3JlIEFqYXggU2VuZCAtIHNlYXJjaF9nZXRfYWxsX3BhcmFtcygpID09ICcgLCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgKTtcclxuXHJcblx0d3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpO1xyXG5cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0FWQUlMQUJJTElUWScsXHJcblx0XHRcdFx0XHR3cGJjX2FqeF91c2VyX2lkOiB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfbG9jYWxlIDogd3BiY19hanhfYXZhaWxhYmlsaXR5LmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICksXHJcblxyXG5cdFx0XHRcdFx0c2VhcmNoX3BhcmFtc1x0OiB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuc2VhcmNoX2dldF9hbGxfcGFyYW1zKClcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuXHJcbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX0FWQUlMQUJJTElUWSA9PSAnLCByZXNwb25zZV9kYXRhICk7IGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblx0XHRcdFx0XHQvLyBQcm9iYWJseSBFcnJvclxyXG5cdFx0XHRcdFx0aWYgKCAodHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnKSB8fCAocmVzcG9uc2VfZGF0YSA9PT0gbnVsbCkgKXtcclxuXHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhICk7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmVsb2FkIHBhZ2UsIGFmdGVyIGZpbHRlciB0b29sYmFyIGhhcyBiZWVuIHJlc2V0XHJcblx0XHRcdFx0XHRpZiAoICAgICAgICggICAgIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdKVxyXG5cdFx0XHRcdFx0XHRcdCYmICggJ3Jlc2V0X2RvbmUnID09PSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAnZG9fYWN0aW9uJyBdKVxyXG5cdFx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdFx0bG9jYXRpb24ucmVsb2FkKCk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBTaG93IGxpc3RpbmdcclxuXHRcdFx0XHRcdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fcGFnZV9jb250ZW50X19zaG93KCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXSAsIHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF0gKTtcclxuXHJcblx0XHRcdFx0XHQvL3dwYmNfYWp4X2F2YWlsYWJpbGl0eV9fZGVmaW5lX3VpX2hvb2tzKCk7XHRcdFx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MsIGJlY2F1c2Ugd2Ugc2hvdyBuZXcgRE9NIGVsZW1lbnRzXHJcblx0XHRcdFx0XHRpZiAoICcnICE9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSApe1xyXG5cdFx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgKCAnMScgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHQnIF0gKSA/ICdzdWNjZXNzJyA6ICdlcnJvcidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIDEwMDAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cdFx0XHRcdFx0Ly8gUmVtb3ZlIHNwaW4gaWNvbiBmcm9tICBidXR0b24gYW5kIEVuYWJsZSB0aGlzIGJ1dHRvbi5cclxuXHRcdFx0XHRcdHdwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiggcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXSApXHJcblxyXG5cdFx0XHRcdFx0alF1ZXJ5KCAnI2FqYXhfcmVzcG9uZCcgKS5odG1sKCByZXNwb25zZV9kYXRhICk7XHRcdC8vIEZvciBhYmlsaXR5IHRvIHNob3cgcmVzcG9uc2UsIGFkZCBzdWNoIERJViBlbGVtZW50IHRvIHBhZ2VcclxuXHRcdFx0XHR9XHJcblx0XHRcdCAgKS5mYWlsKCBmdW5jdGlvbiAoIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApIHsgICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdBamF4X0Vycm9yJywganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICk7IH1cclxuXHJcblx0XHRcdFx0XHR2YXIgZXJyb3JfbWVzc2FnZSA9ICc8c3Ryb25nPicgKyAnRXJyb3IhJyArICc8L3N0cm9uZz4gJyArIGVycm9yVGhyb3duIDtcclxuXHRcdFx0XHRcdGlmICgganFYSFIuc3RhdHVzICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyAoPGI+JyArIGpxWEhSLnN0YXR1cyArICc8L2I+KSc7XHJcblx0XHRcdFx0XHRcdGlmICg0MDMgPT0ganFYSFIuc3RhdHVzICl7XHJcblx0XHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnIFByb2JhYmx5IG5vbmNlIGZvciB0aGlzIHBhZ2UgaGFzIGJlZW4gZXhwaXJlZC4gUGxlYXNlIDxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDpsb2NhdGlvbi5yZWxvYWQoKTtcIj5yZWxvYWQgdGhlIHBhZ2U8L2E+Lic7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyAnICsganFYSFIucmVzcG9uc2VUZXh0O1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hanhfYXZhaWxhYmlsaXR5X19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgKTtcclxuXHRcdFx0ICB9KVxyXG5cdCAgICAgICAgICAvLyAuZG9uZSggICBmdW5jdGlvbiAoIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnc2Vjb25kIHN1Y2Nlc3MnLCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApOyB9ICAgIH0pXHJcblx0XHRcdCAgLy8gLmFsd2F5cyggZnVuY3Rpb24gKCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ2Fsd2F5cyBmaW5pc2hlZCcsIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICk7IH0gICAgIH0pXHJcblx0XHRcdCAgOyAgLy8gRW5kIEFqYXhcclxuXHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqICAgSCBvIG8gayBzICAtICBpdHMgQWN0aW9uL1RpbWVzIHdoZW4gbmVlZCB0byByZS1SZW5kZXIgVmlld3MgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2VuZCBBamF4IFNlYXJjaCBSZXF1ZXN0IGFmdGVyIFVwZGF0aW5nIHNlYXJjaCByZXF1ZXN0IHBhcmFtZXRlcnNcclxuICpcclxuICogQHBhcmFtIHBhcmFtc19hcnJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fc2VuZF9yZXF1ZXN0X3dpdGhfcGFyYW1zICggcGFyYW1zX2FyciApe1xyXG5cclxuXHQvLyBEZWZpbmUgZGlmZmVyZW50IFNlYXJjaCAgcGFyYW1ldGVycyBmb3IgcmVxdWVzdFxyXG5cdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApIHtcclxuXHRcdC8vY29uc29sZS5sb2coICdSZXF1ZXN0IGZvcjogJywgcF9rZXksIHBfdmFsICk7XHJcblx0XHR3cGJjX2FqeF9hdmFpbGFiaWxpdHkuc2VhcmNoX3NldF9wYXJhbSggcF9rZXksIHBfdmFsICk7XHJcblx0fSk7XHJcblxyXG5cdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHJcblx0d3BiY19hanhfYXZhaWxhYmlsaXR5X19hamF4X3JlcXVlc3QoKTtcclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2VhcmNoIHJlcXVlc3QgZm9yIFwiUGFnZSBOdW1iZXJcIlxyXG5cdCAqIEBwYXJhbSBwYWdlX251bWJlclx0aW50XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19wYWdpbmF0aW9uX2NsaWNrKCBwYWdlX251bWJlciApe1xyXG5cclxuXHRcdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fc2VuZF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nOiBwYWdlX251bWJlclxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFNob3cgLyBIaWRlIENvbnRlbnQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqICBTaG93IExpc3RpbmcgQ29udGVudCBcdC0gXHRTZW5kaW5nIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2FjdHVhbF9jb250ZW50X19zaG93KCl7XHJcblxyXG5cdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fYWpheF9yZXF1ZXN0KCk7XHRcdFx0Ly8gU2VuZCBBamF4IFJlcXVlc3RcdC1cdHdpdGggcGFyYW1ldGVycyB0aGF0ICB3ZSBlYXJseSAgZGVmaW5lZCBpbiBcIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZ1wiIE9iai5cclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgTGlzdGluZyBDb250ZW50XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2FjdHVhbF9jb250ZW50X19oaWRlKCl7XHJcblxyXG5cdGpRdWVyeSggIHdwYmNfYWp4X2F2YWlsYWJpbGl0eS5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSAgKS5odG1sKCAnJyApO1xyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIE0gZSBzIHMgYSBnIGUgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNob3cganVzdCBtZXNzYWdlIGluc3RlYWQgb2YgY29udGVudFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19zaG93X21lc3NhZ2UoIG1lc3NhZ2UgKXtcclxuXHJcblx0d3BiY19hanhfYXZhaWxhYmlsaXR5X19hY3R1YWxfY29udGVudF9faGlkZSgpO1xyXG5cclxuXHRqUXVlcnkoIHdwYmNfYWp4X2F2YWlsYWJpbGl0eS5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqICAgU3VwcG9ydCBGdW5jdGlvbnMgLSBTcGluIEljb24gaW4gQnV0dG9ucyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIFN0YXJ0XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCl7XHJcblx0alF1ZXJ5KCAnI3dwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b24gLm1lbnVfaWNvbi53cGJjX3NwaW4nKS5yZW1vdmVDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIFBhdXNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCl7XHJcblx0alF1ZXJ5KCAnI3dwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b24gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuYWRkQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBpcyBTcGlubmluZyA/XHJcbiAqXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9faXNfc3Bpbigpe1xyXG4gICAgaWYgKCBqUXVlcnkoICcjd3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbiAubWVudV9pY29uLndwYmNfc3BpbicgKS5oYXNDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApICl7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG4iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBRVo7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBLElBQUlBLHFCQUFxQixHQUFJLFVBQVdDLEdBQUcsRUFBRUMsQ0FBQyxFQUFFO0VBRS9DO0VBQ0EsSUFBSUMsUUFBUSxHQUFHRixHQUFHLENBQUNHLFlBQVksR0FBR0gsR0FBRyxDQUFDRyxZQUFZLElBQUk7SUFDeENDLE9BQU8sRUFBRSxDQUFDO0lBQ1ZDLEtBQUssRUFBSSxFQUFFO0lBQ1hDLE1BQU0sRUFBRztFQUNSLENBQUM7RUFFaEJOLEdBQUcsQ0FBQ08sZ0JBQWdCLEdBQUcsVUFBV0MsU0FBUyxFQUFF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
