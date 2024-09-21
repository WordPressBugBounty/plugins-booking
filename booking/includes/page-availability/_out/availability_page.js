"use strict";

/**
 * Request Object
 * Here we can  define Search parameters and Update it later,  when  some parameter was changed
 *
 */
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
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
											calendar__timeslot_day_bg_as_available: ""
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
   * 		$( 'body' ).trigger( 'wpbc_datepick_inline_calendar_refresh', ...		//FixIn: 9.4.4.13
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
   * 		$( 'body' ).trigger( 'wpbc_datepick_inline_calendar_loaded', ...		//FixIn: 9.4.4.12
   */
  jQuery('body').on('wpbc_datepick_inline_calendar_loaded', function (event, resource_id, jCalContainer, inst) {
    // Remove highlight day for today  date
    jQuery('.datepick-days-cell.datepick-today.datepick-days-cell-over').removeClass('datepick-days-cell-over');

    // Set height of calendar  cells if defined this option
    if ('' !== calendar_params_arr.ajx_cleaned_params.calendar__view__cell_height) {
      jQuery('head').append('<style type="text/css">' + '.hasDatepick .datepick-inline .datepick-title-row th, ' + '.hasDatepick .datepick-inline .datepick-days-cell {' + 'height: ' + calendar_params_arr.ajx_cleaned_params.calendar__view__cell_height + ' !important;' + '}' + '</style>');
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
  jQuery('.wpbc_ajx_avy__calendar').html('<div class="' + ' bk_calendar_frame' + ' months_num_in_row_' + calendar_params_arr.ajx_cleaned_params.calendar__view__months_in_row + ' cal_month_num_' + calendar_params_arr.ajx_cleaned_params.calendar__view__visible_months + ' ' + calendar_params_arr.ajx_cleaned_params.calendar__timeslot_day_bg_as_available // 'wpbc_timeslot_day_bg_as_available' || ''
  + '" ' + 'style="' + width + '">' + '<div id="calendar_booking' + calendar_params_arr.resource_id + '">' + 'Calendar is loading...' + '</div>' + '</div>' + '<textarea      id="date_booking' + calendar_params_arr.resource_id + '"' + ' name="date_booking' + calendar_params_arr.resource_id + '"' + ' autocomplete="off"' + ' style="display:none;width:100%;height:10em;margin:2em 0 0;"></textarea>');

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
    beforeShowDay: function beforeShowDay(date) {
      return wpbc__inline_booking_calendar__apply_css_to_days(date, calendar_params_arr, this);
    },
    onSelect: function onSelect(date) {
      jQuery('#' + calendar_params_arr.text_id).val(date);
      //wpbc_blink_element('.wpbc_widget_available_unavailable', 3, 220);
      return wpbc__inline_booking_calendar__on_days_select(date, calendar_params_arr, this);
    },
    onHover: function onHover(value, date) {
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

  // BEFORE_AFTER :: Set unavailable days Before / After the Today date
  if (wpbc_dates__days_between(date, today_date) < parseInt(_wpbc.get_other_param('availability__unavailable_from_today')) || parseInt('0' + parseInt(_wpbc.get_other_param('availability__available_from_today'))) > 0 && wpbc_dates__days_between(date, today_date) > parseInt('0' + parseInt(_wpbc.get_other_param('availability__available_from_today')))) {
    return [!!false, css_date__standard + ' date_user_unavailable' + ' before_after_unavailable'];
  }

  // SEASONS ::  					Booking > Resources > Availability page
  var is_date_available = calendar_params_arr.season_availability[sql_class_day];
  if (false === is_date_available) {
    //FixIn: 9.5.4.4
    return [!!false, css_date__standard + ' date_user_unavailable' + ' season_unavailable'];
  }

  // RESOURCE_UNAVAILABLE ::   	Booking > Availability page
  if (wpbc_in_array(calendar_params_arr.resource_unavailable_dates, sql_class_day)) {
    is_date_available = false;
  }
  if (false === is_date_available) {
    //FixIn: 9.5.4.4
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
function wpbc__inline_booking_calendar__on_days_select(dates_selection, calendar_params_arr) {
  var datepick_this = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
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
  for (var i = 0; i < aDays.length; i++) {
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
      content: function content(reference) {
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
      //FixIn: 9.4.2.2
      ignoreAttributes: true,
      touch: true,
      //['hold', 500], // 500ms delay			//FixIn: 9.2.1.5
      appendTo: function appendTo() {
        return document.body;
      }
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
    if (_typeof(response_data) !== 'object' || response_data === null) {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHkvX291dC9hdmFpbGFiaWxpdHlfcGFnZS5qcyIsIm5hbWVzIjpbIl90eXBlb2YiLCJvYmoiLCJTeW1ib2wiLCJpdGVyYXRvciIsImNvbnN0cnVjdG9yIiwicHJvdG90eXBlIiwid3BiY19hanhfYXZhaWxhYmlsaXR5IiwiJCIsInBfc2VjdXJlIiwic2VjdXJpdHlfb2JqIiwidXNlcl9pZCIsIm5vbmNlIiwibG9jYWxlIiwic2V0X3NlY3VyZV9wYXJhbSIsInBhcmFtX2tleSIsInBhcmFtX3ZhbCIsImdldF9zZWN1cmVfcGFyYW0iLCJwX2xpc3RpbmciLCJzZWFyY2hfcmVxdWVzdF9vYmoiLCJzZWFyY2hfc2V0X2FsbF9wYXJhbXMiLCJyZXF1ZXN0X3BhcmFtX29iaiIsInNlYXJjaF9nZXRfYWxsX3BhcmFtcyIsInNlYXJjaF9nZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtIiwic2VhcmNoX3NldF9wYXJhbXNfYXJyIiwicGFyYW1zX2FyciIsIl8iLCJlYWNoIiwicF92YWwiLCJwX2tleSIsInBfZGF0YSIsInBfb3RoZXIiLCJvdGhlcl9vYmoiLCJzZXRfb3RoZXJfcGFyYW0iLCJnZXRfb3RoZXJfcGFyYW0iLCJqUXVlcnkiLCJ3cGJjX2FqeF9ib29raW5ncyIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fcGFnZV9jb250ZW50X19zaG93IiwiYWp4X2RhdGFfYXJyIiwiYWp4X3NlYXJjaF9wYXJhbXMiLCJhanhfY2xlYW5lZF9wYXJhbXMiLCJ0ZW1wbGF0ZV9fYXZhaWxhYmlsaXR5X21haW5fcGFnZV9jb250ZW50Iiwid3AiLCJ0ZW1wbGF0ZSIsImh0bWwiLCJwYXJlbnQiLCJoaWRlIiwid3BiY19hanhfYXZhaWxhYmlsaXR5X19jYWxlbmRhcl9fc2hvdyIsInJlc291cmNlX2lkIiwiYWp4X25vbmNlX2NhbGVuZGFyIiwidHJpZ2dlciIsImNhbGVuZGFyX3BhcmFtc19hcnIiLCJvbiIsImV2ZW50IiwiaW5zdCIsImRwRGl2IiwiZmluZCIsInRoaXNfZXZlbnQiLCJqQ2VsbCIsImN1cnJlbnRUYXJnZXQiLCJ3cGJjX2F2eV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCIsImpDYWxDb250YWluZXIiLCJyZW1vdmVDbGFzcyIsImNhbGVuZGFyX192aWV3X19jZWxsX2hlaWdodCIsImFwcGVuZCIsIndpZHRoIiwiY2FsZW5kYXJfX3ZpZXdfX3dpZHRoIiwidW5kZWZpbmVkIiwiY2FsZW5kYXJfX3ZpZXdfX21heF93aWR0aCIsImNhbGVuZGFyX192aWV3X19tb250aHNfaW5fcm93IiwiY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzIiwiY2FsZW5kYXJfX3RpbWVzbG90X2RheV9iZ19hc19hdmFpbGFibGUiLCJjYWxfcGFyYW1fYXJyIiwiY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5IiwiY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUiLCJib29rZWRfZGF0ZXMiLCJzZWFzb25fYXZhaWxhYmlsaXR5IiwicmVzb3VyY2VfdW5hdmFpbGFibGVfZGF0ZXMiLCJ3cGJjX3Nob3dfaW5saW5lX2Jvb2tpbmdfY2FsZW5kYXIiLCJ3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19zZWxlY3QiLCJ0ZXh0X2lkIiwidmFsIiwicG9wb3Zlcl9oaW50cyIsInRvb2xiYXJfdGV4dCIsImh0bWxfaWQiLCJsZW5ndGgiLCJoYXNDbGFzcyIsInRleHQiLCJkYXRlcGljayIsImJlZm9yZVNob3dEYXkiLCJkYXRlIiwid3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzIiwib25TZWxlY3QiLCJvbkhvdmVyIiwidmFsdWUiLCJ3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19ob3ZlciIsIm9uQ2hhbmdlTW9udGhZZWFyIiwic2hvd09uIiwibnVtYmVyT2ZNb250aHMiLCJzdGVwTW9udGhzIiwicHJldlRleHQiLCJuZXh0VGV4dCIsImRhdGVGb3JtYXQiLCJjaGFuZ2VNb250aCIsImNoYW5nZVllYXIiLCJtaW5EYXRlIiwibWF4RGF0ZSIsInNob3dTdGF0dXMiLCJjbG9zZUF0VG9wIiwiZmlyc3REYXkiLCJnb3RvQ3VycmVudCIsImhpZGVJZk5vUHJldk5leHQiLCJtdWx0aVNlcGFyYXRvciIsIm11bHRpU2VsZWN0IiwicmFuZ2VTZWxlY3QiLCJyYW5nZVNlcGFyYXRvciIsInVzZVRoZW1lUm9sbGVyIiwiZGF0ZXBpY2tfdGhpcyIsInRvZGF5X2RhdGUiLCJEYXRlIiwiX3dwYmMiLCJwYXJzZUludCIsImNsYXNzX2RheSIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsImdldEZ1bGxZZWFyIiwic3FsX2NsYXNzX2RheSIsIndwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUiLCJjc3NfZGF0ZV9fc3RhbmRhcmQiLCJjc3NfZGF0ZV9fYWRkaXRpb25hbCIsImdldERheSIsImkiLCJ3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4iLCJpc19kYXRlX2F2YWlsYWJsZSIsIndwYmNfaW5fYXJyYXkiLCJib29raW5nc19pbl9kYXRlIiwiYXBwcm92ZWQiLCJPYmplY3QiLCJrZXlzIiwiaXNfYXBwcm92ZWQiLCJ0cyIsImJvb2tpbmdfZGF0ZSIsInN1YnN0cmluZyIsIl9nZXRJbnN0IiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsImRhdGVzIiwidGRfY2xhc3MiLCJ0ZF9vdmVycyIsImlzX2NoZWNrIiwic2VsY2V0ZWRfZmlyc3RfZGF5Iiwic2V0RnVsbFllYXIiLCJhZGRDbGFzcyIsImRhdGVzX3NlbGVjdGlvbiIsImFyZ3VtZW50cyIsImRhdGVzX2FyciIsImluZGV4T2YiLCJ3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfcmFuZ2VfanMiLCJ3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfY29tbWFfc2VwYXJhdGVkX2pzIiwid3BiY19hdnlfYWZ0ZXJfZGF5c19zZWxlY3Rpb25fX3Nob3dfaGVscF9pbmZvIiwicGFyYW1zIiwibWVzc2FnZSIsImNvbG9yIiwiaXMiLCJ0b29sYmFyX3RleHRfYXZhaWxhYmxlIiwidG9vbGJhcl90ZXh0X3VuYXZhaWxhYmxlIiwiZmlyc3RfZGF0ZSIsImxhc3RfZGF0ZSIsImZvcm1hdERhdGUiLCJkYXRlc19jbGlja19udW0iLCJhdHRyIiwid3BiY19ibGlua19lbGVtZW50IiwicmVwbGFjZSIsInB1c2giLCJqb2luIiwic3BsaXQiLCJzb3J0IiwiY2hlY2tfaW5fZGF0ZV95bWQiLCJjaGVja19vdXRfZGF0ZV95bWQiLCJ3cGJjX2dldF9kYXRlc19hcnJheV9mcm9tX3N0YXJ0X2VuZF9kYXlzX2pzIiwic1N0YXJ0RGF0ZSIsInNFbmREYXRlIiwiYURheXMiLCJnZXRUaW1lIiwic0N1cnJlbnREYXRlIiwib25lX2RheV9kdXJhdGlvbiIsInNldFRpbWUiLCJ3cGJjX2F2eV9fcHJlcGFyZV90b29sdGlwX19pbl9jYWxlbmRhciIsInRvb2x0aXBfdGltZSIsInRkX2VsIiwiZ2V0IiwiX3RpcHB5Iiwid3BiY190aXBweSIsImNvbnRlbnQiLCJyZWZlcmVuY2UiLCJwb3BvdmVyX2NvbnRlbnQiLCJnZXRBdHRyaWJ1dGUiLCJhbGxvd0hUTUwiLCJpbnRlcmFjdGl2ZSIsImhpZGVPbkNsaWNrIiwiaW50ZXJhY3RpdmVCb3JkZXIiLCJtYXhXaWR0aCIsInRoZW1lIiwicGxhY2VtZW50IiwiZGVsYXkiLCJpZ25vcmVBdHRyaWJ1dGVzIiwidG91Y2giLCJhcHBlbmRUbyIsImJvZHkiLCJ3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2FqYXhfcmVxdWVzdCIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsIndwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQiLCJwb3N0Iiwid3BiY191cmxfYWpheCIsImFjdGlvbiIsIndwYmNfYWp4X3VzZXJfaWQiLCJ3cGJjX2FqeF9sb2NhbGUiLCJzZWFyY2hfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwid3BiY19hanhfYXZhaWxhYmlsaXR5X19zaG93X21lc3NhZ2UiLCJsb2NhdGlvbiIsInJlbG9hZCIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwid3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiIsImZhaWwiLCJlcnJvclRocm93biIsIndpbmRvdyIsImVycm9yX21lc3NhZ2UiLCJzdGF0dXMiLCJyZXNwb25zZVRleHQiLCJ3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fcGFnaW5hdGlvbl9jbGljayIsInBhZ2VfbnVtYmVyIiwid3BiY19hanhfYXZhaWxhYmlsaXR5X19hY3R1YWxfY29udGVudF9fc2hvdyIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fYWN0dWFsX2NvbnRlbnRfX2hpZGUiLCJ3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uX19pc19zcGluIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHkvX3NyYy9hdmFpbGFiaWxpdHlfcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBSZXF1ZXN0IE9iamVjdFxyXG4gKiBIZXJlIHdlIGNhbiAgZGVmaW5lIFNlYXJjaCBwYXJhbWV0ZXJzIGFuZCBVcGRhdGUgaXQgbGF0ZXIsICB3aGVuICBzb21lIHBhcmFtZXRlciB3YXMgY2hhbmdlZFxyXG4gKlxyXG4gKi9cclxuXHJcbnZhciB3cGJjX2FqeF9hdmFpbGFiaWxpdHkgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gU2VjdXJlIHBhcmFtZXRlcnMgZm9yIEFqYXhcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlY3VyZSA9IG9iai5zZWN1cml0eV9vYmogPSBvYmouc2VjdXJpdHlfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcl9pZDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bm9uY2UgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsZSA6ICcnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH07XHJcblxyXG5cdG9iai5zZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfc2VjdXJlWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfc2VjdXJlWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gTGlzdGluZyBTZWFyY2ggcGFyYW1ldGVyc1x0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfbGlzdGluZyA9IG9iai5zZWFyY2hfcmVxdWVzdF9vYmogPSBvYmouc2VhcmNoX3JlcXVlc3Rfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc29ydCAgICAgICAgICAgIDogXCJib29raW5nX2lkXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvcnRfdHlwZSAgICAgICA6IFwiREVTQ1wiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBwYWdlX251bSAgICAgICAgOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBwYWdlX2l0ZW1zX2NvdW50OiAxMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY3JlYXRlX2RhdGUgICAgIDogXCJcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8ga2V5d29yZCAgICAgICAgIDogXCJcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc291cmNlICAgICAgICAgIDogXCJcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfYWxsX3BhcmFtcyA9IGZ1bmN0aW9uICggcmVxdWVzdF9wYXJhbV9vYmogKSB7XHJcblx0XHRwX2xpc3RpbmcgPSByZXF1ZXN0X3BhcmFtX29iajtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX2dldF9hbGxfcGFyYW1zID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfbGlzdGluZztcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX2dldF9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfbGlzdGluZ1sgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0Ly8gaWYgKCBBcnJheS5pc0FycmF5KCBwYXJhbV92YWwgKSApe1xyXG5cdFx0Ly8gXHRwYXJhbV92YWwgPSBKU09OLnN0cmluZ2lmeSggcGFyYW1fdmFsICk7XHJcblx0XHQvLyB9XHJcblx0XHRwX2xpc3RpbmdbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X3BhcmFtc19hcnIgPSBmdW5jdGlvbiggcGFyYW1zX2FyciApe1xyXG5cdFx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRGVmaW5lIGRpZmZlcmVudCBTZWFyY2ggIHBhcmFtZXRlcnMgZm9yIHJlcXVlc3RcclxuXHRcdFx0dGhpcy5zZWFyY2hfc2V0X3BhcmFtKCBwX2tleSwgcF92YWwgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyBPdGhlciBwYXJhbWV0ZXJzIFx0XHRcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX290aGVyID0gb2JqLm90aGVyX29iaiA9IG9iai5vdGhlcl9vYmogfHwgeyB9O1xyXG5cclxuXHRvYmouc2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfb3RoZXJbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX290aGVyWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0cmV0dXJuIG9iajtcclxufSggd3BiY19hanhfYXZhaWxhYmlsaXR5IHx8IHt9LCBqUXVlcnkgKSk7XHJcblxyXG52YXIgd3BiY19hanhfYm9va2luZ3MgPSBbXTtcclxuXHJcbi8qKlxyXG4gKiAgIFNob3cgQ29udGVudCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNob3cgQ29udGVudCAtIENhbGVuZGFyIGFuZCBVSSBlbGVtZW50c1xyXG4gKlxyXG4gKiBAcGFyYW0gYWp4X2RhdGFfYXJyXHJcbiAqIEBwYXJhbSBhanhfc2VhcmNoX3BhcmFtc1xyXG4gKiBAcGFyYW0gYWp4X2NsZWFuZWRfcGFyYW1zXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3BhZ2VfY29udGVudF9fc2hvdyggYWp4X2RhdGFfYXJyLCBhanhfc2VhcmNoX3BhcmFtcyAsIGFqeF9jbGVhbmVkX3BhcmFtcyApe1xyXG5cclxuXHR2YXIgdGVtcGxhdGVfX2F2YWlsYWJpbGl0eV9tYWluX3BhZ2VfY29udGVudCA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfYXZhaWxhYmlsaXR5X21haW5fcGFnZV9jb250ZW50JyApO1xyXG5cclxuXHQvLyBDb250ZW50XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKCB0ZW1wbGF0ZV9fYXZhaWxhYmlsaXR5X21haW5fcGFnZV9jb250ZW50KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9kYXRhJyAgICAgICAgICAgICAgOiBhanhfZGF0YV9hcnIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9zZWFyY2hfcGFyYW1zJyAgICAgOiBhanhfc2VhcmNoX3BhcmFtcyxcdFx0XHRcdFx0XHRcdFx0Ly8gJF9SRVFVRVNUWyAnc2VhcmNoX3BhcmFtcycgXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfY2xlYW5lZF9wYXJhbXMnICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0gKSApO1xyXG5cclxuXHRqUXVlcnkoICcud3BiY19wcm9jZXNzaW5nLndwYmNfc3BpbicpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICkuaGlkZSgpO1xyXG5cdC8vIExvYWQgY2FsZW5kYXJcclxuXHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2NhbGVuZGFyX19zaG93KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnICAgICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcic6IGFqeF9kYXRhX2Fyci5hanhfbm9uY2VfY2FsZW5kYXIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2RhdGFfYXJyJyAgICAgICAgICA6IGFqeF9kYXRhX2FycixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfY2xlYW5lZF9wYXJhbXMnICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogVHJpZ2dlciBmb3IgZGF0ZXMgc2VsZWN0aW9uIGluIHRoZSBib29raW5nIGZvcm1cclxuXHQgKlxyXG5cdCAqIGpRdWVyeSggd3BiY19hanhfYXZhaWxhYmlsaXR5LmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkub24oJ3dwYmNfcGFnZV9jb250ZW50X2xvYWRlZCcsIGZ1bmN0aW9uKGV2ZW50LCBhanhfZGF0YV9hcnIsIGFqeF9zZWFyY2hfcGFyYW1zICwgYWp4X2NsZWFuZWRfcGFyYW1zKSB7IC4uLiB9ICk7XHJcblx0ICovXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS50cmlnZ2VyKCAnd3BiY19wYWdlX2NvbnRlbnRfbG9hZGVkJywgWyBhanhfZGF0YV9hcnIsIGFqeF9zZWFyY2hfcGFyYW1zICwgYWp4X2NsZWFuZWRfcGFyYW1zIF0gKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaG93IGlubGluZSBtb250aCB2aWV3IGNhbGVuZGFyICAgICAgICAgICAgICB3aXRoIGFsbCBwcmVkZWZpbmVkIENTUyAoc2l6ZXMgYW5kIGNoZWNrIGluL291dCwgIHRpbWVzIGNvbnRhaW5lcnMpXHJcbiAqIEBwYXJhbSB7b2JqfSBjYWxlbmRhcl9wYXJhbXNfYXJyXHJcblx0XHRcdHtcclxuXHRcdFx0XHQncmVzb3VyY2VfaWQnICAgICAgIFx0OiBhanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcidcdDogYWp4X2RhdGFfYXJyLmFqeF9ub25jZV9jYWxlbmRhcixcclxuXHRcdFx0XHQnYWp4X2RhdGFfYXJyJyAgICAgICAgICA6IGFqeF9kYXRhX2FyciA9IHsgYWp4X2Jvb2tpbmdfcmVzb3VyY2VzOltdLCBib29rZWRfZGF0ZXM6IHt9LCByZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlczpbXSwgc2Vhc29uX2F2YWlsYWJpbGl0eTp7fSwuLi4uIH1cclxuXHRcdFx0XHQnYWp4X2NsZWFuZWRfcGFyYW1zJyAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlOiBcImR5bmFtaWNcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5OiBcIjBcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3RpbWVzbG90X2RheV9iZ19hc19hdmFpbGFibGU6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX192aWV3X19jZWxsX2hlaWdodDogXCJcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3ZpZXdfX21vbnRoc19pbl9yb3c6IDRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRoczogMTJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX192aWV3X193aWR0aDogXCIxMDAlXCJcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19hdmFpbGFiaWxpdHk6IFwidW5hdmFpbGFibGVcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfc2VsZWN0aW9uOiBcIjIwMjMtMDMtMTQgfiAyMDIzLTAzLTE2XCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRvX2FjdGlvbjogXCJzZXRfYXZhaWxhYmlsaXR5XCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlc291cmNlX2lkOiAxXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1aV9jbGlja2VkX2VsZW1lbnRfaWQ6IFwid3BiY19hdmFpbGFiaWxpdHlfYXBwbHlfYnRuXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVpX3Vzcl9fYXZhaWxhYmlsaXR5X3NlbGVjdGVkX3Rvb2xiYXI6IFwiaW5mb1wiXHJcblx0XHRcdFx0XHRcdFx0XHQgIFx0XHQgfVxyXG5cdFx0XHR9XHJcbiovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fY2FsZW5kYXJfX3Nob3coIGNhbGVuZGFyX3BhcmFtc19hcnIgKXtcclxuXHJcblx0Ly8gVXBkYXRlIG5vbmNlXHJcblx0alF1ZXJ5KCAnI2FqeF9ub25jZV9jYWxlbmRhcl9zZWN0aW9uJyApLmh0bWwoIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X25vbmNlX2NhbGVuZGFyICk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gVXBkYXRlIGJvb2tpbmdzXHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PSB0eXBlb2YgKHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0pICl7IHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0gPSBbXTsgfVxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0gPSBjYWxlbmRhcl9wYXJhbXNfYXJyWyAnYWp4X2RhdGFfYXJyJyBdWyAnYm9va2VkX2RhdGVzJyBdO1xyXG5cclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgc2hvd2luZyBtb3VzZSBvdmVyIHRvb2x0aXAgb24gdW5hdmFpbGFibGUgZGF0ZXNcclxuXHQgKiBJdCdzIGRlZmluZWQsIHdoZW4gY2FsZW5kYXIgUkVGUkVTSEVEIChjaGFuZ2UgbW9udGhzIG9yIGRheXMgc2VsZWN0aW9uKSBsb2FkZWQgaW4ganF1ZXJ5LmRhdGVwaWNrLndwYmMuOS4wLmpzIDpcclxuXHQgKiBcdFx0JCggJ2JvZHknICkudHJpZ2dlciggJ3dwYmNfZGF0ZXBpY2tfaW5saW5lX2NhbGVuZGFyX3JlZnJlc2gnLCAuLi5cdFx0Ly9GaXhJbjogOS40LjQuMTNcclxuXHQgKi9cclxuXHRqUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19kYXRlcGlja19pbmxpbmVfY2FsZW5kYXJfcmVmcmVzaCcsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBpbnN0ICl7XHJcblx0XHQvLyBpbnN0LmRwRGl2ICBpdCdzOiAgPGRpdiBjbGFzcz1cImRhdGVwaWNrLWlubGluZSBkYXRlcGljay1tdWx0aVwiIHN0eWxlPVwid2lkdGg6IDE3NzEycHg7XCI+Li4uLjwvZGl2PlxyXG5cdFx0aW5zdC5kcERpdi5maW5kKCAnLnNlYXNvbl91bmF2YWlsYWJsZSwuYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlLC53ZWVrZGF5c191bmF2YWlsYWJsZScgKS5vbiggJ21vdXNlb3ZlcicsIGZ1bmN0aW9uICggdGhpc19ldmVudCApe1xyXG5cdFx0XHQvLyBhbHNvIGF2YWlsYWJsZSB0aGVzZSB2YXJzOiBcdHJlc291cmNlX2lkLCBqQ2FsQ29udGFpbmVyLCBpbnN0XHJcblx0XHRcdHZhciBqQ2VsbCA9IGpRdWVyeSggdGhpc19ldmVudC5jdXJyZW50VGFyZ2V0ICk7XHJcblx0XHRcdHdwYmNfYXZ5X19zaG93X3Rvb2x0aXBfX2Zvcl9lbGVtZW50KCBqQ2VsbCwgY2FsZW5kYXJfcGFyYW1zX2FyclsgJ2FqeF9kYXRhX2FycicgXVsncG9wb3Zlcl9oaW50cyddICk7XHJcblx0XHR9KTtcclxuXHJcblx0fVx0KTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgaGVpZ2h0IG9mIHRoZSBjYWxlbmRhciAgY2VsbHMsIFx0YW5kICBtb3VzZSBvdmVyIHRvb2x0aXBzIGF0ICBzb21lIHVuYXZhaWxhYmxlIGRhdGVzXHJcblx0ICogSXQncyBkZWZpbmVkLCB3aGVuIGNhbGVuZGFyIGxvYWRlZCBpbiBqcXVlcnkuZGF0ZXBpY2sud3BiYy45LjAuanMgOlxyXG5cdCAqIFx0XHQkKCAnYm9keScgKS50cmlnZ2VyKCAnd3BiY19kYXRlcGlja19pbmxpbmVfY2FsZW5kYXJfbG9hZGVkJywgLi4uXHRcdC8vRml4SW46IDkuNC40LjEyXHJcblx0ICovXHJcblx0alF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfZGF0ZXBpY2tfaW5saW5lX2NhbGVuZGFyX2xvYWRlZCcsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBqQ2FsQ29udGFpbmVyLCBpbnN0ICl7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIGhpZ2hsaWdodCBkYXkgZm9yIHRvZGF5ICBkYXRlXHJcblx0XHRqUXVlcnkoICcuZGF0ZXBpY2stZGF5cy1jZWxsLmRhdGVwaWNrLXRvZGF5LmRhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApLnJlbW92ZUNsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7XHJcblxyXG5cdFx0Ly8gU2V0IGhlaWdodCBvZiBjYWxlbmRhciAgY2VsbHMgaWYgZGVmaW5lZCB0aGlzIG9wdGlvblxyXG5cdFx0aWYgKCAnJyAhPT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX2NlbGxfaGVpZ2h0ICl7XHJcblx0XHRcdGpRdWVyeSggJ2hlYWQnICkuYXBwZW5kKCAnPHN0eWxlIHR5cGU9XCJ0ZXh0L2Nzc1wiPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQrICcuaGFzRGF0ZXBpY2sgLmRhdGVwaWNrLWlubGluZSAuZGF0ZXBpY2stdGl0bGUtcm93IHRoLCAnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnLmhhc0RhdGVwaWNrIC5kYXRlcGljay1pbmxpbmUgLmRhdGVwaWNrLWRheXMtY2VsbCB7J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnaGVpZ2h0OiAnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX2NlbGxfaGVpZ2h0ICsgJyAhaW1wb3J0YW50OydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQrICd9J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQrJzwvc3R5bGU+JyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIERlZmluZSBzaG93aW5nIG1vdXNlIG92ZXIgdG9vbHRpcCBvbiB1bmF2YWlsYWJsZSBkYXRlc1xyXG5cdFx0akNhbENvbnRhaW5lci5maW5kKCAnLnNlYXNvbl91bmF2YWlsYWJsZSwuYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlLC53ZWVrZGF5c191bmF2YWlsYWJsZScgKS5vbiggJ21vdXNlb3ZlcicsIGZ1bmN0aW9uICggdGhpc19ldmVudCApe1xyXG5cdFx0XHQvLyBhbHNvIGF2YWlsYWJsZSB0aGVzZSB2YXJzOiBcdHJlc291cmNlX2lkLCBqQ2FsQ29udGFpbmVyLCBpbnN0XHJcblx0XHRcdHZhciBqQ2VsbCA9IGpRdWVyeSggdGhpc19ldmVudC5jdXJyZW50VGFyZ2V0ICk7XHJcblx0XHRcdHdwYmNfYXZ5X19zaG93X3Rvb2x0aXBfX2Zvcl9lbGVtZW50KCBqQ2VsbCwgY2FsZW5kYXJfcGFyYW1zX2FyclsgJ2FqeF9kYXRhX2FycicgXVsncG9wb3Zlcl9oaW50cyddICk7XHJcblx0XHR9KTtcclxuXHR9ICk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRGVmaW5lIHdpZHRoIG9mIGVudGlyZSBjYWxlbmRhclxyXG5cdHZhciB3aWR0aCA9ICAgJ3dpZHRoOidcdFx0KyAgIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X193aWR0aCArICc7JztcdFx0XHRcdFx0Ly8gdmFyIHdpZHRoID0gJ3dpZHRoOjEwMCU7bWF4LXdpZHRoOjEwMCU7JztcclxuXHJcblx0aWYgKCAgICggdW5kZWZpbmVkICE9IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19tYXhfd2lkdGggKVxyXG5cdFx0JiYgKCAnJyAhPSBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fbWF4X3dpZHRoIClcclxuXHQpe1xyXG5cdFx0d2lkdGggKz0gJ21heC13aWR0aDonIFx0KyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fbWF4X3dpZHRoICsgJzsnO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR3aWR0aCArPSAnbWF4LXdpZHRoOicgXHQrICggY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX21vbnRoc19pbl9yb3cgKiAzNDEgKSArICdweDsnO1xyXG5cdH1cclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBBZGQgY2FsZW5kYXIgY29udGFpbmVyOiBcIkNhbGVuZGFyIGlzIGxvYWRpbmcuLi5cIiAgYW5kIHRleHRhcmVhXHJcblx0alF1ZXJ5KCAnLndwYmNfYWp4X2F2eV9fY2FsZW5kYXInICkuaHRtbChcclxuXHJcblx0XHQnPGRpdiBjbGFzcz1cIidcdCsgJyBia19jYWxlbmRhcl9mcmFtZSdcclxuXHRcdFx0XHRcdFx0KyAnIG1vbnRoc19udW1faW5fcm93XycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fbW9udGhzX2luX3Jvd1xyXG5cdFx0XHRcdFx0XHQrICcgY2FsX21vbnRoX251bV8nIFx0KyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHNcclxuXHRcdFx0XHRcdFx0KyAnICcgXHRcdFx0XHRcdCsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3RpbWVzbG90X2RheV9iZ19hc19hdmFpbGFibGUgXHRcdFx0XHQvLyAnd3BiY190aW1lc2xvdF9kYXlfYmdfYXNfYXZhaWxhYmxlJyB8fCAnJ1xyXG5cdFx0XHRcdCsgJ1wiICdcclxuXHRcdFx0KyAnc3R5bGU9XCInICsgd2lkdGggKyAnXCI+J1xyXG5cclxuXHRcdFx0XHQrICc8ZGl2IGlkPVwiY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJ1wiPicgKyAnQ2FsZW5kYXIgaXMgbG9hZGluZy4uLicgKyAnPC9kaXY+J1xyXG5cclxuXHRcdCsgJzwvZGl2PidcclxuXHJcblx0XHQrICc8dGV4dGFyZWEgICAgICBpZD1cImRhdGVfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJ1wiJ1xyXG5cdFx0XHRcdFx0KyAnIG5hbWU9XCJkYXRlX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCArICdcIidcclxuXHRcdFx0XHRcdCsgJyBhdXRvY29tcGxldGU9XCJvZmZcIidcclxuXHRcdFx0XHRcdCsgJyBzdHlsZT1cImRpc3BsYXk6bm9uZTt3aWR0aDoxMDAlO2hlaWdodDoxMGVtO21hcmdpbjoyZW0gMCAwO1wiPjwvdGV4dGFyZWE+J1xyXG5cdCk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGNhbF9wYXJhbV9hcnIgPSB7XHJcblx0XHRcdFx0XHRcdFx0J2h0bWxfaWQnICAgICAgICAgICA6ICdjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdCd0ZXh0X2lkJyAgICAgICAgICAgOiAnZGF0ZV9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cclxuXHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5JzogXHQgIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX19zdGFydF93ZWVrX2RheSxcclxuXHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzJzogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzLFxyXG5cdFx0XHRcdFx0XHRcdCdjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSc6ICBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSxcclxuXHJcblx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX2lkJyAgICAgICAgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRcdFx0XHQnYWp4X25vbmNlX2NhbGVuZGFyJyA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLmFqeF9ub25jZV9jYWxlbmRhcixcclxuXHRcdFx0XHRcdFx0XHQnYm9va2VkX2RhdGVzJyAgICAgICA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLmJvb2tlZF9kYXRlcyxcclxuXHRcdFx0XHRcdFx0XHQnc2Vhc29uX2F2YWlsYWJpbGl0eSc6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnNlYXNvbl9hdmFpbGFiaWxpdHksXHJcblxyXG5cdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcycgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5yZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcyxcclxuXHJcblx0XHRcdFx0XHRcdFx0J3BvcG92ZXJfaGludHMnOiBjYWxlbmRhcl9wYXJhbXNfYXJyWyAnYWp4X2RhdGFfYXJyJyBdWydwb3BvdmVyX2hpbnRzJ11cdFx0Ly8geydzZWFzb25fdW5hdmFpbGFibGUnOicuLi4nLCd3ZWVrZGF5c191bmF2YWlsYWJsZSc6Jy4uLicsJ2JlZm9yZV9hZnRlcl91bmF2YWlsYWJsZSc6Jy4uLicsfVxyXG5cdFx0XHRcdFx0XHR9O1xyXG5cdHdwYmNfc2hvd19pbmxpbmVfYm9va2luZ19jYWxlbmRhciggY2FsX3BhcmFtX2FyciApO1xyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIE9uIGNsaWNrIEFWQUlMQUJMRSB8ICBVTkFWQUlMQUJMRSBidXR0b24gIGluIHdpZGdldFx0LVx0bmVlZCB0byAgY2hhbmdlIGhlbHAgZGF0ZXMgdGV4dFxyXG5cdCAqL1xyXG5cdGpRdWVyeSggJy53cGJjX3JhZGlvX19zZXRfZGF5c19hdmFpbGFiaWxpdHknICkub24oJ2NoYW5nZScsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBpbnN0ICl7XHJcblx0XHR3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19zZWxlY3QoIGpRdWVyeSggJyMnICsgY2FsX3BhcmFtX2Fyci50ZXh0X2lkICkudmFsKCkgLCBjYWxfcGFyYW1fYXJyICk7XHJcblx0fSk7XHJcblxyXG5cdC8vIFNob3cgXHQnU2VsZWN0IGRheXMgIGluIGNhbGVuZGFyIHRoZW4gc2VsZWN0IEF2YWlsYWJsZSAgLyAgVW5hdmFpbGFibGUgc3RhdHVzIGFuZCBjbGljayBBcHBseSBhdmFpbGFiaWxpdHkgYnV0dG9uLidcclxuXHRqUXVlcnkoICcjd3BiY190b29sYmFyX2RhdGVzX2hpbnQnKS5odG1sKCAgICAgJzxkaXYgY2xhc3M9XCJ1aV9lbGVtZW50XCI+PHNwYW4gY2xhc3M9XCJ3cGJjX3VpX2NvbnRyb2wgd3BiY191aV9hZGRvbiB3cGJjX2hlbHBfdGV4dFwiID4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyBjYWxfcGFyYW1fYXJyLnBvcG92ZXJfaGludHMudG9vbGJhcl90ZXh0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzwvc3Bhbj48L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFx0TG9hZCBEYXRlcGljayBJbmxpbmUgY2FsZW5kYXJcclxuICpcclxuICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0ZXhhbXBsZTp7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaHRtbF9pZCcgICAgICAgICAgIDogJ2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGV4dF9pZCcgICAgICAgICAgIDogJ2RhdGVfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5JzogXHQgIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX19zdGFydF93ZWVrX2RheSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHMnOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUnOiAgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUsXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX2lkJyAgICAgICAgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfbm9uY2VfY2FsZW5kYXInIDogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfZGF0YV9hcnIuYWp4X25vbmNlX2NhbGVuZGFyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tlZF9kYXRlcycgICAgICAgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5ib29rZWRfZGF0ZXMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2Vhc29uX2F2YWlsYWJpbGl0eSc6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnNlYXNvbl9hdmFpbGFiaWxpdHksXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzJyA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnJlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2hvd19pbmxpbmVfYm9va2luZ19jYWxlbmRhciggY2FsZW5kYXJfcGFyYW1zX2FyciApe1xyXG5cclxuXHRpZiAoXHJcblx0XHQgICAoIDAgPT09IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkubGVuZ3RoIClcdFx0XHRcdFx0XHRcdC8vIElmIGNhbGVuZGFyIERPTSBlbGVtZW50IG5vdCBleGlzdCB0aGVuIGV4aXN0XHJcblx0XHR8fCAoIHRydWUgPT09IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkuaGFzQ2xhc3MoICdoYXNEYXRlcGljaycgKSApXHQvLyBJZiB0aGUgY2FsZW5kYXIgd2l0aCB0aGUgc2FtZSBCb29raW5nIHJlc291cmNlIGFscmVhZHkgIGhhcyBiZWVuIGFjdGl2YXRlZCwgdGhlbiBleGlzdC5cclxuXHQpe1xyXG5cdCAgIHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ29uZmlndXJlIGFuZCBzaG93IGNhbGVuZGFyXHJcblx0alF1ZXJ5KCAnIycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmh0bWxfaWQgKS50ZXh0KCAnJyApO1xyXG5cdGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkuZGF0ZXBpY2soe1xyXG5cdFx0XHRcdFx0YmVmb3JlU2hvd0RheTogXHRmdW5jdGlvbiAoIGRhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzKCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcbiAgICAgICAgICAgICAgICAgICAgb25TZWxlY3Q6IFx0ICBcdGZ1bmN0aW9uICggZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci50ZXh0X2lkICkudmFsKCBkYXRlICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly93cGJjX2JsaW5rX2VsZW1lbnQoJy53cGJjX3dpZGdldF9hdmFpbGFibGVfdW5hdmFpbGFibGUnLCAzLCAyMjApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19zZWxlY3QoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIHRoaXMgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuICAgICAgICAgICAgICAgICAgICBvbkhvdmVyOiBcdFx0ZnVuY3Rpb24gKCB2YWx1ZSwgZGF0ZSApe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL3dwYmNfYXZ5X19wcmVwYXJlX3Rvb2x0aXBfX2luX2NhbGVuZGFyKCB2YWx1ZSwgZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgdGhpcyApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfaG92ZXIoIHZhbHVlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2VNb250aFllYXI6XHRudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgIHNob3dPbjogXHRcdFx0J2JvdGgnLFxyXG4gICAgICAgICAgICAgICAgICAgIG51bWJlck9mTW9udGhzOiBcdGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzLFxyXG4gICAgICAgICAgICAgICAgICAgIHN0ZXBNb250aHM6XHRcdFx0MSxcclxuICAgICAgICAgICAgICAgICAgICAvLyBwcmV2VGV4dDogXHRcdFx0JyZsYXF1bzsnLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIG5leHRUZXh0OiBcdFx0XHQnJnJhcXVvOycsXHJcblx0XHRcdFx0XHRwcmV2VGV4dCAgICAgIDogJyZsc2FxdW87JyxcclxuXHRcdFx0XHRcdG5leHRUZXh0ICAgICAgOiAnJnJzYXF1bzsnLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGVGb3JtYXQ6IFx0XHQneXktbW0tZGQnLC8vICdkZC5tbS55eScsXHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlTW9udGg6IFx0XHRmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VZZWFyOiBcdFx0ZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgbWluRGF0ZTogXHRcdFx0XHRcdCAwLFx0XHQvL251bGwsICAvL1Njcm9sbCBhcyBsb25nIGFzIHlvdSBuZWVkXHJcblx0XHRcdFx0XHRtYXhEYXRlOiBcdFx0XHRcdFx0JzEweScsXHQvLyBtaW5EYXRlOiBuZXcgRGF0ZSgyMDIwLCAyLCAxKSwgbWF4RGF0ZTogbmV3IERhdGUoMjAyMCwgOSwgMzEpLCBcdC8vIEFiaWxpdHkgdG8gc2V0IGFueSAgc3RhcnQgYW5kIGVuZCBkYXRlIGluIGNhbGVuZGFyXHJcbiAgICAgICAgICAgICAgICAgICAgc2hvd1N0YXR1czogXHRcdGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGNsb3NlQXRUb3A6IFx0XHRmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBmaXJzdERheTpcdFx0XHRjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19zdGFydF93ZWVrX2RheSxcclxuICAgICAgICAgICAgICAgICAgICBnb3RvQ3VycmVudDogXHRcdGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGhpZGVJZk5vUHJldk5leHQ6XHR0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIG11bHRpU2VwYXJhdG9yOiBcdCcsICcsXHJcblx0XHRcdFx0XHRtdWx0aVNlbGVjdDogKCgnZHluYW1pYycgPT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSkgPyAwIDogMzY1KSxcdFx0XHQvLyBNYXhpbXVtIG51bWJlciBvZiBzZWxlY3RhYmxlIGRhdGVzOlx0IFNpbmdsZSBkYXkgPSAwLCAgbXVsdGkgZGF5cyA9IDM2NVxyXG5cdFx0XHRcdFx0cmFuZ2VTZWxlY3Q6ICAoJ2R5bmFtaWMnID09IGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUpLFxyXG5cdFx0XHRcdFx0cmFuZ2VTZXBhcmF0b3I6IFx0JyB+ICcsXHRcdFx0XHRcdC8vJyAtICcsXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gc2hvd1dlZWtzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHVzZVRoZW1lUm9sbGVyOlx0XHRmYWxzZVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG5cdHJldHVybiAgdHJ1ZTtcclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgQ1NTIHRvIGNhbGVuZGFyIGRhdGUgY2VsbHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImh0bWxfaWRcIjogXCJjYWxlbmRhcl9ib29raW5nNFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcInRleHRfaWRcIjogXCJkYXRlX2Jvb2tpbmc0XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5XCI6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzXCI6IDEyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcInJlc291cmNlX2lkXCI6IDQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiYWp4X25vbmNlX2NhbGVuZGFyXCI6IFwiPGlucHV0IHR5cGU9XFxcImhpZGRlblxcXCIgLi4uIC8+XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiYm9va2VkX2RhdGVzXCI6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIxMi0yOC0yMDIyXCI6IFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJib29raW5nX2RhdGVcIjogXCIyMDIyLTEyLTI4IDAwOjAwOjAwXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJhcHByb3ZlZFwiOiBcIjFcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImJvb2tpbmdfaWRcIjogXCIyNlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2Vhc29uX2F2YWlsYWJpbGl0eSc6e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0wOVwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMFwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMVwiOiB0cnVlLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyBbYm9vbGVhbixzdHJpbmddXHQtIFsge3RydWUgLWF2YWlsYWJsZSB8IGZhbHNlIC0gdW5hdmFpbGFibGV9LCAnQ1NTIGNsYXNzZXMgZm9yIGNhbGVuZGFyIGRheSBjZWxsJyBdXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzKCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0dmFyIHRvZGF5X2RhdGUgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAwIF0sIChwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAxIF0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDIgXSwgMCwgMCwgMCApO1xyXG5cclxuXHRcdHZhciBjbGFzc19kYXkgID0gKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLScgKyBkYXRlLmdldERhdGUoKSArICctJyArIGRhdGUuZ2V0RnVsbFllYXIoKTtcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcyMDIzLTAxLTA5J1xyXG5cclxuXHRcdHZhciBjc3NfZGF0ZV9fc3RhbmRhcmQgICA9ICAnY2FsNGRhdGUtJyArIGNsYXNzX2RheTtcclxuXHRcdHZhciBjc3NfZGF0ZV9fYWRkaXRpb25hbCA9ICcgd3BiY193ZWVrZGF5XycgKyBkYXRlLmdldERheSgpICsgJyAnO1xyXG5cclxuXHRcdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHQvLyBXRUVLREFZUyA6OiBTZXQgdW5hdmFpbGFibGUgd2VlayBkYXlzIGZyb20gLSBTZXR0aW5ncyBHZW5lcmFsIHBhZ2UgaW4gXCJBdmFpbGFiaWxpdHlcIiBzZWN0aW9uXHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX3dlZWtfZGF5c191bmF2YWlsYWJsZScgKS5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRpZiAoIGRhdGUuZ2V0RGF5KCkgPT0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X193ZWVrX2RheXNfdW5hdmFpbGFibGUnIClbIGkgXSApIHtcclxuXHRcdFx0XHRyZXR1cm4gWyAhIWZhbHNlLCBjc3NfZGF0ZV9fc3RhbmRhcmQgKyAnIGRhdGVfdXNlcl91bmF2YWlsYWJsZScgXHQrICcgd2Vla2RheXNfdW5hdmFpbGFibGUnIF07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBCRUZPUkVfQUZURVIgOjogU2V0IHVuYXZhaWxhYmxlIGRheXMgQmVmb3JlIC8gQWZ0ZXIgdGhlIFRvZGF5IGRhdGVcclxuXHRcdGlmICggXHQoICh3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oIGRhdGUsIHRvZGF5X2RhdGUgKSkgPCBwYXJzZUludChfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX3VuYXZhaWxhYmxlX2Zyb21fdG9kYXknICkpIClcclxuXHRcdFx0IHx8IChcclxuXHRcdFx0XHQgICAoIHBhcnNlSW50KCAnMCcgKyBwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X19hdmFpbGFibGVfZnJvbV90b2RheScgKSApICkgPiAwIClcclxuXHRcdFx0XHQmJiAoIHdwYmNfZGF0ZXNfX2RheXNfYmV0d2VlbiggZGF0ZSwgdG9kYXlfZGF0ZSApID4gcGFyc2VJbnQoICcwJyArIHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX2F2YWlsYWJsZV9mcm9tX3RvZGF5JyApICkgKSApXHJcblx0XHRcdFx0KVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuIFsgISFmYWxzZSwgY3NzX2RhdGVfX3N0YW5kYXJkICsgJyBkYXRlX3VzZXJfdW5hdmFpbGFibGUnIFx0XHQrICcgYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFNFQVNPTlMgOjogIFx0XHRcdFx0XHRCb29raW5nID4gUmVzb3VyY2VzID4gQXZhaWxhYmlsaXR5IHBhZ2VcclxuXHRcdHZhciAgICBpc19kYXRlX2F2YWlsYWJsZSA9IGNhbGVuZGFyX3BhcmFtc19hcnIuc2Vhc29uX2F2YWlsYWJpbGl0eVsgc3FsX2NsYXNzX2RheSBdO1xyXG5cdFx0aWYgKCBmYWxzZSA9PT0gaXNfZGF0ZV9hdmFpbGFibGUgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogOS41LjQuNFxyXG5cdFx0XHRyZXR1cm4gWyAhIWZhbHNlLCBjc3NfZGF0ZV9fc3RhbmRhcmQgKyAnIGRhdGVfdXNlcl91bmF2YWlsYWJsZSdcdFx0KyAnIHNlYXNvbl91bmF2YWlsYWJsZScgXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBSRVNPVVJDRV9VTkFWQUlMQUJMRSA6OiAgIFx0Qm9va2luZyA+IEF2YWlsYWJpbGl0eSBwYWdlXHJcblx0XHRpZiAoIHdwYmNfaW5fYXJyYXkoY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcywgc3FsX2NsYXNzX2RheSApICl7XHJcblx0XHRcdGlzX2RhdGVfYXZhaWxhYmxlID0gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRpZiAoICBmYWxzZSA9PT0gaXNfZGF0ZV9hdmFpbGFibGUgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDkuNS40LjRcclxuXHRcdFx0cmV0dXJuIFsgIWZhbHNlLCBjc3NfZGF0ZV9fc3RhbmRhcmQgKyAnIGRhdGVfdXNlcl91bmF2YWlsYWJsZSdcdFx0KyAnIHJlc291cmNlX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHRcdC8vIElzIGFueSBib29raW5ncyBpbiB0aGlzIGRhdGUgP1xyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBjYWxlbmRhcl9wYXJhbXNfYXJyLmJvb2tlZF9kYXRlc1sgY2xhc3NfZGF5IF0gKSApIHtcclxuXHJcblx0XHRcdHZhciBib29raW5nc19pbl9kYXRlID0gY2FsZW5kYXJfcGFyYW1zX2Fyci5ib29rZWRfZGF0ZXNbIGNsYXNzX2RheSBdO1xyXG5cclxuXHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggYm9va2luZ3NfaW5fZGF0ZVsgJ3NlY18wJyBdICkgKSB7XHRcdFx0Ly8gXCJGdWxsIGRheVwiIGJvb2tpbmcgIC0+IChzZWNvbmRzID09IDApXHJcblxyXG5cdFx0XHRcdGNzc19kYXRlX19hZGRpdGlvbmFsICs9ICggJzAnID09PSBib29raW5nc19pbl9kYXRlWyAnc2VjXzAnIF0uYXBwcm92ZWQgKSA/ICcgZGF0ZTJhcHByb3ZlICcgOiAnIGRhdGVfYXBwcm92ZWQgJztcdFx0XHRcdC8vIFBlbmRpbmcgPSAnMCcgfCAgQXBwcm92ZWQgPSAnMSdcclxuXHRcdFx0XHRjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIGZ1bGxfZGF5X2Jvb2tpbmcnO1xyXG5cclxuXHRcdFx0XHRyZXR1cm4gWyAhZmFsc2UsIGNzc19kYXRlX19zdGFuZGFyZCArIGNzc19kYXRlX19hZGRpdGlvbmFsIF07XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBPYmplY3Qua2V5cyggYm9va2luZ3NfaW5fZGF0ZSApLmxlbmd0aCA+IDAgKXtcdFx0XHRcdC8vIFwiVGltZSBzbG90c1wiIEJvb2tpbmdzXHJcblxyXG5cdFx0XHRcdHZhciBpc19hcHByb3ZlZCA9IHRydWU7XHJcblxyXG5cdFx0XHRcdF8uZWFjaCggYm9va2luZ3NfaW5fZGF0ZSwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApIHtcclxuXHRcdFx0XHRcdGlmICggIXBhcnNlSW50KCBwX3ZhbC5hcHByb3ZlZCApICl7XHJcblx0XHRcdFx0XHRcdGlzX2FwcHJvdmVkID0gZmFsc2U7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR2YXIgdHMgPSBwX3ZhbC5ib29raW5nX2RhdGUuc3Vic3RyaW5nKCBwX3ZhbC5ib29raW5nX2RhdGUubGVuZ3RoIC0gMSApO1xyXG5cdFx0XHRcdFx0aWYgKCB0cnVlID09PSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdpc19lbmFibGVkX2NoYW5nZV9vdmVyJyApICl7XHJcblx0XHRcdFx0XHRcdGlmICggdHMgPT0gJzEnICkgeyBjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIGNoZWNrX2luX3RpbWUnICsgKChwYXJzZUludChwX3ZhbC5hcHByb3ZlZCkpID8gJyBjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnIDogJyBjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScpOyB9XHJcblx0XHRcdFx0XHRcdGlmICggdHMgPT0gJzInICkgeyBjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIGNoZWNrX291dF90aW1lJyArICgocGFyc2VJbnQocF92YWwuYXBwcm92ZWQpKSA/ICcgY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcgOiAnIGNoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZScpOyB9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgaXNfYXBwcm92ZWQgKXtcclxuXHRcdFx0XHRcdGNzc19kYXRlX19hZGRpdGlvbmFsICs9ICcgZGF0ZTJhcHByb3ZlIHRpbWVzcGFydGx5J1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIGRhdGVfYXBwcm92ZWQgdGltZXNwYXJ0bHknXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoICEgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnaXNfZW5hYmxlZF9jaGFuZ2Vfb3ZlcicgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gJyB0aW1lc19jbG9jaydcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRyZXR1cm4gWyB0cnVlLCBjc3NfZGF0ZV9fc3RhbmRhcmQgKyBjc3NfZGF0ZV9fYWRkaXRpb25hbCArICcgZGF0ZV9hdmFpbGFibGUnIF07XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgc29tZSBDU1MgY2xhc3Nlcywgd2hlbiB3ZSBtb3VzZSBvdmVyIHNwZWNpZmljIGRhdGVzIGluIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHZhbHVlXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0LSAgSmF2YVNjcmlwdCBEYXRlIE9iajogIFx0XHRNb24gRGVjIDExIDIwMjMgMDA6MDA6MDAgR01UKzAyMDAgKEVhc3Rlcm4gRXVyb3BlYW4gU3RhbmRhcmQgVGltZSlcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiaHRtbF9pZFwiOiBcImNhbGVuZGFyX2Jvb2tpbmc0XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwidGV4dF9pZFwiOiBcImRhdGVfYm9va2luZzRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJjYWxlbmRhcl9fc3RhcnRfd2Vla19kYXlcIjogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJjYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHNcIjogMTIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwicmVzb3VyY2VfaWRcIjogNCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJhanhfbm9uY2VfY2FsZW5kYXJcIjogXCI8aW5wdXQgdHlwZT1cXFwiaGlkZGVuXFxcIiAuLi4gLz5cIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJib29rZWRfZGF0ZXNcIjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjEyLTI4LTIwMjJcIjogW1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImJvb2tpbmdfZGF0ZVwiOiBcIjIwMjItMTItMjggMDA6MDA6MDBcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImFwcHJvdmVkXCI6IFwiMVwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYm9va2luZ19pZFwiOiBcIjI2XCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWFzb25fYXZhaWxhYmlsaXR5Jzp7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTA5XCI6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTEwXCI6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTExXCI6IHRydWUsIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdC0gdGhpcyBvZiBkYXRlcGljayBPYmpcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19vbl9kYXlzX2hvdmVyKCB2YWx1ZSwgZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyApe1xyXG5cclxuXHRcdGlmICggbnVsbCA9PT0gZGF0ZSApe1xyXG5cdFx0XHRqUXVlcnkoICcuZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICkucmVtb3ZlQ2xhc3MoICdkYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKTsgICBcdCAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNsZWFyIGFsbCBoaWdobGlnaHQgZGF5cyBzZWxlY3Rpb25zXHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgaW5zdCA9IGpRdWVyeS5kYXRlcGljay5fZ2V0SW5zdCggZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKSApO1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCAxID09IGluc3QuZGF0ZXMubGVuZ3RoKVx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIElmIHdlIGhhdmUgb25lIHNlbGVjdGVkIGRhdGVcclxuXHRcdFx0JiYgKCdkeW5hbWljJyA9PT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSkgXHRcdFx0XHRcdC8vIHdoaWxlIGhhdmUgcmFuZ2UgZGF5cyBzZWxlY3Rpb24gbW9kZVxyXG5cdFx0KXtcclxuXHJcblx0XHRcdHZhciB0ZF9jbGFzcztcclxuXHRcdFx0dmFyIHRkX292ZXJzID0gW107XHJcblx0XHRcdHZhciBpc19jaGVjayA9IHRydWU7XHJcbiAgICAgICAgICAgIHZhciBzZWxjZXRlZF9maXJzdF9kYXkgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICAgICAgICBzZWxjZXRlZF9maXJzdF9kYXkuc2V0RnVsbFllYXIoaW5zdC5kYXRlc1swXS5nZXRGdWxsWWVhcigpLChpbnN0LmRhdGVzWzBdLmdldE1vbnRoKCkpLCAoaW5zdC5kYXRlc1swXS5nZXREYXRlKCkgKSApOyAvL0dldCBmaXJzdCBEYXRlXHJcblxyXG4gICAgICAgICAgICB3aGlsZSggIGlzX2NoZWNrICl7XHJcblxyXG5cdFx0XHRcdHRkX2NsYXNzID0gKHNlbGNldGVkX2ZpcnN0X2RheS5nZXRNb250aCgpICsgMSkgKyAnLScgKyBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RGF0ZSgpICsgJy0nICsgc2VsY2V0ZWRfZmlyc3RfZGF5LmdldEZ1bGxZZWFyKCk7XHJcblxyXG5cdFx0XHRcdHRkX292ZXJzWyB0ZF9vdmVycy5sZW5ndGggXSA9ICcjY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJyAuY2FsNGRhdGUtJyArIHRkX2NsYXNzOyAgICAgICAgICAgICAgLy8gYWRkIHRvIGFycmF5IGZvciBsYXRlciBtYWtlIHNlbGVjdGlvbiBieSBjbGFzc1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChcclxuXHRcdFx0XHRcdCggICggZGF0ZS5nZXRNb250aCgpID09IHNlbGNldGVkX2ZpcnN0X2RheS5nZXRNb250aCgpICkgICYmXHJcbiAgICAgICAgICAgICAgICAgICAgICAgKCBkYXRlLmdldERhdGUoKSA9PSBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RGF0ZSgpICkgICYmXHJcbiAgICAgICAgICAgICAgICAgICAgICAgKCBkYXRlLmdldEZ1bGxZZWFyKCkgPT0gc2VsY2V0ZWRfZmlyc3RfZGF5LmdldEZ1bGxZZWFyKCkgKVxyXG5cdFx0XHRcdFx0KSB8fCAoIHNlbGNldGVkX2ZpcnN0X2RheSA+IGRhdGUgKVxyXG5cdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRpc19jaGVjayA9ICBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHNlbGNldGVkX2ZpcnN0X2RheS5zZXRGdWxsWWVhciggc2VsY2V0ZWRfZmlyc3RfZGF5LmdldEZ1bGxZZWFyKCksIChzZWxjZXRlZF9maXJzdF9kYXkuZ2V0TW9udGgoKSksIChzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RGF0ZSgpICsgMSkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gSGlnaGxpZ2h0IERheXNcclxuXHRcdFx0Zm9yICggdmFyIGk9MDsgaSA8IHRkX292ZXJzLmxlbmd0aCA7IGkrKykgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgY2xhc3MgdG8gYWxsIGVsZW1lbnRzXHJcblx0XHRcdFx0alF1ZXJ5KCB0ZF9vdmVyc1tpXSApLmFkZENsYXNzKCdkYXRlcGljay1kYXlzLWNlbGwtb3ZlcicpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cclxuXHRcdH1cclxuXHJcblx0ICAgIHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIE9uIERBWXMgc2VsZWN0aW9uIGluIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZXNfc2VsZWN0aW9uXHRcdC0gIHN0cmluZzpcdFx0XHQgJzIwMjMtMDMtMDcgfiAyMDIzLTAzLTA3JyBvciAnMjAyMy0wNC0xMCwgMjAyMy0wNC0xMiwgMjAyMy0wNC0wMiwgMjAyMy0wNC0wNCdcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiaHRtbF9pZFwiOiBcImNhbGVuZGFyX2Jvb2tpbmc0XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwidGV4dF9pZFwiOiBcImRhdGVfYm9va2luZzRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJjYWxlbmRhcl9fc3RhcnRfd2Vla19kYXlcIjogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJjYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHNcIjogMTIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwicmVzb3VyY2VfaWRcIjogNCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJhanhfbm9uY2VfY2FsZW5kYXJcIjogXCI8aW5wdXQgdHlwZT1cXFwiaGlkZGVuXFxcIiAuLi4gLz5cIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJib29rZWRfZGF0ZXNcIjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjEyLTI4LTIwMjJcIjogW1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImJvb2tpbmdfZGF0ZVwiOiBcIjIwMjItMTItMjggMDA6MDA6MDBcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImFwcHJvdmVkXCI6IFwiMVwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYm9va2luZ19pZFwiOiBcIjI2XCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWFzb25fYXZhaWxhYmlsaXR5Jzp7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTA5XCI6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTEwXCI6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTExXCI6IHRydWUsIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdC0gdGhpcyBvZiBkYXRlcGljayBPYmpcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIGJvb2xlYW5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19zZWxlY3QoIGRhdGVzX3NlbGVjdGlvbiwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyA9IG51bGwgKXtcclxuXHJcblx0XHR2YXIgaW5zdCA9IGpRdWVyeS5kYXRlcGljay5fZ2V0SW5zdCggZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKSApO1xyXG5cclxuXHRcdHZhciBkYXRlc19hcnIgPSBbXTtcdC8vICBbIFwiMjAyMy0wNC0wOVwiLCBcIjIwMjMtMDQtMTBcIiwgXCIyMDIzLTA0LTExXCIgXVxyXG5cclxuXHRcdGlmICggLTEgIT09IGRhdGVzX3NlbGVjdGlvbi5pbmRleE9mKCAnficgKSApIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmFuZ2UgRGF5c1xyXG5cclxuXHRcdFx0ZGF0ZXNfYXJyID0gd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX3JhbmdlX2pzKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGF0ZXNfc2VwYXJhdG9yJyA6ICcgfiAnLCAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgJyB+ICdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlcycgICAgICAgICAgIDogZGF0ZXNfc2VsZWN0aW9uLCAgICBcdFx0ICAgLy8gJzIwMjMtMDQtMDQgfiAyMDIzLTA0LTA3J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHJcblx0XHR9IGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTXVsdGlwbGUgRGF5c1xyXG5cdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfY29tbWFfc2VwYXJhdGVkX2pzKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGF0ZXNfc2VwYXJhdG9yJyA6ICcsICcsICAgICAgICAgICAgICAgICAgICAgICAgIFx0Ly8gICcsICdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlcycgICAgICAgICAgIDogZGF0ZXNfc2VsZWN0aW9uLCAgICBcdFx0XHQvLyAnMjAyMy0wNC0xMCwgMjAyMy0wNC0xMiwgMjAyMy0wNC0wMiwgMjAyMy0wNC0wNCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19hdnlfYWZ0ZXJfZGF5c19zZWxlY3Rpb25fX3Nob3dfaGVscF9pbmZvKHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSc6IGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGF0ZXNfYXJyJyAgICAgICAgICAgICAgICAgICAgOiBkYXRlc19hcnIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGF0ZXNfY2xpY2tfbnVtJyAgICAgICAgICAgICAgOiBpbnN0LmRhdGVzLmxlbmd0aCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwb3BvdmVyX2hpbnRzJ1x0XHRcdFx0XHQ6IGNhbGVuZGFyX3BhcmFtc19hcnIucG9wb3Zlcl9oaW50c1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgaGVscCBpbmZvIGF0IHRoZSB0b3AgIHRvb2xiYXIgYWJvdXQgc2VsZWN0ZWQgZGF0ZXMgYW5kIGZ1dHVyZSBhY3Rpb25zXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHBhcmFtc1xyXG5cdFx0ICogXHRcdFx0XHRcdEV4YW1wbGUgMTogIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlOiBcImR5bmFtaWNcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRhdGVzX2FycjogIFsgXCIyMDIzLTA0LTAzXCIgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRhdGVzX2NsaWNrX251bTogMVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BvcG92ZXJfaGludHMnXHRcdFx0XHRcdDogY2FsZW5kYXJfcGFyYW1zX2Fyci5wb3BvdmVyX2hpbnRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0ICogXHRcdFx0XHRcdEV4YW1wbGUgMjogIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlOiBcImR5bmFtaWNcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfYXJyOiBBcnJheSgxMCkgWyBcIjIwMjMtMDQtMDNcIiwgXCIyMDIzLTA0LTA0XCIsIFwiMjAyMy0wNC0wNVwiLCDigKYgXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfY2xpY2tfbnVtOiAyXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncG9wb3Zlcl9oaW50cydcdFx0XHRcdFx0OiBjYWxlbmRhcl9wYXJhbXNfYXJyLnBvcG92ZXJfaGludHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYXZ5X2FmdGVyX2RheXNfc2VsZWN0aW9uX19zaG93X2hlbHBfaW5mbyggcGFyYW1zICl7XHJcbi8vIGNvbnNvbGUubG9nKCBwYXJhbXMgKTtcdC8vXHRcdFsgXCIyMDIzLTA0LTA5XCIsIFwiMjAyMy0wNC0xMFwiLCBcIjIwMjMtMDQtMTFcIiBdXHJcblxyXG5cdFx0XHR2YXIgbWVzc2FnZSwgY29sb3I7XHJcblx0XHRcdGlmIChqUXVlcnkoICcjdWlfYnRuX2F2eV9fc2V0X2RheXNfYXZhaWxhYmlsaXR5X19hdmFpbGFibGUnKS5pcygnOmNoZWNrZWQnKSl7XHJcblx0XHRcdFx0IG1lc3NhZ2UgPSBwYXJhbXMucG9wb3Zlcl9oaW50cy50b29sYmFyX3RleHRfYXZhaWxhYmxlOy8vJ1NldCBkYXRlcyBfREFURVNfIGFzIF9IVE1MXyBhdmFpbGFibGUuJztcclxuXHRcdFx0XHQgY29sb3IgPSAnIzExYmU0Yyc7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0bWVzc2FnZSA9IHBhcmFtcy5wb3BvdmVyX2hpbnRzLnRvb2xiYXJfdGV4dF91bmF2YWlsYWJsZTsvLydTZXQgZGF0ZXMgX0RBVEVTXyBhcyBfSFRNTF8gdW5hdmFpbGFibGUuJztcclxuXHRcdFx0XHRjb2xvciA9ICcjZTQzOTM5JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWVzc2FnZSA9ICc8c3Bhbj4nICsgbWVzc2FnZSArICc8L3NwYW4+JztcclxuXHJcblx0XHRcdHZhciBmaXJzdF9kYXRlID0gcGFyYW1zWyAnZGF0ZXNfYXJyJyBdWyAwIF07XHJcblx0XHRcdHZhciBsYXN0X2RhdGUgID0gKCAnZHluYW1pYycgPT0gcGFyYW1zLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlIClcclxuXHRcdFx0XHRcdFx0XHQ/IHBhcmFtc1sgJ2RhdGVzX2FycicgXVsgKHBhcmFtc1sgJ2RhdGVzX2FycicgXS5sZW5ndGggLSAxKSBdXHJcblx0XHRcdFx0XHRcdFx0OiAoIHBhcmFtc1sgJ2RhdGVzX2FycicgXS5sZW5ndGggPiAxICkgPyBwYXJhbXNbICdkYXRlc19hcnInIF1bIDEgXSA6ICcnO1xyXG5cclxuXHRcdFx0Zmlyc3RfZGF0ZSA9IGpRdWVyeS5kYXRlcGljay5mb3JtYXREYXRlKCAnZGQgTSwgeXknLCBuZXcgRGF0ZSggZmlyc3RfZGF0ZSArICdUMDA6MDA6MDAnICkgKTtcclxuXHRcdFx0bGFzdF9kYXRlID0galF1ZXJ5LmRhdGVwaWNrLmZvcm1hdERhdGUoICdkZCBNLCB5eScsICBuZXcgRGF0ZSggbGFzdF9kYXRlICsgJ1QwMDowMDowMCcgKSApO1xyXG5cclxuXHJcblx0XHRcdGlmICggJ2R5bmFtaWMnID09IHBhcmFtcy5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSApe1xyXG5cdFx0XHRcdGlmICggMSA9PSBwYXJhbXMuZGF0ZXNfY2xpY2tfbnVtICl7XHJcblx0XHRcdFx0XHRsYXN0X2RhdGUgPSAnX19fX19fX19fX18nXHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICggJ2ZpcnN0X3RpbWUnID09IGpRdWVyeSggJy53cGJjX2FqeF9hdmFpbGFiaWxpdHlfY29udGFpbmVyJyApLmF0dHIoICd3cGJjX2xvYWRlZCcgKSApe1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19hanhfYXZhaWxhYmlsaXR5X2NvbnRhaW5lcicgKS5hdHRyKCAnd3BiY19sb2FkZWQnLCAnZG9uZScgKVxyXG5cdFx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY193aWRnZXRfYXZhaWxhYmxlX3VuYXZhaWxhYmxlJywgMywgMjIwICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdG1lc3NhZ2UgPSBtZXNzYWdlLnJlcGxhY2UoICdfREFURVNfJywgICAgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLysgJzxkaXY+JyArICdmcm9tJyArICc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfYmlnX2RhdGVcIj4nICsgZmlyc3RfZGF0ZSArICc8L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnPHNwYW4+JyArICctJyArICc8L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnPHNwYW4gY2xhc3M9XCJ3cGJjX2JpZ19kYXRlXCI+JyArIGxhc3RfZGF0ZSArICc8L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnPHNwYW4+JyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIGlmICggcGFyYW1zWyAnZGF0ZXNfYXJyJyBdLmxlbmd0aCA+IDEgKXtcclxuXHRcdFx0XHQvLyBcdGxhc3RfZGF0ZSA9ICcsICcgKyBsYXN0X2RhdGU7XHJcblx0XHRcdFx0Ly8gXHRsYXN0X2RhdGUgKz0gKCBwYXJhbXNbICdkYXRlc19hcnInIF0ubGVuZ3RoID4gMiApID8gJywgLi4uJyA6ICcnO1xyXG5cdFx0XHRcdC8vIH0gZWxzZSB7XHJcblx0XHRcdFx0Ly8gXHRsYXN0X2RhdGU9Jyc7XHJcblx0XHRcdFx0Ly8gfVxyXG5cdFx0XHRcdHZhciBkYXRlc19hcnIgPSBbXTtcclxuXHRcdFx0XHRmb3IoIHZhciBpID0gMDsgaSA8IHBhcmFtc1sgJ2RhdGVzX2FycicgXS5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRcdFx0ZGF0ZXNfYXJyLnB1c2goICBqUXVlcnkuZGF0ZXBpY2suZm9ybWF0RGF0ZSggJ2RkIE0geXknLCAgbmV3IERhdGUoIHBhcmFtc1sgJ2RhdGVzX2FycicgXVsgaSBdICsgJ1QwMDowMDowMCcgKSApICApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRmaXJzdF9kYXRlID0gZGF0ZXNfYXJyLmpvaW4oICcsICcgKTtcclxuXHRcdFx0XHRtZXNzYWdlID0gbWVzc2FnZS5yZXBsYWNlKCAnX0RBVEVTXycsICAgICc8L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnPHNwYW4gY2xhc3M9XCJ3cGJjX2JpZ19kYXRlXCI+JyArIGZpcnN0X2RhdGUgKyAnPC9zcGFuPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuPicgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRtZXNzYWdlID0gbWVzc2FnZS5yZXBsYWNlKCAnX0hUTUxfJyAsICc8L3NwYW4+PHNwYW4gY2xhc3M9XCJ3cGJjX2JpZ190ZXh0XCIgc3R5bGU9XCJjb2xvcjonK2NvbG9yKyc7XCI+JykgKyAnPHNwYW4+JztcclxuXHJcblx0XHRcdC8vbWVzc2FnZSArPSAnIDxkaXYgc3R5bGU9XCJtYXJnaW4tbGVmdDogMWVtO1wiPicgKyAnIENsaWNrIG9uIEFwcGx5IGJ1dHRvbiB0byBhcHBseSBhdmFpbGFiaWxpdHkuJyArICc8L2Rpdj4nO1xyXG5cclxuXHRcdFx0bWVzc2FnZSA9ICc8ZGl2IGNsYXNzPVwid3BiY190b29sYmFyX2RhdGVzX2hpbnRzXCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JztcclxuXHJcblx0XHRcdGpRdWVyeSggJy53cGJjX2hlbHBfdGV4dCcgKS5odG1sKFx0bWVzc2FnZSApO1xyXG5cdFx0fVxyXG5cclxuXHQvKipcclxuXHQgKiAgIFBhcnNlIGRhdGVzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgZGF0ZXMgYXJyYXksICBmcm9tIGNvbW1hIHNlcGFyYXRlZCBkYXRlc1xyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBwYXJhbXMgICAgICAgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqICdkYXRlc19zZXBhcmF0b3InID0+ICcsICcsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERhdGVzIHNlcGFyYXRvclxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiAnZGF0ZXMnICAgICAgICAgICA9PiAnMjAyMy0wNC0wNCwgMjAyMy0wNC0wNywgMjAyMy0wNC0wNScgICAgICAgICAvLyBEYXRlcyBpbiAnWS1tLWQnIGZvcm1hdDogJzIwMjMtMDEtMzEnXHJcblx0XHRcdFx0XHRcdFx0XHQgfVxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gYXJyYXkgICAgICA9IFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzBdID0+IDIwMjMtMDQtMDRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzFdID0+IDIwMjMtMDQtMDVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzJdID0+IDIwMjMtMDQtMDZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzNdID0+IDIwMjMtMDQtMDdcclxuXHRcdFx0XHRcdFx0XHRcdF1cclxuXHRcdCAqXHJcblx0XHQgKiBFeGFtcGxlICMxOiAgd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX2NvbW1hX3NlcGFyYXRlZF9qcyggIHsgICdkYXRlc19zZXBhcmF0b3InIDogJywgJywgJ2RhdGVzJyA6ICcyMDIzLTA0LTA0LCAyMDIzLTA0LTA3LCAyMDIzLTA0LTA1JyAgfSAgKTtcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX2NvbW1hX3NlcGFyYXRlZF9qcyggcGFyYW1zICl7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyID0gW107XHJcblxyXG5cdFx0XHRpZiAoICcnICE9PSBwYXJhbXNbICdkYXRlcycgXSApe1xyXG5cclxuXHRcdFx0XHRkYXRlc19hcnIgPSBwYXJhbXNbICdkYXRlcycgXS5zcGxpdCggcGFyYW1zWyAnZGF0ZXNfc2VwYXJhdG9yJyBdICk7XHJcblxyXG5cdFx0XHRcdGRhdGVzX2Fyci5zb3J0KCk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGRhdGVzX2FycjtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBkYXRlcyBhcnJheSwgIGZyb20gcmFuZ2UgZGF5cyBzZWxlY3Rpb25cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcGFyYW1zICAgICAgID0gIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogJ2RhdGVzX3NlcGFyYXRvcicgPT4gJyB+ICcsICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERhdGVzIHNlcGFyYXRvclxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiAnZGF0ZXMnICAgICAgICAgICA9PiAnMjAyMy0wNC0wNCB+IDIwMjMtMDQtMDcnICAgICAgLy8gRGF0ZXMgaW4gJ1ktbS1kJyBmb3JtYXQ6ICcyMDIzLTAxLTMxJ1xyXG5cdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiBhcnJheSAgICAgICAgPSBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFswXSA9PiAyMDIzLTA0LTA0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFsxXSA9PiAyMDIzLTA0LTA1XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFsyXSA9PiAyMDIzLTA0LTA2XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFszXSA9PiAyMDIzLTA0LTA3XHJcblx0XHRcdFx0XHRcdFx0XHQgIF1cclxuXHRcdCAqXHJcblx0XHQgKiBFeGFtcGxlICMxOiAgd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX3JhbmdlX2pzKCAgeyAgJ2RhdGVzX3NlcGFyYXRvcicgOiAnIH4gJywgJ2RhdGVzJyA6ICcyMDIzLTA0LTA0IH4gMjAyMy0wNC0wNycgIH0gICk7XHJcblx0XHQgKiBFeGFtcGxlICMyOiAgd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX3JhbmdlX2pzKCAgeyAgJ2RhdGVzX3NlcGFyYXRvcicgOiAnIC0gJywgJ2RhdGVzJyA6ICcyMDIzLTA0LTA0IC0gMjAyMy0wNC0wNycgIH0gICk7XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2RhdGVzX2Fycl9fZnJvbV9kYXRlc19yYW5nZV9qcyggcGFyYW1zICl7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyID0gW107XHJcblxyXG5cdFx0XHRpZiAoICcnICE9PSBwYXJhbXNbJ2RhdGVzJ10gKSB7XHJcblxyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHBhcmFtc1sgJ2RhdGVzJyBdLnNwbGl0KCBwYXJhbXNbICdkYXRlc19zZXBhcmF0b3InIF0gKTtcclxuXHRcdFx0XHR2YXIgY2hlY2tfaW5fZGF0ZV95bWQgID0gZGF0ZXNfYXJyWzBdO1xyXG5cdFx0XHRcdHZhciBjaGVja19vdXRfZGF0ZV95bWQgPSBkYXRlc19hcnJbMV07XHJcblxyXG5cdFx0XHRcdGlmICggKCcnICE9PSBjaGVja19pbl9kYXRlX3ltZCkgJiYgKCcnICE9PSBjaGVja19vdXRfZGF0ZV95bWQpICl7XHJcblxyXG5cdFx0XHRcdFx0ZGF0ZXNfYXJyID0gd3BiY19nZXRfZGF0ZXNfYXJyYXlfZnJvbV9zdGFydF9lbmRfZGF5c19qcyggY2hlY2tfaW5fZGF0ZV95bWQsIGNoZWNrX291dF9kYXRlX3ltZCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZGF0ZXNfYXJyO1xyXG5cdFx0fVxyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIEdldCBkYXRlcyBhcnJheSBiYXNlZCBvbiBzdGFydCBhbmQgZW5kIGRhdGVzLlxyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKiBAcGFyYW0gc3RyaW5nIHNTdGFydERhdGUgLSBzdGFydCBkYXRlOiAyMDIzLTA0LTA5XHJcblx0XHRcdCAqIEBwYXJhbSBzdHJpbmcgc0VuZERhdGUgICAtIGVuZCBkYXRlOiAgIDIwMjMtMDQtMTFcclxuXHRcdFx0ICogQHJldHVybiBhcnJheSAgICAgICAgICAgICAtIFsgXCIyMDIzLTA0LTA5XCIsIFwiMjAyMy0wNC0xMFwiLCBcIjIwMjMtMDQtMTFcIiBdXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRmdW5jdGlvbiB3cGJjX2dldF9kYXRlc19hcnJheV9mcm9tX3N0YXJ0X2VuZF9kYXlzX2pzKCBzU3RhcnREYXRlLCBzRW5kRGF0ZSApe1xyXG5cclxuXHRcdFx0XHRzU3RhcnREYXRlID0gbmV3IERhdGUoIHNTdGFydERhdGUgKyAnVDAwOjAwOjAwJyApO1xyXG5cdFx0XHRcdHNFbmREYXRlID0gbmV3IERhdGUoIHNFbmREYXRlICsgJ1QwMDowMDowMCcgKTtcclxuXHJcblx0XHRcdFx0dmFyIGFEYXlzPVtdO1xyXG5cclxuXHRcdFx0XHQvLyBTdGFydCB0aGUgdmFyaWFibGUgb2ZmIHdpdGggdGhlIHN0YXJ0IGRhdGVcclxuXHRcdFx0XHRhRGF5cy5wdXNoKCBzU3RhcnREYXRlLmdldFRpbWUoKSApO1xyXG5cclxuXHRcdFx0XHQvLyBTZXQgYSAndGVtcCcgdmFyaWFibGUsIHNDdXJyZW50RGF0ZSwgd2l0aCB0aGUgc3RhcnQgZGF0ZSAtIGJlZm9yZSBiZWdpbm5pbmcgdGhlIGxvb3BcclxuXHRcdFx0XHR2YXIgc0N1cnJlbnREYXRlID0gbmV3IERhdGUoIHNTdGFydERhdGUuZ2V0VGltZSgpICk7XHJcblx0XHRcdFx0dmFyIG9uZV9kYXlfZHVyYXRpb24gPSAyNCo2MCo2MCoxMDAwO1xyXG5cclxuXHRcdFx0XHQvLyBXaGlsZSB0aGUgY3VycmVudCBkYXRlIGlzIGxlc3MgdGhhbiB0aGUgZW5kIGRhdGVcclxuXHRcdFx0XHR3aGlsZShzQ3VycmVudERhdGUgPCBzRW5kRGF0ZSl7XHJcblx0XHRcdFx0XHQvLyBBZGQgYSBkYXkgdG8gdGhlIGN1cnJlbnQgZGF0ZSBcIisxIGRheVwiXHJcblx0XHRcdFx0XHRzQ3VycmVudERhdGUuc2V0VGltZSggc0N1cnJlbnREYXRlLmdldFRpbWUoKSArIG9uZV9kYXlfZHVyYXRpb24gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBBZGQgdGhpcyBuZXcgZGF5IHRvIHRoZSBhRGF5cyBhcnJheVxyXG5cdFx0XHRcdFx0YURheXMucHVzaCggc0N1cnJlbnREYXRlLmdldFRpbWUoKSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhRGF5cy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0YURheXNbIGkgXSA9IG5ldyBEYXRlKCBhRGF5c1tpXSApO1xyXG5cdFx0XHRcdFx0YURheXNbIGkgXSA9IGFEYXlzWyBpIF0uZ2V0RnVsbFllYXIoKVxyXG5cdFx0XHRcdFx0XHRcdFx0KyAnLScgKyAoKCAoYURheXNbIGkgXS5nZXRNb250aCgpICsgMSkgPCAxMCkgPyAnMCcgOiAnJykgKyAoYURheXNbIGkgXS5nZXRNb250aCgpICsgMSlcclxuXHRcdFx0XHRcdFx0XHRcdCsgJy0nICsgKCggICAgICAgIGFEYXlzWyBpIF0uZ2V0RGF0ZSgpIDwgMTApID8gJzAnIDogJycpICsgIGFEYXlzWyBpIF0uZ2V0RGF0ZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBPbmNlIHRoZSBsb29wIGhhcyBmaW5pc2hlZCwgcmV0dXJuIHRoZSBhcnJheSBvZiBkYXlzLlxyXG5cdFx0XHRcdHJldHVybiBhRGF5cztcclxuXHRcdFx0fVxyXG5cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICAgVG9vbHRpcHMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIHNob3dpbmcgdG9vbHRpcCwgIHdoZW4gIG1vdXNlIG92ZXIgb24gIFNFTEVDVEFCTEUgKGF2YWlsYWJsZSwgcGVuZGluZywgYXBwcm92ZWQsIHJlc291cmNlIHVuYXZhaWxhYmxlKSwgIGRheXNcclxuXHQgKiBDYW4gYmUgY2FsbGVkIGRpcmVjdGx5ICBmcm9tICBkYXRlcGljayBpbml0IGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHZhbHVlXHJcblx0ICogQHBhcmFtIGRhdGVcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2FyclxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hdnlfX3ByZXBhcmVfdG9vbHRpcF9faW5fY2FsZW5kYXIoIHZhbHVlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0aWYgKCBudWxsID09IGRhdGUgKXsgIHJldHVybiBmYWxzZTsgIH1cclxuXHJcblx0XHR2YXIgdGRfY2xhc3MgPSAoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICctJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy0nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG5cclxuXHRcdHZhciBqQ2VsbCA9IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKyAnIHRkLmNhbDRkYXRlLScgKyB0ZF9jbGFzcyApO1xyXG5cclxuXHRcdHdwYmNfYXZ5X19zaG93X3Rvb2x0aXBfX2Zvcl9lbGVtZW50KCBqQ2VsbCwgY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3BvcG92ZXJfaGludHMnIF0gKTtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmluZSB0b29sdGlwICBmb3Igc2hvd2luZyBvbiBVTkFWQUlMQUJMRSBkYXlzIChzZWFzb24sIHdlZWtkYXksIHRvZGF5X2RlcGVuZHMgdW5hdmFpbGFibGUpXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gakNlbGxcdFx0XHRcdFx0alF1ZXJ5IG9mIHNwZWNpZmljIGRheSBjZWxsXHJcblx0ICogQHBhcmFtIHBvcG92ZXJfaGludHNcdFx0ICAgIEFycmF5IHdpdGggdG9vbHRpcCBoaW50IHRleHRzXHQgOiB7J3NlYXNvbl91bmF2YWlsYWJsZSc6Jy4uLicsJ3dlZWtkYXlzX3VuYXZhaWxhYmxlJzonLi4uJywnYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlJzonLi4uJyx9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hdnlfX3Nob3dfdG9vbHRpcF9fZm9yX2VsZW1lbnQoIGpDZWxsLCBwb3BvdmVyX2hpbnRzICl7XHJcblxyXG5cdFx0dmFyIHRvb2x0aXBfdGltZSA9ICcnO1xyXG5cclxuXHRcdGlmICggakNlbGwuaGFzQ2xhc3MoICdzZWFzb25fdW5hdmFpbGFibGUnICkgKXtcclxuXHRcdFx0dG9vbHRpcF90aW1lID0gcG9wb3Zlcl9oaW50c1sgJ3NlYXNvbl91bmF2YWlsYWJsZScgXTtcclxuXHRcdH0gZWxzZSBpZiAoIGpDZWxsLmhhc0NsYXNzKCAnd2Vla2RheXNfdW5hdmFpbGFibGUnICkgKXtcclxuXHRcdFx0dG9vbHRpcF90aW1lID0gcG9wb3Zlcl9oaW50c1sgJ3dlZWtkYXlzX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fSBlbHNlIGlmICggakNlbGwuaGFzQ2xhc3MoICdiZWZvcmVfYWZ0ZXJfdW5hdmFpbGFibGUnICkgKXtcclxuXHRcdFx0dG9vbHRpcF90aW1lID0gcG9wb3Zlcl9oaW50c1sgJ2JlZm9yZV9hZnRlcl91bmF2YWlsYWJsZScgXTtcclxuXHRcdH0gZWxzZSBpZiAoIGpDZWxsLmhhc0NsYXNzKCAnZGF0ZTJhcHByb3ZlJyApICl7XHJcblxyXG5cdFx0fSBlbHNlIGlmICggakNlbGwuaGFzQ2xhc3MoICdkYXRlX2FwcHJvdmVkJyApICl7XHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHR9XHJcblxyXG5cdFx0akNlbGwuYXR0ciggJ2RhdGEtY29udGVudCcsIHRvb2x0aXBfdGltZSApO1xyXG5cclxuXHRcdHZhciB0ZF9lbCA9IGpDZWxsLmdldCgwKTtcdC8valF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCArICcgdGQuY2FsNGRhdGUtJyArIHRkX2NsYXNzICkuZ2V0KDApO1xyXG5cclxuXHRcdGlmICggKCB1bmRlZmluZWQgPT0gdGRfZWwuX3RpcHB5ICkgJiYgKCAnJyAhPSB0b29sdGlwX3RpbWUgKSApe1xyXG5cclxuXHRcdFx0XHR3cGJjX3RpcHB5KCB0ZF9lbCAsIHtcclxuXHRcdFx0XHRcdGNvbnRlbnQoIHJlZmVyZW5jZSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIHBvcG92ZXJfY29udGVudCA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbnRlbnQnICk7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJzxkaXYgY2xhc3M9XCJwb3BvdmVyIHBvcG92ZXJfdGlwcHlcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJwb3BvdmVyLWNvbnRlbnRcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyBwb3BvdmVyX2NvbnRlbnRcclxuXHRcdFx0XHRcdFx0XHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdCArICc8L2Rpdj4nO1xyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdGFsbG93SFRNTCAgICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0dHJpZ2dlclx0XHRcdCA6ICdtb3VzZWVudGVyIGZvY3VzJyxcclxuXHRcdFx0XHRcdGludGVyYWN0aXZlICAgICAgOiAhIHRydWUsXHJcblx0XHRcdFx0XHRoaWRlT25DbGljayAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcclxuXHRcdFx0XHRcdG1heFdpZHRoICAgICAgICAgOiA1NTAsXHJcblx0XHRcdFx0XHR0aGVtZSAgICAgICAgICAgIDogJ3dwYmMtdGlwcHktdGltZXMnLFxyXG5cdFx0XHRcdFx0cGxhY2VtZW50ICAgICAgICA6ICd0b3AnLFxyXG5cdFx0XHRcdFx0ZGVsYXlcdFx0XHQgOiBbNDAwLCAwXSxcdFx0XHQvL0ZpeEluOiA5LjQuMi4yXHJcblx0XHRcdFx0XHRpZ25vcmVBdHRyaWJ1dGVzIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHRvdWNoXHRcdFx0IDogdHJ1ZSxcdFx0XHRcdC8vWydob2xkJywgNTAwXSwgLy8gNTAwbXMgZGVsYXlcdFx0XHQvL0ZpeEluOiA5LjIuMS41XHJcblx0XHRcdFx0XHRhcHBlbmRUbzogKCkgPT4gZG9jdW1lbnQuYm9keSxcclxuXHRcdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqICAgQWpheCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2VuZCBBamF4IHNob3cgcmVxdWVzdFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19hamF4X3JlcXVlc3QoKXtcclxuXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdXUEJDX0FKWF9BVkFJTEFCSUxJVFknICk7IGNvbnNvbGUubG9nKCAnID09IEJlZm9yZSBBamF4IFNlbmQgLSBzZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSA9PSAnICwgd3BiY19hanhfYXZhaWxhYmlsaXR5LnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpICk7XHJcblxyXG5cdHdwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKTtcclxuXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9BVkFJTEFCSUxJVFknLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogd3BiY19hanhfYXZhaWxhYmlsaXR5LmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApLFxyXG5cdFx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogd3BiY19hanhfYXZhaWxhYmlsaXR5LmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X2xvY2FsZSA6IHdwYmNfYWp4X2F2YWlsYWJpbGl0eS5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRcdHNlYXJjaF9wYXJhbXNcdDogd3BiY19hanhfYXZhaWxhYmlsaXR5LnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvKipcclxuXHRcdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjZy5waHBcclxuXHRcdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcblxyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9BVkFJTEFCSUxJVFkgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFJlbG9hZCBwYWdlLCBhZnRlciBmaWx0ZXIgdG9vbGJhciBoYXMgYmVlbiByZXNldFxyXG5cdFx0XHRcdFx0aWYgKCAgICAgICAoICAgICB1bmRlZmluZWQgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXSlcclxuXHRcdFx0XHRcdFx0XHQmJiAoICdyZXNldF9kb25lJyA9PT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsgJ2RvX2FjdGlvbicgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdGxvY2F0aW9uLnJlbG9hZCgpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2hvdyBsaXN0aW5nXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3BhZ2VfY29udGVudF9fc2hvdyggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdLCByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF0gLCByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0Ly93cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2RlZmluZV91aV9ob29rcygpO1x0XHRcdFx0XHRcdC8vIFJlZGVmaW5lIEhvb2tzLCBiZWNhdXNlIHdlIHNob3cgbmV3IERPTSBlbGVtZW50c1xyXG5cdFx0XHRcdFx0aWYgKCAnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICkgKXtcclxuXHRcdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICggJzEnID09IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0JyBdICkgPyAnc3VjY2VzcycgOiAnZXJyb3InXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAxMDAwMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHdwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKTtcclxuXHRcdFx0XHRcdC8vIFJlbW92ZSBzcGluIGljb24gZnJvbSAgYnV0dG9uIGFuZCBFbmFibGUgdGhpcyBidXR0b24uXHJcblx0XHRcdFx0XHR3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oIHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIF0gKVxyXG5cclxuXHRcdFx0XHRcdGpRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblxyXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgKDxiPicgKyBqcVhIUi5zdGF0dXMgKyAnPC9iPiknO1xyXG5cdFx0XHRcdFx0XHRpZiAoNDAzID09IGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyBQcm9iYWJseSBub25jZSBmb3IgdGhpcyBwYWdlIGhhcyBiZWVuIGV4cGlyZWQuIFBsZWFzZSA8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgb25jbGljaz1cImphdmFzY3JpcHQ6bG9jYXRpb24ucmVsb2FkKCk7XCI+cmVsb2FkIHRoZSBwYWdlPC9hPi4nO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgJyArIGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvcl9tZXNzYWdlLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xyXG5cclxuXHRcdFx0XHRcdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICk7XHJcblx0XHRcdCAgfSlcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcblxyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEggbyBvIGsgcyAgLSAgaXRzIEFjdGlvbi9UaW1lcyB3aGVuIG5lZWQgdG8gcmUtUmVuZGVyIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBTZWFyY2ggUmVxdWVzdCBhZnRlciBVcGRhdGluZyBzZWFyY2ggcmVxdWVzdCBwYXJhbWV0ZXJzXHJcbiAqXHJcbiAqIEBwYXJhbSBwYXJhbXNfYXJyXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyAoIHBhcmFtc19hcnIgKXtcclxuXHJcblx0Ly8gRGVmaW5lIGRpZmZlcmVudCBTZWFyY2ggIHBhcmFtZXRlcnMgZm9yIHJlcXVlc3RcclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHQvL2NvbnNvbGUubG9nKCAnUmVxdWVzdCBmb3I6ICcsIHBfa2V5LCBwX3ZhbCApO1xyXG5cdFx0d3BiY19hanhfYXZhaWxhYmlsaXR5LnNlYXJjaF9zZXRfcGFyYW0oIHBfa2V5LCBwX3ZhbCApO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBTZW5kIEFqYXggUmVxdWVzdFxyXG5cdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fYWpheF9yZXF1ZXN0KCk7XHJcbn1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNlYXJjaCByZXF1ZXN0IGZvciBcIlBhZ2UgTnVtYmVyXCJcclxuXHQgKiBAcGFyYW0gcGFnZV9udW1iZXJcdGludFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fcGFnaW5hdGlvbl9jbGljayggcGFnZV9udW1iZXIgKXtcclxuXHJcblx0XHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblxyXG4vKipcclxuICogICBTaG93IC8gSGlkZSBDb250ZW50ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiAgU2hvdyBMaXN0aW5nIENvbnRlbnQgXHQtIFx0U2VuZGluZyBBamF4IFJlcXVlc3RcdC1cdHdpdGggcGFyYW1ldGVycyB0aGF0ICB3ZSBlYXJseSAgZGVmaW5lZFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19hY3R1YWxfY29udGVudF9fc2hvdygpe1xyXG5cclxuXHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2FqYXhfcmVxdWVzdCgpO1x0XHRcdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHQtXHR3aXRoIHBhcmFtZXRlcnMgdGhhdCAgd2UgZWFybHkgIGRlZmluZWQgaW4gXCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcIiBPYmouXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIExpc3RpbmcgQ29udGVudFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19hY3R1YWxfY29udGVudF9faGlkZSgpe1xyXG5cclxuXHRqUXVlcnkoICB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgICkuaHRtbCggJycgKTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogICBNIGUgcyBzIGEgZyBlICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTaG93IGp1c3QgbWVzc2FnZSBpbnN0ZWFkIG9mIGNvbnRlbnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fc2hvd19tZXNzYWdlKCBtZXNzYWdlICl7XHJcblxyXG5cdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fYWN0dWFsX2NvbnRlbnRfX2hpZGUoKTtcclxuXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFN1cHBvcnQgRnVuY3Rpb25zIC0gU3BpbiBJY29uIGluIEJ1dHRvbnMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBTdGFydFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJykucmVtb3ZlQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBQYXVzZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmFkZENsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgaXMgU3Bpbm5pbmcgP1xyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX2lzX3NwaW4oKXtcclxuICAgIGlmICggalF1ZXJ5KCAnI3dwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b24gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuaGFzQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKSApe1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn1cclxuIl0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUVaO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFKQSxTQUFBQSxRQUFBQyxHQUFBLHNDQUFBRCxPQUFBLHdCQUFBRSxNQUFBLHVCQUFBQSxNQUFBLENBQUFDLFFBQUEsYUFBQUYsR0FBQSxrQkFBQUEsR0FBQSxnQkFBQUEsR0FBQSxXQUFBQSxHQUFBLHlCQUFBQyxNQUFBLElBQUFELEdBQUEsQ0FBQUcsV0FBQSxLQUFBRixNQUFBLElBQUFELEdBQUEsS0FBQUMsTUFBQSxDQUFBRyxTQUFBLHFCQUFBSixHQUFBLEtBQUFELE9BQUEsQ0FBQUMsR0FBQTtBQU1BLElBQUlLLHFCQUFxQixHQUFJLFVBQVdMLEdBQUcsRUFBRU0sQ0FBQyxFQUFFO0VBRS9DO0VBQ0EsSUFBSUMsUUFBUSxHQUFHUCxHQUFHLENBQUNRLFlBQVksR0FBR1IsR0FBRyxDQUFDUSxZQUFZLElBQUk7SUFDeENDLE9BQU8sRUFBRSxDQUFDO0lBQ1ZDLEtBQUssRUFBSSxFQUFFO0lBQ1hDLE1BQU0sRUFBRztFQUNSLENBQUM7RUFF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RUMsS0FBSyxFQUFFQyxNQUFNLEVBQUc7SUFDckQ7SUFDQXhCLHFCQUFxQixDQUFDaUIsZ0JBQWdCLENBQUVNLEtBQUssRUFBRUQsS0FBTSxDQUFDO0VBQ3ZELENBQUMsQ0FBQzs7RUFFRjtFQUNBcUwsbUNBQW1DLENBQUMsQ0FBQztBQUN0Qzs7QUFHQztBQUNEO0FBQ0E7QUFDQTtBQUNDLFNBQVM0Qix1Q0FBdUNBLENBQUVDLFdBQVcsRUFBRTtFQUU5REYsK0NBQStDLENBQUU7SUFDeEMsVUFBVSxFQUFFRTtFQUNiLENBQUUsQ0FBQztBQUNaOztBQUlEO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsMkNBQTJDQSxDQUFBLEVBQUU7RUFFckQ5QixtQ0FBbUMsQ0FBQyxDQUFDLENBQUMsQ0FBRztBQUMxQzs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTK0IsMkNBQTJDQSxDQUFBLEVBQUU7RUFFckQ3TSxNQUFNLENBQUc3QixxQkFBcUIsQ0FBQzRCLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBRyxDQUFDLENBQUNVLElBQUksQ0FBRSxFQUFHLENBQUM7QUFDcEY7O0FBSUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTb0wsbUNBQW1DQSxDQUFFL0QsT0FBTyxFQUFFO0VBRXREK0UsMkNBQTJDLENBQUMsQ0FBQztFQUU3QzdNLE1BQU0sQ0FBRTdCLHFCQUFxQixDQUFDNEIsZUFBZSxDQUFFLG1CQUFvQixDQUFFLENBQUMsQ0FBQ1UsSUFBSSxDQUNoRSwyRUFBMkUsR0FDMUVxSCxPQUFPLEdBQ1IsUUFDRixDQUFDO0FBQ1g7O0FBSUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTb0QsMkNBQTJDQSxDQUFBLEVBQUU7RUFDckRsTCxNQUFNLENBQUUsdURBQXVELENBQUMsQ0FBQzJCLFdBQVcsQ0FBRSxzQkFBdUIsQ0FBQztBQUN2Rzs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTc0ssMkNBQTJDQSxDQUFBLEVBQUU7RUFDckRqTSxNQUFNLENBQUUsdURBQXdELENBQUMsQ0FBQ3FILFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQztBQUNyRzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU3lGLHdDQUF3Q0EsQ0FBQSxFQUFFO0VBQy9DLElBQUs5TSxNQUFNLENBQUUsdURBQXdELENBQUMsQ0FBQ21ELFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQyxFQUFFO0lBQzdHLE9BQU8sSUFBSTtFQUNaLENBQUMsTUFBTTtJQUNOLE9BQU8sS0FBSztFQUNiO0FBQ0QiLCJpZ25vcmVMaXN0IjpbXX0=
