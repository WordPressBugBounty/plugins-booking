"use strict";

/**
 * Define JavaScript variables for front-end calendar for backward compatibility
 *
 * @param calendar_params_arr example:{
											'html_id'           : 'calendar_booking' + calendar_params_arr.ajx_cleaned_params.resource_id,
											'text_id'           : 'date_booking' + calendar_params_arr.ajx_cleaned_params.resource_id,

											'calendar__booking_start_day_weeek': 	  calendar_params_arr.ajx_cleaned_params.calendar__booking_start_day_weeek,
											'calendar__view__visible_months': calendar_params_arr.ajx_cleaned_params.calendar__view__visible_months,
											'calendar__days_selection_mode':  calendar_params_arr.ajx_cleaned_params.calendar__days_selection_mode,

											'resource_id'        : calendar_params_arr.ajx_cleaned_params.resource_id,
											'ajx_nonce_calendar' : calendar_params_arr.ajx_data_arr.ajx_nonce_calendar,
											'booked_dates'       : calendar_params_arr.ajx_data_arr.booked_dates,
											'season_customize_plugin': calendar_params_arr.ajx_data_arr.season_customize_plugin,

											'resource_unavailable_dates' : calendar_params_arr.ajx_data_arr.resource_unavailable_dates
										}
 */
function wpbc_assign_global_js_for_calendar(calendar_params_arr) {
  //TODO: need to  test it before remove
}

/**
 * 	Load Datepick Inline calendar
 *
 * @param calendar_params_arr		example:{
											'html_id'           : 'calendar_booking' + calendar_params_arr.ajx_cleaned_params.resource_id,
											'text_id'           : 'date_booking' + calendar_params_arr.ajx_cleaned_params.resource_id,

											'calendar__booking_start_day_weeek': 	  calendar_params_arr.ajx_cleaned_params.calendar__booking_start_day_weeek,
											'calendar__view__visible_months': calendar_params_arr.ajx_cleaned_params.calendar__view__visible_months,
											'calendar__days_selection_mode':  calendar_params_arr.ajx_cleaned_params.calendar__days_selection_mode,

											'resource_id'        : calendar_params_arr.ajx_cleaned_params.resource_id,
											'ajx_nonce_calendar' : calendar_params_arr.ajx_data_arr.ajx_nonce_calendar,
											'booked_dates'       : calendar_params_arr.ajx_data_arr.calendar_settings.booked_dates,
											'season_customize_plugin': calendar_params_arr.ajx_data_arr.season_customize_plugin,

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
  //  JavaScript variables for front-end calendar
  //------------------------------------------------------------------------------------------------------------------
  wpbc_assign_global_js_for_calendar(calendar_params_arr);

  //------------------------------------------------------------------------------------------------------------------
  // Configure and show calendar
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#' + calendar_params_arr.html_id).text('');
  jQuery('#' + calendar_params_arr.html_id).datepick({
    beforeShowDay: function beforeShowDay(date) {
      return wpbc__inline_booking_calendar__apply_css_to_days(date, calendar_params_arr, this);
    },
    onSelect: function onSelect(date) {
      jQuery('#' + calendar_params_arr.text_id).val(date);
      //wpbc_blink_element('.wpbc_widget_change_calendar_skin', 3, 220);
      return wpbc__inline_booking_calendar__on_days_select(date, calendar_params_arr, this);
    },
    onHover: function onHover(value, date) {
      //wpbc_cstm__prepare_tooltip__in_calendar( value, date, calendar_params_arr, this );
      return wpbc__inline_booking_calendar__on_days_hover(value, date, calendar_params_arr, this);
    },
    onChangeMonthYear:
    //null,
    function onChangeMonthYear(year, month) {
      return wpbc__inline_booking_calendar__on_change_year_month(year, month, calendar_params_arr, this);
    },
    showOn: 'both',
    numberOfMonths: calendar_params_arr.calendar__view__visible_months,
    stepMonths: 1,
    prevText: '&lsaquo;',
    nextText: '&rsaquo;',
    dateFormat: 'dd.mm.yy',
    // 'yy-mm-dd',
    changeMonth: false,
    changeYear: false,
    minDate: 0,
    //null,  	// Scroll as long as you need
    maxDate: calendar_params_arr.calendar__booking_max_monthes_in_calendar,
    // minDate: new Date(2020, 2, 1), maxDate: new Date(2020, 9, 31), 	// Ability to set any  start and end date in calendar
    showStatus: false,
    closeAtTop: false,
    firstDay: calendar_params_arr.calendar__booking_start_day_weeek,
    gotoCurrent: false,
    hideIfNoPrevNext: true,
    multiSeparator: ', ',
    /*  'multiSelect' can  be 0   for 'single', 'dynamic'
      			  and can  be 365 for 'multiple', 'fixed'
      			  																						// Maximum number of selectable dates:	 Single day = 0,  multi days = 365
     */
    multiSelect: 'single' == calendar_params_arr.calendar__days_selection_mode || 'dynamic' == calendar_params_arr.calendar__days_selection_mode ? 0 : 365,
    /*  'rangeSelect' true  for 'dynamic'
    				  false for 'single', 'multiple', 'fixed'
     */
    rangeSelect: 'dynamic' == calendar_params_arr.calendar__days_selection_mode,
    rangeSeparator: ' - ',
    //	' ~ ',	//' - ',
    // showWeeks: true,
    useThemeRoller: false
  });
  return true;
}

/**
 * When  we scroll  month in calendar  then  trigger specific event
 * @param year
 * @param month
 * @param calendar_params_arr
 * @param datepick_this
 */
function wpbc__inline_booking_calendar__on_change_year_month(year, month, calendar_params_arr, datepick_this) {
  /**
   *   We need to use inst.drawMonth  instead of month variable.
   *   It is because,  each  time,  when we use dynamic arnge selection,  the month here are different
   */

  var inst = jQuery.datepick._getInst(datepick_this);
  jQuery('body').trigger('wpbc__inline_booking_calendar__changed_year_month' // event name
  , [inst.drawYear, inst.drawMonth + 1, calendar_params_arr, datepick_this]);
  // To catch this event: jQuery( 'body' ).on('wpbc__inline_booking_calendar__changed_year_month', function( event, year, month, calendar_params_arr, datepick_this ) { ... } );
}

/**
 * Apply CSS to calendar date cells
 *
 * @param date					-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00 GMT+0200 (Eastern European Standard Time)
 * @param calendar_params_arr	-  Calendar Settings Object:  	{
																  "html_id": "calendar_booking4",
																  "text_id": "date_booking4",
																  "calendar__booking_start_day_weeek": 1,
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
																	'season_customize_plugin':{
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
      return [false, css_date__standard + ' date_user_unavailable' + ' weekdays_unavailable'];
    }
  }

  // BEFORE_AFTER :: Set unavailable days Before / After the Today date
  if (wpbc_dates__days_between(date, today_date) < parseInt(_wpbc.get_other_param('availability__unavailable_from_today')) || parseInt('0' + parseInt(_wpbc.get_other_param('availability__available_from_today'))) > 0 && wpbc_dates__days_between(date, today_date) > parseInt('0' + parseInt(_wpbc.get_other_param('availability__available_from_today')))) {
    return [false, css_date__standard + ' date_user_unavailable' + ' before_after_unavailable'];
  }

  // SEASONS ::  					Booking > Resources > Availability page
  var is_date_available = calendar_params_arr.season_customize_plugin[sql_class_day];
  if (false === is_date_available) {
    //FixIn: 9.5.4.4
    return [false, css_date__standard + ' date_user_unavailable' + ' season_unavailable'];
  }

  // RESOURCE_UNAVAILABLE ::   	Booking > Customize page
  if (wpbc_in_array(calendar_params_arr.resource_unavailable_dates, sql_class_day)) {
    is_date_available = false;
  }
  if (false === is_date_available) {
    //FixIn: 9.5.4.4
    return [false, css_date__standard + ' date_user_unavailable' + ' resource_unavailable'];
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
      return [false, css_date__standard + css_date__additional];
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

//TODO: need to  use wpbc_calendar script,  instead of this one
/**
 * Apply some CSS classes, when we mouse over specific dates in calendar
 * @param value
 * @param date					-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00 GMT+0200 (Eastern European Standard Time)
 * @param calendar_params_arr	-  Calendar Settings Object:  	{
																  "html_id": "calendar_booking4",
																  "text_id": "date_booking4",
																  "calendar__booking_start_day_weeek": 1,
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
																	'season_customize_plugin':{
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
    return;
  }

  // The same functions as in client.css *************************************************************
  //TODO: 2023-06-30 17:22
  if (true) {
    var bk_type = calendar_params_arr.resource_id;
    var is_calendar_booking_unselectable = jQuery('#calendar_booking_unselectable' + bk_type); //FixIn: 8.0.1.2
    var is_booking_form_also = jQuery('#booking_form_div' + bk_type);
    // Set unselectable,  if only Availability Calendar  here (and we do not insert Booking form by mistake).
    if (is_calendar_booking_unselectable.length == 1 && is_booking_form_also.length != 1) {
      jQuery('#calendar_booking' + bk_type + ' .datepick-days-cell-over').removeClass('datepick-days-cell-over'); // clear all highlight days selections
      jQuery('.wpbc_only_calendar #calendar_booking' + bk_type + ' .datepick-days-cell, ' + '.wpbc_only_calendar #calendar_booking' + bk_type + ' .datepick-days-cell a').css('cursor', 'default');
      return false;
    } //FixIn: 8.0.1.2	end

    return true;
  }
  // *************************************************************************************************

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

//TODO: need to  use wpbc_calendar script,  instead of this one

/**
 * On DAYs selection in calendar
 *
 * @param dates_selection		-  string:			 '2023-03-07 ~ 2023-03-07' or '2023-04-10, 2023-04-12, 2023-04-02, 2023-04-04'
 * @param calendar_params_arr	-  Calendar Settings Object:  	{
																  "html_id": "calendar_booking4",
																  "text_id": "date_booking4",
																  "calendar__booking_start_day_weeek": 1,
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
																	'season_customize_plugin':{
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
  // The same functions as in client.css			//TODO: 2023-06-30 17:22
  if (true) {
    var bk_type = calendar_params_arr.resource_id;
    var date = dates_selection;

    // Set unselectable,  if only Availability Calendar  here (and we do not insert Booking form by mistake).
    var is_calendar_booking_unselectable = jQuery('#calendar_booking_unselectable' + bk_type); //FixIn: 8.0.1.2
    var is_booking_form_also = jQuery('#booking_form_div' + bk_type);
    if (is_calendar_booking_unselectable.length > 0 && is_booking_form_also.length <= 0) {
      wpbc_calendar__unselect_all_dates(bk_type);
      jQuery('.wpbc_only_calendar .popover_calendar_hover').remove(); //Hide all opened popovers
      return false;
    } //FixIn: 8.0.1.2 end

    jQuery('#date_booking' + bk_type).val(date);
    jQuery(".booking_form_div").trigger("date_selected", [bk_type, date]);
  } else {
    // Functionality  from  Booking > Availability page

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
  }
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
  if (jQuery('#ui_btn_cstm__set_days_customize_plugin__available').is(':checked')) {
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
      if ('first_time' == jQuery('.wpbc_ajx_customize_plugin_container').attr('wpbc_loaded')) {
        jQuery('.wpbc_ajx_customize_plugin_container').attr('wpbc_loaded', 'done');
        wpbc_blink_element('.wpbc_widget_change_calendar_skin', 3, 220);
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

  //message += ' <div style="margin-left: 1em;">' + ' Click on Apply button to apply customize_plugin.' + '</div>';

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
 * Scroll to  specific "Year & Month" 	in Inline Booking Calendar
 *
 * @param {number} resource_id		1
 * @param {number} year				2023
 * @param {number} month			12			(from 1 to  12)
 *
 * @returns {boolean}			// changed or not
 */
