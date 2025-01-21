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
      // FixIn: 9.4.2.2.
      ignoreAttributes: true,
      touch: true,
      //['hold', 500], // 500ms delay			// FixIn: 9.2.1.5.
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHkvX291dC9hdmFpbGFiaWxpdHlfcGFnZS5qcyIsIm5hbWVzIjpbIl90eXBlb2YiLCJvYmoiLCJTeW1ib2wiLCJpdGVyYXRvciIsImNvbnN0cnVjdG9yIiwicHJvdG90eXBlIiwid3BiY19hanhfYXZhaWxhYmlsaXR5IiwiJCIsInBfc2VjdXJlIiwic2VjdXJpdHlfb2JqIiwidXNlcl9pZCIsIm5vbmNlIiwibG9jYWxlIiwic2V0X3NlY3VyZV9wYXJhbSIsInBhcmFtX2tleSIsInBhcmFtX3ZhbCIsImdldF9zZWN1cmVfcGFyYW0iLCJwX2xpc3RpbmciLCJzZWFyY2hfcmVxdWVzdF9vYmoiLCJzZWFyY2hfc2V0X2FsbF9wYXJhbXMiLCJyZXF1ZXN0X3BhcmFtX29iaiIsInNlYXJjaF9nZXRfYWxsX3BhcmFtcyIsInNlYXJjaF9nZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtIiwic2VhcmNoX3NldF9wYXJhbXNfYXJyIiwicGFyYW1zX2FyciIsIl8iLCJlYWNoIiwicF92YWwiLCJwX2tleSIsInBfZGF0YSIsInBfb3RoZXIiLCJvdGhlcl9vYmoiLCJzZXRfb3RoZXJfcGFyYW0iLCJnZXRfb3RoZXJfcGFyYW0iLCJqUXVlcnkiLCJ3cGJjX2FqeF9ib29raW5ncyIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fcGFnZV9jb250ZW50X19zaG93IiwiYWp4X2RhdGFfYXJyIiwiYWp4X3NlYXJjaF9wYXJhbXMiLCJhanhfY2xlYW5lZF9wYXJhbXMiLCJ0ZW1wbGF0ZV9fYXZhaWxhYmlsaXR5X21haW5fcGFnZV9jb250ZW50Iiwid3AiLCJ0ZW1wbGF0ZSIsImh0bWwiLCJwYXJlbnQiLCJoaWRlIiwid3BiY19hanhfYXZhaWxhYmlsaXR5X19jYWxlbmRhcl9fc2hvdyIsInJlc291cmNlX2lkIiwiYWp4X25vbmNlX2NhbGVuZGFyIiwidHJpZ2dlciIsImNhbGVuZGFyX3BhcmFtc19hcnIiLCJvbiIsImV2ZW50IiwiaW5zdCIsImRwRGl2IiwiZmluZCIsInRoaXNfZXZlbnQiLCJqQ2VsbCIsImN1cnJlbnRUYXJnZXQiLCJ3cGJjX2F2eV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCIsImpDYWxDb250YWluZXIiLCJyZW1vdmVDbGFzcyIsImNhbGVuZGFyX192aWV3X19jZWxsX2hlaWdodCIsImFwcGVuZCIsIndpZHRoIiwiY2FsZW5kYXJfX3ZpZXdfX3dpZHRoIiwidW5kZWZpbmVkIiwiY2FsZW5kYXJfX3ZpZXdfX21heF93aWR0aCIsImNhbGVuZGFyX192aWV3X19tb250aHNfaW5fcm93IiwiY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzIiwiY2FsZW5kYXJfX3RpbWVzbG90X2RheV9iZ19hc19hdmFpbGFibGUiLCJjYWxfcGFyYW1fYXJyIiwiY2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5IiwiY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUiLCJib29rZWRfZGF0ZXMiLCJzZWFzb25fYXZhaWxhYmlsaXR5IiwicmVzb3VyY2VfdW5hdmFpbGFibGVfZGF0ZXMiLCJ3cGJjX3Nob3dfaW5saW5lX2Jvb2tpbmdfY2FsZW5kYXIiLCJ3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19zZWxlY3QiLCJ0ZXh0X2lkIiwidmFsIiwicG9wb3Zlcl9oaW50cyIsInRvb2xiYXJfdGV4dCIsImh0bWxfaWQiLCJsZW5ndGgiLCJoYXNDbGFzcyIsInRleHQiLCJkYXRlcGljayIsImJlZm9yZVNob3dEYXkiLCJkYXRlIiwid3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzIiwib25TZWxlY3QiLCJvbkhvdmVyIiwidmFsdWUiLCJ3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19ob3ZlciIsIm9uQ2hhbmdlTW9udGhZZWFyIiwic2hvd09uIiwibnVtYmVyT2ZNb250aHMiLCJzdGVwTW9udGhzIiwicHJldlRleHQiLCJuZXh0VGV4dCIsImRhdGVGb3JtYXQiLCJjaGFuZ2VNb250aCIsImNoYW5nZVllYXIiLCJtaW5EYXRlIiwibWF4RGF0ZSIsInNob3dTdGF0dXMiLCJjbG9zZUF0VG9wIiwiZmlyc3REYXkiLCJnb3RvQ3VycmVudCIsImhpZGVJZk5vUHJldk5leHQiLCJtdWx0aVNlcGFyYXRvciIsIm11bHRpU2VsZWN0IiwicmFuZ2VTZWxlY3QiLCJyYW5nZVNlcGFyYXRvciIsInVzZVRoZW1lUm9sbGVyIiwiZGF0ZXBpY2tfdGhpcyIsInRvZGF5X2RhdGUiLCJEYXRlIiwiX3dwYmMiLCJwYXJzZUludCIsImNsYXNzX2RheSIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsImdldEZ1bGxZZWFyIiwic3FsX2NsYXNzX2RheSIsIndwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUiLCJjc3NfZGF0ZV9fc3RhbmRhcmQiLCJjc3NfZGF0ZV9fYWRkaXRpb25hbCIsImdldERheSIsImkiLCJ3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4iLCJpc19kYXRlX2F2YWlsYWJsZSIsIndwYmNfaW5fYXJyYXkiLCJib29raW5nc19pbl9kYXRlIiwiYXBwcm92ZWQiLCJPYmplY3QiLCJrZXlzIiwiaXNfYXBwcm92ZWQiLCJ0cyIsImJvb2tpbmdfZGF0ZSIsInN1YnN0cmluZyIsIl9nZXRJbnN0IiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsImRhdGVzIiwidGRfY2xhc3MiLCJ0ZF9vdmVycyIsImlzX2NoZWNrIiwic2VsY2V0ZWRfZmlyc3RfZGF5Iiwic2V0RnVsbFllYXIiLCJhZGRDbGFzcyIsImRhdGVzX3NlbGVjdGlvbiIsImFyZ3VtZW50cyIsImRhdGVzX2FyciIsImluZGV4T2YiLCJ3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfcmFuZ2VfanMiLCJ3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfY29tbWFfc2VwYXJhdGVkX2pzIiwid3BiY19hdnlfYWZ0ZXJfZGF5c19zZWxlY3Rpb25fX3Nob3dfaGVscF9pbmZvIiwicGFyYW1zIiwibWVzc2FnZSIsImNvbG9yIiwiaXMiLCJ0b29sYmFyX3RleHRfYXZhaWxhYmxlIiwidG9vbGJhcl90ZXh0X3VuYXZhaWxhYmxlIiwiZmlyc3RfZGF0ZSIsImxhc3RfZGF0ZSIsImZvcm1hdERhdGUiLCJkYXRlc19jbGlja19udW0iLCJhdHRyIiwid3BiY19ibGlua19lbGVtZW50IiwicmVwbGFjZSIsInB1c2giLCJqb2luIiwic3BsaXQiLCJzb3J0IiwiY2hlY2tfaW5fZGF0ZV95bWQiLCJjaGVja19vdXRfZGF0ZV95bWQiLCJ3cGJjX2dldF9kYXRlc19hcnJheV9mcm9tX3N0YXJ0X2VuZF9kYXlzX2pzIiwic1N0YXJ0RGF0ZSIsInNFbmREYXRlIiwiYURheXMiLCJnZXRUaW1lIiwic0N1cnJlbnREYXRlIiwib25lX2RheV9kdXJhdGlvbiIsInNldFRpbWUiLCJ3cGJjX2F2eV9fcHJlcGFyZV90b29sdGlwX19pbl9jYWxlbmRhciIsInRvb2x0aXBfdGltZSIsInRkX2VsIiwiZ2V0IiwiX3RpcHB5Iiwid3BiY190aXBweSIsImNvbnRlbnQiLCJyZWZlcmVuY2UiLCJwb3BvdmVyX2NvbnRlbnQiLCJnZXRBdHRyaWJ1dGUiLCJhbGxvd0hUTUwiLCJpbnRlcmFjdGl2ZSIsImhpZGVPbkNsaWNrIiwiaW50ZXJhY3RpdmVCb3JkZXIiLCJtYXhXaWR0aCIsInRoZW1lIiwicGxhY2VtZW50IiwiZGVsYXkiLCJpZ25vcmVBdHRyaWJ1dGVzIiwidG91Y2giLCJhcHBlbmRUbyIsImJvZHkiLCJ3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2FqYXhfcmVxdWVzdCIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsIndwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQiLCJwb3N0Iiwid3BiY191cmxfYWpheCIsImFjdGlvbiIsIndwYmNfYWp4X3VzZXJfaWQiLCJ3cGJjX2FqeF9sb2NhbGUiLCJzZWFyY2hfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwid3BiY19hanhfYXZhaWxhYmlsaXR5X19zaG93X21lc3NhZ2UiLCJsb2NhdGlvbiIsInJlbG9hZCIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwid3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiIsImZhaWwiLCJlcnJvclRocm93biIsIndpbmRvdyIsImVycm9yX21lc3NhZ2UiLCJzdGF0dXMiLCJyZXNwb25zZVRleHQiLCJ3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fcGFnaW5hdGlvbl9jbGljayIsInBhZ2VfbnVtYmVyIiwid3BiY19hanhfYXZhaWxhYmlsaXR5X19hY3R1YWxfY29udGVudF9fc2hvdyIsIndwYmNfYWp4X2F2YWlsYWJpbGl0eV9fYWN0dWFsX2NvbnRlbnRfX2hpZGUiLCJ3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uX19pc19zcGluIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHkvX3NyYy9hdmFpbGFiaWxpdHlfcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBSZXF1ZXN0IE9iamVjdFxyXG4gKiBIZXJlIHdlIGNhbiAgZGVmaW5lIFNlYXJjaCBwYXJhbWV0ZXJzIGFuZCBVcGRhdGUgaXQgbGF0ZXIsICB3aGVuICBzb21lIHBhcmFtZXRlciB3YXMgY2hhbmdlZFxyXG4gKlxyXG4gKi9cclxuXHJcbnZhciB3cGJjX2FqeF9hdmFpbGFiaWxpdHkgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gU2VjdXJlIHBhcmFtZXRlcnMgZm9yIEFqYXhcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlY3VyZSA9IG9iai5zZWN1cml0eV9vYmogPSBvYmouc2VjdXJpdHlfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcl9pZDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bm9uY2UgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsZSA6ICcnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH07XHJcblxyXG5cdG9iai5zZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfc2VjdXJlWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfc2VjdXJlWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gTGlzdGluZyBTZWFyY2ggcGFyYW1ldGVyc1x0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfbGlzdGluZyA9IG9iai5zZWFyY2hfcmVxdWVzdF9vYmogPSBvYmouc2VhcmNoX3JlcXVlc3Rfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc29ydCAgICAgICAgICAgIDogXCJib29raW5nX2lkXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvcnRfdHlwZSAgICAgICA6IFwiREVTQ1wiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBwYWdlX251bSAgICAgICAgOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBwYWdlX2l0ZW1zX2NvdW50OiAxMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY3JlYXRlX2RhdGUgICAgIDogXCJcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8ga2V5d29yZCAgICAgICAgIDogXCJcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc291cmNlICAgICAgICAgIDogXCJcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfYWxsX3BhcmFtcyA9IGZ1bmN0aW9uICggcmVxdWVzdF9wYXJhbV9vYmogKSB7XHJcblx0XHRwX2xpc3RpbmcgPSByZXF1ZXN0X3BhcmFtX29iajtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX2dldF9hbGxfcGFyYW1zID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfbGlzdGluZztcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX2dldF9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfbGlzdGluZ1sgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0Ly8gaWYgKCBBcnJheS5pc0FycmF5KCBwYXJhbV92YWwgKSApe1xyXG5cdFx0Ly8gXHRwYXJhbV92YWwgPSBKU09OLnN0cmluZ2lmeSggcGFyYW1fdmFsICk7XHJcblx0XHQvLyB9XHJcblx0XHRwX2xpc3RpbmdbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X3BhcmFtc19hcnIgPSBmdW5jdGlvbiggcGFyYW1zX2FyciApe1xyXG5cdFx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRGVmaW5lIGRpZmZlcmVudCBTZWFyY2ggIHBhcmFtZXRlcnMgZm9yIHJlcXVlc3RcclxuXHRcdFx0dGhpcy5zZWFyY2hfc2V0X3BhcmFtKCBwX2tleSwgcF92YWwgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyBPdGhlciBwYXJhbWV0ZXJzIFx0XHRcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX290aGVyID0gb2JqLm90aGVyX29iaiA9IG9iai5vdGhlcl9vYmogfHwgeyB9O1xyXG5cclxuXHRvYmouc2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfb3RoZXJbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX290aGVyWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0cmV0dXJuIG9iajtcclxufSggd3BiY19hanhfYXZhaWxhYmlsaXR5IHx8IHt9LCBqUXVlcnkgKSk7XHJcblxyXG52YXIgd3BiY19hanhfYm9va2luZ3MgPSBbXTtcclxuXHJcbi8qKlxyXG4gKiAgIFNob3cgQ29udGVudCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNob3cgQ29udGVudCAtIENhbGVuZGFyIGFuZCBVSSBlbGVtZW50c1xyXG4gKlxyXG4gKiBAcGFyYW0gYWp4X2RhdGFfYXJyXHJcbiAqIEBwYXJhbSBhanhfc2VhcmNoX3BhcmFtc1xyXG4gKiBAcGFyYW0gYWp4X2NsZWFuZWRfcGFyYW1zXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3BhZ2VfY29udGVudF9fc2hvdyggYWp4X2RhdGFfYXJyLCBhanhfc2VhcmNoX3BhcmFtcyAsIGFqeF9jbGVhbmVkX3BhcmFtcyApe1xyXG5cclxuXHR2YXIgdGVtcGxhdGVfX2F2YWlsYWJpbGl0eV9tYWluX3BhZ2VfY29udGVudCA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfYXZhaWxhYmlsaXR5X21haW5fcGFnZV9jb250ZW50JyApO1xyXG5cclxuXHQvLyBDb250ZW50XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKCB0ZW1wbGF0ZV9fYXZhaWxhYmlsaXR5X21haW5fcGFnZV9jb250ZW50KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9kYXRhJyAgICAgICAgICAgICAgOiBhanhfZGF0YV9hcnIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9zZWFyY2hfcGFyYW1zJyAgICAgOiBhanhfc2VhcmNoX3BhcmFtcyxcdFx0XHRcdFx0XHRcdFx0Ly8gJF9SRVFVRVNUWyAnc2VhcmNoX3BhcmFtcycgXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfY2xlYW5lZF9wYXJhbXMnICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0gKSApO1xyXG5cclxuXHRqUXVlcnkoICcud3BiY19wcm9jZXNzaW5nLndwYmNfc3BpbicpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCgpLnBhcmVudCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICkuaGlkZSgpO1xyXG5cdC8vIExvYWQgY2FsZW5kYXJcclxuXHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2NhbGVuZGFyX19zaG93KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnICAgICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcic6IGFqeF9kYXRhX2Fyci5hanhfbm9uY2VfY2FsZW5kYXIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2RhdGFfYXJyJyAgICAgICAgICA6IGFqeF9kYXRhX2FycixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfY2xlYW5lZF9wYXJhbXMnICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogVHJpZ2dlciBmb3IgZGF0ZXMgc2VsZWN0aW9uIGluIHRoZSBib29raW5nIGZvcm1cclxuXHQgKlxyXG5cdCAqIGpRdWVyeSggd3BiY19hanhfYXZhaWxhYmlsaXR5LmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkub24oJ3dwYmNfcGFnZV9jb250ZW50X2xvYWRlZCcsIGZ1bmN0aW9uKGV2ZW50LCBhanhfZGF0YV9hcnIsIGFqeF9zZWFyY2hfcGFyYW1zICwgYWp4X2NsZWFuZWRfcGFyYW1zKSB7IC4uLiB9ICk7XHJcblx0ICovXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS50cmlnZ2VyKCAnd3BiY19wYWdlX2NvbnRlbnRfbG9hZGVkJywgWyBhanhfZGF0YV9hcnIsIGFqeF9zZWFyY2hfcGFyYW1zICwgYWp4X2NsZWFuZWRfcGFyYW1zIF0gKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaG93IGlubGluZSBtb250aCB2aWV3IGNhbGVuZGFyICAgICAgICAgICAgICB3aXRoIGFsbCBwcmVkZWZpbmVkIENTUyAoc2l6ZXMgYW5kIGNoZWNrIGluL291dCwgIHRpbWVzIGNvbnRhaW5lcnMpXHJcbiAqIEBwYXJhbSB7b2JqfSBjYWxlbmRhcl9wYXJhbXNfYXJyXHJcblx0XHRcdHtcclxuXHRcdFx0XHQncmVzb3VyY2VfaWQnICAgICAgIFx0OiBhanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcidcdDogYWp4X2RhdGFfYXJyLmFqeF9ub25jZV9jYWxlbmRhcixcclxuXHRcdFx0XHQnYWp4X2RhdGFfYXJyJyAgICAgICAgICA6IGFqeF9kYXRhX2FyciA9IHsgYWp4X2Jvb2tpbmdfcmVzb3VyY2VzOltdLCBib29rZWRfZGF0ZXM6IHt9LCByZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlczpbXSwgc2Vhc29uX2F2YWlsYWJpbGl0eTp7fSwuLi4uIH1cclxuXHRcdFx0XHQnYWp4X2NsZWFuZWRfcGFyYW1zJyAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlOiBcImR5bmFtaWNcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3N0YXJ0X3dlZWtfZGF5OiBcIjBcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3RpbWVzbG90X2RheV9iZ19hc19hdmFpbGFibGU6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX192aWV3X19jZWxsX2hlaWdodDogXCJcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX3ZpZXdfX21vbnRoc19pbl9yb3c6IDRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRoczogMTJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX192aWV3X193aWR0aDogXCIxMDAlXCJcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19hdmFpbGFiaWxpdHk6IFwidW5hdmFpbGFibGVcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfc2VsZWN0aW9uOiBcIjIwMjMtMDMtMTQgfiAyMDIzLTAzLTE2XCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRvX2FjdGlvbjogXCJzZXRfYXZhaWxhYmlsaXR5XCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlc291cmNlX2lkOiAxXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1aV9jbGlja2VkX2VsZW1lbnRfaWQ6IFwid3BiY19hdmFpbGFiaWxpdHlfYXBwbHlfYnRuXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVpX3Vzcl9fYXZhaWxhYmlsaXR5X3NlbGVjdGVkX3Rvb2xiYXI6IFwiaW5mb1wiXHJcblx0XHRcdFx0XHRcdFx0XHQgIFx0XHQgfVxyXG5cdFx0XHR9XHJcbiovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fY2FsZW5kYXJfX3Nob3coIGNhbGVuZGFyX3BhcmFtc19hcnIgKXtcclxuXHJcblx0Ly8gVXBkYXRlIG5vbmNlXHJcblx0alF1ZXJ5KCAnI2FqeF9ub25jZV9jYWxlbmRhcl9zZWN0aW9uJyApLmh0bWwoIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X25vbmNlX2NhbGVuZGFyICk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gVXBkYXRlIGJvb2tpbmdzXHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PSB0eXBlb2YgKHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0pICl7IHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0gPSBbXTsgfVxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0gPSBjYWxlbmRhcl9wYXJhbXNfYXJyWyAnYWp4X2RhdGFfYXJyJyBdWyAnYm9va2VkX2RhdGVzJyBdO1xyXG5cclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgc2hvd2luZyBtb3VzZSBvdmVyIHRvb2x0aXAgb24gdW5hdmFpbGFibGUgZGF0ZXNcclxuXHQgKiBJdCdzIGRlZmluZWQsIHdoZW4gY2FsZW5kYXIgUkVGUkVTSEVEIChjaGFuZ2UgbW9udGhzIG9yIGRheXMgc2VsZWN0aW9uKSBsb2FkZWQgaW4ganF1ZXJ5LmRhdGVwaWNrLndwYmMuOS4wLmpzIDpcclxuXHQgKiBcdFx0JCggJ2JvZHknICkudHJpZ2dlciggJ3dwYmNfZGF0ZXBpY2tfaW5saW5lX2NhbGVuZGFyX3JlZnJlc2gnLCAuLi5cdFx0Ly8gRml4SW46IDkuNC40LjEzLlxyXG5cdCAqL1xyXG5cdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2RhdGVwaWNrX2lubGluZV9jYWxlbmRhcl9yZWZyZXNoJywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIGluc3QgKXtcclxuXHRcdC8vIGluc3QuZHBEaXYgIGl0J3M6ICA8ZGl2IGNsYXNzPVwiZGF0ZXBpY2staW5saW5lIGRhdGVwaWNrLW11bHRpXCIgc3R5bGU9XCJ3aWR0aDogMTc3MTJweDtcIj4uLi4uPC9kaXY+XHJcblx0XHRpbnN0LmRwRGl2LmZpbmQoICcuc2Vhc29uX3VuYXZhaWxhYmxlLC5iZWZvcmVfYWZ0ZXJfdW5hdmFpbGFibGUsLndlZWtkYXlzX3VuYXZhaWxhYmxlJyApLm9uKCAnbW91c2VvdmVyJywgZnVuY3Rpb24gKCB0aGlzX2V2ZW50ICl7XHJcblx0XHRcdC8vIGFsc28gYXZhaWxhYmxlIHRoZXNlIHZhcnM6IFx0cmVzb3VyY2VfaWQsIGpDYWxDb250YWluZXIsIGluc3RcclxuXHRcdFx0dmFyIGpDZWxsID0galF1ZXJ5KCB0aGlzX2V2ZW50LmN1cnJlbnRUYXJnZXQgKTtcclxuXHRcdFx0d3BiY19hdnlfX3Nob3dfdG9vbHRpcF9fZm9yX2VsZW1lbnQoIGpDZWxsLCBjYWxlbmRhcl9wYXJhbXNfYXJyWyAnYWp4X2RhdGFfYXJyJyBdWydwb3BvdmVyX2hpbnRzJ10gKTtcclxuXHRcdH0pO1xyXG5cclxuXHR9XHQpO1xyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIERlZmluZSBoZWlnaHQgb2YgdGhlIGNhbGVuZGFyICBjZWxscywgXHRhbmQgIG1vdXNlIG92ZXIgdG9vbHRpcHMgYXQgIHNvbWUgdW5hdmFpbGFibGUgZGF0ZXNcclxuXHQgKiBJdCdzIGRlZmluZWQsIHdoZW4gY2FsZW5kYXIgbG9hZGVkIGluIGpxdWVyeS5kYXRlcGljay53cGJjLjkuMC5qcyA6XHJcblx0ICogXHRcdCQoICdib2R5JyApLnRyaWdnZXIoICd3cGJjX2RhdGVwaWNrX2lubGluZV9jYWxlbmRhcl9sb2FkZWQnLCAuLi5cdFx0Ly8gRml4SW46IDkuNC40LjEyLlxyXG5cdCAqL1xyXG5cdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2RhdGVwaWNrX2lubGluZV9jYWxlbmRhcl9sb2FkZWQnLCBmdW5jdGlvbiAoIGV2ZW50LCByZXNvdXJjZV9pZCwgakNhbENvbnRhaW5lciwgaW5zdCApe1xyXG5cclxuXHRcdC8vIFJlbW92ZSBoaWdobGlnaHQgZGF5IGZvciB0b2RheSAgZGF0ZVxyXG5cdFx0alF1ZXJ5KCAnLmRhdGVwaWNrLWRheXMtY2VsbC5kYXRlcGljay10b2RheS5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1xyXG5cclxuXHRcdC8vIFNldCBoZWlnaHQgb2YgY2FsZW5kYXIgIGNlbGxzIGlmIGRlZmluZWQgdGhpcyBvcHRpb25cclxuXHRcdGlmICggJycgIT09IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19jZWxsX2hlaWdodCApe1xyXG5cdFx0XHRqUXVlcnkoICdoZWFkJyApLmFwcGVuZCggJzxzdHlsZSB0eXBlPVwidGV4dC9jc3NcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnLmhhc0RhdGVwaWNrIC5kYXRlcGljay1pbmxpbmUgLmRhdGVwaWNrLXRpdGxlLXJvdyB0aCwgJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsgJy5oYXNEYXRlcGljayAuZGF0ZXBpY2staW5saW5lIC5kYXRlcGljay1kYXlzLWNlbGwgeydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJ2hlaWdodDogJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19jZWxsX2hlaWdodCArICcgIWltcG9ydGFudDsnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnfSdcclxuXHRcdFx0XHRcdFx0XHRcdFx0Kyc8L3N0eWxlPicgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBEZWZpbmUgc2hvd2luZyBtb3VzZSBvdmVyIHRvb2x0aXAgb24gdW5hdmFpbGFibGUgZGF0ZXNcclxuXHRcdGpDYWxDb250YWluZXIuZmluZCggJy5zZWFzb25fdW5hdmFpbGFibGUsLmJlZm9yZV9hZnRlcl91bmF2YWlsYWJsZSwud2Vla2RheXNfdW5hdmFpbGFibGUnICkub24oICdtb3VzZW92ZXInLCBmdW5jdGlvbiAoIHRoaXNfZXZlbnQgKXtcclxuXHRcdFx0Ly8gYWxzbyBhdmFpbGFibGUgdGhlc2UgdmFyczogXHRyZXNvdXJjZV9pZCwgakNhbENvbnRhaW5lciwgaW5zdFxyXG5cdFx0XHR2YXIgakNlbGwgPSBqUXVlcnkoIHRoaXNfZXZlbnQuY3VycmVudFRhcmdldCApO1xyXG5cdFx0XHR3cGJjX2F2eV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCggakNlbGwsIGNhbGVuZGFyX3BhcmFtc19hcnJbICdhanhfZGF0YV9hcnInIF1bJ3BvcG92ZXJfaGludHMnXSApO1xyXG5cdFx0fSk7XHJcblx0fSApO1xyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERlZmluZSB3aWR0aCBvZiBlbnRpcmUgY2FsZW5kYXJcclxuXHR2YXIgd2lkdGggPSAgICd3aWR0aDonXHRcdCsgICBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fd2lkdGggKyAnOyc7XHRcdFx0XHRcdC8vIHZhciB3aWR0aCA9ICd3aWR0aDoxMDAlO21heC13aWR0aDoxMDAlOyc7XHJcblxyXG5cdGlmICggICAoIHVuZGVmaW5lZCAhPSBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fbWF4X3dpZHRoIClcclxuXHRcdCYmICggJycgIT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX21heF93aWR0aCApXHJcblx0KXtcclxuXHRcdHdpZHRoICs9ICdtYXgtd2lkdGg6JyBcdCsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX21heF93aWR0aCArICc7JztcclxuXHR9IGVsc2Uge1xyXG5cdFx0d2lkdGggKz0gJ21heC13aWR0aDonIFx0KyAoIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19tb250aHNfaW5fcm93ICogMzQxICkgKyAncHg7JztcclxuXHR9XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQWRkIGNhbGVuZGFyIGNvbnRhaW5lcjogXCJDYWxlbmRhciBpcyBsb2FkaW5nLi4uXCIgIGFuZCB0ZXh0YXJlYVxyXG5cdGpRdWVyeSggJy53cGJjX2FqeF9hdnlfX2NhbGVuZGFyJyApLmh0bWwoXHJcblxyXG5cdFx0JzxkaXYgY2xhc3M9XCInXHQrICcgYmtfY2FsZW5kYXJfZnJhbWUnXHJcblx0XHRcdFx0XHRcdCsgJyBtb250aHNfbnVtX2luX3Jvd18nICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX21vbnRoc19pbl9yb3dcclxuXHRcdFx0XHRcdFx0KyAnIGNhbF9tb250aF9udW1fJyBcdCsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzXHJcblx0XHRcdFx0XHRcdCsgJyAnIFx0XHRcdFx0XHQrIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX190aW1lc2xvdF9kYXlfYmdfYXNfYXZhaWxhYmxlIFx0XHRcdFx0Ly8gJ3dwYmNfdGltZXNsb3RfZGF5X2JnX2FzX2F2YWlsYWJsZScgfHwgJydcclxuXHRcdFx0XHQrICdcIiAnXHJcblx0XHRcdCsgJ3N0eWxlPVwiJyArIHdpZHRoICsgJ1wiPidcclxuXHJcblx0XHRcdFx0KyAnPGRpdiBpZD1cImNhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCArICdcIj4nICsgJ0NhbGVuZGFyIGlzIGxvYWRpbmcuLi4nICsgJzwvZGl2PidcclxuXHJcblx0XHQrICc8L2Rpdj4nXHJcblxyXG5cdFx0KyAnPHRleHRhcmVhICAgICAgaWQ9XCJkYXRlX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCArICdcIidcclxuXHRcdFx0XHRcdCsgJyBuYW1lPVwiZGF0ZV9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKyAnXCInXHJcblx0XHRcdFx0XHQrICcgYXV0b2NvbXBsZXRlPVwib2ZmXCInXHJcblx0XHRcdFx0XHQrICcgc3R5bGU9XCJkaXNwbGF5Om5vbmU7d2lkdGg6MTAwJTtoZWlnaHQ6MTBlbTttYXJnaW46MmVtIDAgMDtcIj48L3RleHRhcmVhPidcclxuXHQpO1xyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBjYWxfcGFyYW1fYXJyID0ge1xyXG5cdFx0XHRcdFx0XHRcdCdodG1sX2lkJyAgICAgICAgICAgOiAnY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRcdFx0XHQndGV4dF9pZCcgICAgICAgICAgIDogJ2RhdGVfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHJcblx0XHRcdFx0XHRcdFx0J2NhbGVuZGFyX19zdGFydF93ZWVrX2RheSc6IFx0ICBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fc3RhcnRfd2Vla19kYXksXHJcblx0XHRcdFx0XHRcdFx0J2NhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRocyc6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRocyxcclxuXHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUnOiAgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUsXHJcblxyXG5cdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV9pZCcgICAgICAgIDogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcicgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5hanhfbm9uY2VfY2FsZW5kYXIsXHJcblx0XHRcdFx0XHRcdFx0J2Jvb2tlZF9kYXRlcycgICAgICAgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5ib29rZWRfZGF0ZXMsXHJcblx0XHRcdFx0XHRcdFx0J3NlYXNvbl9hdmFpbGFiaWxpdHknOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5zZWFzb25fYXZhaWxhYmlsaXR5LFxyXG5cclxuXHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfdW5hdmFpbGFibGVfZGF0ZXMnIDogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfZGF0YV9hcnIucmVzb3VyY2VfdW5hdmFpbGFibGVfZGF0ZXMsXHJcblxyXG5cdFx0XHRcdFx0XHRcdCdwb3BvdmVyX2hpbnRzJzogY2FsZW5kYXJfcGFyYW1zX2FyclsgJ2FqeF9kYXRhX2FycicgXVsncG9wb3Zlcl9oaW50cyddXHRcdC8vIHsnc2Vhc29uX3VuYXZhaWxhYmxlJzonLi4uJywnd2Vla2RheXNfdW5hdmFpbGFibGUnOicuLi4nLCdiZWZvcmVfYWZ0ZXJfdW5hdmFpbGFibGUnOicuLi4nLH1cclxuXHRcdFx0XHRcdFx0fTtcclxuXHR3cGJjX3Nob3dfaW5saW5lX2Jvb2tpbmdfY2FsZW5kYXIoIGNhbF9wYXJhbV9hcnIgKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBPbiBjbGljayBBVkFJTEFCTEUgfCAgVU5BVkFJTEFCTEUgYnV0dG9uICBpbiB3aWRnZXRcdC1cdG5lZWQgdG8gIGNoYW5nZSBoZWxwIGRhdGVzIHRleHRcclxuXHQgKi9cclxuXHRqUXVlcnkoICcud3BiY19yYWRpb19fc2V0X2RheXNfYXZhaWxhYmlsaXR5JyApLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50LCByZXNvdXJjZV9pZCwgaW5zdCApe1xyXG5cdFx0d3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfc2VsZWN0KCBqUXVlcnkoICcjJyArIGNhbF9wYXJhbV9hcnIudGV4dF9pZCApLnZhbCgpICwgY2FsX3BhcmFtX2FyciApO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBTaG93IFx0J1NlbGVjdCBkYXlzICBpbiBjYWxlbmRhciB0aGVuIHNlbGVjdCBBdmFpbGFibGUgIC8gIFVuYXZhaWxhYmxlIHN0YXR1cyBhbmQgY2xpY2sgQXBwbHkgYXZhaWxhYmlsaXR5IGJ1dHRvbi4nXHJcblx0alF1ZXJ5KCAnI3dwYmNfdG9vbGJhcl9kYXRlc19oaW50JykuaHRtbCggICAgICc8ZGl2IGNsYXNzPVwidWlfZWxlbWVudFwiPjxzcGFuIGNsYXNzPVwid3BiY191aV9jb250cm9sIHdwYmNfdWlfYWRkb24gd3BiY19oZWxwX3RleHRcIiA+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgY2FsX3BhcmFtX2Fyci5wb3BvdmVyX2hpbnRzLnRvb2xiYXJfdGV4dFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8L3NwYW4+PC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBcdExvYWQgRGF0ZXBpY2sgSW5saW5lIGNhbGVuZGFyXHJcbiAqXHJcbiAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHRcdGV4YW1wbGU6e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2h0bWxfaWQnICAgICAgICAgICA6ICdjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RleHRfaWQnICAgICAgICAgICA6ICdkYXRlX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NhbGVuZGFyX19zdGFydF93ZWVrX2RheSc6IFx0ICBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fc3RhcnRfd2Vla19kYXksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzJzogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlJzogIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV9pZCcgICAgICAgIDogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X25vbmNlX2NhbGVuZGFyJyA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLmFqeF9ub25jZV9jYWxlbmRhcixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29rZWRfZGF0ZXMnICAgICAgIDogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfZGF0YV9hcnIuYm9va2VkX2RhdGVzLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlYXNvbl9hdmFpbGFiaWxpdHknOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5zZWFzb25fYXZhaWxhYmlsaXR5LFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcycgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5yZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3Nob3dfaW5saW5lX2Jvb2tpbmdfY2FsZW5kYXIoIGNhbGVuZGFyX3BhcmFtc19hcnIgKXtcclxuXHJcblx0aWYgKFxyXG5cdFx0ICAgKCAwID09PSBqUXVlcnkoICcjJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuaHRtbF9pZCApLmxlbmd0aCApXHRcdFx0XHRcdFx0XHQvLyBJZiBjYWxlbmRhciBET00gZWxlbWVudCBub3QgZXhpc3QgdGhlbiBleGlzdFxyXG5cdFx0fHwgKCB0cnVlID09PSBqUXVlcnkoICcjJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuaHRtbF9pZCApLmhhc0NsYXNzKCAnaGFzRGF0ZXBpY2snICkgKVx0Ly8gSWYgdGhlIGNhbGVuZGFyIHdpdGggdGhlIHNhbWUgQm9va2luZyByZXNvdXJjZSBhbHJlYWR5ICBoYXMgYmVlbiBhY3RpdmF0ZWQsIHRoZW4gZXhpc3QuXHJcblx0KXtcclxuXHQgICByZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIENvbmZpZ3VyZSBhbmQgc2hvdyBjYWxlbmRhclxyXG5cdGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkudGV4dCggJycgKTtcclxuXHRqUXVlcnkoICcjJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuaHRtbF9pZCApLmRhdGVwaWNrKHtcclxuXHRcdFx0XHRcdGJlZm9yZVNob3dEYXk6IFx0ZnVuY3Rpb24gKCBkYXRlICl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cyggZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG4gICAgICAgICAgICAgICAgICAgIG9uU2VsZWN0OiBcdCAgXHRmdW5jdGlvbiAoIGRhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRqUXVlcnkoICcjJyArIGNhbGVuZGFyX3BhcmFtc19hcnIudGV4dF9pZCApLnZhbCggZGF0ZSApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdC8vd3BiY19ibGlua19lbGVtZW50KCcud3BiY193aWRnZXRfYXZhaWxhYmxlX3VuYXZhaWxhYmxlJywgMywgMjIwKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfc2VsZWN0KCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcbiAgICAgICAgICAgICAgICAgICAgb25Ib3ZlcjogXHRcdGZ1bmN0aW9uICggdmFsdWUsIGRhdGUgKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly93cGJjX2F2eV9fcHJlcGFyZV90b29sdGlwX19pbl9jYWxlbmRhciggdmFsdWUsIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIHRoaXMgKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19vbl9kYXlzX2hvdmVyKCB2YWx1ZSwgZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlTW9udGhZZWFyOlx0bnVsbCxcclxuICAgICAgICAgICAgICAgICAgICBzaG93T246IFx0XHRcdCdib3RoJyxcclxuICAgICAgICAgICAgICAgICAgICBudW1iZXJPZk1vbnRoczogXHRjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRocyxcclxuICAgICAgICAgICAgICAgICAgICBzdGVwTW9udGhzOlx0XHRcdDEsXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJldlRleHQ6IFx0XHRcdCcmbGFxdW87JyxcclxuICAgICAgICAgICAgICAgICAgICAvLyBuZXh0VGV4dDogXHRcdFx0JyZyYXF1bzsnLFxyXG5cdFx0XHRcdFx0cHJldlRleHQgICAgICA6ICcmbHNhcXVvOycsXHJcblx0XHRcdFx0XHRuZXh0VGV4dCAgICAgIDogJyZyc2FxdW87JyxcclxuICAgICAgICAgICAgICAgICAgICBkYXRlRm9ybWF0OiBcdFx0J3l5LW1tLWRkJywvLyAnZGQubW0ueXknLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZU1vbnRoOiBcdFx0ZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlWWVhcjogXHRcdGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIG1pbkRhdGU6IFx0XHRcdFx0XHQgMCxcdFx0Ly9udWxsLCAgLy9TY3JvbGwgYXMgbG9uZyBhcyB5b3UgbmVlZFxyXG5cdFx0XHRcdFx0bWF4RGF0ZTogXHRcdFx0XHRcdCcxMHknLFx0Ly8gbWluRGF0ZTogbmV3IERhdGUoMjAyMCwgMiwgMSksIG1heERhdGU6IG5ldyBEYXRlKDIwMjAsIDksIDMxKSwgXHQvLyBBYmlsaXR5IHRvIHNldCBhbnkgIHN0YXJ0IGFuZCBlbmQgZGF0ZSBpbiBjYWxlbmRhclxyXG4gICAgICAgICAgICAgICAgICAgIHNob3dTdGF0dXM6IFx0XHRmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBjbG9zZUF0VG9wOiBcdFx0ZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZmlyc3REYXk6XHRcdFx0Y2FsZW5kYXJfcGFyYW1zX2Fyci5jYWxlbmRhcl9fc3RhcnRfd2Vla19kYXksXHJcbiAgICAgICAgICAgICAgICAgICAgZ290b0N1cnJlbnQ6IFx0XHRmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBoaWRlSWZOb1ByZXZOZXh0Olx0dHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBtdWx0aVNlcGFyYXRvcjogXHQnLCAnLFxyXG5cdFx0XHRcdFx0bXVsdGlTZWxlY3Q6ICgoJ2R5bmFtaWMnID09IGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUpID8gMCA6IDM2NSksXHRcdFx0Ly8gTWF4aW11bSBudW1iZXIgb2Ygc2VsZWN0YWJsZSBkYXRlczpcdCBTaW5nbGUgZGF5ID0gMCwgIG11bHRpIGRheXMgPSAzNjVcclxuXHRcdFx0XHRcdHJhbmdlU2VsZWN0OiAgKCdkeW5hbWljJyA9PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlKSxcclxuXHRcdFx0XHRcdHJhbmdlU2VwYXJhdG9yOiBcdCcgfiAnLFx0XHRcdFx0XHQvLycgLSAnLFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIHNob3dXZWVrczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICB1c2VUaGVtZVJvbGxlcjpcdFx0ZmFsc2VcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuXHRyZXR1cm4gIHRydWU7XHJcbn1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IENTUyB0byBjYWxlbmRhciBkYXRlIGNlbGxzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0XHQtICBKYXZhU2NyaXB0IERhdGUgT2JqOiAgXHRcdE1vbiBEZWMgMTEgMjAyMyAwMDowMDowMCBHTVQrMDIwMCAoRWFzdGVybiBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lKVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJodG1sX2lkXCI6IFwiY2FsZW5kYXJfYm9va2luZzRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJ0ZXh0X2lkXCI6IFwiZGF0ZV9ib29raW5nNFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImNhbGVuZGFyX19zdGFydF93ZWVrX2RheVwiOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRoc1wiOiAxMixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJyZXNvdXJjZV9pZFwiOiA0LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImFqeF9ub25jZV9jYWxlbmRhclwiOiBcIjxpbnB1dCB0eXBlPVxcXCJoaWRkZW5cXFwiIC4uLiAvPlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImJvb2tlZF9kYXRlc1wiOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMTItMjgtMjAyMlwiOiBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYm9va2luZ19kYXRlXCI6IFwiMjAyMi0xMi0yOCAwMDowMDowMFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYXBwcm92ZWRcIjogXCIxXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJib29raW5nX2lkXCI6IFwiMjZcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSwgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlYXNvbl9hdmFpbGFiaWxpdHknOntcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMDlcIjogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMTBcIjogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMTFcIjogdHJ1ZSwgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHRcdFx0LSB0aGlzIG9mIGRhdGVwaWNrIE9ialxyXG5cdCAqXHJcblx0ICogQHJldHVybnMgW2Jvb2xlYW4sc3RyaW5nXVx0LSBbIHt0cnVlIC1hdmFpbGFibGUgfCBmYWxzZSAtIHVuYXZhaWxhYmxlfSwgJ0NTUyBjbGFzc2VzIGZvciBjYWxlbmRhciBkYXkgY2VsbCcgXVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cyggZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyApe1xyXG5cclxuXHRcdHZhciB0b2RheV9kYXRlID0gbmV3IERhdGUoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMCBdLCAocGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMSBdICkgLSAxKSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAyIF0sIDAsIDAsIDAgKTtcclxuXHJcblx0XHR2YXIgY2xhc3NfZGF5ICA9ICggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy0nICsgZGF0ZS5nZXREYXRlKCkgKyAnLScgKyBkYXRlLmdldEZ1bGxZZWFyKCk7XHRcdFx0XHRcdFx0Ly8gJzEtOS0yMDIzJ1xyXG5cdFx0dmFyIHNxbF9jbGFzc19kYXkgPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHJcblx0XHR2YXIgY3NzX2RhdGVfX3N0YW5kYXJkICAgPSAgJ2NhbDRkYXRlLScgKyBjbGFzc19kYXk7XHJcblx0XHR2YXIgY3NzX2RhdGVfX2FkZGl0aW9uYWwgPSAnIHdwYmNfd2Vla2RheV8nICsgZGF0ZS5nZXREYXkoKSArICcgJztcclxuXHJcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0Ly8gV0VFS0RBWVMgOjogU2V0IHVuYXZhaWxhYmxlIHdlZWsgZGF5cyBmcm9tIC0gU2V0dGluZ3MgR2VuZXJhbCBwYWdlIGluIFwiQXZhaWxhYmlsaXR5XCIgc2VjdGlvblxyXG5cdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X193ZWVrX2RheXNfdW5hdmFpbGFibGUnICkubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0aWYgKCBkYXRlLmdldERheSgpID09IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fd2Vla19kYXlzX3VuYXZhaWxhYmxlJyApWyBpIF0gKSB7XHJcblx0XHRcdFx0cmV0dXJuIFsgISFmYWxzZSwgY3NzX2RhdGVfX3N0YW5kYXJkICsgJyBkYXRlX3VzZXJfdW5hdmFpbGFibGUnIFx0KyAnIHdlZWtkYXlzX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQkVGT1JFX0FGVEVSIDo6IFNldCB1bmF2YWlsYWJsZSBkYXlzIEJlZm9yZSAvIEFmdGVyIHRoZSBUb2RheSBkYXRlXHJcblx0XHRpZiAoIFx0KCAod3BiY19kYXRlc19fZGF5c19iZXR3ZWVuKCBkYXRlLCB0b2RheV9kYXRlICkpIDwgcGFyc2VJbnQoX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X191bmF2YWlsYWJsZV9mcm9tX3RvZGF5JyApKSApXHJcblx0XHRcdCB8fCAoXHJcblx0XHRcdFx0ICAgKCBwYXJzZUludCggJzAnICsgcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fYXZhaWxhYmxlX2Zyb21fdG9kYXknICkgKSApID4gMCApXHJcblx0XHRcdFx0JiYgKCB3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oIGRhdGUsIHRvZGF5X2RhdGUgKSA+IHBhcnNlSW50KCAnMCcgKyBwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X19hdmFpbGFibGVfZnJvbV90b2RheScgKSApICkgKVxyXG5cdFx0XHRcdClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiBbICEhZmFsc2UsIGNzc19kYXRlX19zdGFuZGFyZCArICcgZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyBcdFx0KyAnIGJlZm9yZV9hZnRlcl91bmF2YWlsYWJsZScgXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTRUFTT05TIDo6ICBcdFx0XHRcdFx0Qm9va2luZyA+IFJlc291cmNlcyA+IEF2YWlsYWJpbGl0eSBwYWdlXHJcblx0XHR2YXIgICAgaXNfZGF0ZV9hdmFpbGFibGUgPSBjYWxlbmRhcl9wYXJhbXNfYXJyLnNlYXNvbl9hdmFpbGFiaWxpdHlbIHNxbF9jbGFzc19kYXkgXTtcclxuXHRcdGlmICggZmFsc2UgPT09IGlzX2RhdGVfYXZhaWxhYmxlICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjUuNC40LlxyXG5cdFx0XHRyZXR1cm4gWyAhIWZhbHNlLCBjc3NfZGF0ZV9fc3RhbmRhcmQgKyAnIGRhdGVfdXNlcl91bmF2YWlsYWJsZSdcdFx0KyAnIHNlYXNvbl91bmF2YWlsYWJsZScgXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBSRVNPVVJDRV9VTkFWQUlMQUJMRSA6OiAgIFx0Qm9va2luZyA+IEF2YWlsYWJpbGl0eSBwYWdlXHJcblx0XHRpZiAoIHdwYmNfaW5fYXJyYXkoY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcywgc3FsX2NsYXNzX2RheSApICl7XHJcblx0XHRcdGlzX2RhdGVfYXZhaWxhYmxlID0gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRpZiAoICBmYWxzZSA9PT0gaXNfZGF0ZV9hdmFpbGFibGUgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjUuNC40LlxyXG5cdFx0XHRyZXR1cm4gWyAhZmFsc2UsIGNzc19kYXRlX19zdGFuZGFyZCArICcgZGF0ZV91c2VyX3VuYXZhaWxhYmxlJ1x0XHQrICcgcmVzb3VyY2VfdW5hdmFpbGFibGUnIF07XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cdFx0Ly8gSXMgYW55IGJvb2tpbmdzIGluIHRoaXMgZGF0ZSA/XHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIGNhbGVuZGFyX3BhcmFtc19hcnIuYm9va2VkX2RhdGVzWyBjbGFzc19kYXkgXSApICkge1xyXG5cclxuXHRcdFx0dmFyIGJvb2tpbmdzX2luX2RhdGUgPSBjYWxlbmRhcl9wYXJhbXNfYXJyLmJvb2tlZF9kYXRlc1sgY2xhc3NfZGF5IF07XHJcblxyXG5cclxuXHRcdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBib29raW5nc19pbl9kYXRlWyAnc2VjXzAnIF0gKSApIHtcdFx0XHQvLyBcIkZ1bGwgZGF5XCIgYm9va2luZyAgLT4gKHNlY29uZHMgPT0gMClcclxuXHJcblx0XHRcdFx0Y3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gKCAnMCcgPT09IGJvb2tpbmdzX2luX2RhdGVbICdzZWNfMCcgXS5hcHByb3ZlZCApID8gJyBkYXRlMmFwcHJvdmUgJyA6ICcgZGF0ZV9hcHByb3ZlZCAnO1x0XHRcdFx0Ly8gUGVuZGluZyA9ICcwJyB8ICBBcHByb3ZlZCA9ICcxJ1xyXG5cdFx0XHRcdGNzc19kYXRlX19hZGRpdGlvbmFsICs9ICcgZnVsbF9kYXlfYm9va2luZyc7XHJcblxyXG5cdFx0XHRcdHJldHVybiBbICFmYWxzZSwgY3NzX2RhdGVfX3N0YW5kYXJkICsgY3NzX2RhdGVfX2FkZGl0aW9uYWwgXTtcclxuXHJcblx0XHRcdH0gZWxzZSBpZiAoIE9iamVjdC5rZXlzKCBib29raW5nc19pbl9kYXRlICkubGVuZ3RoID4gMCApe1x0XHRcdFx0Ly8gXCJUaW1lIHNsb3RzXCIgQm9va2luZ3NcclxuXHJcblx0XHRcdFx0dmFyIGlzX2FwcHJvdmVkID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0Xy5lYWNoKCBib29raW5nc19pbl9kYXRlLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0XHRcdFx0aWYgKCAhcGFyc2VJbnQoIHBfdmFsLmFwcHJvdmVkICkgKXtcclxuXHRcdFx0XHRcdFx0aXNfYXBwcm92ZWQgPSBmYWxzZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHZhciB0cyA9IHBfdmFsLmJvb2tpbmdfZGF0ZS5zdWJzdHJpbmcoIHBfdmFsLmJvb2tpbmdfZGF0ZS5sZW5ndGggLSAxICk7XHJcblx0XHRcdFx0XHRpZiAoIHRydWUgPT09IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2lzX2VuYWJsZWRfY2hhbmdlX292ZXInICkgKXtcclxuXHRcdFx0XHRcdFx0aWYgKCB0cyA9PSAnMScgKSB7IGNzc19kYXRlX19hZGRpdGlvbmFsICs9ICcgY2hlY2tfaW5fdGltZScgKyAoKHBhcnNlSW50KHBfdmFsLmFwcHJvdmVkKSkgPyAnIGNoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgOiAnIGNoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyk7IH1cclxuXHRcdFx0XHRcdFx0aWYgKCB0cyA9PSAnMicgKSB7IGNzc19kYXRlX19hZGRpdGlvbmFsICs9ICcgY2hlY2tfb3V0X3RpbWUnICsgKChwYXJzZUludChwX3ZhbC5hcHByb3ZlZCkpID8gJyBjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJyA6ICcgY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJyk7IH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdGlmICggISBpc19hcHByb3ZlZCApe1xyXG5cdFx0XHRcdFx0Y3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gJyBkYXRlMmFwcHJvdmUgdGltZXNwYXJ0bHknXHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNzc19kYXRlX19hZGRpdGlvbmFsICs9ICcgZGF0ZV9hcHByb3ZlZCB0aW1lc3BhcnRseSdcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdpc19lbmFibGVkX2NoYW5nZV9vdmVyJyApICl7XHJcblx0XHRcdFx0XHRjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIHRpbWVzX2Nsb2NrJ1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdHJldHVybiBbIHRydWUsIGNzc19kYXRlX19zdGFuZGFyZCArIGNzc19kYXRlX19hZGRpdGlvbmFsICsgJyBkYXRlX2F2YWlsYWJsZScgXTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBzb21lIENTUyBjbGFzc2VzLCB3aGVuIHdlIG1vdXNlIG92ZXIgc3BlY2lmaWMgZGF0ZXMgaW4gY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gdmFsdWVcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0XHQtICBKYXZhU2NyaXB0IERhdGUgT2JqOiAgXHRcdE1vbiBEZWMgMTEgMjAyMyAwMDowMDowMCBHTVQrMDIwMCAoRWFzdGVybiBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lKVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJodG1sX2lkXCI6IFwiY2FsZW5kYXJfYm9va2luZzRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJ0ZXh0X2lkXCI6IFwiZGF0ZV9ib29raW5nNFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImNhbGVuZGFyX19zdGFydF93ZWVrX2RheVwiOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRoc1wiOiAxMixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJyZXNvdXJjZV9pZFwiOiA0LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImFqeF9ub25jZV9jYWxlbmRhclwiOiBcIjxpbnB1dCB0eXBlPVxcXCJoaWRkZW5cXFwiIC4uLiAvPlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImJvb2tlZF9kYXRlc1wiOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMTItMjgtMjAyMlwiOiBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYm9va2luZ19kYXRlXCI6IFwiMjAyMi0xMi0yOCAwMDowMDowMFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYXBwcm92ZWRcIjogXCIxXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJib29raW5nX2lkXCI6IFwiMjZcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSwgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlYXNvbl9hdmFpbGFiaWxpdHknOntcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMDlcIjogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMTBcIjogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMTFcIjogdHJ1ZSwgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHRcdFx0LSB0aGlzIG9mIGRhdGVwaWNrIE9ialxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfaG92ZXIoIHZhbHVlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0aWYgKCBudWxsID09PSBkYXRlICl7XHJcblx0XHRcdGpRdWVyeSggJy5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApOyAgIFx0ICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgYWxsIGhpZ2hsaWdodCBkYXlzIHNlbGVjdGlvbnNcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBpbnN0ID0galF1ZXJ5LmRhdGVwaWNrLl9nZXRJbnN0KCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCApICk7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIDEgPT0gaW5zdC5kYXRlcy5sZW5ndGgpXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gSWYgd2UgaGF2ZSBvbmUgc2VsZWN0ZWQgZGF0ZVxyXG5cdFx0XHQmJiAoJ2R5bmFtaWMnID09PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlKSBcdFx0XHRcdFx0Ly8gd2hpbGUgaGF2ZSByYW5nZSBkYXlzIHNlbGVjdGlvbiBtb2RlXHJcblx0XHQpe1xyXG5cclxuXHRcdFx0dmFyIHRkX2NsYXNzO1xyXG5cdFx0XHR2YXIgdGRfb3ZlcnMgPSBbXTtcclxuXHRcdFx0dmFyIGlzX2NoZWNrID0gdHJ1ZTtcclxuICAgICAgICAgICAgdmFyIHNlbGNldGVkX2ZpcnN0X2RheSA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgICAgIHNlbGNldGVkX2ZpcnN0X2RheS5zZXRGdWxsWWVhcihpbnN0LmRhdGVzWzBdLmdldEZ1bGxZZWFyKCksKGluc3QuZGF0ZXNbMF0uZ2V0TW9udGgoKSksIChpbnN0LmRhdGVzWzBdLmdldERhdGUoKSApICk7IC8vR2V0IGZpcnN0IERhdGVcclxuXHJcbiAgICAgICAgICAgIHdoaWxlKCAgaXNfY2hlY2sgKXtcclxuXHJcblx0XHRcdFx0dGRfY2xhc3MgPSAoc2VsY2V0ZWRfZmlyc3RfZGF5LmdldE1vbnRoKCkgKyAxKSArICctJyArIHNlbGNldGVkX2ZpcnN0X2RheS5nZXREYXRlKCkgKyAnLScgKyBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RnVsbFllYXIoKTtcclxuXHJcblx0XHRcdFx0dGRfb3ZlcnNbIHRkX292ZXJzLmxlbmd0aCBdID0gJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKyAnIC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3M7ICAgICAgICAgICAgICAvLyBhZGQgdG8gYXJyYXkgZm9yIGxhdGVyIG1ha2Ugc2VsZWN0aW9uIGJ5IGNsYXNzXHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG5cdFx0XHRcdFx0KCAgKCBkYXRlLmdldE1vbnRoKCkgPT0gc2VsY2V0ZWRfZmlyc3RfZGF5LmdldE1vbnRoKCkgKSAgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAoIGRhdGUuZ2V0RGF0ZSgpID09IHNlbGNldGVkX2ZpcnN0X2RheS5nZXREYXRlKCkgKSAgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAoIGRhdGUuZ2V0RnVsbFllYXIoKSA9PSBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RnVsbFllYXIoKSApXHJcblx0XHRcdFx0XHQpIHx8ICggc2VsY2V0ZWRfZmlyc3RfZGF5ID4gZGF0ZSApXHJcblx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdGlzX2NoZWNrID0gIGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0c2VsY2V0ZWRfZmlyc3RfZGF5LnNldEZ1bGxZZWFyKCBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RnVsbFllYXIoKSwgKHNlbGNldGVkX2ZpcnN0X2RheS5nZXRNb250aCgpKSwgKHNlbGNldGVkX2ZpcnN0X2RheS5nZXREYXRlKCkgKyAxKSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBIaWdobGlnaHQgRGF5c1xyXG5cdFx0XHRmb3IgKCB2YXIgaT0wOyBpIDwgdGRfb3ZlcnMubGVuZ3RoIDsgaSsrKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCBjbGFzcyB0byBhbGwgZWxlbWVudHNcclxuXHRcdFx0XHRqUXVlcnkoIHRkX292ZXJzW2ldICkuYWRkQ2xhc3MoJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblxyXG5cdFx0fVxyXG5cclxuXHQgICAgcmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogT24gREFZcyBzZWxlY3Rpb24gaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlc19zZWxlY3Rpb25cdFx0LSAgc3RyaW5nOlx0XHRcdCAnMjAyMy0wMy0wNyB+IDIwMjMtMDMtMDcnIG9yICcyMDIzLTA0LTEwLCAyMDIzLTA0LTEyLCAyMDIzLTA0LTAyLCAyMDIzLTA0LTA0J1xyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJodG1sX2lkXCI6IFwiY2FsZW5kYXJfYm9va2luZzRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJ0ZXh0X2lkXCI6IFwiZGF0ZV9ib29raW5nNFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImNhbGVuZGFyX19zdGFydF93ZWVrX2RheVwiOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRoc1wiOiAxMixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJyZXNvdXJjZV9pZFwiOiA0LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImFqeF9ub25jZV9jYWxlbmRhclwiOiBcIjxpbnB1dCB0eXBlPVxcXCJoaWRkZW5cXFwiIC4uLiAvPlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImJvb2tlZF9kYXRlc1wiOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMTItMjgtMjAyMlwiOiBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYm9va2luZ19kYXRlXCI6IFwiMjAyMi0xMi0yOCAwMDowMDowMFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYXBwcm92ZWRcIjogXCIxXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJib29raW5nX2lkXCI6IFwiMjZcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSwgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlYXNvbl9hdmFpbGFiaWxpdHknOntcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMDlcIjogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMTBcIjogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDEtMTFcIjogdHJ1ZSwgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHRcdFx0LSB0aGlzIG9mIGRhdGVwaWNrIE9ialxyXG5cdCAqXHJcblx0ICogQHJldHVybnMgYm9vbGVhblxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19vbl9kYXlzX3NlbGVjdCggZGF0ZXNfc2VsZWN0aW9uLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzID0gbnVsbCApe1xyXG5cclxuXHRcdHZhciBpbnN0ID0galF1ZXJ5LmRhdGVwaWNrLl9nZXRJbnN0KCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCApICk7XHJcblxyXG5cdFx0dmFyIGRhdGVzX2FyciA9IFtdO1x0Ly8gIFsgXCIyMDIzLTA0LTA5XCIsIFwiMjAyMy0wNC0xMFwiLCBcIjIwMjMtMDQtMTFcIiBdXHJcblxyXG5cdFx0aWYgKCAtMSAhPT0gZGF0ZXNfc2VsZWN0aW9uLmluZGV4T2YoICd+JyApICkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSYW5nZSBEYXlzXHJcblxyXG5cdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfcmFuZ2VfanMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlc19zZXBhcmF0b3InIDogJyB+ICcsICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAnIH4gJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RhdGVzJyAgICAgICAgICAgOiBkYXRlc19zZWxlY3Rpb24sICAgIFx0XHQgICAvLyAnMjAyMy0wNC0wNCB+IDIwMjMtMDQtMDcnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHRcdH0gZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNdWx0aXBsZSBEYXlzXHJcblx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X2RhdGVzX2Fycl9fZnJvbV9kYXRlc19jb21tYV9zZXBhcmF0ZWRfanMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlc19zZXBhcmF0b3InIDogJywgJywgICAgICAgICAgICAgICAgICAgICAgICAgXHQvLyAgJywgJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RhdGVzJyAgICAgICAgICAgOiBkYXRlc19zZWxlY3Rpb24sICAgIFx0XHRcdC8vICcyMDIzLTA0LTEwLCAyMDIzLTA0LTEyLCAyMDIzLTA0LTAyLCAyMDIzLTA0LTA0J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHR3cGJjX2F2eV9hZnRlcl9kYXlzX3NlbGVjdGlvbl9fc2hvd19oZWxwX2luZm8oe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlJzogY2FsZW5kYXJfcGFyYW1zX2Fyci5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlc19hcnInICAgICAgICAgICAgICAgICAgICA6IGRhdGVzX2FycixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlc19jbGlja19udW0nICAgICAgICAgICAgICA6IGluc3QuZGF0ZXMubGVuZ3RoLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BvcG92ZXJfaGludHMnXHRcdFx0XHRcdDogY2FsZW5kYXJfcGFyYW1zX2Fyci5wb3BvdmVyX2hpbnRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2hvdyBoZWxwIGluZm8gYXQgdGhlIHRvcCAgdG9vbGJhciBhYm91dCBzZWxlY3RlZCBkYXRlcyBhbmQgZnV0dXJlIGFjdGlvbnNcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcGFyYW1zXHJcblx0XHQgKiBcdFx0XHRcdFx0RXhhbXBsZSAxOiAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGU6IFwiZHluYW1pY1wiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfYXJyOiAgWyBcIjIwMjMtMDQtMDNcIiBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfY2xpY2tfbnVtOiAxXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncG9wb3Zlcl9oaW50cydcdFx0XHRcdFx0OiBjYWxlbmRhcl9wYXJhbXNfYXJyLnBvcG92ZXJfaGludHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHQgKiBcdFx0XHRcdFx0RXhhbXBsZSAyOiAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGU6IFwiZHluYW1pY1wiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19hcnI6IEFycmF5KDEwKSBbIFwiMjAyMy0wNC0wM1wiLCBcIjIwMjMtMDQtMDRcIiwgXCIyMDIzLTA0LTA1XCIsIOKApiBdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19jbGlja19udW06IDJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwb3BvdmVyX2hpbnRzJ1x0XHRcdFx0XHQ6IGNhbGVuZGFyX3BhcmFtc19hcnIucG9wb3Zlcl9oaW50c1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19hdnlfYWZ0ZXJfZGF5c19zZWxlY3Rpb25fX3Nob3dfaGVscF9pbmZvKCBwYXJhbXMgKXtcclxuLy8gY29uc29sZS5sb2coIHBhcmFtcyApO1x0Ly9cdFx0WyBcIjIwMjMtMDQtMDlcIiwgXCIyMDIzLTA0LTEwXCIsIFwiMjAyMy0wNC0xMVwiIF1cclxuXHJcblx0XHRcdHZhciBtZXNzYWdlLCBjb2xvcjtcclxuXHRcdFx0aWYgKGpRdWVyeSggJyN1aV9idG5fYXZ5X19zZXRfZGF5c19hdmFpbGFiaWxpdHlfX2F2YWlsYWJsZScpLmlzKCc6Y2hlY2tlZCcpKXtcclxuXHRcdFx0XHQgbWVzc2FnZSA9IHBhcmFtcy5wb3BvdmVyX2hpbnRzLnRvb2xiYXJfdGV4dF9hdmFpbGFibGU7Ly8nU2V0IGRhdGVzIF9EQVRFU18gYXMgX0hUTUxfIGF2YWlsYWJsZS4nO1xyXG5cdFx0XHRcdCBjb2xvciA9ICcjMTFiZTRjJztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRtZXNzYWdlID0gcGFyYW1zLnBvcG92ZXJfaGludHMudG9vbGJhcl90ZXh0X3VuYXZhaWxhYmxlOy8vJ1NldCBkYXRlcyBfREFURVNfIGFzIF9IVE1MXyB1bmF2YWlsYWJsZS4nO1xyXG5cdFx0XHRcdGNvbG9yID0gJyNlNDM5MzknO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRtZXNzYWdlID0gJzxzcGFuPicgKyBtZXNzYWdlICsgJzwvc3Bhbj4nO1xyXG5cclxuXHRcdFx0dmFyIGZpcnN0X2RhdGUgPSBwYXJhbXNbICdkYXRlc19hcnInIF1bIDAgXTtcclxuXHRcdFx0dmFyIGxhc3RfZGF0ZSAgPSAoICdkeW5hbWljJyA9PSBwYXJhbXMuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUgKVxyXG5cdFx0XHRcdFx0XHRcdD8gcGFyYW1zWyAnZGF0ZXNfYXJyJyBdWyAocGFyYW1zWyAnZGF0ZXNfYXJyJyBdLmxlbmd0aCAtIDEpIF1cclxuXHRcdFx0XHRcdFx0XHQ6ICggcGFyYW1zWyAnZGF0ZXNfYXJyJyBdLmxlbmd0aCA+IDEgKSA/IHBhcmFtc1sgJ2RhdGVzX2FycicgXVsgMSBdIDogJyc7XHJcblxyXG5cdFx0XHRmaXJzdF9kYXRlID0galF1ZXJ5LmRhdGVwaWNrLmZvcm1hdERhdGUoICdkZCBNLCB5eScsIG5ldyBEYXRlKCBmaXJzdF9kYXRlICsgJ1QwMDowMDowMCcgKSApO1xyXG5cdFx0XHRsYXN0X2RhdGUgPSBqUXVlcnkuZGF0ZXBpY2suZm9ybWF0RGF0ZSggJ2RkIE0sIHl5JywgIG5ldyBEYXRlKCBsYXN0X2RhdGUgKyAnVDAwOjAwOjAwJyApICk7XHJcblxyXG5cclxuXHRcdFx0aWYgKCAnZHluYW1pYycgPT0gcGFyYW1zLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlICl7XHJcblx0XHRcdFx0aWYgKCAxID09IHBhcmFtcy5kYXRlc19jbGlja19udW0gKXtcclxuXHRcdFx0XHRcdGxhc3RfZGF0ZSA9ICdfX19fX19fX19fXydcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aWYgKCAnZmlyc3RfdGltZScgPT0galF1ZXJ5KCAnLndwYmNfYWp4X2F2YWlsYWJpbGl0eV9jb250YWluZXInICkuYXR0ciggJ3dwYmNfbG9hZGVkJyApICl7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF9hdmFpbGFiaWxpdHlfY29udGFpbmVyJyApLmF0dHIoICd3cGJjX2xvYWRlZCcsICdkb25lJyApXHJcblx0XHRcdFx0XHRcdHdwYmNfYmxpbmtfZWxlbWVudCggJy53cGJjX3dpZGdldF9hdmFpbGFibGVfdW5hdmFpbGFibGUnLCAzLCAyMjAgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0bWVzc2FnZSA9IG1lc3NhZ2UucmVwbGFjZSggJ19EQVRFU18nLCAgICAnPC9zcGFuPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vKyAnPGRpdj4nICsgJ2Zyb20nICsgJzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuIGNsYXNzPVwid3BiY19iaWdfZGF0ZVwiPicgKyBmaXJzdF9kYXRlICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3Bhbj4nICsgJy0nICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfYmlnX2RhdGVcIj4nICsgbGFzdF9kYXRlICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3Bhbj4nICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Ly8gaWYgKCBwYXJhbXNbICdkYXRlc19hcnInIF0ubGVuZ3RoID4gMSApe1xyXG5cdFx0XHRcdC8vIFx0bGFzdF9kYXRlID0gJywgJyArIGxhc3RfZGF0ZTtcclxuXHRcdFx0XHQvLyBcdGxhc3RfZGF0ZSArPSAoIHBhcmFtc1sgJ2RhdGVzX2FycicgXS5sZW5ndGggPiAyICkgPyAnLCAuLi4nIDogJyc7XHJcblx0XHRcdFx0Ly8gfSBlbHNlIHtcclxuXHRcdFx0XHQvLyBcdGxhc3RfZGF0ZT0nJztcclxuXHRcdFx0XHQvLyB9XHJcblx0XHRcdFx0dmFyIGRhdGVzX2FyciA9IFtdO1xyXG5cdFx0XHRcdGZvciggdmFyIGkgPSAwOyBpIDwgcGFyYW1zWyAnZGF0ZXNfYXJyJyBdLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdFx0XHRkYXRlc19hcnIucHVzaCggIGpRdWVyeS5kYXRlcGljay5mb3JtYXREYXRlKCAnZGQgTSB5eScsICBuZXcgRGF0ZSggcGFyYW1zWyAnZGF0ZXNfYXJyJyBdWyBpIF0gKyAnVDAwOjAwOjAwJyApICkgICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGZpcnN0X2RhdGUgPSBkYXRlc19hcnIuam9pbiggJywgJyApO1xyXG5cdFx0XHRcdG1lc3NhZ2UgPSBtZXNzYWdlLnJlcGxhY2UoICdfREFURVNfJywgICAgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfYmlnX2RhdGVcIj4nICsgZmlyc3RfZGF0ZSArICc8L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnPHNwYW4+JyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdG1lc3NhZ2UgPSBtZXNzYWdlLnJlcGxhY2UoICdfSFRNTF8nICwgJzwvc3Bhbj48c3BhbiBjbGFzcz1cIndwYmNfYmlnX3RleHRcIiBzdHlsZT1cImNvbG9yOicrY29sb3IrJztcIj4nKSArICc8c3Bhbj4nO1xyXG5cclxuXHRcdFx0Ly9tZXNzYWdlICs9ICcgPGRpdiBzdHlsZT1cIm1hcmdpbi1sZWZ0OiAxZW07XCI+JyArICcgQ2xpY2sgb24gQXBwbHkgYnV0dG9uIHRvIGFwcGx5IGF2YWlsYWJpbGl0eS4nICsgJzwvZGl2Pic7XHJcblxyXG5cdFx0XHRtZXNzYWdlID0gJzxkaXYgY2xhc3M9XCJ3cGJjX3Rvb2xiYXJfZGF0ZXNfaGludHNcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nO1xyXG5cclxuXHRcdFx0alF1ZXJ5KCAnLndwYmNfaGVscF90ZXh0JyApLmh0bWwoXHRtZXNzYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqICAgUGFyc2UgZGF0ZXMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBkYXRlcyBhcnJheSwgIGZyb20gY29tbWEgc2VwYXJhdGVkIGRhdGVzXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHBhcmFtcyAgICAgICA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogJ2RhdGVzX3NlcGFyYXRvcicgPT4gJywgJywgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGF0ZXMgc2VwYXJhdG9yXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqICdkYXRlcycgICAgICAgICAgID0+ICcyMDIzLTA0LTA0LCAyMDIzLTA0LTA3LCAyMDIzLTA0LTA1JyAgICAgICAgIC8vIERhdGVzIGluICdZLW0tZCcgZm9ybWF0OiAnMjAyMy0wMS0zMSdcclxuXHRcdFx0XHRcdFx0XHRcdCB9XHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiBhcnJheSAgICAgID0gW1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiBbMF0gPT4gMjAyMy0wNC0wNFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiBbMV0gPT4gMjAyMy0wNC0wNVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiBbMl0gPT4gMjAyMy0wNC0wNlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiBbM10gPT4gMjAyMy0wNC0wN1xyXG5cdFx0XHRcdFx0XHRcdFx0XVxyXG5cdFx0ICpcclxuXHRcdCAqIEV4YW1wbGUgIzE6ICB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfY29tbWFfc2VwYXJhdGVkX2pzKCAgeyAgJ2RhdGVzX3NlcGFyYXRvcicgOiAnLCAnLCAnZGF0ZXMnIDogJzIwMjMtMDQtMDQsIDIwMjMtMDQtMDcsIDIwMjMtMDQtMDUnICB9ICApO1xyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfY29tbWFfc2VwYXJhdGVkX2pzKCBwYXJhbXMgKXtcclxuXHJcblx0XHRcdHZhciBkYXRlc19hcnIgPSBbXTtcclxuXHJcblx0XHRcdGlmICggJycgIT09IHBhcmFtc1sgJ2RhdGVzJyBdICl7XHJcblxyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHBhcmFtc1sgJ2RhdGVzJyBdLnNwbGl0KCBwYXJhbXNbICdkYXRlc19zZXBhcmF0b3InIF0gKTtcclxuXHJcblx0XHRcdFx0ZGF0ZXNfYXJyLnNvcnQoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZGF0ZXNfYXJyO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGRhdGVzIGFycmF5LCAgZnJvbSByYW5nZSBkYXlzIHNlbGVjdGlvblxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBwYXJhbXMgICAgICAgPSAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiAnZGF0ZXNfc2VwYXJhdG9yJyA9PiAnIH4gJywgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGF0ZXMgc2VwYXJhdG9yXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqICdkYXRlcycgICAgICAgICAgID0+ICcyMDIzLTA0LTA0IH4gMjAyMy0wNC0wNycgICAgICAvLyBEYXRlcyBpbiAnWS1tLWQnIGZvcm1hdDogJzIwMjMtMDEtMzEnXHJcblx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIGFycmF5ICAgICAgICA9IFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzBdID0+IDIwMjMtMDQtMDRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzFdID0+IDIwMjMtMDQtMDVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzJdID0+IDIwMjMtMDQtMDZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzNdID0+IDIwMjMtMDQtMDdcclxuXHRcdFx0XHRcdFx0XHRcdCAgXVxyXG5cdFx0ICpcclxuXHRcdCAqIEV4YW1wbGUgIzE6ICB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfcmFuZ2VfanMoICB7ICAnZGF0ZXNfc2VwYXJhdG9yJyA6ICcgfiAnLCAnZGF0ZXMnIDogJzIwMjMtMDQtMDQgfiAyMDIzLTA0LTA3JyAgfSAgKTtcclxuXHRcdCAqIEV4YW1wbGUgIzI6ICB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfcmFuZ2VfanMoICB7ICAnZGF0ZXNfc2VwYXJhdG9yJyA6ICcgLSAnLCAnZGF0ZXMnIDogJzIwMjMtMDQtMDQgLSAyMDIzLTA0LTA3JyAgfSAgKTtcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX3JhbmdlX2pzKCBwYXJhbXMgKXtcclxuXHJcblx0XHRcdHZhciBkYXRlc19hcnIgPSBbXTtcclxuXHJcblx0XHRcdGlmICggJycgIT09IHBhcmFtc1snZGF0ZXMnXSApIHtcclxuXHJcblx0XHRcdFx0ZGF0ZXNfYXJyID0gcGFyYW1zWyAnZGF0ZXMnIF0uc3BsaXQoIHBhcmFtc1sgJ2RhdGVzX3NlcGFyYXRvcicgXSApO1xyXG5cdFx0XHRcdHZhciBjaGVja19pbl9kYXRlX3ltZCAgPSBkYXRlc19hcnJbMF07XHJcblx0XHRcdFx0dmFyIGNoZWNrX291dF9kYXRlX3ltZCA9IGRhdGVzX2FyclsxXTtcclxuXHJcblx0XHRcdFx0aWYgKCAoJycgIT09IGNoZWNrX2luX2RhdGVfeW1kKSAmJiAoJycgIT09IGNoZWNrX291dF9kYXRlX3ltZCkgKXtcclxuXHJcblx0XHRcdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9kYXRlc19hcnJheV9mcm9tX3N0YXJ0X2VuZF9kYXlzX2pzKCBjaGVja19pbl9kYXRlX3ltZCwgY2hlY2tfb3V0X2RhdGVfeW1kICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBkYXRlc19hcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogR2V0IGRhdGVzIGFycmF5IGJhc2VkIG9uIHN0YXJ0IGFuZCBlbmQgZGF0ZXMuXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEBwYXJhbSBzdHJpbmcgc1N0YXJ0RGF0ZSAtIHN0YXJ0IGRhdGU6IDIwMjMtMDQtMDlcclxuXHRcdFx0ICogQHBhcmFtIHN0cmluZyBzRW5kRGF0ZSAgIC0gZW5kIGRhdGU6ICAgMjAyMy0wNC0xMVxyXG5cdFx0XHQgKiBAcmV0dXJuIGFycmF5ICAgICAgICAgICAgIC0gWyBcIjIwMjMtMDQtMDlcIiwgXCIyMDIzLTA0LTEwXCIsIFwiMjAyMy0wNC0xMVwiIF1cclxuXHRcdFx0ICovXHJcblx0XHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2RhdGVzX2FycmF5X2Zyb21fc3RhcnRfZW5kX2RheXNfanMoIHNTdGFydERhdGUsIHNFbmREYXRlICl7XHJcblxyXG5cdFx0XHRcdHNTdGFydERhdGUgPSBuZXcgRGF0ZSggc1N0YXJ0RGF0ZSArICdUMDA6MDA6MDAnICk7XHJcblx0XHRcdFx0c0VuZERhdGUgPSBuZXcgRGF0ZSggc0VuZERhdGUgKyAnVDAwOjAwOjAwJyApO1xyXG5cclxuXHRcdFx0XHR2YXIgYURheXM9W107XHJcblxyXG5cdFx0XHRcdC8vIFN0YXJ0IHRoZSB2YXJpYWJsZSBvZmYgd2l0aCB0aGUgc3RhcnQgZGF0ZVxyXG5cdFx0XHRcdGFEYXlzLnB1c2goIHNTdGFydERhdGUuZ2V0VGltZSgpICk7XHJcblxyXG5cdFx0XHRcdC8vIFNldCBhICd0ZW1wJyB2YXJpYWJsZSwgc0N1cnJlbnREYXRlLCB3aXRoIHRoZSBzdGFydCBkYXRlIC0gYmVmb3JlIGJlZ2lubmluZyB0aGUgbG9vcFxyXG5cdFx0XHRcdHZhciBzQ3VycmVudERhdGUgPSBuZXcgRGF0ZSggc1N0YXJ0RGF0ZS5nZXRUaW1lKCkgKTtcclxuXHRcdFx0XHR2YXIgb25lX2RheV9kdXJhdGlvbiA9IDI0KjYwKjYwKjEwMDA7XHJcblxyXG5cdFx0XHRcdC8vIFdoaWxlIHRoZSBjdXJyZW50IGRhdGUgaXMgbGVzcyB0aGFuIHRoZSBlbmQgZGF0ZVxyXG5cdFx0XHRcdHdoaWxlKHNDdXJyZW50RGF0ZSA8IHNFbmREYXRlKXtcclxuXHRcdFx0XHRcdC8vIEFkZCBhIGRheSB0byB0aGUgY3VycmVudCBkYXRlIFwiKzEgZGF5XCJcclxuXHRcdFx0XHRcdHNDdXJyZW50RGF0ZS5zZXRUaW1lKCBzQ3VycmVudERhdGUuZ2V0VGltZSgpICsgb25lX2RheV9kdXJhdGlvbiApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFkZCB0aGlzIG5ldyBkYXkgdG8gdGhlIGFEYXlzIGFycmF5XHJcblx0XHRcdFx0XHRhRGF5cy5wdXNoKCBzQ3VycmVudERhdGUuZ2V0VGltZSgpICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGFEYXlzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRhRGF5c1sgaSBdID0gbmV3IERhdGUoIGFEYXlzW2ldICk7XHJcblx0XHRcdFx0XHRhRGF5c1sgaSBdID0gYURheXNbIGkgXS5nZXRGdWxsWWVhcigpXHJcblx0XHRcdFx0XHRcdFx0XHQrICctJyArICgoIChhRGF5c1sgaSBdLmdldE1vbnRoKCkgKyAxKSA8IDEwKSA/ICcwJyA6ICcnKSArIChhRGF5c1sgaSBdLmdldE1vbnRoKCkgKyAxKVxyXG5cdFx0XHRcdFx0XHRcdFx0KyAnLScgKyAoKCAgICAgICAgYURheXNbIGkgXS5nZXREYXRlKCkgPCAxMCkgPyAnMCcgOiAnJykgKyAgYURheXNbIGkgXS5nZXREYXRlKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIE9uY2UgdGhlIGxvb3AgaGFzIGZpbmlzaGVkLCByZXR1cm4gdGhlIGFycmF5IG9mIGRheXMuXHJcblx0XHRcdFx0cmV0dXJuIGFEYXlzO1xyXG5cdFx0XHR9XHJcblxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogICBUb29sdGlwcyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgc2hvd2luZyB0b29sdGlwLCAgd2hlbiAgbW91c2Ugb3ZlciBvbiAgU0VMRUNUQUJMRSAoYXZhaWxhYmxlLCBwZW5kaW5nLCBhcHByb3ZlZCwgcmVzb3VyY2UgdW5hdmFpbGFibGUpLCAgZGF5c1xyXG5cdCAqIENhbiBiZSBjYWxsZWQgZGlyZWN0bHkgIGZyb20gIGRhdGVwaWNrIGluaXQgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gdmFsdWVcclxuXHQgKiBAcGFyYW0gZGF0ZVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2F2eV9fcHJlcGFyZV90b29sdGlwX19pbl9jYWxlbmRhciggdmFsdWUsIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHRpZiAoIG51bGwgPT0gZGF0ZSApeyAgcmV0dXJuIGZhbHNlOyAgfVxyXG5cclxuXHRcdHZhciB0ZF9jbGFzcyA9ICggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy0nICsgZGF0ZS5nZXREYXRlKCkgKyAnLScgKyBkYXRlLmdldEZ1bGxZZWFyKCk7XHJcblxyXG5cdFx0dmFyIGpDZWxsID0galF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCArICcgdGQuY2FsNGRhdGUtJyArIHRkX2NsYXNzICk7XHJcblxyXG5cdFx0d3BiY19hdnlfX3Nob3dfdG9vbHRpcF9fZm9yX2VsZW1lbnQoIGpDZWxsLCBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncG9wb3Zlcl9oaW50cycgXSApO1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIHRvb2x0aXAgIGZvciBzaG93aW5nIG9uIFVOQVZBSUxBQkxFIGRheXMgKHNlYXNvbiwgd2Vla2RheSwgdG9kYXlfZGVwZW5kcyB1bmF2YWlsYWJsZSlcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBqQ2VsbFx0XHRcdFx0XHRqUXVlcnkgb2Ygc3BlY2lmaWMgZGF5IGNlbGxcclxuXHQgKiBAcGFyYW0gcG9wb3Zlcl9oaW50c1x0XHQgICAgQXJyYXkgd2l0aCB0b29sdGlwIGhpbnQgdGV4dHNcdCA6IHsnc2Vhc29uX3VuYXZhaWxhYmxlJzonLi4uJywnd2Vla2RheXNfdW5hdmFpbGFibGUnOicuLi4nLCdiZWZvcmVfYWZ0ZXJfdW5hdmFpbGFibGUnOicuLi4nLH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2F2eV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCggakNlbGwsIHBvcG92ZXJfaGludHMgKXtcclxuXHJcblx0XHR2YXIgdG9vbHRpcF90aW1lID0gJyc7XHJcblxyXG5cdFx0aWYgKCBqQ2VsbC5oYXNDbGFzcyggJ3NlYXNvbl91bmF2YWlsYWJsZScgKSApe1xyXG5cdFx0XHR0b29sdGlwX3RpbWUgPSBwb3BvdmVyX2hpbnRzWyAnc2Vhc29uX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fSBlbHNlIGlmICggakNlbGwuaGFzQ2xhc3MoICd3ZWVrZGF5c191bmF2YWlsYWJsZScgKSApe1xyXG5cdFx0XHR0b29sdGlwX3RpbWUgPSBwb3BvdmVyX2hpbnRzWyAnd2Vla2RheXNfdW5hdmFpbGFibGUnIF07XHJcblx0XHR9IGVsc2UgaWYgKCBqQ2VsbC5oYXNDbGFzcyggJ2JlZm9yZV9hZnRlcl91bmF2YWlsYWJsZScgKSApe1xyXG5cdFx0XHR0b29sdGlwX3RpbWUgPSBwb3BvdmVyX2hpbnRzWyAnYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fSBlbHNlIGlmICggakNlbGwuaGFzQ2xhc3MoICdkYXRlMmFwcHJvdmUnICkgKXtcclxuXHJcblx0XHR9IGVsc2UgaWYgKCBqQ2VsbC5oYXNDbGFzcyggJ2RhdGVfYXBwcm92ZWQnICkgKXtcclxuXHJcblx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdH1cclxuXHJcblx0XHRqQ2VsbC5hdHRyKCAnZGF0YS1jb250ZW50JywgdG9vbHRpcF90aW1lICk7XHJcblxyXG5cdFx0dmFyIHRkX2VsID0gakNlbGwuZ2V0KDApO1x0Ly9qUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJyB0ZC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3MgKS5nZXQoMCk7XHJcblxyXG5cdFx0aWYgKCAoIHVuZGVmaW5lZCA9PSB0ZF9lbC5fdGlwcHkgKSAmJiAoICcnICE9IHRvb2x0aXBfdGltZSApICl7XHJcblxyXG5cdFx0XHRcdHdwYmNfdGlwcHkoIHRkX2VsICwge1xyXG5cdFx0XHRcdFx0Y29udGVudCggcmVmZXJlbmNlICl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgcG9wb3Zlcl9jb250ZW50ID0gcmVmZXJlbmNlLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29udGVudCcgKTtcclxuXHJcblx0XHRcdFx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cInBvcG92ZXIgcG9wb3Zlcl90aXBweVwiPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0KyAnPGRpdiBjbGFzcz1cInBvcG92ZXItY29udGVudFwiPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQrIHBvcG92ZXJfY29udGVudFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQrICc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0ICsgJzwvZGl2Pic7XHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0YWxsb3dIVE1MICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHR0cmlnZ2VyXHRcdFx0IDogJ21vdXNlZW50ZXIgZm9jdXMnLFxyXG5cdFx0XHRcdFx0aW50ZXJhY3RpdmUgICAgICA6ICEgdHJ1ZSxcclxuXHRcdFx0XHRcdGhpZGVPbkNsaWNrICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0aW50ZXJhY3RpdmVCb3JkZXI6IDEwLFxyXG5cdFx0XHRcdFx0bWF4V2lkdGggICAgICAgICA6IDU1MCxcclxuXHRcdFx0XHRcdHRoZW1lICAgICAgICAgICAgOiAnd3BiYy10aXBweS10aW1lcycsXHJcblx0XHRcdFx0XHRwbGFjZW1lbnQgICAgICAgIDogJ3RvcCcsXHJcblx0XHRcdFx0XHRkZWxheVx0XHRcdCA6IFs0MDAsIDBdLFx0XHRcdC8vIEZpeEluOiA5LjQuMi4yLlxyXG5cdFx0XHRcdFx0aWdub3JlQXR0cmlidXRlcyA6IHRydWUsXHJcblx0XHRcdFx0XHR0b3VjaFx0XHRcdCA6IHRydWUsXHRcdFx0XHQvL1snaG9sZCcsIDUwMF0sIC8vIDUwMG1zIGRlbGF5XHRcdFx0Ly8gRml4SW46IDkuMi4xLjUuXHJcblx0XHRcdFx0XHRhcHBlbmRUbzogKCkgPT4gZG9jdW1lbnQuYm9keSxcclxuXHRcdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqICAgQWpheCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2VuZCBBamF4IHNob3cgcmVxdWVzdFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19hamF4X3JlcXVlc3QoKXtcclxuXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdXUEJDX0FKWF9BVkFJTEFCSUxJVFknICk7IGNvbnNvbGUubG9nKCAnID09IEJlZm9yZSBBamF4IFNlbmQgLSBzZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSA9PSAnICwgd3BiY19hanhfYXZhaWxhYmlsaXR5LnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpICk7XHJcblxyXG5cdHdwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKTtcclxuXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9BVkFJTEFCSUxJVFknLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogd3BiY19hanhfYXZhaWxhYmlsaXR5LmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApLFxyXG5cdFx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogd3BiY19hanhfYXZhaWxhYmlsaXR5LmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X2xvY2FsZSA6IHdwYmNfYWp4X2F2YWlsYWJpbGl0eS5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRcdHNlYXJjaF9wYXJhbXNcdDogd3BiY19hanhfYXZhaWxhYmlsaXR5LnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvKipcclxuXHRcdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjZy5waHBcclxuXHRcdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcblxyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9BVkFJTEFCSUxJVFkgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFJlbG9hZCBwYWdlLCBhZnRlciBmaWx0ZXIgdG9vbGJhciBoYXMgYmVlbiByZXNldFxyXG5cdFx0XHRcdFx0aWYgKCAgICAgICAoICAgICB1bmRlZmluZWQgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXSlcclxuXHRcdFx0XHRcdFx0XHQmJiAoICdyZXNldF9kb25lJyA9PT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsgJ2RvX2FjdGlvbicgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdGxvY2F0aW9uLnJlbG9hZCgpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2hvdyBsaXN0aW5nXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3BhZ2VfY29udGVudF9fc2hvdyggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdLCByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF0gLCByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0Ly93cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2RlZmluZV91aV9ob29rcygpO1x0XHRcdFx0XHRcdC8vIFJlZGVmaW5lIEhvb2tzLCBiZWNhdXNlIHdlIHNob3cgbmV3IERPTSBlbGVtZW50c1xyXG5cdFx0XHRcdFx0aWYgKCAnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICkgKXtcclxuXHRcdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICggJzEnID09IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0JyBdICkgPyAnc3VjY2VzcycgOiAnZXJyb3InXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAxMDAwMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHdwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKTtcclxuXHRcdFx0XHRcdC8vIFJlbW92ZSBzcGluIGljb24gZnJvbSAgYnV0dG9uIGFuZCBFbmFibGUgdGhpcyBidXR0b24uXHJcblx0XHRcdFx0XHR3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oIHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIF0gKVxyXG5cclxuXHRcdFx0XHRcdGpRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblxyXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgKDxiPicgKyBqcVhIUi5zdGF0dXMgKyAnPC9iPiknO1xyXG5cdFx0XHRcdFx0XHRpZiAoNDAzID09IGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyBQcm9iYWJseSBub25jZSBmb3IgdGhpcyBwYWdlIGhhcyBiZWVuIGV4cGlyZWQuIFBsZWFzZSA8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgb25jbGljaz1cImphdmFzY3JpcHQ6bG9jYXRpb24ucmVsb2FkKCk7XCI+cmVsb2FkIHRoZSBwYWdlPC9hPi4nO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgJyArIGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvcl9tZXNzYWdlLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xyXG5cclxuXHRcdFx0XHRcdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICk7XHJcblx0XHRcdCAgfSlcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcblxyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEggbyBvIGsgcyAgLSAgaXRzIEFjdGlvbi9UaW1lcyB3aGVuIG5lZWQgdG8gcmUtUmVuZGVyIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBTZWFyY2ggUmVxdWVzdCBhZnRlciBVcGRhdGluZyBzZWFyY2ggcmVxdWVzdCBwYXJhbWV0ZXJzXHJcbiAqXHJcbiAqIEBwYXJhbSBwYXJhbXNfYXJyXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyAoIHBhcmFtc19hcnIgKXtcclxuXHJcblx0Ly8gRGVmaW5lIGRpZmZlcmVudCBTZWFyY2ggIHBhcmFtZXRlcnMgZm9yIHJlcXVlc3RcclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHQvL2NvbnNvbGUubG9nKCAnUmVxdWVzdCBmb3I6ICcsIHBfa2V5LCBwX3ZhbCApO1xyXG5cdFx0d3BiY19hanhfYXZhaWxhYmlsaXR5LnNlYXJjaF9zZXRfcGFyYW0oIHBfa2V5LCBwX3ZhbCApO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBTZW5kIEFqYXggUmVxdWVzdFxyXG5cdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fYWpheF9yZXF1ZXN0KCk7XHJcbn1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNlYXJjaCByZXF1ZXN0IGZvciBcIlBhZ2UgTnVtYmVyXCJcclxuXHQgKiBAcGFyYW0gcGFnZV9udW1iZXJcdGludFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fcGFnaW5hdGlvbl9jbGljayggcGFnZV9udW1iZXIgKXtcclxuXHJcblx0XHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblxyXG4vKipcclxuICogICBTaG93IC8gSGlkZSBDb250ZW50ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiAgU2hvdyBMaXN0aW5nIENvbnRlbnQgXHQtIFx0U2VuZGluZyBBamF4IFJlcXVlc3RcdC1cdHdpdGggcGFyYW1ldGVycyB0aGF0ICB3ZSBlYXJseSAgZGVmaW5lZFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19hY3R1YWxfY29udGVudF9fc2hvdygpe1xyXG5cclxuXHR3cGJjX2FqeF9hdmFpbGFiaWxpdHlfX2FqYXhfcmVxdWVzdCgpO1x0XHRcdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHQtXHR3aXRoIHBhcmFtZXRlcnMgdGhhdCAgd2UgZWFybHkgIGRlZmluZWQgaW4gXCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcIiBPYmouXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIExpc3RpbmcgQ29udGVudFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYXZhaWxhYmlsaXR5X19hY3R1YWxfY29udGVudF9faGlkZSgpe1xyXG5cclxuXHRqUXVlcnkoICB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgICkuaHRtbCggJycgKTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogICBNIGUgcyBzIGEgZyBlICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTaG93IGp1c3QgbWVzc2FnZSBpbnN0ZWFkIG9mIGNvbnRlbnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fc2hvd19tZXNzYWdlKCBtZXNzYWdlICl7XHJcblxyXG5cdHdwYmNfYWp4X2F2YWlsYWJpbGl0eV9fYWN0dWFsX2NvbnRlbnRfX2hpZGUoKTtcclxuXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9hdmFpbGFiaWxpdHkuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFN1cHBvcnQgRnVuY3Rpb25zIC0gU3BpbiBJY29uIGluIEJ1dHRvbnMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBTdGFydFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJykucmVtb3ZlQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBQYXVzZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdmFpbGFiaWxpdHlfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2F2YWlsYWJpbGl0eV9yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmFkZENsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgaXMgU3Bpbm5pbmcgP1xyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b25fX2lzX3NwaW4oKXtcclxuICAgIGlmICggalF1ZXJ5KCAnI3dwYmNfYXZhaWxhYmlsaXR5X3JlbG9hZF9idXR0b24gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuaGFzQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKSApe1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn1cclxuIl0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUVaO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFKQSxTQUFBQSxRQUFBQyxHQUFBLHNDQUFBRCxPQUFBLHdCQUFBRSxNQUFBLHVCQUFBQSxNQUFBLENBQUFDLFFBQUEsYUFBQUYsR0FBQSxrQkFBQUEsR0FBQSxnQkFBQUEsR0FBQSxXQUFBQSxHQUFBLHlCQUFBQyxNQUFBLElBQUFELEdBQUEsQ0FBQUcsV0FBQSxLQUFBRixNQUFBLElBQUFELEdBQUEsS0FBQUMsTUFBQSxDQUFBRyxTQUFBLHFCQUFBSixHQUFBLEtBQUFELE9BQUEsQ0FBQUMsR0FBQTtBQU1BLElBQUlLLHFCQUFxQixHQUFJLFVBQVdMLEdBQUcsRUFBRU0sQ0FBQyxFQUFFO0VBRS9DO0VBQ0EsSUFBSUMsUUFBUSxHQUFHUCxHQUFHLENBQUNRLFlBQVksR0FBR1IsR0FBRyxDQUFDUSxZQUFZLElBQUk7SUFDeENDLE9BQU8sRUFBRSxDQUFDO0lBQ1ZDLEtBQUssRUFBSSxFQUFFO0lBQ1hDLE1BQU0sRUFBRztF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QVdHLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUc7SUFDckQ7SUFDQXhCLHFCQUFxQixDQUFDaUIsZ0JBQWdCLENBQUVNLEtBQUssRUFBRUQsS0FBTSxDQUFDO0VBQ3ZELENBQUMsQ0FBQzs7RUFFRjtFQUNBcUwsbUNBQW1DLENBQUMsQ0FBQztBQUN0Qzs7QUFHQztBQUNEO0FBQ0E7QUFDQTtBQUNDLFNBQVM0Qix1Q0FBdUNBLENBQUVDLFdBQVcsRUFBRTtFQUU5REYsK0NBQStDLENBQUU7SUFDeEMsVUFBVSxFQUFFRTtFQUNiLENBQUUsQ0FBQztBQUNaOztBQUlEO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsMkNBQTJDQSxDQUFBLEVBQUU7RUFFckQ5QixtQ0FBbUMsQ0FBQyxDQUFDLENBQUMsQ0FBRztBQUMxQzs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTK0IsMkNBQTJDQSxDQUFBLEVBQUU7RUFFckQ3TSxNQUFNLENBQUc3QixxQkFBcUIsQ0FBQzRCLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBRyxDQUFDLENBQUNVLElBQUksQ0FBRSxFQUFHLENBQUM7QUFDcEY7O0FBSUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTb0wsbUNBQW1DQSxDQUFFL0QsT0FBTyxFQUFFO0VBRXREK0UsMkNBQTJDLENBQUMsQ0FBQztFQUU3QzdNLE1BQU0sQ0FBRTdCLHFCQUFxQixDQUFDNEIsZUFBZSxDQUFFLG1CQUFvQixDQUFFLENBQUMsQ0FBQ1UsSUFBSSxDQUNoRSwyRUFBMkUsR0FDMUVxSCxPQUFPLEdBQ1IsUUFDRixDQUFDO0FBQ1g7O0FBSUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTb0QsMkNBQTJDQSxDQUFBLEVBQUU7RUFDckRsTCxNQUFNLENBQUUsdURBQXVELENBQUMsQ0FBQzJCLFdBQVcsQ0FBRSxzQkFBdUIsQ0FBQztBQUN2Rzs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTc0ssMkNBQTJDQSxDQUFBLEVBQUU7RUFDckRqTSxNQUFNLENBQUUsdURBQXdELENBQUMsQ0FBQ3FILFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQztBQUNyRzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU3lGLHdDQUF3Q0EsQ0FBQSxFQUFFO0VBQy9DLElBQUs5TSxNQUFNLENBQUUsdURBQXdELENBQUMsQ0FBQ21ELFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQyxFQUFFO0lBQzdHLE9BQU8sSUFBSTtFQUNaLENBQUMsTUFBTTtJQUNOLE9BQU8sS0FBSztFQUNiO0FBQ0QiLCJpZ25vcmVMaXN0IjpbXX0=