function wpbc__inline_booking_calendar__change_year_month(resource_id, year, month) {
  var inst = jQuery.datepick._getInst(document.getElementById('calendar_booking' + resource_id));
  if (false != inst) {
    year = parseInt(year);
    month = parseInt(month) - 1;
    inst.cursorDate = new Date();
    inst.cursorDate.setFullYear(year, month, 1);
    inst.cursorDate.setMonth(month); // In some cases,  the setFullYear can  set  only Year,  and not the Month and day      //FixIn:6.2.3.5
    inst.cursorDate.setDate(1);
    inst.drawMonth = inst.cursorDate.getMonth();
    inst.drawYear = inst.cursorDate.getFullYear();
    jQuery.datepick._notifyChange(inst);
    jQuery.datepick._adjustInstDate(inst);
    jQuery.datepick._showDate(inst);
    jQuery.datepick._updateDatepick(inst);
    return true;
  }
  return false;
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1jdXN0b21pemUvX291dC9jdXN0b21pemVfX2lubGluZV9jYWxlbmRhci5qcyIsIm5hbWVzIjpbIndwYmNfYXNzaWduX2dsb2JhbF9qc19mb3JfY2FsZW5kYXIiLCJjYWxlbmRhcl9wYXJhbXNfYXJyIiwid3BiY19zaG93X2lubGluZV9ib29raW5nX2NhbGVuZGFyIiwialF1ZXJ5IiwiaHRtbF9pZCIsImxlbmd0aCIsImhhc0NsYXNzIiwidGV4dCIsImRhdGVwaWNrIiwiYmVmb3JlU2hvd0RheSIsImRhdGUiLCJ3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fYXBwbHlfY3NzX3RvX2RheXMiLCJvblNlbGVjdCIsInRleHRfaWQiLCJ2YWwiLCJ3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19zZWxlY3QiLCJvbkhvdmVyIiwidmFsdWUiLCJ3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19ob3ZlciIsIm9uQ2hhbmdlTW9udGhZZWFyIiwieWVhciIsIm1vbnRoIiwid3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2NoYW5nZV95ZWFyX21vbnRoIiwic2hvd09uIiwibnVtYmVyT2ZNb250aHMiLCJjYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHMiLCJzdGVwTW9udGhzIiwicHJldlRleHQiLCJuZXh0VGV4dCIsImRhdGVGb3JtYXQiLCJjaGFuZ2VNb250aCIsImNoYW5nZVllYXIiLCJtaW5EYXRlIiwibWF4RGF0ZSIsImNhbGVuZGFyX19ib29raW5nX21heF9tb250aGVzX2luX2NhbGVuZGFyIiwic2hvd1N0YXR1cyIsImNsb3NlQXRUb3AiLCJmaXJzdERheSIsImNhbGVuZGFyX19ib29raW5nX3N0YXJ0X2RheV93ZWVlayIsImdvdG9DdXJyZW50IiwiaGlkZUlmTm9QcmV2TmV4dCIsIm11bHRpU2VwYXJhdG9yIiwibXVsdGlTZWxlY3QiLCJjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSIsInJhbmdlU2VsZWN0IiwicmFuZ2VTZXBhcmF0b3IiLCJ1c2VUaGVtZVJvbGxlciIsImRhdGVwaWNrX3RoaXMiLCJpbnN0IiwiX2dldEluc3QiLCJ0cmlnZ2VyIiwiZHJhd1llYXIiLCJkcmF3TW9udGgiLCJ0b2RheV9kYXRlIiwiRGF0ZSIsIl93cGJjIiwiZ2V0X290aGVyX3BhcmFtIiwicGFyc2VJbnQiLCJjbGFzc19kYXkiLCJnZXRNb250aCIsImdldERhdGUiLCJnZXRGdWxsWWVhciIsInNxbF9jbGFzc19kYXkiLCJ3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlIiwiY3NzX2RhdGVfX3N0YW5kYXJkIiwiY3NzX2RhdGVfX2FkZGl0aW9uYWwiLCJnZXREYXkiLCJpIiwid3BiY19kYXRlc19fZGF5c19iZXR3ZWVuIiwiaXNfZGF0ZV9hdmFpbGFibGUiLCJzZWFzb25fY3VzdG9taXplX3BsdWdpbiIsIndwYmNfaW5fYXJyYXkiLCJyZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcyIsImJvb2tlZF9kYXRlcyIsImJvb2tpbmdzX2luX2RhdGUiLCJhcHByb3ZlZCIsIk9iamVjdCIsImtleXMiLCJpc19hcHByb3ZlZCIsIl8iLCJlYWNoIiwicF92YWwiLCJwX2tleSIsInBfZGF0YSIsInRzIiwiYm9va2luZ19kYXRlIiwic3Vic3RyaW5nIiwiYmtfdHlwZSIsInJlc291cmNlX2lkIiwiaXNfY2FsZW5kYXJfYm9va2luZ191bnNlbGVjdGFibGUiLCJpc19ib29raW5nX2Zvcm1fYWxzbyIsInJlbW92ZUNsYXNzIiwiY3NzIiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsImRhdGVzIiwidGRfY2xhc3MiLCJ0ZF9vdmVycyIsImlzX2NoZWNrIiwic2VsY2V0ZWRfZmlyc3RfZGF5Iiwic2V0RnVsbFllYXIiLCJhZGRDbGFzcyIsImRhdGVzX3NlbGVjdGlvbiIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsIndwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyIsInJlbW92ZSIsImRhdGVzX2FyciIsImluZGV4T2YiLCJ3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfcmFuZ2VfanMiLCJ3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfY29tbWFfc2VwYXJhdGVkX2pzIiwid3BiY19hdnlfYWZ0ZXJfZGF5c19zZWxlY3Rpb25fX3Nob3dfaGVscF9pbmZvIiwicG9wb3Zlcl9oaW50cyIsInBhcmFtcyIsIm1lc3NhZ2UiLCJjb2xvciIsImlzIiwidG9vbGJhcl90ZXh0X2F2YWlsYWJsZSIsInRvb2xiYXJfdGV4dF91bmF2YWlsYWJsZSIsImZpcnN0X2RhdGUiLCJsYXN0X2RhdGUiLCJmb3JtYXREYXRlIiwiZGF0ZXNfY2xpY2tfbnVtIiwiYXR0ciIsIndwYmNfYmxpbmtfZWxlbWVudCIsInJlcGxhY2UiLCJwdXNoIiwiam9pbiIsImh0bWwiLCJzcGxpdCIsInNvcnQiLCJjaGVja19pbl9kYXRlX3ltZCIsImNoZWNrX291dF9kYXRlX3ltZCIsIndwYmNfZ2V0X2RhdGVzX2FycmF5X2Zyb21fc3RhcnRfZW5kX2RheXNfanMiLCJzU3RhcnREYXRlIiwic0VuZERhdGUiLCJhRGF5cyIsImdldFRpbWUiLCJzQ3VycmVudERhdGUiLCJvbmVfZGF5X2R1cmF0aW9uIiwic2V0VGltZSIsIndwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19jaGFuZ2VfeWVhcl9tb250aCIsImN1cnNvckRhdGUiLCJzZXRNb250aCIsInNldERhdGUiLCJfbm90aWZ5Q2hhbmdlIiwiX2FkanVzdEluc3REYXRlIiwiX3Nob3dEYXRlIiwiX3VwZGF0ZURhdGVwaWNrIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1jdXN0b21pemUvX3NyYy9jdXN0b21pemVfX2lubGluZV9jYWxlbmRhci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBEZWZpbmUgSmF2YVNjcmlwdCB2YXJpYWJsZXMgZm9yIGZyb250LWVuZCBjYWxlbmRhciBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxyXG4gKlxyXG4gKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2FyciBleGFtcGxlOntcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdodG1sX2lkJyAgICAgICAgICAgOiAnY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0ZXh0X2lkJyAgICAgICAgICAgOiAnZGF0ZV9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjYWxlbmRhcl9fYm9va2luZ19zdGFydF9kYXlfd2VlZWsnOiBcdCAgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX2Jvb2tpbmdfc3RhcnRfZGF5X3dlZWVrLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRocyc6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRocyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSc6ICBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnICAgICAgICA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcicgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5hanhfbm9uY2VfY2FsZW5kYXIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2VkX2RhdGVzJyAgICAgICA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLmJvb2tlZF9kYXRlcyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWFzb25fY3VzdG9taXplX3BsdWdpbic6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnNlYXNvbl9jdXN0b21pemVfcGx1Z2luLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlcycgOiBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5yZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYXNzaWduX2dsb2JhbF9qc19mb3JfY2FsZW5kYXIoIGNhbGVuZGFyX3BhcmFtc19hcnIgKXtcclxuLy9UT0RPOiBuZWVkIHRvICB0ZXN0IGl0IGJlZm9yZSByZW1vdmVcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBcdExvYWQgRGF0ZXBpY2sgSW5saW5lIGNhbGVuZGFyXHJcbiAqXHJcbiAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHRcdGV4YW1wbGU6e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2h0bWxfaWQnICAgICAgICAgICA6ICdjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RleHRfaWQnICAgICAgICAgICA6ICdkYXRlX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NhbGVuZGFyX19ib29raW5nX3N0YXJ0X2RheV93ZWVlayc6IFx0ICBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fYm9va2luZ19zdGFydF9kYXlfd2VlZWssXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzJzogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlJzogIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV9pZCcgICAgICAgIDogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X25vbmNlX2NhbGVuZGFyJyA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLmFqeF9ub25jZV9jYWxlbmRhcixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29rZWRfZGF0ZXMnICAgICAgIDogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfZGF0YV9hcnIuY2FsZW5kYXJfc2V0dGluZ3MuYm9va2VkX2RhdGVzLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlYXNvbl9jdXN0b21pemVfcGx1Z2luJzogY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfZGF0YV9hcnIuc2Vhc29uX2N1c3RvbWl6ZV9wbHVnaW4sXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzJyA6IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnJlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2hvd19pbmxpbmVfYm9va2luZ19jYWxlbmRhciggY2FsZW5kYXJfcGFyYW1zX2FyciApe1xyXG5cclxuXHRpZiAoXHJcblx0XHQgICAoIDAgPT09IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkubGVuZ3RoIClcdFx0XHRcdFx0XHRcdC8vIElmIGNhbGVuZGFyIERPTSBlbGVtZW50IG5vdCBleGlzdCB0aGVuIGV4aXN0XHJcblx0XHR8fCAoIHRydWUgPT09IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5odG1sX2lkICkuaGFzQ2xhc3MoICdoYXNEYXRlcGljaycgKSApXHQvLyBJZiB0aGUgY2FsZW5kYXIgd2l0aCB0aGUgc2FtZSBCb29raW5nIHJlc291cmNlIGFscmVhZHkgIGhhcyBiZWVuIGFjdGl2YXRlZCwgdGhlbiBleGlzdC5cclxuXHQpe1xyXG5cdCAgIHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gIEphdmFTY3JpcHQgdmFyaWFibGVzIGZvciBmcm9udC1lbmQgY2FsZW5kYXJcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHdwYmNfYXNzaWduX2dsb2JhbF9qc19mb3JfY2FsZW5kYXIoIGNhbGVuZGFyX3BhcmFtc19hcnIgKTtcclxuXHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ29uZmlndXJlIGFuZCBzaG93IGNhbGVuZGFyXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRqUXVlcnkoICcjJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuaHRtbF9pZCApLnRleHQoICcnICk7XHJcblx0alF1ZXJ5KCAnIycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLmh0bWxfaWQgKS5kYXRlcGljayh7XHJcblx0XHRcdFx0XHRiZWZvcmVTaG93RGF5OiBcdGZ1bmN0aW9uICggZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fYXBwbHlfY3NzX3RvX2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIHRoaXMgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuICAgICAgICAgICAgICAgICAgICBvblNlbGVjdDogXHQgIFx0ZnVuY3Rpb24gKCBkYXRlICl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnRleHRfaWQgKS52YWwoIGRhdGUgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL3dwYmNfYmxpbmtfZWxlbWVudCgnLndwYmNfd2lkZ2V0X2NoYW5nZV9jYWxlbmRhcl9za2luJywgMywgMjIwKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfc2VsZWN0KCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcbiAgICAgICAgICAgICAgICAgICAgb25Ib3ZlcjogXHRcdGZ1bmN0aW9uICggdmFsdWUsIGRhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL3dwYmNfY3N0bV9fcHJlcGFyZV90b29sdGlwX19pbl9jYWxlbmRhciggdmFsdWUsIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIHRoaXMgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfaG92ZXIoIHZhbHVlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2VNb250aFllYXI6XHQvL251bGwsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gKCB5ZWFyLCBtb250aCApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19vbl9jaGFuZ2VfeWVhcl9tb250aCggeWVhciwgbW9udGgsIGNhbGVuZGFyX3BhcmFtc19hcnIsIHRoaXMgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG4gICAgICAgICAgICAgICAgICAgIHNob3dPbjogXHRcdFx0J2JvdGgnLFxyXG4gICAgICAgICAgICAgICAgICAgIG51bWJlck9mTW9udGhzOiBcdGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX3ZpZXdfX3Zpc2libGVfbW9udGhzLFxyXG4gICAgICAgICAgICAgICAgICAgIHN0ZXBNb250aHM6XHRcdFx0MSxcclxuICAgICAgICAgICAgICAgICAgICBwcmV2VGV4dDogXHRcdFx0JyZsc2FxdW87JyxcclxuICAgICAgICAgICAgICAgICAgICBuZXh0VGV4dDogXHRcdFx0JyZyc2FxdW87JyxcclxuICAgICAgICAgICAgICAgICAgICBkYXRlRm9ybWF0OiBcdFx0J2RkLm1tLnl5JyxcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAneXktbW0tZGQnLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZU1vbnRoOiBcdFx0ZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlWWVhcjogXHRcdGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIG1pbkRhdGU6IFx0XHRcdDAsXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vbnVsbCwgIFx0Ly8gU2Nyb2xsIGFzIGxvbmcgYXMgeW91IG5lZWRcclxuXHRcdFx0XHRcdG1heERhdGU6IFx0XHRcdGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX2Jvb2tpbmdfbWF4X21vbnRoZXNfaW5fY2FsZW5kYXIsXHRcdFx0XHRcdC8vIG1pbkRhdGU6IG5ldyBEYXRlKDIwMjAsIDIsIDEpLCBtYXhEYXRlOiBuZXcgRGF0ZSgyMDIwLCA5LCAzMSksIFx0Ly8gQWJpbGl0eSB0byBzZXQgYW55ICBzdGFydCBhbmQgZW5kIGRhdGUgaW4gY2FsZW5kYXJcclxuICAgICAgICAgICAgICAgICAgICBzaG93U3RhdHVzOiBcdFx0ZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgY2xvc2VBdFRvcDogXHRcdGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGZpcnN0RGF5Olx0XHRcdGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX2Jvb2tpbmdfc3RhcnRfZGF5X3dlZWVrLFxyXG4gICAgICAgICAgICAgICAgICAgIGdvdG9DdXJyZW50OiBcdFx0ZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgaGlkZUlmTm9QcmV2TmV4dDpcdHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbXVsdGlTZXBhcmF0b3I6IFx0JywgJyxcclxuXHRcdFx0XHRcdC8qICAnbXVsdGlTZWxlY3QnIGNhbiAgYmUgMCAgIGZvciAnc2luZ2xlJywgJ2R5bmFtaWMnXHJcblx0XHRcdFx0XHQgIFx0XHRcdCAgYW5kIGNhbiAgYmUgMzY1IGZvciAnbXVsdGlwbGUnLCAnZml4ZWQnXHJcblx0XHRcdFx0XHQgIFx0XHRcdCAgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBNYXhpbXVtIG51bWJlciBvZiBzZWxlY3RhYmxlIGRhdGVzOlx0IFNpbmdsZSBkYXkgPSAwLCAgbXVsdGkgZGF5cyA9IDM2NVxyXG5cdFx0XHRcdFx0ICovXHJcblx0XHRcdFx0XHRtdWx0aVNlbGVjdDogIChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQgICAoICdzaW5nbGUnICA9PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR8fCAoICdkeW5hbWljJyA9PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0ICAgPyAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdCAgIDogMzY1XHJcblx0XHRcdFx0XHRcdFx0XHQgICksXHJcblx0XHRcdFx0XHQvKiAgJ3JhbmdlU2VsZWN0JyB0cnVlICBmb3IgJ2R5bmFtaWMnXHJcblx0XHRcdFx0XHRcdFx0XHRcdCAgZmFsc2UgZm9yICdzaW5nbGUnLCAnbXVsdGlwbGUnLCAnZml4ZWQnXHJcblx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdHJhbmdlU2VsZWN0OiAgKCdkeW5hbWljJyA9PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlKSxcclxuXHRcdFx0XHRcdHJhbmdlU2VwYXJhdG9yOiAnIC0gJywgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHQnIH4gJyxcdC8vJyAtICcsXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gc2hvd1dlZWtzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHVzZVRoZW1lUm9sbGVyOlx0XHRmYWxzZVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICk7XHJcblxyXG5cdHJldHVybiAgdHJ1ZTtcclxufVxyXG5cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFdoZW4gIHdlIHNjcm9sbCAgbW9udGggaW4gY2FsZW5kYXIgIHRoZW4gIHRyaWdnZXIgc3BlY2lmaWMgZXZlbnRcclxuXHQgKiBAcGFyYW0geWVhclxyXG5cdCAqIEBwYXJhbSBtb250aFxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fY2hhbmdlX3llYXJfbW9udGgoIHllYXIsIG1vbnRoLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiAgIFdlIG5lZWQgdG8gdXNlIGluc3QuZHJhd01vbnRoICBpbnN0ZWFkIG9mIG1vbnRoIHZhcmlhYmxlLlxyXG5cdFx0ICogICBJdCBpcyBiZWNhdXNlLCAgZWFjaCAgdGltZSwgIHdoZW4gd2UgdXNlIGR5bmFtaWMgYXJuZ2Ugc2VsZWN0aW9uLCAgdGhlIG1vbnRoIGhlcmUgYXJlIGRpZmZlcmVudFxyXG5cdFx0ICovXHJcblxyXG5cdFx0dmFyIGluc3QgPSBqUXVlcnkuZGF0ZXBpY2suX2dldEluc3QoIGRhdGVwaWNrX3RoaXMgKTtcclxuXHJcblx0XHRqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoIFx0ICAnd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2NoYW5nZWRfeWVhcl9tb250aCdcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGV2ZW50IG5hbWVcclxuXHRcdFx0XHRcdFx0XHRcdCBcdCwgW2luc3QuZHJhd1llYXIsIChpbnN0LmRyYXdNb250aCsxKSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpc11cclxuXHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHQvLyBUbyBjYXRjaCB0aGlzIGV2ZW50OiBqUXVlcnkoICdib2R5JyApLm9uKCd3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fY2hhbmdlZF95ZWFyX21vbnRoJywgZnVuY3Rpb24oIGV2ZW50LCB5ZWFyLCBtb250aCwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyApIHsgLi4uIH0gKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IENTUyB0byBjYWxlbmRhciBkYXRlIGNlbGxzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0XHQtICBKYXZhU2NyaXB0IERhdGUgT2JqOiAgXHRcdE1vbiBEZWMgMTEgMjAyMyAwMDowMDowMCBHTVQrMDIwMCAoRWFzdGVybiBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lKVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJodG1sX2lkXCI6IFwiY2FsZW5kYXJfYm9va2luZzRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJ0ZXh0X2lkXCI6IFwiZGF0ZV9ib29raW5nNFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImNhbGVuZGFyX19ib29raW5nX3N0YXJ0X2RheV93ZWVla1wiOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRoc1wiOiAxMixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJyZXNvdXJjZV9pZFwiOiA0LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImFqeF9ub25jZV9jYWxlbmRhclwiOiBcIjxpbnB1dCB0eXBlPVxcXCJoaWRkZW5cXFwiIC4uLiAvPlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcImJvb2tlZF9kYXRlc1wiOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMTItMjgtMjAyMlwiOiBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYm9va2luZ19kYXRlXCI6IFwiMjAyMi0xMi0yOCAwMDowMDowMFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYXBwcm92ZWRcIjogXCIxXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCJib29raW5nX2lkXCI6IFwiMjZcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XSwgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlYXNvbl9jdXN0b21pemVfcGx1Z2luJzp7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTA5XCI6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTEwXCI6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTAxLTExXCI6IHRydWUsIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdC0gdGhpcyBvZiBkYXRlcGljayBPYmpcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIFtib29sZWFuLHN0cmluZ11cdC0gWyB7dHJ1ZSAtYXZhaWxhYmxlIHwgZmFsc2UgLSB1bmF2YWlsYWJsZX0sICdDU1MgY2xhc3NlcyBmb3IgY2FsZW5kYXIgZGF5IGNlbGwnIF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fYXBwbHlfY3NzX3RvX2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHR2YXIgdG9kYXlfZGF0ZSA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDAgXSwgKHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDEgXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMiBdLCAwLCAwLCAwICk7XHJcblxyXG5cdFx0dmFyIGNsYXNzX2RheSAgPSAoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICctJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy0nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1x0XHRcdFx0XHRcdC8vICcxLTktMjAyMydcclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcyMDIzLTAxLTA5J1xyXG5cclxuXHRcdHZhciBjc3NfZGF0ZV9fc3RhbmRhcmQgICA9ICAnY2FsNGRhdGUtJyArIGNsYXNzX2RheTtcclxuXHRcdHZhciBjc3NfZGF0ZV9fYWRkaXRpb25hbCA9ICcgd3BiY193ZWVrZGF5XycgKyBkYXRlLmdldERheSgpICsgJyAnO1xyXG5cclxuXHRcdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHQvLyBXRUVLREFZUyA6OiBTZXQgdW5hdmFpbGFibGUgd2VlayBkYXlzIGZyb20gLSBTZXR0aW5ncyBHZW5lcmFsIHBhZ2UgaW4gXCJBdmFpbGFiaWxpdHlcIiBzZWN0aW9uXHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX3dlZWtfZGF5c191bmF2YWlsYWJsZScgKS5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRpZiAoIGRhdGUuZ2V0RGF5KCkgPT0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X193ZWVrX2RheXNfdW5hdmFpbGFibGUnIClbIGkgXSApIHtcclxuXHRcdFx0XHRyZXR1cm4gWyBmYWxzZSwgY3NzX2RhdGVfX3N0YW5kYXJkICsgJyBkYXRlX3VzZXJfdW5hdmFpbGFibGUnIFx0KyAnIHdlZWtkYXlzX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQkVGT1JFX0FGVEVSIDo6IFNldCB1bmF2YWlsYWJsZSBkYXlzIEJlZm9yZSAvIEFmdGVyIHRoZSBUb2RheSBkYXRlXHJcblx0XHRpZiAoIFx0KCAod3BiY19kYXRlc19fZGF5c19iZXR3ZWVuKCBkYXRlLCB0b2RheV9kYXRlICkpIDwgcGFyc2VJbnQoX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnYXZhaWxhYmlsaXR5X191bmF2YWlsYWJsZV9mcm9tX3RvZGF5JyApKSApXHJcblx0XHRcdCB8fCAoXHJcblxyXG5cdFx0XHRcdCAgICggcGFyc2VJbnQoICcwJyArIHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdhdmFpbGFiaWxpdHlfX2F2YWlsYWJsZV9mcm9tX3RvZGF5JyApICkgKSA+IDAgKVxyXG5cdFx0XHRcdCYmICggd3BiY19kYXRlc19fZGF5c19iZXR3ZWVuKCBkYXRlLCB0b2RheV9kYXRlICkgPiBwYXJzZUludCggJzAnICsgcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2F2YWlsYWJpbGl0eV9fYXZhaWxhYmxlX2Zyb21fdG9kYXknICkgKSApIClcclxuXHRcdFx0XHQpXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gWyBmYWxzZSwgY3NzX2RhdGVfX3N0YW5kYXJkICsgJyBkYXRlX3VzZXJfdW5hdmFpbGFibGUnIFx0XHQrICcgYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFNFQVNPTlMgOjogIFx0XHRcdFx0XHRCb29raW5nID4gUmVzb3VyY2VzID4gQXZhaWxhYmlsaXR5IHBhZ2VcclxuXHRcdHZhciAgICBpc19kYXRlX2F2YWlsYWJsZSA9IGNhbGVuZGFyX3BhcmFtc19hcnIuc2Vhc29uX2N1c3RvbWl6ZV9wbHVnaW5bIHNxbF9jbGFzc19kYXkgXTtcclxuXHRcdGlmICggZmFsc2UgPT09IGlzX2RhdGVfYXZhaWxhYmxlICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDkuNS40LjRcclxuXHRcdFx0cmV0dXJuIFsgZmFsc2UsIGNzc19kYXRlX19zdGFuZGFyZCArICcgZGF0ZV91c2VyX3VuYXZhaWxhYmxlJ1x0XHQrICcgc2Vhc29uX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFJFU09VUkNFX1VOQVZBSUxBQkxFIDo6ICAgXHRCb29raW5nID4gQ3VzdG9taXplIHBhZ2VcclxuXHRcdGlmICggd3BiY19pbl9hcnJheShjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzLCBzcWxfY2xhc3NfZGF5ICkgKXtcclxuXHRcdFx0aXNfZGF0ZV9hdmFpbGFibGUgPSBmYWxzZTtcclxuXHRcdH1cclxuXHRcdGlmICggIGZhbHNlID09PSBpc19kYXRlX2F2YWlsYWJsZSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogOS41LjQuNFxyXG5cdFx0XHRyZXR1cm4gWyBmYWxzZSwgY3NzX2RhdGVfX3N0YW5kYXJkICsgJyBkYXRlX3VzZXJfdW5hdmFpbGFibGUnXHRcdCsgJyByZXNvdXJjZV91bmF2YWlsYWJsZScgXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHJcblxyXG5cdFx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0XHQvLyBJcyBhbnkgYm9va2luZ3MgaW4gdGhpcyBkYXRlID9cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggY2FsZW5kYXJfcGFyYW1zX2Fyci5ib29rZWRfZGF0ZXNbIGNsYXNzX2RheSBdICkgKSB7XHJcblxyXG5cdFx0XHR2YXIgYm9va2luZ3NfaW5fZGF0ZSA9IGNhbGVuZGFyX3BhcmFtc19hcnIuYm9va2VkX2RhdGVzWyBjbGFzc19kYXkgXTtcclxuXHJcblxyXG5cdFx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIGJvb2tpbmdzX2luX2RhdGVbICdzZWNfMCcgXSApICkge1x0XHRcdC8vIFwiRnVsbCBkYXlcIiBib29raW5nICAtPiAoc2Vjb25kcyA9PSAwKVxyXG5cclxuXHRcdFx0XHRjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAoICcwJyA9PT0gYm9va2luZ3NfaW5fZGF0ZVsgJ3NlY18wJyBdLmFwcHJvdmVkICkgPyAnIGRhdGUyYXBwcm92ZSAnIDogJyBkYXRlX2FwcHJvdmVkICc7XHRcdFx0XHQvLyBQZW5kaW5nID0gJzAnIHwgIEFwcHJvdmVkID0gJzEnXHJcblx0XHRcdFx0Y3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gJyBmdWxsX2RheV9ib29raW5nJztcclxuXHJcblx0XHRcdFx0cmV0dXJuIFsgZmFsc2UsIGNzc19kYXRlX19zdGFuZGFyZCArIGNzc19kYXRlX19hZGRpdGlvbmFsIF07XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBPYmplY3Qua2V5cyggYm9va2luZ3NfaW5fZGF0ZSApLmxlbmd0aCA+IDAgKXtcdFx0XHRcdC8vIFwiVGltZSBzbG90c1wiIEJvb2tpbmdzXHJcblxyXG5cdFx0XHRcdHZhciBpc19hcHByb3ZlZCA9IHRydWU7XHJcblxyXG5cdFx0XHRcdF8uZWFjaCggYm9va2luZ3NfaW5fZGF0ZSwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApIHtcclxuXHRcdFx0XHRcdGlmICggIXBhcnNlSW50KCBwX3ZhbC5hcHByb3ZlZCApICl7XHJcblx0XHRcdFx0XHRcdGlzX2FwcHJvdmVkID0gZmFsc2U7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR2YXIgdHMgPSBwX3ZhbC5ib29raW5nX2RhdGUuc3Vic3RyaW5nKCBwX3ZhbC5ib29raW5nX2RhdGUubGVuZ3RoIC0gMSApO1xyXG5cdFx0XHRcdFx0aWYgKCB0cnVlID09PSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdpc19lbmFibGVkX2NoYW5nZV9vdmVyJyApICl7XHJcblx0XHRcdFx0XHRcdGlmICggdHMgPT0gJzEnICkgeyBjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIGNoZWNrX2luX3RpbWUnICsgKChwYXJzZUludChwX3ZhbC5hcHByb3ZlZCkpID8gJyBjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnIDogJyBjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScpOyB9XHJcblx0XHRcdFx0XHRcdGlmICggdHMgPT0gJzInICkgeyBjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIGNoZWNrX291dF90aW1lJyArICgocGFyc2VJbnQocF92YWwuYXBwcm92ZWQpKSA/ICcgY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcgOiAnIGNoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZScpOyB9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgaXNfYXBwcm92ZWQgKXtcclxuXHRcdFx0XHRcdGNzc19kYXRlX19hZGRpdGlvbmFsICs9ICcgZGF0ZTJhcHByb3ZlIHRpbWVzcGFydGx5J1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjc3NfZGF0ZV9fYWRkaXRpb25hbCArPSAnIGRhdGVfYXBwcm92ZWQgdGltZXNwYXJ0bHknXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoICEgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnaXNfZW5hYmxlZF9jaGFuZ2Vfb3ZlcicgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2RhdGVfX2FkZGl0aW9uYWwgKz0gJyB0aW1lc19jbG9jaydcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRyZXR1cm4gWyB0cnVlLCBjc3NfZGF0ZV9fc3RhbmRhcmQgKyBjc3NfZGF0ZV9fYWRkaXRpb25hbCArICcgZGF0ZV9hdmFpbGFibGUnIF07XHJcblx0fVxyXG5cclxuLy9UT0RPOiBuZWVkIHRvICB1c2Ugd3BiY19jYWxlbmRhciBzY3JpcHQsICBpbnN0ZWFkIG9mIHRoaXMgb25lXHJcblx0LyoqXHJcblx0ICogQXBwbHkgc29tZSBDU1MgY2xhc3Nlcywgd2hlbiB3ZSBtb3VzZSBvdmVyIHNwZWNpZmljIGRhdGVzIGluIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHZhbHVlXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0LSAgSmF2YVNjcmlwdCBEYXRlIE9iajogIFx0XHRNb24gRGVjIDExIDIwMjMgMDA6MDA6MDAgR01UKzAyMDAgKEVhc3Rlcm4gRXVyb3BlYW4gU3RhbmRhcmQgVGltZSlcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiaHRtbF9pZFwiOiBcImNhbGVuZGFyX2Jvb2tpbmc0XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwidGV4dF9pZFwiOiBcImRhdGVfYm9va2luZzRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJjYWxlbmRhcl9fYm9va2luZ19zdGFydF9kYXlfd2VlZWtcIjogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJjYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHNcIjogMTIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwicmVzb3VyY2VfaWRcIjogNCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJhanhfbm9uY2VfY2FsZW5kYXJcIjogXCI8aW5wdXQgdHlwZT1cXFwiaGlkZGVuXFxcIiAuLi4gLz5cIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJib29rZWRfZGF0ZXNcIjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjEyLTI4LTIwMjJcIjogW1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImJvb2tpbmdfZGF0ZVwiOiBcIjIwMjItMTItMjggMDA6MDA6MDBcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImFwcHJvdmVkXCI6IFwiMVwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYm9va2luZ19pZFwiOiBcIjI2XCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWFzb25fY3VzdG9taXplX3BsdWdpbic6e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0wOVwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMFwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMVwiOiB0cnVlLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19pbmxpbmVfYm9va2luZ19jYWxlbmRhcl9fb25fZGF5c19ob3ZlciggdmFsdWUsIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHRcdFx0XHRpZiggbnVsbCA9PT0gZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cclxuXHJcblx0XHRcdFx0XHQvLyBUaGUgc2FtZSBmdW5jdGlvbnMgYXMgaW4gY2xpZW50LmNzcyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcblx0XHRcdFx0XHQvL1RPRE86IDIwMjMtMDYtMzAgMTc6MjJcclxuXHRcdFx0XHRcdGlmICggdHJ1ZSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGJrX3R5cGUgPSBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkXHJcblxyXG5cclxuXHJcblx0XHRcdFx0XHRcdHZhciBpc19jYWxlbmRhcl9ib29raW5nX3Vuc2VsZWN0YWJsZSA9IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nX3Vuc2VsZWN0YWJsZScgKyBia190eXBlICk7XHRcdFx0XHQvL0ZpeEluOiA4LjAuMS4yXHJcblx0XHRcdFx0XHRcdHZhciBpc19ib29raW5nX2Zvcm1fYWxzbyA9IGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIGJrX3R5cGUgKTtcclxuXHRcdFx0XHRcdFx0Ly8gU2V0IHVuc2VsZWN0YWJsZSwgIGlmIG9ubHkgQXZhaWxhYmlsaXR5IENhbGVuZGFyICBoZXJlIChhbmQgd2UgZG8gbm90IGluc2VydCBCb29raW5nIGZvcm0gYnkgbWlzdGFrZSkuXHJcblx0XHRcdFx0XHRcdGlmICggKGlzX2NhbGVuZGFyX2Jvb2tpbmdfdW5zZWxlY3RhYmxlLmxlbmd0aCA9PSAxKSAmJiAoaXNfYm9va2luZ19mb3JtX2Fsc28ubGVuZ3RoICE9IDEpICl7XHJcblx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgYmtfdHlwZSArICcgLmRhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApLnJlbW92ZUNsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7ICAgICAgICAvLyBjbGVhciBhbGwgaGlnaGxpZ2h0IGRheXMgc2VsZWN0aW9uc1xyXG5cdFx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX29ubHlfY2FsZW5kYXIgI2NhbGVuZGFyX2Jvb2tpbmcnICsgYmtfdHlwZSArICcgLmRhdGVwaWNrLWRheXMtY2VsbCwgJyArXHJcblx0XHRcdFx0XHRcdFx0XHQnLndwYmNfb25seV9jYWxlbmRhciAjY2FsZW5kYXJfYm9va2luZycgKyBia190eXBlICsgJyAuZGF0ZXBpY2stZGF5cy1jZWxsIGEnICkuY3NzKCAnY3Vyc29yJywgJ2RlZmF1bHQnICk7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogOC4wLjEuMlx0ZW5kXHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdC8vICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuXHJcblxyXG5cclxuXHJcblxyXG5cdFx0aWYgKCBudWxsID09PSBkYXRlICl7XHJcblx0XHRcdGpRdWVyeSggJy5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApOyAgIFx0ICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYXIgYWxsIGhpZ2hsaWdodCBkYXlzIHNlbGVjdGlvbnNcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBpbnN0ID0galF1ZXJ5LmRhdGVwaWNrLl9nZXRJbnN0KCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCApICk7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIDEgPT0gaW5zdC5kYXRlcy5sZW5ndGgpXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gSWYgd2UgaGF2ZSBvbmUgc2VsZWN0ZWQgZGF0ZVxyXG5cdFx0XHQmJiAoJ2R5bmFtaWMnID09PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmNhbGVuZGFyX19kYXlzX3NlbGVjdGlvbl9tb2RlKSBcdFx0XHRcdFx0Ly8gd2hpbGUgaGF2ZSByYW5nZSBkYXlzIHNlbGVjdGlvbiBtb2RlXHJcblx0XHQpe1xyXG5cclxuXHRcdFx0dmFyIHRkX2NsYXNzO1xyXG5cdFx0XHR2YXIgdGRfb3ZlcnMgPSBbXTtcclxuXHRcdFx0dmFyIGlzX2NoZWNrID0gdHJ1ZTtcclxuICAgICAgICAgICAgdmFyIHNlbGNldGVkX2ZpcnN0X2RheSA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgICAgIHNlbGNldGVkX2ZpcnN0X2RheS5zZXRGdWxsWWVhcihpbnN0LmRhdGVzWzBdLmdldEZ1bGxZZWFyKCksKGluc3QuZGF0ZXNbMF0uZ2V0TW9udGgoKSksIChpbnN0LmRhdGVzWzBdLmdldERhdGUoKSApICk7IC8vR2V0IGZpcnN0IERhdGVcclxuXHJcbiAgICAgICAgICAgIHdoaWxlKCAgaXNfY2hlY2sgKXtcclxuXHJcblx0XHRcdFx0dGRfY2xhc3MgPSAoc2VsY2V0ZWRfZmlyc3RfZGF5LmdldE1vbnRoKCkgKyAxKSArICctJyArIHNlbGNldGVkX2ZpcnN0X2RheS5nZXREYXRlKCkgKyAnLScgKyBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RnVsbFllYXIoKTtcclxuXHJcblx0XHRcdFx0dGRfb3ZlcnNbIHRkX292ZXJzLmxlbmd0aCBdID0gJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKyAnIC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3M7ICAgICAgICAgICAgICAvLyBhZGQgdG8gYXJyYXkgZm9yIGxhdGVyIG1ha2Ugc2VsZWN0aW9uIGJ5IGNsYXNzXHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG5cdFx0XHRcdFx0KCAgKCBkYXRlLmdldE1vbnRoKCkgPT0gc2VsY2V0ZWRfZmlyc3RfZGF5LmdldE1vbnRoKCkgKSAgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAoIGRhdGUuZ2V0RGF0ZSgpID09IHNlbGNldGVkX2ZpcnN0X2RheS5nZXREYXRlKCkgKSAgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAoIGRhdGUuZ2V0RnVsbFllYXIoKSA9PSBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RnVsbFllYXIoKSApXHJcblx0XHRcdFx0XHQpIHx8ICggc2VsY2V0ZWRfZmlyc3RfZGF5ID4gZGF0ZSApXHJcblx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdGlzX2NoZWNrID0gIGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0c2VsY2V0ZWRfZmlyc3RfZGF5LnNldEZ1bGxZZWFyKCBzZWxjZXRlZF9maXJzdF9kYXkuZ2V0RnVsbFllYXIoKSwgKHNlbGNldGVkX2ZpcnN0X2RheS5nZXRNb250aCgpKSwgKHNlbGNldGVkX2ZpcnN0X2RheS5nZXREYXRlKCkgKyAxKSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBIaWdobGlnaHQgRGF5c1xyXG5cdFx0XHRmb3IgKCB2YXIgaT0wOyBpIDwgdGRfb3ZlcnMubGVuZ3RoIDsgaSsrKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCBjbGFzcyB0byBhbGwgZWxlbWVudHNcclxuXHRcdFx0XHRqUXVlcnkoIHRkX292ZXJzW2ldICkuYWRkQ2xhc3MoJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblxyXG5cdFx0fVxyXG5cclxuXHQgICAgcmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuLy9UT0RPOiBuZWVkIHRvICB1c2Ugd3BiY19jYWxlbmRhciBzY3JpcHQsICBpbnN0ZWFkIG9mIHRoaXMgb25lXHJcblxyXG5cdC8qKlxyXG5cdCAqIE9uIERBWXMgc2VsZWN0aW9uIGluIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZXNfc2VsZWN0aW9uXHRcdC0gIHN0cmluZzpcdFx0XHQgJzIwMjMtMDMtMDcgfiAyMDIzLTAzLTA3JyBvciAnMjAyMy0wNC0xMCwgMjAyMy0wNC0xMiwgMjAyMy0wNC0wMiwgMjAyMy0wNC0wNCdcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwiaHRtbF9pZFwiOiBcImNhbGVuZGFyX2Jvb2tpbmc0XCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwidGV4dF9pZFwiOiBcImRhdGVfYm9va2luZzRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJjYWxlbmRhcl9fYm9va2luZ19zdGFydF9kYXlfd2VlZWtcIjogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJjYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHNcIjogMTIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFwicmVzb3VyY2VfaWRcIjogNCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJhanhfbm9uY2VfY2FsZW5kYXJcIjogXCI8aW5wdXQgdHlwZT1cXFwiaGlkZGVuXFxcIiAuLi4gLz5cIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXCJib29rZWRfZGF0ZXNcIjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjEyLTI4LTIwMjJcIjogW1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImJvb2tpbmdfZGF0ZVwiOiBcIjIwMjItMTItMjggMDA6MDA6MDBcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcImFwcHJvdmVkXCI6IFwiMVwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiYm9va2luZ19pZFwiOiBcIjI2XCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF0sIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWFzb25fY3VzdG9taXplX3BsdWdpbic6e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0wOVwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMFwiOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wMS0xMVwiOiB0cnVlLCAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyBib29sZWFuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX29uX2RheXNfc2VsZWN0KCBkYXRlc19zZWxlY3Rpb24sIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgPSBudWxsICl7XHJcblxyXG5cclxuXHRcdC8vIFRoZSBzYW1lIGZ1bmN0aW9ucyBhcyBpbiBjbGllbnQuY3NzXHRcdFx0Ly9UT0RPOiAyMDIzLTA2LTMwIDE3OjIyXHJcblx0XHRpZiAoIHRydWUgKXtcclxuXHJcblx0XHRcdHZhciBia190eXBlID0gY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZFxyXG5cdFx0XHR2YXIgZGF0ZSA9IGRhdGVzX3NlbGVjdGlvbjtcclxuXHJcblx0XHRcdC8vIFNldCB1bnNlbGVjdGFibGUsICBpZiBvbmx5IEF2YWlsYWJpbGl0eSBDYWxlbmRhciAgaGVyZSAoYW5kIHdlIGRvIG5vdCBpbnNlcnQgQm9va2luZyBmb3JtIGJ5IG1pc3Rha2UpLlxyXG5cdFx0XHR2YXIgaXNfY2FsZW5kYXJfYm9va2luZ191bnNlbGVjdGFibGUgPSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZ191bnNlbGVjdGFibGUnICsgYmtfdHlwZSApO1x0XHRcdFx0Ly9GaXhJbjogOC4wLjEuMlxyXG5cdFx0XHR2YXIgaXNfYm9va2luZ19mb3JtX2Fsc28gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyBia190eXBlICk7XHJcblxyXG5cdFx0XHRpZiAoIChpc19jYWxlbmRhcl9ib29raW5nX3Vuc2VsZWN0YWJsZS5sZW5ndGggPiAwKSAmJiAoaXNfYm9va2luZ19mb3JtX2Fsc28ubGVuZ3RoIDw9IDApICl7XHJcblxyXG5cdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggYmtfdHlwZSApO1xyXG5cdFx0XHRcdGpRdWVyeSggJy53cGJjX29ubHlfY2FsZW5kYXIgLnBvcG92ZXJfY2FsZW5kYXJfaG92ZXInICkucmVtb3ZlKCk7ICAgICAgICAgICAgICAgICAgICAgIFx0XHRcdFx0XHQvL0hpZGUgYWxsIG9wZW5lZCBwb3BvdmVyc1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDguMC4xLjIgZW5kXHJcblxyXG5cdFx0XHRqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIGJrX3R5cGUgKS52YWwoIGRhdGUgKTtcclxuXHJcblxyXG5cclxuXHJcblx0XHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkudHJpZ2dlciggXCJkYXRlX3NlbGVjdGVkXCIsIFtia190eXBlLCBkYXRlXSApO1xyXG5cclxuXHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHQvLyBGdW5jdGlvbmFsaXR5ICBmcm9tICBCb29raW5nID4gQXZhaWxhYmlsaXR5IHBhZ2VcclxuXHJcblx0XHRcdHZhciBpbnN0ID0galF1ZXJ5LmRhdGVwaWNrLl9nZXRJbnN0KCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5yZXNvdXJjZV9pZCApICk7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyID0gW107XHQvLyAgWyBcIjIwMjMtMDQtMDlcIiwgXCIyMDIzLTA0LTEwXCIsIFwiMjAyMy0wNC0xMVwiIF1cclxuXHJcblx0XHRcdGlmICggLTEgIT09IGRhdGVzX3NlbGVjdGlvbi5pbmRleE9mKCAnficgKSApIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmFuZ2UgRGF5c1xyXG5cclxuXHRcdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfcmFuZ2VfanMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RhdGVzX3NlcGFyYXRvcicgOiAnIH4gJywgICAgICAgICAgICAgICAgICAgICAgICAgLy8gICcgfiAnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlcycgICAgICAgICAgIDogZGF0ZXNfc2VsZWN0aW9uLCAgICBcdFx0ICAgLy8gJzIwMjMtMDQtMDQgfiAyMDIzLTA0LTA3J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0fSBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE11bHRpcGxlIERheXNcclxuXHRcdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9kYXRlc19hcnJfX2Zyb21fZGF0ZXNfY29tbWFfc2VwYXJhdGVkX2pzKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlc19zZXBhcmF0b3InIDogJywgJywgICAgICAgICAgICAgICAgICAgICAgICAgXHQvLyAgJywgJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGF0ZXMnICAgICAgICAgICA6IGRhdGVzX3NlbGVjdGlvbiwgICAgXHRcdFx0Ly8gJzIwMjMtMDQtMTAsIDIwMjMtMDQtMTIsIDIwMjMtMDQtMDIsIDIwMjMtMDQtMDQnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdwYmNfYXZ5X2FmdGVyX2RheXNfc2VsZWN0aW9uX19zaG93X2hlbHBfaW5mbyh7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSc6IGNhbGVuZGFyX3BhcmFtc19hcnIuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkYXRlc19hcnInICAgICAgICAgICAgICAgICAgICA6IGRhdGVzX2FycixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RhdGVzX2NsaWNrX251bScgICAgICAgICAgICAgIDogaW5zdC5kYXRlcy5sZW5ndGgsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwb3BvdmVyX2hpbnRzJ1x0XHRcdFx0XHQ6IGNhbGVuZGFyX3BhcmFtc19hcnIucG9wb3Zlcl9oaW50c1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cclxuXHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2hvdyBoZWxwIGluZm8gYXQgdGhlIHRvcCAgdG9vbGJhciBhYm91dCBzZWxlY3RlZCBkYXRlcyBhbmQgZnV0dXJlIGFjdGlvbnNcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcGFyYW1zXHJcblx0XHQgKiBcdFx0XHRcdFx0RXhhbXBsZSAxOiAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGU6IFwiZHluYW1pY1wiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfYXJyOiAgWyBcIjIwMjMtMDQtMDNcIiBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfY2xpY2tfbnVtOiAxXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncG9wb3Zlcl9oaW50cydcdFx0XHRcdFx0OiBjYWxlbmRhcl9wYXJhbXNfYXJyLnBvcG92ZXJfaGludHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHQgKiBcdFx0XHRcdFx0RXhhbXBsZSAyOiAge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGU6IFwiZHluYW1pY1wiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19hcnI6IEFycmF5KDEwKSBbIFwiMjAyMy0wNC0wM1wiLCBcIjIwMjMtMDQtMDRcIiwgXCIyMDIzLTA0LTA1XCIsIOKApiBdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19jbGlja19udW06IDJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwb3BvdmVyX2hpbnRzJ1x0XHRcdFx0XHQ6IGNhbGVuZGFyX3BhcmFtc19hcnIucG9wb3Zlcl9oaW50c1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19hdnlfYWZ0ZXJfZGF5c19zZWxlY3Rpb25fX3Nob3dfaGVscF9pbmZvKCBwYXJhbXMgKXtcclxuLy8gY29uc29sZS5sb2coIHBhcmFtcyApO1x0Ly9cdFx0WyBcIjIwMjMtMDQtMDlcIiwgXCIyMDIzLTA0LTEwXCIsIFwiMjAyMy0wNC0xMVwiIF1cclxuXHJcblx0XHRcdHZhciBtZXNzYWdlLCBjb2xvcjtcclxuXHRcdFx0aWYgKGpRdWVyeSggJyN1aV9idG5fY3N0bV9fc2V0X2RheXNfY3VzdG9taXplX3BsdWdpbl9fYXZhaWxhYmxlJykuaXMoJzpjaGVja2VkJykpe1xyXG5cdFx0XHRcdCBtZXNzYWdlID0gcGFyYW1zLnBvcG92ZXJfaGludHMudG9vbGJhcl90ZXh0X2F2YWlsYWJsZTsvLydTZXQgZGF0ZXMgX0RBVEVTXyBhcyBfSFRNTF8gYXZhaWxhYmxlLic7XHJcblx0XHRcdFx0IGNvbG9yID0gJyMxMWJlNGMnO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG1lc3NhZ2UgPSBwYXJhbXMucG9wb3Zlcl9oaW50cy50b29sYmFyX3RleHRfdW5hdmFpbGFibGU7Ly8nU2V0IGRhdGVzIF9EQVRFU18gYXMgX0hUTUxfIHVuYXZhaWxhYmxlLic7XHJcblx0XHRcdFx0Y29sb3IgPSAnI2U0MzkzOSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG1lc3NhZ2UgPSAnPHNwYW4+JyArIG1lc3NhZ2UgKyAnPC9zcGFuPic7XHJcblxyXG5cdFx0XHR2YXIgZmlyc3RfZGF0ZSA9IHBhcmFtc1sgJ2RhdGVzX2FycicgXVsgMCBdO1xyXG5cdFx0XHR2YXIgbGFzdF9kYXRlICA9ICggJ2R5bmFtaWMnID09IHBhcmFtcy5jYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZSApXHJcblx0XHRcdFx0XHRcdFx0PyBwYXJhbXNbICdkYXRlc19hcnInIF1bIChwYXJhbXNbICdkYXRlc19hcnInIF0ubGVuZ3RoIC0gMSkgXVxyXG5cdFx0XHRcdFx0XHRcdDogKCBwYXJhbXNbICdkYXRlc19hcnInIF0ubGVuZ3RoID4gMSApID8gcGFyYW1zWyAnZGF0ZXNfYXJyJyBdWyAxIF0gOiAnJztcclxuXHJcblx0XHRcdGZpcnN0X2RhdGUgPSBqUXVlcnkuZGF0ZXBpY2suZm9ybWF0RGF0ZSggJ2RkIE0sIHl5JywgbmV3IERhdGUoIGZpcnN0X2RhdGUgKyAnVDAwOjAwOjAwJyApICk7XHJcblx0XHRcdGxhc3RfZGF0ZSA9IGpRdWVyeS5kYXRlcGljay5mb3JtYXREYXRlKCAnZGQgTSwgeXknLCAgbmV3IERhdGUoIGxhc3RfZGF0ZSArICdUMDA6MDA6MDAnICkgKTtcclxuXHJcblxyXG5cdFx0XHRpZiAoICdkeW5hbWljJyA9PSBwYXJhbXMuY2FsZW5kYXJfX2RheXNfc2VsZWN0aW9uX21vZGUgKXtcclxuXHRcdFx0XHRpZiAoIDEgPT0gcGFyYW1zLmRhdGVzX2NsaWNrX251bSApe1xyXG5cdFx0XHRcdFx0bGFzdF9kYXRlID0gJ19fX19fX19fX19fJ1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpZiAoICdmaXJzdF90aW1lJyA9PSBqUXVlcnkoICcud3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9jb250YWluZXInICkuYXR0ciggJ3dwYmNfbG9hZGVkJyApICl7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX2NvbnRhaW5lcicgKS5hdHRyKCAnd3BiY19sb2FkZWQnLCAnZG9uZScgKVxyXG5cdFx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY193aWRnZXRfY2hhbmdlX2NhbGVuZGFyX3NraW4nLCAzLCAyMjAgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0bWVzc2FnZSA9IG1lc3NhZ2UucmVwbGFjZSggJ19EQVRFU18nLCAgICAnPC9zcGFuPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vKyAnPGRpdj4nICsgJ2Zyb20nICsgJzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuIGNsYXNzPVwid3BiY19iaWdfZGF0ZVwiPicgKyBmaXJzdF9kYXRlICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3Bhbj4nICsgJy0nICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfYmlnX2RhdGVcIj4nICsgbGFzdF9kYXRlICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3Bhbj4nICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Ly8gaWYgKCBwYXJhbXNbICdkYXRlc19hcnInIF0ubGVuZ3RoID4gMSApe1xyXG5cdFx0XHRcdC8vIFx0bGFzdF9kYXRlID0gJywgJyArIGxhc3RfZGF0ZTtcclxuXHRcdFx0XHQvLyBcdGxhc3RfZGF0ZSArPSAoIHBhcmFtc1sgJ2RhdGVzX2FycicgXS5sZW5ndGggPiAyICkgPyAnLCAuLi4nIDogJyc7XHJcblx0XHRcdFx0Ly8gfSBlbHNlIHtcclxuXHRcdFx0XHQvLyBcdGxhc3RfZGF0ZT0nJztcclxuXHRcdFx0XHQvLyB9XHJcblx0XHRcdFx0dmFyIGRhdGVzX2FyciA9IFtdO1xyXG5cdFx0XHRcdGZvciggdmFyIGkgPSAwOyBpIDwgcGFyYW1zWyAnZGF0ZXNfYXJyJyBdLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdFx0XHRkYXRlc19hcnIucHVzaCggIGpRdWVyeS5kYXRlcGljay5mb3JtYXREYXRlKCAnZGQgTSB5eScsICBuZXcgRGF0ZSggcGFyYW1zWyAnZGF0ZXNfYXJyJyBdWyBpIF0gKyAnVDAwOjAwOjAwJyApICkgICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGZpcnN0X2RhdGUgPSBkYXRlc19hcnIuam9pbiggJywgJyApO1xyXG5cdFx0XHRcdG1lc3NhZ2UgPSBtZXNzYWdlLnJlcGxhY2UoICdfREFURVNfJywgICAgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfYmlnX2RhdGVcIj4nICsgZmlyc3RfZGF0ZSArICc8L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnPHNwYW4+JyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdG1lc3NhZ2UgPSBtZXNzYWdlLnJlcGxhY2UoICdfSFRNTF8nICwgJzwvc3Bhbj48c3BhbiBjbGFzcz1cIndwYmNfYmlnX3RleHRcIiBzdHlsZT1cImNvbG9yOicrY29sb3IrJztcIj4nKSArICc8c3Bhbj4nO1xyXG5cclxuXHRcdFx0Ly9tZXNzYWdlICs9ICcgPGRpdiBzdHlsZT1cIm1hcmdpbi1sZWZ0OiAxZW07XCI+JyArICcgQ2xpY2sgb24gQXBwbHkgYnV0dG9uIHRvIGFwcGx5IGN1c3RvbWl6ZV9wbHVnaW4uJyArICc8L2Rpdj4nO1xyXG5cclxuXHRcdFx0bWVzc2FnZSA9ICc8ZGl2IGNsYXNzPVwid3BiY190b29sYmFyX2RhdGVzX2hpbnRzXCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JztcclxuXHJcblx0XHRcdGpRdWVyeSggJy53cGJjX2hlbHBfdGV4dCcgKS5odG1sKFx0bWVzc2FnZSApO1xyXG5cdFx0fVxyXG5cclxuXHQvKipcclxuXHQgKiAgIFBhcnNlIGRhdGVzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgZGF0ZXMgYXJyYXksICBmcm9tIGNvbW1hIHNlcGFyYXRlZCBkYXRlc1xyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBwYXJhbXMgICAgICAgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqICdkYXRlc19zZXBhcmF0b3InID0+ICcsICcsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERhdGVzIHNlcGFyYXRvclxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiAnZGF0ZXMnICAgICAgICAgICA9PiAnMjAyMy0wNC0wNCwgMjAyMy0wNC0wNywgMjAyMy0wNC0wNScgICAgICAgICAvLyBEYXRlcyBpbiAnWS1tLWQnIGZvcm1hdDogJzIwMjMtMDEtMzEnXHJcblx0XHRcdFx0XHRcdFx0XHQgfVxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gYXJyYXkgICAgICA9IFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzBdID0+IDIwMjMtMDQtMDRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzFdID0+IDIwMjMtMDQtMDVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzJdID0+IDIwMjMtMDQtMDZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogWzNdID0+IDIwMjMtMDQtMDdcclxuXHRcdFx0XHRcdFx0XHRcdF1cclxuXHRcdCAqXHJcblx0XHQgKiBFeGFtcGxlICMxOiAgd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX2NvbW1hX3NlcGFyYXRlZF9qcyggIHsgICdkYXRlc19zZXBhcmF0b3InIDogJywgJywgJ2RhdGVzJyA6ICcyMDIzLTA0LTA0LCAyMDIzLTA0LTA3LCAyMDIzLTA0LTA1JyAgfSAgKTtcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX2NvbW1hX3NlcGFyYXRlZF9qcyggcGFyYW1zICl7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyID0gW107XHJcblxyXG5cdFx0XHRpZiAoICcnICE9PSBwYXJhbXNbICdkYXRlcycgXSApe1xyXG5cclxuXHRcdFx0XHRkYXRlc19hcnIgPSBwYXJhbXNbICdkYXRlcycgXS5zcGxpdCggcGFyYW1zWyAnZGF0ZXNfc2VwYXJhdG9yJyBdICk7XHJcblxyXG5cdFx0XHRcdGRhdGVzX2Fyci5zb3J0KCk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGRhdGVzX2FycjtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBkYXRlcyBhcnJheSwgIGZyb20gcmFuZ2UgZGF5cyBzZWxlY3Rpb25cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcGFyYW1zICAgICAgID0gIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCogJ2RhdGVzX3NlcGFyYXRvcicgPT4gJyB+ICcsICAgICAgICAgICAgICAgICAgICAgICAgIC8vIERhdGVzIHNlcGFyYXRvclxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KiAnZGF0ZXMnICAgICAgICAgICA9PiAnMjAyMy0wNC0wNCB+IDIwMjMtMDQtMDcnICAgICAgLy8gRGF0ZXMgaW4gJ1ktbS1kJyBmb3JtYXQ6ICcyMDIzLTAxLTMxJ1xyXG5cdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiBhcnJheSAgICAgICAgPSBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFswXSA9PiAyMDIzLTA0LTA0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFsxXSA9PiAyMDIzLTA0LTA1XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFsyXSA9PiAyMDIzLTA0LTA2XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQqIFszXSA9PiAyMDIzLTA0LTA3XHJcblx0XHRcdFx0XHRcdFx0XHQgIF1cclxuXHRcdCAqXHJcblx0XHQgKiBFeGFtcGxlICMxOiAgd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX3JhbmdlX2pzKCAgeyAgJ2RhdGVzX3NlcGFyYXRvcicgOiAnIH4gJywgJ2RhdGVzJyA6ICcyMDIzLTA0LTA0IH4gMjAyMy0wNC0wNycgIH0gICk7XHJcblx0XHQgKiBFeGFtcGxlICMyOiAgd3BiY19nZXRfZGF0ZXNfYXJyX19mcm9tX2RhdGVzX3JhbmdlX2pzKCAgeyAgJ2RhdGVzX3NlcGFyYXRvcicgOiAnIC0gJywgJ2RhdGVzJyA6ICcyMDIzLTA0LTA0IC0gMjAyMy0wNC0wNycgIH0gICk7XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2RhdGVzX2Fycl9fZnJvbV9kYXRlc19yYW5nZV9qcyggcGFyYW1zICl7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyID0gW107XHJcblxyXG5cdFx0XHRpZiAoICcnICE9PSBwYXJhbXNbJ2RhdGVzJ10gKSB7XHJcblxyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHBhcmFtc1sgJ2RhdGVzJyBdLnNwbGl0KCBwYXJhbXNbICdkYXRlc19zZXBhcmF0b3InIF0gKTtcclxuXHRcdFx0XHR2YXIgY2hlY2tfaW5fZGF0ZV95bWQgID0gZGF0ZXNfYXJyWzBdO1xyXG5cdFx0XHRcdHZhciBjaGVja19vdXRfZGF0ZV95bWQgPSBkYXRlc19hcnJbMV07XHJcblxyXG5cdFx0XHRcdGlmICggKCcnICE9PSBjaGVja19pbl9kYXRlX3ltZCkgJiYgKCcnICE9PSBjaGVja19vdXRfZGF0ZV95bWQpICl7XHJcblxyXG5cdFx0XHRcdFx0ZGF0ZXNfYXJyID0gd3BiY19nZXRfZGF0ZXNfYXJyYXlfZnJvbV9zdGFydF9lbmRfZGF5c19qcyggY2hlY2tfaW5fZGF0ZV95bWQsIGNoZWNrX291dF9kYXRlX3ltZCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZGF0ZXNfYXJyO1xyXG5cdFx0fVxyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIEdldCBkYXRlcyBhcnJheSBiYXNlZCBvbiBzdGFydCBhbmQgZW5kIGRhdGVzLlxyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKiBAcGFyYW0gc3RyaW5nIHNTdGFydERhdGUgLSBzdGFydCBkYXRlOiAyMDIzLTA0LTA5XHJcblx0XHRcdCAqIEBwYXJhbSBzdHJpbmcgc0VuZERhdGUgICAtIGVuZCBkYXRlOiAgIDIwMjMtMDQtMTFcclxuXHRcdFx0ICogQHJldHVybiBhcnJheSAgICAgICAgICAgICAtIFsgXCIyMDIzLTA0LTA5XCIsIFwiMjAyMy0wNC0xMFwiLCBcIjIwMjMtMDQtMTFcIiBdXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRmdW5jdGlvbiB3cGJjX2dldF9kYXRlc19hcnJheV9mcm9tX3N0YXJ0X2VuZF9kYXlzX2pzKCBzU3RhcnREYXRlLCBzRW5kRGF0ZSApe1xyXG5cclxuXHRcdFx0XHRzU3RhcnREYXRlID0gbmV3IERhdGUoIHNTdGFydERhdGUgKyAnVDAwOjAwOjAwJyApO1xyXG5cdFx0XHRcdHNFbmREYXRlID0gbmV3IERhdGUoIHNFbmREYXRlICsgJ1QwMDowMDowMCcgKTtcclxuXHJcblx0XHRcdFx0dmFyIGFEYXlzPVtdO1xyXG5cclxuXHRcdFx0XHQvLyBTdGFydCB0aGUgdmFyaWFibGUgb2ZmIHdpdGggdGhlIHN0YXJ0IGRhdGVcclxuXHRcdFx0XHRhRGF5cy5wdXNoKCBzU3RhcnREYXRlLmdldFRpbWUoKSApO1xyXG5cclxuXHRcdFx0XHQvLyBTZXQgYSAndGVtcCcgdmFyaWFibGUsIHNDdXJyZW50RGF0ZSwgd2l0aCB0aGUgc3RhcnQgZGF0ZSAtIGJlZm9yZSBiZWdpbm5pbmcgdGhlIGxvb3BcclxuXHRcdFx0XHR2YXIgc0N1cnJlbnREYXRlID0gbmV3IERhdGUoIHNTdGFydERhdGUuZ2V0VGltZSgpICk7XHJcblx0XHRcdFx0dmFyIG9uZV9kYXlfZHVyYXRpb24gPSAyNCo2MCo2MCoxMDAwO1xyXG5cclxuXHRcdFx0XHQvLyBXaGlsZSB0aGUgY3VycmVudCBkYXRlIGlzIGxlc3MgdGhhbiB0aGUgZW5kIGRhdGVcclxuXHRcdFx0XHR3aGlsZShzQ3VycmVudERhdGUgPCBzRW5kRGF0ZSl7XHJcblx0XHRcdFx0XHQvLyBBZGQgYSBkYXkgdG8gdGhlIGN1cnJlbnQgZGF0ZSBcIisxIGRheVwiXHJcblx0XHRcdFx0XHRzQ3VycmVudERhdGUuc2V0VGltZSggc0N1cnJlbnREYXRlLmdldFRpbWUoKSArIG9uZV9kYXlfZHVyYXRpb24gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBBZGQgdGhpcyBuZXcgZGF5IHRvIHRoZSBhRGF5cyBhcnJheVxyXG5cdFx0XHRcdFx0YURheXMucHVzaCggc0N1cnJlbnREYXRlLmdldFRpbWUoKSApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhRGF5cy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0YURheXNbIGkgXSA9IG5ldyBEYXRlKCBhRGF5c1tpXSApO1xyXG5cdFx0XHRcdFx0YURheXNbIGkgXSA9IGFEYXlzWyBpIF0uZ2V0RnVsbFllYXIoKVxyXG5cdFx0XHRcdFx0XHRcdFx0KyAnLScgKyAoKCAoYURheXNbIGkgXS5nZXRNb250aCgpICsgMSkgPCAxMCkgPyAnMCcgOiAnJykgKyAoYURheXNbIGkgXS5nZXRNb250aCgpICsgMSlcclxuXHRcdFx0XHRcdFx0XHRcdCsgJy0nICsgKCggICAgICAgIGFEYXlzWyBpIF0uZ2V0RGF0ZSgpIDwgMTApID8gJzAnIDogJycpICsgIGFEYXlzWyBpIF0uZ2V0RGF0ZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBPbmNlIHRoZSBsb29wIGhhcyBmaW5pc2hlZCwgcmV0dXJuIHRoZSBhcnJheSBvZiBkYXlzLlxyXG5cdFx0XHRcdHJldHVybiBhRGF5cztcclxuXHRcdFx0fVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTY3JvbGwgdG8gIHNwZWNpZmljIFwiWWVhciAmIE1vbnRoXCIgXHRpbiBJbmxpbmUgQm9va2luZyBDYWxlbmRhclxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWRcdFx0MVxyXG4gKiBAcGFyYW0ge251bWJlcn0geWVhclx0XHRcdFx0MjAyM1xyXG4gKiBAcGFyYW0ge251bWJlcn0gbW9udGhcdFx0XHQxMlx0XHRcdChmcm9tIDEgdG8gIDEyKVxyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cdFx0XHQvLyBjaGFuZ2VkIG9yIG5vdFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2NoYW5nZV95ZWFyX21vbnRoKCByZXNvdXJjZV9pZCwgeWVhciwgbW9udGggKXtcclxuXHJcblx0dmFyIGluc3QgPSBqUXVlcnkuZGF0ZXBpY2suX2dldEluc3QoIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCkgKTtcclxuXHJcblx0aWYgKCBmYWxzZSAhPSBpbnN0ICl7XHJcblxyXG5cdFx0eWVhciA9IHBhcnNlSW50KCB5ZWFyICk7XHJcblx0XHRtb250aCA9IHBhcnNlSW50KCBtb250aCApIC0gMTtcclxuXHJcblx0XHRpbnN0LmN1cnNvckRhdGUgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0aW5zdC5jdXJzb3JEYXRlLnNldEZ1bGxZZWFyKCB5ZWFyLCBtb250aCwgMSApO1xyXG5cdFx0aW5zdC5jdXJzb3JEYXRlLnNldE1vbnRoKCBtb250aCApO1x0XHRcdFx0XHRcdC8vIEluIHNvbWUgY2FzZXMsICB0aGUgc2V0RnVsbFllYXIgY2FuICBzZXQgIG9ubHkgWWVhciwgIGFuZCBub3QgdGhlIE1vbnRoIGFuZCBkYXkgICAgICAvL0ZpeEluOjYuMi4zLjVcclxuXHRcdGluc3QuY3Vyc29yRGF0ZS5zZXREYXRlKCAxICk7XHJcblxyXG5cdFx0aW5zdC5kcmF3TW9udGggPSBpbnN0LmN1cnNvckRhdGUuZ2V0TW9udGgoKTtcclxuXHRcdGluc3QuZHJhd1llYXIgID0gaW5zdC5jdXJzb3JEYXRlLmdldEZ1bGxZZWFyKCk7XHJcblxyXG5cdFx0alF1ZXJ5LmRhdGVwaWNrLl9ub3RpZnlDaGFuZ2UoIGluc3QgKTtcclxuXHRcdGpRdWVyeS5kYXRlcGljay5fYWRqdXN0SW5zdERhdGUoIGluc3QgKTtcclxuXHRcdGpRdWVyeS5kYXRlcGljay5fc2hvd0RhdGUoIGluc3QgKTtcclxuXHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRyZXR1cm4gIHRydWU7XHJcblx0fVxyXG5cdHJldHVybiAgZmFsc2U7XHJcbn0iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBRVo7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSxrQ0FBa0NBLENBQUVDLG1CQUFtQixFQUFFO0VBQ2xFO0FBQUE7O0FBSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLGlDQUFpQ0EsQ0FBRUQsbUJBQW1CLEVBQUU7RUFFaEUsSUFDTSxDQUFDLEtBQUtFLE1BQU0sQ0FBRSxHQUFHLEdBQUdGLG1CQUFtQixDQUFDRyxPQUFRLENBQUMsQ0FBQ0MsTUFBTSxDQUFTO0VBQUEsR0FDakUsSUFBSSxLQUFLRixNQUFNLENBQUUsR0FBRyxHQUFHRixtQkFBbUIsQ0FBQ0csT0FBUSxDQUFDLENBQUNFLFFBQVEsQ0FBRSxhQUFjLENBQUcsQ0FBQztFQUFBLEVBQ3RGO0lBQ0UsT0FBTyxLQUFLO0VBQ2Y7O0VBRUE7RUFDQTtFQUNBO0VBQ0FOLGtDQUFrQyxDQUFFQyxtQkFBb0IsQ0FBQzs7RUFHekQ7RUFDQTtFQUNBO0VBQ0FFLE1BQU0sQ0FBRSxHQUFHLEdBQUdGLG1CQUFtQixDQUFDRyxPQUFRLENBQUMsQ0FBQ0csSUFBSSxDQUFFLEVBQUcsQ0FBQztFQUN0REosTUFBTSxDQUFFLEdBQUcsR0FBR0YsbUJBQW1CLENBQUNHLE9BQVEsQ0FBQyxDQUFDSSxRQUFRLENBQUM7SUFDakRDLGFBQWEsRUFBRyxTQUFBQSxjQUFXQyxJQUFJLEVBQUU7TUFDNUIsT0FBT0Ms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
